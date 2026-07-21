import { describe, expect, it } from "vitest"

import type { AgentSelection } from "@gaep/contracts"

import { DeterministicManualAdapter } from "./manual-adapter.js"
import type { ManagedRuntimeEvent } from "./managed-runtime.js"
import { capabilityDigest } from "./validation.js"

async function collect(events: AsyncIterable<ManagedRuntimeEvent>): Promise<ManagedRuntimeEvent[]> {
  const collected: ManagedRuntimeEvent[] = []
  for await (const event of events) collected.push(event)
  return collected
}

describe("deterministic manual adapter", () => {
  it("is a real offline AgentAdapter capability with a local in-process binding and no executable path", async () => {
    const adapter = new DeterministicManualAdapter()
    const { capabilities, runtimeBinding } = await adapter.probe()
    const selection = {
      schemaVersion: 2,
      adapterId: adapter.id,
      agentId: "manual",
      modelId: "manual-deterministic-v1",
      modelTruthClass: "configured",
      modelAlias: false,
      settings: { script: "success" },
      selectedAt: "2026-01-01T00:00:00.000Z",
      capabilityDigest: capabilityDigest(capabilities),
    } satisfies AgentSelection

    expect(capabilities).toMatchObject({ schemaVersion: 1, detected: true, executionInterface: "managed-in-process" })
    expect(capabilities).not.toHaveProperty("executablePath")
    expect(runtimeBinding).toEqual({
      scope: "machine-local",
      kind: "managed-in-process",
      adapterId: adapter.id,
      agentId: "manual",
      runtimeId: adapter.id,
    })
    expect(adapter.validateSelection(selection, capabilities)).toEqual([])
    expect(() => adapter.buildInvocation(selection, {} as never, "/workspace", "prompt", runtimeBinding)).toThrow("in-process")
  })

  it("replays byte-stable normalized events and a successful terminal result", async () => {
    const adapter = new DeterministicManualAdapter()
    const first = adapter.start({ scriptId: "success" })
    const firstEvents = collect(first.events)
    const firstResult = await first.completion
    const second = adapter.start({ scriptId: "success" })
    const secondEvents = collect(second.events)
    const secondResult = await second.completion

    expect(await firstEvents).toEqual(await secondEvents)
    expect(firstResult.portable).toEqual(secondResult.portable)
    expect(firstResult.portable.terminalDisposition).toBe("completed")
    expect(firstResult.portable.postconditionStatus).toBe("satisfied")
    expect(firstResult.local).toEqual({})
  })

  it("produces a scripted failure without throwing away prior events", async () => {
    const run = new DeterministicManualAdapter().start({ scriptId: "failure" })
    const events = collect(run.events)
    const result = await run.completion

    expect(result.portable.terminalDisposition).toBe("failed")
    expect((await events).at(-1)).toMatchObject({ type: "error", message: "deterministic scripted failure" })
  })

  it("waits for deterministic cancellation and settles once", async () => {
    const run = new DeterministicManualAdapter().start({ scriptId: "cancellation" })
    const events = collect(run.events)
    await run.cancel("test cancellation")
    await run.cancel("duplicate cancellation")
    const result = await run.completion

    expect(result.portable.terminalDisposition).toBe("cancelled")
    expect((await events).filter((event) => event.type === "lifecycle" && event.phase === "cancelled")).toHaveLength(1)
  })

  it("requires the exact scripted provider thread when resuming", async () => {
    const adapter = new DeterministicManualAdapter()
    expect(() => adapter.resume("resume", "wrong-thread")).toThrow("does not match")

    const run = adapter.resume("resume", "manual-thread-resume")
    const events = collect(run.events)
    const result = await run.completion
    expect(result.portable.providerThreadId).toBe("manual-thread-resume")
    expect(result.portable.postconditionStatus).toBe("indeterminate")
    expect((await events)[0]).toMatchObject({ type: "lifecycle", phase: "thread-resumed" })
  })
})
