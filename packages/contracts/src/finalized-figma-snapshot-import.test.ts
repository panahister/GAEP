import { describe, expect, it } from "vitest"

import {
  finalizedFigmaSnapshotImportInputSchema,
  finalizedFigmaSnapshotImportSchema,
  finalizedFigmaSnapshotImportStatusSchema,
  type FinalizedFigmaSnapshotImportInput,
} from "./finalized-figma-snapshot-import.js"

const digest = (value: string) => `sha256:${value.repeat(64)}`
const source = {
  sourceId: "11111111-1111-4111-8111-111111111111", sourceRevision: 1,
  recordDigest: digest("1"), contentDigest: digest("2"),
} as const

function input(): FinalizedFigmaSnapshotImportInput {
  return {
    initiativeId: "22222222-2222-4222-8222-222222222222",
    context: { productRevision: 7, productDigest: digest("3"), initiativeRevision: 3, initiativeDigest: digest("4") },
    informationClassification: "internal",
    title: "Finalized customer portal Figma snapshot return",
    objectiveDigest: digest("5"),
    governedWrite: {
      recordId: "33333333-3333-4333-8333-333333333333", revision: 2, digest: digest("6"),
      membershipDigest: digest("7"), requestDigest: digest("8"), effectDigest: digest("9"),
      externalFileIdentityDigest: digest("a"), expectedExternalVersionDigest: digest("b"),
    },
    returnReceipt: {
      mode: "manual-return-receipt", externalFileIdentityDigest: digest("a"),
      returnedExternalVersionDigest: digest("c"), payloadDigest: digest("d"), receiptDigest: digest("e"),
      capturedAt: "2026-07-29T14:00:00.000Z", evidenceState: "human-reviewed",
      evidenceDigests: [digest("1")], sources: [source],
    },
    returnAuthorization: {
      state: "verified", scopeDigest: digest("2"), decisionDigest: digest("3"),
      evidenceDigests: [digest("4")], verifiedBy: { kind: "human", id: "Snapshot return reviewer" },
      verifiedAt: "2026-07-29T14:00:00.000Z",
    },
    items: [{
      key: "customer-portal-file", kind: "file", externalIdentityDigest: digest("5"),
      contentDigest: digest("6"), provenanceDigest: digest("7"), evidenceState: "human-reviewed", sources: [source],
    }],
    conflicts: [], reconciliationDigest: digest("8"), reconciliationState: "exact",
    provenanceState: "exact", snapshotCompletenessState: "candidate-complete",
    unresolvedQuestions: [], limitations: ["This candidate records return evidence and never imports Figma content"],
    reviewState: "ready-for-human-review", inboundTransferState: "not-performed",
    importExecutionState: "not-performed", importResultState: "not-recorded",
    figmaConnectionAuthorityState: "not-granted", credentialAuthorityState: "not-granted",
    permissionGrantState: "not-granted", externalCompletenessState: "not-established",
    targetValidityState: "not-established", designValidityState: "not-established",
    designApprovalState: "not-established", designBaselineState: "not-established",
    readinessState: "not-established", implementationAuthorityState: "not-granted",
  }
}

describe("Finalized Figma Snapshot Import contract", () => {
  it("accepts an exact review candidate without transfer or import authority", () => {
    expect(finalizedFigmaSnapshotImportInputSchema.parse(input())).toMatchObject({
      reconciliationState: "exact", importExecutionState: "not-performed",
    })
    expect(finalizedFigmaSnapshotImportSchema.parse({
      schemaVersion: 1, kind: "finalized-figma-snapshot-import-candidate",
      id: "44444444-4444-4444-8444-444444444444", productId: "55555555-5555-4555-8555-555555555555",
      ...input(), revision: 1, membershipDigest: digest("f"), state: "candidate",
      createdBy: { kind: "human", id: "Snapshot author" }, updatedBy: { kind: "human", id: "Snapshot author" },
      createdAt: "2026-07-29T14:00:00.000Z", updatedAt: "2026-07-29T14:00:00.000Z",
      authorityBoundary: "finalized-figma-snapshot-import-is-a-review-candidate-and-does-not-transfer-or-import-content-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-validate-or-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
    })).toMatchObject({ revision: 1, state: "candidate" })
  })

  it("rejects a returned snapshot rebound to another external file", () => {
    const hostile: any = structuredClone(input())
    hostile.returnReceipt.externalFileIdentityDigest = digest("f")
    expect(finalizedFigmaSnapshotImportInputSchema.safeParse(hostile).success).toBe(false)
  })

  it("rejects invented return authorization and unattributed conflict resolution", () => {
    const authorization: any = structuredClone(input())
    authorization.returnAuthorization = { state: "verified", evidenceDigests: [] }
    expect(finalizedFigmaSnapshotImportInputSchema.safeParse(authorization).success).toBe(false)

    const conflict: any = structuredClone(input())
    conflict.conflicts = [{ key: "version-conflict", kind: "external-version-conflict", state: "resolved", subjectDigest: digest("1"), rationaleDigest: digest("2"), evidenceDigests: [], sources: [source] }]
    expect(finalizedFigmaSnapshotImportInputSchema.safeParse(conflict).success).toBe(false)
  })

  it("rejects review readiness while evidence, conflicts, or questions remain unresolved", () => {
    const hostile: any = structuredClone(input())
    hostile.items[0].evidenceState = "source-recorded"
    hostile.conflicts = [{ key: "version-conflict", kind: "external-version-conflict", state: "open", subjectDigest: digest("1"), rationaleDigest: digest("2"), evidenceDigests: [], sources: [source] }]
    expect(finalizedFigmaSnapshotImportInputSchema.safeParse(hostile).success).toBe(false)
  })

  it("requires attention statuses to expose reasons and complete statuses to have no gaps", () => {
    const base = {
      schemaVersion: 1, kind: "finalized-figma-snapshot-import-status", productId: "55555555-5555-4555-8555-555555555555",
      productRevision: 7, initiativeId: input().initiativeId, initiativeRevision: 3,
      itemCount: 1, humanReviewedItemCount: 1, sourceRecordedItemCount: 0, notAssessedItemCount: 0,
      openConflictCount: 0, staleBindingCount: 0, staleSourceReferenceCount: 0, unresolvedQuestionCount: 0,
      returnAuthorizationState: "verified", reconciliationState: "exact", provenanceState: "exact",
      snapshotCompletenessState: "candidate-complete", reviewState: "ready-for-human-review",
      importExecutionState: "not-performed", importResultState: "not-recorded", reasons: [],
      assessedAt: "2026-07-29T14:00:00.000Z",
      authorityBoundary: "finalized-figma-snapshot-import-status-is-observational-and-does-not-transfer-or-import-content-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-validate-or-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
    }
    expect(finalizedFigmaSnapshotImportStatusSchema.safeParse({ ...base, state: "attention-required" }).success).toBe(false)
    expect(finalizedFigmaSnapshotImportStatusSchema.safeParse({ ...base, state: "complete-for-review", candidate: { recordId: "44444444-4444-4444-8444-444444444444", revision: 1, digest: digest("f") } }).success).toBe(true)
  })

  it("rejects secret-shaped fields", () => {
    const hostile: any = structuredClone(input())
    hostile.apiToken = "figd_live_abcdefghijklmnopqrstuvwxyz1234567890"
    expect(finalizedFigmaSnapshotImportInputSchema.safeParse(hostile).success).toBe(false)
  })
})
