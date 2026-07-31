import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  approvedFigmaContextRetrievalInputSchema,
  approvedFigmaContextRetrievalProjectionSchema,
  approvedFigmaContextRetrievalSchema,
  approvedFigmaContextRetrievalStatusSchema,
  type ApprovedFigmaContextRetrieval,
  type ApprovedFigmaContextRetrievalInput,
  type ApprovedFigmaContextRetrievalProjection,
  type ApprovedFigmaContextRetrievalStatus,
  type BusinessContextBinding,
  type DesignApplicability,
  type DesignBaseline,
  type DesignToCodeBindingRegistry,
  type DesignToRequirementBinding,
  type FinalizedFigmaSnapshotImport,
  type HumanDesignApproval,
  type Initiative,
  type ModelSwitchImplementation,
  type Product,
  type ProposedChangePreview,
  type RouteScreenComponentMapping,
  type StagingWorkspace,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type CurrentReader<T> = { readCurrent(initiativeId: string): Promise<T | undefined> }
type ExactReference = { recordId: string; revision: number; digest: string }
interface Dependencies {
  designApplicability: DesignApplicability
  finalizedFigmaSnapshotImport: FinalizedFigmaSnapshotImport
  humanDesignApproval: HumanDesignApproval
  designBaseline: DesignBaseline
  designToRequirementBinding: DesignToRequirementBinding
  designToCodeBindingRegistry: DesignToCodeBindingRegistry
  routeScreenComponentMapping: RouteScreenComponentMapping
  proposedChangePreview: ProposedChangePreview
  stagingWorkspace: StagingWorkspace
  modelSwitchImplementation: ModelSwitchImplementation
}

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "approved-figma-context-retrieval-is-an-offline-versioned-portable-candidate-and-does-not-connect-to-or-call-figma-fetch-or-materialize-remote-content-transfer-context-expose-design-or-source-content-establish-design-approval-baseline-or-generation-readiness-execute-a-provider-generate-code-create-or-change-a-stage-mutate-source-approve-authorize-accept-release-deploy-or-grant-action-authority" as const
const statusAuthorityBoundary = "approved-figma-context-retrieval-status-is-observational-and-grants-no-figma-access-content-materialization-context-transfer-generation-provider-stage-mutation-approval-authorization-acceptance-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "approved-figma-context-retrieval-projection-is-read-only-and-grants-no-figma-access-content-materialization-context-transfer-generation-provider-stage-mutation-approval-authorization-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-versions-counts-states-and-receipt-digests-only-not-design-or-source-content-prompts-provider-output-machine-paths-personal-data-secrets-credentials-or-permissions" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}
function sameReference(reference: ExactReference | undefined, record: { id: string; revision?: number } | undefined): boolean {
  return Boolean(reference && record && reference.recordId === record.id && reference.revision === revisionOf(record) && reference.digest === canonicalDigest(record))
}

