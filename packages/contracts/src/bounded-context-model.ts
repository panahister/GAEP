import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
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
    message: "Portable Bounded Context and Ownership candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const boundedContextDomainTypeSchema = z.enum(["core", "supporting", "generic", "unresolved"])

export const boundedContextRelationshipPatternSchema = z.enum([
  "anti-corruption-layer",
  "conformist",
  "customer-supplier",
  "open-host-service",
  "partnership",
  "published-language",
  "separate-ways",
  "shared-kernel",
  "unresolved",
])

export const boundedContextContractKindSchema = z.enum([
  "api",
  "command",
  "data",
  "event",
  "file",
  "query",
  "service",
])

const ubiquitousLanguageTermSchema = z.object({
  key: identifierSchema,
  term: z.string().trim().min(2).max(240),
  definition: longTextSchema,
  aliases: canonicalTextListSchema,
  ambiguityNotes: canonicalTextListSchema,
  sources: exactSourceListSchema,
}).strict()

const boundedContextSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  domainType: boundedContextDomainTypeSchema,
  purpose: longTextSchema,
  responsibilities: requiredCanonicalTextListSchema,
  excludedResponsibilities: requiredCanonicalTextListSchema,
  architectureElementKeys: requiredCanonicalIdentifierListSchema,
  dataAssetElementKeys: canonicalIdentifierListSchema,
  ownerRoleKey: identifierSchema,
  stewardRoleKeys: requiredCanonicalIdentifierListSchema,
  ownershipState: z.literal("candidate-not-accepted"),
  ubiquitousLanguage: z.array(ubiquitousLanguageTermSchema).min(1).max(1_024)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Ubiquitous-language keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Ubiquitous-language terms must use canonical key ordering"),
  invariants: requiredCanonicalTextListSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((entry, context) => {
  if (entry.dataAssetElementKeys.some((key) => !entry.architectureElementKeys.includes(key))) {
    context.addIssue({ code: "custom", path: ["dataAssetElementKeys"], message: "Owned data assets must be assigned to the same bounded context" })
  }
})

const boundedContextContractSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  kind: boundedContextContractKindSchema,
  providerContextKey: identifierSchema,
  consumerContextKeys: requiredCanonicalIdentifierListSchema,
  architectureRelationKeys: requiredCanonicalIdentifierListSchema,
  ownerRoleKey: identifierSchema,
  versioning: longTextSchema,
  compatibility: longTextSchema,
  consistency: longTextSchema,
  failureBehavior: longTextSchema,
  state: z.enum(["candidate", "unresolved"]),
  sources: exactSourceListSchema,
}).strict().superRefine((entry, context) => {
  if (entry.consumerContextKeys.includes(entry.providerContextKey)) {
    context.addIssue({ code: "custom", message: "A cross-context contract cannot consume itself" })
  }
})

const boundedContextRelationshipSchema = z.object({
  key: identifierSchema,
  upstreamContextKey: identifierSchema,
  downstreamContextKey: identifierSchema,
  pattern: boundedContextRelationshipPatternSchema,
  contractKeys: requiredCanonicalIdentifierListSchema,
  rationale: longTextSchema,
  changeCoordination: longTextSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((entry, context) => {
  if (entry.upstreamContextKey === entry.downstreamContextKey) {
    context.addIssue({ code: "custom", message: "Context-map relationships must connect distinct bounded contexts" })
  }
})

const boundedContextGovernanceSchema = z.object({
  ownerRoleKey: identifierSchema,
  reviewerRoleKeys: requiredCanonicalIdentifierListSchema,
  boundaryApprovalState: z.literal("not-granted"),
  ownershipAcceptanceState: z.literal("not-granted"),
  reviewState: z.enum(["draft", "under-challenge", "awaiting-human-review"]),
  basis: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

const boundedContextModelInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  purpose: longTextSchema,
  systemSolutionArchitecture: exactSystemSolutionArchitectureReferenceSchema,
  boundedContexts: z.array(boundedContextSchema).min(1).max(1_024)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Bounded Context keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Bounded Contexts must use canonical key ordering"),
  contracts: z.array(boundedContextContractSchema).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Cross-context contract keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Cross-context contracts must use canonical key ordering"),
  relationships: z.array(boundedContextRelationshipSchema).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Context-map relationship keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Context-map relationships must use canonical key ordering"),
  inconsistencies: canonicalTextListSchema,
  unresolvedQuestions: canonicalTextListSchema,
  governance: boundedContextGovernanceSchema,
  limitations: canonicalTextListSchema,
}).strict().superRefine((record, context) => {
  const boundedContexts = new Set(record.boundedContexts.map((entry) => entry.key))
  const contracts = new Set(record.contracts.map((entry) => entry.key))
  const assignedElements = record.boundedContexts.flatMap((entry) => entry.architectureElementKeys)
  const ownedDataAssets = record.boundedContexts.flatMap((entry) => entry.dataAssetElementKeys)
  if (!unique(assignedElements)) {
    context.addIssue({ code: "custom", path: ["boundedContexts"], message: "Each architecture element must be assigned to at most one bounded context" })
  }
  if (!unique(ownedDataAssets)) {
    context.addIssue({ code: "custom", path: ["boundedContexts"], message: "Each data asset must have exactly one candidate owning bounded context" })
  }
  for (const contract of record.contracts) {
    if (!boundedContexts.has(contract.providerContextKey) ||
        contract.consumerContextKeys.some((key) => !boundedContexts.has(key))) {
      context.addIssue({ code: "custom", path: ["contracts"], message: "Cross-context contracts must reference declared bounded contexts" })
    }
  }
  for (const relationship of record.relationships) {
    if (!boundedContexts.has(relationship.upstreamContextKey) ||
        !boundedContexts.has(relationship.downstreamContextKey) ||
        relationship.contractKeys.some((key) => !contracts.has(key))) {
      context.addIssue({ code: "custom", path: ["relationships"], message: "Context-map relationships must reference declared bounded contexts and contracts" })
    }
    for (const contractKey of relationship.contractKeys) {
      const contract = record.contracts.find((entry) => entry.key === contractKey)
      if (contract && (contract.providerContextKey !== relationship.upstreamContextKey ||
          !contract.consumerContextKeys.includes(relationship.downstreamContextKey))) {
        context.addIssue({ code: "custom", path: ["relationships"], message: "Relationship direction must match its provider and consumer contract direction" })
      }
    }
  }
  const relatedContracts = new Set(record.relationships.flatMap((entry) => entry.contractKeys))
  if (record.contracts.some((entry) => !relatedContracts.has(entry.key))) {
    context.addIssue({ code: "custom", path: ["relationships"], message: "Every cross-context contract must appear in a context-map relationship" })
  }
})

export const boundedContextModelInputSchema = rejectSecrets(boundedContextModelInputBaseSchema)

export const boundedContextModelSchema = boundedContextModelInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("bounded-context-ownership-candidate"),
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
    "bounded-context-model-is-a-candidate-boundary-and-ownership-record-and-does-not-appoint-an-owner-approve-a-boundary-accept-a-contract-establish-readiness-or-authorize-action",
  ),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Bounded Context Model revisions after revision one require an exact predecessor digest" })
  }
})

