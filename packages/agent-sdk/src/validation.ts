import { canonicalDigest } from "./digest.js"
import type { AdapterCapabilities, AgentSelection } from "@gaep/contracts"

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
  return errors
}
