import { createHash } from "node:crypto"
import { createReadStream, constants } from "node:fs"
import { access, realpath, stat } from "node:fs/promises"
import { delimiter, isAbsolute, join, resolve } from "node:path"
import { spawn } from "node:child_process"

import type { CommandResult } from "./types.js"

export const DEFAULT_CHILD_ENVIRONMENT_KEYS = [
  "PATH",
  "HOME",
  "USERPROFILE",
  "SystemRoot",
  "WINDIR",
  "COMSPEC",
  "PATHEXT",
  "TMPDIR",
  "TMP",
  "TEMP",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "COLORTERM",
  "NO_COLOR",
  "SHELL",
  "XDG_CONFIG_HOME",
  "XDG_CACHE_HOME",
  "XDG_DATA_HOME",
] as const

export interface ExecutableFingerprint {
  requested: string
  canonicalPath: string
  digest: `sha256:${string}`
  size: number
  modifiedAtMs: number
}

function environmentKey(value: string): string {
  return process.platform === "win32" ? value.toUpperCase() : value
}

export function filterChildEnvironment(
  source: NodeJS.ProcessEnv = process.env,
  additionalAllowedKeys: readonly string[] = [],
  overrides: Record<string, string> = {},
): Record<string, string> {
  const allowed = new Set(
    [...DEFAULT_CHILD_ENVIRONMENT_KEYS, ...additionalAllowedKeys].map(environmentKey),
  )
  const filtered: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && allowed.has(environmentKey(key))) filtered[key] = value
  }
  for (const [key, value] of Object.entries(overrides)) {
    for (const inheritedKey of Object.keys(filtered)) {
      if (environmentKey(inheritedKey) === environmentKey(key)) delete filtered[inheritedKey]
    }
    filtered[key] = value
  }
  return filtered
}

async function locatedExecutable(name: string, pathValue: string): Promise<string | null> {
  if (name.includes("/") || name.includes("\\")) {
    const candidate = isAbsolute(name) ? name : resolve(name)
    try {
      await access(candidate, constants.X_OK)
      return candidate
    } catch {
      return null
    }
  }
  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";")
    : [""]

  for (const directory of pathValue.split(delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = join(directory, `${name}${extension}`)
      try {
        await access(candidate, constants.X_OK)
        return candidate
      } catch {
        // Continue through PATH candidates.
      }
    }
  }
  return null
}

export async function findExecutable(name: string, pathValue = process.env.PATH ?? ""): Promise<string | null> {
  const located = await locatedExecutable(name, pathValue)
  return located ? realpath(located) : null
}

export async function fingerprintExecutable(
  executablePath: string,
  requested = executablePath,
): Promise<ExecutableFingerprint> {
  const canonicalPath = await realpath(isAbsolute(executablePath) ? executablePath : resolve(executablePath))
  const before = await stat(canonicalPath)
  if (!before.isFile()) throw new Error(`Executable is not a regular file: ${canonicalPath}`)

  const hash = createHash("sha256")
  await new Promise<void>((resolveHash, reject) => {
    const stream = createReadStream(canonicalPath)
    stream.on("data", (chunk) => hash.update(chunk))
    stream.on("error", reject)
    stream.on("end", resolveHash)
  })
  const after = await stat(canonicalPath)
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
    throw new Error(`Executable changed while it was being fingerprinted: ${canonicalPath}`)
  }
  return {
    requested,
    canonicalPath,
    digest: `sha256:${hash.digest("hex")}`,
    size: after.size,
    modifiedAtMs: after.mtimeMs,
  }
}

export async function inspectExecutable(
  name: string,
  pathValue = process.env.PATH ?? "",
): Promise<ExecutableFingerprint | null> {
  const executablePath = await findExecutable(name, pathValue)
  return executablePath ? fingerprintExecutable(executablePath, name) : null
}

