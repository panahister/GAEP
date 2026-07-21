import { ZodError } from "zod"

export const MAX_RPC_FRAME_BYTES = 1024 * 1024

export class HostRpcError extends Error {
  constructor(
    readonly code: number,
    readonly kind: string,
    message: string,
    readonly data?: unknown,
  ) {
    super(message)
    this.name = "HostRpcError"
  }
}

export function normalizeRpcError(error: unknown): HostRpcError {
  if (error instanceof HostRpcError) return error
  return new HostRpcError(-32_603, "INTERNAL_ERROR", "The GAEP engine could not complete the request")
}

export function invalidParamsError(error: ZodError): HostRpcError {
  return new HostRpcError(-32_602, "INVALID_PARAMS", "Request parameters are invalid", {
    issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  })
}

export type DecodedRpcFrame =
  | { type: "line"; line: string }
  | { type: "error"; error: HostRpcError }

/** Incremental newline framing that stops retaining bytes once a frame is too large. */
export class RpcFrameDecoder {
  private chunks: Buffer[] = []
  private frameBytes = 0
  private discardingOversizedFrame = false

  constructor(readonly maxFrameBytes = MAX_RPC_FRAME_BYTES) {
    if (!Number.isSafeInteger(maxFrameBytes) || maxFrameBytes < 1) {
      throw new Error("maxFrameBytes must be a positive safe integer")
    }
  }

  push(chunk: Buffer): DecodedRpcFrame[] {
    const frames: DecodedRpcFrame[] = []
    let offset = 0
    while (offset < chunk.length) {
      const newline = chunk.indexOf(0x0a, offset)
      const end = newline === -1 ? chunk.length : newline
      const part = chunk.subarray(offset, end)

      if (!this.discardingOversizedFrame) {
        if (this.frameBytes + part.length > this.maxFrameBytes) {
          this.chunks = []
          this.frameBytes = 0
          this.discardingOversizedFrame = newline === -1
          frames.push({
            type: "error",
            error: new HostRpcError(
              -32_001,
              "FRAME_TOO_LARGE",
              `JSON-RPC frame exceeds ${this.maxFrameBytes} bytes`,
            ),
          })
        } else if (part.length > 0) {
          this.chunks.push(part)
          this.frameBytes += part.length
        }
      }

      if (newline !== -1) {
        if (this.discardingOversizedFrame) {
          this.discardingOversizedFrame = false
        } else if (this.frameBytes > 0) {
          frames.push({ type: "line", line: this.consumeLine() })
        }
        offset = newline + 1
      } else {
        offset = chunk.length
      }
    }
    return frames
  }

  end(): DecodedRpcFrame[] {
    if (this.discardingOversizedFrame) {
      this.discardingOversizedFrame = false
      return []
    }
    return this.frameBytes > 0 ? [{ type: "line", line: this.consumeLine() }] : []
  }

  private consumeLine(): string {
    const combined = Buffer.concat(this.chunks, this.frameBytes)
    this.chunks = []
    this.frameBytes = 0
    const withoutCarriageReturn = combined.at(-1) === 0x0d ? combined.subarray(0, -1) : combined
    return withoutCarriageReturn.toString("utf8")
  }
}
