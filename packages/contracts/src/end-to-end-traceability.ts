import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { exactEvidenceRegistryReferenceSchema } from "./evidence-registry.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactSourceReferenceSchema } from "./source-governance.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const longTextSchema = z.string().trim().min(10).max(20_000)
const actorSchema = z.object({ kind: z.enum(["agent", "human", "system"]), id: shortTextSchema }).strict()
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
const canonicalTextListSchema = canonicalArray(shortTextSchema, 512)
const requiredCanonicalTextListSchema = canonicalTextListSchema.refine(
  (values) => values.length > 0,
  "At least one value is required",
)

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable End-to-End Traceability candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const endToEndTraceabilityRequirementIds = [
  "GAEP-CAE-REQ-019",
  "GAEP-RESVER-REQ-001",
  "GAEP-RESVER-REQ-002",
  "GAEP-RESVER-REQ-003",
  "GAEP-RESVER-REQ-006",
  "GAEP-RESVER-REQ-007",
  "GAEP-RESVER-REQ-008",
  "GAEP-RESVER-REQ-013",
  "GAEP-RESVER-REQ-015",
  "GAEP-SCOPE-REQ-018",
  "GAEP-SCOPE-REQ-021",
  "GAEP-STATE-REQ-019",
  "GAEP-TPS-REQ-002",
  "GAEP-TPS-REQ-004",
  "GAEP-TPS-REQ-005",
  "GAEP-TPS-REQ-006",
  "GAEP-TPS-REQ-007",
  "GAEP-TPS-REQ-009",
  "GAEP-TPS-REQ-010",
  "GAEP-TPS-REQ-015",
  "GAEP-TPS-REQ-024",
] as const

export const traceabilitySubjectKindSchema = z.enum([
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
  "decision-record",
  "decision-register",
  "event-integration-model",
  "evidence-record",
  "evidence-registry",
  "failure-recovery-model",
  "initiative",
  "operating-model",
  "outcome-model",
  "process-model",
  "product",
  "product-design-revision",
  "requirement",
  "risk-record",
  "risk-register",
  "security-privacy-assessment",
  "source-record",
  "stakeholder-model",
  "system-solution-architecture",
  "value-stream-model",
  "work-item",
])

export const exactTraceabilitySubjectReferenceSchema = z.object({
  recordKind: traceabilitySubjectKindSchema,
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
  elementKeys: canonicalIdentifierListSchema,
}).strict()

const exactSourceListSchema = z.array(exactSourceReferenceSchema).min(1).max(256)
  .refine(
    (references) => unique(references.map((reference) =>
      `${reference.sourceId}:${reference.sourceRevision}:${reference.recordDigest}:${reference.contentDigest}`)),
    "Exact Source references must be unique",
  )
  .superRefine((references, context) => {
    const keys = references.map((reference) =>
      `${reference.sourceId}:${String(reference.sourceRevision).padStart(12, "0")}`)
    if (!canonical(keys)) context.addIssue({ code: "custom", message: "Exact Source references must use canonical identity ordering" })
  })

const traceabilityNodeSchema = z.object({
  key: identifierSchema,
  subject: exactTraceabilitySubjectReferenceSchema,
  scope: requiredCanonicalTextListSchema,
  sources: exactSourceListSchema,
  lifecycle: z.enum(["candidate", "current-candidate", "historical-candidate", "invalidated-candidate", "stale-candidate"]),
  authorityState: z.literal("not-established"),
}).strict()

