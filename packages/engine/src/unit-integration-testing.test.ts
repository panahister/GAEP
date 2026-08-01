import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import { unitIntegrationTestingInputSchema, type UnitIntegrationTestingInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import type { GaepRepository } from "./repository.js"
import { UnitIntegrationTestingService } from "./unit-integration-testing.js"

interface Mutation { writes: Array<{ path: string; value: unknown }>; audit: { eventType: string; payload: Record<string, unknown> } }
class MemoryRepository {
  readonly values = new Map<string, unknown>(); readonly audits: Mutation["audit"][] = []
  resolve(...parts: string[]): string { return join("/workspace/.gaep", ...parts) }
  async withLock<T>(work: () => Promise<T>): Promise<T> { return work() }
  async verifyAudit() { return { valid: true } }
  async readJson<T>(path: string): Promise<T> { if (!this.values.has(path)) throw Object.assign(new Error("missing"), { code: "ENOENT" }); return this.values.get(path) as T }
  async readDirectory(directory: string): Promise<string[]> { const values = [...this.values.keys()].filter((path) => dirname(path) === directory).map((path) => basename(path)); if (!values.length) throw Object.assign(new Error("missing"), { code: "ENOENT" }); return values }
  async commitMutation(mutation: Mutation): Promise<void> { mutation.writes.forEach((write) => this.values.set(write.path, write.value)); this.audits.push(mutation.audit) }
}
function reference(record: { id: string; revision: number }) { return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) } }
function fixture() {
  const repository = new MemoryRepository(), product = { id: randomUUID(), revision: 1 }
  const initiative = { id: randomUUID(), revision: 1, productId: product.id, state: "active" as const }
  const context = { productRevision: 1, productDigest: canonicalDigest(product), initiativeRevision: 1, initiativeDigest: canonicalDigest(initiative) }
  const base = () => ({ id: randomUUID(), revision: 1, productId: product.id, initiativeId: initiative.id, context })
  const evidence = [{ kind: "review" as const, sourceId: "unit-integration-suite", revision: 1, digest: canonicalDigest({ reviewed: true }), evidenceState: "human-reviewed" as const }]
  const implementationUnitId = randomUUID(), criterionId = randomUUID(), methodologyScopeId = randomUUID(), unitAssetId = randomUUID(), integrationAssetId = randomUUID()
  const riskKey = "risk.test-isolation", sourcePathCandidate = "apps/vscode/src/product-view.ts", testPathCandidate = "apps/vscode/src/product-view.test.ts"
  const requirementKeys = ["REQ-TEST-1"], acceptanceCriterionIds = [criterionId], riskKeys = [riskKey]
  const acceptanceCriteria = { ...base(), criteria: [{ id: criterionId, requirements: [{ key: requirementKeys[0] }] }] }
  const implementationUnitModel = { ...base(), units: [{ id: implementationUnitId }] }
  const testMethodology = { ...base(), scopes: [{ id: methodologyScopeId, implementationUnitId, requirementKeys, acceptanceCriterionIds }],
    environments: [{ id: "node.isolated", availabilityState: "candidate-available", isolationState: "candidate-isolated" }] }
  const riskRegister = { ...base(), risks: [{ key: riskKey }] }
  const testInventory = { ...base(), acceptanceCriteria: reference(acceptanceCriteria), implementationUnitModel: reference(implementationUnitModel),
    testMethodology: reference(testMethodology), riskRegister: reference(riskRegister), assets: [
      { id: unitAssetId, kind: "unit", implementationUnitIds: [implementationUnitId], methodologyScopeIds: [methodologyScopeId], acceptanceCriterionIds, requirementKeys, riskKeys },
      { id: integrationAssetId, kind: "integration", implementationUnitIds: [implementationUnitId], methodologyScopeIds: [methodologyScopeId], acceptanceCriterionIds, requirementKeys, riskKeys },
    ] }
  const changedUnitInventory = { ...base(), implementationUnitModel: reference(implementationUnitModel), testInventory: reference(testInventory),
    riskRegister: reference(riskRegister), units: [{ implementationUnitId, pathCandidates: [{ pathCandidate: sourcePathCandidate }] }] }
  const proposedChangePreview = { ...base(), changedUnitInventory: reference(changedUnitInventory) }
  const stagingWorkspace = { ...base(), proposedChangePreview: reference(proposedChangePreview) }
  const conflictSubjectId = randomUUID()
  const changeConflictDetection = { ...base(), dependencies: { proposedChangePreview: reference(proposedChangePreview), stagingWorkspace: reference(stagingWorkspace) },
    subjects: [{ id: conflictSubjectId, pathCandidate: sourcePathCandidate }] }
  const evidenceRegistry = { ...base(), riskRegister: reference(riskRegister) }
  const testGenerationTargetId = randomUUID()
  const testGeneration = { ...base(), dependencies: { testMethodology: reference(testMethodology), testInventory: reference(testInventory),
    acceptanceCriteria: reference(acceptanceCriteria), implementationUnitModel: reference(implementationUnitModel), proposedChangePreview: reference(proposedChangePreview),
    stagingWorkspace: reference(stagingWorkspace), changeConflictDetection: reference(changeConflictDetection) }, targets: [{ id: testGenerationTargetId,
    changeConflictSubjectId: conflictSubjectId, implementationUnitId, sourcePathCandidate, testPathCandidate,
    testInventoryAssetIds: [integrationAssetId, unitAssetId].sort(), methodologyScopeIds: [methodologyScopeId], acceptanceCriterionIds,
    requirementKeys, riskTraceCandidates: riskKeys, frameworkCandidate: "vitest", fixtureCandidates: ["bounded Product Studio projection"],
    oracleCandidates: ["renders exact privacy-safe metadata"], coverageTraceCandidates: ["coverage.product-view"] }] }
  const dependencies = { testGeneration, testMethodology, testInventory, acceptanceCriteria, implementationUnitModel, changedUnitInventory,
    proposedChangePreview, stagingWorkspace, changeConflictDetection, riskRegister, evidenceRegistry }
  const refs = Object.fromEntries(Object.entries(dependencies).map(([key, value]) => [key, reference(value)])) as UnitIntegrationTestingInput["dependencies"]
  const common = { methodologyScopeId, acceptanceCriterionIds, requirementKeys, riskKeys, frameworkCandidate: "vitest", environmentCandidate: "node.isolated",
    fixtureCandidates: ["bounded Product Studio projection"], oracleCandidates: ["renders exact privacy-safe metadata"],
    expectedCoverageCandidates: ["coverage.product-view"], evidenceReferences: evidence, repeatabilityState: "candidate-repeatable" as const,
    isolationState: "candidate-isolated" as const, state: "candidate-defined" as const, productTestExecutionState: "not-performed" as const,
    productTestResultState: "not-established" as const, productCoverageTruthState: "not-established" as const,
    qualityState: "not-established" as const, acceptanceState: "not-established" as const }
  const input: UnitIntegrationTestingInput = { initiativeId: initiative.id, context, informationClassification: "internal", title: "Unit and integration suite candidate",
    dependencies: refs, suites: [{ id: randomUUID(), ordinal: 1, suiteKey: "suite.product-view", testGenerationTargetId, changeConflictSubjectId: conflictSubjectId,
      implementationUnitId, sourcePathCandidate, testPathCandidate, cases: [
        { ...common, id: randomUUID(), ordinal: 1, caseKey: "case.product-view.unit", kind: "unit", testInventoryAssetId: unitAssetId },
        { ...common, id: randomUUID(), ordinal: 2, caseKey: "case.product-view.integration", kind: "integration", testInventoryAssetId: integrationAssetId },
      ], evidenceReferences: evidence, state: "candidate-defined", repositoryTruthState: "not-established", sourceTruthState: "not-established",
      testAssetTruthState: "not-established", productExecutionState: "not-performed", productResultState: "not-established" }], evidenceReferences: evidence,
    preconditions: ["Exact current test planning, change, risk, and evidence candidates must be revalidated"], unresolvedQuestions: [],
    limitations: ["Suite candidates do not establish source, test asset, Product execution, result, coverage, or quality truth"], reviewState: "ready-for-human-review",
    plannedBy: { kind: "human", id: "test-planner" }, plannedAt: "2026-08-01T08:00:00.000Z", repositoryTruthState: "not-established",
    sourceTruthState: "not-established", testAssetTruthState: "not-established", localHarnessExecutionEvidenceState: "separate-not-bound-as-product-truth",
    productTestExecutionState: "not-performed", productTestResultState: "not-established", productCoverageTruthState: "not-established",
    qualityState: "not-established", approvalState: "not-established", acceptanceState: "not-established", nativeHostAcceptanceState: "not-established",
    securityAcceptanceState: "not-established", releaseReadinessState: "not-established", deploymentReadinessState: "not-established", actionAuthorityState: "not-granted" }
  const readers = Object.fromEntries(Object.entries(dependencies).map(([key, value]) => [key, { readCurrent: async () => value }]))
  return { repository, product, initiative, dependencies, input,
    service: new UnitIntegrationTestingService(repository as unknown as GaepRepository, async () => product as never, async () => initiative as never, readers as never) }
}

