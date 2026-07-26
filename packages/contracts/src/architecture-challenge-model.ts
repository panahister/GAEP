import { z } from "zod"

import { exactAuthorizationModelReferenceSchema } from "./authorization-model.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactBoundedContextModelReferenceSchema } from "./bounded-context-model.js"
import { exactDataModelReferenceSchema } from "./data-model.js"
import { exactEventIntegrationModelReferenceSchema } from "./event-integration-model.js"
import { exactFailureRecoveryModelReferenceSchema } from "./failure-recovery-model.js"
import { exactOperatingModelReferenceSchema } from "./operating-model.js"
import { exactProcessModelReferenceSchema } from "./process-model.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactSecurityPrivacyAssessmentReferenceSchema } from "./security-privacy-assessment.js"
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

function canonicalArray<T extends z.ZodType>(schema: T, maximum = 4_096) {
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
      reference.sourceId !== ordered[index]?.sourceId || reference.sourceRevision !== ordered[index]?.sourceRevision)) {
      context.addIssue({ code: "custom", message: "Exact Source references must use canonical identity ordering" })
    }
  })

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Architecture Challenge candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const architectureChallengeArchitectureRequirementIds = [
  "GAEP-ARCH-REQ-001", "GAEP-ARCH-REQ-002", "GAEP-ARCH-REQ-003", "GAEP-ARCH-REQ-004",
  "GAEP-ARCH-REQ-005", "GAEP-ARCH-REQ-006", "GAEP-ARCH-REQ-007", "GAEP-ARCH-REQ-008",
  "GAEP-ARCH-REQ-009", "GAEP-ARCH-REQ-010", "GAEP-ARCH-REQ-011", "GAEP-ARCH-REQ-012",
] as const

export const architectureChallengeAssuranceRequirementIds = [
  "GAEP-CAE-REQ-001", "GAEP-CAE-REQ-002", "GAEP-CAE-REQ-003", "GAEP-CAE-REQ-004",
  "GAEP-CAE-REQ-005", "GAEP-CAE-REQ-006", "GAEP-CAE-REQ-007", "GAEP-CAE-REQ-008",
  "GAEP-CAE-REQ-009", "GAEP-CAE-REQ-010", "GAEP-CAE-REQ-013", "GAEP-CAE-REQ-014",
  "GAEP-CAE-REQ-016", "GAEP-CAE-REQ-017", "GAEP-CAE-REQ-018", "GAEP-CAE-REQ-019",
  "GAEP-CAE-REQ-020", "GAEP-CAE-REQ-024",
] as const

export const architectureChallengeReviewRequirementIds = [
  "GAEP-DRAA-REQ-001", "GAEP-DRAA-REQ-003", "GAEP-DRAA-REQ-008", "GAEP-DRAA-REQ-009",
  "GAEP-DRAA-REQ-036",
] as const

export const architectureChallengeRequirementIds = [
  ...architectureChallengeArchitectureRequirementIds,
  ...architectureChallengeAssuranceRequirementIds,
  ...architectureChallengeReviewRequirementIds,
] as const

