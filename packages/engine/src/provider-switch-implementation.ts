import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  providerSwitchImplementationInputSchema, providerSwitchImplementationProjectionSchema,
  providerSwitchImplementationSchema, providerSwitchImplementationStatusSchema,
  type BusinessContextBinding, type ControlledClaudeImplementation, type ControlledCodexImplementation,
  type Initiative, type Product, type ProviderSwitchImplementation, type ProviderSwitchImplementationInput,
  type ProviderSwitchImplementationProjection, type ProviderSwitchImplementationStatus, type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type CodexReader = { readCurrent(initiativeId: string): Promise<ControlledCodexImplementation | undefined> }
type ClaudeReader = { readCurrent(initiativeId: string): Promise<ControlledClaudeImplementation | undefined> }
type ExactReference = { recordId: string; revision: number; digest: string }

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "provider-switch-implementation-is-a-versioned-portable-candidate-and-does-not-establish-provider-transition-handoff-resume-stage-ownership-transfer-approval-authorization-source-mutation-apply-discard-recovery-native-host-live-provider-security-acceptance-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "provider-switch-implementation-status-is-observational-and-grants-no-provider-transition-handoff-resume-stage-transfer-mutation-apply-discard-recovery-acceptance-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "provider-switch-implementation-projection-is-read-only-and-grants-no-provider-transition-handoff-resume-stage-transfer-mutation-apply-discard-recovery-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-repository-relative-path-candidates-provider-model-identifiers-counts-states-and-receipt-digests-only-not-prompts-context-source-diffs-provider-output-machine-paths-personal-data-secrets-or-credentials" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}
function sameReference(reference: ExactReference | undefined, record: { id: string; revision?: number } | undefined): boolean {
  return Boolean(reference && record && reference.recordId === record.id && reference.revision === revisionOf(record) && reference.digest === canonicalDigest(record))
}

