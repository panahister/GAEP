import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  changeConflictDetectionInputSchema, changeConflictDetectionProjectionSchema, changeConflictDetectionSchema, changeConflictDetectionStatusSchema,
  type ApplyDiscardFoundation, type BusinessContextBinding, type ChangeConflictDetection, type ChangeConflictDetectionInput,
  type ChangeConflictDetectionProjection, type ChangeConflictDetectionStatus, type ChangedUnitInventory, type Initiative,
  type ModelSwitchImplementation, type Product, type ProposedChangePreview, type ProviderSwitchImplementation,
  type RollbackRecovery, type ScopedApply, type StagingWorkspace, type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type CurrentReader<T> = { readCurrent(initiativeId: string): Promise<T | undefined> }
type ExactReference = { recordId: string; revision: number; digest: string }
interface Dependencies { changedUnitInventory: ChangedUnitInventory; proposedChangePreview: ProposedChangePreview; stagingWorkspace: StagingWorkspace;
  providerSwitchImplementation: ProviderSwitchImplementation; modelSwitchImplementation: ModelSwitchImplementation;
  applyDiscardFoundation: ApplyDiscardFoundation; scopedApply: ScopedApply; rollbackRecovery: RollbackRecovery }

const uuidSchema = z.string().uuid(), currentRecordPattern = /^[0-9a-f-]+\.json$/i, inventoryLimit = 10_000
const authorityBoundary = "change-conflict-detection-is-a-versioned-portable-candidate-and-does-not-establish-repository-source-baseline-current-content-user-edit-handoff-conflict-absence-resolution-mutation-outcome-approval-acceptance-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "change-conflict-detection-status-is-observational-and-grants-no-repository-source-baseline-current-content-user-edit-handoff-conflict-absence-resolution-mutation-outcome-approval-acceptance-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "change-conflict-detection-projection-is-read-only-and-grants-no-repository-source-baseline-current-content-user-edit-handoff-conflict-absence-resolution-mutation-outcome-approval-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-bounded-path-digest-handoff-conflict-evidence-identities-states-counts-and-receipts-only-not-source-diff-provider-output-machine-paths-personal-data-secrets-credentials-or-permissions" as const
function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference { return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) } }
function sameReference(reference: ExactReference | undefined, record: { id: string; revision?: number } | undefined): boolean { return Boolean(reference && record && reference.recordId === record.id && reference.revision === revisionOf(record) && reference.digest === canonicalDigest(record)) }

export class ChangeConflictDetectionService {
  constructor(private readonly repository: GaepRepository, private readonly readProduct: ProductReader, private readonly readInitiative: InitiativeReader,
    private readonly readers: { [K in keyof Dependencies]: CurrentReader<Dependencies[K]> }) {}