const challengeSubjectSchema = z.object({
  key: identifierSchema,
  subjectKind: z.enum([
    "architecture-concern", "architecture-decision", "architecture-element", "architecture-view",
    "bounded-context", "external-contract", "failure-mode", "quality-scenario", "trust-boundary",
  ]),
  decisionQuestion: longTextSchema,
  triggerContext: longTextSchema,
  consequence: z.enum(["critical", "high", "medium", "low"]),
  architectureConcernKeys: canonicalIdentifierListSchema,
  architectureDecisionKeys: canonicalIdentifierListSchema,
  architectureElementKeys: canonicalIdentifierListSchema,
  architectureViewKeys: canonicalIdentifierListSchema,
  qualityScenarioKeys: canonicalIdentifierListSchema,
  boundedContextKeys: canonicalIdentifierListSchema,
  failureModeKeys: canonicalIdentifierListSchema,
  affectedImplementationUnits: requiredCanonicalTextListSchema,
  downstreamConsequences: requiredCanonicalTextListSchema,
  classification: informationClassificationSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((subject, context) => {
  const references = subject.architectureConcernKeys.length + subject.architectureDecisionKeys.length +
    subject.architectureElementKeys.length + subject.architectureViewKeys.length +
    subject.qualityScenarioKeys.length + subject.boundedContextKeys.length + subject.failureModeKeys.length
  if (references === 0) {
    context.addIssue({ code: "custom", message: "A Challenge Subject must reference at least one exact governed architecture or failure subject" })
  }
})

const challengedAssumptionSchema = z.object({
  key: identifierSchema,
  challengeSubjectKeys: requiredCanonicalIdentifierListSchema,
  statement: longTextSchema,
  status: z.enum(["contested", "declared-untested", "supported-candidate", "unknown"]),
  falsificationConditions: requiredCanonicalTextListSchema,
  supportingEvidence: exactSourceListSchema,
  counterEvidence: exactSourceListSchema,
  residualUncertainty: longTextSchema,
}).strict()

const challengeAlternativeSchema = z.object({
  key: identifierSchema,
  challengeSubjectKeys: requiredCanonicalIdentifierListSchema,
  name: z.string().trim().min(2).max(240),
  description: longTextSchema,
  benefits: requiredCanonicalTextListSchema,
  tradeoffs: requiredCanonicalTextListSchema,
  risks: requiredCanonicalTextListSchema,
  architectureElementKeys: canonicalIdentifierListSchema,
  boundedContextKeys: canonicalIdentifierListSchema,
  failureModeKeys: canonicalIdentifierListSchema,
  recommendationState: z.enum(["candidate-preferred", "not-recommended", "viable"]),
  dispositionState: z.literal("candidate-unresolved"),
  sources: exactSourceListSchema,
}).strict()

const challengeFindingSchema = z.object({
  key: identifierSchema,
  challengeSubjectKeys: requiredCanonicalIdentifierListSchema,
  challengerKind: z.enum(["ai", "human"]),
  challengerId: shortTextSchema,
  challengerRoleKeys: requiredCanonicalIdentifierListSchema,
  concern: longTextSchema,
  evidence: exactSourceListSchema,
  consequence: longTextSchema,
  severity: z.enum(["critical", "high", "medium", "low", "unresolved"]),
  alternativeKeys: canonicalIdentifierListSchema,
  requestedClarifications: canonicalTextListSchema,
  limitations: canonicalTextListSchema,
  findingState: z.literal("open-candidate"),
  independenceState: z.literal("not-established"),
}).strict()

const challengeResponseSchema = z.object({
  key: identifierSchema,
  findingKeys: requiredCanonicalIdentifierListSchema,
  responderRoleKeys: requiredCanonicalIdentifierListSchema,
  responseType: z.enum([
    "acknowledge", "contest", "provide-context", "propose-revision", "request-clarification", "route",
  ]),
  response: longTextSchema,
  rationale: longTextSchema,
  resultingTraceOrStateChange: longTextSchema,
  dispositionState: z.literal("candidate-not-decided"),
  decisionAuthorityState: z.literal("not-granted"),
  sources: exactSourceListSchema,
}).strict()

const challengeIndependenceSchema = z.object({
  authorRoleKeys: requiredCanonicalIdentifierListSchema,
  challengerRoleKeys: requiredCanonicalIdentifierListSchema,
  reviewerRoleKeys: requiredCanonicalIdentifierListSchema,
  disclosedRoleOverlaps: canonicalIdentifierListSchema,
  sharedSourceDependencies: canonicalTextListSchema,
  sharedMethodToolOrModelDependencies: canonicalTextListSchema,
  conflictsOfInterest: canonicalTextListSchema,
  compensatingControls: canonicalTextListSchema,
  requiredSeparation: longTextSchema,
  assessmentState: z.literal("not-established"),
  sources: exactSourceListSchema,
}).strict()

const architectureChallengeRequirementCoverageSchema = z.object({
  requirementId: z.enum(architectureChallengeRequirementIds),
  state: z.enum(["covered-candidate", "not-applicable-candidate", "unresolved"]),
  challengeSubjectKeys: canonicalIdentifierListSchema,
  assumptionKeys: canonicalIdentifierListSchema,
  alternativeKeys: canonicalIdentifierListSchema,
  findingKeys: canonicalIdentifierListSchema,
  responseKeys: canonicalIdentifierListSchema,
  basis: longTextSchema,
  evidence: exactSourceListSchema,
}).strict()

const architectureChallengeGovernanceSchema = z.object({
  challengeOwnerRoleKeys: requiredCanonicalIdentifierListSchema,
  challengerRoleKeys: requiredCanonicalIdentifierListSchema,
  responseOwnerRoleKeys: requiredCanonicalIdentifierListSchema,
  reviewState: z.enum(["awaiting-human-review", "draft", "under-challenge"]),
  challengeCompletionState: z.literal("not-established"),
  independenceState: z.literal("not-established"),
  assuranceState: z.literal("not-established"),
  riskAcceptanceState: z.literal("not-granted"),
  architectureApprovalState: z.literal("not-granted"),
  operationalReadinessState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted"),
  basis: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

const architectureChallengeModelInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  scope: longTextSchema,
  systemSolutionArchitecture: exactSystemSolutionArchitectureReferenceSchema,
  boundedContextModel: exactBoundedContextModelReferenceSchema,
  operatingModel: exactOperatingModelReferenceSchema,
  securityPrivacyAssessment: exactSecurityPrivacyAssessmentReferenceSchema,
  processModel: exactProcessModelReferenceSchema,
  dataModel: exactDataModelReferenceSchema,
  authorizationModel: exactAuthorizationModelReferenceSchema,
  eventIntegrationModel: exactEventIntegrationModelReferenceSchema,
  failureRecoveryModel: exactFailureRecoveryModelReferenceSchema,
  challengeSubjects: z.array(challengeSubjectSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Challenge Subject keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Challenge Subjects must use canonical key ordering"),
  assumptions: z.array(challengedAssumptionSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Assumption keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Assumptions must use canonical key ordering"),
  alternatives: z.array(challengeAlternativeSchema).min(2).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Alternative keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Alternatives must use canonical key ordering"),
  findings: z.array(challengeFindingSchema).min(1).max(8_192)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Finding keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Findings must use canonical key ordering"),
  responses: z.array(challengeResponseSchema).max(8_192)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Response keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Responses must use canonical key ordering"),
  independence: challengeIndependenceSchema,
  requirementCoverage: z.array(architectureChallengeRequirementCoverageSchema)
    .length(architectureChallengeRequirementIds.length)
    .refine((entries) => unique(entries.map((entry) => entry.requirementId)), "Requirement coverage must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.requirementId)), "Requirement coverage must use canonical ID ordering"),
  governance: architectureChallengeGovernanceSchema,
  inconsistencies: canonicalTextListSchema,
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema,
}).strict().superRefine((record, context) => {
  const expected = [...architectureChallengeRequirementIds].sort((left, right) => left.localeCompare(right))
  if (record.requirementCoverage.some((entry, index) => entry.requirementId !== expected[index])) {
    context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must contain the complete Architecture Challenge catalog" })
  }
  const subjectKeys = new Set(record.challengeSubjects.map((entry) => entry.key))
  const assumptionKeys = new Set(record.assumptions.map((entry) => entry.key))
  const alternativeKeys = new Set(record.alternatives.map((entry) => entry.key))
  const findingKeys = new Set(record.findings.map((entry) => entry.key))
  const responseKeys = new Set(record.responses.map((entry) => entry.key))
  const subjectReferences = [
    ...record.assumptions.flatMap((entry) => entry.challengeSubjectKeys),
    ...record.alternatives.flatMap((entry) => entry.challengeSubjectKeys),
    ...record.findings.flatMap((entry) => entry.challengeSubjectKeys),
  ]
  if (subjectReferences.some((key) => !subjectKeys.has(key))) {
    context.addIssue({ code: "custom", message: "Assumptions, Alternatives, and Findings must reference declared Challenge Subjects" })
  }
  if (record.findings.flatMap((entry) => entry.alternativeKeys).some((key) => !alternativeKeys.has(key))) {
    context.addIssue({ code: "custom", path: ["findings"], message: "Findings must reference declared Alternatives" })
  }
  if (record.responses.flatMap((entry) => entry.findingKeys).some((key) => !findingKeys.has(key))) {
    context.addIssue({ code: "custom", path: ["responses"], message: "Responses must reference declared Findings" })
  }
  for (const coverage of record.requirementCoverage) {
    if (coverage.challengeSubjectKeys.some((key) => !subjectKeys.has(key)) ||
        coverage.assumptionKeys.some((key) => !assumptionKeys.has(key)) ||
        coverage.alternativeKeys.some((key) => !alternativeKeys.has(key)) ||
        coverage.findingKeys.some((key) => !findingKeys.has(key)) ||
        coverage.responseKeys.some((key) => !responseKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must reference declared Architecture Challenge subjects" })
    }
  }
})

export const architectureChallengeModelInputSchema = rejectSecrets(architectureChallengeModelInputBaseSchema)

export const architectureChallengeModelSchema = architectureChallengeModelInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("architecture-challenge-model-candidate"),
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
    "architecture-challenge-is-a-candidate-review-record-and-does-not-establish-independence-assurance-risk-acceptance-architecture-approval-operational-readiness-or-authorize-action",
  ),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Architecture Challenge revisions after revision one require an exact predecessor digest" })
  }
})

export const exactArchitectureChallengeModelReferenceSchema = exactFailureRecoveryModelReferenceSchema

export const architectureChallengeModelStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("architecture-challenge-model-status"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  model: exactArchitectureChallengeModelReferenceSchema.optional(),
  challengeSubjectCount: z.number().int().nonnegative().max(4_096),
  assumptionCount: z.number().int().nonnegative().max(4_096),
  alternativeCount: z.number().int().nonnegative().max(4_096),
  findingCount: z.number().int().nonnegative().max(8_192),
  responseCount: z.number().int().nonnegative().max(8_192),
  unrespondedFindingCount: z.number().int().nonnegative().max(8_192),
  unresolvedAssumptionCount: z.number().int().nonnegative().max(4_096),
  unresolvedRequirementCount: z.number().int().nonnegative().max(architectureChallengeRequirementIds.length),
  inconsistencyCount: z.number().int().nonnegative().max(512),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(512),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "architecture-challenge-status-reports-candidate-coverage-and-gaps-and-does-not-establish-independence-assurance-risk-acceptance-architecture-approval-operational-readiness-or-authorize-action",
  ),
}).strict()

