import { z } from "zod"

import { agentModelDashboardRequestSchema, agentModelDashboardSchema } from "./dashboard.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)

const exactRecordBindingSchema = z.object({
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

export const phase1AgentModelDashboardRequestSchema = z.object({
  expectedInitiativeId: z.string().uuid(),
  expectedInitiativeRevision: z.number().int().positive(),
  expectedInitiativeDigest: digestSchema,
  agentModel: agentModelDashboardRequestSchema,
}).strict()

const boundedCountSchema = z.number().int().nonnegative().max(1_000_000)

const phase1AgentModelDashboardFields = {
  schemaVersion: z.literal(1),
  kind: z.literal("phase-1-agent-model-dashboard"),
  phase: z.object({
    id: z.literal("phase-1b-product"),
    label: z.literal("Phase 1B — Product P0–P4"),
  }).strict(),
  product: z.object({ recordType: z.literal("product"), ...exactRecordBindingSchema.shape }).strict(),
  initiative: z.object({
    recordType: z.literal("initiative"),
    ...exactRecordBindingSchema.shape,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  source: z.object({
    agentModelSnapshotDigest: digestSchema,
    scope: z.literal("exact-current-initiative"),
  }).strict(),
  agentModel: agentModelDashboardSchema,
  executionTruth: z.object({
    capabilities: z.object({
      shown: boundedCountSchema,
      total: boundedCountSchema,
      omitted: boundedCountSchema,
      detected: boundedCountSchema,
      unavailable: boundedCountSchema,
      selected: z.number().int().min(0).max(1),
    }).strict(),
    runs: z.object({
      shown: boundedCountSchema,
      total: boundedCountSchema,
      omitted: boundedCountSchema,
      terminal: boundedCountSchema,
      nonTerminal: boundedCountSchema,
      managedObserved: boundedCountSchema,
      resultBound: boundedCountSchema,
      actualEffectCount: boundedCountSchema,
      outcomes: z.object({
        satisfied: boundedCountSchema,
        failed: boundedCountSchema,
        notAssessed: boundedCountSchema,
        indeterminate: boundedCountSchema,
      }).strict(),
    }).strict(),
    managedRuns: z.object({
      shown: boundedCountSchema,
      total: boundedCountSchema,
      omitted: boundedCountSchema,
    }).strict(),
    handoffs: z.object({
      shown: boundedCountSchema,
      total: boundedCountSchema,
      omitted: boundedCountSchema,
      pendingAcknowledgement: boundedCountSchema,
      acknowledged: boundedCountSchema,
    }).strict(),
    providerMetrics: z.object({
      usage: z.literal("unavailable"),
      cost: z.literal("unavailable"),
    }).strict(),
    liveProviderQuality: z.literal("not-assessed"),
    semanticOutputQuality: z.literal("not-assessed"),
  }).strict(),
  freshness: z.object({
    state: z.enum(["current", "attention-required"]),
    selectionCapabilityState: z.enum(["current", "unselected", "stale", "migration-required", "invalid"]),
    oldestCapabilityObservedAt: z.string().datetime(),
    newestCapabilityObservedAt: z.string().datetime(),
    agentModelObservedAt: z.string().datetime(),
    truncated: z.boolean(),
    basis: z.literal("exact-initiative-scoped-agent-model-snapshot-and-declared-bounded-coverage"),
  }).strict(),
  governance: z.object({
    providerAccountReadiness: z.literal("not-established"),
    providerPreference: z.literal("not-established"),
    automaticSelectionAuthority: z.literal("not-granted"),
    handoffAcknowledgementAuthority: z.literal("not-granted"),
    runLaunchAuthority: z.literal("not-granted"),
    effectAuthority: z.literal("not-granted"),
    phaseReadinessAuthority: z.literal("not-established"),
    productOwnerAcceptance: z.literal("not-established"),
  }).strict(),
  observedAt: z.string().datetime(),
  sourceBoundary: z.literal("current-governed-product-initiative-capability-selection-run-handoff-and-managed-evidence-metadata-only"),
  privacyBoundary: z.literal("dashboard-exposes-identities-digests-counts-statuses-times-and-redacted-selection-metadata-not-prompts-provider-output-run-content-evidence-content-personal-data-secrets-credentials-or-machine-paths"),
  limitations: z.array(z.string().trim().min(4).max(1_000)).min(1).max(8),
  authorityBoundary: z.literal("phase-1-agent-model-dashboard-is-read-only-observed-evidence-not-provider-quality-preference-automatic-selection-handoff-acknowledgement-run-launch-readiness-approval-effect-release-or-action-authority"),
}

function validatePhase1AgentModel(value: {
  product: { recordId: string; revision: number; digest: string }
  initiative: { recordId: string }
  source: { agentModelSnapshotDigest: string }
  agentModel: z.infer<typeof agentModelDashboardSchema>
  executionTruth: {
    capabilities: { shown: number; total: number; omitted: number; detected: number; unavailable: number; selected: number }
    runs: {
      shown: number; total: number; omitted: number; terminal: number; nonTerminal: number
      managedObserved: number; resultBound: number; actualEffectCount: number
      outcomes: { satisfied: number; failed: number; notAssessed: number; indeterminate: number }
    }
    managedRuns: { shown: number; total: number; omitted: number }
    handoffs: { shown: number; total: number; omitted: number; pendingAcknowledgement: number; acknowledged: number }
  }
  freshness: {
    state: string; selectionCapabilityState: string; oldestCapabilityObservedAt: string
    newestCapabilityObservedAt: string; agentModelObservedAt: string; truncated: boolean
  }
  observedAt: string
}, context: z.RefinementCtx): void {
  const dashboard = value.agentModel
  if (dashboard.product.recordId.toLowerCase() !== value.product.recordId.toLowerCase() ||
      dashboard.product.revision !== value.product.revision || dashboard.product.digest !== value.product.digest ||
      dashboard.snapshotDigest !== value.source.agentModelSnapshotDigest) {
    context.addIssue({ code: "custom", path: ["agentModel"], message: "Phase 1 Agent/Model source must bind the exact Product and snapshot" })
  }
  if (dashboard.runs.some((run) => run.initiativeId.toLowerCase() !== value.initiative.recordId.toLowerCase())) {
    context.addIssue({ code: "custom", path: ["agentModel", "runs"], message: "Every projected Run must target the exact Phase 1 Initiative" })
  }
  const runIds = new Set(dashboard.runs.map((run) => run.record.recordId.toLowerCase()))
  if (dashboard.handoffs.some((handoff) => !runIds.has(handoff.fromRun.recordId.toLowerCase()))) {
    context.addIssue({ code: "custom", path: ["agentModel", "handoffs"], message: "Every projected handoff must originate from an in-scope Initiative Run" })
  }

  const capabilities = value.executionTruth.capabilities
  const detected = dashboard.capabilities.filter((capability) => capability.detected).length
  const selected = dashboard.capabilities.filter((capability) => capability.selected).length
  if (capabilities.shown !== dashboard.capabilities.length || capabilities.total !== dashboard.limits.capabilities.total ||
      capabilities.omitted !== dashboard.limits.capabilities.omitted || capabilities.detected !== detected ||
      capabilities.unavailable !== dashboard.capabilities.length - detected || capabilities.selected !== selected ||
      capabilities.shown + capabilities.omitted !== capabilities.total) {
    context.addIssue({ code: "custom", path: ["executionTruth", "capabilities"], message: "Phase 1 capability truth counts must reconcile exactly" })
  }

  const terminalStates = new Set(["completed", "failed", "cancelled"])
  const managedObserved = dashboard.runs.filter((run) => run.managed.status === "observed")
  const boundResults = managedObserved.filter((run) => run.managed.status === "observed" && run.managed.result.status === "bound")
  const actualEffectCount = boundResults.reduce((sum, run) =>
    sum + (run.managed.status === "observed" && run.managed.result.status === "bound"
      ? run.managed.result.evidence.actualEffectCount
      : 0), 0)
  const outcomes = {
    satisfied: boundResults.filter((run) => run.managed.status === "observed" && run.managed.result.status === "bound" && run.managed.result.outcomeStatus === "satisfied").length,
    failed: boundResults.filter((run) => run.managed.status === "observed" && run.managed.result.status === "bound" && run.managed.result.outcomeStatus === "failed").length,
    notAssessed: boundResults.filter((run) => run.managed.status === "observed" && run.managed.result.status === "bound" && run.managed.result.outcomeStatus === "not-assessed").length,
    indeterminate: boundResults.filter((run) => run.managed.status === "observed" && run.managed.result.status === "bound" && run.managed.result.outcomeStatus === "indeterminate").length,
  }
  const runs = value.executionTruth.runs
  if (runs.shown !== dashboard.runs.length || runs.total !== dashboard.limits.runs.total ||
      runs.omitted !== dashboard.limits.runs.omitted || runs.terminal !== dashboard.runs.filter((run) => terminalStates.has(run.state)).length ||
      runs.nonTerminal !== dashboard.runs.filter((run) => !terminalStates.has(run.state)).length ||
      runs.managedObserved !== managedObserved.length || runs.resultBound !== boundResults.length ||
      runs.actualEffectCount !== actualEffectCount || runs.shown + runs.omitted !== runs.total ||
      outcomes.satisfied !== runs.outcomes.satisfied || outcomes.failed !== runs.outcomes.failed ||
      outcomes.notAssessed !== runs.outcomes.notAssessed || outcomes.indeterminate !== runs.outcomes.indeterminate ||
      Object.values(runs.outcomes).reduce((sum, count) => sum + count, 0) !== runs.resultBound) {
    context.addIssue({ code: "custom", path: ["executionTruth", "runs"], message: "Phase 1 Run and outcome truth counts must reconcile exactly" })
  }

  const managedRuns = value.executionTruth.managedRuns
  if (managedRuns.shown !== dashboard.limits.managedRuns.shown || managedRuns.total !== dashboard.limits.managedRuns.total ||
      managedRuns.omitted !== dashboard.limits.managedRuns.omitted || managedRuns.shown + managedRuns.omitted !== managedRuns.total) {
    context.addIssue({ code: "custom", path: ["executionTruth", "managedRuns"], message: "Phase 1 Managed Run coverage must reconcile exactly" })
  }
  const handoffs = value.executionTruth.handoffs
  const acknowledged = dashboard.handoffs.filter((handoff) => handoff.state === "acknowledged").length
  if (handoffs.shown !== dashboard.handoffs.length || handoffs.total !== dashboard.limits.handoffs.total ||
      handoffs.omitted !== dashboard.limits.handoffs.omitted || handoffs.acknowledged !== acknowledged ||
      handoffs.pendingAcknowledgement !== dashboard.handoffs.length - acknowledged ||
      handoffs.shown + handoffs.omitted !== handoffs.total) {
    context.addIssue({ code: "custom", path: ["executionTruth", "handoffs"], message: "Phase 1 handoff truth counts must reconcile exactly" })
  }

  if (value.freshness.state !== dashboard.freshness.state ||
      value.freshness.selectionCapabilityState !== dashboard.freshness.selectionCapabilityState ||
      value.freshness.oldestCapabilityObservedAt !== dashboard.freshness.oldestCapabilityObservedAt ||
      value.freshness.newestCapabilityObservedAt !== dashboard.freshness.newestCapabilityObservedAt ||
      value.freshness.agentModelObservedAt !== dashboard.observedAt || value.freshness.truncated !== dashboard.limits.truncated) {
    context.addIssue({ code: "custom", path: ["freshness"], message: "Phase 1 freshness must match the exact Agent/Model source" })
  }
  if (Date.parse(dashboard.observedAt) > Date.parse(value.observedAt)) {
    context.addIssue({ code: "custom", path: ["observedAt"], message: "Phase 1 dashboard observation cannot predate its Agent/Model source" })
  }
}

export const phase1AgentModelDashboardContentSchema = z.object(phase1AgentModelDashboardFields)
  .strict()
  .superRefine(validatePhase1AgentModel)

export const phase1AgentModelDashboardSchema = z.object({
  ...phase1AgentModelDashboardFields,
  snapshotDigest: digestSchema,
}).strict().superRefine(validatePhase1AgentModel)

export type Phase1AgentModelDashboardRequest = z.infer<typeof phase1AgentModelDashboardRequestSchema>
export type Phase1AgentModelDashboardContent = z.infer<typeof phase1AgentModelDashboardContentSchema>
export type Phase1AgentModelDashboard = z.infer<typeof phase1AgentModelDashboardSchema>
