import { describe, expect, it } from "vitest"

import { HostRpcError, normalizeRpcError, RpcFrameDecoder } from "./rpc.js"

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
})
