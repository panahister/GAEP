import { createHash } from "node:crypto"
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process"
import { delimiter, isAbsolute, resolve } from "node:path"

import {
  BoundedAsyncQueue,
  type ManagedApprovalDecision,
  type ManagedApprovalMediator,
  type ManagedApprovalRequest,
  type ManagedPostconditionStatus,
  type ManagedRuntimeEvent,
  type ManagedRuntimeResultEnvelope,
  type ManagedStagingEvidence,
  type ManagedTerminalDisposition,
  type UnsequencedManagedRuntimeEvent,
} from "./managed-runtime.js"
import type { CodexJsonValue, CodexReasoningEffort, CodexStableRequestParams } from "./codex-app-server-v2.types.js"
import {
  filterChildEnvironment,
  fingerprintExecutable,
  type ExecutableFingerprint,
} from "./process.js"
import { type WorkspaceStage, WorkspaceStagingService } from "./workspace-staging.js"

type RpcId = number | string
type JsonObject = Record<string, unknown>

interface PendingRequest {
  method: string
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

export interface CodexAppServerOptions {
  executable: string
  stagingService: WorkspaceStagingService
  /** Expose the provider shell tool and permit command approval requests. Defaults to true for the low-level transport. */
  allowShellTool?: boolean
  /** Give the provider a staged workspace-write sandbox and permit file-change approvals. Defaults to true. */
  allowFileChanges?: boolean
  runtimeVersion?: string
  capabilityDigest?: `sha256:${string}`
  args?: string[]
  processCwd?: string
  approvalMediator?: ManagedApprovalMediator
  requestTimeoutMs?: number
  terminationGraceMs?: number
  maxFrameBytes?: number
  maxBufferedBytes?: number
  maxPendingRequests?: number
  maxQueuedEvents?: number
  maxQueuedEventBytes?: number
  maxRecordedEventBytes?: number
  maxEventTextBytes?: number
}

export interface CodexStagedThreadOptions {
  stage: WorkspaceStage
  model: string
  developerInstructions?: string
}

export interface CodexStagedTurnOptions {
  stage: WorkspaceStage
  threadId: string
  prompt: string
  model?: string
  effort?: CodexReasoningEffort
}

export interface CodexManagedResultOptions {
  stage: WorkspaceStage
  providerThreadId?: string
  providerTurnId?: string
  terminalDisposition: ManagedTerminalDisposition
  warnings?: string[]
  postconditionStatus?: ManagedPostconditionStatus
  stagingEvidence?: ManagedStagingEvidence
}

const defaultDenialMediator: ManagedApprovalMediator = async () => ({
  outcome: "deny",
  reason: "No GAEP managed approval mediator authorized this provider request",
})

export function codexAppServerLaunchArgs(allowShellTool = true): string[] {
  return [
    "--strict-config",
    "-c", "mcp_servers={}",
    "-c", 'web_search="disabled"',
    "-c", 'shell_environment_policy.inherit="none"',
    "-c", "project_doc_max_bytes=0",
    "-c", "project_doc_fallback_filenames=[]",
    "-c", "features.apps=false",
    "-c", "features.goals=false",
    "-c", "features.hooks=false",
    "-c", "features.memories=false",
    "-c", "features.multi_agent=false",
    "-c", "features.remote_plugin=false",
    "-c", "features.shell_snapshot=false",
    "-c", `features.shell_tool=${String(allowShellTool)}`,
    "app-server", "--listen", "stdio://",
  ]
}

function managedThreadConfig(allowShellTool: boolean): { [key: string]: CodexJsonValue | undefined } {
  return {
    mcp_servers: {},
    web_search: "disabled",
    shell_environment_policy: { inherit: "none" },
    project_doc_max_bytes: 0,
    project_doc_fallback_filenames: [],
    features: {
      apps: false,
      goals: false,
      hooks: false,
      memories: false,
      multi_agent: false,
      remote_plugin: false,
      shell_snapshot: false,
      shell_tool: allowShellTool,
    },
  }
}

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value as JsonObject
}

