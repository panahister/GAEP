import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { changedUnitEvidenceReferenceSchema } from "./changed-unit-inventory.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const exactReferenceSchema = z.object({
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()

function unique(values: readonly string[]): boolean { return new Set(values).size === values.length }
function canonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}
function canonicalTextList(maximum = 512) {
  return z.array(shortTextSchema).max(maximum)
    .refine(unique, "Values must be unique")
    .refine(canonical, "Values must use canonical lexical ordering")
}
function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Approved Figma Context Retrieval candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const approvedFigmaContextDependencySchema = z.object({
  designApplicability: exactReferenceSchema,
  finalizedFigmaSnapshotImport: exactReferenceSchema,
  humanDesignApproval: exactReferenceSchema,
  designBaseline: exactReferenceSchema,
  designToRequirementBinding: exactReferenceSchema,
  designToCodeBindingRegistry: exactReferenceSchema,
  routeScreenComponentMapping: exactReferenceSchema,
  proposedChangePreview: exactReferenceSchema,
  stagingWorkspace: exactReferenceSchema,
  modelSwitchImplementation: exactReferenceSchema,
}).strict()

export const approvedFigmaSnapshotBindingSchema = z.object({
  externalFileIdentityDigest: digestSchema,
  returnedExternalVersionDigest: digestSchema,
  itemCatalogDigest: digestSchema,
  itemCount: z.number().int().positive().max(33_792),
  includedItemCount: z.number().int().positive().max(33_792),
  excludedItemCount: z.number().int().nonnegative().max(33_792),
  approvalSubjectDigest: digestSchema,
  approvalScopeDigest: digestSchema,
  humanDecisionReceiptDigest: digestSchema,
  humanDecisionCandidateState: z.literal("approved-candidate"),
  baselineMembershipDigest: digestSchema,
  baselineLineageId: z.string().uuid(),
  baselineCandidateSetId: z.string().uuid(),
  baselineCandidateSetRevision: z.number().int().positive(),
  baselineSemanticVersion: z.string().regex(/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?$/),
}).strict().superRefine((binding, context) => {
  if (binding.includedItemCount + binding.excludedItemCount !== binding.itemCount) {
    context.addIssue({ code: "custom", path: ["includedItemCount"], message: "Approved snapshot scope must classify every exact snapshot item" })
  }
})

export const approvedFigmaGenerationContextSchema = z.object({
  designApplicabilityMembershipDigest: digestSchema,
  requirementBindingMembershipDigest: digestSchema,
  designToCodeBindingMembershipDigest: digestSchema,
  routeSubjectCatalogDigest: digestSchema,
  routeRelationshipCatalogDigest: digestSchema,
  previewAssessmentDigest: digestSchema,
  stagingAssessmentDigest: digestSchema,
  modelSwitchAssessmentDigest: digestSchema,
  requirementBindingCount: z.number().int().positive().max(32_768),
  designToCodeBindingCount: z.number().int().positive().max(32_768),
  routeSubjectCount: z.number().int().positive().max(32_768),
  routeRelationshipCount: z.number().int().nonnegative().max(65_536),
  implementationUnitCount: z.number().int().positive().max(65_536),
  pathCount: z.number().int().positive().max(65_536),
  contentBoundary: z.literal("metadata-and-digests-only"),
  materializationState: z.literal("not-performed"),
  transferState: z.literal("not-performed"),
}).strict()

export const approvedFigmaContextRetrievalLifecycleSchema = z.object({
  retrievalCandidateState: z.literal("candidate-defined"),
  figmaConnectionState: z.literal("not-performed"),
  remoteFetchState: z.literal("not-performed"),
  contextMaterializationState: z.literal("not-performed"),
  contextTransferState: z.literal("not-performed"),
  generationState: z.literal("not-performed"),
  providerExecutionState: z.literal("not-performed"),
  stageEffectState: z.literal("not-performed"),
  sourceMutationState: z.literal("not-performed"),
  approvalState: z.literal("not-established"),
  authorizationState: z.literal("not-established"),
  acceptanceState: z.literal("not-established"),
}).strict()

const inputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  dependencies: approvedFigmaContextDependencySchema,
  approvedSnapshot: approvedFigmaSnapshotBindingSchema,
  generationContext: approvedFigmaGenerationContextSchema,
  lifecycle: approvedFigmaContextRetrievalLifecycleSchema,
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  unresolvedQuestions: canonicalTextList(),
  limitations: canonicalTextList().refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  actualFigmaAccessState: z.literal("not-established"),
  snapshotContentState: z.literal("not-materialized"),
  designApprovalState: z.literal("candidate-only-not-established"),
  designBaselineState: z.literal("candidate-only-not-established"),
  generationReadinessState: z.literal("not-established"),
  nativeHostAcceptanceState: z.literal("not-established"),
  liveProviderAcceptanceState: z.literal("not-established"),
  securityAcceptanceState: z.literal("not-established"),
  releaseReadinessState: z.literal("not-established"),
  deploymentReadinessState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  if (candidate.reviewState === "ready-for-human-review" && candidate.unresolvedQuestions.length > 0) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready retrieval candidates cannot contain unresolved questions" })
  }
})

export const approvedFigmaContextRetrievalInputSchema = rejectSecrets(inputBaseSchema)
const authorityBoundary = "approved-figma-context-retrieval-is-an-offline-versioned-portable-candidate-and-does-not-connect-to-or-call-figma-fetch-or-materialize-remote-content-transfer-context-expose-design-or-source-content-establish-design-approval-baseline-or-generation-readiness-execute-a-provider-generate-code-create-or-change-a-stage-mutate-source-approve-authorize-accept-release-deploy-or-grant-action-authority" as const
export const approvedFigmaContextRetrievalSchema = approvedFigmaContextRetrievalInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("approved-figma-context-retrieval-candidate"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  dependencyReceiptDigest: digestSchema,
  approvedSnapshotReceiptDigest: digestSchema,
  generationContextReceiptDigest: digestSchema,
  lifecycleReceiptDigest: digestSchema,
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
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only revisions after revision one require a predecessor digest" })
  }
})

export const exactApprovedFigmaContextRetrievalReferenceSchema = exactReferenceSchema
const statusAuthorityBoundary = "approved-figma-context-retrieval-status-is-observational-and-grants-no-figma-access-content-materialization-context-transfer-generation-provider-stage-mutation-approval-authorization-acceptance-release-deployment-or-action-authority" as const
export const approvedFigmaContextRetrievalStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("approved-figma-context-retrieval-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactReferenceSchema.optional(), dependencies: approvedFigmaContextDependencySchema.optional(),
  snapshotItemCount: z.number().int().nonnegative(), includedItemCount: z.number().int().nonnegative(),
  requirementBindingCount: z.number().int().nonnegative(), designToCodeBindingCount: z.number().int().nonnegative(),
  routeSubjectCount: z.number().int().nonnegative(), implementationUnitCount: z.number().int().nonnegative(), pathCount: z.number().int().nonnegative(),
  staleBindingCount: z.number().int().nonnegative(), snapshotGapCount: z.number().int().nonnegative(),
  generationContextGapCount: z.number().int().nonnegative(), lifecycleGapCount: z.number().int().nonnegative(),
  evidenceGapCount: z.number().int().nonnegative(), invalidCandidateCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative(), reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "candidate-defined"]), reasons: z.array(shortTextSchema).max(2_048),
  assessedAt: z.string().datetime(), authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict()

const projectionAuthorityBoundary = "approved-figma-context-retrieval-projection-is-read-only-and-grants-no-figma-access-content-materialization-context-transfer-generation-provider-stage-mutation-approval-authorization-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-versions-counts-states-and-receipt-digests-only-not-design-or-source-content-prompts-provider-output-machine-paths-personal-data-secrets-credentials-or-permissions" as const
export const approvedFigmaContextRetrievalProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("approved-figma-context-retrieval-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: approvedFigmaContextRetrievalStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.literal("candidate"),
    approvedSnapshot: approvedFigmaSnapshotBindingSchema, generationContext: approvedFigmaGenerationContextSchema,
    lifecycle: approvedFigmaContextRetrievalLifecycleSchema, dependencyReceiptDigest: digestSchema,
    approvedSnapshotReceiptDigest: digestSchema, generationContextReceiptDigest: digestSchema,
    lifecycleReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary),
  authorityBoundary: z.literal(projectionAuthorityBoundary), snapshotDigest: digestSchema,
}).strict()

export type ApprovedFigmaContextRetrievalInput = z.infer<typeof approvedFigmaContextRetrievalInputSchema>
export type ApprovedFigmaContextRetrieval = z.infer<typeof approvedFigmaContextRetrievalSchema>
export type ApprovedFigmaContextRetrievalStatus = z.infer<typeof approvedFigmaContextRetrievalStatusSchema>
export type ApprovedFigmaContextRetrievalProjection = z.infer<typeof approvedFigmaContextRetrievalProjectionSchema>
