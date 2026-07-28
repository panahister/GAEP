#!/usr/bin/env node
// Real macOS acceptance for VS Code, Kiro, and Rider. All state is isolated under temporary
// user-data/config/system/plugin directories; normal IDE settings are never read or changed.
import { execFileSync, spawn } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, isAbsolute, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { bundleRoot, canonicalTarget, currentSourceIdentity, writeJsonAtomic } from "./lib/bundle.mjs"
import { resolveIde } from "./lib/ide_discovery.mjs"

const VERSION = "0.2.0"
const EXTENSION_IDS = { vscode: "gaep.gaep-vscode", kiro: "gaep.gaep-kiro" }

export function extensionId(ide) { return EXTENSION_IDS[ide] }
export function installArgs(userData, extensions, artifact) {
  return ["--user-data-dir", userData, "--extensions-dir", extensions, "--install-extension", artifact, "--force"]
}
export function listArgs(userData, extensions) {
  return ["--user-data-dir", userData, "--extensions-dir", extensions, "--list-extensions", "--show-versions"]
}
export function uninstallArgs(userData, extensions, id) {
  return ["--user-data-dir", userData, "--extensions-dir", extensions, "--uninstall-extension", id]
}
export function riderProperties(work) {
  return [
    `idea.config.path=${join(work, "config")}`,
    `idea.system.path=${join(work, "system")}`,
    `idea.plugins.path=${join(work, "plugins")}`,
    `idea.log.path=${join(work, "log")}`,
    "idea.suppress.statistics.report=true",
  ].join("\n") + "\n"
}

