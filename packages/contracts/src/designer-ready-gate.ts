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
  .refine((entries) => unique(entries.map((entry) =>
    `${entry.sourceId}:${entry.sourceRevision}:${entry.recordDigest}:${entry.contentDigest}`)), "Source references must be unique")

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Designer-Ready Gate candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const designerReadyPrerequisiteKinds = {
  "accessibility-design-rules": "accessibility-design-rules-candidate",
  "decision-register": "decision-register-candidate",
  "design-applicability": "design-applicability-candidate",
  "design-personas-roles": "design-persona-role-model-candidate",
  "design-requirements": "design-requirements-candidate",
  "design-system-token-contract": "design-system-token-contract-candidate",
  "figma-mcp-capability-discovery": "figma-mcp-capability-discovery-candidate",
  "information-architecture": "information-architecture-model-candidate",
  "manual-figma-execution-path": "manual-figma-execution-path-candidate",
  "responsive-multi-platform-targets": "responsive-multi-platform-targets-candidate",
  "screen-state-inventory": "screen-state-inventory-candidate",
  "user-journeys": "user-journey-model-candidate",
} as const

export const designerReadyPrerequisiteKeys = Object.keys(designerReadyPrerequisiteKinds).sort() as [
  keyof typeof designerReadyPrerequisiteKinds,
  ...(keyof typeof designerReadyPrerequisiteKinds)[],
]
export const designerReadyPrerequisiteKeySchema = z.enum(designerReadyPrerequisiteKeys)

export const exactDesignerReadyPrerequisiteSchema = z.object({
  key: designerReadyPrerequisiteKeySchema,
  kind: z.enum(Object.values(designerReadyPrerequisiteKinds) as [
    (typeof designerReadyPrerequisiteKinds)[keyof typeof designerReadyPrerequisiteKinds],
    ...((typeof designerReadyPrerequisiteKinds)[keyof typeof designerReadyPrerequisiteKinds])[],
  ]),
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
  membershipDigest: digestSchema,
  assessmentDigest: digestSchema,
  assessmentState: z.enum(["attention-required", "complete-for-review"]),
}).strict().superRefine((value, context) => {
  if (designerReadyPrerequisiteKinds[value.key] !== value.kind) {
    context.addIssue({ code: "custom", path: ["kind"], message: "Designer-Ready prerequisite kind must match its canonical key" })
  }
})

