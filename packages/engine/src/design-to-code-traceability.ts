import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  designToCodeTraceabilityInputSchema,
  designToCodeTraceabilityProjectionSchema,
  designToCodeTraceabilitySchema,
  designToCodeTraceabilityStatusSchema,
  type AcceptanceCriteria,
  type ApprovedFigmaContextRetrieval,
  type BacklogHierarchy,
  type BusinessContextBinding,
  type ControlledDesignToCodeGeneration,
  type DesignBaseline,
  type DesignToCodeBindingRegistry,
  type DesignToCodeTraceability,
  type DesignToCodeTraceabilityInput,
  type DesignToCodeTraceabilityProjection,
  type DesignToCodeTraceabilityStatus,
  type DesignToRequirementBinding,
  type FigmaToBoilerplateMapping,
  type ImplementationUnitModel,
  type Initiative,
  type Product,
  type ProposedChangePreview,
  type RouteScreenComponentMapping,
  type TestInventory,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type CurrentReader<T> = { readCurrent(initiativeId: string): Promise<T | undefined> }
type ExactReference = { recordId: string; revision: number; digest: string }
interface Dependencies {
  controlledDesignToCodeGeneration: ControlledDesignToCodeGeneration
  approvedFigmaContextRetrieval: ApprovedFigmaContextRetrieval
  designBaseline: DesignBaseline
  designToRequirementBinding: DesignToRequirementBinding
  figmaToBoilerplateMapping: FigmaToBoilerplateMapping
  designToCodeBindingRegistry: DesignToCodeBindingRegistry
  routeScreenComponentMapping: RouteScreenComponentMapping
  backlogHierarchy: BacklogHierarchy
  acceptanceCriteria: AcceptanceCriteria
  implementationUnitModel: ImplementationUnitModel
  proposedChangePreview: ProposedChangePreview
  testInventory: TestInventory
}

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "design-to-code-traceability-is-a-versioned-portable-metadata-candidate-and-does-not-access-figma-or-protected-design-content-establish-design-requirement-backlog-acceptance-implementation-repository-path-symbol-generated-output-test-result-trace-completeness-approval-acceptance-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "design-to-code-traceability-status-is-observational-and-grants-no-design-source-repository-symbol-output-test-approval-acceptance-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "design-to-code-traceability-projection-is-read-only-and-grants-no-design-source-repository-symbol-output-test-approval-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-bounded-identities-versions-repository-relative-candidate-locations-test-keys-states-and-digests-only-not-design-or-source-content-generated-output-test-results-machine-paths-personal-data-secrets-credentials-or-permissions" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}
function sameReference(reference: ExactReference | undefined, record: { id: string; revision?: number } | undefined): boolean {
  return Boolean(reference && record && reference.recordId === record.id && reference.revision === revisionOf(record) && reference.digest === canonicalDigest(record))
}
function sameValues(left: readonly unknown[], right: readonly unknown[]): boolean { return canonicalDigest(left) === canonicalDigest(right) }

