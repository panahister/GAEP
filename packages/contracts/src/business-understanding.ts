import { z } from "zod"

import {
  containsSecretShapedValue,
  informationClassificationSchema,
} from "./product-studio.js"
import {
  exactSourceReferenceSchema,
  sourceKnowledgeDispositionSchema,
} from "./source-governance.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const metricKeySchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const longTextSchema = z.string().trim().min(10).max(20_000)
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()

function hasUniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function isCanonical(values: readonly string[]): boolean {
  return values.every((value, index) => value === [...values].sort((left, right) => left.localeCompare(right))[index])
}

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable business-understanding records cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalTextListSchema = z.array(shortTextSchema).max(256)
  .refine(hasUniqueValues, "Values must be unique")
  .refine(isCanonical, "Values must use canonical lexical ordering")

const exactSourceListSchema = z.array(exactSourceReferenceSchema).max(256)
  .refine(
    (references) => hasUniqueValues(references.map((reference) =>
      `${reference.sourceId}:${reference.sourceRevision}:${reference.recordDigest}:${reference.contentDigest}`)),
    "Exact Source references must be unique",
  )
  .superRefine((references, context) => {
    const ordered = [...references].sort((left, right) =>
      left.sourceId.localeCompare(right.sourceId) || left.sourceRevision - right.sourceRevision)
    if (references.some((reference, index) =>
      reference.sourceId !== ordered[index]?.sourceId ||
      reference.sourceRevision !== ordered[index]?.sourceRevision)) {
      context.addIssue({ code: "custom", message: "Exact Source references must use canonical Source identity ordering" })
    }
  })

const requiredExactSourceListSchema = exactSourceListSchema.refine(
  (references) => references.length > 0,
  "Attributed business claims require at least one exact Source reference",
)

export const businessContextBindingSchema = z.object({
  productRevision: z.number().int().positive(),
  productDigest: digestSchema,
  initiativeRevision: z.number().int().positive(),
  initiativeDigest: digestSchema,
}).strict()

export const attributedBusinessStatementSchema = z.object({
  text: longTextSchema,
  disposition: sourceKnowledgeDispositionSchema,
  sources: requiredExactSourceListSchema,
}).strict()

const identifiedAttributedStatementSchema = attributedBusinessStatementSchema.extend({
  id: identifierSchema,
}).strict()

const canonicalIdentifiedStatementsSchema = z.array(identifiedAttributedStatementSchema).max(256)
  .refine((items) => hasUniqueValues(items.map((item) => item.id)), "Statement identities must be unique")
  .refine((items) => isCanonical(items.map((item) => item.id)), "Statements must use canonical identity ordering")

export const businessUnderstandingInputSchema = rejectSecrets(z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  problem: attributedBusinessStatementSchema,
  opportunity: attributedBusinessStatementSchema.optional(),
  currentState: attributedBusinessStatementSchema,
  targetState: attributedBusinessStatementSchema,
  scope: z.object({
    included: canonicalTextListSchema.refine((values) => values.length > 0, "Business scope requires an inclusion"),
    excluded: canonicalTextListSchema,
    boundaries: canonicalTextListSchema.refine((values) => values.length > 0, "Business scope requires a boundary"),
  }).strict(),
  objectives: canonicalIdentifiedStatementsSchema.refine(
    (objectives) => objectives.length > 0,
    "Business understanding requires at least one objective",
  ),
  constraints: canonicalIdentifiedStatementsSchema,
  assumptions: z.array(z.object({
    id: identifierSchema,
    statement: attributedBusinessStatementSchema,
    status: z.enum(["unverified", "supported", "disputed"]),
    reviewTrigger: shortTextSchema,
  }).strict()).max(256)
    .refine((items) => hasUniqueValues(items.map((item) => item.id)), "Assumption identities must be unique")
    .refine((items) => isCanonical(items.map((item) => item.id)), "Assumptions must use canonical identity ordering"),
  unresolvedQuestions: z.array(z.object({
    id: identifierSchema,
    question: longTextSchema,
    blocking: z.boolean(),
    ownerRoleKey: identifierSchema.optional(),
    sources: exactSourceListSchema,
    reviewTrigger: shortTextSchema,
  }).strict()).max(256)
    .refine((items) => hasUniqueValues(items.map((item) => item.id)), "Question identities must be unique")
    .refine((items) => isCanonical(items.map((item) => item.id)), "Questions must use canonical identity ordering"),
  glossary: z.array(z.object({
    term: z.string().trim().min(1).max(240),
    definition: attributedBusinessStatementSchema,
  }).strict()).max(512)
    .refine(
      (items) => hasUniqueValues(items.map((item) => item.term.toLocaleLowerCase("en-US"))),
      "Glossary terms must be unique ignoring case",
    )
    .refine(
      (items) => isCanonical(items.map((item) => item.term.toLocaleLowerCase("en-US"))),
      "Glossary terms must use canonical lexical ordering",
    ),
  limitations: canonicalTextListSchema,
}).strict())

