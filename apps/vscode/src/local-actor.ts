import { randomUUID } from "node:crypto"

export const localActorStateKey = "gaep.localActorPrincipal.v1"

export interface LocalActorPrincipal {
  id: `gaep.local-user:${string}`
  uuid: string
  scope: "machine-local"
  authority: "identity-only"
}

interface GlobalStateReader {
  get<T>(key: string): T | undefined
  update(key: string, value: unknown): Thenable<void>
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

/** Creates one non-secret machine-local identity. It conveys attribution only. */
export async function resolveLocalActorPrincipal(
  state: GlobalStateReader,
  createUuid: () => string = randomUUID,
): Promise<LocalActorPrincipal> {
  const stored = state.get<unknown>(localActorStateKey)
  const storedUuid = typeof stored === "object" && stored !== null && "uuid" in stored
    ? (stored as { uuid?: unknown }).uuid
    : stored
  const uuid = validUuid(storedUuid) ? storedUuid : createUuid()
  if (!validUuid(uuid)) throw new Error("The generated local actor ID is not a UUID")
  if (uuid !== storedUuid) await state.update(localActorStateKey, { uuid })
  return {
    id: `gaep.local-user:${uuid}`,
    uuid,
    scope: "machine-local",
    authority: "identity-only",
  }
}
