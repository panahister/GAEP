import {
  fingerprintExecutable,
  firstVersionToken,
  runCommand,
  type ExecutableFingerprint,
} from "./process.js"
import type { CommandResult } from "./types.js"

export const MANAGED_CLAUDE_STAGED_MINIMUM_VERSION = "2.1.208"

export const MANAGED_CLAUDE_STAGED_REQUIRED_OPTIONS = Object.freeze([
  "--print",
  "--output-format",
  "--verbose",
  "--no-session-persistence",
  "--bare",
  "--setting-sources",
  "--settings",
  "--strict-mcp-config",
  "--disable-slash-commands",
  "--no-chrome",
  "--tools",
  "--allowedTools",
  "--disallowedTools",
  "--model",
  "--permission-mode",
  "--max-turns",
] as const)

export type ManagedClaudeStagedPreflightBlockerCode =
  | "executable-verification-failed"
  | "executable-binding-changed"
  | "probe-command-failed"
  | "runtime-version-unverified"
  | "runtime-version-too-old"
  | "required-option-unverified"
  | "authentication-unattested"
  | "managed-policy-unattested"

export interface ManagedClaudeStagedPreflightBlocker {
  readonly code: ManagedClaudeStagedPreflightBlockerCode
  readonly message: string
  readonly remediation: string
}

export interface ManagedClaudeStagedPreflightRequest {
  executable: string
  expectedExecutableFingerprint?: ExecutableFingerprint
  timeoutMs?: number
}

export interface ManagedClaudeStagedPreflightResult {
  readonly schemaVersion: 1
  readonly kind: "gaep-managed-claude-staged-preflight-v1"
  readonly scope: "machine-local"
  readonly status: "blocked"
  readonly observedAt: string
  readonly executableFingerprint?: ExecutableFingerprint
  readonly runtimeVersion?: string
  readonly requiredMinimumVersion: typeof MANAGED_CLAUDE_STAGED_MINIMUM_VERSION
  readonly verifiedOptions: readonly string[]
  readonly unverifiedOptions: readonly string[]
  readonly blockers: readonly ManagedClaudeStagedPreflightBlocker[]
  readonly limitations: readonly string[]
}

export interface ManagedClaudeStagedPreflightDependencies {
  /** @internal Deterministic command boundary for tests and host integration. */
  commandRunner?: (
    executable: string,
    args: string[],
    options: { timeoutMs: number; maxOutputBytes: number },
  ) => Promise<CommandResult>
  /** @internal Deterministic executable identity boundary for tests and host integration. */
  fingerprinter?: typeof fingerprintExecutable
  /** @internal Deterministic clock for tests. */
  now?: () => Date
}

const maximumExecutableBytes = 16 * 1_024
const maximumProbeOutputBytes = 2 * 1_024 * 1_024
const maximumVersionOutputBytes = 64 * 1_024
const maximumProbeTimeoutMs = 60_000

const fixedLimitations = Object.freeze([
  "This offline preflight does not make a provider request, inspect credentials, or prove account, model, entitlement, network, cost, or provider availability.",
  "Claude Code documentation states that --help is not exhaustive; an option absent from help remains unverified, not proven unavailable.",
  "The result is machine-local because the executable fingerprint contains a canonical local path and must never be persisted in portable GAEP records.",
  "No caller-supplied boolean can satisfy authentication or effective administrator-policy attestation in this schema version.",
])

function blocker(
  code: ManagedClaudeStagedPreflightBlockerCode,
  message: string,
  remediation: string,
): ManagedClaudeStagedPreflightBlocker {
  return Object.freeze({ code, message, remediation })
}

function sameFingerprint(left: ExecutableFingerprint, right: ExecutableFingerprint): boolean {
  return left.canonicalPath === right.canonicalPath &&
    left.digest === right.digest &&
    left.size === right.size &&
    left.modifiedAtMs === right.modifiedAtMs
}

function boundedOutput(result: CommandResult, maximumBytes: number): boolean {
  return !result.outputExceeded &&
    Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr) <= maximumBytes
}

function successful(result: CommandResult, maximumBytes: number): boolean {
  return result.exitCode === 0 && !result.timedOut && boundedOutput(result, maximumBytes)
}