export class ApprovedFigmaContextRetrievalService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly readers: { [K in keyof Dependencies]: CurrentReader<Dependencies[K]> },
  ) {}

  async create(inputValue: ApprovedFigmaContextRetrievalInput, actorId: string): Promise<ApprovedFigmaContextRetrieval> {
    const input = approvedFigmaContextRetrievalInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      if (await this.readCurrent(input.initiativeId)) throw new Error("A current Approved Figma Context Retrieval candidate already exists; create a revision")
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies, product, initiative)
      const now = new Date().toISOString(), digests = this.composeDigests(input)
      const record = approvedFigmaContextRetrievalSchema.parse({
        schemaVersion: 1, kind: "approved-figma-context-retrieval-candidate", id: randomUUID(), productId: product.id,
        ...input, revision: 1, ...digests, state: "candidate", createdBy: { kind: "human", id: actorId },
        updatedBy: { kind: "human", id: actorId }, createdAt: now, updatedAt: now, authorityBoundary,
      })
      await this.commitVersionedRecord(record, "approved-figma-context-retrieval.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: ApprovedFigmaContextRetrievalInput, actorId: string): Promise<ApprovedFigmaContextRetrieval> {
    const input = approvedFigmaContextRetrievalInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Approved Figma Context Retrieval revision conflict")
      if (current.initiativeId !== input.initiativeId) throw new Error("Approved Figma Context Retrieval Initiative binding is immutable")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies, product, initiative)
      const now = new Date().toISOString(), digests = this.composeDigests(input)
      const record = approvedFigmaContextRetrievalSchema.parse({
        ...current, ...input, revision: current.revision + 1, ...digests, predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId }, updatedAt: now,
      })
      await this.commitVersionedRecord(record, "approved-figma-context-retrieval.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<ApprovedFigmaContextRetrieval> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Approved Figma Context Retrieval ID")), approvedFigmaContextRetrievalSchema)
  }
  async readCurrent(initiativeId: string): Promise<ApprovedFigmaContextRetrieval | undefined> {
    const target = this.requireUuid(initiativeId, "Initiative ID")
    const matches = (await this.listRecords("approved-figma-context-retrievals", currentRecordPattern, approvedFigmaContextRetrievalSchema))
      .filter((record) => record.initiativeId === target)
    if (matches.length > 1) throw new Error("Multiple current Approved Figma Context Retrieval candidates target one Initiative")
    return matches[0]
  }
  async readRevision(id: string, revision: number): Promise<ApprovedFigmaContextRetrieval> {
    const recordId = this.requireUuid(id, "Approved Figma Context Retrieval ID")
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Revision must be a positive integer")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), approvedFigmaContextRetrievalSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Approved Figma Context Retrieval history binding mismatch")
    return record
  }
  async listHistory(id: string): Promise<ApprovedFigmaContextRetrieval[]> {
    const recordId = this.requireUuid(id, "Approved Figma Context Retrieval ID")
    const pattern = new RegExp(`^approved-figma-context-retrieval-${recordId}-r[1-9][0-9]*\\.json$`, "i")
    const records = await this.listRecords("approved-figma-context-retrieval-history", pattern, approvedFigmaContextRetrievalSchema)
    return records.sort((left, right) => right.revision - left.revision)
  }

  async assess(initiativeId: string): Promise<ApprovedFigmaContextRetrievalStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, dependencies] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), this.readDependencies(targetId),
    ])
    const reasons: string[] = []
    let staleBindingCount = 0, snapshotGapCount = 0, generationContextGapCount = 0, lifecycleGapCount = 0,
      evidenceGapCount = 0, invalidCandidateCount = 0
    if (!candidate) reasons.push("No current Approved Figma Context Retrieval candidate is recorded")
    if (Object.values(dependencies).some((value) => !value)) reasons.push("One or more required design or implementation predecessor candidates are unavailable")
    if (candidate) {
      for (const key of Object.keys(dependencies) as (keyof Dependencies)[]) {
        if (!sameReference(candidate.dependencies[key], dependencies[key])) staleBindingCount += 1
      }
      if (candidate.approvedSnapshot.itemCount !== candidate.approvedSnapshot.includedItemCount + candidate.approvedSnapshot.excludedItemCount ||
          candidate.approvedSnapshot.humanDecisionCandidateState !== "approved-candidate") snapshotGapCount += 1
      if (candidate.generationContext.contentBoundary !== "metadata-and-digests-only" ||
          candidate.generationContext.materializationState !== "not-performed" || candidate.generationContext.transferState !== "not-performed") generationContextGapCount += 1
      if (Object.entries(candidate.lifecycle).some(([key, value]) => key === "retrievalCandidateState" ? value !== "candidate-defined" :
        ["approvalState", "authorizationState", "acceptanceState"].includes(key) ? value !== "not-established" : value !== "not-performed")) lifecycleGapCount += 1
      if (candidate.evidenceReferences.length === 0) evidenceGapCount += 1
      try {
        if (this.completeDependencies(dependencies)) this.validateCandidate(candidate, dependencies, product, initiative)
      } catch { invalidCandidateCount += 1 }
    }
    if (staleBindingCount) reasons.push("One or more exact predecessor bindings are stale")
    if (snapshotGapCount) reasons.push("The approved snapshot/version or candidate approval scope is incomplete")
    if (generationContextGapCount) reasons.push("The bounded generation-context metadata or stop lines are incomplete")
    if (lifecycleGapCount) reasons.push("The offline retrieval lifecycle stop lines are incomplete")
    if (evidenceGapCount) reasons.push("The retrieval candidate lacks attributable evidence")
    if (invalidCandidateCount) reasons.push("The retrieval bindings or deterministic receipts are invalid")
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    if (unresolvedQuestionCount) reasons.push("The candidate records unresolved questions")
    const reviewState = candidate?.reviewState ?? "draft"
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    const blocking = staleBindingCount + snapshotGapCount + generationContextGapCount + lifecycleGapCount + evidenceGapCount + invalidCandidateCount + unresolvedQuestionCount
    return approvedFigmaContextRetrievalStatusSchema.parse({
      schemaVersion: 1, kind: "approved-figma-context-retrieval-status", productId: product.id, productRevision: revisionOf(product),
      initiativeId: initiative.id, initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate), dependencies: candidate.dependencies } : {}),
      snapshotItemCount: candidate?.approvedSnapshot.itemCount ?? 0, includedItemCount: candidate?.approvedSnapshot.includedItemCount ?? 0,
      requirementBindingCount: candidate?.generationContext.requirementBindingCount ?? 0,
      designToCodeBindingCount: candidate?.generationContext.designToCodeBindingCount ?? 0,
      routeSubjectCount: candidate?.generationContext.routeSubjectCount ?? 0,
      implementationUnitCount: candidate?.generationContext.implementationUnitCount ?? 0, pathCount: candidate?.generationContext.pathCount ?? 0,
      staleBindingCount, snapshotGapCount, generationContextGapCount, lifecycleGapCount, evidenceGapCount, invalidCandidateCount,
      unresolvedQuestionCount, reviewState,
      state: candidate && this.completeDependencies(dependencies) && blocking === 0 && reviewState === "ready-for-human-review" ? "candidate-defined" : "attention-required",
      reasons, assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary,
    })
  }

  async project(initiativeId: string): Promise<ApprovedFigmaContextRetrievalProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    const withoutDigest = {
      schemaVersion: 1 as const, kind: "approved-figma-context-retrieval-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state }, status,
      ...(candidate ? { candidate: {
        id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        approvedSnapshot: candidate.approvedSnapshot, generationContext: candidate.generationContext, lifecycle: candidate.lifecycle,
        dependencyReceiptDigest: candidate.dependencyReceiptDigest, approvedSnapshotReceiptDigest: candidate.approvedSnapshotReceiptDigest,
        generationContextReceiptDigest: candidate.generationContextReceiptDigest, lifecycleReceiptDigest: candidate.lifecycleReceiptDigest,
        assessmentReceiptDigest: candidate.assessmentReceiptDigest, reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary,
    }
    return approvedFigmaContextRetrievalProjectionSchema.parse({ ...withoutDigest, snapshotDigest: canonicalDigest(withoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    for (const candidate of await this.listRecords("approved-figma-context-retrievals", currentRecordPattern, approvedFigmaContextRetrievalSchema)) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) throw new Error("Current candidate does not match immutable history")
        if ((await this.assess(candidate.initiativeId)).state === "attention-required") issues.push({
          code: "approved-figma-context-retrieval.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has a stale, incomplete, or unresolved Approved Figma Context Retrieval candidate.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "create-superseding-revision"],
        })
      } catch (error) {
        issues.push({ code: "approved-figma-context-retrieval.invalid", severity: "error",
          message: `Approved Figma Context Retrieval ${candidate.id}: ${error instanceof Error ? error.message : "validation failed"}`,
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
  private async requireExactDependencies(input: ApprovedFigmaContextRetrievalInput): Promise<Dependencies> {
    const dependencies = await this.readDependencies(input.initiativeId)
    for (const key of Object.keys(dependencies) as (keyof Dependencies)[]) {
      if (!sameReference(input.dependencies[key], dependencies[key])) throw new Error(`Approved Figma Context Retrieval must reference the exact current ${key}`)
    }
    if (!this.completeDependencies(dependencies)) throw new Error("Approved Figma Context Retrieval dependencies are incomplete")
    return dependencies
  }

  private validateCandidate(input: ApprovedFigmaContextRetrievalInput, dependencies: Dependencies, product: Product, initiative: Initiative): void {
    for (const dependency of Object.values(dependencies)) {
      if (dependency.productId !== product.id || dependency.initiativeId !== initiative.id || canonicalDigest(dependency.context) !== canonicalDigest(input.context)) {
        throw new Error("Approved Figma Context Retrieval dependencies must bind the exact current Product, Initiative, and context")
      }
    }
    const { finalizedFigmaSnapshotImport: finalized, humanDesignApproval: approval, designBaseline: baseline,
      designApplicability: applicability, designToRequirementBinding: requirementBinding,
      designToCodeBindingRegistry: codeBinding, routeScreenComponentMapping: routeMapping,
      proposedChangePreview: preview, stagingWorkspace: staging, modelSwitchImplementation: modelSwitch } = dependencies
    const snapshot = input.approvedSnapshot
    if (approval.candidateResult !== "approved-candidate" || !approval.decision ||
        snapshot.externalFileIdentityDigest !== finalized.returnReceipt.externalFileIdentityDigest ||
        snapshot.returnedExternalVersionDigest !== finalized.returnReceipt.returnedExternalVersionDigest ||
        snapshot.itemCatalogDigest !== approval.subject.itemCatalogDigest || snapshot.itemCount !== finalized.items.length ||
        snapshot.includedItemCount !== approval.scope.includedItemDigests.length || snapshot.excludedItemCount !== approval.scope.excludedItemDigests.length ||
        snapshot.approvalSubjectDigest !== approval.subject.digest || snapshot.approvalScopeDigest !== approval.scope.scopeDigest ||
        snapshot.humanDecisionReceiptDigest !== approval.decisionReceiptDigest || snapshot.baselineMembershipDigest !== baseline.membershipDigest ||
        snapshot.baselineLineageId !== baseline.baselineLineageId || snapshot.baselineCandidateSetId !== baseline.candidateSetId ||
        snapshot.baselineCandidateSetRevision !== baseline.candidateSetRevision || snapshot.baselineSemanticVersion !== baseline.semanticVersion) {
      throw new Error("Approved Figma Context Retrieval must preserve the exact candidate-approved snapshot, scope, version, and baseline lineage")
    }
    if (!sameReference(baseline.humanDesignApproval, approval) || !sameReference(codeBinding.designBaseline, baseline) ||
        !sameReference(codeBinding.finalizedFigmaSnapshotImport, finalized) || !sameReference(codeBinding.designToRequirementBinding, requirementBinding) ||
        !sameReference(routeMapping.designBaseline, baseline) || !sameReference(routeMapping.designToRequirementBinding, requirementBinding) ||
        !sameReference(routeMapping.designToCodeBindingRegistry, codeBinding) || !sameReference(staging.proposedChangePreview, preview) ||
        !sameReference(modelSwitch.proposedChangePreview, preview) || !sameReference(modelSwitch.stagingWorkspace, staging)) {
      throw new Error("Approved Figma Context Retrieval predecessor continuity is stale")
    }
    const generation = input.generationContext
    const implementationUnits = new Set(codeBinding.subjects.map((subject) => subject.implementationUnitId)).size
    if (generation.designApplicabilityMembershipDigest !== applicability.membershipDigest ||
        generation.requirementBindingMembershipDigest !== requirementBinding.membershipDigest ||
        generation.designToCodeBindingMembershipDigest !== codeBinding.bindingSubjectCatalogDigest ||
        generation.routeSubjectCatalogDigest !== routeMapping.subjectCatalogDigest ||
        generation.routeRelationshipCatalogDigest !== routeMapping.relationshipCatalogDigest ||
        generation.previewAssessmentDigest !== preview.assessmentReceiptDigest || generation.stagingAssessmentDigest !== staging.assessmentReceiptDigest ||
        generation.modelSwitchAssessmentDigest !== modelSwitch.assessmentReceiptDigest ||
        generation.requirementBindingCount !== requirementBinding.bindings.length || generation.designToCodeBindingCount !== codeBinding.subjects.length ||
        generation.routeSubjectCount !== routeMapping.subjects.length || generation.routeRelationshipCount !== routeMapping.relationships.length ||
        generation.implementationUnitCount !== implementationUnits || generation.implementationUnitCount !== modelSwitch.unitCount ||
        generation.pathCount !== modelSwitch.pathCount) {
      throw new Error("Approved Figma Context Retrieval generation-context metadata must preserve exact design and implementation continuity")
    }
  }

  private composeDigests(input: ApprovedFigmaContextRetrievalInput) {
    const dependencyReceiptDigest = canonicalDigest(input.dependencies)
    const approvedSnapshotReceiptDigest = canonicalDigest(input.approvedSnapshot)
    const generationContextReceiptDigest = canonicalDigest(input.generationContext)
    const lifecycleReceiptDigest = canonicalDigest(input.lifecycle)
    const assessmentReceiptDigest = canonicalDigest({ dependencyReceiptDigest, approvedSnapshotReceiptDigest, generationContextReceiptDigest,
      lifecycleReceiptDigest, reviewState: input.reviewState, unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations,
      actualFigmaAccessState: input.actualFigmaAccessState, snapshotContentState: input.snapshotContentState,
      designApprovalState: input.designApprovalState, designBaselineState: input.designBaselineState,
      generationReadinessState: input.generationReadinessState, nativeHostAcceptanceState: input.nativeHostAcceptanceState,
      liveProviderAcceptanceState: input.liveProviderAcceptanceState, securityAcceptanceState: input.securityAcceptanceState,
      releaseReadinessState: input.releaseReadinessState, deploymentReadinessState: input.deploymentReadinessState,
      actionAuthorityState: input.actionAuthorityState })
    return { dependencyReceiptDigest, approvedSnapshotReceiptDigest, generationContextReceiptDigest, lifecycleReceiptDigest, assessmentReceiptDigest }
  }
  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id || canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) {
      throw new Error("Approved Figma Context Retrieval must bind exact current Product and Initiative revisions and digests")
    }
  }
  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return { productRevision: revisionOf(product), productDigest: canonicalDigest(product), initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) }
  }
  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Approved Figma Context Retrieval is immutable`)
    return { product, initiative }
  }
  private async commitVersionedRecord(record: ApprovedFigmaContextRetrieval, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({ writes: [
      this.governed(this.currentPath(record.id), record, approvedFigmaContextRetrievalSchema),
      this.governed(this.historyPath(record.id, record.revision), record, approvedFigmaContextRetrievalSchema),
    ], audit: { eventType, actor: { kind: "human", id: actorId }, subjectId: record.id, payload: {
      initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record), dependencies: record.dependencies,
      dependencyReceiptDigest: record.dependencyReceiptDigest, approvedSnapshotReceiptDigest: record.approvedSnapshotReceiptDigest,
      generationContextReceiptDigest: record.generationContextReceiptDigest, lifecycleReceiptDigest: record.lifecycleReceiptDigest,
      assessmentReceiptDigest: record.assessmentReceiptDigest, predecessorDigest: record.predecessorDigest,
      snapshotItemCount: record.approvedSnapshot.itemCount, includedItemCount: record.approvedSnapshot.includedItemCount,
      requirementBindingCount: record.generationContext.requirementBindingCount,
      designToCodeBindingCount: record.generationContext.designToCodeBindingCount,
      routeSubjectCount: record.generationContext.routeSubjectCount, implementationUnitCount: record.generationContext.implementationUnitCount,
      pathCount: record.generationContext.pathCount, lifecycle: record.lifecycle, reviewState: record.reviewState,
      actionAuthorityState: record.actionAuthorityState, authorityBoundary: record.authorityBoundary,
    } } })
  }
  private currentPath(id: string): string { return this.repository.resolve("approved-figma-context-retrievals", `${id}.json`) }
  private historyPath(id: string, revision: number): string { return this.repository.resolve("approved-figma-context-retrieval-history", `approved-figma-context-retrieval-${id}-r${revision}.json`) }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string { const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data }
  private async assertIntegrity(): Promise<void> { const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed") }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error }
    if (names.length > inventoryLimit) throw new Error(`Approved Figma Context Retrieval directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => `${String((left as Record<string, unknown>).id ?? "")}:${String((left as Record<string, unknown>).revision ?? "")}`.localeCompare(`${String((right as Record<string, unknown>).id ?? "")}:${String((right as Record<string, unknown>).revision ?? "")}`))
  }
}
