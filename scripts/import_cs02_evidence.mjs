#!/usr/bin/env node
// GAEP-P0-CS02 — governed import of an external host evidence bundle (INV-29/30).
//
// Verifies sourceIdentity, digests, host/check IDs, and producer authority before writing a
// bundle into the tracked acceptance set. A build-only lane may publish `buildState` only;
// install/workflow states stay `not-run`. A local `not-run` never overwrites a valid external
// `passed`/`failed` bundle whose source tree matches the current subject.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { computeSourceIdentity } from "@gaep/engine"
import { verifyEvidenceBundleFor, writeCs02BuildOnlyBundle } from "@gaep/conformance"

function arg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const host = arg("--host")
const artifactDir = arg("--artifact")
const buildOnly = process.argv.includes("--build-only")
const HOSTS = { "visual-studio": "visual-studio.vsix.workflow", "rider": "rider.plugin.workflow", "kiro": "kiro.extension.workflow", "vscode": "vscode.extension-host.e2e" }
if (!host || !(host in HOSTS) || !artifactDir) {
  process.stderr.write("Usage: import_cs02_evidence.mjs --host <vscode|visual-studio|rider|kiro> --artifact <dir> [--build-only]\n")
  process.exit(64)
}

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "..")
const bundleDir = resolve(artifactDir)
const destDir = join(repoRoot, "examples", "phase0-provider-model", "acceptance", host)

const packageManifestPath = join(bundleDir, "package-manifest.json")
if (!existsSync(packageManifestPath)) {
  process.stderr.write("No package-manifest.json found in the artifact directory.\n")
  process.exit(70)
}
const packageManifest = JSON.parse(readFileSync(packageManifestPath, "utf8"))
const current = await computeSourceIdentity(repoRoot)

// INV-27: equivalence is decided ONLY by sourceTreeDigest; provenance metadata never rejects.
if (packageManifest.sourceIdentity.sourceTreeDigest !== current.sourceTreeDigest) {
  process.stderr.write("Imported artifact source tree does not match the current subject; refusing to import.\n")
  process.exit(70)
}

const entry = packageManifest.artifacts.find((a) => a.ideHost === host)
if (!entry) {
  process.stderr.write(`No manifest entry for host ${host}.\n`)
  process.exit(70)
}

if (buildOnly) {
  // A build lane produces a schema-valid CS02 evidence bundle whose installed-host workflow was NOT
  // executed: executionResult "not-executed", testOutcome "not-run" (INV-29/30). This truthfully
  // records "the artifact built, but the interactive-host workflow was not run", so it can never be
  // mistaken for a Ready-for-Test pass. No artifact means no build evidence (fail closed).
  if (entry.buildState !== "built" || !entry.artifactSha256) {
    process.stderr.write(`Host ${host} has no built artifact (buildState=${entry.buildState}); refusing to emit build evidence.\n`)
    process.exit(70)
  }
  writeCs02BuildOnlyBundle(
    {
      host,
      checkId: HOSTS[host],
      packageVersion: packageManifest.version,
      subjectDigest: entry.artifactSha256,
      sourceIdentity: current,
      unavailabilityReason: "Build lane produced the artifact; the installed-host workflow requires an interactive IDE and was not executed.",
    },
    destDir,
  )
  process.stdout.write(`Wrote verified ${host} build-only evidence (not-executed/not-run) into ${destDir}\n`)
  process.exit(0)
}

// A full host evidence bundle must verify against the subject before it is written into the set.
const subjectDigest = entry.artifactSha256 ?? `sha256:${"0".repeat(64)}`
const result = verifyEvidenceBundleFor(
  { host, checkId: HOSTS[host], packageVersion: packageManifest.version, currentSubjectDigest: subjectDigest, currentSourceIdentity: current },
  bundleDir,
)
mkdirSync(destDir, { recursive: true })
for (const name of ["readiness-evidence.json", "observation.json", "evidence-manifest.json"]) {
  copyFileSync(join(bundleDir, name), join(destDir, name))
}
process.stdout.write(`Imported verified ${host} evidence (${result.kind}) into ${destDir}\n`)
