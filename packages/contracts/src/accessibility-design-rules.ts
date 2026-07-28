import { z } from "zod"

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

function canonicalArray<T extends z.ZodType>(schema: T, maximum = 512) {
  return z.array(schema).max(maximum)
    .refine((values) => unique(values as string[]), "Values must be unique")
    .refine((values) => canonical(values as string[]), "Values must use canonical lexical ordering")
}

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Accessibility Design Rules candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalIdentifierListSchema = canonicalArray(identifierSchema, 16_384)
const canonicalRequirementKeyListSchema = canonicalArray(requirementKeySchema, 4_096)
const canonicalDigestListSchema = canonicalArray(digestSchema, 1_024)
const canonicalTextListSchema = canonicalArray(shortTextSchema)
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

export const accessibilityTargetSchema = z.object({
  key: identifierSchema,
  kind: z.enum(["platform", "screen", "state", "design-system", "token", "variable", "component"]),
  referenceKey: z.string().trim().min(1).max(512),
  platformKeys: canonicalIdentifierListSchema,
  screenKeys: canonicalIdentifierListSchema,
  stateKeys: canonicalIdentifierListSchema,
  requirementKeys: canonicalRequirementKeyListSchema,
  ownership: candidateOwnershipSchema,
  sources: exactSourceListSchema,
  limitations: canonicalTextListSchema,
}).strict()

const accessibilityStandardReferenceSchema = z.object({
  family: z.enum(["wcag", "en-301-549", "section-508", "platform-guideline", "organizational-policy", "other"]),
  version: z.string().trim().min(1).max(80),
  criterion: z.string().trim().min(1).max(160),
  level: z.enum(["A", "AA", "AAA", "not-specified"]),
}).strict()

const standardReferenceListSchema = z.array(accessibilityStandardReferenceSchema).max(64)
  .refine((entries) => unique(entries.map((entry) =>
    `${entry.family}:${entry.version}:${entry.criterion}:${entry.level}`)),
  "Accessibility standard references must be unique")
  .refine((entries) => canonical(entries.map((entry) =>
    `${entry.family}:${entry.version}:${entry.criterion}:${entry.level}`)),
  "Accessibility standard references must use canonical ordering")

