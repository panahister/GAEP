import { describe, expect, it } from "vitest"

import { sourceIdentityMatches, sourceIdentitySchema, type SourceIdentity } from "./index.js"

const treeDigest = `sha256:${"b".repeat(64)}`

function identity(overrides: Partial<SourceIdentity> = {}): SourceIdentity {
  return { sourceTreeDigest: treeDigest, baseCommit: "a".repeat(40), dirty: false, ...overrides }
}

describe("source identity contract", () => {
  it("accepts a well-formed identity and rejects malformed values", () => {
    expect(() => sourceIdentitySchema.parse(identity())).not.toThrow()
    expect(sourceIdentitySchema.safeParse(identity({ baseCommit: "short" })).success).toBe(false)
    expect(sourceIdentitySchema.safeParse({ ...identity(), sourceTreeDigest: "nope" }).success).toBe(false)
  })

  it("treats byte-identical trees as equal regardless of provenance metadata (INV-27)", () => {
    const localDirty = identity({ dirty: true, baseCommit: "c".repeat(40) })
    const committedCi = identity({ dirty: false, baseCommit: "d".repeat(40) })
    expect(sourceIdentityMatches(localDirty, committedCi)).toBe(true)
  })

  it("rejects any sourceTreeDigest difference", () => {
    expect(sourceIdentityMatches(identity(), identity({ sourceTreeDigest: `sha256:${"e".repeat(64)}` }))).toBe(false)
  })
})
