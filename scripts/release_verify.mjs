#!/usr/bin/env node
// GAEP-P0-CS02 — verify a local release bundle: recompute SHA-256 over exact bytes, verify manifest
// identity fields, verify package membership (each applicable package embeds the Engine Host + digest
// sidecar), run a target-local protocol-v3 smoke where the SEA is native to this host, and fail on
// missing/mismatched/stale/duplicate/unexpected artifacts. `--require-all-targets` demands the full
// matrix after Windows/Linux artifacts are collected.
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { tmpdir } from "node:os"
import { isAbsolute, join, resolve, sep } from "node:path"

import {
  CHANGE_SET_ID, VERSION, canonicalTarget, IDES_BY_TARGET, SEA_TARGET, artifactName, sha256File, currentSourceIdentity, TARGET_OS,
} from "./lib/bundle.mjs"
import { archiveContainsAll } from "./lib/zip.mjs"

function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined }
const bundle = arg("--bundle")
const requireAll = process.argv.includes("--require-all-targets")
if (!bundle) { process.stderr.write("Usage: release_verify.mjs --bundle <dir> [--require-all-targets]\n"); process.exit(64) }

const manifestPath = join(bundle, "bundle-manifest.json")
if (!existsSync(manifestPath)) { fail("missing bundle-manifest.json"); process.exit(70) }
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))

const errors = []
function fail(message) { errors.push(message); process.stderr.write(`FAIL: ${message}\n`) }

// Identity fields.
if (manifest.changeSetId !== CHANGE_SET_ID) fail(`changeSetId ${manifest.changeSetId} != ${CHANGE_SET_ID}`)
if (manifest.version !== VERSION) fail(`version ${manifest.version} != ${VERSION}`)
const currentIdentity = await currentSourceIdentity()
if (manifest.sourceTreeDigest !== currentIdentity.sourceTreeDigest) fail("bundle is stale: sourceTreeDigest differs from the current source tree")
// sourceTreeDigest is the equivalence/staleness authority. A commit that changes only excluded,
// generated evidence is valid provenance and must not invalidate a byte-identical source tree.

// Every artifact must share the manifest's source identity (no mixed-commit bundle).
for (const a of manifest.artifacts) {
  if (a.sourceTreeDigest !== manifest.sourceTreeDigest) fail(`${a.artifactRelativePath}: sourceTreeDigest differs from the bundle`)
}

// No duplicate (targetOs/arch/ide) entries.
const seen = new Set()
for (const a of manifest.artifacts) {
  const key = `${a.targetOs}/${a.targetArch}/${a.ideHost}`
  if (seen.has(key)) fail(`duplicate artifact entry: ${key}`)
  seen.add(key)
}

// The membership basenames the applicable package must embed.
function requiredMembers(ide, target) {
  if (ide === "vscode" || ide === "kiro") return [`gaep-engine-host-${VERSION}.cjs`, "engine-host.sha256"]
  if (ide === "rider") return [`gaep-engine-host-${VERSION}-${SEA_TARGET[target]}`, `gaep-engine-host-${VERSION}-${SEA_TARGET[target]}.sha256`]
  if (ide === "visual-studio") return [`gaep-engine-host-${VERSION}-win32-x64.exe`, `gaep-engine-host-${VERSION}-win32-x64.exe.sha256`]
  return []
}

const host = canonicalTarget()
for (const a of manifest.artifacts) {
  if (!a.artifactRelativePath || isAbsolute(a.artifactRelativePath) || a.artifactRelativePath.split(/[\\/]+/).includes("..")) {
    fail(`invalid artifact path: ${a.artifactRelativePath}`)
    continue
  }
  const abs = join(bundle, a.artifactRelativePath)
  if (!resolve(abs).startsWith(resolve(bundle) + sep)) { fail(`artifact escapes bundle: ${a.artifactRelativePath}`); continue }
  if (a.buildState === "built") {
    if (!existsSync(abs)) { fail(`built artifact missing on disk: ${a.artifactRelativePath}`); continue }
    if (sha256File(abs) !== a.artifactSha256) fail(`digest mismatch: ${a.artifactRelativePath}`)
    // Package membership: the package must embed its Engine Host + digest sidecar.
    const target = a.artifactRelativePath.split("/")[0]
    const members = requiredMembers(a.ideHost, target)
    if (members.length && !archiveContainsAll(abs, members)) fail(`${a.artifactRelativePath}: missing embedded Engine Host/sidecar (${members.join(", ")})`)
  } else if (a.buildState === "not-built") {
    if (a.artifactSha256 !== null || !a.notBuiltReason) fail(`invalid not-built entry: ${a.artifactRelativePath}`)
  } else {
    fail(`unexpected buildState '${a.buildState}' for ${a.artifactRelativePath}`)
  }
}

