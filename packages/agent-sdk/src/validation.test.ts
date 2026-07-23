import { describe, expect, it } from "vitest"

import type { AdapterCapabilities, AgentSelection } from "@gaep/contracts"

import type { AdapterRuntimeBinding } from "./types.js"
import { canonicalDigest } from "./digest.js"
import {
  capabilityDigest,
  parseAdapterCapabilitiesCompatibility,
  parseAgentSelectionCompatibility,
  requireExecutableRuntimeBinding,
  validateDeclaredSettings,
} from "./validation.js"

function capabilities(): AdapterCapabilities {
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
    settings: [{
      key: "effort",
      label: "Effort",
      description: "Logical effort",
      kind: "select",
      required: false,
      sensitive: false,
      options: [{ value: "high", label: "High" }],
      truthClass: "configured",
    }],
    models: [{
      id: "model",
      label: "Model",
      reasoningOptions: ["high"],
      inputModalities: ["text"],
      truthClass: "observed",
      alias: false,
    }],
    limitations: ["Logical limitation"],
    observedAt: "2026-07-21T00:00:00.000Z",
  }
}

function selection(): AgentSelection {
  const observed = capabilities()
  return {
    schemaVersion: 2,
    adapterId: observed.adapterId,
    agentId: observed.agentId,
    modelId: "model",
    modelTruthClass: "observed",
    modelAlias: false,
    settings: { effort: "high" },
    selectedAt: "2026-07-21T00:00:00.000Z",
    capabilityDigest: capabilityDigest(observed),
  }
}

function binding(): AdapterRuntimeBinding {
  return {
    scope: "machine-local",
    kind: "executable",
    adapterId: "gaep.test",
    agentId: "test-agent",
    executablePath: "/opt/test/bin/agent",
    executableFingerprint: {
      requested: "agent",
      canonicalPath: "/opt/test/bin/agent",
      digest: `sha256:${"b".repeat(64)}`,
      size: 1,
      modifiedAtMs: 1,
    },
  }
}

