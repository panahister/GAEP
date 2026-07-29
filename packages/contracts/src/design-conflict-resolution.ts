import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { designDeltaSubjectKinds } from "./design-delta.js"
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
const canonicalIdentifiersSchema = z.array(identifierSchema).max(65_536)
  .refine(unique, "Identifiers must be unique").refine(canonical, "Identifiers must use canonical ordering")
const canonicalTextSchema = z.array(shortTextSchema).max(512)
  .refine(unique, "Values must be unique").refine(canonical, "Values must use canonical ordering")
const exactSourceListSchema = z.array(exactSourceReferenceSchema).min(1).max(256)
  .refine((entries) => unique(entries.map((entry) =>
    `${entry.sourceId}:${entry.sourceRevision}:${entry.recordDigest}:${entry.contentDigest}`)), "Source references must be unique")

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Design Conflict Resolution candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const exactDesignDeltaResolutionBindingSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
  membershipDigest: digestSchema, deltaCatalogDigest: digestSchema, comparisonReceiptDigest: digestSchema,
  conflictingCount: z.number().int().nonnegative().max(65_536),
  candidateResult: z.enum(["blocked", "conflict-candidate", "delta-detected-candidate", "incomplete", "no-delta-candidate"]),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
}).strict()

export const designConflictResolutionKinds = [
  "accept-source-candidate",
  "accept-target-candidate",
  "escalate-candidate",
  "merge-candidate",
  "reject-change-candidate",
] as const