const relationshipDefinitionSchema = z.object({
  key: identifierSchema,
  namespace: identifierSchema,
  registryRevision: z.number().int().positive(),
  definitionDigest: digestSchema,
  sourceKinds: z.array(traceabilitySubjectKindSchema).min(1)
    .refine((values) => unique(values), "Relationship source kinds must be unique")
    .refine((values) => canonical(values), "Relationship source kinds must use canonical ordering"),
  targetKinds: z.array(traceabilitySubjectKindSchema).min(1)
    .refine((values) => unique(values), "Relationship target kinds must be unique")
    .refine((values) => canonical(values), "Relationship target kinds must use canonical ordering"),
  direction: z.enum(["directed", "undirected"]),
  inverseRelationshipKey: identifierSchema.optional(),
  transitivity: z.enum(["not-transitive", "transitive"]),
  symmetry: z.enum(["asymmetric", "symmetric"]),
  impactBehavior: z.enum(["direct", "informational", "none", "possible", "probable"]),
  sourceCardinality: z.enum(["many", "one", "zero-or-one"]),
  targetCardinality: z.enum(["many", "one", "zero-or-one"]),
  lifecycle: z.enum(["candidate", "provisional"]),
  authoritativeUseState: z.literal("not-established"),
  rationale: longTextSchema,
  invalidationTriggers: requiredCanonicalTextListSchema,
  authorityBoundary: z.literal(
    "relationship-definition-is-candidate-semantics-and-does-not-by-registration-establish-a-relationship-approval-baseline-readiness-or-action-authority",
  ),
}).strict().superRefine((relationship, context) => {
  if (relationship.direction === "undirected" && relationship.symmetry !== "symmetric") {
    context.addIssue({ code: "custom", path: ["symmetry"], message: "Undirected relationship definitions must be symmetric" })
  }
  if (relationship.symmetry === "symmetric" && relationship.inverseRelationshipKey !== undefined) {
    context.addIssue({ code: "custom", path: ["inverseRelationshipKey"], message: "Symmetric relationships do not declare a distinct inverse" })
  }
})

const traceVerificationSchema = z.object({
  endpointResolution: z.enum(["resolved", "unresolved"]),
  semanticFitness: z.enum(["fit", "not-assessed", "not-fit"]),
  verifier: humanActorSchema.optional(),
  verifiedAt: z.string().datetime().optional(),
  methodName: shortTextSchema.optional(),
  methodVersion: shortTextSchema.optional(),
  rationale: longTextSchema,
  authorityBoundary: z.literal(
    "trace-verification-establishes-only-scoped-endpoint-and-semantic-assessment-not-approval-baseline-readiness-or-action-authority",
  ),
}).strict().superRefine((verification, context) => {
  const attributed = verification.verifier !== undefined || verification.verifiedAt !== undefined ||
    verification.methodName !== undefined || verification.methodVersion !== undefined
  if (verification.semanticFitness === "not-assessed" && attributed) {
    context.addIssue({ code: "custom", message: "Not-assessed semantic fitness must not carry invented human attribution" })
  }
  if (verification.semanticFitness !== "not-assessed" && (!verification.verifier || !verification.verifiedAt ||
      !verification.methodName || !verification.methodVersion)) {
    context.addIssue({ code: "custom", message: "Assessed semantic fitness requires an exact human verifier, time and method" })
  }
  if (verification.semanticFitness === "fit" && verification.endpointResolution !== "resolved") {
    context.addIssue({ code: "custom", path: ["endpointResolution"], message: "Semantic fitness cannot be fit while endpoints are unresolved" })
  }
})

