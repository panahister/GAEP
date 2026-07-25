import { randomUUID } from "node:crypto"

import {
  businessUnderstandingAssessmentSchema,
  businessUnderstandingInputSchema,
  businessUnderstandingProjectionSchema,
  businessUnderstandingSchema,
  exactSourceReferenceSchema,
  outcomeModelInputSchema,
  outcomeModelSchema,
  stakeholderModelInputSchema,
  stakeholderModelSchema,
  type BusinessContextBinding,
  type BusinessUnderstanding,
  type BusinessUnderstandingAssessment,
  type BusinessUnderstandingInput,
  type BusinessUnderstandingProjection,
  type ExactBusinessUnderstandingReference,
  type ExactSourceReference,
  type Initiative,
  type OutcomeModel,
  type OutcomeModelInput,
  type Product,
  type StakeholderModel,
  type StakeholderModelInput,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const businessInventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: { id: string; revision: number }): ExactBusinessUnderstandingReference {
  return {
    recordId: record.id,
    revision: record.revision,
    digest: canonicalDigest(record),
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

export class BusinessUnderstandingService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
  ) {}

  async createBusinessUnderstanding(
    inputValue: BusinessUnderstandingInput,
    actorId: string,
  ): Promise<BusinessUnderstanding> {
    const input = businessUnderstandingInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      if (await this.readCurrentBusinessUnderstanding(initiative.id)) {
        throw new Error("An Initiative can have only one current Business Understanding")
      }
      const now = new Date().toISOString()
      const record = businessUnderstandingSchema.parse({
        schemaVersion: 1,
        kind: "business-understanding-record",
        id: randomUUID(),
        productId: product.id,
        ...input,
        initiativeId: initiative.id,
        revision: 1,
        state: "candidate",
        createdBy: { kind: "human", id: actorId },
        updatedBy: { kind: "human", id: actorId },
        createdAt: now,
        updatedAt: now,
        authorityBoundary:
          "business-understanding-is-attributed-candidate-context-and-does-not-decide-approve-designate-readiness-or-authorize-action",
      })
      await this.commitVersionedRecord(
        record,
        this.businessPath(record.id),
        this.businessHistoryPath(record.id, record.revision),
        businessUnderstandingSchema,
        "business.understanding.created",
        actorId,
      )
      return record
    })
  }

  async reviseBusinessUnderstanding(
    id: string,
    expectedRevision: number,
    inputValue: BusinessUnderstandingInput,
    actorId: string,
  ): Promise<BusinessUnderstanding> {
    const input = businessUnderstandingInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.readBusinessUnderstanding(id)
      if (current.revision !== expectedRevision) throw new Error("Business Understanding revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Business Understanding Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      const record = businessUnderstandingSchema.parse({
        ...current,
        ...input,
        productId: product.id,
        initiativeId: initiative.id,
        revision: current.revision + 1,
        predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId },
        updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(
        record,
        this.businessPath(record.id),
        this.businessHistoryPath(record.id, record.revision),
        businessUnderstandingSchema,
        "business.understanding.revised",
        actorId,
      )
      return record
    })
  }

  async readBusinessUnderstanding(id: string): Promise<BusinessUnderstanding> {
    return this.repository.readJson(
      this.businessPath(this.requireUuid(id, "Business Understanding ID")),
      businessUnderstandingSchema,
    )
  }

  async readCurrentBusinessUnderstanding(initiativeId: string): Promise<BusinessUnderstanding | undefined> {
    return this.oneForInitiative(
      await this.listRecords("business-understanding", currentRecordPattern, businessUnderstandingSchema),
      initiativeId,
      "Business Understanding",
    )
  }

  async readBusinessUnderstandingRevision(id: string, revision: number): Promise<BusinessUnderstanding> {
    return this.readHistoryRevision(
      id,
      revision,
      "Business Understanding",
      this.businessHistoryPath(id, revision),
      businessUnderstandingSchema,
    )
  }

  async listBusinessUnderstandingHistory(id: string): Promise<BusinessUnderstanding[]> {
    return this.listHistory(
      id,
      "Business Understanding",
      "business-understanding-history",
      `business-understanding-${id}-r`,
      businessUnderstandingSchema,
    )
  }

  async createStakeholderModel(inputValue: StakeholderModelInput, actorId: string): Promise<StakeholderModel> {
    const input = stakeholderModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.requireCurrentBusinessReference(input.businessUnderstanding, initiative.id)
      if (await this.readCurrentStakeholderModel(initiative.id)) {
        throw new Error("An Initiative can have only one current Stakeholder Model")
      }
      const now = new Date().toISOString()
      const record = stakeholderModelSchema.parse({
        schemaVersion: 1,
        kind: "stakeholder-role-model",
        id: randomUUID(),
        productId: product.id,
        ...input,
        initiativeId: initiative.id,
        revision: 1,
        state: "candidate",
        createdBy: { kind: "human", id: actorId },
        updatedBy: { kind: "human", id: actorId },
        createdAt: now,
        updatedAt: now,
        authorityBoundary:
          "stakeholder-role-model-separates-role-assignment-competence-and-authority-and-does-not-appoint-approve-or-authorize",
      })
      await this.commitVersionedRecord(
        record,
        this.stakeholderPath(record.id),
        this.stakeholderHistoryPath(record.id, record.revision),
        stakeholderModelSchema,
        "business.stakeholders.created",
        actorId,
      )
      return record
    })
  }

  async reviseStakeholderModel(
    id: string,
    expectedRevision: number,
    inputValue: StakeholderModelInput,
    actorId: string,
  ): Promise<StakeholderModel> {
    const input = stakeholderModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.readStakeholderModel(id)
      if (current.revision !== expectedRevision) throw new Error("Stakeholder Model revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Stakeholder Model Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.requireCurrentBusinessReference(input.businessUnderstanding, initiative.id)
      const record = stakeholderModelSchema.parse({
        ...current,
        ...input,
        productId: product.id,
        initiativeId: initiative.id,
        revision: current.revision + 1,
        predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId },
        updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(
        record,
        this.stakeholderPath(record.id),
        this.stakeholderHistoryPath(record.id, record.revision),
        stakeholderModelSchema,
        "business.stakeholders.revised",
        actorId,
      )
      return record
    })
  }

  async readStakeholderModel(id: string): Promise<StakeholderModel> {
    return this.repository.readJson(
      this.stakeholderPath(this.requireUuid(id, "Stakeholder Model ID")),
      stakeholderModelSchema,
    )
  }

  async readCurrentStakeholderModel(initiativeId: string): Promise<StakeholderModel | undefined> {
    return this.oneForInitiative(
      await this.listRecords("stakeholder-models", currentRecordPattern, stakeholderModelSchema),
      initiativeId,
      "Stakeholder Model",
    )
  }

  async readStakeholderModelRevision(id: string, revision: number): Promise<StakeholderModel> {
    return this.readHistoryRevision(
      id,
      revision,
      "Stakeholder Model",
      this.stakeholderHistoryPath(id, revision),
      stakeholderModelSchema,
    )
  }

  async listStakeholderModelHistory(id: string): Promise<StakeholderModel[]> {
    return this.listHistory(
      id,
      "Stakeholder Model",
      "stakeholder-model-history",
      `stakeholder-model-${id}-r`,
      stakeholderModelSchema,
    )
  }

  async createOutcomeModel(inputValue: OutcomeModelInput, actorId: string): Promise<OutcomeModel> {
    const input = outcomeModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.requireCurrentBusinessReference(input.businessUnderstanding, initiative.id)
      const stakeholder = await this.requireCurrentStakeholderReference(input.stakeholderModel, initiative.id)
      this.validateOutcomeStakeholderKeys(input, stakeholder)
      if (await this.readCurrentOutcomeModel(initiative.id)) {
        throw new Error("An Initiative can have only one current Outcome Model")
      }
      const now = new Date().toISOString()
      const record = outcomeModelSchema.parse({
        schemaVersion: 1,
        kind: "outcome-measure-model",
        id: randomUUID(),
        productId: product.id,
        ...input,
        initiativeId: initiative.id,
        revision: 1,
        state: "candidate",
        createdBy: { kind: "human", id: actorId },
        updatedBy: { kind: "human", id: actorId },
        createdAt: now,
        updatedAt: now,
        authorityBoundary:
          "outcome-measure-model-records-candidate-hypotheses-measures-and-data-use-limits-and-does-not-approve-targets-readiness-or-release",
      })
      await this.commitVersionedRecord(
        record,
        this.outcomePath(record.id),
        this.outcomeHistoryPath(record.id, record.revision),
        outcomeModelSchema,
        "business.outcomes.created",
        actorId,
      )
      return record
    })
  }

  async reviseOutcomeModel(
    id: string,
    expectedRevision: number,
    inputValue: OutcomeModelInput,
    actorId: string,
  ): Promise<OutcomeModel> {
    const input = outcomeModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.readOutcomeModel(id)
      if (current.revision !== expectedRevision) throw new Error("Outcome Model revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Outcome Model Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.requireCurrentBusinessReference(input.businessUnderstanding, initiative.id)
      const stakeholder = await this.requireCurrentStakeholderReference(input.stakeholderModel, initiative.id)
      this.validateOutcomeStakeholderKeys(input, stakeholder)
      const record = outcomeModelSchema.parse({
        ...current,
        ...input,
        productId: product.id,
        initiativeId: initiative.id,
        revision: current.revision + 1,
        predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId },
        updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(
        record,
        this.outcomePath(record.id),
        this.outcomeHistoryPath(record.id, record.revision),
        outcomeModelSchema,
        "business.outcomes.revised",
        actorId,
      )
      return record
    })
  }

  async readOutcomeModel(id: string): Promise<OutcomeModel> {
    return this.repository.readJson(
      this.outcomePath(this.requireUuid(id, "Outcome Model ID")),
      outcomeModelSchema,
    )
  }

  async readCurrentOutcomeModel(initiativeId: string): Promise<OutcomeModel | undefined> {
    return this.oneForInitiative(
      await this.listRecords("outcome-models", currentRecordPattern, outcomeModelSchema),
      initiativeId,
      "Outcome Model",
    )
  }

  async readOutcomeModelRevision(id: string, revision: number): Promise<OutcomeModel> {
    return this.readHistoryRevision(
      id,
      revision,
      "Outcome Model",
      this.outcomeHistoryPath(id, revision),
      outcomeModelSchema,
    )
  }

  async listOutcomeModelHistory(id: string): Promise<OutcomeModel[]> {
    return this.listHistory(
      id,
      "Outcome Model",
      "outcome-model-history",
      `outcome-model-${id}-r`,
      outcomeModelSchema,
    )
  }

  async assess(initiativeId: string): Promise<BusinessUnderstandingAssessment> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, business, stakeholder, outcome, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrentBusinessUnderstanding(targetId),
      this.readCurrentStakeholderModel(targetId),
      this.readCurrentOutcomeModel(targetId),
      this.sourceGovernance.listSources(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const currentContext: BusinessContextBinding = {
      productRevision: revisionOf(product),
      productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative),
      initiativeDigest: canonicalDigest(initiative),
    }
    const records = [business, stakeholder, outcome].filter(
      (record): record is BusinessUnderstanding | StakeholderModel | OutcomeModel => record !== undefined,
    )
    let staleBindingCount = records.filter((record) =>
      canonicalDigest(record.context) !== canonicalDigest(currentContext)).length
    if (
      stakeholder &&
      (!business ||
        stakeholder.businessUnderstanding.recordId !== business.id ||
        stakeholder.businessUnderstanding.revision !== business.revision ||
        stakeholder.businessUnderstanding.digest !== canonicalDigest(business))
    ) staleBindingCount += 1
    if (outcome) {
      if (
        !business ||
        outcome.businessUnderstanding.recordId !== business.id ||
        outcome.businessUnderstanding.revision !== business.revision ||
        outcome.businessUnderstanding.digest !== canonicalDigest(business)
      ) staleBindingCount += 1
      if (
        !stakeholder ||
        outcome.stakeholderModel.recordId !== stakeholder.id ||
        outcome.stakeholderModel.revision !== stakeholder.revision ||
        outcome.stakeholderModel.digest !== canonicalDigest(stakeholder)
      ) staleBindingCount += 1
    }
    const currentSourceById = new Map(currentSources.map((source) => [source.id, source]))
    const references = uniqueExactSourceReferences(records)
    const staleSourceReferenceCount = references.filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current ||
        current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest ||
        current.contentDigest !== reference.contentDigest
    }).length
    const representedStakeholderCategoryCount = stakeholder?.coverage.filter(
      (coverage) => coverage.status === "represented",
    ).length ?? 0
    const unresolvedStakeholderCategoryCount = stakeholder?.coverage.filter(
      (coverage) => coverage.status === "unresolved",
    ).length ?? 0
    const verifiedAuthorityCount = stakeholder?.stakeholders.filter(
      (entry) => entry.authority.standing === "verified",
    ).length ?? 0
    const unverifiedAuthorityCount = stakeholder?.stakeholders.filter(
      (entry) => !["none", "verified"].includes(entry.authority.standing),
    ).length ?? 0
    const businessQuestions = business?.unresolvedQuestions ?? []
    const outcomeQuestions = outcome?.unresolvedQuestions ?? []
    const unresolvedQuestionCount =
      businessQuestions.length + outcomeQuestions.length + unresolvedStakeholderCategoryCount
    const blockingQuestionCount =
      businessQuestions.filter((question) => question.blocking).length +
      outcomeQuestions.filter((question) => question.blocking).length
    const outcomeCount = outcome?.outcomes.length ?? 0
    const measureCount = outcome?.measures.length ?? 0
    const observedBaselineCount = outcome?.measures.filter(
      (measure) => measure.baseline.status === "observed",
    ).length ?? 0
    const reasons: string[] = []
    if (!business) reasons.push("No versioned Business Understanding exists for this Initiative")
    if (!stakeholder) reasons.push("No versioned Stakeholder and Role Model exists for this Initiative")
    if (!outcome) reasons.push("No versioned Outcome and Success Measure Model exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("One or more business records do not bind the exact current Product, Initiative, or upstream record")
    if (staleSourceReferenceCount > 0) reasons.push("One or more business claims reference a superseded Source revision")
    if (unresolvedStakeholderCategoryCount > 0) reasons.push("One or more canonical stakeholder categories remain unresolved")
    if (stakeholder?.stakeholders.some((entry) => entry.assignment.status !== "confirmed")) {
      reasons.push("One or more stakeholder assignments remain unconfirmed")
    }
    if (unverifiedAuthorityCount > 0) reasons.push("One or more stakeholder authority claims remain unverified or disputed")
    if (blockingQuestionCount > 0) reasons.push("One or more blocking business or outcome questions remain unresolved")
    if (outcome?.countermetricDisposition.status === "unresolved") reasons.push("Countermetric applicability remains unresolved")
    if (outcome?.burdenDisposition.status === "unresolved") reasons.push("Governance-burden measurement applicability remains unresolved")
    if (outcome && observedBaselineCount < outcome.measures.length) {
      reasons.push("One or more outcome measures do not have an observed evidence-backed baseline")
    }
    return businessUnderstandingAssessmentSchema.parse({
      schemaVersion: 1,
      kind: "business-understanding-assessment",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(business ? { businessUnderstanding: exactReference(business) } : {}),
      ...(stakeholder ? { stakeholderModel: exactReference(stakeholder) } : {}),
      ...(outcome ? { outcomeModel: exactReference(outcome) } : {}),
      stakeholderCount: stakeholder?.stakeholders.length ?? 0,
      representedStakeholderCategoryCount,
      unresolvedStakeholderCategoryCount,
      verifiedAuthorityCount,
      unverifiedAuthorityCount,
      outcomeCount,
      measureCount,
      observedBaselineCount,
      unresolvedQuestionCount,
      blockingQuestionCount,
      staleBindingCount,
      staleSourceReferenceCount,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "business-understanding-assessment-reports-recorded-candidate-evidence-and-does-not-approve-decide-designate-readiness-or-authorize-action",
    })
  }

  async project(initiativeId: string): Promise<BusinessUnderstandingProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, assessment, business, stakeholder, outcome] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.assess(targetId),
      this.readCurrentBusinessUnderstanding(targetId),
      this.readCurrentStakeholderModel(targetId),
      this.readCurrentOutcomeModel(targetId),
    ])
    if (
      assessment.productId !== product.id ||
      assessment.productRevision !== revisionOf(product) ||
      assessment.initiativeId !== initiative.id ||
      assessment.initiativeRevision !== revisionOf(initiative)
    ) throw new Error("Business projection context changed while the governed records were read")
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "business-understanding-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: {
        id: initiative.id,
        revision: revisionOf(initiative),
        digest: canonicalDigest(initiative),
        state: initiative.state,
      },
      assessment,
      ...(business ? {
        businessUnderstanding: {
          id: business.id,
          revision: business.revision,
          digest: canonicalDigest(business),
          state: business.state,
          objectiveCount: business.objectives.length,
          constraintCount: business.constraints.length,
          assumptionCount: business.assumptions.length,
          unresolvedQuestionCount: business.unresolvedQuestions.length,
          glossaryTermCount: business.glossary.length,
          updatedAt: business.updatedAt,
        },
      } : {}),
      ...(stakeholder ? {
        stakeholderModel: {
          id: stakeholder.id,
          revision: stakeholder.revision,
          digest: canonicalDigest(stakeholder),
          state: stakeholder.state,
          stakeholderCount: stakeholder.stakeholders.length,
          representedCategoryCount: stakeholder.coverage.filter((entry) => entry.status === "represented").length,
          unresolvedCategoryCount: stakeholder.coverage.filter((entry) => entry.status === "unresolved").length,
          verifiedAuthorityCount: stakeholder.stakeholders.filter((entry) => entry.authority.standing === "verified").length,
          updatedAt: stakeholder.updatedAt,
        },
      } : {}),
      ...(outcome ? {
        outcomeModel: {
          id: outcome.id,
          revision: outcome.revision,
          digest: canonicalDigest(outcome),
          state: outcome.state,
          outcomeCount: outcome.outcomes.length,
          measureCount: outcome.measures.length,
          countermetricCount: outcome.measures.filter((measure) => measure.kind === "countermetric").length,
          burdenMeasureCount: outcome.measures.filter((measure) => measure.category === "burden").length,
          observedBaselineCount: outcome.measures.filter((measure) => measure.baseline.status === "observed").length,
          updatedAt: outcome.updatedAt,
        },
      } : {}),
      observedAt: new Date().toISOString(),
      privacyBoundary:
        "projection-contains-identities-counts-statuses-and-digests-only-not-business-narrative-personal-data-source-content-locators-or-credentials" as const,
      authorityBoundary:
        "business-understanding-projection-does-not-approve-appoint-decide-designate-readiness-or-authorize-action" as const,
    }
    return businessUnderstandingProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const [product, businesses, stakeholders, outcomes] = await Promise.all([
      this.readProduct(),
      this.listRecords("business-understanding", currentRecordPattern, businessUnderstandingSchema),
      this.listRecords("stakeholder-models", currentRecordPattern, stakeholderModelSchema),
      this.listRecords("outcome-models", currentRecordPattern, outcomeModelSchema),
    ])
    const allRecords = [...businesses, ...stakeholders, ...outcomes]
    const initiatives = new Map<string, Initiative>()
    for (const record of allRecords) {
      try {
        const initiative = initiatives.get(record.initiativeId) ?? await this.readInitiative(record.initiativeId)
        initiatives.set(record.initiativeId, initiative)
        await this.validateSourceReferences(record, initiative.id)
        this.validateRecordContextForHealth(record.context, product, initiative)
        if (record.kind === "business-understanding-record") {
          await this.verifyHistory(
            record,
            await this.listBusinessUnderstandingHistory(record.id),
            "Business Understanding",
          )
        } else if (record.kind === "stakeholder-role-model") {
          await this.verifyHistory(record, await this.listStakeholderModelHistory(record.id), "Stakeholder Model")
          await this.resolveBusinessReference(record.businessUnderstanding, record.initiativeId)
        } else {
          await this.verifyHistory(record, await this.listOutcomeModelHistory(record.id), "Outcome Model")
          const business = await this.resolveBusinessReference(record.businessUnderstanding, record.initiativeId)
          const stakeholder = await this.resolveStakeholderReference(record.stakeholderModel, record.initiativeId)
          if (!business || !stakeholder) throw new Error("Outcome Model upstream references are unresolved")
          this.validateOutcomeStakeholderKeys(record, stakeholder)
        }
      } catch (error) {
        const recordType = record.kind
        issues.push({
          code: "business.record-invalid",
          severity: "error",
          message: `${recordType} ${record.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: recordType, id: record.id, revision: record.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    for (const [initiativeId] of initiatives) {
      try {
        const assessment = await this.assess(initiativeId)
        if (assessment.staleBindingCount > 0 || assessment.staleSourceReferenceCount > 0) {
          issues.push({
            code: "business.binding-review-required",
            severity: "warning",
            message: `Initiative ${initiativeId} has stale business-context or Source bindings.`,
            record: { type: "initiative", id: initiativeId },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "business.assessment-failed",
          severity: "error",
          message: `Initiative ${initiativeId}: ${error instanceof Error ? error.message : "business assessment failed"}`,
          record: { type: "initiative", id: initiativeId },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    const expected = {
      productRevision: revisionOf(product),
      productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative),
      initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Business record must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private validateRecordContextForHealth(
    binding: BusinessContextBinding,
    product: Product,
    initiative: Initiative,
  ): void {
    if (initiative.productId !== product.id) throw new Error("Business record Initiative targets a different Product")
    const exactCurrent = {
      productRevision: revisionOf(product),
      productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative),
      initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(exactCurrent)) {
      throw new Error("Current business record has stale Product or Initiative bindings")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (
        history.snapshot.initiativeId !== initiativeId ||
        history.recordDigest !== reference.recordDigest ||
        history.snapshot.contentDigest !== reference.contentDigest
      ) throw new Error("Business record Source reference identity, Initiative, revision, record digest, or content digest does not match")
    }
  }

  private async requireCurrentBusinessReference(
    reference: ExactBusinessUnderstandingReference,
    initiativeId: string,
  ): Promise<BusinessUnderstanding> {
    const current = await this.readBusinessUnderstanding(reference.recordId)
    if (
      current.initiativeId !== initiativeId ||
      current.revision !== reference.revision ||
      canonicalDigest(current) !== reference.digest
    ) throw new Error("Stakeholder or Outcome Model must bind the exact current Business Understanding")
    return current
  }

  private async requireCurrentStakeholderReference(
    reference: ExactBusinessUnderstandingReference,
    initiativeId: string,
  ): Promise<StakeholderModel> {
    const current = await this.readStakeholderModel(reference.recordId)
    if (
      current.initiativeId !== initiativeId ||
      current.revision !== reference.revision ||
      canonicalDigest(current) !== reference.digest
    ) throw new Error("Outcome Model must bind the exact current Stakeholder Model")
    return current
  }

  private async resolveBusinessReference(
    reference: ExactBusinessUnderstandingReference,
    initiativeId: string,
  ): Promise<BusinessUnderstanding> {
    const record = await this.readBusinessUnderstandingRevision(reference.recordId, reference.revision)
    if (record.initiativeId !== initiativeId || canonicalDigest(record) !== reference.digest) {
      throw new Error("Business Understanding reference is not exact")
    }
    return record
  }

  private async resolveStakeholderReference(
    reference: ExactBusinessUnderstandingReference,
    initiativeId: string,
  ): Promise<StakeholderModel> {
    const record = await this.readStakeholderModelRevision(reference.recordId, reference.revision)
    if (record.initiativeId !== initiativeId || canonicalDigest(record) !== reference.digest) {
      throw new Error("Stakeholder Model reference is not exact")
    }
    return record
  }

  private validateOutcomeStakeholderKeys(input: OutcomeModelInput, stakeholder: StakeholderModel): void {
    const keys = new Set(stakeholder.stakeholders.map((entry) => entry.key))
    for (const outcome of input.outcomes) {
      if (outcome.beneficiaryStakeholderKeys.some((key) => !keys.has(key))) {
        throw new Error("Outcome beneficiaries must reference the exact bound Stakeholder Model")
      }
    }
    for (const measure of input.measures) {
      if (!keys.has(measure.collection.ownerStakeholderKey)) {
        throw new Error("Measure collection owners must reference the exact bound Stakeholder Model")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(),
      this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} business understanding is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord<T extends {
    id: string
    initiativeId: string
    revision: number
    predecessorDigest?: string
    state: "candidate"
    authorityBoundary: string
  }>(
    record: T,
    currentPath: string,
    historyPath: string,
    schema: ZodType<T>,
    eventType: string,
    actorId: string,
  ): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(currentPath, record, schema),
        this.governed(historyPath, record, schema),
      ],
      audit: {
        eventType,
        actor: { kind: "human", id: actorId },
        subjectId: record.id,
        payload: {
          initiativeId: record.initiativeId,
          revision: record.revision,
          recordDigest: canonicalDigest(record),
          predecessorDigest: record.predecessorDigest,
          state: record.state,
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private async readHistoryRevision<T extends { id: string; revision: number; predecessorDigest?: string }>(
    id: string,
    revision: number,
    label: string,
    path: string,
    schema: ZodType<T>,
  ): Promise<T> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error(`${label} history revision must be a positive integer`)
    const recordId = this.requireUuid(id, `${label} ID`)
    const record = await this.repository.readJson(path, schema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error(`${label} history identity or revision does not match`)
    }
    return record
  }

  private async listHistory<T extends { id: string; revision: number; predecessorDigest?: string }>(
    id: string,
    label: string,
    directory: string,
    prefix: string,
    schema: ZodType<T>,
  ): Promise<T[]> {
    const recordId = this.requireUuid(id, `${label} ID`)
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
    const records = await this.listRecords(
      directory,
      new RegExp(`^${escaped}[1-9][0-9]*\\.json$`, "iu"),
      schema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (
        record.id !== recordId ||
        record.revision !== index + 1 ||
        (index === 0 && record.predecessorDigest !== undefined) ||
        (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))
      ) throw new Error(`${label} history is incomplete or has an invalid predecessor chain`)
    }
    return ascending.reverse()
  }

  private async verifyHistory<T extends { id: string; revision: number }>(
    current: T,
    newestFirst: T[],
    label: string,
  ): Promise<void> {
    if (
      newestFirst.length !== current.revision ||
      canonicalDigest(newestFirst[0]) !== canonicalDigest(current)
    ) throw new Error(`Current ${label} does not match its complete immutable history`)
  }

  private oneForInitiative<T extends { initiativeId: string }>(
    records: T[],
    initiativeId: string,
    label: string,
  ): T | undefined {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error(`Initiative has more than one current ${label}`)
    return matches[0]
  }

  private businessPath(id: string): string {
    return this.repository.resolve("business-understanding", `${id}.json`)
  }

  private businessHistoryPath(id: string, revision: number): string {
    return this.repository.resolve("business-understanding-history", `business-understanding-${id}-r${revision}.json`)
  }

  private stakeholderPath(id: string): string {
    return this.repository.resolve("stakeholder-models", `${id}.json`)
  }

  private stakeholderHistoryPath(id: string, revision: number): string {
    return this.repository.resolve("stakeholder-model-history", `stakeholder-model-${id}-r${revision}.json`)
  }

  private outcomePath(id: string): string {
    return this.repository.resolve("outcome-models", `${id}.json`)
  }

  private outcomeHistoryPath(id: string, revision: number): string {
    return this.repository.resolve("outcome-model-history", `outcome-model-${id}-r${revision}.json`)
  }

  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> {
    return { path, value, schema, governed: true }
  }

  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try {
      names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name))
    } catch (error) {
      if (this.isMissing(error)) return []
      throw error
    }
    if (names.length > businessInventoryLimit) {
      throw new Error(`Business-understanding directory ${directory} exceeds the ${businessInventoryLimit}-record safety limit`)
    }
    const records = await Promise.all(names.map((name) =>
      this.repository.readJson(this.repository.resolve(directory, name), schema),
    ))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }

  private async assertIntegrity(): Promise<void> {
    const audit = await this.repository.verifyAudit()
    if (!audit.valid) throw new Error(`GAEP workspace integrity is invalid: ${audit.error ?? "unknown error"}`)
  }

  private requireUuid(value: string, label: string): string {
    const result = uuidSchema.safeParse(value)
    if (!result.success) throw new Error(`${label} must be a UUID`)
    return result.data
  }

  private isMissing(error: unknown): boolean {
    return error instanceof Error && "code" in error && error.code === "ENOENT"
  }
}
