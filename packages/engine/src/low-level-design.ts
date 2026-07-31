import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  lowLevelDesignInputSchema,
  lowLevelDesignProjectionSchema,
  lowLevelDesignSchema,
  lowLevelDesignStatusSchema,
  type BoilerplateCompatibilityValidation,
  type BoilerplateRegistry,
  type BoilerplateSelectionBinding,
  type BoundedContextModel,
  type BusinessContextBinding,
  type DependencyMapping,
  type DesignBaseline,
  type DesignToCodeBindingRegistry,
  type HighLevelDesign,
  type LowLevelDesign,
  type LowLevelDesignInput,
  type LowLevelDesignProjection,
  type LowLevelDesignStatus,
  type ImplementationUnitModel,
  type Initiative,
  type Product,
  type RiskRegister,
  type RouteScreenComponentMapping,
  type SecurityPrivacyAssessment,
  type SystemSolutionArchitecture,
  type TechnologyProfile,
  type TestInventory,
  type TestMethodology,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type CurrentReader<T> = { readCurrent(initiativeId: string): Promise<T | undefined> }
type ExactReference = { recordId: string; revision: number; digest: string }

interface ExactDependencies {
  highLevelDesign: HighLevelDesign
  systemSolutionArchitecture: SystemSolutionArchitecture
  boundedContextModel: BoundedContextModel
  technologyProfile: TechnologyProfile
  dependencyMapping: DependencyMapping
  implementationUnitModel: ImplementationUnitModel
  boilerplateRegistry: BoilerplateRegistry
  boilerplateSelectionBinding: BoilerplateSelectionBinding
  boilerplateCompatibilityValidation: BoilerplateCompatibilityValidation
  designBaseline: DesignBaseline
  designToCodeBindingRegistry: DesignToCodeBindingRegistry
  routeScreenComponentMapping: RouteScreenComponentMapping
  testMethodology: TestMethodology
  testInventory: TestInventory
  riskRegister: RiskRegister
  securityPrivacyAssessment: SecurityPrivacyAssessment
}

interface DesignAssessment {
  orphanRelationCount: number
  traceGapCount: number
  evidenceGapCount: number
  ownershipGapCount: number
  uncoveredUnitCount: number
}

const dependencyNames: (keyof ExactDependencies)[] = [
  "highLevelDesign", "systemSolutionArchitecture", "boundedContextModel", "technologyProfile", "dependencyMapping",
  "implementationUnitModel", "boilerplateRegistry", "boilerplateSelectionBinding",
  "boilerplateCompatibilityValidation", "designBaseline", "designToCodeBindingRegistry",
  "routeScreenComponentMapping", "testMethodology", "testInventory", "riskRegister", "securityPrivacyAssessment",
]
const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "low-level-design-is-a-versioned-candidate-and-does-not-establish-design-repository-source-runtime-or-deployment-truth-or-completeness-design-baseline-or-approval-privacy-or-security-approval-owner-appointment-implementation-readiness-acceptance-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "low-level-design-status-is-observational-and-does-not-establish-design-repository-source-runtime-or-deployment-truth-or-completeness-design-baseline-or-approval-privacy-or-security-approval-owner-appointment-implementation-readiness-acceptance-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "low-level-design-projection-is-read-only-and-does-not-establish-design-repository-source-runtime-or-deployment-truth-or-completeness-design-baseline-or-approval-privacy-or-security-approval-owner-appointment-implementation-readiness-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-counts-statuses-and-structure-dependency-trace-coverage-ownership-assessment-snapshot-digests-only-not-design-narratives-modules-classes-components-interfaces-data-contracts-algorithms-state-error-recovery-authorization-observability-test-hooks-technologies-owners-evidence-source-content-personal-data-secrets-credentials-or-machine-paths" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}
function sameReference(reference: ExactReference | undefined, record: { id: string; revision?: number } | undefined): boolean {
  return Boolean(reference && record && reference.recordId === record.id && reference.revision === revisionOf(record) && reference.digest === canonicalDigest(record))
}

