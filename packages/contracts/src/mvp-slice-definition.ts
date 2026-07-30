import { z } from "zod"

import { exactBacklogHierarchyReferenceSchema, backlogHierarchyLevelSchema } from "./backlog-hierarchy.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
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
    message: "Portable MVP and Slice Definition records cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalTextListSchema = z.array(shortTextSchema).max(512)
  .refine(unique, "Values must be unique")
  .refine(canonical, "Values must use canonical lexical ordering")

export const mvpScopeDispositionSchema = z.enum(["mvp", "later", "excluded"])

export const mvpScopeEntrySchema = z.object({
  nodeId: z.string().uuid(),
  key: identifierSchema,
  level: backlogHierarchyLevelSchema,
  ordinal: z.number().int().positive().max(10_000),
  disposition: mvpScopeDispositionSchema,
  rationale: shortTextSchema,
}).strict()

const nodeIdsSchema = z.array(z.string().uuid()).min(1).max(10_000).refine(unique, "Slice node references must be unique")

export const verticalSliceCandidateSchema = z.object({
  id: z.string().uuid(),
  key: identifierSchema,
  ordinal: z.number().int().positive().max(10_000),
  storyNodeIds: nodeIdsSchema,
  taskNodeIds: nodeIdsSchema,
  dependencySliceIds: z.array(z.string().uuid()).max(10_000).refine(unique, "Slice dependency references must be unique"),
  testabilityState: z.enum(["candidate-testable", "not-assessed"]),
}).strict()

const mvpSliceDefinitionInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  hierarchy: exactBacklogHierarchyReferenceSchema,
  scopeEntries: z.array(mvpScopeEntrySchema).min(4).max(10_000),
  slices: z.array(verticalSliceCandidateSchema).min(1).max(10_000),
  scopeCompletenessState: z.enum(["candidate-complete", "not-assessed"]),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  prioritizationState: z.literal("not-established"),
  backlogCommitmentState: z.literal("not-established"),
  scopeApprovalState: z.literal("not-established"),
  acceptanceCriteriaValidityState: z.literal("not-established"),
  readyDoneState: z.literal("not-established"),
  implementationReadinessState: z.literal("not-established"),
  assignmentExecutionState: z.literal("not-established"),
  implementationAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  const scopeIds = candidate.scopeEntries.map((entry) => entry.nodeId)
  const scopeKeys = candidate.scopeEntries.map((entry) => entry.key)
  if (!unique(scopeIds)) context.addIssue({ code: "custom", path: ["scopeEntries"], message: "Every Backlog node must have one MVP scope disposition" })
  if (!unique(scopeKeys)) context.addIssue({ code: "custom", path: ["scopeEntries"], message: "MVP scope keys must be unique" })
  for (const [index, entry] of candidate.scopeEntries.entries()) {
    if (entry.ordinal !== index + 1) {
      context.addIssue({ code: "custom", path: ["scopeEntries", index, "ordinal"], message: "MVP scope entries must use contiguous canonical ordinal ordering" })
    }
  }
  const sliceIds = candidate.slices.map((slice) => slice.id)
  const sliceKeys = candidate.slices.map((slice) => slice.key)
  if (!unique(sliceIds)) context.addIssue({ code: "custom", path: ["slices"], message: "Vertical Slice identities must be unique" })
  if (!unique(sliceKeys)) context.addIssue({ code: "custom", path: ["slices"], message: "Vertical Slice keys must be unique" })
  const assignedStoryIds = candidate.slices.flatMap((slice) => slice.storyNodeIds)
  const assignedTaskIds = candidate.slices.flatMap((slice) => slice.taskNodeIds)
  if (!unique(assignedStoryIds) || !unique(assignedTaskIds)) {
    context.addIssue({ code: "custom", path: ["slices"], message: "An MVP Story or Task can belong to only one Vertical Slice" })
  }
  const earlierSliceIds = new Set<string>()
  for (const [index, slice] of candidate.slices.entries()) {
    if (slice.ordinal !== index + 1) {
      context.addIssue({ code: "custom", path: ["slices", index, "ordinal"], message: "Vertical Slices must use contiguous canonical ordinal ordering" })
    }
    if (slice.dependencySliceIds.some((id) => !earlierSliceIds.has(id))) {
      context.addIssue({ code: "custom", path: ["slices", index, "dependencySliceIds"], message: "Vertical Slice dependencies must reference earlier slices in the same candidate" })
    }
    earlierSliceIds.add(slice.id)
  }
  if (candidate.reviewState === "ready-for-human-review" &&
      (candidate.scopeCompletenessState !== "candidate-complete" || candidate.unresolvedQuestions.length > 0 ||
       candidate.slices.some((slice) => slice.testabilityState !== "candidate-testable"))) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready MVP scope requires candidate completeness, candidate-testable slices, and no unresolved questions" })
  }
})

