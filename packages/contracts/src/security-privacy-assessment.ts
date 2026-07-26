import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { exactBoundedContextModelReferenceSchema } from "./bounded-context-model.js"
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
    message: "Portable Security, Privacy, and Threat Assessment candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const securityRequirementIds = [
  "GAEP-SEC-REQ-001", "GAEP-SEC-REQ-002", "GAEP-SEC-REQ-003", "GAEP-SEC-REQ-004",
  "GAEP-SEC-REQ-005", "GAEP-SEC-REQ-006", "GAEP-SEC-REQ-007", "GAEP-SEC-REQ-008",
  "GAEP-SEC-REQ-009", "GAEP-SEC-REQ-010", "GAEP-SEC-REQ-011", "GAEP-SEC-REQ-012",
  "GAEP-SEC-REQ-013", "GAEP-SEC-REQ-014",
] as const

export const dataPrivacyRequirementIds = [
  "GAEP-DATA-REQ-001", "GAEP-DATA-REQ-002", "GAEP-DATA-REQ-003", "GAEP-DATA-REQ-004",
  "GAEP-DATA-REQ-005", "GAEP-DATA-REQ-006", "GAEP-DATA-REQ-007", "GAEP-DATA-REQ-008",
  "GAEP-DATA-REQ-009", "GAEP-DATA-REQ-010", "GAEP-DATA-REQ-011", "GAEP-DATA-REQ-012",
  "GAEP-DATA-REQ-013", "GAEP-DATA-REQ-014",
] as const

export const securityPrivacyRequirementIds = [
  ...securityRequirementIds,
  ...dataPrivacyRequirementIds,
] as const

export const securityThreatCategorySchema = z.enum([
  "availability", "confidentiality", "governance-abuse", "identity-authority", "injection",
  "integrity", "privacy-records", "recovery", "supply-chain", "tenant-isolation", "unresolved",
])

export const securityControlKindSchema = z.enum(["preventive", "detective", "corrective", "recovery"])

const securityAssetSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  securityObjectives: requiredCanonicalTextListSchema,
  architectureElementKeys: requiredCanonicalIdentifierListSchema,
  ownerRoleKey: identifierSchema,
  sources: exactSourceListSchema,
}).strict()

const securityActorSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  kind: z.enum(["agent", "attacker", "human", "service", "supplier", "external-system"]),
  trust: z.enum(["trusted", "untrusted", "mixed", "unresolved"]),
  capabilities: requiredCanonicalTextListSchema,
  constraints: requiredCanonicalTextListSchema,
  sources: exactSourceListSchema,
}).strict()

const securityTrustBoundarySchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  kind: z.enum(["identity", "privilege", "provider", "repository", "runtime", "supplier", "tenant", "workspace"]),
  architectureRelationKeys: requiredCanonicalIdentifierListSchema,
  actorKeys: requiredCanonicalIdentifierListSchema,
  dataClassKeys: canonicalIdentifierListSchema,
  rationale: longTextSchema,
  failureBehavior: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

const securityDataClassSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  classification: informationClassificationSchema,
  subjectCategories: requiredCanonicalTextListSchema,
  purposes: requiredCanonicalTextListSchema,
  processingAuthorityState: z.enum(["candidate-declared", "unresolved", "not-applicable"]),
  ownerRoleKey: identifierSchema,
  architectureElementKeys: requiredCanonicalIdentifierListSchema,
  recipientConstraints: requiredCanonicalTextListSchema,
  residencyConstraints: requiredCanonicalTextListSchema,
  minimization: longTextSchema,
  retention: longTextSchema,
  deletionAndCorrection: longTextSchema,
  providerAndModelUse: longTextSchema,
  affectedPersonRights: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

const securityDataFlowSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  architectureRelationKeys: requiredCanonicalIdentifierListSchema,
  dataClassKeys: requiredCanonicalIdentifierListSchema,
  trustBoundaryKeys: requiredCanonicalIdentifierListSchema,
  actorKeys: requiredCanonicalIdentifierListSchema,
  purpose: longTextSchema,
  recipients: requiredCanonicalTextListSchema,
  locations: requiredCanonicalTextListSchema,
  sources: exactSourceListSchema,
}).strict()

const securityControlSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  kind: securityControlKindSchema,
  statement: longTextSchema,
  ownerRoleKey: identifierSchema,
  architectureElementKeys: requiredCanonicalIdentifierListSchema,
  implementationState: z.enum(["proposed", "observed-implemented", "unresolved"]),
  verificationState: z.enum(["evidence-linked", "failed", "unverified", "unknown"]),
  effectivenessState: z.literal("not-assessed"),
  evidence: exactSourceListSchema,
  failureBehavior: longTextSchema,
  reviewTriggers: requiredCanonicalTextListSchema,
  sources: exactSourceListSchema,
}).strict()

