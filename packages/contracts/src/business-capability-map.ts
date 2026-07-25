import { z } from "zod"

import {
  businessContextBindingSchema,
  exactBusinessUnderstandingReferenceSchema,
  exactStakeholderModelReferenceSchema,
} from "./business-understanding.js"
import {
  containsSecretShapedValue,
  informationClassificationSchema,
} from "./product-studio.js"
import { exactSourceReferenceSchema } from "./source-governance.js"

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
    message: "Portable Business Capability Map records cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalIdentifierListSchema = z.array(identifierSchema).max(256)
  .refine(hasUniqueValues, "Identifiers must be unique")
  .refine(isCanonical, "Identifiers must use canonical lexical ordering")

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
      context.addIssue({
        code: "custom",
        message: "Exact Source references must use canonical Source identity ordering",
      })
    }
  })

const requiredExactSourceListSchema = exactSourceListSchema.refine(
  (references) => references.length > 0,
  "Capability claims require at least one exact Source reference",
)

export const businessCapabilityPlacementValues = [
  "derived-view",
  "external-authority",
  "gaep-native-authority",
  "not-represented",
  "temporary-migration-copy",
  "working-material",
] as const

export const businessCapabilityPlacementSchema = z.enum(businessCapabilityPlacementValues)

export const businessCapabilityCategorySchema = z.enum([
  "core",
  "differentiating",
  "enabling",
  "regulatory",
  "supporting",
])

export const businessCapabilityMaturitySchema = z.enum([
  "unknown",
  "absent",
  "emerging",
  "repeatable",
  "managed",
  "optimized",
])

export const businessCapabilityLifecycleSchema = z.enum([
  "candidate",
  "proposed",
  "active",
  "deprecated",
  "retired",
])

const capabilityMaturityAssessmentSchema = z.object({
  level: businessCapabilityMaturitySchema,
  basis: longTextSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((assessment, context) => {
  if (assessment.level !== "unknown" && assessment.sources.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["sources"],
      message: "Known capability maturity requires exact evidence",
    })
  }
})

const capabilityGapSchema = z.object({
  id: identifierSchema,
  kind: z.enum(["capacity", "coverage", "evidence", "ownership", "performance", "process", "technology"]),
  severity: z.enum(["observation", "material", "critical"]),
  statement: longTextSchema,
  status: z.enum(["open", "candidate-addressed", "accepted-for-review", "resolved"]),
  ownerStakeholderKey: identifierSchema.optional(),
  reviewTrigger: shortTextSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((gap, context) => {
  if (gap.status === "resolved" && gap.sources.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["sources"],
      message: "Resolved capability gaps require exact evidence",
    })
  }
})

const candidatePrioritySchema = z.object({
  status: z.enum(["unassessed", "candidate"]),
  tier: z.enum(["critical", "high", "medium", "low", "defer"]).optional(),
  rationale: longTextSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((priority, context) => {
  if (priority.status === "candidate" && (!priority.tier || priority.sources.length === 0)) {
    context.addIssue({
      code: "custom",
      message: "Candidate capability priority requires a tier and exact evidence",
    })
  }
  if (priority.status === "unassessed" && priority.tier !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["tier"],
      message: "Unassessed capability priority cannot carry a tier",
    })
  }
})

const capabilityRecordSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  purpose: longTextSchema,
  category: businessCapabilityCategorySchema,
  placement: businessCapabilityPlacementSchema,
  scope: z.object({
    included: canonicalTextListSchema.refine((values) => values.length > 0, "Capability scope requires an inclusion"),
    excluded: canonicalTextListSchema,
    boundaries: canonicalTextListSchema.refine((values) => values.length > 0, "Capability scope requires a boundary"),
  }).strict(),
  ownerStakeholderKey: identifierSchema.optional(),
  accountableStakeholderKeys: canonicalIdentifierListSchema,
  participatingStakeholderKeys: canonicalIdentifierListSchema,
  objectiveIds: canonicalIdentifierListSchema.refine(
    (values) => values.length > 0,
    "Capabilities require at least one Business Understanding objective",
  ),
  outcomeIds: canonicalIdentifierListSchema.refine(
    (values) => values.length > 0,
    "Capabilities require at least one Outcome Model outcome",
  ),
  parentKey: identifierSchema.optional(),
  dependencyKeys: canonicalIdentifierListSchema,
  currentMaturity: capabilityMaturityAssessmentSchema,
  targetMaturity: capabilityMaturityAssessmentSchema,
  performanceEvidence: z.object({
    state: z.enum(["absent", "candidate", "observed", "disputed"]),
    statement: longTextSchema,
    sources: exactSourceListSchema,
  }).strict().superRefine((evidence, context) => {
    if (evidence.state === "observed" && evidence.sources.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["sources"],
        message: "Observed capability performance requires exact evidence",
      })
    }
  }),
  gaps: z.array(capabilityGapSchema).max(256)
    .refine((gaps) => hasUniqueValues(gaps.map((gap) => gap.id)), "Capability gap identities must be unique")
    .refine((gaps) => isCanonical(gaps.map((gap) => gap.id)), "Capability gaps must use canonical identity ordering"),
  priority: candidatePrioritySchema,
  dependencies: canonicalTextListSchema,
  burden: longTextSchema,
  risk: longTextSchema,
  exitPath: longTextSchema,
  lifecycle: businessCapabilityLifecycleSchema,
  sources: requiredExactSourceListSchema,
}).strict()

