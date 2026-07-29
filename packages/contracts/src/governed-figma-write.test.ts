import { describe, expect, it } from "vitest"

import {
  governedFigmaWriteInputSchema,
  governedFigmaWriteSchema,
  type GovernedFigmaWriteInput,
} from "./governed-figma-write.js"

const digest = (value: string) => `sha256:${value.repeat(64)}`
const source = {
  sourceId: "11111111-1111-4111-8111-111111111111",
  sourceRevision: 1,
  recordDigest: digest("1"),
  contentDigest: digest("2"),
} as const

function input(): GovernedFigmaWriteInput {
  return {
    initiativeId: "22222222-2222-4222-8222-222222222222",
    context: {
      productRevision: 7,
      productDigest: digest("3"),
      initiativeRevision: 3,
      initiativeDigest: digest("4"),
    },
    informationClassification: "internal",
    title: "Customer portal governed Figma write",
    objectiveDigest: digest("5"),
    outboundPackage: {
      recordId: "33333333-3333-4333-8333-333333333333",
      revision: 2,
      digest: digest("6"),
      membershipDigest: digest("7"),
      manifestDigest: digest("8"),
      payloadDigest: digest("9"),
    },
    target: {
      recipientKey: "primary-design-file",
      sourceTargetKey: "primary-design-file",
      designScopeKey: "customer-portal",
      fileKey: "product-ui",
      targetKind: "figma-file-root",
      externalFileIdentityDigest: digest("a"),
      expectedExternalVersionDigest: digest("b"),
      plannedWriteToolKey: "write-design-node",
      selectedEntryKeys: ["design-brief"],
      intendedEffect: "figma-write",
      destinationState: "not-connected",
      targetValidityState: "not-established",
      sources: [source],
    },
    requestFormat: "gaep-governed-figma-write-request-v1",
    requestDigest: digest("c"),
    effectDigest: digest("d"),
    preview: {
      packageManifestDigest: digest("8"),
      packagePayloadDigest: digest("9"),
      requestDigest: digest("c"),
      effectDigest: digest("d"),
      previewDigest: digest("e"),
      state: "human-reviewed",
      evidenceDigests: [digest("1")],
      reviewedBy: { kind: "human", id: "Governed write reviewer" },
      reviewedAt: "2026-07-29T13:00:00.000Z",
    },
    approval: { state: "pending", evidenceDigests: [] },
    permissionEvidence: {
      state: "verified",
      permissionKeys: ["figma.file.write"],
      evidenceDigests: [digest("2")],
      verificationDigest: digest("3"),
      verifiedBy: { kind: "human", id: "Permission evidence reviewer" },
      verifiedAt: "2026-07-29T13:00:00.000Z",
    },
    idempotency: {
      keyDigest: digest("4"),
      scopeDigest: digest("5"),
      requestDigest: digest("c"),
      state: "defined",
      replayProtectionState: "defined",
    },
    recoveryPlan: {
      state: "defined",
      strategyDigest: digest("6"),
      rollbackScopeDigest: digest("7"),
      partialFailureRuleDigest: digest("8"),
      unknownResultRuleDigest: digest("9"),
      evidenceDigests: [digest("a")],
    },
    disclosures: [{
      key: "approval-pending",
      kind: "approval-gap",
      materiality: "non-material",
      state: "resolved",
      subjectDigest: digest("b"),
      rationaleDigest: digest("c"),
      evidenceDigests: [digest("d")],
      reviewedBy: { kind: "human", id: "Governed write reviewer" },
      reviewedAt: "2026-07-29T13:00:00.000Z",
      sources: [source],
    }],
    sources: [source],
    unresolvedQuestions: [],
    limitations: ["This candidate records an authorization review plan and never performs a Figma write"],
    reviewState: "ready-for-human-review",
    writePlanState: "complete-for-authorization-review",
    packageMaterializationState: "manifest-only",
    contextTransferState: "not-performed",
    figmaConnectionAuthorityState: "not-granted",
    credentialAuthorityState: "not-granted",
    permissionGrantState: "not-granted",
    figmaWriteAuthorityState: "not-granted",
    writeExecutionState: "not-performed",
    writeResultState: "not-recorded",
    externalVersionValidationState: "not-established",
    targetValidityState: "not-established",
    designValidityState: "not-established",
    designApprovalState: "not-established",
    designBaselineState: "not-established",
    readinessState: "not-established",
    implementationAuthorityState: "not-granted",
  }
}

