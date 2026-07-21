import { describe, expect, it } from "vitest"

import {
  OutputLimiter,
  prefixTerminalLines,
  ProcessTerminationTracker,
  runExitDisposition,
  sanitizeTerminalText,
  Utf8StreamDecoder,
} from "./terminal-safety.js"

describe("agent terminal safety", () => {
  it("removes terminal control sequences and prefixes every provider line", () => {
    const malicious = "ok\u001b[2J\u001b]0;spoofed title\u0007\rFAKE GAEP\nsecond\u202Eline"
    expect(sanitizeTerminalText(malicious)).toBe("okFAKE GAEP\nsecondline")
    expect(prefixTerminalLines("[provider]", malicious)).toBe("[provider] okFAKE GAEP\r\n[provider] secondline")
  })

  it("bounds total rendered provider output and reports only the first truncation", () => {
    const limiter = new OutputLimiter(5)
    expect(limiter.take("abc")).toEqual({ value: "abc", truncationStarted: false })
    expect(limiter.take("def")).toEqual({ value: "de", truncationStarted: true })
    expect(limiter.take("more")).toEqual({ value: "", truncationStarted: false })
    expect(limiter.truncated).toBe(true)
  })

  it("allows force escalation after a graceful signal until process exit is observed", () => {
    const tracker = new ProcessTerminationTracker()
    expect(tracker.requestGracefulSignal()).toBe(true)
    expect(tracker.requestGracefulSignal()).toBe(false)
    expect(tracker.requestForceSignal()).toBe(true)
    tracker.markExited()
    expect(tracker.requestForceSignal()).toBe(false)
    expect(tracker.hasExited).toBe(true)
  })

  it("preserves UTF-8 characters split across provider chunks", () => {
    const decoder = new Utf8StreamDecoder()
    const encoded = Buffer.from('{"message":"ready 🚀"}\n', "utf8")
    const splitInsideRocket = encoded.indexOf(Buffer.from("🚀", "utf8")) + 2
    expect(decoder.write(encoded.subarray(0, splitInsideRocket))).toBe('{"message":"ready ')
    expect(decoder.write(encoded.subarray(splitInsideRocket))).toBe('🚀"}\n')
    expect(decoder.end()).toBe("")

    const incompleteAtClose = new Utf8StreamDecoder()
    expect(incompleteAtClose.write(Buffer.from([0xe2]))).toBe("")
    expect(incompleteAtClose.end()).toBe("�")
  })

  it("classifies only explicit user stops as cancelled", () => {
    expect(runExitDisposition(true, null, "SIGTERM")).toEqual({ state: "cancelled", terminalCode: 1 })
    expect(runExitDisposition(false, null, "SIGKILL")).toEqual({
      state: "failed",
      terminalCode: 1,
      detail: "Provider process terminated unexpectedly with signal SIGKILL.",
    })
    expect(runExitDisposition(false, 0, null).state).toBe("unknown")
  })
})
