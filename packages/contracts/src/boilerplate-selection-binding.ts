import { z } from "zod"

import { exactBoilerplateRegistryReferenceSchema } from "./boilerplate-registry.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactDependencyMappingReferenceSchema } from "./dependency-mapping.js"
import { exactImplementationUnitModelReferenceSchema } from "./implementation-unit-model.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactTechnologyProfileReferenceSchema } from "./technology-profile.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function canonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Boilerplate Selection and Binding candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalTextListSchema = z.array(shortTextSchema).max(512)
  .refine(unique, "Values must be unique")
  .refine(canonical, "Values must use canonical lexical ordering")

const canonicalUuidListSchema = z.array(z.string().uuid()).max(10_000)
  .refine(unique, "References must be unique")
  .refine(canonical, "References must use canonical lexical ordering")

export const boilerplateBindingEvidenceReferenceSchema = z.object({
  kind: z.enum([
    "architecture", "backlog", "boilerplate-registry", "decision", "dependency", "design",
    "evidence", "exception-candidate", "implementation-unit", "license-policy", "requirement",
    "risk", "security-policy", "technology-profile", "test",
  ]),
  sourceId: shortTextSchema,
  revision: z.number().int().positive(),
  digest: digestSchema,
  evidenceState: z.enum(["candidate-asserted", "observed-not-validated"]),
}).strict()

const boilerplateBindingEvidenceListSchema = z.array(boilerplateBindingEvidenceReferenceSchema).max(256).refine(
  (values) => unique(values.map((value) => `${value.kind}:${value.sourceId}:${value.revision}:${value.digest}`)),
  "Boilerplate binding evidence references must be unique",
)

export const boilerplateBindingDecisionSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(10_000),
  implementationUnitId: z.string().uuid(),
  technologyProfileId: z.string().uuid(),
  disposition: z.enum(["candidate-selected", "candidate-not-applicable", "candidate-deferred", "not-assessed"]),
  boilerplateRegistryEntryId: z.string().uuid().optional(),
  boilerplateVersionCandidate: z.string().trim().min(1).max(240).optional(),
  bindingRole: z.enum([
    "primary-foundation", "supporting-build-template", "supporting-deployment-template",
    "supporting-design-system", "supporting-test-harness", "other",
  ]),
  accountableDecisionRoleCandidate: shortTextSchema,
  rationale: shortTextSchema,
  conditions: canonicalTextListSchema,
  alternativeRegistryEntryIds: canonicalUuidListSchema,
  deviationCandidates: canonicalTextListSchema,
  exceptionReferenceCandidates: boilerplateBindingEvidenceListSchema,
  evidenceReferences: boilerplateBindingEvidenceListSchema,
  assessedBy: humanActorSchema,
  assessedAt: z.string().datetime(),
  organizationalApprovalState: z.literal("not-established"),
  selectionDecisionEffectivenessState: z.literal("not-established"),
  bindingEffectivenessState: z.literal("not-established"),
  compatibilityValidationState: z.literal("not-established"),
}).strict().superRefine((decision, context) => {
  const hasSelection = decision.boilerplateRegistryEntryId !== undefined || decision.boilerplateVersionCandidate !== undefined
  if (decision.disposition === "candidate-selected" &&
      (!decision.boilerplateRegistryEntryId || !decision.boilerplateVersionCandidate)) {
    context.addIssue({ code: "custom", path: ["boilerplateRegistryEntryId"], message: "A selected candidate requires one exact registry entry and version candidate" })
  }
  if (decision.disposition !== "candidate-selected" && hasSelection) {
    context.addIssue({ code: "custom", path: ["disposition"], message: "Only a selected candidate may identify a registry entry or version" })
  }
  if (decision.boilerplateRegistryEntryId && decision.alternativeRegistryEntryIds.includes(decision.boilerplateRegistryEntryId)) {
    context.addIssue({ code: "custom", path: ["alternativeRegistryEntryIds"], message: "The selected entry cannot also be an alternative" })
  }
})

const boilerplateSelectionBindingInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  implementationUnitModel: exactImplementationUnitModelReferenceSchema,
  dependencyMapping: exactDependencyMappingReferenceSchema,
  technologyProfile: exactTechnologyProfileReferenceSchema,
  boilerplateRegistry: exactBoilerplateRegistryReferenceSchema,
  decisions: z.array(boilerplateBindingDecisionSchema).min(1).max(10_000),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  organizationalDesignationState: z.literal("not-established"),
  endorsementApprovalState: z.literal("not-established"),
  supportCommitmentState: z.literal("not-established"),
  selectionDecisionState: z.literal("not-established"),
  bindingEffectivenessState: z.literal("not-established"),
  compatibilityTruthState: z.literal("not-established"),
  compatibilityCompletenessState: z.literal("not-established"),
  compatibilityValidationState: z.literal("not-established"),
  licensingApprovalState: z.literal("not-established"),
  securityApprovalState: z.literal("not-established"),
  exceptionWaiverState: z.literal("not-established"),
  sourceRetrievalState: z.literal("not-established"),
  assetImportInstantiationState: z.literal("not-established"),
  architectureBaselineDesignationState: z.literal("not-established"),
  implementationReadinessState: z.literal("not-established"),
  implementationCompletenessState: z.literal("not-established"),
  assignmentExecutionState: z.literal("not-established"),
  acceptanceDecisionState: z.literal("not-established"),
  mergeReadinessState: z.literal("not-established"),
  releaseReadinessState: z.literal("not-established"),
  deploymentReadinessState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  const decisionIds = candidate.decisions.map((decision) => decision.id)
  const unitIds = candidate.decisions.map((decision) => decision.implementationUnitId)
  if (!unique(decisionIds)) context.addIssue({ code: "custom", path: ["decisions"], message: "Boilerplate binding decision identities must be unique" })
  if (!unique(unitIds)) context.addIssue({ code: "custom", path: ["decisions"], message: "Each implementation unit must have exactly one Boilerplate binding decision" })
  for (const [index, decision] of candidate.decisions.entries()) {
    if (decision.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["decisions", index, "ordinal"], message: "Boilerplate binding decisions must use contiguous canonical ordinal ordering" })
  }
  if (candidate.reviewState === "ready-for-human-review") {
    const incomplete = candidate.decisions.some((decision) =>
      ["candidate-deferred", "not-assessed"].includes(decision.disposition) ||
      decision.evidenceReferences.length === 0 ||
      decision.organizationalApprovalState !== "not-established" ||
      decision.selectionDecisionEffectivenessState !== "not-established" ||
      decision.bindingEffectivenessState !== "not-established" ||
      decision.compatibilityValidationState !== "not-established")
    if (candidate.unresolvedQuestions.length > 0 || incomplete) {
      context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready Boilerplate Selection and Binding requires complete evidence-backed selected or not-applicable unit decisions with no unresolved questions and no effective authority" })
    }
  }
})

export const boilerplateSelectionBindingInputSchema = rejectSecrets(boilerplateSelectionBindingInputBaseSchema)

const authorityBoundary = "boilerplate-selection-binding-is-a-versioned-candidate-and-does-not-establish-organizational-designation-endorsement-approval-support-commitment-selection-decision-effectiveness-binding-effectiveness-compatibility-truth-or-completeness-or-validation-licensing-or-security-approval-exception-waiver-source-retrieval-import-instantiation-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const

export const boilerplateSelectionBindingSchema = boilerplateSelectionBindingInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("boilerplate-selection-binding-candidate"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  unitDecisionCatalogDigest: digestSchema,
  selectionReceiptDigest: digestSchema,
  bindingReceiptDigest: digestSchema,
  assessmentReceiptDigest: digestSchema,
  predecessorDigest: digestSchema.optional(),
  state: z.literal("candidate"),
  createdBy: humanActorSchema,
  updatedBy: humanActorSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  authorityBoundary: z.literal(authorityBoundary),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Boilerplate Selection and Binding revisions after revision one require an exact predecessor digest" })
  }
})

export const exactBoilerplateSelectionBindingReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

const statusAuthorityBoundary = "boilerplate-selection-binding-status-is-observational-and-does-not-establish-organizational-designation-endorsement-approval-support-commitment-selection-decision-effectiveness-binding-effectiveness-compatibility-truth-or-completeness-or-validation-licensing-or-security-approval-exception-waiver-source-retrieval-import-instantiation-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const

export const boilerplateSelectionBindingStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("boilerplate-selection-binding-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactBoilerplateSelectionBindingReferenceSchema.optional(),
  implementationUnitModel: exactImplementationUnitModelReferenceSchema.optional(),
  dependencyMapping: exactDependencyMappingReferenceSchema.optional(),
  technologyProfile: exactTechnologyProfileReferenceSchema.optional(),
  boilerplateRegistry: exactBoilerplateRegistryReferenceSchema.optional(),
  decisionCount: z.number().int().nonnegative().max(10_000),
  selectedCandidateCount: z.number().int().nonnegative().max(10_000),
  notApplicableCandidateCount: z.number().int().nonnegative().max(10_000),
  deferredCandidateCount: z.number().int().nonnegative().max(10_000),
  notAssessedCount: z.number().int().nonnegative().max(10_000),
  missingUnitDecisionCount: z.number().int().nonnegative().max(10_000),
  invalidSelectionCount: z.number().int().nonnegative().max(10_000),
  registryGapCount: z.number().int().nonnegative().max(10_000),
  profileMismatchCount: z.number().int().nonnegative().max(10_000),
  unitScopeMismatchCount: z.number().int().nonnegative().max(10_000),
  versionMismatchCount: z.number().int().nonnegative().max(10_000),
  missingEvidenceCount: z.number().int().nonnegative().max(10_000),
  staleBindingCount: z.number().int().nonnegative().max(1),
  staleImplementationUnitModelCount: z.number().int().nonnegative().max(1),
  staleDependencyMappingCount: z.number().int().nonnegative().max(1),
  staleTechnologyProfileCount: z.number().int().nonnegative().max(1),
  staleBoilerplateRegistryCount: z.number().int().nonnegative().max(1),
  invalidCandidateCount: z.number().int().nonnegative().max(1),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "candidate-complete"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict().superRefine((status, context) => {
  if (status.selectedCandidateCount + status.notApplicableCandidateCount + status.deferredCandidateCount + status.notAssessedCount !== status.decisionCount) {
    context.addIssue({ code: "custom", path: ["decisionCount"], message: "Boilerplate binding disposition counts must reconcile" })
  }
  const gaps = status.deferredCandidateCount + status.notAssessedCount + status.missingUnitDecisionCount +
    status.invalidSelectionCount + status.registryGapCount + status.profileMismatchCount +
    status.unitScopeMismatchCount + status.versionMismatchCount + status.missingEvidenceCount +
    status.staleBindingCount + status.staleImplementationUnitModelCount + status.staleDependencyMappingCount +
    status.staleTechnologyProfileCount + status.staleBoilerplateRegistryCount + status.invalidCandidateCount +
    status.unresolvedQuestionCount
  if (status.state === "candidate-complete" &&
      (gaps > 0 || !status.candidate || !status.implementationUnitModel || !status.dependencyMapping ||
       !status.technologyProfile || !status.boilerplateRegistry || status.decisionCount < 1 ||
       status.reviewState !== "ready-for-human-review" || status.reasons.length > 0)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Candidate-complete Boilerplate Selection and Binding requires exact current dependencies and one valid evidence-backed decision per current implementation unit with no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Boilerplate Selection and Binding status must expose reasons" })
  }
})

const projectionAuthorityBoundary = "boilerplate-selection-binding-projection-is-read-only-and-does-not-establish-organizational-designation-endorsement-approval-support-commitment-selection-decision-effectiveness-binding-effectiveness-compatibility-truth-or-completeness-or-validation-licensing-or-security-approval-exception-waiver-source-retrieval-import-instantiation-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const

export const boilerplateSelectionBindingProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("boilerplate-selection-binding-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  }).strict(),
  status: boilerplateSelectionBindingStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.literal("candidate"), unitDecisionCatalogDigest: digestSchema, selectionReceiptDigest: digestSchema,
    bindingReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    decisionCount: z.number().int().nonnegative().max(10_000),
    selectedCandidateCount: z.number().int().nonnegative().max(10_000),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal("projection-contains-record-identities-counts-statuses-and-unit-decision-selection-binding-assessment-snapshot-digests-only-not-boilerplate-names-locators-versions-unit-or-profile-identities-rationale-conditions-alternatives-deviations-evidence-decision-roles-personal-data-secrets-credentials-or-machine-paths"),
  authorityBoundary: z.literal(projectionAuthorityBoundary),
  snapshotDigest: digestSchema,
}).strict()

export type BoilerplateSelectionBindingInput = z.infer<typeof boilerplateSelectionBindingInputSchema>
export type BoilerplateSelectionBinding = z.infer<typeof boilerplateSelectionBindingSchema>
export type BoilerplateSelectionBindingStatus = z.infer<typeof boilerplateSelectionBindingStatusSchema>
export type BoilerplateSelectionBindingProjection = z.infer<typeof boilerplateSelectionBindingProjectionSchema>
