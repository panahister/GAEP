import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import type { TestMethodologyInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import type { GaepRepository } from "./repository.js"
import { TestMethodologyService } from "./test-methodology.js"

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
  const scopeId = randomUUID()
  const requirementKey = "GAEP-REQ-001"
  const dependencies = {
    acceptanceCriteria: { id: randomUUID(), revision: 1, criteria: [{ id: criterionId, requirements: [{ key: requirementKey }] }] },
    definitionOfReady: { id: randomUUID(), revision: 1 },
    definitionOfDone: { id: randomUUID(), revision: 1 },
    implementationUnitModel: { id: randomUUID(), revision: 1,
      units: [{ id: unitId, requirementReferences: [{ key: requirementKey }] }] },
    dependencyMapping: { id: randomUUID(), revision: 1, nodes: [{ implementationUnitId: unitId }] },
    securityPrivacyAssessment: { id: randomUUID(), revision: 1, threats: [{ key: "spoofed-callback" }] },
    routeScreenComponentMapping: { id: randomUUID(), revision: 1,
      subjects: [{ id: mappingSubjectId, implementationUnitIds: [unitId] }] },
  }
  const service = new TestMethodologyService(
    repository as unknown as GaepRepository,
    async () => product as never,
    async () => initiative as never,
    { readCurrent: async () => dependencies.acceptanceCriteria } as never,
    { readCurrent: async () => dependencies.definitionOfReady } as never,
    { readCurrent: async () => dependencies.definitionOfDone } as never,
    { readCurrent: async () => dependencies.implementationUnitModel } as never,
    { readCurrent: async () => dependencies.dependencyMapping } as never,
    { readCurrent: async () => dependencies.securityPrivacyAssessment } as never,
    { readCurrent: async () => dependencies.routeScreenComponentMapping } as never,
  )
  const evidence = (kind: "implementation-unit" | "requirement" | "acceptance-criteria" | "route-screen-component-mapping" | "security-privacy-assessment" | "evidence") => ({
    kind, sourceId: `checkout-${kind}`, revision: 1, digest: canonicalDigest({ kind }), evidenceState: "source-recorded" as const,
  })
  const input: TestMethodologyInput = {
    initiativeId: initiative.id,
    context: { productRevision: 1, productDigest: canonicalDigest(product), initiativeRevision: 1, initiativeDigest: canonicalDigest(initiative) },
    informationClassification: "internal", title: "Candidate Test Methodology",
    acceptanceCriteria: ref(dependencies.acceptanceCriteria), definitionOfReady: ref(dependencies.definitionOfReady),
    definitionOfDone: ref(dependencies.definitionOfDone), implementationUnitModel: ref(dependencies.implementationUnitModel),
    dependencyMapping: ref(dependencies.dependencyMapping), securityPrivacyAssessment: ref(dependencies.securityPrivacyAssessment),
    routeScreenComponentMapping: ref(dependencies.routeScreenComponentMapping),
    scopes: [{
      id: scopeId, ordinal: 1, implementationUnitId: unitId, requirementKeys: [requirementKey],
      acceptanceCriterionIds: [criterionId], routeScreenComponentSubjectIds: [mappingSubjectId],
      threatCandidates: ["spoofed-callback"], riskClass: "high",
      evidenceReferences: [evidence("implementation-unit"), evidence("requirement")],
    }],
    decisions: [{
      id: randomUUID(), ordinal: 1, scopeId, methodKind: "risk-based", level: "integration",
      representation: "checklist", disposition: "candidate-selected", automationIntent: "hybrid",
      environmentIds: ["ci-main"], dataPolicyIds: ["synthetic-default"],
      evidenceExpectationIds: ["test-report"], ownerCandidateIds: ["quality-lead"],
      entryCriterionIds: ["entry-ready"], exitCriterionIds: ["exit-evidence"],
      evidenceReferences: [evidence("acceptance-criteria"), evidence("route-screen-component-mapping")],
      conflictReferenceCandidates: [], selectedBy: { kind: "human", id: "methodology-reviewer" },
      selectedAt: "2026-07-31T00:00:00.000Z", executionState: "not-performed",
      resultState: "not-established", evidenceTruthState: "not-established",
      coverageTruthState: "not-established", qualityState: "not-established",
      ownershipAuthorityState: "not-granted", approvalState: "not-established",
    }],
    environments: [{
      id: "ci-main", ordinal: 1, kind: "ci", platformKeys: ["linux"],
      availabilityState: "candidate-available", isolationState: "candidate-isolated",
      evidenceReferences: [evidence("evidence")],
    }],
    dataPolicies: [{
      id: "synthetic-default", ordinal: 1, dataClass: "synthetic", privacyReviewState: "candidate-reviewed",
      retentionDaysCandidate: 30, externalTransferState: "not-authorized",
      evidenceReferences: [evidence("security-privacy-assessment")],
    }],
    evidenceExpectations: [{ id: "test-report", ordinal: 1, kind: "report",
      requiredState: "candidate-required", retentionClass: "phase-record" }],
    criteria: [
      { id: "entry-ready", ordinal: 1, kind: "entry", scopeIds: [scopeId], evidenceExpectationIds: [],
        assessmentState: "candidate-defined", evidenceReferences: [evidence("evidence")] },
      { id: "exit-evidence", ordinal: 2, kind: "exit", scopeIds: [scopeId], evidenceExpectationIds: ["test-report"],
        assessmentState: "candidate-defined", evidenceReferences: [evidence("evidence")] },
    ],
    alternativesConsidered: ["scenario-based methodology"], unresolvedQuestions: [],
    limitations: ["Candidate methodology does not establish execution, evidence truth, results, or acceptance"],
    reviewState: "ready-for-human-review", requirementTruthState: "not-established",
    acceptanceCriteriaValidityState: "not-established", methodologyTruthState: "not-established",
    methodologyCompletenessState: "not-established", environmentAvailabilityState: "not-established",
    dataFitnessState: "not-established", privacyApprovalState: "not-established", securityApprovalState: "not-established",
    ownershipAppointmentState: "not-established", testExecutionState: "not-performed",
    testResultState: "not-established", evidenceTruthState: "not-established", coverageTruthState: "not-established",
    qualityState: "not-established", implementationReadinessState: "not-established",
    acceptanceDecisionState: "not-established", releaseReadinessState: "not-established",
    deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
  }
  return { repository, service, input, dependencies, initiative }
}

