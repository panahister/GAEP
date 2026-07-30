import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactSourceReferenceSchema } from "./source-governance.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const requirementKeySchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()
const unique = (values: readonly string[]) => new Set(values).size === values.length
const canonical = (values: readonly string[]) =>
  values.every((value, index) => value === [...values].sort((left, right) => left.localeCompare(right))[index])
const canonicalDigestsSchema = z.array(digestSchema).max(2_048)
  .refine(unique, "Digests must be unique").refine(canonical, "Digests must use canonical ordering")
const canonicalIdentifiersSchema = z.array(identifierSchema).max(33_792)
  .refine(unique, "Identifiers must be unique").refine(canonical, "Identifiers must use canonical ordering")
const canonicalRequirementKeysSchema = z.array(requirementKeySchema).max(4_096)
  .refine(unique, "Requirement keys must be unique").refine(canonical, "Requirement keys must use canonical ordering")
const canonicalTextSchema = z.array(shortTextSchema).max(512)
  .refine(unique, "Values must be unique").refine(canonical, "Values must use canonical ordering")
const exactSourceListSchema = z.array(exactSourceReferenceSchema).min(1).max(256)
  .refine((entries) => unique(entries.map((entry) =>
    `${entry.sourceId}:${entry.sourceRevision}:${entry.recordDigest}:${entry.contentDigest}`)), "Source references must be unique")

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Design Drift Detection candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const exactDesignDriftBaselineBindingSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
  membershipDigest: digestSchema, baselineLineageId: z.string().uuid(), candidateSetId: z.string().uuid(),
  candidateSetRevision: z.number().int().positive(), semanticVersion: z.string().regex(/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?$/),
  designationReceiptDigest: digestSchema, baselineDesignationState: z.literal("not-established"),
}).strict()

export const exactDesignDriftSnapshotBindingSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
  membershipDigest: digestSchema, externalFileIdentityDigest: digestSchema,
  returnedExternalVersionDigest: digestSchema, itemCatalogDigest: digestSchema,
}).strict()

export const exactDesignDriftRequirementsBindingSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
  membershipDigest: digestSchema, requirementCatalogDigest: digestSchema,
}).strict()

export const exactDesignDriftTraceBindingSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
  membershipDigest: digestSchema, reconciliationDigest: digestSchema,
}).strict()