export const businessCapabilityMapInputSchema = rejectSecrets(z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  businessUnderstanding: exactBusinessUnderstandingReferenceSchema,
  stakeholderModel: exactStakeholderModelReferenceSchema,
  outcomeModel: exactBusinessUnderstandingReferenceSchema,
  capabilities: z.array(capabilityRecordSchema).min(1).max(512)
    .refine((capabilities) => hasUniqueValues(capabilities.map((capability) => capability.key)), "Capability keys must be unique")
    .refine((capabilities) => isCanonical(capabilities.map((capability) => capability.key)), "Capabilities must use canonical key ordering"),
  limitations: canonicalTextListSchema,
}).strict().superRefine((map, context) => {
  const capabilityKeys = new Set(map.capabilities.map((capability) => capability.key))
  const parentByKey = new Map<string, string>()
  for (const [index, capability] of map.capabilities.entries()) {
    if (capability.parentKey) {
      if (capability.parentKey === capability.key || !capabilityKeys.has(capability.parentKey)) {
        context.addIssue({
          code: "custom",
          path: ["capabilities", index, "parentKey"],
          message: "Capability parents must reference a distinct recorded capability",
        })
      } else {
        parentByKey.set(capability.key, capability.parentKey)
      }
    }
    if (
      capability.dependencyKeys.includes(capability.key) ||
      capability.dependencyKeys.some((dependency) => !capabilityKeys.has(dependency))
    ) {
      context.addIssue({
        code: "custom",
        path: ["capabilities", index, "dependencyKeys"],
        message: "Capability dependencies must reference distinct recorded capabilities",
      })
    }
  }
  for (const capability of map.capabilities) {
    const visited = new Set<string>([capability.key])
    let parent = capability.parentKey
    while (parent) {
      if (visited.has(parent)) {
        context.addIssue({
          code: "custom",
          path: ["capabilities"],
          message: "Capability parent hierarchy cannot contain cycles",
        })
        break
      }
      visited.add(parent)
      parent = parentByKey.get(parent)
    }
  }
}))

export const exactBusinessCapabilityMapReferenceSchema = exactBusinessUnderstandingReferenceSchema

export const businessCapabilityMapSchema = businessCapabilityMapInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("business-capability-map"),
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
    "business-capability-map-records-candidate-architecture-placement-ownership-gaps-and-priority-and-does-not-approve-baseline-readiness-or-authorize-action",
  ),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({
      code: "custom",
      path: ["predecessorDigest"],
      message: "Only Business Capability Map revisions after revision one require an exact predecessor digest",
    })
  }
})

export const businessCapabilityMapAssessmentSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("business-capability-map-assessment"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  capabilityMap: exactBusinessCapabilityMapReferenceSchema.optional(),
  capabilityCount: z.number().int().nonnegative().max(512),
  ownedCapabilityCount: z.number().int().nonnegative().max(512),
  unownedCapabilityCount: z.number().int().nonnegative().max(512),
  objectiveCoverageCount: z.number().int().nonnegative().max(256),
  outcomeCoverageCount: z.number().int().nonnegative().max(256),
  openGapCount: z.number().int().nonnegative(),
  criticalGapCount: z.number().int().nonnegative(),
  unknownCurrentMaturityCount: z.number().int().nonnegative().max(512),
  unassessedPriorityCount: z.number().int().nonnegative().max(512),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  state: z.enum(["complete-for-review", "attention-required"]),
  reasons: z.array(shortTextSchema).max(512),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "business-capability-map-assessment-reports-recorded-candidate-coverage-and-gaps-and-does-not-approve-priority-readiness-or-authorize-action",
  ),
}).strict()

export const businessCapabilityMapProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("business-capability-map-projection"),
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
  assessment: businessCapabilityMapAssessmentSchema,
  capabilityMap: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    state: z.literal("candidate"),
    capabilityCount: z.number().int().nonnegative().max(512),
    ownedCapabilityCount: z.number().int().nonnegative().max(512),
    openGapCount: z.number().int().nonnegative(),
    criticalGapCount: z.number().int().nonnegative(),
    candidatePriorityCount: z.number().int().nonnegative().max(512),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-identities-counts-statuses-and-digests-only-not-capability-narrative-personal-data-source-content-locators-or-credentials",
  ),
  authorityBoundary: z.literal(
    "business-capability-map-projection-does-not-approve-prioritize-baseline-designate-readiness-or-authorize-action",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (
    projection.product.id !== projection.assessment.productId ||
    projection.product.revision !== projection.assessment.productRevision ||
    projection.initiative.id !== projection.assessment.initiativeId ||
    projection.initiative.revision !== projection.assessment.initiativeRevision
  ) {
    context.addIssue({
      code: "custom",
      path: ["assessment"],
      message: "Business Capability Map projection must bind the exact Product and Initiative revisions",
    })
  }
})

export type BusinessCapabilityMapInput = z.infer<typeof businessCapabilityMapInputSchema>
export type BusinessCapabilityMap = z.infer<typeof businessCapabilityMapSchema>
export type ExactBusinessCapabilityMapReference = z.infer<typeof exactBusinessCapabilityMapReferenceSchema>
export type BusinessCapabilityMapAssessment = z.infer<typeof businessCapabilityMapAssessmentSchema>
export type BusinessCapabilityMapProjection = z.infer<typeof businessCapabilityMapProjectionSchema>
