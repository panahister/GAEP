import { describe, expect, it } from "vitest"

import {
  routeScreenComponentMappingInputSchema,
  routeScreenComponentMappingStatusSchema,
} from "./route-screen-component-mapping.js"

const digest = (value: string) => `sha256:${value.repeat(64)}`
const ids = Array.from({ length: 40 }, (_, index) =>
  `1a000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`)
const reference = (index: number) => ({ recordId: ids[index]!, revision: 1, digest: digest((index % 10).toString(16)) })
const evidence = (kind: "information-architecture" | "screen-state-inventory" | "design-to-code-binding") => ({
  kind, sourceId: `checkout-${kind}`, revision: 1, digest: digest("a"), evidenceState: "human-reviewed" as const,
})

function input() {
  const common = {
    platformKeys: ["web"], responsiveTargetKeys: ["desktop"],
    designBindingKeys: ["checkout.primary-action"], requirementKeys: ["GAEP-REQ-001"],
    acceptanceCriterionIds: [ids[14]!], implementationUnitIds: [ids[15]!],
    testHookCandidates: ["checkout.primary-action"], disposition: "candidate-mapped" as const,
    conflictReferenceCandidates: [], mappedBy: { kind: "human" as const, id: "mapping-reviewer" },
    mappedAt: "2026-07-31T00:00:00.000Z", navigationTruthState: "not-established" as const,
    uiValidityState: "not-established" as const, repositoryTruthState: "not-established" as const,
    mappingTruthState: "not-established" as const, mappingCompletenessState: "not-established" as const,
    testCoverageState: "not-established" as const, codeMutationState: "not-performed" as const,
    implementationAuthorityState: "not-granted" as const,
  }
  const subjects = [
    { ...common, id: ids[20]!, ordinal: 1, subjectKind: "route" as const, sourceKey: "checkout.route",
      routeKeys: ["checkout.route"], screenKeys: ["checkout.screen"], stateKeys: ["checkout.default"],
      codeBindingSubjectIds: [], evidenceReferences: [evidence("information-architecture")] },
    { ...common, id: ids[21]!, ordinal: 2, subjectKind: "screen" as const, sourceKey: "checkout.screen",
      routeKeys: ["checkout.route"], screenKeys: ["checkout.screen"], stateKeys: ["checkout.default"],
      codeBindingSubjectIds: [], evidenceReferences: [evidence("screen-state-inventory")] },
    { ...common, id: ids[22]!, ordinal: 3, subjectKind: "state" as const, sourceKey: "checkout.default",
      routeKeys: ["checkout.route"], screenKeys: ["checkout.screen"], stateKeys: ["checkout.default"],
      codeBindingSubjectIds: [], evidenceReferences: [evidence("screen-state-inventory")] },
    { ...common, id: ids[23]!, ordinal: 4, subjectKind: "component" as const, sourceKey: "checkout.primary-action",
      designToCodeBindingSubjectId: ids[24]!, routeKeys: ["checkout.route"], screenKeys: ["checkout.screen"], stateKeys: ["checkout.default"],
      codeBindingSubjectIds: [ids[24]!], evidenceReferences: [evidence("design-to-code-binding")] },
  ]
  const relationshipEvidence = [evidence("screen-state-inventory")]
  return {
    initiativeId: ids[0],
    context: { productRevision: 1, productDigest: digest("a"), initiativeRevision: 1, initiativeDigest: digest("b") },
    informationClassification: "internal" as const,
    title: "Candidate Route, Screen, and Component Mapping",
    informationArchitecture: reference(1), screenStateInventory: reference(2), designRequirements: reference(3),
    designBaseline: reference(4), designToRequirementBinding: reference(5), figmaToBoilerplateMapping: reference(6),
    designToCodeBindingRegistry: reference(7), implementationUnitModel: reference(8), acceptanceCriteria: reference(9),
    subjects,
    relationships: [
      { id: ids[25]!, ordinal: 1, relationshipKind: "route-to-screen" as const,
        fromSubjectId: ids[20]!, toSubjectId: ids[21]!, state: "candidate-defined" as const, evidenceReferences: relationshipEvidence },
      { id: ids[26]!, ordinal: 2, relationshipKind: "screen-to-state" as const,
        fromSubjectId: ids[21]!, toSubjectId: ids[22]!, state: "candidate-defined" as const, evidenceReferences: relationshipEvidence },
      { id: ids[27]!, ordinal: 3, relationshipKind: "screen-to-component" as const,
        fromSubjectId: ids[21]!, toSubjectId: ids[23]!, state: "candidate-defined" as const,
        evidenceReferences: [evidence("design-to-code-binding")] },
    ],
    unresolvedQuestions: [], limitations: ["Candidate mapping does not establish navigation or UI truth"],
    reviewState: "ready-for-human-review" as const, figmaConnectionState: "not-connected" as const,
    returnedFigmaContentState: "not-established" as const, designValidityState: "not-established" as const,
    designApprovalState: "not-established" as const, designBaselineDesignationState: "not-established" as const,
    navigationTruthState: "not-established" as const,
    routeScreenComponentMappingTruthState: "not-established" as const,
    routeScreenComponentMappingCompletenessState: "not-established" as const,
    uiValidityState: "not-established" as const, responsiveBehaviorTruthState: "not-established" as const,
    platformParityState: "not-established" as const, requirementSatisfactionState: "not-established" as const,
    acceptanceCriteriaValidityState: "not-established" as const, repositoryTruthState: "not-established" as const,
    pathSymbolTruthState: "not-established" as const, testCoverageState: "not-established" as const,
    codeTargetMutationState: "not-performed" as const, codeGenerationState: "not-performed" as const,
    implementationReadinessState: "not-established" as const, implementationCompletenessState: "not-established" as const,
    assignmentExecutionState: "not-established" as const, acceptanceDecisionState: "not-established" as const,
    mergeReadinessState: "not-established" as const, releaseReadinessState: "not-established" as const,
    deploymentReadinessState: "not-established" as const, actionAuthorityState: "not-granted" as const,
  }
}