export class DesignToCodeTraceabilityService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly readers: { [K in keyof Dependencies]: CurrentReader<Dependencies[K]> },
  ) {}

  async create(inputValue: DesignToCodeTraceabilityInput, actorId: string): Promise<DesignToCodeTraceability> {
    const input = designToCodeTraceabilityInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      if (await this.readCurrent(input.initiativeId)) throw new Error("A current Design-to-Code Traceability candidate already exists; create a revision")
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies, product, initiative)
      const now = new Date().toISOString(), digests = this.composeDigests(input, dependencies)
      const record = designToCodeTraceabilitySchema.parse({
        schemaVersion: 1, kind: "design-to-code-traceability-candidate", id: randomUUID(), productId: product.id,
        ...input, revision: 1, ...digests, state: "candidate", createdBy: { kind: "human", id: actorId },
        updatedBy: { kind: "human", id: actorId }, createdAt: now, updatedAt: now, authorityBoundary,
      })
      await this.commitVersionedRecord(record, "design-to-code-traceability.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: DesignToCodeTraceabilityInput, actorId: string): Promise<DesignToCodeTraceability> {
    const input = designToCodeTraceabilityInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Design-to-Code Traceability revision conflict")
      if (current.initiativeId !== input.initiativeId) throw new Error("Design-to-Code Traceability Initiative binding is immutable")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies, product, initiative)
      const now = new Date().toISOString(), digests = this.composeDigests(input, dependencies)
      const record = designToCodeTraceabilitySchema.parse({
        ...current, ...input, revision: current.revision + 1, ...digests, predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId }, updatedAt: now,
      })
      await this.commitVersionedRecord(record, "design-to-code-traceability.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<DesignToCodeTraceability> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Design-to-Code Traceability ID")), designToCodeTraceabilitySchema)
  }
  async readCurrent(initiativeId: string): Promise<DesignToCodeTraceability | undefined> {
    const target = this.requireUuid(initiativeId, "Initiative ID")
    const matches = (await this.listRecords("design-to-code-traceability", currentRecordPattern, designToCodeTraceabilitySchema))
      .filter((record) => record.initiativeId === target)
    if (matches.length > 1) throw new Error("Multiple current Design-to-Code Traceability candidates target one Initiative")
    return matches[0]
  }
  async readRevision(id: string, revision: number): Promise<DesignToCodeTraceability> {
    const recordId = this.requireUuid(id, "Design-to-Code Traceability ID")
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Revision must be a positive integer")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), designToCodeTraceabilitySchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Design-to-Code Traceability history binding mismatch")
    return record
  }
  async listHistory(id: string): Promise<DesignToCodeTraceability[]> {
    const recordId = this.requireUuid(id, "Design-to-Code Traceability ID")
    const pattern = new RegExp(`^design-to-code-traceability-${recordId}-r[1-9][0-9]*\\.json$`, "i")
    const records = await this.listRecords("design-to-code-traceability-history", pattern, designToCodeTraceabilitySchema)
    return records.sort((left, right) => right.revision - left.revision)
  }

  async assess(initiativeId: string): Promise<DesignToCodeTraceabilityStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, dependencies] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), this.readDependencies(targetId),
    ])
    const reasons: string[] = []
    let staleBindingCount = 0, coverageGapCount = 0, evidenceGapCount = 0, invalidCandidateCount = 0
    if (!candidate) reasons.push("No current Design-to-Code Traceability candidate is recorded")
    if (Object.values(dependencies).some((value) => !value)) reasons.push("One or more required trace predecessor candidates are unavailable")
    if (candidate) {
      for (const key of Object.keys(dependencies) as (keyof Dependencies)[]) {
        if (!sameReference(candidate.dependencies[key], dependencies[key])) staleBindingCount += 1
      }
      const expectedTargetCount = dependencies.controlledDesignToCodeGeneration?.targets.length ?? 0
      if (candidate.traces.length !== expectedTargetCount) coverageGapCount += Math.abs(candidate.traces.length - expectedTargetCount) || 1
      evidenceGapCount = candidate.traces.filter((trace) => trace.evidenceReferences.length === 0).length
      try {
        if (this.completeDependencies(dependencies)) this.validateCandidate(candidate, dependencies, product, initiative)
      } catch { invalidCandidateCount += 1 }
    }
    const linkedCount = candidate?.traces.filter((trace) => trace.traceState === "candidate-linked").length ?? 0
    const gapCount = candidate?.traces.filter((trace) => trace.traceState === "gap" || trace.traceState === "not-assessed").length ?? 0
    const conflictCount = candidate?.traces.filter((trace) => trace.traceState === "conflict").length ?? 0
    const staleTraceCount = candidate?.traces.filter((trace) => trace.traceState === "stale").length ?? 0
    if (staleBindingCount) reasons.push("One or more exact predecessor bindings are stale")
    if (coverageGapCount) reasons.push("The controlled generation target catalog is not covered one-for-one")
    if (gapCount) reasons.push("One or more trace subjects have a gap or are not assessed")
    if (conflictCount) reasons.push("One or more trace subjects record a conflict")
    if (staleTraceCount) reasons.push("One or more trace subjects are stale")
    if (evidenceGapCount) reasons.push("One or more trace subjects lack attributable evidence")
    if (invalidCandidateCount) reasons.push("The trace continuity or deterministic receipts are invalid")
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    if (unresolvedQuestionCount) reasons.push("The candidate records unresolved questions")
    const reviewState = candidate?.reviewState ?? "draft"
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    const blocking = staleBindingCount + coverageGapCount + gapCount + conflictCount + staleTraceCount + evidenceGapCount + invalidCandidateCount + unresolvedQuestionCount
    const requirements = new Set(candidate?.traces.flatMap((trace) => trace.requirementKeys) ?? [])
    const backlogNodes = new Set(candidate?.traces.flatMap((trace) => trace.backlogNodeIds) ?? [])
    const criteria = new Set(candidate?.traces.flatMap((trace) => trace.acceptanceCriterionIds) ?? [])
    const units = new Set(candidate?.traces.map((trace) => trace.implementationUnitId) ?? [])
    const tests = new Set(candidate?.traces.flatMap((trace) => trace.associatedTestAssetIds) ?? [])
    return designToCodeTraceabilityStatusSchema.parse({
      schemaVersion: 1, kind: "design-to-code-traceability-status", productId: product.id, productRevision: revisionOf(product),
      initiativeId: initiative.id, initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate), dependencies: candidate.dependencies } : {}),
      traceCount: candidate?.traces.length ?? 0, generationTargetCount: dependencies.controlledDesignToCodeGeneration?.targets.length ?? 0,
      requirementCount: requirements.size, backlogNodeCount: backlogNodes.size, acceptanceCriterionCount: criteria.size,
      implementationUnitCount: units.size, codePathCount: candidate?.traces.length ?? 0, associatedTestCount: tests.size,
      linkedCount, gapCount, conflictCount, staleTraceCount, staleBindingCount, coverageGapCount, evidenceGapCount,
      invalidCandidateCount, unresolvedQuestionCount, reviewState,
      state: candidate && this.completeDependencies(dependencies) && blocking === 0 && reviewState === "ready-for-human-review" ? "candidate-defined" : "attention-required",
      reasons, assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary,
    })
  }

  async project(initiativeId: string): Promise<DesignToCodeTraceabilityProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    const withoutDigest = {
      schemaVersion: 1 as const, kind: "design-to-code-traceability-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state }, status,
      ...(candidate ? { candidate: {
        id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        approvedExternalVersionDigest: candidate.traces[0]!.approvedExternalVersionDigest,
        baselineSemanticVersion: candidate.traces[0]!.baselineSemanticVersion,
        traces: candidate.traces.map((trace) => ({
          id: trace.id, traceKey: trace.traceKey, generationTargetId: trace.generationTargetId,
          generationTargetKey: trace.generationTargetKey, designItemKey: trace.designItemKey,
          approvedExternalVersionDigest: trace.approvedExternalVersionDigest, baselineSemanticVersion: trace.baselineSemanticVersion,
          requirementKeys: trace.requirementKeys, backlogNodeKeys: trace.backlogNodeKeys,
          acceptanceCriterionKeys: trace.acceptanceCriterionKeys, implementationUnitId: trace.implementationUnitId,
          repositoryCandidate: trace.repositoryCandidate, moduleCandidate: trace.moduleCandidate, pathCandidate: trace.pathCandidate,
          ...(trace.symbolCandidate ? { symbolCandidate: trace.symbolCandidate } : {}),
          associatedTestAssetKeys: trace.associatedTestAssetKeys, traceState: trace.traceState,
          evidenceReferenceCount: trace.evidenceReferences.length,
        })),
        dependencyReceiptDigest: candidate.dependencyReceiptDigest, designVersionReceiptDigest: candidate.designVersionReceiptDigest,
        traceCatalogDigest: candidate.traceCatalogDigest, coverageReceiptDigest: candidate.coverageReceiptDigest,
        evidenceReceiptDigest: candidate.evidenceReceiptDigest, assessmentReceiptDigest: candidate.assessmentReceiptDigest,
        reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary,
    }
    return designToCodeTraceabilityProjectionSchema.parse({ ...withoutDigest, snapshotDigest: canonicalDigest(withoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    for (const candidate of await this.listRecords("design-to-code-traceability", currentRecordPattern, designToCodeTraceabilitySchema)) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) throw new Error("Current candidate does not match immutable history")
        if ((await this.assess(candidate.initiativeId)).state === "attention-required") issues.push({
          code: "design-to-code-traceability.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has a stale, incomplete, conflicting, or unresolved Design-to-Code Traceability candidate.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "create-superseding-revision"],
        })
      } catch (error) {
        issues.push({ code: "design-to-code-traceability.invalid", severity: "error",
          message: `Design-to-Code Traceability ${candidate.id}: ${error instanceof Error ? error.message : "validation failed"}`,
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
  private async requireExactDependencies(input: DesignToCodeTraceabilityInput): Promise<Dependencies> {
    const dependencies = await this.readDependencies(input.initiativeId)
    for (const key of Object.keys(dependencies) as (keyof Dependencies)[]) {
      if (!sameReference(input.dependencies[key], dependencies[key])) throw new Error(`Design-to-Code Traceability must reference the exact current ${key}`)
    }
    if (!this.completeDependencies(dependencies)) throw new Error("Design-to-Code Traceability dependencies are incomplete")
    return dependencies
  }

  private validateCandidate(input: DesignToCodeTraceabilityInput, dependencies: Dependencies, product: Product, initiative: Initiative): void {
    for (const dependency of Object.values(dependencies)) {
      if (dependency.productId !== product.id || dependency.initiativeId !== initiative.id || canonicalDigest(dependency.context) !== canonicalDigest(input.context)) {
        throw new Error("Design-to-Code Traceability dependencies must bind the exact current Product, Initiative, and context")
      }
    }
    const { controlledDesignToCodeGeneration: generation, approvedFigmaContextRetrieval: approved,
      designBaseline: baseline, designToRequirementBinding: requirementBinding, figmaToBoilerplateMapping: figmaMapping,
      designToCodeBindingRegistry: codeBinding, routeScreenComponentMapping: routeMapping, backlogHierarchy: backlog,
      acceptanceCriteria: criteria, implementationUnitModel: units, proposedChangePreview: preview, testInventory: tests } = dependencies
    if (!sameReference(generation.dependencies.approvedFigmaContextRetrieval, approved) ||
        !sameReference(generation.dependencies.designBaseline, baseline) ||
        !sameReference(generation.dependencies.designToRequirementBinding, requirementBinding) ||
        !sameReference(generation.dependencies.figmaToBoilerplateMapping, figmaMapping) ||
        !sameReference(generation.dependencies.designToCodeBindingRegistry, codeBinding) ||
        !sameReference(generation.dependencies.routeScreenComponentMapping, routeMapping) ||
        !sameReference(generation.dependencies.implementationUnitModel, units) ||
        !sameReference(generation.dependencies.proposedChangePreview, preview) ||
        !sameReference(approved.dependencies.designBaseline, baseline) ||
        !sameReference(approved.dependencies.designToRequirementBinding, requirementBinding) ||
        !sameReference(approved.dependencies.designToCodeBindingRegistry, codeBinding) ||
        !sameReference(approved.dependencies.routeScreenComponentMapping, routeMapping) ||
        !sameReference(codeBinding.figmaToBoilerplateMapping, figmaMapping) ||
        !sameReference(codeBinding.implementationUnitModel, units) ||
        !sameReference(routeMapping.acceptanceCriteria, criteria) ||
        !sameReference(routeMapping.implementationUnitModel, units) ||
        !sameReference(criteria.hierarchy, backlog) ||
        !sameReference(units.hierarchy, backlog) || !sameReference(units.acceptanceCriteria, criteria) ||
        !sameReference(tests.acceptanceCriteria, criteria) || !sameReference(tests.implementationUnitModel, units) ||
        !sameReference(tests.routeScreenComponentMapping, routeMapping)) {
      throw new Error("Design-to-Code Traceability predecessor continuity is stale")
    }
    if (input.traces.length !== generation.targets.length) throw new Error("Design-to-Code Traceability requires one trace per controlled generation target")
    for (const trace of input.traces) {
      const target = generation.targets.find((entry) => entry.id === trace.generationTargetId)
      const binding = codeBinding.subjects.find((entry) => entry.id === trace.designToCodeBindingSubjectId)
      const designBinding = requirementBinding.bindings.find((entry) => entry.key === trace.designBindingKey)
      const mapping = binding ? figmaMapping.subjects.find((entry) => entry.id === binding.mappingSubjectId) : undefined
      const unit = units.units.find((entry) => entry.id === trace.implementationUnitId)
      const previewUnit = preview.previewUnits.find((entry) => entry.implementationUnitId === trace.implementationUnitId)
      const previewPath = previewUnit?.pathPreviews.find((entry) => entry.pathCandidate === trace.pathCandidate)
      const backlogNodes = trace.backlogNodeIds.map((id) => backlog.nodes.find((entry) => entry.id === id))
      const acceptanceCriteria = trace.acceptanceCriterionIds.map((id) => criteria.criteria.find((entry) => entry.id === id))
      const testAssets = trace.associatedTestAssetIds.map((id) => tests.assets.find((entry) => entry.id === id))
      if (!target || !binding || !designBinding || !mapping || !unit || !previewUnit || !previewPath ||
          backlogNodes.some((entry) => !entry) || acceptanceCriteria.some((entry) => !entry) || testAssets.some((entry) => !entry)) {
        throw new Error("Design-to-Code Traceability contains a missing target, design, backlog, code, preview, or test subject")
      }
      if (target.targetKey !== trace.generationTargetKey || target.designToCodeBindingSubjectId !== binding.id ||
          target.implementationUnitId !== trace.implementationUnitId || target.repositoryCandidate !== trace.repositoryCandidate ||
          target.moduleCandidate !== trace.moduleCandidate || target.pathCandidate !== trace.pathCandidate ||
          binding.designBindingKey !== trace.designBindingKey || binding.designItemKey !== trace.designItemKey ||
          binding.designItemKind !== trace.designItemKind || binding.symbolCandidate !== trace.symbolCandidate ||
          mapping.designBindingKey !== trace.designBindingKey || mapping.designItemKey !== trace.designItemKey ||
          designBinding.designItemKey !== trace.designItemKey || designBinding.designItemKind !== trace.designItemKind ||
          trace.approvedExternalVersionDigest !== approved.approvedSnapshot.returnedExternalVersionDigest ||
          trace.baselineSemanticVersion !== baseline.semanticVersion || !sameValues(trace.requirementKeys, binding.requirementKeys) ||
          !sameValues(trace.requirementKeys, designBinding.requirementKeys) || !sameValues(trace.expectedTestOutputs, target.expectedTestOutputs)) {
        throw new Error("Design-to-Code Traceability does not preserve exact approved design, generation target, code, or requirement continuity")
      }
      const exactBacklogNodes = backlogNodes as NonNullable<(typeof backlogNodes)[number]>[]
      const exactCriteria = acceptanceCriteria as NonNullable<(typeof acceptanceCriteria)[number]>[]
      const exactTests = testAssets as NonNullable<(typeof testAssets)[number]>[]
      if (!sameValues(trace.backlogNodeKeys, exactBacklogNodes.map((entry) => entry.key).sort()) ||
          !trace.requirementKeys.every((key) => exactBacklogNodes.some((entry) => entry.requirements.some((reference) => reference.key === key))) ||
          !sameValues(trace.acceptanceCriterionKeys, exactCriteria.map((entry) => entry.key).sort()) ||
          !exactCriteria.every((entry) => trace.backlogNodeIds.includes(entry.subjectNodeId)) ||
          !trace.requirementKeys.every((key) => exactCriteria.some((entry) => entry.requirements.some((reference) => reference.key === key))) ||
          !sameValues(trace.associatedTestAssetKeys, exactTests.map((entry) => entry.key).sort()) ||
          !exactTests.every((entry) => entry.disposition === "candidate-cataloged" && entry.implementationUnitIds.includes(unit.id) &&
            trace.acceptanceCriterionIds.some((id) => entry.acceptanceCriterionIds.includes(id)) &&
            trace.requirementKeys.some((key) => entry.requirementKeys.includes(key)))) {
        throw new Error("Design-to-Code Traceability backlog, acceptance, implementation-unit, or test continuity is incomplete")
      }
    }
  }

  private composeDigests(input: DesignToCodeTraceabilityInput, dependencies: Dependencies) {
    const dependencyReceiptDigest = canonicalDigest(input.dependencies)
    const designVersionReceiptDigest = canonicalDigest({
      returnedExternalVersionDigest: dependencies.approvedFigmaContextRetrieval.approvedSnapshot.returnedExternalVersionDigest,
      baselineSemanticVersion: dependencies.designBaseline.semanticVersion,
      baselineMembershipDigest: dependencies.designBaseline.membershipDigest,
    })
    const traceCatalogDigest = canonicalDigest(input.traces)
    const coverageReceiptDigest = canonicalDigest(input.traces.map((trace) => ({
      generationTargetId: trace.generationTargetId, requirementKeys: trace.requirementKeys,
      backlogNodeIds: trace.backlogNodeIds, acceptanceCriterionIds: trace.acceptanceCriterionIds,
      implementationUnitId: trace.implementationUnitId, associatedTestAssetIds: trace.associatedTestAssetIds,
    })))
    const evidenceReceiptDigest = canonicalDigest(input.traces.map((trace) => ({ id: trace.id, evidenceReferences: trace.evidenceReferences,
      conflictReferenceCandidates: trace.conflictReferenceCandidates })))
    const assessmentReceiptDigest = canonicalDigest({ dependencyReceiptDigest, designVersionReceiptDigest, traceCatalogDigest,
      coverageReceiptDigest, evidenceReceiptDigest, reviewState: input.reviewState, unresolvedQuestions: input.unresolvedQuestions,
      limitations: input.limitations, traceCompletenessState: input.traceCompletenessState, approvalState: input.approvalState,
      acceptanceState: input.acceptanceState, nativeHostAcceptanceState: input.nativeHostAcceptanceState,
      liveProviderAcceptanceState: input.liveProviderAcceptanceState, securityAcceptanceState: input.securityAcceptanceState,
      releaseReadinessState: input.releaseReadinessState, deploymentReadinessState: input.deploymentReadinessState,
      actionAuthorityState: input.actionAuthorityState,
    })
    return { dependencyReceiptDigest, designVersionReceiptDigest, traceCatalogDigest, coverageReceiptDigest,
      evidenceReceiptDigest, assessmentReceiptDigest }
  }
  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id || canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) {
      throw new Error("Design-to-Code Traceability must bind exact current Product and Initiative revisions and digests")
    }
  }
  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return { productRevision: revisionOf(product), productDigest: canonicalDigest(product), initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) }
  }
  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Design-to-Code Traceability is immutable`)
    return { product, initiative }
  }
  private async commitVersionedRecord(record: DesignToCodeTraceability, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({ writes: [
      this.governed(this.currentPath(record.id), record, designToCodeTraceabilitySchema),
      this.governed(this.historyPath(record.id, record.revision), record, designToCodeTraceabilitySchema),
    ], audit: { eventType, actor: { kind: "human", id: actorId }, subjectId: record.id, payload: {
      initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record), dependencies: record.dependencies,
      traceCount: record.traces.length, linkedCount: record.traces.filter((trace) => trace.traceState === "candidate-linked").length,
      dependencyReceiptDigest: record.dependencyReceiptDigest, designVersionReceiptDigest: record.designVersionReceiptDigest,
      traceCatalogDigest: record.traceCatalogDigest, coverageReceiptDigest: record.coverageReceiptDigest,
      evidenceReceiptDigest: record.evidenceReceiptDigest, assessmentReceiptDigest: record.assessmentReceiptDigest,
      predecessorDigest: record.predecessorDigest, reviewState: record.reviewState, actionAuthorityState: record.actionAuthorityState,
      authorityBoundary: record.authorityBoundary,
    } } })
  }
  private currentPath(id: string): string { return this.repository.resolve("design-to-code-traceability", `${id}.json`) }
  private historyPath(id: string, revision: number): string { return this.repository.resolve("design-to-code-traceability-history", `design-to-code-traceability-${id}-r${revision}.json`) }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string { const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data }
  private async assertIntegrity(): Promise<void> { const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed") }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error }
    if (names.length > inventoryLimit) throw new Error(`Design-to-Code Traceability directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => `${String((left as Record<string, unknown>).id ?? "")}:${String((left as Record<string, unknown>).revision ?? "")}`.localeCompare(`${String((right as Record<string, unknown>).id ?? "")}:${String((right as Record<string, unknown>).revision ?? "")}`))
  }
}
