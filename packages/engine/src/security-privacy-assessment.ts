import { randomUUID } from "node:crypto"

import {
  exactSourceReferenceSchema,
  securityPrivacyAssessmentInputSchema,
  securityPrivacyAssessmentProjectionSchema,
  securityPrivacyAssessmentSchema,
  securityPrivacyAssessmentStatusSchema,
  type BusinessContextBinding,
  type ExactSecurityPrivacyAssessmentReference,
  type ExactSourceReference,
  type Initiative,
  type Product,
  type SecurityPrivacyAssessment,
  type SecurityPrivacyAssessmentInput,
  type SecurityPrivacyAssessmentProjection,
  type SecurityPrivacyAssessmentStatus,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { BoundedContextModelService } from "./bounded-context-model.js"
import type { BusinessArchitectureBaselineService } from "./business-architecture-baseline.js"
import type { OperatingModelService } from "./operating-model.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"
import type { SystemSolutionArchitectureService } from "./system-solution-architecture.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const assessmentInventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: SecurityPrivacyAssessment): ExactSecurityPrivacyAssessmentReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: SecurityPrivacyAssessmentInput) {
  return { boundedContextModel: input.boundedContextModel }
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
  reference: { recordId: string; revision: number; digest: string },
  record: { id: string; revision: number },
): boolean {
  return reference.recordId === record.id &&
    reference.revision === record.revision &&
    reference.digest === canonicalDigest(record)
}

