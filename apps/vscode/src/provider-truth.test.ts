import type { AdapterCapabilities } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { agentStatus, manualModelEntryCopy } from "./provider-truth.js"

function capability(overrides: Partial<AdapterCapabilities> = {}): AdapterCapabilities {
  return {
    schemaVersion: 1,
    adapterId: "test-adapter",
    adapterVersion: "0.1.0",
    agentId: "test-agent",
    agentLabel: "Test Agent",
    detected: true,
    executionInterface: "cli-jsonl",
    interfaceMaturity: "stable",
    supportsResume: false,
    supportsCancel: false,
    supportsCheckpoints: false,
    supportsModelDiscovery: false,
    supportsToolSelection: false,
    settings: [],
    models: [],
    limitations: [],
    observedAt: "2026-07-24T00:00:00.000Z",
    ...overrides,
  }
}

describe("VS Code provider truth", () => {
  it("keeps every manual model claim unverified until fail-closed launch", () => {
    const copy = Object.values(manualModelEntryCopy).join(" ")
    expect(copy).toMatch(/unverified model identifier/i)
    expect(copy).toMatch(/configured, not provider-observed/i)
    expect(copy).toMatch(/identifier validity/i)
    expect(copy).toMatch(/authentication/i)
    expect(copy).toMatch(/account entitlement/i)
    expect(copy).toMatch(/model availability/i)
    expect(copy).toMatch(/fail-closed launch/i)
  })

  it("distinguishes detection from managed-interface support and exposes maturity", () => {
    expect(agentStatus(capability({ executionInterface: "unavailable", interfaceMaturity: "unknown" })))
      .toBe("Detected · managed execution interface unsupported by this build · interface maturity unknown")
    expect(agentStatus(capability({ executionInterface: "stdio-rpc", interfaceMaturity: "experimental" })))
      .toBe("Detected · managed stdio RPC capability · interface maturity experimental")
    expect(agentStatus(capability({ detected: false, executionInterface: "unavailable", interfaceMaturity: "unknown" })))
      .toBe("Not detected · managed interface not observed · interface maturity unknown")
  })
})
