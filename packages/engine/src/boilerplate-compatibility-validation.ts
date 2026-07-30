import { randomUUID } from "node:crypto"

import {
  boilerplateCompatibilityDimensions,
  boilerplateCompatibilityValidationInputSchema,
  boilerplateCompatibilityValidationProjectionSchema,
  boilerplateCompatibilityValidationSchema,
  boilerplateCompatibilityValidationStatusSchema,
  type BoilerplateCompatibilityValidation,
  type BoilerplateCompatibilityValidationInput,
  type BoilerplateCompatibilityValidationProjection,
  type BoilerplateCompatibilityValidationStatus,
  type BoilerplateRegistry,
  type BoilerplateSelectionBinding,
  type BusinessContextBinding,
  type DependencyMapping,
  type ImplementationUnitModel,
  type Initiative,
  type Product,
  type TechnologyProfile,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { BoilerplateRegistryService } from "./boilerplate-registry.js"
import type { BoilerplateSelectionBindingService } from "./boilerplate-selection-binding.js"
import type { DependencyMappingService } from "./dependency-mapping.js"
import type { ImplementationUnitModelService } from "./implementation-unit-model.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { TechnologyProfileService } from "./technology-profile.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "boilerplate-compatibility-validation-is-a-versioned-candidate-and-does-not-establish-compatibility-truth-or-completeness-validation-decision-actual-asset-behavior-test-execution-design-validity-security-privacy-or-licensing-approval-exception-waiver-selection-binding-effectiveness-source-retrieval-import-instantiation-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "boilerplate-compatibility-validation-status-is-observational-and-does-not-establish-compatibility-truth-or-completeness-validation-decision-actual-asset-behavior-test-execution-design-validity-security-privacy-or-licensing-approval-exception-waiver-selection-binding-effectiveness-source-retrieval-import-instantiation-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "boilerplate-compatibility-validation-projection-is-read-only-and-does-not-establish-compatibility-truth-or-completeness-validation-decision-actual-asset-behavior-test-execution-design-validity-security-privacy-or-licensing-approval-exception-waiver-selection-binding-effectiveness-source-retrieval-import-instantiation-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-counts-statuses-and-subject-dimension-evidence-validation-assessment-snapshot-digests-only-not-boilerplate-names-locators-versions-unit-profile-entry-or-binding-identities-claims-evidence-assessors-personal-data-secrets-credentials-or-machine-paths" as const

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: BoilerplateCompatibilityValidation) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

interface ExactDependencies {
  units: ImplementationUnitModel
  dependencyMapping: DependencyMapping
  technologyProfile: TechnologyProfile
  boilerplateRegistry: BoilerplateRegistry
  boilerplateSelectionBinding: BoilerplateSelectionBinding
}

interface ValidationAssessment {
  selectedBindingCount: number
  missingSubjectCount: number
  invalidSubjectCount: number
  missingDimensionCount: number
  missingEvidenceCount: number
  expiredAssessmentCount: number
  conflictingOutcomeCount: number
  selectionBindingGapCount: number
}

