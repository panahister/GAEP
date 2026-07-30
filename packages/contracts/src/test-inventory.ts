import { z } from "zod"

import { exactAcceptanceCriteriaReferenceSchema } from "./acceptance-criteria.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactImplementationUnitModelReferenceSchema } from "./implementation-unit-model.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactRiskRegisterReferenceSchema } from "./risk-register.js"
import { exactRouteScreenComponentMappingReferenceSchema } from "./route-screen-component-mapping.js"
import { exactTestMethodologyReferenceSchema } from "./test-methodology.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const requirementKeySchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/)
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
    message: "Portable Test Inventory candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalIdentifiersSchema = canonicalList(identifierSchema)
const requiredCanonicalIdentifiersSchema = canonicalIdentifiersSchema
  .refine((values) => values.length > 0, "At least one identifier is required")
const canonicalUuidsSchema = canonicalList(z.string().uuid())
const requiredCanonicalUuidsSchema = canonicalUuidsSchema
  .refine((values) => values.length > 0, "At least one record identity is required")
const canonicalRequirementKeysSchema = canonicalList(requirementKeySchema, 4_096)
const requiredCanonicalRequirementKeysSchema = canonicalRequirementKeysSchema
  .refine((values) => values.length > 0, "At least one Requirement key is required")
const canonicalTextListSchema = canonicalList(shortTextSchema, 512)

export const testInventoryKinds = [
  "accessibility", "contract", "end-to-end", "integration", "manual", "performance", "recovery",
  "security", "unit", "visual",
] as const
export const testInventoryKindSchema = z.enum(testInventoryKinds)
export const testInventoryDispositionSchema = z.enum([
  "candidate-cataloged", "candidate-conflict", "candidate-missing", "deferred", "not-assessed",
])

export const testInventoryEvidenceReferenceSchema = z.object({
  kind: z.enum([
    "acceptance-criteria", "evidence", "implementation-unit", "requirement", "risk-register",
    "route-screen-component-mapping", "test-asset-observation", "test-methodology",
  ]),
  sourceId: shortTextSchema,
  revision: z.number().int().positive(),
  digest: digestSchema,
  evidenceState: z.enum(["candidate-asserted", "human-reviewed", "source-recorded"]),
}).strict()

const evidenceListSchema = z.array(testInventoryEvidenceReferenceSchema).max(512).refine(
  (values) => unique(values.map((value) => `${value.kind}:${value.sourceId}:${value.revision}:${value.digest}`)),
  "Test Inventory evidence references must be unique",
)

export const testInventoryAssetCandidateSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(65_536),
  key: identifierSchema,
  kind: testInventoryKindSchema,
  title: z.string().trim().min(2).max(240),
  implementationUnitIds: requiredCanonicalUuidsSchema,
  requirementKeys: requiredCanonicalRequirementKeysSchema,
  acceptanceCriterionIds: requiredCanonicalUuidsSchema,
  riskKeys: requiredCanonicalIdentifiersSchema,
  routeScreenComponentSubjectIds: canonicalUuidsSchema,
  methodologyScopeIds: requiredCanonicalUuidsSchema,
  environmentIds: canonicalIdentifiersSchema,
  platformKeys: canonicalIdentifiersSchema,
  evidenceExpectationIds: canonicalIdentifiersSchema,
  ownerCandidateIds: canonicalTextListSchema,
  disposition: testInventoryDispositionSchema,
  existenceState: z.enum(["candidate-observed", "candidate-planned", "candidate-missing", "not-assessed"]),
  automationState: z.enum(["automated-candidate", "hybrid-candidate", "manual-candidate", "not-assessed"]),
  executionState: z.literal("not-performed"),
  resultState: z.literal("not-established"),
  evidenceTruthState: z.literal("not-established"),
  coverageTruthState: z.literal("not-established"),
  qualityState: z.literal("not-established"),
  ownershipAuthorityState: z.literal("not-granted"),
  acceptanceState: z.literal("not-established"),
  evidenceReferences: evidenceListSchema,
  conflictReferenceCandidates: evidenceListSchema,
  catalogedBy: humanActorSchema.optional(),
  catalogedAt: z.string().datetime().optional(),
}).strict().superRefine((asset, context) => {
  if (asset.disposition === "candidate-cataloged" &&
      (asset.existenceState === "candidate-missing" || asset.existenceState === "not-assessed" ||
       asset.automationState === "not-assessed" || asset.ownerCandidateIds.length === 0 ||
       asset.evidenceReferences.length === 0 || !asset.catalogedBy || !asset.catalogedAt)) {
    context.addIssue({ code: "custom", path: ["disposition"], message: "A cataloged test requires observed or planned existence, automation intent, owner candidates, evidence, and attribution" })
  }
  if (asset.disposition !== "candidate-cataloged" && (asset.catalogedBy || asset.catalogedAt)) {
    context.addIssue({ code: "custom", path: ["catalogedBy"], message: "Only cataloged test candidates may carry human catalog attribution" })
  }
  if (asset.disposition === "candidate-conflict" && asset.conflictReferenceCandidates.length === 0) {
    context.addIssue({ code: "custom", path: ["conflictReferenceCandidates"], message: "A test inventory conflict requires an exact conflict reference candidate" })
  }
})

const testInventoryInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  acceptanceCriteria: exactAcceptanceCriteriaReferenceSchema,
  riskRegister: exactRiskRegisterReferenceSchema,
  implementationUnitModel: exactImplementationUnitModelReferenceSchema,
  routeScreenComponentMapping: exactRouteScreenComponentMappingReferenceSchema,
  testMethodology: exactTestMethodologyReferenceSchema,
  assets: z.array(testInventoryAssetCandidateSchema).min(1).max(65_536),
  alternativesConsidered: canonicalTextListSchema,
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema.refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  requirementTruthState: z.literal("not-established"),
  acceptanceCriteriaValidityState: z.literal("not-established"),
  riskTruthState: z.literal("not-established"),
  inventoryTruthState: z.literal("not-established"),
  inventoryCompletenessState: z.literal("not-established"),
  testAssetExistenceTruthState: z.literal("not-established"),
  environmentAvailabilityState: z.literal("not-established"),
  privacyApprovalState: z.literal("not-established"),
  securityApprovalState: z.literal("not-established"),
  ownershipAppointmentState: z.literal("not-established"),
  testExecutionState: z.literal("not-performed"),
  testResultState: z.literal("not-established"),
  evidenceTruthState: z.literal("not-established"),
  coverageTruthState: z.literal("not-established"),
  qualityState: z.literal("not-established"),
  implementationReadinessState: z.literal("not-established"),
  acceptanceDecisionState: z.literal("not-established"),
  releaseReadinessState: z.literal("not-established"),
  deploymentReadinessState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  if (!unique(candidate.assets.map((asset) => asset.id)) || !unique(candidate.assets.map((asset) => asset.key))) {
    context.addIssue({ code: "custom", path: ["assets"], message: "Test Inventory identities and keys must be unique" })
  }
  candidate.assets.forEach((asset, index) => {
    if (asset.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["assets", index, "ordinal"], message: "Test assets must use contiguous canonical ordinal ordering" })
  })
  if (candidate.reviewState === "ready-for-human-review" &&
      (candidate.unresolvedQuestions.length > 0 ||
       candidate.assets.some((asset) => asset.disposition !== "candidate-cataloged"))) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready Test Inventory requires cataloged attributed test candidates and no unresolved questions" })
  }
})

export const testInventoryInputSchema = rejectSecrets(testInventoryInputBaseSchema)
const authorityBoundary = "test-inventory-is-a-versioned-candidate-and-does-not-establish-requirement-acceptance-criteria-or-risk-truth-inventory-validity-or-completeness-test-asset-existence-environment-availability-privacy-or-security-approval-owner-appointment-test-execution-or-results-evidence-or-coverage-truth-quality-implementation-readiness-acceptance-release-deployment-or-action-authority" as const

export const testInventorySchema = testInventoryInputSchema.safeExtend({
  schemaVersion: z.literal(1), kind: z.literal("test-inventory-candidate"), id: z.string().uuid(),
  productId: z.string().uuid(), revision: z.number().int().positive(), catalogReceiptDigest: digestSchema,
  coverageReceiptDigest: digestSchema, traceReceiptDigest: digestSchema, ownershipReceiptDigest: digestSchema,
  assessmentReceiptDigest: digestSchema, predecessorDigest: digestSchema.optional(), state: z.literal("candidate"),
  createdBy: humanActorSchema, updatedBy: humanActorSchema, createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(), authorityBoundary: z.literal(authorityBoundary),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Test Inventory revisions after revision one require an exact predecessor digest" })
})

