import { randomUUID } from "node:crypto"

import {
  exactSourceReferenceSchema,
  p5HandoffPackageInputSchema,
  p5HandoffPackageProjectionSchema,
  p5HandoffPackageSchema,
  p5HandoffPackageStatusSchema,
  type BusinessContextBinding,
  type ExactSourceReference,
  type Initiative,
  type P0P4ReadinessGate,
  type P0P4ReadinessGateStatus,
  type P5HandoffPackage,
  type P5HandoffPackageInput,
  type P5HandoffPackageProjection,
  type P5HandoffPackageStatus,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { P0P4ReadinessGateService } from "./p0-p4-readiness-gate.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const handoffInventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: P5HandoffPackage) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function exactRecordMatches(
  reference: { recordId: string; revision: number; digest: string },
  record: { id: string; revision?: number },
): boolean {
  return reference.recordId === record.id && reference.revision === revisionOf(record) &&
    reference.digest === canonicalDigest(record)
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

function membership(input: P5HandoffPackageInput) {
  return {
    informationClassification: input.informationClassification,
    title: input.title,
    objective: input.objective,
    scope: input.scope,
    readinessGate: input.readinessGate,
    readinessStatusDigest: input.readinessStatusDigest,
    readinessResult: input.readinessResult,
    target: input.target,
    items: input.items,
    requirementCoverage: input.requirementCoverage,
    assumptions: input.assumptions,
    unresolvedQuestions: input.unresolvedQuestions,
    conflicts: input.conflicts,
    limitations: input.limitations,
    nextActions: input.nextActions,
    transferState: input.transferState,
    acknowledgementState: input.acknowledgementState,
    sourceOwnershipState: input.sourceOwnershipState,
    transferAuthorityState: input.transferAuthorityState,
    p5EntryAuthorityState: input.p5EntryAuthorityState,
  }
}

/**
 * Produces the durable binding digest for a readiness assessment. assessedAt is
 * observational metadata, so excluding it prevents read-only reassessment from
 * invalidating an otherwise identical governed result.
 */
export function p0P4ReadinessStatusDigest(status: P0P4ReadinessGateStatus): `sha256:${string}` {
  const { assessedAt: _assessedAt, ...stableStatus } = status
  return canonicalDigest(stableStatus) as `sha256:${string}`
}

export class P5HandoffPackageService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly readinessGates: P0P4ReadinessGateService,
  ) {}

  async create(inputValue: P5HandoffPackageInput, actorId: string): Promise<P5HandoffPackage> {
    const input = p5HandoffPackageInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindings(input, product, initiative)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current P5 Handoff Package candidate")
      }
      const now = new Date().toISOString()
      const record = p5HandoffPackageSchema.parse({
        schemaVersion: 1,
        kind: "p5-handoff-package-candidate",
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
          "p5-handoff-package-is-candidate-context-and-does-not-transfer-source-ownership-establish-acknowledgement-approve-design-authorize-p5-entry-or-authorize-action",
      })
      await this.commitVersionedRecord(record, "p5-handoff-package.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: P5HandoffPackageInput,
    actorId: string,
  ): Promise<P5HandoffPackage> {
    const input = p5HandoffPackageInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("P5 Handoff Package revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("P5 Handoff Package Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindings(input, product, initiative)
      const record = p5HandoffPackageSchema.parse({
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
      await this.commitVersionedRecord(record, "p5-handoff-package.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<P5HandoffPackage> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "P5 Handoff Package ID")), p5HandoffPackageSchema)
  }

  async readCurrent(initiativeId: string): Promise<P5HandoffPackage | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("p5-handoff-packages", currentRecordPattern, p5HandoffPackageSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current P5 Handoff Package candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<P5HandoffPackage> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("P5 Handoff Package history revision must be a positive integer")
    const recordId = this.requireUuid(id, "P5 Handoff Package ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), p5HandoffPackageSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("P5 Handoff Package history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<P5HandoffPackage[]> {
    const recordId = this.requireUuid(id, "P5 Handoff Package ID")
    const records = await this.listRecords(
      "p5-handoff-package-history",
      new RegExp(`^p5-handoff-package-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      p5HandoffPackageSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("P5 Handoff Package history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<P5HandoffPackageStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, handoff, gate, readinessStatus] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.readinessGates.readCurrent(targetId),
      this.readinessGates.assess(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    let staleBindingCount = 0
    if (handoff) {
      const expectedContext: BusinessContextBinding = {
        productRevision: revisionOf(product), productDigest: canonicalDigest(product),
        initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
      }
      if (canonicalDigest(handoff.context) !== canonicalDigest(expectedContext)) staleBindingCount += 1
      if (!gate || !exactRecordMatches(handoff.readinessGate, gate)) staleBindingCount += 1
      if (handoff.readinessStatusDigest !== p0P4ReadinessStatusDigest(readinessStatus)) staleBindingCount += 1
      if (handoff.readinessResult !== readinessStatus.result) staleBindingCount += 1
      if (handoff.membershipDigest !== canonicalDigest(membership(handoff))) staleBindingCount += 1
      if (gate) staleBindingCount += this.itemBindingMismatchCount(handoff, gate)
    }
    const currentSources = await this.sourceGovernance.listSources(targetId)
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(handoff).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const items = handoff?.items ?? []
    const includedItemCount = items.filter((entry) => entry.disposition === "included").length
    const referenceOnlyItemCount = items.filter((entry) => entry.disposition === "reference-only").length
    const omittedNotApplicableItemCount = items.filter((entry) => entry.disposition === "omitted-not-applicable").length
    const unresolvedItemCount = items.filter((entry) => entry.disposition === "unresolved").length
    const staleOrUnknownItemCount = items.filter((entry) =>
      entry.applicability === "applicable" && entry.freshness !== "current").length
    const lossyTransformationCount = items.filter((entry) => entry.semanticRelationship === "lossy").length
    const unresolvedRequirementCount = handoff?.requirementCoverage.filter((entry) => entry.state === "unresolved").length ?? 0
    const conflictCount = handoff?.conflicts.length ?? 0
    const unresolvedQuestionCount = handoff?.unresolvedQuestions.length ?? 0
    const readinessResult = readinessStatus.result
    const transferState = handoff?.transferState ?? "draft"
    const reasons: string[] = []
    if (!handoff) reasons.push("No versioned P5 Handoff Package candidate exists for this Initiative")
    if (!gate) reasons.push("No current P0-P4 Readiness Gate candidate exists for this Initiative")
    if (readinessResult !== "passed") reasons.push("The current P0-P4 Readiness Gate evaluation has not passed")
    if (staleBindingCount > 0) reasons.push("The handoff does not bind the exact current Product, Initiative, readiness evaluation, or output catalog")
    if (staleSourceReferenceCount > 0) reasons.push("One or more handoff assertions reference a superseded Source revision")
    if (unresolvedItemCount > 0) reasons.push("One or more canonical handoff items remain unresolved")
    if (staleOrUnknownItemCount > 0) reasons.push("One or more applicable handoff items have stale or unknown freshness")
    if (unresolvedRequirementCount > 0) reasons.push("One or more P5 Handoff Package requirements remain unresolved")
    if (conflictCount > 0) reasons.push("The handoff records explicit conflicts")
    if (unresolvedQuestionCount > 0) reasons.push("The handoff records unresolved questions")
    if (handoff && transferState !== "ready-for-human-review") reasons.push("The handoff is not marked ready for human review")
    const state = reasons.length === 0 ? "complete-for-review" : "attention-required"
    return p5HandoffPackageStatusSchema.parse({
      schemaVersion: 1,
      kind: "p5-handoff-package-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(handoff ? { handoff: exactReference(handoff) } : {}),
      itemCount: items.length,
      includedItemCount,
      referenceOnlyItemCount,
      omittedNotApplicableItemCount,
      unresolvedItemCount,
      staleOrUnknownItemCount,
      lossyTransformationCount,
      unresolvedRequirementCount,
      conflictCount,
      unresolvedQuestionCount,
      staleBindingCount,
      staleSourceReferenceCount,
      readinessResult,
      transferState,
      state,
      reasons,
      assessedAt: new Date().toISOString(),
      handoffBoundary: "handoff-transfers-exact-candidate-context-not-source-ownership-or-authority",
      authorityBoundary:
        "p5-handoff-package-status-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<P5HandoffPackageProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, handoff] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("P5 Handoff Package projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "p5-handoff-package-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: {
        id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state,
      },
      status,
      ...(handoff ? { handoff: {
        id: handoff.id,
        revision: handoff.revision,
        digest: canonicalDigest(handoff),
        membershipDigest: handoff.membershipDigest,
        state: handoff.state,
        readinessStatusDigest: handoff.readinessStatusDigest,
        itemCount: handoff.items.length,
        requirementCount: handoff.requirementCoverage.length,
        deliveryMode: handoff.target.deliveryMode,
        updatedAt: handoff.updatedAt,
      } } : {}),
      observedAt: new Date().toISOString(),
      privacyBoundary:
        "projection-contains-identities-counts-statuses-and-digests-only-not-item-content-summaries-omissions-uncertainties-source-content-personal-data-secrets-credentials-or-destinations" as const,
      authorityBoundary:
        "p5-handoff-package-projection-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-write-or-action-authority" as const,
    }
    return p5HandoffPackageProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("p5-handoff-packages", currentRecordPattern, p5HandoffPackageSchema)
    for (const handoff of records) {
      try {
        if (handoff.membershipDigest !== canonicalDigest(membership(handoff))) {
          throw new Error("P5 Handoff Package membership digest is invalid")
        }
        const history = await this.listHistory(handoff.id)
        if (history.length !== handoff.revision || canonicalDigest(history[0]) !== canonicalDigest(handoff)) {
          throw new Error("Current P5 Handoff Package does not match its complete immutable history")
        }
        const status = await this.assess(handoff.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "p5-handoff-package.binding-review-required",
            severity: "warning",
            message: `Initiative ${handoff.initiativeId} has stale P5 Handoff Package bindings.`,
            record: { type: handoff.kind, id: handoff.id, revision: handoff.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "p5-handoff-package.invalid",
          severity: "error",
          message: `P5 Handoff Package ${handoff.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: handoff.kind, id: handoff.id, revision: handoff.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("P5 Handoff Package Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("P5 Handoff Package must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async validateBindings(input: P5HandoffPackageInput, product: Product, initiative: Initiative): Promise<void> {
    const [gate, readinessStatus] = await Promise.all([
      this.readinessGates.readCurrent(initiative.id),
      this.readinessGates.assess(initiative.id),
    ])
    if (!gate || !exactRecordMatches(input.readinessGate, gate)) {
      throw new Error("P5 Handoff Package must bind the exact current P0-P4 Readiness Gate candidate")
    }
    if (input.readinessStatusDigest !== p0P4ReadinessStatusDigest(readinessStatus) ||
        input.readinessResult !== readinessStatus.result) {
      throw new Error("P5 Handoff Package must bind the exact current stable readiness assessment and result")
    }
    if (this.itemBindingMismatchCount(input, gate) > 0) {
      throw new Error("P5 Handoff Package must preserve the exact readiness output applicability, subjects, and freshness")
    }
    if (product.id !== gate.productId || initiative.id !== gate.initiativeId) {
      throw new Error("P5 Handoff Package readiness bindings target a different Product or Initiative")
    }
  }

  private itemBindingMismatchCount(input: P5HandoffPackageInput, gate: P0P4ReadinessGate): number {
    const outputByKind = new Map(gate.outputs.map((output) => [output.outputKind, output]))
    let mismatches = 0
    for (const item of input.items) {
      const output = outputByKind.get(item.outputKind)
      if (!output || item.applicability !== output.applicability || item.freshness !== output.freshness ||
          canonicalDigest(item.subjects) !== canonicalDigest(output.subjects)) mismatches += 1
    }
    return mismatches + Math.max(0, gate.outputs.length - input.items.length)
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("P5 Handoff Source reference identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} P5 Handoff Package is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: P5HandoffPackage, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, p5HandoffPackageSchema),
        this.governed(this.historyPath(record.id, record.revision), record, p5HandoffPackageSchema),
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
          readinessGate: record.readinessGate,
          readinessStatusDigest: record.readinessStatusDigest,
          readinessResult: record.readinessResult,
          targetPhase: record.target.phase,
          targetCapability: record.target.capability,
          deliveryMode: record.target.deliveryMode,
          itemCount: record.items.length,
          includedItemCount: record.items.filter((entry) => entry.disposition === "included").length,
          referenceOnlyItemCount: record.items.filter((entry) => entry.disposition === "reference-only").length,
          omittedNotApplicableItemCount: record.items.filter((entry) => entry.disposition === "omitted-not-applicable").length,
          unresolvedItemCount: record.items.filter((entry) => entry.disposition === "unresolved").length,
          unresolvedRequirementCount: record.requirementCoverage.filter((entry) => entry.state === "unresolved").length,
          transferState: record.transferState,
          acknowledgementState: record.acknowledgementState,
          sourceOwnershipState: record.sourceOwnershipState,
          transferAuthorityState: record.transferAuthorityState,
          p5EntryAuthorityState: record.p5EntryAuthorityState,
          readinessAuthorityState: "not-established",
          designApprovalState: "not-established",
          designBaselineState: "not-established",
          writeAuthorityState: "not-granted",
          actionAuthorityState: "not-granted",
          handoffBoundary: "handoff-transfers-exact-candidate-context-not-source-ownership-or-authority",
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("p5-handoff-packages", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("p5-handoff-package-history", `p5-handoff-package-${id}-r${revision}.json`)
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
    if (names.length > handoffInventoryLimit) throw new Error(`P5 Handoff Package directory ${directory} exceeds the safety limit`)
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
