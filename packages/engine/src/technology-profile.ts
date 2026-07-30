import { randomUUID } from "node:crypto"

import {
  technologyProfileInputSchema,
  technologyProfileProjectionSchema,
  technologyProfileSchema,
  technologyProfileStatusSchema,
  type BusinessContextBinding,
  type DependencyMapping,
  type ImplementationUnitModel,
  type Initiative,
  type Product,
  type TechnologyProfile,
  type TechnologyProfileInput,
  type TechnologyProfileProjection,
  type TechnologyProfileStatus,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { DependencyMappingService } from "./dependency-mapping.js"
import type { ImplementationUnitModelService } from "./implementation-unit-model.js"
import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "technology-profile-is-a-versioned-candidate-and-does-not-establish-technology-approval-support-commitment-compatibility-truth-or-completeness-licensing-or-security-approval-exception-waiver-authority-architecture-baseline-designation-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "technology-profile-status-is-observational-and-does-not-establish-technology-approval-support-commitment-compatibility-truth-or-completeness-licensing-or-security-approval-exception-waiver-authority-architecture-baseline-designation-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "technology-profile-projection-is-read-only-and-does-not-establish-technology-approval-support-commitment-compatibility-truth-or-completeness-licensing-or-security-approval-exception-waiver-authority-architecture-baseline-designation-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-counts-statuses-and-profile-selection-compatibility-assessment-snapshot-digests-only-not-technology-names-versions-constraints-evidence-rationale-unit-architecture-repository-toolchain-license-security-policy-personal-data-secrets-credentials-or-machine-paths" as const

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: TechnologyProfile) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

interface ExactDependencies {
  units: ImplementationUnitModel
  dependencyMapping: DependencyMapping
}

interface ProfileAssessment {
  missingProfileCount: number
  invalidProfileCount: number
  missingEvidenceCount: number
  unsupportedChoiceCount: number
  lifecycleRiskCount: number
  compatibilityConflictCount: number
  licenseReviewRequiredCount: number
  licenseProhibitedCount: number
  securityReviewRequiredCount: number
  securityNonconformantCount: number
  exceptionCandidateCount: number
  constraintConflictCount: number
}