export const exactBusinessUnderstandingReferenceSchema = z.object({
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

export const businessUnderstandingSchema = businessUnderstandingInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("business-understanding-record"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  predecessorDigest: digestSchema.optional(),
  state: z.literal("candidate"),
  createdBy: humanActorSchema,
  updatedBy: humanActorSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "business-understanding-is-attributed-candidate-context-and-does-not-decide-approve-designate-readiness-or-authorize-action",
  ),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({
      code: "custom",
      path: ["predecessorDigest"],
      message: "Only Business Understanding revisions after revision one require an exact predecessor digest",
    })
  }
})

export const stakeholderCategoryValues = [
  "sponsor",
  "change-owner",
  "user",
  "reviewer",
  "approver",
  "steward",
  "affected-non-user",
  "external-authority-owner",
] as const
export const stakeholderCategorySchema = z.enum(stakeholderCategoryValues)

const attributableAssignmentSchema = z.object({
  status: z.enum(["unassigned", "proposed", "confirmed"]),
  subject: z.object({
    kind: z.enum(["human", "organization", "role"]),
    id: shortTextSchema,
  }).strict().optional(),
  basis: longTextSchema,
  sources: exactSourceListSchema,
  confirmedBy: humanActorSchema.optional(),
  confirmedAt: z.string().datetime().optional(),
}).strict().superRefine((assignment, context) => {
  if (assignment.status === "unassigned" && assignment.subject !== undefined) {
    context.addIssue({ code: "custom", path: ["subject"], message: "Unassigned stakeholders cannot name a subject" })
  }
  if (assignment.status !== "unassigned" && assignment.subject === undefined) {
    context.addIssue({ code: "custom", path: ["subject"], message: "Proposed or confirmed assignments require a subject" })
  }
  const confirmed = assignment.confirmedBy !== undefined || assignment.confirmedAt !== undefined
  if (assignment.status === "confirmed" && (!assignment.confirmedBy || !assignment.confirmedAt)) {
    context.addIssue({ code: "custom", message: "Confirmed assignments require an attributable human confirmation and time" })
  }
  if (assignment.status !== "confirmed" && confirmed) {
    context.addIssue({ code: "custom", message: "Only confirmed assignments can carry confirmation metadata" })
  }
})

const authorityClaimSchema = z.object({
  standing: z.enum(["none", "claimed", "verified", "disputed", "unknown"]),
  domains: canonicalTextListSchema,
  scope: canonicalTextListSchema,
  basis: longTextSchema,
  sources: exactSourceListSchema,
  verifiedBy: humanActorSchema.optional(),
  verifiedAt: z.string().datetime().optional(),
}).strict().superRefine((authority, context) => {
  if (authority.standing !== "none" && (authority.domains.length === 0 || authority.scope.length === 0)) {
    context.addIssue({ code: "custom", message: "Non-empty authority standing requires explicit domains and scope" })
  }
  if (authority.standing === "none" && (authority.domains.length > 0 || authority.scope.length > 0)) {
    context.addIssue({ code: "custom", message: "No-authority standing cannot declare authority domains or scope" })
  }
  const verified = authority.verifiedBy !== undefined || authority.verifiedAt !== undefined
  if (authority.standing === "verified" && (!authority.verifiedBy || !authority.verifiedAt || authority.sources.length === 0)) {
    context.addIssue({ code: "custom", message: "Verified authority requires exact evidence, a human verifier, and verification time" })
  }
  if (authority.standing !== "verified" && verified) {
    context.addIssue({ code: "custom", message: "Only verified authority can carry verification metadata" })
  }
})

