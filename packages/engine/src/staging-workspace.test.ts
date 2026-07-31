import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import type { StagingWorkspaceInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import type { GaepRepository } from "./repository.js"
import { StagingWorkspaceService } from "./staging-workspace.js"

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
  const previewUnitId = randomUUID(), previewPathId = randomUUID(), implementationUnitId = randomUUID()
  const digest = canonicalDigest({ content: true })
  const evidence = { kind: "evidence" as const, sourceId: "stage-inspection", revision: 1, digest, evidenceState: "human-reviewed" as const }
  const previewPath = { id: previewPathId, ordinal: 1, changedPathCandidateId: randomUUID(), pathCandidate: "packages/example/src/index.ts",
    changeKind: "modify" as const, source: { state: "candidate-observed" as const, digest, bytes: 100 },
    target: { state: "candidate-generated" as const, digest, bytes: 120 }, diff: { state: "candidate-generated" as const,
      format: "unified-text-metadata" as const, patchDigest: digest, addedLineCount: 3, removedLineCount: 1, truncated: false },
    planOperations: ["replace", "verify"] as const, traceDigest: digest, evidenceReferences: [evidence], outcome: "candidate-previewed" as const }
  const previewUnit = { id: previewUnitId, ordinal: 1, changedUnitCandidateId: randomUUID(), implementationUnitId, implementationUnitKey: "unit-a",
    pathPreviews: [previewPath], dependencyUnitIds: [], directBlastRadiusUnitIds: [], indirectBlastRadiusUnitIds: [],
    evidenceReferences: [evidence], outcome: "candidate-previewed" as const }
  const preview = { id: randomUUID(), revision: 1, initiativeId: initiative.id, previewUnits: [previewUnit] }
  const previewReference = { recordId: preview.id, revision: preview.revision, digest: canonicalDigest(preview) }
  const stagingIdentity = { namespace: "gaep-managed-stage" as const, stageKey: "candidate-stage-1", generation: 1,
    scopeDigest: canonicalDigest({ product: { id: product.id, revision: 1, digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: 1, digest: canonicalDigest(initiative) }, proposedChangePreview: previewReference }) }
  const exclusionRuleIds = ["control-plane", "secrets", "symlinks"]
  const exclusionReceiptDigest = canonicalDigest({ exclusionRuleIds, excludedPathCandidateCount: 0, proposedChangePreview: previewReference })
  const capacity = { maximumFiles: 512, maximumBytes: 67_108_864, maximumSingleFileBytes: 8_388_608,
    maximumPathBytes: 4_096, maximumChanges: 512, candidateFileCount: 1, candidateByteCount: 120 }
  const recoveryCheckpoint = canonicalDigest({ stagingIdentity, proposedChangePreview: previewReference, capacity, exclusionReceiptDigest })
  const input: StagingWorkspaceInput = {
    initiativeId: initiative.id, context: { productRevision: 1, productDigest: canonicalDigest(product), initiativeRevision: 1, initiativeDigest: canonicalDigest(initiative) },
    informationClassification: "internal", title: "Isolated staging workspace candidate", proposedChangePreview: previewReference, stagingIdentity,
    lifecycle: { definitionState: "candidate-defined", provisioningState: "not-performed", actualStageExistenceState: "not-established",
      inspectionState: "candidate-complete", applyState: "not-performed", discardState: "not-performed", disposalState: "not-performed" },
    units: [{ id: randomUUID(), ordinal: 1, proposedPreviewUnitId: previewUnitId, implementationUnitId, implementationUnitKey: "unit-a",
      previewUnitDigest: canonicalDigest(previewUnit), evidenceReferences: [evidence], outcome: "candidate-defined",
      pathCandidates: [{ id: randomUUID(), ordinal: 1, proposedPathPreviewId: previewPathId, pathCandidate: previewPath.pathCandidate,
        changeKind: "modify", previewPathDigest: canonicalDigest(previewPath), sourceEndpointDigest: canonicalDigest(previewPath.source),
        targetEndpointDigest: canonicalDigest(previewPath.target), diffMetadataDigest: canonicalDigest(previewPath.diff),
        planOperationsDigest: canonicalDigest(previewPath.planOperations), traceDigest: previewPath.traceDigest,
        inspectionState: "candidate-complete", evidenceReferences: [evidence], outcome: "candidate-defined" }] }],
    exclusionRuleIds, excludedPathCandidateCount: 0, exclusionReceiptDigest, capacity,
    recovery: { strategy: "write-ahead-journal-candidate", journalKey: "candidate-journal-1", checkpointDigest: recoveryCheckpoint,
      replayState: "candidate-defined", inspectionEvidenceReferences: [evidence] }, inspectionEvidenceReferences: [evidence],
    unresolvedQuestions: [], limitations: ["Candidate metadata does not prove that a machine-local stage exists"], reviewState: "ready-for-human-review",
    repositoryTruthState: "not-established", pathTruthState: "not-established", sourceObservationTruthState: "not-established",
    targetProposalTruthState: "not-established", diffTruthState: "not-established", approvedScopeState: "not-established",
    changeApprovalState: "not-established", codeMutationState: "not-performed", realStageCreationState: "not-performed",
    applyState: "not-performed", discardState: "not-performed", assignmentExecutionState: "not-established",
    acceptanceDecisionState: "not-established", mergeReadinessState: "not-established", releaseReadinessState: "not-established",
    deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
  }
  const previewReader = { readCurrent: async () => preview }
  const service = new StagingWorkspaceService(repository as unknown as GaepRepository, async () => product as never,
    async () => initiative as never, previewReader as never)
  return { repository, service, input, initiative, preview }
}

describe("Staging Workspace engine lifecycle", () => {
  it("persists immutable candidate receipts without creating or claiming a real stage", async () => {
    const { repository, service, input, initiative, preview } = fixture()
    const created = await service.create(input, "stage-author")
    const revised = await service.revise(created.id, 1, { ...input, title: "Reviewed staging workspace candidate" }, "stage-author")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created), realStageCreationState: "not-performed",
      lifecycle: { actualStageExistenceState: "not-established" }, actionAuthorityState: "not-granted" })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({ state: "candidate-defined", previewUnitCount: 1, stagingUnitCount: 1, previewPathCount: 1, stagingPathCount: 1 })
    const projection = await service.project(initiative.id)
    expect(projection.candidate?.units[0]?.paths[0]).toMatchObject({ pathCandidate: "packages/example/src/index.ts", changeKind: "modify", inspectionState: "candidate-complete" })
    expect(JSON.stringify(projection)).not.toContain("stage-author")
    expect(JSON.stringify(projection)).not.toContain("/workspace")
    expect(repository.audits.at(-1)?.payload).toMatchObject({ unitCount: 1, pathCount: 1, realStageCreationState: "not-performed", applyState: "not-performed", actionAuthorityState: "not-granted" })
    preview.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", stalePreviewCount: 1 })
  })

  it("fails closed when staging metadata does not bind the exact preview", async () => {
    const { service, input } = fixture()
    await expect(service.create({ ...input, units: input.units.map((unit) => ({ ...unit,
      pathCandidates: unit.pathCandidates.map((path) => ({ ...path, previewPathDigest: canonicalDigest({ wrong: true }) })) })) }, "stage-author"))
      .rejects.toThrow(/preview path/iu)
  })
})
