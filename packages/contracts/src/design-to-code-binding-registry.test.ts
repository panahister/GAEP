import { describe, expect, it } from "vitest"

import {
  designToCodeBindingRegistryInputSchema,
  designToCodeBindingRegistryStatusSchema,
} from "./design-to-code-binding-registry.js"

const digest = (value: string) => `sha256:${value.repeat(64)}`
const ids = Array.from({ length: 32 }, (_, index) =>
  `19000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`)
const reference = (index: number) => ({ recordId: ids[index]!, revision: 1, digest: digest((index % 10).toString(16)) })

function input() {
  return {
    initiativeId: ids[0],
    context: { productRevision: 1, productDigest: digest("a"), initiativeRevision: 1, initiativeDigest: digest("b") },
    informationClassification: "internal" as const,
    title: "Candidate Design-to-Code Binding Registry",
    designBaseline: reference(1), finalizedFigmaSnapshotImport: reference(2),
    designToRequirementBinding: reference(3), figmaToBoilerplateMapping: reference(4),
    implementationUnitModel: reference(5), technologyProfile: reference(6),
    boilerplateSelectionBinding: reference(7), boilerplateCompatibilityValidation: reference(8),
    subjects: [{
      id: ids[9], ordinal: 1, mappingSubjectId: ids[10],
      designBindingKey: "checkout.primary-action", designItemKey: "checkout.primary-action",
      designItemKind: "component" as const, mappingKind: "component" as const,
      bindingKind: "component" as const, implementationUnitId: ids[11],
      requirementKeys: ["GAEP-REQ-001"], repositoryCandidate: "frontend.web",
      moduleCandidate: "checkout.ui", pathCandidate: "src/components/checkout/PrimaryAction.tsx",
      symbolCandidate: "PrimaryAction", disposition: "candidate-bound" as const,
      evidenceReferences: [{
        kind: "figma-to-boilerplate-mapping" as const, sourceId: "checkout-primary-action-mapping",
        revision: 1, digest: digest("c"), evidenceState: "human-reviewed" as const,
      }],
      conflictReferenceCandidates: [], boundBy: { kind: "human" as const, id: "binding-reviewer" },
      boundAt: "2026-07-30T00:00:00.000Z", repositoryTruthState: "not-established" as const,
      pathSymbolTruthState: "not-established" as const, bindingTruthState: "not-established" as const,
      bindingCompletenessState: "not-established" as const, codeMutationState: "not-performed" as const,
      implementationAuthorityState: "not-granted" as const,
    }],
    unresolvedQuestions: [], limitations: ["Candidate bindings do not establish repository truth or change code"],
    reviewState: "ready-for-human-review" as const, figmaConnectionState: "not-connected" as const,
    returnedFigmaContentState: "not-established" as const, designValidityState: "not-established" as const,
    designApprovalState: "not-established" as const, designBaselineDesignationState: "not-established" as const,
    mappingTruthState: "not-established" as const, mappingCompletenessState: "not-established" as const,
    bindingTruthState: "not-established" as const, bindingCompletenessState: "not-established" as const,
    repositoryTruthState: "not-established" as const, pathSymbolTruthState: "not-established" as const,
    codeTargetMutationState: "not-performed" as const, codeGenerationState: "not-performed" as const,
    implementationReadinessState: "not-established" as const,
    implementationCompletenessState: "not-established" as const,
    assignmentExecutionState: "not-established" as const, acceptanceDecisionState: "not-established" as const,
    mergeReadinessState: "not-established" as const, releaseReadinessState: "not-established" as const,
    deploymentReadinessState: "not-established" as const, actionAuthorityState: "not-granted" as const,
  }
}

describe("Design-to-Code Binding Registry contracts", () => {
  it("accepts exact evidence-backed attributable relative code-target candidates", () => {
    const parsed = designToCodeBindingRegistryInputSchema.parse(input())
    expect(parsed.subjects[0]?.disposition).toBe("candidate-bound")
    expect(parsed.subjects[0]?.pathCandidate).toBe("src/components/checkout/PrimaryAction.tsx")
  })

  it("rejects duplicate mapping subjects, invalid ordering, and unsafe paths", () => {
    const duplicateBase = input()
    expect(() => designToCodeBindingRegistryInputSchema.parse({
      ...duplicateBase,
      subjects: [duplicateBase.subjects[0], { ...duplicateBase.subjects[0], id: ids[12], ordinal: 2 }],
    })).toThrow(/one design-to-code binding subject/u)
    expect(() => designToCodeBindingRegistryInputSchema.parse({
      ...input(), subjects: [{ ...input().subjects[0], ordinal: 2 }],
    })).toThrow(/contiguous/u)
    expect(() => designToCodeBindingRegistryInputSchema.parse({
      ...input(), subjects: [{ ...input().subjects[0], pathCandidate: "../secrets.ts" }],
    })).toThrow(/repository-relative/u)
  })

  it("rejects unreviewed review-ready, authority-forged, and secret-shaped candidates", () => {
    const unreviewedBase = input()
    expect(() => designToCodeBindingRegistryInputSchema.parse({
      ...unreviewedBase,
      subjects: [{ ...unreviewedBase.subjects[0], disposition: "not-assessed", boundBy: undefined, boundAt: undefined }],
    })).toThrow(/every mapping subject/u)
    expect(() => designToCodeBindingRegistryInputSchema.parse({ ...input(), codeTargetMutationState: "performed" })).toThrow()
    expect(() => designToCodeBindingRegistryInputSchema.parse({
      ...input(), title: `api_key=sk-${"x".repeat(32)}`,
    })).toThrow(/secret-shaped/u)
  })

  it("requires candidate-complete status to reconcile exact dependencies and coverage", () => {
    const status = {
      schemaVersion: 1 as const, kind: "design-to-code-binding-registry-status" as const,
      productId: ids[0], productRevision: 1, initiativeId: ids[1], initiativeRevision: 1,
      candidate: reference(2), designBaseline: reference(3), finalizedFigmaSnapshotImport: reference(4),
      designToRequirementBinding: reference(5), figmaToBoilerplateMapping: reference(6),
      implementationUnitModel: reference(7), technologyProfile: reference(8),
      boilerplateSelectionBinding: reference(9), boilerplateCompatibilityValidation: reference(10),
      mappingSubjectCount: 1, subjectCount: 1, boundCandidateCount: 1,
      conflictCandidateCount: 0, unboundCandidateCount: 0, notAssessedCount: 0,
      missingSubjectCount: 0, invalidSubjectCount: 0, targetGapCount: 0, traceGapCount: 0,
      evidenceGapCount: 0, duplicateTargetCount: 0, staleBindingCount: 0, staleDependencyCount: 0,
      invalidCandidateCount: 0, unresolvedQuestionCount: 0, reviewState: "ready-for-human-review" as const,
      state: "candidate-complete" as const, reasons: [], assessedAt: "2026-07-30T00:00:00.000Z",
      authorityBoundary: "design-to-code-binding-registry-status-is-observational-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-mapping-or-binding-truth-or-completeness-repository-path-or-symbol-truth-create-or-change-code-targets-retrieve-import-instantiate-generate-or-execute-assets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const,
    }
    expect(designToCodeBindingRegistryStatusSchema.parse(status).state).toBe("candidate-complete")
    expect(() => designToCodeBindingRegistryStatusSchema.parse({ ...status, subjectCount: 2 })).toThrow()
    expect(() => designToCodeBindingRegistryStatusSchema.parse({ ...status, targetGapCount: 1 })).toThrow()
  })
})
