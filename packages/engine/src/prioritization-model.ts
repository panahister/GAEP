import { randomUUID } from "node:crypto"

import {
  prioritizationModelInputSchema,
  prioritizationModelProjectionSchema,
  prioritizationModelSchema,
  prioritizationModelStatusSchema,
  type BusinessContextBinding,
  type Initiative,
  type MvpSliceDefinition,
  type PrioritizationModel,
  type PrioritizationModelInput,
  type PrioritizationModelProjection,
  type PrioritizationModelStatus,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { MvpSliceDefinitionService } from "./mvp-slice-definition.js"
import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: PrioritizationModel) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000
}

function computeScores(input: PrioritizationModelInput): PrioritizationModel["scoreCandidates"] {
  const candidates = input.subjects.map((subject) => {
    const estimates = [subject.value, subject.riskReduction, subject.dependencyEnablement, subject.costSize]
    const base = {
      sliceId: subject.sliceId,
      sliceKey: subject.sliceKey,
      ordinal: subject.ordinal,
      inputDigest: canonicalDigest(subject),
    }
    if (estimates.some((estimate) => estimate.state === "not-assessed")) {
      return { ...base, state: "not-assessed" as const }
    }
    const weights = input.method.weights
    const score = (
      subject.value.score! * weights.value +
      subject.riskReduction.score! * weights.riskReduction +
      subject.dependencyEnablement.score! * weights.dependencyEnablement +
      (100 - subject.costSize.score!) * weights.costSize
    ) / 100
    return { ...base, state: "candidate-score" as const, score: round4(score) }
  })
  const ranked = candidates
    .filter((candidate): candidate is typeof candidate & { score: number } => candidate.state === "candidate-score")
    .sort((left, right) => right.score - left.score || left.ordinal - right.ordinal)
  const ranks = new Map(ranked.map((candidate, index) => [candidate.sliceId, index + 1]))
  return candidates.map((candidate) => candidate.state === "candidate-score"
    ? { ...candidate, rank: ranks.get(candidate.sliceId)! }
    : candidate)
}

