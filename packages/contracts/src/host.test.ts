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
