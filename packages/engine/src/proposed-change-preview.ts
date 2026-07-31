import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  proposedChangePreviewInputSchema, proposedChangePreviewProjectionSchema, proposedChangePreviewSchema,
  proposedChangePreviewStatusSchema, type BusinessContextBinding, type ChangedUnitInventory,
  type Initiative, type Product, type ProposedChangePreview, type ProposedChangePreviewInput,
  type ProposedChangePreviewProjection, type ProposedChangePreviewStatus, type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type InventoryReader = { readCurrent(initiativeId: string): Promise<ChangedUnitInventory | undefined> }
type ExactReference = { recordId: string; revision: number; digest: string }

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "proposed-change-preview-is-a-versioned-pre-apply-candidate-and-does-not-establish-repository-path-source-target-or-diff-truth-approved-change-scope-or-change-approval-code-mutation-staging-apply-discard-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "proposed-change-preview-status-is-observational-and-does-not-establish-repository-path-source-target-or-diff-truth-approved-change-scope-or-change-approval-code-mutation-staging-apply-discard-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "proposed-change-preview-projection-is-read-only-and-does-not-establish-repository-path-source-target-or-diff-truth-approved-change-scope-or-change-approval-code-mutation-staging-apply-discard-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-repository-relative-path-candidates-change-kinds-endpoint-and-diff-metadata-counts-statuses-and-receipt-digests-only-not-file-or-diff-content-evidence-content-personal-data-secrets-credentials-or-machine-paths" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}
function sameReference(reference: ExactReference | undefined, record: { id: string; revision?: number } | undefined): boolean {
  return Boolean(reference && record && reference.recordId === record.id && reference.revision === revisionOf(record) && reference.digest === canonicalDigest(record))
}
function sameStrings(left: readonly string[], right: readonly string[]): boolean { return canonicalDigest(left) === canonicalDigest(right) }

