import { describe, expect, it } from "vitest"

import type { AdapterCapabilities, AgentSelection } from "@gaep/contracts"

import type { AdapterRuntimeBinding } from "./types.js"
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
      capabilityReconfirmationRequired: true,
    })
    if (result.status !== "migration-required") throw new Error("Expected legacy migration result")
    expect(result.portableCandidate).not.toHaveProperty("runtimeExecutable")
    expect(input).toHaveProperty("runtimeExecutable", "/opt/legacy/bin/agent")
  })

  it("separates a legacy capability executable into a non-persistent local hint", () => {
    const current = capabilities()
    const { schemaVersion: _schemaVersion, ...fields } = current
    const input = { ...fields, executablePath: "/opt/legacy/bin/agent" }
    const result = parseAdapterCapabilitiesCompatibility(input)

    expect(result).toMatchObject({
      status: "migration-required",
      portableCandidate: { schemaVersion: 1 },
      localRuntimeHint: { scope: "machine-local", requestedExecutable: "/opt/legacy/bin/agent" },
      capabilityReconfirmationRequired: true,
    })
    if (result.status !== "migration-required") throw new Error("Expected legacy capability migration result")
    expect(result.portableCandidate).not.toHaveProperty("executablePath")
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
})
