import { describe, expect, it } from "vitest"

import { hostMethodSchema, hostRequestSchema } from "./index.js"

describe("host contract — platformReadiness", () => {
  it("registers platformReadiness as a known method", () => {
    expect(hostMethodSchema.safeParse("platformReadiness").success).toBe(true)
  })

  it("accepts a platformReadiness request with protocol version 2 and empty params", () => {
    const parsed = hostRequestSchema.parse({
      jsonrpc: "2.0",
      id: 1,
      protocolVersion: 2,
      method: "platformReadiness",
      params: {},
    })
    expect(parsed.method).toBe("platformReadiness")
    expect(parsed.protocolVersion).toBe(2)
  })

  it("accepts an omitted protocolVersion at the contract layer (version gating is enforced by the engine host)", () => {
    const parsed = hostRequestSchema.parse({
      jsonrpc: "2.0",
      id: 2,
      method: "platformReadiness",
      params: {},
    })
    expect(parsed.protocolVersion).toBeUndefined()
  })

  it("rejects unexpected params for platformReadiness", () => {
    expect(hostRequestSchema.safeParse({
      jsonrpc: "2.0",
      id: 3,
      protocolVersion: 2,
      method: "platformReadiness",
      params: { host: "vscode" },
    }).success).toBe(false)
  })
})

describe("host contract — CS02 v3 methods", () => {
  for (const method of ["providerCatalog", "readProviderSelection", "dashboardProjection"]) {
    it(`registers ${method}`, () => {
      expect(hostMethodSchema.safeParse(method).success).toBe(true)
      expect(hostRequestSchema.safeParse({ jsonrpc: "2.0", id: 1, protocolVersion: 3, method, params: {} }).success).toBe(true)
    })
  }

  it("selectProviderModel rejects a caller-supplied truthClass (INV-31)", () => {
    const ok = hostRequestSchema.safeParse({ jsonrpc: "2.0", id: 1, protocolVersion: 3, method: "selectProviderModel", params: { adapterId: "gaep.claude-code-cli", modelId: "sonnet" } })
    expect(ok.success).toBe(true)
    const withTruth = hostRequestSchema.safeParse({ jsonrpc: "2.0", id: 2, protocolVersion: 3, method: "selectProviderModel", params: { adapterId: "gaep.claude-code-cli", modelId: "sonnet", truthClass: "observed" } })
    expect(withTruth.success).toBe(false)
  })

  it("startReadOnlyAnalysis requires bounded params", () => {
    expect(hostRequestSchema.safeParse({ jsonrpc: "2.0", id: 1, protocolVersion: 3, method: "startReadOnlyAnalysis", params: { objective: "check the context", contextPackIds: ["11111111-1111-4111-8111-111111111111"], idempotencyKey: "22222222-2222-4222-8222-222222222222" } }).success).toBe(true)
    expect(hostRequestSchema.safeParse({ jsonrpc: "2.0", id: 2, protocolVersion: 3, method: "startReadOnlyAnalysis", params: { objective: "x", contextPackIds: [], idempotencyKey: "not-a-uuid" } }).success).toBe(false)
  })
})
