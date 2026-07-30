import { z } from "zod"

import { exactBacklogHierarchyReferenceSchema } from "./backlog-hierarchy.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactImplementationUnitModelReferenceSchema } from "./implementation-unit-model.js"
import { exactMvpSliceDefinitionReferenceSchema } from "./mvp-slice-definition.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"

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
    message: "Portable Dependency Mapping candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalTextListSchema = z.array(shortTextSchema).max(512)
  .refine(unique, "Values must be unique")
  .refine(canonical, "Values must use canonical lexical ordering")

export const dependencyEvidenceReferenceSchema = z.object({
  kind: z.enum([
    "architecture", "authorization", "data", "decision", "evidence", "implementation-unit",
    "integration", "process", "repository-observation", "requirement", "risk", "test",
  ]),
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

const dependencyEvidenceListSchema = z.array(dependencyEvidenceReferenceSchema).max(256).refine(
  (values) => unique(values.map((value) => `${value.kind}:${value.recordId}:${value.revision}:${value.digest}`)),
  "Dependency evidence references must be unique",
)

export const dependencyNodeSchema = z.object({
  implementationUnitId: z.string().uuid(),
  ordinal: z.number().int().positive().max(10_000),
  candidateEffortPoints: z.number().int().positive().max(100_000),
  estimateState: z.literal("candidate-not-validated"),
  evidenceReferences: dependencyEvidenceListSchema,
  assessedBy: humanActorSchema,
  assessedAt: z.string().datetime(),
}).strict()

export const dependencyKindSchema = z.enum([
  "build-time", "data", "deployment", "integration", "runtime", "test", "workflow",
])

export const dependencyStrengthSchema = z.enum(["advisory", "conditional", "required"])

export const dependencyEdgeSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(1_000_000),
  predecessorUnitId: z.string().uuid(),
  successorUnitId: z.string().uuid(),
  kind: dependencyKindSchema,
  strength: dependencyStrengthSchema,
  evidenceState: z.enum(["candidate-asserted", "not-assessed", "observed-not-validated"]),
  rationale: shortTextSchema,
  evidenceReferences: dependencyEvidenceListSchema,
  assessedBy: humanActorSchema,
  assessedAt: z.string().datetime(),
}).strict()

export const dependencyCriticalPathPolicySchema = z.object({
  algorithm: z.literal("longest-candidate-effort-path-v1"),
  tieBreak: z.literal("canonical-unit-ordinal-v1"),
}).strict()

const dependencyMappingInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  hierarchy: exactBacklogHierarchyReferenceSchema,
  mvpSliceDefinition: exactMvpSliceDefinitionReferenceSchema,
  implementationUnitModel: exactImplementationUnitModelReferenceSchema,
  nodes: z.array(dependencyNodeSchema).min(1).max(10_000),
  edges: z.array(dependencyEdgeSchema).max(1_000_000),
  criticalPathPolicy: dependencyCriticalPathPolicySchema,
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  dependencyTruthState: z.literal("not-established"),
  dependencyCompletenessState: z.literal("not-established"),
  criticalPathAuthorityState: z.literal("not-established"),
  sequencingCommitmentState: z.literal("not-established"),
  ownershipAppointmentState: z.literal("not-established"),
  implementationReadinessState: z.literal("not-established"),
  implementationCompletenessState: z.literal("not-established"),
  assignmentExecutionState: z.literal("not-established"),
  approvalState: z.literal("not-established"),
  acceptanceDecisionState: z.literal("not-established"),
  mergeReadinessState: z.literal("not-established"),
  releaseReadinessState: z.literal("not-established"),
  deploymentReadinessState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  const nodeIds = candidate.nodes.map((node) => node.implementationUnitId)
  if (!unique(nodeIds)) {
    context.addIssue({ code: "custom", path: ["nodes"], message: "Dependency nodes must reference each implementation unit at most once" })
  }
  for (const [index, node] of candidate.nodes.entries()) {
    if (node.ordinal !== index + 1) {
      context.addIssue({ code: "custom", path: ["nodes", index, "ordinal"], message: "Dependency nodes must use contiguous canonical ordinal ordering" })
    }
  }
  const nodeSet = new Set(nodeIds)
  const edgeIds = candidate.edges.map((edge) => edge.id)
  const edgePairs = candidate.edges.map((edge) => `${edge.predecessorUnitId}:${edge.successorUnitId}`)
  if (!unique(edgeIds) || !unique(edgePairs)) {
    context.addIssue({ code: "custom", path: ["edges"], message: "Dependency edge identities and directed unit pairs must be unique" })
  }
  for (const [index, edge] of candidate.edges.entries()) {
    if (edge.ordinal !== index + 1) {
      context.addIssue({ code: "custom", path: ["edges", index, "ordinal"], message: "Dependency edges must use contiguous canonical ordinal ordering" })
    }
    if (edge.predecessorUnitId === edge.successorUnitId) {
      context.addIssue({ code: "custom", path: ["edges", index], message: "A dependency edge cannot reference the same predecessor and successor unit" })
    }
    if (!nodeSet.has(edge.predecessorUnitId) || !nodeSet.has(edge.successorUnitId)) {
      context.addIssue({ code: "custom", path: ["edges", index], message: "Dependency edges must reference this exact node catalog" })
    }
  }
  const successors = new Map(nodeIds.map((id) => [id, [] as string[]]))
  for (const edge of candidate.edges) successors.get(edge.predecessorUnitId)?.push(edge.successorUnitId)
  const visiting = new Set<string>()
  const visited = new Set<string>()
  function visit(id: string): boolean {
    if (visiting.has(id)) return false
    if (visited.has(id)) return true
    visiting.add(id)
    for (const successor of successors.get(id) ?? []) if (!visit(successor)) return false
    visiting.delete(id)
    visited.add(id)
    return true
  }
  if (nodeIds.some((id) => !visit(id))) {
    context.addIssue({ code: "custom", path: ["edges"], message: "Dependency Mapping edges must form an acyclic directed graph" })
  }
  if (candidate.reviewState === "ready-for-human-review" &&
      (candidate.unresolvedQuestions.length > 0 || candidate.edges.some((edge) => edge.evidenceState === "not-assessed"))) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready Dependency Mapping requires assessed edge candidates and no unresolved questions" })
  }
})

