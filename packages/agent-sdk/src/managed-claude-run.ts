import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"

import {
  createManagedClaudeAnalysisInvocation,
  createManagedClaudeStagedInvocation,
  type ManagedClaudeAnalysisInvocation,
  type ManagedClaudeAnalysisRequest,
} from "./managed-claude.js"
import { createManagedStageReview, type ManagedStageReview } from "./managed-codex-run.js"
import {
  ManagedStageRegistry,
  type ManagedStageReviewManifest,
} from "./managed-stage-registry.js"
import {
  BoundedAsyncQueue,
  type ManagedRuntimeEvent,
  type ManagedRuntimeResultEnvelope,
  type ManagedTerminalDisposition,
  type UnsequencedManagedRuntimeEvent,
} from "./managed-runtime.js"
import type { ExecutableFingerprint } from "./process.js"
import { WorkspaceStagingService } from "./workspace-staging.js"

export interface ManagedClaudeContextRunRequest extends ManagedClaudeAnalysisRequest {
  runtimeVersion?: string
  capabilityDigest?: `sha256:${string}`
  executableFingerprint?: ExecutableFingerprint
  timeoutMs?: number
  maxOutputBytes?: number
  maxLineBytes?: number
}

interface ManagedClaudeRuntimeRequest {
  executable: string
  runtimeVersion?: string
  capabilityDigest?: `sha256:${string}`
  executableFingerprint?: ExecutableFingerprint
  timeoutMs?: number
  maxOutputBytes?: number
  maxLineBytes?: number
}

export interface ManagedClaudeStagedRunRequest extends ManagedClaudeRuntimeRequest {
  /** Local test/wrapper prefix placed before Claude CLI arguments; never persisted. */
  executableArguments?: string[]
  sourceWorkspacePath: string
  model: string
  prompt: string
  effort?: "low" | "medium" | "high" | "xhigh" | "max"
  maxBudgetUsd?: number
  maxTurns?: number
  /** Portable Managed Run identity used only as a key in machine-local recovery metadata. */
  managedRunId?: string
  /** Exact portable governed-bindings digest used only in machine-local recovery metadata. */
  bindingsDigest?: `sha256:${string}`
  managedProvider?: { adapterId: string; agentId: string }
  stageRegistry?: ManagedStageRegistry
  stagingService?: WorkspaceStagingService
}

export interface ManagedClaudeContextRunCompletion {
  result: ManagedRuntimeResultEnvelope
  terminationCause: "normal" | "cancel-request" | "timeout" | "provider-failure" | "protocol-error"
}

export interface ManagedClaudeContextRunHandle {
  readonly events: AsyncIterable<ManagedRuntimeEvent>
  readonly completion: Promise<ManagedClaudeContextRunCompletion>
  cancel(reason?: string): Promise<void>
}

export interface ManagedClaudeStagedRunHandle {
  readonly events: AsyncIterable<ManagedRuntimeEvent>
  readonly completion: Promise<ManagedStageReview>
  cancel(reason?: string): Promise<void>
}

const defaultTimeoutMs = 30 * 60 * 1_000

interface ManagedClaudeRuntimeBounds {
  timeoutMs: number
  maxOutputBytes: number
  maxLineBytes: number
}

