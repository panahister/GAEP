import { randomUUID } from "node:crypto"

import {
  designerReadyGateInputSchema,
  designerReadyGateProjectionSchema,
  designerReadyGateSchema,
  designerReadyGateStatusSchema,
  designerReadyPrerequisiteKeys,
  designerReadyPrerequisiteKinds,
  exactSourceReferenceSchema,
  type BusinessContextBinding,
  type DesignerReadyGate,
  type DesignerReadyGateInput,
  type DesignerReadyGateProjection,
  type DesignerReadyGateStatus,
  type DesignerReadyPrerequisiteKey,
  type ExactDesignerReadyPrerequisite,
  type ExactSourceReference,
  type Initiative,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type DependencyRecord = {
  id: string
  initiativeId: string
  kind: string
  membershipDigest: string
  revision: number
}
type DependencyStatus = {
  assessedAt: string
  state: "attention-required" | "complete-for-review"
}
type DependencyService = {
  readCurrent(initiativeId: string): Promise<DependencyRecord | undefined>
  assess(initiativeId: string): Promise<DependencyStatus>
}
export type DesignerReadyDependencyServices = Record<DesignerReadyPrerequisiteKey, DependencyService>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const passLikeResults = new Set(["conditional-pass-candidate", "not-applicable-candidate", "pass-candidate"])

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: DesignerReadyGate) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

export function designerReadyPrerequisiteStatusDigest(status: DependencyStatus): string {
  const { assessedAt: _assessedAt, ...stable } = status
  return canonicalDigest(stable)
}

function prerequisiteReference(
  key: DesignerReadyPrerequisiteKey,
  record: DependencyRecord,
  status: DependencyStatus,
): ExactDesignerReadyPrerequisite {
  return {
    key,
    kind: designerReadyPrerequisiteKinds[key],
    recordId: record.id,
    revision: record.revision,
    digest: canonicalDigest(record),
    membershipDigest: record.membershipDigest,
    assessmentDigest: designerReadyPrerequisiteStatusDigest(status),
    assessmentState: status.state,
  }
}

function membership(input: DesignerReadyGateInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    objectiveDigest: input.objectiveDigest,
    prerequisites: input.prerequisites,
    evaluations: input.evaluations,
    exceptions: input.exceptions,
    assessmentDefinitionDigest: input.assessmentDefinitionDigest,
    assessmentReceiptDigest: input.assessmentReceiptDigest,
    candidateResult: input.candidateResult,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    designCompletenessState: input.designCompletenessState,
    externalCompletenessState: input.externalCompletenessState,
    designValidityState: input.designValidityState,
    designApprovalState: input.designApprovalState,
    designBaselineState: input.designBaselineState,
    readinessState: input.readinessState,
    exceptionAuthorityState: input.exceptionAuthorityState,
    figmaConnectionAuthorityState: input.figmaConnectionAuthorityState,
    credentialAuthorityState: input.credentialAuthorityState,
    permissionGrantState: input.permissionGrantState,
    importExecutionState: input.importExecutionState,
    writeExecutionState: input.writeExecutionState,
    implementationAuthorityState: input.implementationAuthorityState,
  }
}

export function designerReadyAssessmentReceiptDigest(
  input: Pick<DesignerReadyGateInput, "assessmentDefinitionDigest" | "evaluations" | "exceptions" | "prerequisites">,
): string {
  return canonicalDigest({
    assessmentDefinitionDigest: input.assessmentDefinitionDigest,
    prerequisites: input.prerequisites,
    evaluations: input.evaluations,
    exceptions: input.exceptions,
  })
}

function collectExactSourceReferences(value: unknown, collected: ExactSourceReference[] = []): ExactSourceReference[] {
  if (Array.isArray(value)) {
    for (const item of value) collectExactSourceReferences(item, collected)
    return collected
  }
  if (!value || typeof value !== "object") return collected
  const candidate = exactSourceReferenceSchema.safeParse(value)
  if (candidate.success) {
    collected.push(candidate.data)
    return collected
  }
  for (const child of Object.values(value)) collectExactSourceReferences(child, collected)
  return collected
}

function uniqueExactSourceReferences(value: unknown): ExactSourceReference[] {
  const unique = new Map(collectExactSourceReferences(value).map((reference) => [
    `${reference.sourceId}:${reference.sourceRevision}:${reference.recordDigest}:${reference.contentDigest}`,
    reference,
  ]))
  return [...unique.values()].sort((left, right) =>
    left.sourceId.localeCompare(right.sourceId) || left.sourceRevision - right.sourceRevision)
}

