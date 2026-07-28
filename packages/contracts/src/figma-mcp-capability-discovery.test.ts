import { describe, expect, it } from "vitest"

import {
  figmaMcpCapabilityDiscoveryInputSchema,
  figmaMcpCapabilityDiscoverySchema,
  type FigmaMcpCapabilityDiscoveryInput,
} from "./figma-mcp-capability-discovery.js"

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

function input(): FigmaMcpCapabilityDiscoveryInput {
  return {
    initiativeId: "22222222-2222-4222-8222-222222222222",
    context: {
      productRevision: 1,
      productDigest: digest("3"),
      initiativeRevision: 1,
      initiativeDigest: digest("4"),
    },
    informationClassification: "internal",
    title: "Figma MCP capability discovery observation",
    designApplicability: exact("33333333-3333-4333-8333-333333333333", "5"),
    manualFigmaExecutionPath: exact("44444444-4444-4444-8444-444444444444", "6"),
    adapter: {
      key: "figma-mcp",
      kind: "figma-mcp",
      displayName: "Candidate Figma MCP adapter",
      transportClass: "local-process",
      installationState: "observed",
      discoveryInterfaceState: "advertised",
      adapterVersionState: "known",
      adapterVersion: "1.2.3",
      protocolVersionState: "known",
      protocolVersion: "2026-07",
      sources: [source],
      limitations: ["The observation does not prove a live Figma connection"],
    },
    observation: {
      state: "human-reviewed",
      catalogDigest: digest("7"),
      observedAt: "2026-07-28T18:40:00.000Z",
      reviewedBy: { kind: "human", id: "Capability reviewer" },
      reviewedAt: "2026-07-28T18:45:00.000Z",
    },
    tools: [
      {
        key: "read-file-metadata",
        toolName: "read_file_metadata",
        capabilityClass: "read-metadata",
        effectClass: "figma-read",
        availabilityState: "advertised",
        versionState: "known",
        version: "1.0",
        schemaDigest: digest("8"),
        permissions: [{
          key: "file-read",
          accessClass: "read",
          requirementState: "required",
          grantState: "not-granted",
          rationale: "The advertised read operation declares a file-scoped read requirement.",
          sources: [source],
        }],
        limits: [{
          key: "request-timeout",
          kind: "timeout",
          state: "declared",
          value: 30,
          unit: "seconds",
          rationale: "The observed adapter documentation declares a bounded request timeout.",
          sources: [source],
        }],
        evidenceState: "human-reviewed",
        evidenceDigests: [digest("9")],
        reviewedBy: { kind: "human", id: "Capability reviewer" },
        reviewedAt: "2026-07-28T18:45:00.000Z",
        sources: [source],
        limitations: ["Advertised availability is not live compatibility evidence"],
      },
      {
        key: "write-design-node",
        toolName: "write_design_node",
        capabilityClass: "write-design",
        effectClass: "figma-write",
        availabilityState: "advertised",
        versionState: "known",
        version: "1.0",
        schemaDigest: digest("a"),
        permissions: [{
          key: "file-write",
          accessClass: "write",
          requirementState: "required",
          grantState: "not-granted",
          rationale: "The advertised write operation declares a file-scoped write requirement without granting it.",
          sources: [source],
        }],
        limits: [{
          key: "request-timeout",
          kind: "timeout",
          state: "declared",
          value: 30,
          unit: "seconds",
          rationale: "The observed adapter documentation declares a bounded request timeout.",
          sources: [source],
        }],
        evidenceState: "human-reviewed",
        evidenceDigests: [digest("b")],
        reviewedBy: { kind: "human", id: "Capability reviewer" },
        reviewedAt: "2026-07-28T18:45:00.000Z",
        sources: [source],
        limitations: ["Advertised write capability grants no write permission or action authority"],
      },
    ],
    catalogState: "candidate-observation-complete",
    permissionModelState: "candidate-separated",
    limitCatalogState: "candidate-complete",
    versionCatalogState: "candidate-complete",
    ownership: { state: "assigned-candidate", owner: { kind: "role", id: "Platform integration owner" } },
    unresolvedQuestions: [],
    limitations: ["No Figma request, credential access, permission grant, or compatibility test was performed"],
    reviewState: "ready-for-human-review",
    figmaConnectionState: "not-connected",
    figmaRequestState: "not-sent",
    credentialState: "not-requested",
    permissionGrantState: "not-granted",
    figmaWriteAuthorityState: "not-granted",
    designApprovalState: "not-established",
    designBaselineState: "not-established",
    readinessState: "not-established",
    implementationAuthorityState: "not-granted",
  }
}

describe("Figma MCP Capability Discovery contract", () => {
  it("accepts source-backed human-reviewed read/write observations without connection or authority", () => {
    expect(figmaMcpCapabilityDiscoveryInputSchema.parse(input())).toMatchObject({
      figmaConnectionState: "not-connected",
      figmaRequestState: "not-sent",
      credentialState: "not-requested",
      permissionGrantState: "not-granted",
      figmaWriteAuthorityState: "not-granted",
    })
    expect(figmaMcpCapabilityDiscoverySchema.parse({
      schemaVersion: 1,
      kind: "figma-mcp-capability-discovery-candidate",
      id: "55555555-5555-4555-8555-555555555555",
      productId: "66666666-6666-4666-8666-666666666666",
      ...input(),
      revision: 1,
      membershipDigest: digest("c"),
      state: "candidate",
      createdBy: { kind: "human", id: "Capability author" },
      updatedBy: { kind: "human", id: "Capability author" },
      createdAt: "2026-07-28T18:45:00.000Z",
      updatedAt: "2026-07-28T18:45:00.000Z",
      authorityBoundary: "figma-mcp-capability-discovery-is-source-backed-candidate-observation-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-establish-tool-availability-or-compatibility-authorize-write-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
    })).toMatchObject({ revision: 1, state: "candidate" })
  })

  it("rejects invented grants, incomplete version truth, and tools without an assessed observation", () => {
    const granted: any = structuredClone(input())
    granted.tools[1].permissions[0].grantState = "granted"
    expect(figmaMcpCapabilityDiscoveryInputSchema.safeParse(granted).success).toBe(false)

    const missingVersion: any = structuredClone(input())
    delete missingVersion.tools[0].version
    expect(figmaMcpCapabilityDiscoveryInputSchema.safeParse(missingVersion).success).toBe(false)

    const notAssessed: any = structuredClone(input())
    notAssessed.observation = { state: "not-assessed" }
    expect(figmaMcpCapabilityDiscoveryInputSchema.safeParse(notAssessed).success).toBe(false)
  })

  it("rejects secret-shaped discovery metadata", () => {
    const hostile: any = structuredClone(input())
    hostile.limitations = ["Authorization: Bearer secret-material-that-must-never-be-persisted"]
    expect(figmaMcpCapabilityDiscoveryInputSchema.safeParse(hostile).success).toBe(false)
  })
})
