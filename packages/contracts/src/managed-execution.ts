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

export const managedStagingEvidenceSchema = z.object({
  baselineDigest: digestSchema,
  finalDigest: digestSchema,
  changes: z.array(managedChangedFileEvidenceSchema).max(20_000),
  excludedPathCount: z.number().int().nonnegative().max(20_000),
  excludedPathSetDigest: digestSchema,
  applyState: z.enum(["pending", "applied", "conflict", "discarded", "not-applied"]),
  applyJournalDigest: digestSchema.optional(),
}).strict().superRefine((evidence, context) => {
  if (new Set(evidence.changes.map((change) => change.path)).size !== evidence.changes.length) {
    context.addIssue({ code: "custom", path: ["changes"], message: "Changed-file evidence paths must be unique" })
  }
  if ((evidence.applyState === "applied" || evidence.applyState === "conflict") && !evidence.applyJournalDigest) {
    context.addIssue({ code: "custom", path: ["applyJournalDigest"], message: "Applied and conflicting stages require journal evidence" })
  }
})

export const managedActualEffectSchema = z.object({
  effect: effectDescriptorSchema,
  status: z.enum(["not-observed", "observed-provisional", "applied", "blocked", "unknown"]),
  evidenceDigest: digestSchema,
}).strict()

export const managedRunEvidenceSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("managed-run-evidence"),
  id: uuidSchema,
  managedRunId: uuidSchema,
  runId: uuidSchema,
  productId: uuidSchema,
  bindingsDigest: digestSchema,
  events: z.array(managedEvidenceEventSchema).max(4_096),
  eventsDigest: digestSchema,
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
  }).strict(),
  terminalState: managedRunStateSchema.exclude(["prepared", "running", "applying"]),
  evidenceId: uuidSchema,
  evidenceDigest: digestSchema,
  warnings: z.array(managedWarningCodeSchema).max(128),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  authorityBoundary: z.literal("provider-completion-does-not-equal-outcome-completion"),
}).strict().superRefine((result, context) => {
  if (Date.parse(result.endedAt) < Date.parse(result.startedAt)) {
    context.addIssue({ code: "custom", path: ["endedAt"], message: "Managed Run cannot end before it starts" })
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

export const managedRunRecordSchema = z.object({
  schemaVersion: z.literal(1),
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
  previousManagedRunId: uuidSchema.optional(),
  resultId: uuidSchema.optional(),
  resultDigest: digestSchema.optional(),
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
export type ManagedRunEvidence = z.infer<typeof managedRunEvidenceSchema>
export type ManagedRunResult = z.infer<typeof managedRunResultSchema>
export type ManagedRunRecord = z.infer<typeof managedRunRecordSchema>
