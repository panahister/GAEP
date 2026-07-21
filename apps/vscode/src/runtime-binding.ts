import {
  capabilityDigest,
  type AdapterProbeResult,
  type ExecutableFingerprint,
} from "@gaep/agent-sdk"
import type { AgentSelection } from "@gaep/contracts"

export interface RuntimeBinding {
  schemaVersion: 2
  scope: "machine-local"
  kind: "executable"
  adapterId: string
  agentId: string
  capabilityDigest: `sha256:${string}`
  executable: ExecutableFingerprint
  observedAt: string
}

/** Values are validated at use because older extension builds stored a different shape. */
export type RuntimeBindingIndex = Record<string, unknown>

export type RuntimeBindingResolution =
  | { state: "ready"; binding: RuntimeBinding }
  | { state: "missing" }
  | { state: "legacy" }
  | { state: "invalid" }

export function runtimeBindingKey(workspacePath: string, adapterId: string): string {
  return `${workspacePath}\u0000${adapterId}`
}

function isFingerprint(value: unknown): value is ExecutableFingerprint {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.requested === "string" &&
    typeof candidate.canonicalPath === "string" &&
    typeof candidate.digest === "string" && /^sha256:[0-9a-f]{64}$/.test(candidate.digest) &&
    typeof candidate.size === "number" && Number.isSafeInteger(candidate.size) && candidate.size >= 0 &&
    typeof candidate.modifiedAtMs === "number" && Number.isFinite(candidate.modifiedAtMs)
}

function isRuntimeBinding(value: unknown): value is RuntimeBinding {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return candidate.schemaVersion === 2 &&
    candidate.scope === "machine-local" &&
    candidate.kind === "executable" &&
    typeof candidate.adapterId === "string" && candidate.adapterId.length > 0 &&
    typeof candidate.agentId === "string" && candidate.agentId.length > 0 &&
    typeof candidate.capabilityDigest === "string" && /^sha256:[0-9a-f]{64}$/.test(candidate.capabilityDigest) &&
    isFingerprint(candidate.executable) &&
    typeof candidate.observedAt === "string" && !Number.isNaN(Date.parse(candidate.observedAt))
}

function looksLikeLegacyBinding(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return candidate.schemaVersion === 1 ||
    (typeof candidate.adapterId === "string" && typeof candidate.canonicalPath === "string")
}

export function resolveRuntimeBinding(
  index: RuntimeBindingIndex,
  workspacePath: string,
  adapterId: string,
): RuntimeBindingResolution {
  const value = index[runtimeBindingKey(workspacePath, adapterId)]
  if (value === undefined) return { state: "missing" }
  if (isRuntimeBinding(value)) return { state: "ready", binding: value }
  return { state: looksLikeLegacyBinding(value) ? "legacy" : "invalid" }
}

export function sameExecutableFingerprint(
  expected: Pick<ExecutableFingerprint, "canonicalPath" | "digest" | "size" | "modifiedAtMs">,
  actual: Pick<ExecutableFingerprint, "canonicalPath" | "digest" | "size" | "modifiedAtMs">,
): boolean {
  return expected.canonicalPath === actual.canonicalPath &&
    expected.digest === actual.digest &&
    expected.size === actual.size &&
    expected.modifiedAtMs === actual.modifiedAtMs
}

export function verifiedExecutableBinding(
  selection: AgentSelection,
  probe: AdapterProbeResult,
  resolution: RuntimeBindingResolution,
): ExecutableFingerprint {
  if (probe.capabilities.adapterId !== selection.adapterId || probe.capabilities.agentId !== selection.agentId) {
    throw new Error("The fresh agent observation does not match the portable selection; select the agent again")
  }
  if (!probe.capabilities.detected || probe.runtimeBinding.kind !== "executable") {
    throw new Error("The selected agent executable is not currently available; select the agent again")
  }
  const observedDigest = capabilityDigest(probe.capabilities)
  if (observedDigest !== selection.capabilityDigest) {
    throw new Error("The selected agent capabilities changed; review and select the agent/model/settings again")
  }
  if (resolution.state === "legacy") {
    throw new Error("The machine-local agent binding uses a legacy path-bearing format; explicitly select the agent again to rebind it")
  }
  if (resolution.state !== "ready") {
    throw new Error("No valid machine-local executable fingerprint is bound to this selection; select the agent again")
  }
  const stored = resolution.binding
  if (
    stored.adapterId !== selection.adapterId ||
    stored.agentId !== selection.agentId ||
    stored.capabilityDigest !== selection.capabilityDigest ||
    !sameExecutableFingerprint(stored.executable, probe.runtimeBinding.executableFingerprint)
  ) {
    throw new Error("The selected agent executable or capability binding changed after selection; probe and select it again")
  }
  return probe.runtimeBinding.executableFingerprint
}
