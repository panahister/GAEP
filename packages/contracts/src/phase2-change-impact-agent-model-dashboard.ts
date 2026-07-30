import { z } from "zod"

import { agentModelDashboardRequestSchema } from "./dashboard.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const countSchema = z.number().int().nonnegative().max(10_000_000)
const availabilitySchema = z.enum(["current", "attention-required", "unavailable"])

const exactRecordBindingSchema = z.object({
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

export const phase2ChangeImpactAgentModelDashboardRequestSchema = z.object({
  expectedProductId: z.string().uuid(),
  expectedProductRevision: z.number().int().positive(),
  expectedProductDigest: digestSchema,
  expectedInitiativeId: z.string().uuid(),
  expectedInitiativeRevision: z.number().int().positive(),
  expectedInitiativeDigest: digestSchema,
  agentModel: agentModelDashboardRequestSchema,
}).strict()

const dashboardFields = {
  schemaVersion: z.literal(1),
  kind: z.literal("phase-2-change-impact-agent-model-dashboard"),
  viewDefinitionVersion: z.literal("gaep-phase-2-change-impact-agent-model-dashboard-v1"),
  phase: z.object({ id: z.literal("phase-2-design"), label: z.literal("Phase 2 — UX and Figma Loop") }).strict(),
  product: z.object({ recordType: z.literal("product"), ...exactRecordBindingSchema.shape }).strict(),
  initiative: z.object({
    recordType: z.literal("initiative"), ...exactRecordBindingSchema.shape,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  sources: z.object({
    phase2UxFigmaSnapshotDigest: digestSchema,
    phase2SourceCatalogDigest: digestSchema,
    agentModelSnapshotDigest: digestSchema,
  }).strict(),
  synchronizationChange: z.object({
    state: z.enum(["candidate-current", "attention-required"]),
    designDelta: availabilitySchema,
    conflictResolution: availabilitySchema,
    humanDesignApproval: availabilitySchema,
    designBaseline: availabilitySchema,
    designDriftDetection: availabilitySchema,
    figmaConnectionState: z.literal("not-established"),
    figmaWriteExecutionState: z.literal("not-performed"),
    figmaImportExecutionState: z.literal("not-performed"),
    synchronizationEffectState: z.literal("not-applied"),
  }).strict(),
  impact: z.object({
    state: z.enum(["current-bounded-observation", "attention-required"]),
    coverage: z.literal("bounded-not-complete"),
    requirementCount: countSchema,
    designBindingCount: countSchema,
    unboundDesignItemCount: countSchema,
    driftObservationCount: countSchema,
    driftCount: countSchema,
    unassessedCount: countSchema,
    blockerCount: countSchema,
    highSeverityCount: countSchema,
    remediationCandidateCount: countSchema,
    staleBindingCount: countSchema,
    staleSourceReferenceCount: countSchema,
    unresolvedQuestionCount: countSchema,
    impactCompleteness: z.literal("not-established"),
    designValidity: z.literal("not-established"),
    revalidationState: z.literal("not-established"),
  }).strict(),
  agentModel: z.object({
    selectionState: z.enum(["unselected", "selected", "migration-required", "invalid"]),
    capabilities: z.object({
      shown: countSchema, total: countSchema, omitted: countSchema, detected: countSchema,
      unavailable: countSchema, selected: z.number().int().min(0).max(1),
    }).strict(),
    runs: z.object({
      shown: countSchema, total: countSchema, omitted: countSchema, terminal: countSchema,
      nonTerminal: countSchema, managedObserved: countSchema, resultBound: countSchema, actualEffectCount: countSchema,
    }).strict(),
    managedRuns: z.object({ shown: countSchema, total: countSchema, omitted: countSchema }).strict(),
    handoffs: z.object({
      shown: countSchema, total: countSchema, omitted: countSchema,
      pendingAcknowledgement: countSchema, acknowledged: countSchema,
    }).strict(),
    providerMetrics: z.object({ usage: z.literal("unavailable"), cost: z.literal("unavailable") }).strict(),
    liveProviderQuality: z.literal("not-assessed"),
    semanticOutputQuality: z.literal("not-assessed"),
  }).strict(),
  freshness: z.object({
    state: z.enum(["current", "attention-required"]),
    phase2State: z.enum(["candidate-complete-for-human-review", "attention-required"]),
    agentModelState: z.enum(["current", "attention-required"]),
    selectionCapabilityState: z.enum(["current", "unselected", "stale", "migration-required", "invalid"]),
    phase2ObservedAt: z.string().datetime(),
    agentModelObservedAt: z.string().datetime(),
    oldestCapabilityObservedAt: z.string().datetime(),
    newestCapabilityObservedAt: z.string().datetime(),
    truncated: z.boolean(),
  }).strict(),
  governance: z.object({
    humanDesignApproval: z.literal("not-established"),
    baselineDesignation: z.literal("not-established"),
    impactAcceptance: z.literal("not-established"),
    providerAccountReadiness: z.literal("not-established"),
    providerPreference: z.literal("not-established"),
    automaticSelectionAuthority: z.literal("not-granted"),
    runLaunchAuthority: z.literal("not-granted"),
    effectAuthority: z.literal("not-granted"),
    phaseReadinessAuthority: z.literal("not-established"),
    productOwnerAcceptance: z.literal("not-established"),
  }).strict(),
  evidenceCues: z.object({
    freshness: z.enum(["current", "potentially-stale", "unknown"]),
    confidence: z.object({ state: z.literal("not-assessed"), basis: z.literal("no-governed-confidence-evaluation-is-bound") }).strict(),
  }).strict(),
  observedAt: z.string().datetime(),
  sourceBoundary: z.literal("exact-derived-phase-2-dashboard-and-current-initiative-scoped-agent-model-metadata-only"),
  privacyBoundary: z.literal("dashboard-exposes-identities-digests-counts-statuses-and-times-not-design-content-prompts-provider-output-run-content-evidence-content-personal-data-secrets-credentials-permissions-or-machine-paths"),
  limitations: z.array(z.string().trim().min(4).max(1_000)).min(3).max(8),
  authorityBoundary: z.literal("phase-2-change-impact-agent-model-dashboard-is-derived-read-only-evidence-not-a-second-source-of-truth-impact-completeness-design-validity-provider-quality-selection-run-launch-approval-baseline-readiness-remediation-effect-release-or-action-authority"),
}

function validateDashboard(value: {
  synchronizationChange: { state: string; designDelta: string; conflictResolution: string; humanDesignApproval: string; designBaseline: string; designDriftDetection: string }
  impact: { state: string; driftObservationCount: number; driftCount: number; unassessedCount: number; staleBindingCount: number; staleSourceReferenceCount: number; unresolvedQuestionCount: number }
  agentModel: {
    capabilities: { shown: number; total: number; omitted: number; detected: number; unavailable: number; selected: number }
    runs: { shown: number; total: number; omitted: number; terminal: number; nonTerminal: number; managedObserved: number; resultBound: number }
    managedRuns: { shown: number; total: number; omitted: number }
    handoffs: { shown: number; total: number; omitted: number; pendingAcknowledgement: number; acknowledged: number }
  }
  freshness: { state: string; phase2State: string; agentModelState: string; phase2ObservedAt: string; agentModelObservedAt: string; oldestCapabilityObservedAt: string; newestCapabilityObservedAt: string; truncated: boolean }
  evidenceCues: { freshness: string }
  observedAt: string
}, context: z.RefinementCtx): void {
  const changeAttention = [
    value.synchronizationChange.designDelta,
    value.synchronizationChange.conflictResolution,
    value.synchronizationChange.humanDesignApproval,
    value.synchronizationChange.designBaseline,
    value.synchronizationChange.designDriftDetection,
  ].some((state) => state !== "current")
  if ((value.synchronizationChange.state === "attention-required") !== changeAttention) {
    context.addIssue({ code: "custom", path: ["synchronizationChange", "state"], message: "Synchronization state must expose every non-current governed source" })
  }
  const impactAttention = value.impact.driftCount > 0 || value.impact.unassessedCount > 0 ||
    value.impact.staleBindingCount > 0 || value.impact.staleSourceReferenceCount > 0 || value.impact.unresolvedQuestionCount > 0
  if (value.impact.driftCount + value.impact.unassessedCount > value.impact.driftObservationCount ||
      (value.impact.state === "attention-required") !== impactAttention) {
    context.addIssue({ code: "custom", path: ["impact"], message: "Impact state and drift counts must reconcile" })
  }
  const { capabilities, runs, managedRuns, handoffs } = value.agentModel
  if (capabilities.shown + capabilities.omitted !== capabilities.total ||
      capabilities.detected + capabilities.unavailable !== capabilities.shown ||
      runs.shown + runs.omitted !== runs.total || runs.terminal + runs.nonTerminal !== runs.shown ||
      runs.managedObserved > managedRuns.shown || runs.resultBound > runs.managedObserved ||
      managedRuns.shown + managedRuns.omitted !== managedRuns.total ||
      handoffs.shown + handoffs.omitted !== handoffs.total ||
      handoffs.pendingAcknowledgement + handoffs.acknowledged !== handoffs.shown) {
    context.addIssue({ code: "custom", path: ["agentModel"], message: "Agent, Run, Managed Run and handoff counts must reconcile" })
  }
  const freshnessAttention = value.freshness.phase2State === "attention-required" ||
    value.freshness.agentModelState === "attention-required" || value.freshness.truncated || changeAttention || impactAttention
  if ((value.freshness.state === "attention-required") !== freshnessAttention ||
      (value.evidenceCues.freshness === "current") === freshnessAttention) {
    context.addIssue({ code: "custom", path: ["freshness"], message: "Integrated freshness must expose source attention and bounded omissions" })
  }
  const sourceTimes = [value.freshness.phase2ObservedAt, value.freshness.agentModelObservedAt,
    value.freshness.oldestCapabilityObservedAt, value.freshness.newestCapabilityObservedAt].map(Date.parse)
  if (sourceTimes.some((time) => time > Date.parse(value.observedAt)) || sourceTimes[2]! > sourceTimes[3]!) {
    context.addIssue({ code: "custom", path: ["observedAt"], message: "Integrated observation cannot predate its governed sources" })
  }
}

export const phase2ChangeImpactAgentModelDashboardContentSchema = z.object(dashboardFields).strict().superRefine(validateDashboard)
export const phase2ChangeImpactAgentModelDashboardSchema = z.object({ ...dashboardFields, snapshotDigest: digestSchema }).strict().superRefine(validateDashboard)

export type Phase2ChangeImpactAgentModelDashboardRequest = z.infer<typeof phase2ChangeImpactAgentModelDashboardRequestSchema>
export type Phase2ChangeImpactAgentModelDashboard = z.infer<typeof phase2ChangeImpactAgentModelDashboardSchema>
