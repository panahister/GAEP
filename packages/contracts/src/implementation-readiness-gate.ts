import { z } from "zod"

import { exactAcceptanceCriteriaReferenceSchema } from "./acceptance-criteria.js"
import { exactBacklogHierarchyReferenceSchema } from "./backlog-hierarchy.js"
import { exactBoilerplateCompatibilityValidationReferenceSchema } from "./boilerplate-compatibility-validation.js"
import { exactBoilerplateRegistryReferenceSchema } from "./boilerplate-registry.js"
import { exactBoilerplateSelectionBindingReferenceSchema } from "./boilerplate-selection-binding.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactDefinitionOfDoneReferenceSchema } from "./definition-of-done.js"
import { exactDefinitionOfReadyReferenceSchema } from "./definition-of-ready.js"
import { exactDependencyMappingReferenceSchema } from "./dependency-mapping.js"
import { exactDesignBaselineReferenceSchema } from "./design-baseline.js"
import { exactDesignToCodeBindingRegistryReferenceSchema } from "./design-to-code-binding-registry.js"
import { exactHighLevelDesignReferenceSchema } from "./high-level-design.js"
import { exactImplementationUnitModelReferenceSchema } from "./implementation-unit-model.js"
import { exactLowLevelDesignReferenceSchema } from "./low-level-design.js"
import { exactMvpSliceDefinitionReferenceSchema } from "./mvp-slice-definition.js"
import { exactPrioritizationModelReferenceSchema } from "./prioritization-model.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactRiskRegisterReferenceSchema } from "./risk-register.js"
import { exactRouteScreenComponentMappingReferenceSchema } from "./route-screen-component-mapping.js"
import { exactSecurityPrivacyAssessmentReferenceSchema } from "./security-privacy-assessment.js"
import { exactTechnologyProfileReferenceSchema } from "./technology-profile.js"
import { exactTestInventoryReferenceSchema } from "./test-inventory.js"
import { exactTestMethodologyReferenceSchema } from "./test-methodology.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()
const exactReferenceSchema = z.object({ recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict()

function unique(values: readonly string[]): boolean { return new Set(values).size === values.length }
function canonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}
function canonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 32_768) {
  return z.array(schema).max(maximum)
    .refine((values) => unique(values.map((value) => String(value))), "Values must be unique")
    .refine((values) => canonical(values.map((value) => String(value))), "Values must use canonical lexical ordering")
}
function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Implementation Readiness Gate candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const implementationReadinessOutcomeSchema = z.enum([
  "satisfied", "gap", "conflict", "stale", "waived-candidate", "not-assessed",
])
export const implementationReadinessDimensionSchema = z.enum([
  "acceptance", "backlog", "boilerplate", "dependencies", "design", "ownership", "risk", "security-privacy", "technology", "testing",
])
export const implementationReadinessEvidenceReferenceSchema = z.object({
  kind: z.enum(["artifact", "decision", "evidence", "review"]),
  sourceId: shortTextSchema,
  revision: z.number().int().positive(),
  digest: digestSchema,
  evidenceState: z.enum(["candidate-asserted", "human-reviewed", "source-recorded"]),
}).strict()
const evidenceListSchema = z.array(implementationReadinessEvidenceReferenceSchema).max(2_048).refine(
  (values) => unique(values.map((value) => `${value.kind}:${value.sourceId}:${value.revision}:${value.digest}`)),
  "Implementation readiness evidence references must be unique",
)

export const implementationReadinessDimensionAssessmentSchema = z.object({
  dimension: implementationReadinessDimensionSchema,
  outcome: implementationReadinessOutcomeSchema,
  evidenceReferences: evidenceListSchema,
  reviewCandidateIds: canonicalList(shortTextSchema, 512),
  rationaleCandidate: shortTextSchema,
  conflictReferenceCandidates: evidenceListSchema,
  waiverReferenceCandidates: evidenceListSchema,
}).strict().superRefine((entry, context) => {
  if (entry.outcome === "satisfied" && entry.evidenceReferences.length === 0) context.addIssue({ code: "custom", path: ["evidenceReferences"], message: "Satisfied candidate outcomes require evidence" })
  if (entry.outcome === "conflict" && entry.conflictReferenceCandidates.length === 0) context.addIssue({ code: "custom", path: ["conflictReferenceCandidates"], message: "Conflict outcomes require exact conflict candidates" })
  if (entry.outcome === "waived-candidate" && entry.waiverReferenceCandidates.length === 0) context.addIssue({ code: "custom", path: ["waiverReferenceCandidates"], message: "Waived candidate outcomes require exact waiver candidates" })
})

