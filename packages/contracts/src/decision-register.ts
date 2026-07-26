import { z } from "zod"

import { exactArchitectureChallengeModelReferenceSchema } from "./architecture-challenge-model.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactOperatingModelReferenceSchema } from "./operating-model.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactSourceReferenceSchema } from "./source-governance.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const longTextSchema = z.string().trim().min(10).max(20_000)
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function canonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}

function canonicalArray<T extends z.ZodType>(schema: T, maximum = 4_096) {
  return z.array(schema).max(maximum)
    .refine((values) => unique(values as string[]), "Values must be unique")
    .refine((values) => canonical(values as string[]), "Values must use canonical lexical ordering")
}

const canonicalIdentifierListSchema = canonicalArray(identifierSchema)
const requiredCanonicalIdentifierListSchema = canonicalIdentifierListSchema.refine(
  (values) => values.length > 0,
  "At least one identifier is required",
)
const canonicalTextListSchema = canonicalArray(shortTextSchema, 512)
const requiredCanonicalTextListSchema = canonicalTextListSchema.refine(
  (values) => values.length > 0,
  "At least one value is required",
)

const exactSourceListSchema = z.array(exactSourceReferenceSchema).max(256)
  .refine(
    (references) => unique(references.map((reference) =>
      `${reference.sourceId}:${reference.sourceRevision}:${reference.recordDigest}:${reference.contentDigest}`)),
    "Exact Source references must be unique",
  )
  .superRefine((references, context) => {
    const ordered = [...references].sort((left, right) =>
      left.sourceId.localeCompare(right.sourceId) || left.sourceRevision - right.sourceRevision)
    if (references.some((reference, index) =>
      reference.sourceId !== ordered[index]?.sourceId || reference.sourceRevision !== ordered[index]?.sourceRevision)) {
      context.addIssue({ code: "custom", message: "Exact Source references must use canonical identity ordering" })
    }
  })

const requiredExactSourceListSchema = exactSourceListSchema.refine(
  (references) => references.length > 0,
  "Decision claims require at least one exact Source reference",
)

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Decision Register candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const decisionRegisterRequirementIds = [
  "GAEP-DRAA-REQ-001",
  "GAEP-DRAA-REQ-003",
  "GAEP-DRAA-REQ-004",
  "GAEP-DRAA-REQ-005",
  "GAEP-DRAA-REQ-006",
  "GAEP-DRAA-REQ-009",
  "GAEP-DRAA-REQ-017",
  "GAEP-DRAA-REQ-029",
  "GAEP-DRAA-REQ-033",
  "GAEP-DRAA-REQ-035",
  "GAEP-IDAUTH-REQ-001",
  "GAEP-STATE-REQ-002",
] as const

export const decisionSubjectKindSchema = z.enum([
  "architecture-challenge-model",
  "architecture-record",
  "authorization-model",
  "bounded-context-model",
  "business-architecture-baseline",
  "business-capability-map",
  "business-rule-catalog",
  "business-understanding",
  "change",
  "data-model",
  "event-integration-model",
  "decision-record",
  "evidence-record",
  "failure-recovery-model",
  "initiative",
  "operating-model",
  "outcome-model",
  "process-model",
  "product",
  "product-design-revision",
  "requirement",
  "risk-record",
  "security-privacy-assessment",
  "source-record",
  "stakeholder-model",
  "system-solution-architecture",
  "value-stream-model",
  "work-item",
])

export const exactDecisionSubjectReferenceSchema = z.object({
  recordKind: decisionSubjectKindSchema,
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
  relationship: z.enum(["affects", "answers-for", "constrains", "depends-on", "reviews", "supersedes"]),
  elementKeys: canonicalIdentifierListSchema,
}).strict()

const exactDecisionSubjectListSchema = z.array(exactDecisionSubjectReferenceSchema).min(1).max(512)
  .refine(
    (references) => unique(references.map((reference) =>
      `${reference.recordKind}:${reference.recordId}:${reference.revision}:${reference.relationship}`)),
    "Exact Decision Subject references must be unique",
  )
  .superRefine((references, context) => {
    const keys = references.map((reference) =>
      `${reference.recordKind}:${reference.recordId}:${String(reference.revision).padStart(12, "0")}:${reference.relationship}`)
    if (!canonical(keys)) {
      context.addIssue({ code: "custom", message: "Exact Decision Subject references must use canonical identity ordering" })
    }
  })

const decisionOptionSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  description: longTextSchema,
  noAction: z.boolean(),
  consequences: requiredCanonicalTextListSchema,
  constraints: canonicalTextListSchema,
  risks: requiredCanonicalTextListSchema,
  evidence: requiredExactSourceListSchema,
}).strict()

const decisionCriterionSchema = z.object({
  key: identifierSchema,
  statement: longTextSchema,
  importance: z.enum(["critical", "high", "medium", "low"]),
  evidence: requiredExactSourceListSchema,
}).strict()

const decisionRecommendationSchema = z.object({
  key: identifierSchema,
  preference: z.enum(["no-preference", "option"]),
  optionKey: identifierSchema.optional(),
  rationale: longTextSchema,
  assumptions: canonicalTextListSchema,
  uncertainty: requiredCanonicalTextListSchema,
  proposedBy: z.object({
    kind: z.enum(["agent", "human", "system"]),
    id: shortTextSchema,
  }).strict(),
  proposedAt: z.string().datetime(),
  evidence: requiredExactSourceListSchema,
  authorityBoundary: z.literal(
    "recommendation-is-advisory-and-does-not-establish-a-decision-outcome-approval-risk-acceptance-or-action-authority",
  ),
}).strict().superRefine((recommendation, context) => {
  if ((recommendation.preference === "option") !== (recommendation.optionKey !== undefined)) {
    context.addIssue({
      code: "custom",
      path: ["optionKey"],
      message: "An option recommendation must identify one exact option and no-preference must not identify one",
    })
  }
})

const decisionOutcomeSchema = z.object({
  state: z.enum(["deferred", "no-action-selected", "option-selected", "option-set-rejected", "unresolved"]),
  optionKey: identifierSchema.optional(),
  rationale: longTextSchema,
  selectedBy: humanActorSchema.optional(),
  selectedAt: z.string().datetime().optional(),
  evidence: requiredExactSourceListSchema,
  deferral: z.object({
    assumedOptionKey: identifierSchema.optional(),
    dueAt: z.string().datetime().optional(),
    ownerRoleKey: identifierSchema,
    trigger: longTextSchema,
    affectedScope: requiredCanonicalTextListSchema,
  }).strict().optional(),
  authorityEligibilityState: z.literal("not-established"),
  effectivenessState: z.literal("pending"),
  approvalState: z.literal("not-established"),
  riskAcceptanceState: z.literal("not-granted"),
  baselinePromotionState: z.literal("not-granted"),
  actionAuthorityState: z.literal("not-granted"),
  authorityBoundary: z.literal(
    "recorded-outcome-does-not-establish-authority-eligibility-approval-risk-acceptance-baseline-promotion-or-action-authority",
  ),
}).strict().superRefine((outcome, context) => {
  const attributable = outcome.selectedBy !== undefined || outcome.selectedAt !== undefined
  if (outcome.state === "unresolved") {
    if (attributable || outcome.optionKey !== undefined || outcome.deferral !== undefined) {
      context.addIssue({ code: "custom", message: "An unresolved disposition cannot carry selection or deferral metadata" })
    }
    return
  }
  if (!outcome.selectedBy || !outcome.selectedAt) {
    context.addIssue({ code: "custom", message: "A non-unresolved Decision Outcome requires an attributable human selection and time" })
  }
  if (outcome.state === "deferred") {
    if (!outcome.deferral || outcome.optionKey !== undefined) {
      context.addIssue({ code: "custom", message: "A deferred Decision Outcome requires exact deferral metadata and no selected option" })
    }
  } else if (outcome.deferral !== undefined) {
    context.addIssue({ code: "custom", path: ["deferral"], message: "Deferral metadata is valid only for a deferred Decision Outcome" })
  }
  const selectsOption = outcome.state === "option-selected" || outcome.state === "no-action-selected"
  if (selectsOption !== (outcome.optionKey !== undefined)) {
    context.addIssue({ code: "custom", path: ["optionKey"], message: "Selected outcomes must identify exactly one declared option" })
  }
})

