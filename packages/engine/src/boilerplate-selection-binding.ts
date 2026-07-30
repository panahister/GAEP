import { randomUUID } from "node:crypto"

import {
  boilerplateSelectionBindingInputSchema,
  boilerplateSelectionBindingProjectionSchema,
  boilerplateSelectionBindingSchema,
  boilerplateSelectionBindingStatusSchema,
  type BoilerplateRegistry,
  type BoilerplateSelectionBinding,
  type BoilerplateSelectionBindingInput,
  type BoilerplateSelectionBindingProjection,
  type BoilerplateSelectionBindingStatus,
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
import type { DependencyMappingService } from "./dependency-mapping.js"
import type { ImplementationUnitModelService } from "./implementation-unit-model.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { TechnologyProfileService } from "./technology-profile.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "boilerplate-selection-binding-is-a-versioned-candidate-and-does-not-establish-organizational-designation-endorsement-approval-support-commitment-selection-decision-effectiveness-binding-effectiveness-compatibility-truth-or-completeness-or-validation-licensing-or-security-approval-exception-waiver-source-retrieval-import-instantiation-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "boilerplate-selection-binding-status-is-observational-and-does-not-establish-organizational-designation-endorsement-approval-support-commitment-selection-decision-effectiveness-binding-effectiveness-compatibility-truth-or-completeness-or-validation-licensing-or-security-approval-exception-waiver-source-retrieval-import-instantiation-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "boilerplate-selection-binding-projection-is-read-only-and-does-not-establish-organizational-designation-endorsement-approval-support-commitment-selection-decision-effectiveness-binding-effectiveness-compatibility-truth-or-completeness-or-validation-licensing-or-security-approval-exception-waiver-source-retrieval-import-instantiation-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-counts-statuses-and-unit-decision-selection-binding-assessment-snapshot-digests-only-not-boilerplate-names-locators-versions-unit-or-profile-identities-rationale-conditions-alternatives-deviations-evidence-decision-roles-personal-data-secrets-credentials-or-machine-paths" as const

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: BoilerplateSelectionBinding) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

interface ExactDependencies {
  units: ImplementationUnitModel
  dependencyMapping: DependencyMapping
  technologyProfile: TechnologyProfile
  boilerplateRegistry: BoilerplateRegistry
}

interface DecisionAssessment {
  missingUnitDecisionCount: number
  invalidSelectionCount: number
  registryGapCount: number
  profileMismatchCount: number
  unitScopeMismatchCount: number
  versionMismatchCount: number
  missingEvidenceCount: number
}

