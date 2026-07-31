import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import { providerSwitchImplementationInputSchema, type ProviderSwitchImplementationInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { ProviderSwitchImplementationService } from "./provider-switch-implementation.js"
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
  const evidence = { kind: "evidence" as const, sourceId: "provider-switch-inspection", revision: 1,
    digest: canonicalDigest({ evidence: true }), evidenceState: "human-reviewed" as const }
  const codexSelection = { schemaVersion: 2 as const, adapterId: "gaep.codex-cli", agentId: "codex-cli", modelId: "configured-codex-model",
    modelTruthClass: "configured" as const, modelAlias: null, settings: {}, selectedAt: "2026-07-31T10:00:00.000Z", capabilityDigest: canonicalDigest({ capabilities: "codex" }) }
  const claudeSelection = { schemaVersion: 2 as const, adapterId: "gaep.claude-code-cli", agentId: "claude-code-cli", modelId: "configured-claude-model",
    modelTruthClass: "configured" as const, modelAlias: null, settings: {}, selectedAt: "2026-07-31T10:01:00.000Z", capabilityDigest: canonicalDigest({ capabilities: "claude" }) }
  const codexProvider = { adapterId: codexSelection.adapterId, agentId: codexSelection.agentId, modelId: codexSelection.modelId,
    capabilityDigest: codexSelection.capabilityDigest, runtimeVersion: "candidate-runtime" }
  const claudeProvider = { adapterId: claudeSelection.adapterId, agentId: claudeSelection.agentId, modelId: claudeSelection.modelId,
    capabilityDigest: claudeSelection.capabilityDigest, runtimeVersion: "candidate-runtime" }
  const proposedPreviewUnitId = randomUUID(), stagingUnitId = randomUUID(), implementationUnitId = randomUUID()
  const proposedPreviewPathId = randomUUID(), stagingPathId = randomUUID(), codexPathId = randomUUID(), claudePathId = randomUUID()
  const codexPathReceipt = canonicalDigest({ codexPath: true }), claudePathReceipt = canonicalDigest({ claudePath: true })
  const codexUnitReceipt = canonicalDigest({ codexUnit: true }), claudeUnitReceipt = canonicalDigest({ claudeUnit: true })
  const codexPlanReceipt = canonicalDigest({ codexPlan: true }), claudePlanReceipt = canonicalDigest({ claudePlan: true })
  const codexRecoveryReceipt = canonicalDigest({ codexRecovery: true }), claudeRecoveryReceipt = canonicalDigest({ claudeRecovery: true })
  const codex = {
    id: randomUUID(), revision: 1, productId: product.id, initiativeId: initiative.id, context, proposedChangePreview: preview, stagingWorkspace: staging,
    selection: codexSelection, provider: codexProvider, plan: { planReceiptDigest: codexPlanReceipt }, recoveryJournal: { recoveryReceiptDigest: codexRecoveryReceipt },
    units: [{ id: randomUUID(), proposedPreviewUnitId, stagingUnitId, implementationUnitId, implementationUnitKey: "unit-a", unitPlanReceiptDigest: codexUnitReceipt,
      paths: [{ id: codexPathId, proposedPreviewPathId, stagingPathId, pathCandidate: "packages/example/src/index.ts", stagedEffectReceiptDigest: codexPathReceipt }] }],
  }
  const claude = {
    id: randomUUID(), revision: 1, productId: product.id, initiativeId: initiative.id, context, proposedChangePreview: preview, stagingWorkspace: staging,
    selection: claudeSelection, provider: claudeProvider, plan: { planReceiptDigest: claudePlanReceipt }, recoveryJournal: { recoveryReceiptDigest: claudeRecoveryReceipt },
    units: [{ id: randomUUID(), proposedPreviewUnitId, stagingUnitId, implementationUnitId, implementationUnitKey: "unit-a", unitPlanReceiptDigest: claudeUnitReceipt,
      paths: [{ id: claudePathId, proposedPreviewPathId, stagingPathId, pathCandidate: "packages/example/src/index.ts", stagedEffectReceiptDigest: claudePathReceipt }] }],
  }
  const controlledCodexImplementation = { recordId: codex.id, revision: codex.revision, digest: canonicalDigest(codex) }
  const controlledClaudeImplementation = { recordId: claude.id, revision: claude.revision, digest: canonicalDigest(claude) }
  const pathBase = { id: randomUUID(), ordinal: 1, proposedPreviewPathId, stagingPathId, controlledCodexPathId: codexPathId,
    controlledClaudePathId: claudePathId, pathCandidate: "packages/example/src/index.ts", codexPlanReceiptDigest: codexPathReceipt,
    claudePlanReceiptDigest: claudePathReceipt, evidenceReferences: [evidence], outcome: "candidate-defined" as const }
  const path = { ...pathBase, continuityReceiptDigest: canonicalDigest({ proposedPreviewPathId, stagingPathId, controlledCodexPathId: codexPathId,
    controlledClaudePathId: claudePathId, pathCandidate: pathBase.pathCandidate, codexPlanReceiptDigest: codexPathReceipt, claudePlanReceiptDigest: claudePathReceipt }) }
  const unitBase = { id: randomUUID(), ordinal: 1, proposedPreviewUnitId, stagingUnitId, controlledCodexUnitId: codex.units[0]!.id,
    controlledClaudeUnitId: claude.units[0]!.id, implementationUnitId, implementationUnitKey: "unit-a", codexUnitPlanReceiptDigest: codexUnitReceipt,
    claudeUnitPlanReceiptDigest: claudeUnitReceipt, paths: [path], evidenceReferences: [evidence], outcome: "candidate-defined" as const }
  const unit = { ...unitBase, continuityReceiptDigest: canonicalDigest({ proposedPreviewUnitId, stagingUnitId,
    controlledCodexUnitId: unitBase.controlledCodexUnitId, controlledClaudeUnitId: unitBase.controlledClaudeUnitId,
    implementationUnitId, implementationUnitKey: "unit-a", codexUnitPlanReceiptDigest: codexUnitReceipt,
    claudeUnitPlanReceiptDigest: claudeUnitReceipt, paths: [{ id: path.id, continuityReceiptDigest: path.continuityReceiptDigest }] }) }
  const handoffBase = { state: "candidate-not-recorded" as const, handoffKey: "provider-switch-handoff-1",
    sourceTerminalRunState: "not-established" as const, targetRuntimeReadinessState: "not-established" as const,
    stageOwnershipTransferState: "not-performed" as const, resumeState: "not-performed" as const }
  const handoff = { ...handoffBase, handoffReceiptDigest: canonicalDigest({ ...handoffBase, direction: "codex-to-claude",
    sourceProvider: codexProvider, targetProvider: claudeProvider, controlledCodexImplementation, controlledClaudeImplementation }) }
  const input: ProviderSwitchImplementationInput = {
    initiativeId: initiative.id, context, informationClassification: "internal", title: "Provider switch implementation candidate",
    proposedChangePreview: preview, stagingWorkspace: staging, controlledCodexImplementation, controlledClaudeImplementation,
    direction: "codex-to-claude", sourceSelection: codexSelection, targetSelection: claudeSelection,
    sourceProvider: codexProvider, targetProvider: claudeProvider, sourcePlanReceiptDigest: codexPlanReceipt, targetPlanReceiptDigest: claudePlanReceipt,
    sourceRecoveryReceiptDigest: codexRecoveryReceipt, targetRecoveryReceiptDigest: claudeRecoveryReceipt, units: [unit], handoff,
    prerequisites: ["apply-authorization", "human-switch-approval", "source-terminal-state-review", "stage-ownership-transfer-authorization", "target-runtime-readiness"].map((key) => ({
      key: key as "apply-authorization", state: "required-not-established" as const, evidenceReferences: [],
    })),
    lifecycle: { planningState: "candidate-defined", providerTransitionState: "not-performed", handoffState: "not-recorded",
      stageOwnershipState: "unchanged", resumeState: "not-performed", approvalState: "not-established", authorizationState: "not-established",
      sourceMutationState: "not-performed", applyState: "not-performed", discardState: "not-performed", recoveryState: "not-exercised" },
    evidenceReferences: [evidence], unresolvedQuestions: [], limitations: ["This candidate does not transition or execute either provider"],
    reviewState: "ready-for-human-review", acceptanceDecisionState: "not-established", nativeHostAcceptanceState: "not-established",
    liveProviderAcceptanceState: "not-established", securityAcceptanceState: "not-established", releaseReadinessState: "not-established",
    deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
  }
  const service = new ProviderSwitchImplementationService(repository as unknown as GaepRepository, async () => product as never,
    async () => initiative as never, { readCurrent: async () => codex as never }, { readCurrent: async () => claude as never })
  return { repository, service, input, initiative, codex, claude }
}

