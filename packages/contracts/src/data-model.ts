import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { exactBoundedContextModelReferenceSchema } from "./bounded-context-model.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactProcessModelReferenceSchema } from "./process-model.js"
import {
  dataPrivacyRequirementIds,
  exactSecurityPrivacyAssessmentReferenceSchema,
} from "./security-privacy-assessment.js"
import { exactSourceReferenceSchema } from "./source-governance.js"
import { exactSystemSolutionArchitectureReferenceSchema } from "./system-solution-architecture.js"

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

function canonicalArray<T extends z.ZodType>(schema: T, maximum = 2_048) {
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

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Data Model candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const dataModelRequirementIds = dataPrivacyRequirementIds

export const dataEntityKindSchema = z.enum([
  "aggregate-root",
  "entity",
  "event-record",
  "external-record",
  "projection",
  "reference-data",
  "value-object",
])

export const dataValueKindSchema = z.enum([
  "binary",
  "boolean",
  "date-time",
  "decimal",
  "enumeration",
  "identifier",
  "integer",
  "structured",
  "text",
])

const dataAttributeSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  valueKind: dataValueKindSchema,
  required: z.boolean(),
  identifierRole: z.enum(["correlation", "foreign", "natural", "none", "surrogate"]),
  meaning: longTextSchema,
  classification: informationClassificationSchema,
  containsPersonalData: z.boolean(),
  dataClassKeys: requiredCanonicalIdentifierListSchema,
  constraints: requiredCanonicalTextListSchema,
  sources: exactSourceListSchema,
}).strict()

const dataEntitySchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  kind: dataEntityKindSchema,
  meaning: longTextSchema,
  boundedContextKey: identifierSchema,
  architectureElementKeys: requiredCanonicalIdentifierListSchema,
  processKeys: requiredCanonicalIdentifierListSchema,
  dataClassKeys: requiredCanonicalIdentifierListSchema,
  ownerRoleKey: identifierSchema,
  stewardRoleKeys: requiredCanonicalIdentifierListSchema,
  ownershipState: z.literal("candidate-not-accepted"),
  systemOfRecordState: z.enum(["candidate-declared", "not-applicable", "unresolved"]),
  attributes: z.array(dataAttributeSchema).min(1).max(2_048)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Entity attribute keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Entity attributes must use canonical key ordering"),
  invariants: requiredCanonicalTextListSchema,
  sources: exactSourceListSchema,
}).strict()

const dataRelationshipSchema = z.object({
  key: identifierSchema,
  fromEntityKey: identifierSchema,
  toEntityKey: identifierSchema,
  kind: z.enum(["association", "composition", "derivation", "reference", "specialization"]),
  cardinality: z.enum(["many-to-many", "many-to-one", "one-to-many", "one-to-one"]),
  ownership: z.enum(["from-owns", "independent", "to-owns", "unresolved"]),
  integrity: longTextSchema,
  consistency: longTextSchema,
  deletionBehavior: longTextSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((relationship, context) => {
  if (relationship.fromEntityKey === relationship.toEntityKey) {
    context.addIssue({ code: "custom", message: "Data relationships must connect distinct entities" })
  }
})

const dataLifecycleStateSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  meaning: longTextSchema,
  terminal: z.boolean(),
  sources: exactSourceListSchema,
}).strict()

const dataLifecycleSchema = z.object({
  key: identifierSchema,
  entityKeys: requiredCanonicalIdentifierListSchema,
  initialStateKey: identifierSchema,
  states: z.array(dataLifecycleStateSchema).min(2).max(256)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Data lifecycle states must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Data lifecycle states must use canonical key ordering"),
  retention: longTextSchema,
  archival: longTextSchema,
  deletion: longTextSchema,
  correction: longTextSchema,
  legalHold: longTextSchema,
  backupAndRecovery: longTextSchema,
  migrationAndCompatibility: longTextSchema,
  dispositionAuthorityState: z.literal("not-granted"),
  sources: exactSourceListSchema,
}).strict().superRefine((lifecycle, context) => {
  if (!lifecycle.states.some((state) => state.key === lifecycle.initialStateKey)) {
    context.addIssue({ code: "custom", path: ["initialStateKey"], message: "Initial lifecycle state must be declared" })
  }
})