function textField(value: JsonObject, key: string): string | undefined {
  return typeof value[key] === "string" ? value[key] : undefined
}

function rpcError(value: unknown, method: string): Error {
  const error = object(value, `JSON-RPC error for ${method}`)
  const code = typeof error.code === "number" ? ` (${error.code})` : ""
  const message = typeof error.message === "string" ? error.message : "unknown JSON-RPC error"
  return new Error(`${method} failed${code}: ${message}`)
}

function sha256Text(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

export class CodexAppServerSupervisor {
  readonly events: AsyncIterable<ManagedRuntimeEvent>

  private readonly queue: BoundedAsyncQueue<ManagedRuntimeEvent>
  private readonly approvalMediator: ManagedApprovalMediator
  private readonly requestTimeoutMs: number
  private readonly terminationGraceMs: number
  private readonly maxFrameBytes: number
  private readonly maxBufferedBytes: number
  private readonly maxPendingRequests: number
  private readonly maxRecordedEventBytes: number
  private readonly maxEventTextBytes: number
  private readonly allowShellTool: boolean
  private readonly allowFileChanges: boolean
  private readonly pending = new Map<RpcId, PendingRequest>()
  private readonly recordedEvents: ManagedRuntimeEvent[] = []
  private readonly warnings: string[] = []
  private readonly localPathRedactions = new Set<string>()
  private child: ChildProcessWithoutNullStreams | undefined
  private processGroupId: number | undefined
  private fingerprint: ExecutableFingerprint | undefined
  private stdoutBuffer = Buffer.alloc(0)
  private stderrBytes = 0
  private recordedEventBytes = 0
  private sequence = 0
  private requestSequence = 1
  private writeChain: Promise<void> = Promise.resolve()
  private intentionalStop = false
  private disposed = false

  constructor(private readonly options: CodexAppServerOptions) {
    if (options.allowShellTool !== undefined && typeof options.allowShellTool !== "boolean") {
      throw new Error("allowShellTool must be a boolean")
    }
    if (options.allowFileChanges !== undefined && typeof options.allowFileChanges !== "boolean") {
      throw new Error("allowFileChanges must be a boolean")
    }
    this.approvalMediator = options.approvalMediator ?? defaultDenialMediator
    this.allowShellTool = options.allowShellTool ?? true
    this.allowFileChanges = options.allowFileChanges ?? true
    this.requestTimeoutMs = options.requestTimeoutMs ?? 10_000
    this.terminationGraceMs = options.terminationGraceMs ?? 250
    this.maxFrameBytes = options.maxFrameBytes ?? 1024 * 1024
    this.maxBufferedBytes = options.maxBufferedBytes ?? 2 * 1024 * 1024
    this.maxPendingRequests = options.maxPendingRequests ?? 128
    this.maxRecordedEventBytes = options.maxRecordedEventBytes ?? 16 * 1024 * 1024
    this.maxEventTextBytes = options.maxEventTextBytes ?? 64 * 1024
    this.queue = new BoundedAsyncQueue<ManagedRuntimeEvent>(
      options.maxQueuedEvents ?? 1024,
      options.maxQueuedEventBytes ?? 8 * 1024 * 1024,
    )
    this.events = this.queue
    for (const [name, value] of Object.entries({
      requestTimeoutMs: this.requestTimeoutMs,
      terminationGraceMs: this.terminationGraceMs,
      maxFrameBytes: this.maxFrameBytes,
      maxBufferedBytes: this.maxBufferedBytes,
      maxPendingRequests: this.maxPendingRequests,
      maxRecordedEventBytes: this.maxRecordedEventBytes,
      maxEventTextBytes: this.maxEventTextBytes,
    })) {
      if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive safe integer`)
    }
    if (this.maxBufferedBytes < this.maxFrameBytes) throw new Error("maxBufferedBytes cannot be smaller than maxFrameBytes")
  }

  async start(): Promise<void> {
    if (this.disposed) throw new Error("Codex app-server supervisor is disposed")
    if (this.child) throw new Error("Codex app-server is already running")
    const fingerprint = await fingerprintExecutable(this.options.executable)
    this.fingerprint = fingerprint
    this.localPathRedactions.add(this.fingerprint.canonicalPath)
    if (this.options.processCwd) this.localPathRedactions.add(resolveLocalPath(this.options.processCwd))
    if (this.disposed) throw new Error("Codex app-server supervisor was disposed during startup")
    const args = this.options.args ?? codexAppServerLaunchArgs(this.allowShellTool)
    const childEnvironment = filterChildEnvironment(process.env, ["CODEX_HOME"])
    for (const key of [
      "HOME", "USERPROFILE", "TMPDIR", "TMP", "TEMP", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_DATA_HOME",
      "CODEX_HOME", "SHELL",
    ]) {
      const value = childEnvironment[key]
      if (!value) continue
      this.localPathRedactions.add(value)
      if (isAbsolute(value)) this.localPathRedactions.add(resolveLocalPath(value))
    }
    for (const path of (childEnvironment.PATH ?? "").split(delimiter).filter(Boolean)) {
      this.localPathRedactions.add(path)
      if (isAbsolute(path)) this.localPathRedactions.add(resolveLocalPath(path))
    }
    this.intentionalStop = false
    const child = spawn(this.fingerprint.canonicalPath, args, {
      cwd: this.options.processCwd,
      env: childEnvironment,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      detached: true,
    })
    this.child = child
    this.processGroupId = child.pid
    child.stdout.on("data", (chunk: Buffer) => this.onStdout(chunk))
    child.stderr.on("data", (chunk: Buffer) => this.onStderr(chunk))
    child.on("error", (error) => this.onProcessFailure(error))
    child.on("close", (code, signal) => this.onProcessClose(child, code, signal))
    try {
      const verified = await fingerprintExecutable(this.fingerprint.canonicalPath)
      if (verified.digest !== this.fingerprint.digest) {
        throw new Error("Codex app-server executable changed between fingerprint and process launch")
      }
      await this.request("initialize", {
        clientInfo: { name: "gaep", title: "GAEP Managed Runtime", version: "0.1.0" },
        capabilities: { experimentalApi: false, requestAttestation: false },
      })
      await this.notify("initialized")
      this.emit({ type: "lifecycle", phase: "initialized" })
    } catch (error) {
      await this.stopProcess()
      throw error
    }
  }

  async startStagedThread(options: CodexStagedThreadOptions): Promise<{ threadId: string }> {
    this.assertRunningWithStage(options.stage)
    if (!options.model.trim()) throw new Error("A Codex model identifier is required")
    const result = object(await this.request("thread/start", {
      model: options.model,
      cwd: options.stage.root,
      approvalPolicy: "on-request",
      approvalsReviewer: "user",
      sandbox: this.allowFileChanges ? "workspace-write" : "read-only",
      config: managedThreadConfig(this.allowShellTool),
      developerInstructions: options.developerInstructions ?? null,
      ephemeral: false,
    }), "thread/start result")
    const thread = object(result.thread, "thread/start thread")
    const threadId = textField(thread, "id")
    if (!threadId) throw new Error("thread/start response did not contain a thread ID")
    return { threadId }
  }

  async resumeStagedThread(options: CodexStagedThreadOptions & { threadId: string }): Promise<{ threadId: string }> {
    this.assertRunningWithStage(options.stage)
    if (!options.threadId.trim()) throw new Error("A provider thread ID is required")
    const result = object(await this.request("thread/resume", {
      threadId: options.threadId,
      model: options.model,
      cwd: options.stage.root,
      approvalPolicy: "on-request",
      approvalsReviewer: "user",
      sandbox: this.allowFileChanges ? "workspace-write" : "read-only",
      config: managedThreadConfig(this.allowShellTool),
      developerInstructions: options.developerInstructions ?? null,
    }), "thread/resume result")
    const thread = object(result.thread, "thread/resume thread")
    const threadId = textField(thread, "id")
    if (!threadId) throw new Error("thread/resume response did not contain a thread ID")
    this.emit({ type: "lifecycle", phase: "thread-resumed", threadId })
    return { threadId }
  }

  async startStagedTurn(options: CodexStagedTurnOptions): Promise<{ threadId: string; turnId: string }> {
    this.assertRunningWithStage(options.stage)
    if (!options.threadId.trim()) throw new Error("A provider thread ID is required")
    if (!options.prompt.trim()) throw new Error("A non-empty turn prompt is required")
    const result = object(await this.request("turn/start", {
      threadId: options.threadId,
      input: [{ type: "text", text: options.prompt, text_elements: [] }],
      cwd: options.stage.root,
      approvalPolicy: "on-request",
      approvalsReviewer: "user",
      sandboxPolicy: this.allowFileChanges
        ? {
            type: "workspaceWrite",
            writableRoots: [options.stage.root],
            networkAccess: false,
            excludeTmpdirEnvVar: true,
            excludeSlashTmp: true,
          }
        : { type: "readOnly", networkAccess: false },
      model: options.model ?? null,
      ...(options.effort === undefined ? {} : { effort: options.effort }),
    }), "turn/start result")
    const turn = object(result.turn, "turn/start turn")
    const turnId = textField(turn, "id")
    if (!turnId) throw new Error("turn/start response did not contain a turn ID")
    return { threadId: options.threadId, turnId }
  }

  async cancelTurn(threadId: string, turnId: string): Promise<void> {
    if (!threadId.trim() || !turnId.trim()) throw new Error("Thread and turn IDs are required for cancellation")
    await this.request("turn/interrupt", { threadId, turnId })
  }

  async restart(): Promise<void> {
    if (this.disposed) throw new Error("Codex app-server supervisor is disposed")
    await this.stopProcess()
    await this.start()
    this.emit({ type: "lifecycle", phase: "restarted" })
  }

  async buildResult(options: CodexManagedResultOptions): Promise<ManagedRuntimeResultEnvelope> {
    if (!this.fingerprint) throw new Error("Codex app-server has no captured executable fingerprint")
    this.options.stagingService.assertManagedStage(options.stage)
    const inspection = await this.options.stagingService.inspect(options.stage)
    if (options.stagingEvidence) {
      this.options.stagingService.assertManagedEvidence(options.stage, options.stagingEvidence)
    }
    const staging = options.stagingEvidence ?? {
      baselineDigest: inspection.baselineDigest,
      finalDigest: inspection.finalDigest,
      changes: inspection.changes,
      excludedPaths: inspection.excludedPaths,
      applied: false,
    }
    return {
      portable: {
        schemaVersion: 1,
        provider: {
          adapterId: "gaep.codex-app-server",
          agentId: "codex-app-server",
          runtimeVersion: this.options.runtimeVersion,
          capabilityDigest: this.options.capabilityDigest,
        },
        providerThreadId: options.providerThreadId,
        providerTurnId: options.providerTurnId,
        events: structuredClone(this.recordedEvents),
        staging,
        terminalDisposition: options.terminalDisposition,
        warnings: [
          ...this.warnings,
          "Codex app-server threads use provider session persistence (ephemeral=false) so explicit restart/resume is possible; persisted provider history is not a GAEP portable record.",
          ...(options.warnings ?? []).map((warning) => this.sanitizePortableText(warning)),
        ],
        postconditionStatus: options.postconditionStatus ?? "not-assessed",
      },
      local: {
        executablePath: this.fingerprint.canonicalPath,
        executableFingerprint: structuredClone(this.fingerprint),
        sourceWorkspacePath: options.stage.sourceRoot,
        stagingWorkspacePath: options.stage.root,
        processId: this.child?.pid,
      },
    }
  }

  async stop(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    await this.stopProcess()
    this.queue.close()
  }

  private assertRunningWithStage(stage: WorkspaceStage): void {
    if (!this.child) throw new Error("Codex app-server is not running")
    this.options.stagingService.assertManagedStage(stage)
    this.localPathRedactions.add(stage.sourceRoot)
    this.localPathRedactions.add(stage.root)
  }

  private async request<Method extends keyof CodexStableRequestParams>(
    method: Method,
    params: CodexStableRequestParams[Method],
  ): Promise<unknown> {
    if (!this.child) throw new Error("Codex app-server is not running")
    if (this.pending.size >= this.maxPendingRequests) throw new Error("Codex app-server pending request limit exceeded")
    const id = this.requestSequence++
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`${method} timed out after ${this.requestTimeoutMs}ms`))
      }, this.requestTimeoutMs)
      this.pending.set(id, { method, resolve, reject, timer })
      void this.write({ id, method, params }).catch((error: unknown) => {
        const pending = this.pending.get(id)
        if (!pending) return
        clearTimeout(pending.timer)
        this.pending.delete(id)
        pending.reject(error instanceof Error ? error : new Error(String(error)))
      })
    })
  }

  private async notify(method: string, params?: unknown): Promise<void> {
    await this.write(params === undefined ? { method } : { method, params })
  }

  private async write(message: JsonObject): Promise<void> {
    const frame = `${JSON.stringify(message)}\n`
    if (Buffer.byteLength(frame) > this.maxFrameBytes) throw new Error("Outbound Codex app-server frame exceeds its configured bound")
    const operation = this.writeChain.then(async () => {
      const child = this.child
      if (!child || child.stdin.destroyed) throw new Error("Codex app-server stdin is unavailable")
      if (child.stdin.write(frame)) return
      await new Promise<void>((resolve, reject) => {
        const onDrain = (): void => {
          cleanup()
          resolve()
        }
        const onError = (error: Error): void => {
          cleanup()
          reject(error)
        }
        const cleanup = (): void => {
          child.stdin.off("drain", onDrain)
          child.stdin.off("error", onError)
        }
        child.stdin.once("drain", onDrain)
        child.stdin.once("error", onError)
      })
    })
    this.writeChain = operation.catch(() => undefined)
    await operation
  }

  private onStdout(chunk: Buffer): void {
    try {
      this.stdoutBuffer = Buffer.concat([this.stdoutBuffer, chunk])
      let newline = this.stdoutBuffer.indexOf(0x0a)
      while (newline !== -1) {
        const frame = this.stdoutBuffer.subarray(0, newline)
        this.stdoutBuffer = this.stdoutBuffer.subarray(newline + 1)
        if (frame.length > this.maxFrameBytes) throw new Error("Codex app-server frame exceeds its configured bound")
        if (frame.length > 0) this.handleFrame(frame)
        newline = this.stdoutBuffer.indexOf(0x0a)
      }
      if (this.stdoutBuffer.length > this.maxFrameBytes || this.stdoutBuffer.length > this.maxBufferedBytes) {
        throw new Error("Codex app-server unterminated frame exceeds its configured bound")
      }
    } catch (error) {
      this.protocolFailure(error instanceof Error ? error : new Error(String(error)))
    }
  }

  private onStderr(chunk: Buffer): void {
    try {
      this.stderrBytes += chunk.length
      if (this.stderrBytes > this.maxFrameBytes) {
        this.protocolFailure(new Error("Codex app-server stderr exceeded its configured bound"))
        return
      }
      const message = this.sanitizePortableText(chunk.toString("utf8").trim())
      if (message) {
        this.warnings.push(`app-server stderr: ${message}`)
        this.emit({ type: "warning", message: `Codex app-server stderr: ${message}` })
      }
    } catch (error) {
      this.protocolFailure(error instanceof Error ? error : new Error(String(error)))
    }
  }

  private handleFrame(frame: Buffer): void {
    const parsed = JSON.parse(frame.toString("utf8")) as unknown
    const message = object(parsed, "Codex app-server frame")
    const id = typeof message.id === "string" || typeof message.id === "number" ? message.id : undefined
    const method = typeof message.method === "string" ? message.method : undefined
    if (id !== undefined && method) {
      void this.handleServerRequest(id, method, message.params).catch((error: unknown) => {
        this.protocolFailure(error instanceof Error ? error : new Error(String(error)))
      })
      return
    }
    if (id !== undefined) {
      const pending = this.pending.get(id)
      if (!pending) throw new Error(`Codex app-server returned an unknown response ID: ${String(id)}`)
      clearTimeout(pending.timer)
      this.pending.delete(id)
      if (message.error !== undefined) pending.reject(rpcError(message.error, pending.method))
      else pending.resolve(message.result)
      return
    }
    if (method) {
      this.normalizeNotification(method, message.params)
      return
    }
    throw new Error("Codex app-server frame is neither a response, request, nor notification")
  }

  private async handleServerRequest(id: RpcId, method: string, rawParams: unknown): Promise<void> {
    const params = object(rawParams ?? {}, `${method} params`)
    let kind: ManagedApprovalRequest["kind"] = "unsupported"
    if (method === "item/commandExecution/requestApproval") kind = "command"
    else if (method === "item/fileChange/requestApproval") kind = "file-change"
    else if (method === "item/permissions/requestApproval") kind = "permissions"
    const request: ManagedApprovalRequest = {
      requestId: String(id),
      kind,
      threadId: textField(params, "threadId"),
      turnId: textField(params, "turnId"),
      itemId: textField(params, "itemId"),
      reason: textField(params, "reason"),
      commandDigest: kind === "command" && typeof params.command === "string" ? sha256Text(params.command) : undefined,
    }
    if (kind === "unsupported") {
      this.emitApproval(request, { outcome: "deny", reason: "Unsupported provider request" }, "unsupported")
      await this.write({ id, error: { code: -32_001, message: "Denied by GAEP managed runtime" } })
      return
    }
    const policyDenial = kind === "command" && !this.allowShellTool
      ? { outcome: "deny" as const, reason: "The GAEP run policy disables provider shell commands" }
      : kind === "file-change" && !this.allowFileChanges
        ? { outcome: "deny" as const, reason: "The GAEP run policy disables provider file changes" }
        : undefined
    const decision = policyDenial ?? await this.approvalMediator(request)
    if (kind === "permissions") {
      this.emitApproval(request, decision, decision.outcome === "allow-once" ? "unsupported" : "denied")
      await this.write({ id, result: { permissions: {}, scope: "turn", strictAutoReview: true } })
      return
    }
    const allowed = decision.outcome === "allow-once"
    this.emitApproval(request, decision, allowed ? "allowed-once" : "denied")
    await this.write({ id, result: { decision: allowed ? "accept" : "decline" } })
  }

  private emitApproval(
    request: ManagedApprovalRequest,
    decision: ManagedApprovalDecision,
    outcome: "allowed-once" | "denied" | "unsupported",
  ): void {
    this.emit({
      type: "approval",
      requestId: request.requestId,
      approvalKind: request.kind,
      outcome,
      authorizationId: decision.outcome === "allow-once" ? decision.authorizationId : undefined,
      threadId: request.threadId,
      turnId: request.turnId,
    })
  }

  private normalizeNotification(method: string, rawParams: unknown): void {
    const params = object(rawParams ?? {}, `${method} notification`)
    const threadId = textField(params, "threadId")
    const turnId = textField(params, "turnId")
    if (method === "thread/started") {
      const thread = object(params.thread, "thread/started thread")
      this.emit({ type: "lifecycle", phase: "thread-started", threadId: textField(thread, "id") })
    } else if (method === "turn/started") {
      const turn = object(params.turn, "turn/started turn")
      this.emit({ type: "lifecycle", phase: "turn-started", threadId, turnId: textField(turn, "id") })
    } else if (method === "turn/completed") {
      const turn = object(params.turn, "turn/completed turn")
      const status = textField(turn, "status")
      if (status !== "completed" && status !== "interrupted" && status !== "failed") {
        throw new Error(`turn/completed contained an invalid terminal status: ${String(status)}`)
      }
      this.emit({
        type: "lifecycle",
        phase: "turn-completed",
        threadId,
        turnId: textField(turn, "id"),
        turnStatus: status,
      })
    } else if (method === "item/agentMessage/delta") {
      this.emit({ type: "output-delta", channel: "assistant", text: textField(params, "delta") ?? "", threadId, turnId })
    } else if (method === "item/reasoning/summaryTextDelta" || method === "item/reasoning/textDelta") {
      this.emit({ type: "output-delta", channel: "reasoning", text: textField(params, "delta") ?? "", threadId, turnId })
    } else if (method === "item/plan/delta") {
      this.emit({ type: "output-delta", channel: "plan", text: textField(params, "delta") ?? "", threadId, turnId })
    } else if (method === "item/commandExecution/outputDelta") {
      this.emit({ type: "output-delta", channel: "command", text: textField(params, "delta") ?? "", threadId, turnId })
    } else if (method === "item/fileChange/outputDelta") {
      this.emit({ type: "output-delta", channel: "file-change", text: textField(params, "delta") ?? "", threadId, turnId })
    } else if (method === "item/started" || method === "item/completed") {
      const item = object(params.item, `${method} item`)
      const itemId = textField(item, "id")
      const itemType = textField(item, "type")
      if (itemId && itemType) {
        this.emit({ type: "item", itemId, itemType, status: method === "item/started" ? "started" : "completed", threadId, turnId })
      }
    } else if (method === "error") {
      const error = object(params.error, "error notification")
      this.emit({
        type: "error",
        message: textField(error, "message") ?? "Codex turn failed",
        code: textField(error, "codexErrorInfo"),
        retryable: params.willRetry === true,
        threadId,
        turnId,
      })
    } else if (method === "warning" || method === "guardianWarning" || method === "configWarning") {
      this.emit({ type: "warning", message: textField(params, "message") ?? method, threadId, turnId })
    }
  }

  private emit(event: UnsequencedManagedRuntimeEvent & { threadId?: string; turnId?: string }): void {
    const portableEvent = event.type === "output-delta"
      ? { ...event, text: this.sanitizePortableText(event.text) }
      : event.type === "warning" || event.type === "error"
        ? { ...event, message: this.sanitizePortableText(event.message) }
        : event
    const normalized = {
      ...portableEvent,
      sequence: this.sequence++,
      observedAt: new Date().toISOString(),
    } as ManagedRuntimeEvent
    const bytes = Buffer.byteLength(JSON.stringify(normalized))
    if (this.recordedEventBytes + bytes > this.maxRecordedEventBytes) {
      throw new Error("Codex app-server recorded event evidence exceeded its configured bound")
    }
    this.recordedEventBytes += bytes
    this.recordedEvents.push(normalized)
    this.queue.push(normalized)
  }

  private protocolFailure(error: Error): void {
    if (this.disposed) return
    this.warnings.push(error.message)
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pending.clear()
    this.queue.fail(error)
    void this.stopProcess()
  }

  private onProcessFailure(error: Error): void {
    if (!this.intentionalStop) this.protocolFailure(error)
  }

  private onProcessClose(
    child: ChildProcessWithoutNullStreams,
    code: number | null,
    signal: NodeJS.Signals | null,
  ): void {
    if (this.child === child) this.child = undefined
    this.stdoutBuffer = Buffer.alloc(0)
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(new Error(`Codex app-server exited before responding (code=${String(code)}, signal=${String(signal)})`))
    }
    this.pending.clear()
    if (!this.intentionalStop && !this.disposed) {
      if (child.pid && this.processGroupId === child.pid) {
        this.signalProcessTree(child, child.pid, "SIGKILL")
        this.processGroupId = undefined
      }
      try {
        this.emit({ type: "error", message: "Codex app-server process exited unexpectedly", retryable: true })
      } catch {
        // The bounded queue already carries the more specific failure.
      }
      this.queue.close()
    }
  }

  private async stopProcess(): Promise<void> {
    const child = this.child
    const processGroupId = this.processGroupId
    if (!child && !processGroupId) return
    this.intentionalStop = true
    const closed = child
      ? new Promise<void>((resolve) => child.once("close", () => resolve()))
      : Promise.resolve()
    if (processGroupId) this.signalProcessTree(child, processGroupId, "SIGTERM")
    await new Promise<void>((resolve) => setTimeout(resolve, this.terminationGraceMs))
    if (processGroupId) this.signalProcessTree(child, processGroupId, "SIGKILL")
    await Promise.race([closed, new Promise<void>((resolve) => setTimeout(resolve, this.terminationGraceMs))])
    child?.stdin.destroy()
    child?.stdout.destroy()
    child?.stderr.destroy()
    child?.unref()
    if (this.child === child) this.child = undefined
    if (this.processGroupId === processGroupId) this.processGroupId = undefined
  }

  private signalProcessTree(
    child: ChildProcessWithoutNullStreams | undefined,
    processGroupId: number,
    signal: NodeJS.Signals,
  ): void {
    if (process.platform === "win32" && signal === "SIGKILL") {
      try {
        const killer = spawn("taskkill", ["/PID", String(processGroupId), "/T", "/F"], {
          env: filterChildEnvironment(),
          stdio: "ignore",
          windowsHide: true,
        })
        killer.unref()
        return
      } catch {
        // Fall through to direct process termination.
      }
    }
    if (process.platform !== "win32") {
      try {
        process.kill(-processGroupId, signal)
        return
      } catch {
        // Fall back to the direct process if the process group is gone.
      }
    }
    try {
      child?.kill(signal)
    } catch {
      // The caller's timeout keeps shutdown bounded.
    }
  }

  private sanitizePortableText(value: string): string {
    let sanitized = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    for (const path of [...this.localPathRedactions].sort((left, right) => right.length - left.length)) {
      if (path) sanitized = sanitized.split(path).join("[LOCAL_PATH]")
    }
    sanitized = sanitized
      .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
      .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_API_KEY]")
      .replace(/\b(token|secret|password|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
      .replace(/\b[A-Za-z]:\\[^\s\"'<>]*/g, "[ABSOLUTE_PATH]")
      .replace(/(^|[\s(=\"'])\/(?:Users|home|tmp|private|var|opt|etc)\/[^\s\"'<>)]*/g, "$1[ABSOLUTE_PATH]")
    if (Buffer.byteLength(sanitized) <= this.maxEventTextBytes) return sanitized
    const suffix = "...[TRUNCATED]"
    const budget = Math.max(0, this.maxEventTextBytes - Buffer.byteLength(suffix))
    let low = 0
    let high = sanitized.length
    while (low < high) {
      const middle = Math.ceil((low + high) / 2)
      if (Buffer.byteLength(sanitized.slice(0, middle)) <= budget) low = middle
      else high = middle - 1
    }
    return `${sanitized.slice(0, low)}${suffix}`
  }
}

function resolveLocalPath(path: string): string {
  return resolve(path)
}
