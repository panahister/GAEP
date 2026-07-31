import { z } from "zod"

import { exactBacklogHierarchyReferenceSchema } from "./backlog-hierarchy.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactDependencyMappingReferenceSchema } from "./dependency-mapping.js"
import { exactDesignToCodeBindingRegistryReferenceSchema } from "./design-to-code-binding-registry.js"
import { exactImplementationReadinessGateReferenceSchema } from "./implementation-readiness-gate.js"
import { exactImplementationUnitModelReferenceSchema } from "./implementation-unit-model.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactRiskRegisterReferenceSchema } from "./risk-register.js"
import { exactRouteScreenComponentMappingReferenceSchema } from "./route-screen-component-mapping.js"
import { exactTestInventoryReferenceSchema } from "./test-inventory.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const identifierSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,127}$/)
const requirementKeySchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/)
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()
const exactReferenceSchema = z.object({ recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict()
const repositoryRelativePathSchema = z.string().trim().min(1).max(4_096).refine((value) => {
  if (value.startsWith("/") || value.includes("\\")) return false
  return value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
}, "Path candidates must be portable repository-relative paths")

function unique(values: readonly string[]): boolean { return new Set(values).size === values.length }
function canonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}
function canonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 32_768) {
  return z.array(schema).max(maximum)
    .refine((values) => unique(values.map(String)), "Values must be unique")
    .refine((values) => canonical(values.map(String)), "Values must use canonical lexical ordering")
}
function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Changed Unit Inventory candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const changedUnitChangeKindSchema = z.enum(["add", "delete", "modify", "move", "not-assessed"])
export const changedUnitOutcomeSchema = z.enum(["candidate-scoped", "conflict", "gap", "stale", "not-assessed"])
export const changedUnitEvidenceReferenceSchema = z.object({
  kind: z.enum(["artifact", "decision", "evidence", "review"]), sourceId: shortTextSchema,
  revision: z.number().int().positive(), digest: digestSchema,
  evidenceState: z.enum(["candidate-asserted", "human-reviewed", "source-recorded"]),
}).strict()
const evidenceListSchema = z.array(changedUnitEvidenceReferenceSchema).max(2_048).refine(
  (values) => unique(values.map((value) => `${value.kind}:${value.sourceId}:${value.revision}:${value.digest}`)),
  "Changed-unit evidence references must be unique",
)

export const realisticExampleBindingSchema = z.object({
  scenarioId: identifierSchema, revision: z.number().int().positive(),
  receiptDigest: digestSchema, compositionDigest: digestSchema,
}).strict()

export const changedPathCandidateSchema = z.object({
  id: z.string().uuid(), ordinal: z.number().int().positive().max(65_536),
  pathCandidate: repositoryRelativePathSchema, sourcePathCandidate: repositoryRelativePathSchema.optional(),
  changeKind: changedUnitChangeKindSchema,
  backlogNodeIds: canonicalList(z.string().uuid()), requirementKeys: canonicalList(requirementKeySchema),
  designToCodeBindingSubjectIds: canonicalList(z.string().uuid()),
  routeScreenComponentSubjectIds: canonicalList(z.string().uuid()),
  testAssetIds: canonicalList(z.string().uuid()), riskKeys: canonicalList(identifierSchema),
  evidenceReferences: evidenceListSchema,
}).strict().superRefine((candidate, context) => {
  if ((candidate.changeKind === "move") !== (candidate.sourcePathCandidate !== undefined)) {
    context.addIssue({ code: "custom", path: ["sourcePathCandidate"], message: "Only move candidates require an exact source path candidate" })
  }
})

export const changedUnitCandidateSchema = z.object({
  id: z.string().uuid(), ordinal: z.number().int().positive().max(65_536),
  implementationUnitId: z.string().uuid(), implementationUnitKey: identifierSchema,
  repositoryCandidate: identifierSchema, moduleCandidate: repositoryRelativePathSchema,
  pathCandidates: z.array(changedPathCandidateSchema).min(1).max(65_536),
  dependencyUnitIds: canonicalList(z.string().uuid()),
  directBlastRadiusUnitIds: canonicalList(z.string().uuid()),
  indirectBlastRadiusUnitIds: canonicalList(z.string().uuid()),
  affectedSurfaceKeys: canonicalList(identifierSchema),
  blastRadiusAssessmentState: z.enum(["candidate-assessed", "not-assessed"]),
  ownerCandidateIds: canonicalList(shortTextSchema, 512), reviewCandidateIds: canonicalList(shortTextSchema, 512),
  evidenceReferences: evidenceListSchema, outcome: changedUnitOutcomeSchema,
}).strict().superRefine((unit, context) => {
  const pathIds = unit.pathCandidates.map((path) => path.id)
  const paths = unit.pathCandidates.map((path) => path.pathCandidate)
  if (!unique(pathIds) || !unique(paths)) context.addIssue({ code: "custom", path: ["pathCandidates"], message: "Path candidate identities and paths must be unique within a unit" })
  unit.pathCandidates.forEach((path, index) => {
    if (path.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["pathCandidates", index, "ordinal"], message: "Path candidates must use contiguous canonical ordinal ordering" })
  })
  if (unit.outcome === "candidate-scoped" && (unit.evidenceReferences.length === 0 || unit.ownerCandidateIds.length === 0 || unit.pathCandidates.some((path) => path.changeKind === "not-assessed"))) {
    context.addIssue({ code: "custom", path: ["outcome"], message: "Candidate-scoped units require evidence, owner candidates, and assessed change kinds" })
  }
})