export const accessibilityRuleSchema = z.object({
  key: identifierSchema,
  title: z.string().trim().min(2).max(240),
  principle: z.enum(["perceivable", "operable", "understandable", "robust", "cross-cutting"]),
  applicability: z.enum(["applicable", "not-applicable", "unresolved"]),
  impact: z.enum(["critical", "major", "moderate", "minor", "not-assessed"]),
  targetKeys: canonicalIdentifierListSchema,
  requirementKeys: canonicalRequirementKeyListSchema,
  checkKeys: canonicalIdentifierListSchema,
  standardReferences: standardReferenceListSchema,
  ownership: candidateOwnershipSchema,
  notApplicableDecision: attributableHumanDecisionSchema.optional(),
  rationale: longTextSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((rule, context) => {
  if ((rule.applicability === "not-applicable") !== (rule.notApplicableDecision !== undefined)) {
    context.addIssue({ code: "custom", path: ["notApplicableDecision"], message: "Not-applicable rules require an attributable human decision; other states forbid one" })
  }
  if (rule.applicability === "applicable" && (rule.targetKeys.length === 0 || rule.checkKeys.length === 0)) {
    context.addIssue({ code: "custom", message: "Applicable accessibility rules require governed targets and design checks" })
  }
  if (rule.applicability !== "applicable" && rule.checkKeys.length > 0) {
    context.addIssue({ code: "custom", path: ["checkKeys"], message: "Only applicable accessibility rules may declare design checks" })
  }
})

export const accessibilityDesignCheckSchema = z.object({
  key: identifierSchema,
  ruleKey: identifierSchema,
  targetKeys: canonicalIdentifierListSchema,
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
    context.addIssue({ code: "custom", message: "Human-reviewed checks require an attributable reviewer and time; other states forbid them" })
  }
  if ((check.evidenceState === "not-assessed") !== (check.observation === "not-assessed")) {
    context.addIssue({ code: "custom", path: ["observation"], message: "Only assessed checks may record a supporting or contradicting observation" })
  }
  if ((check.evidenceState === "not-assessed") !== (check.evidenceDigests.length === 0)) {
    context.addIssue({ code: "custom", path: ["evidenceDigests"], message: "Assessed checks require evidence digests; not-assessed checks forbid them" })
  }
  if (check.targetKeys.length === 0) {
    context.addIssue({ code: "custom", path: ["targetKeys"], message: "Accessibility design checks require at least one governed target" })
  }
})

const accessibilityRequirementCoverageSchema = z.object({
  requirementKey: requirementKeySchema,
  state: z.enum(["represented", "not-applicable", "unresolved"]),
  ruleKeys: canonicalIdentifierListSchema,
  notApplicableDecision: attributableHumanDecisionSchema.optional(),
  rationale: longTextSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((coverage, context) => {
  if ((coverage.state === "represented") !== (coverage.ruleKeys.length > 0)) {
    context.addIssue({ code: "custom", path: ["ruleKeys"], message: "Represented requirements require accessibility rules; other states forbid them" })
  }
  if ((coverage.state === "not-applicable") !== (coverage.notApplicableDecision !== undefined)) {
    context.addIssue({ code: "custom", path: ["notApplicableDecision"], message: "Not-applicable requirement coverage requires an attributable human decision; other states forbid one" })
  }
})

const accessibilityDesignRulesInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  screenStateInventory: exactScreenStateInventoryBindingSchema,
  designRequirements: exactDesignRequirementsBindingSchema,
  designSystemTokenContract: exactDesignSystemTokenContractBindingSchema,
  targets: z.array(accessibilityTargetSchema).min(1).max(16_384)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Accessibility target keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Accessibility targets must use canonical key ordering"),
  rules: z.array(accessibilityRuleSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Accessibility rule keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Accessibility rules must use canonical key ordering"),
  checks: z.array(accessibilityDesignCheckSchema).max(16_384)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Accessibility design check keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Accessibility design checks must use canonical key ordering"),
  requirementCoverage: z.array(accessibilityRequirementCoverageSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.requirementKey)), "Accessibility requirement coverage keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.requirementKey)), "Accessibility requirement coverage must use canonical key ordering"),
  catalogCompletenessState: z.enum(["candidate-complete", "not-assessed"]),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: requiredCanonicalTextListSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  accessibilityConformanceState: z.literal("not-established"),
  ruleValidityState: z.literal("not-established"),
  legalComplianceState: z.literal("not-established"),
  designApprovalState: z.literal("not-established"),
  designBaselineState: z.literal("not-established"),
  readinessState: z.literal("not-established"),
  implementationAuthorityState: z.literal("not-established"),
}).strict().superRefine((candidate, context) => {
  const targetKeys = new Set(candidate.targets.map((entry) => entry.key))
  const ruleByKey = new Map(candidate.rules.map((entry) => [entry.key, entry]))
  const checkByKey = new Map(candidate.checks.map((entry) => [entry.key, entry]))
  for (const [index, rule] of candidate.rules.entries()) {
    if (rule.targetKeys.some((key) => !targetKeys.has(key)) ||
        rule.checkKeys.some((key) => checkByKey.get(key)?.ruleKey !== rule.key)) {
      context.addIssue({ code: "custom", path: ["rules", index], message: "Accessibility rules must reconcile exact governed targets and design checks" })
    }
  }
  for (const [index, check] of candidate.checks.entries()) {
    const rule = ruleByKey.get(check.ruleKey)
    if (!rule || !rule.checkKeys.includes(check.key) || check.targetKeys.some((key) => !rule.targetKeys.includes(key))) {
      context.addIssue({ code: "custom", path: ["checks", index], message: "Accessibility design checks must reconcile to one exact rule and its targets" })
    }
  }
  for (const [index, coverage] of candidate.requirementCoverage.entries()) {
    if (coverage.ruleKeys.some((key) => !ruleByKey.has(key))) {
      context.addIssue({ code: "custom", path: ["requirementCoverage", index], message: "Accessibility requirement coverage must reference exact rules" })
    }
  }
  const unresolved = candidate.targets.some((entry) => entry.ownership.state === "unresolved") ||
    candidate.rules.some((entry) => entry.applicability === "unresolved" || entry.impact === "not-assessed" || entry.ownership.state === "unresolved") ||
    candidate.checks.some((entry) => entry.evidenceState !== "human-reviewed" || entry.observation === "evidence-contradicts") ||
    candidate.requirementCoverage.some((entry) => entry.state === "unresolved")
  if (candidate.reviewState === "ready-for-human-review" &&
      (candidate.catalogCompletenessState !== "candidate-complete" || unresolved || candidate.unresolvedQuestions.length > 0)) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Accessibility Design Rules cannot be review-ready while targets, rules, checks, evidence, coverage, ownership, or questions remain unresolved" })
  }
})

