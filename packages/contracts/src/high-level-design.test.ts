import { describe, expect, it } from "vitest"

import { highLevelDesignInputSchema, highLevelDesignStatusSchema } from "./high-level-design.js"

const digest = (value: string) => `sha256:${value.repeat(64)}`
const ids = Array.from({ length: 48 }, (_, index) =>
  `4a000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`)
const reference = (index: number) => ({ recordId: ids[index]!, revision: 1, digest: digest((index % 10).toString(16)) })
const evidence = (kind: "architecture" | "bounded-context" | "dependency" | "implementation-unit" | "risk" | "security-privacy" | "technology" | "test-inventory") => ({
  kind, sourceId: `checkout-${kind}`, revision: 1, digest: digest("a"), evidenceState: "source-recorded" as const,
})

function input() {
  const left = ids[20]!
  const right = ids[21]!
  return {
    initiativeId: ids[0],
    context: { productRevision: 1, productDigest: digest("a"), initiativeRevision: 1, initiativeDigest: digest("b") },
    informationClassification: "internal" as const, title: "Candidate High-Level Design",
    systemSolutionArchitecture: reference(1), boundedContextModel: reference(2), technologyProfile: reference(3),
    dependencyMapping: reference(4), implementationUnitModel: reference(5), boilerplateRegistry: reference(6),
    boilerplateSelectionBinding: reference(7), boilerplateCompatibilityValidation: reference(8),
    designBaseline: { ...reference(9), membershipDigest: digest("c"), baselineLineageId: ids[10]!, semanticVersion: "1.0.0" },
    designToCodeBindingRegistry: reference(11), routeScreenComponentMapping: reference(12),
    testMethodology: reference(13), testInventory: reference(14), riskRegister: reference(15),
    securityPrivacyAssessment: reference(16),
    elements: [
      { id: left, ordinal: 1, key: "checkout.api", kind: "container" as const, title: "Checkout API",
        responsibility: "Coordinates checkout candidate interactions", boundedContextKeys: ["checkout"],
        implementationUnitIds: [ids[22]!], technologySelectionKeys: ["typescript"], boilerplateEntryIds: [ids[23]!],
        routeScreenComponentSubjectIds: [ids[24]!], testInventoryAssetIds: [ids[25]!], riskKeys: ["callback-spoofing"],
        ownerCandidateIds: ["architecture-lead"], disposition: "candidate-defined" as const,
        evidenceReferences: [evidence("architecture"), evidence("bounded-context"), evidence("implementation-unit")],
        conflictReferenceCandidates: [], designedBy: { kind: "human" as const, id: "design-reviewer" },
        designedAt: "2026-07-31T00:00:00.000Z" },
      { id: right, ordinal: 2, key: "payment.gateway", kind: "external-system" as const, title: "Payment Gateway",
        responsibility: "Represents an external payment boundary candidate", boundedContextKeys: ["checkout"],
        implementationUnitIds: [ids[22]!], technologySelectionKeys: [], boilerplateEntryIds: [],
        routeScreenComponentSubjectIds: [], testInventoryAssetIds: [ids[25]!], riskKeys: ["callback-spoofing"],
        ownerCandidateIds: ["architecture-lead"], disposition: "candidate-defined" as const,
        evidenceReferences: [evidence("architecture"), evidence("risk"), evidence("security-privacy")],
        conflictReferenceCandidates: [], designedBy: { kind: "human" as const, id: "design-reviewer" },
        designedAt: "2026-07-31T00:00:00.000Z" },
    ],
    relations: [{ id: ids[26]!, ordinal: 1, key: "checkout.gateway", kind: "calls" as const,
      fromElementId: left, toElementId: right, interfaceContractCandidate: "Versioned checkout request and response candidate",
      dataFlowCandidate: "Tokenized payment request candidate", trustBoundaryCandidate: "crosses-boundary" as const,
      failureBehaviorCandidate: "Returns a bounded unavailable result candidate", disposition: "candidate-defined" as const,
      evidenceReferences: [evidence("dependency"), evidence("security-privacy")] }],
    decisions: [{ id: ids[27]!, key: "gateway.integration", title: "Gateway integration candidate", elementIds: [left, right],
      optionCandidates: ["asynchronous adapter", "synchronous adapter"], candidateOption: "synchronous adapter",
      rationaleCandidate: "Preserves the current bounded request workflow candidate", qualityAttributeKeys: ["recoverability", "security"],
      riskKeys: ["callback-spoofing"], disposition: "candidate-selected" as const,
      evidenceReferences: [evidence("architecture"), evidence("risk"), evidence("test-inventory")] }],
    qualityAttributeKeys: ["recoverability", "security"], deploymentViewKeys: ["primary.deployment"],
    alternativesConsidered: ["asynchronous adapter"], unresolvedQuestions: [],
    limitations: ["Candidate design does not establish architecture, runtime, deployment, or implementation truth"],
    reviewState: "ready-for-human-review" as const, architectureTruthState: "not-established" as const,
    architectureCompletenessState: "not-established" as const, repositoryTruthState: "not-established" as const,
    runtimeTruthState: "not-established" as const, deploymentTruthState: "not-established" as const,
    privacyApprovalState: "not-established" as const, securityApprovalState: "not-established" as const,
    ownershipAppointmentState: "not-established" as const, implementationReadinessState: "not-established" as const,
    acceptanceDecisionState: "not-established" as const, releaseReadinessState: "not-established" as const,
    deploymentReadinessState: "not-established" as const, actionAuthorityState: "not-granted" as const,
  }
}

