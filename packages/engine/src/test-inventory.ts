import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  testInventoryInputSchema,
  testInventoryProjectionSchema,
  testInventorySchema,
  testInventoryStatusSchema,
  type AcceptanceCriteria,
  type BusinessContextBinding,
  type ImplementationUnitModel,
  type Initiative,
  type Product,
  type RiskRegister,
  type RouteScreenComponentMapping,
  type TestInventory,
  type TestInventoryInput,
  type TestInventoryProjection,
  type TestInventoryStatus,
  type TestMethodology,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { z, type ZodType } from "zod"

import type { AcceptanceCriteriaService } from "./acceptance-criteria.js"
import type { ImplementationUnitModelService } from "./implementation-unit-model.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { RiskRegisterService } from "./risk-register.js"
import type { RouteScreenComponentMappingService } from "./route-screen-component-mapping.js"
import type { TestMethodologyService } from "./test-methodology.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type ExactReference = { recordId: string; revision: number; digest: string }

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "test-inventory-is-a-versioned-candidate-and-does-not-establish-requirement-acceptance-criteria-or-risk-truth-inventory-validity-or-completeness-test-asset-existence-environment-availability-privacy-or-security-approval-owner-appointment-test-execution-or-results-evidence-or-coverage-truth-quality-implementation-readiness-acceptance-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "test-inventory-status-is-observational-and-does-not-establish-requirement-acceptance-criteria-or-risk-truth-inventory-validity-or-completeness-test-asset-existence-environment-availability-privacy-or-security-approval-owner-appointment-test-execution-or-results-evidence-or-coverage-truth-quality-implementation-readiness-acceptance-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "test-inventory-projection-is-read-only-and-does-not-establish-requirement-acceptance-criteria-or-risk-truth-inventory-validity-or-completeness-test-asset-existence-environment-availability-privacy-or-security-approval-owner-appointment-test-execution-or-results-evidence-or-coverage-truth-quality-implementation-readiness-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-counts-statuses-and-test-catalog-coverage-trace-ownership-assessment-snapshot-digests-only-not-test-titles-paths-code-steps-data-owner-evidence-results-personal-data-secrets-credentials-or-machine-paths" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}
function sameReference(reference: ExactReference, record: { id: string; revision: number } | undefined): boolean {
  return !!record && reference.recordId === record.id && reference.revision === record.revision &&
    reference.digest === canonicalDigest(record)
}
interface ExactDependencies {
  acceptanceCriteria: AcceptanceCriteria
  riskRegister: RiskRegister
  implementationUnitModel: ImplementationUnitModel
  routeScreenComponentMapping: RouteScreenComponentMapping
  testMethodology: TestMethodology
}

interface InventoryAssessment {
  sourceCriterionCount: number
  sourceRiskCount: number
  sourceUnitCount: number
  sourceMappingSubjectCount: number
  sourceMethodologyScopeCount: number
  duplicateIdentityCount: number
  orphanAssetCount: number
  uncoveredCriterionCount: number
  uncoveredRiskCount: number
  uncoveredUnitCount: number
  uncoveredMappingSubjectCount: number
  uncoveredMethodologyScopeCount: number
  ownershipGapCount: number
  traceGapCount: number
  evidenceGapCount: number
}

