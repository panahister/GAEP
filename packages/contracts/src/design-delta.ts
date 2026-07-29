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
const canonicalIdentifiersSchema = z.array(identifierSchema).max(4_096)
  .refine(unique, "Identifiers must be unique").refine(canonical, "Identifiers must use canonical ordering")
const canonicalTextSchema = z.array(shortTextSchema).max(512)
  .refine(unique, "Values must be unique").refine(canonical, "Values must use canonical ordering")
const exactSourceListSchema = z.array(exactSourceReferenceSchema).min(1).max(256)
  .refine((entries) => unique(entries.map((entry) =>
    `${entry.sourceId}:${entry.sourceRevision}:${entry.recordDigest}:${entry.contentDigest}`)), "Source references must be unique")

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Design Delta candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const exactDesignerReadyGateDeltaBindingSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
  membershipDigest: digestSchema, prerequisiteCatalogDigest: digestSchema,
  assessmentReceiptDigest: digestSchema,
  candidateResult: z.enum(["blocked", "conditional-pass-candidate", "incomplete", "not-applicable-candidate", "pass-candidate"]),
}).strict()

export const exactFinalizedSnapshotDeltaBindingSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
  membershipDigest: digestSchema, itemCatalogDigest: digestSchema, reconciliationDigest: digestSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
}).strict()

export const exactDesignBindingDeltaBindingSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
  membershipDigest: digestSchema, bindingCatalogDigest: digestSchema, reconciliationDigest: digestSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
}).strict()

export const designDeltaSubjectKinds = [
  "accessibility-rule",
  "decision",
  "design-applicability",
  "design-item",
  "design-requirement",
  "design-token",
  "figma-capability",
  "information-architecture",
  "manual-handoff",
  "responsive-target",
  "role-persona",
  "screen-state",
  "user-journey",
] as const

