import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactSourceReferenceSchema } from "./source-governance.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const requirementKeySchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()

const unique = (values: readonly string[]) => new Set(values).size === values.length
const canonical = (values: readonly string[]) =>
  values.every((value, index) => value === [...values].sort((left, right) => left.localeCompare(right))[index])
const canonicalDigestsSchema = z.array(digestSchema).max(1_024)
  .refine(unique, "Digests must be unique").refine(canonical, "Digests must use canonical ordering")
const canonicalIdentifiersSchema = z.array(identifierSchema).max(4_096)
  .refine(unique, "Identifiers must be unique").refine(canonical, "Identifiers must use canonical ordering")
const canonicalRequirementKeysSchema = z.array(requirementKeySchema).max(4_096)
  .refine(unique, "Requirement keys must be unique").refine(canonical, "Requirement keys must use canonical ordering")
const canonicalTextSchema = z.array(shortTextSchema).max(512)
  .refine(unique, "Values must be unique").refine(canonical, "Values must use canonical ordering")
const exactSourceListSchema = z.array(exactSourceReferenceSchema).min(1).max(256)
  .refine((entries) => unique(entries.map((entry) => `${entry.sourceId}:${entry.sourceRevision}:${entry.recordDigest}:${entry.contentDigest}`)), "Source references must be unique")

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Design-to-Requirement Binding candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const exactFinalizedSnapshotBindingSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
  membershipDigest: digestSchema, itemCatalogDigest: digestSchema,
}).strict()

export const exactDesignRequirementsBindingSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
  membershipDigest: digestSchema, requirementCatalogDigest: digestSchema,
}).strict()

export const exactDecisionRegisterBindingSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
  membershipDigest: digestSchema, decisionCatalogDigest: digestSchema,
}).strict()

