import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import { modelSwitchImplementationInputSchema, type ModelSwitchImplementationInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { ModelSwitchImplementationService } from "./model-switch-implementation.js"
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

function fixture() {
  const repository = new MemoryRepository()
  const product = { id: randomUUID(), revision: 1 }
  const initiative = { id: randomUUID(), revision: 1, productId: product.id, state: "active" as const }
  const context = { productRevision: 1, productDigest: canonicalDigest(product), initiativeRevision: 1, initiativeDigest: canonicalDigest(initiative) }
  const preview = { recordId: randomUUID(), revision: 1, digest: canonicalDigest({ preview: true }) }
  const staging = { recordId: randomUUID(), revision: 1, digest: canonicalDigest({ staging: true }) }
  const evidence = { kind: "evidence" as const, sourceId: "model-switch-inspection", revision: 1,
    digest: canonicalDigest({ evidence: true }), evidenceState: "human-reviewed" as const }
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
  const planReceipt = canonicalDigest({ plan: "codex" }), recoveryReceipt = canonicalDigest({ recovery: "codex" })
  const codex = { id: randomUUID(), revision: 1, productId: product.id, initiativeId: initiative.id, context,
    proposedChangePreview: preview, stagingWorkspace: staging, selection: codexSelection, provider: codexProvider,
    plan: { planReceiptDigest: planReceipt }, recoveryJournal: { recoveryReceiptDigest: recoveryReceipt }, units: [] }
  const claude = { id: randomUUID(), revision: 1, productId: product.id, initiativeId: initiative.id, context,
    proposedChangePreview: preview, stagingWorkspace: staging, selection: claudeSelection, provider: claudeProvider,
    plan: { planReceiptDigest: canonicalDigest({ plan: "claude" }) }, recoveryJournal: { recoveryReceiptDigest: canonicalDigest({ recovery: "claude" }) }, units: [] }
  const controlledCodexImplementation = { recordId: codex.id, revision: codex.revision, digest: canonicalDigest(codex) }
  const controlledClaudeImplementation = { recordId: claude.id, revision: claude.revision, digest: canonicalDigest(claude) }
  const providerSwitch = { id: randomUUID(), revision: 1, productId: product.id, initiativeId: initiative.id, context,
    proposedChangePreview: preview, stagingWorkspace: staging, controlledCodexImplementation, controlledClaudeImplementation,
    sourceSelection: codexSelection, targetSelection: claudeSelection, sourceProvider: codexProvider, targetProvider: claudeProvider,
    continuityReceiptDigest: canonicalDigest({ scope: "provider-switch" }), units: [{ id: randomUUID(), paths: [{ id: randomUUID() }] }] }
  const providerSwitchImplementation = { recordId: providerSwitch.id, revision: providerSwitch.revision, digest: canonicalDigest(providerSwitch) }
  const transitionBase = { state: "candidate-not-recorded" as const, transitionKey: "model-switch-transition-1",
    sourceModelState: "candidate-bound" as const, targetModelAvailabilityState: "not-established" as const,
    capabilityRefreshState: "not-performed" as const, contextTransferState: "not-performed" as const,
    handoffState: "not-recorded" as const, resumeState: "not-performed" as const }
  const transition = { ...transitionBase, transitionReceiptDigest: canonicalDigest({ ...transitionBase, provider: "codex",
    providerSwitchRole: "provider-switch-source-candidate", sourceSelection: codexSelection, targetSelection,
    providerSwitchImplementation }) }
  const input: ModelSwitchImplementationInput = {
    initiativeId: initiative.id, context, informationClassification: "internal", title: "Model switch implementation candidate",
    proposedChangePreview: preview, stagingWorkspace: staging, controlledCodexImplementation, controlledClaudeImplementation,
    providerSwitchImplementation, provider: "codex", providerSwitchRole: "provider-switch-source-candidate",
    sourceSelection: codexSelection, targetSelection, sourceProvider: codexProvider, targetProvider,
    sourcePlanReceiptDigest: planReceipt, sourceRecoveryReceiptDigest: recoveryReceipt,
    providerSwitchContinuityReceiptDigest: providerSwitch.continuityReceiptDigest, unitCount: 1, pathCount: 1, transition,
    prerequisites: ["capability-refresh-review", "human-model-switch-approval", "resume-authorization", "source-model-review", "target-model-discovery"].map((key) => ({
      key: key as "source-model-review", state: "required-not-established" as const, evidenceReferences: [],
    })),
    lifecycle: { planningState: "candidate-defined", modelTransitionState: "not-performed", providerExecutionState: "not-performed",
      capabilityRefreshState: "not-performed", contextTransferState: "not-performed", handoffState: "not-recorded",
      stageOwnershipState: "unchanged", resumeState: "not-performed", approvalState: "not-established", authorizationState: "not-established",
      sourceMutationState: "not-performed", applyState: "not-performed", discardState: "not-performed", recoveryState: "not-exercised" },
    evidenceReferences: [evidence], unresolvedQuestions: [], limitations: ["This candidate does not execute a provider or transition a model"],
    reviewState: "ready-for-human-review", acceptanceDecisionState: "not-established", nativeHostAcceptanceState: "not-established",
    liveProviderAcceptanceState: "not-established", securityAcceptanceState: "not-established", releaseReadinessState: "not-established",
    deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
  }
  const service = new ModelSwitchImplementationService(repository as unknown as GaepRepository, async () => product as never,
    async () => initiative as never, { readCurrent: async () => codex as never }, { readCurrent: async () => claude as never },
    { readCurrent: async () => providerSwitch as never })
  return { repository, service, input, initiative, providerSwitch }
}

describe("Model Switch Implementation lifecycle", () => {
  it("persists immutable same-provider model continuity without executing a transition", async () => {
    const { repository, service, input, initiative, providerSwitch } = fixture()
    const created = await service.create(input, "implementation-author")
    const revised = await service.revise(created.id, 1, { ...input, title: "Reviewed model switch candidate" }, "implementation-author")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created), provider: "codex",
      lifecycle: { modelTransitionState: "not-performed", providerExecutionState: "not-performed", handoffState: "not-recorded" } })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({ state: "candidate-defined", unitCount: 1, pathCount: 1,
      providerGapCount: 0, modelGapCount: 0, continuityGapCount: 0, transitionGapCount: 0 })
    const projection = await service.project(initiative.id)
    expect(projection.candidate).toMatchObject({ provider: "codex", sourceSelection: { modelId: "codex-source-model" },
      targetSelection: { modelId: "codex-target-model" }, transition: { state: "candidate-not-recorded" } })
    expect(JSON.stringify(projection)).not.toContain("implementation-author")
    expect(JSON.stringify(projection)).not.toContain("/workspace")
    expect(repository.audits.at(-1)?.payload).toMatchObject({ unitCount: 1, pathCount: 1, actionAuthorityState: "not-granted" })
    providerSwitch.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", staleBindingCount: 1 })
  })

  it("fails closed on same-model, capability, transition, and secret-shaped forgery", async () => {
    const { service, input } = fixture()
    await expect(service.create({ ...input, targetSelection: { ...input.targetSelection, modelId: input.sourceSelection.modelId } }, "implementation-author")).rejects.toThrow()
    await expect(service.create({ ...input, targetProvider: { ...input.targetProvider, capabilityDigest: canonicalDigest({ forged: true }) } }, "implementation-author")).rejects.toThrow(/capability/iu)
    await expect(service.create({ ...input, transition: { ...input.transition, transitionReceiptDigest: canonicalDigest({ forged: true }) } }, "implementation-author")).rejects.toThrow(/transition receipt/iu)
    expect(modelSwitchImplementationInputSchema.safeParse({ ...input, limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false)
  })
})
