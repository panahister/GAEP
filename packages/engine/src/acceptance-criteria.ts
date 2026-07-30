import { randomUUID } from "node:crypto"

import {
  acceptanceCriteriaInputSchema,
  acceptanceCriteriaProjectionSchema,
  acceptanceCriteriaSchema,
  acceptanceCriteriaStatusSchema,
  type AcceptanceCriteria,
  type AcceptanceCriteriaInput,
  type AcceptanceCriteriaProjection,
  type AcceptanceCriteriaStatus,
  type BacklogHierarchy,
  type BusinessContextBinding,
  type Initiative,
  type MvpSliceDefinition,
  type PrioritizationModel,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { BacklogHierarchyService } from "./backlog-hierarchy.js"
import type { MvpSliceDefinitionService } from "./mvp-slice-definition.js"
import type { PrioritizationModelService } from "./prioritization-model.js"
import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type SubjectNode = BacklogHierarchy["nodes"][number]

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: AcceptanceCriteria) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

interface CoverageAssessment {
  subjectCount: number
  coveredSubjectCount: number
  uncoveredSubjectCount: number
  requirementTraceCount: number
  uncoveredRequirementCount: number
  invalidCriterionCount: number
  subjectCatalog: Array<{ nodeId: string; key: string; level: "story" | "task"; ordinal: number }>
}

