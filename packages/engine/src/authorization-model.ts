import { randomUUID } from "node:crypto"

import {
  authorizationModelInputSchema,
  authorizationModelProjectionSchema,
  authorizationModelSchema,
  authorizationModelStatusSchema,
  exactSourceReferenceSchema,
  type AuthorizationModel,
  type AuthorizationModelInput,
  type AuthorizationModelProjection,
  type AuthorizationModelStatus,
  type BusinessContextBinding,
  type ExactAuthorizationModelReference,
  type ExactSourceReference,
  type Initiative,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

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
const authorizationModelInventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: AuthorizationModel): ExactAuthorizationModelReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: AuthorizationModelInput) {
  return {
    systemSolutionArchitecture: input.systemSolutionArchitecture,
    boundedContextModel: input.boundedContextModel,
    operatingModel: input.operatingModel,
    securityPrivacyAssessment: input.securityPrivacyAssessment,
    processModel: input.processModel,
    dataModel: input.dataModel,
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

export class AuthorizationModelService {
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
  ) {}

  async create(inputValue: AuthorizationModelInput, actorId: string): Promise<AuthorizationModel> {
    const input = authorizationModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindingsAndTrace(input)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Authorization Model candidate")
      }
      const now = new Date().toISOString()
      const record = authorizationModelSchema.parse({
        schemaVersion: 1,
        kind: "authorization-model-candidate",
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
          "authorization-model-is-a-candidate-record-and-does-not-verify-identity-approve-role-assignments-or-standing-authority-create-an-authorization-grant-enforce-policy-establish-operational-readiness-or-authorize-action",
      })
      await this.commitVersionedRecord(record, "authorization.model.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: AuthorizationModelInput,
    actorId: string,
  ): Promise<AuthorizationModel> {
    const input = authorizationModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Authorization Model revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Authorization Model Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindingsAndTrace(input)
      const record = authorizationModelSchema.parse({
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
      await this.commitVersionedRecord(record, "authorization.model.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<AuthorizationModel> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Authorization Model ID")),
      authorizationModelSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<AuthorizationModel | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("authorization-models", currentRecordPattern, authorizationModelSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Authorization Model candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<AuthorizationModel> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Authorization Model history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Authorization Model ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), authorizationModelSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Authorization Model history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<AuthorizationModel[]> {
    const recordId = this.requireUuid(id, "Authorization Model ID")
    const records = await this.listRecords(
      "authorization-model-history",
      new RegExp(`^authorization-model-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      authorizationModelSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Authorization Model history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<AuthorizationModelStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, model, systemSolutionArchitecture, boundedContextModel, operatingModel,
      securityPrivacyAssessment, processModel, dataModel, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.systemSolutionArchitectures.readCurrent(targetId),
      this.boundedContextModels.readCurrent(targetId),
      this.operatingModels.readCurrent(targetId),
      this.securityPrivacyAssessments.readCurrent(targetId),
      this.processModels.readCurrent(targetId),
      this.dataModels.readCurrent(targetId),
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
      if (model.membershipDigest !== canonicalDigest(membership(model))) staleBindingCount += 1
    }
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(model).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const coveredRoles = new Set([
      ...(model?.principals.flatMap((entry) => entry.operatingRoleKeys) ?? []),
      ...(model?.roleAssignments.flatMap((entry) => [entry.operatingRoleKey, entry.assigningAuthorityRoleKey]) ?? []),
      ...(model?.rules.flatMap((entry) => entry.roleKeys) ?? []),
      ...(model?.approvalBindings.flatMap((entry) => entry.approverRoleKeys) ?? []),
      ...(model ? [
        ...model.governance.securityAuthorityRoleKeys,
        ...model.governance.identityAuthorityRoleKeys,
        ...model.governance.modelReviewerRoleKeys,
      ] : []),
    ])
    const coveredProcesses = new Set(model?.actions.flatMap((entry) => entry.processKeys) ?? [])
    const coveredDataEntities = new Set(model?.resources
      .filter((entry) => entry.kind === "data-entity").map((entry) => entry.subjectKey) ?? [])
    const uncoveredOperatingRoleCount = operatingModel?.roles.filter((entry) => !coveredRoles.has(entry.key)).length ?? 0
    const uncoveredProcessCount = processModel?.processes.filter((entry) => !coveredProcesses.has(entry.key)).length ?? 0
    const uncoveredDataEntityCount = dataModel?.entities.filter((entry) => !coveredDataEntities.has(entry.key)).length ?? 0
    const unresolvedIdentityCount = model?.principals.filter((entry) => entry.identitySourceState === "unresolved").length ?? 0
    const unresolvedRuleCount = model?.rules.filter((entry) => entry.decision === "unresolved").length ?? 0
    const unresolvedRequirementCount = model?.requirementCoverage
      .filter((entry) => entry.state === "unresolved").length ?? 0
    const inconsistencyCount = model?.inconsistencies.length ?? 0
    const unresolvedQuestionCount = model?.unresolvedQuestions.length ?? 0
    const reasons: string[] = []
    if (!model) reasons.push("No versioned Authorization Model candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The Authorization Model does not bind the exact current Product, Initiative, or upstream Product records")
    if (staleSourceReferenceCount > 0) reasons.push("One or more Authorization Model claims reference a superseded Source revision")
    if (uncoveredOperatingRoleCount > 0) reasons.push("One or more exact Operating Model roles lack Authorization Model coverage")
    if (uncoveredProcessCount > 0) reasons.push("One or more exact Processes lack Authorization Model coverage")
    if (uncoveredDataEntityCount > 0) reasons.push("One or more exact Data entities lack Authorization Model coverage")
    if (unresolvedIdentityCount > 0) reasons.push("One or more Principal identity sources remain unresolved")
    if (unresolvedRuleCount > 0) reasons.push("One or more Authorization Rules remain unresolved")
    if (unresolvedRequirementCount > 0) reasons.push("One or more Identity/Authority or Decision/Review/Approval/Authorization requirements remain unresolved")
    if (inconsistencyCount > 0) reasons.push("The Authorization Model records explicit inconsistencies")
    if (unresolvedQuestionCount > 0) reasons.push("The Authorization Model records unresolved questions")
    return authorizationModelStatusSchema.parse({
      schemaVersion: 1,
      kind: "authorization-model-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(model ? { model: exactReference(model) } : {}),
      principalCount: model?.principals.length ?? 0,
      roleAssignmentCount: model?.roleAssignments.length ?? 0,
      resourceCount: model?.resources.length ?? 0,
      actionCount: model?.actions.length ?? 0,
      approvalBindingCount: model?.approvalBindings.length ?? 0,
      ruleCount: model?.rules.length ?? 0,
      uncoveredOperatingRoleCount,
      uncoveredProcessCount,
      uncoveredDataEntityCount,
      unresolvedIdentityCount,
      unresolvedRuleCount,
      unresolvedRequirementCount,
      inconsistencyCount,
      unresolvedQuestionCount,
      staleBindingCount,
      staleSourceReferenceCount,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "authorization-model-status-reports-candidate-coverage-and-gaps-and-does-not-verify-identity-approve-role-assignments-or-standing-authority-create-an-authorization-grant-enforce-policy-establish-operational-readiness-or-authorize-action",
    })
  }

  async project(initiativeId: string): Promise<AuthorizationModelProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, model] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Authorization Model projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "authorization-model-projection" as const,
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
          principalCount: model.principals.length,
          actionCount: model.actions.length,
          ruleCount: model.rules.length,
          updatedAt: model.updatedAt,
        },
      } : {}),
      observedAt: new Date().toISOString(),
      privacyBoundary:
        "projection-contains-identities-counts-statuses-and-digests-only-not-principal-identifiers-role-assignments-rules-conditions-approval-content-source-content-personal-data-locators-secrets-or-credentials" as const,
      authorityBoundary:
        "authorization-model-projection-does-not-verify-identity-approve-role-assignments-or-standing-authority-create-an-authorization-grant-enforce-policy-establish-operational-readiness-or-authorize-action" as const,
    }
    return authorizationModelProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const [product, records] = await Promise.all([
      this.readProduct(),
      this.listRecords("authorization-models", currentRecordPattern, authorizationModelSchema),
    ])
    for (const model of records) {
      try {
        const initiative = await this.readInitiative(model.initiativeId)
        this.validateContext(model.context, product, initiative)
        await this.validateSourceReferences(model, initiative.id)
        await this.validateBindingsAndTrace(model)
        if (model.membershipDigest !== canonicalDigest(membership(model))) {
          throw new Error("Authorization Model membership digest is invalid")
        }
        const history = await this.listHistory(model.id)
        if (history.length !== model.revision || canonicalDigest(history[0]) !== canonicalDigest(model)) {
          throw new Error("Current Authorization Model does not match its complete immutable history")
        }
        const status = await this.assess(model.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "authorization.model-binding-review-required",
            severity: "warning",
            message: `Initiative ${model.initiativeId} has stale Authorization Model bindings.`,
            record: { type: model.kind, id: model.id, revision: model.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "authorization.model-invalid",
          severity: "error",
          message: `Authorization Model ${model.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: model.kind, id: model.id, revision: model.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private async validateBindingsAndTrace(input: AuthorizationModelInput): Promise<void> {
    const [systemSolutionArchitecture, boundedContextModel, operatingModel, securityPrivacyAssessment,
      processModel, dataModel] = await Promise.all([
      this.systemSolutionArchitectures.readCurrent(input.initiativeId),
      this.boundedContextModels.readCurrent(input.initiativeId),
      this.operatingModels.readCurrent(input.initiativeId),
      this.securityPrivacyAssessments.readCurrent(input.initiativeId),
      this.processModels.readCurrent(input.initiativeId),
      this.dataModels.readCurrent(input.initiativeId),
    ])
    if (!systemSolutionArchitecture || !exactRecordMatches(input.systemSolutionArchitecture, systemSolutionArchitecture)) {
      throw new Error("Authorization Model must bind the exact current System/Solution Architecture")
    }
    if (!boundedContextModel || !exactRecordMatches(input.boundedContextModel, boundedContextModel)) {
      throw new Error("Authorization Model must bind the exact current Bounded Context and Ownership Model")
    }
    if (!operatingModel || !exactRecordMatches(input.operatingModel, operatingModel)) {
      throw new Error("Authorization Model must bind the exact current Operating Model")
    }
    if (!securityPrivacyAssessment || !exactRecordMatches(input.securityPrivacyAssessment, securityPrivacyAssessment)) {
      throw new Error("Authorization Model must bind the exact current Security, Privacy, and Threat Assessment")
    }
    if (!processModel || !exactRecordMatches(input.processModel, processModel)) {
      throw new Error("Authorization Model must bind the exact current Process Model")
    }
    if (!dataModel || !exactRecordMatches(input.dataModel, dataModel)) {
      throw new Error("Authorization Model must bind the exact current Data Model")
    }
    const architectureElementKeys = new Set(systemSolutionArchitecture.elements.map((entry) => entry.key))
    const boundedContextKeys = new Set(boundedContextModel.boundedContexts.map((entry) => entry.key))
    const roleKeys = new Set(operatingModel.roles.map((entry) => entry.key))
    const processKeys = new Set(processModel.processes.map((entry) => entry.key))
    const approvalRequirementKeys = new Set(
      processModel.processes.flatMap((process) => process.approvalRequirements.map((entry) => entry.key)),
    )
    const dataEntityKeys = new Set(dataModel.entities.map((entry) => entry.key))
    const referencedRoles = [
      ...input.principals.flatMap((entry) => entry.operatingRoleKeys),
      ...input.roleAssignments.flatMap((entry) => [entry.operatingRoleKey, entry.assigningAuthorityRoleKey]),
      ...input.rules.flatMap((entry) => entry.roleKeys),
      ...input.approvalBindings.flatMap((entry) => entry.approverRoleKeys),
      ...input.governance.securityAuthorityRoleKeys,
      ...input.governance.identityAuthorityRoleKeys,
      ...input.governance.modelReviewerRoleKeys,
    ]
    if (referencedRoles.some((key) => !roleKeys.has(key))) {
      throw new Error("Authorization Model roles must reference exact bound Operating Model roles")
    }
    if (input.roleAssignments.some((entry) => entry.scopeKeys.some((key) => !boundedContextKeys.has(key)))) {
      throw new Error("Role Assignment scopes must reference exact bound Bounded Contexts")
    }
    for (const action of input.actions) {
      if (action.processKeys.some((key) => !processKeys.has(key))) {
        throw new Error("Authorization Actions must reference exact bound Processes")
      }
      if (action.approvalRequirementKeys.some((key) => !approvalRequirementKeys.has(key))) {
        throw new Error("Authorization Actions must reference exact bound Process approval requirements")
      }
    }
    for (const resource of input.resources) {
      if (resource.scopeKeys.some((key) => !boundedContextKeys.has(key))) {
        throw new Error("Authorization Resource scopes must reference exact bound Bounded Contexts")
      }
      const validSubject = resource.kind === "architecture-element"
        ? architectureElementKeys.has(resource.subjectKey)
        : resource.kind === "bounded-context"
          ? boundedContextKeys.has(resource.subjectKey)
          : resource.kind === "data-entity"
            ? dataEntityKeys.has(resource.subjectKey)
            : processKeys.has(resource.subjectKey)
      if (!validSubject) throw new Error("Authorization Resources must reference exact bound upstream subjects")
    }
    if (input.approvalBindings.some((entry) =>
      entry.processApprovalRequirementKeys.some((key) => !approvalRequirementKeys.has(key)))) {
      throw new Error("Approval Bindings must reference exact bound Process approval requirements")
    }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Authorization Model Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product),
      productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative),
      initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Authorization Model must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Authorization Model Source reference identity, Initiative, revision, record digest, or content digest does not match")
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
      throw new Error(`Terminal Initiative ${initiative.state} Authorization Model is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: AuthorizationModel, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, authorizationModelSchema),
        this.governed(this.historyPath(record.id, record.revision), record, authorizationModelSchema),
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
          identityVerificationState: record.governance.identityVerificationState,
          roleAssignmentApprovalState: record.governance.roleAssignmentApprovalState,
          standingAuthorityState: record.governance.standingAuthorityState,
          authorizationGrantState: record.governance.authorizationGrantState,
          enforcementState: record.governance.enforcementState,
          reviewState: record.governance.reviewState,
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("authorization-models", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("authorization-model-history", `authorization-model-${id}-r${revision}.json`)
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
    if (names.length > authorizationModelInventoryLimit) {
      throw new Error(`Authorization Model directory ${directory} exceeds the ${authorizationModelInventoryLimit}-record safety limit`)
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