export class ProposedChangePreviewService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly changedUnitInventory: InventoryReader,
  ) {}

  async create(inputValue: ProposedChangePreviewInput, actorId: string): Promise<ProposedChangePreview> {
    const input = proposedChangePreviewInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const inventory = await this.requireExactInventory(input)
      this.validatePreview(input, inventory)
      if (await this.readCurrent(initiative.id)) throw new Error("An Initiative can have only one current Proposed Change Preview candidate")
      const now = new Date().toISOString()
      const record = proposedChangePreviewSchema.parse({
        schemaVersion: 1, kind: "proposed-change-preview-candidate", id: randomUUID(), productId: product.id,
        ...input, initiativeId: initiative.id, revision: 1, ...this.composeDigests(input), state: "candidate",
        createdBy: { kind: "human", id: actorId }, updatedBy: { kind: "human", id: actorId },
        createdAt: now, updatedAt: now, authorityBoundary,
      })
      await this.commitVersionedRecord(record, "proposed-change-preview.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: ProposedChangePreviewInput, actorId: string): Promise<ProposedChangePreview> {
    const input = proposedChangePreviewInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Proposed Change Preview revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Proposed Change Preview Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const inventory = await this.requireExactInventory(input)
      this.validatePreview(input, inventory)
      const record = proposedChangePreviewSchema.parse({
        ...current, ...input, productId: product.id, initiativeId: initiative.id, revision: current.revision + 1,
        ...this.composeDigests(input), predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId }, updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, "proposed-change-preview.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<ProposedChangePreview> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Proposed Change Preview ID")), proposedChangePreviewSchema)
  }

  async readCurrent(initiativeId: string): Promise<ProposedChangePreview | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const matches = (await this.listRecords("proposed-change-previews", currentRecordPattern, proposedChangePreviewSchema))
      .filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Proposed Change Preview candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<ProposedChangePreview> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Proposed Change Preview history revision must be a positive integer")
    const recordId = this.requireUuid(id, "Proposed Change Preview ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), proposedChangePreviewSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Proposed Change Preview history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<ProposedChangePreview[]> {
    const recordId = this.requireUuid(id, "Proposed Change Preview ID")
    const records = await this.listRecords("proposed-change-preview-history",
      new RegExp(`^proposed-change-preview-${recordId}-r[1-9][0-9]*\\.json$`, "iu"), proposedChangePreviewSchema)
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Proposed Change Preview history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<ProposedChangePreviewStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, inventory] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), this.changedUnitInventory.readCurrent(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const staleBindingCount = candidate && canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative)) ? 1 : 0
    const staleInventoryCount = candidate && !sameReference(candidate.changedUnitInventory, inventory) ? 1 : 0
    const sourceUnits = inventory?.units ?? [], units = candidate?.previewUnits ?? []
    const inventoryPathCount = sourceUnits.reduce((sum, unit) => sum + unit.pathCandidates.length, 0)
    const previewPathCount = units.reduce((sum, unit) => sum + unit.pathPreviews.length, 0)
    const sourceUnitIds = new Set(sourceUnits.map((unit) => unit.id))
    const orphanUnitCount = units.filter((unit) => !sourceUnitIds.has(unit.changedUnitCandidateId)).length + sourceUnits.filter((unit) => !units.some((entry) => entry.changedUnitCandidateId === unit.id)).length
    let orphanPathCount = 0
    for (const unit of units) {
      const sourceUnit = sourceUnits.find((entry) => entry.id === unit.changedUnitCandidateId)
      const sourcePathIds = new Set(sourceUnit?.pathCandidates.map((path) => path.id) ?? [])
      orphanPathCount += unit.pathPreviews.filter((path) => !sourcePathIds.has(path.changedPathCandidateId)).length
      orphanPathCount += (sourceUnit?.pathCandidates ?? []).filter((path) => !unit.pathPreviews.some((entry) => entry.changedPathCandidateId === path.id)).length
    }
    const paths = units.flatMap((unit) => unit.pathPreviews)
    const count = (outcome: ProposedChangePreviewInput["previewUnits"][number]["outcome"]) => units.filter((unit) => unit.outcome === outcome).length
    const endpointGapCount = paths.filter((path) => ["unavailable", "not-assessed"].includes(path.source.state) || ["unavailable", "not-assessed"].includes(path.target.state)).length
    const diffGapCount = paths.filter((path) => path.diff.state !== "candidate-generated").length
    const traceGapCount = paths.filter((path) => !path.traceDigest).length
    const evidenceGapCount = units.filter((unit) => unit.evidenceReferences.length === 0 || unit.pathPreviews.some((path) => path.evidenceReferences.length === 0)).length
    let invalidCandidateCount = 0
    if (candidate) {
      const digests = this.composeDigests(candidate)
      if (Object.entries(digests).some(([name, digest]) => candidate[name as keyof typeof digests] !== digest)) invalidCandidateCount = 1
      try { if (inventory) this.validatePreview(candidate, inventory) } catch { invalidCandidateCount = 1 }
    }
    const candidatePreviewedCount = count("candidate-previewed"), gapCount = count("gap"), conflictCount = count("conflict")
    const staleCount = count("stale"), notAssessedCount = count("not-assessed"), unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft", reasons: string[] = []
    if (!candidate) reasons.push("No versioned Proposed Change Preview candidate exists for this Initiative")
    if (!inventory) reasons.push("No current Changed Unit Inventory candidate exists for the preview")
    if (staleBindingCount) reasons.push("The preview candidate does not bind the exact current Product and Initiative")
    if (staleInventoryCount) reasons.push("The preview candidate does not bind the exact current Changed Unit Inventory")
    if (orphanUnitCount) reasons.push("The preview does not cover the exact current Changed Unit Inventory units")
    if (orphanPathCount) reasons.push("The preview does not cover the exact current Changed Unit Inventory paths")
    if (endpointGapCount) reasons.push("One or more preview paths lack bounded source or target endpoint metadata")
    if (diffGapCount) reasons.push("One or more preview paths lack generated diff metadata")
    if (traceGapCount) reasons.push("One or more preview paths lack an exact inventory trace digest")
    if (evidenceGapCount) reasons.push("One or more preview units or paths lack attributable evidence")
    if (gapCount) reasons.push("One or more preview units record gaps")
    if (conflictCount) reasons.push("One or more preview units record conflicts")
    if (staleCount) reasons.push("One or more preview units record stale observations")
    if (notAssessedCount) reasons.push("One or more preview units remain not assessed")
    if (invalidCandidateCount) reasons.push("The preview candidate receipts or exact inventory traces are invalid")
    if (unresolvedQuestionCount) reasons.push("The preview candidate records unresolved questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The preview candidate is not marked ready for human review")
    const blocking = gapCount + conflictCount + staleCount + notAssessedCount + orphanUnitCount + orphanPathCount + endpointGapCount + diffGapCount + traceGapCount + evidenceGapCount + staleBindingCount + staleInventoryCount + invalidCandidateCount + unresolvedQuestionCount
    return proposedChangePreviewStatusSchema.parse({
      schemaVersion: 1, kind: "proposed-change-preview-status", productId: product.id, productRevision: revisionOf(product), initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative), ...(candidate ? { candidate: exactReference(candidate), changedUnitInventory: candidate.changedUnitInventory } : {}),
      inventoryUnitCount: sourceUnits.length, inventoryPathCount, previewUnitCount: units.length, previewPathCount,
      candidatePreviewedCount, gapCount, conflictCount, staleCount, notAssessedCount, orphanUnitCount, orphanPathCount,
      endpointGapCount, diffGapCount, traceGapCount, evidenceGapCount, staleBindingCount, staleInventoryCount,
      invalidCandidateCount, unresolvedQuestionCount, reviewState,
      state: candidate && inventory && blocking === 0 && reviewState === "ready-for-human-review" ? "candidate-previewed" : "attention-required",
      reasons, assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary,
    })
  }

  async project(initiativeId: string): Promise<ProposedChangePreviewProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) || status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Proposed Change Preview projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const, kind: "proposed-change-preview-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state }, status,
      ...(candidate ? { candidate: { id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        dependencyReceiptDigest: candidate.dependencyReceiptDigest, planReceiptDigest: candidate.planReceiptDigest,
        diffReceiptDigest: candidate.diffReceiptDigest, traceReceiptDigest: candidate.traceReceiptDigest,
        evidenceReceiptDigest: candidate.evidenceReceiptDigest, assessmentReceiptDigest: candidate.assessmentReceiptDigest,
        reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
        units: candidate.previewUnits.map((unit) => ({ implementationUnitId: unit.implementationUnitId, implementationUnitKey: unit.implementationUnitKey,
          outcome: unit.outcome, paths: unit.pathPreviews.map((path) => ({ pathCandidate: path.pathCandidate,
            ...(path.sourcePathCandidate ? { sourcePathCandidate: path.sourcePathCandidate } : {}), changeKind: path.changeKind,
            sourceState: path.source.state, targetState: path.target.state, diffState: path.diff.state, diffFormat: path.diff.format,
            ...(path.diff.patchDigest ? { patchDigest: path.diff.patchDigest, addedLineCount: path.diff.addedLineCount, removedLineCount: path.diff.removedLineCount } : {}),
            truncated: path.diff.truncated })) })) } } : {}),
      observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary,
    }
    return proposedChangePreviewProjectionSchema.parse({ ...projectionWithoutDigest, snapshotDigest: canonicalDigest(projectionWithoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("proposed-change-previews", currentRecordPattern, proposedChangePreviewSchema)
    for (const candidate of records) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) throw new Error("Current candidate does not match complete immutable history")
        if ((await this.assess(candidate.initiativeId)).state === "attention-required") issues.push({ code: "proposed-change-preview.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has a stale, incomplete, conflicted, or unresolved Proposed Change Preview candidate.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "create-superseding-revision"] })
      } catch (error) {
        issues.push({ code: "proposed-change-preview.invalid", severity: "error",
          message: `Proposed Change Preview ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "manual-repair-required"] })
      }
    }
    return issues
  }

  private validatePreview(input: ProposedChangePreviewInput, inventory: ChangedUnitInventory): void {
    if (input.previewUnits.length !== inventory.units.length) throw new Error("Proposed Change Preview requires exactly one preview unit for every current inventory unit")
    for (const [unitIndex, sourceUnit] of inventory.units.entries()) {
      const unit = input.previewUnits[unitIndex]
      if (!unit || unit.changedUnitCandidateId !== sourceUnit.id || unit.implementationUnitId !== sourceUnit.implementationUnitId || unit.implementationUnitKey !== sourceUnit.implementationUnitKey) {
        throw new Error("Preview units must follow exact current Changed Unit Inventory ordering and identity")
      }
      if (!sameStrings(unit.dependencyUnitIds, sourceUnit.dependencyUnitIds) || !sameStrings(unit.directBlastRadiusUnitIds, sourceUnit.directBlastRadiusUnitIds) || !sameStrings(unit.indirectBlastRadiusUnitIds, sourceUnit.indirectBlastRadiusUnitIds)) {
        throw new Error("Preview units must retain exact current dependency and blast-radius candidates")
      }
      if (unit.pathPreviews.length !== sourceUnit.pathCandidates.length) throw new Error("Preview units require exactly one preview for every current inventory path")
      for (const [pathIndex, sourcePath] of sourceUnit.pathCandidates.entries()) {
        const path = unit.pathPreviews[pathIndex]
        if (!path || path.changedPathCandidateId !== sourcePath.id || path.pathCandidate !== sourcePath.pathCandidate || path.sourcePathCandidate !== sourcePath.sourcePathCandidate || path.changeKind !== sourcePath.changeKind) {
          throw new Error("Path previews must retain exact current inventory path ordering, identity, location, and change kind")
        }
        const expectedTraceDigest = canonicalDigest({ changedPathCandidateId: sourcePath.id, backlogNodeIds: sourcePath.backlogNodeIds,
          requirementKeys: sourcePath.requirementKeys, designToCodeBindingSubjectIds: sourcePath.designToCodeBindingSubjectIds,
          routeScreenComponentSubjectIds: sourcePath.routeScreenComponentSubjectIds, testAssetIds: sourcePath.testAssetIds, riskKeys: sourcePath.riskKeys })
        if (path.traceDigest !== expectedTraceDigest) throw new Error("Path preview trace digest must bind the exact current inventory trace")
      }
    }
  }

  private composeDigests(input: ProposedChangePreviewInput) {
    const dependencyReceiptDigest = canonicalDigest({ context: input.context, changedUnitInventory: input.changedUnitInventory })
    const planReceiptDigest = canonicalDigest(input.previewUnits.map((unit) => ({ id: unit.id, ordinal: unit.ordinal, changedUnitCandidateId: unit.changedUnitCandidateId,
      implementationUnitId: unit.implementationUnitId, paths: unit.pathPreviews.map((path) => ({ id: path.id, ordinal: path.ordinal,
        changedPathCandidateId: path.changedPathCandidateId, pathCandidate: path.pathCandidate, sourcePathCandidate: path.sourcePathCandidate,
        changeKind: path.changeKind, planOperations: path.planOperations })) })))
    const diffReceiptDigest = canonicalDigest(input.previewUnits.map((unit) => ({ unitId: unit.id, paths: unit.pathPreviews.map((path) => ({ pathId: path.id,
      source: path.source, target: path.target, diff: path.diff })) })))
    const traceReceiptDigest = canonicalDigest(input.previewUnits.map((unit) => ({ unitId: unit.id, paths: unit.pathPreviews.map((path) => ({ pathId: path.id, traceDigest: path.traceDigest })) })))
    const evidenceReceiptDigest = canonicalDigest(input.previewUnits.map((unit) => ({ unitId: unit.id, evidenceReferences: unit.evidenceReferences,
      paths: unit.pathPreviews.map((path) => ({ pathId: path.id, evidenceReferences: path.evidenceReferences })) })))
    const assessmentReceiptDigest = canonicalDigest({ dependencyReceiptDigest, planReceiptDigest, diffReceiptDigest, traceReceiptDigest, evidenceReceiptDigest,
      outcomes: input.previewUnits.map((unit) => ({ unitId: unit.id, outcome: unit.outcome, paths: unit.pathPreviews.map((path) => ({ pathId: path.id, outcome: path.outcome })) })),
      unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations, reviewState: input.reviewState,
      repositoryTruthState: input.repositoryTruthState, pathTruthState: input.pathTruthState, sourceObservationTruthState: input.sourceObservationTruthState,
      targetProposalTruthState: input.targetProposalTruthState, diffTruthState: input.diffTruthState, changeScopeApprovalState: input.changeScopeApprovalState,
      changeApprovalState: input.changeApprovalState, codeMutationState: input.codeMutationState, stagingState: input.stagingState,
      applyDiscardState: input.applyDiscardState, assignmentExecutionState: input.assignmentExecutionState, acceptanceDecisionState: input.acceptanceDecisionState,
      mergeReadinessState: input.mergeReadinessState, releaseReadinessState: input.releaseReadinessState,
      deploymentReadinessState: input.deploymentReadinessState, actionAuthorityState: input.actionAuthorityState })
    return { dependencyReceiptDigest, planReceiptDigest, diffReceiptDigest, traceReceiptDigest, evidenceReceiptDigest, assessmentReceiptDigest }
  }

  private async requireExactInventory(input: ProposedChangePreviewInput): Promise<ChangedUnitInventory> {
    const inventory = await this.changedUnitInventory.readCurrent(input.initiativeId)
    if (!inventory) throw new Error("Proposed Change Preview requires the current Changed Unit Inventory candidate")
    if (!sameReference(input.changedUnitInventory, inventory)) throw new Error("Proposed Change Preview must reference the exact current Changed Unit Inventory candidate")
    return inventory
  }
  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Proposed Change Preview Initiative targets a different Product")
    if (canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) throw new Error("Proposed Change Preview must bind the exact current Product and Initiative revisions and digests")
  }
  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return { productRevision: revisionOf(product), productDigest: canonicalDigest(product), initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) }
  }
  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Proposed Change Preview is immutable`)
    return { product, initiative }
  }
  private async commitVersionedRecord(record: ProposedChangePreview, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({ writes: [this.governed(this.currentPath(record.id), record, proposedChangePreviewSchema),
      this.governed(this.historyPath(record.id, record.revision), record, proposedChangePreviewSchema)],
    audit: { eventType, actor: { kind: "human", id: actorId }, subjectId: record.id, payload: {
      initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record),
      changedUnitInventory: record.changedUnitInventory, dependencyReceiptDigest: record.dependencyReceiptDigest,
      planReceiptDigest: record.planReceiptDigest, diffReceiptDigest: record.diffReceiptDigest,
      traceReceiptDigest: record.traceReceiptDigest, evidenceReceiptDigest: record.evidenceReceiptDigest,
      assessmentReceiptDigest: record.assessmentReceiptDigest, predecessorDigest: record.predecessorDigest,
      unitCount: record.previewUnits.length, pathCount: record.previewUnits.reduce((sum, unit) => sum + unit.pathPreviews.length, 0),
      outcomes: record.previewUnits.map((unit) => ({ previewUnitId: unit.id, changedUnitCandidateId: unit.changedUnitCandidateId, outcome: unit.outcome })),
      reviewState: record.reviewState, repositoryTruthState: record.repositoryTruthState, diffTruthState: record.diffTruthState,
      changeScopeApprovalState: record.changeScopeApprovalState, codeMutationState: record.codeMutationState,
      stagingState: record.stagingState, applyDiscardState: record.applyDiscardState,
      actionAuthorityState: record.actionAuthorityState, authorityBoundary: record.authorityBoundary,
    } } })
  }
  private currentPath(id: string): string { return this.repository.resolve("proposed-change-previews", `${id}.json`) }
  private historyPath(id: string, revision: number): string { return this.repository.resolve("proposed-change-preview-history", `proposed-change-preview-${id}-r${revision}.json`) }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string { const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data }
  private async assertIntegrity(): Promise<void> { const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed") }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error }
    if (names.length > inventoryLimit) throw new Error(`Proposed Change Preview directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => `${String((left as Record<string, unknown>).id ?? "")}:${String((left as Record<string, unknown>).revision ?? "")}`.localeCompare(`${String((right as Record<string, unknown>).id ?? "")}:${String((right as Record<string, unknown>).revision ?? "")}`))
  }
}