export const exactBoundedContextModelReferenceSchema = exactSystemSolutionArchitectureReferenceSchema

export const boundedContextModelAssessmentSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("bounded-context-ownership-assessment"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  model: exactBoundedContextModelReferenceSchema.optional(),
  boundedContextCount: z.number().int().nonnegative().max(1_024),
  coreContextCount: z.number().int().nonnegative().max(1_024),
  languageTermCount: z.number().int().nonnegative().max(1_048_576),
  contractCount: z.number().int().nonnegative().max(4_096),
  unresolvedContractCount: z.number().int().nonnegative().max(4_096),
  relationshipCount: z.number().int().nonnegative().max(4_096),
  unresolvedRelationshipCount: z.number().int().nonnegative().max(4_096),
  unassignedArchitectureElementCount: z.number().int().nonnegative().max(2_048),
  unownedDataAssetCount: z.number().int().nonnegative().max(2_048),
  unmappedCrossContextRelationCount: z.number().int().nonnegative().max(4_096),
  inconsistencyCount: z.number().int().nonnegative().max(512),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  state: z.enum(["complete-for-review", "attention-required"]),
  reasons: z.array(shortTextSchema).max(512),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "bounded-context-model-assessment-reports-candidate-coverage-and-gaps-and-does-not-appoint-owners-approve-boundaries-accept-contracts-establish-readiness-or-authorize-action",
  ),
}).strict()

export const boundedContextModelProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("bounded-context-ownership-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  }).strict(),
  assessment: boundedContextModelAssessmentSchema,
  model: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    membershipDigest: digestSchema,
    state: z.literal("candidate"),
    boundedContextCount: z.number().int().nonnegative().max(1_024),
    contractCount: z.number().int().nonnegative().max(4_096),
    relationshipCount: z.number().int().nonnegative().max(4_096),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-identities-counts-statuses-and-digests-only-not-boundary-language-contract-source-content-personal-data-locators-or-credentials",
  ),
  authorityBoundary: z.literal(
    "bounded-context-model-projection-does-not-appoint-owners-approve-boundaries-accept-contracts-establish-readiness-or-authorize-action",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.assessment.productId ||
      projection.product.revision !== projection.assessment.productRevision ||
      projection.initiative.id !== projection.assessment.initiativeId ||
      projection.initiative.revision !== projection.assessment.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["assessment"], message: "Bounded Context projection must bind the exact Product and Initiative revisions" })
  }
})

export type BoundedContextModelInput = z.infer<typeof boundedContextModelInputSchema>
export type BoundedContextModel = z.infer<typeof boundedContextModelSchema>
export type ExactBoundedContextModelReference = z.infer<typeof exactBoundedContextModelReferenceSchema>
export type BoundedContextModelAssessment = z.infer<typeof boundedContextModelAssessmentSchema>
export type BoundedContextModelProjection = z.infer<typeof boundedContextModelProjectionSchema>
