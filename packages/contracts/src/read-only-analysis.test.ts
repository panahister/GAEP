import { describe, expect, it } from "vitest"

import { ANALYSIS_FAILURE_SUMMARIES, analysisRunRecordSchema, sanitizeProviderText } from "./index.js"

const at = "2026-07-24T00:00:00.000Z"
const digest = `sha256:${"a".repeat(64)}`

function envelope(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    scope: "read-only-analysis",
    authority: "user-initiated",
    adapterId: "gaep.claude-code-cli",
    modelId: "sonnet",
    modelTruthClass: "provider-declared",
    modelAlias: true,
    capabilityDigest: digest,
    contextPackIds: ["11111111-1111-4111-8111-111111111111"],
    contextPackDigest: digest,
    contextBytes: 1024,
    sourceIdentity: { sourceTreeDigest: digest, baseCommit: "a".repeat(40), dirty: false },
    objectiveDigest: digest,
    timeoutMs: 120000,
    idempotencyKey: "22222222-2222-4222-8222-222222222222",
    startedAt: at,
  }
}

function record(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    analysisRunId: "33333333-3333-4333-8333-333333333333",
    state: "completed",
    envelope: envelope(),
    startedAt: at,
    endedAt: at,
    terminationCause: "normal",
    result: { text: "ok", truncated: false },
    ...overrides,
  }
}

describe("read-only analysis contract", () => {
  it("accepts a completed run with a result", () => {
    expect(() => analysisRunRecordSchema.parse(record())).not.toThrow()
  })

  it("requires a result for completed and a failure category for failed", () => {
    expect(analysisRunRecordSchema.safeParse(record({ result: undefined })).success).toBe(false)
    expect(analysisRunRecordSchema.safeParse(record({ state: "failed", result: undefined })).success).toBe(false)
    expect(analysisRunRecordSchema.safeParse(record({
      state: "failed", result: undefined, failureCategory: "provider-error",
      failureSummary: ANALYSIS_FAILURE_SUMMARIES["provider-error"],
    })).success).toBe(true)
  })

  it("requires endedAt for terminal states", () => {
    expect(analysisRunRecordSchema.safeParse(record({ endedAt: undefined })).success).toBe(false)
    expect(analysisRunRecordSchema.safeParse(record({ state: "running", endedAt: undefined, result: undefined, terminationCause: undefined })).success).toBe(true)
  })

  it("rejects a failureSummary that is not the allowlisted text (INV-17)", () => {
    expect(analysisRunRecordSchema.safeParse(record({
      state: "failed", result: undefined, failureCategory: "provider-error",
      failureSummary: "boom at /Users/me/secret.txt",
    })).success).toBe(false)
  })

  it("sanitizes absolute paths and control characters from provider output (INV-17)", () => {
    const raw = "failed at /Users/someone/secret/token.txt\u0007 and C:\\Users\\me\\key.pem and ~/.ssh/id_rsa"
    const out = sanitizeProviderText(raw)
    expect(out.text).not.toContain("/Users/someone")
    expect(out.text).not.toContain("C:\\Users")
    expect(out.text).not.toContain("~/.ssh")
    expect(out.text).toContain("[redacted-path]")
    expect(out.text).not.toContain("\u0007")
  })

  it("truncates oversized provider output on a UTF-8 boundary", () => {
    const out = sanitizeProviderText("x".repeat(20_000))
    expect(out.truncated).toBe(true)
    expect(Buffer.byteLength(out.text, "utf8")).toBeLessThanOrEqual(8_192)
  })
})
