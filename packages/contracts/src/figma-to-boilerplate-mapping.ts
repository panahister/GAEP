import { z } from "zod"

import { exactBoilerplateCompatibilityValidationReferenceSchema } from "./boilerplate-compatibility-validation.js"
import { exactBoilerplateRegistryReferenceSchema } from "./boilerplate-registry.js"
import { exactBoilerplateSelectionBindingReferenceSchema } from "./boilerplate-selection-binding.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactDesignApplicabilityReferenceSchema } from "./design-applicability.js"
import { exactDesignBaselineCandidateReferenceSchema } from "./design-baseline.js"
import { exactDesignSystemTokenContractReferenceSchema } from "./design-system-token-contract.js"
import { exactDesignToRequirementBindingReferenceSchema } from "./design-to-requirement-binding.js"
import { exactFinalizedFigmaSnapshotImportReferenceSchema } from "./finalized-figma-snapshot-import.js"
import { exactImplementationUnitModelReferenceSchema } from "./implementation-unit-model.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactResponsiveMultiPlatformTargetsReferenceSchema } from "./responsive-multi-platform-targets.js"
import { exactTechnologyProfileReferenceSchema } from "./technology-profile.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const requirementKeySchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/)
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
    message: "Portable Figma-to-Boilerplate Mapping candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalTextListSchema = z.array(shortTextSchema).max(512)
  .refine(unique, "Values must be unique")
  .refine(canonical, "Values must use canonical lexical ordering")
const canonicalRequirementKeysSchema = z.array(requirementKeySchema).min(1).max(4_096)
  .refine(unique, "Requirement keys must be unique")
  .refine(canonical, "Requirement keys must use canonical lexical ordering")

export const figmaToBoilerplateMappingKinds = [
  "component", "layout", "platform-target", "responsive-behavior", "token",
] as const

export const figmaToBoilerplateMappingKindSchema = z.enum(figmaToBoilerplateMappingKinds)
export const figmaToBoilerplateMappingOutcomeSchema = z.enum([
  "candidate-conflict", "candidate-mapped", "candidate-unmapped", "not-assessed",
])

export const figmaToBoilerplateEvidenceReferenceSchema = z.object({
  kind: z.enum([
    "boilerplate-compatibility-validation", "boilerplate-registry", "boilerplate-selection-binding",
    "design-baseline", "design-system", "design-to-requirement", "evidence", "finalized-figma-snapshot",
    "implementation-unit", "responsive-platform", "technology-profile",
  ]),
  sourceId: shortTextSchema,
  revision: z.number().int().positive(),
  digest: digestSchema,
  evidenceState: z.enum(["candidate-asserted", "human-reviewed", "source-recorded"]),
}).strict()

const evidenceListSchema = z.array(figmaToBoilerplateEvidenceReferenceSchema).max(256).refine(
  (values) => unique(values.map((value) => `${value.kind}:${value.sourceId}:${value.revision}:${value.digest}`)),
  "Figma-to-Boilerplate evidence references must be unique",
)

export const figmaToBoilerplateMappingSubjectSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(32_768),
  designBindingKey: identifierSchema,
  designItemKey: identifierSchema,
  designItemKind: z.enum([
    "component", "component-set", "file", "prototype-flow", "style", "variable", "variable-collection",
  ]),
  mappingKind: figmaToBoilerplateMappingKindSchema,
  bindingDecisionId: z.string().uuid(),
  compatibilityValidationSubjectId: z.string().uuid(),
  implementationUnitId: z.string().uuid(),
  technologyProfileId: z.string().uuid(),
  boilerplateRegistryEntryId: z.string().uuid(),
  targetKind: z.enum([
    "component", "layout", "module", "platform-configuration", "route", "style", "symbol", "token",
  ]),
  targetCandidate: z.string().trim().min(1).max(512),
  requirementKeys: canonicalRequirementKeysSchema,
  outcome: figmaToBoilerplateMappingOutcomeSchema,
  evidenceReferences: evidenceListSchema,
  conflictReferenceCandidates: evidenceListSchema,
  mappedBy: humanActorSchema.optional(),
  mappedAt: z.string().datetime().optional(),
  mappingTruthState: z.literal("not-established"),
  mappingCompletenessState: z.literal("not-established"),
  designValidityState: z.literal("not-established"),
  generatedCodeState: z.literal("not-generated"),
  implementationAuthorityState: z.literal("not-granted"),
}).strict().superRefine((subject, context) => {
  if (subject.outcome === "candidate-mapped" &&
      (subject.evidenceReferences.length === 0 || !subject.mappedBy || !subject.mappedAt)) {
    context.addIssue({
      code: "custom", path: ["outcome"],
      message: "A mapped candidate requires exact evidence and attributable human mapping metadata",
    })
  }
  if (subject.outcome !== "candidate-mapped" && (subject.mappedBy || subject.mappedAt)) {
    context.addIssue({
      code: "custom", path: ["mappedBy"],
      message: "Only mapped candidates may carry human mapping attribution",
    })
  }
  if (subject.outcome === "candidate-conflict" && subject.conflictReferenceCandidates.length === 0) {
    context.addIssue({
      code: "custom", path: ["conflictReferenceCandidates"],
      message: "A mapping conflict candidate requires an exact conflict reference candidate",
    })
  }
})

const figmaToBoilerplateMappingInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  designApplicability: exactDesignApplicabilityReferenceSchema,
  designSystemTokenContract: exactDesignSystemTokenContractReferenceSchema,
  responsiveMultiPlatformTargets: exactResponsiveMultiPlatformTargetsReferenceSchema,
  finalizedFigmaSnapshotImport: exactFinalizedFigmaSnapshotImportReferenceSchema,
  designToRequirementBinding: exactDesignToRequirementBindingReferenceSchema,
  designBaseline: exactDesignBaselineCandidateReferenceSchema,
  implementationUnitModel: exactImplementationUnitModelReferenceSchema,
  technologyProfile: exactTechnologyProfileReferenceSchema,
  boilerplateRegistry: exactBoilerplateRegistryReferenceSchema,
  boilerplateSelectionBinding: exactBoilerplateSelectionBindingReferenceSchema,
  boilerplateCompatibilityValidation: exactBoilerplateCompatibilityValidationReferenceSchema,
  subjects: z.array(figmaToBoilerplateMappingSubjectSchema).min(1).max(32_768),
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
  selectionBindingEffectivenessState: z.literal("not-established"),
  compatibilityTruthState: z.literal("not-established"),
  sourceRetrievalState: z.literal("not-established"),
  assetImportInstantiationState: z.literal("not-established"),
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
  const subjectIds = candidate.subjects.map((subject) => subject.id)
  const designBindingKeys = candidate.subjects.map((subject) => subject.designBindingKey)
  if (!unique(subjectIds)) {
    context.addIssue({ code: "custom", path: ["subjects"], message: "Mapping subject identities must be unique" })
  }
  if (!unique(designBindingKeys)) {
    context.addIssue({ code: "custom", path: ["subjects"], message: "Each design binding may have only one mapping subject" })
  }
  for (const [index, subject] of candidate.subjects.entries()) {
    if (subject.ordinal !== index + 1) {
      context.addIssue({
        code: "custom", path: ["subjects", index, "ordinal"],
        message: "Mapping subjects must use contiguous canonical ordinal ordering",
      })
    }
  }
  if (candidate.reviewState === "ready-for-human-review" &&
      (candidate.unresolvedQuestions.length > 0 || candidate.subjects.some((subject) =>
        subject.outcome !== "candidate-mapped" || subject.evidenceReferences.length === 0 ||
        !subject.mappedBy || !subject.mappedAt))) {
    context.addIssue({
      code: "custom", path: ["reviewState"],
      message: "Review-ready Figma-to-Boilerplate Mapping requires every design binding to have an evidence-backed attributable mapped candidate with no unresolved questions",
    })
  }
})