const dependencyShape = {
  backlogHierarchy: exactBacklogHierarchyReferenceSchema,
  implementationUnitModel: exactImplementationUnitModelReferenceSchema,
  dependencyMapping: exactDependencyMappingReferenceSchema,
  designToCodeBindingRegistry: exactDesignToCodeBindingRegistryReferenceSchema,
  routeScreenComponentMapping: exactRouteScreenComponentMappingReferenceSchema,
  testInventory: exactTestInventoryReferenceSchema,
  riskRegister: exactRiskRegisterReferenceSchema,
  implementationReadinessGate: exactImplementationReadinessGateReferenceSchema,
} as const

const inputBaseSchema = z.object({
  initiativeId: z.string().uuid(), context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema, title: z.string().trim().min(2).max(240),
  ...dependencyShape, realisticExample: realisticExampleBindingSchema,
  units: z.array(changedUnitCandidateSchema).min(1).max(65_536),
  unresolvedQuestions: canonicalList(shortTextSchema, 512),
  limitations: canonicalList(shortTextSchema, 512).refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  repositoryTruthState: z.literal("not-established"), pathTruthState: z.literal("not-established"),
  changeScopeApprovalState: z.literal("not-established"), changeApprovalState: z.literal("not-established"),
  ownershipAppointmentState: z.literal("not-established"), implementationReadinessState: z.literal("not-established"),
  codeMutationState: z.literal("not-performed"), stagingState: z.literal("not-performed"),
  assignmentExecutionState: z.literal("not-established"), acceptanceDecisionState: z.literal("not-established"),
  mergeReadinessState: z.literal("not-established"), releaseReadinessState: z.literal("not-established"),
  deploymentReadinessState: z.literal("not-established"), actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  const ids = candidate.units.map((unit) => unit.id)
  const implementationUnits = candidate.units.map((unit) => unit.implementationUnitId)
  if (!unique(ids) || !unique(implementationUnits)) context.addIssue({ code: "custom", path: ["units"], message: "Inventory unit and Implementation Unit identities must be unique" })
  candidate.units.forEach((unit, index) => {
    if (unit.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["units", index, "ordinal"], message: "Inventory units must use contiguous canonical ordinal ordering" })
  })
  if (candidate.reviewState === "ready-for-human-review" && (candidate.unresolvedQuestions.length > 0 || candidate.units.some((unit) => unit.outcome !== "candidate-scoped"))) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready inventory requires candidate-scoped units and no unresolved questions" })
  }
})

export const changedUnitInventoryInputSchema = rejectSecrets(inputBaseSchema)
const authorityBoundary = "changed-unit-inventory-is-a-versioned-candidate-and-does-not-establish-repository-or-path-truth-approved-change-scope-or-change-approval-owner-appointment-implementation-readiness-code-mutation-or-staging-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
export const changedUnitInventorySchema = changedUnitInventoryInputSchema.safeExtend({
  schemaVersion: z.literal(1), kind: z.literal("changed-unit-inventory-candidate"), id: z.string().uuid(), productId: z.string().uuid(),
  revision: z.number().int().positive(), dependencyReceiptDigest: digestSchema, inventoryReceiptDigest: digestSchema,
  traceReceiptDigest: digestSchema, blastRadiusReceiptDigest: digestSchema, evidenceReceiptDigest: digestSchema,
  ownershipReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema, predecessorDigest: digestSchema.optional(),
  state: z.literal("candidate"), createdBy: humanActorSchema, updatedBy: humanActorSchema,
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(), authorityBoundary: z.literal(authorityBoundary),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only revisions after revision one require an exact predecessor digest" })
})

