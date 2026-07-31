import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { changedUnitEvidenceReferenceSchema } from "./changed-unit-inventory.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,127}$/)
const requirementKeySchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const relativePathSchema = z.string().trim().min(1).max(512).superRefine((value, context) => {
  if (value.startsWith("/") || value.startsWith("\\") || /^[A-Za-z]:/u.test(value) || value.includes("\\") ||
      value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    context.addIssue({ code: "custom", message: "Code trace candidates must use normalized repository-relative paths" })
  }
})
const exactReferenceSchema = z.object({ recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict()
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()
function unique(values: readonly string[]): boolean { return new Set(values).size === values.length }
function canonical(values: readonly string[]): boolean { const ordered = [...values].sort((a, b) => a.localeCompare(b)); return values.every((v, i) => v === ordered[i]) }
function canonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 65_536) {
  return z.array(schema).max(maximum).refine((values) => unique(values.map(String)), "Values must be unique")
    .refine((values) => canonical(values.map(String)), "Values must use canonical lexical ordering")
}
function requiredCanonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 65_536) {
  return canonicalList(schema, maximum).refine((values) => values.length > 0, "At least one value is required")
}
function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), { message: "Portable Backlog-to-Code Traceability candidates cannot contain secret-shaped values" }) as unknown as T
}

export const backlogToCodeTraceabilityDependencySchema = z.object({
  backlogHierarchy: exactReferenceSchema,
  changedUnitInventory: exactReferenceSchema,
  proposedChangePreview: exactReferenceSchema,
  controlledDesignToCodeGeneration: exactReferenceSchema,
  designToCodeTraceability: exactReferenceSchema,
  boilerplateConstraintEnforcement: exactReferenceSchema,
  testInventory: exactReferenceSchema,
}).strict()

export const backlogCodeCommitReferenceCandidateSchema = z.object({
  id: z.string().uuid(), key: identifierSchema,
  identityDigestCandidate: digestSchema,
  source: z.enum(["expected-future", "historical-unverified", "run-evidence-candidate", "apply-decision-candidate"]),
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  repositoryCommitTruthState: z.literal("not-established"),
  attributionTruthState: z.literal("not-established"),
  acceptanceState: z.literal("not-established"),
}).strict()

export const backlogCodeTraceSchema = z.object({
  id: z.string().uuid(), ordinal: z.number().int().positive().max(65_536), traceKey: identifierSchema,
  backlogNodeId: z.string().uuid(), backlogNodeKey: identifierSchema, requirementKeys: requiredCanonicalList(requirementKeySchema),
  changedUnitId: z.string().uuid(), changedPathId: z.string().uuid(), implementationUnitId: z.string().uuid(),
  generationTargetId: z.string().uuid(), designTraceId: z.string().uuid(), constraintTargetId: z.string().uuid(),
  repositoryCandidate: identifierSchema, moduleCandidate: identifierSchema, pathCandidate: relativePathSchema,
  symbolCandidate: z.string().trim().min(1).max(512).optional(),
  testAssetIds: requiredCanonicalList(z.string().uuid()), testAssetKeys: requiredCanonicalList(identifierSchema),
  commitReferenceCandidates: z.array(backlogCodeCommitReferenceCandidateSchema).max(4_096),
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  conflictReferenceCandidates: z.array(changedUnitEvidenceReferenceSchema).max(2_048),
  traceState: z.enum(["candidate-linked", "gap", "conflict", "stale", "not-assessed"]),
  repositoryTruthState: z.literal("not-established"), codeTruthState: z.literal("not-established"),
  commitTruthState: z.literal("not-established"), testExecutionState: z.literal("not-performed"),
  testResultState: z.literal("not-established"), outcomeTruthState: z.literal("not-established"), acceptanceState: z.literal("not-established"),
}).strict().superRefine((trace, context) => {
  if (trace.traceState === "candidate-linked" && trace.conflictReferenceCandidates.length) context.addIssue({ code: "custom", path: ["conflictReferenceCandidates"], message: "Linked traces cannot carry conflicts" })
  if (trace.traceState === "conflict" && !trace.conflictReferenceCandidates.length) context.addIssue({ code: "custom", path: ["conflictReferenceCandidates"], message: "Conflicting traces require exact conflict evidence" })
})