// SHA256SUMS.txt must match the built set exactly.
verifySums()

// Require-all-targets: every applicable (target, ide) must be present and built.
if (requireAll) {
  for (const target of Object.keys(IDES_BY_TARGET)) {
    for (const ide of IDES_BY_TARGET[target]) {
      const entry = manifest.artifacts.find((a) => a.artifactRelativePath === `${target}/${ide}/${artifactName(ide, target)}`)
      if (!entry) fail(`require-all-targets: missing ${target}/${ide}`)
      else if (entry.buildState !== "built") fail(`require-all-targets: ${target}/${ide} is ${entry.buildState}`)
    }
  }
}

// Target-local protocol smoke where the SEA is native to this host: extract the Rider-embedded SEA and
// run a protocol-v3 dashboardProjection. (VS Code/Kiro embed the CJS host, exercised elsewhere.)
await protocolSmoke()

if (errors.length) { process.stderr.write(`\nBundle verification FAILED (${errors.length} error(s)).\n`); process.exit(1) }
process.stdout.write(`Bundle verification PASS: ${bundle}\n`)

// --- helpers ---
function verifySums() {
  const sumsPath = join(bundle, "SHA256SUMS.txt")
  if (!existsSync(sumsPath)) { fail("missing SHA256SUMS.txt"); return }
  const declared = new Map()
  for (const line of readFileSync(sumsPath, "utf8").split("\n")) {
    const m = /^([0-9a-f]{64})\s{2}(.+)$/.exec(line.trim())
    if (m) {
      if (declared.has(m[2])) fail(`duplicate SHA256SUMS entry: ${m[2]}`)
      declared.set(m[2], `sha256:${m[1]}`)
    }
  }
  const built = manifest.artifacts.filter((x) => x.buildState === "built")
  for (const a of built) {
    if (declared.get(a.artifactRelativePath) !== a.artifactSha256) fail(`SHA256SUMS mismatch/missing for ${a.artifactRelativePath}`)
  }
  const expected = new Set(built.map((a) => a.artifactRelativePath))
  for (const path of declared.keys()) if (!expected.has(path)) fail(`unexpected SHA256SUMS entry: ${path}`)
}

async function protocolSmoke() {
  const target = host
  const rider = manifest.artifacts.find((a) => a.artifactRelativePath === `${target}/rider/${artifactName("rider", target)}` && a.buildState === "built")
  if (!rider) return // no native Rider package for this host in the bundle; nothing executable to smoke
  const zip = join(bundle, rider.artifactRelativePath)
  const work = mkdtempSync(join(tmpdir(), "gaep-smoke-"))
  try {
    execFileSync("unzip", ["-oq", zip, "-d", work], { stdio: "ignore" })
    const seaName = `gaep-engine-host-${VERSION}-${SEA_TARGET[target]}${target === "windows-x64" ? ".exe" : ""}`
    const found = findFile(work, seaName)
    if (!found) { fail("protocol smoke: embedded SEA not found in Rider package"); return }
    if (process.platform !== "win32") chmodSync(found, 0o755)
    const ws = mkdtempSync(join(tmpdir(), "gaep-smoke-ws-"))
    const ok = await runProtocol(found, ws)
    rmSync(ws, { recursive: true, force: true })
    if (!ok) fail("protocol smoke: Engine Host did not return a protocol-v3 dashboardProjection")
    else process.stdout.write("protocol smoke: PASS (Rider-embedded darwin SEA answered dashboardProjection)\n")
  } catch (error) {
    fail(`protocol smoke error: ${String(error.message).split("\n")[0]}`)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

function runProtocol(sea, workspace) {
  return new Promise((resolve) => {
    const child = spawn(sea, ["--workspace", workspace], { stdio: ["pipe", "pipe", "ignore"] })
    let out = ""
    let settled = false
    const finish = (value) => { if (settled) return; settled = true; clearTimeout(timer); resolve(value) }
    const timer = setTimeout(() => { try { child.kill("SIGKILL") } catch {}; finish(false) }, 15000)
    child.stdout.on("data", (c) => {
      out += c
      if (out.includes('"result"') && out.includes("hostMatrix")) { try { child.stdin.end() } catch {}; finish(true) }
    })
    child.on("error", () => finish(false))
    child.on("exit", () => finish(out.includes('"result"') && out.includes("hostMatrix")))
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, protocolVersion: 3, method: "dashboardProjection", params: {} })}\n`)
  })
}

function findFile(root, basename) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) { const nested = findFile(path, basename); if (nested) return nested }
    else if (entry.name === basename) return path
  }
  return undefined
}

void TARGET_OS
