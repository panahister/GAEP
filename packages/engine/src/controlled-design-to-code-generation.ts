import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  controlledDesignToCodeGenerationInputSchema,
  controlledDesignToCodeGenerationProjectionSchema,
  controlledDesignToCodeGenerationSchema,
  controlledDesignToCodeGenerationStatusSchema,
  type ApprovedFigmaContextRetrieval,
  type BoilerplateCompatibilityValidation,
  type BoilerplateSelectionBinding,
  type BusinessContextBinding,
  type ControlledClaudeImplementation,
  type ControlledCodexImplementation,
  type ControlledDesignToCodeGeneration,
  type ControlledDesignToCodeGenerationInput,
  type ControlledDesignToCodeGenerationProjection,
  type ControlledDesignToCodeGenerationStatus,
  type DesignBaseline,
  type DesignToCodeBindingRegistry,
  type DesignToRequirementBinding,
  type FigmaToBoilerplateMapping,
  type ImplementationUnitModel,
  type Initiative,
  type ModelSwitchImplementation,
  type Product,
  type ProposedChangePreview,
  type ProviderSwitchImplementation,
  type RouteScreenComponentMapping,
  type StagingWorkspace,
  type TechnologyProfile,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type CurrentReader<T> = { readCurrent(initiativeId: string): Promise<T | undefined> }
type ExactReference = { recordId: string; revision: number; digest: string }
interface Dependencies {
  approvedFigmaContextRetrieval: ApprovedFigmaContextRetrieval
  designBaseline: DesignBaseline
  designToRequirementBinding: DesignToRequirementBinding
  figmaToBoilerplateMapping: FigmaToBoilerplateMapping
  designToCodeBindingRegistry: DesignToCodeBindingRegistry
  routeScreenComponentMapping: RouteScreenComponentMapping
  implementationUnitModel: ImplementationUnitModel
  technologyProfile: TechnologyProfile
  boilerplateSelectionBinding: BoilerplateSelectionBinding
  boilerplateCompatibilityValidation: BoilerplateCompatibilityValidation
  proposedChangePreview: ProposedChangePreview
  stagingWorkspace: StagingWorkspace
  controlledCodexImplementation: ControlledCodexImplementation
  controlledClaudeImplementation: ControlledClaudeImplementation
  providerSwitchImplementation: ProviderSwitchImplementation
  modelSwitchImplementation: ModelSwitchImplementation
}

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "controlled-design-to-code-generation-is-an-offline-versioned-portable-generation-plan-candidate-and-does-not-call-figma-or-a-live-provider-materialize-or-transfer-protected-context-generate-or-inspect-code-create-stage-effects-mutate-source-establish-approval-authorization-acceptance-readiness-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "controlled-design-to-code-generation-status-is-observational-and-grants-no-figma-or-provider-access-context-transfer-generation-output-stage-mutation-approval-authorization-acceptance-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "controlled-design-to-code-generation-projection-is-read-only-and-grants-no-figma-or-provider-access-context-transfer-generation-output-stage-mutation-approval-authorization-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-provider-model-identifiers-target-counts-states-and-receipt-digests-only-not-design-content-prompts-provider-output-source-diffs-machine-paths-personal-data-secrets-credentials-or-permissions" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}
function sameReference(reference: ExactReference | undefined, record: { id: string; revision?: number } | undefined): boolean {
  return Boolean(reference && record && reference.recordId === record.id && reference.revision === revisionOf(record) && reference.digest === canonicalDigest(record))
}

