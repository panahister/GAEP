import { randomUUID } from "node:crypto"

import {
  adapterCapabilitiesSchema,
  agentSelectionSchema,
  executionCharterSchema,
  initiativeSchema,
  managedEvidenceEventSchema,
  managedRunEvidenceSchema,
  managedRunRecordSchema,
  managedRunResultSchema,
  productSchema,
  runSchema,
  runToolSelectionSchema,
  workflowPlanSchema,
  type ContextPack,
  type ExecutionCharter,
  type ManagedEvidenceEvent,
  type ManagedExecutionMode,
  type ManagedRunBindings,
  type ManagedRunEvidence,
  type ManagedRunRecord,
  type ManagedRunResult,
  type ManagedRunState,
  type Initiative,
  type Run,
  type RunToolSelection,
  type ToolDefinition,
  type WorkflowPlan,
} from "@gaep/contracts"
import {
  BoundedAsyncQueue,
  DeterministicManualAdapter,
  ManagedStageRegistry,
  WorkspaceStagingService,
  canonicalDigest,
  capabilityDigest,
  startManagedClaudeContextRun,
  startManagedCodexStagedRun,
  type AdapterProbeResult,
  type AdapterRuntimeBinding,
  type AgentAdapter,
  type ManagedCodexPostconditionEvaluator,
  type ManagedCodexStageReview,
  type ManagedRuntimeEvent,
  type ManagedRuntimeResultEnvelope,
  type ManagedStagingEvidence,
  type ManagedTerminalDisposition,
} from "@gaep/agent-sdk"

import type { ProductStudioService } from "./product-studio.js"
import type { GaepRepository } from "./repository.js"

export const managedRunTransitions = {
  prepared: ["running", "failed", "cancelled"],
  running: ["review-required", "completed", "failed", "cancelled", "timed-out", "unknown"],
  "review-required": ["applying", "discarded", "unknown"],
  applying: ["completed", "failed", "unknown", "conflict"],
  completed: [],
  failed: [],
  cancelled: [],
  "timed-out": [],
  unknown: [],
  conflict: ["discarded"],
  discarded: [],
} as const satisfies Record<ManagedRunState, readonly ManagedRunState[]>

export interface ManagedExecutionStartInput {
  runId: string
  workflowPlanId: string
  runToolSelectionId?: string
  timeoutMs?: number
  previousManagedRunId?: string
}

export interface ManagedExecutionApplyInput {
  authorizationId: string
  approvedPaths: string[]
  evaluatePostconditions?: ManagedCodexPostconditionEvaluator
}

export interface ManagedExecutionReview {
  readonly record: ManagedRunRecord
  readonly result: ManagedRunResult
  readonly evidence: ManagedRunEvidence
  readonly canApply: boolean
  readonly hasLocalJournal: boolean
  apply(input: ManagedExecutionApplyInput): Promise<ManagedExecutionReview>
  discard(): Promise<ManagedExecutionReview>
  disposeLocalJournal(): Promise<void>
}

export interface ManagedExecutionHandle {
  readonly record: ManagedRunRecord
  readonly events: AsyncIterable<ManagedEvidenceEvent>
  readonly completion: Promise<ManagedExecutionReview>
  cancel(reason?: string): Promise<void>
}

/**
 * The Founder runtime compiles only two explicit Codex app-server controls.
 * Arbitrary Tool Definitions are never implied to exist merely because they
 * were selected in Product Studio.
 */
export function compileManagedCodexPolicy(
  charter: ExecutionCharter,
  tools: readonly ToolDefinition[],
): { allowCommands: boolean; allowFileChanges: boolean } {
  let shellSelected = false
  let workspaceWriteSelected = false
  for (const tool of tools) {
    if (tool.binding.adapterId !== "gaep.codex-cli") {
      throw new Error(`Managed Codex cannot enforce Tool ${tool.key}; its adapter binding is not gaep.codex-cli`)
    }
    if (tool.definitionType === "tool" && tool.binding.toolName === "shell") {
      shellSelected = true
      continue
    }
    if (tool.definitionType === "capability" && tool.binding.toolName === "workspace-write") {
      workspaceWriteSelected = true
      continue
    }
    throw new Error(`Managed Codex cannot enforce selected Tool ${tool.key}; only intrinsic shell and workspace-write controls are supported`)
  }
  const allowed = charter.permissions.filter((permission) => permission.mode === "allow")
  const capability = (pattern: RegExp): boolean => allowed.some((permission) => pattern.test(permission.capability))
  return {
    allowCommands: shellSelected && capability(/(?:command|shell|process|terminal|execute)/iu),
    allowFileChanges: workspaceWriteSelected &&
      charter.expectedEffects.some((effect) => effect === "provisional" || effect === "reversible-change") &&
      capability(/(?:file|workspace|write|edit|change|modify)/iu),
  }
}

interface ResolvedExecution {
  run: Run
  initiative: Initiative
  charter: ExecutionCharter
  workflowPlan: WorkflowPlan
  contextPacks: ContextPack[]
  toolSelection?: RunToolSelection
  tools: ToolDefinition[]
  bindings: ManagedRunBindings
  mode: ManagedExecutionMode
  adapter: AgentAdapter
  probe: AdapterProbeResult
  localPrompt: string
  localContext: string
}

interface RuntimeCompletion {
  runtime: ManagedRuntimeResultEnvelope
  codexReview?: ManagedCodexStageReview
  stagingService?: WorkspaceStagingService
  terminationCause: ManagedRunResult["terminationCause"]
}

interface RuntimeHandle {
  events: AsyncIterable<ManagedRuntimeEvent>
  completion: Promise<RuntimeCompletion>
  cancel(reason?: string): Promise<void>
}

interface PersistedArtifacts {
  record: ManagedRunRecord
  result: ManagedRunResult
  evidence: ManagedRunEvidence
}

interface ResumeSource {
  mode: ManagedExecutionMode
  providerThreadId: string
  runId: string
}

interface JournalBinding {
  stagingService: WorkspaceStagingService
  path: string
  digest: `sha256:${string}`
  disposed: boolean
}

const managedTerminalStates = new Set<ManagedRunState>([
  "completed", "failed", "cancelled", "timed-out", "unknown", "conflict", "discarded",
])

function revisionOf(value: { revision?: number }): number {
  return value.revision ?? 1
}

function assertTransition(current: ManagedRunState, next: ManagedRunState): void {
  if (!(managedRunTransitions[current] as readonly ManagedRunState[]).includes(next)) {
    throw new Error(`Invalid Managed Run transition from ${current} to ${next}`)
  }
}

function ref(value: { id: string; revision?: number }, recordType: ManagedRunBindings["product"]["recordType"]): ManagedRunBindings["product"] {
  return {
    recordType,
    recordId: value.id,
    revision: revisionOf(value),
    digest: canonicalDigest(value),
  }
}

function providerRef(value: string | undefined, kind: "thread" | "turn"): `sha256:${string}` | undefined {
  if (!value) return undefined
  return canonicalDigest({ kind: `provider-${kind}`, value }) as `sha256:${string}`
}

function safeEventCode(value: string | undefined): string {
  if (!value) return "provider-error"
  const normalized = value.trim().toLocaleLowerCase().replace(/[^a-z0-9.-]+/gu, "-").replace(/^-+|-+$/gu, "")
  return /^[a-z][a-z0-9.-]{0,127}$/.test(normalized) ? normalized : "provider-error"
}

function safeItemType(value: string): string {
  return safeEventCode(value) === "provider-error" ? "provider-item" : safeEventCode(value)
}

