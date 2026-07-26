import { randomUUID } from "node:crypto"

import {
  eventIntegrationModelInputSchema,
  eventIntegrationModelProjectionSchema,
  eventIntegrationModelSchema,
  eventIntegrationModelStatusSchema,
  exactSourceReferenceSchema,
  type BusinessContextBinding,
  type EventIntegrationModel,
  type EventIntegrationModelInput,
  type EventIntegrationModelProjection,
  type EventIntegrationModelStatus,
  type ExactEventIntegrationModelReference,
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
const eventIntegrationModelInventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: EventIntegrationModel): ExactEventIntegrationModelReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: EventIntegrationModelInput) {
  return {
    systemSolutionArchitecture: input.systemSolutionArchitecture,
    boundedContextModel: input.boundedContextModel,
    operatingModel: input.operatingModel,
    securityPrivacyAssessment: input.securityPrivacyAssessment,
    processModel: input.processModel,
    dataModel: input.dataModel,
    authorizationModel: input.authorizationModel,
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

export class EventIntegrationModelService {
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
  ) {}

  async create(inputValue: EventIntegrationModelInput, actorId: string): Promise<EventIntegrationModel> {
    const input = eventIntegrationModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindingsAndTrace(input)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Event and Integration Model candidate")
      }
      const now = new Date().toISOString()
      const record = eventIntegrationModelSchema.parse({
        schemaVersion: 1,
        kind: "event-integration-model-candidate",
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
          "event-integration-model-is-a-candidate-registry-and-does-not-prove-event-occurrence-send-or-deliver-a-command-accept-an-external-contract-activate-an-adapter-create-an-authorization-grant-execute-an-effect-establish-operational-readiness-or-authorize-action",
      })
      await this.commitVersionedRecord(record, "event.integration-model.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: EventIntegrationModelInput,
    actorId: string,
  ): Promise<EventIntegrationModel> {
    const input = eventIntegrationModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) {
        throw new Error("Event and Integration Model revision changed before update")
      }
      if (current.initiativeId !== input.initiativeId) {
        throw new Error("Event and Integration Model Initiative cannot change")
      }
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindingsAndTrace(input)
      const record = eventIntegrationModelSchema.parse({
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
      await this.commitVersionedRecord(record, "event.integration-model.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<EventIntegrationModel> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Event and Integration Model ID")),
      eventIntegrationModelSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<EventIntegrationModel | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("event-integration-models", currentRecordPattern, eventIntegrationModelSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) {
      throw new Error("Initiative has more than one current Event and Integration Model candidate")
    }
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<EventIntegrationModel> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Event and Integration Model history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Event and Integration Model ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), eventIntegrationModelSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Event and Integration Model history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<EventIntegrationModel[]> {
    const recordId = this.requireUuid(id, "Event and Integration Model ID")
    const records = await this.listRecords(
      "event-integration-model-history",
      new RegExp(`^event-integration-model-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      eventIntegrationModelSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Event and Integration Model history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<EventIntegrationModelStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, model, systemSolutionArchitecture, boundedContextModel, operatingModel,
      securityPrivacyAssessment, processModel, dataModel, authorizationModel, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.systemSolutionArchitectures.readCurrent(targetId),
      this.boundedContextModels.readCurrent(targetId),
      this.operatingModels.readCurrent(targetId),
      this.securityPrivacyAssessments.readCurrent(targetId),
      this.processModels.readCurrent(targetId),
      this.dataModels.readCurrent(targetId),
      this.authorizationModels.readCurrent(targetId),
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
      if (!dataModel || !exactRecordMatches(model.dataModel, dataModel)) staleBindingCount += 1
      if (!authorizationModel || !exactRecordMatches(model.authorizationModel, authorizationModel)) staleBindingCount += 1
      if (model.membershipDigest !== canonicalDigest(membership(model))) staleBindingCount += 1
    }
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(model).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const coveredProcessEvents = new Set(model?.eventTypes.flatMap((entry) => entry.processEventKeys) ?? [])
    const coveredProcesses = new Set(model?.commands.flatMap((entry) => entry.processKeys) ?? [])
    const coveredBoundedContexts = new Set([
      ...(model?.eventTypes.map((entry) => entry.producerBoundedContextKey) ?? []),
      ...(model?.commands.flatMap((entry) => entry.targetBoundedContextKeys) ?? []),
      ...(model?.adapters.flatMap((entry) => entry.boundedContextKeys) ?? []),
      ...(model?.externalContracts.flatMap((entry) => [
        ...entry.producerBoundedContextKeys, ...entry.consumerBoundedContextKeys,
      ]) ?? []),
      ...(model?.routes.flatMap((entry) => [
        ...entry.producerBoundedContextKeys, ...entry.consumerBoundedContextKeys,
      ]) ?? []),
    ])
    const coveredDataEntities = new Set([
      ...(model?.eventTypes.flatMap((entry) => entry.payloadDataEntityKeys) ?? []),
      ...(model?.commands.flatMap((entry) => [...entry.inputDataEntityKeys, ...entry.outputDataEntityKeys]) ?? []),
    ])
    const coveredAuthorizationActions = new Set(model?.commands.flatMap((entry) => entry.authorizationActionKeys) ?? [])
    const uncoveredProcessEventCount = processModel?.processes
      .flatMap((process) => process.events).filter((entry) => !coveredProcessEvents.has(entry.key)).length ?? 0
    const uncoveredProcessCount = processModel?.processes.filter((entry) => !coveredProcesses.has(entry.key)).length ?? 0
    const uncoveredBoundedContextCount = boundedContextModel?.boundedContexts
      .filter((entry) => !coveredBoundedContexts.has(entry.key)).length ?? 0
    const uncoveredDataEntityCount = dataModel?.entities.filter((entry) => !coveredDataEntities.has(entry.key)).length ?? 0
    const uncoveredAuthorizationActionCount = authorizationModel?.actions
      .filter((entry) => !coveredAuthorizationActions.has(entry.key)).length ?? 0
    const unknownMappingTruthCount = model?.mappings.flatMap((entry) => entry.rows)
      .filter((entry) => entry.truthClass === "unknown").length ?? 0
    const unresolvedRequirementCount = model?.requirementCoverage
      .filter((entry) => entry.state === "unresolved").length ?? 0
    const inconsistencyCount = model?.inconsistencies.length ?? 0
    const unresolvedQuestionCount = model?.unresolvedQuestions.length ?? 0
    const reasons: string[] = []
    if (!model) reasons.push("No versioned Event and Integration Model candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The Event and Integration Model does not bind the exact current Product, Initiative, or upstream Product records")
    if (staleSourceReferenceCount > 0) reasons.push("One or more Event and Integration claims reference a superseded Source revision")
    if (uncoveredProcessEventCount > 0) reasons.push("One or more exact Process Event definitions lack Event Type coverage")
    if (uncoveredProcessCount > 0) reasons.push("One or more exact Processes lack Command coverage")
    if (uncoveredBoundedContextCount > 0) reasons.push("One or more exact Bounded Contexts lack integration coverage")
    if (uncoveredDataEntityCount > 0) reasons.push("One or more exact Data entities lack payload or Command coverage")
    if (uncoveredAuthorizationActionCount > 0) reasons.push("One or more exact Authorization Actions lack Command coverage")
    if (unknownMappingTruthCount > 0) reasons.push("One or more integration mapping truth classes remain unknown")
    if (unresolvedRequirementCount > 0) reasons.push("One or more Event, Workflow, Compatibility, Effect, or Mapping requirements remain unresolved")
    if (inconsistencyCount > 0) reasons.push("The Event and Integration Model records explicit inconsistencies")
    if (unresolvedQuestionCount > 0) reasons.push("The Event and Integration Model records unresolved questions")
    return eventIntegrationModelStatusSchema.parse({
      schemaVersion: 1,
      kind: "event-integration-model-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(model ? { model: exactReference(model) } : {}),
      eventTypeCount: model?.eventTypes.length ?? 0,
      commandCount: model?.commands.length ?? 0,
      adapterCount: model?.adapters.length ?? 0,
      externalContractCount: model?.externalContracts.length ?? 0,
      mappingCount: model?.mappings.length ?? 0,
      routeCount: model?.routes.length ?? 0,
      uncoveredProcessEventCount,
      uncoveredProcessCount,
      uncoveredBoundedContextCount,
      uncoveredDataEntityCount,
      uncoveredAuthorizationActionCount,
      unknownMappingTruthCount,
      unresolvedRequirementCount,
      inconsistencyCount,
      unresolvedQuestionCount,
      staleBindingCount,
      staleSourceReferenceCount,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "event-integration-model-status-reports-candidate-coverage-and-gaps-and-does-not-prove-event-occurrence-send-or-deliver-a-command-accept-an-external-contract-activate-an-adapter-create-an-authorization-grant-execute-an-effect-establish-operational-readiness-or-authorize-action",
    })
  }

  async project(initiativeId: string): Promise<EventIntegrationModelProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, model] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Event and Integration Model projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "event-integration-model-projection" as const,
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
          eventTypeCount: model.eventTypes.length,
          commandCount: model.commands.length,
          adapterCount: model.adapters.length,
          externalContractCount: model.externalContracts.length,
          mappingCount: model.mappings.length,
          routeCount: model.routes.length,
          updatedAt: model.updatedAt,
        },
      } : {}),
      observedAt: new Date().toISOString(),
      privacyBoundary:
        "projection-contains-identities-counts-statuses-and-digests-only-not-event-payloads-command-inputs-mapping-content-external-locators-source-content-personal-data-secrets-or-credentials" as const,
      authorityBoundary:
        "event-integration-model-projection-does-not-prove-event-occurrence-send-or-deliver-a-command-accept-an-external-contract-activate-an-adapter-create-an-authorization-grant-execute-an-effect-establish-operational-readiness-or-authorize-action" as const,
    }
    return eventIntegrationModelProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const [product, records] = await Promise.all([
      this.readProduct(),
      this.listRecords("event-integration-models", currentRecordPattern, eventIntegrationModelSchema),
    ])
    for (const model of records) {
      try {
        const initiative = await this.readInitiative(model.initiativeId)
        this.validateContext(model.context, product, initiative)
        await this.validateSourceReferences(model, initiative.id)
        await this.validateBindingsAndTrace(model)
        if (model.membershipDigest !== canonicalDigest(membership(model))) {
          throw new Error("Event and Integration Model membership digest is invalid")
        }
        const history = await this.listHistory(model.id)
        if (history.length !== model.revision || canonicalDigest(history[0]) !== canonicalDigest(model)) {
          throw new Error("Current Event and Integration Model does not match its complete immutable history")
        }
        const status = await this.assess(model.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "event-integration.model-binding-review-required",
            severity: "warning",
            message: `Initiative ${model.initiativeId} has stale Event and Integration Model bindings.`,
            record: { type: model.kind, id: model.id, revision: model.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "event-integration.model-invalid",
          severity: "error",
          message: `Event and Integration Model ${model.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: model.kind, id: model.id, revision: model.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private async validateBindingsAndTrace(input: EventIntegrationModelInput): Promise<void> {
    const [systemSolutionArchitecture, boundedContextModel, operatingModel, securityPrivacyAssessment,
      processModel, dataModel, authorizationModel] = await Promise.all([
      this.systemSolutionArchitectures.readCurrent(input.initiativeId),
      this.boundedContextModels.readCurrent(input.initiativeId),
      this.operatingModels.readCurrent(input.initiativeId),
      this.securityPrivacyAssessments.readCurrent(input.initiativeId),
      this.processModels.readCurrent(input.initiativeId),
      this.dataModels.readCurrent(input.initiativeId),
      this.authorizationModels.readCurrent(input.initiativeId),
    ])
    if (!systemSolutionArchitecture || !exactRecordMatches(input.systemSolutionArchitecture, systemSolutionArchitecture)) {
      throw new Error("Event and Integration Model must bind the exact current System/Solution Architecture")
    }
    if (!boundedContextModel || !exactRecordMatches(input.boundedContextModel, boundedContextModel)) {
      throw new Error("Event and Integration Model must bind the exact current Bounded Context and Ownership Model")
    }
    if (!operatingModel || !exactRecordMatches(input.operatingModel, operatingModel)) {
      throw new Error("Event and Integration Model must bind the exact current Operating Model")
    }
    if (!securityPrivacyAssessment || !exactRecordMatches(input.securityPrivacyAssessment, securityPrivacyAssessment)) {
      throw new Error("Event and Integration Model must bind the exact current Security, Privacy, and Threat Assessment")
    }
    if (!processModel || !exactRecordMatches(input.processModel, processModel)) {
      throw new Error("Event and Integration Model must bind the exact current Process Model")
    }
    if (!dataModel || !exactRecordMatches(input.dataModel, dataModel)) {
      throw new Error("Event and Integration Model must bind the exact current Data Model")
    }
    if (!authorizationModel || !exactRecordMatches(input.authorizationModel, authorizationModel)) {
      throw new Error("Event and Integration Model must bind the exact current Authorization Model")
    }
    const architectureElementKeys = new Set(systemSolutionArchitecture.elements.map((entry) => entry.key))
    const boundedContextKeys = new Set(boundedContextModel.boundedContexts.map((entry) => entry.key))
    const roleKeys = new Set(operatingModel.roles.map((entry) => entry.key))
    const processKeys = new Set(processModel.processes.map((entry) => entry.key))
    const processEventKeys = new Set(processModel.processes.flatMap((entry) => entry.events.map((event) => event.key)))
    const dataEntityKeys = new Set(dataModel.entities.map((entry) => entry.key))
    const authorizationActionKeys = new Set(authorizationModel.actions.map((entry) => entry.key))
    const authorizationRuleKeys = new Set(authorizationModel.rules.map((entry) => entry.key))
    const eventKeys = new Set(input.eventTypes.map((entry) => entry.key))
    const commandKeys = new Set(input.commands.map((entry) => entry.key))
    const referencedRoles = [
      ...input.eventTypes.flatMap((entry) => entry.producerRoleKeys),
      ...input.commands.flatMap((entry) => entry.actorRoleKeys),
      ...input.mappings.map((entry) => entry.reconciliationOwnerRoleKey),
      ...input.governance.integrationStewardRoleKeys,
      ...input.governance.eventStewardRoleKeys,
      ...input.governance.contractReviewerRoleKeys,
    ]
    if (referencedRoles.some((key) => !roleKeys.has(key))) {
      throw new Error("Event and Integration roles must reference exact bound Operating Model roles")
    }
    for (const eventType of input.eventTypes) {
      if (eventType.processEventKeys.some((key) => !processEventKeys.has(key)) ||
          !boundedContextKeys.has(eventType.producerBoundedContextKey) ||
          eventType.payloadDataEntityKeys.some((key) => !dataEntityKeys.has(key))) {
        throw new Error("Event Types must reference exact bound Process Events, Bounded Contexts, and Data entities")
      }
      const validSubjects = eventType.subjectKind === "architecture-element"
        ? architectureElementKeys
        : eventType.subjectKind === "bounded-context"
          ? boundedContextKeys
          : eventType.subjectKind === "data-entity"
            ? dataEntityKeys
            : processKeys
      if (eventType.subjectKeys.some((key) => !validSubjects.has(key))) {
        throw new Error("Event Type subjects must reference exact bound upstream subjects")
      }
    }
    for (const command of input.commands) {
      if (command.processKeys.some((key) => !processKeys.has(key)) ||
          command.targetBoundedContextKeys.some((key) => !boundedContextKeys.has(key)) ||
          [...command.inputDataEntityKeys, ...command.outputDataEntityKeys].some((key) => !dataEntityKeys.has(key)) ||
          command.authorizationActionKeys.some((key) => !authorizationActionKeys.has(key)) ||
          command.authorizationRuleKeys.some((key) => !authorizationRuleKeys.has(key))) {
        throw new Error("Commands must reference exact bound Processes, Bounded Contexts, Data entities, and Authorization subjects")
      }
    }
    const referencedContexts = [
      ...input.adapters.flatMap((entry) => entry.boundedContextKeys),
      ...input.externalContracts.flatMap((entry) => [
        ...entry.producerBoundedContextKeys, ...entry.consumerBoundedContextKeys,
      ]),
      ...input.routes.flatMap((entry) => [
        ...entry.producerBoundedContextKeys, ...entry.consumerBoundedContextKeys,
      ]),
    ]
    if (referencedContexts.some((key) => !boundedContextKeys.has(key))) {
      throw new Error("Adapters, External Contracts, and Routes must reference exact bound Bounded Contexts")
    }
    const validMappingSubjects = new Set([
      ...eventKeys, ...commandKeys, ...architectureElementKeys, ...boundedContextKeys,
      ...processKeys, ...dataEntityKeys, ...authorizationActionKeys,
    ])
    if (input.mappings.some((mapping) =>
      mapping.rows.some((row) => !validMappingSubjects.has(row.gaepSubjectKey)))) {
      throw new Error("Mapping rows must reference declared Event/Command subjects or exact bound upstream subjects")
    }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) {
      throw new Error("Event and Integration Model Initiative targets a different Product")
    }
    const expected = {
      productRevision: revisionOf(product),
      productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative),
      initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Event and Integration Model must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Event and Integration Model Source reference identity, Initiative, revision, record digest, or content digest does not match")
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
      throw new Error(`Terminal Initiative ${initiative.state} Event and Integration Model is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: EventIntegrationModel, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, eventIntegrationModelSchema),
        this.governed(this.historyPath(record.id, record.revision), record, eventIntegrationModelSchema),
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
          eventRegistryApprovalState: record.governance.eventRegistryApprovalState,
          commandRegistryApprovalState: record.governance.commandRegistryApprovalState,
          adapterEvaluationState: record.governance.adapterEvaluationState,
          externalContractAcceptanceState: record.governance.externalContractAcceptanceState,
          activationState: record.governance.activationState,
          operationalReadinessState: record.governance.operationalReadinessState,
          executionAuthorityState: record.governance.executionAuthorityState,
          reviewState: record.governance.reviewState,
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("event-integration-models", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve(
      "event-integration-model-history",
      `event-integration-model-${id}-r${revision}.json`,
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
    if (names.length > eventIntegrationModelInventoryLimit) {
      throw new Error(`Event and Integration Model directory ${directory} exceeds the ${eventIntegrationModelInventoryLimit}-record safety limit`)
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