export const designToRequirementLinkSchema = z.object({
  key: identifierSchema,
  designItemKey: identifierSchema,
  designItemKind: z.enum(["file", "component", "component-set", "variable-collection", "variable", "style", "prototype-flow"]),
  requirementKeys: canonicalRequirementKeysSchema.refine((values) => values.length > 0, "Every design binding requires a Requirement"),
  decisionKeys: canonicalIdentifiersSchema,
  requirementRelationship: z.enum(["addresses", "constrains", "supports", "verifies"]),
  decisionRelationship: z.enum(["constrained-by", "implements-outcome", "informed-by", "reviews"]).optional(),
  provenanceDigest: digestSchema,
  evidenceState: z.enum(["disputed", "human-reviewed", "not-assessed", "source-recorded"]),
  evidenceDigests: canonicalDigestsSchema,
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
  sources: exactSourceListSchema,
}).strict().superRefine((binding, context) => {
  if ((binding.decisionKeys.length > 0) !== (binding.decisionRelationship !== undefined)) {
    context.addIssue({ code: "custom", path: ["decisionRelationship"], message: "Decision relationships require exact Decision keys and Decision keys require one relationship" })
  }
  const reviewed = binding.evidenceState === "human-reviewed"
  if (reviewed !== (binding.evidenceDigests.length > 0 && binding.reviewedBy !== undefined && binding.reviewedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Human-reviewed bindings require exact evidence, reviewer, and time; other states forbid review attribution" })
  }
})

export const designItemBindingCoverageSchema = z.object({
  itemKey: identifierSchema,
  state: z.enum(["bound-candidate", "excluded-candidate", "unbound"]),
  bindingKeys: canonicalIdentifiersSchema,
  rationaleDigest: digestSchema,
  sources: exactSourceListSchema,
  excludedBy: humanActorSchema.optional(),
  excludedAt: z.string().datetime().optional(),
}).strict().superRefine((coverage, context) => {
  if ((coverage.state === "bound-candidate") !== (coverage.bindingKeys.length > 0)) {
    context.addIssue({ code: "custom", path: ["bindingKeys"], message: "Bound design-item coverage requires bindings; other states forbid them" })
  }
  const excluded = coverage.state === "excluded-candidate"
  if (excluded !== (coverage.excludedBy !== undefined && coverage.excludedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Candidate exclusions require an attributable human actor and time; other states forbid them" })
  }
})

export const governedSubjectBindingCoverageSchema = z.object({
  subjectType: z.enum(["decision", "requirement"]),
  subjectKey: z.string().trim().min(2).max(240),
  state: z.enum(["bound-candidate", "not-applicable-candidate", "unbound"]),
  bindingKeys: canonicalIdentifiersSchema,
  rationaleDigest: digestSchema,
  sources: exactSourceListSchema,
  decidedBy: humanActorSchema.optional(),
  decidedAt: z.string().datetime().optional(),
}).strict().superRefine((coverage, context) => {
  if (coverage.subjectType === "requirement" && !requirementKeySchema.safeParse(coverage.subjectKey).success) {
    context.addIssue({ code: "custom", path: ["subjectKey"], message: "Requirement coverage must use an exact Requirement key" })
  }
  if (coverage.subjectType === "decision" && !identifierSchema.safeParse(coverage.subjectKey).success) {
    context.addIssue({ code: "custom", path: ["subjectKey"], message: "Decision coverage must use an exact Decision key" })
  }
  if ((coverage.state === "bound-candidate") !== (coverage.bindingKeys.length > 0)) {
    context.addIssue({ code: "custom", path: ["bindingKeys"], message: "Bound governed-subject coverage requires bindings; other states forbid them" })
  }
  const notApplicable = coverage.state === "not-applicable-candidate"
  if (notApplicable !== (coverage.decidedBy !== undefined && coverage.decidedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Candidate non-applicability requires an attributable human decision and time; other states forbid them" })
  }
})

export const designToRequirementConflictSchema = z.object({
  key: identifierSchema,
  kind: z.enum(["ambiguous-relationship", "decision-gap", "item-gap", "provenance-gap", "requirement-gap"]),
  state: z.enum(["open", "resolved"]),
  subjectDigest: digestSchema,
  rationaleDigest: digestSchema,
  evidenceDigests: canonicalDigestsSchema,
  resolvedBy: humanActorSchema.optional(),
  resolvedAt: z.string().datetime().optional(),
  sources: exactSourceListSchema,
}).strict().superRefine((conflict, context) => {
  const resolved = conflict.state === "resolved"
  if (resolved !== (conflict.evidenceDigests.length > 0 && conflict.resolvedBy !== undefined && conflict.resolvedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Resolved binding conflicts require exact evidence and attributable human resolution; open conflicts forbid them" })
  }
})

const inputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  objectiveDigest: digestSchema,
  finalizedSnapshot: exactFinalizedSnapshotBindingSchema,
  designRequirements: exactDesignRequirementsBindingSchema,
  decisionRegister: exactDecisionRegisterBindingSchema,
  bindings: z.array(designToRequirementLinkSchema).min(1).max(32_768)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Binding keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Bindings must use canonical key ordering"),
  designItemCoverage: z.array(designItemBindingCoverageSchema).min(1).max(33_792)
    .refine((entries) => unique(entries.map((entry) => entry.itemKey)), "Design-item coverage must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.itemKey)), "Design-item coverage must use canonical item ordering"),
  subjectCoverage: z.array(governedSubjectBindingCoverageSchema).min(1).max(8_192)
    .refine((entries) => unique(entries.map((entry) => `${entry.subjectType}:${entry.subjectKey}`)), "Governed-subject coverage must be unique")
    .refine((entries) => canonical(entries.map((entry) => `${entry.subjectType}:${entry.subjectKey}`)), "Governed-subject coverage must use canonical type and key ordering"),
  conflicts: z.array(designToRequirementConflictSchema).max(2_048)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Conflict keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Conflicts must use canonical key ordering"),
  reconciliationDigest: digestSchema,
  reconciliationState: z.enum(["exact", "not-assessed", "partial"]),
  candidateCoverageState: z.enum(["candidate-complete", "not-assessed", "partial"]),
  provenanceState: z.enum(["exact", "not-assessed", "partial"]),
  unresolvedQuestions: canonicalTextSchema,
  limitations: canonicalTextSchema.refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  relationshipTruthState: z.literal("not-established"),
  coverageCompletenessState: z.literal("not-established"),
  requirementSatisfactionState: z.literal("not-established"),
  decisionEffectivenessState: z.literal("not-established"),
  externalCompletenessState: z.literal("not-established"),
  designValidityState: z.literal("not-established"),
  designApprovalState: z.literal("not-established"),
  designBaselineState: z.literal("not-established"),
  readinessState: z.literal("not-established"),
  figmaConnectionAuthorityState: z.literal("not-granted"),
  credentialAuthorityState: z.literal("not-granted"),
  permissionGrantState: z.literal("not-granted"),
  importExecutionState: z.literal("not-performed"),
  writeExecutionState: z.literal("not-performed"),
  implementationAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  const bindingByKey = new Map(candidate.bindings.map((entry) => [entry.key, entry]))
  const itemCoverageByKey = new Map(candidate.designItemCoverage.map((entry) => [entry.itemKey, entry]))
  const subjectCoverageByKey = new Map(candidate.subjectCoverage.map((entry) => [`${entry.subjectType}:${entry.subjectKey}`, entry]))
  for (const binding of candidate.bindings) {
    if (!itemCoverageByKey.get(binding.designItemKey)?.bindingKeys.includes(binding.key)) {
      context.addIssue({ code: "custom", path: ["designItemCoverage"], message: "Every binding requires matching design-item coverage" })
    }
    for (const key of binding.requirementKeys) {
      if (!subjectCoverageByKey.get(`requirement:${key}`)?.bindingKeys.includes(binding.key)) {
        context.addIssue({ code: "custom", path: ["subjectCoverage"], message: "Every Requirement binding requires matching subject coverage" })
      }
    }
    for (const key of binding.decisionKeys) {
      if (!subjectCoverageByKey.get(`decision:${key}`)?.bindingKeys.includes(binding.key)) {
        context.addIssue({ code: "custom", path: ["subjectCoverage"], message: "Every Decision binding requires matching subject coverage" })
      }
    }
  }
  for (const coverage of candidate.designItemCoverage) {
    if (coverage.bindingKeys.some((key) => bindingByKey.get(key)?.designItemKey !== coverage.itemKey)) {
      context.addIssue({ code: "custom", path: ["designItemCoverage"], message: "Design-item coverage may reference only bindings for that item" })
    }
  }
  for (const coverage of candidate.subjectCoverage) {
    if (coverage.bindingKeys.some((key) => {
      const binding = bindingByKey.get(key)
      return !binding || (coverage.subjectType === "requirement"
        ? !binding.requirementKeys.includes(coverage.subjectKey)
        : !binding.decisionKeys.includes(coverage.subjectKey))
    })) {
      context.addIssue({ code: "custom", path: ["subjectCoverage"], message: "Governed-subject coverage may reference only bindings for that subject" })
    }
  }
  const openConflicts = candidate.conflicts.some((entry) => entry.state === "open")
  const weakBindings = candidate.bindings.some((entry) => entry.evidenceState !== "human-reviewed")
  const unbound = candidate.designItemCoverage.some((entry) => entry.state === "unbound") ||
    candidate.subjectCoverage.some((entry) => entry.state === "unbound")
  const decisionLinked = candidate.bindings.some((entry) => entry.decisionKeys.length > 0)
  if (candidate.reviewState === "ready-for-human-review" &&
      (candidate.reconciliationState !== "exact" || candidate.candidateCoverageState !== "candidate-complete" ||
       candidate.provenanceState !== "exact" || openConflicts || weakBindings || unbound || !decisionLinked ||
       candidate.unresolvedQuestions.length > 0)) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready bindings require exact reconciled, candidate-complete, human-reviewed Requirement and Decision links with no open gap" })
  }
})

export const designToRequirementBindingInputSchema = rejectSecrets(inputBaseSchema)

export const designToRequirementBindingSchema = designToRequirementBindingInputSchema.safeExtend({
  schemaVersion: z.literal(1), kind: z.literal("design-to-requirement-binding-candidate"),
  id: z.string().uuid(), productId: z.string().uuid(), revision: z.number().int().positive(),
  membershipDigest: digestSchema, predecessorDigest: digestSchema.optional(), state: z.literal("candidate"),
  createdBy: humanActorSchema, updatedBy: humanActorSchema,
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  authorityBoundary: z.literal("design-to-requirement-binding-is-a-review-candidate-and-does-not-establish-relationship-truth-coverage-completeness-requirement-satisfaction-decision-effectiveness-external-completeness-design-validity-or-approval-baseline-readiness-implementation-write-import-or-action-authority"),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Design-to-Requirement Binding revisions after revision one require an exact predecessor digest" })
  }
})

export const exactDesignToRequirementBindingReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const designToRequirementBindingStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("design-to-requirement-binding-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactDesignToRequirementBindingReferenceSchema.optional(),
  bindingCount: z.number().int().nonnegative().max(32_768),
  humanReviewedBindingCount: z.number().int().nonnegative().max(32_768),
  designItemCount: z.number().int().nonnegative().max(33_792),
  boundDesignItemCount: z.number().int().nonnegative().max(33_792),
  unboundDesignItemCount: z.number().int().nonnegative().max(33_792),
  requirementCount: z.number().int().nonnegative().max(4_096),
  boundRequirementCount: z.number().int().nonnegative().max(4_096),
  unboundRequirementCount: z.number().int().nonnegative().max(4_096),
  decisionCount: z.number().int().nonnegative().max(4_096),
  boundDecisionCount: z.number().int().nonnegative().max(4_096),
  unboundDecisionCount: z.number().int().nonnegative().max(4_096),
  openConflictCount: z.number().int().nonnegative().max(2_048),
  staleBindingCount: z.number().int().nonnegative(), staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  reconciliationState: z.enum(["exact", "not-assessed", "partial"]),
  candidateCoverageState: z.enum(["candidate-complete", "not-assessed", "partial"]),
  provenanceState: z.enum(["exact", "not-assessed", "partial"]),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-review"]), reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal("design-to-requirement-binding-status-is-observational-and-does-not-establish-relationship-truth-coverage-completeness-requirement-satisfaction-decision-effectiveness-external-completeness-design-validity-or-approval-baseline-readiness-implementation-write-import-or-action-authority"),
}).strict().superRefine((status, context) => {
  const gaps = status.bindingCount - status.humanReviewedBindingCount + status.unboundDesignItemCount +
    status.unboundRequirementCount + status.unboundDecisionCount + status.openConflictCount +
    status.staleBindingCount + status.staleSourceReferenceCount + status.unresolvedQuestionCount
  if (status.state === "complete-for-review" && (gaps > 0 || status.bindingCount === 0 ||
      status.reconciliationState !== "exact" || status.candidateCoverageState !== "candidate-complete" ||
      status.provenanceState !== "exact" || status.reviewState !== "ready-for-human-review" ||
      status.reasons.length > 0 || !status.candidate)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires exact current human-reviewed binding evidence with no declared gap" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required binding status must expose reasons" })
  }
})

