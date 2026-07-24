import { z } from "zod"

import { effectDescriptorSchema, executionWorkspaceScopeSchema, runSchema } from "./execution.js"
import { initiativeSchema } from "./product.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const portableCodeSchema = z.string().regex(/^[a-z][a-z0-9.-]{0,127}$/)
const uuidSchema = z.string().uuid()
const portableProviderTextSchema = z.string().trim().min(1).max(1_024).superRefine((value, context) => {
  if (value.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(value) || value.startsWith("~") || value.includes("\\")) {
    context.addIssue({ code: "custom", message: "Portable provider metadata must not contain a machine-local path" })
  }
  if (/\b(?:token|secret|password|api[_-]?key|authorization)\s*[:=]/iu.test(value) || /\b(?:sk|rk)-[A-Za-z0-9_-]{12,}\b/u.test(value)) {
    context.addIssue({ code: "custom", message: "Portable provider metadata must not contain secret-shaped values" })
  }
})

/**
 * Managed-execution records deliberately contain no prompt, context content,
 * provider output, executable path, process identifier, or machine
 * fingerprint. Arbitrary provider text is represented only by bounded
 * metadata and a digest after local redaction.
 */
export const managedExecutionModeSchema = z.enum([
  "codex-staged",
  "manual-offline",
  "claude-context-only",
])

export const managedRunStateSchema = z.enum([
  "prepared",
  "running",
  "review-required",
  "applying",
  "completed",
  "failed",
  "cancelled",
  "timed-out",
  "unknown",
  "conflict",
  "discarded",
])

export const managedProviderDispositionSchema = z.enum([
  "completed",
  "failed",
  "cancelled",
  "interrupted",
  "crashed",
  "protocol-error",
  "unknown",
])

export const managedOutcomeStatusSchema = z.enum([
  "satisfied",
  "failed",
  "not-assessed",
  "indeterminate",
])

export const managedTerminationCauseSchema = z.enum([
  "normal",
  "cancel-request",
  "timeout",
  "provider-failure",
  "process-loss",
  "protocol-error",
])

export const managedWarningCodeSchema = z.enum([
  "provider-warning-redacted",
  "provider-output-redacted",
  "coordinator-failure",
  "runtime-output-truncated",
  "staging-read-confinement-unattested",
  "postcondition-evaluator-failed",
  "local-cleanup-pending",
  "local-cleanup-failed",
  "runtime-warning",
])

