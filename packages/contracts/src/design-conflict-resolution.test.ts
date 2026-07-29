import { describe, expect, it } from "vitest"

import {
  designConflictResolutionInputSchema,
  designConflictResolutionProjectionSchema,
  designConflictResolutionSchema,
  designConflictResolutionStatusSchema,
  type DesignConflictResolutionInput,
} from "./design-conflict-resolution.js"

const digest = (value: string) => `sha256:${value.repeat(64).slice(0, 64)}`
const now = "2026-07-29T23:50:00Z"
const productId = "11111111-1111-4111-8111-111111111111"
const initiativeId = "22222222-2222-4222-8222-222222222222"
const sourceId = "33333333-3333-4333-8333-333333333333"
const candidateId = "44444444-4444-4444-8444-444444444444"

function input(overrides: Partial<DesignConflictResolutionInput> = {}): DesignConflictResolutionInput {
  return {
    initiativeId,
    context: {
      productRevision: 3,
      productDigest: digest("a"),
      initiativeRevision: 5,
      initiativeDigest: digest("b"),
    },
    informationClassification: "internal",
    title: "Exact design conflict resolution review candidate",
    objectiveDigest: digest("c"),
    designDelta: {
      recordId: "50000000-0000-4000-8000-000000000001",
      revision: 2,
      digest: digest("1"),
      membershipDigest: digest("2"),
      deltaCatalogDigest: digest("3"),
      comparisonReceiptDigest: digest("4"),
      conflictingCount: 1,
      candidateResult: "conflict-candidate",
      reviewState: "ready-for-human-review",
    },
    resolutionDefinitionDigest: digest("5"),
    resolutionReceiptDigest: digest("6"),
    conflictCount: 1,
    resolutions: [{
      key: "resolve-primary-component",
      conflictKey: "conflicting-primary-component",
      conflictDigest: digest("7"),
      subjectKind: "design-item",
      resolutionKind: "merge-candidate",
      decisionDigest: digest("8"),
      scope: "single-conflict",
      decisionState: "human-reviewed",
      evidenceDigests: [digest("9")],
      sources: [{ sourceId, sourceRevision: 1, recordDigest: digest("a"), contentDigest: digest("b") }],
      proposedBy: { kind: "human", id: "design-owner" },
      proposedAt: now,
      reviewedBy: { kind: "human", id: "product-owner" },
      reviewedAt: now,
      validUntil: "2026-08-29T23:50:00Z",
      separationOfDutiesState: "distinct-actor-declared",
      effectState: "not-applied",
    }],
    coverageState: "candidate-complete",
    provenanceState: "exact",
    candidateResult: "conflict-plan-candidate",
    unresolvedConflictKeys: [],
    unresolvedQuestions: [],
    limitations: ["Founder mode records actor attribution but does not enforce separation of duties."],
    reviewState: "ready-for-human-review",
    separationOfDutiesEnforcementState: "not-established",
    conflictResolutionAuthorityState: "not-granted",
    synchronizationAuthorityState: "not-granted",
    designValidityState: "not-established",
    designApprovalState: "not-established",
    designBaselineState: "not-established",
    readinessState: "not-established",
    figmaConnectionAuthorityState: "not-granted",
    credentialAuthorityState: "not-granted",
    permissionGrantState: "not-granted",
    importExecutionState: "not-performed",
    writeExecutionState: "not-performed",
    implementationAuthorityState: "not-granted",
    ...overrides,
  }
}