describe("High-Level Design contracts", () => {
  it("accepts an exact attributed candidate and reconciled status", () => {
    const candidate = highLevelDesignInputSchema.parse(input())
    expect(candidate.elements).toHaveLength(2)
    expect(highLevelDesignStatusSchema.parse({
      schemaVersion: 1, kind: "high-level-design-status", productId: ids[28], productRevision: 1,
      initiativeId: ids[0], initiativeRevision: 1, candidate: reference(29), dependencyCount: 15,
      presentDependencyCount: 15, elementCount: 2, definedElementCount: 2, relationCount: 1,
      definedRelationCount: 1, decisionCount: 1, selectedDecisionCount: 1, qualityAttributeCount: 2,
      deploymentViewCount: 1, conflictCount: 0, missingCount: 0, orphanRelationCount: 0,
      traceGapCount: 0, evidenceGapCount: 0, ownershipGapCount: 0, uncoveredUnitCount: 0,
      staleBindingCount: 0, staleDependencyCount: 0, invalidCandidateCount: 0, unresolvedQuestionCount: 0,
      reviewState: "ready-for-human-review", state: "candidate-complete", reasons: [],
      assessedAt: "2026-07-31T00:00:00.000Z",
      authorityBoundary: "high-level-design-status-is-observational-and-does-not-establish-architecture-repository-runtime-or-deployment-truth-or-completeness-architecture-baseline-or-approval-privacy-or-security-approval-owner-appointment-implementation-readiness-acceptance-release-deployment-or-action-authority",
    }).state).toBe("candidate-complete")
  })

  it("rejects duplicate elements, orphan relations, missing attribution, and secrets", () => {
    const value = input()
    expect(highLevelDesignInputSchema.safeParse({ ...value, elements: [value.elements[0]!, value.elements[0]!] }).success).toBe(false)
    expect(highLevelDesignInputSchema.safeParse({ ...value, relations: [{ ...value.relations[0]!, toElementId: ids[40]! }] }).success).toBe(false)
    expect(highLevelDesignInputSchema.safeParse({ ...value, elements: [{ ...value.elements[0]!, designedBy: undefined }, value.elements[1]!] }).success).toBe(false)
    expect(highLevelDesignInputSchema.safeParse({ ...value, limitations: ["apiKey=high-level-design-secret-value"] }).success).toBe(false)
  })
})