const securityThreatSchema = z.object({
  key: identifierSchema,
  title: z.string().trim().min(2).max(240),
  category: securityThreatCategorySchema,
  actorKeys: requiredCanonicalIdentifierListSchema,
  assetKeys: requiredCanonicalIdentifierListSchema,
  trustBoundaryKeys: requiredCanonicalIdentifierListSchema,
  dataFlowKeys: canonicalIdentifierListSchema,
  scenario: longTextSchema,
  consequence: longTextSchema,
  controlKeys: canonicalIdentifierListSchema,
  riskAssessmentState: z.literal("not-assessed"),
  residualRisk: longTextSchema,
  residualRiskState: z.enum(["unresolved", "candidate-described"]),
  riskAcceptanceState: z.literal("not-granted"),
  ownerRoleKey: identifierSchema,
  reviewTriggers: requiredCanonicalTextListSchema,
  sources: exactSourceListSchema,
}).strict()

const securityRequirementCoverageSchema = z.object({
  requirementId: z.enum(securityPrivacyRequirementIds),
  state: z.enum(["covered-candidate", "not-applicable-candidate", "unresolved"]),
  controlKeys: canonicalIdentifierListSchema,
  threatKeys: canonicalIdentifierListSchema,
  basis: longTextSchema,
  evidence: exactSourceListSchema,
}).strict()

const securityPrivacyGovernanceSchema = z.object({
  securityAuthorityRoleKey: identifierSchema,
  privacyAuthorityRoleKey: identifierSchema,
  riskOwnerRoleKeys: requiredCanonicalIdentifierListSchema,
  reviewerRoleKeys: requiredCanonicalIdentifierListSchema,
  threatModelApprovalState: z.literal("not-granted"),
  privacyReviewState: z.literal("not-granted"),
  residualRiskAcceptanceState: z.literal("not-granted"),
  controlEffectivenessState: z.literal("not-established"),
  reviewState: z.enum(["draft", "under-challenge", "awaiting-human-review"]),
  basis: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

const securityPrivacyAssessmentInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  scope: longTextSchema,
  boundedContextModel: exactBoundedContextModelReferenceSchema,
  assets: z.array(securityAssetSchema).min(1).max(2_048)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Security asset keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Security assets must use canonical key ordering"),
  actors: z.array(securityActorSchema).min(1).max(1_024)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Security actor keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Security actors must use canonical key ordering"),
  trustBoundaries: z.array(securityTrustBoundarySchema).min(1).max(2_048)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Trust-boundary keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Trust boundaries must use canonical key ordering"),
  dataClasses: z.array(securityDataClassSchema).min(1).max(2_048)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Data-class keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Data classes must use canonical key ordering"),
  dataFlows: z.array(securityDataFlowSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Data-flow keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Data flows must use canonical key ordering"),
  controls: z.array(securityControlSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Security-control keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Security controls must use canonical key ordering"),
  threats: z.array(securityThreatSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Threat keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Threats must use canonical key ordering"),
  requirementCoverage: z.array(securityRequirementCoverageSchema).length(securityPrivacyRequirementIds.length)
    .refine((entries) => unique(entries.map((entry) => entry.requirementId)), "Requirement coverage must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.requirementId)), "Requirement coverage must use canonical ID ordering"),
  assumptions: canonicalTextListSchema,
  inconsistencies: canonicalTextListSchema,
  unresolvedQuestions: canonicalTextListSchema,
  governance: securityPrivacyGovernanceSchema,
  limitations: canonicalTextListSchema,
}).strict().superRefine((record, context) => {
  const expectedRequirementIds = [...securityPrivacyRequirementIds].sort((left, right) => left.localeCompare(right))
  if (record.requirementCoverage.some((entry, index) => entry.requirementId !== expectedRequirementIds[index])) {
    context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must contain the complete canonical Security and Data Profile catalog" })
  }
  const assetKeys = new Set(record.assets.map((entry) => entry.key))
  const actorKeys = new Set(record.actors.map((entry) => entry.key))
  const boundaryKeys = new Set(record.trustBoundaries.map((entry) => entry.key))
  const dataClassKeys = new Set(record.dataClasses.map((entry) => entry.key))
  const dataFlowKeys = new Set(record.dataFlows.map((entry) => entry.key))
  const controlKeys = new Set(record.controls.map((entry) => entry.key))
  const threatKeys = new Set(record.threats.map((entry) => entry.key))
  for (const boundary of record.trustBoundaries) {
    if (boundary.actorKeys.some((key) => !actorKeys.has(key)) || boundary.dataClassKeys.some((key) => !dataClassKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["trustBoundaries"], message: "Trust boundaries must reference declared actors and data classes" })
    }
  }
  for (const flow of record.dataFlows) {
    if (flow.dataClassKeys.some((key) => !dataClassKeys.has(key)) ||
        flow.trustBoundaryKeys.some((key) => !boundaryKeys.has(key)) ||
        flow.actorKeys.some((key) => !actorKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["dataFlows"], message: "Data flows must reference declared data classes, trust boundaries, and actors" })
    }
  }
  for (const threat of record.threats) {
    if (threat.assetKeys.some((key) => !assetKeys.has(key)) ||
        threat.actorKeys.some((key) => !actorKeys.has(key)) ||
        threat.trustBoundaryKeys.some((key) => !boundaryKeys.has(key)) ||
        threat.dataFlowKeys.some((key) => !dataFlowKeys.has(key)) ||
        threat.controlKeys.some((key) => !controlKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["threats"], message: "Threats must reference declared assets, actors, boundaries, flows, and controls" })
    }
  }
  for (const coverage of record.requirementCoverage) {
    if (coverage.controlKeys.some((key) => !controlKeys.has(key)) ||
        coverage.threatKeys.some((key) => !threatKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must reference declared controls and threats" })
    }
  }
})

export const securityPrivacyAssessmentInputSchema = rejectSecrets(securityPrivacyAssessmentInputBaseSchema)

export const securityPrivacyAssessmentSchema = securityPrivacyAssessmentInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("security-privacy-threat-assessment-candidate"),
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
    "security-privacy-threat-assessment-is-a-candidate-record-and-does-not-approve-a-threat-model-attest-control-effectiveness-accept-risk-approve-data-processing-establish-security-readiness-or-authorize-action",
  ),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Security, Privacy, and Threat Assessment revisions after revision one require an exact predecessor digest" })
  }
})

