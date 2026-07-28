import { z } from "zod"

import { exactAccessibilityDesignRulesReferenceSchema } from "./accessibility-design-rules.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactDesignRequirementsReferenceSchema } from "./design-requirements.js"
import { exactDesignSystemTokenContractReferenceSchema } from "./design-system-token-contract.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactScreenStateInventoryReferenceSchema } from "./screen-state-inventory.js"
import { exactSourceReferenceSchema } from "./source-governance.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const requirementKeySchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const longTextSchema = z.string().trim().min(10).max(20_000)
const actorSchema = z.object({ kind: z.enum(["human", "role"]), id: shortTextSchema }).strict()
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function canonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}

function canonicalStringArray<T extends z.ZodType<string>>(schema: T, maximum = 512) {
  return z.array(schema).max(maximum)
    .refine((values) => unique(values), "Values must be unique")
    .refine((values) => canonical(values), "Values must use canonical lexical ordering")
}

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Responsive and Multi-Platform Targets candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalIdentifierListSchema = canonicalStringArray(identifierSchema, 16_384)
const canonicalRequirementKeyListSchema = canonicalStringArray(requirementKeySchema, 4_096)
const canonicalDigestListSchema = canonicalStringArray(digestSchema, 1_024)
const canonicalTextListSchema = canonicalStringArray(shortTextSchema)
const requiredCanonicalTextListSchema = canonicalTextListSchema
  .refine((values) => values.length > 0, "At least one value is required")
const exactSourceListSchema = z.array(exactSourceReferenceSchema).min(1).max(256)
  .refine((entries) => unique(entries.map((entry) =>
    `${entry.sourceId}:${entry.sourceRevision}:${entry.recordDigest}:${entry.contentDigest}`)),
  "Source references must be unique")
  .refine((entries) => canonical(entries.map((entry) =>
    `${entry.sourceId}:${String(entry.sourceRevision).padStart(12, "0")}`)),
  "Source references must use canonical identity ordering")

const exactScreenStateInventoryBindingSchema = exactScreenStateInventoryReferenceSchema
  .extend({ membershipDigest: digestSchema }).strict()
const exactDesignRequirementsBindingSchema = exactDesignRequirementsReferenceSchema
  .extend({ membershipDigest: digestSchema }).strict()
const exactDesignSystemTokenContractBindingSchema = exactDesignSystemTokenContractReferenceSchema
  .extend({ membershipDigest: digestSchema }).strict()
const exactAccessibilityDesignRulesBindingSchema = exactAccessibilityDesignRulesReferenceSchema
  .extend({ membershipDigest: digestSchema }).strict()

const candidateOwnershipSchema = z.object({
  state: z.enum(["assigned-candidate", "unresolved"]),
  owner: actorSchema.optional(),
}).strict().superRefine((ownership, context) => {
  if ((ownership.state === "assigned-candidate") !== (ownership.owner !== undefined)) {
    context.addIssue({ code: "custom", message: "Candidate ownership requires an explicit actor; unresolved ownership forbids one" })
  }
})

