import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { initiativeApplicabilityStatusSchema } from "./product.js"
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
    message: "Portable Design Applicability candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalTextListSchema = canonicalArray(shortTextSchema)
const exactSourceListSchema = z.array(exactSourceReferenceSchema).min(1).max(256)
  .refine((entries) => unique(entries.map((entry) =>
    `${entry.sourceId}:${entry.sourceRevision}:${entry.recordDigest}:${entry.contentDigest}`)), "Source references must be unique")

export const designApplicabilityAspectDefinitions = [
  { key: "design-work", label: "Design work" },
  { key: "figma", label: "Figma" },
  { key: "user-experience", label: "User experience" },
  { key: "user-interface", label: "User interface" },
] as const

export const designApplicabilityAspectSchema = z.enum([
  "design-work",
  "figma",
  "user-experience",
  "user-interface",
])

export const designDepthSchema = z.enum(["none", "minimal", "standard", "comprehensive", "unresolved"])

export const designSourceModeSchema = z.enum([
  "figma-design",
  "figma-make",
  "manual-handoff",
  "other-approved",
  "repository-native",
])

const applicabilityApprovalSchema = z.object({
  state: z.enum(["not-required", "pending", "approved", "rejected"]),
  decidedBy: humanActorSchema.optional(),
  decidedAt: z.string().datetime().optional(),
  conditions: canonicalTextListSchema,
}).strict().superRefine((approval, context) => {
  const decided = approval.state === "approved" || approval.state === "rejected"
  if (decided !== (approval.decidedBy !== undefined && approval.decidedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Approved or rejected design applicability requires an attributable human decision; other states forbid one" })
  }
})

const exactRelatedDesignArtifactSchema = z.object({
  recordKind: identifierSchema,
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

export const designApplicabilityDecisionSchema = z.object({
  aspect: designApplicabilityAspectSchema,
  status: initiativeApplicabilityStatusSchema,
  rationale: longTextSchema,
  sources: exactSourceListSchema,
  owner: shortTextSchema,
  accountableApprover: shortTextSchema,
  conditions: canonicalTextListSchema,
  reviewTriggers: canonicalArray(shortTextSchema).refine((values) => values.length > 0, "At least one review trigger is required"),
  approval: applicabilityApprovalSchema,
  relatedDesignArtifacts: z.array(exactRelatedDesignArtifactSchema).max(256)
    .refine((entries) => unique(entries.map((entry) => `${entry.recordKind}:${entry.recordId}:${entry.revision}`)), "Related design artifacts must be unique"),
  authorityBoundary: z.literal(
    "design-applicability-decision-is-candidate-guidance-and-does-not-approve-design-establish-a-baseline-or-authorize-action",
  ),
}).strict().superRefine((decision, context) => {
  if (["deferred", "conditionally-required", "blocked"].includes(decision.status) && decision.conditions.length === 0) {
    context.addIssue({ code: "custom", path: ["conditions"], message: "Deferred, conditional, and blocked design applicability requires an explicit condition" })
  }
  if (["already-satisfied", "reused"].includes(decision.status) && decision.relatedDesignArtifacts.length === 0) {
    context.addIssue({ code: "custom", path: ["relatedDesignArtifacts"], message: "Satisfied or reused design applicability requires an exact related artifact" })
  }
  if (decision.status === "awaiting-human-decision" && decision.approval.state !== "pending") {
    context.addIssue({ code: "custom", path: ["approval", "state"], message: "Awaiting-human design applicability must retain a pending approval state" })
  }
  if (decision.status === "not-applicable" && decision.approval.state !== "approved") {
    context.addIssue({ code: "custom", path: ["approval", "state"], message: "A material not-applicable design decision requires attributable human approval" })
  }
})

const designSourceStrategySchema = z.object({
  state: z.enum(["selected", "not-applicable", "unresolved"]),
  modes: canonicalArray(designSourceModeSchema, 5),
  otherMethod: shortTextSchema.optional(),
  rationale: longTextSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((strategy, context) => {
  if ((strategy.state === "selected") !== (strategy.modes.length > 0)) {
    context.addIssue({ code: "custom", path: ["modes"], message: "A selected design source requires one or more modes; other states must not invent a mode" })
  }
  if (strategy.modes.includes("other-approved") !== (strategy.otherMethod !== undefined)) {
    context.addIssue({ code: "custom", path: ["otherMethod"], message: "Other-approved source mode requires an exact method name and other modes forbid one" })
  }
})

const designApplicabilityScopeSchema = z.object({
  scope: z.object({
    kind: z.enum(["initiative", "client-application", "design-artifact"]),
    id: identifierSchema,
    label: shortTextSchema,
  }).strict(),
  affectedJourneys: canonicalTextListSchema,
  approvedDesignSystems: canonicalTextListSchema,
  requiredDepth: designDepthSchema,
  designSource: designSourceStrategySchema,
  decisions: z.array(designApplicabilityDecisionSchema).length(designApplicabilityAspectDefinitions.length),
  limitations: canonicalTextListSchema,
}).strict().superRefine((scope, context) => {
  if (scope.decisions.some((decision, index) => decision.aspect !== designApplicabilityAspectDefinitions[index]?.key)) {
    context.addIssue({ code: "custom", path: ["decisions"], message: "Design applicability decisions must contain the complete canonical ordered aspect catalog" })
  }
  const decisions = new Map(scope.decisions.map((decision) => [decision.aspect, decision]))
  const designWork = decisions.get("design-work")
  const figma = decisions.get("figma")
  const ux = decisions.get("user-experience")
  const ui = decisions.get("user-interface")
  const material = new Set(["required", "recommended", "optional", "conditionally-required", "already-satisfied", "reused"])
  if (designWork?.status === "not-applicable" && scope.requiredDepth !== "none") {
    context.addIssue({ code: "custom", path: ["requiredDepth"], message: "Not-applicable design work requires an explicit none depth" })
  }
  if (designWork?.status === "not-applicable" && scope.designSource.state !== "not-applicable") {
    context.addIssue({ code: "custom", path: ["designSource", "state"], message: "Not-applicable design work requires an explicit not-applicable source strategy" })
  }
  if (designWork?.status === "awaiting-human-decision" &&
      (scope.requiredDepth !== "unresolved" || scope.designSource.state !== "unresolved")) {
    context.addIssue({ code: "custom", path: ["requiredDepth"], message: "Unresolved design work must preserve unresolved depth and source strategy" })
  }
  if (designWork && material.has(designWork.status) &&
      (scope.requiredDepth === "none" || scope.requiredDepth === "unresolved" || scope.designSource.state !== "selected")) {
    context.addIssue({ code: "custom", path: ["requiredDepth"], message: "Applicable design work requires a resolved non-none depth and selected source strategy" })
  }
  if ((ux && material.has(ux.status) || ui && material.has(ui.status)) && designWork?.status === "not-applicable") {
    context.addIssue({ code: "custom", path: ["decisions"], message: "Applicable UX or UI cannot coexist with not-applicable design work" })
  }
  const hasFigmaMode = scope.designSource.modes.some((mode) => mode === "figma-design" || mode === "figma-make")
  if (figma?.status === "not-applicable" && hasFigmaMode) {
    context.addIssue({ code: "custom", path: ["designSource", "modes"], message: "A not-applicable Figma decision forbids Figma source modes" })
  }
  if (figma && ["required", "already-satisfied", "reused"].includes(figma.status) && !hasFigmaMode) {
    context.addIssue({ code: "custom", path: ["designSource", "modes"], message: "Required, satisfied, or reused Figma applicability requires an explicit Figma source mode" })
  }
})

const exactGeneralApplicabilityDecisionSchema = z.object({
  subject: z.object({
    type: z.enum(["activity", "capability"]),
    key: z.enum(["experience-design", "design-reference-integration"]),
  }).strict(),
  decisionId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
  status: initiativeApplicabilityStatusSchema,
}).strict()

const designApplicabilityInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  classificationBinding: z.object({
    digest: digestSchema,
    completenessPolicyVersion: z.literal("gaep-initiative-classification-completeness-v1"),
    completenessPolicyDigest: digestSchema,
  }).strict(),
  applicabilityBinding: z.object({
    matrixRevision: z.number().int().positive(),
    matrixDigest: digestSchema,
    catalogVersion: z.literal("gaep-initiative-applicability-subjects-v1"),
    catalogDigest: digestSchema,
    experienceDesign: exactGeneralApplicabilityDecisionSchema,
    designReferenceIntegration: exactGeneralApplicabilityDecisionSchema,
  }).strict().superRefine((binding, context) => {
    if (binding.experienceDesign.subject.type !== "activity" || binding.experienceDesign.subject.key !== "experience-design") {
      context.addIssue({ code: "custom", path: ["experienceDesign", "subject"], message: "Experience-design binding must target the canonical activity decision" })
    }
    if (binding.designReferenceIntegration.subject.type !== "capability" ||
        binding.designReferenceIntegration.subject.key !== "design-reference-integration") {
      context.addIssue({ code: "custom", path: ["designReferenceIntegration", "subject"], message: "Design-reference binding must target the canonical capability decision" })
    }
  }),
  scopes: z.array(designApplicabilityScopeSchema).min(1).max(256)
    .refine((entries) => unique(entries.map((entry) => `${entry.scope.kind}:${entry.scope.id}`)), "Design applicability scopes must be unique")
    .refine((entries) => canonical(entries.map((entry) => `${entry.scope.kind}:${entry.scope.id}`)), "Design applicability scopes must use canonical ordering"),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalArray(shortTextSchema).refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  designApprovalState: z.literal("not-established"),
  designBaselineState: z.literal("not-established"),
  implementationAuthorityState: z.literal("not-established"),
}).strict().superRefine((candidate, context) => {
  const unresolved = candidate.scopes.some((scope) =>
    scope.requiredDepth === "unresolved" || scope.designSource.state === "unresolved" ||
    scope.decisions.some((decision) => decision.status === "awaiting-human-decision" ||
      decision.approval.state === "pending" || decision.approval.state === "rejected"))
  if (candidate.reviewState === "ready-for-human-review" && (unresolved || candidate.unresolvedQuestions.length > 0)) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Design applicability cannot be ready for human review while declared decisions, approvals, depth, sources, or questions remain unresolved" })
  }
})

export const designApplicabilityInputSchema = rejectSecrets(designApplicabilityInputBaseSchema)

export const designApplicabilitySchema = designApplicabilityInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("design-applicability-candidate"),
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
    "design-applicability-is-candidate-guidance-and-does-not-approve-design-establish-a-baseline-grant-readiness-or-authorize-implementation-or-action",
  ),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Design Applicability revisions after revision one require an exact predecessor digest" })
  }
})

