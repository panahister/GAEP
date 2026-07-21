import { describe, expect, it } from "vitest"

import type { AgentSelection, ExecutionCharter, ToolPermission } from "@gaep/contracts"

import { CodexAdapter } from "./index.js"

function selection(sandbox: string = "read-only"): AgentSelection {
  return {
    adapterId: "gaep.codex-cli",
    agentId: "codex-cli",
    runtimeExecutable: "/opt/codex/bin/codex",
    modelId: "model; touch /tmp/not-executed",
    modelTruthClass: "configured",
    modelAlias: null,
    settings: { sandbox, approvalPolicy: "fail-closed-noninteractive" },
    selectedAt: "2026-07-21T00:00:00.000Z",
    capabilityDigest: `sha256:${"0".repeat(64)}`,
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
      { capability: "read-workspace", mode: read, scope: ["/workspace"] },
      { capability: "modify-workspace", mode: modify, scope: ["/workspace"] },
      { capability: "run-local-commands", mode: commands, scope: ["/workspace"] },
      { capability: "network-access", mode: "deny", scope: [] },
    ],
    expectedEffects,
  } as ExecutionCharter
}

function sandboxArgument(args: string[]): string | undefined {
  return args[args.indexOf("-s") + 1]
}

describe("Codex adapter", () => {
  it("advertises an analysis-only execution stop-line", async () => {
    const observed = await new CodexAdapter(process.execPath).probe({ timeoutMs: 1_000, refreshModels: false })
    const sandbox = observed.settings.find((setting) => setting.key === "sandbox")

    expect(observed.detected).toBe(true)
    expect(sandbox?.defaultValue).toBe("read-only")
    expect(sandbox?.options?.map((option) => option.value)).toEqual(["read-only"])
    expect(observed.limitations.join(" ")).toContain("read-only analysis")
  })

  it("orders root flags before exec and transports the prompt only over stdin", () => {
    const invocation = new CodexAdapter().buildInvocation(
      selection(),
      charter(),
      "/workspace",
      "inspect safely",
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
    )).toThrow(`${capability}=allow exactly at the workspace root`)
  })

  it("rejects any selected workspace-write mode", () => {
    expect(() => new CodexAdapter().buildInvocation(
      selection("workspace-write"),
      charter(),
      "/workspace",
      "inspect safely",
    )).toThrow("requires read-only sandbox")
  })

  it("rejects modification authority instead of treating the read-only sandbox as an effect mediator", () => {
    expect(() => new CodexAdapter().buildInvocation(
      selection(),
      charter("allow"),
      "/workspace",
      "modify",
    )).toThrow("cannot enforce modify-workspace=allow")
  })

  it.each(["provisional", "reversible-change"] as const)("rejects mutation effect %s", (effect) => {
    expect(() => new CodexAdapter().buildInvocation(
      selection(),
      charter("deny", "allow", "allow", [effect]),
      "/workspace",
      "mutate",
    )).toThrow(`cannot enforce mutation effects without an isolated staging and effect mediator: ${effect}`)
  })

  it("rejects settings and Charter effects that the CLI cannot enforce", () => {
    const adapter = new CodexAdapter()
    expect(() => adapter.buildInvocation(
      selection("danger-full-access"),
      charter(),
      "/workspace",
      "do not expose me",
    )).toThrow("requires read-only sandbox")

    const networkCharter = charter()
    networkCharter.permissions = networkCharter.permissions.map((permission) =>
      permission.capability === "network-access" ? { ...permission, mode: "ask" } : permission,
    )
    expect(() => adapter.buildInvocation(selection(), networkCharter, "/workspace", "network")).toThrow(
      "network-access=ask",
    )

    const commitCharter = charter()
    commitCharter.permissions.push({ capability: "commit", mode: "allow", scope: ["/workspace"] })
    expect(() => adapter.buildInvocation(selection(), commitCharter, "/workspace", "commit")).toThrow(
      "commit=allow",
    )
    expect(() => adapter.buildInvocation(
      selection(),
      charter("deny", "allow", "allow", ["external-effect"]),
      "/workspace",
      "external",
    )).toThrow("external-effect")
  })

  it("recompiles the Charter boundary when resuming", () => {
    const invocation = new CodexAdapter().buildResumeInvocation!(
      selection(),
      charter("ask"),
      "/workspace",
      "session-id",
      "continue safely",
    )
    expect(sandboxArgument(invocation.args)).toBe("read-only")
    expect(invocation.args).toEqual(expect.arrayContaining(["exec", "resume", "session-id", "-"]))
    expect(invocation.stdin).toBe("continue safely")
  })
})
