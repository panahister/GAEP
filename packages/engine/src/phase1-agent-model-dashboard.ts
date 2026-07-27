import { canonicalDigest } from "@gaep/agent-sdk"
import {
  agentModelDashboardSchema,
  initiativeSchema,
  phase1AgentModelDashboardContentSchema,
  phase1AgentModelDashboardRequestSchema,
  phase1AgentModelDashboardSchema,
  productSchema,
  type AgentModelDashboard,
  type Initiative,
  type Phase1AgentModelDashboard,
  type Phase1AgentModelDashboardRequest,
  type Product,
} from "@gaep/contracts"

export class Phase1AgentModelBindingError extends Error {
  constructor() {
    super("The requested Phase 1 Agent/Model dashboard bindings are not current")
    this.name = "Phase1AgentModelBindingError"
  }
}

function revisionOf(value: { revision?: number }): number {
  return value.revision ?? 1
}

function sameExpectedSelection(
  expected: Phase1AgentModelDashboardRequest["agentModel"]["expectedSelection"],
  dashboard: AgentModelDashboard,
): boolean {
  if (expected.status !== dashboard.selection.status) return false
  if (expected.status === "selected" && dashboard.selection.status === "selected") {
    return expected.selectionDigest === dashboard.selection.selectionDigest
  }
  if (expected.status === "migration-required" && dashboard.selection.status === "migration-required") {
    return expected.selectionDigest === dashboard.selection.selectionDigest
  }
  return true
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

export function composePhase1AgentModelDashboard(
  productValue: Product,
  initiativeValue: Initiative,
  agentModelValue: AgentModelDashboard,
  requestValue: Phase1AgentModelDashboardRequest,
  observedAt = new Date().toISOString(),
): Phase1AgentModelDashboard {
  const product = productSchema.parse(productValue)
  const initiative = initiativeSchema.parse(initiativeValue)
  const agentModel = agentModelDashboardSchema.parse(agentModelValue)
  const request = phase1AgentModelDashboardRequestSchema.parse(requestValue)
  const productRevision = revisionOf(product)
  const productDigest = canonicalDigest(product)
  const initiativeRevision = revisionOf(initiative)
  const initiativeDigest = canonicalDigest(initiative)
  const { snapshotDigest: agentModelSnapshotDigest, ...agentModelContent } = agentModel
  const exactAgentSnapshot = agentModelSnapshotDigest === canonicalDigest(agentModelContent)
  const exactProduct = request.agentModel.expectedProductId.toLowerCase() === product.id.toLowerCase() &&
    request.agentModel.expectedProductRevision === productRevision && request.agentModel.expectedProductDigest === productDigest &&
    agentModel.product.recordId.toLowerCase() === product.id.toLowerCase() &&
    agentModel.product.revision === productRevision && agentModel.product.digest === productDigest
  const exactInitiative = request.expectedInitiativeId.toLowerCase() === initiative.id.toLowerCase() &&
    request.expectedInitiativeRevision === initiativeRevision && request.expectedInitiativeDigest === initiativeDigest &&
    initiative.productId.toLowerCase() === product.id.toLowerCase()
  const expectedCapabilities = [...request.agentModel.expectedCapabilities]
    .sort((left, right) => compare(`${left.adapterId}:${left.agentId}`, `${right.adapterId}:${right.agentId}`))
  const actualCapabilities = agentModel.capabilities.map((capability) => ({
    adapterId: capability.adapterId,
    agentId: capability.agentId,
    capabilityDigest: capability.capabilityDigest,
  })).sort((left, right) => compare(`${left.adapterId}:${left.agentId}`, `${right.adapterId}:${right.agentId}`))
  const exactCapabilities = agentModel.limits.capabilities.omitted === 0 &&
    canonicalDigest(expectedCapabilities) === canonicalDigest(actualCapabilities)
  const exactSelection = sameExpectedSelection(request.agentModel.expectedSelection, agentModel)
  const exactInitiativeScope = agentModel.runs.every((run) => run.initiativeId.toLowerCase() === initiative.id.toLowerCase())
  const runIds = new Set(agentModel.runs.map((run) => run.record.recordId.toLowerCase()))
  const exactHandoffScope = agentModel.handoffs.every((handoff) => runIds.has(handoff.fromRun.recordId.toLowerCase()))
  if (!exactAgentSnapshot || !exactProduct || !exactInitiative || !exactCapabilities || !exactSelection ||
      !exactInitiativeScope || !exactHandoffScope) {
    throw new Phase1AgentModelBindingError()
  }

  const detectedCapabilityCount = agentModel.capabilities.filter((capability) => capability.detected).length
  const selectedCapabilityCount = agentModel.capabilities.filter((capability) => capability.selected).length
  const terminalStates = new Set(["completed", "failed", "cancelled"])
  const terminalRunCount = agentModel.runs.filter((run) => terminalStates.has(run.state)).length
  const managedObserved = agentModel.runs.filter((run) => run.managed.status === "observed")
  const boundResults = managedObserved.filter((run) => run.managed.status === "observed" && run.managed.result.status === "bound")
  const actualEffectCount = boundResults.reduce((sum, run) =>
    sum + (run.managed.status === "observed" && run.managed.result.status === "bound"
      ? run.managed.result.evidence.actualEffectCount
      : 0), 0)
  const outcomeCount = (status: "satisfied" | "failed" | "not-assessed" | "indeterminate") =>
    boundResults.filter((run) => run.managed.status === "observed" && run.managed.result.status === "bound" &&
      run.managed.result.outcomeStatus === status).length
  const acknowledgedHandoffCount = agentModel.handoffs.filter((handoff) => handoff.state === "acknowledged").length

  const content = phase1AgentModelDashboardContentSchema.parse({
    schemaVersion: 1,
    kind: "phase-1-agent-model-dashboard",
    phase: { id: "phase-1b-product", label: "Phase 1B — Product P0–P4" },
    product: { recordType: "product", recordId: product.id, revision: productRevision, digest: productDigest },
    initiative: {
      recordType: "initiative",
      recordId: initiative.id,
      revision: initiativeRevision,
      digest: initiativeDigest,
      state: initiative.state,
    },
    source: { agentModelSnapshotDigest, scope: "exact-current-initiative" },
    agentModel,
    executionTruth: {
      capabilities: {
        shown: agentModel.capabilities.length,
        total: agentModel.limits.capabilities.total,
        omitted: agentModel.limits.capabilities.omitted,
        detected: detectedCapabilityCount,
        unavailable: agentModel.capabilities.length - detectedCapabilityCount,
        selected: selectedCapabilityCount,
      },
      runs: {
        shown: agentModel.runs.length,
        total: agentModel.limits.runs.total,
        omitted: agentModel.limits.runs.omitted,
        terminal: terminalRunCount,
        nonTerminal: agentModel.runs.length - terminalRunCount,
        managedObserved: managedObserved.length,
        resultBound: boundResults.length,
        actualEffectCount,
        outcomes: {
          satisfied: outcomeCount("satisfied"),
          failed: outcomeCount("failed"),
          notAssessed: outcomeCount("not-assessed"),
          indeterminate: outcomeCount("indeterminate"),
        },
      },
      managedRuns: {
        shown: agentModel.limits.managedRuns.shown,
        total: agentModel.limits.managedRuns.total,
        omitted: agentModel.limits.managedRuns.omitted,
      },
      handoffs: {
        shown: agentModel.handoffs.length,
        total: agentModel.limits.handoffs.total,
        omitted: agentModel.limits.handoffs.omitted,
        pendingAcknowledgement: agentModel.handoffs.length - acknowledgedHandoffCount,
        acknowledged: acknowledgedHandoffCount,
      },
      providerMetrics: { usage: "unavailable", cost: "unavailable" },
      liveProviderQuality: "not-assessed",
      semanticOutputQuality: "not-assessed",
    },
    freshness: {
      state: agentModel.freshness.state,
      selectionCapabilityState: agentModel.freshness.selectionCapabilityState,
      oldestCapabilityObservedAt: agentModel.freshness.oldestCapabilityObservedAt,
      newestCapabilityObservedAt: agentModel.freshness.newestCapabilityObservedAt,
      agentModelObservedAt: agentModel.observedAt,
      truncated: agentModel.limits.truncated,
      basis: "exact-initiative-scoped-agent-model-snapshot-and-declared-bounded-coverage",
    },
    governance: {
      providerAccountReadiness: "not-established",
      providerPreference: "not-established",
      automaticSelectionAuthority: "not-granted",
      handoffAcknowledgementAuthority: "not-granted",
      runLaunchAuthority: "not-granted",
      effectAuthority: "not-granted",
      phaseReadinessAuthority: "not-established",
      productOwnerAcceptance: "not-established",
    },
    observedAt,
    sourceBoundary: "current-governed-product-initiative-capability-selection-run-handoff-and-managed-evidence-metadata-only",
    privacyBoundary: "dashboard-exposes-identities-digests-counts-statuses-times-and-redacted-selection-metadata-not-prompts-provider-output-run-content-evidence-content-personal-data-secrets-credentials-or-machine-paths",
    limitations: [
      "Capability observations prove only the bounded adapter/runtime metadata recorded at observation time, not provider account readiness or service availability.",
      "Run, Managed Run and handoff rows are limited to the exact current Initiative and may be bounded by the source snapshot limits.",
      "Provider usage and cost remain unavailable because no governed provider metric contract is bound.",
      "Deterministic local provider receipts do not establish semantic output quality, live-provider quality or provider preference.",
    ],
    authorityBoundary: "phase-1-agent-model-dashboard-is-read-only-observed-evidence-not-provider-quality-preference-automatic-selection-handoff-acknowledgement-run-launch-readiness-approval-effect-release-or-action-authority",
  })
  return phase1AgentModelDashboardSchema.parse({ ...content, snapshotDigest: canonicalDigest(content) })
}
