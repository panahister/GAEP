import { describe, expect, it } from "vitest"

import { definitionOfDoneInputSchema, definitionOfDoneProjectionSchema } from "./definition-of-done.js"

const digest = (value: string) => `sha256:${value.repeat(64)}`
const ids = Array.from({ length: 14 }, (_, index) => `11000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`)

function input() {
  return {
    initiativeId: ids[0],
    context: { productRevision: 1, productDigest: digest("1"), initiativeRevision: 1, initiativeDigest: digest("2") },
    informationClassification: "internal" as const,
    title: "Candidate item Definition of Done",
    hierarchy: { recordId: ids[1], revision: 1, digest: digest("3") },
    mvpSliceDefinition: { recordId: ids[2], revision: 1, digest: digest("4") },
    prioritizationModel: { recordId: ids[3], revision: 1, digest: digest("5") },
    acceptanceCriteria: { recordId: ids[4], revision: 1, digest: digest("6") },
    definitionOfReady: { recordId: ids[5], revision: 1, digest: digest("7") },
    policyVersion: 1,
    policyEntries: [{ key: "test-evidence", kind: "test" as const, title: "Test evidence", rule: "Exact candidate test evidence must be available", notApplicableAllowed: false, evidenceRequired: true }],
    itemEvaluations: [{
      id: ids[6], ordinal: 1, subjectNodeId: ids[7], subjectKey: "story.bounded-response", subjectLevel: "story" as const,
      prerequisiteKey: "test-evidence", applicability: "required" as const,
      assessmentState: "candidate-satisfied" as const, rationale: "The exact test evidence candidate is present for human review",
      evidenceReferences: [{ kind: "test" as const, recordId: ids[8], revision: 1, digest: digest("8") }],
      assessedBy: { kind: "human" as const, id: "quality-reviewer" }, assessedAt: "2026-07-30T00:00:00.000Z",
    }],
    validUntil: "2099-07-30T00:00:00.000Z",
    unresolvedQuestions: [], limitations: ["Passing does not establish completion, acceptance, release, or deployment readiness"],
    reviewState: "ready-for-human-review" as const,
    evidenceTruthState: "not-established" as const, testResultState: "not-established" as const,
    qualityState: "not-established" as const, requirementSatisfactionState: "not-established" as const,
    acceptanceCriteriaSatisfactionState: "not-established" as const, approvalState: "not-established" as const,
    readyDoneState: "not-established" as const, exceptionWaiverAuthorityState: "not-established" as const,
    implementationCompletenessState: "not-established" as const, mergeReadinessState: "not-established" as const,
    releaseReadinessState: "not-established" as const, deploymentReadinessState: "not-established" as const,
    assignmentExecutionState: "not-established" as const, acceptanceDecisionState: "not-established" as const,
    actionAuthorityState: "not-granted" as const,
  }
}

describe("Definition of Done contracts", () => {
  it("accepts exact item evaluation candidates without granting completion or release authority", () => {
    expect(definitionOfDoneInputSchema.parse(input())).toEqual(input())
  })

  it("rejects undeclared prerequisites, unsupported not-applicable claims, missing evidence, and secrets", () => {
    expect(() => definitionOfDoneInputSchema.parse({ ...input(), itemEvaluations: [{ ...input().itemEvaluations[0], prerequisiteKey: "missing" }] })).toThrow(/declared policy prerequisite/u)
    expect(() => definitionOfDoneInputSchema.parse({ ...input(), itemEvaluations: [{ ...input().itemEvaluations[0], applicability: "not-applicable-candidate" }] })).toThrow(/does not allow/u)
    expect(() => definitionOfDoneInputSchema.parse({ ...input(), itemEvaluations: [{ ...input().itemEvaluations[0], evidenceReferences: [] }] })).toThrow(/exact evidence/u)
    expect(() => definitionOfDoneInputSchema.parse({ ...input(), itemEvaluations: [{ ...input().itemEvaluations[0], rationale: `api_key=${"x".repeat(24)}` }] })).toThrow(/secret-shaped/u)
  })

  it("rejects a forged passing projection without exact dependencies", () => {
    expect(() => definitionOfDoneProjectionSchema.parse({
      schemaVersion: 1, kind: "definition-of-done-projection",
      product: { id: ids[0], revision: 1, digest: digest("1") },
      initiative: { id: ids[0], revision: 1, digest: digest("2"), state: "active" },
      status: {
        schemaVersion: 1, kind: "definition-of-done-status", productId: ids[0], productRevision: 1,
        initiativeId: ids[0], initiativeRevision: 1, subjectCount: 1, policyEntryCount: 1,
        expectedEvaluationCount: 1, evaluationCount: 1, candidateSatisfiedCount: 1, notSatisfiedCount: 0,
        notApplicableCount: 0, exceptionCandidateCount: 0, notAssessedCount: 0, staleEvaluationCount: 0,
        invalidEvaluationCount: 0, missingEvaluationCount: 0, staleBindingCount: 0, staleHierarchyCount: 0,
        staleMvpSliceDefinitionCount: 0, stalePrioritizationModelCount: 0, staleAcceptanceCriteriaCount: 0,
        staleDefinitionOfReadyCount: 0, expiredCount: 0, unresolvedQuestionCount: 0,
        reviewState: "ready-for-human-review", result: "candidate-passed", reasons: [],
        assessedAt: "2026-07-30T00:00:00.000Z",
        gateBoundary: "a-passing-definition-of-done-candidate-is-an-evaluation-result-not-completion-acceptance-approval-merge-release-deployment-or-action-permission",
        authorityBoundary: "definition-of-done-status-is-observational-and-does-not-establish-evidence-truth-test-success-quality-requirement-satisfaction-acceptance-criteria-satisfaction-approval-ready-done-exception-waiver-authority-implementation-completeness-merge-readiness-release-readiness-deployment-readiness-assignment-execution-acceptance-or-action-authority",
      },
      observedAt: "2026-07-30T00:00:00.000Z",
      privacyBoundary: "projection-contains-record-identities-counts-statuses-and-policy-evaluation-receipt-snapshot-digests-only-not-rules-rationales-evidence-identities-assessor-identities-personal-data-secrets-credentials-or-machine-paths",
      gateBoundary: "a-passing-definition-of-done-candidate-is-an-evaluation-result-not-completion-acceptance-approval-merge-release-deployment-or-action-permission",
      authorityBoundary: "definition-of-done-projection-is-read-only-and-does-not-establish-evidence-truth-test-success-quality-requirement-satisfaction-acceptance-criteria-satisfaction-approval-ready-done-exception-waiver-authority-implementation-completeness-merge-readiness-release-readiness-deployment-readiness-assignment-execution-acceptance-or-action-authority",
      snapshotDigest: digest("9"),
    })).toThrow(/Candidate-passed requires exact current dependencies/u)
  })
})