export const exactSecurityPrivacyAssessmentReferenceSchema = exactBoundedContextModelReferenceSchema

export const securityPrivacyAssessmentStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("security-privacy-threat-assessment-status"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  assessment: exactSecurityPrivacyAssessmentReferenceSchema.optional(),
  assetCount: z.number().int().nonnegative().max(2_048),
  actorCount: z.number().int().nonnegative().max(1_024),
  trustBoundaryCount: z.number().int().nonnegative().max(2_048),
  dataClassCount: z.number().int().nonnegative().max(2_048),
  dataFlowCount: z.number().int().nonnegative().max(4_096),
  controlCount: z.number().int().nonnegative().max(4_096),
  threatCount: z.number().int().nonnegative().max(4_096),
  unresolvedThreatCount: z.number().int().nonnegative().max(4_096),
  unverifiedControlCount: z.number().int().nonnegative().max(4_096),
  unresolvedProcessingAuthorityCount: z.number().int().nonnegative().max(2_048),
  uncoveredArchitectureElementCount: z.number().int().nonnegative().max(2_048),
  unmappedArchitectureRelationCount: z.number().int().nonnegative().max(4_096),
  unresolvedRequirementCount: z.number().int().nonnegative().max(securityPrivacyRequirementIds.length),
  inconsistencyCount: z.number().int().nonnegative().max(512),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  state: z.enum(["complete-for-review", "attention-required"]),
  reasons: z.array(shortTextSchema).max(512),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "security-privacy-threat-status-reports-candidate-coverage-and-gaps-and-does-not-approve-threats-attest-controls-accept-risk-approve-processing-establish-security-readiness-or-authorize-action",
  ),
}).strict()

export const securityPrivacyAssessmentProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("security-privacy-threat-assessment-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  }).strict(),
  status: securityPrivacyAssessmentStatusSchema,
  assessment: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    membershipDigest: digestSchema,
    state: z.literal("candidate"),
    assetCount: z.number().int().nonnegative().max(2_048),
    trustBoundaryCount: z.number().int().nonnegative().max(2_048),
    dataClassCount: z.number().int().nonnegative().max(2_048),
    controlCount: z.number().int().nonnegative().max(4_096),
    threatCount: z.number().int().nonnegative().max(4_096),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-identities-counts-statuses-and-digests-only-not-threat-scenarios-control-content-data-content-personal-data-locators-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "security-privacy-threat-projection-does-not-approve-a-threat-model-attest-control-effectiveness-accept-risk-approve-processing-establish-security-readiness-or-authorize-action",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId ||
      projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId ||
      projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Security, Privacy, and Threat projection must bind the exact Product and Initiative revisions" })
  }
})

export type SecurityPrivacyAssessmentInput = z.infer<typeof securityPrivacyAssessmentInputSchema>
export type SecurityPrivacyAssessment = z.infer<typeof securityPrivacyAssessmentSchema>
export type ExactSecurityPrivacyAssessmentReference = z.infer<typeof exactSecurityPrivacyAssessmentReferenceSchema>
export type SecurityPrivacyAssessmentStatus = z.infer<typeof securityPrivacyAssessmentStatusSchema>
export type SecurityPrivacyAssessmentProjection = z.infer<typeof securityPrivacyAssessmentProjectionSchema>
