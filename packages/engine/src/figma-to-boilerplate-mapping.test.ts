import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import type { FigmaToBoilerplateMappingInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { FigmaToBoilerplateMappingService } from "./figma-to-boilerplate-mapping.js"
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
  const profileId = randomUUID()
  const registryEntryId = randomUUID()
  const decisionId = randomUUID()
  const validationSubjectId = randomUUID()
  const dependencies = {
    designApplicability: { id: randomUUID(), revision: 1 },
    designSystemTokenContract: { id: randomUUID(), revision: 1 },
    responsiveMultiPlatformTargets: { id: randomUUID(), revision: 1 },
    finalizedFigmaSnapshotImport: { id: randomUUID(), revision: 1 },
    designToRequirementBinding: {
      id: randomUUID(), revision: 1,
      bindings: [{
        key: "checkout.primary-action", designItemKey: "checkout.primary-action",
        designItemKind: "component", requirementKeys: ["GAEP-REQ-001"],
      }],
    },
    designBaseline: { id: randomUUID(), revision: 1 },
    implementationUnitModel: { id: randomUUID(), revision: 1, units: [{ id: unitId }] },
    technologyProfile: { id: randomUUID(), revision: 1 },
    boilerplateRegistry: { id: randomUUID(), revision: 1 },
    boilerplateSelectionBinding: {
      id: randomUUID(), revision: 1,
      decisions: [{
        id: decisionId, disposition: "candidate-selected",
        implementationUnitId: unitId, technologyProfileId: profileId,
        boilerplateRegistryEntryId: registryEntryId,
      }],
    },
    boilerplateCompatibilityValidation: {
      id: randomUUID(), revision: 1,
      subjects: [{
        id: validationSubjectId, bindingDecisionId: decisionId,
        implementationUnitId: unitId, technologyProfileId: profileId,
        boilerplateRegistryEntryId: registryEntryId, outcome: "candidate-compatible",
      }],
    },
  }
  const service = new FigmaToBoilerplateMappingService(
    repository as unknown as GaepRepository,
    async () => product as never,
    async () => initiative as never,
    { readCurrent: async () => dependencies.designApplicability } as never,
    { readCurrent: async () => dependencies.designSystemTokenContract } as never,
    { readCurrent: async () => dependencies.responsiveMultiPlatformTargets } as never,
    { readCurrent: async () => dependencies.finalizedFigmaSnapshotImport } as never,
    { readCurrent: async () => dependencies.designToRequirementBinding } as never,
    { readCurrent: async () => dependencies.designBaseline } as never,
    { readCurrent: async () => dependencies.implementationUnitModel } as never,
    { readCurrent: async () => dependencies.technologyProfile } as never,
    { readCurrent: async () => dependencies.boilerplateRegistry } as never,
    { readCurrent: async () => dependencies.boilerplateSelectionBinding } as never,
    { readCurrent: async () => dependencies.boilerplateCompatibilityValidation } as never,
  )
  const input: FigmaToBoilerplateMappingInput = {
    initiativeId: initiative.id,
    context: {
      productRevision: 1, productDigest: canonicalDigest(product),
      initiativeRevision: 1, initiativeDigest: canonicalDigest(initiative),
    },
    informationClassification: "internal",
    title: "Candidate Figma-to-Boilerplate mapping",
    designApplicability: ref(dependencies.designApplicability),
    designSystemTokenContract: ref(dependencies.designSystemTokenContract),
    responsiveMultiPlatformTargets: ref(dependencies.responsiveMultiPlatformTargets),
    finalizedFigmaSnapshotImport: ref(dependencies.finalizedFigmaSnapshotImport),
    designToRequirementBinding: ref(dependencies.designToRequirementBinding),
    designBaseline: ref(dependencies.designBaseline),
    implementationUnitModel: ref(dependencies.implementationUnitModel),
    technologyProfile: ref(dependencies.technologyProfile),
    boilerplateRegistry: ref(dependencies.boilerplateRegistry),
    boilerplateSelectionBinding: ref(dependencies.boilerplateSelectionBinding),
    boilerplateCompatibilityValidation: ref(dependencies.boilerplateCompatibilityValidation),
    subjects: [{
      id: randomUUID(), ordinal: 1, designBindingKey: "checkout.primary-action",
      designItemKey: "checkout.primary-action", designItemKind: "component", mappingKind: "component",
      bindingDecisionId: decisionId, compatibilityValidationSubjectId: validationSubjectId,
      implementationUnitId: unitId, technologyProfileId: profileId,
      boilerplateRegistryEntryId: registryEntryId, targetKind: "component",
      targetCandidate: "src/components/checkout/PrimaryAction", requirementKeys: ["GAEP-REQ-001"],
      outcome: "candidate-mapped",
      evidenceReferences: [{
        kind: "design-to-requirement", sourceId: "checkout-primary-action-binding", revision: 1,
        digest: canonicalDigest(dependencies.designToRequirementBinding.bindings[0]),
        evidenceState: "human-reviewed",
      }],
      conflictReferenceCandidates: [], mappedBy: { kind: "human", id: "mapping-reviewer" },
      mappedAt: "2026-07-30T00:00:00.000Z", mappingTruthState: "not-established",
      mappingCompletenessState: "not-established", designValidityState: "not-established",
      generatedCodeState: "not-generated", implementationAuthorityState: "not-granted",
    }],
    unresolvedQuestions: [], limitations: ["Candidate mappings do not establish design validity or generate code"],
    reviewState: "ready-for-human-review", figmaConnectionState: "not-connected",
    returnedFigmaContentState: "not-established", designValidityState: "not-established",
    designApprovalState: "not-established", designBaselineDesignationState: "not-established",
    mappingTruthState: "not-established", mappingCompletenessState: "not-established",
    selectionBindingEffectivenessState: "not-established", compatibilityTruthState: "not-established",
    sourceRetrievalState: "not-established", assetImportInstantiationState: "not-established",
    codeGenerationState: "not-performed", implementationReadinessState: "not-established",
    implementationCompletenessState: "not-established", assignmentExecutionState: "not-established",
    acceptanceDecisionState: "not-established", mergeReadinessState: "not-established",
    releaseReadinessState: "not-established", deploymentReadinessState: "not-established",
    actionAuthorityState: "not-granted",
  }
  return { repository, service, input, dependencies, initiative }
}

