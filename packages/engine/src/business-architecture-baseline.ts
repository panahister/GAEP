import { randomUUID } from "node:crypto"

import {
  businessArchitectureBaselineAssessmentSchema,
  businessArchitectureBaselineInputSchema,
  businessArchitectureBaselineProjectionSchema,
  businessArchitectureBaselineSchema,
  exactSourceReferenceSchema,
  type BusinessArchitectureBaseline,
  type BusinessArchitectureBaselineAssessment,
  type BusinessArchitectureBaselineInput,
  type BusinessArchitectureBaselineProjection,
  type BusinessArchitectureElementKind,
  type BusinessContextBinding,
  type ExactBusinessArchitectureBaselineReference,
  type ExactBusinessUnderstandingReference,
  type ExactSourceReference,
  type Initiative,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { BusinessCapabilityMapService } from "./business-capability-map.js"
import type { BusinessRuleCatalogService } from "./business-rule-catalog.js"
import type { BusinessUnderstandingService } from "./business-understanding.js"
import type { OperatingModelService } from "./operating-model.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"
import type { ValueStreamModelService } from "./value-stream-model.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const baselineInventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: BusinessArchitectureBaseline): ExactBusinessArchitectureBaselineReference {
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

function membership(input: BusinessArchitectureBaselineInput): Record<string, ExactBusinessUnderstandingReference> {
  return {
    businessUnderstanding: input.businessUnderstanding,
    stakeholderModel: input.stakeholderModel,
    outcomeModel: input.outcomeModel,
    capabilityMap: input.capabilityMap,
    valueStreamModel: input.valueStreamModel,
    operatingModel: input.operatingModel,
    businessRuleCatalog: input.businessRuleCatalog,
  }
}

function coverageIdentity(kind: BusinessArchitectureElementKind, key: string): string {
  return `${kind}:${key}`
}

export class BusinessArchitectureBaselineService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly businessUnderstanding: BusinessUnderstandingService,
    private readonly capabilityMaps: BusinessCapabilityMapService,
    private readonly valueStreams: ValueStreamModelService,
    private readonly operatingModels: OperatingModelService,
    private readonly businessRules: BusinessRuleCatalogService,
  ) {}

  async create(inputValue: BusinessArchitectureBaselineInput, actorId: string): Promise<BusinessArchitectureBaseline> {
    const input = businessArchitectureBaselineInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateUpstreamAndIntegration(input)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Business Architecture Baseline candidate")
      }
      const now = new Date().toISOString()
      const record = businessArchitectureBaselineSchema.parse({
        schemaVersion: 1,
        kind: "business-architecture-baseline-candidate",
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
          "business-architecture-baseline-is-a-candidate-compound-snapshot-and-does-not-designate-or-approve-a-baseline-establish-readiness-grant-exceptions-deploy-enforcement-or-authorize-action",
      })
      await this.commitVersionedRecord(record, "business.architecture-baseline.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: BusinessArchitectureBaselineInput,
    actorId: string,
  ): Promise<BusinessArchitectureBaseline> {
    const input = businessArchitectureBaselineInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Business Architecture Baseline revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Business Architecture Baseline Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateUpstreamAndIntegration(input)
      const record = businessArchitectureBaselineSchema.parse({
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
      await this.commitVersionedRecord(record, "business.architecture-baseline.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<BusinessArchitectureBaseline> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Business Architecture Baseline ID")),
      businessArchitectureBaselineSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<BusinessArchitectureBaseline | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords(
      "business-architecture-baselines",
      currentRecordPattern,
      businessArchitectureBaselineSchema,
    )
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Business Architecture Baseline candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<BusinessArchitectureBaseline> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Business Architecture Baseline history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Business Architecture Baseline ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), businessArchitectureBaselineSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Business Architecture Baseline history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<BusinessArchitectureBaseline[]> {
    const recordId = this.requireUuid(id, "Business Architecture Baseline ID")
    const records = await this.listRecords(
      "business-architecture-baseline-history",
      new RegExp(`^business-architecture-baseline-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      businessArchitectureBaselineSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Business Architecture Baseline history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<BusinessArchitectureBaselineAssessment> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [
      product,
      initiative,
      baseline,
      business,
      stakeholder,
      outcome,
      capabilityMap,
      valueStreamModel,
      operatingModel,
      businessRuleCatalog,
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
      this.businessRules.readCurrent(targetId),
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
    if (baseline) {
      if (canonicalDigest(baseline.context) !== canonicalDigest(expectedContext)) staleBindingCount += 1
      const bindings = [
        [baseline.businessUnderstanding, business],
        [baseline.stakeholderModel, stakeholder],
        [baseline.outcomeModel, outcome],
        [baseline.capabilityMap, capabilityMap],
        [baseline.valueStreamModel, valueStreamModel],
        [baseline.operatingModel, operatingModel],
        [baseline.businessRuleCatalog, businessRuleCatalog],
      ] as const
      for (const [reference, record] of bindings) {
        if (!record || !exactRecordMatches(reference, record)) staleBindingCount += 1
      }
      if (baseline.membershipDigest !== canonicalDigest(membership(baseline))) staleBindingCount += 1
    }
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(baseline).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const coverage = baseline?.coverage ?? []
    const includedElementCount = coverage.filter((entry) => entry.disposition === "included-candidate").length
    const excludedElementCount = coverage.filter((entry) => entry.disposition === "excluded-candidate").length
    const unresolvedElementCount = coverage.filter((entry) => entry.disposition === "unresolved").length
    const consistencyGapCount = baseline?.consistencyChecks.filter(
      (check) => check.state !== "candidate-satisfied",
    ).length ?? 0
    const reasons: string[] = []
    if (!baseline) reasons.push("No versioned Business Architecture Baseline candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The Business Architecture Baseline does not bind the exact current Product, Initiative, or business records")
    if (staleSourceReferenceCount > 0) reasons.push("One or more Business Architecture Baseline claims reference a superseded Source revision")
    if (unresolvedElementCount > 0) reasons.push("One or more Business Architecture elements remain unresolved")
    if (consistencyGapCount > 0) reasons.push("One or more Business Architecture consistency checks contain a gap or unknown result")
    return businessArchitectureBaselineAssessmentSchema.parse({
      schemaVersion: 1,
      kind: "business-architecture-baseline-assessment",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(baseline ? { baseline: exactReference(baseline) } : {}),
      coveredElementCount: coverage.length,
      includedElementCount,
      excludedElementCount,
      unresolvedElementCount,
      integrationClaimCount: baseline?.integrationClaims.length ?? 0,
      consistencyCheckCount: baseline?.consistencyChecks.length ?? 0,
      consistencyGapCount,
      staleBindingCount,
      staleSourceReferenceCount,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "business-architecture-baseline-assessment-reports-candidate-coherence-and-gaps-and-does-not-designate-or-approve-a-baseline-establish-readiness-or-authorize-action",
    })
  }

  async project(initiativeId: string): Promise<BusinessArchitectureBaselineProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, assessment, baseline] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.assess(targetId),
      this.readCurrent(targetId),
    ])
    if (assessment.productId !== product.id || assessment.productRevision !== revisionOf(product) ||
        assessment.initiativeId !== initiative.id || assessment.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Business Architecture Baseline projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "business-architecture-baseline-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: {
        id: initiative.id,
        revision: revisionOf(initiative),
        digest: canonicalDigest(initiative),
        state: initiative.state,
      },
      assessment,
      ...(baseline ? {
        baseline: {
          id: baseline.id,
          revision: baseline.revision,
          digest: canonicalDigest(baseline),
          membershipDigest: baseline.membershipDigest,
          state: baseline.state,
          coveredElementCount: baseline.coverage.length,
          integrationClaimCount: baseline.integrationClaims.length,
          consistencyGapCount: baseline.consistencyChecks.filter(
            (check) => check.state !== "candidate-satisfied",
          ).length,
          updatedAt: baseline.updatedAt,
        },
      } : {}),
      observedAt: new Date().toISOString(),
      privacyBoundary:
        "projection-contains-identities-counts-statuses-and-digests-only-not-architecture-narrative-source-content-personal-data-locators-or-credentials" as const,
      authorityBoundary:
        "business-architecture-baseline-projection-does-not-designate-or-approve-a-baseline-establish-readiness-grant-exceptions-deploy-enforcement-or-authorize-action" as const,
    }
    return businessArchitectureBaselineProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const [product, baselines] = await Promise.all([
      this.readProduct(),
      this.listRecords("business-architecture-baselines", currentRecordPattern, businessArchitectureBaselineSchema),
    ])
    for (const baseline of baselines) {
      try {
        const initiative = await this.readInitiative(baseline.initiativeId)
        this.validateContext(baseline.context, product, initiative)
        await this.validateSourceReferences(baseline, initiative.id)
        await this.validateUpstreamAndIntegration(baseline)
        if (baseline.membershipDigest !== canonicalDigest(membership(baseline))) {
          throw new Error("Business Architecture Baseline membership digest is invalid")
        }
        const history = await this.listHistory(baseline.id)
        if (history.length !== baseline.revision || canonicalDigest(history[0]) !== canonicalDigest(baseline)) {
          throw new Error("Current Business Architecture Baseline does not match its complete immutable history")
        }
        const assessment = await this.assess(baseline.initiativeId)
        if (assessment.staleBindingCount > 0 || assessment.staleSourceReferenceCount > 0) {
          issues.push({
            code: "business.architecture-baseline-binding-review-required",
            severity: "warning",
            message: `Initiative ${baseline.initiativeId} has stale Business Architecture Baseline bindings.`,
            record: { type: baseline.kind, id: baseline.id, revision: baseline.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "business.architecture-baseline-invalid",
          severity: "error",
          message: `Business Architecture Baseline ${baseline.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: baseline.kind, id: baseline.id, revision: baseline.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private async validateUpstreamAndIntegration(input: BusinessArchitectureBaselineInput): Promise<void> {
    const [business, stakeholder, outcome, capabilityMap, valueStreamModel, operatingModel, businessRuleCatalog] =
      await Promise.all([
        this.businessUnderstanding.readCurrentBusinessUnderstanding(input.initiativeId),
        this.businessUnderstanding.readCurrentStakeholderModel(input.initiativeId),
        this.businessUnderstanding.readCurrentOutcomeModel(input.initiativeId),
        this.capabilityMaps.readCurrent(input.initiativeId),
        this.valueStreams.readCurrent(input.initiativeId),
        this.operatingModels.readCurrent(input.initiativeId),
        this.businessRules.readCurrent(input.initiativeId),
      ])
    const bindings = [
      [input.businessUnderstanding, business, "Business Understanding"],
      [input.stakeholderModel, stakeholder, "Stakeholder Model"],
      [input.outcomeModel, outcome, "Outcome Model"],
      [input.capabilityMap, capabilityMap, "Business Capability Map"],
      [input.valueStreamModel, valueStreamModel, "Value Stream Model"],
      [input.operatingModel, operatingModel, "Operating Model"],
      [input.businessRuleCatalog, businessRuleCatalog, "Business Rule Catalog"],
    ] as const
    for (const [reference, record, label] of bindings) {
      if (!record || !exactRecordMatches(reference, record)) {
        throw new Error(`Business Architecture Baseline must bind the exact current ${label}`)
      }
    }
    if (!capabilityMap || !valueStreamModel || !operatingModel || !businessRuleCatalog) {
      throw new Error("Business Architecture Baseline upstream records are incomplete")
    }
    const expectedCoverage = [
      ...capabilityMap.capabilities.map((entry) => coverageIdentity("capability", entry.key)),
      ...valueStreamModel.valueStreams.map((entry) => coverageIdentity("value-stream", entry.key)),
      ...operatingModel.roles.map((entry) => coverageIdentity("operating-role", entry.key)),
      ...operatingModel.decisionRights.map((entry) => coverageIdentity("decision-right", entry.key)),
      ...businessRuleCatalog.rules.map((entry) => coverageIdentity("business-rule", entry.key)),
      ...businessRuleCatalog.enforcementTargets.map((entry) => coverageIdentity("enforcement-target", entry.key)),
      ...businessRuleCatalog.exceptions.map((entry) => coverageIdentity("exception", entry.key)),
    ].sort((left, right) => left.localeCompare(right))
    const actualCoverage = input.coverage.map((entry) => coverageIdentity(entry.elementKind, entry.elementKey))
    if (canonicalDigest(actualCoverage) !== canonicalDigest(expectedCoverage)) {
      throw new Error("Business Architecture Baseline coverage must enumerate every exact bound architecture element once")
    }
    const capabilities = new Set(capabilityMap.capabilities.map((entry) => entry.key))
    const valueStreams = new Set(valueStreamModel.valueStreams.map((entry) => entry.key))
    const roles = new Set(operatingModel.roles.map((entry) => entry.key))
    const decisionRights = new Map(operatingModel.decisionRights.map((entry) => [entry.key, entry]))
    const rules = new Set(businessRuleCatalog.rules.map((entry) => entry.key))
    for (const claim of input.integrationClaims) {
      if (claim.capabilityKeys.some((key) => !capabilities.has(key)) ||
          claim.valueStreamKeys.some((key) => !valueStreams.has(key)) ||
          claim.roleKeys.some((key) => !roles.has(key)) ||
          claim.decisionRightKeys.some((key) => !decisionRights.has(key)) ||
          claim.ruleKeys.some((key) => !rules.has(key))) {
        throw new Error("Business Architecture integration claims must reference exact bound element keys")
      }
    }
    const integrated = new Set(input.integrationClaims.flatMap((claim) => [
      ...claim.capabilityKeys.map((key) => coverageIdentity("capability", key)),
      ...claim.valueStreamKeys.map((key) => coverageIdentity("value-stream", key)),
      ...claim.ruleKeys.map((key) => coverageIdentity("business-rule", key)),
    ]))
    if (input.coverage.some((entry) =>
      entry.disposition === "included-candidate" &&
      ["capability", "value-stream", "business-rule"].includes(entry.elementKind) &&
      !integrated.has(coverageIdentity(entry.elementKind, entry.elementKey)))) {
      throw new Error("Every included capability, value stream, and Business Rule requires a cross-model integration claim")
    }
    const roleReferences = [
      input.governance.ownerRoleKey,
      ...input.governance.reviewerRoleKeys,
      input.changeControl.accountableRoleKey,
      ...input.consistencyChecks.map((check) => check.accountableRoleKey),
    ]
    if (roleReferences.some((key) => !roles.has(key))) {
      throw new Error("Business Architecture governance must reference exact bound Operating Model roles")
    }
    const governanceRight = decisionRights.get(input.governance.decisionRightKey)
    const changeRight = decisionRights.get(input.changeControl.decisionRightKey)
    if (!governanceRight || governanceRight.accountableRoleKey !== input.governance.ownerRoleKey ||
        !changeRight || changeRight.accountableRoleKey !== input.changeControl.accountableRoleKey) {
      throw new Error("Business Architecture candidate governance must match exact accountable decision rights")
    }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Business Architecture Baseline Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product),
      productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative),
      initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Business Architecture Baseline must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Business Architecture Baseline Source reference identity, Initiative, revision, record digest, or content digest does not match")
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
      throw new Error(`Terminal Initiative ${initiative.state} Business Architecture Baseline is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(
    record: BusinessArchitectureBaseline,
    eventType: string,
    actorId: string,
  ): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, businessArchitectureBaselineSchema),
        this.governed(this.historyPath(record.id, record.revision), record, businessArchitectureBaselineSchema),
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
          approvalState: record.governance.approvalState,
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("business-architecture-baselines", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve(
      "business-architecture-baseline-history",
      `business-architecture-baseline-${id}-r${revision}.json`,
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
    if (names.length > baselineInventoryLimit) {
      throw new Error(`Business Architecture Baseline directory ${directory} exceeds the ${baselineInventoryLimit}-record safety limit`)
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
