#!/usr/bin/env node
// GAEP-P0-CS02 — download, verify, and extract the pinned official Node 22.11.0 runtime for the SEA
// Engine Host build lane (INV-22). Runs in CI only (it reaches the network). It downloads the exact
// archive named in node-target.json, verifies its SHA-256 against the pinned archive digest, extracts
// the executable, verifies the pinned extracted-executable digest when present, and prints the
// absolute executable path (to be captured into GAEP_SEA_NODE_BINARY). Any mismatch fails closed.
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const target = process.argv[2]
if (target !== "win32-x64" && target !== "linux-x64") {
  process.stderr.write("Usage: fetch_cs02_node.mjs <win32-x64|linux-x64>\n")
  process.exit(64)
}

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "..")
const nodeTarget = JSON.parse(readFileSync(join(repoRoot, "apps", "engine-host", "node-target.json"), "utf8"))
const pin = nodeTarget.targets[target]
if (!pin?.archiveSha256 || /0{64}/.test(pin.archiveSha256)) {
  process.stderr.write(`No verified archive digest pinned for ${target}; refusing to fetch.\n`)
  process.exit(70)
}

const workDir = join(repoRoot, "dist", "phase0", "cs02", "node-download", target)
mkdirSync(workDir, { recursive: true })
const archiveUrl = `${nodeTarget.releaseBaseUrl}${pin.archive}`
const archivePath = join(workDir, pin.archive)

const response = await fetch(archiveUrl)
if (!response.ok) {
  process.stderr.write(`Failed to download ${archiveUrl}: HTTP ${response.status}\n`)
  process.exit(70)
}
const archiveBytes = Buffer.from(await response.arrayBuffer())
writeFileSync(archivePath, archiveBytes)

// Verify the archive digest BEFORE extraction (download-integrity anchor).
const archiveDigest = `sha256:${createHash("sha256").update(archiveBytes).digest("hex")}`
if (archiveDigest !== pin.archiveSha256) {
  process.stderr.write(`Node archive checksum mismatch for ${target}; refusing to extract.\n  expected ${pin.archiveSha256}\n  actual   ${archiveDigest}\n`)
  process.exit(70)
}

// Extract with the platform-appropriate tool.
if (pin.archive.endsWith(".tar.xz")) {
  execFileSync("tar", ["-xJf", archivePath, "-C", workDir], { stdio: "inherit" })
} else if (pin.archive.endsWith(".zip")) {
  execFileSync("unzip", ["-oq", archivePath, "-d", workDir], { stdio: "inherit" })
} else {
  process.stderr.write(`Unsupported archive format: ${pin.archive}\n`)
  process.exit(70)
}

const exePath = join(workDir, pin.executablePath)
// When the extracted-executable digest is pinned (win32-x64), verify it too.
if (pin.executableSha256 && !/0{64}/.test(pin.executableSha256)) {
  const exeDigest = `sha256:${createHash("sha256").update(readFileSync(exePath)).digest("hex")}`
  if (exeDigest !== pin.executableSha256) {
    process.stderr.write(`Extracted Node executable checksum mismatch for ${target}; refusing to use.\n`)
    process.exit(70)
  }
}

process.stdout.write(`${exePath}\n`)
