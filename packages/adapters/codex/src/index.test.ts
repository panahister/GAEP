import { beforeEach, describe, expect, it } from "vitest"

import type { AdapterCapabilities, AgentSelection, ExecutionCharter, ToolPermission } from "@gaep/contracts"
import { capabilityDigest, type AdapterRuntimeBinding, type CommandResult } from "@gaep/agent-sdk"

import { CodexAdapter } from "./index.js"

function selection(sandbox: string = "read-only"): AgentSelection {
  return {
    schemaVersion: 2,
    adapterId: "gaep.codex-cli",
    agentId: "codex-cli",
    modelId: "model; touch /tmp/not-executed",
    modelTruthClass: "configured",
    modelAlias: null,
    settings: { sandbox, approvalPolicy: "fail-closed-noninteractive" },
    selectedAt: "2026-07-21T00:00:00.000Z",
    capabilityDigest: `sha256:${"0".repeat(64)}`,
  }
}

function result(stdout: string, exitCode = 0): CommandResult {
  return { exitCode, stdout, stderr: "", timedOut: false, outputExceeded: false }
}

async function verifiedRunner(_executable: string, args: string[]): Promise<CommandResult> {
  if (args[0] === "--version") return result("codex-cli 0.135.0")
  if (args.length === 1 && args[0] === "--help") {
    return result("app-server [experimental] --strict-config --model --sandbox --cd --ask-for-approval")
  }
  if (args[0] === "app-server" && args[1] === "--help") {
    return result("[experimental] app-server --strict-config --listen stdio://")
  }
  if (args[0] === "exec" && args[1] === "--help") {
    return result("exec --ignore-user-config --ignore-rules --color --json")
  }
  if (args[0] === "exec" && args[1] === "resume" && args[2] === "--help") {
    return result("resume --strict-config --model --ignore-user-config --ignore-rules --json")
  }
  if (args[0] === "debug" && args[1] === "models") return result('{"models":[]}')
  return result("", 1)
}

function charter(
  modify: ToolPermission["mode"] = "deny",
  commands: ToolPermission["mode"] = "allow",
  read: ToolPermission["mode"] = "allow",
  expectedEffects: ExecutionCharter["expectedEffects"] = ["observe"],
): ExecutionCharter {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    permissions: [
      { capability: "read-workspace", mode: read, scope: ["."] },
      { capability: "modify-workspace", mode: modify, scope: ["."] },
      { capability: "run-local-commands", mode: commands, scope: ["."] },
      { capability: "network-access", mode: "deny", scope: [] },
    ],
    expectedEffects,
  } as ExecutionCharter
}

function sandboxArgument(args: string[]): string | undefined {
  return args[args.indexOf("-s") + 1]
}

