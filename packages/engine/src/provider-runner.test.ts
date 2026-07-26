import { describe, expect, it } from "vitest"

import type { AdapterCapabilities } from "@gaep/contracts"

import { CODEX_READ_ONLY_FLAGS, providerRunnerKind, runCodexReadOnlyTurn, type CodexTurnDriver } from "./provider-runner.js"

function caps(overrides: Partial<AdapterCapabilities>): AdapterCapabilities {
  return { adapterId: "gaep.codex-cli", executionInterface: "cli-jsonl", ...overrides } as AdapterCapabilities
}

function fakeDriver(overrides: Partial<CodexTurnDriver> = {}) {
  const calls: { start: unknown[]; startReadOnlyThread: unknown[]; startTurn: unknown[]; cancelTurn: unknown[]; awaitResult: unknown[]; stop: unknown[] } = { start: [], startReadOnlyThread: [], startTurn: [], cancelTurn: [], awaitResult: [], stop: [] }
  const driver: CodexTurnDriver = {
    allowShellTool: false,
    allowFileChanges: false,
    async start() { calls.start.push(true) },
    async startReadOnlyThread(o) { calls.startReadOnlyThread.push(o); return { threadId: "t1" } },
    async startTurn(o) { calls.startTurn.push(o); return { threadId: "t1", turnId: "u1" } },
    async cancelTurn(threadId, turnId) { calls.cancelTurn.push([threadId, turnId]) },
    async awaitResult(threadId, turnId) { calls.awaitResult.push([threadId, turnId]); return { status: "completed", text: "codex answer" } },
    async stop() { calls.stop.push(true) },
    ...overrides,
  }
  return { driver, calls }
}

describe("provider runner selection (INV-02/03)", () => {
  it("selects the Codex branch for a detected Codex cli-jsonl adapter", () => {
    expect(providerRunnerKind(caps({ adapterId: "gaep.codex-cli", executionInterface: "cli-jsonl" }))).toBe("codex")
  })
  it("selects the Claude branch for cli-stream-json", () => {
    expect(providerRunnerKind(caps({ adapterId: "gaep.claude-code-cli", executionInterface: "cli-stream-json" }))).toBe("claude")
  })
  it("read-only flags disable shell tool and file changes", () => {
    expect(CODEX_READ_ONLY_FLAGS).toEqual({ allowShellTool: false, allowFileChanges: false })
  })
})

describe("Codex read-only turn (INV-03)", () => {
  it("supplies only the bounded context and returns completed", async () => {
    const { driver, calls } = fakeDriver()
    const controller = new AbortController()
    const out = await runCodexReadOnlyTurn(driver, { model: "gpt-x", objective: "Summarize", contextText: "BOUNDED-CTX-42", signal: controller.signal, timeoutMs: 1000 })
    expect(out.kind).toBe("completed")
    // The bounded context is supplied to the runner's turn prompt.
    expect(String((calls.startTurn[0] as { prompt: string }).prompt)).toContain("BOUNDED-CTX-42")
    expect(String((calls.startTurn[0] as { prompt: string }).prompt)).toContain("Do not modify files")
    expect(calls.stop).toHaveLength(1)
  })

  it("refuses to run if the driver grants shell or file-change authority", async () => {
    const { driver } = fakeDriver({ allowFileChanges: true })
    const out = await runCodexReadOnlyTurn(driver, { model: "m", objective: "x", contextText: "y", signal: new AbortController().signal, timeoutMs: 1000 })
    expect(out.kind).toBe("failed")
  })

  it("propagates cancellation to the runner (cancelTurn + stop)", async () => {
    let resolveResult: (v: { status: "completed" | "failed"; text?: string }) => void = () => {}
    const { driver, calls } = fakeDriver({ awaitResult: () => new Promise((r) => { resolveResult = r }) })
    const controller = new AbortController()
    const promise = runCodexReadOnlyTurn(driver, { model: "m", objective: "x", contextText: "y", signal: controller.signal, timeoutMs: 1000 })
    // Let the runner reach awaitResult (attach the abort listener) before cancelling.
    await new Promise((r) => setTimeout(r, 15))
    controller.abort()
    resolveResult({ status: "completed", text: "late" })
    const out = await promise
    expect(out.kind).toBe("cancelled")
    expect(calls.cancelTurn).toHaveLength(1)
    expect(calls.stop).toHaveLength(1)
  })

  it("classifies an auth failure as auth-unavailable", async () => {
    const { driver } = fakeDriver({ awaitResult: async () => ({ status: "failed", failureDetail: "Error: not logged in" }) })
    const out = await runCodexReadOnlyTurn(driver, { model: "m", objective: "x", contextText: "y", signal: new AbortController().signal, timeoutMs: 1000 })
    expect(out).toEqual({ kind: "failed", failureCategory: "auth-unavailable" })
  })
})
