import { randomUUID } from "node:crypto"

import {
  designDeltaInputSchema,
  designDeltaProjectionSchema,
  designDeltaSchema,
  designDeltaStatusSchema,
  exactSourceReferenceSchema,
  type BusinessContextBinding,
  type DesignDelta,
  type DesignDeltaInput,
  type DesignDeltaProjection,
  type DesignDeltaStatus,
  type DesignToRequirementBinding,
  type DesignerReadyGate,
  type ExactSourceReference,
  type FinalizedFigmaSnapshotImport,
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
type CurrentDependencyService<T> = { readCurrent(initiativeId: string): Promise<T | undefined> }
export interface DesignDeltaDependencyServices {
  designerReadyGate: CurrentDependencyService<DesignerReadyGate>
  finalizedSnapshot: CurrentDependencyService<FinalizedFigmaSnapshotImport>
  designBinding: CurrentDependencyService<DesignToRequirementBinding>
}

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: DesignDelta) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function designerReadyGateReference(record: DesignerReadyGate): DesignDeltaInput["designerReadyGate"] {
  return {
    recordId: record.id,
    revision: record.revision,
    digest: canonicalDigest(record),
    membershipDigest: record.membershipDigest,
    prerequisiteCatalogDigest: canonicalDigest(record.prerequisites),
    assessmentReceiptDigest: record.assessmentReceiptDigest,
    candidateResult: record.candidateResult,
  }
}

function finalizedSnapshotReference(record: FinalizedFigmaSnapshotImport): DesignDeltaInput["finalizedSnapshot"] {
  return {
    recordId: record.id,
    revision: record.revision,
    digest: canonicalDigest(record),
    membershipDigest: record.membershipDigest,
    itemCatalogDigest: canonicalDigest(record.items),
    reconciliationDigest: record.reconciliationDigest,
    reviewState: record.reviewState,
  }
}

function designBindingReference(record: DesignToRequirementBinding): DesignDeltaInput["designBinding"] {
  return {
    recordId: record.id,
    revision: record.revision,
    digest: canonicalDigest(record),
    membershipDigest: record.membershipDigest,
    bindingCatalogDigest: canonicalDigest(record.bindings),
    reconciliationDigest: record.reconciliationDigest,
    reviewState: record.reviewState,
  }
}

function membership(input: DesignDeltaInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    objectiveDigest: input.objectiveDigest,
    designerReadyGate: input.designerReadyGate,
    finalizedSnapshot: input.finalizedSnapshot,
    designBinding: input.designBinding,
    sourceSnapshotDigest: input.sourceSnapshotDigest,
    targetSnapshotDigest: input.targetSnapshotDigest,
    comparisonDefinitionDigest: input.comparisonDefinitionDigest,
    comparisonReceiptDigest: input.comparisonReceiptDigest,
    sourceItemCount: input.sourceItemCount,
    targetItemCount: input.targetItemCount,
    deltas: input.deltas,
    comparisonState: input.comparisonState,
    provenanceState: input.provenanceState,
    candidateResult: input.candidateResult,
    unresolvedMappings: input.unresolvedMappings,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    deltaCompletenessState: input.deltaCompletenessState,
    externalCompletenessState: input.externalCompletenessState,
    designValidityState: input.designValidityState,
    designApprovalState: input.designApprovalState,
    designBaselineState: input.designBaselineState,
    readinessState: input.readinessState,
    conflictResolutionAuthorityState: input.conflictResolutionAuthorityState,
    synchronizationAuthorityState: input.synchronizationAuthorityState,
    figmaConnectionAuthorityState: input.figmaConnectionAuthorityState,
    credentialAuthorityState: input.credentialAuthorityState,
    permissionGrantState: input.permissionGrantState,
    importExecutionState: input.importExecutionState,
    writeExecutionState: input.writeExecutionState,
    implementationAuthorityState: input.implementationAuthorityState,
  }
}