export const dependencyMappingInputSchema = rejectSecrets(dependencyMappingInputBaseSchema)

export const dependencyCriticalPathSchema = z.object({
  algorithm: z.literal("longest-candidate-effort-path-v1"),
  tieBreak: z.literal("canonical-unit-ordinal-v1"),
  orderedUnitIds: z.array(z.string().uuid()).min(1).max(10_000).refine(unique, "Critical-path units must be unique"),
  totalCandidateEffortPoints: z.number().int().positive().max(1_000_000_000),
  pathDigest: digestSchema,
}).strict()

export const dependencyMappingSchema = dependencyMappingInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("dependency-mapping-candidate"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  graphDigest: digestSchema,
  criticalPath: dependencyCriticalPathSchema,
  criticalPathDigest: digestSchema,
  assessmentReceiptDigest: digestSchema,
  predecessorDigest: digestSchema.optional(),
  state: z.literal("candidate"),
  createdBy: humanActorSchema,
  updatedBy: humanActorSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  authorityBoundary: z.literal("dependency-mapping-is-a-versioned-candidate-and-does-not-establish-dependency-truth-or-completeness-critical-path-authority-sequencing-commitment-ownership-appointment-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority"),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Dependency Mapping revisions after revision one require an exact predecessor digest" })
  }
  const nodeIds = new Set(record.nodes.map((node) => node.implementationUnitId))
  if (record.criticalPath.orderedUnitIds.some((id) => !nodeIds.has(id))) {
    context.addIssue({ code: "custom", path: ["criticalPath", "orderedUnitIds"], message: "Critical-path units must reference this exact dependency node catalog" })
  }
  const pairs = new Set(record.edges.map((edge) => `${edge.predecessorUnitId}:${edge.successorUnitId}`))
  for (let index = 1; index < record.criticalPath.orderedUnitIds.length; index++) {
    const predecessor = record.criticalPath.orderedUnitIds[index - 1]!
    const successor = record.criticalPath.orderedUnitIds[index]!
    if (!pairs.has(`${predecessor}:${successor}`)) {
      context.addIssue({ code: "custom", path: ["criticalPath", "orderedUnitIds"], message: "Adjacent critical-path units require an exact directed dependency edge" })
    }
  }
  const efforts = new Map(record.nodes.map((node) => [node.implementationUnitId, node.candidateEffortPoints]))
  const total = record.criticalPath.orderedUnitIds.reduce((sum, id) => sum + (efforts.get(id) ?? 0), 0)
  if (total !== record.criticalPath.totalCandidateEffortPoints) {
    context.addIssue({ code: "custom", path: ["criticalPath", "totalCandidateEffortPoints"], message: "Critical-path candidate effort must reconcile with its exact node path" })
  }
})