const attributableHumanDecisionSchema = z.object({
  decidedBy: humanActorSchema,
  decidedAt: z.string().datetime(),
  rationale: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

const formFactorSchema = z.enum([
  "desktop", "tablet", "phone", "watch", "tv", "spatial", "embedded", "unclassified",
])
const deliverySurfaceSchema = z.enum([
  "responsive-web", "native-mobile", "native-desktop", "hybrid", "embedded", "other",
])
const inputModeSchema = z.enum([
  "keyboard", "pointer", "touch", "stylus", "voice", "switch", "gamepad", "remote", "other",
])
const orientationSchema = z.enum(["portrait", "landscape", "square", "not-applicable"])

export const responsivePlatformTargetSchema = z.object({
  key: identifierSchema,
  platformKey: identifierSchema,
  formFactors: canonicalStringArray(formFactorSchema, 16).min(1),
  deliverySurfaces: canonicalStringArray(deliverySurfaceSchema, 16).min(1),
  inputModes: canonicalStringArray(inputModeSchema, 32).min(1),
  orientations: canonicalStringArray(orientationSchema, 8).min(1),
  contextClassKeys: canonicalIdentifierListSchema,
  screenKeys: canonicalIdentifierListSchema,
  requirementKeys: canonicalRequirementKeyListSchema,
  ownership: candidateOwnershipSchema,
  sources: exactSourceListSchema,
  limitations: canonicalTextListSchema,
}).strict()

export const responsiveBreakpointSchema = z.object({
  key: identifierSchema,
  platformKey: identifierSchema,
  contextClassKey: identifierSchema,
  basis: z.enum(["viewport", "container", "content", "device-capability", "platform-convention"]),
  minimumInlineSizePx: z.number().int().nonnegative().max(1_000_000).optional(),
  maximumInlineSizePxExclusive: z.number().int().positive().max(1_000_001).optional(),
  rationale: longTextSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((breakpoint, context) => {
  if (breakpoint.minimumInlineSizePx === undefined && breakpoint.maximumInlineSizePxExclusive === undefined) {
    context.addIssue({ code: "custom", message: "Responsive breakpoints require at least one bounded inline-size edge" })
  }
  if (breakpoint.minimumInlineSizePx !== undefined && breakpoint.maximumInlineSizePxExclusive !== undefined &&
      breakpoint.minimumInlineSizePx >= breakpoint.maximumInlineSizePxExclusive) {
    context.addIssue({ code: "custom", message: "Responsive breakpoint minimum must be below its exclusive maximum" })
  }
})

export const responsivePlatformBehaviorSchema = z.object({
  key: identifierSchema,
  title: z.string().trim().min(2).max(240),
  kind: z.enum([
    "layout", "navigation", "content-priority", "density", "input", "interaction", "component-variant",
    "state-continuity", "overflow", "offline-recovery", "other",
  ]),
  applicability: z.enum(["applicable", "not-applicable", "unresolved"]),
  platformKeys: canonicalIdentifierListSchema,
  breakpointKeys: canonicalIdentifierListSchema,
  screenKeys: canonicalIdentifierListSchema,
  stateKeys: canonicalIdentifierListSchema,
  requirementKeys: canonicalRequirementKeyListSchema,
  accessibilityRuleKeys: canonicalIdentifierListSchema,
  adaptationRules: requiredCanonicalTextListSchema,
  preservationRules: requiredCanonicalTextListSchema,
  ownership: candidateOwnershipSchema,
  notApplicableDecision: attributableHumanDecisionSchema.optional(),
  rationale: longTextSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((behavior, context) => {
  if ((behavior.applicability === "not-applicable") !== (behavior.notApplicableDecision !== undefined)) {
    context.addIssue({ code: "custom", path: ["notApplicableDecision"], message: "Not-applicable platform behaviors require an attributable human decision; other states forbid one" })
  }
  if (behavior.applicability === "applicable" &&
      (behavior.platformKeys.length === 0 || behavior.screenKeys.length === 0 || behavior.accessibilityRuleKeys.length === 0)) {
    context.addIssue({ code: "custom", message: "Applicable platform behaviors require governed platforms and screens" })
  }
})

export const responsivePlatformCheckSchema = z.object({
  key: identifierSchema,
  behaviorKey: identifierSchema,
  platformKey: identifierSchema,
  breakpointKey: identifierSchema.optional(),
  screenKey: identifierSchema,
  stateKey: identifierSchema.optional(),
  method: z.enum(["manual", "automated", "hybrid"]),
  evidenceState: z.enum(["not-assessed", "evidence-recorded", "human-reviewed"]),
  observation: z.enum(["not-assessed", "evidence-supports", "evidence-contradicts"]),
  evidenceDigests: canonicalDigestListSchema,
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
  procedure: longTextSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((check, context) => {
  const reviewed = check.evidenceState === "human-reviewed"
  if (reviewed !== (check.reviewedBy !== undefined && check.reviewedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Human-reviewed platform checks require an attributable reviewer and time; other states forbid them" })
  }
  if ((check.evidenceState === "not-assessed") !== (check.observation === "not-assessed")) {
    context.addIssue({ code: "custom", path: ["observation"], message: "Only assessed platform checks may record a supporting or contradicting observation" })
  }
  if ((check.evidenceState === "not-assessed") !== (check.evidenceDigests.length === 0)) {
    context.addIssue({ code: "custom", path: ["evidenceDigests"], message: "Assessed platform checks require evidence digests; not-assessed checks forbid them" })
  }
})

const responsiveRequirementCoverageSchema = z.object({
  requirementKey: requirementKeySchema,
  state: z.enum(["represented", "not-applicable", "unresolved"]),
  behaviorKeys: canonicalIdentifierListSchema,
  notApplicableDecision: attributableHumanDecisionSchema.optional(),
  rationale: longTextSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((coverage, context) => {
  if ((coverage.state === "represented") !== (coverage.behaviorKeys.length > 0)) {
    context.addIssue({ code: "custom", path: ["behaviorKeys"], message: "Represented requirements require platform behaviors; other states forbid them" })
  }
  if ((coverage.state === "not-applicable") !== (coverage.notApplicableDecision !== undefined)) {
    context.addIssue({ code: "custom", path: ["notApplicableDecision"], message: "Not-applicable requirement coverage requires an attributable human decision; other states forbid one" })
  }
})

const responsiveMultiPlatformTargetsInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  screenStateInventory: exactScreenStateInventoryBindingSchema,
  designRequirements: exactDesignRequirementsBindingSchema,
  designSystemTokenContract: exactDesignSystemTokenContractBindingSchema,
  accessibilityDesignRules: exactAccessibilityDesignRulesBindingSchema,
  platformTargets: z.array(responsivePlatformTargetSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Responsive platform target keys must be unique")
    .refine((entries) => unique(entries.map((entry) => entry.platformKey)), "Each governed platform may have only one responsive target")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Responsive platform targets must use canonical key ordering"),
  breakpoints: z.array(responsiveBreakpointSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Responsive breakpoint keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Responsive breakpoints must use canonical key ordering"),
  behaviors: z.array(responsivePlatformBehaviorSchema).min(1).max(8_192)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Responsive platform behavior keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Responsive platform behaviors must use canonical key ordering"),
  checks: z.array(responsivePlatformCheckSchema).max(16_384)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Responsive platform check keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Responsive platform checks must use canonical key ordering"),
  requirementCoverage: z.array(responsiveRequirementCoverageSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.requirementKey)), "Responsive requirement coverage keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.requirementKey)), "Responsive requirement coverage must use canonical key ordering"),
  targetCatalogState: z.enum(["candidate-complete", "not-assessed"]),
  breakpointCatalogState: z.enum(["candidate-complete", "not-assessed"]),
  behaviorCatalogState: z.enum(["candidate-complete", "not-assessed"]),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: requiredCanonicalTextListSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  responsiveCompletenessState: z.literal("not-established"),
  platformParityState: z.literal("not-established"),
  breakpointValidityState: z.literal("not-established"),
  behaviorValidityState: z.literal("not-established"),
  accessibilityConformanceState: z.literal("not-established"),
  designApprovalState: z.literal("not-established"),
  designBaselineState: z.literal("not-established"),
  readinessState: z.literal("not-established"),
  implementationAuthorityState: z.literal("not-established"),
}).strict().superRefine((candidate, context) => {
  const platformKeys = new Set(candidate.platformTargets.map((entry) => entry.platformKey))
  const breakpointByKey = new Map(candidate.breakpoints.map((entry) => [entry.key, entry]))
  const behaviorByKey = new Map(candidate.behaviors.map((entry) => [entry.key, entry]))
  for (const [index, breakpoint] of candidate.breakpoints.entries()) {
    if (!platformKeys.has(breakpoint.platformKey)) {
      context.addIssue({ code: "custom", path: ["breakpoints", index], message: "Responsive breakpoints must reference exact governed platform targets" })
    }
  }
  for (const [index, behavior] of candidate.behaviors.entries()) {
    if (behavior.platformKeys.some((key) => !platformKeys.has(key)) ||
        behavior.breakpointKeys.some((key) => !breakpointByKey.has(key))) {
      context.addIssue({ code: "custom", path: ["behaviors", index], message: "Responsive behaviors must reconcile exact governed platforms and breakpoints" })
    }
    if (behavior.breakpointKeys.some((key) => {
      const breakpoint = breakpointByKey.get(key)
      return breakpoint !== undefined && !behavior.platformKeys.includes(breakpoint.platformKey)
    })) {
      context.addIssue({ code: "custom", path: ["behaviors", index, "breakpointKeys"], message: "Responsive behavior breakpoints must belong to the same governed platforms" })
    }
  }
  for (const [index, check] of candidate.checks.entries()) {
    const behavior = behaviorByKey.get(check.behaviorKey)
    const breakpoint = check.breakpointKey ? breakpointByKey.get(check.breakpointKey) : undefined
    if (!behavior || !behavior.platformKeys.includes(check.platformKey) || !behavior.screenKeys.includes(check.screenKey) ||
        (check.stateKey !== undefined && !behavior.stateKeys.includes(check.stateKey)) ||
        (check.breakpointKey !== undefined && (!behavior.breakpointKeys.includes(check.breakpointKey) || breakpoint?.platformKey !== check.platformKey))) {
      context.addIssue({ code: "custom", path: ["checks", index], message: "Responsive platform checks must reconcile to one exact behavior and its governed scope" })
    }
  }
  for (const [index, coverage] of candidate.requirementCoverage.entries()) {
    if (coverage.behaviorKeys.some((key) => !behaviorByKey.has(key))) {
      context.addIssue({ code: "custom", path: ["requirementCoverage", index], message: "Responsive requirement coverage must reference exact platform behaviors" })
    }
  }
  const unresolved = candidate.platformTargets.some((entry) => entry.ownership.state === "unresolved") ||
    candidate.behaviors.some((entry) => entry.applicability === "unresolved" || entry.ownership.state === "unresolved") ||
    candidate.checks.some((entry) => entry.evidenceState !== "human-reviewed" || entry.observation === "evidence-contradicts") ||
    candidate.requirementCoverage.some((entry) => entry.state === "unresolved")
  if (candidate.reviewState === "ready-for-human-review" &&
      (candidate.targetCatalogState !== "candidate-complete" || candidate.breakpointCatalogState !== "candidate-complete" ||
       candidate.behaviorCatalogState !== "candidate-complete" || unresolved || candidate.unresolvedQuestions.length > 0)) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Responsive and Multi-Platform Targets cannot be review-ready while catalogs, evidence, coverage, ownership, or questions remain unresolved" })
  }
})

export const responsiveMultiPlatformTargetsInputSchema = rejectSecrets(responsiveMultiPlatformTargetsInputBaseSchema)

export const responsiveMultiPlatformTargetsSchema = responsiveMultiPlatformTargetsInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("responsive-multi-platform-targets-candidate"),
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
    "responsive-multi-platform-targets-are-candidate-metadata-and-do-not-establish-responsive-completeness-platform-parity-breakpoint-or-behavior-validity-accessibility-conformance-ownership-design-approval-baseline-readiness-implementation-or-action-authority",
  ),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Responsive and Multi-Platform Targets revisions after revision one require an exact predecessor digest" })
  }
})

export const exactResponsiveMultiPlatformTargetsReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const responsiveMultiPlatformTargetsStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("responsive-multi-platform-targets-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactResponsiveMultiPlatformTargetsReferenceSchema.optional(),
  platformTargetCount: z.number().int().nonnegative().max(4_096),
  breakpointCount: z.number().int().nonnegative().max(4_096),
  behaviorCount: z.number().int().nonnegative().max(8_192),
  checkCount: z.number().int().nonnegative().max(16_384),
  applicableBehaviorCount: z.number().int().nonnegative().max(8_192),
  unresolvedBehaviorCount: z.number().int().nonnegative().max(8_192),
  notAssessedCheckCount: z.number().int().nonnegative().max(16_384),
  evidenceRecordedCheckCount: z.number().int().nonnegative().max(16_384),
  humanReviewedCheckCount: z.number().int().nonnegative().max(16_384),
  contradictedCheckCount: z.number().int().nonnegative().max(16_384),
  representedRequirementCount: z.number().int().nonnegative().max(4_096),
  unresolvedRequirementCount: z.number().int().nonnegative().max(4_096),
  unresolvedOwnershipCount: z.number().int().nonnegative().max(12_288),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  targetCatalogState: z.enum(["candidate-complete", "not-assessed"]),
  breakpointCatalogState: z.enum(["candidate-complete", "not-assessed"]),
  behaviorCatalogState: z.enum(["candidate-complete", "not-assessed"]),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "responsive-multi-platform-targets-status-is-observational-and-does-not-establish-responsive-completeness-platform-parity-breakpoint-or-behavior-validity-accessibility-conformance-ownership-design-approval-baseline-readiness-implementation-or-action-authority",
  ),
}).strict().superRefine((status, context) => {
  const gaps = status.unresolvedBehaviorCount + status.notAssessedCheckCount + status.evidenceRecordedCheckCount +
    status.contradictedCheckCount + status.unresolvedRequirementCount + status.unresolvedOwnershipCount +
    status.staleBindingCount + status.staleSourceReferenceCount + status.unresolvedQuestionCount
  if (status.state === "complete-for-review" &&
      (gaps > 0 || status.targetCatalogState !== "candidate-complete" || status.breakpointCatalogState !== "candidate-complete" ||
       status.behaviorCatalogState !== "candidate-complete" || status.reviewState !== "ready-for-human-review" ||
       status.reasons.length > 0 || !status.candidate)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires exact review-ready Responsive and Multi-Platform Targets with no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Responsive and Multi-Platform Targets status must expose reasons" })
  }
})

export const responsiveMultiPlatformTargetsProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("responsive-multi-platform-targets-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: responsiveMultiPlatformTargetsStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, membershipDigest: digestSchema,
    state: z.literal("candidate"), platformTargetCount: z.number().int().nonnegative(),
    breakpointCount: z.number().int().nonnegative(), behaviorCount: z.number().int().nonnegative(),
    checkCount: z.number().int().nonnegative(), representedRequirementCount: z.number().int().nonnegative(),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-record-identities-counts-statuses-and-digests-only-not-breakpoint-rules-behavior-procedures-evidence-requirement-source-design-or-personal-content-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "responsive-multi-platform-targets-projection-is-read-only-and-does-not-establish-responsive-completeness-platform-parity-breakpoint-or-behavior-validity-accessibility-conformance-ownership-design-approval-baseline-readiness-implementation-write-or-action-authority",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Responsive and Multi-Platform Targets projection must bind exact Product and Initiative revisions" })
  }
})

export type ResponsiveMultiPlatformTargetsInput = z.infer<typeof responsiveMultiPlatformTargetsInputSchema>
export type ResponsiveMultiPlatformTargets = z.infer<typeof responsiveMultiPlatformTargetsSchema>
export type ExactResponsiveMultiPlatformTargetsReference = z.infer<typeof exactResponsiveMultiPlatformTargetsReferenceSchema>
export type ResponsiveMultiPlatformTargetsStatus = z.infer<typeof responsiveMultiPlatformTargetsStatusSchema>
export type ResponsiveMultiPlatformTargetsProjection = z.infer<typeof responsiveMultiPlatformTargetsProjectionSchema>
