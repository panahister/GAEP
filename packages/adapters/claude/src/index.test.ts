import { describe, expect, it } from "vitest"

import type { AdapterCapabilities, AgentSelection, ExecutionCharter } from "@gaep/contracts"
import { capabilityDigest, type AdapterRuntimeBinding } from "@gaep/agent-sdk"

import { ClaudeAdapter } from "./index.js"

const stopLine = "Effectful direct Claude Code execution is unavailable; GAEP supports only the managed tool-free, context-only stream-JSON runtime"

function capabilities(): AdapterCapabilities {
  return {
    schemaVersion: 1,
    adapterId: "gaep.claude-code-cli",
    adapterVersion: "0.1.0",
    agentId: "claude-code-cli",
    agentLabel: "Claude Code",
    runtimeVersion: "2.1.153",
    detected: true,
    executionInterface: "cli-stream-json",
    interfaceMaturity: "stable",
    supportsResume: false,
    supportsCancel: true,
    supportsCheckpoints: false,
    supportsModelDiscovery: false,
    supportsToolSelection: false,
    settings: [
      {
        key: "effort",
        label: "Effort",
        description: "Reasoning effort",
        kind: "select",
        required: false,
        sensitive: false,
        options: ["low", "medium", "high", "xhigh", "max"].map((value) => ({ value, label: value })),
        truthClass: "provider-declared",
      },
      {
        key: "maxBudgetUsd",
        label: "Maximum budget",
        description: "Maximum provider budget",
        kind: "number",
        required: false,
        sensitive: false,
        minimum: 0.01,
        maximum: 100_000,
        truthClass: "configured",
      },
    ],
    models: [{
      id: "sonnet",
      label: "Sonnet alias",
      reasoningOptions: [],
      inputModalities: ["text"],
      truthClass: "provider-declared",
      alias: true,
    }],
    limitations: [stopLine],
    observedAt: "2026-07-21T00:00:00.000Z",
  }
}

function selection(settings: AgentSelection["settings"]): AgentSelection {
  const observed = capabilities()
  return {
    schemaVersion: 2,
    adapterId: observed.adapterId,
    agentId: observed.agentId,
    modelId: "sonnet",
    modelTruthClass: "provider-declared",
    modelAlias: true,
    settings,
    selectedAt: "2026-07-21T00:00:00.000Z",
    capabilityDigest: capabilityDigest(observed),
  }
}

function runtimeBinding(): AdapterRuntimeBinding {
  return {
    scope: "machine-local",
    kind: "unavailable",
    adapterId: "gaep.claude-code-cli",
    agentId: "claude-code-cli",
    reason: "Claude execution stop-line",
  }
}

function charter(expectedEffects: ExecutionCharter["expectedEffects"]): ExecutionCharter {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    permissions: [
      { capability: "read-workspace", mode: "allow", scope: ["."] },
      { capability: "modify-workspace", mode: "allow", scope: ["."] },
      { capability: "run-local-commands", mode: "allow", scope: ["."] },
      { capability: "network-access", mode: "deny", scope: [] },
    ],
    expectedEffects,
  } as ExecutionCharter
}

describe("Claude Code managed context-only capability", () => {
  it("detects a bounded stream-json runtime while keeping effectful execution unavailable", async () => {
    const { capabilities: observed, runtimeBinding: binding } = await new ClaudeAdapter(process.execPath).probe({ timeoutMs: 1_000, refreshModels: false })

    expect(observed.detected).toBe(true)
    expect(observed).not.toHaveProperty("executablePath")
    expect(binding).toMatchObject({ kind: "executable", executablePath: process.execPath })
    expect(observed.executionInterface).toBe("cli-stream-json")
    expect(observed.interfaceMaturity).toBe("stable")
    expect(observed.supportsResume).toBe(false)
    expect(observed.supportsCancel).toBe(true)
    expect(observed.supportsToolSelection).toBe(false)
    expect(observed.limitations.join(" ")).toContain(stopLine)
  })

  it("accepts only settings honored by the managed context runtime", () => {
    const observed = capabilities()
    expect(new ClaudeAdapter().validateSelection(
      selection({ effort: "high", maxBudgetUsd: 2 }),
      observed,
    )).toEqual([])
  })

  it.each([
    ["low", ["observe"]],
    ["high", ["provisional", "reversible-change"]],
  ] as const)("rejects direct invocation effort=%s effects=%j before launch", (effort, effects) => {
    expect(() => new ClaudeAdapter().buildInvocation(
      selection({ effort }),
      charter([...effects]),
      "/workspace",
      "must never reach provider stdin",
      runtimeBinding(),
    )).toThrow(stopLine)
  })

  it("rejects resume before reconstructing or launching provider state", () => {
    expect(() => new ClaudeAdapter().buildResumeInvocation!(
      selection({ effort: "high" }),
      charter(["observe"]),
      "/workspace",
      "provider-session",
      "must never reach provider stdin",
      runtimeBinding(),
    )).toThrow(stopLine)
  })

  it("rejects unsafe, unknown, and unhonored effectful settings", () => {
    const adapter = new ClaudeAdapter()
    const observed = capabilities()
    const unsafe = selection({
      effort: "ultra",
      maxBudgetUsd: 0,
      allowedTools: ["Bash"],
      hiddenSetting: true,
    })

    expect(adapter.validateSelection(unsafe, observed)).toEqual(expect.arrayContaining([
      "Unsupported value for agent setting effort",
      "Agent setting maxBudgetUsd must be at least 0.01",
      "Unsupported agent setting: allowedTools",
      "Unsupported agent setting: hiddenSetting",
      "Unsupported managed Claude effort",
      "Managed Claude maximum budget must be greater than zero and at most 100000 USD",
    ]))
  })
})
