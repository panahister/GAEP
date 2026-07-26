import { z } from "zod"

import { exactArchitectureChallengeModelReferenceSchema } from "./architecture-challenge-model.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactDecisionRegisterReferenceSchema, exactDecisionSubjectReferenceSchema } from "./decision-register.js"
import { exactOperatingModelReferenceSchema } from "./operating-model.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactSecurityPrivacyAssessmentReferenceSchema } from "./security-privacy-assessment.js"
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
    const ordered = [...references].sort((left, right) =>
      left.sourceId.localeCompare(right.sourceId) || left.sourceRevision - right.sourceRevision)
    if (references.some((reference, index) =>
      reference.sourceId !== ordered[index]?.sourceId || reference.sourceRevision !== ordered[index]?.sourceRevision)) {
      context.addIssue({ code: "custom", message: "Exact Source references must use canonical identity ordering" })
    }
  })

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Risk Register candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const riskRegisterRequirementIds = [
  "GAEP-CST-REQ-006",
  "GAEP-CST-REQ-036",
  "GAEP-CST-REQ-045",
  "GAEP-CST-REQ-071",
  "GAEP-DRAA-REQ-003",
  "GAEP-DRAA-REQ-009",
  "GAEP-DRAA-REQ-017",
  "GAEP-DRAA-REQ-029",
  "GAEP-DRAA-REQ-033",
  "GAEP-DRAA-REQ-035",
  "GAEP-IDAUTH-REQ-001",
  "GAEP-POLICY-REQ-014",
  "GAEP-POLICY-REQ-016",
  "GAEP-POLICY-REQ-017",
  "GAEP-STATE-REQ-002",
] as const

export const riskSourceKindSchema = z.enum([
  "ambiguity",
  "assumption",
  "dependency",
  "external-condition",
  "hazard",
  "opportunity",
  "threat",
  "vulnerability",
])

export const riskTreatmentKindSchema = z.enum([
  "accept-through-accountable-decision",
  "avoid",
  "exploit",
  "monitor",
  "reduce",
  "transfer-share",
])

const riskAssessmentValueSchema = z.object({
  state: z.enum(["candidate-estimate", "not-assessed"]),
  value: shortTextSchema.optional(),
  rationale: longTextSchema,
}).strict().superRefine((assessment, context) => {
  if ((assessment.state === "candidate-estimate") !== (assessment.value !== undefined)) {
    context.addIssue({
      code: "custom",
      path: ["value"],
      message: "A candidate estimate requires a value and a not-assessed result must not invent one",
    })
  }
})

const riskAssessmentSchema = z.object({
  methodState: z.enum(["candidate-declared", "unresolved"]),
  methodName: shortTextSchema.optional(),
  methodVersion: shortTextSchema.optional(),
  likelihoodOrPlausibility: riskAssessmentValueSchema.safeExtend({
    kind: z.enum(["likelihood", "plausibility"]),
  }).strict(),
  impactDimensions: requiredCanonicalTextListSchema,
  impactSeverity: riskAssessmentValueSchema,
  exposure: riskAssessmentValueSchema,
  uncertainty: requiredCanonicalTextListSchema,
  assumptions: canonicalTextListSchema,
  confidence: riskAssessmentValueSchema,
  evidence: exactSourceListSchema,
}).strict().superRefine((assessment, context) => {
  const hasMethod = assessment.methodName !== undefined || assessment.methodVersion !== undefined
  if (assessment.methodState === "candidate-declared" && (!assessment.methodName || !assessment.methodVersion)) {
    context.addIssue({ code: "custom", message: "A candidate assessment method requires an exact name and version" })
  }
  if (assessment.methodState === "unresolved" && hasMethod) {
    context.addIssue({ code: "custom", message: "An unresolved assessment method must not carry an invented method identity" })
  }
  const assessed = [assessment.likelihoodOrPlausibility, assessment.impactSeverity, assessment.exposure, assessment.confidence]
    .some((value) => value.state === "candidate-estimate")
  if (assessed && assessment.methodState !== "candidate-declared") {
    context.addIssue({ code: "custom", message: "Candidate estimates require a declared assessment method" })
  }
})

const riskControlSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  kind: z.enum(["corrective", "detective", "preventive", "recovery"]),
  statement: longTextSchema,
  implementationState: z.enum(["observed-implemented", "proposed", "unresolved"]),
  effectivenessState: z.enum(["candidate-estimate", "not-assessed"]),
  effectiveness: shortTextSchema.optional(),
  ownerRoleKey: identifierSchema,
  ownerAssignmentState: z.literal("not-established"),
  evidence: exactSourceListSchema,
  failureBehavior: longTextSchema,
  reviewTriggers: requiredCanonicalTextListSchema,
}).strict().superRefine((control, context) => {
  if ((control.effectivenessState === "candidate-estimate") !== (control.effectiveness !== undefined)) {
    context.addIssue({
      code: "custom",
      path: ["effectiveness"],
      message: "Candidate control effectiveness requires an estimate and not-assessed must not invent one",
    })
  }
})

const riskTreatmentSchema = z.object({
  kind: riskTreatmentKindSchema,
  state: z.literal("proposed"),
  rationale: longTextSchema,
  actions: requiredCanonicalTextListSchema,
  controlKeys: canonicalIdentifierListSchema,
  ownerRoleKey: identifierSchema,
  ownerAssignmentState: z.literal("not-established"),
  dueOrReviewCondition: longTextSchema,
  evidence: exactSourceListSchema,
  authorityBoundary: z.literal(
    "risk-treatment-is-proposed-and-does-not-establish-owner-assignment-control-effectiveness-risk-acceptance-or-action-authority",
  ),
}).strict()

const residualRiskSchema = z.object({
  state: z.enum(["candidate-described", "not-assessed"]),
  statement: longTextSchema,
  uncertainty: requiredCanonicalTextListSchema,
  evidence: exactSourceListSchema,
  acceptanceState: z.literal("not-granted"),
  acceptanceDecisionState: z.literal("not-established"),
  approverAuthorityState: z.literal("not-established"),
  validityState: z.literal("not-established"),
  conditions: canonicalTextListSchema,
  reviewTriggers: requiredCanonicalTextListSchema,
  authorityBoundary: z.literal(
    "residual-risk-description-does-not-establish-risk-acceptance-approval-exception-baseline-promotion-readiness-or-action-authority",
  ),
}).strict()

const riskEntrySchema = z.object({
  key: identifierSchema,
  title: z.string().trim().min(2).max(240),
  statement: z.object({
    cause: longTextSchema,
    condition: longTextSchema,
    consequence: longTextSchema,
  }).strict(),
  affectedObjectives: requiredCanonicalTextListSchema,
  affectedScopes: requiredCanonicalTextListSchema,
  source: z.object({
    kind: riskSourceKindSchema,
    statement: longTextSchema,
    activationTrigger: longTextSchema,
  }).strict(),
  assessment: riskAssessmentSchema,
  controls: z.array(riskControlSchema).max(512)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Risk Control keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Risk Controls must use canonical key ordering"),
  treatment: riskTreatmentSchema,
  residualRisk: residualRiskSchema,
  ownerRoleKey: identifierSchema,
  ownerAssignmentState: z.literal("not-established"),
  authoringLifecycle: z.enum(["draft", "finalized", "in-review", "proposed"]),
  revisionDisposition: z.literal("candidate"),
  operationalEligibilityState: z.literal("not-established"),
  reviewTriggers: requiredCanonicalTextListSchema,
  escalationTriggers: requiredCanonicalTextListSchema,
  invalidationTriggers: requiredCanonicalTextListSchema,
  relatedRecords: z.array(exactDecisionSubjectReferenceSchema).min(1).max(512)
    .refine(
      (references) => unique(references.map((reference) =>
        `${reference.recordKind}:${reference.recordId}:${reference.revision}:${reference.relationship}`)),
      "Exact related-record references must be unique",
    )
    .superRefine((references, context) => {
      const keys = references.map((reference) =>
        `${reference.recordKind}:${reference.recordId}:${String(reference.revision).padStart(12, "0")}:${reference.relationship}`)
      if (!canonical(keys)) {
        context.addIssue({ code: "custom", message: "Exact related-record references must use canonical identity ordering" })
      }
    }),
  sources: exactSourceListSchema,
}).strict().superRefine((risk, context) => {
  const controlKeys = new Set(risk.controls.map((control) => control.key))
  if (risk.treatment.controlKeys.some((key) => !controlKeys.has(key))) {
    context.addIssue({ code: "custom", path: ["treatment", "controlKeys"], message: "Risk Treatment must reference declared Risk Controls" })
  }
})

const riskRequirementCoverageSchema = z.object({
  requirementId: z.enum(riskRegisterRequirementIds),
  state: z.enum(["covered-candidate", "not-applicable-candidate", "unresolved"]),
  riskKeys: canonicalIdentifierListSchema,
  basis: longTextSchema,
  evidence: exactSourceListSchema,
}).strict()

const riskRegisterInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  scope: longTextSchema,
  operatingModel: exactOperatingModelReferenceSchema,
  architectureChallengeModel: exactArchitectureChallengeModelReferenceSchema,
  securityPrivacyAssessment: exactSecurityPrivacyAssessmentReferenceSchema,
  decisionRegister: exactDecisionRegisterReferenceSchema,
  risks: z.array(riskEntrySchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Risk keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Risks must use canonical key ordering"),
  requirementCoverage: z.array(riskRequirementCoverageSchema)
    .length(riskRegisterRequirementIds.length)
    .refine((entries) => unique(entries.map((entry) => entry.requirementId)), "Requirement coverage must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.requirementId)), "Requirement coverage must use canonical ID ordering"),
  inconsistencies: canonicalTextListSchema,
  unresolvedQuestions: canonicalTextListSchema,
  limitations: requiredCanonicalTextListSchema,
}).strict().superRefine((register, context) => {
  const expected = [...riskRegisterRequirementIds].sort((left, right) => left.localeCompare(right))
  if (register.requirementCoverage.some((entry, index) => entry.requirementId !== expected[index])) {
    context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must contain the complete Risk Register catalog" })
  }
  const riskKeys = new Set(register.risks.map((risk) => risk.key))
  if (register.requirementCoverage.flatMap((coverage) => coverage.riskKeys).some((key) => !riskKeys.has(key))) {
    context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must reference declared Risks" })
  }
})

export const riskRegisterInputSchema = rejectSecrets(riskRegisterInputBaseSchema)

export const riskRegisterSchema = riskRegisterInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("risk-register-candidate"),
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
    "risk-register-is-a-candidate-record-and-does-not-establish-owner-or-authority-assignments-assessment-fact-control-effectiveness-risk-acceptance-approval-exception-baseline-promotion-readiness-or-action-authority",
  ),
}).strict().superRefine((register, context) => {
  if ((register.revision === 1) !== (register.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Risk Register revisions after revision one require an exact predecessor digest" })
  }
})

export const exactRiskRegisterReferenceSchema = z.object({
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

export const riskRegisterStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("risk-register-status"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  register: exactRiskRegisterReferenceSchema.optional(),
  riskCount: z.number().int().nonnegative().max(4_096),
  notAssessedRiskCount: z.number().int().nonnegative().max(4_096),
  unresolvedResidualRiskCount: z.number().int().nonnegative().max(4_096),
  proposedTreatmentCount: z.number().int().nonnegative().max(4_096),
  unassignedOwnerCount: z.number().int().nonnegative().max(4_096),
  unverifiedControlCount: z.number().int().nonnegative().max(2_097_152),
  unresolvedRequirementCount: z.number().int().nonnegative().max(riskRegisterRequirementIds.length),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  inconsistencyCount: z.number().int().nonnegative().max(512),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(512),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "risk-register-status-reports-candidate-coverage-and-gaps-and-does-not-establish-assessment-fact-control-effectiveness-risk-acceptance-approval-exception-baseline-promotion-readiness-or-action-authority",
  ),
}).strict().superRefine((status, context) => {
  if (status.notAssessedRiskCount > status.riskCount ||
      status.unresolvedResidualRiskCount > status.riskCount ||
      status.proposedTreatmentCount > status.riskCount ||
      status.unassignedOwnerCount > status.riskCount) {
    context.addIssue({ code: "custom", message: "Risk status counts cannot exceed the total Risk count" })
  }
})

export const riskRegisterProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("risk-register-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: riskRegisterStatusSchema,
  register: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    membershipDigest: digestSchema,
    state: z.literal("candidate"),
    riskCount: z.number().int().nonnegative().max(4_096),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-identities-counts-statuses-and-digests-only-not-risk-statements-assessments-controls-treatments-residual-risk-evidence-related-record-content-personal-data-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "risk-register-projection-does-not-establish-assessment-fact-control-effectiveness-risk-acceptance-approval-exception-baseline-promotion-readiness-or-action-authority",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId ||
      projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId ||
      projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Risk Register projection must bind the exact Product and Initiative revisions" })
  }
})

export type RiskRegisterInput = z.infer<typeof riskRegisterInputSchema>
export type RiskRegister = z.infer<typeof riskRegisterSchema>
export type ExactRiskRegisterReference = z.infer<typeof exactRiskRegisterReferenceSchema>
export type RiskRegisterStatus = z.infer<typeof riskRegisterStatusSchema>
export type RiskRegisterProjection = z.infer<typeof riskRegisterProjectionSchema>
