import { StringDecoder } from "node:string_decoder"

export const maximumProviderEventCharacters = 256 * 1024
export const maximumProviderChunkCharacters = 1024 * 1024
export const maximumRenderedProviderCharacters = 8 * 1024 * 1024

export function sanitizeTerminalText(value: string): string {
  return value
    .replace(/\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g, "")
    .replace(/\u001B[P^_][\s\S]*?\u001B\\/g, "")
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\u001B[@-_]/g, "")
    .replace(/\r/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "�")
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, "")
}

export function prefixTerminalLines(prefix: string, value: string): string {
  return sanitizeTerminalText(value)
    .split("\n")
    .map((line) => `${prefix} ${line}`)
    .join("\r\n")
}

export class OutputLimiter {
  private emitted = 0
  private didTruncate = false

  constructor(private readonly maximumCharacters: number) {
    if (!Number.isInteger(maximumCharacters) || maximumCharacters < 1) {
      throw new Error("Output limit must be a positive integer")
    }
  }

  take(value: string): { value: string; truncationStarted: boolean } {
    if (this.didTruncate) return { value: "", truncationStarted: false }
    const remaining = this.maximumCharacters - this.emitted
    if (value.length <= remaining) {
      this.emitted += value.length
      return { value, truncationStarted: false }
    }
    const accepted = remaining > 0 ? value.slice(0, remaining) : ""
    this.emitted += accepted.length
    this.didTruncate = true
    return { value: accepted, truncationStarted: true }
  }

  get truncated(): boolean {
    return this.didTruncate
  }
}

export class ProcessTerminationTracker {
  private exited = false
  private gracefulSignalSent = false
  private forceSignalSent = false

  markExited(): void {
    this.exited = true
  }

  requestGracefulSignal(): boolean {
    if (this.exited || this.gracefulSignalSent) return false
    this.gracefulSignalSent = true
    return true
  }

  requestForceSignal(): boolean {
    if (this.exited || this.forceSignalSent) return false
    this.forceSignalSent = true
    return true
  }

  get hasExited(): boolean {
    return this.exited
  }
}

export class Utf8StreamDecoder {
  private readonly decoder = new StringDecoder("utf8")

  write(chunk: Buffer): string {
    return this.decoder.write(chunk)
  }

  end(): string {
    return this.decoder.end()
  }
}

export interface RunExitDisposition {
  state: "failed" | "cancelled" | "unknown"
  terminalCode: number
  detail?: string
}

export function runExitDisposition(
  stopRequested: boolean,
  code: number | null,
  signal: NodeJS.Signals | null,
): RunExitDisposition {
  if (stopRequested) return { state: "cancelled", terminalCode: code ?? 1 }
  if (signal) {
    return {
      state: "failed",
      terminalCode: code ?? 1,
      detail: `Provider process terminated unexpectedly with signal ${signal}.`,
    }
  }
  if (code === 0) {
    return {
      state: "unknown",
      terminalCode: 0,
      detail: "Provider process exited successfully; GAEP has not verified the requested outcome or required evidence.",
    }
  }
  return { state: "failed", terminalCode: code ?? 1 }
}