export const managedExactBindingSchema = z.object({
  recordType: z.enum([
    "product",
    "initiative",
    "execution-charter",
    "run",
    "context-pack",
    "workflow-plan",
    "run-tool-selection",
    "tool-definition",
  ]),
  recordId: uuidSchema,
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

export const managedRunBindingsSchema = z.object({
  product: managedExactBindingSchema,
  initiative: managedExactBindingSchema,
  charter: managedExactBindingSchema,
  run: managedExactBindingSchema,
  agentSelectionDigest: digestSchema,
  contextPacks: z.array(managedExactBindingSchema).max(128),
  workflowPlan: managedExactBindingSchema.optional(),
  runToolSelection: managedExactBindingSchema.optional(),
  tools: z.array(managedExactBindingSchema).max(128),
}).strict().superRefine((bindings, context) => {
  const expectedTypes: Array<[z.infer<typeof managedExactBindingSchema>, z.infer<typeof managedExactBindingSchema>["recordType"]]> = [
    [bindings.product, "product"],
    [bindings.initiative, "initiative"],
    [bindings.charter, "execution-charter"],
    [bindings.run, "run"],
  ]
  if (bindings.workflowPlan) expectedTypes.push([bindings.workflowPlan, "workflow-plan"])
  if (bindings.runToolSelection) expectedTypes.push([bindings.runToolSelection, "run-tool-selection"])
  for (const [binding, expected] of expectedTypes) {
    if (binding.recordType !== expected) {
      context.addIssue({ code: "custom", message: `Managed binding must have record type ${expected}` })
    }
  }
  if (bindings.contextPacks.some((binding) => binding.recordType !== "context-pack")) {
    context.addIssue({ code: "custom", path: ["contextPacks"], message: "Context bindings must reference Context Packs" })
  }
  if (bindings.tools.some((binding) => binding.recordType !== "tool-definition")) {
    context.addIssue({ code: "custom", path: ["tools"], message: "Tool bindings must reference Tool Definitions" })
  }
  for (const [path, values] of [["contextPacks", bindings.contextPacks], ["tools", bindings.tools]] as const) {
    if (new Set(values.map((value) => value.recordId)).size !== values.length) {
      context.addIssue({ code: "custom", path: [path], message: "Managed bindings must be unique by record identity" })
    }
  }
})

export const managedProviderBindingSchema = z.object({
  adapterId: portableCodeSchema,
  agentId: portableCodeSchema,
  modelId: portableProviderTextSchema,
  capabilityDigest: digestSchema,
  runtimeVersion: portableProviderTextSchema.optional(),
}).strict()

const eventBaseShape = {
  sequence: z.number().int().nonnegative(),
  observedAt: z.string().datetime(),
  providerThreadRef: digestSchema.optional(),
  providerTurnRef: digestSchema.optional(),
}

export const managedEvidenceEventSchema = z.discriminatedUnion("type", [
  z.object({
    ...eventBaseShape,
    type: z.literal("lifecycle"),
    phase: z.enum([
      "initialized",
      "thread-started",
      "thread-resumed",
      "turn-started",
      "turn-completed",
      "cancelled",
      "restarted",
    ]),
    turnStatus: z.enum(["completed", "interrupted", "failed"]).optional(),
  }).strict(),
  z.object({
    ...eventBaseShape,
    type: z.literal("output"),
    channel: z.enum(["assistant", "reasoning", "plan", "command", "file-change"]),
    contentDigest: digestSchema,
    byteLength: z.number().int().nonnegative().max(16 * 1024 * 1024),
    redactionCount: z.number().int().nonnegative().max(1_000_000),
  }).strict(),
  z.object({
    ...eventBaseShape,
    type: z.literal("item"),
    itemRef: digestSchema,
    itemType: portableCodeSchema,
    status: z.enum(["started", "completed"]),
  }).strict(),
  z.object({
    ...eventBaseShape,
    type: z.literal("approval"),
    requestRef: digestSchema,
    approvalKind: z.enum(["command", "file-change", "permissions", "unsupported"]),
    outcome: z.enum(["allowed-once", "denied", "unsupported"]),
    authorizationRef: digestSchema.optional(),
  }).strict(),
  z.object({
    ...eventBaseShape,
    type: z.literal("warning"),
    code: managedWarningCodeSchema,
    contentDigest: digestSchema.optional(),
  }).strict(),
  z.object({
    ...eventBaseShape,
    type: z.literal("error"),
    code: portableCodeSchema,
    retryable: z.boolean(),
    contentDigest: digestSchema.optional(),
  }).strict(),
])

export const managedChangedFileEvidenceSchema = z.object({
  path: executionWorkspaceScopeSchema.refine((path) => path !== ".", "A changed-file path must name a file"),
  kind: z.enum(["added", "modified", "deleted"]),
  beforeDigest: digestSchema.optional(),
  afterDigest: digestSchema.optional(),
  beforeSize: z.number().int().nonnegative().optional(),
  afterSize: z.number().int().nonnegative().optional(),
  beforeMode: z.number().int().nonnegative().max(0o777).optional(),
  afterMode: z.number().int().nonnegative().max(0o777).optional(),
}).strict().superRefine((change, context) => {
  const hasBefore = change.beforeDigest !== undefined && change.beforeSize !== undefined && change.beforeMode !== undefined
  const hasAfter = change.afterDigest !== undefined && change.afterSize !== undefined && change.afterMode !== undefined
  if ((change.kind === "added" && (hasBefore || !hasAfter)) ||
      (change.kind === "deleted" && (!hasBefore || hasAfter)) ||
      (change.kind === "modified" && (!hasBefore || !hasAfter))) {
    context.addIssue({ code: "custom", message: `Incomplete ${change.kind} file evidence` })
  }
})

export const managedWorkflowGateAssessmentSchema = z.object({
  phase: z.enum([
    "preconditions",
    "outputs",
    "evidence",
    "stop-conditions",
    "charter-evidence",
    "charter-stop-conditions",
  ]),
  interpretation: z.enum(["criteria-satisfied", "stop-boundary-complied"]),
  criteriaDigest: digestSchema,
  status: z.enum(["satisfied", "failed", "not-assessed"]),
  basis: z.enum(["human-attestation", "system-evaluator", "deterministic-offline-runtime", "not-evaluated"]),
  evidenceDigest: digestSchema.optional(),
  actor: z.object({
    kind: z.enum(["human", "system"]),
    id: portableProviderTextSchema,
  }).strict(),
  evaluator: z.object({
    kind: z.enum(["human", "system"]),
    id: portableProviderTextSchema,
    version: portableProviderTextSchema,
    digest: digestSchema,
  }).strict(),
  assessedAt: z.string().datetime(),
}).strict().superRefine((assessment, context) => {
  const stopPhase = assessment.phase === "stop-conditions" || assessment.phase === "charter-stop-conditions"
  if (stopPhase !== (assessment.interpretation === "stop-boundary-complied")) {
    context.addIssue({
      code: "custom",
      path: ["interpretation"],
      message: "Stop-condition gates must explicitly mean that the declared stop boundary was complied with",
    })
  }
  if (assessment.status !== "not-assessed" && assessment.basis === "not-evaluated") {
    context.addIssue({ code: "custom", path: ["basis"], message: "Assessed Workflow gates require an explicit assessment basis" })
  }
  if (assessment.status !== "not-assessed" && !assessment.evidenceDigest) {
    context.addIssue({ code: "custom", path: ["evidenceDigest"], message: "Assessed Workflow gates require evidence" })
  }
  if (assessment.actor.kind !== assessment.evaluator.kind || assessment.actor.id !== assessment.evaluator.id) {
    context.addIssue({ code: "custom", path: ["evaluator"], message: "Workflow gate attribution must match its exact evaluator identity" })
  }
  if ((assessment.basis === "human-attestation") !== (assessment.evaluator.kind === "human")) {
    context.addIssue({ code: "custom", path: ["basis"], message: "Human attestations require a human evaluator and system assessments require a system evaluator" })
  }
})

export const managedWorkflowStepAttemptSchema = z.object({
  id: uuidSchema,
  revision: z.number().int().positive(),
  previousSnapshotDigest: digestSchema.optional(),
  stepId: uuidSchema,
  stepIndex: z.number().int().nonnegative().max(511),
  attempt: z.number().int().positive().max(10),
  state: z.enum(["blocked", "completed", "failed", "cancelled", "timed-out", "unknown", "review-required", "discarded"]),
  dependencies: z.array(uuidSchema).max(256),
  contextPacks: z.array(managedExactBindingSchema).max(32),
  tools: z.array(managedExactBindingSchema).max(32),
  effectEnvelope: z.array(effectDescriptorSchema).max(16),
  eventRange: z.object({
    startSequence: z.number().int().nonnegative(),
    endSequence: z.number().int().nonnegative(),
  }).strict().optional(),
  providerDisposition: managedProviderDispositionSchema.optional(),
  terminationCause: managedTerminationCauseSchema.optional(),
  postconditionStatus: managedOutcomeStatusSchema,
  retryReasonCode: portableCodeSchema.optional(),
  gates: z.object({
    preconditions: managedWorkflowGateAssessmentSchema,
    outputs: managedWorkflowGateAssessmentSchema,
    evidence: managedWorkflowGateAssessmentSchema,
    stopConditions: managedWorkflowGateAssessmentSchema,
  }).strict(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
}).strict().superRefine((attempt, context) => {
  if ((attempt.revision === 1) === (attempt.previousSnapshotDigest !== undefined)) {
    context.addIssue({
      code: "custom",
      path: ["previousSnapshotDigest"],
      message: "Workflow attempt revision 1 forbids a predecessor and later revisions require one",
    })
  }
  const expectedPhases = {
    preconditions: "preconditions",
    outputs: "outputs",
    evidence: "evidence",
    stopConditions: "stop-conditions",
  } as const
  for (const [key, phase] of Object.entries(expectedPhases) as Array<[keyof typeof expectedPhases, typeof expectedPhases[keyof typeof expectedPhases]]>) {
    if (attempt.gates[key].phase !== phase) {
      context.addIssue({ code: "custom", path: ["gates", key, "phase"], message: `Workflow gate must use phase ${phase}` })
    }
  }
  if (attempt.eventRange && attempt.eventRange.endSequence < attempt.eventRange.startSequence) {
    context.addIssue({ code: "custom", path: ["eventRange"], message: "Workflow attempt event range must be ordered" })
  }
  if (Date.parse(attempt.endedAt) < Date.parse(attempt.startedAt)) {
    context.addIssue({ code: "custom", path: ["endedAt"], message: "Workflow attempt cannot end before it starts" })
  }
  if (attempt.state === "completed" && (
    attempt.gates.preconditions.status !== "satisfied" ||
    attempt.gates.outputs.status !== "satisfied" ||
    attempt.gates.evidence.status !== "satisfied" ||
    attempt.gates.stopConditions.status !== "satisfied" ||
    attempt.providerDisposition !== "completed" ||
    attempt.postconditionStatus !== "satisfied"
  )) {
    context.addIssue({ code: "custom", path: ["state"], message: "A completed Workflow attempt requires every explicit gate and provider postcondition to be satisfied" })
  }
})

export const managedWorkflowExecutionSchema = z.object({
  plan: managedExactBindingSchema,
  strategy: z.enum(["sequential", "parallel-readonly"]),
  orderedStepIds: z.array(uuidSchema).min(1).max(512),
  attempts: z.array(managedWorkflowStepAttemptSchema).max(5_120),
  completedStepIds: z.array(uuidSchema).max(512),
  charterGates: z.object({
    requiredEvidence: managedWorkflowGateAssessmentSchema,
    stopConditions: managedWorkflowGateAssessmentSchema,
  }).strict(),
  terminalReasonCode: portableCodeSchema,
  capabilityBoundary: z.literal("natural-language-gates-require-explicit-human-or-system-assessment"),
}).strict().superRefine((workflow, context) => {
  if (workflow.plan.recordType !== "workflow-plan") {
    context.addIssue({ code: "custom", path: ["plan", "recordType"], message: "Workflow execution must bind a Workflow Plan" })
  }
  if (new Set(workflow.orderedStepIds).size !== workflow.orderedStepIds.length) {
    context.addIssue({ code: "custom", path: ["orderedStepIds"], message: "Workflow execution step order must be unique" })
  }
  if (new Set(workflow.completedStepIds).size !== workflow.completedStepIds.length ||
      workflow.completedStepIds.some((id) => !workflow.orderedStepIds.includes(id))) {
    context.addIssue({ code: "custom", path: ["completedStepIds"], message: "Completed Workflow steps must be a unique subset of the compiled order" })
  }
  if (workflow.charterGates.requiredEvidence.phase !== "charter-evidence" ||
      workflow.charterGates.stopConditions.phase !== "charter-stop-conditions") {
    context.addIssue({ code: "custom", path: ["charterGates"], message: "Charter gates must use their exact phases" })
  }
  const attemptIds = new Set<string>()
  const attemptsByStep = new Map<string, number[]>()
  for (const attempt of workflow.attempts) {
    if (attemptIds.has(attempt.id)) {
      context.addIssue({ code: "custom", path: ["attempts"], message: "Workflow attempt identities must be unique" })
      break
    }
    attemptIds.add(attempt.id)
    if (!workflow.orderedStepIds.includes(attempt.stepId)) {
      context.addIssue({ code: "custom", path: ["attempts"], message: "Workflow attempts must reference the compiled step order" })
    }
    const values = attemptsByStep.get(attempt.stepId) ?? []
    values.push(attempt.attempt)
    attemptsByStep.set(attempt.stepId, values)
  }
  for (const values of attemptsByStep.values()) {
    values.sort((left, right) => left - right)
    if (values.some((value, index) => value !== index + 1)) {
      context.addIssue({ code: "custom", path: ["attempts"], message: "Workflow attempt numbers must be contiguous per step" })
      break
    }
  }
  const completedAttempts = [...new Set(workflow.attempts
    .filter((attempt) => attempt.state === "completed")
    .map((attempt) => attempt.stepId))].sort()
  if (JSON.stringify(completedAttempts) !== JSON.stringify([...workflow.completedStepIds].sort())) {
    context.addIssue({ code: "custom", path: ["completedStepIds"], message: "Completed Workflow steps must exactly equal completed attempt evidence" })
  }
  if (workflow.terminalReasonCode === "workflow-completed" && (
    workflow.completedStepIds.length !== workflow.orderedStepIds.length ||
    workflow.charterGates.requiredEvidence.status !== "satisfied" ||
    workflow.charterGates.stopConditions.status !== "satisfied"
  )) {
    context.addIssue({ code: "custom", path: ["terminalReasonCode"], message: "Workflow completion requires every step and both Charter-level gates" })
  }
})

export const managedApplyDecisionReceiptSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("managed-apply-decision"),
  id: uuidSchema,
  managedRunId: uuidSchema,
  managedRunRevision: z.number().int().positive(),
  runId: uuidSchema,
  productId: uuidSchema,
  bindingsDigest: digestSchema,
  reviewResultId: uuidSchema,
  reviewResultDigest: digestSchema,
  reviewEvidenceId: uuidSchema,
  reviewEvidenceDigest: digestSchema,
  changedInventory: z.array(managedChangedFileEvidenceSchema).max(20_000),
  changedInventoryDigest: digestSchema,
  writeEnvelope: z.array(executionWorkspaceScopeSchema).max(256),
  writeEnvelopeDigest: digestSchema,
  actor: z.object({ kind: z.literal("human"), id: portableProviderTextSchema }).strict(),
  decision: z.literal("apply-exact-reviewed-inventory"),
  decidedAt: z.string().datetime(),
  authorityBoundary: z.literal("apply-decision-is-exact-run-evidence-inventory-actor-and-scope"),
}).strict().superRefine((receipt, context) => {
  if (new Set(receipt.changedInventory.map((change) => change.path)).size !== receipt.changedInventory.length) {
    context.addIssue({ code: "custom", path: ["changedInventory"], message: "Apply decision changed paths must be unique" })
  }
  if (new Set(receipt.writeEnvelope).size !== receipt.writeEnvelope.length) {
    context.addIssue({ code: "custom", path: ["writeEnvelope"], message: "Apply decision write scopes must be unique" })
  }
  if (receipt.changedInventory.length > 0 && receipt.writeEnvelope.length === 0) {
    context.addIssue({ code: "custom", path: ["writeEnvelope"], message: "Changed files require a non-empty exact write envelope" })
  }
})

export const managedStagingEvidenceSchema = z.object({
  baselineDigest: digestSchema,
  finalDigest: digestSchema,
  changes: z.array(managedChangedFileEvidenceSchema).max(20_000),
  excludedPathCount: z.number().int().nonnegative().max(20_000),
  excludedPathSetDigest: digestSchema,
  applyState: z.enum(["pending", "applied", "conflict", "discarded", "not-applied"]),
  applyJournalDigest: digestSchema.optional(),
  applyDecision: z.object({ receiptId: uuidSchema, receiptDigest: digestSchema }).strict().optional(),
}).strict().superRefine((evidence, context) => {
  if (new Set(evidence.changes.map((change) => change.path)).size !== evidence.changes.length) {
    context.addIssue({ code: "custom", path: ["changes"], message: "Changed-file evidence paths must be unique" })
  }
  if ((evidence.applyState === "applied" || evidence.applyState === "conflict") && !evidence.applyJournalDigest) {
    context.addIssue({ code: "custom", path: ["applyJournalDigest"], message: "Applied and conflicting stages require journal evidence" })
  }
  if (evidence.applyJournalDigest && !evidence.applyDecision) {
    context.addIssue({ code: "custom", path: ["applyDecision"], message: "Apply journal evidence requires an exact apply-decision receipt" })
  }
})

export const managedActualEffectSchema = z.object({
  effect: effectDescriptorSchema,
  status: z.enum(["not-observed", "observed-provisional", "applied", "blocked", "unknown"]),
  evidenceDigest: digestSchema,
}).strict()

export const managedRunEvidenceSchema = z.object({
  schemaVersion: z.literal(2),
  kind: z.literal("managed-run-evidence"),
  id: uuidSchema,
  managedRunId: uuidSchema,
  runId: uuidSchema,
  productId: uuidSchema,
  bindingsDigest: digestSchema,
  events: z.array(managedEvidenceEventSchema).max(4_096),
  eventsDigest: digestSchema,
  workflow: managedWorkflowExecutionSchema,
  staging: managedStagingEvidenceSchema.optional(),
  actualEffects: z.array(managedActualEffectSchema).max(32),
  capturedAt: z.string().datetime(),
  authorityBoundary: z.literal("evidence-does-not-self-assert-outcome-or-authorization"),
}).strict().superRefine((evidence, context) => {
  for (let index = 0; index < evidence.events.length; index += 1) {
    if (evidence.events[index]!.sequence !== index) {
      context.addIssue({ code: "custom", path: ["events", index, "sequence"], message: "Evidence event sequence must be contiguous" })
      break
    }
  }
  if (new Set(evidence.actualEffects.map((effect) => effect.effect)).size !== evidence.actualEffects.length) {
    context.addIssue({ code: "custom", path: ["actualEffects"], message: "Actual effect descriptors must be unique" })
  }
})

export const managedRunResultSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("managed-run-result"),
  id: uuidSchema,
  managedRunId: uuidSchema,
  runId: uuidSchema,
  productId: uuidSchema,
  mode: managedExecutionModeSchema,
  provider: managedProviderBindingSchema,
  providerThreadRef: digestSchema.optional(),
  providerTurnRef: digestSchema.optional(),
  providerDisposition: managedProviderDispositionSchema,
  terminationCause: managedTerminationCauseSchema,
  outcome: z.object({
    status: managedOutcomeStatusSchema,
    basis: z.enum(["postcondition-evaluator", "deterministic-offline-runtime", "not-evaluated", "provider-failure"]),
    evaluator: z.object({
      kind: z.enum(["human", "system"]),
      id: portableProviderTextSchema,
      version: portableProviderTextSchema,
      digest: digestSchema,
    }).strict().optional(),
  }).strict(),
  terminalState: managedRunStateSchema.exclude(["prepared", "running", "applying"]),
  evidenceId: uuidSchema,
  evidenceDigest: digestSchema,
  previousResultId: uuidSchema.optional(),
  previousResultDigest: digestSchema.optional(),
  warnings: z.array(managedWarningCodeSchema).max(128),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  authorityBoundary: z.literal("provider-completion-does-not-equal-outcome-completion"),
}).strict().superRefine((result, context) => {
  if (Date.parse(result.endedAt) < Date.parse(result.startedAt)) {
    context.addIssue({ code: "custom", path: ["endedAt"], message: "Managed Run cannot end before it starts" })
  }
  if ((result.previousResultId === undefined) !== (result.previousResultDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["previousResultId"], message: "Managed result predecessor identity and digest must be present together" })
  }
  if (result.previousResultId === result.id) {
    context.addIssue({ code: "custom", path: ["previousResultId"], message: "Managed result cannot be its own predecessor" })
  }
  if ((result.outcome.basis === "postcondition-evaluator") !== (result.outcome.evaluator !== undefined)) {
    context.addIssue({ code: "custom", path: ["outcome", "evaluator"], message: "Postcondition outcomes require an exact evaluator identity and other outcome bases forbid one" })
  }
  if (result.terminalState === "completed" &&
      (result.providerDisposition !== "completed" || result.outcome.status !== "satisfied")) {
    context.addIssue({ code: "custom", path: ["terminalState"], message: "Completion requires provider completion and a satisfied outcome" })
  }
  if (result.terminalState === "review-required" && result.providerDisposition !== "completed") {
    context.addIssue({ code: "custom", path: ["terminalState"], message: "Apply review requires a normally completed provider turn" })
  }
  if (result.terminalState === "timed-out" && result.terminationCause !== "timeout") {
    context.addIssue({ code: "custom", path: ["terminationCause"], message: "Timed-out results require the timeout cause" })
  }
  if (result.terminalState === "cancelled" && result.terminationCause !== "cancel-request") {
    context.addIssue({ code: "custom", path: ["terminationCause"], message: "Cancelled results require an explicit cancel request" })
  }
})

