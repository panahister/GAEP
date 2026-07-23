import {
  productStudioSectionIds,
  type AdapterCapabilities,
  type AgentSelection,
  type Initiative,
  type Product,
  type ProductDesignDraft,
  type Run,
} from "@gaep/contracts"
import type { ProductStudioService } from "@gaep/engine"
import { describe, expect, it, vi } from "vitest"

import {
  CurrentEngineStudioDataSource,
  type CurrentEngineStudioContext,
  type ExistingStudioCommand,
} from "./current-engine-studio-data-source.js"
import { isStudioSnapshot, studioRoutes } from "./studio-protocol.js"

const workspacePath = "/machine-only/example-product"
const product: Product = {
  schemaVersion: 1,
  id: "11111111-1111-4111-8111-111111111111",
  kind: "product",
  revision: 3,
  name: "Example Product",
  summary: "A bounded example Product.",
  problem: "Teams need a governed way to create product context.",
  affectedUsers: "Product and engineering teams",
  desiredOutcome: "Teams can inspect truthful local Product state.",
  successSignals: ["A valid local snapshot exists"],
  firstWorkflow: "Open Product Studio and inspect the overview.",
  exclusions: ["No external deployment"],
  profile: "software",
  lifecycleState: "active",
  createdAt: "2026-07-21T00:00:00.000Z",
  updatedAt: "2026-07-21T00:00:00.000Z",
}

const initiative: Initiative = {
  schemaVersion: 1,
  id: "22222222-2222-4222-8222-222222222222",
  kind: "initiative",
  revision: 1,
  productId: product.id,
  title: "Inspect current truth",
  outcome: "Product Studio exposes only observed engine truth.",
  scope: ["VS Code extension"],
  exclusions: ["Cross-host implementation"],
  state: "active",
  createdAt: "2026-07-21T00:00:00.000Z",
  updatedAt: "2026-07-21T00:00:00.000Z",
}

const selection: AgentSelection = {
  schemaVersion: 2,
  adapterId: "gaep.codex-cli",
  agentId: "codex-cli",
  modelId: "gpt-test",
  modelTruthClass: "provider-declared",
  modelAlias: false,
  settings: { sandbox: "read-only", approvalPolicy: "fail-closed-noninteractive", secretSetting: "must-redact" },
  selectedAt: "2026-07-21T00:00:00.000Z",
  capabilityDigest: `sha256:${"a".repeat(64)}`,
}

const manualSelection: AgentSelection = {
  ...selection,
  adapterId: "gaep.manual",
  agentId: "manual",
  modelId: "manual-deterministic-v1",
  modelTruthClass: "configured",
  modelAlias: false,
  settings: { script: "success" },
  capabilityDigest: `sha256:${"d".repeat(64)}`,
}

const claudeSelection: AgentSelection = {
  ...selection,
  adapterId: "gaep.claude-code-cli",
  agentId: "claude-code-cli",
  modelId: "sonnet",
  modelTruthClass: "provider-declared",
  modelAlias: true,
  settings: { effort: "high", maxBudgetUsd: 10 },
  capabilityDigest: `sha256:${"e".repeat(64)}`,
}

function executableBinding(selected: AgentSelection, executable: string): Record<string, unknown> {
  return {
    schemaVersion: 2,
    scope: "machine-local",
    kind: "executable",
    adapterId: selected.adapterId,
    agentId: selected.agentId,
    capabilityDigest: selected.capabilityDigest,
    executable: {
      requested: executable,
      canonicalPath: `/opt/local/bin/${executable}`,
      digest: `sha256:${"b".repeat(64)}`,
      size: 42,
      modifiedAtMs: 1,
    },
    observedAt: "2026-07-21T00:00:00.000Z",
  }
}

function managedBinding(selected: AgentSelection, runtimeId: string): Record<string, unknown> {
  return {
    schemaVersion: 2,
    scope: "machine-local",
    kind: "managed-in-process",
    adapterId: selected.adapterId,
    agentId: selected.agentId,
    capabilityDigest: selected.capabilityDigest,
    runtimeId,
    observedAt: "2026-07-21T00:00:00.000Z",
  }
}

const run: Run = {
  schemaVersion: 1,
  id: "33333333-3333-4333-8333-333333333333",
  revision: 1,
  charterId: "44444444-4444-4444-8444-444444444444",
  productId: product.id,
  initiativeId: initiative.id,
  agent: selection,
  state: "completed",
  startedAt: "2026-07-21T00:00:00.000Z",
  endedAt: "2026-07-21T00:01:00.000Z",
}

