import { describe, expect, it } from "vitest"

import {
  boilerplateCompatibilityDimensions,
  boilerplateCompatibilityValidationInputSchema,
  boilerplateCompatibilityValidationStatusSchema,
} from "./boilerplate-compatibility-validation.js"

const digest = (value: string) => `sha256:${value.repeat(64)}`
const ids = Array.from(
  { length: 40 },
  (_, index) => `17000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
)

function evidence(index: number) {
  return {
    kind: "evidence" as const,
    sourceId: `compatibility-evidence-${index + 1}`,
    revision: 1,
    digest: digest(((index % 10) + 1).toString(16)),
    evidenceState: "observed-not-validated" as const,
  }
}

function input() {
  return {
    initiativeId: ids[0],
    context: {
      productRevision: 1, productDigest: digest("a"),
      initiativeRevision: 1, initiativeDigest: digest("b"),
    },
    informationClassification: "internal" as const,
    title: "Candidate boilerplate compatibility validation",
    implementationUnitModel: { recordId: ids[1], revision: 1, digest: digest("1") },
    dependencyMapping: { recordId: ids[2], revision: 1, digest: digest("2") },
    technologyProfile: { recordId: ids[3], revision: 1, digest: digest("3") },
    boilerplateRegistry: { recordId: ids[4], revision: 1, digest: digest("4") },
    boilerplateSelectionBinding: { recordId: ids[5], revision: 1, digest: digest("5") },
    subjects: [{
      id: ids[6], ordinal: 1, bindingDecisionId: ids[7], implementationUnitId: ids[8],
      technologyProfileId: ids[9], boilerplateRegistryEntryId: ids[10],
      boilerplateVersionCandidate: "candidate-commit-1", outcome: "candidate-compatible" as const,
      dimensionAssessments: boilerplateCompatibilityDimensions.map((dimension, index) => ({
        id: ids[index + 11], ordinal: index + 1, dimension, outcome: "candidate-compatible" as const,
        claim: `The ${dimension} dimension is an evidence-backed compatibility candidate only`,
        evidenceReferences: [evidence(index)], exceptionReferenceCandidates: [],
        assessedBy: { kind: "human" as const, id: "compatibility-reviewer" },
        assessedAt: "2026-07-30T00:00:00.000Z",
        compatibilityTruthState: "not-established" as const,
        approvalState: "not-established" as const,
        exceptionWaiverState: "not-established" as const,
      })),
    }],
    unresolvedQuestions: [],
    limitations: ["Candidate validation does not establish actual asset behavior or compatibility truth"],
    reviewState: "ready-for-human-review" as const,
    compatibilityTruthState: "not-established" as const,
    compatibilityCompletenessState: "not-established" as const,
    validationDecisionState: "not-established" as const,
    actualAssetBehaviorState: "not-established" as const,
    testExecutionState: "not-established" as const,
    designValidityState: "not-established" as const,
    securityPrivacyApprovalState: "not-established" as const,
    licensingApprovalState: "not-established" as const,
    exceptionWaiverState: "not-established" as const,
    selectionBindingEffectivenessState: "not-established" as const,
    sourceRetrievalState: "not-established" as const,
    assetImportInstantiationState: "not-established" as const,
    architectureBaselineDesignationState: "not-established" as const,
    implementationReadinessState: "not-established" as const,
    implementationCompletenessState: "not-established" as const,
    assignmentExecutionState: "not-established" as const,
    acceptanceDecisionState: "not-established" as const,
    mergeReadinessState: "not-established" as const,
    releaseReadinessState: "not-established" as const,
    deploymentReadinessState: "not-established" as const,
    actionAuthorityState: "not-granted" as const,
  }
}

describe("Boilerplate Compatibility Validation contracts", () => {
  it("accepts complete canonical evidence-backed compatibility candidates", () => {
    const parsed = boilerplateCompatibilityValidationInputSchema.parse(input())
    expect(parsed.subjects[0]?.dimensionAssessments).toHaveLength(boilerplateCompatibilityDimensions.length)
    expect(parsed.subjects[0]?.outcome).toBe("candidate-compatible")
  })

  it("rejects incomplete dimension coverage and inconsistent subject outcomes", () => {
    const missingDimension = input()
    missingDimension.subjects[0]!.dimensionAssessments = missingDimension.subjects[0]!.dimensionAssessments.slice(0, -1)
    expect(() => boilerplateCompatibilityValidationInputSchema.parse(missingDimension)).toThrow()

    const inconsistentBase = input()
    const inconsistentOutcome = {
      ...inconsistentBase,
      subjects: inconsistentBase.subjects.map((subject) => ({
        ...subject,
        dimensionAssessments: subject.dimensionAssessments.map((assessment, index) => ({
          ...assessment,
          outcome: index === 0 ? "candidate-incompatible" as const : assessment.outcome,
        })),
      })),
    }
    expect(() => boilerplateCompatibilityValidationInputSchema.parse(inconsistentOutcome)).toThrow(
      /reconcile deterministically/u,
    )
  })

  it("rejects unresolved review-ready, authority-forged, and secret-shaped candidates", () => {
    expect(() => boilerplateCompatibilityValidationInputSchema.parse({
      ...input(), unresolvedQuestions: ["Who will validate actual asset behavior?"],
    })).toThrow(/no unresolved questions/u)
    expect(() => boilerplateCompatibilityValidationInputSchema.parse({
      ...input(), compatibilityTruthState: "established",
    })).toThrow()
    expect(() => boilerplateCompatibilityValidationInputSchema.parse({
      ...input(), title: `api_key=sk-${"x".repeat(32)}`,
    })).toThrow(/secret-shaped/u)
  })

  it("requires candidate-complete status to reconcile exact dependency and coverage counts", () => {
    const status = {
      schemaVersion: 1 as const, kind: "boilerplate-compatibility-validation-status" as const,
      productId: ids[0], productRevision: 1, initiativeId: ids[1], initiativeRevision: 1,
      candidate: { recordId: ids[2], revision: 1, digest: digest("1") },
      implementationUnitModel: { recordId: ids[3], revision: 1, digest: digest("2") },
      dependencyMapping: { recordId: ids[4], revision: 1, digest: digest("3") },
      technologyProfile: { recordId: ids[5], revision: 1, digest: digest("4") },
      boilerplateRegistry: { recordId: ids[6], revision: 1, digest: digest("5") },
      boilerplateSelectionBinding: { recordId: ids[7], revision: 1, digest: digest("6") },
      selectedBindingCount: 1, subjectCount: 1, compatibleCandidateCount: 1,
      incompatibleCandidateCount: 0, exceptionCandidateCount: 0, notAssessedCount: 0,
      dimensionAssessmentCount: boilerplateCompatibilityDimensions.length,
      missingSubjectCount: 0, invalidSubjectCount: 0, missingDimensionCount: 0,
      missingEvidenceCount: 0, expiredAssessmentCount: 0, conflictingOutcomeCount: 0,
      selectionBindingGapCount: 0,
      staleBindingCount: 0, staleImplementationUnitModelCount: 0, staleDependencyMappingCount: 0,
      staleTechnologyProfileCount: 0, staleBoilerplateRegistryCount: 0,
      staleSelectionBindingCount: 0, invalidCandidateCount: 0, unresolvedQuestionCount: 0,
      reviewState: "ready-for-human-review" as const, state: "candidate-complete" as const,
      reasons: [], assessedAt: "2026-07-30T00:00:00.000Z",
      authorityBoundary: "boilerplate-compatibility-validation-status-is-observational-and-does-not-establish-compatibility-truth-or-completeness-validation-decision-actual-asset-behavior-test-execution-design-validity-security-privacy-or-licensing-approval-exception-waiver-selection-binding-effectiveness-source-retrieval-import-instantiation-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const,
    }
    expect(boilerplateCompatibilityValidationStatusSchema.parse(status).state).toBe("candidate-complete")
    expect(() => boilerplateCompatibilityValidationStatusSchema.parse({
      ...status, subjectCount: 2,
    })).toThrow(/outcome counts must reconcile/u)
    expect(() => boilerplateCompatibilityValidationStatusSchema.parse({
      ...status, missingEvidenceCount: 1,
    })).toThrow(/requires exact current dependencies/u)
  })
})
