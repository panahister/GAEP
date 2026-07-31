import { randomUUID } from "node:crypto"
import { basename, dirname, join } from "node:path"

import { canonicalDigest } from "@gaep/agent-sdk"
import { controlledClaudeImplementationInputSchema, type ControlledClaudeImplementationInput } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { ControlledClaudeImplementationService } from "./controlled-claude-implementation.js"
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
  const implementationUnitId = randomUUID(), previewUnitId = randomUUID(), previewPathId = randomUUID()
  const digest = canonicalDigest({ evidence: true })
  const evidence = { kind: "evidence" as const, sourceId: "controlled-claude-inspection", revision: 1, digest, evidenceState: "human-reviewed" as const }
  const previewPath = { id: previewPathId, ordinal: 1, changedPathCandidateId: randomUUID(), pathCandidate: "packages/example/src/index.ts",
    changeKind: "modify" as const, source: { state: "candidate-observed" as const, digest, bytes: 100 },
    target: { state: "candidate-generated" as const, digest, bytes: 120 }, diff: { state: "candidate-generated" as const,
      format: "unified-text-metadata" as const, patchDigest: digest, addedLineCount: 3, removedLineCount: 1, truncated: false },
    planOperations: ["replace", "verify"] as const, traceDigest: digest, evidenceReferences: [evidence], outcome: "candidate-previewed" as const }
  const previewUnit = { id: previewUnitId, ordinal: 1, changedUnitCandidateId: randomUUID(), implementationUnitId, implementationUnitKey: "unit-a",
    pathPreviews: [previewPath], dependencyUnitIds: [], directBlastRadiusUnitIds: [], indirectBlastRadiusUnitIds: [], evidenceReferences: [evidence], outcome: "candidate-previewed" as const }
  const preview = { id: randomUUID(), revision: 1, initiativeId: initiative.id, previewUnits: [previewUnit] }
  const proposedChangePreview = { recordId: preview.id, revision: preview.revision, digest: canonicalDigest(preview) }
  const stagingPath = { id: randomUUID(), ordinal: 1, proposedPathPreviewId: previewPathId, pathCandidate: previewPath.pathCandidate,
    changeKind: "modify" as const, previewPathDigest: canonicalDigest(previewPath), sourceEndpointDigest: canonicalDigest(previewPath.source),
    targetEndpointDigest: canonicalDigest(previewPath.target), diffMetadataDigest: canonicalDigest(previewPath.diff),
    planOperationsDigest: canonicalDigest(previewPath.planOperations), traceDigest: previewPath.traceDigest,
    inspectionState: "candidate-complete" as const, evidenceReferences: [evidence], outcome: "candidate-defined" as const }
  const stagingUnit = { id: randomUUID(), ordinal: 1, proposedPreviewUnitId: previewUnitId, implementationUnitId, implementationUnitKey: "unit-a",
    previewUnitDigest: canonicalDigest(previewUnit), pathCandidates: [stagingPath], evidenceReferences: [evidence], outcome: "candidate-defined" as const }
  const staging = { id: randomUUID(), revision: 1, initiativeId: initiative.id, units: [stagingUnit] }
  const stagingWorkspace = { recordId: staging.id, revision: staging.revision, digest: canonicalDigest(staging) }
  const selection = { schemaVersion: 2 as const, adapterId: "gaep.claude-code-cli", agentId: "claude-code-cli", modelId: "configured-claude-model",
    modelTruthClass: "configured" as const, modelAlias: null, settings: {}, selectedAt: "2026-07-31T10:00:00.000Z", capabilityDigest: canonicalDigest({ capabilities: "claude" }) }
  const provider = { adapterId: selection.adapterId, agentId: selection.agentId, modelId: selection.modelId, capabilityDigest: selection.capabilityDigest, runtimeVersion: "candidate-runtime" }
  const pathBase = { id: randomUUID(), ordinal: 1, proposedPreviewPathId: previewPathId, stagingPathId: stagingPath.id,
    pathCandidate: previewPath.pathCandidate, resourceScopeId: "scope-unit-a", toolCapabilities: [], expectedEffect: "observation-only" as const,
    previewPathDigest: canonicalDigest(previewPath), stagingPathDigest: canonicalDigest(stagingPath), evidenceReferences: [evidence], outcome: "candidate-defined" as const }
  const path = { ...pathBase, stagedEffectReceiptDigest: canonicalDigest({ proposedPreviewPathId: pathBase.proposedPreviewPathId, stagingPathId: pathBase.stagingPathId,
    pathCandidate: pathBase.pathCandidate, resourceScopeId: pathBase.resourceScopeId, toolCapabilities: pathBase.toolCapabilities,
    expectedEffect: pathBase.expectedEffect, previewPathDigest: pathBase.previewPathDigest, stagingPathDigest: pathBase.stagingPathDigest }) }
  const unitBase = { id: randomUUID(), ordinal: 1, proposedPreviewUnitId: previewUnitId, stagingUnitId: stagingUnit.id, implementationUnitId,
    implementationUnitKey: "unit-a", previewUnitDigest: canonicalDigest(previewUnit), stagingUnitDigest: canonicalDigest(stagingUnit), paths: [path], evidenceReferences: [evidence], outcome: "candidate-defined" as const }
  const unit = { ...unitBase, unitPlanReceiptDigest: canonicalDigest({ stagingUnitId: unitBase.stagingUnitId, previewUnitId: unitBase.proposedPreviewUnitId,
    paths: unitBase.paths.map((entry) => ({ id: entry.id, stagedEffectReceiptDigest: entry.stagedEffectReceiptDigest })) }) }
  const resourceScopes = [previewPath.pathCandidate]
  const permissions = [{ capability: "all-tools", mode: "deny" as const, scope: [] }]
  const runtimeBoundary = { mode: "claude-context-only" as const, supportedRuntimeState: "not-established" as const,
    authenticationState: "not-established" as const, effectivePolicyState: "not-established" as const,
    credentialAccessState: "not-attempted" as const, administratorPolicyBypassState: "not-attempted" as const,
    workspaceAccessState: "not-granted" as const, toolAccessState: "not-granted" as const,
    resumeCapabilityState: "not-established" as const }
  const planBase = { strategy: "managed-claude-context-only-candidate" as const, planKey: "controlled-claude-plan-1",
    workflowPlan: { recordId: randomUUID(), revision: 1, digest } }
  const planReceiptDigest = canonicalDigest({ ...planBase, provider, runtimeBoundary, proposedChangePreview, stagingWorkspace })
  const stagedEffectReceiptDigest = canonicalDigest({ resourceScopes, permissions, units: [{ id: unit.id, unitPlanReceiptDigest: unit.unitPlanReceiptDigest,
    paths: [{ id: path.id, stagedEffectReceiptDigest: path.stagedEffectReceiptDigest }] }] })
  const plan = { ...planBase, planReceiptDigest, stagedEffectReceiptDigest }
  const recoveryBase = { strategy: "write-ahead-journal-candidate" as const, journalKey: "controlled-claude-journal-1",
    checkpointDigest: canonicalDigest({ planReceiptDigest, stagedEffectReceiptDigest, proposedChangePreview, stagingWorkspace, resourceScopes }) }
  const recoveryJournal = { ...recoveryBase, recoveryReceiptDigest: canonicalDigest(recoveryBase) }
  const input: ControlledClaudeImplementationInput = {
    initiativeId: initiative.id, context: { productRevision: 1, productDigest: canonicalDigest(product), initiativeRevision: 1, initiativeDigest: canonicalDigest(initiative) },
    informationClassification: "internal", title: "Controlled Claude implementation candidate", proposedChangePreview, stagingWorkspace,
    selection, provider, runtimeBoundary, plan, permissions, resourceScopes, units: [unit],
    prerequisites: ["apply-authorization", "exact-preview-review", "exact-staging-review", "human-change-approval"].map((key) => ({
      key: key as "apply-authorization", state: "required-not-established" as const, evidenceReferences: [],
    })),
    lifecycle: { planningState: "candidate-defined", providerExecutionState: "not-performed", realStageCreationState: "not-performed",
      approvalState: "not-established", authorizationState: "not-established", sourceMutationState: "not-performed", applyState: "not-performed",
      discardState: "not-performed", cancellationState: "not-exercised", resumeState: "not-exercised", recoveryState: "not-exercised" },
    recoveryJournal, applyPreconditions: ["Exact human approval and apply authorization must be independently established"],
    discardPreconditions: ["Exact staged inventory must be reviewed before discard"], evidenceReferences: [evidence], unresolvedQuestions: [],
    limitations: ["The candidate does not call a provider or create a real stage"], reviewState: "ready-for-human-review",
    acceptanceDecisionState: "not-established", nativeHostAcceptanceState: "not-established", liveProviderAcceptanceState: "not-established",
    securityAcceptanceState: "not-established", releaseReadinessState: "not-established", deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
  }
  const service = new ControlledClaudeImplementationService(repository as unknown as GaepRepository, async () => product as never,
    async () => initiative as never, { readCurrent: async () => preview } as never, { readCurrent: async () => staging } as never,
    async () => ({ status: "selected", selection }))
  return { repository, service, input, initiative, preview, staging, selection }
}

