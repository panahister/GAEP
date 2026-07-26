import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { bundledEngineHostPaths, parseDigestSidecar, resolveEngineHostLaunch, verifyBundledEngineHost, CS02_ENGINE_HOST_BUNDLE } from "./engine-host-client.js"

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "gaep-vscode-eh-"))
  mkdirSync(join(root, "dist", "engine-host"), { recursive: true })
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

function writeRuntime(bytes: string, digestBytes = bytes): void {
  const dir = join(root, "dist", "engine-host")
  writeFileSync(join(dir, CS02_ENGINE_HOST_BUNDLE), bytes)
  const digest = `sha256:${createHash("sha256").update(digestBytes).digest("hex")}`
  writeFileSync(join(dir, "engine-host.sha256"), `${digest}  ${CS02_ENGINE_HOST_BUNDLE}\n`)
}

describe("VS Code Engine Host client (INV-21/22)", () => {
  it("verifies the bundled runtime against its digest sidecar", () => {
    writeRuntime("runtime-bytes")
    expect(() => verifyBundledEngineHost(bundledEngineHostPaths(root))).not.toThrow()
  })

  it("refuses to launch on a digest mismatch (rpc-boundary integrity)", () => {
    writeRuntime("runtime-bytes", "different-bytes")
    expect(() => verifyBundledEngineHost(bundledEngineHostPaths(root))).toThrow(/mismatch/)
    expect(() => resolveEngineHostLaunch({ extensionRoot: root, workspacePath: "/ws", execPath: "/node", env: {} })).toThrow()
  })

  it("refuses to launch when the digest sidecar is missing", () => {
    writeFileSync(join(root, "dist", "engine-host", CS02_ENGINE_HOST_BUNDLE), "x")
    expect(() => verifyBundledEngineHost(bundledEngineHostPaths(root))).toThrow(/digest is missing/)
  })

  it("launches the bundled runtime via the IDE node runtime and never uses PATH", () => {
    writeRuntime("runtime-bytes")
    const launch = resolveEngineHostLaunch({ extensionRoot: root, workspacePath: "/ws", execPath: "/path/to/electron", env: {} })
    expect(launch.command).toBe("/path/to/electron")
    expect(launch.args[0]).toContain(CS02_ENGINE_HOST_BUNDLE)
    expect(launch.args).toContain("--workspace")
    expect(launch.env.ELECTRON_RUN_AS_NODE).toBe("1")
  })

  it("dev-override: GAEP_ENGINE_EXECUTABLE is ignored unless GAEP_DEV_ENGINE=1", () => {
    writeRuntime("runtime-bytes")
    const withoutFlag = resolveEngineHostLaunch({ extensionRoot: root, workspacePath: "/ws", execPath: "/node", env: { GAEP_ENGINE_EXECUTABLE: "/tmp/evil" } })
    expect(withoutFlag.command).toBe("/node")
    const withFlag = resolveEngineHostLaunch({ extensionRoot: root, workspacePath: "/ws", execPath: "/node", env: { GAEP_DEV_ENGINE: "1", GAEP_ENGINE_EXECUTABLE: "/tmp/dev-engine" } })
    expect(withFlag.command).toBe("/tmp/dev-engine")
  })

  it("parses a digest sidecar with or without the sha256 prefix", () => {
    const hex = "a".repeat(64)
    expect(parseDigestSidecar(`${hex}  file`)).toBe(`sha256:${hex}`)
    expect(parseDigestSidecar(`sha256:${hex}  file`)).toBe(`sha256:${hex}`)
    expect(() => parseDigestSidecar("garbage")).toThrow()
  })
})
