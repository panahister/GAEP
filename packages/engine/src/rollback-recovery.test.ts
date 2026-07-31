import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import { rollbackRecoveryInputSchema, type RollbackRecoveryInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import type { GaepRepository } from "./repository.js"
import { RollbackRecoveryService } from "./rollback-recovery.js"

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
  const evidence = [{ kind: "review" as const, sourceId: "rollback-recovery-review", revision: 1, digest: canonicalDigest({ reviewed: true }), evidenceState: "human-reviewed" as const }]
  const failureModeKey = "failure.interrupted-apply", modelRecoveryPlanKey = "plan.restore-stage"
  const failureRecoveryModel = { ...base(), failureModes: [{ key: failureModeKey }], recoveryPlans: [{ key: modelRecoveryPlanKey, failureModeKeys: [failureModeKey] }] }
  const stageIdentity = { namespace: "gaep-managed-stage" as const, stageKey: "stage.product-view", generation: 3, scopeDigest: canonicalDigest({ scope: "product-view" }) }
  const stagingPath = { id: randomUUID(), pathCandidate: "apps/vscode/src/product-view.ts" }
  const stagingWorkspace = { ...base(), stagingIdentity: stageIdentity, recovery: { checkpointDigest: canonicalDigest({ checkpoint: "stage" }) },
    units: [{ id: randomUUID(), pathCandidates: [stagingPath] }] }
  const foundationPath = { id: randomUUID(), stagingPathId: stagingPath.id, pathCandidate: stagingPath.pathCandidate, stagingPathDigest: canonicalDigest(stagingPath), disposition: "apply-candidate" as const }
  const applyDiscardFoundation = { ...base(), dependencies: { stagingWorkspace: reference(stagingWorkspace) }, stageIdentity,
    decision: "apply-entire-stage-candidate" as const, paths: [foundationPath], recovery: { checkpointDigest: canonicalDigest({ checkpoint: "foundation" }) } }
  const scopedCheckpointDigest = canonicalDigest({ checkpoint: "scope" })
  const selectedPath = { id: randomUUID(), stagingPathId: stagingPath.id, pathCandidate: stagingPath.pathCandidate,
    stagingPathDigest: canonicalDigest(stagingPath), scopeState: "candidate-exact" as const }
  const scopedApply = { ...base(), dependencies: { stagingWorkspace: reference(stagingWorkspace), applyDiscardFoundation: reference(applyDiscardFoundation) },
    stageIdentity, selectedPaths: [selectedPath], excludedPaths: [], recovery: { checkpointDigest: scopedCheckpointDigest } }
  const dependencies = { failureRecoveryModel, stagingWorkspace, applyDiscardFoundation, scopedApply }
  const dependencyReferences = Object.fromEntries(Object.entries(dependencies).map(([key, value]) => [key, reference(value)])) as RollbackRecoveryInput["dependencies"]
  const rollbackPointId = randomUUID(), subjectId = randomUUID(), workflowStepId = randomUUID(), recoveryPlanKey = "recovery.product-view"
  const input: RollbackRecoveryInput = { initiativeId: initiative.id, context, informationClassification: "internal", title: "Rollback and recovery evidence candidate",
    dependencies: dependencyReferences, stageIdentity, rollbackPoints: [{ id: rollbackPointId, ordinal: 1, rollbackPointKey: "checkpoint.product-view",
      kind: "pre-apply-stage", stageGeneration: 3, scopeDigest: stageIdentity.scopeDigest, checkpointDigest: scopedCheckpointDigest,
      bindingsDigest: canonicalDigest(dependencyReferences), workflowStrategy: "sequential", orderedWorkflowStepIds: [workflowStepId],
      completedWorkflowStepIds: [], evidenceReferences: evidence, state: "candidate-defined", actualCheckpointTruthState: "not-established", rollbackExecutionState: "not-performed" }],
    subjects: [{ id: subjectId, ordinal: 1, subjectKey: "subject.product-view", scopedApplySelectedPathId: selectedPath.id,
      stagingPathId: stagingPath.id, rollbackPointId, recoveryPlanKey, pathCandidate: stagingPath.pathCandidate,
      stagingPathDigest: canonicalDigest(stagingPath), scopeState: "candidate-exact", evidenceReferences: evidence,
      sourceMutationState: "not-performed", rollbackExecutionState: "not-performed", recoveryExecutionState: "not-performed", outcomeTruthState: "not-established" }],
    recoveryPlans: [{ key: recoveryPlanKey, rollbackPointId, failureModeKey, recoveryPlanKey: modelRecoveryPlanKey, scope: "scoped-selection",
      subjectIds: [subjectId], orderedSteps: [{ ordinal: 1, action: "contain", executionState: "not-performed" },
        { ordinal: 2, action: "verify-checkpoint", executionState: "not-performed" }, { ordinal: 3, action: "revalidate", executionState: "not-performed" }],
      evidenceReferences: evidence, state: "candidate-defined", executionState: "not-performed", successState: "not-established", returnToServiceState: "not-authorized" }],
    safeguards: { staleStageRejectionState: "candidate-defined", scopeConfinementState: "candidate-defined", checkpointIntegrityState: "candidate-defined",
      tamperRejectionState: "candidate-defined", atomicityState: "candidate-defined", powerLossState: "not-assessed", unsupportedEffectState: "not-assessed" },
    evidenceReferences: evidence, preconditions: ["Exact current stage, scope, checkpoint and recovery bindings must be revalidated before any effect"],
    unresolvedQuestions: [], limitations: ["This candidate does not execute rollback or recovery and does not establish power-loss behavior"],
    reviewState: "ready-for-human-review", definedBy: { kind: "human", id: "reviewer" }, definedAt: "2026-08-01T00:20:00.000Z",
    stageTruthState: "not-established", repositoryTruthState: "not-established", sourceTruthState: "not-established", approvalState: "not-established",
    authorizationState: "not-established", sourceMutationState: "not-performed", rollbackExecutionState: "not-performed", recoveryExecutionState: "not-performed",
    recoveryOutcomeState: "not-established", returnToServiceState: "not-authorized", acceptanceState: "not-established", nativeHostAcceptanceState: "not-established",
    liveProviderAcceptanceState: "not-established", securityAcceptanceState: "not-established", releaseReadinessState: "not-established",
    deploymentReadinessState: "not-established", actionAuthorityState: "not-granted" }
  const readers = Object.fromEntries(Object.entries(dependencies).map(([key, value]) => [key, { readCurrent: async () => value }]))
  const service = new RollbackRecoveryService(repository as unknown as GaepRepository, async () => product as never, async () => initiative as never, readers as never)
  return { repository, service, input, initiative, dependencies }
}