const inputBaseSchema = z.object({
  initiativeId: z.string().uuid(), context: businessContextBindingSchema, informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240), dependencies: backlogToCodeTraceabilityDependencySchema,
  traces: z.array(backlogCodeTraceSchema).min(1).max(65_536),
  unresolvedQuestions: canonicalList(shortTextSchema, 512), limitations: requiredCanonicalList(shortTextSchema, 512),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]), traceCompletenessState: z.literal("not-established"),
  repositoryTruthState: z.literal("not-established"), codeTruthState: z.literal("not-established"), commitTruthState: z.literal("not-established"),
  testExecutionState: z.literal("not-performed"), testResultState: z.literal("not-established"), outcomeTruthState: z.literal("not-established"),
  approvalState: z.literal("not-established"), acceptanceState: z.literal("not-established"), nativeHostAcceptanceState: z.literal("not-established"),
  liveProviderAcceptanceState: z.literal("not-established"), securityAcceptanceState: z.literal("not-established"),
  releaseReadinessState: z.literal("not-established"), deploymentReadinessState: z.literal("not-established"), actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  if (!unique(candidate.traces.map((trace) => trace.id)) || !unique(candidate.traces.map((trace) => trace.traceKey)) ||
      !unique(candidate.traces.map((trace) => trace.changedPathId))) context.addIssue({ code: "custom", path: ["traces"], message: "Trace identities, keys, and changed paths must be unique" })
  candidate.traces.forEach((trace, index) => { if (trace.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["traces", index, "ordinal"], message: "Traces must use contiguous canonical ordering" }) })
  if (candidate.reviewState === "ready-for-human-review" && (candidate.unresolvedQuestions.length || candidate.traces.some((trace) => trace.traceState !== "candidate-linked"))) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready traceability requires linked traces and no unresolved questions" })
  }
})
export const backlogToCodeTraceabilityInputSchema = rejectSecrets(inputBaseSchema)
const authorityBoundary = "backlog-to-code-traceability-is-a-versioned-portable-metadata-candidate-and-does-not-establish-backlog-change-repository-path-symbol-code-commit-test-result-outcome-approval-acceptance-release-deployment-or-action-authority" as const
export const backlogToCodeTraceabilitySchema = backlogToCodeTraceabilityInputSchema.safeExtend({
  schemaVersion: z.literal(1), kind: z.literal("backlog-to-code-traceability-candidate"), id: z.string().uuid(), productId: z.string().uuid(),
  revision: z.number().int().positive(), dependencyReceiptDigest: digestSchema, traceCatalogDigest: digestSchema,
  commitCandidateReceiptDigest: digestSchema, testCoverageReceiptDigest: digestSchema, evidenceReceiptDigest: digestSchema,
  assessmentReceiptDigest: digestSchema, predecessorDigest: digestSchema.optional(), state: z.literal("candidate"),
  createdBy: humanActorSchema, updatedBy: humanActorSchema, createdAt: z.string().datetime(), updatedAt: z.string().datetime(), authorityBoundary: z.literal(authorityBoundary),
}).strict().superRefine((record, context) => { if ((record.revision === 1) !== (record.predecessorDigest === undefined)) context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only later revisions require a predecessor digest" }) })

const statusAuthorityBoundary = "backlog-to-code-traceability-status-is-observational-and-grants-no-repository-code-commit-test-outcome-approval-acceptance-release-deployment-or-action-authority" as const
export const backlogToCodeTraceabilityStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("backlog-to-code-traceability-status"), productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(), candidate: exactReferenceSchema.optional(), dependencies: backlogToCodeTraceabilityDependencySchema.optional(),
  traceCount: z.number().int().nonnegative(), backlogNodeCount: z.number().int().nonnegative(), changedPathCount: z.number().int().nonnegative(),
  codePathCount: z.number().int().nonnegative(), commitCandidateCount: z.number().int().nonnegative(), testAssetCount: z.number().int().nonnegative(),
  linkedCount: z.number().int().nonnegative(), gapCount: z.number().int().nonnegative(), conflictCount: z.number().int().nonnegative(), staleTraceCount: z.number().int().nonnegative(),
  staleBindingCount: z.number().int().nonnegative(), coverageGapCount: z.number().int().nonnegative(), invalidCandidateCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative(), reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "candidate-defined"]), reasons: z.array(shortTextSchema).max(2_048), assessedAt: z.string().datetime(), authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict()

const projectionAuthorityBoundary = "backlog-to-code-traceability-projection-is-read-only-and-grants-no-repository-code-commit-test-outcome-approval-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-bounded-backlog-change-path-symbol-commit-candidate-test-evidence-identities-states-counts-and-digests-only-not-source-code-commit-content-test-results-machine-paths-personal-data-secrets-credentials-or-permissions" as const
export const backlogToCodeTraceabilityProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("backlog-to-code-traceability-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: backlogToCodeTraceabilityStatusSchema,
  candidate: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    traces: z.array(z.object({ id: z.string().uuid(), traceKey: identifierSchema, backlogNodeKey: identifierSchema,
      repositoryCandidate: identifierSchema, moduleCandidate: identifierSchema, pathCandidate: relativePathSchema, symbolCandidate: z.string().optional(),
      testAssetKeys: requiredCanonicalList(identifierSchema), commitCandidateCount: z.number().int().nonnegative(), traceState: z.enum(["candidate-linked", "gap", "conflict", "stale", "not-assessed"]),
    }).strict()).max(65_536), dependencyReceiptDigest: digestSchema, traceCatalogDigest: digestSchema,
    commitCandidateReceiptDigest: digestSchema, testCoverageReceiptDigest: digestSchema, evidenceReceiptDigest: digestSchema,
    assessmentReceiptDigest: digestSchema, reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(), observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary), authorityBoundary: z.literal(projectionAuthorityBoundary), snapshotDigest: digestSchema,
}).strict()

export type BacklogToCodeTraceabilityInput = z.infer<typeof backlogToCodeTraceabilityInputSchema>
export type BacklogToCodeTraceability = z.infer<typeof backlogToCodeTraceabilitySchema>
export type BacklogToCodeTraceabilityStatus = z.infer<typeof backlogToCodeTraceabilityStatusSchema>
export type BacklogToCodeTraceabilityProjection = z.infer<typeof backlogToCodeTraceabilityProjectionSchema>
