import { z } from "zod"

import { exactArchitectureChallengeModelReferenceSchema } from "./architecture-challenge-model.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactDecisionRegisterReferenceSchema, exactDecisionSubjectReferenceSchema } from "./decision-register.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactRiskRegisterReferenceSchema } from "./risk-register.js"
import { exactSecurityPrivacyAssessmentReferenceSchema } from "./security-privacy-assessment.js"
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

const exactSubjectListSchema = z.array(exactDecisionSubjectReferenceSchema).min(1).max(512)
  .refine(
    (references) => unique(references.map((reference) =>
      `${reference.recordKind}:${reference.recordId}:${reference.revision}:${reference.relationship}`)),
    "Exact Evidence Subject references must be unique",
  )
  .superRefine((references, context) => {
    const keys = references.map((reference) =>
      `${reference.recordKind}:${reference.recordId}:${String(reference.revision).padStart(12, "0")}:${reference.relationship}`)
    if (!canonical(keys)) context.addIssue({ code: "custom", message: "Exact Evidence Subject references must use canonical identity ordering" })
  })

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Evidence Registry candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const evidenceRegistryRequirementIds = [
  "GAEP-CAE-REQ-001",
  "GAEP-CAE-REQ-002",
  "GAEP-CAE-REQ-003",
  "GAEP-CAE-REQ-004",
  "GAEP-CAE-REQ-005",
  "GAEP-CAE-REQ-006",
  "GAEP-CAE-REQ-007",
  "GAEP-CAE-REQ-008",
  "GAEP-CAE-REQ-009",
  "GAEP-CAE-REQ-010",
  "GAEP-CAE-REQ-013",
  "GAEP-CAE-REQ-014",
  "GAEP-CAE-REQ-016",
  "GAEP-CAE-REQ-017",
  "GAEP-CAE-REQ-018",
  "GAEP-CAE-REQ-019",
  "GAEP-CAE-REQ-020",
  "GAEP-CAE-REQ-024",
  "GAEP-DRAA-REQ-009",
  "GAEP-DRAA-REQ-017",
  "GAEP-DRAA-REQ-029",
  "GAEP-DRAA-REQ-035",
  "GAEP-STATE-REQ-002",
] as const

export const evidenceQualityDimensionSchema = z.enum([
  "authenticity",
  "coverage",
  "freshness",
  "independence",
  "integrity",
  "interpretability",
  "relevance",
  "reproducibility",
  "sensitivity",
  "validity",
])

const evidenceQualityAssessmentSchema = z.object({
  dimension: evidenceQualityDimensionSchema,
  state: z.enum(["candidate-deficient", "candidate-satisfactory", "inconclusive", "not-assessed"]),
  rationale: longTextSchema,
}).strict()

const claimAssessmentSchema = z.object({
  state: z.enum(["inconclusive", "not-assessed", "not-supported", "partially-supported", "supported"]),
  assessor: humanActorSchema.optional(),
  assessedAt: z.string().datetime().optional(),
  methodName: shortTextSchema.optional(),
  methodVersion: shortTextSchema.optional(),
  evidenceLinkKeys: canonicalIdentifierListSchema,
  rationale: longTextSchema,
  validityEndsAt: z.string().datetime().optional(),
  authorityBoundary: z.literal(
    "claim-assessment-is-attributed-epistemic-state-and-does-not-establish-review-approval-assurance-risk-acceptance-readiness-or-action-authority",
  ),
}).strict().superRefine((assessment, context) => {
  const attributed = assessment.assessor !== undefined || assessment.assessedAt !== undefined ||
    assessment.methodName !== undefined || assessment.methodVersion !== undefined || assessment.validityEndsAt !== undefined ||
    assessment.evidenceLinkKeys.length > 0
  if (assessment.state === "not-assessed" && attributed) {
    context.addIssue({ code: "custom", message: "A not-assessed Claim must not carry an invented assessment attribution" })
  }
  if (assessment.state !== "not-assessed" && (!assessment.assessor || !assessment.assessedAt ||
      !assessment.methodName || !assessment.methodVersion || assessment.evidenceLinkKeys.length === 0)) {
    context.addIssue({ code: "custom", message: "An assessed Claim requires an exact human assessor, time, method and Evidence links" })
  }
})

