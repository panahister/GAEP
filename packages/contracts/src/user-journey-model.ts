import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { exactDesignApplicabilityReferenceSchema } from "./design-applicability.js"
import { exactDesignPersonaRoleModelReferenceSchema } from "./design-persona-role-model.js"
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
    message: "Portable User Journey candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalIdentifierListSchema = canonicalArray(identifierSchema)
const requiredCanonicalIdentifierListSchema = canonicalIdentifierListSchema
  .refine((values) => values.length > 0, "At least one identifier is required")
const canonicalTextListSchema = canonicalArray(shortTextSchema)
const requiredCanonicalTextListSchema = canonicalTextListSchema
  .refine((values) => values.length > 0, "At least one value is required")
const exactSourceListSchema = z.array(exactSourceReferenceSchema).min(1).max(256)
  .refine((entries) => unique(entries.map((entry) =>
    `${entry.sourceId}:${entry.sourceRevision}:${entry.recordDigest}:${entry.contentDigest}`)), "Source references must be unique")
  .superRefine((entries, context) => {
    const ordered = [...entries].sort((left, right) =>
      left.sourceId.localeCompare(right.sourceId) || left.sourceRevision - right.sourceRevision)
    if (entries.some((entry, index) => entry.sourceId !== ordered[index]?.sourceId ||
        entry.sourceRevision !== ordered[index]?.sourceRevision)) {
      context.addIssue({ code: "custom", message: "Source references must use canonical identity ordering" })
    }
  })

export const userJourneyPathKindValues = ["failure", "primary", "recovery", "success"] as const
export const userJourneyPathKindSchema = z.enum(userJourneyPathKindValues)

export const userJourneyTouchpointChannelValues = [
  "api", "documentation", "human-handoff", "ide", "notification", "offline", "other", "web",
] as const
export const userJourneyTouchpointChannelSchema = z.enum(userJourneyTouchpointChannelValues)

const journeyEvidenceStateSchema = z.enum([
  "disputed", "evidence-linked", "human-reviewed", "hypothesis",
])

const journeyTouchpointSchema = z.object({
  key: identifierSchema,
  label: z.string().trim().min(2).max(240),
  channel: userJourneyTouchpointChannelSchema,
  purpose: longTextSchema,
  personaKeys: requiredCanonicalIdentifierListSchema,
  participantCategories: requiredCanonicalIdentifierListSchema,
  designScopeKeys: requiredCanonicalIdentifierListSchema,
  accessibilityConsiderations: requiredCanonicalTextListSchema,
  inclusionConsiderations: requiredCanonicalTextListSchema,
  privacyAndDataUse: z.object({
    dataCategories: canonicalIdentifierListSchema,
    purpose: longTextSchema,
    minimization: longTextSchema,
    retention: shortTextSchema,
    prohibitedUses: requiredCanonicalTextListSchema,
  }).strict(),
  fallback: longTextSchema,
  sources: exactSourceListSchema,
  validationState: z.literal("not-established"),
}).strict()

const journeyStepSchema = z.object({
  key: identifierSchema,
  sequence: z.number().int().positive().max(4_096),
  touchpointKey: identifierSchema,
  personaKeys: requiredCanonicalIdentifierListSchema,
  objective: longTextSchema,
  participantAction: longTextSchema,
  expectedExperience: longTextSchema,
  expectedSystemResponse: longTextSchema,
  evidenceCues: requiredCanonicalTextListSchema,
  accessibilityChecks: requiredCanonicalTextListSchema,
  privacyChecks: requiredCanonicalTextListSchema,
  sources: exactSourceListSchema,
}).strict()

