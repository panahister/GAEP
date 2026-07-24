import { describe, expect, it } from "vitest"

import { platformReadinessSnapshotSchema, type AdapterCapabilities } from "@gaep/contracts"

import { computePlatformReadinessSnapshot, type WorkspaceHealthLike } from "./platform-readiness.js"

const now = "2026-07-24T00:00:00.000Z"

function codexDetected(): AdapterCapabilities {
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
    settings: [],
    models: [{ id: "gpt-test", label: "Test", reasoningOptions: [], inputModalities: ["text"], truthClass: "observed", alias: false }],
    limitations: [],
    observedAt: now,
  }
}

function claudeAbsent(): AdapterCapabilities {
  return {
    schemaVersion: 1,
    adapterId: "gaep.claude-code-cli",
    adapterVersion: "0.1.0",
    agentId: "claude-code-cli",
    agentLabel: "Claude Code",
    detected: false,
    executionInterface: "unavailable",
    interfaceMaturity: "unknown",
    supportsResume: false,
    supportsCancel: false,
    supportsCheckpoints: false,
    supportsModelDiscovery: false,
    supportsToolSelection: false,
    settings: [],
    models: [{ id: "sonnet", label: "Sonnet alias", reasoningOptions: [], inputModalities: ["text"], truthClass: "provider-declared", alias: true }],
    limitations: ["unavailable"],
    observedAt: now,
  }
}

const uninitializedWorkspace: WorkspaceHealthLike = {
  status: "uninitialized",
  initialized: false,
  audit: { valid: true },
  lock: { present: false },
  issues: [],
}

describe("computePlatformReadinessSnapshot", () => {
  it("produces a schema-valid Base Snapshot", () => {
    const snapshot = computePlatformReadinessSnapshot({
      providers: [codexDetected(), claudeAbsent()],
      workspace: uninitializedWorkspace,
      now,
    })
    expect(() => platformReadinessSnapshotSchema.parse(snapshot)).not.toThrow()
    expect(snapshot.generatedAt).toBe(now)
  })

  it("keeps all four host rows at their engine defaults (no host claim)", () => {
    const snapshot = computePlatformReadinessSnapshot({ providers: [], workspace: uninitializedWorkspace, now })
    expect(snapshot.hostMatrix).toEqual([
      { host: "vscode", state: "not-run", source: "base-default" },
      { host: "visual-studio", state: "pending-environment", source: "base-default" },
      { host: "rider", state: "pending-environment", source: "base-default" },
      { host: "kiro", state: "pending-environment", source: "base-default" },
    ])
  })

  it("marks a detected provider observed and an absent provider not-observed", () => {
    const snapshot = computePlatformReadinessSnapshot({
      providers: [codexDetected(), claudeAbsent()],
      workspace: uninitializedWorkspace,
      now,
    })
    const codex = snapshot.providers.find((provider) => provider.adapterId === "gaep.codex-cli")
    const claude = snapshot.providers.find((provider) => provider.adapterId === "gaep.claude-code-cli")
    expect(codex?.detected).toBe(true)
    expect(codex?.truthClass).toBe("observed")
    expect(claude?.detected).toBe(false)
    expect(claude?.truthClass).toBe("not-observed")
  })

  it("derives workspace readiness from workspace health", () => {
    const snapshot = computePlatformReadinessSnapshot({
      providers: [],
      workspace: { status: "degraded", initialized: true, productId: "11111111-1111-4111-8111-111111111111", audit: { valid: true }, lock: { present: true }, issues: [{}, {}] },
      now,
    })
    expect(snapshot.workspace).toMatchObject({ status: "degraded", initialized: true, lockPresent: true, issueCount: 2, truthClass: "observed" })
  })
})
