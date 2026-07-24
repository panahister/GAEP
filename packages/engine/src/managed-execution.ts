import { randomUUID } from "node:crypto"
import { realpath } from "node:fs/promises"

import {
  adapterCapabilitiesSchema,
  agentSelectionSchema,
  executionCharterSchema,
  initiativeSchema,
  managedApplyDecisionReceiptSchema,
  managedEvidenceEventSchema,
  managedRunEvidenceSchema,
  managedRunRecordSchema,
  managedRunResultSchema,
  managedWorkflowGateAssessmentSchema,
  managedWorkflowExecutionSchema,
  managedWorkflowStepAttemptSchema,
  productSchema,
  runSchema,
  runToolSelectionSchema,
  workflowPlanSchema,
  type ContextPack,
  type ExecutionCharter,
  type ManagedEvidenceEvent,
  type ManagedApplyDecisionReceipt,
  type ManagedExecutionMode,
  type ManagedRunBindings,
  type ManagedRunEvidence,
  type ManagedRunRecord,
  type ManagedRunResult,
  type ManagedRunState,
  type ManagedWorkflowGateAssessment,
  type ManagedWorkflowExecution,
  type ManagedWorkflowStepAttempt,
  type Initiative,
  type Run,
  type RunToolSelection,
  type ToolDefinition,
  type WorkflowPlan,
  type WorkflowStep,
} from "@gaep/contracts"
import {
  BoundedAsyncQueue,
  DeterministicManualAdapter,
  ManagedStageRecoveryError,
  ManagedStageRegistry,
  ManagedCodexPreJournalApplyError,
  WorkspaceStagingService,
  canonicalDigest,
  capabilityDigest,
  rehydrateManagedCodexStageReview,
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
  prepared: ["running", "failed", "cancelled", "unknown"],
  running: ["review-required", "completed", "failed", "cancelled", "timed-out", "unknown"],
  "review-required": ["applying", "discarded", "unknown"],
  applying: ["review-required", "completed", "failed", "unknown", "conflict"],
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
  evaluateWorkflowGate?: ManagedWorkflowGateEvaluator
}

export interface ManagedWorkflowGateEvaluationRequest {
  readonly managedRunId: string
  readonly runId: string
  readonly stepId: string
  readonly stepIndex: number
  readonly attempt: number
  readonly phase: ManagedWorkflowGateAssessment["phase"]
  readonly criteria: readonly string[]
  readonly criteriaDigest: `sha256:${string}`
  readonly completedStepIds: readonly string[]
  readonly providerDisposition?: ManagedRunResult["providerDisposition"]
  readonly postconditionStatus?: ManagedRunResult["outcome"]["status"]
  readonly eventsDigest?: `sha256:${string}`
  readonly signal: AbortSignal
}

export interface ManagedWorkflowGateEvaluation {
  status: "satisfied" | "failed" | "not-assessed"
  basis: "human-attestation" | "system-evaluator"
  evidenceDigest?: `sha256:${string}`
  evaluator: ManagedEvaluatorIdentity
}

export interface ManagedEvaluatorIdentity {
  kind: "human" | "system"
  id: string
  version: string
  digest: `sha256:${string}`
}

export type ManagedWorkflowGateEvaluator = (
  request: ManagedWorkflowGateEvaluationRequest,
) => Promise<ManagedWorkflowGateEvaluation>

export interface ManagedExecutionApplyConfirmation {
  readonly decision: "apply-exact-reviewed-inventory"
  readonly reviewEvidenceId: string
  readonly reviewEvidenceDigest: `sha256:${string}`
  readonly changedInventoryDigest: `sha256:${string}`
  readonly writeEnvelope: readonly string[]
  readonly writeEnvelopeDigest: `sha256:${string}`
}

export interface ManagedExecutionApplyInput {
  confirmation: ManagedExecutionApplyConfirmation
  evaluatePostconditions?: ManagedCodexPostconditionEvaluator
  postconditionEvaluator?: ManagedEvaluatorIdentity
  postconditionTimeoutMs?: number
  /** Required after restart when post-apply Workflow gates must be reassessed. */
  evaluateWorkflowGate?: ManagedWorkflowGateEvaluator
}

export interface ManagedExecutionReview {
  readonly record: ManagedRunRecord
  readonly result: ManagedRunResult
  readonly evidence: ManagedRunEvidence
  readonly canApply: boolean
  readonly canDiscard: boolean
  readonly hasLocalJournal: boolean
  readonly applyConfirmation?: ManagedExecutionApplyConfirmation
  apply(input: ManagedExecutionApplyInput, actorId: string): Promise<ManagedExecutionReview>
  discard(actorId: string): Promise<ManagedExecutionReview>
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
  requestedWorkspaceScopes: readonly string[] = [],
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
  assertCharterToolScopeAuthority(charter, tools, requestedWorkspaceScopes)
  const allowed = charter.permissions.filter((permission) => permission.mode === "allow")
  const capability = (pattern: RegExp): boolean => allowed.some((permission) => pattern.test(permission.capability))
  return {
    allowCommands: shellSelected && capability(/(?:command|shell|process|terminal|execute)/iu),
    allowFileChanges: workspaceWriteSelected &&
      charter.expectedEffects.some((effect) => effect === "provisional" || effect === "reversible-change") &&
      capability(/(?:file|workspace|write|edit|change|modify)/iu),
  }
}

