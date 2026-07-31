import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  stagingWorkspaceInputSchema, stagingWorkspaceProjectionSchema, stagingWorkspaceSchema, stagingWorkspaceStatusSchema,
  type BusinessContextBinding, type Initiative, type Product, type ProposedChangePreview, type StagingWorkspace,
  type StagingWorkspaceInput, type StagingWorkspaceProjection, type StagingWorkspaceStatus, type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type PreviewReader = { readCurrent(initiativeId: string): Promise<ProposedChangePreview | undefined> }
type ExactReference = { recordId: string; revision: number; digest: string }

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "staging-workspace-is-a-versioned-portable-candidate-and-does-not-establish-real-stage-existence-repository-path-source-target-or-diff-truth-approved-scope-or-change-approval-code-mutation-apply-discard-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "staging-workspace-status-is-observational-and-does-not-establish-real-stage-existence-repository-path-source-target-or-diff-truth-approved-scope-or-change-approval-code-mutation-apply-discard-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "staging-workspace-projection-is-read-only-and-does-not-establish-real-stage-existence-repository-path-source-target-or-diff-truth-approved-scope-or-change-approval-code-mutation-apply-discard-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-repository-relative-path-candidates-staging-identity-lifecycle-capacity-exclusion-recovery-counts-statuses-and-receipt-digests-only-not-machine-stage-paths-file-or-diff-content-evidence-content-personal-data-secrets-or-credentials" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}
function sameReference(reference: ExactReference | undefined, record: { id: string; revision?: number } | undefined): boolean {
  return Boolean(reference && record && reference.recordId === record.id && reference.revision === revisionOf(record) && reference.digest === canonicalDigest(record))
}