const claimSchema = z.object({
  key: identifierSchema,
  type: identifierSchema,
  ownerRoleKey: identifierSchema,
  ownerAssignmentState: z.literal("not-established"),
  statement: longTextSchema,
  falsificationConditions: requiredCanonicalTextListSchema,
  subjects: exactSubjectListSchema,
  scope: requiredCanonicalTextListSchema,
  environment: requiredCanonicalTextListSchema,
  configuration: requiredCanonicalTextListSchema,
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime().optional(),
  applicableRequirements: canonicalIdentifierListSchema,
  applicablePolicies: canonicalIdentifierListSchema,
  relatedRiskKeys: canonicalIdentifierListSchema,
  assumptions: canonicalTextListSchema,
  requiredEvidenceClasses: requiredCanonicalTextListSchema,
  acceptanceCriteria: requiredCanonicalTextListSchema,
  assessment: claimAssessmentSchema,
  knownGaps: canonicalTextListSchema,
  exclusions: canonicalTextListSchema,
  residualUncertainty: requiredCanonicalTextListSchema,
  defeaters: canonicalTextListSchema,
  reviewTriggers: requiredCanonicalTextListSchema,
  expiryTriggers: requiredCanonicalTextListSchema,
  invalidationTriggers: requiredCanonicalTextListSchema,
  supersessionTriggers: requiredCanonicalTextListSchema,
  authoringLifecycle: z.enum(["draft", "finalized", "in-review", "proposed"]),
  revisionDisposition: z.literal("candidate"),
  operationalEligibilityState: z.literal("not-established"),
}).strict().superRefine((claim, context) => {
  if (claim.validUntil !== undefined && Date.parse(claim.validUntil) <= Date.parse(claim.validFrom)) {
    context.addIssue({ code: "custom", path: ["validUntil"], message: "Claim validity must end after it begins" })
  }
})

const evidenceMethodSchema = z.object({
  name: shortTextSchema,
  version: shortTextSchema,
  criteria: requiredCanonicalTextListSchema,
  procedureVersion: shortTextSchema,
  tools: canonicalTextListSchema,
  configuration: requiredCanonicalTextListSchema,
  environment: requiredCanonicalTextListSchema,
  dataReferences: canonicalTextListSchema,
  limitations: requiredCanonicalTextListSchema,
  reproducibilityConditions: requiredCanonicalTextListSchema,
}).strict()

const evidenceAssessmentSchema = z.object({
  state: z.enum(["disputed", "fit-for-declared-use", "inconclusive", "not-assessed", "not-fit-for-declared-use"]),
  assessor: humanActorSchema.optional(),
  assessedAt: z.string().datetime().optional(),
  methodName: shortTextSchema.optional(),
  methodVersion: shortTextSchema.optional(),
  declaredClaimKeys: canonicalIdentifierListSchema,
  rationale: longTextSchema,
  authorityBoundary: z.literal(
    "evidence-assessment-is-scoped-to-declared-claims-and-does-not-certify-other-subjects-versions-environments-configurations-or-claims",
  ),
}).strict().superRefine((assessment, context) => {
  const attributed = assessment.assessor !== undefined || assessment.assessedAt !== undefined ||
    assessment.methodName !== undefined || assessment.methodVersion !== undefined || assessment.declaredClaimKeys.length > 0
  if (assessment.state === "not-assessed" && attributed) {
    context.addIssue({ code: "custom", message: "Not-assessed Evidence must not carry an invented assessment attribution" })
  }
  if (assessment.state !== "not-assessed" && (!assessment.assessor || !assessment.assessedAt ||
      !assessment.methodName || !assessment.methodVersion || assessment.declaredClaimKeys.length === 0)) {
    context.addIssue({ code: "custom", message: "Assessed Evidence requires an exact human assessor, time, method and declared Claim scope" })
  }
})

