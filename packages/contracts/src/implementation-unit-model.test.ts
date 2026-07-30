import { describe, expect, it } from "vitest"

import {
  implementationUnitModelInputSchema,
  implementationUnitModelStatusSchema,
} from "./implementation-unit-model.js"

const digest = (value: string) => `sha256:${value.repeat(64)}`
const ids = Array.from({ length: 24 }, (_, index) => `12000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`)

function input() {
  return {
    initiativeId: ids[0],
    context: { productRevision: 1, productDigest: digest("1"), initiativeRevision: 1, initiativeDigest: digest("2") },
    informationClassification: "internal" as const,
    title: "Candidate implementation unit model",
    hierarchy: { recordId: ids[1], revision: 1, digest: digest("3") },
    mvpSliceDefinition: { recordId: ids[2], revision: 1, digest: digest("4") },
    acceptanceCriteria: { recordId: ids[3], revision: 1, digest: digest("5") },
    definitionOfReady: { recordId: ids[4], revision: 1, digest: digest("6") },
    definitionOfDone: { recordId: ids[5], revision: 1, digest: digest("7") },
    units: [
      {
        id: ids[6], ordinal: 1, key: "api-service", kind: "service" as const,
        title: "API service", boundary: "Owns governed API behavior and its local verification boundary",
        subjectNodeIds: [ids[8]],
        requirementReferences: [{ recordType: "requirement" as const, key: "GAEP-API-001", recordId: ids[10], revision: 1, digest: digest("8") }],
        repository: {
          repositoryKey: "gaep", modulePath: "apps/api", placementState: "candidate-not-verified" as const,
          evidenceReferences: [{ kind: "repository-observation" as const, recordId: ids[12], revision: 1, digest: digest("9") }],
        },
        ownerCandidate: { kind: "human" as const, id: "api-maintainer-candidate" },
        dependencyUnitIds: [],
        blastRadius: {
          assessmentState: "candidate-assessed" as const, affectedUnitIds: [ids[7]], affectedSurfaceKeys: ["api"],
          rationale: "API changes may affect the candidate web application integration surface",
          assessedBy: { kind: "human" as const, id: "architecture-reviewer" }, assessedAt: "2026-07-30T00:00:00.000Z",
        },
      },
      {
        id: ids[7], ordinal: 2, key: "web-application", kind: "application" as const,
        title: "Web application", boundary: "Owns the governed browser interaction and presentation boundary",
        subjectNodeIds: [ids[9]],
        requirementReferences: [{ recordType: "requirement" as const, key: "GAEP-WEB-001", recordId: ids[11], revision: 1, digest: digest("a") }],
        repository: {
          repositoryKey: "gaep", modulePath: "apps/web", placementState: "candidate-not-verified" as const,
          evidenceReferences: [],
        },
        ownerCandidate: { kind: "human" as const, id: "web-maintainer-candidate" },
        dependencyUnitIds: [ids[6]],
        blastRadius: {
          assessmentState: "candidate-assessed" as const, affectedUnitIds: [], affectedSurfaceKeys: ["browser-ui"],
          rationale: "Presentation changes are currently assessed against the candidate browser surface",
          assessedBy: { kind: "human" as const, id: "architecture-reviewer" }, assessedAt: "2026-07-30T00:00:00.000Z",
        },
      },
    ],
    unresolvedQuestions: [],
    limitations: ["Repository, owner, dependency, and impact claims remain candidates for human review"],
    reviewState: "ready-for-human-review" as const,
    repositoryTruthState: "not-established" as const,
    ownershipAppointmentState: "not-established" as const,
    dependencyCompletenessState: "not-established" as const,
    impactCompletenessState: "not-established" as const,
    implementationReadinessState: "not-established" as const,
    implementationCompletenessState: "not-established" as const,
    assignmentExecutionState: "not-established" as const,
    approvalState: "not-established" as const,
    acceptanceDecisionState: "not-established" as const,
    mergeReadinessState: "not-established" as const,
    releaseReadinessState: "not-established" as const,
    deploymentReadinessState: "not-established" as const,
    actionAuthorityState: "not-granted" as const,
  }
}

describe("Implementation Unit Model contracts", () => {
  it("accepts canonical unit, placement, ownership, dependency, and blast-radius candidates without granting authority", () => {
    expect(implementationUnitModelInputSchema.parse(input())).toEqual(input())
  })

  it("rejects duplicated membership, dependency cycles, unsafe module paths, and secrets", () => {
    const duplicatedMembership = input()
    duplicatedMembership.units[1]!.subjectNodeIds = [...duplicatedMembership.units[0]!.subjectNodeIds]
    expect(() => implementationUnitModelInputSchema.parse(duplicatedMembership)).toThrow(/exactly one implementation unit/u)

    const cyclic = input()
    cyclic.units[0]!.dependencyUnitIds = [cyclic.units[1]!.id]
    expect(() => implementationUnitModelInputSchema.parse(cyclic)).toThrow(/acyclic/u)

    const traversal = input()
    traversal.units[0]!.repository.modulePath = "../outside"
    expect(() => implementationUnitModelInputSchema.parse(traversal)).toThrow(/portable repository-relative/u)

    const secret = input()
    secret.units[0]!.boundary = `api_key=${"x".repeat(24)}`
    expect(() => implementationUnitModelInputSchema.parse(secret)).toThrow(/secret-shaped/u)
  })

  it("rejects forged candidate-complete status without exact current dependencies", () => {
    expect(() => implementationUnitModelStatusSchema.parse({
      schemaVersion: 1, kind: "implementation-unit-model-status",
      productId: ids[0], productRevision: 1, initiativeId: ids[0], initiativeRevision: 1,
      unitCount: 2, subjectCount: 2, requirementReferenceCount: 2,
      repositoryCandidateCount: 2, ownerCandidateCount: 2, dependencyEdgeCount: 1,
      candidateAssessedBlastRadiusCount: 2, notAssessedBlastRadiusCount: 0,
      missingSubjectCount: 0, invalidUnitCount: 0, staleBindingCount: 0,
      staleHierarchyCount: 0, staleMvpSliceDefinitionCount: 0, staleAcceptanceCriteriaCount: 0,
      staleDefinitionOfReadyCount: 0, staleDefinitionOfDoneCount: 0, unresolvedQuestionCount: 0,
      reviewState: "ready-for-human-review", state: "candidate-complete", reasons: [],
      assessedAt: "2026-07-30T00:00:00.000Z",
      authorityBoundary: "implementation-unit-model-status-is-observational-and-does-not-establish-repository-truth-ownership-appointment-dependency-or-impact-completeness-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority",
    })).toThrow(/exact current dependencies/u)
  })

  it("rejects forged authority states", () => {
    expect(() => implementationUnitModelInputSchema.parse({ ...input(), approvalState: "approved" })).toThrow()
    expect(() => implementationUnitModelInputSchema.parse({ ...input(), actionAuthorityState: "granted" })).toThrow()
  })
})