const traceabilityLinkSchema = z.object({
  key: identifierSchema,
  sourceNodeKey: identifierSchema,
  targetNodeKey: identifierSchema,
  relationshipKey: identifierSchema,
  scope: requiredCanonicalTextListSchema,
  rationale: longTextSchema,
  provenance: z.object({
    kind: z.enum(["human-asserted", "imported", "inferred", "system-derived"]),
    actor: actorSchema,
    assertedAt: z.string().datetime(),
    method: shortTextSchema,
    sourceReferences: exactSourceListSchema,
  }).strict(),
  state: z.enum(["historical", "invalidated", "proposed", "verified"]),
  verification: traceVerificationSchema,
  effectiveFrom: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  invalidationConditions: requiredCanonicalTextListSchema,
  supersedesLinkKeys: canonicalIdentifierListSchema,
  authoritativeUseState: z.literal("not-established"),
  authorityBoundary: z.literal(
    "trace-link-is-a-candidate-attributable-assertion-and-does-not-by-presence-or-verification-prove-completeness-grant-approval-promote-a-baseline-establish-readiness-or-authorize-action",
  ),
}).strict().superRefine((link, context) => {
  if (link.sourceNodeKey === link.targetNodeKey) {
    context.addIssue({ code: "custom", path: ["targetNodeKey"], message: "Trace links must connect distinct governed nodes" })
  }
  if (link.expiresAt !== undefined && Date.parse(link.expiresAt) <= Date.parse(link.effectiveFrom)) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "Trace link expiry must follow its effective time" })
  }
  if (link.state === "verified" &&
      (link.verification.endpointResolution !== "resolved" || link.verification.semanticFitness !== "fit")) {
    context.addIssue({ code: "custom", path: ["state"], message: "Verified Trace Links require resolved endpoints and fit semantic assessment" })
  }
  if (link.state !== "verified" && link.verification.semanticFitness === "fit") {
    context.addIssue({ code: "custom", path: ["verification"], message: "Fit semantic assessment must be represented by verified link state" })
  }
  if (link.provenance.kind === "inferred" && link.state !== "proposed") {
    context.addIssue({ code: "custom", path: ["state"], message: "Inferred Trace Links remain proposed and non-authoritative" })
  }
})

const traceTransformationSchema = z.object({
  key: identifierSchema,
  inputNodeKeys: canonicalIdentifierListSchema.refine((values) => values.length > 0, "Transformation inputs are required"),
  outputNodeKeys: canonicalIdentifierListSchema.refine((values) => values.length > 0, "Transformation outputs are required"),
  methodName: shortTextSchema,
  methodVersion: shortTextSchema,
  actor: actorSchema,
  occurredAt: z.string().datetime(),
  lossiness: z.enum(["lossless", "lossy", "not-assessed"]),
  omissions: canonicalTextListSchema,
  aggregation: canonicalTextListSchema,
  uncertainty: requiredCanonicalTextListSchema,
  provenanceDigest: digestSchema,
}).strict().superRefine((transformation, context) => {
  if (transformation.lossiness === "lossy" && transformation.omissions.length === 0) {
    context.addIssue({ code: "custom", path: ["omissions"], message: "Lossy transformations must disclose material omissions" })
  }
})

const traceSpineEntrySchema = z.object({
  key: identifierSchema,
  sourceNodeKey: identifierSchema,
  targetNodeKey: identifierSchema,
  relationshipKey: identifierSchema,
  state: z.enum(["covered-candidate", "missing", "not-applicable-candidate"]),
  linkKeys: canonicalIdentifierListSchema,
  basis: longTextSchema,
  sources: exactSourceListSchema,
  applicabilityAuthorityState: z.literal("not-established"),
}).strict()