describe("Provider Switch Implementation lifecycle", () => {
  it("persists immutable exact-bound continuity without transitioning either provider", async () => {
    const { repository, service, input, initiative, claude } = fixture()
    const created = await service.create(input, "implementation-author")
    const revised = await service.revise(created.id, 1, { ...input, title: "Reviewed provider switch candidate" }, "implementation-author")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created), direction: "codex-to-claude",
      lifecycle: { providerTransitionState: "not-performed", handoffState: "not-recorded", stageOwnershipState: "unchanged", sourceMutationState: "not-performed" } })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({ state: "candidate-defined", unitCount: 1, pathCount: 1,
      providerGapCount: 0, continuityGapCount: 0, handoffGapCount: 0 })
    const projection = await service.project(initiative.id)
    expect(projection.candidate).toMatchObject({ direction: "codex-to-claude", sourceProvider: { adapterId: "gaep.codex-cli" },
      targetProvider: { adapterId: "gaep.claude-code-cli" }, handoff: { state: "candidate-not-recorded" } })
    expect(JSON.stringify(projection)).not.toContain("implementation-author")
    expect(JSON.stringify(projection)).not.toContain("/workspace")
    expect(repository.audits.at(-1)?.payload).toMatchObject({ unitCount: 1, pathCount: 1, actionAuthorityState: "not-granted" })
    claude.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", staleBindingCount: 1 })
  })

  it("fails closed on forged direction, continuity, handoff, and secret-shaped metadata", async () => {
    const { service, input } = fixture()
    await expect(service.create({ ...input, direction: "claude-to-codex" }, "implementation-author")).rejects.toThrow(/direction/iu)
    await expect(service.create({ ...input, units: [{ ...input.units[0]!, continuityReceiptDigest: canonicalDigest({ forged: true }) }] }, "implementation-author")).rejects.toThrow(/continuity/iu)
    await expect(service.create({ ...input, handoff: { ...input.handoff, handoffReceiptDigest: canonicalDigest({ forged: true }) } }, "implementation-author")).rejects.toThrow(/handoff receipt/iu)
    expect(providerSwitchImplementationInputSchema.safeParse({ ...input, limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false)
  })
})
