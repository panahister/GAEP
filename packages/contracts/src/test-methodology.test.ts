import { describe, expect, it } from "vitest"

import {
  testMethodologyInputSchema,
  testMethodologyStatusSchema,
} from "./test-methodology.js"

const digest = (value: string) => `sha256:${value.repeat(64)}`
const ids = Array.from({ length: 32 }, (_, index) =>
  `2a000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`)
const reference = (index: number) => ({ recordId: ids[index]!, revision: 1, digest: digest((index % 10).toString(16)) })
const evidence = (kind: "implementation-unit" | "requirement" | "acceptance-criteria" | "route-screen-component-mapping" | "security-privacy-assessment" | "evidence") => ({
  kind, sourceId: `checkout-${kind}`, revision: 1, digest: digest("a"), evidenceState: "source-recorded" as const,
})

function input() {
  return {
    initiativeId: ids[0],
    context: { productRevision: 1, productDigest: digest("a"), initiativeRevision: 1, initiativeDigest: digest("b") },
    informationClassification: "internal" as const,
    title: "Candidate Test Methodology",
    acceptanceCriteria: reference(1),
    definitionOfReady: reference(2),
    definitionOfDone: reference(3),
    implementationUnitModel: reference(4),
    dependencyMapping: reference(5),
    securityPrivacyAssessment: reference(6),
    routeScreenComponentMapping: reference(7),
    scopes: [{
      id: ids[8]!, ordinal: 1, implementationUnitId: ids[9]!, requirementKeys: ["GAEP-REQ-001"],
      acceptanceCriterionIds: [ids[10]!], routeScreenComponentSubjectIds: [ids[11]!],
      threatCandidates: ["spoofed-callback"], riskClass: "high" as const,
      evidenceReferences: [evidence("implementation-unit"), evidence("requirement")],
    }],
    decisions: [{
      id: ids[12]!, ordinal: 1, scopeId: ids[8]!, methodKind: "risk-based" as const,
      level: "integration" as const, representation: "checklist" as const,
      disposition: "candidate-selected" as const, automationIntent: "hybrid" as const,
      environmentIds: ["ci-main"], dataPolicyIds: ["synthetic-default"],
      evidenceExpectationIds: ["test-report"], ownerCandidateIds: ["quality-lead"],
      entryCriterionIds: ["entry-ready"], exitCriterionIds: ["exit-evidence"],
      evidenceReferences: [evidence("acceptance-criteria"), evidence("route-screen-component-mapping")],
      conflictReferenceCandidates: [], selectedBy: { kind: "human" as const, id: "methodology-reviewer" },
      selectedAt: "2026-07-31T00:00:00.000Z", executionState: "not-performed" as const,
      resultState: "not-established" as const, evidenceTruthState: "not-established" as const,
      coverageTruthState: "not-established" as const, qualityState: "not-established" as const,
      ownershipAuthorityState: "not-granted" as const, approvalState: "not-established" as const,
    }],
    environments: [{
      id: "ci-main", ordinal: 1, kind: "ci" as const, platformKeys: ["linux"],
      availabilityState: "candidate-available" as const, isolationState: "candidate-isolated" as const,
      evidenceReferences: [evidence("evidence")],
    }],
    dataPolicies: [{
      id: "synthetic-default", ordinal: 1, dataClass: "synthetic" as const,
      privacyReviewState: "candidate-reviewed" as const, retentionDaysCandidate: 30,
      externalTransferState: "not-authorized" as const,
      evidenceReferences: [evidence("security-privacy-assessment")],
    }],
    evidenceExpectations: [{
      id: "test-report", ordinal: 1, kind: "report" as const,
      requiredState: "candidate-required" as const, retentionClass: "phase-record" as const,
    }],
    criteria: [
      { id: "entry-ready", ordinal: 1, kind: "entry" as const, scopeIds: [ids[8]!],
        evidenceExpectationIds: [], assessmentState: "candidate-defined" as const,
        evidenceReferences: [evidence("evidence")] },
      { id: "exit-evidence", ordinal: 2, kind: "exit" as const, scopeIds: [ids[8]!],
        evidenceExpectationIds: ["test-report"], assessmentState: "candidate-defined" as const,
        evidenceReferences: [evidence("evidence")] },
    ],
    alternativesConsidered: ["scenario-based methodology"], unresolvedQuestions: [],
    limitations: ["Candidate methodology does not establish execution or results"],
    reviewState: "ready-for-human-review" as const,
    requirementTruthState: "not-established" as const,
    acceptanceCriteriaValidityState: "not-established" as const,
    methodologyTruthState: "not-established" as const,
    methodologyCompletenessState: "not-established" as const,
    environmentAvailabilityState: "not-established" as const,
    dataFitnessState: "not-established" as const,
    privacyApprovalState: "not-established" as const,
    securityApprovalState: "not-established" as const,
    ownershipAppointmentState: "not-established" as const,
    testExecutionState: "not-performed" as const,
    testResultState: "not-established" as const,
    evidenceTruthState: "not-established" as const,
    coverageTruthState: "not-established" as const,
    qualityState: "not-established" as const,
    implementationReadinessState: "not-established" as const,
    acceptanceDecisionState: "not-established" as const,
    releaseReadinessState: "not-established" as const,
    deploymentReadinessState: "not-established" as const,
    actionAuthorityState: "not-granted" as const,
  }
}