export class BoilerplateSelectionBindingService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly implementationUnitModel: ImplementationUnitModelService,
    private readonly dependencyMapping: DependencyMappingService,
    private readonly technologyProfile: TechnologyProfileService,
    private readonly boilerplateRegistry: BoilerplateRegistryService,
  ) {}

  async create(inputValue: BoilerplateSelectionBindingInput, actorId: string): Promise<BoilerplateSelectionBinding> {
    const input = boilerplateSelectionBindingInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input, initiative)
      const assessment = this.assessDecisions(input, dependencies)
      this.requireValidCandidate(input, assessment)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Boilerplate Selection and Binding candidate")
      }
      const now = new Date().toISOString()
      const record = boilerplateSelectionBindingSchema.parse({
        schemaVersion: 1, kind: "boilerplate-selection-binding-candidate", id: randomUUID(), productId: product.id,
        ...input, initiativeId: initiative.id, revision: 1, ...this.composeDigests(input), state: "candidate",
        createdBy: { kind: "human", id: actorId }, updatedBy: { kind: "human", id: actorId },
        createdAt: now, updatedAt: now, authorityBoundary,
      })
      await this.commitVersionedRecord(record, assessment, "boilerplate-selection-binding.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: BoilerplateSelectionBindingInput,
    actorId: string,
  ): Promise<BoilerplateSelectionBinding> {
    const input = boilerplateSelectionBindingInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Boilerplate Selection and Binding revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Boilerplate Selection and Binding Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input, initiative)
      const assessment = this.assessDecisions(input, dependencies)
      this.requireValidCandidate(input, assessment)
      const record = boilerplateSelectionBindingSchema.parse({
        ...current, ...input, productId: product.id, initiativeId: initiative.id, revision: current.revision + 1,
        ...this.composeDigests(input), predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId }, updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, assessment, "boilerplate-selection-binding.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<BoilerplateSelectionBinding> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Boilerplate Selection and Binding ID")),
      boilerplateSelectionBindingSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<BoilerplateSelectionBinding | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords(
      "boilerplate-selection-bindings", currentRecordPattern, boilerplateSelectionBindingSchema,
    )
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Boilerplate Selection and Binding candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<BoilerplateSelectionBinding> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Boilerplate Selection and Binding history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Boilerplate Selection and Binding ID")
    const record = await this.repository.readJson(
      this.historyPath(recordId, revision), boilerplateSelectionBindingSchema,
    )
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Boilerplate Selection and Binding history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<BoilerplateSelectionBinding[]> {
    const recordId = this.requireUuid(id, "Boilerplate Selection and Binding ID")
    const records = await this.listRecords(
      "boilerplate-selection-binding-history",
      new RegExp(`^boilerplate-selection-binding-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      boilerplateSelectionBindingSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Boilerplate Selection and Binding history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<BoilerplateSelectionBindingStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, units, dependencyMapping, technologyProfile, boilerplateRegistry] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId),
      this.implementationUnitModel.readCurrent(targetId), this.dependencyMapping.readCurrent(targetId),
      this.technologyProfile.readCurrent(targetId), this.boilerplateRegistry.readCurrent(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const staleBindingCount = candidate && canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative)) ? 1 : 0
    const staleImplementationUnitModelCount = candidate && !this.matches(candidate.implementationUnitModel, units) ? 1 : 0
    const staleDependencyMappingCount = candidate && !this.matches(candidate.dependencyMapping, dependencyMapping) ? 1 : 0
    const staleTechnologyProfileCount = candidate && !this.matches(candidate.technologyProfile, technologyProfile) ? 1 : 0
    const staleBoilerplateRegistryCount = candidate && !this.matches(candidate.boilerplateRegistry, boilerplateRegistry) ? 1 : 0
    const dependencies = units && dependencyMapping && technologyProfile && boilerplateRegistry
      ? { units, dependencyMapping, technologyProfile, boilerplateRegistry }
      : undefined
    const baseAssessment = candidate && dependencies ? this.assessDecisions(candidate, dependencies) : this.emptyAssessment()
    let invalidCandidateCount = 0
    if (candidate) {
      const digests = this.composeDigests(candidate)
      if (candidate.unitDecisionCatalogDigest !== digests.unitDecisionCatalogDigest ||
          candidate.selectionReceiptDigest !== digests.selectionReceiptDigest ||
          candidate.bindingReceiptDigest !== digests.bindingReceiptDigest ||
          candidate.assessmentReceiptDigest !== digests.assessmentReceiptDigest) invalidCandidateCount = 1
    }
    const decisions = candidate?.decisions ?? []
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Boilerplate Selection and Binding candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind the exact current Product and Initiative")
    if (staleImplementationUnitModelCount > 0) reasons.push("The candidate does not bind the exact current Implementation Unit Model")
    if (staleDependencyMappingCount > 0) reasons.push("The candidate does not bind the exact current Dependency Mapping")
    if (staleTechnologyProfileCount > 0) reasons.push("The candidate does not bind the exact current Technology Profile")
    if (staleBoilerplateRegistryCount > 0) reasons.push("The candidate does not bind the exact current Boilerplate Registry")
    if (baseAssessment.missingUnitDecisionCount > 0) reasons.push("One or more current implementation units lack a binding decision candidate")
    if (baseAssessment.invalidSelectionCount > 0) reasons.push("One or more binding decisions reference an invalid selected or alternative registry entry")
    if (baseAssessment.registryGapCount > 0) reasons.push("The current registry or one or more selected entries have unresolved candidate evidence gaps")
    if (baseAssessment.profileMismatchCount > 0) reasons.push("One or more binding decisions do not match the current unit Technology Profile")
    if (baseAssessment.unitScopeMismatchCount > 0) reasons.push("One or more selected registry entries do not declare the target implementation unit scope")
    if (baseAssessment.versionMismatchCount > 0) reasons.push("One or more selected versions differ from the exact registry candidate")
    if (baseAssessment.missingEvidenceCount > 0) reasons.push("One or more unit binding decisions lack evidence")
    if (decisions.some((decision) => decision.disposition === "candidate-deferred")) reasons.push("One or more unit binding decisions are deferred")
    if (decisions.some((decision) => decision.disposition === "not-assessed")) reasons.push("One or more unit binding decisions are not assessed")
    if (invalidCandidateCount > 0) reasons.push("The Boilerplate Selection and Binding receipt digests are invalid")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved Boilerplate Selection and Binding questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return boilerplateSelectionBindingStatusSchema.parse({
      schemaVersion: 1, kind: "boilerplate-selection-binding-status", productId: product.id,
      productRevision: revisionOf(product), initiativeId: initiative.id, initiativeRevision: revisionOf(initiative),
      ...(candidate ? {
        candidate: exactReference(candidate), implementationUnitModel: candidate.implementationUnitModel,
        dependencyMapping: candidate.dependencyMapping, technologyProfile: candidate.technologyProfile,
        boilerplateRegistry: candidate.boilerplateRegistry,
      } : {}),
      decisionCount: decisions.length,
      selectedCandidateCount: decisions.filter((decision) => decision.disposition === "candidate-selected").length,
      notApplicableCandidateCount: decisions.filter((decision) => decision.disposition === "candidate-not-applicable").length,
      deferredCandidateCount: decisions.filter((decision) => decision.disposition === "candidate-deferred").length,
      notAssessedCount: decisions.filter((decision) => decision.disposition === "not-assessed").length,
      ...baseAssessment, staleBindingCount, staleImplementationUnitModelCount, staleDependencyMappingCount,
      staleTechnologyProfileCount, staleBoilerplateRegistryCount, invalidCandidateCount, unresolvedQuestionCount,
      reviewState, state: reasons.length === 0 ? "candidate-complete" : "attention-required", reasons,
      assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary,
    })
  }

  async project(initiativeId: string): Promise<BoilerplateSelectionBindingProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Boilerplate Selection and Binding projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const, kind: "boilerplate-selection-binding-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        unitDecisionCatalogDigest: candidate.unitDecisionCatalogDigest,
        selectionReceiptDigest: candidate.selectionReceiptDigest, bindingReceiptDigest: candidate.bindingReceiptDigest,
        assessmentReceiptDigest: candidate.assessmentReceiptDigest, decisionCount: candidate.decisions.length,
        selectedCandidateCount: candidate.decisions.filter((decision) => decision.disposition === "candidate-selected").length,
        reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary,
    }
    return boilerplateSelectionBindingProjectionSchema.parse({
      ...projectionWithoutDigest, snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords(
      "boilerplate-selection-bindings", currentRecordPattern, boilerplateSelectionBindingSchema,
    )
    for (const candidate of records) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Boilerplate Selection and Binding candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        const gapCount = status.deferredCandidateCount + status.notAssessedCount + status.missingUnitDecisionCount +
          status.invalidSelectionCount + status.registryGapCount + status.profileMismatchCount +
          status.unitScopeMismatchCount + status.versionMismatchCount + status.missingEvidenceCount +
          status.staleBindingCount + status.staleImplementationUnitModelCount + status.staleDependencyMappingCount +
          status.staleTechnologyProfileCount + status.staleBoilerplateRegistryCount + status.invalidCandidateCount
        if (gapCount > 0) {
          issues.push({
            code: "boilerplate-selection-binding.review-required", severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale, incomplete, invalid, mismatched, or unresolved Boilerplate Selection and Binding candidates.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "boilerplate-selection-binding.invalid", severity: "error",
          message: `Boilerplate Selection and Binding ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private assessDecisions(
    input: Pick<BoilerplateSelectionBindingInput, "decisions" | "reviewState">,
    dependencies: ExactDependencies,
  ): DecisionAssessment {
    const unitIds = new Set(dependencies.units.units.map((unit) => unit.id))
    const profileById = new Map(dependencies.technologyProfile.profiles.map((profile) => [profile.id, profile]))
    const registryById = new Map(dependencies.boilerplateRegistry.entries.map((entry) => [entry.id, entry]))
    const decisionUnitIds = new Set(input.decisions.map((decision) => decision.implementationUnitId))
    let invalidSelectionCount = 0
    let registryGapCount = dependencies.boilerplateRegistry.reviewState === "ready-for-human-review" ? 0 : 1
    let profileMismatchCount = 0
    let unitScopeMismatchCount = 0
    let versionMismatchCount = 0
    for (const [index, decision] of input.decisions.entries()) {
      const profile = profileById.get(decision.technologyProfileId)
      if (decision.ordinal !== index + 1 || !unitIds.has(decision.implementationUnitId)) invalidSelectionCount += 1
      if (!profile || profile.implementationUnitId !== decision.implementationUnitId) profileMismatchCount += 1
      if (decision.alternativeRegistryEntryIds.some((id) => !registryById.has(id))) invalidSelectionCount += 1
      if (decision.disposition !== "candidate-selected") continue
      const entry = decision.boilerplateRegistryEntryId
        ? registryById.get(decision.boilerplateRegistryEntryId)
        : undefined
      if (!entry) {
        invalidSelectionCount += 1
        continue
      }
      if (!entry.applicableImplementationUnitIds.includes(decision.implementationUnitId)) unitScopeMismatchCount += 1
      if (!entry.applicableTechnologyProfileIds.includes(decision.technologyProfileId)) profileMismatchCount += 1
      if (entry.versionCandidate !== decision.boilerplateVersionCandidate || entry.versionState !== "exact-candidate") {
        versionMismatchCount += 1
      }
      if (entry.availabilityState !== "candidate-available" || entry.integrityState !== "candidate-verified" ||
          entry.provenanceState !== "candidate-traceable" || entry.supportState !== "candidate-supported" ||
          ["deprecated", "end-of-life", "unknown"].includes(entry.lifecycleState) ||
          entry.technologyCompatibilityState !== "candidate-compatible" ||
          entry.architectureCompatibilityState !== "candidate-compatible" ||
          entry.licenseState !== "candidate-allowed" || entry.securityPolicyState !== "candidate-conformant" ||
          entry.exceptionState !== "not-required-candidate" || entry.evidenceReferences.length === 0) registryGapCount += 1
    }
    return {
      missingUnitDecisionCount: dependencies.units.units.filter((unit) => !decisionUnitIds.has(unit.id)).length,
      invalidSelectionCount, registryGapCount, profileMismatchCount, unitScopeMismatchCount, versionMismatchCount,
      missingEvidenceCount: input.decisions.filter((decision) => decision.evidenceReferences.length === 0).length,
    }
  }

  private requireValidCandidate(input: BoilerplateSelectionBindingInput, assessment: DecisionAssessment): void {
    const unresolvedDispositionCount = input.decisions.filter((decision) =>
      ["candidate-deferred", "not-assessed"].includes(decision.disposition)).length
    const gapCount = Object.values(assessment).reduce((sum, count) => sum + count, 0) + unresolvedDispositionCount
    if (input.reviewState === "ready-for-human-review" && gapCount > 0) {
      throw new Error("Review-ready Boilerplate Selection and Binding requires exact current dependencies, one evidence-backed selected or not-applicable decision per current implementation unit, exact registry entry and version scope, and no registry, profile, unit, evidence, deferred, or unresolved gap")
    }
  }

  private emptyAssessment(): DecisionAssessment {
    return {
      missingUnitDecisionCount: 0, invalidSelectionCount: 0, registryGapCount: 0,
      profileMismatchCount: 0, unitScopeMismatchCount: 0, versionMismatchCount: 0, missingEvidenceCount: 0,
    }
  }

  private composeDigests(input: BoilerplateSelectionBindingInput) {
    const unitDecisionCatalogDigest = canonicalDigest(input.decisions)
    const selectionReceiptDigest = canonicalDigest({
      implementationUnitModel: input.implementationUnitModel, dependencyMapping: input.dependencyMapping,
      technologyProfile: input.technologyProfile, boilerplateRegistry: input.boilerplateRegistry,
      decisions: input.decisions.map((decision) => ({
        id: decision.id, ordinal: decision.ordinal, implementationUnitId: decision.implementationUnitId,
        technologyProfileId: decision.technologyProfileId, disposition: decision.disposition,
        boilerplateRegistryEntryId: decision.boilerplateRegistryEntryId,
        boilerplateVersionCandidate: decision.boilerplateVersionCandidate,
        alternativeRegistryEntryIds: decision.alternativeRegistryEntryIds,
      })),
    })
    const bindingReceiptDigest = canonicalDigest({
      decisions: input.decisions.map((decision) => ({
        id: decision.id, bindingRole: decision.bindingRole,
        accountableDecisionRoleCandidate: decision.accountableDecisionRoleCandidate,
        rationale: decision.rationale, conditions: decision.conditions,
        deviationCandidates: decision.deviationCandidates,
        exceptionReferenceCandidates: decision.exceptionReferenceCandidates,
        evidenceReferences: decision.evidenceReferences,
        organizationalApprovalState: decision.organizationalApprovalState,
        selectionDecisionEffectivenessState: decision.selectionDecisionEffectivenessState,
        bindingEffectivenessState: decision.bindingEffectivenessState,
        compatibilityValidationState: decision.compatibilityValidationState,
      })),
    })
    const assessmentReceiptDigest = canonicalDigest({
      context: input.context, implementationUnitModel: input.implementationUnitModel,
      dependencyMapping: input.dependencyMapping, technologyProfile: input.technologyProfile,
      boilerplateRegistry: input.boilerplateRegistry, unitDecisionCatalogDigest,
      selectionReceiptDigest, bindingReceiptDigest, reviewState: input.reviewState,
      unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations,
      organizationalDesignationState: input.organizationalDesignationState,
      endorsementApprovalState: input.endorsementApprovalState,
      supportCommitmentState: input.supportCommitmentState, selectionDecisionState: input.selectionDecisionState,
      bindingEffectivenessState: input.bindingEffectivenessState,
      compatibilityTruthState: input.compatibilityTruthState,
      compatibilityCompletenessState: input.compatibilityCompletenessState,
      compatibilityValidationState: input.compatibilityValidationState,
      licensingApprovalState: input.licensingApprovalState, securityApprovalState: input.securityApprovalState,
      exceptionWaiverState: input.exceptionWaiverState, sourceRetrievalState: input.sourceRetrievalState,
      assetImportInstantiationState: input.assetImportInstantiationState,
      architectureBaselineDesignationState: input.architectureBaselineDesignationState,
      implementationReadinessState: input.implementationReadinessState,
      implementationCompletenessState: input.implementationCompletenessState,
      assignmentExecutionState: input.assignmentExecutionState,
      acceptanceDecisionState: input.acceptanceDecisionState, mergeReadinessState: input.mergeReadinessState,
      releaseReadinessState: input.releaseReadinessState, deploymentReadinessState: input.deploymentReadinessState,
      actionAuthorityState: input.actionAuthorityState,
    })
    return { unitDecisionCatalogDigest, selectionReceiptDigest, bindingReceiptDigest, assessmentReceiptDigest }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Boilerplate Selection and Binding Initiative targets a different Product")
    if (canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) {
      throw new Error("Boilerplate Selection and Binding must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
  }

  private async requireExactDependencies(
    input: BoilerplateSelectionBindingInput,
    initiative: Initiative,
  ): Promise<ExactDependencies> {
    const [units, dependencyMapping, technologyProfile, boilerplateRegistry] = await Promise.all([
      this.implementationUnitModel.readCurrent(initiative.id), this.dependencyMapping.readCurrent(initiative.id),
      this.technologyProfile.readCurrent(initiative.id), this.boilerplateRegistry.readCurrent(initiative.id),
    ])
    if (!this.matches(input.implementationUnitModel, units)) {
      throw new Error("Boilerplate Selection and Binding must reference the exact current Implementation Unit Model candidate")
    }
    if (!this.matches(input.dependencyMapping, dependencyMapping)) {
      throw new Error("Boilerplate Selection and Binding must reference the exact current Dependency Mapping candidate")
    }
    if (!this.matches(input.technologyProfile, technologyProfile)) {
      throw new Error("Boilerplate Selection and Binding must reference the exact current Technology Profile candidate")
    }
    if (!this.matches(input.boilerplateRegistry, boilerplateRegistry)) {
      throw new Error("Boilerplate Selection and Binding must reference the exact current Boilerplate Registry candidate")
    }
    if (!dependencyMapping || !technologyProfile || !boilerplateRegistry ||
        canonicalDigest(dependencyMapping.implementationUnitModel) !== canonicalDigest(input.implementationUnitModel) ||
        canonicalDigest(technologyProfile.implementationUnitModel) !== canonicalDigest(input.implementationUnitModel) ||
        canonicalDigest(technologyProfile.dependencyMapping) !== canonicalDigest(input.dependencyMapping) ||
        canonicalDigest(boilerplateRegistry.implementationUnitModel) !== canonicalDigest(input.implementationUnitModel) ||
        canonicalDigest(boilerplateRegistry.technologyProfile) !== canonicalDigest(input.technologyProfile)) {
      throw new Error("Boilerplate Selection and Binding dependencies do not share one exact current planning chain")
    }
    return { units: units!, dependencyMapping, technologyProfile, boilerplateRegistry }
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
      throw new Error(`Terminal Initiative ${initiative.state} Boilerplate Selection and Binding is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(
    record: BoilerplateSelectionBinding,
    assessment: DecisionAssessment,
    eventType: string,
    actorId: string,
  ): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, boilerplateSelectionBindingSchema),
        this.governed(this.historyPath(record.id, record.revision), record, boilerplateSelectionBindingSchema),
      ],
      audit: {
        eventType, actor: { kind: "human", id: actorId }, subjectId: record.id,
        payload: {
          initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record),
          unitDecisionCatalogDigest: record.unitDecisionCatalogDigest,
          selectionReceiptDigest: record.selectionReceiptDigest, bindingReceiptDigest: record.bindingReceiptDigest,
          assessmentReceiptDigest: record.assessmentReceiptDigest, predecessorDigest: record.predecessorDigest,
          implementationUnitModel: record.implementationUnitModel, dependencyMapping: record.dependencyMapping,
          technologyProfile: record.technologyProfile, boilerplateRegistry: record.boilerplateRegistry,
          decisionCount: record.decisions.length,
          selectedCandidateCount: record.decisions.filter((decision) => decision.disposition === "candidate-selected").length,
          notApplicableCandidateCount: record.decisions.filter((decision) => decision.disposition === "candidate-not-applicable").length,
          deferredCandidateCount: record.decisions.filter((decision) => decision.disposition === "candidate-deferred").length,
          notAssessedCount: record.decisions.filter((decision) => decision.disposition === "not-assessed").length,
          ...assessment, reviewState: record.reviewState,
          organizationalDesignationState: record.organizationalDesignationState,
          endorsementApprovalState: record.endorsementApprovalState,
          supportCommitmentState: record.supportCommitmentState, selectionDecisionState: record.selectionDecisionState,
          bindingEffectivenessState: record.bindingEffectivenessState,
          compatibilityTruthState: record.compatibilityTruthState,
          compatibilityCompletenessState: record.compatibilityCompletenessState,
          compatibilityValidationState: record.compatibilityValidationState,
          licensingApprovalState: record.licensingApprovalState, securityApprovalState: record.securityApprovalState,
          exceptionWaiverState: record.exceptionWaiverState, sourceRetrievalState: record.sourceRetrievalState,
          assetImportInstantiationState: record.assetImportInstantiationState,
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

  private currentPath(id: string): string {
    return this.repository.resolve("boilerplate-selection-bindings", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve(
      "boilerplate-selection-binding-history", `boilerplate-selection-binding-${id}-r${revision}.json`,
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
      throw new Error(`Boilerplate Selection and Binding directory ${directory} exceeds the safety limit`)
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