export const exactDesignApplicabilityReferenceSchema = z.object({
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

export const designApplicabilityStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("design-applicability-status"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  candidate: exactDesignApplicabilityReferenceSchema.optional(),
  scopeCount: z.number().int().nonnegative().max(256),
  decisionCount: z.number().int().nonnegative().max(1_024),
  unresolvedDecisionCount: z.number().int().nonnegative().max(1_024),
  blockedDecisionCount: z.number().int().nonnegative().max(1_024),
  pendingApprovalCount: z.number().int().nonnegative().max(1_024),
  rejectedApprovalCount: z.number().int().nonnegative().max(1_024),
  unresolvedDepthCount: z.number().int().nonnegative().max(256),
  unresolvedSourceCount: z.number().int().nonnegative().max(256),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "design-applicability-status-is-observational-and-does-not-approve-design-establish-a-baseline-grant-readiness-or-authorize-implementation-or-action",
  ),
}).strict().superRefine((status, context) => {
  if (status.decisionCount !== status.scopeCount * designApplicabilityAspectDefinitions.length) {
    context.addIssue({ code: "custom", path: ["decisionCount"], message: "Design applicability decision count must reconcile to the complete per-scope aspect catalog" })
  }
  const gaps = status.unresolvedDecisionCount + status.blockedDecisionCount + status.pendingApprovalCount +
    status.rejectedApprovalCount + status.unresolvedDepthCount + status.unresolvedSourceCount +
    status.staleBindingCount + status.staleSourceReferenceCount + status.unresolvedQuestionCount
  if (status.state === "complete-for-review" &&
      (gaps > 0 || status.reviewState !== "ready-for-human-review" || status.reasons.length > 0 || !status.candidate)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires an exact review-ready candidate with no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Design Applicability must expose reasons" })
  }
})

