import { describe, expect, it } from "vitest"

import {
  manualFigmaExecutionPathInputSchema,
  manualFigmaExecutionPathSchema,
  manualFigmaHandoffArtifactKinds,
  manualFigmaInstructionKinds,
  manualFigmaReturnArtifactKinds,
  type ManualFigmaExecutionPathInput,
} from "./manual-figma-execution-path.js"

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

function input(): ManualFigmaExecutionPathInput {
  const scopeKey = "customer-web"
  return {
    initiativeId: "22222222-2222-4222-8222-222222222222",
    context: {
      productRevision: 1,
      productDigest: digest("3"),
      initiativeRevision: 1,
      initiativeDigest: digest("4"),
    },
    informationClassification: "internal",
    title: "Manual Figma execution guidance",
    designApplicability: exact("33333333-3333-4333-8333-333333333333", "5"),
    screenStateInventory: exact("44444444-4444-4444-8444-444444444444", "6"),
    designRequirements: exact("55555555-5555-4555-8555-555555555555", "7"),
    designSystemTokenContract: exact("66666666-6666-4666-8666-666666666666", "8"),
    accessibilityDesignRules: exact("77777777-7777-4777-8777-777777777777", "9"),
    responsiveMultiPlatformTargets: exact("88888888-8888-4888-8888-888888888888", "a"),
    scopes: [{
      key: scopeKey,
      designScopeKey: scopeKey,
      figmaMode: "figma-design",
      executionMode: "manual-disconnected",
      handoffLocation: "design-handoff/customer-web",
      handoffManifestDigest: digest("b"),
      handoffPackageDigest: digest("c"),
      includedArtifacts: [...manualFigmaHandoffArtifactKinds],
      requiredReturns: [...manualFigmaReturnArtifactKinds],
      instructionStepKeys: ["export-return", "handoff", "human-review", "manual-figma-execution", "prepare"],
      ownership: { state: "assigned-candidate", owner: { kind: "role", id: "Product design owner" } },
      sources: [source],
      limitations: ["No direct Figma connection is available"],
    }],
    instructions: manualFigmaInstructionKinds.map((kind, index) => ({
      key: kind,
      sequence: index + 1,
      kind,
      scopeKeys: [scopeKey],
      instruction: `Follow the governed ${kind} procedure using only the exact digest-bound handoff metadata.`,
      requiredInputs: kind === "prepare" ? [] : ["design-brief" as const],
      expectedOutputs: kind === "export-return" ? [...manualFigmaReturnArtifactKinds] : [],
      humanActionRequired: kind === "manual-figma-execution",
      completionState: "not-executed" as const,
      actionAuthorityState: "not-granted" as const,
      sources: [source],
    })),
    checks: [{
      key: "handoff-path-contained",
      scopeKey,
      kind: "handoff-path-contained",
      evidenceState: "human-reviewed",
      observation: "evidence-supports",
      evidenceDigests: [digest("d")],
      reviewedBy: { kind: "human", id: "Design reviewer" },
      reviewedAt: "2026-07-28T17:50:00.000Z",
      procedure: "Confirm the repository-relative handoff path remains contained in the governed workspace.",
      sources: [source],
    }],
    requirementCoverage: [{
      requirementKey: "GAEP-DES-001",
      state: "represented",
      scopeKeys: [scopeKey],
      rationale: "The exact design requirement is represented in the manual execution scope.",
      sources: [source],
    }],
    guideCatalogState: "candidate-complete",
    handoffCatalogState: "candidate-complete",
    returnContractState: "candidate-complete",
    unresolvedQuestions: [],
    limitations: ["Manual execution and returned design review remain human activities"],
    reviewState: "ready-for-human-review",
    figmaConnectionState: "disconnected-only",
    figmaExecutionState: "not-executed",
    figmaWriteAuthorityState: "not-granted",
    designApprovalState: "not-established",
    designBaselineState: "not-established",
    readinessState: "not-established",
    implementationAuthorityState: "not-granted",
  }
}

describe("Manual Figma Execution Path contract", () => {
  it("accepts a complete disconnected, digest-bound, human-execution candidate without authority", () => {
    expect(manualFigmaExecutionPathInputSchema.parse(input())).toMatchObject({
      figmaConnectionState: "disconnected-only",
      figmaExecutionState: "not-executed",
      figmaWriteAuthorityState: "not-granted",
    })
    expect(manualFigmaExecutionPathSchema.parse({
      schemaVersion: 1,
      kind: "manual-figma-execution-path-candidate",
      id: "99999999-9999-4999-8999-999999999999",
      productId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ...input(),
      revision: 1,
      membershipDigest: digest("e"),
      state: "candidate",
      createdBy: { kind: "human", id: "Design author" },
      updatedBy: { kind: "human", id: "Design author" },
      createdAt: "2026-07-28T17:50:00.000Z",
      updatedAt: "2026-07-28T17:50:00.000Z",
      authorityBoundary: "manual-figma-execution-path-is-candidate-guidance-and-does-not-connect-to-figma-execute-design-actions-grant-write-authority-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
    })).toMatchObject({ state: "candidate", revision: 1 })
  })

  it("rejects unsafe handoff locations, incomplete catalogs, and invented execution authority", () => {
    const unsafe: any = structuredClone(input())
    unsafe.scopes[0].handoffLocation = "../private"
    expect(manualFigmaExecutionPathInputSchema.safeParse(unsafe).success).toBe(false)

    const incomplete: any = structuredClone(input())
    incomplete.scopes[0].requiredReturns.pop()
    expect(manualFigmaExecutionPathInputSchema.safeParse(incomplete).success).toBe(false)

    const executed: any = structuredClone(input())
    executed.instructions[0].completionState = "completed"
    expect(manualFigmaExecutionPathInputSchema.safeParse(executed).success).toBe(false)
  })

  it("rejects secret-shaped candidate content", () => {
    const hostile: any = structuredClone(input())
    hostile.limitations = ["Authorization: Bearer secret-material-that-must-never-be-persisted"]
    expect(manualFigmaExecutionPathInputSchema.safeParse(hostile).success).toBe(false)
  })
})