export const implementationReadinessSubjectSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(65_536),
  implementationUnitId: z.string().uuid(),
  lowLevelDesign: exactLowLevelDesignReferenceSchema,
  assessments: z.array(implementationReadinessDimensionAssessmentSchema).length(10),
  outcome: implementationReadinessOutcomeSchema,
  ownerCandidateIds: canonicalList(shortTextSchema, 512),
  evidenceReferences: evidenceListSchema,
  reviewCandidateIds: canonicalList(shortTextSchema, 512),
}).strict().superRefine((subject, context) => {
  const dimensions = subject.assessments.map((entry) => entry.dimension)
  if (!unique(dimensions) || !canonical(dimensions)) context.addIssue({ code: "custom", path: ["assessments"], message: "Every canonical readiness dimension must occur once in lexical order" })
  const outcomes = subject.assessments.map((entry) => entry.outcome)
  if (subject.outcome === "satisfied" && outcomes.some((outcome) => outcome !== "satisfied")) context.addIssue({ code: "custom", path: ["outcome"], message: "A satisfied subject requires all dimensions to be candidate-satisfied" })
  if (subject.outcome === "waived-candidate" && !outcomes.includes("waived-candidate")) context.addIssue({ code: "custom", path: ["outcome"], message: "A waived subject requires a waived dimension candidate" })
})

const dependencyShape = {
  backlogHierarchy: exactBacklogHierarchyReferenceSchema,
  mvpSliceDefinition: exactMvpSliceDefinitionReferenceSchema,
  prioritizationModel: exactPrioritizationModelReferenceSchema,
  acceptanceCriteria: exactAcceptanceCriteriaReferenceSchema,
  definitionOfReady: exactDefinitionOfReadyReferenceSchema,
  definitionOfDone: exactDefinitionOfDoneReferenceSchema,
  implementationUnitModel: exactImplementationUnitModelReferenceSchema,
  dependencyMapping: exactDependencyMappingReferenceSchema,
  technologyProfile: exactTechnologyProfileReferenceSchema,
  boilerplateRegistry: exactBoilerplateRegistryReferenceSchema,
  boilerplateSelectionBinding: exactBoilerplateSelectionBindingReferenceSchema,
  boilerplateCompatibilityValidation: exactBoilerplateCompatibilityValidationReferenceSchema,
  designBaseline: exactDesignBaselineReferenceSchema,
  designToCodeBindingRegistry: exactDesignToCodeBindingRegistryReferenceSchema,
  routeScreenComponentMapping: exactRouteScreenComponentMappingReferenceSchema,
  testMethodology: exactTestMethodologyReferenceSchema,
  testInventory: exactTestInventoryReferenceSchema,
  highLevelDesign: exactHighLevelDesignReferenceSchema,
  riskRegister: exactRiskRegisterReferenceSchema,
  securityPrivacyAssessment: exactSecurityPrivacyAssessmentReferenceSchema,
} as const

const inputBaseSchema = z.object({
  initiativeId: z.string().uuid(), context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema, title: z.string().trim().min(2).max(240),
  ...dependencyShape,
  subjects: z.array(implementationReadinessSubjectSchema).min(1).max(65_536),
  unresolvedQuestions: canonicalList(shortTextSchema, 512),
  limitations: canonicalList(shortTextSchema, 512).refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  readinessDecisionState: z.literal("not-established"), waiverDecisionState: z.literal("not-established"),
  ownershipAppointmentState: z.literal("not-established"), acceptanceDecisionState: z.literal("not-established"),
  releaseReadinessState: z.literal("not-established"), deploymentReadinessState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  const ids = candidate.subjects.map((subject) => subject.id)
  const units = candidate.subjects.map((subject) => subject.implementationUnitId)
  if (!unique(ids) || !unique(units)) context.addIssue({ code: "custom", path: ["subjects"], message: "Readiness subject and Implementation Unit identities must be unique" })
  candidate.subjects.forEach((subject, index) => {
    if (subject.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["subjects", index, "ordinal"], message: "Readiness subjects must use contiguous canonical ordinal ordering" })
  })
  if (candidate.reviewState === "ready-for-human-review" && candidate.unresolvedQuestions.length > 0) context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready candidates cannot retain unresolved questions" })
})

export const implementationReadinessGateInputSchema = rejectSecrets(inputBaseSchema)
const authorityBoundary = "implementation-readiness-gate-is-a-versioned-candidate-assessment-and-does-not-establish-artifact-or-evidence-truth-completeness-approval-waiver-owner-appointment-implementation-readiness-assignment-execution-acceptance-release-deployment-or-action-authority" as const
export const implementationReadinessGateSchema = implementationReadinessGateInputSchema.safeExtend({
  schemaVersion: z.literal(1), kind: z.literal("implementation-readiness-gate-candidate"), id: z.string().uuid(), productId: z.string().uuid(),
  revision: z.number().int().positive(), dependencyReceiptDigest: digestSchema, coverageReceiptDigest: digestSchema,
  evidenceReceiptDigest: digestSchema, ownershipReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
  predecessorDigest: digestSchema.optional(), state: z.literal("candidate"), createdBy: humanActorSchema, updatedBy: humanActorSchema,
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(), authorityBoundary: z.literal(authorityBoundary),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only revisions after revision one require an exact predecessor digest" })
})

