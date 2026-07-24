import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { access, realpath, stat } from "node:fs/promises"
import { delimiter, dirname, extname, isAbsolute, resolve } from "node:path"
import { once } from "node:events"

import {
  defaultPageSize,
  frameTooLarge,
  GaepHostError,
  hostUnavailable,
  invalidHostResponse,
  invalidUtf8,
  maximumFrameBytes,
  normalizeActorId,
  normalizeExistingLocalFolder,
  normalizeUuid,
  parseAgentReadiness,
  parseAgentHandoff,
  parseManagedReadOnlyPreview,
  parseManagedReadOnlyReceipt,
  parseManagedEvidenceDetail,
  parseManagedRunSummaryPage,
  parseAgentRuns,
  parseAgentSelection,
  parseAgentSelectionState,
  parseHostResult,
  parsePageResult,
  parsePortableSelectionSettings,
  parseProductBinding,
  parseSnapshotResult,
  protocolVersion,
  responseTooLarge,
  validatePage,
  validateProductRevision,
  type PortableDesignSnapshotPage,
  type PortableDesignSnapshotSummary,
  type ProductBinding,
  type AgentReadinessSnapshot,
  type AgentHandoff,
  type AgentRun,
  type AgentSelection,
  type AgentSelectionState,
  type ManagedReadOnlyPreview,
  type ManagedReadOnlyReceipt,
  type ManagedEvidenceDetail,
  type ManagedRunSummaryPage,
  type PortableAgentSettingValue,
} from "./protocol.js"

export interface EngineClientOptions {
  readonly workspacePath: string
  readonly engineExecutable?: string
  readonly expectedEngineSha256?: string
  readonly engineArgumentsPrefix?: readonly string[]
  readonly sourceEnvironment?: NodeJS.ProcessEnv
}

interface EngineIdentity {
  readonly path: string
  readonly digest: string
}

const safeEnvironmentNames = [
  "PATH", "LANG", "LC_ALL", "LC_CTYPE", "TMPDIR", "TMP", "TEMP",
  "SYSTEMROOT", "WINDIR", "PATHEXT", "COMSPEC",
] as const

export function safeEngineEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = Object.create(null) as NodeJS.ProcessEnv
  for (const name of safeEnvironmentNames) {
    const value = environmentValue(source, name)
    if (value !== undefined) environment[name] = value
  }
  environment.GAEP_HOST_SURFACE = "kiro-portable-design"
  return environment
}

export class GaepEngineClient {
  private readonly configuredDigest: string | undefined
  private readonly requestedExecutable: string
  private readonly engineArgumentsPrefix: readonly string[]
  private readonly childEnvironment: NodeJS.ProcessEnv
  private requestTail: Promise<void> = Promise.resolve()
  private nextId = 0
  private child: ChildProcessWithoutNullStreams | undefined
  private stdoutIterator: AsyncIterator<Buffer> | undefined
  private pendingResponse: Buffer<ArrayBufferLike> = Buffer.alloc(0)
  private boundIdentity: EngineIdentity | undefined
  private disposed = false

  private constructor(
    private readonly workspacePath: string,
    options: EngineClientOptions,
  ) {
    this.requestedExecutable = options.engineExecutable ?? process.env.GAEP_ENGINE_EXECUTABLE ?? "gaep-engine"
    this.configuredDigest = normalizeDigest(options.expectedEngineSha256 ?? process.env.GAEP_ENGINE_SHA256)
    this.engineArgumentsPrefix = Object.freeze([...(options.engineArgumentsPrefix ?? [])])
    this.childEnvironment = safeEngineEnvironment(options.sourceEnvironment ?? process.env)
  }

  static async create(options: EngineClientOptions): Promise<GaepEngineClient> {
    const workspacePath = await normalizeExistingLocalFolder(options.workspacePath)
    return new GaepEngineClient(workspacePath, options)
  }

  readProduct(): Promise<ProductBinding> {
    return this.enqueue(async () => parseProductBinding(await this.request("readProduct", {})))
  }

  probeAgentReadiness(): Promise<readonly AgentReadinessSnapshot[]> {
    return this.enqueue(async () => parseAgentReadiness(await this.request("probeAgents", {})))
  }

  readAgentSelection(): Promise<AgentSelectionState> {
    return this.enqueue(async () => parseAgentSelectionState(await this.request("readAgentSelection", {})))
  }

