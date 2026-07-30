import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()

function hasUniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function isCanonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Backlog Hierarchy records cannot contain secret-shaped values",
  }) as unknown as T
}

const exactReferenceBase = {
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}

export const exactBacklogWorkItemReferenceSchema = z.object({
  recordType: z.literal("work-item"),
  ...exactReferenceBase,
}).strict()

export const exactBacklogChangeReferenceSchema = z.object({
  recordType: z.literal("change"),
  ...exactReferenceBase,
}).strict()

export const exactBacklogRequirementReferenceSchema = z.object({
  recordType: z.literal("requirement"),
  key: z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/),
  ...exactReferenceBase,
}).strict()

export const backlogHierarchyLevelSchema = z.enum(["epic", "feature", "story", "task"])

const requirementReferencesSchema = z.array(exactBacklogRequirementReferenceSchema).max(256)
  .refine((references) => hasUniqueValues(references.map((reference) => reference.recordId)), "Backlog Requirement references must be unique")
  .refine((references) => isCanonical(references.map((reference) => reference.key)), "Backlog Requirement references must use canonical key ordering")

export const backlogHierarchyNodeSchema = z.object({
  id: z.string().uuid(),
  key: identifierSchema,
  level: backlogHierarchyLevelSchema,
  title: z.string().trim().min(2).max(240),
  workItem: exactBacklogWorkItemReferenceSchema,
  change: exactBacklogChangeReferenceSchema,
  parentId: z.string().uuid().optional(),
  ordinal: z.number().int().positive().max(10_000),
  requirements: requirementReferencesSchema,
}).strict()

const canonicalTextListSchema = z.array(shortTextSchema).max(512)
  .refine(hasUniqueValues, "Values must be unique")
  .refine(isCanonical, "Values must use canonical lexical ordering")

const backlogHierarchyInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  nodes: z.array(backlogHierarchyNodeSchema).min(4).max(10_000),
  hierarchyCompletenessState: z.enum(["candidate-complete", "not-assessed"]),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  prioritizationState: z.literal("not-established"),
  backlogCommitmentState: z.literal("not-established"),
  ownershipAuthorityState: z.literal("not-established"),
  readyDoneState: z.literal("not-established"),
  implementationReadinessState: z.literal("not-established"),
  implementationAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  const ids = candidate.nodes.map((node) => node.id)
  const keys = candidate.nodes.map((node) => node.key)
  const workItems = candidate.nodes.map((node) => node.workItem.recordId)
  if (!hasUniqueValues(ids)) context.addIssue({ code: "custom", path: ["nodes"], message: "Backlog node identities must be unique" })
  if (!hasUniqueValues(keys)) context.addIssue({ code: "custom", path: ["nodes"], message: "Backlog node keys must be unique" })
  if (!hasUniqueValues(workItems)) context.addIssue({ code: "custom", path: ["nodes"], message: "A Work Item can appear only once in one Backlog Hierarchy" })
  const byId = new Map(candidate.nodes.map((node) => [node.id, node]))
  const allowedParent = { feature: "epic", story: "feature", task: "story" } as const
  for (const [index, node] of candidate.nodes.entries()) {
    if (node.ordinal !== index + 1) {
      context.addIssue({ code: "custom", path: ["nodes", index, "ordinal"], message: "Backlog nodes must use contiguous canonical ordinal ordering" })
    }
    if (node.level === "epic") {
      if (node.parentId) context.addIssue({ code: "custom", path: ["nodes", index, "parentId"], message: "Epic nodes cannot have a parent" })
    } else {
      const parent = node.parentId ? byId.get(node.parentId) : undefined
      if (!parent || parent.level !== allowedParent[node.level] || parent.ordinal >= node.ordinal) {
        context.addIssue({ code: "custom", path: ["nodes", index, "parentId"], message: `${node.level} nodes require an earlier ${allowedParent[node.level]} parent in the same hierarchy` })
      }
    }
    if ((node.level === "story" || node.level === "task") && node.requirements.length === 0) {
      context.addIssue({ code: "custom", path: ["nodes", index, "requirements"], message: "Story and Task nodes require at least one exact Requirement trace" })
    }
  }
  for (const level of backlogHierarchyLevelSchema.options) {
    if (!candidate.nodes.some((node) => node.level === level)) {
      context.addIssue({ code: "custom", path: ["nodes"], message: `Backlog Hierarchy requires at least one ${level} node` })
    }
  }
  if (candidate.reviewState === "ready-for-human-review" &&
      (candidate.hierarchyCompletenessState !== "candidate-complete" || candidate.unresolvedQuestions.length > 0)) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready hierarchy requires candidate completeness and no unresolved questions" })
  }
})

