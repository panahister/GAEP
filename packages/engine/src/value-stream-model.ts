import { randomUUID } from "node:crypto"

import {
  exactSourceReferenceSchema,
  valueStreamModelAssessmentSchema,
  valueStreamModelInputSchema,
  valueStreamModelProjectionSchema,
  valueStreamModelSchema,
  type BusinessContextBinding,
  type ExactBusinessUnderstandingReference,
  type ExactSourceReference,
  type ExactValueStreamModelReference,
  type Initiative,
  type Product,
  type ValueStreamModel,
  type ValueStreamModelAssessment,
  type ValueStreamModelInput,
  type ValueStreamModelProjection,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { BusinessCapabilityMapService } from "./business-capability-map.js"
import type { BusinessUnderstandingService } from "./business-understanding.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const valueStreamInventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: ValueStreamModel): ExactValueStreamModelReference {
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

function exactRecordMatches(
  reference: ExactBusinessUnderstandingReference,
  record: { id: string; revision: number },
): boolean {
  return reference.recordId === record.id &&
    reference.revision === record.revision &&
    reference.digest === canonicalDigest(record)
}

export class ValueStreamModelService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly businessUnderstanding: BusinessUnderstandingService,
    private readonly capabilityMaps: BusinessCapabilityMapService,
  ) {}

  async create(inputValue: ValueStreamModelInput, actorId: string): Promise<ValueStreamModel> {
    const input = valueStreamModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateUpstreamAndTrace(input)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Value Stream Model")
      }
      const now = new Date().toISOString()
      const record = valueStreamModelSchema.parse({
        schemaVersion: 1,
        kind: "value-stream-model",
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
          "value-stream-model-records-candidate-value-flow-stages-dependencies-ownership-bottlenecks-and-does-not-approve-baseline-readiness-or-authorize-action",
      })
      await this.commitVersionedRecord(record, "business.value-stream-model.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: ValueStreamModelInput,
    actorId: string,
  ): Promise<ValueStreamModel> {
    const input = valueStreamModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) {
        throw new Error("Value Stream Model revision changed before update")
      }
      if (current.initiativeId !== input.initiativeId) {
        throw new Error("Value Stream Model Initiative cannot change")
      }
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateUpstreamAndTrace(input)
      const record = valueStreamModelSchema.parse({
        ...current,
        ...input,
        productId: product.id,
        initiativeId: initiative.id,
        revision: current.revision + 1,
        predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId },
        updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, "business.value-stream-model.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<ValueStreamModel> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Value Stream Model ID")),
      valueStreamModelSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<ValueStreamModel | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("value-stream-models", currentRecordPattern, valueStreamModelSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Value Stream Model")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<ValueStreamModel> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Value Stream Model history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Value Stream Model ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), valueStreamModelSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Value Stream Model history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<ValueStreamModel[]> {
    const recordId = this.requireUuid(id, "Value Stream Model ID")
    const records = await this.listRecords(
      "value-stream-model-history",
      new RegExp(`^value-stream-model-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      valueStreamModelSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (
        record.id !== recordId ||
        record.revision !== index + 1 ||
        (index === 0 && record.predecessorDigest !== undefined) ||
        (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))
      ) {
        throw new Error("Value Stream Model history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<ValueStreamModelAssessment> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, model, business, stakeholder, outcome, capabilityMap, currentSources] =
      await Promise.all([
        this.readProduct(),
        this.readInitiative(targetId),
        this.readCurrent(targetId),
        this.businessUnderstanding.readCurrentBusinessUnderstanding(targetId),
        this.businessUnderstanding.readCurrentStakeholderModel(targetId),
        this.businessUnderstanding.readCurrentOutcomeModel(targetId),
        this.capabilityMaps.readCurrent(targetId),
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
    }
    const currentSourceById = new Map(currentSources.map((source) => [source.id, source]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(model).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current ||
        current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest ||
        current.contentDigest !== reference.contentDigest
    }).length
    const streams = model?.valueStreams ?? []
    const ownedValueStreamCount = streams.filter((stream) => stream.ownerStakeholderKey).length
    const unownedValueStreamCount = streams.length - ownedValueStreamCount
    const stages = streams.flatMap((stream) => stream.stages)
    const openBottlenecks = streams.flatMap((stream) =>
      stream.bottlenecks.filter((bottleneck) => bottleneck.status !== "resolved"))
    const criticalBottleneckCount = openBottlenecks.filter(
      (bottleneck) => bottleneck.severity === "critical",
    ).length
    const absentFlowEvidenceCount = stages.filter((stage) => stage.flowEvidence.state === "absent").length
    const reasons: string[] = []
    if (!model) reasons.push("No versioned Value Stream Model exists for this Initiative")
    if (staleBindingCount > 0) {
      reasons.push("The Value Stream Model does not bind the exact current Product, Initiative, or upstream business records")
    }
    if (staleSourceReferenceCount > 0) {
      reasons.push("One or more value-stream claims reference a superseded Source revision")
    }
    if (unownedValueStreamCount > 0) reasons.push("One or more value streams do not have a candidate owner")
    if (absentFlowEvidenceCount > 0) reasons.push("One or more value-stream stages have no flow evidence")
    if (openBottlenecks.length > 0) reasons.push("One or more value-stream bottlenecks remain open")
    return valueStreamModelAssessmentSchema.parse({
      schemaVersion: 1,
      kind: "value-stream-model-assessment",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(model ? { valueStreamModel: exactReference(model) } : {}),
      valueStreamCount: streams.length,
      ownedValueStreamCount,
      unownedValueStreamCount,
      stageCount: stages.length,
      dependencyCount: streams.reduce((total, stream) => total + stream.dependencyKeys.length, 0),
      capabilityCoverageCount: new Set(streams.flatMap((stream) => stream.capabilityKeys)).size,
      outcomeCoverageCount: new Set(streams.flatMap((stream) => stream.outcomeIds)).size,
      absentFlowEvidenceCount,
      openBottleneckCount: openBottlenecks.length,
      criticalBottleneckCount,
      staleBindingCount,
      staleSourceReferenceCount,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "value-stream-model-assessment-reports-recorded-candidate-flow-coverage-and-gaps-and-does-not-approve-baseline-readiness-or-authorize-action",
    })
  }

  async project(initiativeId: string): Promise<ValueStreamModelProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, assessment, model] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.assess(targetId),
      this.readCurrent(targetId),
    ])
    if (
      assessment.productId !== product.id ||
      assessment.productRevision !== revisionOf(product) ||
      assessment.initiativeId !== initiative.id ||
      assessment.initiativeRevision !== revisionOf(initiative)
    ) {
      throw new Error("Value Stream Model projection context changed while governed records were read")
    }
    const openBottlenecks = model?.valueStreams.flatMap((stream) =>
      stream.bottlenecks.filter((bottleneck) => bottleneck.status !== "resolved")) ?? []
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "value-stream-model-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: {
        id: initiative.id,
        revision: revisionOf(initiative),
        digest: canonicalDigest(initiative),
        state: initiative.state,
      },
      assessment,
      ...(model ? {
        valueStreamModel: {
          id: model.id,
          revision: model.revision,
          digest: canonicalDigest(model),
          state: model.state,
          valueStreamCount: model.valueStreams.length,
          ownedValueStreamCount: model.valueStreams.filter((stream) => stream.ownerStakeholderKey).length,
          stageCount: model.valueStreams.reduce((total, stream) => total + stream.stages.length, 0),
          dependencyCount: model.valueStreams.reduce(
            (total, stream) => total + stream.dependencyKeys.length,
            0,
          ),
          openBottleneckCount: openBottlenecks.length,
          criticalBottleneckCount: openBottlenecks.filter(
            (bottleneck) => bottleneck.severity === "critical",
          ).length,
          updatedAt: model.updatedAt,
        },
      } : {}),
      observedAt: new Date().toISOString(),
      privacyBoundary:
        "projection-contains-identities-counts-statuses-and-digests-only-not-value-stream-narrative-personal-data-source-content-locators-or-credentials" as const,
      authorityBoundary:
        "value-stream-model-projection-does-not-approve-baseline-priority-readiness-or-authorize-action" as const,
    }
    return valueStreamModelProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const [product, models] = await Promise.all([
      this.readProduct(),
      this.listRecords("value-stream-models", currentRecordPattern, valueStreamModelSchema),
    ])
    for (const model of models) {
      try {
        const initiative = await this.readInitiative(model.initiativeId)
        this.validateContext(model.context, product, initiative)
        await this.validateSourceReferences(model, initiative.id)
        await this.validateUpstreamAndTrace(model)
        const history = await this.listHistory(model.id)
        if (history.length !== model.revision || canonicalDigest(history[0]) !== canonicalDigest(model)) {
          throw new Error("Current Value Stream Model does not match its complete immutable history")
        }
        const assessment = await this.assess(model.initiativeId)
        if (assessment.staleBindingCount > 0 || assessment.staleSourceReferenceCount > 0) {
          issues.push({
            code: "business.value-stream-model-binding-review-required",
            severity: "warning",
            message: `Initiative ${model.initiativeId} has stale Value Stream Model bindings.`,
            record: { type: model.kind, id: model.id, revision: model.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "business.value-stream-model-invalid",
          severity: "error",
          message: `Value Stream Model ${model.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: model.kind, id: model.id, revision: model.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private async validateUpstreamAndTrace(input: ValueStreamModelInput): Promise<void> {
    const [business, stakeholder, outcome, capabilityMap] = await Promise.all([
      this.businessUnderstanding.readCurrentBusinessUnderstanding(input.initiativeId),
      this.businessUnderstanding.readCurrentStakeholderModel(input.initiativeId),
      this.businessUnderstanding.readCurrentOutcomeModel(input.initiativeId),
      this.capabilityMaps.readCurrent(input.initiativeId),
    ])
    if (!business || !exactRecordMatches(input.businessUnderstanding, business)) {
      throw new Error("Value Stream Model must bind the exact current Business Understanding")
    }
    if (!stakeholder || !exactRecordMatches(input.stakeholderModel, stakeholder)) {
      throw new Error("Value Stream Model must bind the exact current Stakeholder Model")
    }
    if (!outcome || !exactRecordMatches(input.outcomeModel, outcome)) {
      throw new Error("Value Stream Model must bind the exact current Outcome Model")
    }
    if (!capabilityMap || !exactRecordMatches(input.capabilityMap, capabilityMap)) {
      throw new Error("Value Stream Model must bind the exact current Business Capability Map")
    }
    const objectiveIds = new Set(business.objectives.map((objective) => objective.id))
    const stakeholderKeys = new Set(stakeholder.stakeholders.map((entry) => entry.key))
    const outcomeIds = new Set(outcome.outcomes.map((entry) => entry.id))
    const capabilityKeys = new Set(capabilityMap.capabilities.map((entry) => entry.key))
    for (const stream of input.valueStreams) {
      if (stream.objectiveIds.some((id) => !objectiveIds.has(id))) {
        throw new Error("Value-stream objectives must reference the exact bound Business Understanding")
      }
      if (
        stream.outcomeIds.some((id) => !outcomeIds.has(id)) ||
        stream.stages.some((stage) => stage.outcomeIds.some((id) => !outcomeIds.has(id)))
      ) {
        throw new Error("Value-stream outcomes must reference the exact bound Outcome Model")
      }
      if (
        stream.capabilityKeys.some((key) => !capabilityKeys.has(key)) ||
        stream.stages.some((stage) => stage.capabilityKeys.some((key) => !capabilityKeys.has(key)))
      ) {
        throw new Error("Value-stream capabilities must reference the exact bound Business Capability Map")
      }
      const roleKeys = [
        ...(stream.ownerStakeholderKey ? [stream.ownerStakeholderKey] : []),
        ...stream.beneficiaryStakeholderKeys,
        ...stream.participatingStakeholderKeys,
        ...stream.stages.flatMap((stage) => stage.participatingStakeholderKeys),
        ...stream.bottlenecks.flatMap((bottleneck) =>
          bottleneck.ownerStakeholderKey ? [bottleneck.ownerStakeholderKey] : []),
      ]
      if (roleKeys.some((key) => !stakeholderKeys.has(key))) {
        throw new Error("Value-stream ownership, beneficiary, and participation must reference the exact bound Stakeholder Model")
      }
    }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) {
      throw new Error("Value Stream Model Initiative targets a different Product")
    }
    const expected = {
      productRevision: revisionOf(product),
      productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative),
      initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Value Stream Model must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (
        history.snapshot.initiativeId !== initiativeId ||
        history.recordDigest !== reference.recordDigest ||
        history.snapshot.contentDigest !== reference.contentDigest
      ) {
        throw new Error("Value Stream Model Source reference identity, Initiative, revision, record digest, or content digest does not match")
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
      throw new Error(`Terminal Initiative ${initiative.state} Value Stream Model is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(
    record: ValueStreamModel,
    eventType: string,
    actorId: string,
  ): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, valueStreamModelSchema),
        this.governed(this.historyPath(record.id, record.revision), record, valueStreamModelSchema),
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
    return this.repository.resolve("value-stream-models", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve(
      "value-stream-model-history",
      `value-stream-model-${id}-r${revision}.json`,
    )
  }

  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> {
    return { path, value, schema, governed: true }
  }

  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try {
      names = (await this.repository.readDirectory(this.repository.resolve(directory)))
        .filter((name) => pattern.test(name))
    } catch (error) {
      if (this.isMissing(error)) return []
      throw error
    }
    if (names.length > valueStreamInventoryLimit) {
      throw new Error(`Value Stream Model directory ${directory} exceeds the ${valueStreamInventoryLimit}-record safety limit`)
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