export class ProviderSwitchImplementationService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly controlledCodex: CodexReader,
    private readonly controlledClaude: ClaudeReader,
  ) {}

  async create(inputValue: ProviderSwitchImplementationInput, actorId: string): Promise<ProviderSwitchImplementation> {
    const input = providerSwitchImplementationInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies.codex, dependencies.claude, product, initiative)
      if (await this.readCurrent(initiative.id)) throw new Error("An Initiative can have only one current Provider Switch Implementation candidate")
      const now = new Date().toISOString()
      const record = providerSwitchImplementationSchema.parse({
        schemaVersion: 1, kind: "provider-switch-implementation-candidate", id: randomUUID(), productId: product.id,
        ...input, initiativeId: initiative.id, revision: 1, ...this.composeDigests(input), state: "candidate",
        createdBy: { kind: "human", id: actorId }, updatedBy: { kind: "human", id: actorId }, createdAt: now, updatedAt: now, authorityBoundary,
      })
      await this.commitVersionedRecord(record, "provider-switch-implementation.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: ProviderSwitchImplementationInput, actorId: string): Promise<ProviderSwitchImplementation> {
    const input = providerSwitchImplementationInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Provider Switch Implementation revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Provider Switch Implementation Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies.codex, dependencies.claude, product, initiative)
      const record = providerSwitchImplementationSchema.parse({
        ...current, ...input, productId: product.id, initiativeId: initiative.id, revision: current.revision + 1,
        ...this.composeDigests(input), predecessorDigest: canonicalDigest(current), updatedBy: { kind: "human", id: actorId }, updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, "provider-switch-implementation.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<ProviderSwitchImplementation> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Provider Switch Implementation ID")), providerSwitchImplementationSchema)
  }

  async readCurrent(initiativeId: string): Promise<ProviderSwitchImplementation | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const matches = (await this.listRecords("provider-switch-implementations", currentRecordPattern, providerSwitchImplementationSchema))
      .filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Provider Switch Implementation candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<ProviderSwitchImplementation> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Provider Switch Implementation history revision must be positive")
    const recordId = this.requireUuid(id, "Provider Switch Implementation ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), providerSwitchImplementationSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Provider Switch Implementation history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<ProviderSwitchImplementation[]> {
    const recordId = this.requireUuid(id, "Provider Switch Implementation ID")
    const records = await this.listRecords("provider-switch-implementation-history",
      new RegExp(`^provider-switch-implementation-${recordId}-r[1-9][0-9]*\\.json$`, "iu"), providerSwitchImplementationSchema)
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Provider Switch Implementation history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<ProviderSwitchImplementationStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, codex, claude] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId),
      this.controlledCodex.readCurrent(targetId), this.controlledClaude.readCurrent(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const contextStale = candidate && canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative)) ? 1 : 0
    const codexStale = candidate && !sameReference(candidate.controlledCodexImplementation, codex) ? 1 : 0
    const claudeStale = candidate && !sameReference(candidate.controlledClaudeImplementation, claude) ? 1 : 0
    const staleBindingCount = contextStale + codexStale + claudeStale
    let providerGapCount = 0, continuityGapCount = 0, handoffGapCount = 0, invalidCandidateCount = 0
    if (candidate) {
      if (!this.providersMatchDirection(candidate, codex, claude)) providerGapCount = 1
      if (codex && claude && !this.continuityMatches(candidate, codex, claude)) continuityGapCount = 1
      if (candidate.handoff.handoffReceiptDigest !== this.expectedHandoffReceipt(candidate)) handoffGapCount = 1
      try {
        if (codex && claude) this.validateCandidate(candidate, codex, claude, product, initiative)
        const digests = this.composeDigests(candidate)
        if (Object.entries(digests).some(([key, digest]) => candidate[key as keyof typeof digests] !== digest)) invalidCandidateCount = 1
      } catch { invalidCandidateCount = 1 }
    }
    const units = candidate?.units ?? [], paths = units.flatMap((unit) => unit.paths)
    const candidateDefinedCount = units.filter((unit) => unit.outcome === "candidate-defined").length
    const gapCount = units.filter((unit) => unit.outcome !== "candidate-defined").length
    const prerequisiteGapCount = candidate?.prerequisites.filter((entry) => entry.state !== "required-not-established").length ?? 0
    const evidenceGapCount = candidate ? (candidate.evidenceReferences.length === 0 ? 1 : 0) + units.filter((unit) => unit.evidenceReferences.length === 0 || unit.paths.some((path) => path.evidenceReferences.length === 0)).length : 0
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Provider Switch Implementation candidate exists for this Initiative")
    if (!codex) reasons.push("No current Controlled Codex Implementation candidate exists")
    if (!claude) reasons.push("No current Controlled Claude Implementation candidate exists")
    if (staleBindingCount) reasons.push("The provider-switch candidate does not bind the exact current Product, Initiative, Codex, and Claude candidates")
    if (providerGapCount) reasons.push("The source and target provider/model selections do not match the declared switch direction")
    if (continuityGapCount || gapCount) reasons.push("Product, preview, staging, unit, path, plan, evidence, approval, or recovery continuity is incomplete")
    if (handoffGapCount) reasons.push("The non-effectful handoff candidate receipt is invalid")
    if (prerequisiteGapCount) reasons.push("Provider-switch prerequisites are incomplete or non-canonical")
    if (evidenceGapCount) reasons.push("One or more continuity records lack attributable evidence")
    if (invalidCandidateCount) reasons.push("The provider-switch bindings or deterministic receipts are invalid")
    if (unresolvedQuestionCount) reasons.push("The candidate records unresolved questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    const blocking = staleBindingCount + providerGapCount + continuityGapCount + gapCount + handoffGapCount + prerequisiteGapCount + evidenceGapCount + invalidCandidateCount + unresolvedQuestionCount
    return providerSwitchImplementationStatusSchema.parse({
      schemaVersion: 1, kind: "provider-switch-implementation-status", productId: product.id, productRevision: revisionOf(product),
      initiativeId: initiative.id, initiativeRevision: revisionOf(initiative), ...(candidate ? { candidate: exactReference(candidate), proposedChangePreview: candidate.proposedChangePreview,
        stagingWorkspace: candidate.stagingWorkspace, controlledCodexImplementation: candidate.controlledCodexImplementation,
        controlledClaudeImplementation: candidate.controlledClaudeImplementation } : {}),
      unitCount: units.length, pathCount: paths.length, candidateDefinedCount, gapCount, staleBindingCount, providerGapCount, continuityGapCount,
      handoffGapCount, prerequisiteGapCount, evidenceGapCount, invalidCandidateCount, unresolvedQuestionCount, reviewState,
      state: candidate && codex && claude && blocking === 0 && reviewState === "ready-for-human-review" ? "candidate-defined" : "attention-required",
      reasons, assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary,
    })
  }

  async project(initiativeId: string): Promise<ProviderSwitchImplementationProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    const withoutDigest = {
      schemaVersion: 1 as const, kind: "provider-switch-implementation-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state }, status,
      ...(candidate ? { candidate: {
        id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state, direction: candidate.direction,
        sourceProvider: candidate.sourceProvider, targetProvider: candidate.targetProvider, sourceSelection: candidate.sourceSelection, targetSelection: candidate.targetSelection,
        handoff: candidate.handoff, lifecycle: candidate.lifecycle, unitCount: candidate.units.length,
        pathCount: candidate.units.reduce((sum, unit) => sum + unit.paths.length, 0), prerequisiteCount: candidate.prerequisites.length,
        bindingReceiptDigest: candidate.bindingReceiptDigest, providerReceiptDigest: candidate.providerReceiptDigest,
        continuityReceiptDigest: candidate.continuityReceiptDigest, handoffReceiptDigest: candidate.handoffReceiptDigestVerified,
        lifecycleReceiptDigest: candidate.lifecycleReceiptDigest, prerequisiteReceiptDigest: candidate.prerequisiteReceiptDigest,
        assessmentReceiptDigest: candidate.assessmentReceiptDigest, reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
      } } : {}), observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary,
    }
    return providerSwitchImplementationProjectionSchema.parse({ ...withoutDigest, snapshotDigest: canonicalDigest(withoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    for (const candidate of await this.listRecords("provider-switch-implementations", currentRecordPattern, providerSwitchImplementationSchema)) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) throw new Error("Current candidate does not match immutable history")
        if ((await this.assess(candidate.initiativeId)).state === "attention-required") issues.push({ code: "provider-switch-implementation.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has a stale, incomplete, or unresolved Provider Switch Implementation candidate.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "create-superseding-revision"] })
      } catch (error) {
        issues.push({ code: "provider-switch-implementation.invalid", severity: "error", message: `Provider Switch Implementation ${candidate.id}: ${error instanceof Error ? error.message : "validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "manual-repair-required"] })
      }
    }
    return issues
  }

  private async requireExactDependencies(input: ProviderSwitchImplementationInput) {
    const [codex, claude] = await Promise.all([
      this.controlledCodex.readCurrent(input.initiativeId), this.controlledClaude.readCurrent(input.initiativeId),
    ])
    if (!codex || !sameReference(input.controlledCodexImplementation, codex)) throw new Error("Provider Switch Implementation must reference the exact current Controlled Codex Implementation")
    if (!claude || !sameReference(input.controlledClaudeImplementation, claude)) throw new Error("Provider Switch Implementation must reference the exact current Controlled Claude Implementation")
    return { codex, claude }
  }

  private validateCandidate(input: ProviderSwitchImplementationInput, codex: ControlledCodexImplementation, claude: ControlledClaudeImplementation,
    product: Product, initiative: Initiative): void {
    if (codex.productId !== product.id || claude.productId !== product.id || codex.initiativeId !== initiative.id || claude.initiativeId !== initiative.id) {
      throw new Error("Provider-switch controlled candidates must bind the exact current Product and Initiative")
    }
    if (canonicalDigest(codex.context) !== canonicalDigest(input.context) || canonicalDigest(claude.context) !== canonicalDigest(input.context) ||
        canonicalDigest(codex.proposedChangePreview) !== canonicalDigest(input.proposedChangePreview) || canonicalDigest(claude.proposedChangePreview) !== canonicalDigest(input.proposedChangePreview) ||
        canonicalDigest(codex.stagingWorkspace) !== canonicalDigest(input.stagingWorkspace) || canonicalDigest(claude.stagingWorkspace) !== canonicalDigest(input.stagingWorkspace)) {
      throw new Error("Provider-switch Product, preview, and staging continuity must be exact")
    }
    if (!this.providersMatchDirection(input, codex, claude)) throw new Error("Provider-switch direction, providers, models, and selections must exactly match the controlled candidates")
    if (!this.continuityMatches(input, codex, claude)) throw new Error("Provider-switch unit, path, plan, evidence, approval, and recovery continuity must be exact")
    if (input.handoff.handoffReceiptDigest !== this.expectedHandoffReceipt(input)) throw new Error("Provider-switch handoff receipt must exactly bind the non-effectful transition candidate")
    if (canonicalDigest(input.context) !== canonicalDigest(this.exactContext(product, initiative))) throw new Error("Provider Switch Implementation context changed")
  }

  private providersMatchDirection(input: ProviderSwitchImplementationInput, codex?: ControlledCodexImplementation, claude?: ControlledClaudeImplementation): boolean {
    if (!codex || !claude) return false
    const source = input.direction === "codex-to-claude" ? codex : claude
    const target = input.direction === "codex-to-claude" ? claude : codex
    return canonicalDigest(input.sourceProvider) === canonicalDigest(source.provider) && canonicalDigest(input.targetProvider) === canonicalDigest(target.provider) &&
      canonicalDigest(input.sourceSelection) === canonicalDigest(source.selection) && canonicalDigest(input.targetSelection) === canonicalDigest(target.selection) &&
      input.sourcePlanReceiptDigest === source.plan.planReceiptDigest && input.targetPlanReceiptDigest === target.plan.planReceiptDigest &&
      input.sourceRecoveryReceiptDigest === source.recoveryJournal.recoveryReceiptDigest && input.targetRecoveryReceiptDigest === target.recoveryJournal.recoveryReceiptDigest
  }

  private continuityMatches(input: ProviderSwitchImplementationInput, codex: ControlledCodexImplementation, claude: ControlledClaudeImplementation): boolean {
    if (input.units.length !== codex.units.length || input.units.length !== claude.units.length) return false
    return input.units.every((unit, unitIndex) => {
      const codexUnit = codex.units[unitIndex], claudeUnit = claude.units[unitIndex]
      if (!codexUnit || !claudeUnit || unit.proposedPreviewUnitId !== codexUnit.proposedPreviewUnitId || unit.proposedPreviewUnitId !== claudeUnit.proposedPreviewUnitId ||
          unit.stagingUnitId !== codexUnit.stagingUnitId || unit.stagingUnitId !== claudeUnit.stagingUnitId ||
          unit.controlledCodexUnitId !== codexUnit.id || unit.controlledClaudeUnitId !== claudeUnit.id ||
          unit.implementationUnitId !== codexUnit.implementationUnitId || unit.implementationUnitId !== claudeUnit.implementationUnitId ||
          unit.implementationUnitKey !== codexUnit.implementationUnitKey || unit.implementationUnitKey !== claudeUnit.implementationUnitKey ||
          unit.codexUnitPlanReceiptDigest !== codexUnit.unitPlanReceiptDigest || unit.claudeUnitPlanReceiptDigest !== claudeUnit.unitPlanReceiptDigest ||
          unit.paths.length !== codexUnit.paths.length || unit.paths.length !== claudeUnit.paths.length) return false
      const pathsMatch = unit.paths.every((path, pathIndex) => {
        const codexPath = codexUnit.paths[pathIndex], claudePath = claudeUnit.paths[pathIndex]
        if (!codexPath || !claudePath) return false
        const expected = this.expectedPathContinuityReceipt(path)
        return path.proposedPreviewPathId === codexPath.proposedPreviewPathId && path.proposedPreviewPathId === claudePath.proposedPreviewPathId &&
          path.stagingPathId === codexPath.stagingPathId && path.stagingPathId === claudePath.stagingPathId &&
          path.controlledCodexPathId === codexPath.id && path.controlledClaudePathId === claudePath.id &&
          path.pathCandidate === codexPath.pathCandidate && path.pathCandidate === claudePath.pathCandidate &&
          path.codexPlanReceiptDigest === codexPath.stagedEffectReceiptDigest && path.claudePlanReceiptDigest === claudePath.stagedEffectReceiptDigest &&
          path.continuityReceiptDigest === expected
      })
      return pathsMatch && unit.continuityReceiptDigest === this.expectedUnitContinuityReceipt(unit)
    })
  }

  private expectedPathContinuityReceipt(path: ProviderSwitchImplementationInput["units"][number]["paths"][number]): string {
    return canonicalDigest({ proposedPreviewPathId: path.proposedPreviewPathId, stagingPathId: path.stagingPathId,
      controlledCodexPathId: path.controlledCodexPathId, controlledClaudePathId: path.controlledClaudePathId,
      pathCandidate: path.pathCandidate, codexPlanReceiptDigest: path.codexPlanReceiptDigest, claudePlanReceiptDigest: path.claudePlanReceiptDigest })
  }
  private expectedUnitContinuityReceipt(unit: ProviderSwitchImplementationInput["units"][number]): string {
    return canonicalDigest({ proposedPreviewUnitId: unit.proposedPreviewUnitId, stagingUnitId: unit.stagingUnitId,
      controlledCodexUnitId: unit.controlledCodexUnitId, controlledClaudeUnitId: unit.controlledClaudeUnitId,
      implementationUnitId: unit.implementationUnitId, implementationUnitKey: unit.implementationUnitKey,
      codexUnitPlanReceiptDigest: unit.codexUnitPlanReceiptDigest, claudeUnitPlanReceiptDigest: unit.claudeUnitPlanReceiptDigest,
      paths: unit.paths.map((path) => ({ id: path.id, continuityReceiptDigest: path.continuityReceiptDigest })) })
  }
  private expectedHandoffReceipt(input: ProviderSwitchImplementationInput): string {
    return canonicalDigest({ state: input.handoff.state, handoffKey: input.handoff.handoffKey,
      sourceTerminalRunState: input.handoff.sourceTerminalRunState, targetRuntimeReadinessState: input.handoff.targetRuntimeReadinessState,
      stageOwnershipTransferState: input.handoff.stageOwnershipTransferState, resumeState: input.handoff.resumeState,
      direction: input.direction, sourceProvider: input.sourceProvider, targetProvider: input.targetProvider,
      controlledCodexImplementation: input.controlledCodexImplementation, controlledClaudeImplementation: input.controlledClaudeImplementation })
  }
  private composeDigests(input: ProviderSwitchImplementationInput) {
    const bindingReceiptDigest = canonicalDigest({ context: input.context, proposedChangePreview: input.proposedChangePreview,
      stagingWorkspace: input.stagingWorkspace, controlledCodexImplementation: input.controlledCodexImplementation,
      controlledClaudeImplementation: input.controlledClaudeImplementation })
    const providerReceiptDigest = canonicalDigest({ direction: input.direction, sourceSelection: input.sourceSelection, targetSelection: input.targetSelection,
      sourceProvider: input.sourceProvider, targetProvider: input.targetProvider, sourcePlanReceiptDigest: input.sourcePlanReceiptDigest,
      targetPlanReceiptDigest: input.targetPlanReceiptDigest, sourceRecoveryReceiptDigest: input.sourceRecoveryReceiptDigest,
      targetRecoveryReceiptDigest: input.targetRecoveryReceiptDigest })
    const continuityReceiptDigest = canonicalDigest(input.units)
    const handoffReceiptDigestVerified = canonicalDigest({ supplied: input.handoff.handoffReceiptDigest, expected: this.expectedHandoffReceipt(input) })
    const lifecycleReceiptDigest = canonicalDigest(input.lifecycle)
    const prerequisiteReceiptDigest = canonicalDigest(input.prerequisites)
    const assessmentReceiptDigest = canonicalDigest({ bindingReceiptDigest, providerReceiptDigest, continuityReceiptDigest, handoffReceiptDigestVerified,
      lifecycleReceiptDigest, prerequisiteReceiptDigest, outcomes: input.units.map((unit) => ({ id: unit.id, outcome: unit.outcome,
        paths: unit.paths.map((path) => ({ id: path.id, outcome: path.outcome })) })), reviewState: input.reviewState,
      unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations, acceptanceDecisionState: input.acceptanceDecisionState,
      nativeHostAcceptanceState: input.nativeHostAcceptanceState, liveProviderAcceptanceState: input.liveProviderAcceptanceState,
      securityAcceptanceState: input.securityAcceptanceState, releaseReadinessState: input.releaseReadinessState,
      deploymentReadinessState: input.deploymentReadinessState, actionAuthorityState: input.actionAuthorityState })
    return { bindingReceiptDigest, providerReceiptDigest, continuityReceiptDigest, handoffReceiptDigestVerified,
      lifecycleReceiptDigest, prerequisiteReceiptDigest, assessmentReceiptDigest }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id || canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) throw new Error("Provider Switch Implementation must bind exact current Product and Initiative revisions and digests")
  }
  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return { productRevision: revisionOf(product), productDigest: canonicalDigest(product), initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) }
  }
  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Provider Switch Implementation is immutable`)
    return { product, initiative }
  }
  private async commitVersionedRecord(record: ProviderSwitchImplementation, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({ writes: [this.governed(this.currentPath(record.id), record, providerSwitchImplementationSchema),
      this.governed(this.historyPath(record.id, record.revision), record, providerSwitchImplementationSchema)],
    audit: { eventType, actor: { kind: "human", id: actorId }, subjectId: record.id, payload: {
      initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record), direction: record.direction,
      controlledCodexImplementation: record.controlledCodexImplementation, controlledClaudeImplementation: record.controlledClaudeImplementation,
      bindingReceiptDigest: record.bindingReceiptDigest, providerReceiptDigest: record.providerReceiptDigest,
      continuityReceiptDigest: record.continuityReceiptDigest, handoffReceiptDigest: record.handoffReceiptDigestVerified,
      lifecycleReceiptDigest: record.lifecycleReceiptDigest, prerequisiteReceiptDigest: record.prerequisiteReceiptDigest,
      assessmentReceiptDigest: record.assessmentReceiptDigest, predecessorDigest: record.predecessorDigest,
      unitCount: record.units.length, pathCount: record.units.reduce((sum, unit) => sum + unit.paths.length, 0),
      lifecycle: record.lifecycle, reviewState: record.reviewState, actionAuthorityState: record.actionAuthorityState, authorityBoundary: record.authorityBoundary,
    } } })
  }
  private currentPath(id: string): string { return this.repository.resolve("provider-switch-implementations", `${id}.json`) }
  private historyPath(id: string, revision: number): string { return this.repository.resolve("provider-switch-implementation-history", `provider-switch-implementation-${id}-r${revision}.json`) }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string { const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data }
  private async assertIntegrity(): Promise<void> { const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed") }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error }
    if (names.length > inventoryLimit) throw new Error(`Provider Switch Implementation directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => `${String((left as Record<string, unknown>).id ?? "")}:${String((left as Record<string, unknown>).revision ?? "")}`.localeCompare(`${String((right as Record<string, unknown>).id ?? "")}:${String((right as Record<string, unknown>).revision ?? "")}`))
  }
}