function versionAtLeast(value: string, minimum: string): boolean {
  const parsed = value.match(/^(\d+)\.(\d+)\.(\d+)(?:([-+])[0-9A-Za-z.-]+)?$/u)
  const required = minimum.match(/^(\d+)\.(\d+)\.(\d+)$/u)
  if (!parsed || !required) return false
  for (let index = 1; index <= 3; index += 1) {
    const currentPart = Number(parsed[index])
    const requiredPart = Number(required[index])
    if (currentPart > requiredPart) return true
    if (currentPart < requiredPart) return false
  }
  return parsed[4] !== "-"
}

function baseBlockers(): ManagedClaudeStagedPreflightBlocker[] {
  return [
    blocker(
      "authentication-unattested",
      "Bare-mode Claude authentication is not attested; this launcher injects neither ANTHROPIC_API_KEY nor apiKeyHelper configuration.",
      "Add a separately reviewed machine-local runtime-binding contract for one non-persisted authentication route; never place credential values in this preflight result or portable GAEP state.",
    ),
    blocker(
      "managed-policy-unattested",
      "Effective higher-priority Claude administrator policy is not attested and can override command-line settings or add permission/context behavior.",
      "Add a trusted machine-local effective-policy attestation that proves the staged file-only boundary before adapter capability advertisement; a caller assertion alone is insufficient.",
    ),
  ]
}

function result(
  now: () => Date,
  blockers: ManagedClaudeStagedPreflightBlocker[],
  options: {
    fingerprint?: ExecutableFingerprint
    runtimeVersion?: string
    verifiedOptions?: string[]
    unverifiedOptions?: string[]
  } = {},
): ManagedClaudeStagedPreflightResult {
  return Object.freeze({
    schemaVersion: 1,
    kind: "gaep-managed-claude-staged-preflight-v1",
    scope: "machine-local",
    status: "blocked",
    observedAt: now().toISOString(),
    executableFingerprint: options.fingerprint ? Object.freeze({ ...options.fingerprint }) : undefined,
    runtimeVersion: options.runtimeVersion,
    requiredMinimumVersion: MANAGED_CLAUDE_STAGED_MINIMUM_VERSION,
    verifiedOptions: Object.freeze([...(options.verifiedOptions ?? [])]),
    unverifiedOptions: Object.freeze([...(options.unverifiedOptions ?? MANAGED_CLAUDE_STAGED_REQUIRED_OPTIONS)]),
    blockers: Object.freeze([...blockers]),
    limitations: fixedLimitations,
  })
}

