import { randomUUID } from "node:crypto"

import {
  figmaToBoilerplateMappingInputSchema,
  figmaToBoilerplateMappingProjectionSchema,
  figmaToBoilerplateMappingSchema,
  figmaToBoilerplateMappingStatusSchema,
  type BoilerplateCompatibilityValidation,
  type BoilerplateRegistry,
  type BoilerplateSelectionBinding,
  type BusinessContextBinding,
  type DesignApplicability,
  type DesignBaseline,
  type DesignSystemTokenContract,
  type DesignToRequirementBinding,
  type FigmaToBoilerplateMapping,
  type FigmaToBoilerplateMappingInput,
  type FigmaToBoilerplateMappingProjection,
  type FigmaToBoilerplateMappingStatus,
  type FinalizedFigmaSnapshotImport,
  type ImplementationUnitModel,
  type Initiative,
  type Product,
  type ResponsiveMultiPlatformTargets,
  type TechnologyProfile,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { BoilerplateCompatibilityValidationService } from "./boilerplate-compatibility-validation.js"
import type { BoilerplateRegistryService } from "./boilerplate-registry.js"
import type { BoilerplateSelectionBindingService } from "./boilerplate-selection-binding.js"
import type { DesignApplicabilityService } from "./design-applicability.js"
import type { DesignBaselineService } from "./design-baseline.js"
import type { DesignSystemTokenContractService } from "./design-system-token-contract.js"
import type { DesignToRequirementBindingService } from "./design-to-requirement-binding.js"
import type { FinalizedFigmaSnapshotImportService } from "./finalized-figma-snapshot-import.js"
import type { ImplementationUnitModelService } from "./implementation-unit-model.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { ResponsiveMultiPlatformTargetsService } from "./responsive-multi-platform-targets.js"
import type { TechnologyProfileService } from "./technology-profile.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type ExactReference = { recordId: string; revision: number; digest: string }

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "figma-to-boilerplate-mapping-is-a-versioned-candidate-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-mapping-truth-or-completeness-selection-binding-effectiveness-compatibility-truth-retrieve-import-instantiate-generate-or-execute-assets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "figma-to-boilerplate-mapping-status-is-observational-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-mapping-truth-or-completeness-selection-binding-effectiveness-compatibility-truth-retrieve-import-instantiate-generate-or-execute-assets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "figma-to-boilerplate-mapping-projection-is-read-only-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-mapping-truth-or-completeness-selection-binding-effectiveness-compatibility-truth-retrieve-import-instantiate-generate-or-execute-assets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-counts-statuses-and-subject-target-trace-mapping-assessment-snapshot-digests-only-not-figma-content-design-item-binding-unit-profile-registry-entry-validation-subject-requirement-target-locator-evidence-reviewer-personal-data-secrets-credentials-or-machine-paths" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}
function sameReference(reference: ExactReference, record: { id: string; revision: number } | undefined): boolean {
  return !!record && reference.recordId === record.id && reference.revision === record.revision &&
    reference.digest === canonicalDigest(record)
}

interface ExactDependencies {
  designApplicability: DesignApplicability
  designSystemTokenContract: DesignSystemTokenContract
  responsiveMultiPlatformTargets: ResponsiveMultiPlatformTargets
  finalizedFigmaSnapshotImport: FinalizedFigmaSnapshotImport
  designToRequirementBinding: DesignToRequirementBinding
  designBaseline: DesignBaseline
  implementationUnitModel: ImplementationUnitModel
  technologyProfile: TechnologyProfile
  boilerplateRegistry: BoilerplateRegistry
  boilerplateSelectionBinding: BoilerplateSelectionBinding
  boilerplateCompatibilityValidation: BoilerplateCompatibilityValidation
}

interface MappingAssessment {
  designBindingCount: number
  missingSubjectCount: number
  invalidSubjectCount: number
  targetGapCount: number
  traceGapCount: number
  evidenceGapCount: number
}

