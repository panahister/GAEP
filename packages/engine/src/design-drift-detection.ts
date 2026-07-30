import { randomUUID } from "node:crypto"

import {
  designDriftDetectionInputSchema,
  designDriftDetectionProjectionSchema,
  designDriftDetectionSchema,
  designDriftDetectionStatusSchema,
  exactSourceReferenceSchema,
  type BusinessContextBinding,
  type DesignBaseline,
  type DesignDriftDetection,
  type DesignDriftDetectionInput,
  type DesignDriftDetectionProjection,
  type DesignDriftDetectionStatus,
  type DesignRequirements,
  type DesignToRequirementBinding,
  type ExactSourceReference,
  type FinalizedFigmaSnapshotImport,
  type Initiative,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { DesignBaselineService } from "./design-baseline.js"
import type { DesignRequirementsService } from "./design-requirements.js"
import type { DesignToRequirementBindingService } from "./design-to-requirement-binding.js"
import type { FinalizedFigmaSnapshotImportService } from "./finalized-figma-snapshot-import.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type DependencyReaders = {
  designBaseline: Pick<DesignBaselineService, "readCurrent">
  returnedFigmaSnapshot: Pick<FinalizedFigmaSnapshotImportService, "readCurrent">
  designRequirements: Pick<DesignRequirementsService, "readCurrent">
  designTrace: Pick<DesignToRequirementBindingService, "readCurrent">
}

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: DesignDriftDetection) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

export function designDriftBaselineReference(record: DesignBaseline) {
  return {
    recordId: record.id,
    revision: record.revision,
    digest: canonicalDigest(record),
    membershipDigest: record.membershipDigest,
    baselineLineageId: record.baselineLineageId,
    candidateSetId: record.candidateSetId,
    candidateSetRevision: record.candidateSetRevision,
    semanticVersion: record.semanticVersion,
    designationReceiptDigest: record.designationReceiptDigest,
    baselineDesignationState: "not-established" as const,
  }
}

export function designDriftSnapshotReference(record: FinalizedFigmaSnapshotImport) {
  return {
    recordId: record.id,
    revision: record.revision,
    digest: canonicalDigest(record),
    membershipDigest: record.membershipDigest,
    externalFileIdentityDigest: record.returnReceipt.externalFileIdentityDigest,
    returnedExternalVersionDigest: record.returnReceipt.returnedExternalVersionDigest,
    itemCatalogDigest: canonicalDigest(record.items),
  }
}

export function designDriftRequirementsReference(record: DesignRequirements) {
  return {
    recordId: record.id,
    revision: record.revision,
    digest: canonicalDigest(record),
    membershipDigest: record.membershipDigest,
    requirementCatalogDigest: canonicalDigest(record.requirements),
  }
}

export function designDriftTraceReference(record: DesignToRequirementBinding) {
  return {
    recordId: record.id,
    revision: record.revision,
    digest: canonicalDigest(record),
    membershipDigest: record.membershipDigest,
    reconciliationDigest: record.reconciliationDigest,
  }
}

export function designDriftImplementationTargetCatalogDigest(
  input: Pick<DesignDriftDetectionInput, "implementationTargetCatalogRevision" | "implementationTargets">,
): string {
  return canonicalDigest({
    revision: input.implementationTargetCatalogRevision,
    targets: input.implementationTargets,
  })
}

export function designDriftComparisonDigest(
  input: Pick<DesignDriftDetectionInput,
    "comparisonPolicyDigest" | "designBaseline" | "designRequirements" | "designTrace" |
    "implementationTargetCatalogDigest" | "implementationTargetCatalogRevision" | "observations" |
    "returnedFigmaSnapshot">,
): string {
  return canonicalDigest({
    designBaseline: input.designBaseline,
    returnedFigmaSnapshot: input.returnedFigmaSnapshot,
    designRequirements: input.designRequirements,
    designTrace: input.designTrace,
    implementationTargetCatalogRevision: input.implementationTargetCatalogRevision,
    implementationTargetCatalogDigest: input.implementationTargetCatalogDigest,
    comparisonPolicyDigest: input.comparisonPolicyDigest,
    observations: input.observations,
  })
}