const dataTransformationSchema = z.object({
  key: identifierSchema,
  sourceEntityKeys: requiredCanonicalIdentifierListSchema,
  targetEntityKeys: requiredCanonicalIdentifierListSchema,
  processKeys: requiredCanonicalIdentifierListSchema,
  dataFlowKeys: requiredCanonicalIdentifierListSchema,
  purpose: longTextSchema,
  minimization: longTextSchema,
  correctionAndDeletionPropagation: longTextSchema,
  providerAndModelUse: longTextSchema,
  integrityAndLineage: longTextSchema,
  state: z.enum(["candidate", "unresolved"]),
  sources: exactSourceListSchema,
}).strict()

const dataRequirementCoverageSchema = z.object({
  requirementId: z.enum(dataModelRequirementIds),
  state: z.enum(["covered-candidate", "not-applicable-candidate", "unresolved"]),
  entityKeys: canonicalIdentifierListSchema,
  lifecycleKeys: canonicalIdentifierListSchema,
  transformationKeys: canonicalIdentifierListSchema,
  basis: longTextSchema,
  evidence: exactSourceListSchema,
}).strict()

const dataModelGovernanceSchema = z.object({
  dataOwnerRoleKeys: requiredCanonicalIdentifierListSchema,
  dataStewardRoleKeys: requiredCanonicalIdentifierListSchema,
  privacyReviewerRoleKeys: requiredCanonicalIdentifierListSchema,
  modelApprovalState: z.literal("not-granted"),
  classificationApprovalState: z.literal("not-granted"),
  ownershipAcceptanceState: z.literal("not-granted"),
  migrationAuthorityState: z.literal("not-granted"),
  operationalReadinessState: z.literal("not-established"),
  reviewState: z.enum(["awaiting-human-review", "draft", "under-challenge"]),
  basis: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

const dataModelInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  scope: longTextSchema,
  systemSolutionArchitecture: exactSystemSolutionArchitectureReferenceSchema,
  boundedContextModel: exactBoundedContextModelReferenceSchema,
  operatingModel: exactBoundedContextModelReferenceSchema,
  securityPrivacyAssessment: exactSecurityPrivacyAssessmentReferenceSchema,
  processModel: exactProcessModelReferenceSchema,
  entities: z.array(dataEntitySchema).min(1).max(2_048)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Data entity keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Data entities must use canonical key ordering"),
  relationships: z.array(dataRelationshipSchema).max(8_192)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Data relationship keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Data relationships must use canonical key ordering"),
  lifecycles: z.array(dataLifecycleSchema).min(1).max(2_048)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Data lifecycle keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Data lifecycles must use canonical key ordering"),
  transformations: z.array(dataTransformationSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Data transformation keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Data transformations must use canonical key ordering"),
  requirementCoverage: z.array(dataRequirementCoverageSchema).length(dataModelRequirementIds.length)
    .refine((entries) => unique(entries.map((entry) => entry.requirementId)), "Requirement coverage must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.requirementId)), "Requirement coverage must use canonical ID ordering"),
  assumptions: canonicalTextListSchema,
  inconsistencies: canonicalTextListSchema,
  unresolvedQuestions: canonicalTextListSchema,
  governance: dataModelGovernanceSchema,
  limitations: canonicalTextListSchema,
}).strict().superRefine((record, context) => {
  const expected = [...dataModelRequirementIds].sort((left, right) => left.localeCompare(right))
  if (record.requirementCoverage.some((entry, index) => entry.requirementId !== expected[index])) {
    context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must contain the complete canonical Data Profile catalog" })
  }
  const entityKeys = new Set(record.entities.map((entry) => entry.key))
  const lifecycleKeys = new Set(record.lifecycles.map((entry) => entry.key))
  const transformationKeys = new Set(record.transformations.map((entry) => entry.key))
  for (const relationship of record.relationships) {
    if (!entityKeys.has(relationship.fromEntityKey) || !entityKeys.has(relationship.toEntityKey)) {
      context.addIssue({ code: "custom", path: ["relationships"], message: "Data relationships must reference declared entities" })
    }
  }
  for (const lifecycle of record.lifecycles) {
    if (lifecycle.entityKeys.some((key) => !entityKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["lifecycles"], message: "Data lifecycles must reference declared entities" })
    }
  }
  const lifecycleEntities = new Set(record.lifecycles.flatMap((entry) => entry.entityKeys))
  if ([...entityKeys].some((key) => !lifecycleEntities.has(key))) {
    context.addIssue({ code: "custom", path: ["lifecycles"], message: "Every data entity requires explicit lifecycle coverage" })
  }
  for (const transformation of record.transformations) {
    if (transformation.sourceEntityKeys.some((key) => !entityKeys.has(key)) ||
        transformation.targetEntityKeys.some((key) => !entityKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["transformations"], message: "Data transformations must reference declared entities" })
    }
  }
  for (const coverage of record.requirementCoverage) {
    if (coverage.entityKeys.some((key) => !entityKeys.has(key)) ||
        coverage.lifecycleKeys.some((key) => !lifecycleKeys.has(key)) ||
        coverage.transformationKeys.some((key) => !transformationKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must reference declared data-model subjects" })
    }
  }
})

export const dataModelInputSchema = rejectSecrets(dataModelInputBaseSchema)

export const dataModelSchema = dataModelInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("data-model-candidate"),
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
    "data-model-is-a-candidate-record-and-does-not-approve-a-data-model-or-classification-appoint-ownership-grant-migration-authority-establish-operational-readiness-or-authorize-action",
  ),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Data Model revisions after revision one require an exact predecessor digest" })
  }
})

