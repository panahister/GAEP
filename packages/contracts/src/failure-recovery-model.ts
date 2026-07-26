import { z } from "zod"

import { exactAuthorizationModelReferenceSchema } from "./authorization-model.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactBoundedContextModelReferenceSchema } from "./bounded-context-model.js"
import { exactDataModelReferenceSchema } from "./data-model.js"
import { exactEventIntegrationModelReferenceSchema } from "./event-integration-model.js"
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
    message: "Portable Failure and Recovery Model candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const failureRecoveryStateRequirementIds = [
  "GAEP-STATE-REQ-009", "GAEP-STATE-REQ-020", "GAEP-STATE-REQ-024",
] as const

export const failureRecoveryEffectRequirementIds = [
  "GAEP-EER-REQ-001", "GAEP-EER-REQ-002", "GAEP-EER-REQ-003", "GAEP-EER-REQ-004",
  "GAEP-EER-REQ-005", "GAEP-EER-REQ-006", "GAEP-EER-REQ-007", "GAEP-EER-REQ-008",
  "GAEP-EER-REQ-009", "GAEP-EER-REQ-010", "GAEP-EER-REQ-011", "GAEP-EER-REQ-012",
  "GAEP-EER-REQ-013", "GAEP-EER-REQ-014", "GAEP-EER-REQ-015", "GAEP-EER-REQ-016",
  "GAEP-EER-REQ-017", "GAEP-EER-REQ-018", "GAEP-EER-REQ-019", "GAEP-EER-REQ-020",
  "GAEP-EER-REQ-021", "GAEP-EER-REQ-022", "GAEP-EER-REQ-023", "GAEP-EER-REQ-024",
  "GAEP-EER-REQ-025", "GAEP-EER-REQ-026", "GAEP-EER-REQ-027", "GAEP-EER-REQ-028",
  "GAEP-EER-REQ-029", "GAEP-EER-REQ-030",
] as const

export const failureRecoveryRuntimeRequirementIds = [
  "GAEP-RUN-REQ-001", "GAEP-RUN-REQ-002", "GAEP-RUN-REQ-003", "GAEP-RUN-REQ-004",
  "GAEP-RUN-REQ-005", "GAEP-RUN-REQ-006", "GAEP-RUN-REQ-007", "GAEP-RUN-REQ-008",
  "GAEP-RUN-REQ-009", "GAEP-RUN-REQ-010", "GAEP-RUN-REQ-011", "GAEP-RUN-REQ-012",
  "GAEP-RUN-REQ-013", "GAEP-RUN-REQ-014",
] as const

export const failureRecoveryRequirementIds = [
  ...failureRecoveryStateRequirementIds,
  ...failureRecoveryEffectRequirementIds,
  ...failureRecoveryRuntimeRequirementIds,
] as const

const effectDescriptorSchema = z.enum([
  "destructive-or-irreversible", "external-effect", "observe", "provisional", "reversible-change",
])

const failureModeSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  category: z.enum([
    "authorization", "concurrency", "dependency", "execution", "governance", "integrity",
    "resource-exhaustion", "security", "timeout", "uncertain-result", "validation",
  ]),
  affectedProcessKeys: requiredCanonicalIdentifierListSchema,
  affectedEventTypeKeys: requiredCanonicalIdentifierListSchema,
  affectedCommandKeys: requiredCanonicalIdentifierListSchema,
  affectedAdapterKeys: requiredCanonicalIdentifierListSchema,
  affectedRouteKeys: requiredCanonicalIdentifierListSchema,
  affectedDataEntityKeys: canonicalIdentifierListSchema,
  effectDescriptors: canonicalArray(effectDescriptorSchema).refine(
    (values) => values.length > 0,
    "At least one effect descriptor is required",
  ),
  detectionSignals: requiredCanonicalTextListSchema,
  containmentRule: longTextSchema,
  propagationBoundary: longTextSchema,
  userAndBusinessImpact: longTextSchema,
  explicitNonReversibilityBehavior: longTextSchema,
  retryPolicyKeys: canonicalIdentifierListSchema,
  compensationPlanKeys: canonicalIdentifierListSchema,
  recoveryPlanKeys: requiredCanonicalIdentifierListSchema,
  classification: informationClassificationSchema,
  occurrenceState: z.literal("definition-only-not-observed"),
  sources: exactSourceListSchema,
}).strict()