export async function main(argv = process.argv.slice(2)) {
  const value = (name) => { const index = argv.indexOf(name); return index >= 0 ? argv[index + 1] : undefined }
  const target = value("--target") ?? canonicalTarget()
  if (canonicalTarget() !== "macos-arm64") throw new Error("accept:macos must run on a macOS Apple-silicon host")
  if (target !== canonicalTarget()) throw new Error(`local acceptance target ${target} is not this host (${canonicalTarget()})`)
  const bundle = resolve(value("--bundle") ?? bundleRoot())
  const manifestPath = join(bundle, "bundle-manifest.json")
  if (!existsSync(manifestPath)) throw new Error(`missing bundle manifest: ${manifestPath}`)
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
  const identity = await currentSourceIdentity()
  // sourceCommit is provenance-only; sourceTreeDigest is the sole staleness identity. This lets a
  // generated-evidence-only commit preserve acceptance for an otherwise byte-identical source tree.
  if (manifest.sourceTreeDigest !== identity.sourceTreeDigest) {
    throw new Error("bundle is stale; regenerate it from the current source before local acceptance")
  }

  const evidenceRelativePath = `test-kits/${target}/local-install-results.json`
  const results = { schemaVersion: 1, target, sourceCommit: identity.baseCommit, sourceTreeDigest: identity.sourceTreeDigest, observedAt: new Date().toISOString(), artifacts: [] }
  for (const ide of ["vscode", "kiro"]) {
    const entry = manifest.artifacts.find((item) => item.ideHost === ide && item.artifactRelativePath?.startsWith(`${target}/`))
    const result = { ideHost: ide, artifactRelativePath: entry?.artifactRelativePath ?? null, state: "failed", steps: [] }
    results.artifacts.push(result)
    if (!entry || entry.buildState !== "built") { result.failureCategory = "artifact-not-built"; continue }
    const artifact = resolve(bundle, entry.artifactRelativePath)
    const artifactWithinBundle = relative(bundle, artifact)
    if (artifactWithinBundle.startsWith("..") || isAbsolute(artifactWithinBundle) || !existsSync(artifact)) { result.failureCategory = "artifact-missing"; continue }
    const discovery = resolveIde(ide)
    if (!discovery.path || discovery.source === "metadata") { result.failureCategory = "ide-cli-not-found"; continue }

    const work = mkdtempSync(join(tmpdir(), `gaep-${ide}-acceptance-`))
    const userData = join(work, "user-data")
    const extensions = join(work, "extensions")
    const id = extensionId(ide)
    try {
      execFileSync(discovery.path, installArgs(userData, extensions, artifact), { stdio: "pipe" })
      result.steps.push("install-passed")
      const installed = execFileSync(discovery.path, listArgs(userData, extensions), { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
      if (!installed.split(/\r?\n/).includes(`${id}@${VERSION}`)) throw new Error("installed extension/version was not listed")
      result.steps.push("list-passed")
      execFileSync(discovery.path, uninstallArgs(userData, extensions, id), { stdio: "pipe" })
      result.steps.push("uninstall-passed")
      const after = execFileSync(discovery.path, listArgs(userData, extensions), { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
      if (after.split(/\r?\n/).some((line) => line.startsWith(`${id}@`))) throw new Error("extension remained installed after uninstall")
      result.steps.push("cleanup-verification-passed")
      result.state = "passed"
      result.cliSource = discovery.source
      result.artifactName = basename(artifact)
    } catch (error) {
      result.failureCategory = "install-lifecycle-failed"
      result.sanitizedSummary = String(error.message).split("\n")[0].replaceAll(work, "[isolated-dir]").slice(0, 200)
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  }
  results.artifacts.push(await acceptRider(bundle, target, manifest))

  const evidencePath = join(bundle, evidenceRelativePath)
  writeJsonAtomic(evidencePath, results)
  for (const result of results.artifacts) {
    const entry = manifest.artifacts.find((item) => item.ideHost === result.ideHost && item.artifactRelativePath === result.artifactRelativePath)
    if (!entry) continue
    entry.installTestState = result.state
    entry.installEvidenceRelativePath = evidenceRelativePath
    entry.observedAt = results.observedAt
  }
  writeJsonAtomic(manifestPath, manifest)

  const failed = results.artifacts.filter((item) => item.state !== "passed")
  for (const result of results.artifacts) process.stdout.write(`${result.ideHost}: ${result.state} (${result.steps.join(", ") || result.failureCategory})\n`)
  if (failed.length) throw new Error(`local extension acceptance failed for: ${failed.map((item) => item.ideHost).join(", ")}`)
  process.stdout.write(`Local extension acceptance PASS: ${evidencePath}\n`)
}

async function acceptRider(bundle, target, manifest) {
  const ide = "rider"
  const entry = manifest.artifacts.find((item) => item.ideHost === ide && item.artifactRelativePath?.startsWith(`${target}/`))
  const result = { ideHost: ide, artifactRelativePath: entry?.artifactRelativePath ?? null, state: "failed", steps: [] }
  if (!entry || entry.buildState !== "built") { result.failureCategory = "artifact-not-built"; return result }
  const artifact = resolve(bundle, entry.artifactRelativePath)
  const artifactWithinBundle = relative(bundle, artifact)
  if (artifactWithinBundle.startsWith("..") || isAbsolute(artifactWithinBundle) || !existsSync(artifact)) { result.failureCategory = "artifact-missing"; return result }
  const discovery = resolveIde("rider")
  if (!discovery.path || !discovery.path.endsWith(".app")) { result.failureCategory = "rider-app-not-found"; return result }

  const work = mkdtempSync(join(tmpdir(), "gaep-rider-acceptance-"))
  const plugins = join(work, "plugins")
  const properties = join(work, "idea.properties")
  const executable = join(discovery.path, "Contents", "MacOS", "rider")
  mkdirSync(plugins, { recursive: true })
  try {
    execFileSync("unzip", ["-oq", artifact, "-d", plugins], { stdio: "pipe" })
    result.steps.push("isolated-install-passed")
    // JetBrains packages plugin.xml inside the plugin JAR, not at the outer ZIP level.
    const pluginJar = findFile(plugins, (name) => name.endsWith(".jar"))
    if (!pluginJar) throw new Error("Rider plugin JAR is missing")
    const descriptor = execFileSync("unzip", ["-p", pluginJar, "META-INF/plugin.xml"], { encoding: "utf8" })
    if (!descriptor.includes("<id>dev.gaep.platform</id>")) throw new Error("Rider plugin identity is missing")
    result.steps.push("plugin-identity-passed")
    writeFileSync(properties, riderProperties(work), "utf8")
    const child = spawn(executable, ["--nosplash"], {
      env: { ...process.env, RIDER_PROPERTIES: properties }, stdio: "ignore",
    })
    const loaded = await waitForRiderPlugin(child, join(work, "log", "idea.log"), 45_000)
    const stopped = await stopProcess(child, 10_000)
    if (!loaded) throw new Error("Rider did not record GAEP plugin loading in the isolated log")
    if (!stopped) throw new Error("Rider isolated process exit was not confirmed")
    result.steps.push("isolated-host-load-passed", "shutdown-passed")
    result.state = "passed"
    result.cliSource = discovery.source
    result.artifactName = basename(artifact)
  } catch (error) {
    result.failureCategory = "rider-install-lifecycle-failed"
    result.sanitizedSummary = String(error.message).split("\n")[0].replaceAll(work, "[isolated-dir]").slice(0, 200)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
  return result
}

function findFile(root, predicate) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) {
      const nested = findFile(path, predicate)
      if (nested) return nested
    } else if (predicate(entry.name)) {
      return path
    }
  }
  return undefined
}

function waitForRiderPlugin(child, logPath, timeoutMs) {
  return new Promise((resolveResult) => {
    const deadline = Date.now() + timeoutMs
    let exited = false
    child.once("exit", () => { exited = true })
    child.once("error", () => { exited = true })
    const timer = setInterval(() => {
      const log = existsSync(logPath) ? readFileSync(logPath, "utf8") : ""
      if (/dev\.gaep\.platform|Loaded custom plugins[^\n]*GAEP|GAEP \(0\.2\.0\)/i.test(log)) {
        clearInterval(timer); resolveResult(true)
      } else if (exited || Date.now() >= deadline) {
        clearInterval(timer); resolveResult(false)
      }
    }, 250)
  })
}

function stopProcess(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true)
  return new Promise((resolveResult) => {
    let done = false
    let forceTimer
    let confirmationTimer
    const finish = (confirmed) => {
      if (done) return
      done = true
      clearTimeout(forceTimer)
      clearTimeout(confirmationTimer)
      resolveResult(confirmed)
    }
    child.once("exit", () => finish(true))
    child.kill("SIGTERM")
    forceTimer = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL") }, timeoutMs)
    confirmationTimer = setTimeout(() => finish(false), timeoutMs + 2_000)
  })
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invoked) main().catch((error) => { process.stderr.write(`${String(error.message).split("\n")[0]}\n`); process.exit(1) })
