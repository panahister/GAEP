import { z } from "zod"

import { businessContextBindingSchema, exactBusinessUnderstandingReferenceSchema } from "./business-understanding.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactScreenStateInventoryReferenceSchema } from "./screen-state-inventory.js"
import { exactSourceReferenceSchema } from "./source-governance.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const requirementKeySchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/)
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
    message: "Portable Design Requirements candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalIdentifierListSchema = canonicalArray(identifierSchema, 16_384)
const requiredCanonicalIdentifierListSchema = canonicalIdentifierListSchema
  .refine((values) => values.length > 0, "At least one identifier is required")
const canonicalRequirementKeyListSchema = canonicalArray(requirementKeySchema, 4_096)
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

export const exactDesignRequirementReferenceSchema = z.object({
  recordType: z.literal("requirement"),
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

export const exactDesignRequirementWorkItemReferenceSchema = z.object({
  recordType: z.literal("work-item"),
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

const exactWorkItemListSchema = z.array(exactDesignRequirementWorkItemReferenceSchema).max(256)
  .refine((entries) => unique(entries.map((entry) => entry.recordId)), "Work Item references must be unique")
  .refine((entries) => canonical(entries.map((entry) => entry.recordId)), "Work Item references must use canonical identity ordering")

const evidenceReviewSchema = z.object({
  state: z.enum(["disputed", "human-reviewed", "hypothesis", "supported"]),
  sources: exactSourceListSchema,
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
}).strict().superRefine((evidence, context) => {
  const metadata = evidence.reviewedBy !== undefined || evidence.reviewedAt !== undefined
  if (evidence.state === "human-reviewed" && (!evidence.reviewedBy || !evidence.reviewedAt)) {
    context.addIssue({ code: "custom", message: "Human-reviewed requirement evidence requires an attributable reviewer and time" })
  }
  if (evidence.state !== "human-reviewed" && metadata) {
    context.addIssue({ code: "custom", message: "Only human-reviewed requirement evidence can carry review metadata" })
  }
})

const backlogDispositionSchema = z.object({
  state: z.enum(["linked", "not-planned", "unresolved"]),
  workItems: exactWorkItemListSchema,
  rationale: longTextSchema,
  decidedBy: humanActorSchema.optional(),
  decidedAt: z.string().datetime().optional(),
}).strict().superRefine((backlog, context) => {
  const humanDecision = backlog.decidedBy !== undefined && backlog.decidedAt !== undefined
  if (backlog.state === "linked" && (backlog.workItems.length === 0 || humanDecision)) {
    context.addIssue({ code: "custom", message: "Linked backlog disposition requires exact Work Items and forbids an exception decision" })
  }
  if (backlog.state === "not-planned" && (backlog.workItems.length > 0 || !humanDecision)) {
    context.addIssue({ code: "custom", message: "Not-planned backlog disposition forbids Work Items and requires an attributable human decision" })
  }
  if (backlog.state === "unresolved" && (backlog.workItems.length > 0 || humanDecision)) {
    context.addIssue({ code: "custom", message: "Unresolved backlog disposition forbids Work Items and decided metadata" })
  }
})

const requirementTargetsSchema = z.object({
  platformKeys: canonicalIdentifierListSchema,
  screenKeys: canonicalIdentifierListSchema,
  stateKeys: canonicalIdentifierListSchema,
  variantKeys: canonicalIdentifierListSchema,
  routeKeys: canonicalIdentifierListSchema,
  designScopeKeys: canonicalIdentifierListSchema,
}).strict().superRefine((targets, context) => {
  if (Object.values(targets).every((values) => values.length === 0)) {
    context.addIssue({ code: "custom", message: "Each Design Requirement requires at least one exact design target" })
  }
})

const linkedRequirementSchema = z.object({
  key: requirementKeySchema,
  requirement: exactDesignRequirementReferenceSchema,
  outcomeIds: requiredCanonicalIdentifierListSchema,
  targets: requirementTargetsSchema,
  backlog: backlogDispositionSchema,
  evidence: evidenceReviewSchema,
  verificationEvidenceState: z.enum(["disputed", "human-reviewed", "not-assessed", "supported"]),
  requirementValidityState: z.literal("not-established"),
  satisfactionState: z.literal("not-established"),
}).strict()

const outcomeCoverageSchema = z.object({
  outcomeId: identifierSchema,
  status: z.enum(["represented", "unresolved"]),
  requirementKeys: canonicalRequirementKeyListSchema,
  rationale: longTextSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((coverage, context) => {
  if ((coverage.status === "represented") !== (coverage.requirementKeys.length > 0)) {
    context.addIssue({ code: "custom", message: "Represented outcome coverage requires Design Requirements; unresolved coverage forbids them" })
  }
})

const exactScreenStateInventoryBindingSchema = exactScreenStateInventoryReferenceSchema
  .extend({ membershipDigest: digestSchema }).strict()

const designRequirementsInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  outcomeModel: exactBusinessUnderstandingReferenceSchema,
  screenStateInventory: exactScreenStateInventoryBindingSchema,
  requirements: z.array(linkedRequirementSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Design Requirement keys must be unique")
    .refine((entries) => unique(entries.map((entry) => entry.requirement.recordId)), "Requirement records must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Design Requirements must use canonical key ordering"),
  outcomeCoverage: z.array(outcomeCoverageSchema).min(1).max(256)
    .refine((entries) => unique(entries.map((entry) => entry.outcomeId)), "Outcome coverage must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.outcomeId)), "Outcome coverage must use canonical outcome ordering"),
  catalogCompletenessState: z.enum(["candidate-complete", "not-assessed"]),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: requiredCanonicalTextListSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  priorityApprovalState: z.literal("not-established"),
  designApprovalState: z.literal("not-established"),
  backlogCommitmentState: z.literal("not-established"),
  readinessState: z.literal("not-established"),
  implementationAuthorityState: z.literal("not-established"),
}).strict().superRefine((candidate, context) => {
  const requirementByKey = new Map(candidate.requirements.map((entry) => [entry.key, entry]))
  for (const [index, coverage] of candidate.outcomeCoverage.entries()) {
    if (coverage.requirementKeys.some((key) => !requirementByKey.get(key)?.outcomeIds.includes(coverage.outcomeId))) {
      context.addIssue({ code: "custom", path: ["outcomeCoverage", index, "requirementKeys"], message: "Outcome coverage must agree with exact Design Requirement outcome links" })
    }
  }
  for (const [index, requirement] of candidate.requirements.entries()) {
    if (requirement.outcomeIds.some((outcomeId) =>
      !candidate.outcomeCoverage.find((coverage) =>
        coverage.outcomeId === outcomeId && coverage.requirementKeys.includes(requirement.key)))) {
      context.addIssue({ code: "custom", path: ["requirements", index, "outcomeIds"], message: "Every Design Requirement outcome link requires matching represented outcome coverage" })
    }
  }
  const weakEvidence = candidate.requirements.some((entry) =>
    entry.evidence.state === "hypothesis" || entry.evidence.state === "disputed" ||
    entry.verificationEvidenceState === "not-assessed" || entry.verificationEvidenceState === "disputed")
  const unresolved = candidate.outcomeCoverage.some((entry) => entry.status === "unresolved") ||
    candidate.requirements.some((entry) => entry.backlog.state === "unresolved")
  if (candidate.reviewState === "ready-for-human-review" &&
      (candidate.catalogCompletenessState !== "candidate-complete" || weakEvidence || unresolved || candidate.unresolvedQuestions.length > 0)) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Design Requirements cannot be ready for human review while catalog, evidence, outcome, backlog, or question gaps remain" })
  }
})

export const designRequirementsInputSchema = rejectSecrets(designRequirementsInputBaseSchema)

export const designRequirementsSchema = designRequirementsInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("design-requirements-candidate"),
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
    "design-requirements-are-candidate-links-and-do-not-establish-requirement-validity-completeness-priority-approval-satisfaction-backlog-commitment-design-approval-readiness-implementation-or-action-authority",
  ),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Design Requirements revisions after revision one require an exact predecessor digest" })
  }
})

export const exactDesignRequirementsReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const designRequirementsStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("design-requirements-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactDesignRequirementsReferenceSchema.optional(),
  requirementCount: z.number().int().nonnegative().max(4_096),
  mustPriorityCount: z.number().int().nonnegative().max(4_096),
  representedOutcomeCount: z.number().int().nonnegative().max(256),
  unresolvedOutcomeCount: z.number().int().nonnegative().max(256),
  linkedBacklogRequirementCount: z.number().int().nonnegative().max(4_096),
  notPlannedRequirementCount: z.number().int().nonnegative().max(4_096),
  unresolvedBacklogRequirementCount: z.number().int().nonnegative().max(4_096),
  workItemCount: z.number().int().nonnegative().max(1_048_576),
  weakEvidenceRequirementCount: z.number().int().nonnegative().max(4_096),
  staleBindingCount: z.number().int().nonnegative(),
  staleDomainReferenceCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  catalogCompletenessState: z.enum(["candidate-complete", "not-assessed"]),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "design-requirements-status-is-observational-and-does-not-establish-requirement-validity-completeness-priority-approval-satisfaction-backlog-commitment-design-approval-readiness-implementation-or-action-authority",
  ),
}).strict().superRefine((status, context) => {
  const gaps = status.unresolvedOutcomeCount + status.unresolvedBacklogRequirementCount +
    status.weakEvidenceRequirementCount + status.staleBindingCount + status.staleDomainReferenceCount +
    status.staleSourceReferenceCount + status.unresolvedQuestionCount
  if (status.state === "complete-for-review" &&
      (gaps > 0 || status.catalogCompletenessState !== "candidate-complete" ||
       status.reviewState !== "ready-for-human-review" || status.reasons.length > 0 || !status.candidate)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires an exact review-ready Design Requirements candidate with no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Design Requirements status must expose reasons" })
  }
})

