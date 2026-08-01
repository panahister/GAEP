import { chmod, mkdtemp, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { afterEach, describe, expect, it } from "vitest"

import { filterChildEnvironment, findExecutable, fingerprintExecutable, runCommand } from "./process.js"

const processFixture = fileURLToPath(new URL("../test/fixtures/process-child.mjs", import.meta.url))

describe("agent process safety", () => {
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
  })

  it("returns a canonical executable path and stable content fingerprint", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gaep-executable-"))
    temporaryDirectories.push(directory)
    const executableName = process.platform === "win32" ? "agent.CMD" : "agent"
    const executable = join(directory, executableName)
    await writeFile(executable, process.platform === "win32" ? "@exit /b 0\r\n" : "#!/bin/sh\nexit 0\n")
    await chmod(executable, 0o700)

    const located = await findExecutable("agent", directory)
    const fingerprint = await fingerprintExecutable(located!)

    const canonicalExecutable = await realpath(executable)
    expect(located).toBe(canonicalExecutable)
    expect(fingerprint.canonicalPath).toBe(canonicalExecutable)
    expect(fingerprint.digest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(fingerprint.size).toBeGreaterThan(0)

    await writeFile(executable, process.platform === "win32" ? "@echo changed\r\n" : "#!/bin/sh\necho changed\n")
    const changed = await fingerprintExecutable(executable)
    expect(changed.digest).not.toBe(fingerprint.digest)
  })

  it("filters ambient secrets while preserving explicitly allowed runtime keys", () => {
    const environment = filterChildEnvironment({
      PATH: "/bin",
      HOME: "/home/founder",
      USER: "founder",
      LOGNAME: "founder",
      CODEX_HOME: "/private/codex",
      CLAUDE_CONFIG_DIR: "/private/claude",
      GITHUB_TOKEN: "must-not-pass",
      PROVIDER_OPT_IN: "allowed",
    }, ["PROVIDER_OPT_IN"])

    expect(environment).toEqual({
      PATH: "/bin",
      HOME: "/home/founder",
      USER: "founder",
      LOGNAME: "founder",
      PROVIDER_OPT_IN: "allowed",
    })
    expect(environment).not.toHaveProperty("GITHUB_TOKEN")
    expect(environment).not.toHaveProperty("CODEX_HOME")
    expect(environment).not.toHaveProperty("CLAUDE_CONFIG_DIR")

    expect(filterChildEnvironment({
      CODEX_HOME: "/private/codex",
      CLAUDE_CONFIG_DIR: "/private/claude",
    }, ["CODEX_HOME"])).toEqual({ CODEX_HOME: "/private/codex" })
  })

  it("captures stdout and stderr split across real process events", async () => {
    const result = await runCommand(process.execPath, [processFixture, "split-output"], { timeoutMs: 1_000 })

    expect(result).toMatchObject({
      exitCode: 0,
      stdout: "out-one-out-three",
      stderr: "err-two",
      timedOut: false,
      outputExceeded: false,
    })
  })

  it("bounds stdout and stderr together and terminates the overflowing process", async () => {
    const result = await runCommand(process.execPath, [processFixture, "overflow"], {
      timeoutMs: 2_000,
      maxOutputBytes: 40,
      terminationGraceMs: 25,
      killGraceMs: 100,
    })

    expect(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr)).toBeLessThanOrEqual(40)
    expect(result.outputExceeded).toBe(true)
    expect(result.timedOut).toBe(false)
  })

  it("escalates to SIGKILL when a real process ignores SIGTERM", async () => {
    const startedAt = Date.now()
    const result = await runCommand(process.execPath, [processFixture, "ignore-sigterm"], {
      timeoutMs: 50,
      terminationGraceMs: 50,
      killGraceMs: 150,
    })

    expect(result.timedOut).toBe(true)
    expect(result.outputExceeded).toBe(false)
    expect(Date.now() - startedAt).toBeLessThan(1_500)
  })

  it("times out and terminates a normally responsive real process", async () => {
    const result = await runCommand(process.execPath, [processFixture, "timeout"], {
      timeoutMs: 50,
      terminationGraceMs: 25,
      killGraceMs: 100,
    })

    expect(result).toMatchObject({
      timedOut: true,
      outputExceeded: false,
    })
  })

  it("settles a spawn error exactly once without waiting for the timeout", async () => {
    const startedAt = Date.now()
    const result = await runCommand(join(tmpdir(), "gaep-definitely-not-an-executable"), [], {
      timeoutMs: 1_000,
      terminationGraceMs: 25,
      killGraceMs: 25,
    })

    expect(result.exitCode).toBeNull()
    expect(result.stderr).toMatch(/ENOENT|spawn/i)
    expect(result.timedOut).toBe(false)
    expect(result.outputExceeded).toBe(false)
    expect(Date.now() - startedAt).toBeLessThan(500)
  })
})
