import { describe, expect, it } from "vitest"

import {
  figmaReadSnapshotInputSchema,
  figmaReadSnapshotSchema,
  type FigmaReadSnapshotInput,
} from "./figma-read-snapshot.js"

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
const evidence = {
  state: "human-reviewed" as const,
  evidenceDigests: [digest("3")],
  reviewedBy: { kind: "human" as const, id: "Design evidence reviewer" },
  reviewedAt: "2026-07-28T20:00:00.000Z",
}
const provenance = (externalObjectId: string, externalVersion: string, value: string) => ({
  provider: "figma" as const,
  externalObjectId,
  externalVersion,
  observedAt: "2026-07-28T19:55:00.000Z",
  contentDigest: digest(value),
  evidence,
  sources: [source],
})

function input(): FigmaReadSnapshotInput {
  return {
    initiativeId: "22222222-2222-4222-8222-222222222222",
    context: {
      productRevision: 1,
      productDigest: digest("4"),
      initiativeRevision: 1,
      initiativeDigest: digest("5"),
    },
    informationClassification: "internal",
    title: "Source-backed Figma read snapshot",
    designApplicability: exact("33333333-3333-4333-8333-333333333333", "6"),
    designSystemTokenContract: exact("44444444-4444-4444-8444-444444444444", "7"),
    figmaMcpCapabilityDiscovery: exact("55555555-5555-4555-8555-555555555555", "8"),
    capture: {
      mode: "figma-mcp-read-receipt",
      requestedToolKeys: ["read-file-content", "read-variables"],
      readEffectState: "read-only",
      receiptDigest: digest("9"),
      payloadDigest: digest("a"),
      capturedAt: "2026-07-28T19:55:00.000Z",
      evidence,
      sources: [source],
    },
    files: [{
      key: "product-ui",
      name: "Product UI",
      provenance: provenance("figma-file-1", "version-42", "b"),
      lastModifiedAt: "2026-07-28T19:45:00.000Z",
      freshnessState: "current-at-capture",
      accessState: "read-only-observation",
      limitations: ["Current at capture does not establish current external state after capture"],
    }],
    components: [{
      key: "button-primary",
      fileKey: "product-ui",
      nodeId: "12:34",
      name: "Button Primary",
      componentKind: "component",
      componentKey: "component-key-1",
      descriptionDigest: digest("c"),
      propertyDefinitionDigest: digest("d"),
      provenance: provenance("12:34", "version-42", "e"),
      evidenceState: "human-reviewed",
      sources: [source],
    }],
    variableCollections: [{
      key: "brand-tokens",
      fileKey: "product-ui",
      collectionId: "collection-1",
      name: "Brand Tokens",
      modeKeys: ["dark", "light"],
      variableKeys: ["brand-color"],
      provenance: provenance("collection-1", "version-42", "f"),
      evidenceState: "human-reviewed",
      sources: [source],
    }],
    variables: [{
      key: "brand-color",
      fileKey: "product-ui",
      collectionKey: "brand-tokens",
      variableId: "variable-1",
      name: "Brand Color",
      resolvedType: "color",
      modeValueDigests: [
        { modeKey: "dark", valueDigest: digest("0") },
        { modeKey: "light", valueDigest: digest("1") },
      ],
      descriptionDigest: digest("2"),
      provenance: provenance("variable-1", "version-42", "3"),
      evidenceState: "human-reviewed",
      sources: [source],
    }],
    snapshotCompletenessState: "candidate-observation-complete",
    provenanceState: "exact",
    ownership: { state: "assigned-candidate", owner: { kind: "role", id: "Design integration owner" } },
    unresolvedQuestions: [],
    limitations: ["The candidate preserves source-backed observations and does not prove the external Figma file is complete or current now"],
    reviewState: "ready-for-human-review",
    figmaConnectionAuthorityState: "not-granted",
    credentialAuthorityState: "not-granted",
    permissionGrantState: "not-granted",
    figmaWriteAuthorityState: "not-granted",
    externalCompletenessState: "not-established",
    designValidityState: "not-established",
    designApprovalState: "not-established",
    designBaselineState: "not-established",
    readinessState: "not-established",
    implementationAuthorityState: "not-granted",
  }
}

describe("Figma Read Snapshot contract", () => {
  it("accepts exact read-only file, component, collection, and variable evidence without connection or authority", () => {
    expect(figmaReadSnapshotInputSchema.parse(input())).toMatchObject({
      snapshotCompletenessState: "candidate-observation-complete",
      provenanceState: "exact",
      figmaConnectionAuthorityState: "not-granted",
      figmaWriteAuthorityState: "not-granted",
    })
    expect(figmaReadSnapshotSchema.parse({
      schemaVersion: 1,
      kind: "figma-read-snapshot-candidate",
      id: "66666666-6666-4666-8666-666666666666",
      productId: "77777777-7777-4777-8777-777777777777",
      ...input(),
      revision: 1,
      membershipDigest: digest("4"),
      state: "candidate",
      createdBy: { kind: "human", id: "Snapshot author" },
      updatedBy: { kind: "human", id: "Snapshot author" },
      createdAt: "2026-07-28T20:00:00.000Z",
      updatedAt: "2026-07-28T20:00:00.000Z",
      authorityBoundary: "figma-read-snapshot-is-source-backed-read-only-candidate-evidence-and-does-not-itself-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-authorize-write-validate-or-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
    })).toMatchObject({ revision: 1, state: "candidate" })
  })

  it("rejects forged cross-file membership, unknown variable values, and write authority", () => {
    const missingVariable: any = structuredClone(input())
    missingVariable.variableCollections[0].variableKeys = ["missing-variable"]
    expect(figmaReadSnapshotInputSchema.safeParse(missingVariable).success).toBe(false)

    const unknownWithValue: any = structuredClone(input())
    unknownWithValue.variables[0].resolvedType = "unknown"
    expect(figmaReadSnapshotInputSchema.safeParse(unknownWithValue).success).toBe(false)

    const writeGranted: any = structuredClone(input())
    writeGranted.figmaWriteAuthorityState = "granted"
    expect(figmaReadSnapshotInputSchema.safeParse(writeGranted).success).toBe(false)
  })

  it("rejects raw undeclared values and secret-shaped snapshot metadata", () => {
    const rawValue: any = structuredClone(input())
    rawValue.variables[0].rawValue = "#ffffff"
    expect(figmaReadSnapshotInputSchema.safeParse(rawValue).success).toBe(false)

    const hostile: any = structuredClone(input())
    hostile.limitations = ["Authorization: Bearer secret-material-that-must-never-be-persisted"]
    expect(figmaReadSnapshotInputSchema.safeParse(hostile).success).toBe(false)
  })
})
