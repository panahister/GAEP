/**
 * GAEP-P0-CS02 — pure provider/model workflow logic (INV-01/31), independent of the VS Code API.
 *
 * These functions drive the real protocol-v3 RPC workflows behind the commands. Extracted so the
 * decision logic is unit-testable without a VS Code host. The command handlers supply the RPC
 * transport and the Quick Pick / input primitives.
 */

export interface ProviderCatalogEntryLite {
  adapterId: string
  agentLabel: string
  detected: boolean
  runtimeVersion?: string
  authReadiness: string
  models: Array<{ id: string; truthClass: string; alias: boolean }>
}

export interface QuickPickItemLite {
  label: string
  description?: string
  detail?: string
  value: string
}

/** Build provider Quick Pick items from a real `providerCatalog` response. */
export function providerPickItems(providers: ProviderCatalogEntryLite[]): QuickPickItemLite[] {
  return providers.map((provider) => ({
    label: provider.agentLabel,
    description: provider.detected ? `detected${provider.runtimeVersion ? ` v${provider.runtimeVersion}` : ""}` : "not-detected",
    detail: `auth=${provider.authReadiness}`,
    value: provider.adapterId,
  }))
}

/** Build model Quick Pick items for a selected provider; truth class is shown, never editable. */
export function modelPickItems(entry: ProviderCatalogEntryLite): QuickPickItemLite[] {
  return entry.models.map((model) => ({
    label: model.id,
    description: `${model.truthClass}${model.alias ? " · alias" : ""}`,
    value: model.id,
  }))
}

/** Terminal states for a read-only analysis run. */
export const TERMINAL_STATES = new Set(["completed", "failed", "cancelled", "timed-out"])

export interface AnalysisRunLite {
  analysisRunId: string
  state: string
  result?: { text: string; truncated: boolean }
  failureCategory?: string
  failureSummary?: string
}

export function isTerminal(state: string): boolean {
  return TERMINAL_STATES.has(state)
}

/** Render a terminal run truthfully for display. */
export function renderRunResult(run: AnalysisRunLite): string {
  if (run.state === "completed") {
    return `Analysis completed:\n${run.result?.text ?? ""}${run.result?.truncated ? "\n[output truncated]" : ""}`
  }
  const detail = run.failureSummary ? ` — ${run.failureSummary}` : ""
  return `Analysis ${run.state}${run.failureCategory ? ` (${run.failureCategory})` : ""}${detail}`
}

/** Find the single active (non-terminal) run to cancel. */
export function findActiveRun(runs: AnalysisRunLite[]): AnalysisRunLite | undefined {
  return runs.find((run) => !isTerminal(run.state))
}
