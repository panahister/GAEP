import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  rollbackRecoveryInputSchema, rollbackRecoveryProjectionSchema, rollbackRecoverySchema, rollbackRecoveryStatusSchema,
  type ApplyDiscardFoundation, type BusinessContextBinding, type FailureRecoveryModel, type Initiative, type Product,
  type RollbackRecovery, type RollbackRecoveryInput, type RollbackRecoveryProjection, type RollbackRecoveryStatus,
  type ScopedApply, type StagingWorkspace, type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type CurrentReader<T> = { readCurrent(initiativeId: string): Promise<T | undefined> }
type ExactReference = { recordId: string; revision: number; digest: string }
interface Dependencies {
  failureRecoveryModel: FailureRecoveryModel
  stagingWorkspace: StagingWorkspace
  applyDiscardFoundation: ApplyDiscardFoundation
  scopedApply: ScopedApply
}

const uuidSchema = z.string().uuid(), currentRecordPattern = /^[0-9a-f-]+\.json$/i, inventoryLimit = 10_000
const authorityBoundary = "rollback-recovery-is-a-versioned-portable-evidence-candidate-and-does-not-establish-stage-repository-source-checkpoint-approval-authorization-mutation-rollback-recovery-outcome-return-to-service-acceptance-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "rollback-recovery-status-is-observational-and-grants-no-stage-repository-source-checkpoint-approval-authorization-mutation-rollback-recovery-outcome-return-to-service-acceptance-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "rollback-recovery-projection-is-read-only-and-grants-no-stage-repository-source-checkpoint-approval-authorization-mutation-rollback-recovery-outcome-return-to-service-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-bounded-stage-checkpoint-subject-plan-evidence-identities-states-counts-and-digests-only-not-source-diff-provider-output-machine-paths-personal-data-secrets-credentials-or-permissions" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference { return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) } }
function sameReference(reference: ExactReference | undefined, record: { id: string; revision?: number } | undefined): boolean {
  return Boolean(reference && record && reference.recordId === record.id && reference.revision === revisionOf(record) && reference.digest === canonicalDigest(record))
}

export class RollbackRecoveryService {
  constructor(private readonly repository: GaepRepository, private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader, private readonly readers: { [K in keyof Dependencies]: CurrentReader<Dependencies[K]> }) {}

  async create(inputValue: RollbackRecoveryInput, actorId: string): Promise<RollbackRecovery> {
    const input = rollbackRecoveryInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      if (await this.readCurrent(input.initiativeId)) throw new Error("A current Rollback and Recovery candidate already exists; create a revision")
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies, product, initiative)
      const now = new Date().toISOString()
      const record = rollbackRecoverySchema.parse({ schemaVersion: 1, kind: "rollback-recovery-candidate", id: randomUUID(), productId: product.id,
        ...input, revision: 1, ...this.composeDigests(input), state: "candidate", createdBy: { kind: "human", id: actorId },
        updatedBy: { kind: "human", id: actorId }, createdAt: now, updatedAt: now, authorityBoundary })
      await this.commitVersionedRecord(record, "rollback-recovery.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: RollbackRecoveryInput, actorId: string): Promise<RollbackRecovery> {
    const input = rollbackRecoveryInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Rollback and Recovery revision conflict")
      if (current.initiativeId !== input.initiativeId) throw new Error("Rollback and Recovery Initiative binding is immutable")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies, product, initiative)
      const record = rollbackRecoverySchema.parse({ ...current, ...input, revision: current.revision + 1, ...this.composeDigests(input),
        predecessorDigest: canonicalDigest(current), updatedBy: { kind: "human", id: actorId }, updatedAt: new Date().toISOString() })
      await this.commitVersionedRecord(record, "rollback-recovery.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<RollbackRecovery> { return this.repository.readJson(this.currentPath(this.requireUuid(id, "Rollback and Recovery ID")), rollbackRecoverySchema) }
  async readCurrent(initiativeId: string): Promise<RollbackRecovery | undefined> {
    const target = this.requireUuid(initiativeId, "Initiative ID")
    const matches = (await this.listRecords("rollback-recovery", currentRecordPattern, rollbackRecoverySchema)).filter((record) => record.initiativeId === target)
    if (matches.length > 1) throw new Error("Multiple current Rollback and Recovery candidates target one Initiative")
    return matches[0]
  }
  async readRevision(id: string, revision: number): Promise<RollbackRecovery> {
    const recordId = this.requireUuid(id, "Rollback and Recovery ID")
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Revision must be a positive integer")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), rollbackRecoverySchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Rollback and Recovery history binding mismatch")
    return record
  }
  async listHistory(id: string): Promise<RollbackRecovery[]> {
    const recordId = this.requireUuid(id, "Rollback and Recovery ID")
    const records = await this.listRecords("rollback-recovery-history", new RegExp(`^rollback-recovery-${recordId}-r[1-9][0-9]*\\.json$`, "i"), rollbackRecoverySchema)
    return records.sort((left, right) => right.revision - left.revision)
  }

