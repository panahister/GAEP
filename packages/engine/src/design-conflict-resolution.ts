import { randomUUID } from "node:crypto"

import {
  designConflictResolutionInputSchema,
  designConflictResolutionProjectionSchema,
  designConflictResolutionSchema,
  designConflictResolutionStatusSchema,
  exactSourceReferenceSchema,
  type BusinessContextBinding,
  type DesignConflictResolution,
  type DesignConflictResolutionInput,
  type DesignConflictResolutionProjection,
  type DesignConflictResolutionStatus,
  type DesignDelta,
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
type CurrentDesignDeltaService = { readCurrent(initiativeId: string): Promise<DesignDelta | undefined> }

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: DesignConflictResolution) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

export function designDeltaResolutionReference(record: DesignDelta): DesignConflictResolutionInput["designDelta"] {
  return {
    recordId: record.id,
    revision: record.revision,
    digest: canonicalDigest(record),
    membershipDigest: record.membershipDigest,
    deltaCatalogDigest: canonicalDigest(record.deltas),
    comparisonReceiptDigest: record.comparisonReceiptDigest,
    conflictingCount: record.deltas.filter((entry) => entry.changeKind === "conflicting").length,
    candidateResult: record.candidateResult,
    reviewState: record.reviewState,
  }
}

function membership(input: DesignConflictResolutionInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    objectiveDigest: input.objectiveDigest,
    designDelta: input.designDelta,
    resolutionDefinitionDigest: input.resolutionDefinitionDigest,
    resolutionReceiptDigest: input.resolutionReceiptDigest,
    conflictCount: input.conflictCount,
    resolutions: input.resolutions,
    coverageState: input.coverageState,
    provenanceState: input.provenanceState,
    candidateResult: input.candidateResult,
    unresolvedConflictKeys: input.unresolvedConflictKeys,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    separationOfDutiesEnforcementState: input.separationOfDutiesEnforcementState,
    conflictResolutionAuthorityState: input.conflictResolutionAuthorityState,
    synchronizationAuthorityState: input.synchronizationAuthorityState,
    designValidityState: input.designValidityState,
    designApprovalState: input.designApprovalState,
    designBaselineState: input.designBaselineState,
    readinessState: input.readinessState,
    figmaConnectionAuthorityState: input.figmaConnectionAuthorityState,
    credentialAuthorityState: input.credentialAuthorityState,
    permissionGrantState: input.permissionGrantState,
    importExecutionState: input.importExecutionState,
    writeExecutionState: input.writeExecutionState,
    implementationAuthorityState: input.implementationAuthorityState,
  }
}

