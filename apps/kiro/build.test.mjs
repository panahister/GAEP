import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { resolveVsceCli } from "./build.mjs"

const here = dirname(fileURLToPath(import.meta.url))

describe("Kiro packaging invocation (Windows-safe, no npx launcher)", () => {
  it("resolves the installed VSCE JavaScript entry so it runs under the current Node runtime", () => {
    const cli = resolveVsceCli()
    expect(existsSync(cli)).toBe(true)
    // A real JavaScript entry (never `npx`/`npx.cmd`); it runs with process.execPath, shell:false.
    expect(cli.endsWith(".js") || cli.endsWith("vsce")).toBe(true)
    expect(cli).not.toContain("npx")
    // The resolved entry is executable by Node (prints its help) — proving the packaging path works
    // identically on every OS, including Windows, without a shell.
    const help = execFileSync(process.execPath, [cli, "--help"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    expect(help.toLowerCase()).toContain("vsce")
  })

  it("keeps runtime-only package membership and the embedded Engine Host + digest sidecar", () => {
    const build = readFileSync(join(here, "build.mjs"), "utf8")
    // The packaging call uses the current Node runtime and the exact vsce arguments; no npx launcher.
    expect(build).toContain("execFileSync(process.execPath, [resolveVsceCli(), \"package\", \"--no-dependencies\", \"--allow-missing-repository\", \"-o\", outVsix]")
    expect(build).not.toMatch(/execFileSync\(\s*["']npx/)
    expect(build).not.toContain("shell: true")
    // Runtime membership + embedded Engine Host bundle and its digest sidecar remain.
    expect(build).toContain("dist/engine-host/gaep-engine-host-0.2.0.cjs")
    expect(build).toContain("dist/engine-host/engine-host.sha256")
  })
})