  async assess(initiativeId: string): Promise<RollbackRecoveryStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, dependencies] = await Promise.all([this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), this.readDependencies(targetId)])
    const reasons: string[] = []
    let staleBindingCount = 0, coverageGapCount = 0, invalidCandidateCount = 0
    if (!candidate) reasons.push("No current Rollback and Recovery candidate is recorded")
    if (Object.values(dependencies).some((value) => !value)) reasons.push("One or more required rollback and recovery predecessor candidates are unavailable")
    const selectedCount = dependencies.scopedApply?.selectedPaths.length ?? 0
    if (candidate) {
      for (const key of Object.keys(dependencies) as (keyof Dependencies)[]) if (!sameReference(candidate.dependencies[key], dependencies[key])) staleBindingCount += 1
      if (candidate.subjects.length !== selectedCount) coverageGapCount = Math.abs(candidate.subjects.length - selectedCount) || 1
      try { if (this.completeDependencies(dependencies)) this.validateCandidate(candidate, dependencies, product, initiative) } catch { invalidCandidateCount += 1 }
    }
    const points = candidate?.rollbackPoints ?? [], subjects = candidate?.subjects ?? [], plans = candidate?.recoveryPlans ?? []
    const states = [...points.map((value) => value.state), ...subjects.map((value) => value.scopeState), ...plans.map((value) => value.state)]
    const gapCount = states.filter((state) => state === "gap").length
    const conflictCount = states.filter((state) => state === "conflict").length
    const staleCount = states.filter((state) => state === "stale").length
    const tamperSuspectedCount = states.filter((state) => state === "tamper-suspected").length
    const unsupportedEffectCount = states.filter((state) => state === "unsupported-effect").length
    const notAssessedCount = states.filter((state) => state === "not-assessed").length
    if (staleBindingCount) reasons.push("One or more exact predecessor bindings are stale")
    if (coverageGapCount) reasons.push("Recovery subjects do not cover the exact scoped selection one-for-one")
    if (gapCount + conflictCount + staleCount + tamperSuspectedCount + unsupportedEffectCount + notAssessedCount) reasons.push("One or more checkpoint, subject, or recovery-plan candidates are incomplete, conflicting, stale, suspect, unsupported, or not assessed")
    if (invalidCandidateCount) reasons.push("Stage, checkpoint, subject, recovery-plan, or evidence continuity is invalid")
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    if (unresolvedQuestionCount) reasons.push("The candidate records unresolved questions")
    const reviewState = candidate?.reviewState ?? "draft"
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    const blocking = staleBindingCount + coverageGapCount + gapCount + conflictCount + staleCount + tamperSuspectedCount + unsupportedEffectCount + notAssessedCount + invalidCandidateCount + unresolvedQuestionCount
    return rollbackRecoveryStatusSchema.parse({ schemaVersion: 1, kind: "rollback-recovery-status", productId: product.id, productRevision: revisionOf(product),
      initiativeId: initiative.id, initiativeRevision: revisionOf(initiative), ...(candidate ? { candidate: exactReference(candidate), dependencies: candidate.dependencies,
        stageKey: candidate.stageIdentity.stageKey, stageGeneration: candidate.stageIdentity.generation } : {}), rollbackPointCount: points.length,
      subjectCount: subjects.length, recoveryPlanCount: plans.length, completedWorkflowStepCount: points.reduce((sum, point) => sum + point.completedWorkflowStepIds.length, 0),
      gapCount, conflictCount, staleCount, tamperSuspectedCount, unsupportedEffectCount, notAssessedCount, staleBindingCount, coverageGapCount,
      invalidCandidateCount, unresolvedQuestionCount, reviewState, state: candidate && this.completeDependencies(dependencies) && blocking === 0 && reviewState === "ready-for-human-review" ? "candidate-defined" : "attention-required",
      reasons, assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary })
  }

  async project(initiativeId: string): Promise<RollbackRecoveryProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId)])
    const withoutDigest = { schemaVersion: 1 as const, kind: "rollback-recovery-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state }, status,
      ...(candidate ? { candidate: { id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), stageIdentity: candidate.stageIdentity,
        rollbackPoints: candidate.rollbackPoints.map((point) => ({ id: point.id, rollbackPointKey: point.rollbackPointKey, kind: point.kind,
          state: point.state, completedWorkflowStepCount: point.completedWorkflowStepIds.length, checkpointDigest: point.checkpointDigest })),
        subjects: candidate.subjects.map((subject) => ({ id: subject.id, subjectKey: subject.subjectKey, pathCandidate: subject.pathCandidate,
          recoveryPlanKey: subject.recoveryPlanKey, scopeState: subject.scopeState })),
        recoveryPlans: candidate.recoveryPlans.map((plan) => ({ key: plan.key, scope: plan.scope, subjectCount: plan.subjectIds.length,
          stepCount: plan.orderedSteps.length, state: plan.state })), safeguards: candidate.safeguards,
        dependencyReceiptDigest: candidate.dependencyReceiptDigest, stageReceiptDigest: candidate.stageReceiptDigest,
        checkpointReceiptDigest: candidate.checkpointReceiptDigest, subjectReceiptDigest: candidate.subjectReceiptDigest,
        planReceiptDigest: candidate.planReceiptDigest, safeguardReceiptDigest: candidate.safeguardReceiptDigest,
        evidenceReceiptDigest: candidate.evidenceReceiptDigest, assessmentReceiptDigest: candidate.assessmentReceiptDigest,
        reviewState: candidate.reviewState, updatedAt: candidate.updatedAt } } : {}), observedAt: status.assessedAt,
      privacyBoundary, authorityBoundary: projectionAuthorityBoundary }
    return rollbackRecoveryProjectionSchema.parse({ ...withoutDigest, snapshotDigest: canonicalDigest(withoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    for (const candidate of await this.listRecords("rollback-recovery", currentRecordPattern, rollbackRecoverySchema)) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) throw new Error("Current candidate does not match immutable history")
        if ((await this.assess(candidate.initiativeId)).state === "attention-required") issues.push({ code: "rollback-recovery.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has a stale, incomplete, conflicting, suspect, unsupported, or unresolved Rollback and Recovery candidate.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "create-superseding-revision"] })
      } catch (error) { issues.push({ code: "rollback-recovery.invalid", severity: "error", message: `Rollback and Recovery ${candidate.id}: ${error instanceof Error ? error.message : "validation failed"}`,
        record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "manual-repair-required"] }) }
    }
    return issues
  }

  private async readDependencies(initiativeId: string): Promise<{ [K in keyof Dependencies]: Dependencies[K] | undefined }> {
    const keys = Object.keys(this.readers) as (keyof Dependencies)[], values = await Promise.all(keys.map((key) => this.readers[key].readCurrent(initiativeId)))
    return Object.fromEntries(keys.map((key, index) => [key, values[index]])) as { [K in keyof Dependencies]: Dependencies[K] | undefined }
  }
  private completeDependencies(value: { [K in keyof Dependencies]: Dependencies[K] | undefined }): value is Dependencies { return Object.values(value).every(Boolean) }
  private async requireExactDependencies(input: RollbackRecoveryInput): Promise<Dependencies> {
    const dependencies = await this.readDependencies(input.initiativeId)
    for (const key of Object.keys(dependencies) as (keyof Dependencies)[]) if (!sameReference(input.dependencies[key], dependencies[key])) throw new Error(`Rollback and Recovery must reference the exact current ${key}`)
    if (!this.completeDependencies(dependencies)) throw new Error("Rollback and Recovery dependencies are incomplete")
    return dependencies
  }

  private validateCandidate(input: RollbackRecoveryInput, dependencies: Dependencies, product: Product, initiative: Initiative): void {
    for (const dependency of Object.values(dependencies)) if (dependency.productId !== product.id || dependency.initiativeId !== initiative.id || canonicalDigest(dependency.context) !== canonicalDigest(input.context)) throw new Error("Rollback and Recovery dependencies must bind the exact current Product, Initiative, and context")
    if (!sameReference(dependencies.applyDiscardFoundation.dependencies.stagingWorkspace, dependencies.stagingWorkspace) ||
        !sameReference(dependencies.scopedApply.dependencies.stagingWorkspace, dependencies.stagingWorkspace) ||
        !sameReference(dependencies.scopedApply.dependencies.applyDiscardFoundation, dependencies.applyDiscardFoundation)) throw new Error("Rollback and Recovery predecessor continuity is stale")
    if (dependencies.applyDiscardFoundation.decision !== "apply-entire-stage-candidate") throw new Error("Rollback and Recovery requires the exact current apply decision candidate")
    if (canonicalDigest(input.stageIdentity) !== canonicalDigest(dependencies.stagingWorkspace.stagingIdentity) ||
        canonicalDigest(input.stageIdentity) !== canonicalDigest(dependencies.applyDiscardFoundation.stageIdentity) ||
        canonicalDigest(input.stageIdentity) !== canonicalDigest(dependencies.scopedApply.stageIdentity)) throw new Error("Rollback and Recovery must bind the exact stage identity and generation")
    const expectedBindingsDigest = canonicalDigest(input.dependencies)
    for (const point of input.rollbackPoints) {
      if (point.bindingsDigest !== expectedBindingsDigest || point.checkpointDigest !== dependencies.scopedApply.recovery.checkpointDigest) throw new Error("Rollback point checkpoint and binding continuity is invalid")
    }
    if (input.subjects.length !== dependencies.scopedApply.selectedPaths.length) throw new Error("Rollback and Recovery requires one subject per exact scoped selection")
    for (const subject of input.subjects) {
      const selected = dependencies.scopedApply.selectedPaths.find((path) => path.id === subject.scopedApplySelectedPathId)
      const staged = dependencies.stagingWorkspace.units.flatMap((unit) => unit.pathCandidates).find((path) => path.id === subject.stagingPathId)
      if (!selected || !staged || selected.stagingPathId !== staged.id || selected.pathCandidate !== subject.pathCandidate || staged.pathCandidate !== subject.pathCandidate ||
          selected.stagingPathDigest !== subject.stagingPathDigest || subject.stagingPathDigest !== canonicalDigest(staged)) throw new Error("Rollback and Recovery does not preserve exact scoped-selection and staging-path continuity")
    }
    for (const plan of input.recoveryPlans) {
      const failure = dependencies.failureRecoveryModel.failureModes.find((entry) => entry.key === plan.failureModeKey)
      const recovery = dependencies.failureRecoveryModel.recoveryPlans.find((entry) => entry.key === plan.recoveryPlanKey)
      if (!failure || !recovery || !recovery.failureModeKeys.includes(failure.key)) throw new Error("Rollback and Recovery plan must reference an exact declared failure mode and compatible recovery plan")
    }
  }

  private composeDigests(input: RollbackRecoveryInput) {
    const dependencyReceiptDigest = canonicalDigest(input.dependencies), stageReceiptDigest = canonicalDigest(input.stageIdentity)
    const checkpointReceiptDigest = canonicalDigest(input.rollbackPoints), subjectReceiptDigest = canonicalDigest(input.subjects)
    const planReceiptDigest = canonicalDigest(input.recoveryPlans), safeguardReceiptDigest = canonicalDigest(input.safeguards)
    const evidenceReceiptDigest = canonicalDigest({ evidenceReferences: input.evidenceReferences,
      rollbackPoints: input.rollbackPoints.map((point) => point.evidenceReferences), subjects: input.subjects.map((subject) => subject.evidenceReferences),
      recoveryPlans: input.recoveryPlans.map((plan) => plan.evidenceReferences) })
    const assessmentReceiptDigest = canonicalDigest({ dependencyReceiptDigest, stageReceiptDigest, checkpointReceiptDigest, subjectReceiptDigest,
      planReceiptDigest, safeguardReceiptDigest, evidenceReceiptDigest, preconditions: input.preconditions, unresolvedQuestions: input.unresolvedQuestions,
      limitations: input.limitations, reviewState: input.reviewState, stageTruthState: input.stageTruthState, repositoryTruthState: input.repositoryTruthState,
      sourceTruthState: input.sourceTruthState, approvalState: input.approvalState, authorizationState: input.authorizationState,
      sourceMutationState: input.sourceMutationState, rollbackExecutionState: input.rollbackExecutionState,
      recoveryExecutionState: input.recoveryExecutionState, recoveryOutcomeState: input.recoveryOutcomeState,
      returnToServiceState: input.returnToServiceState, acceptanceState: input.acceptanceState, actionAuthorityState: input.actionAuthorityState })
    return { dependencyReceiptDigest, stageReceiptDigest, checkpointReceiptDigest, subjectReceiptDigest, planReceiptDigest,
      safeguardReceiptDigest, evidenceReceiptDigest, assessmentReceiptDigest }
  }
  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void { if (initiative.productId !== product.id || canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) throw new Error("Rollback and Recovery must bind exact current Product and Initiative revisions and digests") }
  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding { return { productRevision: revisionOf(product), productDigest: canonicalDigest(product), initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) } }
  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> { const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))]); if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product"); if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Rollback and Recovery is immutable`); return { product, initiative } }
  private async commitVersionedRecord(record: RollbackRecovery, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({ writes: [this.governed(this.currentPath(record.id), record, rollbackRecoverySchema), this.governed(this.historyPath(record.id, record.revision), record, rollbackRecoverySchema)],
      audit: { eventType, actor: { kind: "human", id: actorId }, subjectId: record.id, payload: { initiativeId: record.initiativeId, revision: record.revision,
        recordDigest: canonicalDigest(record), dependencies: record.dependencies, stageIdentity: record.stageIdentity, rollbackPointCount: record.rollbackPoints.length,
        subjectCount: record.subjects.length, recoveryPlanCount: record.recoveryPlans.length, dependencyReceiptDigest: record.dependencyReceiptDigest,
        stageReceiptDigest: record.stageReceiptDigest, checkpointReceiptDigest: record.checkpointReceiptDigest, subjectReceiptDigest: record.subjectReceiptDigest,
        planReceiptDigest: record.planReceiptDigest, safeguardReceiptDigest: record.safeguardReceiptDigest,
        evidenceReceiptDigest: record.evidenceReceiptDigest, assessmentReceiptDigest: record.assessmentReceiptDigest,
        predecessorDigest: record.predecessorDigest, sourceMutationState: record.sourceMutationState,
        rollbackExecutionState: record.rollbackExecutionState, recoveryExecutionState: record.recoveryExecutionState,
        actionAuthorityState: record.actionAuthorityState, authorityBoundary: record.authorityBoundary } } })
  }
  private currentPath(id: string): string { return this.repository.resolve("rollback-recovery", `${id}.json`) }
  private historyPath(id: string, revision: number): string { return this.repository.resolve("rollback-recovery-history", `rollback-recovery-${id}-r${revision}.json`) }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string { const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data }
  private async assertIntegrity(): Promise<void> { const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed") }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> { let names: string[]; try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) } catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error } if (names.length > inventoryLimit) throw new Error(`Rollback and Recovery directory ${directory} exceeds the safety limit`); const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema))); return records.sort((left, right) => `${String((left as Record<string, unknown>).id ?? "")}:${String((left as Record<string, unknown>).revision ?? "")}`.localeCompare(`${String((right as Record<string, unknown>).id ?? "")}:${String((right as Record<string, unknown>).revision ?? "")}`)) }
}
