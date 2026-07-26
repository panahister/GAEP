import { z } from "zod"

import { exactBusinessCapabilityMapReferenceSchema } from "./business-capability-map.js"
import {
  businessContextBindingSchema,
  exactBusinessUnderstandingReferenceSchema,
  exactStakeholderModelReferenceSchema,
} from "./business-understanding.js"
import { exactOperatingModelReferenceSchema } from "./operating-model.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactSourceReferenceSchema } from "./source-governance.js"
import { exactValueStreamModelReferenceSchema } from "./value-stream-model.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const longTextSchema = z.string().trim().min(10).max(20_000)
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()

function hasUniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function isCanonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Business Rule Catalog records cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalIdentifierListSchema = z.array(identifierSchema).max(512)
  .refine(hasUniqueValues, "Identifiers must be unique")
  .refine(isCanonical, "Identifiers must use canonical lexical ordering")

const requiredCanonicalIdentifierListSchema = canonicalIdentifierListSchema.refine(
  (values) => values.length > 0,
  "At least one identifier is required",
)

const canonicalTextListSchema = z.array(shortTextSchema).max(512)
  .refine(hasUniqueValues, "Values must be unique")
  .refine(isCanonical, "Values must use canonical lexical ordering")

const requiredCanonicalTextListSchema = canonicalTextListSchema.refine(
  (values) => values.length > 0,
  "At least one value is required",
)

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
      context.addIssue({
        code: "custom",
        message: "Exact Source references must use canonical Source identity ordering",
      })
    }
  })

const requiredExactSourceListSchema = exactSourceListSchema.refine(
  (references) => references.length > 0,
  "Business-rule claims require at least one exact Source reference",
)

export const businessRuleKindSchema = z.enum([
  "calculation",
  "constraint",
  "derivation",
  "eligibility",
  "obligation",
  "validation",
])

export const businessRuleExceptionBehaviorSchema = z.enum([
  "candidate-exception-path",
  "not-exceptionable",
])

export const enforcementTargetKindSchema = z.enum([
  "data-quality",
  "decision-support",
  "human-workflow",
  "integration-boundary",
  "product-surface",
  "service-boundary",
])

export const candidateRuleBindingStateSchema = z.enum(["unassigned", "candidate"])
export const candidateRuleVerificationStateSchema = z.enum(["unassessed", "candidate-defined"])

const candidateRuleAuthoritySchema = z.object({
  state: candidateRuleBindingStateSchema,
  basis: longTextSchema,
  sources: requiredExactSourceListSchema,
}).strict()

const businessRuleSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  kind: businessRuleKindSchema,
  statement: longTextSchema,
  applicability: longTextSchema,
  condition: longTextSchema,
  outcome: longTextSchema,
  rationale: longTextSchema,
  ownerRoleKey: identifierSchema,
  capabilityKeys: requiredCanonicalIdentifierListSchema,
  valueStreamKeys: requiredCanonicalIdentifierListSchema,
  decisionRightKeys: requiredCanonicalIdentifierListSchema,
  enforcementTargetKeys: requiredCanonicalIdentifierListSchema,
  exceptionBehavior: businessRuleExceptionBehaviorSchema,
  exceptionKeys: canonicalIdentifierListSchema,
  examples: requiredCanonicalTextListSchema,
  unknownInputBehavior: z.literal("indeterminate"),
  sources: requiredExactSourceListSchema,
}).strict().superRefine((rule, context) => {
  if (rule.exceptionBehavior === "not-exceptionable" && rule.exceptionKeys.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["exceptionKeys"],
      message: "A non-exceptionable Business Rule cannot reference candidate exceptions",
    })
  }
  if (rule.exceptionBehavior === "candidate-exception-path" && rule.exceptionKeys.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["exceptionKeys"],
      message: "A candidate exception path must reference at least one recorded exception",
    })
  }
})

const businessRuleEnforcementTargetSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  kind: enforcementTargetKindSchema,
  target: longTextSchema,
  responsibleRoleKey: identifierSchema,
  mechanism: longTextSchema,
  failureBehavior: longTextSchema,
  assignment: candidateRuleAuthoritySchema,
  verificationState: candidateRuleVerificationStateSchema,
  verificationCriteria: requiredCanonicalTextListSchema,
  sources: requiredExactSourceListSchema,
}).strict()

const businessRuleExceptionSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  ruleKeys: requiredCanonicalIdentifierListSchema,
  scope: longTextSchema,
  rationaleRequirements: requiredCanonicalTextListSchema,
  approvingRoleKey: identifierSchema,
  decisionRightKey: identifierSchema,
  compensatingControls: requiredCanonicalTextListSchema,
  validityRule: longTextSchema,
  revocationRule: longTextSchema,
  closureRule: longTextSchema,
  authority: candidateRuleAuthoritySchema,
  sources: requiredExactSourceListSchema,
}).strict()

const businessRuleConflictModelSchema = z.object({
  defaultOutcome: z.literal("indeterminate"),
  precedenceRule: longTextSchema,
  conflictRule: longTextSchema,
  unresolvedConflictRule: longTextSchema,
  ownerRoleKey: identifierSchema,
  sources: requiredExactSourceListSchema,
}).strict()

export const businessRuleCatalogInputSchema = rejectSecrets(z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  businessUnderstanding: exactBusinessUnderstandingReferenceSchema,
  stakeholderModel: exactStakeholderModelReferenceSchema,
  outcomeModel: exactBusinessUnderstandingReferenceSchema,
  capabilityMap: exactBusinessCapabilityMapReferenceSchema,
  valueStreamModel: exactValueStreamModelReferenceSchema,
  operatingModel: exactOperatingModelReferenceSchema,
  rules: z.array(businessRuleSchema).min(1).max(512)
    .refine((rules) => hasUniqueValues(rules.map((rule) => rule.key)), "Business Rule keys must be unique")
    .refine((rules) => isCanonical(rules.map((rule) => rule.key)), "Business Rules must use canonical key ordering"),
  enforcementTargets: z.array(businessRuleEnforcementTargetSchema).min(1).max(512)
    .refine((targets) => hasUniqueValues(targets.map((target) => target.key)), "Enforcement-target keys must be unique")
    .refine((targets) => isCanonical(targets.map((target) => target.key)), "Enforcement targets must use canonical key ordering"),
  exceptions: z.array(businessRuleExceptionSchema).max(512)
    .refine((exceptions) => hasUniqueValues(exceptions.map((exception) => exception.key)), "Business-rule exception keys must be unique")
    .refine((exceptions) => isCanonical(exceptions.map((exception) => exception.key)), "Business-rule exceptions must use canonical key ordering"),
  conflictModel: businessRuleConflictModelSchema,
  limitations: canonicalTextListSchema,
}).strict().superRefine((catalog, context) => {
  const ruleKeys = new Set(catalog.rules.map((rule) => rule.key))
  const targetKeys = new Set(catalog.enforcementTargets.map((target) => target.key))
  const exceptionKeys = new Set(catalog.exceptions.map((exception) => exception.key))
  for (const [index, rule] of catalog.rules.entries()) {
    if (rule.enforcementTargetKeys.some((key) => !targetKeys.has(key)) ||
        rule.exceptionKeys.some((key) => !exceptionKeys.has(key))) {
      context.addIssue({
        code: "custom",
        path: ["rules", index],
        message: "Business Rules must reference recorded enforcement targets and exceptions",
      })
    }
  }
  for (const [index, exception] of catalog.exceptions.entries()) {
    if (exception.ruleKeys.some((key) => !ruleKeys.has(key))) {
      context.addIssue({
        code: "custom",
        path: ["exceptions", index, "ruleKeys"],
        message: "Business-rule exceptions must reference recorded Business Rules",
      })
    }
    if (exception.ruleKeys.some((key) =>
      !catalog.rules.find((rule) => rule.key === key)?.exceptionKeys.includes(exception.key))) {
      context.addIssue({
        code: "custom",
        path: ["exceptions", index, "ruleKeys"],
        message: "Business Rule and exception references must be reciprocal",
      })
    }
  }
  for (const [index, target] of catalog.enforcementTargets.entries()) {
    if (!catalog.rules.some((rule) => rule.enforcementTargetKeys.includes(target.key))) {
      context.addIssue({
        code: "custom",
        path: ["enforcementTargets", index],
        message: "Every enforcement target must be referenced by at least one Business Rule",
      })
    }
  }
}))

