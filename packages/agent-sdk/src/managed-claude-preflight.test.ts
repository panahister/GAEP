import { describe, expect, it } from "vitest"

import {
  MANAGED_CLAUDE_STAGED_REQUIRED_OPTIONS,
  preflightManagedClaudeStagedRuntime,
} from "./managed-claude-preflight.js"
import type { ExecutableFingerprint } from "./process.js"
import type { CommandResult } from "./types.js"

const fixedTime = "2026-07-24T17:00:00.000Z"
const executable = "/opt/claude/bin/claude"

function fingerprint(digestCharacter = "a"): ExecutableFingerprint {
  return {
    requested: "claude",
    canonicalPath: executable,
    digest: `sha256:${digestCharacter.repeat(64)}`,
    size: 42,
    modifiedAtMs: 123,
  }
}

function command(stdout: string, overrides: Partial<CommandResult> = {}): CommandResult {
  return {
    exitCode: 0,
    stdout,
    stderr: "",
    timedOut: false,
    outputExceeded: false,
    ...overrides,
  }
}

function dependencies(options: {
  version?: string
  help?: string
  fingerprints?: ExecutableFingerprint[]
  onCommand?: () => void
} = {}) {
  const observed = [...(options.fingerprints ?? [fingerprint(), fingerprint()])]
  return {
    now: () => new Date(fixedTime),
    fingerprinter: async () => observed.shift() ?? fingerprint(),
    commandRunner: async (_path: string, args: string[]) => {
      options.onCommand?.()
      if (args[0] === "--version") return command(options.version ?? "2.1.208 (Claude Code)")
      return command(options.help ?? MANAGED_CLAUDE_STAGED_REQUIRED_OPTIONS.join(" "))
    },
  }
}

describe("managed Claude staged-runtime offline preflight", () => {
  it("verifies the exact local CLI surface but remains blocked on auth and effective policy", async () => {
    const result = await preflightManagedClaudeStagedRuntime({
      executable,
      expectedExecutableFingerprint: fingerprint(),
      timeoutMs: 1_000,
    }, dependencies())

    expect(result).toMatchObject({
      schemaVersion: 1,
      kind: "gaep-managed-claude-staged-preflight-v1",
      scope: "machine-local",
      status: "blocked",
      observedAt: fixedTime,
      runtimeVersion: "2.1.208",
      unverifiedOptions: [],
    })
    expect(result.verifiedOptions).toEqual(MANAGED_CLAUDE_STAGED_REQUIRED_OPTIONS)
    expect(result.blockers.map((entry) => entry.code)).toEqual([
      "authentication-unattested",
      "managed-policy-unattested",
    ])
    expect(JSON.stringify(result)).not.toContain("ANTHROPIC_API_KEY=")
  })

  it("reports the local 2.1.153 version and hidden max-turns flag as separate blockers", async () => {
    const advertised = MANAGED_CLAUDE_STAGED_REQUIRED_OPTIONS.filter((option) => option !== "--max-turns")
    const result = await preflightManagedClaudeStagedRuntime({ executable }, dependencies({
      version: "2.1.153 (Claude Code)",
      help: advertised.join(" "),
    }))

    expect(result.runtimeVersion).toBe("2.1.153")
    expect(result.unverifiedOptions).toEqual(["--max-turns"])
    expect(result.blockers.map((entry) => entry.code)).toEqual([
      "required-option-unverified",
      "runtime-version-too-old",
      "authentication-unattested",
      "managed-policy-unattested",
    ])
    expect(result.blockers[0]!.message).toContain("unverified")
  })

  it("does not execute an unexpected binary after its bound fingerprint changes", async () => {
    let commandCount = 0
    const result = await preflightManagedClaudeStagedRuntime({
      executable,
      expectedExecutableFingerprint: fingerprint("b"),
    }, dependencies({ onCommand: () => { commandCount += 1 } }))

    expect(commandCount).toBe(0)
    expect(result.runtimeVersion).toBeUndefined()
    expect(result.blockers[0]!.code).toBe("executable-binding-changed")
  })

  it("invalidates observations when the executable changes during probing", async () => {
    const result = await preflightManagedClaudeStagedRuntime({ executable }, dependencies({
      fingerprints: [fingerprint("a"), fingerprint("b")],
    }))

    expect(result.runtimeVersion).toBeUndefined()
    expect(result.verifiedOptions).toEqual([])
    expect(result.unverifiedOptions).toEqual(MANAGED_CLAUDE_STAGED_REQUIRED_OPTIONS)
    expect(result.blockers[0]!.code).toBe("executable-binding-changed")
  })

  it("bounds command results even when an injected runner misreports its output ceiling", async () => {
    const oversized = "x".repeat((2 * 1_024 * 1_024) + 1)
    const result = await preflightManagedClaudeStagedRuntime({ executable }, dependencies({ help: oversized }))

    expect(result.blockers[0]!.code).toBe("probe-command-failed")
    expect(result.verifiedOptions).toEqual([])
    expect(JSON.stringify(result)).not.toContain(oversized.slice(0, 128))
  })
})
