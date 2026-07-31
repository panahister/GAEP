import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import { applyDiscardFoundationInputSchema, type ApplyDiscardFoundationInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { ApplyDiscardFoundationService } from "./apply-discard-foundation.js"
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
  const evidence = [{ kind: "review" as const, sourceId: "apply-discard-review", revision: 1,
    digest: canonicalDigest({ reviewed: true }), evidenceState: "human-reviewed" as const }]
  const implementationUnitId = randomUUID(), changedUnitId = randomUUID(), changedPathId = randomUUID()
  const changedUnitInventory = { ...base(), units: [{ id: changedUnitId, implementationUnitId,
    pathCandidates: [{ id: changedPathId, pathCandidate: "apps/vscode/src/product-view.ts", requirementKeys: ["REQ-PRODUCT-1"], testAssetIds: [randomUUID()] }] }] }
  const previewUnitId = randomUUID(), previewPathId = randomUUID()
  const previewPath = { id: previewPathId, changedPathCandidateId: changedPathId, pathCandidate: "apps/vscode/src/product-view.ts" }
  const previewUnit = { id: previewUnitId, changedUnitCandidateId: changedUnitId, implementationUnitId, pathPreviews: [previewPath] }
  const proposedChangePreview = { ...base(), changedUnitInventory: reference(changedUnitInventory), previewUnits: [previewUnit] }
  const stagingPath = { id: randomUUID(), proposedPathPreviewId: previewPathId, pathCandidate: previewPath.pathCandidate }
  const stagingUnit = { id: randomUUID(), proposedPreviewUnitId: previewUnitId, implementationUnitId, pathCandidates: [stagingPath] }
  const stagingIdentity = { namespace: "gaep-managed-stage" as const, stageKey: "stage.product-view", generation: 2,
    scopeDigest: canonicalDigest({ path: previewPath.pathCandidate }) }
  const stagingWorkspace = { ...base(), proposedChangePreview: reference(proposedChangePreview), stagingIdentity, units: [stagingUnit] }
  const controlledPath = { stagingPathId: stagingPath.id, pathCandidate: stagingPath.pathCandidate, stagingPathDigest: canonicalDigest(stagingPath) }
  const controlledUnit = { stagingUnitId: stagingUnit.id, paths: [controlledPath] }
  const controlledCodexImplementation = { ...base(), proposedChangePreview: reference(proposedChangePreview),
    stagingWorkspace: reference(stagingWorkspace), units: [controlledUnit] }
  const controlledClaudeImplementation = { ...base(), proposedChangePreview: reference(proposedChangePreview),
    stagingWorkspace: reference(stagingWorkspace), units: [controlledUnit] }
  const backlogTraceId = randomUUID()
  const backlogToCodeTraceability = { ...base(), dependencies: { changedUnitInventory: reference(changedUnitInventory),
    proposedChangePreview: reference(proposedChangePreview) }, traces: [{ id: backlogTraceId, traceKey: "trace.product-view",
    changedUnitId, changedPathId, implementationUnitId, pathCandidate: stagingPath.pathCandidate }] }
  const dependencies = { changedUnitInventory, proposedChangePreview, stagingWorkspace, controlledCodexImplementation,
    controlledClaudeImplementation, backlogToCodeTraceability }
  const input: ApplyDiscardFoundationInput = {
    initiativeId: initiative.id, context, informationClassification: "internal", title: "Apply the exact staged candidate",
    dependencies: Object.fromEntries(Object.entries(dependencies).map(([key, value]) => [key, reference(value)])) as ApplyDiscardFoundationInput["dependencies"],
    stageIdentity: stagingIdentity, decision: "apply-entire-stage-candidate", decisionActor: { kind: "human", id: "reviewer" },
    decidedAt: "2026-07-31T20:45:00.000Z", paths: [{ id: randomUUID(), ordinal: 1, decisionPathKey: "path.product-view",
      changedUnitId, changedPathId, proposedPreviewUnitId: previewUnitId, proposedPreviewPathId: previewPathId,
      stagingUnitId: stagingUnit.id, stagingPathId: stagingPath.id, backlogTraceId, backlogTraceKey: "trace.product-view",
      implementationUnitId, pathCandidate: stagingPath.pathCandidate, stagingPathDigest: canonicalDigest(stagingPath),
      disposition: "apply-candidate", scopeState: "candidate-exact", evidenceReferences: evidence,
      conflictReferenceCandidates: [], sourceMutationState: "not-performed", applyState: "not-performed",
      discardState: "not-performed", outcomeTruthState: "not-established" }],
    recovery: { strategy: "write-ahead-journal-candidate", journalKey: "journal.product-view", stageGeneration: 2,
      checkpointDigest: canonicalDigest({ stagingIdentity }), staleStageRejectionState: "candidate-defined",
      scopeConfinementState: "candidate-defined", atomicityState: "candidate-defined", rollbackState: "candidate-defined",
      recoveryExecutionState: "not-performed", evidenceReferences: evidence },
    preconditions: ["Exact stage generation and path inventory must be revalidated before any effect"], unresolvedQuestions: [],
    limitations: ["Candidate decision metadata does not establish any source effect"], reviewState: "ready-for-human-review",
    actualStageExistenceState: "not-established", repositoryTruthState: "not-established", sourceTruthState: "not-established",
    approvalState: "not-established", authorizationState: "not-established", sourceMutationState: "not-performed",
    applyState: "not-performed", discardState: "not-performed", recoveryExecutionState: "not-performed",
    outcomeTruthState: "not-established", acceptanceState: "not-established", nativeHostAcceptanceState: "not-established",
    liveProviderAcceptanceState: "not-established", securityAcceptanceState: "not-established",
    releaseReadinessState: "not-established", deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
  }
  const readers = Object.fromEntries(Object.entries(dependencies).map(([key, value]) => [key, { readCurrent: async () => value }]))
  const service = new ApplyDiscardFoundationService(repository as unknown as GaepRepository, async () => product as never,
    async () => initiative as never, readers as never)
  return { repository, service, input, initiative, dependencies }
}

