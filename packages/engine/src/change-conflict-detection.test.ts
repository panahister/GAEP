import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import { changeConflictDetectionInputSchema, type ChangeConflictDetectionInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { ChangeConflictDetectionService } from "./change-conflict-detection.js"
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
  const evidence = [{ kind: "review" as const, sourceId: "change-conflict-review", revision: 1, digest: canonicalDigest({ reviewed: true }), evidenceState: "human-reviewed" as const }]
  const changedUnitId = randomUUID(), changedPath = { id: randomUUID(), pathCandidate: "apps/vscode/src/product-view.ts" }
  const changedUnitInventory = { ...base(), units: [{ id: changedUnitId, pathCandidates: [changedPath] }] }
  const previewPath = { id: randomUUID(), changedPathCandidateId: changedPath.id, pathCandidate: changedPath.pathCandidate,
    source: { state: "candidate-observed", digest: canonicalDigest({ source: true }), bytes: 12 },
    target: { state: "candidate-generated", digest: canonicalDigest({ target: true }), bytes: 18 } }
  const proposedChangePreview = { ...base(), changedUnitInventory: reference(changedUnitInventory), previewUnits: [{ id: randomUUID(), changedUnitCandidateId: changedUnitId, pathPreviews: [previewPath] }] }
  const stageIdentity = { namespace: "gaep-managed-stage" as const, stageKey: "stage.product-view", generation: 3, scopeDigest: canonicalDigest({ scope: true }) }
  const stagingPath = { id: randomUUID(), proposedPathPreviewId: previewPath.id, pathCandidate: changedPath.pathCandidate }
  const stagingWorkspace = { ...base(), proposedChangePreview: reference(proposedChangePreview), stagingIdentity: stageIdentity, units: [{ id: randomUUID(), pathCandidates: [stagingPath] }] }
  const providerHandoffDigest = canonicalDigest({ provider: "handoff" })
  const providerSwitchImplementation = { ...base(), proposedChangePreview: reference(proposedChangePreview), stagingWorkspace: reference(stagingWorkspace),
    units: [{ paths: [{ stagingPathId: stagingPath.id, pathCandidate: stagingPath.pathCandidate }] }], handoff: { handoffReceiptDigest: providerHandoffDigest } }
  const modelTransitionDigest = canonicalDigest({ model: "transition" })
  const modelSwitchImplementation = { ...base(), proposedChangePreview: reference(proposedChangePreview), stagingWorkspace: reference(stagingWorkspace),
    providerSwitchImplementation: reference(providerSwitchImplementation), transition: { transitionReceiptDigest: modelTransitionDigest } }
  const foundationPath = { id: randomUUID(), stagingPathId: stagingPath.id, pathCandidate: stagingPath.pathCandidate }
  const applyDiscardFoundation = { ...base(), dependencies: { changedUnitInventory: reference(changedUnitInventory), proposedChangePreview: reference(proposedChangePreview),
    stagingWorkspace: reference(stagingWorkspace) }, stageIdentity, paths: [foundationPath] }
  const selectedPath = { id: randomUUID(), changedPathId: changedPath.id, stagingPathId: stagingPath.id, pathCandidate: stagingPath.pathCandidate }
  const scopedApply = { ...base(), dependencies: { stagingWorkspace: reference(stagingWorkspace), applyDiscardFoundation: reference(applyDiscardFoundation) }, stageIdentity, selectedPaths: [selectedPath] }
  const recoverySubject = { id: randomUUID(), scopedApplySelectedPathId: selectedPath.id, stagingPathId: stagingPath.id, pathCandidate: stagingPath.pathCandidate }
  const rollbackRecovery = { ...base(), dependencies: { stagingWorkspace: reference(stagingWorkspace), applyDiscardFoundation: reference(applyDiscardFoundation), scopedApply: reference(scopedApply) }, stageIdentity, subjects: [recoverySubject] }
  const dependencies = { changedUnitInventory, proposedChangePreview, stagingWorkspace, providerSwitchImplementation, modelSwitchImplementation, applyDiscardFoundation, scopedApply, rollbackRecovery }
  const refs = Object.fromEntries(Object.entries(dependencies).map(([key, value]) => [key, reference(value)])) as ChangeConflictDetectionInput["dependencies"]
  const findings = ["baseline-drift", "overlapping-stage", "provider-handoff", "stale-generation", "user-edit"].map((kind) => ({ kind,
    state: "no-conflict-candidate" as const, basisDigest: canonicalDigest({ kind, path: changedPath.pathCandidate }), evidenceReferences: evidence,
    resolutionState: "not-performed" as const, conflictTruthState: "not-established" as const })) as ChangeConflictDetectionInput["subjects"][number]["findings"]
  const input: ChangeConflictDetectionInput = { initiativeId: initiative.id, context, informationClassification: "internal", title: "Change conflict detection candidate",
    dependencies: refs, stageIdentity, subjects: [{ id: randomUUID(), ordinal: 1, subjectKey: "conflict.product-view", scopedApplySelectedPathId: selectedPath.id,
      changedPathId: changedPath.id, proposedPreviewPathId: previewPath.id, stagingPathId: stagingPath.id, rollbackRecoverySubjectId: recoverySubject.id,
      pathCandidate: changedPath.pathCandidate, baselineDigestCandidate: canonicalDigest(previewPath.source), stagedTargetDigestCandidate: canonicalDigest(previewPath.target),
      currentContentDigestCandidate: canonicalDigest({ bounded: "current-candidate" }), currentObservationState: "metadata-candidate",
      handoff: { providerSwitchId: providerSwitchImplementation.id, modelSwitchId: modelSwitchImplementation.id, providerHandoffReceiptDigest: providerHandoffDigest,
        modelTransitionReceiptDigest: modelTransitionDigest, observationState: "metadata-candidate" }, findings, evidenceReferences: evidence,
      sourceInspectionState: "not-performed", sourceMutationState: "not-performed", resolutionState: "not-performed", outcomeTruthState: "not-established" }],
    evidenceReferences: evidence, preconditions: ["Exact current endpoint, stage, selection, recovery and handoff candidates must be revalidated before any conflict decision"],
    unresolvedQuestions: [], limitations: ["No-conflict candidate metadata does not establish absence of user edits or baseline drift"], reviewState: "ready-for-human-review",
    assessedBy: { kind: "human", id: "reviewer" }, assessedAt: "2026-08-01T00:40:00.000Z", repositoryTruthState: "not-established", sourceTruthState: "not-established",
    conflictAbsenceTruthState: "not-established", approvalState: "not-established", authorizationState: "not-established", sourceInspectionState: "not-performed",
    sourceMutationState: "not-performed", conflictResolutionState: "not-performed", outcomeTruthState: "not-established", acceptanceState: "not-established",
    nativeHostAcceptanceState: "not-established", liveProviderAcceptanceState: "not-established", securityAcceptanceState: "not-established",
    releaseReadinessState: "not-established", deploymentReadinessState: "not-established", actionAuthorityState: "not-granted" }
  const readers = Object.fromEntries(Object.entries(dependencies).map(([key, value]) => [key, { readCurrent: async () => value }]))
  return { repository, product, initiative, dependencies, input, service: new ChangeConflictDetectionService(repository as unknown as GaepRepository, async () => product as never, async () => initiative as never, readers as never) }
}

