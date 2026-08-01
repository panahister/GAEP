import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  unitIntegrationTestingInputSchema, unitIntegrationTestingProjectionSchema, unitIntegrationTestingSchema, unitIntegrationTestingStatusSchema,
  type AcceptanceCriteria, type BusinessContextBinding, type ChangeConflictDetection, type ChangedUnitInventory, type EvidenceRegistry,
  type ImplementationUnitModel, type Initiative, type Product, type ProposedChangePreview, type RiskRegister, type StagingWorkspace,
  type TestGeneration, type TestInventory, type TestMethodology, type UnitIntegrationTesting, type UnitIntegrationTestingInput,
  type UnitIntegrationTestingProjection, type UnitIntegrationTestingStatus, type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type CurrentReader<T> = { readCurrent(initiativeId: string): Promise<T | undefined> }
type ExactReference = { recordId: string; revision: number; digest: string }
interface Dependencies {
  testGeneration: TestGeneration; testMethodology: TestMethodology; testInventory: TestInventory; acceptanceCriteria: AcceptanceCriteria;
  implementationUnitModel: ImplementationUnitModel; changedUnitInventory: ChangedUnitInventory; proposedChangePreview: ProposedChangePreview;
  stagingWorkspace: StagingWorkspace; changeConflictDetection: ChangeConflictDetection; riskRegister: RiskRegister; evidenceRegistry: EvidenceRegistry
}

const uuidSchema = z.string().uuid(), currentRecordPattern = /^[0-9a-f-]+\.json$/i, inventoryLimit = 10_000
const authorityBoundary = "unit-integration-testing-is-a-versioned-portable-suite-candidate-and-does-not-inspect-source-create-or-mutate-tests-execute-product-tests-establish-results-coverage-quality-approval-acceptance-security-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "unit-integration-testing-status-is-observational-and-grants-no-source-inspection-test-creation-mutation-product-execution-result-coverage-quality-approval-acceptance-security-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "unit-integration-testing-projection-is-read-only-and-grants-no-source-inspection-test-creation-mutation-product-execution-result-coverage-quality-approval-acceptance-security-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-bounded-suite-case-path-framework-environment-trace-evidence-identities-counts-states-and-receipts-only-not-source-code-test-code-fixture-data-oracle-data-results-machine-paths-personal-data-secrets-credentials-or-permissions" as const
function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference { return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) } }
function sameReference(reference: ExactReference | undefined, record: { id: string; revision?: number } | undefined): boolean { return Boolean(reference && record && reference.recordId === record.id && reference.revision === revisionOf(record) && reference.digest === canonicalDigest(record)) }
function includesAll(source: readonly string[], expected: readonly string[]): boolean { return expected.every((value) => source.includes(value)) }
function canonicalUnique(values: readonly string[]): string[] { return [...new Set(values)].sort((a, b) => a.localeCompare(b)) }

