import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  canonicalDigest,
  fingerprintExecutable,
  type AdapterProbeResult,
} from "@gaep/agent-sdk"
import {
  legacyAdapterCapabilitiesV1Schema,
  legacyAgentSelectionV1Schema,
  type AdapterCapabilities,
  type ProductExportBundle,
} from "@gaep/contracts"

import { EngineHost } from "./host.js"

function codexCapabilities(): AdapterCapabilities {
  return {
    schemaVersion: 1,
    adapterId: "gaep.codex-cli",
    adapterVersion: "0.1.0",
    agentId: "codex-cli",
    agentLabel: "Codex",
    runtimeVersion: "0.135.0",
    detected: true,
    executionInterface: "cli-jsonl",
    interfaceMaturity: "stable",
    supportsResume: true,
    supportsCancel: true,
    supportsCheckpoints: false,
    supportsModelDiscovery: true,
    supportsToolSelection: false,
    settings: [
      {
        key: "sandbox",
        label: "Sandbox",
        description: "Safe sandbox",
        kind: "select",
        required: true,
        sensitive: false,
        defaultValue: "read-only",
        options: [{ value: "read-only", label: "read-only" }],
        truthClass: "provider-declared",
      },
      {
        key: "approvalPolicy",
        label: "Approvals",
        description: "Fail closed without an interactive mediator",
        kind: "select",
        required: true,
        sensitive: false,
        defaultValue: "fail-closed-noninteractive",
        options: [{ value: "fail-closed-noninteractive", label: "Fail closed (non-interactive)" }],
        truthClass: "configured",
      },
    ],
    models: [{
      id: "gpt-test",
      label: "Test model",
      reasoningOptions: [],
      inputModalities: ["text"],
      truthClass: "observed",
      alias: false,
    }, {
      id: "gpt-test-2",
      label: "Second test model",
      reasoningOptions: [],
      inputModalities: ["text"],
      truthClass: "observed",
      alias: false,
    }],
    limitations: [],
    observedAt: "2026-07-21T00:00:00.000Z",
  }
}

function managedCodexCapabilities(): AdapterCapabilities {
  return {
    ...codexCapabilities(),
    runtimeVersion: "0.135.0-managed",
    executionInterface: "stdio-rpc",
    supportsToolSelection: true,
    settings: [],
    limitations: ["Current managed staged boundary"],
    observedAt: "2026-07-23T00:00:00.000Z",
  }
}

async function probeResult(executablePath = process.execPath): Promise<AdapterProbeResult> {
  const executableFingerprint = await fingerprintExecutable(executablePath, "codex")
  return {
    capabilities: codexCapabilities(),
    runtimeBinding: {
      scope: "machine-local",
      kind: "executable",
      adapterId: "gaep.codex-cli",
      agentId: "codex-cli",
      executablePath: executableFingerprint.canonicalPath,
      executableFingerprint,
    },
  }
}

