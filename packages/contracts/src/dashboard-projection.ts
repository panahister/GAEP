import { z } from "zod"

import { agentSelectionSchema } from "./agent.js"
import { providerCatalogEntrySchema } from "./provider-catalog.js"
import { analysisRunRecordSchema } from "./read-only-analysis.js"
import { readinessHostSchema, readinessStateSchema } from "./platform-readiness.js"

/**
 * GAEP-P0-CS02 — host-neutral dashboard projection (INV-11).
 *
 * Every field is a projection of an engine-owned value. Hosts render it verbatim and never
 * derive or override a displayed truth.
 */

export const workspaceProjectionStateSchema = z.enum([
  "product-uninitialized",
  "product-ready",
  "product-degraded",
  "product-invalid",
])

export const evidenceProjectionStateSchema = z.enum([
  "evidence-present",
  "evidence-absent",
  "evidence-stale",
  "evidence-invalid",
])

export const hostPackageProjectionSchema = z.object({
  host: readinessHostSchema,
  packageVersion: z.string().trim().min(1).max(32),
  conformanceState: readinessStateSchema,
  evidenceState: evidenceProjectionStateSchema,
  evidenceSource: z.string().trim().max(500).optional(),
  evidenceDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/).optional(),
}).strict()

export const dashboardProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  /** Friendly prerequisite state; `product-uninitialized` is never an error (INV-16). */
  workspaceState: workspaceProjectionStateSchema,
  workspaceMessage: z.string().trim().max(200),
  providers: z.array(providerCatalogEntrySchema).max(64),
  /** Current selection, or null when nothing is selected yet. */
  selection: agentSelectionSchema.nullable(),
  /** Most recent analysis run for this Product root, or null. */
  latestRun: analysisRunRecordSchema.nullable(),
  hostMatrix: z.array(hostPackageProjectionSchema).length(4),
  /** Age of the provider probe backing `providers`, used for the freshness cue. */
  catalogObservedAt: z.string().datetime().nullable(),
  catalogStale: z.boolean(),
}).strict()

export type WorkspaceProjectionState = z.infer<typeof workspaceProjectionStateSchema>
export type EvidenceProjectionState = z.infer<typeof evidenceProjectionStateSchema>
export type HostPackageProjection = z.infer<typeof hostPackageProjectionSchema>
export type DashboardProjection = z.infer<typeof dashboardProjectionSchema>
