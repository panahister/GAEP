import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import { backlogToCodeTraceabilityInputSchema, type BacklogToCodeTraceabilityInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { BacklogToCodeTraceabilityService } from "./backlog-to-code-traceability.js"
import type { GaepRepository } from "./repository.js"

interface StoredWrite { path: string; value: unknown }
interface StoredMutation { writes: StoredWrite[]; audit: { eventType: string; payload: Record<string, unknown> } }
class MemoryRepository {
  readonly values = new Map<string, unknown>(); readonly audits: StoredMutation["audit"][] = []
  resolve(...segments: string[]): string { return join("/workspace/.gaep", ...segments) }
  async withLock<T>(work: () => Promise<T>): Promise<T> { return work() }
  async verifyAudit() { return { valid: true } }
  async readJson<T>(path: string): Promise<T> { if (!this.values.has(path)) throw Object.assign(new Error("missing"), { code: "ENOENT" }); return this.values.get(path) as T }
  async readDirectory(directory: string): Promise<string[]> { const names = [...this.values.keys()].filter((path) => dirname(path) === directory).map((path) => basename(path)); if (!names.length) throw Object.assign(new Error("missing"), { code: "ENOENT" }); return names }
  async commitMutation(mutation: StoredMutation): Promise<void> { for (const write of mutation.writes) this.values.set(write.path, write.value); this.audits.push(mutation.audit) }
}
function reference(record: { id: string; revision: number }) { return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) } }

function fixture() {
  const repository = new MemoryRepository(), product = { id: randomUUID(), revision: 1 }
  const initiative = { id: randomUUID(), revision: 1, productId: product.id, state: "active" as const }
  const context = { productRevision: 1, productDigest: canonicalDigest(product), initiativeRevision: 1, initiativeDigest: canonicalDigest(initiative) }
  const base = () => ({ id: randomUUID(), revision: 1, productId: product.id, initiativeId: initiative.id, context })
  const requirement = { recordId: randomUUID(), revision: 1, digest: canonicalDigest({ requirement: true }), key: "REQ-PRODUCT-1" }
  const backlogNodeId = randomUUID()
  const backlogHierarchy = { ...base(), nodes: [{ id: backlogNodeId, key: "story.product-view", requirements: [requirement] }] }
  const implementationUnitId = randomUUID(), changedUnitId = randomUUID(), changedPathId = randomUUID(), testAssetId = randomUUID()
  const changedUnitInventory = { ...base(), units: [{ id: changedUnitId, implementationUnitId, repositoryCandidate: "gaep-web",
    moduleCandidate: "product-studio", pathCandidates: [{ id: changedPathId, pathCandidate: "src/product-view.tsx",
      backlogNodeIds: [backlogNodeId], requirementKeys: ["REQ-PRODUCT-1"], testAssetIds: [testAssetId] }] }] }
  const proposedChangePreview = { ...base(), changedUnitInventory: reference(changedUnitInventory), previewUnits: [{
    changedUnitCandidateId: changedUnitId, pathPreviews: [{ changedPathCandidateId: changedPathId, pathCandidate: "src/product-view.tsx" }] }] }
  const generationTargetId = randomUUID()
  const controlledDesignToCodeGeneration = { ...base(), targets: [{ id: generationTargetId, targetKey: "product-view",
    implementationUnitId, repositoryCandidate: "gaep-web", moduleCandidate: "product-studio", pathCandidate: "src/product-view.tsx" }] }
  const designTraceId = randomUUID()
  const testInventory = { ...base(), assets: [{ id: testAssetId, key: "test.product-view", implementationUnitIds: [implementationUnitId],
    requirementKeys: ["REQ-PRODUCT-1"] }] }
  const designToCodeTraceability = { ...base(), dependencies: { controlledDesignToCodeGeneration: reference(controlledDesignToCodeGeneration),
    backlogHierarchy: reference(backlogHierarchy), testInventory: reference(testInventory) }, traces: [{ id: designTraceId,
    traceKey: "trace.product-view", generationTargetId, implementationUnitId, repositoryCandidate: "gaep-web",
    moduleCandidate: "product-studio", pathCandidate: "src/product-view.tsx", symbolCandidate: "ProductView" }] }
  const constraintTargetId = randomUUID()
  const boilerplateConstraintEnforcement = { ...base(), dependencies: {
    controlledDesignToCodeGeneration: reference(controlledDesignToCodeGeneration), designToCodeTraceability: reference(designToCodeTraceability),
  }, targets: [{ id: constraintTargetId, generationTargetId, traceId: designTraceId, pathCandidate: "src/product-view.tsx" }] }
  const dependencies = { backlogHierarchy, changedUnitInventory, proposedChangePreview, controlledDesignToCodeGeneration,
    designToCodeTraceability, boilerplateConstraintEnforcement, testInventory }
  const evidence = [{ kind: "review" as const, sourceId: "backlog-code-review", revision: 1,
    digest: canonicalDigest({ reviewed: true }), evidenceState: "human-reviewed" as const }]
  const input: BacklogToCodeTraceabilityInput = {
    initiativeId: initiative.id, context, informationClassification: "internal", title: "Backlog-to-code traceability candidate",
    dependencies: Object.fromEntries(Object.entries(dependencies).map(([key, value]) => [key, reference(value)])) as BacklogToCodeTraceabilityInput["dependencies"],
    traces: [{ id: randomUUID(), ordinal: 1, traceKey: "trace.story-product-view", backlogNodeId,
      backlogNodeKey: "story.product-view", requirementKeys: ["REQ-PRODUCT-1"], changedUnitId, changedPathId,
      implementationUnitId, generationTargetId, designTraceId, constraintTargetId, repositoryCandidate: "gaep-web",
      moduleCandidate: "product-studio", pathCandidate: "src/product-view.tsx", symbolCandidate: "ProductView",
      testAssetIds: [testAssetId], testAssetKeys: ["test.product-view"], commitReferenceCandidates: [],
      evidenceReferences: evidence, conflictReferenceCandidates: [], traceState: "candidate-linked",
      repositoryTruthState: "not-established", codeTruthState: "not-established", commitTruthState: "not-established",
      testExecutionState: "not-performed", testResultState: "not-established", outcomeTruthState: "not-established",
      acceptanceState: "not-established" }], unresolvedQuestions: [],
    limitations: ["Candidate links do not establish repository, commit, test-result, outcome, or acceptance truth"],
    reviewState: "ready-for-human-review", traceCompletenessState: "not-established", repositoryTruthState: "not-established",
    codeTruthState: "not-established", commitTruthState: "not-established", testExecutionState: "not-performed",
    testResultState: "not-established", outcomeTruthState: "not-established", approvalState: "not-established",
    acceptanceState: "not-established", nativeHostAcceptanceState: "not-established", liveProviderAcceptanceState: "not-established",
    securityAcceptanceState: "not-established", releaseReadinessState: "not-established",
    deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
  }
  const readers = Object.fromEntries(Object.entries(dependencies).map(([key, value]) => [key, { readCurrent: async () => value }]))
  const service = new BacklogToCodeTraceabilityService(repository as unknown as GaepRepository, async () => product as never,
    async () => initiative as never, readers as never)
  return { repository, service, input, initiative, dependencies }
}

