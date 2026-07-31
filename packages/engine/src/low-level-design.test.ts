import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import type { LowLevelDesignInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import type { GaepRepository } from "./repository.js"
import { LowLevelDesignService } from "./low-level-design.js"

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

const ref = (record: { id: string; revision: number }) => ({ recordId: record.id, revision: record.revision, digest: canonicalDigest(record) })

function fixture() {
  const repository = new MemoryRepository()
  const product = { id: randomUUID(), revision: 1 }
  const initiative = { id: randomUUID(), revision: 1, productId: product.id, state: "active" as const }
  const unitId = randomUUID()
  const highLevelElementIds = [randomUUID(), randomUUID()]
  const riskKey = "callback-spoofing"
  const testAssetId = randomUUID()
  const record = () => ({ id: randomUUID(), revision: 1 })
  const dependencies = {
    highLevelDesign: { ...record(), elements: highLevelElementIds.map((id) => ({ id })) },
    systemSolutionArchitecture: record(), boundedContextModel: record(), technologyProfile: record(),
    dependencyMapping: record(), implementationUnitModel: { ...record(), units: [{ id: unitId }] },
    boilerplateRegistry: record(), boilerplateSelectionBinding: record(), boilerplateCompatibilityValidation: record(),
    designBaseline: { ...record(), membershipDigest: canonicalDigest({ membership: true }), baselineLineageId: randomUUID(), semanticVersion: "1.0.0" },
    designToCodeBindingRegistry: record(), routeScreenComponentMapping: record(), testMethodology: record(),
    testInventory: { ...record(), assets: [{ id: testAssetId }] }, riskRegister: { ...record(), risks: [{ key: riskKey }] },
    securityPrivacyAssessment: record(),
  }
  const readers = Object.values(dependencies).map((value) => ({ readCurrent: async () => value }))
  const service = new LowLevelDesignService(
    repository as unknown as GaepRepository, async () => product as never, async () => initiative as never,
    readers[0] as never, readers[1] as never, readers[2] as never, readers[3] as never, readers[4] as never,
    readers[5] as never, readers[6] as never, readers[7] as never, readers[8] as never, readers[9] as never,
    readers[10] as never, readers[11] as never, readers[12] as never, readers[13] as never, readers[14] as never,
    readers[15] as never,
  )
  const evidence = (kind: "architecture" | "bounded-context" | "dependency" | "high-level-design" | "implementation-unit" | "risk" | "security-privacy" | "test-inventory") => ({
    kind, sourceId: `checkout-${kind}`, revision: 1, digest: canonicalDigest({ kind }), evidenceState: "source-recorded" as const,
  })
  const left = randomUUID()
  const right = randomUUID()
  const input: LowLevelDesignInput = {
    initiativeId: initiative.id,
    context: { productRevision: 1, productDigest: canonicalDigest(product), initiativeRevision: 1, initiativeDigest: canonicalDigest(initiative) },
    informationClassification: "internal", title: "Candidate Low-Level Design",
    implementationUnitId: unitId, highLevelDesign: ref(dependencies.highLevelDesign),
    systemSolutionArchitecture: ref(dependencies.systemSolutionArchitecture), boundedContextModel: ref(dependencies.boundedContextModel),
    technologyProfile: ref(dependencies.technologyProfile), dependencyMapping: ref(dependencies.dependencyMapping),
    implementationUnitModel: ref(dependencies.implementationUnitModel), boilerplateRegistry: ref(dependencies.boilerplateRegistry),
    boilerplateSelectionBinding: ref(dependencies.boilerplateSelectionBinding),
    boilerplateCompatibilityValidation: ref(dependencies.boilerplateCompatibilityValidation),
    designBaseline: { ...ref(dependencies.designBaseline), membershipDigest: dependencies.designBaseline.membershipDigest,
      baselineLineageId: dependencies.designBaseline.baselineLineageId, semanticVersion: dependencies.designBaseline.semanticVersion },
    designToCodeBindingRegistry: ref(dependencies.designToCodeBindingRegistry),
    routeScreenComponentMapping: ref(dependencies.routeScreenComponentMapping), testMethodology: ref(dependencies.testMethodology),
    testInventory: ref(dependencies.testInventory), riskRegister: ref(dependencies.riskRegister),
    securityPrivacyAssessment: ref(dependencies.securityPrivacyAssessment),
    elements: [
      { id: left, ordinal: 1, key: "checkout.module", kind: "module", title: "Checkout Module",
        responsibility: "Coordinates checkout interactions as a design candidate",
        highLevelDesignElementIds: [highLevelElementIds[0]!], boundedContextKeys: ["checkout"],
        implementationUnitIds: [unitId], technologySelectionKeys: ["typescript"], boilerplateEntryIds: [],
        routeScreenComponentSubjectIds: [], testInventoryAssetIds: [testAssetId], riskKeys: [riskKey],
        interfaceCandidates: ["Checkout service interface candidate"], dataContractCandidates: ["Checkout request contract candidate"],
        algorithmCandidates: ["Validate then authorize candidate"], stateCandidates: ["pending to confirmed candidate"],
        errorRecoveryCandidates: ["Return bounded failure and preserve retry candidate"], authorizationCandidates: ["Checkout actor policy candidate"],
        observabilityCandidates: ["Checkout outcome metric candidate"], testHookCandidates: ["Checkout adapter seam candidate"],
        ownerCandidateIds: ["architecture-lead"], disposition: "candidate-defined",
        evidenceReferences: [evidence("architecture"), evidence("bounded-context"), evidence("high-level-design"), evidence("implementation-unit")],
        conflictReferenceCandidates: [], designedBy: { kind: "human", id: "design-reviewer" }, designedAt: "2026-07-31T00:00:00.000Z" },
      { id: right, ordinal: 2, key: "payment.adapter", kind: "component", title: "Payment Adapter",
        responsibility: "Represents a bounded payment adapter candidate",
        highLevelDesignElementIds: [highLevelElementIds[1]!], boundedContextKeys: ["checkout"],
        implementationUnitIds: [unitId], technologySelectionKeys: [], boilerplateEntryIds: [],
        routeScreenComponentSubjectIds: [], testInventoryAssetIds: [testAssetId], riskKeys: [riskKey],
        interfaceCandidates: ["Payment port candidate"], dataContractCandidates: ["Tokenized payment candidate"],
        algorithmCandidates: [], stateCandidates: [], errorRecoveryCandidates: ["Map provider failures candidate"],
        authorizationCandidates: [], observabilityCandidates: ["Provider latency metric candidate"], testHookCandidates: ["Fake payment port candidate"],
        ownerCandidateIds: ["architecture-lead"], disposition: "candidate-defined",
        evidenceReferences: [evidence("architecture"), evidence("risk"), evidence("security-privacy")],
        conflictReferenceCandidates: [], designedBy: { kind: "human", id: "design-reviewer" }, designedAt: "2026-07-31T00:00:00.000Z" },
    ],
    relations: [{ id: randomUUID(), ordinal: 1, key: "checkout.gateway", kind: "calls", fromElementId: left,
      toElementId: right, interfaceContractCandidate: "Versioned checkout request and response candidate",
      dataFlowCandidate: "Tokenized payment request candidate", trustBoundaryCandidate: "crosses-boundary",
      failureBehaviorCandidate: "Returns a bounded unavailable result candidate", disposition: "candidate-defined",
      evidenceReferences: [evidence("dependency"), evidence("security-privacy")] }],
    decisions: [{ id: randomUUID(), key: "gateway.integration", title: "Gateway integration candidate",
      elementIds: [left, right].sort(), optionCandidates: ["asynchronous adapter", "synchronous adapter"],
      candidateOption: "synchronous adapter", rationaleCandidate: "Preserves the bounded request workflow candidate",
      qualityAttributeKeys: ["recoverability", "security"], riskKeys: [riskKey], disposition: "candidate-selected",
      evidenceReferences: [evidence("architecture"), evidence("risk"), evidence("test-inventory")] }],
    qualityAttributeKeys: ["recoverability", "security"], deploymentViewKeys: ["primary.deployment"],
    alternativesConsidered: ["asynchronous adapter"], unresolvedQuestions: [],
    limitations: ["Candidate design does not establish architecture, runtime, deployment, or implementation truth"],
    reviewState: "ready-for-human-review", designTruthState: "not-established",
    designCompletenessState: "not-established", repositoryTruthState: "not-established",
    sourceTruthState: "not-established",
    runtimeTruthState: "not-established", deploymentTruthState: "not-established",
    privacyApprovalState: "not-established", securityApprovalState: "not-established",
    ownershipAppointmentState: "not-established", implementationReadinessState: "not-established",
    acceptanceDecisionState: "not-established", releaseReadinessState: "not-established",
    deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
  }
  return { repository, service, input, dependencies, initiative, unitId }
}

describe("Low-Level Design engine lifecycle", () => {
  it("persists immutable receipts, projects private-safe status, and detects dependency drift", async () => {
    const { repository, service, input, dependencies, initiative, unitId } = fixture()
    const created = await service.create(input, "lld-author")
    const revised = await service.revise(created.id, created.revision, { ...input, title: "Reviewed Low-Level Design" }, "lld-author")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created) })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id, unitId)).toMatchObject({
      state: "candidate-complete", dependencyCount: 16, presentDependencyCount: 16, implementationUnitId: unitId, elementCount: 2,
      definedElementCount: 2, relationCount: 1, definedRelationCount: 1, decisionCount: 1,
      selectedDecisionCount: 1, orphanRelationCount: 0, traceGapCount: 0, evidenceGapCount: 0,
      ownershipGapCount: 0, uncoveredUnitCount: 0, staleBindingCount: 0, staleDependencyCount: 0,
      invalidCandidateCount: 0,
    })
    const projection = await service.project(initiative.id, unitId)
    expect(projection.candidate).toMatchObject({ id: revised.id, revision: 2, elementCount: 2, relationCount: 1, decisionCount: 1 })
    expect(projection.snapshotDigest).toMatch(/^sha256:[0-9a-f]{64}$/u)
    expect(await service.projectAll(initiative.id)).toEqual([
      expect.objectContaining({ candidate: expect.objectContaining({ id: revised.id, revision: 2 }) }),
    ])
    expect(JSON.stringify(projection)).not.toContain("checkout.api")
    expect(JSON.stringify(projection)).not.toContain("architecture-lead")
    const event = repository.audits.findLast((entry) => entry.eventType === "low-level-design.revised")
    expect(event?.payload).toMatchObject({ revision: 2, elementCount: 2, relationCount: 1, decisionCount: 1,
      designTruthState: "not-established", sourceTruthState: "not-established", securityApprovalState: "not-established",
      implementationReadinessState: "not-established", actionAuthorityState: "not-granted" })
    expect(JSON.stringify(event)).not.toContain("checkout.api")
    dependencies.technologyProfile.revision = 2
    expect(await service.assess(initiative.id, unitId)).toMatchObject({ state: "attention-required", staleDependencyCount: 1 })
    expect(await service.healthIssues()).toEqual([expect.objectContaining({ code: "low-level-design.review-required", severity: "warning" })])
  })

  it("fails closed on orphaned ready-review traces and incomplete unit coverage", async () => {
    const { service, input } = fixture()
    await expect(service.create({ ...input, elements: input.elements.map((element) => ({ ...element, implementationUnitIds: [randomUUID()] })) }, "lld-author"))
      .rejects.toThrow(/exact candidate Implementation Unit|exact complete/iu)
  })
})
