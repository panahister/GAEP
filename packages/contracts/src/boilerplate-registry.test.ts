import { describe, expect, it } from "vitest"

import { boilerplateRegistryInputSchema, boilerplateRegistryStatusSchema } from "./boilerplate-registry.js"

const digest = (value: string) => `sha256:${value.repeat(64)}`
const ids = Array.from({ length: 12 }, (_, index) => `15000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`)

function evidence(kind: "architecture" | "repository-observation" = "architecture") {
  return { kind, sourceId: `${kind}-source`, revision: 1, digest: digest(kind === "architecture" ? "a" : "b"), observationState: "observed-not-validated" as const }
}

function input() {
  return {
    initiativeId: ids[0], context: { productRevision: 1, productDigest: digest("1"), initiativeRevision: 1, initiativeDigest: digest("2") },
    informationClassification: "internal" as const, title: "Candidate organizational boilerplate registry",
    implementationUnitModel: { recordId: ids[1], revision: 1, digest: digest("3") },
    technologyProfile: { recordId: ids[2], revision: 1, digest: digest("4") },
    architectureEvidenceReferences: [evidence()],
    entries: [{
      id: ids[3], ordinal: 1, canonicalName: "Candidate service foundation", kind: "service-template" as const,
      sourceKind: "local-repository" as const, sourceReference: "templates/service-foundation", versionCandidate: "commit-candidate-1",
      versionState: "exact-candidate" as const, applicabilityState: "candidate-preferred" as const,
      availabilityState: "candidate-available" as const, integrityState: "candidate-verified" as const,
      provenanceState: "candidate-traceable" as const, supportState: "candidate-supported" as const,
      lifecycleState: "active" as const, technologyCompatibilityState: "candidate-compatible" as const,
      architectureCompatibilityState: "candidate-compatible" as const, licenseState: "candidate-allowed" as const,
      securityPolicyState: "candidate-conformant" as const, exceptionState: "not-required-candidate" as const,
      applicableTechnologyProfileIds: [ids[4]], applicableImplementationUnitIds: [ids[5]],
      capabilities: ["Provides a bounded candidate service foundation"],
      knownLimitations: ["Registry evidence does not designate or approve the asset"],
      rationale: "The local repository observation provides an inspectable candidate asset without asserting organizational approval",
      evidenceReferences: [evidence("repository-observation")], assessedBy: { kind: "human" as const, id: "boilerplate-reviewer" },
      assessedAt: "2026-07-30T00:00:00.000Z",
    }],
    unresolvedQuestions: [], limitations: ["Candidate entries require accountable organizational review"],
    reviewState: "ready-for-human-review" as const, organizationalDesignationState: "not-established" as const,
    endorsementApprovalState: "not-established" as const, supportCommitmentState: "not-established" as const,
    compatibilityTruthState: "not-established" as const, compatibilityCompletenessState: "not-established" as const,
    licensingApprovalState: "not-established" as const, securityApprovalState: "not-established" as const,
    exceptionWaiverState: "not-established" as const, selectionBindingState: "not-established" as const,
    architectureBaselineDesignationState: "not-established" as const, implementationReadinessState: "not-established" as const,
    implementationCompletenessState: "not-established" as const, assignmentExecutionState: "not-established" as const,
    acceptanceDecisionState: "not-established" as const, mergeReadinessState: "not-established" as const,
    releaseReadinessState: "not-established" as const, deploymentReadinessState: "not-established" as const,
    actionAuthorityState: "not-granted" as const,
  }
}

describe("Boilerplate Registry contracts", () => {
  it("accepts exact candidate asset evidence without designating, approving, selecting, or binding it", () => {
    expect(boilerplateRegistryInputSchema.parse(input())).toEqual(input())
  })

  it("rejects duplicate identities, noncanonical order, and review-ready evidence gaps", () => {
    const duplicate = input()
    duplicate.entries.push({ ...structuredClone(duplicate.entries[0]!), ordinal: 2 })
    expect(() => boilerplateRegistryInputSchema.parse(duplicate)).toThrow(/identities must be unique/u)

    const ordinal = input()
    ordinal.entries[0]!.ordinal = 2
    expect(() => boilerplateRegistryInputSchema.parse(ordinal)).toThrow(/contiguous canonical/u)

    const incomplete = input()
    expect(() => boilerplateRegistryInputSchema.parse({
      ...incomplete,
      entries: incomplete.entries.map((entry) => ({ ...entry, integrityState: "not-assessed" as const })),
    })).toThrow(/integrity-verified/u)
  })

  it("rejects unresolved review-ready candidates, secret-shaped values, and forged authority", () => {
    expect(() => boilerplateRegistryInputSchema.parse({ ...input(), unresolvedQuestions: ["Confirm accountable ownership"] })).toThrow(/no unresolved questions/u)
    const secret = input()
    secret.entries[0]!.sourceReference = `api_key=${"x".repeat(24)}`
    expect(() => boilerplateRegistryInputSchema.parse(secret)).toThrow(/secret-shaped/u)
    expect(() => boilerplateRegistryInputSchema.parse({ ...input(), organizationalDesignationState: "approved" })).toThrow()
    expect(() => boilerplateRegistryInputSchema.parse({ ...input(), selectionBindingState: "bound" })).toThrow()
    expect(() => boilerplateRegistryInputSchema.parse({ ...input(), actionAuthorityState: "granted" })).toThrow()
  })

  it("rejects forged candidate-complete status without exact dependencies", () => {
    expect(() => boilerplateRegistryStatusSchema.parse({
      schemaVersion: 1, kind: "boilerplate-registry-status", productId: ids[0], productRevision: 1,
      initiativeId: ids[0], initiativeRevision: 1, entryCount: 1, exactVersionCandidateCount: 1,
      rangeVersionCandidateCount: 0, unresolvedVersionCount: 0, mandatoryCandidateCount: 0,
      missingEvidenceCount: 0, unavailableEntryCount: 0, integrityMismatchCount: 0, provenanceGapCount: 0,
      unsupportedEntryCount: 0, lifecycleRiskCount: 0, technologyConflictCount: 0, architectureConflictCount: 0,
      licenseReviewRequiredCount: 0, licenseProhibitedCount: 0, securityReviewRequiredCount: 0,
      securityNonconformantCount: 0, exceptionCandidateCount: 0, staleBindingCount: 0,
      staleImplementationUnitModelCount: 0, staleTechnologyProfileCount: 0, invalidRegistryCount: 0,
      unresolvedQuestionCount: 0, reviewState: "ready-for-human-review", state: "candidate-complete", reasons: [],
      assessedAt: "2026-07-30T00:00:00.000Z",
      authorityBoundary: "boilerplate-registry-status-is-observational-and-does-not-establish-organizational-designation-endorsement-approval-support-commitment-compatibility-truth-or-completeness-licensing-or-security-approval-exception-waiver-selection-binding-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority",
    })).toThrow(/exact current dependencies/u)
  })
})