  selectAgent(input: {
    readonly adapterId: string
    readonly modelId: string
    readonly settings: Readonly<Record<string, PortableAgentSettingValue>>
    readonly actorId: string
  }): Promise<AgentSelection> {
    return this.enqueue(async () => {
      const adapterId = normalizeSelectionIdentifier(input.adapterId, "Adapter ID")
      const modelId = normalizeSelectionIdentifier(input.modelId, "Model ID")
      const settings = normalizeSelectionSettings(input.settings)
      const actorId = normalizeActorId(input.actorId)
      return parseAgentSelection(await this.request("selectAgent", { adapterId, modelId, settings, actorId }))
    })
  }

  listRuns(): Promise<readonly AgentRun[]> {
    return this.enqueue(async () => parseAgentRuns(await this.request("listRuns", {})))
  }

  createHandoff(input: {
    readonly fromRunId: string
    readonly productId: string
    readonly initiativeId: string
    readonly toAdapterId: string
    readonly toAgentId: string
    readonly toModelId: string
    readonly toSettings: Readonly<Record<string, PortableAgentSettingValue>>
    readonly reason: string
    readonly completedWork: readonly string[]
    readonly unresolvedMatters: readonly string[]
    readonly decisions: readonly string[]
    readonly evidence: readonly string[]
    readonly actorId: string
  }): Promise<AgentHandoff> {
    return this.enqueue(async () => {
      const fromRunId = normalizeUuid(input.fromRunId, "Source Run ID")
      const productId = normalizeUuid(input.productId, "Product ID")
      const initiativeId = normalizeUuid(input.initiativeId, "Initiative ID")
      const toAdapterId = normalizeSelectionIdentifier(input.toAdapterId, "Target Adapter ID")
      const toAgentId = normalizeSelectionIdentifier(input.toAgentId, "Target Agent ID")
      const toModelId = normalizeSelectionIdentifier(input.toModelId, "Target Model ID")
      const toSettings = normalizeSelectionSettings(input.toSettings)
      const reason = normalizeHandoffText(input.reason, "Handoff reason", 2, 5_000)
      const completedWork = normalizeHandoffTextList(input.completedWork, "Completed work")
      const unresolvedMatters = normalizeHandoffTextList(input.unresolvedMatters, "Unresolved matters")
      const decisions = normalizeHandoffTextList(input.decisions, "Decisions")
      const evidence = normalizeHandoffTextList(input.evidence, "Evidence")
      const actorId = normalizeActorId(input.actorId)
      const result = await this.request("createHandoff", {
        actorId,
        handoff: {
          fromRunId,
          toAdapterId,
          toModelId,
          toSettings,
          reason,
          completedWork,
          unresolvedMatters,
          decisions,
          evidence,
        },
      })
      return parseAgentHandoff(result, {
        fromRunId,
        productId,
        initiativeId,
        toAdapterId,
        toAgentId,
        toModelId,
        toSettings,
        reason,
        completedWork,
        unresolvedMatters,
        decisions,
        evidence,
      })
    })
  }

  previewManagedReadOnly(charterId: string, workflowPlanId: string): Promise<ManagedReadOnlyPreview> {
    return this.enqueue(async () => {
      const expected = {
        charterId: normalizeUuid(charterId, "Charter ID"),
        workflowPlanId: normalizeUuid(workflowPlanId, "Workflow Plan ID"),
      }
      return parseManagedReadOnlyPreview(
        await this.request("managed.readonly.preview", expected),
        expected,
      )
    })
  }

  executeManagedReadOnly(input: {
    readonly preview: ManagedReadOnlyPreview
    readonly timeoutMs: number
    readonly actorId: string
  }): Promise<ManagedReadOnlyReceipt> {
    return this.enqueue(async () => {
      const actorId = normalizeActorId(input.actorId)
      if (!Number.isSafeInteger(input.timeoutMs) || input.timeoutMs < 1_000 || input.timeoutMs > 300_000) {
        throw new RangeError("Managed read-only timeout must be between 1,000 and 300,000 milliseconds")
      }
      const preview = parseManagedReadOnlyPreview(input.preview, {
        charterId: input.preview.charterId,
        workflowPlanId: input.preview.workflowPlanId,
      })
      const result = await this.request("managed.readonly.execute", {
        actorId,
        charterId: preview.charterId,
        workflowPlanId: preview.workflowPlanId,
        expectedPreviewDigest: preview.previewDigest,
        timeoutMs: input.timeoutMs,
        confirmation: "attest-exact-managed-readonly-preview",
      })
      return parseManagedReadOnlyReceipt(result, preview)
    })
  }

