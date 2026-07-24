import { canonicalDigest, capabilityDigest } from "@gaep/agent-sdk"
import {
  adapterCapabilitiesSchema,
  agentModelDashboardContentSchema,
  agentSelectionSchema,
  handoffSchema,
  managedRunEvidenceSchema,
  managedRunRecordSchema,
  managedRunResultSchema,
  productSchema,
  runSchema,
  type AdapterCapabilities,
  type AgentModelDashboardRequest,
} from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import {
  AgentModelCapabilityBindingError,
  AgentModelProductBindingError,
  AgentModelSelectionBindingError,
  composeAgentModelDashboard,
  type AgentModelDashboardSources,
} from "./agent-model-dashboard.js"

const id = (tail: number): string => `00000000-0000-4000-8000-${tail.toString().padStart(12, "0")}`
const digest = `sha256:${"a".repeat(64)}`
const observedAt = "2026-07-24T03:00:02.000Z"

const product = productSchema.parse({
  schemaVersion: 1,
  kind: "product",
  id: id(1),
  revision: 1,
  name: "Agent dashboard fixture",
  summary: "A bounded Agent/Model dashboard fixture.",
  problem: "Provider truth and governed execution evidence need one exact projection.",
  affectedUsers: "GAEP operators",
  desiredOutcome: "Selection, switching, and Run evidence remain inspectable without granting authority.",
  successSignals: ["The snapshot binds current capability and selection truth"],
  firstWorkflow: "Inspect the current Agent and Model state.",
  exclusions: ["Provider account readiness inference"],
  profile: "software",
  lifecycleState: "active",
  createdAt: "2026-07-24T03:00:00.000Z",
  updatedAt: "2026-07-24T03:00:00.000Z",
})

function capability(adapterId: string, agentId: string, detected = true): AdapterCapabilities {
  return adapterCapabilitiesSchema.parse({
    schemaVersion: 1,
    adapterId,
    adapterVersion: "1.0.0",
    agentId,
    agentLabel: agentId === "manual" ? "Manual" : "Claude Code",
    runtimeVersion: detected ? "1.0.0" : undefined,
    detected,
    executionInterface: detected ? "managed-in-process" : "unavailable",
    interfaceMaturity: detected ? "stable" : "unknown",
    supportsResume: detected,
    supportsCancel: detected,
    supportsCheckpoints: detected,
    supportsModelDiscovery: detected,
    supportsToolSelection: false,
    settings: [],
    models: detected ? [{
      id: `${agentId}-model`,
      label: `${agentId} model`,
      reasoningOptions: [],
      inputModalities: ["text"],
      truthClass: "observed",
      alias: false,
    }] : [],
    limitations: detected ? ["Offline fixture capability only."] : ["Runtime is not detected."],
    observedAt: "2026-07-24T03:00:01.000Z",
  })
}

const manualCapabilities = capability("gaep.manual", "manual")
const claudeCapabilities = capability("gaep.claude-code", "claude", false)
const selection = agentSelectionSchema.parse({
  schemaVersion: 2,
  adapterId: manualCapabilities.adapterId,
  agentId: manualCapabilities.agentId,
  modelId: "manual-model",
  modelTruthClass: "observed",
  modelAlias: false,
  settings: { script: "success" },
  selectedAt: "2026-07-24T03:00:01.000Z",
  capabilityDigest: capabilityDigest(manualCapabilities),
})
const run = runSchema.parse({
  schemaVersion: 1,
  id: id(4),
  revision: 1,
  charterId: id(3),
  productId: product.id,
  initiativeId: id(2),
  agent: selection,
  state: "completed",
  startedAt: "2026-07-24T03:00:01.000Z",
  endedAt: "2026-07-24T03:00:02.000Z",
})
const initiativeSnapshot = {
  schemaVersion: 1 as const,
  id: id(2),
  kind: "initiative" as const,
  revision: 1,
  productId: product.id,
  title: "Agent dashboard fixture",
  outcome: "Project exact current execution truth",
  scope: ["Agent and model dashboard"],
  exclusions: [],
  state: "active" as const,
  createdAt: "2026-07-24T03:00:00.000Z",
  updatedAt: "2026-07-24T03:00:00.000Z",
}
const managedBindings = {
  product: { recordType: "product" as const, recordId: product.id, revision: 1, digest: canonicalDigest(product) },
  initiative: { recordType: "initiative" as const, recordId: id(2), revision: 1, digest: canonicalDigest(initiativeSnapshot) },
  charter: { recordType: "execution-charter" as const, recordId: id(3), revision: 1, digest },
  run: { recordType: "run" as const, recordId: run.id, revision: 1, digest: canonicalDigest(run) },
  agentSelectionDigest: canonicalDigest(selection),
  contextPacks: [],
  workflowPlan: { recordType: "workflow-plan" as const, recordId: id(9), revision: 1, digest },
  tools: [],
}

