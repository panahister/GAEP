import { capabilityDigest as digestCapabilities, type AdapterProbeResult } from "@gaep/agent-sdk"
import type { AgentSelection } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import {
  resolveRuntimeBinding,
  runtimeBindingKey,
  sameExecutableFingerprint,
  verifiedExecutableBinding,
  type RuntimeBinding,
} from "./runtime-binding.js"

const executable = {
  requested: "codex",
  canonicalPath: "/opt/gaep/bin/codex",
  digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const,
  size: 42,
  modifiedAtMs: 123,
}

const capabilities = {
  schemaVersion: 1 as const,
  adapterId: "gaep.codex-cli",
  adapterVersion: "0.1.0",
  agentId: "codex-cli",
  agentLabel: "Codex",
  runtimeVersion: "1.0.0",
  detected: true,
  executionInterface: "cli-jsonl" as const,
  interfaceMaturity: "stable" as const,
  supportsResume: false,
  supportsCancel: true,
  supportsCheckpoints: false,
  supportsModelDiscovery: true,
  supportsToolSelection: false,
  settings: [],
  models: [],
  limitations: [],
  observedAt: "2026-07-21T00:00:00.000Z",
}

const capabilityDigest = digestCapabilities(capabilities)

const selection: AgentSelection = {
  schemaVersion: 2,
  adapterId: capabilities.adapterId,
  agentId: capabilities.agentId,
  modelId: "gpt-test",
  modelTruthClass: "provider-declared",
  modelAlias: false,
  settings: {},
  selectedAt: "2026-07-21T00:00:00.000Z",
  capabilityDigest,
}

const probe: AdapterProbeResult = {
  capabilities,
  runtimeBinding: {
    scope: "machine-local",
    kind: "executable",
    adapterId: capabilities.adapterId,
    agentId: capabilities.agentId,
    executablePath: executable.canonicalPath,
    executableFingerprint: executable,
  },
}

const binding: RuntimeBinding = {
  schemaVersion: 2,
  scope: "machine-local",
  kind: "executable",
  adapterId: capabilities.adapterId,
  agentId: capabilities.agentId,
  capabilityDigest,
  executable,
  observedAt: "2026-07-21T00:00:00.000Z",
}

describe("runtime bindings", () => {
  it("uses both Product root and adapter identity", () => {
    expect(runtimeBindingKey("/work/a", "gaep.codex-cli")).not.toBe(
      runtimeBindingKey("/work/b", "gaep.codex-cli"),
    )
    expect(runtimeBindingKey("/work/a", "gaep.codex-cli")).not.toBe(
      runtimeBindingKey("/work/a", "gaep.other"),
    )
  })

  it("resolves only the versioned machine-local shape and stops on legacy state", () => {
    const key = runtimeBindingKey("/work/a", capabilities.adapterId)
    expect(resolveRuntimeBinding({ [key]: binding }, "/work/a", capabilities.adapterId)).toEqual({
      state: "ready",
      binding,
    })
    expect(resolveRuntimeBinding({
      [key]: { adapterId: capabilities.adapterId, ...executable, observedAt: binding.observedAt },
    }, "/work/a", capabilities.adapterId)).toEqual({ state: "legacy" })
    expect(resolveRuntimeBinding({ [key]: { schemaVersion: 2 } }, "/work/a", capabilities.adapterId)).toEqual({ state: "invalid" })
    expect(resolveRuntimeBinding({}, "/work/a", capabilities.adapterId)).toEqual({ state: "missing" })
  })

  it("rejects same-path replacement and metadata drift", () => {
    expect(sameExecutableFingerprint(executable, { ...executable })).toBe(true)
    expect(sameExecutableFingerprint(executable, {
      ...executable,
      digest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    })).toBe(false)
    expect(sameExecutableFingerprint(executable, { ...executable, modifiedAtMs: 124 })).toBe(false)
  })

  it("requires the fresh probe, portable digest, and stored executable fingerprint to agree", () => {
    const ready = { state: "ready", binding } as const
    expect(verifiedExecutableBinding(selection, probe, ready)).toEqual(executable)
    expect(() => verifiedExecutableBinding(selection, probe, { state: "legacy" })).toThrow(/legacy path-bearing/i)
    expect(() => verifiedExecutableBinding(selection, probe, { state: "missing" })).toThrow(/No valid machine-local/i)
    expect(() => verifiedExecutableBinding(selection, {
      ...probe,
      runtimeBinding: {
        scope: "machine-local",
        kind: "executable",
        adapterId: capabilities.adapterId,
        agentId: capabilities.agentId,
        executablePath: executable.canonicalPath,
        executableFingerprint: {
          ...executable,
          digest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
      },
    }, ready)).toThrow(/changed after selection/i)
  })

  it("fails closed on capability, identity, and executable availability drift", () => {
    const ready = { state: "ready", binding } as const
    expect(() => verifiedExecutableBinding({
      ...selection,
      capabilityDigest: `sha256:${"f".repeat(64)}`,
    }, probe, ready)).toThrow(/capabilities changed/i)
    expect(() => verifiedExecutableBinding({
      ...selection,
      adapterId: "gaep.other",
    }, probe, ready)).toThrow(/does not match the portable selection/i)
    expect(() => verifiedExecutableBinding(selection, {
      capabilities: { ...capabilities, detected: false, executionInterface: "unavailable" },
      runtimeBinding: {
        scope: "machine-local",
        kind: "unavailable",
        adapterId: capabilities.adapterId,
        agentId: capabilities.agentId,
        reason: "not found",
      },
    }, ready)).toThrow(/not currently available/i)
  })
})
