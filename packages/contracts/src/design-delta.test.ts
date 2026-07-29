import { describe, expect, it } from "vitest"

import {
  designDeltaInputSchema,
  designDeltaProjectionSchema,
  designDeltaSchema,
  designDeltaStatusSchema,
  type DesignDeltaInput,
} from "./design-delta.js"

const digest = (value: string) => `sha256:${value.repeat(64).slice(0, 64)}`
const now = "2026-07-29T23:10:00Z"
const productId = "11111111-1111-4111-8111-111111111111"
const initiativeId = "22222222-2222-4222-8222-222222222222"
const sourceId = "33333333-3333-4333-8333-333333333333"
const candidateId = "44444444-4444-4444-8444-444444444444"

function input(overrides: Partial<DesignDeltaInput> = {}): DesignDeltaInput {
  return {
    initiativeId,
    context: {
      productRevision: 3,
      productDigest: digest("a"),
      initiativeRevision: 5,
      initiativeDigest: digest("b"),
    },
    informationClassification: "internal",
    title: "Exact returned-design delta review candidate",
    objectiveDigest: digest("c"),
    designerReadyGate: {
      recordId: "50000000-0000-4000-8000-000000000001",
      revision: 2,
      digest: digest("1"),
      membershipDigest: digest("2"),
      prerequisiteCatalogDigest: digest("3"),
      assessmentReceiptDigest: digest("4"),
      candidateResult: "incomplete",
    },
    finalizedSnapshot: {
      recordId: "50000000-0000-4000-8000-000000000002",
      revision: 2,
      digest: digest("5"),
      membershipDigest: digest("6"),
      itemCatalogDigest: digest("7"),
      reconciliationDigest: digest("8"),
      reviewState: "held",
    },
    designBinding: {
      recordId: "50000000-0000-4000-8000-000000000003",
      revision: 2,
      digest: digest("9"),
      membershipDigest: digest("0"),
      bindingCatalogDigest: digest("a"),
      reconciliationDigest: digest("b"),
      reviewState: "held",
    },
    sourceSnapshotDigest: digest("3"),
    targetSnapshotDigest: digest("7"),
    comparisonDefinitionDigest: digest("c"),
    comparisonReceiptDigest: digest("d"),
    sourceItemCount: 12,
    targetItemCount: 4,
    deltas: [{
      key: "changed-primary-component",
      subjectKind: "design-item",
      subjectKey: "primary-component",
      changeKind: "changed",
      sourceDigest: digest("e"),
      targetDigest: digest("f"),
      freshness: "current",
      impactState: "not-assessed",
      evidenceState: "source-recorded",
      evidenceDigests: [],
      sources: [{ sourceId, sourceRevision: 1, recordDigest: digest("1"), contentDigest: digest("2") }],
    }],
    comparisonState: "exact",
    provenanceState: "exact",
    candidateResult: "delta-detected-candidate",
    unresolvedMappings: [],
    unresolvedQuestions: [],
    limitations: ["Detected differences remain candidates for accountable review and resolution."],
    reviewState: "ready-for-human-review",
    deltaCompletenessState: "not-established",
    externalCompletenessState: "not-established",
    designValidityState: "not-established",
    designApprovalState: "not-established",
    designBaselineState: "not-established",
    readinessState: "not-established",
    conflictResolutionAuthorityState: "not-granted",
    synchronizationAuthorityState: "not-granted",
    figmaConnectionAuthorityState: "not-granted",
    credentialAuthorityState: "not-granted",
    permissionGrantState: "not-granted",
    importExecutionState: "not-performed",
    writeExecutionState: "not-performed",
    implementationAuthorityState: "not-granted",
    ...overrides,
  }
}

