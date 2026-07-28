import { z } from "zod"

import {
  businessContextBindingSchema,
  exactStakeholderModelReferenceSchema,
} from "./business-understanding.js"
import {
  exactDesignApplicabilityReferenceSchema,
} from "./design-applicability.js"
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

function canonicalArray<T extends z.ZodType>(schema: T, maximum = 512) {
  return z.array(schema).max(maximum)
    .refine((values) => unique(values as string[]), "Values must be unique")
    .refine((values) => canonical(values as string[]), "Values must use canonical lexical ordering")
}

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Design Persona and Role candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalTextListSchema = canonicalArray(shortTextSchema)
const exactSourceListSchema = z.array(exactSourceReferenceSchema).min(1).max(256)
  .refine((entries) => unique(entries.map((entry) =>
    `${entry.sourceId}:${entry.sourceRevision}:${entry.recordDigest}:${entry.contentDigest}`)), "Source references must be unique")

export const designParticipantCategoryValues = [
  "affected-contributor",
  "change-owner",
  "reviewer",
  "user",
  "workspace-steward",
] as const
export const designParticipantCategorySchema = z.enum(designParticipantCategoryValues)

export const designRoleKindValues = [
  "design-research-facilitator",
  "design-reviewer",
  "design-system-steward",
  "product-designer",
] as const
export const designRoleKindSchema = z.enum(designRoleKindValues)

