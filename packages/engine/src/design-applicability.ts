import { randomUUID } from "node:crypto"

import {
  designApplicabilityInputSchema,
  designApplicabilityProjectionSchema,
  designApplicabilitySchema,
  designApplicabilityStatusSchema,
  exactSourceReferenceSchema,
  type BusinessContextBinding,
  type DesignApplicability,
  type DesignApplicabilityInput,
  type DesignApplicabilityProjection,
  type DesignApplicabilityStatus,
  type ExactSourceReference,
  type Initiative,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const designApplicabilityInventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: DesignApplicability) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: DesignApplicabilityInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    classificationBinding: input.classificationBinding,
    applicabilityBinding: input.applicabilityBinding,
    scopes: input.scopes,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    designApprovalState: input.designApprovalState,
    designBaselineState: input.designBaselineState,
    implementationAuthorityState: input.implementationAuthorityState,
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
  const unique = new Map(collectExactSourceReferences(value).map((reference) => [
    `${reference.sourceId}:${reference.sourceRevision}:${reference.recordDigest}:${reference.contentDigest}`,
    reference,
  ]))
  return [...unique.values()].sort((left, right) =>
    left.sourceId.localeCompare(right.sourceId) || left.sourceRevision - right.sourceRevision)
}

function generalDecision(
  initiative: Initiative,
  type: "activity" | "capability",
  key: "experience-design" | "design-reference-integration",
) {
  return initiative.applicability?.decisions.find((decision) =>
    decision.subject.type === type && decision.subject.key === key)
}

