import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import type { DesignToCodeBindingRegistryInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { DesignToCodeBindingRegistryService } from "./design-to-code-binding-registry.js"
import type { GaepRepository } from "./repository.js"

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
  const mappingSubjectId = randomUUID()
  const dependencies = {
    designBaseline: { id: randomUUID(), revision: 1 },
    finalizedFigmaSnapshotImport: { id: randomUUID(), revision: 1 },
    designToRequirementBinding: { id: randomUUID(), revision: 1 },
    figmaToBoilerplateMapping: {
      id: randomUUID(), revision: 1,
      subjects: [{
        id: mappingSubjectId, designBindingKey: "checkout.primary-action",
        designItemKey: "checkout.primary-action", designItemKind: "component",
        mappingKind: "component", implementationUnitId: unitId,
        requirementKeys: ["GAEP-REQ-001"], outcome: "candidate-mapped",
      }],
    },
    implementationUnitModel: { id: randomUUID(), revision: 1, units: [{ id: unitId }] },
    technologyProfile: { id: randomUUID(), revision: 1 },
    boilerplateSelectionBinding: { id: randomUUID(), revision: 1 },
    boilerplateCompatibilityValidation: { id: randomUUID(), revision: 1 },
  }
  const service = new DesignToCodeBindingRegistryService(
    repository as unknown as GaepRepository,
    async () => product as never,
    async () => initiative as never,
    { readCurrent: async () => dependencies.designBaseline } as never,
    { readCurrent: async () => dependencies.finalizedFigmaSnapshotImport } as never,
    { readCurrent: async () => dependencies.designToRequirementBinding } as never,
    { readCurrent: async () => dependencies.figmaToBoilerplateMapping } as never,
    { readCurrent: async () => dependencies.implementationUnitModel } as never,
    { readCurrent: async () => dependencies.technologyProfile } as never,
    { readCurrent: async () => dependencies.boilerplateSelectionBinding } as never,
    { readCurrent: async () => dependencies.boilerplateCompatibilityValidation } as never,
  )
  const input: DesignToCodeBindingRegistryInput = {
    initiativeId: initiative.id,
    context: { productRevision: 1, productDigest: canonicalDigest(product),
      initiativeRevision: 1, initiativeDigest: canonicalDigest(initiative) },
    informationClassification: "internal", title: "Candidate Design-to-Code Binding Registry",
    designBaseline: ref(dependencies.designBaseline),
    finalizedFigmaSnapshotImport: ref(dependencies.finalizedFigmaSnapshotImport),
    designToRequirementBinding: ref(dependencies.designToRequirementBinding),
    figmaToBoilerplateMapping: ref(dependencies.figmaToBoilerplateMapping),
    implementationUnitModel: ref(dependencies.implementationUnitModel),
    technologyProfile: ref(dependencies.technologyProfile),
    boilerplateSelectionBinding: ref(dependencies.boilerplateSelectionBinding),
    boilerplateCompatibilityValidation: ref(dependencies.boilerplateCompatibilityValidation),
    subjects: [{
      id: randomUUID(), ordinal: 1, mappingSubjectId, designBindingKey: "checkout.primary-action",
      designItemKey: "checkout.primary-action", designItemKind: "component", mappingKind: "component",
      bindingKind: "component", implementationUnitId: unitId, requirementKeys: ["GAEP-REQ-001"],
      repositoryCandidate: "frontend.web", moduleCandidate: "checkout.ui",
      pathCandidate: "src/components/checkout/PrimaryAction.tsx", symbolCandidate: "PrimaryAction",
      disposition: "candidate-bound", evidenceReferences: [{
        kind: "figma-to-boilerplate-mapping", sourceId: "checkout-primary-action-mapping", revision: 1,
        digest: canonicalDigest(dependencies.figmaToBoilerplateMapping.subjects[0]), evidenceState: "human-reviewed",
      }],
      conflictReferenceCandidates: [], boundBy: { kind: "human", id: "binding-reviewer" },
      boundAt: "2026-07-30T00:00:00.000Z", repositoryTruthState: "not-established",
      pathSymbolTruthState: "not-established", bindingTruthState: "not-established",
      bindingCompletenessState: "not-established", codeMutationState: "not-performed",
      implementationAuthorityState: "not-granted",
    }],
    unresolvedQuestions: [], limitations: ["Candidate bindings do not establish repository truth or change code"],
    reviewState: "ready-for-human-review", figmaConnectionState: "not-connected",
    returnedFigmaContentState: "not-established", designValidityState: "not-established",
    designApprovalState: "not-established", designBaselineDesignationState: "not-established",
    mappingTruthState: "not-established", mappingCompletenessState: "not-established",
    bindingTruthState: "not-established", bindingCompletenessState: "not-established",
    repositoryTruthState: "not-established", pathSymbolTruthState: "not-established",
    codeTargetMutationState: "not-performed", codeGenerationState: "not-performed",
    implementationReadinessState: "not-established", implementationCompletenessState: "not-established",
    assignmentExecutionState: "not-established", acceptanceDecisionState: "not-established",
    mergeReadinessState: "not-established", releaseReadinessState: "not-established",
    deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
  }
  return { repository, service, input, dependencies, initiative }
}