const decisionEntrySchema = z.object({
  key: identifierSchema,
  question: longTextSchema,
  scope: z.object({
    included: requiredCanonicalTextListSchema,
    excluded: canonicalTextListSchema,
  }).strict(),
  ownerRoleKey: identifierSchema,
  decisionAuthorityRoleKeys: requiredCanonicalIdentifierListSchema,
  decisionRightKeys: requiredCanonicalIdentifierListSchema,
  ownerAssignmentState: z.literal("not-established"),
  authorityAssignmentState: z.literal("not-established"),
  subjects: exactDecisionSubjectListSchema,
  options: z.array(decisionOptionSchema).min(2).max(128)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Decision Option keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Decision Options must use canonical key ordering")
    .refine((entries) => entries.filter((entry) => entry.noAction).length <= 1, "A Decision may define at most one no-action option"),
  criteria: z.array(decisionCriterionSchema).min(1).max(256)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Decision Criterion keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Decision Criteria must use canonical key ordering"),
  recommendations: z.array(decisionRecommendationSchema).max(256)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Recommendation keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Recommendations must use canonical key ordering"),
  outcome: decisionOutcomeSchema,
  authoringLifecycle: z.enum(["draft", "finalized", "in-review", "proposed"]),
  revisionDisposition: z.literal("candidate"),
  operationalEligibilityState: z.literal("not-established"),
  assumptions: canonicalTextListSchema,
  uncertainty: requiredCanonicalTextListSchema,
  dissent: canonicalTextListSchema,
  conflicts: canonicalTextListSchema,
  consequences: requiredCanonicalTextListSchema,
  risks: requiredCanonicalTextListSchema,
  obligations: canonicalTextListSchema,
  implementationBoundary: longTextSchema,
  reviewTriggers: requiredCanonicalTextListSchema,
  expiresAt: z.string().datetime().optional(),
  relationships: exactDecisionSubjectListSchema,
  sources: requiredExactSourceListSchema,
}).strict().superRefine((decision, context) => {
  const optionKeys = new Set(decision.options.map((option) => option.key))
  for (const [index, recommendation] of decision.recommendations.entries()) {
    if (recommendation.optionKey && !optionKeys.has(recommendation.optionKey)) {
      context.addIssue({ code: "custom", path: ["recommendations", index, "optionKey"], message: "Recommendations must reference declared Decision Options" })
    }
  }
  const selectedOption = decision.outcome.optionKey === undefined
    ? undefined
    : decision.options.find((option) => option.key === decision.outcome.optionKey)
  if (decision.outcome.optionKey !== undefined && !selectedOption) {
    context.addIssue({ code: "custom", path: ["outcome", "optionKey"], message: "Decision Outcome must reference a declared Decision Option" })
  }
  if (decision.outcome.state === "no-action-selected" && selectedOption && !selectedOption.noAction) {
    context.addIssue({ code: "custom", path: ["outcome", "optionKey"], message: "A no-action outcome must select the declared no-action option" })
  }
  if (decision.outcome.state === "option-selected" && selectedOption?.noAction) {
    context.addIssue({ code: "custom", path: ["outcome", "optionKey"], message: "An option-selected outcome cannot select the no-action option" })
  }
  if (decision.outcome.deferral?.assumedOptionKey && !optionKeys.has(decision.outcome.deferral.assumedOptionKey)) {
    context.addIssue({ code: "custom", path: ["outcome", "deferral", "assumedOptionKey"], message: "A deferred assumption must reference a declared Decision Option" })
  }
})

const decisionRequirementCoverageSchema = z.object({
  requirementId: z.enum(decisionRegisterRequirementIds),
  state: z.enum(["covered-candidate", "not-applicable-candidate", "unresolved"]),
  decisionKeys: canonicalIdentifierListSchema,
  basis: longTextSchema,
  evidence: requiredExactSourceListSchema,
}).strict()

const decisionRegisterInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  scope: longTextSchema,
  operatingModel: exactOperatingModelReferenceSchema,
  architectureChallengeModel: exactArchitectureChallengeModelReferenceSchema,
  decisions: z.array(decisionEntrySchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Decision keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Decisions must use canonical key ordering"),
  requirementCoverage: z.array(decisionRequirementCoverageSchema)
    .length(decisionRegisterRequirementIds.length)
    .refine((entries) => unique(entries.map((entry) => entry.requirementId)), "Requirement coverage must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.requirementId)), "Requirement coverage must use canonical ID ordering"),
  inconsistencies: canonicalTextListSchema,
  unresolvedQuestions: canonicalTextListSchema,
  limitations: requiredCanonicalTextListSchema,
}).strict().superRefine((register, context) => {
  const expected = [...decisionRegisterRequirementIds].sort((left, right) => left.localeCompare(right))
  if (register.requirementCoverage.some((entry, index) => entry.requirementId !== expected[index])) {
    context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must contain the complete Decision Register catalog" })
  }
  const decisionKeys = new Set(register.decisions.map((decision) => decision.key))
  if (register.requirementCoverage.flatMap((coverage) => coverage.decisionKeys).some((key) => !decisionKeys.has(key))) {
    context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must reference declared Decisions" })
  }
})

export const decisionRegisterInputSchema = rejectSecrets(decisionRegisterInputBaseSchema)

export const decisionRegisterSchema = decisionRegisterInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("decision-register-candidate"),
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
  authorityBoundary: z.literal(
    "decision-register-is-a-candidate-record-and-does-not-establish-owner-or-authority-assignments-decision-effectiveness-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority",
  ),
}).strict().superRefine((register, context) => {
  if ((register.revision === 1) !== (register.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Decision Register revisions after revision one require an exact predecessor digest" })
  }
})

export const exactDecisionRegisterReferenceSchema = z.object({
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

export const decisionRegisterStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("decision-register-status"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  register: exactDecisionRegisterReferenceSchema.optional(),
  decisionCount: z.number().int().nonnegative().max(4_096),
  unresolvedDecisionCount: z.number().int().nonnegative().max(4_096),
  selectedPendingDecisionCount: z.number().int().nonnegative().max(4_096),
  deferredDecisionCount: z.number().int().nonnegative().max(4_096),
  unresolvedRequirementCount: z.number().int().nonnegative().max(decisionRegisterRequirementIds.length),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  inconsistencyCount: z.number().int().nonnegative().max(512),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(512),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "decision-register-status-reports-candidate-coverage-and-gaps-and-does-not-establish-decision-effectiveness-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority",
  ),
}).strict().superRefine((status, context) => {
  if (status.unresolvedDecisionCount + status.selectedPendingDecisionCount + status.deferredDecisionCount > status.decisionCount) {
    context.addIssue({ code: "custom", message: "Decision status counts cannot exceed the total Decision count" })
  }
})

export const decisionRegisterProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("decision-register-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: decisionRegisterStatusSchema,
  register: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    membershipDigest: digestSchema,
    state: z.literal("candidate"),
    decisionCount: z.number().int().nonnegative().max(4_096),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-identities-counts-statuses-and-digests-only-not-decision-questions-options-recommendations-outcomes-rationale-evidence-subject-content-personal-data-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "decision-register-projection-does-not-establish-decision-effectiveness-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId ||
      projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId ||
      projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Decision Register projection must bind the exact Product and Initiative revisions" })
  }
})

export type DecisionRegisterInput = z.infer<typeof decisionRegisterInputSchema>
export type DecisionRegister = z.infer<typeof decisionRegisterSchema>
export type ExactDecisionRegisterReference = z.infer<typeof exactDecisionRegisterReferenceSchema>
export type ExactDecisionSubjectReference = z.infer<typeof exactDecisionSubjectReferenceSchema>
export type DecisionRegisterStatus = z.infer<typeof decisionRegisterStatusSchema>
export type DecisionRegisterProjection = z.infer<typeof decisionRegisterProjectionSchema>
