#!/usr/bin/env node
// GAEP-P0-CS02 — Kiro package builder (INV-12). Kiro reuses the compatible VS Code extension
// foundation but produces an INDEPENDENTLY identifiable package (publisher gaep, name gaep-kiro).
// VS Code success is never Kiro evidence; installation/workflow must be executed in Kiro itself.
import { execFileSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "..", "..")
const vscodeRoot = join(repoRoot, "apps", "vscode")
const outVsix = join(repoRoot, "dist", "phase0", "cs02", "gaep-kiro-0.2.0.vsix")
const stage = join(here, ".stage")

rmSync(stage, { recursive: true, force: true })
mkdirSync(stage, { recursive: true })
// Ship only runtime files (no tests/maps/source): the compiled extension bundle + shared engine-host.
const runtimeFiles = [
  "dist/extension.cjs",
  "dist/studio-client.js",
  "dist/engine-host/gaep-engine-host-0.2.0.cjs",
  "dist/engine-host/engine-host.sha256",
  "media/gaep.svg",
]
for (const rel of runtimeFiles) {
  const src = join(vscodeRoot, rel)
  if (!existsSync(src)) continue
  mkdirSync(dirname(join(stage, rel)), { recursive: true })
  cpSync(src, join(stage, rel))
}
if (existsSync(join(here, "README.md"))) cpSync(join(here, "README.md"), join(stage, "README.md"))
// Independent manifest derived from VS Code's contributions but with the Kiro identity.
const vscodeManifest = JSON.parse(readFileSync(join(vscodeRoot, "package.json"), "utf8"))
const kiroManifest = {
  ...vscodeManifest,
  name: "gaep-kiro",
  displayName: "GAEP for Kiro",
  description: "Governed provider/model read-only analysis for Kiro.",
  version: "0.2.0",
  main: "dist/extension.cjs",
}
delete kiroManifest.scripts
delete kiroManifest.devDependencies
kiroManifest.files = runtimeFiles.filter((rel) => existsSync(join(stage, rel)))
writeFileSync(join(stage, "package.json"), `${JSON.stringify(kiroManifest, null, 2)}\n`)

mkdirSync(dirname(outVsix), { recursive: true })
execFileSync("npx", ["--no-install", "vsce", "package", "--no-dependencies", "--allow-missing-repository", "-o", outVsix], { cwd: stage, stdio: "inherit" })
rmSync(stage, { recursive: true, force: true })
process.stdout.write(`Built gaep-kiro-0.2.0.vsix\n`)