describe("Test Methodology engine lifecycle", () => {
  it("persists immutable receipts, projects privacy-safe status, and detects dependency drift", async () => {
    const { repository, service, input, dependencies, initiative } = fixture()
    const created = await service.create(input, "methodology-author")
    const revised = await service.revise(created.id, created.revision, { ...input, title: "Reviewed Test Methodology" }, "methodology-author")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created) })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({
      state: "candidate-complete", sourceUnitCount: 1, sourceRequirementCount: 1, sourceCriterionCount: 1,
      sourceMappingSubjectCount: 1, scopeCount: 1, decisionCount: 1, selectedDecisionCount: 1,
      missingScopeCount: 0, extraScopeCount: 0, invalidDecisionCount: 0, environmentGapCount: 0,
      dataPolicyGapCount: 0, ownershipGapCount: 0, traceGapCount: 0, evidenceGapCount: 0,
      criterionGapCount: 0, staleBindingCount: 0, staleDependencyCount: 0, invalidCandidateCount: 0,
    })
    const projection = await service.project(initiative.id)
    expect(projection.candidate).toMatchObject({ id: revised.id, revision: 2, scopeCount: 1, decisionCount: 1 })
    expect(projection.snapshotDigest).toMatch(/^sha256:[0-9a-f]{64}$/u)
    expect(JSON.stringify(projection)).not.toContain("risk-based")
    expect(JSON.stringify(projection)).not.toContain("quality-lead")
    const event = repository.audits.findLast((entry) => entry.eventType === "test-methodology.revised")
    expect(event?.payload).toMatchObject({ revision: 2, scopeCount: 1, decisionCount: 1,
      testExecutionState: "not-performed", testResultState: "not-established",
      securityApprovalState: "not-established", acceptanceDecisionState: "not-established",
      releaseReadinessState: "not-established", actionAuthorityState: "not-granted" })
    expect(JSON.stringify(event)).not.toContain("risk-based")
    dependencies.definitionOfReady.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", staleDependencyCount: 1 })
    expect(await service.healthIssues()).toEqual([
      expect.objectContaining({ code: "test-methodology.review-required", severity: "warning" }),
    ])
  })

  it("fails closed on mismatched review-ready trace and unavailable environments", async () => {
    const { service, input } = fixture()
    await expect(service.create({ ...input, scopes: [{ ...input.scopes[0]!, requirementKeys: ["GAEP-REQ-999"] }] }, "methodology-author"))
      .rejects.toThrow(/exact complete/iu)
    await expect(service.create({ ...input, environments: [{ ...input.environments[0]!, availabilityState: "candidate-unavailable" }] }, "methodology-author"))
      .rejects.toThrow(/exact complete/iu)
  })
})