const designDraft: ProductDesignDraft = {
  schemaVersion: 1,
  kind: "product-design-draft",
  id: "55555555-5555-4555-8555-555555555555",
  productId: product.id,
  revision: 2,
  baseProductRevision: product.revision ?? 1,
  sections: Object.fromEntries(productStudioSectionIds.map((sectionId) => [sectionId, {
    sectionId,
    summary: `${sectionId} summary`,
    fields: [{
      key: `${sectionId.replaceAll("-", ".")}.truth`,
      question: `What is the governed ${sectionId} truth?`,
      value: `${sectionId} truth`,
      state: "complete" as const,
      provenance: ["human:local-actor-test"],
    }],
    gaps: [],
    conflicts: [],
    updatedAt: "2026-07-21T00:00:00.000Z",
  }])) as unknown as ProductDesignDraft["sections"],
  createdAt: "2026-07-21T00:00:00.000Z",
  updatedAt: "2026-07-21T00:00:00.000Z",
}

function productStudioStub(): ProductStudioService {
  const readiness = {
    schemaVersion: 1 as const,
    productId: product.id,
    draftId: designDraft.id,
    draftRevision: designDraft.revision,
    status: "ready" as const,
    sections: productStudioSectionIds.map((sectionId) => ({
      sectionId,
      state: "complete" as const,
      missingFields: [],
      weakFields: [],
      deferredFields: [],
      openConflictIds: [],
      blockerGapIds: [],
    })),
    blockingGapIds: [],
    openConflictIds: [],
    deferredFieldCount: 0,
    evaluatedAt: "2026-07-21T00:00:00.000Z",
    claimBoundary: "design-readiness-is-not-implementation-approval" as const,
  }
  return {
    readDesignDraft: async () => designDraft,
    evaluateDesignReadiness: () => readiness,
    listDesignRevisions: async () => [],
    listProductRevisions: async () => [],
    listChanges: async () => [],
    listWorkItems: async () => [],
    listRequirements: async () => [],
    listDecisions: async () => [],
    listRisks: async () => [],
    listArchitectureRecords: async () => [],
    listEvidence: async () => [],
    listContextPacks: async () => [],
    listWorkflowPlans: async () => [],
    listToolDefinitions: async () => [],
    listRunToolSelections: async () => [],
    listTraceLinks: async () => [],
    listInstructionPrivilegeGrants: async () => [],
    listDomainPage: async (_kind: string, input: { offset?: number; limit?: number } = {}) => ({
      items: [],
      offset: input.offset ?? 0,
      limit: input.limit ?? 50,
      total: 0,
      hasMore: false,
    }),
    healthIssues: async () => [],
  } as unknown as ProductStudioService
}

function capability(overrides: Partial<AdapterCapabilities>): AdapterCapabilities {
  return {
    schemaVersion: 1,
    adapterId: "gaep.codex-cli",
    adapterVersion: "0.1.0",
    agentId: "codex-cli",
    agentLabel: "Codex",
    runtimeVersion: "1.0.0",
    detected: true,
    executionInterface: "stdio-rpc",
    interfaceMaturity: "stable",
    supportsResume: false,
    supportsCancel: true,
    supportsCheckpoints: false,
    supportsModelDiscovery: true,
    supportsToolSelection: false,
    settings: [{
      key: "secretSetting",
      label: "Secret",
      description: "A sensitive test value",
      kind: "string",
      required: false,
      sensitive: true,
      truthClass: "configured",
    }],
    models: [{ id: "gpt-test", label: "Test model", reasoningOptions: [], inputModalities: ["text"], truthClass: "provider-declared", alias: false }],
    limitations: [],
    observedAt: "2026-07-21T00:00:00.000Z",
    ...overrides,
  }
}

interface HarnessOptions {
  trusted?: boolean
  withWorkspace?: boolean
  withProduct?: boolean
  selection?: AgentSelection | null
  selectionError?: Error
  initiatives?: Initiative[]
  runs?: Run[]
  audit?: { valid: boolean; events: number; error?: string }
  runtimeBindings?: Record<string, unknown>
  rotateContextDuringObservation?: boolean
  productStudio?: ProductStudioService
  commandResult?: unknown
}

