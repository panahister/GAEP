import { z } from "zod"

import { exactBoilerplateCompatibilityValidationReferenceSchema } from "./boilerplate-compatibility-validation.js"
import { exactBoilerplateSelectionBindingReferenceSchema } from "./boilerplate-selection-binding.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactDesignBaselineCandidateReferenceSchema } from "./design-baseline.js"
import { exactDesignToRequirementBindingReferenceSchema } from "./design-to-requirement-binding.js"
import { exactFigmaToBoilerplateMappingReferenceSchema, figmaToBoilerplateMappingKindSchema } from "./figma-to-boilerplate-mapping.js"
import { exactFinalizedFigmaSnapshotImportReferenceSchema } from "./finalized-figma-snapshot-import.js"
import { exactImplementationUnitModelReferenceSchema } from "./implementation-unit-model.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactTechnologyProfileReferenceSchema } from "./technology-profile.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const requirementKeySchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()
const relativePathSchema = z.string().trim().min(1).max(512).superRefine((value, context) => {
  if (value.startsWith("/") || value.startsWith("\\") || /^[A-Za-z]:/u.test(value) ||
      value.includes("\\") || value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    context.addIssue({ code: "custom", message: "Code target path candidates must be normalized repository-relative paths" })
  }
})

function unique(values: readonly string[]): boolean { return new Set(values).size === values.length }
function canonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}
function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Design-to-Code Binding Registry candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalTextListSchema = z.array(shortTextSchema).max(512)
  .refine(unique, "Values must be unique").refine(canonical, "Values must use canonical lexical ordering")
const canonicalRequirementKeysSchema = z.array(requirementKeySchema).min(1).max(4_096)
  .refine(unique, "Requirement keys must be unique")
  .refine(canonical, "Requirement keys must use canonical lexical ordering")

export const designToCodeBindingKinds = [
  "component", "configuration", "layout", "module", "route", "style", "symbol", "test-hook", "token",
] as const
export const designToCodeBindingKindSchema = z.enum(designToCodeBindingKinds)
export const designToCodeBindingDispositionSchema = z.enum([
  "candidate-bound", "candidate-conflict", "candidate-unbound", "not-assessed",
])

export const designToCodeBindingEvidenceReferenceSchema = z.object({
  kind: z.enum([
    "boilerplate-compatibility-validation", "boilerplate-selection-binding", "design-baseline",
    "design-to-requirement", "evidence", "figma-to-boilerplate-mapping", "finalized-figma-snapshot",
    "implementation-unit", "repository-observation", "technology-profile", "test-inventory",
  ]),
  sourceId: shortTextSchema,
  revision: z.number().int().positive(),
  digest: digestSchema,
  evidenceState: z.enum(["candidate-asserted", "human-reviewed", "source-recorded"]),
}).strict()

const evidenceListSchema = z.array(designToCodeBindingEvidenceReferenceSchema).max(256).refine(
  (values) => unique(values.map((value) => `${value.kind}:${value.sourceId}:${value.revision}:${value.digest}`)),
  "Design-to-Code Binding evidence references must be unique",
)

export const designToCodeBindingSubjectSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(32_768),
  mappingSubjectId: z.string().uuid(),
  designBindingKey: identifierSchema,
  designItemKey: identifierSchema,
  designItemKind: z.enum([
    "component", "component-set", "file", "prototype-flow", "style", "variable", "variable-collection",
  ]),
  mappingKind: figmaToBoilerplateMappingKindSchema,
  bindingKind: designToCodeBindingKindSchema,
  implementationUnitId: z.string().uuid(),
  requirementKeys: canonicalRequirementKeysSchema,
  repositoryCandidate: identifierSchema,
  moduleCandidate: identifierSchema,
  pathCandidate: relativePathSchema,
  symbolCandidate: z.string().trim().min(1).max(512).optional(),
  disposition: designToCodeBindingDispositionSchema,
  evidenceReferences: evidenceListSchema,
  conflictReferenceCandidates: evidenceListSchema,
  boundBy: humanActorSchema.optional(),
  boundAt: z.string().datetime().optional(),
  repositoryTruthState: z.literal("not-established"),
  pathSymbolTruthState: z.literal("not-established"),
  bindingTruthState: z.literal("not-established"),
  bindingCompletenessState: z.literal("not-established"),
  codeMutationState: z.literal("not-performed"),
  implementationAuthorityState: z.literal("not-granted"),
}).strict().superRefine((subject, context) => {
  if (subject.disposition === "candidate-bound" &&
      (subject.evidenceReferences.length === 0 || !subject.boundBy || !subject.boundAt)) {
    context.addIssue({ code: "custom", path: ["disposition"], message: "A bound candidate requires exact evidence and attributable human binding metadata" })
  }
  if (subject.disposition !== "candidate-bound" && (subject.boundBy || subject.boundAt)) {
    context.addIssue({ code: "custom", path: ["boundBy"], message: "Only bound candidates may carry human binding attribution" })
  }
  if (subject.disposition === "candidate-conflict" && subject.conflictReferenceCandidates.length === 0) {
    context.addIssue({ code: "custom", path: ["conflictReferenceCandidates"], message: "A binding conflict candidate requires an exact conflict reference candidate" })
  }
})

const designToCodeBindingRegistryInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  designBaseline: exactDesignBaselineCandidateReferenceSchema,
  finalizedFigmaSnapshotImport: exactFinalizedFigmaSnapshotImportReferenceSchema,
  designToRequirementBinding: exactDesignToRequirementBindingReferenceSchema,
  figmaToBoilerplateMapping: exactFigmaToBoilerplateMappingReferenceSchema,
  implementationUnitModel: exactImplementationUnitModelReferenceSchema,
  technologyProfile: exactTechnologyProfileReferenceSchema,
  boilerplateSelectionBinding: exactBoilerplateSelectionBindingReferenceSchema,
  boilerplateCompatibilityValidation: exactBoilerplateCompatibilityValidationReferenceSchema,
  subjects: z.array(designToCodeBindingSubjectSchema).min(1).max(32_768),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema.refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  figmaConnectionState: z.literal("not-connected"),
  returnedFigmaContentState: z.literal("not-established"),
  designValidityState: z.literal("not-established"),
  designApprovalState: z.literal("not-established"),
  designBaselineDesignationState: z.literal("not-established"),
  mappingTruthState: z.literal("not-established"),
  mappingCompletenessState: z.literal("not-established"),
  bindingTruthState: z.literal("not-established"),
  bindingCompletenessState: z.literal("not-established"),
  repositoryTruthState: z.literal("not-established"),
  pathSymbolTruthState: z.literal("not-established"),
  codeTargetMutationState: z.literal("not-performed"),
  codeGenerationState: z.literal("not-performed"),
  implementationReadinessState: z.literal("not-established"),
  implementationCompletenessState: z.literal("not-established"),
  assignmentExecutionState: z.literal("not-established"),
  acceptanceDecisionState: z.literal("not-established"),
  mergeReadinessState: z.literal("not-established"),
  releaseReadinessState: z.literal("not-established"),
  deploymentReadinessState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  if (!unique(candidate.subjects.map((subject) => subject.id))) {
    context.addIssue({ code: "custom", path: ["subjects"], message: "Binding subject identities must be unique" })
  }
  if (!unique(candidate.subjects.map((subject) => subject.mappingSubjectId))) {
    context.addIssue({ code: "custom", path: ["subjects"], message: "Each mapping subject may have only one design-to-code binding subject" })
  }
  for (const [index, subject] of candidate.subjects.entries()) {
    if (subject.ordinal !== index + 1) {
      context.addIssue({ code: "custom", path: ["subjects", index, "ordinal"], message: "Binding subjects must use contiguous canonical ordinal ordering" })
    }
  }
  if (candidate.reviewState === "ready-for-human-review" &&
      (candidate.unresolvedQuestions.length > 0 || candidate.subjects.some((subject) =>
        subject.disposition !== "candidate-bound" || subject.evidenceReferences.length === 0 ||
        !subject.boundBy || !subject.boundAt))) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready Design-to-Code Binding Registry requires every mapping subject to have an evidence-backed attributable bound candidate with no unresolved questions" })
  }
})

export const designToCodeBindingRegistryInputSchema = rejectSecrets(designToCodeBindingRegistryInputBaseSchema)

const authorityBoundary = "design-to-code-binding-registry-is-a-versioned-candidate-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-mapping-or-binding-truth-or-completeness-repository-path-or-symbol-truth-create-or-change-code-targets-retrieve-import-instantiate-generate-or-execute-assets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const

export const designToCodeBindingRegistrySchema = designToCodeBindingRegistryInputSchema.safeExtend({
  schemaVersion: z.literal(1), kind: z.literal("design-to-code-binding-registry-candidate"),
  id: z.string().uuid(), productId: z.string().uuid(), revision: z.number().int().positive(),
  bindingSubjectCatalogDigest: digestSchema, codeTargetCatalogDigest: digestSchema,
  traceReceiptDigest: digestSchema, bindingReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
  predecessorDigest: digestSchema.optional(), state: z.literal("candidate"),
  createdBy: humanActorSchema, updatedBy: humanActorSchema,
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(), authorityBoundary: z.literal(authorityBoundary),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Design-to-Code Binding Registry revisions after revision one require an exact predecessor digest" })
  }
})

export const exactDesignToCodeBindingRegistryReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

const statusAuthorityBoundary = "design-to-code-binding-registry-status-is-observational-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-mapping-or-binding-truth-or-completeness-repository-path-or-symbol-truth-create-or-change-code-targets-retrieve-import-instantiate-generate-or-execute-assets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const

export const designToCodeBindingRegistryStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("design-to-code-binding-registry-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactDesignToCodeBindingRegistryReferenceSchema.optional(),
  designBaseline: exactDesignBaselineCandidateReferenceSchema.optional(),
  finalizedFigmaSnapshotImport: exactFinalizedFigmaSnapshotImportReferenceSchema.optional(),
  designToRequirementBinding: exactDesignToRequirementBindingReferenceSchema.optional(),
  figmaToBoilerplateMapping: exactFigmaToBoilerplateMappingReferenceSchema.optional(),
  implementationUnitModel: exactImplementationUnitModelReferenceSchema.optional(),
  technologyProfile: exactTechnologyProfileReferenceSchema.optional(),
  boilerplateSelectionBinding: exactBoilerplateSelectionBindingReferenceSchema.optional(),
  boilerplateCompatibilityValidation: exactBoilerplateCompatibilityValidationReferenceSchema.optional(),
  mappingSubjectCount: z.number().int().nonnegative().max(32_768),
  subjectCount: z.number().int().nonnegative().max(32_768),
  boundCandidateCount: z.number().int().nonnegative().max(32_768),
  conflictCandidateCount: z.number().int().nonnegative().max(32_768),
  unboundCandidateCount: z.number().int().nonnegative().max(32_768),
  notAssessedCount: z.number().int().nonnegative().max(32_768),
  missingSubjectCount: z.number().int().nonnegative().max(32_768),
  invalidSubjectCount: z.number().int().nonnegative().max(32_768),
  targetGapCount: z.number().int().nonnegative().max(32_768),
  traceGapCount: z.number().int().nonnegative().max(32_768),
  evidenceGapCount: z.number().int().nonnegative().max(32_768),
  duplicateTargetCount: z.number().int().nonnegative().max(32_768),
  staleBindingCount: z.number().int().nonnegative().max(1),
  staleDependencyCount: z.number().int().nonnegative().max(8),
  invalidCandidateCount: z.number().int().nonnegative().max(1),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "candidate-complete"]),
  reasons: z.array(shortTextSchema).max(1_024), assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict().superRefine((status, context) => {
  if (status.boundCandidateCount + status.conflictCandidateCount + status.unboundCandidateCount +
      status.notAssessedCount !== status.subjectCount) {
    context.addIssue({ code: "custom", path: ["subjectCount"], message: "Binding subject disposition counts must reconcile" })
  }
  const gaps = status.conflictCandidateCount + status.unboundCandidateCount + status.notAssessedCount +
    status.missingSubjectCount + status.invalidSubjectCount + status.targetGapCount + status.traceGapCount +
    status.evidenceGapCount + status.duplicateTargetCount + status.staleBindingCount +
    status.staleDependencyCount + status.invalidCandidateCount + status.unresolvedQuestionCount
  const dependencies = [status.designBaseline, status.finalizedFigmaSnapshotImport, status.designToRequirementBinding,
    status.figmaToBoilerplateMapping, status.implementationUnitModel, status.technologyProfile,
    status.boilerplateSelectionBinding, status.boilerplateCompatibilityValidation]
  if (status.state === "candidate-complete" &&
      (gaps > 0 || !status.candidate || dependencies.some((dependency) => !dependency) ||
       status.subjectCount !== status.mappingSubjectCount || status.boundCandidateCount !== status.subjectCount ||
       status.reviewState !== "ready-for-human-review" || status.reasons.length > 0)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Candidate-complete Design-to-Code Binding Registry requires exact current dependencies and complete evidence-backed bound-candidate coverage with no structural gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Design-to-Code Binding Registry status must expose reasons" })
  }
})

const projectionAuthorityBoundary = "design-to-code-binding-registry-projection-is-read-only-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-mapping-or-binding-truth-or-completeness-repository-path-or-symbol-truth-create-or-change-code-targets-retrieve-import-instantiate-generate-or-execute-assets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-counts-statuses-and-subject-target-trace-binding-assessment-snapshot-digests-only-not-figma-content-design-item-mapping-unit-requirement-repository-module-path-symbol-evidence-reviewer-personal-data-secrets-credentials-or-machine-paths" as const

export const designToCodeBindingRegistryProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("design-to-code-binding-registry-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: designToCodeBindingRegistryStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.literal("candidate"),
    bindingSubjectCatalogDigest: digestSchema, codeTargetCatalogDigest: digestSchema,
    traceReceiptDigest: digestSchema, bindingReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    subjectCount: z.number().int().nonnegative().max(32_768),
    boundCandidateCount: z.number().int().nonnegative().max(32_768),
    conflictCandidateCount: z.number().int().nonnegative().max(32_768),
    unboundCandidateCount: z.number().int().nonnegative().max(32_768),
    notAssessedCount: z.number().int().nonnegative().max(32_768),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary),
  authorityBoundary: z.literal(projectionAuthorityBoundary), snapshotDigest: digestSchema,
}).strict()

export type DesignToCodeBindingKind = z.infer<typeof designToCodeBindingKindSchema>
export type DesignToCodeBindingEvidenceReference = z.infer<typeof designToCodeBindingEvidenceReferenceSchema>
export type DesignToCodeBindingRegistryInput = z.infer<typeof designToCodeBindingRegistryInputSchema>
export type DesignToCodeBindingRegistry = z.infer<typeof designToCodeBindingRegistrySchema>
export type DesignToCodeBindingRegistryStatus = z.infer<typeof designToCodeBindingRegistryStatusSchema>
export type DesignToCodeBindingRegistryProjection = z.infer<typeof designToCodeBindingRegistryProjectionSchema>
