import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { exactBoundedContextModelReferenceSchema } from "./bounded-context-model.js"
import { exactDataModelReferenceSchema } from "./data-model.js"
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
      reference.sourceId !== ordered[index]?.sourceId || reference.sourceRevision !== ordered[index]?.sourceRevision)) {
      context.addIssue({ code: "custom", message: "Exact Source references must use canonical identity ordering" })
    }
  })

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Authorization Model candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const authorizationModelRequirementIds = [
  "GAEP-DRAA-REQ-001",
  "GAEP-DRAA-REQ-003",
  "GAEP-DRAA-REQ-004",
  "GAEP-DRAA-REQ-005",
  "GAEP-DRAA-REQ-006",
  "GAEP-DRAA-REQ-008",
  "GAEP-DRAA-REQ-009",
  "GAEP-DRAA-REQ-013",
  "GAEP-DRAA-REQ-014",
  "GAEP-DRAA-REQ-015",
  "GAEP-DRAA-REQ-017",
  "GAEP-DRAA-REQ-018",
  "GAEP-DRAA-REQ-020",
  "GAEP-DRAA-REQ-022",
  "GAEP-DRAA-REQ-023",
  "GAEP-DRAA-REQ-024",
  "GAEP-DRAA-REQ-025",
  "GAEP-DRAA-REQ-026",
  "GAEP-DRAA-REQ-029",
  "GAEP-DRAA-REQ-033",
  "GAEP-DRAA-REQ-035",
  "GAEP-DRAA-REQ-036",
  "GAEP-IDAUTH-REQ-001",
  "GAEP-IDAUTH-REQ-004",
  "GAEP-IDAUTH-REQ-005",
  "GAEP-IDAUTH-REQ-006",
  "GAEP-IDAUTH-REQ-008",
  "GAEP-IDAUTH-REQ-009",
] as const

export const authorizationPrincipalKindSchema = z.enum([
  "agent",
  "governed-group",
  "human",
  "organization",
  "service",
  "system",
])

const authorizationPrincipalSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  kind: authorizationPrincipalKindSchema,
  operatingRoleKeys: requiredCanonicalIdentifierListSchema,
  identitySourceState: z.enum(["candidate-declared", "unresolved"]),
  identityAssuranceState: z.literal("not-verified"),
  limitations: requiredCanonicalTextListSchema,
  sources: exactSourceListSchema,
}).strict()

const authorizationRoleAssignmentSchema = z.object({
  key: identifierSchema,
  principalKey: identifierSchema,
  operatingRoleKey: identifierSchema,
  scopeKeys: requiredCanonicalIdentifierListSchema,
  assigningAuthorityRoleKey: identifierSchema,
  effectiveFrom: z.string().datetime(),
  expiryOrReviewCondition: longTextSchema,
  validityState: z.literal("candidate-not-effective"),
  delegationState: z.literal("not-granted"),
  limitations: requiredCanonicalTextListSchema,
  sources: exactSourceListSchema,
}).strict()

export const authorizationResourceKindSchema = z.enum([
  "architecture-element",
  "bounded-context",
  "data-entity",
  "process",
])

const authorizationResourceSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  kind: authorizationResourceKindSchema,
  subjectKey: identifierSchema,
  scopeKeys: requiredCanonicalIdentifierListSchema,
  classification: informationClassificationSchema,
  effectBoundary: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

const authorizationActionSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  purpose: longTextSchema,
  processKeys: requiredCanonicalIdentifierListSchema,
  effectKinds: requiredCanonicalIdentifierListSchema,
  requiredState: longTextSchema,
  approvalRequirementKeys: canonicalIdentifierListSchema,
  confirmationRequired: z.boolean(),
  sources: exactSourceListSchema,
}).strict()

const authorizationApprovalBindingSchema = z.object({
  key: identifierSchema,
  processApprovalRequirementKeys: requiredCanonicalIdentifierListSchema,
  actionKeys: requiredCanonicalIdentifierListSchema,
  resourceKeys: requiredCanonicalIdentifierListSchema,
  approverRoleKeys: requiredCanonicalIdentifierListSchema,
  segregation: longTextSchema,
  aggregation: longTextSchema,
  validity: longTextSchema,
  determinationState: z.literal("not-established"),
  sources: exactSourceListSchema,
}).strict()