function harness(options: HarnessOptions = {}) {
  const commands: Array<{ command: ExistingStudioCommand; args: unknown[] }> = []
  const diagnostics: string[] = []
  const hasProduct = options.withProduct ?? true
  let contextGeneration = "context_generation_1234567890"
  let contextRotatedDuringObservation = false
  const selectedAgent = options.selection === undefined ? selection : options.selection
  const engine = {
    readProduct: async () => {
      if (!hasProduct) throw Object.assign(new Error("missing"), { code: "ENOENT" })
      return product
    },
    readSelection: async () => {
      if (options.selectionError) throw options.selectionError
      if (!selectedAgent) throw new Error("missing selection")
      return selectedAgent
    },
    listRuns: async () => options.runs ?? [run],
    repository: { verifyAudit: async () => options.audit ?? ({ valid: true, events: 8 }) },
    productStudio: options.productStudio ?? productStudioStub(),
  }
  const context: CurrentEngineStudioContext = {
    contextGeneration: () => contextGeneration,
    trusted: () => options.trusted ?? true,
    workspace: () => options.withWorkspace === false ? undefined : ({ name: "Example Product", path: workspacePath }),
    engine: () => engine,
    recoveryDiagnostic: () => undefined,
    hasGaepState: async () => hasProduct,
    listInitiatives: async () => {
      if (options.rotateContextDuringObservation && !contextRotatedDuringObservation) {
        contextGeneration = "context_generation_0987654321"
        contextRotatedDuringObservation = true
      }
      return options.initiatives ?? [initiative]
    },
    probeAgents: async () => [
      capability({
        adapterId: "gaep.manual",
        agentId: "manual",
        agentLabel: "Deterministic Manual Agent",
        runtimeVersion: "1",
        executionInterface: "managed-in-process",
        supportsResume: true,
        supportsCheckpoints: true,
        models: [{ id: "manual-deterministic-v1", label: "Deterministic Manual v1", reasoningOptions: [], inputModalities: ["text"], truthClass: "configured", alias: false }],
      }),
      capability({}),
      capability({
        adapterId: "gaep.claude-code-cli",
        agentId: "claude-code-cli",
        agentLabel: "Claude Code",
        executionInterface: "cli-stream-json",
        supportsResume: false,
        supportsToolSelection: false,
        models: [{ id: "sonnet", label: "Sonnet alias", reasoningOptions: ["low", "medium", "high"], inputModalities: ["text"], truthClass: "provider-declared", alias: true }],
      }),
    ],
    runtimeBindings: () => options.runtimeBindings ?? ({
      [`${workspacePath}\u0000gaep.codex-cli`]: {
        schemaVersion: 2,
        scope: "machine-local",
        kind: "executable",
        adapterId: "gaep.codex-cli",
        agentId: "codex-cli",
        capabilityDigest: selection.capabilityDigest,
        executable: {
          requested: "codex",
          canonicalPath: "/opt/local/bin/codex",
          digest: `sha256:${"b".repeat(64)}`,
          size: 42,
          modifiedAtMs: 1,
        },
        observedAt: "2026-07-21T00:00:00.000Z",
      },
    }),
    actorId: () => "local-actor-test",
    executeCommand: (expectedContextGeneration, command, ...args) => {
      if (expectedContextGeneration !== contextGeneration) throw new Error("stale context")
      commands.push({ command, args })
      return Promise.resolve(options.commandResult)
    },
    logDiagnostic: (message) => diagnostics.push(message),
  }
  return {
    source: new CurrentEngineStudioDataSource(context),
    commands,
    diagnostics,
    setContextGeneration: (value: string) => { contextGeneration = value },
  }
}

