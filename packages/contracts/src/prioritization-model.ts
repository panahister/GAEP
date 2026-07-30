import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { exactMvpSliceDefinitionReferenceSchema } from "./mvp-slice-definition.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function canonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Prioritization Model candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalTextListSchema = z.array(shortTextSchema).max(512)
  .refine(unique, "Values must be unique")
  .refine(canonical, "Values must use canonical lexical ordering")

export const prioritizationEvidenceKindSchema = z.enum([
  "cost-estimate",
  "dependency-analysis",
  "outcome-model",
  "risk-register",
  "value-hypothesis",
])

export const prioritizationEvidenceReferenceSchema = z.object({
  kind: prioritizationEvidenceKindSchema,
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

const evidenceReferencesSchema = z.array(prioritizationEvidenceReferenceSchema).max(256)
  .refine((values) => unique(values.map((value) => `${value.kind}:${value.recordId}:${value.revision}:${value.digest}`)),
    "Prioritization evidence references must be unique")
  .refine((values) => canonical(values.map((value) =>
    `${value.kind}:${value.recordId}:${String(value.revision).padStart(12, "0")}:${value.digest}`)),
  "Prioritization evidence references must use canonical identity ordering")

export const prioritizationEstimateSchema = z.object({
  state: z.enum(["candidate-estimate", "not-assessed"]),
  score: z.number().int().min(0).max(100).optional(),
  evidence: evidenceReferencesSchema,
  uncertainty: canonicalTextListSchema,
}).strict().superRefine((estimate, context) => {
  if ((estimate.state === "candidate-estimate") !== (estimate.score !== undefined)) {
    context.addIssue({ code: "custom", path: ["score"], message: "Candidate estimates require a bounded score and not-assessed inputs must not invent one" })
  }
  if (estimate.state === "candidate-estimate" && estimate.evidence.length === 0) {
    context.addIssue({ code: "custom", path: ["evidence"], message: "Candidate estimates require at least one exact evidence reference" })
  }
})

export const prioritizationSubjectSchema = z.object({
  sliceId: z.string().uuid(),
  sliceKey: identifierSchema,
  ordinal: z.number().int().positive().max(10_000),
  value: prioritizationEstimateSchema,
  riskReduction: prioritizationEstimateSchema,
  dependencyEnablement: prioritizationEstimateSchema,
  costSize: prioritizationEstimateSchema,
}).strict()

export const prioritizationMethodSchema = z.object({
  key: identifierSchema,
  version: shortTextSchema,
  calculation: z.literal("weighted-sum-v1"),
  normalization: z.literal("zero-to-one-hundred"),
  weights: z.object({
    value: z.number().int().min(0).max(100),
    riskReduction: z.number().int().min(0).max(100),
    dependencyEnablement: z.number().int().min(0).max(100),
    costSize: z.number().int().min(0).max(100),
  }).strict(),
  tieBreaker: z.literal("slice-ordinal-ascending"),
}).strict().superRefine((method, context) => {
  if (Object.values(method.weights).reduce((sum, value) => sum + value, 0) !== 100) {
    context.addIssue({ code: "custom", path: ["weights"], message: "Prioritization candidate weights must sum to exactly 100" })
  }
})

const prioritizationModelInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  mvpSliceDefinition: exactMvpSliceDefinitionReferenceSchema,
  method: prioritizationMethodSchema,
  subjects: z.array(prioritizationSubjectSchema).min(1).max(10_000),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  evidenceValidityState: z.literal("not-established"),
  priorityDecisionState: z.literal("not-established"),
  commitmentState: z.literal("not-established"),
  scopeDecisionState: z.literal("not-established"),
  approvalState: z.literal("not-established"),
  acceptanceCriteriaValidityState: z.literal("not-established"),
  readyDoneState: z.literal("not-established"),
  implementationReadinessState: z.literal("not-established"),
  assignmentExecutionState: z.literal("not-established"),
  implementationAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  const ids = candidate.subjects.map((subject) => subject.sliceId)
  const keys = candidate.subjects.map((subject) => subject.sliceKey)
  if (!unique(ids) || !unique(keys)) {
    context.addIssue({ code: "custom", path: ["subjects"], message: "Every Vertical Slice must have exactly one Prioritization subject" })
  }
  for (const [index, subject] of candidate.subjects.entries()) {
    if (subject.ordinal !== index + 1) {
      context.addIssue({ code: "custom", path: ["subjects", index, "ordinal"], message: "Prioritization subjects must retain contiguous Vertical Slice ordinal ordering" })
    }
  }
  const allAssessed = candidate.subjects.every((subject) =>
    [subject.value, subject.riskReduction, subject.dependencyEnablement, subject.costSize]
      .every((estimate) => estimate.state === "candidate-estimate"))
  if (candidate.reviewState === "ready-for-human-review" && (!allAssessed || candidate.unresolvedQuestions.length > 0)) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready Prioritization candidates require all four dimension estimates and no unresolved questions" })
  }
})

export const prioritizationModelInputSchema = rejectSecrets(prioritizationModelInputBaseSchema)

export const prioritizationScoreCandidateSchema = z.object({
  sliceId: z.string().uuid(),
  sliceKey: identifierSchema,
  ordinal: z.number().int().positive().max(10_000),
  inputDigest: digestSchema,
  state: z.enum(["candidate-score", "not-assessed"]),
  score: z.number().min(0).max(100).multipleOf(0.0001).optional(),
  rank: z.number().int().positive().max(10_000).optional(),
}).strict().superRefine((candidate, context) => {
  if ((candidate.state === "candidate-score") !== (candidate.score !== undefined && candidate.rank !== undefined)) {
    context.addIssue({ code: "custom", message: "Candidate scores require a score and rank; not-assessed results must not invent either" })
  }
})