export class AcceptanceCriteriaService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly backlogHierarchy: BacklogHierarchyService,
    private readonly mvpSliceDefinition: MvpSliceDefinitionService,
    private readonly prioritizationModel: PrioritizationModelService,
  ) {}

  async create(inputValue: AcceptanceCriteriaInput, actorId: string): Promise<AcceptanceCriteria> {
    const input = acceptanceCriteriaInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input, initiative)
      const coverage = this.assessCoverage(input, dependencies.hierarchy, dependencies.mvp)
      this.requireValidCoverageDeclaration(input, coverage)
      if (await this.readCurrent(initiative.id)) throw new Error("An Initiative can have only one current Acceptance Criteria candidate")
      const now = new Date().toISOString()
      const record = acceptanceCriteriaSchema.parse({
        schemaVersion: 1,
        kind: "acceptance-criteria-candidate",
        id: randomUUID(),
        productId: product.id,
        ...input,
        initiativeId: initiative.id,
        revision: 1,
        subjectCatalogDigest: canonicalDigest(coverage.subjectCatalog),
        criterionCatalogDigest: canonicalDigest(input.criteria),
        verificationMethodCatalogDigest: canonicalDigest(input.verificationMethods),
        coverageDigest: this.coverageDigest(input),
        state: "candidate",
        createdBy: { kind: "human", id: actorId },
        updatedBy: { kind: "human", id: actorId },
        createdAt: now,
        updatedAt: now,
        authorityBoundary: "acceptance-criteria-is-a-versioned-structured-candidate-over-exact-mvp-story-task-and-requirement-traces-not-criterion-validity-completeness-requirement-satisfaction-priority-commitment-approval-ready-done-implementation-readiness-assignment-execution-acceptance-or-action-authority",
      })
      await this.commitVersionedRecord(record, coverage, "acceptance-criteria.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: AcceptanceCriteriaInput, actorId: string): Promise<AcceptanceCriteria> {
    const input = acceptanceCriteriaInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Acceptance Criteria revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Acceptance Criteria Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input, initiative)
      const coverage = this.assessCoverage(input, dependencies.hierarchy, dependencies.mvp)
      this.requireValidCoverageDeclaration(input, coverage)
      const record = acceptanceCriteriaSchema.parse({
        ...current,
        ...input,
        productId: product.id,
        initiativeId: initiative.id,
        revision: current.revision + 1,
        subjectCatalogDigest: canonicalDigest(coverage.subjectCatalog),
        criterionCatalogDigest: canonicalDigest(input.criteria),
        verificationMethodCatalogDigest: canonicalDigest(input.verificationMethods),
        coverageDigest: this.coverageDigest(input),
        predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId },
        updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, coverage, "acceptance-criteria.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<AcceptanceCriteria> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Acceptance Criteria ID")), acceptanceCriteriaSchema)
  }

  async readCurrent(initiativeId: string): Promise<AcceptanceCriteria | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("acceptance-criteria", currentRecordPattern, acceptanceCriteriaSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Acceptance Criteria candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<AcceptanceCriteria> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Acceptance Criteria history revision must be a positive integer")
    const recordId = this.requireUuid(id, "Acceptance Criteria ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), acceptanceCriteriaSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Acceptance Criteria history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<AcceptanceCriteria[]> {
    const recordId = this.requireUuid(id, "Acceptance Criteria ID")
    const records = await this.listRecords(
      "acceptance-criteria-history",
      new RegExp(`^acceptance-criteria-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      acceptanceCriteriaSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Acceptance Criteria history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<AcceptanceCriteriaStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, hierarchy, mvp, priority] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId),
      this.backlogHierarchy.readCurrent(targetId), this.mvpSliceDefinition.readCurrent(targetId),
      this.prioritizationModel.readCurrent(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const staleBindingCount = candidate && canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative)) ? 1 : 0
    const staleHierarchyCount = candidate && !this.matches(candidate.hierarchy, hierarchy) ? 1 : 0
    const staleMvpSliceDefinitionCount = candidate && !this.matches(candidate.mvpSliceDefinition, mvp) ? 1 : 0
    const stalePrioritizationModelCount = candidate && !this.matches(candidate.prioritizationModel, priority) ? 1 : 0
    const coverage = candidate && hierarchy && mvp
      ? this.assessCoverage(candidate, hierarchy, mvp)
      : { subjectCount: 0, coveredSubjectCount: 0, uncoveredSubjectCount: 0, requirementTraceCount: 0,
          uncoveredRequirementCount: 0, invalidCriterionCount: 0, subjectCatalog: [] }
    let invalidCriterionCount = coverage.invalidCriterionCount
    if (candidate && (candidate.subjectCatalogDigest !== canonicalDigest(coverage.subjectCatalog) ||
        candidate.criterionCatalogDigest !== canonicalDigest(candidate.criteria) ||
        candidate.verificationMethodCatalogDigest !== canonicalDigest(candidate.verificationMethods) ||
        candidate.coverageDigest !== this.coverageDigest(candidate))) invalidCriterionCount += 1
    const criterionCount = candidate?.criteria.length ?? 0
    const testableCriterionCount = candidate?.criteria.filter((criterion) => criterion.testabilityState === "candidate-testable").length ?? 0
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const criterionSetCompletenessState = candidate?.criterionSetCompletenessState ?? "not-assessed"
    const requirementCoverageState = candidate?.requirementCoverageState ?? "not-assessed"
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Acceptance Criteria candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind the exact current Product and Initiative")
    if (staleHierarchyCount > 0) reasons.push("The candidate does not bind the exact current Backlog Hierarchy")
    if (staleMvpSliceDefinitionCount > 0) reasons.push("The candidate does not bind the exact current MVP and Slice Definition")
    if (stalePrioritizationModelCount > 0) reasons.push("The candidate does not bind the exact current Prioritization Model")
    if (coverage.uncoveredSubjectCount > 0) reasons.push("One or more exact MVP Story or Task subjects lack candidate criteria")
    if (coverage.uncoveredRequirementCount > 0) reasons.push("One or more exact MVP Story or Task Requirement traces lack candidate criterion coverage")
    if (invalidCriterionCount > 0) reasons.push("One or more criteria, Requirement traces, subject bindings, or integrity digests are invalid")
    if (criterionCount - testableCriterionCount > 0) reasons.push("One or more criteria are not candidate-testable")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved Acceptance Criteria questions")
    if (candidate && (criterionSetCompletenessState !== "candidate-complete" || requirementCoverageState !== "candidate-complete")) {
      reasons.push("The candidate does not declare complete criterion-set and Requirement coverage")
    }
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return acceptanceCriteriaStatusSchema.parse({
      schemaVersion: 1,
      kind: "acceptance-criteria-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate), hierarchy: candidate.hierarchy,
        mvpSliceDefinition: candidate.mvpSliceDefinition, prioritizationModel: candidate.prioritizationModel } : {}),
      subjectCount: coverage.subjectCount,
      coveredSubjectCount: coverage.coveredSubjectCount,
      uncoveredSubjectCount: coverage.uncoveredSubjectCount,
      criterionCount,
      testableCriterionCount,
      unassessedCriterionCount: criterionCount - testableCriterionCount,
      requirementTraceCount: coverage.requirementTraceCount,
      uncoveredRequirementCount: coverage.uncoveredRequirementCount,
      verificationMethodCount: candidate?.verificationMethods.length ?? 0,
      staleBindingCount,
      staleHierarchyCount,
      staleMvpSliceDefinitionCount,
      stalePrioritizationModelCount,
      invalidCriterionCount,
      unresolvedQuestionCount,
      criterionSetCompletenessState,
      requirementCoverageState,
      reviewState,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary: "acceptance-criteria-status-is-observational-and-does-not-establish-criterion-validity-completeness-requirement-satisfaction-priority-commitment-approval-ready-done-implementation-readiness-assignment-execution-acceptance-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<AcceptanceCriteriaProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Acceptance Criteria projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "acceptance-criteria-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        subjectCatalogDigest: candidate.subjectCatalogDigest, criterionCatalogDigest: candidate.criterionCatalogDigest,
        verificationMethodCatalogDigest: candidate.verificationMethodCatalogDigest, coverageDigest: candidate.coverageDigest,
        subjectCount: status.subjectCount, criterionCount: candidate.criteria.length,
        testableCriterionCount: status.testableCriterionCount, requirementTraceCount: status.requirementTraceCount,
        verificationMethodCount: candidate.verificationMethods.length, reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary: "projection-contains-record-identities-counts-statuses-and-subject-criterion-method-coverage-snapshot-digests-only-not-criterion-text-requirement-identities-verification-evidence-personal-data-secrets-credentials-or-machine-paths" as const,
      authorityBoundary: "acceptance-criteria-projection-is-read-only-and-does-not-establish-criterion-validity-completeness-requirement-satisfaction-priority-commitment-approval-ready-done-implementation-readiness-assignment-execution-acceptance-or-action-authority" as const,
    }
    return acceptanceCriteriaProjectionSchema.parse({ ...projectionWithoutDigest, snapshotDigest: canonicalDigest(projectionWithoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("acceptance-criteria", currentRecordPattern, acceptanceCriteriaSchema)
    for (const candidate of records) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Acceptance Criteria candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleHierarchyCount > 0 || status.staleMvpSliceDefinitionCount > 0 ||
            status.stalePrioritizationModelCount > 0 || status.invalidCriterionCount > 0) {
          issues.push({
            code: "acceptance-criteria.binding-review-required", severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale or invalid Acceptance Criteria bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "acceptance-criteria.invalid", severity: "error",
          message: `Acceptance Criteria ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private coverageDigest(input: Pick<AcceptanceCriteriaInput, "criteria">): string {
    return canonicalDigest(input.criteria.map((criterion) => ({
      criterionId: criterion.id,
      subjectNodeId: criterion.subjectNodeId,
      requirementReferences: criterion.requirements,
      verificationMethodKeys: criterion.verificationMethodKeys,
      testabilityState: criterion.testabilityState,
    })))
  }

  private assessCoverage(input: Pick<AcceptanceCriteriaInput, "criteria">, hierarchy: BacklogHierarchy, mvp: MvpSliceDefinition): CoverageAssessment {
    const assigned = new Set(mvp.slices.flatMap((slice) => [...slice.storyNodeIds, ...slice.taskNodeIds]))
    const subjects = hierarchy.nodes.filter((node): node is SubjectNode & { level: "story" | "task" } =>
      assigned.has(node.id) && (node.level === "story" || node.level === "task"))
    const byId = new Map(subjects.map((node) => [node.id, node]))
    const coveredSubjects = new Set<string>()
    const coveredRequirements = new Set<string>()
    let invalidCriterionCount = 0
    for (const criterion of input.criteria) {
      const node = byId.get(criterion.subjectNodeId)
      if (!node || node.key !== criterion.subjectKey || node.level !== criterion.subjectLevel) {
        invalidCriterionCount += 1
        continue
      }
      coveredSubjects.add(node.id)
      const exactRequirements = new Map(node.requirements.map((reference) => [reference.recordId, reference]))
      for (const reference of criterion.requirements) {
        const exact = exactRequirements.get(reference.recordId)
        if (!exact || canonicalDigest(exact) !== canonicalDigest(reference)) invalidCriterionCount += 1
        else coveredRequirements.add(`${node.id}:${reference.recordId}`)
      }
    }
    const requirementTraceCount = subjects.reduce((total, node) => total + node.requirements.length, 0)
    return {
      subjectCount: subjects.length,
      coveredSubjectCount: coveredSubjects.size,
      uncoveredSubjectCount: subjects.length - coveredSubjects.size,
      requirementTraceCount,
      uncoveredRequirementCount: requirementTraceCount - coveredRequirements.size,
      invalidCriterionCount,
      subjectCatalog: subjects.map((node) => ({ nodeId: node.id, key: node.key, level: node.level, ordinal: node.ordinal })),
    }
  }

  private requireValidCoverageDeclaration(input: AcceptanceCriteriaInput, coverage: CoverageAssessment): void {
    if (coverage.invalidCriterionCount > 0) throw new Error("Acceptance Criteria must bind exact MVP Story or Task subjects and exact Requirement traces")
    if (input.criterionSetCompletenessState === "candidate-complete" && coverage.uncoveredSubjectCount > 0) {
      throw new Error("Candidate-complete Acceptance Criteria must cover every exact MVP Story and Task")
    }
    if (input.requirementCoverageState === "candidate-complete" && coverage.uncoveredRequirementCount > 0) {
      throw new Error("Candidate-complete Acceptance Criteria must cover every exact MVP Story and Task Requirement trace")
    }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Acceptance Criteria Initiative targets a different Product")
    if (canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) {
      throw new Error("Acceptance Criteria must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return { productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) }
  }

  private async requireExactDependencies(input: AcceptanceCriteriaInput, initiative: Initiative): Promise<{
    hierarchy: BacklogHierarchy; mvp: MvpSliceDefinition; priority: PrioritizationModel
  }> {
    const [hierarchy, mvp, priority] = await Promise.all([
      this.backlogHierarchy.readCurrent(initiative.id), this.mvpSliceDefinition.readCurrent(initiative.id),
      this.prioritizationModel.readCurrent(initiative.id),
    ])
    if (!this.matches(input.hierarchy, hierarchy)) throw new Error("Acceptance Criteria must reference the exact current Backlog Hierarchy candidate")
    if (!this.matches(input.mvpSliceDefinition, mvp)) throw new Error("Acceptance Criteria must reference the exact current MVP and Slice Definition candidate")
    if (!this.matches(input.prioritizationModel, priority)) throw new Error("Acceptance Criteria must reference the exact current Prioritization Model candidate")
    return { hierarchy: hierarchy!, mvp: mvp!, priority: priority! }
  }

  private matches(reference: { recordId: string; revision: number; digest: string }, record: { id: string; revision: number } | undefined): boolean {
    return !!record && record.id === reference.recordId && record.revision === reference.revision && canonicalDigest(record) === reference.digest
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Acceptance Criteria guidance is immutable`)
    return { product, initiative }
  }

  private async commitVersionedRecord(record: AcceptanceCriteria, coverage: CoverageAssessment, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, acceptanceCriteriaSchema),
        this.governed(this.historyPath(record.id, record.revision), record, acceptanceCriteriaSchema),
      ],
      audit: {
        eventType, actor: { kind: "human", id: actorId }, subjectId: record.id,
        payload: {
          initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record),
          subjectCatalogDigest: record.subjectCatalogDigest, criterionCatalogDigest: record.criterionCatalogDigest,
          verificationMethodCatalogDigest: record.verificationMethodCatalogDigest, coverageDigest: record.coverageDigest,
          predecessorDigest: record.predecessorDigest, hierarchy: record.hierarchy,
          mvpSliceDefinition: record.mvpSliceDefinition, prioritizationModel: record.prioritizationModel,
          subjectCount: coverage.subjectCount, criterionCount: record.criteria.length,
          testableCriterionCount: record.criteria.filter((criterion) => criterion.testabilityState === "candidate-testable").length,
          requirementTraceCount: coverage.requirementTraceCount, verificationMethodCount: record.verificationMethods.length,
          criterionSetCompletenessState: record.criterionSetCompletenessState,
          requirementCoverageState: record.requirementCoverageState, reviewState: record.reviewState,
          criterionValidityState: record.criterionValidityState, requirementSatisfactionState: record.requirementSatisfactionState,
          priorityDecisionState: record.priorityDecisionState, commitmentState: record.commitmentState,
          approvalState: record.approvalState, readyDoneState: record.readyDoneState,
          implementationReadinessState: record.implementationReadinessState,
          assignmentExecutionState: record.assignmentExecutionState, acceptanceDecisionState: record.acceptanceDecisionState,
          implementationAuthorityState: record.implementationAuthorityState, actionAuthorityState: "not-granted",
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string { return this.repository.resolve("acceptance-criteria", `${id}.json`) }
  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("acceptance-criteria-history", `acceptance-criteria-${id}-r${revision}.json`)
  }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string {
    const parsed = uuidSchema.safeParse(value)
    if (!parsed.success) throw new Error(`${label} must be a UUID`)
    return parsed.data
  }
  private async assertIntegrity(): Promise<void> {
    const integrity = await this.repository.verifyAudit()
    if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed")
  }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try {
      names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name))
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return []
      throw error
    }
    if (names.length > inventoryLimit) throw new Error(`Acceptance Criteria directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