  listManagedEvidence(
    offset = 0,
    limit = 100,
    snapshotDigest?: string,
  ): Promise<ManagedRunSummaryPage> {
    return this.enqueue(async () => {
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2_000) {
        throw new RangeError("Managed Run offset must be between 0 and 2,000")
      }
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
        throw new RangeError("Managed Run limit must be between 1 and 200")
      }
      const normalizedSnapshot = snapshotDigest?.trim().toLowerCase()
      if (snapshotDigest !== undefined && !/^sha256:[0-9a-f]{64}$/u.test(normalizedSnapshot ?? "")) {
        throw new TypeError("Managed Run snapshot digest must be SHA-256")
      }
      const expected = {
        offset,
        limit,
        ...(normalizedSnapshot ? { snapshotDigest: normalizedSnapshot } : {}),
      }
      return parseManagedRunSummaryPage(
        await this.request("managed.evidence.list", expected),
        expected,
      )
    })
  }

  readManagedEvidence(managedRunId: string): Promise<ManagedEvidenceDetail> {
    return this.enqueue(async () => {
      const normalizedManagedRunId = normalizeUuid(managedRunId, "Managed Run ID")
      return parseManagedEvidenceDetail(
        await this.request("managed.evidence.read", { managedRunId: normalizedManagedRunId }),
        normalizedManagedRunId,
      )
    })
  }

  importPortableDesignSnapshot(input: {
    readonly bundleRoot: string
    readonly expectedProductId: string
    readonly expectedProductRevision: number
    readonly actorId: string
  }): Promise<PortableDesignSnapshotSummary> {
    return this.enqueue(async () => {
      const bundleRoot = await normalizeExistingLocalFolder(input.bundleRoot)
      const productId = normalizeUuid(input.expectedProductId, "Product ID")
      const productRevision = validateProductRevision(input.expectedProductRevision)
      const actorId = normalizeActorId(input.actorId)
      const result = await this.request("productStudio.portableDesign.import", {
        bundleRoot,
        expectedProductId: productId,
        expectedProductRevision: productRevision,
        actorId,
      })
      return parseSnapshotResult(result, { productId })
    })
  }

  listPortableDesignSnapshots(offset = 0, limit = defaultPageSize): Promise<PortableDesignSnapshotPage> {
    return this.enqueue(async () => {
      validatePage(offset, limit)
      return parsePageResult(
        await this.request("productStudio.portableDesign.list", { offset, limit }),
        offset,
        limit,
      )
    })
  }

  readPortableDesignSnapshot(bundleId: string): Promise<PortableDesignSnapshotSummary> {
    return this.enqueue(async () => {
      const normalizedBundleId = normalizeUuid(bundleId, "Bundle ID")
      return parseSnapshotResult(
        await this.request("productStudio.portableDesign.read", { bundleId: normalizedBundleId }),
        { bundleId: normalizedBundleId },
      )
    })
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    await this.requestTail.catch(() => undefined)
    this.stopProcess()
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (this.disposed) return Promise.reject(hostUnavailable())
    const result = this.requestTail.then(operation, operation)
    this.requestTail = result.then(() => undefined, () => undefined)
    return result
  }

  private async request(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (this.disposed) throw hostUnavailable()
    const id = ++this.nextId
    if (!Number.isSafeInteger(id)) {
      this.stopProcess()
      throw hostUnavailable()
    }
    const serialized = JSON.stringify({ jsonrpc: "2.0", id, method, params, protocolVersion })
    if (Buffer.byteLength(serialized) > maximumFrameBytes) throw frameTooLarge()

    let raw: string
    try {
      await this.ensureStarted()
      const child = this.child
      if (!child || child.exitCode !== null || !child.stdin.writable) throw hostUnavailable()
      if (!child.stdin.write(`${serialized}\n`, "utf8")) await once(child.stdin, "drain")
      raw = await this.readResponseFrame()
    } catch (error) {
      this.stopProcess()
      if (error instanceof GaepHostError) throw error
      throw hostUnavailable()
    }

    try {
      return parseHostResult(raw, id)
    } catch (error) {
      if (error instanceof GaepHostError && error.kind === "HOST_RESPONSE_INVALID") this.stopProcess()
      if (error instanceof GaepHostError) throw error
      this.stopProcess()
      throw invalidHostResponse()
    }
  }

  private async ensureStarted(): Promise<void> {
    if (this.child && this.child.exitCode === null && !this.child.killed) return
    this.stopProcess()
    const identity = await this.resolveAndVerifyEngine()
    const child = spawn(
      identity.path,
      [...this.engineArgumentsPrefix, "--workspace", this.workspacePath],
      {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        env: this.childEnvironment,
      },
    )
    child.on("error", () => {
      // A permanent listener prevents late spawn/process errors from escaping the extension host.
    })
    child.stdin.on("error", () => {
      // The active request observes closure/write failure and converts it to a stable host error.
    })
    child.stdout.on("error", () => {
      // The async iterator observes stream failure; never surface a raw stream error globally.
    })
    child.stderr.on("error", () => {
      // Stderr is intentionally drained and never copied into user-facing diagnostics.
    })
    child.stderr.resume()
    try {
      await once(child, "spawn")
      if (await digest(identity.path) !== identity.digest) {
        throw new Error("The GAEP engine executable changed while the host process was starting")
      }
      this.child = child
      this.stdoutIterator = child.stdout[Symbol.asyncIterator]() as AsyncIterator<Buffer>
      this.pendingResponse = Buffer.alloc(0)
    } catch (error) {
      child.kill()
      throw error
    }
  }

  private async resolveAndVerifyEngine(): Promise<EngineIdentity> {
    const path = await resolveExecutable(this.requestedExecutable, this.childEnvironment)
    const executableDigest = await digest(path)
    if (this.configuredDigest && this.configuredDigest !== executableDigest) {
      throw new Error("The GAEP engine executable does not match the configured SHA-256 digest")
    }
    if (this.boundIdentity && (samePath(this.boundIdentity.path, path) === false || this.boundIdentity.digest !== executableDigest)) {
      throw new Error("The bound GAEP engine executable changed after this client was created")
    }
    this.boundIdentity ??= Object.freeze({ path, digest: executableDigest })
    return this.boundIdentity
  }

  private async readResponseFrame(): Promise<string> {
    while (true) {
      const newline = this.pendingResponse.indexOf(0x0a)
      if (newline >= 0) {
        if (newline > maximumFrameBytes) throw responseTooLarge()
        const length = newline > 0 && this.pendingResponse[newline - 1] === 0x0d ? newline - 1 : newline
        const frame = this.pendingResponse.subarray(0, length)
        this.pendingResponse = this.pendingResponse.subarray(newline + 1)
        try {
          return new TextDecoder("utf-8", { fatal: true }).decode(frame)
        } catch {
          throw invalidUtf8()
        }
      }
      if (this.pendingResponse.length > maximumFrameBytes) throw responseTooLarge()
      const iterator = this.stdoutIterator
      if (!iterator) throw hostUnavailable()
      const next = await iterator.next()
      if (next.done) throw hostUnavailable()
      const chunk = Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value)
      this.pendingResponse = this.pendingResponse.length === 0
        ? chunk
        : Buffer.concat([this.pendingResponse, chunk], this.pendingResponse.length + chunk.length)
    }
  }

  private stopProcess(): void {
    const child = this.child
    this.child = undefined
    this.stdoutIterator = undefined
    this.pendingResponse = Buffer.alloc(0)
    if (!child) return
    child.stdin.destroy()
    child.stdout.destroy()
    child.stderr.destroy()
    if (child.exitCode === null) child.kill()
  }
}