const coverageApprovalSchema = z.object({
  state: z.enum(["not-required", "pending", "approved", "rejected"]),
  decidedBy: humanActorSchema.optional(),
  decidedAt: z.string().datetime().optional(),
  conditions: canonicalTextListSchema,
}).strict().superRefine((approval, context) => {
  const decided = approval.state === "approved" || approval.state === "rejected"
  if (decided !== (approval.decidedBy !== undefined && approval.decidedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Approved or rejected coverage requires an attributable human decision; other states forbid one" })
  }
})

const coverageDecisionBaseSchema = z.object({
  status: z.enum(["represented", "not-applicable", "unresolved"]),
  rationale: longTextSchema,
  sources: exactSourceListSchema,
  approval: coverageApprovalSchema,
}).strict().superRefine((decision, context) => {
  if (decision.status === "represented" && decision.approval.state !== "not-required") {
    context.addIssue({ code: "custom", path: ["approval", "state"], message: "Represented coverage does not require an exception approval" })
  }
  if (decision.status === "unresolved" && decision.approval.state !== "pending") {
    context.addIssue({ code: "custom", path: ["approval", "state"], message: "Unresolved coverage must retain a pending human decision" })
  }
  if (decision.status === "not-applicable" && decision.approval.state !== "approved") {
    context.addIssue({ code: "custom", path: ["approval", "state"], message: "Not-applicable coverage requires attributable human approval" })
  }
})

const personaSchema = z.object({
  key: identifierSchema,
  label: z.string().trim().min(2).max(240),
  evidenceState: z.enum(["hypothesis", "evidence-linked", "human-reviewed", "disputed", "retired"]),
  participantCategories: canonicalArray(designParticipantCategorySchema, designParticipantCategoryValues.length)
    .refine((values) => values.length > 0, "A persona must represent at least one participant category"),
  stakeholderKeys: canonicalArray(identifierSchema, 128)
    .refine((values) => values.length > 0, "A persona must bind at least one governed stakeholder"),
  designScopeKeys: canonicalArray(identifierSchema, 256)
    .refine((values) => values.length > 0, "A persona must bind at least one Design Applicability scope"),
  jobs: canonicalTextListSchema.refine((values) => values.length > 0, "A persona requires at least one job"),
  goals: canonicalTextListSchema.refine((values) => values.length > 0, "A persona requires at least one goal"),
  constraints: canonicalTextListSchema,
  behaviors: canonicalTextListSchema,
  contexts: canonicalTextListSchema.refine((values) => values.length > 0, "A persona requires at least one usage context"),
  accessibilityNeeds: canonicalTextListSchema,
  inclusionConsiderations: canonicalTextListSchema,
  sources: exactSourceListSchema,
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
  validationState: z.literal("not-established"),
  privacyBoundary: z.literal(
    "persona-is-a-purpose-limited-design-hypothesis-and-must-not-contain-direct-personal-identifiers-or-be-used-for-productivity-ranking",
  ),
}).strict().superRefine((persona, context) => {
  const reviewed = persona.reviewedBy !== undefined || persona.reviewedAt !== undefined
  if (persona.evidenceState === "human-reviewed" && (!persona.reviewedBy || !persona.reviewedAt)) {
    context.addIssue({ code: "custom", message: "Human-reviewed persona evidence requires an attributable reviewer and time" })
  }
  if (persona.evidenceState !== "human-reviewed" && reviewed) {
    context.addIssue({ code: "custom", message: "Only human-reviewed persona evidence can carry review metadata" })
  }
})

const designRoleSchema = z.object({
  key: identifierSchema,
  label: z.string().trim().min(2).max(240),
  kind: designRoleKindSchema,
  stakeholderKeys: canonicalArray(identifierSchema, 128)
    .refine((values) => values.length > 0, "A design role must bind at least one governed stakeholder"),
  personaKeys: canonicalArray(identifierSchema, 256)
    .refine((values) => values.length > 0, "A design role must name at least one persona served or represented"),
  designScopeKeys: canonicalArray(identifierSchema, 256)
    .refine((values) => values.length > 0, "A design role must bind at least one Design Applicability scope"),
  responsibilities: canonicalTextListSchema
    .refine((values) => values.length > 0, "A design role requires at least one explicit responsibility"),
  accountableDecisions: canonicalTextListSchema,
  collaborationExpectations: canonicalTextListSchema,
  absenceAndEscalation: longTextSchema,
  sources: exactSourceListSchema,
  assignmentState: z.literal("not-established"),
  competenceState: z.literal("not-established"),
  authorityState: z.literal("not-established"),
  authorityBoundary: z.literal(
    "design-role-is-candidate-responsibility-guidance-and-does-not-appoint-a-person-verify-competence-grant-authority-or-approve-design",
  ),
}).strict()

const exactDesignApplicabilityBindingSchema = exactDesignApplicabilityReferenceSchema.extend({
  membershipDigest: digestSchema,
}).strict()

const designPersonaRoleModelInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  stakeholderModel: exactStakeholderModelReferenceSchema,
  designApplicability: exactDesignApplicabilityBindingSchema,
  personas: z.array(personaSchema).min(1).max(256)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Persona keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Personas must use canonical key ordering"),
  participantCoverage: z.array(coverageDecisionBaseSchema.extend({
    category: designParticipantCategorySchema,
  }).strict()).length(designParticipantCategoryValues.length),
  designRoles: z.array(designRoleSchema).min(1).max(256)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Design role keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Design roles must use canonical key ordering"),
  roleCoverage: z.array(coverageDecisionBaseSchema.extend({
    kind: designRoleKindSchema,
  }).strict()).length(designRoleKindValues.length),
  contestability: z.object({
    path: longTextSchema,
    ownerStakeholderKey: identifierSchema,
    escalation: longTextSchema,
    sources: exactSourceListSchema,
  }).strict(),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema.refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  personaValidationState: z.literal("not-established"),
  roleAppointmentState: z.literal("not-established"),
  designApprovalState: z.literal("not-established"),
  implementationAuthorityState: z.literal("not-established"),
}).strict().superRefine((model, context) => {
  const stakeholderKeys = new Set(model.personas.flatMap((persona) => persona.stakeholderKeys))
  const personaKeys = new Set(model.personas.map((persona) => persona.key))
  const participantCategories = model.participantCoverage.map((entry) => entry.category)
  if (!unique(participantCategories) || participantCategories.some((category, index) =>
    category !== designParticipantCategoryValues[index])) {
    context.addIssue({ code: "custom", path: ["participantCoverage"], message: "Participant coverage must include the canonical category catalog exactly once" })
  }
  for (const [index, coverage] of model.participantCoverage.entries()) {
    const represented = model.personas.some((persona) => persona.participantCategories.includes(coverage.category))
    if ((coverage.status === "represented") !== represented) {
      context.addIssue({ code: "custom", path: ["participantCoverage", index, "status"], message: "Represented participant coverage must match the recorded persona inventory" })
    }
  }
  const roleKinds = model.roleCoverage.map((entry) => entry.kind)
  if (!unique(roleKinds) || roleKinds.some((kind, index) => kind !== designRoleKindValues[index])) {
    context.addIssue({ code: "custom", path: ["roleCoverage"], message: "Role coverage must include the canonical role catalog exactly once" })
  }
  for (const [index, coverage] of model.roleCoverage.entries()) {
    const represented = model.designRoles.some((role) => role.kind === coverage.kind)
    if ((coverage.status === "represented") !== represented) {
      context.addIssue({ code: "custom", path: ["roleCoverage", index, "status"], message: "Represented role coverage must match the recorded design role inventory" })
    }
  }
  for (const [index, role] of model.designRoles.entries()) {
    if (role.personaKeys.some((key) => !personaKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["designRoles", index, "personaKeys"], message: "Design roles must reference recorded personas" })
    }
    for (const key of role.stakeholderKeys) stakeholderKeys.add(key)
  }
  if (!stakeholderKeys.has(model.contestability.ownerStakeholderKey)) {
    context.addIssue({ code: "custom", path: ["contestability", "ownerStakeholderKey"], message: "Contestability owner must reference a stakeholder bound by a persona or design role" })
  }
  const unresolvedCoverage = [...model.participantCoverage, ...model.roleCoverage].some((entry) =>
    entry.status === "unresolved" || entry.approval.state === "pending" || entry.approval.state === "rejected")
  const weakPersonaEvidence = model.personas.some((persona) =>
    persona.evidenceState === "hypothesis" || persona.evidenceState === "disputed")
  if (model.reviewState === "ready-for-human-review" &&
      (unresolvedCoverage || weakPersonaEvidence || model.unresolvedQuestions.length > 0)) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Design Persona and Role guidance cannot be ready for human review while coverage, evidence, or questions remain unresolved" })
  }
})

