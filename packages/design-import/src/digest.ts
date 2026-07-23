import { createHash } from "node:crypto"

function normalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Canonical JSON cannot contain non-finite numbers")
    return Object.is(value, -0) ? 0 : value
  }
  if (Array.isArray(value)) return value.map(normalize)
  if (typeof value === "object") {
    const normalized: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const item = (value as Record<string, unknown>)[key]
      if (item !== undefined) normalized[key] = normalize(item)
    }
    return normalized
  }
  throw new Error(`Canonical JSON cannot contain ${typeof value}`)
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value))
}

export function sha256(value: Uint8Array | string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

export function canonicalDigest(value: unknown): `sha256:${string}` {
  return sha256(canonicalJson(value))
}
