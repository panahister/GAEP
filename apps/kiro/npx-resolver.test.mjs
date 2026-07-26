import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { npxExecutable } from "./npx-resolver.mjs"

const here = dirname(fileURLToPath(import.meta.url))

describe("Kiro npx resolver (Windows ENOENT fix)", () => {
  it("resolves npx.cmd on win32 and npx elsewhere", () => {
    expect(npxExecutable("win32")).toBe("npx.cmd")
    expect(npxExecutable("linux")).toBe("npx")
    expect(npxExecutable("darwin")).toBe("npx")
  })

  it("keeps the existing packaging arguments and does not enable shell", () => {
    const build = readFileSync(join(here, "build.mjs"), "utf8")
    // The exact vsce packaging arguments are unchanged.
    expect(build).toContain('["--no-install", "vsce", "package", "--no-dependencies", "--allow-missing-repository", "-o", outVsix]')
    // execFileSync is still used with the resolved executable; no shell:true is introduced.
    expect(build).toContain("execFileSync(npxExecutable()")
    expect(build).not.toContain("shell: true")
    expect(build).not.toContain("shell:true")
  })
})
