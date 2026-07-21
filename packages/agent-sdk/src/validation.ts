import { canonicalDigest } from "./digest.js"
import type { AdapterCapabilities, AgentSelection, AgentSetting } from "@gaep/contracts"

export function capabilityDigest(capabilities: AdapterCapabilities): string {
  const { observedAt: _observedAt, ...stableCapabilities } = capabilities
  return canonicalDigest(stableCapabilities)
}

export function validateSelectionBase(
  selection: AgentSelection,
  capabilities: AdapterCapabilities,
): string[] {
  const errors: string[] = []
  if (!capabilities.detected) errors.push(`${capabilities.agentLabel} is not installed or executable`)
  if (selection.adapterId !== capabilities.adapterId) errors.push("Adapter identity does not match capabilities")
  if (selection.agentId !== capabilities.agentId) errors.push("Agent identity does not match capabilities")
  if (selection.runtimeExecutable !== capabilities.executablePath) {
    errors.push("Selected executable does not match the detected agent runtime")
  }
  if (selection.capabilityDigest !== capabilityDigest(capabilities)) {
    errors.push("Agent capabilities changed after selection; select the agent and model again")
  }
  if (!selection.modelId.trim()) errors.push("A model identifier is required")
  errors.push(...validateDeclaredSettings(selection.settings, capabilities.settings))
  return errors
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