export const designerReadyEvaluationSchema = z.object({
  prerequisiteKey: designerReadyPrerequisiteKeySchema,
  evaluationState: z.enum(["not-applicable-candidate", "not-assessed", "satisfied-candidate", "unsatisfied"]),
  freshness: z.enum(["current", "stale", "unknown"]),
  evidenceState: z.enum(["disputed", "human-reviewed", "not-assessed", "source-recorded"]),
  criteriaDigest: digestSchema,
  evidenceDigests: canonicalDigestsSchema,
  sources: exactSourceListSchema,
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
}).strict().superRefine((evaluation, context) => {
  const reviewed = evaluation.evidenceState === "human-reviewed"
  if (reviewed !== (evaluation.evidenceDigests.length > 0 && evaluation.reviewedBy !== undefined && evaluation.reviewedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Human-reviewed gate evaluations require exact evidence, reviewer, and time; other states forbid review attribution" })
  }
  if (["satisfied-candidate", "not-applicable-candidate"].includes(evaluation.evaluationState) &&
      (!reviewed || evaluation.freshness !== "current")) {
    context.addIssue({ code: "custom", message: "Positive and not-applicable gate evaluations require current human-reviewed evidence" })
  }
})

export const designerReadyExceptionSchema = z.object({
  key: identifierSchema,
  prerequisiteKey: designerReadyPrerequisiteKeySchema,
  state: z.enum(["expired", "granted-candidate", "pending", "rejected", "revoked"]),
  decisionKey: identifierSchema,
  rationaleDigest: digestSchema,
  evidenceDigests: canonicalDigestsSchema,
  sources: exactSourceListSchema,
  decidedBy: humanActorSchema.optional(),
  decidedAt: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
}).strict().superRefine((exception, context) => {
  const granted = exception.state === "granted-candidate"
  if (granted !== (exception.evidenceDigests.length > 0 && exception.decidedBy !== undefined &&
      exception.decidedAt !== undefined && exception.validUntil !== undefined)) {
    context.addIssue({ code: "custom", message: "Granted exception candidates require exact evidence, attributable decision, and bounded validity; other states forbid those fields" })
  }
})

const designerReadyGateInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  objectiveDigest: digestSchema,
  prerequisites: z.array(exactDesignerReadyPrerequisiteSchema).length(designerReadyPrerequisiteKeys.length)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Prerequisite keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Prerequisites must use canonical key ordering"),
  evaluations: z.array(designerReadyEvaluationSchema).length(designerReadyPrerequisiteKeys.length)
    .refine((entries) => unique(entries.map((entry) => entry.prerequisiteKey)), "Evaluation prerequisite keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.prerequisiteKey)), "Evaluations must use canonical prerequisite ordering"),
  exceptions: z.array(designerReadyExceptionSchema).max(512)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Exception keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Exceptions must use canonical key ordering"),
  assessmentDefinitionDigest: digestSchema,
  assessmentReceiptDigest: digestSchema,
  candidateResult: z.enum(["blocked", "conditional-pass-candidate", "incomplete", "not-applicable-candidate", "pass-candidate"]),
  unresolvedQuestions: canonicalTextSchema,
  limitations: canonicalTextSchema.refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-decision"]),
  designCompletenessState: z.literal("not-established"),
  externalCompletenessState: z.literal("not-established"),
  designValidityState: z.literal("not-established"),
  designApprovalState: z.literal("not-established"),
  designBaselineState: z.literal("not-established"),
  readinessState: z.literal("not-established"),
  exceptionAuthorityState: z.literal("not-granted"),
  figmaConnectionAuthorityState: z.literal("not-granted"),
  credentialAuthorityState: z.literal("not-granted"),
  permissionGrantState: z.literal("not-granted"),
  importExecutionState: z.literal("not-performed"),
  writeExecutionState: z.literal("not-performed"),
  implementationAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  const expected = designerReadyPrerequisiteKeys.join("|")
  if (candidate.prerequisites.map((entry) => entry.key).join("|") !== expected ||
      candidate.evaluations.map((entry) => entry.prerequisiteKey).join("|") !== expected) {
    context.addIssue({ code: "custom", message: "Designer-Ready Gate must evaluate every canonical prerequisite exactly once" })
  }
  const prerequisiteByKey = new Map(candidate.prerequisites.map((entry) => [entry.key, entry]))
  for (const evaluation of candidate.evaluations) {
    const prerequisite = prerequisiteByKey.get(evaluation.prerequisiteKey)
    if (prerequisite?.assessmentState !== "complete-for-review" &&
        ["satisfied-candidate", "not-applicable-candidate"].includes(evaluation.evaluationState)) {
      context.addIssue({ code: "custom", path: ["evaluations"], message: "Positive gate evaluations require a complete current prerequisite assessment" })
    }
  }
  const grantedExceptions = candidate.exceptions.filter((entry) => entry.state === "granted-candidate")
  const pendingExceptions = candidate.exceptions.filter((entry) => entry.state === "pending")
  const evaluationsComplete = candidate.evaluations.every((entry) =>
    ["satisfied-candidate", "not-applicable-candidate"].includes(entry.evaluationState) &&
    entry.freshness === "current" && entry.evidenceState === "human-reviewed")
  const passLike = ["conditional-pass-candidate", "not-applicable-candidate", "pass-candidate"].includes(candidate.candidateResult)
  if (passLike && (!evaluationsComplete || pendingExceptions.length > 0 || candidate.unresolvedQuestions.length > 0 ||
      candidate.reviewState !== "ready-for-human-decision")) {
    context.addIssue({ code: "custom", path: ["candidateResult"], message: "Pass-like gate candidates require exact current human-reviewed evaluations, no pending exception or question, and human-decision review state" })
  }
  if (candidate.candidateResult === "pass-candidate" && grantedExceptions.length > 0) {
    context.addIssue({ code: "custom", path: ["candidateResult"], message: "An unconditional pass candidate cannot depend on exception candidates" })
  }
  if (candidate.candidateResult === "conditional-pass-candidate" && grantedExceptions.length === 0) {
    context.addIssue({ code: "custom", path: ["candidateResult"], message: "A conditional pass candidate requires at least one bounded granted exception candidate" })
  }
  if (candidate.candidateResult === "not-applicable-candidate" &&
      candidate.evaluations.find((entry) => entry.prerequisiteKey === "design-applicability")?.evaluationState !== "not-applicable-candidate") {
    context.addIssue({ code: "custom", path: ["candidateResult"], message: "Not-applicable gate candidates require a human-reviewed Design Applicability non-applicability evaluation" })
  }
})

export const designerReadyGateInputSchema = rejectSecrets(designerReadyGateInputBaseSchema)

export const designerReadyGateSchema = designerReadyGateInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("designer-ready-gate-candidate"),
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
  gateBoundary: z.literal("a-passing-designer-ready-gate-candidate-is-an-evaluation-result-not-permission-or-readiness"),
  authorityBoundary: z.literal("designer-ready-gate-is-a-candidate-evaluation-and-does-not-establish-design-completeness-external-completeness-design-validity-approval-baseline-readiness-exception-waiver-acceptance-phase-entry-implementation-write-import-or-action-authority"),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Designer-Ready Gate revisions after revision one require an exact predecessor digest" })
  }
})