describe("engine host protocol", () => {
  let workspace: string
  let host: EngineHost

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-host-"))
    host = new EngineHost(workspace)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(workspace, { recursive: true, force: true })
  })

  async function mockCodex(result = probeResult()): Promise<AdapterProbeResult> {
    const resolved = await result
    const adapter = host.engine.adapters.get("gaep.codex-cli")
    if (!adapter) throw new Error("Codex adapter is not registered")
    vi.spyOn(adapter, "probe").mockResolvedValue(resolved)
    return resolved
  }

  async function createProductAndInitiative(): Promise<{ productId: string; productRevision: number; initiativeId: string }> {
    const product = await host.dispatch({
      jsonrpc: "2.0",
      id: 1,
      method: "createProduct",
      params: {
        product: {
          name: "Host test Product",
          summary: "A bounded test Product",
          problem: "Cross-host selection must not trust caller capability objects.",
          affectedUsers: "GAEP host users",
          desiredOutcome: "Only host-observed capabilities reach execution.",
          successSignals: ["Host-local runtime remains private"],
          firstWorkflow: "Probe, select, charter, and prepare a run.",
          exclusions: [],
          profile: "software",
        },
      },
    }) as { id: string; revision: number }
    const initiative = await host.dispatch({
      jsonrpc: "2.0",
      id: 2,
      method: "createInitiative",
      params: {
        initiative: {
          title: "Host-owned capabilities",
          outcome: "Prepare one safe invocation",
          scope: ["engine-host"],
          exclusions: [],
        },
      },
    }) as { id: string }
    await host.engine.updateInitiativeState(
      initiative.id,
      "active",
      "Activate the host integration-test Initiative",
      "gaep.host-test",
    )
    return { productId: product.id, productRevision: product.revision, initiativeId: initiative.id }
  }

  async function selectCodex(): Promise<void> {
    await host.dispatch({
      jsonrpc: "2.0",
      id: 3,
      protocolVersion: 3,
      method: "selectAgent",
      params: {
        adapterId: "gaep.codex-cli",
        modelId: "gpt-test",
        settings: { sandbox: "read-only", approvalPolicy: "fail-closed-noninteractive" },
        expectedCurrentSelectionDigest: null,
      },
    })
  }

  async function selectAndConfirmCharter(initiativeId: string): Promise<string> {
    await selectCodex()
    const charter = await host.dispatch({
      jsonrpc: "2.0",
      id: 4,
      method: "createCharter",
      params: {
        charter: {
          initiativeId,
          objective: "Prepare a safe non-interactive Codex invocation",
          permissions: [
            { capability: "read-workspace", mode: "allow", scope: ["."] },
            { capability: "modify-workspace", mode: "deny", scope: ["."] },
            { capability: "run-local-commands", mode: "allow", scope: ["."] },
            { capability: "network-access", mode: "deny", scope: [] },
            { capability: "commit", mode: "deny", scope: ["."] },
            { capability: "push", mode: "deny", scope: [] },
            { capability: "deploy", mode: "deny", scope: [] },
            { capability: "publish", mode: "deny", scope: [] },
            { capability: "external-communication", mode: "deny", scope: [] },
            { capability: "destructive-delete", mode: "deny", scope: ["."] },
          ],
          expectedEffects: ["observe"],
          forbiddenActions: ["Do not publish"],
          stopConditions: ["Stop when scope changes"],
          requiredEvidence: ["Invocation preparation"],
        },
      },
    }) as { id: string }
    await host.dispatch({
      jsonrpc: "2.0",
      id: 5,
      method: "confirmCharter",
      params: { charterId: charter.id },
    })
    return charter.id
  }

  async function persistLegacyCodexSelection(executablePath = "/opt/legacy/private/codex") {
    const current = await host.engine.readSelection()
    const { schemaVersion: _selectionVersion, ...selectionFields } = current
    const historical = codexCapabilities()
    const { schemaVersion: _capabilityVersion, ...capabilityFields } = historical
    const legacyCapabilities = legacyAdapterCapabilitiesV1Schema.parse({
      ...capabilityFields,
      executablePath,
    })
    const { observedAt: _observedAt, ...historicalStableCapabilities } = legacyCapabilities
    const legacySelection = legacyAgentSelectionV1Schema.parse({
      ...selectionFields,
      capabilityDigest: canonicalDigest(historicalStableCapabilities),
      runtimeExecutable: executablePath,
    })
    const legacyCapabilityName = `capabilities-${canonicalDigest({
      adapterId: historical.adapterId,
      agentId: historical.agentId,
    }).slice("sha256:".length)}.json`
    await host.engine.repository.withLock(() => host.engine.repository.commitMutation({
      writes: [
        {
          path: host.engine.repository.resolve("runtime", "selection.json"),
          value: legacySelection,
          schema: legacyAgentSelectionV1Schema,
          governed: true,
        },
        {
          path: host.engine.repository.resolve("runtime", legacyCapabilityName),
          value: legacyCapabilities,
          schema: legacyAdapterCapabilitiesV1Schema,
          governed: true,
        },
      ],
      audit: {
        eventType: "test.legacy-selection.persisted",
        actor: { kind: "system", id: "gaep.host-test" },
        payload: { portableMigrationFixture: true },
      },
    }))
    const observed = managedCodexCapabilities()
    const adapter = host.engine.adapters.get("gaep.codex-cli")
    if (!adapter) throw new Error("Codex adapter is not registered")
    const binding = (await probeResult()).runtimeBinding
    vi.mocked(adapter.probe).mockResolvedValue({ capabilities: observed, runtimeBinding: binding })
    return { current, observed }
  }

  it("negotiates protocol v3 while retaining safe v1 and v2 methods", async () => {
    await expect(host.dispatch({ jsonrpc: "2.0", id: 1, method: "ping", params: {} })).resolves.toEqual({
      engineVersion: "0.1.0",
      protocolVersion: 3,
      negotiatedProtocolVersion: 1,
      supportedProtocolVersions: [1, 2, 3],
    })
    await expect(host.dispatch({ jsonrpc: "2.0", id: 2, protocolVersion: 2, method: "ping", params: {} })).resolves.toMatchObject({
      protocolVersion: 3,
      negotiatedProtocolVersion: 2,
    })
    await expect(host.dispatch({ jsonrpc: "2.0", id: 3, protocolVersion: 3, method: "ping", params: {} })).resolves.toMatchObject({
      protocolVersion: 3,
      negotiatedProtocolVersion: 3,
    })
    await expect(host.dispatch({ jsonrpc: "2.0", id: 30, protocolVersion: 4, method: "ping", params: {} })).rejects.toMatchObject({
      kind: "UNSUPPORTED_PROTOCOL_VERSION",
    })
    await expect(host.dispatch({ jsonrpc: "2.0", id: 4, method: "workspaceHealth", params: {} })).rejects.toMatchObject({
      kind: "PROTOCOL_UPGRADE_REQUIRED",
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 5,
      protocolVersion: 2,
      method: "migrateLegacySelection",
      params: {
        adapterId: "gaep.codex-cli",
        decision: "accept-exact-legacy-migration-preview",
        expectedPreviewDigest: `sha256:${"0".repeat(64)}`,
        expectedLegacySelectionDigest: `sha256:${"0".repeat(64)}`,
      },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 6,
      protocolVersion: 2,
      method: "selectAgent",
      params: {},
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 7,
      protocolVersion: 2,
      method: "previewLegacySelectionMigration",
      params: { adapterId: "gaep.codex-cli" },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
  })

  it("rejects unknown methods, malformed params, caller capability injection, and oversized direct requests", async () => {
    await expect(host.dispatch({ jsonrpc: "2.0", id: 1, method: "eraseEverything", params: {} })).rejects.toMatchObject({
      code: -32_601,
      kind: "METHOD_NOT_FOUND",
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 2,
      protocolVersion: 3,
      method: "selectAgent",
      params: {
        adapterId: "gaep.codex-cli",
        modelId: "gpt-test",
        settings: {},
        expectedCurrentSelectionDigest: null,
        capabilities: { executablePath: "/tmp/caller-controlled" },
      },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 3,
      protocolVersion: 3,
      method: "selectAgent",
      params: {
        adapterId: "gaep.codex-cli",
        modelId: "gpt-test",
        settings: { workspaceRoot: "/tmp/injected" },
        expectedCurrentSelectionDigest: null,
      },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 4,
      protocolVersion: 3,
      method: "migrateLegacySelection",
      params: {
        adapterId: "gaep.codex-cli",
        decision: "accept-exact-legacy-migration-preview",
        expectedPreviewDigest: `sha256:${"0".repeat(64)}`,
        expectedLegacySelectionDigest: `sha256:${"0".repeat(64)}`,
        modelId: "gpt-test",
        settings: {},
        runtimeExecutable: "/tmp/caller-controlled",
      },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 5,
      method: "createProduct",
      params: { product: { name: "x" } },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 6,
      method: "readProduct",
      params: { padding: "x".repeat(1024 * 1024) },
    })).rejects.toMatchObject({ code: -32_001, kind: "FRAME_TOO_LARGE" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 7,
      protocolVersion: 3,
      method: "createHandoff",
      params: {
        handoff: {
          fromRunId: "00000000-0000-4000-8000-000000000000",
          toAdapterId: "gaep.codex-cli",
          toModelId: "gpt-test-2",
          toSettings: {},
          reason: "Missing exact preview acceptance",
          completedWork: [],
          unresolvedMatters: [],
          decisions: [],
          evidence: [],
        },
      },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 8,
      protocolVersion: 3,
      method: "previewLegacySelectionMigration",
      params: {
        adapterId: "gaep.codex-cli",
        modelId: "caller-chosen-model",
        settings: { callerChosen: true },
        capabilities: { detected: true },
      },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
  })

  it("previews and commits legacy migration through an opaque exact-state digest", async () => {
    await mockCodex()
    await createProductAndInitiative()
    await selectCodex()
    const { current, observed } = await persistLegacyCodexSelection()

    const compatibility = await host.dispatch({
      jsonrpc: "2.0",
      id: 70,
      protocolVersion: 3,
      method: "readSelection",
      params: {},
    }) as {
      status: "migration-required"
      portableCandidate: typeof current
      legacySelectionDigest: string
      capabilityReconfirmationRequired: true
    }
    expect(compatibility.status).toBe("migration-required")
    expect(compatibility.capabilityReconfirmationRequired).toBe(true)
    expect(JSON.stringify(compatibility)).not.toContain("/opt/legacy")

    const preview = await host.dispatch({
      jsonrpc: "2.0",
      id: 71,
      protocolVersion: 3,
      method: "previewLegacySelectionMigration",
      params: { adapterId: observed.adapterId },
    }) as {
      targetSelection: typeof current
      retiredSettingKeys: string[]
      legacySelectionDigest: string
      previousPortableSelectionDigest: string
      decision: "accept-exact-legacy-migration-preview"
      expectedPreviewDigest: string
    }
    expect(preview.targetSelection).toMatchObject({
      schemaVersion: 2,
      adapterId: current.adapterId,
      agentId: current.agentId,
      modelId: current.modelId,
      settings: {},
    })
    expect(preview.retiredSettingKeys).toEqual(["approvalPolicy", "sandbox"])
    expect(preview.legacySelectionDigest).toBe(compatibility.legacySelectionDigest)
    expect(preview.previousPortableSelectionDigest).toBe(canonicalDigest(compatibility.portableCandidate))
    expect(preview.decision).toBe("accept-exact-legacy-migration-preview")
    expect(preview.expectedPreviewDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(JSON.stringify(preview)).not.toContain("/opt/legacy")

    const migration = {
      adapterId: observed.adapterId,
      decision: preview.decision,
      expectedPreviewDigest: preview.expectedPreviewDigest,
      expectedLegacySelectionDigest: preview.legacySelectionDigest,
    }
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 72,
      protocolVersion: 3,
      method: "migrateLegacySelection",
      params: { ...migration, expectedPreviewDigest: `sha256:${"0".repeat(64)}` },
    })).rejects.toMatchObject({ kind: "MIGRATION_PREVIEW_CHANGED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 73,
      protocolVersion: 3,
      method: "migrateLegacySelection",
      params: { ...migration, expectedLegacySelectionDigest: `sha256:${"0".repeat(64)}` },
    })).rejects.toMatchObject({ kind: "SELECTION_CHANGED" })
    const migrated = await host.dispatch({
      jsonrpc: "2.0",
      id: 74,
      protocolVersion: 3,
      method: "migrateLegacySelection",
      params: migration,
    }) as { schemaVersion: number }
    expect(migrated.schemaVersion).toBe(2)
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 75,
      protocolVersion: 3,
      method: "migrateLegacySelection",
      params: migration,
    })).rejects.toMatchObject({ kind: "SELECTION_CHANGED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 76,
      protocolVersion: 3,
      method: "readSelection",
      params: {},
    })).resolves.toMatchObject({ status: "current" })
  })

  it("maps dependent governed history to a stable legacy-migration host error", async () => {
    await mockCodex()
    const { initiativeId } = await createProductAndInitiative()
    await selectAndConfirmCharter(initiativeId)
    const { observed } = await persistLegacyCodexSelection()

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 76,
      protocolVersion: 3,
      method: "previewLegacySelectionMigration",
      params: { adapterId: observed.adapterId },
    })).rejects.toMatchObject({ kind: "MIGRATION_DEPENDENT_HISTORY" })
  })

  it("maps an incompatible retained legacy setting to a stable host error", async () => {
    await mockCodex()
    vi.spyOn(host.engine, "previewLegacyAgentSelectionMigration").mockRejectedValue(
      new Error("Legacy current setting sandbox is no longer declared by the observed capabilities"),
    )

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 77,
      protocolVersion: 3,
      method: "previewLegacySelectionMigration",
      params: { adapterId: "gaep.codex-cli" },
    })).rejects.toMatchObject({ code: -32_026, kind: "CURRENT_SETTING_INCOMPATIBLE" })
  })

  it("quarantines pre-integrity legacy repositories behind a typed bootstrap boundary", async () => {
    await mockCodex()
    vi.spyOn(host.engine, "previewLegacyAgentSelectionMigration").mockRejectedValue(
      new Error("Legacy Agent Selection repository integrity is not current; a dedicated reviewed integrity bootstrap is required before selection migration"),
    )

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 78,
      protocolVersion: 3,
      method: "previewLegacySelectionMigration",
      params: { adapterId: "gaep.codex-cli" },
    })).rejects.toMatchObject({ code: -32_027, kind: "MIGRATION_INTEGRITY_BOOTSTRAP_REQUIRED" })
  })

  it("maps a mismatched historical selection/capability binding to a stable host error", async () => {
    await mockCodex()
    vi.spyOn(host.engine, "previewLegacyAgentSelectionMigration").mockRejectedValue(
      new Error("Legacy Agent Selection capability digest does not match the recognized historical capability snapshot"),
    )

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 79,
      protocolVersion: 3,
      method: "previewLegacySelectionMigration",
      params: { adapterId: "gaep.codex-cli" },
    })).rejects.toMatchObject({ code: -32_028, kind: "LEGACY_CAPABILITY_BINDING_INVALID" })
  })

  it("maps an unrecognized legacy setting rule to a stable host error", async () => {
    await mockCodex()
    vi.spyOn(host.engine, "previewLegacyAgentSelectionMigration").mockRejectedValue(
      new Error("Legacy Agent Selection setting mysteryLegacyControl has no reviewed migration rule"),
    )

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 80,
      protocolVersion: 3,
      method: "previewLegacySelectionMigration",
      params: { adapterId: "gaep.codex-cli" },
    })).rejects.toMatchObject({ code: -32_029, kind: "LEGACY_SETTING_UNRECOGNIZED" })
  })

  it("returns only path-free capability snapshots and ignores all caller runtime authority", async () => {
    await mockCodex()
    const probed = await host.dispatch({ jsonrpc: "2.0", id: 1, method: "probeAgents", params: {} })
    const serialized = JSON.stringify(probed)
    expect(serialized).not.toContain(process.execPath)
    expect(serialized).not.toContain("executablePath")
    expect(serialized).not.toContain("executableFingerprint")
    expect(serialized).not.toMatch(/sha256:[0-9a-f]{64}/u)
  })

  it("does not leak absolute paths from adapter failures through direct host dispatch", async () => {
    const adapter = host.engine.adapters.get("gaep.codex-cli")
    if (!adapter) throw new Error("Codex adapter is not registered")
    vi.spyOn(adapter, "probe").mockRejectedValue(new Error("failed at /Users/alice/private/agent token=top-secret"))

    let failure: unknown
    try {
      await host.dispatch({ jsonrpc: "2.0", id: 1, method: "probeAgents", params: {} })
    } catch (error) {
      failure = error
    }
    expect(failure).toMatchObject({ kind: "INTERNAL_ERROR" })
    expect(JSON.stringify(failure)).not.toContain("/Users/alice")
    expect(JSON.stringify(failure)).not.toContain("top-secret")
  })

  it("keeps selection and prepared-run RPC results portable while binding execution server-side", async () => {
    await mockCodex()
    const { initiativeId } = await createProductAndInitiative()
    const charterId = await selectAndConfirmCharter(initiativeId)
    const prepared = await host.dispatch({
      jsonrpc: "2.0",
      id: 6,
      method: "prepareRun",
      params: { charterId },
    }) as { run: { agent: Record<string, unknown> }; execution: { protocol: string; promptAttached: boolean } }

    expect(prepared.run.agent).toMatchObject({ schemaVersion: 2, adapterId: "gaep.codex-cli", modelId: "gpt-test" })
    expect(prepared.run.agent).not.toHaveProperty("runtimeExecutable")
    expect(prepared.execution).toMatchObject({ protocol: "jsonl", promptAttached: true })
    const serialized = JSON.stringify(prepared)
    expect(serialized).not.toContain(workspace)
    expect(serialized).not.toContain(process.execPath)
    expect(serialized).not.toContain("executableFingerprint")
  })

  it("fails closed when the selected executable fingerprint changes before prepare-run", async () => {
    const executable = join(workspace, "fake-codex")
    await writeFile(executable, "first executable revision")
    const observed = await probeResult(executable)
    await mockCodex(Promise.resolve(observed))
    const { initiativeId } = await createProductAndInitiative()
    const charterId = await selectAndConfirmCharter(initiativeId)
    await writeFile(executable, "second executable revision")

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 7,
      method: "prepareRun",
      params: { charterId },
    })).rejects.toMatchObject({ kind: "EXECUTABLE_CHANGED" })
  })

  it("requires the exact current-selection digest for a host material selection change", async () => {
    await mockCodex()
    const { initiativeId } = await createProductAndInitiative()
    await selectAndConfirmCharter(initiativeId)
    const currentResult = await host.dispatch({
      jsonrpc: "2.0",
      id: 101,
      protocolVersion: 3,
      method: "readSelection",
      params: {},
    }) as {
      status: "current"
      selection: Awaited<ReturnType<typeof host.engine.readSelection>>
      selectionDigest: string
    }
    expect(currentResult.status).toBe("current")
    const request = {
      jsonrpc: "2.0",
      id: 8,
      protocolVersion: 3,
      method: "selectAgent",
      params: {
        adapterId: "gaep.codex-cli",
        modelId: "gpt-test-2",
        settings: { sandbox: "read-only", approvalPolicy: "fail-closed-noninteractive" },
        expectedCurrentSelectionDigest: `sha256:${"0".repeat(64)}`,
      },
    }
    await expect(host.dispatch(request)).rejects.toMatchObject({ kind: "SELECTION_CHANGED" })
    const changed = await host.dispatch({
      ...request,
      id: 9,
      params: {
        ...request.params,
        expectedCurrentSelectionDigest: currentResult.selectionDigest,
      },
    }) as { modelId: string }
    expect(changed.modelId).toBe("gpt-test-2")
  })

  it("requires explicit runtime rebinding after an engine-host restart", async () => {
    await mockCodex()
    const { initiativeId } = await createProductAndInitiative()
    const charterId = await selectAndConfirmCharter(initiativeId)

    host = new EngineHost(workspace)
    await mockCodex()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 10,
      protocolVersion: 2,
      method: "prepareRun",
      params: { charterId },
    })).rejects.toMatchObject({ kind: "RUNTIME_BINDING_MISSING" })

    const rebound = await host.dispatch({
      jsonrpc: "2.0",
      id: 100,
      protocolVersion: 3,
      method: "readSelection",
      params: {},
    }) as { status: "current"; selection: Awaited<ReturnType<typeof host.engine.readSelection>>; selectionDigest: string }
    expect(rebound.status).toBe("current")
    const current = rebound.selection
    await host.dispatch({
      jsonrpc: "2.0",
      id: 11,
      protocolVersion: 3,
      method: "selectAgent",
      params: {
        adapterId: current.adapterId,
        modelId: current.modelId,
        settings: current.settings,
        expectedCurrentSelectionDigest: rebound.selectionDigest,
      },
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 12,
      protocolVersion: 2,
      method: "prepareRun",
      params: { charterId },
    })).resolves.toMatchObject({ run: { state: "prepared" } })
  })

  it("does not rebind an identical selection while unresolved work exists", async () => {
    const executable = join(workspace, "mutable-codex")
    await writeFile(executable, "first executable revision")
    await mockCodex(Promise.resolve(await probeResult(executable)))
    const { initiativeId } = await createProductAndInitiative()
    const charterId = await selectAndConfirmCharter(initiativeId)
    await host.dispatch({
      jsonrpc: "2.0",
      id: 13,
      protocolVersion: 2,
      method: "prepareRun",
      params: { charterId },
    })

    await writeFile(executable, "second executable revision")
    const adapter = host.engine.adapters.get("gaep.codex-cli")
    if (!adapter) throw new Error("Codex adapter is not registered")
    vi.mocked(adapter.probe).mockResolvedValue(await probeResult(executable))
    const current = await host.engine.readSelection()
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 14,
      protocolVersion: 3,
      method: "selectAgent",
      params: {
        adapterId: current.adapterId,
        modelId: current.modelId,
        settings: current.settings,
        expectedCurrentSelectionDigest: canonicalDigest(current),
      },
    })).rejects.toMatchObject({ kind: "SELECTION_WORK_UNRESOLVED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 15,
      protocolVersion: 2,
      method: "prepareRun",
      params: { charterId },
    })).rejects.toMatchObject({ kind: "EXECUTABLE_CHANGED" })
  })

  it("requires the exact reviewed handoff preview before committing an agent-selection switch", async () => {
    await mockCodex()
    const { initiativeId } = await createProductAndInitiative()
    const charterId = await selectAndConfirmCharter(initiativeId)
    const prepared = await host.dispatch({
      jsonrpc: "2.0",
      id: 6,
      method: "prepareRun",
      params: { charterId },
    }) as { run: { id: string } }
    await host.engine.markRunState(prepared.run.id, "cancelled", { kind: "human", id: "gaep.host-test" })

    const handoff = {
      fromRunId: prepared.run.id,
      toAdapterId: "gaep.codex-cli",
      toModelId: "gpt-test-2",
      toSettings: { sandbox: "read-only", approvalPolicy: "fail-closed-noninteractive" },
      reason: "Move the stopped Run to the reviewed second model",
      completedWork: ["Source Run stopped"],
      unresolvedMatters: [],
      decisions: ["Use the second observed model"],
      evidence: ["Cancelled source Run"],
    }
    const preview = await host.dispatch({
      jsonrpc: "2.0",
      id: 7,
      protocolVersion: 3,
      method: "previewHandoff",
      params: { handoff },
    }) as {
      handoff: { id: string; createdAt: string; acknowledgedAt?: string; toAgent: { modelId: string } }
      decision: "accept-exact-handoff-preview"
      expectedPreviewDigest: string
      expectedCurrentSelectionDigest: string
    }
    expect(preview.handoff.toAgent.modelId).toBe("gpt-test-2")
    expect(preview.handoff.acknowledgedAt).toBeUndefined()
    expect(preview.decision).toBe("accept-exact-handoff-preview")
    expect(preview.expectedPreviewDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(preview.expectedCurrentSelectionDigest).toMatch(/^sha256:[0-9a-f]{64}$/)

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 8,
      protocolVersion: 3,
      method: "createHandoff",
      params: {
        handoff,
        decision: preview.decision,
        expectedPreviewDigest: `sha256:${"0".repeat(64)}`,
        expectedCurrentSelectionDigest: preview.expectedCurrentSelectionDigest,
        expectedHandoffId: preview.handoff.id,
        expectedHandoffCreatedAt: preview.handoff.createdAt,
      },
    })).rejects.toMatchObject({ kind: "INTERNAL_ERROR" })
    expect((await host.engine.readSelection()).modelId).toBe("gpt-test")

    const committed = await host.dispatch({
      jsonrpc: "2.0",
      id: 9,
      protocolVersion: 3,
      method: "createHandoff",
      params: {
        handoff,
        decision: preview.decision,
        expectedPreviewDigest: preview.expectedPreviewDigest,
        expectedCurrentSelectionDigest: preview.expectedCurrentSelectionDigest,
        expectedHandoffId: preview.handoff.id,
        expectedHandoffCreatedAt: preview.handoff.createdAt,
      },
    }) as { id: string; createdAt: string; acknowledgedAt?: string; toAgent: { modelId: string } }
    expect(committed.acknowledgedAt).toBeDefined()
    expect(committed.id).toBe(preview.handoff.id)
    expect(committed.createdAt).toBe(preview.handoff.createdAt)
    expect(committed.toAgent.modelId).toBe("gpt-test-2")
    expect((await host.engine.readSelection()).modelId).toBe("gpt-test-2")
  })

  it("exposes strict workspace health and Product Studio readiness/search/export/import-preview methods in v2", async () => {
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 1,
      protocolVersion: 2,
      method: "workspaceHealth",
      params: {},
    })).resolves.toMatchObject({ status: "uninitialized" })

    const { productId, productRevision } = await createProductAndInitiative()
    await host.engine.productStudio.startOrResumeDesignDraft(productRevision)
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 2,
      protocolVersion: 2,
      method: "productStudio.designReadiness",
      params: { productId },
    })).resolves.toMatchObject({ status: "incomplete", claimBoundary: "design-readiness-is-not-implementation-approval" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 3,
      protocolVersion: 2,
      method: "productStudio.search",
      params: { query: "host test", kinds: ["product-revision"] },
    })).resolves.toEqual([expect.objectContaining({ kind: "product-revision" })])
    const bundle = await host.dispatch({
      jsonrpc: "2.0",
      id: 4,
      protocolVersion: 2,
      method: "productStudio.exportBuild",
      params: {},
    }) as ProductExportBundle
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 5,
      protocolVersion: 2,
      method: "productStudio.importPreview",
      params: { bundle },
    })).resolves.toMatchObject({ importMutation: "not-performed" })
  })
})