export const designImplementationTargetSchema = z.object({
  key: identifierSchema,
  kind: z.enum(["asset", "component", "implementation-unit", "route", "test", "token-binding"]),
  resourceLineageId: z.string().uuid(),
  resourceRevision: z.number().int().positive(),
  contentDigest: digestSchema,
  representationDigest: digestSchema,
  requirementKeys: canonicalRequirementKeysSchema,
  designItemKeys: canonicalIdentifiersSchema.refine((values) => values.length > 0, "Implementation targets require exact design-item keys"),
  evidenceState: z.enum(["human-reviewed", "not-assessed", "source-recorded"]),
  evidenceDigests: canonicalDigestsSchema,
  sources: exactSourceListSchema,
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
}).strict().superRefine((target, context) => {
  const reviewed = target.evidenceState === "human-reviewed"
  if (reviewed !== (target.evidenceDigests.length > 0 && target.reviewedBy !== undefined && target.reviewedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Human-reviewed implementation targets require exact evidence, reviewer, and time; other states forbid review attribution" })
  }
})

export const designDriftClassifications = [
  "added", "changed", "conflicting", "conformant", "missing", "not-assessed", "stale", "unmapped",
] as const

export const designDriftObservationSchema = z.object({
  key: identifierSchema,
  path: z.enum(["design-to-implementation", "requirement-to-design"]),
  requirementKeys: canonicalRequirementKeysSchema,
  designItemKey: identifierSchema,
  implementationTargetKey: identifierSchema.optional(),
  baselineEvidenceDigest: digestSchema,
  currentEvidenceDigest: digestSchema,
  targetEvidenceDigest: digestSchema,
  classification: z.enum(designDriftClassifications),
  severity: z.enum(["blocker", "high", "informational", "low", "medium", "none", "not-assessed"]),
  evidenceState: z.enum(["disputed", "human-reviewed", "not-assessed", "source-recorded"]),
  evidenceDigests: canonicalDigestsSchema,
  sources: exactSourceListSchema,
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
}).strict().superRefine((observation, context) => {
  const implementationPath = observation.path === "design-to-implementation"
  if (implementationPath !== (observation.implementationTargetKey !== undefined)) {
    context.addIssue({ code: "custom", path: ["implementationTargetKey"], message: "Design-to-implementation observations require one exact implementation target; requirement-to-design observations forbid it" })
  }
  if (observation.path === "requirement-to-design" && observation.requirementKeys.length === 0) {
    context.addIssue({ code: "custom", path: ["requirementKeys"], message: "Requirement-to-design observations require exact Requirement keys" })
  }
  if (observation.classification === "conformant" && observation.severity !== "none") {
    context.addIssue({ code: "custom", path: ["severity"], message: "Conformant observations must use none severity" })
  }
  if (observation.classification === "not-assessed" && observation.severity !== "not-assessed") {
    context.addIssue({ code: "custom", path: ["severity"], message: "Not-assessed observations must use not-assessed severity" })
  }
  if (!["conformant", "not-assessed"].includes(observation.classification) && ["none", "not-assessed"].includes(observation.severity)) {
    context.addIssue({ code: "custom", path: ["severity"], message: "Detected drift requires a classified non-zero severity" })
  }
  const reviewed = observation.evidenceState === "human-reviewed"
  if (reviewed !== (observation.evidenceDigests.length > 0 && observation.reviewedBy !== undefined && observation.reviewedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Human-reviewed drift observations require exact evidence, reviewer, and time; other states forbid review attribution" })
  }
})

export const designDriftRemediationCandidateSchema = z.object({
  key: identifierSchema,
  driftKeys: canonicalIdentifiersSchema.refine((values) => values.length > 0, "Remediation candidates require exact drift keys"),
  kind: z.enum(["amend-design-candidate", "amend-implementation-candidate", "amend-requirement-candidate", "investigate-candidate", "rebaseline-candidate"]),
  rationaleDigest: digestSchema,
  evidenceDigests: canonicalDigestsSchema,
  sources: exactSourceListSchema,
  proposedBy: humanActorSchema,
  proposedAt: z.string().datetime(),
  validUntil: z.string().datetime(),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  effectState: z.literal("not-applied"),
}).strict()

const inputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  objectiveDigest: digestSchema,
  designBaseline: exactDesignDriftBaselineBindingSchema,
  returnedFigmaSnapshot: exactDesignDriftSnapshotBindingSchema,
  designRequirements: exactDesignDriftRequirementsBindingSchema,
  designTrace: exactDesignDriftTraceBindingSchema,
  implementationTargetCatalogRevision: z.number().int().positive(),
  implementationTargets: z.array(designImplementationTargetSchema).min(1).max(33_792)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Implementation target keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Implementation targets must use canonical key ordering"),
  implementationTargetCatalogDigest: digestSchema,
  comparisonPolicyDigest: digestSchema,
  observations: z.array(designDriftObservationSchema).min(1).max(67_584)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Drift observation keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Drift observations must use canonical key ordering"),
  comparisonDigest: digestSchema,
  remediationCandidates: z.array(designDriftRemediationCandidateSchema).max(16_384)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Remediation candidate keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Remediation candidates must use canonical key ordering"),
  candidateResult: z.enum(["blocked", "drift-detected-candidate", "incomplete", "no-drift-observed-candidate"]),
  unresolvedQuestions: canonicalTextSchema,
  limitations: canonicalTextSchema.refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  comparisonCompletenessState: z.literal("not-established"),
  externalCompletenessState: z.literal("not-established"),
  designValidityState: z.literal("not-established"),
  implementationValidityState: z.literal("not-established"),
  approvalState: z.literal("not-established"),
  baselineDesignationState: z.literal("not-established"),
  readinessState: z.literal("not-established"),
  remediationAuthorityState: z.literal("not-granted"),
  figmaConnectionAuthorityState: z.literal("not-granted"),
  credentialAuthorityState: z.literal("not-granted"),
  permissionGrantState: z.literal("not-granted"),
  importExecutionState: z.literal("not-performed"),
  writeExecutionState: z.literal("not-performed"),
  implementationAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  const targetKeys = new Set(candidate.implementationTargets.map((entry) => entry.key))
  const driftKeys = new Set(candidate.observations.map((entry) => entry.key))
  for (const observation of candidate.observations) {
    if (observation.implementationTargetKey && !targetKeys.has(observation.implementationTargetKey)) {
      context.addIssue({ code: "custom", path: ["observations"], message: "Drift observations must reference exact cataloged implementation targets" })
    }
  }
  for (const remediation of candidate.remediationCandidates) {
    if (remediation.driftKeys.some((key) => !driftKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["remediationCandidates"], message: "Remediation candidates must reference exact drift observations" })
    }
  }
  const unassessed = candidate.observations.some((entry) => entry.classification === "not-assessed")
  const detected = candidate.observations.some((entry) => !["conformant", "not-assessed"].includes(entry.classification))
  const expectedResult = unassessed ? "incomplete" : detected ? "drift-detected-candidate" : "no-drift-observed-candidate"
  if (!["blocked", expectedResult].includes(candidate.candidateResult)) {
    context.addIssue({ code: "custom", path: ["candidateResult"], message: "Candidate result must match the exact comparison classifications" })
  }
  if (candidate.reviewState === "ready-for-human-review") {
    const unreviewed = candidate.observations.some((entry) => entry.evidenceState !== "human-reviewed") ||
      candidate.implementationTargets.some((entry) => entry.evidenceState !== "human-reviewed")
    const uncoveredDrift = candidate.observations.some((entry) =>
      !["conformant", "not-assessed"].includes(entry.classification) &&
      !candidate.remediationCandidates.some((remediation) => remediation.driftKeys.includes(entry.key)))
    if (unreviewed || unassessed || uncoveredDrift || candidate.unresolvedQuestions.length > 0) {
      context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready drift detection requires attributable human review, assessed subjects, remediation candidates for detected drift, and no unresolved question" })
    }
  }
})

