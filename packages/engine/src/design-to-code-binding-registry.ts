import { randomUUID } from "node:crypto"

import {
  designToCodeBindingRegistryInputSchema,
  designToCodeBindingRegistryProjectionSchema,
  designToCodeBindingRegistrySchema,
  designToCodeBindingRegistryStatusSchema,
  type BoilerplateCompatibilityValidation,
  type BoilerplateSelectionBinding,
  type BusinessContextBinding,
  type DesignBaseline,
  type DesignToCodeBindingRegistry,
  type DesignToCodeBindingRegistryInput,
  type DesignToCodeBindingRegistryProjection,
  type DesignToCodeBindingRegistryStatus,
  type DesignToRequirementBinding,
  type FigmaToBoilerplateMapping,
  type FinalizedFigmaSnapshotImport,
  type ImplementationUnitModel,
  type Initiative,
  type Product,
  type TechnologyProfile,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { BoilerplateCompatibilityValidationService } from "./boilerplate-compatibility-validation.js"
import type { BoilerplateSelectionBindingService } from "./boilerplate-selection-binding.js"
import type { DesignBaselineService } from "./design-baseline.js"
import type { DesignToRequirementBindingService } from "./design-to-requirement-binding.js"
import type { FigmaToBoilerplateMappingService } from "./figma-to-boilerplate-mapping.js"
import type { FinalizedFigmaSnapshotImportService } from "./finalized-figma-snapshot-import.js"
import type { ImplementationUnitModelService } from "./implementation-unit-model.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { TechnologyProfileService } from "./technology-profile.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type ExactReference = { recordId: string; revision: number; digest: string }

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "design-to-code-binding-registry-is-a-versioned-candidate-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-mapping-or-binding-truth-or-completeness-repository-path-or-symbol-truth-create-or-change-code-targets-retrieve-import-instantiate-generate-or-execute-assets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "design-to-code-binding-registry-status-is-observational-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-mapping-or-binding-truth-or-completeness-repository-path-or-symbol-truth-create-or-change-code-targets-retrieve-import-instantiate-generate-or-execute-assets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "design-to-code-binding-registry-projection-is-read-only-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-mapping-or-binding-truth-or-completeness-repository-path-or-symbol-truth-create-or-change-code-targets-retrieve-import-instantiate-generate-or-execute-assets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-counts-statuses-and-subject-target-trace-binding-assessment-snapshot-digests-only-not-figma-content-design-item-mapping-unit-requirement-repository-module-path-symbol-evidence-reviewer-personal-data-secrets-credentials-or-machine-paths" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}
function sameReference(reference: ExactReference, record: { id: string; revision: number } | undefined): boolean {
  return !!record && reference.recordId === record.id && reference.revision === record.revision &&
    reference.digest === canonicalDigest(record)
}

interface ExactDependencies {
  designBaseline: DesignBaseline
  finalizedFigmaSnapshotImport: FinalizedFigmaSnapshotImport
  designToRequirementBinding: DesignToRequirementBinding
  figmaToBoilerplateMapping: FigmaToBoilerplateMapping
  implementationUnitModel: ImplementationUnitModel
  technologyProfile: TechnologyProfile
  boilerplateSelectionBinding: BoilerplateSelectionBinding
  boilerplateCompatibilityValidation: BoilerplateCompatibilityValidation
}

interface BindingAssessment {
  mappingSubjectCount: number
  missingSubjectCount: number
  invalidSubjectCount: number
  targetGapCount: number
  traceGapCount: number
  evidenceGapCount: number
  duplicateTargetCount: number
}