describe("Governed Figma Write contract", () => {
  it("accepts an exact authorization-review candidate without connection or write authority", () => {
    expect(governedFigmaWriteInputSchema.parse(input())).toMatchObject({
      writePlanState: "complete-for-authorization-review",
      approval: { state: "pending" },
      figmaWriteAuthorityState: "not-granted",
      writeExecutionState: "not-performed",
    })
    expect(governedFigmaWriteSchema.parse({
      schemaVersion: 1,
      kind: "governed-figma-write-candidate",
      id: "44444444-4444-4444-8444-444444444444",
      productId: "55555555-5555-4555-8555-555555555555",
      ...input(),
      revision: 1,
      membershipDigest: digest("f"),
      state: "candidate",
      createdBy: { kind: "human", id: "Governed write author" },
      updatedBy: { kind: "human", id: "Governed write author" },
      createdAt: "2026-07-29T13:00:00.000Z",
      updatedAt: "2026-07-29T13:00:00.000Z",
      authorityBoundary: "governed-figma-write-is-an-authorization-review-candidate-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
    })).toMatchObject({ revision: 1, state: "candidate" })
  })

  it("rejects previews and idempotency records that do not bind the exact request", () => {
    const badPreview: any = structuredClone(input())
    badPreview.preview.requestDigest = digest("e")
    expect(governedFigmaWriteInputSchema.safeParse(badPreview).success).toBe(false)

    const badIdempotency: any = structuredClone(input())
    badIdempotency.idempotency.requestDigest = digest("e")
    expect(governedFigmaWriteInputSchema.safeParse(badIdempotency).success).toBe(false)
  })

  it("rejects invented approval or permission decisions without attributable evidence", () => {
    const badApproval: any = structuredClone(input())
    badApproval.approval = { state: "granted", evidenceDigests: [] }
    expect(governedFigmaWriteInputSchema.safeParse(badApproval).success).toBe(false)

    const badPermission: any = structuredClone(input())
    badPermission.permissionEvidence = { state: "verified", permissionKeys: [], evidenceDigests: [] }
    expect(governedFigmaWriteInputSchema.safeParse(badPermission).success).toBe(false)
  })

  it("rejects expired-before-decision approval and incomplete recovery", () => {
    const badExpiry: any = structuredClone(input())
    badExpiry.approval = {
      state: "granted",
      scopeDigest: digest("1"),
      decisionDigest: digest("2"),
      evidenceDigests: [digest("3")],
      decidedBy: { kind: "human", id: "Approver" },
      decidedAt: "2026-07-29T13:00:00.000Z",
      expiresAt: "2026-07-29T12:00:00.000Z",
    }
    expect(governedFigmaWriteInputSchema.safeParse(badExpiry).success).toBe(false)

    const badRecovery: any = structuredClone(input())
    delete badRecovery.recoveryPlan.partialFailureRuleDigest
    expect(governedFigmaWriteInputSchema.safeParse(badRecovery).success).toBe(false)
  })

  it("rejects review-ready plans with unresolved material gaps or unreviewed previews", () => {
    const unresolved: any = structuredClone(input())
    unresolved.disclosures[0] = {
      ...unresolved.disclosures[0],
      materiality: "material",
      state: "unresolved",
      evidenceDigests: [],
      reviewedBy: undefined,
      reviewedAt: undefined,
    }
    expect(governedFigmaWriteInputSchema.safeParse(unresolved).success).toBe(false)

    const unreviewed: any = structuredClone(input())
    unreviewed.preview = {
      ...unreviewed.preview,
      state: "candidate-generated",
      reviewedBy: undefined,
      reviewedAt: undefined,
    }
    expect(governedFigmaWriteInputSchema.safeParse(unreviewed).success).toBe(false)
  })

  it("rejects undeclared raw content and secret-shaped values", () => {
    const raw: any = structuredClone(input())
    raw.target.content = "raw Figma node payload"
    expect(governedFigmaWriteInputSchema.safeParse(raw).success).toBe(false)

    const secret: any = structuredClone(input())
    secret.limitations = ["Authorization: Bearer secret-material-that-must-never-be-persisted"]
    expect(governedFigmaWriteInputSchema.safeParse(secret).success).toBe(false)
  })
})
