import { randomUUID } from "node:crypto"

import {
  exactSourceReferenceSchema,
  failureRecoveryModelInputSchema,
  failureRecoveryModelProjectionSchema,
  failureRecoveryModelSchema,
  failureRecoveryModelStatusSchema,
  type BusinessContextBinding,
  type ExactFailureRecoveryModelReference,
  type ExactSourceReference,
  type FailureRecoveryModel,
  type FailureRecoveryModelInput,
  type FailureRecoveryModelProjection,
  type FailureRecoveryModelStatus,
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
const failureRecoveryModelInventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: FailureRecoveryModel): ExactFailureRecoveryModelReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: FailureRecoveryModelInput) {
  return {
    systemSolutionArchitecture: input.systemSolutionArchitecture,
    boundedContextModel: input.boundedContextModel,
    operatingModel: input.operatingModel,
    securityPrivacyAssessment: input.securityPrivacyAssessment,
    processModel: input.processModel,
    dataModel: input.dataModel,
    authorizationModel: input.authorizationModel,
    eventIntegrationModel: input.eventIntegrationModel,
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

export class FailureRecoveryModelService {
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
  ) {}

  async create(inputValue: FailureRecoveryModelInput, actorId: string): Promise<FailureRecoveryModel> {
    const input = failureRecoveryModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindingsAndTrace(input)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Failure and Recovery Model candidate")
      }
      const now = new Date().toISOString()
      const record = failureRecoveryModelSchema.parse({
        schemaVersion: 1,
        kind: "failure-recovery-model-candidate",
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
          "failure-recovery-model-is-a-candidate-registry-and-does-not-prove-failure-occurrence-retry-safety-compensation-or-restoration-recovery-success-return-to-service-operational-readiness-or-authorize-action",
      })
      await this.commitVersionedRecord(record, "failure.recovery-model.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: FailureRecoveryModelInput,
    actorId: string,
  ): Promise<FailureRecoveryModel> {
    const input = failureRecoveryModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) {
        throw new Error("Failure and Recovery Model revision changed before update")
      }
      if (current.initiativeId !== input.initiativeId) {
        throw new Error("Failure and Recovery Model Initiative cannot change")
      }
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindingsAndTrace(input)
      const record = failureRecoveryModelSchema.parse({
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
      await this.commitVersionedRecord(record, "failure.recovery-model.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<FailureRecoveryModel> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Failure and Recovery Model ID")),
      failureRecoveryModelSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<FailureRecoveryModel | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("failure-recovery-models", currentRecordPattern, failureRecoveryModelSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) {
      throw new Error("Initiative has more than one current Failure and Recovery Model candidate")
    }
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<FailureRecoveryModel> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Failure and Recovery Model history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Failure and Recovery Model ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), failureRecoveryModelSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Failure and Recovery Model history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<FailureRecoveryModel[]> {
    const recordId = this.requireUuid(id, "Failure and Recovery Model ID")
    const records = await this.listRecords(
      "failure-recovery-model-history",
      new RegExp(`^failure-recovery-model-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      failureRecoveryModelSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Failure and Recovery Model history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<FailureRecoveryModelStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, model, systemSolutionArchitecture, boundedContextModel, operatingModel,
      securityPrivacyAssessment, processModel, dataModel, authorizationModel, eventIntegrationModel,
      currentSources] = await Promise.all([
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
      this.eventIntegrationModels.readCurrent(targetId),
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
      if (!eventIntegrationModel || !exactRecordMatches(model.eventIntegrationModel, eventIntegrationModel)) staleBindingCount += 1
      if (model.membershipDigest !== canonicalDigest(membership(model))) staleBindingCount += 1
    }
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(model).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const coveredProcesses = new Set([
      ...(model?.failureModes.flatMap((entry) => entry.affectedProcessKeys) ?? []),
      ...(model?.recoveryPlans.flatMap((entry) => entry.processKeys) ?? []),
    ])
    const coveredCommands = new Set([
      ...(model?.failureModes.flatMap((entry) => entry.affectedCommandKeys) ?? []),
      ...(model?.retryPolicies.flatMap((entry) => entry.commandKeys) ?? []),
      ...(model?.compensationPlans.flatMap((entry) => [...entry.originalCommandKeys, ...entry.compensationCommandKeys]) ?? []),
    ])
    const coveredRoutes = new Set([
      ...(model?.failureModes.flatMap((entry) => entry.affectedRouteKeys) ?? []),
      ...(model?.recoveryPlans.flatMap((entry) => entry.routeKeys) ?? []),
    ])
    const coveredAuthorizationActions = new Set([
      ...(model?.retryPolicies.flatMap((entry) => entry.authorizationActionKeys) ?? []),
      ...(model?.compensationPlans.flatMap((entry) => entry.authorizationActionKeys) ?? []),
      ...(model?.recoveryPlans.flatMap((entry) => entry.authorizationActionKeys) ?? []),
    ])
    const coveredRecoveryPlans = new Set(model?.recoveryEvidenceDefinitions.map((entry) => entry.recoveryPlanKey) ?? [])
    const uncoveredProcessCount = processModel?.processes.filter((entry) => !coveredProcesses.has(entry.key)).length ?? 0
    const uncoveredCommandCount = eventIntegrationModel?.commands.filter((entry) => !coveredCommands.has(entry.key)).length ?? 0
    const uncoveredRouteCount = eventIntegrationModel?.routes.filter((entry) => !coveredRoutes.has(entry.key)).length ?? 0
    const uncoveredAuthorizationActionCount = authorizationModel?.actions
      .filter((entry) => !coveredAuthorizationActions.has(entry.key)).length ?? 0
    const unresolvedRecoveryEvidenceCount = model?.recoveryPlans
      .filter((entry) => !coveredRecoveryPlans.has(entry.key)).length ?? 0
    const unresolvedRequirementCount = model?.requirementCoverage
      .filter((entry) => entry.state === "unresolved").length ?? 0
    const inconsistencyCount = model?.inconsistencies.length ?? 0
    const unresolvedQuestionCount = model?.unresolvedQuestions.length ?? 0
    const reasons: string[] = []
    if (!model) reasons.push("No versioned Failure and Recovery Model candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The Failure and Recovery Model does not bind the exact current Product, Initiative, or upstream Product records")
    if (staleSourceReferenceCount > 0) reasons.push("One or more Failure and Recovery claims reference a superseded Source revision")
    if (uncoveredProcessCount > 0) reasons.push("One or more exact Processes lack Failure or Recovery coverage")
    if (uncoveredCommandCount > 0) reasons.push("One or more exact Commands lack Failure, Retry, or Compensation coverage")
    if (uncoveredRouteCount > 0) reasons.push("One or more exact Routes lack Failure or Recovery coverage")
    if (uncoveredAuthorizationActionCount > 0) reasons.push("One or more exact Authorization Actions lack Retry, Compensation, or Recovery coverage")
    if (unresolvedRecoveryEvidenceCount > 0) reasons.push("One or more Recovery Plans lack an explicit Recovery Evidence Definition")
    if (unresolvedRequirementCount > 0) reasons.push("One or more State, Effect, or Runtime requirements remain unresolved")
    if (inconsistencyCount > 0) reasons.push("The Failure and Recovery Model records explicit inconsistencies")
    if (unresolvedQuestionCount > 0) reasons.push("The Failure and Recovery Model records unresolved questions")
    return failureRecoveryModelStatusSchema.parse({
      schemaVersion: 1,
      kind: "failure-recovery-model-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(model ? { model: exactReference(model) } : {}),
      failureModeCount: model?.failureModes.length ?? 0,
      retryPolicyCount: model?.retryPolicies.length ?? 0,
      compensationPlanCount: model?.compensationPlans.length ?? 0,
      recoveryPlanCount: model?.recoveryPlans.length ?? 0,
      recoveryEvidenceDefinitionCount: model?.recoveryEvidenceDefinitions.length ?? 0,
      uncoveredProcessCount,
      uncoveredCommandCount,
      uncoveredRouteCount,
      uncoveredAuthorizationActionCount,
      unresolvedRecoveryEvidenceCount,
      unresolvedRequirementCount,
      inconsistencyCount,
      unresolvedQuestionCount,
      staleBindingCount,
      staleSourceReferenceCount,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "failure-recovery-model-status-reports-candidate-coverage-and-gaps-and-does-not-prove-failure-occurrence-retry-safety-compensation-or-restoration-recovery-success-return-to-service-operational-readiness-or-authorize-action",
    })
  }

  async project(initiativeId: string): Promise<FailureRecoveryModelProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, model] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Failure and Recovery Model projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "failure-recovery-model-projection" as const,
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
          failureModeCount: model.failureModes.length,
          retryPolicyCount: model.retryPolicies.length,
          compensationPlanCount: model.compensationPlans.length,
          recoveryPlanCount: model.recoveryPlans.length,
          recoveryEvidenceDefinitionCount: model.recoveryEvidenceDefinitions.length,
          updatedAt: model.updatedAt,
        },
      } : {}),
      observedAt: new Date().toISOString(),
      privacyBoundary:
        "projection-contains-identities-counts-statuses-and-digests-only-not-failure-evidence-operational-telemetry-retry-keys-compensation-content-recovery-steps-source-content-personal-data-secrets-or-credentials" as const,
      authorityBoundary:
        "failure-recovery-model-projection-does-not-prove-failure-occurrence-retry-safety-compensation-or-restoration-recovery-success-return-to-service-operational-readiness-or-authorize-action" as const,
    }
    return failureRecoveryModelProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const [product, records] = await Promise.all([
      this.readProduct(),
      this.listRecords("failure-recovery-models", currentRecordPattern, failureRecoveryModelSchema),
    ])
    for (const model of records) {
      try {
        const initiative = await this.readInitiative(model.initiativeId)
        this.validateContext(model.context, product, initiative)
        await this.validateSourceReferences(model, initiative.id)
        await this.validateBindingsAndTrace(model)
        if (model.membershipDigest !== canonicalDigest(membership(model))) {
          throw new Error("Failure and Recovery Model membership digest is invalid")
        }
        const history = await this.listHistory(model.id)
        if (history.length !== model.revision || canonicalDigest(history[0]) !== canonicalDigest(model)) {
          throw new Error("Current Failure and Recovery Model does not match its complete immutable history")
        }
        const status = await this.assess(model.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "failure-recovery.model-binding-review-required",
            severity: "warning",
            message: `Initiative ${model.initiativeId} has stale Failure and Recovery Model bindings.`,
            record: { type: model.kind, id: model.id, revision: model.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "failure-recovery.model-invalid",
          severity: "error",
          message: `Failure and Recovery Model ${model.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: model.kind, id: model.id, revision: model.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private async validateBindingsAndTrace(input: FailureRecoveryModelInput): Promise<void> {
    const [systemSolutionArchitecture, boundedContextModel, operatingModel, securityPrivacyAssessment,
      processModel, dataModel, authorizationModel, eventIntegrationModel] = await Promise.all([
      this.systemSolutionArchitectures.readCurrent(input.initiativeId),
      this.boundedContextModels.readCurrent(input.initiativeId),
      this.operatingModels.readCurrent(input.initiativeId),
      this.securityPrivacyAssessments.readCurrent(input.initiativeId),
      this.processModels.readCurrent(input.initiativeId),
      this.dataModels.readCurrent(input.initiativeId),
      this.authorizationModels.readCurrent(input.initiativeId),
      this.eventIntegrationModels.readCurrent(input.initiativeId),
    ])
    const exactBindings = [
      [input.systemSolutionArchitecture, systemSolutionArchitecture, "System/Solution Architecture"],
      [input.boundedContextModel, boundedContextModel, "Bounded Context and Ownership Model"],
      [input.operatingModel, operatingModel, "Operating Model"],
      [input.securityPrivacyAssessment, securityPrivacyAssessment, "Security, Privacy, and Threat Assessment"],
      [input.processModel, processModel, "Process Model"],
      [input.dataModel, dataModel, "Data Model"],
      [input.authorizationModel, authorizationModel, "Authorization Model"],
      [input.eventIntegrationModel, eventIntegrationModel, "Event and Integration Model"],
    ] as const
    for (const [reference, record, label] of exactBindings) {
      if (!record || !exactRecordMatches(reference, record)) {
        throw new Error(`Failure and Recovery Model must bind the exact current ${label}`)
      }
    }
    if (!operatingModel || !processModel || !dataModel || !authorizationModel || !eventIntegrationModel) {
      throw new Error("Failure and Recovery Model upstream records are incomplete")
    }
    const roleKeys = new Set(operatingModel.roles.map((entry) => entry.key))
    const processKeys = new Set(processModel.processes.map((entry) => entry.key))
    const dataEntityKeys = new Set(dataModel.entities.map((entry) => entry.key))
    const authorizationActionKeys = new Set(authorizationModel.actions.map((entry) => entry.key))
    const eventKeys = new Set(eventIntegrationModel.eventTypes.map((entry) => entry.key))
    const commandKeys = new Set(eventIntegrationModel.commands.map((entry) => entry.key))
    const adapterKeys = new Set(eventIntegrationModel.adapters.map((entry) => entry.key))
    const routeKeys = new Set(eventIntegrationModel.routes.map((entry) => entry.key))
    for (const failure of input.failureModes) {
      if (failure.affectedProcessKeys.some((key) => !processKeys.has(key)) ||
          failure.affectedEventTypeKeys.some((key) => !eventKeys.has(key)) ||
          failure.affectedCommandKeys.some((key) => !commandKeys.has(key)) ||
          failure.affectedAdapterKeys.some((key) => !adapterKeys.has(key)) ||
          failure.affectedRouteKeys.some((key) => !routeKeys.has(key)) ||
          failure.affectedDataEntityKeys.some((key) => !dataEntityKeys.has(key))) {
        throw new Error("Failure Modes must reference exact bound Process, Event, Command, Adapter, Route, and Data subjects")
      }
    }
    for (const retry of input.retryPolicies) {
      if (retry.commandKeys.some((key) => !commandKeys.has(key)) ||
          retry.adapterKeys.some((key) => !adapterKeys.has(key)) ||
          retry.authorizationActionKeys.some((key) => !authorizationActionKeys.has(key))) {
        throw new Error("Retry Policies must reference exact bound Command, Adapter, and Authorization Action subjects")
      }
    }
    for (const compensation of input.compensationPlans) {
      if ([...compensation.originalCommandKeys, ...compensation.compensationCommandKeys]
        .some((key) => !commandKeys.has(key)) ||
          compensation.authorizationActionKeys.some((key) => !authorizationActionKeys.has(key)) ||
          compensation.affectedDataEntityKeys.some((key) => !dataEntityKeys.has(key))) {
        throw new Error("Compensation Plans must reference exact bound Command, Authorization Action, and Data subjects")
      }
    }
    for (const recovery of input.recoveryPlans) {
      if (recovery.processKeys.some((key) => !processKeys.has(key)) ||
          recovery.routeKeys.some((key) => !routeKeys.has(key)) ||
          recovery.ownerRoleKeys.some((key) => !roleKeys.has(key)) ||
          recovery.authorizationActionKeys.some((key) => !authorizationActionKeys.has(key))) {
        throw new Error("Recovery Plans must reference exact bound Process, Route, Role, and Authorization Action subjects")
      }
    }
    const governanceRoles = [
      ...input.governance.failureModelStewardRoleKeys,
      ...input.governance.recoveryOwnerRoleKeys,
      ...input.governance.recoveryVerifierRoleKeys,
    ]
    if (governanceRoles.some((key) => !roleKeys.has(key))) {
      throw new Error("Failure and Recovery governance must reference exact bound Operating Model roles")
    }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) {
      throw new Error("Failure and Recovery Model Initiative targets a different Product")
    }
    const expected = {
      productRevision: revisionOf(product),
      productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative),
      initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Failure and Recovery Model must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Failure and Recovery Model Source reference identity, Initiative, revision, record digest, or content digest does not match")
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
      throw new Error(`Terminal Initiative ${initiative.state} Failure and Recovery Model is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: FailureRecoveryModel, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, failureRecoveryModelSchema),
        this.governed(this.historyPath(record.id, record.revision), record, failureRecoveryModelSchema),
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
          failureRegistryApprovalState: record.governance.failureRegistryApprovalState,
          retrySafetyState: record.governance.retrySafetyState,
          compensationApprovalState: record.governance.compensationApprovalState,
          recoveryPlanApprovalState: record.governance.recoveryPlanApprovalState,
          recoveryEvidenceAcceptanceState: record.governance.recoveryEvidenceAcceptanceState,
          operationalReadinessState: record.governance.operationalReadinessState,
          returnToServiceAuthorityState: record.governance.returnToServiceAuthorityState,
          executionAuthorityState: record.governance.executionAuthorityState,
          reviewState: record.governance.reviewState,
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("failure-recovery-models", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve(
      "failure-recovery-model-history",
      `failure-recovery-model-${id}-r${revision}.json`,
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
    if (names.length > failureRecoveryModelInventoryLimit) {
      throw new Error(`Failure and Recovery Model directory ${directory} exceeds the ${failureRecoveryModelInventoryLimit}-record safety limit`)
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
