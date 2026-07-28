#!/usr/bin/env node
// GAEP-P0-CS02 — release pipeline (INV-12/20/28).
//
// Produces locally buildable artifacts under dist/phase0/cs02/, and writes a discriminated
// package-manifest.json (built | not-built) plus a SHA256SUMS.txt that lists ONLY files that
// exist on disk. Visual Studio and Rider remain `not-built` here (external lanes).
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { computeSourceIdentity } from "@gaep/engine"

const CHANGE_SET_ID = "GAEP-P0-CS02"
const VERSION = "0.2.0"
const verify = process.argv.includes("--verify")

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "..")
const outRoot = join(repoRoot, "dist", "phase0", "cs02")
const engineHostBundle = join(outRoot, "engine-host", "gaep-engine-host-0.2.0.cjs")
const riderTarget = process.env.GAEP_RELEASE_RIDER_TARGET ?? (
  process.platform === "win32" && process.arch === "x64" ? "win32-x64"
    : process.platform === "darwin" && process.arch === "arm64" ? "darwin-arm64"
      : "linux-x64"
)
if (!new Set(["linux-x64", "darwin-arm64", "win32-x64"]).has(riderTarget)) {
  throw new Error(`Unsupported GAEP_RELEASE_RIDER_TARGET: ${riderTarget}`)
}

function sha256File(path) {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`
}
function run(command, args, cwd = repoRoot) {
  execFileSync(command, args, { cwd, stdio: "inherit" })
}

function stageAndPackage(packageRoot, outVsix, manifestOverrides = {}) {
  const stage = join(outRoot, `.stage-${basename(outVsix)}`)
  rmSync(stage, { recursive: true, force: true })
  mkdirSync(stage, { recursive: true })
  // Only runtime files: compiled bundle, embedded engine-host, media, docs. No tests/maps/source.
  const runtimeFiles = [
    "dist/extension.cjs",
    "dist/studio-client.js",
    "dist/engine-host/gaep-engine-host-0.2.0.cjs",
    "dist/engine-host/engine-host.sha256",
    "media/gaep.svg",
    "README.md",
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
  ]
  for (const rel of runtimeFiles) {
    const src = join(packageRoot, rel)
    if (!existsSync(src)) continue
    mkdirSync(dirname(join(stage, rel)), { recursive: true })
    copyFileSync(src, join(stage, rel))
  }
  // Strip relative markdown links so vsce does not reject the staged README.
  const stagedReadme = join(stage, "README.md")
  if (existsSync(stagedReadme)) {
    const sanitized = readFileSync(stagedReadme, "utf8").replace(/\[([^\]]+)\]\(\.\.?\/[^)]*\)/g, "$1")
    writeFileSync(stagedReadme, sanitized)
  }
  const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"))
  delete manifest.scripts
  delete manifest.devDependencies
  delete manifest.dependencies
  manifest.files = runtimeFiles.filter((rel) => existsSync(join(stage, rel)))
  Object.assign(manifest, manifestOverrides)
  writeFileSync(join(stage, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`)
  run("npx", ["--no-install", "vsce", "package", "--no-dependencies", "--allow-missing-repository", "-o", outVsix], stage)
  rmSync(stage, { recursive: true, force: true })
}

const sourceIdentity = await computeSourceIdentity(repoRoot)
mkdirSync(outRoot, { recursive: true })

// 1) Engine Host platform-neutral bundle (used by VS Code and Kiro).
run(process.execPath, [join(repoRoot, "apps", "engine-host", "build-bundle.mjs")])

// 2) Embed the bundle into the VS Code extension and package the VSIX from an ISOLATED stage
// (vsce walks the whole workspace otherwise; staging ships only runtime files — no tests/maps/source).
const vscodeRoot = join(repoRoot, "apps", "vscode")
run("npm", ["run", "build", "-w", "gaep-vscode"])
const vscodeEngineHostDir = join(vscodeRoot, "dist", "engine-host")
mkdirSync(vscodeEngineHostDir, { recursive: true })
copyFileSync(engineHostBundle, join(vscodeEngineHostDir, "gaep-engine-host-0.2.0.cjs"))
copyFileSync(join(outRoot, "engine-host", "engine-host.sha256"), join(vscodeEngineHostDir, "engine-host.sha256"))
const vscodeVsix = join(outRoot, `gaep-vscode-${VERSION}.vsix`)
stageAndPackage(vscodeRoot, vscodeVsix)

