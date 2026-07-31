import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  applyDiscardFoundationInputSchema, applyDiscardFoundationProjectionSchema, applyDiscardFoundationSchema,
  applyDiscardFoundationStatusSchema, type ApplyDiscardFoundation, type ApplyDiscardFoundationInput,
  type ApplyDiscardFoundationProjection, type ApplyDiscardFoundationStatus, type BacklogToCodeTraceability,
  type BusinessContextBinding, type ChangedUnitInventory, type ControlledClaudeImplementation,
  type ControlledCodexImplementation, type Initiative, type Product, type ProposedChangePreview,
  type StagingWorkspace, type WorkspaceHealthIssue,
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
  controlledClaudeImplementation: ControlledClaudeImplementation
  backlogToCodeTraceability: BacklogToCodeTraceability
}

const uuidSchema = z.string().uuid(), currentRecordPattern = /^[0-9a-f-]+\.json$/i, inventoryLimit = 10_000
const authorityBoundary = "apply-discard-foundation-is-a-versioned-portable-decision-candidate-and-does-not-establish-real-stage-existence-repository-source-approval-authorization-mutation-apply-discard-recovery-outcome-acceptance-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "apply-discard-foundation-status-is-observational-and-grants-no-stage-repository-source-approval-authorization-mutation-apply-discard-recovery-outcome-acceptance-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "apply-discard-foundation-projection-is-read-only-and-grants-no-stage-repository-source-approval-authorization-mutation-apply-discard-recovery-outcome-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-bounded-stage-path-decision-evidence-identities-states-counts-and-digests-only-not-source-diff-commit-test-result-provider-output-machine-paths-personal-data-secrets-credentials-or-permissions" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference { return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) } }
function sameReference(reference: ExactReference | undefined, record: { id: string; revision?: number } | undefined): boolean {
  return Boolean(reference && record && reference.recordId === record.id && reference.revision === revisionOf(record) && reference.digest === canonicalDigest(record))
}

export class ApplyDiscardFoundationService {
  constructor(private readonly repository: GaepRepository, private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader, private readonly readers: { [K in keyof Dependencies]: CurrentReader<Dependencies[K]> }) {}

  async create(inputValue: ApplyDiscardFoundationInput, actorId: string): Promise<ApplyDiscardFoundation> {
    const input = applyDiscardFoundationInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      if (await this.readCurrent(input.initiativeId)) throw new Error("A current Apply/Discard Foundation candidate already exists; create a revision")
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies, product, initiative)
      const now = new Date().toISOString(), digests = this.composeDigests(input)
      const record = applyDiscardFoundationSchema.parse({ schemaVersion: 1, kind: "apply-discard-foundation-candidate",
        id: randomUUID(), productId: product.id, ...input, revision: 1, ...digests, state: "candidate",
        createdBy: { kind: "human", id: actorId }, updatedBy: { kind: "human", id: actorId },
        createdAt: now, updatedAt: now, authorityBoundary })
      await this.commitVersionedRecord(record, "apply-discard-foundation.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: ApplyDiscardFoundationInput, actorId: string): Promise<ApplyDiscardFoundation> {
    const input = applyDiscardFoundationInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Apply/Discard Foundation revision conflict")
      if (current.initiativeId !== input.initiativeId) throw new Error("Apply/Discard Foundation Initiative binding is immutable")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies, product, initiative)
      const record = applyDiscardFoundationSchema.parse({ ...current, ...input, revision: current.revision + 1,
        ...this.composeDigests(input), predecessorDigest: canonicalDigest(current), updatedBy: { kind: "human", id: actorId }, updatedAt: new Date().toISOString() })
      await this.commitVersionedRecord(record, "apply-discard-foundation.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<ApplyDiscardFoundation> { return this.repository.readJson(this.currentPath(this.requireUuid(id, "Apply/Discard Foundation ID")), applyDiscardFoundationSchema) }
  async readCurrent(initiativeId: string): Promise<ApplyDiscardFoundation | undefined> {
    const target = this.requireUuid(initiativeId, "Initiative ID")
    const matches = (await this.listRecords("apply-discard-foundation", currentRecordPattern, applyDiscardFoundationSchema)).filter((record) => record.initiativeId === target)
    if (matches.length > 1) throw new Error("Multiple current Apply/Discard Foundation candidates target one Initiative")
    return matches[0]
  }
  async readRevision(id: string, revision: number): Promise<ApplyDiscardFoundation> {
    const recordId = this.requireUuid(id, "Apply/Discard Foundation ID")
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Revision must be a positive integer")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), applyDiscardFoundationSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Apply/Discard Foundation history binding mismatch")
    return record
  }
  async listHistory(id: string): Promise<ApplyDiscardFoundation[]> {
    const recordId = this.requireUuid(id, "Apply/Discard Foundation ID")
    const records = await this.listRecords("apply-discard-foundation-history", new RegExp(`^apply-discard-foundation-${recordId}-r[1-9][0-9]*\\.json$`, "i"), applyDiscardFoundationSchema)
    return records.sort((left, right) => right.revision - left.revision)
  }

