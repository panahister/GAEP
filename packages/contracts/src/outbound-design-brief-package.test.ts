import { describe, expect, it } from "vitest"

import {
  outboundDesignBriefPackageInputSchema,
  outboundDesignBriefPackageSchema,
  type OutboundDesignBriefPackageInput,
} from "./outbound-design-brief-package.js"

const digest = (value: string) => `sha256:${value.repeat(64)}`
const source = {
  sourceId: "11111111-1111-4111-8111-111111111111",
  sourceRevision: 1,
  recordDigest: digest("1"),
  contentDigest: digest("2"),
} as const
const reviewedEvidence = {
  state: "human-reviewed" as const,
  evidenceDigests: [digest("3")],
  reviewedBy: { kind: "human" as const, id: "Outbound package reviewer" },
  reviewedAt: "2026-07-29T12:00:00.000Z",
}

function input(): OutboundDesignBriefPackageInput {
  return {
    initiativeId: "22222222-2222-4222-8222-222222222222",
    context: {
      productRevision: 7,
      productDigest: digest("4"),
      initiativeRevision: 3,
      initiativeDigest: digest("5"),
    },
    informationClassification: "internal",
    title: "Customer portal outbound design brief package",
    objectiveDigest: digest("6"),
    figmaContextImport: {
      recordId: "33333333-3333-4333-8333-333333333333",
      revision: 2,
      digest: digest("7"),
      membershipDigest: digest("8"),
    },
    contextPacks: [{
      recordId: "44444444-4444-4444-8444-444444444444",
      revision: 2,
      digest: digest("9"),
      packDigest: digest("a"),
    }],
    manifestFormat: "gaep-outbound-design-brief-package-v1",
    manifestDigest: digest("b"),
    payloadDigest: digest("c"),
    entries: [{
      key: "design-brief",
      sourceSectionKey: "design-brief",
      kind: "design-brief",
      contextPackId: "44444444-4444-4444-8444-444444444444",
      contextItemIds: ["55555555-5555-4555-8555-555555555555"],
      contentDigest: digest("d"),
      transformationDigest: digest("e"),
      selectionReasonDigest: digest("f"),
      informationClassification: "internal",
      redactionState: "not-required",
      requirementKeys: ["GAEP-UX-001"],
      recipientKeys: ["primary-design-file"],
      evidence: reviewedEvidence,
      sources: [source],
    }],
    recipients: [{
      key: "primary-design-file",
      sourceTargetKey: "primary-design-file",
      designScopeKey: "customer-portal",
      fileKey: "product-ui",
      targetKind: "figma-file-root",
      externalFileIdentityDigest: digest("0"),
      externalVersionDigest: digest("1"),
      plannedWriteToolKey: "write-design-node",
      expectedEffect: "write",
      permissionRequirementState: "ungranted",
      entryKeys: ["design-brief"],
      purposeDigest: digest("2"),
      policyBasisDigest: digest("3"),
      retentionRuleDigest: digest("4"),
      destinationState: "not-connected",
      processorState: "not-selected",
      deliveryState: "not-performed",
      sources: [source],
      limitations: ["The exact external target must be revalidated before any separately governed write"],
    }],
    requirementCoverage: [{
      requirementKey: "GAEP-UX-001",
      state: "represented",
      entryKeys: ["design-brief"],
      recipientKeys: ["primary-design-file"],
      rationaleDigest: digest("5"),
      sources: [source],
    }],
    disclosures: [{
      key: "excluded-non-material-detail",
      kind: "exclusion",
      materiality: "non-material",
      state: "resolved",
      subjectDigest: digest("6"),
      rationaleDigest: digest("7"),
      evidence: reviewedEvidence,
      sources: [source],
    }],
    manifestState: "candidate-complete",
    provenanceState: "exact",
    redactionReviewState: "complete",
    preview: {
      manifestDigest: digest("b"),
      payloadDigest: digest("c"),
      previewDigest: digest("8"),
      state: "human-reviewed",
      evidenceDigests: [digest("9")],
      reviewedBy: { kind: "human", id: "Outbound package reviewer" },
      reviewedAt: "2026-07-29T12:00:00.000Z",
    },
    unresolvedQuestions: [],
    limitations: ["This versioned candidate is manifest-only and does not materialize or transfer context"],
    reviewState: "ready-for-human-review",
    packageMaterializationState: "manifest-only",
    contextTransferState: "not-performed",
    figmaConnectionAuthorityState: "not-granted",
    credentialAuthorityState: "not-granted",
    permissionGrantState: "not-granted",
    figmaWriteAuthorityState: "not-granted",
    targetValidityState: "not-established",
    externalCompletenessState: "not-established",
    designValidityState: "not-established",
    designApprovalState: "not-established",
    designBaselineState: "not-established",
    readinessState: "not-established",
    implementationAuthorityState: "not-granted",
  }
}

