#!/usr/bin/env node
// GAEP-P0-CS02 — bundle the Engine Host to one platform-neutral CommonJS file and emit its
// digest sidecar (INV-21/22). Electron-based hosts (VS Code, Kiro) run this .cjs through the
// IDE's own Node runtime; the non-Node hosts wrap it in a Node SEA (see build-sea.mjs).
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "..", "..")
const outDir = join(repoRoot, "dist", "phase0", "cs02", "engine-host")
const bundleName = "gaep-engine-host-0.2.0.cjs"

// esbuild ships with the VS Code workspace; resolve it without adding a root dependency.
const require = createRequire(join(repoRoot, "apps", "vscode", "package.json"))
const esbuild = require("esbuild")

mkdirSync(outDir, { recursive: true })
const outfile = join(outDir, bundleName)

await esbuild.build({
  entryPoints: [join(here, "src", "main.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  outfile,
  legalComments: "none",
  logLevel: "error",
})

const digest = `sha256:${createHash("sha256").update(readFileSync(outfile)).digest("hex")}`
writeFileSync(join(outDir, "engine-host.sha256"), `${digest}  ${bundleName}\n`, "utf8")
process.stdout.write(`Built ${bundleName}\n${digest}\n`)