export const designConflictResolutionEntrySchema = z.object({
  key: identifierSchema,
  conflictKey: identifierSchema,
  conflictDigest: digestSchema,
  subjectKind: z.enum(designDeltaSubjectKinds),
  resolutionKind: z.enum(designConflictResolutionKinds),
  decisionDigest: digestSchema,
  scope: z.literal("single-conflict"),
  decisionState: z.enum(["human-reviewed", "proposed"]),
  evidenceDigests: canonicalDigestsSchema,
  sources: exactSourceListSchema,
  proposedBy: humanActorSchema,
  proposedAt: z.string().datetime(),
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
  validUntil: z.string().datetime(),
  separationOfDutiesState: z.enum(["distinct-actor-declared", "not-enforced-founder-mode"]),
  effectState: z.literal("not-applied"),
}).strict().superRefine((entry, context) => {
  const reviewed = entry.decisionState === "human-reviewed"
  if (reviewed !== (entry.evidenceDigests.length > 0 && entry.reviewedBy !== undefined && entry.reviewedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Human-reviewed conflict candidates require evidence, reviewer, and review time; proposed candidates forbid review attribution" })
  }
  if (!reviewed && (entry.reviewedBy !== undefined || entry.reviewedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Proposed conflict candidates cannot carry review attribution" })
  }
  if (entry.separationOfDutiesState === "distinct-actor-declared" &&
      (!entry.reviewedBy || entry.reviewedBy.id === entry.proposedBy.id)) {
    context.addIssue({ code: "custom", message: "Declared distinct-actor review requires different recorded proposer and reviewer identities" })
  }
  if (!reviewed && entry.separationOfDutiesState !== "not-enforced-founder-mode") {
    context.addIssue({ code: "custom", message: "Unreviewed conflict candidates cannot declare distinct-actor review" })
  }
})

const designConflictResolutionInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  objectiveDigest: digestSchema,
  designDelta: exactDesignDeltaResolutionBindingSchema,
  resolutionDefinitionDigest: digestSchema,
  resolutionReceiptDigest: digestSchema,
  conflictCount: z.number().int().nonnegative().max(65_536),
  resolutions: z.array(designConflictResolutionEntrySchema).max(65_536)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Resolution keys must be unique")
    .refine((entries) => unique(entries.map((entry) => entry.conflictKey)), "A conflict can have only one current resolution candidate")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Conflict resolutions must use canonical key ordering"),
  coverageState: z.enum(["candidate-complete", "not-assessed", "partial"]),
  provenanceState: z.enum(["exact", "not-assessed", "partial"]),
  candidateResult: z.enum(["blocked", "conflict-plan-candidate", "escalation-plan-candidate", "incomplete", "no-conflict-candidate"]),
  unresolvedConflictKeys: canonicalIdentifiersSchema,
  unresolvedQuestions: canonicalTextSchema,
  limitations: canonicalTextSchema.refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  separationOfDutiesEnforcementState: z.literal("not-established"),
  conflictResolutionAuthorityState: z.literal("not-granted"),
  synchronizationAuthorityState: z.literal("not-granted"),
  designValidityState: z.literal("not-established"),
  designApprovalState: z.literal("not-established"),
  designBaselineState: z.literal("not-established"),
  readinessState: z.literal("not-established"),
  figmaConnectionAuthorityState: z.literal("not-granted"),
  credentialAuthorityState: z.literal("not-granted"),
  permissionGrantState: z.literal("not-granted"),
  importExecutionState: z.literal("not-performed"),
  writeExecutionState: z.literal("not-performed"),
  implementationAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  if (candidate.conflictCount !== candidate.designDelta.conflictingCount ||
      candidate.resolutions.length + candidate.unresolvedConflictKeys.length > candidate.conflictCount) {
    context.addIssue({ code: "custom", path: ["conflictCount"], message: "Conflict counts must reconcile with the exact Design Delta binding and bounded candidate coverage" })
  }
  const conflictKeys = new Set(candidate.resolutions.map((entry) => entry.conflictKey))
  if (candidate.unresolvedConflictKeys.some((key) => conflictKeys.has(key))) {
    context.addIssue({ code: "custom", path: ["unresolvedConflictKeys"], message: "Resolved and unresolved conflict keys must be disjoint" })
  }
  const completeCoverage = candidate.resolutions.length === candidate.conflictCount &&
    candidate.unresolvedConflictKeys.length === 0
  if ((candidate.coverageState === "candidate-complete") !== completeCoverage) {
    context.addIssue({ code: "custom", path: ["coverageState"], message: "Candidate-complete conflict coverage requires one resolution candidate for every exact conflict" })
  }
  const reviewable = candidate.coverageState === "candidate-complete" && candidate.provenanceState === "exact" &&
    candidate.resolutions.every((entry) => entry.decisionState === "human-reviewed") &&
    candidate.unresolvedQuestions.length === 0
  if (candidate.reviewState === "ready-for-human-review" && !reviewable) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready conflict plans require exact provenance, complete human-reviewed candidate coverage, and no unresolved question" })
  }
  const escalated = candidate.resolutions.some((entry) => entry.resolutionKind === "escalate-candidate")
  if (candidate.candidateResult === "no-conflict-candidate" &&
      (candidate.conflictCount !== 0 || candidate.resolutions.length > 0 || !reviewable || candidate.reviewState !== "ready-for-human-review")) {
    context.addIssue({ code: "custom", path: ["candidateResult"], message: "No-conflict candidates require an exact review-ready empty conflict set" })
  }
  if (candidate.candidateResult === "conflict-plan-candidate" &&
      (candidate.conflictCount === 0 || candidate.resolutions.length === 0 || escalated)) {
    context.addIssue({ code: "custom", path: ["candidateResult"], message: "Conflict-plan candidates require one or more non-escalation resolution candidates" })
  }
  if (candidate.candidateResult === "escalation-plan-candidate" && !escalated) {
    context.addIssue({ code: "custom", path: ["candidateResult"], message: "Escalation-plan candidates require at least one exact escalation candidate" })
  }
})

export const designConflictResolutionInputSchema = rejectSecrets(designConflictResolutionInputBaseSchema)

export const designConflictResolutionSchema = designConflictResolutionInputSchema.safeExtend({
  schemaVersion: z.literal(1), kind: z.literal("design-conflict-resolution-candidate"),
  id: z.string().uuid(), productId: z.string().uuid(), revision: z.number().int().positive(),
  membershipDigest: digestSchema, predecessorDigest: digestSchema.optional(), state: z.literal("candidate"),
  createdBy: humanActorSchema, updatedBy: humanActorSchema,
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  authorityBoundary: z.literal("design-conflict-resolution-is-a-review-candidate-and-does-not-enforce-separation-of-duties-resolve-conflicts-synchronize-design-establish-validity-approval-baseline-readiness-or-grant-implementation-write-import-or-action-authority"),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Design Conflict Resolution revisions after revision one require an exact predecessor digest" })
  }
})

export const exactDesignConflictResolutionReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const designConflictResolutionStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("design-conflict-resolution-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactDesignConflictResolutionReferenceSchema.optional(),
  conflictCount: z.number().int().nonnegative().max(65_536),
  resolutionCount: z.number().int().nonnegative().max(65_536),
  acceptSourceCount: z.number().int().nonnegative().max(65_536),
  acceptTargetCount: z.number().int().nonnegative().max(65_536),
  mergeCount: z.number().int().nonnegative().max(65_536),
  rejectChangeCount: z.number().int().nonnegative().max(65_536),
  escalateCount: z.number().int().nonnegative().max(65_536),
  humanReviewedCount: z.number().int().nonnegative().max(65_536),
  distinctActorDeclaredCount: z.number().int().nonnegative().max(65_536),
  expiredCandidateCount: z.number().int().nonnegative().max(65_536),
  unresolvedConflictCount: z.number().int().nonnegative().max(65_536),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  staleBindingCount: z.number().int().nonnegative(), staleSourceReferenceCount: z.number().int().nonnegative(),
  coverageState: z.enum(["candidate-complete", "not-assessed", "partial"]),
  provenanceState: z.enum(["exact", "not-assessed", "partial"]),
  candidateResult: z.enum(["blocked", "conflict-plan-candidate", "escalation-plan-candidate", "incomplete", "no-conflict-candidate", "not-assessed"]),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-review"]), reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal("design-conflict-resolution-status-is-observational-and-does-not-enforce-separation-of-duties-resolve-conflicts-synchronize-design-establish-validity-approval-baseline-readiness-or-grant-implementation-write-import-or-action-authority"),
}).strict().superRefine((status, context) => {
  const counted = status.acceptSourceCount + status.acceptTargetCount + status.mergeCount +
    status.rejectChangeCount + status.escalateCount
  if (counted !== status.resolutionCount || status.humanReviewedCount > status.resolutionCount ||
      status.distinctActorDeclaredCount > status.humanReviewedCount ||
      status.resolutionCount + status.unresolvedConflictCount > status.conflictCount) {
    context.addIssue({ code: "custom", path: ["resolutionCount"], message: "Design Conflict Resolution status counts must reconcile" })
  }
  if (status.state === "complete-for-review" && (!status.candidate || status.reasons.length > 0 ||
      status.coverageState !== "candidate-complete" || status.provenanceState !== "exact" ||
      status.expiredCandidateCount + status.unresolvedConflictCount + status.unresolvedQuestionCount +
        status.staleBindingCount + status.staleSourceReferenceCount > 0 ||
      status.humanReviewedCount !== status.resolutionCount || status.reviewState !== "ready-for-human-review" ||
      ["blocked", "incomplete", "not-assessed"].includes(status.candidateResult))) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires exact current human-reviewed candidate coverage with no declared gap" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required conflict status must expose reasons" })
  }
})

export const designConflictResolutionProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("design-conflict-resolution-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]) }).strict(),
  status: designConflictResolutionStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, membershipDigest: digestSchema,
    state: z.literal("candidate"), designDelta: exactDesignDeltaResolutionBindingSchema,
    resolutionDefinitionDigest: digestSchema, resolutionReceiptDigest: digestSchema,
    resolutionCatalogDigest: digestSchema, conflictCount: z.number().int().nonnegative().max(65_536),
    resolutionCount: z.number().int().nonnegative().max(65_536),
    coverageState: z.enum(["candidate-complete", "not-assessed", "partial"]),
    provenanceState: z.enum(["exact", "not-assessed", "partial"]),
    candidateResult: z.enum(["blocked", "conflict-plan-candidate", "escalation-plan-candidate", "incomplete", "no-conflict-candidate"]),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal("projection-contains-record-identities-counts-results-and-digests-only-not-design-content-delta-content-resolution-content-evidence-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions"),
  authorityBoundary: z.literal("design-conflict-resolution-projection-is-read-only-and-does-not-enforce-separation-of-duties-resolve-conflicts-synchronize-design-establish-validity-approval-baseline-readiness-or-grant-implementation-write-import-or-action-authority"),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Design Conflict Resolution projection must bind exact Product and Initiative revisions" })
  }
})

export type DesignConflictResolutionEntry = z.infer<typeof designConflictResolutionEntrySchema>
export type DesignConflictResolutionInput = z.infer<typeof designConflictResolutionInputSchema>
export type DesignConflictResolution = z.infer<typeof designConflictResolutionSchema>
export type DesignConflictResolutionStatus = z.infer<typeof designConflictResolutionStatusSchema>
export type DesignConflictResolutionProjection = z.infer<typeof designConflictResolutionProjectionSchema>