describe("Test Methodology contracts", () => {
  it("accepts a complete attributed candidate and reconciled status", () => {
    const candidate = testMethodologyInputSchema.parse(input())
    expect(candidate.decisions).toHaveLength(1)
    expect(testMethodologyStatusSchema.parse({
      schemaVersion: 1, kind: "test-methodology-status", productId: ids[13], productRevision: 1,
      initiativeId: ids[0], initiativeRevision: 1, candidate: reference(14),
      acceptanceCriteria: candidate.acceptanceCriteria, definitionOfReady: candidate.definitionOfReady,
      definitionOfDone: candidate.definitionOfDone, implementationUnitModel: candidate.implementationUnitModel,
      dependencyMapping: candidate.dependencyMapping, securityPrivacyAssessment: candidate.securityPrivacyAssessment,
      routeScreenComponentMapping: candidate.routeScreenComponentMapping,
      sourceUnitCount: 1, sourceRequirementCount: 1, sourceCriterionCount: 1, sourceMappingSubjectCount: 1,
      scopeCount: 1, decisionCount: 1, selectedDecisionCount: 1, conflictDecisionCount: 0,
      notApplicableDecisionCount: 0, deferredDecisionCount: 0, notAssessedDecisionCount: 0,
      environmentCount: 1, dataPolicyCount: 1, evidenceExpectationCount: 1,
      entryCriterionCount: 1, exitCriterionCount: 1, missingScopeCount: 0, extraScopeCount: 0,
      invalidDecisionCount: 0, environmentGapCount: 0, dataPolicyGapCount: 0, ownershipGapCount: 0,
      traceGapCount: 0, evidenceGapCount: 0, criterionGapCount: 0, staleBindingCount: 0,
      staleDependencyCount: 0, invalidCandidateCount: 0, unresolvedQuestionCount: 0,
      reviewState: "ready-for-human-review", state: "candidate-complete", reasons: [],
      assessedAt: "2026-07-31T00:00:00.000Z",
      authorityBoundary: "test-methodology-status-is-observational-and-does-not-establish-requirement-or-acceptance-criteria-truth-methodology-validity-or-completeness-environment-availability-test-data-fitness-privacy-or-security-approval-owner-appointment-test-execution-or-results-evidence-or-coverage-truth-quality-implementation-readiness-acceptance-release-deployment-or-action-authority",
    }).state).toBe("candidate-complete")
  })

  it("rejects dangling methodology references, unattributed selections, and secret-shaped values", () => {
    const value = input()
    expect(testMethodologyInputSchema.safeParse({
      ...value, decisions: [{ ...value.decisions[0]!, environmentIds: ["missing-environment"] }],
    }).success).toBe(false)
    expect(testMethodologyInputSchema.safeParse({
      ...value, decisions: [{ ...value.decisions[0]!, selectedBy: undefined }],
    }).success).toBe(false)
    expect(testMethodologyInputSchema.safeParse({
      ...value, limitations: ["apiKey=test-methodology-secret-value"],
    }).success).toBe(false)
  })
})
