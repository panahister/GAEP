import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactSourceReferenceSchema } from "./source-governance.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()

const unique = (values: readonly string[]) => new Set(values).size === values.length
const canonical = (values: readonly string[]) =>
  values.every((value, index) => value === [...values].sort((left, right) => left.localeCompare(right))[index])
const canonicalDigestsSchema = z.array(digestSchema).max(1_024)
  .refine(unique, "Digests must be unique").refine(canonical, "Digests must use canonical ordering")
const canonicalTextSchema = z.array(shortTextSchema).max(512)
  .refine(unique, "Values must be unique").refine(canonical, "Values must use canonical ordering")
const exactSourceListSchema = z.array(exactSourceReferenceSchema).min(1).max(256)
  .refine((entries) => unique(entries.map((entry) => `${entry.sourceId}:${entry.sourceRevision}:${entry.recordDigest}:${entry.contentDigest}`)), "Source references must be unique")

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Finalized Figma Snapshot Import candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const exactGovernedFigmaWriteImportBindingSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
  membershipDigest: digestSchema, requestDigest: digestSchema, effectDigest: digestSchema,
  externalFileIdentityDigest: digestSchema, expectedExternalVersionDigest: digestSchema,
}).strict()

export const finalizedFigmaSnapshotReturnReceiptSchema = z.object({
  mode: z.enum(["manual-return-receipt", "figma-mcp-read-receipt", "source-backed-record"]),
  externalFileIdentityDigest: digestSchema,
  returnedExternalVersionDigest: digestSchema,
  payloadDigest: digestSchema,
  receiptDigest: digestSchema,
  capturedAt: z.string().datetime(),
  evidenceState: z.enum(["human-reviewed", "source-recorded", "not-assessed"]),
  evidenceDigests: canonicalDigestsSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((receipt, context) => {
  if (receipt.evidenceState === "human-reviewed" && receipt.evidenceDigests.length === 0) {
    context.addIssue({ code: "custom", path: ["evidenceDigests"], message: "Human-reviewed return receipts require exact evidence" })
  }
})

export const finalizedFigmaSnapshotReturnAuthorizationSchema = z.object({
  state: z.enum(["not-assessed", "missing", "verified"]),
  scopeDigest: digestSchema.optional(),
  decisionDigest: digestSchema.optional(),
  evidenceDigests: canonicalDigestsSchema,
  verifiedBy: humanActorSchema.optional(),
  verifiedAt: z.string().datetime().optional(),
}).strict().superRefine((authorization, context) => {
  const verified = authorization.state === "verified"
  if (verified !== (authorization.scopeDigest !== undefined && authorization.decisionDigest !== undefined &&
      authorization.evidenceDigests.length > 0 && authorization.verifiedBy !== undefined && authorization.verifiedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Verified return authorization requires exact scope, decision, evidence, actor, and time; other states forbid them" })
  }
})

export const finalizedFigmaSnapshotItemSchema = z.object({
  key: identifierSchema,
  kind: z.enum(["file", "component", "component-set", "variable-collection", "variable", "style", "prototype-flow"]),
  externalIdentityDigest: digestSchema,
  contentDigest: digestSchema,
  provenanceDigest: digestSchema,
  evidenceState: z.enum(["human-reviewed", "source-recorded", "not-assessed"]),
  sources: exactSourceListSchema,
}).strict()

export const finalizedFigmaSnapshotConflictSchema = z.object({
  key: identifierSchema,
  kind: z.enum(["external-version-conflict", "missing-governed-binding", "content-divergence", "provenance-gap", "authorization-gap"]),
  state: z.enum(["open", "resolved"]),
  subjectDigest: digestSchema,
  rationaleDigest: digestSchema,
  evidenceDigests: canonicalDigestsSchema,
  resolvedBy: humanActorSchema.optional(),
  resolvedAt: z.string().datetime().optional(),
  sources: exactSourceListSchema,
}).strict().superRefine((conflict, context) => {
  const resolved = conflict.state === "resolved"
  if (resolved !== (conflict.evidenceDigests.length > 0 && conflict.resolvedBy !== undefined && conflict.resolvedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Resolved snapshot conflicts require exact evidence and attributable human resolution; open conflicts forbid them" })
  }
})

const inputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  objectiveDigest: digestSchema,
  governedWrite: exactGovernedFigmaWriteImportBindingSchema,
  returnReceipt: finalizedFigmaSnapshotReturnReceiptSchema,
  returnAuthorization: finalizedFigmaSnapshotReturnAuthorizationSchema,
  items: z.array(finalizedFigmaSnapshotItemSchema).min(1).max(33_792)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Snapshot item keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Snapshot items must use canonical key ordering")
    .refine((entries) => unique(entries.map((entry) => `${entry.kind}:${entry.externalIdentityDigest}`)), "External snapshot identities must be unique within kind"),
  conflicts: z.array(finalizedFigmaSnapshotConflictSchema).max(1_024)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Snapshot conflict keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Snapshot conflicts must use canonical key ordering"),
  reconciliationDigest: digestSchema,
  reconciliationState: z.enum(["exact", "partial", "not-assessed"]),
  provenanceState: z.enum(["exact", "partial", "not-assessed"]),
  snapshotCompletenessState: z.enum(["candidate-complete", "partial", "not-assessed"]),
  unresolvedQuestions: canonicalTextSchema,
  limitations: canonicalTextSchema.refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  inboundTransferState: z.literal("not-performed"),
  importExecutionState: z.literal("not-performed"),
  importResultState: z.literal("not-recorded"),
  figmaConnectionAuthorityState: z.literal("not-granted"),
  credentialAuthorityState: z.literal("not-granted"),
  permissionGrantState: z.literal("not-granted"),
  externalCompletenessState: z.literal("not-established"),
  targetValidityState: z.literal("not-established"),
  designValidityState: z.literal("not-established"),
  designApprovalState: z.literal("not-established"),
  designBaselineState: z.literal("not-established"),
  readinessState: z.literal("not-established"),
  implementationAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  if (candidate.governedWrite.externalFileIdentityDigest !== candidate.returnReceipt.externalFileIdentityDigest) {
    context.addIssue({ code: "custom", path: ["returnReceipt", "externalFileIdentityDigest"], message: "Returned snapshots must bind the exact governed-write file identity" })
  }
  const openConflicts = candidate.conflicts.filter((entry) => entry.state === "open").length
  const unreviewedItems = candidate.items.filter((entry) => entry.evidenceState !== "human-reviewed").length
  if (candidate.reviewState === "ready-for-human-review" &&
      (candidate.returnAuthorization.state !== "verified" || candidate.reconciliationState !== "exact" ||
       candidate.provenanceState !== "exact" || candidate.snapshotCompletenessState !== "candidate-complete" ||
       openConflicts > 0 || unreviewedItems > 0 || candidate.unresolvedQuestions.length > 0)) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready finalized snapshots require exact authorized, complete, reconciled, human-reviewed evidence with no open conflict or question" })
  }
})

export const finalizedFigmaSnapshotImportInputSchema = rejectSecrets(inputBaseSchema)

export const finalizedFigmaSnapshotImportSchema = finalizedFigmaSnapshotImportInputSchema.safeExtend({
  schemaVersion: z.literal(1), kind: z.literal("finalized-figma-snapshot-import-candidate"),
  id: z.string().uuid(), productId: z.string().uuid(), revision: z.number().int().positive(),
  membershipDigest: digestSchema, predecessorDigest: digestSchema.optional(), state: z.literal("candidate"),
  createdBy: humanActorSchema, updatedBy: humanActorSchema,
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  authorityBoundary: z.literal("finalized-figma-snapshot-import-is-a-review-candidate-and-does-not-transfer-or-import-content-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-validate-or-approve-design-establish-a-baseline-readiness-implementation-or-action-authority"),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Finalized Figma Snapshot Import revisions after revision one require an exact predecessor digest" })
  }
})

export const exactFinalizedFigmaSnapshotImportReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const finalizedFigmaSnapshotImportStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("finalized-figma-snapshot-import-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactFinalizedFigmaSnapshotImportReferenceSchema.optional(),
  itemCount: z.number().int().nonnegative().max(33_792),
  humanReviewedItemCount: z.number().int().nonnegative().max(33_792),
  sourceRecordedItemCount: z.number().int().nonnegative().max(33_792),
  notAssessedItemCount: z.number().int().nonnegative().max(33_792),
  openConflictCount: z.number().int().nonnegative().max(1_024),
  staleBindingCount: z.number().int().nonnegative(), staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  returnAuthorizationState: z.enum(["not-assessed", "missing", "verified"]),
  reconciliationState: z.enum(["exact", "partial", "not-assessed"]),
  provenanceState: z.enum(["exact", "partial", "not-assessed"]),
  snapshotCompletenessState: z.enum(["candidate-complete", "partial", "not-assessed"]),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  importExecutionState: z.literal("not-performed"), importResultState: z.literal("not-recorded"),
  state: z.enum(["attention-required", "complete-for-review"]), reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal("finalized-figma-snapshot-import-status-is-observational-and-does-not-transfer-or-import-content-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-validate-or-approve-design-establish-a-baseline-readiness-implementation-or-action-authority"),
}).strict().superRefine((status, context) => {
  const gaps = status.sourceRecordedItemCount + status.notAssessedItemCount + status.openConflictCount +
    status.staleBindingCount + status.staleSourceReferenceCount + status.unresolvedQuestionCount
  if (status.state === "complete-for-review" && (gaps > 0 || status.itemCount === 0 ||
      status.returnAuthorizationState !== "verified" || status.reconciliationState !== "exact" ||
      status.provenanceState !== "exact" || status.snapshotCompletenessState !== "candidate-complete" ||
      status.reviewState !== "ready-for-human-review" || status.reasons.length > 0 || !status.candidate)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires exact authorized finalized-snapshot evidence with no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required finalized snapshot status must expose reasons" })
  }
})

export const finalizedFigmaSnapshotImportProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("finalized-figma-snapshot-import-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]) }).strict(),
  status: finalizedFigmaSnapshotImportStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, membershipDigest: digestSchema,
    state: z.literal("candidate"), governedWrite: exactGovernedFigmaWriteImportBindingSchema,
    externalFileIdentityDigest: digestSchema, returnedExternalVersionDigest: digestSchema,
    payloadDigest: digestSchema, receiptDigest: digestSchema, reconciliationDigest: digestSchema,
    itemCount: z.number().int().nonnegative(), conflictCount: z.number().int().nonnegative(),
    returnAuthorizationState: z.enum(["not-assessed", "missing", "verified"]),
    reconciliationState: z.enum(["exact", "partial", "not-assessed"]),
    provenanceState: z.enum(["exact", "partial", "not-assessed"]),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
    importExecutionState: z.literal("not-performed"), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal("projection-contains-record-identities-counts-statuses-and-digests-only-not-figma-content-names-external-identities-source-content-authorization-actor-personal-content-secrets-credentials-or-permissions"),
  authorityBoundary: z.literal("finalized-figma-snapshot-import-projection-is-read-only-and-does-not-transfer-or-import-content-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-validate-or-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority"),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Finalized Figma Snapshot Import projection must bind exact Product and Initiative revisions" })
  }
})

export type FinalizedFigmaSnapshotImportInput = z.infer<typeof finalizedFigmaSnapshotImportInputSchema>
export type FinalizedFigmaSnapshotImport = z.infer<typeof finalizedFigmaSnapshotImportSchema>
export type FinalizedFigmaSnapshotImportStatus = z.infer<typeof finalizedFigmaSnapshotImportStatusSchema>
export type FinalizedFigmaSnapshotImportProjection = z.infer<typeof finalizedFigmaSnapshotImportProjectionSchema>
