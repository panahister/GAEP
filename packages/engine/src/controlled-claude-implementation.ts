import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  controlledClaudeImplementationInputSchema, controlledClaudeImplementationProjectionSchema,
  controlledClaudeImplementationSchema, controlledClaudeImplementationStatusSchema,
  type AgentSelectionState, type BusinessContextBinding, type ControlledClaudeImplementation,
  type ControlledClaudeImplementationInput, type ControlledClaudeImplementationProjection,
  type ControlledClaudeImplementationStatus, type Initiative, type Product, type ProposedChangePreview,
  type StagingWorkspace, type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type PreviewReader = { readCurrent(initiativeId: string): Promise<ProposedChangePreview | undefined> }
type StagingReader = { readCurrent(initiativeId: string): Promise<StagingWorkspace | undefined> }
type SelectionReader = () => Promise<AgentSelectionState>
type ExactReference = { recordId: string; revision: number; digest: string }

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "controlled-claude-implementation-is-a-versioned-portable-candidate-and-does-not-establish-provider-execution-real-stage-existence-approval-authorization-source-mutation-apply-discard-cancellation-resume-recovery-native-host-live-provider-security-acceptance-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "controlled-claude-implementation-status-is-observational-and-grants-no-execution-stage-approval-authorization-mutation-apply-discard-recovery-acceptance-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "controlled-claude-implementation-projection-is-read-only-and-grants-no-execution-stage-approval-authorization-mutation-apply-discard-recovery-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-repository-relative-scopes-provider-identifiers-counts-states-and-receipt-digests-only-not-prompts-context-source-diffs-provider-output-machine-paths-personal-data-secrets-or-credentials" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}
function sameReference(reference: ExactReference | undefined, record: { id: string; revision?: number } | undefined): boolean {
  return Boolean(reference && record && reference.recordId === record.id && reference.revision === revisionOf(record) && reference.digest === canonicalDigest(record))
}

