import { z } from "zod"

/**
 * GAEP-P0-CS01 — Platform Readiness contract.
 *
 * Three separate, host-neutral shapes:
 *   - `platformReadinessSnapshotSchema`  — the Base Snapshot produced by the engine
 *     (provider + workspace readiness + a Four-IDE Host Matrix defaulted to
 *     `not-run`/`pending-environment`). The engine makes no host-conformance claim.
 *   - `hostConformanceObservationSchema` — a record emitted ONLY by an executed host check.
 *   - `platformReadinessReportSchema`    — the Final Report after an explicit merge
 *     (`composePlatformReadinessReport` in `@gaep/conformance`), plus separate
 *     engine-host RPC boundary results that are NOT IDE host rows.
 */

/** The Four-IDE Host Matrix contains exactly these hosts and nothing else. */
export const readinessHostSchema = z.enum(["vscode", "visual-studio", "rider", "kiro"])

export const readinessStateSchema = z.enum(["passed", "failed", "not-run", "pending-environment"])

/** State an executed check may report (never `not-run`/`pending-environment`). */
export const executedReadinessStateSchema = z.enum(["passed", "failed"])

export const readinessTruthClassSchema = z.enum([
  "observed",
  "provider-declared",
  "configured",
  "not-observed",
])

export const evidenceDigestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)

export const providerReadinessSchema = z.object({
  adapterId: z.string().trim().min(1).max(200),
  agentId: z.string().trim().min(1).max(200),
  agentLabel: z.string().trim().min(1).max(200),
  detected: z.boolean(),
  runtimeVersion: z.string().trim().max(200).optional(),
  executionInterface: z.string().trim().min(1).max(64),
  supportsModelDiscovery: z.boolean(),
  models: z.array(z.object({
    id: z.string().trim().min(1).max(200),
    label: z.string().trim().min(1).max(200),
    alias: z.boolean(),
  }).strict()).max(512),
  truthClass: readinessTruthClassSchema,
  observedAt: z.string().datetime(),
}).strict()

export const workspaceReadinessSchema = z.object({
  status: z.enum(["uninitialized", "healthy", "degraded", "invalid"]),
  initialized: z.boolean(),
  productId: z.string().uuid().optional(),
  auditValid: z.boolean(),
  lockPresent: z.boolean(),
  issueCount: z.number().int().nonnegative(),
  truthClass: readinessTruthClassSchema,
  observedAt: z.string().datetime(),
}).strict()

/** The exact set of IDE hosts the Four-IDE matrix must contain, one row each. */
export const FOUR_IDE_HOSTS = ["vscode", "visual-studio", "rider", "kiro"] as const

/** Approved canonical Base-Snapshot default state per host (the only states a base row may carry). */
export const CANONICAL_BASE_DEFAULT: Record<ReadinessHost, ReadinessState> = {
  "vscode": "not-run",
  "visual-studio": "pending-environment",
  "rider": "pending-environment",
  "kiro": "pending-environment",
}

function refineFourIdeMatrix(rows: ReadonlyArray<{ host: ReadinessHost }>, ctx: z.RefinementCtx): void {
  const hosts = rows.map((row) => row.host)
  const unique = new Set(hosts)
  if (rows.length !== 4 || unique.size !== 4 || !FOUR_IDE_HOSTS.every((host) => unique.has(host))) {
    ctx.addIssue({ code: "custom", message: "hostMatrix must contain exactly one row per IDE: vscode, visual-studio, rider, kiro" })
  }
}

function refineBaseDefaultRow(row: { host: ReadinessHost; state: ReadinessState }, ctx: z.RefinementCtx): void {
  if (CANONICAL_BASE_DEFAULT[row.host] !== row.state) {
    ctx.addIssue({ code: "custom", message: `base-default state for ${row.host} must be ${CANONICAL_BASE_DEFAULT[row.host]}` })
  }
}

