import { randomUUID } from "node:crypto"

import {
  evidenceRegistryInputSchema,
  evidenceRegistryProjectionSchema,
  evidenceRegistrySchema,
  evidenceRegistryStatusSchema,
  exactSourceReferenceSchema,
  type BusinessContextBinding,
  type EvidenceRegistry,
  type EvidenceRegistryInput,
  type EvidenceRegistryProjection,
  type EvidenceRegistryStatus,
  type ExactDecisionSubjectReference,
  type ExactEvidenceRegistryReference,
  type ExactSourceReference,
  type Initiative,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { ArchitectureChallengeModelService } from "./architecture-challenge-model.js"
import type { DecisionRegisterService } from "./decision-register.js"
import type { OperatingModelService } from "./operating-model.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { RiskRegisterService } from "./risk-register.js"
import type { SecurityPrivacyAssessmentService } from "./security-privacy-assessment.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const evidenceRegistryInventoryLimit = 10_000
const subjectIdentitySchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int().positive(),
  productId: z.string().uuid().optional(),
  initiativeId: z.string().uuid().optional(),
}).passthrough()

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: EvidenceRegistry): ExactEvidenceRegistryReference {
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

function uniqueSubjectReferences(value: EvidenceRegistryInput | EvidenceRegistry): ExactDecisionSubjectReference[] {
  const references = [
    ...value.claims.flatMap((claim) => claim.subjects),
    ...value.evidenceItems.flatMap((evidence) => evidence.subjects),
  ]
  const unique = new Map(references.map((reference) => [
    `${reference.recordKind}:${reference.recordId}:${reference.revision}:${reference.digest}`,
    reference,
  ]))
  return [...unique.values()].sort((left, right) =>
    left.recordKind.localeCompare(right.recordKind) || left.recordId.localeCompare(right.recordId) ||
    left.revision - right.revision)
}

function membership(input: EvidenceRegistryInput) {
  return {
    operatingModel: input.operatingModel,
    architectureChallengeModel: input.architectureChallengeModel,
    securityPrivacyAssessment: input.securityPrivacyAssessment,
    decisionRegister: input.decisionRegister,
    riskRegister: input.riskRegister,
    claims: input.claims.map((claim) => ({ key: claim.key, subjects: claim.subjects })),
    evidenceItems: input.evidenceItems.map((evidence) => ({
      key: evidence.key,
      evidenceId: evidence.evidenceId,
      evidenceRevision: evidence.evidenceRevision,
      evidenceDigest: evidence.evidenceDigest,
      claimKeys: evidence.claimKeys,
      subjects: evidence.subjects,
      sourceReferences: uniqueExactSourceReferences(evidence),
    })),
    links: input.links.map((link) => ({
      key: link.key,
      claimKey: link.claimKey,
      evidenceKey: link.evidenceKey,
      relationship: link.relationship,
    })),
  }
}

function exactRecordMatches(
  reference: { recordId: string; revision: number; digest: string },
  record: { id: string; revision: number },
): boolean {
  return reference.recordId === record.id && reference.revision === record.revision &&
    reference.digest === canonicalDigest(record)
}

export class EvidenceRegistryService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly operatingModels: OperatingModelService,
    private readonly architectureChallengeModels: ArchitectureChallengeModelService,
    private readonly securityPrivacyAssessments: SecurityPrivacyAssessmentService,
    private readonly decisionRegisters: DecisionRegisterService,
    private readonly riskRegisters: RiskRegisterService,
  ) {}

  async create(inputValue: EvidenceRegistryInput, actorId: string): Promise<EvidenceRegistry> {
    const input = evidenceRegistryInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindingsAndTrace(input, product, initiative)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Evidence Registry candidate")
      }
      const now = new Date().toISOString()
      const record = evidenceRegistrySchema.parse({
        schemaVersion: 1,
        kind: "evidence-registry-candidate",
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
          "evidence-registry-is-a-candidate-record-and-does-not-establish-claim-validation-evidence-sufficiency-assurance-review-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority",
      })
      await this.commitVersionedRecord(record, "evidence.registry.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: EvidenceRegistryInput,
    actorId: string,
  ): Promise<EvidenceRegistry> {
    const input = evidenceRegistryInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Evidence Registry revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Evidence Registry Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindingsAndTrace(input, product, initiative)
      const record = evidenceRegistrySchema.parse({
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
      await this.commitVersionedRecord(record, "evidence.registry.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<EvidenceRegistry> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Evidence Registry ID")), evidenceRegistrySchema)
  }

  async readCurrent(initiativeId: string): Promise<EvidenceRegistry | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("evidence-registries", currentRecordPattern, evidenceRegistrySchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Evidence Registry candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<EvidenceRegistry> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Evidence Registry history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Evidence Registry ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), evidenceRegistrySchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Evidence Registry history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<EvidenceRegistry[]> {
    const recordId = this.requireUuid(id, "Evidence Registry ID")
    const records = await this.listRecords(
      "evidence-registry-history",
      new RegExp(`^evidence-registry-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      evidenceRegistrySchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Evidence Registry history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<EvidenceRegistryStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, registry, operatingModel, architectureChallengeModel,
      securityPrivacyAssessment, decisionRegister, riskRegister, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.operatingModels.readCurrent(targetId),
      this.architectureChallengeModels.readCurrent(targetId),
      this.securityPrivacyAssessments.readCurrent(targetId),
      this.decisionRegisters.readCurrent(targetId),
      this.riskRegisters.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const expectedContext: BusinessContextBinding = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    let staleBindingCount = 0
    if (registry) {
      if (canonicalDigest(registry.context) !== canonicalDigest(expectedContext)) staleBindingCount += 1
      if (!operatingModel || !exactRecordMatches(registry.operatingModel, operatingModel)) staleBindingCount += 1
      if (!architectureChallengeModel || !exactRecordMatches(registry.architectureChallengeModel, architectureChallengeModel)) staleBindingCount += 1
      if (!securityPrivacyAssessment || !exactRecordMatches(registry.securityPrivacyAssessment, securityPrivacyAssessment)) staleBindingCount += 1
      if (!decisionRegister || !exactRecordMatches(registry.decisionRegister, decisionRegister)) staleBindingCount += 1
      if (!riskRegister || !exactRecordMatches(registry.riskRegister, riskRegister)) staleBindingCount += 1
      if (registry.membershipDigest !== canonicalDigest(membership(registry))) staleBindingCount += 1
      for (const reference of uniqueSubjectReferences(registry)) {
        if (!(await this.subjectMatches(reference, product, initiative))) staleBindingCount += 1
      }
    }
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(registry).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const notAssessedClaimCount = registry?.claims.filter((claim) => claim.assessment.state === "not-assessed").length ?? 0
    const notAssessedEvidenceCount = registry?.evidenceItems.filter((evidence) => evidence.assessment.state === "not-assessed").length ?? 0
    const adverseEvidencePendingDispositionCount = registry?.evidenceItems.filter((evidence) =>
      evidence.outcome !== "favorable" && evidence.adverseDispositionState === "pending-governed-disposition").length ?? 0
    const staleOrUnknownEvidenceCount = registry?.evidenceItems.filter((evidence) =>
      evidence.freshness === "stale" || evidence.freshness === "potentially-stale" || evidence.freshness === "unknown").length ?? 0
    const invalidatedEvidenceCount = registry?.evidenceItems.filter((evidence) => evidence.validity === "invalidated").length ?? 0
    const unresolvedLinkCount = registry?.links.filter((link) =>
      link.sufficiencyState === "not-established" || link.acceptedForClaimState === "not-established").length ?? 0
    const unresolvedRequirementCount = registry?.requirementCoverage.filter((entry) => entry.state === "unresolved").length ?? 0
    const inconsistencyCount = registry?.inconsistencies.length ?? 0
    const unresolvedQuestionCount = registry?.unresolvedQuestions.length ?? 0
    const reasons: string[] = []
    if (!registry) reasons.push("No versioned Evidence Registry candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The Evidence Registry does not bind exact current Product, Initiative, operating, challenge, security/privacy, Decision Register, Risk Register, or governed subject records")
    if (staleSourceReferenceCount > 0) reasons.push("One or more Claims or Evidence Items reference a superseded Source revision")
    if (notAssessedClaimCount > 0) reasons.push("One or more Claims remain explicitly not assessed")
    if (notAssessedEvidenceCount > 0) reasons.push("One or more Evidence Items remain explicitly not assessed for declared use")
    if (adverseEvidencePendingDispositionCount > 0) reasons.push("One or more unfavorable, inconclusive, or neutral Evidence Items await governed disposition")
    if (staleOrUnknownEvidenceCount > 0) reasons.push("One or more Evidence Items have stale, potentially stale, or unknown freshness")
    if (invalidatedEvidenceCount > 0) reasons.push("One or more Evidence Items are invalidated")
    if (unresolvedRequirementCount > 0) reasons.push("One or more Evidence Registry requirements remain unresolved")
    if (inconsistencyCount > 0) reasons.push("The Evidence Registry records explicit inconsistencies")
    if (unresolvedQuestionCount > 0) reasons.push("The Evidence Registry records unresolved questions")
    return evidenceRegistryStatusSchema.parse({
      schemaVersion: 1,
      kind: "evidence-registry-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(registry ? { registry: exactReference(registry) } : {}),
      claimCount: registry?.claims.length ?? 0,
      evidenceItemCount: registry?.evidenceItems.length ?? 0,
      linkCount: registry?.links.length ?? 0,
      notAssessedClaimCount,
      notAssessedEvidenceCount,
      adverseEvidencePendingDispositionCount,
      staleOrUnknownEvidenceCount,
      invalidatedEvidenceCount,
      unresolvedLinkCount,
      unresolvedRequirementCount,
      staleBindingCount,
      staleSourceReferenceCount,
      inconsistencyCount,
      unresolvedQuestionCount,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "evidence-registry-status-reports-candidate-coverage-freshness-and-gaps-and-does-not-establish-claim-validation-evidence-sufficiency-assurance-approval-readiness-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<EvidenceRegistryProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, registry] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Evidence Registry projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "evidence-registry-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: {
        id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative),
        state: initiative.state,
      },
      status,
      ...(registry ? { registry: {
        id: registry.id,
        revision: registry.revision,
        digest: canonicalDigest(registry),
        membershipDigest: registry.membershipDigest,
        state: registry.state,
        claimCount: registry.claims.length,
        evidenceItemCount: registry.evidenceItems.length,
        linkCount: registry.links.length,
        updatedAt: registry.updatedAt,
      } } : {}),
      observedAt: new Date().toISOString(),
      privacyBoundary:
        "projection-contains-identities-counts-statuses-and-digests-only-not-claim-statements-evidence-observations-methods-warrants-quality-details-source-content-personal-data-secrets-or-credentials" as const,
      authorityBoundary:
        "evidence-registry-projection-does-not-establish-claim-validation-evidence-sufficiency-assurance-review-approval-risk-acceptance-readiness-or-action-authority" as const,
    }
    return evidenceRegistryProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const [product, records] = await Promise.all([
      this.readProduct(),
      this.listRecords("evidence-registries", currentRecordPattern, evidenceRegistrySchema),
    ])
    for (const registry of records) {
      try {
        const initiative = await this.readInitiative(registry.initiativeId)
        this.validateContext(registry.context, product, initiative)
        await this.validateSourceReferences(registry, initiative.id)
        await this.validateBindingsAndTrace(registry, product, initiative)
        if (registry.membershipDigest !== canonicalDigest(membership(registry))) {
          throw new Error("Evidence Registry membership digest is invalid")
        }
        const history = await this.listHistory(registry.id)
        if (history.length !== registry.revision || canonicalDigest(history[0]) !== canonicalDigest(registry)) {
          throw new Error("Current Evidence Registry does not match its complete immutable history")
        }
        const status = await this.assess(registry.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "evidence-registry.binding-review-required",
            severity: "warning",
            message: `Initiative ${registry.initiativeId} has stale Evidence Registry bindings.`,
            record: { type: registry.kind, id: registry.id, revision: registry.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "evidence-registry.invalid",
          severity: "error",
          message: `Evidence Registry ${registry.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: registry.kind, id: registry.id, revision: registry.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private async validateBindingsAndTrace(
    input: EvidenceRegistryInput,
    product: Product,
    initiative: Initiative,
  ): Promise<void> {
    const [operatingModel, architectureChallengeModel, securityPrivacyAssessment, decisionRegister, riskRegister] =
      await Promise.all([
        this.operatingModels.readCurrent(input.initiativeId),
        this.architectureChallengeModels.readCurrent(input.initiativeId),
        this.securityPrivacyAssessments.readCurrent(input.initiativeId),
        this.decisionRegisters.readCurrent(input.initiativeId),
        this.riskRegisters.readCurrent(input.initiativeId),
      ])
    if (!operatingModel || !exactRecordMatches(input.operatingModel, operatingModel)) {
      throw new Error("Evidence Registry must bind the exact current Operating Model")
    }
    if (!architectureChallengeModel || !exactRecordMatches(input.architectureChallengeModel, architectureChallengeModel)) {
      throw new Error("Evidence Registry must bind the exact current Architecture Challenge")
    }
    if (!securityPrivacyAssessment || !exactRecordMatches(input.securityPrivacyAssessment, securityPrivacyAssessment)) {
      throw new Error("Evidence Registry must bind the exact current Security, Privacy, and Threat Assessment")
    }
    if (!decisionRegister || !exactRecordMatches(input.decisionRegister, decisionRegister)) {
      throw new Error("Evidence Registry must bind the exact current Decision Register")
    }
    if (!riskRegister || !exactRecordMatches(input.riskRegister, riskRegister)) {
      throw new Error("Evidence Registry must bind the exact current Risk Register")
    }
    const roleKeys = new Set(operatingModel.roles.map((entry) => entry.key))
    if (input.claims.some((claim) => !roleKeys.has(claim.ownerRoleKey))) {
      throw new Error("Claim owner roles must reference exact bound Operating Model roles")
    }
    const riskKeys = new Set(riskRegister.risks.map((risk) => risk.key))
    if (input.claims.flatMap((claim) => claim.relatedRiskKeys).some((key) => !riskKeys.has(key))) {
      throw new Error("Claim risk references must bind exact Risk keys in the current Risk Register")
    }
    for (const reference of uniqueSubjectReferences(input)) {
      if (!(await this.subjectMatches(reference, product, initiative))) {
        throw new Error("Claim and Evidence subjects must bind exact governed records in the same Product and Initiative scope")
      }
    }
  }

  private async subjectMatches(
    reference: ExactDecisionSubjectReference,
    product: Product,
    initiative: Initiative,
  ): Promise<boolean> {
    try {
      if (reference.recordKind === "product") return exactRecordMatches(reference, { ...product, revision: revisionOf(product) })
      if (reference.recordKind === "initiative") return exactRecordMatches(reference, { ...initiative, revision: revisionOf(initiative) })
      const path = this.currentSubjectPath(reference)
      const record = await this.repository.readJson(path, subjectIdentitySchema)
      return exactRecordMatches(reference, record) &&
        (record.productId === undefined || record.productId === product.id) &&
        (record.initiativeId === undefined || record.initiativeId === initiative.id)
    } catch {
      return false
    }
  }

  private currentSubjectPath(reference: ExactDecisionSubjectReference): string {
    const directories: Record<ExactDecisionSubjectReference["recordKind"], string> = {
      "architecture-challenge-model": "architecture-challenge-models",
      "architecture-record": "architecture",
      "authorization-model": "authorization-models",
      "bounded-context-model": "bounded-context-models",
      "business-architecture-baseline": "business-architecture-baselines",
      "business-capability-map": "business-capability-maps",
      "business-rule-catalog": "business-rule-catalogs",
      "business-understanding": "business-understanding",
      "change": "changes",
      "data-model": "data-models",
      "decision-record": "decisions",
      "evidence-record": "evidence",
      "event-integration-model": "event-integration-models",
      "failure-recovery-model": "failure-recovery-models",
      "initiative": "initiatives",
      "operating-model": "operating-models",
      "outcome-model": "outcome-models",
      "process-model": "process-models",
      "product": "",
      "product-design-revision": "design-revisions",
      "requirement": "requirements",
      "risk-record": "risks",
      "security-privacy-assessment": "security-privacy-assessments",
      "source-record": "sources",
      "stakeholder-model": "stakeholder-models",
      "system-solution-architecture": "system-solution-architectures",
      "value-stream-model": "value-stream-models",
      "work-item": "work-items",
    }
    const directory = directories[reference.recordKind]
    if (!directory) throw new Error(`Evidence subject kind ${reference.recordKind} has no current record directory`)
    return this.repository.resolve(directory, `${reference.recordId}.json`)
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Evidence Registry Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Evidence Registry must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Evidence Registry Source reference identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Evidence Registry is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: EvidenceRegistry, eventType: string, actorId: string): Promise<void> {
    const notAssessedClaimCount = record.claims.filter((claim) => claim.assessment.state === "not-assessed").length
    const notAssessedEvidenceCount = record.evidenceItems.filter((evidence) => evidence.assessment.state === "not-assessed").length
    const staleOrUnknownEvidenceCount = record.evidenceItems.filter((evidence) =>
      evidence.freshness === "stale" || evidence.freshness === "potentially-stale" || evidence.freshness === "unknown").length
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, evidenceRegistrySchema),
        this.governed(this.historyPath(record.id, record.revision), record, evidenceRegistrySchema),
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
          claimCount: record.claims.length,
          evidenceItemCount: record.evidenceItems.length,
          linkCount: record.links.length,
          notAssessedClaimCount,
          notAssessedEvidenceCount,
          staleOrUnknownEvidenceCount,
          claimValidationState: "not-established",
          evidenceSufficiencyState: "not-established",
          assuranceState: "not-established",
          reviewState: "not-established",
          approvalState: "not-established",
          riskAcceptanceState: "not-granted",
          baselinePromotionState: "not-granted",
          readinessState: "not-established",
          actionAuthorityState: "not-granted",
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("evidence-registries", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("evidence-registry-history", `evidence-registry-${id}-r${revision}.json`)
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
    if (names.length > evidenceRegistryInventoryLimit) {
      throw new Error(`Evidence Registry directory ${directory} exceeds the ${evidenceRegistryInventoryLimit}-record safety limit`)
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
