import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  scopedApplyInputSchema, scopedApplyProjectionSchema, scopedApplySchema, scopedApplyStatusSchema,
  type ApplyDiscardFoundation, type BacklogToCodeTraceability, type BusinessContextBinding,
  type ChangedUnitInventory, type ControlledCodexImplementation, type Initiative, type Product,
  type ProposedChangePreview, type ScopedApply, type ScopedApplyInput, type ScopedApplyProjection,
  type ScopedApplyStatus, type StagingWorkspace, type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type CurrentReader<T> = { readCurrent(initiativeId: string): Promise<T | undefined> }
type ExactReference = { recordId: string; revision: number; digest: string }
interface Dependencies {
  changedUnitInventory: ChangedUnitInventory
  proposedChangePreview: ProposedChangePreview
  stagingWorkspace: StagingWorkspace
  controlledCodexImplementation: ControlledCodexImplementation
  backlogToCodeTraceability: BacklogToCodeTraceability
  applyDiscardFoundation: ApplyDiscardFoundation
}

const uuidSchema = z.string().uuid(), currentRecordPattern = /^[0-9a-f-]+\.json$/i, inventoryLimit = 10_000
const authorityBoundary = "scoped-apply-is-a-versioned-portable-subset-selection-candidate-and-does-not-establish-stage-repository-source-approval-authorization-mutation-apply-discard-recovery-outcome-acceptance-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "scoped-apply-status-is-observational-and-grants-no-stage-repository-source-approval-authorization-mutation-apply-discard-recovery-outcome-acceptance-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "scoped-apply-projection-is-read-only-and-grants-no-stage-repository-source-approval-authorization-mutation-apply-discard-recovery-outcome-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-bounded-stage-path-selection-exclusion-envelope-evidence-identities-states-counts-and-digests-only-not-source-diff-commit-provider-output-machine-paths-personal-data-secrets-credentials-or-permissions" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference { return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) } }
function sameReference(reference: ExactReference | undefined, record: { id: string; revision?: number } | undefined): boolean {
  return Boolean(reference && record && reference.recordId === record.id && reference.revision === revisionOf(record) && reference.digest === canonicalDigest(record))
}

export class ScopedApplyService {
  constructor(private readonly repository: GaepRepository, private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader, private readonly readers: { [K in keyof Dependencies]: CurrentReader<Dependencies[K]> }) {}

  async create(inputValue: ScopedApplyInput, actorId: string): Promise<ScopedApply> {
    const input = scopedApplyInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      if (await this.readCurrent(input.initiativeId)) throw new Error("A current Scoped Apply candidate already exists; create a revision")
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies, product, initiative)
      const now = new Date().toISOString()
      const record = scopedApplySchema.parse({ schemaVersion: 1, kind: "scoped-apply-candidate", id: randomUUID(), productId: product.id,
        ...input, revision: 1, ...this.composeDigests(input), state: "candidate", createdBy: { kind: "human", id: actorId },
        updatedBy: { kind: "human", id: actorId }, createdAt: now, updatedAt: now, authorityBoundary })
      await this.commitVersionedRecord(record, "scoped-apply.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: ScopedApplyInput, actorId: string): Promise<ScopedApply> {
    const input = scopedApplyInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Scoped Apply revision conflict")
      if (current.initiativeId !== input.initiativeId) throw new Error("Scoped Apply Initiative binding is immutable")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies, product, initiative)
      const record = scopedApplySchema.parse({ ...current, ...input, revision: current.revision + 1, ...this.composeDigests(input),
        predecessorDigest: canonicalDigest(current), updatedBy: { kind: "human", id: actorId }, updatedAt: new Date().toISOString() })
      await this.commitVersionedRecord(record, "scoped-apply.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<ScopedApply> { return this.repository.readJson(this.currentPath(this.requireUuid(id, "Scoped Apply ID")), scopedApplySchema) }
  async readCurrent(initiativeId: string): Promise<ScopedApply | undefined> {
    const target = this.requireUuid(initiativeId, "Initiative ID")
    const matches = (await this.listRecords("scoped-apply", currentRecordPattern, scopedApplySchema)).filter((record) => record.initiativeId === target)
    if (matches.length > 1) throw new Error("Multiple current Scoped Apply candidates target one Initiative")
    return matches[0]
  }
  async readRevision(id: string, revision: number): Promise<ScopedApply> {
    const recordId = this.requireUuid(id, "Scoped Apply ID")
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Revision must be a positive integer")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), scopedApplySchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Scoped Apply history binding mismatch")
    return record
  }
  async listHistory(id: string): Promise<ScopedApply[]> {
    const recordId = this.requireUuid(id, "Scoped Apply ID")
    const records = await this.listRecords("scoped-apply-history", new RegExp(`^scoped-apply-${recordId}-r[1-9][0-9]*\\.json$`, "i"), scopedApplySchema)
    return records.sort((left, right) => right.revision - left.revision)
  }

