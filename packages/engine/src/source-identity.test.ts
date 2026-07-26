import { execFileSync } from "node:child_process"
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { computeSourceIdentity, listSourceInputs } from "./source-identity.js"

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "gaep-srcid-"))
  writeFileSync(join(root, "package.json"), '{"name":"x","version":"0.2.0"}\n')
  mkdirSync(join(root, "packages", "engine", "src"), { recursive: true })
  writeFileSync(join(root, "packages", "engine", "src", "a.ts"), "export const a = 1\n")
  mkdirSync(join(root, "apps", "rider"), { recursive: true })
  writeFileSync(join(root, "apps", "rider", "build.gradle.kts"), "version = \"0.2.0\"\n")
  writeFileSync(join(root, "apps", "rider", "settings.gradle.kts"), "rootProject.name = \"gaep\"\n")
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe("engine source identity (INV-27)", () => {
  it("covers build inputs and excludes generated outputs and docs/examples", async () => {
    mkdirSync(join(root, "dist"), { recursive: true })
    writeFileSync(join(root, "dist", "out.js"), "generated\n")
    mkdirSync(join(root, "examples", "x", "acceptance"), { recursive: true })
    writeFileSync(join(root, "examples", "x", "acceptance", "report.json"), "{}\n")
    const inputs = await listSourceInputs(root)
    expect(inputs).toContain("package.json")
    expect(inputs).toContain("packages/engine/src/a.ts")
    expect(inputs).toContain("apps/rider/build.gradle.kts")
    expect(inputs.some((p) => p.startsWith("dist/"))).toBe(false)
    expect(inputs.some((p) => p.startsWith("examples/"))).toBe(false)
  })

  it("a committed CI tree and a byte-identical dirty local copy produce the same sourceTreeDigest", async () => {
    execFileSync("git", ["init", "-q"], { cwd: root })
    execFileSync("git", ["add", "-A"], { cwd: root })
    execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "base"], { cwd: root })
    const committed = await computeSourceIdentity(root)
    expect(committed.dirty).toBe(false)

    const copy = mkdtempSync(join(tmpdir(), "gaep-srcid-copy-"))
    cpSync(root, copy, { recursive: true })
    // Introduce an unrelated dirty change (an excluded generated output) — bytes of inputs unchanged.
    mkdirSync(join(copy, "dist"), { recursive: true })
    writeFileSync(join(copy, "dist", "x.js"), "gen\n")
    const dirty = await computeSourceIdentity(copy)
    expect(dirty.sourceTreeDigest).toBe(committed.sourceTreeDigest)
    rmSync(copy, { recursive: true, force: true })
  })

  it("changing a build input changes the digest; committing generated evidence alone does not", async () => {
    const before = await computeSourceIdentity(root)
    mkdirSync(join(root, "examples", "phase0-provider-model", "acceptance"), { recursive: true })
    writeFileSync(join(root, "examples", "phase0-provider-model", "acceptance", "report.json"), "{}\n")
    expect((await computeSourceIdentity(root)).sourceTreeDigest).toBe(before.sourceTreeDigest)
    writeFileSync(join(root, "apps", "rider", "build.gradle.kts"), "version = \"0.2.1\"\n")
    expect((await computeSourceIdentity(root)).sourceTreeDigest).not.toBe(before.sourceTreeDigest)
  })
})
