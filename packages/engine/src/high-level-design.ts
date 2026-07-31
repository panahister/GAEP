import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  highLevelDesignInputSchema,
  highLevelDesignProjectionSchema,
  highLevelDesignSchema,
  highLevelDesignStatusSchema,
  type BoilerplateCompatibilityValidation,
  type BoilerplateRegistry,
  type BoilerplateSelectionBinding,
  type BoundedContextModel,
  type BusinessContextBinding,
  type DependencyMapping,
  type DesignBaseline,
  type DesignToCodeBindingRegistry,
  type HighLevelDesign,
  type HighLevelDesignInput,
  type HighLevelDesignProjection,
  type HighLevelDesignStatus,
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
  "systemSolutionArchitecture", "boundedContextModel", "technologyProfile", "dependencyMapping",
  "implementationUnitModel", "boilerplateRegistry", "boilerplateSelectionBinding",
  "boilerplateCompatibilityValidation", "designBaseline", "designToCodeBindingRegistry",
  "routeScreenComponentMapping", "testMethodology", "testInventory", "riskRegister", "securityPrivacyAssessment",
]
const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "high-level-design-is-a-versioned-candidate-and-does-not-establish-architecture-repository-runtime-or-deployment-truth-or-completeness-architecture-baseline-or-approval-privacy-or-security-approval-owner-appointment-implementation-readiness-acceptance-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "high-level-design-status-is-observational-and-does-not-establish-architecture-repository-runtime-or-deployment-truth-or-completeness-architecture-baseline-or-approval-privacy-or-security-approval-owner-appointment-implementation-readiness-acceptance-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "high-level-design-projection-is-read-only-and-does-not-establish-architecture-repository-runtime-or-deployment-truth-or-completeness-architecture-baseline-or-approval-privacy-or-security-approval-owner-appointment-implementation-readiness-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-counts-statuses-and-structure-dependency-trace-coverage-ownership-assessment-snapshot-digests-only-not-design-narratives-diagrams-interfaces-data-flows-technologies-owners-evidence-source-content-personal-data-secrets-credentials-or-machine-paths" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}
function sameReference(reference: ExactReference | undefined, record: { id: string; revision?: number } | undefined): boolean {
  return Boolean(reference && record && reference.recordId === record.id && reference.revision === revisionOf(record) && reference.digest === canonicalDigest(record))
}