export class DesignApplicabilityService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
  ) {}

  async create(inputValue: DesignApplicabilityInput, actorId: string): Promise<DesignApplicability> {
    const input = designApplicabilityInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      this.validateBindings(input, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Design Applicability candidate")
      }
      const now = new Date().toISOString()
      const record = designApplicabilitySchema.parse({
        schemaVersion: 1,
        kind: "design-applicability-candidate",
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
          "design-applicability-is-candidate-guidance-and-does-not-approve-design-establish-a-baseline-grant-readiness-or-authorize-implementation-or-action",
      })
      await this.commitVersionedRecord(record, "design-applicability.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: DesignApplicabilityInput,
    actorId: string,
  ): Promise<DesignApplicability> {
    const input = designApplicabilityInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Design Applicability revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Design Applicability Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      this.validateBindings(input, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      const record = designApplicabilitySchema.parse({
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
      await this.commitVersionedRecord(record, "design-applicability.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<DesignApplicability> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Design Applicability ID")), designApplicabilitySchema)
  }

  async readCurrent(initiativeId: string): Promise<DesignApplicability | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("design-applicability", currentRecordPattern, designApplicabilitySchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Design Applicability candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<DesignApplicability> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Design Applicability history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Design Applicability ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), designApplicabilitySchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Design Applicability history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<DesignApplicability[]> {
    const recordId = this.requireUuid(id, "Design Applicability ID")
    const records = await this.listRecords(
      "design-applicability-history",
      new RegExp(`^design-applicability-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      designApplicabilitySchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Design Applicability history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<DesignApplicabilityStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const staleBindingCount = candidate ? this.bindingMismatchCount(candidate, product, initiative) : 0
    const currentSources = await this.sourceGovernance.listSources(targetId)
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(candidate).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const scopes = candidate?.scopes ?? []
    const decisions = scopes.flatMap((scope) => scope.decisions)
    const unresolvedDecisionCount = decisions.filter((decision) => decision.status === "awaiting-human-decision").length
    const blockedDecisionCount = decisions.filter((decision) => decision.status === "blocked").length
    const pendingApprovalCount = decisions.filter((decision) => decision.approval.state === "pending").length
    const rejectedApprovalCount = decisions.filter((decision) => decision.approval.state === "rejected").length
    const unresolvedDepthCount = scopes.filter((scope) => scope.requiredDepth === "unresolved").length
    const unresolvedSourceCount = scopes.filter((scope) => scope.designSource.state === "unresolved").length
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Design Applicability candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind the exact current Product, Initiative, classification, applicability matrix, catalog, or general design decisions")
    if (staleSourceReferenceCount > 0) reasons.push("One or more design applicability assertions reference a superseded Source revision")
    if (unresolvedDecisionCount > 0) reasons.push("One or more design applicability aspects await accountable human judgment")
    if (blockedDecisionCount > 0) reasons.push("One or more design applicability aspects are blocked")
    if (pendingApprovalCount > 0) reasons.push("One or more design applicability approvals remain pending")
    if (rejectedApprovalCount > 0) reasons.push("One or more design applicability approvals were rejected")
    if (unresolvedDepthCount > 0) reasons.push("One or more target scopes have unresolved design depth")
    if (unresolvedSourceCount > 0) reasons.push("One or more target scopes have unresolved design source strategy")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved design applicability questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return designApplicabilityStatusSchema.parse({
      schemaVersion: 1,
      kind: "design-applicability-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      scopeCount: scopes.length,
      decisionCount: decisions.length,
      unresolvedDecisionCount,
      blockedDecisionCount,
      pendingApprovalCount,
      rejectedApprovalCount,
      unresolvedDepthCount,
      unresolvedSourceCount,
      staleBindingCount,
      staleSourceReferenceCount,
      unresolvedQuestionCount,
      reviewState,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "design-applicability-status-is-observational-and-does-not-approve-design-establish-a-baseline-grant-readiness-or-authorize-implementation-or-action",
    })
  }

  async project(initiativeId: string): Promise<DesignApplicabilityProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Design Applicability projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "design-applicability-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: {
        id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state,
      },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        state: candidate.state,
        scopeCount: candidate.scopes.length,
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: new Date().toISOString(),
      privacyBoundary:
        "projection-contains-identities-counts-statuses-and-digests-only-not-rationales-source-content-journeys-design-content-personal-data-secrets-or-credentials" as const,
      authorityBoundary:
        "design-applicability-projection-is-read-only-and-does-not-approve-design-establish-a-baseline-grant-readiness-or-authorize-write-implementation-or-action" as const,
    }
    return designApplicabilityProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("design-applicability", currentRecordPattern, designApplicabilitySchema)
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) {
          throw new Error("Design Applicability membership digest is invalid")
        }
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Design Applicability does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "design-applicability.binding-review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale Design Applicability bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "design-applicability.invalid",
          severity: "error",
          message: `Design Applicability ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Design Applicability Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Design Applicability must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private validateBindings(input: DesignApplicabilityInput, product: Product, initiative: Initiative): void {
    if (this.bindingMismatchCount(input, product, initiative) > 0) {
      throw new Error("Design Applicability must bind the exact current classification, applicability matrix, subject catalog, and general design decisions")
    }
    const experienceStatus = input.applicabilityBinding.experienceDesign.status
    if (experienceStatus === "not-applicable" && input.scopes.some((scope) =>
      scope.decisions.some((decision) => decision.aspect !== "figma" && decision.status !== "not-applicable"))) {
      throw new Error("Detailed UX, UI, and design-work dispositions cannot contradict general not-applicable experience design")
    }
    const integrationStatus = input.applicabilityBinding.designReferenceIntegration.status
    if (integrationStatus === "not-applicable" && input.scopes.some((scope) =>
      scope.decisions.find((decision) => decision.aspect === "figma")?.status !== "not-applicable" ||
      scope.designSource.modes.some((mode) => mode === "figma-design" || mode === "figma-make"))) {
      throw new Error("Detailed Figma disposition cannot contradict general not-applicable design-reference integration")
    }
  }

  private bindingMismatchCount(input: DesignApplicabilityInput, product: Product, initiative: Initiative): number {
    let mismatches = 0
    const expectedContext = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(input.context) !== canonicalDigest(expectedContext)) mismatches += 1
    const classification = initiative.classification
    if (!classification || input.classificationBinding.digest !== canonicalDigest(classification) ||
        input.classificationBinding.completenessPolicyVersion !== classification.completenessPolicyVersion ||
        input.classificationBinding.completenessPolicyDigest !== classification.completenessPolicyDigest) mismatches += 1
    const matrix = initiative.applicability
    if (!matrix || matrix.state !== "current" || input.applicabilityBinding.matrixRevision !== matrix.revision ||
        input.applicabilityBinding.matrixDigest !== canonicalDigest(matrix) ||
        input.applicabilityBinding.catalogVersion !== matrix.subjectCatalog?.catalogVersion ||
        input.applicabilityBinding.catalogDigest !== matrix.subjectCatalog?.digest) mismatches += 1
    const expectedDecisions = [
      [input.applicabilityBinding.experienceDesign, generalDecision(initiative, "activity", "experience-design")],
      [input.applicabilityBinding.designReferenceIntegration, generalDecision(initiative, "capability", "design-reference-integration")],
    ] as const
    for (const [binding, decision] of expectedDecisions) {
      if (!decision || binding.decisionId !== decision.id || binding.revision !== decision.revision ||
          binding.digest !== canonicalDigest(decision) || binding.status !== decision.status) mismatches += 1
    }
    return mismatches
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Design Applicability Source reference identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Design Applicability is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: DesignApplicability, eventType: string, actorId: string): Promise<void> {
    const decisions = record.scopes.flatMap((scope) => scope.decisions)
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, designApplicabilitySchema),
        this.governed(this.historyPath(record.id, record.revision), record, designApplicabilitySchema),
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
          classificationBinding: record.classificationBinding,
          applicabilityBinding: record.applicabilityBinding,
          scopeCount: record.scopes.length,
          decisionCount: decisions.length,
          decisionStatusCounts: Object.fromEntries([...new Set(decisions.map((decision) => decision.status))]
            .sort().map((status) => [status, decisions.filter((decision) => decision.status === status).length])),
          depthCounts: Object.fromEntries([...new Set(record.scopes.map((scope) => scope.requiredDepth))]
            .sort().map((depth) => [depth, record.scopes.filter((scope) => scope.requiredDepth === depth).length])),
          sourceModeCounts: Object.fromEntries([...new Set(record.scopes.flatMap((scope) => scope.designSource.modes))]
            .sort().map((mode) => [mode, record.scopes.filter((scope) => scope.designSource.modes.includes(mode)).length])),
          reviewState: record.reviewState,
          designApprovalState: record.designApprovalState,
          designBaselineState: record.designBaselineState,
          implementationAuthorityState: record.implementationAuthorityState,
          readinessAuthorityState: "not-established",
          writeAuthorityState: "not-granted",
          actionAuthorityState: "not-granted",
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("design-applicability", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("design-applicability-history", `design-applicability-${id}-r${revision}.json`)
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
    if (names.length > designApplicabilityInventoryLimit) {
      throw new Error(`Design Applicability directory ${directory} exceeds the safety limit`)
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