const competenceClaimSchema = z.object({
  status: z.enum(["not-assessed", "claimed", "verified", "disputed"]),
  basis: longTextSchema,
  sources: exactSourceListSchema,
  verifiedBy: humanActorSchema.optional(),
  verifiedAt: z.string().datetime().optional(),
}).strict().superRefine((competence, context) => {
  const verified = competence.verifiedBy !== undefined || competence.verifiedAt !== undefined
  if (competence.status === "verified" && (!competence.verifiedBy || !competence.verifiedAt || competence.sources.length === 0)) {
    context.addIssue({ code: "custom", message: "Verified competence requires exact evidence, a human verifier, and verification time" })
  }
  if (competence.status !== "verified" && verified) {
    context.addIssue({ code: "custom", message: "Only verified competence can carry verification metadata" })
  }
})

export const stakeholderModelInputSchema = rejectSecrets(z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  businessUnderstanding: exactBusinessUnderstandingReferenceSchema,
  stakeholders: z.array(z.object({
    key: identifierSchema,
    label: z.string().trim().min(2).max(240),
    category: stakeholderCategorySchema,
    job: attributedBusinessStatementSchema,
    concerns: canonicalTextListSchema,
    successSignals: canonicalTextListSchema,
    assignment: attributableAssignmentSchema,
    authority: authorityClaimSchema,
    competence: competenceClaimSchema,
  }).strict()).min(1).max(256)
    .refine((items) => hasUniqueValues(items.map((item) => item.key)), "Stakeholder keys must be unique")
    .refine((items) => isCanonical(items.map((item) => item.key)), "Stakeholders must use canonical key ordering"),
  coverage: z.array(z.object({
    category: stakeholderCategorySchema,
    status: z.enum(["represented", "not-applicable", "unresolved"]),
    rationale: longTextSchema,
    sources: exactSourceListSchema,
  }).strict()).length(stakeholderCategoryValues.length),
  responsibilities: z.array(z.object({
    id: identifierSchema,
    subject: shortTextSchema,
    stakeholderKey: identifierSchema,
    relationship: z.enum(["responsible", "accountable", "consulted", "informed", "external-authority"]),
    basis: longTextSchema,
    sources: exactSourceListSchema,
  }).strict()).max(512)
    .refine((items) => hasUniqueValues(items.map((item) => item.id)), "Responsibility identities must be unique")
    .refine((items) => isCanonical(items.map((item) => item.id)), "Responsibilities must use canonical identity ordering"),
  separationOfDuty: z.array(z.object({
    id: identifierSchema,
    leftStakeholderKey: identifierSchema,
    rightStakeholderKey: identifierSchema,
    basis: longTextSchema,
    sources: exactSourceListSchema,
  }).strict()).max(128)
    .refine((items) => hasUniqueValues(items.map((item) => item.id)), "Separation-of-duty identities must be unique")
    .refine((items) => isCanonical(items.map((item) => item.id)), "Separation-of-duty rules must use canonical identity ordering"),
  contestability: z.object({
    path: longTextSchema,
    ownerStakeholderKey: identifierSchema.optional(),
    escalation: longTextSchema,
    sources: exactSourceListSchema,
  }).strict(),
  limitations: canonicalTextListSchema,
}).strict().superRefine((model, context) => {
  const stakeholderKeys = new Set(model.stakeholders.map((stakeholder) => stakeholder.key))
  const coverageCategories = model.coverage.map((coverage) => coverage.category)
  if (
    !hasUniqueValues(coverageCategories) ||
    coverageCategories.some((category, index) => category !== stakeholderCategoryValues[index])
  ) {
    context.addIssue({ code: "custom", path: ["coverage"], message: "Stakeholder coverage must include the canonical category catalog exactly once" })
  }
  for (const [index, coverage] of model.coverage.entries()) {
    const represented = model.stakeholders.some((stakeholder) => stakeholder.category === coverage.category)
    if ((coverage.status === "represented") !== represented) {
      context.addIssue({
        code: "custom",
        path: ["coverage", index, "status"],
        message: "Represented coverage must match the recorded stakeholder inventory",
      })
    }
  }
  for (const [index, responsibility] of model.responsibilities.entries()) {
    if (!stakeholderKeys.has(responsibility.stakeholderKey)) {
      context.addIssue({ code: "custom", path: ["responsibilities", index, "stakeholderKey"], message: "Responsibilities must reference a recorded stakeholder" })
    }
  }
  for (const [index, rule] of model.separationOfDuty.entries()) {
    if (
      rule.leftStakeholderKey === rule.rightStakeholderKey ||
      !stakeholderKeys.has(rule.leftStakeholderKey) ||
      !stakeholderKeys.has(rule.rightStakeholderKey)
    ) {
      context.addIssue({ code: "custom", path: ["separationOfDuty", index], message: "Separation-of-duty rules require two distinct recorded stakeholders" })
    }
  }
  if (model.contestability.ownerStakeholderKey && !stakeholderKeys.has(model.contestability.ownerStakeholderKey)) {
    context.addIssue({ code: "custom", path: ["contestability", "ownerStakeholderKey"], message: "Contestability owner must reference a recorded stakeholder" })
  }
}))