export const backlogHierarchyInputSchema = rejectSecrets(backlogHierarchyInputBaseSchema)

export const backlogHierarchySchema = backlogHierarchyInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("backlog-hierarchy-candidate"),
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
  authorityBoundary: z.literal("backlog-hierarchy-is-a-versioned-candidate-overlay-on-exact-work-items-not-priority-commitment-ownership-ready-done-implementation-readiness-assignment-execution-or-action-authority"),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Backlog Hierarchy revisions after revision one require an exact predecessor digest" })
  }
})

export const exactBacklogHierarchyReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const backlogHierarchyStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("backlog-hierarchy-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactBacklogHierarchyReferenceSchema.optional(),
  nodeCount: z.number().int().nonnegative().max(10_000),
  epicCount: z.number().int().nonnegative().max(10_000),
  featureCount: z.number().int().nonnegative().max(10_000),
  storyCount: z.number().int().nonnegative().max(10_000),
  taskCount: z.number().int().nonnegative().max(10_000),
  rootCount: z.number().int().nonnegative().max(10_000),
  leafCount: z.number().int().nonnegative().max(10_000),
  requirementTraceCount: z.number().int().nonnegative().max(1_000_000),
  untracedStoryTaskCount: z.number().int().nonnegative().max(10_000),
  staleBindingCount: z.number().int().nonnegative(),
  staleWorkItemCount: z.number().int().nonnegative().max(10_000),
  staleChangeCount: z.number().int().nonnegative().max(10_000),
  staleRequirementCount: z.number().int().nonnegative().max(1_000_000),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  hierarchyCompletenessState: z.enum(["candidate-complete", "not-assessed"]),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal("backlog-hierarchy-status-is-observational-and-does-not-establish-priority-commitment-ownership-ready-done-implementation-readiness-assignment-execution-or-action-authority"),
}).strict().superRefine((status, context) => {
  const gaps = status.untracedStoryTaskCount + status.staleBindingCount + status.staleWorkItemCount +
    status.staleChangeCount + status.staleRequirementCount + status.unresolvedQuestionCount
  if (status.nodeCount !== status.epicCount + status.featureCount + status.storyCount + status.taskCount) {
    context.addIssue({ code: "custom", path: ["nodeCount"], message: "Backlog hierarchy level counts must reconcile" })
  }
  if (status.state === "complete-for-review" &&
      (gaps > 0 || !status.candidate || status.hierarchyCompletenessState !== "candidate-complete" ||
       status.reviewState !== "ready-for-human-review" || status.reasons.length > 0)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires an exact review-ready Backlog Hierarchy candidate with no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Backlog Hierarchy status must expose reasons" })
  }
})

export const backlogHierarchyProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("backlog-hierarchy-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  }).strict(),
  status: backlogHierarchyStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.literal("candidate"), membershipDigest: digestSchema,
    nodeCount: z.number().int().nonnegative().max(10_000),
    epicCount: z.number().int().nonnegative().max(10_000),
    featureCount: z.number().int().nonnegative().max(10_000),
    storyCount: z.number().int().nonnegative().max(10_000),
    taskCount: z.number().int().nonnegative().max(10_000),
    requirementTraceCount: z.number().int().nonnegative().max(1_000_000),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal("projection-contains-record-identities-level-counts-statuses-and-digests-only-not-backlog-objectives-criteria-scope-owner-requirement-content-personal-data-secrets-credentials-or-machine-paths"),
  authorityBoundary: z.literal("backlog-hierarchy-projection-is-read-only-and-does-not-prioritize-commit-assign-admit-execute-or-authorize-implementation-or-action"),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Backlog Hierarchy projection must bind exact Product and Initiative revisions" })
  }
})

export type BacklogHierarchyInput = z.infer<typeof backlogHierarchyInputSchema>
export type BacklogHierarchy = z.infer<typeof backlogHierarchySchema>
export type BacklogHierarchyStatus = z.infer<typeof backlogHierarchyStatusSchema>
export type BacklogHierarchyProjection = z.infer<typeof backlogHierarchyProjectionSchema>
export type ExactBacklogHierarchyReference = z.infer<typeof exactBacklogHierarchyReferenceSchema>
