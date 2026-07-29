import { randomUUID } from "node:crypto"

import {
  exactSourceReferenceSchema,
  finalizedFigmaSnapshotImportInputSchema,
  finalizedFigmaSnapshotImportProjectionSchema,
  finalizedFigmaSnapshotImportSchema,
  finalizedFigmaSnapshotImportStatusSchema,
  type BusinessContextBinding,
  type ExactSourceReference,
  type FinalizedFigmaSnapshotImport,
  type FinalizedFigmaSnapshotImportInput,
  type FinalizedFigmaSnapshotImportProjection,
  type FinalizedFigmaSnapshotImportStatus,
  type GovernedFigmaWrite,
  type Initiative,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { GovernedFigmaWriteService } from "./governed-figma-write.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: FinalizedFigmaSnapshotImport) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: FinalizedFigmaSnapshotImportInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    objectiveDigest: input.objectiveDigest,
    governedWrite: input.governedWrite,
    returnReceipt: input.returnReceipt,
    returnAuthorization: input.returnAuthorization,
    items: input.items,
    conflicts: input.conflicts,
    reconciliationDigest: input.reconciliationDigest,
    reconciliationState: input.reconciliationState,
    provenanceState: input.provenanceState,
    snapshotCompletenessState: input.snapshotCompletenessState,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    inboundTransferState: input.inboundTransferState,
    importExecutionState: input.importExecutionState,
    importResultState: input.importResultState,
    figmaConnectionAuthorityState: input.figmaConnectionAuthorityState,
    credentialAuthorityState: input.credentialAuthorityState,
    permissionGrantState: input.permissionGrantState,
    externalCompletenessState: input.externalCompletenessState,
    targetValidityState: input.targetValidityState,
    designValidityState: input.designValidityState,
    designApprovalState: input.designApprovalState,
    designBaselineState: input.designBaselineState,
    readinessState: input.readinessState,
    implementationAuthorityState: input.implementationAuthorityState,
  }
}

function payloadReceipt(input: FinalizedFigmaSnapshotImportInput) {
  return {
    governedWrite: input.governedWrite,
    externalFileIdentityDigest: input.returnReceipt.externalFileIdentityDigest,
    returnedExternalVersionDigest: input.returnReceipt.returnedExternalVersionDigest,
    items: input.items,
  }
}

function returnReceipt(input: FinalizedFigmaSnapshotImportInput) {
  return {
    mode: input.returnReceipt.mode,
    externalFileIdentityDigest: input.returnReceipt.externalFileIdentityDigest,
    returnedExternalVersionDigest: input.returnReceipt.returnedExternalVersionDigest,
    payloadDigest: input.returnReceipt.payloadDigest,
    capturedAt: input.returnReceipt.capturedAt,
    evidenceState: input.returnReceipt.evidenceState,
    evidenceDigests: input.returnReceipt.evidenceDigests,
    sources: input.returnReceipt.sources,
  }
}

function reconciliationReceipt(input: FinalizedFigmaSnapshotImportInput) {
  return {
    governedWrite: input.governedWrite,
    returnReceipt: {
      externalFileIdentityDigest: input.returnReceipt.externalFileIdentityDigest,
      returnedExternalVersionDigest: input.returnReceipt.returnedExternalVersionDigest,
      payloadDigest: input.returnReceipt.payloadDigest,
      receiptDigest: input.returnReceipt.receiptDigest,
    },
    itemCatalogDigest: canonicalDigest(input.items),
    conflictCatalogDigest: canonicalDigest(input.conflicts),
  }
}

