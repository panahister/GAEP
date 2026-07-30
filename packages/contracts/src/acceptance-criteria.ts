import { z } from "zod"

import {
  backlogHierarchyLevelSchema,
  exactBacklogHierarchyReferenceSchema,
  exactBacklogRequirementReferenceSchema,
} from "./backlog-hierarchy.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactMvpSliceDefinitionReferenceSchema } from "./mvp-slice-definition.js"
import { exactPrioritizationModelReferenceSchema } from "./prioritization-model.js"
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
    message: "Portable Acceptance Criteria candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalTextListSchema = z.array(shortTextSchema).max(512)
  .refine(unique, "Values must be unique")
  .refine(canonical, "Values must use canonical lexical ordering")

export const acceptanceVerificationMethodSchema = z.object({
  key: identifierSchema,
  kind: z.enum(["analysis", "automated-test", "demonstration", "inspection", "manual-test"]),
  state: z.enum(["candidate-defined", "not-assessed"]),
  evidenceReferences: z.array(z.object({
    kind: z.enum(["design", "example", "requirement", "risk", "source", "test"]),
    recordId: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
  }).strict()).max(256).refine((values) => unique(values.map((value) =>
    `${value.kind}:${value.recordId}:${value.revision}:${value.digest}`)), "Verification evidence references must be unique"),
}).strict()

const requirementReferencesSchema = z.array(exactBacklogRequirementReferenceSchema).min(1).max(256)
  .refine((values) => unique(values.map((value) => value.recordId)), "Criterion Requirement references must be unique")
  .refine((values) => canonical(values.map((value) => value.key)), "Criterion Requirement references must use canonical key ordering")

const verificationMethodKeysSchema = z.array(identifierSchema).min(1).max(64)
  .refine(unique, "Criterion verification-method references must be unique")
  .refine(canonical, "Criterion verification-method references must use canonical ordering")

export const acceptanceCriterionClassificationSchema = z.enum([
  "accessibility",
  "boundary",
  "functional-negative",
  "functional-positive",
  "non-functional",
  "privacy",
  "recovery",
])

export const acceptanceCriterionSchema = z.object({
  id: z.string().uuid(),
  key: identifierSchema,
  subjectNodeId: z.string().uuid(),
  subjectKey: identifierSchema,
  subjectLevel: backlogHierarchyLevelSchema.refine((level) => level === "story" || level === "task", "Acceptance Criteria subjects must be Story or Task nodes"),
  ordinal: z.number().int().positive().max(1_000_000),
  classification: acceptanceCriterionClassificationSchema,
  precondition: shortTextSchema,
  stimulus: shortTextSchema,
  expectedResult: shortTextSchema,
  requirements: requirementReferencesSchema,
  verificationMethodKeys: verificationMethodKeysSchema,
  testabilityState: z.enum(["candidate-testable", "not-assessed"]),
}).strict()

const acceptanceCriteriaInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  hierarchy: exactBacklogHierarchyReferenceSchema,
  mvpSliceDefinition: exactMvpSliceDefinitionReferenceSchema,
  prioritizationModel: exactPrioritizationModelReferenceSchema,
  verificationMethods: z.array(acceptanceVerificationMethodSchema).min(1).max(1_024),
  criteria: z.array(acceptanceCriterionSchema).min(1).max(100_000),
  criterionSetCompletenessState: z.enum(["candidate-complete", "not-assessed"]),
  requirementCoverageState: z.enum(["candidate-complete", "not-assessed"]),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  criterionValidityState: z.literal("not-established"),
  requirementSatisfactionState: z.literal("not-established"),
  priorityDecisionState: z.literal("not-established"),
  commitmentState: z.literal("not-established"),
  approvalState: z.literal("not-established"),
  readyDoneState: z.literal("not-established"),
  implementationReadinessState: z.literal("not-established"),
  assignmentExecutionState: z.literal("not-established"),
  acceptanceDecisionState: z.literal("not-established"),
  implementationAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  const methodKeys = candidate.verificationMethods.map((method) => method.key)
  if (!unique(methodKeys)) context.addIssue({ code: "custom", path: ["verificationMethods"], message: "Verification method keys must be unique" })
  if (!canonical(methodKeys)) context.addIssue({ code: "custom", path: ["verificationMethods"], message: "Verification methods must use canonical key ordering" })
  const criterionIds = candidate.criteria.map((criterion) => criterion.id)
  const criterionKeys = candidate.criteria.map((criterion) => criterion.key)
  if (!unique(criterionIds) || !unique(criterionKeys)) {
    context.addIssue({ code: "custom", path: ["criteria"], message: "Acceptance Criterion identities and keys must be unique" })
  }
  const availableMethods = new Map(candidate.verificationMethods.map((method) => [method.key, method]))
  for (const [index, criterion] of candidate.criteria.entries()) {
    if (criterion.ordinal !== index + 1) {
      context.addIssue({ code: "custom", path: ["criteria", index, "ordinal"], message: "Acceptance Criteria must use contiguous canonical ordinal ordering" })
    }
    const methods = criterion.verificationMethodKeys.map((key) => availableMethods.get(key))
    if (methods.some((method) => !method)) {
      context.addIssue({ code: "custom", path: ["criteria", index, "verificationMethodKeys"], message: "Acceptance Criteria must reference declared verification methods" })
    }
    if (criterion.testabilityState === "candidate-testable" && methods.some((method) => method?.state !== "candidate-defined")) {
      context.addIssue({ code: "custom", path: ["criteria", index, "testabilityState"], message: "Candidate-testable criteria require candidate-defined verification methods" })
    }
  }
  if (candidate.reviewState === "ready-for-human-review" &&
      (candidate.criterionSetCompletenessState !== "candidate-complete" ||
       candidate.requirementCoverageState !== "candidate-complete" ||
       candidate.unresolvedQuestions.length > 0 ||
       candidate.criteria.some((criterion) => criterion.testabilityState !== "candidate-testable"))) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready Acceptance Criteria require candidate-complete criterion and Requirement coverage, candidate-testable criteria, and no unresolved questions" })
  }
})

export const acceptanceCriteriaInputSchema = rejectSecrets(acceptanceCriteriaInputBaseSchema)

export const acceptanceCriteriaSchema = acceptanceCriteriaInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("acceptance-criteria-candidate"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  subjectCatalogDigest: digestSchema,
  criterionCatalogDigest: digestSchema,
  verificationMethodCatalogDigest: digestSchema,
  coverageDigest: digestSchema,
  predecessorDigest: digestSchema.optional(),
  state: z.literal("candidate"),
  createdBy: humanActorSchema,
  updatedBy: humanActorSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  authorityBoundary: z.literal("acceptance-criteria-is-a-versioned-structured-candidate-over-exact-mvp-story-task-and-requirement-traces-not-criterion-validity-completeness-requirement-satisfaction-priority-commitment-approval-ready-done-implementation-readiness-assignment-execution-acceptance-or-action-authority"),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Acceptance Criteria revisions after revision one require an exact predecessor digest" })
  }
})

export const exactAcceptanceCriteriaReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const acceptanceCriteriaStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("acceptance-criteria-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactAcceptanceCriteriaReferenceSchema.optional(),
  hierarchy: exactBacklogHierarchyReferenceSchema.optional(),
  mvpSliceDefinition: exactMvpSliceDefinitionReferenceSchema.optional(),
  prioritizationModel: exactPrioritizationModelReferenceSchema.optional(),
  subjectCount: z.number().int().nonnegative().max(10_000),
  coveredSubjectCount: z.number().int().nonnegative().max(10_000),
  uncoveredSubjectCount: z.number().int().nonnegative().max(10_000),
  criterionCount: z.number().int().nonnegative().max(100_000),
  testableCriterionCount: z.number().int().nonnegative().max(100_000),
  unassessedCriterionCount: z.number().int().nonnegative().max(100_000),
  requirementTraceCount: z.number().int().nonnegative().max(1_000_000),
  uncoveredRequirementCount: z.number().int().nonnegative().max(1_000_000),
  verificationMethodCount: z.number().int().nonnegative().max(1_024),
  staleBindingCount: z.number().int().nonnegative().max(1),
  staleHierarchyCount: z.number().int().nonnegative().max(1),
  staleMvpSliceDefinitionCount: z.number().int().nonnegative().max(1),
  stalePrioritizationModelCount: z.number().int().nonnegative().max(1),
  invalidCriterionCount: z.number().int().nonnegative().max(100_000),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  criterionSetCompletenessState: z.enum(["candidate-complete", "not-assessed"]),
  requirementCoverageState: z.enum(["candidate-complete", "not-assessed"]),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal("acceptance-criteria-status-is-observational-and-does-not-establish-criterion-validity-completeness-requirement-satisfaction-priority-commitment-approval-ready-done-implementation-readiness-assignment-execution-acceptance-or-action-authority"),
}).strict().superRefine((status, context) => {
  if (status.coveredSubjectCount + status.uncoveredSubjectCount !== status.subjectCount ||
      status.testableCriterionCount + status.unassessedCriterionCount !== status.criterionCount) {
    context.addIssue({ code: "custom", path: ["subjectCount"], message: "Acceptance Criteria coverage and testability counts must reconcile" })
  }
  const gaps = status.uncoveredSubjectCount + status.uncoveredRequirementCount + status.staleBindingCount +
    status.staleHierarchyCount + status.staleMvpSliceDefinitionCount + status.stalePrioritizationModelCount +
    status.invalidCriterionCount + status.unassessedCriterionCount + status.unresolvedQuestionCount
  if (status.state === "complete-for-review" &&
      (gaps > 0 || !status.candidate || !status.hierarchy || !status.mvpSliceDefinition || !status.prioritizationModel ||
       status.criterionSetCompletenessState !== "candidate-complete" || status.requirementCoverageState !== "candidate-complete" ||
       status.reviewState !== "ready-for-human-review" || status.reasons.length > 0)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires exact review-ready Acceptance Criteria with full candidate coverage and no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Acceptance Criteria status must expose reasons" })
  }
})

export const acceptanceCriteriaProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("acceptance-criteria-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  }).strict(),
  status: acceptanceCriteriaStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.literal("candidate"), subjectCatalogDigest: digestSchema, criterionCatalogDigest: digestSchema,
    verificationMethodCatalogDigest: digestSchema, coverageDigest: digestSchema,
    subjectCount: z.number().int().nonnegative().max(10_000),
    criterionCount: z.number().int().nonnegative().max(100_000),
    testableCriterionCount: z.number().int().nonnegative().max(100_000),
    requirementTraceCount: z.number().int().nonnegative().max(1_000_000),
    verificationMethodCount: z.number().int().nonnegative().max(1_024),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal("projection-contains-record-identities-counts-statuses-and-subject-criterion-method-coverage-snapshot-digests-only-not-criterion-text-requirement-identities-verification-evidence-personal-data-secrets-credentials-or-machine-paths"),
  authorityBoundary: z.literal("acceptance-criteria-projection-is-read-only-and-does-not-establish-criterion-validity-completeness-requirement-satisfaction-priority-commitment-approval-ready-done-implementation-readiness-assignment-execution-acceptance-or-action-authority"),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Acceptance Criteria projection must bind exact Product and Initiative revisions" })
  }
})

export type AcceptanceCriteriaInput = z.infer<typeof acceptanceCriteriaInputSchema>
export type AcceptanceCriteria = z.infer<typeof acceptanceCriteriaSchema>
export type AcceptanceCriteriaStatus = z.infer<typeof acceptanceCriteriaStatusSchema>
export type AcceptanceCriteriaProjection = z.infer<typeof acceptanceCriteriaProjectionSchema>
export type ExactAcceptanceCriteriaReference = z.infer<typeof exactAcceptanceCriteriaReferenceSchema>