const authorizationRuleSchema = z.object({
  key: identifierSchema,
  principalKeys: canonicalIdentifierListSchema,
  roleKeys: canonicalIdentifierListSchema,
  actionKeys: requiredCanonicalIdentifierListSchema,
  resourceKeys: requiredCanonicalIdentifierListSchema,
  approvalBindingKeys: canonicalIdentifierListSchema,
  decision: z.enum(["candidate-eligible", "candidate-ineligible", "unresolved"]),
  conditions: requiredCanonicalTextListSchema,
  invalidationTriggers: requiredCanonicalTextListSchema,
  delegationState: z.literal("not-granted"),
  sources: exactSourceListSchema,
}).strict().superRefine((rule, context) => {
  if (rule.principalKeys.length === 0 && rule.roleKeys.length === 0) {
    context.addIssue({ code: "custom", message: "Authorization rules require a Principal or role selector" })
  }
})

const authorizationRequirementCoverageSchema = z.object({
  requirementId: z.enum(authorizationModelRequirementIds),
  state: z.enum(["covered-candidate", "not-applicable-candidate", "unresolved"]),
  principalKeys: canonicalIdentifierListSchema,
  actionKeys: canonicalIdentifierListSchema,
  resourceKeys: canonicalIdentifierListSchema,
  ruleKeys: canonicalIdentifierListSchema,
  approvalBindingKeys: canonicalIdentifierListSchema,
  basis: longTextSchema,
  evidence: exactSourceListSchema,
}).strict()

const authorizationModelGovernanceSchema = z.object({
  securityAuthorityRoleKeys: requiredCanonicalIdentifierListSchema,
  identityAuthorityRoleKeys: requiredCanonicalIdentifierListSchema,
  modelReviewerRoleKeys: requiredCanonicalIdentifierListSchema,
  modelApprovalState: z.literal("not-granted"),
  identityVerificationState: z.literal("not-established"),
  roleAssignmentApprovalState: z.literal("not-granted"),
  standingAuthorityState: z.literal("not-granted"),
  authorizationGrantState: z.literal("not-granted"),
  enforcementState: z.literal("not-established"),
  reviewState: z.enum(["awaiting-human-review", "draft", "under-challenge"]),
  basis: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

const authorizationModelInputBaseSchema = z.object({
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
  principals: z.array(authorizationPrincipalSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Authorization Principal keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Authorization Principals must use canonical key ordering"),
  roleAssignments: z.array(authorizationRoleAssignmentSchema).min(1).max(8_192)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Role Assignment keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Role Assignments must use canonical key ordering"),
  resources: z.array(authorizationResourceSchema).min(1).max(8_192)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Authorization Resource keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Authorization Resources must use canonical key ordering"),
  actions: z.array(authorizationActionSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Authorization Action keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Authorization Actions must use canonical key ordering"),
  approvalBindings: z.array(authorizationApprovalBindingSchema).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Approval Binding keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Approval Bindings must use canonical key ordering"),
  rules: z.array(authorizationRuleSchema).min(1).max(16_384)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Authorization Rule keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Authorization Rules must use canonical key ordering"),
  requirementCoverage: z.array(authorizationRequirementCoverageSchema).length(authorizationModelRequirementIds.length)
    .refine((entries) => unique(entries.map((entry) => entry.requirementId)), "Requirement coverage must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.requirementId)), "Requirement coverage must use canonical ID ordering"),
  assumptions: canonicalTextListSchema,
  inconsistencies: canonicalTextListSchema,
  unresolvedQuestions: canonicalTextListSchema,
  governance: authorizationModelGovernanceSchema,
  limitations: canonicalTextListSchema,
}).strict().superRefine((record, context) => {
  const expected = [...authorizationModelRequirementIds].sort((left, right) => left.localeCompare(right))
  if (record.requirementCoverage.some((entry, index) => entry.requirementId !== expected[index])) {
    context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must contain the complete Authorization Model catalog" })
  }
  const principalKeys = new Set(record.principals.map((entry) => entry.key))
  const resourceKeys = new Set(record.resources.map((entry) => entry.key))
  const actionKeys = new Set(record.actions.map((entry) => entry.key))
  const approvalBindingKeys = new Set(record.approvalBindings.map((entry) => entry.key))
  const ruleKeys = new Set(record.rules.map((entry) => entry.key))
  for (const assignment of record.roleAssignments) {
    if (!principalKeys.has(assignment.principalKey)) {
      context.addIssue({ code: "custom", path: ["roleAssignments"], message: "Role Assignments must reference declared Principals" })
    }
  }
  for (const binding of record.approvalBindings) {
    if (binding.actionKeys.some((key) => !actionKeys.has(key)) || binding.resourceKeys.some((key) => !resourceKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["approvalBindings"], message: "Approval Bindings must reference declared actions and resources" })
    }
  }
  for (const rule of record.rules) {
    if (rule.principalKeys.some((key) => !principalKeys.has(key)) ||
        rule.actionKeys.some((key) => !actionKeys.has(key)) ||
        rule.resourceKeys.some((key) => !resourceKeys.has(key)) ||
        rule.approvalBindingKeys.some((key) => !approvalBindingKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["rules"], message: "Authorization Rules must reference declared Principals, actions, resources, and approval bindings" })
    }
  }
  const coveredActions = new Set(record.rules.flatMap((entry) => entry.actionKeys))
  const coveredResources = new Set(record.rules.flatMap((entry) => entry.resourceKeys))
  if ([...actionKeys].some((key) => !coveredActions.has(key)) || [...resourceKeys].some((key) => !coveredResources.has(key))) {
    context.addIssue({ code: "custom", path: ["rules"], message: "Every action and resource requires explicit Authorization Rule coverage" })
  }
  for (const coverage of record.requirementCoverage) {
    if (coverage.principalKeys.some((key) => !principalKeys.has(key)) ||
        coverage.actionKeys.some((key) => !actionKeys.has(key)) ||
        coverage.resourceKeys.some((key) => !resourceKeys.has(key)) ||
        coverage.ruleKeys.some((key) => !ruleKeys.has(key)) ||
        coverage.approvalBindingKeys.some((key) => !approvalBindingKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must reference declared Authorization Model subjects" })
    }
  }
})

export const authorizationModelInputSchema = rejectSecrets(authorizationModelInputBaseSchema)

export const authorizationModelSchema = authorizationModelInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("authorization-model-candidate"),
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
    "authorization-model-is-a-candidate-record-and-does-not-verify-identity-approve-role-assignments-or-standing-authority-create-an-authorization-grant-enforce-policy-establish-operational-readiness-or-authorize-action",
  ),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Authorization Model revisions after revision one require an exact predecessor digest" })
  }
})

