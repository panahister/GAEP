import { describe, expect, it } from "vitest"

import {
  HostRpcError,
  MAX_RPC_ERROR_MESSAGE_BYTES,
  normalizeRpcError,
  RpcFrameDecoder,
  serializeRpcFrame,
} from "./rpc.js"

describe("engine host RPC framing", () => {
  it("decodes frames split across chunks", () => {
    const decoder = new RpcFrameDecoder(128)
    expect(decoder.push(Buffer.from('{"jsonrpc":"2.0"'))).toEqual([])
    expect(decoder.push(Buffer.from(',"id":1}\n'))).toEqual([
      { type: "line", line: '{"jsonrpc":"2.0","id":1}' },
    ])
  })

  it("rejects an oversized frame without retaining the remainder", () => {
    const decoder = new RpcFrameDecoder(8)
    const first = decoder.push(Buffer.from("123456789012"))
    expect(first).toHaveLength(1)
    expect(first[0]?.type).toBe("error")
    expect(first[0]?.type === "error" ? first[0].error.kind : "").toBe("FRAME_TOO_LARGE")
    expect(decoder.push(Buffer.from("discarded\nok\n"))).toEqual([{ type: "line", line: "ok" }])
  })

  it("does not disclose internal error details", () => {
    const normalized = normalizeRpcError(new Error("secret path /private/workspace"))
    expect(normalized).toMatchObject({ code: -32_603, kind: "INTERNAL_ERROR" })
    expect(normalized.message).not.toContain("/private/workspace")
    expect(normalizeRpcError(new HostRpcError(-32_010, "KNOWN", "known"))).toMatchObject({ kind: "KNOWN" })
  })

  it("redacts and bounds explicitly classified host errors and their data", () => {
    const normalized = normalizeRpcError(new HostRpcError(
      -32_010,
      "KNOWN",
      `Failure at /Users/alice/private/workspace token=top-secret ${"x".repeat(10_000)}`,
      { executablePath: "C:\\Users\\alice\\agent.exe", nested: { secret: "apiKey=top-secret" } },
    ))
    const serialized = JSON.stringify({ message: normalized.message, data: normalized.data })

    expect(Buffer.byteLength(normalized.message)).toBeLessThanOrEqual(MAX_RPC_ERROR_MESSAGE_BYTES)
    expect(serialized).not.toContain("/Users/alice")
    expect(serialized).not.toContain("C:\\Users\\alice")
    expect(serialized).not.toContain("top-secret")
    expect(serialized).toContain("[ABSOLUTE_PATH]")
    expect(serialized).toContain("[REDACTED]")
  })

  it("bounds outbound result frames", () => {
    expect(serializeRpcFrame({ jsonrpc: "2.0", id: 1, result: "ok" }, 128)).toContain('"result":"ok"')
    expect(() => serializeRpcFrame({ jsonrpc: "2.0", id: 1, result: "x".repeat(256) }, 128))
      .toThrowError(expect.objectContaining({ kind: "RESPONSE_TOO_LARGE" }))
  })

  it("fails closed when an outbound result cannot be serialized", () => {
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    expect(() => serializeRpcFrame({ jsonrpc: "2.0", id: 1, result: cycle }))
      .toThrowError(expect.objectContaining({ kind: "RESPONSE_SERIALIZATION_FAILED" }))
  })
})
