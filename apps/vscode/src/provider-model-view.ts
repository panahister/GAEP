import type { DashboardProjection } from "@gaep/contracts"

/**
 * GAEP-P0-CS02 — pure rendering of the Agent/Model dashboard projection (INV-11/16).
 *
 * Rendering derives no truth of its own; it only formats the engine-owned projection. Extracted
 * from the command handler so it is unit-testable without a VS Code host.
 */
export function formatDashboardLines(projection: DashboardProjection): string[] {
  const lines: string[] = []
  lines.push(`Workspace: ${projection.workspaceState} — ${projection.workspaceMessage}`)

  if (projection.providers.length === 0) {
    lines.push("Providers: none detected")
  }
  for (const provider of projection.providers) {
    const version = provider.runtimeVersion ? ` v${provider.runtimeVersion}` : ""
    lines.push(`Provider ${provider.agentLabel} [${provider.adapterId}]: ${provider.detected ? "detected" : "not-detected"}${version}; auth=${provider.authReadiness} (${provider.authTruthClass})`)
    const models = provider.models.map((model) => `${model.id} [${model.truthClass}${model.alias ? ", alias" : ""}]`).join(", ") || "none"
    lines.push(`  models: ${models}`)
  }

  if (projection.selection) {
    lines.push(`Selection: ${projection.selection.adapterId} / ${projection.selection.modelId}`)
  } else {
    lines.push("Selection: none")
  }

  const freshness = projection.catalogObservedAt
    ? `${projection.catalogObservedAt}${projection.catalogStale ? " (stale)" : ""}`
    : "no probe yet"
  lines.push(`Catalog freshness: ${freshness}`)

  if (projection.latestRun) {
    const run = projection.latestRun
    const detail = run.state === "completed"
      ? `result ${run.result?.truncated ? "(truncated)" : "present"}`
      : run.failureCategory
        ? `${run.failureCategory}: ${run.failureSummary ?? ""}`
        : ""
    lines.push(`Last analysis: ${run.state}${detail ? ` — ${detail}` : ""}`)
  } else {
    lines.push("Last analysis: none")
  }

  for (const row of projection.hostMatrix) {
    const evidence = row.evidenceSource ? ` evidence=${row.evidenceSource}` : ""
    lines.push(`Host ${row.host} @${row.packageVersion}: ${row.conformanceState} (${row.evidenceState})${evidence}`)
  }
  return lines
}
