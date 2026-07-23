import type { AdapterCapabilities } from "@gaep/contracts"

export const manualModelEntryCopy = {
  label: "Enter an unverified model identifier...",
  description: "Configured, not provider-observed. Identifier validity, authentication, account entitlement, and model availability remain unverified until fail-closed launch; acceptance is attempt-scoped.",
  prompt: "Enter the exact model identifier. It is recorded as configured, not provider-observed. Identifier validity, authentication, account entitlement, and model availability remain unverified until fail-closed launch; acceptance is attempt-scoped.",
} as const

export function agentStatus(capability: AdapterCapabilities): string {
  const maturity = `interface maturity ${capability.interfaceMaturity}`
  if (!capability.detected) return `Not detected · managed interface not observed · ${maturity}`
  if (capability.executionInterface === "unavailable") {
    return `Detected · managed execution interface unsupported by this build · ${maturity}`
  }
  if (capability.executionInterface === "managed-in-process") {
    return `Detected · managed in-process capability · ${maturity}`
  }
  if (capability.executionInterface === "cli-stream-json") {
    return `Detected · managed stream capability · ${maturity}`
  }
  if (capability.executionInterface === "cli-jsonl") {
    return `Detected · structured CLI capability · ${maturity}`
  }
  if (capability.executionInterface === "stdio-rpc") {
    return `Detected · managed stdio RPC capability · ${maturity}`
  }
  return `Detected · ${capability.executionInterface} · ${maturity}`
}