export const exactBusinessRuleCatalogReferenceSchema = exactBusinessUnderstandingReferenceSchema

export const businessRuleCatalogSchema = businessRuleCatalogInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("business-rule-catalog"),
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
    "business-rule-catalog-records-candidate-rules-sources-exceptions-and-enforcement-targets-and-does-not-evaluate-policy-grant-exceptions-deploy-enforcement-approve-baseline-or-authorize-action",
  ),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({
      code: "custom",
      path: ["predecessorDigest"],
      message: "Only Business Rule Catalog revisions after revision one require an exact predecessor digest",
    })
  }
})

export const businessRuleCatalogAssessmentSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("business-rule-catalog-assessment"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  businessRuleCatalog: exactBusinessRuleCatalogReferenceSchema.optional(),
  ruleCount: z.number().int().nonnegative().max(512),
  sourceBackedRuleCount: z.number().int().nonnegative().max(512),
  nonExceptionableRuleCount: z.number().int().nonnegative().max(512),
  enforcementTargetCount: z.number().int().nonnegative().max(512),
  unassignedEnforcementTargetCount: z.number().int().nonnegative().max(512),
  unverifiedEnforcementTargetCount: z.number().int().nonnegative().max(512),
  exceptionCount: z.number().int().nonnegative().max(512),
  unassignedExceptionAuthorityCount: z.number().int().nonnegative().max(512),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  state: z.enum(["complete-for-review", "attention-required"]),
  reasons: z.array(shortTextSchema).max(512),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "business-rule-catalog-assessment-reports-candidate-coverage-and-gaps-and-does-not-evaluate-policy-grant-exceptions-deploy-enforcement-approve-baseline-readiness-or-authorize-action",
  ),
}).strict()

export const businessRuleCatalogProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("business-rule-catalog-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  }).strict(),
  assessment: businessRuleCatalogAssessmentSchema,
  businessRuleCatalog: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    state: z.literal("candidate"),
    ruleCount: z.number().int().nonnegative().max(512),
    enforcementTargetCount: z.number().int().nonnegative().max(512),
    exceptionCount: z.number().int().nonnegative().max(512),
    nonExceptionableRuleCount: z.number().int().nonnegative().max(512),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-identities-counts-statuses-and-digests-only-not-rule-narrative-source-content-personal-data-locators-or-credentials",
  ),
  authorityBoundary: z.literal(
    "business-rule-catalog-projection-does-not-evaluate-policy-grant-exceptions-deploy-enforcement-approve-baseline-readiness-or-authorize-action",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.assessment.productId ||
      projection.product.revision !== projection.assessment.productRevision ||
      projection.initiative.id !== projection.assessment.initiativeId ||
      projection.initiative.revision !== projection.assessment.initiativeRevision) {
    context.addIssue({
      code: "custom",
      path: ["assessment"],
      message: "Business Rule Catalog projection must bind the exact Product and Initiative revisions",
    })
  }
})

export type BusinessRuleCatalogInput = z.infer<typeof businessRuleCatalogInputSchema>
export type BusinessRuleCatalog = z.infer<typeof businessRuleCatalogSchema>
export type ExactBusinessRuleCatalogReference = z.infer<typeof exactBusinessRuleCatalogReferenceSchema>
export type BusinessRuleCatalogAssessment = z.infer<typeof businessRuleCatalogAssessmentSchema>
export type BusinessRuleCatalogProjection = z.infer<typeof businessRuleCatalogProjectionSchema>