  async create(inputValue: ChangeConflictDetectionInput, actorId: string): Promise<ChangeConflictDetection> {
    const input = changeConflictDetectionInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity(); const { product, initiative } = await this.requireMutableInitiative(input.initiativeId); this.validateContext(input.context, product, initiative)
      if (await this.readCurrent(input.initiativeId)) throw new Error("A current Change Conflict Detection candidate already exists; create a revision")
      const dependencies = await this.requireExactDependencies(input); this.validateCandidate(input, dependencies, product, initiative); const now = new Date().toISOString()
      const record = changeConflictDetectionSchema.parse({ schemaVersion: 1, kind: "change-conflict-detection-candidate", id: randomUUID(), productId: product.id,
        ...input, revision: 1, ...this.composeDigests(input), state: "candidate", createdBy: { kind: "human", id: actorId }, updatedBy: { kind: "human", id: actorId },
        createdAt: now, updatedAt: now, authorityBoundary }); await this.commitVersionedRecord(record, "change-conflict-detection.created", actorId); return record
    })
  }
  async revise(id: string, expectedRevision: number, inputValue: ChangeConflictDetectionInput, actorId: string): Promise<ChangeConflictDetection> {
    const input = changeConflictDetectionInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity(); const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Change Conflict Detection revision conflict")
      if (current.initiativeId !== input.initiativeId) throw new Error("Change Conflict Detection Initiative binding is immutable")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId); this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input); this.validateCandidate(input, dependencies, product, initiative)
      const record = changeConflictDetectionSchema.parse({ ...current, ...input, revision: current.revision + 1, ...this.composeDigests(input),
        predecessorDigest: canonicalDigest(current), updatedBy: { kind: "human", id: actorId }, updatedAt: new Date().toISOString() })
      await this.commitVersionedRecord(record, "change-conflict-detection.revised", actorId); return record
    })
  }
  async read(id: string): Promise<ChangeConflictDetection> { return this.repository.readJson(this.currentPath(this.requireUuid(id, "Change Conflict Detection ID")), changeConflictDetectionSchema) }
  async readCurrent(initiativeId: string): Promise<ChangeConflictDetection | undefined> { const target = this.requireUuid(initiativeId, "Initiative ID"); const matches = (await this.listRecords("change-conflict-detection", currentRecordPattern, changeConflictDetectionSchema)).filter((record) => record.initiativeId === target); if (matches.length > 1) throw new Error("Multiple current Change Conflict Detection candidates target one Initiative"); return matches[0] }
  async readRevision(id: string, revision: number): Promise<ChangeConflictDetection> { const recordId = this.requireUuid(id, "Change Conflict Detection ID"); if (!Number.isInteger(revision) || revision < 1) throw new Error("Revision must be a positive integer"); const record = await this.repository.readJson(this.historyPath(recordId, revision), changeConflictDetectionSchema); if (record.id !== recordId || record.revision !== revision) throw new Error("Change Conflict Detection history binding mismatch"); return record }
  async listHistory(id: string): Promise<ChangeConflictDetection[]> { const recordId = this.requireUuid(id, "Change Conflict Detection ID"); return (await this.listRecords("change-conflict-detection-history", new RegExp(`^change-conflict-detection-${recordId}-r[1-9][0-9]*\\.json$`, "i"), changeConflictDetectionSchema)).sort((a, b) => b.revision - a.revision) }

  async assess(initiativeId: string): Promise<ChangeConflictDetectionStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID"), [product, initiative, candidate, dependencies] = await Promise.all([this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), this.readDependencies(targetId)])
    const reasons: string[] = []; let staleBindingCount = 0, coverageGapCount = 0, invalidCandidateCount = 0
    if (!candidate) reasons.push("No current Change Conflict Detection candidate is recorded")
    if (Object.values(dependencies).some((value) => !value)) reasons.push("One or more required conflict-detection predecessor candidates are unavailable")
    const selectedCount = dependencies.scopedApply?.selectedPaths.length ?? 0
    if (candidate) { for (const key of Object.keys(dependencies) as (keyof Dependencies)[]) if (!sameReference(candidate.dependencies[key], dependencies[key])) staleBindingCount += 1
      if (candidate.subjects.length !== selectedCount) coverageGapCount = Math.abs(candidate.subjects.length - selectedCount) || 1
      try { if (this.completeDependencies(dependencies)) this.validateCandidate(candidate, dependencies, product, initiative) } catch { invalidCandidateCount += 1 } }
    const subjects = candidate?.subjects ?? [], findings = subjects.flatMap((subject) => subject.findings)
    const conflictCandidateCount = findings.filter((finding) => finding.state === "conflict-candidate").length
    const noConflictCandidateCount = findings.filter((finding) => finding.state === "no-conflict-candidate").length
    const unavailableCount = findings.filter((finding) => finding.state === "unavailable").length + subjects.filter((subject) => subject.currentObservationState === "unavailable" || subject.handoff.observationState === "unavailable").length
    const gapCount = findings.filter((finding) => finding.state === "gap").length, staleCount = findings.filter((finding) => finding.state === "stale").length
    const notAssessedCount = findings.filter((finding) => finding.state === "not-assessed").length + subjects.filter((subject) => subject.currentObservationState === "not-assessed" || subject.handoff.observationState === "not-assessed" || subject.handoff.observationState === "candidate-not-recorded").length
    if (staleBindingCount) reasons.push("One or more exact predecessor bindings are stale")
    if (coverageGapCount) reasons.push("Conflict subjects do not cover the exact scoped selection one-for-one")
    if (unavailableCount + gapCount + staleCount + notAssessedCount) reasons.push("One or more bounded observations or conflict findings are unavailable, incomplete, stale, or not assessed")
    if (invalidCandidateCount) reasons.push("Change, preview, stage, handoff, selection, recovery, digest, or conflict continuity is invalid")
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0; if (unresolvedQuestionCount) reasons.push("The candidate records unresolved questions")
    const reviewState = candidate?.reviewState ?? "draft"; if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    const blocking = staleBindingCount + coverageGapCount + unavailableCount + gapCount + staleCount + notAssessedCount + invalidCandidateCount + unresolvedQuestionCount
    return changeConflictDetectionStatusSchema.parse({ schemaVersion: 1, kind: "change-conflict-detection-status", productId: product.id, productRevision: revisionOf(product), initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative), ...(candidate ? { candidate: exactReference(candidate), dependencies: candidate.dependencies, stageKey: candidate.stageIdentity.stageKey, stageGeneration: candidate.stageIdentity.generation } : {}),
      subjectCount: subjects.length, conflictCandidateCount, noConflictCandidateCount, unavailableCount, gapCount, staleCount, notAssessedCount,
      staleBindingCount, coverageGapCount, invalidCandidateCount, unresolvedQuestionCount, reviewState,
      state: candidate && this.completeDependencies(dependencies) && blocking === 0 && reviewState === "ready-for-human-review" ? "candidate-defined" : "attention-required",
      reasons, assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary })
  }
  async project(initiativeId: string): Promise<ChangeConflictDetectionProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID"), [product, initiative, status, candidate] = await Promise.all([this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId)])
    const body = { schemaVersion: 1 as const, kind: "change-conflict-detection-projection" as const, product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state }, status,
      ...(candidate ? { candidate: { id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), stageIdentity: candidate.stageIdentity,
        subjects: candidate.subjects.map((subject) => ({ id: subject.id, subjectKey: subject.subjectKey, pathCandidate: subject.pathCandidate,
          currentObservationState: subject.currentObservationState, handoffObservationState: subject.handoff.observationState,
          findings: subject.findings.map((finding) => ({ kind: finding.kind, state: finding.state })) })), dependencyReceiptDigest: candidate.dependencyReceiptDigest,
        stageReceiptDigest: candidate.stageReceiptDigest, subjectReceiptDigest: candidate.subjectReceiptDigest, observationReceiptDigest: candidate.observationReceiptDigest,
        conflictReceiptDigest: candidate.conflictReceiptDigest, evidenceReceiptDigest: candidate.evidenceReceiptDigest, assessmentReceiptDigest: candidate.assessmentReceiptDigest,
        reviewState: candidate.reviewState, updatedAt: candidate.updatedAt } } : {}), observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary }
    return changeConflictDetectionProjectionSchema.parse({ ...body, snapshotDigest: canonicalDigest(body) })
  }
  async healthIssues(): Promise<WorkspaceHealthIssue[]> { const issues: WorkspaceHealthIssue[] = []; for (const candidate of await this.listRecords("change-conflict-detection", currentRecordPattern, changeConflictDetectionSchema)) {
    try { const history = await this.listHistory(candidate.id); if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) throw new Error("Current candidate does not match immutable history")
      if ((await this.assess(candidate.initiativeId)).state === "attention-required") issues.push({ code: "change-conflict-detection.review-required", severity: "warning", message: `Initiative ${candidate.initiativeId} has a stale, incomplete, unavailable, or unresolved Change Conflict Detection candidate.`, record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "create-superseding-revision"] })
    } catch (error) { issues.push({ code: "change-conflict-detection.invalid", severity: "error", message: `Change Conflict Detection ${candidate.id}: ${error instanceof Error ? error.message : "validation failed"}`, record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "manual-repair-required"] }) } } return issues }

  private async readDependencies(initiativeId: string): Promise<{ [K in keyof Dependencies]: Dependencies[K] | undefined }> { const keys = Object.keys(this.readers) as (keyof Dependencies)[], values = await Promise.all(keys.map((key) => this.readers[key].readCurrent(initiativeId))); return Object.fromEntries(keys.map((key, index) => [key, values[index]])) as never }
  private completeDependencies(value: { [K in keyof Dependencies]: Dependencies[K] | undefined }): value is Dependencies { return Object.values(value).every(Boolean) }
  private async requireExactDependencies(input: ChangeConflictDetectionInput): Promise<Dependencies> { const dependencies = await this.readDependencies(input.initiativeId); for (const key of Object.keys(dependencies) as (keyof Dependencies)[]) if (!sameReference(input.dependencies[key], dependencies[key])) throw new Error(`Change Conflict Detection must reference the exact current ${key}`); if (!this.completeDependencies(dependencies)) throw new Error("Change Conflict Detection dependencies are incomplete"); return dependencies }
  private validateCandidate(input: ChangeConflictDetectionInput, d: Dependencies, product: Product, initiative: Initiative): void {
    for (const dependency of Object.values(d)) if (dependency.productId !== product.id || dependency.initiativeId !== initiative.id || canonicalDigest(dependency.context) !== canonicalDigest(input.context)) throw new Error("Change Conflict Detection dependencies must bind the exact current Product, Initiative, and context")
    if (!sameReference(d.proposedChangePreview.changedUnitInventory, d.changedUnitInventory) || !sameReference(d.stagingWorkspace.proposedChangePreview, d.proposedChangePreview) ||
        !sameReference(d.providerSwitchImplementation.proposedChangePreview, d.proposedChangePreview) || !sameReference(d.providerSwitchImplementation.stagingWorkspace, d.stagingWorkspace) ||
        !sameReference(d.modelSwitchImplementation.proposedChangePreview, d.proposedChangePreview) || !sameReference(d.modelSwitchImplementation.stagingWorkspace, d.stagingWorkspace) ||
        !sameReference(d.modelSwitchImplementation.providerSwitchImplementation, d.providerSwitchImplementation) || !sameReference(d.applyDiscardFoundation.dependencies.changedUnitInventory, d.changedUnitInventory) ||
        !sameReference(d.applyDiscardFoundation.dependencies.proposedChangePreview, d.proposedChangePreview) || !sameReference(d.applyDiscardFoundation.dependencies.stagingWorkspace, d.stagingWorkspace) ||
        !sameReference(d.scopedApply.dependencies.stagingWorkspace, d.stagingWorkspace) || !sameReference(d.scopedApply.dependencies.applyDiscardFoundation, d.applyDiscardFoundation) ||
        !sameReference(d.rollbackRecovery.dependencies.stagingWorkspace, d.stagingWorkspace) || !sameReference(d.rollbackRecovery.dependencies.applyDiscardFoundation, d.applyDiscardFoundation) ||
        !sameReference(d.rollbackRecovery.dependencies.scopedApply, d.scopedApply)) throw new Error("Change Conflict Detection predecessor continuity is stale")
    if ([d.stagingWorkspace.stagingIdentity, d.applyDiscardFoundation.stageIdentity, d.scopedApply.stageIdentity, d.rollbackRecovery.stageIdentity].some((stage) => canonicalDigest(stage) !== canonicalDigest(input.stageIdentity))) throw new Error("Change Conflict Detection must bind the exact stage identity and generation")
    if (input.subjects.length !== d.scopedApply.selectedPaths.length) throw new Error("Change Conflict Detection requires one subject per exact scoped selection")
    for (const subject of input.subjects) {
      const selected = d.scopedApply.selectedPaths.find((path) => path.id === subject.scopedApplySelectedPathId), changedUnit = d.changedUnitInventory.units.find((unit) => unit.pathCandidates.some((path) => path.id === subject.changedPathId))
      const changed = changedUnit?.pathCandidates.find((path) => path.id === subject.changedPathId), previewUnit = d.proposedChangePreview.previewUnits.find((unit) => unit.changedUnitCandidateId === changedUnit?.id)
      const preview = previewUnit?.pathPreviews.find((path) => path.id === subject.proposedPreviewPathId && path.changedPathCandidateId === subject.changedPathId)
      const staged = d.stagingWorkspace.units.flatMap((unit) => unit.pathCandidates).find((path) => path.id === subject.stagingPathId)
      const foundation = d.applyDiscardFoundation.paths.find((path) => path.stagingPathId === subject.stagingPathId)
      const recovery = d.rollbackRecovery.subjects.find((entry) => entry.id === subject.rollbackRecoverySubjectId)
      const providerPath = d.providerSwitchImplementation.units.flatMap((unit) => unit.paths).find((path) => path.stagingPathId === subject.stagingPathId)
      if (!selected || !changed || !preview || !staged || !foundation || !recovery || !providerPath) throw new Error("Change Conflict Detection contains a missing changed, preview, stage, decision, selection, recovery, or handoff subject")
      if (selected.stagingPathId !== staged.id || selected.changedPathId !== changed.id || recovery.scopedApplySelectedPathId !== selected.id || recovery.stagingPathId !== staged.id ||
          [selected.pathCandidate, changed.pathCandidate, preview.pathCandidate, staged.pathCandidate, foundation.pathCandidate, recovery.pathCandidate, providerPath.pathCandidate].some((path) => path !== subject.pathCandidate) ||
          subject.baselineDigestCandidate !== canonicalDigest(preview.source) || subject.stagedTargetDigestCandidate !== canonicalDigest(preview.target) ||
          subject.handoff.providerSwitchId !== d.providerSwitchImplementation.id || subject.handoff.modelSwitchId !== d.modelSwitchImplementation.id ||
          subject.handoff.providerHandoffReceiptDigest !== d.providerSwitchImplementation.handoff.handoffReceiptDigest ||
          subject.handoff.modelTransitionReceiptDigest !== d.modelSwitchImplementation.transition.transitionReceiptDigest) throw new Error("Change Conflict Detection does not preserve exact path, endpoint, handoff, selection, and recovery continuity")
    }
  }
  private composeDigests(input: ChangeConflictDetectionInput) { const dependencyReceiptDigest = canonicalDigest(input.dependencies), stageReceiptDigest = canonicalDigest(input.stageIdentity), subjectReceiptDigest = canonicalDigest(input.subjects.map(({ findings: _findings, ...subject }) => subject)), observationReceiptDigest = canonicalDigest(input.subjects.map((subject) => ({ current: subject.currentContentDigestCandidate, currentState: subject.currentObservationState, handoff: subject.handoff }))), conflictReceiptDigest = canonicalDigest(input.subjects.map((subject) => ({ id: subject.id, findings: subject.findings }))), evidenceReceiptDigest = canonicalDigest({ evidenceReferences: input.evidenceReferences, subjects: input.subjects.map((subject) => subject.evidenceReferences), findings: input.subjects.flatMap((subject) => subject.findings.map((finding) => finding.evidenceReferences)) }); const assessmentReceiptDigest = canonicalDigest({ dependencyReceiptDigest, stageReceiptDigest, subjectReceiptDigest, observationReceiptDigest, conflictReceiptDigest, evidenceReceiptDigest, preconditions: input.preconditions, unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations, reviewState: input.reviewState, repositoryTruthState: input.repositoryTruthState, sourceTruthState: input.sourceTruthState, conflictAbsenceTruthState: input.conflictAbsenceTruthState, sourceInspectionState: input.sourceInspectionState, sourceMutationState: input.sourceMutationState, conflictResolutionState: input.conflictResolutionState, outcomeTruthState: input.outcomeTruthState, acceptanceState: input.acceptanceState, actionAuthorityState: input.actionAuthorityState }); return { dependencyReceiptDigest, stageReceiptDigest, subjectReceiptDigest, observationReceiptDigest, conflictReceiptDigest, evidenceReceiptDigest, assessmentReceiptDigest } }
  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void { if (initiative.productId !== product.id || canonicalDigest(binding) !== canonicalDigest({ productRevision: revisionOf(product), productDigest: canonicalDigest(product), initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) })) throw new Error("Change Conflict Detection must bind exact current Product and Initiative revisions and digests") }
  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> { const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))]); if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product"); if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Change Conflict Detection is immutable`); return { product, initiative } }
  private async commitVersionedRecord(record: ChangeConflictDetection, eventType: string, actorId: string): Promise<void> { await this.repository.commitMutation({ writes: [this.governed(this.currentPath(record.id), record, changeConflictDetectionSchema), this.governed(this.historyPath(record.id, record.revision), record, changeConflictDetectionSchema)], audit: { eventType, actor: { kind: "human", id: actorId }, subjectId: record.id, payload: { initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record), dependencies: record.dependencies, stageIdentity: record.stageIdentity, subjectCount: record.subjects.length, conflictCandidateCount: record.subjects.flatMap((subject) => subject.findings).filter((finding) => finding.state === "conflict-candidate").length, dependencyReceiptDigest: record.dependencyReceiptDigest, stageReceiptDigest: record.stageReceiptDigest, subjectReceiptDigest: record.subjectReceiptDigest, observationReceiptDigest: record.observationReceiptDigest, conflictReceiptDigest: record.conflictReceiptDigest, evidenceReceiptDigest: record.evidenceReceiptDigest, assessmentReceiptDigest: record.assessmentReceiptDigest, predecessorDigest: record.predecessorDigest, sourceInspectionState: record.sourceInspectionState, sourceMutationState: record.sourceMutationState, conflictResolutionState: record.conflictResolutionState, actionAuthorityState: record.actionAuthorityState, authorityBoundary: record.authorityBoundary } } }) }
  private currentPath(id: string): string { return this.repository.resolve("change-conflict-detection", `${id}.json`) }; private historyPath(id: string, revision: number): string { return this.repository.resolve("change-conflict-detection-history", `change-conflict-detection-${id}-r${revision}.json`) }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }; private requireUuid(value: string, label: string): string { const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data }
  private async assertIntegrity(): Promise<void> { const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed") }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> { let names: string[]; try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) } catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error } if (names.length > inventoryLimit) throw new Error(`Change Conflict Detection directory ${directory} exceeds the safety limit`); const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema))); return records.sort((a, b) => `${String((a as Record<string, unknown>).id ?? "")}:${String((a as Record<string, unknown>).revision ?? "")}`.localeCompare(`${String((b as Record<string, unknown>).id ?? "")}:${String((b as Record<string, unknown>).revision ?? "")}`)) }
}