export const exactDesignerReadyGateReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const designerReadyGateStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("designer-ready-gate-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactDesignerReadyGateReferenceSchema.optional(),
  prerequisiteCount: z.number().int().nonnegative().max(designerReadyPrerequisiteKeys.length),
  satisfiedCount: z.number().int().nonnegative().max(designerReadyPrerequisiteKeys.length),
  notApplicableCount: z.number().int().nonnegative().max(designerReadyPrerequisiteKeys.length),
  unsatisfiedCount: z.number().int().nonnegative().max(designerReadyPrerequisiteKeys.length),
  notAssessedCount: z.number().int().nonnegative().max(designerReadyPrerequisiteKeys.length),
  staleOrUnknownCount: z.number().int().nonnegative().max(designerReadyPrerequisiteKeys.length),
  humanReviewedCount: z.number().int().nonnegative().max(designerReadyPrerequisiteKeys.length),
  pendingExceptionCount: z.number().int().nonnegative().max(512),
  grantedExceptionCandidateCount: z.number().int().nonnegative().max(512),
  invalidExceptionCount: z.number().int().nonnegative().max(512),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  candidateResult: z.enum(["blocked", "conditional-pass-candidate", "incomplete", "not-applicable-candidate", "not-assessed", "pass-candidate"]),
  reviewState: z.enum(["draft", "held", "ready-for-human-decision"]),
  state: z.enum(["attention-required", "complete-for-human-decision"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  gateBoundary: z.literal("a-passing-designer-ready-gate-candidate-is-an-evaluation-result-not-permission-or-readiness"),
  authorityBoundary: z.literal("designer-ready-gate-status-is-observational-and-does-not-establish-design-completeness-external-completeness-design-validity-approval-baseline-readiness-exception-waiver-acceptance-phase-entry-implementation-write-import-or-action-authority"),
}).strict().superRefine((status, context) => {
  const complete = ["conditional-pass-candidate", "not-applicable-candidate", "pass-candidate"].includes(status.candidateResult)
  if (status.state === "complete-for-human-decision" && (!complete || !status.candidate || status.reasons.length > 0 ||
      status.prerequisiteCount !== designerReadyPrerequisiteKeys.length ||
      status.satisfiedCount + status.notApplicableCount !== designerReadyPrerequisiteKeys.length ||
      status.staleOrUnknownCount + status.staleBindingCount + status.staleSourceReferenceCount +
      status.pendingExceptionCount + status.invalidExceptionCount + status.unresolvedQuestionCount > 0 ||
      status.humanReviewedCount !== designerReadyPrerequisiteKeys.length || status.reviewState !== "ready-for-human-decision")) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-human-decision requires an exact current pass-like candidate with no declared gap" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Designer-Ready status must expose reasons" })
  }
})

export const designerReadyGateProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("designer-ready-gate-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]) }).strict(),
  status: designerReadyGateStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, membershipDigest: digestSchema,
    state: z.literal("candidate"), prerequisiteCount: z.literal(designerReadyPrerequisiteKeys.length),
    prerequisiteCatalogDigest: digestSchema, evaluationCatalogDigest: digestSchema, exceptionCatalogDigest: digestSchema,
    assessmentDefinitionDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    candidateResult: z.enum(["blocked", "conditional-pass-candidate", "incomplete", "not-applicable-candidate", "pass-candidate"]),
    reviewState: z.enum(["draft", "held", "ready-for-human-decision"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal("projection-contains-record-identities-counts-results-and-digests-only-not-design-content-criteria-findings-exception-rationale-decision-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions"),
  authorityBoundary: z.literal("designer-ready-gate-projection-is-read-only-and-does-not-establish-design-completeness-external-completeness-design-validity-approval-baseline-readiness-exception-waiver-acceptance-phase-entry-implementation-write-import-or-action-authority"),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Designer-Ready Gate projection must bind exact Product and Initiative revisions" })
  }
})

export type DesignerReadyPrerequisiteKey = z.infer<typeof designerReadyPrerequisiteKeySchema>
export type ExactDesignerReadyPrerequisite = z.infer<typeof exactDesignerReadyPrerequisiteSchema>
export type DesignerReadyGateInput = z.infer<typeof designerReadyGateInputSchema>
export type DesignerReadyGate = z.infer<typeof designerReadyGateSchema>
export type DesignerReadyGateStatus = z.infer<typeof designerReadyGateStatusSchema>
export type DesignerReadyGateProjection = z.infer<typeof designerReadyGateProjectionSchema>