export const designRequirementsProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("design-requirements-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: designRequirementsStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, membershipDigest: digestSchema,
    state: z.literal("candidate"), requirementCount: z.number().int().nonnegative(),
    representedOutcomeCount: z.number().int().nonnegative(), workItemCount: z.number().int().nonnegative(),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-record-identities-counts-statuses-and-digests-only-not-requirement-outcome-work-item-design-target-source-or-personal-content-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "design-requirements-projection-is-read-only-and-does-not-establish-requirement-validity-completeness-priority-approval-satisfaction-backlog-commitment-design-approval-readiness-implementation-or-write-or-action-authority",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Design Requirements projection must bind the exact Product and Initiative revisions" })
  }
})

export type ExactDesignRequirementReference = z.infer<typeof exactDesignRequirementReferenceSchema>
export type ExactDesignRequirementWorkItemReference = z.infer<typeof exactDesignRequirementWorkItemReferenceSchema>
export type DesignRequirementsInput = z.infer<typeof designRequirementsInputSchema>
export type DesignRequirements = z.infer<typeof designRequirementsSchema>
export type ExactDesignRequirementsReference = z.infer<typeof exactDesignRequirementsReferenceSchema>
export type DesignRequirementsStatus = z.infer<typeof designRequirementsStatusSchema>
export type DesignRequirementsProjection = z.infer<typeof designRequirementsProjectionSchema>
