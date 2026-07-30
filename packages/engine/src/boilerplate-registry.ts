import { randomUUID } from "node:crypto"

import {
  boilerplateRegistryInputSchema,
  boilerplateRegistryProjectionSchema,
  boilerplateRegistrySchema,
  boilerplateRegistryStatusSchema,
  type BoilerplateRegistry,
  type BoilerplateRegistryInput,
  type BoilerplateRegistryProjection,
  type BoilerplateRegistryStatus,
  type BusinessContextBinding,
  type ImplementationUnitModel,
  type Initiative,
  type Product,
  type TechnologyProfile,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { ImplementationUnitModelService } from "./implementation-unit-model.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { TechnologyProfileService } from "./technology-profile.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "boilerplate-registry-is-a-versioned-candidate-and-does-not-establish-organizational-designation-endorsement-approval-support-commitment-compatibility-truth-or-completeness-licensing-or-security-approval-exception-waiver-selection-binding-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "boilerplate-registry-status-is-observational-and-does-not-establish-organizational-designation-endorsement-approval-support-commitment-compatibility-truth-or-completeness-licensing-or-security-approval-exception-waiver-selection-binding-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "boilerplate-registry-projection-is-read-only-and-does-not-establish-organizational-designation-endorsement-approval-support-commitment-compatibility-truth-or-completeness-licensing-or-security-approval-exception-waiver-selection-binding-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-counts-statuses-and-entry-source-compatibility-assessment-snapshot-digests-only-not-boilerplate-names-locators-versions-capabilities-limitations-evidence-rationale-technology-unit-architecture-repository-template-license-security-policy-personal-data-secrets-credentials-or-machine-paths" as const

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: BoilerplateRegistry) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

interface ExactDependencies {
  units: ImplementationUnitModel
  technologyProfile: TechnologyProfile
}

interface EntryAssessment {
  missingEvidenceCount: number
  unavailableEntryCount: number
  integrityMismatchCount: number
  provenanceGapCount: number
  unsupportedEntryCount: number
  lifecycleRiskCount: number
  technologyConflictCount: number
  architectureConflictCount: number
  licenseReviewRequiredCount: number
  licenseProhibitedCount: number
  securityReviewRequiredCount: number
  securityNonconformantCount: number
  exceptionCandidateCount: number
  invalidRegistryCount: number
}

