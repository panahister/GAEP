import { describe, expect, it } from "vitest"

import { definitionOfReadyInputSchema, definitionOfReadyProjectionSchema } from "./definition-of-ready.js"

const digest = (value: string) => `sha256:${value.repeat(64)}`
const ids = Array.from({ length: 12 }, (_, index) => `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`)

function input() {
  return {
    initiativeId: ids[0],
    context: { productRevision: 1, productDigest: digest("1"), initiativeRevision: 1, initiativeDigest: digest("2") },
    informationClassification: "internal" as const,
    title: "Candidate item Definition of Ready",
    hierarchy: { recordId: ids[1], revision: 1, digest: digest("3") },
    mvpSliceDefinition: { recordId: ids[2], revision: 1, digest: digest("4") },
    prioritizationModel: { recordId: ids[3], revision: 1, digest: digest("5") },
    acceptanceCriteria: { recordId: ids[4], revision: 1, digest: digest("6") },
    policyVersion: 1,
    policyEntries: [{ key: "acceptance-criteria", kind: "acceptance-criteria" as const, title: "Acceptance Criteria", rule: "Exact candidate criteria must be available", notApplicableAllowed: false, evidenceRequired: true }],
    itemEvaluations: [{
      id: ids[5], ordinal: 1, subjectNodeId: ids[6], subjectKey: "story.bounded-response", subjectLevel: "story" as const,
      prerequisiteKey: "acceptance-criteria", applicability: "required" as const,
      assessmentState: "candidate-satisfied" as const, rationale: "The exact candidate record is present for human review",
      evidenceReferences: [{ kind: "acceptance-criteria" as const, recordId: ids[4], revision: 1, digest: digest("6") }],
      assessedBy: { kind: "human" as const, id: "product-owner" }, assessedAt: "2026-07-30T00:00:00.000Z",
    }],
    validUntil: "2099-07-30T00:00:00.000Z",
    unresolvedQuestions: [], limitations: ["Passing does not admit the item into implementation"],
    reviewState: "ready-for-human-review" as const,
    prerequisiteTruthState: "not-established" as const, criterionValidityState: "not-established" as const,
    requirementSatisfactionState: "not-established" as const, priorityDecisionState: "not-established" as const,
    commitmentState: "not-established" as const, approvalState: "not-established" as const,
    readyDoneState: "not-established" as const, exceptionWaiverAuthorityState: "not-established" as const,
    phaseEntryState: "not-established" as const, implementationReadinessState: "not-established" as const,
    assignmentExecutionState: "not-established" as const, acceptanceDecisionState: "not-established" as const,
    implementationAuthorityState: "not-granted" as const,
  }
}

describe("Definition of Ready contracts", () => {
  it("accepts exact item evaluation candidates without granting admission or implementation permission", () => {
    expect(definitionOfReadyInputSchema.parse(input())).toEqual(input())
  })

  it("rejects undeclared prerequisites, unsupported not-applicable claims, missing evidence, and secrets", () => {
    expect(() => definitionOfReadyInputSchema.parse({ ...input(), itemEvaluations: [{ ...input().itemEvaluations[0], prerequisiteKey: "missing" }] })).toThrow(/declared policy prerequisite/u)
    expect(() => definitionOfReadyInputSchema.parse({ ...input(), itemEvaluations: [{ ...input().itemEvaluations[0], applicability: "not-applicable-candidate" }] })).toThrow(/does not allow/u)
    expect(() => definitionOfReadyInputSchema.parse({ ...input(), itemEvaluations: [{ ...input().itemEvaluations[0], evidenceReferences: [] }] })).toThrow(/exact evidence/u)
    expect(() => definitionOfReadyInputSchema.parse({ ...input(), itemEvaluations: [{ ...input().itemEvaluations[0], rationale: `api_key=${"x".repeat(24)}` }] })).toThrow(/secret-shaped/u)
  })

  it("rejects a forged passing projection without exact dependencies", () => {
    expect(() => definitionOfReadyProjectionSchema.parse({
      schemaVersion: 1, kind: "definition-of-ready-projection",
      product: { id: ids[0], revision: 1, digest: digest("1") },
      initiative: { id: ids[0], revision: 1, digest: digest("2"), state: "active" },
      status: {
        schemaVersion: 1, kind: "definition-of-ready-status", productId: ids[0], productRevision: 1,
        initiativeId: ids[0], initiativeRevision: 1, subjectCount: 1, policyEntryCount: 1,
        expectedEvaluationCount: 1, evaluationCount: 1, candidateSatisfiedCount: 1, notSatisfiedCount: 0,
        notApplicableCount: 0, exceptionCandidateCount: 0, notAssessedCount: 0, staleEvaluationCount: 0,
        invalidEvaluationCount: 0, missingEvaluationCount: 0, staleBindingCount: 0, staleHierarchyCount: 0,
        staleMvpSliceDefinitionCount: 0, stalePrioritizationModelCount: 0, staleAcceptanceCriteriaCount: 0,
        expiredCount: 0, unresolvedQuestionCount: 0, reviewState: "ready-for-human-review", result: "candidate-passed",
        reasons: [], assessedAt: "2026-07-30T00:00:00.000Z",
        gateBoundary: "a-passing-definition-of-ready-candidate-is-an-evaluation-result-not-admission-readiness-assignment-execution-or-implementation-permission",
        authorityBoundary: "definition-of-ready-status-is-observational-and-does-not-establish-prerequisite-truth-criterion-validity-completeness-requirement-satisfaction-priority-commitment-approval-ready-done-exception-waiver-authority-phase-entry-implementation-readiness-assignment-execution-acceptance-or-action-authority",
      },
      observedAt: "2026-07-30T00:00:00.000Z",
      privacyBoundary: "projection-contains-record-identities-counts-statuses-and-policy-evaluation-receipt-snapshot-digests-only-not-rules-rationales-evidence-identities-assessor-identities-personal-data-secrets-credentials-or-machine-paths",
      gateBoundary: "a-passing-definition-of-ready-candidate-is-an-evaluation-result-not-admission-readiness-assignment-execution-or-implementation-permission",
      authorityBoundary: "definition-of-ready-projection-is-read-only-and-does-not-establish-prerequisite-truth-criterion-validity-completeness-requirement-satisfaction-priority-commitment-approval-ready-done-exception-waiver-authority-phase-entry-implementation-readiness-assignment-execution-acceptance-or-action-authority",
      snapshotDigest: digest("7"),
    })).toThrow(/Candidate-passed requires exact current dependencies/u)
  })
})
