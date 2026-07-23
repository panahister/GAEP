import { describe, expect, it } from "vitest"

import type { AgentSelection, ExecutionCharter, ToolPermission } from "@gaep/contracts"
import type { AdapterRuntimeBinding } from "@gaep/agent-sdk"

import { CodexAdapter, parseModelCatalog } from "./index.js"

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

function runtimeBinding(): AdapterRuntimeBinding {
  return {
    scope: "machine-local",
    kind: "executable",
    adapterId: "gaep.codex-cli",
    agentId: "codex-cli",
    executablePath: "/opt/codex/bin/codex",
    executableFingerprint: {
      requested: "codex",
      canonicalPath: "/opt/codex/bin/codex",
      digest: `sha256:${"1".repeat(64)}`,
      size: 1,
      modifiedAtMs: 1,
    },
  }
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
  it("canonicalizes discovered model, reasoning, and modality ordering", () => {
    const first = {
      models: [
        {
          slug: "z-model",
          display_name: "Z",
          supported_reasoning_levels: [{ effort: "high" }, { effort: "low" }, { effort: "high" }],
          input_modalities: ["image", "text", "image"],
        },
        { slug: "a-model", display_name: "A", supported_reasoning_levels: [{ effort: "medium" }] },
      ],
    }
    const second = {
      models: [
        { slug: "a-model", display_name: "A", supported_reasoning_levels: [{ effort: "medium" }] },
        {
          slug: "z-model",
          display_name: "Z",
          supported_reasoning_levels: [{ effort: "low" }, { effort: "high" }],
          input_modalities: ["text", "image"],
        },
      ],
    }

    expect(parseModelCatalog(JSON.stringify(first))).toEqual(parseModelCatalog(JSON.stringify(second)))
    expect(parseModelCatalog(JSON.stringify(first)).map((model) => model.id)).toEqual(["a-model", "z-model"])
  })

  it("advertises the managed app-server transport separately from the direct read-only fallback", async () => {
    const { capabilities: observed, runtimeBinding: binding } = await new CodexAdapter(process.execPath).probe({ timeoutMs: 1_000, refreshModels: false })

    expect(observed.detected).toBe(true)
    expect(observed).not.toHaveProperty("executablePath")
    expect(binding).toMatchObject({ kind: "executable", executablePath: process.execPath })
    expect(observed.executionInterface).toBe("stdio-rpc")
    expect(observed.supportsCancel).toBe(true)
    expect(observed.supportsResume).toBe(true)
    expect(observed.supportsCheckpoints).toBe(false)
    expect(observed.supportsToolSelection).toBe(true)
    expect(observed.settings.some((setting) => setting.key === "sandbox" || setting.key === "approvalPolicy")).toBe(false)
    expect(observed.limitations.join(" ")).toContain("legacy direct codex exec JSONL builder")
  })

  it("orders root flags before exec and transports the prompt only over stdin", () => {
    const invocation = new CodexAdapter().buildInvocation(
      selection(),
      charter(),
      "/workspace",
      "inspect safely",
      runtimeBinding(),
    )

    expect(invocation.executable).toBe("/opt/codex/bin/codex")
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
    const invocation = new CodexAdapter().buildInvocation(
      selection(),
      charter(modify),
      "/workspace",
      "inspect safely",
      runtimeBinding(),
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
    expect(() => new CodexAdapter().buildInvocation(
      selection(),
      constrained,
      "/workspace",
      "inspect safely",
      runtimeBinding(),
    )).toThrow(`${capability}=allow exactly at the workspace root`)
  })

  it("rejects any selected workspace-write mode", () => {
    expect(() => new CodexAdapter().buildInvocation(
      selection("workspace-write"),
      charter(),
      "/workspace",
      "inspect safely",
      runtimeBinding(),
    )).toThrow("requires read-only sandbox")
  })

  it("rejects modification authority instead of treating the read-only sandbox as an effect mediator", () => {
    expect(() => new CodexAdapter().buildInvocation(
      selection(),
      charter("allow"),
      "/workspace",
      "modify",
      runtimeBinding(),
    )).toThrow("cannot enforce modify-workspace=allow")
  })

  it.each(["provisional", "reversible-change"] as const)("rejects mutation effect %s", (effect) => {
    expect(() => new CodexAdapter().buildInvocation(
      selection(),
      charter("deny", "allow", "allow", [effect]),
      "/workspace",
      "mutate",
      runtimeBinding(),
    )).toThrow(`cannot enforce mutation effects without an isolated staging and effect mediator: ${effect}`)
  })

  it("rejects settings and Charter effects that the CLI cannot enforce", () => {
    const adapter = new CodexAdapter()
    expect(() => adapter.buildInvocation(
      selection("danger-full-access"),
      charter(),
      "/workspace",
      "do not expose me",
      runtimeBinding(),
    )).toThrow("requires read-only sandbox")

    const networkCharter = charter()
    networkCharter.permissions = networkCharter.permissions.map((permission) =>
      permission.capability === "network-access" ? { ...permission, mode: "ask" } : permission,
    )
    expect(() => adapter.buildInvocation(selection(), networkCharter, "/workspace", "network", runtimeBinding())).toThrow(
      "network-access=ask",
    )

    const commitCharter = charter()
    commitCharter.permissions.push({ capability: "commit", mode: "allow", scope: ["."] })
    expect(() => adapter.buildInvocation(selection(), commitCharter, "/workspace", "commit", runtimeBinding())).toThrow(
      "commit=allow",
    )
    expect(() => adapter.buildInvocation(
      selection(),
      charter("deny", "allow", "allow", ["external-effect"]),
      "/workspace",
      "external",
      runtimeBinding(),
    )).toThrow("external-effect")
  })

  it("recompiles the Charter boundary when resuming", () => {
    const invocation = new CodexAdapter().buildResumeInvocation!(
      selection(),
      charter("ask"),
      "/workspace",
      "session-id",
      "continue safely",
      runtimeBinding(),
    )
    expect(sandboxArgument(invocation.args)).toBe("read-only")
    expect(invocation.args).toEqual(expect.arrayContaining(["exec", "resume", "session-id", "-"]))
    expect(invocation.stdin).toBe("continue safely")
  })
})