function redactedDigest(value: string): { digest: `sha256:${string}`; bytes: number; redactions: number } {
  let redactions = 0
  let text = Buffer.from(value).subarray(0, 16 * 1024 * 1024).toString("utf8")
  const patterns = [
    /\b(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/giu,
    /\b(?:api[_-]?key|token|secret|password|authorization)\s*[:=]\s*[^\s,;]+/giu,
    /\b(?:sk|rk|pk)-[A-Za-z0-9_-]{12,}\b/gu,
    /(?:^|[\s"'(])(?:\/[A-Za-z0-9._ -]+){2,}/gu,
    /\b[A-Za-z]:\\(?:[^\s<>:"|?*]+\\)+[^\s<>:"|?*]*/gu,
    /https?:\/\/[^\s/@]+:[^\s/@]+@[^\s]+/giu,
  ]
  for (const pattern of patterns) {
    text = text.replace(pattern, (match) => {
      redactions += 1
      return match.startsWith(" ") ? " [REDACTED]" : "[REDACTED]"
    })
  }
  return {
    digest: canonicalDigest({ redactedText: text }) as `sha256:${string}`,
    bytes: Buffer.byteLength(text),
    redactions,
  }
}

export function normalizeManagedRuntimeEvents(events: readonly ManagedRuntimeEvent[]): ManagedEvidenceEvent[] {
  return events.slice(0, 4_096).map((event, sequence) => {
    const base = {
      sequence,
      observedAt: Number.isFinite(Date.parse(event.observedAt)) ? event.observedAt : new Date(0).toISOString(),
      providerThreadRef: providerRef(event.threadId, "thread"),
      providerTurnRef: providerRef(event.turnId, "turn"),
    }
    if (event.type === "lifecycle") {
      return managedEvidenceEventSchema.parse({
        ...base,
        type: "lifecycle",
        phase: event.phase,
        turnStatus: event.turnStatus,
      })
    }
    if (event.type === "output-delta") {
      const content = redactedDigest(event.text)
      return managedEvidenceEventSchema.parse({
        ...base,
        type: "output",
        channel: event.channel,
        contentDigest: content.digest,
        byteLength: content.bytes,
        redactionCount: content.redactions,
      })
    }
    if (event.type === "item") {
      return managedEvidenceEventSchema.parse({
        ...base,
        type: "item",
        itemRef: canonicalDigest({ itemId: event.itemId }),
        itemType: safeItemType(event.itemType),
        status: event.status,
      })
    }
    if (event.type === "approval") {
      return managedEvidenceEventSchema.parse({
        ...base,
        type: "approval",
        requestRef: canonicalDigest({ requestId: event.requestId }),
        approvalKind: event.approvalKind,
        outcome: event.outcome,
        authorizationRef: event.authorizationId
          ? canonicalDigest({ authorizationId: event.authorizationId })
          : undefined,
      })
    }
    if (event.type === "warning") {
      return managedEvidenceEventSchema.parse({
        ...base,
        type: "warning",
        code: "provider-warning-redacted",
        contentDigest: redactedDigest(event.message).digest,
      })
    }
    return managedEvidenceEventSchema.parse({
      ...base,
      type: "error",
      code: safeEventCode(event.code),
      retryable: event.retryable,
      contentDigest: redactedDigest(event.message).digest,
    })
  })
}

function terminalState(
  disposition: ManagedTerminalDisposition,
  cause: ManagedRunResult["terminationCause"],
  outcome: ManagedRunResult["outcome"]["status"],
  reviewRequired: boolean,
): ManagedRunResult["terminalState"] {
  if (cause === "timeout") return "timed-out"
  if (cause === "cancel-request" || disposition === "cancelled") return "cancelled"
  if (["failed", "crashed", "protocol-error"].includes(disposition)) return "failed"
  if (disposition !== "completed") return "unknown"
  if (reviewRequired) return "review-required"
  if (outcome === "satisfied") return "completed"
  if (outcome === "failed") return "failed"
  return "unknown"
}

function legacyState(state: ManagedRunState): Run["state"] | undefined {
  if (state === "completed") return "completed"
  if (state === "failed") return "failed"
  if (state === "cancelled" || state === "timed-out" || state === "discarded") return "cancelled"
  if (state === "unknown" || state === "conflict") return "unknown"
  return undefined
}

function managedStagingEvidence(
  source: ManagedStagingEvidence,
  applyState: "pending" | "applied" | "conflict" | "discarded" | "not-applied",
): NonNullable<ManagedRunEvidence["staging"]> {
  return {
    baselineDigest: source.baselineDigest,
    finalDigest: source.finalDigest,
    changes: source.changes.map((change) => ({ ...change })),
    excludedPathCount: source.excludedPaths.length,
    excludedPathSetDigest: canonicalDigest([...source.excludedPaths].sort()),
    applyState,
    applyJournalDigest: source.applyJournalDigest,
  }
}

function uniqueWarnings(
  runtime: ManagedRuntimeResultEnvelope,
  events: readonly ManagedEvidenceEvent[],
  mode: ManagedExecutionMode,
): ManagedRunResult["warnings"] {
  const warnings = new Set<ManagedRunResult["warnings"][number]>()
  if (runtime.portable.warnings.length > 0) warnings.add("runtime-warning")
  if (runtime.portable.events.length > 4_096) warnings.add("runtime-output-truncated")
  if (runtime.portable.events.some((event) => event.type === "output-delta" && Buffer.byteLength(event.text) > 16 * 1024 * 1024)) {
    warnings.add("runtime-output-truncated")
  }
  if (events.some((event) => event.type === "warning")) warnings.add("provider-warning-redacted")
  if (events.some((event) => event.type === "output" && event.redactionCount > 0)) warnings.add("provider-output-redacted")
  if (events.some((event) => event.type === "error" && event.code.includes("coordinator"))) warnings.add("coordinator-failure")
  if (mode === "codex-staged") warnings.add("staging-read-confinement-unattested")
  return [...warnings]
}

export class ManagedExecutionService {
  private readonly active = new Map<string, RuntimeHandle>()
  private readonly resumeSources = new Map<string, ResumeSource>()
  private readonly journals = new Map<string, JournalBinding>()
  private readonly stageRegistry = new ManagedStageRegistry()

  constructor(
    private readonly workspacePath: string,
    private readonly repository: GaepRepository,
    private readonly productStudio: ProductStudioService,
    private readonly adapters: Map<string, AgentAdapter>,
  ) {}

  async list(): Promise<ManagedRunRecord[]> {
    let names: string[]
    try {
      names = (await this.repository.readDirectory(this.repository.resolve("sessions")))
        .filter((name) => /^managed-run-[0-9a-f-]+\.json$/i.test(name))
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return []
      throw error
    }
    const records = await Promise.all(names.map((name) =>
      this.repository.readJson(this.repository.resolve("sessions", name), managedRunRecordSchema),
    ))
    return records.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async read(id: string): Promise<ManagedRunRecord> {
    const managedRunId = managedRunRecordSchema.shape.id.parse(id)
    return this.repository.readJson(this.managedRunPath(managedRunId), managedRunRecordSchema)
  }

  async readResult(id: string): Promise<ManagedRunResult> {
    const resultId = managedRunResultSchema.shape.id.parse(id)
    return this.repository.readJson(this.resultPath(resultId), managedRunResultSchema)
  }

  async readEvidence(id: string): Promise<ManagedRunEvidence> {
    const evidenceId = managedRunEvidenceSchema.shape.id.parse(id)
    return this.repository.readJson(this.evidencePath(evidenceId), managedRunEvidenceSchema)
  }

  async start(input: ManagedExecutionStartInput, actorId: string): Promise<ManagedExecutionHandle> {
    const resolved = await this.resolve(input)
    const now = new Date().toISOString()
    const managedRun = managedRunRecordSchema.parse({
      schemaVersion: 1,
      kind: "managed-run",
      id: randomUUID(),
      revision: 1,
      runId: resolved.run.id,
      productId: resolved.run.productId,
      initiativeId: resolved.run.initiativeId,
      mode: resolved.mode,
      state: "prepared",
      bindings: resolved.bindings,
      bindingsDigest: canonicalDigest(resolved.bindings),
      bindingSnapshots: {
        initiative: resolved.initiative,
        run: resolved.run,
      },
      provider: {
        adapterId: resolved.run.agent.adapterId,
        agentId: resolved.run.agent.agentId,
        modelId: resolved.run.agent.modelId,
        capabilityDigest: resolved.run.agent.capabilityDigest,
        runtimeVersion: resolved.probe.capabilities.runtimeVersion,
      },
      previousManagedRunId: input.previousManagedRunId,
      recovery: { status: "not-required" },
      createdAt: now,
      updatedAt: now,
    })

    await this.persistPrepared(managedRun, resolved, actorId)
    const running = await this.transitionToRunning(managedRun, resolved.run, actorId)

    let runtime: RuntimeHandle
    try {
      runtime = await this.launch(resolved, input, managedRun.id)
    } catch (error) {
      await this.persistLaunchFailure(running, resolved, actorId)
      throw error
    }
    this.active.set(managedRun.id, runtime)
    const liveEvents = new BoundedAsyncQueue<ManagedEvidenceEvent>(4_096, 16 * 1024 * 1024)
    const drain = (async (): Promise<void> => {
      let sequence = 0
      try {
        for await (const event of runtime.events) {
          const normalized = normalizeManagedRuntimeEvents([event])[0]!
          liveEvents.push(managedEvidenceEventSchema.parse({ ...normalized, sequence: sequence++ }))
        }
        liveEvents.close()
      } catch (error) {
        liveEvents.fail(error instanceof Error ? error : new Error("Managed event stream failed"))
      }
    })()

    const completion = (async (): Promise<ManagedExecutionReview> => {
      try {
        const completed = await runtime.completion
        await drain.catch(() => undefined)
        const initialState = terminalState(
          completed.runtime.portable.terminalDisposition,
          completed.terminationCause,
          completed.runtime.portable.postconditionStatus,
          completed.codexReview !== undefined && completed.runtime.portable.terminalDisposition === "completed",
        )
        const persisted = await this.persistRuntimeResult(
          running,
          resolved,
          completed.runtime,
          initialState,
          completed.terminationCause,
          completed.codexReview ? "pending" : undefined,
          completed.runtime.portable.postconditionStatus === "satisfied"
            ? "deterministic-offline-runtime"
            : completed.runtime.portable.terminalDisposition === "completed"
              ? "not-evaluated"
              : "provider-failure",
          actorId,
        )
        const providerThreadId = completed.runtime.portable.providerThreadId
        if (providerThreadId && resolved.probe.capabilities.supportsResume) {
          this.resumeSources.set(managedRun.id, { mode: resolved.mode, providerThreadId, runId: managedRun.runId })
        }
        return new ManagedExecutionReviewHandle(
          this,
          persisted,
          resolved,
          completed,
          actorId,
        )
      } catch (error) {
        await this.persistRuntimeFailure(running, resolved, actorId).catch(() => undefined)
        throw error
      } finally {
        this.active.delete(managedRun.id)
      }
    })()

    return {
      record: running,
      events: liveEvents,
      completion,
      cancel: async (reason?: string): Promise<void> => runtime.cancel(reason),
    }
  }

  async cancel(managedRunId: string, reason?: string): Promise<void> {
    const active = this.active.get(managedRunId)
    if (!active) throw new Error("Managed Run has no active process in this engine instance")
    await active.cancel(reason)
  }

  async recoverInterrupted(actorId: string): Promise<ManagedRunRecord[]> {
    const interrupted = (await this.list()).filter((record) =>
      ["running", "review-required", "applying"].includes(record.state) && !this.active.has(record.id),
    )
    const recovered: ManagedRunRecord[] = []
    for (const record of interrupted) {
      const now = new Date().toISOString()
      let localRecoveryWarning: ManagedRunResult["warnings"][number] | undefined
      let localRecoveryStatus: "cleaned" | "quarantined" | "failed" = "cleaned"
      try {
        const localRecovery = await this.stageRegistry.recover(record.id)
        if (localRecovery.status === "quarantined") {
          localRecoveryStatus = "quarantined"
          localRecoveryWarning = "local-cleanup-pending"
        }
      } catch {
        localRecoveryStatus = "failed"
        localRecoveryWarning = "local-cleanup-failed"
      }
      const evidence = managedRunEvidenceSchema.parse({
        schemaVersion: 1,
        kind: "managed-run-evidence",
        id: randomUUID(),
        managedRunId: record.id,
        runId: record.runId,
        productId: record.productId,
        bindingsDigest: record.bindingsDigest,
        events: [],
        eventsDigest: canonicalDigest([]),
        actualEffects: [],
        capturedAt: now,
        authorityBoundary: "evidence-does-not-self-assert-outcome-or-authorization",
      })
      const result = managedRunResultSchema.parse({
        schemaVersion: 1,
        kind: "managed-run-result",
        id: randomUUID(),
        managedRunId: record.id,
        runId: record.runId,
        productId: record.productId,
        mode: record.mode,
        provider: record.provider,
        providerDisposition: "unknown",
        terminationCause: "process-loss",
        outcome: { status: "indeterminate", basis: "not-evaluated" },
        terminalState: "unknown",
        evidenceId: evidence.id,
        evidenceDigest: canonicalDigest(evidence),
        warnings: localRecoveryWarning ? [localRecoveryWarning] : [],
        startedAt: record.startedAt ?? record.updatedAt,
        endedAt: now,
        authorityBoundary: "provider-completion-does-not-equal-outcome-completion",
      })
      const next = managedRunRecordSchema.parse({
        ...record,
        revision: record.revision + 1,
        state: "unknown",
        resultId: result.id,
        resultDigest: canonicalDigest(result),
        recovery: {
          status: "resume-unavailable",
          reasonCode: localRecoveryStatus === "quarantined"
            ? "local-apply-journal-quarantined"
            : localRecoveryStatus === "failed"
              ? "local-stage-recovery-failed"
              : "machine-local-runtime-lost",
        },
        updatedAt: now,
        endedAt: now,
      })
      await this.repository.withLock(async () => {
        const current = await this.repository.readJson(this.managedRunPath(record.id), managedRunRecordSchema)
        if (current.revision !== record.revision || current.state !== record.state) {
          throw new Error("Managed Run changed during recovery")
        }
        const run = await this.repository.readJson(this.runPath(record.runId), runSchema)
        const recoveredRun = run.state === "running"
          ? runSchema.parse({
              ...run,
              revision: revisionOf(run) + 1,
              state: "unknown",
              endedAt: now,
            })
          : run
        await this.repository.commitMutation({
          writes: [
            { path: this.evidencePath(evidence.id), value: evidence, schema: managedRunEvidenceSchema, governed: true },
            { path: this.resultPath(result.id), value: result, schema: managedRunResultSchema, governed: true },
            { path: this.managedRunPath(next.id), value: next, schema: managedRunRecordSchema, governed: true },
            ...(recoveredRun === run ? [] : [{ path: this.runPath(run.id), value: recoveredRun, schema: runSchema, governed: true }]),
          ],
          audit: {
            eventType: "managed-run.recovered-unknown",
            actor: { kind: "system", id: actorId },
            subjectId: next.id,
            payload: {
              from: record.state,
              to: "unknown",
              resultDigest: canonicalDigest(result),
              evidenceDigest: canonicalDigest(evidence),
              machineLocalDataPersisted: false,
            },
          },
        })
      })
      recovered.push(next)
    }
    return recovered
  }

  private async resolve(input: ManagedExecutionStartInput): Promise<ResolvedExecution> {
    const runId = runSchema.shape.id.parse(input.runId)
    const workflowPlanId = workflowPlanSchema.shape.id.parse(input.workflowPlanId)
    const run = await this.repository.readJson(this.runPath(runId), runSchema)
    if (input.previousManagedRunId) {
      const previous = await this.read(input.previousManagedRunId)
      const resume = this.resumeSources.get(previous.id)
      if (previous.runId !== run.id || previous.state !== "unknown") {
        throw new Error("Managed resume requires an unknown prior Managed Run for the same Run")
      }
      if (!resume || resume.runId !== run.id) {
        throw new Error("Managed resume is unavailable because its machine-local provider binding was not retained")
      }
      if (run.state !== "unknown") throw new Error("Managed resume requires the underlying Run to be unknown")
    } else if (run.state !== "prepared") {
      throw new Error(`Managed execution requires a prepared Run; current state is ${run.state}`)
    }
    if ((await this.list()).some((candidate) =>
      candidate.runId === run.id && !managedTerminalStates.has(candidate.state))) {
      throw new Error("The Run already has a non-terminal Managed Run")
    }
    const charter = await this.repository.readJson(
      this.repository.resolve("sessions", `charter-${run.charterId}.json`),
      executionCharterSchema,
    )
    if (!charter.confirmedAt || run.charterDigest !== canonicalDigest(charter)) {
      throw new Error("Managed execution requires the exact confirmed Charter bound by the Run")
    }
    if (!charter.managedIntent) {
      throw new Error("Managed execution requires exact managed intent in the confirmed Charter")
    }
    if (charter.managedIntent.workflowPlan.recordId !== workflowPlanId) {
      throw new Error("Workflow Plan substitution is forbidden after managed Charter confirmation")
    }
    const [product, initiative, workflowPlan] = await Promise.all([
      this.repository.readJson(this.repository.resolve("product.json"), productSchema),
      this.repository.readJson(this.repository.resolve("initiatives", `${run.initiativeId}.json`), initiativeSchema),
      this.productStudio.readWorkflowPlan(workflowPlanId),
    ])
    if (product.id !== run.productId || initiative.id !== run.initiativeId || initiative.productId !== product.id) {
      throw new Error("Managed Run Product or Initiative identity is inconsistent")
    }
    if (charter.productDigest !== canonicalDigest(product) || charter.initiativeDigest !== canonicalDigest(initiative)) {
      throw new Error("Product or Initiative changed after Charter confirmation")
    }
    if (charter.selectionDigest !== canonicalDigest(run.agent)) {
      throw new Error("Managed Run Agent Selection no longer matches the Charter")
    }
    const persistedSelection = await this.repository.readJson(
      this.repository.resolve("runtime", "selection.json"),
      agentSelectionSchema,
    )
    if (canonicalDigest(persistedSelection) !== charter.selectionDigest) {
      throw new Error("The selected Agent changed after Charter confirmation")
    }
    if (workflowPlan.productId !== product.id || workflowPlan.state !== "resolved") {
      throw new Error("Managed execution requires a resolved Workflow Plan for this Product")
    }
    this.assertExactReference(charter.managedIntent.workflowPlan, workflowPlan, "Charter Workflow Plan")

    const contextPacks = await Promise.all(workflowPlan.contextPacks.map(async (binding) => {
      if (binding.recordType !== "context-pack") throw new Error("Workflow context references must target Context Packs")
      const pack = await this.productStudio.readContextPack(binding.recordId)
      this.assertExactReference(binding, pack, "Context Pack")
      if (pack.productId !== product.id || pack.sufficiency.status === "insufficient") {
        throw new Error("Managed execution requires sufficient Context Packs for this Product")
      }
      if (pack.conflicts.some((conflict) => conflict.state === "open")) {
        throw new Error("Managed execution refuses Context Packs with unresolved conflicts")
      }
      return pack
    }))
    const workflowTools = await Promise.all(workflowPlan.toolDefinitions.map(async (binding) => {
      if (binding.recordType !== "tool-definition") throw new Error("Workflow tool references must target Tool Definitions")
      const tool = await this.productStudio.readToolDefinition(binding.recordId)
      this.assertExactReference(binding, tool, "Tool Definition")
      if (!tool.enabled || tool.productId !== product.id) throw new Error("Managed execution requires enabled Product Tools")
      return tool
    }))
    const intendedContexts = charter.managedIntent.contextPacks
      .map((binding) => `${binding.recordId}:${binding.revision}:${binding.digest}`).sort()
    const resolvedContexts = contextPacks
      .map((pack) => `${pack.id}:${pack.revision}:${canonicalDigest(pack)}`).sort()
    const intendedTools = charter.managedIntent.toolDefinitions
      .map((binding) => `${binding.recordId}:${binding.revision}:${binding.digest}`).sort()
    const resolvedTools = workflowTools
      .map((tool) => `${tool.id}:${tool.revision}:${canonicalDigest(tool)}`).sort()
    if (JSON.stringify(intendedContexts) !== JSON.stringify(resolvedContexts) ||
        JSON.stringify(intendedTools) !== JSON.stringify(resolvedTools)) {
      throw new Error("Managed Context or Tool substitution is forbidden after Charter confirmation")
    }
    const toolSelection = input.runToolSelectionId
      ? await this.productStudio.readRunToolSelection(runToolSelectionSchema.shape.id.parse(input.runToolSelectionId))
      : undefined
    if (workflowTools.length > 0 && !toolSelection) throw new Error("Workflow Tools require a ready Run Tool Selection")
    if (toolSelection) {
      if (toolSelection.runId !== run.id || toolSelection.productId !== product.id || toolSelection.readiness.status !== "ready") {
        throw new Error("Managed execution requires a ready Tool Selection for this exact Run")
      }
      const expected = workflowTools.map((tool) => tool.id).sort()
      const selected = toolSelection.tools.map((tool) => tool.recordId).sort()
      if (JSON.stringify(expected) !== JSON.stringify(selected)) {
        throw new Error("Run Tool Selection must exactly match the Workflow Plan Tool inventory")
      }
      for (const binding of toolSelection.tools) {
        const tool = workflowTools.find((candidate) => candidate.id === binding.recordId)!
        this.assertExactReference(binding, tool, "Selected Tool")
        if (tool.policy.requiresHumanConfirmation && !toolSelection.confirmedToolIds.includes(tool.id)) {
          throw new Error("Every selected high-impact Tool requires explicit human confirmation")
        }
        for (const permission of tool.requiredPermissions) {
          if (!charter.permissions.some((candidate) =>
            candidate.capability === permission.capability && candidate.mode === permission.mode && candidate.mode !== "deny")) {
            throw new Error(`The Charter does not grant the selected Tool capability ${permission.capability}`)
          }
        }
      }
      if (toolSelection.requestedEffects.some((effect) => !charter.expectedEffects.includes(effect))) {
        throw new Error("Tool Selection requests an effect outside the confirmed Charter")
      }
      if (canonicalDigest([...toolSelection.requestedEffects].sort()) !==
          canonicalDigest([...charter.managedIntent.requestedEffects].sort())) {
        throw new Error("Run Tool Selection effects differ from the confirmed managed intent")
      }
      if (canonicalDigest(toolSelection.requestedScopes) !== canonicalDigest(charter.managedIntent.requestedScopes)) {
        throw new Error("Run Tool Selection scopes differ from the confirmed managed intent")
      }
    } else if (charter.managedIntent.toolDefinitions.length > 0 || charter.managedIntent.requestedScopes.length > 0) {
      throw new Error("Confirmed managed Tool or scope intent requires an exact ready Run Tool Selection")
    }

    const adapter = this.adapters.get(run.agent.adapterId)
    if (!adapter) throw new Error(`Adapter ${run.agent.adapterId} is unavailable`)
    const probe = await adapter.probe({ refreshModels: true })
    const capabilities = adapterCapabilitiesSchema.parse(probe.capabilities)
    if (capabilities.adapterId !== run.agent.adapterId || capabilities.agentId !== run.agent.agentId) {
      throw new Error("Adapter probe identity does not match the Run Selection")
    }
    if (capabilityDigest(capabilities) !== run.agent.capabilityDigest) {
      throw new Error("Agent capabilities changed after Charter confirmation")
    }
    const validation = adapter.validateSelection(run.agent, capabilities)
    if (validation.length > 0) throw new Error(validation.join("; "))
    this.assertRuntimeBinding(probe.runtimeBinding, run)
    const mode = this.modeFor(adapter, probe.runtimeBinding)
    this.assertModeEnvelope(mode, charter, contextPacks, workflowTools)
    this.assertWorkflowExecutable(workflowPlan, run, charter, contextPacks, workflowTools)
    const localContext = this.buildLocalContext(contextPacks)
    const localPrompt = this.buildLocalPrompt(charter, workflowPlan, localContext)
    const tools = workflowTools
    const bindings = managedRunRecordSchema.shape.bindings.parse({
      product: ref(product, "product"),
      initiative: ref(initiative, "initiative"),
      charter: {
        recordType: "execution-charter",
        recordId: charter.id,
        revision: 1,
        digest: canonicalDigest(charter),
      },
      run: ref(run, "run"),
      agentSelectionDigest: canonicalDigest(run.agent),
      contextPacks: contextPacks.map((pack) => ref(pack, "context-pack")),
      workflowPlan: ref(workflowPlan, "workflow-plan"),
      runToolSelection: toolSelection ? ref(toolSelection, "run-tool-selection") : undefined,
      tools: tools.map((tool) => ref(tool, "tool-definition")),
    })
    return { run, initiative, charter, workflowPlan, contextPacks, toolSelection, tools, bindings, mode, adapter, probe, localPrompt, localContext }
  }

  private async persistPrepared(record: ManagedRunRecord, resolved: ResolvedExecution, actorId: string): Promise<void> {
    await this.repository.withLock(async () => {
      await this.assertBindingsCurrent(resolved)
      const currentRun = await this.repository.readJson(this.runPath(resolved.run.id), runSchema)
      if (canonicalDigest(currentRun) !== resolved.bindings.run.digest) {
        throw new Error("Run changed before Managed Run preparation")
      }
      await this.repository.commitMutation({
        writes: [{ path: this.managedRunPath(record.id), value: record, schema: managedRunRecordSchema, governed: true }],
        audit: {
          eventType: "managed-run.prepared",
          actor: { kind: "human", id: actorId },
          subjectId: record.id,
          payload: {
            runId: record.runId,
            mode: record.mode,
            bindingsDigest: record.bindingsDigest,
            recordDigest: canonicalDigest(record),
            machineLocalDataPersisted: false,
          },
        },
      })
    })
  }

  private async transitionToRunning(record: ManagedRunRecord, run: Run, actorId: string): Promise<ManagedRunRecord> {
    return this.repository.withLock(async () => {
      const current = await this.repository.readJson(this.managedRunPath(record.id), managedRunRecordSchema)
      if (current.revision !== record.revision || current.state !== "prepared") throw new Error("Managed Run changed before start")
      assertTransition(current.state, "running")
      const currentRun = await this.repository.readJson(this.runPath(run.id), runSchema)
      const allowedRunState = record.previousManagedRunId ? "unknown" : "prepared"
      if (currentRun.state !== allowedRunState) throw new Error("Underlying Run changed before managed start")
      const now = new Date().toISOString()
      const next = managedRunRecordSchema.parse({
        ...current,
        revision: current.revision + 1,
        state: "running",
        startedAt: now,
        updatedAt: now,
      })
      const runningRun = runSchema.parse({
        ...currentRun,
        revision: revisionOf(currentRun) + 1,
        state: "running",
        startedAt: currentRun.startedAt ?? now,
        endedAt: undefined,
      })
      await this.repository.commitMutation({
        writes: [
          { path: this.managedRunPath(next.id), value: next, schema: managedRunRecordSchema, governed: true },
          { path: this.runPath(runningRun.id), value: runningRun, schema: runSchema, governed: true },
        ],
        audit: {
          eventType: "managed-run.started",
          actor: { kind: "human", id: actorId },
          subjectId: next.id,
          payload: { from: "prepared", to: "running", revision: next.revision, recordDigest: canonicalDigest(next) },
        },
      })
      return next
    })
  }

  private async launch(
    resolved: ResolvedExecution,
    input: ManagedExecutionStartInput,
    managedRunId: string,
  ): Promise<RuntimeHandle> {
    const resume = input.previousManagedRunId ? this.resumeSources.get(input.previousManagedRunId) : undefined
    if (resolved.mode === "manual-offline") {
      if (!(resolved.adapter instanceof DeterministicManualAdapter)) {
        throw new Error("Manual managed execution requires DeterministicManualAdapter")
      }
      const scriptId = String(resolved.run.agent.settings.script ?? "")
      const handle = resume
        ? resolved.adapter.resume(scriptId, resume.providerThreadId)
        : resolved.adapter.start({ scriptId })
      return {
        events: handle.events,
        completion: handle.completion.then((runtime) => ({
          runtime,
          terminationCause: this.causeFromDisposition(runtime.portable.terminalDisposition),
        })),
        cancel: (reason) => handle.cancel(reason),
      }
    }
    if (resolved.probe.runtimeBinding.kind !== "executable") throw new Error("Managed provider executable is unavailable")
    if (resolved.mode === "codex-staged") {
      const stagingService = new WorkspaceStagingService()
      const policy = compileManagedCodexPolicy(resolved.charter, resolved.tools)
      const handle = await startManagedCodexStagedRun({
        executable: resolved.probe.runtimeBinding.executablePath,
        sourceWorkspacePath: this.workspacePath,
        model: resolved.run.agent.modelId,
        prompt: resolved.localPrompt,
        developerInstructions: this.localDeveloperInstructions(resolved.charter),
        resumeThreadId: resume?.providerThreadId,
        runtimeVersion: resolved.probe.capabilities.runtimeVersion,
        capabilityDigest: resolved.run.agent.capabilityDigest as `sha256:${string}`,
        timeoutMs: input.timeoutMs,
        policy,
        stagingService,
        managedRunId,
        stageRegistry: this.stageRegistry,
      })
      let cancelRequested = false
      return {
        events: handle.events,
        completion: handle.completion.then((review) => ({
          runtime: review.result,
          codexReview: review,
          stagingService,
          terminationCause: cancelRequested
            ? "cancel-request"
            : this.causeFromDisposition(review.result.portable.terminalDisposition),
        })),
        cancel: async (reason) => {
          cancelRequested = true
          await handle.cancel(reason)
        },
      }
    }
    const effort = resolved.run.agent.settings.effort
    const maxBudgetUsd = resolved.run.agent.settings.maxBudgetUsd
    const handle = await startManagedClaudeContextRun({
      executable: resolved.probe.runtimeBinding.executablePath,
      executableFingerprint: resolved.probe.runtimeBinding.executableFingerprint,
      runtimeVersion: resolved.probe.capabilities.runtimeVersion,
      capabilityDigest: resolved.run.agent.capabilityDigest as `sha256:${string}`,
      model: resolved.run.agent.modelId,
      objective: resolved.charter.objective,
      contextPack: resolved.localContext,
      effort: typeof effort === "string" && ["low", "medium", "high", "xhigh", "max"].includes(effort)
        ? effort as "low" | "medium" | "high" | "xhigh" | "max"
        : undefined,
      maxBudgetUsd: typeof maxBudgetUsd === "number" ? maxBudgetUsd : undefined,
      timeoutMs: input.timeoutMs,
    })
    return {
      events: handle.events,
      completion: handle.completion.then(({ result: runtime, terminationCause }) => ({ runtime, terminationCause })),
      cancel: (reason) => handle.cancel(reason),
    }
  }

  private async persistRuntimeResult(
    current: ManagedRunRecord,
    resolved: ResolvedExecution,
    runtime: ManagedRuntimeResultEnvelope,
    state: ManagedRunResult["terminalState"],
    cause: ManagedRunResult["terminationCause"],
    stagingState: NonNullable<ManagedRunEvidence["staging"]>["applyState"] | undefined,
    outcomeBasis: ManagedRunResult["outcome"]["basis"],
    actorId: string,
  ): Promise<PersistedArtifacts> {
    const events = normalizeManagedRuntimeEvents(runtime.portable.events)
    const now = new Date().toISOString()
    const staging = runtime.portable.staging && stagingState
      ? managedStagingEvidence(runtime.portable.staging, stagingState)
      : undefined
    const effectsSeed = canonicalDigest({ events, staging, disposition: runtime.portable.terminalDisposition })
    const actualEffects = [...new Set(resolved.charter.expectedEffects)].map((effect) => ({
      effect,
      status: this.effectStatus(effect, state, staging),
      evidenceDigest: canonicalDigest({ effectsSeed, effect }),
    }))
    const evidence = managedRunEvidenceSchema.parse({
      schemaVersion: 1,
      kind: "managed-run-evidence",
      id: randomUUID(),
      managedRunId: current.id,
      runId: current.runId,
      productId: current.productId,
      bindingsDigest: current.bindingsDigest,
      events,
      eventsDigest: canonicalDigest(events),
      staging,
      actualEffects,
      capturedAt: now,
      authorityBoundary: "evidence-does-not-self-assert-outcome-or-authorization",
    })
    const result = managedRunResultSchema.parse({
      schemaVersion: 1,
      kind: "managed-run-result",
      id: randomUUID(),
      managedRunId: current.id,
      runId: current.runId,
      productId: current.productId,
      mode: current.mode,
      provider: current.provider,
      providerThreadRef: providerRef(runtime.portable.providerThreadId, "thread"),
      providerTurnRef: providerRef(runtime.portable.providerTurnId, "turn"),
      providerDisposition: runtime.portable.terminalDisposition,
      terminationCause: cause,
      outcome: { status: runtime.portable.postconditionStatus, basis: outcomeBasis },
      terminalState: state,
      evidenceId: evidence.id,
      evidenceDigest: canonicalDigest(evidence),
      warnings: uniqueWarnings(runtime, events, current.mode),
      startedAt: current.startedAt ?? current.updatedAt,
      endedAt: now,
      authorityBoundary: "provider-completion-does-not-equal-outcome-completion",
    })
    return this.commitArtifacts(current, result, evidence, actorId)
  }

  private async commitArtifacts(
    expected: ManagedRunRecord,
    result: ManagedRunResult,
    evidence: ManagedRunEvidence,
    actorId: string,
  ): Promise<PersistedArtifacts> {
    return this.repository.withLock(async () => {
      const current = await this.repository.readJson(this.managedRunPath(expected.id), managedRunRecordSchema)
      if (current.revision !== expected.revision || current.state !== expected.state) {
        throw new Error("Managed Run changed before result persistence")
      }
      assertTransition(current.state, result.terminalState)
      const now = new Date().toISOString()
      const next = managedRunRecordSchema.parse({
        ...current,
        revision: current.revision + 1,
        state: result.terminalState,
        resultId: result.id,
        resultDigest: canonicalDigest(result),
        updatedAt: now,
        endedAt: managedTerminalStates.has(result.terminalState) ? now : undefined,
      })
      const run = await this.repository.readJson(this.runPath(current.runId), runSchema)
      const targetLegacyState = legacyState(next.state)
      const nextRun = targetLegacyState && run.state === "running"
        ? runSchema.parse({
            ...run,
            revision: revisionOf(run) + 1,
            state: targetLegacyState,
            endedAt: now,
          })
        : run
      await this.repository.commitMutation({
        writes: [
          { path: this.evidencePath(evidence.id), value: evidence, schema: managedRunEvidenceSchema, governed: true },
          { path: this.resultPath(result.id), value: result, schema: managedRunResultSchema, governed: true },
          { path: this.managedRunPath(next.id), value: next, schema: managedRunRecordSchema, governed: true },
          ...(nextRun === run ? [] : [{ path: this.runPath(nextRun.id), value: nextRun, schema: runSchema, governed: true }]),
        ],
        audit: {
          eventType: `managed-run.${next.state}`,
          actor: { kind: "system", id: actorId },
          subjectId: next.id,
          payload: {
            from: current.state,
            to: next.state,
            providerDisposition: result.providerDisposition,
            outcomeStatus: result.outcome.status,
            resultDigest: canonicalDigest(result),
            evidenceDigest: canonicalDigest(evidence),
            actualEffectsDigest: canonicalDigest(evidence.actualEffects),
            machineLocalDataPersisted: false,
          },
        },
      })
      return { record: next, result, evidence }
    })
  }

  private async transitionForApply(current: ManagedRunRecord, actorId: string): Promise<ManagedRunRecord> {
    return this.repository.withLock(async () => {
      const persisted = await this.repository.readJson(this.managedRunPath(current.id), managedRunRecordSchema)
      if (persisted.revision !== current.revision || persisted.state !== "review-required") {
        throw new Error("Managed Run is no longer awaiting apply review")
      }
      assertTransition(persisted.state, "applying")
      const next = managedRunRecordSchema.parse({
        ...persisted,
        revision: persisted.revision + 1,
        state: "applying",
        updatedAt: new Date().toISOString(),
      })
      await this.repository.commitMutation({
        writes: [{ path: this.managedRunPath(next.id), value: next, schema: managedRunRecordSchema, governed: true }],
        audit: {
          eventType: "managed-run.applying",
          actor: { kind: "human", id: actorId },
          subjectId: next.id,
          payload: { from: "review-required", to: "applying", revision: next.revision, recordDigest: canonicalDigest(next) },
        },
      })
      return next
    })
  }

  private async performDiscard(
    current: PersistedArtifacts,
    resolved: ResolvedExecution,
    completion: RuntimeCompletion,
    actorId: string,
  ): Promise<PersistedArtifacts> {
    if (!completion.codexReview) throw new Error("This Managed Run has no staged workspace to discard")
    const runtime = await completion.codexReview.discard()
    if (current.record.state !== "review-required" && current.record.state !== "conflict") return current
    const events = normalizeManagedRuntimeEvents(runtime.portable.events)
    const now = new Date().toISOString()
    const staging = runtime.portable.staging
      ? managedStagingEvidence(runtime.portable.staging, "discarded")
      : undefined
    const evidence = managedRunEvidenceSchema.parse({
      schemaVersion: 1,
      kind: "managed-run-evidence",
      id: randomUUID(),
      managedRunId: current.record.id,
      runId: current.record.runId,
      productId: current.record.productId,
      bindingsDigest: current.record.bindingsDigest,
      events,
      eventsDigest: canonicalDigest(events),
      staging,
      actualEffects: [...new Set(resolved.charter.expectedEffects)].map((effect) => ({
        effect,
        status: "blocked" as const,
        evidenceDigest: canonicalDigest({ effect, disposition: "discarded", eventsDigest: canonicalDigest(events) }),
      })),
      capturedAt: now,
      authorityBoundary: "evidence-does-not-self-assert-outcome-or-authorization",
    })
    const result = managedRunResultSchema.parse({
      ...current.result,
      id: randomUUID(),
      evidenceId: evidence.id,
      evidenceDigest: canonicalDigest(evidence),
      outcome: { status: "not-assessed", basis: "not-evaluated" },
      terminalState: "discarded",
      endedAt: now,
    })
    return this.commitArtifacts(current.record, result, evidence, actorId)
  }

  private async persistLaunchFailure(current: ManagedRunRecord, resolved: ResolvedExecution, actorId: string): Promise<void> {
    await this.persistSyntheticFailure(current, resolved, "protocol-error", actorId)
  }

  private async persistRuntimeFailure(current: ManagedRunRecord, resolved: ResolvedExecution, actorId: string): Promise<void> {
    const latest = await this.read(current.id)
    if (latest.state === "running") await this.persistSyntheticFailure(latest, resolved, "process-loss", actorId)
  }

  private async persistSyntheticFailure(
    current: ManagedRunRecord,
    resolved: ResolvedExecution,
    cause: "protocol-error" | "process-loss",
    actorId: string,
  ): Promise<void> {
    const runtime: ManagedRuntimeResultEnvelope = {
      portable: {
        schemaVersion: 1,
        provider: { adapterId: current.provider.adapterId, agentId: current.provider.agentId },
        events: [],
        terminalDisposition: cause === "protocol-error" ? "protocol-error" : "unknown",
        warnings: [],
        postconditionStatus: "indeterminate",
      },
      local: {},
    }
    await this.persistRuntimeResult(
      current,
      resolved,
      runtime,
      cause === "protocol-error" ? "failed" : "unknown",
      cause,
      undefined,
      "provider-failure",
      actorId,
    )
  }

  private async assertBindingsCurrent(resolved: ResolvedExecution): Promise<void> {
    const records = [
      [await this.repository.readJson(this.repository.resolve("product.json"), productSchema), resolved.bindings.product],
      [await this.repository.readJson(this.repository.resolve("initiatives", `${resolved.run.initiativeId}.json`), initiativeSchema), resolved.bindings.initiative],
      [await this.repository.readJson(this.repository.resolve("sessions", `charter-${resolved.charter.id}.json`), executionCharterSchema), resolved.bindings.charter],
      [await this.repository.readJson(this.runPath(resolved.run.id), runSchema), resolved.bindings.run],
      [await this.productStudio.readWorkflowPlan(resolved.workflowPlan.id), resolved.bindings.workflowPlan!],
      ...await Promise.all(resolved.contextPacks.map(async (pack) => [
        await this.productStudio.readContextPack(pack.id),
        resolved.bindings.contextPacks.find((binding) => binding.recordId === pack.id)!,
      ] as const)),
      ...await Promise.all(resolved.tools.map(async (tool) => [
        await this.productStudio.readToolDefinition(tool.id),
        resolved.bindings.tools.find((binding) => binding.recordId === tool.id)!,
      ] as const)),
    ] as const
    for (const [record, binding] of records) {
      if (!binding || canonicalDigest(record) !== binding.digest || revisionOf(record as unknown as { revision?: number }) !== binding.revision) {
        throw new Error("A governed record changed before Managed Run persistence")
      }
    }
    if (resolved.toolSelection && resolved.bindings.runToolSelection) {
      const selection = await this.productStudio.readRunToolSelection(resolved.toolSelection.id)
      if (canonicalDigest(selection) !== resolved.bindings.runToolSelection.digest) {
        throw new Error("Run Tool Selection changed before Managed Run persistence")
      }
    }
  }

  private assertExactReference(
    binding: { recordId: string; revision: number; digest: string },
    record: { id: string; revision?: number },
    label: string,
  ): void {
    if (binding.recordId !== record.id || binding.revision !== revisionOf(record) || binding.digest !== canonicalDigest(record)) {
      throw new Error(`${label} exact reference is stale or inconsistent`)
    }
  }

  private assertRuntimeBinding(binding: AdapterRuntimeBinding, run: Run): void {
    if (binding.scope !== "machine-local" || binding.adapterId !== run.agent.adapterId || binding.agentId !== run.agent.agentId) {
      throw new Error("Agent returned a mismatched machine-local runtime binding")
    }
    if (binding.kind === "unavailable") throw new Error("Selected Agent runtime is unavailable on this machine")
  }

  private modeFor(adapter: AgentAdapter, binding: AdapterRuntimeBinding): ManagedExecutionMode {
    if (adapter instanceof DeterministicManualAdapter && binding.kind === "managed-in-process") return "manual-offline"
    if (adapter.id === "gaep.codex-cli" && binding.kind === "executable") return "codex-staged"
    if (adapter.id === "gaep.claude-code-cli" && binding.kind === "executable") return "claude-context-only"
    throw new Error(`Adapter ${adapter.id} has no supported managed execution mode`)
  }

  private assertModeEnvelope(
    mode: ManagedExecutionMode,
    charter: ExecutionCharter,
    packs: ContextPack[],
    tools: ToolDefinition[],
  ): void {
    if (charter.expectedEffects.some((effect) => effect === "external-effect" || effect === "destructive-or-irreversible")) {
      throw new Error("Managed execution refuses external, destructive, or irreversible expected effects")
    }
    if (mode === "claude-context-only") {
      if (tools.length > 0) throw new Error("Managed Claude context-only execution exposes no Tools")
      if (charter.expectedEffects.some((effect) => effect !== "observe")) {
        throw new Error("Managed Claude context-only execution permits observation only")
      }
      if (charter.permissions.some((permission) => permission.mode !== "deny")) {
        throw new Error("Managed Claude context-only execution requires every Tool permission to be denied")
      }
      if (packs.some((pack) => ["confidential", "restricted"].includes(pack.classification.level))) {
        throw new Error("Managed Claude context-only execution refuses confidential or restricted Context Packs")
      }
    }
    if (mode === "manual-offline") {
      if (tools.length > 0) throw new Error("Deterministic manual execution exposes no Tools")
      if (charter.expectedEffects.some((effect) => effect !== "observe")) {
        throw new Error("Deterministic manual execution is offline and permits observation only")
      }
      if (charter.permissions.some((permission) => permission.mode !== "deny")) {
        throw new Error("Deterministic manual execution requires every Tool permission to be denied")
      }
    }
    if (mode === "codex-staged") compileManagedCodexPolicy(charter, tools)
  }

  private buildLocalContext(packs: ContextPack[]): string {
    const content = packs.flatMap((pack) => pack.items.map((item) => item.content)).join("\n\n---\n\n")
    if (!content.trim()) throw new Error("Managed execution requires non-empty governed Context content")
    if (Buffer.byteLength(content) > 1_500_000) throw new Error("Combined managed Context exceeds the local provider-input bound")
    return content
  }

  private buildLocalPrompt(charter: ExecutionCharter, plan: WorkflowPlan, context: string): string {
    const workflowSteps = plan.steps.flatMap((step, index) => [
      `Step ${index + 1}: ${step.title}`,
      `- Objective: ${step.objective}`,
      `- Preconditions: ${step.preconditions.join("; ")}`,
      `- Required outputs: ${step.outputs.join("; ")}`,
      `- Evidence criteria: ${step.evidenceCriteria.join("; ")}`,
      `- Effects: ${step.effectEnvelope.join(", ") || "none"}`,
      `- Stop conditions: ${step.stopConditions.join("; ")}`,
    ])
    return [
      "Execute only the confirmed GAEP Managed Run in the isolated staging workspace.",
      `Objective: ${charter.objective}`,
      `Workflow: ${plan.title}`,
      `Workflow strategy: ${plan.strategy}`,
      "Execute these Workflow steps in their declared dependency order:",
      ...workflowSteps,
      "Stop conditions:",
      ...charter.stopConditions.map((condition) => `- ${condition}`),
      "Forbidden actions:",
      ...charter.forbiddenActions.map((action) => `- ${action}`),
      "Governed context:",
      context,
    ].join("\n")
  }

  private assertWorkflowExecutable(
    plan: WorkflowPlan,
    run: Run,
    charter: ExecutionCharter,
    packs: ContextPack[],
    tools: ToolDefinition[],
  ): void {
    if (plan.strategy !== "sequential") {
      throw new Error("The current managed runtime supports only sequential Workflow Plans")
    }
    const agentIds = new Set([run.agent.agentId, run.agent.adapterId])
    const packIds = new Set(packs.map((pack) => pack.id))
    const toolIds = new Set(tools.map((tool) => tool.id))
    for (const step of plan.steps) {
      if (step.responsibility.kind !== "agent" || !agentIds.has(step.responsibility.id)) {
        throw new Error("Every managed Workflow step must be assigned to the exact selected Agent")
      }
      if (step.contextPacks.some((binding) => !packIds.has(binding.recordId))) {
        throw new Error("Workflow Step Context bindings must be included in the exact Plan Context inventory")
      }
      if (step.toolDefinitions.some((binding) => !toolIds.has(binding.recordId))) {
        throw new Error("Workflow Step Tool bindings must be included in the exact Plan Tool inventory")
      }
      if (step.effectEnvelope.some((effect) => !charter.expectedEffects.includes(effect))) {
        throw new Error("Workflow Step effects exceed the confirmed Charter")
      }
    }
  }

  private localDeveloperInstructions(charter: ExecutionCharter): string {
    return [
      "Technical access is not an authorization grant.",
      "Operate only inside the isolated staged workspace.",
      "Do not perform network, external, destructive, or irreversible effects.",
      ...charter.requiredEvidence.map((item) => `Required evidence: ${item}`),
    ].join("\n")
  }

  private causeFromDisposition(disposition: ManagedTerminalDisposition): ManagedRunResult["terminationCause"] {
    if (disposition === "completed") return "normal"
    if (disposition === "cancelled") return "cancel-request"
    if (disposition === "protocol-error") return "protocol-error"
    if (disposition === "unknown") return "process-loss"
    return "provider-failure"
  }

  private effectStatus(
    effect: ExecutionCharter["expectedEffects"][number],
    state: ManagedRunState,
    staging: ManagedRunEvidence["staging"],
  ): ManagedRunEvidence["actualEffects"][number]["status"] {
    if (["failed", "cancelled", "timed-out", "discarded"].includes(state)) return "blocked"
    if (["unknown", "conflict"].includes(state)) return "unknown"
    if (effect === "reversible-change") {
      if (staging?.applyState === "applied") return "applied"
      return staging?.changes.length ? "observed-provisional" : "not-observed"
    }
    if (effect === "provisional") return staging?.changes.length ? "observed-provisional" : "not-observed"
    if (effect === "observe") return "observed-provisional"
    return "blocked"
  }

  private managedRunPath(id: string): string {
    return this.repository.resolve("sessions", `managed-run-${id}.json`)
  }

  private resultPath(id: string): string {
    return this.repository.resolve("sessions", `managed-result-${id}.json`)
  }

  private evidencePath(id: string): string {
    return this.repository.resolve("sessions", `managed-evidence-${id}.json`)
  }

  private runPath(id: string): string {
    return this.repository.resolve("sessions", `run-${id}.json`)
  }

  async applyReview(
    current: PersistedArtifacts,
    resolved: ResolvedExecution,
    completion: RuntimeCompletion,
    input: ManagedExecutionApplyInput,
    actorId: string,
  ): Promise<PersistedArtifacts> {
    if (!completion.codexReview || !completion.stagingService) throw new Error("This Managed Run has no staged changes to apply")
    const applying = await this.transitionForApply(current.record, actorId)
    let runtime: ManagedRuntimeResultEnvelope
    try {
      runtime = await completion.codexReview.apply(input)
    } catch (error) {
      await this.persistSyntheticFailure(applying, resolved, "process-loss", actorId).catch(() => undefined)
      throw error
    }
    const applyState = runtime.portable.staging?.applied
      ? "applied"
      : runtime.portable.staging?.applyJournalDigest
        ? "conflict"
        : "not-applied"
    const state = applyState === "conflict"
      ? "conflict"
      : terminalState(
          runtime.portable.terminalDisposition,
          "normal",
          runtime.portable.postconditionStatus,
          false,
        )
    const persisted = await this.persistRuntimeResult(
      applying,
      resolved,
      runtime,
      state,
      "normal",
      applyState,
      input.evaluatePostconditions ? "postcondition-evaluator" : "not-evaluated",
      actorId,
    )
    const journalPath = runtime.local.applyJournalPath
    const journalDigest = runtime.portable.staging?.applyJournalDigest
    if (journalPath && journalDigest) {
      this.journals.set(current.record.id, {
        stagingService: completion.stagingService,
        path: journalPath,
        digest: journalDigest,
        disposed: false,
      })
    }
    return persisted
  }

  async discardReview(
    current: PersistedArtifacts,
    resolved: ResolvedExecution,
    completion: RuntimeCompletion,
    actorId: string,
  ): Promise<PersistedArtifacts> {
    return this.performDiscard(current, resolved, completion, actorId)
  }

  async disposeJournal(managedRunId: string): Promise<void> {
    const binding = this.journals.get(managedRunId)
    if (!binding) throw new Error("Managed Run has no retained local apply journal")
    if (binding.disposed) return
    const record = await this.read(managedRunId)
    if (!record.resultId) throw new Error("Apply journal cannot be disposed before result evidence is committed")
    const result = await this.readResult(record.resultId)
    const evidence = await this.readEvidence(result.evidenceId)
    if (evidence.staging?.applyJournalDigest !== binding.digest) {
      throw new Error("Committed evidence does not match the retained local apply journal")
    }
    await binding.stagingService.disposeJournal(binding.path, binding.digest)
    await this.stageRegistry.complete(managedRunId)
    binding.disposed = true
  }

  hasJournal(managedRunId: string): boolean {
    const binding = this.journals.get(managedRunId)
    return binding !== undefined && !binding.disposed
  }
}

class ManagedExecutionReviewHandle implements ManagedExecutionReview {
  constructor(
    private readonly service: ManagedExecutionService,
    private persisted: PersistedArtifacts,
    private readonly resolved: ResolvedExecution,
    private readonly runtimeCompletion: RuntimeCompletion,
    private readonly actorId: string,
  ) {}

  get record(): ManagedRunRecord { return structuredClone(this.persisted.record) }
  get result(): ManagedRunResult { return structuredClone(this.persisted.result) }
  get evidence(): ManagedRunEvidence { return structuredClone(this.persisted.evidence) }
  get canApply(): boolean { return this.persisted.record.state === "review-required" && this.runtimeCompletion.codexReview !== undefined }
  get hasLocalJournal(): boolean { return this.service.hasJournal(this.persisted.record.id) }

  async apply(input: ManagedExecutionApplyInput): Promise<ManagedExecutionReview> {
    if (!this.canApply) throw new Error("Managed Run is not awaiting staged apply review")
    this.persisted = await this.service.applyReview(
      this.persisted,
      this.resolved,
      this.runtimeCompletion,
      input,
      this.actorId,
    )
    return this
  }

  async discard(): Promise<ManagedExecutionReview> {
    this.persisted = await this.service.discardReview(
      this.persisted,
      this.resolved,
      this.runtimeCompletion,
      this.actorId,
    )
    return this
  }

  async disposeLocalJournal(): Promise<void> {
    await this.service.disposeJournal(this.persisted.record.id)
  }
}