export class HighLevelDesignService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
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

  async create(inputValue: HighLevelDesignInput, actorId: string): Promise<HighLevelDesign> {
    const input = highLevelDesignInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      const assessment = this.assessCandidate(input, dependencies)
      this.requireValidCandidate(input, assessment)
      if (await this.readCurrent(initiative.id)) throw new Error("An Initiative can have only one current High-Level Design candidate")
      const now = new Date().toISOString()
      const record = highLevelDesignSchema.parse({
        schemaVersion: 1, kind: "high-level-design-candidate", id: randomUUID(), productId: product.id,
        ...input, initiativeId: initiative.id, revision: 1, ...this.composeDigests(input), state: "candidate",
        createdBy: { kind: "human", id: actorId }, updatedBy: { kind: "human", id: actorId },
        createdAt: now, updatedAt: now, authorityBoundary,
      })
      await this.commitVersionedRecord(record, assessment, "high-level-design.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: HighLevelDesignInput, actorId: string): Promise<HighLevelDesign> {
    const input = highLevelDesignInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("High-Level Design revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("High-Level Design Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      const assessment = this.assessCandidate(input, dependencies)
      this.requireValidCandidate(input, assessment)
      const record = highLevelDesignSchema.parse({
        ...current, ...input, productId: product.id, initiativeId: initiative.id,
        revision: current.revision + 1, ...this.composeDigests(input), predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId }, updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, assessment, "high-level-design.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<HighLevelDesign> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "High-Level Design ID")), highLevelDesignSchema)
  }

  async readCurrent(initiativeId: string): Promise<HighLevelDesign | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const matches = (await this.listRecords("high-level-designs", currentRecordPattern, highLevelDesignSchema))
      .filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current High-Level Design candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<HighLevelDesign> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("High-Level Design history revision must be a positive integer")
    const recordId = this.requireUuid(id, "High-Level Design ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), highLevelDesignSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("High-Level Design history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<HighLevelDesign[]> {
    const recordId = this.requireUuid(id, "High-Level Design ID")
    const records = await this.listRecords(
      "high-level-design-history", new RegExp(`^high-level-design-${recordId}-r[1-9][0-9]*\\.json$`, "iu"), highLevelDesignSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("High-Level Design history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<HighLevelDesignStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, ...records] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), ...this.readDependencies(targetId),
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
    if (!candidate) reasons.push("No versioned High-Level Design candidate exists for this Initiative")
    if (presentDependencyCount !== dependencyNames.length) reasons.push(`High-Level Design is missing ${dependencyNames.length - presentDependencyCount} current governed dependencies`)
    if (staleBindingCount) reasons.push("The High-Level Design candidate does not bind the exact current Product and Initiative")
    if (staleDependencyCount) reasons.push(`The High-Level Design candidate has ${staleDependencyCount} stale or missing exact governed dependencies`)
    if (assessment.orphanRelationCount) reasons.push("One or more HLD relations or decisions reference unknown elements")
    if (assessment.traceGapCount) reasons.push("One or more HLD elements lack exact governed trace candidates")
    if (assessment.evidenceGapCount) reasons.push("One or more HLD elements, relations, or decisions lack candidate evidence")
    if (assessment.ownershipGapCount) reasons.push("One or more HLD elements lack owner candidates")
    if (assessment.uncoveredUnitCount) reasons.push("One or more current Implementation Units lack HLD coverage")
    if (conflictCount) reasons.push("One or more HLD elements or relations are conflicted")
    if (missingCount) reasons.push("One or more HLD elements or relations are missing, deferred, or not assessed")
    if (decisions.some((decision) => decision.disposition !== "candidate-selected")) reasons.push("One or more HLD decisions remain unresolved")
    if (invalidCandidateCount) reasons.push("The High-Level Design receipt digests are invalid")
    if (unresolvedQuestionCount) reasons.push("The candidate records unresolved High-Level Design questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return highLevelDesignStatusSchema.parse({
      schemaVersion: 1, kind: "high-level-design-status", productId: product.id, productRevision: revisionOf(product),
      initiativeId: initiative.id, initiativeRevision: revisionOf(initiative), ...(candidate ? { candidate: exactReference(candidate) } : {}),
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

  async project(initiativeId: string): Promise<HighLevelDesignProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("High-Level Design projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const, kind: "high-level-design-projection" as const,
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
    return highLevelDesignProjectionSchema.parse({ ...projectionWithoutDigest, snapshotDigest: canonicalDigest(projectionWithoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("high-level-designs", currentRecordPattern, highLevelDesignSchema)
    for (const candidate of records) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) throw new Error("Current High-Level Design candidate does not match its complete immutable history")
        const status = await this.assess(candidate.initiativeId)
        if (status.state === "attention-required") issues.push({
          code: "high-level-design.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has a stale, incomplete, invalid, or unresolved High-Level Design candidate.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "create-superseding-revision"],
        })
      } catch (error) {
        issues.push({
          code: "high-level-design.invalid", severity: "error",
          message: `High-Level Design ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private assessCandidate(input: HighLevelDesignInput, dependencies: ExactDependencies): DesignAssessment {
    const elementIds = new Set(input.elements.map((element) => element.id))
    const unitIds = new Set(dependencies.implementationUnitModel.units.map((unit) => unit.id))
    const riskKeys = new Set(dependencies.riskRegister.risks.map((risk) => risk.key))
    const testAssetIds = new Set(dependencies.testInventory.assets.map((asset) => asset.id))
    const coveredUnits = new Set(input.elements.flatMap((element) => element.implementationUnitIds))
    const orphanRelationCount = input.relations.filter((relation) => !elementIds.has(relation.fromElementId) || !elementIds.has(relation.toElementId)).length +
      input.decisions.filter((decision) => decision.elementIds.some((id) => !elementIds.has(id))).length
    const traceGapCount = input.elements.filter((element) =>
      element.implementationUnitIds.some((id) => !unitIds.has(id)) || element.riskKeys.some((key) => !riskKeys.has(key)) ||
      element.testInventoryAssetIds.some((id) => !testAssetIds.has(id))).length
    const evidenceGapCount = input.elements.filter((element) => element.evidenceReferences.length === 0).length +
      input.relations.filter((relation) => relation.evidenceReferences.length === 0).length +
      input.decisions.filter((decision) => decision.evidenceReferences.length === 0).length
    const ownershipGapCount = input.elements.filter((element) => element.ownerCandidateIds.length === 0).length
    const uncoveredUnitCount = [...unitIds].filter((id) => !coveredUnits.has(id)).length
    return { orphanRelationCount, traceGapCount, evidenceGapCount, ownershipGapCount, uncoveredUnitCount }
  }

  private requireValidCandidate(input: HighLevelDesignInput, assessment: DesignAssessment): void {
    const incomplete = input.elements.filter((entry) => entry.disposition !== "candidate-defined").length +
      input.relations.filter((entry) => entry.disposition !== "candidate-defined").length +
      input.decisions.filter((entry) => entry.disposition !== "candidate-selected").length
    const gaps = assessment.orphanRelationCount + assessment.traceGapCount + assessment.evidenceGapCount + assessment.ownershipGapCount + assessment.uncoveredUnitCount + incomplete
    if (input.reviewState === "ready-for-human-review" && gaps > 0) throw new Error("Review-ready High-Level Design requires exact complete dependency, unit, risk, test, structure, ownership, and evidence trace candidates")
  }

  private emptyAssessment(dependencies: ExactDependencies | undefined): DesignAssessment {
    return { orphanRelationCount: 0, traceGapCount: 0, evidenceGapCount: 0, ownershipGapCount: 0,
      uncoveredUnitCount: dependencies?.implementationUnitModel.units.length ?? 0 }
  }

  private composeDigests(input: HighLevelDesignInput) {
    const structureReceiptDigest = canonicalDigest({
      elements: input.elements.map((entry) => ({ id: entry.id, ordinal: entry.ordinal, key: entry.key, kind: entry.kind, disposition: entry.disposition })),
      relations: input.relations.map((entry) => ({ id: entry.id, ordinal: entry.ordinal, key: entry.key, kind: entry.kind, fromElementId: entry.fromElementId, toElementId: entry.toElementId, disposition: entry.disposition })),
      decisions: input.decisions.map((entry) => ({ id: entry.id, key: entry.key, elementIds: entry.elementIds, disposition: entry.disposition, candidateOption: entry.candidateOption })),
    })
    const dependencyReceiptDigest = canonicalDigest(this.dependencyReferences(input))
    const traceReceiptDigest = canonicalDigest(input.elements.map((entry) => ({ id: entry.id, boundedContextKeys: entry.boundedContextKeys,
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
      reviewState: input.reviewState, architectureTruthState: input.architectureTruthState,
      architectureCompletenessState: input.architectureCompletenessState, repositoryTruthState: input.repositoryTruthState,
      runtimeTruthState: input.runtimeTruthState, deploymentTruthState: input.deploymentTruthState,
      privacyApprovalState: input.privacyApprovalState, securityApprovalState: input.securityApprovalState,
      ownershipAppointmentState: input.ownershipAppointmentState, implementationReadinessState: input.implementationReadinessState,
      acceptanceDecisionState: input.acceptanceDecisionState, releaseReadinessState: input.releaseReadinessState,
      deploymentReadinessState: input.deploymentReadinessState, actionAuthorityState: input.actionAuthorityState })
    return { structureReceiptDigest, dependencyReceiptDigest, traceReceiptDigest, coverageReceiptDigest, ownershipReceiptDigest, assessmentReceiptDigest }
  }

  private dependencyReferences(input: HighLevelDesignInput): Record<keyof ExactDependencies, ExactReference> {
    return Object.fromEntries(dependencyNames.map((name) => [name, input[name]])) as Record<keyof ExactDependencies, ExactReference>
  }

  private readDependencies(initiativeId: string): Promise<unknown>[] {
    return [this.systemSolutionArchitecture.readCurrent(initiativeId), this.boundedContextModel.readCurrent(initiativeId),
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

  private async requireExactDependencies(input: HighLevelDesignInput): Promise<ExactDependencies> {
    const dependencies = this.toDependencies(await Promise.all(this.readDependencies(input.initiativeId)))
    if (!dependencies) throw new Error("High-Level Design requires all 15 current governed dependencies")
    for (const name of dependencyNames) if (!sameReference(input[name], dependencies[name])) throw new Error(`High-Level Design must reference the exact current ${name} candidate`)
    return dependencies
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("High-Level Design Initiative targets a different Product")
    if (canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) throw new Error("High-Level Design must bind the exact current Product and Initiative revisions and digests")
  }

  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return { productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} High-Level Design is immutable`)
    return { product, initiative }
  }

  private async commitVersionedRecord(record: HighLevelDesign, assessment: DesignAssessment, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [this.governed(this.currentPath(record.id), record, highLevelDesignSchema),
        this.governed(this.historyPath(record.id, record.revision), record, highLevelDesignSchema)],
      audit: { eventType, actor: { kind: "human", id: actorId }, subjectId: record.id, payload: {
        initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record),
        structureReceiptDigest: record.structureReceiptDigest, dependencyReceiptDigest: record.dependencyReceiptDigest,
        traceReceiptDigest: record.traceReceiptDigest, coverageReceiptDigest: record.coverageReceiptDigest,
        ownershipReceiptDigest: record.ownershipReceiptDigest, assessmentReceiptDigest: record.assessmentReceiptDigest,
        predecessorDigest: record.predecessorDigest, dependencies: this.dependencyReferences(record),
        elementCount: record.elements.length, relationCount: record.relations.length, decisionCount: record.decisions.length,
        qualityAttributeCount: record.qualityAttributeKeys.length, deploymentViewCount: record.deploymentViewKeys.length,
        ...assessment, reviewState: record.reviewState, architectureTruthState: record.architectureTruthState,
        architectureCompletenessState: record.architectureCompletenessState, repositoryTruthState: record.repositoryTruthState,
        runtimeTruthState: record.runtimeTruthState, deploymentTruthState: record.deploymentTruthState,
        privacyApprovalState: record.privacyApprovalState, securityApprovalState: record.securityApprovalState,
        ownershipAppointmentState: record.ownershipAppointmentState, implementationReadinessState: record.implementationReadinessState,
        acceptanceDecisionState: record.acceptanceDecisionState, releaseReadinessState: record.releaseReadinessState,
        deploymentReadinessState: record.deploymentReadinessState, actionAuthorityState: record.actionAuthorityState,
        authorityBoundary: record.authorityBoundary,
      } },
    })
  }

  private currentPath(id: string): string { return this.repository.resolve("high-level-designs", `${id}.json`) }
  private historyPath(id: string, revision: number): string { return this.repository.resolve("high-level-design-history", `high-level-design-${id}-r${revision}.json`) }
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
    if (names.length > inventoryLimit) throw new Error(`High-Level Design directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>; const rightRecord = right as Record<string, unknown>
      return `${String(leftRecord.id ?? "")}:${String(leftRecord.revision ?? "")}`.localeCompare(`${String(rightRecord.id ?? "")}:${String(rightRecord.revision ?? "")}`)
    })
  }
}
