import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import type { TestInventoryInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import type { GaepRepository } from "./repository.js"
import { TestInventoryService } from "./test-inventory.js"

interface StoredWrite { path: string; value: unknown }
interface StoredMutation { writes: StoredWrite[]; audit: { eventType: string; payload: Record<string, unknown> } }

class MemoryRepository {
  readonly values = new Map<string, unknown>()
  readonly audits: StoredMutation["audit"][] = []
  resolve(...segments: string[]): string { return join("/workspace/.gaep", ...segments) }
  async withLock<T>(work: () => Promise<T>): Promise<T> { return work() }
  async verifyAudit() { return { valid: true } }
  async readJson<T>(path: string): Promise<T> {
    if (!this.values.has(path)) throw Object.assign(new Error("missing"), { code: "ENOENT" })
    return this.values.get(path) as T
  }
  async readDirectory(directory: string): Promise<string[]> {
    const names = [...this.values.keys()].filter((path) => dirname(path) === directory).map((path) => basename(path))
    if (names.length === 0) throw Object.assign(new Error("missing"), { code: "ENOENT" })
    return names
  }
  async commitMutation(mutation: StoredMutation): Promise<void> {
    for (const write of mutation.writes) this.values.set(write.path, write.value)
    this.audits.push(mutation.audit)
  }
}

const ref = (record: { id: string; revision: number }) => ({
  recordId: record.id, revision: record.revision, digest: canonicalDigest(record),
})

function fixture() {
  const repository = new MemoryRepository()
  const product = { id: randomUUID(), revision: 1 }
  const initiative = { id: randomUUID(), revision: 1, productId: product.id, state: "active" as const }
  const unitId = randomUUID()
  const criterionId = randomUUID()
  const mappingSubjectId = randomUUID()
  const methodologyScopeId = randomUUID()
  const requirementKey = "GAEP-REQ-001"
  const dependencies = {
    acceptanceCriteria: { id: randomUUID(), revision: 1, criteria: [{ id: criterionId, requirements: [{ key: requirementKey }] }] },
    riskRegister: { id: randomUUID(), revision: 1, risks: [{ key: "callback-spoofing" }] },
    implementationUnitModel: { id: randomUUID(), revision: 1,
      units: [{ id: unitId, requirementReferences: [{ key: requirementKey }] }] },
    routeScreenComponentMapping: { id: randomUUID(), revision: 1,
      subjects: [{ id: mappingSubjectId, implementationUnitIds: [unitId] }] },
    testMethodology: { id: randomUUID(), revision: 1,
      scopes: [{ id: methodologyScopeId, implementationUnitId: unitId }] },
  }
  const service = new TestInventoryService(
    repository as unknown as GaepRepository,
    async () => product as never,
    async () => initiative as never,
    { readCurrent: async () => dependencies.acceptanceCriteria } as never,
    { readCurrent: async () => dependencies.riskRegister } as never,
    { readCurrent: async () => dependencies.implementationUnitModel } as never,
    { readCurrent: async () => dependencies.routeScreenComponentMapping } as never,
    { readCurrent: async () => dependencies.testMethodology } as never,
  )
  const evidence = (kind: "acceptance-criteria" | "implementation-unit" | "requirement" | "risk-register" | "route-screen-component-mapping" | "test-asset-observation" | "test-methodology") => ({
    kind, sourceId: `checkout-${kind}`, revision: 1, digest: canonicalDigest({ kind }), evidenceState: "source-recorded" as const,
  })
  const input: TestInventoryInput = {
    initiativeId: initiative.id,
    context: { productRevision: 1, productDigest: canonicalDigest(product), initiativeRevision: 1, initiativeDigest: canonicalDigest(initiative) },
    informationClassification: "internal", title: "Candidate Test Inventory",
    acceptanceCriteria: ref(dependencies.acceptanceCriteria), riskRegister: ref(dependencies.riskRegister),
    implementationUnitModel: ref(dependencies.implementationUnitModel),
    routeScreenComponentMapping: ref(dependencies.routeScreenComponentMapping),
    testMethodology: ref(dependencies.testMethodology),
    assets: [{
      id: randomUUID(), ordinal: 1, key: "checkout.contract", kind: "contract",
      title: "Checkout contract test candidate", implementationUnitIds: [unitId], requirementKeys: [requirementKey],
      acceptanceCriterionIds: [criterionId], riskKeys: ["callback-spoofing"],
      routeScreenComponentSubjectIds: [mappingSubjectId], methodologyScopeIds: [methodologyScopeId],
      environmentIds: ["ci-main"], platformKeys: ["linux"], evidenceExpectationIds: ["test-report"],
      ownerCandidateIds: ["quality-lead"], disposition: "candidate-cataloged",
      existenceState: "candidate-observed", automationState: "automated-candidate", executionState: "not-performed",
      resultState: "not-established", evidenceTruthState: "not-established", coverageTruthState: "not-established",
      qualityState: "not-established", ownershipAuthorityState: "not-granted", acceptanceState: "not-established",
      evidenceReferences: [evidence("acceptance-criteria"), evidence("implementation-unit"), evidence("requirement"),
        evidence("risk-register"), evidence("route-screen-component-mapping"), evidence("test-asset-observation"),
        evidence("test-methodology")], conflictReferenceCandidates: [],
      catalogedBy: { kind: "human", id: "inventory-reviewer" }, catalogedAt: "2026-07-31T00:00:00.000Z",
    }],
    alternativesConsidered: ["separate test lists"], unresolvedQuestions: [],
    limitations: ["Candidate inventory does not establish test existence, execution, results, or coverage"],
    reviewState: "ready-for-human-review", requirementTruthState: "not-established",
    acceptanceCriteriaValidityState: "not-established", riskTruthState: "not-established",
    inventoryTruthState: "not-established", inventoryCompletenessState: "not-established",
    testAssetExistenceTruthState: "not-established", environmentAvailabilityState: "not-established",
    privacyApprovalState: "not-established", securityApprovalState: "not-established",
    ownershipAppointmentState: "not-established", testExecutionState: "not-performed",
    testResultState: "not-established", evidenceTruthState: "not-established", coverageTruthState: "not-established",
    qualityState: "not-established", implementationReadinessState: "not-established",
    acceptanceDecisionState: "not-established", releaseReadinessState: "not-established",
    deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
  }
  return { repository, service, input, dependencies, initiative }
}

describe("Test Inventory engine lifecycle", () => {
  it("persists immutable receipts, projects privacy-safe status, and detects dependency drift", async () => {
    const { repository, service, input, dependencies, initiative } = fixture()
    const created = await service.create(input, "inventory-author")
    const revised = await service.revise(created.id, created.revision, { ...input, title: "Reviewed Test Inventory" }, "inventory-author")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created) })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({
      state: "candidate-complete", sourceCriterionCount: 1, sourceRiskCount: 1, sourceUnitCount: 1,
      sourceMappingSubjectCount: 1, sourceMethodologyScopeCount: 1, assetCount: 1, catalogedAssetCount: 1,
      duplicateIdentityCount: 0, orphanAssetCount: 0, uncoveredCriterionCount: 0, uncoveredRiskCount: 0,
      uncoveredUnitCount: 0, uncoveredMappingSubjectCount: 0, uncoveredMethodologyScopeCount: 0,
      ownershipGapCount: 0, traceGapCount: 0, evidenceGapCount: 0,
      staleBindingCount: 0, staleDependencyCount: 0, invalidCandidateCount: 0,
    })
    const projection = await service.project(initiative.id)
    expect(projection.candidate).toMatchObject({ id: revised.id, revision: 2, assetCount: 1, catalogedAssetCount: 1 })
    expect(projection.snapshotDigest).toMatch(/^sha256:[0-9a-f]{64}$/u)
    expect(JSON.stringify(projection)).not.toContain("checkout.contract")
    expect(JSON.stringify(projection)).not.toContain("quality-lead")
    const event = repository.audits.findLast((entry) => entry.eventType === "test-inventory.revised")
    expect(event?.payload).toMatchObject({ revision: 2, assetCount: 1, testExecutionState: "not-performed",
      testResultState: "not-established", securityApprovalState: "not-established",
      acceptanceDecisionState: "not-established", releaseReadinessState: "not-established",
      actionAuthorityState: "not-granted" })
    expect(JSON.stringify(event)).not.toContain("checkout.contract")
    dependencies.riskRegister.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", staleDependencyCount: 1 })
    expect(await service.healthIssues()).toEqual([
      expect.objectContaining({ code: "test-inventory.review-required", severity: "warning" }),
    ])
  })

  it("fails closed on orphaned review-ready trace and incomplete source coverage", async () => {
    const { service, input } = fixture()
    await expect(service.create({ ...input, assets: [{ ...input.assets[0]!, riskKeys: ["unknown-risk"] }] }, "inventory-author"))
      .rejects.toThrow(/exact complete/iu)
    await expect(service.create({ ...input, assets: [{ ...input.assets[0]!, acceptanceCriterionIds: [randomUUID()] }] }, "inventory-author"))
      .rejects.toThrow(/exact complete/iu)
  })
})
