import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import type { RouteScreenComponentMappingInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import type { GaepRepository } from "./repository.js"
import { RouteScreenComponentMappingService } from "./route-screen-component-mapping.js"

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
  const routeSubjectId = randomUUID()
  const screenSubjectId = randomUUID()
  const stateSubjectId = randomUUID()
  const componentSubjectId = randomUUID()
  const componentBindingId = randomUUID()
  const unitId = randomUUID()
  const criterionId = randomUUID()
  const requirementKey = "GAEP-REQ-001"
  const dependencies = {
    informationArchitecture: { id: randomUUID(), revision: 1,
      navigationRoutes: [{ key: "checkout.route" }] },
    screenStateInventory: { id: randomUUID(), revision: 1,
      screens: [{ key: "checkout.screen", routeKeys: ["checkout.route"], stateKeys: ["checkout.default"], platformKeys: ["web"] }],
      states: [{ key: "checkout.default", screenKey: "checkout.screen", routeKeys: ["checkout.route"], platformKeys: ["web"], transitionStateKeys: [] }],
      routeCoverage: [{ routeKey: "checkout.route", status: "represented", screenKeys: ["checkout.screen"], stateKeys: ["checkout.default"] }],
    },
    designRequirements: { id: randomUUID(), revision: 1, requirements: [{ key: requirementKey,
      targets: { routeKeys: ["checkout.route"], screenKeys: ["checkout.screen"], stateKeys: ["checkout.default"] } }] },
    designBaseline: { id: randomUUID(), revision: 1 },
    designToRequirementBinding: { id: randomUUID(), revision: 1 },
    figmaToBoilerplateMapping: { id: randomUUID(), revision: 1 },
    designToCodeBindingRegistry: { id: randomUUID(), revision: 1, subjects: [{
      id: componentBindingId, bindingKind: "component", designItemKey: "checkout.primary-action",
      designBindingKey: "checkout.primary-action", requirementKeys: [requirementKey],
      implementationUnitId: unitId, pathCandidate: "src/checkout/PrimaryAction.tsx",
    }] },
    implementationUnitModel: { id: randomUUID(), revision: 1, units: [{ id: unitId }] },
    acceptanceCriteria: { id: randomUUID(), revision: 1, criteria: [{ id: criterionId,
      requirements: [{ key: requirementKey }] }] },
  }
  const service = new RouteScreenComponentMappingService(
    repository as unknown as GaepRepository,
    async () => product as never,
    async () => initiative as never,
    { readCurrent: async () => dependencies.informationArchitecture } as never,
    { readCurrent: async () => dependencies.screenStateInventory } as never,
    { readCurrent: async () => dependencies.designRequirements } as never,
    { readCurrent: async () => dependencies.designBaseline } as never,
    { readCurrent: async () => dependencies.designToRequirementBinding } as never,
    { readCurrent: async () => dependencies.figmaToBoilerplateMapping } as never,
    { readCurrent: async () => dependencies.designToCodeBindingRegistry } as never,
    { readCurrent: async () => dependencies.implementationUnitModel } as never,
    { readCurrent: async () => dependencies.acceptanceCriteria } as never,
  )
  const common = {
    platformKeys: ["web"], responsiveTargetKeys: ["desktop"], designBindingKeys: ["checkout.primary-action"],
    requirementKeys: [requirementKey], acceptanceCriterionIds: [criterionId], implementationUnitIds: [unitId],
    testHookCandidates: ["checkout.primary-action"], disposition: "candidate-mapped" as const,
    conflictReferenceCandidates: [], mappedBy: { kind: "human" as const, id: "mapping-reviewer" },
    mappedAt: "2026-07-31T00:00:00.000Z", navigationTruthState: "not-established" as const,
    uiValidityState: "not-established" as const, repositoryTruthState: "not-established" as const,
    mappingTruthState: "not-established" as const, mappingCompletenessState: "not-established" as const,
    testCoverageState: "not-established" as const, codeMutationState: "not-performed" as const,
    implementationAuthorityState: "not-granted" as const,
  }
  const routeEvidence = [{ kind: "information-architecture" as const, sourceId: "checkout-route", revision: 1,
    digest: canonicalDigest(dependencies.informationArchitecture.navigationRoutes[0]), evidenceState: "human-reviewed" as const }]
  const inventoryEvidence = [{ kind: "screen-state-inventory" as const, sourceId: "checkout-screen", revision: 1,
    digest: canonicalDigest(dependencies.screenStateInventory.screens[0]), evidenceState: "human-reviewed" as const }]
  const bindingEvidence = [{ kind: "design-to-code-binding" as const, sourceId: "checkout-primary-action", revision: 1,
    digest: canonicalDigest(dependencies.designToCodeBindingRegistry.subjects[0]), evidenceState: "human-reviewed" as const }]
  const input: RouteScreenComponentMappingInput = {
    initiativeId: initiative.id,
    context: { productRevision: 1, productDigest: canonicalDigest(product), initiativeRevision: 1, initiativeDigest: canonicalDigest(initiative) },
    informationClassification: "internal", title: "Candidate Route, Screen, and Component Mapping",
    informationArchitecture: ref(dependencies.informationArchitecture),
    screenStateInventory: ref(dependencies.screenStateInventory), designRequirements: ref(dependencies.designRequirements),
    designBaseline: ref(dependencies.designBaseline), designToRequirementBinding: ref(dependencies.designToRequirementBinding),
    figmaToBoilerplateMapping: ref(dependencies.figmaToBoilerplateMapping),
    designToCodeBindingRegistry: ref(dependencies.designToCodeBindingRegistry),
    implementationUnitModel: ref(dependencies.implementationUnitModel), acceptanceCriteria: ref(dependencies.acceptanceCriteria),
    subjects: [
      { ...common, id: routeSubjectId, ordinal: 1, subjectKind: "route", sourceKey: "checkout.route",
        routeKeys: ["checkout.route"], screenKeys: ["checkout.screen"], stateKeys: ["checkout.default"],
        codeBindingSubjectIds: [componentBindingId], evidenceReferences: routeEvidence },
      { ...common, id: screenSubjectId, ordinal: 2, subjectKind: "screen", sourceKey: "checkout.screen",
        routeKeys: ["checkout.route"], screenKeys: ["checkout.screen"], stateKeys: ["checkout.default"],
        codeBindingSubjectIds: [componentBindingId], evidenceReferences: inventoryEvidence },
      { ...common, id: stateSubjectId, ordinal: 3, subjectKind: "state", sourceKey: "checkout.default",
        routeKeys: ["checkout.route"], screenKeys: ["checkout.screen"], stateKeys: ["checkout.default"],
        codeBindingSubjectIds: [componentBindingId], evidenceReferences: inventoryEvidence },
      { ...common, id: componentSubjectId, ordinal: 4, subjectKind: "component", sourceKey: "checkout.primary-action",
        designToCodeBindingSubjectId: componentBindingId, routeKeys: ["checkout.route"], screenKeys: ["checkout.screen"],
        stateKeys: ["checkout.default"], codeBindingSubjectIds: [componentBindingId], evidenceReferences: bindingEvidence },
    ],
    relationships: [
      { id: randomUUID(), ordinal: 1, relationshipKind: "route-to-screen", fromSubjectId: routeSubjectId,
        toSubjectId: screenSubjectId, state: "candidate-defined", evidenceReferences: inventoryEvidence },
      { id: randomUUID(), ordinal: 2, relationshipKind: "screen-to-state", fromSubjectId: screenSubjectId,
        toSubjectId: stateSubjectId, state: "candidate-defined", evidenceReferences: inventoryEvidence },
      { id: randomUUID(), ordinal: 3, relationshipKind: "screen-to-component", fromSubjectId: screenSubjectId,
        toSubjectId: componentSubjectId, state: "candidate-defined", evidenceReferences: bindingEvidence },
    ],
    unresolvedQuestions: [], limitations: ["Candidate mapping does not establish navigation, UI, repository, or test truth"],
    reviewState: "ready-for-human-review", figmaConnectionState: "not-connected",
    returnedFigmaContentState: "not-established", designValidityState: "not-established",
    designApprovalState: "not-established", designBaselineDesignationState: "not-established",
    navigationTruthState: "not-established", routeScreenComponentMappingTruthState: "not-established",
    routeScreenComponentMappingCompletenessState: "not-established", uiValidityState: "not-established",
    responsiveBehaviorTruthState: "not-established", platformParityState: "not-established",
    requirementSatisfactionState: "not-established", acceptanceCriteriaValidityState: "not-established",
    repositoryTruthState: "not-established", pathSymbolTruthState: "not-established", testCoverageState: "not-established",
    codeTargetMutationState: "not-performed", codeGenerationState: "not-performed",
    implementationReadinessState: "not-established", implementationCompletenessState: "not-established",
    assignmentExecutionState: "not-established", acceptanceDecisionState: "not-established",
    mergeReadinessState: "not-established", releaseReadinessState: "not-established",
    deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
  }
  return { repository, service, input, dependencies, initiative }
}

