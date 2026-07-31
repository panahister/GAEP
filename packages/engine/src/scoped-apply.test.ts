import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import { scopedApplyInputSchema, type ScopedApplyInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import type { GaepRepository } from "./repository.js"
import { ScopedApplyService } from "./scoped-apply.js"

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
  const evidence = [{ kind: "review" as const, sourceId: "scoped-apply-review", revision: 1, digest: canonicalDigest({ reviewed: true }), evidenceState: "human-reviewed" as const }]
  const implementationUnitId = randomUUID(), changedUnitId = randomUUID()
  const changedPaths = ["apps/vscode/src/product-view.ts", "apps/vscode/src/product-view.test.ts"].map((pathCandidate) => ({ id: randomUUID(), pathCandidate }))
  const changedUnitInventory = { ...base(), units: [{ id: changedUnitId, implementationUnitId, pathCandidates: changedPaths }] }
  const previewUnitId = randomUUID(), previewPaths = changedPaths.map((path) => ({ id: randomUUID(), changedPathCandidateId: path.id, pathCandidate: path.pathCandidate }))
  const proposedChangePreview = { ...base(), changedUnitInventory: reference(changedUnitInventory),
    previewUnits: [{ id: previewUnitId, changedUnitCandidateId: changedUnitId, implementationUnitId, pathPreviews: previewPaths }] }
  const stageIdentity = { namespace: "gaep-managed-stage" as const, stageKey: "stage.product-view", generation: 2, scopeDigest: canonicalDigest({ paths: changedPaths }) }
  const stagingUnitId = randomUUID(), stagingPaths = previewPaths.map((path) => ({ id: randomUUID(), proposedPathPreviewId: path.id, pathCandidate: path.pathCandidate }))
  const stagingWorkspace = { ...base(), proposedChangePreview: reference(proposedChangePreview), stagingIdentity: stageIdentity,
    units: [{ id: stagingUnitId, proposedPreviewUnitId: previewUnitId, implementationUnitId, pathCandidates: stagingPaths }] }
  const controlledCodexImplementation = { ...base(), proposedChangePreview: reference(proposedChangePreview), stagingWorkspace: reference(stagingWorkspace),
    resourceScopes: changedPaths.map((path) => path.pathCandidate), units: [{ stagingUnitId, paths: stagingPaths.map((path) => ({ stagingPathId: path.id,
      pathCandidate: path.pathCandidate, stagingPathDigest: canonicalDigest(path) })) }] }
  const traces = changedPaths.map((path) => ({ id: randomUUID(), traceKey: `trace.${path.pathCandidate.endsWith("test.ts") ? "product-test" : "product-view"}`,
    changedUnitId, changedPathId: path.id, implementationUnitId, pathCandidate: path.pathCandidate }))
  const backlogToCodeTraceability = { ...base(), dependencies: { changedUnitInventory: reference(changedUnitInventory), proposedChangePreview: reference(proposedChangePreview) }, traces }
  const foundationPaths = stagingPaths.map((path, index) => ({ id: randomUUID(), stagingUnitId, stagingPathId: path.id, changedUnitId,
    changedPathId: changedPaths[index]!.id, backlogTraceId: traces[index]!.id, pathCandidate: path.pathCandidate,
    stagingPathDigest: canonicalDigest(path), disposition: "apply-candidate" as const }))
  const applyDiscardFoundation = { ...base(), dependencies: { changedUnitInventory: reference(changedUnitInventory),
    proposedChangePreview: reference(proposedChangePreview), stagingWorkspace: reference(stagingWorkspace),
    controlledCodexImplementation: reference(controlledCodexImplementation), backlogToCodeTraceability: reference(backlogToCodeTraceability) },
    stageIdentity, decision: "apply-entire-stage-candidate" as const, paths: foundationPaths }
  const dependencies = { changedUnitInventory, proposedChangePreview, stagingWorkspace, controlledCodexImplementation, backlogToCodeTraceability, applyDiscardFoundation }
  const selectedPath = { id: randomUUID(), ordinal: 1, selectionKey: "select.product-view", decisionPathId: foundationPaths[0]!.id,
    stagingPathId: stagingPaths[0]!.id, changedPathId: changedPaths[0]!.id, backlogTraceId: traces[0]!.id,
    pathCandidate: changedPaths[0]!.pathCandidate, stagingPathDigest: canonicalDigest(stagingPaths[0]), evidenceReferences: evidence,
    writeEnvelopeCandidate: changedPaths[0]!.pathCandidate, scopeState: "candidate-exact" as const, sourceMutationState: "not-performed" as const,
    applyState: "not-performed" as const, outcomeTruthState: "not-established" as const }
  const excludedPath = { id: randomUUID(), exclusionKey: "exclude.product-test", decisionPathId: foundationPaths[1]!.id,
    stagingPathId: stagingPaths[1]!.id, changedPathId: changedPaths[1]!.id, backlogTraceId: traces[1]!.id,
    pathCandidate: changedPaths[1]!.pathCandidate, stagingPathDigest: canonicalDigest(stagingPaths[1]), evidenceReferences: evidence,
    reason: "Excluded from this bounded subset candidate", disposition: "excluded-from-scoped-apply" as const, discardState: "not-performed" as const }
  const input: ScopedApplyInput = { initiativeId: initiative.id, context, informationClassification: "internal", title: "Scoped apply subset candidate",
    dependencies: Object.fromEntries(Object.entries(dependencies).map(([key, value]) => [key, reference(value)])) as ScopedApplyInput["dependencies"],
    stageIdentity, selectionActor: { kind: "human", id: "reviewer" }, selectedAt: "2026-08-01T00:10:00.000Z",
    selectedPaths: [selectedPath], excludedPaths: [excludedPath], writeEnvelopeCandidates: [selectedPath.pathCandidate],
    recovery: { strategy: "write-ahead-journal-candidate", journalKey: "journal.product-view", stageGeneration: 2,
      checkpointDigest: canonicalDigest({ stageIdentity }), staleStageRejectionState: "candidate-defined", scopeConfinementState: "candidate-defined",
      atomicityState: "candidate-defined", rollbackState: "candidate-defined", recoveryExecutionState: "not-performed", evidenceReferences: evidence },
    preconditions: ["Exact selected and excluded stage paths must be revalidated before any effect"], unresolvedQuestions: [],
    limitations: ["This subset candidate does not mutate source or execute apply"], reviewState: "ready-for-human-review",
    stageTruthState: "not-established", repositoryTruthState: "not-established", sourceTruthState: "not-established",
    approvalState: "not-established", authorizationState: "not-established", sourceMutationState: "not-performed", applyState: "not-performed",
    wholeStageDiscardState: "not-performed", recoveryExecutionState: "not-performed", outcomeTruthState: "not-established",
    acceptanceState: "not-established", nativeHostAcceptanceState: "not-established", liveProviderAcceptanceState: "not-established",
    securityAcceptanceState: "not-established", releaseReadinessState: "not-established", deploymentReadinessState: "not-established", actionAuthorityState: "not-granted" }
  const readers = Object.fromEntries(Object.entries(dependencies).map(([key, value]) => [key, { readCurrent: async () => value }]))
  const service = new ScopedApplyService(repository as unknown as GaepRepository, async () => product as never, async () => initiative as never, readers as never)
  return { repository, service, input, initiative, dependencies }
}

