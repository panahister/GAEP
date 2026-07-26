import { randomUUID } from "node:crypto"

import {
  businessRuleCatalogAssessmentSchema,
  businessRuleCatalogInputSchema,
  businessRuleCatalogProjectionSchema,
  businessRuleCatalogSchema,
  exactSourceReferenceSchema,
  type BusinessContextBinding,
  type BusinessRuleCatalog,
  type BusinessRuleCatalogAssessment,
  type BusinessRuleCatalogInput,
  type BusinessRuleCatalogProjection,
  type ExactBusinessRuleCatalogReference,
  type ExactBusinessUnderstandingReference,
  type ExactSourceReference,
  type Initiative,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { BusinessCapabilityMapService } from "./business-capability-map.js"
import type { BusinessUnderstandingService } from "./business-understanding.js"
import type { OperatingModelService } from "./operating-model.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"
import type { ValueStreamModelService } from "./value-stream-model.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const businessRuleCatalogInventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: BusinessRuleCatalog): ExactBusinessRuleCatalogReference {
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

export class BusinessRuleCatalogService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly businessUnderstanding: BusinessUnderstandingService,
    private readonly capabilityMaps: BusinessCapabilityMapService,
    private readonly valueStreams: ValueStreamModelService,
    private readonly operatingModels: OperatingModelService,
  ) {}

  async create(inputValue: BusinessRuleCatalogInput, actorId: string): Promise<BusinessRuleCatalog> {
    const input = businessRuleCatalogInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateUpstreamAndTrace(input)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Business Rule Catalog")
      }
      const now = new Date().toISOString()
      const record = businessRuleCatalogSchema.parse({
        schemaVersion: 1,
        kind: "business-rule-catalog",
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
          "business-rule-catalog-records-candidate-rules-sources-exceptions-and-enforcement-targets-and-does-not-evaluate-policy-grant-exceptions-deploy-enforcement-approve-baseline-or-authorize-action",
      })
      await this.commitVersionedRecord(record, "business.rule-catalog.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: BusinessRuleCatalogInput,
    actorId: string,
  ): Promise<BusinessRuleCatalog> {
    const input = businessRuleCatalogInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Business Rule Catalog revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Business Rule Catalog Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateUpstreamAndTrace(input)
      const record = businessRuleCatalogSchema.parse({
        ...current,
        ...input,
        productId: product.id,
        initiativeId: initiative.id,
        revision: current.revision + 1,
        predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId },
        updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, "business.rule-catalog.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<BusinessRuleCatalog> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Business Rule Catalog ID")),
      businessRuleCatalogSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<BusinessRuleCatalog | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords(
      "business-rule-catalogs",
      currentRecordPattern,
      businessRuleCatalogSchema,
    )
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Business Rule Catalog")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<BusinessRuleCatalog> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Business Rule Catalog history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Business Rule Catalog ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), businessRuleCatalogSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Business Rule Catalog history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<BusinessRuleCatalog[]> {
    const recordId = this.requireUuid(id, "Business Rule Catalog ID")
    const records = await this.listRecords(
      "business-rule-catalog-history",
      new RegExp(`^business-rule-catalog-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      businessRuleCatalogSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Business Rule Catalog history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<BusinessRuleCatalogAssessment> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [
      product,
      initiative,
      catalog,
      business,
      stakeholder,
      outcome,
      capabilityMap,
      valueStreamModel,
      operatingModel,
      currentSources,
    ] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.businessUnderstanding.readCurrentBusinessUnderstanding(targetId),
      this.businessUnderstanding.readCurrentStakeholderModel(targetId),
      this.businessUnderstanding.readCurrentOutcomeModel(targetId),
      this.capabilityMaps.readCurrent(targetId),
      this.valueStreams.readCurrent(targetId),
      this.operatingModels.readCurrent(targetId),
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
    if (catalog) {
      if (canonicalDigest(catalog.context) !== canonicalDigest(expectedContext)) staleBindingCount += 1
      if (!business || !exactRecordMatches(catalog.businessUnderstanding, business)) staleBindingCount += 1
      if (!stakeholder || !exactRecordMatches(catalog.stakeholderModel, stakeholder)) staleBindingCount += 1
      if (!outcome || !exactRecordMatches(catalog.outcomeModel, outcome)) staleBindingCount += 1
      if (!capabilityMap || !exactRecordMatches(catalog.capabilityMap, capabilityMap)) staleBindingCount += 1
      if (!valueStreamModel || !exactRecordMatches(catalog.valueStreamModel, valueStreamModel)) staleBindingCount += 1
      if (!operatingModel || !exactRecordMatches(catalog.operatingModel, operatingModel)) staleBindingCount += 1
    }
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(catalog).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const rules = catalog?.rules ?? []
    const targets = catalog?.enforcementTargets ?? []
    const exceptions = catalog?.exceptions ?? []
    const sourceBackedRuleCount = rules.filter((rule) => rule.sources.length > 0).length
    const nonExceptionableRuleCount = rules.filter((rule) => rule.exceptionBehavior === "not-exceptionable").length
    const unassignedEnforcementTargetCount = targets.filter(
      (target) => target.assignment.state === "unassigned",
    ).length
    const unverifiedEnforcementTargetCount = targets.filter(
      (target) => target.verificationState === "unassessed",
    ).length
    const unassignedExceptionAuthorityCount = exceptions.filter(
      (exception) => exception.authority.state === "unassigned",
    ).length
    const reasons: string[] = []
    if (!catalog) reasons.push("No versioned Business Rule Catalog exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The Business Rule Catalog does not bind the exact current Product, Initiative, or upstream business records")
    if (staleSourceReferenceCount > 0) reasons.push("One or more business-rule claims reference a superseded Source revision")
    if (sourceBackedRuleCount !== rules.length) reasons.push("One or more Business Rules do not bind exact Source evidence")
    if (unassignedEnforcementTargetCount > 0) reasons.push("One or more enforcement targets have no candidate responsible assignment")
    if (unverifiedEnforcementTargetCount > 0) reasons.push("One or more enforcement targets have no candidate verification criteria assessment")
    if (unassignedExceptionAuthorityCount > 0) reasons.push("One or more candidate exceptions have no candidate approval authority")
    return businessRuleCatalogAssessmentSchema.parse({
      schemaVersion: 1,
      kind: "business-rule-catalog-assessment",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(catalog ? { businessRuleCatalog: exactReference(catalog) } : {}),
      ruleCount: rules.length,
      sourceBackedRuleCount,
      nonExceptionableRuleCount,
      enforcementTargetCount: targets.length,
      unassignedEnforcementTargetCount,
      unverifiedEnforcementTargetCount,
      exceptionCount: exceptions.length,
      unassignedExceptionAuthorityCount,
      staleBindingCount,
      staleSourceReferenceCount,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "business-rule-catalog-assessment-reports-candidate-coverage-and-gaps-and-does-not-evaluate-policy-grant-exceptions-deploy-enforcement-approve-baseline-readiness-or-authorize-action",
    })
  }

  async project(initiativeId: string): Promise<BusinessRuleCatalogProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, assessment, catalog] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.assess(targetId),
      this.readCurrent(targetId),
    ])
    if (assessment.productId !== product.id || assessment.productRevision !== revisionOf(product) ||
        assessment.initiativeId !== initiative.id || assessment.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Business Rule Catalog projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "business-rule-catalog-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: {
        id: initiative.id,
        revision: revisionOf(initiative),
        digest: canonicalDigest(initiative),
        state: initiative.state,
      },
      assessment,
      ...(catalog ? {
        businessRuleCatalog: {
          id: catalog.id,
          revision: catalog.revision,
          digest: canonicalDigest(catalog),
          state: catalog.state,
          ruleCount: catalog.rules.length,
          enforcementTargetCount: catalog.enforcementTargets.length,
          exceptionCount: catalog.exceptions.length,
          nonExceptionableRuleCount: catalog.rules.filter(
            (rule) => rule.exceptionBehavior === "not-exceptionable",
          ).length,
          updatedAt: catalog.updatedAt,
        },
      } : {}),
      observedAt: new Date().toISOString(),
      privacyBoundary:
        "projection-contains-identities-counts-statuses-and-digests-only-not-rule-narrative-source-content-personal-data-locators-or-credentials" as const,
      authorityBoundary:
        "business-rule-catalog-projection-does-not-evaluate-policy-grant-exceptions-deploy-enforcement-approve-baseline-readiness-or-authorize-action" as const,
    }
    return businessRuleCatalogProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const [product, catalogs] = await Promise.all([
      this.readProduct(),
      this.listRecords("business-rule-catalogs", currentRecordPattern, businessRuleCatalogSchema),
    ])
    for (const catalog of catalogs) {
      try {
        const initiative = await this.readInitiative(catalog.initiativeId)
        this.validateContext(catalog.context, product, initiative)
        await this.validateSourceReferences(catalog, initiative.id)
        await this.validateUpstreamAndTrace(catalog)
        const history = await this.listHistory(catalog.id)
        if (history.length !== catalog.revision || canonicalDigest(history[0]) !== canonicalDigest(catalog)) {
          throw new Error("Current Business Rule Catalog does not match its complete immutable history")
        }
        const assessment = await this.assess(catalog.initiativeId)
        if (assessment.staleBindingCount > 0 || assessment.staleSourceReferenceCount > 0) {
          issues.push({
            code: "business.rule-catalog-binding-review-required",
            severity: "warning",
            message: `Initiative ${catalog.initiativeId} has stale Business Rule Catalog bindings.`,
            record: { type: catalog.kind, id: catalog.id, revision: catalog.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "business.rule-catalog-invalid",
          severity: "error",
          message: `Business Rule Catalog ${catalog.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: catalog.kind, id: catalog.id, revision: catalog.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private async validateUpstreamAndTrace(input: BusinessRuleCatalogInput): Promise<void> {
    const [business, stakeholder, outcome, capabilityMap, valueStreamModel, operatingModel] = await Promise.all([
      this.businessUnderstanding.readCurrentBusinessUnderstanding(input.initiativeId),
      this.businessUnderstanding.readCurrentStakeholderModel(input.initiativeId),
      this.businessUnderstanding.readCurrentOutcomeModel(input.initiativeId),
      this.capabilityMaps.readCurrent(input.initiativeId),
      this.valueStreams.readCurrent(input.initiativeId),
      this.operatingModels.readCurrent(input.initiativeId),
    ])
    if (!business || !exactRecordMatches(input.businessUnderstanding, business)) {
      throw new Error("Business Rule Catalog must bind the exact current Business Understanding")
    }
    if (!stakeholder || !exactRecordMatches(input.stakeholderModel, stakeholder)) {
      throw new Error("Business Rule Catalog must bind the exact current Stakeholder Model")
    }
    if (!outcome || !exactRecordMatches(input.outcomeModel, outcome)) {
      throw new Error("Business Rule Catalog must bind the exact current Outcome Model")
    }
    if (!capabilityMap || !exactRecordMatches(input.capabilityMap, capabilityMap)) {
      throw new Error("Business Rule Catalog must bind the exact current Business Capability Map")
    }
    if (!valueStreamModel || !exactRecordMatches(input.valueStreamModel, valueStreamModel)) {
      throw new Error("Business Rule Catalog must bind the exact current Value Stream Model")
    }
    if (!operatingModel || !exactRecordMatches(input.operatingModel, operatingModel)) {
      throw new Error("Business Rule Catalog must bind the exact current Operating Model")
    }
    const capabilityKeys = new Set(capabilityMap.capabilities.map((entry) => entry.key))
    const valueStreamKeys = new Set(valueStreamModel.valueStreams.map((entry) => entry.key))
    const roleByKey = new Map(operatingModel.roles.map((role) => [role.key, role]))
    const decisionRightByKey = new Map(operatingModel.decisionRights.map((right) => [right.key, right]))
    for (const rule of input.rules) {
      if (!roleByKey.has(rule.ownerRoleKey)) {
        throw new Error("Business Rules must reference the exact bound Operating Model roles")
      }
      if (rule.capabilityKeys.some((key) => !capabilityKeys.has(key))) {
        throw new Error("Business Rules must reference the exact bound Business Capability Map")
      }
      if (rule.valueStreamKeys.some((key) => !valueStreamKeys.has(key))) {
        throw new Error("Business Rules must reference the exact bound Value Stream Model")
      }
      if (rule.decisionRightKeys.some((key) => !decisionRightByKey.has(key))) {
        throw new Error("Business Rules must reference the exact bound Operating Model decision rights")
      }
    }
    for (const target of input.enforcementTargets) {
      if (!roleByKey.has(target.responsibleRoleKey)) {
        throw new Error("Business-rule enforcement targets must reference the exact bound Operating Model roles")
      }
    }
    for (const exception of input.exceptions) {
      const decisionRight = decisionRightByKey.get(exception.decisionRightKey)
      if (!roleByKey.has(exception.approvingRoleKey) || !decisionRight) {
        throw new Error("Business-rule exceptions must reference exact bound Operating Model roles and decision rights")
      }
      if (decisionRight.accountableRoleKey !== exception.approvingRoleKey) {
        throw new Error("Business-rule exception authority must match the accountable role for its exact decision right")
      }
    }
    if (!roleByKey.has(input.conflictModel.ownerRoleKey)) {
      throw new Error("Business-rule conflict handling must reference the exact bound Operating Model roles")
    }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Business Rule Catalog Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product),
      productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative),
      initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Business Rule Catalog must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Business Rule Catalog Source reference identity, Initiative, revision, record digest, or content digest does not match")
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
      throw new Error(`Terminal Initiative ${initiative.state} Business Rule Catalog is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(
    record: BusinessRuleCatalog,
    eventType: string,
    actorId: string,
  ): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, businessRuleCatalogSchema),
        this.governed(this.historyPath(record.id, record.revision), record, businessRuleCatalogSchema),
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
    return this.repository.resolve("business-rule-catalogs", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve(
      "business-rule-catalog-history",
      `business-rule-catalog-${id}-r${revision}.json`,
    )
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
    if (names.length > businessRuleCatalogInventoryLimit) {
      throw new Error(`Business Rule Catalog directory ${directory} exceeds the ${businessRuleCatalogInventoryLimit}-record safety limit`)
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
