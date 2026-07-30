import { z } from "zod"

import { exactAcceptanceCriteriaReferenceSchema } from "./acceptance-criteria.js"
import {
  backlogHierarchyLevelSchema,
  exactBacklogHierarchyReferenceSchema,
} from "./backlog-hierarchy.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactDefinitionOfReadyReferenceSchema } from "./definition-of-ready.js"
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
    message: "Portable Definition of Done candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalTextListSchema = z.array(shortTextSchema).max(512)
  .refine(unique, "Values must be unique")
  .refine(canonical, "Values must use canonical lexical ordering")

export const definitionOfDonePrerequisiteKindSchema = z.enum([
  "acceptance-criteria-satisfaction",
  "approval-candidate",
  "code-review",
  "documentation",
  "evidence",
  "implementation",
  "observability",
  "quality",
  "requirement-satisfaction",
  "risk",
  "security",
  "test",
])

export const definitionOfDoneEvidenceReferenceSchema = z.object({
  kind: z.enum([
    "acceptance-criteria",
    "approval",
    "code-review",
    "documentation",
    "evidence",
    "implementation",
    "observability",
    "quality",
    "requirement",
    "risk",
    "security",
    "test",
  ]),
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

export const definitionOfDonePolicyEntrySchema = z.object({
  key: identifierSchema,
  kind: definitionOfDonePrerequisiteKindSchema,
  title: z.string().trim().min(2).max(240),
  rule: shortTextSchema,
  notApplicableAllowed: z.boolean(),
  evidenceRequired: z.boolean(),
}).strict()

export const definitionOfDoneItemEvaluationSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(1_000_000),
  subjectNodeId: z.string().uuid(),
  subjectKey: identifierSchema,
  subjectLevel: backlogHierarchyLevelSchema.refine(
    (level) => level === "story" || level === "task",
    "Definition of Done subjects must be Story or Task nodes",
  ),
  prerequisiteKey: identifierSchema,
  applicability: z.enum(["not-applicable-candidate", "required"]),
  assessmentState: z.enum([
    "candidate-not-satisfied",
    "candidate-satisfied",
    "exception-candidate",
    "invalid",
    "not-assessed",
    "stale",
  ]),
  rationale: shortTextSchema,
  evidenceReferences: z.array(definitionOfDoneEvidenceReferenceSchema).max(256)
    .refine((values) => unique(values.map((value) =>
      `${value.kind}:${value.recordId}:${value.revision}:${value.digest}`)), "Done evaluation evidence references must be unique"),
  assessedBy: humanActorSchema,
  assessedAt: z.string().datetime(),
}).strict()

const definitionOfDoneInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  hierarchy: exactBacklogHierarchyReferenceSchema,
  mvpSliceDefinition: exactMvpSliceDefinitionReferenceSchema,
  prioritizationModel: exactPrioritizationModelReferenceSchema,
  acceptanceCriteria: exactAcceptanceCriteriaReferenceSchema,
  definitionOfReady: exactDefinitionOfReadyReferenceSchema,
  policyVersion: z.number().int().positive(),
  policyEntries: z.array(definitionOfDonePolicyEntrySchema).min(1).max(1_024),
  itemEvaluations: z.array(definitionOfDoneItemEvaluationSchema).min(1).max(100_000),
  validUntil: z.string().datetime(),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  evidenceTruthState: z.literal("not-established"),
  testResultState: z.literal("not-established"),
  qualityState: z.literal("not-established"),
  requirementSatisfactionState: z.literal("not-established"),
  acceptanceCriteriaSatisfactionState: z.literal("not-established"),
  approvalState: z.literal("not-established"),
  readyDoneState: z.literal("not-established"),
  exceptionWaiverAuthorityState: z.literal("not-established"),
  implementationCompletenessState: z.literal("not-established"),
  mergeReadinessState: z.literal("not-established"),
  releaseReadinessState: z.literal("not-established"),
  deploymentReadinessState: z.literal("not-established"),
  assignmentExecutionState: z.literal("not-established"),
  acceptanceDecisionState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  const policyKeys = candidate.policyEntries.map((entry) => entry.key)
  if (!unique(policyKeys)) context.addIssue({ code: "custom", path: ["policyEntries"], message: "Definition of Done policy keys must be unique" })
  if (!canonical(policyKeys)) context.addIssue({ code: "custom", path: ["policyEntries"], message: "Definition of Done policy entries must use canonical key ordering" })
  const policyByKey = new Map(candidate.policyEntries.map((entry) => [entry.key, entry]))
  const identities = candidate.itemEvaluations.map((entry) => entry.id)
  const pairs = candidate.itemEvaluations.map((entry) => `${entry.subjectNodeId}:${entry.prerequisiteKey}`)
  if (!unique(identities) || !unique(pairs)) {
    context.addIssue({ code: "custom", path: ["itemEvaluations"], message: "Done evaluation identities and subject-prerequisite pairs must be unique" })
  }
  for (const [index, evaluation] of candidate.itemEvaluations.entries()) {
    if (evaluation.ordinal !== index + 1) {
      context.addIssue({ code: "custom", path: ["itemEvaluations", index, "ordinal"], message: "Done evaluations must use contiguous canonical ordinal ordering" })
    }
    const policy = policyByKey.get(evaluation.prerequisiteKey)
    if (!policy) {
      context.addIssue({ code: "custom", path: ["itemEvaluations", index, "prerequisiteKey"], message: "Done evaluations must reference a declared policy prerequisite" })
      continue
    }
    if (evaluation.applicability === "not-applicable-candidate" && !policy.notApplicableAllowed) {
      context.addIssue({ code: "custom", path: ["itemEvaluations", index, "applicability"], message: "The policy does not allow a not-applicable candidate disposition" })
    }
    if (evaluation.applicability === "not-applicable-candidate" && evaluation.assessmentState !== "candidate-satisfied") {
      context.addIssue({ code: "custom", path: ["itemEvaluations", index, "assessmentState"], message: "A not-applicable candidate disposition must be explicitly assessed as candidate-satisfied" })
    }
    if (evaluation.applicability === "required" && evaluation.assessmentState === "candidate-satisfied" &&
        policy.evidenceRequired && evaluation.evidenceReferences.length === 0) {
      context.addIssue({ code: "custom", path: ["itemEvaluations", index, "evidenceReferences"], message: "Candidate-satisfied required completion prerequisites must carry exact evidence when policy requires it" })
    }
  }
  if (candidate.reviewState === "ready-for-human-review" &&
      (candidate.unresolvedQuestions.length > 0 || candidate.itemEvaluations.some((evaluation) =>
        evaluation.assessmentState !== "candidate-satisfied"))) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready Definition of Done requires candidate-satisfied evaluations and no unresolved questions" })
  }
})

export const definitionOfDoneInputSchema = rejectSecrets(definitionOfDoneInputBaseSchema)

export const definitionOfDoneSchema = definitionOfDoneInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("definition-of-done-candidate"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  subjectCatalogDigest: digestSchema,
  policyDigest: digestSchema,
  evaluationDigest: digestSchema,
  receiptDigest: digestSchema,
  predecessorDigest: digestSchema.optional(),
  state: z.literal("candidate"),
  createdBy: humanActorSchema,
  updatedBy: humanActorSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  gateBoundary: z.literal("a-passing-definition-of-done-candidate-is-an-evaluation-result-not-completion-acceptance-approval-merge-release-deployment-or-action-permission"),
  authorityBoundary: z.literal("definition-of-done-is-a-versioned-item-evaluation-candidate-and-does-not-establish-evidence-truth-test-success-quality-requirement-satisfaction-acceptance-criteria-satisfaction-approval-ready-done-exception-waiver-authority-implementation-completeness-merge-readiness-release-readiness-deployment-readiness-assignment-execution-acceptance-or-action-authority"),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Definition of Done revisions after revision one require an exact predecessor digest" })
  }
})

export const exactDefinitionOfDoneReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const definitionOfDoneStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("definition-of-done-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactDefinitionOfDoneReferenceSchema.optional(),
  hierarchy: exactBacklogHierarchyReferenceSchema.optional(),
  mvpSliceDefinition: exactMvpSliceDefinitionReferenceSchema.optional(),
  prioritizationModel: exactPrioritizationModelReferenceSchema.optional(),
  acceptanceCriteria: exactAcceptanceCriteriaReferenceSchema.optional(),
  definitionOfReady: exactDefinitionOfReadyReferenceSchema.optional(),
  subjectCount: z.number().int().nonnegative().max(10_000),
  policyEntryCount: z.number().int().nonnegative().max(1_024),
  expectedEvaluationCount: z.number().int().nonnegative().max(10_000_000),
  evaluationCount: z.number().int().nonnegative().max(100_000),
  candidateSatisfiedCount: z.number().int().nonnegative().max(100_000),
  notSatisfiedCount: z.number().int().nonnegative().max(100_000),
  notApplicableCount: z.number().int().nonnegative().max(100_000),
  exceptionCandidateCount: z.number().int().nonnegative().max(100_000),
  notAssessedCount: z.number().int().nonnegative().max(100_000),
  staleEvaluationCount: z.number().int().nonnegative().max(100_000),
  invalidEvaluationCount: z.number().int().nonnegative().max(100_000),
  missingEvaluationCount: z.number().int().nonnegative().max(10_000_000),
  staleBindingCount: z.number().int().nonnegative().max(1),
  staleHierarchyCount: z.number().int().nonnegative().max(1),
  staleMvpSliceDefinitionCount: z.number().int().nonnegative().max(1),
  stalePrioritizationModelCount: z.number().int().nonnegative().max(1),
  staleAcceptanceCriteriaCount: z.number().int().nonnegative().max(1),
  staleDefinitionOfReadyCount: z.number().int().nonnegative().max(1),
  expiredCount: z.number().int().nonnegative().max(1),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  result: z.enum(["attention-required", "candidate-passed"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  gateBoundary: z.literal("a-passing-definition-of-done-candidate-is-an-evaluation-result-not-completion-acceptance-approval-merge-release-deployment-or-action-permission"),
  authorityBoundary: z.literal("definition-of-done-status-is-observational-and-does-not-establish-evidence-truth-test-success-quality-requirement-satisfaction-acceptance-criteria-satisfaction-approval-ready-done-exception-waiver-authority-implementation-completeness-merge-readiness-release-readiness-deployment-readiness-assignment-execution-acceptance-or-action-authority"),
}).strict().superRefine((status, context) => {
  if (status.candidateSatisfiedCount + status.notSatisfiedCount + status.exceptionCandidateCount +
      status.notAssessedCount + status.staleEvaluationCount + status.invalidEvaluationCount !== status.evaluationCount) {
    context.addIssue({ code: "custom", path: ["evaluationCount"], message: "Definition of Done evaluation counts must reconcile" })
  }
  const gaps = status.notSatisfiedCount + status.exceptionCandidateCount + status.notAssessedCount +
    status.staleEvaluationCount + status.invalidEvaluationCount + status.missingEvaluationCount + status.staleBindingCount +
    status.staleHierarchyCount + status.staleMvpSliceDefinitionCount + status.stalePrioritizationModelCount +
    status.staleAcceptanceCriteriaCount + status.staleDefinitionOfReadyCount + status.expiredCount + status.unresolvedQuestionCount
  if (status.result === "candidate-passed" &&
      (gaps > 0 || !status.candidate || !status.hierarchy || !status.mvpSliceDefinition ||
       !status.prioritizationModel || !status.acceptanceCriteria || !status.definitionOfReady ||
       status.reviewState !== "ready-for-human-review" || status.reasons.length > 0 ||
       status.evaluationCount !== status.expectedEvaluationCount)) {
    context.addIssue({ code: "custom", path: ["result"], message: "Candidate-passed requires exact current dependencies, complete evaluations, review state, and no declared gaps" })
  }
  if (status.result === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Definition of Done status must expose reasons" })
  }
})

export const definitionOfDoneProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("definition-of-done-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  }).strict(),
  status: definitionOfDoneStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.literal("candidate"), policyVersion: z.number().int().positive(), validUntil: z.string().datetime(),
    subjectCatalogDigest: digestSchema, policyDigest: digestSchema, evaluationDigest: digestSchema, receiptDigest: digestSchema,
    subjectCount: z.number().int().nonnegative().max(10_000),
    policyEntryCount: z.number().int().nonnegative().max(1_024),
    evaluationCount: z.number().int().nonnegative().max(100_000),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal("projection-contains-record-identities-counts-statuses-and-policy-evaluation-receipt-snapshot-digests-only-not-rules-rationales-evidence-identities-assessor-identities-personal-data-secrets-credentials-or-machine-paths"),
  gateBoundary: z.literal("a-passing-definition-of-done-candidate-is-an-evaluation-result-not-completion-acceptance-approval-merge-release-deployment-or-action-permission"),
  authorityBoundary: z.literal("definition-of-done-projection-is-read-only-and-does-not-establish-evidence-truth-test-success-quality-requirement-satisfaction-acceptance-criteria-satisfaction-approval-ready-done-exception-waiver-authority-implementation-completeness-merge-readiness-release-readiness-deployment-readiness-assignment-execution-acceptance-or-action-authority"),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Definition of Done projection must bind exact Product and Initiative revisions" })
  }
})

export type DefinitionOfDoneInput = z.infer<typeof definitionOfDoneInputSchema>
export type DefinitionOfDone = z.infer<typeof definitionOfDoneSchema>
export type DefinitionOfDoneStatus = z.infer<typeof definitionOfDoneStatusSchema>
export type DefinitionOfDoneProjection = z.infer<typeof definitionOfDoneProjectionSchema>