export const exactImplementationReadinessGateReferenceSchema = exactReferenceSchema
const statusAuthorityBoundary = "implementation-readiness-gate-status-is-observational-and-does-not-establish-artifact-or-evidence-truth-completeness-approval-waiver-owner-appointment-implementation-readiness-assignment-execution-acceptance-release-deployment-or-action-authority" as const
export const implementationReadinessGateStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("implementation-readiness-gate-status"), productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(), candidate: exactReferenceSchema.optional(),
  backlogHierarchy: exactBacklogHierarchyReferenceSchema.optional(), mvpSliceDefinition: exactMvpSliceDefinitionReferenceSchema.optional(),
  prioritizationModel: exactPrioritizationModelReferenceSchema.optional(), acceptanceCriteria: exactAcceptanceCriteriaReferenceSchema.optional(),
  definitionOfReady: exactDefinitionOfReadyReferenceSchema.optional(), definitionOfDone: exactDefinitionOfDoneReferenceSchema.optional(),
  implementationUnitModel: exactImplementationUnitModelReferenceSchema.optional(), dependencyMapping: exactDependencyMappingReferenceSchema.optional(),
  technologyProfile: exactTechnologyProfileReferenceSchema.optional(), boilerplateRegistry: exactBoilerplateRegistryReferenceSchema.optional(),
  boilerplateSelectionBinding: exactBoilerplateSelectionBindingReferenceSchema.optional(),
  boilerplateCompatibilityValidation: exactBoilerplateCompatibilityValidationReferenceSchema.optional(), designBaseline: exactDesignBaselineReferenceSchema.optional(),
  designToCodeBindingRegistry: exactDesignToCodeBindingRegistryReferenceSchema.optional(), routeScreenComponentMapping: exactRouteScreenComponentMappingReferenceSchema.optional(),
  testMethodology: exactTestMethodologyReferenceSchema.optional(), testInventory: exactTestInventoryReferenceSchema.optional(),
  highLevelDesign: exactHighLevelDesignReferenceSchema.optional(), riskRegister: exactRiskRegisterReferenceSchema.optional(),
  securityPrivacyAssessment: exactSecurityPrivacyAssessmentReferenceSchema.optional(),
  lowLevelDesigns: z.array(z.object({ implementationUnitId: z.string().uuid(), reference: exactLowLevelDesignReferenceSchema }).strict()).max(65_536),
  dependencyCount: z.number().int().nonnegative(), presentDependencyCount: z.number().int().nonnegative(), subjectCount: z.number().int().nonnegative(),
  satisfiedCount: z.number().int().nonnegative(), gapCount: z.number().int().nonnegative(), conflictCount: z.number().int().nonnegative(),
  staleCount: z.number().int().nonnegative(), waivedCandidateCount: z.number().int().nonnegative(), notAssessedCount: z.number().int().nonnegative(),
  evidenceGapCount: z.number().int().nonnegative(), ownershipGapCount: z.number().int().nonnegative(), coverageGapCount: z.number().int().nonnegative(),
  staleBindingCount: z.number().int().nonnegative(), staleDependencyCount: z.number().int().nonnegative(), invalidCandidateCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative(), reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "candidate-assessed"]), reasons: z.array(shortTextSchema).max(2_048), assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict().superRefine((status, context) => {
  const gaps = status.dependencyCount - status.presentDependencyCount + status.gapCount + status.conflictCount + status.staleCount + status.notAssessedCount + status.evidenceGapCount + status.ownershipGapCount + status.coverageGapCount + status.staleBindingCount + status.staleDependencyCount + status.invalidCandidateCount + status.unresolvedQuestionCount
  if (status.state === "candidate-assessed" && (gaps > 0 || !status.candidate || status.reviewState !== "ready-for-human-review" || status.reasons.length > 0 || status.lowLevelDesigns.length !== status.subjectCount)) context.addIssue({ code: "custom", path: ["state"], message: "Candidate-assessed readiness requires exact dependencies, complete per-unit assessment, evidence, ownership candidates, and human-review candidacy" })
  if (status.state === "attention-required" && status.reasons.length === 0) context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required readiness must expose reasons" })
})

const projectionAuthorityBoundary = "implementation-readiness-gate-projection-is-read-only-and-does-not-establish-artifact-or-evidence-truth-completeness-approval-waiver-owner-appointment-implementation-readiness-assignment-execution-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-counts-statuses-and-dependency-coverage-evidence-ownership-assessment-digests-only-not-readiness-rationales-evidence-content-review-content-owner-details-personal-data-secrets-credentials-or-machine-paths" as const
export const implementationReadinessGateProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("implementation-readiness-gate-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: implementationReadinessGateStatusSchema,
  candidate: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.literal("candidate"),
    dependencyReceiptDigest: digestSchema, coverageReceiptDigest: digestSchema, evidenceReceiptDigest: digestSchema,
    ownershipReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema, subjectCount: z.number().int().nonnegative(),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime() }).strict().optional(),
  observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary), authorityBoundary: z.literal(projectionAuthorityBoundary), snapshotDigest: digestSchema,
}).strict()

export type ImplementationReadinessGateInput = z.infer<typeof implementationReadinessGateInputSchema>
export type ImplementationReadinessGate = z.infer<typeof implementationReadinessGateSchema>
export type ImplementationReadinessGateStatus = z.infer<typeof implementationReadinessGateStatusSchema>
export type ImplementationReadinessGateProjection = z.infer<typeof implementationReadinessGateProjectionSchema>