export class StagingWorkspaceService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly proposedChangePreview: PreviewReader,
  ) {}

  async create(inputValue: StagingWorkspaceInput, actorId: string): Promise<StagingWorkspace> {
    const input = stagingWorkspaceInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const preview = await this.requireExactPreview(input)
      this.validateCandidate(input, preview, product, initiative)
      if (await this.readCurrent(initiative.id)) throw new Error("An Initiative can have only one current Staging Workspace candidate")
      const now = new Date().toISOString()
      const record = stagingWorkspaceSchema.parse({
        schemaVersion: 1, kind: "staging-workspace-candidate", id: randomUUID(), productId: product.id,
        ...input, initiativeId: initiative.id, revision: 1, ...this.composeDigests(input), state: "candidate",
        createdBy: { kind: "human", id: actorId }, updatedBy: { kind: "human", id: actorId },
        createdAt: now, updatedAt: now, authorityBoundary,
      })
      await this.commitVersionedRecord(record, "staging-workspace.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: StagingWorkspaceInput, actorId: string): Promise<StagingWorkspace> {
    const input = stagingWorkspaceInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Staging Workspace revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Staging Workspace Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const preview = await this.requireExactPreview(input)
      this.validateCandidate(input, preview, product, initiative)
      const record = stagingWorkspaceSchema.parse({
        ...current, ...input, productId: product.id, initiativeId: initiative.id, revision: current.revision + 1,
        ...this.composeDigests(input), predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId }, updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, "staging-workspace.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<StagingWorkspace> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Staging Workspace ID")), stagingWorkspaceSchema)
  }

  async readCurrent(initiativeId: string): Promise<StagingWorkspace | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const matches = (await this.listRecords("staging-workspaces", currentRecordPattern, stagingWorkspaceSchema))
      .filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Staging Workspace candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<StagingWorkspace> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Staging Workspace history revision must be a positive integer")
    const recordId = this.requireUuid(id, "Staging Workspace ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), stagingWorkspaceSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Staging Workspace history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<StagingWorkspace[]> {
    const recordId = this.requireUuid(id, "Staging Workspace ID")
    const records = await this.listRecords("staging-workspace-history",
      new RegExp(`^staging-workspace-${recordId}-r[1-9][0-9]*\\.json$`, "iu"), stagingWorkspaceSchema)
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Staging Workspace history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<StagingWorkspaceStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, preview] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), this.proposedChangePreview.readCurrent(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const staleBindingCount = candidate && canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative)) ? 1 : 0
    const stalePreviewCount = candidate && !sameReference(candidate.proposedChangePreview, preview) ? 1 : 0
    const previewUnits = preview?.previewUnits ?? [], units = candidate?.units ?? []
    const previewPathCount = previewUnits.reduce((sum, unit) => sum + unit.pathPreviews.length, 0)
    const stagingPathCount = units.reduce((sum, unit) => sum + unit.pathCandidates.length, 0)
    const previewUnitIds = new Set(previewUnits.map((unit) => unit.id))
    const orphanUnitCount = units.filter((unit) => !previewUnitIds.has(unit.proposedPreviewUnitId)).length + previewUnits.filter((unit) => !units.some((entry) => entry.proposedPreviewUnitId === unit.id)).length
    let orphanPathCount = 0
    for (const unit of units) {
      const previewUnit = previewUnits.find((entry) => entry.id === unit.proposedPreviewUnitId)
      const previewPathIds = new Set(previewUnit?.pathPreviews.map((path) => path.id) ?? [])
      orphanPathCount += unit.pathCandidates.filter((path) => !previewPathIds.has(path.proposedPathPreviewId)).length
      orphanPathCount += (previewUnit?.pathPreviews ?? []).filter((path) => !unit.pathCandidates.some((entry) => entry.proposedPathPreviewId === path.id)).length
    }
    const paths = units.flatMap((unit) => unit.pathCandidates)
    const count = (outcome: StagingWorkspaceInput["units"][number]["outcome"]) => units.filter((unit) => unit.outcome === outcome).length
    const inspectionGapCount = paths.filter((path) => path.inspectionState !== "candidate-complete").length + (candidate && candidate.lifecycle.inspectionState !== "candidate-complete" ? 1 : 0)
    const expectedExclusion = candidate ? this.expectedExclusionReceipt(candidate) : undefined
    const exclusionGapCount = candidate && (candidate.exclusionRuleIds.length === 0 || candidate.exclusionReceiptDigest !== expectedExclusion) ? 1 : 0
    const expectedFileCount = previewPathCount
    const expectedByteCount = previewUnits.flatMap((unit) => unit.pathPreviews).reduce((sum, path) => sum + (path.target.bytes ?? 0), 0)
    const capacityGapCount = candidate && (candidate.capacity.candidateFileCount !== expectedFileCount || candidate.capacity.candidateByteCount !== expectedByteCount ||
      candidate.capacity.candidateFileCount > candidate.capacity.maximumFiles || candidate.capacity.candidateFileCount > candidate.capacity.maximumChanges || candidate.capacity.candidateByteCount > candidate.capacity.maximumBytes) ? 1 : 0
    const recoveryGapCount = candidate && (candidate.recovery.replayState !== "candidate-defined" || candidate.recovery.checkpointDigest !== this.expectedRecoveryCheckpoint(candidate)) ? 1 : 0
    const evidenceGapCount = units.filter((unit) => unit.evidenceReferences.length === 0 || unit.pathCandidates.some((path) => path.evidenceReferences.length === 0)).length +
      (candidate && (candidate.inspectionEvidenceReferences.length === 0 || candidate.recovery.inspectionEvidenceReferences.length === 0) ? 1 : 0)
    let invalidCandidateCount = 0
    if (candidate) {
      const digests = this.composeDigests(candidate)
      if (Object.entries(digests).some(([name, digest]) => candidate[name as keyof typeof digests] !== digest)) invalidCandidateCount = 1
      try { if (preview) this.validateCandidate(candidate, preview, product, initiative) } catch { invalidCandidateCount = 1 }
    }
    const candidateDefinedCount = count("candidate-defined"), unavailableCount = count("unavailable"), gapCount = count("gap")
    const conflictCount = count("conflict"), staleCount = count("stale"), notAssessedCount = count("not-assessed")
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0, reviewState = candidate?.reviewState ?? "draft", reasons: string[] = []
    if (!candidate) reasons.push("No versioned Staging Workspace candidate exists for this Initiative")
    if (!preview) reasons.push("No current Proposed Change Preview candidate exists for staging")
    if (staleBindingCount) reasons.push("The staging candidate does not bind the exact current Product and Initiative")
    if (stalePreviewCount) reasons.push("The staging candidate does not bind the exact current Proposed Change Preview")
    if (orphanUnitCount) reasons.push("The staging candidate does not cover the exact current preview units")
    if (orphanPathCount) reasons.push("The staging candidate does not cover the exact current preview paths")
    if (inspectionGapCount) reasons.push("One or more staging paths lack complete candidate inspection metadata")
    if (exclusionGapCount) reasons.push("The staging exclusion policy receipt is missing or invalid")
    if (capacityGapCount) reasons.push("The staging candidate scope does not match its declared capacity metadata")
    if (recoveryGapCount) reasons.push("The staging recovery checkpoint candidate is missing or invalid")
    if (evidenceGapCount) reasons.push("One or more staging candidates lack attributable inspection or recovery evidence")
    if (unavailableCount) reasons.push("One or more staging units are unavailable")
    if (gapCount) reasons.push("One or more staging units record gaps")
    if (conflictCount) reasons.push("One or more staging units record conflicts")
    if (staleCount) reasons.push("One or more staging units record stale observations")
    if (notAssessedCount) reasons.push("One or more staging units remain not assessed")
    if (invalidCandidateCount) reasons.push("The staging candidate bindings, receipts, or preview traces are invalid")
    if (unresolvedQuestionCount) reasons.push("The staging candidate records unresolved questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The staging candidate is not marked ready for human review")
    const blocking = unavailableCount + gapCount + conflictCount + staleCount + notAssessedCount + orphanUnitCount + orphanPathCount + inspectionGapCount + exclusionGapCount + capacityGapCount + recoveryGapCount + evidenceGapCount + staleBindingCount + stalePreviewCount + invalidCandidateCount + unresolvedQuestionCount
    return stagingWorkspaceStatusSchema.parse({
      schemaVersion: 1, kind: "staging-workspace-status", productId: product.id, productRevision: revisionOf(product), initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative), ...(candidate ? { candidate: exactReference(candidate), proposedChangePreview: candidate.proposedChangePreview } : {}),
      previewUnitCount: previewUnits.length, previewPathCount, stagingUnitCount: units.length, stagingPathCount,
      candidateDefinedCount, unavailableCount, gapCount, conflictCount, staleCount, notAssessedCount, orphanUnitCount, orphanPathCount,
      inspectionGapCount, exclusionGapCount, capacityGapCount, recoveryGapCount, evidenceGapCount, staleBindingCount, stalePreviewCount,
      invalidCandidateCount, unresolvedQuestionCount, reviewState,
      state: candidate && preview && blocking === 0 && reviewState === "ready-for-human-review" ? "candidate-defined" : "attention-required",
      reasons, assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary,
    })
  }

  async project(initiativeId: string): Promise<StagingWorkspaceProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) || status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Staging Workspace projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const, kind: "staging-workspace-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state }, status,
      ...(candidate ? { candidate: { id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        stagingIdentity: candidate.stagingIdentity, lifecycle: candidate.lifecycle, capacity: candidate.capacity,
        exclusionRuleIds: candidate.exclusionRuleIds, excludedPathCandidateCount: candidate.excludedPathCandidateCount,
        recovery: { strategy: candidate.recovery.strategy, journalKey: candidate.recovery.journalKey, replayState: candidate.recovery.replayState, checkpointDigest: candidate.recovery.checkpointDigest },
        bindingReceiptDigest: candidate.bindingReceiptDigest, inventoryReceiptDigest: candidate.inventoryReceiptDigest,
        lifecycleReceiptDigest: candidate.lifecycleReceiptDigest, exclusionReceiptDigest: candidate.exclusionReceiptDigestVerified,
        capacityReceiptDigest: candidate.capacityReceiptDigest, recoveryReceiptDigest: candidate.recoveryReceiptDigest,
        inspectionReceiptDigest: candidate.inspectionReceiptDigest, assessmentReceiptDigest: candidate.assessmentReceiptDigest,
        reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
        units: candidate.units.map((unit) => ({ implementationUnitId: unit.implementationUnitId, implementationUnitKey: unit.implementationUnitKey,
          outcome: unit.outcome, paths: unit.pathCandidates.map((path) => ({ pathCandidate: path.pathCandidate,
            ...(path.sourcePathCandidate ? { sourcePathCandidate: path.sourcePathCandidate } : {}), changeKind: path.changeKind,
            inspectionState: path.inspectionState, outcome: path.outcome, previewPathDigest: path.previewPathDigest })) })) } } : {}),
      observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary,
    }
    return stagingWorkspaceProjectionSchema.parse({ ...projectionWithoutDigest, snapshotDigest: canonicalDigest(projectionWithoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("staging-workspaces", currentRecordPattern, stagingWorkspaceSchema)
    for (const candidate of records) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) throw new Error("Current candidate does not match complete immutable history")
        if ((await this.assess(candidate.initiativeId)).state === "attention-required") issues.push({ code: "staging-workspace.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has a stale, incomplete, conflicted, or unresolved Staging Workspace candidate.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "create-superseding-revision"] })
      } catch (error) {
        issues.push({ code: "staging-workspace.invalid", severity: "error",
          message: `Staging Workspace ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "manual-repair-required"] })
      }
    }
    return issues
  }

  private validateCandidate(input: StagingWorkspaceInput, preview: ProposedChangePreview, product: Product, initiative: Initiative): void {
    const expectedScopeDigest = canonicalDigest({ product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative) }, proposedChangePreview: input.proposedChangePreview })
    if (input.stagingIdentity.scopeDigest !== expectedScopeDigest) throw new Error("Staging identity scope digest must bind the exact Product, Initiative, and Proposed Change Preview")
    if (input.units.length !== preview.previewUnits.length) throw new Error("Staging Workspace requires exactly one staging unit for every current preview unit")
    for (const [unitIndex, previewUnit] of preview.previewUnits.entries()) {
      const unit = input.units[unitIndex]
      if (!unit || unit.proposedPreviewUnitId !== previewUnit.id || unit.implementationUnitId !== previewUnit.implementationUnitId ||
          unit.implementationUnitKey !== previewUnit.implementationUnitKey || unit.previewUnitDigest !== canonicalDigest(previewUnit)) {
        throw new Error("Staging units must follow exact current Proposed Change Preview ordering, identity, and digest")
      }
      if (unit.pathCandidates.length !== previewUnit.pathPreviews.length) throw new Error("Staging units require exactly one path candidate for every current preview path")
      for (const [pathIndex, previewPath] of previewUnit.pathPreviews.entries()) {
        const path = unit.pathCandidates[pathIndex]
        if (!path || path.proposedPathPreviewId !== previewPath.id || path.pathCandidate !== previewPath.pathCandidate ||
            path.sourcePathCandidate !== previewPath.sourcePathCandidate || path.changeKind !== previewPath.changeKind ||
            path.previewPathDigest !== canonicalDigest(previewPath) || path.sourceEndpointDigest !== canonicalDigest(previewPath.source) ||
            path.targetEndpointDigest !== canonicalDigest(previewPath.target) || path.diffMetadataDigest !== canonicalDigest(previewPath.diff) ||
            path.planOperationsDigest !== canonicalDigest(previewPath.planOperations) || path.traceDigest !== previewPath.traceDigest) {
          throw new Error("Staging paths must bind exact preview path, endpoint, diff, plan, and trace metadata")
        }
        if (path.outcome === "candidate-defined" && previewPath.outcome !== "candidate-previewed") throw new Error("Candidate-defined staging paths require candidate-previewed source paths")
      }
    }
    const expectedFileCount = preview.previewUnits.reduce((sum, unit) => sum + unit.pathPreviews.length, 0)
    const expectedByteCount = preview.previewUnits.flatMap((unit) => unit.pathPreviews).reduce((sum, path) => sum + (path.target.bytes ?? 0), 0)
    if (input.capacity.candidateFileCount !== expectedFileCount || input.capacity.candidateByteCount !== expectedByteCount) {
      throw new Error("Staging capacity metadata must exactly describe the current preview candidate scope")
    }
    if (input.exclusionReceiptDigest !== this.expectedExclusionReceipt(input)) throw new Error("Staging exclusion receipt must bind the exact exclusion policy and preview")
    if (input.recovery.checkpointDigest !== this.expectedRecoveryCheckpoint(input)) throw new Error("Staging recovery checkpoint must bind the exact staging identity, preview, capacity, and exclusion receipt")
  }

  private expectedExclusionReceipt(input: Pick<StagingWorkspaceInput, "exclusionRuleIds" | "excludedPathCandidateCount" | "proposedChangePreview">): string {
    return canonicalDigest({ exclusionRuleIds: input.exclusionRuleIds, excludedPathCandidateCount: input.excludedPathCandidateCount, proposedChangePreview: input.proposedChangePreview })
  }

  private expectedRecoveryCheckpoint(input: Pick<StagingWorkspaceInput, "stagingIdentity" | "proposedChangePreview" | "capacity" | "exclusionReceiptDigest">): string {
    return canonicalDigest({ stagingIdentity: input.stagingIdentity, proposedChangePreview: input.proposedChangePreview,
      capacity: input.capacity, exclusionReceiptDigest: input.exclusionReceiptDigest })
  }

  private composeDigests(input: StagingWorkspaceInput) {
    const bindingReceiptDigest = canonicalDigest({ context: input.context, proposedChangePreview: input.proposedChangePreview, stagingIdentity: input.stagingIdentity })
    const inventoryReceiptDigest = canonicalDigest(input.units.map((unit) => ({ id: unit.id, ordinal: unit.ordinal,
      proposedPreviewUnitId: unit.proposedPreviewUnitId, implementationUnitId: unit.implementationUnitId, previewUnitDigest: unit.previewUnitDigest,
      paths: unit.pathCandidates.map((path) => ({ id: path.id, ordinal: path.ordinal, proposedPathPreviewId: path.proposedPathPreviewId,
        pathCandidate: path.pathCandidate, sourcePathCandidate: path.sourcePathCandidate, changeKind: path.changeKind,
        previewPathDigest: path.previewPathDigest, sourceEndpointDigest: path.sourceEndpointDigest, targetEndpointDigest: path.targetEndpointDigest,
        diffMetadataDigest: path.diffMetadataDigest, planOperationsDigest: path.planOperationsDigest, traceDigest: path.traceDigest })) })))
    const lifecycleReceiptDigest = canonicalDigest(input.lifecycle)
    const exclusionReceiptDigestVerified = canonicalDigest({ supplied: input.exclusionReceiptDigest, expected: this.expectedExclusionReceipt(input) })
    const capacityReceiptDigest = canonicalDigest(input.capacity)
    const recoveryReceiptDigest = canonicalDigest(input.recovery)
    const inspectionReceiptDigest = canonicalDigest({ inspectionEvidenceReferences: input.inspectionEvidenceReferences,
      units: input.units.map((unit) => ({ unitId: unit.id, evidenceReferences: unit.evidenceReferences,
        paths: unit.pathCandidates.map((path) => ({ pathId: path.id, inspectionState: path.inspectionState, evidenceReferences: path.evidenceReferences })) })) })
    const assessmentReceiptDigest = canonicalDigest({ bindingReceiptDigest, inventoryReceiptDigest, lifecycleReceiptDigest,
      exclusionReceiptDigestVerified, capacityReceiptDigest, recoveryReceiptDigest, inspectionReceiptDigest,
      outcomes: input.units.map((unit) => ({ unitId: unit.id, outcome: unit.outcome, paths: unit.pathCandidates.map((path) => ({ pathId: path.id, outcome: path.outcome })) })),
      unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations, reviewState: input.reviewState,
      repositoryTruthState: input.repositoryTruthState, pathTruthState: input.pathTruthState, sourceObservationTruthState: input.sourceObservationTruthState,
      targetProposalTruthState: input.targetProposalTruthState, diffTruthState: input.diffTruthState, approvedScopeState: input.approvedScopeState,
      changeApprovalState: input.changeApprovalState, codeMutationState: input.codeMutationState, realStageCreationState: input.realStageCreationState,
      applyState: input.applyState, discardState: input.discardState, assignmentExecutionState: input.assignmentExecutionState,
      acceptanceDecisionState: input.acceptanceDecisionState, mergeReadinessState: input.mergeReadinessState,
      releaseReadinessState: input.releaseReadinessState, deploymentReadinessState: input.deploymentReadinessState,
      actionAuthorityState: input.actionAuthorityState })
    return { bindingReceiptDigest, inventoryReceiptDigest, lifecycleReceiptDigest, exclusionReceiptDigestVerified,
      capacityReceiptDigest, recoveryReceiptDigest, inspectionReceiptDigest, assessmentReceiptDigest }
  }

  private async requireExactPreview(input: StagingWorkspaceInput): Promise<ProposedChangePreview> {
    const preview = await this.proposedChangePreview.readCurrent(input.initiativeId)
    if (!preview) throw new Error("Staging Workspace requires the current Proposed Change Preview candidate")
    if (!sameReference(input.proposedChangePreview, preview)) throw new Error("Staging Workspace must reference the exact current Proposed Change Preview candidate")
    return preview
  }
  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Staging Workspace Initiative targets a different Product")
    if (canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) throw new Error("Staging Workspace must bind the exact current Product and Initiative revisions and digests")
  }
  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return { productRevision: revisionOf(product), productDigest: canonicalDigest(product), initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) }
  }
  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Staging Workspace is immutable`)
    return { product, initiative }
  }
  private async commitVersionedRecord(record: StagingWorkspace, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({ writes: [this.governed(this.currentPath(record.id), record, stagingWorkspaceSchema),
      this.governed(this.historyPath(record.id, record.revision), record, stagingWorkspaceSchema)],
    audit: { eventType, actor: { kind: "human", id: actorId }, subjectId: record.id, payload: {
      initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record), proposedChangePreview: record.proposedChangePreview,
      stagingIdentity: record.stagingIdentity, bindingReceiptDigest: record.bindingReceiptDigest, inventoryReceiptDigest: record.inventoryReceiptDigest,
      lifecycleReceiptDigest: record.lifecycleReceiptDigest, exclusionReceiptDigest: record.exclusionReceiptDigestVerified,
      capacityReceiptDigest: record.capacityReceiptDigest, recoveryReceiptDigest: record.recoveryReceiptDigest,
      inspectionReceiptDigest: record.inspectionReceiptDigest, assessmentReceiptDigest: record.assessmentReceiptDigest,
      predecessorDigest: record.predecessorDigest, unitCount: record.units.length,
      pathCount: record.units.reduce((sum, unit) => sum + unit.pathCandidates.length, 0),
      outcomes: record.units.map((unit) => ({ stagingUnitId: unit.id, proposedPreviewUnitId: unit.proposedPreviewUnitId, outcome: unit.outcome })),
      lifecycle: record.lifecycle, capacity: record.capacity, exclusionRuleIds: record.exclusionRuleIds,
      reviewState: record.reviewState, realStageCreationState: record.realStageCreationState, codeMutationState: record.codeMutationState,
      applyState: record.applyState, discardState: record.discardState, actionAuthorityState: record.actionAuthorityState,
      authorityBoundary: record.authorityBoundary,
    } } })
  }
  private currentPath(id: string): string { return this.repository.resolve("staging-workspaces", `${id}.json`) }
  private historyPath(id: string, revision: number): string { return this.repository.resolve("staging-workspace-history", `staging-workspace-${id}-r${revision}.json`) }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string { const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data }
  private async assertIntegrity(): Promise<void> { const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed") }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error }
    if (names.length > inventoryLimit) throw new Error(`Staging Workspace directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => `${String((left as Record<string, unknown>).id ?? "")}:${String((left as Record<string, unknown>).revision ?? "")}`.localeCompare(`${String((right as Record<string, unknown>).id ?? "")}:${String((right as Record<string, unknown>).revision ?? "")}`))
  }
}