export const mvpSliceDefinitionInputSchema = rejectSecrets(mvpSliceDefinitionInputBaseSchema)

export const mvpSliceDefinitionSchema = mvpSliceDefinitionInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("mvp-slice-definition-candidate"),
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
  authorityBoundary: z.literal("mvp-slice-definition-is-a-versioned-candidate-scope-over-an-exact-backlog-hierarchy-not-priority-commitment-scope-approval-acceptance-criteria-validity-ready-done-implementation-readiness-assignment-execution-or-action-authority"),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only MVP and Slice Definition revisions after revision one require an exact predecessor digest" })
  }
})

export const exactMvpSliceDefinitionReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const mvpSliceDefinitionStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("mvp-slice-definition-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactMvpSliceDefinitionReferenceSchema.optional(),
  hierarchy: exactBacklogHierarchyReferenceSchema.optional(),
  scopeNodeCount: z.number().int().nonnegative().max(10_000),
  mvpNodeCount: z.number().int().nonnegative().max(10_000),
  laterNodeCount: z.number().int().nonnegative().max(10_000),
  excludedNodeCount: z.number().int().nonnegative().max(10_000),
  sliceCount: z.number().int().nonnegative().max(10_000),
  storyCount: z.number().int().nonnegative().max(10_000),
  taskCount: z.number().int().nonnegative().max(10_000),
  dependencyCount: z.number().int().nonnegative().max(1_000_000),
  unassignedMvpStoryTaskCount: z.number().int().nonnegative().max(10_000),
  staleBindingCount: z.number().int().nonnegative(),
  staleHierarchyCount: z.number().int().nonnegative().max(1),
  invalidScopeCount: z.number().int().nonnegative().max(10_000),
  invalidSliceCount: z.number().int().nonnegative().max(10_000),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  scopeCompletenessState: z.enum(["candidate-complete", "not-assessed"]),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal("mvp-slice-definition-status-is-observational-and-does-not-establish-priority-commitment-scope-approval-acceptance-criteria-validity-ready-done-implementation-readiness-assignment-execution-or-action-authority"),
}).strict().superRefine((status, context) => {
  const gaps = status.unassignedMvpStoryTaskCount + status.staleBindingCount + status.staleHierarchyCount +
    status.invalidScopeCount + status.invalidSliceCount + status.unresolvedQuestionCount
  if (status.scopeNodeCount !== status.mvpNodeCount + status.laterNodeCount + status.excludedNodeCount) {
    context.addIssue({ code: "custom", path: ["scopeNodeCount"], message: "MVP scope disposition counts must reconcile" })
  }
  if (status.state === "complete-for-review" &&
      (gaps > 0 || !status.candidate || !status.hierarchy || status.scopeCompletenessState !== "candidate-complete" ||
       status.reviewState !== "ready-for-human-review" || status.reasons.length > 0)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires an exact review-ready MVP and Slice Definition candidate with no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required MVP and Slice Definition status must expose reasons" })
  }
})

export const mvpSliceDefinitionProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("mvp-slice-definition-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  }).strict(),
  status: mvpSliceDefinitionStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.literal("candidate"), membershipDigest: digestSchema,
    hierarchyDigest: digestSchema,
    scopeNodeCount: z.number().int().nonnegative().max(10_000),
    mvpNodeCount: z.number().int().nonnegative().max(10_000),
    laterNodeCount: z.number().int().nonnegative().max(10_000),
    excludedNodeCount: z.number().int().nonnegative().max(10_000),
    sliceCount: z.number().int().nonnegative().max(10_000),
    storyCount: z.number().int().nonnegative().max(10_000),
    taskCount: z.number().int().nonnegative().max(10_000),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal("projection-contains-record-identities-scope-and-slice-counts-statuses-and-digests-only-not-slice-titles-rationales-objectives-criteria-scope-content-requirement-content-personal-data-secrets-credentials-or-machine-paths"),
  authorityBoundary: z.literal("mvp-slice-definition-projection-is-read-only-and-does-not-prioritize-commit-approve-scope-admit-assign-execute-or-authorize-implementation-or-action"),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "MVP and Slice Definition projection must bind exact Product and Initiative revisions" })
  }
})

export type MvpSliceDefinitionInput = z.infer<typeof mvpSliceDefinitionInputSchema>
export type MvpSliceDefinition = z.infer<typeof mvpSliceDefinitionSchema>
export type MvpSliceDefinitionStatus = z.infer<typeof mvpSliceDefinitionStatusSchema>
export type MvpSliceDefinitionProjection = z.infer<typeof mvpSliceDefinitionProjectionSchema>
export type ExactMvpSliceDefinitionReference = z.infer<typeof exactMvpSliceDefinitionReferenceSchema>
