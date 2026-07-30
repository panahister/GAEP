import { randomUUID } from "node:crypto"

import {
  implementationUnitModelInputSchema,
  implementationUnitModelProjectionSchema,
  implementationUnitModelSchema,
  implementationUnitModelStatusSchema,
  type AcceptanceCriteria,
  type BacklogHierarchy,
  type BusinessContextBinding,
  type DefinitionOfDone,
  type DefinitionOfReady,
  type ImplementationUnitModel,
  type ImplementationUnitModelInput,
  type ImplementationUnitModelProjection,
  type ImplementationUnitModelStatus,
  type Initiative,
  type MvpSliceDefinition,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { AcceptanceCriteriaService } from "./acceptance-criteria.js"
import type { BacklogHierarchyService } from "./backlog-hierarchy.js"
import type { DefinitionOfDoneService } from "./definition-of-done.js"
import type { DefinitionOfReadyService } from "./definition-of-ready.js"
import type { MvpSliceDefinitionService } from "./mvp-slice-definition.js"
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

function exactReference(record: ImplementationUnitModel) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

interface UnitAssessment {
  subjectCatalog: SubjectNode[]
  missingSubjectCount: number
  invalidUnitCount: number
}

interface ExactDependencies {
  hierarchy: BacklogHierarchy
  mvp: MvpSliceDefinition
  criteria: AcceptanceCriteria
  ready: DefinitionOfReady
  done: DefinitionOfDone
}

export class ImplementationUnitModelService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly backlogHierarchy: BacklogHierarchyService,
    private readonly mvpSliceDefinition: MvpSliceDefinitionService,
    private readonly acceptanceCriteria: AcceptanceCriteriaService,
    private readonly definitionOfReady: DefinitionOfReadyService,
    private readonly definitionOfDone: DefinitionOfDoneService,
  ) {}

  async create(inputValue: ImplementationUnitModelInput, actorId: string): Promise<ImplementationUnitModel> {
    const input = implementationUnitModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input, initiative)
      const assessment = this.assessUnits(input, dependencies.hierarchy, dependencies.mvp)
      this.requireValidUnitBindings(input, assessment)
      if (await this.readCurrent(initiative.id)) throw new Error("An Initiative can have only one current Implementation Unit Model candidate")
      const now = new Date().toISOString()
      const record = implementationUnitModelSchema.parse({
        schemaVersion: 1,
        kind: "implementation-unit-model-candidate",
        id: randomUUID(),
        productId: product.id,
        ...input,
        initiativeId: initiative.id,
        revision: 1,
        ...this.composeDigests(input),
        state: "candidate",
        createdBy: { kind: "human", id: actorId },
        updatedBy: { kind: "human", id: actorId },
        createdAt: now,
        updatedAt: now,
        authorityBoundary: "implementation-unit-model-is-a-versioned-candidate-and-does-not-establish-repository-truth-ownership-appointment-dependency-or-impact-completeness-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority",
      })
      await this.commitVersionedRecord(record, assessment, "implementation-unit-model.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: ImplementationUnitModelInput, actorId: string): Promise<ImplementationUnitModel> {
    const input = implementationUnitModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Implementation Unit Model revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Implementation Unit Model Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input, initiative)
      const assessment = this.assessUnits(input, dependencies.hierarchy, dependencies.mvp)
      this.requireValidUnitBindings(input, assessment)
      const record = implementationUnitModelSchema.parse({
        ...current,
        ...input,
        productId: product.id,
        initiativeId: initiative.id,
        revision: current.revision + 1,
        ...this.composeDigests(input),
        predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId },
        updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, assessment, "implementation-unit-model.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<ImplementationUnitModel> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Implementation Unit Model ID")), implementationUnitModelSchema)
  }

  async readCurrent(initiativeId: string): Promise<ImplementationUnitModel | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("implementation-unit-models", currentRecordPattern, implementationUnitModelSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Implementation Unit Model candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<ImplementationUnitModel> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Implementation Unit Model history revision must be a positive integer")
    const recordId = this.requireUuid(id, "Implementation Unit Model ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), implementationUnitModelSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Implementation Unit Model history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<ImplementationUnitModel[]> {
    const recordId = this.requireUuid(id, "Implementation Unit Model ID")
    const records = await this.listRecords(
      "implementation-unit-model-history",
      new RegExp(`^implementation-unit-model-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      implementationUnitModelSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Implementation Unit Model history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<ImplementationUnitModelStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, hierarchy, mvp, criteria, ready, done] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId),
      this.backlogHierarchy.readCurrent(targetId), this.mvpSliceDefinition.readCurrent(targetId),
      this.acceptanceCriteria.readCurrent(targetId), this.definitionOfReady.readCurrent(targetId),
      this.definitionOfDone.readCurrent(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const staleBindingCount = candidate && canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative)) ? 1 : 0
    const staleHierarchyCount = candidate && !this.matches(candidate.hierarchy, hierarchy) ? 1 : 0
    const staleMvpSliceDefinitionCount = candidate && !this.matches(candidate.mvpSliceDefinition, mvp) ? 1 : 0
    const staleAcceptanceCriteriaCount = candidate && !this.matches(candidate.acceptanceCriteria, criteria) ? 1 : 0
    const staleDefinitionOfReadyCount = candidate && !this.matches(candidate.definitionOfReady, ready) ? 1 : 0
    const staleDefinitionOfDoneCount = candidate && !this.matches(candidate.definitionOfDone, done) ? 1 : 0
    const assessment = candidate && hierarchy && mvp
      ? this.assessUnits(candidate, hierarchy, mvp)
      : { subjectCatalog: [], missingSubjectCount: 0, invalidUnitCount: 0 }
    let invalidUnitCount = assessment.invalidUnitCount
    if (candidate) {
      const expectedDigests = this.composeDigests(candidate)
      if (candidate.membershipDigest !== expectedDigests.membershipDigest ||
          candidate.placementDigest !== expectedDigests.placementDigest ||
          candidate.assessmentReceiptDigest !== expectedDigests.assessmentReceiptDigest) invalidUnitCount += 1
    }
    const units = candidate?.units ?? []
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Implementation Unit Model candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind the exact current Product and Initiative")
    if (staleHierarchyCount > 0) reasons.push("The candidate does not bind the exact current Backlog Hierarchy")
    if (staleMvpSliceDefinitionCount > 0) reasons.push("The candidate does not bind the exact current MVP and Slice Definition")
    if (staleAcceptanceCriteriaCount > 0) reasons.push("The candidate does not bind the exact current Acceptance Criteria")
    if (staleDefinitionOfReadyCount > 0) reasons.push("The candidate does not bind the exact current Definition of Ready")
    if (staleDefinitionOfDoneCount > 0) reasons.push("The candidate does not bind the exact current Definition of Done")
    if (assessment.missingSubjectCount > 0) reasons.push("One or more exact MVP Story or Task subjects are not assigned to an implementation unit")
    if (invalidUnitCount > 0) reasons.push("One or more unit memberships, Requirement references, dependencies, or integrity digests are invalid")
    if (units.some((unit) => unit.blastRadius.assessmentState !== "candidate-assessed")) reasons.push("One or more implementation-unit blast radii are not assessed")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved Implementation Unit Model questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return implementationUnitModelStatusSchema.parse({
      schemaVersion: 1,
      kind: "implementation-unit-model-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? {
        candidate: exactReference(candidate), hierarchy: candidate.hierarchy,
        mvpSliceDefinition: candidate.mvpSliceDefinition, acceptanceCriteria: candidate.acceptanceCriteria,
        definitionOfReady: candidate.definitionOfReady, definitionOfDone: candidate.definitionOfDone,
      } : {}),
      unitCount: units.length,
      subjectCount: units.reduce((count, unit) => count + unit.subjectNodeIds.length, 0),
      requirementReferenceCount: units.reduce((count, unit) => count + unit.requirementReferences.length, 0),
      repositoryCandidateCount: units.length,
      ownerCandidateCount: units.length,
      dependencyEdgeCount: units.reduce((count, unit) => count + unit.dependencyUnitIds.length, 0),
      candidateAssessedBlastRadiusCount: units.filter((unit) => unit.blastRadius.assessmentState === "candidate-assessed").length,
      notAssessedBlastRadiusCount: units.filter((unit) => unit.blastRadius.assessmentState === "not-assessed").length,
      missingSubjectCount: assessment.missingSubjectCount,
      invalidUnitCount,
      staleBindingCount,
      staleHierarchyCount,
      staleMvpSliceDefinitionCount,
      staleAcceptanceCriteriaCount,
      staleDefinitionOfReadyCount,
      staleDefinitionOfDoneCount,
      unresolvedQuestionCount,
      reviewState,
      state: reasons.length === 0 ? "candidate-complete" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary: "implementation-unit-model-status-is-observational-and-does-not-establish-repository-truth-ownership-appointment-dependency-or-impact-completeness-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<ImplementationUnitModelProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Implementation Unit Model projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "implementation-unit-model-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        membershipDigest: candidate.membershipDigest, placementDigest: candidate.placementDigest,
        assessmentReceiptDigest: candidate.assessmentReceiptDigest, unitCount: candidate.units.length,
        subjectCount: status.subjectCount, requirementReferenceCount: status.requirementReferenceCount,
        reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary: "projection-contains-record-identities-counts-statuses-and-membership-placement-assessment-snapshot-digests-only-not-unit-titles-boundaries-subject-or-requirement-identities-repository-keys-module-paths-owner-identities-evidence-rationales-personal-data-secrets-credentials-or-machine-paths" as const,
      authorityBoundary: "implementation-unit-model-projection-is-read-only-and-does-not-establish-repository-truth-ownership-appointment-dependency-or-impact-completeness-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority" as const,
    }
    return implementationUnitModelProjectionSchema.parse({ ...projectionWithoutDigest, snapshotDigest: canonicalDigest(projectionWithoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("implementation-unit-models", currentRecordPattern, implementationUnitModelSchema)
    for (const candidate of records) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Implementation Unit Model candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount + status.staleHierarchyCount + status.staleMvpSliceDefinitionCount +
            status.staleAcceptanceCriteriaCount + status.staleDefinitionOfReadyCount + status.staleDefinitionOfDoneCount +
            status.invalidUnitCount > 0) {
          issues.push({
            code: "implementation-unit-model.binding-review-required", severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale or invalid Implementation Unit Model bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "implementation-unit-model.invalid", severity: "error",
          message: `Implementation Unit Model ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private assessUnits(input: Pick<ImplementationUnitModelInput, "units">, hierarchy: BacklogHierarchy, mvp: MvpSliceDefinition): UnitAssessment {
    const assigned = new Set(mvp.slices.flatMap((slice) => [...slice.storyNodeIds, ...slice.taskNodeIds]))
    const subjects = hierarchy.nodes.filter((node): node is SubjectNode =>
      assigned.has(node.id) && (node.level === "story" || node.level === "task"))
    const subjectById = new Map(subjects.map((node) => [node.id, node]))
    const seen = new Set<string>()
    let invalidUnitCount = 0
    for (const unit of input.units) {
      let invalid = false
      const expectedRequirements = new Map<string, SubjectNode["requirements"][number]>()
      for (const subjectId of unit.subjectNodeIds) {
        const subject = subjectById.get(subjectId)
        if (!subject || seen.has(subjectId)) invalid = true
        if (subject) for (const requirement of subject.requirements) expectedRequirements.set(requirement.recordId, requirement)
        seen.add(subjectId)
      }
      const actualRequirements = new Map(unit.requirementReferences.map((reference) => [reference.recordId, reference]))
      if (actualRequirements.size !== expectedRequirements.size || [...expectedRequirements].some(([id, reference]) => {
        const actual = actualRequirements.get(id)
        return !actual || canonicalDigest(actual) !== canonicalDigest(reference)
      })) invalid = true
      if (invalid) invalidUnitCount += 1
    }
    return {
      subjectCatalog: subjects,
      missingSubjectCount: subjects.filter((subject) => !seen.has(subject.id)).length,
      invalidUnitCount,
    }
  }

  private requireValidUnitBindings(input: ImplementationUnitModelInput, assessment: UnitAssessment): void {
    if (assessment.invalidUnitCount > 0) {
      throw new Error("Implementation units must bind exact MVP Story or Task subjects and their exact Requirement references")
    }
    if (input.reviewState === "ready-for-human-review" && assessment.missingSubjectCount > 0) {
      throw new Error("Review-ready Implementation Unit Model must assign every exact MVP Story and Task")
    }
  }

  private composeDigests(input: ImplementationUnitModelInput) {
    const membershipDigest = canonicalDigest(input.units.map((unit) => ({
      id: unit.id, ordinal: unit.ordinal, key: unit.key, kind: unit.kind,
      subjectNodeIds: unit.subjectNodeIds, requirementReferences: unit.requirementReferences,
    })))
    const placementDigest = canonicalDigest(input.units.map((unit) => ({
      id: unit.id, repository: unit.repository, ownerCandidate: unit.ownerCandidate,
      dependencyUnitIds: unit.dependencyUnitIds, blastRadius: unit.blastRadius,
    })))
    const assessmentReceiptDigest = canonicalDigest({
      context: input.context, hierarchy: input.hierarchy, mvpSliceDefinition: input.mvpSliceDefinition,
      acceptanceCriteria: input.acceptanceCriteria, definitionOfReady: input.definitionOfReady,
      definitionOfDone: input.definitionOfDone, membershipDigest, placementDigest,
      reviewState: input.reviewState, unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations,
      repositoryTruthState: input.repositoryTruthState, ownershipAppointmentState: input.ownershipAppointmentState,
      dependencyCompletenessState: input.dependencyCompletenessState, impactCompletenessState: input.impactCompletenessState,
      implementationReadinessState: input.implementationReadinessState,
      implementationCompletenessState: input.implementationCompletenessState,
      assignmentExecutionState: input.assignmentExecutionState, approvalState: input.approvalState,
      acceptanceDecisionState: input.acceptanceDecisionState, mergeReadinessState: input.mergeReadinessState,
      releaseReadinessState: input.releaseReadinessState, deploymentReadinessState: input.deploymentReadinessState,
      actionAuthorityState: input.actionAuthorityState,
    })
    return { membershipDigest, placementDigest, assessmentReceiptDigest }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Implementation Unit Model Initiative targets a different Product")
    if (canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) {
      throw new Error("Implementation Unit Model must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
  }

  private async requireExactDependencies(input: ImplementationUnitModelInput, initiative: Initiative): Promise<ExactDependencies> {
    const [hierarchy, mvp, criteria, ready, done] = await Promise.all([
      this.backlogHierarchy.readCurrent(initiative.id), this.mvpSliceDefinition.readCurrent(initiative.id),
      this.acceptanceCriteria.readCurrent(initiative.id), this.definitionOfReady.readCurrent(initiative.id),
      this.definitionOfDone.readCurrent(initiative.id),
    ])
    if (!this.matches(input.hierarchy, hierarchy)) throw new Error("Implementation Unit Model must reference the exact current Backlog Hierarchy candidate")
    if (!this.matches(input.mvpSliceDefinition, mvp)) throw new Error("Implementation Unit Model must reference the exact current MVP and Slice Definition candidate")
    if (!this.matches(input.acceptanceCriteria, criteria)) throw new Error("Implementation Unit Model must reference the exact current Acceptance Criteria candidate")
    if (!this.matches(input.definitionOfReady, ready)) throw new Error("Implementation Unit Model must reference the exact current Definition of Ready candidate")
    if (!this.matches(input.definitionOfDone, done)) throw new Error("Implementation Unit Model must reference the exact current Definition of Done candidate")
    return { hierarchy: hierarchy!, mvp: mvp!, criteria: criteria!, ready: ready!, done: done! }
  }

  private matches(reference: { recordId: string; revision: number; digest: string }, record: { id: string; revision: number } | undefined): boolean {
    return !!record && record.id === reference.recordId && record.revision === reference.revision && canonicalDigest(record) === reference.digest
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Implementation Unit Model is immutable`)
    return { product, initiative }
  }

  private async commitVersionedRecord(record: ImplementationUnitModel, assessment: UnitAssessment, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, implementationUnitModelSchema),
        this.governed(this.historyPath(record.id, record.revision), record, implementationUnitModelSchema),
      ],
      audit: {
        eventType, actor: { kind: "human", id: actorId }, subjectId: record.id,
        payload: {
          initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record),
          membershipDigest: record.membershipDigest, placementDigest: record.placementDigest,
          assessmentReceiptDigest: record.assessmentReceiptDigest, predecessorDigest: record.predecessorDigest,
          hierarchy: record.hierarchy, mvpSliceDefinition: record.mvpSliceDefinition,
          acceptanceCriteria: record.acceptanceCriteria, definitionOfReady: record.definitionOfReady,
          definitionOfDone: record.definitionOfDone, unitCount: record.units.length,
          subjectCount: assessment.subjectCatalog.length,
          requirementReferenceCount: record.units.reduce((count, unit) => count + unit.requirementReferences.length, 0),
          reviewState: record.reviewState, repositoryTruthState: record.repositoryTruthState,
          ownershipAppointmentState: record.ownershipAppointmentState,
          dependencyCompletenessState: record.dependencyCompletenessState,
          impactCompletenessState: record.impactCompletenessState,
          implementationReadinessState: record.implementationReadinessState,
          implementationCompletenessState: record.implementationCompletenessState,
          assignmentExecutionState: record.assignmentExecutionState, approvalState: record.approvalState,
          acceptanceDecisionState: record.acceptanceDecisionState, mergeReadinessState: record.mergeReadinessState,
          releaseReadinessState: record.releaseReadinessState, deploymentReadinessState: record.deploymentReadinessState,
          actionAuthorityState: record.actionAuthorityState, authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string { return this.repository.resolve("implementation-unit-models", `${id}.json`) }
  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("implementation-unit-model-history", `implementation-unit-model-${id}-r${revision}.json`)
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
    if (names.length > inventoryLimit) throw new Error(`Implementation Unit Model directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