const traceabilityRequirementCoverageSchema = z.object({
  requirementId: z.enum(endToEndTraceabilityRequirementIds),
  state: z.enum(["covered-candidate", "not-applicable-candidate", "unresolved"]),
  nodeKeys: canonicalIdentifierListSchema,
  linkKeys: canonicalIdentifierListSchema,
  basis: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

const endToEndTraceabilityInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  scope: longTextSchema,
  evidenceRegistry: exactEvidenceRegistryReferenceSchema,
  nodes: z.array(traceabilityNodeSchema).min(2).max(8_192)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Traceability node keys must be unique")
    .refine((entries) => unique(entries.map((entry) => `${entry.subject.recordKind}:${entry.subject.recordId}:${entry.subject.revision}`)), "Exact Traceability subjects must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Traceability nodes must use canonical key ordering"),
  relationships: z.array(relationshipDefinitionSchema).min(1).max(512)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Relationship keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Relationships must use canonical key ordering"),
  links: z.array(traceabilityLinkSchema).min(1).max(32_768)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Trace Link keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Trace Links must use canonical key ordering"),
  transformations: z.array(traceTransformationSchema).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Transformation keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Transformations must use canonical key ordering"),
  traceSpine: z.array(traceSpineEntrySchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Trace spine keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Trace spine entries must use canonical key ordering"),
  requirementCoverage: z.array(traceabilityRequirementCoverageSchema).length(endToEndTraceabilityRequirementIds.length)
    .refine((entries) => unique(entries.map((entry) => entry.requirementId)), "Requirement coverage must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.requirementId)), "Requirement coverage must use canonical ID ordering"),
  unknownRelationships: canonicalTextListSchema,
  unresolvedQuestions: canonicalTextListSchema,
  inconsistencies: canonicalTextListSchema,
  limitations: requiredCanonicalTextListSchema,
  coverageState: z.literal("not-established"),
}).strict().superRefine((traceability, context) => {
  const expected = [...endToEndTraceabilityRequirementIds].sort((left, right) => left.localeCompare(right))
  if (traceability.requirementCoverage.some((entry, index) => entry.requirementId !== expected[index])) {
    context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must contain the complete End-to-End Traceability catalog" })
  }
  const nodes = new Map(traceability.nodes.map((node) => [node.key, node]))
  const relationships = new Map(traceability.relationships.map((relationship) => [relationship.key, relationship]))
  const links = new Map(traceability.links.map((link) => [link.key, link]))
  for (const link of traceability.links) {
    const source = nodes.get(link.sourceNodeKey)
    const target = nodes.get(link.targetNodeKey)
    const relationship = relationships.get(link.relationshipKey)
    if (!source || !target || !relationship) {
      context.addIssue({ code: "custom", path: ["links"], message: "Trace Links must reference declared nodes and relationships" })
      continue
    }
    if (!relationship.sourceKinds.includes(source.subject.recordKind) ||
        !relationship.targetKinds.includes(target.subject.recordKind)) {
      context.addIssue({ code: "custom", path: ["links"], message: "Trace Link endpoints must satisfy the declared relationship type constraints" })
    }
    if (link.supersedesLinkKeys.some((key) => !links.has(key) || key === link.key)) {
      context.addIssue({ code: "custom", path: ["links"], message: "Trace Link supersession must reference another declared Trace Link" })
    }
  }
  for (const transformation of traceability.transformations) {
    if ([...transformation.inputNodeKeys, ...transformation.outputNodeKeys].some((key) => !nodes.has(key))) {
      context.addIssue({ code: "custom", path: ["transformations"], message: "Transformations must reference declared nodes" })
    }
  }
  for (const entry of traceability.traceSpine) {
    if (!nodes.has(entry.sourceNodeKey) || !nodes.has(entry.targetNodeKey) || !relationships.has(entry.relationshipKey) ||
        entry.linkKeys.some((key) => !links.has(key))) {
      context.addIssue({ code: "custom", path: ["traceSpine"], message: "Trace spine entries must reference declared nodes, relationships and links" })
    }
    if (entry.state === "covered-candidate" && entry.linkKeys.length === 0) {
      context.addIssue({ code: "custom", path: ["traceSpine"], message: "Covered trace spine entries require at least one Trace Link" })
    }
  }
  if (traceability.requirementCoverage.some((entry) =>
    entry.nodeKeys.some((key) => !nodes.has(key)) || entry.linkKeys.some((key) => !links.has(key)))) {
    context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must reference declared nodes and Trace Links" })
  }
})

export const endToEndTraceabilityInputSchema = rejectSecrets(endToEndTraceabilityInputBaseSchema)

export const endToEndTraceabilitySchema = endToEndTraceabilityInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("end-to-end-traceability-candidate"),
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
    "end-to-end-traceability-is-a-candidate-graph-and-does-not-establish-relationship-truth-completeness-approval-baseline-promotion-readiness-or-action-authority",
  ),
}).strict().superRefine((traceability, context) => {
  if ((traceability.revision === 1) !== (traceability.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only End-to-End Traceability revisions after revision one require an exact predecessor digest" })
  }
})

export const exactEndToEndTraceabilityReferenceSchema = z.object({
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

export const endToEndTraceabilityStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("end-to-end-traceability-status"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  traceability: exactEndToEndTraceabilityReferenceSchema.optional(),
  nodeCount: z.number().int().nonnegative().max(8_192),
  relationshipCount: z.number().int().nonnegative().max(512),
  linkCount: z.number().int().nonnegative().max(32_768),
  transformationCount: z.number().int().nonnegative().max(4_096),
  verifiedLinkCount: z.number().int().nonnegative().max(32_768),
  proposedLinkCount: z.number().int().nonnegative().max(32_768),
  invalidOrHistoricalLinkCount: z.number().int().nonnegative().max(32_768),
  unresolvedEndpointCount: z.number().int().nonnegative().max(65_536),
  notAssessedSemanticCount: z.number().int().nonnegative().max(32_768),
  missingSpineCount: z.number().int().nonnegative().max(4_096),
  unknownRelationshipCount: z.number().int().nonnegative().max(512),
  unresolvedRequirementCount: z.number().int().nonnegative().max(endToEndTraceabilityRequirementIds.length),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  inconsistencyCount: z.number().int().nonnegative().max(512),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(512),
  assessedAt: z.string().datetime(),
  coverageBoundary: z.literal("absence-of-a-trace-link-does-not-prove-absence-of-impact-or-relationship"),
  authorityBoundary: z.literal(
    "end-to-end-traceability-status-reports-candidate-coverage-and-gaps-and-does-not-establish-relationship-truth-completeness-approval-readiness-or-action-authority",
  ),
}).strict().superRefine((status, context) => {
  if (status.verifiedLinkCount + status.proposedLinkCount + status.invalidOrHistoricalLinkCount > status.linkCount ||
      status.notAssessedSemanticCount > status.linkCount) {
    context.addIssue({ code: "custom", message: "End-to-End Traceability status counts cannot exceed link totals" })
  }
})

export const endToEndTraceabilityProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("end-to-end-traceability-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: endToEndTraceabilityStatusSchema,
  traceability: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    membershipDigest: digestSchema,
    state: z.literal("candidate"),
    nodeCount: z.number().int().nonnegative().max(8_192),
    relationshipCount: z.number().int().nonnegative().max(512),
    linkCount: z.number().int().nonnegative().max(32_768),
    transformationCount: z.number().int().nonnegative().max(4_096),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-identities-counts-statuses-and-digests-only-not-node-content-link-rationale-transformation-detail-source-content-personal-data-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "end-to-end-traceability-projection-does-not-establish-relationship-truth-completeness-approval-baseline-promotion-readiness-or-action-authority",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId ||
      projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId ||
      projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "End-to-End Traceability projection must bind the exact Product and Initiative revisions" })
  }
})

export type TraceabilitySubjectKind = z.infer<typeof traceabilitySubjectKindSchema>
export type ExactTraceabilitySubjectReference = z.infer<typeof exactTraceabilitySubjectReferenceSchema>
export type EndToEndTraceabilityInput = z.infer<typeof endToEndTraceabilityInputSchema>
export type EndToEndTraceability = z.infer<typeof endToEndTraceabilitySchema>
export type ExactEndToEndTraceabilityReference = z.infer<typeof exactEndToEndTraceabilityReferenceSchema>
export type EndToEndTraceabilityStatus = z.infer<typeof endToEndTraceabilityStatusSchema>
export type EndToEndTraceabilityProjection = z.infer<typeof endToEndTraceabilityProjectionSchema>
