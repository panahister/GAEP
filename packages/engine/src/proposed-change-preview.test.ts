import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import type { ProposedChangePreviewInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { ProposedChangePreviewService } from "./proposed-change-preview.js"
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

function fixture() {
  const repository = new MemoryRepository()
  const product = { id: randomUUID(), revision: 1 }
  const initiative = { id: randomUUID(), revision: 1, productId: product.id, state: "active" as const }
  const unitId = randomUUID(), inventoryUnitId = randomUUID(), pathId = randomUUID()
  const evidence = { kind: "evidence" as const, sourceId: "preview-review", revision: 1, digest: canonicalDigest({ evidence: true }), evidenceState: "human-reviewed" as const }
  const sourcePath = { id: pathId, ordinal: 1, pathCandidate: "packages/example/src/index.ts", changeKind: "modify" as const,
    backlogNodeIds: [randomUUID()], requirementKeys: ["REQ-1"], designToCodeBindingSubjectIds: [randomUUID()],
    routeScreenComponentSubjectIds: [randomUUID()], testAssetIds: [randomUUID()], riskKeys: ["risk-a"], evidenceReferences: [evidence] }
  const inventory = { id: randomUUID(), revision: 1, initiativeId: initiative.id, units: [{ id: inventoryUnitId, ordinal: 1,
    implementationUnitId: unitId, implementationUnitKey: "unit-a", repositoryCandidate: "gaep", moduleCandidate: "packages/example",
    pathCandidates: [sourcePath], dependencyUnitIds: [], directBlastRadiusUnitIds: [], indirectBlastRadiusUnitIds: [],
    affectedSurfaceKeys: ["surface-a"], blastRadiusAssessmentState: "candidate-assessed", ownerCandidateIds: ["owner"],
    reviewCandidateIds: ["reviewer"], evidenceReferences: [evidence], outcome: "candidate-scoped" }] }
  const inventoryReader = { readCurrent: async () => inventory }
  const service = new ProposedChangePreviewService(repository as unknown as GaepRepository, async () => product as never,
    async () => initiative as never, inventoryReader as never)
  const digest = canonicalDigest({ content: true }), traceDigest = canonicalDigest({ changedPathCandidateId: sourcePath.id,
    backlogNodeIds: sourcePath.backlogNodeIds, requirementKeys: sourcePath.requirementKeys,
    designToCodeBindingSubjectIds: sourcePath.designToCodeBindingSubjectIds,
    routeScreenComponentSubjectIds: sourcePath.routeScreenComponentSubjectIds, testAssetIds: sourcePath.testAssetIds, riskKeys: sourcePath.riskKeys })
  const input: ProposedChangePreviewInput = {
    initiativeId: initiative.id, context: { productRevision: 1, productDigest: canonicalDigest(product), initiativeRevision: 1, initiativeDigest: canonicalDigest(initiative) },
    informationClassification: "internal", title: "Proposed change preview candidate",
    changedUnitInventory: { recordId: inventory.id, revision: inventory.revision, digest: canonicalDigest(inventory) },
    previewUnits: [{ id: randomUUID(), ordinal: 1, changedUnitCandidateId: inventoryUnitId, implementationUnitId: unitId, implementationUnitKey: "unit-a",
      dependencyUnitIds: [], directBlastRadiusUnitIds: [], indirectBlastRadiusUnitIds: [], evidenceReferences: [evidence], outcome: "candidate-previewed",
      pathPreviews: [{ id: randomUUID(), ordinal: 1, changedPathCandidateId: pathId, pathCandidate: sourcePath.pathCandidate, changeKind: "modify",
        source: { state: "candidate-observed", digest, bytes: 100 }, target: { state: "candidate-generated", digest, bytes: 120 },
        diff: { state: "candidate-generated", format: "unified-text-metadata", patchDigest: digest, addedLineCount: 3, removedLineCount: 1, truncated: false },
        planOperations: ["replace", "verify"], traceDigest, evidenceReferences: [evidence], outcome: "candidate-previewed" }] }],
    unresolvedQuestions: [], limitations: ["Source and target metadata require repository verification"], reviewState: "ready-for-human-review",
    repositoryTruthState: "not-established", pathTruthState: "not-established", sourceObservationTruthState: "not-established",
    targetProposalTruthState: "not-established", diffTruthState: "not-established", changeScopeApprovalState: "not-established",
    changeApprovalState: "not-established", codeMutationState: "not-performed", stagingState: "not-performed", applyDiscardState: "not-performed",
    assignmentExecutionState: "not-established", acceptanceDecisionState: "not-established", mergeReadinessState: "not-established",
    releaseReadinessState: "not-established", deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
  }
  return { repository, service, input, initiative, inventory, sourcePath }
}

describe("Proposed Change Preview engine lifecycle", () => {
  it("persists immutable preview receipts and exposes metadata without content or authority", async () => {
    const { repository, service, input, initiative, inventory } = fixture()
    const created = await service.create(input, "preview-author")
    const revised = await service.revise(created.id, 1, { ...input, title: "Reviewed proposed change preview" }, "preview-author")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created), diffTruthState: "not-established", stagingState: "not-performed", actionAuthorityState: "not-granted" })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({ state: "candidate-previewed", inventoryUnitCount: 1, previewUnitCount: 1, inventoryPathCount: 1, previewPathCount: 1 })
    const projection = await service.project(initiative.id)
    expect(projection.candidate?.units[0]?.paths[0]).toMatchObject({ pathCandidate: "packages/example/src/index.ts", changeKind: "modify", sourceState: "candidate-observed", targetState: "candidate-generated", diffState: "candidate-generated" })
    expect(JSON.stringify(projection)).not.toContain("preview-author")
    expect(repository.audits.at(-1)?.payload).toMatchObject({ unitCount: 1, pathCount: 1, diffTruthState: "not-established", stagingState: "not-performed", actionAuthorityState: "not-granted" })
    inventory.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", staleInventoryCount: 1 })
  })

  it("fails closed when a preview path does not bind the exact inventory trace", async () => {
    const { service, input } = fixture()
    await expect(service.create({ ...input, previewUnits: input.previewUnits.map((unit) => ({ ...unit,
      pathPreviews: unit.pathPreviews.map((path) => ({ ...path, traceDigest: canonicalDigest({ wrong: true }) })) })) }, "preview-author"))
      .rejects.toThrow(/trace digest/iu)
  })
})
