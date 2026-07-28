#!/usr/bin/env node
// GAEP-P0-CS02 — build the applicable packages that can TRUTHFULLY be built on this host and collect
// them into the canonical local bundle. It never relabels a cross-target artifact and never reports a
// native cross-build as built without producing it. `--target current` resolves the real OS/arch.
import { execFileSync } from "node:child_process"

import {
  CHANGE_SET_ID, VERSION, SCHEMA_VERSION, repoRoot, bundleRoot, canonicalTarget, SEA_TARGET, TARGET_OS,
  IDES_BY_TARGET, artifactName, sha256File, currentSourceIdentity, readManifest, writeJsonAtomic,
  writeSha256Sums, upsertArtifact, cpSync, existsSync, mkdirSync, readdirSync, join,
} from "./lib/bundle.mjs"
import { writeTestKit } from "./lib/test_kit.mjs"
import { resolveIde } from "./lib/ide_discovery.mjs"

function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined }

const requested = arg("--target") ?? "current"
const host = canonicalTarget()
const target = requested === "current" ? host : requested
if (!IDES_BY_TARGET[target]) { process.stderr.write(`Unknown target: ${target}\n`); process.exit(64) }

const outRoot = join(repoRoot, "dist", "phase0", "cs02")
const bundle = bundleRoot()
const targetDir = join(bundle, target)
const sourceIdentity = await currentSourceIdentity()
const observedAt = new Date().toISOString()

// Build the platform-neutral VS Code + Kiro VSIX and the shared engine-host once (release:cs02).
execFileSync("npm", ["run", "release:cs02"], { cwd: repoRoot, stdio: "inherit" })

// If this host matches the requested target, build the native darwin SEA + Rider plugin.
if (target === host && host === "macos-arm64") {
  buildDarwinRider()
}

const manifest = readManifest(bundle) ?? {
  schemaVersion: SCHEMA_VERSION, changeSetId: CHANGE_SET_ID, version: VERSION,
  sourceCommit: sourceIdentity.baseCommit, sourceTreeDigest: sourceIdentity.sourceTreeDigest, dirty: sourceIdentity.dirty,
  generatedAt: observedAt, artifacts: [],
}
// A regenerated bundle must reflect the current source revision.
manifest.sourceCommit = sourceIdentity.baseCommit
manifest.sourceTreeDigest = sourceIdentity.sourceTreeDigest
manifest.dirty = sourceIdentity.dirty
manifest.generatedAt = observedAt

for (const ide of IDES_BY_TARGET[target]) {
  const name = artifactName(ide, target)
  const source = locateSource(ide, target)
  const relPath = `${target}/${ide}/${name}`
  const base = {
    changeSetId: CHANGE_SET_ID, version: VERSION, ideHost: ide, targetOs: TARGET_OS[target].os, targetArch: TARGET_OS[target].arch,
    artifactRelativePath: relPath, buildOrigin: "local", githubRunId: null, githubRunUrl: null,
    sourceCommit: sourceIdentity.baseCommit, sourceTreeDigest: sourceIdentity.sourceTreeDigest, dirty: sourceIdentity.dirty,
    installTestState: "not-run", workflowTestState: "not-run", observedAt,
  }
  if (source && existsSync(source)) {
    const dest = join(targetDir, ide, name)
    mkdirSync(join(targetDir, ide), { recursive: true })
    cpSync(source, dest)
    upsertArtifact(manifest, { ...base, buildState: "built", artifactSha256: sha256File(dest), notBuiltReason: null, knownLimitation: knownLimitation(ide, target) })
  } else {
    // Truthful not-built: a native artifact this host cannot produce is never reported as built.
    upsertArtifact(manifest, { ...base, buildState: "not-built", artifactSha256: null, notBuiltReason: notBuiltReason(ide, target, host), knownLimitation: null })
  }
}

writeJsonAtomic(join(bundle, "bundle-manifest.json"), manifest)
writeSha256Sums(bundle, manifest)
writeTestKit(bundle, target)

process.stdout.write(`Collected ${target} into ${bundle}\n`)
for (const a of manifest.artifacts.filter((x) => x.targetOs === TARGET_OS[target].os)) {
  process.stdout.write(`  ${a.ideHost}: ${a.buildState}${a.notBuiltReason ? ` (${a.notBuiltReason})` : ""}\n`)
}

// --- helpers ---
function locateSource(ide, target) {
  if (ide === "vscode") return join(outRoot, `gaep-vscode-${VERSION}.vsix`)
  if (ide === "kiro") return join(outRoot, `gaep-kiro-${VERSION}.vsix`)
  if (ide === "visual-studio") return join(outRoot, `Gaep.VisualStudio-${VERSION}.vsix`)
  if (ide === "rider") {
    // Native Rider plugin: only the current host can build it. Discover the gradle output ZIP.
    const dist = join(repoRoot, "apps", "rider", "build", "distributions")
    if (target === host && existsSync(dist)) {
      const zip = readdirSync(dist).find((f) => f.endsWith(".zip"))
      if (zip) return join(dist, zip)
    }
    return undefined
  }
  return undefined
}

function notBuiltReason(ide, target, host) {
  if (ide === "rider") return target === host ? "rider-plugin-not-built (run gradlew test buildPlugin with the Rider JBR)" : `native-cross-build-unavailable (build on a ${target} host)`
  if (ide === "visual-studio") return "requires-windows-visual-studio"
  return `artifact-missing (${ide})`
}

function knownLimitation(ide, target) {
  if (ide === "rider" && target === "macos-arm64") return "darwin-arm64 Engine Host SEA is embedded; UI smoke requires an interactive Rider"
  return null
}

function buildDarwinRider() {
  // Reuse an already verified/staged SEA, but always run the incremental Rider test/build/verify
  // tasks. Thus one release:matrix invocation produces every package applicable to this Mac.
  const stagedSea = join(repoRoot, "apps", "rider", "build", "gaep-engine-host", "gaep-engine-host-0.2.0-darwin-arm64")
  if (!existsSync(stagedSea) || !existsSync(`${stagedSea}.sha256`)) {
    const nodeExe = execFileSync(process.execPath, [join(repoRoot, "scripts", "fetch_cs02_node.mjs"), "darwin-arm64"], { encoding: "utf8" }).trim()
    execFileSync(process.execPath, [join(repoRoot, "apps", "engine-host", "build-sea.mjs"), "darwin-arm64"], { cwd: repoRoot, stdio: "inherit", env: { ...process.env, GAEP_SEA_NODE_BINARY: nodeExe } })
    execFileSync(process.execPath, [join(repoRoot, "scripts", "stage_engine_host_sea.mjs"), "--target", "darwin-arm64", "--dest", join(repoRoot, "apps", "rider", "build", "gaep-engine-host")], { cwd: repoRoot, stdio: "inherit" })
  }
  const jbr = resolveIde("jbr")
  if (!jbr.path) throw new Error("Rider JBR not found; configure GAEP_RIDER_JBR")
  execFileSync("./gradlew", ["test", "buildPlugin", "verifyPlugin"], {
    cwd: join(repoRoot, "apps", "rider"), stdio: "inherit", env: { ...process.env, JAVA_HOME: jbr.path },
  })
}