export const exactStakeholderModelReferenceSchema = exactBusinessUnderstandingReferenceSchema

export const stakeholderModelSchema = stakeholderModelInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("stakeholder-role-model"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  predecessorDigest: digestSchema.optional(),
  state: z.literal("candidate"),
  createdBy: humanActorSchema,
  updatedBy: humanActorSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "stakeholder-role-model-separates-role-assignment-competence-and-authority-and-does-not-appoint-approve-or-authorize",
  ),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({
      code: "custom",
      path: ["predecessorDigest"],
      message: "Only Stakeholder Model revisions after revision one require an exact predecessor digest",
    })
  }
})

const outcomeLevelSchema = z.enum(["activity", "experience", "decision", "delivery", "organization"])
const measureCategorySchema = z.enum([
  "user-value-flow",
  "quality-risk",
  "adoption-usability",
  "trust-accountability",
  "portability-continuity",
  "burden",
  "economics",
  "other",
])

const measureBaselineSchema = z.object({
  status: z.enum(["not-observed", "candidate", "observed"]),
  value: shortTextSchema.optional(),
  observedAt: z.string().datetime().optional(),
  sources: exactSourceListSchema,
}).strict().superRefine((baseline, context) => {
  if (baseline.status === "observed" && (!baseline.value || !baseline.observedAt || baseline.sources.length === 0)) {
    context.addIssue({ code: "custom", message: "Observed measure baselines require a value, observation time, and exact evidence" })
  }
  if (baseline.status === "not-observed" && (baseline.value || baseline.observedAt || baseline.sources.length > 0)) {
    context.addIssue({ code: "custom", message: "Unobserved measure baselines cannot carry observation data" })
  }
  if (baseline.status === "candidate" && baseline.observedAt) {
    context.addIssue({ code: "custom", message: "Candidate baselines cannot carry an observation time" })
  }
})

const measureTargetSchema = z.object({
  status: z.enum(["not-set", "candidate"]),
  statement: shortTextSchema.optional(),
}).strict().superRefine((target, context) => {
  if (target.status === "candidate" && !target.statement) {
    context.addIssue({ code: "custom", path: ["statement"], message: "Candidate targets require an explicit statement" })
  }
  if (target.status === "not-set" && target.statement) {
    context.addIssue({ code: "custom", path: ["statement"], message: "Unset targets cannot carry a target statement" })
  }
})