describe("Scoped Apply lifecycle", () => {
  it("persists an immutable exact subset partition while every source effect remains unperformed", async () => {
    const { repository, service, input, initiative, dependencies } = fixture()
    const created = await service.create(input, "scope-author")
    const revised = await service.revise(created.id, 1, { ...input, title: "Reviewed scoped apply candidate" }, "scope-author")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created), sourceMutationState: "not-performed", applyState: "not-performed", wholeStageDiscardState: "not-performed" })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({ state: "candidate-defined", stagePathCount: 2, selectedPathCount: 1, excludedPathCount: 1, exactScopeCount: 1, coverageGapCount: 0 })
    expect(await service.project(initiative.id)).toMatchObject({ candidate: { stageIdentity: { generation: 2 }, selectedPaths: [{ pathCandidate: "apps/vscode/src/product-view.ts" }], excludedPaths: [{ pathCandidate: "apps/vscode/src/product-view.test.ts" }] } })
    expect(repository.audits.at(-1)?.payload).toMatchObject({ selectedPathCount: 1, excludedPathCount: 1, sourceMutationState: "not-performed", actionAuthorityState: "not-granted" })
    dependencies.stagingWorkspace.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", staleBindingCount: 1 })
  })
  it("fails closed on forged partitions, foundation decisions, stage digests, envelopes, traversal, and secrets", async () => {
    const { service, input, dependencies } = fixture(), selected = input.selectedPaths[0]!
    await expect(service.create({ ...input, selectedPaths: [{ ...selected, backlogTraceId: randomUUID() }] }, "scope-author")).rejects.toThrow(/missing|continuity/iu)
    dependencies.applyDiscardFoundation.decision = "discard-entire-stage-candidate" as never
    await expect(service.create(input, "scope-author")).rejects.toThrow(/exact current applyDiscardFoundation|discard remains distinct/iu)
    expect(scopedApplyInputSchema.safeParse({ ...input, selectedPaths: [{ ...selected, pathCandidate: "../escape.ts" }] }).success).toBe(false)
    expect(scopedApplyInputSchema.safeParse({ ...input, writeEnvelopeCandidates: ["apps/vscode/src/other.ts"] }).success).toBe(false)
    expect(scopedApplyInputSchema.safeParse({ ...input, limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false)
  })
})
