import { describe, expect, it } from "vitest"

import {
  phase2UxFigmaDashboardSchema,
  phase2UxFigmaDashboardSourceDefinitions,
  phase2UxFigmaDashboardSourceIds,
} from "./phase2-ux-figma-dashboard.js"

const digest = `sha256:${"a".repeat(64)}`

function fixture() {
  const sources = phase2UxFigmaDashboardSourceIds.map((id) => ({
    id,
    ...phase2UxFigmaDashboardSourceDefinitions[id],
    availability: "unavailable" as const,
  }))
  return {
    schemaVersion: 1,
    kind: "phase-2-ux-figma-dashboard",
    viewDefinitionVersion: "gaep-phase-2-ux-figma-dashboard-v1",
    phase: { id: "phase-2-design", label: "Phase 2 — UX and Figma Loop" },
    product: { recordType: "product", recordId: "00000000-0000-4000-8000-000000000001", revision: 1, digest },
    initiative: {
      recordType: "initiative", recordId: "00000000-0000-4000-8000-000000000002", revision: 1,
      digest, state: "active",
    },
    sources,
    experience: {
      personaCount: 0, designRoleCount: 0, journeyCount: 0, touchpointCount: 0,
      informationArchitectureNodeCount: 0, routeCount: 0, screenCount: 0, stateCount: 0, variantCount: 0,
    },
    designSystem: {
      requirementCount: 0, designSystemCount: 0, tokenCount: 0, componentCount: 0,
      accessibilityRuleCount: 0, accessibilityCheckCount: 0, platformTargetCount: 0, breakpointCount: 0,
    },
    figma: {
      fileCount: 0, componentCount: 0, variableCount: 0, designBindingCount: 0,
      humanReviewedBindingCount: 0, unboundDesignItemCount: 0,
      connectionState: "not-established", writeExecutionState: "not-performed", importExecutionState: "not-performed",
    },
    governance: {
      designerReadyCandidateResult: "not-assessed", humanApprovalCandidateResult: "not-assessed",
      baselineCandidateResult: "not-assessed", baselineDesignationState: "not-established",
      driftCandidateResult: "not-assessed", approvalState: "not-established", readinessState: "not-established",
      remediationEffectState: "not-applied",
    },
    drift: {
      observationCount: 0, requirementToDesignCount: 0, designToImplementationCount: 0, conformantCount: 0,
      driftCount: 0, unassessedCount: 0, blockerCount: 0, highSeverityCount: 0, remediationCandidateCount: 0,
    },
    freshness: {
      state: "current", staleBindingCount: 0, staleSourceReferenceCount: 0, unresolvedQuestionCount: 0,
    },
    phaseStatus: {
      state: "attention-required", expectedSourceCount: 23, currentSourceCount: 0,
      attentionRequiredSourceCount: 0, unavailableSourceCount: 23, sourceCatalogDigest: digest,
      productOwnerAcceptance: "not-established", readinessAuthority: "not-established", phaseEntryAuthority: "not-established",
    },
    evidenceCues: {
      freshness: "unknown", confidence: { state: "not-assessed", basis: "no-governed-confidence-evaluation-is-bound" },
    },
    observedAt: "2026-07-30T03:10:00.000Z",
    sourceBoundary: "current-governed-product-initiative-and-phase-2-projections-only",
    privacyBoundary: "dashboard-exposes-identities-counts-statuses-times-and-digests-not-design-requirement-figma-source-human-or-personal-content-secrets-credentials-or-permissions",
    limitations: ["Unavailable sources remain explicit.", "The dashboard performs no Figma or implementation effect."],
    authorityBoundary: "phase-2-dashboard-is-a-derived-read-only-view-not-a-second-source-of-truth-or-completeness-validity-approval-baseline-readiness-remediation-figma-implementation-or-action-authority",
    snapshotDigest: digest,
  }
}

describe("Phase 2 UX/Figma dashboard contract", () => {
  it("accepts the exact ordered 23-source derived view without authority claims", () => {
    const parsed = phase2UxFigmaDashboardSchema.parse(fixture())
    expect(parsed.sources).toHaveLength(23)
    expect(parsed.phaseStatus).toMatchObject({ state: "attention-required", unavailableSourceCount: 23 })
    expect(parsed.governance).toMatchObject({
      baselineDesignationState: "not-established",
      approvalState: "not-established",
      readinessState: "not-established",
      remediationEffectState: "not-applied",
    })
  })

  it("rejects reordered sources and irreconcilable source counts", () => {
    const reordered = structuredClone(fixture())
    ;[reordered.sources[0], reordered.sources[1]] = [reordered.sources[1]!, reordered.sources[0]!]
    expect(() => phase2UxFigmaDashboardSchema.parse(reordered)).toThrow()
    const forged = structuredClone(fixture())
    forged.phaseStatus.currentSourceCount = 23
    forged.phaseStatus.unavailableSourceCount = 0
    expect(() => phase2UxFigmaDashboardSchema.parse(forged)).toThrow()
  })

  it("rejects a source that claims current status without exact source evidence", () => {
    const forged = structuredClone(fixture())
    ;(forged.sources as unknown as Array<Record<string, unknown>>)[0]!.availability = "current"
    expect(() => phase2UxFigmaDashboardSchema.parse(forged)).toThrow()
  })
})
