import { canonicalDigest } from "@gaep/agent-sdk"
import {
  agentModelDashboardSchema,
  initiativeSchema,
  phase2ChangeImpactAgentModelDashboardContentSchema,
  phase2ChangeImpactAgentModelDashboardRequestSchema,
  phase2ChangeImpactAgentModelDashboardSchema,
  phase2UxFigmaDashboardSchema,
  productSchema,
  type AgentModelDashboard,
  type Initiative,
  type Phase2ChangeImpactAgentModelDashboard,
  type Phase2ChangeImpactAgentModelDashboardRequest,
  type Phase2UxFigmaDashboard,
  type Product,
} from "@gaep/contracts"

export class Phase2ChangeImpactAgentModelBindingError extends Error {
  constructor() {
    super("The requested Phase 2 Change, Impact, Agent and Model dashboard bindings are not current")
    this.name = "Phase2ChangeImpactAgentModelBindingError"
  }
}

function revisionOf(value: { revision?: number }): number {
  return value.revision ?? 1
}

function exactSnapshot(value: { snapshotDigest: string }): boolean {
  const { snapshotDigest, ...content } = value
  return snapshotDigest === canonicalDigest(content)
}

export function composePhase2ChangeImpactAgentModelDashboard(
  productValue: Product,
  initiativeValue: Initiative,
  phase2Value: Phase2UxFigmaDashboard,
  agentModelValue: AgentModelDashboard,
  requestValue: Phase2ChangeImpactAgentModelDashboardRequest,
  observedAt = new Date().toISOString(),
): Phase2ChangeImpactAgentModelDashboard {
  const product = productSchema.parse(productValue)
  const initiative = initiativeSchema.parse(initiativeValue)
  const phase2 = phase2UxFigmaDashboardSchema.parse(phase2Value)
  const agentModel = agentModelDashboardSchema.parse(agentModelValue)
  const request = phase2ChangeImpactAgentModelDashboardRequestSchema.parse(requestValue)
  const productRevision = revisionOf(product)
  const productDigest = canonicalDigest(product)
  const initiativeRevision = revisionOf(initiative)
  const initiativeDigest = canonicalDigest(initiative)
  const runIds = new Set(agentModel.runs.map((run) => run.record.recordId.toLowerCase()))
  if (!exactSnapshot(phase2) || !exactSnapshot(agentModel) ||
      request.expectedProductId.toLowerCase() !== product.id.toLowerCase() ||
      request.expectedProductRevision !== productRevision || request.expectedProductDigest !== productDigest ||
      request.expectedInitiativeId.toLowerCase() !== initiative.id.toLowerCase() ||
      request.expectedInitiativeRevision !== initiativeRevision || request.expectedInitiativeDigest !== initiativeDigest ||
      request.expectedPhase2UxFigmaSnapshotDigest !== phase2.snapshotDigest ||
      request.expectedAgentModelSnapshotDigest !== agentModel.snapshotDigest ||
      initiative.productId.toLowerCase() !== product.id.toLowerCase() ||
      phase2.product.recordId.toLowerCase() !== product.id.toLowerCase() ||
      phase2.product.revision !== productRevision || phase2.product.digest !== productDigest ||
      phase2.initiative.recordId.toLowerCase() !== initiative.id.toLowerCase() ||
      phase2.initiative.revision !== initiativeRevision || phase2.initiative.digest !== initiativeDigest ||
      phase2.initiative.state !== initiative.state ||
      agentModel.product.recordId.toLowerCase() !== product.id.toLowerCase() ||
      agentModel.product.revision !== productRevision || agentModel.product.digest !== productDigest ||
      agentModel.runs.some((run) => run.initiativeId.toLowerCase() !== initiative.id.toLowerCase()) ||
      agentModel.handoffs.some((handoff) => !runIds.has(handoff.fromRun.recordId.toLowerCase()))) {
    throw new Phase2ChangeImpactAgentModelBindingError()
  }

  const sourceAvailability = (id: Phase2UxFigmaDashboard["sources"][number]["id"]) =>
    phase2.sources.find((source) => source.id === id)?.availability ?? "unavailable"
  const changeSources = {
    designDelta: sourceAvailability("design-delta"),
    conflictResolution: sourceAvailability("design-conflict-resolution"),
    humanDesignApproval: sourceAvailability("human-design-approval"),
    designBaseline: sourceAvailability("design-baseline"),
    designDriftDetection: sourceAvailability("design-drift-detection"),
  }
  const synchronizationAttention = Object.values(changeSources).some((state) => state !== "current")
  const impactAttention = phase2.drift.driftCount > 0 || phase2.drift.unassessedCount > 0 ||
    phase2.freshness.staleBindingCount > 0 || phase2.freshness.staleSourceReferenceCount > 0 ||
    phase2.freshness.unresolvedQuestionCount > 0
  const detected = agentModel.capabilities.filter((capability) => capability.detected).length
  const selected = agentModel.capabilities.filter((capability) => capability.selected).length
  const terminalStates = new Set(["completed", "failed", "cancelled"])
  const terminal = agentModel.runs.filter((run) => terminalStates.has(run.state)).length
  const managedObserved = agentModel.runs.filter((run) => run.managed.status === "observed")
  const resultBound = managedObserved.filter((run) => run.managed.status === "observed" && run.managed.result.status === "bound")
  const actualEffectCount = resultBound.reduce((sum, run) => sum +
    (run.managed.status === "observed" && run.managed.result.status === "bound"
      ? run.managed.result.evidence.actualEffectCount
      : 0), 0)
  const acknowledged = agentModel.handoffs.filter((handoff) => handoff.state === "acknowledged").length
  const freshnessAttention = phase2.phaseStatus.state === "attention-required" || agentModel.freshness.state === "attention-required" ||
    agentModel.limits.truncated || synchronizationAttention || impactAttention

  const content = phase2ChangeImpactAgentModelDashboardContentSchema.parse({
    schemaVersion: 1,
    kind: "phase-2-change-impact-agent-model-dashboard",
    viewDefinitionVersion: "gaep-phase-2-change-impact-agent-model-dashboard-v1",
    phase: { id: "phase-2-design", label: "Phase 2 — UX and Figma Loop" },
    product: { recordType: "product", recordId: product.id, revision: productRevision, digest: productDigest },
    initiative: {
      recordType: "initiative", recordId: initiative.id, revision: initiativeRevision,
      digest: initiativeDigest, state: initiative.state,
    },
    sources: {
      phase2UxFigmaSnapshotDigest: phase2.snapshotDigest,
      phase2SourceCatalogDigest: phase2.phaseStatus.sourceCatalogDigest,
      agentModelSnapshotDigest: agentModel.snapshotDigest,
    },
    synchronizationChange: {
      state: synchronizationAttention ? "attention-required" : "candidate-current",
      ...changeSources,
      figmaConnectionState: "not-established",
      figmaWriteExecutionState: "not-performed",
      figmaImportExecutionState: "not-performed",
      synchronizationEffectState: "not-applied",
    },
    impact: {
      state: impactAttention ? "attention-required" : "current-bounded-observation",
      coverage: "bounded-not-complete",
      requirementCount: phase2.designSystem.requirementCount,
      designBindingCount: phase2.figma.designBindingCount,
      unboundDesignItemCount: phase2.figma.unboundDesignItemCount,
      driftObservationCount: phase2.drift.observationCount,
      driftCount: phase2.drift.driftCount,
      unassessedCount: phase2.drift.unassessedCount,
      blockerCount: phase2.drift.blockerCount,
      highSeverityCount: phase2.drift.highSeverityCount,
      remediationCandidateCount: phase2.drift.remediationCandidateCount,
      staleBindingCount: phase2.freshness.staleBindingCount,
      staleSourceReferenceCount: phase2.freshness.staleSourceReferenceCount,
      unresolvedQuestionCount: phase2.freshness.unresolvedQuestionCount,
      impactCompleteness: "not-established",
      designValidity: "not-established",
      revalidationState: "not-established",
    },
    agentModel: {
      selectionState: agentModel.selection.status,
      capabilities: {
        shown: agentModel.capabilities.length, total: agentModel.limits.capabilities.total,
        omitted: agentModel.limits.capabilities.omitted, detected,
        unavailable: agentModel.capabilities.length - detected, selected,
      },
      runs: {
        shown: agentModel.runs.length, total: agentModel.limits.runs.total, omitted: agentModel.limits.runs.omitted,
        terminal, nonTerminal: agentModel.runs.length - terminal, managedObserved: managedObserved.length,
        resultBound: resultBound.length, actualEffectCount,
      },
      managedRuns: {
        shown: agentModel.limits.managedRuns.shown,
        total: agentModel.limits.managedRuns.total,
        omitted: agentModel.limits.managedRuns.omitted,
      },
      handoffs: {
        shown: agentModel.handoffs.length, total: agentModel.limits.handoffs.total,
        omitted: agentModel.limits.handoffs.omitted,
        pendingAcknowledgement: agentModel.handoffs.length - acknowledged, acknowledged,
      },
      providerMetrics: { usage: "unavailable", cost: "unavailable" },
      liveProviderQuality: "not-assessed",
      semanticOutputQuality: "not-assessed",
    },
    freshness: {
      state: freshnessAttention ? "attention-required" : "current",
      phase2State: phase2.phaseStatus.state,
      agentModelState: agentModel.freshness.state,
      selectionCapabilityState: agentModel.freshness.selectionCapabilityState,
      phase2ObservedAt: phase2.observedAt,
      agentModelObservedAt: agentModel.observedAt,
      oldestCapabilityObservedAt: agentModel.freshness.oldestCapabilityObservedAt,
      newestCapabilityObservedAt: agentModel.freshness.newestCapabilityObservedAt,
      truncated: agentModel.limits.truncated,
    },
    governance: {
      humanDesignApproval: "not-established",
      baselineDesignation: "not-established",
      impactAcceptance: "not-established",
      providerAccountReadiness: "not-established",
      providerPreference: "not-established",
      automaticSelectionAuthority: "not-granted",
      runLaunchAuthority: "not-granted",
      effectAuthority: "not-granted",
      phaseReadinessAuthority: "not-established",
      productOwnerAcceptance: "not-established",
    },
    evidenceCues: {
      freshness: freshnessAttention
        ? phase2.evidenceCues.freshness === "unknown" || agentModel.evidenceCues.freshness === "unknown"
          ? "unknown"
          : "potentially-stale"
        : "current",
      confidence: { state: "not-assessed", basis: "no-governed-confidence-evaluation-is-bound" },
    },
    observedAt,
    sourceBoundary: "exact-derived-phase-2-dashboard-and-current-initiative-scoped-agent-model-metadata-only",
    privacyBoundary: "dashboard-exposes-identities-digests-counts-statuses-and-times-not-design-content-prompts-provider-output-run-content-evidence-content-personal-data-secrets-credentials-permissions-or-machine-paths",
    limitations: [
      "Synchronization and impact panels are derived from the exact Phase 2 dashboard and do not establish complete change or impact coverage.",
      "Agent, model, Run, Managed Run and handoff counts are bounded to the exact current Initiative and declared source limits.",
      "Provider usage, cost, live-provider quality and semantic output quality remain unavailable or not assessed.",
      "No dashboard state establishes design validity, approval, a Baseline Set, readiness, remediation, implementation or effect authority.",
    ],
    authorityBoundary: "phase-2-change-impact-agent-model-dashboard-is-derived-read-only-evidence-not-a-second-source-of-truth-impact-completeness-design-validity-provider-quality-selection-run-launch-approval-baseline-readiness-remediation-effect-release-or-action-authority",
  })
  return phase2ChangeImpactAgentModelDashboardSchema.parse({ ...content, snapshotDigest: canonicalDigest(content) })
}
