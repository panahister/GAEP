import { z } from "zod"

import { exactBoilerplateCompatibilityValidationReferenceSchema } from "./boilerplate-compatibility-validation.js"
import { exactBoilerplateRegistryReferenceSchema } from "./boilerplate-registry.js"
import { exactBoilerplateSelectionBindingReferenceSchema } from "./boilerplate-selection-binding.js"
import { exactBoundedContextModelReferenceSchema } from "./bounded-context-model.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactDependencyMappingReferenceSchema } from "./dependency-mapping.js"
import { exactDesignBaselineReferenceSchema } from "./design-baseline.js"
import { exactDesignToCodeBindingRegistryReferenceSchema } from "./design-to-code-binding-registry.js"
import { exactImplementationUnitModelReferenceSchema } from "./implementation-unit-model.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactRiskRegisterReferenceSchema } from "./risk-register.js"
import { exactRouteScreenComponentMappingReferenceSchema } from "./route-screen-component-mapping.js"
import { exactSecurityPrivacyAssessmentReferenceSchema } from "./security-privacy-assessment.js"
import { exactSystemSolutionArchitectureReferenceSchema } from "./system-solution-architecture.js"
import { exactTechnologyProfileReferenceSchema } from "./technology-profile.js"
import { exactTestInventoryReferenceSchema } from "./test-inventory.js"
import { exactTestMethodologyReferenceSchema } from "./test-methodology.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()

function unique(values: readonly string[]): boolean { return new Set(values).size === values.length }
function canonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}
function canonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 32_768) {
  return z.array(schema).max(maximum)
    .refine((values) => unique(values as string[]), "Values must be unique")
    .refine((values) => canonical(values as string[]), "Values must use canonical lexical ordering")
}
function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable High-Level Design candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalIdentifiersSchema = canonicalList(identifierSchema)
const requiredCanonicalIdentifiersSchema = canonicalIdentifiersSchema
  .refine((values) => values.length > 0, "At least one identifier is required")
const canonicalUuidsSchema = canonicalList(z.string().uuid())
const requiredCanonicalUuidsSchema = canonicalUuidsSchema
  .refine((values) => values.length > 0, "At least one record identity is required")
const canonicalTextListSchema = canonicalList(shortTextSchema, 512)

export const highLevelDesignElementKindSchema = z.enum([
  "component", "container", "context", "data-store", "deployment-node", "external-system", "interface", "trust-boundary",
])
export const highLevelDesignRelationKindSchema = z.enum([
  "calls", "contains", "deploys-to", "emits", "reads", "routes-to", "trust-crossing", "writes",
])
export const highLevelDesignDispositionSchema = z.enum([
  "candidate-defined", "candidate-conflict", "candidate-missing", "deferred", "not-assessed",
])

export const highLevelDesignEvidenceReferenceSchema = z.object({
  kind: z.enum([
    "architecture", "boilerplate", "bounded-context", "dependency", "design-binding", "evidence", "implementation-unit",
    "risk", "route-screen-component", "security-privacy", "technology", "test-inventory", "test-methodology",
  ]),
  sourceId: shortTextSchema,
  revision: z.number().int().positive(),
  digest: digestSchema,
  evidenceState: z.enum(["candidate-asserted", "human-reviewed", "source-recorded"]),
}).strict()

const evidenceListSchema = z.array(highLevelDesignEvidenceReferenceSchema).max(1_024).refine(
  (values) => unique(values.map((value) => `${value.kind}:${value.sourceId}:${value.revision}:${value.digest}`)),
  "High-Level Design evidence references must be unique",
)

