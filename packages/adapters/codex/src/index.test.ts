import { describe, expect, it } from "vitest"

import type { AgentSelection, ExecutionCharter } from "@gaep/contracts"

import { CodexAdapter } from "./index.js"

describe("Codex adapter", () => {
  it("uses an observed executable and argument array without shell interpolation", () => {
    const adapter = new CodexAdapter()
    const selection = {
      adapterId: "gaep.codex-cli",
      agentId: "codex-cli",
      runtimeExecutable: "/opt/codex/bin/codex",
      modelId: "model; touch /tmp/not-executed",
      modelTruthClass: "configured",
      modelAlias: null,
      settings: { sandbox: "workspace-write", approvalPolicy: "on-request" },
      selectedAt: "2026-07-21T00:00:00.000Z",
      capabilityDigest: `sha256:${"0".repeat(64)}`,
    } satisfies AgentSelection
    const charter = { id: "00000000-0000-4000-8000-000000000000" } as ExecutionCharter
    const invocation = adapter.buildInvocation(selection, charter, "/workspace", "inspect safely")

    expect(invocation.executable).toBe("/opt/codex/bin/codex")
    expect(invocation.args).toContain("model; touch /tmp/not-executed")
    expect(invocation.args.at(-1)).toBe("inspect safely")
  })
})
