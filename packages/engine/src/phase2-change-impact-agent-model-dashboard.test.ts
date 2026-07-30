import { canonicalDigest } from "@gaep/agent-sdk"
import {
  agentModelDashboardContentSchema,
  agentModelDashboardSchema,
  type AgentModelDashboard,
  type Initiative,
  type Phase2ChangeImpactAgentModelDashboardRequest,
  type Product,
} from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { composePhase2ChangeImpactAgentModelDashboard, Phase2ChangeImpactAgentModelBindingError } from "./phase2-change-impact-agent-model-dashboard.js"
import { composePhase2UxFigmaDashboard } from "./phase2-ux-figma-dashboard.js"

const product: Product = {
  schemaVersion: 1, id: "00000000-0000-4000-8000-000000000001", kind: "product", revision: 2,
  name: "Integrated Phase 2 dashboard fixture", summary: "Exact derived Phase 2 views",
  problem: "Change, impact, and execution truth are fragmented.", affectedUsers: "Product and delivery teams",
  desiredOutcome: "Expose bounded integrated evidence without granting authority.",
  successSignals: ["Exact source digests remain bound"], firstWorkflow: "Inspect Phase 2 integrated views.",
  exclusions: ["Automatic effects"], profile: "internal-tool", lifecycleState: "active",
  createdAt: "2026-07-30T04:10:00.000Z", updatedAt: "2026-07-30T04:10:00.000Z",
}

const initiative: Initiative = {
  schemaVersion: 1, id: "00000000-0000-4000-8000-000000000002", kind: "initiative", revision: 3,
  productId: product.id, title: "Integrated Phase 2 views", outcome: "Inspect bounded evidence.",
  scope: ["Derived read-only dashboard"], exclusions: ["Selection, launch, approval, effects"], state: "active",
  createdAt: "2026-07-30T04:10:00.000Z", updatedAt: "2026-07-30T04:10:00.000Z",
}

function agentModel(): AgentModelDashboard {
  const observedAt = "2026-07-30T04:19:00.000Z"
  const content = agentModelDashboardContentSchema.parse({
    schemaVersion: 1,
    kind: "agent-model-dashboard",
    product: { recordType: "product", recordId: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
    capabilities: [{
      adapterId: "gaep.codex-cli", adapterVersion: "1.0.0", agentId: "codex-cli", agentLabel: "Codex CLI",
      runtimeVersion: null, capabilityDigest: canonicalDigest("capability"), detected: true,
      executionInterface: "cli-jsonl", interfaceMaturity: "stable",
      support: { resume: true, cancel: true, checkpoints: true, modelDiscovery: false, toolSelection: true },
      modelCount: 0, limitations: { values: ["Provider quality is not assessed."], shown: 1, total: 1, omitted: 0 },
      observedAt, selected: false,
    }],
    selection: { status: "unselected" },
    runs: [], handoffs: [],
    providerMetrics: {
      usage: { state: "unavailable", basis: "current-managed-records-have-no-provider-usage-or-cost-contract" },
      cost: { state: "unavailable", basis: "current-managed-records-have-no-provider-usage-or-cost-contract" },
    },
    freshness: {
      state: "current", selectionCapabilityState: "unselected", oldestCapabilityObservedAt: observedAt,
      newestCapabilityObservedAt: observedAt, truncated: false,
      coverageBoundary: "bounded-current-records-do-not-prove-provider-account-or-native-host-readiness",
    },
    evidenceCues: { freshness: "current", confidence: { state: "not-assessed", basis: "no-governed-confidence-evaluation-is-bound" } },
    limits: {
      capabilities: { shown: 1, total: 1, omitted: 0 }, runs: { shown: 0, total: 0, omitted: 0 },
      handoffs: { shown: 0, total: 0, omitted: 0 }, managedRuns: { shown: 0, total: 0, omitted: 0 }, truncated: false,
    },
    observedAt,
    sourceBoundary: "current-governed-agent-selection-run-handoff-and-managed-evidence-metadata",
    limitations: ["This fixture has no provider execution."],
    authorityBoundary: "agent-model-dashboard-does-not-select-switch-handoff-launch-or-authorize-effects",
  })
  return agentModelDashboardSchema.parse({ ...content, snapshotDigest: canonicalDigest(content) })
}

function sourceSet() {
  const phase2 = composePhase2UxFigmaDashboard(product, initiative, [], {
    expectedProductId: product.id, expectedProductRevision: product.revision ?? 1, expectedProductDigest: canonicalDigest(product),
    expectedInitiativeId: initiative.id, expectedInitiativeRevision: initiative.revision ?? 1, expectedInitiativeDigest: canonicalDigest(initiative),
  }, "2026-07-30T04:20:00.000Z")
  const agents = agentModel()
  const request: Phase2ChangeImpactAgentModelDashboardRequest = {
    expectedProductId: product.id, expectedProductRevision: product.revision ?? 1, expectedProductDigest: canonicalDigest(product),
    expectedInitiativeId: initiative.id, expectedInitiativeRevision: initiative.revision ?? 1, expectedInitiativeDigest: canonicalDigest(initiative),
    agentModel: {
      expectedProductId: product.id, expectedProductRevision: product.revision ?? 1, expectedProductDigest: canonicalDigest(product),
      expectedSelection: { status: "unselected" },
      expectedCapabilities: [{
        adapterId: "gaep.codex-cli", agentId: "codex-cli", capabilityDigest: canonicalDigest("capability"),
      }],
    },
  }
  return { phase2, agents, request }
}

describe("Phase 2 Change, Impact, Agent and Model dashboard composition", () => {
  it("derives three bounded panels without selecting, launching, approving, or applying effects", () => {
    const { phase2, agents, request } = sourceSet()
    const dashboard = composePhase2ChangeImpactAgentModelDashboard(
      product, initiative, phase2, agents, request, "2026-07-30T04:21:00.000Z",
    )
    expect(dashboard.synchronizationChange).toMatchObject({ state: "attention-required", synchronizationEffectState: "not-applied" })
    expect(dashboard.impact).toMatchObject({ state: "current-bounded-observation", coverage: "bounded-not-complete" })
    expect(dashboard.agentModel.capabilities).toMatchObject({ shown: 1, detected: 1, selected: 0 })
    expect(dashboard.governance).toMatchObject({ automaticSelectionAuthority: "not-granted", runLaunchAuthority: "not-granted" })
    const { snapshotDigest, ...content } = dashboard
    expect(snapshotDigest).toBe(canonicalDigest(content))
  })

  it("rejects stale source requests and rebound Initiative context", () => {
    const { phase2, agents, request } = sourceSet()
    const hostile = { ...agents, snapshotDigest: canonicalDigest("stale") }
    expect(() => composePhase2ChangeImpactAgentModelDashboard(product, initiative, phase2, hostile, request))
      .toThrow(Phase2ChangeImpactAgentModelBindingError)
    expect(() => composePhase2ChangeImpactAgentModelDashboard(product, { ...initiative, revision: 4 }, phase2, agents, request))
      .toThrow(Phase2ChangeImpactAgentModelBindingError)
  })

  it("is deterministic for exact inputs and observation time", () => {
    const { phase2, agents, request } = sourceSet()
    const first = composePhase2ChangeImpactAgentModelDashboard(product, initiative, phase2, agents, request, "2026-07-30T04:21:00.000Z")
    const second = composePhase2ChangeImpactAgentModelDashboard(product, initiative, phase2, agents, request, "2026-07-30T04:21:00.000Z")
    expect(second).toEqual(first)
  })
})