const retryPolicySchema = z.object({
  key: identifierSchema,
  failureModeKeys: requiredCanonicalIdentifierListSchema,
  commandKeys: requiredCanonicalIdentifierListSchema,
  adapterKeys: requiredCanonicalIdentifierListSchema,
  authorizationActionKeys: requiredCanonicalIdentifierListSchema,
  failureClassification: z.enum(["explicitly-retryable", "non-retryable", "unknown-stop"]),
  maximumAttempts: z.number().int().positive().max(100),
  timeoutAndBackoff: longTextSchema,
  retryCondition: longTextSchema,
  idempotencyScopeAndKey: longTextSchema,
  duplicateEffectRule: longTextSchema,
  changedConditionRule: longTextSchema,
  exhaustionBehavior: longTextSchema,
  retryState: z.literal("not-attempted"),
  safetyState: z.literal("not-established"),
  authorizationState: z.literal("not-granted"),
  sources: exactSourceListSchema,
}).strict()

const compensationPlanSchema = z.object({
  key: identifierSchema,
  failureModeKeys: requiredCanonicalIdentifierListSchema,
  originalCommandKeys: requiredCanonicalIdentifierListSchema,
  compensationCommandKeys: requiredCanonicalIdentifierListSchema,
  authorizationActionKeys: requiredCanonicalIdentifierListSchema,
  affectedDataEntityKeys: canonicalIdentifierListSchema,
  preconditions: requiredCanonicalTextListSchema,
  compensationSteps: requiredCanonicalTextListSchema,
  verificationPostconditions: requiredCanonicalTextListSchema,
  residualEffectRule: longTextSchema,
  compensationFailureBehavior: longTextSchema,
  originalEffectBindingRule: longTextSchema,
  executionState: z.literal("not-executed"),
  restorationState: z.literal("not-established"),
  authorizationState: z.literal("not-granted"),
  sources: exactSourceListSchema,
}).strict()

const recoveryPlanSchema = z.object({
  key: identifierSchema,
  failureModeKeys: requiredCanonicalIdentifierListSchema,
  processKeys: requiredCanonicalIdentifierListSchema,
  routeKeys: requiredCanonicalIdentifierListSchema,
  ownerRoleKeys: requiredCanonicalIdentifierListSchema,
  authorizationActionKeys: requiredCanonicalIdentifierListSchema,
  lastVerifiedSafeStateRule: longTextSchema,
  knownAndUncertainEffectsRule: longTextSchema,
  containmentSteps: requiredCanonicalTextListSchema,
  reconciliationSteps: requiredCanonicalTextListSchema,
  restorationSteps: requiredCanonicalTextListSchema,
  revalidationRequirements: requiredCanonicalTextListSchema,
  resumeConditions: requiredCanonicalTextListSchema,
  degradedModeBehavior: longTextSchema,
  manualModeBehavior: longTextSchema,
  quarantineAndRevocationBehavior: longTextSchema,
  residualRiskRule: longTextSchema,
  recoveryState: z.literal("not-started"),
  successState: z.literal("not-established"),
  returnToServiceState: z.literal("not-authorized"),
  sources: exactSourceListSchema,
}).strict()

const recoveryEvidenceDefinitionSchema = z.object({
  key: identifierSchema,
  recoveryPlanKey: identifierSchema,
  requiredEvidenceTypes: requiredCanonicalIdentifierListSchema,
  authoritativeReceiptRule: longTextSchema,
  postconditionVerificationRule: longTextSchema,
  reconciliationRule: longTextSchema,
  residualRiskRule: longTextSchema,
  custodyIntegrityAndRetention: longTextSchema,
  evidenceState: z.literal("definition-only-not-collected"),
  acceptanceState: z.literal("not-established"),
  sources: exactSourceListSchema,
}).strict()

const failureRecoveryRequirementCoverageSchema = z.object({
  requirementId: z.enum(failureRecoveryRequirementIds),
  state: z.enum(["covered-candidate", "not-applicable-candidate", "unresolved"]),
  failureModeKeys: canonicalIdentifierListSchema,
  retryPolicyKeys: canonicalIdentifierListSchema,
  compensationPlanKeys: canonicalIdentifierListSchema,
  recoveryPlanKeys: canonicalIdentifierListSchema,
  recoveryEvidenceDefinitionKeys: canonicalIdentifierListSchema,
  basis: longTextSchema,
  evidence: exactSourceListSchema,
}).strict()