function membership(input: DesignDriftDetectionInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    objectiveDigest: input.objectiveDigest,
    designBaseline: input.designBaseline,
    returnedFigmaSnapshot: input.returnedFigmaSnapshot,
    designRequirements: input.designRequirements,
    designTrace: input.designTrace,
    implementationTargetCatalogRevision: input.implementationTargetCatalogRevision,
    implementationTargets: input.implementationTargets,
    implementationTargetCatalogDigest: input.implementationTargetCatalogDigest,
    comparisonPolicyDigest: input.comparisonPolicyDigest,
    observations: input.observations,
    comparisonDigest: input.comparisonDigest,
    remediationCandidates: input.remediationCandidates,
    candidateResult: input.candidateResult,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    comparisonCompletenessState: input.comparisonCompletenessState,
    externalCompletenessState: input.externalCompletenessState,
    designValidityState: input.designValidityState,
    implementationValidityState: input.implementationValidityState,
    approvalState: input.approvalState,
    baselineDesignationState: input.baselineDesignationState,
    readinessState: input.readinessState,
    remediationAuthorityState: input.remediationAuthorityState,
    figmaConnectionAuthorityState: input.figmaConnectionAuthorityState,
    credentialAuthorityState: input.credentialAuthorityState,
    permissionGrantState: input.permissionGrantState,
    importExecutionState: input.importExecutionState,
    writeExecutionState: input.writeExecutionState,
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

export class DesignDriftDetectionService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly dependencies: DependencyReaders,
  ) {}

  async create(inputValue: DesignDriftDetectionInput, actorId: string): Promise<DesignDriftDetection> {
    const input = designDriftDetectionInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateDependencies(input)
      this.validateReceipts(input)
      await this.validateSourceReferences(input, initiative.id)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Design Drift Detection candidate")
      }
      const now = new Date().toISOString()
      const record = designDriftDetectionSchema.parse({
        schemaVersion: 1,
        kind: "design-drift-detection-candidate",
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
          "design-drift-detection-is-a-version-bound-observation-and-remediation-candidate-and-does-not-establish-an-actual-baseline-comparison-completeness-external-completeness-design-or-implementation-validity-approval-readiness-remediation-effect-or-figma-import-write-implementation-or-action-authority",
      })
      await this.commitVersionedRecord(record, "design-drift-detection.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: DesignDriftDetectionInput,
    actorId: string,
  ): Promise<DesignDriftDetection> {
    const input = designDriftDetectionInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Design Drift Detection revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Design Drift Detection Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateDependencies(input)
      this.validateReceipts(input)
      await this.validateSourceReferences(input, initiative.id)
      const record = designDriftDetectionSchema.parse({
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
      await this.commitVersionedRecord(record, "design-drift-detection.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<DesignDriftDetection> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Design Drift Detection ID")), designDriftDetectionSchema)
  }

  async readCurrent(initiativeId: string): Promise<DesignDriftDetection | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("design-drift-detections", currentRecordPattern, designDriftDetectionSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Design Drift Detection candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<DesignDriftDetection> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Design Drift Detection history revision must be a positive integer")
    const recordId = this.requireUuid(id, "Design Drift Detection ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), designDriftDetectionSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Design Drift Detection history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<DesignDriftDetection[]> {
    const recordId = this.requireUuid(id, "Design Drift Detection ID")
    const records = await this.listRecords(
      "design-drift-detection-history",
      new RegExp(`^design-drift-detection-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      designDriftDetectionSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      const predecessor = index > 0 ? ascending[index - 1] : undefined
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (predecessor && record.predecessorDigest !== canonicalDigest(predecessor))) {
        throw new Error("Design Drift Detection history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<DesignDriftDetectionStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, currentSources, baseline, snapshot, requirements, trace] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
      this.dependencies.designBaseline.readCurrent(targetId),
      this.dependencies.returnedFigmaSnapshot.readCurrent(targetId),
      this.dependencies.designRequirements.readCurrent(targetId),
      this.dependencies.designTrace.readCurrent(targetId),
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
      if (candidate.implementationTargetCatalogDigest !== designDriftImplementationTargetCatalogDigest(candidate)) staleBindingCount += 1
      if (candidate.comparisonDigest !== designDriftComparisonDigest(candidate)) staleBindingCount += 1
      if (!baseline || canonicalDigest(candidate.designBaseline) !== canonicalDigest(designDriftBaselineReference(baseline))) staleBindingCount += 1
      if (!snapshot || canonicalDigest(candidate.returnedFigmaSnapshot) !== canonicalDigest(designDriftSnapshotReference(snapshot))) staleBindingCount += 1
      if (!requirements || canonicalDigest(candidate.designRequirements) !== canonicalDigest(designDriftRequirementsReference(requirements))) staleBindingCount += 1
      if (!trace || canonicalDigest(candidate.designTrace) !== canonicalDigest(designDriftTraceReference(trace))) staleBindingCount += 1
      try {
        await this.listHistory(candidate.id)
        if (baseline && snapshot && requirements && trace) this.validateCatalogReferences(candidate, baseline, snapshot, requirements, trace)
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
    const observations = candidate?.observations ?? []
    const targets = candidate?.implementationTargets ?? []
    const assessedAt = new Date().toISOString()
    const expiredRemediationCandidateCount = candidate?.remediationCandidates
      .filter((entry) => entry.validUntil <= assessedAt).length ?? 0
    const conformantCount = observations.filter((entry) => entry.classification === "conformant").length
    const unassessedCount = observations.filter((entry) => entry.classification === "not-assessed").length
    const driftCount = observations.length - conformantCount - unassessedCount
    const reasons: string[] = []
    if (!candidate) reasons.push("No version-bound Design Drift Detection candidate exists for this Initiative")
    if (!baseline) reasons.push("No current Design Baseline candidate exists for the comparison")
    if (!snapshot) reasons.push("No current returned Figma snapshot candidate exists for the comparison")
    if (!requirements) reasons.push("No current Design Requirements candidate exists for the comparison")
    if (!trace) reasons.push("No current Design-to-Requirement trace candidate exists for the comparison")
    if (staleBindingCount > 0) reasons.push("The Design Drift Detection does not bind exact current context, dependencies, catalogs, receipts, or immutable history")
    if (staleSourceReferenceCount > 0) reasons.push("The Design Drift Detection references a superseded Source revision")
    if (targets.some((entry) => entry.evidenceState !== "human-reviewed")) reasons.push("One or more implementation targets lack attributable human review")
    if (observations.some((entry) => entry.evidenceState !== "human-reviewed")) reasons.push("One or more drift observations lack attributable human review")
    if (unassessedCount > 0) reasons.push("One or more exact comparison subjects remain not assessed")
    if (expiredRemediationCandidateCount > 0) reasons.push("One or more remediation candidates are expired")
    if ((candidate?.unresolvedQuestions.length ?? 0) > 0) reasons.push("The Design Drift Detection records unresolved questions")
    if (candidate && ["blocked", "incomplete"].includes(candidate.candidateResult)) reasons.push("The Design Drift Detection candidate is blocked or incomplete")
    if (candidate && candidate.reviewState !== "ready-for-human-review") reasons.push("The Design Drift Detection candidate is not ready for human review")
    return designDriftDetectionStatusSchema.parse({
      schemaVersion: 1,
      kind: "design-drift-detection-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      implementationTargetCount: targets.length,
      humanReviewedImplementationTargetCount: targets.filter((entry) => entry.evidenceState === "human-reviewed").length,
      observationCount: observations.length,
      humanReviewedObservationCount: observations.filter((entry) => entry.evidenceState === "human-reviewed").length,
      requirementToDesignCount: observations.filter((entry) => entry.path === "requirement-to-design").length,
      designToImplementationCount: observations.filter((entry) => entry.path === "design-to-implementation").length,
      conformantCount,
      driftCount,
      unassessedCount,
      blockerCount: observations.filter((entry) => entry.severity === "blocker").length,
      highSeverityCount: observations.filter((entry) => entry.severity === "high").length,
      remediationCandidateCount: candidate?.remediationCandidates.length ?? 0,
      expiredRemediationCandidateCount,
      staleBindingCount,
      staleSourceReferenceCount,
      unresolvedQuestionCount: candidate?.unresolvedQuestions.length ?? 0,
      candidateResult: candidate?.candidateResult ?? "not-assessed",
      reviewState: candidate?.reviewState ?? "draft",
      state: reasons.length === 0 ? "complete-for-human-review" : "attention-required",
      reasons,
      assessedAt,
      authorityBoundary:
        "design-drift-detection-status-is-observational-and-does-not-establish-an-actual-baseline-comparison-completeness-external-completeness-design-or-implementation-validity-approval-readiness-remediation-effect-or-figma-import-write-implementation-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<DesignDriftDetectionProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Design Drift Detection projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "design-drift-detection-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        state: candidate.state,
        designBaseline: candidate.designBaseline,
        returnedFigmaSnapshot: candidate.returnedFigmaSnapshot,
        designRequirements: candidate.designRequirements,
        designTrace: candidate.designTrace,
        implementationTargetCatalogRevision: candidate.implementationTargetCatalogRevision,
        implementationTargetCatalogDigest: candidate.implementationTargetCatalogDigest,
        comparisonPolicyDigest: candidate.comparisonPolicyDigest,
        comparisonDigest: candidate.comparisonDigest,
        implementationTargetCount: candidate.implementationTargets.length,
        observationCount: candidate.observations.length,
        remediationCandidateCount: candidate.remediationCandidates.length,
        candidateResult: candidate.candidateResult,
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-version-axes-counts-classifications-severities-statuses-and-digests-only-not-design-requirement-or-implementation-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions" as const,
      authorityBoundary:
        "design-drift-detection-projection-is-read-only-and-does-not-establish-an-actual-baseline-comparison-completeness-external-completeness-design-or-implementation-validity-approval-readiness-remediation-effect-or-figma-import-write-implementation-or-action-authority" as const,
    }
    return designDriftDetectionProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("design-drift-detections", currentRecordPattern, designDriftDetectionSchema)
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) throw new Error("Design Drift Detection membership digest is invalid")
        if (candidate.implementationTargetCatalogDigest !== designDriftImplementationTargetCatalogDigest(candidate)) throw new Error("Design Drift Detection target catalog digest is invalid")
        if (candidate.comparisonDigest !== designDriftComparisonDigest(candidate)) throw new Error("Design Drift Detection comparison receipt is invalid")
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Design Drift Detection candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0 ||
            status.unassessedCount > 0 || status.expiredRemediationCandidateCount > 0) {
          issues.push({
            code: "design-drift-detection.review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale, unassessed, or expired Design Drift Detection evidence.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "design-drift-detection.invalid",
          severity: "error",
          message: `Design Drift Detection ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Design Drift Detection Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Design Drift Detection must bind exact current Product and Initiative revisions and digests")
    }
  }

  private async validateDependencies(input: DesignDriftDetectionInput): Promise<void> {
    const [baseline, snapshot, requirements, trace] = await Promise.all([
      this.dependencies.designBaseline.readCurrent(input.initiativeId),
      this.dependencies.returnedFigmaSnapshot.readCurrent(input.initiativeId),
      this.dependencies.designRequirements.readCurrent(input.initiativeId),
      this.dependencies.designTrace.readCurrent(input.initiativeId),
    ])
    if (!baseline || canonicalDigest(input.designBaseline) !== canonicalDigest(designDriftBaselineReference(baseline))) {
      throw new Error("Design Drift Detection must bind the exact current Design Baseline candidate")
    }
    if (!snapshot || canonicalDigest(input.returnedFigmaSnapshot) !== canonicalDigest(designDriftSnapshotReference(snapshot))) {
      throw new Error("Design Drift Detection must bind the exact current returned Figma snapshot candidate")
    }
    if (!requirements || canonicalDigest(input.designRequirements) !== canonicalDigest(designDriftRequirementsReference(requirements))) {
      throw new Error("Design Drift Detection must bind the exact current Design Requirements candidate")
    }
    if (!trace || canonicalDigest(input.designTrace) !== canonicalDigest(designDriftTraceReference(trace))) {
      throw new Error("Design Drift Detection must bind the exact current Design-to-Requirement trace candidate")
    }
    this.validateCatalogReferences(input, baseline, snapshot, requirements, trace)
  }

  private validateCatalogReferences(
    input: DesignDriftDetectionInput,
    baseline: DesignBaseline,
    snapshot: FinalizedFigmaSnapshotImport,
    requirements: DesignRequirements,
    trace: DesignToRequirementBinding,
  ): void {
    if (baseline.subject.recordId !== snapshot.id || baseline.subject.revision !== snapshot.revision ||
        baseline.subject.digest !== canonicalDigest(snapshot) || baseline.subject.itemCatalogDigest !== canonicalDigest(snapshot.items)) {
      throw new Error("Design Baseline candidate does not identify the exact returned Figma snapshot candidate")
    }
    if (canonicalDigest(trace.finalizedSnapshot) !== canonicalDigest({
      recordId: snapshot.id, revision: snapshot.revision, digest: canonicalDigest(snapshot),
      membershipDigest: snapshot.membershipDigest, itemCatalogDigest: canonicalDigest(snapshot.items),
    }) || canonicalDigest(trace.designRequirements) !== canonicalDigest({
      recordId: requirements.id, revision: requirements.revision, digest: canonicalDigest(requirements),
      membershipDigest: requirements.membershipDigest, requirementCatalogDigest: canonicalDigest(requirements.requirements),
    })) {
      throw new Error("Design Drift Detection trace does not bind the exact snapshot and Requirements candidates")
    }
    const designItemKeys = new Set(snapshot.items.map((entry) => entry.key))
    const requirementKeys = new Set(requirements.requirements.map((entry) => entry.key))
    for (const target of input.implementationTargets) {
      if (target.designItemKeys.some((key) => !designItemKeys.has(key)) ||
          target.requirementKeys.some((key) => !requirementKeys.has(key))) {
        throw new Error("Implementation targets must bind exact current design items and Requirements")
      }
    }
    for (const observation of input.observations) {
      if (!designItemKeys.has(observation.designItemKey) ||
          observation.requirementKeys.some((key) => !requirementKeys.has(key))) {
        throw new Error("Drift observations must bind exact current design items and Requirements")
      }
    }
  }

  private validateReceipts(input: DesignDriftDetectionInput): void {
    if (input.implementationTargetCatalogDigest !== designDriftImplementationTargetCatalogDigest(input)) {
      throw new Error("Design Drift Detection target catalog digest must bind the exact catalog revision and targets")
    }
    if (input.comparisonDigest !== designDriftComparisonDigest(input)) {
      throw new Error("Design Drift Detection comparison digest must bind exact dependencies, policy, target catalog, and observations")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Design Drift Detection Source identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Design Drift Detection is immutable`)
    return { product, initiative }
  }

  private async commitVersionedRecord(record: DesignDriftDetection, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, designDriftDetectionSchema),
        this.governed(this.historyPath(record.id, record.revision), record, designDriftDetectionSchema),
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
          designBaseline: record.designBaseline,
          returnedFigmaSnapshot: record.returnedFigmaSnapshot,
          designRequirements: record.designRequirements,
          designTrace: record.designTrace,
          implementationTargetCatalogRevision: record.implementationTargetCatalogRevision,
          implementationTargetCatalogDigest: record.implementationTargetCatalogDigest,
          implementationTargetCount: record.implementationTargets.length,
          comparisonPolicyDigest: record.comparisonPolicyDigest,
          comparisonDigest: record.comparisonDigest,
          observationCount: record.observations.length,
          requirementToDesignCount: record.observations.filter((entry) => entry.path === "requirement-to-design").length,
          designToImplementationCount: record.observations.filter((entry) => entry.path === "design-to-implementation").length,
          classificationCounts: Object.fromEntries([...new Set(record.observations.map((entry) => entry.classification))]
            .sort().map((classification) => [classification, record.observations.filter((entry) => entry.classification === classification).length])),
          severityCounts: Object.fromEntries([...new Set(record.observations.map((entry) => entry.severity))]
            .sort().map((severity) => [severity, record.observations.filter((entry) => entry.severity === severity).length])),
          remediationCandidateCount: record.remediationCandidates.length,
          candidateResult: record.candidateResult,
          reviewState: record.reviewState,
          comparisonCompletenessState: record.comparisonCompletenessState,
          externalCompletenessState: record.externalCompletenessState,
          designValidityState: record.designValidityState,
          implementationValidityState: record.implementationValidityState,
          approvalState: record.approvalState,
          baselineDesignationState: record.baselineDesignationState,
          readinessState: record.readinessState,
          remediationAuthorityState: record.remediationAuthorityState,
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
    return this.repository.resolve("design-drift-detections", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("design-drift-detection-history", `design-drift-detection-${id}-r${revision}.json`)
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
    if (names.length > inventoryLimit) throw new Error(`Design Drift Detection directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
