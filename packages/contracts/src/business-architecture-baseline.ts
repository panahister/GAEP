import { z } from "zod"

import { exactBusinessCapabilityMapReferenceSchema } from "./business-capability-map.js"
import { exactBusinessRuleCatalogReferenceSchema } from "./business-rule-catalog.js"
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

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function canonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Business Architecture Baseline candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalIdentifierListSchema = z.array(identifierSchema).max(2_048)
  .refine(unique, "Identifiers must be unique")
  .refine(canonical, "Identifiers must use canonical lexical ordering")

const requiredCanonicalIdentifierListSchema = canonicalIdentifierListSchema.refine(
  (values) => values.length > 0,
  "At least one identifier is required",
)

const canonicalTextListSchema = z.array(shortTextSchema).max(512)
  .refine(unique, "Values must be unique")
  .refine(canonical, "Values must use canonical lexical ordering")

const requiredCanonicalTextListSchema = canonicalTextListSchema.refine(
  (values) => values.length > 0,
  "At least one value is required",
)

const exactSourceListSchema = z.array(exactSourceReferenceSchema).min(1).max(256)
  .refine(
    (references) => unique(references.map((reference) =>
      `${reference.sourceId}:${reference.sourceRevision}:${reference.recordDigest}:${reference.contentDigest}`)),
    "Exact Source references must be unique",
  )
  .superRefine((references, context) => {
    const ordered = [...references].sort((left, right) =>
      left.sourceId.localeCompare(right.sourceId) || left.sourceRevision - right.sourceRevision)
    if (references.some((reference, index) =>
      reference.sourceId !== ordered[index]?.sourceId ||
      reference.sourceRevision !== ordered[index]?.sourceRevision)) {
      context.addIssue({ code: "custom", message: "Exact Source references must use canonical identity ordering" })
    }
  })

export const businessArchitectureElementKindSchema = z.enum([
  "business-rule",
  "capability",
  "decision-right",
  "enforcement-target",
  "exception",
  "operating-role",
  "value-stream",
])

export const businessArchitectureCoverageDispositionSchema = z.enum([
  "included-candidate",
  "excluded-candidate",
  "unresolved",
])

