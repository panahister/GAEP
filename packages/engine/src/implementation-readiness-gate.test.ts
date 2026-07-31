import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import type { ImplementationReadinessGateInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { ImplementationReadinessGateService } from "./implementation-readiness-gate.js"
import type { GaepRepository } from "./repository.js"

interface StoredWrite { path: string; value: unknown }
interface StoredMutation { writes: StoredWrite[]; audit: { eventType: string; payload: Record<string, unknown> } }
class MemoryRepository {
  readonly values = new Map<string, unknown>(); readonly audits: StoredMutation["audit"][] = []
  resolve(...segments: string[]): string { return join("/workspace/.gaep", ...segments) }
  async withLock<T>(work: () => Promise<T>): Promise<T> { return work() }
  async verifyAudit() { return { valid: true } }
  async readJson<T>(path: string): Promise<T> { if (!this.values.has(path)) throw Object.assign(new Error("missing"), { code: "ENOENT" }); return this.values.get(path) as T }
  async readDirectory(directory: string): Promise<string[]> { const names = [...this.values.keys()].filter((path) => dirname(path) === directory).map((path) => basename(path)); if (!names.length) throw Object.assign(new Error("missing"), { code: "ENOENT" }); return names }
  async commitMutation(mutation: StoredMutation): Promise<void> { for (const write of mutation.writes) this.values.set(write.path, write.value); this.audits.push(mutation.audit) }
}

const dimensions = ["acceptance", "backlog", "boilerplate", "dependencies", "design", "ownership", "risk", "security-privacy", "technology", "testing"] as const
const ref = (record: { id: string; revision: number }) => ({ recordId: record.id, revision: record.revision, digest: canonicalDigest(record) })

function fixture() {
  const repository = new MemoryRepository()
  const product = { id: randomUUID(), revision: 1 }
  const initiative = { id: randomUUID(), revision: 1, productId: product.id, state: "active" as const }
  const unitId = randomUUID(); const record = () => ({ id: randomUUID(), revision: 1 })
  const dependencies = {
    backlogHierarchy: record(), mvpSliceDefinition: record(), prioritizationModel: record(), acceptanceCriteria: record(),
    definitionOfReady: record(), definitionOfDone: record(), implementationUnitModel: { ...record(), units: [{ id: unitId }] },
    dependencyMapping: record(), technologyProfile: record(), boilerplateRegistry: record(), boilerplateSelectionBinding: record(),
    boilerplateCompatibilityValidation: record(), designBaseline: { ...record(), membershipDigest: canonicalDigest({ baseline: true }), baselineLineageId: randomUUID(), semanticVersion: "1.0.0" },
    designToCodeBindingRegistry: record(), routeScreenComponentMapping: record(), testMethodology: record(), testInventory: record(),
    highLevelDesign: record(), riskRegister: record(), securityPrivacyAssessment: record(),
  }
  const lowLevel = { ...record(), implementationUnitId: unitId }
  const readers = Object.values(dependencies).map((value) => ({ readCurrent: async () => value }))
  const service = new ImplementationReadinessGateService(repository as unknown as GaepRepository, async () => product as never, async () => initiative as never,
    readers[0] as never, readers[1] as never, readers[2] as never, readers[3] as never, readers[4] as never, readers[5] as never,
    readers[6] as never, readers[7] as never, readers[8] as never, readers[9] as never, readers[10] as never, readers[11] as never,
    readers[12] as never, readers[13] as never, readers[14] as never, readers[15] as never, readers[16] as never, readers[17] as never,
    readers[18] as never, readers[19] as never, { listCurrent: async () => [lowLevel] } as never)
  const evidence = { kind: "evidence" as const, sourceId: "readiness-review", revision: 1, digest: canonicalDigest({ evidence: true }), evidenceState: "human-reviewed" as const }
  const input: ImplementationReadinessGateInput = {
    initiativeId: initiative.id, context: { productRevision: 1, productDigest: canonicalDigest(product), initiativeRevision: 1, initiativeDigest: canonicalDigest(initiative) },
    informationClassification: "internal", title: "Implementation readiness candidate",
    ...Object.fromEntries(Object.entries(dependencies).map(([name, value]) => [name, name === "designBaseline" ? { ...ref(value), membershipDigest: dependencies.designBaseline.membershipDigest, baselineLineageId: dependencies.designBaseline.baselineLineageId, semanticVersion: dependencies.designBaseline.semanticVersion } : ref(value)])) as Pick<ImplementationReadinessGateInput, keyof typeof dependencies>,
    subjects: [{ id: randomUUID(), ordinal: 1, implementationUnitId: unitId, lowLevelDesign: ref(lowLevel),
      assessments: dimensions.map((dimension) => ({ dimension, outcome: "satisfied" as const, evidenceReferences: [evidence], reviewCandidateIds: ["readiness-reviewer"], rationaleCandidate: `${dimension} candidate evidence reviewed`, conflictReferenceCandidates: [], waiverReferenceCandidates: [] })),
      outcome: "satisfied", ownerCandidateIds: ["unit-owner-candidate"], evidenceReferences: [evidence], reviewCandidateIds: ["readiness-reviewer"] }],
    unresolvedQuestions: [], limitations: ["Automated assessment cannot grant implementation readiness"], reviewState: "ready-for-human-review",
    readinessDecisionState: "not-established", waiverDecisionState: "not-established", ownershipAppointmentState: "not-established",
    acceptanceDecisionState: "not-established", releaseReadinessState: "not-established", deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
  }
  return { repository, service, input, initiative, dependencies }
}

describe("Implementation Readiness Gate engine lifecycle", () => {
  it("persists immutable candidate receipts and exposes only non-authoritative projection metadata", async () => {
    const { repository, service, input, initiative, dependencies } = fixture()
    const created = await service.create(input, "readiness-author")
    const revised = await service.revise(created.id, 1, { ...input, title: "Reviewed readiness candidate" }, "readiness-author")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created), readinessDecisionState: "not-established", actionAuthorityState: "not-granted" })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({ state: "candidate-assessed", dependencyCount: 21, presentDependencyCount: 21, subjectCount: 1, satisfiedCount: 1, gapCount: 0, staleDependencyCount: 0 })
    const projection = await service.project(initiative.id)
    expect(projection.candidate).toMatchObject({ id: created.id, revision: 2, subjectCount: 1 })
    expect(JSON.stringify(projection)).not.toContain("unit-owner-candidate")
    expect(repository.audits.at(-1)?.payload).toMatchObject({ subjectCount: 1, readinessDecisionState: "not-established", waiverDecisionState: "not-established", actionAuthorityState: "not-granted" })
    dependencies.technologyProfile.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", staleDependencyCount: 1 })
  })

  it("fails closed when a unit lacks its exact current LLD", async () => {
    const { service, input } = fixture()
    await expect(service.create({ ...input, subjects: input.subjects.map((subject) => ({ ...subject, lowLevelDesign: { ...subject.lowLevelDesign, digest: canonicalDigest({ stale: true }) } })) }, "readiness-author"))
      .rejects.toThrow(/exact current Low-Level Design/iu)
  })
})