describe("Rollback and Recovery lifecycle", () => {
  it("persists immutable exact checkpoint, subject and plan evidence while every recovery effect remains unperformed", async () => {
    const { repository, service, input, initiative, dependencies } = fixture()
    const created = await service.create(input, "recovery-author")
    const revised = await service.revise(created.id, 1, { ...input, title: "Reviewed rollback and recovery candidate" }, "recovery-author")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created), sourceMutationState: "not-performed",
      rollbackExecutionState: "not-performed", recoveryExecutionState: "not-performed", returnToServiceState: "not-authorized" })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({ state: "candidate-defined", rollbackPointCount: 1, subjectCount: 1,
      recoveryPlanCount: 1, coverageGapCount: 0, tamperSuspectedCount: 0 })
    expect(await service.project(initiative.id)).toMatchObject({ candidate: { stageIdentity: { generation: 3 },
      rollbackPoints: [{ state: "candidate-defined" }], subjects: [{ pathCandidate: "apps/vscode/src/product-view.ts" }],
      recoveryPlans: [{ state: "candidate-defined" }], safeguards: { powerLossState: "not-assessed" } } })
    expect(repository.audits.at(-1)?.payload).toMatchObject({ rollbackPointCount: 1, subjectCount: 1, recoveryPlanCount: 1,
      sourceMutationState: "not-performed", rollbackExecutionState: "not-performed", actionAuthorityState: "not-granted" })
    dependencies.scopedApply.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", staleBindingCount: 1 })
  })

  it("fails closed on forged stage, checkpoint, subject, recovery-model, traversal, and secret continuity", async () => {
    const { service, input } = fixture(), point = input.rollbackPoints[0]!, subject = input.subjects[0]!, plan = input.recoveryPlans[0]!
    await expect(service.create({ ...input, stageIdentity: { ...input.stageIdentity, generation: 4 },
      rollbackPoints: [{ ...point, stageGeneration: 4 }] }, "recovery-author")).rejects.toThrow(/stage identity/iu)
    await expect(service.create({ ...input, rollbackPoints: [{ ...point, checkpointDigest: canonicalDigest({ forged: true }) }] }, "recovery-author")).rejects.toThrow(/checkpoint/iu)
    await expect(service.create({ ...input, subjects: [{ ...subject, stagingPathId: randomUUID() }] }, "recovery-author")).rejects.toThrow(/continuity/iu)
    await expect(service.create({ ...input, recoveryPlans: [{ ...plan, recoveryPlanKey: "plan.unknown" }] }, "recovery-author")).rejects.toThrow(/failure mode|recovery plan/iu)
    expect(rollbackRecoveryInputSchema.safeParse({ ...input, subjects: [{ ...subject, pathCandidate: "../escape.ts" }] }).success).toBe(false)
    expect(rollbackRecoveryInputSchema.safeParse({ ...input, limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false)
  })
})
