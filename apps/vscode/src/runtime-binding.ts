import {
  capabilityDigest,
  type AdapterProbeResult,
  type ExecutableFingerprint,
} from "@gaep/agent-sdk"
import type { AgentSelection } from "@gaep/contracts"

interface RuntimeBindingBase {
  schemaVersion: 2
  scope: "machine-local"
  adapterId: string
  agentId: string
  capabilityDigest: AgentSelection["capabilityDigest"]
  observedAt: string
}

export type RuntimeBinding = RuntimeBindingBase & (
  | { kind: "executable"; executable: ExecutableFingerprint }
  | { kind: "managed-in-process"; runtimeId: string }
)

/** Values are validated at use because older extension builds stored a different shape. */
export type RuntimeBindingIndex = Record<string, unknown>

export type RuntimeBindingResolution =
  | { state: "ready"; binding: RuntimeBinding }
  | { state: "missing" }
  | { state: "legacy" }
  | { state: "invalid" }

export type VerifiedRuntimeBinding =
  | { kind: "executable"; fingerprint: ExecutableFingerprint }
  | { kind: "managed-in-process"; runtimeId: string }

export function runtimeBindingKey(workspacePath: string, adapterId: string): string {
  return `${workspacePath}\u0000${adapterId}`
}

function isFingerprint(value: unknown): value is ExecutableFingerprint {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.requested === "string" && candidate.requested.trim().length > 0 &&
    typeof candidate.canonicalPath === "string" && candidate.canonicalPath.trim().length > 0 &&
    typeof candidate.digest === "string" && /^sha256:[0-9a-f]{64}$/.test(candidate.digest) &&
    typeof candidate.size === "number" && Number.isSafeInteger(candidate.size) && candidate.size >= 0 &&
    typeof candidate.modifiedAtMs === "number" && Number.isFinite(candidate.modifiedAtMs)
}

function isRuntimeBinding(value: unknown): value is RuntimeBinding {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  const common = candidate.schemaVersion === 2 &&
    candidate.scope === "machine-local" &&
    typeof candidate.adapterId === "string" && candidate.adapterId.length > 0 &&
    typeof candidate.agentId === "string" && candidate.agentId.length > 0 &&
    typeof candidate.capabilityDigest === "string" && /^sha256:[0-9a-f]{64}$/.test(candidate.capabilityDigest) &&
    typeof candidate.observedAt === "string" && !Number.isNaN(Date.parse(candidate.observedAt))
  if (!common) return false
  if (candidate.kind === "executable") return isFingerprint(candidate.executable)
  return candidate.kind === "managed-in-process" && typeof candidate.runtimeId === "string" && candidate.runtimeId.trim().length > 0
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

export function verifiedRuntimeBinding(
  selection: AgentSelection,
  probe: AdapterProbeResult,
  resolution: RuntimeBindingResolution,
): VerifiedRuntimeBinding {
  if (probe.capabilities.adapterId !== selection.adapterId || probe.capabilities.agentId !== selection.agentId) {
    throw new Error("The fresh agent observation does not match the portable selection; select the agent again")
  }
  if (!probe.capabilities.detected || probe.capabilities.executionInterface === "unavailable") {
    throw new Error("The selected agent runtime is not currently available; select the agent again")
  }
  const observedDigest = capabilityDigest(probe.capabilities)
  if (observedDigest !== selection.capabilityDigest) {
    throw new Error("The selected agent capabilities changed; review and select the agent/model/settings again")
  }
  if (
    probe.runtimeBinding.scope !== "machine-local" ||
    probe.runtimeBinding.adapterId !== selection.adapterId ||
    probe.runtimeBinding.agentId !== selection.agentId
  ) {
    throw new Error("The selected agent returned an inconsistent machine-local runtime binding")
  }
  if (probe.runtimeBinding.kind === "managed-in-process") {
    if (probe.capabilities.executionInterface !== "managed-in-process" || !probe.runtimeBinding.runtimeId.trim()) {
      throw new Error("The selected agent returned an inconsistent managed in-process runtime binding")
    }
    if (resolution.state !== "ready" || resolution.binding.kind !== "managed-in-process") {
      throw new Error("No valid machine-local managed runtime binding is bound to this selection; select the agent again")
    }
    if (
      resolution.binding.adapterId !== selection.adapterId ||
      resolution.binding.agentId !== selection.agentId ||
      resolution.binding.capabilityDigest !== selection.capabilityDigest ||
      resolution.binding.runtimeId !== probe.runtimeBinding.runtimeId
    ) {
      throw new Error("The selected managed runtime or capability binding changed after selection; probe and select it again")
    }
    return { kind: "managed-in-process", runtimeId: probe.runtimeBinding.runtimeId }
  }
  if (probe.runtimeBinding.kind !== "executable") {
    throw new Error("The selected agent runtime is not currently available; select the agent again")
  }
  if (probe.capabilities.executionInterface === "managed-in-process") {
    throw new Error("The selected agent requires a managed in-process runtime binding")
  }
  if (resolution.state === "legacy") {
    throw new Error("The machine-local agent binding uses a legacy path-bearing format; explicitly select the agent again to rebind it")
  }
  if (resolution.state !== "ready") {
    throw new Error("No valid machine-local executable fingerprint is bound to this selection; select the agent again")
  }
  const stored = resolution.binding
  if (stored.kind !== "executable") {
    throw new Error("The selected executable agent is bound to an incompatible managed runtime; select the agent again")
  }
  if (
    stored.adapterId !== selection.adapterId ||
    stored.agentId !== selection.agentId ||
    stored.capabilityDigest !== selection.capabilityDigest ||
    !sameExecutableFingerprint(stored.executable, probe.runtimeBinding.executableFingerprint)
  ) {
    throw new Error("The selected agent executable or capability binding changed after selection; probe and select it again")
  }
  return { kind: "executable", fingerprint: probe.runtimeBinding.executableFingerprint }
}

export function verifiedExecutableBinding(
  selection: AgentSelection,
  probe: AdapterProbeResult,
  resolution: RuntimeBindingResolution,
): ExecutableFingerprint {
  const binding = verifiedRuntimeBinding(selection, probe, resolution)
  if (binding.kind !== "executable") {
    throw new Error("The selected agent uses managed in-process execution and cannot be launched through the legacy direct executable path")
  }
  return binding.fingerprint
}
