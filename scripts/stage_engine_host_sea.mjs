#!/usr/bin/env node
// GAEP-P0-CS02 — stage the built Engine Host SEA + its digest sidecar into a native host's package
// resources before the native build embeds them (INV-21/22). It verifies the SEA against its sidecar
// digest first (fail closed) and copies both into the destination. It never writes into source-tree
// identity paths — the destination is a build/resources/staging directory only.
import { createHash } from "node:crypto"
import { copyFileSync, mkdirSync, readFileSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

/** Fail closed unless the built SEA matches its own digest sidecar; returns the verified digest. */
export function verifySeaAgainstSidecar(seaFile, sidecarFile) {
  const expected = readFileSync(sidecarFile, "utf8").trim().split(/\s+/)[0]
  const normalizedExpected = expected.startsWith("sha256:") ? expected : `sha256:${expected}`
  const actual = `sha256:${createHash("sha256").update(readFileSync(seaFile)).digest("hex")}`
  if (actual !== normalizedExpected) {
    throw new Error(`Engine Host SEA digest does not match its sidecar (${basename(seaFile)})`)
  }
  return actual
}

function main() {
  const arg = (name) => {
    const index = process.argv.indexOf(name)
    return index >= 0 ? process.argv[index + 1] : undefined
  }
  const target = arg("--target")
  const dest = arg("--dest")
  if ((target !== "win32-x64" && target !== "linux-x64") || !dest) {
    process.stderr.write("Usage: stage_engine_host_sea.mjs --target <win32-x64|linux-x64> --dest <dir>\n")
    process.exit(64)
  }
  const here = dirname(fileURLToPath(import.meta.url))
  const engineHostDir = join(resolve(here, ".."), "dist", "phase0", "cs02", "engine-host")
  const seaName = `gaep-engine-host-0.2.0-${target}${target === "win32-x64" ? ".exe" : ""}`
  const seaPath = join(engineHostDir, seaName)
  const sidecarPath = `${seaPath}.sha256`

  const digest = verifySeaAgainstSidecar(seaPath, sidecarPath)
  const destDir = resolve(dest)
  mkdirSync(destDir, { recursive: true })
  copyFileSync(seaPath, join(destDir, seaName))
  copyFileSync(sidecarPath, join(destDir, `${seaName}.sha256`))
  process.stdout.write(`Staged ${seaName} (${digest}) into ${destDir}\n`)
}

// Run the CLI only when invoked directly (not when imported by tests).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
