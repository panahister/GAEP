import type { ManagedEvidenceEvent } from "@gaep/contracts"
import type { ManagedExecutionHandle, ManagedExecutionReview } from "@gaep/engine"
import { describe, expect, it, vi } from "vitest"

import { ManagedRunSession } from "./managed-run-session.js"

async function * events(values: ManagedEvidenceEvent[]): AsyncIterable<ManagedEvidenceEvent> {
  for (const value of values) yield value
}

function fixture(
  completion: Promise<ManagedExecutionReview>,
  values: ManagedEvidenceEvent[] = [],
): ManagedExecutionHandle & { cancel: ReturnType<typeof vi.fn> } {
  return {
    record: { id: "00000000-0000-4000-8000-000000000111" } as ManagedExecutionHandle["record"],
    events: events(values),
    completion,
    cancel: vi.fn(async () => undefined),
  }
}

describe("ManagedRunSession", () => {
  it("drains bounded evidence before publishing the completed review", async () => {
    const review = { record: { id: "00000000-0000-4000-8000-000000000111" } } as ManagedExecutionReview
    const event = {
      sequence: 0,
      observedAt: "2026-07-21T00:00:00.000Z",
      type: "lifecycle",
      phase: "initialized",
    } as ManagedEvidenceEvent
    const observed: string[] = []
    const session = new ManagedRunSession("/workspace", fixture(Promise.resolve(review), [event]), {
      onEvent: (value) => { observed.push(`event:${value.sequence}`) },
      onReview: () => { observed.push("review") },
      onError: () => { observed.push("error") },
      onSettled: () => { observed.push("settled") },
    })

    await expect(session.completion).resolves.toBe(review)
    expect(observed).toEqual(["event:0", "review", "settled"])
  })

  it("cancels and waits for the exact managed completion", async () => {
    let resolveReview!: (review: ManagedExecutionReview) => void
    const completion = new Promise<ManagedExecutionReview>((resolve) => { resolveReview = resolve })
    const handle = fixture(completion)
    const session = new ManagedRunSession("/workspace", handle, {
      onEvent: () => undefined,
      onReview: () => undefined,
      onError: () => undefined,
      onSettled: () => undefined,
    })
    const stopping = session.stopAndWait(1_000)
    resolveReview({} as ManagedExecutionReview)

    await expect(stopping).resolves.toBeUndefined()
    expect(handle.cancel).toHaveBeenCalledOnce()
  })

  it("surfaces provider completion failures without an unhandled rejection", async () => {
    const failure = new Error("provider failed")
    const observed: string[] = []
    const session = new ManagedRunSession("/workspace", fixture(Promise.reject(failure)), {
      onEvent: () => undefined,
      onReview: () => undefined,
      onError: (error) => { observed.push(error.message) },
      onSettled: () => { observed.push("settled") },
    })

    await expect(session.completion).rejects.toThrow("provider failed")
    expect(observed).toEqual(["provider failed", "settled"])
  })
})
