import type { AdapterCapabilities, AgentSelection, Initiative, Product, Run } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

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
  adapterId: "codex-adapter",
  agentId: "codex-cli",
  runtimeExecutable: "/opt/local/bin/codex",
  modelId: "gpt-test",
  modelTruthClass: "provider-declared",
  modelAlias: false,
  settings: { sandbox: "read-only", approvalPolicy: "fail-closed-noninteractive", secretSetting: "must-redact" },
  selectedAt: "2026-07-21T00:00:00.000Z",
  capabilityDigest: `sha256:${"a".repeat(64)}`,
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

function capability(overrides: Partial<AdapterCapabilities>): AdapterCapabilities {
  return {
    adapterId: "codex-adapter",
    adapterVersion: "0.1.0",
    agentId: "codex-cli",
    agentLabel: "Codex",
    runtimeVersion: "1.0.0",
    executablePath: "/opt/local/bin/codex",
    detected: true,
    executionInterface: "cli-jsonl",
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
  initiatives?: Initiative[]
  runs?: Run[]
  audit?: { valid: boolean; events: number; error?: string }
  rotateContextDuringObservation?: boolean
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
      if (!selectedAgent) throw new Error("missing selection")
      return selectedAgent
    },
    listRuns: async () => options.runs ?? [run],
    repository: { verifyAudit: async () => options.audit ?? ({ valid: true, events: 8 }) },
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
      capability({}),
      capability({
        adapterId: "claude-adapter",
        agentId: "claude-code-cli",
        agentLabel: "Claude Code",
        executablePath: "/opt/local/bin/claude",
        executionInterface: "unavailable",
        interfaceMaturity: "unknown",
        models: [],
      }),
    ],
    runtimeBindings: () => ({
      [`${workspacePath}\u0000codex-adapter`]: {
        adapterId: "codex-adapter",
        requested: "codex",
        canonicalPath: "/opt/local/bin/codex",
        digest: `sha256:${"b".repeat(64)}`,
        size: 42,
        modifiedAtMs: 1,
        observedAt: "2026-07-21T00:00:00.000Z",
      },
    }),
    executeCommand: (expectedContextGeneration, command, ...args) => {
      if (expectedContextGeneration !== contextGeneration) throw new Error("stale context")
      commands.push({ command, args })
      return Promise.resolve()
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
    expect(architecture.surface.kind).toBe("empty")
    expect(architecture.surface.detail).toMatch(/no governed Architecture/i)
    const readiness = await source.readSnapshot("readiness")
    expect(readiness.page.kind).toBe("readiness")
    expect(readiness.page.kind === "readiness" && readiness.page.statement).toMatch(/Not formally ready/i)
    const agents = await source.readSnapshot("agents-tools")
    expect(agents.surface.knownEffects).toEqual(expect.arrayContaining([
      expect.stringMatching(/invokes configured agent executables/i),
    ]))
  })

  it("keeps executable paths out of portable tables and limits them to the machine-local inspector", async () => {
    const { source } = harness()
    const snapshot = await source.readSnapshot("agents-tools")
    expect(snapshot.page.kind).toBe("agents-tools")
    if (snapshot.page.kind !== "agents-tools") return
    expect(JSON.stringify(snapshot.page.adapters)).not.toContain("/opt/local/bin")
    expect(snapshot.inspector?.title).toMatch(/Machine-local/i)
    expect(JSON.stringify(snapshot.inspector)).toContain("/opt/local/bin/codex")
    expect(JSON.stringify(snapshot.page.selection)).not.toContain("must-redact")
    expect(JSON.stringify(snapshot.page.selection)).toContain("[redacted]")
  })

  it("labels Claude detection-only and Codex direct execution observe-only", async () => {
    const { source } = harness()
    const snapshot = await source.readSnapshot("agents-tools")
    if (snapshot.page.kind !== "agents-tools") throw new Error("Expected agent page")
    const codex = snapshot.page.adapters.rows.find((row) => row.id === "codex-adapter")
    const claude = snapshot.page.adapters.rows.find((row) => row.id === "claude-adapter")
    expect(codex?.cells.status).toMatch(/observe-only/i)
    expect(codex?.actions[0]?.enabled).toBe(true)
    expect(claude?.cells.status).toMatch(/inspection only/i)
    expect(claude?.actions[0]?.enabled).toBe(false)
  })

  it("maps only fixed semantic actions to existing native commands and rejects stale or unavailable operations", async () => {
    const { source, commands } = harness()
    const snapshot = await source.readSnapshot("delivery")
    const accepted = await source.execute({ kind: "create-initiative" }, {
      requestId: "request-1",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })
    expect(accepted.status).toBe("accepted")
    expect(commands).toEqual([{ command: "gaep.createInitiative", args: [] }])
    const unsupported = await source.execute({ kind: "open-record", recordId: "record-1" }, {
      requestId: "request-2",
      expectedContextGeneration: snapshot.contextGeneration,
      expectedSnapshotRevision: snapshot.snapshotRevision,
    })
    expect(unsupported.status).toBe("rejected")
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
        name: "inspection-only selection",
        options: { selection: { ...selection, agentId: "claude-code-cli" } },
        reason: /inspection-only/i,
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
    expect(healthyOverview.page.primaryAction).toMatchObject({ enabled: true, action: { kind: "prepare-run" } })
    const healthyRuns = await healthy.readSnapshot("runs-evidence")
    if (healthyRuns.page.kind !== "runs-evidence") throw new Error("Expected healthy Runs")
    expect(healthyRuns.page.actions[0]).toMatchObject({ enabled: true, action: { kind: "prepare-run" } })
  })

  it("uses blocked and uninitialized lifecycle states without probing untrusted roots", async () => {
    const blocked = harness({ trusted: false }).source
    expect((await blocked.readSnapshot("overview")).surface.kind).toBe("blocked")
    const absent = harness({ withProduct: false }).source
    expect((await absent.readSnapshot("overview")).surface.kind).toBe("uninitialized")
  })
})
