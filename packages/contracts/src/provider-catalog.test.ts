import { describe, expect, it } from "vitest"

import { providerCatalogEntrySchema, providerCatalogSchema } from "./index.js"

const observedAt = "2026-07-24T00:00:00.000Z"
const digest = `sha256:${"a".repeat(64)}`

function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    adapterId: "gaep.claude-code-cli",
    agentId: "claude-code-cli",
    agentLabel: "Claude Code",
    detected: true,
    runtimeVersion: "2.1.218",
    authReadiness: "auth-unverified",
    authTruthClass: "provider-declared",
    capabilityDigest: digest,
    models: [{ id: "sonnet", label: "Sonnet alias", truthClass: "provider-declared", alias: true }],
    ...overrides,
  }
}

describe("provider catalog contract", () => {
  it("accepts a detected provider with provider-declared aliases", () => {
    expect(() => providerCatalogSchema.parse({ schemaVersion: 1, observedAt, providers: [entry()] })).not.toThrow()
  })

  it("rejects an alias marked observed (INV-06)", () => {
    const bad = entry({ models: [{ id: "sonnet", label: "Sonnet", truthClass: "observed", alias: true }] })
    expect(providerCatalogEntrySchema.safeParse(bad).success).toBe(false)
  })

  it("accepts a configured custom model identifier", () => {
    const ok = entry({ models: [{ id: "my-custom-model", label: "my-custom-model", truthClass: "configured", alias: false }] })
    expect(providerCatalogEntrySchema.safeParse(ok).success).toBe(true)
  })

  it("rejects an undetected provider claiming auth-ready or observed models (INV-07/08)", () => {
    expect(providerCatalogEntrySchema.safeParse(entry({ detected: false, authReadiness: "auth-ready" })).success).toBe(false)
    expect(providerCatalogEntrySchema.safeParse(entry({
      detected: false,
      authReadiness: "auth-unverified",
      models: [{ id: "gpt-x", label: "gpt-x", truthClass: "observed", alias: false }],
    })).success).toBe(false)
  })

  it("permits auth-unverified on a detected provider without blocking (INV-07)", () => {
    const parsed = providerCatalogEntrySchema.parse(entry({ authReadiness: "auth-unverified" }))
    expect(parsed.authReadiness).toBe("auth-unverified")
    expect(parsed.detected).toBe(true)
  })

  it("records auth-unavailable after a classified failure", () => {
    expect(providerCatalogEntrySchema.safeParse(entry({ authReadiness: "auth-unavailable" })).success).toBe(true)
  })
})
