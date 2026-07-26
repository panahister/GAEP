import { z } from "zod"

import { exactBusinessCapabilityMapReferenceSchema } from "./business-capability-map.js"
import {
  businessContextBindingSchema,
  exactBusinessUnderstandingReferenceSchema,
  exactStakeholderModelReferenceSchema,
} from "./business-understanding.js"
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
    message: "Portable Operating Model records cannot contain secret-shaped values",
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
  "Operating-model claims require at least one exact Source reference",
)

export const operatingGovernanceSystemSchema = z.enum([
  "gaep-governance",
  "initiative-governance",
])

export const candidateAuthorityStateSchema = z.enum(["unassigned", "candidate"])
export const operatingCapacityStateSchema = z.enum([
  "unassessed",
  "insufficient",
  "candidate-sufficient",
])

const candidateAuthoritySchema = z.object({
  state: candidateAuthorityStateSchema,
  basis: longTextSchema,
  sources: requiredExactSourceListSchema,
}).strict()

const operatingCapacitySchema = z.object({
  state: operatingCapacityStateSchema,
  fundingState: candidateAuthorityStateSchema,
  statement: longTextSchema,
  sources: requiredExactSourceListSchema,
}).strict()

const operatingRoleSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  governanceSystem: operatingGovernanceSystemSchema,
  accountableScope: longTextSchema,
  stakeholderKeys: requiredCanonicalIdentifierListSchema,
  capabilityKeys: requiredCanonicalIdentifierListSchema,
  valueStreamKeys: requiredCanonicalIdentifierListSchema,
  mustNotAssume: requiredCanonicalTextListSchema,
  appointingAuthority: candidateAuthoritySchema,
  competenceExpectations: requiredCanonicalTextListSchema,
  delegationRule: longTextSchema,
  conflictRule: longTextSchema,
  successionOrBackup: longTextSchema,
  validityRule: longTextSchema,
  capacity: operatingCapacitySchema,
  sources: requiredExactSourceListSchema,
}).strict()

const operatingDecisionRightSchema = z.object({
  key: identifierSchema,
  subject: longTextSchema,
  governanceSystem: operatingGovernanceSystemSchema,
  accountableRoleKey: identifierSchema,
  consultedRoleKeys: canonicalIdentifierListSchema,
  valueStreamKeys: requiredCanonicalIdentifierListSchema,
  evidenceRequirements: requiredCanonicalTextListSchema,
  separateApprovalConcern: longTextSchema,
  authority: candidateAuthoritySchema,
  sources: requiredExactSourceListSchema,
}).strict()

const operatingForumSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  purpose: longTextSchema,
  participatingRoleKeys: requiredCanonicalIdentifierListSchema,
  decisionRightKeys: canonicalIdentifierListSchema,
  boundaries: requiredCanonicalTextListSchema,
  sources: requiredExactSourceListSchema,
}).strict()

const operatingCycleSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  ownerRoleKey: identifierSchema,
  steps: z.array(shortTextSchema).min(2).max(64),
  escalationRoleKey: identifierSchema,
  sources: requiredExactSourceListSchema,
}).strict()

const operatingSupportModelSchema = z.object({
  scope: requiredCanonicalTextListSchema,
  knownLimitations: canonicalTextListSchema,
  compatibilityPolicy: longTextSchema,
  deprecationPolicy: longTextSchema,
  incidentPath: longTextSchema,
  appealPath: longTextSchema,
  escalationPath: longTextSchema,
  fallback: longTextSchema,
  responseTarget: longTextSchema,
  laborMeasurement: longTextSchema,
  capacity: operatingCapacitySchema,
  sources: requiredExactSourceListSchema,
}).strict()

const emergencyActionModelSchema = z.object({
  ownerRoleKey: identifierSchema,
  scopeRule: longTextSchema,
  reasonRule: longTextSchema,
  evidenceRule: longTextSchema,
  recoveryRule: longTextSchema,
  expiryRule: longTextSchema,
  retrospectiveReviewRule: longTextSchema,
  authority: candidateAuthoritySchema,
  sources: requiredExactSourceListSchema,
}).strict()

