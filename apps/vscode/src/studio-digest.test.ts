import { canonicalDigest } from "@gaep/agent-sdk"
import { describe, expect, it } from "vitest"

import { canonicalStudioDigest } from "./studio-digest.js"

describe("browser-safe Product Studio digest", () => {
  it("matches the authoritative canonical digest for nested portable values", () => {
    const value = {
      z: [true, null, -0, "Unicode گواهی 🚀"],
      a: { omitted: undefined, finite: 42.5, nested: ["b", "a"] },
    }
    expect(canonicalStudioDigest(value)).toBe(canonicalDigest(value))
  })

  it("matches the standard empty-string SHA-256 vector", () => {
    expect(canonicalStudioDigest("")).toBe("sha256:12ae32cb1ec02d01eda3581b127c1fee3b0dc53572ed6baf239721a03d82e126")
  })

  it("rejects values outside canonical JSON", () => {
    expect(() => canonicalStudioDigest({ value: Number.NaN })).toThrow(/non-finite/)
    expect(() => canonicalStudioDigest({ value: 1n })).toThrow(/bigint/)
  })
})
