import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { startManagedClaudeContextRun } from "./managed-claude-run.js"
import type { ManagedRuntimeEvent } from "./managed-runtime.js"

const fixture = fileURLToPath(new URL("../test/fixtures/fake-claude-stream.mjs", import.meta.url))

async function collect(model: string) {
  const handle = await startManagedClaudeContextRun({
    executable: process.execPath,
    executableArguments: [fixture],
    model,
    objective: "Assess the supplied evidence",
    contextPack: "governed fixture context",
    timeoutMs: 2_000,
  })
  const events: ManagedRuntimeEvent[] = []
  const drain = (async () => {
    for await (const event of handle.events) events.push(event)
  })()
  const completion = await handle.completion
  await drain
  return { completion, events }
}

describe("managed Claude context runtime", () => {
  it("streams a bounded tool-free result and keeps local executable data separate", async () => {
    const { completion, events } = await collect("success")
    expect(completion.terminationCause).toBe("normal")
    expect(completion.result.portable.terminalDisposition).toBe("completed")
    expect(completion.result.portable.postconditionStatus).toBe("not-assessed")
    expect(completion.result.portable.providerThreadId).toBe("session-success")
    expect(events.some((event) => event.type === "output-delta")).toBe(true)
    expect(completion.result.local.executablePath).toBe(process.execPath)
  })

  it.each([
    ["failure", "failed", "provider-failure"],
    ["malformed", "protocol-error", "protocol-error"],
    ["no-result", "protocol-error", "protocol-error"],
  ] as const)("maps %s without treating process exit as outcome success", async (model, disposition, cause) => {
    const { completion } = await collect(model)
    expect(completion.result.portable.terminalDisposition).toBe(disposition)
    expect(completion.terminationCause).toBe(cause)
    expect(completion.result.portable.postconditionStatus).toBe("not-assessed")
  })

  it("cancels the whole managed process group", async () => {
    const handle = await startManagedClaudeContextRun({
      executable: process.execPath,
      executableArguments: [fixture],
      model: "wait",
      objective: "Wait for cancellation",
      contextPack: "governed fixture context",
      timeoutMs: 5_000,
    })
    const drain = (async () => {
      for await (const _event of handle.events) { /* drain */ }
    })()
    await new Promise((resolve) => setTimeout(resolve, 50))
    await handle.cancel("test cancellation")
    const completion = await handle.completion
    await drain
    expect(completion.terminationCause).toBe("cancel-request")
    expect(completion.result.portable.terminalDisposition).toBe("cancelled")
  })

  it("rejects unsafe budget values before spawning", async () => {
    await expect(startManagedClaudeContextRun({
      executable: process.execPath,
      executableArguments: [fixture],
      model: "success",
      objective: "Assess",
      contextPack: "context",
      maxBudgetUsd: 0,
    })).rejects.toThrow(/maximum budget/)
  })
})
