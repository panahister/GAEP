import { describe, expect, it } from "vitest"

import { runtimeBindingKey, sameExecutableFingerprint } from "./runtime-binding.js"

const fingerprint = {
  canonicalPath: "/opt/gaep/bin/codex",
  digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const,
  size: 42,
  modifiedAtMs: 123,
}

describe("runtime bindings", () => {
  it("uses both Product root and adapter identity", () => {
    expect(runtimeBindingKey("/work/a", "gaep.codex-cli")).not.toBe(
      runtimeBindingKey("/work/b", "gaep.codex-cli"),
    )
    expect(runtimeBindingKey("/work/a", "gaep.codex-cli")).not.toBe(
      runtimeBindingKey("/work/a", "gaep.other"),
    )
  })

  it("rejects same-path replacement and metadata drift", () => {
    expect(sameExecutableFingerprint(fingerprint, { ...fingerprint })).toBe(true)
    expect(sameExecutableFingerprint(fingerprint, { ...fingerprint, digest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" })).toBe(false)
    expect(sameExecutableFingerprint(fingerprint, { ...fingerprint, modifiedAtMs: 124 })).toBe(false)
  })
})
