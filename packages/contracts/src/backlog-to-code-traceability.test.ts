import { randomUUID } from "node:crypto"

import { describe, expect, it } from "vitest"

import { backlogToCodeTraceabilityInputSchema } from "./backlog-to-code-traceability.js"

const digest = (value: string) => `sha256:${value.repeat(64)}` as const
const reference = () => ({ recordId: randomUUID(), revision: 1, digest: digest("a") })
function candidate() {
  const initiative = { id: randomUUID(), revision: 1 }
  const evidence = [{ kind: "review" as const, sourceId: "trace-review", revision: 1,
    digest: digest("b"), evidenceState: "human-reviewed" as const }]
  return {
    initiativeId: initiative.id,
    context: { productRevision: 1, productDigest: digest("c"), initiativeRevision: 1, initiativeDigest: digest("d") },
    informationClassification: "internal" as const, title: "Backlog-to-code traceability candidate",
    dependencies: { backlogHierarchy: reference(), changedUnitInventory: reference(), proposedChangePreview: reference(),
      controlledDesignToCodeGeneration: reference(), designToCodeTraceability: reference(),
      boilerplateConstraintEnforcement: reference(), testInventory: reference() },
    traces: [{ id: randomUUID(), ordinal: 1, traceKey: "trace.story-product-view", backlogNodeId: randomUUID(),
      backlogNodeKey: "story.product-view", requirementKeys: ["REQ-PRODUCT-1"], changedUnitId: randomUUID(),
      changedPathId: randomUUID(), implementationUnitId: randomUUID(), generationTargetId: randomUUID(),
      designTraceId: randomUUID(), constraintTargetId: randomUUID(), repositoryCandidate: "gaep-web",
      moduleCandidate: "product-studio", pathCandidate: "src/product-view.tsx", symbolCandidate: "ProductView",
      testAssetIds: [randomUUID()], testAssetKeys: ["test.product-view"], commitReferenceCandidates: [],
      evidenceReferences: evidence, conflictReferenceCandidates: [], traceState: "candidate-linked" as const,
      repositoryTruthState: "not-established" as const, codeTruthState: "not-established" as const,
      commitTruthState: "not-established" as const, testExecutionState: "not-performed" as const,
      testResultState: "not-established" as const, outcomeTruthState: "not-established" as const,
      acceptanceState: "not-established" as const }],
    unresolvedQuestions: [], limitations: ["Candidate links do not establish repository, commit, test-result, or outcome truth"],
    reviewState: "ready-for-human-review" as const, traceCompletenessState: "not-established" as const,
    repositoryTruthState: "not-established" as const, codeTruthState: "not-established" as const,
    commitTruthState: "not-established" as const, testExecutionState: "not-performed" as const,
    testResultState: "not-established" as const, outcomeTruthState: "not-established" as const,
    approvalState: "not-established" as const, acceptanceState: "not-established" as const,
    nativeHostAcceptanceState: "not-established" as const, liveProviderAcceptanceState: "not-established" as const,
    securityAcceptanceState: "not-established" as const, releaseReadinessState: "not-established" as const,
    deploymentReadinessState: "not-established" as const, actionAuthorityState: "not-granted" as const,
  }
}

describe("Backlog-to-Code Traceability contract", () => {
  it("accepts bounded backlog/change/code/commit-candidate/test metadata with explicit truth stop lines", () => {
    const parsed = backlogToCodeTraceabilityInputSchema.parse(candidate())
    expect(parsed.traces[0]).toMatchObject({ traceState: "candidate-linked", repositoryTruthState: "not-established",
      commitTruthState: "not-established", testExecutionState: "not-performed", outcomeTruthState: "not-established" })
  })

  it("rejects traversal, conflict without evidence, and secret-shaped metadata", () => {
    const input = candidate()
    expect(backlogToCodeTraceabilityInputSchema.safeParse({ ...input, traces: [{ ...input.traces[0]!, pathCandidate: "../escape.ts" }] }).success).toBe(false)
    expect(backlogToCodeTraceabilityInputSchema.safeParse({ ...input, traces: [{ ...input.traces[0]!, traceState: "conflict" }] }).success).toBe(false)
    expect(backlogToCodeTraceabilityInputSchema.safeParse({ ...input, limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false)
  })
})