const failureRecoveryGovernanceSchema = z.object({
  failureModelStewardRoleKeys: requiredCanonicalIdentifierListSchema,
  recoveryOwnerRoleKeys: requiredCanonicalIdentifierListSchema,
  recoveryVerifierRoleKeys: requiredCanonicalIdentifierListSchema,
  reviewState: z.enum(["awaiting-human-review", "draft", "under-challenge"]),
  failureRegistryApprovalState: z.literal("not-granted"),
  retrySafetyState: z.literal("not-established"),
  compensationApprovalState: z.literal("not-granted"),
  recoveryPlanApprovalState: z.literal("not-granted"),
  recoveryEvidenceAcceptanceState: z.literal("not-established"),
  operationalReadinessState: z.literal("not-established"),
  returnToServiceAuthorityState: z.literal("not-granted"),
  executionAuthorityState: z.literal("not-granted"),
  basis: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

const failureRecoveryModelInputBaseSchema = z.object({
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
  failureModes: z.array(failureModeSchema).min(1).max(8_192)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Failure Mode keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Failure Modes must use canonical key ordering"),
  retryPolicies: z.array(retryPolicySchema).max(8_192)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Retry Policy keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Retry Policies must use canonical key ordering"),
  compensationPlans: z.array(compensationPlanSchema).max(8_192)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Compensation Plan keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Compensation Plans must use canonical key ordering"),
  recoveryPlans: z.array(recoveryPlanSchema).min(1).max(8_192)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Recovery Plan keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Recovery Plans must use canonical key ordering"),
  recoveryEvidenceDefinitions: z.array(recoveryEvidenceDefinitionSchema).min(1).max(8_192)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Recovery Evidence Definition keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Recovery Evidence Definitions must use canonical key ordering"),
  requirementCoverage: z.array(failureRecoveryRequirementCoverageSchema).length(failureRecoveryRequirementIds.length)
    .refine((entries) => unique(entries.map((entry) => entry.requirementId)), "Requirement coverage must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.requirementId)), "Requirement coverage must use canonical ID ordering"),
  governance: failureRecoveryGovernanceSchema,
  assumptions: canonicalTextListSchema,
  inconsistencies: canonicalTextListSchema,
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema,
}).strict().superRefine((record, context) => {
  const expected = [...failureRecoveryRequirementIds].sort((left, right) => left.localeCompare(right))
  if (record.requirementCoverage.some((entry, index) => entry.requirementId !== expected[index])) {
    context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must contain the complete Failure and Recovery Model catalog" })
  }
  const failureKeys = new Set(record.failureModes.map((entry) => entry.key))
  const retryKeys = new Set(record.retryPolicies.map((entry) => entry.key))
  const compensationKeys = new Set(record.compensationPlans.map((entry) => entry.key))
  const recoveryKeys = new Set(record.recoveryPlans.map((entry) => entry.key))
  const evidenceKeys = new Set(record.recoveryEvidenceDefinitions.map((entry) => entry.key))
  for (const failure of record.failureModes) {
    if (failure.retryPolicyKeys.some((key) => !retryKeys.has(key)) ||
        failure.compensationPlanKeys.some((key) => !compensationKeys.has(key)) ||
        failure.recoveryPlanKeys.some((key) => !recoveryKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["failureModes"], message: "Failure Modes must reference declared retry, compensation, and recovery definitions" })
    }
  }
  for (const retry of record.retryPolicies) {
    if (retry.failureModeKeys.some((key) => !failureKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["retryPolicies"], message: "Retry Policies must reference declared Failure Modes" })
    }
  }
  for (const compensation of record.compensationPlans) {
    if (compensation.failureModeKeys.some((key) => !failureKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["compensationPlans"], message: "Compensation Plans must reference declared Failure Modes" })
    }
  }
  for (const recovery of record.recoveryPlans) {
    if (recovery.failureModeKeys.some((key) => !failureKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["recoveryPlans"], message: "Recovery Plans must reference declared Failure Modes" })
    }
  }
  for (const evidence of record.recoveryEvidenceDefinitions) {
    if (!recoveryKeys.has(evidence.recoveryPlanKey)) {
      context.addIssue({ code: "custom", path: ["recoveryEvidenceDefinitions"], message: "Recovery Evidence Definitions must reference declared Recovery Plans" })
    }
  }
  const coveredRecoveryPlans = new Set(record.recoveryEvidenceDefinitions.map((entry) => entry.recoveryPlanKey))
  if ([...recoveryKeys].some((key) => !coveredRecoveryPlans.has(key))) {
    context.addIssue({ code: "custom", path: ["recoveryEvidenceDefinitions"], message: "Every Recovery Plan requires an explicit Recovery Evidence Definition" })
  }
  for (const coverage of record.requirementCoverage) {
    if (coverage.failureModeKeys.some((key) => !failureKeys.has(key)) ||
        coverage.retryPolicyKeys.some((key) => !retryKeys.has(key)) ||
        coverage.compensationPlanKeys.some((key) => !compensationKeys.has(key)) ||
        coverage.recoveryPlanKeys.some((key) => !recoveryKeys.has(key)) ||
        coverage.recoveryEvidenceDefinitionKeys.some((key) => !evidenceKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must reference declared Failure and Recovery subjects" })
    }
  }
})