// 3) Kiro package (independent identity, reuses the shared extension bundle).
const kiroVsix = join(outRoot, `gaep-kiro-${VERSION}.vsix`)
if (existsSync(join(repoRoot, "apps", "kiro", "build.mjs"))) {
  run(process.execPath, [join(repoRoot, "apps", "kiro", "build.mjs")])
}

// 4) Discriminated manifest entries.
const built = (host, target, path, limitation) => ({
  changeSetId: CHANGE_SET_ID, packageVersion: VERSION, ideHost: host, targetIdeRange: target,
  sourceIdentity, artifactPath: `dist/phase0/cs02/${path}`, artifactSha256: sha256File(join(outRoot, path)),
  buildState: "built", installTestState: "not-run", workflowTestState: "not-run",
  observedAt: new Date().toISOString(), evidenceSource: "scripts/build_cs02_release.mjs", knownLimitation: limitation ?? null,
})
const notBuilt = (host, target, path, reason) => ({
  changeSetId: CHANGE_SET_ID, packageVersion: VERSION, ideHost: host, targetIdeRange: target,
  sourceIdentity, artifactPath: `dist/phase0/cs02/${path}`, artifactSha256: null,
  buildState: "not-built", installTestState: "pending-environment", workflowTestState: "pending-environment",
  observedAt: new Date().toISOString(), evidenceSource: "scripts/build_cs02_release.mjs", notBuiltReason: reason, knownLimitation: null,
})

const artifacts = [
  built("vscode", "vscode ^1.103.0", `gaep-vscode-${VERSION}.vsix`),
  existsSync(kiroVsix)
    ? built("kiro", "kiro compatible", `gaep-kiro-${VERSION}.vsix`, "Kiro not installed in this environment; install/workflow remain not-run")
    : notBuilt("kiro", "kiro compatible", `gaep-kiro-${VERSION}.vsix`, "requires-kiro-install"),
  existsSync(join(outRoot, `Gaep.VisualStudio-${VERSION}.vsix`))
    ? built("visual-studio", "VS [17.8,18.0)", `Gaep.VisualStudio-${VERSION}.vsix`)
    : notBuilt("visual-studio", "VS [17.8,18.0)", `Gaep.VisualStudio-${VERSION}.vsix`, "requires-windows-visual-studio"),
  existsSync(join(outRoot, `gaep-rider-${VERSION}.zip`))
    ? built("rider", `Rider 2025.3 (${riderTarget})`, `gaep-rider-${VERSION}.zip`)
    : notBuilt("rider", `Rider 2025.3 (${riderTarget})`, `gaep-rider-${VERSION}.zip`, "requires-jdk21"),
]

const manifest = { schemaVersion: 1, changeSetId: CHANGE_SET_ID, version: VERSION, sourceIdentity, artifacts }
writeFileSync(join(outRoot, "package-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8")

// 5) SHA256SUMS over ONLY files that exist.
const sumLines = []
for (const artifact of artifacts) {
  if (artifact.buildState !== "built") continue
  sumLines.push(`${artifact.artifactSha256.slice("sha256:".length)}  ${artifact.artifactPath.replace("dist/phase0/cs02/", "")}`)
}
sumLines.push(`${sha256File(engineHostBundle).slice("sha256:".length)}  engine-host/gaep-engine-host-0.2.0.cjs`)
writeFileSync(join(outRoot, "SHA256SUMS.txt"), `${sumLines.join("\n")}\n`, "utf8")

if (verify) {
  const currentIdentity = await computeSourceIdentity(repoRoot)
  if (manifest.sourceIdentity.sourceTreeDigest !== currentIdentity.sourceTreeDigest) {
    throw new Error("package-manifest sourceIdentity.sourceTreeDigest does not equal the current source tree")
  }
  for (const artifact of artifacts) {
    if (artifact.buildState === "built") {
      if (sha256File(join(outRoot, artifact.artifactPath.replace("dist/phase0/cs02/", ""))) !== artifact.artifactSha256) {
        throw new Error(`digest mismatch for ${artifact.artifactPath}`)
      }
    } else if (artifact.artifactSha256 !== null || !artifact.notBuiltReason) {
      throw new Error(`invalid not-built entry for ${artifact.ideHost}`)
    }
  }
  process.stdout.write("CS02 release verify: PASS\n")
}

process.stdout.write(`CS02 release complete. Manifest: ${join(outRoot, "package-manifest.json")}\n`)
for (const artifact of artifacts) process.stdout.write(`  ${artifact.ideHost}: ${artifact.buildState}\n`)
