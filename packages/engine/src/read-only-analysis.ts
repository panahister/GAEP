import { createHash, randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import {
  ANALYSIS_FAILURE_SUMMARIES,
  analysisRunRecordSchema,
  sanitizeProviderText,
  type AnalysisFailureCategory,
  type AnalysisRunEnvelope,
  type AnalysisRunRecord,
  type ProviderCatalogEntry,
  type SourceIdentity,
} from "@gaep/contracts"

import { assertNoWorkspaceMutation, ProductSourceMutationError, snapshotWorkspaceDigests } from "./source-guard.js"
import { resolveModelTruth } from "./provider-catalog.js"

/**
 * GAEP-P0-CS02 — the single, durable owner of read-only provider execution (INV-02/03/04/25/26).
 *
 * Run records persist under `.gaep/runs/**` and evidence under `.gaep/evidence/**`; both survive
 * an Engine Host restart. A running record + its pre-run Product digest snapshot are written
 * atomically BEFORE any provider process starts.
 */

export const CODEX_READ_BREADTH_LIMITATION =
  "Codex runs in a read-only sandbox rooted at the Product workspace and can read files beyond the declared Context Pack; it cannot write."

export interface ProviderRunOutcome {
  kind: "completed" | "failed" | "cancelled" | "timed-out"
  text?: string
  failureCategory?: AnalysisFailureCategory
}

export interface ProviderRunRequest {
  adapterId: string
  modelId: string
  objective: string
  contextText: string
  timeoutMs: number
  signal: AbortSignal
}

/**
 * A running provider execution. `completion` settles only AFTER the provider process has terminated;
 * `forceStop` kills the real process/supervisor and resolves once termination is confirmed. The
 * service never publishes a terminal record until one of these has resolved, so a provider can never
 * write to the workspace after its run is finalized (INV-05).
 */
export interface ProviderRunHandle {
  readonly completion: Promise<ProviderRunOutcome>
  forceStop(): Promise<void>
}

export type ProviderRunner = (request: ProviderRunRequest) => Promise<ProviderRunOutcome> | ProviderRunHandle

function isProviderRunHandle(value: Promise<ProviderRunOutcome> | ProviderRunHandle): value is ProviderRunHandle {
  return typeof (value as ProviderRunHandle).forceStop === "function"
}

/** Normalize a runner result to a handle. A bare promise gets a no-op forceStop (in-process runner). */
function normalizeProviderRun(value: Promise<ProviderRunOutcome> | ProviderRunHandle): ProviderRunHandle {
  return isProviderRunHandle(value) ? value : { completion: value, forceStop: async () => {} }
}

export interface StartAnalysisInput {
  adapterId: string
  modelId: string
  objective: string
  contextPackIds: string[]
  contextText: string
  timeoutMs: number
  idempotencyKey: string
  catalogEntry: ProviderCatalogEntry
  sourceIdentity: SourceIdentity
}

export class AnalysisError extends Error {
  constructor(readonly kind: string, message: string) {
    super(message)
    this.name = "AnalysisError"
  }
}

export const MAX_CONTEXT_BYTES = 262_144

function sha256(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`
}

interface PreRunEvidence {
  analysisRunId: string
  startedAt: string
  productDigests: Record<string, string>
}

export class ReadOnlyAnalysisService {
  private readonly runsDir: string
  private readonly evidenceDir: string
  private readonly runs = new Map<string, AnalysisRunRecord>()
  private readonly byIdempotencyKey = new Map<string, string>()
  private activeController: AbortController | undefined
  private activeRunId: string | undefined
  private activeTimer: ReturnType<typeof setTimeout> | undefined
  private activeInput: StartAnalysisInput | undefined
  private activeBaseline: Map<string, string> | undefined
  private activeHandle: ProviderRunHandle | undefined
  private cancelRequested = false
  private timeoutRequested = false

  constructor(
    private readonly workspacePath: string,
    private readonly runner: ProviderRunner,
    private readonly onAuthObservation?: (adapterId: string, observation: "auth-ready" | "auth-unavailable") => void,
    private readonly now: () => string = () => new Date().toISOString(),
    // Grace after an abort before the provider window is force-finalized (hard stop). Small in tests.
    private readonly hardStopGraceMs: number = 5_000,
  ) {
    this.runsDir = join(workspacePath, ".gaep", "runs")
    this.evidenceDir = join(workspacePath, ".gaep", "evidence")
    this.load()
  }

  /** Load persisted run records so state survives an Engine Host restart. */
  private load(): void {
    if (!existsSync(this.runsDir)) return
    for (const file of readdirSync(this.runsDir)) {
      if (!file.endsWith(".json")) continue
      try {
        const record = analysisRunRecordSchema.parse(JSON.parse(readFileSync(join(this.runsDir, file), "utf8")))
        this.runs.set(record.analysisRunId, record)
        this.byIdempotencyKey.set(record.envelope.idempotencyKey, record.analysisRunId)
      } catch { /* skip an unreadable/invalid record */ }
    }
  }

  private writeJsonAtomic(dir: string, name: string, value: unknown): void {
    mkdirSync(dir, { recursive: true })
    const target = join(dir, name)
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`
    writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8")
    renameSync(temp, target)
  }

  private persistRun(record: AnalysisRunRecord): void {
    this.writeJsonAtomic(this.runsDir, `${record.analysisRunId}.json`, record)
  }

  async start(input: StartAnalysisInput): Promise<AnalysisRunRecord> {
    const existingId = this.byIdempotencyKey.get(input.idempotencyKey)
    if (existingId) {
      const existing = this.runs.get(existingId)
      if (existing) return existing
    }
    if (this.activeRunId && this.runs.get(this.activeRunId)?.state === "running") {
      throw new AnalysisError("ANALYSIS_ALREADY_RUNNING", "An analysis is already running for this Product root")
    }
    if (!input.catalogEntry.detected) {
      throw new AnalysisError("PROVIDER_UNAVAILABLE", "The selected provider is not available")
    }
    const contextBytes = Buffer.byteLength(input.contextText, "utf8")
    if (contextBytes > MAX_CONTEXT_BYTES) {
      throw new AnalysisError("CONTEXT_TOO_LARGE", "The bounded analysis context exceeds its maximum size")
    }

    const truth = resolveModelTruth(input.catalogEntry, input.modelId)
    const startedAt = this.now()
    const analysisRunId = randomUUID()
    const envelope: AnalysisRunEnvelope = {
      schemaVersion: 1,
      scope: "read-only-analysis",
      authority: "user-initiated",
      adapterId: input.adapterId,
      modelId: input.modelId,
      modelTruthClass: truth.truthClass,
      modelAlias: truth.alias,
      capabilityDigest: input.catalogEntry.capabilityDigest,
      contextPackIds: input.contextPackIds,
      contextPackDigest: sha256(input.contextText),
      contextBytes,
      sourceIdentity: input.sourceIdentity,
      objectiveDigest: sha256(input.objective),
      timeoutMs: input.timeoutMs,
      idempotencyKey: input.idempotencyKey,
      startedAt,
    }
    const record = analysisRunRecordSchema.parse({
      schemaVersion: 1,
      analysisRunId,
      state: "running",
      envelope,
      startedAt,
      ...(input.adapterId.includes("codex") ? { knownLimitation: CODEX_READ_BREADTH_LIMITATION } : {}),
    })

    // Persist the running record + pre-run evidence ATOMICALLY before any process starts.
    this.persistRun(record)
    // Snapshot the ENTIRE workspace AFTER GAEP's own pre-run writes and immediately before spawn,
    // so any change during the provider window is attributable to the provider process (INV-05).
    const before = await snapshotWorkspaceDigests(this.workspacePath)
    const preRun: PreRunEvidence = { analysisRunId, startedAt, productDigests: Object.fromEntries(before) }
    this.writeJsonAtomic(this.evidenceDir, `${analysisRunId}.pre-run.json`, preRun)
    // Re-snapshot to include the pre-run evidence file GAEP just wrote (a GAEP-owned write).
    const providerBaseline = await snapshotWorkspaceDigests(this.workspacePath)
    this.runs.set(analysisRunId, record)
    this.byIdempotencyKey.set(input.idempotencyKey, analysisRunId)

    const controller = new AbortController()
    this.activeController = controller
    this.activeRunId = analysisRunId
    this.activeInput = input
    this.activeBaseline = providerBaseline
    this.cancelRequested = false
    this.timeoutRequested = false
    // Start the provider and keep its handle so cancel/timeout can force-stop the real process.
    let handle: ProviderRunHandle
    try {
      handle = normalizeProviderRun(this.runner({
        adapterId: input.adapterId,
        modelId: input.modelId,
        objective: input.objective,
        contextText: input.contextText,
        timeoutMs: input.timeoutMs,
        signal: controller.signal,
      }))
    } catch {
      handle = { completion: Promise.resolve({ kind: "failed", failureCategory: "internal" }), forceStop: async () => {} }
    }
    this.activeHandle = handle

    // Timeout at the service boundary (INV-25). The timer requests graceful cancellation (abort) and,
    // if the provider ignores it, force-stops the real process after the hard-stop grace. It never
    // finalizes directly: finalization always waits for confirmed termination (INV-05).
    this.activeTimer = setTimeout(() => {
      this.timeoutRequested = true
      controller.abort()
      void this.forceStopAndFinalize(analysisRunId, { kind: "timed-out" })
    }, input.timeoutMs)
    if (typeof this.activeTimer.unref === "function") this.activeTimer.unref()

    void this.execute(analysisRunId, input, providerBaseline, handle)
    return record
  }

  private async execute(
    analysisRunId: string,
    input: StartAnalysisInput,
    before: Map<string, string>,
    handle: ProviderRunHandle,
  ): Promise<void> {
    let outcome: ProviderRunOutcome
    try {
      // `completion` resolves only after the provider process has terminated.
      outcome = await handle.completion
    } catch {
      outcome = { kind: "failed", failureCategory: "internal" }
    }
    await this.finalizeAfterProvider(analysisRunId, input, before, outcome)
  }

  /**
   * Force-stop path for cancel/timeout: after the hard-stop grace, kill the real provider process and
   * WAIT for termination confirmation (forceStop resolves) before taking the post-provider snapshot
   * and publishing the terminal record. No terminal record is ever published while the provider could
   * still write, and a late mutation still wins as `source-mutation`.
   */
  private async forceStopAndFinalize(analysisRunId: string, outcome: ProviderRunOutcome): Promise<void> {
    const handle = this.activeHandle
    const input = this.activeInput
    const baseline = this.activeBaseline
    if (!handle || !input || !baseline) return
    // Give the provider the grace window to honor the graceful abort and terminate on its own.
    const graceExpired = await Promise.race([
      handle.completion.then(() => false, () => false),
      new Promise<boolean>((resolve) => { const t = setTimeout(() => resolve(true), this.hardStopGraceMs); if (typeof t.unref === "function") t.unref() }),
    ])
    if (this.runs.get(analysisRunId)?.state !== "running") return
    // If the provider ignored the abort past the grace, force-kill it. The engine's real handle
    // implements `forceStop` to WAIT for `completion` to settle (confirmed termination) before it
    // resolves, so awaiting forceStop is an explicit wait for confirmed completion — no provider
    // process or initialization continuation can start/write after the terminal record. If the grace
    // did NOT expire, `completion` already settled on its own (that is why the grace did not fire).
    if (graceExpired) {
      try { await handle.forceStop() } catch { /* best effort; termination is confirmed by forceStop */ }
    }
    await this.finalizeAfterProvider(analysisRunId, input, baseline, outcome)
  }

  /**
   * Finalize a run only AFTER the provider process has terminated. The complete post-provider
   * workspace snapshot and mutation check run here — before any terminal record is persisted — so a
   * provider that keeps writing after receiving cancel/timeout is still caught and fails closed as
   * `source-mutation` (INV-05). Cancel/timeout are resolved here, never inline in the abort handler,
   * which closes the window where a terminal record could be published while the provider still ran.
   */
  private async finalizeAfterProvider(
    analysisRunId: string,
    input: StartAnalysisInput,
    before: Map<string, string>,
    outcome: ProviderRunOutcome,
  ): Promise<void> {
    if (this.runs.get(analysisRunId)?.state !== "running") return // already terminal (orphan reconcile)

    let mutated = false
    try {
      // The provider must not change ANY workspace path during its window: Product source or an
      // unauthorized `.gaep/**` write. GAEP's governed writes occur outside this window.
      assertNoWorkspaceMutation(before, await snapshotWorkspaceDigests(this.workspacePath))
    } catch (error) {
      if (error instanceof ProductSourceMutationError) mutated = true
    }

    // A detected mutation fails closed regardless of why the provider stopped; then timeout, then
    // an explicit cancel request; otherwise the provider's own terminal outcome.
    let terminal: ProviderRunOutcome
    if (mutated) terminal = { kind: "failed", failureCategory: "source-mutation" }
    else if (this.timeoutRequested) terminal = { kind: "timed-out" }
    else if (this.cancelRequested) terminal = { kind: "cancelled" }
    else terminal = outcome

    if (terminal.kind === "completed" && input.catalogEntry.detected) {
      this.onAuthObservation?.(input.adapterId, "auth-ready")
    } else if (terminal.failureCategory === "auth-unavailable") {
      this.onAuthObservation?.(input.adapterId, "auth-unavailable")
    }
    this.finalize(analysisRunId, terminal)
  }

  /** Apply the first terminal transition; terminal records are immutable and persisted (INV-26). */
  private finalize(analysisRunId: string, outcome: ProviderRunOutcome): void {
    const current = this.runs.get(analysisRunId)
    if (!current || current.state !== "running") return

    const endedAt = this.now()
    const base = { ...current, endedAt }
    let next: AnalysisRunRecord
    if (outcome.kind === "completed") {
      const result = sanitizeProviderText(outcome.text ?? "")
      next = analysisRunRecordSchema.parse({ ...base, state: "completed", terminationCause: "normal", result })
      this.writeJsonAtomic(this.evidenceDir, `${analysisRunId}.result.json`, result)
    } else if (outcome.kind === "cancelled") {
      next = analysisRunRecordSchema.parse({ ...base, state: "cancelled", terminationCause: "cancel-request", failureCategory: "cancelled", failureSummary: ANALYSIS_FAILURE_SUMMARIES.cancelled })
    } else if (outcome.kind === "timed-out") {
      next = analysisRunRecordSchema.parse({ ...base, state: "timed-out", terminationCause: "timeout", failureCategory: "timeout", failureSummary: ANALYSIS_FAILURE_SUMMARIES.timeout })
    } else {
      const category = outcome.failureCategory ?? "provider-error"
      next = analysisRunRecordSchema.parse({ ...base, state: "failed", terminationCause: category === "timeout" ? "timeout" : "provider-failure", failureCategory: category, failureSummary: ANALYSIS_FAILURE_SUMMARIES[category] })
    }
    this.runs.set(analysisRunId, next)
    this.persistRun(next)
    if (this.activeRunId === analysisRunId) {
      if (this.activeTimer) clearTimeout(this.activeTimer)
      this.activeTimer = undefined
      this.activeController = undefined
      this.activeRunId = undefined
      this.activeInput = undefined
      this.activeBaseline = undefined
      this.activeHandle = undefined
    }
  }

  read(analysisRunId: string): AnalysisRunRecord {
    const record = this.runs.get(analysisRunId)
    if (!record) throw new AnalysisError("ANALYSIS_NOT_FOUND", "No analysis run exists for the requested identifier")
    return record
  }

  list(limit = 20): AnalysisRunRecord[] {
    return [...this.runs.values()].sort((left, right) => (left.startedAt < right.startedAt ? 1 : -1)).slice(0, limit)
  }

  latest(): AnalysisRunRecord | undefined {
    return this.list(1)[0]
  }

  /**
   * Request cancellation: abort the provider, await its termination (or hard-stop after the grace),
   * take the post-provider snapshot, and only THEN publish the terminal record. No provider process
   * remains alive after a terminal record is published, and a post-abort mutation still fails closed
   * as `source-mutation` rather than `cancelled` (INV-05).
   */
  async cancel(analysisRunId: string): Promise<AnalysisRunRecord> {
    const record = this.read(analysisRunId)
    if (record.state !== "running") return record
    if (this.activeRunId !== analysisRunId) return record
    this.cancelRequested = true
    // Request graceful cancellation first; the force-stop path kills the real provider after the
    // grace and only then finalizes, so the terminal record follows confirmed termination (INV-05).
    this.activeController?.abort()
    await this.forceStopAndFinalize(analysisRunId, { kind: "cancelled" })
    return this.read(analysisRunId)
  }

  /** Reconcile persisted orphaned `running` records after an Engine Host restart (INV-26). */
  reconcileOrphans(): void {
    for (const [id, record] of this.runs) {
      if (record.state !== "running") continue
      const reconciled = analysisRunRecordSchema.parse({
        ...record,
        state: "failed",
        endedAt: this.now(),
        terminationCause: "process-loss",
        failureCategory: "internal",
        failureSummary: ANALYSIS_FAILURE_SUMMARIES.internal,
      })
      this.runs.set(id, reconciled)
      this.persistRun(reconciled)
    }
    if (this.activeTimer) clearTimeout(this.activeTimer)
    this.activeController = undefined
    this.activeRunId = undefined
    this.activeTimer = undefined
  }
}
