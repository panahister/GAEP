#!/usr/bin/env node
// GAEP-P0-CS02 — collect downloaded GitHub/local artifacts into a candidate bundle, validate the
// complete candidate, then swap it into place. A failed import never mutates the live bundle.
import { readFileSync } from "node:fs"
import { dirname, isAbsolute, resolve, sep } from "node:path"

import {
  CHANGE_SET_ID, VERSION, SCHEMA_VERSION, repoRoot, bundleRoot, IDES_BY_TARGET, TARGET_OS,
  artifactName, sha256File, currentSourceIdentity, readManifest, writeJsonAtomic, writeSha256Sums,
  upsertArtifact, cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, join, renameSync,
} from "./lib/bundle.mjs"

function arg(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined }
function args(name) { return process.argv.reduce((all, value, index) => value === name && process.argv[index + 1] ? [...all, process.argv[index + 1]] : all, []) }

const changeSet = arg("--change-set") ?? CHANGE_SET_ID
const version = arg("--version") ?? VERSION
const target = arg("--target")
const origin = arg("--origin") ?? "github-actions"
const runId = arg("--run-id") ?? null
const runUrl = arg("--run-url") ?? null
const inputs = args("--input").map((path) => resolve(path))
const baseRoot = arg("--base-root") ? resolve(arg("--base-root")) : repoRoot
const bundle = bundleRoot(changeSet, version, baseRoot)

if (changeSet !== CHANGE_SET_ID) abort(`change set ${changeSet} != ${CHANGE_SET_ID}`, 64)
if (version !== VERSION) abort(`version ${version} != ${VERSION}`, 64)
if (target && !IDES_BY_TARGET[target]) abort(`unknown target ${target}`, 64)
if (inputs.length === 0) abort("no --input directories supplied", 64)

const existing = readManifest(bundle)
const identity = existing
  ? { baseCommit: existing.sourceCommit, sourceTreeDigest: existing.sourceTreeDigest, dirty: existing.dirty }
  : await currentSourceIdentity()

mkdirSync(dirname(bundle), { recursive: true })
const transaction = mkdtempSync(join(dirname(bundle), ".collect-"))
const candidate = join(transaction, "candidate")
const backup = `${bundle}.backup-${process.pid}-${Date.now()}`
let backupCreated = false

