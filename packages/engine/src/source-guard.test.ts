import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  GOVERNED_MUTATION_ALLOWLIST,
  assertNoProductMutation,
  diffProductDigests,
  isGovernedAllowlistedPath,
  snapshotProductDigests,
} from "./source-guard.js"

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "gaep-guard-"))
  mkdirSync(join(root, "src"), { recursive: true })
  writeFileSync(join(root, "src", "app.ts"), "export const a = 1\n")
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe("product source guard", () => {
  it("detects added, modified, and deleted Product files (INV-04)", async () => {
    const before = await snapshotProductDigests(root)
    writeFileSync(join(root, "src", "app.ts"), "export const a = 2\n")
    writeFileSync(join(root, "src", "new.ts"), "export const b = 1\n")
    const after = await snapshotProductDigests(root)
    const violations = diffProductDigests(before, after)
    expect(violations.map((v) => v.kind).sort()).toEqual(["added", "modified"])
    expect(() => assertNoProductMutation(before, after)).toThrow()
  })

  it("gaep-allowed: governed .gaep writes are not Product-source mutations (INV-05)", async () => {
    const before = await snapshotProductDigests(root)
    mkdirSync(join(root, ".gaep", "runs"), { recursive: true })
    writeFileSync(join(root, ".gaep", "runs", "run.json"), "{}\n")
    mkdirSync(join(root, ".gaep", "runtime"), { recursive: true })
    writeFileSync(join(root, ".gaep", "runtime", "selection.json"), "{}\n")
    const after = await snapshotProductDigests(root)
    expect(diffProductDigests(before, after)).toEqual([])
    expect(() => assertNoProductMutation(before, after)).not.toThrow()
  })

  it("allowlist: permits exactly the governed portable records and nothing else (INV-05)", () => {
    expect(isGovernedAllowlistedPath(".gaep/runtime/selection.json")).toBe(true)
    expect(isGovernedAllowlistedPath(".gaep/runs/abc.json")).toBe(true)
    expect(isGovernedAllowlistedPath(".gaep/evidence/x.json")).toBe(true)
    expect(isGovernedAllowlistedPath(".gaep/audit/log.jsonl")).toBe(true)
    expect(isGovernedAllowlistedPath(".gaep/product-studio/context-pack/p.json")).toBe(true)
    // Not on the allowlist:
    expect(isGovernedAllowlistedPath(".gaep/runtime/engine-host.pid")).toBe(false)
    expect(isGovernedAllowlistedPath(".gaep/selection/provider-model.json")).toBe(false)
    expect(isGovernedAllowlistedPath("src/app.ts")).toBe(false)
    expect(GOVERNED_MUTATION_ALLOWLIST).toHaveLength(5)
  })
})