function normalizeSelectionIdentifier(value: string, label: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 20_000 ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value) ||
    /^(?:\/[\S]+|[A-Za-z]:[\\/][\S]+|\\\\[\S]+|file:\/\/[\S]+)$/u.test(value.trim()) ||
    /(?:^|[\s(="'])(?:\/(?:Users|home|tmp|private|Volumes)\/[^\s"'<>)]*|[A-Za-z]:\\[^\s"'<>)]*|\\\\[^\s"'<>)]*)/u.test(value) ||
    /\bBearer\s+\S+|\b(?:sk|sk-ant)-[A-Za-z0-9_-]{8,}\b|\b(?:token|secret|password|passwd|api[_-]?key)\s*[:=]\s*\S+/iu.test(value)) {
    throw new TypeError(`${label} must be verified portable capability text`)
  }
  return value
}

function normalizeSelectionSettings(
  value: Readonly<Record<string, PortableAgentSettingValue>>,
): Readonly<Record<string, PortableAgentSettingValue>> {
  try {
    return parsePortableSelectionSettings(value)
  } catch {
    throw new TypeError("Agent settings must contain only verified portable, non-secret values")
  }
}

function normalizeHandoffTextList(value: readonly string[], label: string): readonly string[] {
  if (!Array.isArray(value) || value.length > 256) {
    throw new TypeError(`${label} must contain at most 256 portable entries`)
  }
  return Object.freeze(value.map((item) => normalizeHandoffText(item, label, 1, 2_000)))
}

