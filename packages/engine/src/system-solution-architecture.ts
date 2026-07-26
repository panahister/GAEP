import { randomUUID } from "node:crypto"

import {
  exactSourceReferenceSchema,
  systemSolutionArchitectureAssessmentSchema,
  systemSolutionArchitectureInputSchema,
  systemSolutionArchitectureProjectionSchema,
  systemSolutionArchitectureSchema,
  type BusinessContextBinding,
  type ExactBusinessArchitectureBaselineReference,
  type ExactSourceReference,
  type ExactSystemSolutionArchitectureReference,
  type Initiative,
  type Product,
  type SystemSolutionArchitecture,
  type SystemSolutionArchitectureAssessment,
  type SystemSolutionArchitectureInput,
  type SystemSolutionArchitectureProjection,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { BusinessArchitectureBaselineService } from "./business-architecture-baseline.js"
import type { OperatingModelService } from "./operating-model.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const architectureInventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: SystemSolutionArchitecture): ExactSystemSolutionArchitectureReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: SystemSolutionArchitectureInput): Record<string, ExactBusinessArchitectureBaselineReference> {
  return { businessArchitectureBaseline: input.businessArchitectureBaseline }
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
  reference: ExactBusinessArchitectureBaselineReference,
  record: { id: string; revision: number },
): boolean {
  return reference.recordId === record.id &&
    reference.revision === record.revision &&
    reference.digest === canonicalDigest(record)
}