export function designConflictResolutionReceiptDigest(
  input: Pick<DesignConflictResolutionInput,
    "resolutionDefinitionDigest" | "designDelta" | "conflictCount" | "resolutions">,
): string {
  return canonicalDigest({
    resolutionDefinitionDigest: input.resolutionDefinitionDigest,
    designDelta: input.designDelta,
    conflictCount: input.conflictCount,
    resolutions: input.resolutions,
  })
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

export class DesignConflictResolutionService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly designDelta: CurrentDesignDeltaService,
  ) {}

  async create(inputValue: DesignConflictResolutionInput, actorId: string): Promise<DesignConflictResolution> {
    const input = designConflictResolutionInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependency = await this.requireCurrentDesignDelta(input)
      this.validateConflictCoverage(input, dependency)
      await this.validateSourceReferences(input, initiative.id)
      this.validateResolutionReceipt(input)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Design Conflict Resolution candidate")
      }
      const now = new Date().toISOString()
      const record = designConflictResolutionSchema.parse({
        schemaVersion: 1,
        kind: "design-conflict-resolution-candidate",
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
          "design-conflict-resolution-is-a-review-candidate-and-does-not-enforce-separation-of-duties-resolve-conflicts-synchronize-design-establish-validity-approval-baseline-readiness-or-grant-implementation-write-import-or-action-authority",
      })
      await this.commitVersionedRecord(record, "design-conflict-resolution.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: DesignConflictResolutionInput,
    actorId: string,
  ): Promise<DesignConflictResolution> {
    const input = designConflictResolutionInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Design Conflict Resolution revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Design Conflict Resolution Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependency = await this.requireCurrentDesignDelta(input)
      this.validateConflictCoverage(input, dependency)
      await this.validateSourceReferences(input, initiative.id)
      this.validateResolutionReceipt(input)
      const record = designConflictResolutionSchema.parse({
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
      await this.commitVersionedRecord(record, "design-conflict-resolution.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<DesignConflictResolution> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Design Conflict Resolution ID")),
      designConflictResolutionSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<DesignConflictResolution | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("design-conflict-resolutions", currentRecordPattern, designConflictResolutionSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Design Conflict Resolution candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<DesignConflictResolution> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Design Conflict Resolution history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Design Conflict Resolution ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), designConflictResolutionSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Design Conflict Resolution history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<DesignConflictResolution[]> {
    const recordId = this.requireUuid(id, "Design Conflict Resolution ID")
    const records = await this.listRecords(
      "design-conflict-resolution-history",
      new RegExp(`^design-conflict-resolution-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      designConflictResolutionSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Design Conflict Resolution history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<DesignConflictResolutionStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, currentSources, dependency] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
      this.designDelta.readCurrent(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    let staleBindingCount = 0
    if (candidate) {
      const expectedContext = {
        productRevision: revisionOf(product), productDigest: canonicalDigest(product),
        initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
      }
      if (canonicalDigest(candidate.context) !== canonicalDigest(expectedContext)) staleBindingCount += 1
      if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) staleBindingCount += 1
      if (candidate.resolutionReceiptDigest !== designConflictResolutionReceiptDigest(candidate)) staleBindingCount += 1
      if (!dependency || canonicalDigest(candidate.designDelta) !== canonicalDigest(designDeltaResolutionReference(dependency))) {
        staleBindingCount += 1
      }
      if (dependency) {
        try {
          this.validateConflictCoverage(candidate, dependency)
        } catch {
          staleBindingCount += 1
        }
      }
    }
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(candidate).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const resolutions = candidate?.resolutions ?? []
    const count = (kind: DesignConflictResolutionInput["resolutions"][number]["resolutionKind"]) =>
      resolutions.filter((entry) => entry.resolutionKind === kind).length
    const assessedAt = new Date().toISOString()
    const expiredCandidateCount = resolutions.filter((entry) => entry.validUntil <= assessedAt).length
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Design Conflict Resolution candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The Design Conflict Resolution does not bind exact current dependencies or receipts")
    if (staleSourceReferenceCount > 0) reasons.push("One or more resolution candidates reference a superseded Source revision")
    if (candidate && candidate.coverageState !== "candidate-complete") reasons.push("Conflict resolution candidate coverage is partial or not assessed")
    if (candidate && candidate.provenanceState !== "exact") reasons.push("Conflict resolution provenance is partial or not assessed")
    if (resolutions.some((entry) => entry.decisionState !== "human-reviewed")) reasons.push("One or more conflict resolution candidates lack accountable human review")
    if (expiredCandidateCount > 0) reasons.push("One or more conflict resolution candidates are expired")
    if ((candidate?.unresolvedConflictKeys.length ?? 0) > 0) reasons.push("The candidate records unresolved design conflicts")
    if ((candidate?.unresolvedQuestions.length ?? 0) > 0) reasons.push("The candidate records unresolved questions")
    if (candidate && ["blocked", "incomplete"].includes(candidate.candidateResult)) reasons.push("The conflict resolution candidate is blocked or incomplete")
    if (candidate && candidate.reviewState !== "ready-for-human-review") reasons.push("The conflict resolution candidate is not ready for accountable human review")
    return designConflictResolutionStatusSchema.parse({
      schemaVersion: 1,
      kind: "design-conflict-resolution-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      conflictCount: candidate?.conflictCount ?? 0,
      resolutionCount: resolutions.length,
      acceptSourceCount: count("accept-source-candidate"),
      acceptTargetCount: count("accept-target-candidate"),
      mergeCount: count("merge-candidate"),
      rejectChangeCount: count("reject-change-candidate"),
      escalateCount: count("escalate-candidate"),
      humanReviewedCount: resolutions.filter((entry) => entry.decisionState === "human-reviewed").length,
      distinctActorDeclaredCount: resolutions.filter((entry) => entry.separationOfDutiesState === "distinct-actor-declared").length,
      expiredCandidateCount,
      unresolvedConflictCount: candidate?.unresolvedConflictKeys.length ?? 0,
      unresolvedQuestionCount: candidate?.unresolvedQuestions.length ?? 0,
      staleBindingCount,
      staleSourceReferenceCount,
      coverageState: candidate?.coverageState ?? "not-assessed",
      provenanceState: candidate?.provenanceState ?? "not-assessed",
      candidateResult: candidate?.candidateResult ?? "not-assessed",
      reviewState: candidate?.reviewState ?? "draft",
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt,
      authorityBoundary:
        "design-conflict-resolution-status-is-observational-and-does-not-enforce-separation-of-duties-resolve-conflicts-synchronize-design-establish-validity-approval-baseline-readiness-or-grant-implementation-write-import-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<DesignConflictResolutionProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Design Conflict Resolution projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "design-conflict-resolution-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        state: candidate.state,
        designDelta: candidate.designDelta,
        resolutionDefinitionDigest: candidate.resolutionDefinitionDigest,
        resolutionReceiptDigest: candidate.resolutionReceiptDigest,
        resolutionCatalogDigest: canonicalDigest(candidate.resolutions),
        conflictCount: candidate.conflictCount,
        resolutionCount: candidate.resolutions.length,
        coverageState: candidate.coverageState,
        provenanceState: candidate.provenanceState,
        candidateResult: candidate.candidateResult,
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-delta-content-resolution-content-evidence-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions" as const,
      authorityBoundary:
        "design-conflict-resolution-projection-is-read-only-and-does-not-enforce-separation-of-duties-resolve-conflicts-synchronize-design-establish-validity-approval-baseline-readiness-or-grant-implementation-write-import-or-action-authority" as const,
    }
    return designConflictResolutionProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords(
      "design-conflict-resolutions",
      currentRecordPattern,
      designConflictResolutionSchema,
    )
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) {
          throw new Error("Design Conflict Resolution membership digest is invalid")
        }
        if (candidate.resolutionReceiptDigest !== designConflictResolutionReceiptDigest(candidate)) {
          throw new Error("Design Conflict Resolution receipt digest is invalid")
        }
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Design Conflict Resolution candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0 || status.expiredCandidateCount > 0) {
          issues.push({
            code: "design-conflict-resolution.review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale or expired Design Conflict Resolution evidence.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "design-conflict-resolution.invalid",
          severity: "error",
          message: `Design Conflict Resolution ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Design Conflict Resolution Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Design Conflict Resolution candidate must bind exact current Product and Initiative revisions and digests")
    }
  }

  private async requireCurrentDesignDelta(input: DesignConflictResolutionInput): Promise<DesignDelta> {
    const current = await this.designDelta.readCurrent(input.initiativeId)
    if (!current || canonicalDigest(input.designDelta) !== canonicalDigest(designDeltaResolutionReference(current))) {
      throw new Error("Design Conflict Resolution requires the exact current Design Delta candidate")
    }
    return current
  }

  private validateConflictCoverage(input: DesignConflictResolutionInput, designDelta: DesignDelta): void {
    const conflicts = designDelta.deltas.filter((entry) => entry.changeKind === "conflicting")
    const byKey = new Map(conflicts.map((entry) => [entry.key, entry]))
    if (input.conflictCount !== conflicts.length) {
      throw new Error("Design Conflict Resolution conflict count must match the exact current Design Delta conflict catalog")
    }
    for (const resolution of input.resolutions) {
      const conflict = byKey.get(resolution.conflictKey)
      if (!conflict || conflict.subjectKind !== resolution.subjectKind ||
          canonicalDigest(conflict) !== resolution.conflictDigest) {
        throw new Error("Each resolution candidate must bind one exact conflicting Design Delta entry")
      }
    }
    for (const key of input.unresolvedConflictKeys) {
      if (!byKey.has(key)) throw new Error("Every unresolved conflict key must identify an exact conflicting Design Delta entry")
    }
  }

  private validateResolutionReceipt(input: DesignConflictResolutionInput): void {
    if (input.resolutionReceiptDigest !== designConflictResolutionReceiptDigest(input)) {
      throw new Error("Design Conflict Resolution receipt must bind the exact definition, Design Delta, conflict count, and candidate catalog")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Design Conflict Resolution Source identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Design Conflict Resolution is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(
    record: DesignConflictResolution,
    eventType: string,
    actorId: string,
  ): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, designConflictResolutionSchema),
        this.governed(this.historyPath(record.id, record.revision), record, designConflictResolutionSchema),
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
          objectiveDigest: record.objectiveDigest,
          designDelta: record.designDelta,
          resolutionDefinitionDigest: record.resolutionDefinitionDigest,
          resolutionReceiptDigest: record.resolutionReceiptDigest,
          conflictCount: record.conflictCount,
          resolutionCount: record.resolutions.length,
          resolutionCatalogDigest: canonicalDigest(record.resolutions.map((entry) => ({
            key: entry.key,
            conflictKey: entry.conflictKey,
            conflictDigest: entry.conflictDigest,
            subjectKind: entry.subjectKind,
            resolutionKind: entry.resolutionKind,
            decisionDigest: entry.decisionDigest,
            scope: entry.scope,
            decisionState: entry.decisionState,
            evidenceDigests: entry.evidenceDigests,
            proposedAt: entry.proposedAt,
            reviewedAt: entry.reviewedAt,
            validUntil: entry.validUntil,
            separationOfDutiesState: entry.separationOfDutiesState,
            effectState: entry.effectState,
          }))),
          coverageState: record.coverageState,
          provenanceState: record.provenanceState,
          candidateResult: record.candidateResult,
          unresolvedConflictCount: record.unresolvedConflictKeys.length,
          unresolvedQuestionCount: record.unresolvedQuestions.length,
          reviewState: record.reviewState,
          separationOfDutiesEnforcementState: record.separationOfDutiesEnforcementState,
          conflictResolutionAuthorityState: record.conflictResolutionAuthorityState,
          synchronizationAuthorityState: record.synchronizationAuthorityState,
          designValidityState: record.designValidityState,
          designApprovalState: record.designApprovalState,
          designBaselineState: record.designBaselineState,
          readinessState: record.readinessState,
          figmaConnectionAuthorityState: record.figmaConnectionAuthorityState,
          credentialAuthorityState: record.credentialAuthorityState,
          permissionGrantState: record.permissionGrantState,
          importExecutionState: record.importExecutionState,
          writeExecutionState: record.writeExecutionState,
          implementationAuthorityState: record.implementationAuthorityState,
          actionAuthorityState: "not-granted",
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("design-conflict-resolutions", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve(
      "design-conflict-resolution-history",
      `design-conflict-resolution-${id}-r${revision}.json`,
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
    if (names.length > inventoryLimit) throw new Error(`Design Conflict Resolution directory ${directory} exceeds the safety limit`)
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
