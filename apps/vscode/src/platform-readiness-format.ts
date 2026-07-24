import type { PlatformReadinessSnapshot } from "@gaep/contracts"

/**
 * Pure rendering of a Platform Readiness snapshot into read-only diagnostic lines.
 * Extracted from the command handler so rendering can be unit-tested independently of the
 * VS Code host (computation proof lives in the extension-host E2E).
 */
export function formatPlatformReadinessLines(snapshot: PlatformReadinessSnapshot): string[] {
  const lines: string[] = []
  lines.push(`Generated at ${snapshot.generatedAt} (engine ${snapshot.engineVersion})`)
  for (const provider of snapshot.providers) {
    const version = provider.runtimeVersion ? ` v${provider.runtimeVersion}` : ""
    const models = provider.models.map((model) => model.id).join(", ") || "none"
    lines.push(`Provider ${provider.agentLabel} [${provider.adapterId}]: ${provider.detected ? "detected" : "not-detected"} (${provider.truthClass})${version}; models: ${models}`)
  }
  lines.push(`Workspace: ${snapshot.workspace.status} (initialized=${snapshot.workspace.initialized}, issues=${snapshot.workspace.issueCount})`)
  for (const row of snapshot.hostMatrix) lines.push(`Host ${row.host}: ${row.state} (${row.source})`)
  return lines
}