export class SystemSolutionArchitectureService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly businessArchitectureBaselines: BusinessArchitectureBaselineService,
    private readonly operatingModels: OperatingModelService,
  ) {}

  async create(inputValue: SystemSolutionArchitectureInput, actorId: string): Promise<SystemSolutionArchitecture> {
    const input = systemSolutionArchitectureInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindingsAndArchitecture(input)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current System/Solution Architecture candidate")
      }
      const now = new Date().toISOString()
      const record = systemSolutionArchitectureSchema.parse({
        schemaVersion: 1,
        kind: "system-solution-architecture-candidate",
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
          "system-solution-architecture-is-a-candidate-design-and-does-not-approve-or-designate-an-architecture-baseline-establish-readiness-prove-conformance-mandate-technology-or-authorize-action",
      })
      await this.commitVersionedRecord(record, "architecture.system-solution.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: SystemSolutionArchitectureInput,
    actorId: string,
  ): Promise<SystemSolutionArchitecture> {
    const input = systemSolutionArchitectureInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("System/Solution Architecture revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("System/Solution Architecture Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindingsAndArchitecture(input)
      const record = systemSolutionArchitectureSchema.parse({
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
      await this.commitVersionedRecord(record, "architecture.system-solution.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<SystemSolutionArchitecture> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "System/Solution Architecture ID")),
      systemSolutionArchitectureSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<SystemSolutionArchitecture | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords(
      "system-solution-architectures",
      currentRecordPattern,
      systemSolutionArchitectureSchema,
    )
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current System/Solution Architecture candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<SystemSolutionArchitecture> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("System/Solution Architecture history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "System/Solution Architecture ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), systemSolutionArchitectureSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("System/Solution Architecture history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<SystemSolutionArchitecture[]> {
    const recordId = this.requireUuid(id, "System/Solution Architecture ID")
    const records = await this.listRecords(
      "system-solution-architecture-history",
      new RegExp(`^system-solution-architecture-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      systemSolutionArchitectureSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("System/Solution Architecture history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<SystemSolutionArchitectureAssessment> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, architecture, baseline, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.businessArchitectureBaselines.readCurrent(targetId),
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
    if (architecture) {
      if (canonicalDigest(architecture.context) !== canonicalDigest(expectedContext)) staleBindingCount += 1
      if (!baseline || !exactRecordMatches(architecture.businessArchitectureBaseline, baseline)) staleBindingCount += 1
      if (architecture.membershipDigest !== canonicalDigest(membership(architecture))) staleBindingCount += 1
    }
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(architecture).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const unresolvedQualityAttributeCount = architecture?.qualityAttributes.filter(
      (entry) => entry.state === "unresolved",
    ).length ?? 0
    const unresolvedDecisionCount = architecture?.decisions.filter((entry) => entry.disposition === "unresolved").length ?? 0
    const unresolvedConformanceCriterionCount = architecture?.conformanceCriteria.filter(
      (entry) => entry.state === "unresolved",
    ).length ?? 0
    const lifecycleGapCount = architecture?.lifecycleConsequences.filter(
      (entry) => entry.state === "unresolved",
    ).length ?? 0
    const inconsistencyCount = architecture?.inconsistencies.length ?? 0
    const unresolvedQuestionCount = architecture?.unresolvedQuestions.length ?? 0
    const reasons: string[] = []
    if (!architecture) reasons.push("No versioned System/Solution Architecture candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The System/Solution Architecture does not bind the exact current Product, Initiative, or Business Architecture Baseline")
    if (staleSourceReferenceCount > 0) reasons.push("One or more System/Solution Architecture claims reference a superseded Source revision")
    if (unresolvedQualityAttributeCount > 0) reasons.push("One or more quality-attribute scenarios remain unresolved")
    if (unresolvedDecisionCount > 0) reasons.push("One or more architecture decisions remain unresolved")
    if (unresolvedConformanceCriterionCount > 0) reasons.push("One or more architecture conformance criteria remain unresolved")
    if (lifecycleGapCount > 0) reasons.push("One or more architecture lifecycle consequences remain unresolved")
    if (inconsistencyCount > 0) reasons.push("The candidate records explicit architecture inconsistencies")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved architecture questions")
    return systemSolutionArchitectureAssessmentSchema.parse({
      schemaVersion: 1,
      kind: "system-solution-architecture-assessment",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(architecture ? { architecture: exactReference(architecture) } : {}),
      concernCount: architecture?.concerns.length ?? 0,
      viewCount: architecture?.views.length ?? 0,
      elementCount: architecture?.elements.length ?? 0,
      relationCount: architecture?.relations.length ?? 0,
      qualityAttributeCount: architecture?.qualityAttributes.length ?? 0,
      unresolvedQualityAttributeCount,
      decisionCount: architecture?.decisions.length ?? 0,
      unresolvedDecisionCount,
      conformanceCriterionCount: architecture?.conformanceCriteria.length ?? 0,
      unresolvedConformanceCriterionCount,
      lifecycleGapCount,
      inconsistencyCount,
      unresolvedQuestionCount,
      staleBindingCount,
      staleSourceReferenceCount,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "system-solution-architecture-assessment-reports-candidate-coverage-and-gaps-and-does-not-approve-baseline-readiness-conformance-technology-or-action",
    })
  }

  async project(initiativeId: string): Promise<SystemSolutionArchitectureProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, assessment, architecture] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.assess(targetId),
      this.readCurrent(targetId),
    ])
    if (assessment.productId !== product.id || assessment.productRevision !== revisionOf(product) ||
        assessment.initiativeId !== initiative.id || assessment.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("System/Solution Architecture projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "system-solution-architecture-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: {
        id: initiative.id,
        revision: revisionOf(initiative),
        digest: canonicalDigest(initiative),
        state: initiative.state,
      },
      assessment,
      ...(architecture ? {
        architecture: {
          id: architecture.id,
          revision: architecture.revision,
          digest: canonicalDigest(architecture),
          membershipDigest: architecture.membershipDigest,
          state: architecture.state,
          concernCount: architecture.concerns.length,
          viewCount: architecture.views.length,
          elementCount: architecture.elements.length,
          qualityAttributeCount: architecture.qualityAttributes.length,
          decisionCount: architecture.decisions.length,
          updatedAt: architecture.updatedAt,
        },
      } : {}),
      observedAt: new Date().toISOString(),
      privacyBoundary:
        "projection-contains-identities-counts-statuses-and-digests-only-not-architecture-narrative-source-content-personal-data-locators-or-credentials" as const,
      authorityBoundary:
        "system-solution-architecture-projection-does-not-approve-or-designate-an-architecture-baseline-establish-readiness-prove-conformance-mandate-technology-or-authorize-action" as const,
    }
    return systemSolutionArchitectureProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const [product, records] = await Promise.all([
      this.readProduct(),
      this.listRecords("system-solution-architectures", currentRecordPattern, systemSolutionArchitectureSchema),
    ])
    for (const architecture of records) {
      try {
        const initiative = await this.readInitiative(architecture.initiativeId)
        this.validateContext(architecture.context, product, initiative)
        await this.validateSourceReferences(architecture, initiative.id)
        await this.validateBindingsAndArchitecture(architecture)
        if (architecture.membershipDigest !== canonicalDigest(membership(architecture))) {
          throw new Error("System/Solution Architecture membership digest is invalid")
        }
        const history = await this.listHistory(architecture.id)
        if (history.length !== architecture.revision || canonicalDigest(history[0]) !== canonicalDigest(architecture)) {
          throw new Error("Current System/Solution Architecture does not match its complete immutable history")
        }
        const assessment = await this.assess(architecture.initiativeId)
        if (assessment.staleBindingCount > 0 || assessment.staleSourceReferenceCount > 0) {
          issues.push({
            code: "architecture.system-solution-binding-review-required",
            severity: "warning",
            message: `Initiative ${architecture.initiativeId} has stale System/Solution Architecture bindings.`,
            record: { type: architecture.kind, id: architecture.id, revision: architecture.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "architecture.system-solution-invalid",
          severity: "error",
          message: `System/Solution Architecture ${architecture.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: architecture.kind, id: architecture.id, revision: architecture.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private async validateBindingsAndArchitecture(input: SystemSolutionArchitectureInput): Promise<void> {
    const baseline = await this.businessArchitectureBaselines.readCurrent(input.initiativeId)
    if (!baseline || !exactRecordMatches(input.businessArchitectureBaseline, baseline)) {
      throw new Error("System/Solution Architecture must bind the exact current Business Architecture Baseline candidate")
    }
    const operatingModel = await this.operatingModels.readRevision(
      baseline.operatingModel.recordId,
      baseline.operatingModel.revision,
    )
    if (!exactRecordMatches(baseline.operatingModel, operatingModel)) {
      throw new Error("System/Solution Architecture Business Architecture Baseline has an invalid Operating Model binding")
    }
    const roles = new Set(operatingModel.roles.map((entry) => entry.key))
    const roleReferences = [
      input.governance.ownerRoleKey,
      ...input.governance.reviewerRoleKeys,
      ...input.concerns.flatMap((entry) => entry.stakeholderRoleKeys),
      ...input.views.flatMap((entry) => entry.audienceRoleKeys),
      ...input.elements.map((entry) => entry.ownerRoleKey),
      ...input.lifecycleConsequences.map((entry) => entry.ownerRoleKey),
    ]
    if (roleReferences.some((key) => !roles.has(key))) {
      throw new Error("System/Solution Architecture roles must reference exact bound Operating Model roles")
    }
    const businessElementKeys = new Set(baseline.coverage.map((entry) => entry.elementKey))
    if (input.concerns.some((entry) => entry.affectedBusinessElementKeys.some((key) => !businessElementKeys.has(key)))) {
      throw new Error("System/Solution Architecture concerns must reference exact Business Architecture element keys")
    }
    const viewedRelations = new Set(input.views.flatMap((entry) => entry.relationKeys))
    const viewedDecisions = new Set(input.views.flatMap((entry) => entry.decisionKeys))
    if (input.relations.some((entry) => !viewedRelations.has(entry.key)) ||
        input.decisions.some((entry) => !viewedDecisions.has(entry.key))) {
      throw new Error("Every declared System/Solution Architecture relation and decision must appear in a selected view")
    }
    const criteriaQualityKeys = new Set(input.conformanceCriteria.flatMap((entry) => entry.qualityAttributeKeys))
    const criteriaDecisionKeys = new Set(input.conformanceCriteria.flatMap((entry) => entry.decisionKeys))
    if (input.qualityAttributes.some((entry) => !criteriaQualityKeys.has(entry.key)) ||
        input.decisions.some((entry) => !criteriaDecisionKeys.has(entry.key))) {
      throw new Error("Every quality attribute and architecture decision requires a candidate conformance criterion")
    }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("System/Solution Architecture Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product),
      productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative),
      initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("System/Solution Architecture must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("System/Solution Architecture Source reference identity, Initiative, revision, record digest, or content digest does not match")
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
      throw new Error(`Terminal Initiative ${initiative.state} System/Solution Architecture is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(
    record: SystemSolutionArchitecture,
    eventType: string,
    actorId: string,
  ): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, systemSolutionArchitectureSchema),
        this.governed(this.historyPath(record.id, record.revision), record, systemSolutionArchitectureSchema),
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
          reviewState: record.governance.reviewState,
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("system-solution-architectures", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve(
      "system-solution-architecture-history",
      `system-solution-architecture-${id}-r${revision}.json`,
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
    if (names.length > architectureInventoryLimit) {
      throw new Error(`System/Solution Architecture directory ${directory} exceeds the ${architectureInventoryLimit}-record safety limit`)
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
