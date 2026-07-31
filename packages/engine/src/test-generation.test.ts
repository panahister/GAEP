import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import { testGenerationInputSchema, type TestGenerationInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { TestGenerationService } from "./test-generation.js"
import type { GaepRepository } from "./repository.js"

interface Mutation { writes: Array<{ path: string; value: unknown }>; audit: { eventType: string; payload: Record<string, unknown> } }
class MemoryRepository {
  readonly values = new Map<string, unknown>(); readonly audits: Mutation["audit"][] = []
  resolve(...parts: string[]): string { return join("/workspace/.gaep", ...parts) }
  async withLock<T>(work: () => Promise<T>): Promise<T> { return work() }
  async verifyAudit() { return { valid: true } }
  async readJson<T>(path: string): Promise<T> { if (!this.values.has(path)) throw Object.assign(new Error("missing"), { code: "ENOENT" }); return this.values.get(path) as T }
  async readDirectory(directory: string): Promise<string[]> { const values = [...this.values.keys()].filter((path) => dirname(path) === directory).map((path) => basename(path)); if (!values.length) throw Object.assign(new Error("missing"), { code: "ENOENT" }); return values }
  async commitMutation(mutation: Mutation): Promise<void> { mutation.writes.forEach((write) => this.values.set(write.path, write.value)); this.audits.push(mutation.audit) }
}
function reference(record: { id: string; revision: number }) { return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) } }
function fixture() {
  const repository = new MemoryRepository(), product = { id: randomUUID(), revision: 1 }, initiative = { id: randomUUID(), revision: 1, productId: product.id, state: "active" as const }
  const context = { productRevision: 1, productDigest: canonicalDigest(product), initiativeRevision: 1, initiativeDigest: canonicalDigest(initiative) }
  const base = () => ({ id: randomUUID(), revision: 1, productId: product.id, initiativeId: initiative.id, context })
  const evidence = [{ kind: "review" as const, sourceId: "test-generation-plan", revision: 1, digest: canonicalDigest({ reviewed: true }), evidenceState: "human-reviewed" as const }]
  const implementationUnitId = randomUUID(), criterionId = randomUUID(), assetId = randomUUID(), methodologyScopeId = randomUUID()
  const acceptanceCriteria = { ...base(), criteria: [{ id: criterionId, requirements: [{ key: "REQ-TEST-1" }] }] }
  const implementationUnitModel = { ...base(), units: [{ id: implementationUnitId }] }
  const testMethodology = { ...base(), scopes: [{ id: methodologyScopeId, implementationUnitId }] }
  const testInventory = { ...base(), acceptanceCriteria: reference(acceptanceCriteria), implementationUnitModel: reference(implementationUnitModel),
    testMethodology: reference(testMethodology), assets: [{ id: assetId, implementationUnitIds: [implementationUnitId] }] }
  const pathCandidate = "apps/vscode/src/product-view.ts", generationTargetId = randomUUID()
  const controlledDesignToCodeGeneration = { ...base(), targets: [{ id: generationTargetId, implementationUnitId, pathCandidate,
    expectedTestOutputs: ["deterministic test candidate"] }] }
  const designTraceId = randomUUID()
  const proposedChangePreview = { ...base(), changedUnitInventory: { recordId: randomUUID(), revision: 1, digest: canonicalDigest({ changed: true }) }, previewUnits: [] }
  const stagingWorkspace = { ...base(), proposedChangePreview: reference(proposedChangePreview), units: [] }
  const designToCodeTraceability = { ...base(), dependencies: { controlledDesignToCodeGeneration: reference(controlledDesignToCodeGeneration),
    acceptanceCriteria: reference(acceptanceCriteria), implementationUnitModel: reference(implementationUnitModel), proposedChangePreview: reference(proposedChangePreview),
    testInventory: reference(testInventory) }, traces: [{ id: designTraceId, generationTargetId, implementationUnitId, pathCandidate,
      acceptanceCriterionIds: [criterionId], associatedTestAssetIds: [assetId] }] }
  const backlogTraceId = randomUUID()
  const backlogToCodeTraceability = { ...base(), dependencies: { controlledDesignToCodeGeneration: reference(controlledDesignToCodeGeneration),
    designToCodeTraceability: reference(designToCodeTraceability), proposedChangePreview: reference(proposedChangePreview), testInventory: reference(testInventory) },
    traces: [{ id: backlogTraceId, generationTargetId, designTraceId, implementationUnitId, pathCandidate, testAssetIds: [assetId] }] }
  const conflictSubjectId = randomUUID()
  const changeConflictDetection = { ...base(), dependencies: { proposedChangePreview: reference(proposedChangePreview), stagingWorkspace: reference(stagingWorkspace) },
    subjects: [{ id: conflictSubjectId, pathCandidate, findings: [{ state: "no-conflict-candidate" }] }] }
  const dependencies = { acceptanceCriteria, testMethodology, testInventory, implementationUnitModel, designToCodeTraceability, backlogToCodeTraceability,
    controlledDesignToCodeGeneration, proposedChangePreview, stagingWorkspace, changeConflictDetection }
  const refs = Object.fromEntries(Object.entries(dependencies).map(([key, value]) => [key, reference(value)])) as TestGenerationInput["dependencies"]
  const input: TestGenerationInput = { initiativeId: initiative.id, context, informationClassification: "internal", title: "Test generation candidate", dependencies: refs,
    targets: [{ id: randomUUID(), ordinal: 1, targetKey: "test.product-view", changeConflictSubjectId: conflictSubjectId, generationTargetId, designTraceId, backlogTraceId,
      implementationUnitId, acceptanceCriterionIds: [criterionId], testInventoryAssetIds: [assetId], methodologyScopeIds: [methodologyScopeId], requirementKeys: ["REQ-TEST-1"],
      sourcePathCandidate: pathCandidate, testPathCandidate: "apps/vscode/src/product-view.test.ts", sourceSymbolCandidate: "ProductView", testSymbolCandidate: "ProductView tests",
      testKind: "unit", frameworkCandidate: "vitest", fixtureCandidates: ["bounded Product Studio projection"], oracleCandidates: ["renders privacy-safe test target metadata"],
      coverageTraceCandidates: ["coverage.product-view"], riskTraceCandidates: ["risk.stale-binding"], expectedOutputCandidates: ["deterministic test candidate"],
      evidenceReferences: evidence, conflictReferenceCandidates: [], state: "candidate-defined", sourceInspectionState: "not-performed", generationState: "not-performed",
      testExecutionState: "not-performed", testResultState: "not-established", coverageTruthState: "not-established", qualityState: "not-established", acceptanceState: "not-established" }],
    evidenceReferences: evidence, preconditions: ["Exact current change, generation, trace, acceptance, methodology and inventory candidates must be revalidated before generation"],
    unresolvedQuestions: [], limitations: ["Test candidates do not establish source, generated test, execution, result, coverage or quality truth"], reviewState: "ready-for-human-review",
    plannedBy: { kind: "human", id: "planner" }, plannedAt: "2026-08-01T01:00:00.000Z", repositoryTruthState: "not-established", sourceTruthState: "not-established",
    testAssetTruthState: "not-established", generationState: "not-performed", sourceMutationState: "not-performed", testExecutionState: "not-performed",
    testResultState: "not-established", coverageTruthState: "not-established", qualityState: "not-established", approvalState: "not-established", acceptanceState: "not-established",
    nativeHostAcceptanceState: "not-established", liveProviderAcceptanceState: "not-established", securityAcceptanceState: "not-established", releaseReadinessState: "not-established",
    deploymentReadinessState: "not-established", actionAuthorityState: "not-granted" }
  const readers = Object.fromEntries(Object.entries(dependencies).map(([key, value]) => [key, { readCurrent: async () => value }]))
  return { repository, product, initiative, dependencies, input, service: new TestGenerationService(repository as unknown as GaepRepository, async () => product as never, async () => initiative as never, readers as never) }
}

