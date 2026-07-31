import { randomUUID } from "node:crypto"
import { describe, expect, it } from "vitest"

import { testGenerationInputSchema } from "./test-generation.js"

const digest = (value: string) => `sha256:${value.repeat(64)}` as const
const reference = () => ({ recordId: randomUUID(), revision: 1, digest: digest("a") })
function fixture() {
  const evidence = [{ kind: "review" as const, sourceId: "test-generation-plan", revision: 1, digest: digest("b"), evidenceState: "human-reviewed" as const }]
  const dependencies = { acceptanceCriteria: reference(), testMethodology: reference(), testInventory: reference(), implementationUnitModel: reference(),
    designToCodeTraceability: reference(), backlogToCodeTraceability: reference(), controlledDesignToCodeGeneration: reference(), proposedChangePreview: reference(),
    stagingWorkspace: reference(), changeConflictDetection: reference() }
  return { initiativeId: randomUUID(), context: { productRevision: 1, productDigest: digest("c"), initiativeRevision: 1, initiativeDigest: digest("d") },
    informationClassification: "internal" as const, title: "Test generation candidate", dependencies, targets: [{ id: randomUUID(), ordinal: 1,
      targetKey: "test.product-view", changeConflictSubjectId: randomUUID(), generationTargetId: randomUUID(), designTraceId: randomUUID(), backlogTraceId: randomUUID(),
      implementationUnitId: randomUUID(), acceptanceCriterionIds: [randomUUID()], testInventoryAssetIds: [randomUUID()], methodologyScopeIds: [randomUUID()],
      requirementKeys: ["REQ-TEST-1"], sourcePathCandidate: "apps/vscode/src/product-view.ts", testPathCandidate: "apps/vscode/src/product-view.test.ts",
      sourceSymbolCandidate: "ProductView", testSymbolCandidate: "ProductView tests", testKind: "unit" as const, frameworkCandidate: "vitest",
      fixtureCandidates: ["bounded Product Studio projection"], oracleCandidates: ["renders privacy-safe test target metadata"], coverageTraceCandidates: ["coverage.product-view"],
      riskTraceCandidates: ["risk.stale-binding"], expectedOutputCandidates: ["deterministic test candidate"], evidenceReferences: evidence,
      conflictReferenceCandidates: [], state: "candidate-defined" as const, sourceInspectionState: "not-performed" as const, generationState: "not-performed" as const,
      testExecutionState: "not-performed" as const, testResultState: "not-established" as const, coverageTruthState: "not-established" as const,
      qualityState: "not-established" as const, acceptanceState: "not-established" as const }], evidenceReferences: evidence,
    preconditions: ["Exact current change, generation, trace, acceptance, methodology and inventory candidates must be revalidated before generation"], unresolvedQuestions: [],
    limitations: ["Test candidates do not establish source, generated test, execution, result, coverage or quality truth"], reviewState: "ready-for-human-review" as const,
    plannedBy: { kind: "human" as const, id: "planner" }, plannedAt: "2026-08-01T01:00:00.000Z", repositoryTruthState: "not-established" as const,
    sourceTruthState: "not-established" as const, testAssetTruthState: "not-established" as const, generationState: "not-performed" as const,
    sourceMutationState: "not-performed" as const, testExecutionState: "not-performed" as const, testResultState: "not-established" as const,
    coverageTruthState: "not-established" as const, qualityState: "not-established" as const, approvalState: "not-established" as const,
    acceptanceState: "not-established" as const, nativeHostAcceptanceState: "not-established" as const, liveProviderAcceptanceState: "not-established" as const,
    securityAcceptanceState: "not-established" as const, releaseReadinessState: "not-established" as const, deploymentReadinessState: "not-established" as const,
    actionAuthorityState: "not-granted" as const }
}

describe("Test Generation contract", () => {
  it("accepts a bounded test plan without claiming source access, generation, execution, results, or acceptance", () => {
    expect(testGenerationInputSchema.parse(fixture())).toMatchObject({ targets: [{ frameworkCandidate: "vitest", generationState: "not-performed", testResultState: "not-established" }], sourceMutationState: "not-performed", actionAuthorityState: "not-granted" })
  })
  it("rejects traversal, duplicate subjects, invalid review readiness, conflict contradictions, and secrets", () => {
    const input = fixture(), target = input.targets[0]!
    expect(testGenerationInputSchema.safeParse({ ...input, targets: [{ ...target, testPathCandidate: "../escape.test.ts" }] }).success).toBe(false)
    expect(testGenerationInputSchema.safeParse({ ...input, targets: [target, { ...target, id: randomUUID(), targetKey: "test.duplicate", testPathCandidate: "apps/vscode/src/duplicate.test.ts" }] }).success).toBe(false)
    expect(testGenerationInputSchema.safeParse({ ...input, targets: [{ ...target, state: "gap" }] }).success).toBe(false)
    expect(testGenerationInputSchema.safeParse({ ...input, targets: [{ ...target, conflictReferenceCandidates: target.evidenceReferences }] }).success).toBe(false)
    expect(testGenerationInputSchema.safeParse({ ...input, limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false)
  })
})