export const failureRecoveryModelInputSchema = rejectSecrets(failureRecoveryModelInputBaseSchema)

export const failureRecoveryModelSchema = failureRecoveryModelInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("failure-recovery-model-candidate"),
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
    "failure-recovery-model-is-a-candidate-registry-and-does-not-prove-failure-occurrence-retry-safety-compensation-or-restoration-recovery-success-return-to-service-operational-readiness-or-authorize-action",
  ),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Failure and Recovery Model revisions after revision one require an exact predecessor digest" })
  }
})

export const exactFailureRecoveryModelReferenceSchema = exactEventIntegrationModelReferenceSchema

export const failureRecoveryModelStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("failure-recovery-model-status"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  model: exactFailureRecoveryModelReferenceSchema.optional(),
  failureModeCount: z.number().int().nonnegative().max(8_192),
  retryPolicyCount: z.number().int().nonnegative().max(8_192),
  compensationPlanCount: z.number().int().nonnegative().max(8_192),
  recoveryPlanCount: z.number().int().nonnegative().max(8_192),
  recoveryEvidenceDefinitionCount: z.number().int().nonnegative().max(8_192),
  uncoveredProcessCount: z.number().int().nonnegative().max(512),
  uncoveredCommandCount: z.number().int().nonnegative().max(8_192),
  uncoveredRouteCount: z.number().int().nonnegative().max(8_192),
  uncoveredAuthorizationActionCount: z.number().int().nonnegative().max(4_096),
  unresolvedRecoveryEvidenceCount: z.number().int().nonnegative().max(8_192),
  unresolvedRequirementCount: z.number().int().nonnegative().max(failureRecoveryRequirementIds.length),
  inconsistencyCount: z.number().int().nonnegative().max(512),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(512),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "failure-recovery-model-status-reports-candidate-coverage-and-gaps-and-does-not-prove-failure-occurrence-retry-safety-compensation-or-restoration-recovery-success-return-to-service-operational-readiness-or-authorize-action",
  ),
}).strict()

export const failureRecoveryModelProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("failure-recovery-model-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: failureRecoveryModelStatusSchema,
  model: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    membershipDigest: digestSchema,
    state: z.literal("candidate"),
    failureModeCount: z.number().int().nonnegative().max(8_192),
    retryPolicyCount: z.number().int().nonnegative().max(8_192),
    compensationPlanCount: z.number().int().nonnegative().max(8_192),
    recoveryPlanCount: z.number().int().nonnegative().max(8_192),
    recoveryEvidenceDefinitionCount: z.number().int().nonnegative().max(8_192),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-identities-counts-statuses-and-digests-only-not-failure-evidence-operational-telemetry-retry-keys-compensation-content-recovery-steps-source-content-personal-data-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "failure-recovery-model-projection-does-not-prove-failure-occurrence-retry-safety-compensation-or-restoration-recovery-success-return-to-service-operational-readiness-or-authorize-action",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId ||
      projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId ||
      projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Failure and Recovery Model projection must bind the exact Product and Initiative revisions" })
  }
})

export type FailureRecoveryModelInput = z.infer<typeof failureRecoveryModelInputSchema>
export type FailureRecoveryModel = z.infer<typeof failureRecoveryModelSchema>
export type ExactFailureRecoveryModelReference = z.infer<typeof exactFailureRecoveryModelReferenceSchema>
export type FailureRecoveryModelStatus = z.infer<typeof failureRecoveryModelStatusSchema>
export type FailureRecoveryModelProjection = z.infer<typeof failureRecoveryModelProjectionSchema>
