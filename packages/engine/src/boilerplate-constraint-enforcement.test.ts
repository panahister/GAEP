import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  boilerplateConstraintEnforcementInputSchema,
  boilerplateConstraintKinds,
  type BoilerplateConstraintEnforcementInput,
} from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { BoilerplateConstraintEnforcementService } from "./boilerplate-constraint-enforcement.js"
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

function reference(record: { id: string; revision: number }) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function fixture() {
  const repository = new MemoryRepository()
  const product = { id: randomUUID(), revision: 1 }
  const initiative = { id: randomUUID(), revision: 1, productId: product.id, state: "active" as const }
  const context = { productRevision: 1, productDigest: canonicalDigest(product), initiativeRevision: 1, initiativeDigest: canonicalDigest(initiative) }
  const base = () => ({ id: randomUUID(), revision: 1, productId: product.id, initiativeId: initiative.id, context })
  const implementationUnitId = randomUUID()
  const implementationUnitModel = { ...base(), units: [{ id: implementationUnitId, key: "product-view" }] }
  const technologyProfile = { ...base(), profiles: [{ id: randomUUID(), implementationUnitId }] }
  const boilerplateRegistry = { ...base(), entries: [{ id: randomUUID(), canonicalName: "Product Studio shell" }] }
  const boilerplateSelectionBinding = { ...base(), implementationUnitModel: reference(implementationUnitModel), technologyProfile: reference(technologyProfile),
    boilerplateRegistry: reference(boilerplateRegistry), decisions: [{ id: randomUUID(), implementationUnitId }] }
  const boilerplateCompatibilityValidation = { ...base(), implementationUnitModel: reference(implementationUnitModel), technologyProfile: reference(technologyProfile),
    boilerplateRegistry: reference(boilerplateRegistry), boilerplateSelectionBinding: reference(boilerplateSelectionBinding), subjects: [] }
  const figmaToBoilerplateMapping = { ...base(), technologyProfile: reference(technologyProfile), boilerplateRegistry: reference(boilerplateRegistry),
    boilerplateSelectionBinding: reference(boilerplateSelectionBinding), boilerplateCompatibilityValidation: reference(boilerplateCompatibilityValidation), subjects: [] }
  const designToCodeBindingRegistry = { ...base(), technologyProfile: reference(technologyProfile),
    boilerplateSelectionBinding: reference(boilerplateSelectionBinding), boilerplateCompatibilityValidation: reference(boilerplateCompatibilityValidation), subjects: [] }
  const routeScreenComponentMapping = { ...base(), subjects: [] }
  const proposedChangePreview = { ...base(), previewUnits: [{ id: randomUUID(), implementationUnitId }] }
  const stagingWorkspace = { ...base(), units: [{ id: randomUUID(), implementationUnitId }] }
  const generationTargetId = randomUUID()
  const controlledDesignToCodeGeneration = { ...base(), dependencies: {
    technologyProfile: reference(technologyProfile), boilerplateSelectionBinding: reference(boilerplateSelectionBinding),
    boilerplateCompatibilityValidation: reference(boilerplateCompatibilityValidation), figmaToBoilerplateMapping: reference(figmaToBoilerplateMapping),
    designToCodeBindingRegistry: reference(designToCodeBindingRegistry), routeScreenComponentMapping: reference(routeScreenComponentMapping),
    implementationUnitModel: reference(implementationUnitModel), proposedChangePreview: reference(proposedChangePreview),
    stagingWorkspace: reference(stagingWorkspace),
  }, targets: [{ id: generationTargetId, targetKey: "product-view", implementationUnitId,
    repositoryCandidate: "gaep-web", moduleCandidate: "product-studio", pathCandidate: "src/generated/product-view.tsx" }] }
  const traceId = randomUUID()
  const designToCodeTraceability = { ...base(), dependencies: {
    controlledDesignToCodeGeneration: reference(controlledDesignToCodeGeneration),
  }, traces: [{ id: traceId, traceKey: "trace.product-view", generationTargetId, implementationUnitId,
    repositoryCandidate: "gaep-web", moduleCandidate: "product-studio", pathCandidate: "src/generated/product-view.tsx" }] }
  const dependencies = { technologyProfile, boilerplateRegistry, boilerplateSelectionBinding, boilerplateCompatibilityValidation,
    figmaToBoilerplateMapping, designToCodeBindingRegistry, routeScreenComponentMapping, implementationUnitModel,
    proposedChangePreview, stagingWorkspace, controlledDesignToCodeGeneration, designToCodeTraceability }
  const sourceByKind = {
    architecture: "route-screen-component-mapping", component: "design-to-code-binding-registry",
    dependency: "boilerplate-compatibility-validation", module: "implementation-unit-model",
    path: "design-to-code-binding-registry", route: "route-screen-component-mapping",
    stack: "technology-profile", test: "boilerplate-registry",
  } as const
  const dependencyBySource = {
    "route-screen-component-mapping": routeScreenComponentMapping,
    "design-to-code-binding-registry": designToCodeBindingRegistry,
    "boilerplate-compatibility-validation": boilerplateCompatibilityValidation,
    "implementation-unit-model": implementationUnitModel,
    "technology-profile": technologyProfile,
    "boilerplate-registry": boilerplateRegistry,
  }
  const evidence = [{ kind: "review" as const, sourceId: "constraint-review", revision: 1,
    digest: canonicalDigest({ constraint: true }), evidenceState: "human-reviewed" as const }]
  const rules = boilerplateConstraintKinds.map((kind, index) => {
    const source = sourceByKind[kind]
    return { id: randomUUID(), ordinal: index + 1, ruleKey: `rule.${kind}`, kind, source,
      sourceRecord: reference(dependencyBySource[source]), disposition: "mandatory" as const, matchMode: "catalog-membership" as const,
      allowedValueCandidates: [`candidate-${kind}`], evidenceReferences: evidence,
      actualConstraintTruthState: "not-established" as const, approvalState: "not-established" as const }
  })
  const applicableRuleIds = rules.map((rule) => rule.id).sort()
  const applicableRuleKeys = rules.map((rule) => rule.ruleKey).sort()
  const input: BoilerplateConstraintEnforcementInput = {
    initiativeId: initiative.id, context, informationClassification: "internal", title: "Boilerplate constraint policy candidate",
    dependencies: Object.fromEntries(Object.entries(dependencies).map(([key, value]) => [key, reference(value)])) as BoilerplateConstraintEnforcementInput["dependencies"],
    policyKey: "policy.product-view", rules, targets: [{ id: randomUUID(), ordinal: 1, targetKey: "product-view",
      generationTargetId, traceId, traceKey: "trace.product-view", implementationUnitId,
      repositoryCandidate: "gaep-web", moduleCandidate: "product-studio", pathCandidate: "src/generated/product-view.tsx",
      applicableRuleIds, applicableRuleKeys, violationIds: [], violationKeys: [], enforcementState: "candidate-conformant",
      repositoryInspectionState: "not-performed", sourceInspectionState: "not-performed",
      generatedOutputInspectionState: "not-performed", enforcementExecutionState: "not-performed", complianceTruthState: "not-established" }],
    violations: [], unresolvedQuestions: [], limitations: ["Candidate rules do not establish actual repository or output compliance"],
    reviewState: "ready-for-human-review", policyApprovalState: "not-established", exceptionWaiverState: "not-established",
    repositoryInspectionState: "not-performed", sourceInspectionState: "not-performed", generatedOutputInspectionState: "not-performed",
    enforcementExecutionState: "not-performed", complianceTruthState: "not-established", nativeHostAcceptanceState: "not-established",
    liveProviderAcceptanceState: "not-established", securityAcceptanceState: "not-established", releaseReadinessState: "not-established",
    deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
  }
  const readers = Object.fromEntries(Object.entries(dependencies).map(([key, value]) => [key, { readCurrent: async () => value }]))
  const service = new BoilerplateConstraintEnforcementService(repository as unknown as GaepRepository, async () => product as never,
    async () => initiative as never, readers as never)
  return { repository, service, input, initiative, dependencies }
}