export const accessibilityDesignRulesInputSchema = rejectSecrets(accessibilityDesignRulesInputBaseSchema)

export const accessibilityDesignRulesSchema = accessibilityDesignRulesInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("accessibility-design-rules-candidate"),
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
    "accessibility-design-rules-are-candidate-metadata-and-do-not-establish-accessibility-conformance-rule-or-check-validity-legal-compliance-ownership-design-approval-baseline-readiness-implementation-or-action-authority",
  ),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Accessibility Design Rules revisions after revision one require an exact predecessor digest" })
  }
})

export const exactAccessibilityDesignRulesReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const accessibilityDesignRulesStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("accessibility-design-rules-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactAccessibilityDesignRulesReferenceSchema.optional(),
  targetCount: z.number().int().nonnegative().max(16_384),
  ruleCount: z.number().int().nonnegative().max(4_096),
  checkCount: z.number().int().nonnegative().max(16_384),
  applicableRuleCount: z.number().int().nonnegative().max(4_096),
  notApplicableRuleCount: z.number().int().nonnegative().max(4_096),
  unresolvedRuleCount: z.number().int().nonnegative().max(4_096),
  notAssessedCheckCount: z.number().int().nonnegative().max(16_384),
  evidenceRecordedCheckCount: z.number().int().nonnegative().max(16_384),
  humanReviewedCheckCount: z.number().int().nonnegative().max(16_384),
  contradictedCheckCount: z.number().int().nonnegative().max(16_384),
  representedRequirementCount: z.number().int().nonnegative().max(4_096),
  unresolvedRequirementCount: z.number().int().nonnegative().max(4_096),
  unresolvedOwnershipCount: z.number().int().nonnegative().max(20_480),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  catalogCompletenessState: z.enum(["candidate-complete", "not-assessed"]),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "accessibility-design-rules-status-is-observational-and-does-not-establish-accessibility-conformance-rule-or-check-validity-legal-compliance-ownership-design-approval-baseline-readiness-implementation-or-action-authority",
  ),
}).strict().superRefine((status, context) => {
  const gaps = status.unresolvedRuleCount + status.notAssessedCheckCount + status.evidenceRecordedCheckCount +
    status.contradictedCheckCount + status.unresolvedRequirementCount + status.unresolvedOwnershipCount +
    status.staleBindingCount + status.staleSourceReferenceCount + status.unresolvedQuestionCount
  if (status.state === "complete-for-review" &&
      (gaps > 0 || status.catalogCompletenessState !== "candidate-complete" || status.reviewState !== "ready-for-human-review" ||
       status.reasons.length > 0 || !status.candidate)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires exact review-ready Accessibility Design Rules with no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Accessibility Design Rules status must expose reasons" })
  }
})

export const accessibilityDesignRulesProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("accessibility-design-rules-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: accessibilityDesignRulesStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, membershipDigest: digestSchema,
    state: z.literal("candidate"), targetCount: z.number().int().nonnegative(), ruleCount: z.number().int().nonnegative(),
    checkCount: z.number().int().nonnegative(), representedRequirementCount: z.number().int().nonnegative(),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-record-identities-counts-statuses-and-digests-only-not-rule-procedures-evidence-requirement-source-design-or-personal-content-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "accessibility-design-rules-projection-is-read-only-and-does-not-establish-accessibility-conformance-rule-or-check-validity-legal-compliance-ownership-design-approval-baseline-readiness-implementation-write-or-action-authority",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Accessibility Design Rules projection must bind exact Product and Initiative revisions" })
  }
})

export type AccessibilityDesignRulesInput = z.infer<typeof accessibilityDesignRulesInputSchema>
export type AccessibilityDesignRules = z.infer<typeof accessibilityDesignRulesSchema>
export type ExactAccessibilityDesignRulesReference = z.infer<typeof exactAccessibilityDesignRulesReferenceSchema>
export type AccessibilityDesignRulesStatus = z.infer<typeof accessibilityDesignRulesStatusSchema>
export type AccessibilityDesignRulesProjection = z.infer<typeof accessibilityDesignRulesProjectionSchema>