  async assess(initiativeId: string): Promise<ApplyDiscardFoundationStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, dependencies] = await Promise.all([this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), this.readDependencies(targetId)])
    const reasons: string[] = []
    let staleBindingCount = 0, coverageGapCount = 0, invalidCandidateCount = 0
    if (!candidate) reasons.push("No current Apply/Discard Foundation candidate is recorded")
    if (Object.values(dependencies).some((value) => !value)) reasons.push("One or more required apply/discard predecessor candidates are unavailable")
    if (candidate) {
      for (const key of Object.keys(dependencies) as (keyof Dependencies)[]) if (!sameReference(candidate.dependencies[key], dependencies[key])) staleBindingCount += 1
      const stagePathCount = dependencies.stagingWorkspace?.units.flatMap((unit) => unit.pathCandidates).length ?? 0
      if (candidate.paths.length !== stagePathCount) coverageGapCount = Math.abs(candidate.paths.length - stagePathCount) || 1
      try { if (this.completeDependencies(dependencies)) this.validateCandidate(candidate, dependencies, product, initiative) } catch { invalidCandidateCount += 1 }
    }
    const paths = candidate?.paths ?? []
    const applyCandidateCount = paths.filter((path) => path.disposition === "apply-candidate").length
    const discardCandidateCount = paths.filter((path) => path.disposition === "discard-candidate").length
    const pendingCount = paths.filter((path) => path.disposition === "keep-pending").length
    const exactScopeCount = paths.filter((path) => path.scopeState === "candidate-exact").length
    const gapCount = paths.filter((path) => path.scopeState === "gap").length
    const conflictCount = paths.filter((path) => path.scopeState === "conflict").length
    const stalePathCount = paths.filter((path) => path.scopeState === "stale").length
    const notAssessedCount = paths.filter((path) => path.scopeState === "not-assessed").length
    if (staleBindingCount) reasons.push("One or more exact predecessor bindings are stale")
    if (coverageGapCount) reasons.push("The candidate stage path catalog is not covered one-for-one")
    if (gapCount + conflictCount + stalePathCount + notAssessedCount) reasons.push("One or more decision paths are incomplete, conflicting, stale, or not assessed")
    if (invalidCandidateCount) reasons.push("Stage, decision, scope, or recovery continuity is invalid")
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    if (unresolvedQuestionCount) reasons.push("The candidate records unresolved questions")
    const reviewState = candidate?.reviewState ?? "draft"
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    const blocking = staleBindingCount + coverageGapCount + gapCount + conflictCount + stalePathCount + notAssessedCount + invalidCandidateCount + unresolvedQuestionCount
    return applyDiscardFoundationStatusSchema.parse({ schemaVersion: 1, kind: "apply-discard-foundation-status", productId: product.id,
      productRevision: revisionOf(product), initiativeId: initiative.id, initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate), dependencies: candidate.dependencies, stageKey: candidate.stageIdentity.stageKey,
        stageGeneration: candidate.stageIdentity.generation, decision: candidate.decision } : {}), pathCount: paths.length,
      applyCandidateCount, discardCandidateCount, pendingCount, exactScopeCount, gapCount, conflictCount, stalePathCount,
      notAssessedCount, staleBindingCount, coverageGapCount, invalidCandidateCount, unresolvedQuestionCount, reviewState,
      state: candidate && this.completeDependencies(dependencies) && blocking === 0 && reviewState === "ready-for-human-review" ? "candidate-defined" : "attention-required",
      reasons, assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary })
  }

  async project(initiativeId: string): Promise<ApplyDiscardFoundationProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId)])
    const withoutDigest = { schemaVersion: 1 as const, kind: "apply-discard-foundation-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state }, status,
      ...(candidate ? { candidate: { id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate),
        stageIdentity: candidate.stageIdentity, decision: candidate.decision,
        paths: candidate.paths.map((path) => ({ id: path.id, decisionPathKey: path.decisionPathKey, backlogTraceKey: path.backlogTraceKey,
          pathCandidate: path.pathCandidate, disposition: path.disposition, scopeState: path.scopeState })),
        dependencyReceiptDigest: candidate.dependencyReceiptDigest, stageReceiptDigest: candidate.stageReceiptDigest,
        decisionReceiptDigest: candidate.decisionReceiptDigest, scopeReceiptDigest: candidate.scopeReceiptDigest,
        recoveryReceiptDigest: candidate.recoveryReceiptDigest, evidenceReceiptDigest: candidate.evidenceReceiptDigest,
        assessmentReceiptDigest: candidate.assessmentReceiptDigest, reviewState: candidate.reviewState, updatedAt: candidate.updatedAt } } : {}),
      observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary }
    return applyDiscardFoundationProjectionSchema.parse({ ...withoutDigest, snapshotDigest: canonicalDigest(withoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    for (const candidate of await this.listRecords("apply-discard-foundation", currentRecordPattern, applyDiscardFoundationSchema)) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) throw new Error("Current candidate does not match immutable history")
        if ((await this.assess(candidate.initiativeId)).state === "attention-required") issues.push({ code: "apply-discard-foundation.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has a stale, incomplete, conflicting, or unresolved Apply/Discard Foundation candidate.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "create-superseding-revision"] })
      } catch (error) { issues.push({ code: "apply-discard-foundation.invalid", severity: "error",
        message: `Apply/Discard Foundation ${candidate.id}: ${error instanceof Error ? error.message : "validation failed"}`,
        record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "manual-repair-required"] }) }
    }
    return issues
  }

  private async readDependencies(initiativeId: string): Promise<{ [K in keyof Dependencies]: Dependencies[K] | undefined }> {
    const keys = Object.keys(this.readers) as (keyof Dependencies)[]
    const values = await Promise.all(keys.map((key) => this.readers[key].readCurrent(initiativeId)))
    return Object.fromEntries(keys.map((key, index) => [key, values[index]])) as { [K in keyof Dependencies]: Dependencies[K] | undefined }
  }
  private completeDependencies(value: { [K in keyof Dependencies]: Dependencies[K] | undefined }): value is Dependencies { return Object.values(value).every(Boolean) }
  private async requireExactDependencies(input: ApplyDiscardFoundationInput): Promise<Dependencies> {
    const dependencies = await this.readDependencies(input.initiativeId)
    for (const key of Object.keys(dependencies) as (keyof Dependencies)[]) if (!sameReference(input.dependencies[key], dependencies[key])) throw new Error(`Apply/Discard Foundation must reference the exact current ${key}`)
    if (!this.completeDependencies(dependencies)) throw new Error("Apply/Discard Foundation dependencies are incomplete")
    return dependencies
  }

  private validateCandidate(input: ApplyDiscardFoundationInput, dependencies: Dependencies, product: Product, initiative: Initiative): void {
    for (const dependency of Object.values(dependencies)) if (dependency.productId !== product.id || dependency.initiativeId !== initiative.id || canonicalDigest(dependency.context) !== canonicalDigest(input.context)) {
      throw new Error("Apply/Discard Foundation dependencies must bind the exact current Product, Initiative, and context")
    }
    if (!sameReference(dependencies.proposedChangePreview.changedUnitInventory, dependencies.changedUnitInventory) ||
        !sameReference(dependencies.stagingWorkspace.proposedChangePreview, dependencies.proposedChangePreview) ||
        !sameReference(dependencies.controlledCodexImplementation.proposedChangePreview, dependencies.proposedChangePreview) ||
        !sameReference(dependencies.controlledCodexImplementation.stagingWorkspace, dependencies.stagingWorkspace) ||
        !sameReference(dependencies.controlledClaudeImplementation.proposedChangePreview, dependencies.proposedChangePreview) ||
        !sameReference(dependencies.controlledClaudeImplementation.stagingWorkspace, dependencies.stagingWorkspace) ||
        !sameReference(dependencies.backlogToCodeTraceability.dependencies.changedUnitInventory, dependencies.changedUnitInventory) ||
        !sameReference(dependencies.backlogToCodeTraceability.dependencies.proposedChangePreview, dependencies.proposedChangePreview)) {
      throw new Error("Apply/Discard Foundation predecessor continuity is stale")
    }
    if (canonicalDigest(input.stageIdentity) !== canonicalDigest(dependencies.stagingWorkspace.stagingIdentity)) throw new Error("Apply/Discard Foundation must bind the exact stage identity and generation")
    const stagedPaths = dependencies.stagingWorkspace.units.flatMap((unit) => unit.pathCandidates.map((path) => ({ unit, path })))
    if (input.paths.length !== stagedPaths.length) throw new Error("Apply/Discard Foundation requires one decision path per exact staging path")
    for (const decision of input.paths) {
      const staged = stagedPaths.find(({ unit, path }) => unit.id === decision.stagingUnitId && path.id === decision.stagingPathId)
      const previewUnit = dependencies.proposedChangePreview.previewUnits.find((unit) => unit.id === decision.proposedPreviewUnitId)
      const previewPath = previewUnit?.pathPreviews.find((path) => path.id === decision.proposedPreviewPathId)
      const changedUnit = dependencies.changedUnitInventory.units.find((unit) => unit.id === decision.changedUnitId)
      const changedPath = changedUnit?.pathCandidates.find((path) => path.id === decision.changedPathId)
      const trace = dependencies.backlogToCodeTraceability.traces.find((entry) => entry.id === decision.backlogTraceId)
      const codexUnit = dependencies.controlledCodexImplementation.units.find((unit) => unit.stagingUnitId === decision.stagingUnitId)
      const codexPath = codexUnit?.paths.find((path) => path.stagingPathId === decision.stagingPathId)
      const claudeUnit = dependencies.controlledClaudeImplementation.units.find((unit) => unit.stagingUnitId === decision.stagingUnitId)
      const claudePath = claudeUnit?.paths.find((path) => path.stagingPathId === decision.stagingPathId)
      if (!staged || !previewUnit || !previewPath || !changedUnit || !changedPath || !trace || !codexPath || !claudePath) throw new Error("Apply/Discard Foundation contains a missing change, preview, stage, controlled plan, or backlog trace subject")
      if (staged.unit.proposedPreviewUnitId !== previewUnit.id || staged.path.proposedPathPreviewId !== previewPath.id ||
          previewUnit.changedUnitCandidateId !== changedUnit.id || previewPath.changedPathCandidateId !== changedPath.id ||
          staged.unit.implementationUnitId !== decision.implementationUnitId || changedUnit.implementationUnitId !== decision.implementationUnitId ||
          trace.changedUnitId !== changedUnit.id || trace.changedPathId !== changedPath.id || trace.implementationUnitId !== decision.implementationUnitId ||
          trace.traceKey !== decision.backlogTraceKey || staged.path.pathCandidate !== decision.pathCandidate ||
          previewPath.pathCandidate !== decision.pathCandidate || changedPath.pathCandidate !== decision.pathCandidate || trace.pathCandidate !== decision.pathCandidate ||
          codexPath.pathCandidate !== decision.pathCandidate || claudePath.pathCandidate !== decision.pathCandidate ||
          decision.stagingPathDigest !== canonicalDigest(staged.path) || codexPath.stagingPathDigest !== decision.stagingPathDigest ||
          claudePath.stagingPathDigest !== decision.stagingPathDigest) throw new Error("Apply/Discard Foundation does not preserve exact change, preview, stage, plan, backlog, and path continuity")
    }
  }

  private composeDigests(input: ApplyDiscardFoundationInput) {
    const dependencyReceiptDigest = canonicalDigest(input.dependencies), stageReceiptDigest = canonicalDigest(input.stageIdentity)
    const decisionReceiptDigest = canonicalDigest({ decision: input.decision, decisionActor: input.decisionActor, decidedAt: input.decidedAt,
      paths: input.paths.map((path) => ({ id: path.id, disposition: path.disposition })) })
    const scopeReceiptDigest = canonicalDigest(input.paths.map((path) => ({ id: path.id, changedUnitId: path.changedUnitId,
      changedPathId: path.changedPathId, stagingPathId: path.stagingPathId, backlogTraceId: path.backlogTraceId,
      implementationUnitId: path.implementationUnitId, pathCandidate: path.pathCandidate, scopeState: path.scopeState })))
    const recoveryReceiptDigest = canonicalDigest(input.recovery)
    const evidenceReceiptDigest = canonicalDigest(input.paths.map((path) => ({ id: path.id, evidenceReferences: path.evidenceReferences,
      conflictReferenceCandidates: path.conflictReferenceCandidates })))
    const assessmentReceiptDigest = canonicalDigest({ dependencyReceiptDigest, stageReceiptDigest, decisionReceiptDigest, scopeReceiptDigest,
      recoveryReceiptDigest, evidenceReceiptDigest, preconditions: input.preconditions, unresolvedQuestions: input.unresolvedQuestions,
      limitations: input.limitations, reviewState: input.reviewState, actualStageExistenceState: input.actualStageExistenceState,
      repositoryTruthState: input.repositoryTruthState, sourceTruthState: input.sourceTruthState, approvalState: input.approvalState,
      authorizationState: input.authorizationState, sourceMutationState: input.sourceMutationState, applyState: input.applyState,
      discardState: input.discardState, recoveryExecutionState: input.recoveryExecutionState, outcomeTruthState: input.outcomeTruthState,
      acceptanceState: input.acceptanceState, actionAuthorityState: input.actionAuthorityState })
    return { dependencyReceiptDigest, stageReceiptDigest, decisionReceiptDigest, scopeReceiptDigest, recoveryReceiptDigest, evidenceReceiptDigest, assessmentReceiptDigest }
  }
  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id || canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) throw new Error("Apply/Discard Foundation must bind exact current Product and Initiative revisions and digests")
  }
  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding { return { productRevision: revisionOf(product), productDigest: canonicalDigest(product), initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) } }
  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Apply/Discard Foundation is immutable`)
    return { product, initiative }
  }
  private async commitVersionedRecord(record: ApplyDiscardFoundation, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({ writes: [this.governed(this.currentPath(record.id), record, applyDiscardFoundationSchema),
      this.governed(this.historyPath(record.id, record.revision), record, applyDiscardFoundationSchema)],
      audit: { eventType, actor: { kind: "human", id: actorId }, subjectId: record.id, payload: { initiativeId: record.initiativeId,
        revision: record.revision, recordDigest: canonicalDigest(record), dependencies: record.dependencies, stageIdentity: record.stageIdentity,
        decision: record.decision, pathCount: record.paths.length, dependencyReceiptDigest: record.dependencyReceiptDigest,
        stageReceiptDigest: record.stageReceiptDigest, decisionReceiptDigest: record.decisionReceiptDigest, scopeReceiptDigest: record.scopeReceiptDigest,
        recoveryReceiptDigest: record.recoveryReceiptDigest, evidenceReceiptDigest: record.evidenceReceiptDigest,
        assessmentReceiptDigest: record.assessmentReceiptDigest, predecessorDigest: record.predecessorDigest,
        sourceMutationState: record.sourceMutationState, applyState: record.applyState, discardState: record.discardState,
        actionAuthorityState: record.actionAuthorityState, authorityBoundary: record.authorityBoundary } } })
  }
  private currentPath(id: string): string { return this.repository.resolve("apply-discard-foundation", `${id}.json`) }
  private historyPath(id: string, revision: number): string { return this.repository.resolve("apply-discard-foundation-history", `apply-discard-foundation-${id}-r${revision}.json`) }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string { const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data }
  private async assertIntegrity(): Promise<void> { const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed") }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error }
    if (names.length > inventoryLimit) throw new Error(`Apply/Discard Foundation directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => `${String((left as Record<string, unknown>).id ?? "")}:${String((left as Record<string, unknown>).revision ?? "")}`.localeCompare(`${String((right as Record<string, unknown>).id ?? "")}:${String((right as Record<string, unknown>).revision ?? "")}`))
  }
}
