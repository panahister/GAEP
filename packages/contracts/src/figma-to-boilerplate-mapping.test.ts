import { describe, expect, it } from "vitest"

import {
  figmaToBoilerplateMappingInputSchema,
  figmaToBoilerplateMappingStatusSchema,
} from "./figma-to-boilerplate-mapping.js"

const digest = (value: string) => `sha256:${value.repeat(64)}`
const ids = Array.from(
  { length: 32 },
  (_, index) => `18000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
)
const reference = (index: number) => ({ recordId: ids[index]!, revision: 1, digest: digest((index % 10).toString(16)) })

function input() {
  return {
    initiativeId: ids[0],
    context: {
      productRevision: 1, productDigest: digest("a"),
      initiativeRevision: 1, initiativeDigest: digest("b"),
    },
    informationClassification: "internal" as const,
    title: "Candidate Figma-to-Boilerplate mapping",
    designApplicability: reference(1),
    designSystemTokenContract: reference(2),
    responsiveMultiPlatformTargets: reference(3),
    finalizedFigmaSnapshotImport: reference(4),
    designToRequirementBinding: reference(5),
    designBaseline: reference(6),
    implementationUnitModel: reference(7),
    technologyProfile: reference(8),
    boilerplateRegistry: reference(9),
    boilerplateSelectionBinding: reference(10),
    boilerplateCompatibilityValidation: reference(11),
    subjects: [{
      id: ids[12], ordinal: 1, designBindingKey: "checkout.primary-action",
      designItemKey: "checkout.primary-action", designItemKind: "component" as const,
      mappingKind: "component" as const, bindingDecisionId: ids[13],
      compatibilityValidationSubjectId: ids[14], implementationUnitId: ids[15],
      technologyProfileId: ids[16], boilerplateRegistryEntryId: ids[17],
      targetKind: "component" as const, targetCandidate: "src/components/checkout/PrimaryAction",
      requirementKeys: ["GAEP-REQ-001"], outcome: "candidate-mapped" as const,
      evidenceReferences: [{
        kind: "design-to-requirement" as const, sourceId: "checkout-primary-action-binding",
        revision: 1, digest: digest("c"), evidenceState: "human-reviewed" as const,
      }],
      conflictReferenceCandidates: [],
      mappedBy: { kind: "human" as const, id: "mapping-reviewer" },
      mappedAt: "2026-07-30T00:00:00.000Z",
      mappingTruthState: "not-established" as const,
      mappingCompletenessState: "not-established" as const,
      designValidityState: "not-established" as const,
      generatedCodeState: "not-generated" as const,
      implementationAuthorityState: "not-granted" as const,
    }],
    unresolvedQuestions: [],
    limitations: ["Candidate mappings do not establish design validity or generate code"],
    reviewState: "ready-for-human-review" as const,
    figmaConnectionState: "not-connected" as const,
    returnedFigmaContentState: "not-established" as const,
    designValidityState: "not-established" as const,
    designApprovalState: "not-established" as const,
    designBaselineDesignationState: "not-established" as const,
    mappingTruthState: "not-established" as const,
    mappingCompletenessState: "not-established" as const,
    selectionBindingEffectivenessState: "not-established" as const,
    compatibilityTruthState: "not-established" as const,
    sourceRetrievalState: "not-established" as const,
    assetImportInstantiationState: "not-established" as const,
    codeGenerationState: "not-performed" as const,
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

describe("Figma-to-Boilerplate Mapping contracts", () => {
  it("accepts exact evidence-backed attributable candidate mappings", () => {
    const parsed = figmaToBoilerplateMappingInputSchema.parse(input())
    expect(parsed.subjects[0]?.outcome).toBe("candidate-mapped")
    expect(parsed.subjects[0]?.targetCandidate).toContain("PrimaryAction")
  })

  it("rejects duplicate design bindings and non-contiguous subject ordering", () => {
    const duplicateBase = input()
    expect(() => figmaToBoilerplateMappingInputSchema.parse({
      ...duplicateBase,
      subjects: [duplicateBase.subjects[0], { ...duplicateBase.subjects[0], id: ids[18], ordinal: 2 }],
    })).toThrow(/one mapping subject/u)
    expect(() => figmaToBoilerplateMappingInputSchema.parse({
      ...input(), subjects: [{ ...input().subjects[0], ordinal: 2 }],
    })).toThrow(/contiguous/u)
  })

  it("rejects unreviewed review-ready, authority-forged, and secret-shaped candidates", () => {
    const unreviewedBase = input()
    expect(() => figmaToBoilerplateMappingInputSchema.parse({
      ...unreviewedBase,
      subjects: [{ ...unreviewedBase.subjects[0], outcome: "not-assessed", mappedBy: undefined, mappedAt: undefined }],
    })).toThrow(/every design binding/u)
    expect(() => figmaToBoilerplateMappingInputSchema.parse({
      ...input(), codeGenerationState: "performed",
    })).toThrow()
    expect(() => figmaToBoilerplateMappingInputSchema.parse({
      ...input(), title: `api_key=sk-${"x".repeat(32)}`,
    })).toThrow(/secret-shaped/u)
  })

  it("requires candidate-complete status to reconcile exact dependencies, outcomes, kinds, and coverage", () => {
    const status = {
      schemaVersion: 1 as const, kind: "figma-to-boilerplate-mapping-status" as const,
      productId: ids[0], productRevision: 1, initiativeId: ids[1], initiativeRevision: 1,
      candidate: reference(2), designApplicability: reference(3), designSystemTokenContract: reference(4),
      responsiveMultiPlatformTargets: reference(5), finalizedFigmaSnapshotImport: reference(6),
      designToRequirementBinding: reference(7), designBaseline: reference(8),
      implementationUnitModel: reference(9), technologyProfile: reference(10),
      boilerplateRegistry: reference(11), boilerplateSelectionBinding: reference(12),
      boilerplateCompatibilityValidation: reference(13),
      designBindingCount: 1, subjectCount: 1, mappedCandidateCount: 1,
      conflictCandidateCount: 0, unmappedCandidateCount: 0, notAssessedCount: 0,
      componentMappingCount: 1, tokenMappingCount: 0, layoutMappingCount: 0,
      responsiveBehaviorMappingCount: 0, platformTargetMappingCount: 0,
      missingSubjectCount: 0, invalidSubjectCount: 0, targetGapCount: 0,
      traceGapCount: 0, evidenceGapCount: 0, staleBindingCount: 0, staleDependencyCount: 0,
      invalidCandidateCount: 0, unresolvedQuestionCount: 0,
      reviewState: "ready-for-human-review" as const, state: "candidate-complete" as const,
      reasons: [], assessedAt: "2026-07-30T00:00:00.000Z",
      authorityBoundary: "figma-to-boilerplate-mapping-status-is-observational-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-mapping-truth-or-completeness-selection-binding-effectiveness-compatibility-truth-retrieve-import-instantiate-generate-or-execute-assets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const,
    }
    expect(figmaToBoilerplateMappingStatusSchema.parse(status).state).toBe("candidate-complete")
    expect(() => figmaToBoilerplateMappingStatusSchema.parse({ ...status, subjectCount: 2 })).toThrow()
    expect(() => figmaToBoilerplateMappingStatusSchema.parse({ ...status, traceGapCount: 1 })).toThrow()
  })
})