export class SecurityPrivacyAssessmentService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly boundedContextModels: BoundedContextModelService,
    private readonly systemSolutionArchitectures: SystemSolutionArchitectureService,
    private readonly businessArchitectureBaselines: BusinessArchitectureBaselineService,
    private readonly operatingModels: OperatingModelService,
  ) {}

  async create(inputValue: SecurityPrivacyAssessmentInput, actorId: string): Promise<SecurityPrivacyAssessment> {
    const input = securityPrivacyAssessmentInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindingsAndAssessment(input)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Security, Privacy, and Threat Assessment candidate")
      }
      const now = new Date().toISOString()
      const record = securityPrivacyAssessmentSchema.parse({
        schemaVersion: 1,
        kind: "security-privacy-threat-assessment-candidate",
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
          "security-privacy-threat-assessment-is-a-candidate-record-and-does-not-approve-a-threat-model-attest-control-effectiveness-accept-risk-approve-data-processing-establish-security-readiness-or-authorize-action",
      })
      await this.commitVersionedRecord(record, "security.privacy-threat.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: SecurityPrivacyAssessmentInput,
    actorId: string,
  ): Promise<SecurityPrivacyAssessment> {
    const input = securityPrivacyAssessmentInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Security, Privacy, and Threat Assessment revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Security, Privacy, and Threat Assessment Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindingsAndAssessment(input)
      const record = securityPrivacyAssessmentSchema.parse({
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
      await this.commitVersionedRecord(record, "security.privacy-threat.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<SecurityPrivacyAssessment> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Security, Privacy, and Threat Assessment ID")),
      securityPrivacyAssessmentSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<SecurityPrivacyAssessment | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("security-privacy-assessments", currentRecordPattern, securityPrivacyAssessmentSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Security, Privacy, and Threat Assessment candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<SecurityPrivacyAssessment> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Security, Privacy, and Threat Assessment history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Security, Privacy, and Threat Assessment ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), securityPrivacyAssessmentSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Security, Privacy, and Threat Assessment history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<SecurityPrivacyAssessment[]> {
    const recordId = this.requireUuid(id, "Security, Privacy, and Threat Assessment ID")
    const records = await this.listRecords(
      "security-privacy-assessment-history",
      new RegExp(`^security-privacy-assessment-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      securityPrivacyAssessmentSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Security, Privacy, and Threat Assessment history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<SecurityPrivacyAssessmentStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, assessment, boundedContextModel, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.boundedContextModels.readCurrent(targetId),
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
    if (assessment) {
      if (canonicalDigest(assessment.context) !== canonicalDigest(expectedContext)) staleBindingCount += 1
      if (!boundedContextModel || !exactRecordMatches(assessment.boundedContextModel, boundedContextModel)) staleBindingCount += 1
      if (assessment.membershipDigest !== canonicalDigest(membership(assessment))) staleBindingCount += 1
    }
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(assessment).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const coverage = await this.coverageGaps(assessment, boundedContextModel)
    const unresolvedThreatCount = assessment?.threats.filter((entry) =>
      entry.category === "unresolved" || entry.residualRiskState === "unresolved").length ?? 0
    const unverifiedControlCount = assessment?.controls.filter((entry) =>
      entry.implementationState !== "observed-implemented" || entry.verificationState !== "evidence-linked").length ?? 0
    const unresolvedProcessingAuthorityCount = assessment?.dataClasses.filter((entry) =>
      entry.processingAuthorityState === "unresolved").length ?? 0
    const unresolvedRequirementCount = assessment?.requirementCoverage.filter((entry) => entry.state === "unresolved").length ?? 0
    const inconsistencyCount = assessment?.inconsistencies.length ?? 0
    const unresolvedQuestionCount = assessment?.unresolvedQuestions.length ?? 0
    const reasons: string[] = []
    if (!assessment) reasons.push("No versioned Security, Privacy, and Threat Assessment candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The assessment does not bind the exact current Product, Initiative, or Bounded Context and Ownership Model")
    if (staleSourceReferenceCount > 0) reasons.push("One or more assessment claims reference a superseded Source revision")
    if (unresolvedThreatCount > 0) reasons.push("One or more threats or residual-risk descriptions remain unresolved")
    if (unverifiedControlCount > 0) reasons.push("One or more candidate controls lack observed implementation and linked verification evidence")
    if (unresolvedProcessingAuthorityCount > 0) reasons.push("One or more data classes have unresolved processing authority")
    if (coverage.uncoveredArchitectureElementCount > 0) reasons.push("One or more architecture elements lack explicit security-asset coverage")
    if (coverage.unmappedArchitectureRelationCount > 0) reasons.push("One or more architecture relations lack explicit trust-boundary and data-flow coverage")
    if (unresolvedRequirementCount > 0) reasons.push("One or more Security or Data Profile requirements remain unresolved")
    if (inconsistencyCount > 0) reasons.push("The candidate records explicit security, privacy, or threat inconsistencies")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved security, privacy, or threat questions")
    return securityPrivacyAssessmentStatusSchema.parse({
      schemaVersion: 1,
      kind: "security-privacy-threat-assessment-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(assessment ? { assessment: exactReference(assessment) } : {}),
      assetCount: assessment?.assets.length ?? 0,
      actorCount: assessment?.actors.length ?? 0,
      trustBoundaryCount: assessment?.trustBoundaries.length ?? 0,
      dataClassCount: assessment?.dataClasses.length ?? 0,
      dataFlowCount: assessment?.dataFlows.length ?? 0,
      controlCount: assessment?.controls.length ?? 0,
      threatCount: assessment?.threats.length ?? 0,
      unresolvedThreatCount,
      unverifiedControlCount,
      unresolvedProcessingAuthorityCount,
      ...coverage,
      unresolvedRequirementCount,
      inconsistencyCount,
      unresolvedQuestionCount,
      staleBindingCount,
      staleSourceReferenceCount,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "security-privacy-threat-status-reports-candidate-coverage-and-gaps-and-does-not-approve-threats-attest-controls-accept-risk-approve-processing-establish-security-readiness-or-authorize-action",
    })
  }

  async project(initiativeId: string): Promise<SecurityPrivacyAssessmentProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, assessment] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.assess(targetId),
      this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Security, Privacy, and Threat projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "security-privacy-threat-assessment-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: {
        id: initiative.id,
        revision: revisionOf(initiative),
        digest: canonicalDigest(initiative),
        state: initiative.state,
      },
      status,
      ...(assessment ? {
        assessment: {
          id: assessment.id,
          revision: assessment.revision,
          digest: canonicalDigest(assessment),
          membershipDigest: assessment.membershipDigest,
          state: assessment.state,
          assetCount: assessment.assets.length,
          trustBoundaryCount: assessment.trustBoundaries.length,
          dataClassCount: assessment.dataClasses.length,
          controlCount: assessment.controls.length,
          threatCount: assessment.threats.length,
          updatedAt: assessment.updatedAt,
        },
      } : {}),
      observedAt: new Date().toISOString(),
      privacyBoundary:
        "projection-contains-identities-counts-statuses-and-digests-only-not-threat-scenarios-control-content-data-content-personal-data-locators-secrets-or-credentials" as const,
      authorityBoundary:
        "security-privacy-threat-projection-does-not-approve-a-threat-model-attest-control-effectiveness-accept-risk-approve-processing-establish-security-readiness-or-authorize-action" as const,
    }
    return securityPrivacyAssessmentProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const [product, records] = await Promise.all([
      this.readProduct(),
      this.listRecords("security-privacy-assessments", currentRecordPattern, securityPrivacyAssessmentSchema),
    ])
    for (const assessment of records) {
      try {
        const initiative = await this.readInitiative(assessment.initiativeId)
        this.validateContext(assessment.context, product, initiative)
        await this.validateSourceReferences(assessment, initiative.id)
        await this.validateBindingsAndAssessment(assessment)
        if (assessment.membershipDigest !== canonicalDigest(membership(assessment))) {
          throw new Error("Security, Privacy, and Threat Assessment membership digest is invalid")
        }
        const history = await this.listHistory(assessment.id)
        if (history.length !== assessment.revision || canonicalDigest(history[0]) !== canonicalDigest(assessment)) {
          throw new Error("Current Security, Privacy, and Threat Assessment does not match its complete immutable history")
        }
        const status = await this.assess(assessment.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "security.privacy-threat-binding-review-required",
            severity: "warning",
            message: `Initiative ${assessment.initiativeId} has stale Security, Privacy, and Threat Assessment bindings.`,
            record: { type: assessment.kind, id: assessment.id, revision: assessment.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "security.privacy-threat-invalid",
          severity: "error",
          message: `Security, Privacy, and Threat Assessment ${assessment.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: assessment.kind, id: assessment.id, revision: assessment.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private async coverageGaps(
    assessment: SecurityPrivacyAssessment | undefined,
    boundedContextModel: Awaited<ReturnType<BoundedContextModelService["readCurrent"]>>,
  ) {
    if (!boundedContextModel) {
      return { uncoveredArchitectureElementCount: 0, unmappedArchitectureRelationCount: 0 }
    }
    const architecture = await this.systemSolutionArchitectures.readRevision(
      boundedContextModel.systemSolutionArchitecture.recordId,
      boundedContextModel.systemSolutionArchitecture.revision,
    )
    if (!assessment) {
      return {
        uncoveredArchitectureElementCount: architecture.elements.length,
        unmappedArchitectureRelationCount: architecture.relations.length,
      }
    }
    const coveredElements = new Set(assessment.assets.flatMap((entry) => entry.architectureElementKeys))
    const boundaryRelations = new Set(assessment.trustBoundaries.flatMap((entry) => entry.architectureRelationKeys))
    const flowRelations = new Set(assessment.dataFlows.flatMap((entry) => entry.architectureRelationKeys))
    return {
      uncoveredArchitectureElementCount: architecture.elements.filter((entry) => !coveredElements.has(entry.key)).length,
      unmappedArchitectureRelationCount: architecture.relations.filter(
        (entry) => !boundaryRelations.has(entry.key) || !flowRelations.has(entry.key),
      ).length,
    }
  }

  private async validateBindingsAndAssessment(input: SecurityPrivacyAssessmentInput): Promise<void> {
    const boundedContextModel = await this.boundedContextModels.readCurrent(input.initiativeId)
    if (!boundedContextModel || !exactRecordMatches(input.boundedContextModel, boundedContextModel)) {
      throw new Error("Security, Privacy, and Threat Assessment must bind the exact current Bounded Context and Ownership Model candidate")
    }
    const architecture = await this.systemSolutionArchitectures.readRevision(
      boundedContextModel.systemSolutionArchitecture.recordId,
      boundedContextModel.systemSolutionArchitecture.revision,
    )
    if (!exactRecordMatches(boundedContextModel.systemSolutionArchitecture, architecture)) {
      throw new Error("Security, Privacy, and Threat Assessment Bounded Context Model has an invalid System/Solution Architecture binding")
    }
    const baseline = await this.businessArchitectureBaselines.readRevision(
      architecture.businessArchitectureBaseline.recordId,
      architecture.businessArchitectureBaseline.revision,
    )
    if (!exactRecordMatches(architecture.businessArchitectureBaseline, baseline)) {
      throw new Error("Security, Privacy, and Threat Assessment architecture has an invalid Business Architecture Baseline binding")
    }
    const operatingModel = await this.operatingModels.readRevision(
      baseline.operatingModel.recordId,
      baseline.operatingModel.revision,
    )
    if (!exactRecordMatches(baseline.operatingModel, operatingModel)) {
      throw new Error("Security, Privacy, and Threat Assessment baseline has an invalid Operating Model binding")
    }
    const roles = new Set(operatingModel.roles.map((entry) => entry.key))
    const roleReferences = [
      input.governance.securityAuthorityRoleKey,
      input.governance.privacyAuthorityRoleKey,
      ...input.governance.riskOwnerRoleKeys,
      ...input.governance.reviewerRoleKeys,
      ...input.assets.map((entry) => entry.ownerRoleKey),
      ...input.dataClasses.map((entry) => entry.ownerRoleKey),
      ...input.controls.map((entry) => entry.ownerRoleKey),
      ...input.threats.map((entry) => entry.ownerRoleKey),
    ]
    if (roleReferences.some((key) => !roles.has(key))) {
      throw new Error("Security, Privacy, and Threat Assessment roles must reference exact bound Operating Model roles")
    }
    const elementKeys = new Set(architecture.elements.map((entry) => entry.key))
    const relationKeys = new Set(architecture.relations.map((entry) => entry.key))
    const referencedElementKeys = [
      ...input.assets.flatMap((entry) => entry.architectureElementKeys),
      ...input.dataClasses.flatMap((entry) => entry.architectureElementKeys),
      ...input.controls.flatMap((entry) => entry.architectureElementKeys),
    ]
    if (referencedElementKeys.some((key) => !elementKeys.has(key))) {
      throw new Error("Security, Privacy, and Threat Assessment must reference exact System/Solution Architecture elements")
    }
    const assetCoverage = new Set(input.assets.flatMap((entry) => entry.architectureElementKeys))
    if (architecture.elements.some((entry) => !assetCoverage.has(entry.key))) {
      throw new Error("Every System/Solution Architecture element must have explicit security-asset coverage")
    }
    const boundaryRelations = new Set(input.trustBoundaries.flatMap((entry) => entry.architectureRelationKeys))
    const flowRelations = new Set(input.dataFlows.flatMap((entry) => entry.architectureRelationKeys))
    if ([...boundaryRelations, ...flowRelations].some((key) => !relationKeys.has(key))) {
      throw new Error("Trust boundaries and data flows must reference exact System/Solution Architecture relations")
    }
    if (architecture.relations.some((entry) => !boundaryRelations.has(entry.key) || !flowRelations.has(entry.key))) {
      throw new Error("Every System/Solution Architecture relation must have explicit trust-boundary and data-flow coverage")
    }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Security, Privacy, and Threat Assessment Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product),
      productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative),
      initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Security, Privacy, and Threat Assessment must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Security, Privacy, and Threat Assessment Source reference identity, Initiative, revision, record digest, or content digest does not match")
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
      throw new Error(`Terminal Initiative ${initiative.state} Security, Privacy, and Threat Assessment is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: SecurityPrivacyAssessment, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, securityPrivacyAssessmentSchema),
        this.governed(this.historyPath(record.id, record.revision), record, securityPrivacyAssessmentSchema),
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
          threatModelApprovalState: record.governance.threatModelApprovalState,
          privacyReviewState: record.governance.privacyReviewState,
          residualRiskAcceptanceState: record.governance.residualRiskAcceptanceState,
          controlEffectivenessState: record.governance.controlEffectivenessState,
          reviewState: record.governance.reviewState,
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("security-privacy-assessments", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("security-privacy-assessment-history", `security-privacy-assessment-${id}-r${revision}.json`)
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
    if (names.length > assessmentInventoryLimit) {
      throw new Error(`Security, Privacy, and Threat Assessment directory ${directory} exceeds the ${assessmentInventoryLimit}-record safety limit`)
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