export const designToRequirementBindingProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("design-to-requirement-binding-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]) }).strict(),
  status: designToRequirementBindingStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, membershipDigest: digestSchema,
    state: z.literal("candidate"), finalizedSnapshot: exactFinalizedSnapshotBindingSchema,
    designRequirements: exactDesignRequirementsBindingSchema, decisionRegister: exactDecisionRegisterBindingSchema,
    reconciliationDigest: digestSchema, bindingCount: z.number().int().nonnegative(),
    designItemCoverageCount: z.number().int().nonnegative(), subjectCoverageCount: z.number().int().nonnegative(),
    conflictCount: z.number().int().nonnegative(), reconciliationState: z.enum(["exact", "not-assessed", "partial"]),
    candidateCoverageState: z.enum(["candidate-complete", "not-assessed", "partial"]),
    provenanceState: z.enum(["exact", "not-assessed", "partial"]), reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal("projection-contains-record-identities-counts-statuses-and-digests-only-not-figma-content-external-identities-requirement-text-decision-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions"),
  authorityBoundary: z.literal("design-to-requirement-binding-projection-is-read-only-and-does-not-establish-relationship-truth-coverage-completeness-requirement-satisfaction-decision-effectiveness-external-completeness-design-validity-or-approval-baseline-readiness-implementation-write-import-or-action-authority"),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Design-to-Requirement Binding projection must bind exact Product and Initiative revisions" })
  }
})

export type DesignToRequirementBindingInput = z.infer<typeof designToRequirementBindingInputSchema>
export type DesignToRequirementBinding = z.infer<typeof designToRequirementBindingSchema>
export type DesignToRequirementBindingStatus = z.infer<typeof designToRequirementBindingStatusSchema>
export type DesignToRequirementBindingProjection = z.infer<typeof designToRequirementBindingProjectionSchema>