export class BoilerplateRegistryService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly implementationUnitModel: ImplementationUnitModelService,
    private readonly technologyProfile: TechnologyProfileService,
  ) {}

  async create(inputValue: BoilerplateRegistryInput, actorId: string): Promise<BoilerplateRegistry> {
    const input = boilerplateRegistryInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input, initiative)
      const assessment = this.assessEntries(input, dependencies)
      this.requireValidRegistry(input, assessment)
      if (await this.readCurrent(initiative.id)) throw new Error("An Initiative can have only one current Boilerplate Registry candidate")
      const now = new Date().toISOString()
      const record = boilerplateRegistrySchema.parse({
        schemaVersion: 1, kind: "boilerplate-registry-candidate", id: randomUUID(), productId: product.id,
        ...input, initiativeId: initiative.id, revision: 1, ...this.composeDigests(input), state: "candidate",
        createdBy: { kind: "human", id: actorId }, updatedBy: { kind: "human", id: actorId },
        createdAt: now, updatedAt: now, authorityBoundary,
      })
      await this.commitVersionedRecord(record, assessment, "boilerplate-registry.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: BoilerplateRegistryInput, actorId: string): Promise<BoilerplateRegistry> {
    const input = boilerplateRegistryInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Boilerplate Registry revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Boilerplate Registry Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input, initiative)
      const assessment = this.assessEntries(input, dependencies)
      this.requireValidRegistry(input, assessment)
      const record = boilerplateRegistrySchema.parse({
        ...current, ...input, productId: product.id, initiativeId: initiative.id, revision: current.revision + 1,
        ...this.composeDigests(input), predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId }, updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, assessment, "boilerplate-registry.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<BoilerplateRegistry> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Boilerplate Registry ID")), boilerplateRegistrySchema)
  }

  async readCurrent(initiativeId: string): Promise<BoilerplateRegistry | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("boilerplate-registries", currentRecordPattern, boilerplateRegistrySchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Boilerplate Registry candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<BoilerplateRegistry> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Boilerplate Registry history revision must be a positive integer")
    const recordId = this.requireUuid(id, "Boilerplate Registry ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), boilerplateRegistrySchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Boilerplate Registry history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<BoilerplateRegistry[]> {
    const recordId = this.requireUuid(id, "Boilerplate Registry ID")
    const records = await this.listRecords(
      "boilerplate-registry-history",
      new RegExp(`^boilerplate-registry-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      boilerplateRegistrySchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Boilerplate Registry history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<BoilerplateRegistryStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, units, technologyProfile] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId),
      this.implementationUnitModel.readCurrent(targetId), this.technologyProfile.readCurrent(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const staleBindingCount = candidate && canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative)) ? 1 : 0
    const staleImplementationUnitModelCount = candidate && !this.matches(candidate.implementationUnitModel, units) ? 1 : 0
    const staleTechnologyProfileCount = candidate && !this.matches(candidate.technologyProfile, technologyProfile) ? 1 : 0
    const baseAssessment = candidate && units && technologyProfile
      ? this.assessEntries(candidate, { units, technologyProfile })
      : this.emptyAssessment()
    let invalidRegistryCount = baseAssessment.invalidRegistryCount
    if (candidate) {
      const digests = this.composeDigests(candidate)
      if (candidate.entryCatalogDigest !== digests.entryCatalogDigest ||
          candidate.sourceCatalogDigest !== digests.sourceCatalogDigest ||
          candidate.compatibilityAssessmentReceiptDigest !== digests.compatibilityAssessmentReceiptDigest ||
          candidate.assessmentReceiptDigest !== digests.assessmentReceiptDigest) invalidRegistryCount += 1
    }
    const entries = candidate?.entries ?? []
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Boilerplate Registry candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind the exact current Product and Initiative")
    if (staleImplementationUnitModelCount > 0) reasons.push("The candidate does not bind the exact current Implementation Unit Model")
    if (staleTechnologyProfileCount > 0) reasons.push("The candidate does not bind the exact current Technology Profile")
    if (invalidRegistryCount > 0) reasons.push("One or more Boilerplate Registry entries, references, ordering rules, or integrity digests are invalid")
    if (baseAssessment.missingEvidenceCount > 0) reasons.push("Architecture or boilerplate evidence is missing")
    if (entries.some((entry) => entry.versionState === "range-candidate")) reasons.push("One or more boilerplate entries use a version range instead of an exact candidate version")
    if (entries.some((entry) => entry.versionState === "unresolved")) reasons.push("One or more boilerplate versions are unresolved")
    if (baseAssessment.unavailableEntryCount > 0) reasons.push("One or more candidate boilerplates are missing, inaccessible, or not assessed")
    if (baseAssessment.integrityMismatchCount > 0) reasons.push("One or more candidate boilerplates lack verified integrity or have an integrity mismatch")
    if (baseAssessment.provenanceGapCount > 0) reasons.push("One or more candidate boilerplates lack traceable provenance")
    if (baseAssessment.unsupportedEntryCount > 0) reasons.push("One or more candidate boilerplates are unsupported or not assessed")
    if (baseAssessment.lifecycleRiskCount > 0) reasons.push("One or more candidate boilerplates have deprecated, end-of-life, or unknown lifecycle state")
    if (baseAssessment.technologyConflictCount > 0) reasons.push("One or more candidate boilerplates conflict with the current Technology Profile")
    if (baseAssessment.architectureConflictCount > 0) reasons.push("One or more candidate boilerplates conflict with current architecture evidence")
    if (baseAssessment.licenseReviewRequiredCount > 0) reasons.push("One or more candidate boilerplates require accountable license review")
    if (baseAssessment.licenseProhibitedCount > 0) reasons.push("One or more candidate boilerplates have a candidate-prohibited license state")
    if (baseAssessment.securityReviewRequiredCount > 0) reasons.push("One or more candidate boilerplates require accountable security-policy review")
    if (baseAssessment.securityNonconformantCount > 0) reasons.push("One or more candidate boilerplates are candidate-nonconformant with security policy")
    if (baseAssessment.exceptionCandidateCount > 0) reasons.push("One or more candidate boilerplates require an accountable exception decision")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved Boilerplate Registry questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return boilerplateRegistryStatusSchema.parse({
      schemaVersion: 1, kind: "boilerplate-registry-status", productId: product.id,
      productRevision: revisionOf(product), initiativeId: initiative.id, initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate), implementationUnitModel: candidate.implementationUnitModel, technologyProfile: candidate.technologyProfile } : {}),
      entryCount: entries.length,
      exactVersionCandidateCount: entries.filter((entry) => entry.versionState === "exact-candidate").length,
      rangeVersionCandidateCount: entries.filter((entry) => entry.versionState === "range-candidate").length,
      unresolvedVersionCount: entries.filter((entry) => entry.versionState === "unresolved").length,
      mandatoryCandidateCount: entries.filter((entry) => entry.applicabilityState === "candidate-mandatory").length,
      ...baseAssessment, invalidRegistryCount, staleBindingCount, staleImplementationUnitModelCount,
      staleTechnologyProfileCount, unresolvedQuestionCount, reviewState,
      state: reasons.length === 0 ? "candidate-complete" : "attention-required", reasons,
      assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary,
    })
  }

  async project(initiativeId: string): Promise<BoilerplateRegistryProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Boilerplate Registry projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const, kind: "boilerplate-registry-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        entryCatalogDigest: candidate.entryCatalogDigest, sourceCatalogDigest: candidate.sourceCatalogDigest,
        compatibilityAssessmentReceiptDigest: candidate.compatibilityAssessmentReceiptDigest,
        assessmentReceiptDigest: candidate.assessmentReceiptDigest, entryCount: candidate.entries.length,
        mandatoryCandidateCount: candidate.entries.filter((entry) => entry.applicabilityState === "candidate-mandatory").length,
        reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary,
    }
    return boilerplateRegistryProjectionSchema.parse({ ...projectionWithoutDigest, snapshotDigest: canonicalDigest(projectionWithoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("boilerplate-registries", currentRecordPattern, boilerplateRegistrySchema)
    for (const candidate of records) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Boilerplate Registry candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        const gapCount = status.rangeVersionCandidateCount + status.unresolvedVersionCount + status.missingEvidenceCount +
          status.unavailableEntryCount + status.integrityMismatchCount + status.provenanceGapCount +
          status.unsupportedEntryCount + status.lifecycleRiskCount + status.technologyConflictCount +
          status.architectureConflictCount + status.licenseReviewRequiredCount + status.licenseProhibitedCount +
          status.securityReviewRequiredCount + status.securityNonconformantCount + status.exceptionCandidateCount +
          status.staleBindingCount + status.staleImplementationUnitModelCount + status.staleTechnologyProfileCount +
          status.invalidRegistryCount
        if (gapCount > 0) {
          issues.push({
            code: "boilerplate-registry.binding-review-required", severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale, unavailable, invalid, unsupported, incompatible, or policy-unreviewed Boilerplate Registry candidates.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "boilerplate-registry.invalid", severity: "error",
          message: `Boilerplate Registry ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private assessEntries(input: Pick<BoilerplateRegistryInput, "entries" | "architectureEvidenceReferences">, dependencies: ExactDependencies): EntryAssessment {
    const unitIds = new Set(dependencies.units.units.map((unit) => unit.id))
    const profileIds = new Set(dependencies.technologyProfile.profiles.map((profile) => profile.id))
    let invalidRegistryCount = 0
    const sourceKeys = new Set<string>()
    for (const [index, entry] of input.entries.entries()) {
      const sourceKey = `${entry.sourceKind}:${entry.sourceReference}:${entry.versionCandidate}`
      if (sourceKeys.has(sourceKey) || entry.ordinal !== index + 1 || entry.applicableTechnologyProfileIds.length === 0 ||
          entry.applicableTechnologyProfileIds.some((id) => !profileIds.has(id)) ||
          entry.applicableImplementationUnitIds.some((id) => !unitIds.has(id))) invalidRegistryCount += 1
      sourceKeys.add(sourceKey)
    }
    return {
      missingEvidenceCount: (input.architectureEvidenceReferences.length === 0 ? 1 : 0) + input.entries.filter((entry) => entry.evidenceReferences.length === 0).length,
      unavailableEntryCount: input.entries.filter((entry) => entry.availabilityState !== "candidate-available").length,
      integrityMismatchCount: input.entries.filter((entry) => entry.integrityState !== "candidate-verified").length,
      provenanceGapCount: input.entries.filter((entry) => entry.provenanceState !== "candidate-traceable").length,
      unsupportedEntryCount: input.entries.filter((entry) => entry.supportState !== "candidate-supported").length,
      lifecycleRiskCount: input.entries.filter((entry) => ["deprecated", "end-of-life", "unknown"].includes(entry.lifecycleState)).length,
      technologyConflictCount: input.entries.filter((entry) => entry.technologyCompatibilityState !== "candidate-compatible").length,
      architectureConflictCount: input.entries.filter((entry) => entry.architectureCompatibilityState !== "candidate-compatible").length,
      licenseReviewRequiredCount: input.entries.filter((entry) => ["candidate-review-required", "not-assessed"].includes(entry.licenseState)).length,
      licenseProhibitedCount: input.entries.filter((entry) => entry.licenseState === "candidate-prohibited").length,
      securityReviewRequiredCount: input.entries.filter((entry) => ["candidate-review-required", "not-assessed"].includes(entry.securityPolicyState)).length,
      securityNonconformantCount: input.entries.filter((entry) => entry.securityPolicyState === "candidate-nonconformant").length,
      exceptionCandidateCount: input.entries.filter((entry) => entry.exceptionState !== "not-required-candidate").length,
      invalidRegistryCount,
    }
  }

  private requireValidRegistry(input: BoilerplateRegistryInput, assessment: EntryAssessment): void {
    const rangeOrUnresolvedVersionCount = input.entries.filter((entry) => entry.versionState !== "exact-candidate").length
    const gapCount = Object.values(assessment).reduce((sum, count) => sum + count, 0) + rangeOrUnresolvedVersionCount
    if (input.reviewState === "ready-for-human-review" && gapCount > 0) {
      throw new Error("Review-ready Boilerplate Registry requires exact current dependencies and exact available integrity-verified traceable supported lifecycle-safe technology-compatible architecture-compatible license-safe security-conformant evidence-backed entries")
    }
  }

  private emptyAssessment(): EntryAssessment {
    return {
      missingEvidenceCount: 0, unavailableEntryCount: 0, integrityMismatchCount: 0, provenanceGapCount: 0,
      unsupportedEntryCount: 0, lifecycleRiskCount: 0, technologyConflictCount: 0, architectureConflictCount: 0,
      licenseReviewRequiredCount: 0, licenseProhibitedCount: 0, securityReviewRequiredCount: 0,
      securityNonconformantCount: 0, exceptionCandidateCount: 0, invalidRegistryCount: 0,
    }
  }

  private composeDigests(input: BoilerplateRegistryInput) {
    const entryCatalogDigest = canonicalDigest(input.entries)
    const sourceCatalogDigest = canonicalDigest(input.entries.map((entry) => ({
      id: entry.id, sourceKind: entry.sourceKind, sourceReference: entry.sourceReference,
      versionCandidate: entry.versionCandidate, versionState: entry.versionState,
      integrityState: entry.integrityState, provenanceState: entry.provenanceState,
    })))
    const compatibilityAssessmentReceiptDigest = canonicalDigest({
      implementationUnitModel: input.implementationUnitModel, technologyProfile: input.technologyProfile,
      architectureEvidenceReferences: input.architectureEvidenceReferences,
      entries: input.entries.map((entry) => ({
        id: entry.id, applicableTechnologyProfileIds: entry.applicableTechnologyProfileIds,
        applicableImplementationUnitIds: entry.applicableImplementationUnitIds,
        applicabilityState: entry.applicabilityState, availabilityState: entry.availabilityState,
        supportState: entry.supportState, lifecycleState: entry.lifecycleState,
        technologyCompatibilityState: entry.technologyCompatibilityState,
        architectureCompatibilityState: entry.architectureCompatibilityState,
        licenseState: entry.licenseState, securityPolicyState: entry.securityPolicyState,
        exceptionState: entry.exceptionState, evidenceReferences: entry.evidenceReferences,
      })),
    })
    const assessmentReceiptDigest = canonicalDigest({
      context: input.context, implementationUnitModel: input.implementationUnitModel,
      technologyProfile: input.technologyProfile, entryCatalogDigest, sourceCatalogDigest,
      compatibilityAssessmentReceiptDigest, reviewState: input.reviewState,
      unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations,
      organizationalDesignationState: input.organizationalDesignationState,
      endorsementApprovalState: input.endorsementApprovalState, supportCommitmentState: input.supportCommitmentState,
      compatibilityTruthState: input.compatibilityTruthState,
      compatibilityCompletenessState: input.compatibilityCompletenessState,
      licensingApprovalState: input.licensingApprovalState, securityApprovalState: input.securityApprovalState,
      exceptionWaiverState: input.exceptionWaiverState, selectionBindingState: input.selectionBindingState,
      architectureBaselineDesignationState: input.architectureBaselineDesignationState,
      implementationReadinessState: input.implementationReadinessState,
      implementationCompletenessState: input.implementationCompletenessState,
      assignmentExecutionState: input.assignmentExecutionState,
      acceptanceDecisionState: input.acceptanceDecisionState, mergeReadinessState: input.mergeReadinessState,
      releaseReadinessState: input.releaseReadinessState, deploymentReadinessState: input.deploymentReadinessState,
      actionAuthorityState: input.actionAuthorityState,
    })
    return { entryCatalogDigest, sourceCatalogDigest, compatibilityAssessmentReceiptDigest, assessmentReceiptDigest }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Boilerplate Registry Initiative targets a different Product")
    if (canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) {
      throw new Error("Boilerplate Registry must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return { productRevision: revisionOf(product), productDigest: canonicalDigest(product), initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) }
  }

  private async requireExactDependencies(input: BoilerplateRegistryInput, initiative: Initiative): Promise<ExactDependencies> {
    const [units, technologyProfile] = await Promise.all([
      this.implementationUnitModel.readCurrent(initiative.id), this.technologyProfile.readCurrent(initiative.id),
    ])
    if (!this.matches(input.implementationUnitModel, units)) throw new Error("Boilerplate Registry must reference the exact current Implementation Unit Model candidate")
    if (!this.matches(input.technologyProfile, technologyProfile)) throw new Error("Boilerplate Registry must reference the exact current Technology Profile candidate")
    if (!technologyProfile || canonicalDigest(technologyProfile.implementationUnitModel) !== canonicalDigest(input.implementationUnitModel)) {
      throw new Error("Boilerplate Registry dependencies do not share the exact current Implementation Unit Model")
    }
    return { units: units!, technologyProfile }
  }

  private matches(reference: { recordId: string; revision: number; digest: string }, record: { id: string; revision: number } | undefined): boolean {
    return !!record && record.id === reference.recordId && record.revision === reference.revision && canonicalDigest(record) === reference.digest
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Boilerplate Registry is immutable`)
    return { product, initiative }
  }

  private async commitVersionedRecord(record: BoilerplateRegistry, assessment: EntryAssessment, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, boilerplateRegistrySchema),
        this.governed(this.historyPath(record.id, record.revision), record, boilerplateRegistrySchema),
      ],
      audit: {
        eventType, actor: { kind: "human", id: actorId }, subjectId: record.id,
        payload: {
          initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record),
          entryCatalogDigest: record.entryCatalogDigest, sourceCatalogDigest: record.sourceCatalogDigest,
          compatibilityAssessmentReceiptDigest: record.compatibilityAssessmentReceiptDigest,
          assessmentReceiptDigest: record.assessmentReceiptDigest, predecessorDigest: record.predecessorDigest,
          implementationUnitModel: record.implementationUnitModel, technologyProfile: record.technologyProfile,
          architectureEvidenceCount: record.architectureEvidenceReferences.length, entryCount: record.entries.length,
          exactVersionCandidateCount: record.entries.filter((entry) => entry.versionState === "exact-candidate").length,
          mandatoryCandidateCount: record.entries.filter((entry) => entry.applicabilityState === "candidate-mandatory").length,
          ...assessment, reviewState: record.reviewState,
          organizationalDesignationState: record.organizationalDesignationState,
          endorsementApprovalState: record.endorsementApprovalState,
          supportCommitmentState: record.supportCommitmentState,
          compatibilityTruthState: record.compatibilityTruthState,
          compatibilityCompletenessState: record.compatibilityCompletenessState,
          licensingApprovalState: record.licensingApprovalState, securityApprovalState: record.securityApprovalState,
          exceptionWaiverState: record.exceptionWaiverState, selectionBindingState: record.selectionBindingState,
          architectureBaselineDesignationState: record.architectureBaselineDesignationState,
          implementationReadinessState: record.implementationReadinessState,
          implementationCompletenessState: record.implementationCompletenessState,
          assignmentExecutionState: record.assignmentExecutionState,
          acceptanceDecisionState: record.acceptanceDecisionState, mergeReadinessState: record.mergeReadinessState,
          releaseReadinessState: record.releaseReadinessState, deploymentReadinessState: record.deploymentReadinessState,
          actionAuthorityState: record.actionAuthorityState, authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string { return this.repository.resolve("boilerplate-registries", `${id}.json`) }
  private historyPath(id: string, revision: number): string { return this.repository.resolve("boilerplate-registry-history", `boilerplate-registry-${id}-r${revision}.json`) }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
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
    if (names.length > inventoryLimit) throw new Error(`Boilerplate Registry directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
