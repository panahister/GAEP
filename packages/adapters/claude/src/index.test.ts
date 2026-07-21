import { describe, expect, it } from "vitest"

import type { AdapterCapabilities, AgentSelection, ExecutionCharter } from "@gaep/contracts"
import { capabilityDigest, type AdapterRuntimeBinding } from "@gaep/agent-sdk"

import { ClaudeAdapter } from "./index.js"

const stopLine = "Claude Code CLI execution is unavailable until GAEP can enforce an outer workspace, process, network, and per-call effect boundary"

function capabilities(): AdapterCapabilities {
  return {
    schemaVersion: 1,
    adapterId: "gaep.claude-code-cli",
    adapterVersion: "0.1.0",
    agentId: "claude-code-cli",
    agentLabel: "Claude Code",
    runtimeVersion: "2.1.153",
    detected: true,
    executionInterface: "unavailable",
    interfaceMaturity: "unknown",
    supportsResume: false,
    supportsCancel: false,
    supportsCheckpoints: false,
    supportsModelDiscovery: false,
    supportsToolSelection: true,
    settings: [
      {
        key: "permissionMode",
        label: "Permission mode",
        description: "Native permission mode",
        kind: "select",
        required: true,
        sensitive: false,
        defaultValue: "default",
        options: ["default", "plan"].map((value) => ({ value, label: value })),
        truthClass: "provider-declared",
      },
      {
        key: "allowedTools",
        label: "Allowed tools",
        description: "Allowed tools",
        kind: "string-list",
        required: false,
        sensitive: false,
        truthClass: "configured",
      },
      {
        key: "disallowedTools",
        label: "Denied tools",
        description: "Denied tools",
        kind: "string-list",
        required: false,
        sensitive: false,
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

describe("Claude Code adapter stop-line", () => {
  it("detects an executable for review but exposes no execution interface", async () => {
    const { capabilities: observed, runtimeBinding: binding } = await new ClaudeAdapter(process.execPath).probe({ timeoutMs: 1_000, refreshModels: false })

    expect(observed.detected).toBe(true)
    expect(observed).not.toHaveProperty("executablePath")
    expect(binding).toMatchObject({ kind: "executable", executablePath: process.execPath })
    expect(observed.executionInterface).toBe("unavailable")
    expect(observed.interfaceMaturity).toBe("unknown")
    expect(observed.supportsResume).toBe(false)
    expect(observed.supportsCancel).toBe(false)
    expect(observed.limitations.join(" ")).toContain(stopLine)
  })

  it("keeps unavailable Claude capabilities selectable for explicit capability review", () => {
    const observed = capabilities()
    expect(new ClaudeAdapter().validateSelection(
      selection({ permissionMode: "plan", allowedTools: [] }),
      observed,
    )).toEqual([])
  })

  it.each([
    ["plan", ["observe"]],
    ["default", ["provisional", "reversible-change"]],
  ] as const)("rejects new invocation mode=%s effects=%j before launch", (permissionMode, effects) => {
    expect(() => new ClaudeAdapter().buildInvocation(
      selection({ permissionMode }),
      charter([...effects]),
      "/workspace",
      "must never reach provider stdin",
      runtimeBinding(),
    )).toThrow(stopLine)
  })

  it("rejects resume before reconstructing or launching provider state", () => {
    expect(() => new ClaudeAdapter().buildResumeInvocation!(
      selection({ permissionMode: "plan" }),
      charter(["observe"]),
      "/workspace",
      "provider-session",
      "must never reach provider stdin",
      runtimeBinding(),
    )).toThrow(stopLine)
  })

  it("still rejects unsafe, unknown, and contradictory review settings", () => {
    const adapter = new ClaudeAdapter()
    const observed = capabilities()
    const unsafe = selection({
      permissionMode: "bypassPermissions",
      allowedTools: ["Bash"],
      disallowedTools: ["Bash"],
      hiddenSetting: true,
    })

    expect(adapter.validateSelection(unsafe, observed)).toEqual(expect.arrayContaining([
      "Unsupported value for agent setting permissionMode",
      "Unsupported agent setting: hiddenSetting",
      "Unsupported Claude Code permission mode",
      "Claude tools cannot be both allowed and denied: Bash",
    ]))
  })
})