export const designApplicabilityProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("design-applicability-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: designApplicabilityStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    membershipDigest: digestSchema, state: z.literal("candidate"), scopeCount: z.number().int().positive(),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-identities-counts-statuses-and-digests-only-not-rationales-source-content-journeys-design-content-personal-data-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "design-applicability-projection-is-read-only-and-does-not-approve-design-establish-a-baseline-grant-readiness-or-authorize-write-implementation-or-action",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Design Applicability projection must bind the exact Product and Initiative revisions" })
  }
})

export type DesignApplicabilityAspect = z.infer<typeof designApplicabilityAspectSchema>
export type DesignDepth = z.infer<typeof designDepthSchema>
export type DesignSourceMode = z.infer<typeof designSourceModeSchema>
export type DesignApplicabilityDecision = z.infer<typeof designApplicabilityDecisionSchema>
export type DesignApplicabilityInput = z.infer<typeof designApplicabilityInputSchema>
export type DesignApplicability = z.infer<typeof designApplicabilitySchema>
export type ExactDesignApplicabilityReference = z.infer<typeof exactDesignApplicabilityReferenceSchema>
export type DesignApplicabilityStatus = z.infer<typeof designApplicabilityStatusSchema>
export type DesignApplicabilityProjection = z.infer<typeof designApplicabilityProjectionSchema>
