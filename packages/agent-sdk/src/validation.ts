import {
  adapterCapabilitiesSnapshotSchema,
  agentSelectionSchema,
  legacyAdapterCapabilitiesV1Schema,
  legacyAgentSelectionV1Schema,
  type AdapterCapabilities,
  type AgentSelection,
  type AgentSetting,
} from "@gaep/contracts"

import { canonicalDigest } from "./digest.js"
import type { AdapterRuntimeBinding } from "./types.js"

export function capabilityDigest(capabilities: AdapterCapabilities): `sha256:${string}` {
  const parsed = adapterCapabilitiesSnapshotSchema.parse(capabilities)
  const { observedAt: _observedAt, ...stableCapabilities } = parsed
  return canonicalDigest(stableCapabilities) as `sha256:${string}`
}

export type AgentSelectionCompatibilityResult =
  | { status: "current"; selection: AgentSelection }
  | {
      status: "migration-required"
      portableCandidate: AgentSelection
      localRuntimeHint: {
        scope: "machine-local"
        requestedExecutable: string
      }
      capabilityReconfirmationRequired: true
    }
  | { status: "invalid"; issues: string[] }

export type AdapterCapabilitiesCompatibilityResult =
  | { status: "current"; capabilities: AdapterCapabilities }
  | {
      status: "migration-required"
      portableCandidate: AdapterCapabilities
      localRuntimeHint: {
        scope: "machine-local"
        requestedExecutable: string
      }
      capabilityReconfirmationRequired: true
    }
  | { status: "invalid"; issues: string[] }

/**
 * Parses persisted capability data without writing. Legacy executable data is
 * returned only as a local hint and is never copied into the portable candidate.
 */
export function parseAdapterCapabilitiesCompatibility(input: unknown): AdapterCapabilitiesCompatibilityResult {
  const current = adapterCapabilitiesSnapshotSchema.safeParse(input)
  if (current.success) return { status: "current", capabilities: current.data }

  const legacy = legacyAdapterCapabilitiesV1Schema.safeParse(input)
  if (legacy.success) {
    const {
      executablePath,
      schemaVersion: _legacySchemaVersion,
      ...portableFields
    } = legacy.data
    return {
      status: "migration-required",
      portableCandidate: adapterCapabilitiesSnapshotSchema.parse({ schemaVersion: 1, ...portableFields }),
      localRuntimeHint: { scope: "machine-local", requestedExecutable: executablePath },
      capabilityReconfirmationRequired: true,
    }
  }

  return {
    status: "invalid",
    issues: [...new Set([
      ...current.error.issues.map((issue) => issue.message),
      ...legacy.error.issues.map((issue) => issue.message),
    ])],
  }
}

/**
 * Parses without writing. Legacy executable data is separated into a local hint,
 * and the caller must re-probe/reconfirm capabilities before persisting v2.
 */
export function parseAgentSelectionCompatibility(input: unknown): AgentSelectionCompatibilityResult {
  const current = agentSelectionSchema.safeParse(input)
  if (current.success) return { status: "current", selection: current.data }

  const legacy = legacyAgentSelectionV1Schema.safeParse(input)
  if (legacy.success) {
    const {
      runtimeExecutable,
      schemaVersion: _legacySchemaVersion,
      ...portableFields
    } = legacy.data
    return {
      status: "migration-required",
      portableCandidate: agentSelectionSchema.parse({ schemaVersion: 2, ...portableFields }),
      localRuntimeHint: { scope: "machine-local", requestedExecutable: runtimeExecutable },
      capabilityReconfirmationRequired: true,
    }
  }

  return {
    status: "invalid",
    issues: [...new Set([
      ...current.error.issues.map((issue) => issue.message),
      ...legacy.error.issues.map((issue) => issue.message),
    ])],
  }
}

