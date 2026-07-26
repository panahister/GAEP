import { randomUUID } from "node:crypto"

import {
  exactSourceReferenceSchema,
  processModelInputSchema,
  processModelProjectionSchema,
  processModelSchema,
  processModelStatusSchema,
  type BusinessContextBinding,
  type ExactProcessModelReference,
  type ExactSourceReference,
  type Initiative,
  type ProcessModel,
  type ProcessModelInput,
  type ProcessModelProjection,
  type ProcessModelStatus,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { BoundedContextModelService } from "./bounded-context-model.js"
import type { BusinessRuleCatalogService } from "./business-rule-catalog.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { OperatingModelService } from "./operating-model.js"
import type { SecurityPrivacyAssessmentService } from "./security-privacy-assessment.js"
import type { SourceGovernanceService } from "./source-governance.js"
import type { ValueStreamModelService } from "./value-stream-model.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const processModelInventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: ProcessModel): ExactProcessModelReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: ProcessModelInput) {
  return {
    valueStreamModel: input.valueStreamModel,
    operatingModel: input.operatingModel,
    businessRuleCatalog: input.businessRuleCatalog,
    boundedContextModel: input.boundedContextModel,
    securityPrivacyAssessment: input.securityPrivacyAssessment,
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

export class ProcessModelService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly valueStreamModels: ValueStreamModelService,
    private readonly operatingModels: OperatingModelService,
    private readonly businessRuleCatalogs: BusinessRuleCatalogService,
    private readonly boundedContextModels: BoundedContextModelService,
    private readonly securityPrivacyAssessments: SecurityPrivacyAssessmentService,
  ) {}

  async create(inputValue: ProcessModelInput, actorId: string): Promise<ProcessModel> {
    const input = processModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindingsAndTrace(input)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Process Model candidate")
      }
      const now = new Date().toISOString()
      const record = processModelSchema.parse({
        schemaVersion: 1,
        kind: "process-model-candidate",
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
          "process-model-is-a-candidate-record-and-does-not-approve-a-workflow-grant-transition-or-execution-authority-establish-operational-readiness-or-authorize-action",
      })
      await this.commitVersionedRecord(record, "process.model.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: ProcessModelInput,
    actorId: string,
  ): Promise<ProcessModel> {
    const input = processModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Process Model revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Process Model Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindingsAndTrace(input)
      const record = processModelSchema.parse({
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
      await this.commitVersionedRecord(record, "process.model.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<ProcessModel> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Process Model ID")),
      processModelSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<ProcessModel | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("process-models", currentRecordPattern, processModelSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Process Model candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<ProcessModel> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Process Model history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Process Model ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), processModelSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Process Model history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<ProcessModel[]> {
    const recordId = this.requireUuid(id, "Process Model ID")
    const records = await this.listRecords(
      "process-model-history",
      new RegExp(`^process-model-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      processModelSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Process Model history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<ProcessModelStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, model, valueStreams, operatingModel, businessRuleCatalog, boundedContextModel,
      securityPrivacyAssessment, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.valueStreamModels.readCurrent(targetId),
      this.operatingModels.readCurrent(targetId),
      this.businessRuleCatalogs.readCurrent(targetId),
      this.boundedContextModels.readCurrent(targetId),
      this.securityPrivacyAssessments.readCurrent(targetId),
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
      if (!valueStreams || !exactRecordMatches(model.valueStreamModel, valueStreams)) staleBindingCount += 1
      if (!operatingModel || !exactRecordMatches(model.operatingModel, operatingModel)) staleBindingCount += 1
      if (!businessRuleCatalog || !exactRecordMatches(model.businessRuleCatalog, businessRuleCatalog)) staleBindingCount += 1
      if (!boundedContextModel || !exactRecordMatches(model.boundedContextModel, boundedContextModel)) staleBindingCount += 1
      if (!securityPrivacyAssessment || !exactRecordMatches(model.securityPrivacyAssessment, securityPrivacyAssessment)) staleBindingCount += 1
      if (model.membershipDigest !== canonicalDigest(membership(model))) staleBindingCount += 1
    }
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(model).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const processes = model?.processes ?? []
    const transitions = processes.flatMap((entry) => entry.transitions)
    const approvalRequirements = processes.flatMap((entry) => entry.approvalRequirements)
    const coveredValueStreams = new Set(processes.flatMap((entry) => entry.valueStreamKeys))
    const coveredBoundedContexts = new Set(processes.flatMap((entry) => entry.boundedContextKeys))
    const coveredBusinessRules = new Set(processes.flatMap((entry) => entry.businessRuleKeys))
    const uncoveredValueStreamCount = valueStreams?.valueStreams.filter((entry) => !coveredValueStreams.has(entry.key)).length ?? 0
    const uncoveredBoundedContextCount = boundedContextModel?.boundedContexts.filter((entry) => !coveredBoundedContexts.has(entry.key)).length ?? 0
    const uncoveredBusinessRuleCount = businessRuleCatalog?.rules.filter((entry) => !coveredBusinessRules.has(entry.key)).length ?? 0
    const unresolvedRequirementCount = model?.requirementCoverage.filter((entry) => entry.state === "unresolved").length ?? 0
    const inconsistencyCount = (model?.inconsistencies.length ?? 0) +
      processes.reduce((total, entry) => total + entry.inconsistencies.length, 0)
    const unresolvedQuestionCount = (model?.unresolvedQuestions.length ?? 0) +
      processes.reduce((total, entry) => total + entry.unresolvedQuestions.length, 0)
    const reasons: string[] = []
    if (!model) reasons.push("No versioned Process Model candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The Process Model does not bind the exact current Product, Initiative, or upstream Product records")
    if (staleSourceReferenceCount > 0) reasons.push("One or more Process Model claims reference a superseded Source revision")
    if (uncoveredValueStreamCount > 0) reasons.push("One or more exact Value Streams lack Process Model coverage")
    if (uncoveredBoundedContextCount > 0) reasons.push("One or more exact Bounded Contexts lack Process Model coverage")
    if (uncoveredBusinessRuleCount > 0) reasons.push("One or more exact Business Rules lack Process Model coverage")
    if (unresolvedRequirementCount > 0) reasons.push("One or more Process Model requirements remain unresolved")
    if (inconsistencyCount > 0) reasons.push("The Process Model records explicit inconsistencies")
    if (unresolvedQuestionCount > 0) reasons.push("The Process Model records unresolved questions")
    return processModelStatusSchema.parse({
      schemaVersion: 1,
      kind: "process-model-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(model ? { model: exactReference(model) } : {}),
      processCount: processes.length,
      stepCount: processes.reduce((total, entry) => total + entry.steps.length, 0),
      stateDimensionCount: processes.reduce((total, entry) => total + entry.stateDimensions.length, 0),
      stateValueCount: processes.reduce((total, entry) =>
        total + entry.stateDimensions.reduce((subtotal, dimension) => subtotal + dimension.states.length, 0), 0),
      transitionCount: transitions.length,
      eventDefinitionCount: processes.reduce((total, entry) => total + entry.events.length, 0),
      approvalRequirementCount: approvalRequirements.length,
      uncoveredValueStreamCount,
      uncoveredBoundedContextCount,
      uncoveredBusinessRuleCount,
      unresolvedRequirementCount,
      inconsistencyCount,
      unresolvedQuestionCount,
      staleBindingCount,
      staleSourceReferenceCount,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "process-model-status-reports-candidate-coverage-and-gaps-and-does-not-approve-workflows-grant-transition-or-execution-authority-establish-operational-readiness-or-authorize-action",
    })
  }

  async project(initiativeId: string): Promise<ProcessModelProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, model] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Process Model projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "process-model-projection" as const,
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
          processCount: model.processes.length,
          transitionCount: model.processes.reduce((total, entry) => total + entry.transitions.length, 0),
          approvalRequirementCount: model.processes.reduce((total, entry) => total + entry.approvalRequirements.length, 0),
          updatedAt: model.updatedAt,
        },
      } : {}),
      observedAt: new Date().toISOString(),
      privacyBoundary:
        "projection-contains-identities-counts-statuses-and-digests-only-not-process-narrative-transition-guards-approval-content-source-content-personal-data-locators-secrets-or-credentials" as const,
      authorityBoundary:
        "process-model-projection-does-not-approve-workflows-grant-transition-or-execution-authority-establish-operational-readiness-or-authorize-action" as const,
    }
    return processModelProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const [product, records] = await Promise.all([
      this.readProduct(),
      this.listRecords("process-models", currentRecordPattern, processModelSchema),
    ])
    for (const model of records) {
      try {
        const initiative = await this.readInitiative(model.initiativeId)
        this.validateContext(model.context, product, initiative)
        await this.validateSourceReferences(model, initiative.id)
        await this.validateBindingsAndTrace(model)
        if (model.membershipDigest !== canonicalDigest(membership(model))) {
          throw new Error("Process Model membership digest is invalid")
        }
        const history = await this.listHistory(model.id)
        if (history.length !== model.revision || canonicalDigest(history[0]) !== canonicalDigest(model)) {
          throw new Error("Current Process Model does not match its complete immutable history")
        }
        const status = await this.assess(model.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "process.model-binding-review-required",
            severity: "warning",
            message: `Initiative ${model.initiativeId} has stale Process Model bindings.`,
            record: { type: model.kind, id: model.id, revision: model.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "process.model-invalid",
          severity: "error",
          message: `Process Model ${model.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: model.kind, id: model.id, revision: model.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private async validateBindingsAndTrace(input: ProcessModelInput): Promise<void> {
    const [valueStreamModel, operatingModel, businessRuleCatalog, boundedContextModel, securityPrivacyAssessment] =
      await Promise.all([
        this.valueStreamModels.readCurrent(input.initiativeId),
        this.operatingModels.readCurrent(input.initiativeId),
        this.businessRuleCatalogs.readCurrent(input.initiativeId),
        this.boundedContextModels.readCurrent(input.initiativeId),
        this.securityPrivacyAssessments.readCurrent(input.initiativeId),
      ])
    if (!valueStreamModel || !exactRecordMatches(input.valueStreamModel, valueStreamModel)) {
      throw new Error("Process Model must bind the exact current Value Stream Model")
    }
    if (!operatingModel || !exactRecordMatches(input.operatingModel, operatingModel)) {
      throw new Error("Process Model must bind the exact current Operating Model")
    }
    if (!businessRuleCatalog || !exactRecordMatches(input.businessRuleCatalog, businessRuleCatalog)) {
      throw new Error("Process Model must bind the exact current Business Rule Catalog")
    }
    if (!boundedContextModel || !exactRecordMatches(input.boundedContextModel, boundedContextModel)) {
      throw new Error("Process Model must bind the exact current Bounded Context and Ownership Model")
    }
    if (!securityPrivacyAssessment || !exactRecordMatches(input.securityPrivacyAssessment, securityPrivacyAssessment)) {
      throw new Error("Process Model must bind the exact current Security, Privacy, and Threat Assessment")
    }
    const valueStreamKeys = new Set(valueStreamModel.valueStreams.map((entry) => entry.key))
    const roleKeys = new Set(operatingModel.roles.map((entry) => entry.key))
    const businessRuleKeys = new Set(businessRuleCatalog.rules.map((entry) => entry.key))
    const boundedContextKeys = new Set(boundedContextModel.boundedContexts.map((entry) => entry.key))
    const roleReferences = [
      input.governance.processOwnerRoleKey,
      input.governance.stateStewardRoleKey,
      input.governance.approvalCoordinatorRoleKey,
      ...input.governance.reviewerRoleKeys,
      ...input.processes.flatMap((process) => [
        process.ownerRoleKey,
        ...process.participantRoleKeys,
        ...process.transitions.flatMap((transition) => transition.actorRoleKeys),
        ...process.steps.flatMap((step) => step.roleKeys),
        ...process.approvalRequirements.flatMap((approval) => approval.approverRoleKeys),
        ...process.events.flatMap((event) => event.producerRoleKeys),
      ]),
    ]
    if (roleReferences.some((key) => !roleKeys.has(key))) {
      throw new Error("Process Model roles must reference exact bound Operating Model roles")
    }
    for (const process of input.processes) {
      if (process.valueStreamKeys.some((key) => !valueStreamKeys.has(key))) {
        throw new Error("Process definitions must reference exact bound Value Streams")
      }
      if (process.businessRuleKeys.some((key) => !businessRuleKeys.has(key))) {
        throw new Error("Process definitions must reference exact bound Business Rules")
      }
      if (process.boundedContextKeys.some((key) => !boundedContextKeys.has(key)) ||
          process.steps.some((step) => step.boundedContextKeys.some((key) => !boundedContextKeys.has(key)))) {
        throw new Error("Process definitions and steps must reference exact bound Bounded Contexts")
      }
    }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Process Model Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product),
      productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative),
      initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Process Model must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Process Model Source reference identity, Initiative, revision, record digest, or content digest does not match")
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
      throw new Error(`Terminal Initiative ${initiative.state} Process Model is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: ProcessModel, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, processModelSchema),
        this.governed(this.historyPath(record.id, record.revision), record, processModelSchema),
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
          transitionAuthorityState: record.governance.transitionAuthorityState,
          approvalState: record.governance.approvalState,
          operationalReadinessState: record.governance.operationalReadinessState,
          executionAuthorityState: record.governance.executionAuthorityState,
          authoringLifecycle: record.governance.authoringLifecycle,
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("process-models", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("process-model-history", `process-model-${id}-r${revision}.json`)
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
    if (names.length > processModelInventoryLimit) {
      throw new Error(`Process Model directory ${directory} exceeds the ${processModelInventoryLimit}-record safety limit`)
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
