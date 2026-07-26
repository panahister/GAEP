import { randomUUID } from "node:crypto"

import {
  dataModelInputSchema,
  dataModelProjectionSchema,
  dataModelSchema,
  dataModelStatusSchema,
  exactSourceReferenceSchema,
  type BusinessContextBinding,
  type DataModel,
  type DataModelInput,
  type DataModelProjection,
  type DataModelStatus,
  type ExactDataModelReference,
  type ExactSourceReference,
  type Initiative,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { BoundedContextModelService } from "./bounded-context-model.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { OperatingModelService } from "./operating-model.js"
import type { ProcessModelService } from "./process-model.js"
import type { SecurityPrivacyAssessmentService } from "./security-privacy-assessment.js"
import type { SourceGovernanceService } from "./source-governance.js"
import type { SystemSolutionArchitectureService } from "./system-solution-architecture.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const dataModelInventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: DataModel): ExactDataModelReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: DataModelInput) {
  return {
    systemSolutionArchitecture: input.systemSolutionArchitecture,
    boundedContextModel: input.boundedContextModel,
    operatingModel: input.operatingModel,
    securityPrivacyAssessment: input.securityPrivacyAssessment,
    processModel: input.processModel,
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
  return reference.recordId === record.id &&
    reference.revision === record.revision &&
    reference.digest === canonicalDigest(record)
}

export class DataModelService {
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
  ) {}

  async create(inputValue: DataModelInput, actorId: string): Promise<DataModel> {
    const input = dataModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindingsAndTrace(input)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Data Model candidate")
      }
      const now = new Date().toISOString()
      const record = dataModelSchema.parse({
        schemaVersion: 1,
        kind: "data-model-candidate",
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
          "data-model-is-a-candidate-record-and-does-not-approve-a-data-model-or-classification-appoint-ownership-grant-migration-authority-establish-operational-readiness-or-authorize-action",
      })
      await this.commitVersionedRecord(record, "data.model.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: DataModelInput, actorId: string): Promise<DataModel> {
    const input = dataModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Data Model revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Data Model Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindingsAndTrace(input)
      const record = dataModelSchema.parse({
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
      await this.commitVersionedRecord(record, "data.model.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<DataModel> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Data Model ID")), dataModelSchema)
  }

  async readCurrent(initiativeId: string): Promise<DataModel | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("data-models", currentRecordPattern, dataModelSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Data Model candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<DataModel> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Data Model history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Data Model ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), dataModelSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Data Model history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<DataModel[]> {
    const recordId = this.requireUuid(id, "Data Model ID")
    const records = await this.listRecords(
      "data-model-history",
      new RegExp(`^data-model-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      dataModelSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Data Model history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<DataModelStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, model, systemSolutionArchitecture, boundedContextModel, operatingModel,
      securityPrivacyAssessment, processModel, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.systemSolutionArchitectures.readCurrent(targetId),
      this.boundedContextModels.readCurrent(targetId),
      this.operatingModels.readCurrent(targetId),
      this.securityPrivacyAssessments.readCurrent(targetId),
      this.processModels.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const expectedContext: BusinessContextBinding = {
      productRevision: revisionOf(product),
      productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative),
      initiativeDigest: canonicalDigest(initiative),
    }
    let staleBindingCount = 0
    if (model) {
      if (canonicalDigest(model.context) !== canonicalDigest(expectedContext)) staleBindingCount += 1
      if (!systemSolutionArchitecture || !exactRecordMatches(model.systemSolutionArchitecture, systemSolutionArchitecture)) staleBindingCount += 1
      if (!boundedContextModel || !exactRecordMatches(model.boundedContextModel, boundedContextModel)) staleBindingCount += 1
      if (!operatingModel || !exactRecordMatches(model.operatingModel, operatingModel)) staleBindingCount += 1
      if (!securityPrivacyAssessment || !exactRecordMatches(model.securityPrivacyAssessment, securityPrivacyAssessment)) staleBindingCount += 1
      if (!processModel || !exactRecordMatches(model.processModel, processModel)) staleBindingCount += 1
      if (model.membershipDigest !== canonicalDigest(membership(model))) staleBindingCount += 1
    }
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(model).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const entities = model?.entities ?? []
    const coveredBoundedContexts = new Set(entities.map((entry) => entry.boundedContextKey))
    const coveredDataClasses = new Set(entities.flatMap((entry) => entry.dataClassKeys))
    const coveredProcesses = new Set([
      ...entities.flatMap((entry) => entry.processKeys),
      ...(model?.transformations.flatMap((entry) => entry.processKeys) ?? []),
    ])
    const uncoveredBoundedContextCount = boundedContextModel?.boundedContexts
      .filter((entry) => !coveredBoundedContexts.has(entry.key)).length ?? 0
    const uncoveredSecurityDataClassCount = securityPrivacyAssessment?.dataClasses
      .filter((entry) => !coveredDataClasses.has(entry.key)).length ?? 0
    const uncoveredProcessCount = processModel?.processes
      .filter((entry) => !coveredProcesses.has(entry.key)).length ?? 0
    const unresolvedSystemOfRecordCount = entities
      .filter((entry) => entry.systemOfRecordState === "unresolved").length
    const unresolvedTransformationCount = model?.transformations
      .filter((entry) => entry.state === "unresolved").length ?? 0
    const unresolvedRequirementCount = model?.requirementCoverage
      .filter((entry) => entry.state === "unresolved").length ?? 0
    const inconsistencyCount = model?.inconsistencies.length ?? 0
    const unresolvedQuestionCount = model?.unresolvedQuestions.length ?? 0
    const reasons: string[] = []
    if (!model) reasons.push("No versioned Data Model candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The Data Model does not bind the exact current Product, Initiative, or upstream Product records")
    if (staleSourceReferenceCount > 0) reasons.push("One or more Data Model claims reference a superseded Source revision")
    if (uncoveredBoundedContextCount > 0) reasons.push("One or more exact Bounded Contexts lack Data Model coverage")
    if (uncoveredSecurityDataClassCount > 0) reasons.push("One or more exact security/privacy data classes lack Data Model coverage")
    if (uncoveredProcessCount > 0) reasons.push("One or more exact Processes lack Data Model coverage")
    if (unresolvedSystemOfRecordCount > 0) reasons.push("One or more Data entities have unresolved system-of-record responsibility")
    if (unresolvedTransformationCount > 0) reasons.push("One or more Data transformations remain unresolved")
    if (unresolvedRequirementCount > 0) reasons.push("One or more Data Profile requirements remain unresolved")
    if (inconsistencyCount > 0) reasons.push("The Data Model records explicit inconsistencies")
    if (unresolvedQuestionCount > 0) reasons.push("The Data Model records unresolved questions")
    return dataModelStatusSchema.parse({
      schemaVersion: 1,
      kind: "data-model-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(model ? { model: exactReference(model) } : {}),
      entityCount: entities.length,
      attributeCount: entities.reduce((total, entry) => total + entry.attributes.length, 0),
      relationshipCount: model?.relationships.length ?? 0,
      lifecycleCount: model?.lifecycles.length ?? 0,
      transformationCount: model?.transformations.length ?? 0,
      uncoveredBoundedContextCount,
      uncoveredSecurityDataClassCount,
      uncoveredProcessCount,
      unresolvedSystemOfRecordCount,
      unresolvedTransformationCount,
      unresolvedRequirementCount,
      inconsistencyCount,
      unresolvedQuestionCount,
      staleBindingCount,
      staleSourceReferenceCount,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "data-model-status-reports-candidate-coverage-and-gaps-and-does-not-approve-a-data-model-or-classification-appoint-ownership-grant-migration-authority-establish-operational-readiness-or-authorize-action",
    })
  }

  async project(initiativeId: string): Promise<DataModelProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, model] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Data Model projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "data-model-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: {
        id: initiative.id,
        revision: revisionOf(initiative),
        digest: canonicalDigest(initiative),
        state: initiative.state,
      },
      status,
      ...(model ? {
        model: {
          id: model.id,
          revision: model.revision,
          digest: canonicalDigest(model),
          membershipDigest: model.membershipDigest,
          state: model.state,
          entityCount: model.entities.length,
          relationshipCount: model.relationships.length,
          lifecycleCount: model.lifecycles.length,
          updatedAt: model.updatedAt,
        },
      } : {}),
      observedAt: new Date().toISOString(),
      privacyBoundary:
        "projection-contains-identities-counts-statuses-and-digests-only-not-entity-attributes-relationships-lifecycle-content-source-content-personal-data-locators-secrets-or-credentials" as const,
      authorityBoundary:
        "data-model-projection-does-not-approve-a-data-model-or-classification-appoint-ownership-grant-migration-authority-establish-operational-readiness-or-authorize-action" as const,
    }
    return dataModelProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const [product, records] = await Promise.all([
      this.readProduct(),
      this.listRecords("data-models", currentRecordPattern, dataModelSchema),
    ])
    for (const model of records) {
      try {
        const initiative = await this.readInitiative(model.initiativeId)
        this.validateContext(model.context, product, initiative)
        await this.validateSourceReferences(model, initiative.id)
        await this.validateBindingsAndTrace(model)
        if (model.membershipDigest !== canonicalDigest(membership(model))) {
          throw new Error("Data Model membership digest is invalid")
        }
        const history = await this.listHistory(model.id)
        if (history.length !== model.revision || canonicalDigest(history[0]) !== canonicalDigest(model)) {
          throw new Error("Current Data Model does not match its complete immutable history")
        }
        const status = await this.assess(model.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "data.model-binding-review-required",
            severity: "warning",
            message: `Initiative ${model.initiativeId} has stale Data Model bindings.`,
            record: { type: model.kind, id: model.id, revision: model.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "data.model-invalid",
          severity: "error",
          message: `Data Model ${model.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: model.kind, id: model.id, revision: model.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private async validateBindingsAndTrace(input: DataModelInput): Promise<void> {
    const [systemSolutionArchitecture, boundedContextModel, operatingModel, securityPrivacyAssessment, processModel] =
      await Promise.all([
        this.systemSolutionArchitectures.readCurrent(input.initiativeId),
        this.boundedContextModels.readCurrent(input.initiativeId),
        this.operatingModels.readCurrent(input.initiativeId),
        this.securityPrivacyAssessments.readCurrent(input.initiativeId),
        this.processModels.readCurrent(input.initiativeId),
      ])
    if (!systemSolutionArchitecture || !exactRecordMatches(input.systemSolutionArchitecture, systemSolutionArchitecture)) {
      throw new Error("Data Model must bind the exact current System/Solution Architecture")
    }
    if (!boundedContextModel || !exactRecordMatches(input.boundedContextModel, boundedContextModel)) {
      throw new Error("Data Model must bind the exact current Bounded Context and Ownership Model")
    }
    if (!operatingModel || !exactRecordMatches(input.operatingModel, operatingModel)) {
      throw new Error("Data Model must bind the exact current Operating Model")
    }
    if (!securityPrivacyAssessment || !exactRecordMatches(input.securityPrivacyAssessment, securityPrivacyAssessment)) {
      throw new Error("Data Model must bind the exact current Security, Privacy, and Threat Assessment")
    }
    if (!processModel || !exactRecordMatches(input.processModel, processModel)) {
      throw new Error("Data Model must bind the exact current Process Model")
    }
    const architectureElementKeys = new Set(systemSolutionArchitecture.elements.map((entry) => entry.key))
    const boundedContextKeys = new Set(boundedContextModel.boundedContexts.map((entry) => entry.key))
    const roleKeys = new Set(operatingModel.roles.map((entry) => entry.key))
    const dataClassKeys = new Set(securityPrivacyAssessment.dataClasses.map((entry) => entry.key))
    const dataFlowKeys = new Set(securityPrivacyAssessment.dataFlows.map((entry) => entry.key))
    const processKeys = new Set(processModel.processes.map((entry) => entry.key))
    const roleReferences = [
      ...input.governance.dataOwnerRoleKeys,
      ...input.governance.dataStewardRoleKeys,
      ...input.governance.privacyReviewerRoleKeys,
      ...input.entities.flatMap((entry) => [entry.ownerRoleKey, ...entry.stewardRoleKeys]),
    ]
    if (roleReferences.some((key) => !roleKeys.has(key))) {
      throw new Error("Data Model roles must reference exact bound Operating Model roles")
    }
    for (const entity of input.entities) {
      if (!boundedContextKeys.has(entity.boundedContextKey)) {
        throw new Error("Data entities must reference exact bound Bounded Contexts")
      }
      if (entity.architectureElementKeys.some((key) => !architectureElementKeys.has(key))) {
        throw new Error("Data entities must reference exact bound architecture elements")
      }
      if (entity.processKeys.some((key) => !processKeys.has(key))) {
        throw new Error("Data entities must reference exact bound Processes")
      }
      const entityDataClasses = [...entity.dataClassKeys, ...entity.attributes.flatMap((entry) => entry.dataClassKeys)]
      if (entityDataClasses.some((key) => !dataClassKeys.has(key))) {
        throw new Error("Data entities and attributes must reference exact bound security/privacy data classes")
      }
    }
    for (const transformation of input.transformations) {
      if (transformation.processKeys.some((key) => !processKeys.has(key))) {
        throw new Error("Data transformations must reference exact bound Processes")
      }
      if (transformation.dataFlowKeys.some((key) => !dataFlowKeys.has(key))) {
        throw new Error("Data transformations must reference exact bound security/privacy data flows")
      }
    }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Data Model Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product),
      productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative),
      initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Data Model must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Data Model Source reference identity, Initiative, revision, record digest, or content digest does not match")
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
      throw new Error(`Terminal Initiative ${initiative.state} Data Model is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: DataModel, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, dataModelSchema),
        this.governed(this.historyPath(record.id, record.revision), record, dataModelSchema),
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
          state: record.state,
          modelApprovalState: record.governance.modelApprovalState,
          classificationApprovalState: record.governance.classificationApprovalState,
          ownershipAcceptanceState: record.governance.ownershipAcceptanceState,
          migrationAuthorityState: record.governance.migrationAuthorityState,
          operationalReadinessState: record.governance.operationalReadinessState,
          reviewState: record.governance.reviewState,
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("data-models", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("data-model-history", `data-model-${id}-r${revision}.json`)
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
    if (names.length > dataModelInventoryLimit) {
      throw new Error(`Data Model directory ${directory} exceeds the ${dataModelInventoryLimit}-record safety limit`)
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
