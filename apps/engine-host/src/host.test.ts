import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  fingerprintExecutable,
  type AdapterProbeResult,
} from "@gaep/agent-sdk"
import { platformReadinessSnapshotSchema, type AdapterCapabilities, type ProductExportBundle } from "@gaep/contracts"

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

  it("negotiates protocol v3 while retaining safe omitted-version v1 behavior", async () => {
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
    await expect(host.dispatch({ jsonrpc: "2.0", id: 3, protocolVersion: 4, method: "ping", params: {} })).rejects.toMatchObject({
      kind: "UNSUPPORTED_PROTOCOL_VERSION",
    })
    await expect(host.dispatch({ jsonrpc: "2.0", id: 31, protocolVersion: 3, method: "ping", params: {} })).resolves.toMatchObject({
      negotiatedProtocolVersion: 3,
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
    await expect(host.dispatch({ jsonrpc: "2.0", id: 6, method: "platformReadiness", params: {} }))
      .rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    // GAEP-P0-CS02: every v3 method is rejected below protocol 3 (INV-18).
    for (const [index, method] of [
      "providerCatalog", "readProviderSelection", "startReadOnlyAnalysis",
      "readAnalysisRun", "listAnalysisRuns", "cancelAnalysisRun", "dashboardProjection",
    ].entries()) {
      await expect(host.dispatch({
        jsonrpc: "2.0", id: 700 + index, protocolVersion: 2, method,
        params: method === "readAnalysisRun" || method === "cancelAnalysisRun"
          ? { analysisRunId: "44444444-4444-4444-8444-444444444444" }
          : method === "startReadOnlyAnalysis"
            ? { objective: "check", contextPackIds: ["44444444-4444-4444-8444-444444444444"], idempotencyKey: "55555555-5555-4555-8555-555555555555" }
            : {},
      })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    }
  })

  it("serves the v3 provider catalog and dashboard projection on an uninitialized workspace", async () => {
    const catalog = await host.dispatch({ jsonrpc: "2.0", id: 1, protocolVersion: 3, method: "providerCatalog", params: {} }) as {
      providers: Array<{ adapterId: string; authReadiness: string; detected: boolean }>
    }
    expect(catalog.providers.map((provider) => provider.adapterId).sort())
      .toEqual(["gaep.claude-code-cli", "gaep.codex-cli"])
    // Detection never implies authentication (INV-07).
    for (const provider of catalog.providers) expect(provider.authReadiness).toBe("auth-unverified")

    const projection = await host.dispatch({ jsonrpc: "2.0", id: 2, protocolVersion: 3, method: "dashboardProjection", params: {} }) as {
      workspaceState: string
      workspaceMessage: string
      selection: unknown
      latestRun: unknown
      hostMatrix: Array<{ host: string; conformanceState: string }>
    }
    // INV-16: friendly prerequisite state, never a raw ENOENT.
    expect(projection.workspaceState).toBe("product-uninitialized")
    expect(projection.workspaceMessage).toContain("Initialize Product first")
    expect(projection.selection).toBeNull()
    expect(projection.latestRun).toBeNull()
    expect(projection.hostMatrix.map((row) => row.host)).toEqual(["vscode", "visual-studio", "rider", "kiro"])
    expect(projection.hostMatrix.find((row) => row.host === "vscode")?.conformanceState).toBe("not-run")
  })

  it("refuses to start an analysis before a provider/model selection exists", async () => {
    await expect(host.dispatch({
      jsonrpc: "2.0", id: 1, protocolVersion: 3, method: "startReadOnlyAnalysis",
      params: {
        objective: "Summarize the governed context",
        contextPackIds: ["44444444-4444-4444-8444-444444444444"],
        idempotencyKey: "55555555-5555-4555-8555-555555555555",
      },
    })).rejects.toMatchObject({ kind: "NO_SELECTION" })
  })

  it("returns a schema-valid Base Platform Readiness Snapshot over protocol v2", async () => {
    const snapshot = platformReadinessSnapshotSchema.parse(
      await host.dispatch({ jsonrpc: "2.0", id: 1, protocolVersion: 2, method: "platformReadiness", params: {} }),
    )
    expect(snapshot.providers.map((provider) => provider.adapterId).sort()).toEqual([
      "gaep.claude-code-cli",
      "gaep.codex-cli",
    ])
    expect(snapshot.hostMatrix.map((row) => ({ host: row.host, state: row.state, source: row.source }))).toEqual([
      { host: "vscode", state: "not-run", source: "base-default" },
      { host: "visual-studio", state: "pending-environment", source: "base-default" },
      { host: "rider", state: "pending-environment", source: "base-default" },
      { host: "kiro", state: "pending-environment", source: "base-default" },
    ])
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