describe("Design-to-Code Binding Registry engine lifecycle", () => {
  it("persists immutable exact receipts, privately projects status, and detects dependency drift", async () => {
    const { repository, service, input, dependencies, initiative } = fixture()
    const created = await service.create(input, "binding-author")
    const revised = await service.revise(created.id, created.revision, { ...input, title: "Reviewed binding registry candidate" }, "binding-author")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created) })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({
      state: "candidate-complete", mappingSubjectCount: 1, subjectCount: 1, boundCandidateCount: 1,
      missingSubjectCount: 0, invalidSubjectCount: 0, targetGapCount: 0, traceGapCount: 0,
      evidenceGapCount: 0, duplicateTargetCount: 0, staleBindingCount: 0,
      staleDependencyCount: 0, invalidCandidateCount: 0,
    })
    const projection = await service.project(initiative.id)
    expect(projection.candidate).toMatchObject({ id: revised.id, revision: 2, subjectCount: 1, boundCandidateCount: 1 })
    expect(projection.snapshotDigest).toMatch(/^sha256:[0-9a-f]{64}$/u)
    expect(JSON.stringify(projection)).not.toContain(input.subjects[0]!.pathCandidate)
    expect(JSON.stringify(projection)).not.toContain("binding-reviewer")
    const event = repository.audits.findLast((entry) => entry.eventType === "design-to-code-binding-registry.revised")
    expect(event?.payload).toMatchObject({
      revision: 2, subjectCount: 1, boundCandidateCount: 1, figmaConnectionState: "not-connected",
      returnedFigmaContentState: "not-established", bindingTruthState: "not-established",
      repositoryTruthState: "not-established", codeTargetMutationState: "not-performed",
      codeGenerationState: "not-performed", implementationReadinessState: "not-established",
      actionAuthorityState: "not-granted",
    })
    expect(JSON.stringify(event)).not.toContain(input.subjects[0]!.pathCandidate)
    dependencies.designBaseline.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", staleDependencyCount: 1 })
    expect(await service.healthIssues()).toEqual([
      expect.objectContaining({ code: "design-to-code-binding-registry.review-required", severity: "warning" }),
    ])
  })

  it("fails closed on a mismatched review-ready mapping and requirement trace", async () => {
    const { service, input } = fixture()
    await expect(service.create({
      ...input, subjects: [{ ...input.subjects[0]!, requirementKeys: ["GAEP-REQ-999"] }],
    }, "binding-author")).rejects.toThrow(/requirement.*trace/iu)
  })
})
