import { describe, expect, it } from "vitest"

import { canonicalDigest, canonicalJson } from "./digest.js"

describe("canonical serialization", () => {
  it("produces the same digest regardless of object key order", () => {
    expect(canonicalDigest({ beta: 2, alpha: { z: true, a: false } })).toBe(
      canonicalDigest({ alpha: { a: false, z: true }, beta: 2 }),
    )
  })

  it("preserves array order", () => {
    expect(canonicalJson({ values: ["first", "second"] })).not.toBe(
      canonicalJson({ values: ["second", "first"] }),
    )
  })
})
