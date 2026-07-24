import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  fingerprintExecutable,
  type AdapterProbeResult,
} from "@gaep/agent-sdk"
import type { AdapterCapabilities, ProductExportBundle } from "@gaep/contracts"

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
    }],
    limitations: [],
    observedAt: "2026-07-21T00:00:00.000Z",
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
    vi.spyOn(adapter, "buildInvocation").mockImplementation((_selection, _charter, workspacePath, prompt, binding) => {
      if (binding.kind !== "executable") throw new Error("Host test requires an exact executable binding")
      return {
        executable: binding.executablePath,
        args: ["exec", "--json", "-"],
        cwd: workspacePath,
        stdin: prompt,
        inputMode: "text-once",
        environment: {},
        environmentPolicy: { inherit: "allowlist", allowedKeys: [] },
        protocol: "jsonl",
        maturity: "stable",
        warnings: [],
      }
    })
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

  async function selectAndConfirmCharter(initiativeId: string): Promise<string> {
    await host.dispatch({
      jsonrpc: "2.0",
      id: 3,
      method: "selectAgent",
      params: {
        adapterId: "gaep.codex-cli",
        modelId: "gpt-test",
        settings: { sandbox: "read-only", approvalPolicy: "fail-closed-noninteractive" },
      },
    })
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

  it("negotiates protocol v2 while retaining safe omitted-version v1 behavior", async () => {
    await expect(host.dispatch({ jsonrpc: "2.0", id: 1, method: "ping", params: {} })).resolves.toEqual({
      engineVersion: "0.1.0",
      protocolVersion: 2,
      negotiatedProtocolVersion: 1,
      supportedProtocolVersions: [1, 2],
    })
    await expect(host.dispatch({ jsonrpc: "2.0", id: 2, protocolVersion: 2, method: "ping", params: {} })).resolves.toMatchObject({
      protocolVersion: 2,
      negotiatedProtocolVersion: 2,
    })
    await expect(host.dispatch({ jsonrpc: "2.0", id: 3, protocolVersion: 3, method: "ping", params: {} })).rejects.toMatchObject({
      kind: "UNSUPPORTED_PROTOCOL_VERSION",
    })
    await expect(host.dispatch({ jsonrpc: "2.0", id: 4, method: "workspaceHealth", params: {} })).rejects.toMatchObject({
      kind: "PROTOCOL_UPGRADE_REQUIRED",
    })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 5,
      method: "migrateLegacySelection",
      params: {
        adapterId: "gaep.codex-cli",
        modelId: "gpt-test",
        settings: {},
        confirmation: "reconfirm-portable-agent-selection",
      },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 6,
      method: "readAgentSelection",
      params: {},
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
      method: "selectAgent",
      params: {
        adapterId: "gaep.codex-cli",
        modelId: "gpt-test",
        settings: {},
        capabilities: { executablePath: "/tmp/caller-controlled" },
      },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 3,
      method: "selectAgent",
      params: { adapterId: "gaep.codex-cli", modelId: "gpt-test", settings: { workspaceRoot: "/tmp/injected" } },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 4,
      protocolVersion: 2,
      method: "migrateLegacySelection",
      params: {
        adapterId: "gaep.codex-cli",
        modelId: "gpt-test",
        settings: {},
        confirmation: "reconfirm-portable-agent-selection",
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
      protocolVersion: 2,
      method: "managed.readonly.preview",
      params: {
        charterId: "11111111-1111-4111-8111-111111111111",
        workflowPlanId: "22222222-2222-4222-8222-222222222222",
        toolSelection: [],
      },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 8,
      protocolVersion: 2,
      method: "managed.readonly.execute",
      params: {
        charterId: "11111111-1111-4111-8111-111111111111",
        workflowPlanId: "22222222-2222-4222-8222-222222222222",
        expectedPreviewDigest: `sha256:${"0".repeat(64)}`,
        timeoutMs: 30_000,
        confirmation: "approve-tools-and-effects",
      },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 9,
      method: "managed.readonly.preview",
      params: {
        charterId: "11111111-1111-4111-8111-111111111111",
        workflowPlanId: "22222222-2222-4222-8222-222222222222",
      },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
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

  it("observes portable selection state without exposing runtime authority", async () => {
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 1,
      protocolVersion: 2,
      method: "readAgentSelection",
      params: {},
    })).resolves.toEqual({ status: "unselected" })

    await mockCodex()
    await createProductAndInitiative()
    await host.dispatch({
      jsonrpc: "2.0",
      id: 2,
      method: "selectAgent",
      params: {
        adapterId: "gaep.codex-cli",
        modelId: "gpt-test",
        settings: { sandbox: "read-only", approvalPolicy: "fail-closed-noninteractive" },
      },
    })
    const state = await host.dispatch({
      jsonrpc: "2.0",
      id: 3,
      protocolVersion: 2,
      method: "readAgentSelection",
      params: {},
    })
    expect(state).toMatchObject({
      status: "selected",
      selection: {
        schemaVersion: 2,
        adapterId: "gaep.codex-cli",
        agentId: "codex-cli",
        modelId: "gpt-test",
      },
    })
    const serialized = JSON.stringify(state)
    expect(serialized).not.toContain(process.execPath)
    expect(serialized).not.toContain("runtimeExecutable")
    expect(serialized).not.toContain("executablePath")
  })

  it("blocks selection during active Runs and requires versioned handoff after prior work", async () => {
    await mockCodex()
    const { initiativeId } = await createProductAndInitiative()
    const charterId = await selectAndConfirmCharter(initiativeId)
    const prepared = await host.dispatch({
      jsonrpc: "2.0",
      id: 6,
      method: "prepareRun",
      params: { charterId },
    }) as { run: { id: string } }
    const changedSettings = {
      sandbox: "read-only",
      approvalPolicy: "fail-closed-noninteractive",
      reasoningEffort: "high",
    }
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 7,
      method: "selectAgent",
      params: { adapterId: "gaep.codex-cli", modelId: "gpt-test", settings: changedSettings },
    })).rejects.toMatchObject({ code: -32_015, kind: "AGENT_SELECTION_ACTIVE_RUN" })

    await host.engine.markRunState(prepared.run.id, "running", { kind: "system", id: "host-test" })
    await host.engine.markRunState(prepared.run.id, "completed", { kind: "system", id: "host-test" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 8,
      method: "selectAgent",
      params: { adapterId: "gaep.codex-cli", modelId: "gpt-test", settings: changedSettings },
    })).rejects.toMatchObject({ code: -32_017, kind: "AGENT_SELECTION_HANDOFF_REQUIRED" })

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 9,
      method: "selectAgent",
      params: {
        adapterId: "gaep.codex-cli",
        modelId: "gpt-test",
        settings: { sandbox: "read-only", approvalPolicy: "fail-closed-noninteractive" },
      },
    })).resolves.toMatchObject({ adapterId: "gaep.codex-cli", modelId: "gpt-test" })
  })

  it("fails closed when capabilities change between host observation and governed selection", async () => {
    const initial = await probeResult()
    const changed = {
      ...initial,
      capabilities: { ...initial.capabilities, runtimeVersion: "0.136.0" },
    } satisfies AdapterProbeResult
    const adapter = host.engine.adapters.get("gaep.codex-cli")
    if (!adapter) throw new Error("Codex adapter is not registered")
    vi.spyOn(adapter, "probe").mockResolvedValueOnce(initial).mockResolvedValueOnce(changed)
    await createProductAndInitiative()

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 3,
      method: "selectAgent",
      params: {
        adapterId: "gaep.codex-cli",
        modelId: "gpt-test",
        settings: { sandbox: "read-only", approvalPolicy: "fail-closed-noninteractive" },
      },
    })).rejects.toMatchObject({ code: -32_012, kind: "CAPABILITIES_CHANGED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 4,
      protocolVersion: 2,
      method: "readAgentSelection",
      params: {},
    })).resolves.toEqual({ status: "unselected" })
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