export async function preflightManagedClaudeStagedRuntime(
  request: ManagedClaudeStagedPreflightRequest,
  dependencies: ManagedClaudeStagedPreflightDependencies = {},
): Promise<ManagedClaudeStagedPreflightResult> {
  if (typeof request.executable !== "string" || !request.executable.trim() ||
      Buffer.byteLength(request.executable) > maximumExecutableBytes) {
    throw new Error("Managed Claude staged preflight executable must be a non-empty bounded string")
  }
  const timeoutMs = request.timeoutMs ?? 10_000
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > maximumProbeTimeoutMs) {
    throw new Error(`Managed Claude staged preflight timeout must be between 1 and ${maximumProbeTimeoutMs}`)
  }
  const now = dependencies.now ?? (() => new Date())
  const fingerprinter = dependencies.fingerprinter ?? fingerprintExecutable
  const commandRunner = dependencies.commandRunner ?? runCommand
  const blockers = baseBlockers()
  let observedFingerprint: ExecutableFingerprint
  try {
    observedFingerprint = await fingerprinter(
      request.executable,
      request.expectedExecutableFingerprint?.requested ?? request.executable,
    )
  } catch {
    blockers.unshift(blocker(
      "executable-verification-failed",
      "The Claude executable could not be fingerprinted as one stable regular file.",
      "Re-probe and bind one exact executable path and fingerprint before retrying staged-runtime preflight.",
    ))
    return result(now, blockers)
  }
  if (request.expectedExecutableFingerprint && !sameFingerprint(observedFingerprint, request.expectedExecutableFingerprint)) {
    blockers.unshift(blocker(
      "executable-binding-changed",
      "The Claude executable no longer matches the expected machine-local runtime binding.",
      "Re-probe capabilities and require a new explicit selection/binding decision before any staged execution.",
    ))
    return result(now, blockers, { fingerprint: observedFingerprint })
  }

  let versionCommand: CommandResult
  let helpCommand: CommandResult
  try {
    const commands = await Promise.all([
      commandRunner(observedFingerprint.canonicalPath, ["--version"], {
        timeoutMs,
        maxOutputBytes: maximumVersionOutputBytes,
      }),
      commandRunner(observedFingerprint.canonicalPath, ["--help"], {
        timeoutMs,
        maxOutputBytes: maximumProbeOutputBytes,
      }),
    ])
    versionCommand = commands[0]
    helpCommand = commands[1]
  } catch {
    blockers.unshift(blocker(
      "probe-command-failed",
      "A bounded Claude version/help probe failed before returning a result.",
      "Repair the local executable or wrapper and rerun the offline preflight; do not launch a provider request.",
    ))
    return result(now, blockers, { fingerprint: observedFingerprint })
  }

  let finalFingerprint: ExecutableFingerprint
  try {
    finalFingerprint = await fingerprinter(observedFingerprint.canonicalPath, observedFingerprint.requested)
  } catch {
    finalFingerprint = observedFingerprint
    blockers.unshift(blocker(
      "executable-verification-failed",
      "The Claude executable could not be re-fingerprinted after its bounded version/help probes.",
      "Re-probe and bind one stable executable before retrying staged-runtime preflight.",
    ))
    return result(now, blockers, { fingerprint: observedFingerprint })
  }
  if (!sameFingerprint(observedFingerprint, finalFingerprint) ||
      (request.expectedExecutableFingerprint && !sameFingerprint(finalFingerprint, request.expectedExecutableFingerprint))) {
    blockers.unshift(blocker(
      "executable-binding-changed",
      "The Claude executable changed during staged-runtime preflight.",
      "Discard these observations, re-probe the executable, and require a new explicit selection/binding decision.",
    ))
    return result(now, blockers, { fingerprint: finalFingerprint })
  }

  let runtimeVersion: string | undefined
  if (!successful(versionCommand, maximumVersionOutputBytes)) {
    blockers.unshift(blocker(
      "runtime-version-unverified",
      "The bounded Claude version command did not return one successful version observation.",
      "Use a Claude executable whose --version command succeeds within the configured time/output bounds.",
    ))
  } else {
    runtimeVersion = firstVersionToken(`${versionCommand.stdout}\n${versionCommand.stderr}`)
    if (!runtimeVersion) {
      blockers.unshift(blocker(
        "runtime-version-unverified",
        "The Claude version output did not contain one bounded semantic version token.",
        "Use a Claude executable with a parseable semantic --version response and re-probe its fingerprint.",
      ))
    } else if (!versionAtLeast(runtimeVersion, MANAGED_CLAUDE_STAGED_MINIMUM_VERSION)) {
      blockers.unshift(blocker(
        "runtime-version-too-old",
        `Claude Code ${runtimeVersion} is below the staged-runtime minimum ${MANAGED_CLAUDE_STAGED_MINIMUM_VERSION}.`,
        `Upgrade to Claude Code ${MANAGED_CLAUDE_STAGED_MINIMUM_VERSION} or later, then re-probe and rebind the executable fingerprint.`,
      ))
    }
  }

  const help = successful(helpCommand, maximumProbeOutputBytes)
    ? `${helpCommand.stdout}\n${helpCommand.stderr}`
    : ""
  const verifiedOptions = help
    ? MANAGED_CLAUDE_STAGED_REQUIRED_OPTIONS.filter((option) => help.includes(option))
    : []
  const unverifiedOptions = MANAGED_CLAUDE_STAGED_REQUIRED_OPTIONS.filter((option) => !verifiedOptions.includes(option))
  if (!help) {
    blockers.unshift(blocker(
      "probe-command-failed",
      "The bounded Claude help command failed, timed out, or exceeded its output ceiling.",
      "Use a Claude executable whose --help command succeeds within the configured time/output bounds.",
    ))
  } else if (unverifiedOptions.length > 0) {
    blockers.unshift(blocker(
      "required-option-unverified",
      `Required staged options remain unverified by Claude help: ${unverifiedOptions.join(", ")}.`,
      "Use an exact CLI version that advertises every required option, or add a separately reviewed non-provider parse probe before treating hidden options as verified.",
    ))
  }

  return result(now, blockers, {
    fingerprint: finalFingerprint,
    runtimeVersion,
    verifiedOptions,
    unverifiedOptions,
  })
}