try {
  if (existsSync(bundle)) cpSync(bundle, candidate, { recursive: true })
  else mkdirSync(candidate, { recursive: true })

  const manifest = readManifest(candidate) ?? {
    schemaVersion: SCHEMA_VERSION,
    changeSetId: CHANGE_SET_ID,
    version: VERSION,
    sourceCommit: identity.baseCommit,
    sourceTreeDigest: identity.sourceTreeDigest,
    dirty: identity.dirty,
    generatedAt: new Date().toISOString(),
    artifacts: [],
  }
  const importedKeys = new Set()

  for (const input of inputs) {
    const artifactRoot = findArtifactRoot(input)
    const manifestPath = join(artifactRoot, "package-manifest.json")
    if (!existsSync(manifestPath)) throw new Error(`input ${input}: missing package-manifest.json`)
    const source = JSON.parse(readFileSync(manifestPath, "utf8"))
    if (source.changeSetId !== CHANGE_SET_ID) throw new Error(`input ${input}: changeSetId mismatch`)
    if (source.version !== VERSION) throw new Error(`input ${input}: version mismatch`)
    if (source.sourceIdentity?.sourceTreeDigest !== identity.sourceTreeDigest) throw new Error(`input ${input}: sourceTreeDigest does not match the bundle`)
    if (source.sourceIdentity?.baseCommit && identity.baseCommit && source.sourceIdentity.baseCommit !== identity.baseCommit) {
      throw new Error(`input ${input}: source commit does not match the bundle`)
    }

    for (const artifact of source.artifacts.filter((item) => item.buildState === "built")) {
      const resolvedTarget = target ?? inferTarget(artifact)
      if (!resolvedTarget || !IDES_BY_TARGET[resolvedTarget]?.includes(artifact.ideHost)) {
        throw new Error(`input ${input}: cannot place ${artifact.ideHost} for target ${resolvedTarget ?? "unknown"}`)
      }
      const relativeSource = normalizeArtifactPath(artifact.artifactPath)
      const sourceFile = resolve(artifactRoot, relativeSource)
      if (!isInside(artifactRoot, sourceFile) || !existsSync(sourceFile)) throw new Error(`input ${input}: artifact file missing or outside input: ${artifact.artifactPath}`)
      const actualDigest = sha256File(sourceFile)
      if (!artifact.artifactSha256 || actualDigest !== artifact.artifactSha256) throw new Error(`input ${input}: digest mismatch for ${artifact.artifactPath}`)

      const key = `${resolvedTarget}/${artifact.ideHost}`
      if (importedKeys.has(key)) throw new Error(`duplicate artifact in this import: ${key}`)
      importedKeys.add(key)
      const outputName = artifactName(artifact.ideHost, resolvedTarget)
      const relativeOutput = `${resolvedTarget}/${artifact.ideHost}/${outputName}`
      const destination = join(candidate, relativeOutput)
      mkdirSync(dirname(destination), { recursive: true })
      cpSync(sourceFile, destination)
      upsertArtifact(manifest, {
        changeSetId: CHANGE_SET_ID,
        version: VERSION,
        ideHost: artifact.ideHost,
        targetOs: TARGET_OS[resolvedTarget].os,
        targetArch: TARGET_OS[resolvedTarget].arch,
        artifactRelativePath: relativeOutput,
        buildOrigin: origin,
        githubRunId: runId,
        githubRunUrl: runUrl,
        sourceCommit: identity.baseCommit,
        sourceTreeDigest: identity.sourceTreeDigest,
        dirty: identity.dirty,
        buildState: "built",
        artifactSha256: actualDigest,
        installTestState: artifact.installTestState ?? "not-run",
        workflowTestState: artifact.workflowTestState ?? "not-run",
        observedAt: new Date().toISOString(),
        notBuiltReason: null,
        knownLimitation: artifact.knownLimitation ?? null,
      })
    }
  }

  manifest.generatedAt = new Date().toISOString()
  writeJsonAtomic(join(candidate, "bundle-manifest.json"), manifest)
  writeSha256Sums(candidate, manifest)
  validateCandidate(candidate, manifest)

  if (existsSync(bundle)) { renameSync(bundle, backup); backupCreated = true }
  try {
    renameSync(candidate, bundle)
  } catch (error) {
    if (backupCreated && !existsSync(bundle)) renameSync(backup, bundle)
    throw error
  }
  if (backupCreated) rmSync(backup, { recursive: true, force: true })
  process.stdout.write(`Collected ${importedKeys.size} artifact(s) into ${bundle}\n`)
} catch (error) {
  process.stderr.write(`Rejected: ${String(error.message).split("\n")[0]}\n`)
  process.exitCode = 70
} finally {
  rmSync(transaction, { recursive: true, force: true })
}

function normalizeArtifactPath(path) {
  if (!path || isAbsolute(path) || path.split(/[\\/]+/).includes("..")) throw new Error(`invalid artifact path: ${path}`)
  return path.replace(/^dist[\\/]phase0[\\/]cs02[\\/]/, "")
}

function findArtifactRoot(input) {
  if (existsSync(join(input, "package-manifest.json"))) return input
  const nested = join(input, "dist", "phase0", "cs02")
  return existsSync(join(nested, "package-manifest.json")) ? nested : input
}

function isInside(root, path) {
  const prefix = resolve(root) + sep
  return resolve(path).startsWith(prefix)
}

function validateCandidate(root, manifest) {
  for (const artifact of manifest.artifacts.filter((item) => item.buildState === "built")) {
    const file = resolve(root, artifact.artifactRelativePath)
    if (!isInside(root, file) || !existsSync(file)) throw new Error(`candidate missing ${artifact.artifactRelativePath}`)
    if (sha256File(file) !== artifact.artifactSha256) throw new Error(`candidate digest mismatch ${artifact.artifactRelativePath}`)
  }
}

function inferTarget(artifact) {
  if (artifact.ideHost === "visual-studio") return "windows-x64"
  if (artifact.ideHost === "rider") {
    const value = `${artifact.artifactPath} ${artifact.targetIdeRange ?? ""}`
    if (value.includes("win32-x64")) return "windows-x64"
    if (value.includes("linux-x64")) return "linux-x64"
    if (value.includes("darwin-arm64")) return "macos-arm64"
  }
  return undefined
}

function abort(message, status) {
  process.stderr.write(`Rejected: ${message}\n`)
  process.exit(status)
}