describe("portable selection validation", () => {
  it("excludes observation time from the capability digest", () => {
    const first = capabilities()
    const second = { ...first, observedAt: "2026-07-21T01:00:00.000Z" }
    expect(capabilityDigest(first)).toBe(capabilityDigest(second))
  })

  it.each([
    ["runtime", (value: AdapterCapabilities) => ({ ...value, runtimeVersion: "2.1.0" })],
    ["models", (value: AdapterCapabilities) => ({ ...value, models: [{ ...value.models[0]!, id: "other-model" }] })],
    ["settings", (value: AdapterCapabilities) => ({ ...value, settings: [{ ...value.settings[0]!, required: true }] })],
    ["limitations", (value: AdapterCapabilities) => ({ ...value, limitations: ["Different logical limitation"] })],
  ] as const)("keeps the capability digest sensitive to %s changes", (_label, mutate) => {
    const initial = capabilities()
    expect(capabilityDigest(mutate(initial))).not.toBe(capabilityDigest(initial))
  })

  it("returns an explicit non-mutating legacy migration result and discards the executable from portable data", () => {
    const current = selection()
    const { schemaVersion: _schemaVersion, ...fields } = current
    const input = { ...fields, runtimeExecutable: "/opt/legacy/bin/agent" }
    const result = parseAgentSelectionCompatibility(input)

    expect(result).toMatchObject({
      status: "migration-required",
      portableCandidate: { schemaVersion: 2 },
      localRuntimeHint: { scope: "machine-local", requestedExecutable: "/opt/legacy/bin/agent" },
      machineLocalSettingKeys: [],
      machineLocalSettingsDigest: canonicalDigest({}),
      capabilityReconfirmationRequired: true,
    })
    if (result.status !== "migration-required") throw new Error("Expected legacy migration result")
    expect(result.portableCandidate).not.toHaveProperty("runtimeExecutable")
    expect(input).toHaveProperty("runtimeExecutable", "/opt/legacy/bin/agent")
  })

  it("separates an authentic legacy Codex profile path while retaining portable historical settings", () => {
    const current = selection()
    const { schemaVersion: _schemaVersion, ...fields } = current
    const profile = "/Users/alice/.codex/config.toml"
    const input = {
      ...fields,
      adapterId: "gaep.codex-cli",
      agentId: "codex-cli",
      runtimeExecutable: "/opt/legacy/bin/codex",
      settings: {
        reasoningEffort: "high",
        sandbox: "read-only",
        approvalPolicy: "fail-closed-noninteractive",
        search: false,
        profile,
      },
    }
    const result = parseAgentSelectionCompatibility(input)

    expect(result).toMatchObject({
      status: "migration-required",
      portableCandidate: {
        settings: {
          reasoningEffort: "high",
          sandbox: "read-only",
          approvalPolicy: "fail-closed-noninteractive",
          search: false,
        },
      },
      machineLocalSettingKeys: ["profile"],
      machineLocalSettingsDigest: canonicalDigest({ profile }),
    })
    if (result.status !== "migration-required") throw new Error("Expected legacy migration result")
    expect(result.portableCandidate.settings).not.toHaveProperty("profile")
    expect(JSON.stringify({
      portableCandidate: result.portableCandidate,
      machineLocalSettingKeys: result.machineLocalSettingKeys,
      machineLocalSettingsDigest: result.machineLocalSettingsDigest,
    })).not.toContain(profile)
  })

  it("binds the opaque local-settings digest to the exact legacy profile path", () => {
    const current = selection()
    const { schemaVersion: _schemaVersion, ...fields } = current
    const parseProfile = (profile: string) => parseAgentSelectionCompatibility({
      ...fields,
      adapterId: "gaep.codex-cli",
      agentId: "codex-cli",
      runtimeExecutable: "/opt/legacy/bin/codex",
      settings: { reasoningEffort: "high", profile },
    })
    const first = parseProfile("/Users/alice/.codex/first.toml")
    const same = parseProfile("/Users/alice/.codex/first.toml")
    const changed = parseProfile("/Users/alice/.codex/second.toml")
    if (first.status !== "migration-required" || same.status !== "migration-required" || changed.status !== "migration-required") {
      throw new Error("Expected legacy migration results")
    }
    expect(first.machineLocalSettingsDigest).toBe(same.machineLocalSettingsDigest)
    expect(first.machineLocalSettingsDigest).not.toBe(changed.machineLocalSettingsDigest)
  })

  it("retains authentic portable Claude settings including a zero budget", () => {
    const current = selection()
    const { schemaVersion: _schemaVersion, ...fields } = current
    const result = parseAgentSelectionCompatibility({
      ...fields,
      adapterId: "gaep.claude-code-cli",
      agentId: "claude-code-cli",
      runtimeExecutable: "/opt/legacy/bin/claude",
      settings: {
        effort: "high",
        permissionMode: "default",
        allowedTools: ["Read", "Grep"],
        disallowedTools: ["WebFetch"],
        maxBudgetUsd: 0,
      },
    })
    expect(result).toMatchObject({
      status: "migration-required",
      portableCandidate: {
        settings: {
          effort: "high",
          permissionMode: "default",
          allowedTools: ["Read", "Grep"],
          disallowedTools: ["WebFetch"],
          maxBudgetUsd: 0,
        },
      },
      machineLocalSettingKeys: [],
      machineLocalSettingsDigest: canonicalDigest({}),
    })
  })

  it("separates a legacy capability executable into a non-persistent local hint", () => {
    const current = capabilities()
    const { schemaVersion: _schemaVersion, ...fields } = current
    const input = { ...fields, executablePath: "/opt/legacy/bin/agent" }
    const result = parseAdapterCapabilitiesCompatibility(input)

    expect(result).toMatchObject({
      status: "migration-required",
      portableCandidate: { schemaVersion: 1 },
      historicalCapabilityDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      localRuntimeHint: { scope: "machine-local", requestedExecutable: "/opt/legacy/bin/agent" },
      capabilityReconfirmationRequired: true,
    })
    if (result.status !== "migration-required") throw new Error("Expected legacy capability migration result")
    expect(result.portableCandidate).not.toHaveProperty("executablePath")
    const otherPath = parseAdapterCapabilitiesCompatibility({
      ...fields,
      executablePath: "/opt/other/bin/agent",
    })
    if (otherPath.status !== "migration-required") throw new Error("Expected second legacy capability migration result")
    expect(otherPath.historicalCapabilityDigest).not.toBe(result.historicalCapabilityDigest)
  })

  it("refuses to migrate legacy selections containing secret-shaped settings", () => {
    const current = selection()
    const { schemaVersion: _schemaVersion, ...fields } = current
    expect(parseAgentSelectionCompatibility({
      ...fields,
      runtimeExecutable: "/opt/legacy/bin/agent",
      settings: { apiKey: "secret" },
    }).status).toBe("invalid")
  })

  it.each([
    ["unknown path-bearing setting", { workspaceRoot: "/Users/alice/project" }],
    ["object setting", { profile: { path: "/Users/alice/.codex/config.toml" } }],
    ["secret-shaped profile", { profile: "token=credential-value" }],
  ])("refuses to migrate a legacy selection containing an %s", (_label, settings) => {
    const current = selection()
    const { schemaVersion: _schemaVersion, ...fields } = current
    expect(parseAgentSelectionCompatibility({
      ...fields,
      adapterId: "gaep.codex-cli",
      agentId: "codex-cli",
      runtimeExecutable: "/opt/legacy/bin/codex",
      settings,
    }).status).toBe("invalid")
  })

  it("requires a matching explicit executable binding at invocation time", () => {
    const selected = selection()
    expect(requireExecutableRuntimeBinding(binding(), selected, "Test").executablePath).toBe("/opt/test/bin/agent")
    expect(() => requireExecutableRuntimeBinding({ ...binding(), agentId: "other" }, selected, "Test")).toThrow(
      "identity does not match",
    )
    const wrongFingerprint = binding()
    if (wrongFingerprint.kind !== "executable") throw new Error("Expected executable binding")
    wrongFingerprint.executableFingerprint.canonicalPath = "/different/path"
    expect(() => requireExecutableRuntimeBinding(wrongFingerprint, selected, "Test")).toThrow("does not match its executable fingerprint")
  })

  it("keeps declared sensitive values out of portable selection settings", () => {
    expect(validateDeclaredSettings({ organization: "credential-value" }, [{
      key: "organization",
      label: "Organization",
      description: "Locally bound organization credential",
      kind: "string",
      required: false,
      sensitive: true,
      truthClass: "configured",
    }])).toEqual(["Sensitive agent setting organization requires a machine-local credential binding"])
  })

  it("validates every declared setting kind and required empty values", () => {
    const declarations: AdapterCapabilities["settings"] = [
      {
        key: "mode",
        label: "Mode",
        description: "Execution mode",
        kind: "select",
        required: true,
        sensitive: false,
        options: [{ value: "safe", label: "Safe" }],
        truthClass: "configured",
      },
      {
        key: "enabled",
        label: "Enabled",
        description: "Feature gate",
        kind: "boolean",
        required: false,
        sensitive: false,
        truthClass: "configured",
      },
      {
        key: "budget",
        label: "Budget",
        description: "Finite budget",
        kind: "number",
        required: false,
        sensitive: false,
        minimum: 1,
        maximum: 10,
        truthClass: "configured",
      },
      {
        key: "name",
        label: "Name",
        description: "Required name",
        kind: "string",
        required: true,
        sensitive: false,
        truthClass: "configured",
      },
      {
        key: "scopes",
        label: "Scopes",
        description: "Required scopes",
        kind: "string-list",
        required: true,
        sensitive: false,
        truthClass: "configured",
      },
    ]

    expect(validateDeclaredSettings({
      unknown: true,
      mode: "unsafe",
      enabled: "yes",
      budget: Number.POSITIVE_INFINITY,
      name: "   ",
      scopes: [],
    }, declarations)).toEqual(expect.arrayContaining([
      expect.stringMatching(/Unsupported agent setting: unknown/),
      expect.stringMatching(/Unsupported value.*mode/),
      expect.stringMatching(/enabled.*boolean/),
      expect.stringMatching(/budget.*finite number/),
      expect.stringMatching(/name.*non-empty string/),
      expect.stringMatching(/scopes.*non-empty strings/),
    ]))
    expect(validateDeclaredSettings({
      mode: "safe",
      budget: 1,
      name: "GAEP",
      scopes: ["workspace"],
    }, declarations)).toEqual([])
    expect(validateDeclaredSettings({ mode: "safe", budget: 11, name: "GAEP", scopes: ["workspace"] }, declarations))
      .toContain("Agent setting budget must be at most 10")
  })
})