const businessArchitectureCoverageSchema = z.object({
  elementKind: businessArchitectureElementKindSchema,
  elementKey: identifierSchema,
  disposition: businessArchitectureCoverageDispositionSchema,
  rationale: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

const businessArchitectureIntegrationClaimSchema = z.object({
  key: identifierSchema,
  statement: longTextSchema,
  capabilityKeys: canonicalIdentifierListSchema,
  valueStreamKeys: canonicalIdentifierListSchema,
  roleKeys: canonicalIdentifierListSchema,
  decisionRightKeys: canonicalIdentifierListSchema,
  ruleKeys: canonicalIdentifierListSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((claim, context) => {
  const populatedDimensions = [
    claim.capabilityKeys,
    claim.valueStreamKeys,
    claim.roleKeys,
    claim.decisionRightKeys,
    claim.ruleKeys,
  ].filter((values) => values.length > 0).length
  if (populatedDimensions < 2) {
    context.addIssue({
      code: "custom",
      message: "A Business Architecture integration claim must connect at least two model dimensions",
    })
  }
})

export const businessArchitectureConsistencyTopicSchema = z.enum([
  "capability-role-accountability",
  "capability-value-stream-trace",
  "exception-decision-authority",
  "outcome-capability-trace",
  "rule-capability-value-trace",
  "source-freshness",
])

export const businessArchitectureConsistencyStateSchema = z.enum([
  "candidate-satisfied",
  "gap",
  "unknown",
])

const businessArchitectureConsistencyCheckSchema = z.object({
  topic: businessArchitectureConsistencyTopicSchema,
  state: businessArchitectureConsistencyStateSchema,
  basis: longTextSchema,
  accountableRoleKey: identifierSchema,
  sources: exactSourceListSchema,
}).strict()

const businessArchitectureCandidateGovernanceSchema = z.object({
  ownerRoleKey: identifierSchema,
  reviewerRoleKeys: requiredCanonicalIdentifierListSchema,
  decisionRightKey: identifierSchema,
  approvalState: z.literal("not-granted"),
  basis: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

const businessArchitectureChangeControlSchema = z.object({
  accountableRoleKey: identifierSchema,
  decisionRightKey: identifierSchema,
  triggers: requiredCanonicalTextListSchema,
  requiredReviews: z.array(z.enum([
    "authority-review",
    "business-review",
    "impact-review",
    "source-review",
  ])).min(1).max(4).refine(unique, "Required review types must be unique")
    .refine(canonical, "Required review types must use canonical lexical ordering"),
  dispositionRule: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

export const businessArchitectureBaselineInputSchema = rejectSecrets(z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  purpose: longTextSchema,
  businessUnderstanding: exactBusinessUnderstandingReferenceSchema,
  stakeholderModel: exactStakeholderModelReferenceSchema,
  outcomeModel: exactBusinessUnderstandingReferenceSchema,
  capabilityMap: exactBusinessCapabilityMapReferenceSchema,
  valueStreamModel: exactValueStreamModelReferenceSchema,
  operatingModel: exactOperatingModelReferenceSchema,
  businessRuleCatalog: exactBusinessRuleCatalogReferenceSchema,
  scope: z.object({
    included: requiredCanonicalTextListSchema,
    excluded: canonicalTextListSchema,
    boundaries: requiredCanonicalTextListSchema,
  }).strict(),
  coverage: z.array(businessArchitectureCoverageSchema).min(1).max(4_096)
    .refine(
      (entries) => unique(entries.map((entry) => `${entry.elementKind}:${entry.elementKey}`)),
      "Business Architecture coverage identities must be unique",
    )
    .refine(
      (entries) => canonical(entries.map((entry) => `${entry.elementKind}:${entry.elementKey}`)),
      "Business Architecture coverage must use canonical element ordering",
    ),
  integrationClaims: z.array(businessArchitectureIntegrationClaimSchema).min(1).max(2_048)
    .refine((claims) => unique(claims.map((claim) => claim.key)), "Integration-claim keys must be unique")
    .refine((claims) => canonical(claims.map((claim) => claim.key)), "Integration claims must use canonical key ordering"),
  consistencyChecks: z.array(businessArchitectureConsistencyCheckSchema).length(6)
    .superRefine((checks, context) => {
      const topics = checks.map((check) => check.topic)
      const expected = businessArchitectureConsistencyTopicSchema.options
      if (!unique(topics) || !canonical(topics) || expected.some((topic) => !topics.includes(topic))) {
        context.addIssue({
          code: "custom",
          message: "Every Business Architecture consistency topic must appear exactly once in canonical order",
        })
      }
    }),
  governance: businessArchitectureCandidateGovernanceSchema,
  changeControl: businessArchitectureChangeControlSchema,
  limitations: canonicalTextListSchema,
}).strict())

export const businessArchitectureBaselineSchema = businessArchitectureBaselineInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("business-architecture-baseline-candidate"),
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
    "business-architecture-baseline-is-a-candidate-compound-snapshot-and-does-not-designate-or-approve-a-baseline-establish-readiness-grant-exceptions-deploy-enforcement-or-authorize-action",
  ),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({
      code: "custom",
      path: ["predecessorDigest"],
      message: "Only Business Architecture Baseline revisions after revision one require an exact predecessor digest",
    })
  }
})

export const exactBusinessArchitectureBaselineReferenceSchema = exactBusinessUnderstandingReferenceSchema

export const businessArchitectureBaselineAssessmentSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("business-architecture-baseline-assessment"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  baseline: exactBusinessArchitectureBaselineReferenceSchema.optional(),
  coveredElementCount: z.number().int().nonnegative().max(4_096),
  includedElementCount: z.number().int().nonnegative().max(4_096),
  excludedElementCount: z.number().int().nonnegative().max(4_096),
  unresolvedElementCount: z.number().int().nonnegative().max(4_096),
  integrationClaimCount: z.number().int().nonnegative().max(2_048),
  consistencyCheckCount: z.number().int().nonnegative().max(6),
  consistencyGapCount: z.number().int().nonnegative().max(6),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  state: z.enum(["complete-for-review", "attention-required"]),
  reasons: z.array(shortTextSchema).max(512),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "business-architecture-baseline-assessment-reports-candidate-coherence-and-gaps-and-does-not-designate-or-approve-a-baseline-establish-readiness-or-authorize-action",
  ),
}).strict()

export const businessArchitectureBaselineProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("business-architecture-baseline-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  }).strict(),
  assessment: businessArchitectureBaselineAssessmentSchema,
  baseline: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    membershipDigest: digestSchema,
    state: z.literal("candidate"),
    coveredElementCount: z.number().int().nonnegative().max(4_096),
    integrationClaimCount: z.number().int().nonnegative().max(2_048),
    consistencyGapCount: z.number().int().nonnegative().max(6),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-identities-counts-statuses-and-digests-only-not-architecture-narrative-source-content-personal-data-locators-or-credentials",
  ),
  authorityBoundary: z.literal(
    "business-architecture-baseline-projection-does-not-designate-or-approve-a-baseline-establish-readiness-grant-exceptions-deploy-enforcement-or-authorize-action",
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
      message: "Business Architecture Baseline projection must bind the exact Product and Initiative revisions",
    })
  }
})

export type BusinessArchitectureElementKind = z.infer<typeof businessArchitectureElementKindSchema>
export type BusinessArchitectureBaselineInput = z.infer<typeof businessArchitectureBaselineInputSchema>
export type BusinessArchitectureBaseline = z.infer<typeof businessArchitectureBaselineSchema>
export type ExactBusinessArchitectureBaselineReference = z.infer<typeof exactBusinessArchitectureBaselineReferenceSchema>
export type BusinessArchitectureBaselineAssessment = z.infer<typeof businessArchitectureBaselineAssessmentSchema>
export type BusinessArchitectureBaselineProjection = z.infer<typeof businessArchitectureBaselineProjectionSchema>