export const designPersonaRoleModelInputSchema = rejectSecrets(designPersonaRoleModelInputBaseSchema)

export const designPersonaRoleModelSchema = designPersonaRoleModelInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("design-persona-role-candidate"),
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
    "design-persona-role-model-is-candidate-guidance-and-does-not-validate-a-persona-appoint-a-role-verify-competence-approve-design-grant-readiness-or-authorize-action",
  ),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Design Persona and Role revisions after revision one require an exact predecessor digest" })
  }
})

export const exactDesignPersonaRoleModelReferenceSchema = z.object({
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

export const designPersonaRoleModelStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("design-persona-role-status"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  candidate: exactDesignPersonaRoleModelReferenceSchema.optional(),
  personaCount: z.number().int().nonnegative().max(256),
  designRoleCount: z.number().int().nonnegative().max(256),
  representedParticipantCategoryCount: z.number().int().nonnegative().max(designParticipantCategoryValues.length),
  unresolvedParticipantCategoryCount: z.number().int().nonnegative().max(designParticipantCategoryValues.length),
  representedRoleKindCount: z.number().int().nonnegative().max(designRoleKindValues.length),
  unresolvedRoleKindCount: z.number().int().nonnegative().max(designRoleKindValues.length),
  weakEvidencePersonaCount: z.number().int().nonnegative().max(256),
  humanReviewedPersonaCount: z.number().int().nonnegative().max(256),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "design-persona-role-status-is-observational-and-does-not-validate-personas-appoint-roles-verify-competence-approve-design-grant-readiness-or-authorize-action",
  ),
}).strict().superRefine((status, context) => {
  const gaps = status.unresolvedParticipantCategoryCount + status.unresolvedRoleKindCount +
    status.weakEvidencePersonaCount + status.staleBindingCount + status.staleSourceReferenceCount +
    status.unresolvedQuestionCount
  if (status.state === "complete-for-review" &&
      (gaps > 0 || status.reviewState !== "ready-for-human-review" || status.reasons.length > 0 || !status.candidate)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires an exact review-ready candidate with no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Design Persona and Role status must expose reasons" })
  }
})

export const designPersonaRoleModelProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("design-persona-role-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: designPersonaRoleModelStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    membershipDigest: digestSchema, state: z.literal("candidate"),
    personaCount: z.number().int().positive(), designRoleCount: z.number().int().positive(),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-record-identities-counts-statuses-and-digests-only-not-persona-content-behaviors-constraints-source-content-personal-data-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "design-persona-role-projection-is-read-only-and-does-not-validate-personas-appoint-roles-verify-competence-approve-design-grant-readiness-or-authorize-write-or-action",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Design Persona and Role projection must bind the exact Product and Initiative revisions" })
  }
})

export type DesignParticipantCategory = z.infer<typeof designParticipantCategorySchema>
export type DesignRoleKind = z.infer<typeof designRoleKindSchema>
export type DesignPersonaRoleModelInput = z.infer<typeof designPersonaRoleModelInputSchema>
export type DesignPersonaRoleModel = z.infer<typeof designPersonaRoleModelSchema>
export type ExactDesignPersonaRoleModelReference = z.infer<typeof exactDesignPersonaRoleModelReferenceSchema>
export type DesignPersonaRoleModelStatus = z.infer<typeof designPersonaRoleModelStatusSchema>
export type DesignPersonaRoleModelProjection = z.infer<typeof designPersonaRoleModelProjectionSchema>
