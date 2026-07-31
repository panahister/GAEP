import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  testGenerationInputSchema, testGenerationProjectionSchema, testGenerationSchema, testGenerationStatusSchema,
  type AcceptanceCriteria, type BacklogToCodeTraceability, type BusinessContextBinding, type ChangeConflictDetection,
  type ControlledDesignToCodeGeneration, type DesignToCodeTraceability, type ImplementationUnitModel, type Initiative, type Product,
  type ProposedChangePreview, type StagingWorkspace, type TestGeneration, type TestGenerationInput, type TestGenerationProjection,
  type TestGenerationStatus, type TestInventory, type TestMethodology, type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type CurrentReader<T> = { readCurrent(initiativeId: string): Promise<T | undefined> }
type ExactReference = { recordId: string; revision: number; digest: string }
interface Dependencies { acceptanceCriteria: AcceptanceCriteria; testMethodology: TestMethodology; testInventory: TestInventory;
  implementationUnitModel: ImplementationUnitModel; designToCodeTraceability: DesignToCodeTraceability; backlogToCodeTraceability: BacklogToCodeTraceability;
  controlledDesignToCodeGeneration: ControlledDesignToCodeGeneration; proposedChangePreview: ProposedChangePreview; stagingWorkspace: StagingWorkspace;
  changeConflictDetection: ChangeConflictDetection }

const uuidSchema = z.string().uuid(), currentRecordPattern = /^[0-9a-f-]+\.json$/i, inventoryLimit = 10_000
const authorityBoundary = "test-generation-is-a-versioned-portable-plan-candidate-and-does-not-inspect-source-create-or-mutate-files-generate-or-execute-tests-establish-results-coverage-quality-approval-acceptance-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "test-generation-status-is-observational-and-grants-no-source-inspection-file-creation-mutation-test-generation-execution-result-coverage-quality-approval-acceptance-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "test-generation-projection-is-read-only-and-grants-no-source-inspection-file-creation-mutation-test-generation-execution-result-coverage-quality-approval-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-bounded-test-path-symbol-framework-fixture-oracle-trace-evidence-identities-states-counts-and-receipts-only-not-source-code-generated-tests-results-machine-paths-personal-data-secrets-credentials-or-permissions" as const
function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference { return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) } }
function sameReference(reference: ExactReference | undefined, record: { id: string; revision?: number } | undefined): boolean { return Boolean(reference && record && reference.recordId === record.id && reference.revision === revisionOf(record) && reference.digest === canonicalDigest(record)) }
function sameSet(left: readonly string[], right: readonly string[]): boolean { return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]) }

export class TestGenerationService {
  constructor(private readonly repository: GaepRepository, private readonly readProduct: ProductReader, private readonly readInitiative: InitiativeReader,
    private readonly readers: { [K in keyof Dependencies]: CurrentReader<Dependencies[K]> }) {}

