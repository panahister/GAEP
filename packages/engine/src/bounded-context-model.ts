import { randomUUID } from "node:crypto"

import {
  boundedContextModelAssessmentSchema,
  boundedContextModelInputSchema,
  boundedContextModelProjectionSchema,
  boundedContextModelSchema,
  exactSourceReferenceSchema,
  type BoundedContextModel,
  type BoundedContextModelAssessment,
  type BoundedContextModelInput,
  type BoundedContextModelProjection,
  type BusinessContextBinding,
  type ExactBoundedContextModelReference,
  type ExactSourceReference,
  type Initiative,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { BusinessArchitectureBaselineService } from "./business-architecture-baseline.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"
import type { SystemSolutionArchitectureService } from "./system-solution-architecture.js"
import type { OperatingModelService } from "./operating-model.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const modelInventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: BoundedContextModel): ExactBoundedContextModelReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: BoundedContextModelInput) {
  return { systemSolutionArchitecture: input.systemSolutionArchitecture }
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

export class BoundedContextModelService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly systemSolutionArchitectures: SystemSolutionArchitectureService,
    private readonly businessArchitectureBaselines: BusinessArchitectureBaselineService,
    private readonly operatingModels: OperatingModelService,
  ) {}

  async create(inputValue: BoundedContextModelInput, actorId: string): Promise<BoundedContextModel> {
    const input = boundedContextModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindingsAndModel(input)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Bounded Context and Ownership Model candidate")
      }
      const now = new Date().toISOString()
      const record = boundedContextModelSchema.parse({
        schemaVersion: 1,
        kind: "bounded-context-ownership-candidate",
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
          "bounded-context-model-is-a-candidate-boundary-and-ownership-record-and-does-not-appoint-an-owner-approve-a-boundary-accept-a-contract-establish-readiness-or-authorize-action",
      })
      await this.commitVersionedRecord(record, "architecture.bounded-context.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: BoundedContextModelInput,
    actorId: string,
  ): Promise<BoundedContextModel> {
    const input = boundedContextModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Bounded Context Model revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Bounded Context Model Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindingsAndModel(input)
      const record = boundedContextModelSchema.parse({
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
      await this.commitVersionedRecord(record, "architecture.bounded-context.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<BoundedContextModel> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Bounded Context Model ID")),
      boundedContextModelSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<BoundedContextModel | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("bounded-context-models", currentRecordPattern, boundedContextModelSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Bounded Context and Ownership Model candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<BoundedContextModel> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Bounded Context Model history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Bounded Context Model ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), boundedContextModelSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Bounded Context Model history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<BoundedContextModel[]> {
    const recordId = this.requireUuid(id, "Bounded Context Model ID")
    const records = await this.listRecords(
      "bounded-context-model-history",
      new RegExp(`^bounded-context-model-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      boundedContextModelSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Bounded Context Model history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<BoundedContextModelAssessment> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, model, architecture, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.systemSolutionArchitectures.readCurrent(targetId),
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
      if (!architecture || !exactRecordMatches(model.systemSolutionArchitecture, architecture)) staleBindingCount += 1
      if (model.membershipDigest !== canonicalDigest(membership(model))) staleBindingCount += 1
    }
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(model).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const coverage = this.coverageGaps(model, architecture)
    const unresolvedContractCount = model?.contracts.filter((entry) => entry.state === "unresolved").length ?? 0
    const unresolvedRelationshipCount = model?.relationships.filter((entry) => entry.pattern === "unresolved").length ?? 0
    const inconsistencyCount = model?.inconsistencies.length ?? 0
    const unresolvedQuestionCount = model?.unresolvedQuestions.length ?? 0
    const reasons: string[] = []
    if (!model) reasons.push("No versioned Bounded Context and Ownership Model candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The Bounded Context Model does not bind the exact current Product, Initiative, or System/Solution Architecture")
    if (staleSourceReferenceCount > 0) reasons.push("One or more Bounded Context Model claims reference a superseded Source revision")
    if (unresolvedContractCount > 0) reasons.push("One or more cross-context contracts remain unresolved")
    if (unresolvedRelationshipCount > 0) reasons.push("One or more context-map relationship patterns remain unresolved")
    if (coverage.unassignedArchitectureElementCount > 0) reasons.push("One or more internal architecture elements lack a single bounded-context assignment")
    if (coverage.unownedDataAssetCount > 0) reasons.push("One or more architecture data assets lack a single candidate owning bounded context")
    if (coverage.unmappedCrossContextRelationCount > 0) reasons.push("One or more cross-context architecture relations lack an explicit contract mapping")
    if (inconsistencyCount > 0) reasons.push("The candidate records explicit bounded-context inconsistencies")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved bounded-context questions")
    return boundedContextModelAssessmentSchema.parse({
      schemaVersion: 1,
      kind: "bounded-context-ownership-assessment",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(model ? { model: exactReference(model) } : {}),
      boundedContextCount: model?.boundedContexts.length ?? 0,
      coreContextCount: model?.boundedContexts.filter((entry) => entry.domainType === "core").length ?? 0,
      languageTermCount: model?.boundedContexts.reduce((total, entry) => total + entry.ubiquitousLanguage.length, 0) ?? 0,
      contractCount: model?.contracts.length ?? 0,
      unresolvedContractCount,
      relationshipCount: model?.relationships.length ?? 0,
      unresolvedRelationshipCount,
      ...coverage,
      inconsistencyCount,
      unresolvedQuestionCount,
      staleBindingCount,
      staleSourceReferenceCount,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "bounded-context-model-assessment-reports-candidate-coverage-and-gaps-and-does-not-appoint-owners-approve-boundaries-accept-contracts-establish-readiness-or-authorize-action",
    })
  }

  async project(initiativeId: string): Promise<BoundedContextModelProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, assessment, model] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.assess(targetId),
      this.readCurrent(targetId),
    ])
    if (assessment.productId !== product.id || assessment.productRevision !== revisionOf(product) ||
        assessment.initiativeId !== initiative.id || assessment.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Bounded Context projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "bounded-context-ownership-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: {
        id: initiative.id,
        revision: revisionOf(initiative),
        digest: canonicalDigest(initiative),
        state: initiative.state,
      },
      assessment,
      ...(model ? {
        model: {
          id: model.id,
          revision: model.revision,
          digest: canonicalDigest(model),
          membershipDigest: model.membershipDigest,
          state: model.state,
          boundedContextCount: model.boundedContexts.length,
          contractCount: model.contracts.length,
          relationshipCount: model.relationships.length,
          updatedAt: model.updatedAt,
        },
      } : {}),
      observedAt: new Date().toISOString(),
      privacyBoundary:
        "projection-contains-identities-counts-statuses-and-digests-only-not-boundary-language-contract-source-content-personal-data-locators-or-credentials" as const,
      authorityBoundary:
        "bounded-context-model-projection-does-not-appoint-owners-approve-boundaries-accept-contracts-establish-readiness-or-authorize-action" as const,
    }
    return boundedContextModelProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const [product, records] = await Promise.all([
      this.readProduct(),
      this.listRecords("bounded-context-models", currentRecordPattern, boundedContextModelSchema),
    ])
    for (const model of records) {
      try {
        const initiative = await this.readInitiative(model.initiativeId)
        this.validateContext(model.context, product, initiative)
        await this.validateSourceReferences(model, initiative.id)
        await this.validateBindingsAndModel(model)
        if (model.membershipDigest !== canonicalDigest(membership(model))) {
          throw new Error("Bounded Context Model membership digest is invalid")
        }
        const history = await this.listHistory(model.id)
        if (history.length !== model.revision || canonicalDigest(history[0]) !== canonicalDigest(model)) {
          throw new Error("Current Bounded Context Model does not match its complete immutable history")
        }
        const assessment = await this.assess(model.initiativeId)
        if (assessment.staleBindingCount > 0 || assessment.staleSourceReferenceCount > 0) {
          issues.push({
            code: "architecture.bounded-context-binding-review-required",
            severity: "warning",
            message: `Initiative ${model.initiativeId} has stale Bounded Context Model bindings.`,
            record: { type: model.kind, id: model.id, revision: model.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "architecture.bounded-context-invalid",
          severity: "error",
          message: `Bounded Context Model ${model.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: model.kind, id: model.id, revision: model.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private coverageGaps(model: BoundedContextModel | undefined, architecture: Awaited<ReturnType<SystemSolutionArchitectureService["readCurrent"]>>) {
    if (!model || !architecture) {
      return {
        unassignedArchitectureElementCount: architecture?.elements.filter(
          (entry) => entry.kind !== "external-system" && entry.kind !== "deployment-target",
        ).length ?? 0,
        unownedDataAssetCount: architecture?.elements.filter((entry) => entry.kind === "data-asset").length ?? 0,
        unmappedCrossContextRelationCount: 0,
      }
    }
    const contextByElement = new Map(model.boundedContexts.flatMap((entry) =>
      entry.architectureElementKeys.map((key) => [key, entry.key] as const)))
    const expectedElements = architecture.elements.filter(
      (entry) => entry.kind !== "external-system" && entry.kind !== "deployment-target",
    )
    const ownedDataAssets = new Set(model.boundedContexts.flatMap((entry) => entry.dataAssetElementKeys))
    const mappedRelations = new Set(model.contracts.flatMap((entry) => entry.architectureRelationKeys))
    const crossContextRelations = architecture.relations.filter((entry) => {
      const from = contextByElement.get(entry.fromElementKey)
      const to = contextByElement.get(entry.toElementKey)
      return from && to && from !== to
    })
    return {
      unassignedArchitectureElementCount: expectedElements.filter((entry) => !contextByElement.has(entry.key)).length,
      unownedDataAssetCount: architecture.elements.filter(
        (entry) => entry.kind === "data-asset" && !ownedDataAssets.has(entry.key),
      ).length,
      unmappedCrossContextRelationCount: crossContextRelations.filter((entry) => !mappedRelations.has(entry.key)).length,
    }
  }

  private async validateBindingsAndModel(input: BoundedContextModelInput): Promise<void> {
    const architecture = await this.systemSolutionArchitectures.readCurrent(input.initiativeId)
    if (!architecture || !exactRecordMatches(input.systemSolutionArchitecture, architecture)) {
      throw new Error("Bounded Context Model must bind the exact current System/Solution Architecture candidate")
    }
    const baseline = await this.businessArchitectureBaselines.readRevision(
      architecture.businessArchitectureBaseline.recordId,
      architecture.businessArchitectureBaseline.revision,
    )
    if (!exactRecordMatches(architecture.businessArchitectureBaseline, baseline)) {
      throw new Error("Bounded Context Model System/Solution Architecture has an invalid Business Architecture Baseline binding")
    }
    const operatingModel = await this.operatingModels.readRevision(
      baseline.operatingModel.recordId,
      baseline.operatingModel.revision,
    )
    if (!exactRecordMatches(baseline.operatingModel, operatingModel)) {
      throw new Error("Bounded Context Model Business Architecture Baseline has an invalid Operating Model binding")
    }
    const roles = new Set(operatingModel.roles.map((entry) => entry.key))
    const roleReferences = [
      input.governance.ownerRoleKey,
      ...input.governance.reviewerRoleKeys,
      ...input.boundedContexts.flatMap((entry) => [entry.ownerRoleKey, ...entry.stewardRoleKeys]),
      ...input.contracts.map((entry) => entry.ownerRoleKey),
    ]
    if (roleReferences.some((key) => !roles.has(key))) {
      throw new Error("Bounded Context Model roles must reference exact bound Operating Model roles")
    }
    const elementByKey = new Map(architecture.elements.map((entry) => [entry.key, entry]))
    const relationByKey = new Map(architecture.relations.map((entry) => [entry.key, entry]))
    const contextByElement = new Map<string, string>()
    for (const boundedContext of input.boundedContexts) {
      for (const elementKey of boundedContext.architectureElementKeys) {
        if (!elementByKey.has(elementKey)) {
          throw new Error("Bounded Context assignments must reference exact System/Solution Architecture elements")
        }
        contextByElement.set(elementKey, boundedContext.key)
      }
      if (boundedContext.dataAssetElementKeys.some((key) => elementByKey.get(key)?.kind !== "data-asset")) {
        throw new Error("Bounded Context data ownership must reference exact architecture data-asset elements")
      }
    }
    const expectedElements = architecture.elements.filter(
      (entry) => entry.kind !== "external-system" && entry.kind !== "deployment-target",
    )
    if (expectedElements.some((entry) => !contextByElement.has(entry.key))) {
      throw new Error("Every internal System/Solution Architecture element must have one bounded-context assignment")
    }
    const ownedDataAssets = new Set(input.boundedContexts.flatMap((entry) => entry.dataAssetElementKeys))
    if (architecture.elements.some((entry) => entry.kind === "data-asset" && !ownedDataAssets.has(entry.key))) {
      throw new Error("Every architecture data asset must have one candidate owning bounded context")
    }
    for (const contract of input.contracts) {
      for (const relationKey of contract.architectureRelationKeys) {
        const relation = relationByKey.get(relationKey)
        if (!relation) throw new Error("Cross-context contracts must reference exact architecture relations")
        const provider = contextByElement.get(relation.fromElementKey)
        const consumer = contextByElement.get(relation.toElementKey)
        if (provider !== contract.providerContextKey || !consumer || !contract.consumerContextKeys.includes(consumer)) {
          throw new Error("Cross-context contract direction must match exact architecture element assignments")
        }
      }
    }
    const mappedRelations = new Set(input.contracts.flatMap((entry) => entry.architectureRelationKeys))
    const missingCrossContextRelation = architecture.relations.some((entry) => {
      const from = contextByElement.get(entry.fromElementKey)
      const to = contextByElement.get(entry.toElementKey)
      return Boolean(from && to && from !== to && !mappedRelations.has(entry.key))
    })
    if (missingCrossContextRelation) {
      throw new Error("Every cross-context architecture relation must have an explicit contract mapping")
    }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Bounded Context Model Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product),
      productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative),
      initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Bounded Context Model must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Bounded Context Model Source reference identity, Initiative, revision, record digest, or content digest does not match")
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
      throw new Error(`Terminal Initiative ${initiative.state} Bounded Context Model is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: BoundedContextModel, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, boundedContextModelSchema),
        this.governed(this.historyPath(record.id, record.revision), record, boundedContextModelSchema),
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
          boundaryApprovalState: record.governance.boundaryApprovalState,
          ownershipAcceptanceState: record.governance.ownershipAcceptanceState,
          reviewState: record.governance.reviewState,
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("bounded-context-models", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("bounded-context-model-history", `bounded-context-model-${id}-r${revision}.json`)
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
    if (names.length > modelInventoryLimit) {
      throw new Error(`Bounded Context Model directory ${directory} exceeds the ${modelInventoryLimit}-record safety limit`)
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