export class TestInventoryService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly acceptanceCriteria: AcceptanceCriteriaService,
    private readonly riskRegister: RiskRegisterService,
    private readonly implementationUnitModel: ImplementationUnitModelService,
    private readonly routeScreenComponentMapping: RouteScreenComponentMappingService,
    private readonly testMethodology: TestMethodologyService,
  ) {}

  async create(inputValue: TestInventoryInput, actorId: string): Promise<TestInventory> {
    const input = testInventoryInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      const assessment = this.assessCandidate(input, dependencies)
      this.requireValidCandidate(input, assessment)
      if (await this.readCurrent(initiative.id)) throw new Error("An Initiative can have only one current Test Inventory candidate")
      const now = new Date().toISOString()
      const record = testInventorySchema.parse({
        schemaVersion: 1, kind: "test-inventory-candidate", id: randomUUID(), productId: product.id,
        ...input, initiativeId: initiative.id, revision: 1, ...this.composeDigests(input), state: "candidate",
        createdBy: { kind: "human", id: actorId }, updatedBy: { kind: "human", id: actorId },
        createdAt: now, updatedAt: now, authorityBoundary,
      })
      await this.commitVersionedRecord(record, assessment, "test-inventory.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: TestInventoryInput, actorId: string): Promise<TestInventory> {
    const input = testInventoryInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Test Inventory revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Test Inventory Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      const assessment = this.assessCandidate(input, dependencies)
      this.requireValidCandidate(input, assessment)
      const record = testInventorySchema.parse({
        ...current, ...input, productId: product.id, initiativeId: initiative.id,
        revision: current.revision + 1, ...this.composeDigests(input), predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId }, updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, assessment, "test-inventory.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<TestInventory> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Test Inventory ID")), testInventorySchema)
  }

  async readCurrent(initiativeId: string): Promise<TestInventory | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const matches = (await this.listRecords("test-inventories", currentRecordPattern, testInventorySchema))
      .filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Test Inventory candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<TestInventory> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Test Inventory history revision must be a positive integer")
    const recordId = this.requireUuid(id, "Test Inventory ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), testInventorySchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Test Inventory history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<TestInventory[]> {
    const recordId = this.requireUuid(id, "Test Inventory ID")
    const records = await this.listRecords(
      "test-inventory-history", new RegExp(`^test-inventory-${recordId}-r[1-9][0-9]*\\.json$`, "iu"), testInventorySchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Test Inventory history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<TestInventoryStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, ...records] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), ...this.readDependencies(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const dependencies = this.toDependencies(records)
    const dependencyNames: (keyof ExactDependencies)[] = [
      "acceptanceCriteria", "riskRegister", "implementationUnitModel", "routeScreenComponentMapping", "testMethodology",
    ]
    const staleBindingCount = candidate && canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative)) ? 1 : 0
    const staleDependencyCount = candidate ? dependencyNames.filter((name) => !sameReference(candidate[name], dependencies?.[name])).length : 0
    const assessment = candidate && dependencies ? this.assessCandidate(candidate, dependencies) : this.emptyAssessment(dependencies)
    let invalidCandidateCount = 0
    if (candidate) {
      const digests = this.composeDigests(candidate)
      if (candidate.catalogReceiptDigest !== digests.catalogReceiptDigest ||
          candidate.coverageReceiptDigest !== digests.coverageReceiptDigest ||
          candidate.traceReceiptDigest !== digests.traceReceiptDigest ||
          candidate.ownershipReceiptDigest !== digests.ownershipReceiptDigest ||
          candidate.assessmentReceiptDigest !== digests.assessmentReceiptDigest) invalidCandidateCount = 1
    }
    const assets = candidate?.assets ?? []
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Test Inventory candidate exists for this Initiative")
    if (staleBindingCount) reasons.push("The Test Inventory candidate does not bind the exact current Product and Initiative")
    if (staleDependencyCount) reasons.push(`The Test Inventory candidate has ${staleDependencyCount} stale or missing exact governed dependencies`)
    if (assessment.duplicateIdentityCount) reasons.push("The Test Inventory contains duplicate test identities or keys")
    if (assessment.orphanAssetCount) reasons.push("One or more test candidates have orphaned source traces")
    if (assessment.uncoveredCriterionCount) reasons.push("One or more Acceptance Criteria lack a test candidate trace")
    if (assessment.uncoveredRiskCount) reasons.push("One or more Risks lack a test candidate trace")
    if (assessment.uncoveredUnitCount) reasons.push("One or more Implementation Units lack a test candidate trace")
    if (assessment.uncoveredMappingSubjectCount) reasons.push("One or more route, screen, or component subjects lack a test candidate trace")
    if (assessment.uncoveredMethodologyScopeCount) reasons.push("One or more Test Methodology scopes lack a test candidate trace")
    if (assessment.ownershipGapCount) reasons.push("One or more test candidates lack an owner candidate")
    if (assessment.traceGapCount) reasons.push("One or more test candidates lack exact governed trace candidates")
    if (assessment.evidenceGapCount) reasons.push("One or more test candidates lack candidate evidence")
    if (assets.some((asset) => asset.disposition !== "candidate-cataloged")) reasons.push("One or more test candidates are conflicted, missing, deferred, or not assessed")
    if (invalidCandidateCount) reasons.push("The Test Inventory receipt digests are invalid")
    if (unresolvedQuestionCount) reasons.push("The candidate records unresolved Test Inventory questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return testInventoryStatusSchema.parse({
      schemaVersion: 1, kind: "test-inventory-status", productId: product.id,
      productRevision: revisionOf(product), initiativeId: initiative.id, initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate), ...Object.fromEntries(dependencyNames.map((name) => [name, candidate[name]])) } : {}),
      ...this.sourceCounts(assessment), assetCount: assets.length, ...this.assetCounts(assets),
      duplicateIdentityCount: assessment.duplicateIdentityCount, orphanAssetCount: assessment.orphanAssetCount,
      uncoveredCriterionCount: assessment.uncoveredCriterionCount, uncoveredRiskCount: assessment.uncoveredRiskCount,
      uncoveredUnitCount: assessment.uncoveredUnitCount, uncoveredMappingSubjectCount: assessment.uncoveredMappingSubjectCount,
      uncoveredMethodologyScopeCount: assessment.uncoveredMethodologyScopeCount,
      ownershipGapCount: assessment.ownershipGapCount, traceGapCount: assessment.traceGapCount,
      evidenceGapCount: assessment.evidenceGapCount, staleBindingCount, staleDependencyCount,
      invalidCandidateCount, unresolvedQuestionCount, reviewState,
      state: reasons.length === 0 ? "candidate-complete" : "attention-required", reasons,
      assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary,
    })
  }

  async project(initiativeId: string): Promise<TestInventoryProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Test Inventory projection context changed while governed records were read")
    }
    const counts = this.assetCounts(candidate?.assets ?? [])
    const projectionWithoutDigest = {
      schemaVersion: 1 as const, kind: "test-inventory-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        catalogReceiptDigest: candidate.catalogReceiptDigest, coverageReceiptDigest: candidate.coverageReceiptDigest,
        traceReceiptDigest: candidate.traceReceiptDigest, ownershipReceiptDigest: candidate.ownershipReceiptDigest,
        assessmentReceiptDigest: candidate.assessmentReceiptDigest, assetCount: candidate.assets.length,
        catalogedAssetCount: counts.catalogedAssetCount, conflictAssetCount: counts.conflictAssetCount,
        observedAssetCount: counts.observedAssetCount, plannedAssetCount: counts.plannedAssetCount,
        reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary,
    }
    return testInventoryProjectionSchema.parse({
      ...projectionWithoutDigest, snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("test-inventories", currentRecordPattern, testInventorySchema)
    for (const candidate of records) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Test Inventory candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.state === "attention-required") issues.push({
          code: "test-inventory.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has a stale, incomplete, invalid, or unresolved Test Inventory candidate.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "create-superseding-revision"],
        })
      } catch (error) {
        issues.push({
          code: "test-inventory.invalid", severity: "error",
          message: `Test Inventory ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private assessCandidate(input: TestInventoryInput, dependencies: ExactDependencies): InventoryAssessment {
    const criterionIds = new Set(dependencies.acceptanceCriteria.criteria.map((criterion) => criterion.id))
    const riskKeys = new Set(dependencies.riskRegister.risks.map((risk) => risk.key))
    const unitIds = new Set(dependencies.implementationUnitModel.units.map((unit) => unit.id))
    const mappingIds = new Set(dependencies.routeScreenComponentMapping.subjects.map((subject) => subject.id))
    const methodologyScopeIds = new Set(dependencies.testMethodology.scopes.map((scope) => scope.id))
    const coveredCriteria = new Set<string>()
    const coveredRisks = new Set<string>()
    const coveredUnits = new Set<string>()
    const coveredMappings = new Set<string>()
    const coveredScopes = new Set<string>()
    let orphanAssetCount = 0
    let traceGapCount = 0
    let ownershipGapCount = 0
    let evidenceGapCount = 0
    for (const asset of input.assets) {
      asset.acceptanceCriterionIds.forEach((id) => coveredCriteria.add(id))
      asset.riskKeys.forEach((key) => coveredRisks.add(key))
      asset.implementationUnitIds.forEach((id) => coveredUnits.add(id))
      asset.routeScreenComponentSubjectIds.forEach((id) => coveredMappings.add(id))
      asset.methodologyScopeIds.forEach((id) => coveredScopes.add(id))
      const orphaned = asset.acceptanceCriterionIds.some((id) => !criterionIds.has(id)) ||
        asset.riskKeys.some((key) => !riskKeys.has(key)) || asset.implementationUnitIds.some((id) => !unitIds.has(id)) ||
        asset.routeScreenComponentSubjectIds.some((id) => !mappingIds.has(id)) ||
        asset.methodologyScopeIds.some((id) => !methodologyScopeIds.has(id))
      if (orphaned) orphanAssetCount += 1
      if (orphaned || asset.requirementKeys.length === 0 || asset.acceptanceCriterionIds.length === 0 ||
          asset.riskKeys.length === 0 || asset.implementationUnitIds.length === 0 || asset.methodologyScopeIds.length === 0) traceGapCount += 1
      if (asset.ownerCandidateIds.length === 0) ownershipGapCount += 1
      if (asset.evidenceReferences.length === 0) evidenceGapCount += 1
    }
    return {
      sourceCriterionCount: criterionIds.size, sourceRiskCount: riskKeys.size, sourceUnitCount: unitIds.size,
      sourceMappingSubjectCount: mappingIds.size, sourceMethodologyScopeCount: methodologyScopeIds.size,
      duplicateIdentityCount: input.assets.length - new Set(input.assets.map((asset) => `${asset.id}:${asset.key}`)).size,
      orphanAssetCount, uncoveredCriterionCount: [...criterionIds].filter((id) => !coveredCriteria.has(id)).length,
      uncoveredRiskCount: [...riskKeys].filter((key) => !coveredRisks.has(key)).length,
      uncoveredUnitCount: [...unitIds].filter((id) => !coveredUnits.has(id)).length,
      uncoveredMappingSubjectCount: [...mappingIds].filter((id) => !coveredMappings.has(id)).length,
      uncoveredMethodologyScopeCount: [...methodologyScopeIds].filter((id) => !coveredScopes.has(id)).length,
      ownershipGapCount, traceGapCount, evidenceGapCount,
    }
  }

  private requireValidCandidate(input: TestInventoryInput, assessment: InventoryAssessment): void {
    const incompleteAssets = input.assets.filter((asset) => asset.disposition !== "candidate-cataloged").length
    const gaps = assessment.duplicateIdentityCount + assessment.orphanAssetCount + assessment.uncoveredCriterionCount +
      assessment.uncoveredRiskCount + assessment.uncoveredUnitCount + assessment.uncoveredMappingSubjectCount +
      assessment.uncoveredMethodologyScopeCount + assessment.ownershipGapCount + assessment.traceGapCount +
      assessment.evidenceGapCount + incompleteAssets
    if (input.reviewState === "ready-for-human-review" && gaps > 0) {
      throw new Error("Review-ready Test Inventory requires exact complete Acceptance Criteria, Risk, Implementation Unit, route-screen-component, Test Methodology scope, ownership, and evidence trace candidates")
    }
  }

  private emptyAssessment(dependencies: ExactDependencies | undefined): InventoryAssessment {
    return {
      sourceCriterionCount: dependencies?.acceptanceCriteria.criteria.length ?? 0,
      sourceRiskCount: dependencies?.riskRegister.risks.length ?? 0,
      sourceUnitCount: dependencies?.implementationUnitModel.units.length ?? 0,
      sourceMappingSubjectCount: dependencies?.routeScreenComponentMapping.subjects.length ?? 0,
      sourceMethodologyScopeCount: dependencies?.testMethodology.scopes.length ?? 0,
      duplicateIdentityCount: 0, orphanAssetCount: 0, uncoveredCriterionCount: 0, uncoveredRiskCount: 0,
      uncoveredUnitCount: 0, uncoveredMappingSubjectCount: 0, uncoveredMethodologyScopeCount: 0,
      ownershipGapCount: 0, traceGapCount: 0, evidenceGapCount: 0,
    }
  }

  private sourceCounts(assessment: InventoryAssessment) {
    return { sourceCriterionCount: assessment.sourceCriterionCount, sourceRiskCount: assessment.sourceRiskCount,
      sourceUnitCount: assessment.sourceUnitCount, sourceMappingSubjectCount: assessment.sourceMappingSubjectCount,
      sourceMethodologyScopeCount: assessment.sourceMethodologyScopeCount }
  }

  private assetCounts(assets: TestInventoryInput["assets"]) {
    return {
      catalogedAssetCount: assets.filter((asset) => asset.disposition === "candidate-cataloged").length,
      conflictAssetCount: assets.filter((asset) => asset.disposition === "candidate-conflict").length,
      missingAssetCount: assets.filter((asset) => asset.disposition === "candidate-missing").length,
      deferredAssetCount: assets.filter((asset) => asset.disposition === "deferred").length,
      notAssessedAssetCount: assets.filter((asset) => asset.disposition === "not-assessed").length,
      observedAssetCount: assets.filter((asset) => asset.existenceState === "candidate-observed").length,
      plannedAssetCount: assets.filter((asset) => asset.existenceState === "candidate-planned").length,
      automatedAssetCount: assets.filter((asset) => asset.automationState === "automated-candidate").length,
      manualAssetCount: assets.filter((asset) => asset.automationState === "manual-candidate").length,
    }
  }

  private composeDigests(input: TestInventoryInput) {
    const catalogReceiptDigest = canonicalDigest(input.assets.map((asset) => ({
      id: asset.id, ordinal: asset.ordinal, key: asset.key, kind: asset.kind, disposition: asset.disposition,
      existenceState: asset.existenceState, automationState: asset.automationState,
      catalogedBy: asset.catalogedBy, catalogedAt: asset.catalogedAt,
    })))
    const coverageReceiptDigest = canonicalDigest(input.assets.map((asset) => ({
      id: asset.id, acceptanceCriterionIds: asset.acceptanceCriterionIds, riskKeys: asset.riskKeys,
      implementationUnitIds: asset.implementationUnitIds, routeScreenComponentSubjectIds: asset.routeScreenComponentSubjectIds,
      methodologyScopeIds: asset.methodologyScopeIds,
    })))
    const traceReceiptDigest = canonicalDigest({
      dependencies: { acceptanceCriteria: input.acceptanceCriteria, riskRegister: input.riskRegister,
        implementationUnitModel: input.implementationUnitModel,
        routeScreenComponentMapping: input.routeScreenComponentMapping, testMethodology: input.testMethodology },
      assets: input.assets.map((asset) => ({ id: asset.id, requirementKeys: asset.requirementKeys,
        environmentIds: asset.environmentIds, platformKeys: asset.platformKeys,
        evidenceExpectationIds: asset.evidenceExpectationIds, evidenceReferences: asset.evidenceReferences,
        conflictReferenceCandidates: asset.conflictReferenceCandidates })),
    })
    const ownershipReceiptDigest = canonicalDigest(input.assets.map((asset) => ({
      assetId: asset.id, ownerCandidateIds: asset.ownerCandidateIds,
      ownershipAuthorityState: asset.ownershipAuthorityState,
    })))
    const assessmentReceiptDigest = canonicalDigest({
      context: input.context, informationClassification: input.informationClassification,
      catalogReceiptDigest, coverageReceiptDigest, traceReceiptDigest, ownershipReceiptDigest,
      alternativesConsidered: input.alternativesConsidered, unresolvedQuestions: input.unresolvedQuestions,
      limitations: input.limitations, reviewState: input.reviewState, requirementTruthState: input.requirementTruthState,
      acceptanceCriteriaValidityState: input.acceptanceCriteriaValidityState, riskTruthState: input.riskTruthState,
      inventoryTruthState: input.inventoryTruthState, inventoryCompletenessState: input.inventoryCompletenessState,
      testAssetExistenceTruthState: input.testAssetExistenceTruthState,
      environmentAvailabilityState: input.environmentAvailabilityState, privacyApprovalState: input.privacyApprovalState,
      securityApprovalState: input.securityApprovalState, ownershipAppointmentState: input.ownershipAppointmentState,
      testExecutionState: input.testExecutionState, testResultState: input.testResultState,
      evidenceTruthState: input.evidenceTruthState, coverageTruthState: input.coverageTruthState,
      qualityState: input.qualityState, implementationReadinessState: input.implementationReadinessState,
      acceptanceDecisionState: input.acceptanceDecisionState, releaseReadinessState: input.releaseReadinessState,
      deploymentReadinessState: input.deploymentReadinessState, actionAuthorityState: input.actionAuthorityState,
    })
    return { catalogReceiptDigest, coverageReceiptDigest, traceReceiptDigest, ownershipReceiptDigest, assessmentReceiptDigest }
  }

  private readDependencies(initiativeId: string): Promise<unknown>[] {
    return [this.acceptanceCriteria.readCurrent(initiativeId), this.riskRegister.readCurrent(initiativeId),
      this.implementationUnitModel.readCurrent(initiativeId), this.routeScreenComponentMapping.readCurrent(initiativeId),
      this.testMethodology.readCurrent(initiativeId)]
  }

  private toDependencies(records: unknown[]): ExactDependencies | undefined {
    if (records.some((record) => !record)) return undefined
    const [acceptanceCriteria, riskRegister, implementationUnitModel, routeScreenComponentMapping, testMethodology] = records
    return { acceptanceCriteria, riskRegister, implementationUnitModel, routeScreenComponentMapping,
      testMethodology } as ExactDependencies
  }

  private async requireExactDependencies(input: TestInventoryInput): Promise<ExactDependencies> {
    const dependencies = this.toDependencies(await Promise.all(this.readDependencies(input.initiativeId)))
    if (!dependencies) throw new Error("Test Inventory requires all 5 current governed dependencies")
    const names: (keyof ExactDependencies)[] = [
      "acceptanceCriteria", "riskRegister", "implementationUnitModel", "routeScreenComponentMapping", "testMethodology",
    ]
    for (const name of names) {
      if (!sameReference(input[name], dependencies[name])) throw new Error(`Test Inventory must reference the exact current ${name} candidate`)
    }
    return dependencies
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Test Inventory Initiative targets a different Product")
    if (canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) {
      throw new Error("Test Inventory must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return { productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Test Inventory is immutable`)
    return { product, initiative }
  }

  private async commitVersionedRecord(record: TestInventory, assessment: InventoryAssessment, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [this.governed(this.currentPath(record.id), record, testInventorySchema),
        this.governed(this.historyPath(record.id, record.revision), record, testInventorySchema)],
      audit: {
        eventType, actor: { kind: "human", id: actorId }, subjectId: record.id,
        payload: {
          initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record),
          catalogReceiptDigest: record.catalogReceiptDigest, coverageReceiptDigest: record.coverageReceiptDigest,
          traceReceiptDigest: record.traceReceiptDigest, ownershipReceiptDigest: record.ownershipReceiptDigest,
          assessmentReceiptDigest: record.assessmentReceiptDigest, predecessorDigest: record.predecessorDigest,
          acceptanceCriteria: record.acceptanceCriteria, riskRegister: record.riskRegister,
          implementationUnitModel: record.implementationUnitModel,
          routeScreenComponentMapping: record.routeScreenComponentMapping, testMethodology: record.testMethodology,
          ...this.sourceCounts(assessment), assetCount: record.assets.length, ...this.assetCounts(record.assets),
          duplicateIdentityCount: assessment.duplicateIdentityCount, orphanAssetCount: assessment.orphanAssetCount,
          uncoveredCriterionCount: assessment.uncoveredCriterionCount, uncoveredRiskCount: assessment.uncoveredRiskCount,
          uncoveredUnitCount: assessment.uncoveredUnitCount,
          uncoveredMappingSubjectCount: assessment.uncoveredMappingSubjectCount,
          uncoveredMethodologyScopeCount: assessment.uncoveredMethodologyScopeCount,
          ownershipGapCount: assessment.ownershipGapCount, traceGapCount: assessment.traceGapCount,
          evidenceGapCount: assessment.evidenceGapCount, reviewState: record.reviewState,
          requirementTruthState: record.requirementTruthState,
          acceptanceCriteriaValidityState: record.acceptanceCriteriaValidityState, riskTruthState: record.riskTruthState,
          inventoryTruthState: record.inventoryTruthState, inventoryCompletenessState: record.inventoryCompletenessState,
          testAssetExistenceTruthState: record.testAssetExistenceTruthState,
          environmentAvailabilityState: record.environmentAvailabilityState, privacyApprovalState: record.privacyApprovalState,
          securityApprovalState: record.securityApprovalState, ownershipAppointmentState: record.ownershipAppointmentState,
          testExecutionState: record.testExecutionState, testResultState: record.testResultState,
          evidenceTruthState: record.evidenceTruthState, coverageTruthState: record.coverageTruthState,
          qualityState: record.qualityState, implementationReadinessState: record.implementationReadinessState,
          acceptanceDecisionState: record.acceptanceDecisionState, releaseReadinessState: record.releaseReadinessState,
          deploymentReadinessState: record.deploymentReadinessState,
          actionAuthorityState: record.actionAuthorityState, authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string { return this.repository.resolve("test-inventories", `${id}.json`) }
  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("test-inventory-history", `test-inventory-${id}-r${revision}.json`)
  }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string {
    const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data
  }
  private async assertIntegrity(): Promise<void> {
    const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed")
  }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error }
    if (names.length > inventoryLimit) throw new Error(`Test Inventory directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>; const rightRecord = right as Record<string, unknown>
      return `${String(leftRecord.id ?? "")}:${String(leftRecord.revision ?? "")}`.localeCompare(`${String(rightRecord.id ?? "")}:${String(rightRecord.revision ?? "")}`)
    })
  }
}
