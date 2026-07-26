import { z } from "zod"

import { providerTruthClassSchema } from "./provider-catalog.js"
import { sourceIdentitySchema } from "./source-identity.js"

/**
 * GAEP-P0-CS02 — bounded, read-only provider analysis.
 *
 * Analysis only: no preview/apply, no effectful tool authority, no Product source mutation
 * (INV-03/04/05). All persisted failure text is drawn from a fixed allowlist (INV-17).
 */

export const analysisRunStateSchema = z.enum([
  "running",
  "completed",
  "failed",
  "cancelled",
  "timed-out",
  "not-run",
])

export const analysisTerminalStateSchema = z.enum(["completed", "failed", "cancelled", "timed-out"])

export const analysisFailureCategorySchema = z.enum([
  "provider-unavailable",
  "auth-unavailable",
  "provider-error",
  "timeout",
  "cancelled",
  "source-mutation",
  "protocol-error",
  "internal",
])

export const analysisTerminationCauseSchema = z.enum([
  "normal",
  "cancel-request",
  "timeout",
  "provider-failure",
  "process-loss",
])

/** Fixed, allowlisted one-line failure summaries. Raw provider/error text is never persisted. */
export const ANALYSIS_FAILURE_SUMMARIES: Record<z.infer<typeof analysisFailureCategorySchema>, string> = {
  "provider-unavailable": "The selected provider executable was not available.",
  "auth-unavailable": "The provider reported an authentication failure.",
  "provider-error": "The provider exited with an error.",
  "timeout": "The analysis exceeded its configured time bound.",
  "cancelled": "The analysis was cancelled by the user.",
  "source-mutation": "Product source files changed during a read-only analysis.",
  "protocol-error": "The provider produced output that could not be interpreted.",
  "internal": "The analysis could not be completed by the GAEP engine.",
}

/** Scope, authority, and bounds recorded before the provider process starts. */
export const analysisRunEnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  scope: z.literal("read-only-analysis"),
  authority: z.literal("user-initiated"),
  adapterId: z.string().trim().min(1).max(200),
  modelId: z.string().trim().min(1).max(500),
  modelTruthClass: providerTruthClassSchema,
  modelAlias: z.boolean(),
  capabilityDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  contextPackIds: z.array(z.string().uuid()).min(1).max(20),
  contextPackDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  contextBytes: z.number().int().nonnegative().max(262_144),
  sourceIdentity: sourceIdentitySchema,
  objectiveDigest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  timeoutMs: z.number().int().min(1_000).max(600_000),
  idempotencyKey: z.string().uuid(),
  startedAt: z.string().datetime(),
}).strict()

export const analysisRunResultSchema = z.object({
  /** Sanitized provider output: ≤ 8 KiB, control characters stripped, paths redacted. */
  text: z.string().max(8_192),
  truncated: z.boolean(),
}).strict()

export const analysisRunRecordSchema = z.object({
  schemaVersion: z.literal(1),
  analysisRunId: z.string().uuid(),
  state: analysisRunStateSchema,
  envelope: analysisRunEnvelopeSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  terminationCause: analysisTerminationCauseSchema.optional(),
  failureCategory: analysisFailureCategorySchema.optional(),
  failureSummary: z.string().trim().max(200).optional(),
  result: analysisRunResultSchema.optional(),
  /** Truthful provider capability difference, e.g. Codex read-breadth beyond the Context Pack. */
  knownLimitation: z.string().trim().max(300).optional(),
}).strict().superRefine((record, ctx) => {
  const terminal = analysisTerminalStateSchema.safeParse(record.state).success
  if (terminal && !record.endedAt) {
    ctx.addIssue({ code: "custom", message: "a terminal run must record endedAt" })
  }
  if (record.state === "completed" && !record.result) {
    ctx.addIssue({ code: "custom", message: "a completed run must record a result" })
  }
  if ((record.state === "failed" || record.state === "timed-out") && !record.failureCategory) {
    ctx.addIssue({ code: "custom", message: "a failed or timed-out run must record a failure category" })
  }
  if (record.failureSummary && record.failureCategory
      && ANALYSIS_FAILURE_SUMMARIES[record.failureCategory] !== record.failureSummary) {
    ctx.addIssue({ code: "custom", message: "failureSummary must be the allowlisted summary for its category" })
  }
})

export type AnalysisRunState = z.infer<typeof analysisRunStateSchema>
export type AnalysisFailureCategory = z.infer<typeof analysisFailureCategorySchema>
export type AnalysisRunEnvelope = z.infer<typeof analysisRunEnvelopeSchema>
export type AnalysisRunResult = z.infer<typeof analysisRunResultSchema>
export type AnalysisRunRecord = z.infer<typeof analysisRunRecordSchema>

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g
const ABSOLUTE_PATH_SHAPES = /(?:[A-Za-z]:\\[^\s"']*|(?:\/[A-Za-z0-9._-]+){2,}\/?|~\/[^\s"']*)/g

/** Sanitize provider output before it is persisted or displayed (INV-17). */
export function sanitizeProviderText(raw: string, maxBytes = 8_192): AnalysisRunResult {
  const stripped = raw.replace(CONTROL_CHARACTERS, "").replace(ABSOLUTE_PATH_SHAPES, "[redacted-path]")
  const buffer = Buffer.from(stripped, "utf8")
  if (buffer.byteLength <= maxBytes) return { text: stripped, truncated: false }
  let end = maxBytes
  while (end > 0 && (buffer[end]! & 0b1100_0000) === 0b1000_0000) end -= 1
  return { text: buffer.subarray(0, end).toString("utf8"), truncated: true }
}