describe("Controlled Claude Implementation lifecycle", () => {
  it("persists immutable exact-bound candidates while all authoritative actions remain unperformed", async () => {
    const { repository, service, input, initiative, preview } = fixture()
    const created = await service.create(input, "implementation-author")
    const revised = await service.revise(created.id, 1, { ...input, title: "Reviewed Controlled Claude candidate" }, "implementation-author")
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created), actionAuthorityState: "not-granted",
      lifecycle: { providerExecutionState: "not-performed", realStageCreationState: "not-performed", sourceMutationState: "not-performed", applyState: "not-performed" } })
    expect((await service.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect(await service.assess(initiative.id)).toMatchObject({ state: "candidate-defined", unitCount: 1, pathCount: 1, providerGapCount: 0, scopeGapCount: 0 })
    const projection = await service.project(initiative.id)
    expect(projection.candidate).toMatchObject({ provider: { adapterId: "gaep.claude-code-cli", agentId: "claude-code-cli" },
      runtimeBoundary: { mode: "claude-context-only", authenticationState: "not-established", effectivePolicyState: "not-established",
        credentialAccessState: "not-attempted", administratorPolicyBypassState: "not-attempted", toolAccessState: "not-granted" }, unitCount: 1, pathCount: 1 })
    expect(JSON.stringify(projection)).not.toContain("implementation-author")
    expect(JSON.stringify(projection)).not.toContain("/workspace")
    expect(repository.audits.at(-1)?.payload).toMatchObject({ unitCount: 1, pathCount: 1, actionAuthorityState: "not-granted" })
    preview.revision = 2
    expect(await service.assess(initiative.id)).toMatchObject({ state: "attention-required", staleBindingCount: 1 })
  })

  it("fails closed on forged scope, provider, receipts, and secret-shaped metadata", async () => {
    const { service, input } = fixture()
    await expect(service.create({ ...input, resourceScopes: ["packages/other.ts"] }, "implementation-author")).rejects.toThrow(/resource scopes/iu)
    await expect(service.create({ ...input, provider: { ...input.provider, adapterId: "gaep.codex-cli" } }, "implementation-author")).rejects.toThrow(/managed Claude/iu)
    await expect(service.create({ ...input, permissions: [{ capability: "all-tools", mode: "ask", scope: [] }] }, "implementation-author")).rejects.toThrow(/tool-free|deny all Tools/iu)
    await expect(service.create({ ...input, plan: { ...input.plan, planReceiptDigest: canonicalDigest({ forged: true }) } }, "implementation-author")).rejects.toThrow(/plan receipts/iu)
    expect(controlledClaudeImplementationInputSchema.safeParse({ ...input, limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false)
  })
})
