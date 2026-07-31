import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  modelSwitchImplementationInputSchema, modelSwitchImplementationProjectionSchema, modelSwitchImplementationSchema,
  modelSwitchImplementationStatusSchema, type BusinessContextBinding, type ControlledClaudeImplementation,
  type ControlledCodexImplementation, type Initiative, type ModelSwitchImplementation, type ModelSwitchImplementationInput,
  type ModelSwitchImplementationProjection, type ModelSwitchImplementationStatus, type Product,
  type ProviderSwitchImplementation, type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type CurrentReader<T> = { readCurrent(initiativeId: string): Promise<T | undefined> }
type ExactReference = { recordId: string; revision: number; digest: string }

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "model-switch-implementation-is-a-versioned-portable-candidate-and-does-not-establish-model-availability-capability-refresh-provider-execution-model-transition-context-transfer-handoff-resume-stage-ownership-transfer-approval-authorization-source-mutation-apply-discard-recovery-native-host-live-provider-security-acceptance-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "model-switch-implementation-status-is-observational-and-grants-no-model-transition-context-transfer-handoff-resume-stage-transfer-mutation-apply-discard-recovery-acceptance-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "model-switch-implementation-projection-is-read-only-and-grants-no-model-transition-context-transfer-handoff-resume-stage-transfer-mutation-apply-discard-recovery-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-provider-model-identifiers-counts-states-and-receipt-digests-only-not-prompts-context-source-diffs-provider-output-machine-paths-personal-data-secrets-or-credentials" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}
function sameReference(reference: ExactReference | undefined, record: { id: string; revision?: number } | undefined): boolean {
  return Boolean(reference && record && reference.recordId === record.id && reference.revision === revisionOf(record) && reference.digest === canonicalDigest(record))
}

