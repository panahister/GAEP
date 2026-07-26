import { describe, expect, it } from "vitest"

import type { DashboardProjection } from "@gaep/contracts"

import { formatDashboardLines } from "./provider-model-view.js"

const now = "2026-07-24T00:00:00.000Z"

function base(overrides: Partial<DashboardProjection> = {}): DashboardProjection {
  return {
    schemaVersion: 1,
    generatedAt: now,
    workspaceState: "product-uninitialized",
    workspaceMessage: "Initialize Product first to enable Product actions. Platform Readiness is available now.",
    providers: [],
    selection: null,
    latestRun: null,
    hostMatrix: [
      { host: "vscode", packageVersion: "0.2.0", conformanceState: "not-run", evidenceState: "evidence-absent" },
      { host: "visual-studio", packageVersion: "0.2.0", conformanceState: "pending-environment", evidenceState: "evidence-absent" },
      { host: "rider", packageVersion: "0.2.0", conformanceState: "pending-environment", evidenceState: "evidence-absent" },
      { host: "kiro", packageVersion: "0.2.0", conformanceState: "pending-environment", evidenceState: "evidence-absent" },
    ],
    catalogObservedAt: null,
    catalogStale: false,
    ...overrides,
  }
}

describe("Agent/Model view rendering (INV-11/16)", () => {
  it("renders a friendly uninitialized state, not a raw error", () => {
    const lines = formatDashboardLines(base())
    expect(lines[0]).toContain("Initialize Product first")
    expect(lines.some((l) => l.includes("ENOENT") || l.includes("/Users/"))).toBe(false)
  })

  it("renders provider truth classes, selection, freshness, and all four host rows", () => {
    const lines = formatDashboardLines(base({
      workspaceState: "product-ready",
      workspaceMessage: "Product workspace is initialized and healthy.",
      providers: [{
        adapterId: "gaep.claude-code-cli", agentId: "claude-code-cli", agentLabel: "Claude Code",
        detected: true, runtimeVersion: "2.1.218", authReadiness: "auth-unverified", authTruthClass: "provider-declared",
        capabilityDigest: `sha256:${"a".repeat(64)}`,
        models: [{ id: "sonnet", label: "Sonnet", truthClass: "provider-declared", alias: true }],
      }],
      selection: { schemaVersion: 2, adapterId: "gaep.claude-code-cli", agentId: "claude-code-cli", modelId: "sonnet", capabilityDigest: `sha256:${"a".repeat(64)}`, settings: {}, selectedAt: now } as never,
      catalogObservedAt: now,
      catalogStale: true,
    }))
    expect(lines.some((l) => l.includes("auth=auth-unverified"))).toBe(true)
    expect(lines.some((l) => l.includes("sonnet [provider-declared, alias]"))).toBe(true)
    expect(lines.some((l) => l.includes("Selection: gaep.claude-code-cli / sonnet"))).toBe(true)
    expect(lines.some((l) => l.includes("(stale)"))).toBe(true)
    for (const host of ["vscode", "visual-studio", "rider", "kiro"]) {
      expect(lines.some((l) => l.startsWith(`Host ${host} @0.2.0`))).toBe(true)
    }
  })
})
