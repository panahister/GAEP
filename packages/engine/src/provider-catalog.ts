import {
  providerCatalogSchema,
  type AdapterCapabilities,
  type AgentSelection,
  type AuthReadiness,
  type ProviderCatalog,
  type ProviderCatalogEntry,
  type ProviderModelDescriptor,
  type ProviderTruthClass,
} from "@gaep/contracts"
import { capabilityDigest } from "@gaep/agent-sdk"

/**
 * GAEP-P0-CS02 — provider catalog and server-derived model truth (INV-31).
 *
 * Selection itself remains `GaepEngine.selectAgent()` writing `.gaep/runtime/selection.json`
 * (INV-23); this service never writes a second selection record.
 */

/** Recorded authentication observations, keyed by adapterId, for the current session. */
export type AuthObservation = "auth-ready" | "auth-unavailable"

function mapModelTruth(capabilityTruthClass: string, alias: boolean): ProviderTruthClass {
  if (alias) return "provider-declared"
  return capabilityTruthClass === "observed" ? "observed" : "provider-declared"
}

export function toCatalogEntry(
  capabilities: AdapterCapabilities,
  authObservation?: AuthObservation,
): ProviderCatalogEntry {
  const models: ProviderModelDescriptor[] = capabilities.models.map((model) => ({
    id: model.id,
    label: model.label,
    truthClass: capabilities.detected ? mapModelTruth(model.truthClass, model.alias) : "provider-declared",
    alias: model.alias,
  }))
  // Detection never implies authentication (INV-07). Only an executed attempt may set
  // auth-ready or auth-unavailable.
  const authReadiness: AuthReadiness = !capabilities.detected
    ? "auth-unverified"
    : authObservation ?? "auth-unverified"
  return {
    adapterId: capabilities.adapterId,
    agentId: capabilities.agentId,
    agentLabel: capabilities.agentLabel,
    detected: capabilities.detected,
    ...(capabilities.runtimeVersion ? { runtimeVersion: capabilities.runtimeVersion } : {}),
    authReadiness,
    authTruthClass: authObservation ? "observed" : "provider-declared",
    capabilityDigest: capabilityDigest(capabilities),
    models,
  }
}

export interface ResolvedModelTruth {
  truthClass: ProviderTruthClass
  alias: boolean
}

/**
 * Derive the truth class and alias state for a model **on the server** (INV-31).
 * A caller can never promote a model to `observed`; an unknown but permitted identifier
 * is assigned `configured`.
 */
export function resolveModelTruth(entry: ProviderCatalogEntry, modelId: string): ResolvedModelTruth {
  const known = entry.models.find((model) => model.id === modelId)
  if (known) return { truthClass: known.truthClass, alias: known.alias }
  return { truthClass: "configured", alias: false }
}

export class ProviderCatalogService {
  constructor(
    private readonly probe: () => Promise<AdapterCapabilities[]>,
    private readonly authObservations = new Map<string, AuthObservation>(),
  ) {}

  /** Record the outcome of an executed attempt; this is the only way auth truth changes. */
  recordAuthObservation(adapterId: string, observation: AuthObservation): void {
    this.authObservations.set(adapterId, observation)
  }

  async catalog(now = new Date().toISOString()): Promise<ProviderCatalog> {
    const capabilities = await this.probe()
    return providerCatalogSchema.parse({
      schemaVersion: 1,
      observedAt: now,
      providers: capabilities.map((entry) => toCatalogEntry(entry, this.authObservations.get(entry.adapterId))),
    })
  }

  async entry(adapterId: string): Promise<ProviderCatalogEntry | undefined> {
    const catalog = await this.catalog()
    return catalog.providers.find((provider) => provider.adapterId === adapterId)
  }

  /**
   * Select a provider/model with **server-derived** truth (INV-31) and delegate the actual
   * selection write to `GaepEngine.selectAgent()` via `selectAgent`, keeping one selection source
   * of truth at `.gaep/runtime/selection.json` (INV-23). The caller never supplies a truthClass.
   */
  async selectProviderModel(
    args: { adapterId: string; modelId: string; settings: Record<string, unknown>; actorId: string },
    selectAgent: (adapterId: string, modelId: string, settings: Record<string, unknown>, actorId: string) => Promise<AgentSelection>,
  ): Promise<{ selection: AgentSelection; resolvedTruthClass: ProviderTruthClass; alias: boolean }> {
    const entry = await this.entry(args.adapterId)
    if (!entry) throw new Error("MODEL_NOT_PERMITTED: no catalog entry for the requested adapter")
    const resolved = resolveModelTruth(entry, args.modelId)
    const selection = await selectAgent(args.adapterId, args.modelId, args.settings, args.actorId)
    return { selection, resolvedTruthClass: resolved.truthClass, alias: resolved.alias }
  }
}
