import { z } from "zod"

import { exactBoilerplateRegistryReferenceSchema } from "./boilerplate-registry.js"
import { exactBoilerplateSelectionBindingReferenceSchema } from "./boilerplate-selection-binding.js"
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
    message: "Portable Boilerplate Compatibility Validation candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalTextListSchema = z.array(shortTextSchema).max(512)
  .refine(unique, "Values must be unique")
  .refine(canonical, "Values must use canonical lexical ordering")

export const boilerplateCompatibilityDimensions = [
  "architecture", "build", "dependency", "deployment", "design-system", "licensing-policy",
  "packaging", "platform", "runtime", "security-privacy", "stack", "test", "toolchain", "version",
] as const

export const boilerplateCompatibilityDimensionSchema = z.enum(boilerplateCompatibilityDimensions)
export const boilerplateCompatibilityOutcomeSchema = z.enum([
  "candidate-compatible", "candidate-incompatible", "exception-candidate", "not-assessed",
])

export const boilerplateCompatibilityEvidenceReferenceSchema = z.object({
  kind: z.enum([
    "architecture", "boilerplate-registry", "boilerplate-selection-binding", "build", "dependency",
    "deployment", "design-system", "evidence", "exception-candidate", "implementation-unit",
    "license-policy", "packaging", "platform", "policy", "risk", "runtime", "security-privacy",
    "technology-profile", "test", "toolchain",
  ]),
  sourceId: shortTextSchema,
  revision: z.number().int().positive(),
  digest: digestSchema,
  evidenceState: z.enum(["candidate-asserted", "observed-not-validated"]),
}).strict()

const evidenceListSchema = z.array(boilerplateCompatibilityEvidenceReferenceSchema).max(256).refine(
  (values) => unique(values.map((value) => `${value.kind}:${value.sourceId}:${value.revision}:${value.digest}`)),
  "Boilerplate compatibility evidence references must be unique",
)

export const boilerplateCompatibilityDimensionAssessmentSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(boilerplateCompatibilityDimensions.length),
  dimension: boilerplateCompatibilityDimensionSchema,
  outcome: boilerplateCompatibilityOutcomeSchema,
  claim: shortTextSchema,
  evidenceReferences: evidenceListSchema,
  exceptionReferenceCandidates: evidenceListSchema,
  assessedBy: humanActorSchema,
  assessedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  compatibilityTruthState: z.literal("not-established"),
  approvalState: z.literal("not-established"),
  exceptionWaiverState: z.literal("not-established"),
}).strict().superRefine((assessment, context) => {
  if (assessment.outcome !== "not-assessed" && assessment.evidenceReferences.length === 0) {
    context.addIssue({
      code: "custom", path: ["evidenceReferences"],
      message: "An assessed compatibility dimension requires at least one exact evidence reference",
    })
  }
  if (assessment.outcome === "exception-candidate" && assessment.exceptionReferenceCandidates.length === 0) {
    context.addIssue({
      code: "custom", path: ["exceptionReferenceCandidates"],
      message: "An exception-candidate compatibility outcome requires an exact exception reference candidate",
    })
  }
})

export const boilerplateCompatibilitySubjectSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(10_000),
  bindingDecisionId: z.string().uuid(),
  implementationUnitId: z.string().uuid(),
  technologyProfileId: z.string().uuid(),
  boilerplateRegistryEntryId: z.string().uuid(),
  boilerplateVersionCandidate: z.string().trim().min(1).max(240),
  outcome: boilerplateCompatibilityOutcomeSchema,
  dimensionAssessments: z.array(boilerplateCompatibilityDimensionAssessmentSchema)
    .length(boilerplateCompatibilityDimensions.length),
}).strict().superRefine((subject, context) => {
  const dimensionIds = subject.dimensionAssessments.map((assessment) => assessment.id)
  const dimensions = subject.dimensionAssessments.map((assessment) => assessment.dimension)
  if (!unique(dimensionIds)) {
    context.addIssue({ code: "custom", path: ["dimensionAssessments"], message: "Dimension assessment identities must be unique" })
  }
  if (dimensions.some((dimension, index) => dimension !== boilerplateCompatibilityDimensions[index])) {
    context.addIssue({
      code: "custom", path: ["dimensionAssessments"],
      message: "Compatibility dimensions must provide complete canonical coverage",
    })
  }
  for (const [index, assessment] of subject.dimensionAssessments.entries()) {
    if (assessment.ordinal !== index + 1) {
      context.addIssue({
        code: "custom", path: ["dimensionAssessments", index, "ordinal"],
        message: "Compatibility dimensions must use contiguous canonical ordinal ordering",
      })
    }
  }
  const outcomes = subject.dimensionAssessments.map((assessment) => assessment.outcome)
  const expectedOutcome = outcomes.includes("candidate-incompatible")
    ? "candidate-incompatible"
    : outcomes.includes("not-assessed")
      ? "not-assessed"
      : outcomes.includes("exception-candidate")
        ? "exception-candidate"
        : "candidate-compatible"
  if (subject.outcome !== expectedOutcome) {
    context.addIssue({
      code: "custom", path: ["outcome"],
      message: "Subject outcome must reconcile deterministically with its dimension outcomes",
    })
  }
})

const boilerplateCompatibilityValidationInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  implementationUnitModel: exactImplementationUnitModelReferenceSchema,
  dependencyMapping: exactDependencyMappingReferenceSchema,
  technologyProfile: exactTechnologyProfileReferenceSchema,
  boilerplateRegistry: exactBoilerplateRegistryReferenceSchema,
  boilerplateSelectionBinding: exactBoilerplateSelectionBindingReferenceSchema,
  subjects: z.array(boilerplateCompatibilitySubjectSchema).max(10_000),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  compatibilityTruthState: z.literal("not-established"),
  compatibilityCompletenessState: z.literal("not-established"),
  validationDecisionState: z.literal("not-established"),
  actualAssetBehaviorState: z.literal("not-established"),
  testExecutionState: z.literal("not-established"),
  designValidityState: z.literal("not-established"),
  securityPrivacyApprovalState: z.literal("not-established"),
  licensingApprovalState: z.literal("not-established"),
  exceptionWaiverState: z.literal("not-established"),
  selectionBindingEffectivenessState: z.literal("not-established"),
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
  const subjectIds = candidate.subjects.map((subject) => subject.id)
  const bindingDecisionIds = candidate.subjects.map((subject) => subject.bindingDecisionId)
  if (!unique(subjectIds)) {
    context.addIssue({ code: "custom", path: ["subjects"], message: "Compatibility subject identities must be unique" })
  }
  if (!unique(bindingDecisionIds)) {
    context.addIssue({ code: "custom", path: ["subjects"], message: "Each selected binding decision may have only one validation subject" })
  }
  for (const [index, subject] of candidate.subjects.entries()) {
    if (subject.ordinal !== index + 1) {
      context.addIssue({
        code: "custom", path: ["subjects", index, "ordinal"],
        message: "Compatibility subjects must use contiguous canonical ordinal ordering",
      })
    }
  }
  if (candidate.reviewState === "ready-for-human-review") {
    const incomplete = candidate.subjects.some((subject) =>
      subject.outcome === "not-assessed" || subject.dimensionAssessments.some((assessment) =>
        assessment.outcome === "not-assessed" || assessment.evidenceReferences.length === 0 ||
        assessment.compatibilityTruthState !== "not-established" || assessment.approvalState !== "not-established" ||
        assessment.exceptionWaiverState !== "not-established"))
    if (candidate.unresolvedQuestions.length > 0 || incomplete) {
      context.addIssue({
        code: "custom", path: ["reviewState"],
        message: "Review-ready Boilerplate Compatibility Validation requires fully assessed evidence-backed dimensions, no unresolved questions, and no effective authority",
      })
    }
  }
})