describe("current-engine Product Studio data source", () => {
  it("produces protocol-valid honest snapshots for every approved route", async () => {
    const { source } = harness()
    for (const route of studioRoutes) {
      const snapshot = await source.readSnapshot(route)
      expect(isStudioSnapshot(snapshot), route).toBe(true)
    }
    const architecture = await source.readSnapshot("architecture")
    expect(architecture.surface.kind).toBe("ready")
    expect(architecture.page.design?.sectionId).toBe("architecture")
    const readiness = await source.readSnapshot("readiness")
    expect(readiness.page.kind).toBe("readiness")
    expect(readiness.page.kind === "readiness" && readiness.page.statement).toMatch(/Design readiness is ready/i)
    const agents = await source.readSnapshot("agents-tools")
    expect(agents.surface.knownEffects).toEqual(expect.arrayContaining([
      expect.stringMatching(/probes configured adapters/i),
    ]))
  })

  it("keeps executable paths out of portable tables and limits them to the machine-local inspector", async () => {
    const { source } = harness()
    const snapshot = await source.readSnapshot("agents-tools")
    expect(snapshot.page.kind).toBe("agents-tools")
    if (snapshot.page.kind !== "agents-tools") return
    const portableSnapshot = { ...snapshot, inspector: undefined }
    expect(JSON.stringify(portableSnapshot)).not.toContain("/opt/local/bin")
    expect(JSON.stringify(snapshot.page.adapters)).not.toContain(`sha256:${"b".repeat(64)}`)
    expect(snapshot.inspector?.title).toMatch(/Machine-local/i)
    expect(JSON.stringify(snapshot.inspector)).toContain("/opt/local/bin/codex")
    expect(JSON.stringify(snapshot.page.selection)).not.toContain("must-redact")
    expect(JSON.stringify(snapshot.page.selection)).toContain("[redacted]")
  })

  it("blocks run preparation when a machine-local binding is missing or legacy", async () => {
    const missing = harness({ runtimeBindings: {} }).source
    const missingRuns = await missing.readSnapshot("runs-evidence")
    if (missingRuns.page.kind !== "runs-evidence") throw new Error("Expected runs page")
    expect(missingRuns.page.actions[0]).toMatchObject({ enabled: false })
    expect(missingRuns.page.actions[0]?.disabledReason).toMatch(/No machine-local runtime binding/i)

    const key = `${workspacePath}\u0000gaep.codex-cli`
    const legacy = harness({
      runtimeBindings: {
        [key]: {
          adapterId: "gaep.codex-cli",
          canonicalPath: "/legacy/machine/path/codex",
          digest: `sha256:${"c".repeat(64)}`,
          size: 1,
          modifiedAtMs: 1,
        },
      },
    }).source
    const legacyOverview = await legacy.readSnapshot("overview")
    if (legacyOverview.page.kind !== "overview") throw new Error("Expected overview")
    expect(legacyOverview.page.blockers.some((blocker) => /legacy path-bearing format/i.test(blocker.message))).toBe(true)
    expect(JSON.stringify(legacyOverview)).not.toContain("/legacy/machine/path")
  })

  it("offers an explicit migration stop-line for a legacy portable-selection read failure", async () => {
    const { source } = harness({ selectionError: new Error("Legacy agent selection migration is required") })
    const overview = await source.readSnapshot("overview")
    if (overview.page.kind !== "overview") throw new Error("Expected overview")
    expect(overview.page.primaryAction?.label).toMatch(/Review and normalize/i)
    expect(overview.page.primaryAction?.action.kind).toBe("select-agent")
    expect(overview.page.blockers.some((blocker) => /legacy path-bearing selection is blocked/i.test(blocker.message))).toBe(true)
    expect(JSON.stringify(overview)).not.toContain("runtimeExecutable")
  })

  it("labels and offers all three supported Phase 2 selection boundaries", async () => {
    const { source } = harness()
    const snapshot = await source.readSnapshot("agents-tools")
    if (snapshot.page.kind !== "agents-tools") throw new Error("Expected agent page")
    const manual = snapshot.page.adapters.rows.find((row) => row.id === "gaep.manual")
    const codex = snapshot.page.adapters.rows.find((row) => row.id === "gaep.codex-cli")
    const claude = snapshot.page.adapters.rows.find((row) => row.id === "gaep.claude-code-cli")
    expect(manual?.cells.status).toMatch(/deterministic offline managed runtime/i)
    expect(manual?.actions[0]?.enabled).toBe(true)
    expect(codex?.cells.status).toMatch(/isolated staged execution capability/i)
    expect(codex?.actions[0]?.enabled).toBe(true)
    expect(claude?.cells.status).toMatch(/tool-free context-only capability/i)
    expect(claude?.actions[0]?.enabled).toBe(true)
  })

  it("shows executable and managed bindings only in the discriminated machine-local inspector", async () => {
    const manual = harness({
      selection: manualSelection,
      runtimeBindings: {
        [`${workspacePath}\u0000${manualSelection.adapterId}`]: managedBinding(manualSelection, "gaep.manual"),
      },
    }).source
    const manualSnapshot = await manual.readSnapshot("agents-tools")
    expect(manualSnapshot.inspector?.entries).toEqual(expect.arrayContaining([
      { term: "Binding kind", value: "Managed in-process" },
      { term: "Runtime ID", value: "gaep.manual" },
    ]))
    expect(JSON.stringify(manualSnapshot.inspector)).not.toContain("Resolved executable")
    expect(JSON.stringify(manualSnapshot.page)).not.toContain("gaep.manual\u0000")

    const claude = harness({
      selection: claudeSelection,
      runtimeBindings: {
        [`${workspacePath}\u0000${claudeSelection.adapterId}`]: executableBinding(claudeSelection, "claude"),
      },
    }).source
    const claudeSnapshot = await claude.readSnapshot("agents-tools")
    expect(claudeSnapshot.inspector?.entries).toEqual(expect.arrayContaining([
      { term: "Binding kind", value: "Executable" },
      { term: "Resolved executable", value: "/opt/local/bin/claude" },
    ]))
    expect(JSON.stringify({ ...claudeSnapshot, inspector: undefined })).not.toContain("/opt/local/bin/claude")
  })

  it("preserves an unknown model-alias observation instead of displaying it as false", async () => {
    const selected = { ...selection, modelAlias: null }
    const snapshot = await harness({ selection: selected }).source.readSnapshot("agents-tools")
    if (snapshot.page.kind !== "agents-tools") throw new Error("Expected agent page")
    expect(snapshot.page.selection?.modelAlias).toBeNull()
    expect(snapshot.page.selectedAgent).toContainEqual({ term: "Model alias", value: "unknown" })
  })

  it("maps native actions, opens portable inspectors, and rejects stale operations", async () => {
    const { source, commands } = harness()
    const snapshot = await source.readSnapshot("delivery")
    const accepted = await source.execute({ kind: "create-initiative" }, {
      requestId: "request-1",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })
    expect(accepted.status).toBe("accepted")
    expect(commands).toEqual([{ command: "gaep.createInitiative", args: [] }])
    const inspected = await source.execute({ kind: "open-record", recordId: "record-1" }, {
      requestId: "request-2",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })
    expect(inspected.status).toBe("accepted")
    const stale = await source.execute({ kind: "show-diagnostics" }, {
      requestId: "request-3",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: 0,
    })
    expect(stale.status).toBe("rejected")
  })

  it("rejects an otherwise-current action after the opaque root context changes", async () => {
    const { source, commands, setContextGeneration } = harness()
    const snapshot = await source.readSnapshot("delivery")
    setContextGeneration("context_generation_0987654321")

    const result = await source.execute({ kind: "create-initiative" }, {
      requestId: "request-context-race",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })

    expect(result.status).toBe("rejected")
    expect(result.announcement).toMatch(/Product root or trust context changed/i)
    expect(commands).toEqual([])
    expect((await source.readSnapshot("delivery")).contextGeneration).toBe("context_generation_0987654321")
  })

  it("rejects a torn snapshot when the root context changes during observation", async () => {
    const { source } = harness({ rotateContextDuringObservation: true })
    await expect(source.readSnapshot("overview")).rejects.toThrow(/context changed while the snapshot was being read/i)
  })

  it("uses one fail-closed run eligibility result across Overview blockers and Runs actions", async () => {
    const cases: Array<{ name: string; options: HarnessOptions; reason: RegExp; overviewAction: string }> = [
      {
        name: "unsupported selection",
        options: { selection: { ...selection, adapterId: "gaep.unknown", agentId: "unknown-agent" } },
        reason: /no supported VS Code managed execution boundary/i,
        overviewAction: "select-agent",
      },
      {
        name: "unsafe Codex settings",
        options: { selection: { ...selection, settings: { ...selection.settings, sandbox: "workspace-write" } } },
        reason: /workspace-write is disabled/i,
        overviewAction: "select-agent",
      },
      {
        name: "missing Initiative",
        options: { initiatives: [] },
        reason: /Create and activate a bounded Initiative/i,
        overviewAction: "create-initiative",
      },
      {
        name: "invalid audit",
        options: { audit: { valid: false, events: 4, error: "broken" } },
        reason: /audit chain did not verify/i,
        overviewAction: "prepare-run",
      },
      {
        name: "unknown run effects",
        options: { runs: [{ ...run, state: "unknown" }] },
        reason: /unknown effects/i,
        overviewAction: "prepare-run",
      },
    ]

    for (const candidate of cases) {
      const { source } = harness(candidate.options)
      const overview = await source.readSnapshot("overview")
      if (overview.page.kind !== "overview") throw new Error(`Expected Overview for ${candidate.name}`)
      expect(overview.page.blockers.some((blocker) => candidate.reason.test(blocker.message)), candidate.name).toBe(true)
      expect(overview.page.primaryAction?.action.kind, candidate.name).toBe(candidate.overviewAction)
      if (overview.page.primaryAction?.action.kind === "prepare-run") {
        expect(overview.page.primaryAction.enabled, candidate.name).toBe(false)
        expect(overview.page.primaryAction.disabledReason, candidate.name).toMatch(candidate.reason)
      }

      const runs = await source.readSnapshot("runs-evidence")
      if (runs.page.kind !== "runs-evidence") throw new Error(`Expected Runs for ${candidate.name}`)
      expect(runs.page.actions[0]?.action.kind, candidate.name).toBe("prepare-run")
      expect(runs.page.actions[0]?.enabled, candidate.name).toBe(false)
      expect(runs.page.actions[0]?.disabledReason, candidate.name).toMatch(candidate.reason)
    }

    const healthy = harness().source
    const healthyOverview = await healthy.readSnapshot("overview")
    if (healthyOverview.page.kind !== "overview") throw new Error("Expected healthy Overview")
    expect(healthyOverview.page.primaryAction).toMatchObject({ enabled: false, action: { kind: "prepare-run" } })
    expect(healthyOverview.page.primaryAction?.disabledReason).toMatch(/Phase-3-gated/i)
    const healthyRuns = await healthy.readSnapshot("runs-evidence")
    if (healthyRuns.page.kind !== "runs-evidence") throw new Error("Expected healthy Runs")
    expect(healthyRuns.page.actions[0]).toMatchObject({ enabled: false, action: { kind: "prepare-run" } })
    expect(healthyRuns.page.actions[0]?.disabledReason).toMatch(/Phase-3-gated/i)
  })

  it("treats Manual, Codex, and Claude as binding-ready while preserving the Phase 3 launch stop line", async () => {
    const cases = [
      {
        selected: manualSelection,
        binding: managedBinding(manualSelection, "gaep.manual"),
        mode: /Manual deterministic offline/i,
      },
      {
        selected: selection,
        binding: executableBinding(selection, "codex"),
        mode: /Codex staged/i,
      },
      {
        selected: claudeSelection,
        binding: executableBinding(claudeSelection, "claude"),
        mode: /Claude context-only/i,
      },
    ]

    for (const candidate of cases) {
      const source = harness({
        selection: candidate.selected,
        runtimeBindings: {
          [`${workspacePath}\u0000${candidate.selected.adapterId}`]: candidate.binding,
        },
      }).source
      const overview = await source.readSnapshot("overview")
      if (overview.page.kind !== "overview") throw new Error("Expected Overview")
      expect(overview.page.primaryAction).toMatchObject({ enabled: false, action: { kind: "prepare-run" } })
      expect(overview.page.primaryAction?.disabledReason).toMatch(candidate.mode)
      expect(overview.page.primaryAction?.disabledReason).toMatch(/Phase-3-gated/i)
      expect(overview.page.blockers.some((blocker) => /select the agent again|unsupported/i.test(blocker.message))).toBe(false)
    }
  })

  it("uses blocked and uninitialized lifecycle states without probing untrusted roots", async () => {
    const blockedHarness = harness({ trusted: false })
    const blocked = blockedHarness.source
    const blockedSnapshot = await blocked.readSnapshot("overview")
    expect(blockedSnapshot.surface.kind).toBe("blocked")
    expect(await blocked.execute({ kind: "start-design-draft", expectedProductRevision: 3 }, {
      requestId: "untrusted-mutation",
      expectedContextGeneration: blockedSnapshot.contextGeneration,
      expectedSnapshotRevision: blockedSnapshot.snapshotRevision,
    })).toMatchObject({ status: "rejected", announcement: expect.stringMatching(/trust/i) })
    expect(blockedHarness.commands).toEqual([])
    const absent = harness({ withProduct: false }).source
    expect((await absent.readSnapshot("overview")).surface.kind).toBe("uninitialized")
  })

  it("loads only route-relevant bounded pages with accurate totals and next/previous navigation", async () => {
    const requirements = Array.from({ length: 250 }, (_, index) => ({
      schemaVersion: 1 as const,
      kind: "requirement" as const,
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      productId: product.id,
      revision: 1,
      key: `GAEP-REQ-${String(index + 1).padStart(3, "0")}`,
      statement: `Requirement ${index + 1}`,
      rationale: "Bounded test rationale",
      priority: "must" as const,
      state: "proposed" as const,
      verificationCriteria: ["Observable criterion"],
      sourceRecords: [],
      createdAt: "2026-07-21T00:00:00.000Z",
      updatedAt: "2026-07-21T00:00:00.000Z",
    }))
    const base = productStudioStub()
    let availableRequirements = requirements
    const listDomainPage = vi.fn(async (kind: string, input: { offset?: number; limit?: number } = {}) => {
      const offset = input.offset ?? 0
      const limit = input.limit ?? 50
      const records = kind === "requirement" ? availableRequirements : []
      return { items: records.slice(offset, offset + limit), offset, limit, total: records.length, hasMore: offset + limit < records.length }
    })
    const source = harness({
      productStudio: { ...base, listDomainPage } as unknown as ProductStudioService,
    }).source
    const snapshot = await source.readSnapshot("scope")
    if (snapshot.page.kind !== "record-form") throw new Error("Expected Scope form")
    const table = snapshot.page.relatedRecords?.find((candidate) => candidate.id === "requirements")
    expect(table?.rows).toHaveLength(50)
    expect(table?.pagination).toEqual({ offset: 0, limit: 50, total: 250, hasPrevious: false, hasNext: true })
    expect(listDomainPage).toHaveBeenCalledWith("requirement", { offset: 0, limit: 50 })
    const next = table?.actions.find((candidate) => candidate.label === "Next Requirements page")
    expect(next).toMatchObject({ enabled: true, action: { kind: "domain-page", recordKind: "requirement", offset: 50, limit: 50 } })
    if (!next) throw new Error("Expected next-page action")
    expect(await source.execute(next.action, {
      requestId: "requirements-next",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })).toMatchObject({ status: "accepted" })
    const second = await source.readSnapshot("scope")
    if (second.page.kind !== "record-form") throw new Error("Expected Scope form")
    const secondTable = second.page.relatedRecords?.find((candidate) => candidate.id === "requirements")
    expect(secondTable?.rows[0]?.cells.key).toBe("GAEP-REQ-051")
    expect(secondTable?.pagination).toEqual({ offset: 50, limit: 50, total: 250, hasPrevious: true, hasNext: true })
    expect(secondTable?.actions.find((candidate) => candidate.label === "Previous Requirements page")).toMatchObject({ enabled: true })
    expect(listDomainPage.mock.calls.every(([kind]) => kind === "requirement")).toBe(true)

    expect(await source.execute({ kind: "domain-page", recordKind: "requirement", offset: 200, limit: 25 }, {
      requestId: "requirements-custom-page",
      expectedContextGeneration: second.contextGeneration,
      expectedSnapshotRevision: second.snapshotRevision,
    })).toMatchObject({ status: "accepted" })
    availableRequirements = []
    const emptied = await source.readSnapshot("scope")
    if (emptied.page.kind !== "record-form") throw new Error("Expected Scope form")
    expect(emptied.page.relatedRecords?.find((candidate) => candidate.id === "requirements")?.pagination)
      .toEqual({ offset: 0, limit: 25, total: 0, hasPrevious: false, hasNext: false })

    availableRequirements = requirements.slice(0, 70)
    expect(await source.execute({ kind: "domain-page", recordKind: "requirement", offset: 100, limit: 25 }, {
      requestId: "requirements-shrunk-page",
      expectedContextGeneration: emptied.contextGeneration,
      expectedSnapshotRevision: emptied.snapshotRevision,
    })).toMatchObject({ status: "accepted" })
    const shrunk = await source.readSnapshot("scope")
    if (shrunk.page.kind !== "record-form") throw new Error("Expected Scope form")
    expect(shrunk.page.relatedRecords?.find((candidate) => candidate.id === "requirements")?.pagination)
      .toEqual({ offset: 50, limit: 25, total: 70, hasPrevious: true, hasNext: false })
  })

  it("saves one design section with exact optimistic revisions and local actor provenance", async () => {
    const saveDesignDraft = vi.fn(async (input: unknown) => ({ ...designDraft, revision: 3, input }))
    const source = harness({
      productStudio: { ...productStudioStub(), saveDesignDraft } as unknown as ProductStudioService,
    }).source
    const snapshot = await source.readSnapshot("direction")
    const result = await source.execute({
      kind: "save-draft",
      route: "direction",
      draftId: designDraft.id,
      draftRevision: designDraft.revision,
      baseRevision: designDraft.baseProductRevision,
      values: { "direction.truth": "Revised direction truth" },
      states: { "direction.truth": "weak" },
      deferredReasons: {},
      revisitTriggers: {},
    }, {
      requestId: "save-design",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })
    expect(result.status).toBe("accepted")
    expect(saveDesignDraft).toHaveBeenCalledOnce()
    const input = saveDesignDraft.mock.calls[0]?.[0] as {
      expectedDraftRevision: number
      expectedProductRevision: number
      sections: ProductDesignDraft["sections"]
    }
    expect(input.expectedDraftRevision).toBe(2)
    expect(input.expectedProductRevision).toBe(3)
    expect(input.sections.direction.fields[0]).toMatchObject({
      value: "Revised direction truth",
      state: "weak",
      provenance: expect.arrayContaining(["human:local-actor-test"]),
    })
  })

  it("rejects a design save when the draft revision changed after the snapshot", async () => {
    let reads = 0
    const base = productStudioStub()
    const readDesignDraft = vi.fn(async () => {
      reads += 1
      return reads === 1 ? designDraft : { ...designDraft, revision: designDraft.revision + 1 }
    })
    const saveDesignDraft = vi.fn()
    const source = harness({
      productStudio: { ...base, readDesignDraft, saveDesignDraft } as unknown as ProductStudioService,
    }).source
    const snapshot = await source.readSnapshot("direction")
    const result = await source.execute({
      kind: "save-draft",
      route: "direction",
      draftId: designDraft.id,
      draftRevision: designDraft.revision,
      baseRevision: designDraft.baseProductRevision,
      values: { "direction.truth": "stale edit" },
    }, {
      requestId: "stale-design",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })
    expect(result).toMatchObject({ status: "rejected", announcement: expect.stringMatching(/changed since/i) })
    expect(saveDesignDraft).not.toHaveBeenCalled()
  })

  it("rejects secret-shaped design content before any repository mutation", async () => {
    const saveDesignDraft = vi.fn()
    const source = harness({
      productStudio: { ...productStudioStub(), saveDesignDraft } as unknown as ProductStudioService,
    }).source
    const snapshot = await source.readSnapshot("direction")
    const result = await source.execute({
      kind: "save-draft",
      route: "direction",
      draftId: designDraft.id,
      draftRevision: designDraft.revision,
      baseRevision: designDraft.baseProductRevision,
      values: { "direction.truth": "api_key=abcdefghijklmnopqrstuvwxyz123456" },
    }, {
      requestId: "secret-design",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })
    expect(result).toMatchObject({ status: "rejected", announcement: expect.stringMatching(/secret-shaped/i) })
    expect(saveDesignDraft).not.toHaveBeenCalled()
  })

  it("retains bounded native search results and their explicit total", async () => {
    const searchResult = {
      schemaVersion: 1 as const,
      kind: "requirement" as const,
      id: "77777777-7777-4777-8777-777777777777",
      productId: product.id,
      revision: 2,
      label: "GAEP-REQ-777",
      excerpt: "bounded search result",
      updatedAt: "2026-07-21T00:00:00.000Z",
    }
    const { source, commands } = harness({ commandResult: { kind: "search-results", results: [searchResult], total: 300 } })
    const snapshot = await source.readSnapshot("trace")
    const result = await source.execute({ kind: "domain-workflow", workflow: "search" }, {
      requestId: "search",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })
    expect(result.status).toBe("accepted")
    expect(commands[0]).toMatchObject({
      command: "gaep.productStudio.domainWorkflow",
      args: [{
        kind: "domain-workflow",
        workflow: "search",
        expectedProductRevision: product.revision,
        expectedContextGeneration: snapshot.contextGeneration,
      }],
    })
    const refreshed = await source.readSnapshot("trace")
    if (refreshed.page.kind !== "trace") throw new Error("Expected Trace page")
    expect(refreshed.page.searchResults.rows).toHaveLength(1)
    expect(refreshed.page.searchResults.truncation).toMatchObject({ shown: 1, total: 300 })
  })

  it("exposes inspectable and revocable Instruction Privilege Grants without treating them as authority", async () => {
    const grant = {
      schemaVersion: 1 as const,
      kind: "instruction-privilege-grant" as const,
      id: "88888888-8888-4888-8888-888888888888",
      productId: product.id,
      revision: 2,
      source: { kind: "logical" as const, value: "reviewed-instruction-source" },
      sourceDigest: `sha256:${"8".repeat(64)}`,
      privilege: "governing-instruction" as const,
      purpose: "Bounded Product design guidance",
      recipient: { kind: "agent" as const, id: "codex-cli" },
      scope: Array.from({ length: 128 }, (_, index) => `scope-${index}-${"s".repeat(300)}`),
      authority: {
        recordType: "requirement" as const,
        recordId: "99999999-9999-4999-8999-999999999999",
        revision: 1,
        digest: `sha256:${"9".repeat(64)}`,
      },
      state: "active" as const,
      acceptedBy: { kind: "human" as const, id: "local-actor-test" },
      acceptedAt: "2026-07-21T00:00:00.000Z",
      expiresAt: "2027-07-21T00:00:00.000Z",
      authorityBoundary: "instruction-privilege-is-exact-source-purpose-recipient-and-scope" as const,
      createdAt: "2026-07-21T00:00:00.000Z",
      updatedAt: "2026-07-21T00:00:00.000Z",
    }
    const base = productStudioStub()
    const listDomainPage = vi.fn(async (kind: string, input: { offset?: number; limit?: number } = {}) => ({
      items: kind === "instruction-privilege-grant" ? [grant] : [],
      offset: input.offset ?? 0,
      limit: input.limit ?? 50,
      total: kind === "instruction-privilege-grant" ? 1 : 0,
      hasMore: false,
    }))
    const { source } = harness({ productStudio: { ...base, listDomainPage } as unknown as ProductStudioService })
    const snapshot = await source.readSnapshot("agents-tools")
    if (snapshot.page.kind !== "agents-tools") throw new Error("Expected Agents & Tools page")
    const table = snapshot.page.instructionPrivilegeGrants
    expect(table.rows[0]).toMatchObject({
      id: grant.id,
      state: "active",
      cells: { privilege: "governing-instruction", state: "active", revision: "2" },
    })
    expect(table.actions.some((candidate) => candidate.action.kind === "domain-workflow" &&
      candidate.action.workflow === "create-instruction-privilege-grant")).toBe(true)
    const revoke = table.rows[0]?.actions.find((candidate) => candidate.label === "Revoke")
    expect(revoke).toMatchObject({
      enabled: true,
      action: { workflow: "revoke-instruction-privilege-grant", recordId: grant.id, expectedRevision: 2 },
    })
    expect(await source.execute({ kind: "open-record", recordId: grant.id }, {
      requestId: "inspect-grant",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })).toMatchObject({ status: "accepted" })
    const inspected = await source.readSnapshot("agents-tools")
    expect(isStudioSnapshot(inspected)).toBe(true)
    expect(inspected.inspector).toMatchObject({
      recordId: grant.id,
      entries: expect.arrayContaining([{ term: "Record type", value: "instruction-privilege-grant" }]),
    })
    expect(inspected.inspector?.entries.find((entry) => entry.term === "Scope summary")?.value).toMatch(/display truncated/i)
  })

  it("exposes every Product-domain creation workflow from its keyboard-renderable route", async () => {
    const { source } = harness()
    const snapshots = await Promise.all([
      source.readSnapshot("delivery"),
      source.readSnapshot("scope"),
      source.readSnapshot("architecture"),
      source.readSnapshot("risks-decisions"),
      source.readSnapshot("agents-tools"),
      source.readSnapshot("runs-evidence"),
      source.readSnapshot("trace"),
    ])
    const actions = JSON.stringify(snapshots.map((snapshot) => snapshot.page))
    for (const workflow of [
      "create-change", "create-work-item", "create-requirement", "create-architecture", "create-decision", "create-risk",
      "create-context-pack", "create-workflow-plan", "create-tool-definition", "create-run-tool-selection", "create-evidence",
      "create-instruction-privilege-grant", "create-trace-link",
    ]) expect(actions, workflow).toContain(`\"workflow\":\"${workflow}\"`)
  })
})
