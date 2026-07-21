import { describe, expect, it } from "vitest"

import { localActorStateKey, resolveLocalActorPrincipal } from "./local-actor.js"

class MemoryState {
  readonly values = new Map<string, unknown>()
  readonly writes: Array<{ key: string; value: unknown }> = []

  get<T>(key: string): T | undefined {
    return this.values.get(key) as T | undefined
  }

  update(key: string, value: unknown): Promise<void> {
    this.values.set(key, value)
    this.writes.push({ key, value })
    return Promise.resolve()
  }
}

describe("machine-local actor principal", () => {
  it("generates and persists one UUID-backed identity without granting authority", async () => {
    const state = new MemoryState()
    const principal = await resolveLocalActorPrincipal(state, () => "11111111-1111-4111-8111-111111111111")
    expect(principal).toEqual({
      id: "gaep.local-user:11111111-1111-4111-8111-111111111111",
      uuid: "11111111-1111-4111-8111-111111111111",
      scope: "machine-local",
      authority: "identity-only",
    })
    expect(state.writes).toEqual([{ key: localActorStateKey, value: { uuid: principal.uuid } }])
  })

  it("reuses a valid persisted UUID and migrates legacy or malformed values", async () => {
    const state = new MemoryState()
    state.values.set(localActorStateKey, { uuid: "22222222-2222-4222-8222-222222222222" })
    expect((await resolveLocalActorPrincipal(state, () => "unused")).uuid).toBe("22222222-2222-4222-8222-222222222222")
    expect(state.writes).toEqual([])

    state.values.set(localActorStateKey, "gaep.local-founder")
    const migrated = await resolveLocalActorPrincipal(state, () => "33333333-3333-4333-8333-333333333333")
    expect(migrated.uuid).toBe("33333333-3333-4333-8333-333333333333")
    expect(state.values.get(localActorStateKey)).toEqual({ uuid: migrated.uuid })
  })
})
