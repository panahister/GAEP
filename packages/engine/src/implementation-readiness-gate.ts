import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  implementationReadinessGateInputSchema, implementationReadinessGateProjectionSchema,
  implementationReadinessGateSchema, implementationReadinessGateStatusSchema,
  type AcceptanceCriteria, type BacklogHierarchy, type BoilerplateCompatibilityValidation,
  type BoilerplateRegistry, type BoilerplateSelectionBinding, type BusinessContextBinding,
  type DefinitionOfDone, type DefinitionOfReady, type DependencyMapping, type DesignBaseline,
  type DesignToCodeBindingRegistry, type HighLevelDesign, type ImplementationReadinessGate,
  type ImplementationReadinessGateInput, type ImplementationReadinessGateProjection,
  type ImplementationReadinessGateStatus, type ImplementationUnitModel, type Initiative,
  type LowLevelDesign, type MvpSliceDefinition, type PrioritizationModel, type Product,
  type RiskRegister, type RouteScreenComponentMapping, type SecurityPrivacyAssessment,
  type TechnologyProfile, type TestInventory, type TestMethodology, type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type CurrentReader<T> = { readCurrent(initiativeId: string): Promise<T | undefined> }
type LowLevelReader = { listCurrent(initiativeId: string): Promise<LowLevelDesign[]> }
type ExactReference = { recordId: string; revision: number; digest: string }

interface ExactDependencies {
  backlogHierarchy: BacklogHierarchy
  mvpSliceDefinition: MvpSliceDefinition
  prioritizationModel: PrioritizationModel
  acceptanceCriteria: AcceptanceCriteria
  definitionOfReady: DefinitionOfReady
  definitionOfDone: DefinitionOfDone
  implementationUnitModel: ImplementationUnitModel
  dependencyMapping: DependencyMapping
  technologyProfile: TechnologyProfile
  boilerplateRegistry: BoilerplateRegistry
  boilerplateSelectionBinding: BoilerplateSelectionBinding
  boilerplateCompatibilityValidation: BoilerplateCompatibilityValidation
  designBaseline: DesignBaseline
  designToCodeBindingRegistry: DesignToCodeBindingRegistry
  routeScreenComponentMapping: RouteScreenComponentMapping
  testMethodology: TestMethodology
  testInventory: TestInventory
  highLevelDesign: HighLevelDesign
  riskRegister: RiskRegister
  securityPrivacyAssessment: SecurityPrivacyAssessment
}

const dependencyNames: (keyof ExactDependencies)[] = [
  "backlogHierarchy", "mvpSliceDefinition", "prioritizationModel", "acceptanceCriteria", "definitionOfReady", "definitionOfDone",
  "implementationUnitModel", "dependencyMapping", "technologyProfile", "boilerplateRegistry", "boilerplateSelectionBinding",
  "boilerplateCompatibilityValidation", "designBaseline", "designToCodeBindingRegistry", "routeScreenComponentMapping",
  "testMethodology", "testInventory", "highLevelDesign", "riskRegister", "securityPrivacyAssessment",
]
const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "implementation-readiness-gate-is-a-versioned-candidate-assessment-and-does-not-establish-artifact-or-evidence-truth-completeness-approval-waiver-owner-appointment-implementation-readiness-assignment-execution-acceptance-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "implementation-readiness-gate-status-is-observational-and-does-not-establish-artifact-or-evidence-truth-completeness-approval-waiver-owner-appointment-implementation-readiness-assignment-execution-acceptance-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "implementation-readiness-gate-projection-is-read-only-and-does-not-establish-artifact-or-evidence-truth-completeness-approval-waiver-owner-appointment-implementation-readiness-assignment-execution-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-counts-statuses-and-dependency-coverage-evidence-ownership-assessment-digests-only-not-readiness-rationales-evidence-content-review-content-owner-details-personal-data-secrets-credentials-or-machine-paths" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}
function sameReference(reference: ExactReference | undefined, record: { id: string; revision?: number } | undefined): boolean {
  return Boolean(reference && record && reference.recordId === record.id && reference.revision === revisionOf(record) && reference.digest === canonicalDigest(record))
}