export class FigmaToBoilerplateMappingService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly designApplicability: DesignApplicabilityService,
    private readonly designSystemTokenContract: DesignSystemTokenContractService,
    private readonly responsiveMultiPlatformTargets: ResponsiveMultiPlatformTargetsService,
    private readonly finalizedFigmaSnapshotImport: FinalizedFigmaSnapshotImportService,
    private readonly designToRequirementBinding: DesignToRequirementBindingService,
    private readonly designBaseline: DesignBaselineService,
    private readonly implementationUnitModel: ImplementationUnitModelService,
    private readonly technologyProfile: TechnologyProfileService,
    private readonly boilerplateRegistry: BoilerplateRegistryService,
    private readonly boilerplateSelectionBinding: BoilerplateSelectionBindingService,
    private readonly boilerplateCompatibilityValidation: BoilerplateCompatibilityValidationService,
  ) {}

  async create(inputValue: FigmaToBoilerplateMappingInput, actorId: string): Promise<FigmaToBoilerplateMapping> {
    const input = figmaToBoilerplateMappingInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      const assessment = this.assessSubjects(input, dependencies)
      this.requireValidCandidate(input, assessment)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Figma-to-Boilerplate Mapping candidate")
      }
      const now = new Date().toISOString()
      const record = figmaToBoilerplateMappingSchema.parse({
        schemaVersion: 1, kind: "figma-to-boilerplate-mapping-candidate", id: randomUUID(),
        productId: product.id, ...input, initiativeId: initiative.id, revision: 1,
        ...this.composeDigests(input), state: "candidate",
        createdBy: { kind: "human", id: actorId }, updatedBy: { kind: "human", id: actorId },
        createdAt: now, updatedAt: now, authorityBoundary,
      })
      await this.commitVersionedRecord(record, assessment, "figma-to-boilerplate-mapping.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: FigmaToBoilerplateMappingInput, actorId: string): Promise<FigmaToBoilerplateMapping> {
    const input = figmaToBoilerplateMappingInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Figma-to-Boilerplate Mapping revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Figma-to-Boilerplate Mapping Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      const assessment = this.assessSubjects(input, dependencies)
      this.requireValidCandidate(input, assessment)
      const record = figmaToBoilerplateMappingSchema.parse({
        ...current, ...input, productId: product.id, initiativeId: initiative.id,
        revision: current.revision + 1, ...this.composeDigests(input), predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId }, updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, assessment, "figma-to-boilerplate-mapping.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<FigmaToBoilerplateMapping> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Figma-to-Boilerplate Mapping ID")), figmaToBoilerplateMappingSchema)
  }

  async readCurrent(initiativeId: string): Promise<FigmaToBoilerplateMapping | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const matches = (await this.listRecords("figma-to-boilerplate-mappings", currentRecordPattern, figmaToBoilerplateMappingSchema))
      .filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Figma-to-Boilerplate Mapping candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<FigmaToBoilerplateMapping> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Figma-to-Boilerplate Mapping history revision must be a positive integer")
    const recordId = this.requireUuid(id, "Figma-to-Boilerplate Mapping ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), figmaToBoilerplateMappingSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Figma-to-Boilerplate Mapping history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<FigmaToBoilerplateMapping[]> {
    const recordId = this.requireUuid(id, "Figma-to-Boilerplate Mapping ID")
    const records = await this.listRecords(
      "figma-to-boilerplate-mapping-history",
      new RegExp(`^figma-to-boilerplate-mapping-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      figmaToBoilerplateMappingSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Figma-to-Boilerplate Mapping history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<FigmaToBoilerplateMappingStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, ...records] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), ...this.readDependencies(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const dependencies = this.toDependencies(records)
    const dependencyNames: (keyof ExactDependencies)[] = [
      "designApplicability", "designSystemTokenContract", "responsiveMultiPlatformTargets",
      "finalizedFigmaSnapshotImport", "designToRequirementBinding", "designBaseline",
      "implementationUnitModel", "technologyProfile", "boilerplateRegistry",
      "boilerplateSelectionBinding", "boilerplateCompatibilityValidation",
    ]
    const staleBindingCount = candidate && canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative)) ? 1 : 0
    const staleDependencyCount = candidate ? dependencyNames.filter((name) => !sameReference(candidate[name], dependencies?.[name])).length : 0
    const assessment = candidate && dependencies ? this.assessSubjects(candidate, dependencies) : this.emptyAssessment(dependencies?.designToRequirementBinding)
    let invalidCandidateCount = 0
    if (candidate) {
      const digests = this.composeDigests(candidate)
      if (candidate.mappingSubjectCatalogDigest !== digests.mappingSubjectCatalogDigest ||
          candidate.targetCatalogDigest !== digests.targetCatalogDigest ||
          candidate.traceReceiptDigest !== digests.traceReceiptDigest ||
          candidate.mappingReceiptDigest !== digests.mappingReceiptDigest ||
          candidate.assessmentReceiptDigest !== digests.assessmentReceiptDigest) invalidCandidateCount = 1
    }
    const subjects = candidate?.subjects ?? []
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Figma-to-Boilerplate Mapping candidate exists for this Initiative")
    if (staleBindingCount) reasons.push("The mapping candidate does not bind the exact current Product and Initiative")
    if (staleDependencyCount) reasons.push(`The mapping candidate has ${staleDependencyCount} stale or missing exact governed dependencies`)
    if (assessment.missingSubjectCount) reasons.push("One or more Design-to-Requirement bindings lack a mapping subject")
    if (assessment.invalidSubjectCount) reasons.push("One or more mapping subjects do not match the exact governed selection and compatibility scope")
    if (assessment.targetGapCount) reasons.push("One or more mapping subjects lack a usable candidate target or selected boilerplate target")
    if (assessment.traceGapCount) reasons.push("One or more mapping subjects do not preserve the exact design, requirement, or implementation-unit trace")
    if (assessment.evidenceGapCount) reasons.push("One or more mapped subjects lack exact mapping evidence or human attribution")
    if (subjects.some((subject) => subject.outcome !== "candidate-mapped")) reasons.push("One or more design bindings are conflicted, unmapped, or not assessed")
    if (invalidCandidateCount) reasons.push("The Figma-to-Boilerplate Mapping receipt digests are invalid")
    if (unresolvedQuestionCount) reasons.push("The candidate records unresolved Figma-to-Boilerplate Mapping questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    const counts = this.counts(subjects)
    return figmaToBoilerplateMappingStatusSchema.parse({
      schemaVersion: 1, kind: "figma-to-boilerplate-mapping-status", productId: product.id,
      productRevision: revisionOf(product), initiativeId: initiative.id, initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate), ...Object.fromEntries(dependencyNames.map((name) => [name, candidate[name]])) } : {}),
      designBindingCount: assessment.designBindingCount, subjectCount: subjects.length, ...counts,
      missingSubjectCount: assessment.missingSubjectCount, invalidSubjectCount: assessment.invalidSubjectCount,
      targetGapCount: assessment.targetGapCount, traceGapCount: assessment.traceGapCount,
      evidenceGapCount: assessment.evidenceGapCount, staleBindingCount, staleDependencyCount,
      invalidCandidateCount, unresolvedQuestionCount, reviewState,
      state: reasons.length === 0 ? "candidate-complete" : "attention-required", reasons,
      assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary,
    })
  }

  async project(initiativeId: string): Promise<FigmaToBoilerplateMappingProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Figma-to-Boilerplate Mapping projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const, kind: "figma-to-boilerplate-mapping-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        mappingSubjectCatalogDigest: candidate.mappingSubjectCatalogDigest, targetCatalogDigest: candidate.targetCatalogDigest,
        traceReceiptDigest: candidate.traceReceiptDigest, mappingReceiptDigest: candidate.mappingReceiptDigest,
        assessmentReceiptDigest: candidate.assessmentReceiptDigest, subjectCount: candidate.subjects.length,
        ...this.outcomeCounts(candidate.subjects), reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary,
    }
    return figmaToBoilerplateMappingProjectionSchema.parse({
      ...projectionWithoutDigest, snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("figma-to-boilerplate-mappings", currentRecordPattern, figmaToBoilerplateMappingSchema)
    for (const candidate of records) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Figma-to-Boilerplate Mapping candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.state === "attention-required") issues.push({
          code: "figma-to-boilerplate-mapping.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has stale, incomplete, invalid, or unresolved Figma-to-Boilerplate Mapping candidates.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "create-superseding-revision"],
        })
      } catch (error) {
        issues.push({
          code: "figma-to-boilerplate-mapping.invalid", severity: "error",
          message: `Figma-to-Boilerplate Mapping ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private assessSubjects(input: Pick<FigmaToBoilerplateMappingInput, "subjects" | "reviewState">, dependencies: ExactDependencies): MappingAssessment {
    const bindings = dependencies.designToRequirementBinding.bindings
    const bindingByKey = new Map(bindings.map((binding) => [binding.key, binding]))
    const subjectByBinding = new Map(input.subjects.map((subject) => [subject.designBindingKey, subject]))
    const decisions = new Map(dependencies.boilerplateSelectionBinding.decisions.map((decision) => [decision.id, decision]))
    const compatibilitySubjects = new Map(dependencies.boilerplateCompatibilityValidation.subjects.map((subject) => [subject.id, subject]))
    const unitIds = new Set(dependencies.implementationUnitModel.units.map((unit) => unit.id))
    let invalidSubjectCount = 0
    let targetGapCount = 0
    let traceGapCount = 0
    let evidenceGapCount = 0
    for (const [index, subject] of input.subjects.entries()) {
      const binding = bindingByKey.get(subject.designBindingKey)
      const decision = decisions.get(subject.bindingDecisionId)
      const compatibility = compatibilitySubjects.get(subject.compatibilityValidationSubjectId)
      if (subject.ordinal !== index + 1 || !decision || decision.disposition !== "candidate-selected" ||
          !compatibility || compatibility.bindingDecisionId !== subject.bindingDecisionId ||
          subject.implementationUnitId !== decision.implementationUnitId ||
          subject.technologyProfileId !== decision.technologyProfileId ||
          subject.boilerplateRegistryEntryId !== decision.boilerplateRegistryEntryId ||
          compatibility.implementationUnitId !== subject.implementationUnitId ||
          compatibility.technologyProfileId !== subject.technologyProfileId ||
          compatibility.boilerplateRegistryEntryId !== subject.boilerplateRegistryEntryId) invalidSubjectCount += 1
      if (!decision || decision.disposition !== "candidate-selected" || !compatibility ||
          compatibility.outcome === "candidate-incompatible" || !subject.targetCandidate.trim()) targetGapCount += 1
      if (!binding || binding.designItemKey !== subject.designItemKey || binding.designItemKind !== subject.designItemKind ||
          canonicalDigest(binding.requirementKeys) !== canonicalDigest(subject.requirementKeys) ||
          !unitIds.has(subject.implementationUnitId)) traceGapCount += 1
      if (subject.outcome === "candidate-mapped" &&
          (subject.evidenceReferences.length === 0 || !subject.mappedBy || !subject.mappedAt)) evidenceGapCount += 1
    }
    return {
      designBindingCount: bindings.length,
      missingSubjectCount: bindings.filter((binding) => !subjectByBinding.has(binding.key)).length,
      invalidSubjectCount, targetGapCount, traceGapCount, evidenceGapCount,
    }
  }

  private requireValidCandidate(input: FigmaToBoilerplateMappingInput, assessment: MappingAssessment): void {
    const incomplete = input.subjects.filter((subject) => subject.outcome !== "candidate-mapped").length
    const gaps = assessment.missingSubjectCount + assessment.invalidSubjectCount + assessment.targetGapCount +
      assessment.traceGapCount + assessment.evidenceGapCount + incomplete
    if (input.reviewState === "ready-for-human-review" && gaps > 0) {
      throw new Error("Review-ready Figma-to-Boilerplate Mapping requires one exact evidence-backed mapped candidate for every current Design-to-Requirement binding with matching selected-boilerplate, compatibility, target, requirement, and implementation-unit trace")
    }
  }

  private emptyAssessment(binding: DesignToRequirementBinding | undefined): MappingAssessment {
    return { designBindingCount: binding?.bindings.length ?? 0, missingSubjectCount: 0, invalidSubjectCount: 0, targetGapCount: 0, traceGapCount: 0, evidenceGapCount: 0 }
  }

  private counts(subjects: FigmaToBoilerplateMappingInput["subjects"]) {
    return {
      ...this.outcomeCounts(subjects),
      componentMappingCount: subjects.filter((subject) => subject.mappingKind === "component").length,
      tokenMappingCount: subjects.filter((subject) => subject.mappingKind === "token").length,
      layoutMappingCount: subjects.filter((subject) => subject.mappingKind === "layout").length,
      responsiveBehaviorMappingCount: subjects.filter((subject) => subject.mappingKind === "responsive-behavior").length,
      platformTargetMappingCount: subjects.filter((subject) => subject.mappingKind === "platform-target").length,
    }
  }

  private outcomeCounts(subjects: FigmaToBoilerplateMappingInput["subjects"]) {
    return {
      mappedCandidateCount: subjects.filter((subject) => subject.outcome === "candidate-mapped").length,
      conflictCandidateCount: subjects.filter((subject) => subject.outcome === "candidate-conflict").length,
      unmappedCandidateCount: subjects.filter((subject) => subject.outcome === "candidate-unmapped").length,
      notAssessedCount: subjects.filter((subject) => subject.outcome === "not-assessed").length,
    }
  }

  private composeDigests(input: FigmaToBoilerplateMappingInput) {
    const mappingSubjectCatalogDigest = canonicalDigest(input.subjects.map((subject) => ({
      id: subject.id, ordinal: subject.ordinal, designBindingKey: subject.designBindingKey,
      designItemKey: subject.designItemKey, designItemKind: subject.designItemKind,
      mappingKind: subject.mappingKind, outcome: subject.outcome,
    })))
    const targetCatalogDigest = canonicalDigest(input.subjects.map((subject) => ({
      subjectId: subject.id, bindingDecisionId: subject.bindingDecisionId,
      compatibilityValidationSubjectId: subject.compatibilityValidationSubjectId,
      implementationUnitId: subject.implementationUnitId, technologyProfileId: subject.technologyProfileId,
      boilerplateRegistryEntryId: subject.boilerplateRegistryEntryId,
      targetKind: subject.targetKind, targetCandidate: subject.targetCandidate,
    })))
    const traceReceiptDigest = canonicalDigest(input.subjects.map((subject) => ({
      subjectId: subject.id, designBindingKey: subject.designBindingKey, designItemKey: subject.designItemKey,
      requirementKeys: subject.requirementKeys, evidenceReferences: subject.evidenceReferences,
      conflictReferenceCandidates: subject.conflictReferenceCandidates,
    })))
    const mappingReceiptDigest = canonicalDigest({
      designApplicability: input.designApplicability, designSystemTokenContract: input.designSystemTokenContract,
      responsiveMultiPlatformTargets: input.responsiveMultiPlatformTargets,
      finalizedFigmaSnapshotImport: input.finalizedFigmaSnapshotImport,
      designToRequirementBinding: input.designToRequirementBinding, designBaseline: input.designBaseline,
      implementationUnitModel: input.implementationUnitModel, technologyProfile: input.technologyProfile,
      boilerplateRegistry: input.boilerplateRegistry, boilerplateSelectionBinding: input.boilerplateSelectionBinding,
      boilerplateCompatibilityValidation: input.boilerplateCompatibilityValidation,
      mappingSubjectCatalogDigest, targetCatalogDigest, traceReceiptDigest,
      mappingAttribution: input.subjects.map((subject) => ({ id: subject.id, mappedBy: subject.mappedBy, mappedAt: subject.mappedAt })),
    })
    const assessmentReceiptDigest = canonicalDigest({
      context: input.context, informationClassification: input.informationClassification,
      mappingSubjectCatalogDigest, targetCatalogDigest, traceReceiptDigest, mappingReceiptDigest,
      reviewState: input.reviewState, unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations,
      figmaConnectionState: input.figmaConnectionState, returnedFigmaContentState: input.returnedFigmaContentState,
      designValidityState: input.designValidityState, designApprovalState: input.designApprovalState,
      designBaselineDesignationState: input.designBaselineDesignationState, mappingTruthState: input.mappingTruthState,
      mappingCompletenessState: input.mappingCompletenessState,
      selectionBindingEffectivenessState: input.selectionBindingEffectivenessState,
      compatibilityTruthState: input.compatibilityTruthState, sourceRetrievalState: input.sourceRetrievalState,
      assetImportInstantiationState: input.assetImportInstantiationState, codeGenerationState: input.codeGenerationState,
      implementationReadinessState: input.implementationReadinessState,
      implementationCompletenessState: input.implementationCompletenessState,
      assignmentExecutionState: input.assignmentExecutionState, acceptanceDecisionState: input.acceptanceDecisionState,
      mergeReadinessState: input.mergeReadinessState, releaseReadinessState: input.releaseReadinessState,
      deploymentReadinessState: input.deploymentReadinessState, actionAuthorityState: input.actionAuthorityState,
    })
    return { mappingSubjectCatalogDigest, targetCatalogDigest, traceReceiptDigest, mappingReceiptDigest, assessmentReceiptDigest }
  }

  private readDependencies(initiativeId: string): Promise<unknown>[] {
    return [
      this.designApplicability.readCurrent(initiativeId), this.designSystemTokenContract.readCurrent(initiativeId),
      this.responsiveMultiPlatformTargets.readCurrent(initiativeId), this.finalizedFigmaSnapshotImport.readCurrent(initiativeId),
      this.designToRequirementBinding.readCurrent(initiativeId), this.designBaseline.readCurrent(initiativeId),
      this.implementationUnitModel.readCurrent(initiativeId), this.technologyProfile.readCurrent(initiativeId),
      this.boilerplateRegistry.readCurrent(initiativeId), this.boilerplateSelectionBinding.readCurrent(initiativeId),
      this.boilerplateCompatibilityValidation.readCurrent(initiativeId),
    ]
  }

  private toDependencies(records: unknown[]): ExactDependencies | undefined {
    if (records.some((record) => !record)) return undefined
    const [designApplicability, designSystemTokenContract, responsiveMultiPlatformTargets,
      finalizedFigmaSnapshotImport, designToRequirementBinding, designBaseline, implementationUnitModel,
      technologyProfile, boilerplateRegistry, boilerplateSelectionBinding, boilerplateCompatibilityValidation] = records
    return { designApplicability, designSystemTokenContract, responsiveMultiPlatformTargets,
      finalizedFigmaSnapshotImport, designToRequirementBinding, designBaseline, implementationUnitModel,
      technologyProfile, boilerplateRegistry, boilerplateSelectionBinding, boilerplateCompatibilityValidation } as ExactDependencies
  }

  private async requireExactDependencies(input: FigmaToBoilerplateMappingInput): Promise<ExactDependencies> {
    const records = await Promise.all(this.readDependencies(input.initiativeId))
    const dependencies = this.toDependencies(records)
    if (!dependencies) throw new Error("Figma-to-Boilerplate Mapping requires all 11 current governed dependencies")
    const names: (keyof ExactDependencies)[] = [
      "designApplicability", "designSystemTokenContract", "responsiveMultiPlatformTargets",
      "finalizedFigmaSnapshotImport", "designToRequirementBinding", "designBaseline",
      "implementationUnitModel", "technologyProfile", "boilerplateRegistry",
      "boilerplateSelectionBinding", "boilerplateCompatibilityValidation",
    ]
    for (const name of names) {
      if (!sameReference(input[name], dependencies[name])) {
        throw new Error(`Figma-to-Boilerplate Mapping must reference the exact current ${name} candidate`)
      }
    }
    return dependencies
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Figma-to-Boilerplate Mapping Initiative targets a different Product")
    if (canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) {
      throw new Error("Figma-to-Boilerplate Mapping must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return { productRevision: revisionOf(product), productDigest: canonicalDigest(product), initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Figma-to-Boilerplate Mapping is immutable`)
    return { product, initiative }
  }

  private async commitVersionedRecord(record: FigmaToBoilerplateMapping, assessment: MappingAssessment, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [this.governed(this.currentPath(record.id), record, figmaToBoilerplateMappingSchema), this.governed(this.historyPath(record.id, record.revision), record, figmaToBoilerplateMappingSchema)],
      audit: {
        eventType, actor: { kind: "human", id: actorId }, subjectId: record.id,
        payload: {
          initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record),
          mappingSubjectCatalogDigest: record.mappingSubjectCatalogDigest, targetCatalogDigest: record.targetCatalogDigest,
          traceReceiptDigest: record.traceReceiptDigest, mappingReceiptDigest: record.mappingReceiptDigest,
          assessmentReceiptDigest: record.assessmentReceiptDigest, predecessorDigest: record.predecessorDigest,
          designApplicability: record.designApplicability, designSystemTokenContract: record.designSystemTokenContract,
          responsiveMultiPlatformTargets: record.responsiveMultiPlatformTargets,
          finalizedFigmaSnapshotImport: record.finalizedFigmaSnapshotImport,
          designToRequirementBinding: record.designToRequirementBinding, designBaseline: record.designBaseline,
          implementationUnitModel: record.implementationUnitModel, technologyProfile: record.technologyProfile,
          boilerplateRegistry: record.boilerplateRegistry, boilerplateSelectionBinding: record.boilerplateSelectionBinding,
          boilerplateCompatibilityValidation: record.boilerplateCompatibilityValidation,
          subjectCount: record.subjects.length, ...this.counts(record.subjects), ...assessment,
          reviewState: record.reviewState, figmaConnectionState: record.figmaConnectionState,
          returnedFigmaContentState: record.returnedFigmaContentState, designValidityState: record.designValidityState,
          designApprovalState: record.designApprovalState, designBaselineDesignationState: record.designBaselineDesignationState,
          mappingTruthState: record.mappingTruthState, mappingCompletenessState: record.mappingCompletenessState,
          selectionBindingEffectivenessState: record.selectionBindingEffectivenessState,
          compatibilityTruthState: record.compatibilityTruthState, sourceRetrievalState: record.sourceRetrievalState,
          assetImportInstantiationState: record.assetImportInstantiationState, codeGenerationState: record.codeGenerationState,
          implementationReadinessState: record.implementationReadinessState,
          implementationCompletenessState: record.implementationCompletenessState,
          assignmentExecutionState: record.assignmentExecutionState, acceptanceDecisionState: record.acceptanceDecisionState,
          mergeReadinessState: record.mergeReadinessState, releaseReadinessState: record.releaseReadinessState,
          deploymentReadinessState: record.deploymentReadinessState, actionAuthorityState: record.actionAuthorityState,
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string { return this.repository.resolve("figma-to-boilerplate-mappings", `${id}.json`) }
  private historyPath(id: string, revision: number): string { return this.repository.resolve("figma-to-boilerplate-mapping-history", `figma-to-boilerplate-mapping-${id}-r${revision}.json`) }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string { const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data }
  private async assertIntegrity(): Promise<void> { const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed") }

  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error }
    if (names.length > inventoryLimit) throw new Error(`Figma-to-Boilerplate Mapping directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>; const rightRecord = right as Record<string, unknown>
      return `${String(leftRecord.id ?? "")}:${String(leftRecord.revision ?? "")}`.localeCompare(`${String(rightRecord.id ?? "")}:${String(rightRecord.revision ?? "")}`)
    })
  }
}
