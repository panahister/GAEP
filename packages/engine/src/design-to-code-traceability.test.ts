import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import { designToCodeTraceabilityInputSchema, type DesignToCodeTraceabilityInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { DesignToCodeTraceabilityService } from "./design-to-code-traceability.js"
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

function reference(record: { id: string; revision: number }) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function fixture() {
  const repository = new MemoryRepository()
  const product = { id: randomUUID(), revision: 1 }
  const initiative = { id: randomUUID(), revision: 1, productId: product.id, state: "active" as const }
  const context = { productRevision: 1, productDigest: canonicalDigest(product), initiativeRevision: 1, initiativeDigest: canonicalDigest(initiative) }
  const base = () => ({ id: randomUUID(), revision: 1, productId: product.id, initiativeId: initiative.id, context })
  const requirement = { recordId: randomUUID(), revision: 1, digest: canonicalDigest({ requirement: true }), key: "REQ-1" }
  const epicId = randomUUID(), featureId = randomUUID(), storyId = randomUUID(), taskId = randomUUID()
  const backlogHierarchy = { ...base(), nodes: [
    { id: epicId, key: "epic-product", level: "epic", requirements: [] },
    { id: featureId, key: "feature-product-view", level: "feature", requirements: [], parentId: epicId },
    { id: storyId, key: "story-product-view", level: "story", requirements: [requirement], parentId: featureId },
    { id: taskId, key: "task-product-view", level: "task", requirements: [requirement], parentId: storyId },
  ] }
  const criterionId = randomUUID()
  const acceptanceCriteria = { ...base(), hierarchy: reference(backlogHierarchy), criteria: [
    { id: criterionId, key: "ac-product-view", subjectNodeId: taskId, requirements: [requirement] },
  ] }
  const implementationUnitId = randomUUID()
  const implementationUnitModel = { ...base(), hierarchy: reference(backlogHierarchy), acceptanceCriteria: reference(acceptanceCriteria), units: [
    { id: implementationUnitId, key: "product-view", requirementReferences: [requirement] },
  ] }
  const designBaseline = { ...base(), membershipDigest: canonicalDigest({ baseline: "membership" }), semanticVersion: "1.0.0" }
  const designBindingKey = "binding.product-view", designItemKey = "figma.product-view"
  const designToRequirementBinding = { ...base(), bindings: [
    { key: designBindingKey, designItemKey, designItemKind: "component", requirementKeys: ["REQ-1"] },
  ] }
  const mappingSubjectId = randomUUID()
  const figmaToBoilerplateMapping = { ...base(), subjects: [
    { id: mappingSubjectId, designBindingKey, designItemKey, implementationUnitId },
  ] }
  const bindingSubjectId = randomUUID()
  const designToCodeBindingRegistry = {
    ...base(), figmaToBoilerplateMapping: reference(figmaToBoilerplateMapping), implementationUnitModel: reference(implementationUnitModel),
    subjects: [{ id: bindingSubjectId, mappingSubjectId, designBindingKey, designItemKey, designItemKind: "component",
      disposition: "candidate-bound", implementationUnitId, requirementKeys: ["REQ-1"], repositoryCandidate: "gaep-web",
      moduleCandidate: "product-studio", pathCandidate: "src/generated/product-view.tsx", symbolCandidate: "ProductView" }],
  }
  const routeScreenComponentMapping = { ...base(), acceptanceCriteria: reference(acceptanceCriteria),
    implementationUnitModel: reference(implementationUnitModel), subjects: [] }
  const pathPreviewId = randomUUID()
  const proposedChangePreview = { ...base(), previewUnits: [{ id: randomUUID(), implementationUnitId,
    pathPreviews: [{ id: pathPreviewId, pathCandidate: "src/generated/product-view.tsx" }] }] }
  const testAssetId = randomUUID()
  const testInventory = { ...base(), acceptanceCriteria: reference(acceptanceCriteria),
    implementationUnitModel: reference(implementationUnitModel), routeScreenComponentMapping: reference(routeScreenComponentMapping),
    assets: [{ id: testAssetId, key: "test.product-view", disposition: "candidate-cataloged",
      implementationUnitIds: [implementationUnitId], requirementKeys: ["REQ-1"], acceptanceCriterionIds: [criterionId] }] }
  const approvedFigmaContextRetrieval = { ...base(), dependencies: { designBaseline: reference(designBaseline),
    designToRequirementBinding: reference(designToRequirementBinding), designToCodeBindingRegistry: reference(designToCodeBindingRegistry),
    routeScreenComponentMapping: reference(routeScreenComponentMapping) },
    approvedSnapshot: { returnedExternalVersionDigest: canonicalDigest({ figma: "version-1" }) } }
  const targetId = randomUUID()
  const controlledDesignToCodeGeneration = { ...base(), dependencies: {
    approvedFigmaContextRetrieval: reference(approvedFigmaContextRetrieval), designBaseline: reference(designBaseline),
    designToRequirementBinding: reference(designToRequirementBinding), figmaToBoilerplateMapping: reference(figmaToBoilerplateMapping),
    designToCodeBindingRegistry: reference(designToCodeBindingRegistry), routeScreenComponentMapping: reference(routeScreenComponentMapping),
    implementationUnitModel: reference(implementationUnitModel), proposedChangePreview: reference(proposedChangePreview),
  }, targets: [{ id: targetId, targetKey: "product-view", designToCodeBindingSubjectId: bindingSubjectId,
    implementationUnitId, repositoryCandidate: "gaep-web", moduleCandidate: "product-studio",
    pathCandidate: "src/generated/product-view.tsx", expectedTestOutputs: ["Product view component test passes"] }] }
  const dependencies = { controlledDesignToCodeGeneration, approvedFigmaContextRetrieval, designBaseline,
    designToRequirementBinding, figmaToBoilerplateMapping, designToCodeBindingRegistry, routeScreenComponentMapping,
    backlogHierarchy, acceptanceCriteria, implementationUnitModel, proposedChangePreview, testInventory }
  const evidence = [{ kind: "evidence" as const, sourceId: "trace-review", revision: 1,
    digest: canonicalDigest({ trace: true }), evidenceState: "human-reviewed" as const }]
  const input: DesignToCodeTraceabilityInput = {
    initiativeId: initiative.id, context, informationClassification: "internal", title: "Design-to-code traceability candidate",
    dependencies: Object.fromEntries(Object.entries(dependencies).map(([key, value]) => [key, reference(value)])) as DesignToCodeTraceabilityInput["dependencies"],
    traces: [{ id: randomUUID(), ordinal: 1, traceKey: "trace.product-view", generationTargetId: targetId,
      generationTargetKey: "product-view", designToCodeBindingSubjectId: bindingSubjectId, designBindingKey, designItemKey,
      designItemKind: "component", approvedExternalVersionDigest: approvedFigmaContextRetrieval.approvedSnapshot.returnedExternalVersionDigest,
      baselineSemanticVersion: designBaseline.semanticVersion, requirementKeys: ["REQ-1"], backlogNodeIds: [taskId],
      backlogNodeKeys: ["task-product-view"], acceptanceCriterionIds: [criterionId], acceptanceCriterionKeys: ["ac-product-view"],
      implementationUnitId, repositoryCandidate: "gaep-web", moduleCandidate: "product-studio",
      pathCandidate: "src/generated/product-view.tsx", symbolCandidate: "ProductView",
      expectedTestOutputs: ["Product view component test passes"], associatedTestAssetIds: [testAssetId],
      associatedTestAssetKeys: ["test.product-view"], evidenceReferences: evidence, conflictReferenceCandidates: [],
      traceState: "candidate-linked", repositoryTruthState: "not-established", pathSymbolTruthState: "not-established",
      generatedOutputTruthState: "not-established", testExecutionState: "not-performed", testResultState: "not-established",
      acceptanceState: "not-established" }],
    unresolvedQuestions: [], limitations: ["This candidate does not establish repository, output, test-result, approval, or acceptance truth"],
    reviewState: "ready-for-human-review", designContentState: "not-materialized", repositoryTruthState: "not-established",
    sourceTruthState: "not-established", pathSymbolTruthState: "not-established", generatedOutputTruthState: "not-established",
    testExecutionState: "not-performed", testResultState: "not-established", traceCompletenessState: "not-established",
    approvalState: "not-established", acceptanceState: "not-established", nativeHostAcceptanceState: "not-established",
    liveProviderAcceptanceState: "not-established", securityAcceptanceState: "not-established",
    releaseReadinessState: "not-established", deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
  }
  const readers = Object.fromEntries(Object.entries(dependencies).map(([key, value]) => [key, { readCurrent: async () => value }]))
  const service = new DesignToCodeTraceabilityService(repository as unknown as GaepRepository, async () => product as never,
    async () => initiative as never, readers as never)
  return { repository, service, input, initiative, dependencies }
}

describe("Design-to-Code Traceability lifecycle", () => {
  it("persists immutable approved-design-to-test candidate continuity without claiming implementation truth", async () => {
    const { repository, service, input, initiative, dependencies } = fixture()
    const created = await service.create(input, "trace-author")
    const revised = await service.revise(created.id, 1, { ...input, title: "Reviewed design-to-code traceability" }, "trace-author")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created), traces: [{ traceState: "candidate-linked",
      repositoryTruthState: "not-established", generatedOutputTruthState: "not-established", testExecutionState: "not-performed" }] })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({ state: "candidate-defined", traceCount: 1,
      generationTargetCount: 1, requirementCount: 1, backlogNodeCount: 1, acceptanceCriterionCount: 1,
      implementationUnitCount: 1, codePathCount: 1, associatedTestCount: 1, linkedCount: 1,
      gapCount: 0, conflictCount: 0, staleTraceCount: 0, staleBindingCount: 0, coverageGapCount: 0 })
    const projection = await service.project(initiative.id)
    expect(projection).toMatchObject({ candidate: { baselineSemanticVersion: "1.0.0", traces: [{ traceKey: "trace.product-view",
      pathCandidate: "src/generated/product-view.tsx", associatedTestAssetKeys: ["test.product-view"] }] } })
    expect(JSON.stringify(projection)).not.toContain("Product view component test passes")
    expect(repository.audits.at(-1)?.payload).toMatchObject({ traceCount: 1, linkedCount: 1, actionAuthorityState: "not-granted" })
    dependencies.designBaseline.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", staleBindingCount: 1 })
  })

  it("fails closed on forged code, test, target, path, conflict, and secret-shaped trace metadata", async () => {
    const { service, input } = fixture()
    await expect(service.create({ ...input, traces: [{ ...input.traces[0]!, associatedTestAssetKeys: ["test.forged"] }] }, "trace-author")).rejects.toThrow(/test|continuity/iu)
    await expect(service.create({ ...input, traces: [{ ...input.traces[0]!, generationTargetKey: "forged-target" }] }, "trace-author")).rejects.toThrow(/generation target|continuity/iu)
    expect(designToCodeTraceabilityInputSchema.safeParse({ ...input, traces: [{ ...input.traces[0]!, pathCandidate: "../escape.ts" }] }).success).toBe(false)
    expect(designToCodeTraceabilityInputSchema.safeParse({ ...input, traces: [{ ...input.traces[0]!, traceState: "conflict", conflictReferenceCandidates: [] }] }).success).toBe(false)
    expect(designToCodeTraceabilityInputSchema.safeParse({ ...input, limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false)
  })
})