export const boilerplateCompatibilityValidationInputSchema = rejectSecrets(
  boilerplateCompatibilityValidationInputBaseSchema,
)

const authorityBoundary = "boilerplate-compatibility-validation-is-a-versioned-candidate-and-does-not-establish-compatibility-truth-or-completeness-validation-decision-actual-asset-behavior-test-execution-design-validity-security-privacy-or-licensing-approval-exception-waiver-selection-binding-effectiveness-source-retrieval-import-instantiation-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const

export const boilerplateCompatibilityValidationSchema = boilerplateCompatibilityValidationInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("boilerplate-compatibility-validation-candidate"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  validationSubjectCatalogDigest: digestSchema,
  dimensionCatalogDigest: digestSchema,
  evidenceReceiptDigest: digestSchema,
  validationReceiptDigest: digestSchema,
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
    context.addIssue({
      code: "custom", path: ["predecessorDigest"],
      message: "Only Boilerplate Compatibility Validation revisions after revision one require an exact predecessor digest",
    })
  }
})

export const exactBoilerplateCompatibilityValidationReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

const statusAuthorityBoundary = "boilerplate-compatibility-validation-status-is-observational-and-does-not-establish-compatibility-truth-or-completeness-validation-decision-actual-asset-behavior-test-execution-design-validity-security-privacy-or-licensing-approval-exception-waiver-selection-binding-effectiveness-source-retrieval-import-instantiation-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const

export const boilerplateCompatibilityValidationStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("boilerplate-compatibility-validation-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactBoilerplateCompatibilityValidationReferenceSchema.optional(),
  implementationUnitModel: exactImplementationUnitModelReferenceSchema.optional(),
  dependencyMapping: exactDependencyMappingReferenceSchema.optional(),
  technologyProfile: exactTechnologyProfileReferenceSchema.optional(),
  boilerplateRegistry: exactBoilerplateRegistryReferenceSchema.optional(),
  boilerplateSelectionBinding: exactBoilerplateSelectionBindingReferenceSchema.optional(),
  selectedBindingCount: z.number().int().nonnegative().max(10_000),
  subjectCount: z.number().int().nonnegative().max(10_000),
  compatibleCandidateCount: z.number().int().nonnegative().max(10_000),
  incompatibleCandidateCount: z.number().int().nonnegative().max(10_000),
  exceptionCandidateCount: z.number().int().nonnegative().max(10_000),
  notAssessedCount: z.number().int().nonnegative().max(10_000),
  dimensionAssessmentCount: z.number().int().nonnegative().max(140_000),
  missingSubjectCount: z.number().int().nonnegative().max(10_000),
  invalidSubjectCount: z.number().int().nonnegative().max(10_000),
  missingDimensionCount: z.number().int().nonnegative().max(140_000),
  missingEvidenceCount: z.number().int().nonnegative().max(140_000),
  expiredAssessmentCount: z.number().int().nonnegative().max(140_000),
  conflictingOutcomeCount: z.number().int().nonnegative().max(10_000),
  selectionBindingGapCount: z.number().int().nonnegative().max(1),
  staleBindingCount: z.number().int().nonnegative().max(1),
  staleImplementationUnitModelCount: z.number().int().nonnegative().max(1),
  staleDependencyMappingCount: z.number().int().nonnegative().max(1),
  staleTechnologyProfileCount: z.number().int().nonnegative().max(1),
  staleBoilerplateRegistryCount: z.number().int().nonnegative().max(1),
  staleSelectionBindingCount: z.number().int().nonnegative().max(1),
  invalidCandidateCount: z.number().int().nonnegative().max(1),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "candidate-complete"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict().superRefine((status, context) => {
  if (status.compatibleCandidateCount + status.incompatibleCandidateCount + status.exceptionCandidateCount +
      status.notAssessedCount !== status.subjectCount) {
    context.addIssue({
      code: "custom", path: ["subjectCount"],
      message: "Boilerplate compatibility subject outcome counts must reconcile",
    })
  }
  const gaps = status.missingSubjectCount + status.invalidSubjectCount + status.missingDimensionCount +
    status.missingEvidenceCount + status.expiredAssessmentCount + status.conflictingOutcomeCount +
    status.selectionBindingGapCount +
    status.notAssessedCount + status.staleBindingCount + status.staleImplementationUnitModelCount +
    status.staleDependencyMappingCount + status.staleTechnologyProfileCount +
    status.staleBoilerplateRegistryCount + status.staleSelectionBindingCount +
    status.invalidCandidateCount + status.unresolvedQuestionCount
  if (status.state === "candidate-complete" &&
      (gaps > 0 || !status.candidate || !status.implementationUnitModel || !status.dependencyMapping ||
       !status.technologyProfile || !status.boilerplateRegistry || !status.boilerplateSelectionBinding ||
       status.subjectCount !== status.selectedBindingCount ||
       status.dimensionAssessmentCount !== status.subjectCount * boilerplateCompatibilityDimensions.length ||
       status.reviewState !== "ready-for-human-review" || status.reasons.length > 0)) {
    context.addIssue({
      code: "custom", path: ["state"],
      message: "Candidate-complete Boilerplate Compatibility Validation requires exact current dependencies and complete evidence-backed dimension coverage for every selected binding with no structural gaps",
    })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({
      code: "custom", path: ["reasons"],
      message: "Attention-required Boilerplate Compatibility Validation status must expose reasons",
    })
  }
})

const projectionAuthorityBoundary = "boilerplate-compatibility-validation-projection-is-read-only-and-does-not-establish-compatibility-truth-or-completeness-validation-decision-actual-asset-behavior-test-execution-design-validity-security-privacy-or-licensing-approval-exception-waiver-selection-binding-effectiveness-source-retrieval-import-instantiation-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const

export const boilerplateCompatibilityValidationProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("boilerplate-compatibility-validation-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  }).strict(),
  status: boilerplateCompatibilityValidationStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.literal("candidate"), validationSubjectCatalogDigest: digestSchema,
    dimensionCatalogDigest: digestSchema, evidenceReceiptDigest: digestSchema,
    validationReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    subjectCount: z.number().int().nonnegative().max(10_000),
    compatibleCandidateCount: z.number().int().nonnegative().max(10_000),
    incompatibleCandidateCount: z.number().int().nonnegative().max(10_000),
    exceptionCandidateCount: z.number().int().nonnegative().max(10_000),
    notAssessedCount: z.number().int().nonnegative().max(10_000),
    dimensionAssessmentCount: z.number().int().nonnegative().max(140_000),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal("projection-contains-record-identities-counts-statuses-and-subject-dimension-evidence-validation-assessment-snapshot-digests-only-not-boilerplate-names-locators-versions-unit-profile-entry-or-binding-identities-claims-evidence-assessors-personal-data-secrets-credentials-or-machine-paths"),
  authorityBoundary: z.literal(projectionAuthorityBoundary),
  snapshotDigest: digestSchema,
}).strict()

export type BoilerplateCompatibilityDimension = z.infer<typeof boilerplateCompatibilityDimensionSchema>
export type BoilerplateCompatibilityEvidenceReference = z.infer<typeof boilerplateCompatibilityEvidenceReferenceSchema>
export type BoilerplateCompatibilityValidationInput = z.infer<typeof boilerplateCompatibilityValidationInputSchema>
export type BoilerplateCompatibilityValidation = z.infer<typeof boilerplateCompatibilityValidationSchema>
export type BoilerplateCompatibilityValidationStatus = z.infer<typeof boilerplateCompatibilityValidationStatusSchema>
export type BoilerplateCompatibilityValidationProjection = z.infer<typeof boilerplateCompatibilityValidationProjectionSchema>
