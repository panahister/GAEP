import { describe, expect, it } from "vitest"
import {
  phase3aDashboardContentSchema,
  phase3aDashboardSchema,
  phase3aDashboardSourceDefinitions,
  phase3aDashboardSourceIds,
  phase3aDashboardViewDefinitions,
  phase3aDashboardViewIds,
} from "./phase3a-dashboard.js"

const digest = `sha256:${"1".repeat(64)}`

function dashboard() {
  const sources = phase3aDashboardSourceIds.map((id) => ({
    id,
    ...phase3aDashboardSourceDefinitions[id],
    availability: "unavailable" as const,
  }))
  const views = phase3aDashboardViewIds.map((id) => ({
    id,
    ...phase3aDashboardViewDefinitions[id],
    state: "unavailable" as const,
    currentSourceCount: 0,
    attentionRequiredSourceCount: 0,
    unavailableSourceCount: phase3aDashboardViewDefinitions[id].sourceIds.length,
    candidateCount: 0,
    evidenceReferenceCount: 0,
    gapCount: 0,
    conflictCount: 0,
    staleCount: 0,
    unresolvedCount: 0,
    workflowEvidenceCount: 0,
  }))
  return {
    schemaVersion: 1 as const,
    kind: "phase-3a-dashboard" as const,
    viewDefinitionVersion: "gaep-phase-3a-dashboard-v1" as const,
    phase: { id: "phase-3a-readiness" as const, label: "Phase 3A — Backlog and Implementation Readiness" as const },
    product: { recordType: "product" as const, recordId: "00000000-0000-4000-8000-000000000001", revision: 1, digest },
    initiative: { recordType: "initiative" as const, recordId: "00000000-0000-4000-8000-000000000002", revision: 1, digest, state: "active" as const },
    sources,
    views,
    workflows: (["codex", "claude"] as const).map((provider) => ({ provider, availability: "unavailable" as const, executionMode: "offline-deterministic" as const, liveAcceptance: "not-established" as const, semanticQuality: "not-assessed" as const, authority: "not-granted" as const })),
    freshness: { state: "unknown" as const, staleCount: 0, unresolvedCount: 0 },
    phaseStatus: { state: "attention-required" as const, expectedSourceCount: 20 as const, currentSourceCount: 0, attentionRequiredSourceCount: 0, unavailableSourceCount: 20, sourceCatalogDigest: digest, providerWorkflowEvidenceCount: 0, liveProviderAcceptanceCount: 0 as const, nativeHostAcceptanceCount: 0 as const, readinessAuthority: "not-established" as const, waiverAuthority: "not-established" as const, ownershipAuthority: "not-established" as const, productOwnerAcceptance: "not-established" as const },
    pagination: { offset: 0 as const, limit: 20 as const, total: 20 as const, truncated: false as const },
    export: { format: "csv-visible-metadata-only" as const, formulaPrefixesNeutralized: true as const, hiddenContentExcluded: true as const },
    evidenceCues: { freshness: "unknown" as const, confidence: { state: "not-assessed" as const, basis: "no-governed-confidence-or-semantic-quality-evaluation-is-bound" as const } },
    observedAt: "2026-07-31T09:00:00.000Z",
    sourceBoundary: "current-governed-product-initiative-p3a-projections-and-explicit-sealed-local-workflow-evidence-only" as const,
    privacyBoundary: "dashboard-exposes-identities-counts-states-times-and-digests-not-product-design-source-code-provider-output-personal-content-secrets-credentials-permissions-or-private-paths" as const,
    limitations: ["Unavailable sources remain explicit.", "Local provider evidence is not live acceptance.", "Dashboard state grants no authority."],
    authorityBoundary: "phase-3a-dashboard-is-a-derived-read-only-view-not-completeness-priority-readiness-waiver-ownership-implementation-acceptance-release-deployment-or-action-authority" as const,
  }
}

describe("Phase 3A dashboard contract", () => {
  it("accepts the exact canonical unavailable snapshot and digest", () => {
    const content = phase3aDashboardContentSchema.parse(dashboard())
    expect(phase3aDashboardSchema.parse({ ...content, snapshotDigest: digest }).sources).toHaveLength(20)
  })

  it("rejects reordered sources and invented authority", () => {
    const reordered = dashboard()
    ;[reordered.sources[0], reordered.sources[1]] = [reordered.sources[1]!, reordered.sources[0]!]
    expect(() => phase3aDashboardContentSchema.parse(reordered)).toThrow()
    expect(() => phase3aDashboardContentSchema.parse({ ...dashboard(), phaseStatus: { ...dashboard().phaseStatus, readinessAuthority: "granted" } })).toThrow()
  })
})