export const designDeltaEntrySchema = z.object({
  key: identifierSchema,
  subjectKind: z.enum(designDeltaSubjectKinds),
  subjectKey: identifierSchema,
  changeKind: z.enum(["added", "changed", "conflicting", "missing", "stale", "unmapped"]),
  sourceDigest: digestSchema.optional(),
  targetDigest: digestSchema.optional(),
  freshness: z.enum(["current", "stale", "unknown"]),
  impactState: z.enum(["critical", "high", "low", "medium", "not-assessed"]),
  evidenceState: z.enum(["disputed", "human-reviewed", "not-assessed", "source-recorded"]),
  evidenceDigests: canonicalDigestsSchema,
  sources: exactSourceListSchema,
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
}).strict().superRefine((entry, context) => {
  if (entry.changeKind === "added" && (entry.sourceDigest !== undefined || entry.targetDigest === undefined)) {
    context.addIssue({ code: "custom", message: "Added deltas require only an exact target digest" })
  }
  if (entry.changeKind === "missing" && (entry.sourceDigest === undefined || entry.targetDigest !== undefined)) {
    context.addIssue({ code: "custom", message: "Missing deltas require only an exact source digest" })
  }
  if (["changed", "conflicting"].includes(entry.changeKind) &&
      (entry.sourceDigest === undefined || entry.targetDigest === undefined || entry.sourceDigest === entry.targetDigest)) {
    context.addIssue({ code: "custom", message: "Changed and conflicting deltas require distinct exact source and target digests" })
  }
  if (["stale", "unmapped"].includes(entry.changeKind) && entry.sourceDigest === undefined && entry.targetDigest === undefined) {
    context.addIssue({ code: "custom", message: "Stale and unmapped deltas require at least one exact side digest" })
  }
  const reviewed = entry.evidenceState === "human-reviewed"
  if (reviewed !== (entry.evidenceDigests.length > 0 && entry.reviewedBy !== undefined && entry.reviewedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Human-reviewed deltas require exact evidence, reviewer, and time; other states forbid review attribution" })
  }
})

const designDeltaInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  objectiveDigest: digestSchema,
  designerReadyGate: exactDesignerReadyGateDeltaBindingSchema,
  finalizedSnapshot: exactFinalizedSnapshotDeltaBindingSchema,
  designBinding: exactDesignBindingDeltaBindingSchema,
  sourceSnapshotDigest: digestSchema,
  targetSnapshotDigest: digestSchema,
  comparisonDefinitionDigest: digestSchema,
  comparisonReceiptDigest: digestSchema,
  sourceItemCount: z.number().int().nonnegative().max(131_072),
  targetItemCount: z.number().int().nonnegative().max(131_072),
  deltas: z.array(designDeltaEntrySchema).max(65_536)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Design Delta keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Design Deltas must use canonical key ordering"),
  comparisonState: z.enum(["exact", "not-assessed", "partial"]),
  provenanceState: z.enum(["exact", "not-assessed", "partial"]),
  candidateResult: z.enum(["blocked", "conflict-candidate", "delta-detected-candidate", "incomplete", "no-delta-candidate"]),
  unresolvedMappings: canonicalIdentifiersSchema,
  unresolvedQuestions: canonicalTextSchema,
  limitations: canonicalTextSchema.refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  deltaCompletenessState: z.literal("not-established"),
  externalCompletenessState: z.literal("not-established"),
  designValidityState: z.literal("not-established"),
  designApprovalState: z.literal("not-established"),
  designBaselineState: z.literal("not-established"),
  readinessState: z.literal("not-established"),
  conflictResolutionAuthorityState: z.literal("not-granted"),
  synchronizationAuthorityState: z.literal("not-granted"),
  figmaConnectionAuthorityState: z.literal("not-granted"),
  credentialAuthorityState: z.literal("not-granted"),
  permissionGrantState: z.literal("not-granted"),
  importExecutionState: z.literal("not-performed"),
  writeExecutionState: z.literal("not-performed"),
  implementationAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  const conflicting = candidate.deltas.some((entry) => entry.changeKind === "conflicting")
  const reviewable = candidate.comparisonState === "exact" && candidate.provenanceState === "exact" &&
    candidate.deltas.every((entry) => entry.freshness === "current" && entry.evidenceState !== "not-assessed") &&
    candidate.unresolvedMappings.length === 0 && candidate.unresolvedQuestions.length === 0
  if (candidate.reviewState === "ready-for-human-review" && !reviewable) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready Design Deltas require exact current source-backed comparison with no unresolved mapping or question" })
  }
  if (candidate.candidateResult === "no-delta-candidate" &&
      (candidate.deltas.length > 0 || !reviewable || candidate.reviewState !== "ready-for-human-review")) {
    context.addIssue({ code: "custom", path: ["candidateResult"], message: "No-delta candidates require an exact review-ready empty comparison" })
  }
  if (candidate.candidateResult === "delta-detected-candidate" && (candidate.deltas.length === 0 || conflicting)) {
    context.addIssue({ code: "custom", path: ["candidateResult"], message: "Delta-detected candidates require one or more non-conflicting deltas" })
  }
  if (candidate.candidateResult === "conflict-candidate" && !conflicting) {
    context.addIssue({ code: "custom", path: ["candidateResult"], message: "Conflict candidates require at least one conflicting delta" })
  }
})

export const designDeltaInputSchema = rejectSecrets(designDeltaInputBaseSchema)

export const designDeltaSchema = designDeltaInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("design-delta-candidate"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  membershipDigest: digestSchema,
  predecessorDigest: digestSchema.optional(),
  state: z.literal("candidate"),
  createdBy: humanActorSchema,
  updatedBy: humanActorSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  authorityBoundary: z.literal("design-delta-is-a-review-candidate-and-does-not-establish-delta-completeness-external-completeness-design-validity-approval-baseline-readiness-conflict-resolution-synchronization-implementation-write-import-or-action-authority"),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Design Delta revisions after revision one require an exact predecessor digest" })
  }
})

