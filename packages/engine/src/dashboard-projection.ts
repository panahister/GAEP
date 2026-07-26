import {
  dashboardProjectionSchema,
  type AgentSelection,
  type AnalysisRunRecord,
  type DashboardProjection,
  type HostPackageProjection,
  type ProviderCatalog,
  type WorkspaceProjectionState,
} from "@gaep/contracts"

/**
 * GAEP-P0-CS02 — host-neutral dashboard projection (INV-11).
 *
 * Every field is derived from an engine-owned value. Hosts render this verbatim; they never
 * compute or override a displayed truth.
 */

/** Freshness bound for the provider catalog before it is shown as stale. */
export const CATALOG_STALE_AFTER_MS = 5 * 60 * 1000

const WORKSPACE_MESSAGES: Record<WorkspaceProjectionState, string> = {
  "product-uninitialized": "Initialize Product first to enable Product actions. Platform Readiness is available now.",
  "product-ready": "Product workspace is initialized and healthy.",
  "product-degraded": "Product workspace is initialized with recorded issues.",
  "product-invalid": "Product workspace state is invalid. Inspect diagnostics before continuing.",
}

export interface DashboardProjectionInput {
  workspaceState: WorkspaceProjectionState
  catalog: ProviderCatalog | null
  selection: AgentSelection | null
  latestRun: AnalysisRunRecord | null
  hostMatrix: HostPackageProjection[]
  now?: string
}

export function buildDashboardProjection(input: DashboardProjectionInput): DashboardProjection {
  const generatedAt = input.now ?? new Date().toISOString()
  const catalogObservedAt = input.catalog?.observedAt ?? null
  const catalogStale = catalogObservedAt === null
    ? false
    : Date.parse(generatedAt) - Date.parse(catalogObservedAt) > CATALOG_STALE_AFTER_MS

  return dashboardProjectionSchema.parse({
    schemaVersion: 1,
    generatedAt,
    workspaceState: input.workspaceState,
    workspaceMessage: WORKSPACE_MESSAGES[input.workspaceState],
    providers: input.catalog?.providers ?? [],
    selection: input.selection,
    latestRun: input.latestRun,
    hostMatrix: input.hostMatrix,
    catalogObservedAt,
    catalogStale,
  })
}

/** Base Four-IDE host rows before any executed conformance observation is merged. */
export function defaultHostMatrix(packageVersion: string): HostPackageProjection[] {
  return [
    { host: "vscode", packageVersion, conformanceState: "not-run", evidenceState: "evidence-absent" },
    { host: "visual-studio", packageVersion, conformanceState: "pending-environment", evidenceState: "evidence-absent" },
    { host: "rider", packageVersion, conformanceState: "pending-environment", evidenceState: "evidence-absent" },
    { host: "kiro", packageVersion, conformanceState: "pending-environment", evidenceState: "evidence-absent" },
  ]
}