describe("Codex adapter", () => {
  let adapter: CodexAdapter
  let observed: AdapterCapabilities
  let binding: AdapterRuntimeBinding

  beforeEach(async () => {
    adapter = new CodexAdapter(process.execPath, verifiedRunner)
    const probe = await adapter.probe({ timeoutMs: 1_000, refreshModels: false })
    observed = probe.capabilities
    binding = probe.runtimeBinding
  })

  it("advertises the managed app-server transport separately from the direct read-only fallback", async () => {
    expect(observed.detected).toBe(true)
    expect(observed).not.toHaveProperty("executablePath")
    expect(binding).toMatchObject({ kind: "executable", executablePath: process.execPath })
    expect(observed.executionInterface).toBe("stdio-rpc")
    expect(observed.interfaceMaturity).toBe("experimental")
    expect(observed.supportsCancel).toBe(true)
    expect(observed.supportsResume).toBe(true)
    expect(observed.supportsCheckpoints).toBe(false)
    expect(observed.supportsToolSelection).toBe(true)
    expect(observed.settings.some((setting) => setting.key === "sandbox" || setting.key === "approvalPolicy")).toBe(false)
    expect(observed.limitations.join(" ")).toContain("legacy direct codex exec JSONL builder")
    expect(observed.limitations.join(" ")).toContain("authentication")
  })

  it("fails closed when the managed app-server help contract is incomplete", async () => {
    const incompleteRunner = async (_executable: string, args: string[]): Promise<CommandResult> => {
      if (args[0] === "--version") return result("codex-cli 0.135.0")
      if (args.length === 1 && args[0] === "--help") {
        return result("app-server --strict-config --model --sandbox --cd --ask-for-approval")
      }
      if (args[0] === "app-server") return result("app-server --strict-config")
      if (args[0] === "exec") return result("exec --ignore-user-config --ignore-rules --color --json")
      return result("", 1)
    }
    const incomplete = new CodexAdapter(process.execPath, incompleteRunner)
    const probe = await incomplete.probe({ refreshModels: false })

    expect(probe.capabilities.detected).toBe(true)
    expect(probe.capabilities.executionInterface).toBe("unavailable")
    expect(probe.capabilities.limitations.join(" ")).toContain("does not advertise required managed options")
    expect(probe.runtimeBinding).toMatchObject({ kind: "unavailable", reason: "Codex managed app-server interface verification failed" })
    expect(incomplete.validateSelection({
      ...selection(),
      settings: {},
      capabilityDigest: capabilityDigest(probe.capabilities),
    }, probe.capabilities)).toContain("Managed Codex app-server execution interface is unavailable")
  })

  it("keeps managed detection available while separately disabling an unverified direct fallback", async () => {
    const managedOnlyRunner = async (executable: string, args: string[]): Promise<CommandResult> => {
      if (args[0] === "exec") return result("exec help without required isolation options")
      return verifiedRunner(executable, args)
    }
    const managedOnly = new CodexAdapter(process.execPath, managedOnlyRunner)
    const probe = await managedOnly.probe({ refreshModels: false })

    expect(probe.capabilities.detected).toBe(true)
    expect(probe.runtimeBinding.kind).toBe("executable")
    expect(probe.capabilities.limitations.join(" ")).toContain("direct read-only fallback is disabled")
    expect(() => managedOnly.buildInvocation(selection(), charter(), "/workspace", "inspect", probe.runtimeBinding)).toThrow(
      "requires a fresh probe",
    )
  })

  it("sanitizes, bounds, and deduplicates the executable-supplied model catalog", async () => {
    const catalogRunner = async (executable: string, args: string[]): Promise<CommandResult> => {
      if (args[0] === "debug") {
        return result(JSON.stringify({ models: [
          {
            slug: "safe-model",
            display_name: "Safe model",
            description: "Bundled candidate",
            supported_reasoning_levels: [{ effort: "low" }, { effort: "high" }, { effort: "high" }],
            input_modalities: ["text", "text"],
          },
          { slug: "safe-model", display_name: "Duplicate", supported_reasoning_levels: [] },
          { slug: "hidden-model", display_name: "Hidden", visibility: "hide" },
          { slug: "poisoned-model", display_name: "Poisoned", description: "/Users/example/private" },
          { slug: 42, display_name: "Invalid" },
        ] }))
      }
      return verifiedRunner(executable, args)
    }
    const probe = await new CodexAdapter(process.execPath, catalogRunner).probe({ refreshModels: true })

    expect(probe.capabilities.supportsModelDiscovery).toBe(true)
    expect(probe.capabilities.models).toEqual([expect.objectContaining({
      id: "safe-model",
      reasoningOptions: ["low", "high"],
      inputModalities: ["text"],
      truthClass: "observed",
      alias: false,
    })])
    expect(probe.capabilities.settings.map((setting) => setting.key)).toEqual(["reasoningEffort"])
  })

  it("refuses the direct fallback until the exact executable is freshly interface-probed", () => {
    expect(() => new CodexAdapter().buildInvocation(
      selection(),
      charter(),
      "/workspace",
      "inspect safely",
      binding,
    )).toThrow("requires a fresh probe")
  })

  it("orders root flags before exec and transports the prompt only over stdin", () => {
    const invocation = adapter.buildInvocation(
      selection(),
      charter(),
      "/workspace",
      "inspect safely",
      binding,
    )

    expect(invocation.executable).toBe(process.execPath)
    expect(invocation.args).toContain("model; touch /tmp/not-executed")
    expect(invocation.args.at(-1)).toBe("-")
    expect(invocation.stdin).toBe("inspect safely")
    expect(sandboxArgument(invocation.args)).toBe("read-only")
    expect(invocation.args.indexOf("exec")).toBeGreaterThan(invocation.args.indexOf("--strict-config"))
    expect(invocation.args.indexOf("exec")).toBeGreaterThan(invocation.args.indexOf("-C"))
    expect(invocation.args.indexOf("exec")).toBeGreaterThan(invocation.args.indexOf("-m"))
    expect(invocation.args.indexOf("exec")).toBeGreaterThan(invocation.args.indexOf("-s"))
    expect(invocation.args.indexOf("exec")).toBeGreaterThan(invocation.args.indexOf("-a"))
    expect(invocation.args).not.toContain("inspect safely")
    expect(invocation.warnings.join(" ")).toContain("current CLI stop-line permits analysis only")
  })

  it.each(["ask", "deny"] as const)("downgrades modify-workspace=%s to read-only", (modify) => {
    const invocation = adapter.buildInvocation(
      selection(),
      charter(modify),
      "/workspace",
      "inspect safely",
      binding,
    )

    expect(sandboxArgument(invocation.args)).toBe("read-only")
    expect(invocation.warnings.join(" ")).toContain("Effective Codex sandbox is read-only")
  })

  it.each([
    ["read-workspace", "ask"],
    ["read-workspace", "deny"],
    ["run-local-commands", "ask"],
    ["run-local-commands", "deny"],
  ] as const)("rejects required %s=%s instead of weakening the Charter", (capability, mode) => {
    const constrained = capability === "read-workspace"
      ? charter("deny", "allow", mode)
      : charter("deny", mode, "allow")
    expect(() => adapter.buildInvocation(
      selection(),
      constrained,
      "/workspace",
      "inspect safely",
      binding,
    )).toThrow(`${capability}=allow exactly at the workspace root`)
  })

  it("rejects any selected workspace-write mode", () => {
    expect(() => adapter.buildInvocation(
      selection("workspace-write"),
      charter(),
      "/workspace",
      "inspect safely",
      binding,
    )).toThrow("requires read-only sandbox")
  })

  it("rejects modification authority instead of treating the read-only sandbox as an effect mediator", () => {
    expect(() => adapter.buildInvocation(
      selection(),
      charter("allow"),
      "/workspace",
      "modify",
      binding,
    )).toThrow("cannot enforce modify-workspace=allow")
  })

  it.each(["provisional", "reversible-change"] as const)("rejects mutation effect %s", (effect) => {
    expect(() => adapter.buildInvocation(
      selection(),
      charter("deny", "allow", "allow", [effect]),
      "/workspace",
      "mutate",
      binding,
    )).toThrow(`cannot enforce mutation effects without an isolated staging and effect mediator: ${effect}`)
  })

  it("rejects settings and Charter effects that the CLI cannot enforce", () => {
    expect(() => adapter.buildInvocation(
      selection("danger-full-access"),
      charter(),
      "/workspace",
      "do not expose me",
      binding,
    )).toThrow("requires read-only sandbox")

    const networkCharter = charter()
    networkCharter.permissions = networkCharter.permissions.map((permission) =>
      permission.capability === "network-access" ? { ...permission, mode: "ask" } : permission,
    )
    expect(() => adapter.buildInvocation(selection(), networkCharter, "/workspace", "network", binding)).toThrow(
      "network-access=ask",
    )

    const commitCharter = charter()
    commitCharter.permissions.push({ capability: "commit", mode: "allow", scope: ["."] })
    expect(() => adapter.buildInvocation(selection(), commitCharter, "/workspace", "commit", binding)).toThrow(
      "commit=allow",
    )
    expect(() => adapter.buildInvocation(
      selection(),
      charter("deny", "allow", "allow", ["external-effect"]),
      "/workspace",
      "external",
      binding,
    )).toThrow("external-effect")
  })

  it("recompiles the Charter boundary when resuming", () => {
    const invocation = adapter.buildResumeInvocation!(
      selection(),
      charter("ask"),
      "/workspace",
      "session-id",
      "continue safely",
      binding,
    )
    expect(sandboxArgument(invocation.args)).toBe("read-only")
    expect(invocation.args).toEqual(expect.arrayContaining(["exec", "resume", "session-id", "-"]))
    expect(invocation.stdin).toBe("continue safely")
  })
})