export class PrioritizationModelService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly mvpSliceDefinition: MvpSliceDefinitionService,
  ) {}

  async create(inputValue: PrioritizationModelInput, actorId: string): Promise<PrioritizationModel> {
    const input = prioritizationModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const mvp = await this.requireExactMvp(input, initiative)
      this.requireExactSubjects(input, mvp)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Prioritization Model candidate")
      }
      const now = new Date().toISOString()
      const scores = computeScores(input)
      const record = prioritizationModelSchema.parse({
        schemaVersion: 1,
        kind: "prioritization-model-candidate",
        id: randomUUID(),
        productId: product.id,
        ...input,
        initiativeId: initiative.id,
        revision: 1,
        membershipDigest: canonicalDigest(input),
        methodDigest: canonicalDigest(input.method),
        rankingDigest: canonicalDigest(scores),
        scoreCandidates: scores,
        state: "candidate",
        createdBy: { kind: "human", id: actorId },
        updatedBy: { kind: "human", id: actorId },
        createdAt: now,
        updatedAt: now,
        authorityBoundary:
          "prioritization-model-is-an-explainable-score-and-ordering-candidate-over-an-exact-mvp-slice-definition-not-evidence-validity-priority-commitment-scope-decision-approval-ready-done-implementation-readiness-assignment-execution-or-action-authority",
      })
      await this.commitVersionedRecord(record, "prioritization-model.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: PrioritizationModelInput, actorId: string): Promise<PrioritizationModel> {
    const input = prioritizationModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Prioritization Model revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Prioritization Model Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const mvp = await this.requireExactMvp(input, initiative)
      this.requireExactSubjects(input, mvp)
      const scores = computeScores(input)
      const record = prioritizationModelSchema.parse({
        ...current,
        ...input,
        productId: product.id,
        initiativeId: initiative.id,
        revision: current.revision + 1,
        membershipDigest: canonicalDigest(input),
        methodDigest: canonicalDigest(input.method),
        rankingDigest: canonicalDigest(scores),
        scoreCandidates: scores,
        predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId },
        updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, "prioritization-model.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<PrioritizationModel> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Prioritization Model ID")), prioritizationModelSchema)
  }

  async readCurrent(initiativeId: string): Promise<PrioritizationModel | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("prioritization-models", currentRecordPattern, prioritizationModelSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Prioritization Model candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<PrioritizationModel> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Prioritization Model history revision must be a positive integer")
    const recordId = this.requireUuid(id, "Prioritization Model ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), prioritizationModelSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Prioritization Model history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<PrioritizationModel[]> {
    const recordId = this.requireUuid(id, "Prioritization Model ID")
    const records = await this.listRecords(
      "prioritization-model-history",
      new RegExp(`^prioritization-model-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      prioritizationModelSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Prioritization Model history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<PrioritizationModelStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, mvp] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), this.mvpSliceDefinition.readCurrent(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const staleBindingCount = candidate && canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative)) ? 1 : 0
    const staleMvpSliceDefinitionCount = candidate && (!mvp || mvp.id !== candidate.mvpSliceDefinition.recordId ||
      mvp.revision !== candidate.mvpSliceDefinition.revision || canonicalDigest(mvp) !== candidate.mvpSliceDefinition.digest) ? 1 : 0
    let invalidSubjectCount = 0
    let invalidScoreCount = 0
    if (candidate) {
      if (mvp) invalidSubjectCount = this.subjectMismatchCount(candidate, mvp)
      const expected = computeScores(candidate)
      invalidScoreCount = candidate.scoreCandidates.reduce((count, score, index) =>
        count + (canonicalDigest(score) === canonicalDigest(expected[index]) ? 0 : 1), 0)
      if (candidate.methodDigest !== canonicalDigest(candidate.method) || candidate.rankingDigest !== canonicalDigest(candidate.scoreCandidates) ||
          candidate.membershipDigest !== canonicalDigest(this.inputOf(candidate))) invalidScoreCount += 1
    }
    const scores = candidate?.scoreCandidates ?? []
    const scored = scores.filter((score) => score.state === "candidate-score")
    const scoreCounts = new Map<number, number>()
    for (const score of scored) scoreCounts.set(score.score!, (scoreCounts.get(score.score!) ?? 0) + 1)
    const tieCount = [...scoreCounts.values()].filter((count) => count > 1).length
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Prioritization Model candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind the exact current Product and Initiative")
    if (staleMvpSliceDefinitionCount > 0) reasons.push("The candidate does not bind the exact current MVP and Slice Definition")
    if (invalidSubjectCount > 0) reasons.push("One or more Prioritization subjects do not match the exact MVP Vertical Slice inventory")
    if (invalidScoreCount > 0) reasons.push("One or more candidate scores or integrity digests are invalid")
    if (scores.some((score) => score.state === "not-assessed")) reasons.push("One or more Prioritization subjects are not fully assessed")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved prioritization questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    const evidenceReferenceCount = candidate?.subjects.reduce((total, subject) => total +
      subject.value.evidence.length + subject.riskReduction.evidence.length +
      subject.dependencyEnablement.evidence.length + subject.costSize.evidence.length, 0) ?? 0
    return prioritizationModelStatusSchema.parse({
      schemaVersion: 1,
      kind: "prioritization-model-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate), mvpSliceDefinition: candidate.mvpSliceDefinition } : {}),
      subjectCount: scores.length,
      scoredSubjectCount: scored.length,
      unassessedSubjectCount: scores.length - scored.length,
      evidenceReferenceCount,
      tieCount,
      staleBindingCount,
      staleMvpSliceDefinitionCount,
      invalidSubjectCount,
      invalidScoreCount,
      unresolvedQuestionCount,
      reviewState,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "prioritization-model-status-is-observational-and-does-not-establish-evidence-validity-priority-commitment-scope-decision-approval-ready-done-implementation-readiness-assignment-execution-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<PrioritizationModelProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Prioritization Model projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "prioritization-model-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        methodDigest: candidate.methodDigest,
        rankingDigest: candidate.rankingDigest,
        state: candidate.state,
        subjectCount: candidate.subjects.length,
        scoredSubjectCount: candidate.scoreCandidates.filter((score) => score.state === "candidate-score").length,
        evidenceReferenceCount: status.evidenceReferenceCount,
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-counts-statuses-method-membership-ranking-and-snapshot-digests-only-not-dimension-estimates-evidence-identities-uncertainty-slice-content-personal-data-secrets-credentials-or-machine-paths" as const,
      authorityBoundary:
        "prioritization-model-projection-is-read-only-and-does-not-establish-evidence-validity-priority-commitment-scope-decision-approval-ready-done-implementation-readiness-assignment-execution-or-action-authority" as const,
    }
    return prioritizationModelProjectionSchema.parse({ ...projectionWithoutDigest, snapshotDigest: canonicalDigest(projectionWithoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("prioritization-models", currentRecordPattern, prioritizationModelSchema)
    for (const candidate of records) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Prioritization Model candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleMvpSliceDefinitionCount > 0 ||
            status.invalidSubjectCount > 0 || status.invalidScoreCount > 0) {
          issues.push({
            code: "prioritization-model.binding-review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale or invalid Prioritization Model bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "prioritization-model.invalid",
          severity: "error",
          message: `Prioritization Model ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private inputOf(record: PrioritizationModel): PrioritizationModelInput {
    const { initiativeId, context, informationClassification, title, mvpSliceDefinition, method, subjects,
      unresolvedQuestions, limitations, reviewState, evidenceValidityState, priorityDecisionState,
      commitmentState, scopeDecisionState, approvalState, acceptanceCriteriaValidityState, readyDoneState,
      implementationReadinessState, assignmentExecutionState, implementationAuthorityState } = record
    return { initiativeId, context, informationClassification, title, mvpSliceDefinition, method, subjects,
      unresolvedQuestions, limitations, reviewState, evidenceValidityState, priorityDecisionState,
      commitmentState, scopeDecisionState, approvalState, acceptanceCriteriaValidityState, readyDoneState,
      implementationReadinessState, assignmentExecutionState, implementationAuthorityState }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Prioritization Model Initiative targets a different Product")
    if (canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) {
      throw new Error("Prioritization Model must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return { productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) }
  }

  private async requireExactMvp(input: PrioritizationModelInput, initiative: Initiative): Promise<MvpSliceDefinition> {
    const mvp = await this.mvpSliceDefinition.readCurrent(initiative.id)
    if (!mvp || mvp.id !== input.mvpSliceDefinition.recordId || mvp.revision !== input.mvpSliceDefinition.revision ||
        canonicalDigest(mvp) !== input.mvpSliceDefinition.digest) {
      throw new Error("Prioritization Model must reference the exact current MVP and Slice Definition candidate")
    }
    return mvp
  }

  private requireExactSubjects(input: PrioritizationModelInput, mvp: MvpSliceDefinition): void {
    if (this.subjectMismatchCount(input, mvp) > 0) {
      throw new Error("Prioritization subjects must match every exact MVP Vertical Slice once in ordinal order")
    }
  }

  private subjectMismatchCount(input: Pick<PrioritizationModelInput, "subjects">, mvp: MvpSliceDefinition): number {
    let count = Math.abs(input.subjects.length - mvp.slices.length)
    for (const [index, slice] of mvp.slices.entries()) {
      const subject = input.subjects[index]
      if (!subject || subject.sliceId !== slice.id || subject.sliceKey !== slice.key || subject.ordinal !== slice.ordinal) count += 1
    }
    return count
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Prioritization guidance is immutable`)
    return { product, initiative }
  }

  private async commitVersionedRecord(record: PrioritizationModel, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, prioritizationModelSchema),
        this.governed(this.historyPath(record.id, record.revision), record, prioritizationModelSchema),
      ],
      audit: {
        eventType, actor: { kind: "human", id: actorId }, subjectId: record.id,
        payload: {
          initiativeId: record.initiativeId,
          revision: record.revision,
          recordDigest: canonicalDigest(record),
          membershipDigest: record.membershipDigest,
          methodDigest: record.methodDigest,
          rankingDigest: record.rankingDigest,
          predecessorDigest: record.predecessorDigest,
          mvpSliceDefinition: record.mvpSliceDefinition,
          subjectCount: record.subjects.length,
          scoredSubjectCount: record.scoreCandidates.filter((score) => score.state === "candidate-score").length,
          evidenceReferenceCount: record.subjects.reduce((total, subject) => total + subject.value.evidence.length +
            subject.riskReduction.evidence.length + subject.dependencyEnablement.evidence.length + subject.costSize.evidence.length, 0),
          reviewState: record.reviewState,
          evidenceValidityState: record.evidenceValidityState,
          priorityDecisionState: record.priorityDecisionState,
          commitmentState: record.commitmentState,
          scopeDecisionState: record.scopeDecisionState,
          approvalState: record.approvalState,
          acceptanceCriteriaValidityState: record.acceptanceCriteriaValidityState,
          readyDoneState: record.readyDoneState,
          implementationReadinessState: record.implementationReadinessState,
          assignmentExecutionState: record.assignmentExecutionState,
          implementationAuthorityState: record.implementationAuthorityState,
          actionAuthorityState: "not-granted",
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("prioritization-models", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("prioritization-model-history", `prioritization-model-${id}-r${revision}.json`)
  }

  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> {
    return { path, value, schema, governed: true }
  }

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
    if (names.length > inventoryLimit) throw new Error(`Prioritization Model directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
