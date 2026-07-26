import { z } from "zod"

/**
 * GAEP-P0-CS02 — provider catalog and authentication truth.
 *
 * This module defines only the *catalog* and *auth truth* shapes. The current provider/model
 * selection remains `agentSelectionSchema` persisted at `.gaep/runtime/selection.json`
 * (INV-23); no second selection record is defined here.
 *
 * INV-31: `truthClass` and alias state are server-derived from the live catalog. They are never
 * accepted from a caller.
 */

/** How a model identifier became known. */
export const providerTruthClassSchema = z.enum([
  /** Obtained from an executed provider catalog/probe. */
  "observed",
  /** Declared by the provider (e.g. a documented alias) but not observed from a catalog. */
  "provider-declared",
  /** Supplied by the user as a custom identifier; permitted but never observed. */
  "configured",
])

/**
 * Authentication readiness. Detection never implies authentication (INV-07), and
 * `auth-unverified` never blocks an explicit user-initiated read-only attempt — the attempt
 * itself resolves the state.
 */
export const authReadinessSchema = z.enum([
  /** Verified by an executed attempt; observed for that attempt only. */
  "auth-ready",
  /** Neutral: not yet verified. An explicit attempt is permitted from this state. */
  "auth-unverified",
  /** A classified authentication failure was observed. */
  "auth-unavailable",
])

export const providerModelDescriptorSchema = z.object({
  id: z.string().trim().min(1).max(500),
  label: z.string().trim().min(1).max(200),
  truthClass: providerTruthClassSchema,
  alias: z.boolean(),
}).strict()

export const providerCatalogEntrySchema = z.object({
  adapterId: z.string().trim().min(1).max(200),
  agentId: z.string().trim().min(1).max(200),
  agentLabel: z.string().trim().min(1).max(200),
  detected: z.boolean(),
  runtimeVersion: z.string().trim().max(200).optional(),
  authReadiness: authReadinessSchema,
  authTruthClass: providerTruthClassSchema,
  capabilityDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  models: z.array(providerModelDescriptorSchema).max(512),
}).strict().superRefine((entry, ctx) => {
  // An undetected provider can never be authenticated and can never carry observed models.
  if (!entry.detected && entry.authReadiness === "auth-ready") {
    ctx.addIssue({ code: "custom", message: "an undetected provider cannot be auth-ready" })
  }
  if (!entry.detected && entry.models.some((model) => model.truthClass === "observed")) {
    ctx.addIssue({ code: "custom", message: "an undetected provider cannot expose observed models" })
  }
  // An alias is provider-declared or configured, never observed.
  for (const model of entry.models) {
    if (model.alias && model.truthClass === "observed") {
      ctx.addIssue({ code: "custom", message: `alias model ${model.id} must not be observed` })
    }
  }
})

export const providerCatalogSchema = z.object({
  schemaVersion: z.literal(1),
  observedAt: z.string().datetime(),
  providers: z.array(providerCatalogEntrySchema).max(64),
}).strict()

export type ProviderTruthClass = z.infer<typeof providerTruthClassSchema>
export type AuthReadiness = z.infer<typeof authReadinessSchema>
export type ProviderModelDescriptor = z.infer<typeof providerModelDescriptorSchema>
export type ProviderCatalogEntry = z.infer<typeof providerCatalogEntrySchema>
export type ProviderCatalog = z.infer<typeof providerCatalogSchema>