export const highLevelDesignElementSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(65_536),
  key: identifierSchema,
  kind: highLevelDesignElementKindSchema,
  title: z.string().trim().min(2).max(240),
  responsibility: shortTextSchema,
  boundedContextKeys: canonicalIdentifiersSchema,
  implementationUnitIds: requiredCanonicalUuidsSchema,
  technologySelectionKeys: canonicalIdentifiersSchema,
  boilerplateEntryIds: canonicalUuidsSchema,
  routeScreenComponentSubjectIds: canonicalUuidsSchema,
  testInventoryAssetIds: canonicalUuidsSchema,
  riskKeys: canonicalIdentifiersSchema,
  ownerCandidateIds: canonicalTextListSchema,
  disposition: highLevelDesignDispositionSchema,
  evidenceReferences: evidenceListSchema,
  conflictReferenceCandidates: evidenceListSchema,
  designedBy: humanActorSchema.optional(),
  designedAt: z.string().datetime().optional(),
}).strict().superRefine((element, context) => {
  if (element.disposition === "candidate-defined" &&
      (element.evidenceReferences.length === 0 || element.ownerCandidateIds.length === 0 || !element.designedBy || !element.designedAt)) {
    context.addIssue({ code: "custom", path: ["disposition"], message: "A defined HLD element requires evidence, owner candidates, and attribution" })
  }
  if (element.disposition !== "candidate-defined" && (element.designedBy || element.designedAt)) {
    context.addIssue({ code: "custom", path: ["designedBy"], message: "Only defined HLD elements may carry design attribution" })
  }
  if (element.disposition === "candidate-conflict" && element.conflictReferenceCandidates.length === 0) {
    context.addIssue({ code: "custom", path: ["conflictReferenceCandidates"], message: "A design conflict requires an exact conflict reference candidate" })
  }
})

export const highLevelDesignRelationSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(65_536),
  key: identifierSchema,
  kind: highLevelDesignRelationKindSchema,
  fromElementId: z.string().uuid(),
  toElementId: z.string().uuid(),
  interfaceContractCandidate: shortTextSchema,
  dataFlowCandidate: shortTextSchema,
  trustBoundaryCandidate: z.enum(["crosses-boundary", "does-not-cross", "not-assessed"]),
  failureBehaviorCandidate: shortTextSchema,
  disposition: highLevelDesignDispositionSchema,
  evidenceReferences: evidenceListSchema,
}).strict().superRefine((relation, context) => {
  if (relation.fromElementId === relation.toElementId) context.addIssue({ code: "custom", path: ["toElementId"], message: "HLD relations must connect distinct elements" })
  if (relation.disposition === "candidate-defined" && relation.evidenceReferences.length === 0) {
    context.addIssue({ code: "custom", path: ["evidenceReferences"], message: "A defined HLD relation requires evidence" })
  }
})

export const highLevelDesignDecisionSchema = z.object({
  id: z.string().uuid(), key: identifierSchema, title: z.string().trim().min(2).max(240),
  elementIds: requiredCanonicalUuidsSchema, optionCandidates: canonicalTextListSchema.refine((values) => values.length > 1, "At least two HLD decision options are required"),
  candidateOption: shortTextSchema.optional(), rationaleCandidate: shortTextSchema,
  qualityAttributeKeys: requiredCanonicalIdentifiersSchema, riskKeys: canonicalIdentifiersSchema,
  disposition: z.enum(["candidate-selected", "unresolved"]), evidenceReferences: evidenceListSchema,
}).strict().superRefine((decision, context) => {
  if ((decision.disposition === "candidate-selected") !== Boolean(decision.candidateOption)) context.addIssue({ code: "custom", path: ["candidateOption"], message: "Only a selected candidate decision requires a candidate option" })
  if (decision.candidateOption && !decision.optionCandidates.includes(decision.candidateOption)) context.addIssue({ code: "custom", path: ["candidateOption"], message: "The candidate option must be declared" })
})

