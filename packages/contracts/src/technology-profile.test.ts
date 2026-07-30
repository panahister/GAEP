import { describe, expect, it } from "vitest"

import {
  technologyProfileInputSchema,
  technologyProfileStatusSchema,
} from "./technology-profile.js"

const digest = (value: string) => `sha256:${value.repeat(64)}`
const ids = Array.from({ length: 16 }, (_, index) => `14000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`)

function evidence(kind: "architecture" | "manifest-observation" | "platform-policy" = "architecture") {
  return {
    kind,
    sourceId: `${kind}-source`,
    revision: 1,
    digest: digest(kind === "architecture" ? "a" : kind === "manifest-observation" ? "b" : "c"),
    observationState: "observed-not-validated" as const,
  }
}

function input() {
  return {
    initiativeId: ids[0],
    context: { productRevision: 1, productDigest: digest("1"), initiativeRevision: 1, initiativeDigest: digest("2") },
    informationClassification: "internal" as const,
    title: "Candidate implementation-unit technology profiles",
    implementationUnitModel: { recordId: ids[1], revision: 1, digest: digest("3") },
    dependencyMapping: { recordId: ids[2], revision: 1, digest: digest("4") },
    architectureEvidenceReferences: [evidence()],
    profiles: [{
      id: ids[3],
      ordinal: 1,
      implementationUnitId: ids[4],
      profileKind: "service" as const,
      choices: [{
        id: ids[5],
        ordinal: 1,
        category: "runtime" as const,
        canonicalName: "Node.js",
        versionConstraint: "24.4.1",
        versionState: "exact-candidate" as const,
        selectionState: "candidate-selected" as const,
        registryStatus: "candidate-supported" as const,
        supportState: "candidate-supported" as const,
        lifecycleState: "active" as const,
        compatibilityState: "candidate-compatible" as const,
        licenseState: "candidate-allowed" as const,
        securityPolicyState: "candidate-conformant" as const,
        rationale: "The repository toolchain observation identifies the candidate runtime version",
        evidenceReferences: [evidence("manifest-observation")],
        assessedBy: { kind: "human" as const, id: "technology-reviewer" },
        assessedAt: "2026-07-30T00:00:00.000Z",
      }],
      constraints: [{
        id: ids[6],
        ordinal: 1,
        kind: "platform" as const,
        requirement: "The candidate runtime must remain portable across supported host platforms",
        disposition: "mandatory" as const,
        assessmentState: "candidate-satisfied" as const,
        evidenceReferences: [evidence("platform-policy")],
        assessedBy: { kind: "human" as const, id: "technology-reviewer" },
        assessedAt: "2026-07-30T00:00:00.000Z",
      }],
      assuranceObligations: ["Verify the exact runtime candidate through governed package evidence"],
      observabilityObligations: ["Retain bounded runtime and package lifecycle evidence"],
    }],
    unresolvedQuestions: [],
    limitations: ["Observed facts and selected technologies remain candidates for accountable review"],
    reviewState: "ready-for-human-review" as const,
    technologyApprovalState: "not-established" as const,
    supportCommitmentState: "not-established" as const,
    compatibilityTruthState: "not-established" as const,
    compatibilityCompletenessState: "not-established" as const,
    licensingApprovalState: "not-established" as const,
    securityApprovalState: "not-established" as const,
    exceptionWaiverState: "not-established" as const,
    architectureBaselineDesignationState: "not-established" as const,
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

describe("Technology Profile contracts", () => {
  it("accepts exact per-unit candidate choices, constraints, and evidence without granting approval authority", () => {
    expect(technologyProfileInputSchema.parse(input())).toEqual(input())
  })

  it("rejects duplicate unit profiles, noncanonical ordering, and duplicate choice identities", () => {
    const duplicateUnit = input()
    duplicateUnit.profiles.push({ ...structuredClone(duplicateUnit.profiles[0]!), id: ids[7], ordinal: 2 })
    expect(() => technologyProfileInputSchema.parse(duplicateUnit)).toThrow(/only one Technology Profile/u)

    const badOrdinal = input()
    badOrdinal.profiles[0]!.choices[0]!.ordinal = 2
    expect(() => technologyProfileInputSchema.parse(badOrdinal)).toThrow(/contiguous canonical/u)

    const duplicateChoice = input()
    duplicateChoice.profiles[0]!.choices.push({ ...structuredClone(duplicateChoice.profiles[0]!.choices[0]!), ordinal: 2 })
    expect(() => technologyProfileInputSchema.parse(duplicateChoice)).toThrow(/choice identities must be unique/u)
  })

  it("rejects review-ready unassessed choices, missing evidence, unresolved questions, and secrets", () => {
    const unassessed = input()
    expect(() => technologyProfileInputSchema.parse({
      ...unassessed,
      profiles: unassessed.profiles.map((profile) => ({
        ...profile,
        choices: profile.choices.map((choice) => ({ ...choice, supportState: "unknown" as const })),
      })),
    })).toThrow(/assessed choices and constraints/u)

    const missingEvidence = input()
    missingEvidence.architectureEvidenceReferences = []
    expect(() => technologyProfileInputSchema.parse(missingEvidence)).toThrow(/architecture evidence/u)

    expect(() => technologyProfileInputSchema.parse({
      ...input(),
      unresolvedQuestions: ["Confirm the accountable platform support decision"],
    })).toThrow(/no unresolved questions/u)

    const secret = input()
    secret.profiles[0]!.choices[0]!.rationale = `api_key=${"x".repeat(24)}`
    expect(() => technologyProfileInputSchema.parse(secret)).toThrow(/secret-shaped/u)
  })

  it("rejects forged candidate-complete status without exact current dependencies", () => {
    expect(() => technologyProfileStatusSchema.parse({
      schemaVersion: 1,
      kind: "technology-profile-status",
      productId: ids[0], productRevision: 1, initiativeId: ids[0], initiativeRevision: 1,
      unitProfileCount: 1, technologyChoiceCount: 1, exactVersionCandidateCount: 1,
      rangeVersionCandidateCount: 0, unresolvedVersionCount: 0, constraintCount: 1,
      missingProfileCount: 0, invalidProfileCount: 0, missingEvidenceCount: 0,
      unsupportedChoiceCount: 0, lifecycleRiskCount: 0, compatibilityConflictCount: 0,
      licenseReviewRequiredCount: 0, licenseProhibitedCount: 0, securityReviewRequiredCount: 0,
      securityNonconformantCount: 0, exceptionCandidateCount: 0, constraintConflictCount: 0,
      staleBindingCount: 0, staleImplementationUnitModelCount: 0, staleDependencyMappingCount: 0,
      unresolvedQuestionCount: 0, reviewState: "ready-for-human-review", state: "candidate-complete",
      reasons: [], assessedAt: "2026-07-30T00:00:00.000Z",
      authorityBoundary: "technology-profile-status-is-observational-and-does-not-establish-technology-approval-support-commitment-compatibility-truth-or-completeness-licensing-or-security-approval-exception-waiver-authority-architecture-baseline-designation-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority",
    })).toThrow(/exact current dependencies/u)
  })

  it("rejects forged technology, compatibility, licensing, security, and action authority", () => {
    expect(() => technologyProfileInputSchema.parse({ ...input(), technologyApprovalState: "approved" })).toThrow()
    expect(() => technologyProfileInputSchema.parse({ ...input(), compatibilityTruthState: "established" })).toThrow()
    expect(() => technologyProfileInputSchema.parse({ ...input(), licensingApprovalState: "approved" })).toThrow()
    expect(() => technologyProfileInputSchema.parse({ ...input(), securityApprovalState: "approved" })).toThrow()
    expect(() => technologyProfileInputSchema.parse({ ...input(), actionAuthorityState: "granted" })).toThrow()
  })
})
