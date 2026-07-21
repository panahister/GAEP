import { describe, expect, it } from "vitest"

import {
  adapterCapabilitiesSnapshotSchema,
  agentSelectionSchema,
  executionCharterSchema,
  handoffSchema,
  legacyAgentSelectionV1Schema,
  runSchema,
  toolPermissionSchema,
} from "./index.js"

const selectedAt = "2026-07-21T00:00:00.000Z"
const digest = `sha256:${"a".repeat(64)}`

function selection(): Record<string, unknown> {
  return {
    schemaVersion: 2,
    adapterId: "gaep.test",
    agentId: "test-agent",
    modelId: "logical-model",
    modelTruthClass: "configured",
    modelAlias: false,
    settings: { effort: "high" },
    selectedAt,
    capabilityDigest: digest,
  }
}

function capabilities(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    adapterId: "gaep.test",
    adapterVersion: "1.0.0",
    agentId: "test-agent",
    agentLabel: "Test Agent",
    runtimeVersion: "2.0.0",
    detected: true,
    executionInterface: "cli-jsonl",
    interfaceMaturity: "stable",
    supportsResume: true,
    supportsCancel: true,
    supportsCheckpoints: false,
    supportsModelDiscovery: true,
    supportsToolSelection: false,
    settings: [],
    models: [],
    limitations: [],
    observedAt: selectedAt,
  }
}

describe("portable agent contracts", () => {
  it("accepts a versioned path-free selection and capability snapshot", () => {
    expect(agentSelectionSchema.parse(selection())).not.toHaveProperty("runtimeExecutable")
    expect(adapterCapabilitiesSnapshotSchema.parse(capabilities())).not.toHaveProperty("executablePath")
  })

  it.each([
    ["runtimeExecutable", "/opt/agent/bin/agent"],
    ["executablePath", "C:\\agent\\agent.exe"],
    ["executableFingerprint", { digest }],
  ])("strictly rejects machine-local selection field %s", (field, value) => {
    expect(agentSelectionSchema.safeParse({ ...selection(), [field]: value }).success).toBe(false)
  })

  it.each([
    ["executablePath", "/opt/agent/bin/agent"],
    ["fingerprint", { canonicalPath: "/opt/agent/bin/agent", digest }],
  ])("strictly rejects machine-local capability field %s", (field, value) => {
    expect(adapterCapabilitiesSnapshotSchema.safeParse({ ...capabilities(), [field]: value }).success).toBe(false)
  })

  it.each([
    [{ runtimeVersion: "/Users/alice/.local/bin/agent" }, "machine-local path"],
    [{ limitations: ["Probe failed at /home/alice/private/agent"] }, "machine-local path"],
    [{ models: [{ id: "model", label: "Model", description: "token=leaked-value", truthClass: "observed" }] }, "secret-shaped"],
    [{ settings: [{
      key: "mode",
      label: "Mode",
      description: "Mode selection",
      kind: "select",
      truthClass: "configured",
      options: [{ value: "sk-ant-1234567890abcdef", label: "unsafe" }],
    }] }, "secret-shaped"],
  ])("rejects host or credential data hidden in capability snapshot strings", (patch, message) => {
    const result = adapterCapabilitiesSnapshotSchema.safeParse({ ...capabilities(), ...patch })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.message).toContain(message)
  })

  it("allows ordinary capability prose that mentions a generic path", () => {
    expect(adapterCapabilitiesSnapshotSchema.safeParse({
      ...capabilities(),
      limitations: ["The provider may describe generic paths such as /bin/sh in documentation."],
    }).success).toBe(true)
  })

  it("bounds and de-duplicates untrusted capability collections", () => {
    const model = { id: "model", label: "Model", truthClass: "observed" }
    expect(adapterCapabilitiesSnapshotSchema.safeParse({
      ...capabilities(),
      models: [model, model],
    }).success).toBe(false)
    expect(adapterCapabilitiesSnapshotSchema.safeParse({
      ...capabilities(),
      models: Array.from({ length: 513 }, (_value, index) => ({
        id: `model-${index}`,
        label: `Model ${index}`,
        truthClass: "observed",
      })),
    }).success).toBe(false)
  })

  it.each([
    [{ workspaceRoot: "/Users/example/project" }, "machine-local paths"],
    [{ apiKey: "not-even-a-real-secret" }, "machine-local credential binding"],
    [{ mode: "token=secret-shaped-value" }, "secret-shaped values"],
    [{ mode: "sk-ant-1234567890abcdef" }, "secret-shaped values"],
  ])("rejects non-portable or secret-shaped setting payloads", (settings, message) => {
    const result = agentSelectionSchema.safeParse({ ...selection(), settings })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.message).toContain(message)
  })

  it("keeps the legacy executable-bearing shape explicit and outside current selection parsing", () => {
    const legacy = { ...selection(), schemaVersion: 1, runtimeExecutable: "/opt/agent/bin/agent" }
    expect(legacyAgentSelectionV1Schema.safeParse(legacy).success).toBe(true)
    expect(agentSelectionSchema.safeParse(legacy).success).toBe(false)
  })

  it.each(["/workspace", "C:\\workspace", "../workspace", "src/../secrets", "~/.config"])(
    "rejects non-portable Execution Charter scope %s",
    (scope) => {
      expect(toolPermissionSchema.safeParse({ capability: "read-workspace", mode: "allow", scope: [scope] }).success).toBe(false)
    },
  )

  it("accepts normalized workspace-relative Charter scopes", () => {
    expect(toolPermissionSchema.parse({ capability: "read-workspace", mode: "allow", scope: [".", "src"] }).scope)
      .toEqual([".", "src"])
  })

  it("rejects executable-bearing selections in every selection-embedded contract", () => {
    const legacyAgent = { ...selection(), runtimeExecutable: "/opt/agent/bin/agent" }
    const common = {
      schemaVersion: 1,
      id: "00000000-0000-4000-8000-000000000001",
      productId: "00000000-0000-4000-8000-000000000002",
      initiativeId: "00000000-0000-4000-8000-000000000003",
    }
    expect(executionCharterSchema.safeParse({
      ...common,
      agent: legacyAgent,
      objective: "Perform governed analysis",
      permissions: [],
      expectedEffects: ["observe"],
      forbiddenActions: [],
      stopConditions: ["Stop on uncertainty"],
      createdAt: selectedAt,
    }).success).toBe(false)
    expect(runSchema.safeParse({
      ...common,
      charterId: "00000000-0000-4000-8000-000000000004",
      agent: legacyAgent,
      state: "prepared",
    }).success).toBe(false)
    expect(handoffSchema.safeParse({
      ...common,
      fromRunId: "00000000-0000-4000-8000-000000000005",
      toAgent: legacyAgent,
      reason: "Switch provider",
      workspaceBaseline: { dirty: null, changedFiles: [] },
      completedWork: [],
      unresolvedMatters: [],
      decisions: [],
      evidence: [],
      capabilityDifferences: [],
      createdAt: selectedAt,
    }).success).toBe(false)
  })
})