export class DesignToCodeBindingRegistryService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly designBaseline: DesignBaselineService,
    private readonly finalizedFigmaSnapshotImport: FinalizedFigmaSnapshotImportService,
    private readonly designToRequirementBinding: DesignToRequirementBindingService,
    private readonly figmaToBoilerplateMapping: FigmaToBoilerplateMappingService,
    private readonly implementationUnitModel: ImplementationUnitModelService,
    private readonly technologyProfile: TechnologyProfileService,
    private readonly boilerplateSelectionBinding: BoilerplateSelectionBindingService,
    private readonly boilerplateCompatibilityValidation: BoilerplateCompatibilityValidationService,
  ) {}

  async create(inputValue: DesignToCodeBindingRegistryInput, actorId: string): Promise<DesignToCodeBindingRegistry> {
    const input = designToCodeBindingRegistryInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      const assessment = this.assessSubjects(input, dependencies)
      this.requireValidCandidate(input, assessment)
      if (await this.readCurrent(initiative.id)) throw new Error("An Initiative can have only one current Design-to-Code Binding Registry candidate")
      const now = new Date().toISOString()
      const record = designToCodeBindingRegistrySchema.parse({
        schemaVersion: 1, kind: "design-to-code-binding-registry-candidate", id: randomUUID(),
        productId: product.id, ...input, initiativeId: initiative.id, revision: 1,
        ...this.composeDigests(input), state: "candidate",
        createdBy: { kind: "human", id: actorId }, updatedBy: { kind: "human", id: actorId },
        createdAt: now, updatedAt: now, authorityBoundary,
      })
      await this.commitVersionedRecord(record, assessment, "design-to-code-binding-registry.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: DesignToCodeBindingRegistryInput, actorId: string): Promise<DesignToCodeBindingRegistry> {
    const input = designToCodeBindingRegistryInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Design-to-Code Binding Registry revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Design-to-Code Binding Registry Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      const assessment = this.assessSubjects(input, dependencies)
      this.requireValidCandidate(input, assessment)
      const record = designToCodeBindingRegistrySchema.parse({
        ...current, ...input, productId: product.id, initiativeId: initiative.id,
        revision: current.revision + 1, ...this.composeDigests(input), predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId }, updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, assessment, "design-to-code-binding-registry.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<DesignToCodeBindingRegistry> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Design-to-Code Binding Registry ID")), designToCodeBindingRegistrySchema)
  }

  async readCurrent(initiativeId: string): Promise<DesignToCodeBindingRegistry | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const matches = (await this.listRecords("design-to-code-binding-registries", currentRecordPattern, designToCodeBindingRegistrySchema))
      .filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Design-to-Code Binding Registry candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<DesignToCodeBindingRegistry> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Design-to-Code Binding Registry history revision must be a positive integer")
    const recordId = this.requireUuid(id, "Design-to-Code Binding Registry ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), designToCodeBindingRegistrySchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Design-to-Code Binding Registry history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<DesignToCodeBindingRegistry[]> {
    const recordId = this.requireUuid(id, "Design-to-Code Binding Registry ID")
    const records = await this.listRecords(
      "design-to-code-binding-registry-history",
      new RegExp(`^design-to-code-binding-registry-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      designToCodeBindingRegistrySchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Design-to-Code Binding Registry history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<DesignToCodeBindingRegistryStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, ...records] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), ...this.readDependencies(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const dependencies = this.toDependencies(records)
    const dependencyNames: (keyof ExactDependencies)[] = [
      "designBaseline", "finalizedFigmaSnapshotImport", "designToRequirementBinding",
      "figmaToBoilerplateMapping", "implementationUnitModel", "technologyProfile",
      "boilerplateSelectionBinding", "boilerplateCompatibilityValidation",
    ]
    const staleBindingCount = candidate && canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative)) ? 1 : 0
    const staleDependencyCount = candidate ? dependencyNames.filter((name) => !sameReference(candidate[name], dependencies?.[name])).length : 0
    const assessment = candidate && dependencies ? this.assessSubjects(candidate, dependencies) : this.emptyAssessment(dependencies?.figmaToBoilerplateMapping)
    let invalidCandidateCount = 0
    if (candidate) {
      const digests = this.composeDigests(candidate)
      if (candidate.bindingSubjectCatalogDigest !== digests.bindingSubjectCatalogDigest ||
          candidate.codeTargetCatalogDigest !== digests.codeTargetCatalogDigest ||
          candidate.traceReceiptDigest !== digests.traceReceiptDigest ||
          candidate.bindingReceiptDigest !== digests.bindingReceiptDigest ||
          candidate.assessmentReceiptDigest !== digests.assessmentReceiptDigest) invalidCandidateCount = 1
    }
    const subjects = candidate?.subjects ?? []
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Design-to-Code Binding Registry candidate exists for this Initiative")
    if (staleBindingCount) reasons.push("The binding registry candidate does not bind the exact current Product and Initiative")
    if (staleDependencyCount) reasons.push(`The binding registry candidate has ${staleDependencyCount} stale or missing exact governed dependencies`)
    if (assessment.missingSubjectCount) reasons.push("One or more Figma-to-Boilerplate mapping subjects lack a design-to-code binding subject")
    if (assessment.invalidSubjectCount) reasons.push("One or more binding subjects do not match the exact governed mapping and implementation scope")
    if (assessment.targetGapCount) reasons.push("One or more binding subjects lack a usable candidate code target or mapped boilerplate subject")
    if (assessment.traceGapCount) reasons.push("One or more binding subjects do not preserve the exact design, requirement, mapping, or implementation-unit trace")
    if (assessment.evidenceGapCount) reasons.push("One or more bound subjects lack exact binding evidence or human attribution")
    if (assessment.duplicateTargetCount) reasons.push("One or more candidate code targets are bound by multiple mapping subjects")
    if (subjects.some((subject) => subject.disposition !== "candidate-bound")) reasons.push("One or more mapping subjects are conflicted, unbound, or not assessed")
    if (invalidCandidateCount) reasons.push("The Design-to-Code Binding Registry receipt digests are invalid")
    if (unresolvedQuestionCount) reasons.push("The candidate records unresolved Design-to-Code Binding Registry questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return designToCodeBindingRegistryStatusSchema.parse({
      schemaVersion: 1, kind: "design-to-code-binding-registry-status", productId: product.id,
      productRevision: revisionOf(product), initiativeId: initiative.id, initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate), ...Object.fromEntries(dependencyNames.map((name) => [name, candidate[name]])) } : {}),
      mappingSubjectCount: assessment.mappingSubjectCount, subjectCount: subjects.length, ...this.outcomeCounts(subjects),
      missingSubjectCount: assessment.missingSubjectCount, invalidSubjectCount: assessment.invalidSubjectCount,
      targetGapCount: assessment.targetGapCount, traceGapCount: assessment.traceGapCount,
      evidenceGapCount: assessment.evidenceGapCount, duplicateTargetCount: assessment.duplicateTargetCount,
      staleBindingCount, staleDependencyCount, invalidCandidateCount, unresolvedQuestionCount, reviewState,
      state: reasons.length === 0 ? "candidate-complete" : "attention-required", reasons,
      assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary,
    })
  }

  async project(initiativeId: string): Promise<DesignToCodeBindingRegistryProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Design-to-Code Binding Registry projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const, kind: "design-to-code-binding-registry-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        bindingSubjectCatalogDigest: candidate.bindingSubjectCatalogDigest,
        codeTargetCatalogDigest: candidate.codeTargetCatalogDigest,
        traceReceiptDigest: candidate.traceReceiptDigest, bindingReceiptDigest: candidate.bindingReceiptDigest,
        assessmentReceiptDigest: candidate.assessmentReceiptDigest, subjectCount: candidate.subjects.length,
        ...this.outcomeCounts(candidate.subjects), reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary,
    }
    return designToCodeBindingRegistryProjectionSchema.parse({
      ...projectionWithoutDigest, snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("design-to-code-binding-registries", currentRecordPattern, designToCodeBindingRegistrySchema)
    for (const candidate of records) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Design-to-Code Binding Registry candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.state === "attention-required") issues.push({
          code: "design-to-code-binding-registry.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has stale, incomplete, invalid, or unresolved Design-to-Code Binding Registry candidates.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "create-superseding-revision"],
        })
      } catch (error) {
        issues.push({
          code: "design-to-code-binding-registry.invalid", severity: "error",
          message: `Design-to-Code Binding Registry ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private assessSubjects(input: Pick<DesignToCodeBindingRegistryInput, "subjects" | "reviewState">, dependencies: ExactDependencies): BindingAssessment {
    const mappings = dependencies.figmaToBoilerplateMapping.subjects
    const mappingById = new Map(mappings.map((mapping) => [mapping.id, mapping]))
    const subjectByMapping = new Map(input.subjects.map((subject) => [subject.mappingSubjectId, subject]))
    const unitIds = new Set(dependencies.implementationUnitModel.units.map((unit) => unit.id))
    const targetCounts = new Map<string, number>()
    let invalidSubjectCount = 0
    let targetGapCount = 0
    let traceGapCount = 0
    let evidenceGapCount = 0
    for (const [index, subject] of input.subjects.entries()) {
      const mapping = mappingById.get(subject.mappingSubjectId)
      const targetKey = `${subject.repositoryCandidate}:${subject.moduleCandidate}:${subject.pathCandidate}:${subject.symbolCandidate ?? ""}`
      targetCounts.set(targetKey, (targetCounts.get(targetKey) ?? 0) + 1)
      if (subject.ordinal !== index + 1 || !mapping || mapping.outcome !== "candidate-mapped" ||
          !unitIds.has(subject.implementationUnitId)) invalidSubjectCount += 1
      if (!mapping || mapping.outcome !== "candidate-mapped" || !subject.repositoryCandidate ||
          !subject.moduleCandidate || !subject.pathCandidate) targetGapCount += 1
      if (!mapping || mapping.designBindingKey !== subject.designBindingKey ||
          mapping.designItemKey !== subject.designItemKey || mapping.designItemKind !== subject.designItemKind ||
          mapping.mappingKind !== subject.mappingKind || mapping.implementationUnitId !== subject.implementationUnitId ||
          canonicalDigest(mapping.requirementKeys) !== canonicalDigest(subject.requirementKeys)) traceGapCount += 1
      if (subject.disposition === "candidate-bound" &&
          (subject.evidenceReferences.length === 0 || !subject.boundBy || !subject.boundAt)) evidenceGapCount += 1
    }
    return {
      mappingSubjectCount: mappings.length,
      missingSubjectCount: mappings.filter((mapping) => !subjectByMapping.has(mapping.id)).length,
      invalidSubjectCount, targetGapCount, traceGapCount, evidenceGapCount,
      duplicateTargetCount: [...targetCounts.values()].reduce((count, value) => count + (value > 1 ? value : 0), 0),
    }
  }

  private requireValidCandidate(input: DesignToCodeBindingRegistryInput, assessment: BindingAssessment): void {
    const incomplete = input.subjects.filter((subject) => subject.disposition !== "candidate-bound").length
    const gaps = assessment.missingSubjectCount + assessment.invalidSubjectCount + assessment.targetGapCount +
      assessment.traceGapCount + assessment.evidenceGapCount + assessment.duplicateTargetCount + incomplete
    if (input.reviewState === "ready-for-human-review" && gaps > 0) {
      throw new Error("Review-ready Design-to-Code Binding Registry requires one exact evidence-backed bound candidate for every current Figma-to-Boilerplate mapping subject with unique repository-relative target and matching design, requirement, mapping, and implementation-unit trace")
    }
  }

  private emptyAssessment(mapping: FigmaToBoilerplateMapping | undefined): BindingAssessment {
    return { mappingSubjectCount: mapping?.subjects.length ?? 0, missingSubjectCount: 0, invalidSubjectCount: 0,
      targetGapCount: 0, traceGapCount: 0, evidenceGapCount: 0, duplicateTargetCount: 0 }
  }

  private outcomeCounts(subjects: DesignToCodeBindingRegistryInput["subjects"]) {
    return {
      boundCandidateCount: subjects.filter((subject) => subject.disposition === "candidate-bound").length,
      conflictCandidateCount: subjects.filter((subject) => subject.disposition === "candidate-conflict").length,
      unboundCandidateCount: subjects.filter((subject) => subject.disposition === "candidate-unbound").length,
      notAssessedCount: subjects.filter((subject) => subject.disposition === "not-assessed").length,
    }
  }

  private composeDigests(input: DesignToCodeBindingRegistryInput) {
    const bindingSubjectCatalogDigest = canonicalDigest(input.subjects.map((subject) => ({
      id: subject.id, ordinal: subject.ordinal, mappingSubjectId: subject.mappingSubjectId,
      designBindingKey: subject.designBindingKey, designItemKey: subject.designItemKey,
      designItemKind: subject.designItemKind, mappingKind: subject.mappingKind,
      bindingKind: subject.bindingKind, disposition: subject.disposition,
    })))
    const codeTargetCatalogDigest = canonicalDigest(input.subjects.map((subject) => ({
      subjectId: subject.id, implementationUnitId: subject.implementationUnitId,
      repositoryCandidate: subject.repositoryCandidate, moduleCandidate: subject.moduleCandidate,
      pathCandidate: subject.pathCandidate, symbolCandidate: subject.symbolCandidate,
    })))
    const traceReceiptDigest = canonicalDigest(input.subjects.map((subject) => ({
      subjectId: subject.id, mappingSubjectId: subject.mappingSubjectId,
      designBindingKey: subject.designBindingKey, designItemKey: subject.designItemKey,
      implementationUnitId: subject.implementationUnitId, requirementKeys: subject.requirementKeys,
      evidenceReferences: subject.evidenceReferences, conflictReferenceCandidates: subject.conflictReferenceCandidates,
    })))
    const bindingReceiptDigest = canonicalDigest({
      designBaseline: input.designBaseline, finalizedFigmaSnapshotImport: input.finalizedFigmaSnapshotImport,
      designToRequirementBinding: input.designToRequirementBinding,
      figmaToBoilerplateMapping: input.figmaToBoilerplateMapping,
      implementationUnitModel: input.implementationUnitModel, technologyProfile: input.technologyProfile,
      boilerplateSelectionBinding: input.boilerplateSelectionBinding,
      boilerplateCompatibilityValidation: input.boilerplateCompatibilityValidation,
      bindingSubjectCatalogDigest, codeTargetCatalogDigest, traceReceiptDigest,
      bindingAttribution: input.subjects.map((subject) => ({ id: subject.id, boundBy: subject.boundBy, boundAt: subject.boundAt })),
    })
    const assessmentReceiptDigest = canonicalDigest({
      context: input.context, informationClassification: input.informationClassification,
      bindingSubjectCatalogDigest, codeTargetCatalogDigest, traceReceiptDigest, bindingReceiptDigest,
      reviewState: input.reviewState, unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations,
      figmaConnectionState: input.figmaConnectionState, returnedFigmaContentState: input.returnedFigmaContentState,
      designValidityState: input.designValidityState, designApprovalState: input.designApprovalState,
      designBaselineDesignationState: input.designBaselineDesignationState,
      mappingTruthState: input.mappingTruthState, mappingCompletenessState: input.mappingCompletenessState,
      bindingTruthState: input.bindingTruthState, bindingCompletenessState: input.bindingCompletenessState,
      repositoryTruthState: input.repositoryTruthState, pathSymbolTruthState: input.pathSymbolTruthState,
      codeTargetMutationState: input.codeTargetMutationState, codeGenerationState: input.codeGenerationState,
      implementationReadinessState: input.implementationReadinessState,
      implementationCompletenessState: input.implementationCompletenessState,
      assignmentExecutionState: input.assignmentExecutionState, acceptanceDecisionState: input.acceptanceDecisionState,
      mergeReadinessState: input.mergeReadinessState, releaseReadinessState: input.releaseReadinessState,
      deploymentReadinessState: input.deploymentReadinessState, actionAuthorityState: input.actionAuthorityState,
    })
    return { bindingSubjectCatalogDigest, codeTargetCatalogDigest, traceReceiptDigest, bindingReceiptDigest, assessmentReceiptDigest }
  }

  private readDependencies(initiativeId: string): Promise<unknown>[] {
    return [
      this.designBaseline.readCurrent(initiativeId), this.finalizedFigmaSnapshotImport.readCurrent(initiativeId),
      this.designToRequirementBinding.readCurrent(initiativeId), this.figmaToBoilerplateMapping.readCurrent(initiativeId),
      this.implementationUnitModel.readCurrent(initiativeId), this.technologyProfile.readCurrent(initiativeId),
      this.boilerplateSelectionBinding.readCurrent(initiativeId), this.boilerplateCompatibilityValidation.readCurrent(initiativeId),
    ]
  }

  private toDependencies(records: unknown[]): ExactDependencies | undefined {
    if (records.some((record) => !record)) return undefined
    const [designBaseline, finalizedFigmaSnapshotImport, designToRequirementBinding, figmaToBoilerplateMapping,
      implementationUnitModel, technologyProfile, boilerplateSelectionBinding, boilerplateCompatibilityValidation] = records
    return { designBaseline, finalizedFigmaSnapshotImport, designToRequirementBinding, figmaToBoilerplateMapping,
      implementationUnitModel, technologyProfile, boilerplateSelectionBinding,
      boilerplateCompatibilityValidation } as ExactDependencies
  }

  private async requireExactDependencies(input: DesignToCodeBindingRegistryInput): Promise<ExactDependencies> {
    const dependencies = this.toDependencies(await Promise.all(this.readDependencies(input.initiativeId)))
    if (!dependencies) throw new Error("Design-to-Code Binding Registry requires all 8 current governed dependencies")
    const names: (keyof ExactDependencies)[] = [
      "designBaseline", "finalizedFigmaSnapshotImport", "designToRequirementBinding",
      "figmaToBoilerplateMapping", "implementationUnitModel", "technologyProfile",
      "boilerplateSelectionBinding", "boilerplateCompatibilityValidation",
    ]
    for (const name of names) {
      if (!sameReference(input[name], dependencies[name])) {
        throw new Error(`Design-to-Code Binding Registry must reference the exact current ${name} candidate`)
      }
    }
    return dependencies
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Design-to-Code Binding Registry Initiative targets a different Product")
    if (canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) {
      throw new Error("Design-to-Code Binding Registry must bind the exact current Product and Initiative revisions and digests")
    }
  }
  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return { productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) }
  }
  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Design-to-Code Binding Registry is immutable`)
    return { product, initiative }
  }

  private async commitVersionedRecord(record: DesignToCodeBindingRegistry, assessment: BindingAssessment, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [this.governed(this.currentPath(record.id), record, designToCodeBindingRegistrySchema),
        this.governed(this.historyPath(record.id, record.revision), record, designToCodeBindingRegistrySchema)],
      audit: {
        eventType, actor: { kind: "human", id: actorId }, subjectId: record.id,
        payload: {
          initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record),
          bindingSubjectCatalogDigest: record.bindingSubjectCatalogDigest,
          codeTargetCatalogDigest: record.codeTargetCatalogDigest, traceReceiptDigest: record.traceReceiptDigest,
          bindingReceiptDigest: record.bindingReceiptDigest, assessmentReceiptDigest: record.assessmentReceiptDigest,
          predecessorDigest: record.predecessorDigest, designBaseline: record.designBaseline,
          finalizedFigmaSnapshotImport: record.finalizedFigmaSnapshotImport,
          designToRequirementBinding: record.designToRequirementBinding,
          figmaToBoilerplateMapping: record.figmaToBoilerplateMapping,
          implementationUnitModel: record.implementationUnitModel, technologyProfile: record.technologyProfile,
          boilerplateSelectionBinding: record.boilerplateSelectionBinding,
          boilerplateCompatibilityValidation: record.boilerplateCompatibilityValidation,
          subjectCount: record.subjects.length, ...this.outcomeCounts(record.subjects), ...assessment,
          reviewState: record.reviewState, figmaConnectionState: record.figmaConnectionState,
          returnedFigmaContentState: record.returnedFigmaContentState, designValidityState: record.designValidityState,
          designApprovalState: record.designApprovalState,
          designBaselineDesignationState: record.designBaselineDesignationState,
          mappingTruthState: record.mappingTruthState, mappingCompletenessState: record.mappingCompletenessState,
          bindingTruthState: record.bindingTruthState, bindingCompletenessState: record.bindingCompletenessState,
          repositoryTruthState: record.repositoryTruthState, pathSymbolTruthState: record.pathSymbolTruthState,
          codeTargetMutationState: record.codeTargetMutationState, codeGenerationState: record.codeGenerationState,
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

  private currentPath(id: string): string { return this.repository.resolve("design-to-code-binding-registries", `${id}.json`) }
  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("design-to-code-binding-registry-history", `design-to-code-binding-registry-${id}-r${revision}.json`)
  }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string {
    const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data
  }
  private async assertIntegrity(): Promise<void> {
    const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed")
  }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error }
    if (names.length > inventoryLimit) throw new Error(`Design-to-Code Binding Registry directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>; const rightRecord = right as Record<string, unknown>
      return `${String(leftRecord.id ?? "")}:${String(leftRecord.revision ?? "")}`.localeCompare(`${String(rightRecord.id ?? "")}:${String(rightRecord.revision ?? "")}`)
    })
  }
}
