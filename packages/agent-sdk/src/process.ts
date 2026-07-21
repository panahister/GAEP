import { constants } from "node:fs"
import { access } from "node:fs/promises"
import { delimiter, join } from "node:path"
import { spawn } from "node:child_process"

import type { CommandResult } from "./types.js"

export async function findExecutable(name: string, pathValue = process.env.PATH ?? ""): Promise<string | null> {
  if (name.includes("/") || name.includes("\\")) {
    try {
      await access(name, constants.X_OK)
      return name
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

export async function runCommand(
  executable: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number; maxOutputBytes?: number } = {},
): Promise<CommandResult> {
  const timeoutMs = options.timeoutMs ?? 10_000
  const maxOutputBytes = options.maxOutputBytes ?? 4 * 1024 * 1024

  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    })
    let stdout = ""
    let stderr = ""
    let timedOut = false
    let overflow = false

    const append = (current: string, chunk: Buffer): string => {
      if (Buffer.byteLength(current) + chunk.length > maxOutputBytes) {
        overflow = true
        child.kill("SIGTERM")
        return current
      }
      return current + chunk.toString("utf8")
    }

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = append(stdout, chunk)
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = append(stderr, chunk)
    })

    const timer = setTimeout(() => {
      timedOut = true
      child.kill("SIGTERM")
    }, timeoutMs)

    child.on("error", (error) => {
      clearTimeout(timer)
      resolve({ exitCode: null, stdout, stderr: `${stderr}${error.message}`, timedOut })
    })
    child.on("close", (exitCode) => {
      clearTimeout(timer)
      if (overflow) stderr = `${stderr}\nOutput exceeded ${maxOutputBytes} bytes`
      resolve({ exitCode, stdout, stderr, timedOut })
    })
  })
}

export function firstVersionToken(output: string): string | undefined {
  return output.match(/\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?/)?.[0]
}