const journeyPathSchema = z.object({
  key: identifierSchema,
  kind: userJourneyPathKindSchema,
  title: z.string().trim().min(2).max(240),
  personaKeys: requiredCanonicalIdentifierListSchema,
  entryConditions: requiredCanonicalTextListSchema,
  steps: z.array(journeyStepSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Journey path step keys must be unique"),
  exitConditions: requiredCanonicalTextListSchema,
  relatedPathKeys: canonicalIdentifierListSchema,
  evidenceState: journeyEvidenceStateSchema,
  sources: exactSourceListSchema,
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
  validationState: z.literal("not-established"),
}).strict().superRefine((path, context) => {
  if (path.steps.some((step, index) => step.sequence !== index + 1)) {
    context.addIssue({ code: "custom", path: ["steps"], message: "Journey path steps must use contiguous one-based ordering" })
  }
  const reviewed = path.reviewedBy !== undefined || path.reviewedAt !== undefined
  if (path.evidenceState === "human-reviewed" && (!path.reviewedBy || !path.reviewedAt)) {
    context.addIssue({ code: "custom", message: "Human-reviewed journey paths require an attributable reviewer and time" })
  }
  if (path.evidenceState !== "human-reviewed" && reviewed) {
    context.addIssue({ code: "custom", message: "Only human-reviewed journey paths can carry review metadata" })
  }
})

const userJourneySchema = z.object({
  key: identifierSchema,
  title: z.string().trim().min(2).max(240),
  purpose: longTextSchema,
  designScopeKeys: requiredCanonicalIdentifierListSchema,
  personaKeys: requiredCanonicalIdentifierListSchema,
  designRoleKeys: requiredCanonicalIdentifierListSchema,
  participantCategories: requiredCanonicalIdentifierListSchema,
  jobStatements: requiredCanonicalTextListSchema,
  intendedOutcomeKeys: requiredCanonicalIdentifierListSchema,
  entryConditions: requiredCanonicalTextListSchema,
  touchpoints: z.array(journeyTouchpointSchema).min(1).max(1_024)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Journey touchpoint keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Journey touchpoints must use canonical key ordering"),
  paths: z.array(journeyPathSchema).min(userJourneyPathKindValues.length).max(1_024)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Journey path keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Journey paths must use canonical key ordering"),
  successCriteria: requiredCanonicalTextListSchema,
  failureIndicators: requiredCanonicalTextListSchema,
  accessibilityRequirements: requiredCanonicalTextListSchema,
  inclusionRequirements: requiredCanonicalTextListSchema,
  burdenAndAttentionLimits: requiredCanonicalTextListSchema,
  contestability: z.object({
    path: longTextSchema,
    ownerPersonaKey: identifierSchema,
    escalation: longTextSchema,
    sources: exactSourceListSchema,
  }).strict(),
  sources: exactSourceListSchema,
  validationState: z.literal("not-established"),
}).strict().superRefine((journey, context) => {
  const personaKeys = new Set(journey.personaKeys)
  const touchpointKeys = new Set(journey.touchpoints.map((entry) => entry.key))
  const pathKeys = new Set(journey.paths.map((entry) => entry.key))
  const kinds = new Set(journey.paths.map((entry) => entry.kind))
  if (userJourneyPathKindValues.some((kind) => !kinds.has(kind))) {
    context.addIssue({ code: "custom", path: ["paths"], message: "Every journey requires explicit primary, success, failure, and recovery paths" })
  }
  if (!personaKeys.has(journey.contestability.ownerPersonaKey)) {
    context.addIssue({ code: "custom", path: ["contestability", "ownerPersonaKey"], message: "Contestability owner must reference a journey persona" })
  }
  for (const [pathIndex, path] of journey.paths.entries()) {
    if (path.personaKeys.some((key) => !personaKeys.has(key)) ||
        path.relatedPathKeys.some((key) => !pathKeys.has(key) || key === path.key) ||
        path.steps.some((step) => !touchpointKeys.has(step.touchpointKey) ||
          step.personaKeys.some((key) => !personaKeys.has(key)))) {
      context.addIssue({ code: "custom", path: ["paths", pathIndex], message: "Journey paths must reference declared personas, touchpoints, and distinct paths" })
    }
    if (path.kind === "failure" && !path.relatedPathKeys.some((key) =>
      journey.paths.some((candidate) => candidate.key === key && candidate.kind === "recovery"))) {
      context.addIssue({ code: "custom", path: ["paths", pathIndex, "relatedPathKeys"], message: "Every failure path must link to an explicit recovery path" })
    }
    if (path.kind === "recovery" && !path.relatedPathKeys.some((key) =>
      journey.paths.some((candidate) => candidate.key === key && candidate.kind === "failure"))) {
      context.addIssue({ code: "custom", path: ["paths", pathIndex, "relatedPathKeys"], message: "Every recovery path must link to an explicit failure path" })
    }
  }
  for (const [index, touchpoint] of journey.touchpoints.entries()) {
    if (touchpoint.personaKeys.some((key) => !personaKeys.has(key)) ||
        touchpoint.designScopeKeys.some((key) => !journey.designScopeKeys.includes(key)) ||
        touchpoint.participantCategories.some((category) => !journey.participantCategories.includes(category))) {
      context.addIssue({ code: "custom", path: ["touchpoints", index], message: "Touchpoints must stay inside the journey persona, participant, and design-scope boundaries" })
    }
  }
})

const coverageApprovalSchema = z.object({
  state: z.enum(["approved", "not-required", "pending", "rejected"]),
  decidedBy: humanActorSchema.optional(),
  decidedAt: z.string().datetime().optional(),
  conditions: canonicalTextListSchema,
}).strict().superRefine((approval, context) => {
  const decided = approval.state === "approved" || approval.state === "rejected"
  if (decided !== (approval.decidedBy !== undefined && approval.decidedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Approved or rejected coverage requires an attributable human decision; other states forbid one" })
  }
})

const journeyScopeCoverageSchema = z.object({
  designScopeKey: identifierSchema,
  status: z.enum(["not-applicable", "represented", "unresolved"]),
  journeyKeys: canonicalIdentifierListSchema,
  rationale: longTextSchema,
  sources: exactSourceListSchema,
  approval: coverageApprovalSchema,
}).strict().superRefine((coverage, context) => {
  if ((coverage.status === "represented") !== (coverage.journeyKeys.length > 0)) {
    context.addIssue({ code: "custom", path: ["journeyKeys"], message: "Represented scope coverage must name at least one journey; other states forbid journey links" })
  }
  if (coverage.status === "represented" && coverage.approval.state !== "not-required") {
    context.addIssue({ code: "custom", path: ["approval", "state"], message: "Represented journey coverage does not require an exception approval" })
  }
  if (coverage.status === "unresolved" && coverage.approval.state !== "pending") {
    context.addIssue({ code: "custom", path: ["approval", "state"], message: "Unresolved journey coverage must retain a pending human decision" })
  }
  if (coverage.status === "not-applicable" && coverage.approval.state !== "approved") {
    context.addIssue({ code: "custom", path: ["approval", "state"], message: "Not-applicable journey coverage requires attributable human approval" })
  }
})

const exactDesignApplicabilityBindingSchema = exactDesignApplicabilityReferenceSchema.extend({
  membershipDigest: digestSchema,
}).strict()

const exactDesignPersonaRoleBindingSchema = exactDesignPersonaRoleModelReferenceSchema.extend({
  membershipDigest: digestSchema,
}).strict()

const userJourneyModelInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  designApplicability: exactDesignApplicabilityBindingSchema,
  designPersonaRoleModel: exactDesignPersonaRoleBindingSchema,
  journeys: z.array(userJourneySchema).max(256)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Journey keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Journeys must use canonical key ordering"),
  scopeCoverage: z.array(journeyScopeCoverageSchema).min(1).max(1_024)
    .refine((entries) => unique(entries.map((entry) => entry.designScopeKey)), "Journey scope coverage must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.designScopeKey)), "Journey scope coverage must use canonical scope ordering"),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: requiredCanonicalTextListSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  journeyValidationState: z.literal("not-established"),
  designApprovalState: z.literal("not-established"),
  implementationAuthorityState: z.literal("not-established"),
}).strict().superRefine((model, context) => {
  const journeyKeys = new Set(model.journeys.map((entry) => entry.key))
  for (const [index, coverage] of model.scopeCoverage.entries()) {
    if (coverage.journeyKeys.some((key) => !journeyKeys.has(key)) ||
        coverage.journeyKeys.some((key) => !model.journeys.find((journey) => journey.key === key)?.designScopeKeys.includes(coverage.designScopeKey))) {
      context.addIssue({ code: "custom", path: ["scopeCoverage", index, "journeyKeys"], message: "Journey scope coverage must reference journeys that declare the same design scope" })
    }
  }
  const weakEvidence = model.journeys.some((journey) => journey.paths.some((path) =>
    path.evidenceState === "hypothesis" || path.evidenceState === "disputed"))
  const unresolvedCoverage = model.scopeCoverage.some((coverage) =>
    coverage.status === "unresolved" || coverage.approval.state === "pending" || coverage.approval.state === "rejected")
  if (model.reviewState === "ready-for-human-review" &&
      (weakEvidence || unresolvedCoverage || model.unresolvedQuestions.length > 0)) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "User Journey guidance cannot be ready for human review while evidence, coverage, or questions remain unresolved" })
  }
})