describe("Route, Screen, and Component Mapping contracts", () => {
  it("accepts a complete attributed candidate and reconciled status", () => {
    const candidate = routeScreenComponentMappingInputSchema.parse(input())
    expect(candidate.subjects).toHaveLength(4)
    expect(routeScreenComponentMappingStatusSchema.parse({
      schemaVersion: 1, kind: "route-screen-component-mapping-status",
      productId: ids[10], productRevision: 1, initiativeId: ids[0], initiativeRevision: 1,
      candidate: reference(11), informationArchitecture: candidate.informationArchitecture,
      screenStateInventory: candidate.screenStateInventory, designRequirements: candidate.designRequirements,
      designBaseline: candidate.designBaseline, designToRequirementBinding: candidate.designToRequirementBinding,
      figmaToBoilerplateMapping: candidate.figmaToBoilerplateMapping,
      designToCodeBindingRegistry: candidate.designToCodeBindingRegistry,
      implementationUnitModel: candidate.implementationUnitModel, acceptanceCriteria: candidate.acceptanceCriteria,
      sourceRouteCount: 1, sourceScreenCount: 1, sourceStateCount: 1, sourceComponentCount: 1,
      subjectCount: 4, routeSubjectCount: 1, screenSubjectCount: 1, stateSubjectCount: 1, componentSubjectCount: 1,
      mappedCandidateCount: 4, conflictCandidateCount: 0, unmappedCandidateCount: 0, notAssessedCount: 0,
      relationshipCount: 3, definedRelationshipCount: 3, conflictRelationshipCount: 0, notAssessedRelationshipCount: 0,
      missingSubjectCount: 0, extraSubjectCount: 0, invalidSubjectCount: 0, missingRelationshipCount: 0,
      invalidRelationshipCount: 0, traceGapCount: 0, evidenceGapCount: 0, componentPlacementGapCount: 0,
      testHookGapCount: 0, staleBindingCount: 0, staleDependencyCount: 0, invalidCandidateCount: 0,
      unresolvedQuestionCount: 0, reviewState: "ready-for-human-review", state: "candidate-complete",
      reasons: [], assessedAt: "2026-07-31T00:00:00.000Z",
      authorityBoundary: "route-screen-component-mapping-status-is-observational-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-navigation-route-screen-state-component-responsive-platform-requirement-acceptance-criteria-test-coverage-repository-path-symbol-or-mapping-truth-or-completeness-create-or-change-code-or-design-targets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority",
    }).state).toBe("candidate-complete")
  })

  it("rejects unattributed review-ready mappings, dangling relationships, and secret-shaped values", () => {
    const value = input()
    expect(routeScreenComponentMappingInputSchema.safeParse({
      ...value, subjects: value.subjects.map((subject, index) => index === 0 ? { ...subject, mappedBy: undefined } : subject),
    }).success).toBe(false)
    expect(routeScreenComponentMappingInputSchema.safeParse({
      ...value, relationships: [{ ...value.relationships[0]!, toSubjectId: ids[39] }],
    }).success).toBe(false)
    expect(routeScreenComponentMappingInputSchema.safeParse({
      ...value, limitations: ["apiKey=route-screen-secret-value"],
    }).success).toBe(false)
  })
})
