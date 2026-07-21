import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { AdapterCapabilities } from "@gaep/contracts"

import { EngineHost } from "./host.js"

function codexCapabilities(): AdapterCapabilities {
  return {
    adapterId: "gaep.codex-cli",
    adapterVersion: "0.1.0",
    agentId: "codex-cli",
    agentLabel: "Codex",
    runtimeVersion: "0.135.0",
    executablePath: process.execPath,
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

describe("engine host protocol", () => {
  let workspace: string
  let host: EngineHost

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-host-"))
    host = new EngineHost(workspace)
  })

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  it("responds to a versioned JSON-RPC ping", async () => {
    await expect(host.dispatch({ jsonrpc: "2.0", id: 1, method: "ping", params: {} })).resolves.toEqual({
      engineVersion: "0.1.0",
      protocolVersion: 1,
    })
  })

  it("rejects unknown methods before dispatch", async () => {
    await expect(host.dispatch({ jsonrpc: "2.0", id: 1, method: "eraseEverything", params: {} })).rejects.toMatchObject({
      code: -32_601,
      kind: "METHOD_NOT_FOUND",
    })
  })

  it("returns structured parse and typed-parameter failures", async () => {
    let parseError: unknown
    try {
      EngineHost.parse("not-json")
    } catch (error) {
      parseError = error
    }
    expect(parseError).toMatchObject({ code: -32_700, kind: "PARSE_ERROR" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: 2,
      method: "createProduct",
      params: { product: { name: "x" } },
    })).rejects.toMatchObject({ code: -32_602, kind: "INVALID_PARAMS" })
  })

  it("owns capability snapshots and carries a safe selection through invocation preparation", async () => {
    const observed = codexCapabilities()
    const adapter = host.engine.adapters.get(observed.adapterId)
    if (!adapter) throw new Error("Codex adapter is not registered")
    vi.spyOn(adapter, "probe").mockResolvedValue(observed)
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
          desiredOutcome: "Only host-observed executable capabilities reach execution.",
          successSignals: ["Tampered executable ignored"],
          firstWorkflow: "Probe, select, charter, and prepare a run.",
          exclusions: [],
          profile: "software",
        },
      },
    }) as { id: string }
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
    expect(product.id).toBeTruthy()
    await host.engine.updateInitiativeState(
      initiative.id,
      "active",
      "Activate the host integration-test Initiative",
      "gaep.host-test",
    )
    await host.dispatch({ jsonrpc: "2.0", id: 3, method: "probeAgents", params: {} })
    const selected = await host.dispatch({
      jsonrpc: "2.0",
      id: 4,
      method: "selectAgent",
      params: {
        capabilities: { ...observed, executablePath: "/tmp/caller-controlled" },
        modelId: "gpt-test",
        settings: { sandbox: "read-only", approvalPolicy: "fail-closed-noninteractive" },
      },
    }) as { runtimeExecutable: string }
    expect(selected.runtimeExecutable).toBe(process.execPath)

    const charter = await host.dispatch({
      jsonrpc: "2.0",
      id: 5,
      method: "createCharter",
      params: {
        charter: {
          initiativeId: initiative.id,
          objective: "Prepare a safe non-interactive Codex invocation",
          permissions: [
            { capability: "read-workspace", mode: "allow", scope: [workspace] },
            { capability: "modify-workspace", mode: "deny", scope: [workspace] },
            { capability: "run-local-commands", mode: "allow", scope: [workspace] },
            { capability: "network-access", mode: "deny", scope: [] },
            { capability: "commit", mode: "deny", scope: [workspace] },
            { capability: "push", mode: "deny", scope: [] },
            { capability: "deploy", mode: "deny", scope: [] },
            { capability: "publish", mode: "deny", scope: [] },
            { capability: "external-communication", mode: "deny", scope: [] },
            { capability: "destructive-delete", mode: "deny", scope: [workspace] },
          ],
          expectedEffects: ["observe"],
          forbiddenActions: ["Do not publish"],
          stopConditions: ["Stop when scope changes"],
          requiredEvidence: ["Invocation arguments"],
        },
      },
    }) as { id: string }
    await host.dispatch({
      jsonrpc: "2.0",
      id: 6,
      method: "confirmCharter",
      params: { charterId: charter.id },
    })
    const prepared = await host.dispatch({
      jsonrpc: "2.0",
      id: 7,
      method: "prepareRun",
      params: { charterId: charter.id },
    }) as { invocation: { args: string[]; stdin?: string } }

    const execIndex = prepared.invocation.args.indexOf("exec")
    expect(execIndex).toBeGreaterThan(prepared.invocation.args.indexOf("--strict-config"))
    expect(prepared.invocation.args.slice(0, execIndex)).toEqual(expect.arrayContaining(["-a", "never"]))
    expect(prepared.invocation.args.at(-1)).toBe("-")
    expect(prepared.invocation.stdin).toContain("Prepare a safe non-interactive Codex invocation")
  })
})