export class ImplementationReadinessGateService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly backlogHierarchy: CurrentReader<BacklogHierarchy>,
    private readonly mvpSliceDefinition: CurrentReader<MvpSliceDefinition>,
    private readonly prioritizationModel: CurrentReader<PrioritizationModel>,
    private readonly acceptanceCriteria: CurrentReader<AcceptanceCriteria>,
    private readonly definitionOfReady: CurrentReader<DefinitionOfReady>,
    private readonly definitionOfDone: CurrentReader<DefinitionOfDone>,
    private readonly implementationUnitModel: CurrentReader<ImplementationUnitModel>,
    private readonly dependencyMapping: CurrentReader<DependencyMapping>,
    private readonly technologyProfile: CurrentReader<TechnologyProfile>,
    private readonly boilerplateRegistry: CurrentReader<BoilerplateRegistry>,
    private readonly boilerplateSelectionBinding: CurrentReader<BoilerplateSelectionBinding>,
    private readonly boilerplateCompatibilityValidation: CurrentReader<BoilerplateCompatibilityValidation>,
    private readonly designBaseline: CurrentReader<DesignBaseline>,
    private readonly designToCodeBindingRegistry: CurrentReader<DesignToCodeBindingRegistry>,
    private readonly routeScreenComponentMapping: CurrentReader<RouteScreenComponentMapping>,
    private readonly testMethodology: CurrentReader<TestMethodology>,
    private readonly testInventory: CurrentReader<TestInventory>,
    private readonly highLevelDesign: CurrentReader<HighLevelDesign>,
    private readonly riskRegister: CurrentReader<RiskRegister>,
    private readonly securityPrivacyAssessment: CurrentReader<SecurityPrivacyAssessment>,
    private readonly lowLevelDesign: LowLevelReader,
  ) {}

  async create(inputValue: ImplementationReadinessGateInput, actorId: string): Promise<ImplementationReadinessGate> {
    const input = implementationReadinessGateInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      const lowLevels = await this.lowLevelDesign.listCurrent(initiative.id)
      this.validateSubjects(input, dependencies, lowLevels)
      if (await this.readCurrent(initiative.id)) throw new Error("An Initiative can have only one current Implementation Readiness Gate candidate")
      const now = new Date().toISOString()
      const record = implementationReadinessGateSchema.parse({
        schemaVersion: 1, kind: "implementation-readiness-gate-candidate", id: randomUUID(), productId: product.id,
        ...input, initiativeId: initiative.id, revision: 1, ...this.composeDigests(input), state: "candidate",
        createdBy: { kind: "human", id: actorId }, updatedBy: { kind: "human", id: actorId },
        createdAt: now, updatedAt: now, authorityBoundary,
      })
      await this.commitVersionedRecord(record, "implementation-readiness-gate.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: ImplementationReadinessGateInput, actorId: string): Promise<ImplementationReadinessGate> {
    const input = implementationReadinessGateInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Implementation Readiness Gate revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Implementation Readiness Gate Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      this.validateSubjects(input, dependencies, await this.lowLevelDesign.listCurrent(initiative.id))
      const record = implementationReadinessGateSchema.parse({
        ...current, ...input, productId: product.id, initiativeId: initiative.id, revision: current.revision + 1,
        ...this.composeDigests(input), predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId }, updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, "implementation-readiness-gate.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<ImplementationReadinessGate> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Implementation Readiness Gate ID")), implementationReadinessGateSchema)
  }

  async readCurrent(initiativeId: string): Promise<ImplementationReadinessGate | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const matches = (await this.listRecords("implementation-readiness-gates", currentRecordPattern, implementationReadinessGateSchema))
      .filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Implementation Readiness Gate candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<ImplementationReadinessGate> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Implementation Readiness Gate history revision must be a positive integer")
    const recordId = this.requireUuid(id, "Implementation Readiness Gate ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), implementationReadinessGateSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Implementation Readiness Gate history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<ImplementationReadinessGate[]> {
    const recordId = this.requireUuid(id, "Implementation Readiness Gate ID")
    const records = await this.listRecords("implementation-readiness-gate-history",
      new RegExp(`^implementation-readiness-gate-${recordId}-r[1-9][0-9]*\\.json$`, "iu"), implementationReadinessGateSchema)
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Implementation Readiness Gate history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<ImplementationReadinessGateStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, lowLevels, ...records] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), this.lowLevelDesign.listCurrent(targetId), ...this.readDependencies(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const dependencies = this.toDependencies(records)
    const presentDependencyCount = records.filter(Boolean).length
    const staleBindingCount = candidate && canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative)) ? 1 : 0
    let staleDependencyCount = candidate ? dependencyNames.filter((name) => !sameReference(candidate[name], dependencies?.[name])).length : 0
    const units = dependencies?.implementationUnitModel.units ?? []
    const subjectByUnit = new Map(candidate?.subjects.map((subject) => [subject.implementationUnitId, subject]) ?? [])
    const lowLevelByUnit = new Map(lowLevels.map((record) => [record.implementationUnitId, record]))
    for (const unit of units) {
      const subject = subjectByUnit.get(unit.id)
      if (!subject || !sameReference(subject.lowLevelDesign, lowLevelByUnit.get(unit.id))) staleDependencyCount += 1
    }
    const subjects = candidate?.subjects ?? []
    const count = (outcome: ImplementationReadinessGateInput["subjects"][number]["outcome"]) => subjects.filter((subject) => subject.outcome === outcome).length
    const evidenceGapCount = subjects.filter((subject) => subject.evidenceReferences.length === 0 ||
      subject.assessments.some((entry) => entry.outcome === "satisfied" && entry.evidenceReferences.length === 0)).length
    const ownershipGapCount = subjects.filter((subject) => subject.ownerCandidateIds.length === 0).length
    const coverageGapCount = units.filter((unit) => !subjectByUnit.has(unit.id)).length + subjects.filter((subject) => !units.some((unit) => unit.id === subject.implementationUnitId)).length
    let invalidCandidateCount = 0
    if (candidate) {
      const digests = this.composeDigests(candidate)
      if (candidate.dependencyReceiptDigest !== digests.dependencyReceiptDigest || candidate.coverageReceiptDigest !== digests.coverageReceiptDigest ||
          candidate.evidenceReceiptDigest !== digests.evidenceReceiptDigest || candidate.ownershipReceiptDigest !== digests.ownershipReceiptDigest ||
          candidate.assessmentReceiptDigest !== digests.assessmentReceiptDigest) invalidCandidateCount = 1
    }
    const gapCount = count("gap"), conflictCount = count("conflict"), staleCount = count("stale")
    const waivedCandidateCount = count("waived-candidate"), notAssessedCount = count("not-assessed"), satisfiedCount = count("satisfied")
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Implementation Readiness Gate candidate exists for this Initiative")
    if (presentDependencyCount !== dependencyNames.length) reasons.push(`Implementation readiness is missing ${dependencyNames.length - presentDependencyCount} current governed dependencies`)
    if (staleBindingCount) reasons.push("The readiness candidate does not bind the exact current Product and Initiative")
    if (staleDependencyCount) reasons.push(`The readiness candidate has ${staleDependencyCount} stale or missing exact governed dependencies including per-unit LLD bindings`)
    if (coverageGapCount) reasons.push("One or more exact current Implementation Units lack one readiness subject")
    if (gapCount) reasons.push("One or more readiness subjects record gaps")
    if (conflictCount) reasons.push("One or more readiness subjects record conflicts")
    if (staleCount) reasons.push("One or more readiness subjects record stale evidence")
    if (notAssessedCount) reasons.push("One or more readiness subjects remain not assessed")
    if (waivedCandidateCount) reasons.push("One or more readiness subjects contain only waiver candidates requiring accountable authorization")
    if (evidenceGapCount) reasons.push("One or more readiness subjects lack attributable candidate evidence")
    if (ownershipGapCount) reasons.push("One or more readiness subjects lack owner candidates")
    if (invalidCandidateCount) reasons.push("The readiness candidate receipt digests are invalid")
    if (unresolvedQuestionCount) reasons.push("The readiness candidate records unresolved questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The readiness candidate is not marked ready for human review")
    const hasBlockingGap = gapCount + conflictCount + staleCount + waivedCandidateCount + notAssessedCount + evidenceGapCount + ownershipGapCount + coverageGapCount + staleBindingCount + staleDependencyCount + invalidCandidateCount + unresolvedQuestionCount > 0
    return implementationReadinessGateStatusSchema.parse({
      schemaVersion: 1, kind: "implementation-readiness-gate-status", productId: product.id, productRevision: revisionOf(product),
      initiativeId: initiative.id, initiativeRevision: revisionOf(initiative), ...(candidate ? { candidate: exactReference(candidate) } : {}),
      ...(candidate ? this.dependencyReferences(candidate) : {}),
      lowLevelDesigns: candidate?.subjects.map((subject) => ({ implementationUnitId: subject.implementationUnitId, reference: subject.lowLevelDesign })) ?? [],
      dependencyCount: dependencyNames.length + units.length, presentDependencyCount: presentDependencyCount + lowLevels.length,
      subjectCount: subjects.length, satisfiedCount, gapCount, conflictCount, staleCount, waivedCandidateCount, notAssessedCount,
      evidenceGapCount, ownershipGapCount, coverageGapCount, staleBindingCount, staleDependencyCount, invalidCandidateCount,
      unresolvedQuestionCount, reviewState, state: candidate && !hasBlockingGap && reviewState === "ready-for-human-review" ? "candidate-assessed" : "attention-required",
      reasons, assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary,
    })
  }

  async project(initiativeId: string): Promise<ImplementationReadinessGateProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) || status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Implementation Readiness Gate projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const, kind: "implementation-readiness-gate-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status, ...(candidate ? { candidate: { id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        dependencyReceiptDigest: candidate.dependencyReceiptDigest, coverageReceiptDigest: candidate.coverageReceiptDigest,
        evidenceReceiptDigest: candidate.evidenceReceiptDigest, ownershipReceiptDigest: candidate.ownershipReceiptDigest,
        assessmentReceiptDigest: candidate.assessmentReceiptDigest, subjectCount: candidate.subjects.length,
        reviewState: candidate.reviewState, updatedAt: candidate.updatedAt } } : {}),
      observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary,
    }
    return implementationReadinessGateProjectionSchema.parse({ ...projectionWithoutDigest, snapshotDigest: canonicalDigest(projectionWithoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("implementation-readiness-gates", currentRecordPattern, implementationReadinessGateSchema)
    for (const candidate of records) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) throw new Error("Current candidate does not match complete immutable history")
        if ((await this.assess(candidate.initiativeId)).state === "attention-required") issues.push({ code: "implementation-readiness-gate.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has a stale, incomplete, conflicted, waived, or unresolved readiness candidate.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "create-superseding-revision"] })
      } catch (error) {
        issues.push({ code: "implementation-readiness-gate.invalid", severity: "error",
          message: `Implementation Readiness Gate ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "manual-repair-required"] })
      }
    }
    return issues
  }

  private validateSubjects(input: ImplementationReadinessGateInput, dependencies: ExactDependencies, lowLevels: LowLevelDesign[]): void {
    const units = dependencies.implementationUnitModel.units
    if (input.subjects.length !== units.length) throw new Error("Implementation Readiness Gate requires exactly one subject for every current Implementation Unit")
    const lowLevelByUnit = new Map(lowLevels.map((record) => [record.implementationUnitId, record]))
    for (const [index, unit] of units.entries()) {
      const subject = input.subjects[index]
      if (!subject || subject.implementationUnitId !== unit.id) throw new Error("Readiness subjects must follow exact current Implementation Unit ordering")
      const lowLevel = lowLevelByUnit.get(unit.id)
      if (!lowLevel || !sameReference(subject.lowLevelDesign, lowLevel)) throw new Error("Every readiness subject must bind the exact current Low-Level Design for its Implementation Unit")
    }
  }

  private composeDigests(input: ImplementationReadinessGateInput) {
    const dependencyReceiptDigest = canonicalDigest({ ...this.dependencyReferences(input), lowLevelDesigns: input.subjects.map((subject) => ({ implementationUnitId: subject.implementationUnitId, lowLevelDesign: subject.lowLevelDesign })) })
    const coverageReceiptDigest = canonicalDigest(input.subjects.map((subject) => ({ id: subject.id, ordinal: subject.ordinal, implementationUnitId: subject.implementationUnitId, dimensions: subject.assessments.map((entry) => entry.dimension) })))
    const evidenceReceiptDigest = canonicalDigest(input.subjects.map((subject) => ({ subjectId: subject.id, evidenceReferences: subject.evidenceReferences, assessments: subject.assessments.map((entry) => ({ dimension: entry.dimension, evidenceReferences: entry.evidenceReferences, conflictReferenceCandidates: entry.conflictReferenceCandidates, waiverReferenceCandidates: entry.waiverReferenceCandidates })) })))
    const ownershipReceiptDigest = canonicalDigest(input.subjects.map((subject) => ({ subjectId: subject.id, ownerCandidateIds: subject.ownerCandidateIds, reviewCandidateIds: subject.reviewCandidateIds })))
    const assessmentReceiptDigest = canonicalDigest({ context: input.context, dependencyReceiptDigest, coverageReceiptDigest, evidenceReceiptDigest, ownershipReceiptDigest,
      outcomes: input.subjects.map((subject) => ({ subjectId: subject.id, outcome: subject.outcome, dimensions: subject.assessments.map((entry) => ({ dimension: entry.dimension, outcome: entry.outcome, reviewCandidateIds: entry.reviewCandidateIds })) })),
      unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations, reviewState: input.reviewState,
      readinessDecisionState: input.readinessDecisionState, waiverDecisionState: input.waiverDecisionState,
      ownershipAppointmentState: input.ownershipAppointmentState, acceptanceDecisionState: input.acceptanceDecisionState,
      releaseReadinessState: input.releaseReadinessState, deploymentReadinessState: input.deploymentReadinessState,
      actionAuthorityState: input.actionAuthorityState })
    return { dependencyReceiptDigest, coverageReceiptDigest, evidenceReceiptDigest, ownershipReceiptDigest, assessmentReceiptDigest }
  }

  private dependencyReferences(input: ImplementationReadinessGateInput): Record<keyof ExactDependencies, ExactReference> {
    return Object.fromEntries(dependencyNames.map((name) => [name, input[name]])) as Record<keyof ExactDependencies, ExactReference>
  }
  private readDependencies(initiativeId: string): Promise<unknown>[] {
    return [this.backlogHierarchy.readCurrent(initiativeId), this.mvpSliceDefinition.readCurrent(initiativeId), this.prioritizationModel.readCurrent(initiativeId),
      this.acceptanceCriteria.readCurrent(initiativeId), this.definitionOfReady.readCurrent(initiativeId), this.definitionOfDone.readCurrent(initiativeId),
      this.implementationUnitModel.readCurrent(initiativeId), this.dependencyMapping.readCurrent(initiativeId), this.technologyProfile.readCurrent(initiativeId),
      this.boilerplateRegistry.readCurrent(initiativeId), this.boilerplateSelectionBinding.readCurrent(initiativeId), this.boilerplateCompatibilityValidation.readCurrent(initiativeId),
      this.designBaseline.readCurrent(initiativeId), this.designToCodeBindingRegistry.readCurrent(initiativeId), this.routeScreenComponentMapping.readCurrent(initiativeId),
      this.testMethodology.readCurrent(initiativeId), this.testInventory.readCurrent(initiativeId), this.highLevelDesign.readCurrent(initiativeId),
      this.riskRegister.readCurrent(initiativeId), this.securityPrivacyAssessment.readCurrent(initiativeId)]
  }
  private toDependencies(records: unknown[]): ExactDependencies | undefined {
    if (records.some((record) => !record)) return undefined
    return Object.fromEntries(dependencyNames.map((name, index) => [name, records[index]])) as unknown as ExactDependencies
  }
  private async requireExactDependencies(input: ImplementationReadinessGateInput): Promise<ExactDependencies> {
    const dependencies = this.toDependencies(await Promise.all(this.readDependencies(input.initiativeId)))
    if (!dependencies) throw new Error("Implementation Readiness Gate requires all 20 current governed dependencies")
    for (const name of dependencyNames) if (!sameReference(input[name], dependencies[name])) throw new Error(`Implementation Readiness Gate must reference the exact current ${name} candidate`)
    return dependencies
  }
  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Implementation Readiness Gate Initiative targets a different Product")
    if (canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) throw new Error("Implementation Readiness Gate must bind the exact current Product and Initiative revisions and digests")
  }
  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return { productRevision: revisionOf(product), productDigest: canonicalDigest(product), initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) }
  }
  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Implementation Readiness Gate is immutable`)
    return { product, initiative }
  }
  private async commitVersionedRecord(record: ImplementationReadinessGate, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({ writes: [this.governed(this.currentPath(record.id), record, implementationReadinessGateSchema),
      this.governed(this.historyPath(record.id, record.revision), record, implementationReadinessGateSchema)],
    audit: { eventType, actor: { kind: "human", id: actorId }, subjectId: record.id, payload: {
      initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record),
      dependencyReceiptDigest: record.dependencyReceiptDigest, coverageReceiptDigest: record.coverageReceiptDigest,
      evidenceReceiptDigest: record.evidenceReceiptDigest, ownershipReceiptDigest: record.ownershipReceiptDigest,
      assessmentReceiptDigest: record.assessmentReceiptDigest, predecessorDigest: record.predecessorDigest,
      dependencyCount: dependencyNames.length + record.subjects.length, subjectCount: record.subjects.length,
      outcomes: record.subjects.map((subject) => ({ subjectId: subject.id, implementationUnitId: subject.implementationUnitId, outcome: subject.outcome })),
      reviewState: record.reviewState, readinessDecisionState: record.readinessDecisionState, waiverDecisionState: record.waiverDecisionState,
      ownershipAppointmentState: record.ownershipAppointmentState, actionAuthorityState: record.actionAuthorityState, authorityBoundary: record.authorityBoundary,
    } } })
  }
  private currentPath(id: string): string { return this.repository.resolve("implementation-readiness-gates", `${id}.json`) }
  private historyPath(id: string, revision: number): string { return this.repository.resolve("implementation-readiness-gate-history", `implementation-readiness-gate-${id}-r${revision}.json`) }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string { const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data }
  private async assertIntegrity(): Promise<void> { const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed") }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error }
    if (names.length > inventoryLimit) throw new Error(`Implementation Readiness Gate directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => `${String((left as Record<string, unknown>).id ?? "")}:${String((left as Record<string, unknown>).revision ?? "")}`.localeCompare(`${String((right as Record<string, unknown>).id ?? "")}:${String((right as Record<string, unknown>).revision ?? "")}`))
  }
}