describe("Unit and Integration Testing lifecycle", () => {
  it("persists immutable exact suites without executing Product tests or claiming results, coverage, quality, or acceptance", async () => {
    const { repository, service, input, initiative, dependencies } = fixture()
    const created = await service.create(input, "test-planner")
    const revised = await service.revise(created.id, 1, { ...input, title: "Reviewed unit and integration suite candidate" }, "test-planner")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created), localHarnessExecutionEvidenceState: "separate-not-bound-as-product-truth", productTestExecutionState: "not-performed" })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({ state: "candidate-defined", suiteCount: 1, caseCount: 2, unitCaseCount: 1, integrationCaseCount: 1 })
    expect(await service.project(initiative.id)).toMatchObject({ candidate: { suites: [{ testPathCandidate: "apps/vscode/src/product-view.test.ts", unitCaseCount: 1, integrationCaseCount: 1, frameworkCandidates: ["vitest"], environmentCandidates: ["node.isolated"] }] } })
    expect(repository.audits.at(-1)?.payload).toMatchObject({ suiteCount: 1, caseCount: 2, productTestExecutionState: "not-performed", actionAuthorityState: "not-granted" })
    dependencies.riskRegister.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", staleBindingCount: 1 })
  })

  it("fails closed on forged paths, missing inventory continuity, unavailable isolation, traversal, and secrets", async () => {
    const { service, input, dependencies } = fixture(), suite = input.suites[0]!, unitCase = suite.cases[0]!
    await expect(service.create({ ...input, suites: [{ ...suite, sourcePathCandidate: "apps/vscode/src/forged.ts" }] }, "test-planner")).rejects.toThrow(/continuity/iu)
    await expect(service.create({ ...input, suites: [{ ...suite, cases: [{ ...unitCase, testInventoryAssetId: randomUUID() }, suite.cases[1]!] }] }, "test-planner")).rejects.toThrow(/missing/iu)
    dependencies.testMethodology.environments[0]!.isolationState = "candidate-shared"
    await expect(service.create(input, "test-planner")).rejects.toThrow(/exact current|continuity/iu)
    expect(unitIntegrationTestingInputSchema.safeParse({ ...input, suites: [{ ...suite, testPathCandidate: "../escape.test.ts" }] }).success).toBe(false)
    expect(unitIntegrationTestingInputSchema.safeParse({ ...input, limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false)
  })
})