describe("Boilerplate Constraint Enforcement lifecycle", () => {
  it("persists immutable target policy coverage without claiming inspection or compliance truth", async () => {
    const { repository, service, input, initiative, dependencies } = fixture()
    const created = await service.create(input, "constraint-author")
    const revised = await service.revise(created.id, 1, { ...input, title: "Reviewed boilerplate constraint policy" }, "constraint-author")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created),
      repositoryInspectionState: "not-performed", enforcementExecutionState: "not-performed", complianceTruthState: "not-established" })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({ state: "candidate-defined", ruleCount: 8, coveredKindCount: 8,
      targetCount: 1, generationTargetCount: 1, conformantTargetCount: 1, violationCount: 0,
      staleBindingCount: 0, coverageGapCount: 0, ruleGapCount: 0, invalidCandidateCount: 0 })
    const projection = await service.project(initiative.id)
    expect(projection).toMatchObject({ candidate: { policyKey: "policy.product-view", targets: [{ targetKey: "product-view",
      traceKey: "trace.product-view", pathCandidate: "src/generated/product-view.tsx", applicableRuleCount: 8,
      enforcementState: "candidate-conformant" }] } })
    expect(JSON.stringify(projection)).not.toContain("candidate-stack")
    expect(repository.audits.at(-1)?.payload).toMatchObject({ ruleCount: 8, targetCount: 1, violationCount: 0, actionAuthorityState: "not-granted" })
    dependencies.technologyProfile.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", staleBindingCount: 1 })
  })

  it("fails closed on incomplete rule coverage, forged source and path continuity, unsafe paths, and secrets", async () => {
    const { service, input } = fixture()
    expect(boilerplateConstraintEnforcementInputSchema.safeParse({ ...input, rules: input.rules.slice(1) }).success).toBe(false)
    await expect(service.create({ ...input, rules: input.rules.map((rule, index) => index === 0
      ? { ...rule, sourceRecord: { ...rule.sourceRecord, digest: canonicalDigest({ forged: true }) } } : rule) }, "constraint-author"))
      .rejects.toThrow(/exact source/iu)
    await expect(service.create({ ...input, targets: [{ ...input.targets[0]!, pathCandidate: "src/generated/forged.tsx" }] }, "constraint-author"))
      .rejects.toThrow(/continuity/iu)
    expect(boilerplateConstraintEnforcementInputSchema.safeParse({ ...input, targets: [{ ...input.targets[0]!, pathCandidate: "../escape.ts" }] }).success).toBe(false)
    expect(boilerplateConstraintEnforcementInputSchema.safeParse({ ...input, limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false)
  })
})