export const architectureChallengeModelProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("architecture-challenge-model-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: architectureChallengeModelStatusSchema,
  model: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    membershipDigest: digestSchema, state: z.literal("candidate"),
    challengeSubjectCount: z.number().int().nonnegative().max(4_096),
    assumptionCount: z.number().int().nonnegative().max(4_096),
    alternativeCount: z.number().int().nonnegative().max(4_096),
    findingCount: z.number().int().nonnegative().max(8_192),
    responseCount: z.number().int().nonnegative().max(8_192),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-identities-counts-statuses-and-digests-only-not-challenge-content-assumptions-evidence-findings-responses-source-content-personal-data-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "architecture-challenge-projection-does-not-establish-independence-assurance-risk-acceptance-architecture-approval-operational-readiness-or-authorize-action",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId ||
      projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId ||
      projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Architecture Challenge projection must bind the exact Product and Initiative revisions" })
  }
})

export type ArchitectureChallengeModelInput = z.infer<typeof architectureChallengeModelInputSchema>
export type ArchitectureChallengeModel = z.infer<typeof architectureChallengeModelSchema>
export type ExactArchitectureChallengeModelReference = z.infer<typeof exactArchitectureChallengeModelReferenceSchema>
export type ArchitectureChallengeModelStatus = z.infer<typeof architectureChallengeModelStatusSchema>
export type ArchitectureChallengeModelProjection = z.infer<typeof architectureChallengeModelProjectionSchema>