export class BoilerplateCompatibilityValidationService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly implementationUnitModel: ImplementationUnitModelService,
    private readonly dependencyMapping: DependencyMappingService,
    private readonly technologyProfile: TechnologyProfileService,
    private readonly boilerplateRegistry: BoilerplateRegistryService,
    private readonly boilerplateSelectionBinding: BoilerplateSelectionBindingService,
  ) {}

  async create(
    inputValue: BoilerplateCompatibilityValidationInput,
    actorId: string,
  ): Promise<BoilerplateCompatibilityValidation> {
    const input = boilerplateCompatibilityValidationInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input, initiative)
      const assessment = this.assessSubjects(input, dependencies, new Date().toISOString())
      this.requireValidCandidate(input, assessment)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Boilerplate Compatibility Validation candidate")
      }
      const now = new Date().toISOString()
      const record = boilerplateCompatibilityValidationSchema.parse({
        schemaVersion: 1, kind: "boilerplate-compatibility-validation-candidate", id: randomUUID(),
        productId: product.id, ...input, initiativeId: initiative.id, revision: 1,
        ...this.composeDigests(input), state: "candidate",
        createdBy: { kind: "human", id: actorId }, updatedBy: { kind: "human", id: actorId },
        createdAt: now, updatedAt: now, authorityBoundary,
      })
      await this.commitVersionedRecord(record, assessment, "boilerplate-compatibility-validation.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: BoilerplateCompatibilityValidationInput,
    actorId: string,
  ): Promise<BoilerplateCompatibilityValidation> {
    const input = boilerplateCompatibilityValidationInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) {
        throw new Error("Boilerplate Compatibility Validation revision changed before update")
      }
      if (current.initiativeId !== input.initiativeId) {
        throw new Error("Boilerplate Compatibility Validation Initiative cannot change")
      }
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input, initiative)
      const assessment = this.assessSubjects(input, dependencies, new Date().toISOString())
      this.requireValidCandidate(input, assessment)
      const record = boilerplateCompatibilityValidationSchema.parse({
        ...current, ...input, productId: product.id, initiativeId: initiative.id,
        revision: current.revision + 1, ...this.composeDigests(input),
        predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId }, updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, assessment, "boilerplate-compatibility-validation.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<BoilerplateCompatibilityValidation> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Boilerplate Compatibility Validation ID")),
      boilerplateCompatibilityValidationSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<BoilerplateCompatibilityValidation | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords(
      "boilerplate-compatibility-validations", currentRecordPattern, boilerplateCompatibilityValidationSchema,
    )
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) {
      throw new Error("Initiative has more than one current Boilerplate Compatibility Validation candidate")
    }
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<BoilerplateCompatibilityValidation> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Boilerplate Compatibility Validation history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Boilerplate Compatibility Validation ID")
    const record = await this.repository.readJson(
      this.historyPath(recordId, revision), boilerplateCompatibilityValidationSchema,
    )
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Boilerplate Compatibility Validation history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<BoilerplateCompatibilityValidation[]> {
    const recordId = this.requireUuid(id, "Boilerplate Compatibility Validation ID")
    const records = await this.listRecords(
      "boilerplate-compatibility-validation-history",
      new RegExp(`^boilerplate-compatibility-validation-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      boilerplateCompatibilityValidationSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Boilerplate Compatibility Validation history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<BoilerplateCompatibilityValidationStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [
      product, initiative, candidate, units, dependencyMapping, technologyProfile,
      boilerplateRegistry, boilerplateSelectionBinding,
    ] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId),
      this.implementationUnitModel.readCurrent(targetId), this.dependencyMapping.readCurrent(targetId),
      this.technologyProfile.readCurrent(targetId), this.boilerplateRegistry.readCurrent(targetId),
      this.boilerplateSelectionBinding.readCurrent(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const staleBindingCount = candidate &&
      canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative)) ? 1 : 0
    const staleImplementationUnitModelCount = candidate && !this.matches(candidate.implementationUnitModel, units) ? 1 : 0
    const staleDependencyMappingCount = candidate && !this.matches(candidate.dependencyMapping, dependencyMapping) ? 1 : 0
    const staleTechnologyProfileCount = candidate && !this.matches(candidate.technologyProfile, technologyProfile) ? 1 : 0
    const staleBoilerplateRegistryCount = candidate && !this.matches(candidate.boilerplateRegistry, boilerplateRegistry) ? 1 : 0
    const staleSelectionBindingCount = candidate &&
      !this.matches(candidate.boilerplateSelectionBinding, boilerplateSelectionBinding) ? 1 : 0
    const dependencies = units && dependencyMapping && technologyProfile && boilerplateRegistry && boilerplateSelectionBinding
      ? { units, dependencyMapping, technologyProfile, boilerplateRegistry, boilerplateSelectionBinding }
      : undefined
    const assessment = candidate && dependencies
      ? this.assessSubjects(candidate, dependencies, new Date().toISOString())
      : this.emptyAssessment(boilerplateSelectionBinding)
    let invalidCandidateCount = 0
    if (candidate) {
      const digests = this.composeDigests(candidate)
      if (candidate.validationSubjectCatalogDigest !== digests.validationSubjectCatalogDigest ||
          candidate.dimensionCatalogDigest !== digests.dimensionCatalogDigest ||
          candidate.evidenceReceiptDigest !== digests.evidenceReceiptDigest ||
          candidate.validationReceiptDigest !== digests.validationReceiptDigest ||
          candidate.assessmentReceiptDigest !== digests.assessmentReceiptDigest) invalidCandidateCount = 1
    }
    const subjects = candidate?.subjects ?? []
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Boilerplate Compatibility Validation candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind the exact current Product and Initiative")
    if (staleImplementationUnitModelCount > 0) reasons.push("The candidate does not bind the exact current Implementation Unit Model")
    if (staleDependencyMappingCount > 0) reasons.push("The candidate does not bind the exact current Dependency Mapping")
    if (staleTechnologyProfileCount > 0) reasons.push("The candidate does not bind the exact current Technology Profile")
    if (staleBoilerplateRegistryCount > 0) reasons.push("The candidate does not bind the exact current Boilerplate Registry")
    if (staleSelectionBindingCount > 0) reasons.push("The candidate does not bind the exact current Boilerplate Selection and Binding")
    if (assessment.selectionBindingGapCount > 0) reasons.push("The current selection binding is not a complete human-review candidate")
    if (assessment.missingSubjectCount > 0) reasons.push("One or more selected binding decisions lack a compatibility subject")
    if (assessment.invalidSubjectCount > 0) reasons.push("One or more compatibility subjects do not match the exact selected binding scope")
    if (assessment.missingDimensionCount > 0) reasons.push("One or more compatibility subjects lack required dimension coverage")
    if (assessment.missingEvidenceCount > 0) reasons.push("One or more assessed compatibility dimensions lack exact evidence")
    if (assessment.expiredAssessmentCount > 0) reasons.push("One or more compatibility dimension assessments have expired")
    if (assessment.conflictingOutcomeCount > 0) reasons.push("One or more subject outcomes conflict with their dimension outcomes")
    if (subjects.some((subject) => subject.outcome === "not-assessed")) {
      reasons.push("One or more selected bindings are not fully assessed")
    }
    if (invalidCandidateCount > 0) reasons.push("The Boilerplate Compatibility Validation receipt digests are invalid")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved Boilerplate Compatibility Validation questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return boilerplateCompatibilityValidationStatusSchema.parse({
      schemaVersion: 1, kind: "boilerplate-compatibility-validation-status", productId: product.id,
      productRevision: revisionOf(product), initiativeId: initiative.id, initiativeRevision: revisionOf(initiative),
      ...(candidate ? {
        candidate: exactReference(candidate), implementationUnitModel: candidate.implementationUnitModel,
        dependencyMapping: candidate.dependencyMapping, technologyProfile: candidate.technologyProfile,
        boilerplateRegistry: candidate.boilerplateRegistry,
        boilerplateSelectionBinding: candidate.boilerplateSelectionBinding,
      } : {}),
      selectedBindingCount: assessment.selectedBindingCount, subjectCount: subjects.length,
      compatibleCandidateCount: subjects.filter((subject) => subject.outcome === "candidate-compatible").length,
      incompatibleCandidateCount: subjects.filter((subject) => subject.outcome === "candidate-incompatible").length,
      exceptionCandidateCount: subjects.filter((subject) => subject.outcome === "exception-candidate").length,
      notAssessedCount: subjects.filter((subject) => subject.outcome === "not-assessed").length,
      dimensionAssessmentCount: subjects.reduce((sum, subject) => sum + subject.dimensionAssessments.length, 0),
      missingSubjectCount: assessment.missingSubjectCount, invalidSubjectCount: assessment.invalidSubjectCount,
      missingDimensionCount: assessment.missingDimensionCount, missingEvidenceCount: assessment.missingEvidenceCount,
      expiredAssessmentCount: assessment.expiredAssessmentCount,
      conflictingOutcomeCount: assessment.conflictingOutcomeCount,
      selectionBindingGapCount: assessment.selectionBindingGapCount,
      staleBindingCount, staleImplementationUnitModelCount, staleDependencyMappingCount,
      staleTechnologyProfileCount, staleBoilerplateRegistryCount, staleSelectionBindingCount,
      invalidCandidateCount, unresolvedQuestionCount, reviewState,
      state: reasons.length === 0 ? "candidate-complete" : "attention-required", reasons,
      assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary,
    })
  }

  async project(initiativeId: string): Promise<BoilerplateCompatibilityValidationProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Boilerplate Compatibility Validation projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const, kind: "boilerplate-compatibility-validation-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: {
        id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative),
        state: initiative.state,
      },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        validationSubjectCatalogDigest: candidate.validationSubjectCatalogDigest,
        dimensionCatalogDigest: candidate.dimensionCatalogDigest,
        evidenceReceiptDigest: candidate.evidenceReceiptDigest,
        validationReceiptDigest: candidate.validationReceiptDigest,
        assessmentReceiptDigest: candidate.assessmentReceiptDigest,
        subjectCount: candidate.subjects.length,
        compatibleCandidateCount: candidate.subjects.filter((subject) => subject.outcome === "candidate-compatible").length,
        incompatibleCandidateCount: candidate.subjects.filter((subject) => subject.outcome === "candidate-incompatible").length,
        exceptionCandidateCount: candidate.subjects.filter((subject) => subject.outcome === "exception-candidate").length,
        notAssessedCount: candidate.subjects.filter((subject) => subject.outcome === "not-assessed").length,
        dimensionAssessmentCount: candidate.subjects.reduce(
          (sum, subject) => sum + subject.dimensionAssessments.length, 0,
        ),
        reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary,
    }
    return boilerplateCompatibilityValidationProjectionSchema.parse({
      ...projectionWithoutDigest, snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords(
      "boilerplate-compatibility-validations", currentRecordPattern, boilerplateCompatibilityValidationSchema,
    )
    for (const candidate of records) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Boilerplate Compatibility Validation candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        const gapCount = status.notAssessedCount + status.missingSubjectCount + status.invalidSubjectCount +
          status.missingDimensionCount + status.missingEvidenceCount + status.expiredAssessmentCount +
          status.conflictingOutcomeCount + status.selectionBindingGapCount + status.staleBindingCount +
          status.staleImplementationUnitModelCount + status.staleDependencyMappingCount +
          status.staleTechnologyProfileCount + status.staleBoilerplateRegistryCount +
          status.staleSelectionBindingCount + status.invalidCandidateCount + status.unresolvedQuestionCount
        if (gapCount > 0) {
          issues.push({
            code: "boilerplate-compatibility-validation.review-required", severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale, incomplete, invalid, expired, or unresolved Boilerplate Compatibility Validation candidates.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "boilerplate-compatibility-validation.invalid", severity: "error",
          message: `Boilerplate Compatibility Validation ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private assessSubjects(
    input: Pick<BoilerplateCompatibilityValidationInput, "subjects" | "reviewState">,
    dependencies: ExactDependencies,
    assessedAt: string,
  ): ValidationAssessment {
    const selectedDecisions = dependencies.boilerplateSelectionBinding.decisions.filter(
      (decision) => decision.disposition === "candidate-selected",
    )
    const selectedById = new Map(selectedDecisions.map((decision) => [decision.id, decision]))
    const subjectByDecision = new Map(input.subjects.map((subject) => [subject.bindingDecisionId, subject]))
    let invalidSubjectCount = 0
    let missingDimensionCount = 0
    let missingEvidenceCount = 0
    let expiredAssessmentCount = 0
    let conflictingOutcomeCount = 0
    for (const [index, subject] of input.subjects.entries()) {
      const decision = selectedById.get(subject.bindingDecisionId)
      if (!decision || subject.ordinal !== index + 1 ||
          subject.implementationUnitId !== decision.implementationUnitId ||
          subject.technologyProfileId !== decision.technologyProfileId ||
          subject.boilerplateRegistryEntryId !== decision.boilerplateRegistryEntryId ||
          subject.boilerplateVersionCandidate !== decision.boilerplateVersionCandidate) {
        invalidSubjectCount += 1
      }
      const dimensions = new Set(subject.dimensionAssessments.map((assessment) => assessment.dimension))
      missingDimensionCount += boilerplateCompatibilityDimensions.filter((dimension) => !dimensions.has(dimension)).length
      const outcomes = subject.dimensionAssessments.map((assessment) => assessment.outcome)
      const expectedOutcome = outcomes.includes("candidate-incompatible")
        ? "candidate-incompatible"
        : outcomes.includes("not-assessed")
          ? "not-assessed"
          : outcomes.includes("exception-candidate")
            ? "exception-candidate"
            : "candidate-compatible"
      if (subject.outcome !== expectedOutcome) conflictingOutcomeCount += 1
      for (const assessment of subject.dimensionAssessments) {
        if (assessment.outcome !== "not-assessed" && assessment.evidenceReferences.length === 0) {
          missingEvidenceCount += 1
        }
        if (assessment.expiresAt && assessment.expiresAt <= assessedAt) expiredAssessmentCount += 1
      }
    }
    const selectionBindingGapCount = dependencies.boilerplateSelectionBinding.reviewState === "ready-for-human-review" &&
      dependencies.boilerplateSelectionBinding.decisions.every((decision) =>
        ["candidate-selected", "candidate-not-applicable"].includes(decision.disposition)) ? 0 : 1
    return {
      selectedBindingCount: selectedDecisions.length,
      missingSubjectCount: selectedDecisions.filter((decision) => !subjectByDecision.has(decision.id)).length,
      invalidSubjectCount, missingDimensionCount, missingEvidenceCount, expiredAssessmentCount,
      conflictingOutcomeCount, selectionBindingGapCount,
    }
  }

  private requireValidCandidate(
    input: BoilerplateCompatibilityValidationInput,
    assessment: ValidationAssessment,
  ): void {
    const notAssessedCount = input.subjects.filter((subject) => subject.outcome === "not-assessed").length
    const structuralGapCount = assessment.missingSubjectCount + assessment.invalidSubjectCount +
      assessment.missingDimensionCount + assessment.missingEvidenceCount + assessment.expiredAssessmentCount +
      assessment.conflictingOutcomeCount + assessment.selectionBindingGapCount + notAssessedCount
    if (input.reviewState === "ready-for-human-review" && structuralGapCount > 0) {
      throw new Error("Review-ready Boilerplate Compatibility Validation requires the exact complete current selection binding and one non-expired evidence-backed canonical dimension assessment for every selected boilerplate binding with no missing, mismatched, conflicting, or not-assessed coverage")
    }
  }

  private emptyAssessment(selectionBinding: BoilerplateSelectionBinding | undefined): ValidationAssessment {
    return {
      selectedBindingCount: selectionBinding?.decisions.filter(
        (decision) => decision.disposition === "candidate-selected",
      ).length ?? 0,
      missingSubjectCount: 0, invalidSubjectCount: 0, missingDimensionCount: 0,
      missingEvidenceCount: 0, expiredAssessmentCount: 0, conflictingOutcomeCount: 0,
      selectionBindingGapCount: selectionBinding && selectionBinding.reviewState === "ready-for-human-review" ? 0 : 1,
    }
  }

  private composeDigests(input: BoilerplateCompatibilityValidationInput) {
    const validationSubjectCatalogDigest = canonicalDigest(input.subjects.map((subject) => ({
      id: subject.id, ordinal: subject.ordinal, bindingDecisionId: subject.bindingDecisionId,
      implementationUnitId: subject.implementationUnitId, technologyProfileId: subject.technologyProfileId,
      boilerplateRegistryEntryId: subject.boilerplateRegistryEntryId,
      boilerplateVersionCandidate: subject.boilerplateVersionCandidate, outcome: subject.outcome,
    })))
    const dimensionCatalogDigest = canonicalDigest(input.subjects.map((subject) => ({
      subjectId: subject.id,
      dimensions: subject.dimensionAssessments.map((assessment) => ({
        id: assessment.id, ordinal: assessment.ordinal, dimension: assessment.dimension,
        outcome: assessment.outcome, claim: assessment.claim,
      })),
    })))
    const evidenceReceiptDigest = canonicalDigest(input.subjects.map((subject) => ({
      subjectId: subject.id,
      dimensions: subject.dimensionAssessments.map((assessment) => ({
        dimension: assessment.dimension, evidenceReferences: assessment.evidenceReferences,
        exceptionReferenceCandidates: assessment.exceptionReferenceCandidates,
        assessedBy: assessment.assessedBy, assessedAt: assessment.assessedAt, expiresAt: assessment.expiresAt,
      })),
    })))
    const validationReceiptDigest = canonicalDigest({
      implementationUnitModel: input.implementationUnitModel, dependencyMapping: input.dependencyMapping,
      technologyProfile: input.technologyProfile, boilerplateRegistry: input.boilerplateRegistry,
      boilerplateSelectionBinding: input.boilerplateSelectionBinding,
      validationSubjectCatalogDigest, dimensionCatalogDigest, evidenceReceiptDigest,
      subjectOutcomes: input.subjects.map((subject) => ({ id: subject.id, outcome: subject.outcome })),
    })
    const assessmentReceiptDigest = canonicalDigest({
      context: input.context, implementationUnitModel: input.implementationUnitModel,
      dependencyMapping: input.dependencyMapping, technologyProfile: input.technologyProfile,
      boilerplateRegistry: input.boilerplateRegistry,
      boilerplateSelectionBinding: input.boilerplateSelectionBinding,
      validationSubjectCatalogDigest, dimensionCatalogDigest, evidenceReceiptDigest, validationReceiptDigest,
      reviewState: input.reviewState, unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations,
      compatibilityTruthState: input.compatibilityTruthState,
      compatibilityCompletenessState: input.compatibilityCompletenessState,
      validationDecisionState: input.validationDecisionState,
      actualAssetBehaviorState: input.actualAssetBehaviorState, testExecutionState: input.testExecutionState,
      designValidityState: input.designValidityState,
      securityPrivacyApprovalState: input.securityPrivacyApprovalState,
      licensingApprovalState: input.licensingApprovalState,
      exceptionWaiverState: input.exceptionWaiverState,
      selectionBindingEffectivenessState: input.selectionBindingEffectivenessState,
      sourceRetrievalState: input.sourceRetrievalState,
      assetImportInstantiationState: input.assetImportInstantiationState,
      architectureBaselineDesignationState: input.architectureBaselineDesignationState,
      implementationReadinessState: input.implementationReadinessState,
      implementationCompletenessState: input.implementationCompletenessState,
      assignmentExecutionState: input.assignmentExecutionState,
      acceptanceDecisionState: input.acceptanceDecisionState,
      mergeReadinessState: input.mergeReadinessState, releaseReadinessState: input.releaseReadinessState,
      deploymentReadinessState: input.deploymentReadinessState, actionAuthorityState: input.actionAuthorityState,
    })
    return {
      validationSubjectCatalogDigest, dimensionCatalogDigest, evidenceReceiptDigest,
      validationReceiptDigest, assessmentReceiptDigest,
    }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) {
      throw new Error("Boilerplate Compatibility Validation Initiative targets a different Product")
    }
    if (canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) {
      throw new Error("Boilerplate Compatibility Validation must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
  }

  private async requireExactDependencies(
    input: BoilerplateCompatibilityValidationInput,
    initiative: Initiative,
  ): Promise<ExactDependencies> {
    const [units, dependencyMapping, technologyProfile, boilerplateRegistry, boilerplateSelectionBinding] =
      await Promise.all([
        this.implementationUnitModel.readCurrent(initiative.id), this.dependencyMapping.readCurrent(initiative.id),
        this.technologyProfile.readCurrent(initiative.id), this.boilerplateRegistry.readCurrent(initiative.id),
        this.boilerplateSelectionBinding.readCurrent(initiative.id),
      ])
    if (!this.matches(input.implementationUnitModel, units)) {
      throw new Error("Boilerplate Compatibility Validation must reference the exact current Implementation Unit Model candidate")
    }
    if (!this.matches(input.dependencyMapping, dependencyMapping)) {
      throw new Error("Boilerplate Compatibility Validation must reference the exact current Dependency Mapping candidate")
    }
    if (!this.matches(input.technologyProfile, technologyProfile)) {
      throw new Error("Boilerplate Compatibility Validation must reference the exact current Technology Profile candidate")
    }
    if (!this.matches(input.boilerplateRegistry, boilerplateRegistry)) {
      throw new Error("Boilerplate Compatibility Validation must reference the exact current Boilerplate Registry candidate")
    }
    if (!this.matches(input.boilerplateSelectionBinding, boilerplateSelectionBinding)) {
      throw new Error("Boilerplate Compatibility Validation must reference the exact current Boilerplate Selection and Binding candidate")
    }
    if (!dependencyMapping || !technologyProfile || !boilerplateRegistry || !boilerplateSelectionBinding ||
        canonicalDigest(dependencyMapping.implementationUnitModel) !== canonicalDigest(input.implementationUnitModel) ||
        canonicalDigest(technologyProfile.implementationUnitModel) !== canonicalDigest(input.implementationUnitModel) ||
        canonicalDigest(technologyProfile.dependencyMapping) !== canonicalDigest(input.dependencyMapping) ||
        canonicalDigest(boilerplateRegistry.implementationUnitModel) !== canonicalDigest(input.implementationUnitModel) ||
        canonicalDigest(boilerplateRegistry.technologyProfile) !== canonicalDigest(input.technologyProfile) ||
        canonicalDigest(boilerplateSelectionBinding.implementationUnitModel) !== canonicalDigest(input.implementationUnitModel) ||
        canonicalDigest(boilerplateSelectionBinding.dependencyMapping) !== canonicalDigest(input.dependencyMapping) ||
        canonicalDigest(boilerplateSelectionBinding.technologyProfile) !== canonicalDigest(input.technologyProfile) ||
        canonicalDigest(boilerplateSelectionBinding.boilerplateRegistry) !== canonicalDigest(input.boilerplateRegistry)) {
      throw new Error("Boilerplate Compatibility Validation dependencies do not share one exact current planning chain")
    }
    return {
      units: units!, dependencyMapping, technologyProfile, boilerplateRegistry, boilerplateSelectionBinding,
    }
  }

  private matches(
    reference: { recordId: string; revision: number; digest: string },
    record: { id: string; revision: number } | undefined,
  ): boolean {
    return !!record && record.id === reference.recordId && record.revision === reference.revision &&
      canonicalDigest(record) === reference.digest
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Boilerplate Compatibility Validation is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(
    record: BoilerplateCompatibilityValidation,
    assessment: ValidationAssessment,
    eventType: string,
    actorId: string,
  ): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, boilerplateCompatibilityValidationSchema),
        this.governed(
          this.historyPath(record.id, record.revision), record, boilerplateCompatibilityValidationSchema,
        ),
      ],
      audit: {
        eventType, actor: { kind: "human", id: actorId }, subjectId: record.id,
        payload: {
          initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record),
          validationSubjectCatalogDigest: record.validationSubjectCatalogDigest,
          dimensionCatalogDigest: record.dimensionCatalogDigest,
          evidenceReceiptDigest: record.evidenceReceiptDigest,
          validationReceiptDigest: record.validationReceiptDigest,
          assessmentReceiptDigest: record.assessmentReceiptDigest, predecessorDigest: record.predecessorDigest,
          implementationUnitModel: record.implementationUnitModel,
          dependencyMapping: record.dependencyMapping, technologyProfile: record.technologyProfile,
          boilerplateRegistry: record.boilerplateRegistry,
          boilerplateSelectionBinding: record.boilerplateSelectionBinding,
          subjectCount: record.subjects.length,
          compatibleCandidateCount: record.subjects.filter((subject) => subject.outcome === "candidate-compatible").length,
          incompatibleCandidateCount: record.subjects.filter((subject) => subject.outcome === "candidate-incompatible").length,
          exceptionCandidateCount: record.subjects.filter((subject) => subject.outcome === "exception-candidate").length,
          notAssessedCount: record.subjects.filter((subject) => subject.outcome === "not-assessed").length,
          dimensionAssessmentCount: record.subjects.reduce(
            (sum, subject) => sum + subject.dimensionAssessments.length, 0,
          ),
          ...assessment, reviewState: record.reviewState,
          compatibilityTruthState: record.compatibilityTruthState,
          compatibilityCompletenessState: record.compatibilityCompletenessState,
          validationDecisionState: record.validationDecisionState,
          actualAssetBehaviorState: record.actualAssetBehaviorState,
          testExecutionState: record.testExecutionState, designValidityState: record.designValidityState,
          securityPrivacyApprovalState: record.securityPrivacyApprovalState,
          licensingApprovalState: record.licensingApprovalState,
          exceptionWaiverState: record.exceptionWaiverState,
          selectionBindingEffectivenessState: record.selectionBindingEffectivenessState,
          sourceRetrievalState: record.sourceRetrievalState,
          assetImportInstantiationState: record.assetImportInstantiationState,
          architectureBaselineDesignationState: record.architectureBaselineDesignationState,
          implementationReadinessState: record.implementationReadinessState,
          implementationCompletenessState: record.implementationCompletenessState,
          assignmentExecutionState: record.assignmentExecutionState,
          acceptanceDecisionState: record.acceptanceDecisionState,
          mergeReadinessState: record.mergeReadinessState,
          releaseReadinessState: record.releaseReadinessState,
          deploymentReadinessState: record.deploymentReadinessState,
          actionAuthorityState: record.actionAuthorityState, authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("boilerplate-compatibility-validations", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve(
      "boilerplate-compatibility-validation-history",
      `boilerplate-compatibility-validation-${id}-r${revision}.json`,
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
      throw new Error(`Boilerplate Compatibility Validation directory ${directory} exceeds the safety limit`)
    }
    const records = await Promise.all(
      names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)),
    )
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      return `${String(leftRecord.id ?? "")}:${String(leftRecord.revision ?? "")}`.localeCompare(
        `${String(rightRecord.id ?? "")}:${String(rightRecord.revision ?? "")}`,
      )
    })
  }
}