export function designDeltaComparisonReceiptDigest(
  input: Pick<DesignDeltaInput,
    "comparisonDefinitionDigest" | "designerReadyGate" | "finalizedSnapshot" | "designBinding" |
    "sourceSnapshotDigest" | "targetSnapshotDigest" | "sourceItemCount" | "targetItemCount" | "deltas">,
): string {
  return canonicalDigest({
    comparisonDefinitionDigest: input.comparisonDefinitionDigest,
    designerReadyGate: input.designerReadyGate,
    finalizedSnapshot: input.finalizedSnapshot,
    designBinding: input.designBinding,
    sourceSnapshotDigest: input.sourceSnapshotDigest,
    targetSnapshotDigest: input.targetSnapshotDigest,
    sourceItemCount: input.sourceItemCount,
    targetItemCount: input.targetItemCount,
    deltas: input.deltas,
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

export class DesignDeltaService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly dependencies: DesignDeltaDependencyServices,
  ) {}

  async create(inputValue: DesignDeltaInput, actorId: string): Promise<DesignDelta> {
    const input = designDeltaInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.requireCurrentDependencies(input)
      await this.validateSourceReferences(input, initiative.id)
      this.validateComparisonReceipt(input)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Design Delta candidate")
      }
      const now = new Date().toISOString()
      const record = designDeltaSchema.parse({
        schemaVersion: 1,
        kind: "design-delta-candidate",
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
          "design-delta-is-a-review-candidate-and-does-not-establish-delta-completeness-external-completeness-design-validity-approval-baseline-readiness-conflict-resolution-synchronization-implementation-write-import-or-action-authority",
      })
      await this.commitVersionedRecord(record, "design-delta.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: DesignDeltaInput, actorId: string): Promise<DesignDelta> {
    const input = designDeltaInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Design Delta revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Design Delta Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.requireCurrentDependencies(input)
      await this.validateSourceReferences(input, initiative.id)
      this.validateComparisonReceipt(input)
      const record = designDeltaSchema.parse({
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
      await this.commitVersionedRecord(record, "design-delta.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<DesignDelta> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Design Delta ID")), designDeltaSchema)
  }

  async readCurrent(initiativeId: string): Promise<DesignDelta | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("design-deltas", currentRecordPattern, designDeltaSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Design Delta candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<DesignDelta> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Design Delta history revision must be a positive integer")
    const recordId = this.requireUuid(id, "Design Delta ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), designDeltaSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Design Delta history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<DesignDelta[]> {
    const recordId = this.requireUuid(id, "Design Delta ID")
    const records = await this.listRecords(
      "design-delta-history",
      new RegExp(`^design-delta-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      designDeltaSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Design Delta history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<DesignDeltaStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, currentSources, dependencyRecords] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
      this.readDependencyRecords(targetId),
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
      if (candidate.comparisonReceiptDigest !== designDeltaComparisonReceiptDigest(candidate)) staleBindingCount += 1
      if (!dependencyRecords.designerReadyGate ||
          canonicalDigest(candidate.designerReadyGate) !== canonicalDigest(designerReadyGateReference(dependencyRecords.designerReadyGate))) staleBindingCount += 1
      if (!dependencyRecords.finalizedSnapshot ||
          canonicalDigest(candidate.finalizedSnapshot) !== canonicalDigest(finalizedSnapshotReference(dependencyRecords.finalizedSnapshot))) staleBindingCount += 1
      if (!dependencyRecords.designBinding ||
          canonicalDigest(candidate.designBinding) !== canonicalDigest(designBindingReference(dependencyRecords.designBinding))) staleBindingCount += 1
      if (!dependencyRecords.designerReadyGate ||
          candidate.sourceSnapshotDigest !== canonicalDigest(dependencyRecords.designerReadyGate.prerequisites)) staleBindingCount += 1
      if (!dependencyRecords.finalizedSnapshot ||
          candidate.targetSnapshotDigest !== canonicalDigest(dependencyRecords.finalizedSnapshot.items)) staleBindingCount += 1
    }
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(candidate).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const deltas = candidate?.deltas ?? []
    const count = (kind: DesignDeltaInput["deltas"][number]["changeKind"]) =>
      deltas.filter((entry) => entry.changeKind === kind).length
    const assessedAt = new Date().toISOString()
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Design Delta candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The Design Delta does not bind exact current dependencies or comparison receipts")
    if (staleSourceReferenceCount > 0) reasons.push("One or more Design Delta entries reference a superseded Source revision")
    if (candidate && candidate.comparisonState !== "exact") reasons.push("The Design Delta comparison is partial or not assessed")
    if (candidate && candidate.provenanceState !== "exact") reasons.push("The Design Delta provenance is partial or not assessed")
    if (deltas.some((entry) => entry.freshness !== "current")) reasons.push("One or more Design Delta entries are stale or have unknown freshness")
    if (deltas.some((entry) => entry.evidenceState === "not-assessed")) reasons.push("One or more Design Delta entries lack source-backed evidence state")
    if ((candidate?.unresolvedMappings.length ?? 0) > 0) reasons.push("The Design Delta records unresolved mappings")
    if ((candidate?.unresolvedQuestions.length ?? 0) > 0) reasons.push("The Design Delta records unresolved questions")
    if (candidate && ["blocked", "incomplete"].includes(candidate.candidateResult)) reasons.push("The Design Delta candidate is blocked or incomplete")
    if (candidate && candidate.reviewState !== "ready-for-human-review") reasons.push("The Design Delta is not ready for accountable human review")
    return designDeltaStatusSchema.parse({
      schemaVersion: 1,
      kind: "design-delta-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      sourceItemCount: candidate?.sourceItemCount ?? 0,
      targetItemCount: candidate?.targetItemCount ?? 0,
      deltaCount: deltas.length,
      addedCount: count("added"),
      changedCount: count("changed"),
      conflictingCount: count("conflicting"),
      missingCount: count("missing"),
      staleCount: count("stale"),
      unmappedCount: count("unmapped"),
      humanReviewedCount: deltas.filter((entry) => entry.evidenceState === "human-reviewed").length,
      staleBindingCount,
      staleSourceReferenceCount,
      unresolvedMappingCount: candidate?.unresolvedMappings.length ?? 0,
      unresolvedQuestionCount: candidate?.unresolvedQuestions.length ?? 0,
      comparisonState: candidate?.comparisonState ?? "not-assessed",
      provenanceState: candidate?.provenanceState ?? "not-assessed",
      candidateResult: candidate?.candidateResult ?? "not-assessed",
      reviewState: candidate?.reviewState ?? "draft",
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt,
      authorityBoundary:
        "design-delta-status-is-observational-and-does-not-establish-delta-completeness-external-completeness-design-validity-approval-baseline-readiness-conflict-resolution-synchronization-implementation-write-import-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<DesignDeltaProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Design Delta projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "design-delta-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        state: candidate.state,
        designerReadyGate: candidate.designerReadyGate,
        finalizedSnapshot: candidate.finalizedSnapshot,
        designBinding: candidate.designBinding,
        sourceSnapshotDigest: candidate.sourceSnapshotDigest,
        targetSnapshotDigest: candidate.targetSnapshotDigest,
        comparisonDefinitionDigest: candidate.comparisonDefinitionDigest,
        comparisonReceiptDigest: candidate.comparisonReceiptDigest,
        deltaCatalogDigest: canonicalDigest(candidate.deltas),
        deltaCount: candidate.deltas.length,
        comparisonState: candidate.comparisonState,
        provenanceState: candidate.provenanceState,
        candidateResult: candidate.candidateResult,
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-delta-content-external-identities-evidence-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions" as const,
      authorityBoundary:
        "design-delta-projection-is-read-only-and-does-not-establish-delta-completeness-external-completeness-design-validity-approval-baseline-readiness-conflict-resolution-synchronization-implementation-write-import-or-action-authority" as const,
    }
    return designDeltaProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("design-deltas", currentRecordPattern, designDeltaSchema)
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) throw new Error("Design Delta membership digest is invalid")
        if (candidate.comparisonReceiptDigest !== designDeltaComparisonReceiptDigest(candidate)) throw new Error("Design Delta comparison receipt digest is invalid")
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Design Delta candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "design-delta.review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale Design Delta evidence.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "design-delta.invalid",
          severity: "error",
          message: `Design Delta ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Design Delta Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Design Delta candidate must bind exact current Product and Initiative revisions and digests")
    }
  }

  private async readDependencyRecords(initiativeId: string): Promise<{
    designerReadyGate: DesignerReadyGate | undefined
    finalizedSnapshot: FinalizedFigmaSnapshotImport | undefined
    designBinding: DesignToRequirementBinding | undefined
  }> {
    const [designerReadyGate, finalizedSnapshot, designBinding] = await Promise.all([
      this.dependencies.designerReadyGate.readCurrent(initiativeId),
      this.dependencies.finalizedSnapshot.readCurrent(initiativeId),
      this.dependencies.designBinding.readCurrent(initiativeId),
    ])
    return { designerReadyGate, finalizedSnapshot, designBinding }
  }

  private async requireCurrentDependencies(input: DesignDeltaInput): Promise<void> {
    const dependencies = await this.readDependencyRecords(input.initiativeId)
    if (!dependencies.designerReadyGate ||
        canonicalDigest(input.designerReadyGate) !== canonicalDigest(designerReadyGateReference(dependencies.designerReadyGate))) {
      throw new Error("Design Delta requires the exact current Designer-Ready Gate candidate")
    }
    if (!dependencies.finalizedSnapshot ||
        canonicalDigest(input.finalizedSnapshot) !== canonicalDigest(finalizedSnapshotReference(dependencies.finalizedSnapshot))) {
      throw new Error("Design Delta requires the exact current Finalized Figma Snapshot Import candidate")
    }
    if (!dependencies.designBinding ||
        canonicalDigest(input.designBinding) !== canonicalDigest(designBindingReference(dependencies.designBinding))) {
      throw new Error("Design Delta requires the exact current Design-to-Requirement Binding candidate")
    }
    if (input.sourceSnapshotDigest !== canonicalDigest(dependencies.designerReadyGate.prerequisites)) {
      throw new Error("Design Delta source snapshot digest must bind the exact current governed prerequisite catalog")
    }
    if (input.targetSnapshotDigest !== canonicalDigest(dependencies.finalizedSnapshot.items)) {
      throw new Error("Design Delta target snapshot digest must bind the exact current finalized item catalog")
    }
  }

  private validateComparisonReceipt(input: DesignDeltaInput): void {
    if (input.comparisonReceiptDigest !== designDeltaComparisonReceiptDigest(input)) {
      throw new Error("Design Delta comparison receipt must bind exact dependencies, snapshots, counts, definition, and delta catalog")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Design Delta Source identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Design Delta is immutable`)
    return { product, initiative }
  }

  private async commitVersionedRecord(record: DesignDelta, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, designDeltaSchema),
        this.governed(this.historyPath(record.id, record.revision), record, designDeltaSchema),
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
          designerReadyGate: record.designerReadyGate,
          finalizedSnapshot: record.finalizedSnapshot,
          designBinding: record.designBinding,
          sourceSnapshotDigest: record.sourceSnapshotDigest,
          targetSnapshotDigest: record.targetSnapshotDigest,
          comparisonDefinitionDigest: record.comparisonDefinitionDigest,
          comparisonReceiptDigest: record.comparisonReceiptDigest,
          sourceItemCount: record.sourceItemCount,
          targetItemCount: record.targetItemCount,
          deltaCount: record.deltas.length,
          deltaCatalogDigest: canonicalDigest(record.deltas.map((entry) => ({
            key: entry.key,
            subjectKind: entry.subjectKind,
            subjectKey: entry.subjectKey,
            changeKind: entry.changeKind,
            sourceDigest: entry.sourceDigest,
            targetDigest: entry.targetDigest,
            freshness: entry.freshness,
            impactState: entry.impactState,
            evidenceState: entry.evidenceState,
          }))),
          comparisonState: record.comparisonState,
          provenanceState: record.provenanceState,
          candidateResult: record.candidateResult,
          unresolvedMappingCount: record.unresolvedMappings.length,
          unresolvedQuestionCount: record.unresolvedQuestions.length,
          reviewState: record.reviewState,
          deltaCompletenessState: record.deltaCompletenessState,
          externalCompletenessState: record.externalCompletenessState,
          designValidityState: record.designValidityState,
          designApprovalState: record.designApprovalState,
          designBaselineState: record.designBaselineState,
          readinessState: record.readinessState,
          conflictResolutionAuthorityState: record.conflictResolutionAuthorityState,
          synchronizationAuthorityState: record.synchronizationAuthorityState,
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
    return this.repository.resolve("design-deltas", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("design-delta-history", `design-delta-${id}-r${revision}.json`)
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
    if (names.length > inventoryLimit) throw new Error(`Design Delta directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
