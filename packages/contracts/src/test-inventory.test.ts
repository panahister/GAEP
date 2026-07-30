import { describe, expect, it } from "vitest"

import { testInventoryInputSchema, testInventoryStatusSchema } from "./test-inventory.js"

const digest = (value: string) => `sha256:${value.repeat(64)}`
const ids = Array.from({ length: 24 }, (_, index) =>
  `3a000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`)
const reference = (index: number) => ({ recordId: ids[index]!, revision: 1, digest: digest((index % 10).toString(16)) })
const evidence = (kind: "acceptance-criteria" | "implementation-unit" | "requirement" | "risk-register" | "route-screen-component-mapping" | "test-asset-observation" | "test-methodology") => ({
  kind, sourceId: `checkout-${kind}`, revision: 1, digest: digest("a"), evidenceState: "source-recorded" as const,
})

function input() {
  return {
    initiativeId: ids[0],
    context: { productRevision: 1, productDigest: digest("a"), initiativeRevision: 1, initiativeDigest: digest("b") },
    informationClassification: "internal" as const,
    title: "Candidate Test Inventory",
    acceptanceCriteria: reference(1), riskRegister: reference(2), implementationUnitModel: reference(3),
    routeScreenComponentMapping: reference(4), testMethodology: reference(5),
    assets: [{
      id: ids[6]!, ordinal: 1, key: "checkout.contract", kind: "contract" as const,
      title: "Checkout contract test candidate", implementationUnitIds: [ids[7]!],
      requirementKeys: ["GAEP-REQ-001"], acceptanceCriterionIds: [ids[8]!], riskKeys: ["callback-spoofing"],
      routeScreenComponentSubjectIds: [ids[9]!], methodologyScopeIds: [ids[10]!],
      environmentIds: ["ci-main"], platformKeys: ["linux"], evidenceExpectationIds: ["test-report"],
      ownerCandidateIds: ["quality-lead"], disposition: "candidate-cataloged" as const,
      existenceState: "candidate-observed" as const, automationState: "automated-candidate" as const,
      executionState: "not-performed" as const, resultState: "not-established" as const,
      evidenceTruthState: "not-established" as const, coverageTruthState: "not-established" as const,
      qualityState: "not-established" as const, ownershipAuthorityState: "not-granted" as const,
      acceptanceState: "not-established" as const,
      evidenceReferences: [evidence("acceptance-criteria"), evidence("implementation-unit"),
        evidence("requirement"), evidence("risk-register"), evidence("route-screen-component-mapping"),
        evidence("test-asset-observation"), evidence("test-methodology")],
      conflictReferenceCandidates: [], catalogedBy: { kind: "human" as const, id: "inventory-reviewer" },
      catalogedAt: "2026-07-31T00:00:00.000Z",
    }],
    alternativesConsidered: ["separate test lists"], unresolvedQuestions: [],
    limitations: ["Candidate inventory does not establish test existence, execution, results, or coverage"],
    reviewState: "ready-for-human-review" as const, requirementTruthState: "not-established" as const,
    acceptanceCriteriaValidityState: "not-established" as const, riskTruthState: "not-established" as const,
    inventoryTruthState: "not-established" as const, inventoryCompletenessState: "not-established" as const,
    testAssetExistenceTruthState: "not-established" as const, environmentAvailabilityState: "not-established" as const,
    privacyApprovalState: "not-established" as const, securityApprovalState: "not-established" as const,
    ownershipAppointmentState: "not-established" as const, testExecutionState: "not-performed" as const,
    testResultState: "not-established" as const, evidenceTruthState: "not-established" as const,
    coverageTruthState: "not-established" as const, qualityState: "not-established" as const,
    implementationReadinessState: "not-established" as const, acceptanceDecisionState: "not-established" as const,
    releaseReadinessState: "not-established" as const, deploymentReadinessState: "not-established" as const,
    actionAuthorityState: "not-granted" as const,
  }
}

describe("Test Inventory contracts", () => {
  it("accepts a complete attributed inventory candidate and reconciled status", () => {
    const candidate = testInventoryInputSchema.parse(input())
    expect(candidate.assets).toHaveLength(1)
    expect(testInventoryStatusSchema.parse({
      schemaVersion: 1, kind: "test-inventory-status", productId: ids[11], productRevision: 1,
      initiativeId: ids[0], initiativeRevision: 1, candidate: reference(12),
      acceptanceCriteria: candidate.acceptanceCriteria, riskRegister: candidate.riskRegister,
      implementationUnitModel: candidate.implementationUnitModel,
      routeScreenComponentMapping: candidate.routeScreenComponentMapping, testMethodology: candidate.testMethodology,
      sourceCriterionCount: 1, sourceRiskCount: 1, sourceUnitCount: 1, sourceMappingSubjectCount: 1,
      sourceMethodologyScopeCount: 1, assetCount: 1, catalogedAssetCount: 1, conflictAssetCount: 0,
      missingAssetCount: 0, deferredAssetCount: 0, notAssessedAssetCount: 0, observedAssetCount: 1,
      plannedAssetCount: 0, automatedAssetCount: 1, manualAssetCount: 0, duplicateIdentityCount: 0,
      orphanAssetCount: 0, uncoveredCriterionCount: 0, uncoveredRiskCount: 0, uncoveredUnitCount: 0,
      uncoveredMappingSubjectCount: 0, uncoveredMethodologyScopeCount: 0, ownershipGapCount: 0,
      traceGapCount: 0, evidenceGapCount: 0, staleBindingCount: 0, staleDependencyCount: 0,
      invalidCandidateCount: 0, unresolvedQuestionCount: 0, reviewState: "ready-for-human-review",
      state: "candidate-complete", reasons: [], assessedAt: "2026-07-31T00:00:00.000Z",
      authorityBoundary: "test-inventory-status-is-observational-and-does-not-establish-requirement-acceptance-criteria-or-risk-truth-inventory-validity-or-completeness-test-asset-existence-environment-availability-privacy-or-security-approval-owner-appointment-test-execution-or-results-evidence-or-coverage-truth-quality-implementation-readiness-acceptance-release-deployment-or-action-authority",
    }).state).toBe("candidate-complete")
  })

  it("rejects duplicate identities, unattributed candidates, and secret-shaped values", () => {
    const value = input()
    expect(testInventoryInputSchema.safeParse({ ...value, assets: [value.assets[0]!, value.assets[0]!] }).success).toBe(false)
    expect(testInventoryInputSchema.safeParse({ ...value, assets: [{ ...value.assets[0]!, catalogedBy: undefined }] }).success).toBe(false)
    expect(testInventoryInputSchema.safeParse({ ...value, limitations: ["apiKey=test-inventory-secret-value"] }).success).toBe(false)
  })
})
