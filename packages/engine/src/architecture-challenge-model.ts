import { randomUUID } from "node:crypto"

import {
  architectureChallengeModelInputSchema,
  architectureChallengeModelProjectionSchema,
  architectureChallengeModelSchema,
  architectureChallengeModelStatusSchema,
  exactSourceReferenceSchema,
  type ArchitectureChallengeModel,
  type ArchitectureChallengeModelInput,
  type ArchitectureChallengeModelProjection,
  type ArchitectureChallengeModelStatus,
  type BusinessContextBinding,
  type ExactArchitectureChallengeModelReference,
  type ExactSourceReference,
  type Initiative,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { AuthorizationModelService } from "./authorization-model.js"
import type { BoundedContextModelService } from "./bounded-context-model.js"
import type { DataModelService } from "./data-model.js"
import type { EventIntegrationModelService } from "./event-integration-model.js"
import type { FailureRecoveryModelService } from "./failure-recovery-model.js"
import type { OperatingModelService } from "./operating-model.js"
import type { ProcessModelService } from "./process-model.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SecurityPrivacyAssessmentService } from "./security-privacy-assessment.js"
import type { SourceGovernanceService } from "./source-governance.js"
import type { SystemSolutionArchitectureService } from "./system-solution-architecture.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const architectureChallengeInventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: ArchitectureChallengeModel): ExactArchitectureChallengeModelReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: ArchitectureChallengeModelInput) {
  return {
    systemSolutionArchitecture: input.systemSolutionArchitecture,
    boundedContextModel: input.boundedContextModel,
    operatingModel: input.operatingModel,
    securityPrivacyAssessment: input.securityPrivacyAssessment,
    processModel: input.processModel,
    dataModel: input.dataModel,
    authorizationModel: input.authorizationModel,
    eventIntegrationModel: input.eventIntegrationModel,
    failureRecoveryModel: input.failureRecoveryModel,
  }
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
  const references = collectExactSourceReferences(value)
  const unique = new Map(references.map((reference) => [
    `${reference.sourceId}:${reference.sourceRevision}:${reference.recordDigest}:${reference.contentDigest}`,
    reference,
  ]))
  return [...unique.values()].sort((left, right) =>
    left.sourceId.localeCompare(right.sourceId) || left.sourceRevision - right.sourceRevision)
}

function exactRecordMatches(
  reference: { recordId: string; revision: number; digest: string },
  record: { id: string; revision: number },
): boolean {
  return reference.recordId === record.id && reference.revision === record.revision &&
    reference.digest === canonicalDigest(record)
}

