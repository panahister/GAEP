import { describe, expect, it } from "vitest"

import { implementationReadinessGateInputSchema } from "./implementation-readiness-gate.js"

const digest = `sha256:${"a".repeat(64)}`
const reference = { recordId: "11111111-1111-4111-8111-111111111111", revision: 1, digest }
const dimensions = ["acceptance", "backlog", "boilerplate", "dependencies", "design", "ownership", "risk", "security-privacy", "technology", "testing"] as const

function candidate() {
  return {
    initiativeId: "22222222-2222-4222-8222-222222222222",
    context: { productRevision: 1, productDigest: digest, initiativeRevision: 1, initiativeDigest: digest },
    informationClassification: "internal" as const,
    title: "Implementation readiness candidate",
    backlogHierarchy: reference, mvpSliceDefinition: reference, prioritizationModel: reference,
    acceptanceCriteria: reference, definitionOfReady: reference, definitionOfDone: reference,
    implementationUnitModel: reference, dependencyMapping: reference, technologyProfile: reference,
    boilerplateRegistry: reference, boilerplateSelectionBinding: reference,
    boilerplateCompatibilityValidation: reference,
    designBaseline: { ...reference, membershipDigest: digest, baselineLineageId: "55555555-5555-4555-8555-555555555555", semanticVersion: "1.0.0" },
    designToCodeBindingRegistry: reference, routeScreenComponentMapping: reference,
    testMethodology: reference, testInventory: reference, highLevelDesign: reference,
    riskRegister: reference, securityPrivacyAssessment: reference,
    subjects: [{
      id: "33333333-3333-4333-8333-333333333333", ordinal: 1,
      implementationUnitId: "44444444-4444-4444-8444-444444444444", lowLevelDesign: reference,
      assessments: dimensions.map((dimension) => ({ dimension, outcome: "not-assessed" as const,
        evidenceReferences: [], reviewCandidateIds: [], rationaleCandidate: "Awaiting governed evidence",
        conflictReferenceCandidates: [], waiverReferenceCandidates: [] })),
      outcome: "not-assessed" as const, ownerCandidateIds: [], evidenceReferences: [], reviewCandidateIds: [],
    }],
    unresolvedQuestions: ["Which human authority will decide readiness?"],
    limitations: ["Candidate assessment cannot grant readiness"], reviewState: "draft" as const,
    readinessDecisionState: "not-established" as const, waiverDecisionState: "not-established" as const,
    ownershipAppointmentState: "not-established" as const, acceptanceDecisionState: "not-established" as const,
    releaseReadinessState: "not-established" as const, deploymentReadinessState: "not-established" as const,
    actionAuthorityState: "not-granted" as const,
  }
}

describe("implementation readiness gate contracts", () => {
  it("accepts a fail-closed per-unit assessment candidate", () => {
    expect(implementationReadinessGateInputSchema.parse(candidate()).subjects[0]?.outcome).toBe("not-assessed")
  })

  it("rejects readiness dimensions that are incomplete or out of canonical order", () => {
    const value = candidate()
    value.subjects[0]!.assessments = value.subjects[0]!.assessments.slice(1)
    expect(implementationReadinessGateInputSchema.safeParse(value).success).toBe(false)
  })

  it("rejects authority-bearing and secret-shaped input", () => {
    expect(implementationReadinessGateInputSchema.safeParse({ ...candidate(), actionAuthorityState: "granted" }).success).toBe(false)
    expect(implementationReadinessGateInputSchema.safeParse({ ...candidate(), title: "password=super-secret-value-that-must-not-leak" }).success).toBe(false)
  })
})