function normalizeHandoffText(value: string, label: string, minimum: number, maximum: number): string {
  if (typeof value !== "string") throw new TypeError(`${label} must be portable text`)
  const normalized = value.trim()
  if (normalized.length < minimum || normalized.length > maximum ||
    /[\u0000-\u001F\u007F-\u009F]/u.test(normalized) ||
    /(?:^|[\s(="'])(?:~[\\/]|\/(?!\/)[^\s"'<>)]*|[A-Za-z]:[\\/][^\s"'<>)]*|\\\\[^\s"'<>)]*|file:\/\/[^\s"'<>)]*)/u.test(normalized) ||
    /\bBearer\s+\S+|\b(?:sk|sk-ant)-[A-Za-z0-9_-]{8,}\b|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b|\bAKIA[A-Z0-9]{16}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:token|secret|password|passwd|api[_-]?key)\s*[:=]\s*\S+/iu.test(normalized)) {
    throw new TypeError(`${label} must be portable text without paths, controls, or secret-shaped values`)
  }
  return normalized
}

async function resolveExecutable(requested: string, environment: NodeJS.ProcessEnv): Promise<string> {
  if (!requested || requested.length > 32_768 || requested.includes("\0")) {
    throw new Error("The GAEP engine executable is invalid")
  }
  const hasDirectory = requested.includes("/") || requested.includes("\\") || dirname(requested) !== "."
  const candidates = isAbsolute(requested) || hasDirectory
    ? [resolve(requested)]
    : executableCandidates(requested, environment)
  for (const candidate of candidates) {
    try {
      await access(candidate)
      const canonical = await realpath(candidate)
      if ((await stat(canonical)).isFile()) return canonical
    } catch {
      // Continue to the next explicit PATH candidate without surfacing machine paths.
    }
  }
  throw new Error("The GAEP engine executable could not be resolved to an existing file")
}

function executableCandidates(requested: string, environment: NodeJS.ProcessEnv): string[] {
  const path = environmentValue(environment, "PATH") ?? ""
  const extensions = process.platform === "win32"
    ? (environmentValue(environment, "PATHEXT") ?? ".EXE;.CMD;.BAT").split(";").filter(Boolean)
    : [""]
  return path.split(delimiter).filter(Boolean).flatMap((directory) => extensions.map((extension) => {
    const requestedExtension = extname(requested)
    const name = requestedExtension || !extension ? requested : `${requested}${extension}`
    return resolve(directory, name)
  }))
}

function digest(path: string): Promise<string> {
  return new Promise((resolveDigest, reject) => {
    const hash = createHash("sha256")
    const input = createReadStream(path)
    input.on("error", reject)
    input.on("data", (chunk) => hash.update(chunk))
    input.on("end", () => resolveDigest(hash.digest("hex")))
  })
}

function normalizeDigest(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined
  if (value.length > 80) throw new TypeError("Expected engine SHA-256 must contain exactly 64 hexadecimal characters")
  const normalized = value.trim().toLowerCase().replace(/^sha256:/u, "")
  if (!/^[0-9a-f]{64}$/u.test(normalized)) {
    throw new TypeError("Expected engine SHA-256 must contain exactly 64 hexadecimal characters")
  }
  return normalized
}

function samePath(left: string, right: string): boolean {
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right
}

function environmentValue(source: NodeJS.ProcessEnv, requestedName: string): string | undefined {
  const exact = source[requestedName]
  if (exact !== undefined) return exact
  const actualName = Object.keys(source).find((name) => name.toUpperCase() === requestedName.toUpperCase())
  return actualName ? source[actualName] : undefined
}
