import { spawn } from "node:child_process"
import { stat, readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const riderRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const sandboxRoot = join(riderRoot, ".intellijPlatform/sandbox/gaep-rider/RD-2025.3")
const logPath = join(sandboxRoot, "log/idea.log")
const startupTimeoutMs = 90_000
const maximumLogBytes = 8 * 1024 * 1024
const maximumProcessOutputBytes = 512 * 1024

let output = ""
let child
let completed = false
let spawnFailure

function retainOutput(chunk) {
  output = `${output}${chunk.toString("utf8")}`.slice(-maximumProcessOutputBytes)
}

async function stopProcessTree(signal = "SIGTERM") {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return
  if (process.platform === "win32") {
    await new Promise((resolveTaskkill) => {
      const taskkill = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" })
      taskkill.once("close", resolveTaskkill)
      taskkill.once("error", resolveTaskkill)
    })
    return
  }
  try {
    process.kill(-child.pid, signal)
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) throw error
  }
}

async function readCurrentLog(startedAt) {
  let metadata
  try {
    metadata = await stat(logPath)
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined
    throw error
  }
  if (!metadata.isFile() || metadata.size < 1 || metadata.size > maximumLogBytes || metadata.mtimeMs < startedAt - 1_000) {
    return undefined
  }
  return readFile(logPath, "utf8")
}

const exactMarkers = [
  "IDE STARTED",
  "Loaded custom plugins: GAEP (0.1.0)",
  "id=dev.gaep.productstudio, version=0.1.0, isBundled=false",
  "GAEP_NATIVE_PLUGIN_ACTIVATED id=dev.gaep.productstudio version=0.1.0 boundary=no-provider-no-write-authority",
  "-Didea.plugin.in.sandbox.mode=true",
  "-Didea.required.plugins.id=dev.gaep.productstudio",
  `-Didea.config.path=${join(sandboxRoot, "config")}`,
  `-Didea.system.path=${join(sandboxRoot, "system")}`,
  `-Didea.plugins.path=${join(sandboxRoot, "plugins")}`,
  `-Didea.log.path=${join(sandboxRoot, "log")}`,
]

const startedAt = Date.now()
try {
  child = spawn(process.platform === "win32" ? "gradlew.bat" : "./gradlew", [
    "--no-daemon",
    "runIde",
    "--no-parallel",
  ], {
    cwd: riderRoot,
    detached: process.platform !== "win32",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  })
  child.stdout.on("data", retainOutput)
  child.stderr.on("data", retainOutput)
  child.once("error", (error) => { spawnFailure = error })

  while (Date.now() - startedAt < startupTimeoutMs) {
    if (spawnFailure) throw spawnFailure
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Rider sandbox exited before startup evidence was complete.\n${output}`)
    }
    const log = await readCurrentLog(startedAt)
    if (log && exactMarkers.every((marker) => log.includes(marker))) {
      completed = true
      process.stdout.write("PASS bounded Rider 2025.3 sandbox startup and native plugin-code activation: dev.gaep.productstudio@0.1.0 loaded from exact isolated paths\n")
      break
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250))
  }
  if (!completed) throw new Error(`Timed out waiting for exact Rider sandbox startup evidence.\n${output}`)
} finally {
  await stopProcessTree("SIGTERM")
  const exitDeadline = Date.now() + 10_000
  while (child && child.exitCode === null && child.signalCode === null && Date.now() < exitDeadline) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100))
  }
  if (child && child.exitCode === null && child.signalCode === null) await stopProcessTree("SIGKILL")
}