  async create(inputValue: TestGenerationInput, actorId: string): Promise<TestGeneration> {
    const input = testGenerationInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity(); const { product, initiative } = await this.requireMutableInitiative(input.initiativeId); this.validateContext(input.context, product, initiative)
      if (await this.readCurrent(input.initiativeId)) throw new Error("A current Test Generation candidate already exists; create a revision")
      const dependencies = await this.requireExactDependencies(input); this.validateCandidate(input, dependencies, product, initiative); const now = new Date().toISOString()
      const record = testGenerationSchema.parse({ schemaVersion: 1, kind: "test-generation-candidate", id: randomUUID(), productId: product.id, ...input,
        revision: 1, ...this.composeDigests(input), state: "candidate", createdBy: { kind: "human", id: actorId }, updatedBy: { kind: "human", id: actorId },
        createdAt: now, updatedAt: now, authorityBoundary }); await this.commitVersionedRecord(record, "test-generation.created", actorId); return record
    })
  }
  async revise(id: string, expectedRevision: number, inputValue: TestGenerationInput, actorId: string): Promise<TestGeneration> {
    const input = testGenerationInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity(); const current = await this.read(id); if (current.revision !== expectedRevision) throw new Error("Test Generation revision conflict")
      if (current.initiativeId !== input.initiativeId) throw new Error("Test Generation Initiative binding is immutable")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId); this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input); this.validateCandidate(input, dependencies, product, initiative)
      const record = testGenerationSchema.parse({ ...current, ...input, revision: current.revision + 1, ...this.composeDigests(input), predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId }, updatedAt: new Date().toISOString() }); await this.commitVersionedRecord(record, "test-generation.revised", actorId); return record
    })
  }
  async read(id: string): Promise<TestGeneration> { return this.repository.readJson(this.currentPath(this.requireUuid(id, "Test Generation ID")), testGenerationSchema) }
  async readCurrent(initiativeId: string): Promise<TestGeneration | undefined> { const target = this.requireUuid(initiativeId, "Initiative ID"); const matches = (await this.listRecords("test-generation", currentRecordPattern, testGenerationSchema)).filter((record) => record.initiativeId === target); if (matches.length > 1) throw new Error("Multiple current Test Generation candidates target one Initiative"); return matches[0] }
  async readRevision(id: string, revision: number): Promise<TestGeneration> { const recordId = this.requireUuid(id, "Test Generation ID"); if (!Number.isInteger(revision) || revision < 1) throw new Error("Revision must be a positive integer"); const record = await this.repository.readJson(this.historyPath(recordId, revision), testGenerationSchema); if (record.id !== recordId || record.revision !== revision) throw new Error("Test Generation history binding mismatch"); return record }
  async listHistory(id: string): Promise<TestGeneration[]> { const recordId = this.requireUuid(id, "Test Generation ID"); return (await this.listRecords("test-generation-history", new RegExp(`^test-generation-${recordId}-r[1-9][0-9]*\\.json$`, "i"), testGenerationSchema)).sort((a, b) => b.revision - a.revision) }

  async assess(initiativeId: string): Promise<TestGenerationStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID"), [product, initiative, candidate, dependencies] = await Promise.all([this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), this.readDependencies(targetId)])
    const reasons: string[] = []; let staleBindingCount = 0, coverageGapCount = 0, invalidCandidateCount = 0
    if (!candidate) reasons.push("No current Test Generation candidate is recorded")
    if (Object.values(dependencies).some((value) => !value)) reasons.push("One or more required Test Generation predecessor candidates are unavailable")
    const sourceCount = dependencies.changeConflictDetection?.subjects.length ?? 0
    if (candidate) { for (const key of Object.keys(dependencies) as (keyof Dependencies)[]) if (!sameReference(candidate.dependencies[key], dependencies[key])) staleBindingCount += 1
      if (candidate.targets.length !== sourceCount) coverageGapCount = Math.abs(candidate.targets.length - sourceCount) || 1
      try { if (this.completeDependencies(dependencies)) this.validateCandidate(candidate, dependencies, product, initiative) } catch { invalidCandidateCount += 1 } }
    const targets = candidate?.targets ?? [], count = (state: TestGeneration["targets"][number]["state"]) => targets.filter((target) => target.state === state).length
    const definedCount = count("candidate-defined"), gapCount = count("gap"), conflictCount = count("conflict"), staleCount = count("stale"), unavailableCount = count("unavailable"), notAssessedCount = count("not-assessed")
    if (staleBindingCount) reasons.push("One or more exact predecessor bindings are stale")
    if (coverageGapCount) reasons.push("Test targets do not cover the exact change-conflict subjects one-for-one")
    if (gapCount + conflictCount + staleCount + unavailableCount + notAssessedCount) reasons.push("One or more test targets are incomplete, conflicting, stale, unavailable, or not assessed")
    if (invalidCandidateCount) reasons.push("Test target path, implementation, acceptance, trace, methodology, inventory, or change continuity is invalid")
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0; if (unresolvedQuestionCount) reasons.push("The candidate records unresolved questions")
    const reviewState = candidate?.reviewState ?? "draft"; if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    const blocking = staleBindingCount + coverageGapCount + gapCount + conflictCount + staleCount + unavailableCount + notAssessedCount + invalidCandidateCount + unresolvedQuestionCount
    return testGenerationStatusSchema.parse({ schemaVersion: 1, kind: "test-generation-status", productId: product.id, productRevision: revisionOf(product), initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative), ...(candidate ? { candidate: exactReference(candidate), dependencies: candidate.dependencies } : {}), targetCount: targets.length,
      definedCount, gapCount, conflictCount, staleCount, unavailableCount, notAssessedCount, staleBindingCount, coverageGapCount, invalidCandidateCount,
      unresolvedQuestionCount, reviewState, state: candidate && this.completeDependencies(dependencies) && blocking === 0 && reviewState === "ready-for-human-review" ? "candidate-defined" : "attention-required",
      reasons, assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary })
  }
  async project(initiativeId: string): Promise<TestGenerationProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID"), [product, initiative, status, candidate] = await Promise.all([this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId)])
    const body = { schemaVersion: 1 as const, kind: "test-generation-projection" as const, product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state }, status,
      ...(candidate ? { candidate: { id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), targets: candidate.targets.map((target) => ({
        id: target.id, targetKey: target.targetKey, sourcePathCandidate: target.sourcePathCandidate, testPathCandidate: target.testPathCandidate,
        sourceSymbolCandidate: target.sourceSymbolCandidate, testSymbolCandidate: target.testSymbolCandidate, testKind: target.testKind, frameworkCandidate: target.frameworkCandidate,
        fixtureCandidateCount: target.fixtureCandidates.length, oracleCandidateCount: target.oracleCandidates.length, coverageTraceCount: target.coverageTraceCandidates.length,
        riskTraceCount: target.riskTraceCandidates.length, state: target.state })), dependencyReceiptDigest: candidate.dependencyReceiptDigest,
        targetCatalogDigest: candidate.targetCatalogDigest, pathSymbolReceiptDigest: candidate.pathSymbolReceiptDigest, fixtureOracleReceiptDigest: candidate.fixtureOracleReceiptDigest,
        traceReceiptDigest: candidate.traceReceiptDigest, evidenceReceiptDigest: candidate.evidenceReceiptDigest, assessmentReceiptDigest: candidate.assessmentReceiptDigest,
        reviewState: candidate.reviewState, updatedAt: candidate.updatedAt } } : {}), observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary }
    return testGenerationProjectionSchema.parse({ ...body, snapshotDigest: canonicalDigest(body) })
  }
  async healthIssues(): Promise<WorkspaceHealthIssue[]> { const issues: WorkspaceHealthIssue[] = []; for (const candidate of await this.listRecords("test-generation", currentRecordPattern, testGenerationSchema)) {
    try { const history = await this.listHistory(candidate.id); if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) throw new Error("Current candidate does not match immutable history")
      if ((await this.assess(candidate.initiativeId)).state === "attention-required") issues.push({ code: "test-generation.review-required", severity: "warning", message: `Initiative ${candidate.initiativeId} has a stale, incomplete, conflicting, unavailable, or unresolved Test Generation candidate.`, record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "create-superseding-revision"] })
    } catch (error) { issues.push({ code: "test-generation.invalid", severity: "error", message: `Test Generation ${candidate.id}: ${error instanceof Error ? error.message : "validation failed"}`, record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "manual-repair-required"] }) } } return issues }

  private async readDependencies(initiativeId: string): Promise<{ [K in keyof Dependencies]: Dependencies[K] | undefined }> { const keys = Object.keys(this.readers) as (keyof Dependencies)[], values = await Promise.all(keys.map((key) => this.readers[key].readCurrent(initiativeId))); return Object.fromEntries(keys.map((key, index) => [key, values[index]])) as never }
  private completeDependencies(value: { [K in keyof Dependencies]: Dependencies[K] | undefined }): value is Dependencies { return Object.values(value).every(Boolean) }
  private async requireExactDependencies(input: TestGenerationInput): Promise<Dependencies> { const dependencies = await this.readDependencies(input.initiativeId); for (const key of Object.keys(dependencies) as (keyof Dependencies)[]) if (!sameReference(input.dependencies[key], dependencies[key])) throw new Error(`Test Generation must reference the exact current ${key}`); if (!this.completeDependencies(dependencies)) throw new Error("Test Generation dependencies are incomplete"); return dependencies }
  private validateCandidate(input: TestGenerationInput, d: Dependencies, product: Product, initiative: Initiative): void {
    for (const dependency of Object.values(d)) if (dependency.productId !== product.id || dependency.initiativeId !== initiative.id || canonicalDigest(dependency.context) !== canonicalDigest(input.context)) throw new Error("Test Generation dependencies must bind the exact current Product, Initiative, and context")
    if (!sameReference(d.testInventory.acceptanceCriteria, d.acceptanceCriteria) || !sameReference(d.testInventory.implementationUnitModel, d.implementationUnitModel) || !sameReference(d.testInventory.testMethodology, d.testMethodology) ||
        !sameReference(d.designToCodeTraceability.dependencies.controlledDesignToCodeGeneration, d.controlledDesignToCodeGeneration) || !sameReference(d.designToCodeTraceability.dependencies.acceptanceCriteria, d.acceptanceCriteria) ||
        !sameReference(d.designToCodeTraceability.dependencies.implementationUnitModel, d.implementationUnitModel) || !sameReference(d.designToCodeTraceability.dependencies.proposedChangePreview, d.proposedChangePreview) || !sameReference(d.designToCodeTraceability.dependencies.testInventory, d.testInventory) ||
        !sameReference(d.backlogToCodeTraceability.dependencies.controlledDesignToCodeGeneration, d.controlledDesignToCodeGeneration) || !sameReference(d.backlogToCodeTraceability.dependencies.designToCodeTraceability, d.designToCodeTraceability) ||
        !sameReference(d.backlogToCodeTraceability.dependencies.proposedChangePreview, d.proposedChangePreview) || !sameReference(d.backlogToCodeTraceability.dependencies.testInventory, d.testInventory) ||
        !sameReference(d.stagingWorkspace.proposedChangePreview, d.proposedChangePreview) || !sameReference(d.changeConflictDetection.dependencies.proposedChangePreview, d.proposedChangePreview) ||
        !sameReference(d.changeConflictDetection.dependencies.stagingWorkspace, d.stagingWorkspace)) throw new Error("Test Generation predecessor continuity is stale")
    if (input.targets.length !== d.changeConflictDetection.subjects.length) throw new Error("Test Generation requires one target per exact change-conflict subject")
    for (const target of input.targets) {
      const conflict = d.changeConflictDetection.subjects.find((subject) => subject.id === target.changeConflictSubjectId)
      const generation = d.controlledDesignToCodeGeneration.targets.find((entry) => entry.id === target.generationTargetId)
      const designTrace = d.designToCodeTraceability.traces.find((trace) => trace.id === target.designTraceId)
      const backlogTrace = d.backlogToCodeTraceability.traces.find((trace) => trace.id === target.backlogTraceId)
      const unit = d.implementationUnitModel.units.find((entry) => entry.id === target.implementationUnitId)
      const criteria = target.acceptanceCriterionIds.map((id) => d.acceptanceCriteria.criteria.find((criterion) => criterion.id === id))
      const assets = target.testInventoryAssetIds.map((id) => d.testInventory.assets.find((asset) => asset.id === id))
      const scopes = target.methodologyScopeIds.map((id) => d.testMethodology.scopes.find((scope) => scope.id === id))
      if (!conflict || !generation || !designTrace || !backlogTrace || !unit || criteria.some((value) => !value) || assets.some((value) => !value) || scopes.some((value) => !value)) throw new Error("Test Generation contains a missing change, generation, trace, implementation, acceptance, inventory, or methodology subject")
      if ([conflict.pathCandidate, generation.pathCandidate, designTrace.pathCandidate, backlogTrace.pathCandidate].some((path) => path !== target.sourcePathCandidate) ||
          generation.implementationUnitId !== target.implementationUnitId || designTrace.implementationUnitId !== target.implementationUnitId || backlogTrace.implementationUnitId !== target.implementationUnitId ||
          designTrace.generationTargetId !== generation.id || backlogTrace.generationTargetId !== generation.id || backlogTrace.designTraceId !== designTrace.id ||
          !sameSet(target.acceptanceCriterionIds, designTrace.acceptanceCriterionIds) || !sameSet(target.testInventoryAssetIds, designTrace.associatedTestAssetIds) || !sameSet(target.testInventoryAssetIds, backlogTrace.testAssetIds) ||
          scopes.some((scope) => scope?.implementationUnitId !== target.implementationUnitId) || assets.some((asset) => asset?.implementationUnitIds.includes(target.implementationUnitId) !== true) ||
          criteria.some((criterion) => criterion?.requirements.some((requirement) => target.requirementKeys.includes(requirement.key)) !== true) ||
          target.expectedOutputCandidates.some((output) => !generation.expectedTestOutputs.includes(output)) ||
          (target.state === "candidate-defined" && conflict.findings.some((finding) => finding.state === "conflict-candidate"))) throw new Error("Test Generation does not preserve exact change, path, implementation, acceptance, trace, inventory, methodology, or expected-output continuity")
    }
  }
  private composeDigests(input: TestGenerationInput) { const dependencyReceiptDigest = canonicalDigest(input.dependencies), targetCatalogDigest = canonicalDigest(input.targets.map(({ fixtureCandidates: _fixtures, oracleCandidates: _oracles, evidenceReferences: _evidence, ...target }) => target)), pathSymbolReceiptDigest = canonicalDigest(input.targets.map((target) => ({ sourcePathCandidate: target.sourcePathCandidate, testPathCandidate: target.testPathCandidate, sourceSymbolCandidate: target.sourceSymbolCandidate, testSymbolCandidate: target.testSymbolCandidate }))), fixtureOracleReceiptDigest = canonicalDigest(input.targets.map((target) => ({ id: target.id, fixtures: target.fixtureCandidates, oracles: target.oracleCandidates }))), traceReceiptDigest = canonicalDigest(input.targets.map((target) => ({ id: target.id, acceptanceCriterionIds: target.acceptanceCriterionIds, testInventoryAssetIds: target.testInventoryAssetIds, methodologyScopeIds: target.methodologyScopeIds, requirementKeys: target.requirementKeys, coverage: target.coverageTraceCandidates, risks: target.riskTraceCandidates }))), evidenceReceiptDigest = canonicalDigest({ evidenceReferences: input.evidenceReferences, targets: input.targets.map((target) => target.evidenceReferences) }); const assessmentReceiptDigest = canonicalDigest({ dependencyReceiptDigest, targetCatalogDigest, pathSymbolReceiptDigest, fixtureOracleReceiptDigest, traceReceiptDigest, evidenceReceiptDigest, preconditions: input.preconditions, unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations, reviewState: input.reviewState, sourceTruthState: input.sourceTruthState, generationState: input.generationState, sourceMutationState: input.sourceMutationState, testExecutionState: input.testExecutionState, testResultState: input.testResultState, coverageTruthState: input.coverageTruthState, qualityState: input.qualityState, acceptanceState: input.acceptanceState, actionAuthorityState: input.actionAuthorityState }); return { dependencyReceiptDigest, targetCatalogDigest, pathSymbolReceiptDigest, fixtureOracleReceiptDigest, traceReceiptDigest, evidenceReceiptDigest, assessmentReceiptDigest } }
  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void { if (initiative.productId !== product.id || canonicalDigest(binding) !== canonicalDigest({ productRevision: revisionOf(product), productDigest: canonicalDigest(product), initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) })) throw new Error("Test Generation must bind exact current Product and Initiative revisions and digests") }
  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> { const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))]); if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product"); if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Test Generation is immutable`); return { product, initiative } }
  private async commitVersionedRecord(record: TestGeneration, eventType: string, actorId: string): Promise<void> { await this.repository.commitMutation({ writes: [this.governed(this.currentPath(record.id), record, testGenerationSchema), this.governed(this.historyPath(record.id, record.revision), record, testGenerationSchema)], audit: { eventType, actor: { kind: "human", id: actorId }, subjectId: record.id, payload: { initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record), dependencies: record.dependencies, targetCount: record.targets.length, dependencyReceiptDigest: record.dependencyReceiptDigest, targetCatalogDigest: record.targetCatalogDigest, pathSymbolReceiptDigest: record.pathSymbolReceiptDigest, fixtureOracleReceiptDigest: record.fixtureOracleReceiptDigest, traceReceiptDigest: record.traceReceiptDigest, evidenceReceiptDigest: record.evidenceReceiptDigest, assessmentReceiptDigest: record.assessmentReceiptDigest, predecessorDigest: record.predecessorDigest, generationState: record.generationState, sourceMutationState: record.sourceMutationState, testExecutionState: record.testExecutionState, testResultState: record.testResultState, actionAuthorityState: record.actionAuthorityState, authorityBoundary: record.authorityBoundary } } }) }
  private currentPath(id: string): string { return this.repository.resolve("test-generation", `${id}.json`) }; private historyPath(id: string, revision: number): string { return this.repository.resolve("test-generation-history", `test-generation-${id}-r${revision}.json`) }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }; private requireUuid(value: string, label: string): string { const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data }
  private async assertIntegrity(): Promise<void> { const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed") }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> { let names: string[]; try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) } catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error } if (names.length > inventoryLimit) throw new Error(`Test Generation directory ${directory} exceeds the safety limit`); const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema))); return records.sort((a, b) => `${String((a as Record<string, unknown>).id ?? "")}:${String((a as Record<string, unknown>).revision ?? "")}`.localeCompare(`${String((b as Record<string, unknown>).id ?? "")}:${String((b as Record<string, unknown>).revision ?? "")}`)) }
}