export const figmaToBoilerplateMappingInputSchema = rejectSecrets(figmaToBoilerplateMappingInputBaseSchema)

const authorityBoundary = "figma-to-boilerplate-mapping-is-a-versioned-candidate-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-mapping-truth-or-completeness-selection-binding-effectiveness-compatibility-truth-retrieve-import-instantiate-generate-or-execute-assets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const

export const figmaToBoilerplateMappingSchema = figmaToBoilerplateMappingInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("figma-to-boilerplate-mapping-candidate"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  mappingSubjectCatalogDigest: digestSchema,
  targetCatalogDigest: digestSchema,
  traceReceiptDigest: digestSchema,
  mappingReceiptDigest: digestSchema,
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
      message: "Only Figma-to-Boilerplate Mapping revisions after revision one require an exact predecessor digest",
    })
  }
})

export const exactFigmaToBoilerplateMappingReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

const statusAuthorityBoundary = "figma-to-boilerplate-mapping-status-is-observational-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-mapping-truth-or-completeness-selection-binding-effectiveness-compatibility-truth-retrieve-import-instantiate-generate-or-execute-assets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const

export const figmaToBoilerplateMappingStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("figma-to-boilerplate-mapping-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactFigmaToBoilerplateMappingReferenceSchema.optional(),
  designApplicability: exactDesignApplicabilityReferenceSchema.optional(),
  designSystemTokenContract: exactDesignSystemTokenContractReferenceSchema.optional(),
  responsiveMultiPlatformTargets: exactResponsiveMultiPlatformTargetsReferenceSchema.optional(),
  finalizedFigmaSnapshotImport: exactFinalizedFigmaSnapshotImportReferenceSchema.optional(),
  designToRequirementBinding: exactDesignToRequirementBindingReferenceSchema.optional(),
  designBaseline: exactDesignBaselineCandidateReferenceSchema.optional(),
  implementationUnitModel: exactImplementationUnitModelReferenceSchema.optional(),
  technologyProfile: exactTechnologyProfileReferenceSchema.optional(),
  boilerplateRegistry: exactBoilerplateRegistryReferenceSchema.optional(),
  boilerplateSelectionBinding: exactBoilerplateSelectionBindingReferenceSchema.optional(),
  boilerplateCompatibilityValidation: exactBoilerplateCompatibilityValidationReferenceSchema.optional(),
  designBindingCount: z.number().int().nonnegative().max(32_768),
  subjectCount: z.number().int().nonnegative().max(32_768),
  mappedCandidateCount: z.number().int().nonnegative().max(32_768),
  conflictCandidateCount: z.number().int().nonnegative().max(32_768),
  unmappedCandidateCount: z.number().int().nonnegative().max(32_768),
  notAssessedCount: z.number().int().nonnegative().max(32_768),
  componentMappingCount: z.number().int().nonnegative().max(32_768),
  tokenMappingCount: z.number().int().nonnegative().max(32_768),
  layoutMappingCount: z.number().int().nonnegative().max(32_768),
  responsiveBehaviorMappingCount: z.number().int().nonnegative().max(32_768),
  platformTargetMappingCount: z.number().int().nonnegative().max(32_768),
  missingSubjectCount: z.number().int().nonnegative().max(32_768),
  invalidSubjectCount: z.number().int().nonnegative().max(32_768),
  targetGapCount: z.number().int().nonnegative().max(32_768),
  traceGapCount: z.number().int().nonnegative().max(32_768),
  evidenceGapCount: z.number().int().nonnegative().max(32_768),
  staleBindingCount: z.number().int().nonnegative().max(1),
  staleDependencyCount: z.number().int().nonnegative().max(11),
  invalidCandidateCount: z.number().int().nonnegative().max(1),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "candidate-complete"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict().superRefine((status, context) => {
  if (status.mappedCandidateCount + status.conflictCandidateCount + status.unmappedCandidateCount +
      status.notAssessedCount !== status.subjectCount) {
    context.addIssue({ code: "custom", path: ["subjectCount"], message: "Mapping subject outcome counts must reconcile" })
  }
  if (status.componentMappingCount + status.tokenMappingCount + status.layoutMappingCount +
      status.responsiveBehaviorMappingCount + status.platformTargetMappingCount !== status.subjectCount) {
    context.addIssue({ code: "custom", path: ["subjectCount"], message: "Mapping kind counts must reconcile" })
  }
  const gaps = status.conflictCandidateCount + status.unmappedCandidateCount + status.notAssessedCount +
    status.missingSubjectCount + status.invalidSubjectCount + status.targetGapCount + status.traceGapCount +
    status.evidenceGapCount + status.staleBindingCount + status.staleDependencyCount +
    status.invalidCandidateCount + status.unresolvedQuestionCount
  const dependencies = [
    status.designApplicability, status.designSystemTokenContract, status.responsiveMultiPlatformTargets,
    status.finalizedFigmaSnapshotImport, status.designToRequirementBinding, status.designBaseline,
    status.implementationUnitModel, status.technologyProfile, status.boilerplateRegistry,
    status.boilerplateSelectionBinding, status.boilerplateCompatibilityValidation,
  ]
  if (status.state === "candidate-complete" &&
      (gaps > 0 || !status.candidate || dependencies.some((dependency) => !dependency) ||
       status.subjectCount !== status.designBindingCount || status.mappedCandidateCount !== status.subjectCount ||
       status.reviewState !== "ready-for-human-review" || status.reasons.length > 0)) {
    context.addIssue({
      code: "custom", path: ["state"],
      message: "Candidate-complete Figma-to-Boilerplate Mapping requires exact current dependencies and complete evidence-backed mapped-candidate coverage with no structural gaps",
    })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({
      code: "custom", path: ["reasons"],
      message: "Attention-required Figma-to-Boilerplate Mapping status must expose reasons",
    })
  }
})

const projectionAuthorityBoundary = "figma-to-boilerplate-mapping-projection-is-read-only-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-mapping-truth-or-completeness-selection-binding-effectiveness-compatibility-truth-retrieve-import-instantiate-generate-or-execute-assets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const

export const figmaToBoilerplateMappingProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("figma-to-boilerplate-mapping-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  }).strict(),
  status: figmaToBoilerplateMappingStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.literal("candidate"), mappingSubjectCatalogDigest: digestSchema,
    targetCatalogDigest: digestSchema, traceReceiptDigest: digestSchema,
    mappingReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    subjectCount: z.number().int().nonnegative().max(32_768),
    mappedCandidateCount: z.number().int().nonnegative().max(32_768),
    conflictCandidateCount: z.number().int().nonnegative().max(32_768),
    unmappedCandidateCount: z.number().int().nonnegative().max(32_768),
    notAssessedCount: z.number().int().nonnegative().max(32_768),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal("projection-contains-record-identities-counts-statuses-and-subject-target-trace-mapping-assessment-snapshot-digests-only-not-figma-content-design-item-binding-unit-profile-registry-entry-validation-subject-requirement-target-locator-evidence-reviewer-personal-data-secrets-credentials-or-machine-paths"),
  authorityBoundary: z.literal(projectionAuthorityBoundary),
  snapshotDigest: digestSchema,
}).strict()

export type FigmaToBoilerplateMappingKind = z.infer<typeof figmaToBoilerplateMappingKindSchema>
export type FigmaToBoilerplateEvidenceReference = z.infer<typeof figmaToBoilerplateEvidenceReferenceSchema>
export type FigmaToBoilerplateMappingInput = z.infer<typeof figmaToBoilerplateMappingInputSchema>
export type FigmaToBoilerplateMapping = z.infer<typeof figmaToBoilerplateMappingSchema>
export type FigmaToBoilerplateMappingStatus = z.infer<typeof figmaToBoilerplateMappingStatusSchema>
export type FigmaToBoilerplateMappingProjection = z.infer<typeof figmaToBoilerplateMappingProjectionSchema>