const highLevelDesignInputBaseSchema = z.object({
  initiativeId: z.string().uuid(), context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema, title: z.string().trim().min(2).max(240),
  systemSolutionArchitecture: exactSystemSolutionArchitectureReferenceSchema,
  boundedContextModel: exactBoundedContextModelReferenceSchema,
  technologyProfile: exactTechnologyProfileReferenceSchema,
  dependencyMapping: exactDependencyMappingReferenceSchema,
  implementationUnitModel: exactImplementationUnitModelReferenceSchema,
  boilerplateRegistry: exactBoilerplateRegistryReferenceSchema,
  boilerplateSelectionBinding: exactBoilerplateSelectionBindingReferenceSchema,
  boilerplateCompatibilityValidation: exactBoilerplateCompatibilityValidationReferenceSchema,
  designBaseline: exactDesignBaselineReferenceSchema,
  designToCodeBindingRegistry: exactDesignToCodeBindingRegistryReferenceSchema,
  routeScreenComponentMapping: exactRouteScreenComponentMappingReferenceSchema,
  testMethodology: exactTestMethodologyReferenceSchema,
  testInventory: exactTestInventoryReferenceSchema,
  riskRegister: exactRiskRegisterReferenceSchema,
  securityPrivacyAssessment: exactSecurityPrivacyAssessmentReferenceSchema,
  elements: z.array(highLevelDesignElementSchema).min(1).max(65_536),
  relations: z.array(highLevelDesignRelationSchema).max(65_536),
  decisions: z.array(highLevelDesignDecisionSchema).min(1).max(4_096),
  qualityAttributeKeys: requiredCanonicalIdentifiersSchema,
  deploymentViewKeys: requiredCanonicalIdentifiersSchema,
  alternativesConsidered: canonicalTextListSchema,
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema.refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  architectureTruthState: z.literal("not-established"), architectureCompletenessState: z.literal("not-established"),
  repositoryTruthState: z.literal("not-established"), runtimeTruthState: z.literal("not-established"),
  deploymentTruthState: z.literal("not-established"), privacyApprovalState: z.literal("not-established"),
  securityApprovalState: z.literal("not-established"), ownershipAppointmentState: z.literal("not-established"),
  implementationReadinessState: z.literal("not-established"), acceptanceDecisionState: z.literal("not-established"),
  releaseReadinessState: z.literal("not-established"), deploymentReadinessState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  if (!unique(candidate.elements.map((element) => element.id)) || !unique(candidate.elements.map((element) => element.key))) context.addIssue({ code: "custom", path: ["elements"], message: "HLD element identities and keys must be unique" })
  if (!unique(candidate.relations.map((relation) => relation.id)) || !unique(candidate.relations.map((relation) => relation.key))) context.addIssue({ code: "custom", path: ["relations"], message: "HLD relation identities and keys must be unique" })
  if (!unique(candidate.decisions.map((decision) => decision.id)) || !unique(candidate.decisions.map((decision) => decision.key))) context.addIssue({ code: "custom", path: ["decisions"], message: "HLD decision identities and keys must be unique" })
  candidate.elements.forEach((element, index) => { if (element.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["elements", index, "ordinal"], message: "HLD elements must use contiguous canonical ordinal ordering" }) })
  candidate.relations.forEach((relation, index) => { if (relation.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["relations", index, "ordinal"], message: "HLD relations must use contiguous canonical ordinal ordering" }) })
  const elementIds = new Set(candidate.elements.map((element) => element.id))
  candidate.relations.forEach((relation, index) => { if (!elementIds.has(relation.fromElementId) || !elementIds.has(relation.toElementId)) context.addIssue({ code: "custom", path: ["relations", index], message: "HLD relations must reference exact declared elements" }) })
  candidate.decisions.forEach((decision, index) => { if (decision.elementIds.some((id) => !elementIds.has(id))) context.addIssue({ code: "custom", path: ["decisions", index, "elementIds"], message: "HLD decisions must reference exact declared elements" }) })
  if (candidate.reviewState === "ready-for-human-review" && (candidate.unresolvedQuestions.length > 0 || candidate.elements.some((element) => element.disposition !== "candidate-defined") || candidate.relations.some((relation) => relation.disposition !== "candidate-defined") || candidate.decisions.some((decision) => decision.disposition !== "candidate-selected"))) context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready HLD requires attributed defined elements, relations, selected decision candidates, and no unresolved questions" })
})

export const highLevelDesignInputSchema = rejectSecrets(highLevelDesignInputBaseSchema)
const authorityBoundary = "high-level-design-is-a-versioned-candidate-and-does-not-establish-architecture-repository-runtime-or-deployment-truth-or-completeness-architecture-baseline-or-approval-privacy-or-security-approval-owner-appointment-implementation-readiness-acceptance-release-deployment-or-action-authority" as const

export const highLevelDesignSchema = highLevelDesignInputSchema.safeExtend({
  schemaVersion: z.literal(1), kind: z.literal("high-level-design-candidate"), id: z.string().uuid(), productId: z.string().uuid(),
  revision: z.number().int().positive(), structureReceiptDigest: digestSchema, dependencyReceiptDigest: digestSchema,
  traceReceiptDigest: digestSchema, coverageReceiptDigest: digestSchema, ownershipReceiptDigest: digestSchema,
  assessmentReceiptDigest: digestSchema, predecessorDigest: digestSchema.optional(), state: z.literal("candidate"),
  createdBy: humanActorSchema, updatedBy: humanActorSchema, createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  authorityBoundary: z.literal(authorityBoundary),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only HLD revisions after revision one require an exact predecessor digest" })
})