export class UnitIntegrationTestingService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly readers: { [K in keyof Dependencies]: CurrentReader<Dependencies[K]> },
  ) {}

  async create(inputValue: UnitIntegrationTestingInput, actorId: string): Promise<UnitIntegrationTesting> {
    const input = unitIntegrationTestingInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      if (await this.readCurrent(input.initiativeId)) throw new Error("A current Unit and Integration Testing candidate already exists; create a revision")
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies, product, initiative)
      const now = new Date().toISOString()
      const record = unitIntegrationTestingSchema.parse({ schemaVersion: 1, kind: "unit-integration-testing-candidate", id: randomUUID(), productId: product.id,
        ...input, revision: 1, ...this.composeDigests(input), state: "candidate", createdBy: { kind: "human", id: actorId },
        updatedBy: { kind: "human", id: actorId }, createdAt: now, updatedAt: now, authorityBoundary })
      await this.commitVersionedRecord(record, "unit-integration-testing.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: UnitIntegrationTestingInput, actorId: string): Promise<UnitIntegrationTesting> {
    const input = unitIntegrationTestingInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Unit and Integration Testing revision conflict")
      if (current.initiativeId !== input.initiativeId) throw new Error("Unit and Integration Testing Initiative binding is immutable")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies, product, initiative)
      const record = unitIntegrationTestingSchema.parse({ ...current, ...input, revision: current.revision + 1, ...this.composeDigests(input),
        predecessorDigest: canonicalDigest(current), updatedBy: { kind: "human", id: actorId }, updatedAt: new Date().toISOString() })
      await this.commitVersionedRecord(record, "unit-integration-testing.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<UnitIntegrationTesting> { return this.repository.readJson(this.currentPath(this.requireUuid(id, "Unit and Integration Testing ID")), unitIntegrationTestingSchema) }
  async readCurrent(initiativeId: string): Promise<UnitIntegrationTesting | undefined> { const target = this.requireUuid(initiativeId, "Initiative ID"); const matches = (await this.listRecords("unit-integration-testing", currentRecordPattern, unitIntegrationTestingSchema)).filter((record) => record.initiativeId === target); if (matches.length > 1) throw new Error("Multiple current Unit and Integration Testing candidates target one Initiative"); return matches[0] }
  async readRevision(id: string, revision: number): Promise<UnitIntegrationTesting> { const recordId = this.requireUuid(id, "Unit and Integration Testing ID"); if (!Number.isInteger(revision) || revision < 1) throw new Error("Revision must be a positive integer"); const record = await this.repository.readJson(this.historyPath(recordId, revision), unitIntegrationTestingSchema); if (record.id !== recordId || record.revision !== revision) throw new Error("Unit and Integration Testing history binding mismatch"); return record }
  async listHistory(id: string): Promise<UnitIntegrationTesting[]> { const recordId = this.requireUuid(id, "Unit and Integration Testing ID"); return (await this.listRecords("unit-integration-testing-history", new RegExp(`^unit-integration-testing-${recordId}-r[1-9][0-9]*\\.json$`, "i"), unitIntegrationTestingSchema)).sort((a, b) => b.revision - a.revision) }

  async assess(initiativeId: string): Promise<UnitIntegrationTestingStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, dependencies] = await Promise.all([this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), this.readDependencies(targetId)])
    const reasons: string[] = []; let staleBindingCount = 0, coverageGapCount = 0, invalidCandidateCount = 0
    if (!candidate) reasons.push("No current Unit and Integration Testing candidate is recorded")
    if (Object.values(dependencies).some((value) => !value)) reasons.push("One or more required Unit and Integration Testing predecessor candidates are unavailable")
    const sourceCount = dependencies.testGeneration?.targets.length ?? 0
    if (candidate) {
      for (const key of Object.keys(dependencies) as (keyof Dependencies)[]) if (!sameReference(candidate.dependencies[key], dependencies[key])) staleBindingCount += 1
      if (candidate.suites.length !== sourceCount) coverageGapCount = Math.abs(candidate.suites.length - sourceCount) || 1
      try { if (this.completeDependencies(dependencies)) this.validateCandidate(candidate, dependencies, product, initiative) } catch { invalidCandidateCount += 1 }
    }
    const suites = candidate?.suites ?? [], cases = suites.flatMap((suite) => suite.cases)
    const count = (state: UnitIntegrationTesting["suites"][number]["state"]) => suites.filter((suite) => suite.state === state).length
    const definedSuiteCount = count("candidate-defined"), gapSuiteCount = count("gap"), conflictSuiteCount = count("conflict"), staleSuiteCount = count("stale")
    const unavailableSuiteCount = count("unavailable"), notAssessedSuiteCount = count("not-assessed"), invalidSuiteCount = count("invalid")
    if (staleBindingCount) reasons.push("One or more exact predecessor bindings are stale")
    if (coverageGapCount) reasons.push("Suites do not cover the exact Test Generation targets one-for-one")
    if (gapSuiteCount + conflictSuiteCount + staleSuiteCount + unavailableSuiteCount + notAssessedSuiteCount + invalidSuiteCount) reasons.push("One or more suites are incomplete, conflicting, stale, unavailable, invalid, or not assessed")
    if (invalidCandidateCount) reasons.push("Suite, case, path, implementation, test-plan, trace, environment, risk, or evidence continuity is invalid")
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    if (unresolvedQuestionCount) reasons.push("The candidate records unresolved questions")
    const reviewState = candidate?.reviewState ?? "draft"
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    const blocking = staleBindingCount + coverageGapCount + gapSuiteCount + conflictSuiteCount + staleSuiteCount + unavailableSuiteCount +
      notAssessedSuiteCount + invalidSuiteCount + invalidCandidateCount + unresolvedQuestionCount
    return unitIntegrationTestingStatusSchema.parse({ schemaVersion: 1, kind: "unit-integration-testing-status", productId: product.id,
      productRevision: revisionOf(product), initiativeId: initiative.id, initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate), dependencies: candidate.dependencies } : {}), suiteCount: suites.length, caseCount: cases.length,
      unitCaseCount: cases.filter((testCase) => testCase.kind === "unit").length, integrationCaseCount: cases.filter((testCase) => testCase.kind === "integration").length,
      definedSuiteCount, gapSuiteCount, conflictSuiteCount, staleSuiteCount, unavailableSuiteCount, notAssessedSuiteCount, invalidSuiteCount,
      staleBindingCount, coverageGapCount, invalidCandidateCount, unresolvedQuestionCount, reviewState,
      state: candidate && this.completeDependencies(dependencies) && blocking === 0 && reviewState === "ready-for-human-review" ? "candidate-defined" : "attention-required",
      reasons, assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary })
  }

  async project(initiativeId: string): Promise<UnitIntegrationTestingProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId)])
    const body = { schemaVersion: 1 as const, kind: "unit-integration-testing-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state }, status,
      ...(candidate ? { candidate: { id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), suites: candidate.suites.map((suite) => ({
        id: suite.id, suiteKey: suite.suiteKey, implementationUnitId: suite.implementationUnitId, sourcePathCandidate: suite.sourcePathCandidate,
        testPathCandidate: suite.testPathCandidate, unitCaseCount: suite.cases.filter((testCase) => testCase.kind === "unit").length,
        integrationCaseCount: suite.cases.filter((testCase) => testCase.kind === "integration").length,
        frameworkCandidates: canonicalUnique(suite.cases.map((testCase) => testCase.frameworkCandidate)),
        environmentCandidates: canonicalUnique(suite.cases.map((testCase) => testCase.environmentCandidate)),
        fixtureCandidateCount: suite.cases.reduce((count, testCase) => count + testCase.fixtureCandidates.length, 0),
        oracleCandidateCount: suite.cases.reduce((count, testCase) => count + testCase.oracleCandidates.length, 0),
        coverageCandidateCount: suite.cases.reduce((count, testCase) => count + testCase.expectedCoverageCandidates.length, 0), state: suite.state,
      })), dependencyReceiptDigest: candidate.dependencyReceiptDigest, suiteReceiptDigest: candidate.suiteReceiptDigest,
        caseReceiptDigest: candidate.caseReceiptDigest, fixtureOracleReceiptDigest: candidate.fixtureOracleReceiptDigest,
        coverageReceiptDigest: candidate.coverageReceiptDigest, evidenceReceiptDigest: candidate.evidenceReceiptDigest,
        assessmentReceiptDigest: candidate.assessmentReceiptDigest, reviewState: candidate.reviewState, updatedAt: candidate.updatedAt } } : {}),
      observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary }
    return unitIntegrationTestingProjectionSchema.parse({ ...body, snapshotDigest: canonicalDigest(body) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    for (const candidate of await this.listRecords("unit-integration-testing", currentRecordPattern, unitIntegrationTestingSchema)) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) throw new Error("Current candidate does not match immutable history")
        if ((await this.assess(candidate.initiativeId)).state === "attention-required") issues.push({ code: "unit-integration-testing.review-required", severity: "warning", message: `Initiative ${candidate.initiativeId} has a stale, incomplete, conflicting, unavailable, invalid, or unresolved Unit and Integration Testing candidate.`, record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "create-superseding-revision"] })
      } catch (error) {
        issues.push({ code: "unit-integration-testing.invalid", severity: "error", message: `Unit and Integration Testing ${candidate.id}: ${error instanceof Error ? error.message : "validation failed"}`, record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "manual-repair-required"] })
      }
    }
    return issues
  }

  private async readDependencies(initiativeId: string): Promise<{ [K in keyof Dependencies]: Dependencies[K] | undefined }> { const keys = Object.keys(this.readers) as (keyof Dependencies)[], values = await Promise.all(keys.map((key) => this.readers[key].readCurrent(initiativeId))); return Object.fromEntries(keys.map((key, index) => [key, values[index]])) as never }
  private completeDependencies(value: { [K in keyof Dependencies]: Dependencies[K] | undefined }): value is Dependencies { return Object.values(value).every(Boolean) }
  private async requireExactDependencies(input: UnitIntegrationTestingInput): Promise<Dependencies> { const dependencies = await this.readDependencies(input.initiativeId); for (const key of Object.keys(dependencies) as (keyof Dependencies)[]) if (!sameReference(input.dependencies[key], dependencies[key])) throw new Error(`Unit and Integration Testing must reference the exact current ${key}`); if (!this.completeDependencies(dependencies)) throw new Error("Unit and Integration Testing dependencies are incomplete"); return dependencies }
  private validateCandidate(input: UnitIntegrationTestingInput, d: Dependencies, product: Product, initiative: Initiative): void {
    for (const dependency of Object.values(d)) if (dependency.productId !== product.id || dependency.initiativeId !== initiative.id || canonicalDigest(dependency.context) !== canonicalDigest(input.context)) throw new Error("Unit and Integration Testing dependencies must bind the exact current Product, Initiative, and context")
    if (!sameReference(d.testGeneration.dependencies.testMethodology, d.testMethodology) || !sameReference(d.testGeneration.dependencies.testInventory, d.testInventory) ||
        !sameReference(d.testGeneration.dependencies.acceptanceCriteria, d.acceptanceCriteria) || !sameReference(d.testGeneration.dependencies.implementationUnitModel, d.implementationUnitModel) ||
        !sameReference(d.testGeneration.dependencies.proposedChangePreview, d.proposedChangePreview) || !sameReference(d.testGeneration.dependencies.stagingWorkspace, d.stagingWorkspace) ||
        !sameReference(d.testGeneration.dependencies.changeConflictDetection, d.changeConflictDetection) || !sameReference(d.testInventory.acceptanceCriteria, d.acceptanceCriteria) ||
        !sameReference(d.testInventory.implementationUnitModel, d.implementationUnitModel) || !sameReference(d.testInventory.testMethodology, d.testMethodology) ||
        !sameReference(d.testInventory.riskRegister, d.riskRegister) || !sameReference(d.changedUnitInventory.implementationUnitModel, d.implementationUnitModel) ||
        !sameReference(d.changedUnitInventory.testInventory, d.testInventory) || !sameReference(d.changedUnitInventory.riskRegister, d.riskRegister) ||
        !sameReference(d.proposedChangePreview.changedUnitInventory, d.changedUnitInventory) || !sameReference(d.stagingWorkspace.proposedChangePreview, d.proposedChangePreview) ||
        !sameReference(d.changeConflictDetection.dependencies.proposedChangePreview, d.proposedChangePreview) ||
        !sameReference(d.changeConflictDetection.dependencies.stagingWorkspace, d.stagingWorkspace) || !sameReference(d.evidenceRegistry.riskRegister, d.riskRegister)) {
      throw new Error("Unit and Integration Testing predecessor continuity is stale")
    }
    if (input.suites.length !== d.testGeneration.targets.length) throw new Error("Unit and Integration Testing requires one suite per exact Test Generation target")
    const riskKeys = new Set(d.riskRegister.risks.map((risk) => risk.key))
    for (const suite of input.suites) {
      const target = d.testGeneration.targets.find((entry) => entry.id === suite.testGenerationTargetId)
      const conflict = d.changeConflictDetection.subjects.find((subject) => subject.id === suite.changeConflictSubjectId)
      const unit = d.implementationUnitModel.units.find((entry) => entry.id === suite.implementationUnitId)
      const changedUnit = d.changedUnitInventory.units.find((entry) => entry.implementationUnitId === suite.implementationUnitId)
      if (!target || !conflict || !unit || !changedUnit) throw new Error("Unit and Integration Testing contains a missing test-plan, conflict, implementation, or changed-unit subject")
      if (target.changeConflictSubjectId !== conflict.id || target.implementationUnitId !== unit.id || target.sourcePathCandidate !== suite.sourcePathCandidate ||
          target.testPathCandidate !== suite.testPathCandidate || conflict.pathCandidate !== suite.sourcePathCandidate ||
          !changedUnit.pathCandidates.some((path) => path.pathCandidate === suite.sourcePathCandidate)) throw new Error("Unit and Integration Testing does not preserve exact suite subject, path, or implementation continuity")
      for (const testCase of suite.cases) {
        const asset = d.testInventory.assets.find((entry) => entry.id === testCase.testInventoryAssetId)
        const scope = d.testMethodology.scopes.find((entry) => entry.id === testCase.methodologyScopeId)
        const environment = d.testMethodology.environments.find((entry) => entry.id === testCase.environmentCandidate)
        const criteria = testCase.acceptanceCriterionIds.map((id) => d.acceptanceCriteria.criteria.find((criterion) => criterion.id === id))
        if (!asset || !scope || !environment || criteria.some((criterion) => !criterion)) throw new Error("Unit and Integration Testing contains a missing inventory, methodology, environment, or acceptance subject")
        if (asset.kind !== testCase.kind || !asset.implementationUnitIds.includes(unit.id) || !asset.methodologyScopeIds.includes(scope.id) || scope.implementationUnitId !== unit.id ||
            !includesAll(target.testInventoryAssetIds, [asset.id]) || !includesAll(target.methodologyScopeIds, [scope.id]) ||
            !includesAll(target.acceptanceCriterionIds, testCase.acceptanceCriterionIds) || !includesAll(asset.acceptanceCriterionIds, testCase.acceptanceCriterionIds) ||
            !includesAll(scope.acceptanceCriterionIds, testCase.acceptanceCriterionIds) || !includesAll(target.requirementKeys, testCase.requirementKeys) ||
            !includesAll(asset.requirementKeys, testCase.requirementKeys) || !includesAll(scope.requirementKeys, testCase.requirementKeys) ||
            !includesAll(target.riskTraceCandidates, testCase.riskKeys) || !includesAll(asset.riskKeys, testCase.riskKeys) || testCase.riskKeys.some((key) => !riskKeys.has(key)) ||
            target.frameworkCandidate !== testCase.frameworkCandidate || !includesAll(target.fixtureCandidates, testCase.fixtureCandidates) ||
            !includesAll(target.oracleCandidates, testCase.oracleCandidates) || !includesAll(target.coverageTraceCandidates, testCase.expectedCoverageCandidates) ||
            (testCase.state === "candidate-defined" && (environment.availabilityState !== "candidate-available" || environment.isolationState !== "candidate-isolated"))) {
          throw new Error("Unit and Integration Testing does not preserve exact case, trace, framework, environment, fixture, oracle, coverage, or risk continuity")
        }
      }
    }
  }
  private composeDigests(input: UnitIntegrationTestingInput) {
    const dependencyReceiptDigest = canonicalDigest(input.dependencies)
    const suiteReceiptDigest = canonicalDigest(input.suites.map(({ cases: _cases, evidenceReferences: _evidence, ...suite }) => suite))
    const caseReceiptDigest = canonicalDigest(input.suites.map((suite) => ({ id: suite.id, cases: suite.cases.map(({ fixtureCandidates: _fixtures, oracleCandidates: _oracles, evidenceReferences: _evidence, ...testCase }) => testCase) })))
    const fixtureOracleReceiptDigest = canonicalDigest(input.suites.map((suite) => ({ id: suite.id, cases: suite.cases.map((testCase) => ({ id: testCase.id, fixtures: testCase.fixtureCandidates, oracles: testCase.oracleCandidates })) })))
    const coverageReceiptDigest = canonicalDigest(input.suites.map((suite) => ({ id: suite.id, cases: suite.cases.map((testCase) => ({ id: testCase.id, acceptanceCriterionIds: testCase.acceptanceCriterionIds, requirementKeys: testCase.requirementKeys, riskKeys: testCase.riskKeys, coverage: testCase.expectedCoverageCandidates })) })))
    const evidenceReceiptDigest = canonicalDigest({ evidenceReferences: input.evidenceReferences, suites: input.suites.map((suite) => ({ id: suite.id, evidenceReferences: suite.evidenceReferences, cases: suite.cases.map((testCase) => ({ id: testCase.id, evidenceReferences: testCase.evidenceReferences })) })) })
    const assessmentReceiptDigest = canonicalDigest({ dependencyReceiptDigest, suiteReceiptDigest, caseReceiptDigest, fixtureOracleReceiptDigest, coverageReceiptDigest, evidenceReceiptDigest,
      preconditions: input.preconditions, unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations, reviewState: input.reviewState,
      localHarnessExecutionEvidenceState: input.localHarnessExecutionEvidenceState, productTestExecutionState: input.productTestExecutionState,
      productTestResultState: input.productTestResultState, productCoverageTruthState: input.productCoverageTruthState, qualityState: input.qualityState,
      acceptanceState: input.acceptanceState, securityAcceptanceState: input.securityAcceptanceState, actionAuthorityState: input.actionAuthorityState })
    return { dependencyReceiptDigest, suiteReceiptDigest, caseReceiptDigest, fixtureOracleReceiptDigest, coverageReceiptDigest, evidenceReceiptDigest, assessmentReceiptDigest }
  }
  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void { if (initiative.productId !== product.id || canonicalDigest(binding) !== canonicalDigest({ productRevision: revisionOf(product), productDigest: canonicalDigest(product), initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) })) throw new Error("Unit and Integration Testing must bind exact current Product and Initiative revisions and digests") }
  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> { const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))]); if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product"); if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Unit and Integration Testing is immutable`); return { product, initiative } }
  private async commitVersionedRecord(record: UnitIntegrationTesting, eventType: string, actorId: string): Promise<void> { await this.repository.commitMutation({ writes: [this.governed(this.currentPath(record.id), record, unitIntegrationTestingSchema), this.governed(this.historyPath(record.id, record.revision), record, unitIntegrationTestingSchema)], audit: { eventType, actor: { kind: "human", id: actorId }, subjectId: record.id, payload: { initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record), dependencies: record.dependencies, suiteCount: record.suites.length, caseCount: record.suites.reduce((count, suite) => count + suite.cases.length, 0), dependencyReceiptDigest: record.dependencyReceiptDigest, suiteReceiptDigest: record.suiteReceiptDigest, caseReceiptDigest: record.caseReceiptDigest, fixtureOracleReceiptDigest: record.fixtureOracleReceiptDigest, coverageReceiptDigest: record.coverageReceiptDigest, evidenceReceiptDigest: record.evidenceReceiptDigest, assessmentReceiptDigest: record.assessmentReceiptDigest, predecessorDigest: record.predecessorDigest, localHarnessExecutionEvidenceState: record.localHarnessExecutionEvidenceState, productTestExecutionState: record.productTestExecutionState, productTestResultState: record.productTestResultState, actionAuthorityState: record.actionAuthorityState, authorityBoundary: record.authorityBoundary } } }) }
  private currentPath(id: string): string { return this.repository.resolve("unit-integration-testing", `${id}.json`) }
  private historyPath(id: string, revision: number): string { return this.repository.resolve("unit-integration-testing-history", `unit-integration-testing-${id}-r${revision}.json`) }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string { const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data }
  private async assertIntegrity(): Promise<void> { const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed") }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> { let names: string[]; try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) } catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error } if (names.length > inventoryLimit) throw new Error(`Unit and Integration Testing directory ${directory} exceeds the safety limit`); const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema))); return records.sort((a, b) => `${String((a as Record<string, unknown>).id ?? "")}:${String((a as Record<string, unknown>).revision ?? "")}`.localeCompare(`${String((b as Record<string, unknown>).id ?? "")}:${String((b as Record<string, unknown>).revision ?? "")}`)) }
}
