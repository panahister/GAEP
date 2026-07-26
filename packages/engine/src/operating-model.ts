import { randomUUID } from "node:crypto"

import {
  exactSourceReferenceSchema,
  operatingModelAssessmentSchema,
  operatingModelInputSchema,
  operatingModelProjectionSchema,
  operatingModelSchema,
  type BusinessContextBinding,
  type ExactBusinessUnderstandingReference,
  type ExactOperatingModelReference,
  type ExactSourceReference,
  type Initiative,
  type OperatingModel,
  type OperatingModelAssessment,
  type OperatingModelInput,
  type OperatingModelProjection,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { BusinessCapabilityMapService } from "./business-capability-map.js"
import type { BusinessUnderstandingService } from "./business-understanding.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"
import type { ValueStreamModelService } from "./value-stream-model.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const operatingModelInventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: OperatingModel): ExactOperatingModelReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
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
  reference: ExactBusinessUnderstandingReference,
  record: { id: string; revision: number },
): boolean {
  return reference.recordId === record.id &&
    reference.revision === record.revision &&
    reference.digest === canonicalDigest(record)
}

export class OperatingModelService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly businessUnderstanding: BusinessUnderstandingService,
    private readonly capabilityMaps: BusinessCapabilityMapService,
    private readonly valueStreams: ValueStreamModelService,
  ) {}

  async create(inputValue: OperatingModelInput, actorId: string): Promise<OperatingModel> {
    const input = operatingModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateUpstreamAndTrace(input)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Operating Model")
      }
      const now = new Date().toISOString()
      const record = operatingModelSchema.parse({
        schemaVersion: 1,
        kind: "operating-model",
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
          "operating-model-records-candidate-roles-responsibilities-decision-rights-capacity-support-and-emergency-boundaries-and-does-not-appoint-fund-approve-baseline-or-authorize-action",
      })
      await this.commitVersionedRecord(record, "business.operating-model.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: OperatingModelInput,
    actorId: string,
  ): Promise<OperatingModel> {
    const input = operatingModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Operating Model revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Operating Model Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateUpstreamAndTrace(input)
      const record = operatingModelSchema.parse({
        ...current,
        ...input,
        productId: product.id,
        initiativeId: initiative.id,
        revision: current.revision + 1,
        predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId },
        updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, "business.operating-model.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<OperatingModel> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Operating Model ID")), operatingModelSchema)
  }

  async readCurrent(initiativeId: string): Promise<OperatingModel | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("operating-models", currentRecordPattern, operatingModelSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Operating Model")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<OperatingModel> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Operating Model history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Operating Model ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), operatingModelSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Operating Model history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<OperatingModel[]> {
    const recordId = this.requireUuid(id, "Operating Model ID")
    const records = await this.listRecords(
      "operating-model-history",
      new RegExp(`^operating-model-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      operatingModelSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Operating Model history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<OperatingModelAssessment> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, model, business, stakeholder, outcome, capabilityMap, valueStreamModel, currentSources] =
      await Promise.all([
        this.readProduct(),
        this.readInitiative(targetId),
        this.readCurrent(targetId),
        this.businessUnderstanding.readCurrentBusinessUnderstanding(targetId),
        this.businessUnderstanding.readCurrentStakeholderModel(targetId),
        this.businessUnderstanding.readCurrentOutcomeModel(targetId),
        this.capabilityMaps.readCurrent(targetId),
        this.valueStreams.readCurrent(targetId),
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
      if (!business || !exactRecordMatches(model.businessUnderstanding, business)) staleBindingCount += 1
      if (!stakeholder || !exactRecordMatches(model.stakeholderModel, stakeholder)) staleBindingCount += 1
      if (!outcome || !exactRecordMatches(model.outcomeModel, outcome)) staleBindingCount += 1
      if (!capabilityMap || !exactRecordMatches(model.capabilityMap, capabilityMap)) staleBindingCount += 1
      if (!valueStreamModel || !exactRecordMatches(model.valueStreamModel, valueStreamModel)) staleBindingCount += 1
    }
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(model).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const roles = model?.roles ?? []
    const decisionRights = model?.decisionRights ?? []
    const unassignedAppointingAuthorityCount = roles.filter(
      (role) => role.appointingAuthority.state === "unassigned",
    ).length
    const insufficientCapacityCount = roles.filter(
      (role) => role.capacity.state !== "candidate-sufficient",
    ).length
    const unfundedCapacityCount = roles.filter((role) => role.capacity.fundingState === "unassigned").length
    const unassignedDecisionAuthorityCount = decisionRights.filter(
      (right) => right.authority.state === "unassigned",
    ).length
    const supportCapacityGapCount = model && model.supportModel.capacity.state !== "candidate-sufficient" ? 1 : 0
    const emergencyAuthorityGapCount = model && model.emergencyActionModel.authority.state === "unassigned" ? 1 : 0
    const reasons: string[] = []
    if (!model) reasons.push("No versioned Operating Model exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The Operating Model does not bind the exact current Product, Initiative, or upstream business records")
    if (staleSourceReferenceCount > 0) reasons.push("One or more operating-model claims reference a superseded Source revision")
    if (unassignedAppointingAuthorityCount > 0) reasons.push("One or more candidate roles have no candidate appointing authority")
    if (insufficientCapacityCount > 0) reasons.push("One or more candidate roles have unassessed or insufficient operating capacity")
    if (unfundedCapacityCount > 0) reasons.push("One or more candidate roles have no candidate funding basis")
    if (unassignedDecisionAuthorityCount > 0) reasons.push("One or more decision rights have no candidate accountable authority")
    if (supportCapacityGapCount > 0) reasons.push("The candidate support model has unassessed or insufficient capacity")
    if (emergencyAuthorityGapCount > 0) reasons.push("The emergency action model has no candidate authority")
    return operatingModelAssessmentSchema.parse({
      schemaVersion: 1,
      kind: "operating-model-assessment",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(model ? { operatingModel: exactReference(model) } : {}),
      roleCount: roles.length,
      governanceSystemCount: new Set(roles.map((role) => role.governanceSystem)).size,
      unassignedAppointingAuthorityCount,
      insufficientCapacityCount,
      unfundedCapacityCount,
      decisionRightCount: decisionRights.length,
      unassignedDecisionAuthorityCount,
      forumCount: model?.forums.length ?? 0,
      cycleCount: model?.cycles.length ?? 0,
      supportCapacityGapCount,
      emergencyAuthorityGapCount,
      staleBindingCount,
      staleSourceReferenceCount,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "operating-model-assessment-reports-candidate-structural-coverage-and-gaps-and-does-not-appoint-fund-approve-baseline-readiness-or-authorize-action",
    })
  }

  async project(initiativeId: string): Promise<OperatingModelProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, assessment, model] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (assessment.productId !== product.id || assessment.productRevision !== revisionOf(product) ||
        assessment.initiativeId !== initiative.id || assessment.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Operating Model projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "operating-model-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: {
        id: initiative.id,
        revision: revisionOf(initiative),
        digest: canonicalDigest(initiative),
        state: initiative.state,
      },
      assessment,
      ...(model ? {
        operatingModel: {
          id: model.id,
          revision: model.revision,
          digest: canonicalDigest(model),
          state: model.state,
          roleCount: model.roles.length,
          decisionRightCount: model.decisionRights.length,
          forumCount: model.forums.length,
          cycleCount: model.cycles.length,
          updatedAt: model.updatedAt,
        },
      } : {}),
      observedAt: new Date().toISOString(),
      privacyBoundary:
        "projection-contains-identities-counts-statuses-and-digests-only-not-operating-narrative-personal-data-source-content-locators-or-credentials" as const,
      authorityBoundary:
        "operating-model-projection-does-not-appoint-fund-approve-baseline-readiness-or-authorize-action" as const,
    }
    return operatingModelProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const [product, models] = await Promise.all([
      this.readProduct(),
      this.listRecords("operating-models", currentRecordPattern, operatingModelSchema),
    ])
    for (const model of models) {
      try {
        const initiative = await this.readInitiative(model.initiativeId)
        this.validateContext(model.context, product, initiative)
        await this.validateSourceReferences(model, initiative.id)
        await this.validateUpstreamAndTrace(model)
        const history = await this.listHistory(model.id)
        if (history.length !== model.revision || canonicalDigest(history[0]) !== canonicalDigest(model)) {
          throw new Error("Current Operating Model does not match its complete immutable history")
        }
        const assessment = await this.assess(model.initiativeId)
        if (assessment.staleBindingCount > 0 || assessment.staleSourceReferenceCount > 0) {
          issues.push({
            code: "business.operating-model-binding-review-required",
            severity: "warning",
            message: `Initiative ${model.initiativeId} has stale Operating Model bindings.`,
            record: { type: model.kind, id: model.id, revision: model.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "business.operating-model-invalid",
          severity: "error",
          message: `Operating Model ${model.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: model.kind, id: model.id, revision: model.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private async validateUpstreamAndTrace(input: OperatingModelInput): Promise<void> {
    const [business, stakeholder, outcome, capabilityMap, valueStreamModel] = await Promise.all([
      this.businessUnderstanding.readCurrentBusinessUnderstanding(input.initiativeId),
      this.businessUnderstanding.readCurrentStakeholderModel(input.initiativeId),
      this.businessUnderstanding.readCurrentOutcomeModel(input.initiativeId),
      this.capabilityMaps.readCurrent(input.initiativeId),
      this.valueStreams.readCurrent(input.initiativeId),
    ])
    if (!business || !exactRecordMatches(input.businessUnderstanding, business)) {
      throw new Error("Operating Model must bind the exact current Business Understanding")
    }
    if (!stakeholder || !exactRecordMatches(input.stakeholderModel, stakeholder)) {
      throw new Error("Operating Model must bind the exact current Stakeholder Model")
    }
    if (!outcome || !exactRecordMatches(input.outcomeModel, outcome)) {
      throw new Error("Operating Model must bind the exact current Outcome Model")
    }
    if (!capabilityMap || !exactRecordMatches(input.capabilityMap, capabilityMap)) {
      throw new Error("Operating Model must bind the exact current Business Capability Map")
    }
    if (!valueStreamModel || !exactRecordMatches(input.valueStreamModel, valueStreamModel)) {
      throw new Error("Operating Model must bind the exact current Value Stream Model")
    }
    const stakeholderKeys = new Set(stakeholder.stakeholders.map((entry) => entry.key))
    const capabilityKeys = new Set(capabilityMap.capabilities.map((entry) => entry.key))
    const valueStreamKeys = new Set(valueStreamModel.valueStreams.map((entry) => entry.key))
    const roleByKey = new Map(input.roles.map((role) => [role.key, role]))
    for (const role of input.roles) {
      if (role.stakeholderKeys.some((key) => !stakeholderKeys.has(key))) {
        throw new Error("Operating roles must reference the exact bound Stakeholder Model")
      }
      if (role.capabilityKeys.some((key) => !capabilityKeys.has(key))) {
        throw new Error("Operating roles must reference the exact bound Business Capability Map")
      }
      if (role.valueStreamKeys.some((key) => !valueStreamKeys.has(key))) {
        throw new Error("Operating roles must reference the exact bound Value Stream Model")
      }
    }
    for (const right of input.decisionRights) {
      if (right.valueStreamKeys.some((key) => !valueStreamKeys.has(key))) {
        throw new Error("Operating decision rights must reference the exact bound Value Stream Model")
      }
      if (roleByKey.get(right.accountableRoleKey)?.governanceSystem !== right.governanceSystem) {
        throw new Error("Operating decision rights must remain in the accountable role governance system")
      }
    }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Operating Model Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product),
      productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative),
      initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Operating Model must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Operating Model Source reference identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Operating Model is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: OperatingModel, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, operatingModelSchema),
        this.governed(this.historyPath(record.id, record.revision), record, operatingModelSchema),
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

  private currentPath(id: string): string {
    return this.repository.resolve("operating-models", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("operating-model-history", `operating-model-${id}-r${revision}.json`)
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
    if (names.length > operatingModelInventoryLimit) {
      throw new Error(`Operating Model directory ${directory} exceeds the ${operatingModelInventoryLimit}-record safety limit`)
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