export class DesignerReadyGateService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly dependencies: DesignerReadyDependencyServices,
  ) {}

  async create(inputValue: DesignerReadyGateInput, actorId: string): Promise<DesignerReadyGate> {
    const input = designerReadyGateInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.requireCurrentDependencies(input)
      await this.validateSourceReferences(input, initiative.id)
      this.validateAssessmentReceipt(input)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Designer-Ready Gate candidate")
      }
      const now = new Date().toISOString()
      const record = designerReadyGateSchema.parse({
        schemaVersion: 1,
        kind: "designer-ready-gate-candidate",
        id: randomUUID(),
        productId: product.id,
        ...input,
        initiativeId: initiative.id,
        revision: 1,
        membershipDigest: canonicalDigest(membership(input)),
        state: "candidate",
        createdBy: { kind: "human", id: actorId },
        updatedBy: { kind: "human", id: actorId },
        createdAt: now,
        updatedAt: now,
        gateBoundary: "a-passing-designer-ready-gate-candidate-is-an-evaluation-result-not-permission-or-readiness",
        authorityBoundary:
          "designer-ready-gate-is-a-candidate-evaluation-and-does-not-establish-design-completeness-external-completeness-design-validity-approval-baseline-readiness-exception-waiver-acceptance-phase-entry-implementation-write-import-or-action-authority",
      })
      await this.commitVersionedRecord(record, "designer-ready-gate.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: DesignerReadyGateInput,
    actorId: string,
  ): Promise<DesignerReadyGate> {
    const input = designerReadyGateInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Designer-Ready Gate revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Designer-Ready Gate Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.requireCurrentDependencies(input)
      await this.validateSourceReferences(input, initiative.id)
      this.validateAssessmentReceipt(input)
      const record = designerReadyGateSchema.parse({
        ...current,
        ...input,
        productId: product.id,
        initiativeId: initiative.id,
        revision: current.revision + 1,
        membershipDigest: canonicalDigest(membership(input)),
        predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId },
        updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, "designer-ready-gate.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<DesignerReadyGate> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Designer-Ready Gate ID")), designerReadyGateSchema)
  }

  async readCurrent(initiativeId: string): Promise<DesignerReadyGate | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("designer-ready-gates", currentRecordPattern, designerReadyGateSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Designer-Ready Gate candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<DesignerReadyGate> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Designer-Ready Gate history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Designer-Ready Gate ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), designerReadyGateSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Designer-Ready Gate history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<DesignerReadyGate[]> {
    const recordId = this.requireUuid(id, "Designer-Ready Gate ID")
    const records = await this.listRecords(
      "designer-ready-gate-history",
      new RegExp(`^designer-ready-gate-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      designerReadyGateSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Designer-Ready Gate history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<DesignerReadyGateStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, currentSources, dependencySnapshots] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
      this.readDependencySnapshots(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    let staleBindingCount = 0
    if (candidate) {
      const expectedContext = {
        productRevision: revisionOf(product), productDigest: canonicalDigest(product),
        initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
      }
      if (canonicalDigest(candidate.context) !== canonicalDigest(expectedContext)) staleBindingCount += 1
      if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) staleBindingCount += 1
      if (candidate.assessmentReceiptDigest !== designerReadyAssessmentReceiptDigest(candidate)) staleBindingCount += 1
      const inputByKey = new Map(candidate.prerequisites.map((entry) => [entry.key, entry]))
      for (const [key, snapshot] of dependencySnapshots) {
        const expected = snapshot.record ? prerequisiteReference(key, snapshot.record, snapshot.status) : undefined
        if (!expected || canonicalDigest(inputByKey.get(key)) !== canonicalDigest(expected)) staleBindingCount += 1
      }
    }
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(candidate).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const evaluations = candidate?.evaluations ?? []
    const countEvaluation = (state: DesignerReadyGateInput["evaluations"][number]["evaluationState"]) =>
      evaluations.filter((entry) => entry.evaluationState === state).length
    const satisfiedCount = countEvaluation("satisfied-candidate")
    const notApplicableCount = countEvaluation("not-applicable-candidate")
    const unsatisfiedCount = countEvaluation("unsatisfied")
    const notAssessedCount = countEvaluation("not-assessed")
    const staleOrUnknownCount = evaluations.filter((entry) => entry.freshness !== "current").length
    const humanReviewedCount = evaluations.filter((entry) => entry.evidenceState === "human-reviewed").length
    const pendingExceptionCount = candidate?.exceptions.filter((entry) => entry.state === "pending").length ?? 0
    const grantedExceptionCandidateCount = candidate?.exceptions.filter((entry) => entry.state === "granted-candidate").length ?? 0
    const assessedAt = new Date().toISOString()
    const invalidExceptionCount = candidate?.exceptions.filter((entry) =>
      ["expired", "rejected", "revoked"].includes(entry.state) ||
      (entry.state === "granted-candidate" && Date.parse(entry.validUntil ?? "") <= Date.parse(assessedAt))).length ?? 0
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const candidateResult = candidate?.candidateResult ?? "not-assessed"
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Designer-Ready Gate candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The Designer-Ready Gate does not bind exact current prerequisites or assessment receipts")
    if (staleSourceReferenceCount > 0) reasons.push("One or more gate evaluations reference a superseded Source revision")
    if (candidate && evaluations.length !== designerReadyPrerequisiteKeys.length) reasons.push("The gate does not evaluate every canonical prerequisite")
    if (unsatisfiedCount > 0) reasons.push("One or more Designer-Ready prerequisites are unsatisfied")
    if (notAssessedCount > 0) reasons.push("One or more Designer-Ready prerequisites are not assessed")
    if (staleOrUnknownCount > 0) reasons.push("One or more Designer-Ready prerequisite evaluations are stale or unknown")
    if (candidate && humanReviewedCount !== designerReadyPrerequisiteKeys.length) reasons.push("Every Designer-Ready prerequisite requires attributable human-reviewed evidence")
    if (pendingExceptionCount > 0) reasons.push("One or more Designer-Ready exception candidates remain pending")
    if (invalidExceptionCount > 0) reasons.push("One or more Designer-Ready exception candidates are invalid, expired, rejected, or revoked")
    if (unresolvedQuestionCount > 0) reasons.push("The Designer-Ready Gate records unresolved questions")
    if (candidate && !passLikeResults.has(candidateResult)) reasons.push("The Designer-Ready Gate candidate result is blocked or incomplete")
    if (candidate && reviewState !== "ready-for-human-decision") reasons.push("The Designer-Ready Gate is not ready for an accountable human decision")
    return designerReadyGateStatusSchema.parse({
      schemaVersion: 1,
      kind: "designer-ready-gate-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      prerequisiteCount: evaluations.length,
      satisfiedCount,
      notApplicableCount,
      unsatisfiedCount,
      notAssessedCount,
      staleOrUnknownCount,
      humanReviewedCount,
      pendingExceptionCount,
      grantedExceptionCandidateCount,
      invalidExceptionCount,
      staleBindingCount,
      staleSourceReferenceCount,
      unresolvedQuestionCount,
      candidateResult,
      reviewState,
      state: reasons.length === 0 ? "complete-for-human-decision" : "attention-required",
      reasons,
      assessedAt,
      gateBoundary: "a-passing-designer-ready-gate-candidate-is-an-evaluation-result-not-permission-or-readiness",
      authorityBoundary:
        "designer-ready-gate-status-is-observational-and-does-not-establish-design-completeness-external-completeness-design-validity-approval-baseline-readiness-exception-waiver-acceptance-phase-entry-implementation-write-import-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<DesignerReadyGateProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Designer-Ready Gate projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "designer-ready-gate-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        state: candidate.state,
        prerequisiteCount: designerReadyPrerequisiteKeys.length,
        prerequisiteCatalogDigest: canonicalDigest(candidate.prerequisites),
        evaluationCatalogDigest: canonicalDigest(candidate.evaluations),
        exceptionCatalogDigest: canonicalDigest(candidate.exceptions),
        assessmentDefinitionDigest: candidate.assessmentDefinitionDigest,
        assessmentReceiptDigest: candidate.assessmentReceiptDigest,
        candidateResult: candidate.candidateResult,
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-criteria-findings-exception-rationale-decision-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions" as const,
      authorityBoundary:
        "designer-ready-gate-projection-is-read-only-and-does-not-establish-design-completeness-external-completeness-design-validity-approval-baseline-readiness-exception-waiver-acceptance-phase-entry-implementation-write-import-or-action-authority" as const,
    }
    return designerReadyGateProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("designer-ready-gates", currentRecordPattern, designerReadyGateSchema)
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) {
          throw new Error("Designer-Ready Gate membership digest is invalid")
        }
        if (candidate.assessmentReceiptDigest !== designerReadyAssessmentReceiptDigest(candidate)) {
          throw new Error("Designer-Ready Gate assessment receipt digest is invalid")
        }
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Designer-Ready Gate candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0 || status.invalidExceptionCount > 0) {
          issues.push({
            code: "designer-ready-gate.review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale or invalid Designer-Ready Gate evidence.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "designer-ready-gate.invalid",
          severity: "error",
          message: `Designer-Ready Gate ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Designer-Ready Gate Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Designer-Ready Gate candidate must bind exact current Product and Initiative revisions and digests")
    }
  }

  private async readDependencySnapshots(initiativeId: string): Promise<Map<DesignerReadyPrerequisiteKey, {
    record: DependencyRecord | undefined
    status: DependencyStatus
  }>> {
    const entries = await Promise.all(designerReadyPrerequisiteKeys.map(async (key) => {
      const service = this.dependencies[key]
      const [record, status] = await Promise.all([service.readCurrent(initiativeId), service.assess(initiativeId)])
      return [key, { record, status }] as const
    }))
    return new Map(entries)
  }

  private async requireCurrentDependencies(input: DesignerReadyGateInput): Promise<void> {
    const snapshots = await this.readDependencySnapshots(input.initiativeId)
    const inputByKey = new Map(input.prerequisites.map((entry) => [entry.key, entry]))
    for (const key of designerReadyPrerequisiteKeys) {
      const snapshot = snapshots.get(key)
      if (!snapshot?.record || snapshot.record.kind !== designerReadyPrerequisiteKinds[key]) {
        throw new Error(`Designer-Ready Gate requires the exact current ${key} candidate`)
      }
      const expected = prerequisiteReference(key, snapshot.record, snapshot.status)
      if (canonicalDigest(inputByKey.get(key)) !== canonicalDigest(expected)) {
        throw new Error(`Designer-Ready Gate must bind the exact current ${key} candidate and assessment`)
      }
    }
  }

  private validateAssessmentReceipt(input: DesignerReadyGateInput): void {
    if (input.assessmentReceiptDigest !== designerReadyAssessmentReceiptDigest(input)) {
      throw new Error("Designer-Ready Gate assessment receipt digest must bind exact prerequisites, evaluations, exceptions, and definition")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Designer-Ready Gate Source identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Designer-Ready Gate is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: DesignerReadyGate, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, designerReadyGateSchema),
        this.governed(this.historyPath(record.id, record.revision), record, designerReadyGateSchema),
      ],
      audit: {
        eventType,
        actor: { kind: "human", id: actorId },
        subjectId: record.id,
        payload: {
          initiativeId: record.initiativeId,
          revision: record.revision,
          recordDigest: canonicalDigest(record),
          membershipDigest: record.membershipDigest,
          predecessorDigest: record.predecessorDigest,
          objectiveDigest: record.objectiveDigest,
          prerequisiteCount: record.prerequisites.length,
          prerequisiteCatalogDigest: canonicalDigest(record.prerequisites),
          evaluationCount: record.evaluations.length,
          evaluationCatalogDigest: canonicalDigest(record.evaluations.map((entry) => ({
            prerequisiteKey: entry.prerequisiteKey,
            evaluationState: entry.evaluationState,
            freshness: entry.freshness,
            evidenceState: entry.evidenceState,
            criteriaDigest: entry.criteriaDigest,
          }))),
          exceptionCount: record.exceptions.length,
          exceptionCatalogDigest: canonicalDigest(record.exceptions.map((entry) => ({
            key: entry.key, prerequisiteKey: entry.prerequisiteKey, state: entry.state, decisionKey: entry.decisionKey,
          }))),
          assessmentDefinitionDigest: record.assessmentDefinitionDigest,
          assessmentReceiptDigest: record.assessmentReceiptDigest,
          candidateResult: record.candidateResult,
          unresolvedQuestionCount: record.unresolvedQuestions.length,
          reviewState: record.reviewState,
          designCompletenessState: record.designCompletenessState,
          externalCompletenessState: record.externalCompletenessState,
          designValidityState: record.designValidityState,
          designApprovalState: record.designApprovalState,
          designBaselineState: record.designBaselineState,
          readinessState: record.readinessState,
          exceptionAuthorityState: record.exceptionAuthorityState,
          figmaConnectionAuthorityState: record.figmaConnectionAuthorityState,
          credentialAuthorityState: record.credentialAuthorityState,
          permissionGrantState: record.permissionGrantState,
          importExecutionState: record.importExecutionState,
          writeExecutionState: record.writeExecutionState,
          implementationAuthorityState: record.implementationAuthorityState,
          actionAuthorityState: "not-granted",
          gateBoundary: record.gateBoundary,
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("designer-ready-gates", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("designer-ready-gate-history", `designer-ready-gate-${id}-r${revision}.json`)
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
    if (names.length > inventoryLimit) throw new Error(`Designer-Ready Gate directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(
      names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)),
    )
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