export const exactDependencyMappingReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const dependencyMappingStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("dependency-mapping-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactDependencyMappingReferenceSchema.optional(),
  hierarchy: exactBacklogHierarchyReferenceSchema.optional(),
  mvpSliceDefinition: exactMvpSliceDefinitionReferenceSchema.optional(),
  implementationUnitModel: exactImplementationUnitModelReferenceSchema.optional(),
  nodeCount: z.number().int().nonnegative().max(10_000),
  edgeCount: z.number().int().nonnegative().max(1_000_000),
  requiredEdgeCount: z.number().int().nonnegative().max(1_000_000),
  conditionalEdgeCount: z.number().int().nonnegative().max(1_000_000),
  advisoryEdgeCount: z.number().int().nonnegative().max(1_000_000),
  rootNodeCount: z.number().int().nonnegative().max(10_000),
  leafNodeCount: z.number().int().nonnegative().max(10_000),
  criticalPathUnitCount: z.number().int().nonnegative().max(10_000),
  criticalPathCandidateEffortPoints: z.number().int().nonnegative().max(1_000_000_000),
  missingNodeCount: z.number().int().nonnegative().max(10_000),
  missingDeclaredEdgeCount: z.number().int().nonnegative().max(1_000_000),
  extraEdgeCount: z.number().int().nonnegative().max(1_000_000),
  invalidNodeCount: z.number().int().nonnegative().max(10_000),
  invalidEdgeCount: z.number().int().nonnegative().max(1_000_000),
  cycleCount: z.number().int().nonnegative().max(1),
  staleBindingCount: z.number().int().nonnegative().max(1),
  staleHierarchyCount: z.number().int().nonnegative().max(1),
  staleMvpSliceDefinitionCount: z.number().int().nonnegative().max(1),
  staleImplementationUnitModelCount: z.number().int().nonnegative().max(1),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "candidate-complete"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal("dependency-mapping-status-is-observational-and-does-not-establish-dependency-truth-or-completeness-critical-path-authority-sequencing-commitment-ownership-appointment-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority"),
}).strict().superRefine((status, context) => {
  if (status.requiredEdgeCount + status.conditionalEdgeCount + status.advisoryEdgeCount !== status.edgeCount) {
    context.addIssue({ code: "custom", path: ["edgeCount"], message: "Dependency edge strength counts must reconcile" })
  }
  const gaps = status.missingNodeCount + status.missingDeclaredEdgeCount + status.extraEdgeCount +
    status.invalidNodeCount + status.invalidEdgeCount + status.cycleCount + status.staleBindingCount +
    status.staleHierarchyCount + status.staleMvpSliceDefinitionCount + status.staleImplementationUnitModelCount +
    status.unresolvedQuestionCount
  if (status.state === "candidate-complete" &&
      (gaps > 0 || !status.candidate || !status.hierarchy || !status.mvpSliceDefinition ||
       !status.implementationUnitModel || status.reviewState !== "ready-for-human-review" ||
       status.criticalPathUnitCount < 1 || status.reasons.length > 0)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Candidate-complete Dependency Mapping requires exact current dependencies, complete unit and edge coverage, a critical-path candidate, review state, and no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Dependency Mapping status must expose reasons" })
  }
})

export const dependencyMappingProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("dependency-mapping-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  }).strict(),
  status: dependencyMappingStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.literal("candidate"), graphDigest: digestSchema, criticalPathDigest: digestSchema,
    assessmentReceiptDigest: digestSchema, nodeCount: z.number().int().nonnegative().max(10_000),
    edgeCount: z.number().int().nonnegative().max(1_000_000),
    criticalPathUnitCount: z.number().int().nonnegative().max(10_000),
    criticalPathCandidateEffortPoints: z.number().int().nonnegative().max(1_000_000_000),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal("projection-contains-record-identities-counts-statuses-and-graph-critical-path-assessment-snapshot-digests-only-not-unit-node-edge-evidence-rationale-estimate-owner-repository-module-requirement-architecture-risk-test-or-personal-data-secrets-credentials-or-machine-paths"),
  authorityBoundary: z.literal("dependency-mapping-projection-is-read-only-and-does-not-establish-dependency-truth-or-completeness-critical-path-authority-sequencing-commitment-ownership-appointment-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority"),
  snapshotDigest: digestSchema,
}).strict()

export type DependencyMappingInput = z.infer<typeof dependencyMappingInputSchema>
export type DependencyMapping = z.infer<typeof dependencyMappingSchema>
export type DependencyMappingStatus = z.infer<typeof dependencyMappingStatusSchema>
export type DependencyMappingProjection = z.infer<typeof dependencyMappingProjectionSchema>