export class ModelSwitchImplementationService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly controlledCodex: CurrentReader<ControlledCodexImplementation>,
    private readonly controlledClaude: CurrentReader<ControlledClaudeImplementation>,
    private readonly providerSwitch: CurrentReader<ProviderSwitchImplementation>,
  ) {}

  async create(inputValue: ModelSwitchImplementationInput, actorId: string): Promise<ModelSwitchImplementation> {
    const input = modelSwitchImplementationInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      if (await this.readCurrent(input.initiativeId)) throw new Error("A current Model Switch Implementation candidate already exists; create a revision")
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies, product, initiative)
      const now = new Date().toISOString(), digests = this.composeDigests(input)
      const record = modelSwitchImplementationSchema.parse({ schemaVersion: 1, kind: "model-switch-implementation-candidate", id: randomUUID(),
        productId: product.id, ...input, revision: 1, ...digests, state: "candidate", createdBy: { kind: "human", id: actorId },
        updatedBy: { kind: "human", id: actorId }, createdAt: now, updatedAt: now, authorityBoundary })
      await this.commitVersionedRecord(record, "model-switch-implementation.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: ModelSwitchImplementationInput, actorId: string): Promise<ModelSwitchImplementation> {
    const input = modelSwitchImplementationInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Model Switch Implementation revision conflict")
      if (current.initiativeId !== input.initiativeId) throw new Error("Model Switch Implementation Initiative binding is immutable")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies, product, initiative)
      const now = new Date().toISOString(), digests = this.composeDigests(input)
      const record = modelSwitchImplementationSchema.parse({ ...current, ...input, revision: current.revision + 1, ...digests,
        predecessorDigest: canonicalDigest(current), updatedBy: { kind: "human", id: actorId }, updatedAt: now })
      await this.commitVersionedRecord(record, "model-switch-implementation.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<ModelSwitchImplementation> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Model Switch Implementation ID")), modelSwitchImplementationSchema)
  }
  async readCurrent(initiativeId: string): Promise<ModelSwitchImplementation | undefined> {
    const target = this.requireUuid(initiativeId, "Initiative ID")
    const matches = (await this.listRecords("model-switch-implementations", currentRecordPattern, modelSwitchImplementationSchema))
      .filter((record) => record.initiativeId === target)
    if (matches.length > 1) throw new Error("Multiple current Model Switch Implementation candidates target one Initiative")
    return matches[0]
  }
  async readRevision(id: string, revision: number): Promise<ModelSwitchImplementation> {
    const recordId = this.requireUuid(id, "Model Switch Implementation ID")
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Revision must be a positive integer")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), modelSwitchImplementationSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Model Switch Implementation history binding mismatch")
    return record
  }
  async listHistory(id: string): Promise<ModelSwitchImplementation[]> {
    const recordId = this.requireUuid(id, "Model Switch Implementation ID")
    const pattern = new RegExp(`^model-switch-implementation-${recordId}-r[1-9][0-9]*\\.json$`, "i")
    const records = await this.listRecords("model-switch-implementation-history", pattern, modelSwitchImplementationSchema)
    return records.sort((left, right) => right.revision - left.revision)
  }

  async assess(initiativeId: string): Promise<ModelSwitchImplementationStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, codex, claude, providerSwitch] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), this.controlledCodex.readCurrent(targetId),
      this.controlledClaude.readCurrent(targetId), this.providerSwitch.readCurrent(targetId),
    ])
    const reasons: string[] = []
    let staleBindingCount = 0, providerGapCount = 0, modelGapCount = 0, continuityGapCount = 0, transitionGapCount = 0,
      prerequisiteGapCount = 0, evidenceGapCount = 0, invalidCandidateCount = 0
    if (!candidate) reasons.push("No current Model Switch Implementation candidate is recorded")
    if (!codex || !claude || !providerSwitch) reasons.push("One or more required P3B-04 through P3B-06 candidates are unavailable")
    if (candidate) {
      if (!sameReference(candidate.controlledCodexImplementation, codex) || !sameReference(candidate.controlledClaudeImplementation, claude) ||
          !sameReference(candidate.providerSwitchImplementation, providerSwitch)) staleBindingCount += 1
      if (candidate.sourceProvider.adapterId !== candidate.targetProvider.adapterId || candidate.sourceProvider.agentId !== candidate.targetProvider.agentId) providerGapCount += 1
      if (candidate.sourceProvider.modelId === candidate.targetProvider.modelId || candidate.sourceSelection.modelId === candidate.targetSelection.modelId ||
          candidate.sourceProvider.capabilityDigest !== candidate.targetProvider.capabilityDigest) modelGapCount += 1
      if (!providerSwitch || candidate.providerSwitchContinuityReceiptDigest !== providerSwitch.continuityReceiptDigest ||
          candidate.unitCount !== providerSwitch.units.length || candidate.pathCount !== providerSwitch.units.reduce((sum, unit) => sum + unit.paths.length, 0)) continuityGapCount += 1
      if (candidate.transition.transitionReceiptDigest !== this.expectedTransitionReceipt(candidate) || candidate.transition.state !== "candidate-not-recorded") transitionGapCount += 1
      if (candidate.prerequisites.length !== 5 || candidate.prerequisites.some((entry) => entry.state !== "required-not-established")) prerequisiteGapCount += 1
      if (candidate.evidenceReferences.length === 0) evidenceGapCount += 1
      try {
        if (codex && claude && providerSwitch) this.validateCandidate(candidate, { codex, claude, providerSwitch }, product, initiative)
      } catch { invalidCandidateCount += 1 }
    }
    if (staleBindingCount) reasons.push("One or more exact P3B-04 through P3B-06 bindings are stale")
    if (providerGapCount) reasons.push("The source and target provider identities are not the same")
    if (modelGapCount) reasons.push("The source and target model identities or capability snapshot are invalid")
    if (continuityGapCount) reasons.push("The provider-switch unit and path continuity receipt is stale or incomplete")
    if (transitionGapCount) reasons.push("The model-transition candidate receipt or stop-line is invalid")
    if (prerequisiteGapCount) reasons.push("The required model-switch prerequisites are incomplete")
    if (evidenceGapCount) reasons.push("The model-switch candidate lacks attributable evidence")
    if (invalidCandidateCount) reasons.push("The model-switch bindings or deterministic receipts are invalid")
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    if (unresolvedQuestionCount) reasons.push("The candidate records unresolved questions")
    const reviewState = candidate?.reviewState ?? "draft"
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    const blocking = staleBindingCount + providerGapCount + modelGapCount + continuityGapCount + transitionGapCount + prerequisiteGapCount + evidenceGapCount + invalidCandidateCount + unresolvedQuestionCount
    return modelSwitchImplementationStatusSchema.parse({ schemaVersion: 1, kind: "model-switch-implementation-status", productId: product.id,
      productRevision: revisionOf(product), initiativeId: initiative.id, initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate), providerSwitchImplementation: candidate.providerSwitchImplementation,
        controlledCodexImplementation: candidate.controlledCodexImplementation, controlledClaudeImplementation: candidate.controlledClaudeImplementation } : {}),
      unitCount: candidate?.unitCount ?? 0, pathCount: candidate?.pathCount ?? 0, staleBindingCount, providerGapCount, modelGapCount,
      continuityGapCount, transitionGapCount, prerequisiteGapCount, evidenceGapCount, invalidCandidateCount, unresolvedQuestionCount, reviewState,
      state: candidate && codex && claude && providerSwitch && blocking === 0 && reviewState === "ready-for-human-review" ? "candidate-defined" : "attention-required",
      reasons, assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary })
  }

  async project(initiativeId: string): Promise<ModelSwitchImplementationProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId)])
    const withoutDigest = { schemaVersion: 1 as const, kind: "model-switch-implementation-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state }, status,
      ...(candidate ? { candidate: { id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        provider: candidate.provider, providerSwitchRole: candidate.providerSwitchRole, sourceSelection: candidate.sourceSelection,
        targetSelection: candidate.targetSelection, sourceProvider: candidate.sourceProvider, targetProvider: candidate.targetProvider,
        transition: candidate.transition, lifecycle: candidate.lifecycle, unitCount: candidate.unitCount, pathCount: candidate.pathCount,
        prerequisiteCount: candidate.prerequisites.length, bindingReceiptDigest: candidate.bindingReceiptDigest, modelReceiptDigest: candidate.modelReceiptDigest,
        continuityReceiptDigest: candidate.continuityReceiptDigest, transitionReceiptDigest: candidate.transitionReceiptDigestVerified,
        lifecycleReceiptDigest: candidate.lifecycleReceiptDigest, prerequisiteReceiptDigest: candidate.prerequisiteReceiptDigest,
        assessmentReceiptDigest: candidate.assessmentReceiptDigest, reviewState: candidate.reviewState, updatedAt: candidate.updatedAt } } : {}),
      observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary }
    return modelSwitchImplementationProjectionSchema.parse({ ...withoutDigest, snapshotDigest: canonicalDigest(withoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    for (const candidate of await this.listRecords("model-switch-implementations", currentRecordPattern, modelSwitchImplementationSchema)) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) throw new Error("Current candidate does not match immutable history")
        if ((await this.assess(candidate.initiativeId)).state === "attention-required") issues.push({ code: "model-switch-implementation.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has a stale, incomplete, or unresolved Model Switch Implementation candidate.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "create-superseding-revision"] })
      } catch (error) {
        issues.push({ code: "model-switch-implementation.invalid", severity: "error", message: `Model Switch Implementation ${candidate.id}: ${error instanceof Error ? error.message : "validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "manual-repair-required"] })
      }
    }
    return issues
  }

  private async requireExactDependencies(input: ModelSwitchImplementationInput) {
    const [codex, claude, providerSwitch] = await Promise.all([this.controlledCodex.readCurrent(input.initiativeId),
      this.controlledClaude.readCurrent(input.initiativeId), this.providerSwitch.readCurrent(input.initiativeId)])
    if (!codex || !sameReference(input.controlledCodexImplementation, codex)) throw new Error("Model Switch Implementation must reference the exact current Controlled Codex Implementation")
    if (!claude || !sameReference(input.controlledClaudeImplementation, claude)) throw new Error("Model Switch Implementation must reference the exact current Controlled Claude Implementation")
    if (!providerSwitch || !sameReference(input.providerSwitchImplementation, providerSwitch)) throw new Error("Model Switch Implementation must reference the exact current Provider Switch Implementation")
    return { codex, claude, providerSwitch }
  }

  private validateCandidate(input: ModelSwitchImplementationInput, dependencies: { codex: ControlledCodexImplementation; claude: ControlledClaudeImplementation; providerSwitch: ProviderSwitchImplementation }, product: Product, initiative: Initiative): void {
    const { codex, claude, providerSwitch } = dependencies
    if (providerSwitch.productId !== product.id || providerSwitch.initiativeId !== initiative.id || codex.productId !== product.id || claude.productId !== product.id) {
      throw new Error("Model-switch dependencies must bind the exact current Product and Initiative")
    }
    if (canonicalDigest(input.context) !== canonicalDigest(this.exactContext(product, initiative)) || canonicalDigest(providerSwitch.context) !== canonicalDigest(input.context) ||
        canonicalDigest(input.proposedChangePreview) !== canonicalDigest(providerSwitch.proposedChangePreview) || canonicalDigest(input.stagingWorkspace) !== canonicalDigest(providerSwitch.stagingWorkspace)) {
      throw new Error("Model-switch Product, preview, and staging continuity must be exact")
    }
    const controlled = input.provider === "codex" ? codex : claude
    const roleSelection = input.providerSwitchRole === "provider-switch-source-candidate" ? providerSwitch.sourceSelection : providerSwitch.targetSelection
    const roleProvider = input.providerSwitchRole === "provider-switch-source-candidate" ? providerSwitch.sourceProvider : providerSwitch.targetProvider
    if (canonicalDigest(input.sourceSelection) !== canonicalDigest(controlled.selection) || canonicalDigest(input.sourceProvider) !== canonicalDigest(controlled.provider) ||
        canonicalDigest(input.sourceSelection) !== canonicalDigest(roleSelection) || canonicalDigest(input.sourceProvider) !== canonicalDigest(roleProvider)) {
      throw new Error("Model-switch provider role and source model must exactly match one controlled provider candidate")
    }
    if (input.sourceProvider.adapterId !== input.targetProvider.adapterId || input.sourceProvider.agentId !== input.targetProvider.agentId ||
        input.sourceSelection.adapterId !== input.targetSelection.adapterId || input.sourceSelection.agentId !== input.targetSelection.agentId ||
        input.sourceProvider.capabilityDigest !== input.targetProvider.capabilityDigest || input.sourceSelection.capabilityDigest !== input.targetSelection.capabilityDigest ||
        input.sourceProvider.modelId === input.targetProvider.modelId || input.sourceSelection.modelId === input.targetSelection.modelId ||
        input.targetProvider.modelId !== input.targetSelection.modelId || input.targetProvider.adapterId !== input.targetSelection.adapterId ||
        input.targetProvider.agentId !== input.targetSelection.agentId || input.targetProvider.capabilityDigest !== input.targetSelection.capabilityDigest ||
        input.sourceProvider.modelId !== input.sourceSelection.modelId || input.sourceProvider.capabilityDigest !== input.sourceSelection.capabilityDigest ||
        input.targetProvider.runtimeVersion !== input.sourceProvider.runtimeVersion) {
      throw new Error("Model-switch source, target, provider, model, and capability continuity must be exact")
    }
    if (input.sourcePlanReceiptDigest !== controlled.plan.planReceiptDigest || input.sourceRecoveryReceiptDigest !== controlled.recoveryJournal.recoveryReceiptDigest) {
      throw new Error("Model-switch plan and recovery continuity must be exact")
    }
    const unitCount = providerSwitch.units.length, pathCount = providerSwitch.units.reduce((sum, unit) => sum + unit.paths.length, 0)
    if (input.providerSwitchContinuityReceiptDigest !== providerSwitch.continuityReceiptDigest || input.unitCount !== unitCount || input.pathCount !== pathCount) {
      throw new Error("Model-switch provider-switch scope continuity must be exact")
    }
    if (input.transition.transitionReceiptDigest !== this.expectedTransitionReceipt(input)) throw new Error("Model-switch transition receipt must exactly bind the non-effectful candidate")
  }

  private expectedTransitionReceipt(input: ModelSwitchImplementationInput): string {
    const { transition } = input
    return canonicalDigest({ state: transition.state, transitionKey: transition.transitionKey, sourceModelState: transition.sourceModelState,
      targetModelAvailabilityState: transition.targetModelAvailabilityState, capabilityRefreshState: transition.capabilityRefreshState,
      contextTransferState: transition.contextTransferState, handoffState: transition.handoffState, resumeState: transition.resumeState,
      provider: input.provider, providerSwitchRole: input.providerSwitchRole, sourceSelection: input.sourceSelection,
      targetSelection: input.targetSelection, providerSwitchImplementation: input.providerSwitchImplementation })
  }
  private composeDigests(input: ModelSwitchImplementationInput) {
    const bindingReceiptDigest = canonicalDigest({ context: input.context, proposedChangePreview: input.proposedChangePreview,
      stagingWorkspace: input.stagingWorkspace, controlledCodexImplementation: input.controlledCodexImplementation,
      controlledClaudeImplementation: input.controlledClaudeImplementation, providerSwitchImplementation: input.providerSwitchImplementation })
    const modelReceiptDigest = canonicalDigest({ provider: input.provider, providerSwitchRole: input.providerSwitchRole,
      sourceSelection: input.sourceSelection, targetSelection: input.targetSelection, sourceProvider: input.sourceProvider,
      targetProvider: input.targetProvider, sourcePlanReceiptDigest: input.sourcePlanReceiptDigest, sourceRecoveryReceiptDigest: input.sourceRecoveryReceiptDigest })
    const continuityReceiptDigest = canonicalDigest({ providerSwitchContinuityReceiptDigest: input.providerSwitchContinuityReceiptDigest,
      unitCount: input.unitCount, pathCount: input.pathCount })
    const transitionReceiptDigestVerified = canonicalDigest({ supplied: input.transition.transitionReceiptDigest, expected: this.expectedTransitionReceipt(input) })
    const lifecycleReceiptDigest = canonicalDigest(input.lifecycle), prerequisiteReceiptDigest = canonicalDigest(input.prerequisites)
    const assessmentReceiptDigest = canonicalDigest({ bindingReceiptDigest, modelReceiptDigest, continuityReceiptDigest,
      transitionReceiptDigestVerified, lifecycleReceiptDigest, prerequisiteReceiptDigest, reviewState: input.reviewState,
      unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations, acceptanceDecisionState: input.acceptanceDecisionState,
      nativeHostAcceptanceState: input.nativeHostAcceptanceState, liveProviderAcceptanceState: input.liveProviderAcceptanceState,
      securityAcceptanceState: input.securityAcceptanceState, releaseReadinessState: input.releaseReadinessState,
      deploymentReadinessState: input.deploymentReadinessState, actionAuthorityState: input.actionAuthorityState })
    return { bindingReceiptDigest, modelReceiptDigest, continuityReceiptDigest, transitionReceiptDigestVerified,
      lifecycleReceiptDigest, prerequisiteReceiptDigest, assessmentReceiptDigest }
  }
  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id || canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) throw new Error("Model Switch Implementation must bind exact current Product and Initiative revisions and digests")
  }
  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return { productRevision: revisionOf(product), productDigest: canonicalDigest(product), initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) }
  }
  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Model Switch Implementation is immutable`)
    return { product, initiative }
  }
  private async commitVersionedRecord(record: ModelSwitchImplementation, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({ writes: [this.governed(this.currentPath(record.id), record, modelSwitchImplementationSchema),
      this.governed(this.historyPath(record.id, record.revision), record, modelSwitchImplementationSchema)],
    audit: { eventType, actor: { kind: "human", id: actorId }, subjectId: record.id, payload: { initiativeId: record.initiativeId,
      revision: record.revision, recordDigest: canonicalDigest(record), provider: record.provider, providerSwitchRole: record.providerSwitchRole,
      sourceModelId: record.sourceSelection.modelId, targetModelId: record.targetSelection.modelId,
      controlledCodexImplementation: record.controlledCodexImplementation, controlledClaudeImplementation: record.controlledClaudeImplementation,
      providerSwitchImplementation: record.providerSwitchImplementation, bindingReceiptDigest: record.bindingReceiptDigest,
      modelReceiptDigest: record.modelReceiptDigest, continuityReceiptDigest: record.continuityReceiptDigest,
      transitionReceiptDigest: record.transitionReceiptDigestVerified, lifecycleReceiptDigest: record.lifecycleReceiptDigest,
      prerequisiteReceiptDigest: record.prerequisiteReceiptDigest, assessmentReceiptDigest: record.assessmentReceiptDigest,
      predecessorDigest: record.predecessorDigest, unitCount: record.unitCount, pathCount: record.pathCount,
      lifecycle: record.lifecycle, reviewState: record.reviewState, actionAuthorityState: record.actionAuthorityState, authorityBoundary: record.authorityBoundary } } })
  }
  private currentPath(id: string): string { return this.repository.resolve("model-switch-implementations", `${id}.json`) }
  private historyPath(id: string, revision: number): string { return this.repository.resolve("model-switch-implementation-history", `model-switch-implementation-${id}-r${revision}.json`) }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string { const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data }
  private async assertIntegrity(): Promise<void> { const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed") }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error }
    if (names.length > inventoryLimit) throw new Error(`Model Switch Implementation directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => `${String((left as Record<string, unknown>).id ?? "")}:${String((left as Record<string, unknown>).revision ?? "")}`.localeCompare(`${String((right as Record<string, unknown>).id ?? "")}:${String((right as Record<string, unknown>).revision ?? "")}`))
  }
}
