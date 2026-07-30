import { describe, expect, it } from "vitest"

import { designDriftDetectionInputSchema, designDriftDetectionProjectionSchema } from "./design-drift-detection.js"

const digest = (character: string) => `sha256:${character.repeat(64)}`
const source = {
  sourceId: "11111111-1111-4111-8111-111111111111", sourceRevision: 1,
  recordDigest: digest("1"), contentDigest: digest("2"),
}

function input() {
  return {
    initiativeId: "22222222-2222-4222-8222-222222222222",
    context: { productRevision: 2, productDigest: digest("3"), initiativeRevision: 3, initiativeDigest: digest("4") },
    informationClassification: "internal" as const,
    title: "Customer portal design drift candidate",
    objectiveDigest: digest("5"),
    designBaseline: {
      recordId: "33333333-3333-4333-8333-333333333333", revision: 1, digest: digest("6"),
      membershipDigest: digest("7"), baselineLineageId: "44444444-4444-4444-8444-444444444444",
      candidateSetId: "55555555-5555-4555-8555-555555555555", candidateSetRevision: 1,
      semanticVersion: "1.0.0", designationReceiptDigest: digest("8"), baselineDesignationState: "not-established" as const,
    },
    returnedFigmaSnapshot: {
      recordId: "66666666-6666-4666-8666-666666666666", revision: 1, digest: digest("9"),
      membershipDigest: digest("a"), externalFileIdentityDigest: digest("b"),
      returnedExternalVersionDigest: digest("c"), itemCatalogDigest: digest("d"),
    },
    designRequirements: {
      recordId: "77777777-7777-4777-8777-777777777777", revision: 1, digest: digest("e"),
      membershipDigest: digest("f"), requirementCatalogDigest: digest("0"),
    },
    designTrace: {
      recordId: "88888888-8888-4888-8888-888888888888", revision: 1, digest: digest("1"),
      membershipDigest: digest("2"), reconciliationDigest: digest("3"),
    },
    implementationTargetCatalogRevision: 1,
    implementationTargets: [{
      key: "portal-component", kind: "component" as const,
      resourceLineageId: "99999999-9999-4999-8999-999999999999", resourceRevision: 2,
      contentDigest: digest("4"), representationDigest: digest("5"),
      requirementKeys: ["GAEP-REQ-001"], designItemKeys: ["portal-frame"],
      evidenceState: "human-reviewed" as const, evidenceDigests: [digest("6")], sources: [source],
      reviewedBy: { kind: "human" as const, id: "implementation-reviewer" }, reviewedAt: "2026-07-30T03:00:00Z",
    }],
    implementationTargetCatalogDigest: digest("7"), comparisonPolicyDigest: digest("8"),
    observations: [
      {
        key: "design-implementation-portal", path: "design-to-implementation" as const,
        requirementKeys: ["GAEP-REQ-001"], designItemKey: "portal-frame", implementationTargetKey: "portal-component",
        baselineEvidenceDigest: digest("9"), currentEvidenceDigest: digest("a"), targetEvidenceDigest: digest("b"),
        classification: "changed" as const, severity: "medium" as const, evidenceState: "human-reviewed" as const,
        evidenceDigests: [digest("c")], sources: [source],
        reviewedBy: { kind: "human" as const, id: "drift-reviewer" }, reviewedAt: "2026-07-30T03:05:00Z",
      },
      {
        key: "requirement-design-portal", path: "requirement-to-design" as const,
        requirementKeys: ["GAEP-REQ-001"], designItemKey: "portal-frame",
        baselineEvidenceDigest: digest("d"), currentEvidenceDigest: digest("e"), targetEvidenceDigest: digest("f"),
        classification: "conformant" as const, severity: "none" as const, evidenceState: "human-reviewed" as const,
        evidenceDigests: [digest("0")], sources: [source],
        reviewedBy: { kind: "human" as const, id: "drift-reviewer" }, reviewedAt: "2026-07-30T03:05:00Z",
      },
    ],
    comparisonDigest: digest("1"),
    remediationCandidates: [{
      key: "amend-portal-component", driftKeys: ["design-implementation-portal"],
      kind: "amend-implementation-candidate" as const, rationaleDigest: digest("2"),
      evidenceDigests: [digest("3")], sources: [source], proposedBy: { kind: "human" as const, id: "drift-reviewer" },
      proposedAt: "2026-07-30T03:10:00Z", validUntil: "2030-07-30T03:10:00Z",
      reviewState: "ready-for-human-review" as const, effectState: "not-applied" as const,
    }],
    candidateResult: "drift-detected-candidate" as const,
    unresolvedQuestions: [], limitations: ["The baseline is a candidate and no drift-completeness claim is established."],
    reviewState: "ready-for-human-review" as const,
    comparisonCompletenessState: "not-established" as const, externalCompletenessState: "not-established" as const,
    designValidityState: "not-established" as const, implementationValidityState: "not-established" as const,
    approvalState: "not-established" as const, baselineDesignationState: "not-established" as const,
    readinessState: "not-established" as const, remediationAuthorityState: "not-granted" as const,
    figmaConnectionAuthorityState: "not-granted" as const, credentialAuthorityState: "not-granted" as const,
    permissionGrantState: "not-granted" as const, importExecutionState: "not-performed" as const,
    writeExecutionState: "not-performed" as const, implementationAuthorityState: "not-granted" as const,
  }
}

describe("Design Drift Detection contract", () => {
  it("accepts exact version-bound observations without granting baseline or remediation authority", () => {
    const parsed = designDriftDetectionInputSchema.parse(input())
    expect(parsed.candidateResult).toBe("drift-detected-candidate")
    expect(parsed.designBaseline.baselineDesignationState).toBe("not-established")
    expect(parsed.remediationCandidates[0]?.effectState).toBe("not-applied")
  })

  it("rejects target drift, inconsistent classification, and unbound remediation", () => {
    expect(() => designDriftDetectionInputSchema.parse({
      ...input(), observations: [{ ...input().observations[0], implementationTargetKey: "unknown-target" }, input().observations[1]],
    })).toThrow()
    expect(() => designDriftDetectionInputSchema.parse({
      ...input(), observations: [{ ...input().observations[0], classification: "conformant", severity: "medium" }, input().observations[1]],
    })).toThrow()
    expect(() => designDriftDetectionInputSchema.parse({
      ...input(), remediationCandidates: [{ ...input().remediationCandidates[0], driftKeys: ["unknown-drift"] }],
    })).toThrow()
  })

  it("rejects private projection fields and secret-shaped values", () => {
    expect(() => designDriftDetectionInputSchema.parse({ ...input(), limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] })).toThrow()
    expect(() => designDriftDetectionProjectionSchema.parse({ schemaVersion: 1, kind: "design-drift-detection-projection", reviewer: "private" })).toThrow()
  })
})