describe("Figma-to-Boilerplate Mapping engine lifecycle", () => {
  it("persists immutable exact receipts, privately projects status, and detects dependency drift", async () => {
    const { repository, service, input, dependencies, initiative } = fixture()
    const created = await service.create(input, "mapping-author")
    const revised = await service.revise(created.id, created.revision, { ...input, title: "Reviewed mapping candidate" }, "mapping-author")

    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created) })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({
      state: "candidate-complete", designBindingCount: 1, subjectCount: 1, mappedCandidateCount: 1,
      missingSubjectCount: 0, invalidSubjectCount: 0, targetGapCount: 0, traceGapCount: 0,
      evidenceGapCount: 0, staleBindingCount: 0, staleDependencyCount: 0, invalidCandidateCount: 0,
    })
    const projection = await service.project(initiative.id)
    expect(projection.candidate).toMatchObject({ id: revised.id, revision: 2, subjectCount: 1, mappedCandidateCount: 1 })
    expect(projection.snapshotDigest).toMatch(/^sha256:[0-9a-f]{64}$/u)
    expect(JSON.stringify(projection)).not.toContain(input.subjects[0]!.targetCandidate)
    expect(JSON.stringify(projection)).not.toContain("mapping-reviewer")

    const event = repository.audits.findLast((entry) => entry.eventType === "figma-to-boilerplate-mapping.revised")
    expect(event?.payload).toMatchObject({
      revision: 2, subjectCount: 1, mappedCandidateCount: 1, figmaConnectionState: "not-connected",
      returnedFigmaContentState: "not-established", designValidityState: "not-established",
      mappingTruthState: "not-established", codeGenerationState: "not-performed",
      implementationReadinessState: "not-established", actionAuthorityState: "not-granted",
    })
    expect(JSON.stringify(event)).not.toContain(input.subjects[0]!.targetCandidate)

    dependencies.designApplicability.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", staleDependencyCount: 1 })
    expect(await service.healthIssues()).toEqual([
      expect.objectContaining({ code: "figma-to-boilerplate-mapping.review-required", severity: "warning" }),
    ])
  })

  it("fails closed on a mismatched review-ready design and requirement trace", async () => {
    const { service, input } = fixture()
    await expect(service.create({
      ...input,
      subjects: [{ ...input.subjects[0]!, requirementKeys: ["GAEP-REQ-999"] }],
    }, "mapping-author")).rejects.toThrow(/requirement.*trace/iu)
  })
})