export const userJourneyModelInputSchema = rejectSecrets(userJourneyModelInputBaseSchema)

export const userJourneyModelSchema = userJourneyModelInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("user-journey-model-candidate"),
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
    "user-journey-model-is-candidate-guidance-and-does-not-prove-observed-behavior-validate-a-journey-approve-design-grant-readiness-or-authorize-action",
  ),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only User Journey revisions after revision one require an exact predecessor digest" })
  }
})

export const exactUserJourneyModelReferenceSchema = z.object({
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

export const userJourneyModelStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("user-journey-model-status"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  candidate: exactUserJourneyModelReferenceSchema.optional(),
  journeyCount: z.number().int().nonnegative().max(256),
  touchpointCount: z.number().int().nonnegative().max(262_144),
  primaryPathCount: z.number().int().nonnegative().max(262_144),
  successPathCount: z.number().int().nonnegative().max(262_144),
  failurePathCount: z.number().int().nonnegative().max(262_144),
  recoveryPathCount: z.number().int().nonnegative().max(262_144),
  representedScopeCount: z.number().int().nonnegative().max(1_024),
  unresolvedScopeCount: z.number().int().nonnegative().max(1_024),
  weakEvidencePathCount: z.number().int().nonnegative().max(262_144),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "user-journey-model-status-is-observational-and-does-not-prove-observed-behavior-validate-journeys-approve-design-grant-readiness-or-authorize-action",
  ),
}).strict().superRefine((status, context) => {
  const gaps = status.unresolvedScopeCount + status.weakEvidencePathCount + status.staleBindingCount +
    status.staleSourceReferenceCount + status.unresolvedQuestionCount
  if (status.state === "complete-for-review" &&
      (gaps > 0 || status.reviewState !== "ready-for-human-review" || status.reasons.length > 0 || !status.candidate)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires an exact review-ready User Journey candidate with no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required User Journey status must expose reasons" })
  }
})

export const userJourneyModelProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("user-journey-model-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: userJourneyModelStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    membershipDigest: digestSchema, state: z.literal("candidate"),
    journeyCount: z.number().int().nonnegative(), touchpointCount: z.number().int().nonnegative(),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-record-identities-counts-statuses-and-digests-only-not-journey-step-touchpoint-persona-source-or-personal-content-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "user-journey-model-projection-is-read-only-and-does-not-prove-observed-behavior-validate-journeys-approve-design-grant-readiness-or-authorize-write-or-action",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "User Journey projection must bind the exact Product and Initiative revisions" })
  }
})

export type UserJourneyPathKind = z.infer<typeof userJourneyPathKindSchema>
export type UserJourneyTouchpointChannel = z.infer<typeof userJourneyTouchpointChannelSchema>
export type UserJourneyModelInput = z.infer<typeof userJourneyModelInputSchema>
export type UserJourneyModel = z.infer<typeof userJourneyModelSchema>
export type ExactUserJourneyModelReference = z.infer<typeof exactUserJourneyModelReferenceSchema>
export type UserJourneyModelStatus = z.infer<typeof userJourneyModelStatusSchema>
export type UserJourneyModelProjection = z.infer<typeof userJourneyModelProjectionSchema>