export function validateSelectionBase(
  selection: AgentSelection,
  capabilities: AdapterCapabilities,
): string[] {
  const errors: string[] = []
  const parsedSelection = agentSelectionSchema.safeParse(selection)
  if (!parsedSelection.success) {
    return ["Agent selection is not a valid portable v2 selection"]
  }
  const parsedCapabilities = adapterCapabilitiesSnapshotSchema.safeParse(capabilities)
  if (!parsedCapabilities.success) {
    return ["Adapter capabilities are not a valid portable snapshot"]
  }
  if (!capabilities.detected) errors.push(`${capabilities.agentLabel} is not installed or executable`)
  if (selection.adapterId !== capabilities.adapterId) errors.push("Adapter identity does not match capabilities")
  if (selection.agentId !== capabilities.agentId) errors.push("Agent identity does not match capabilities")
  if (selection.capabilityDigest !== capabilityDigest(capabilities)) {
    errors.push("Agent capabilities changed after selection; select the agent and model again")
  }
  if (!selection.modelId.trim()) errors.push("A model identifier is required")
  errors.push(...validateDeclaredSettings(selection.settings, capabilities.settings))
  return errors
}

export function requireExecutableRuntimeBinding(
  binding: AdapterRuntimeBinding,
  selection: AgentSelection,
  label: string,
): Extract<AdapterRuntimeBinding, { kind: "executable" }> {
  if (binding.scope !== "machine-local" || binding.kind !== "executable") {
    throw new Error(`${label} requires an executable machine-local runtime binding`)
  }
  if (binding.adapterId !== selection.adapterId || binding.agentId !== selection.agentId) {
    throw new Error(`${label} runtime binding identity does not match the portable selection`)
  }
  if (!binding.executablePath.trim() || binding.executableFingerprint.canonicalPath !== binding.executablePath) {
    throw new Error(`${label} runtime binding path is missing or does not match its executable fingerprint`)
  }
  if (!/^sha256:[0-9a-f]{64}$/u.test(binding.executableFingerprint.digest)) {
    throw new Error(`${label} runtime binding has an invalid executable fingerprint`)
  }
  return binding
}

export function requireManagedInProcessRuntimeBinding(
  binding: AdapterRuntimeBinding,
  selection: AgentSelection,
  runtimeId: string,
  label: string,
): Extract<AdapterRuntimeBinding, { kind: "managed-in-process" }> {
  if (binding.scope !== "machine-local" || binding.kind !== "managed-in-process") {
    throw new Error(`${label} requires a managed in-process runtime binding`)
  }
  if (binding.adapterId !== selection.adapterId || binding.agentId !== selection.agentId || binding.runtimeId !== runtimeId) {
    throw new Error(`${label} runtime binding identity does not match the portable selection`)
  }
  return binding
}

export function validateDeclaredSettings(
  values: Record<string, unknown>,
  declarations: AgentSetting[],
): string[] {
  const errors: string[] = []
  const declared = new Map(declarations.map((setting) => [setting.key, setting]))
  for (const key of Object.keys(values)) {
    if (!declared.has(key)) errors.push(`Unsupported agent setting: ${key}`)
  }
  for (const setting of declarations) {
    const value = values[setting.key]
    if (value === undefined) {
      if (setting.required && setting.defaultValue === undefined) {
        errors.push(`Agent setting ${setting.key} is required`)
      }
      continue
    }
    if (setting.sensitive) {
      errors.push(`Sensitive agent setting ${setting.key} requires a machine-local credential binding`)
      continue
    }
    switch (setting.kind) {
      case "select": {
        if (typeof value !== "string") {
          errors.push(`Agent setting ${setting.key} must be a string selection`)
          break
        }
        const options = setting.options?.map((option) => option.value) ?? []
        if (!options.includes(value)) errors.push(`Unsupported value for agent setting ${setting.key}`)
        break
      }
      case "boolean":
        if (typeof value !== "boolean") errors.push(`Agent setting ${setting.key} must be boolean`)
        break
      case "number":
        if (typeof value !== "number" || !Number.isFinite(value)) {
          errors.push(`Agent setting ${setting.key} must be a finite number`)
        } else {
          if (setting.minimum !== undefined && value < setting.minimum) {
            errors.push(`Agent setting ${setting.key} must be at least ${setting.minimum}`)
          }
          if (setting.maximum !== undefined && value > setting.maximum) {
            errors.push(`Agent setting ${setting.key} must be at most ${setting.maximum}`)
          }
        }
        break
      case "string":
        if (typeof value !== "string") errors.push(`Agent setting ${setting.key} must be a string`)
        break
      case "string-list":
        if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
          errors.push(`Agent setting ${setting.key} must be a list of non-empty strings`)
        }
        break
    }
  }
  return errors
}
