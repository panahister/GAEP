import { describe, expect, it } from "vitest"

import { phase2ChangeImpactAgentModelDashboardSchema } from "./phase2-change-impact-agent-model-dashboard.js"

const digest = `sha256:${"a".repeat(64)}`

function fixture() {
  return {
    schemaVersion: 1,
    kind: "phase-2-change-impact-agent-model-dashboard",
    viewDefinitionVersion: "gaep-phase-2-change-impact-agent-model-dashboard-v1",
    phase: { id: "phase-2-design", label: "Phase 2 — UX and Figma Loop" },
    product: { recordType: "product", recordId: "00000000-0000-4000-8000-000000000001", revision: 1, digest },
    initiative: {
      recordType: "initiative", recordId: "00000000-0000-4000-8000-000000000002", revision: 1,
      digest, state: "active",
    },
    sources: { phase2UxFigmaSnapshotDigest: digest, phase2SourceCatalogDigest: digest, agentModelSnapshotDigest: digest },
    synchronizationChange: {
      state: "attention-required",
      designDelta: "unavailable", conflictResolution: "unavailable", humanDesignApproval: "unavailable",
      designBaseline: "unavailable", designDriftDetection: "unavailable",
      figmaConnectionState: "not-established", figmaWriteExecutionState: "not-performed",
      figmaImportExecutionState: "not-performed", synchronizationEffectState: "not-applied",
    },
    impact: {
      state: "current-bounded-observation", coverage: "bounded-not-complete",
      requirementCount: 0, designBindingCount: 0, unboundDesignItemCount: 0, driftObservationCount: 0,
      driftCount: 0, unassessedCount: 0, blockerCount: 0, highSeverityCount: 0, remediationCandidateCount: 0,
      staleBindingCount: 0, staleSourceReferenceCount: 0, unresolvedQuestionCount: 0,
      impactCompleteness: "not-established", designValidity: "not-established", revalidationState: "not-established",
    },
    agentModel: {
      selectionState: "unselected",
      capabilities: { shown: 2, total: 2, omitted: 0, detected: 1, unavailable: 1, selected: 0 },
      runs: { shown: 0, total: 0, omitted: 0, terminal: 0, nonTerminal: 0, managedObserved: 0, resultBound: 0, actualEffectCount: 0 },
      managedRuns: { shown: 0, total: 0, omitted: 0 },
      handoffs: { shown: 0, total: 0, omitted: 0, pendingAcknowledgement: 0, acknowledged: 0 },
      providerMetrics: { usage: "unavailable", cost: "unavailable" },
      liveProviderQuality: "not-assessed", semanticOutputQuality: "not-assessed",
    },
    freshness: {
      state: "attention-required", phase2State: "attention-required", agentModelState: "current",
      selectionCapabilityState: "unselected", phase2ObservedAt: "2026-07-30T04:20:00.000Z",
      agentModelObservedAt: "2026-07-30T04:20:00.000Z", oldestCapabilityObservedAt: "2026-07-30T04:19:00.000Z",
      newestCapabilityObservedAt: "2026-07-30T04:19:00.000Z", truncated: false,
    },
    governance: {
      humanDesignApproval: "not-established", baselineDesignation: "not-established", impactAcceptance: "not-established",
      providerAccountReadiness: "not-established", providerPreference: "not-established",
      automaticSelectionAuthority: "not-granted", runLaunchAuthority: "not-granted", effectAuthority: "not-granted",
      phaseReadinessAuthority: "not-established", productOwnerAcceptance: "not-established",
    },
    evidenceCues: {
      freshness: "unknown", confidence: { state: "not-assessed", basis: "no-governed-confidence-evaluation-is-bound" },
    },
    observedAt: "2026-07-30T04:21:00.000Z",
    sourceBoundary: "exact-derived-phase-2-dashboard-and-current-initiative-scoped-agent-model-metadata-only",
    privacyBoundary: "dashboard-exposes-identities-digests-counts-statuses-and-times-not-design-content-prompts-provider-output-run-content-evidence-content-personal-data-secrets-credentials-permissions-or-machine-paths",
    limitations: ["Bounded change signals are not complete impact analysis.", "Provider quality is not assessed.", "No action authority is granted."],
    authorityBoundary: "phase-2-change-impact-agent-model-dashboard-is-derived-read-only-evidence-not-a-second-source-of-truth-impact-completeness-design-validity-provider-quality-selection-run-launch-approval-baseline-readiness-remediation-effect-release-or-action-authority",
    snapshotDigest: digest,
  }
}

describe("Phase 2 Change, Impact, Agent and Model dashboard contract", () => {
  it("accepts reconciled bounded panels with explicit no-authority states", () => {
    const parsed = phase2ChangeImpactAgentModelDashboardSchema.parse(fixture())
    expect(parsed.synchronizationChange.state).toBe("attention-required")
    expect(parsed.agentModel.capabilities).toEqual({ shown: 2, total: 2, omitted: 0, detected: 1, unavailable: 1, selected: 0 })
    expect(parsed.governance.productOwnerAcceptance).toBe("not-established")
  })

  it("rejects forged count and freshness reconciliation", () => {
    const counts = structuredClone(fixture())
    counts.agentModel.capabilities.total = 3
    expect(() => phase2ChangeImpactAgentModelDashboardSchema.parse(counts)).toThrow()
    const freshness = structuredClone(fixture())
    freshness.freshness.state = "current"
    expect(() => phase2ChangeImpactAgentModelDashboardSchema.parse(freshness)).toThrow()
  })

  it("rejects current synchronization when a source requires attention", () => {
    const forged = structuredClone(fixture())
    forged.synchronizationChange.state = "candidate-current"
    expect(() => phase2ChangeImpactAgentModelDashboardSchema.parse(forged)).toThrow()
  })
})