describe("Test Generation lifecycle", () => {
  it("persists immutable exact test plans without generating files or claiming execution, results, quality, or acceptance", async () => {
    const { repository, service, input, initiative, dependencies } = fixture(), created = await service.create(input, "test-planner")
    const revised = await service.revise(created.id, 1, { ...input, title: "Reviewed test generation candidate" }, "test-planner")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created), generationState: "not-performed", testExecutionState: "not-performed", testResultState: "not-established" })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({ state: "candidate-defined", targetCount: 1, definedCount: 1, coverageGapCount: 0 })
    expect(await service.project(initiative.id)).toMatchObject({ candidate: { targets: [{ testPathCandidate: "apps/vscode/src/product-view.test.ts", frameworkCandidate: "vitest", fixtureCandidateCount: 1, oracleCandidateCount: 1 }] } })
    expect(repository.audits.at(-1)?.payload).toMatchObject({ targetCount: 1, generationState: "not-performed", testExecutionState: "not-performed", actionAuthorityState: "not-granted" })
    dependencies.testInventory.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", staleBindingCount: 1 })
  })
  it("fails closed on forged paths, missing trace continuity, conflicts, traversal, and secrets", async () => {
    const { service, input, dependencies } = fixture(), target = input.targets[0]!
    await expect(service.create({ ...input, targets: [{ ...target, sourcePathCandidate: "apps/vscode/src/forged.ts" }] }, "test-planner")).rejects.toThrow(/continuity/iu)
    await expect(service.create({ ...input, targets: [{ ...target, designTraceId: randomUUID() }] }, "test-planner")).rejects.toThrow(/missing/iu)
    dependencies.changeConflictDetection.subjects[0]!.findings[0]!.state = "conflict-candidate"
    await expect(service.create(input, "test-planner")).rejects.toThrow(/exact current|continuity/iu)
    expect(testGenerationInputSchema.safeParse({ ...input, targets: [{ ...target, testPathCandidate: "../escape.test.ts" }] }).success).toBe(false)
    expect(testGenerationInputSchema.safeParse({ ...input, limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false)
  })
})