/** Plain object form retained for the discriminated union (zod requires ZodObject variants). */
const hostMatrixDefaultRowObject = z.object({
  host: readinessHostSchema,
  state: readinessStateSchema,
  source: z.literal("base-default"),
}).strict()

/** A Base Snapshot host row: an engine default, carrying no observation. */
export const hostMatrixDefaultRowSchema = hostMatrixDefaultRowObject.superRefine(refineBaseDefaultRow)

export const platformReadinessSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  engineVersion: z.string().trim().min(1).max(64),
  providers: z.array(providerReadinessSchema).max(64),
  workspace: workspaceReadinessSchema,
  hostMatrix: z.array(hostMatrixDefaultRowSchema).superRefine((rows, ctx) => {
    refineFourIdeMatrix(rows, ctx)
    for (const row of rows) {
      if (CANONICAL_BASE_DEFAULT[row.host] !== row.state) {
        ctx.addIssue({ code: "custom", message: `base-default state for ${row.host} must be ${CANONICAL_BASE_DEFAULT[row.host]}` })
      }
    }
  }),
}).strict()

/** Emitted only when a host check actually executes. */
export const hostConformanceObservationSchema = z.object({
  host: readinessHostSchema,
  checkId: z.string().trim().min(1).max(200),
  state: executedReadinessStateSchema,
  truthClass: z.literal("observed"),
  observedAt: z.string().datetime(),
  evidenceSource: z.string().trim().min(1).max(500),
  executionResult: z.literal("executed"),
  evidenceDigest: evidenceDigestSchema,
}).strict()

/** A contract/boundary result (e.g. the engine-host RPC surface). NOT an IDE host row. */
export const boundaryCheckResultSchema = z.object({
  checkId: z.string().trim().min(1).max(200),
  target: z.string().trim().min(1).max(200),
  state: readinessStateSchema,
  truthClass: readinessTruthClassSchema,
  observedAt: z.string().datetime(),
  evidenceSource: z.string().trim().min(1).max(500),
  detail: z.string().trim().max(2_000).optional(),
}).strict()

const hostMatrixObservationRowObject = z.object({
  host: readinessHostSchema,
  state: executedReadinessStateSchema,
  source: z.literal("observation"),
  observation: hostConformanceObservationSchema,
}).strict()

/** A Final Report host row: either the untouched Base default or an executed observation. */
export const hostMatrixReportRowSchema = z.discriminatedUnion("source", [
  hostMatrixDefaultRowObject,
  hostMatrixObservationRowObject,
]).superRefine((row, ctx) => {
  if (row.source === "base-default") {
    refineBaseDefaultRow(row, ctx)
    return
  }
  if (row.host !== row.observation.host) {
    ctx.addIssue({ code: "custom", message: "observation row host must match observation.host" })
  }
  if (row.state !== row.observation.state) {
    ctx.addIssue({ code: "custom", message: "observation row state must match observation.state" })
  }
})

export const platformReadinessReportSchema = z.object({
  schemaVersion: z.literal(1),
  changeSetId: z.string().trim().min(1).max(64).optional(),
  generatedAt: z.string().datetime(),
  engineVersion: z.string().trim().min(1).max(64),
  providers: z.array(providerReadinessSchema).max(64),
  workspace: workspaceReadinessSchema,
  hostMatrix: z.array(hostMatrixReportRowSchema).superRefine((rows, ctx) => {
    refineFourIdeMatrix(rows, ctx)
    for (const row of rows) {
      if (row.source === "base-default") {
        if (CANONICAL_BASE_DEFAULT[row.host] !== row.state) {
          ctx.addIssue({ code: "custom", message: `base-default state for ${row.host} must be ${CANONICAL_BASE_DEFAULT[row.host]}` })
        }
      } else if (row.host !== row.observation.host || row.state !== row.observation.state) {
        ctx.addIssue({ code: "custom", message: `observation row for ${row.host} must match its observation host and state` })
      }
    }
  }),
  boundaryChecks: z.array(boundaryCheckResultSchema).max(64),
}).strict()

