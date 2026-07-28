#!/usr/bin/env node
// GAEP-P0-CS02 — verify a built native archive (Rider plugin ZIP or Visual Studio VSIX) actually
// embeds the Engine Host SEA and its digest sidecar (INV-22). Fails closed if either is missing, so
// a native package can never ship without its digest-verified runtime.
import { resolve } from "node:path"

import { archiveContainsAll } from "./lib/zip.mjs"

function arg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const archive = arg("--archive")
const target = arg("--target")
if (!archive || !["win32-x64", "linux-x64", "darwin-arm64"].includes(target)) {
  process.stderr.write("Usage: verify_native_archive.mjs --archive <zip|vsix> --target <win32-x64|linux-x64|darwin-arm64>\n")
  process.exit(64)
}

const seaName = `gaep-engine-host-0.2.0-${target}${target === "win32-x64" ? ".exe" : ""}`
const required = [seaName, `${seaName}.sha256`]

if (!archiveContainsAll(resolve(archive), required)) {
  process.stderr.write(`Native archive is missing the embedded Engine Host SEA/sidecar: ${required.join(", ")}\n`)
  process.exit(70)
}
process.stdout.write(`Verified ${archive} embeds ${required.join(" + ")}\n`)
