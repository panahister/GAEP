import { describe, expect, it } from "vitest"

import { safeErrorMessage, sanitizeDiagnosticText } from "./diagnostic-safety.js"

describe("VS Code diagnostic safety", () => {
  it("redacts machine paths, secrets, control bytes, and bounds output", () => {
    const value = [
      "probe failed at /Users/alice/.local/bin/codex",
      "Windows C:\\Users\\alice\\codex.exe",
      "token=top-secret-value",
      "Bearer provider-session-value",
      "sk-ant-1234567890abcdef",
      "\u0000",
      "x".repeat(10_000),
    ].join(" ")
    const sanitized = sanitizeDiagnosticText(value)

    expect(sanitized).not.toContain("/Users/alice")
    expect(sanitized).not.toContain("C:\\Users\\alice")
    expect(sanitized).not.toContain("top-secret-value")
    expect(sanitized).not.toContain("provider-session-value")
    expect(sanitized).not.toContain("sk-ant-1234567890abcdef")
    expect(sanitized).not.toContain("\u0000")
    expect(sanitized).toContain("[MACHINE_PATH]")
    expect(sanitized).toContain("[REDACTED]")
    expect(sanitized.length).toBeLessThanOrEqual(4_096)
  })

  it("uses a sanitized fallback for non-Error failures", () => {
    expect(safeErrorMessage({ secret: "not inspected" }, "failed at /tmp/private token=value"))
      .toBe("failed at [MACHINE_PATH] token=[REDACTED]")
  })
})