export const prioritizationModelSchema = prioritizationModelInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("prioritization-model-candidate"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  membershipDigest: digestSchema,
  methodDigest: digestSchema,
  rankingDigest: digestSchema,
  scoreCandidates: z.array(prioritizationScoreCandidateSchema).min(1).max(10_000),
  predecessorDigest: digestSchema.optional(),
  state: z.literal("candidate"),
  createdBy: humanActorSchema,
  updatedBy: humanActorSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  authorityBoundary: z.literal("prioritization-model-is-an-explainable-score-and-ordering-candidate-over-an-exact-mvp-slice-definition-not-evidence-validity-priority-commitment-scope-decision-approval-ready-done-implementation-readiness-assignment-execution-or-action-authority"),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Prioritization Model revisions after revision one require an exact predecessor digest" })
  }
  if (record.scoreCandidates.length !== record.subjects.length || record.scoreCandidates.some((score, index) =>
    score.sliceId !== record.subjects[index]?.sliceId || score.sliceKey !== record.subjects[index]?.sliceKey ||
    score.ordinal !== record.subjects[index]?.ordinal)) {
    context.addIssue({ code: "custom", path: ["scoreCandidates"], message: "Score candidates must retain the exact Prioritization subject inventory and ordering" })
  }
  const ranked = record.scoreCandidates.filter((score) => score.state === "candidate-score")
    .sort((left, right) => (left.rank ?? 0) - (right.rank ?? 0))
  if (ranked.some((score, index) => score.rank !== index + 1) || ranked.some((score, index) => {
    const next = ranked[index + 1]
    return next !== undefined && ((score.score ?? 0) < (next.score ?? 0) ||
      (score.score === next.score && score.ordinal > next.ordinal))
  })) {
    context.addIssue({ code: "custom", path: ["scoreCandidates"], message: "Candidate ranking must be contiguous and follow descending score with slice ordinal tie-breaking" })
  }
})

export const exactPrioritizationModelReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const prioritizationModelStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("prioritization-model-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactPrioritizationModelReferenceSchema.optional(),
  mvpSliceDefinition: exactMvpSliceDefinitionReferenceSchema.optional(),
  subjectCount: z.number().int().nonnegative().max(10_000),
  scoredSubjectCount: z.number().int().nonnegative().max(10_000),
  unassessedSubjectCount: z.number().int().nonnegative().max(10_000),
  evidenceReferenceCount: z.number().int().nonnegative().max(10_000_000),
  tieCount: z.number().int().nonnegative().max(10_000),
  staleBindingCount: z.number().int().nonnegative(),
  staleMvpSliceDefinitionCount: z.number().int().nonnegative().max(1),
  invalidSubjectCount: z.number().int().nonnegative().max(10_000),
  invalidScoreCount: z.number().int().nonnegative().max(10_000),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal("prioritization-model-status-is-observational-and-does-not-establish-evidence-validity-priority-commitment-scope-decision-approval-ready-done-implementation-readiness-assignment-execution-or-action-authority"),
}).strict().superRefine((status, context) => {
  if (status.scoredSubjectCount + status.unassessedSubjectCount !== status.subjectCount) {
    context.addIssue({ code: "custom", path: ["subjectCount"], message: "Prioritization scored and unassessed counts must reconcile" })
  }
  const gaps = status.unassessedSubjectCount + status.staleBindingCount + status.staleMvpSliceDefinitionCount +
    status.invalidSubjectCount + status.invalidScoreCount + status.unresolvedQuestionCount
  if (status.state === "complete-for-review" &&
      (gaps > 0 || !status.candidate || !status.mvpSliceDefinition || status.reviewState !== "ready-for-human-review" || status.reasons.length > 0)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires an exact fully scored Prioritization candidate with no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Prioritization status must expose reasons" })
  }
})

export const prioritizationModelProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("prioritization-model-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  }).strict(),
  status: prioritizationModelStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    membershipDigest: digestSchema, methodDigest: digestSchema, rankingDigest: digestSchema,
    state: z.literal("candidate"), subjectCount: z.number().int().nonnegative().max(10_000),
    scoredSubjectCount: z.number().int().nonnegative().max(10_000),
    evidenceReferenceCount: z.number().int().nonnegative().max(10_000_000),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal("projection-contains-record-identities-counts-statuses-method-membership-ranking-and-snapshot-digests-only-not-dimension-estimates-evidence-identities-uncertainty-slice-content-personal-data-secrets-credentials-or-machine-paths"),
  authorityBoundary: z.literal("prioritization-model-projection-is-read-only-and-does-not-establish-evidence-validity-priority-commitment-scope-decision-approval-ready-done-implementation-readiness-assignment-execution-or-action-authority"),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Prioritization Model projection must bind exact Product and Initiative revisions" })
  }
})

export type PrioritizationModelInput = z.infer<typeof prioritizationModelInputSchema>
export type PrioritizationModel = z.infer<typeof prioritizationModelSchema>
export type PrioritizationModelStatus = z.infer<typeof prioritizationModelStatusSchema>
export type PrioritizationModelProjection = z.infer<typeof prioritizationModelProjectionSchema>