export const exactDataModelReferenceSchema = exactBoundedContextModelReferenceSchema

export const dataModelStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("data-model-status"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  model: exactDataModelReferenceSchema.optional(),
  entityCount: z.number().int().nonnegative().max(2_048),
  attributeCount: z.number().int().nonnegative().max(131_072),
  relationshipCount: z.number().int().nonnegative().max(8_192),
  lifecycleCount: z.number().int().nonnegative().max(2_048),
  transformationCount: z.number().int().nonnegative().max(4_096),
  uncoveredBoundedContextCount: z.number().int().nonnegative().max(2_048),
  uncoveredSecurityDataClassCount: z.number().int().nonnegative().max(2_048),
  uncoveredProcessCount: z.number().int().nonnegative().max(512),
  unresolvedSystemOfRecordCount: z.number().int().nonnegative().max(2_048),
  unresolvedTransformationCount: z.number().int().nonnegative().max(4_096),
  unresolvedRequirementCount: z.number().int().nonnegative().max(dataModelRequirementIds.length),
  inconsistencyCount: z.number().int().nonnegative().max(512),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(512),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "data-model-status-reports-candidate-coverage-and-gaps-and-does-not-approve-a-data-model-or-classification-appoint-ownership-grant-migration-authority-establish-operational-readiness-or-authorize-action",
  ),
}).strict()

export const dataModelProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("data-model-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: dataModelStatusSchema,
  model: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    membershipDigest: digestSchema,
    state: z.literal("candidate"),
    entityCount: z.number().int().nonnegative().max(2_048),
    relationshipCount: z.number().int().nonnegative().max(8_192),
    lifecycleCount: z.number().int().nonnegative().max(2_048),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-identities-counts-statuses-and-digests-only-not-entity-attributes-relationships-lifecycle-content-source-content-personal-data-locators-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "data-model-projection-does-not-approve-a-data-model-or-classification-appoint-ownership-grant-migration-authority-establish-operational-readiness-or-authorize-action",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId ||
      projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId ||
      projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Data Model projection must bind the exact Product and Initiative revisions" })
  }
})

export type DataModelInput = z.infer<typeof dataModelInputSchema>
export type DataModel = z.infer<typeof dataModelSchema>
export type ExactDataModelReference = z.infer<typeof exactDataModelReferenceSchema>
export type DataModelStatus = z.infer<typeof dataModelStatusSchema>
export type DataModelProjection = z.infer<typeof dataModelProjectionSchema>
