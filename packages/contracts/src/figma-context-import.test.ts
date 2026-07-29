import { describe, expect, it } from "vitest"

import {
  figmaContextImportInputSchema,
  figmaContextImportSchema,
  type FigmaContextImportInput,
} from "./figma-context-import.js"

const digest = (value: string) => `sha256:${value.repeat(64)}`
const source = {
  sourceId: "11111111-1111-4111-8111-111111111111",
  sourceRevision: 1,
  recordDigest: digest("1"),
  contentDigest: digest("2"),
} as const
const exact = (recordId: string, value: string) => ({
  recordId,
  revision: 1,
  digest: digest(value),
  membershipDigest: digest(value),
})
const reviewedEvidence = {
  state: "human-reviewed" as const,
  evidenceDigests: [digest("3")],
  reviewedBy: { kind: "human" as const, id: "Context selection reviewer" },
  reviewedAt: "2026-07-29T00:10:00.000Z",
}

function input(): FigmaContextImportInput {
  return {
    initiativeId: "22222222-2222-4222-8222-222222222222",
    context: {
      productRevision: 7,
      productDigest: digest("4"),
      initiativeRevision: 3,
      initiativeDigest: digest("5"),
    },
    informationClassification: "internal",
    title: "Candidate GAEP context selection for Figma",
    designApplicability: exact("33333333-3333-4333-8333-333333333333", "6"),
    designRequirements: exact("44444444-4444-4444-8444-444444444444", "7"),
    designSystemTokenContract: exact("55555555-5555-4555-8555-555555555555", "8"),
    accessibilityDesignRules: exact("66666666-6666-4666-8666-666666666666", "9"),
    responsiveMultiPlatformTargets: exact("77777777-7777-4777-8777-777777777777", "a"),
    manualFigmaExecutionPath: exact("88888888-8888-4888-8888-888888888888", "b"),
    figmaMcpCapabilityDiscovery: exact("99999999-9999-4999-8999-999999999999", "c"),
    figmaReadSnapshot: exact("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "d"),
    contextPacks: [{
      recordId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      revision: 2,
      digest: digest("e"),
      packDigest: digest("f"),
    }],
    sections: [
      {
        key: "design-brief",
        kind: "design-brief",
        contextPackId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        contextItemIds: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
        contentDigest: digest("0"),
        transformationDigest: digest("1"),
        informationClassification: "internal",
        redactionState: "not-required",
        evidence: reviewedEvidence,
        sources: [source],
      },
      {
        key: "design-requirements",
        kind: "design-requirements",
        contextPackId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        contextItemIds: ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"],
        contentDigest: digest("2"),
        transformationDigest: digest("3"),
        informationClassification: "internal",
        redactionState: "not-required",
        evidence: reviewedEvidence,
        sources: [source],
      },
    ],
    targets: [{
      key: "primary-design-file",
      designScopeKey: "customer-portal",
      fileKey: "product-ui",
      targetKind: "file-root",
      externalFileIdentityDigest: digest("4"),
      externalVersionDigest: digest("5"),
      plannedWriteToolKey: "write-file-context",
      expectedEffect: "write",
      permissionRequirementState: "ungranted",
      sectionKeys: ["design-brief", "design-requirements"],
      ownership: { state: "assigned-candidate", owner: { kind: "role", id: "Design integration owner" } },
      sources: [source],
      limitations: ["The exact external target must be revalidated before any separately governed write"],
    }],
    requirementCoverage: [{
      requirementKey: "GAEP-UX-001",
      state: "represented",
      sectionKeys: ["design-requirements"],
      targetKeys: ["primary-design-file"],
      rationaleDigest: digest("6"),
      sources: [source],
    }],
    preview: {
      selectionDigest: digest("7"),
      previewDigest: digest("8"),
      state: "human-reviewed",
      evidenceDigests: [digest("9")],
      reviewedBy: { kind: "human", id: "Context selection reviewer" },
      reviewedAt: "2026-07-29T00:10:00.000Z",
    },
    contextSelectionState: "candidate-selection-complete",
    provenanceState: "exact",
    unresolvedQuestions: [],
    limitations: ["This candidate selects context only and does not package, transfer, or write it to Figma"],
    reviewState: "ready-for-human-review",
    packagePreparationState: "not-started",
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

describe("Figma Context Import contract", () => {
  it("accepts exact reviewed context selection without packaging, transfer, connection, or write authority", () => {
    expect(figmaContextImportInputSchema.parse(input())).toMatchObject({
      contextSelectionState: "candidate-selection-complete",
      packagePreparationState: "not-started",
      contextTransferState: "not-performed",
      figmaWriteAuthorityState: "not-granted",
    })
    expect(figmaContextImportSchema.parse({
      schemaVersion: 1,
      kind: "figma-context-import-candidate",
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      productId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      ...input(),
      revision: 1,
      membershipDigest: digest("a"),
      state: "candidate",
      createdBy: { kind: "human", id: "Context selection author" },
      updatedBy: { kind: "human", id: "Context selection author" },
      createdAt: "2026-07-29T00:10:00.000Z",
      updatedAt: "2026-07-29T00:10:00.000Z",
      authorityBoundary: "figma-context-import-is-a-source-backed-candidate-selection-and-does-not-package-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
    })).toMatchObject({ revision: 1, state: "candidate" })
  })

  it("rejects unbound sections, invented coverage, unresolved redaction, and write authority", () => {
    const unboundSection: any = structuredClone(input())
    unboundSection.sections[0].contextPackId = "ffffffff-ffff-4fff-8fff-ffffffffffff"
    expect(figmaContextImportInputSchema.safeParse(unboundSection).success).toBe(false)

    const inventedCoverage: any = structuredClone(input())
    inventedCoverage.requirementCoverage[0].sectionKeys = ["missing-section"]
    expect(figmaContextImportInputSchema.safeParse(inventedCoverage).success).toBe(false)

    const unresolvedRedaction: any = structuredClone(input())
    unresolvedRedaction.sections[0].redactionState = "unresolved"
    expect(figmaContextImportInputSchema.safeParse(unresolvedRedaction).success).toBe(false)

    const writeGranted: any = structuredClone(input())
    writeGranted.figmaWriteAuthorityState = "granted"
    expect(figmaContextImportInputSchema.safeParse(writeGranted).success).toBe(false)
  })

  it("rejects raw undeclared content, duplicate Context Items, and secret-shaped metadata", () => {
    const rawContent: any = structuredClone(input())
    rawContent.sections[0].content = "raw brief content"
    expect(figmaContextImportInputSchema.safeParse(rawContent).success).toBe(false)

    const duplicateItem: any = structuredClone(input())
    duplicateItem.sections[1].contextItemIds = duplicateItem.sections[0].contextItemIds
    expect(figmaContextImportInputSchema.safeParse(duplicateItem).success).toBe(false)

    const hostile: any = structuredClone(input())
    hostile.limitations = ["Authorization: Bearer secret-material-that-must-never-be-persisted"]
    expect(figmaContextImportInputSchema.safeParse(hostile).success).toBe(false)
  })
})
