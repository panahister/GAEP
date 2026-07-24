import { describe, expect, it } from "vitest"

import type { PlatformReadinessSnapshot } from "@gaep/contracts"

import { formatPlatformReadinessLines } from "./platform-readiness-format.js"

const now = "2026-07-24T00:00:00.000Z"

function snapshot(): PlatformReadinessSnapshot {
  return {
    schemaVersion: 1,
    generatedAt: now,
    engineVersion: "0.1.0",
    providers: [
      { adapterId: "gaep.codex-cli", agentId: "codex-cli", agentLabel: "Codex", detected: false, executionInterface: "unavailable", supportsModelDiscovery: false, models: [], truthClass: "not-observed", observedAt: now },
      { adapterId: "gaep.claude-code-cli", agentId: "claude-code-cli", agentLabel: "Claude Code", detected: true, runtimeVersion: "2.1.0", executionInterface: "cli-stream-json", supportsModelDiscovery: false, models: [{ id: "sonnet", label: "Sonnet", alias: true }], truthClass: "observed", observedAt: now },
    ],
    workspace: { status: "uninitialized", initialized: false, auditValid: true, lockPresent: false, issueCount: 0, truthClass: "observed", observedAt: now },
    hostMatrix: [
      { host: "vscode", state: "not-run", source: "base-default" },
      { host: "visual-studio", state: "pending-environment", source: "base-default" },
      { host: "rider", state: "pending-environment", source: "base-default" },
      { host: "kiro", state: "pending-environment", source: "base-default" },
    ],
  }
}

describe("formatPlatformReadinessLines", () => {
  it("renders a provider line per provider, a workspace line, and one line per host row", () => {
    const lines = formatPlatformReadinessLines(snapshot())
    expect(lines.filter((line) => line.startsWith("Provider "))).toHaveLength(2)
    expect(lines.some((line) => line.startsWith("Workspace: "))).toBe(true)
    for (const host of ["vscode", "visual-studio", "rider", "kiro"]) {
      expect(lines.some((line) => line.startsWith(`Host ${host}: `))).toBe(true)
    }
    expect(lines.filter((line) => line.startsWith("Host "))).toHaveLength(4)
  })
})