export class ArchitectureChallengeModelService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly systemSolutionArchitectures: SystemSolutionArchitectureService,
    private readonly boundedContextModels: BoundedContextModelService,
    private readonly operatingModels: OperatingModelService,
    private readonly securityPrivacyAssessments: SecurityPrivacyAssessmentService,
    private readonly processModels: ProcessModelService,
    private readonly dataModels: DataModelService,
    private readonly authorizationModels: AuthorizationModelService,
    private readonly eventIntegrationModels: EventIntegrationModelService,
    private readonly failureRecoveryModels: FailureRecoveryModelService,
  ) {}

  async create(inputValue: ArchitectureChallengeModelInput, actorId: string): Promise<ArchitectureChallengeModel> {
    const input = architectureChallengeModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindingsAndTrace(input)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Architecture Challenge candidate")
      }
      const now = new Date().toISOString()
      const record = architectureChallengeModelSchema.parse({
        schemaVersion: 1,
        kind: "architecture-challenge-model-candidate",
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
        authorityBoundary:
          "architecture-challenge-is-a-candidate-review-record-and-does-not-establish-independence-assurance-risk-acceptance-architecture-approval-operational-readiness-or-authorize-action",
      })
      await this.commitVersionedRecord(record, "architecture.challenge-model.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: ArchitectureChallengeModelInput,
    actorId: string,
  ): Promise<ArchitectureChallengeModel> {
    const input = architectureChallengeModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) {
        throw new Error("Architecture Challenge revision changed before update")
      }
      if (current.initiativeId !== input.initiativeId) {
        throw new Error("Architecture Challenge Initiative cannot change")
      }
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindingsAndTrace(input)
      const record = architectureChallengeModelSchema.parse({
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
      await this.commitVersionedRecord(record, "architecture.challenge-model.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<ArchitectureChallengeModel> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Architecture Challenge ID")),
      architectureChallengeModelSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<ArchitectureChallengeModel | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords(
      "architecture-challenge-models",
      currentRecordPattern,
      architectureChallengeModelSchema,
    )
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Architecture Challenge candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<ArchitectureChallengeModel> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Architecture Challenge history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Architecture Challenge ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), architectureChallengeModelSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Architecture Challenge history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<ArchitectureChallengeModel[]> {
    const recordId = this.requireUuid(id, "Architecture Challenge ID")
    const records = await this.listRecords(
      "architecture-challenge-model-history",
      new RegExp(`^architecture-challenge-model-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      architectureChallengeModelSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Architecture Challenge history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<ArchitectureChallengeModelStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, model, systemSolutionArchitecture, boundedContextModel, operatingModel,
      securityPrivacyAssessment, processModel, dataModel, authorizationModel, eventIntegrationModel,
      failureRecoveryModel, currentSources] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId),
      this.systemSolutionArchitectures.readCurrent(targetId), this.boundedContextModels.readCurrent(targetId),
      this.operatingModels.readCurrent(targetId), this.securityPrivacyAssessments.readCurrent(targetId),
      this.processModels.readCurrent(targetId), this.dataModels.readCurrent(targetId),
      this.authorizationModels.readCurrent(targetId), this.eventIntegrationModels.readCurrent(targetId),
      this.failureRecoveryModels.readCurrent(targetId), this.sourceGovernance.listSources(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const expectedContext: BusinessContextBinding = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    let staleBindingCount = 0
    if (model) {
      if (canonicalDigest(model.context) !== canonicalDigest(expectedContext)) staleBindingCount += 1
      const bindings = [
        [model.systemSolutionArchitecture, systemSolutionArchitecture],
        [model.boundedContextModel, boundedContextModel], [model.operatingModel, operatingModel],
        [model.securityPrivacyAssessment, securityPrivacyAssessment], [model.processModel, processModel],
        [model.dataModel, dataModel], [model.authorizationModel, authorizationModel],
        [model.eventIntegrationModel, eventIntegrationModel], [model.failureRecoveryModel, failureRecoveryModel],
      ] as const
      for (const [reference, record] of bindings) {
        if (!record || !exactRecordMatches(reference, record)) staleBindingCount += 1
      }
      if (model.membershipDigest !== canonicalDigest(membership(model))) staleBindingCount += 1
    }
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(model).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const respondedFindingKeys = new Set(model?.responses.flatMap((entry) => entry.findingKeys) ?? [])
    const unrespondedFindingCount = model?.findings.filter((entry) => !respondedFindingKeys.has(entry.key)).length ?? 0
    const unresolvedAssumptionCount = model?.assumptions
      .filter((entry) => ["contested", "declared-untested", "unknown"].includes(entry.status)).length ?? 0
    const unresolvedRequirementCount = model?.requirementCoverage
      .filter((entry) => entry.state === "unresolved").length ?? 0
    const inconsistencyCount = model?.inconsistencies.length ?? 0
    const unresolvedQuestionCount = model?.unresolvedQuestions.length ?? 0
    const reasons: string[] = []
    if (!model) reasons.push("No versioned Architecture Challenge candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The Architecture Challenge does not bind the exact current Product, Initiative, or upstream Product records")
    if (staleSourceReferenceCount > 0) reasons.push("One or more Architecture Challenge claims reference a superseded Source revision")
    if (unrespondedFindingCount > 0) reasons.push("One or more Challenge Findings lack an attributable candidate response")
    if (unresolvedRequirementCount > 0) reasons.push("One or more Architecture, Assurance, or Review requirements remain unresolved")
    if (inconsistencyCount > 0) reasons.push("The Architecture Challenge records explicit inconsistencies")
    if (unresolvedQuestionCount > 0) reasons.push("The Architecture Challenge records unresolved questions")
    return architectureChallengeModelStatusSchema.parse({
      schemaVersion: 1,
      kind: "architecture-challenge-model-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(model ? { model: exactReference(model) } : {}),
      challengeSubjectCount: model?.challengeSubjects.length ?? 0,
      assumptionCount: model?.assumptions.length ?? 0,
      alternativeCount: model?.alternatives.length ?? 0,
      findingCount: model?.findings.length ?? 0,
      responseCount: model?.responses.length ?? 0,
      unrespondedFindingCount,
      unresolvedAssumptionCount,
      unresolvedRequirementCount,
      inconsistencyCount,
      unresolvedQuestionCount,
      staleBindingCount,
      staleSourceReferenceCount,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "architecture-challenge-status-reports-candidate-coverage-and-gaps-and-does-not-establish-independence-assurance-risk-acceptance-architecture-approval-operational-readiness-or-authorize-action",
    })
  }

  async project(initiativeId: string): Promise<ArchitectureChallengeModelProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, model] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Architecture Challenge projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "architecture-challenge-model-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: {
        id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative),
        state: initiative.state,
      },
      status,
      ...(model ? { model: {
        id: model.id, revision: model.revision, digest: canonicalDigest(model),
        membershipDigest: model.membershipDigest, state: model.state,
        challengeSubjectCount: model.challengeSubjects.length, assumptionCount: model.assumptions.length,
        alternativeCount: model.alternatives.length, findingCount: model.findings.length,
        responseCount: model.responses.length, updatedAt: model.updatedAt,
      } } : {}),
      observedAt: new Date().toISOString(),
      privacyBoundary:
        "projection-contains-identities-counts-statuses-and-digests-only-not-challenge-content-assumptions-evidence-findings-responses-source-content-personal-data-secrets-or-credentials" as const,
      authorityBoundary:
        "architecture-challenge-projection-does-not-establish-independence-assurance-risk-acceptance-architecture-approval-operational-readiness-or-authorize-action" as const,
    }
    return architectureChallengeModelProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const [product, records] = await Promise.all([
      this.readProduct(),
      this.listRecords("architecture-challenge-models", currentRecordPattern, architectureChallengeModelSchema),
    ])
    for (const model of records) {
      try {
        const initiative = await this.readInitiative(model.initiativeId)
        this.validateContext(model.context, product, initiative)
        await this.validateSourceReferences(model, initiative.id)
        await this.validateBindingsAndTrace(model)
        if (model.membershipDigest !== canonicalDigest(membership(model))) {
          throw new Error("Architecture Challenge membership digest is invalid")
        }
        const history = await this.listHistory(model.id)
        if (history.length !== model.revision || canonicalDigest(history[0]) !== canonicalDigest(model)) {
          throw new Error("Current Architecture Challenge does not match its complete immutable history")
        }
        const status = await this.assess(model.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "architecture-challenge.model-binding-review-required", severity: "warning",
            message: `Initiative ${model.initiativeId} has stale Architecture Challenge bindings.`,
            record: { type: model.kind, id: model.id, revision: model.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "architecture-challenge.model-invalid", severity: "error",
          message: `Architecture Challenge ${model.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: model.kind, id: model.id, revision: model.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private async validateBindingsAndTrace(input: ArchitectureChallengeModelInput): Promise<void> {
    const [architecture, boundedContextModel, operatingModel, securityPrivacyAssessment, processModel,
      dataModel, authorizationModel, eventIntegrationModel, failureRecoveryModel] = await Promise.all([
      this.systemSolutionArchitectures.readCurrent(input.initiativeId),
      this.boundedContextModels.readCurrent(input.initiativeId), this.operatingModels.readCurrent(input.initiativeId),
      this.securityPrivacyAssessments.readCurrent(input.initiativeId), this.processModels.readCurrent(input.initiativeId),
      this.dataModels.readCurrent(input.initiativeId), this.authorizationModels.readCurrent(input.initiativeId),
      this.eventIntegrationModels.readCurrent(input.initiativeId), this.failureRecoveryModels.readCurrent(input.initiativeId),
    ])
    const exactBindings = [
      [input.systemSolutionArchitecture, architecture, "System/Solution Architecture"],
      [input.boundedContextModel, boundedContextModel, "Bounded Context and Ownership Model"],
      [input.operatingModel, operatingModel, "Operating Model"],
      [input.securityPrivacyAssessment, securityPrivacyAssessment, "Security, Privacy, and Threat Assessment"],
      [input.processModel, processModel, "Process Model"], [input.dataModel, dataModel, "Data Model"],
      [input.authorizationModel, authorizationModel, "Authorization Model"],
      [input.eventIntegrationModel, eventIntegrationModel, "Event and Integration Model"],
      [input.failureRecoveryModel, failureRecoveryModel, "Failure and Recovery Model"],
    ] as const
    for (const [reference, record, label] of exactBindings) {
      if (!record || !exactRecordMatches(reference, record)) {
        throw new Error(`Architecture Challenge must bind the exact current ${label}`)
      }
    }
    if (!architecture || !boundedContextModel || !operatingModel || !failureRecoveryModel) {
      throw new Error("Architecture Challenge upstream records are incomplete")
    }
    const concernKeys = new Set(architecture.concerns.map((entry) => entry.key))
    const decisionKeys = new Set(architecture.decisions.map((entry) => entry.key))
    const elementKeys = new Set(architecture.elements.map((entry) => entry.key))
    const viewKeys = new Set(architecture.views.map((entry) => entry.key))
    const qualityKeys = new Set(architecture.qualityAttributes.map((entry) => entry.key))
    const boundedContextKeys = new Set(boundedContextModel.boundedContexts.map((entry) => entry.key))
    const failureModeKeys = new Set(failureRecoveryModel.failureModes.map((entry) => entry.key))
    for (const subject of input.challengeSubjects) {
      if (subject.architectureConcernKeys.some((key) => !concernKeys.has(key)) ||
          subject.architectureDecisionKeys.some((key) => !decisionKeys.has(key)) ||
          subject.architectureElementKeys.some((key) => !elementKeys.has(key)) ||
          subject.architectureViewKeys.some((key) => !viewKeys.has(key)) ||
          subject.qualityScenarioKeys.some((key) => !qualityKeys.has(key)) ||
          subject.boundedContextKeys.some((key) => !boundedContextKeys.has(key)) ||
          subject.failureModeKeys.some((key) => !failureModeKeys.has(key))) {
        throw new Error("Challenge Subjects must reference exact bound Architecture, Context, and Failure subjects")
      }
    }
    for (const alternative of input.alternatives) {
      if (alternative.architectureElementKeys.some((key) => !elementKeys.has(key)) ||
          alternative.boundedContextKeys.some((key) => !boundedContextKeys.has(key)) ||
          alternative.failureModeKeys.some((key) => !failureModeKeys.has(key))) {
        throw new Error("Challenge Alternatives must reference exact bound Architecture, Context, and Failure subjects")
      }
    }
    const roleKeys = new Set(operatingModel.roles.map((entry) => entry.key))
    const governedRoles = [
      ...input.findings.flatMap((entry) => entry.challengerRoleKeys),
      ...input.responses.flatMap((entry) => entry.responderRoleKeys),
      ...input.independence.authorRoleKeys, ...input.independence.challengerRoleKeys,
      ...input.independence.reviewerRoleKeys, ...input.governance.challengeOwnerRoleKeys,
      ...input.governance.challengerRoleKeys, ...input.governance.responseOwnerRoleKeys,
    ]
    if (governedRoles.some((key) => !roleKeys.has(key))) {
      throw new Error("Architecture Challenge roles must reference exact bound Operating Model roles")
    }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Architecture Challenge Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Architecture Challenge must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Architecture Challenge Source reference identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Architecture Challenge is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: ArchitectureChallengeModel, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, architectureChallengeModelSchema),
        this.governed(this.historyPath(record.id, record.revision), record, architectureChallengeModelSchema),
      ],
      audit: {
        eventType, actor: { kind: "human", id: actorId }, subjectId: record.id,
        payload: {
          initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record),
          membershipDigest: record.membershipDigest, predecessorDigest: record.predecessorDigest,
          state: record.state, reviewState: record.governance.reviewState,
          challengeCompletionState: record.governance.challengeCompletionState,
          independenceState: record.governance.independenceState,
          assuranceState: record.governance.assuranceState,
          riskAcceptanceState: record.governance.riskAcceptanceState,
          architectureApprovalState: record.governance.architectureApprovalState,
          operationalReadinessState: record.governance.operationalReadinessState,
          actionAuthorityState: record.governance.actionAuthorityState,
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("architecture-challenge-models", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve(
      "architecture-challenge-model-history",
      `architecture-challenge-model-${id}-r${revision}.json`,
    )
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
    if (names.length > architectureChallengeInventoryLimit) {
      throw new Error(`Architecture Challenge directory ${directory} exceeds the ${architectureChallengeInventoryLimit}-record safety limit`)
    }
    const records = await Promise.all(names.map((name) =>
      this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