export const operatingModelInputSchema = rejectSecrets(z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  businessUnderstanding: exactBusinessUnderstandingReferenceSchema,
  stakeholderModel: exactStakeholderModelReferenceSchema,
  outcomeModel: exactBusinessUnderstandingReferenceSchema,
  capabilityMap: exactBusinessCapabilityMapReferenceSchema,
  valueStreamModel: exactValueStreamModelReferenceSchema,
  roles: z.array(operatingRoleSchema).min(2).max(256)
    .refine((roles) => hasUniqueValues(roles.map((role) => role.key)), "Operating role keys must be unique")
    .refine((roles) => isCanonical(roles.map((role) => role.key)), "Operating roles must use canonical key ordering"),
  decisionRights: z.array(operatingDecisionRightSchema).min(2).max(512)
    .refine((rights) => hasUniqueValues(rights.map((right) => right.key)), "Decision-right keys must be unique")
    .refine((rights) => isCanonical(rights.map((right) => right.key)), "Decision rights must use canonical key ordering"),
  forums: z.array(operatingForumSchema).max(128)
    .refine((forums) => hasUniqueValues(forums.map((forum) => forum.key)), "Operating forum keys must be unique")
    .refine((forums) => isCanonical(forums.map((forum) => forum.key)), "Operating forums must use canonical key ordering"),
  cycles: z.array(operatingCycleSchema).min(1).max(128)
    .refine((cycles) => hasUniqueValues(cycles.map((cycle) => cycle.key)), "Operating cycle keys must be unique")
    .refine((cycles) => isCanonical(cycles.map((cycle) => cycle.key)), "Operating cycles must use canonical key ordering"),
  supportModel: operatingSupportModelSchema,
  emergencyActionModel: emergencyActionModelSchema,
  limitations: canonicalTextListSchema,
}).strict().superRefine((model, context) => {
  const roleKeys = new Set(model.roles.map((role) => role.key))
  const decisionKeys = new Set(model.decisionRights.map((right) => right.key))
  const systems = new Set(model.roles.map((role) => role.governanceSystem))
  const decisionSystems = new Set(model.decisionRights.map((right) => right.governanceSystem))
  if (systems.size !== operatingGovernanceSystemSchema.options.length ||
      decisionSystems.size !== operatingGovernanceSystemSchema.options.length) {
    context.addIssue({
      code: "custom",
      path: ["roles"],
      message: "Operating Model must distinguish GAEP governance from Initiative governance",
    })
  }
  for (const [index, right] of model.decisionRights.entries()) {
    if (!roleKeys.has(right.accountableRoleKey) || right.consultedRoleKeys.some((key) => !roleKeys.has(key))) {
      context.addIssue({
        code: "custom",
        path: ["decisionRights", index],
        message: "Decision rights must reference recorded operating roles",
      })
    }
  }
  for (const [index, forum] of model.forums.entries()) {
    if (forum.participatingRoleKeys.some((key) => !roleKeys.has(key)) ||
        forum.decisionRightKeys.some((key) => !decisionKeys.has(key))) {
      context.addIssue({
        code: "custom",
        path: ["forums", index],
        message: "Operating forums must reference recorded roles and decision rights",
      })
    }
  }
  for (const [index, cycle] of model.cycles.entries()) {
    if (!roleKeys.has(cycle.ownerRoleKey) || !roleKeys.has(cycle.escalationRoleKey)) {
      context.addIssue({
        code: "custom",
        path: ["cycles", index],
        message: "Operating cycles must reference recorded owner and escalation roles",
      })
    }
  }
  if (!roleKeys.has(model.emergencyActionModel.ownerRoleKey)) {
    context.addIssue({
      code: "custom",
      path: ["emergencyActionModel", "ownerRoleKey"],
      message: "Emergency action owner must reference a recorded operating role",
    })
  }
}))

export const exactOperatingModelReferenceSchema = exactBusinessUnderstandingReferenceSchema

export const operatingModelSchema = operatingModelInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("operating-model"),
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
    "operating-model-records-candidate-roles-responsibilities-decision-rights-capacity-support-and-emergency-boundaries-and-does-not-appoint-fund-approve-baseline-or-authorize-action",
  ),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({
      code: "custom",
      path: ["predecessorDigest"],
      message: "Only Operating Model revisions after revision one require an exact predecessor digest",
    })
  }
})

export const operatingModelAssessmentSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("operating-model-assessment"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  operatingModel: exactOperatingModelReferenceSchema.optional(),
  roleCount: z.number().int().nonnegative().max(256),
  governanceSystemCount: z.number().int().nonnegative().max(2),
  unassignedAppointingAuthorityCount: z.number().int().nonnegative().max(256),
  insufficientCapacityCount: z.number().int().nonnegative().max(256),
  unfundedCapacityCount: z.number().int().nonnegative().max(256),
  decisionRightCount: z.number().int().nonnegative().max(512),
  unassignedDecisionAuthorityCount: z.number().int().nonnegative().max(512),
  forumCount: z.number().int().nonnegative().max(128),
  cycleCount: z.number().int().nonnegative().max(128),
  supportCapacityGapCount: z.number().int().nonnegative().max(1),
  emergencyAuthorityGapCount: z.number().int().nonnegative().max(1),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  state: z.enum(["complete-for-review", "attention-required"]),
  reasons: z.array(shortTextSchema).max(512),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "operating-model-assessment-reports-candidate-structural-coverage-and-gaps-and-does-not-appoint-fund-approve-baseline-readiness-or-authorize-action",
  ),
}).strict()

export const operatingModelProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("operating-model-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  }).strict(),
  assessment: operatingModelAssessmentSchema,
  operatingModel: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    state: z.literal("candidate"),
    roleCount: z.number().int().nonnegative().max(256),
    decisionRightCount: z.number().int().nonnegative().max(512),
    forumCount: z.number().int().nonnegative().max(128),
    cycleCount: z.number().int().nonnegative().max(128),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-identities-counts-statuses-and-digests-only-not-operating-narrative-personal-data-source-content-locators-or-credentials",
  ),
  authorityBoundary: z.literal(
    "operating-model-projection-does-not-appoint-fund-approve-baseline-readiness-or-authorize-action",
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
      message: "Operating Model projection must bind the exact Product and Initiative revisions",
    })
  }
})

export type OperatingModelInput = z.infer<typeof operatingModelInputSchema>
export type OperatingModel = z.infer<typeof operatingModelSchema>
export type ExactOperatingModelReference = z.infer<typeof exactOperatingModelReferenceSchema>
export type OperatingModelAssessment = z.infer<typeof operatingModelAssessmentSchema>
export type OperatingModelProjection = z.infer<typeof operatingModelProjectionSchema>