// --- GAEP-P0-CS01-C1: durable VS Code evidence bundle (envelope + observation-result + manifest) ---

const evidenceCommonFields = {
  schemaVersion: z.literal(1),
  parentChangeSetId: z.literal("GAEP-P0-CS01"),
  correctionSetId: z.literal("GAEP-P0-CS01-C1"),
  checkId: z.string().trim().min(1).max(200),
  observedAt: z.string().datetime(),
  subjectDigest: evidenceDigestSchema,
}

/** Current-attempt evidence envelope, discriminated on `testOutcome`. */
export const readinessEvidenceEnvelopeSchema = z.discriminatedUnion("testOutcome", [
  z.object({
    ...evidenceCommonFields,
    executionResult: z.literal("executed"),
    testOutcome: z.literal("passed"),
    snapshot: platformReadinessSnapshotSchema,
  }).strict(),
  z.object({
    ...evidenceCommonFields,
    executionResult: z.literal("executed"),
    testOutcome: z.literal("failed"),
    failureCategory: z.enum(["assertion", "phase", "computation"]),
    failureSummary: z.string().trim().min(1).max(500),
    snapshot: platformReadinessSnapshotSchema.optional(),
  }).strict(),
  z.object({
    ...evidenceCommonFields,
    executionResult: z.literal("not-executed"),
    testOutcome: z.literal("not-run"),
    unavailabilityReason: z.string().trim().min(1).max(500),
    snapshot: platformReadinessSnapshotSchema.optional(),
  }).strict(),
])

/** Governed observation-result artifact: an executed observation, or an explicit null (not-executed). */
export const observationResultSchema = z.union([
  z.object({ observation: hostConformanceObservationSchema }).strict(),
  z.object({ observation: z.null() }).strict(),
])

export const evidenceArtifactPathSchema = z.enum(["readiness-evidence.json", "observation.json"])

export const evidenceManifestArtifactSchema = z.object({
  path: evidenceArtifactPathSchema,
  digest: evidenceDigestSchema,
}).strict()

export const evidenceManifestSchema = z.object({
  schemaVersion: z.literal(1),
  parentChangeSetId: z.literal("GAEP-P0-CS01"),
  correctionSetId: z.literal("GAEP-P0-CS01-C1"),
  host: readinessHostSchema,
  checkId: z.string().trim().min(1).max(200),
  subjectDigest: evidenceDigestSchema,
  artifacts: z.array(evidenceManifestArtifactSchema),
}).strict().superRefine((manifest, ctx) => {
  const paths = manifest.artifacts.map((artifact) => artifact.path)
  const unique = new Set(paths)
  if (paths.length !== 2 || unique.size !== 2 || !unique.has("readiness-evidence.json") || !unique.has("observation.json")) {
    ctx.addIssue({ code: "custom", message: "manifest must contain exactly one entry each for readiness-evidence.json and observation.json" })
  }
})

export type ReadinessHost = z.infer<typeof readinessHostSchema>
export type ReadinessState = z.infer<typeof readinessStateSchema>
export type ProviderReadiness = z.infer<typeof providerReadinessSchema>
export type WorkspaceReadiness = z.infer<typeof workspaceReadinessSchema>
export type PlatformReadinessSnapshot = z.infer<typeof platformReadinessSnapshotSchema>
export type HostConformanceObservation = z.infer<typeof hostConformanceObservationSchema>
export type BoundaryCheckResult = z.infer<typeof boundaryCheckResultSchema>
export type HostMatrixReportRow = z.infer<typeof hostMatrixReportRowSchema>
export type PlatformReadinessReport = z.infer<typeof platformReadinessReportSchema>
export type ReadinessEvidenceEnvelope = z.infer<typeof readinessEvidenceEnvelopeSchema>
export type ObservationResult = z.infer<typeof observationResultSchema>
export type EvidenceManifestArtifact = z.infer<typeof evidenceManifestArtifactSchema>
export type EvidenceManifest = z.infer<typeof evidenceManifestSchema>