describe("Outbound Design Brief Package contract", () => {
  it("accepts one exact reviewed manifest-only candidate without transfer or write authority", () => {
    expect(outboundDesignBriefPackageInputSchema.parse(input())).toMatchObject({
      manifestState: "candidate-complete",
      packageMaterializationState: "manifest-only",
      contextTransferState: "not-performed",
      figmaWriteAuthorityState: "not-granted",
    })
    expect(outboundDesignBriefPackageSchema.parse({
      schemaVersion: 1,
      kind: "outbound-design-brief-package-candidate",
      id: "66666666-6666-4666-8666-666666666666",
      productId: "77777777-7777-4777-8777-777777777777",
      ...input(),
      revision: 1,
      membershipDigest: digest("a"),
      state: "candidate",
      createdBy: { kind: "human", id: "Outbound package author" },
      updatedBy: { kind: "human", id: "Outbound package author" },
      createdAt: "2026-07-29T12:00:00.000Z",
      updatedAt: "2026-07-29T12:00:00.000Z",
      authorityBoundary: "outbound-design-brief-package-is-a-versioned-manifest-only-candidate-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
    })).toMatchObject({ revision: 1, state: "candidate" })
  })

  it("rejects unbound recipients, invented coverage, and unresolved material disclosures", () => {
    const unboundRecipient: any = structuredClone(input())
    unboundRecipient.entries[0].recipientKeys = ["missing-recipient"]
    expect(outboundDesignBriefPackageInputSchema.safeParse(unboundRecipient).success).toBe(false)

    const inventedCoverage: any = structuredClone(input())
    inventedCoverage.requirementCoverage[0].entryKeys = ["missing-entry"]
    expect(outboundDesignBriefPackageInputSchema.safeParse(inventedCoverage).success).toBe(false)

    const unresolvedDisclosure: any = structuredClone(input())
    unresolvedDisclosure.disclosures[0].materiality = "material"
    unresolvedDisclosure.disclosures[0].state = "unresolved"
    unresolvedDisclosure.disclosures[0].evidence = { state: "not-assessed", evidenceDigests: [] }
    expect(outboundDesignBriefPackageInputSchema.safeParse(unresolvedDisclosure).success).toBe(false)
  })

  it("rejects raw undeclared content, duplicated Context Items, and secret-shaped metadata", () => {
    const rawContent: any = structuredClone(input())
    rawContent.entries[0].content = "raw design brief"
    expect(outboundDesignBriefPackageInputSchema.safeParse(rawContent).success).toBe(false)

    const duplicateItem: any = structuredClone(input())
    duplicateItem.entries.push({ ...structuredClone(duplicateItem.entries[0]), key: "requirements" })
    expect(outboundDesignBriefPackageInputSchema.safeParse(duplicateItem).success).toBe(false)

    const hostile: any = structuredClone(input())
    hostile.limitations = ["Authorization: Bearer secret-material-that-must-never-be-persisted"]
    expect(outboundDesignBriefPackageInputSchema.safeParse(hostile).success).toBe(false)
  })

  it("rejects review-ready records with an unreviewed preview or unresolved question", () => {
    const unreviewed: any = structuredClone(input())
    unreviewed.preview = {
      manifestDigest: digest("b"),
      payloadDigest: digest("c"),
      previewDigest: digest("8"),
      state: "candidate-generated",
      evidenceDigests: [digest("9")],
    }
    expect(outboundDesignBriefPackageInputSchema.safeParse(unreviewed).success).toBe(false)

    const unresolved: any = structuredClone(input())
    unresolved.unresolvedQuestions = ["Who owns the external target validation decision?"]
    expect(outboundDesignBriefPackageInputSchema.safeParse(unresolved).success).toBe(false)
  })
})