export class LowLevelDesignService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly highLevelDesign: CurrentReader<HighLevelDesign>,
    private readonly systemSolutionArchitecture: CurrentReader<SystemSolutionArchitecture>,
    private readonly boundedContextModel: CurrentReader<BoundedContextModel>,
    private readonly technologyProfile: CurrentReader<TechnologyProfile>,
    private readonly dependencyMapping: CurrentReader<DependencyMapping>,
    private readonly implementationUnitModel: CurrentReader<ImplementationUnitModel>,
    private readonly boilerplateRegistry: CurrentReader<BoilerplateRegistry>,
    private readonly boilerplateSelectionBinding: CurrentReader<BoilerplateSelectionBinding>,
    private readonly boilerplateCompatibilityValidation: CurrentReader<BoilerplateCompatibilityValidation>,
    private readonly designBaseline: CurrentReader<DesignBaseline>,
    private readonly designToCodeBindingRegistry: CurrentReader<DesignToCodeBindingRegistry>,
    private readonly routeScreenComponentMapping: CurrentReader<RouteScreenComponentMapping>,
    private readonly testMethodology: CurrentReader<TestMethodology>,
    private readonly testInventory: CurrentReader<TestInventory>,
    private readonly riskRegister: CurrentReader<RiskRegister>,
    private readonly securityPrivacyAssessment: CurrentReader<SecurityPrivacyAssessment>,
  ) {}

  async create(inputValue: LowLevelDesignInput, actorId: string): Promise<LowLevelDesign> {
    const input = lowLevelDesignInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      const assessment = this.assessCandidate(input, dependencies)
      this.requireValidCandidate(input, assessment)
      if (await this.readCurrent(initiative.id, input.implementationUnitId)) throw new Error("An Implementation Unit can have only one current Low-Level Design candidate")
      const now = new Date().toISOString()
      const record = lowLevelDesignSchema.parse({
        schemaVersion: 1, kind: "low-level-design-candidate", id: randomUUID(), productId: product.id,
        ...input, initiativeId: initiative.id, revision: 1, ...this.composeDigests(input), state: "candidate",
        createdBy: { kind: "human", id: actorId }, updatedBy: { kind: "human", id: actorId },
        createdAt: now, updatedAt: now, authorityBoundary,
      })
      await this.commitVersionedRecord(record, assessment, "low-level-design.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: LowLevelDesignInput, actorId: string): Promise<LowLevelDesign> {
    const input = lowLevelDesignInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Low-Level Design revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Low-Level Design Initiative cannot change")
      if (current.implementationUnitId !== input.implementationUnitId) throw new Error("Low-Level Design Implementation Unit cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      const assessment = this.assessCandidate(input, dependencies)
      this.requireValidCandidate(input, assessment)
      const record = lowLevelDesignSchema.parse({
        ...current, ...input, productId: product.id, initiativeId: initiative.id,
        revision: current.revision + 1, ...this.composeDigests(input), predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId }, updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, assessment, "low-level-design.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<LowLevelDesign> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Low-Level Design ID")), lowLevelDesignSchema)
  }

  async readCurrent(initiativeId: string, implementationUnitId: string): Promise<LowLevelDesign | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const targetUnitId = this.requireUuid(implementationUnitId, "Implementation Unit ID")
    const matches = (await this.listRecords("low-level-designs", currentRecordPattern, lowLevelDesignSchema))
      .filter((record) => record.initiativeId === targetId && record.implementationUnitId === targetUnitId)
    if (matches.length > 1) throw new Error("Implementation Unit has more than one current Low-Level Design candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<LowLevelDesign> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Low-Level Design history revision must be a positive integer")
    const recordId = this.requireUuid(id, "Low-Level Design ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), lowLevelDesignSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Low-Level Design history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<LowLevelDesign[]> {
    const recordId = this.requireUuid(id, "Low-Level Design ID")
    const records = await this.listRecords(
      "low-level-design-history", new RegExp(`^low-level-design-${recordId}-r[1-9][0-9]*\\.json$`, "iu"), lowLevelDesignSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Low-Level Design history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string, implementationUnitId: string): Promise<LowLevelDesignStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const targetUnitId = this.requireUuid(implementationUnitId, "Implementation Unit ID")
    const [product, initiative, candidate, ...records] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId, targetUnitId), ...this.readDependencies(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const dependencies = this.toDependencies(records)
    const presentDependencyCount = records.filter(Boolean).length
    const staleBindingCount = candidate && canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative)) ? 1 : 0
    const staleDependencyCount = candidate ? dependencyNames.filter((name) => !sameReference(candidate[name], dependencies?.[name])).length : 0
    const assessment = candidate && dependencies ? this.assessCandidate(candidate, dependencies) : this.emptyAssessment(dependencies)
    let invalidCandidateCount = 0
    if (candidate) {
      const digests = this.composeDigests(candidate)
      if (candidate.structureReceiptDigest !== digests.structureReceiptDigest ||
          candidate.dependencyReceiptDigest !== digests.dependencyReceiptDigest ||
          candidate.traceReceiptDigest !== digests.traceReceiptDigest ||
          candidate.coverageReceiptDigest !== digests.coverageReceiptDigest ||
          candidate.ownershipReceiptDigest !== digests.ownershipReceiptDigest ||
          candidate.assessmentReceiptDigest !== digests.assessmentReceiptDigest) invalidCandidateCount = 1
    }
    const elements = candidate?.elements ?? []
    const relations = candidate?.relations ?? []
    const decisions = candidate?.decisions ?? []
    const conflictCount = elements.filter((entry) => entry.disposition === "candidate-conflict").length + relations.filter((entry) => entry.disposition === "candidate-conflict").length
    const missingCount = elements.filter((entry) => entry.disposition === "candidate-missing" || entry.disposition === "deferred" || entry.disposition === "not-assessed").length + relations.filter((entry) => entry.disposition === "candidate-missing" || entry.disposition === "deferred" || entry.disposition === "not-assessed").length
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Low-Level Design candidate exists for this Initiative")
    if (presentDependencyCount !== dependencyNames.length) reasons.push(`Low-Level Design is missing ${dependencyNames.length - presentDependencyCount} current governed dependencies`)
    if (staleBindingCount) reasons.push("The Low-Level Design candidate does not bind the exact current Product and Initiative")
    if (staleDependencyCount) reasons.push(`The Low-Level Design candidate has ${staleDependencyCount} stale or missing exact governed dependencies`)
    if (assessment.orphanRelationCount) reasons.push("One or more LLD relations or decisions reference unknown elements")
    if (assessment.traceGapCount) reasons.push("One or more LLD elements lack exact governed trace candidates")
    if (assessment.evidenceGapCount) reasons.push("One or more LLD elements, relations, or decisions lack candidate evidence")
    if (assessment.ownershipGapCount) reasons.push("One or more LLD elements lack owner candidates")
    if (assessment.uncoveredUnitCount) reasons.push("The exact current Implementation Unit lacks LLD coverage")
    if (conflictCount) reasons.push("One or more LLD elements or relations are conflicted")
    if (missingCount) reasons.push("One or more LLD elements or relations are missing, deferred, or not assessed")
    if (decisions.some((decision) => decision.disposition !== "candidate-selected")) reasons.push("One or more LLD decisions remain unresolved")
    if (invalidCandidateCount) reasons.push("The Low-Level Design receipt digests are invalid")
    if (unresolvedQuestionCount) reasons.push("The candidate records unresolved Low-Level Design questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return lowLevelDesignStatusSchema.parse({
      schemaVersion: 1, kind: "low-level-design-status", productId: product.id, productRevision: revisionOf(product),
      initiativeId: initiative.id, initiativeRevision: revisionOf(initiative), implementationUnitId: targetUnitId,
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      ...(candidate ? this.dependencyReferences(candidate) : {}),
      dependencyCount: dependencyNames.length, presentDependencyCount, elementCount: elements.length,
      definedElementCount: elements.filter((entry) => entry.disposition === "candidate-defined").length,
      relationCount: relations.length, definedRelationCount: relations.filter((entry) => entry.disposition === "candidate-defined").length,
      decisionCount: decisions.length, selectedDecisionCount: decisions.filter((entry) => entry.disposition === "candidate-selected").length,
      qualityAttributeCount: candidate?.qualityAttributeKeys.length ?? 0, deploymentViewCount: candidate?.deploymentViewKeys.length ?? 0,
      conflictCount, missingCount, ...assessment, staleBindingCount, staleDependencyCount, invalidCandidateCount,
      unresolvedQuestionCount, reviewState, state: reasons.length === 0 ? "candidate-complete" : "attention-required",
      reasons, assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary,
    })
  }

  async project(initiativeId: string, implementationUnitId: string): Promise<LowLevelDesignProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const targetUnitId = this.requireUuid(implementationUnitId, "Implementation Unit ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId, targetUnitId), this.readCurrent(targetId, targetUnitId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Low-Level Design projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const, kind: "low-level-design-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        structureReceiptDigest: candidate.structureReceiptDigest, dependencyReceiptDigest: candidate.dependencyReceiptDigest,
        traceReceiptDigest: candidate.traceReceiptDigest, coverageReceiptDigest: candidate.coverageReceiptDigest,
        ownershipReceiptDigest: candidate.ownershipReceiptDigest, assessmentReceiptDigest: candidate.assessmentReceiptDigest,
        elementCount: candidate.elements.length, relationCount: candidate.relations.length, decisionCount: candidate.decisions.length,
        reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary,
    }
    return lowLevelDesignProjectionSchema.parse({ ...projectionWithoutDigest, snapshotDigest: canonicalDigest(projectionWithoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("low-level-designs", currentRecordPattern, lowLevelDesignSchema)
    for (const candidate of records) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) throw new Error("Current Low-Level Design candidate does not match its complete immutable history")
        const status = await this.assess(candidate.initiativeId, candidate.implementationUnitId)
        if (status.state === "attention-required") issues.push({
          code: "low-level-design.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has a stale, incomplete, invalid, or unresolved Low-Level Design candidate.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "create-superseding-revision"],
        })
      } catch (error) {
        issues.push({
          code: "low-level-design.invalid", severity: "error",
          message: `Low-Level Design ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private assessCandidate(input: LowLevelDesignInput, dependencies: ExactDependencies): DesignAssessment {
    const elementIds = new Set(input.elements.map((element) => element.id))
    const unitIds = new Set([input.implementationUnitId])
    const currentUnitIds = new Set(dependencies.implementationUnitModel.units.map((unit) => unit.id))
    const riskKeys = new Set(dependencies.riskRegister.risks.map((risk) => risk.key))
    const testAssetIds = new Set(dependencies.testInventory.assets.map((asset) => asset.id))
    const coveredUnits = new Set(input.elements.flatMap((element) => element.implementationUnitIds))
    const orphanRelationCount = input.relations.filter((relation) => !elementIds.has(relation.fromElementId) || !elementIds.has(relation.toElementId)).length +
      input.decisions.filter((decision) => decision.elementIds.some((id) => !elementIds.has(id))).length
    const traceGapCount = input.elements.filter((element) =>
      !currentUnitIds.has(input.implementationUnitId) || element.implementationUnitIds.some((id) => !unitIds.has(id)) ||
      element.highLevelDesignElementIds.some((id) => !dependencies.highLevelDesign.elements.some((entry) => entry.id === id)) ||
      element.riskKeys.some((key) => !riskKeys.has(key)) ||
      element.testInventoryAssetIds.some((id) => !testAssetIds.has(id))).length
    const evidenceGapCount = input.elements.filter((element) => element.evidenceReferences.length === 0).length +
      input.relations.filter((relation) => relation.evidenceReferences.length === 0).length +
      input.decisions.filter((decision) => decision.evidenceReferences.length === 0).length
    const ownershipGapCount = input.elements.filter((element) => element.ownerCandidateIds.length === 0).length
    const uncoveredUnitCount = [...unitIds].filter((id) => !coveredUnits.has(id)).length
    return { orphanRelationCount, traceGapCount, evidenceGapCount, ownershipGapCount, uncoveredUnitCount }
  }

  private requireValidCandidate(input: LowLevelDesignInput, assessment: DesignAssessment): void {
    const incomplete = input.elements.filter((entry) => entry.disposition !== "candidate-defined").length +
      input.relations.filter((entry) => entry.disposition !== "candidate-defined").length +
      input.decisions.filter((entry) => entry.disposition !== "candidate-selected").length
    const gaps = assessment.orphanRelationCount + assessment.traceGapCount + assessment.evidenceGapCount + assessment.ownershipGapCount + assessment.uncoveredUnitCount + incomplete
    if (input.reviewState === "ready-for-human-review" && gaps > 0) throw new Error("Review-ready Low-Level Design requires exact complete dependency, unit, risk, test, structure, ownership, and evidence trace candidates")
  }

  private emptyAssessment(_dependencies: ExactDependencies | undefined): DesignAssessment {
    return { orphanRelationCount: 0, traceGapCount: 0, evidenceGapCount: 0, ownershipGapCount: 0,
      uncoveredUnitCount: 1 }
  }

  private composeDigests(input: LowLevelDesignInput) {
    const structureReceiptDigest = canonicalDigest({
      implementationUnitId: input.implementationUnitId,
      elements: input.elements.map((entry) => ({ id: entry.id, ordinal: entry.ordinal, key: entry.key, kind: entry.kind, disposition: entry.disposition })),
      relations: input.relations.map((entry) => ({ id: entry.id, ordinal: entry.ordinal, key: entry.key, kind: entry.kind, fromElementId: entry.fromElementId, toElementId: entry.toElementId, disposition: entry.disposition })),
      decisions: input.decisions.map((entry) => ({ id: entry.id, key: entry.key, elementIds: entry.elementIds, disposition: entry.disposition, candidateOption: entry.candidateOption })),
    })
    const dependencyReceiptDigest = canonicalDigest(this.dependencyReferences(input))
    const traceReceiptDigest = canonicalDigest(input.elements.map((entry) => ({ id: entry.id, highLevelDesignElementIds: entry.highLevelDesignElementIds, boundedContextKeys: entry.boundedContextKeys,
      implementationUnitIds: entry.implementationUnitIds, technologySelectionKeys: entry.technologySelectionKeys,
      boilerplateEntryIds: entry.boilerplateEntryIds, routeScreenComponentSubjectIds: entry.routeScreenComponentSubjectIds,
      testInventoryAssetIds: entry.testInventoryAssetIds, riskKeys: entry.riskKeys, evidenceReferences: entry.evidenceReferences })))
    const coverageReceiptDigest = canonicalDigest({ qualityAttributeKeys: input.qualityAttributeKeys,
      deploymentViewKeys: input.deploymentViewKeys, elementIds: input.elements.map((entry) => entry.id),
      relationIds: input.relations.map((entry) => entry.id), decisionIds: input.decisions.map((entry) => entry.id) })
    const ownershipReceiptDigest = canonicalDigest(input.elements.map((entry) => ({ elementId: entry.id, ownerCandidateIds: entry.ownerCandidateIds })))
    const assessmentReceiptDigest = canonicalDigest({ context: input.context, informationClassification: input.informationClassification,
      structureReceiptDigest, dependencyReceiptDigest, traceReceiptDigest, coverageReceiptDigest, ownershipReceiptDigest,
      alternativesConsidered: input.alternativesConsidered, unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations,
      reviewState: input.reviewState, designTruthState: input.designTruthState,
      designCompletenessState: input.designCompletenessState, repositoryTruthState: input.repositoryTruthState,
      sourceTruthState: input.sourceTruthState,
      runtimeTruthState: input.runtimeTruthState, deploymentTruthState: input.deploymentTruthState,
      privacyApprovalState: input.privacyApprovalState, securityApprovalState: input.securityApprovalState,
      ownershipAppointmentState: input.ownershipAppointmentState, implementationReadinessState: input.implementationReadinessState,
      acceptanceDecisionState: input.acceptanceDecisionState, releaseReadinessState: input.releaseReadinessState,
      deploymentReadinessState: input.deploymentReadinessState, actionAuthorityState: input.actionAuthorityState })
    return { structureReceiptDigest, dependencyReceiptDigest, traceReceiptDigest, coverageReceiptDigest, ownershipReceiptDigest, assessmentReceiptDigest }
  }

  private dependencyReferences(input: LowLevelDesignInput): Record<keyof ExactDependencies, ExactReference> {
    return Object.fromEntries(dependencyNames.map((name) => [name, input[name]])) as Record<keyof ExactDependencies, ExactReference>
  }

  private readDependencies(initiativeId: string): Promise<unknown>[] {
    return [this.highLevelDesign.readCurrent(initiativeId), this.systemSolutionArchitecture.readCurrent(initiativeId), this.boundedContextModel.readCurrent(initiativeId),
      this.technologyProfile.readCurrent(initiativeId), this.dependencyMapping.readCurrent(initiativeId),
      this.implementationUnitModel.readCurrent(initiativeId), this.boilerplateRegistry.readCurrent(initiativeId),
      this.boilerplateSelectionBinding.readCurrent(initiativeId), this.boilerplateCompatibilityValidation.readCurrent(initiativeId),
      this.designBaseline.readCurrent(initiativeId), this.designToCodeBindingRegistry.readCurrent(initiativeId),
      this.routeScreenComponentMapping.readCurrent(initiativeId), this.testMethodology.readCurrent(initiativeId),
      this.testInventory.readCurrent(initiativeId), this.riskRegister.readCurrent(initiativeId),
      this.securityPrivacyAssessment.readCurrent(initiativeId)]
  }

  private toDependencies(records: unknown[]): ExactDependencies | undefined {
    if (records.some((record) => !record)) return undefined
    return Object.fromEntries(dependencyNames.map((name, index) => [name, records[index]])) as unknown as ExactDependencies
  }

  private async requireExactDependencies(input: LowLevelDesignInput): Promise<ExactDependencies> {
    const dependencies = this.toDependencies(await Promise.all(this.readDependencies(input.initiativeId)))
    if (!dependencies) throw new Error("Low-Level Design requires all 16 current governed dependencies")
    for (const name of dependencyNames) if (!sameReference(input[name], dependencies[name])) throw new Error(`Low-Level Design must reference the exact current ${name} candidate`)
    return dependencies
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Low-Level Design Initiative targets a different Product")
    if (canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) throw new Error("Low-Level Design must bind the exact current Product and Initiative revisions and digests")
  }

  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return { productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Low-Level Design is immutable`)
    return { product, initiative }
  }

  private async commitVersionedRecord(record: LowLevelDesign, assessment: DesignAssessment, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [this.governed(this.currentPath(record.id), record, lowLevelDesignSchema),
        this.governed(this.historyPath(record.id, record.revision), record, lowLevelDesignSchema)],
      audit: { eventType, actor: { kind: "human", id: actorId }, subjectId: record.id, payload: {
        initiativeId: record.initiativeId, implementationUnitId: record.implementationUnitId,
        revision: record.revision, recordDigest: canonicalDigest(record),
        structureReceiptDigest: record.structureReceiptDigest, dependencyReceiptDigest: record.dependencyReceiptDigest,
        traceReceiptDigest: record.traceReceiptDigest, coverageReceiptDigest: record.coverageReceiptDigest,
        ownershipReceiptDigest: record.ownershipReceiptDigest, assessmentReceiptDigest: record.assessmentReceiptDigest,
        predecessorDigest: record.predecessorDigest, dependencies: this.dependencyReferences(record),
        elementCount: record.elements.length, relationCount: record.relations.length, decisionCount: record.decisions.length,
        qualityAttributeCount: record.qualityAttributeKeys.length, deploymentViewCount: record.deploymentViewKeys.length,
        ...assessment, reviewState: record.reviewState, designTruthState: record.designTruthState,
        designCompletenessState: record.designCompletenessState, repositoryTruthState: record.repositoryTruthState,
        sourceTruthState: record.sourceTruthState,
        runtimeTruthState: record.runtimeTruthState, deploymentTruthState: record.deploymentTruthState,
        privacyApprovalState: record.privacyApprovalState, securityApprovalState: record.securityApprovalState,
        ownershipAppointmentState: record.ownershipAppointmentState, implementationReadinessState: record.implementationReadinessState,
        acceptanceDecisionState: record.acceptanceDecisionState, releaseReadinessState: record.releaseReadinessState,
        deploymentReadinessState: record.deploymentReadinessState, actionAuthorityState: record.actionAuthorityState,
        authorityBoundary: record.authorityBoundary,
      } },
    })
  }

  private currentPath(id: string): string { return this.repository.resolve("low-level-designs", `${id}.json`) }
  private historyPath(id: string, revision: number): string { return this.repository.resolve("low-level-design-history", `low-level-design-${id}-r${revision}.json`) }
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
    if (names.length > inventoryLimit) throw new Error(`Low-Level Design directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>; const rightRecord = right as Record<string, unknown>
      return `${String(leftRecord.id ?? "")}:${String(leftRecord.revision ?? "")}`.localeCompare(`${String(rightRecord.id ?? "")}:${String(rightRecord.revision ?? "")}`)
    })
  }
}