function assertCharterToolScopeAuthority(
  charter: ExecutionCharter,
  tools: readonly ToolDefinition[],
  requestedWorkspaceScopes: readonly string[],
): void {
  const permissionRank = { deny: 0, ask: 1, allow: 2 } as const
  for (const tool of tools) {
    for (const required of tool.requiredPermissions ?? []) {
      const granted = charter.permissions.find((candidate) => candidate.capability === required.capability)
      if (!granted || permissionRank[granted.mode] < permissionRank[required.mode]) {
        throw new Error(`The Charter does not grant the selected Tool capability ${required.capability}`)
      }
      for (const scope of requestedWorkspaceScopes) {
        if (!workspacePathWithinEnvelope(scope, granted.scope)) {
          throw new Error(`Workspace scope ${scope} exceeds Charter permission ${required.capability}`)
        }
      }
    }
    const allowedWorkspaceScopes = (tool.allowedScopes ?? [])
      .filter((scope): scope is { kind: "workspace-relative"; path: string } => scope.kind === "workspace-relative")
      .map((scope) => scope.path)
    for (const scope of requestedWorkspaceScopes) {
      if (!workspacePathWithinEnvelope(scope, allowedWorkspaceScopes)) {
        throw new Error(`Workspace scope ${scope} exceeds selected Tool ${tool.key}`)
      }
    }
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
  orderedSteps: WorkflowStep[]
  writeEnvelope: string[]
  previousManagedRun?: ManagedRunRecord
  providerResume?: ResumeSource
  workflowResume?: DurableWorkflowResume
}

interface DurableWorkflowResume {
  workflow: ManagedWorkflowExecution
  events: ManagedEvidenceEvent[]
  nextStepIndex: number
}

interface StepRuntimeCompletion {
  runtime: ManagedRuntimeResultEnvelope
  codexReview?: ManagedCodexStageReview
  stagingService?: WorkspaceStagingService
  terminationCause: ManagedRunResult["terminationCause"]
}

interface RuntimeCompletion extends StepRuntimeCompletion {
  workflow: ManagedWorkflowExecution
  gateEvaluator: ManagedWorkflowGateEvaluator
  evidenceEvents?: ManagedEvidenceEvent[]
  persistedEventsDigest?: `sha256:${string}`
  requiresWorkflowGateEvaluator?: boolean
}

interface RuntimeHandle {
  events: AsyncIterable<ManagedRuntimeEvent>
  completion: Promise<RuntimeCompletion>
  cancel(reason?: string): Promise<void>
}

interface StepRuntimeHandle {
  events: AsyncIterable<ManagedRuntimeEvent>
  completion: Promise<StepRuntimeCompletion>
  cancel(reason?: string): Promise<void>
}

interface ParallelStepOutcome {
  step: WorkflowStep
  stepIndex: number
  attempts: ManagedWorkflowStepAttempt[]
  completed: boolean
  completion: StepRuntimeCompletion
  terminalReasonCode: string
  events: ManagedRuntimeEvent[]
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
  digest: `sha256:${string}`
  disposed: boolean
}

class WorkflowControlError extends Error {
  constructor(readonly control: "cancel-request" | "timeout") {
    super(control === "timeout" ? "Workflow Step deadline expired" : "Workflow gate assessment was cancelled")
    this.name = "WorkflowControlError"
  }
}

export interface ManagedPendingReviewStatus {
  readonly managedRunId: string
  readonly state: ManagedRunRecord["state"]
  readonly canApply: boolean
  readonly canDiscard: boolean
  readonly hasLocalJournal: boolean
  readonly applyConfirmation?: ManagedExecutionApplyConfirmation
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

function assertEvaluatorIdentity(identity: ManagedEvaluatorIdentity, label: string): void {
  if (identity.digest !== canonicalDigest({
    kind: identity.kind,
    id: identity.id,
    version: identity.version,
  })) {
    throw new Error(`${label} identity digest is invalid`)
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

export function compileManagedWorkflowOrder(plan: WorkflowPlan): WorkflowStep[] {
  if (plan.strategy === "parallel-readonly") return compileManagedWorkflowBatches(plan).flat()
  const byId = new Map(plan.steps.map((step) => [step.id, step]))
  if (byId.size !== plan.steps.length) throw new Error("Workflow Step identities must be unique")
  const declaredIndex = new Map(plan.steps.map((step, index) => [step.id, index]))
  const remainingDependencies = new Map<string, Set<string>>()
  for (const step of plan.steps) {
    const dependencies = new Set(step.dependsOn)
    if (dependencies.has(step.id)) throw new Error(`Workflow Step ${step.id} cannot depend on itself`)
    for (const dependency of dependencies) {
      if (!byId.has(dependency)) throw new Error(`Workflow Step ${step.id} has missing dependency ${dependency}`)
    }
    remainingDependencies.set(step.id, dependencies)
  }
  const ordered: WorkflowStep[] = []
  const completed = new Set<string>()
  while (ordered.length < plan.steps.length) {
    const ready = plan.steps
      .filter((step) => !completed.has(step.id) && [...remainingDependencies.get(step.id)!].every((id) => completed.has(id)))
      .sort((left, right) => declaredIndex.get(left.id)! - declaredIndex.get(right.id)!)
    if (ready.length === 0) throw new Error("Workflow Step dependency graph contains a cycle")
    const next = ready[0]!
    ordered.push(next)
    completed.add(next.id)
  }
  return ordered
}

export const managedParallelReadOnlyConcurrency = 4

export function compileManagedWorkflowBatches(
  plan: WorkflowPlan,
  concurrency = managedParallelReadOnlyConcurrency,
): WorkflowStep[][] {
  if (plan.strategy !== "parallel-readonly") return compileManagedWorkflowOrder(plan).map((step) => [step])
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > managedParallelReadOnlyConcurrency) {
    throw new Error(`Managed parallel-readonly concurrency must be between 1 and ${managedParallelReadOnlyConcurrency}`)
  }
  const byId = new Map(plan.steps.map((step) => [step.id, step]))
  if (byId.size !== plan.steps.length) throw new Error("Workflow Step identities must be unique")
  const completed = new Set<string>()
  const batches: WorkflowStep[][] = []
  while (completed.size < plan.steps.length) {
    const ready = plan.steps.filter((step) => {
      if (completed.has(step.id)) return false
      if (step.dependsOn.includes(step.id)) throw new Error(`Workflow Step ${step.id} cannot depend on itself`)
      for (const dependency of step.dependsOn) {
        if (!byId.has(dependency)) throw new Error(`Workflow Step ${step.id} has missing dependency ${dependency}`)
      }
      return step.dependsOn.every((dependency) => completed.has(dependency))
    })
    if (ready.length === 0) throw new Error("Workflow Step dependency graph contains a cycle")
    for (let index = 0; index < ready.length; index += concurrency) {
      batches.push(ready.slice(index, index + concurrency))
    }
    for (const step of ready) completed.add(step.id)
  }
  return batches
}

export function workspacePathWithinEnvelope(path: string, envelope: readonly string[]): boolean {
  return envelope.some((scope) => scope === "." || path === scope || path.startsWith(`${scope}/`))
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
  applyDecision?: ManagedApplyDecisionReceipt,
): NonNullable<ManagedRunEvidence["staging"]> {
  return {
    baselineDigest: source.baselineDigest,
    finalDigest: source.finalDigest,
    changes: source.changes.map((change) => ({ ...change })),
    excludedPathCount: source.excludedPaths.length,
    excludedPathSetDigest: canonicalDigest([...source.excludedPaths].sort()),
    applyState,
    applyJournalDigest: source.applyJournalDigest,
    applyDecision: applyDecision
      ? { receiptId: applyDecision.id, receiptDigest: canonicalDigest(applyDecision) }
      : undefined,
  }
}

function exactApplyConfirmation(
  current: PersistedArtifacts,
  resolved: ResolvedExecution,
): ManagedExecutionApplyConfirmation {
  if (current.record.state !== "review-required" || !current.evidence.staging) {
    throw new Error("Managed Run is not awaiting an exact staged apply decision")
  }
  const changedInventory = [...current.evidence.staging.changes].sort((left, right) => left.path.localeCompare(right.path))
  return {
    decision: "apply-exact-reviewed-inventory",
    reviewEvidenceId: current.evidence.id,
    reviewEvidenceDigest: canonicalDigest(current.evidence) as `sha256:${string}`,
    changedInventoryDigest: canonicalDigest(changedInventory) as `sha256:${string}`,
    writeEnvelope: [...resolved.writeEnvelope],
    writeEnvelopeDigest: canonicalDigest(resolved.writeEnvelope) as `sha256:${string}`,
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
  private readonly pendingReviews = new Map<string, ManagedExecutionReview>()
  private readonly rehydratingReviews = new Map<string, Promise<ManagedExecutionReview | undefined>>()
  private readonly failedReviewClaims = new Map<string, string>()
  private readonly resumeSources = new Map<string, ResumeSource>()
  private readonly journals = new Map<string, JournalBinding>()

  constructor(
    private readonly workspacePath: string,
    private readonly repository: GaepRepository,
    private readonly productStudio: ProductStudioService,
    private readonly adapters: Map<string, AgentAdapter>,
    private readonly stageRegistry: ManagedStageRegistry = new ManagedStageRegistry(),
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

  async readApplyDecision(id: string): Promise<ManagedApplyDecisionReceipt> {
    const receiptId = managedApplyDecisionReceiptSchema.shape.id.parse(id)
    return this.repository.readJson(this.applyDecisionPath(receiptId), managedApplyDecisionReceiptSchema)
  }

  async readCurrentArtifacts(managedRunId: string): Promise<PersistedArtifacts> {
    const record = await this.read(managedRunId)
    if (!record.resultId || !record.resultDigest) throw new Error("Managed Run has no committed result")
    const result = await this.readResult(record.resultId)
    if (canonicalDigest(result) !== record.resultDigest) throw new Error("Managed Run result binding is invalid")
    const evidence = await this.readEvidence(result.evidenceId)
    if (canonicalDigest(evidence) !== result.evidenceDigest) throw new Error("Managed Run evidence binding is invalid")
    return { record, result, evidence }
  }

  getPendingReview(managedRunId: string): ManagedExecutionReview | undefined {
    return this.pendingReviews.get(managedRunId)
  }

  async pendingReviewStatus(managedRunId: string): Promise<ManagedPendingReviewStatus> {
    const record = await this.read(managedRunId)
    const retainedJournalDigest = await this.stageRegistry.retainedJournalDigest(record.id)
    if (retainedJournalDigest) {
      this.journals.set(record.id, { digest: retainedJournalDigest, disposed: false })
    }
    let review = this.pendingReviews.get(record.id)
    if (review && (review.record.revision !== record.revision || review.record.state !== record.state)) {
      this.pendingReviews.delete(record.id)
      review = undefined
    }
    if (!review && this.failedReviewClaims.has(record.id)) {
      return {
        managedRunId: record.id,
        state: record.state,
        canApply: false,
        canDiscard: record.state === "review-required",
        hasLocalJournal: retainedJournalDigest !== undefined,
      }
    }
    review ??= await this.ensurePendingReview(record.id)
    return {
      managedRunId: record.id,
      state: record.state,
      canApply: review?.canApply ?? false,
      canDiscard: review?.canDiscard ?? ["review-required", "conflict"].includes(record.state),
      hasLocalJournal: review?.hasLocalJournal ?? retainedJournalDigest !== undefined,
      applyConfirmation: review?.applyConfirmation,
    }
  }

  async listPendingReviewStatuses(): Promise<ManagedPendingReviewStatus[]> {
    const durable = (await this.list())
      .filter((record) => ["review-required", "conflict"].includes(record.state))
      .map((record) => record.id)
    const ids = [...new Set([...this.pendingReviews.keys(), ...durable])].sort()
    return (await Promise.all(ids.map((id) => this.pendingReviewStatus(id))))
      .filter((status) => ["review-required", "conflict"].includes(status.state))
  }

  async applyPendingReview(
    managedRunId: string,
    input: ManagedExecutionApplyInput,
    actorId: string,
  ): Promise<ManagedExecutionReview> {
    if (this.failedReviewClaims.has(managedRunId)) {
      throw new Error("Managed Run durable review failed exact revalidation and can only be discarded")
    }
    let review = this.pendingReviews.get(managedRunId)
    if (review) {
      const durable = await this.read(managedRunId)
      if (review.record.revision !== durable.revision || review.record.state !== durable.state) {
        this.pendingReviews.delete(managedRunId)
        review = undefined
      }
    }
    review ??= await this.ensurePendingReview(managedRunId)
    if (!review) throw new Error("Managed Run has no recoverable pending staged review")
    const next = await review.apply(input, actorId)
    if (!next.canApply && !next.canDiscard) this.pendingReviews.delete(managedRunId)
    return next
  }

  async discardPendingReview(managedRunId: string, actorId: string): Promise<ManagedExecutionReview> {
    if (this.failedReviewClaims.has(managedRunId)) return this.discardDurableReview(managedRunId, actorId)
    let review = this.pendingReviews.get(managedRunId)
    if (review) {
      const durable = await this.read(managedRunId)
      if (review.record.revision !== durable.revision || review.record.state !== durable.state) {
        this.pendingReviews.delete(managedRunId)
        review = undefined
      }
    }
    try {
      review ??= await this.ensurePendingReview(managedRunId)
    } catch (error) {
      try {
        return await this.discardDurableReview(managedRunId, actorId)
      } catch {
        throw error
      }
    }
    if (!review) return this.discardDurableReview(managedRunId, actorId)
    const next = await review.discard(actorId)
    this.pendingReviews.delete(managedRunId)
    return next
  }

  private async ensurePendingReview(managedRunId: string): Promise<ManagedExecutionReview | undefined> {
    const existing = this.pendingReviews.get(managedRunId)
    if (existing) return existing
    const inFlight = this.rehydratingReviews.get(managedRunId)
    if (inFlight) return inFlight
    const rehydrating = this.rehydratePendingReview(managedRunId)
      .finally(() => this.rehydratingReviews.delete(managedRunId))
    this.rehydratingReviews.set(managedRunId, rehydrating)
    return rehydrating
  }

  private async rehydratePendingReview(managedRunId: string): Promise<ManagedExecutionReview | undefined> {
    const current = await this.readCurrentArtifacts(managedRunId)
    if (current.record.state !== "review-required") return undefined
    if (current.record.mode !== "codex-staged" || !current.evidence.staging ||
        current.evidence.staging.applyState !== "pending") {
      throw new Error("Managed Run durable review is not an exact pending Codex staged review")
    }
    const claim = await this.stageRegistry.claimReview(managedRunId)
    try {
      const manifest = claim.manifest
      const canonicalWorkspacePath = await realpath(this.workspacePath)
      if (manifest.managedRunId !== current.record.id || manifest.bindingsDigest !== current.record.bindingsDigest ||
          current.evidence.bindingsDigest !== current.record.bindingsDigest ||
          manifest.stage.stage.sourceRoot !== canonicalWorkspacePath ||
          manifest.provider.adapterId !== current.record.provider.adapterId ||
          manifest.provider.agentId !== current.record.provider.agentId ||
          manifest.provider.modelId !== current.record.provider.modelId ||
          manifest.provider.capabilityDigest !== current.record.provider.capabilityDigest ||
          manifest.terminalDisposition !== current.result.providerDisposition ||
          manifest.inspection.baselineDigest !== current.evidence.staging.baselineDigest ||
          manifest.inspection.finalDigest !== current.evidence.staging.finalDigest ||
          canonicalDigest(manifest.inspection.changes) !== canonicalDigest(current.evidence.staging.changes) ||
          manifest.inspection.excludedPaths.length !== current.evidence.staging.excludedPathCount ||
          canonicalDigest([...manifest.inspection.excludedPaths].sort()) !== current.evidence.staging.excludedPathSetDigest) {
        throw new Error("Managed stage review manifest does not match the exact governed Run and persisted review evidence")
      }
      const resolved = await this.resolveDurableReview(current)
      const initialResult: ManagedRuntimeResultEnvelope = {
        portable: {
          schemaVersion: 1,
          provider: {
            adapterId: manifest.provider.adapterId,
            agentId: manifest.provider.agentId,
            runtimeVersion: current.record.provider.runtimeVersion,
            capabilityDigest: manifest.provider.capabilityDigest,
          },
          events: [],
          staging: {
            baselineDigest: manifest.inspection.baselineDigest,
            finalDigest: manifest.inspection.finalDigest,
            changes: structuredClone(manifest.inspection.changes),
            excludedPaths: [...manifest.inspection.excludedPaths],
            applied: false,
          },
          terminalDisposition: manifest.terminalDisposition,
          warnings: [],
          postconditionStatus: current.result.outcome.status,
        },
        local: {},
      }
      const rehydrated = await rehydrateManagedCodexStageReview({
        claim,
        initialResult,
        stageRegistry: this.stageRegistry,
      })
      const unavailableGateEvaluator: ManagedWorkflowGateEvaluator = async () => {
        throw new Error("Restarted staged apply requires an explicit Workflow gate evaluator")
      }
      const completion: RuntimeCompletion = {
        runtime: initialResult,
        codexReview: rehydrated.review,
        stagingService: rehydrated.stagingService,
        terminationCause: current.result.terminationCause,
        workflow: structuredClone(current.evidence.workflow),
        gateEvaluator: unavailableGateEvaluator,
        persistedEventsDigest: current.evidence.eventsDigest as `sha256:${string}`,
        requiresWorkflowGateEvaluator: true,
      }
      const review = new ManagedExecutionReviewHandle(this, current, resolved, completion)
      this.syncPendingReview(review)
      return review
    } catch (error) {
      this.failedReviewClaims.set(managedRunId, claim.leaseToken)
      throw error
    }
  }

  private async resolveDurableReview(current: PersistedArtifacts): Promise<ResolvedExecution> {
    const { record } = current
    if (canonicalDigest(record.bindings) !== record.bindingsDigest) {
      throw new Error("Managed Run durable bindings digest is invalid")
    }
    const run = runSchema.parse(record.bindingSnapshots.run)
    const initiativeSnapshot = initiativeSchema.parse(record.bindingSnapshots.initiative)
    this.assertExactReference(record.bindings.run, run, "Managed Run snapshot")
    this.assertExactReference(record.bindings.initiative, initiativeSnapshot, "Managed Initiative snapshot")
    const [product, initiative, charter, workflowPlan, persistedRun, persistedSelection] = await Promise.all([
      this.repository.readJson(this.repository.resolve("product.json"), productSchema),
      this.repository.readJson(this.repository.resolve("initiatives", `${record.initiativeId}.json`), initiativeSchema),
      this.repository.readJson(
        this.repository.resolve("sessions", `charter-${record.bindings.charter.recordId}.json`),
        executionCharterSchema,
      ),
      this.productStudio.readWorkflowPlan(record.bindings.workflowPlan!.recordId),
      this.repository.readJson(this.runPath(record.runId), runSchema),
      this.repository.readJson(this.repository.resolve("runtime", "selection.json"), agentSelectionSchema),
    ])
    this.assertExactReference(record.bindings.product, product, "Managed Product")
    this.assertExactReference(record.bindings.initiative, initiative, "Managed Initiative")
    this.assertExactReference(record.bindings.charter, charter, "Managed Charter")
    this.assertExactReference(record.bindings.workflowPlan!, workflowPlan, "Managed Workflow Plan")
    if (canonicalDigest(initiativeSnapshot) !== canonicalDigest(initiative) || persistedRun.id !== run.id ||
        persistedRun.state !== "running" || persistedRun.productId !== run.productId ||
        persistedRun.initiativeId !== run.initiativeId || persistedRun.charterId !== run.charterId ||
        canonicalDigest(persistedRun.agent) !== canonicalDigest(run.agent) ||
        canonicalDigest(persistedSelection) !== record.bindings.agentSelectionDigest ||
        canonicalDigest(run.agent) !== record.bindings.agentSelectionDigest) {
      throw new Error("Managed Run durable review lineage or Agent Selection changed after staging")
    }
    const contextPacks = await Promise.all(record.bindings.contextPacks.map(async (binding) => {
      const pack = await this.productStudio.readContextPack(binding.recordId)
      this.assertExactReference(binding, pack, "Managed Context Pack")
      return pack
    }))
    const tools = await Promise.all(record.bindings.tools.map(async (binding) => {
      const tool = await this.productStudio.readToolDefinition(binding.recordId)
      this.assertExactReference(binding, tool, "Managed Tool Definition")
      return tool
    }))
    const toolSelection = record.bindings.runToolSelection
      ? await this.productStudio.readRunToolSelection(record.bindings.runToolSelection.recordId)
      : undefined
    if (toolSelection && record.bindings.runToolSelection) {
      this.assertExactReference(record.bindings.runToolSelection, toolSelection, "Managed Run Tool Selection")
    }
    const adapter = this.adapters.get(run.agent.adapterId)
    if (!adapter) throw new Error("Managed durable review Adapter is unavailable")
    const probe = await adapter.probe({ refreshModels: true })
    const capabilities = adapterCapabilitiesSchema.parse(probe.capabilities)
    if (capabilities.adapterId !== run.agent.adapterId || capabilities.agentId !== run.agent.agentId ||
        capabilityDigest(capabilities) !== run.agent.capabilityDigest) {
      throw new Error("Managed durable review Agent capabilities changed after staging")
    }
    this.assertRuntimeBinding(probe.runtimeBinding, run)
    const mode = this.modeFor(adapter, probe.runtimeBinding)
    if (mode !== "codex-staged" || record.mode !== mode) throw new Error("Managed durable review execution mode changed")
    this.assertModeEnvelope(mode, charter, contextPacks, tools)
    const orderedSteps = this.assertWorkflowExecutable(workflowPlan, run, charter, contextPacks, tools, mode)
    const writeEnvelope = this.compileWriteEnvelope(workflowPlan, charter)
    compileManagedCodexPolicy(charter, tools, writeEnvelope)
    return {
      run,
      initiative,
      charter,
      workflowPlan,
      contextPacks,
      toolSelection,
      tools,
      bindings: record.bindings,
      mode,
      adapter,
      probe,
      orderedSteps,
      writeEnvelope,
    }
  }

  private async discardDurableReview(managedRunId: string, actorId: string): Promise<ManagedExecutionReview> {
    const current = await this.readCurrentArtifacts(managedRunId)
    if (!["review-required", "conflict"].includes(current.record.state) || !current.evidence.staging) {
      throw new Error("Managed Run has no durable staged review to discard")
    }
    const failedClaimLease = this.failedReviewClaims.get(current.record.id)
    const now = new Date().toISOString()
    const evidence = managedRunEvidenceSchema.parse({
      ...current.evidence,
      id: randomUUID(),
      workflow: this.discardedWorkflow(current.evidence.workflow),
      staging: { ...current.evidence.staging, applyState: "discarded" },
      actualEffects: current.evidence.actualEffects.map((effect) => ({
        ...effect,
        status: current.record.state === "review-required" ? "blocked" as const : "unknown" as const,
        evidenceDigest: canonicalDigest({
          priorEvidenceDigest: canonicalDigest(current.evidence),
          effect: effect.effect,
          disposition: "durable-review-discarded",
        }),
      })),
      capturedAt: now,
    })
    const result = managedRunResultSchema.parse({
      ...current.result,
      id: randomUUID(),
      evidenceId: evidence.id,
      evidenceDigest: canonicalDigest(evidence),
      previousResultId: current.result.id,
      previousResultDigest: canonicalDigest(current.result),
      outcome: { status: "not-assessed", basis: "not-evaluated" },
      terminalState: "discarded",
      // Portable terminal authority is committed before best-effort machine-local
      // finalization, so the durable result remains conservative even when a
      // cleanup/probe fault happens after this commit.
      warnings: [...new Set([...current.result.warnings, "local-cleanup-pending" as const])],
      endedAt: now,
    })
    const persisted = await this.commitArtifacts(current.record, result, evidence, actorId)
    if (current.record.state === "review-required") {
      await this.stageRegistry.discardReview(
        current.record.id,
        failedClaimLease,
        { terminalAuthorized: true },
      ).catch(() => undefined)
      this.failedReviewClaims.delete(current.record.id)
      await this.stageRegistry.completeDiscard(current.record.id).catch(() => undefined)
    } else {
      await this.stageRegistry.recover(current.record.id).catch(() => undefined)
    }
    const retainedJournalDigest = await this.stageRegistry.retainedJournalDigest(current.record.id).catch(() => undefined)
    if (retainedJournalDigest) {
      this.journals.set(current.record.id, { digest: retainedJournalDigest, disposed: false })
    }
    return new FinalManagedExecutionReview(this, persisted)
  }

  syncPendingReview(review: ManagedExecutionReview): void {
    if (review.canApply || review.canDiscard) this.pendingReviews.set(review.record.id, review)
    else this.pendingReviews.delete(review.record.id)
  }

  async start(input: ManagedExecutionStartInput, actorId: string): Promise<ManagedExecutionHandle> {
    const resolved = await this.resolve(input)
    if (!input.evaluateWorkflowGate) {
      throw new Error("Managed execution requires an explicit Workflow gate evaluator; natural-language gates are never treated as machine-proven")
    }
    const now = new Date().toISOString()
    const managedRunId = randomUUID()
    const managedRun = managedRunRecordSchema.parse({
      schemaVersion: 2,
      kind: "managed-run",
      id: managedRunId,
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
      rootManagedRunId: resolved.previousManagedRun?.rootManagedRunId ?? managedRunId,
      attemptNumber: resolved.previousManagedRun ? resolved.previousManagedRun.attemptNumber + 1 : 1,
      previousManagedRunId: input.previousManagedRunId,
      recovery: { status: "not-required" },
      createdAt: now,
      updatedAt: now,
    })

    await this.persistPrepared(managedRun, resolved, actorId)
    const running = await this.transitionToRunning(managedRun, resolved.run, actorId)

    let runtime: RuntimeHandle
    try {
      runtime = await this.launch(resolved, input, managedRun.id, actorId)
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
        const latest = await this.read(managedRun.id)
        const persisted = await this.persistRuntimeResult(
          latest,
          resolved,
          completed.runtime,
          completed.workflow,
          initialState,
          completed.terminationCause,
          completed.codexReview ? "pending" : undefined,
          completed.runtime.portable.postconditionStatus === "satisfied"
            ? "deterministic-offline-runtime"
            : completed.runtime.portable.terminalDisposition === "completed"
              ? "not-evaluated"
              : "provider-failure",
          completed.evidenceEvents,
          actorId,
        )
        const providerThreadId = completed.runtime.portable.providerThreadId
        if (providerThreadId && resolved.probe.capabilities.supportsResume) {
          this.resumeSources.set(managedRun.id, { mode: resolved.mode, providerThreadId, runId: managedRun.runId })
        }
        const review = new ManagedExecutionReviewHandle(
          this,
          persisted,
          resolved,
          completed,
        )
        if (review.canApply || review.canDiscard) this.pendingReviews.set(managedRun.id, review)
        return review
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
    const records = await this.list()
    let firstRecoveryFailure: unknown
    for (const record of records.filter((candidate) => candidate.state === "discarded")) {
      try {
        const current = await this.readCurrentArtifacts(record.id)
        if (current.evidence.staging?.applyJournalDigest) {
          const localRecovery = await this.stageRegistry.recover(record.id)
          if (localRecovery.status === "quarantined" && localRecovery.journalDigest) {
            this.journals.set(record.id, { digest: localRecovery.journalDigest, disposed: false })
          }
        } else {
          await this.stageRegistry.discardReview(record.id, undefined, { terminalAuthorized: true })
          await this.stageRegistry.completeDiscard(record.id)
        }
      } catch (error) {
        firstRecoveryFailure ??= error
      }
    }
    const interrupted = records.filter((record) =>
      ["prepared", "running", "applying"].includes(record.state) &&
        !this.active.has(record.id) && !this.pendingReviews.has(record.id),
    )
    const recovered: ManagedRunRecord[] = []
    for (const record of interrupted) {
      const now = new Date().toISOString()
      const boundPlan = record.bindings.workflowPlan
        ? await this.productStudio.readWorkflowPlan(record.bindings.workflowPlan.recordId)
        : undefined
      if (!boundPlan || canonicalDigest(boundPlan) !== record.bindings.workflowPlan?.digest) {
        throw new Error("Interrupted Managed Run has no intact exact Workflow Plan binding")
      }
      const boundCharter = await this.repository.readJson(
        this.repository.resolve("sessions", `charter-${record.bindings.charter.recordId}.json`),
        executionCharterSchema,
      )
      if (canonicalDigest(boundCharter) !== record.bindings.charter.digest) {
        throw new Error("Interrupted Managed Run has no intact exact Charter binding")
      }
      const orderedSteps = compileManagedWorkflowOrder(boundPlan)
      const checkpointEvidence = (await this.readWorkflowCheckpointChain(record, orderedSteps, boundPlan.strategy)).at(-1)
      const recoveryWorkflow = checkpointEvidence
        ? managedWorkflowExecutionSchema.parse({
            ...checkpointEvidence.workflow,
            terminalReasonCode: "process-loss",
          })
        : managedWorkflowExecutionSchema.parse({
            plan: record.bindings.workflowPlan,
            strategy: boundPlan.strategy,
            orderedStepIds: orderedSteps.map((step) => step.id),
            attempts: [],
            completedStepIds: [],
            charterGates: {
              requiredEvidence: this.notAssessedGate("charter-evidence", boundCharter.requiredEvidence),
              stopConditions: this.notAssessedGate("charter-stop-conditions", boundCharter.stopConditions),
            },
            terminalReasonCode: "process-loss",
            capabilityBoundary: "natural-language-gates-require-explicit-human-or-system-assessment",
          })
      let localRecoveryWarning: ManagedRunResult["warnings"][number] | undefined
      let localRecoveryStatus: "cleaned" | "quarantined" = "cleaned"
      let localJournalDigest: `sha256:${string}` | undefined
      try {
        const localRecovery = await this.stageRegistry.recover(record.id, {
          preserveReview: record.state === "applying",
        })
        if (localRecovery.status === "review-restored") {
          if (record.state !== "applying") {
            throw new Error("Managed stage review restoration is inconsistent with portable execution state")
          }
          await this.restorePortableReviewAfterPreJournalFailure(record, actorId)
          recovered.push(await this.read(record.id))
          continue
        }
        if (localRecovery.status === "quarantined") {
          localRecoveryStatus = "quarantined"
          localRecoveryWarning = "local-cleanup-pending"
          localJournalDigest = localRecovery.journalDigest
          if (localJournalDigest) {
            this.journals.set(record.id, { digest: localJournalDigest, disposed: false })
          }
        }
      } catch (error) {
        // A live owner, lock contention, or cleanup fault is retryable. Do not
        // terminalize portable truth while machine-local recovery is incomplete.
        if (!(error instanceof ManagedStageRecoveryError &&
            ["stage-active", "lock-timeout"].includes(error.reasonCode))) {
          firstRecoveryFailure ??= error
        }
        continue
      }
      let recoveryStaging: ManagedRunEvidence["staging"]
      if (record.state === "applying" && localRecoveryStatus === "quarantined" && localJournalDigest &&
          record.applyDecisionId && record.applyDecisionDigest) {
        const prior = await this.readCurrentArtifacts(record.id)
        const receipt = await this.readApplyDecision(record.applyDecisionId)
        if (canonicalDigest(receipt) !== record.applyDecisionDigest) {
          throw new Error("Interrupted Managed Run apply-decision binding is invalid")
        }
        if (prior.evidence.staging) {
          recoveryStaging = {
            ...prior.evidence.staging,
            applyState: "conflict",
            applyJournalDigest: localJournalDigest,
            applyDecision: { receiptId: receipt.id, receiptDigest: canonicalDigest(receipt) },
          }
        }
      }
      const recoveryEffectsSeed = canonicalDigest({
        managedRunId: record.id,
        priorState: record.state,
        localRecoveryStatus,
        localJournalDigest,
      })
      const actualEffects = [...new Set(boundCharter.expectedEffects)].map((effect) => ({
        effect,
        status: record.state === "prepared" ? "blocked" as const : "unknown" as const,
        evidenceDigest: canonicalDigest({ recoveryEffectsSeed, effect }),
      }))
      const evidence = managedRunEvidenceSchema.parse({
        schemaVersion: 2,
        kind: "managed-run-evidence",
        id: randomUUID(),
        managedRunId: record.id,
        runId: record.runId,
        productId: record.productId,
        bindingsDigest: record.bindingsDigest,
        events: checkpointEvidence?.events ?? [],
        eventsDigest: canonicalDigest(checkpointEvidence?.events ?? []),
        workflow: recoveryWorkflow,
        staging: recoveryStaging,
        actualEffects,
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
        previousResultId: record.resultId,
        previousResultDigest: record.resultDigest,
        warnings: localRecoveryWarning ? [localRecoveryWarning] : [],
        startedAt: record.startedAt ?? record.updatedAt,
        endedAt: now,
        authorityBoundary: "provider-completion-does-not-equal-outcome-completion",
      })
      const observationRestartAvailable = !checkpointEvidence && record.state === "running" &&
        record.mode !== "codex-staged" && orderedSteps.length > 1 &&
        boundCharter.expectedEffects.length === 1 && boundCharter.expectedEffects[0] === "observe" &&
        localRecoveryStatus === "cleaned"
      const next = managedRunRecordSchema.parse({
        ...record,
        revision: record.revision + 1,
        state: "unknown",
        resultId: result.id,
        resultDigest: canonicalDigest(result),
        recovery: {
          status: checkpointEvidence || observationRestartAvailable ? "recovered" : "resume-unavailable",
          reasonCode: checkpointEvidence
            ? "workflow-checkpoint-preserved"
            : observationRestartAvailable
              ? "observation-restart-from-beginning"
            : localRecoveryStatus === "quarantined"
              ? "local-apply-journal-quarantined"
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
              workflowCheckpointPreserved: checkpointEvidence !== undefined,
              machineLocalDataPersisted: false,
            },
          },
        })
      })
      recovered.push(next)
    }
    if (firstRecoveryFailure) throw firstRecoveryFailure
    return recovered
  }

  private async resolve(input: ManagedExecutionStartInput): Promise<ResolvedExecution> {
    const runId = runSchema.shape.id.parse(input.runId)
    const workflowPlanId = workflowPlanSchema.shape.id.parse(input.workflowPlanId)
    const run = await this.repository.readJson(this.runPath(runId), runSchema)
    let previousManagedRun: ManagedRunRecord | undefined
    if (input.previousManagedRunId) {
      const previous = await this.read(input.previousManagedRunId)
      previousManagedRun = previous
      if (previous.runId !== run.id || previous.state !== "unknown") {
        throw new Error("Managed resume requires an unknown prior Managed Run for the same Run")
      }
      if ((await this.list()).some((candidate) => candidate.previousManagedRunId === previous.id)) {
        throw new Error("Managed resume lineage already has a successor; branching is forbidden")
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
    await Promise.all(contextPacks.map((pack) =>
      this.productStudio.assertContextPackExecutionAuthority(pack, run.agent.agentId)))
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
    const orderedSteps = this.assertWorkflowExecutable(workflowPlan, run, charter, contextPacks, workflowTools, mode)
    const writeEnvelope = this.compileWriteEnvelope(workflowPlan, charter)
    if (mode === "codex-staged") {
      compileManagedCodexPolicy(charter, workflowTools, writeEnvelope)
    }
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
    let providerResume: ResumeSource | undefined
    let workflowResume: DurableWorkflowResume | undefined
    if (previousManagedRun) {
      this.assertStableResumeBindings(previousManagedRun, bindings, mode)
      if (orderedSteps.length === 1) {
        providerResume = this.resumeSources.get(previousManagedRun.id)
        if (!providerResume || providerResume.runId !== run.id) {
          throw new Error("Managed resume is unavailable because its machine-local provider binding was not retained")
        }
      } else {
        if (mode === "codex-staged") {
          throw new Error("Managed provider resume supports exactly one Workflow Step; effectful multi-step checkpoint recovery is not implemented and fails closed")
        }
        workflowResume = await this.resolveDurableWorkflowResume(previousManagedRun, orderedSteps, workflowPlan.strategy)
      }
    }
    return {
      run,
      initiative,
      charter,
      workflowPlan,
      contextPacks,
      toolSelection,
      tools,
      bindings,
      mode,
      adapter,
      probe,
      orderedSteps,
      writeEnvelope,
      previousManagedRun,
      providerResume,
      workflowResume,
    }
  }

  private assertStableResumeBindings(
    previous: ManagedRunRecord,
    current: ManagedRunBindings,
    mode: ManagedExecutionMode,
  ): void {
    if (canonicalDigest(previous.bindings) !== previous.bindingsDigest || previous.mode !== mode) {
      throw new Error("Managed resume prior bindings or execution mode are invalid")
    }
    const stablePrevious = {
      ...previous.bindings,
      run: { ...previous.bindings.run, revision: 0, digest: "run-state-excluded" },
    }
    const stableCurrent = {
      ...current,
      run: { ...current.run, revision: 0, digest: "run-state-excluded" },
    }
    if (canonicalDigest(stablePrevious) !== canonicalDigest(stableCurrent) ||
        previous.bindingSnapshots.run.id !== current.run.recordId ||
        canonicalDigest(previous.bindingSnapshots.run.agent) !== current.agentSelectionDigest ||
        previous.provider.adapterId !== previous.bindingSnapshots.run.agent.adapterId ||
        previous.provider.agentId !== previous.bindingSnapshots.run.agent.agentId ||
        previous.provider.modelId !== previous.bindingSnapshots.run.agent.modelId ||
        previous.provider.capabilityDigest !== previous.bindingSnapshots.run.agent.capabilityDigest) {
      throw new Error("Managed resume governed bindings changed after the prior attempt")
    }
  }

  private async resolveDurableWorkflowResume(
    previous: ManagedRunRecord,
    orderedSteps: readonly WorkflowStep[],
    strategy: WorkflowPlan["strategy"],
  ): Promise<DurableWorkflowResume> {
    const checkpoint = previous.workflowCheckpoints?.at(-1)
    if (!checkpoint) {
      const current = await this.readCurrentArtifacts(previous.id)
      if (current.result.terminationCause !== "process-loss" ||
          current.evidence.workflow.attempts.length > 0 ||
          current.evidence.workflow.completedStepIds.length > 0 ||
          current.evidence.events.length > 0) {
        throw new Error("Managed multi-step resume has no durable Workflow checkpoint")
      }
      this.assertWorkflowResumeShape(current.evidence, previous, orderedSteps, strategy, 0, false)
      return {
        workflow: structuredClone(current.evidence.workflow),
        events: [],
        nextStepIndex: 0,
      }
    }
    const evidence = (await this.readWorkflowCheckpointChain(previous, orderedSteps, strategy)).at(-1)!
    return {
      workflow: structuredClone(evidence.workflow),
      events: structuredClone(evidence.events),
      nextStepIndex: checkpoint.nextStepIndex,
    }
  }

  private async readWorkflowCheckpointChain(
    record: ManagedRunRecord,
    orderedSteps: readonly WorkflowStep[],
    strategy: WorkflowPlan["strategy"],
  ): Promise<ManagedRunEvidence[]> {
    const evidenceChain: ManagedRunEvidence[] = []
    for (const checkpoint of record.workflowCheckpoints ?? []) {
      const evidence = await this.readEvidence(checkpoint.evidenceId)
      if (canonicalDigest(evidence) !== checkpoint.evidenceDigest ||
          canonicalDigest(evidence.workflow.completedStepIds) !== checkpoint.completedStepIdsDigest) {
        throw new Error("Managed Workflow checkpoint binding is invalid")
      }
      this.assertWorkflowResumeShape(evidence, record, orderedSteps, strategy, checkpoint.nextStepIndex, true)
      evidenceChain.push(evidence)
    }
    return evidenceChain
  }

  private assertWorkflowResumeShape(
    evidence: ManagedRunEvidence,
    previous: ManagedRunRecord,
    orderedSteps: readonly WorkflowStep[],
    strategy: WorkflowPlan["strategy"],
    nextStepIndex: number,
    checkpoint: boolean,
  ): void {
    const orderedStepIds = orderedSteps.map((step) => step.id)
    const expectedCompleted = orderedStepIds.slice(0, nextStepIndex)
    if (evidence.managedRunId !== previous.id || evidence.runId !== previous.runId ||
        evidence.productId !== previous.productId || evidence.bindingsDigest !== previous.bindingsDigest ||
        canonicalDigest(evidence.events) !== evidence.eventsDigest || evidence.staging ||
        canonicalDigest(evidence.workflow.plan) !== canonicalDigest(previous.bindings.workflowPlan) ||
        evidence.workflow.strategy !== strategy ||
        canonicalDigest(evidence.workflow.orderedStepIds) !== canonicalDigest(orderedStepIds) ||
        canonicalDigest(evidence.workflow.completedStepIds) !== canonicalDigest(expectedCompleted) ||
        evidence.workflow.terminalReasonCode !== (checkpoint ? "workflow-checkpoint" : "process-loss") ||
        evidence.workflow.charterGates.requiredEvidence.status !== "not-assessed" ||
        evidence.workflow.charterGates.stopConditions.status !== "not-assessed" ||
        evidence.actualEffects.length !== 1 || evidence.actualEffects[0]?.effect !== "observe" ||
        (checkpoint
          ? evidence.actualEffects[0]?.status !== "observed-provisional"
          : !["unknown", "blocked"].includes(evidence.actualEffects[0]?.status ?? ""))) {
      throw new Error("Managed Workflow checkpoint evidence is inconsistent with the exact prior execution")
    }
    if (checkpoint && (nextStepIndex < 1 || nextStepIndex >= orderedSteps.length)) {
      throw new Error("Managed Workflow checkpoint next-step boundary is invalid")
    }
    if (checkpoint && strategy === "parallel-readonly") {
      const batches = compileManagedWorkflowBatches({ strategy, steps: [...orderedSteps] } as WorkflowPlan)
      const boundaries = new Set<number>()
      let boundary = 0
      for (const batch of batches.slice(0, -1)) {
        boundary += batch.length
        boundaries.add(boundary)
      }
      if (!boundaries.has(nextStepIndex)) {
        throw new Error("Managed parallel-readonly checkpoint does not end at a bounded batch boundary")
      }
    }
    for (const attempt of evidence.workflow.attempts) {
      const step = orderedSteps[attempt.stepIndex]
      if (!step || attempt.stepId !== step.id || attempt.stepIndex >= nextStepIndex ||
          canonicalDigest(attempt.dependencies) !== canonicalDigest(step.dependsOn) ||
          canonicalDigest(attempt.contextPacks) !== canonicalDigest(step.contextPacks) ||
          canonicalDigest(attempt.tools) !== canonicalDigest(step.toolDefinitions) ||
          canonicalDigest(attempt.effectEnvelope) !== canonicalDigest(step.effectEnvelope) ||
          attempt.gates.preconditions.criteriaDigest !== canonicalDigest(step.preconditions) ||
          attempt.gates.outputs.criteriaDigest !== canonicalDigest(step.outputs) ||
          attempt.gates.evidence.criteriaDigest !== canonicalDigest(step.evidenceCriteria) ||
          attempt.gates.stopConditions.criteriaDigest !== canonicalDigest(step.stopConditions) ||
          (attempt.eventRange && attempt.eventRange.endSequence >= evidence.events.length)) {
        throw new Error("Managed Workflow checkpoint attempt evidence exceeds its completed prefix")
      }
    }
  }

  private async persistPrepared(record: ManagedRunRecord, resolved: ResolvedExecution, actorId: string): Promise<void> {
    await this.repository.withLock(async () => {
      await this.assertBindingsCurrent(resolved)
      if ((await this.list()).some((candidate) =>
        candidate.runId === record.runId && !managedTerminalStates.has(candidate.state))) {
        throw new Error("The Run already has a non-terminal Managed Run")
      }
      const currentRun = await this.repository.readJson(this.runPath(resolved.run.id), runSchema)
      if (canonicalDigest(currentRun) !== resolved.bindings.run.digest) {
        throw new Error("Run changed before Managed Run preparation")
      }
      if (record.previousManagedRunId && (await this.list()).some((candidate) =>
        candidate.previousManagedRunId === record.previousManagedRunId)) {
        throw new Error("Managed resume lineage already has a successor; branching is forbidden")
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
    actorId: string,
  ): Promise<RuntimeHandle> {
    if (resolved.workflowPlan.strategy === "parallel-readonly") {
      return this.launchParallelReadOnly(resolved, input, managedRunId, actorId)
    }
    const evaluator = input.evaluateWorkflowGate!
    const queue = new BoundedAsyncQueue<ManagedRuntimeEvent>(4_096, 16 * 1024 * 1024)
    const collectedEvents: ManagedRuntimeEvent[] = []
    const attempts: ManagedWorkflowStepAttempt[] = structuredClone(resolved.workflowResume?.workflow.attempts ?? [])
    const completedStepIds: string[] = [...(resolved.workflowResume?.workflow.completedStepIds ?? [])]
    let activeStep: StepRuntimeHandle | undefined
    let cancellationRequested = false
    const cancellation = new AbortController()
    let releaseBackoff: (() => void) | undefined
    let sequence = resolved.workflowResume?.events.length ?? 0
    let charterGates = this.unassessedCharterGates(resolved)
    let finalStepDeadlineAt: number | undefined
    let controlledAttempt: {
      step: WorkflowStep
      stepIndex: number
      attempt: number
      startedAt: string
      eventStart: number
      eventEnd?: number
      preconditions: ManagedWorkflowGateAssessment
      outputs: ManagedWorkflowGateAssessment
      evidence: ManagedWorkflowGateAssessment
      stopConditions: ManagedWorkflowGateAssessment
      providerDisposition?: ManagedRunResult["providerDisposition"]
      postconditionStatus: ManagedRunResult["outcome"]["status"]
    } | undefined

    const completion = (async (): Promise<RuntimeCompletion> => {
      let last = this.syntheticStepCompletion(resolved, "failed", "provider-failure")
      let terminalReasonCode = "workflow-not-started"
      try {
        for (const [stepIndex, step] of resolved.orderedSteps.entries()) {
          if (stepIndex < (resolved.workflowResume?.nextStepIndex ?? 0)) continue
          if (step.dependsOn.some((dependency) => !completedStepIds.includes(dependency))) {
            throw new Error(`Workflow Step ${step.id} dependency completion invariant failed`)
          }
          let stepCompleted = false
          for (let attemptNumber = 1; attemptNumber <= step.retry.maxAttempts; attemptNumber += 1) {
            if (cancellationRequested) {
              return this.workflowCompletion(
                this.syntheticStepCompletion(resolved, "cancelled", "cancel-request"),
                resolved,
                attempts,
                completedStepIds,
                "cancel-requested",
                evaluator,
                collectedEvents,
              )
            }
            const startedAt = new Date().toISOString()
            const configuredTimeoutMs = step.timeoutMs === undefined
              ? input.timeoutMs
              : input.timeoutMs === undefined
                ? step.timeoutMs
                : Math.min(step.timeoutMs, input.timeoutMs)
            const deadlineAt = configuredTimeoutMs === undefined ? undefined : Date.now() + configuredTimeoutMs
            finalStepDeadlineAt = deadlineAt
            controlledAttempt = {
              step,
              stepIndex,
              attempt: attemptNumber,
              startedAt,
              eventStart: sequence,
              preconditions: this.notAssessedGate("preconditions", step.preconditions),
              outputs: this.notAssessedGate("outputs", step.outputs),
              evidence: this.notAssessedGate("evidence", step.evidenceCriteria),
              stopConditions: this.notAssessedGate("stop-conditions", step.stopConditions),
              postconditionStatus: "not-assessed",
            }
            const preconditions = await this.assessWorkflowGate({
              evaluator,
              managedRunId,
              runId: resolved.run.id,
              step,
              stepIndex,
              attempt: attemptNumber,
              phase: "preconditions",
              criteria: step.preconditions,
              completedStepIds,
              actorId,
              deadlineAt,
              signal: cancellation.signal,
            })
            controlledAttempt.preconditions = preconditions
            if (cancellationRequested) {
              throw new WorkflowControlError("cancel-request")
            }
            if (preconditions.status !== "satisfied") {
              const endedAt = new Date().toISOString()
              attempts.push(managedWorkflowStepAttemptSchema.parse({
                id: randomUUID(),
                revision: 1,
                stepId: step.id,
                stepIndex,
                attempt: attemptNumber,
                state: "blocked",
                dependencies: step.dependsOn,
                contextPacks: step.contextPacks.map((binding) => resolved.bindings.contextPacks.find((candidate) => candidate.recordId === binding.recordId)!),
                tools: step.toolDefinitions.map((binding) => resolved.bindings.tools.find((candidate) => candidate.recordId === binding.recordId)!),
                effectEnvelope: step.effectEnvelope,
                postconditionStatus: "not-assessed",
                retryReasonCode: "precondition-gate-blocked",
                gates: {
                  preconditions,
                  outputs: this.notAssessedGate("outputs", step.outputs),
                  evidence: this.notAssessedGate("evidence", step.evidenceCriteria),
                  stopConditions: this.notAssessedGate("stop-conditions", step.stopConditions),
                },
                startedAt,
                endedAt,
              }))
              controlledAttempt = undefined
              terminalReasonCode = "precondition-gate-blocked"
              return this.workflowCompletion(last, resolved, attempts, completedStepIds, terminalReasonCode, evaluator, collectedEvents)
            }

            activeStep = await this.launchStep(
              resolved,
              input,
              managedRunId,
              step,
              stepIndex === 0 && attemptNumber === 1,
              deadlineAt,
            )
            if (cancellationRequested) await activeStep.cancel("Managed Run cancellation requested before provider handoff")
            const eventStart = sequence
            const drain = (async (): Promise<void> => {
              for await (const event of activeStep!.events) {
                const normalized = { ...event, sequence: sequence++ }
                collectedEvents.push(normalized)
                queue.push(normalized)
              }
            })()
            last = await activeStep.completion
            await drain
            activeStep = undefined
            const eventEnd = sequence - 1
            const disposition = last.runtime.portable.terminalDisposition
            const postconditionStatus = last.runtime.portable.postconditionStatus
            controlledAttempt.eventEnd = eventEnd
            controlledAttempt.providerDisposition = disposition
            controlledAttempt.postconditionStatus = postconditionStatus

            if (last.terminationCause === "timeout" || last.terminationCause === "cancel-request" || cancellationRequested) {
              const terminationCause = last.terminationCause === "timeout" ? "timeout" : "cancel-request"
              attempts.push(managedWorkflowStepAttemptSchema.parse({
                id: randomUUID(),
                revision: 1,
                stepId: step.id,
                stepIndex,
                attempt: attemptNumber,
                state: terminationCause === "timeout" ? "timed-out" : "cancelled",
                dependencies: step.dependsOn,
                contextPacks: step.contextPacks.map((binding) => resolved.bindings.contextPacks.find((candidate) => candidate.recordId === binding.recordId)!),
                tools: step.toolDefinitions.map((binding) => resolved.bindings.tools.find((candidate) => candidate.recordId === binding.recordId)!),
                effectEnvelope: step.effectEnvelope,
                eventRange: eventEnd >= eventStart ? { startSequence: eventStart, endSequence: eventEnd } : undefined,
                providerDisposition: disposition,
                terminationCause,
                postconditionStatus,
                retryReasonCode: terminationCause === "timeout" ? "step-timeout" : "cancel-requested",
                gates: {
                  preconditions,
                  outputs: controlledAttempt.outputs,
                  evidence: controlledAttempt.evidence,
                  stopConditions: controlledAttempt.stopConditions,
                },
                startedAt,
                endedAt: new Date().toISOString(),
              }))
              controlledAttempt = undefined
              terminalReasonCode = terminationCause === "timeout" ? "step-timeout" : "cancel-requested"
              return this.workflowCompletion(last, resolved, attempts, completedStepIds, terminalReasonCode, evaluator, collectedEvents)
            }

            if (last.codexReview) {
              attempts.push(managedWorkflowStepAttemptSchema.parse({
                id: randomUUID(),
                revision: 1,
                stepId: step.id,
                stepIndex,
                attempt: attemptNumber,
                state: "review-required",
                dependencies: step.dependsOn,
                contextPacks: step.contextPacks.map((binding) => resolved.bindings.contextPacks.find((candidate) => candidate.recordId === binding.recordId)!),
                tools: step.toolDefinitions.map((binding) => resolved.bindings.tools.find((candidate) => candidate.recordId === binding.recordId)!),
                effectEnvelope: step.effectEnvelope,
                eventRange: eventEnd >= eventStart ? { startSequence: eventStart, endSequence: eventEnd } : undefined,
                providerDisposition: disposition,
                terminationCause: last.terminationCause,
                postconditionStatus,
                gates: {
                  preconditions,
                  outputs: this.notAssessedGate("outputs", step.outputs),
                  evidence: this.notAssessedGate("evidence", step.evidenceCriteria),
                  stopConditions: this.notAssessedGate("stop-conditions", step.stopConditions),
                },
                startedAt,
                endedAt: new Date().toISOString(),
              }))
              terminalReasonCode = "apply-review-required"
              controlledAttempt = undefined
              return this.workflowCompletion(last, resolved, attempts, completedStepIds, terminalReasonCode, evaluator, collectedEvents)
            }

            const eventsDigest = canonicalDigest(last.runtime.portable.events) as `sha256:${string}`
            const gateBase = {
              evaluator,
              managedRunId,
              runId: resolved.run.id,
              step,
              stepIndex,
              attempt: attemptNumber,
              completedStepIds,
              actorId,
              providerDisposition: disposition,
              postconditionStatus,
              eventsDigest,
              deadlineAt,
              signal: cancellation.signal,
            }
            let outputs = this.notAssessedGate("outputs", step.outputs)
            let evidence = this.notAssessedGate("evidence", step.evidenceCriteria)
            let stopConditions = this.notAssessedGate("stop-conditions", step.stopConditions)
            const cancelledDuringGates = (): RuntimeCompletion => {
              attempts.push(managedWorkflowStepAttemptSchema.parse({
                id: randomUUID(),
                revision: 1,
                stepId: step.id,
                stepIndex,
                attempt: attemptNumber,
                state: "cancelled",
                dependencies: step.dependsOn,
                contextPacks: step.contextPacks.map((binding) => resolved.bindings.contextPacks.find((candidate) => candidate.recordId === binding.recordId)!),
                tools: step.toolDefinitions.map((binding) => resolved.bindings.tools.find((candidate) => candidate.recordId === binding.recordId)!),
                effectEnvelope: step.effectEnvelope,
                eventRange: eventEnd >= eventStart ? { startSequence: eventStart, endSequence: eventEnd } : undefined,
                providerDisposition: disposition,
                terminationCause: "cancel-request",
                postconditionStatus,
                retryReasonCode: "cancel-requested-during-gate-assessment",
                gates: { preconditions, outputs, evidence, stopConditions },
                startedAt,
                endedAt: new Date().toISOString(),
              }))
              controlledAttempt = undefined
              return this.workflowCompletion(
                this.syntheticStepCompletion(resolved, "cancelled", "cancel-request"),
                resolved,
                attempts,
                completedStepIds,
                "cancel-requested",
                evaluator,
                collectedEvents,
              )
            }
            outputs = await this.assessWorkflowGate({ ...gateBase, phase: "outputs", criteria: step.outputs })
            controlledAttempt.outputs = outputs
            if (cancellationRequested) return cancelledDuringGates()
            evidence = await this.assessWorkflowGate({ ...gateBase, phase: "evidence", criteria: step.evidenceCriteria })
            controlledAttempt.evidence = evidence
            if (cancellationRequested) return cancelledDuringGates()
            stopConditions = await this.assessWorkflowGate({ ...gateBase, phase: "stop-conditions", criteria: step.stopConditions })
            controlledAttempt.stopConditions = stopConditions
            if (cancellationRequested) return cancelledDuringGates()
            const completed = disposition === "completed" && postconditionStatus === "satisfied" &&
              outputs.status === "satisfied" && evidence.status === "satisfied" && stopConditions.status === "satisfied"
            const retryReasonCode = completed
              ? undefined
              : this.workflowRetryReason(disposition, postconditionStatus, outputs, evidence, stopConditions)
            const attemptState: ManagedWorkflowStepAttempt["state"] = completed
              ? "completed"
              : disposition === "unknown" || disposition === "interrupted"
                ? "unknown"
                : "failed"
            attempts.push(managedWorkflowStepAttemptSchema.parse({
              id: randomUUID(),
              revision: 1,
              stepId: step.id,
              stepIndex,
              attempt: attemptNumber,
              state: attemptState,
              dependencies: step.dependsOn,
              contextPacks: step.contextPacks.map((binding) => resolved.bindings.contextPacks.find((candidate) => candidate.recordId === binding.recordId)!),
              tools: step.toolDefinitions.map((binding) => resolved.bindings.tools.find((candidate) => candidate.recordId === binding.recordId)!),
              effectEnvelope: step.effectEnvelope,
              eventRange: eventEnd >= eventStart ? { startSequence: eventStart, endSequence: eventEnd } : undefined,
              providerDisposition: disposition,
              terminationCause: last.terminationCause,
              postconditionStatus,
              retryReasonCode,
              gates: { preconditions, outputs, evidence, stopConditions },
              startedAt,
              endedAt: new Date().toISOString(),
            }))
            controlledAttempt = undefined
            if (completed) {
              completedStepIds.push(step.id)
              stepCompleted = true
              break
            }
            terminalReasonCode = retryReasonCode ?? "workflow-step-failed"
            if (!this.shouldRetryWorkflowStep(step, attemptNumber, terminalReasonCode, last.runtime)) {
              return this.workflowCompletion(last, resolved, attempts, completedStepIds, terminalReasonCode, evaluator, collectedEvents)
            }
            if (cancellationRequested) continue
            if (step.retry.backoffMs > 0) {
              await new Promise<void>((resolve) => {
                const done = (): void => {
                  clearTimeout(timer)
                  releaseBackoff = undefined
                  resolve()
                }
                const timer = setTimeout(done, step.retry.backoffMs)
                releaseBackoff = done
              })
            }
          }
          if (!stepCompleted) {
            terminalReasonCode = "workflow-retry-exhausted"
            return this.workflowCompletion(last, resolved, attempts, completedStepIds, terminalReasonCode, evaluator, collectedEvents)
          }
          if (stepIndex < resolved.orderedSteps.length - 1) {
            await this.persistWorkflowCheckpoint(
              managedRunId,
              resolved,
              last,
              attempts,
              completedStepIds,
              evaluator,
              collectedEvents,
              actorId,
            )
          }
        }
        const finalAttempt = attempts.at(-1)
        const finalStep = resolved.orderedSteps.at(-1)
        if (!finalAttempt || !finalStep) throw new Error("Completed Workflow has no final step evidence")
        const charterGateBase = {
          evaluator,
          managedRunId,
          runId: resolved.run.id,
          step: finalStep,
          stepIndex: finalAttempt.stepIndex,
          attempt: finalAttempt.attempt,
          completedStepIds,
          actorId,
          providerDisposition: last.runtime.portable.terminalDisposition,
          postconditionStatus: last.runtime.portable.postconditionStatus,
          eventsDigest: canonicalDigest(
            resolved.workflowResume
              ? this.workflowEvidenceEvents(resolved, collectedEvents)
              : collectedEvents,
          ) as `sha256:${string}`,
          deadlineAt: finalStepDeadlineAt,
          signal: cancellation.signal,
        }
        const requiredEvidence = await this.assessWorkflowGate({
          ...charterGateBase,
          phase: "charter-evidence",
          criteria: resolved.charter.requiredEvidence,
        })
        if (cancellationRequested) {
          return this.workflowCompletion(
            this.syntheticStepCompletion(resolved, "cancelled", "cancel-request"),
            resolved,
            attempts,
            completedStepIds,
            "cancel-requested",
            evaluator,
            collectedEvents,
            { requiredEvidence, stopConditions: this.notAssessedGate("charter-stop-conditions", resolved.charter.stopConditions) },
          )
        }
        const charterStopConditions = await this.assessWorkflowGate({
          ...charterGateBase,
          phase: "charter-stop-conditions",
          criteria: resolved.charter.stopConditions,
        })
        charterGates = { requiredEvidence, stopConditions: charterStopConditions }
        if (cancellationRequested) {
          return this.workflowCompletion(
            this.syntheticStepCompletion(resolved, "cancelled", "cancel-request"),
            resolved,
            attempts,
            completedStepIds,
            "cancel-requested",
            evaluator,
            collectedEvents,
            charterGates,
          )
        }
        terminalReasonCode = requiredEvidence.status !== "satisfied"
          ? "charter-evidence-gate-failed"
          : charterStopConditions.status !== "satisfied"
            ? "charter-stop-boundary-gate-failed"
            : "workflow-completed"
        return this.workflowCompletion(
          last,
          resolved,
          attempts,
          completedStepIds,
          terminalReasonCode,
          evaluator,
          collectedEvents,
          charterGates,
        )
      } catch (error) {
        if (error instanceof WorkflowControlError) {
          if (controlledAttempt) {
            const attempt = controlledAttempt
            attempts.push(managedWorkflowStepAttemptSchema.parse({
              id: randomUUID(),
              revision: 1,
              stepId: attempt.step.id,
              stepIndex: attempt.stepIndex,
              attempt: attempt.attempt,
              state: error.control === "timeout" ? "timed-out" : "cancelled",
              dependencies: attempt.step.dependsOn,
              contextPacks: attempt.step.contextPacks.map((binding) => resolved.bindings.contextPacks.find((candidate) => candidate.recordId === binding.recordId)!),
              tools: attempt.step.toolDefinitions.map((binding) => resolved.bindings.tools.find((candidate) => candidate.recordId === binding.recordId)!),
              effectEnvelope: attempt.step.effectEnvelope,
              eventRange: attempt.eventEnd !== undefined && attempt.eventEnd >= attempt.eventStart
                ? { startSequence: attempt.eventStart, endSequence: attempt.eventEnd }
                : undefined,
              providerDisposition: attempt.providerDisposition,
              terminationCause: error.control,
              postconditionStatus: attempt.postconditionStatus,
              retryReasonCode: error.control === "timeout" ? "step-timeout" : "cancel-requested",
              gates: {
                preconditions: attempt.preconditions,
                outputs: attempt.outputs,
                evidence: attempt.evidence,
                stopConditions: attempt.stopConditions,
              },
              startedAt: attempt.startedAt,
              endedAt: new Date().toISOString(),
            }))
            controlledAttempt = undefined
          }
          const cause = error.control
          return this.workflowCompletion(
            this.syntheticStepCompletion(
              resolved,
              cause === "timeout" ? "cancelled" : "cancelled",
              cause,
            ),
            resolved,
            attempts,
            completedStepIds,
            cause === "timeout" ? "step-timeout" : "cancel-requested",
            evaluator,
            collectedEvents,
            charterGates,
          )
        }
        queue.fail(error instanceof Error ? error : new Error(String(error)))
        throw error
      } finally {
        queue.close()
      }
    })()

    return {
      events: queue,
      completion,
      cancel: async (reason?: string): Promise<void> => {
        cancellationRequested = true
        cancellation.abort(reason ?? "Managed Run cancellation requested")
        releaseBackoff?.()
        await activeStep?.cancel(reason)
      },
    }
  }

  private async launchParallelReadOnly(
    resolved: ResolvedExecution,
    input: ManagedExecutionStartInput,
    managedRunId: string,
    actorId: string,
  ): Promise<RuntimeHandle> {
    const evaluator = input.evaluateWorkflowGate!
    const queue = new BoundedAsyncQueue<ManagedRuntimeEvent>(4_096, 16 * 1024 * 1024)
    const collectedEvents: ManagedRuntimeEvent[] = []
    const attempts: ManagedWorkflowStepAttempt[] = structuredClone(resolved.workflowResume?.workflow.attempts ?? [])
    const completedStepIds = [...(resolved.workflowResume?.workflow.completedStepIds ?? [])]
    const activeSteps = new Set<StepRuntimeHandle>()
    const releaseBackoffs = new Set<() => void>()
    const cancellation = new AbortController()
    let cancellationRequested = false
    let sequence = resolved.workflowResume?.events.length ?? 0
    let liveSequence = 0

    const cancelActive = async (reason: string): Promise<void> => {
      cancellationRequested = true
      if (!cancellation.signal.aborted) cancellation.abort(reason)
      for (const release of [...releaseBackoffs]) release()
      await Promise.allSettled([...activeSteps].map((handle) => handle.cancel(reason)))
    }

    const completion = (async (): Promise<RuntimeCompletion> => {
      let last = this.syntheticStepCompletion(resolved, "failed", "provider-failure")
      let terminalReasonCode = "workflow-not-started"
      try {
        const batches = compileManagedWorkflowBatches(resolved.workflowPlan)
        const startIndex = resolved.workflowResume?.nextStepIndex ?? 0
        for (const batch of batches) {
          const pending = batch.filter((step) => resolved.orderedSteps.indexOf(step) >= startIndex)
          if (pending.length === 0) continue
          const completedBeforeBatch = [...completedStepIds]
          for (const step of pending) {
            if (step.dependsOn.some((dependency) => !completedBeforeBatch.includes(dependency))) {
              throw new Error(`Parallel Workflow Step ${step.id} dependency completion invariant failed`)
            }
          }
          const tasks = pending.map((step) => this.runParallelReadOnlyStep({
            resolved,
            input,
            managedRunId,
            actorId,
            evaluator,
            step,
            stepIndex: resolved.orderedSteps.indexOf(step),
            completedBeforeBatch,
            activeSteps,
            releaseBackoffs,
            cancellation,
            isCancellationRequested: () => cancellationRequested,
            publishEvent: (event) => queue.push({ ...event, sequence: liveSequence++ }),
          }))
          let outcomes: ParallelStepOutcome[]
          try {
            outcomes = await Promise.all(tasks)
          } catch (error) {
            await cancelActive("Parallel Workflow sibling failed unexpectedly")
            await Promise.allSettled(tasks)
            throw error
          }
          outcomes.sort((left, right) => left.stepIndex - right.stepIndex)
          for (const outcome of outcomes) {
            const eventOffset = sequence
            for (const event of outcome.events) {
              const normalized = { ...event, sequence: sequence++ }
              collectedEvents.push(normalized)
            }
            attempts.push(...outcome.attempts.map((attempt) => managedWorkflowStepAttemptSchema.parse({
              ...attempt,
              eventRange: attempt.eventRange
                ? {
                    startSequence: attempt.eventRange.startSequence + eventOffset,
                    endSequence: attempt.eventRange.endSequence + eventOffset,
                  }
                : undefined,
            })))
            if (outcome.completed) completedStepIds.push(outcome.step.id)
            last = outcome.completion
            terminalReasonCode = outcome.terminalReasonCode
          }
          const firstIncomplete = outcomes.find((outcome) => !outcome.completed)
          if (firstIncomplete) {
            return this.workflowCompletion(
              firstIncomplete.completion,
              resolved,
              attempts,
              completedStepIds,
              firstIncomplete.terminalReasonCode,
              evaluator,
              collectedEvents,
            )
          }
          const lastCompletedIndex = Math.max(...outcomes.map((outcome) => outcome.stepIndex))
          if (lastCompletedIndex < resolved.orderedSteps.length - 1) {
            await this.persistWorkflowCheckpoint(
              managedRunId,
              resolved,
              last,
              attempts,
              completedStepIds,
              evaluator,
              collectedEvents,
              actorId,
            )
          }
        }
        const finalAttempt = attempts.at(-1)
        const finalStep = resolved.orderedSteps.at(-1)
        if (!finalAttempt || !finalStep) throw new Error("Completed parallel Workflow has no final step evidence")
        const finalConfiguredTimeoutMs = finalStep.timeoutMs === undefined
          ? input.timeoutMs
          : input.timeoutMs === undefined
            ? finalStep.timeoutMs
            : Math.min(finalStep.timeoutMs, input.timeoutMs)
        const finalStepDeadlineAt = finalConfiguredTimeoutMs === undefined
          ? undefined
          : Date.parse(finalAttempt.startedAt) + finalConfiguredTimeoutMs
        const charterGateBase = {
          evaluator,
          managedRunId,
          runId: resolved.run.id,
          step: finalStep,
          stepIndex: finalAttempt.stepIndex,
          attempt: finalAttempt.attempt,
          completedStepIds,
          actorId,
          providerDisposition: last.runtime.portable.terminalDisposition,
          postconditionStatus: last.runtime.portable.postconditionStatus,
          eventsDigest: canonicalDigest(
            resolved.workflowResume
              ? this.workflowEvidenceEvents(resolved, collectedEvents)
              : collectedEvents,
          ) as `sha256:${string}`,
          deadlineAt: finalStepDeadlineAt,
          signal: cancellation.signal,
        }
        const requiredEvidence = await this.assessWorkflowGate({
          ...charterGateBase,
          phase: "charter-evidence",
          criteria: resolved.charter.requiredEvidence,
        })
        if (cancellationRequested) {
          return this.workflowCompletion(
            this.syntheticStepCompletion(resolved, "cancelled", "cancel-request"),
            resolved,
            attempts,
            completedStepIds,
            "cancel-requested",
            evaluator,
            collectedEvents,
            { requiredEvidence, stopConditions: this.notAssessedGate("charter-stop-conditions", resolved.charter.stopConditions) },
          )
        }
        const stopConditions = await this.assessWorkflowGate({
          ...charterGateBase,
          phase: "charter-stop-conditions",
          criteria: resolved.charter.stopConditions,
        })
        const charterGates = { requiredEvidence, stopConditions }
        terminalReasonCode = requiredEvidence.status !== "satisfied"
          ? "charter-evidence-gate-failed"
          : stopConditions.status !== "satisfied"
            ? "charter-stop-boundary-gate-failed"
            : "workflow-completed"
        return this.workflowCompletion(
          last,
          resolved,
          attempts,
          completedStepIds,
          cancellationRequested ? "cancel-requested" : terminalReasonCode,
          evaluator,
          collectedEvents,
          charterGates,
        )
      } catch (error) {
        queue.fail(error instanceof Error ? error : new Error(String(error)))
        throw error
      } finally {
        queue.close()
      }
    })()

    return {
      events: queue,
      completion,
      cancel: async (reason?: string): Promise<void> => {
        await cancelActive(reason ?? "Managed parallel Workflow cancellation requested")
      },
    }
  }

  private async runParallelReadOnlyStep(input: {
    resolved: ResolvedExecution
    input: ManagedExecutionStartInput
    managedRunId: string
    actorId: string
    evaluator: ManagedWorkflowGateEvaluator
    step: WorkflowStep
    stepIndex: number
    completedBeforeBatch: string[]
    activeSteps: Set<StepRuntimeHandle>
    releaseBackoffs: Set<() => void>
    cancellation: AbortController
    isCancellationRequested: () => boolean
    publishEvent: (event: ManagedRuntimeEvent) => void
  }): Promise<ParallelStepOutcome> {
    const {
      resolved,
      managedRunId,
      actorId,
      evaluator,
      step,
      stepIndex,
      completedBeforeBatch,
      activeSteps,
      releaseBackoffs,
      cancellation,
      isCancellationRequested,
      publishEvent,
    } = input
    const attempts: ManagedWorkflowStepAttempt[] = []
    const events: ManagedRuntimeEvent[] = []
    let sequence = 0
    let activeStep: StepRuntimeHandle | undefined
    let last = this.syntheticStepCompletion(resolved, "failed", "provider-failure")
    let terminalReasonCode = "workflow-step-not-started"
    let controlledAttempt: {
      attempt: number
      startedAt: string
      eventStart: number
      eventEnd?: number
      preconditions: ManagedWorkflowGateAssessment
      outputs: ManagedWorkflowGateAssessment
      evidence: ManagedWorkflowGateAssessment
      stopConditions: ManagedWorkflowGateAssessment
      providerDisposition?: ManagedRunResult["providerDisposition"]
      postconditionStatus: ManagedRunResult["outcome"]["status"]
    } | undefined
    const exactContext = step.contextPacks.map((binding) =>
      resolved.bindings.contextPacks.find((candidate) => candidate.recordId === binding.recordId)!)
    const exactTools = step.toolDefinitions.map((binding) =>
      resolved.bindings.tools.find((candidate) => candidate.recordId === binding.recordId)!)
    const configuredTimeoutMs = step.timeoutMs === undefined
      ? input.input.timeoutMs
      : input.input.timeoutMs === undefined
        ? step.timeoutMs
        : Math.min(step.timeoutMs, input.input.timeoutMs)

    try {
      for (let attemptNumber = 1; attemptNumber <= step.retry.maxAttempts; attemptNumber += 1) {
        if (isCancellationRequested()) {
          return {
            step,
            stepIndex,
            attempts,
            completed: false,
            completion: this.syntheticStepCompletion(resolved, "cancelled", "cancel-request"),
            terminalReasonCode: "cancel-requested",
            events,
          }
        }
        const startedAt = new Date().toISOString()
        const deadlineAt = configuredTimeoutMs === undefined ? undefined : Date.now() + configuredTimeoutMs
        controlledAttempt = {
          attempt: attemptNumber,
          startedAt,
          eventStart: sequence,
          preconditions: this.notAssessedGate("preconditions", step.preconditions),
          outputs: this.notAssessedGate("outputs", step.outputs),
          evidence: this.notAssessedGate("evidence", step.evidenceCriteria),
          stopConditions: this.notAssessedGate("stop-conditions", step.stopConditions),
          postconditionStatus: "not-assessed",
        }
        const preconditions = await this.assessWorkflowGate({
          evaluator,
          managedRunId,
          runId: resolved.run.id,
          step,
          stepIndex,
          attempt: attemptNumber,
          phase: "preconditions",
          criteria: step.preconditions,
          completedStepIds: completedBeforeBatch,
          actorId,
          deadlineAt,
          signal: cancellation.signal,
        })
        controlledAttempt.preconditions = preconditions
        if (isCancellationRequested()) throw new WorkflowControlError("cancel-request")
        if (preconditions.status !== "satisfied") {
          attempts.push(managedWorkflowStepAttemptSchema.parse({
            id: randomUUID(),
            revision: 1,
            stepId: step.id,
            stepIndex,
            attempt: attemptNumber,
            state: "blocked",
            dependencies: step.dependsOn,
            contextPacks: exactContext,
            tools: exactTools,
            effectEnvelope: step.effectEnvelope,
            postconditionStatus: "not-assessed",
            retryReasonCode: "precondition-gate-blocked",
            gates: {
              preconditions,
              outputs: controlledAttempt.outputs,
              evidence: controlledAttempt.evidence,
              stopConditions: controlledAttempt.stopConditions,
            },
            startedAt,
            endedAt: new Date().toISOString(),
          }))
          controlledAttempt = undefined
          return { step, stepIndex, attempts, completed: false, completion: last, terminalReasonCode: "precondition-gate-blocked", events }
        }

        activeStep = await this.launchStep(
          resolved,
          input.input,
          managedRunId,
          step,
          stepIndex === 0 && attemptNumber === 1,
          deadlineAt,
        )
        activeSteps.add(activeStep)
        if (isCancellationRequested()) await activeStep.cancel("Parallel Workflow cancellation requested before provider handoff")
        const eventStart = sequence
        const drain = (async (): Promise<void> => {
          for await (const event of activeStep!.events) {
            const normalized = { ...event, sequence: sequence++ }
            events.push(normalized)
            publishEvent(normalized)
          }
        })()
        last = await activeStep.completion
        await drain
        activeSteps.delete(activeStep)
        activeStep = undefined
        const eventEnd = sequence - 1
        const disposition = last.runtime.portable.terminalDisposition
        const postconditionStatus = last.runtime.portable.postconditionStatus
        controlledAttempt.eventEnd = eventEnd
        controlledAttempt.providerDisposition = disposition
        controlledAttempt.postconditionStatus = postconditionStatus
        if (last.terminationCause === "timeout" || last.terminationCause === "cancel-request" || isCancellationRequested()) {
          const cause = last.terminationCause === "timeout" ? "timeout" : "cancel-request"
          attempts.push(managedWorkflowStepAttemptSchema.parse({
            id: randomUUID(), revision: 1, stepId: step.id, stepIndex, attempt: attemptNumber,
            state: cause === "timeout" ? "timed-out" : "cancelled",
            dependencies: step.dependsOn, contextPacks: exactContext, tools: exactTools, effectEnvelope: step.effectEnvelope,
            eventRange: eventEnd >= eventStart ? { startSequence: eventStart, endSequence: eventEnd } : undefined,
            providerDisposition: disposition, terminationCause: cause, postconditionStatus,
            retryReasonCode: cause === "timeout" ? "step-timeout" : "cancel-requested",
            gates: {
              preconditions,
              outputs: controlledAttempt.outputs,
              evidence: controlledAttempt.evidence,
              stopConditions: controlledAttempt.stopConditions,
            },
            startedAt, endedAt: new Date().toISOString(),
          }))
          controlledAttempt = undefined
          return {
            step, stepIndex, attempts, completed: false, completion: last,
            terminalReasonCode: cause === "timeout" ? "step-timeout" : "cancel-requested", events,
          }
        }
        if (last.codexReview) {
          attempts.push(managedWorkflowStepAttemptSchema.parse({
            id: randomUUID(), revision: 1, stepId: step.id, stepIndex, attempt: attemptNumber,
            state: "review-required", dependencies: step.dependsOn, contextPacks: exactContext, tools: exactTools,
            effectEnvelope: step.effectEnvelope,
            eventRange: eventEnd >= eventStart ? { startSequence: eventStart, endSequence: eventEnd } : undefined,
            providerDisposition: disposition, terminationCause: last.terminationCause, postconditionStatus,
            gates: {
              preconditions,
              outputs: controlledAttempt.outputs,
              evidence: controlledAttempt.evidence,
              stopConditions: controlledAttempt.stopConditions,
            },
            startedAt, endedAt: new Date().toISOString(),
          }))
          controlledAttempt = undefined
          return { step, stepIndex, attempts, completed: false, completion: last, terminalReasonCode: "apply-review-required", events }
        }

        const eventsDigest = canonicalDigest(last.runtime.portable.events) as `sha256:${string}`
        const gateBase = {
          evaluator,
          managedRunId,
          runId: resolved.run.id,
          step,
          stepIndex,
          attempt: attemptNumber,
          completedStepIds: completedBeforeBatch,
          actorId,
          providerDisposition: disposition,
          postconditionStatus,
          eventsDigest,
          deadlineAt,
          signal: cancellation.signal,
        }
        const outputs = await this.assessWorkflowGate({ ...gateBase, phase: "outputs", criteria: step.outputs })
        controlledAttempt.outputs = outputs
        if (isCancellationRequested()) throw new WorkflowControlError("cancel-request")
        const evidence = await this.assessWorkflowGate({ ...gateBase, phase: "evidence", criteria: step.evidenceCriteria })
        controlledAttempt.evidence = evidence
        if (isCancellationRequested()) throw new WorkflowControlError("cancel-request")
        const stopConditions = await this.assessWorkflowGate({ ...gateBase, phase: "stop-conditions", criteria: step.stopConditions })
        controlledAttempt.stopConditions = stopConditions
        if (isCancellationRequested()) throw new WorkflowControlError("cancel-request")
        const completed = disposition === "completed" && postconditionStatus === "satisfied" &&
          outputs.status === "satisfied" && evidence.status === "satisfied" && stopConditions.status === "satisfied"
        const retryReasonCode = completed
          ? undefined
          : this.workflowRetryReason(disposition, postconditionStatus, outputs, evidence, stopConditions)
        attempts.push(managedWorkflowStepAttemptSchema.parse({
          id: randomUUID(), revision: 1, stepId: step.id, stepIndex, attempt: attemptNumber,
          state: completed ? "completed" : disposition === "unknown" || disposition === "interrupted" ? "unknown" : "failed",
          dependencies: step.dependsOn, contextPacks: exactContext, tools: exactTools, effectEnvelope: step.effectEnvelope,
          eventRange: eventEnd >= eventStart ? { startSequence: eventStart, endSequence: eventEnd } : undefined,
          providerDisposition: disposition, terminationCause: last.terminationCause, postconditionStatus, retryReasonCode,
          gates: { preconditions, outputs, evidence, stopConditions },
          startedAt, endedAt: new Date().toISOString(),
        }))
        controlledAttempt = undefined
        if (completed) {
          return { step, stepIndex, attempts, completed: true, completion: last, terminalReasonCode: "workflow-step-completed", events }
        }
        terminalReasonCode = retryReasonCode ?? "workflow-step-failed"
        if (!this.shouldRetryWorkflowStep(step, attemptNumber, terminalReasonCode, last.runtime)) {
          return { step, stepIndex, attempts, completed: false, completion: last, terminalReasonCode, events }
        }
        if (step.retry.backoffMs > 0 && !isCancellationRequested()) {
          await new Promise<void>((resolve) => {
            let timer: ReturnType<typeof setTimeout>
            const done = (): void => {
              clearTimeout(timer)
              releaseBackoffs.delete(done)
              resolve()
            }
            timer = setTimeout(done, step.retry.backoffMs)
            releaseBackoffs.add(done)
          })
        }
      }
      return { step, stepIndex, attempts, completed: false, completion: last, terminalReasonCode: "workflow-retry-exhausted", events }
    } catch (error) {
      if (!(error instanceof WorkflowControlError)) throw error
      if (controlledAttempt) {
        const eventEnd = controlledAttempt.eventEnd
        attempts.push(managedWorkflowStepAttemptSchema.parse({
          id: randomUUID(), revision: 1, stepId: step.id, stepIndex, attempt: controlledAttempt.attempt,
          state: error.control === "timeout" ? "timed-out" : "cancelled",
          dependencies: step.dependsOn, contextPacks: exactContext, tools: exactTools, effectEnvelope: step.effectEnvelope,
          eventRange: eventEnd !== undefined && eventEnd >= controlledAttempt.eventStart
            ? { startSequence: controlledAttempt.eventStart, endSequence: eventEnd }
            : undefined,
          providerDisposition: controlledAttempt.providerDisposition,
          terminationCause: error.control,
          postconditionStatus: controlledAttempt.postconditionStatus,
          retryReasonCode: error.control === "timeout" ? "step-timeout" : "cancel-requested",
          gates: {
            preconditions: controlledAttempt.preconditions,
            outputs: controlledAttempt.outputs,
            evidence: controlledAttempt.evidence,
            stopConditions: controlledAttempt.stopConditions,
          },
          startedAt: controlledAttempt.startedAt,
          endedAt: new Date().toISOString(),
        }))
      }
      return {
        step,
        stepIndex,
        attempts,
        completed: false,
        completion: this.syntheticStepCompletion(resolved, "cancelled", error.control),
        terminalReasonCode: error.control === "timeout" ? "step-timeout" : "cancel-requested",
        events,
      }
    } finally {
      if (activeStep) activeSteps.delete(activeStep)
    }
  }

  private syntheticStepCompletion(
    resolved: ResolvedExecution,
    disposition: ManagedTerminalDisposition,
    terminationCause: ManagedRunResult["terminationCause"],
  ): StepRuntimeCompletion {
    return {
      runtime: {
        portable: {
          schemaVersion: 1,
          provider: {
            adapterId: resolved.run.agent.adapterId,
            agentId: resolved.run.agent.agentId,
            runtimeVersion: resolved.probe.capabilities.runtimeVersion,
            capabilityDigest: resolved.run.agent.capabilityDigest as `sha256:${string}`,
          },
          events: [],
          terminalDisposition: disposition,
          warnings: [],
          postconditionStatus: disposition === "completed" ? "not-assessed" : "failed",
        },
        local: {},
      },
      terminationCause,
    }
  }

  private workflowCompletion(
    completion: StepRuntimeCompletion,
    resolved: ResolvedExecution,
    attempts: ManagedWorkflowStepAttempt[],
    completedStepIds: string[],
    terminalReasonCode: string,
    gateEvaluator: ManagedWorkflowGateEvaluator,
    events: ManagedRuntimeEvent[],
    charterGates: ManagedWorkflowExecution["charterGates"] = this.unassessedCharterGates(resolved),
  ): RuntimeCompletion {
    const workflow = managedWorkflowExecutionSchema.parse({
      plan: resolved.bindings.workflowPlan,
      strategy: resolved.workflowPlan.strategy,
      orderedStepIds: resolved.orderedSteps.map((step) => step.id),
      attempts,
      completedStepIds,
      charterGates,
      terminalReasonCode,
      capabilityBoundary: "natural-language-gates-require-explicit-human-or-system-assessment",
    })
    const completed = terminalReasonCode === "workflow-completed" &&
      completedStepIds.length === resolved.orderedSteps.length
    const reviewRequired = terminalReasonCode === "apply-review-required"
    const postconditionStatus = completed
      ? "satisfied"
      : reviewRequired
        ? completion.runtime.portable.postconditionStatus
        : completion.terminationCause === "cancel-request"
          ? "not-assessed"
          : completion.terminationCause === "process-loss"
            ? "indeterminate"
            : completion.runtime.portable.postconditionStatus === "indeterminate"
              ? "indeterminate"
              : completion.runtime.portable.postconditionStatus === "not-assessed"
                ? "not-assessed"
                : "failed"
    return {
      ...completion,
      evidenceEvents: this.workflowEvidenceEvents(resolved, events),
      runtime: {
        portable: {
          ...completion.runtime.portable,
          events: events.map((event, sequence) => ({ ...event, sequence })),
          postconditionStatus,
        },
        local: completion.runtime.local,
      },
      workflow,
      gateEvaluator,
    }
  }

  private workflowEvidenceEvents(
    resolved: ResolvedExecution,
    events: readonly ManagedRuntimeEvent[],
  ): ManagedEvidenceEvent[] {
    const inherited = structuredClone(resolved.workflowResume?.events ?? [])
    const available = 4_096 - inherited.length
    if (available < 0 || (resolved.orderedSteps.length > 1 && events.length > available)) {
      throw new Error("Managed multi-step Workflow exceeds the portable evidence event bound")
    }
    const current = normalizeManagedRuntimeEvents(events.slice(0, Math.max(0, available)))
      .map((event, index) => ({ ...event, sequence: inherited.length + index }))
    return [...inherited, ...current]
  }

  private async persistWorkflowCheckpoint(
    managedRunId: string,
    resolved: ResolvedExecution,
    completion: StepRuntimeCompletion,
    attempts: readonly ManagedWorkflowStepAttempt[],
    completedStepIds: readonly string[],
    gateEvaluator: ManagedWorkflowGateEvaluator,
    runtimeEvents: readonly ManagedRuntimeEvent[],
    actorId: string,
  ): Promise<void> {
    if (resolved.mode === "codex-staged" ||
        resolved.charter.expectedEffects.some((effect) => effect !== "observe")) {
      throw new Error("Durable Workflow checkpoints are restricted to observation-only execution")
    }
    const nextStepIndex = completedStepIds.length
    if (nextStepIndex < 1 || nextStepIndex >= resolved.orderedSteps.length ||
        canonicalDigest(completedStepIds) !==
          canonicalDigest(resolved.orderedSteps.slice(0, nextStepIndex).map((step) => step.id))) {
      throw new Error("Durable Workflow checkpoint requires an exact completed dependency prefix")
    }
    const checkpoint = this.workflowCompletion(
      completion,
      resolved,
      [...attempts],
      [...completedStepIds],
      "workflow-checkpoint",
      gateEvaluator,
      [...runtimeEvents],
    )
    const evidenceEvents = checkpoint.evidenceEvents!
    const capturedAt = new Date().toISOString()
    await this.repository.withLock(async () => {
      await this.assertBindingsCurrent(resolved, true)
      const current = await this.repository.readJson(this.managedRunPath(managedRunId), managedRunRecordSchema)
      const priorNextStepIndex = current.workflowCheckpoints?.at(-1)?.nextStepIndex ??
        resolved.workflowResume?.nextStepIndex ?? 0
      const validAdvance = resolved.workflowPlan.strategy === "sequential"
        ? priorNextStepIndex === nextStepIndex - 1
        : priorNextStepIndex < nextStepIndex
      if (current.state !== "running" || current.bindingsDigest !== canonicalDigest(resolved.bindings) ||
          !validAdvance) {
        throw new Error("Managed Run changed before Workflow checkpoint persistence")
      }
      await this.readWorkflowCheckpointChain(current, resolved.orderedSteps, resolved.workflowPlan.strategy)
      const evidence = managedRunEvidenceSchema.parse({
        schemaVersion: 2,
        kind: "managed-run-evidence",
        id: randomUUID(),
        managedRunId: current.id,
        runId: current.runId,
        productId: current.productId,
        bindingsDigest: current.bindingsDigest,
        events: evidenceEvents,
        eventsDigest: canonicalDigest(evidenceEvents),
        workflow: checkpoint.workflow,
        actualEffects: [...new Set(resolved.charter.expectedEffects)].map((effect) => ({
          effect,
          status: "observed-provisional" as const,
          evidenceDigest: canonicalDigest({
            managedRunId: current.id,
            nextStepIndex,
            effect,
            eventsDigest: canonicalDigest(evidenceEvents),
          }),
        })),
        capturedAt,
        authorityBoundary: "evidence-does-not-self-assert-outcome-or-authorization",
      })
      const binding = {
        evidenceId: evidence.id,
        evidenceDigest: canonicalDigest(evidence),
        nextStepIndex,
        completedStepIdsDigest: canonicalDigest(completedStepIds),
      }
      const next = managedRunRecordSchema.parse({
        ...current,
        revision: current.revision + 1,
        workflowCheckpoints: [...(current.workflowCheckpoints ?? []), binding],
        updatedAt: capturedAt,
      })
      await this.repository.commitMutation({
        writes: [
          { path: this.evidencePath(evidence.id), value: evidence, schema: managedRunEvidenceSchema, governed: true },
          { path: this.managedRunPath(next.id), value: next, schema: managedRunRecordSchema, governed: true },
        ],
        audit: {
          eventType: "managed-run.workflow-checkpointed",
          actor: { kind: "system", id: actorId },
          subjectId: next.id,
          payload: {
            nextStepIndex,
            completedStepIdsDigest: binding.completedStepIdsDigest,
            evidenceId: evidence.id,
            evidenceDigest: binding.evidenceDigest,
            machineLocalDataPersisted: false,
          },
        },
      })
    })
  }

  private emptyWorkflow(resolved: ResolvedExecution, terminalReasonCode: string): ManagedWorkflowExecution {
    return managedWorkflowExecutionSchema.parse({
      plan: resolved.bindings.workflowPlan,
      strategy: resolved.workflowPlan.strategy,
      orderedStepIds: resolved.orderedSteps.map((step) => step.id),
      attempts: [],
      completedStepIds: [],
      charterGates: this.unassessedCharterGates(resolved),
      terminalReasonCode,
      capabilityBoundary: "natural-language-gates-require-explicit-human-or-system-assessment",
    })
  }

  private discardedWorkflow(workflow: ManagedWorkflowExecution): ManagedWorkflowExecution {
    const attempts = workflow.attempts.map((attempt, index) =>
      index === workflow.attempts.length - 1 && (
        attempt.state === "review-required" ||
        (workflow.terminalReasonCode === "source-workspace-conflict" && attempt.state === "unknown")
      )
        ? {
            ...attempt,
            revision: attempt.revision + 1,
            previousSnapshotDigest: canonicalDigest(attempt),
            state: "discarded" as const,
            endedAt: new Date().toISOString(),
          }
        : attempt)
    return managedWorkflowExecutionSchema.parse({
      ...workflow,
      attempts,
      terminalReasonCode: "staged-changes-discarded",
    })
  }

  private postApplyVerificationFailureWorkflow(
    workflow: ManagedWorkflowExecution,
    runtime: ManagedRuntimeResultEnvelope,
  ): ManagedWorkflowExecution {
    const lastAttempt = workflow.attempts.at(-1)
    return managedWorkflowExecutionSchema.parse({
      ...workflow,
      attempts: lastAttempt
        ? workflow.attempts.map((attempt) => attempt.id === lastAttempt.id
            ? {
                ...attempt,
                revision: attempt.revision + 1,
                previousSnapshotDigest: canonicalDigest(attempt),
                state: "unknown" as const,
                providerDisposition: runtime.portable.terminalDisposition,
                terminationCause: "normal" as const,
                postconditionStatus: "indeterminate" as const,
                retryReasonCode: "post-apply-verification-failed",
                endedAt: new Date().toISOString(),
              }
            : attempt)
        : workflow.attempts,
      terminalReasonCode: "post-apply-verification-failed",
    })
  }

  private async finalizeAppliedWorkflow(
    completion: RuntimeCompletion,
    resolved: ResolvedExecution,
    runtime: ManagedRuntimeResultEnvelope,
    managedRunId: string,
    actorId: string,
  ): Promise<ManagedWorkflowExecution> {
    const lastAttempt = completion.workflow.attempts.at(-1)
    if (!lastAttempt || lastAttempt.state !== "review-required") {
      throw new Error("Applied staged run has no exact review-required Workflow attempt")
    }
    const step = resolved.orderedSteps.find((candidate) => candidate.id === lastAttempt.stepId)
    if (!step) throw new Error("Applied staged run Workflow Step binding is missing")
    const conflict = runtime.portable.staging?.applyJournalDigest !== undefined && !runtime.portable.staging.applied
    if (conflict) {
      return managedWorkflowExecutionSchema.parse({
        ...completion.workflow,
        attempts: completion.workflow.attempts.map((attempt) => attempt.id === lastAttempt.id
          ? {
              ...attempt,
              revision: attempt.revision + 1,
              previousSnapshotDigest: canonicalDigest(attempt),
              state: "unknown" as const,
              providerDisposition: runtime.portable.terminalDisposition,
              terminationCause: "normal" as const,
              postconditionStatus: "indeterminate" as const,
              retryReasonCode: "source-workspace-conflict",
              endedAt: new Date().toISOString(),
            }
          : attempt),
        terminalReasonCode: "source-workspace-conflict",
      })
    }
    const eventsDigest = completion.persistedEventsDigest ?? canonicalDigest(runtime.portable.events) as `sha256:${string}`
    const gateControl = new AbortController()
    const gateBase = {
      evaluator: completion.gateEvaluator,
      managedRunId,
      runId: resolved.run.id,
      step,
      stepIndex: lastAttempt.stepIndex,
      attempt: lastAttempt.attempt,
      completedStepIds: completion.workflow.completedStepIds,
      actorId,
      providerDisposition: runtime.portable.terminalDisposition,
      postconditionStatus: runtime.portable.postconditionStatus,
      eventsDigest,
      deadlineAt: step.timeoutMs === undefined ? undefined : Date.now() + step.timeoutMs,
      signal: gateControl.signal,
    }
    const outputs = await this.assessWorkflowGate({ ...gateBase, phase: "outputs", criteria: step.outputs })
    const evidence = await this.assessWorkflowGate({ ...gateBase, phase: "evidence", criteria: step.evidenceCriteria })
    const stopConditions = await this.assessWorkflowGate({ ...gateBase, phase: "stop-conditions", criteria: step.stopConditions })
    const stepCompleted = runtime.portable.terminalDisposition === "completed" &&
      runtime.portable.postconditionStatus === "satisfied" &&
      outputs.status === "satisfied" && evidence.status === "satisfied" && stopConditions.status === "satisfied"
    const retryReasonCode = stepCompleted
      ? undefined
      : this.workflowRetryReason(
          runtime.portable.terminalDisposition,
          runtime.portable.postconditionStatus,
          outputs,
          evidence,
          stopConditions,
        )
    const nextCompletedStepIds = stepCompleted
      ? [...new Set([...completion.workflow.completedStepIds, step.id])]
      : completion.workflow.completedStepIds
    const charterGates = stepCompleted
      ? {
          requiredEvidence: await this.assessWorkflowGate({
            ...gateBase,
            phase: "charter-evidence",
            criteria: resolved.charter.requiredEvidence,
            completedStepIds: nextCompletedStepIds,
          }),
          stopConditions: await this.assessWorkflowGate({
            ...gateBase,
            phase: "charter-stop-conditions",
            criteria: resolved.charter.stopConditions,
            completedStepIds: nextCompletedStepIds,
          }),
        }
      : completion.workflow.charterGates
    const completed = stepCompleted &&
      charterGates.requiredEvidence.status === "satisfied" &&
      charterGates.stopConditions.status === "satisfied"
    const attempts = completion.workflow.attempts.map((attempt) => attempt.id === lastAttempt.id
      ? managedWorkflowStepAttemptSchema.parse({
          ...attempt,
          revision: attempt.revision + 1,
          previousSnapshotDigest: canonicalDigest(attempt),
          state: stepCompleted ? "completed" : "failed",
          providerDisposition: runtime.portable.terminalDisposition,
          terminationCause: "normal",
          postconditionStatus: runtime.portable.postconditionStatus,
          retryReasonCode,
          gates: { ...attempt.gates, outputs, evidence, stopConditions },
          endedAt: new Date().toISOString(),
        })
      : attempt)
    return managedWorkflowExecutionSchema.parse({
      ...completion.workflow,
      attempts,
      completedStepIds: nextCompletedStepIds,
      charterGates,
      terminalReasonCode: completed
        ? "workflow-completed"
        : retryReasonCode ?? (charterGates.requiredEvidence.status !== "satisfied"
            ? "charter-evidence-gate-failed"
            : "charter-stop-boundary-gate-failed"),
    })
  }

  private async assessWorkflowGate(input: {
    evaluator: ManagedWorkflowGateEvaluator
    managedRunId: string
    runId: string
    step: WorkflowStep
    stepIndex: number
    attempt: number
    phase: ManagedWorkflowGateAssessment["phase"]
    criteria: readonly string[]
    completedStepIds: readonly string[]
    actorId: string
    providerDisposition?: ManagedRunResult["providerDisposition"]
    postconditionStatus?: ManagedRunResult["outcome"]["status"]
    eventsDigest?: `sha256:${string}`
    deadlineAt?: number
    signal: AbortSignal
  }): Promise<ManagedWorkflowGateAssessment> {
    const criteriaDigest = canonicalDigest(input.criteria) as `sha256:${string}`
    if (input.signal.aborted) throw new WorkflowControlError("cancel-request")
    const remainingMs = input.deadlineAt === undefined ? undefined : input.deadlineAt - Date.now()
    if (remainingMs !== undefined && remainingMs <= 0) throw new WorkflowControlError("timeout")
    const evaluatorControl = new AbortController()
    const cancelEvaluation = (): void => evaluatorControl.abort(input.signal.reason)
    input.signal.addEventListener("abort", cancelEvaluation, { once: true })
    let timeout: ReturnType<typeof setTimeout> | undefined
    let rejectCancellation: (() => void) | undefined
    const controlled = new Promise<never>((_resolve, reject) => {
      rejectCancellation = () => reject(new WorkflowControlError("cancel-request"))
      input.signal.addEventListener("abort", rejectCancellation, { once: true })
      if (remainingMs !== undefined) {
        timeout = setTimeout(() => {
          evaluatorControl.abort("Workflow Step deadline expired")
          reject(new WorkflowControlError("timeout"))
        }, remainingMs)
      }
    })
    const evaluation = input.evaluator({
      managedRunId: input.managedRunId,
      runId: input.runId,
      stepId: input.step.id,
      stepIndex: input.stepIndex,
      attempt: input.attempt,
      phase: input.phase,
      criteria: [...input.criteria],
      criteriaDigest,
      completedStepIds: [...input.completedStepIds],
      providerDisposition: input.providerDisposition,
      postconditionStatus: input.postconditionStatus,
      eventsDigest: input.eventsDigest,
      signal: evaluatorControl.signal,
    })
    let evaluated: ManagedWorkflowGateEvaluation
    try {
      evaluated = await Promise.race([evaluation, controlled])
    } finally {
      if (timeout) clearTimeout(timeout)
      input.signal.removeEventListener("abort", cancelEvaluation)
      if (rejectCancellation) input.signal.removeEventListener("abort", rejectCancellation)
    }
    assertEvaluatorIdentity(evaluated.evaluator, "Workflow gate evaluator")
    return managedWorkflowGateAssessmentSchema.parse({
      phase: input.phase,
      interpretation: input.phase === "stop-conditions" || input.phase === "charter-stop-conditions"
        ? "stop-boundary-complied"
        : "criteria-satisfied",
      criteriaDigest,
      status: evaluated.status,
      basis: evaluated.basis,
      evidenceDigest: evaluated.evidenceDigest,
      actor: {
        kind: evaluated.evaluator.kind,
        id: evaluated.evaluator.id,
      },
      evaluator: evaluated.evaluator,
      assessedAt: new Date().toISOString(),
    })
  }

  private notAssessedGate(
    phase: ManagedWorkflowGateAssessment["phase"],
    criteria: readonly string[],
  ): ManagedWorkflowGateAssessment {
    return managedWorkflowGateAssessmentSchema.parse({
      phase,
      interpretation: phase === "stop-conditions" || phase === "charter-stop-conditions"
        ? "stop-boundary-complied"
        : "criteria-satisfied",
      criteriaDigest: canonicalDigest(criteria),
      status: "not-assessed",
      basis: "not-evaluated",
      actor: { kind: "system", id: "gaep.workflow-coordinator" },
      evaluator: {
        kind: "system",
        id: "gaep.workflow-coordinator",
        version: "1",
        digest: canonicalDigest({ kind: "system", id: "gaep.workflow-coordinator", version: "1" }),
      },
      assessedAt: new Date().toISOString(),
    })
  }

  private unassessedCharterGates(resolved: ResolvedExecution): ManagedWorkflowExecution["charterGates"] {
    return {
      requiredEvidence: this.notAssessedGate("charter-evidence", resolved.charter.requiredEvidence),
      stopConditions: this.notAssessedGate("charter-stop-conditions", resolved.charter.stopConditions),
    }
  }

  private workflowRetryReason(
    disposition: ManagedTerminalDisposition,
    postconditionStatus: ManagedRunResult["outcome"]["status"],
    outputs: ManagedWorkflowGateAssessment,
    evidence: ManagedWorkflowGateAssessment,
    stopConditions: ManagedWorkflowGateAssessment,
  ): string {
    if (disposition !== "completed") return safeEventCode(`provider-${disposition}`)
    if (postconditionStatus !== "satisfied") return safeEventCode(`postcondition-${postconditionStatus}`)
    if (outputs.status !== "satisfied") return "output-gate-failed"
    if (evidence.status !== "satisfied") return "evidence-gate-failed"
    if (stopConditions.status !== "satisfied") return "stop-boundary-gate-failed"
    return "workflow-step-failed"
  }

  private shouldRetryWorkflowStep(
    step: WorkflowStep,
    attempt: number,
    reasonCode: string,
    runtime: ManagedRuntimeResultEnvelope,
  ): boolean {
    if (attempt >= step.retry.maxAttempts) return false
    const configured = new Set(step.retry.retryOn.map((value) => safeEventCode(value)))
    const observed = new Set([
      safeEventCode(reasonCode),
      safeEventCode(`provider-${runtime.portable.terminalDisposition}`),
      ...runtime.portable.events
        .filter((event): event is Extract<ManagedRuntimeEvent, { type: "error" }> => event.type === "error")
        .map((event) => safeEventCode(event.code)),
    ])
    return [...observed].some((code) => configured.has(code))
  }

  private async launchStep(
    resolved: ResolvedExecution,
    input: ManagedExecutionStartInput,
    managedRunId: string,
    step: WorkflowStep,
    allowResume: boolean,
    deadlineAt?: number,
  ): Promise<StepRuntimeHandle> {
    const timeoutMs = deadlineAt === undefined ? undefined : deadlineAt - Date.now()
    if (timeoutMs !== undefined && timeoutMs <= 0) throw new WorkflowControlError("timeout")
    const resume = input.previousManagedRunId ? resolved.providerResume : undefined
    if (resume && !allowResume) throw new Error("Managed provider resume can bind only the first Workflow Step attempt")
    const stepPacks = step.contextPacks.map((binding) =>
      resolved.contextPacks.find((pack) => pack.id === binding.recordId)!)
    const stepTools = step.toolDefinitions.map((binding) =>
      resolved.tools.find((tool) => tool.id === binding.recordId)!)
    const stepContext = this.buildLocalContext(stepPacks)
    const stepPrompt = this.buildStepLocalPrompt(resolved.charter, resolved.workflowPlan, step, stepContext)
    if (resolved.mode === "manual-offline") {
      if (!(resolved.adapter instanceof DeterministicManualAdapter)) {
        throw new Error("Manual managed execution requires DeterministicManualAdapter")
      }
      const scriptId = String(resolved.run.agent.settings.script ?? "")
      const handle = resume
        ? resolved.adapter.resume(scriptId, resume.providerThreadId)
        : resolved.adapter.start({ scriptId })
      let timedOut = false
      const completion = (async (): Promise<StepRuntimeCompletion> => {
        let timeout: ReturnType<typeof setTimeout> | undefined
        if (timeoutMs !== undefined) {
          timeout = setTimeout(() => {
            timedOut = true
            void handle.cancel("Workflow Step deadline expired")
          }, timeoutMs)
        }
        try {
          const runtime = await handle.completion
          return {
            runtime,
            terminationCause: timedOut ? "timeout" : this.causeFromDisposition(runtime.portable.terminalDisposition),
          }
        } finally {
          if (timeout) clearTimeout(timeout)
        }
      })()
      return {
        events: handle.events,
        completion,
        cancel: (reason) => handle.cancel(reason),
      }
    }
    if (resolved.probe.runtimeBinding.kind !== "executable") throw new Error("Managed provider executable is unavailable")
    if (resolved.mode === "codex-staged") {
      const stagingService = new WorkspaceStagingService()
      const policy = compileManagedCodexPolicy(resolved.charter, stepTools, resolved.writeEnvelope)
      const handle = await startManagedCodexStagedRun({
        executable: resolved.probe.runtimeBinding.executablePath,
        sourceWorkspacePath: this.workspacePath,
        model: resolved.run.agent.modelId,
        prompt: stepPrompt,
        developerInstructions: this.localDeveloperInstructions(resolved.charter),
        resumeThreadId: resume?.providerThreadId,
        runtimeVersion: resolved.probe.capabilities.runtimeVersion,
        capabilityDigest: resolved.run.agent.capabilityDigest as `sha256:${string}`,
        bindingsDigest: canonicalDigest(resolved.bindings) as `sha256:${string}`,
        managedProvider: {
          adapterId: resolved.run.agent.adapterId,
          agentId: resolved.run.agent.agentId,
        },
        timeoutMs,
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
      objective: stepPrompt,
      contextPack: stepContext,
      effort: typeof effort === "string" && ["low", "medium", "high", "xhigh", "max"].includes(effort)
        ? effort as "low" | "medium" | "high" | "xhigh" | "max"
        : undefined,
      maxBudgetUsd: typeof maxBudgetUsd === "number" ? maxBudgetUsd : undefined,
      timeoutMs,
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
    workflow: ManagedWorkflowExecution,
    state: ManagedRunResult["terminalState"],
    cause: ManagedRunResult["terminationCause"],
    stagingState: NonNullable<ManagedRunEvidence["staging"]>["applyState"] | undefined,
    outcomeBasis: ManagedRunResult["outcome"]["basis"],
    evidenceEvents: ManagedEvidenceEvent[] | undefined,
    actorId: string,
    applyDecision?: ManagedApplyDecisionReceipt,
    outcomeEvaluator?: ManagedEvaluatorIdentity,
    priorEvidence?: ManagedRunEvidence,
    priorWarnings?: ManagedRunResult["warnings"],
  ): Promise<PersistedArtifacts> {
    const events = priorEvidence
      ? structuredClone(priorEvidence.events)
      : evidenceEvents
        ? structuredClone(evidenceEvents)
        : normalizeManagedRuntimeEvents(runtime.portable.events)
    const now = new Date().toISOString()
    const staging = runtime.portable.staging && stagingState
      ? managedStagingEvidence(runtime.portable.staging, stagingState, applyDecision)
      : undefined
    const effectsSeed = canonicalDigest({ events, staging, disposition: runtime.portable.terminalDisposition })
    const actualEffects = [...new Set(resolved.charter.expectedEffects)].map((effect) => ({
      effect,
      status: effect === "observe" && workflow.completedStepIds.length > 0
        ? "observed-provisional" as const
        : this.effectStatus(effect, state, staging),
      evidenceDigest: canonicalDigest({ effectsSeed, effect }),
    }))
    const evidence = managedRunEvidenceSchema.parse({
      schemaVersion: 2,
      kind: "managed-run-evidence",
      id: randomUUID(),
      managedRunId: current.id,
      runId: current.runId,
      productId: current.productId,
      bindingsDigest: current.bindingsDigest,
      events,
      eventsDigest: canonicalDigest(events),
      workflow,
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
      outcome: {
        status: runtime.portable.postconditionStatus,
        basis: outcomeBasis,
        ...(outcomeEvaluator ? { evaluator: outcomeEvaluator } : {}),
      },
      terminalState: state,
      evidenceId: evidence.id,
      evidenceDigest: canonicalDigest(evidence),
      previousResultId: current.resultId,
      previousResultDigest: current.resultDigest,
      warnings: [...new Set([...(priorWarnings ?? []), ...uniqueWarnings(runtime, events, current.mode)])],
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

  private async transitionForApply(
    current: PersistedArtifacts,
    resolved: ResolvedExecution,
    confirmation: ManagedExecutionApplyConfirmation,
    actorId: string,
  ): Promise<{ record: ManagedRunRecord; receipt: ManagedApplyDecisionReceipt }> {
    const expectedConfirmation = exactApplyConfirmation(current, resolved)
    if (canonicalDigest(confirmation) !== canonicalDigest(expectedConfirmation)) {
      throw new Error("Apply confirmation does not match the exact reviewed evidence, changed inventory, and write envelope")
    }
    const changedInventory = [...current.evidence.staging!.changes].sort((left, right) => left.path.localeCompare(right.path))
    for (const change of changedInventory) {
      if (!workspacePathWithinEnvelope(change.path, resolved.writeEnvelope)) {
        throw new Error(`Staged change ${change.path} is outside the exact confirmed workspace write envelope`)
      }
    }
    const receipt = managedApplyDecisionReceiptSchema.parse({
      schemaVersion: 1,
      kind: "managed-apply-decision",
      id: randomUUID(),
      managedRunId: current.record.id,
      managedRunRevision: current.record.revision,
      runId: current.record.runId,
      productId: current.record.productId,
      bindingsDigest: current.record.bindingsDigest,
      reviewResultId: current.result.id,
      reviewResultDigest: canonicalDigest(current.result),
      reviewEvidenceId: current.evidence.id,
      reviewEvidenceDigest: canonicalDigest(current.evidence),
      changedInventory,
      changedInventoryDigest: canonicalDigest(changedInventory),
      writeEnvelope: resolved.writeEnvelope,
      writeEnvelopeDigest: canonicalDigest(resolved.writeEnvelope),
      actor: { kind: "human", id: actorId },
      decision: "apply-exact-reviewed-inventory",
      decidedAt: new Date().toISOString(),
      authorityBoundary: "apply-decision-is-exact-run-evidence-inventory-actor-and-scope",
    })
    return this.repository.withLock(async () => {
      await this.assertBindingsCurrent(resolved, true)
      const persisted = await this.repository.readJson(this.managedRunPath(current.record.id), managedRunRecordSchema)
      if (persisted.revision !== current.record.revision || persisted.state !== "review-required") {
        throw new Error("Managed Run is no longer awaiting apply review")
      }
      assertTransition(persisted.state, "applying")
      const next = managedRunRecordSchema.parse({
        ...persisted,
        revision: persisted.revision + 1,
        state: "applying",
        applyDecisionId: receipt.id,
        applyDecisionDigest: canonicalDigest(receipt),
        updatedAt: new Date().toISOString(),
      })
      await this.repository.commitMutation({
        writes: [
          { path: this.applyDecisionPath(receipt.id), value: receipt, schema: managedApplyDecisionReceiptSchema, governed: true },
          { path: this.managedRunPath(next.id), value: next, schema: managedRunRecordSchema, governed: true },
        ],
        audit: {
          eventType: "managed-run.applying",
          actor: { kind: "human", id: actorId },
          subjectId: next.id,
          payload: {
            from: "review-required",
            to: "applying",
            revision: next.revision,
            recordDigest: canonicalDigest(next),
            applyDecisionId: receipt.id,
            applyDecisionDigest: canonicalDigest(receipt),
            changedInventoryDigest: receipt.changedInventoryDigest,
            writeEnvelopeDigest: receipt.writeEnvelopeDigest,
          },
        },
      })
      return { record: next, receipt }
    })
  }

  private async restorePortableReviewAfterPreJournalFailure(
    applying: ManagedRunRecord,
    actorId: string,
  ): Promise<void> {
    await this.repository.withLock(async () => {
      const current = await this.repository.readJson(this.managedRunPath(applying.id), managedRunRecordSchema)
      if (current.revision !== applying.revision || current.state !== "applying" ||
          current.applyDecisionId !== applying.applyDecisionId || current.applyDecisionDigest !== applying.applyDecisionDigest) {
        throw new Error("Managed Run changed before its pre-journal apply state could be restored")
      }
      assertTransition(current.state, "review-required")
      const next = managedRunRecordSchema.parse({
        ...current,
        revision: current.revision + 1,
        state: "review-required",
        applyDecisionId: undefined,
        applyDecisionDigest: undefined,
        updatedAt: new Date().toISOString(),
      })
      await this.repository.commitMutation({
        writes: [{ path: this.managedRunPath(next.id), value: next, schema: managedRunRecordSchema, governed: true }],
        audit: {
          eventType: "managed-run.apply-preflight-restored",
          actor: { kind: "system", id: actorId },
          subjectId: next.id,
          payload: {
            from: "applying",
            to: "review-required",
            failedApplyDecisionId: current.applyDecisionId,
            sourceMutationAttempted: false,
            applyJournalBound: false,
          },
        },
      })
    })
  }

  private async performDiscard(
    current: PersistedArtifacts,
    resolved: ResolvedExecution,
    completion: RuntimeCompletion,
    actorId: string,
  ): Promise<PersistedArtifacts> {
    if (!completion.codexReview) throw new Error("This Managed Run has no staged workspace to discard")
    if (current.record.state !== "review-required" && current.record.state !== "conflict") return current
    const durable = await this.read(current.record.id)
    if (durable.revision !== current.record.revision || durable.state !== current.record.state) {
      throw new Error("Managed Run changed before staged discard")
    }
    const runtime = completion.runtime
    const events = completion.persistedEventsDigest
      ? structuredClone(current.evidence.events)
      : normalizeManagedRuntimeEvents(runtime.portable.events)
    const now = new Date().toISOString()
    const staging = current.evidence.staging
      ? { ...current.evidence.staging, applyState: "discarded" as const }
      : undefined
    const evidence = managedRunEvidenceSchema.parse({
      schemaVersion: 2,
      kind: "managed-run-evidence",
      id: randomUUID(),
      managedRunId: current.record.id,
      runId: current.record.runId,
      productId: current.record.productId,
      bindingsDigest: current.record.bindingsDigest,
      events,
      eventsDigest: canonicalDigest(events),
      workflow: this.discardedWorkflow(completion.workflow),
      staging,
      actualEffects: [...new Set(resolved.charter.expectedEffects)].map((effect) => ({
        effect,
        status: current.record.state === "review-required" ? "blocked" as const : "unknown" as const,
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
      previousResultId: current.result.id,
      previousResultDigest: canonicalDigest(current.result),
      outcome: { status: "not-assessed", basis: "not-evaluated" },
      terminalState: "discarded",
      // Portable discard commits before machine-local review/stage/journal
      // finalization. Preserve that cleanup uncertainty even when the local
      // finalizer succeeds immediately; restart reconciliation clears state,
      // not already-committed historical warnings.
      warnings: [...new Set([...current.result.warnings, "local-cleanup-pending" as const])],
      endedAt: now,
    })
    const persisted = await this.commitArtifacts(current.record, result, evidence, actorId)
    await completion.codexReview.discard().catch(() => undefined)
    if (current.record.state === "review-required") {
      await this.stageRegistry.discardReview(
        current.record.id,
        undefined,
        { terminalAuthorized: true },
      ).catch(() => undefined)
      await this.stageRegistry.completeDiscard(current.record.id).catch(() => undefined)
    }
    return persisted
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
    const checkpointEvidence = cause === "process-loss"
      ? (await this.readWorkflowCheckpointChain(current, resolved.orderedSteps, resolved.workflowPlan.strategy)).at(-1)
      : undefined
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
      checkpointEvidence
        ? managedWorkflowExecutionSchema.parse({
            ...checkpointEvidence.workflow,
            terminalReasonCode: "process-loss",
          })
        : this.emptyWorkflow(resolved, cause === "protocol-error" ? "launch-protocol-error" : "process-loss"),
      cause === "protocol-error" ? "failed" : "unknown",
      cause,
      undefined,
      "provider-failure",
      checkpointEvidence?.events,
      actorId,
    )
  }

  private async assertBindingsCurrent(resolved: ResolvedExecution, allowManagedRunningRun = false): Promise<void> {
    const currentRun = await this.repository.readJson(this.runPath(resolved.run.id), runSchema)
    const records = [
      [await this.repository.readJson(this.repository.resolve("product.json"), productSchema), resolved.bindings.product],
      [await this.repository.readJson(this.repository.resolve("initiatives", `${resolved.run.initiativeId}.json`), initiativeSchema), resolved.bindings.initiative],
      [await this.repository.readJson(this.repository.resolve("sessions", `charter-${resolved.charter.id}.json`), executionCharterSchema), resolved.bindings.charter],
      ...(!allowManagedRunningRun ? [[currentRun, resolved.bindings.run] as const] : []),
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
    if (allowManagedRunningRun && (currentRun.state !== "running" || currentRun.id !== resolved.run.id ||
        currentRun.productId !== resolved.run.productId || currentRun.initiativeId !== resolved.run.initiativeId ||
        currentRun.charterId !== resolved.run.charterId || canonicalDigest(currentRun.agent) !== resolved.bindings.agentSelectionDigest)) {
      throw new Error("Managed Run lineage or Agent Selection changed before staged apply")
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

  private buildStepLocalPrompt(
    charter: ExecutionCharter,
    plan: WorkflowPlan,
    step: WorkflowStep,
    context: string,
  ): string {
    const workflowStep = [
      `Step: ${step.title}`,
      `- Objective: ${step.objective}`,
      `- Preconditions: ${step.preconditions.join("; ")}`,
      `- Required outputs: ${step.outputs.join("; ")}`,
      `- Evidence criteria: ${step.evidenceCriteria.join("; ")}`,
      `- Effects: ${step.effectEnvelope.join(", ") || "none"}`,
      `- Stop conditions: ${step.stopConditions.join("; ")}`,
    ]
    return [
      "Execute only the confirmed GAEP Managed Run in the isolated staging workspace.",
      `Objective: ${charter.objective}`,
      `Workflow: ${plan.title}`,
      `Workflow strategy: ${plan.strategy}`,
      "Execute only this coordinator-authorized Workflow Step:",
      ...workflowStep,
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
    mode: ManagedExecutionMode,
  ): WorkflowStep[] {
    const ordered = compileManagedWorkflowOrder(plan)
    if (plan.strategy === "parallel-readonly") {
      if (charter.expectedEffects.length !== 1 || charter.expectedEffects[0] !== "observe" ||
          charter.permissions.some((permission) => permission.mode !== "deny") || tools.length > 0 ||
          plan.steps.some((step) => step.scope.write.length > 0 || step.scope.effects.length > 0 ||
            step.effectEnvelope.length !== 1 || step.effectEnvelope[0] !== "observe")) {
        throw new Error("Managed parallel-readonly execution requires tool-free, deny-only, observation-only steps with no write or effect scopes")
      }
    }
    if (mode === "codex-staged" && ordered.length !== 1) {
      throw new Error("Managed Codex staging currently supports exactly one Workflow Step; multi-step staging fails closed until one isolated stage can be safely continued across steps")
    }
    const agentIds = new Set([run.agent.agentId, run.agent.adapterId])
    const packIds = new Set(packs.map((pack) => pack.id))
    const toolIds = new Set(tools.map((tool) => tool.id))
    const usedPackIds = new Set<string>()
    const usedToolIds = new Set<string>()
    const usedEffects = new Set<ExecutionCharter["expectedEffects"][number]>()
    for (const step of plan.steps) {
      if (step.responsibility.kind !== "agent" || !agentIds.has(step.responsibility.id)) {
        throw new Error("Every managed Workflow step must be assigned to the exact selected Agent")
      }
      if (new Set(step.contextPacks.map((binding) => binding.recordId)).size !== step.contextPacks.length) {
        throw new Error(`Workflow Step ${step.id} Context bindings must be unique`)
      }
      if (new Set(step.toolDefinitions.map((binding) => binding.recordId)).size !== step.toolDefinitions.length) {
        throw new Error(`Workflow Step ${step.id} Tool bindings must be unique`)
      }
      for (const binding of step.contextPacks) {
        const pack = packs.find((candidate) => candidate.id === binding.recordId)
        if (!packIds.has(binding.recordId) || !pack) {
          throw new Error("Workflow Step Context bindings must be included in the exact Plan Context inventory")
        }
        this.assertExactReference(binding, pack, "Workflow Step Context Pack")
        usedPackIds.add(pack.id)
      }
      for (const binding of step.toolDefinitions) {
        const tool = tools.find((candidate) => candidate.id === binding.recordId)
        if (!toolIds.has(binding.recordId) || !tool) {
          throw new Error("Workflow Step Tool bindings must be included in the exact Plan Tool inventory")
        }
        this.assertExactReference(binding, tool, "Workflow Step Tool")
        usedToolIds.add(tool.id)
      }
      if (step.effectEnvelope.some((effect) => !charter.expectedEffects.includes(effect))) {
        throw new Error("Workflow Step effects exceed the confirmed Charter")
      }
      for (const effect of step.effectEnvelope) usedEffects.add(effect)
    }
    if (canonicalDigest([...packIds].sort()) !== canonicalDigest([...usedPackIds].sort())) {
      throw new Error("Workflow Plan Context inventory contains declarations that no Workflow Step uses")
    }
    if (canonicalDigest([...toolIds].sort()) !== canonicalDigest([...usedToolIds].sort())) {
      throw new Error("Workflow Plan Tool inventory contains declarations that no Workflow Step uses")
    }
    if (canonicalDigest([...usedEffects].sort()) !== canonicalDigest([...charter.expectedEffects].sort())) {
      throw new Error("Confirmed Charter effect inventory contains declarations that no Workflow Step uses")
    }
    return ordered
  }

  private compileWriteEnvelope(plan: WorkflowPlan, charter: ExecutionCharter): string[] {
    if ((charter.managedIntent?.requestedScopes ?? []).some((scope) => scope.kind !== "workspace-relative")) {
      throw new Error("The current local managed runtime cannot enforce logical or external requested scopes and fails closed")
    }
    const planScopes = [...new Set(plan.steps.flatMap((step) => step.scope.write.map((scope) => {
      if (scope.kind !== "workspace-relative") {
        throw new Error("Managed staged workspace writes require workspace-relative Workflow Step scopes")
      }
      return scope.path
    })))].sort()
    const intentScopes = [...new Set((charter.managedIntent?.requestedScopes ?? [])
      .filter((scope): scope is { kind: "workspace-relative"; path: string } => scope.kind === "workspace-relative")
      .map((scope) => scope.path))].sort()
    if (canonicalDigest(planScopes) !== canonicalDigest(intentScopes)) {
      throw new Error("Workflow Step write scopes must exactly match the confirmed managed workspace write envelope")
    }
    if (charter.expectedEffects.includes("reversible-change") && intentScopes.length === 0) {
      throw new Error("Reversible managed change requires a non-empty exact workspace write envelope")
    }
    return intentScopes
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
    if (effect === "reversible-change") {
      if (staging?.applyState === "applied") return "applied"
      if (["unknown", "conflict"].includes(state) || staging?.applyState === "conflict") return "unknown"
      if (["failed", "cancelled", "timed-out", "discarded"].includes(state)) return "blocked"
      return staging?.changes.length ? "observed-provisional" : "not-observed"
    }
    if (["failed", "cancelled", "timed-out", "discarded"].includes(state)) return "blocked"
    if (["unknown", "conflict"].includes(state)) return "unknown"
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

  private applyDecisionPath(id: string): string {
    return this.repository.resolve("sessions", `managed-apply-decision-${id}.json`)
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
    if ((input.evaluatePostconditions === undefined) !== (input.postconditionEvaluator === undefined)) {
      throw new Error("A postcondition evaluator callback and its exact identity must be supplied together")
    }
    if (input.postconditionTimeoutMs !== undefined && (!input.evaluatePostconditions ||
        !Number.isSafeInteger(input.postconditionTimeoutMs) || input.postconditionTimeoutMs < 1 ||
        input.postconditionTimeoutMs > 24 * 60 * 60 * 1_000)) {
      throw new Error("A bounded postcondition timeout requires an evaluator and must be between 1 ms and 24 hours")
    }
    if (completion.requiresWorkflowGateEvaluator && !input.evaluateWorkflowGate) {
      throw new Error("Restarted staged apply requires an explicit Workflow gate evaluator")
    }
    if (input.postconditionEvaluator) assertEvaluatorIdentity(input.postconditionEvaluator, "Postcondition evaluator")
    const stagedEvidence = current.evidence.staging
    if (!stagedEvidence || stagedEvidence.applyState !== "pending") {
      throw new Error("Managed Run has no exact pending staging evidence")
    }
    const inspected = completion.codexReview.inspection
    if (
      inspected.baselineDigest !== stagedEvidence.baselineDigest ||
      inspected.finalDigest !== stagedEvidence.finalDigest ||
      canonicalDigest(inspected.changes) !== canonicalDigest(stagedEvidence.changes)
    ) {
      throw new Error("Machine-local staged inspection no longer matches the exact persisted review evidence")
    }
    await completion.codexReview.verifyExactInspection()
    const { record: applying, receipt } = await this.transitionForApply(current, resolved, input.confirmation, actorId)
    let appliedRuntime: ManagedRuntimeResultEnvelope | undefined
    let appliedState: NonNullable<ManagedRunEvidence["staging"]>["applyState"] | undefined
    try {
      const runtime = await completion.codexReview.apply({
        authorizationId: canonicalDigest(receipt),
        approvedPaths: receipt.changedInventory.map((change) => change.path),
        evaluatePostconditions: input.evaluatePostconditions,
        postconditionTimeoutMs: input.postconditionTimeoutMs,
      })
      appliedRuntime = runtime
      const applyState = runtime.portable.staging?.applied
        ? "applied"
        : runtime.portable.staging?.applyJournalDigest
          ? "conflict"
          : "not-applied"
      appliedState = applyState
      const journalPath = runtime.local.applyJournalPath
      const journalDigest = runtime.portable.staging?.applyJournalDigest
      if (journalPath && journalDigest) {
        this.journals.set(current.record.id, {
          digest: journalDigest,
          disposed: false,
        })
      }
      const applyCompletion = input.evaluateWorkflowGate
        ? { ...completion, gateEvaluator: input.evaluateWorkflowGate }
        : completion
      const workflow = await this.finalizeAppliedWorkflow(applyCompletion, resolved, runtime, applying.id, actorId)
      const governedRuntime = workflow.terminalReasonCode === "workflow-completed"
        ? runtime
        : {
            ...runtime,
            portable: {
              ...runtime.portable,
              postconditionStatus: applyState === "conflict"
                ? "indeterminate" as const
                : runtime.portable.postconditionStatus === "not-assessed"
                  ? "not-assessed" as const
                  : "failed" as const,
            },
          }
      const state = applyState === "conflict"
        ? "conflict"
        : terminalState(
            governedRuntime.portable.terminalDisposition,
            "normal",
            governedRuntime.portable.postconditionStatus,
            false,
          )
      const persisted = await this.persistRuntimeResult(
        applying,
        resolved,
        governedRuntime,
        workflow,
        state,
        "normal",
        applyState,
        input.evaluatePostconditions ? "postcondition-evaluator" : "not-evaluated",
        undefined,
        actorId,
        receipt,
        input.postconditionEvaluator,
        current.evidence,
        current.result.warnings,
      )
      return persisted
    } catch (error) {
      const latest = await this.read(applying.id).catch(() => applying)
      if (error instanceof ManagedCodexPreJournalApplyError && latest.state === "applying") {
        await this.restorePortableReviewAfterPreJournalFailure(latest, actorId)
        throw error
      }
      if (latest.state !== "applying") {
        return this.readCurrentArtifacts(latest.id)
      }
      if (appliedRuntime && appliedState) {
        const verificationRuntime: ManagedRuntimeResultEnvelope = {
          ...appliedRuntime,
          portable: {
            ...appliedRuntime.portable,
            postconditionStatus: "indeterminate",
          },
        }
        const fallback = await this.persistRuntimeResult(
          latest,
          resolved,
          verificationRuntime,
          this.postApplyVerificationFailureWorkflow(completion.workflow, verificationRuntime),
          appliedState === "conflict" ? "conflict" : "unknown",
          "normal",
          appliedState,
          input.evaluatePostconditions ? "postcondition-evaluator" : "not-evaluated",
          undefined,
          actorId,
          receipt,
          input.postconditionEvaluator,
          current.evidence,
          current.result.warnings,
        ).catch(() => undefined)
        if (fallback) return fallback
      }
      throw error
    }
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
    if (binding?.disposed) return
    const record = await this.read(managedRunId)
    if (!record.resultId) throw new Error("Apply journal cannot be disposed before result evidence is committed")
    const result = await this.readResult(record.resultId)
    const evidence = await this.readEvidence(result.evidenceId)
    const journalDigest = evidence.staging?.applyJournalDigest
    if (!journalDigest || (binding && journalDigest !== binding.digest)) {
      throw new Error("Committed evidence does not match the retained local apply journal")
    }
    await this.stageRegistry.disposeRetainedJournal(managedRunId, journalDigest as `sha256:${string}`)
    if (binding) binding.disposed = true
  }

  hasJournal(managedRunId: string): boolean {
    const binding = this.journals.get(managedRunId)
    return binding !== undefined && !binding.disposed
  }
}

class ManagedExecutionReviewHandle implements ManagedExecutionReview {
  private operationInProgress = false

  constructor(
    private readonly service: ManagedExecutionService,
    private persisted: PersistedArtifacts,
    private readonly resolved: ResolvedExecution,
    private readonly runtimeCompletion: RuntimeCompletion,
  ) {}

  get record(): ManagedRunRecord { return structuredClone(this.persisted.record) }
  get result(): ManagedRunResult { return structuredClone(this.persisted.result) }
  get evidence(): ManagedRunEvidence { return structuredClone(this.persisted.evidence) }
  get canApply(): boolean { return this.persisted.record.state === "review-required" && this.runtimeCompletion.codexReview !== undefined }
  get canDiscard(): boolean {
    return ["review-required", "conflict"].includes(this.persisted.record.state) && this.runtimeCompletion.codexReview !== undefined
  }
  get hasLocalJournal(): boolean { return this.service.hasJournal(this.persisted.record.id) }
  get applyConfirmation(): ManagedExecutionApplyConfirmation | undefined {
    return this.canApply ? exactApplyConfirmation(this.persisted, this.resolved) : undefined
  }

  async apply(input: ManagedExecutionApplyInput, actorId: string): Promise<ManagedExecutionReview> {
    if (!this.canApply) throw new Error("Managed Run is not awaiting staged apply review")
    if (this.operationInProgress) throw new Error("A Managed Run review decision is already in progress")
    this.operationInProgress = true
    try {
      this.persisted = await this.service.applyReview(
        this.persisted,
        this.resolved,
        this.runtimeCompletion,
        input,
        actorId,
      )
      this.runtimeCompletion.workflow = this.persisted.evidence.workflow
      this.service.syncPendingReview(this)
      return this
    } catch (error) {
      this.persisted = await this.service.readCurrentArtifacts(this.persisted.record.id).catch(() => this.persisted)
      this.service.syncPendingReview(this)
      throw error
    } finally {
      this.operationInProgress = false
    }
  }

  async discard(actorId: string): Promise<ManagedExecutionReview> {
    if (!this.canDiscard) throw new Error("Managed Run is not awaiting staged discard review")
    if (this.operationInProgress) throw new Error("A Managed Run review decision is already in progress")
    this.operationInProgress = true
    try {
      this.persisted = await this.service.discardReview(
        this.persisted,
        this.resolved,
        this.runtimeCompletion,
        actorId,
      )
      this.runtimeCompletion.workflow = this.persisted.evidence.workflow
      this.service.syncPendingReview(this)
      return this
    } catch (error) {
      const durable = await this.service.readCurrentArtifacts(this.persisted.record.id).catch(() => undefined)
      if (durable?.record.state === "discarded") {
        this.persisted = durable
        this.runtimeCompletion.workflow = durable.evidence.workflow
        this.service.syncPendingReview(this)
        return this
      }
      throw error
    } finally {
      this.operationInProgress = false
    }
  }

  async disposeLocalJournal(): Promise<void> {
    await this.service.disposeJournal(this.persisted.record.id)
  }
}

class FinalManagedExecutionReview implements ManagedExecutionReview {
  constructor(
    private readonly service: ManagedExecutionService,
    private readonly persisted: PersistedArtifacts,
  ) {}

  get record(): ManagedRunRecord { return structuredClone(this.persisted.record) }
  get result(): ManagedRunResult { return structuredClone(this.persisted.result) }
  get evidence(): ManagedRunEvidence { return structuredClone(this.persisted.evidence) }
  get canApply(): boolean { return false }
  get canDiscard(): boolean { return false }
  get hasLocalJournal(): boolean { return this.service.hasJournal(this.persisted.record.id) }
  get applyConfirmation(): undefined { return undefined }

  async apply(): Promise<ManagedExecutionReview> {
    throw new Error("Managed Run review is already final")
  }

  async discard(): Promise<ManagedExecutionReview> {
    return this
  }

  async disposeLocalJournal(): Promise<void> {
    await this.service.disposeJournal(this.persisted.record.id)
  }
}
