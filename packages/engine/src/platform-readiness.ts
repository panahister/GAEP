import {
  platformReadinessSnapshotSchema,
  type AdapterCapabilities,
  type PlatformReadinessSnapshot,
  type ProviderReadiness,
  type ReadinessHost,
  type ReadinessState,
  type WorkspaceReadiness,
} from "@gaep/contracts"

const ENGINE_VERSION = "0.1.0"

/**
 * Static default posture for the Four-IDE Host Matrix. The engine makes no host-conformance
 * claim: VS Code is runnable in-process (`not-run` until an executed check reports otherwise);
 * Visual Studio, Rider, and Kiro require environments GAEP cannot execute, so they default to
 * `pending-environment`. These defaults are only ever replaced by an executed observation at
 * merge time (`composePlatformReadinessReport` in `@gaep/conformance`).
 */
const HOST_MATRIX_DEFAULTS: ReadonlyArray<{ host: ReadinessHost; state: ReadinessState }> = [
  { host: "vscode", state: "not-run" },
  { host: "visual-studio", state: "pending-environment" },
  { host: "rider", state: "pending-environment" },
  { host: "kiro", state: "pending-environment" },
]

/** Minimal shape of the engine's workspace-health result consumed here. */
export interface WorkspaceHealthLike {
  status: "uninitialized" | "healthy" | "degraded" | "invalid"
  initialized: boolean
  productId?: string
  audit: { valid: boolean }
  lock: { present: boolean }
  issues: ReadonlyArray<unknown>
}

export function buildProviderReadiness(capabilities: AdapterCapabilities): ProviderReadiness {
  return {
    adapterId: capabilities.adapterId,
    agentId: capabilities.agentId,
    agentLabel: capabilities.agentLabel,
    detected: capabilities.detected,
    ...(capabilities.runtimeVersion ? { runtimeVersion: capabilities.runtimeVersion } : {}),
    executionInterface: capabilities.executionInterface,
    supportsModelDiscovery: capabilities.supportsModelDiscovery,
    models: capabilities.models.map((model) => ({ id: model.id, label: model.label, alias: model.alias })),
    truthClass: capabilities.detected ? "observed" : "not-observed",
    observedAt: capabilities.observedAt,
  }
}

export function buildWorkspaceReadiness(health: WorkspaceHealthLike, observedAt: string): WorkspaceReadiness {
  return {
    status: health.status,
    initialized: health.initialized,
    ...(health.productId ? { productId: health.productId } : {}),
    auditValid: health.audit.valid,
    lockPresent: health.lock.present,
    issueCount: health.issues.length,
    truthClass: "observed",
    observedAt,
  }
}

/**
 * Build the **Base** Platform Readiness Snapshot from provider probes and workspace health only.
 * This function accepts no host-conformance input and never asserts a host's install/conformance
 * state — every Four-IDE Host Matrix row is emitted at its default.
 */
export function computePlatformReadinessSnapshot(input: {
  providers: ReadonlyArray<AdapterCapabilities>
  workspace: WorkspaceHealthLike
  now?: string
}): PlatformReadinessSnapshot {
  const generatedAt = input.now ?? new Date().toISOString()
  return platformReadinessSnapshotSchema.parse({
    schemaVersion: 1,
    generatedAt,
    engineVersion: ENGINE_VERSION,
    providers: input.providers.map((capabilities) => buildProviderReadiness(capabilities)),
    workspace: buildWorkspaceReadiness(input.workspace, generatedAt),
    hostMatrix: HOST_MATRIX_DEFAULTS.map((row) => ({ ...row, source: "base-default" as const })),
  })
}