export const outcomeModelInputSchema = rejectSecrets(z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  businessUnderstanding: exactBusinessUnderstandingReferenceSchema,
  stakeholderModel: exactStakeholderModelReferenceSchema,
  primaryHypothesis: attributedBusinessStatementSchema,
  outcomes: z.array(z.object({
    id: identifierSchema,
    level: outcomeLevelSchema,
    statement: attributedBusinessStatementSchema,
    beneficiaryStakeholderKeys: z.array(identifierSchema).min(1).max(128)
      .refine(hasUniqueValues, "Outcome beneficiaries must be unique")
      .refine(isCanonical, "Outcome beneficiaries must use canonical ordering"),
    confounders: canonicalTextListSchema,
  }).strict()).min(1).max(256)
    .refine((items) => hasUniqueValues(items.map((item) => item.id)), "Outcome identities must be unique")
    .refine((items) => isCanonical(items.map((item) => item.id)), "Outcomes must use canonical identity ordering"),
  measures: z.array(z.object({
    key: metricKeySchema,
    name: z.string().trim().min(2).max(240),
    outcomeIds: z.array(identifierSchema).min(1).max(128)
      .refine(hasUniqueValues, "Measure outcomes must be unique")
      .refine(isCanonical, "Measure outcomes must use canonical ordering"),
    category: measureCategorySchema,
    kind: z.enum(["metric", "countermetric", "guardrail"]),
    definition: longTextSchema,
    direction: z.enum(["increase", "decrease", "range", "maintain", "observe"]),
    unit: shortTextSchema,
    baseline: measureBaselineSchema,
    target: measureTargetSchema,
    collection: z.object({
      ownerStakeholderKey: identifierSchema,
      method: longTextSchema,
      cadence: shortTextSchema,
      qualityConditions: canonicalTextListSchema,
    }).strict(),
    dataUse: z.object({
      purpose: longTextSchema,
      classification: informationClassificationSchema,
      aggregation: shortTextSchema,
      retention: shortTextSchema,
      prohibitedUses: canonicalTextListSchema,
    }).strict(),
    acceptanceSignal: longTextSchema,
    sources: requiredExactSourceListSchema,
  }).strict()).min(1).max(512)
    .refine((items) => hasUniqueValues(items.map((item) => item.key)), "Measure keys must be unique")
    .refine((items) => isCanonical(items.map((item) => item.key)), "Measures must use canonical key ordering"),
  countermetricDisposition: z.object({
    status: z.enum(["included", "not-applicable", "unresolved"]),
    rationale: longTextSchema,
    sources: exactSourceListSchema,
  }).strict(),
  burdenDisposition: z.object({
    status: z.enum(["included", "not-applicable", "unresolved"]),
    rationale: longTextSchema,
    sources: exactSourceListSchema,
  }).strict(),
  unresolvedQuestions: z.array(z.object({
    id: identifierSchema,
    question: longTextSchema,
    blocking: z.boolean(),
    sources: exactSourceListSchema,
    reviewTrigger: shortTextSchema,
  }).strict()).max(256)
    .refine((items) => hasUniqueValues(items.map((item) => item.id)), "Outcome question identities must be unique")
    .refine((items) => isCanonical(items.map((item) => item.id)), "Outcome questions must use canonical identity ordering"),
  limitations: canonicalTextListSchema,
}).strict().superRefine((model, context) => {
  const outcomeIds = new Set(model.outcomes.map((outcome) => outcome.id))
  const stakeholderKeys = new Set<string>()
  for (const outcome of model.outcomes) {
    for (const key of outcome.beneficiaryStakeholderKeys) stakeholderKeys.add(key)
  }
  for (const [index, measure] of model.measures.entries()) {
    if (measure.outcomeIds.some((id) => !outcomeIds.has(id))) {
      context.addIssue({ code: "custom", path: ["measures", index, "outcomeIds"], message: "Measures must reference recorded outcomes" })
    }
    stakeholderKeys.add(measure.collection.ownerStakeholderKey)
  }
  const hasCountermetric = model.measures.some((measure) => measure.kind === "countermetric")
  if ((model.countermetricDisposition.status === "included") !== hasCountermetric) {
    context.addIssue({ code: "custom", path: ["countermetricDisposition", "status"], message: "Included countermetric disposition must match the measure inventory" })
  }
  const hasBurdenMeasure = model.measures.some((measure) => measure.category === "burden")
  if ((model.burdenDisposition.status === "included") !== hasBurdenMeasure) {
    context.addIssue({ code: "custom", path: ["burdenDisposition", "status"], message: "Included burden disposition must match the measure inventory" })
  }
}))

export const outcomeModelSchema = outcomeModelInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("outcome-measure-model"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  predecessorDigest: digestSchema.optional(),
  state: z.literal("candidate"),
  createdBy: humanActorSchema,
  updatedBy: humanActorSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "outcome-measure-model-records-candidate-hypotheses-measures-and-data-use-limits-and-does-not-approve-targets-readiness-or-release",
  ),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({
      code: "custom",
      path: ["predecessorDigest"],
      message: "Only Outcome Model revisions after revision one require an exact predecessor digest",
    })
  }
})

export const businessUnderstandingAssessmentSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("business-understanding-assessment"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  businessUnderstanding: exactBusinessUnderstandingReferenceSchema.optional(),
  stakeholderModel: exactStakeholderModelReferenceSchema.optional(),
  outcomeModel: exactBusinessUnderstandingReferenceSchema.optional(),
  stakeholderCount: z.number().int().nonnegative(),
  representedStakeholderCategoryCount: z.number().int().nonnegative().max(stakeholderCategoryValues.length),
  unresolvedStakeholderCategoryCount: z.number().int().nonnegative().max(stakeholderCategoryValues.length),
  verifiedAuthorityCount: z.number().int().nonnegative(),
  unverifiedAuthorityCount: z.number().int().nonnegative(),
  outcomeCount: z.number().int().nonnegative(),
  measureCount: z.number().int().nonnegative(),
  observedBaselineCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative(),
  blockingQuestionCount: z.number().int().nonnegative(),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  state: z.enum(["complete-for-review", "attention-required"]),
  reasons: z.array(shortTextSchema).max(512),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "business-understanding-assessment-reports-recorded-candidate-evidence-and-does-not-approve-decide-designate-readiness-or-authorize-action",
  ),
}).strict()

export const businessUnderstandingProjectionSchema = rejectSecrets(z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("business-understanding-projection"),
  product: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
  }).strict(),
  initiative: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  }).strict(),
  assessment: businessUnderstandingAssessmentSchema,
  businessUnderstanding: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    state: z.literal("candidate"),
    objectiveCount: z.number().int().nonnegative().max(256),
    constraintCount: z.number().int().nonnegative().max(256),
    assumptionCount: z.number().int().nonnegative().max(256),
    unresolvedQuestionCount: z.number().int().nonnegative().max(256),
    glossaryTermCount: z.number().int().nonnegative().max(512),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  stakeholderModel: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    state: z.literal("candidate"),
    stakeholderCount: z.number().int().nonnegative().max(256),
    representedCategoryCount: z.number().int().nonnegative().max(stakeholderCategoryValues.length),
    unresolvedCategoryCount: z.number().int().nonnegative().max(stakeholderCategoryValues.length),
    verifiedAuthorityCount: z.number().int().nonnegative().max(256),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  outcomeModel: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    state: z.literal("candidate"),
    outcomeCount: z.number().int().nonnegative().max(256),
    measureCount: z.number().int().nonnegative().max(512),
    countermetricCount: z.number().int().nonnegative().max(512),
    burdenMeasureCount: z.number().int().nonnegative().max(512),
    observedBaselineCount: z.number().int().nonnegative().max(512),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-identities-counts-statuses-and-digests-only-not-business-narrative-personal-data-source-content-locators-or-credentials",
  ),
  authorityBoundary: z.literal(
    "business-understanding-projection-does-not-approve-appoint-decide-designate-readiness-or-authorize-action",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (
    projection.product.id !== projection.assessment.productId ||
    projection.product.revision !== projection.assessment.productRevision ||
    projection.initiative.id !== projection.assessment.initiativeId ||
    projection.initiative.revision !== projection.assessment.initiativeRevision
  ) {
    context.addIssue({ code: "custom", path: ["assessment"], message: "Business projection assessment must bind the exact Product and Initiative revisions" })
  }
}))

export type BusinessContextBinding = z.infer<typeof businessContextBindingSchema>
export type BusinessUnderstandingInput = z.infer<typeof businessUnderstandingInputSchema>
export type BusinessUnderstanding = z.infer<typeof businessUnderstandingSchema>
export type ExactBusinessUnderstandingReference = z.infer<typeof exactBusinessUnderstandingReferenceSchema>
export type StakeholderModelInput = z.infer<typeof stakeholderModelInputSchema>
export type StakeholderModel = z.infer<typeof stakeholderModelSchema>
export type ExactStakeholderModelReference = z.infer<typeof exactStakeholderModelReferenceSchema>
export type OutcomeModelInput = z.infer<typeof outcomeModelInputSchema>
export type OutcomeModel = z.infer<typeof outcomeModelSchema>
export type BusinessUnderstandingAssessment = z.infer<typeof businessUnderstandingAssessmentSchema>
export type BusinessUnderstandingProjection = z.infer<typeof businessUnderstandingProjectionSchema>
