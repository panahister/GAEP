import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { computeSourceIdentity } from "@gaep/engine"

import { archiveContainsAll, listZipEntries } from "./lib/zip.mjs"
import { verifySeaAgainstSidecar } from "./stage_engine_host_sea.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, "..")
const sha256 = (buf) => `sha256:${createHash("sha256").update(buf).digest("hex")}`

let work
beforeEach(() => { work = mkdtempSync(join(tmpdir(), "gaep-native-")) })
afterEach(() => rmSync(work, { recursive: true, force: true }))

/** Build a real ZIP with the given entries using the system `zip` tool. */
function makeZip(entries) {
  const stage = join(work, "stage")
  mkdirSync(stage, { recursive: true })
  for (const [name, contents] of Object.entries(entries)) {
    const abs = join(stage, name)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, contents)
  }
  const zipPath = join(work, "archive.zip")
  execFileSync("zip", ["-qr", zipPath, "."], { cwd: stage })
  return zipPath
}

describe("native artifact ZIP verification (Rider plugin ZIP / VSIX)", () => {
  it("lists real central-directory entries", () => {
    const zip = makeZip({ "a.txt": "a", "nested/b.txt": "b" })
    const names = listZipEntries(zip).map((n) => n.split("/").pop())
    expect(names).toContain("a.txt")
    expect(names).toContain("b.txt")
  })

  it("confirms an archive that embeds the linux SEA + sidecar", () => {
    const sea = "gaep-engine-host-0.2.0-linux-x64"
    const zip = makeZip({ [`lib/${sea}`]: "ELF", [`lib/${sea}.sha256`]: "sha256:deadbeef  ${sea}" })
    expect(archiveContainsAll(zip, [sea, `${sea}.sha256`])).toBe(true)
  })

  it("rejects an archive missing the SEA sidecar", () => {
    const sea = "gaep-engine-host-0.2.0-win32-x64.exe"
    const zip = makeZip({ [`bin/${sea}`]: "MZ" })
    expect(archiveContainsAll(zip, [sea, `${sea}.sha256`])).toBe(false)
  })
})

describe("Engine Host SEA staging (digest-verified)", () => {
  it("accepts a SEA that matches its sidecar and rejects a tampered one", () => {
    const seaFile = join(work, "sea")
    const sidecar = join(work, "sea.sha256")
    writeFileSync(seaFile, "ENGINE-HOST-SEA-BYTES")
    writeFileSync(sidecar, `${sha256(Buffer.from("ENGINE-HOST-SEA-BYTES"))}  sea\n`)
    expect(() => verifySeaAgainstSidecar(seaFile, sidecar)).not.toThrow()

    writeFileSync(seaFile, "TAMPERED")
    expect(() => verifySeaAgainstSidecar(seaFile, sidecar)).toThrow()
  })
})

describe("evidence ordering: build-only evidence requires a built manifest entry", () => {
  it("import_cs02_evidence --build-only refuses while the host is not-built", async () => {
    const artifactDir = join(work, "artifact")
    mkdirSync(artifactDir, { recursive: true })
    // Use the REAL current source identity so the not-built guard (not the source check) is exercised.
    const sourceIdentity = await computeSourceIdentity(repoRoot)
    writeFileSync(join(artifactDir, "package-manifest.json"), JSON.stringify({
      schemaVersion: 1, changeSetId: "GAEP-P0-CS02", version: "0.2.0", sourceIdentity,
      artifacts: [{ ideHost: "rider", buildState: "not-built", artifactSha256: null }],
    }, null, 2))
    let code = 0
    let stderr = ""
    try {
      execFileSync(process.execPath, [join(here, "import_cs02_evidence.mjs"), "--host", "rider", "--artifact", artifactDir, "--build-only"], { stdio: "pipe" })
    } catch (error) {
      code = error.status ?? 1
      stderr = String(error.stderr ?? "")
    }
    expect(code).not.toBe(0)
    expect(stderr).toContain("no built artifact")
  })
})
