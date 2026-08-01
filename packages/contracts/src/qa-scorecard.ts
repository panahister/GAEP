import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const commitSchema = z.string().regex(/^[0-9a-f]{7,40}$/)
const identifierSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,127}$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const relativePathSchema = z.string().trim().min(1).max(4_096).superRefine((value, context) => {
  if (value.startsWith("/") || value.startsWith("\\") || /^[A-Za-z]:/u.test(value) || value.includes("\\") ||
      value.split("/").some((segment) => ["", ".", ".."].includes(segment))) {
    context.addIssue({ code: "custom", message: "QA scorecard evidence must use normalized repository-relative paths" })
  }
})
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()
function unique(values: readonly string[]): boolean { return new Set(values).size === values.length }
function canonical(values: readonly string[]): boolean { const ordered = [...values].sort((a, b) => a.localeCompare(b)); return values.every((value, index) => value === ordered[index]) }
function canonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 512) { return z.array(schema).max(maximum).refine((values) => unique(values.map(String)), "Values must be unique").refine((values) => canonical(values.map(String)), "Values must use canonical lexical ordering") }
function rejectSecrets<T extends z.ZodType>(schema: T): T { return schema.refine((value) => !containsSecretShapedValue(value), { message: "Portable QA scorecards cannot contain secret-shaped values" }) as unknown as T }

export const qaScorecardDimensionIds = [
  "functional",
  "unit-integration",
  "e2e",
  "security",
  "accessibility",
  "visual-fixture",
  "performance",
  "reliability",
  "trace-coverage",
  "unresolved-gaps",
] as const
export const qaScorecardDimensionIdSchema = z.enum(qaScorecardDimensionIds)
export const qaScorecardEvidenceKindSchema = z.enum([
  "local-functional-gate",
  "local-unit-integration-gate",
  "local-e2e-receipt",
  "local-security-report",
  "local-accessibility-report",
  "local-visual-fixture-report",
  "local-performance-report",
  "local-reliability-report",
  "trace-coverage-candidate",
  "gap-register",
])
export const qaScorecardStateSchema = z.enum(["success", "failure", "missing", "stale", "not-assessed"])

export const qaScorecardEvidenceSchema = z.object({
  id: z.string().uuid(),
  dimensionId: qaScorecardDimensionIdSchema,
  kind: qaScorecardEvidenceKindSchema,
  artifactId: identifierSchema,
  artifactPath: relativePathSchema,
  artifactDigest: digestSchema,
  sourceCheckpoint: commitSchema,
  observedAt: z.string().datetime(),
  outcome: z.enum(["success", "failure", "not-assessed"]),
  freshness: z.enum(["current", "stale"]),
  testCount: z.number().int().nonnegative().max(10_000_000),
  skippedCount: z.number().int().nonnegative().max(10_000_000),
  limitationCount: z.number().int().nonnegative().max(65_536),
  localExecutionOnly: z.literal(true),
  acceptanceState: z.literal("not-established"),
}).strict()

export const qaScorecardDimensionSchema = z.object({
  id: qaScorecardDimensionIdSchema,
  ordinal: z.number().int().positive().max(qaScorecardDimensionIds.length),
  state: qaScorecardStateSchema,
  evidence: z.array(qaScorecardEvidenceSchema).max(64),
  gapKeys: canonicalList(identifierSchema, 4_096),
  reasons: z.array(shortTextSchema).max(256),
  localAutomationState: z.enum(["passed", "failed", "not-run", "not-applicable"]),
  humanValidationState: z.literal("not-established"),
  productOwnerAcceptanceState: z.literal("not-established"),
}).strict().superRefine((dimension, context) => {
  if (dimension.evidence.some((evidence) => evidence.dimensionId !== dimension.id)) {
    context.addIssue({ code: "custom", path: ["evidence"], message: "Evidence dimension bindings must match the containing dimension" })
  }
  if (!unique(dimension.evidence.map((evidence) => evidence.id)) || !unique(dimension.evidence.map((evidence) => evidence.artifactPath))) {
    context.addIssue({ code: "custom", path: ["evidence"], message: "Evidence identities and artifact paths must be unique within a dimension" })
  }
  const hasFailure = dimension.evidence.some((evidence) => evidence.outcome === "failure")
  const hasStale = dimension.evidence.some((evidence) => evidence.freshness === "stale")
  const allSuccess = dimension.evidence.length > 0 && dimension.evidence.every((evidence) => evidence.outcome === "success" && evidence.freshness === "current")
  const allNotAssessed = dimension.evidence.length > 0 && dimension.evidence.every((evidence) => evidence.outcome === "not-assessed" && evidence.freshness === "current")
  if (dimension.state === "missing" && (dimension.evidence.length !== 0 || dimension.localAutomationState !== "not-run")) {
    context.addIssue({ code: "custom", path: ["state"], message: "Missing dimensions cannot contain evidence or claim automation execution" })
  }
  if (dimension.state === "failure" && (!hasFailure || dimension.localAutomationState !== "failed")) {
    context.addIssue({ code: "custom", path: ["state"], message: "Failed dimensions require current attributable failure evidence" })
  }
  if (dimension.state === "stale" && (!hasStale || dimension.localAutomationState === "passed")) {
    context.addIssue({ code: "custom", path: ["state"], message: "Stale dimensions require stale evidence and cannot claim a passing current gate" })
  }
  if (dimension.state === "not-assessed" && (!allNotAssessed || dimension.localAutomationState !== "not-run")) {
    context.addIssue({ code: "custom", path: ["state"], message: "Not-assessed dimensions require explicit current not-assessed evidence" })
  }
  if (dimension.state === "success" && (!allSuccess || dimension.localAutomationState !== "passed" || dimension.gapKeys.length > 0)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Successful dimensions require only current passing evidence, a passed local gate, and no dimension gaps" })
  }
})

const inputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  dimensions: z.array(qaScorecardDimensionSchema).length(qaScorecardDimensionIds.length),
  unresolvedGapKeys: canonicalList(identifierSchema, 4_096),
  limitations: z.array(shortTextSchema).min(1).max(256),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  assessedBy: humanActorSchema,
  assessedAt: z.string().datetime(),
  productTruthState: z.literal("not-established"),
  nativeHumanAcceptanceState: z.literal("not-established"),
  securityApprovalState: z.literal("not-established"),
  productOwnerAcceptanceState: z.literal("not-established"),
  releaseReadinessState: z.literal("not-established"),
  deploymentReadinessState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((scorecard, context) => {
  if (!unique(scorecard.dimensions.map((dimension) => dimension.id))) {
    context.addIssue({ code: "custom", path: ["dimensions"], message: "Every QA scorecard dimension must appear exactly once" })
  }
  scorecard.dimensions.forEach((dimension, index) => {
    if (dimension.id !== qaScorecardDimensionIds[index] || dimension.ordinal !== index + 1) {
      context.addIssue({ code: "custom", path: ["dimensions", index], message: "QA scorecard dimensions must use the canonical complete order" })
    }
  })
  const dimensionGapKeys = [...new Set(scorecard.dimensions.flatMap((dimension) => dimension.gapKeys))].sort((a, b) => a.localeCompare(b))
  if (dimensionGapKeys.length !== scorecard.unresolvedGapKeys.length || dimensionGapKeys.some((value, index) => value !== scorecard.unresolvedGapKeys[index])) {
    context.addIssue({ code: "custom", path: ["unresolvedGapKeys"], message: "Unresolved gap keys must reconcile exactly with dimension gaps" })
  }
  if (scorecard.reviewState === "ready-for-human-review" && scorecard.dimensions.some((dimension) => ["missing", "stale"].includes(dimension.state))) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Human-review-ready scorecards cannot omit evidence or contain stale evidence" })
  }
})

export const qaScorecardInputSchema = rejectSecrets(inputBaseSchema)
const authorityBoundary = "qa-scorecard-is-a-versioned-local-evidence-candidate-and-does-not-establish-product-truth-human-validation-security-approval-product-owner-acceptance-release-readiness-deployment-readiness-or-action-authority" as const
export const qaScorecardSchema = qaScorecardInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("qa-scorecard-candidate"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  evidenceCatalogDigest: digestSchema,
  dimensionReceiptDigest: digestSchema,
  gapReceiptDigest: digestSchema,
  assessmentReceiptDigest: digestSchema,
  predecessorDigest: digestSchema.optional(),
  state: z.literal("candidate"),
  createdBy: humanActorSchema,
  updatedBy: humanActorSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  authorityBoundary: z.literal(authorityBoundary),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only later scorecard revisions require a predecessor digest" })
  }
})

const statusAuthorityBoundary = "qa-scorecard-status-is-observational-and-grants-no-product-truth-human-validation-security-approval-product-owner-acceptance-release-deployment-or-action-authority" as const
export const qaScorecardStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("qa-scorecard-status"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  candidate: z.object({ recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict().optional(),
  dimensionCount: z.literal(qaScorecardDimensionIds.length),
  successCount: z.number().int().nonnegative(),
  failureCount: z.number().int().nonnegative(),
  missingCount: z.number().int().nonnegative(),
  staleCount: z.number().int().nonnegative(),
  notAssessedCount: z.number().int().nonnegative(),
  evidenceCount: z.number().int().nonnegative(),
  unresolvedGapCount: z.number().int().nonnegative(),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["local-evidence-current", "attention-required"]),
  reasons: z.array(shortTextSchema).max(256),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict().superRefine((status, context) => {
  if (status.successCount + status.failureCount + status.missingCount + status.staleCount + status.notAssessedCount !== status.dimensionCount) {
    context.addIssue({ code: "custom", path: ["dimensionCount"], message: "QA scorecard dimension counts must reconcile" })
  }
})

const projectionAuthorityBoundary = "qa-scorecard-projection-is-read-only-and-grants-no-product-truth-human-validation-security-approval-product-owner-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-bounded-dimension-evidence-identities-repository-relative-paths-digests-counts-times-states-gaps-and-receipts-only-not-test-output-source-code-product-content-personal-data-secrets-credentials-permissions-or-machine-paths" as const
export const qaScorecardProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("qa-scorecard-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: qaScorecardStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    dimensions: z.array(z.object({ id: qaScorecardDimensionIdSchema, ordinal: z.number().int().positive(), state: qaScorecardStateSchema,
      evidenceCount: z.number().int().nonnegative(), gapCount: z.number().int().nonnegative(), limitationCount: z.number().int().nonnegative(),
      localAutomationState: z.enum(["passed", "failed", "not-run", "not-applicable"]), humanValidationState: z.literal("not-established") }).strict()).length(qaScorecardDimensionIds.length),
    evidenceCatalogDigest: digestSchema, dimensionReceiptDigest: digestSchema, gapReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(privacyBoundary),
  authorityBoundary: z.literal(projectionAuthorityBoundary),
  snapshotDigest: digestSchema,
}).strict()

export type QaScorecardInput = z.infer<typeof qaScorecardInputSchema>
export type QaScorecard = z.infer<typeof qaScorecardSchema>
export type QaScorecardStatus = z.infer<typeof qaScorecardStatusSchema>
export type QaScorecardProjection = z.infer<typeof qaScorecardProjectionSchema>
