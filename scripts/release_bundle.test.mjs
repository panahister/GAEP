import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { artifactName, canonicalTarget, IDES_BY_TARGET, upsertArtifact } from "./lib/bundle.mjs"

const here = dirname(fileURLToPath(import.meta.url))

describe("release bundle helpers", () => {
  it("maps host platform/arch to canonical bundle targets", () => {
    expect(canonicalTarget("darwin", "arm64")).toBe("macos-arm64")
    expect(canonicalTarget("linux", "x64")).toBe("linux-x64")
    expect(canonicalTarget("win32", "x64")).toBe("windows-x64")
  })

  it("names artifacts per IDE and target; Visual Studio only under windows-x64", () => {
    expect(artifactName("vscode", "macos-arm64")).toBe("gaep-vscode-0.2.0.vsix")
    expect(artifactName("kiro", "linux-x64")).toBe("gaep-kiro-0.2.0.vsix")
    expect(artifactName("rider", "macos-arm64")).toBe("gaep-rider-0.2.0-darwin-arm64.zip")
    expect(artifactName("rider", "windows-x64")).toBe("gaep-rider-0.2.0-win32-x64.zip")
    expect(IDES_BY_TARGET["macos-arm64"]).not.toContain("visual-studio")
    expect(IDES_BY_TARGET["windows-x64"]).toContain("visual-studio")
  })

  it("upsert replaces the (target,arch,ide) entry rather than duplicating it", () => {
    const manifest = { artifacts: [] }
    const base = { targetOs: "macos", targetArch: "arm64", ideHost: "vscode" }
    upsertArtifact(manifest, { ...base, buildState: "not-built" })
    upsertArtifact(manifest, { ...base, buildState: "built" })
    expect(manifest.artifacts).toHaveLength(1)
    expect(manifest.artifacts[0].buildState).toBe("built")
  })
})

describe("release:collect rejects a stale / wrong-commit import (atomic, no partial publish)", () => {
  let work
  beforeEach(() => { work = mkdtempSync(join(tmpdir(), "gaep-collect-test-")) })
  afterEach(() => rmSync(work, { recursive: true, force: true }))

  it("exits non-zero when the input package-manifest sourceTreeDigest does not match the bundle", () => {
    // A bundle with a known source identity.
    const bundleRoot = join(work, "local-release-bundles", "GAEP-P0-CS02", "0.2.0")
    mkdirSync(bundleRoot, { recursive: true })
    writeFileSync(join(bundleRoot, "bundle-manifest.json"), JSON.stringify({
      schemaVersion: 1, changeSetId: "GAEP-P0-CS02", version: "0.2.0",
      sourceCommit: "aaaa", sourceTreeDigest: `sha256:${"a".repeat(64)}`, dirty: false, artifacts: [],
    }))
    // An input whose package-manifest claims a DIFFERENT source tree (stale/wrong commit).
    const input = join(work, "input")
    const uploadedArtifactRoot = join(input, "dist", "phase0", "cs02")
    mkdirSync(uploadedArtifactRoot, { recursive: true })
    writeFileSync(join(uploadedArtifactRoot, "package-manifest.json"), JSON.stringify({
      changeSetId: "GAEP-P0-CS02", version: "0.2.0",
      sourceIdentity: { baseCommit: "aaaa", sourceTreeDigest: `sha256:${"b".repeat(64)}` },
      artifacts: [{ ideHost: "vscode", buildState: "built", artifactPath: "dist/phase0/cs02/gaep-vscode-0.2.0.vsix", artifactSha256: `sha256:${"c".repeat(64)}` }],
    }))
    let code = 0
    let stderr = ""
    try {
      execFileSync(process.execPath, [join(here, "release_collect.mjs"), "--change-set", "GAEP-P0-CS02", "--version", "0.2.0", "--target", "macos-arm64", "--input", input, "--base-root", work], {
        cwd: work, stdio: "pipe",
      })
    } catch (e) { code = e.status ?? 1; stderr = String(e.stderr) }
    expect(code).not.toBe(0)
    expect(stderr).toContain("sourceTreeDigest does not match")
    expect(JSON.parse(readFileSync(join(bundleRoot, "bundle-manifest.json"), "utf8")).sourceTreeDigest).toBe(`sha256:${"a".repeat(64)}`)
  })
})