export async function runCommand(
  executable: string,
  args: string[],
  options: {
    cwd?: string
    timeoutMs?: number
    maxOutputBytes?: number
    terminationGraceMs?: number
    killGraceMs?: number
  } = {},
): Promise<CommandResult> {
  const timeoutMs = options.timeoutMs ?? 10_000
  const maxOutputBytes = options.maxOutputBytes ?? 4 * 1024 * 1024
  const terminationGraceMs = options.terminationGraceMs ?? 250
  const killGraceMs = options.killGraceMs ?? 250
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error("timeoutMs must be a positive safe integer")
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 1) {
    throw new Error("maxOutputBytes must be a positive safe integer")
  }
  if (!Number.isSafeInteger(terminationGraceMs) || terminationGraceMs < 1) {
    throw new Error("terminationGraceMs must be a positive safe integer")
  }
  if (!Number.isSafeInteger(killGraceMs) || killGraceMs < 1) {
    throw new Error("killGraceMs must be a positive safe integer")
  }

  return new Promise((resolve) => {
    let child
    try {
      child = spawn(executable, args, {
        cwd: options.cwd,
        env: filterChildEnvironment(),
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        detached: true,
      })
    } catch (error) {
      const message = Buffer.from(error instanceof Error ? error.message : String(error), "utf8")
      resolve({
        exitCode: null,
        stdout: "",
        stderr: message.subarray(0, maxOutputBytes).toString("utf8"),
        timedOut: false,
        outputExceeded: message.length > maxOutputBytes,
      })
      return
    }
    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    let outputBytes = 0
    let timedOut = false
    let outputExceeded = false
    let terminating = false
    let settled = false
    let closeObserved = false
    let closeExitCode: number | null = null
    let killEscalated = false
    let timeoutTimer: NodeJS.Timeout | undefined
    let escalationTimer: NodeJS.Timeout | undefined
    let hardStopTimer: NodeJS.Timeout | undefined

    const signalProcessTree = (signal: NodeJS.Signals): void => {
      if (!child.pid) return
      if (process.platform === "win32" && signal === "SIGKILL") {
        try {
          const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
            env: filterChildEnvironment(),
            stdio: "ignore",
            windowsHide: true,
          })
          killer.on("error", () => {
            try {
              child.kill("SIGKILL")
            } catch {
              // The hard-stop timer still guarantees settlement.
            }
          })
          killer.unref()
          return
        } catch {
          // Fall through to the direct-child fallback.
        }
      } else if (process.platform !== "win32") {
        try {
          process.kill(-child.pid, signal)
          return
        } catch {
          // Fall back to the direct child if the process group is already unavailable.
        }
      }
      try {
        child.kill(signal)
      } catch {
        // The hard-stop timer still guarantees settlement.
      }
    }

    const finish = (exitCode: number | null): void => {
      if (settled) return
      settled = true
      if (timeoutTimer) clearTimeout(timeoutTimer)
      if (escalationTimer) clearTimeout(escalationTimer)
      if (hardStopTimer) clearTimeout(hardStopTimer)
      child.stdout.off("data", onStdout)
      child.stderr.off("data", onStderr)
      child.off("error", onError)
      child.off("close", onClose)
      child.stdout.destroy()
      child.stderr.destroy()
      if (!closeObserved) child.unref()
      resolve({
        exitCode,
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        timedOut,
        outputExceeded,
      })
    }

    const terminate = (): void => {
      if (terminating || settled) return
      terminating = true
      signalProcessTree("SIGTERM")
      escalationTimer = setTimeout(() => {
        killEscalated = true
        signalProcessTree("SIGKILL")
        if (closeObserved) finish(closeExitCode)
      }, terminationGraceMs)
      hardStopTimer = setTimeout(() => finish(null), terminationGraceMs + killGraceMs)
    }

    const append = (destination: Buffer[], chunk: Buffer): void => {
      if (settled || outputExceeded) return
      const remaining = maxOutputBytes - outputBytes
      if (chunk.length <= remaining) {
        destination.push(chunk)
        outputBytes += chunk.length
        return
      }
      if (remaining > 0) {
        destination.push(chunk.subarray(0, remaining))
        outputBytes += remaining
      }
      outputExceeded = true
      terminate()
    }

    const onStdout = (chunk: Buffer): void => append(stdoutChunks, chunk)
    const onStderr = (chunk: Buffer): void => append(stderrChunks, chunk)
    const onError = (error: Error): void => {
      append(stderrChunks, Buffer.from(error.message, "utf8"))
      if (!child.pid) finish(null)
      else terminate()
    }
    const onClose = (exitCode: number | null): void => {
      closeObserved = true
      closeExitCode = exitCode
      if (!terminating || killEscalated) finish(exitCode)
    }

    child.stdout.on("data", onStdout)
    child.stderr.on("data", onStderr)
    child.on("error", onError)
    child.on("close", onClose)

    timeoutTimer = setTimeout(() => {
      timedOut = true
      terminate()
    }, timeoutMs)
  })
}

export function firstVersionToken(output: string): string | undefined {
  return output.match(/\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?/)?.[0]
}