export const exactHighLevelDesignReferenceSchema = z.object({ recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict()
const statusAuthorityBoundary = "high-level-design-status-is-observational-and-does-not-establish-architecture-repository-runtime-or-deployment-truth-or-completeness-architecture-baseline-or-approval-privacy-or-security-approval-owner-appointment-implementation-readiness-acceptance-release-deployment-or-action-authority" as const

export const highLevelDesignStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("high-level-design-status"), productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(), candidate: exactHighLevelDesignReferenceSchema.optional(),
  dependencyCount: z.number().int().nonnegative().max(32), presentDependencyCount: z.number().int().nonnegative().max(32),
  elementCount: z.number().int().nonnegative().max(65_536), definedElementCount: z.number().int().nonnegative().max(65_536),
  relationCount: z.number().int().nonnegative().max(65_536), definedRelationCount: z.number().int().nonnegative().max(65_536),
  decisionCount: z.number().int().nonnegative().max(4_096), selectedDecisionCount: z.number().int().nonnegative().max(4_096),
  qualityAttributeCount: z.number().int().nonnegative().max(4_096), deploymentViewCount: z.number().int().nonnegative().max(4_096),
  conflictCount: z.number().int().nonnegative().max(65_536), missingCount: z.number().int().nonnegative().max(65_536),
  orphanRelationCount: z.number().int().nonnegative().max(65_536), traceGapCount: z.number().int().nonnegative().max(65_536),
  evidenceGapCount: z.number().int().nonnegative().max(65_536), ownershipGapCount: z.number().int().nonnegative().max(65_536),
  uncoveredUnitCount: z.number().int().nonnegative().max(65_536), staleBindingCount: z.number().int().nonnegative().max(1),
  staleDependencyCount: z.number().int().nonnegative().max(15), invalidCandidateCount: z.number().int().nonnegative().max(1),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512), reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "candidate-complete"]), reasons: z.array(shortTextSchema).max(1_024), assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict().superRefine((status, context) => {
  const gaps = status.dependencyCount - status.presentDependencyCount + status.conflictCount + status.missingCount + status.orphanRelationCount + status.traceGapCount + status.evidenceGapCount + status.ownershipGapCount + status.uncoveredUnitCount + status.staleBindingCount + status.staleDependencyCount + status.invalidCandidateCount + status.unresolvedQuestionCount
  if (status.state === "candidate-complete" && (gaps > 0 || !status.candidate || status.definedElementCount !== status.elementCount || status.definedRelationCount !== status.relationCount || status.selectedDecisionCount !== status.decisionCount || status.reviewState !== "ready-for-human-review" || status.reasons.length > 0)) context.addIssue({ code: "custom", path: ["state"], message: "Candidate-complete HLD requires exact dependencies, defined traceable structure, selected decision candidates, and no structural gaps" })
  if (status.state === "attention-required" && status.reasons.length === 0) context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required HLD status must expose reasons" })
})

const projectionAuthorityBoundary = "high-level-design-projection-is-read-only-and-does-not-establish-architecture-repository-runtime-or-deployment-truth-or-completeness-architecture-baseline-or-approval-privacy-or-security-approval-owner-appointment-implementation-readiness-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-counts-statuses-and-structure-dependency-trace-coverage-ownership-assessment-snapshot-digests-only-not-design-narratives-diagrams-interfaces-data-flows-technologies-owners-evidence-source-content-personal-data-secrets-credentials-or-machine-paths" as const

export const highLevelDesignProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("high-level-design-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: highLevelDesignStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.literal("candidate"),
    structureReceiptDigest: digestSchema, dependencyReceiptDigest: digestSchema, traceReceiptDigest: digestSchema,
    coverageReceiptDigest: digestSchema, ownershipReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    elementCount: z.number().int().nonnegative().max(65_536), relationCount: z.number().int().nonnegative().max(65_536),
    decisionCount: z.number().int().nonnegative().max(4_096), reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary), authorityBoundary: z.literal(projectionAuthorityBoundary),
  snapshotDigest: digestSchema,
}).strict()

export type HighLevelDesignInput = z.infer<typeof highLevelDesignInputSchema>
export type HighLevelDesign = z.infer<typeof highLevelDesignSchema>
export type HighLevelDesignStatus = z.infer<typeof highLevelDesignStatusSchema>
export type HighLevelDesignProjection = z.infer<typeof highLevelDesignProjectionSchema>
