import { randomUUID } from "node:crypto"

import {
  businessCapabilityMapAssessmentSchema,
  businessCapabilityMapInputSchema,
  businessCapabilityMapProjectionSchema,
  businessCapabilityMapSchema,
  exactSourceReferenceSchema,
  type BusinessCapabilityMap,
  type BusinessCapabilityMapAssessment,
  type BusinessCapabilityMapInput,
  type BusinessCapabilityMapProjection,
  type BusinessContextBinding,
  type ExactBusinessCapabilityMapReference,
  type ExactBusinessUnderstandingReference,
  type ExactSourceReference,
  type Initiative,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { BusinessUnderstandingService } from "./business-understanding.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const capabilityMapInventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: BusinessCapabilityMap): ExactBusinessCapabilityMapReference {
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

export class BusinessCapabilityMapService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly businessUnderstanding: BusinessUnderstandingService,
  ) {}

  async create(inputValue: BusinessCapabilityMapInput, actorId: string): Promise<BusinessCapabilityMap> {
    const input = businessCapabilityMapInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateUpstreamAndTrace(input)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Business Capability Map")
      }
      const now = new Date().toISOString()
      const record = businessCapabilityMapSchema.parse({
        schemaVersion: 1,
        kind: "business-capability-map",
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
          "business-capability-map-records-candidate-architecture-placement-ownership-gaps-and-priority-and-does-not-approve-baseline-readiness-or-authorize-action",
      })
      await this.commitVersionedRecord(record, "business.capability-map.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: BusinessCapabilityMapInput,
    actorId: string,
  ): Promise<BusinessCapabilityMap> {
    const input = businessCapabilityMapInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) {
        throw new Error("Business Capability Map revision changed before update")
      }
      if (current.initiativeId !== input.initiativeId) {
        throw new Error("Business Capability Map Initiative cannot change")
      }
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateUpstreamAndTrace(input)
      const record = businessCapabilityMapSchema.parse({
        ...current,
        ...input,
        productId: product.id,
        initiativeId: initiative.id,
        revision: current.revision + 1,
        predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId },
        updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, "business.capability-map.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<BusinessCapabilityMap> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Business Capability Map ID")),
      businessCapabilityMapSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<BusinessCapabilityMap | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("business-capability-maps", currentRecordPattern, businessCapabilityMapSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Business Capability Map")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<BusinessCapabilityMap> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Business Capability Map history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Business Capability Map ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), businessCapabilityMapSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Business Capability Map history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<BusinessCapabilityMap[]> {
    const recordId = this.requireUuid(id, "Business Capability Map ID")
    const records = await this.listRecords(
      "business-capability-map-history",
      new RegExp(`^business-capability-map-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      businessCapabilityMapSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (
        record.id !== recordId ||
        record.revision !== index + 1 ||
        (index === 0 && record.predecessorDigest !== undefined) ||
        (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))
      ) {
        throw new Error("Business Capability Map history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<BusinessCapabilityMapAssessment> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, map, business, stakeholder, outcome, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.businessUnderstanding.readCurrentBusinessUnderstanding(targetId),
      this.businessUnderstanding.readCurrentStakeholderModel(targetId),
      this.businessUnderstanding.readCurrentOutcomeModel(targetId),
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
    if (map) {
      if (canonicalDigest(map.context) !== canonicalDigest(expectedContext)) staleBindingCount += 1
      if (!business || !exactRecordMatches(map.businessUnderstanding, business)) staleBindingCount += 1
      if (!stakeholder || !exactRecordMatches(map.stakeholderModel, stakeholder)) staleBindingCount += 1
      if (!outcome || !exactRecordMatches(map.outcomeModel, outcome)) staleBindingCount += 1
    }
    const currentSourceById = new Map(currentSources.map((source) => [source.id, source]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(map).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current ||
        current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest ||
        current.contentDigest !== reference.contentDigest
    }).length
    const capabilities = map?.capabilities ?? []
    const ownedCapabilityCount = capabilities.filter((capability) => capability.ownerStakeholderKey).length
    const unownedCapabilityCount = capabilities.length - ownedCapabilityCount
    const objectiveCoverageCount = new Set(capabilities.flatMap((capability) => capability.objectiveIds)).size
    const outcomeCoverageCount = new Set(capabilities.flatMap((capability) => capability.outcomeIds)).size
    const openGaps = capabilities.flatMap((capability) =>
      capability.gaps.filter((gap) => gap.status !== "resolved"))
    const criticalGapCount = openGaps.filter((gap) => gap.severity === "critical").length
    const unknownCurrentMaturityCount = capabilities.filter(
      (capability) => capability.currentMaturity.level === "unknown",
    ).length
    const unassessedPriorityCount = capabilities.filter(
      (capability) => capability.priority.status === "unassessed",
    ).length
    const reasons: string[] = []
    if (!map) reasons.push("No versioned Business Capability Map exists for this Initiative")
    if (staleBindingCount > 0) {
      reasons.push("The Business Capability Map does not bind the exact current Product, Initiative, or upstream business records")
    }
    if (staleSourceReferenceCount > 0) {
      reasons.push("One or more capability claims reference a superseded Source revision")
    }
    if (unownedCapabilityCount > 0) reasons.push("One or more capabilities do not have a candidate owner")
    if (openGaps.length > 0) reasons.push("One or more capability gaps remain open")
    if (unknownCurrentMaturityCount > 0) reasons.push("One or more current capability maturity assessments remain unknown")
    if (unassessedPriorityCount > 0) reasons.push("One or more capability priorities remain unassessed")
    return businessCapabilityMapAssessmentSchema.parse({
      schemaVersion: 1,
      kind: "business-capability-map-assessment",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(map ? { capabilityMap: exactReference(map) } : {}),
      capabilityCount: capabilities.length,
      ownedCapabilityCount,
      unownedCapabilityCount,
      objectiveCoverageCount,
      outcomeCoverageCount,
      openGapCount: openGaps.length,
      criticalGapCount,
      unknownCurrentMaturityCount,
      unassessedPriorityCount,
      staleBindingCount,
      staleSourceReferenceCount,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "business-capability-map-assessment-reports-recorded-candidate-coverage-and-gaps-and-does-not-approve-priority-readiness-or-authorize-action",
    })
  }

  async project(initiativeId: string): Promise<BusinessCapabilityMapProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, assessment, map] = await Promise.all([
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
      throw new Error("Business Capability Map projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "business-capability-map-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: {
        id: initiative.id,
        revision: revisionOf(initiative),
        digest: canonicalDigest(initiative),
        state: initiative.state,
      },
      assessment,
      ...(map ? {
        capabilityMap: {
          id: map.id,
          revision: map.revision,
          digest: canonicalDigest(map),
          state: map.state,
          capabilityCount: map.capabilities.length,
          ownedCapabilityCount: map.capabilities.filter((capability) => capability.ownerStakeholderKey).length,
          openGapCount: map.capabilities.flatMap((capability) =>
            capability.gaps.filter((gap) => gap.status !== "resolved")).length,
          criticalGapCount: map.capabilities.flatMap((capability) =>
            capability.gaps.filter((gap) => gap.status !== "resolved" && gap.severity === "critical")).length,
          candidatePriorityCount: map.capabilities.filter(
            (capability) => capability.priority.status === "candidate",
          ).length,
          updatedAt: map.updatedAt,
        },
      } : {}),
      observedAt: new Date().toISOString(),
      privacyBoundary:
        "projection-contains-identities-counts-statuses-and-digests-only-not-capability-narrative-personal-data-source-content-locators-or-credentials" as const,
      authorityBoundary:
        "business-capability-map-projection-does-not-approve-prioritize-baseline-designate-readiness-or-authorize-action" as const,
    }
    return businessCapabilityMapProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const [product, maps] = await Promise.all([
      this.readProduct(),
      this.listRecords("business-capability-maps", currentRecordPattern, businessCapabilityMapSchema),
    ])
    for (const map of maps) {
      try {
        const initiative = await this.readInitiative(map.initiativeId)
        this.validateContext(map.context, product, initiative)
        await this.validateSourceReferences(map, initiative.id)
        await this.validateUpstreamAndTrace(map)
        const history = await this.listHistory(map.id)
        if (history.length !== map.revision || canonicalDigest(history[0]) !== canonicalDigest(map)) {
          throw new Error("Current Business Capability Map does not match its complete immutable history")
        }
        const assessment = await this.assess(map.initiativeId)
        if (assessment.staleBindingCount > 0 || assessment.staleSourceReferenceCount > 0) {
          issues.push({
            code: "business.capability-map-binding-review-required",
            severity: "warning",
            message: `Initiative ${map.initiativeId} has stale Business Capability Map bindings.`,
            record: { type: map.kind, id: map.id, revision: map.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "business.capability-map-invalid",
          severity: "error",
          message: `Business Capability Map ${map.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: map.kind, id: map.id, revision: map.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private async validateUpstreamAndTrace(input: BusinessCapabilityMapInput): Promise<void> {
    const [business, stakeholder, outcome] = await Promise.all([
      this.businessUnderstanding.readCurrentBusinessUnderstanding(input.initiativeId),
      this.businessUnderstanding.readCurrentStakeholderModel(input.initiativeId),
      this.businessUnderstanding.readCurrentOutcomeModel(input.initiativeId),
    ])
    if (!business || !exactRecordMatches(input.businessUnderstanding, business)) {
      throw new Error("Business Capability Map must bind the exact current Business Understanding")
    }
    if (!stakeholder || !exactRecordMatches(input.stakeholderModel, stakeholder)) {
      throw new Error("Business Capability Map must bind the exact current Stakeholder Model")
    }
    if (!outcome || !exactRecordMatches(input.outcomeModel, outcome)) {
      throw new Error("Business Capability Map must bind the exact current Outcome Model")
    }
    const objectiveIds = new Set(business.objectives.map((objective) => objective.id))
    const stakeholderKeys = new Set(stakeholder.stakeholders.map((entry) => entry.key))
    const outcomeIds = new Set(outcome.outcomes.map((entry) => entry.id))
    for (const capability of input.capabilities) {
      if (capability.objectiveIds.some((id) => !objectiveIds.has(id))) {
        throw new Error("Capability objectives must reference the exact bound Business Understanding")
      }
      if (capability.outcomeIds.some((id) => !outcomeIds.has(id))) {
        throw new Error("Capability outcomes must reference the exact bound Outcome Model")
      }
      const roleKeys = [
        ...(capability.ownerStakeholderKey ? [capability.ownerStakeholderKey] : []),
        ...capability.accountableStakeholderKeys,
        ...capability.participatingStakeholderKeys,
        ...capability.gaps.flatMap((gap) => gap.ownerStakeholderKey ? [gap.ownerStakeholderKey] : []),
      ]
      if (roleKeys.some((key) => !stakeholderKeys.has(key))) {
        throw new Error("Capability ownership and participation must reference the exact bound Stakeholder Model")
      }
    }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) {
      throw new Error("Business Capability Map Initiative targets a different Product")
    }
    const expected = {
      productRevision: revisionOf(product),
      productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative),
      initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Business Capability Map must bind the exact current Product and Initiative revisions and digests")
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
        throw new Error("Business Capability Map Source reference identity, Initiative, revision, record digest, or content digest does not match")
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
      throw new Error(`Terminal Initiative ${initiative.state} Business Capability Map is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(
    record: BusinessCapabilityMap,
    eventType: string,
    actorId: string,
  ): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, businessCapabilityMapSchema),
        this.governed(this.historyPath(record.id, record.revision), record, businessCapabilityMapSchema),
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
    return this.repository.resolve("business-capability-maps", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve(
      "business-capability-map-history",
      `business-capability-map-${id}-r${revision}.json`,
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
    if (names.length > capabilityMapInventoryLimit) {
      throw new Error(`Business Capability Map directory ${directory} exceeds the ${capabilityMapInventoryLimit}-record safety limit`)
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
