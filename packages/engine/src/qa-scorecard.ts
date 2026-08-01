import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  qaScorecardInputSchema,
  qaScorecardProjectionSchema,
  qaScorecardSchema,
  qaScorecardStatusSchema,
  type BusinessContextBinding,
  type Initiative,
  type Product,
  type QaScorecard,
  type QaScorecardInput,
  type QaScorecardProjection,
  type QaScorecardStatus,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "qa-scorecard-is-a-versioned-local-evidence-candidate-and-does-not-establish-product-truth-human-validation-security-approval-product-owner-acceptance-release-readiness-deployment-readiness-or-action-authority" as const
const statusAuthorityBoundary = "qa-scorecard-status-is-observational-and-grants-no-product-truth-human-validation-security-approval-product-owner-acceptance-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "qa-scorecard-projection-is-read-only-and-grants-no-product-truth-human-validation-security-approval-product-owner-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-bounded-dimension-evidence-identities-repository-relative-paths-digests-counts-times-states-gaps-and-receipts-only-not-test-output-source-code-product-content-personal-data-secrets-credentials-permissions-or-machine-paths" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }) { return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) } }

export class QaScorecardService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
  ) {}

  async create(inputValue: QaScorecardInput, actorId: string): Promise<QaScorecard> {
    const input = qaScorecardInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      if (await this.readCurrent(input.initiativeId)) throw new Error("A current QA scorecard already exists; create a revision")
      const now = new Date().toISOString()
      const record = qaScorecardSchema.parse({
        schemaVersion: 1,
        kind: "qa-scorecard-candidate",
        id: randomUUID(),
        productId: product.id,
        ...input,
        revision: 1,
        ...this.composeDigests(input),
        state: "candidate",
        createdBy: { kind: "human", id: actorId },
        updatedBy: { kind: "human", id: actorId },
        createdAt: now,
        updatedAt: now,
        authorityBoundary,
      })
      await this.commitVersionedRecord(record, "qa-scorecard.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: QaScorecardInput, actorId: string): Promise<QaScorecard> {
    const input = qaScorecardInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("QA scorecard revision conflict")
      if (current.initiativeId !== input.initiativeId) throw new Error("QA scorecard Initiative binding is immutable")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const record = qaScorecardSchema.parse({
        ...current,
        ...input,
        revision: current.revision + 1,
        ...this.composeDigests(input),
        predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId },
        updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, "qa-scorecard.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<QaScorecard> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "QA scorecard ID")), qaScorecardSchema)
  }

  async readCurrent(initiativeId: string): Promise<QaScorecard | undefined> {
    const target = this.requireUuid(initiativeId, "Initiative ID")
    const matches = (await this.listRecords("qa-scorecards", currentRecordPattern, qaScorecardSchema)).filter((record) => record.initiativeId === target)
    if (matches.length > 1) throw new Error("Multiple current QA scorecards target one Initiative")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<QaScorecard> {
    const recordId = this.requireUuid(id, "QA scorecard ID")
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Revision must be a positive integer")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), qaScorecardSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("QA scorecard history binding mismatch")
    return record
  }

  async listHistory(id: string): Promise<QaScorecard[]> {
    const recordId = this.requireUuid(id, "QA scorecard ID")
    return (await this.listRecords("qa-scorecard-history", new RegExp(`^qa-scorecard-${recordId}-r[1-9][0-9]*\\.json$`, "i"), qaScorecardSchema))
      .sort((left, right) => right.revision - left.revision)
  }

  async assess(initiativeId: string): Promise<QaScorecardStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate] = await Promise.all([this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId)])
    const dimensions = candidate?.dimensions ?? []
    const count = (state: QaScorecard["dimensions"][number]["state"]) => dimensions.filter((dimension) => dimension.state === state).length
    const successCount = count("success"), failureCount = count("failure"), missingCount = candidate ? count("missing") : 10
    const staleCount = count("stale"), notAssessedCount = count("not-assessed")
    const evidenceCount = dimensions.reduce((total, dimension) => total + dimension.evidence.length, 0)
    const unresolvedGapCount = candidate?.unresolvedGapKeys.length ?? 0
    const reasons: string[] = []
    if (!candidate) reasons.push("No current multi-dimensional QA scorecard is recorded")
    if (failureCount) reasons.push("One or more QA dimensions contain attributable local failure evidence")
    if (missingCount) reasons.push("One or more QA dimensions are missing evidence")
    if (staleCount) reasons.push("One or more QA dimensions contain stale evidence")
    if (notAssessedCount) reasons.push("One or more QA dimensions are explicitly not assessed")
    if (unresolvedGapCount) reasons.push("The QA scorecard records unresolved gaps")
    const reviewState = candidate?.reviewState ?? "draft"
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The QA scorecard is not ready for human review")
    const current = Boolean(candidate && successCount === 10 && failureCount + missingCount + staleCount + notAssessedCount + unresolvedGapCount === 0 && reviewState === "ready-for-human-review")
    return qaScorecardStatusSchema.parse({
      schemaVersion: 1,
      kind: "qa-scorecard-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      dimensionCount: 10,
      successCount,
      failureCount,
      missingCount,
      staleCount,
      notAssessedCount,
      evidenceCount,
      unresolvedGapCount,
      reviewState,
      state: current ? "local-evidence-current" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary: statusAuthorityBoundary,
    })
  }

  async project(initiativeId: string): Promise<QaScorecardProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId)])
    const body = {
      schemaVersion: 1 as const,
      kind: "qa-scorecard-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        dimensions: candidate.dimensions.map((dimension) => ({
          id: dimension.id,
          ordinal: dimension.ordinal,
          state: dimension.state,
          evidenceCount: dimension.evidence.length,
          gapCount: dimension.gapKeys.length,
          limitationCount: dimension.evidence.reduce((total, evidence) => total + evidence.limitationCount, 0),
          localAutomationState: dimension.localAutomationState,
          humanValidationState: dimension.humanValidationState,
        })),
        evidenceCatalogDigest: candidate.evidenceCatalogDigest,
        dimensionReceiptDigest: candidate.dimensionReceiptDigest,
        gapReceiptDigest: candidate.gapReceiptDigest,
        assessmentReceiptDigest: candidate.assessmentReceiptDigest,
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary,
      authorityBoundary: projectionAuthorityBoundary,
    }
    return qaScorecardProjectionSchema.parse({ ...body, snapshotDigest: canonicalDigest(body) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    for (const candidate of await this.listRecords("qa-scorecards", currentRecordPattern, qaScorecardSchema)) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) throw new Error("Current scorecard does not match immutable history")
        if ((await this.assess(candidate.initiativeId)).state === "attention-required") issues.push({
          code: "qa-scorecard.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has a failed, missing, stale, not-assessed, unresolved, or unreviewed QA scorecard.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "create-superseding-revision"],
        })
      } catch (error) {
        issues.push({ code: "qa-scorecard.invalid", severity: "error", message: `QA scorecard ${candidate.id}: ${error instanceof Error ? error.message : "validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "manual-repair-required"] })
      }
    }
    return issues
  }

  private composeDigests(input: QaScorecardInput) {
    const evidenceCatalogDigest = canonicalDigest(input.dimensions.flatMap((dimension) => dimension.evidence))
    const dimensionReceiptDigest = canonicalDigest(input.dimensions.map(({ evidence: _evidence, reasons: _reasons, ...dimension }) => dimension))
    const gapReceiptDigest = canonicalDigest({ unresolvedGapKeys: input.unresolvedGapKeys, dimensions: input.dimensions.map((dimension) => ({ id: dimension.id, gapKeys: dimension.gapKeys, reasons: dimension.reasons })) })
    const assessmentReceiptDigest = canonicalDigest({ evidenceCatalogDigest, dimensionReceiptDigest, gapReceiptDigest, reviewState: input.reviewState,
      productTruthState: input.productTruthState, nativeHumanAcceptanceState: input.nativeHumanAcceptanceState, securityApprovalState: input.securityApprovalState,
      productOwnerAcceptanceState: input.productOwnerAcceptanceState, releaseReadinessState: input.releaseReadinessState,
      deploymentReadinessState: input.deploymentReadinessState, actionAuthorityState: input.actionAuthorityState })
    return { evidenceCatalogDigest, dimensionReceiptDigest, gapReceiptDigest, assessmentReceiptDigest }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id || canonicalDigest(binding) !== canonicalDigest({ productRevision: revisionOf(product), productDigest: canonicalDigest(product), initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) })) {
      throw new Error("QA scorecard must bind exact current Product and Initiative revisions and digests")
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} QA scorecard is immutable`)
    return { product, initiative }
  }

  private async commitVersionedRecord(record: QaScorecard, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [this.governed(this.currentPath(record.id), record, qaScorecardSchema), this.governed(this.historyPath(record.id, record.revision), record, qaScorecardSchema)],
      audit: { eventType, actor: { kind: "human", id: actorId }, subjectId: record.id, payload: { initiativeId: record.initiativeId, revision: record.revision,
        recordDigest: canonicalDigest(record), dimensionCount: record.dimensions.length, evidenceCount: record.dimensions.reduce((total, dimension) => total + dimension.evidence.length, 0),
        unresolvedGapCount: record.unresolvedGapKeys.length, evidenceCatalogDigest: record.evidenceCatalogDigest, dimensionReceiptDigest: record.dimensionReceiptDigest,
        gapReceiptDigest: record.gapReceiptDigest, assessmentReceiptDigest: record.assessmentReceiptDigest, predecessorDigest: record.predecessorDigest,
        productTruthState: record.productTruthState, securityApprovalState: record.securityApprovalState, productOwnerAcceptanceState: record.productOwnerAcceptanceState,
        releaseReadinessState: record.releaseReadinessState, actionAuthorityState: record.actionAuthorityState, authorityBoundary: record.authorityBoundary } },
    })
  }

  private currentPath(id: string): string { return this.repository.resolve("qa-scorecards", `${id}.json`) }
  private historyPath(id: string, revision: number): string { return this.repository.resolve("qa-scorecard-history", `qa-scorecard-${id}-r${revision}.json`) }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string { const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data }
  private async assertIntegrity(): Promise<void> { const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed") }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error }
    if (names.length > inventoryLimit) throw new Error(`QA scorecard directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => `${String((left as Record<string, unknown>).id ?? "")}:${String((left as Record<string, unknown>).revision ?? "")}`.localeCompare(`${String((right as Record<string, unknown>).id ?? "")}:${String((right as Record<string, unknown>).revision ?? "")}`))
  }
}