describe("Route, Screen, and Component Mapping engine lifecycle", () => {
  it("persists immutable exact receipts, projects privacy-safe status, and detects dependency drift", async () => {
    const { repository, service, input, dependencies, initiative } = fixture()
    const created = await service.create(input, "mapping-author")
    const revised = await service.revise(created.id, created.revision, { ...input, title: "Reviewed route screen component mapping" }, "mapping-author")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created) })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({
      state: "candidate-complete", sourceRouteCount: 1, sourceScreenCount: 1, sourceStateCount: 1,
      sourceComponentCount: 1, subjectCount: 4, mappedCandidateCount: 4, relationshipCount: 3,
      definedRelationshipCount: 3, missingSubjectCount: 0, extraSubjectCount: 0, invalidSubjectCount: 0,
      missingRelationshipCount: 0, invalidRelationshipCount: 0, traceGapCount: 0, evidenceGapCount: 0,
      componentPlacementGapCount: 0, testHookGapCount: 0, staleBindingCount: 0,
      staleDependencyCount: 0, invalidCandidateCount: 0,
    })
    const projection = await service.project(initiative.id)
    expect(projection.candidate).toMatchObject({ id: revised.id, revision: 2, subjectCount: 4, relationshipCount: 3 })
    expect(projection.snapshotDigest).toMatch(/^sha256:[0-9a-f]{64}$/u)
    expect(JSON.stringify(projection)).not.toContain("checkout.route")
    expect(JSON.stringify(projection)).not.toContain("mapping-reviewer")
    const event = repository.audits.findLast((entry) => entry.eventType === "route-screen-component-mapping.revised")
    expect(event?.payload).toMatchObject({ revision: 2, subjectCount: 4, relationshipCount: 3,
      navigationTruthState: "not-established", routeScreenComponentMappingTruthState: "not-established",
      repositoryTruthState: "not-established", codeTargetMutationState: "not-performed",
      implementationReadinessState: "not-established", actionAuthorityState: "not-granted" })
    expect(JSON.stringify(event)).not.toContain("checkout.route")
    dependencies.informationArchitecture.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", staleDependencyCount: 1 })
    expect(await service.healthIssues()).toEqual([
      expect.objectContaining({ code: "route-screen-component-mapping.review-required", severity: "warning" }),
    ])
  })

  it("fails closed on mismatched review-ready trace and missing component placement", async () => {
    const { service, input } = fixture()
    await expect(service.create({
      ...input, subjects: input.subjects.map((subject, index) => index === 0
        ? { ...subject, requirementKeys: ["GAEP-REQ-999"] } : subject),
    }, "mapping-author")).rejects.toThrow(/exact complete/iu)
    await expect(service.create({ ...input, relationships: input.relationships.slice(0, 2) }, "mapping-author"))
      .rejects.toThrow(/exact complete/iu)
  })
})