describe("Design Delta contract", () => {
  it("accepts exact source-backed candidate deltas without granting synchronization authority", () => {
    const parsed = designDeltaInputSchema.parse(input())
    expect(parsed.deltas).toHaveLength(1)
    expect(parsed.candidateResult).toBe("delta-detected-candidate")
    expect(parsed.synchronizationAuthorityState).toBe("not-granted")
    expect(parsed.designBaselineState).toBe("not-established")
  })

  it("enforces exact side identity for added, missing, changed, and conflicting deltas", () => {
    const same = input()
    same.deltas[0] = { ...same.deltas[0]!, targetDigest: same.deltas[0]!.sourceDigest }
    expect(designDeltaInputSchema.safeParse(same).success).toBe(false)

    const added = input()
    added.deltas[0] = { ...added.deltas[0]!, changeKind: "added", sourceDigest: undefined }
    expect(designDeltaInputSchema.safeParse(added).success).toBe(true)

    const malformedAdded = input()
    malformedAdded.deltas[0] = { ...malformedAdded.deltas[0]!, changeKind: "added" }
    expect(designDeltaInputSchema.safeParse(malformedAdded).success).toBe(false)

    const conflict = input({ candidateResult: "conflict-candidate" })
    conflict.deltas[0] = { ...conflict.deltas[0]!, changeKind: "conflicting" }
    expect(designDeltaInputSchema.safeParse(conflict).success).toBe(true)
  })

  it("requires exact review-ready comparison for a no-delta candidate", () => {
    const noDelta = input({ deltas: [], candidateResult: "no-delta-candidate" })
    expect(designDeltaInputSchema.safeParse(noDelta).success).toBe(true)

    const partial = input({ deltas: [], candidateResult: "no-delta-candidate", comparisonState: "partial" })
    expect(designDeltaInputSchema.safeParse(partial).success).toBe(false)

    const unreviewed = input({ reviewState: "ready-for-human-review" })
    unreviewed.deltas[0] = { ...unreviewed.deltas[0]!, evidenceState: "not-assessed" }
    expect(designDeltaInputSchema.safeParse(unreviewed).success).toBe(false)
  })

  it("rejects secret-shaped content and invented approval, baseline, readiness, or resolution authority", () => {
    expect(designDeltaInputSchema.safeParse({ ...input(), token: "ghp_123456789012345678901234567890123456" }).success).toBe(false)
    expect(designDeltaInputSchema.safeParse({ ...input(), designApprovalState: "approved" }).success).toBe(false)
    expect(designDeltaInputSchema.safeParse({ ...input(), readinessState: "ready" }).success).toBe(false)
    expect(designDeltaInputSchema.safeParse({ ...input(), conflictResolutionAuthorityState: "granted" }).success).toBe(false)

    const record = {
      ...input(),
      schemaVersion: 1,
      kind: "design-delta-candidate",
      id: candidateId,
      productId,
      revision: 1,
      membershipDigest: digest("3"),
      state: "candidate",
      createdBy: { kind: "human", id: "delta-reviewer" },
      updatedBy: { kind: "human", id: "delta-reviewer" },
      createdAt: now,
      updatedAt: now,
      authorityBoundary: "design-delta-is-a-review-candidate-and-does-not-establish-delta-completeness-external-completeness-design-validity-approval-baseline-readiness-conflict-resolution-synchronization-implementation-write-import-or-action-authority",
    }
    expect(designDeltaSchema.parse(record).state).toBe("candidate")
    expect(designDeltaSchema.safeParse({ ...record, state: "approved" }).success).toBe(false)
  })

  it("keeps status and projections exact, count-reconciled, privacy-safe, and non-authoritative", () => {
    const status = designDeltaStatusSchema.parse({
      schemaVersion: 1,
      kind: "design-delta-status",
      productId,
      productRevision: 3,
      initiativeId,
      initiativeRevision: 5,
      candidate: { recordId: candidateId, revision: 1, digest: digest("4") },
      sourceItemCount: 12,
      targetItemCount: 4,
      deltaCount: 1,
      addedCount: 0,
      changedCount: 1,
      conflictingCount: 0,
      missingCount: 0,
      staleCount: 0,
      unmappedCount: 0,
      humanReviewedCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      unresolvedMappingCount: 0,
      unresolvedQuestionCount: 0,
      comparisonState: "exact",
      provenanceState: "exact",
      candidateResult: "delta-detected-candidate",
      reviewState: "ready-for-human-review",
      state: "complete-for-review",
      reasons: [],
      assessedAt: now,
      authorityBoundary: "design-delta-status-is-observational-and-does-not-establish-delta-completeness-external-completeness-design-validity-approval-baseline-readiness-conflict-resolution-synchronization-implementation-write-import-or-action-authority",
    })
    const candidate = input()
    const projection = designDeltaProjectionSchema.parse({
      schemaVersion: 1,
      kind: "design-delta-projection",
      product: { id: productId, revision: 3, digest: digest("a") },
      initiative: { id: initiativeId, revision: 5, digest: digest("b"), state: "active" },
      status,
      candidate: {
        id: candidateId,
        revision: 1,
        digest: digest("4"),
        membershipDigest: digest("3"),
        state: "candidate",
        designerReadyGate: candidate.designerReadyGate,
        finalizedSnapshot: candidate.finalizedSnapshot,
        designBinding: candidate.designBinding,
        sourceSnapshotDigest: candidate.sourceSnapshotDigest,
        targetSnapshotDigest: candidate.targetSnapshotDigest,
        comparisonDefinitionDigest: candidate.comparisonDefinitionDigest,
        comparisonReceiptDigest: candidate.comparisonReceiptDigest,
        deltaCatalogDigest: digest("5"),
        deltaCount: 1,
        comparisonState: "exact",
        provenanceState: "exact",
        candidateResult: "delta-detected-candidate",
        reviewState: "ready-for-human-review",
        updatedAt: now,
      },
      observedAt: now,
      privacyBoundary: "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-delta-content-external-identities-evidence-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions",
      authorityBoundary: "design-delta-projection-is-read-only-and-does-not-establish-delta-completeness-external-completeness-design-validity-approval-baseline-readiness-conflict-resolution-synchronization-implementation-write-import-or-action-authority",
      snapshotDigest: digest("6"),
    })
    expect(projection.status.state).toBe("complete-for-review")
    expect(JSON.stringify(projection)).not.toContain("delta-reviewer")
  })
})
