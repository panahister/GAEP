import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  controlledDesignToCodeGenerationInputSchema,
  type ControlledDesignToCodeGenerationInput,
} from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { ControlledDesignToCodeGenerationService } from "./controlled-design-to-code-generation.js"
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
  const implementationUnitId = randomUUID(), bindingSubjectId = randomUUID()
  const designBaseline = { ...base(), membershipDigest: canonicalDigest({ baseline: "membership" }), semanticVersion: "1.0.0" }
  const designToRequirementBinding = { ...base(), membershipDigest: canonicalDigest({ requirements: true }) }
  const figmaToBoilerplateMapping = { ...base() }
  const implementationUnitModel = { ...base() }
  const technologyProfile = { ...base() }
  const boilerplateSelectionBinding = { ...base() }
  const boilerplateCompatibilityValidation = { ...base() }
  const designToCodeBindingRegistry = {
    ...base(), designBaseline: reference(designBaseline), designToRequirementBinding: reference(designToRequirementBinding),
    figmaToBoilerplateMapping: reference(figmaToBoilerplateMapping), implementationUnitModel: reference(implementationUnitModel),
    technologyProfile: reference(technologyProfile), boilerplateSelectionBinding: reference(boilerplateSelectionBinding),
    boilerplateCompatibilityValidation: reference(boilerplateCompatibilityValidation),
    bindingSubjectCatalogDigest: canonicalDigest({ binding: "catalog" }),
    subjects: [{ id: bindingSubjectId, disposition: "candidate-bound", implementationUnitId,
      repositoryCandidate: "gaep-web", moduleCandidate: "product-studio", pathCandidate: "src/generated/product-view.tsx" }],
  }
  const routeScreenComponentMapping = {
    ...base(), designBaseline: reference(designBaseline), designToRequirementBinding: reference(designToRequirementBinding),
    designToCodeBindingRegistry: reference(designToCodeBindingRegistry), subjectCatalogDigest: canonicalDigest({ routes: "catalog" }),
  }
  const proposedChangePreview = { ...base() }
  const stagingWorkspace = { ...base(), proposedChangePreview: reference(proposedChangePreview) }
  const codexSelection = { schemaVersion: 2 as const, adapterId: "gaep.codex-cli", agentId: "codex-cli", modelId: "codex-source-model",
    modelTruthClass: "configured" as const, modelAlias: null, settings: {}, selectedAt: "2026-07-31T10:00:00.000Z", capabilityDigest: canonicalDigest({ capabilities: "codex" }) }
  const targetSelection = { ...codexSelection, modelId: "codex-target-model", selectedAt: "2026-07-31T10:02:00.000Z" }
  const claudeSelection = { schemaVersion: 2 as const, adapterId: "gaep.claude-code-cli", agentId: "claude-code-cli", modelId: "claude-source-model",
    modelTruthClass: "configured" as const, modelAlias: null, settings: {}, selectedAt: "2026-07-31T10:01:00.000Z", capabilityDigest: canonicalDigest({ capabilities: "claude" }) }
  const codexProvider = { adapterId: codexSelection.adapterId, agentId: codexSelection.agentId, modelId: codexSelection.modelId,
    capabilityDigest: codexSelection.capabilityDigest, runtimeVersion: "candidate-runtime" }
  const targetProvider = { ...codexProvider, modelId: targetSelection.modelId }
  const claudeProvider = { adapterId: claudeSelection.adapterId, agentId: claudeSelection.agentId, modelId: claudeSelection.modelId,
    capabilityDigest: claudeSelection.capabilityDigest, runtimeVersion: "candidate-runtime" }
  const controlledCodexImplementation = { ...base(), proposedChangePreview: reference(proposedChangePreview), stagingWorkspace: reference(stagingWorkspace),
    selection: codexSelection, provider: codexProvider }
  const controlledClaudeImplementation = { ...base(), proposedChangePreview: reference(proposedChangePreview), stagingWorkspace: reference(stagingWorkspace),
    selection: claudeSelection, provider: claudeProvider }
  const providerSwitchImplementation = { ...base(), controlledCodexImplementation: reference(controlledCodexImplementation),
    controlledClaudeImplementation: reference(controlledClaudeImplementation) }
  const modelSwitchImplementation = { ...base(), providerSwitchImplementation: reference(providerSwitchImplementation), provider: "codex" as const,
    targetSelection, targetProvider }
  const approvedFigmaContextRetrieval = {
    ...base(), dependencies: { designBaseline: reference(designBaseline), designToRequirementBinding: reference(designToRequirementBinding),
      designToCodeBindingRegistry: reference(designToCodeBindingRegistry), routeScreenComponentMapping: reference(routeScreenComponentMapping),
      proposedChangePreview: reference(proposedChangePreview), stagingWorkspace: reference(stagingWorkspace),
      modelSwitchImplementation: reference(modelSwitchImplementation) },
    approvedSnapshotReceiptDigest: canonicalDigest({ approved: "snapshot" }),
    generationContextReceiptDigest: canonicalDigest({ generation: "context" }),
  }
  const dependencies = {
    approvedFigmaContextRetrieval, designBaseline, designToRequirementBinding, figmaToBoilerplateMapping,
    designToCodeBindingRegistry, routeScreenComponentMapping, implementationUnitModel, technologyProfile,
    boilerplateSelectionBinding, boilerplateCompatibilityValidation, proposedChangePreview, stagingWorkspace,
    controlledCodexImplementation, controlledClaudeImplementation, providerSwitchImplementation, modelSwitchImplementation,
  }
  const targetBase = {
    targetKey: "product-view", designToCodeBindingSubjectId: bindingSubjectId, implementationUnitId,
    repositoryCandidate: "gaep-web", moduleCandidate: "product-studio", pathCandidate: "src/generated/product-view.tsx",
    expectedTraceKeys: ["requirement.req-1"], expectedTestOutputs: ["Product view component test passes"],
  }
  const target = { id: randomUUID(), ordinal: 1, ...targetBase, targetReceiptDigest: canonicalDigest(targetBase),
    generationEffectState: "not-performed" as const, sourceMutationState: "not-performed" as const }
  const input: ControlledDesignToCodeGenerationInput = {
    initiativeId: initiative.id, context, informationClassification: "internal", title: "Controlled design-to-code generation plan",
    dependencies: Object.fromEntries(Object.entries(dependencies).map(([key, value]) => [key, reference(value)])) as ControlledDesignToCodeGenerationInput["dependencies"],
    selectedProvider: "codex", selection: targetSelection, provider: targetProvider,
    designContext: { approvedSnapshotReceiptDigest: approvedFigmaContextRetrieval.approvedSnapshotReceiptDigest,
      approvedGenerationContextReceiptDigest: approvedFigmaContextRetrieval.generationContextReceiptDigest,
      baselineMembershipDigest: designBaseline.membershipDigest, baselineSemanticVersion: designBaseline.semanticVersion,
      designBindingCatalogDigest: designToCodeBindingRegistry.bindingSubjectCatalogDigest,
      routeSubjectCatalogDigest: routeScreenComponentMapping.subjectCatalogDigest,
      contentBoundary: "metadata-and-digests-only", materializationState: "not-performed", transferState: "not-performed" },
    planKey: "controlled-product-view-generation", targets: [target],
    prerequisites: ["approved-design-context-review", "exact-target-review", "expected-trace-test-review", "human-generation-approval", "live-provider-readiness", "stage-authorization"].map((key) => ({
      key: key as "approved-design-context-review", state: "required-not-established" as const, evidenceReferences: [],
    })),
    lifecycle: { planningState: "candidate-defined", figmaAccessState: "not-performed", contextMaterializationState: "not-performed",
      contextTransferState: "not-performed", providerExecutionState: "not-performed", generatedOutputState: "not-created",
      outputInspectionState: "not-performed", realStageCreationState: "not-performed", sourceMutationState: "not-performed",
      approvalState: "not-established", authorizationState: "not-established", acceptanceState: "not-established" },
    evidenceReferences: [{ kind: "evidence", sourceId: "controlled-generation-plan-inspection", revision: 1,
      digest: canonicalDigest({ evidence: true }), evidenceState: "human-reviewed" }],
    unresolvedQuestions: [], limitations: ["This candidate does not call Figma or a provider, generate code, create a stage, or mutate source"],
    reviewState: "ready-for-human-review", generationReadinessState: "not-established", nativeHostAcceptanceState: "not-established",
    liveProviderAcceptanceState: "not-established", securityAcceptanceState: "not-established", releaseReadinessState: "not-established",
    deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
  }
  const readers = Object.fromEntries(Object.entries(dependencies).map(([key, value]) => [key, { readCurrent: async () => value }]))
  const service = new ControlledDesignToCodeGenerationService(repository as unknown as GaepRepository, async () => product as never,
    async () => initiative as never, readers as never)
  return { repository, service, input, initiative, dependencies }
}