export class TechnologyProfileService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly implementationUnitModel: ImplementationUnitModelService,
    private readonly dependencyMapping: DependencyMappingService,
  ) {}

  async create(inputValue: TechnologyProfileInput, actorId: string): Promise<TechnologyProfile> {
    const input = technologyProfileInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input, initiative)
      const assessment = this.assessProfiles(input, dependencies.units)
      this.requireValidProfiles(input, assessment)
      if (await this.readCurrent(initiative.id)) throw new Error("An Initiative can have only one current Technology Profile candidate")
      const now = new Date().toISOString()
      const record = technologyProfileSchema.parse({
        schemaVersion: 1,
        kind: "technology-profile-candidate",
        id: randomUUID(),
        productId: product.id,
        ...input,
        initiativeId: initiative.id,
        revision: 1,
        ...this.composeDigests(input),
        state: "candidate",
        createdBy: { kind: "human", id: actorId },
        updatedBy: { kind: "human", id: actorId },
        createdAt: now,
        updatedAt: now,
        authorityBoundary,
      })
      await this.commitVersionedRecord(record, assessment, "technology-profile.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: TechnologyProfileInput, actorId: string): Promise<TechnologyProfile> {
    const input = technologyProfileInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Technology Profile revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Technology Profile Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input, initiative)
      const assessment = this.assessProfiles(input, dependencies.units)
      this.requireValidProfiles(input, assessment)
      const record = technologyProfileSchema.parse({
        ...current,
        ...input,
        productId: product.id,
        initiativeId: initiative.id,
        revision: current.revision + 1,
        ...this.composeDigests(input),
        predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId },
        updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, assessment, "technology-profile.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<TechnologyProfile> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Technology Profile ID")), technologyProfileSchema)
  }

  async readCurrent(initiativeId: string): Promise<TechnologyProfile | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("technology-profiles", currentRecordPattern, technologyProfileSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Technology Profile candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<TechnologyProfile> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Technology Profile history revision must be a positive integer")
    const recordId = this.requireUuid(id, "Technology Profile ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), technologyProfileSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Technology Profile history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<TechnologyProfile[]> {
    const recordId = this.requireUuid(id, "Technology Profile ID")
    const records = await this.listRecords(
      "technology-profile-history",
      new RegExp(`^technology-profile-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      technologyProfileSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Technology Profile history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<TechnologyProfileStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, units, mapping] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId),
      this.implementationUnitModel.readCurrent(targetId), this.dependencyMapping.readCurrent(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const staleBindingCount = candidate && canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative)) ? 1 : 0
    const staleImplementationUnitModelCount = candidate && !this.matches(candidate.implementationUnitModel, units) ? 1 : 0
    const staleDependencyMappingCount = candidate && !this.matches(candidate.dependencyMapping, mapping) ? 1 : 0
    const baseAssessment = candidate && units ? this.assessProfiles(candidate, units) : this.emptyAssessment()
    let invalidProfileCount = baseAssessment.invalidProfileCount
    if (candidate) {
      const digests = this.composeDigests(candidate)
      if (candidate.profileCatalogDigest !== digests.profileCatalogDigest ||
          candidate.selectionCatalogDigest !== digests.selectionCatalogDigest ||
          candidate.compatibilityAssessmentReceiptDigest !== digests.compatibilityAssessmentReceiptDigest ||
          candidate.assessmentReceiptDigest !== digests.assessmentReceiptDigest) invalidProfileCount += 1
    }
    const profiles = candidate?.profiles ?? []
    const choices = profiles.flatMap((profile) => profile.choices)
    const constraints = profiles.flatMap((profile) => profile.constraints)
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Technology Profile candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind the exact current Product and Initiative")
    if (staleImplementationUnitModelCount > 0) reasons.push("The candidate does not bind the exact current Implementation Unit Model")
    if (staleDependencyMappingCount > 0) reasons.push("The candidate does not bind the exact current Dependency Mapping")
    if (baseAssessment.missingProfileCount > 0) reasons.push("One or more exact current implementation units lack a Technology Profile")
    if (invalidProfileCount > 0) reasons.push("One or more Technology Profiles, choices, constraints, ordering rules, or integrity digests are invalid")
    if (baseAssessment.missingEvidenceCount > 0) reasons.push("Architecture, technology-choice, or constraint evidence is missing")
    if (choices.some((choice) => choice.versionState === "range-candidate")) reasons.push("One or more technology choices use a version range instead of an exact candidate version")
    if (choices.some((choice) => choice.versionState === "unresolved")) reasons.push("One or more technology versions are unresolved")
    if (baseAssessment.unsupportedChoiceCount > 0) reasons.push("One or more technology choices are unsupported candidates")
    if (baseAssessment.lifecycleRiskCount > 0) reasons.push("One or more technology choices have deprecated, end-of-life, or unknown lifecycle state")
    if (baseAssessment.compatibilityConflictCount > 0) reasons.push("One or more technology choices have candidate compatibility conflicts")
    if (baseAssessment.licenseReviewRequiredCount > 0) reasons.push("One or more technology choices require accountable license review")
    if (baseAssessment.licenseProhibitedCount > 0) reasons.push("One or more technology choices have a candidate-prohibited license state")
    if (baseAssessment.securityReviewRequiredCount > 0) reasons.push("One or more technology choices require accountable security-policy review")
    if (baseAssessment.securityNonconformantCount > 0) reasons.push("One or more technology choices are candidate-nonconformant with security policy")
    if (baseAssessment.exceptionCandidateCount > 0) reasons.push("One or more technology choices require an accountable exception or experimental-use decision")
    if (baseAssessment.constraintConflictCount > 0) reasons.push("One or more technology constraints are conflicting or not assessed")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved Technology Profile questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return technologyProfileStatusSchema.parse({
      schemaVersion: 1,
      kind: "technology-profile-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? {
        candidate: exactReference(candidate), implementationUnitModel: candidate.implementationUnitModel,
        dependencyMapping: candidate.dependencyMapping,
      } : {}),
      unitProfileCount: profiles.length,
      technologyChoiceCount: choices.length,
      exactVersionCandidateCount: choices.filter((choice) => choice.versionState === "exact-candidate").length,
      rangeVersionCandidateCount: choices.filter((choice) => choice.versionState === "range-candidate").length,
      unresolvedVersionCount: choices.filter((choice) => choice.versionState === "unresolved").length,
      constraintCount: constraints.length,
      ...baseAssessment,
      invalidProfileCount,
      staleBindingCount,
      staleImplementationUnitModelCount,
      staleDependencyMappingCount,
      unresolvedQuestionCount,
      reviewState,
      state: reasons.length === 0 ? "candidate-complete" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary: statusAuthorityBoundary,
    })
  }

  async project(initiativeId: string): Promise<TechnologyProfileProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Technology Profile projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "technology-profile-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        profileCatalogDigest: candidate.profileCatalogDigest, selectionCatalogDigest: candidate.selectionCatalogDigest,
        compatibilityAssessmentReceiptDigest: candidate.compatibilityAssessmentReceiptDigest,
        assessmentReceiptDigest: candidate.assessmentReceiptDigest,
        unitProfileCount: candidate.profiles.length,
        technologyChoiceCount: candidate.profiles.reduce((sum, profile) => sum + profile.choices.length, 0),
        constraintCount: candidate.profiles.reduce((sum, profile) => sum + profile.constraints.length, 0),
        reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary,
      authorityBoundary: projectionAuthorityBoundary,
    }
    return technologyProfileProjectionSchema.parse({ ...projectionWithoutDigest, snapshotDigest: canonicalDigest(projectionWithoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("technology-profiles", currentRecordPattern, technologyProfileSchema)
    for (const candidate of records) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Technology Profile candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        const gapCount = status.missingProfileCount + status.invalidProfileCount + status.missingEvidenceCount +
          status.unsupportedChoiceCount + status.lifecycleRiskCount + status.compatibilityConflictCount +
          status.licenseReviewRequiredCount + status.licenseProhibitedCount + status.securityReviewRequiredCount +
          status.securityNonconformantCount + status.exceptionCandidateCount + status.constraintConflictCount +
          status.staleBindingCount + status.staleImplementationUnitModelCount + status.staleDependencyMappingCount +
          status.rangeVersionCandidateCount + status.unresolvedVersionCount
        if (gapCount > 0) {
          issues.push({
            code: "technology-profile.binding-review-required", severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale or invalid Technology Profile bindings or assessments.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "technology-profile.invalid", severity: "error",
          message: `Technology Profile ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private assessProfiles(input: Pick<TechnologyProfileInput, "profiles" | "architectureEvidenceReferences">, units: ImplementationUnitModel): ProfileAssessment {
    const expectedUnitIds = units.units.map((unit) => unit.id)
    const expectedUnitSet = new Set(expectedUnitIds)
    const actualUnitIds = input.profiles.map((profile) => profile.implementationUnitId)
    const actualUnitSet = new Set(actualUnitIds)
    const missingProfileCount = expectedUnitIds.filter((id) => !actualUnitSet.has(id)).length
    let invalidProfileCount = input.profiles.filter((profile) => !expectedUnitSet.has(profile.implementationUnitId)).length
    for (const [index, profile] of input.profiles.entries()) {
      if (expectedUnitIds[index] !== profile.implementationUnitId || profile.ordinal !== index + 1 ||
          profile.choices.some((choice, choiceIndex) => choice.ordinal !== choiceIndex + 1 ||
            choice.selectionState !== "candidate-selected" ||
            ["candidate-prohibited", "not-assessed", "unregistered"].includes(choice.registryStatus) ||
            choice.supportState === "not-assessed" || choice.supportState === "unknown" ||
            choice.compatibilityState === "not-assessed" || choice.licenseState === "not-assessed" ||
            choice.securityPolicyState === "not-assessed") ||
          profile.constraints.some((constraint, constraintIndex) => constraint.ordinal !== constraintIndex + 1)) {
        invalidProfileCount += 1
      }
    }
    const choices = input.profiles.flatMap((profile) => profile.choices)
    const constraints = input.profiles.flatMap((profile) => profile.constraints)
    return {
      missingProfileCount,
      invalidProfileCount,
      missingEvidenceCount: (input.architectureEvidenceReferences.length === 0 ? 1 : 0) +
        choices.filter((choice) => choice.evidenceReferences.length === 0).length +
        constraints.filter((constraint) => constraint.evidenceReferences.length === 0).length,
      unsupportedChoiceCount: choices.filter((choice) => choice.supportState === "candidate-unsupported").length,
      lifecycleRiskCount: choices.filter((choice) => ["deprecated", "end-of-life", "unknown"].includes(choice.lifecycleState)).length,
      compatibilityConflictCount: choices.filter((choice) => choice.compatibilityState === "candidate-conflict").length,
      licenseReviewRequiredCount: choices.filter((choice) => choice.licenseState === "candidate-review-required").length,
      licenseProhibitedCount: choices.filter((choice) => choice.licenseState === "candidate-prohibited").length,
      securityReviewRequiredCount: choices.filter((choice) => choice.securityPolicyState === "candidate-review-required").length,
      securityNonconformantCount: choices.filter((choice) => choice.securityPolicyState === "candidate-nonconformant").length,
      exceptionCandidateCount: choices.filter((choice) => ["candidate-exception", "candidate-experimental"].includes(choice.registryStatus)).length,
      constraintConflictCount: constraints.filter((constraint) => constraint.assessmentState !== "candidate-satisfied").length,
    }
  }

  private requireValidProfiles(input: TechnologyProfileInput, assessment: ProfileAssessment): void {
    const rangeOrUnresolvedVersionCount = input.profiles.flatMap((profile) => profile.choices)
      .filter((choice) => choice.versionState !== "exact-candidate").length
    const gapCount = assessment.missingProfileCount + assessment.invalidProfileCount + assessment.missingEvidenceCount +
      assessment.unsupportedChoiceCount + assessment.lifecycleRiskCount + assessment.compatibilityConflictCount +
      assessment.licenseReviewRequiredCount + assessment.licenseProhibitedCount + assessment.securityReviewRequiredCount +
      assessment.securityNonconformantCount + assessment.exceptionCandidateCount + assessment.constraintConflictCount +
      rangeOrUnresolvedVersionCount
    if (input.reviewState === "ready-for-human-review" && gapCount > 0) {
      throw new Error("Review-ready Technology Profile must cover every exact implementation unit with exact evidence-backed supported compatible lifecycle-safe license-safe security-conformant technology candidates and satisfied constraints")
    }
  }

  private emptyAssessment(): ProfileAssessment {
    return {
      missingProfileCount: 0, invalidProfileCount: 0, missingEvidenceCount: 0, unsupportedChoiceCount: 0,
      lifecycleRiskCount: 0, compatibilityConflictCount: 0, licenseReviewRequiredCount: 0,
      licenseProhibitedCount: 0, securityReviewRequiredCount: 0, securityNonconformantCount: 0,
      exceptionCandidateCount: 0, constraintConflictCount: 0,
    }
  }

  private composeDigests(input: TechnologyProfileInput) {
    const profileCatalogDigest = canonicalDigest(input.profiles)
    const selectionCatalogDigest = canonicalDigest(input.profiles.map((profile) => ({
      profileId: profile.id, implementationUnitId: profile.implementationUnitId, choices: profile.choices,
    })))
    const compatibilityAssessmentReceiptDigest = canonicalDigest({
      implementationUnitModel: input.implementationUnitModel, dependencyMapping: input.dependencyMapping,
      architectureEvidenceReferences: input.architectureEvidenceReferences,
      profiles: input.profiles.map((profile) => ({
        profileId: profile.id, implementationUnitId: profile.implementationUnitId,
        choices: profile.choices.map((choice) => ({
          id: choice.id, versionState: choice.versionState, registryStatus: choice.registryStatus,
          supportState: choice.supportState, lifecycleState: choice.lifecycleState,
          compatibilityState: choice.compatibilityState, licenseState: choice.licenseState,
          securityPolicyState: choice.securityPolicyState, evidenceReferences: choice.evidenceReferences,
        })),
        constraints: profile.constraints,
      })),
    })
    const assessmentReceiptDigest = canonicalDigest({
      context: input.context, implementationUnitModel: input.implementationUnitModel,
      dependencyMapping: input.dependencyMapping, profileCatalogDigest, selectionCatalogDigest,
      compatibilityAssessmentReceiptDigest, reviewState: input.reviewState,
      unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations,
      technologyApprovalState: input.technologyApprovalState, supportCommitmentState: input.supportCommitmentState,
      compatibilityTruthState: input.compatibilityTruthState,
      compatibilityCompletenessState: input.compatibilityCompletenessState,
      licensingApprovalState: input.licensingApprovalState, securityApprovalState: input.securityApprovalState,
      exceptionWaiverState: input.exceptionWaiverState,
      architectureBaselineDesignationState: input.architectureBaselineDesignationState,
      implementationReadinessState: input.implementationReadinessState,
      implementationCompletenessState: input.implementationCompletenessState,
      assignmentExecutionState: input.assignmentExecutionState, approvalState: input.approvalState,
      acceptanceDecisionState: input.acceptanceDecisionState, mergeReadinessState: input.mergeReadinessState,
      releaseReadinessState: input.releaseReadinessState, deploymentReadinessState: input.deploymentReadinessState,
      actionAuthorityState: input.actionAuthorityState,
    })
    return { profileCatalogDigest, selectionCatalogDigest, compatibilityAssessmentReceiptDigest, assessmentReceiptDigest }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Technology Profile Initiative targets a different Product")
    if (canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) {
      throw new Error("Technology Profile must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
  }

  private async requireExactDependencies(input: TechnologyProfileInput, initiative: Initiative): Promise<ExactDependencies> {
    const [units, dependencyMapping] = await Promise.all([
      this.implementationUnitModel.readCurrent(initiative.id), this.dependencyMapping.readCurrent(initiative.id),
    ])
    if (!this.matches(input.implementationUnitModel, units)) throw new Error("Technology Profile must reference the exact current Implementation Unit Model candidate")
    if (!this.matches(input.dependencyMapping, dependencyMapping)) throw new Error("Technology Profile must reference the exact current Dependency Mapping candidate")
    if (!dependencyMapping || canonicalDigest(dependencyMapping.implementationUnitModel) !== canonicalDigest(input.implementationUnitModel)) {
      throw new Error("Technology Profile dependencies do not share the exact current Implementation Unit Model")
    }
    return { units: units!, dependencyMapping: dependencyMapping! }
  }

  private matches(reference: { recordId: string; revision: number; digest: string }, record: { id: string; revision: number } | undefined): boolean {
    return !!record && record.id === reference.recordId && record.revision === reference.revision && canonicalDigest(record) === reference.digest
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Technology Profile is immutable`)
    return { product, initiative }
  }

  private async commitVersionedRecord(record: TechnologyProfile, assessment: ProfileAssessment, eventType: string, actorId: string): Promise<void> {
    const choices = record.profiles.flatMap((profile) => profile.choices)
    const constraints = record.profiles.flatMap((profile) => profile.constraints)
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, technologyProfileSchema),
        this.governed(this.historyPath(record.id, record.revision), record, technologyProfileSchema),
      ],
      audit: {
        eventType, actor: { kind: "human", id: actorId }, subjectId: record.id,
        payload: {
          initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record),
          profileCatalogDigest: record.profileCatalogDigest, selectionCatalogDigest: record.selectionCatalogDigest,
          compatibilityAssessmentReceiptDigest: record.compatibilityAssessmentReceiptDigest,
          assessmentReceiptDigest: record.assessmentReceiptDigest, predecessorDigest: record.predecessorDigest,
          implementationUnitModel: record.implementationUnitModel, dependencyMapping: record.dependencyMapping,
          architectureEvidenceCount: record.architectureEvidenceReferences.length,
          unitProfileCount: record.profiles.length, technologyChoiceCount: choices.length,
          exactVersionCandidateCount: choices.filter((choice) => choice.versionState === "exact-candidate").length,
          constraintCount: constraints.length, ...assessment,
          reviewState: record.reviewState, technologyApprovalState: record.technologyApprovalState,
          supportCommitmentState: record.supportCommitmentState,
          compatibilityTruthState: record.compatibilityTruthState,
          compatibilityCompletenessState: record.compatibilityCompletenessState,
          licensingApprovalState: record.licensingApprovalState, securityApprovalState: record.securityApprovalState,
          exceptionWaiverState: record.exceptionWaiverState,
          architectureBaselineDesignationState: record.architectureBaselineDesignationState,
          implementationReadinessState: record.implementationReadinessState,
          implementationCompletenessState: record.implementationCompletenessState,
          assignmentExecutionState: record.assignmentExecutionState, approvalState: record.approvalState,
          acceptanceDecisionState: record.acceptanceDecisionState, mergeReadinessState: record.mergeReadinessState,
          releaseReadinessState: record.releaseReadinessState, deploymentReadinessState: record.deploymentReadinessState,
          actionAuthorityState: record.actionAuthorityState, authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string { return this.repository.resolve("technology-profiles", `${id}.json`) }
  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("technology-profile-history", `technology-profile-${id}-r${revision}.json`)
  }
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
    if (names.length > inventoryLimit) throw new Error(`Technology Profile directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
