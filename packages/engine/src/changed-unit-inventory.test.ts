import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import type { ChangedUnitInventoryInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { ChangedUnitInventoryService } from "./changed-unit-inventory.js"
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

const ref = (record: { id: string; revision: number }) => ({ recordId: record.id, revision: record.revision, digest: canonicalDigest(record) })

function fixture() {
  const repository = new MemoryRepository()
  const product = { id: randomUUID(), revision: 1 }
  const initiative = { id: randomUUID(), revision: 1, productId: product.id, state: "active" as const }
  const unitId = randomUUID(), nodeId = randomUUID(), designId = randomUUID(), mappingId = randomUUID(), testId = randomUUID()
  const record = () => ({ id: randomUUID(), revision: 1 })
  const dependencies = {
    backlogHierarchy: { ...record(), nodes: [{ id: nodeId, requirements: [{ key: "REQ-1" }] }] },
    implementationUnitModel: { ...record(), units: [{ id: unitId, key: "unit-a", subjectNodeIds: [nodeId],
      repository: { repositoryKey: "gaep", modulePath: "packages/example" }, dependencyUnitIds: [],
      blastRadius: { affectedUnitIds: [], affectedSurfaceKeys: ["surface-a"], assessmentState: "candidate-assessed" } }] },
    dependencyMapping: record(), designToCodeBindingRegistry: { ...record(), subjects: [{ id: designId, implementationUnitId: unitId }] },
    routeScreenComponentMapping: { ...record(), subjects: [{ id: mappingId, implementationUnitIds: [unitId] }] },
    testInventory: { ...record(), assets: [{ id: testId, implementationUnitIds: [unitId] }] },
    riskRegister: { ...record(), risks: [{ key: "risk-a" }] }, implementationReadinessGate: record(),
  }
  const readers = Object.values(dependencies).map((value) => ({ readCurrent: async () => value }))
  const service = new ChangedUnitInventoryService(repository as unknown as GaepRepository, async () => product as never, async () => initiative as never,
    readers[0] as never, readers[1] as never, readers[2] as never, readers[3] as never,
    readers[4] as never, readers[5] as never, readers[6] as never, readers[7] as never)
  const evidence = { kind: "evidence" as const, sourceId: "inventory-review", revision: 1, digest: canonicalDigest({ evidence: true }), evidenceState: "human-reviewed" as const }
  const input: ChangedUnitInventoryInput = {
    initiativeId: initiative.id, context: { productRevision: 1, productDigest: canonicalDigest(product), initiativeRevision: 1, initiativeDigest: canonicalDigest(initiative) },
    informationClassification: "internal", title: "Changed unit inventory candidate",
    ...Object.fromEntries(Object.entries(dependencies).map(([name, value]) => [name, ref(value)])) as Pick<ChangedUnitInventoryInput, keyof typeof dependencies>,
    realisticExample: { scenarioId: "phase3a-realistic-readiness", revision: 1, receiptDigest: canonicalDigest({ receipt: true }), compositionDigest: canonicalDigest({ composition: true }) },
    units: [{ id: randomUUID(), ordinal: 1, implementationUnitId: unitId, implementationUnitKey: "unit-a", repositoryCandidate: "gaep", moduleCandidate: "packages/example",
      pathCandidates: [{ id: randomUUID(), ordinal: 1, pathCandidate: "packages/example/src/index.ts", changeKind: "modify", backlogNodeIds: [nodeId],
        requirementKeys: ["REQ-1"], designToCodeBindingSubjectIds: [designId], routeScreenComponentSubjectIds: [mappingId], testAssetIds: [testId], riskKeys: ["risk-a"], evidenceReferences: [evidence] }],
      dependencyUnitIds: [], directBlastRadiusUnitIds: [], indirectBlastRadiusUnitIds: [], affectedSurfaceKeys: ["surface-a"], blastRadiusAssessmentState: "candidate-assessed",
      ownerCandidateIds: ["unit-owner"], reviewCandidateIds: ["unit-reviewer"], evidenceReferences: [evidence], outcome: "candidate-scoped" }],
    unresolvedQuestions: [], limitations: ["Candidate paths require repository verification"], reviewState: "ready-for-human-review",
    repositoryTruthState: "not-established", pathTruthState: "not-established", changeScopeApprovalState: "not-established", changeApprovalState: "not-established",
    ownershipAppointmentState: "not-established", implementationReadinessState: "not-established", codeMutationState: "not-performed", stagingState: "not-performed",
    assignmentExecutionState: "not-established", acceptanceDecisionState: "not-established", mergeReadinessState: "not-established",
    releaseReadinessState: "not-established", deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
  }
  return { repository, service, input, initiative, dependencies }
}

describe("Changed Unit Inventory engine lifecycle", () => {
  it("persists immutable receipts and exposes a privacy-safe, non-authoritative projection", async () => {
    const { repository, service, input, initiative, dependencies } = fixture()
    const created = await service.create(input, "inventory-author")
    const revised = await service.revise(created.id, 1, { ...input, title: "Reviewed changed unit inventory" }, "inventory-author")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created), repositoryTruthState: "not-established", codeMutationState: "not-performed", actionAuthorityState: "not-granted" })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({ state: "candidate-inventoried", dependencyCount: 9, presentDependencyCount: 9, sourceUnitCount: 1, inventoryUnitCount: 1, pathCandidateCount: 1 })
    const projection = await service.project(initiative.id)
    expect(projection.candidate?.units[0]?.paths[0]).toEqual({ pathCandidate: "packages/example/src/index.ts", changeKind: "modify" })
    expect(JSON.stringify(projection)).not.toContain("unit-owner")
    expect(repository.audits.at(-1)?.payload).toMatchObject({ unitCount: 1, repositoryTruthState: "not-established", codeMutationState: "not-performed", actionAuthorityState: "not-granted" })
    dependencies.riskRegister.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", staleDependencyCount: 1 })
  })

  it("fails closed when a path trace targets another or unknown governed subject", async () => {
    const { service, input } = fixture()
    await expect(service.create({ ...input, units: input.units.map((unit) => ({ ...unit,
      pathCandidates: unit.pathCandidates.map((path) => ({ ...path, designToCodeBindingSubjectIds: [randomUUID()] })) })) }, "inventory-author"))
      .rejects.toThrow(/design-to-code traces/iu)
  })
})