export const exactTestInventoryReferenceSchema = z.object({ recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict()
const statusAuthorityBoundary = "test-inventory-status-is-observational-and-does-not-establish-requirement-acceptance-criteria-or-risk-truth-inventory-validity-or-completeness-test-asset-existence-environment-availability-privacy-or-security-approval-owner-appointment-test-execution-or-results-evidence-or-coverage-truth-quality-implementation-readiness-acceptance-release-deployment-or-action-authority" as const

export const testInventoryStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("test-inventory-status"), productId: z.string().uuid(),
  productRevision: z.number().int().positive(), initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactTestInventoryReferenceSchema.optional(), acceptanceCriteria: exactAcceptanceCriteriaReferenceSchema.optional(),
  riskRegister: exactRiskRegisterReferenceSchema.optional(), implementationUnitModel: exactImplementationUnitModelReferenceSchema.optional(),
  routeScreenComponentMapping: exactRouteScreenComponentMappingReferenceSchema.optional(), testMethodology: exactTestMethodologyReferenceSchema.optional(),
  sourceCriterionCount: z.number().int().nonnegative().max(65_536), sourceRiskCount: z.number().int().nonnegative().max(4_096),
  sourceUnitCount: z.number().int().nonnegative().max(65_536), sourceMappingSubjectCount: z.number().int().nonnegative().max(65_536),
  sourceMethodologyScopeCount: z.number().int().nonnegative().max(65_536), assetCount: z.number().int().nonnegative().max(65_536),
  catalogedAssetCount: z.number().int().nonnegative().max(65_536), conflictAssetCount: z.number().int().nonnegative().max(65_536),
  missingAssetCount: z.number().int().nonnegative().max(65_536), deferredAssetCount: z.number().int().nonnegative().max(65_536),
  notAssessedAssetCount: z.number().int().nonnegative().max(65_536), observedAssetCount: z.number().int().nonnegative().max(65_536),
  plannedAssetCount: z.number().int().nonnegative().max(65_536), automatedAssetCount: z.number().int().nonnegative().max(65_536),
  manualAssetCount: z.number().int().nonnegative().max(65_536), duplicateIdentityCount: z.number().int().nonnegative().max(65_536),
  orphanAssetCount: z.number().int().nonnegative().max(65_536), uncoveredCriterionCount: z.number().int().nonnegative().max(65_536),
  uncoveredRiskCount: z.number().int().nonnegative().max(4_096), uncoveredUnitCount: z.number().int().nonnegative().max(65_536),
  uncoveredMappingSubjectCount: z.number().int().nonnegative().max(65_536), uncoveredMethodologyScopeCount: z.number().int().nonnegative().max(65_536),
  ownershipGapCount: z.number().int().nonnegative().max(65_536), traceGapCount: z.number().int().nonnegative().max(65_536),
  evidenceGapCount: z.number().int().nonnegative().max(65_536), staleBindingCount: z.number().int().nonnegative().max(1),
  staleDependencyCount: z.number().int().nonnegative().max(5), invalidCandidateCount: z.number().int().nonnegative().max(1),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512), reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "candidate-complete"]), reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(), authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict().superRefine((status, context) => {
  if (status.catalogedAssetCount + status.conflictAssetCount + status.missingAssetCount + status.deferredAssetCount + status.notAssessedAssetCount !== status.assetCount) {
    context.addIssue({ code: "custom", path: ["assetCount"], message: "Test Inventory disposition counts must reconcile" })
  }
  const gaps = status.conflictAssetCount + status.missingAssetCount + status.deferredAssetCount + status.notAssessedAssetCount + status.duplicateIdentityCount + status.orphanAssetCount + status.uncoveredCriterionCount + status.uncoveredRiskCount + status.uncoveredUnitCount + status.uncoveredMappingSubjectCount + status.uncoveredMethodologyScopeCount + status.ownershipGapCount + status.traceGapCount + status.evidenceGapCount + status.staleBindingCount + status.staleDependencyCount + status.invalidCandidateCount + status.unresolvedQuestionCount
  const dependencies = [status.acceptanceCriteria, status.riskRegister, status.implementationUnitModel, status.routeScreenComponentMapping, status.testMethodology]
  if (status.state === "candidate-complete" && (gaps > 0 || !status.candidate || dependencies.some((dependency) => !dependency) || status.catalogedAssetCount !== status.assetCount || status.reviewState !== "ready-for-human-review" || status.reasons.length > 0)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Candidate-complete Test Inventory requires exact current dependencies, cataloged assets, complete trace candidates, and no structural gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Test Inventory status must expose reasons" })
})

const projectionAuthorityBoundary = "test-inventory-projection-is-read-only-and-does-not-establish-requirement-acceptance-criteria-or-risk-truth-inventory-validity-or-completeness-test-asset-existence-environment-availability-privacy-or-security-approval-owner-appointment-test-execution-or-results-evidence-or-coverage-truth-quality-implementation-readiness-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-counts-statuses-and-test-catalog-coverage-trace-ownership-assessment-snapshot-digests-only-not-test-titles-paths-code-steps-data-owner-evidence-results-personal-data-secrets-credentials-or-machine-paths" as const

export const testInventoryProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("test-inventory-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: testInventoryStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.literal("candidate"),
    catalogReceiptDigest: digestSchema, coverageReceiptDigest: digestSchema, traceReceiptDigest: digestSchema,
    ownershipReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema, assetCount: z.number().int().nonnegative().max(65_536),
    catalogedAssetCount: z.number().int().nonnegative().max(65_536), conflictAssetCount: z.number().int().nonnegative().max(65_536),
    observedAssetCount: z.number().int().nonnegative().max(65_536), plannedAssetCount: z.number().int().nonnegative().max(65_536),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary),
  authorityBoundary: z.literal(projectionAuthorityBoundary), snapshotDigest: digestSchema,
}).strict()

export type TestInventoryInput = z.infer<typeof testInventoryInputSchema>
export type TestInventory = z.infer<typeof testInventorySchema>
export type TestInventoryStatus = z.infer<typeof testInventoryStatusSchema>
export type TestInventoryProjection = z.infer<typeof testInventoryProjectionSchema>