export const exactAuthorizationModelReferenceSchema = exactBoundedContextModelReferenceSchema

export const authorizationModelStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("authorization-model-status"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  model: exactAuthorizationModelReferenceSchema.optional(),
  principalCount: z.number().int().nonnegative().max(4_096),
  roleAssignmentCount: z.number().int().nonnegative().max(8_192),
  resourceCount: z.number().int().nonnegative().max(8_192),
  actionCount: z.number().int().nonnegative().max(4_096),
  approvalBindingCount: z.number().int().nonnegative().max(4_096),
  ruleCount: z.number().int().nonnegative().max(16_384),
  uncoveredOperatingRoleCount: z.number().int().nonnegative().max(2_048),
  uncoveredProcessCount: z.number().int().nonnegative().max(512),
  uncoveredDataEntityCount: z.number().int().nonnegative().max(2_048),
  unresolvedIdentityCount: z.number().int().nonnegative().max(4_096),
  unresolvedRuleCount: z.number().int().nonnegative().max(16_384),
  unresolvedRequirementCount: z.number().int().nonnegative().max(authorizationModelRequirementIds.length),
  inconsistencyCount: z.number().int().nonnegative().max(512),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(512),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "authorization-model-status-reports-candidate-coverage-and-gaps-and-does-not-verify-identity-approve-role-assignments-or-standing-authority-create-an-authorization-grant-enforce-policy-establish-operational-readiness-or-authorize-action",
  ),
}).strict()

export const authorizationModelProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("authorization-model-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: authorizationModelStatusSchema,
  model: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    membershipDigest: digestSchema,
    state: z.literal("candidate"),
    principalCount: z.number().int().nonnegative().max(4_096),
    actionCount: z.number().int().nonnegative().max(4_096),
    ruleCount: z.number().int().nonnegative().max(16_384),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-identities-counts-statuses-and-digests-only-not-principal-identifiers-role-assignments-rules-conditions-approval-content-source-content-personal-data-locators-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "authorization-model-projection-does-not-verify-identity-approve-role-assignments-or-standing-authority-create-an-authorization-grant-enforce-policy-establish-operational-readiness-or-authorize-action",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId ||
      projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId ||
      projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Authorization Model projection must bind the exact Product and Initiative revisions" })
  }
})

export type AuthorizationModelInput = z.infer<typeof authorizationModelInputSchema>
export type AuthorizationModel = z.infer<typeof authorizationModelSchema>
export type ExactAuthorizationModelReference = z.infer<typeof exactAuthorizationModelReferenceSchema>
export type AuthorizationModelStatus = z.infer<typeof authorizationModelStatusSchema>
export type AuthorizationModelProjection = z.infer<typeof authorizationModelProjectionSchema>
