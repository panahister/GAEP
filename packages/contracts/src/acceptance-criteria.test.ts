import { describe, expect, it } from "vitest"

import { acceptanceCriteriaInputSchema, acceptanceCriteriaProjectionSchema } from "./acceptance-criteria.js"

const digest = (value: string) => `sha256:${value.repeat(64)}`
const ids = {
  initiative: "10000000-0000-4000-8000-000000000001",
  hierarchy: "10000000-0000-4000-8000-000000000002",
  mvp: "10000000-0000-4000-8000-000000000003",
  priority: "10000000-0000-4000-8000-000000000004",
  criterion: "10000000-0000-4000-8000-000000000005",
  story: "10000000-0000-4000-8000-000000000006",
  requirement: "10000000-0000-4000-8000-000000000007",
  evidence: "10000000-0000-4000-8000-000000000008",
}

function input() {
  return {
    initiativeId: ids.initiative,
    context: {
      productRevision: 1,
      productDigest: digest("1"),
      initiativeRevision: 1,
      initiativeDigest: digest("2"),
    },
    informationClassification: "internal" as const,
    title: "Candidate Story Acceptance Criteria",
    hierarchy: { recordId: ids.hierarchy, revision: 1, digest: digest("3") },
    mvpSliceDefinition: { recordId: ids.mvp, revision: 1, digest: digest("4") },
    prioritizationModel: { recordId: ids.priority, revision: 1, digest: digest("5") },
    verificationMethods: [{
      key: "automated-contract-test",
      kind: "automated-test" as const,
      state: "candidate-defined" as const,
      evidenceReferences: [{ kind: "test" as const, recordId: ids.evidence, revision: 1, digest: digest("6") }],
    }],
    criteria: [{
      id: ids.criterion,
      key: "story-response-is-bounded",
      subjectNodeId: ids.story,
      subjectKey: "story.bounded-response",
      subjectLevel: "story" as const,
      ordinal: 1,
      classification: "functional-positive" as const,
      precondition: "Given the exact current Story input is valid",
      stimulus: "When the bounded response operation is requested",
      expectedResult: "Then one bounded response is returned without an external effect",
      requirements: [{
        recordType: "requirement" as const,
        key: "GAEP-TEST-001",
        recordId: ids.requirement,
        revision: 1,
        digest: digest("7"),
      }],
      verificationMethodKeys: ["automated-contract-test"],
      testabilityState: "candidate-testable" as const,
    }],
    criterionSetCompletenessState: "candidate-complete" as const,
    requirementCoverageState: "candidate-complete" as const,
    unresolvedQuestions: [],
    limitations: ["Human validity and acceptance remain unestablished"],
    reviewState: "ready-for-human-review" as const,
    criterionValidityState: "not-established" as const,
    requirementSatisfactionState: "not-established" as const,
    priorityDecisionState: "not-established" as const,
    commitmentState: "not-established" as const,
    approvalState: "not-established" as const,
    readyDoneState: "not-established" as const,
    implementationReadinessState: "not-established" as const,
    assignmentExecutionState: "not-established" as const,
    acceptanceDecisionState: "not-established" as const,
    implementationAuthorityState: "not-granted" as const,
  }
}

describe("Acceptance Criteria contracts", () => {
  it("accepts structured exact-bound candidate criteria without granting validity or acceptance", () => {
    expect(acceptanceCriteriaInputSchema.parse(input())).toEqual(input())
  })

  it("rejects undeclared methods, untestable review-ready criteria, and secret-shaped content", () => {
    expect(() => acceptanceCriteriaInputSchema.parse({
      ...input(),
      criteria: [{ ...input().criteria[0], verificationMethodKeys: ["missing-method"] }],
    })).toThrow(/declared verification methods/u)
    expect(() => acceptanceCriteriaInputSchema.parse({
      ...input(),
      criteria: [{ ...input().criteria[0], testabilityState: "not-assessed" }],
    })).toThrow(/Review-ready Acceptance Criteria/u)
    expect(() => acceptanceCriteriaInputSchema.parse({
      ...input(),
      criteria: [{ ...input().criteria[0], expectedResult: `api_key=${"x".repeat(24)}` }],
    })).toThrow(/secret-shaped/u)
  })

  it("rejects a forged complete projection that lacks exact dependencies", () => {
    expect(() => acceptanceCriteriaProjectionSchema.parse({
      schemaVersion: 1,
      kind: "acceptance-criteria-projection",
      product: { id: ids.initiative, revision: 1, digest: digest("1") },
      initiative: { id: ids.initiative, revision: 1, digest: digest("2"), state: "active" },
      status: {
        schemaVersion: 1,
        kind: "acceptance-criteria-status",
        productId: ids.initiative,
        productRevision: 1,
        initiativeId: ids.initiative,
        initiativeRevision: 1,
        subjectCount: 1,
        coveredSubjectCount: 1,
        uncoveredSubjectCount: 0,
        criterionCount: 1,
        testableCriterionCount: 1,
        unassessedCriterionCount: 0,
        requirementTraceCount: 1,
        uncoveredRequirementCount: 0,
        verificationMethodCount: 1,
        staleBindingCount: 0,
        staleHierarchyCount: 0,
        staleMvpSliceDefinitionCount: 0,
        stalePrioritizationModelCount: 0,
        invalidCriterionCount: 0,
        unresolvedQuestionCount: 0,
        criterionSetCompletenessState: "candidate-complete",
        requirementCoverageState: "candidate-complete",
        reviewState: "ready-for-human-review",
        state: "complete-for-review",
        reasons: [],
        assessedAt: "2026-07-30T00:00:00.000Z",
        authorityBoundary: "acceptance-criteria-status-is-observational-and-does-not-establish-criterion-validity-completeness-requirement-satisfaction-priority-commitment-approval-ready-done-implementation-readiness-assignment-execution-acceptance-or-action-authority",
      },
      observedAt: "2026-07-30T00:00:00.000Z",
      privacyBoundary: "projection-contains-record-identities-counts-statuses-and-subject-criterion-method-coverage-snapshot-digests-only-not-criterion-text-requirement-identities-verification-evidence-personal-data-secrets-credentials-or-machine-paths",
      authorityBoundary: "acceptance-criteria-projection-is-read-only-and-does-not-establish-criterion-validity-completeness-requirement-satisfaction-priority-commitment-approval-ready-done-implementation-readiness-assignment-execution-acceptance-or-action-authority",
      snapshotDigest: digest("8"),
    })).toThrow(/Complete-for-review requires exact/u)
  })
})