function authorizationScopeReceipt(input: FinalizedFigmaSnapshotImportInput) {
  return {
    governedWrite: input.governedWrite,
    returnReceiptDigest: input.returnReceipt.receiptDigest,
    reconciliationDigest: input.reconciliationDigest,
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

export class FinalizedFigmaSnapshotImportService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly governedFigmaWrite: GovernedFigmaWriteService,
  ) {}

  async create(inputValue: FinalizedFigmaSnapshotImportInput, actorId: string): Promise<FinalizedFigmaSnapshotImport> {
    const input = finalizedFigmaSnapshotImportInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.requireCurrentGovernedWrite(input)
      this.validateReceipts(input)
      await this.validateSourceReferences(input, initiative.id)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Finalized Figma Snapshot Import candidate")
      }
      const now = new Date().toISOString()
      const record = finalizedFigmaSnapshotImportSchema.parse({
        schemaVersion: 1,
        kind: "finalized-figma-snapshot-import-candidate",
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
          "finalized-figma-snapshot-import-is-a-review-candidate-and-does-not-transfer-or-import-content-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-validate-or-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
      })
      await this.commitVersionedRecord(record, "finalized-figma-snapshot-import.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: FinalizedFigmaSnapshotImportInput,
    actorId: string,
  ): Promise<FinalizedFigmaSnapshotImport> {
    const input = finalizedFigmaSnapshotImportInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Finalized Figma Snapshot Import revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Finalized Figma Snapshot Import Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.requireCurrentGovernedWrite(input)
      this.validateReceipts(input)
      await this.validateSourceReferences(input, initiative.id)
      const record = finalizedFigmaSnapshotImportSchema.parse({
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
      await this.commitVersionedRecord(record, "finalized-figma-snapshot-import.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<FinalizedFigmaSnapshotImport> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Finalized Figma Snapshot Import ID")),
      finalizedFigmaSnapshotImportSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<FinalizedFigmaSnapshotImport | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords(
      "finalized-figma-snapshot-imports",
      currentRecordPattern,
      finalizedFigmaSnapshotImportSchema,
    )
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Finalized Figma Snapshot Import candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<FinalizedFigmaSnapshotImport> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Finalized Figma Snapshot Import history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Finalized Figma Snapshot Import ID")
    const record = await this.repository.readJson(
      this.historyPath(recordId, revision),
      finalizedFigmaSnapshotImportSchema,
    )
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Finalized Figma Snapshot Import history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<FinalizedFigmaSnapshotImport[]> {
    const recordId = this.requireUuid(id, "Finalized Figma Snapshot Import ID")
    const records = await this.listRecords(
      "finalized-figma-snapshot-import-history",
      new RegExp(`^finalized-figma-snapshot-import-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      finalizedFigmaSnapshotImportSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Finalized Figma Snapshot Import history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<FinalizedFigmaSnapshotImportStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, currentSources, governedWrite] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
      this.governedFigmaWrite.readCurrent(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    let staleBindingCount = candidate ? this.bindingMismatchCount(candidate, product, initiative, governedWrite) : 0
    if (candidate && governedWrite && staleBindingCount === 0) {
      try {
        this.validateReceipts(candidate)
      } catch {
        staleBindingCount += 1
      }
    }
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(candidate).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const itemCount = candidate?.items.length ?? 0
    const humanReviewedItemCount = candidate?.items.filter((entry) => entry.evidenceState === "human-reviewed").length ?? 0
    const sourceRecordedItemCount = candidate?.items.filter((entry) => entry.evidenceState === "source-recorded").length ?? 0
    const notAssessedItemCount = candidate?.items.filter((entry) => entry.evidenceState === "not-assessed").length ?? 0
    const openConflictCount = candidate?.conflicts.filter((entry) => entry.state === "open").length ?? 0
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const returnAuthorizationState = candidate?.returnAuthorization.state ?? "not-assessed"
    const reconciliationState = candidate?.reconciliationState ?? "not-assessed"
    const provenanceState = candidate?.provenanceState ?? "not-assessed"
    const snapshotCompletenessState = candidate?.snapshotCompletenessState ?? "not-assessed"
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Finalized Figma Snapshot Import candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind the exact current Governed Figma Write or return receipt")
    if (staleSourceReferenceCount > 0) reasons.push("One or more finalized-snapshot fields reference a superseded Source revision")
    if (candidate && itemCount === 0) reasons.push("The finalized snapshot contains no items")
    if (sourceRecordedItemCount > 0) reasons.push("One or more finalized-snapshot items have only source-recorded evidence")
    if (notAssessedItemCount > 0) reasons.push("One or more finalized-snapshot items are not assessed")
    if (openConflictCount > 0) reasons.push("One or more finalized-snapshot conflicts remain open")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved finalized-snapshot questions")
    if (candidate && returnAuthorizationState !== "verified") reasons.push("Exact return authorization is not verified")
    if (candidate && reconciliationState !== "exact") reasons.push("Finalized-snapshot reconciliation is not exact")
    if (candidate && provenanceState !== "exact") reasons.push("Finalized-snapshot provenance is not exact")
    if (candidate && snapshotCompletenessState !== "candidate-complete") reasons.push("The finalized snapshot is not candidate-complete")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return finalizedFigmaSnapshotImportStatusSchema.parse({
      schemaVersion: 1,
      kind: "finalized-figma-snapshot-import-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      itemCount,
      humanReviewedItemCount,
      sourceRecordedItemCount,
      notAssessedItemCount,
      openConflictCount,
      staleBindingCount,
      staleSourceReferenceCount,
      unresolvedQuestionCount,
      returnAuthorizationState,
      reconciliationState,
      provenanceState,
      snapshotCompletenessState,
      reviewState,
      importExecutionState: "not-performed",
      importResultState: "not-recorded",
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "finalized-figma-snapshot-import-status-is-observational-and-does-not-transfer-or-import-content-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-validate-or-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<FinalizedFigmaSnapshotImportProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Finalized Figma Snapshot Import projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "finalized-figma-snapshot-import-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        state: candidate.state,
        governedWrite: candidate.governedWrite,
        externalFileIdentityDigest: candidate.returnReceipt.externalFileIdentityDigest,
        returnedExternalVersionDigest: candidate.returnReceipt.returnedExternalVersionDigest,
        payloadDigest: candidate.returnReceipt.payloadDigest,
        receiptDigest: candidate.returnReceipt.receiptDigest,
        reconciliationDigest: candidate.reconciliationDigest,
        itemCount: candidate.items.length,
        conflictCount: candidate.conflicts.length,
        returnAuthorizationState: candidate.returnAuthorization.state,
        reconciliationState: candidate.reconciliationState,
        provenanceState: candidate.provenanceState,
        reviewState: candidate.reviewState,
        importExecutionState: candidate.importExecutionState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-figma-content-names-external-identities-source-content-authorization-actor-personal-content-secrets-credentials-or-permissions" as const,
      authorityBoundary:
        "finalized-figma-snapshot-import-projection-is-read-only-and-does-not-transfer-or-import-content-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-validate-or-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority" as const,
    }
    return finalizedFigmaSnapshotImportProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords(
      "finalized-figma-snapshot-imports",
      currentRecordPattern,
      finalizedFigmaSnapshotImportSchema,
    )
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) {
          throw new Error("Finalized Figma Snapshot Import membership digest is invalid")
        }
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Finalized Figma Snapshot Import candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "finalized-figma-snapshot-import.binding-review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale Finalized Figma Snapshot Import bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "finalized-figma-snapshot-import.invalid",
          severity: "error",
          message: `Finalized Figma Snapshot Import ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Finalized Figma Snapshot Import Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Finalized Figma Snapshot Import candidate must bind exact current Product and Initiative revisions and digests")
    }
  }

  private async requireCurrentGovernedWrite(input: FinalizedFigmaSnapshotImportInput): Promise<GovernedFigmaWrite> {
    const candidate = await this.governedFigmaWrite.readCurrent(input.initiativeId)
    if (!candidate || input.governedWrite.recordId !== candidate.id ||
        input.governedWrite.revision !== candidate.revision ||
        input.governedWrite.digest !== canonicalDigest(candidate) ||
        input.governedWrite.membershipDigest !== candidate.membershipDigest ||
        input.governedWrite.requestDigest !== candidate.requestDigest ||
        input.governedWrite.effectDigest !== candidate.effectDigest ||
        input.governedWrite.externalFileIdentityDigest !== candidate.target.externalFileIdentityDigest ||
        input.governedWrite.expectedExternalVersionDigest !== candidate.target.expectedExternalVersionDigest) {
      throw new Error("Finalized Figma Snapshot Import must bind the exact current Governed Figma Write identity, revision, record, membership, request, effect, file, and expected-version digests")
    }
    return candidate
  }

  private validateReceipts(input: FinalizedFigmaSnapshotImportInput): void {
    if (input.returnReceipt.payloadDigest !== canonicalDigest(payloadReceipt(input))) {
      throw new Error("Finalized Figma Snapshot Import payload digest must bind the exact governed write, returned version, and item catalog")
    }
    if (input.returnReceipt.receiptDigest !== canonicalDigest(returnReceipt(input))) {
      throw new Error("Finalized Figma Snapshot Import receipt digest must bind the exact attributable return receipt")
    }
    if (input.reconciliationDigest !== canonicalDigest(reconciliationReceipt(input))) {
      throw new Error("Finalized Figma Snapshot Import reconciliation digest must bind the exact return receipt, items, and conflicts")
    }
    if (input.returnAuthorization.state === "verified" &&
        input.returnAuthorization.scopeDigest !== canonicalDigest(authorizationScopeReceipt(input))) {
      throw new Error("Finalized Figma Snapshot Import authorization scope must bind the exact governed write, return receipt, and reconciliation")
    }
  }

  private bindingMismatchCount(
    input: FinalizedFigmaSnapshotImportInput,
    product: Product,
    initiative: Initiative,
    governedWrite: GovernedFigmaWrite | undefined,
  ): number {
    let mismatches = 0
    const expectedContext = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(input.context) !== canonicalDigest(expectedContext)) mismatches += 1
    if (!governedWrite || input.governedWrite.recordId !== governedWrite.id ||
        input.governedWrite.revision !== governedWrite.revision ||
        input.governedWrite.digest !== canonicalDigest(governedWrite) ||
        input.governedWrite.membershipDigest !== governedWrite.membershipDigest ||
        input.governedWrite.requestDigest !== governedWrite.requestDigest ||
        input.governedWrite.effectDigest !== governedWrite.effectDigest ||
        input.governedWrite.externalFileIdentityDigest !== governedWrite.target.externalFileIdentityDigest ||
        input.governedWrite.expectedExternalVersionDigest !== governedWrite.target.expectedExternalVersionDigest) mismatches += 1
    return mismatches
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Finalized Figma Snapshot Import Source identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Finalized Figma Snapshot Import is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(
    record: FinalizedFigmaSnapshotImport,
    eventType: string,
    actorId: string,
  ): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, finalizedFigmaSnapshotImportSchema),
        this.governed(this.historyPath(record.id, record.revision), record, finalizedFigmaSnapshotImportSchema),
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
          governedWrite: record.governedWrite,
          returnMode: record.returnReceipt.mode,
          externalFileIdentityDigest: record.returnReceipt.externalFileIdentityDigest,
          returnedExternalVersionDigest: record.returnReceipt.returnedExternalVersionDigest,
          payloadDigest: record.returnReceipt.payloadDigest,
          receiptDigest: record.returnReceipt.receiptDigest,
          returnReceiptEvidenceState: record.returnReceipt.evidenceState,
          returnReceiptEvidenceDigest: canonicalDigest(record.returnReceipt.evidenceDigests),
          returnAuthorizationState: record.returnAuthorization.state,
          returnAuthorizationScopeDigest: record.returnAuthorization.scopeDigest,
          returnAuthorizationDecisionDigest: record.returnAuthorization.decisionDigest,
          returnAuthorizationEvidenceDigest: canonicalDigest(record.returnAuthorization.evidenceDigests),
          itemCount: record.items.length,
          itemCatalogDigest: canonicalDigest(record.items.map((entry) => ({
            key: entry.key,
            kind: entry.kind,
            externalIdentityDigest: entry.externalIdentityDigest,
            contentDigest: entry.contentDigest,
            provenanceDigest: entry.provenanceDigest,
            evidenceState: entry.evidenceState,
          }))),
          conflictCount: record.conflicts.length,
          conflictCatalogDigest: canonicalDigest(record.conflicts.map((entry) => ({
            key: entry.key,
            kind: entry.kind,
            state: entry.state,
            subjectDigest: entry.subjectDigest,
            rationaleDigest: entry.rationaleDigest,
          }))),
          reconciliationDigest: record.reconciliationDigest,
          reconciliationState: record.reconciliationState,
          provenanceState: record.provenanceState,
          snapshotCompletenessState: record.snapshotCompletenessState,
          unresolvedQuestionCount: record.unresolvedQuestions.length,
          reviewState: record.reviewState,
          inboundTransferState: record.inboundTransferState,
          importExecutionState: record.importExecutionState,
          importResultState: record.importResultState,
          figmaConnectionAuthorityState: record.figmaConnectionAuthorityState,
          credentialAuthorityState: record.credentialAuthorityState,
          permissionGrantState: record.permissionGrantState,
          externalCompletenessState: record.externalCompletenessState,
          targetValidityState: record.targetValidityState,
          designValidityState: record.designValidityState,
          designApprovalState: record.designApprovalState,
          designBaselineState: record.designBaselineState,
          readinessState: record.readinessState,
          implementationAuthorityState: record.implementationAuthorityState,
          actionAuthorityState: "not-granted",
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("finalized-figma-snapshot-imports", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve(
      "finalized-figma-snapshot-import-history",
      `finalized-figma-snapshot-import-${id}-r${revision}.json`,
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
    if (names.length > inventoryLimit) {
      throw new Error(`Finalized Figma Snapshot Import directory ${directory} exceeds the safety limit`)
    }
    const records = await Promise.all(
      names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)),
    )
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