describe("Controlled Design-to-Code Generation lifecycle", () => {
  it("persists immutable approved design, target, and provider/model continuity without generating code", async () => {
    const { repository, service, input, initiative, dependencies } = fixture()
    const created = await service.create(input, "implementation-author")
    const revised = await service.revise(created.id, 1, { ...input, title: "Reviewed controlled generation plan" }, "implementation-author")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created), selectedProvider: "codex",
      lifecycle: { figmaAccessState: "not-performed", providerExecutionState: "not-performed", generatedOutputState: "not-created", sourceMutationState: "not-performed" } })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({ state: "candidate-defined", targetCount: 1,
      implementationUnitCount: 1, pathCount: 1, expectedTraceCount: 1, expectedTestOutputCount: 1,
      staleBindingCount: 0, targetGapCount: 0, providerGapCount: 0, contextGapCount: 0, lifecycleGapCount: 0 })
    expect(await service.project(initiative.id)).toMatchObject({ candidate: { selectedProvider: "codex", targetCount: 1,
      selection: { modelId: "codex-target-model" }, designContext: { contentBoundary: "metadata-and-digests-only" } } })
    expect(repository.audits.at(-1)?.payload).toMatchObject({ targetCount: 1, pathCount: 1, actionAuthorityState: "not-granted" })
    expect(JSON.stringify(await service.project(initiative.id))).not.toContain("src/generated/product-view.tsx")
    dependencies.designBaseline.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", staleBindingCount: 1 })
  })

  it("fails closed on target, provider, context, path, and secret-shaped forgery", async () => {
    const { service, input } = fixture()
    await expect(service.create({ ...input, targets: [{ ...input.targets[0]!, pathCandidate: "src/generated/forged.tsx" }] }, "implementation-author")).rejects.toThrow(/target|binding/iu)
    await expect(service.create({ ...input, selection: { ...input.selection, modelId: "forged-model" } }, "implementation-author")).rejects.toThrow(/provider|model/iu)
    await expect(service.create({ ...input, designContext: { ...input.designContext, baselineMembershipDigest: canonicalDigest({ forged: true }) } }, "implementation-author")).rejects.toThrow(/design|version/iu)
    expect(controlledDesignToCodeGenerationInputSchema.safeParse({ ...input, targets: [{ ...input.targets[0]!, pathCandidate: "../escape.ts" }] }).success).toBe(false)
    expect(controlledDesignToCodeGenerationInputSchema.safeParse({ ...input, limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false)
  })
})