export const exactDesignDeltaReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const designDeltaStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("design-delta-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactDesignDeltaReferenceSchema.optional(),
  sourceItemCount: z.number().int().nonnegative().max(131_072),
  targetItemCount: z.number().int().nonnegative().max(131_072),
  deltaCount: z.number().int().nonnegative().max(65_536),
  addedCount: z.number().int().nonnegative().max(65_536),
  changedCount: z.number().int().nonnegative().max(65_536),
  conflictingCount: z.number().int().nonnegative().max(65_536),
  missingCount: z.number().int().nonnegative().max(65_536),
  staleCount: z.number().int().nonnegative().max(65_536),
  unmappedCount: z.number().int().nonnegative().max(65_536),
  humanReviewedCount: z.number().int().nonnegative().max(65_536),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedMappingCount: z.number().int().nonnegative().max(4_096),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  comparisonState: z.enum(["exact", "not-assessed", "partial"]),
  provenanceState: z.enum(["exact", "not-assessed", "partial"]),
  candidateResult: z.enum(["blocked", "conflict-candidate", "delta-detected-candidate", "incomplete", "no-delta-candidate", "not-assessed"]),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal("design-delta-status-is-observational-and-does-not-establish-delta-completeness-external-completeness-design-validity-approval-baseline-readiness-conflict-resolution-synchronization-implementation-write-import-or-action-authority"),
}).strict().superRefine((status, context) => {
  const counted = status.addedCount + status.changedCount + status.conflictingCount + status.missingCount +
    status.staleCount + status.unmappedCount
  if (counted !== status.deltaCount || status.humanReviewedCount > status.deltaCount) {
    context.addIssue({ code: "custom", path: ["deltaCount"], message: "Design Delta status counts must reconcile" })
  }
  if (status.state === "complete-for-review" && (!status.candidate || status.reasons.length > 0 ||
      status.comparisonState !== "exact" || status.provenanceState !== "exact" ||
      status.staleBindingCount + status.staleSourceReferenceCount + status.unresolvedMappingCount + status.unresolvedQuestionCount > 0 ||
      status.reviewState !== "ready-for-human-review" || ["blocked", "incomplete", "not-assessed"].includes(status.candidateResult))) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires an exact current review candidate with no declared gap" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Design Delta status must expose reasons" })
  }
})

export const designDeltaProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("design-delta-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]) }).strict(),
  status: designDeltaStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, membershipDigest: digestSchema,
    state: z.literal("candidate"), designerReadyGate: exactDesignerReadyGateDeltaBindingSchema,
    finalizedSnapshot: exactFinalizedSnapshotDeltaBindingSchema, designBinding: exactDesignBindingDeltaBindingSchema,
    sourceSnapshotDigest: digestSchema, targetSnapshotDigest: digestSchema,
    comparisonDefinitionDigest: digestSchema, comparisonReceiptDigest: digestSchema,
    deltaCatalogDigest: digestSchema, deltaCount: z.number().int().nonnegative().max(65_536),
    comparisonState: z.enum(["exact", "not-assessed", "partial"]),
    provenanceState: z.enum(["exact", "not-assessed", "partial"]),
    candidateResult: z.enum(["blocked", "conflict-candidate", "delta-detected-candidate", "incomplete", "no-delta-candidate"]),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal("projection-contains-record-identities-counts-results-and-digests-only-not-design-content-delta-content-external-identities-evidence-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions"),
  authorityBoundary: z.literal("design-delta-projection-is-read-only-and-does-not-establish-delta-completeness-external-completeness-design-validity-approval-baseline-readiness-conflict-resolution-synchronization-implementation-write-import-or-action-authority"),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Design Delta projection must bind exact Product and Initiative revisions" })
  }
})

export type DesignDeltaEntry = z.infer<typeof designDeltaEntrySchema>
export type DesignDeltaInput = z.infer<typeof designDeltaInputSchema>
export type DesignDelta = z.infer<typeof designDeltaSchema>
export type DesignDeltaStatus = z.infer<typeof designDeltaStatusSchema>
export type DesignDeltaProjection = z.infer<typeof designDeltaProjectionSchema>