export const exactChangedUnitInventoryReferenceSchema = exactReferenceSchema
const statusAuthorityBoundary = "changed-unit-inventory-status-is-observational-and-does-not-establish-repository-or-path-truth-approved-change-scope-or-change-approval-owner-appointment-implementation-readiness-code-mutation-or-staging-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
export const changedUnitInventoryStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("changed-unit-inventory-status"), productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(), candidate: exactReferenceSchema.optional(),
  backlogHierarchy: exactBacklogHierarchyReferenceSchema.optional(), implementationUnitModel: exactImplementationUnitModelReferenceSchema.optional(),
  dependencyMapping: exactDependencyMappingReferenceSchema.optional(), designToCodeBindingRegistry: exactDesignToCodeBindingRegistryReferenceSchema.optional(),
  routeScreenComponentMapping: exactRouteScreenComponentMappingReferenceSchema.optional(), testInventory: exactTestInventoryReferenceSchema.optional(),
  riskRegister: exactRiskRegisterReferenceSchema.optional(), implementationReadinessGate: exactImplementationReadinessGateReferenceSchema.optional(),
  realisticExample: realisticExampleBindingSchema.optional(), dependencyCount: z.number().int().nonnegative(), presentDependencyCount: z.number().int().nonnegative(),
  sourceUnitCount: z.number().int().nonnegative(), inventoryUnitCount: z.number().int().nonnegative(), pathCandidateCount: z.number().int().nonnegative(),
  candidateScopedCount: z.number().int().nonnegative(), gapCount: z.number().int().nonnegative(), conflictCount: z.number().int().nonnegative(),
  staleCount: z.number().int().nonnegative(), notAssessedCount: z.number().int().nonnegative(), orphanUnitCount: z.number().int().nonnegative(),
  traceGapCount: z.number().int().nonnegative(), evidenceGapCount: z.number().int().nonnegative(), ownershipGapCount: z.number().int().nonnegative(),
  blastRadiusGapCount: z.number().int().nonnegative(), staleBindingCount: z.number().int().nonnegative(), staleDependencyCount: z.number().int().nonnegative(),
  invalidCandidateCount: z.number().int().nonnegative(), unresolvedQuestionCount: z.number().int().nonnegative(),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]), state: z.enum(["attention-required", "candidate-inventoried"]),
  reasons: z.array(shortTextSchema).max(2_048), assessedAt: z.string().datetime(), authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict().superRefine((status, context) => {
  const gaps = status.dependencyCount - status.presentDependencyCount + status.gapCount + status.conflictCount + status.staleCount + status.notAssessedCount + status.orphanUnitCount + status.traceGapCount + status.evidenceGapCount + status.ownershipGapCount + status.blastRadiusGapCount + status.staleBindingCount + status.staleDependencyCount + status.invalidCandidateCount + status.unresolvedQuestionCount
  if (status.state === "candidate-inventoried" && (gaps > 0 || !status.candidate || status.reviewState !== "ready-for-human-review" || status.reasons.length > 0 || status.sourceUnitCount !== status.inventoryUnitCount)) context.addIssue({ code: "custom", path: ["state"], message: "Candidate-inventoried status requires exact dependencies, complete traceable inventory, and human-review candidacy" })
  if (status.state === "attention-required" && status.reasons.length === 0) context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required inventory must expose reasons" })
})

const projectionAuthorityBoundary = "changed-unit-inventory-projection-is-read-only-and-does-not-establish-repository-or-path-truth-approved-change-scope-or-change-approval-owner-appointment-implementation-readiness-code-mutation-or-staging-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-repository-relative-path-candidates-change-kinds-trace-counts-statuses-and-receipt-digests-only-not-file-content-evidence-content-owner-details-personal-data-secrets-credentials-or-machine-paths" as const
export const changedUnitInventoryProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("changed-unit-inventory-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: changedUnitInventoryStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.literal("candidate"),
    dependencyReceiptDigest: digestSchema, inventoryReceiptDigest: digestSchema, traceReceiptDigest: digestSchema,
    blastRadiusReceiptDigest: digestSchema, evidenceReceiptDigest: digestSchema, ownershipReceiptDigest: digestSchema,
    assessmentReceiptDigest: digestSchema, reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
    units: z.array(z.object({ implementationUnitId: z.string().uuid(), implementationUnitKey: identifierSchema,
      repositoryCandidate: identifierSchema, moduleCandidate: repositoryRelativePathSchema, outcome: changedUnitOutcomeSchema,
      paths: z.array(z.object({ pathCandidate: repositoryRelativePathSchema, sourcePathCandidate: repositoryRelativePathSchema.optional(), changeKind: changedUnitChangeKindSchema }).strict()).max(65_536),
    }).strict()).max(65_536),
  }).strict().optional(),
  observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary), authorityBoundary: z.literal(projectionAuthorityBoundary), snapshotDigest: digestSchema,
}).strict()

export type ChangedUnitInventoryInput = z.infer<typeof changedUnitInventoryInputSchema>
export type ChangedUnitInventory = z.infer<typeof changedUnitInventorySchema>
export type ChangedUnitInventoryStatus = z.infer<typeof changedUnitInventoryStatusSchema>
export type ChangedUnitInventoryProjection = z.infer<typeof changedUnitInventoryProjectionSchema>
