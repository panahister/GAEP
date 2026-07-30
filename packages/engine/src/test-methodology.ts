import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  testMethodologyInputSchema,
  testMethodologyProjectionSchema,
  testMethodologySchema,
  testMethodologyStatusSchema,
  type AcceptanceCriteria,
  type BusinessContextBinding,
  type DefinitionOfDone,
  type DefinitionOfReady,
  type DependencyMapping,
  type ImplementationUnitModel,
  type Initiative,
  type Product,
  type RouteScreenComponentMapping,
  type SecurityPrivacyAssessment,
  type TestMethodology,
  type TestMethodologyInput,
  type TestMethodologyProjection,
  type TestMethodologyStatus,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { z, type ZodType } from "zod"

import type { AcceptanceCriteriaService } from "./acceptance-criteria.js"
import type { DefinitionOfDoneService } from "./definition-of-done.js"
import type { DefinitionOfReadyService } from "./definition-of-ready.js"
import type { DependencyMappingService } from "./dependency-mapping.js"
import type { ImplementationUnitModelService } from "./implementation-unit-model.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { RouteScreenComponentMappingService } from "./route-screen-component-mapping.js"
import type { SecurityPrivacyAssessmentService } from "./security-privacy-assessment.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type ExactReference = { recordId: string; revision: number; digest: string }

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "test-methodology-is-a-versioned-candidate-and-does-not-establish-requirement-or-acceptance-criteria-truth-methodology-validity-or-completeness-environment-availability-test-data-fitness-privacy-or-security-approval-owner-appointment-test-execution-or-results-evidence-or-coverage-truth-quality-implementation-readiness-acceptance-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "test-methodology-status-is-observational-and-does-not-establish-requirement-or-acceptance-criteria-truth-methodology-validity-or-completeness-environment-availability-test-data-fitness-privacy-or-security-approval-owner-appointment-test-execution-or-results-evidence-or-coverage-truth-quality-implementation-readiness-acceptance-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "test-methodology-projection-is-read-only-and-does-not-establish-requirement-or-acceptance-criteria-truth-methodology-validity-or-completeness-environment-availability-test-data-fitness-privacy-or-security-approval-owner-appointment-test-execution-or-results-evidence-or-coverage-truth-quality-implementation-readiness-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-counts-statuses-and-methodology-scope-environment-data-ownership-trace-assessment-snapshot-digests-only-not-requirement-criterion-method-rationale-environment-address-test-data-owner-evidence-result-personal-data-secrets-credentials-or-machine-paths" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}
function sameReference(reference: ExactReference, record: { id: string; revision: number } | undefined): boolean {
  return !!record && reference.recordId === record.id && reference.revision === record.revision &&
    reference.digest === canonicalDigest(record)
}
function sameList(left: readonly string[], right: readonly string[]): boolean {
  return canonicalDigest(left) === canonicalDigest(right)
}
function canonicalValues(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

interface ExactDependencies {
  acceptanceCriteria: AcceptanceCriteria
  definitionOfReady: DefinitionOfReady
  definitionOfDone: DefinitionOfDone
  implementationUnitModel: ImplementationUnitModel
  dependencyMapping: DependencyMapping
  securityPrivacyAssessment: SecurityPrivacyAssessment
  routeScreenComponentMapping: RouteScreenComponentMapping
}

interface MethodologyAssessment {
  sourceUnitCount: number
  sourceRequirementCount: number
  sourceCriterionCount: number
  sourceMappingSubjectCount: number
  missingScopeCount: number
  extraScopeCount: number
  invalidDecisionCount: number
  environmentGapCount: number
  dataPolicyGapCount: number
  ownershipGapCount: number
  traceGapCount: number
  evidenceGapCount: number
  criterionGapCount: number
}

export class TestMethodologyService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly acceptanceCriteria: AcceptanceCriteriaService,
    private readonly definitionOfReady: DefinitionOfReadyService,
    private readonly definitionOfDone: DefinitionOfDoneService,
    private readonly implementationUnitModel: ImplementationUnitModelService,
    private readonly dependencyMapping: DependencyMappingService,
    private readonly securityPrivacyAssessment: SecurityPrivacyAssessmentService,
    private readonly routeScreenComponentMapping: RouteScreenComponentMappingService,
  ) {}

  async create(inputValue: TestMethodologyInput, actorId: string): Promise<TestMethodology> {
    const input = testMethodologyInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      const assessment = this.assessCandidate(input, dependencies)
      this.requireValidCandidate(input, assessment)
      if (await this.readCurrent(initiative.id)) throw new Error("An Initiative can have only one current Test Methodology candidate")
      const now = new Date().toISOString()
      const record = testMethodologySchema.parse({
        schemaVersion: 1, kind: "test-methodology-candidate", id: randomUUID(), productId: product.id,
        ...input, initiativeId: initiative.id, revision: 1, ...this.composeDigests(input), state: "candidate",
        createdBy: { kind: "human", id: actorId }, updatedBy: { kind: "human", id: actorId },
        createdAt: now, updatedAt: now, authorityBoundary,
      })
      await this.commitVersionedRecord(record, assessment, "test-methodology.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: TestMethodologyInput, actorId: string): Promise<TestMethodology> {
    const input = testMethodologyInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Test Methodology revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Test Methodology Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      const assessment = this.assessCandidate(input, dependencies)
      this.requireValidCandidate(input, assessment)
      const record = testMethodologySchema.parse({
        ...current, ...input, productId: product.id, initiativeId: initiative.id,
        revision: current.revision + 1, ...this.composeDigests(input), predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId }, updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, assessment, "test-methodology.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<TestMethodology> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Test Methodology ID")), testMethodologySchema)
  }

  async readCurrent(initiativeId: string): Promise<TestMethodology | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const matches = (await this.listRecords("test-methodologies", currentRecordPattern, testMethodologySchema))
      .filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Test Methodology candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<TestMethodology> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Test Methodology history revision must be a positive integer")
    const recordId = this.requireUuid(id, "Test Methodology ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), testMethodologySchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Test Methodology history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<TestMethodology[]> {
    const recordId = this.requireUuid(id, "Test Methodology ID")
    const records = await this.listRecords(
      "test-methodology-history", new RegExp(`^test-methodology-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      testMethodologySchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Test Methodology history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<TestMethodologyStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, ...records] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), ...this.readDependencies(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const dependencies = this.toDependencies(records)
    const dependencyNames: (keyof ExactDependencies)[] = [
      "acceptanceCriteria", "definitionOfReady", "definitionOfDone", "implementationUnitModel",
      "dependencyMapping", "securityPrivacyAssessment", "routeScreenComponentMapping",
    ]
    const staleBindingCount = candidate && canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative)) ? 1 : 0
    const staleDependencyCount = candidate ? dependencyNames.filter((name) => !sameReference(candidate[name], dependencies?.[name])).length : 0
    const assessment = candidate && dependencies ? this.assessCandidate(candidate, dependencies) : this.emptyAssessment(dependencies)
    let invalidCandidateCount = 0
    if (candidate) {
      const digests = this.composeDigests(candidate)
      if (candidate.scopeCatalogDigest !== digests.scopeCatalogDigest ||
          candidate.methodologyReceiptDigest !== digests.methodologyReceiptDigest ||
          candidate.environmentReceiptDigest !== digests.environmentReceiptDigest ||
          candidate.dataPolicyReceiptDigest !== digests.dataPolicyReceiptDigest ||
          candidate.ownershipReceiptDigest !== digests.ownershipReceiptDigest ||
          candidate.traceReceiptDigest !== digests.traceReceiptDigest ||
          candidate.assessmentReceiptDigest !== digests.assessmentReceiptDigest) invalidCandidateCount = 1
    }
    const decisions = candidate?.decisions ?? []
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Test Methodology candidate exists for this Initiative")
    if (staleBindingCount) reasons.push("The Test Methodology candidate does not bind the exact current Product and Initiative")
    if (staleDependencyCount) reasons.push(`The Test Methodology candidate has ${staleDependencyCount} stale or missing exact governed dependencies`)
    if (assessment.missingScopeCount) reasons.push("One or more implementation units lack an exact methodology scope")
    if (assessment.extraScopeCount) reasons.push("One or more methodology scopes do not belong to the current Implementation Unit Model")
    if (assessment.invalidDecisionCount) reasons.push("One or more methodology decisions are structurally invalid or infeasible")
    if (assessment.environmentGapCount) reasons.push("One or more selected methodology decisions lack an assessed candidate environment")
    if (assessment.dataPolicyGapCount) reasons.push("One or more selected methodology decisions lack a candidate-reviewed data policy")
    if (assessment.ownershipGapCount) reasons.push("One or more selected methodology decisions lack an owner candidate")
    if (assessment.traceGapCount) reasons.push("One or more methodology scopes or decisions lack exact unit, Requirement, criterion, mapping, threat, or dependency trace")
    if (assessment.evidenceGapCount) reasons.push("One or more methodology scopes, decisions, environments, data policies, or criteria lack candidate evidence")
    if (assessment.criterionGapCount) reasons.push("The methodology lacks defined entry or exit criteria for one or more scopes")
    if (decisions.some((decision) => decision.disposition !== "candidate-selected")) reasons.push("One or more methodology decisions are conflicted, deferred, not applicable, or not assessed")
    if (invalidCandidateCount) reasons.push("The Test Methodology receipt digests are invalid")
    if (unresolvedQuestionCount) reasons.push("The candidate records unresolved Test Methodology questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return testMethodologyStatusSchema.parse({
      schemaVersion: 1, kind: "test-methodology-status", productId: product.id,
      productRevision: revisionOf(product), initiativeId: initiative.id, initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate), ...Object.fromEntries(dependencyNames.map((name) => [name, candidate[name]])) } : {}),
      ...this.sourceCounts(assessment), scopeCount: candidate?.scopes.length ?? 0,
      decisionCount: decisions.length, ...this.decisionCounts(decisions),
      environmentCount: candidate?.environments.length ?? 0, dataPolicyCount: candidate?.dataPolicies.length ?? 0,
      evidenceExpectationCount: candidate?.evidenceExpectations.length ?? 0,
      entryCriterionCount: candidate?.criteria.filter((criterion) => criterion.kind === "entry").length ?? 0,
      exitCriterionCount: candidate?.criteria.filter((criterion) => criterion.kind === "exit").length ?? 0,
      missingScopeCount: assessment.missingScopeCount, extraScopeCount: assessment.extraScopeCount,
      invalidDecisionCount: assessment.invalidDecisionCount, environmentGapCount: assessment.environmentGapCount,
      dataPolicyGapCount: assessment.dataPolicyGapCount, ownershipGapCount: assessment.ownershipGapCount,
      traceGapCount: assessment.traceGapCount, evidenceGapCount: assessment.evidenceGapCount,
      criterionGapCount: assessment.criterionGapCount, staleBindingCount, staleDependencyCount,
      invalidCandidateCount, unresolvedQuestionCount, reviewState,
      state: reasons.length === 0 ? "candidate-complete" : "attention-required", reasons,
      assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary,
    })
  }

  async project(initiativeId: string): Promise<TestMethodologyProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Test Methodology projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const, kind: "test-methodology-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        scopeCatalogDigest: candidate.scopeCatalogDigest, methodologyReceiptDigest: candidate.methodologyReceiptDigest,
        environmentReceiptDigest: candidate.environmentReceiptDigest, dataPolicyReceiptDigest: candidate.dataPolicyReceiptDigest,
        ownershipReceiptDigest: candidate.ownershipReceiptDigest, traceReceiptDigest: candidate.traceReceiptDigest,
        assessmentReceiptDigest: candidate.assessmentReceiptDigest, scopeCount: candidate.scopes.length,
        decisionCount: candidate.decisions.length, selectedDecisionCount: this.decisionCounts(candidate.decisions).selectedDecisionCount,
        conflictDecisionCount: this.decisionCounts(candidate.decisions).conflictDecisionCount,
        environmentCount: candidate.environments.length, dataPolicyCount: candidate.dataPolicies.length,
        evidenceExpectationCount: candidate.evidenceExpectations.length,
        entryCriterionCount: candidate.criteria.filter((criterion) => criterion.kind === "entry").length,
        exitCriterionCount: candidate.criteria.filter((criterion) => criterion.kind === "exit").length,
        reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary,
    }
    return testMethodologyProjectionSchema.parse({
      ...projectionWithoutDigest, snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("test-methodologies", currentRecordPattern, testMethodologySchema)
    for (const candidate of records) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Test Methodology candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.state === "attention-required") issues.push({
          code: "test-methodology.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has a stale, incomplete, invalid, or unresolved Test Methodology candidate.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "create-superseding-revision"],
        })
      } catch (error) {
        issues.push({
          code: "test-methodology.invalid", severity: "error",
          message: `Test Methodology ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private assessCandidate(input: TestMethodologyInput, dependencies: ExactDependencies): MethodologyAssessment {
    const units = dependencies.implementationUnitModel.units
    const unitById = new Map(units.map((unit) => [unit.id, unit]))
    const scopesByUnit = new Map<string, TestMethodologyInput["scopes"]>()
    for (const scope of input.scopes) scopesByUnit.set(scope.implementationUnitId, [...(scopesByUnit.get(scope.implementationUnitId) ?? []), scope])
    const criterionById = new Map(dependencies.acceptanceCriteria.criteria.map((criterion) => [criterion.id, criterion]))
    const mappingById = new Map(dependencies.routeScreenComponentMapping.subjects.map((subject) => [subject.id, subject]))
    const threatKeys = new Set(dependencies.securityPrivacyAssessment.threats.map((threat) => threat.key))
    const dependencyUnitIds = new Set(dependencies.dependencyMapping.nodes.map((node) => node.implementationUnitId))
    let traceGapCount = 0
    let evidenceGapCount = 0
    for (const scope of input.scopes) {
      const unit = unitById.get(scope.implementationUnitId)
      const expectedRequirements = canonicalValues(unit?.requirementReferences.map((reference) => reference.key) ?? [])
      const expectedCriteria = canonicalValues(dependencies.acceptanceCriteria.criteria
        .filter((criterion) => criterion.requirements.some((reference) => expectedRequirements.includes(reference.key)))
        .map((criterion) => criterion.id))
      const expectedMappings = canonicalValues(dependencies.routeScreenComponentMapping.subjects
        .filter((subject) => subject.implementationUnitIds.includes(scope.implementationUnitId)).map((subject) => subject.id))
      if (!unit || !dependencyUnitIds.has(scope.implementationUnitId) || !sameList(scope.requirementKeys, expectedRequirements) ||
          !sameList(scope.acceptanceCriterionIds, expectedCriteria) || !sameList(scope.routeScreenComponentSubjectIds, expectedMappings) ||
          scope.acceptanceCriterionIds.some((id) => !criterionById.has(id)) ||
          scope.routeScreenComponentSubjectIds.some((id) => !mappingById.has(id)) ||
          scope.threatCandidates.some((key) => !threatKeys.has(key))) traceGapCount += 1
      if (scope.evidenceReferences.length === 0) evidenceGapCount += 1
    }
    const environmentById = new Map(input.environments.map((environment) => [environment.id, environment]))
    const dataPolicyById = new Map(input.dataPolicies.map((policy) => [policy.id, policy]))
    const criterionIds = new Set(input.criteria.map((criterion) => criterion.id))
    let invalidDecisionCount = 0
    let environmentGapCount = 0
    let dataPolicyGapCount = 0
    let ownershipGapCount = 0
    for (const decision of input.decisions) {
      if (!input.scopes.some((scope) => scope.id === decision.scopeId) ||
          [...decision.entryCriterionIds, ...decision.exitCriterionIds].some((id) => !criterionIds.has(id))) invalidDecisionCount += 1
      if (decision.disposition === "candidate-selected") {
        if (decision.environmentIds.length === 0 || decision.environmentIds.some((id) =>
          environmentById.get(id)?.availabilityState !== "candidate-available")) environmentGapCount += 1
        if (decision.dataPolicyIds.length === 0 || decision.dataPolicyIds.some((id) =>
          dataPolicyById.get(id)?.privacyReviewState !== "candidate-reviewed")) dataPolicyGapCount += 1
        if (decision.ownerCandidateIds.length === 0) ownershipGapCount += 1
        if (decision.evidenceReferences.length === 0) evidenceGapCount += 1
      }
    }
    evidenceGapCount += input.environments.filter((environment) => environment.evidenceReferences.length === 0).length
    evidenceGapCount += input.dataPolicies.filter((policy) => policy.evidenceReferences.length === 0).length
    evidenceGapCount += input.criteria.filter((criterion) => criterion.evidenceReferences.length === 0).length
    const criterionGapCount = input.scopes.filter((scope) =>
      !input.criteria.some((criterion) => criterion.kind === "entry" && criterion.scopeIds.includes(scope.id) && criterion.assessmentState === "candidate-defined") ||
      !input.criteria.some((criterion) => criterion.kind === "exit" && criterion.scopeIds.includes(scope.id) && criterion.assessmentState === "candidate-defined")).length
    return {
      sourceUnitCount: units.length,
      sourceRequirementCount: canonicalValues(units.flatMap((unit) => unit.requirementReferences.map((reference) => reference.key))).length,
      sourceCriterionCount: dependencies.acceptanceCriteria.criteria.length,
      sourceMappingSubjectCount: dependencies.routeScreenComponentMapping.subjects.length,
      missingScopeCount: units.filter((unit) => !scopesByUnit.has(unit.id)).length,
      extraScopeCount: input.scopes.filter((scope) => !unitById.has(scope.implementationUnitId)).length +
        [...scopesByUnit.values()].reduce((count, scopes) => count + Math.max(0, scopes.length - 1), 0),
      invalidDecisionCount, environmentGapCount, dataPolicyGapCount, ownershipGapCount,
      traceGapCount, evidenceGapCount, criterionGapCount,
    }
  }

  private requireValidCandidate(input: TestMethodologyInput, assessment: MethodologyAssessment): void {
    const incompleteDecisions = input.decisions.filter((decision) => decision.disposition !== "candidate-selected").length
    const gaps = assessment.missingScopeCount + assessment.extraScopeCount + assessment.invalidDecisionCount +
      assessment.environmentGapCount + assessment.dataPolicyGapCount + assessment.ownershipGapCount +
      assessment.traceGapCount + assessment.evidenceGapCount + assessment.criterionGapCount + incompleteDecisions
    if (input.reviewState === "ready-for-human-review" && gaps > 0) {
      throw new Error("Review-ready Test Methodology requires exact complete unit, Requirement, criterion, dependency, route-screen-component, threat, environment, data-policy, ownership, evidence, entry, exit, and decision coverage")
    }
  }

  private emptyAssessment(dependencies: ExactDependencies | undefined): MethodologyAssessment {
    const units = dependencies?.implementationUnitModel.units ?? []
    return {
      sourceUnitCount: units.length,
      sourceRequirementCount: canonicalValues(units.flatMap((unit) => unit.requirementReferences.map((reference) => reference.key))).length,
      sourceCriterionCount: dependencies?.acceptanceCriteria.criteria.length ?? 0,
      sourceMappingSubjectCount: dependencies?.routeScreenComponentMapping.subjects.length ?? 0,
      missingScopeCount: 0, extraScopeCount: 0, invalidDecisionCount: 0, environmentGapCount: 0,
      dataPolicyGapCount: 0, ownershipGapCount: 0, traceGapCount: 0, evidenceGapCount: 0, criterionGapCount: 0,
    }
  }

  private sourceCounts(assessment: MethodologyAssessment) {
    return { sourceUnitCount: assessment.sourceUnitCount, sourceRequirementCount: assessment.sourceRequirementCount,
      sourceCriterionCount: assessment.sourceCriterionCount, sourceMappingSubjectCount: assessment.sourceMappingSubjectCount }
  }

  private decisionCounts(decisions: TestMethodologyInput["decisions"]) {
    return {
      selectedDecisionCount: decisions.filter((decision) => decision.disposition === "candidate-selected").length,
      conflictDecisionCount: decisions.filter((decision) => decision.disposition === "candidate-conflict").length,
      notApplicableDecisionCount: decisions.filter((decision) => decision.disposition === "candidate-not-applicable").length,
      deferredDecisionCount: decisions.filter((decision) => decision.disposition === "deferred").length,
      notAssessedDecisionCount: decisions.filter((decision) => decision.disposition === "not-assessed").length,
    }
  }

  private composeDigests(input: TestMethodologyInput) {
    const scopeCatalogDigest = canonicalDigest(input.scopes.map((scope) => ({
      id: scope.id, ordinal: scope.ordinal, implementationUnitId: scope.implementationUnitId, riskClass: scope.riskClass,
    })))
    const methodologyReceiptDigest = canonicalDigest(input.decisions.map((decision) => ({
      id: decision.id, ordinal: decision.ordinal, scopeId: decision.scopeId, methodKind: decision.methodKind,
      level: decision.level, representation: decision.representation, disposition: decision.disposition,
      automationIntent: decision.automationIntent, entryCriterionIds: decision.entryCriterionIds,
      exitCriterionIds: decision.exitCriterionIds, selectedBy: decision.selectedBy, selectedAt: decision.selectedAt,
    })))
    const environmentReceiptDigest = canonicalDigest(input.environments)
    const dataPolicyReceiptDigest = canonicalDigest(input.dataPolicies)
    const ownershipReceiptDigest = canonicalDigest(input.decisions.map((decision) => ({
      decisionId: decision.id, ownerCandidateIds: decision.ownerCandidateIds,
      ownershipAuthorityState: decision.ownershipAuthorityState,
    })))
    const traceReceiptDigest = canonicalDigest({
      dependencies: {
        acceptanceCriteria: input.acceptanceCriteria, definitionOfReady: input.definitionOfReady,
        definitionOfDone: input.definitionOfDone, implementationUnitModel: input.implementationUnitModel,
        dependencyMapping: input.dependencyMapping, securityPrivacyAssessment: input.securityPrivacyAssessment,
        routeScreenComponentMapping: input.routeScreenComponentMapping,
      },
      scopes: input.scopes.map((scope) => ({ id: scope.id, implementationUnitId: scope.implementationUnitId,
        requirementKeys: scope.requirementKeys, acceptanceCriterionIds: scope.acceptanceCriterionIds,
        routeScreenComponentSubjectIds: scope.routeScreenComponentSubjectIds, threatCandidates: scope.threatCandidates,
        evidenceReferences: scope.evidenceReferences })),
      decisions: input.decisions.map((decision) => ({ id: decision.id, scopeId: decision.scopeId,
        environmentIds: decision.environmentIds, dataPolicyIds: decision.dataPolicyIds,
        evidenceExpectationIds: decision.evidenceExpectationIds, evidenceReferences: decision.evidenceReferences,
        conflictReferenceCandidates: decision.conflictReferenceCandidates })),
      evidenceExpectations: input.evidenceExpectations, criteria: input.criteria,
    })
    const assessmentReceiptDigest = canonicalDigest({
      context: input.context, informationClassification: input.informationClassification,
      scopeCatalogDigest, methodologyReceiptDigest, environmentReceiptDigest, dataPolicyReceiptDigest,
      ownershipReceiptDigest, traceReceiptDigest, alternativesConsidered: input.alternativesConsidered,
      unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations, reviewState: input.reviewState,
      requirementTruthState: input.requirementTruthState,
      acceptanceCriteriaValidityState: input.acceptanceCriteriaValidityState,
      methodologyTruthState: input.methodologyTruthState, methodologyCompletenessState: input.methodologyCompletenessState,
      environmentAvailabilityState: input.environmentAvailabilityState, dataFitnessState: input.dataFitnessState,
      privacyApprovalState: input.privacyApprovalState, securityApprovalState: input.securityApprovalState,
      ownershipAppointmentState: input.ownershipAppointmentState, testExecutionState: input.testExecutionState,
      testResultState: input.testResultState, evidenceTruthState: input.evidenceTruthState,
      coverageTruthState: input.coverageTruthState, qualityState: input.qualityState,
      implementationReadinessState: input.implementationReadinessState,
      acceptanceDecisionState: input.acceptanceDecisionState, releaseReadinessState: input.releaseReadinessState,
      deploymentReadinessState: input.deploymentReadinessState, actionAuthorityState: input.actionAuthorityState,
    })
    return { scopeCatalogDigest, methodologyReceiptDigest, environmentReceiptDigest, dataPolicyReceiptDigest,
      ownershipReceiptDigest, traceReceiptDigest, assessmentReceiptDigest }
  }

  private readDependencies(initiativeId: string): Promise<unknown>[] {
    return [
      this.acceptanceCriteria.readCurrent(initiativeId), this.definitionOfReady.readCurrent(initiativeId),
      this.definitionOfDone.readCurrent(initiativeId), this.implementationUnitModel.readCurrent(initiativeId),
      this.dependencyMapping.readCurrent(initiativeId), this.securityPrivacyAssessment.readCurrent(initiativeId),
      this.routeScreenComponentMapping.readCurrent(initiativeId),
    ]
  }

  private toDependencies(records: unknown[]): ExactDependencies | undefined {
    if (records.some((record) => !record)) return undefined
    const [acceptanceCriteria, definitionOfReady, definitionOfDone, implementationUnitModel,
      dependencyMapping, securityPrivacyAssessment, routeScreenComponentMapping] = records
    return { acceptanceCriteria, definitionOfReady, definitionOfDone, implementationUnitModel,
      dependencyMapping, securityPrivacyAssessment, routeScreenComponentMapping } as ExactDependencies
  }

  private async requireExactDependencies(input: TestMethodologyInput): Promise<ExactDependencies> {
    const dependencies = this.toDependencies(await Promise.all(this.readDependencies(input.initiativeId)))
    if (!dependencies) throw new Error("Test Methodology requires all 7 current governed dependencies")
    const names: (keyof ExactDependencies)[] = [
      "acceptanceCriteria", "definitionOfReady", "definitionOfDone", "implementationUnitModel",
      "dependencyMapping", "securityPrivacyAssessment", "routeScreenComponentMapping",
    ]
    for (const name of names) {
      if (!sameReference(input[name], dependencies[name])) {
        throw new Error(`Test Methodology must reference the exact current ${name} candidate`)
      }
    }
    return dependencies
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Test Methodology Initiative targets a different Product")
    if (canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) {
      throw new Error("Test Methodology must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return { productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Test Methodology is immutable`)
    return { product, initiative }
  }

  private async commitVersionedRecord(record: TestMethodology, assessment: MethodologyAssessment, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [this.governed(this.currentPath(record.id), record, testMethodologySchema),
        this.governed(this.historyPath(record.id, record.revision), record, testMethodologySchema)],
      audit: {
        eventType, actor: { kind: "human", id: actorId }, subjectId: record.id,
        payload: {
          initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record),
          scopeCatalogDigest: record.scopeCatalogDigest, methodologyReceiptDigest: record.methodologyReceiptDigest,
          environmentReceiptDigest: record.environmentReceiptDigest, dataPolicyReceiptDigest: record.dataPolicyReceiptDigest,
          ownershipReceiptDigest: record.ownershipReceiptDigest, traceReceiptDigest: record.traceReceiptDigest,
          assessmentReceiptDigest: record.assessmentReceiptDigest, predecessorDigest: record.predecessorDigest,
          acceptanceCriteria: record.acceptanceCriteria, definitionOfReady: record.definitionOfReady,
          definitionOfDone: record.definitionOfDone, implementationUnitModel: record.implementationUnitModel,
          dependencyMapping: record.dependencyMapping, securityPrivacyAssessment: record.securityPrivacyAssessment,
          routeScreenComponentMapping: record.routeScreenComponentMapping, ...this.sourceCounts(assessment),
          scopeCount: record.scopes.length, decisionCount: record.decisions.length, ...this.decisionCounts(record.decisions),
          environmentCount: record.environments.length, dataPolicyCount: record.dataPolicies.length,
          evidenceExpectationCount: record.evidenceExpectations.length,
          entryCriterionCount: record.criteria.filter((criterion) => criterion.kind === "entry").length,
          exitCriterionCount: record.criteria.filter((criterion) => criterion.kind === "exit").length,
          missingScopeCount: assessment.missingScopeCount, extraScopeCount: assessment.extraScopeCount,
          invalidDecisionCount: assessment.invalidDecisionCount, environmentGapCount: assessment.environmentGapCount,
          dataPolicyGapCount: assessment.dataPolicyGapCount, ownershipGapCount: assessment.ownershipGapCount,
          traceGapCount: assessment.traceGapCount, evidenceGapCount: assessment.evidenceGapCount,
          criterionGapCount: assessment.criterionGapCount, reviewState: record.reviewState,
          requirementTruthState: record.requirementTruthState,
          acceptanceCriteriaValidityState: record.acceptanceCriteriaValidityState,
          methodologyTruthState: record.methodologyTruthState,
          methodologyCompletenessState: record.methodologyCompletenessState,
          environmentAvailabilityState: record.environmentAvailabilityState, dataFitnessState: record.dataFitnessState,
          privacyApprovalState: record.privacyApprovalState, securityApprovalState: record.securityApprovalState,
          ownershipAppointmentState: record.ownershipAppointmentState, testExecutionState: record.testExecutionState,
          testResultState: record.testResultState, evidenceTruthState: record.evidenceTruthState,
          coverageTruthState: record.coverageTruthState, qualityState: record.qualityState,
          implementationReadinessState: record.implementationReadinessState,
          acceptanceDecisionState: record.acceptanceDecisionState, releaseReadinessState: record.releaseReadinessState,
          deploymentReadinessState: record.deploymentReadinessState,
          actionAuthorityState: record.actionAuthorityState, authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string { return this.repository.resolve("test-methodologies", `${id}.json`) }
  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("test-methodology-history", `test-methodology-${id}-r${revision}.json`)
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
    if (names.length > inventoryLimit) throw new Error(`Test Methodology directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>; const rightRecord = right as Record<string, unknown>
      return `${String(leftRecord.id ?? "")}:${String(leftRecord.revision ?? "")}`.localeCompare(`${String(rightRecord.id ?? "")}:${String(rightRecord.revision ?? "")}`)
    })
  }
}