export class ControlledClaudeImplementationService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly proposedChangePreview: PreviewReader,
    private readonly stagingWorkspace: StagingReader,
    private readonly readSelectionState: SelectionReader,
  ) {}

  async create(inputValue: ControlledClaudeImplementationInput, actorId: string): Promise<ControlledClaudeImplementation> {
    const input = controlledClaudeImplementationInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies.preview, dependencies.staging, dependencies.selection, product, initiative)
      if (await this.readCurrent(initiative.id)) throw new Error("An Initiative can have only one current Controlled Claude Implementation candidate")
      const now = new Date().toISOString()
      const record = controlledClaudeImplementationSchema.parse({
        schemaVersion: 1, kind: "controlled-claude-implementation-candidate", id: randomUUID(), productId: product.id,
        ...input, initiativeId: initiative.id, revision: 1, ...this.composeDigests(input), state: "candidate",
        createdBy: { kind: "human", id: actorId }, updatedBy: { kind: "human", id: actorId }, createdAt: now, updatedAt: now, authorityBoundary,
      })
      await this.commitVersionedRecord(record, "controlled-claude-implementation.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: ControlledClaudeImplementationInput, actorId: string): Promise<ControlledClaudeImplementation> {
    const input = controlledClaudeImplementationInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Controlled Claude Implementation revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Controlled Claude Implementation Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies.preview, dependencies.staging, dependencies.selection, product, initiative)
      const record = controlledClaudeImplementationSchema.parse({
        ...current, ...input, productId: product.id, initiativeId: initiative.id, revision: current.revision + 1,
        ...this.composeDigests(input), predecessorDigest: canonicalDigest(current), updatedBy: { kind: "human", id: actorId }, updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, "controlled-claude-implementation.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<ControlledClaudeImplementation> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Controlled Claude Implementation ID")), controlledClaudeImplementationSchema)
  }

  async readCurrent(initiativeId: string): Promise<ControlledClaudeImplementation | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const matches = (await this.listRecords("controlled-claude-implementations", currentRecordPattern, controlledClaudeImplementationSchema))
      .filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Controlled Claude Implementation candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<ControlledClaudeImplementation> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Controlled Claude Implementation history revision must be positive")
    const recordId = this.requireUuid(id, "Controlled Claude Implementation ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), controlledClaudeImplementationSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Controlled Claude Implementation history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<ControlledClaudeImplementation[]> {
    const recordId = this.requireUuid(id, "Controlled Claude Implementation ID")
    const records = await this.listRecords("controlled-claude-implementation-history",
      new RegExp(`^controlled-claude-implementation-${recordId}-r[1-9][0-9]*\\.json$`, "iu"), controlledClaudeImplementationSchema)
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Controlled Claude Implementation history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<ControlledClaudeImplementationStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, preview, staging, selectionState] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), this.proposedChangePreview.readCurrent(targetId),
      this.stagingWorkspace.readCurrent(targetId), this.readSelectionState(),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const selection = selectionState.status === "selected" ? selectionState.selection : undefined
    const staleBindingCount = candidate && canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative)) ? 1 : 0
    const previewStale = candidate && !sameReference(candidate.proposedChangePreview, preview) ? 1 : 0
    const stagingStale = candidate && !sameReference(candidate.stagingWorkspace, staging) ? 1 : 0
    const selectionStale = candidate && (!selection || canonicalDigest(candidate.selection) !== canonicalDigest(selection)) ? 1 : 0
    const providerGapCount = candidate && (candidate.provider.adapterId !== "gaep.claude-code-cli" || candidate.provider.agentId !== "claude-code-cli" ||
      !selection || canonicalDigest(candidate.provider) !== canonicalDigest(this.expectedProvider(selection, candidate.provider.runtimeVersion))) ? 1 : 0
    const expectedScopes = staging ? this.expectedResourceScopes(staging) : []
    const scopeGapCount = candidate && (canonicalDigest(candidate.resourceScopes) !== canonicalDigest(expectedScopes) || !this.permissionsCover(candidate)) ? 1 : 0
    let planGapCount = 0, recoveryGapCount = 0, invalidCandidateCount = 0
    if (candidate) {
      if (candidate.plan.planReceiptDigest !== this.expectedPlanReceipt(candidate) || candidate.plan.stagedEffectReceiptDigest !== this.expectedStagedEffectReceipt(candidate)) planGapCount = 1
      if (candidate.recoveryJournal.checkpointDigest !== this.expectedRecoveryCheckpoint(candidate) || candidate.recoveryJournal.recoveryReceiptDigest !== this.expectedRecoveryReceipt(candidate)) recoveryGapCount = 1
      try {
        if (preview && staging && selection) this.validateCandidate(candidate, preview, staging, selection, product, initiative)
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
    const staleCount = staleBindingCount + (previewStale ? 1 : 0) + (stagingStale ? 1 : 0) + (selectionStale ? 1 : 0)
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Controlled Claude Implementation candidate exists for this Initiative")
    if (!preview) reasons.push("No current Proposed Change Preview candidate exists")
    if (!staging) reasons.push("No current Isolated Staging Workspace candidate exists")
    if (!selection) reasons.push("No current portable Agent Selection exists")
    if (staleCount) reasons.push("The candidate does not bind the exact current Product, Initiative, preview, staging workspace, and Agent Selection")
    if (providerGapCount) reasons.push("The provider binding is not the exact selected managed Claude identity")
    if (scopeGapCount) reasons.push("Resource or tool scopes do not exactly cover the isolated staging candidate")
    if (planGapCount) reasons.push("Plan or staged-effect receipts are invalid")
    if (gapCount) reasons.push("One or more controlled implementation units are incomplete")
    if (prerequisiteGapCount) reasons.push("Approval and authorization prerequisites are incomplete")
    if (recoveryGapCount) reasons.push("The recovery journal candidate receipts are invalid")
    if (evidenceGapCount) reasons.push("One or more controlled units lack attributable evidence")
    if (invalidCandidateCount) reasons.push("The candidate bindings or deterministic receipts are invalid")
    if (unresolvedQuestionCount) reasons.push("The candidate records unresolved questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    const blocking = staleCount + providerGapCount + scopeGapCount + planGapCount + gapCount + prerequisiteGapCount + recoveryGapCount + evidenceGapCount + invalidCandidateCount + unresolvedQuestionCount
    return controlledClaudeImplementationStatusSchema.parse({
      schemaVersion: 1, kind: "controlled-claude-implementation-status", productId: product.id, productRevision: revisionOf(product),
      initiativeId: initiative.id, initiativeRevision: revisionOf(initiative), ...(candidate ? { candidate: exactReference(candidate), proposedChangePreview: candidate.proposedChangePreview, stagingWorkspace: candidate.stagingWorkspace } : {}),
      unitCount: units.length, pathCount: paths.length, resourceScopeCount: candidate?.resourceScopes.length ?? 0, toolPermissionCount: candidate?.permissions.length ?? 0,
      candidateDefinedCount, gapCount, staleBindingCount: staleCount, providerGapCount, scopeGapCount, planGapCount, prerequisiteGapCount, recoveryGapCount,
      evidenceGapCount, invalidCandidateCount, unresolvedQuestionCount, reviewState,
      state: candidate && preview && staging && selection && blocking === 0 && reviewState === "ready-for-human-review" ? "candidate-defined" : "attention-required",
      reasons, assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary,
    })
  }

  async project(initiativeId: string): Promise<ControlledClaudeImplementationProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    const withoutDigest = {
      schemaVersion: 1 as const, kind: "controlled-claude-implementation-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state }, status,
      ...(candidate ? { candidate: {
        id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        provider: candidate.provider, runtimeBoundary: candidate.runtimeBoundary, plan: candidate.plan, lifecycle: candidate.lifecycle, resourceScopes: candidate.resourceScopes, permissions: candidate.permissions,
        unitCount: candidate.units.length, pathCount: candidate.units.reduce((sum, unit) => sum + unit.paths.length, 0), prerequisiteCount: candidate.prerequisites.length,
        bindingReceiptDigest: candidate.bindingReceiptDigest, providerReceiptDigest: candidate.providerReceiptDigest, runtimeBoundaryReceiptDigest: candidate.runtimeBoundaryReceiptDigest, scopeReceiptDigest: candidate.scopeReceiptDigest,
        planReceiptDigest: candidate.planReceiptDigestVerified, stagedEffectReceiptDigest: candidate.stagedEffectReceiptDigestVerified,
        lifecycleReceiptDigest: candidate.lifecycleReceiptDigest, prerequisiteReceiptDigest: candidate.prerequisiteReceiptDigest,
        recoveryReceiptDigest: candidate.recoveryReceiptDigestVerified, assessmentReceiptDigest: candidate.assessmentReceiptDigest,
        reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
      } } : {}), observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary,
    }
    return controlledClaudeImplementationProjectionSchema.parse({ ...withoutDigest, snapshotDigest: canonicalDigest(withoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    for (const candidate of await this.listRecords("controlled-claude-implementations", currentRecordPattern, controlledClaudeImplementationSchema)) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) throw new Error("Current candidate does not match immutable history")
        if ((await this.assess(candidate.initiativeId)).state === "attention-required") issues.push({ code: "controlled-claude-implementation.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has a stale, incomplete, or unresolved Controlled Claude Implementation candidate.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "create-superseding-revision"] })
      } catch (error) {
        issues.push({ code: "controlled-claude-implementation.invalid", severity: "error", message: `Controlled Claude Implementation ${candidate.id}: ${error instanceof Error ? error.message : "validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "manual-repair-required"] })
      }
    }
    return issues
  }

  private async requireExactDependencies(input: ControlledClaudeImplementationInput) {
    const [preview, staging, selectionState] = await Promise.all([
      this.proposedChangePreview.readCurrent(input.initiativeId), this.stagingWorkspace.readCurrent(input.initiativeId), this.readSelectionState(),
    ])
    if (!preview || !sameReference(input.proposedChangePreview, preview)) throw new Error("Controlled Claude Implementation must reference the exact current Proposed Change Preview")
    if (!staging || !sameReference(input.stagingWorkspace, staging)) throw new Error("Controlled Claude Implementation must reference the exact current Isolated Staging Workspace")
    if (selectionState.status !== "selected" || canonicalDigest(input.selection) !== canonicalDigest(selectionState.selection)) throw new Error("Controlled Claude Implementation must bind the exact current portable Agent Selection")
    return { preview, staging, selection: selectionState.selection }
  }

  private validateCandidate(input: ControlledClaudeImplementationInput, preview: ProposedChangePreview, staging: StagingWorkspace,
    selection: ControlledClaudeImplementationInput["selection"], product: Product, initiative: Initiative): void {
    if (input.provider.adapterId !== "gaep.claude-code-cli" || input.provider.agentId !== "claude-code-cli") throw new Error("Controlled implementation requires the managed Claude Code adapter and agent identity")
    if (canonicalDigest(input.provider) !== canonicalDigest(this.expectedProvider(selection, input.provider.runtimeVersion))) throw new Error("Controlled Claude provider binding must match the exact Agent Selection")
    if (input.units.length !== staging.units.length || input.units.length !== preview.previewUnits.length) throw new Error("Controlled implementation requires one unit per current preview and staging unit")
    for (const [unitIndex, stagingUnit] of staging.units.entries()) {
      const previewUnit = preview.previewUnits[unitIndex], unit = input.units[unitIndex]
      if (!previewUnit || !unit || unit.stagingUnitId !== stagingUnit.id || unit.proposedPreviewUnitId !== previewUnit.id ||
        unit.implementationUnitId !== stagingUnit.implementationUnitId || unit.implementationUnitKey !== stagingUnit.implementationUnitKey ||
        unit.previewUnitDigest !== canonicalDigest(previewUnit) || unit.stagingUnitDigest !== canonicalDigest(stagingUnit)) throw new Error("Controlled units must exactly bind current preview and staging units")
      if (unit.paths.length !== stagingUnit.pathCandidates.length || unit.paths.length !== previewUnit.pathPreviews.length) throw new Error("Controlled units require one path per current preview and staging path")
      for (const [pathIndex, stagingPath] of stagingUnit.pathCandidates.entries()) {
        const previewPath = previewUnit.pathPreviews[pathIndex], path = unit.paths[pathIndex]
        if (!previewPath || !path || path.stagingPathId !== stagingPath.id || path.proposedPreviewPathId !== previewPath.id || path.pathCandidate !== stagingPath.pathCandidate ||
          path.previewPathDigest !== canonicalDigest(previewPath) || path.stagingPathDigest !== canonicalDigest(stagingPath) ||
          path.stagedEffectReceiptDigest !== this.expectedPathEffectReceipt(path)) throw new Error("Controlled paths must exactly bind current preview, staging, and staged-effect metadata")
      }
      if (unit.unitPlanReceiptDigest !== canonicalDigest({ stagingUnitId: unit.stagingUnitId, previewUnitId: unit.proposedPreviewUnitId, paths: unit.paths.map((path) => ({ id: path.id, stagedEffectReceiptDigest: path.stagedEffectReceiptDigest })) })) throw new Error("Controlled unit plan receipt is invalid")
    }
    if (canonicalDigest(input.resourceScopes) !== canonicalDigest(this.expectedResourceScopes(staging))) throw new Error("Controlled resource scopes must exactly equal current staging path candidates")
    if (!this.permissionsCover(input)) throw new Error("Controlled Claude permissions must deny all Tools and workspace scopes")
    if (input.plan.planReceiptDigest !== this.expectedPlanReceipt(input) || input.plan.stagedEffectReceiptDigest !== this.expectedStagedEffectReceipt(input)) throw new Error("Controlled plan receipts must exactly bind the candidate")
    if (input.recoveryJournal.checkpointDigest !== this.expectedRecoveryCheckpoint(input) || input.recoveryJournal.recoveryReceiptDigest !== this.expectedRecoveryReceipt(input)) throw new Error("Controlled recovery journal receipts must exactly bind the candidate")
    if (canonicalDigest(input.context) !== canonicalDigest(this.exactContext(product, initiative))) throw new Error("Controlled Claude Implementation context changed")
  }

  private expectedProvider(selection: ControlledClaudeImplementationInput["selection"], runtimeVersion?: string) {
    return { adapterId: selection.adapterId, agentId: selection.agentId, modelId: selection.modelId, capabilityDigest: selection.capabilityDigest, ...(runtimeVersion ? { runtimeVersion } : {}) }
  }
  private expectedResourceScopes(staging: StagingWorkspace): string[] {
    return [...new Set(staging.units.flatMap((unit) => unit.pathCandidates.map((path) => path.pathCandidate)))].sort((a, b) => a.localeCompare(b))
  }
  private permissionsCover(input: Pick<ControlledClaudeImplementationInput, "permissions" | "units">): boolean {
    const permission = input.permissions[0]
    return input.permissions.length === 1 && permission?.capability === "all-tools" && permission.mode === "deny" && permission.scope.length === 0 &&
      input.units.every((unit) => unit.paths.every((path) => path.toolCapabilities.length === 0 && path.expectedEffect === "observation-only"))
  }
  private expectedPathEffectReceipt(path: ControlledClaudeImplementationInput["units"][number]["paths"][number]): string {
    return canonicalDigest({ proposedPreviewPathId: path.proposedPreviewPathId, stagingPathId: path.stagingPathId, pathCandidate: path.pathCandidate,
      resourceScopeId: path.resourceScopeId, toolCapabilities: path.toolCapabilities, expectedEffect: path.expectedEffect,
      previewPathDigest: path.previewPathDigest, stagingPathDigest: path.stagingPathDigest })
  }
  private expectedPlanReceipt(input: Pick<ControlledClaudeImplementationInput, "plan" | "provider" | "runtimeBoundary" | "proposedChangePreview" | "stagingWorkspace">): string {
    return canonicalDigest({ strategy: input.plan.strategy, planKey: input.plan.planKey, workflowPlan: input.plan.workflowPlan,
      provider: input.provider, runtimeBoundary: input.runtimeBoundary, proposedChangePreview: input.proposedChangePreview, stagingWorkspace: input.stagingWorkspace })
  }
  private expectedStagedEffectReceipt(input: Pick<ControlledClaudeImplementationInput, "units" | "resourceScopes" | "permissions">): string {
    return canonicalDigest({ resourceScopes: input.resourceScopes, permissions: input.permissions, units: input.units.map((unit) => ({ id: unit.id,
      unitPlanReceiptDigest: unit.unitPlanReceiptDigest, paths: unit.paths.map((path) => ({ id: path.id, stagedEffectReceiptDigest: path.stagedEffectReceiptDigest })) })) })
  }
  private expectedRecoveryCheckpoint(input: Pick<ControlledClaudeImplementationInput, "plan" | "proposedChangePreview" | "stagingWorkspace" | "resourceScopes">): string {
    return canonicalDigest({ planReceiptDigest: input.plan.planReceiptDigest, stagedEffectReceiptDigest: input.plan.stagedEffectReceiptDigest,
      proposedChangePreview: input.proposedChangePreview, stagingWorkspace: input.stagingWorkspace, resourceScopes: input.resourceScopes })
  }
  private expectedRecoveryReceipt(input: Pick<ControlledClaudeImplementationInput, "recoveryJournal">): string {
    return canonicalDigest({ strategy: input.recoveryJournal.strategy, journalKey: input.recoveryJournal.journalKey, checkpointDigest: input.recoveryJournal.checkpointDigest })
  }
  private composeDigests(input: ControlledClaudeImplementationInput) {
    const bindingReceiptDigest = canonicalDigest({ context: input.context, proposedChangePreview: input.proposedChangePreview, stagingWorkspace: input.stagingWorkspace, selection: input.selection })
    const providerReceiptDigest = canonicalDigest(input.provider)
    const runtimeBoundaryReceiptDigest = canonicalDigest(input.runtimeBoundary)
    const scopeReceiptDigest = canonicalDigest({ resourceScopes: input.resourceScopes, permissions: input.permissions, units: input.units })
    const planReceiptDigestVerified = canonicalDigest({ supplied: input.plan.planReceiptDigest, expected: this.expectedPlanReceipt(input) })
    const stagedEffectReceiptDigestVerified = canonicalDigest({ supplied: input.plan.stagedEffectReceiptDigest, expected: this.expectedStagedEffectReceipt(input) })
    const lifecycleReceiptDigest = canonicalDigest(input.lifecycle)
    const prerequisiteReceiptDigest = canonicalDigest(input.prerequisites)
    const recoveryReceiptDigestVerified = canonicalDigest({ supplied: input.recoveryJournal.recoveryReceiptDigest, expected: this.expectedRecoveryReceipt(input) })
    const assessmentReceiptDigest = canonicalDigest({ bindingReceiptDigest, providerReceiptDigest, runtimeBoundaryReceiptDigest, scopeReceiptDigest, planReceiptDigestVerified,
      stagedEffectReceiptDigestVerified, lifecycleReceiptDigest, prerequisiteReceiptDigest, recoveryReceiptDigestVerified,
      outcomes: input.units.map((unit) => ({ id: unit.id, outcome: unit.outcome, paths: unit.paths.map((path) => ({ id: path.id, outcome: path.outcome })) })),
      reviewState: input.reviewState, unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations,
      acceptanceDecisionState: input.acceptanceDecisionState, nativeHostAcceptanceState: input.nativeHostAcceptanceState,
      liveProviderAcceptanceState: input.liveProviderAcceptanceState, securityAcceptanceState: input.securityAcceptanceState,
      releaseReadinessState: input.releaseReadinessState, deploymentReadinessState: input.deploymentReadinessState,
      actionAuthorityState: input.actionAuthorityState })
    return { bindingReceiptDigest, providerReceiptDigest, runtimeBoundaryReceiptDigest, scopeReceiptDigest, planReceiptDigestVerified, stagedEffectReceiptDigestVerified,
      lifecycleReceiptDigest, prerequisiteReceiptDigest, recoveryReceiptDigestVerified, assessmentReceiptDigest }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id || canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) throw new Error("Controlled Claude Implementation must bind exact current Product and Initiative revisions and digests")
  }
  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return { productRevision: revisionOf(product), productDigest: canonicalDigest(product), initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) }
  }
  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Controlled Claude Implementation is immutable`)
    return { product, initiative }
  }
  private async commitVersionedRecord(record: ControlledClaudeImplementation, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({ writes: [this.governed(this.currentPath(record.id), record, controlledClaudeImplementationSchema),
      this.governed(this.historyPath(record.id, record.revision), record, controlledClaudeImplementationSchema)],
    audit: { eventType, actor: { kind: "human", id: actorId }, subjectId: record.id, payload: {
      initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record), proposedChangePreview: record.proposedChangePreview,
      stagingWorkspace: record.stagingWorkspace, provider: record.provider, planKey: record.plan.planKey,
      bindingReceiptDigest: record.bindingReceiptDigest, providerReceiptDigest: record.providerReceiptDigest, runtimeBoundaryReceiptDigest: record.runtimeBoundaryReceiptDigest, scopeReceiptDigest: record.scopeReceiptDigest,
      planReceiptDigest: record.planReceiptDigestVerified, stagedEffectReceiptDigest: record.stagedEffectReceiptDigestVerified,
      lifecycleReceiptDigest: record.lifecycleReceiptDigest, prerequisiteReceiptDigest: record.prerequisiteReceiptDigest,
      recoveryReceiptDigest: record.recoveryReceiptDigestVerified, assessmentReceiptDigest: record.assessmentReceiptDigest,
      predecessorDigest: record.predecessorDigest, unitCount: record.units.length, pathCount: record.units.reduce((sum, unit) => sum + unit.paths.length, 0),
      lifecycle: record.lifecycle, reviewState: record.reviewState, actionAuthorityState: record.actionAuthorityState, authorityBoundary: record.authorityBoundary,
    } } })
  }
  private currentPath(id: string): string { return this.repository.resolve("controlled-claude-implementations", `${id}.json`) }
  private historyPath(id: string, revision: number): string { return this.repository.resolve("controlled-claude-implementation-history", `controlled-claude-implementation-${id}-r${revision}.json`) }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string { const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data }
  private async assertIntegrity(): Promise<void> { const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed") }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error }
    if (names.length > inventoryLimit) throw new Error(`Controlled Claude Implementation directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => `${String((left as Record<string, unknown>).id ?? "")}:${String((left as Record<string, unknown>).revision ?? "")}`.localeCompare(`${String((right as Record<string, unknown>).id ?? "")}:${String((right as Record<string, unknown>).revision ?? "")}`))
  }
}