describe("Apply/Discard Foundation lifecycle", () => {
  it("persists immutable whole-stage decision metadata without performing a source effect", async () => {
    const { repository, service, input, initiative, dependencies } = fixture()
    const created = await service.create(input, "decision-author")
    const revised = await service.revise(created.id, 1, { ...input, title: "Reviewed apply decision candidate" }, "decision-author")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created), sourceMutationState: "not-performed",
      applyState: "not-performed", discardState: "not-performed", actionAuthorityState: "not-granted" })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({ state: "candidate-defined", pathCount: 1,
      applyCandidateCount: 1, exactScopeCount: 1, staleBindingCount: 0, coverageGapCount: 0 })
    expect(await service.project(initiative.id)).toMatchObject({ candidate: { decision: "apply-entire-stage-candidate",
      stageIdentity: { generation: 2 }, paths: [{ pathCandidate: "apps/vscode/src/product-view.ts", disposition: "apply-candidate" }] } })
    expect(repository.audits.at(-1)?.payload).toMatchObject({ decision: "apply-entire-stage-candidate", pathCount: 1,
      sourceMutationState: "not-performed", actionAuthorityState: "not-granted" })
    dependencies.stagingWorkspace.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", staleBindingCount: 1 })
  })

  it("fails closed on forged stage, changed path, plan scope, generation, conflict, traversal, and secrets", async () => {
    const { service, input } = fixture(), path = input.paths[0]!
    await expect(service.create({ ...input, paths: [{ ...path, backlogTraceKey: "trace.forged" }] }, "decision-author")).rejects.toThrow(/continuity/iu)
    await expect(service.create({ ...input, paths: [{ ...path, stagingPathDigest: canonicalDigest({ forged: true }) }] }, "decision-author")).rejects.toThrow(/continuity/iu)
    expect(applyDiscardFoundationInputSchema.safeParse({ ...input, paths: [{ ...path, pathCandidate: "../escape.ts" }] }).success).toBe(false)
    expect(applyDiscardFoundationInputSchema.safeParse({ ...input, recovery: { ...input.recovery, stageGeneration: 99 } }).success).toBe(false)
    expect(applyDiscardFoundationInputSchema.safeParse({ ...input, limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false)
  })
})
