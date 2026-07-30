import { randomUUID } from "node:crypto"

import {
  definitionOfReadyInputSchema,
  definitionOfReadyProjectionSchema,
  definitionOfReadySchema,
  definitionOfReadyStatusSchema,
  type AcceptanceCriteria,
  type BacklogHierarchy,
  type BusinessContextBinding,
  type DefinitionOfReady,
  type DefinitionOfReadyInput,
  type DefinitionOfReadyProjection,
  type DefinitionOfReadyStatus,
  type Initiative,
  type MvpSliceDefinition,
  type PrioritizationModel,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { AcceptanceCriteriaService } from "./acceptance-criteria.js"
import type { BacklogHierarchyService } from "./backlog-hierarchy.js"
import type { MvpSliceDefinitionService } from "./mvp-slice-definition.js"
import type { PrioritizationModelService } from "./prioritization-model.js"
import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type SubjectNode = BacklogHierarchy["nodes"][number] & { level: "story" | "task" }

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: DefinitionOfReady) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

interface EvaluationAssessment {
  subjectCatalog: Array<{ nodeId: string; key: string; level: "story" | "task"; ordinal: number }>
  expectedEvaluationCount: number
  missingEvaluationCount: number
  invalidEvaluationCount: number
}

export class DefinitionOfReadyService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly backlogHierarchy: BacklogHierarchyService,
    private readonly mvpSliceDefinition: MvpSliceDefinitionService,
    private readonly prioritizationModel: PrioritizationModelService,
    private readonly acceptanceCriteria: AcceptanceCriteriaService,
  ) {}

  async create(inputValue: DefinitionOfReadyInput, actorId: string): Promise<DefinitionOfReady> {
    const input = definitionOfReadyInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input, initiative)
      const assessment = this.assessEvaluations(input, dependencies.hierarchy, dependencies.mvp)
      this.requireValidEvaluationBindings(input, assessment)
      if (await this.readCurrent(initiative.id)) throw new Error("An Initiative can have only one current Definition of Ready candidate")
      const now = new Date().toISOString()
      const digests = this.composeDigests(input, assessment.subjectCatalog)
      const record = definitionOfReadySchema.parse({
        schemaVersion: 1,
        kind: "definition-of-ready-candidate",
        id: randomUUID(),
        productId: product.id,
        ...input,
        initiativeId: initiative.id,
        revision: 1,
        ...digests,
        state: "candidate",
        createdBy: { kind: "human", id: actorId },
        updatedBy: { kind: "human", id: actorId },
        createdAt: now,
        updatedAt: now,
        gateBoundary: "a-passing-definition-of-ready-candidate-is-an-evaluation-result-not-admission-readiness-assignment-execution-or-implementation-permission",
        authorityBoundary: "definition-of-ready-is-a-versioned-item-evaluation-candidate-and-does-not-establish-prerequisite-truth-criterion-validity-completeness-requirement-satisfaction-priority-commitment-approval-ready-done-exception-waiver-authority-phase-entry-implementation-readiness-assignment-execution-acceptance-or-action-authority",
      })
      await this.commitVersionedRecord(record, assessment, "definition-of-ready.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: DefinitionOfReadyInput, actorId: string): Promise<DefinitionOfReady> {
    const input = definitionOfReadyInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Definition of Ready revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Definition of Ready Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input, initiative)
      const assessment = this.assessEvaluations(input, dependencies.hierarchy, dependencies.mvp)
      this.requireValidEvaluationBindings(input, assessment)
      const record = definitionOfReadySchema.parse({
        ...current,
        ...input,
        productId: product.id,
        initiativeId: initiative.id,
        revision: current.revision + 1,
        ...this.composeDigests(input, assessment.subjectCatalog),
        predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId },
        updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, assessment, "definition-of-ready.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<DefinitionOfReady> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Definition of Ready ID")), definitionOfReadySchema)
  }

  async readCurrent(initiativeId: string): Promise<DefinitionOfReady | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("definition-of-ready", currentRecordPattern, definitionOfReadySchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Definition of Ready candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<DefinitionOfReady> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Definition of Ready history revision must be a positive integer")
    const recordId = this.requireUuid(id, "Definition of Ready ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), definitionOfReadySchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Definition of Ready history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<DefinitionOfReady[]> {
    const recordId = this.requireUuid(id, "Definition of Ready ID")
    const records = await this.listRecords(
      "definition-of-ready-history",
      new RegExp(`^definition-of-ready-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      definitionOfReadySchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Definition of Ready history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<DefinitionOfReadyStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, hierarchy, mvp, priority, criteria] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId),
      this.backlogHierarchy.readCurrent(targetId), this.mvpSliceDefinition.readCurrent(targetId),
      this.prioritizationModel.readCurrent(targetId), this.acceptanceCriteria.readCurrent(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const staleBindingCount = candidate && canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative)) ? 1 : 0
    const staleHierarchyCount = candidate && !this.matches(candidate.hierarchy, hierarchy) ? 1 : 0
    const staleMvpSliceDefinitionCount = candidate && !this.matches(candidate.mvpSliceDefinition, mvp) ? 1 : 0
    const stalePrioritizationModelCount = candidate && !this.matches(candidate.prioritizationModel, priority) ? 1 : 0
    const staleAcceptanceCriteriaCount = candidate && !this.matches(candidate.acceptanceCriteria, criteria) ? 1 : 0
    const evaluationAssessment = candidate && hierarchy && mvp
      ? this.assessEvaluations(candidate, hierarchy, mvp)
      : { subjectCatalog: [], expectedEvaluationCount: 0, missingEvaluationCount: 0, invalidEvaluationCount: 0 }
    let invalidEvaluationCount = evaluationAssessment.invalidEvaluationCount
    if (candidate) {
      const expectedDigests = this.composeDigests(candidate, evaluationAssessment.subjectCatalog)
      if (candidate.subjectCatalogDigest !== expectedDigests.subjectCatalogDigest ||
          candidate.policyDigest !== expectedDigests.policyDigest || candidate.evaluationDigest !== expectedDigests.evaluationDigest ||
          candidate.receiptDigest !== expectedDigests.receiptDigest) invalidEvaluationCount += 1
    }
    const evaluations = candidate?.itemEvaluations ?? []
    const count = (state: DefinitionOfReadyInput["itemEvaluations"][number]["assessmentState"]) =>
      evaluations.filter((entry) => entry.assessmentState === state).length
    const candidateSatisfiedCount = count("candidate-satisfied")
    const notSatisfiedCount = count("candidate-not-satisfied")
    const exceptionCandidateCount = count("exception-candidate")
    const notAssessedCount = count("not-assessed")
    const staleEvaluationCount = count("stale")
    invalidEvaluationCount += count("invalid")
    const expiredCount = candidate && Date.parse(candidate.validUntil) <= Date.now() ? 1 : 0
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Definition of Ready candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind the exact current Product and Initiative")
    if (staleHierarchyCount > 0) reasons.push("The candidate does not bind the exact current Backlog Hierarchy")
    if (staleMvpSliceDefinitionCount > 0) reasons.push("The candidate does not bind the exact current MVP and Slice Definition")
    if (stalePrioritizationModelCount > 0) reasons.push("The candidate does not bind the exact current Prioritization Model")
    if (staleAcceptanceCriteriaCount > 0) reasons.push("The candidate does not bind the exact current Acceptance Criteria")
    if (evaluationAssessment.missingEvaluationCount > 0) reasons.push("One or more exact MVP Story or Task prerequisite evaluations are missing")
    if (invalidEvaluationCount > 0) reasons.push("One or more item evaluations, subject bindings, prerequisites, or integrity digests are invalid")
    if (notSatisfiedCount > 0) reasons.push("One or more required prerequisites are candidate-not-satisfied")
    if (exceptionCandidateCount > 0) reasons.push("One or more prerequisites depend on an exception candidate without waiver authority")
    if (notAssessedCount > 0) reasons.push("One or more prerequisites are not assessed")
    if (staleEvaluationCount > 0) reasons.push("One or more prerequisite evaluations are stale")
    if (expiredCount > 0) reasons.push("The Definition of Ready evaluation receipt has expired")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved Definition of Ready questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return definitionOfReadyStatusSchema.parse({
      schemaVersion: 1,
      kind: "definition-of-ready-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? {
        candidate: exactReference(candidate), hierarchy: candidate.hierarchy, mvpSliceDefinition: candidate.mvpSliceDefinition,
        prioritizationModel: candidate.prioritizationModel, acceptanceCriteria: candidate.acceptanceCriteria,
      } : {}),
      subjectCount: evaluationAssessment.subjectCatalog.length,
      policyEntryCount: candidate?.policyEntries.length ?? 0,
      expectedEvaluationCount: evaluationAssessment.expectedEvaluationCount,
      evaluationCount: evaluations.length,
      candidateSatisfiedCount,
      notSatisfiedCount,
      notApplicableCount: evaluations.filter((entry) => entry.applicability === "not-applicable-candidate").length,
      exceptionCandidateCount,
      notAssessedCount,
      staleEvaluationCount,
      invalidEvaluationCount,
      missingEvaluationCount: evaluationAssessment.missingEvaluationCount,
      staleBindingCount,
      staleHierarchyCount,
      staleMvpSliceDefinitionCount,
      stalePrioritizationModelCount,
      staleAcceptanceCriteriaCount,
      expiredCount,
      unresolvedQuestionCount,
      reviewState,
      result: reasons.length === 0 ? "candidate-passed" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      gateBoundary: "a-passing-definition-of-ready-candidate-is-an-evaluation-result-not-admission-readiness-assignment-execution-or-implementation-permission",
      authorityBoundary: "definition-of-ready-status-is-observational-and-does-not-establish-prerequisite-truth-criterion-validity-completeness-requirement-satisfaction-priority-commitment-approval-ready-done-exception-waiver-authority-phase-entry-implementation-readiness-assignment-execution-acceptance-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<DefinitionOfReadyProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Definition of Ready projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "definition-of-ready-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        policyVersion: candidate.policyVersion, validUntil: candidate.validUntil,
        subjectCatalogDigest: candidate.subjectCatalogDigest, policyDigest: candidate.policyDigest,
        evaluationDigest: candidate.evaluationDigest, receiptDigest: candidate.receiptDigest,
        subjectCount: status.subjectCount, policyEntryCount: candidate.policyEntries.length,
        evaluationCount: candidate.itemEvaluations.length, reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary: "projection-contains-record-identities-counts-statuses-and-policy-evaluation-receipt-snapshot-digests-only-not-rules-rationales-evidence-identities-assessor-identities-personal-data-secrets-credentials-or-machine-paths" as const,
      gateBoundary: "a-passing-definition-of-ready-candidate-is-an-evaluation-result-not-admission-readiness-assignment-execution-or-implementation-permission" as const,
      authorityBoundary: "definition-of-ready-projection-is-read-only-and-does-not-establish-prerequisite-truth-criterion-validity-completeness-requirement-satisfaction-priority-commitment-approval-ready-done-exception-waiver-authority-phase-entry-implementation-readiness-assignment-execution-acceptance-or-action-authority" as const,
    }
    return definitionOfReadyProjectionSchema.parse({ ...projectionWithoutDigest, snapshotDigest: canonicalDigest(projectionWithoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("definition-of-ready", currentRecordPattern, definitionOfReadySchema)
    for (const candidate of records) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Definition of Ready candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount + status.staleHierarchyCount + status.staleMvpSliceDefinitionCount +
            status.stalePrioritizationModelCount + status.staleAcceptanceCriteriaCount + status.invalidEvaluationCount +
            status.expiredCount > 0) {
          issues.push({
            code: "definition-of-ready.binding-review-required", severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale, expired, or invalid Definition of Ready bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "definition-of-ready.invalid", severity: "error",
          message: `Definition of Ready ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private assessEvaluations(
    input: Pick<DefinitionOfReadyInput, "itemEvaluations" | "policyEntries">,
    hierarchy: BacklogHierarchy,
    mvp: MvpSliceDefinition,
  ): EvaluationAssessment {
    const assigned = new Set(mvp.slices.flatMap((slice) => [...slice.storyNodeIds, ...slice.taskNodeIds]))
    const subjects = hierarchy.nodes.filter((node): node is SubjectNode =>
      assigned.has(node.id) && (node.level === "story" || node.level === "task"))
    const subjectById = new Map(subjects.map((node) => [node.id, node]))
    const policyByKey = new Map(input.policyEntries.map((entry) => [entry.key, entry]))
    const expectedPairs = new Set(subjects.flatMap((subject) =>
      input.policyEntries.map((policy) => `${subject.id}:${policy.key}`)))
    let invalidEvaluationCount = 0
    for (const evaluation of input.itemEvaluations) {
      const subject = subjectById.get(evaluation.subjectNodeId)
      const policy = policyByKey.get(evaluation.prerequisiteKey)
      const pair = `${evaluation.subjectNodeId}:${evaluation.prerequisiteKey}`
      if (!subject || subject.key !== evaluation.subjectKey || subject.level !== evaluation.subjectLevel ||
          !policy || !expectedPairs.delete(pair)) invalidEvaluationCount += 1
    }
    return {
      subjectCatalog: subjects.map((node) => ({ nodeId: node.id, key: node.key, level: node.level, ordinal: node.ordinal })),
      expectedEvaluationCount: subjects.length * input.policyEntries.length,
      missingEvaluationCount: expectedPairs.size,
      invalidEvaluationCount,
    }
  }

  private requireValidEvaluationBindings(input: DefinitionOfReadyInput, assessment: EvaluationAssessment): void {
    if (assessment.invalidEvaluationCount > 0) {
      throw new Error("Definition of Ready evaluations must bind exact MVP Story or Task subjects and declared policy prerequisites")
    }
    if (input.reviewState === "ready-for-human-review" && assessment.missingEvaluationCount > 0) {
      throw new Error("Review-ready Definition of Ready must evaluate every policy prerequisite for every exact MVP Story and Task")
    }
  }

  private composeDigests(input: DefinitionOfReadyInput, subjectCatalog: EvaluationAssessment["subjectCatalog"]) {
    const subjectCatalogDigest = canonicalDigest(subjectCatalog)
    const policyDigest = canonicalDigest({ policyVersion: input.policyVersion, policyEntries: input.policyEntries })
    const evaluationDigest = canonicalDigest(input.itemEvaluations)
    const receiptDigest = canonicalDigest({
      context: input.context,
      hierarchy: input.hierarchy,
      mvpSliceDefinition: input.mvpSliceDefinition,
      prioritizationModel: input.prioritizationModel,
      acceptanceCriteria: input.acceptanceCriteria,
      subjectCatalogDigest,
      policyDigest,
      evaluationDigest,
      validUntil: input.validUntil,
    })
    return { subjectCatalogDigest, policyDigest, evaluationDigest, receiptDigest }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Definition of Ready Initiative targets a different Product")
    if (canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) {
      throw new Error("Definition of Ready must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
  }

  private async requireExactDependencies(input: DefinitionOfReadyInput, initiative: Initiative): Promise<{
    hierarchy: BacklogHierarchy; mvp: MvpSliceDefinition; priority: PrioritizationModel; criteria: AcceptanceCriteria
  }> {
    const [hierarchy, mvp, priority, criteria] = await Promise.all([
      this.backlogHierarchy.readCurrent(initiative.id), this.mvpSliceDefinition.readCurrent(initiative.id),
      this.prioritizationModel.readCurrent(initiative.id), this.acceptanceCriteria.readCurrent(initiative.id),
    ])
    if (!this.matches(input.hierarchy, hierarchy)) throw new Error("Definition of Ready must reference the exact current Backlog Hierarchy candidate")
    if (!this.matches(input.mvpSliceDefinition, mvp)) throw new Error("Definition of Ready must reference the exact current MVP and Slice Definition candidate")
    if (!this.matches(input.prioritizationModel, priority)) throw new Error("Definition of Ready must reference the exact current Prioritization Model candidate")
    if (!this.matches(input.acceptanceCriteria, criteria)) throw new Error("Definition of Ready must reference the exact current Acceptance Criteria candidate")
    return { hierarchy: hierarchy!, mvp: mvp!, priority: priority!, criteria: criteria! }
  }

  private matches(reference: { recordId: string; revision: number; digest: string }, record: { id: string; revision: number } | undefined): boolean {
    return !!record && record.id === reference.recordId && record.revision === reference.revision && canonicalDigest(record) === reference.digest
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Definition of Ready guidance is immutable`)
    return { product, initiative }
  }

  private async commitVersionedRecord(record: DefinitionOfReady, assessment: EvaluationAssessment, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, definitionOfReadySchema),
        this.governed(this.historyPath(record.id, record.revision), record, definitionOfReadySchema),
      ],
      audit: {
        eventType, actor: { kind: "human", id: actorId }, subjectId: record.id,
        payload: {
          initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record),
          subjectCatalogDigest: record.subjectCatalogDigest, policyDigest: record.policyDigest,
          evaluationDigest: record.evaluationDigest, receiptDigest: record.receiptDigest,
          predecessorDigest: record.predecessorDigest, hierarchy: record.hierarchy,
          mvpSliceDefinition: record.mvpSliceDefinition, prioritizationModel: record.prioritizationModel,
          acceptanceCriteria: record.acceptanceCriteria, policyVersion: record.policyVersion,
          subjectCount: assessment.subjectCatalog.length, policyEntryCount: record.policyEntries.length,
          expectedEvaluationCount: assessment.expectedEvaluationCount, evaluationCount: record.itemEvaluations.length,
          validUntil: record.validUntil, reviewState: record.reviewState,
          prerequisiteTruthState: record.prerequisiteTruthState, criterionValidityState: record.criterionValidityState,
          requirementSatisfactionState: record.requirementSatisfactionState, priorityDecisionState: record.priorityDecisionState,
          commitmentState: record.commitmentState, approvalState: record.approvalState, readyDoneState: record.readyDoneState,
          exceptionWaiverAuthorityState: record.exceptionWaiverAuthorityState, phaseEntryState: record.phaseEntryState,
          implementationReadinessState: record.implementationReadinessState,
          assignmentExecutionState: record.assignmentExecutionState, acceptanceDecisionState: record.acceptanceDecisionState,
          implementationAuthorityState: record.implementationAuthorityState, actionAuthorityState: "not-granted",
          gateBoundary: record.gateBoundary, authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string { return this.repository.resolve("definition-of-ready", `${id}.json`) }
  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("definition-of-ready-history", `definition-of-ready-${id}-r${revision}.json`)
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
    if (names.length > inventoryLimit) throw new Error(`Definition of Ready directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