export const designDriftDetectionInputSchema = rejectSecrets(inputBaseSchema)

export const designDriftDetectionSchema = designDriftDetectionInputSchema.safeExtend({
  schemaVersion: z.literal(1), kind: z.literal("design-drift-detection-candidate"),
  id: z.string().uuid(), productId: z.string().uuid(), revision: z.number().int().positive(),
  membershipDigest: digestSchema, predecessorDigest: digestSchema.optional(), state: z.literal("candidate"),
  createdBy: humanActorSchema, updatedBy: humanActorSchema,
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  authorityBoundary: z.literal("design-drift-detection-is-a-version-bound-observation-and-remediation-candidate-and-does-not-establish-an-actual-baseline-comparison-completeness-external-completeness-design-or-implementation-validity-approval-readiness-remediation-effect-or-figma-import-write-implementation-or-action-authority"),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Design Drift Detection revisions after revision one require an exact predecessor digest" })
  }
})

export const exactDesignDriftDetectionReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const designDriftDetectionStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("design-drift-detection-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactDesignDriftDetectionReferenceSchema.optional(),
  implementationTargetCount: z.number().int().nonnegative().max(33_792),
  humanReviewedImplementationTargetCount: z.number().int().nonnegative().max(33_792),
  observationCount: z.number().int().nonnegative().max(67_584),
  humanReviewedObservationCount: z.number().int().nonnegative().max(67_584),
  requirementToDesignCount: z.number().int().nonnegative().max(67_584),
  designToImplementationCount: z.number().int().nonnegative().max(67_584),
  conformantCount: z.number().int().nonnegative().max(67_584),
  driftCount: z.number().int().nonnegative().max(67_584),
  unassessedCount: z.number().int().nonnegative().max(67_584),
  blockerCount: z.number().int().nonnegative().max(67_584),
  highSeverityCount: z.number().int().nonnegative().max(67_584),
  remediationCandidateCount: z.number().int().nonnegative().max(16_384),
  expiredRemediationCandidateCount: z.number().int().nonnegative().max(16_384),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  candidateResult: z.enum(["blocked", "drift-detected-candidate", "incomplete", "no-drift-observed-candidate", "not-assessed"]),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-human-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal("design-drift-detection-status-is-observational-and-does-not-establish-an-actual-baseline-comparison-completeness-external-completeness-design-or-implementation-validity-approval-readiness-remediation-effect-or-figma-import-write-implementation-or-action-authority"),
}).strict().superRefine((status, context) => {
  if (status.observationCount !== status.requirementToDesignCount + status.designToImplementationCount ||
      status.observationCount !== status.conformantCount + status.driftCount + status.unassessedCount) {
    context.addIssue({ code: "custom", path: ["observationCount"], message: "Design drift status counts must reconcile exactly" })
  }
  const gaps = status.implementationTargetCount - status.humanReviewedImplementationTargetCount +
    status.observationCount - status.humanReviewedObservationCount + status.unassessedCount +
    status.expiredRemediationCandidateCount + status.staleBindingCount +
    status.staleSourceReferenceCount + status.unresolvedQuestionCount
  if (status.state === "complete-for-human-review" && (!status.candidate || status.observationCount === 0 || gaps > 0 ||
      status.reviewState !== "ready-for-human-review" || status.reasons.length > 0)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete drift review requires exact current reviewed evidence with no declared gap" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Design Drift Detection status must expose reasons" })
  }
})