describe("Change Conflict Detection lifecycle", () => {
  it("persists immutable exact per-path findings without claiming source inspection, conflict absence, or resolution", async () => {
    const { repository, service, input, initiative, dependencies } = fixture(), created = await service.create(input, "conflict-author")
    const revised = await service.revise(created.id, 1, { ...input, title: "Reviewed change conflict candidate" }, "conflict-author")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created), sourceInspectionState: "not-performed", conflictAbsenceTruthState: "not-established", conflictResolutionState: "not-performed" })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({ state: "candidate-defined", subjectCount: 1, noConflictCandidateCount: 5, conflictCandidateCount: 0, coverageGapCount: 0 })
    expect(await service.project(initiative.id)).toMatchObject({ candidate: { stageIdentity: { generation: 3 }, subjects: [{ pathCandidate: "apps/vscode/src/product-view.ts", findings: expect.arrayContaining([{ kind: "user-edit", state: "no-conflict-candidate" }]) }] } })
    expect(repository.audits.at(-1)?.payload).toMatchObject({ subjectCount: 1, sourceInspectionState: "not-performed", conflictResolutionState: "not-performed", actionAuthorityState: "not-granted" })
    dependencies.modelSwitchImplementation.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", staleBindingCount: 1 })
  })
  it("fails closed on forged stage, endpoint, handoff, recovery, traversal, and secrets", async () => {
    const { service, input } = fixture(), subject = input.subjects[0]!
    await expect(service.create({ ...input, stageIdentity: { ...input.stageIdentity, generation: 4 } }, "conflict-author")).rejects.toThrow(/stage identity/iu)
    await expect(service.create({ ...input, subjects: [{ ...subject, baselineDigestCandidate: canonicalDigest({ forged: true }) }] }, "conflict-author")).rejects.toThrow(/continuity/iu)
    await expect(service.create({ ...input, subjects: [{ ...subject, handoff: { ...subject.handoff, providerSwitchId: randomUUID() } }] }, "conflict-author")).rejects.toThrow(/continuity/iu)
    await expect(service.create({ ...input, subjects: [{ ...subject, rollbackRecoverySubjectId: randomUUID() }] }, "conflict-author")).rejects.toThrow(/missing/iu)
    expect(changeConflictDetectionInputSchema.safeParse({ ...input, subjects: [{ ...subject, pathCandidate: "../escape.ts" }] }).success).toBe(false)
    expect(changeConflictDetectionInputSchema.safeParse({ ...input, limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false)
  })
})