export const managedWorkflowCheckpointBindingSchema = z.object({
  evidenceId: uuidSchema,
  evidenceDigest: digestSchema,
  nextStepIndex: z.number().int().positive().max(511),
  completedStepIdsDigest: digestSchema,
}).strict()

export const managedRunRecordSchema = z.object({
  schemaVersion: z.literal(2),
  kind: z.literal("managed-run"),
  id: uuidSchema,
  revision: z.number().int().positive(),
  runId: uuidSchema,
  productId: uuidSchema,
  initiativeId: uuidSchema,
  mode: managedExecutionModeSchema,
  state: managedRunStateSchema,
  bindings: managedRunBindingsSchema,
  bindingsDigest: digestSchema,
  bindingSnapshots: z.object({
    initiative: initiativeSchema.strict(),
    run: runSchema,
  }).strict(),
  provider: managedProviderBindingSchema,
  rootManagedRunId: uuidSchema,
  attemptNumber: z.number().int().positive().max(1_000_000),
  previousManagedRunId: uuidSchema.optional(),
  applyDecisionId: uuidSchema.optional(),
  applyDecisionDigest: digestSchema.optional(),
  resultId: uuidSchema.optional(),
  resultDigest: digestSchema.optional(),
  workflowCheckpoints: z.array(managedWorkflowCheckpointBindingSchema).max(511).optional(),
  recovery: z.object({
    status: z.enum(["not-required", "required", "recovered", "resume-unavailable"]),
    reasonCode: portableCodeSchema.optional(),
  }).strict(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
}).strict().superRefine((record, context) => {
  const terminal = ["completed", "failed", "cancelled", "timed-out", "unknown", "conflict", "discarded"].includes(record.state)
  if (terminal !== (record.endedAt !== undefined)) {
    context.addIssue({ code: "custom", path: ["endedAt"], message: "Terminal Managed Runs require an end time and non-terminal runs forbid one" })
  }
  if ((record.resultId === undefined) !== (record.resultDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["resultId"], message: "Managed Run result identity and digest must be present together" })
  }
  if ((record.applyDecisionId === undefined) !== (record.applyDecisionDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["applyDecisionId"], message: "Managed Run apply-decision identity and digest must be present together" })
  }
  if (record.workflowCheckpoints) {
    const evidenceIds = new Set<string>()
    let previousNextStepIndex = 0
    for (const [index, checkpoint] of record.workflowCheckpoints.entries()) {
      if (evidenceIds.has(checkpoint.evidenceId)) {
        context.addIssue({ code: "custom", path: ["workflowCheckpoints", index, "evidenceId"], message: "Workflow checkpoint evidence identities must be unique" })
      }
      evidenceIds.add(checkpoint.evidenceId)
      if (checkpoint.nextStepIndex <= previousNextStepIndex) {
        context.addIssue({ code: "custom", path: ["workflowCheckpoints", index, "nextStepIndex"], message: "Workflow checkpoints must advance the next step monotonically" })
      }
      previousNextStepIndex = checkpoint.nextStepIndex
    }
  }
  if (!record.previousManagedRunId && (record.rootManagedRunId !== record.id || record.attemptNumber !== 1)) {
    context.addIssue({ code: "custom", path: ["rootManagedRunId"], message: "An initial Managed Run must be lineage root attempt 1" })
  }
  if (record.previousManagedRunId && (record.rootManagedRunId === record.id || record.attemptNumber < 2)) {
    context.addIssue({ code: "custom", path: ["previousManagedRunId"], message: "A resumed Managed Run must continue an existing lineage" })
  }
  if (record.bindings.run.recordId !== record.runId || record.bindings.product.recordId !== record.productId) {
    context.addIssue({ code: "custom", path: ["bindings"], message: "Managed Run identity must match its exact bindings" })
  }
  if (
    record.bindingSnapshots.initiative.id !== record.bindings.initiative.recordId ||
    (record.bindingSnapshots.initiative.revision ?? 1) !== record.bindings.initiative.revision ||
    record.bindingSnapshots.run.id !== record.bindings.run.recordId ||
    (record.bindingSnapshots.run.revision ?? 1) !== record.bindings.run.revision
  ) {
    context.addIssue({ code: "custom", path: ["bindingSnapshots"], message: "Binding snapshot identities and revisions must match exact bindings" })
  }
})

export type ManagedExecutionMode = z.infer<typeof managedExecutionModeSchema>
export type ManagedRunState = z.infer<typeof managedRunStateSchema>
export type ManagedRunBindings = z.infer<typeof managedRunBindingsSchema>
export type ManagedProviderBinding = z.infer<typeof managedProviderBindingSchema>
export type ManagedEvidenceEvent = z.infer<typeof managedEvidenceEventSchema>
export type ManagedWorkflowGateAssessment = z.infer<typeof managedWorkflowGateAssessmentSchema>
export type ManagedWorkflowStepAttempt = z.infer<typeof managedWorkflowStepAttemptSchema>
export type ManagedWorkflowExecution = z.infer<typeof managedWorkflowExecutionSchema>
export type ManagedWorkflowCheckpointBinding = z.infer<typeof managedWorkflowCheckpointBindingSchema>
export type ManagedApplyDecisionReceipt = z.infer<typeof managedApplyDecisionReceiptSchema>
export type ManagedRunEvidence = z.infer<typeof managedRunEvidenceSchema>
export type ManagedRunResult = z.infer<typeof managedRunResultSchema>
export type ManagedRunRecord = z.infer<typeof managedRunRecordSchema>
