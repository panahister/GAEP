import { ZodError } from "zod"

export const MAX_RPC_FRAME_BYTES = 1024 * 1024
export const MAX_RPC_ERROR_MESSAGE_BYTES = 4 * 1024
export const MAX_RPC_ERROR_DATA_BYTES = 64 * 1024

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

function truncateUtf8(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value) <= maxBytes) return value
  const suffix = "...[TRUNCATED]"
  const budget = Math.max(0, maxBytes - Buffer.byteLength(suffix))
  let low = 0
  let high = value.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (Buffer.byteLength(value.slice(0, middle)) <= budget) low = middle
    else high = middle - 1
  }
  return `${value.slice(0, low)}${suffix}`
}

function sanitizeRpcText(value: string): string {
  const sanitized = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "")
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/giu, "Bearer [REDACTED]")
    .replace(/\b(?:sk|sk-ant)-[A-Za-z0-9_-]{8,}\b/gu, "[REDACTED_API_KEY]")
    .replace(/\b(?:token|secret|password|api[_-]?key)\s*[:=]\s*[^\s,;]+/giu, "$1=[REDACTED]")
    .replace(/\b[A-Za-z]:[\\/][^\s"'<>]*/gu, "[ABSOLUTE_PATH]")
    .replace(/(^|[\s(="'])\\\\[^\s"'<>]*/gu, "$1[ABSOLUTE_PATH]")
    .replace(/(^|[\s(="'])\/(?!\/)[^\s"'<>)]*/gu, "$1[ABSOLUTE_PATH]")
  return truncateUtf8(sanitized, MAX_RPC_ERROR_MESSAGE_BYTES)
}

function sanitizeRpcData(value: unknown): unknown {
  const seen = new WeakSet<object>()
  const visit = (candidate: unknown, depth: number): unknown => {
    if (depth > 8) return "[DEPTH_LIMIT]"
    if (typeof candidate === "string") return sanitizeRpcText(candidate)
    if (typeof candidate === "number") return Number.isFinite(candidate) ? candidate : null
    if (typeof candidate === "boolean" || candidate === null) return candidate
    if (Array.isArray(candidate)) return candidate.slice(0, 256).map((entry) => visit(entry, depth + 1))
    if (candidate && typeof candidate === "object") {
      if (seen.has(candidate)) return "[CYCLE]"
      seen.add(candidate)
      return Object.fromEntries(Object.entries(candidate).slice(0, 256).map(([key, entry]) => [
        sanitizeRpcText(key),
        visit(entry, depth + 1),
      ]))
    }
    return String(candidate)
  }
  const sanitized = visit(value, 0)
  try {
    if (Buffer.byteLength(JSON.stringify(sanitized)) <= MAX_RPC_ERROR_DATA_BYTES) return sanitized
  } catch {
    // Fall through to the bounded marker.
  }
  return { truncated: true }
}

export function normalizeRpcError(error: unknown): HostRpcError {
  if (error instanceof HostRpcError) {
    return new HostRpcError(
      error.code,
      /^[A-Z0-9_]{1,64}$/u.test(error.kind) ? error.kind : "HOST_ERROR",
      sanitizeRpcText(error.message),
      error.data === undefined ? undefined : sanitizeRpcData(error.data),
    )
  }
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