function positiveBound(value: number, label: string, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${label} must be between 1 and ${maximum}`)
  }
  return value
}

function runtimeBounds(request: ManagedClaudeRuntimeRequest): ManagedClaudeRuntimeBounds {
  return {
    timeoutMs: positiveBound(request.timeoutMs ?? defaultTimeoutMs, "Managed Claude timeout", 24 * 60 * 60 * 1_000),
    maxOutputBytes: positiveBound(request.maxOutputBytes ?? 16 * 1024 * 1024, "Managed Claude output bound", 64 * 1024 * 1024),
    maxLineBytes: positiveBound(request.maxLineBytes ?? 1024 * 1024, "Managed Claude line bound", 4 * 1024 * 1024),
  }
}

function portableRuntimeVersion(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const version = value.trim()
  if (!version || Buffer.byteLength(version) > 1_024 || /[/\\][\w.-]+[/\\]/u.test(version) ||
      /\b(?:token|secret|password|api[_-]?key)\s*[:=]/iu.test(version)) {
    throw new Error("Managed Claude runtime version must be bounded, path-free, and free of secret-shaped values")
  }
  return version
}

function portableDigest(
  value: `sha256:${string}` | undefined,
  label: string,
): `sha256:${string}` | undefined {
  if (value === undefined) return undefined
  if (!/^sha256:[0-9a-f]{64}$/u.test(value)) throw new Error(`${label} must be a lowercase SHA-256 digest`)
  return value
}

function boundedProviderIdentity(value: string, label: string): string {
  if (typeof value !== "string" || !value.trim() || Buffer.byteLength(value) > 1_024) {
    throw new Error(`${label} must be a non-empty bounded string`)
  }
  return value
}

function normalizedRuntimeRequest<T extends ManagedClaudeRuntimeRequest>(request: T): T {
  return {
    ...request,
    runtimeVersion: portableRuntimeVersion(request.runtimeVersion),
    capabilityDigest: portableDigest(request.capabilityDigest, "Managed Claude capability digest"),
  }
}

function textParts(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return []
  const content = (value as Record<string, unknown>).content
  if (!Array.isArray(content)) return []
  return content.flatMap((part) => {
    if (!part || typeof part !== "object" || Array.isArray(part)) return []
    const candidate = part as Record<string, unknown>
    return candidate.type === "text" && typeof candidate.text === "string" ? [candidate.text] : []
  })
}

function managedClaudeAuthenticationUnavailable(value: string): boolean {
  return [
    /\bnot logged in\b/iu,
    /\bplease (?:run|use)\s+\/?login\b/iu,
    /\blogin required\b/iu,
    /\b(?:claude|provider|account) authentication (?:is )?required\b/iu,
    /\bauthentication failed\b/iu,
  ].some((pattern) => pattern.test(value))
}

function managedClaudeFailure(record: Record<string, unknown>): {
  code: "GAEP_CLAUDE_AUTH_UNAVAILABLE" | "GAEP_CLAUDE_PROVIDER_FAILURE"
  message: string
} {
  const details = [
    typeof record.result === "string" ? record.result : "",
    ...(Array.isArray(record.errors) ? record.errors.filter((item): item is string => typeof item === "string") : []),
  ].join("\n")
  return managedClaudeAuthenticationUnavailable(details)
    ? {
        code: "GAEP_CLAUDE_AUTH_UNAVAILABLE",
        message: "Claude authentication is unavailable for the managed runtime.",
      }
    : {
        code: "GAEP_CLAUDE_PROVIDER_FAILURE",
        message: "Claude returned a managed provider failure.",
      }
}

function sanitizePortableProviderText(value: string): string {
  if (managedClaudeAuthenticationUnavailable(value)) {
    return "Claude authentication is unavailable for the managed runtime."
  }
  const maximumBytes = 64 * 1024
  let sanitized = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "")
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/giu, "Bearer [REDACTED]")
    .replace(/\b(?:sk|rk|pk)-[A-Za-z0-9_-]{8,}\b/gu, "[REDACTED_API_KEY]")
    .replace(/\b(token|secret|password|api[_-]?key|authorization)\s*[:=]\s*[^\s,;]+/giu, "$1=[REDACTED]")
    .replace(/\b[A-Za-z]:\\[^\s"'<>]*/gu, "[ABSOLUTE_PATH]")
    .replace(/(^|[\s(="'])\/(?:Users|home|tmp|private|var|opt|etc)\/[^\s"'<>)]*/gu, "$1[ABSOLUTE_PATH]")
  if (Buffer.byteLength(sanitized) <= maximumBytes) return sanitized
  const suffix = "...[TRUNCATED]"
  const budget = maximumBytes - Buffer.byteLength(suffix)
  while (Buffer.byteLength(sanitized) > budget) sanitized = sanitized.slice(0, Math.floor(sanitized.length * 0.9))
  return `${sanitized}${suffix}`
}

function signalProcessTree(child: ChildProcessWithoutNullStreams, signal: NodeJS.Signals): void {
  if (!child.pid) return
  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, signal)
      return
    } catch {
      // Fall through to the direct-child fallback.
    }
  }
  try {
    child.kill(signal)
  } catch {
    // The hard-stop timer still bounds shutdown.
  }
}

async function startManagedClaudeInvocationRun(
  request: ManagedClaudeRuntimeRequest,
  invocation: ManagedClaudeAnalysisInvocation,
  bounds: ManagedClaudeRuntimeBounds,
  portableWarning: string,
): Promise<ManagedClaudeContextRunHandle> {
  const { timeoutMs, maxOutputBytes, maxLineBytes } = bounds
  const events = new BoundedAsyncQueue<ManagedRuntimeEvent>(4_096, 32 * 1024 * 1024)
  const collected: ManagedRuntimeEvent[] = []
  let sequence = 0
  let child: ChildProcessWithoutNullStreams | undefined
  let providerThreadId: string | undefined
  let providerTurnId: string | undefined
  let cancelRequested = false
  let timeoutTriggered = false
  let protocolFailed = false
  let authenticationUnavailableObserved = false
  let settled = false
  let stopOperation: Promise<void> | undefined

  const emit = (event: UnsequencedManagedRuntimeEvent): void => {
    if (collected.length >= 4_096) throw new Error("Managed Claude event count exceeded its configured bound")
    const normalized = {
      ...event,
      sequence: sequence++,
      observedAt: new Date().toISOString(),
      threadId: providerThreadId,
      turnId: providerTurnId,
    } as ManagedRuntimeEvent
    collected.push(normalized)
    events.push(normalized)
  }

  const stop = async (): Promise<void> => {
    if (stopOperation) return stopOperation
    stopOperation = (async () => {
      const processToStop = child
      if (!processToStop || processToStop.exitCode !== null || processToStop.signalCode !== null) return
      signalProcessTree(processToStop, "SIGTERM")
      await new Promise<void>((resolve) => {
        const closed = (): void => {
          clearTimeout(timer)
          resolve()
        }
        const timer = setTimeout(() => {
          processToStop.off("close", closed)
          signalProcessTree(processToStop, "SIGKILL")
          resolve()
        }, 500)
        timer.unref()
        processToStop.once("close", closed)
      })
    })()
    return stopOperation
  }

  const completion = (async (): Promise<ManagedClaudeContextRunCompletion> => {
    let terminalDisposition: ManagedTerminalDisposition = "unknown"
    let terminationCause: ManagedClaudeContextRunCompletion["terminationCause"] = "protocol-error"
    let resultObserved = false
    let outputBytes = 0
    let stdoutBuffer = ""
    let timer: NodeJS.Timeout | undefined
    try {
      child = spawn(invocation.invocation.executable, invocation.invocation.args, {
        cwd: invocation.invocation.cwd,
        env: invocation.invocation.environment,
        stdio: ["pipe", "pipe", "pipe"],
        detached: true,
        windowsHide: true,
      })
      const close = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
        child!.once("error", reject)
        child!.once("close", (code, signal) => resolve({ code, signal }))
      })
      emit({ type: "lifecycle", phase: "initialized" })
      timer = setTimeout(() => {
        timeoutTriggered = true
        void stop()
      }, timeoutMs)
      timer.unref()

      const parseLine = (line: string): void => {
        if (!line.trim()) return
        if (Buffer.byteLength(line) > maxLineBytes) throw new Error("Managed Claude protocol line exceeded its configured bound")
        let message: unknown
        try {
          message = JSON.parse(line)
        } catch {
          throw new Error("Managed Claude emitted malformed stream JSON")
        }
        if (!message || typeof message !== "object" || Array.isArray(message)) return
        const record = message as Record<string, unknown>
        if (typeof record.session_id === "string" && record.session_id.trim()) providerThreadId = record.session_id
        if (typeof record.uuid === "string" && record.uuid.trim()) providerTurnId = record.uuid
        if (record.type === "system" && record.subtype === "init") {
          emit({ type: "lifecycle", phase: "thread-started" })
          return
        }
        if (record.type === "assistant") {
          for (const text of textParts(record.message)) {
            const sanitized = sanitizePortableProviderText(text)
            if (sanitized === "Claude authentication is unavailable for the managed runtime.") {
              authenticationUnavailableObserved = true
              continue
            }
            emit({ type: "output-delta", channel: "assistant", text: sanitized })
          }
          return
        }
        if (record.type === "result") {
          resultObserved = true
          const isError = record.is_error === true || record.subtype === "error" || authenticationUnavailableObserved
          if (!isError && record.structured_output && typeof record.structured_output === "object") {
            emit({
              type: "output-delta",
              channel: "assistant",
              text: sanitizePortableProviderText(JSON.stringify(record.structured_output)),
            })
          }
          terminalDisposition = isError ? "failed" : "completed"
          terminationCause = isError ? "provider-failure" : "normal"
          if (isError) emit({
            type: "error",
            ...(authenticationUnavailableObserved
              ? {
                  code: "GAEP_CLAUDE_AUTH_UNAVAILABLE" as const,
                  message: "Claude authentication is unavailable for the managed runtime.",
                }
              : managedClaudeFailure(record)),
            retryable: false,
          })
          emit({ type: "lifecycle", phase: "turn-completed", turnStatus: isError ? "failed" : "completed" })
        }
      }

      child.stdout.setEncoding("utf8")
      child.stdout.on("data", (chunk: string) => {
        try {
          outputBytes += Buffer.byteLength(chunk)
          if (outputBytes > maxOutputBytes) throw new Error("Managed Claude output exceeded its configured bound")
          stdoutBuffer += chunk
          let newline = stdoutBuffer.indexOf("\n")
          while (newline >= 0) {
            const line = stdoutBuffer.slice(0, newline)
            stdoutBuffer = stdoutBuffer.slice(newline + 1)
            parseLine(line)
            newline = stdoutBuffer.indexOf("\n")
          }
          if (Buffer.byteLength(stdoutBuffer) > maxLineBytes) throw new Error("Managed Claude protocol line exceeded its configured bound")
        } catch {
          protocolFailed = true
          terminalDisposition = "protocol-error"
          terminationCause = "protocol-error"
          void stop()
        }
      })
      child.stderr.on("data", (chunk: Buffer) => {
        outputBytes += chunk.length
        if (outputBytes > maxOutputBytes) {
          protocolFailed = true
          terminalDisposition = "protocol-error"
          terminationCause = "protocol-error"
          void stop()
        }
      })
      child.stdin.end(invocation.invocation.stdin ?? "")
      const closed = await close
      if (stdoutBuffer.trim() && !protocolFailed) parseLine(stdoutBuffer)
      if (timeoutTriggered) {
        terminalDisposition = "interrupted"
        terminationCause = "timeout"
      } else if (cancelRequested) {
        terminalDisposition = "cancelled"
        terminationCause = "cancel-request"
      } else if (protocolFailed) {
        terminalDisposition = "protocol-error"
        terminationCause = "protocol-error"
      } else if (!resultObserved) {
        terminalDisposition = closed.code === 0 ? "protocol-error" : "crashed"
        terminationCause = closed.code === 0 ? "protocol-error" : "provider-failure"
      }
    } catch {
      terminalDisposition = timeoutTriggered
        ? "interrupted"
        : cancelRequested
          ? "cancelled"
          : "protocol-error"
      terminationCause = timeoutTriggered
        ? "timeout"
        : cancelRequested
          ? "cancel-request"
          : "protocol-error"
      try {
        emit({ type: "error", message: "Managed Claude coordination failed.", code: "GAEP_MANAGED_CLAUDE_FAILURE", retryable: false })
      } catch {
        // Preserve the primary bounded-queue failure.
      }
      await stop().catch(() => undefined)
    } finally {
      if (timer) clearTimeout(timer)
      settled = true
      events.close()
      await invocation.cleanup().catch(() => undefined)
    }
    return {
      result: {
        portable: {
          schemaVersion: 1,
          provider: {
            adapterId: "gaep.claude-code-cli",
            agentId: "claude-code-cli",
            runtimeVersion: portableRuntimeVersion(request.runtimeVersion),
            capabilityDigest: request.capabilityDigest,
          },
          providerThreadId,
          providerTurnId,
          events: collected,
          terminalDisposition,
          warnings: [...(invocation.invocation.warnings ?? []), portableWarning],
          postconditionStatus: "not-assessed",
        },
        local: {
          executablePath: request.executable,
          executableFingerprint: request.executableFingerprint,
        },
      },
      terminationCause,
    }
  })().catch((error: unknown) => {
    events.fail(error instanceof Error ? error : new Error(String(error)))
    throw error
  })

  return {
    events,
    completion,
    cancel: async (_reason?: string): Promise<void> => {
      if (settled || cancelRequested) return
      cancelRequested = true
      await stop()
    },
  }
}

export async function startManagedClaudeContextRun(
  request: ManagedClaudeContextRunRequest,
): Promise<ManagedClaudeContextRunHandle> {
  const normalizedRequest = normalizedRuntimeRequest(request)
  const bounds = runtimeBounds(normalizedRequest)
  const invocation = await createManagedClaudeAnalysisInvocation(request)
  return startManagedClaudeInvocationRun(
    normalizedRequest,
    invocation,
    bounds,
    "Managed Claude execution was tool-free and context-only.",
  )
}

export async function startManagedClaudeStagedRun(
  request: ManagedClaudeStagedRunRequest,
): Promise<ManagedClaudeStagedRunHandle> {
  const normalizedRequest = normalizedRuntimeRequest(request)
  const bounds = runtimeBounds(normalizedRequest)
  const bindingsDigest = portableDigest(request.bindingsDigest, "Managed Claude governed-bindings digest")
  const managedRunId = request.managedRunId
  if (managedRunId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(managedRunId)) {
    throw new Error("Managed Claude Run identity must be a canonical UUID")
  }
  const managedProvider = request.managedProvider
    ? {
        adapterId: boundedProviderIdentity(request.managedProvider.adapterId, "Managed Claude adapter identity"),
        agentId: boundedProviderIdentity(request.managedProvider.agentId, "Managed Claude agent identity"),
      }
    : undefined
  if (managedRunId && (!normalizedRequest.capabilityDigest || !bindingsDigest || !managedProvider)) {
    throw new Error("Managed Claude durable review requires exact capability and governed-bindings digests")
  }
  if (!managedRunId && (bindingsDigest || managedProvider)) {
    throw new Error("Managed Claude durable review metadata requires a Managed Run identity")
  }
  const stagingService = request.stagingService ?? new WorkspaceStagingService()
  const stage = await stagingService.create(request.sourceWorkspacePath)
  const stageRegistry = managedRunId
    ? request.stageRegistry ?? new ManagedStageRegistry()
    : undefined
  try {
    if (managedRunId && stageRegistry) await stageRegistry.register(managedRunId, stage)
    const invocation = await createManagedClaudeStagedInvocation({
      executable: request.executable,
      executableArguments: request.executableArguments,
      model: request.model,
      prompt: request.prompt,
      stagingWorkspacePath: stage.root,
      effort: request.effort,
      maxBudgetUsd: request.maxBudgetUsd,
      maxTurns: request.maxTurns,
    })
    const runtime = await startManagedClaudeInvocationRun(
      normalizedRequest,
      invocation,
      bounds,
      "Managed Claude was launched with a GAEP-owned isolated stage as its working directory; source apply remains separately governed.",
    )
    const completion = (async (): Promise<ManagedStageReview> => {
      const completed = await runtime.completion
      const inspection = await stagingService.inspect(stage)
      const initialResult: ManagedRuntimeResultEnvelope = {
        portable: {
          ...structuredClone(completed.result.portable),
          staging: {
            baselineDigest: inspection.baselineDigest,
            finalDigest: inspection.finalDigest,
            changes: structuredClone(inspection.changes),
            excludedPaths: [...inspection.excludedPaths],
            applied: false,
          },
        },
        local: {
          ...structuredClone(completed.result.local),
          sourceWorkspacePath: stage.sourceRoot,
          stagingWorkspacePath: stage.root,
        },
      }
      const manifest: ManagedStageReviewManifest | undefined = managedRunId && normalizedRequest.capabilityDigest &&
        bindingsDigest && managedProvider
        ? {
            schemaVersion: 1,
            kind: "gaep-managed-stage-review-manifest-v1",
            managedRunId,
            bindingsDigest,
            provider: {
              adapterId: managedProvider.adapterId,
              agentId: managedProvider.agentId,
              modelId: request.model,
              capabilityDigest: normalizedRequest.capabilityDigest,
            },
            stage: stagingService.exportManifest(stage),
            inspection,
            terminalDisposition: initialResult.portable.terminalDisposition,
          }
        : undefined
      const reviewLeaseToken = managedRunId && stageRegistry
        ? await stageRegistry.markReview(managedRunId, manifest)
        : undefined
      return createManagedStageReview({
        initialResult,
        inspection,
        terminalDisposition: initialResult.portable.terminalDisposition,
        sourceWorkspacePath: stage.sourceRoot,
        stage,
        stagingService,
        managedRunId,
        stageRegistry,
        reviewLeaseToken,
      })
    })().catch(async (error: unknown) => {
      await stagingService.cleanup(stage).catch(() => undefined)
      if (managedRunId && stageRegistry) await stageRegistry.complete(managedRunId).catch(() => undefined)
      throw error
    })
    return { events: runtime.events, completion, cancel: (reason) => runtime.cancel(reason) }
  } catch (error) {
    await stagingService.cleanup(stage).catch(() => undefined)
    if (managedRunId && stageRegistry) await stageRegistry.complete(managedRunId).catch(() => undefined)
    throw error
  }
}
