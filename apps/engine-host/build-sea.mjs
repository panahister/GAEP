#!/usr/bin/env node
// GAEP-P0-CS02 — build a Node Single Executable Application (SEA) Engine Host for a non-Node host
// (Visual Studio win32-x64, Rider linux-x64). Runs only in the external CI lanes (INV-21/22).
//
// Frozen 9-step procedure:
//   1 bundle CJS; 2 generate the SEA blob; 3 select the exact target Node executable;
//   4 verify its SHA-256 against node-target.json; 5 copy it; 6 inject the blob with postject;
//   7 macOS signature remove/re-sign (n/a for win32/linux); 8 compute the final runtime SHA-256;
//   9 package the executable ONLY after verification. Any failed step yields NO artifact.
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const target = process.argv[2]
if (target !== "win32-x64" && target !== "linux-x64") {
  process.stderr.write("Usage: build-sea.mjs <win32-x64|linux-x64>\n")
  process.exit(64)
}

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "..", "..")
const outDir = join(repoRoot, "dist", "phase0", "cs02", "engine-host")
const nodeTarget = JSON.parse(readFileSync(join(here, "node-target.json"), "utf8"))
const pin = nodeTarget.targets[target]
// Fail closed unless the EXACT extracted-executable digest is pinned for this target. build-sea
// verifies the actual binary it is about to inject; it never trusts an archive digest pinned
// elsewhere as a substitute for verifying GAEP_SEA_NODE_BINARY itself (INV-22).
if (!pin?.executableSha256 || /0{64}/.test(pin.executableSha256)) {
  process.stderr.write(`No verified Node executable digest is pinned for ${target}; refusing to build (fail closed).\n`)
  process.exit(70)
}

const require = createRequire(join(repoRoot, "apps", "vscode", "package.json"))
const nodeExe = process.env.GAEP_SEA_NODE_BINARY
if (!nodeExe) {
  process.stderr.write("Set GAEP_SEA_NODE_BINARY to the downloaded, verified Node executable (see scripts/fetch_cs02_node.mjs).\n")
  process.exit(70)
}

// Step 4: verify the exact target Node executable checksum before use — for BOTH targets.
const nodeDigest = `sha256:${createHash("sha256").update(readFileSync(nodeExe)).digest("hex")}`
if (nodeDigest !== pin.executableSha256) {
  process.stderr.write("Target Node executable checksum mismatch; refusing to build.\n")
  process.exit(70)
}

mkdirSync(outDir, { recursive: true })
// Step 1: ensure the CJS bundle exists.
execFileSync(process.execPath, [join(here, "build-bundle.mjs")], { stdio: "inherit" })
// Step 2: generate the SEA blob.
execFileSync(process.execPath, ["--experimental-sea-config", join(here, "sea-config.json")], { cwd: outDir, stdio: "inherit" })

// Steps 5-6: copy the verified Node and inject the blob with postject.
const outName = `gaep-engine-host-0.2.0-${target}${target === "win32-x64" ? ".exe" : ""}`
const outPath = join(outDir, outName)
copyFileSync(nodeExe, outPath)
const postject = require.resolve("postject/dist/cli.js")
execFileSync(process.execPath, [
  postject, outPath, "NODE_SEA_BLOB", join(outDir, "sea-prep.blob"),
  "--sentinel-fuse", "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
], { stdio: "inherit" })

// Step 8: final digest; Step 9: emit the sidecar only after verification succeeds.
const finalDigest = `sha256:${createHash("sha256").update(readFileSync(outPath)).digest("hex")}`
writeFileSync(join(outDir, `${outName}.sha256`), `${finalDigest}  ${outName}\n`, "utf8")
process.stdout.write(`Built ${outName}\n${finalDigest}\n`)
