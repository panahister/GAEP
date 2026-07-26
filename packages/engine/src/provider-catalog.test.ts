import { describe, expect, it, vi } from "vitest"

import type { AdapterCapabilities, ProviderCatalogEntry } from "@gaep/contracts"

import { ProviderCatalogService, resolveModelTruth, toCatalogEntry } from "./provider-catalog.js"

function capabilities(overrides: Partial<AdapterCapabilities> = {}): AdapterCapabilities {
  return {
    schemaVersion: 1,
    adapterId: "gaep.claude-code-cli",
    adapterVersion: "0.1.0",
    agentId: "claude-code-cli",
    agentLabel: "Claude Code",
    runtimeVersion: "2.1.218",
    detected: true,
    executionInterface: "cli-stream-json",
    interfaceMaturity: "stable",
    supportsResume: false,
    supportsCancel: true,
    supportsCheckpoints: false,
    supportsModelDiscovery: false,
    supportsToolSelection: false,
    settings: [],
    models: [{ id: "sonnet", label: "Sonnet alias", reasoningOptions: [], inputModalities: ["text"], truthClass: "provider-declared", alias: true }],
    limitations: [],
    observedAt: "2026-07-24T00:00:00.000Z",
    ...overrides,
  }
}

describe("provider catalog service", () => {
  it("keeps aliases provider-declared and never observed (INV-06)", () => {
    const entry = toCatalogEntry(capabilities())
    expect(entry.models[0]!.alias).toBe(true)
    expect(entry.models[0]!.truthClass).toBe("provider-declared")
  })

  it("detection alone never sets auth-ready (INV-07)", () => {
    expect(toCatalogEntry(capabilities()).authReadiness).toBe("auth-unverified")
  })

  it("single-source: catalog derives from probeAgents; auth truth only via recorded observation", async () => {
    const probe = vi.fn(async () => [capabilities()])
    const svc = new ProviderCatalogService(probe)
    expect((await svc.catalog()).providers[0]!.authReadiness).toBe("auth-unverified")
    svc.recordAuthObservation("gaep.claude-code-cli", "auth-ready")
    const after = await svc.catalog()
    expect(after.providers[0]!.authReadiness).toBe("auth-ready")
    expect(after.providers[0]!.authTruthClass).toBe("observed")
    expect(probe).toHaveBeenCalled()
  })

  it("server-derived truth: a caller-unknown model id becomes configured, never observed (INV-31)", () => {
    const entry = toCatalogEntry(capabilities()) as ProviderCatalogEntry
    expect(resolveModelTruth(entry, "sonnet")).toEqual({ truthClass: "provider-declared", alias: true })
    expect(resolveModelTruth(entry, "totally-custom")).toEqual({ truthClass: "configured", alias: false })
  })

  it("an undetected provider carries no observed models and stays auth-unverified", () => {
    const entry = toCatalogEntry(capabilities({ detected: false }))
    expect(entry.authReadiness).toBe("auth-unverified")
    expect(entry.models.every((m) => m.truthClass !== "observed")).toBe(true)
  })
})