describe("Backlog-to-Code Traceability lifecycle", () => {
  it("persists immutable backlog/change/code/test continuity without inventing commit or outcome truth", async () => {
    const { repository, service, input, initiative, dependencies } = fixture()
    const created = await service.create(input, "trace-author")
    const revised = await service.revise(created.id, 1, { ...input, title: "Reviewed backlog-to-code traceability" }, "trace-author")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created), commitTruthState: "not-established",
      testExecutionState: "not-performed", outcomeTruthState: "not-established" })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({ state: "candidate-defined", traceCount: 1, backlogNodeCount: 1,
      changedPathCount: 1, codePathCount: 1, commitCandidateCount: 0, testAssetCount: 1, linkedCount: 1,
      staleBindingCount: 0, coverageGapCount: 0, invalidCandidateCount: 0 })
    expect(await service.project(initiative.id)).toMatchObject({ candidate: { traces: [{ backlogNodeKey: "story.product-view",
      pathCandidate: "src/product-view.tsx", symbolCandidate: "ProductView", testAssetKeys: ["test.product-view"], commitCandidateCount: 0 }] } })
    expect(repository.audits.at(-1)?.payload).toMatchObject({ traceCount: 1, commitCandidateCount: 0, actionAuthorityState: "not-granted" })
    dependencies.backlogHierarchy.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", staleBindingCount: 1 })
  })

  it("fails closed on forged backlog, code, test, conflict, traversal, and secret metadata", async () => {
    const { service, input } = fixture()
    await expect(service.create({ ...input, traces: [{ ...input.traces[0]!, backlogNodeKey: "story.forged" }] }, "trace-author")).rejects.toThrow(/continuity/iu)
    await expect(service.create({ ...input, traces: [{ ...input.traces[0]!, testAssetKeys: ["test.forged"] }] }, "trace-author")).rejects.toThrow(/continuity/iu)
    expect(backlogToCodeTraceabilityInputSchema.safeParse({ ...input, traces: [{ ...input.traces[0]!, pathCandidate: "../escape.ts" }] }).success).toBe(false)
    expect(backlogToCodeTraceabilityInputSchema.safeParse({ ...input, traces: [{ ...input.traces[0]!, traceState: "conflict" }] }).success).toBe(false)
    expect(backlogToCodeTraceabilityInputSchema.safeParse({ ...input, limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false)
  })
})
