import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const here = dirname(fileURLToPath(import.meta.url))
const script = join(here, "build-sea.mjs")
const nodeTarget = JSON.parse(readFileSync(join(here, "node-target.json"), "utf8"))

function runSea(args, env = {}) {
  try {
    execFileSync(process.execPath, [script, ...args], { env: { ...process.env, ...env }, stdio: "pipe" })
    return 0
  } catch (error) {
    return error.status ?? 1
  }
}

describe("Engine Host SEA build (INV-21/22, fail closed)", () => {
  it("rejects an unsupported target", () => {
    expect(runSea(["darwin-arm64"])).not.toBe(0)
  })

  it("refuses to build when the provided Node binary does not match the pinned executable digest (no artifact)", () => {
    // win32-x64 pins the extracted node.exe digest; this process's node is not that binary.
    const outName = "gaep-engine-host-0.2.0-win32-x64.exe"
    const outPath = join(here, "..", "..", "dist", "phase0", "cs02", "engine-host", outName)
    expect(runSea(["win32-x64"], { GAEP_SEA_NODE_BINARY: process.execPath })).not.toBe(0)
    expect(existsSync(outPath)).toBe(false)
  })

  it("refuses to build when the target Node binary is not provided", () => {
    expect(runSea(["win32-x64"])).not.toBe(0)
  })

  it("pins real (non-placeholder) archive AND extracted-executable Node 22.11.0 digests for both targets", () => {
    expect(nodeTarget.nodeVersion).toBe("22.11.0")
    for (const target of ["win32-x64", "linux-x64"]) {
      const pin = nodeTarget.targets[target]
      expect(pin.archiveSha256).toMatch(/^sha256:[0-9a-f]{64}$/)
      expect(pin.archiveSha256).not.toMatch(/0{64}/)
      expect(pin.executablePath).toContain("node-v22.11.0")
      // The extracted-executable digest is pinned for BOTH targets and differs from the archive digest.
      expect(pin.executableSha256).toMatch(/^sha256:[0-9a-f]{64}$/)
      expect(pin.executableSha256).not.toMatch(/0{64}/)
      expect(pin.executableSha256).not.toBe(pin.archiveSha256)
    }
  })

  it("refuses the linux-x64 build when the provided Node binary does not match the pinned executable digest", () => {
    const outName = "gaep-engine-host-0.2.0-linux-x64"
    const outPath = join(here, "..", "..", "dist", "phase0", "cs02", "engine-host", outName)
    expect(runSea(["linux-x64"], { GAEP_SEA_NODE_BINARY: process.execPath })).not.toBe(0)
    expect(existsSync(outPath)).toBe(false)
  })
})