export class ControlledDesignToCodeGenerationService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly readers: { [K in keyof Dependencies]: CurrentReader<Dependencies[K]> },
  ) {}

  async create(inputValue: ControlledDesignToCodeGenerationInput, actorId: string): Promise<ControlledDesignToCodeGeneration> {
    const input = controlledDesignToCodeGenerationInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      if (await this.readCurrent(input.initiativeId)) throw new Error("A current Controlled Design-to-Code Generation candidate already exists; create a revision")
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies, product, initiative)
      const now = new Date().toISOString(), digests = this.composeDigests(input)
      const record = controlledDesignToCodeGenerationSchema.parse({
        schemaVersion: 1, kind: "controlled-design-to-code-generation-candidate", id: randomUUID(), productId: product.id,
        ...input, revision: 1, ...digests, state: "candidate", createdBy: { kind: "human", id: actorId },
        updatedBy: { kind: "human", id: actorId }, createdAt: now, updatedAt: now, authorityBoundary,
      })
      await this.commitVersionedRecord(record, "controlled-design-to-code-generation.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: ControlledDesignToCodeGenerationInput, actorId: string): Promise<ControlledDesignToCodeGeneration> {
    const input = controlledDesignToCodeGenerationInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Controlled Design-to-Code Generation revision conflict")
      if (current.initiativeId !== input.initiativeId) throw new Error("Controlled Design-to-Code Generation Initiative binding is immutable")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies, product, initiative)
      const now = new Date().toISOString(), digests = this.composeDigests(input)
      const record = controlledDesignToCodeGenerationSchema.parse({
        ...current, ...input, revision: current.revision + 1, ...digests, predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId }, updatedAt: now,
      })
      await this.commitVersionedRecord(record, "controlled-design-to-code-generation.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<ControlledDesignToCodeGeneration> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Controlled Design-to-Code Generation ID")), controlledDesignToCodeGenerationSchema)
  }
  async readCurrent(initiativeId: string): Promise<ControlledDesignToCodeGeneration | undefined> {
    const target = this.requireUuid(initiativeId, "Initiative ID")
    const matches = (await this.listRecords("controlled-design-to-code-generations", currentRecordPattern, controlledDesignToCodeGenerationSchema))
      .filter((record) => record.initiativeId === target)
    if (matches.length > 1) throw new Error("Multiple current Controlled Design-to-Code Generation candidates target one Initiative")
    return matches[0]
  }
  async readRevision(id: string, revision: number): Promise<ControlledDesignToCodeGeneration> {
    const recordId = this.requireUuid(id, "Controlled Design-to-Code Generation ID")
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Revision must be a positive integer")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), controlledDesignToCodeGenerationSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Controlled Design-to-Code Generation history binding mismatch")
    return record
  }
  async listHistory(id: string): Promise<ControlledDesignToCodeGeneration[]> {
    const recordId = this.requireUuid(id, "Controlled Design-to-Code Generation ID")
    const pattern = new RegExp(`^controlled-design-to-code-generation-${recordId}-r[1-9][0-9]*\\.json$`, "i")
    const records = await this.listRecords("controlled-design-to-code-generation-history", pattern, controlledDesignToCodeGenerationSchema)
    return records.sort((left, right) => right.revision - left.revision)
  }

  async assess(initiativeId: string): Promise<ControlledDesignToCodeGenerationStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, dependencies] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), this.readDependencies(targetId),
    ])
    const reasons: string[] = []
    let staleBindingCount = 0, targetGapCount = 0, providerGapCount = 0, contextGapCount = 0,
      lifecycleGapCount = 0, prerequisiteGapCount = 0, evidenceGapCount = 0, invalidCandidateCount = 0
    if (!candidate) reasons.push("No current Controlled Design-to-Code Generation candidate is recorded")
    if (Object.values(dependencies).some((value) => !value)) reasons.push("One or more required design, staging, or provider predecessor candidates are unavailable")
    if (candidate) {
      for (const key of Object.keys(dependencies) as (keyof Dependencies)[]) {
        if (!sameReference(candidate.dependencies[key], dependencies[key])) staleBindingCount += 1
      }
      if (candidate.targets.length === 0 || candidate.targets.some((target) => target.generationEffectState !== "not-performed" || target.sourceMutationState !== "not-performed")) targetGapCount += 1
      if (candidate.selection.adapterId !== candidate.provider.adapterId || candidate.selection.agentId !== candidate.provider.agentId || candidate.selection.modelId !== candidate.provider.modelId) providerGapCount += 1
      if (candidate.designContext.contentBoundary !== "metadata-and-digests-only" || candidate.designContext.materializationState !== "not-performed" || candidate.designContext.transferState !== "not-performed") contextGapCount += 1
      if (Object.entries(candidate.lifecycle).some(([key, value]) => key === "planningState" ? value !== "candidate-defined" :
        key === "generatedOutputState" ? value !== "not-created" : ["approvalState", "authorizationState", "acceptanceState"].includes(key) ? value !== "not-established" : value !== "not-performed")) lifecycleGapCount += 1
      prerequisiteGapCount = candidate.prerequisites.filter((entry) => entry.state !== "required-not-established").length
      if (candidate.evidenceReferences.length === 0) evidenceGapCount += 1
      try {
        if (this.completeDependencies(dependencies)) this.validateCandidate(candidate, dependencies, product, initiative)
      } catch { invalidCandidateCount += 1 }
    }
    if (staleBindingCount) reasons.push("One or more exact predecessor bindings are stale")
    if (targetGapCount) reasons.push("The generation target catalog or no-effect target stop lines are incomplete")
    if (providerGapCount) reasons.push("The selected provider/model does not preserve exact controlled model-switch continuity")
    if (contextGapCount) reasons.push("The approved design context or metadata-only transfer stop lines are incomplete")
    if (lifecycleGapCount) reasons.push("The offline controlled generation lifecycle stop lines are incomplete")
    if (prerequisiteGapCount) reasons.push("One or more human, live-provider, or stage prerequisites are not represented fail closed")
    if (evidenceGapCount) reasons.push("The generation plan lacks attributable evidence")
    if (invalidCandidateCount) reasons.push("The generation-plan bindings or deterministic receipts are invalid")
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    if (unresolvedQuestionCount) reasons.push("The candidate records unresolved questions")
    const reviewState = candidate?.reviewState ?? "draft"
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    const blocking = staleBindingCount + targetGapCount + providerGapCount + contextGapCount + lifecycleGapCount + prerequisiteGapCount + evidenceGapCount + invalidCandidateCount + unresolvedQuestionCount
    const implementationUnits = new Set(candidate?.targets.map((target) => target.implementationUnitId) ?? [])
    return controlledDesignToCodeGenerationStatusSchema.parse({
      schemaVersion: 1, kind: "controlled-design-to-code-generation-status", productId: product.id, productRevision: revisionOf(product),
      initiativeId: initiative.id, initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate), dependencies: candidate.dependencies, selectedProvider: candidate.selectedProvider } : {}),
      targetCount: candidate?.targets.length ?? 0, implementationUnitCount: implementationUnits.size, pathCount: candidate?.targets.length ?? 0,
      expectedTraceCount: candidate?.targets.reduce((total, target) => total + target.expectedTraceKeys.length, 0) ?? 0,
      expectedTestOutputCount: candidate?.targets.reduce((total, target) => total + target.expectedTestOutputs.length, 0) ?? 0,
      staleBindingCount, targetGapCount, providerGapCount, contextGapCount, lifecycleGapCount, prerequisiteGapCount,
      evidenceGapCount, invalidCandidateCount, unresolvedQuestionCount, reviewState,
      state: candidate && this.completeDependencies(dependencies) && blocking === 0 && reviewState === "ready-for-human-review" ? "candidate-defined" : "attention-required",
      reasons, assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary,
    })
  }

  async project(initiativeId: string): Promise<ControlledDesignToCodeGenerationProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    const withoutDigest = {
      schemaVersion: 1 as const, kind: "controlled-design-to-code-generation-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state }, status,
      ...(candidate ? { candidate: {
        id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        selectedProvider: candidate.selectedProvider, selection: candidate.selection, provider: candidate.provider,
        designContext: candidate.designContext, planKey: candidate.planKey, targetCount: candidate.targets.length,
        implementationUnitCount: new Set(candidate.targets.map((target) => target.implementationUnitId)).size, pathCount: candidate.targets.length,
        dependencyReceiptDigest: candidate.dependencyReceiptDigest, providerReceiptDigest: candidate.providerReceiptDigest,
        designContextReceiptDigest: candidate.designContextReceiptDigest, targetCatalogDigest: candidate.targetCatalogDigest,
        expectedOutputReceiptDigest: candidate.expectedOutputReceiptDigest, lifecycleReceiptDigest: candidate.lifecycleReceiptDigest,
        prerequisiteReceiptDigest: candidate.prerequisiteReceiptDigest, assessmentReceiptDigest: candidate.assessmentReceiptDigest,
        lifecycle: candidate.lifecycle, reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary,
    }
    return controlledDesignToCodeGenerationProjectionSchema.parse({ ...withoutDigest, snapshotDigest: canonicalDigest(withoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    for (const candidate of await this.listRecords("controlled-design-to-code-generations", currentRecordPattern, controlledDesignToCodeGenerationSchema)) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) throw new Error("Current candidate does not match immutable history")
        if ((await this.assess(candidate.initiativeId)).state === "attention-required") issues.push({
          code: "controlled-design-to-code-generation.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has a stale, incomplete, or unresolved Controlled Design-to-Code Generation candidate.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "create-superseding-revision"],
        })
      } catch (error) {
        issues.push({ code: "controlled-design-to-code-generation.invalid", severity: "error",
          message: `Controlled Design-to-Code Generation ${candidate.id}: ${error instanceof Error ? error.message : "validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "manual-repair-required"] })
      }
    }
    return issues
  }

  private async readDependencies(initiativeId: string): Promise<{ [K in keyof Dependencies]: Dependencies[K] | undefined }> {
    const keys = Object.keys(this.readers) as (keyof Dependencies)[]
    const values = await Promise.all(keys.map((key) => this.readers[key].readCurrent(initiativeId)))
    return Object.fromEntries(keys.map((key, index) => [key, values[index]])) as { [K in keyof Dependencies]: Dependencies[K] | undefined }
  }
  private completeDependencies(value: { [K in keyof Dependencies]: Dependencies[K] | undefined }): value is Dependencies {
    return Object.values(value).every(Boolean)
  }
  private async requireExactDependencies(input: ControlledDesignToCodeGenerationInput): Promise<Dependencies> {
    const dependencies = await this.readDependencies(input.initiativeId)
    for (const key of Object.keys(dependencies) as (keyof Dependencies)[]) {
      if (!sameReference(input.dependencies[key], dependencies[key])) throw new Error(`Controlled Design-to-Code Generation must reference the exact current ${key}`)
    }
    if (!this.completeDependencies(dependencies)) throw new Error("Controlled Design-to-Code Generation dependencies are incomplete")
    return dependencies
  }

  private validateCandidate(input: ControlledDesignToCodeGenerationInput, dependencies: Dependencies, product: Product, initiative: Initiative): void {
    for (const dependency of Object.values(dependencies)) {
      if (dependency.productId !== product.id || dependency.initiativeId !== initiative.id || canonicalDigest(dependency.context) !== canonicalDigest(input.context)) {
        throw new Error("Controlled Design-to-Code Generation dependencies must bind the exact current Product, Initiative, and context")
      }
    }
    const { approvedFigmaContextRetrieval: approved, designBaseline: baseline, designToRequirementBinding: requirementBinding,
      figmaToBoilerplateMapping: figmaMapping, designToCodeBindingRegistry: codeBinding,
      routeScreenComponentMapping: routeMapping, implementationUnitModel, technologyProfile, boilerplateSelectionBinding,
      boilerplateCompatibilityValidation, proposedChangePreview: preview, stagingWorkspace: staging,
      controlledCodexImplementation: codex, controlledClaudeImplementation: claude,
      providerSwitchImplementation: providerSwitch, modelSwitchImplementation: modelSwitch } = dependencies
    if (!sameReference(approved.dependencies.designBaseline, baseline) || !sameReference(approved.dependencies.designToRequirementBinding, requirementBinding) ||
        !sameReference(approved.dependencies.designToCodeBindingRegistry, codeBinding) || !sameReference(approved.dependencies.routeScreenComponentMapping, routeMapping) ||
        !sameReference(approved.dependencies.proposedChangePreview, preview) || !sameReference(approved.dependencies.stagingWorkspace, staging) ||
        !sameReference(approved.dependencies.modelSwitchImplementation, modelSwitch) || !sameReference(codeBinding.designBaseline, baseline) ||
        !sameReference(codeBinding.designToRequirementBinding, requirementBinding) || !sameReference(codeBinding.figmaToBoilerplateMapping, figmaMapping) ||
        !sameReference(codeBinding.implementationUnitModel, implementationUnitModel) || !sameReference(codeBinding.technologyProfile, technologyProfile) ||
        !sameReference(codeBinding.boilerplateSelectionBinding, boilerplateSelectionBinding) || !sameReference(codeBinding.boilerplateCompatibilityValidation, boilerplateCompatibilityValidation) ||
        !sameReference(routeMapping.designBaseline, baseline) || !sameReference(routeMapping.designToRequirementBinding, requirementBinding) ||
        !sameReference(routeMapping.designToCodeBindingRegistry, codeBinding) || !sameReference(staging.proposedChangePreview, preview) ||
        !sameReference(codex.proposedChangePreview, preview) || !sameReference(codex.stagingWorkspace, staging) ||
        !sameReference(claude.proposedChangePreview, preview) || !sameReference(claude.stagingWorkspace, staging) ||
        !sameReference(providerSwitch.controlledCodexImplementation, codex) || !sameReference(providerSwitch.controlledClaudeImplementation, claude) ||
        !sameReference(modelSwitch.providerSwitchImplementation, providerSwitch)) {
      throw new Error("Controlled Design-to-Code Generation predecessor continuity is stale")
    }
    if (input.selectedProvider !== modelSwitch.provider || canonicalDigest(input.selection) !== canonicalDigest(modelSwitch.targetSelection) ||
        canonicalDigest(input.provider) !== canonicalDigest(modelSwitch.targetProvider)) {
      throw new Error("Controlled Design-to-Code Generation must preserve the exact selected provider and target model candidate")
    }
    const designContext = input.designContext
    if (designContext.approvedSnapshotReceiptDigest !== approved.approvedSnapshotReceiptDigest ||
        designContext.approvedGenerationContextReceiptDigest !== approved.generationContextReceiptDigest ||
        designContext.baselineMembershipDigest !== baseline.membershipDigest ||
        designContext.baselineSemanticVersion !== baseline.semanticVersion ||
        designContext.designBindingCatalogDigest !== codeBinding.bindingSubjectCatalogDigest ||
        designContext.routeSubjectCatalogDigest !== routeMapping.subjectCatalogDigest) {
      throw new Error("Controlled Design-to-Code Generation must preserve the exact approved design/version context")
    }
    for (const target of input.targets) {
      const subject = codeBinding.subjects.find((entry) => entry.id === target.designToCodeBindingSubjectId)
      if (!subject || subject.disposition !== "candidate-bound" || subject.implementationUnitId !== target.implementationUnitId ||
          subject.repositoryCandidate !== target.repositoryCandidate || subject.moduleCandidate !== target.moduleCandidate ||
          subject.pathCandidate !== target.pathCandidate) {
        throw new Error("Controlled Design-to-Code Generation targets must preserve exact evidence-backed Design-to-Code binding candidates")
      }
      const expectedTargetReceipt = canonicalDigest({
        targetKey: target.targetKey, designToCodeBindingSubjectId: target.designToCodeBindingSubjectId,
        implementationUnitId: target.implementationUnitId, repositoryCandidate: target.repositoryCandidate,
        moduleCandidate: target.moduleCandidate, pathCandidate: target.pathCandidate,
        expectedTraceKeys: target.expectedTraceKeys, expectedTestOutputs: target.expectedTestOutputs,
      })
      if (target.targetReceiptDigest !== expectedTargetReceipt) throw new Error("Controlled Design-to-Code Generation target receipt is invalid")
    }
  }

  private composeDigests(input: ControlledDesignToCodeGenerationInput) {
    const dependencyReceiptDigest = canonicalDigest(input.dependencies)
    const providerReceiptDigest = canonicalDigest({ selectedProvider: input.selectedProvider, selection: input.selection, provider: input.provider })
    const designContextReceiptDigest = canonicalDigest(input.designContext)
    const targetCatalogDigest = canonicalDigest(input.targets)
    const expectedOutputReceiptDigest = canonicalDigest(input.targets.map((target) => ({
      id: target.id, expectedTraceKeys: target.expectedTraceKeys, expectedTestOutputs: target.expectedTestOutputs,
    })))
    const lifecycleReceiptDigest = canonicalDigest(input.lifecycle)
    const prerequisiteReceiptDigest = canonicalDigest(input.prerequisites)
    const assessmentReceiptDigest = canonicalDigest({
      dependencyReceiptDigest, providerReceiptDigest, designContextReceiptDigest, targetCatalogDigest, expectedOutputReceiptDigest,
      lifecycleReceiptDigest, prerequisiteReceiptDigest, reviewState: input.reviewState, unresolvedQuestions: input.unresolvedQuestions,
      limitations: input.limitations, generationReadinessState: input.generationReadinessState,
      nativeHostAcceptanceState: input.nativeHostAcceptanceState, liveProviderAcceptanceState: input.liveProviderAcceptanceState,
      securityAcceptanceState: input.securityAcceptanceState, releaseReadinessState: input.releaseReadinessState,
      deploymentReadinessState: input.deploymentReadinessState, actionAuthorityState: input.actionAuthorityState,
    })
    return { dependencyReceiptDigest, providerReceiptDigest, designContextReceiptDigest, targetCatalogDigest,
      expectedOutputReceiptDigest, lifecycleReceiptDigest, prerequisiteReceiptDigest, assessmentReceiptDigest }
  }
  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id || canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) {
      throw new Error("Controlled Design-to-Code Generation must bind exact current Product and Initiative revisions and digests")
    }
  }
  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return { productRevision: revisionOf(product), productDigest: canonicalDigest(product), initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) }
  }
  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Controlled Design-to-Code Generation is immutable`)
    return { product, initiative }
  }
  private async commitVersionedRecord(record: ControlledDesignToCodeGeneration, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({ writes: [
      this.governed(this.currentPath(record.id), record, controlledDesignToCodeGenerationSchema),
      this.governed(this.historyPath(record.id, record.revision), record, controlledDesignToCodeGenerationSchema),
    ], audit: { eventType, actor: { kind: "human", id: actorId }, subjectId: record.id, payload: {
      initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record), dependencies: record.dependencies,
      selectedProvider: record.selectedProvider, planKey: record.planKey, targetCount: record.targets.length,
      implementationUnitCount: new Set(record.targets.map((target) => target.implementationUnitId)).size,
      pathCount: record.targets.length, dependencyReceiptDigest: record.dependencyReceiptDigest,
      providerReceiptDigest: record.providerReceiptDigest, designContextReceiptDigest: record.designContextReceiptDigest,
      targetCatalogDigest: record.targetCatalogDigest, expectedOutputReceiptDigest: record.expectedOutputReceiptDigest,
      lifecycleReceiptDigest: record.lifecycleReceiptDigest, prerequisiteReceiptDigest: record.prerequisiteReceiptDigest,
      assessmentReceiptDigest: record.assessmentReceiptDigest, predecessorDigest: record.predecessorDigest,
      lifecycle: record.lifecycle, reviewState: record.reviewState, actionAuthorityState: record.actionAuthorityState,
      authorityBoundary: record.authorityBoundary,
    } } })
  }
  private currentPath(id: string): string { return this.repository.resolve("controlled-design-to-code-generations", `${id}.json`) }
  private historyPath(id: string, revision: number): string { return this.repository.resolve("controlled-design-to-code-generation-history", `controlled-design-to-code-generation-${id}-r${revision}.json`) }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string { const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data }
  private async assertIntegrity(): Promise<void> { const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed") }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error }
    if (names.length > inventoryLimit) throw new Error(`Controlled Design-to-Code Generation directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => `${String((left as Record<string, unknown>).id ?? "")}:${String((left as Record<string, unknown>).revision ?? "")}`.localeCompare(`${String((right as Record<string, unknown>).id ?? "")}:${String((right as Record<string, unknown>).revision ?? "")}`))
  }
}