const gate = (phase: "charter-evidence" | "charter-stop-conditions") => ({
  phase,
  interpretation: phase === "charter-stop-conditions" ? "stop-boundary-complied" : "criteria-satisfied",
  criteriaDigest: digest,
  status: "not-assessed",
  basis: "not-evaluated",
  actor: { kind: "system", id: "agent-model-fixture" },
  evaluator: { kind: "system", id: "agent-model-fixture", version: "1", digest },
  assessedAt: "2026-07-24T03:00:02.000Z",
})

const evidence = managedRunEvidenceSchema.parse({
  schemaVersion: 2,
  kind: "managed-run-evidence",
  id: id(6),
  managedRunId: id(5),
  runId: run.id,
  productId: product.id,
  bindingsDigest: canonicalDigest(managedBindings),
  events: [],
  eventsDigest: canonicalDigest([]),
  workflow: {
    plan: { recordType: "workflow-plan", recordId: id(9), revision: 1, digest },
    strategy: "sequential",
    orderedStepIds: [id(10)],
    attempts: [],
    completedStepIds: [],
    charterGates: {
      requiredEvidence: gate("charter-evidence"),
      stopConditions: gate("charter-stop-conditions"),
    },
    terminalReasonCode: "agent-model-fixture",
    capabilityBoundary: "natural-language-gates-require-explicit-human-or-system-assessment",
  },
  actualEffects: [],
  capturedAt: "2026-07-24T03:00:02.000Z",
  authorityBoundary: "evidence-does-not-self-assert-outcome-or-authorization",
})
const result = managedRunResultSchema.parse({
  schemaVersion: 1,
  kind: "managed-run-result",
  id: id(7),
  managedRunId: id(5),
  runId: run.id,
  productId: product.id,
  mode: "manual-offline",
  provider: {
    adapterId: manualCapabilities.adapterId,
    agentId: manualCapabilities.agentId,
    modelId: selection.modelId,
    capabilityDigest: selection.capabilityDigest,
    runtimeVersion: "1.0.0",
  },
  providerDisposition: "completed",
  terminationCause: "normal",
  outcome: { status: "satisfied", basis: "deterministic-offline-runtime" },
  terminalState: "completed",
  evidenceId: evidence.id,
  evidenceDigest: canonicalDigest(evidence),
  warnings: [],
  startedAt: "2026-07-24T03:00:01.000Z",
  endedAt: "2026-07-24T03:00:02.000Z",
  authorityBoundary: "provider-completion-does-not-equal-outcome-completion",
})
const managedRecord = managedRunRecordSchema.parse({
  schemaVersion: 2,
  kind: "managed-run",
  id: id(5),
  revision: 1,
  runId: run.id,
  productId: product.id,
  initiativeId: run.initiativeId,
  mode: "manual-offline",
  state: "completed",
  bindings: managedBindings,
  bindingsDigest: canonicalDigest(managedBindings),
  bindingSnapshots: {
    initiative: initiativeSnapshot,
    run,
  },
  provider: result.provider,
  rootManagedRunId: id(5),
  attemptNumber: 1,
  resultId: result.id,
  resultDigest: canonicalDigest(result),
  recovery: { status: "not-required" },
  createdAt: "2026-07-24T03:00:01.000Z",
  startedAt: "2026-07-24T03:00:01.000Z",
  updatedAt: "2026-07-24T03:00:02.000Z",
  endedAt: "2026-07-24T03:00:02.000Z",
})
const handoff = handoffSchema.parse({
  schemaVersion: 1,
  id: id(8),
  productId: product.id,
  initiativeId: run.initiativeId,
  fromRunId: run.id,
  toAgent: {
    ...selection,
    adapterId: claudeCapabilities.adapterId,
    agentId: claudeCapabilities.agentId,
    modelId: "claude-model",
    selectedAt: "2026-07-24T03:00:02.000Z",
    capabilityDigest: capabilityDigest(claudeCapabilities),
  },
  reason: "Exercise one exact provider switch projection.",
  workspaceBaseline: { dirty: false, changedFiles: [], truthClass: "observed" },
  completedWork: [],
  unresolvedMatters: [],
  decisions: [],
  evidence: [],
  capabilityDifferences: ["Agent adapter changes."],
  createdAt: "2026-07-24T03:00:02.000Z",
})