  async assess(initiativeId: string): Promise<ScopedApplyStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, dependencies] = await Promise.all([this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), this.readDependencies(targetId)])
    const reasons: string[] = []
    let staleBindingCount = 0, coverageGapCount = 0, invalidCandidateCount = 0
    if (!candidate) reasons.push("No current Scoped Apply candidate is recorded")
    if (Object.values(dependencies).some((value) => !value)) reasons.push("One or more required Scoped Apply predecessor candidates are unavailable")
    const stagePathCount = dependencies.stagingWorkspace?.units.flatMap((unit) => unit.pathCandidates).length ?? 0
    if (candidate) {
      for (const key of Object.keys(dependencies) as (keyof Dependencies)[]) if (!sameReference(candidate.dependencies[key], dependencies[key])) staleBindingCount += 1
      const partitionCount = candidate.selectedPaths.length + candidate.excludedPaths.length
      if (partitionCount !== stagePathCount) coverageGapCount = Math.abs(partitionCount - stagePathCount) || 1
      try { if (this.completeDependencies(dependencies)) this.validateCandidate(candidate, dependencies, product, initiative) } catch { invalidCandidateCount += 1 }
    }
    const selected = candidate?.selectedPaths ?? []
    const exactScopeCount = selected.filter((path) => path.scopeState === "candidate-exact").length
    const gapCount = selected.filter((path) => path.scopeState === "gap").length
    const conflictCount = selected.filter((path) => path.scopeState === "conflict").length
    const stalePathCount = selected.filter((path) => path.scopeState === "stale").length
    const outOfEnvelopeCount = selected.filter((path) => path.scopeState === "out-of-envelope").length
    const notAssessedCount = selected.filter((path) => path.scopeState === "not-assessed").length
    if (staleBindingCount) reasons.push("One or more exact predecessor bindings are stale")
    if (coverageGapCount) reasons.push("Selected and excluded paths do not partition the exact stage catalog")
    if (gapCount + conflictCount + stalePathCount + outOfEnvelopeCount + notAssessedCount) reasons.push("One or more selected paths are incomplete, conflicting, stale, outside the envelope, or not assessed")
    if (invalidCandidateCount) reasons.push("Scoped selection, exclusion, envelope, or recovery continuity is invalid")
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    if (unresolvedQuestionCount) reasons.push("The candidate records unresolved questions")
    const reviewState = candidate?.reviewState ?? "draft"
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    const blocking = staleBindingCount + coverageGapCount + gapCount + conflictCount + stalePathCount + outOfEnvelopeCount + notAssessedCount + invalidCandidateCount + unresolvedQuestionCount
    return scopedApplyStatusSchema.parse({ schemaVersion: 1, kind: "scoped-apply-status", productId: product.id, productRevision: revisionOf(product),
      initiativeId: initiative.id, initiativeRevision: revisionOf(initiative), ...(candidate ? { candidate: exactReference(candidate), dependencies: candidate.dependencies,
        stageKey: candidate.stageIdentity.stageKey, stageGeneration: candidate.stageIdentity.generation } : {}), stagePathCount,
      selectedPathCount: selected.length, excludedPathCount: candidate?.excludedPaths.length ?? 0, exactScopeCount, gapCount, conflictCount,
      stalePathCount, outOfEnvelopeCount, notAssessedCount, staleBindingCount, coverageGapCount, invalidCandidateCount,
      unresolvedQuestionCount, reviewState, state: candidate && this.completeDependencies(dependencies) && blocking === 0 && reviewState === "ready-for-human-review" ? "candidate-defined" : "attention-required",
      reasons, assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary })
  }

  async project(initiativeId: string): Promise<ScopedApplyProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId)])
    const withoutDigest = { schemaVersion: 1 as const, kind: "scoped-apply-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state }, status,
      ...(candidate ? { candidate: { id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), stageIdentity: candidate.stageIdentity,
        selectedPaths: candidate.selectedPaths.map((path) => ({ id: path.id, selectionKey: path.selectionKey, pathCandidate: path.pathCandidate, scopeState: path.scopeState })),
        excludedPaths: candidate.excludedPaths.map((path) => ({ id: path.id, exclusionKey: path.exclusionKey, pathCandidate: path.pathCandidate, reason: path.reason })),
        writeEnvelopeCandidates: candidate.writeEnvelopeCandidates, dependencyReceiptDigest: candidate.dependencyReceiptDigest,
        stageReceiptDigest: candidate.stageReceiptDigest, selectionReceiptDigest: candidate.selectionReceiptDigest,
        exclusionReceiptDigest: candidate.exclusionReceiptDigest, envelopeReceiptDigest: candidate.envelopeReceiptDigest,
        recoveryReceiptDigest: candidate.recoveryReceiptDigest, evidenceReceiptDigest: candidate.evidenceReceiptDigest,
        assessmentReceiptDigest: candidate.assessmentReceiptDigest, reviewState: candidate.reviewState, updatedAt: candidate.updatedAt } } : {}),
      observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary }
    return scopedApplyProjectionSchema.parse({ ...withoutDigest, snapshotDigest: canonicalDigest(withoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    for (const candidate of await this.listRecords("scoped-apply", currentRecordPattern, scopedApplySchema)) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) throw new Error("Current candidate does not match immutable history")
        if ((await this.assess(candidate.initiativeId)).state === "attention-required") issues.push({ code: "scoped-apply.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has a stale, incomplete, conflicting, or unresolved Scoped Apply candidate.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "create-superseding-revision"] })
      } catch (error) { issues.push({ code: "scoped-apply.invalid", severity: "error", message: `Scoped Apply ${candidate.id}: ${error instanceof Error ? error.message : "validation failed"}`,
        record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "manual-repair-required"] }) }
    }
    return issues
  }

  private async readDependencies(initiativeId: string): Promise<{ [K in keyof Dependencies]: Dependencies[K] | undefined }> {
    const keys = Object.keys(this.readers) as (keyof Dependencies)[], values = await Promise.all(keys.map((key) => this.readers[key].readCurrent(initiativeId)))
    return Object.fromEntries(keys.map((key, index) => [key, values[index]])) as { [K in keyof Dependencies]: Dependencies[K] | undefined }
  }
  private completeDependencies(value: { [K in keyof Dependencies]: Dependencies[K] | undefined }): value is Dependencies { return Object.values(value).every(Boolean) }
  private async requireExactDependencies(input: ScopedApplyInput): Promise<Dependencies> {
    const dependencies = await this.readDependencies(input.initiativeId)
    for (const key of Object.keys(dependencies) as (keyof Dependencies)[]) if (!sameReference(input.dependencies[key], dependencies[key])) throw new Error(`Scoped Apply must reference the exact current ${key}`)
    if (!this.completeDependencies(dependencies)) throw new Error("Scoped Apply dependencies are incomplete")
    return dependencies
  }

  private validateCandidate(input: ScopedApplyInput, dependencies: Dependencies, product: Product, initiative: Initiative): void {
    for (const dependency of Object.values(dependencies)) if (dependency.productId !== product.id || dependency.initiativeId !== initiative.id || canonicalDigest(dependency.context) !== canonicalDigest(input.context)) throw new Error("Scoped Apply dependencies must bind the exact current Product, Initiative, and context")
    if (!sameReference(dependencies.proposedChangePreview.changedUnitInventory, dependencies.changedUnitInventory) ||
        !sameReference(dependencies.stagingWorkspace.proposedChangePreview, dependencies.proposedChangePreview) ||
        !sameReference(dependencies.controlledCodexImplementation.proposedChangePreview, dependencies.proposedChangePreview) ||
        !sameReference(dependencies.controlledCodexImplementation.stagingWorkspace, dependencies.stagingWorkspace) ||
        !sameReference(dependencies.backlogToCodeTraceability.dependencies.changedUnitInventory, dependencies.changedUnitInventory) ||
        !sameReference(dependencies.backlogToCodeTraceability.dependencies.proposedChangePreview, dependencies.proposedChangePreview) ||
        !sameReference(dependencies.applyDiscardFoundation.dependencies.changedUnitInventory, dependencies.changedUnitInventory) ||
        !sameReference(dependencies.applyDiscardFoundation.dependencies.proposedChangePreview, dependencies.proposedChangePreview) ||
        !sameReference(dependencies.applyDiscardFoundation.dependencies.stagingWorkspace, dependencies.stagingWorkspace) ||
        !sameReference(dependencies.applyDiscardFoundation.dependencies.controlledCodexImplementation, dependencies.controlledCodexImplementation) ||
        !sameReference(dependencies.applyDiscardFoundation.dependencies.backlogToCodeTraceability, dependencies.backlogToCodeTraceability)) throw new Error("Scoped Apply predecessor continuity is stale")
    if (dependencies.applyDiscardFoundation.decision !== "apply-entire-stage-candidate" || dependencies.applyDiscardFoundation.paths.some((path) => path.disposition !== "apply-candidate")) throw new Error("Scoped Apply requires an exact current P3B-13 apply decision candidate; whole-stage discard remains distinct")
    if (canonicalDigest(input.stageIdentity) !== canonicalDigest(dependencies.stagingWorkspace.stagingIdentity) || canonicalDigest(input.stageIdentity) !== canonicalDigest(dependencies.applyDiscardFoundation.stageIdentity)) throw new Error("Scoped Apply must bind the exact stage identity and generation")
    const staged = dependencies.stagingWorkspace.units.flatMap((unit) => unit.pathCandidates.map((path) => ({ unit, path })))
    const partition = [...input.selectedPaths, ...input.excludedPaths]
    if (partition.length !== staged.length || new Set(partition.map((path) => path.stagingPathId)).size !== staged.length) throw new Error("Scoped Apply selected and excluded paths must partition every exact stage path once")
    for (const candidate of partition) {
      const stage = staged.find(({ path }) => path.id === candidate.stagingPathId)
      const foundation = dependencies.applyDiscardFoundation.paths.find((path) => path.id === candidate.decisionPathId && path.stagingPathId === candidate.stagingPathId)
      const changedUnit = dependencies.changedUnitInventory.units.find((unit) => unit.pathCandidates.some((path) => path.id === candidate.changedPathId))
      const changedPath = changedUnit?.pathCandidates.find((path) => path.id === candidate.changedPathId)
      const previewUnit = dependencies.proposedChangePreview.previewUnits.find((unit) => unit.changedUnitCandidateId === changedUnit?.id)
      const previewPath = previewUnit?.pathPreviews.find((path) => path.changedPathCandidateId === candidate.changedPathId)
      const trace = dependencies.backlogToCodeTraceability.traces.find((entry) => entry.id === candidate.backlogTraceId)
      const codexUnit = dependencies.controlledCodexImplementation.units.find((unit) => unit.stagingUnitId === stage?.unit.id)
      const codexPath = codexUnit?.paths.find((path) => path.stagingPathId === candidate.stagingPathId)
      if (!stage || !foundation || !changedPath || !previewPath || !trace || !codexPath) throw new Error("Scoped Apply contains a missing change, preview, stage, controlled plan, backlog trace, or P3B-13 subject")
      if (stage.path.pathCandidate !== candidate.pathCandidate || changedPath.pathCandidate !== candidate.pathCandidate || previewPath.pathCandidate !== candidate.pathCandidate ||
          trace.pathCandidate !== candidate.pathCandidate || codexPath.pathCandidate !== candidate.pathCandidate || foundation.pathCandidate !== candidate.pathCandidate ||
          trace.changedPathId !== candidate.changedPathId || foundation.changedPathId !== candidate.changedPathId || foundation.backlogTraceId !== candidate.backlogTraceId ||
          candidate.stagingPathDigest !== canonicalDigest(stage.path) || codexPath.stagingPathDigest !== candidate.stagingPathDigest || foundation.stagingPathDigest !== candidate.stagingPathDigest) throw new Error("Scoped Apply does not preserve exact changed-path, preview, stage, plan, backlog-trace, and foundation continuity")
    }
    for (const selected of input.selectedPaths) if (!dependencies.controlledCodexImplementation.resourceScopes.includes(selected.pathCandidate) ||
        selected.writeEnvelopeCandidate !== selected.pathCandidate || !input.writeEnvelopeCandidates.includes(selected.pathCandidate)) throw new Error("Scoped Apply selection is outside the exact controlled write envelope")
    if (input.writeEnvelopeCandidates.some((path) => !input.selectedPaths.some((selected) => selected.pathCandidate === path))) throw new Error("Scoped Apply write envelope cannot include an excluded or unknown path")
  }

  private composeDigests(input: ScopedApplyInput) {
    const dependencyReceiptDigest = canonicalDigest(input.dependencies), stageReceiptDigest = canonicalDigest(input.stageIdentity)
    const selectionReceiptDigest = canonicalDigest({ selectionActor: input.selectionActor, selectedAt: input.selectedAt, selectedPaths: input.selectedPaths })
    const exclusionReceiptDigest = canonicalDigest(input.excludedPaths), envelopeReceiptDigest = canonicalDigest(input.writeEnvelopeCandidates)
    const recoveryReceiptDigest = canonicalDigest(input.recovery)
    const evidenceReceiptDigest = canonicalDigest({ selected: input.selectedPaths.map((path) => path.evidenceReferences), excluded: input.excludedPaths.map((path) => path.evidenceReferences) })
    const assessmentReceiptDigest = canonicalDigest({ dependencyReceiptDigest, stageReceiptDigest, selectionReceiptDigest, exclusionReceiptDigest,
      envelopeReceiptDigest, recoveryReceiptDigest, evidenceReceiptDigest, preconditions: input.preconditions, unresolvedQuestions: input.unresolvedQuestions,
      limitations: input.limitations, reviewState: input.reviewState, stageTruthState: input.stageTruthState, repositoryTruthState: input.repositoryTruthState,
      sourceTruthState: input.sourceTruthState, approvalState: input.approvalState, authorizationState: input.authorizationState,
      sourceMutationState: input.sourceMutationState, applyState: input.applyState, wholeStageDiscardState: input.wholeStageDiscardState,
      recoveryExecutionState: input.recoveryExecutionState, outcomeTruthState: input.outcomeTruthState,
      acceptanceState: input.acceptanceState, actionAuthorityState: input.actionAuthorityState })
    return { dependencyReceiptDigest, stageReceiptDigest, selectionReceiptDigest, exclusionReceiptDigest, envelopeReceiptDigest, recoveryReceiptDigest, evidenceReceiptDigest, assessmentReceiptDigest }
  }
  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void { if (initiative.productId !== product.id || canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) throw new Error("Scoped Apply must bind exact current Product and Initiative revisions and digests") }
  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding { return { productRevision: revisionOf(product), productDigest: canonicalDigest(product), initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) } }
  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> { const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))]); if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product"); if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Scoped Apply is immutable`); return { product, initiative } }
  private async commitVersionedRecord(record: ScopedApply, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({ writes: [this.governed(this.currentPath(record.id), record, scopedApplySchema), this.governed(this.historyPath(record.id, record.revision), record, scopedApplySchema)],
      audit: { eventType, actor: { kind: "human", id: actorId }, subjectId: record.id, payload: { initiativeId: record.initiativeId, revision: record.revision,
        recordDigest: canonicalDigest(record), dependencies: record.dependencies, stageIdentity: record.stageIdentity,
        selectedPathCount: record.selectedPaths.length, excludedPathCount: record.excludedPaths.length,
        dependencyReceiptDigest: record.dependencyReceiptDigest, stageReceiptDigest: record.stageReceiptDigest,
        selectionReceiptDigest: record.selectionReceiptDigest, exclusionReceiptDigest: record.exclusionReceiptDigest,
        envelopeReceiptDigest: record.envelopeReceiptDigest, recoveryReceiptDigest: record.recoveryReceiptDigest,
        evidenceReceiptDigest: record.evidenceReceiptDigest, assessmentReceiptDigest: record.assessmentReceiptDigest,
        predecessorDigest: record.predecessorDigest, sourceMutationState: record.sourceMutationState, applyState: record.applyState,
        wholeStageDiscardState: record.wholeStageDiscardState, actionAuthorityState: record.actionAuthorityState, authorityBoundary: record.authorityBoundary } } })
  }
  private currentPath(id: string): string { return this.repository.resolve("scoped-apply", `${id}.json`) }
  private historyPath(id: string, revision: number): string { return this.repository.resolve("scoped-apply-history", `scoped-apply-${id}-r${revision}.json`) }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string { const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data }
  private async assertIntegrity(): Promise<void> { const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed") }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> { let names: string[]; try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) } catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error } if (names.length > inventoryLimit) throw new Error(`Scoped Apply directory ${directory} exceeds the safety limit`); const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema))); return records.sort((left, right) => `${String((left as Record<string, unknown>).id ?? "")}:${String((left as Record<string, unknown>).revision ?? "")}`.localeCompare(`${String((right as Record<string, unknown>).id ?? "")}:${String((right as Record<string, unknown>).revision ?? "")}`)) }
}