const evidenceItemSchema = z.object({
  key: identifierSchema,
  evidenceId: z.string().uuid(),
  evidenceRevision: z.number().int().positive(),
  evidenceDigest: digestSchema,
  type: identifierSchema,
  producer: actorSchema,
  capturedAt: z.string().datetime(),
  subjects: exactSubjectListSchema,
  claimKeys: requiredCanonicalTextListSchema,
  outcome: z.enum(["favorable", "inconclusive", "neutral", "unfavorable"]),
  observation: longTextSchema,
  method: evidenceMethodSchema,
  sources: exactSourceListSchema,
  provenanceDigest: digestSchema,
  integrityDigest: digestSchema,
  evaluatorOrExecutor: actorSchema,
  independenceCharacteristics: requiredCanonicalTextListSchema,
  informationClassification: informationClassificationSchema,
  permittedRecipientRoles: requiredCanonicalTextListSchema,
  retentionState: z.enum(["active-retention", "archived", "disposed", "retained"]),
  retentionObligations: requiredCanonicalTextListSchema,
  disposalObligations: requiredCanonicalTextListSchema,
  authoringLifecycle: z.enum(["draft", "finalized", "in-review", "proposed"]),
  assessment: evidenceAssessmentSchema,
  freshness: z.enum(["current", "potentially-stale", "stale", "unknown"]),
  validity: z.enum(["invalidated", "valid"]),
  revisionDisposition: z.literal("candidate"),
  operationalEligibility: z.enum(["deprecated", "eligible", "retired"]),
  quality: z.array(evidenceQualityAssessmentSchema).length(10)
    .refine((entries) => unique(entries.map((entry) => entry.dimension)), "Evidence quality dimensions must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.dimension)), "Evidence quality dimensions must use canonical ordering"),
  limitations: requiredCanonicalTextListSchema,
  anomalies: canonicalTextListSchema,
  expiryTriggers: requiredCanonicalTextListSchema,
  invalidationTriggers: requiredCanonicalTextListSchema,
  supersessionTriggers: requiredCanonicalTextListSchema,
  adverseDispositionState: z.enum(["not-required", "pending-governed-disposition", "recorded-governed-disposition"]),
  authorityBoundary: z.literal(
    "evidence-item-is-attributable-metadata-and-does-not-by-presence-or-outcome-prove-a-claim-grant-approval-establish-assurance-or-authorize-action",
  ),
}).strict().superRefine((evidence, context) => {
  if (evidence.outcome !== "favorable" && evidence.adverseDispositionState === "not-required") {
    context.addIssue({ code: "custom", path: ["adverseDispositionState"], message: "Unfavorable, inconclusive and neutral Evidence requires visible governed disposition state" })
  }
})

const claimEvidenceLinkSchema = z.object({
  key: identifierSchema,
  claimKey: identifierSchema,
  evidenceKey: identifierSchema,
  relationship: z.enum(["contradicts", "qualifies", "supports"]),
  warrant: longTextSchema,
  scope: requiredCanonicalTextListSchema,
  limitations: requiredCanonicalTextListSchema,
  sufficiencyState: z.literal("not-established"),
  acceptedForClaimState: z.literal("not-established"),
  authorityBoundary: z.literal(
    "claim-evidence-link-records-a-candidate-warrant-and-does-not-establish-evidence-sufficiency-claim-validation-assurance-approval-or-action-authority",
  ),
}).strict()

const evidenceRequirementCoverageSchema = z.object({
  requirementId: z.enum(evidenceRegistryRequirementIds),
  state: z.enum(["covered-candidate", "not-applicable-candidate", "unresolved"]),
  claimKeys: canonicalIdentifierListSchema,
  evidenceKeys: canonicalIdentifierListSchema,
  basis: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

const evidenceRegistryInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  scope: longTextSchema,
  architectureChallengeModel: exactArchitectureChallengeModelReferenceSchema,
  securityPrivacyAssessment: exactSecurityPrivacyAssessmentReferenceSchema,
  decisionRegister: exactDecisionRegisterReferenceSchema,
  riskRegister: exactRiskRegisterReferenceSchema,
  claims: z.array(claimSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Claim keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Claims must use canonical key ordering"),
  evidenceItems: z.array(evidenceItemSchema).min(1).max(8_192)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Evidence keys must be unique")
    .refine((entries) => unique(entries.map((entry) => entry.evidenceId)), "Evidence identities must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Evidence Items must use canonical key ordering"),
  links: z.array(claimEvidenceLinkSchema).min(1).max(32_768)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Claim/Evidence link keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Claim/Evidence links must use canonical key ordering"),
  requirementCoverage: z.array(evidenceRequirementCoverageSchema).length(evidenceRegistryRequirementIds.length)
    .refine((entries) => unique(entries.map((entry) => entry.requirementId)), "Requirement coverage must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.requirementId)), "Requirement coverage must use canonical ID ordering"),
  unresolvedQuestions: canonicalTextListSchema,
  inconsistencies: canonicalTextListSchema,
  limitations: requiredCanonicalTextListSchema,
}).strict().superRefine((registry, context) => {
  const expected = [...evidenceRegistryRequirementIds].sort((left, right) => left.localeCompare(right))
  if (registry.requirementCoverage.some((entry, index) => entry.requirementId !== expected[index])) {
    context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must contain the complete Evidence Registry catalog" })
  }
  const claimKeys = new Set(registry.claims.map((claim) => claim.key))
  const evidenceKeys = new Set(registry.evidenceItems.map((evidence) => evidence.key))
  const linkKeys = new Set(registry.links.map((link) => link.key))
  for (const link of registry.links) {
    if (!claimKeys.has(link.claimKey) || !evidenceKeys.has(link.evidenceKey)) {
      context.addIssue({ code: "custom", path: ["links"], message: "Claim/Evidence links must reference declared Claims and Evidence Items" })
    }
  }
  if (registry.evidenceItems.flatMap((evidence) => evidence.claimKeys).some((key) => !claimKeys.has(key))) {
    context.addIssue({ code: "custom", path: ["evidenceItems"], message: "Evidence Items must reference declared Claims" })
  }
  if (registry.claims.flatMap((claim) => claim.assessment.evidenceLinkKeys).some((key) => !linkKeys.has(key))) {
    context.addIssue({ code: "custom", path: ["claims"], message: "Claim assessments must reference declared Claim/Evidence links" })
  }
  if (registry.evidenceItems.flatMap((evidence) => evidence.assessment.declaredClaimKeys).some((key) => !claimKeys.has(key))) {
    context.addIssue({ code: "custom", path: ["evidenceItems"], message: "Evidence assessments must reference declared Claims" })
  }
  if (registry.requirementCoverage.flatMap((entry) => entry.claimKeys).some((key) => !claimKeys.has(key)) ||
      registry.requirementCoverage.flatMap((entry) => entry.evidenceKeys).some((key) => !evidenceKeys.has(key))) {
    context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must reference declared Claims and Evidence Items" })
  }
})

export const evidenceRegistryInputSchema = rejectSecrets(evidenceRegistryInputBaseSchema)

export const evidenceRegistrySchema = evidenceRegistryInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("evidence-registry-candidate"),
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
    "evidence-registry-is-a-candidate-record-and-does-not-establish-claim-validation-evidence-sufficiency-assurance-review-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority",
  ),
}).strict().superRefine((registry, context) => {
  if ((registry.revision === 1) !== (registry.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Evidence Registry revisions after revision one require an exact predecessor digest" })
  }
})

export const exactEvidenceRegistryReferenceSchema = z.object({
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

export const evidenceRegistryStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("evidence-registry-status"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  registry: exactEvidenceRegistryReferenceSchema.optional(),
  claimCount: z.number().int().nonnegative().max(4_096),
  evidenceItemCount: z.number().int().nonnegative().max(8_192),
  linkCount: z.number().int().nonnegative().max(32_768),
  notAssessedClaimCount: z.number().int().nonnegative().max(4_096),
  notAssessedEvidenceCount: z.number().int().nonnegative().max(8_192),
  adverseEvidencePendingDispositionCount: z.number().int().nonnegative().max(8_192),
  staleOrUnknownEvidenceCount: z.number().int().nonnegative().max(8_192),
  invalidatedEvidenceCount: z.number().int().nonnegative().max(8_192),
  unresolvedLinkCount: z.number().int().nonnegative().max(32_768),
  unresolvedRequirementCount: z.number().int().nonnegative().max(evidenceRegistryRequirementIds.length),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  inconsistencyCount: z.number().int().nonnegative().max(512),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(512),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "evidence-registry-status-reports-candidate-coverage-freshness-and-gaps-and-does-not-establish-claim-validation-evidence-sufficiency-assurance-approval-readiness-or-action-authority",
  ),
}).strict().superRefine((status, context) => {
  if (status.notAssessedClaimCount > status.claimCount ||
      status.notAssessedEvidenceCount > status.evidenceItemCount ||
      status.adverseEvidencePendingDispositionCount > status.evidenceItemCount ||
      status.staleOrUnknownEvidenceCount > status.evidenceItemCount ||
      status.invalidatedEvidenceCount > status.evidenceItemCount ||
      status.unresolvedLinkCount > status.linkCount) {
    context.addIssue({ code: "custom", message: "Evidence Registry status counts cannot exceed their totals" })
  }
})

export const evidenceRegistryProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("evidence-registry-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: evidenceRegistryStatusSchema,
  registry: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    membershipDigest: digestSchema,
    state: z.literal("candidate"),
    claimCount: z.number().int().nonnegative().max(4_096),
    evidenceItemCount: z.number().int().nonnegative().max(8_192),
    linkCount: z.number().int().nonnegative().max(32_768),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-identities-counts-statuses-and-digests-only-not-claim-statements-evidence-observations-methods-warrants-quality-details-source-content-personal-data-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "evidence-registry-projection-does-not-establish-claim-validation-evidence-sufficiency-assurance-review-approval-risk-acceptance-readiness-or-action-authority",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId ||
      projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId ||
      projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Evidence Registry projection must bind the exact Product and Initiative revisions" })
  }
})

export type EvidenceRegistryInput = z.infer<typeof evidenceRegistryInputSchema>
export type EvidenceRegistry = z.infer<typeof evidenceRegistrySchema>
export type ExactEvidenceRegistryReference = z.infer<typeof exactEvidenceRegistryReferenceSchema>
export type EvidenceRegistryStatus = z.infer<typeof evidenceRegistryStatusSchema>
export type EvidenceRegistryProjection = z.infer<typeof evidenceRegistryProjectionSchema>