function requestFor(
  capabilities = [manualCapabilities, claudeCapabilities],
  selectionDigest = canonicalDigest(selection),
): AgentModelDashboardRequest {
  return {
    expectedProductId: product.id,
    expectedProductRevision: product.revision ?? 1,
    expectedProductDigest: canonicalDigest(product),
    expectedSelection: { status: "selected", selectionDigest },
    expectedCapabilities: capabilities.map((entry) => ({
      adapterId: entry.adapterId,
      agentId: entry.agentId,
      capabilityDigest: capabilityDigest(entry),
    })),
  }
}

function sources(capabilities = [manualCapabilities, claudeCapabilities]): AgentModelDashboardSources {
  return {
    product,
    capabilities,
    selection: { status: "selected", selection },
    runs: [run],
    handoffs: [handoff],
    managedRuns: [{ record: managedRecord, result, evidence }],
    managedRunTotal: 1,
  }
}

describe("Agent/Model dashboard composition", () => {
  it("projects exact capabilities, selection, switch history, and verified managed evidence", () => {
    const dashboard = composeAgentModelDashboard(sources(), requestFor(), observedAt)
    expect(dashboard.capabilities).toHaveLength(2)
    expect(dashboard.capabilities.find((entry) => entry.selected)).toMatchObject({
      adapterId: manualCapabilities.adapterId,
      capabilityDigest: selection.capabilityDigest,
    })
    expect(dashboard.selection).toMatchObject({ status: "selected", capabilityState: "current", settings: { script: "success" } })
    expect(dashboard.runs).toEqual([expect.objectContaining({
      record: expect.objectContaining({ recordId: run.id }),
      managed: expect.objectContaining({
        status: "observed",
        result: expect.objectContaining({
          status: "bound",
          outcomeStatus: "satisfied",
          evidence: expect.objectContaining({ eventCount: 0 }),
        }),
      }),
    })])
    expect(dashboard.handoffs).toEqual([expect.objectContaining({
      fromRun: expect.objectContaining({ recordId: run.id }),
      state: "pending-acknowledgement",
    })])
    expect(dashboard.providerMetrics).toEqual({
      usage: { state: "unavailable", basis: "current-managed-records-have-no-provider-usage-or-cost-contract" },
      cost: { state: "unavailable", basis: "current-managed-records-have-no-provider-usage-or-cost-contract" },
    })
    expect(dashboard.freshness).toMatchObject({ state: "current", selectionCapabilityState: "current", truncated: false })
    const { snapshotDigest, ...content } = dashboard
    expect(snapshotDigest).toBe(canonicalDigest(content))
    expect(JSON.stringify(dashboard)).not.toContain(product.name)
    expect(JSON.stringify(dashboard)).not.toContain(handoff.reason)
  })

  it("marks a selected capability digest stale without inventing provider readiness", () => {
    const revisedManual = adapterCapabilitiesSchema.parse({ ...manualCapabilities, runtimeVersion: "1.0.1" })
    const dashboard = composeAgentModelDashboard(
      sources([revisedManual, claudeCapabilities]),
      requestFor([revisedManual, claudeCapabilities]),
      observedAt,
    )
    expect(dashboard.selection).toMatchObject({ status: "selected", capabilityState: "stale" })
    expect(dashboard.freshness).toMatchObject({ state: "attention-required", selectionCapabilityState: "stale" })
    expect(dashboard.providerMetrics.cost.state).toBe("unavailable")
  })

  it("keeps unselected state current while migration and invalid state require attention", () => {
    const unselected = composeAgentModelDashboard(
      { ...sources(), selection: { status: "unselected" } },
      { ...requestFor(), expectedSelection: { status: "unselected" } },
      observedAt,
    )
    expect(unselected.selection).toEqual({ status: "unselected" })
    expect(unselected.capabilities.every((entry) => !entry.selected)).toBe(true)
    expect(unselected.freshness).toMatchObject({ state: "current", selectionCapabilityState: "unselected" })

    const migration = composeAgentModelDashboard(
      { ...sources(), selection: { status: "migration-required", portableCandidate: selection } },
      {
        ...requestFor(),
        expectedSelection: { status: "migration-required", selectionDigest: canonicalDigest(selection) },
      },
      observedAt,
    )
    expect(migration.selection).toMatchObject({ status: "migration-required", capabilityState: "migration-required" })
    expect(migration.capabilities.every((entry) => !entry.selected)).toBe(true)
    expect(migration.freshness).toMatchObject({ state: "attention-required", selectionCapabilityState: "migration-required" })

    const invalid = composeAgentModelDashboard(
      { ...sources(), selection: { status: "invalid" } },
      { ...requestFor(), expectedSelection: { status: "invalid" } },
      observedAt,
    )
    expect(invalid.selection).toEqual({ status: "invalid" })
    expect(invalid.freshness).toMatchObject({ state: "attention-required", selectionCapabilityState: "invalid" })
  })

  it("rejects stale Product, capability, and selection request bindings", () => {
    expect(() => composeAgentModelDashboard(sources(), {
      ...requestFor(), expectedProductDigest: digest,
    }, observedAt)).toThrow(AgentModelProductBindingError)
    expect(() => composeAgentModelDashboard(sources(), {
      ...requestFor(),
      expectedCapabilities: requestFor().expectedCapabilities.map((entry, index) =>
        index === 0 ? { ...entry, capabilityDigest: digest } : entry),
    }, observedAt)).toThrow(AgentModelCapabilityBindingError)
    expect(() => composeAgentModelDashboard(sources(), requestFor(undefined, digest), observedAt))
      .toThrow(AgentModelSelectionBindingError)
  })

  it("rejects incomplete managed evidence and caller-supplied authority", () => {
    expect(() => composeAgentModelDashboard({
      ...sources(), managedRuns: [{ record: managedRecord, result }],
    }, requestFor(), observedAt)).toThrow(/result and evidence bindings are incomplete or stale/)
    expect(() => composeAgentModelDashboard(sources(), {
      ...requestFor(), authorizeLaunch: true,
    } as AgentModelDashboardRequest, observedAt)).toThrow()
  })

  it("rejects forged usage, freshness, and reconciled-count claims", () => {
    const dashboard = composeAgentModelDashboard(sources(), requestFor(), observedAt)
    const { snapshotDigest: _snapshotDigest, ...content } = dashboard
    expect(() => agentModelDashboardContentSchema.parse({
      ...content,
      providerMetrics: { ...content.providerMetrics, cost: { state: "available", amount: 1 } },
    })).toThrow()
    expect(() => agentModelDashboardContentSchema.parse({
      ...content,
      freshness: { ...content.freshness, state: "attention-required" },
    })).toThrow()
    expect(() => agentModelDashboardContentSchema.parse({
      ...content,
      limits: { ...content.limits, runs: { ...content.limits.runs, total: 2 } },
    })).toThrow()
  })
})