export const designDriftDetectionProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("design-drift-detection-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]) }).strict(),
  status: designDriftDetectionStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, membershipDigest: digestSchema,
    state: z.literal("candidate"), designBaseline: exactDesignDriftBaselineBindingSchema,
    returnedFigmaSnapshot: exactDesignDriftSnapshotBindingSchema,
    designRequirements: exactDesignDriftRequirementsBindingSchema, designTrace: exactDesignDriftTraceBindingSchema,
    implementationTargetCatalogRevision: z.number().int().positive(), implementationTargetCatalogDigest: digestSchema,
    comparisonPolicyDigest: digestSchema, comparisonDigest: digestSchema,
    implementationTargetCount: z.number().int().nonnegative(), observationCount: z.number().int().nonnegative(),
    remediationCandidateCount: z.number().int().nonnegative(),
    candidateResult: z.enum(["blocked", "drift-detected-candidate", "incomplete", "no-drift-observed-candidate"]),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal("projection-contains-record-identities-version-axes-counts-classifications-severities-statuses-and-digests-only-not-design-requirement-or-implementation-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions"),
  authorityBoundary: z.literal("design-drift-detection-projection-is-read-only-and-does-not-establish-an-actual-baseline-comparison-completeness-external-completeness-design-or-implementation-validity-approval-readiness-remediation-effect-or-figma-import-write-implementation-or-action-authority"),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Design Drift Detection projection must bind exact Product and Initiative revisions" })
  }
})

export type ExactDesignDriftBaselineBinding = z.infer<typeof exactDesignDriftBaselineBindingSchema>
export type DesignImplementationTarget = z.infer<typeof designImplementationTargetSchema>
export type DesignDriftObservation = z.infer<typeof designDriftObservationSchema>
export type DesignDriftDetectionInput = z.infer<typeof designDriftDetectionInputSchema>
export type DesignDriftDetection = z.infer<typeof designDriftDetectionSchema>
export type DesignDriftDetectionStatus = z.infer<typeof designDriftDetectionStatusSchema>
export type DesignDriftDetectionProjection = z.infer<typeof designDriftDetectionProjectionSchema>