describe("Design Conflict Resolution contract", () => {
  it("accepts exact human-reviewed single-conflict candidates without applying their effect", () => {
    const parsed = designConflictResolutionInputSchema.parse(input())
    expect(parsed.resolutions).toHaveLength(1)
    expect(parsed.resolutions[0]?.effectState).toBe("not-applied")
    expect(parsed.separationOfDutiesEnforcementState).toBe("not-established")
    expect(parsed.synchronizationAuthorityState).toBe("not-granted")
  })

  it("rejects forged separation, applied effects, count drift, secrets, and invented authority", () => {
    const sameActor = input()
    sameActor.resolutions[0] = {
      ...sameActor.resolutions[0]!,
      reviewedBy: sameActor.resolutions[0]!.proposedBy,
    }
    expect(designConflictResolutionInputSchema.safeParse(sameActor).success).toBe(false)

    const attributedProposal = input({ reviewState: "draft" })
    attributedProposal.resolutions[0] = {
      ...attributedProposal.resolutions[0]!, decisionState: "proposed", evidenceDigests: [],
      separationOfDutiesState: "not-enforced-founder-mode",
    }
    expect(designConflictResolutionInputSchema.safeParse(attributedProposal).success).toBe(false)

    expect(designConflictResolutionInputSchema.safeParse({ ...input(), conflictCount: 2 }).success).toBe(false)
    expect(designConflictResolutionInputSchema.safeParse({ ...input(), synchronizationAuthorityState: "granted" }).success).toBe(false)
    expect(designConflictResolutionInputSchema.safeParse({ ...input(), token: "ghp_123456789012345678901234567890123456" }).success).toBe(false)

    const applied = input()
    applied.resolutions[0] = { ...applied.resolutions[0]!, effectState: "applied" } as never
    expect(designConflictResolutionInputSchema.safeParse(applied).success).toBe(false)
  })

  it("permits only an exact review-ready empty set to claim a no-conflict candidate", () => {
    const noConflict = input({
      designDelta: { ...input().designDelta, conflictingCount: 0, candidateResult: "no-delta-candidate" },
      conflictCount: 0,
      resolutions: [],
      candidateResult: "no-conflict-candidate",
    })
    expect(designConflictResolutionInputSchema.safeParse(noConflict).success).toBe(true)
    expect(designConflictResolutionInputSchema.safeParse({ ...noConflict, provenanceState: "partial" }).success).toBe(false)
  })

  it("keeps stored records, status, and projections exact, count-reconciled, privacy-safe, and non-authoritative", () => {
    const record = designConflictResolutionSchema.parse({
      ...input(),
      schemaVersion: 1,
      kind: "design-conflict-resolution-candidate",
      id: candidateId,
      productId,
      revision: 1,
      membershipDigest: digest("c"),
      state: "candidate",
      createdBy: { kind: "human", id: "design-owner" },
      updatedBy: { kind: "human", id: "design-owner" },
      createdAt: now,
      updatedAt: now,
      authorityBoundary: "design-conflict-resolution-is-a-review-candidate-and-does-not-enforce-separation-of-duties-resolve-conflicts-synchronize-design-establish-validity-approval-baseline-readiness-or-grant-implementation-write-import-or-action-authority",
    })
    expect(record.state).toBe("candidate")
    expect(designConflictResolutionSchema.safeParse({ ...record, state: "resolved" }).success).toBe(false)

    const status = designConflictResolutionStatusSchema.parse({
      schemaVersion: 1,
      kind: "design-conflict-resolution-status",
      productId,
      productRevision: 3,
      initiativeId,
      initiativeRevision: 5,
      candidate: { recordId: candidateId, revision: 1, digest: digest("d") },
      conflictCount: 1,
      resolutionCount: 1,
      acceptSourceCount: 0,
      acceptTargetCount: 0,
      mergeCount: 1,
      rejectChangeCount: 0,
      escalateCount: 0,
      humanReviewedCount: 1,
      distinctActorDeclaredCount: 1,
      expiredCandidateCount: 0,
      unresolvedConflictCount: 0,
      unresolvedQuestionCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      coverageState: "candidate-complete",
      provenanceState: "exact",
      candidateResult: "conflict-plan-candidate",
      reviewState: "ready-for-human-review",
      state: "complete-for-review",
      reasons: [],
      assessedAt: now,
      authorityBoundary: "design-conflict-resolution-status-is-observational-and-does-not-enforce-separation-of-duties-resolve-conflicts-synchronize-design-establish-validity-approval-baseline-readiness-or-grant-implementation-write-import-or-action-authority",
    })
    const candidate = input()
    const projection = designConflictResolutionProjectionSchema.parse({
      schemaVersion: 1,
      kind: "design-conflict-resolution-projection",
      product: { id: productId, revision: 3, digest: digest("a") },
      initiative: { id: initiativeId, revision: 5, digest: digest("b"), state: "active" },
      status,
      candidate: {
        id: candidateId,
        revision: 1,
        digest: digest("d"),
        membershipDigest: digest("c"),
        state: "candidate",
        designDelta: candidate.designDelta,
        resolutionDefinitionDigest: candidate.resolutionDefinitionDigest,
        resolutionReceiptDigest: candidate.resolutionReceiptDigest,
        resolutionCatalogDigest: digest("e"),
        conflictCount: 1,
        resolutionCount: 1,
        coverageState: "candidate-complete",
        provenanceState: "exact",
        candidateResult: "conflict-plan-candidate",
        reviewState: "ready-for-human-review",
        updatedAt: now,
      },
      observedAt: now,
      privacyBoundary: "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-delta-content-resolution-content-evidence-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions",
      authorityBoundary: "design-conflict-resolution-projection-is-read-only-and-does-not-enforce-separation-of-duties-resolve-conflicts-synchronize-design-establish-validity-approval-baseline-readiness-or-grant-implementation-write-import-or-action-authority",
      snapshotDigest: digest("f"),
    })
    expect(projection.status.state).toBe("complete-for-review")
    expect(JSON.stringify(projection)).not.toContain("design-owner")
  })
})
