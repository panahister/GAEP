import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { changedUnitEvidenceReferenceSchema } from "./changed-unit-inventory.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,127}$/)
const requirementKeySchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const exactReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()
const relativePathSchema = z.string().trim().min(1).max(512).superRefine((value, context) => {
  if (value.startsWith("/") || value.startsWith("\\") || /^[A-Za-z]:/u.test(value) || value.includes("\\") ||
      value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    context.addIssue({ code: "custom", message: "Trace code targets must use normalized repository-relative paths" })
  }
})

function unique(values: readonly string[]): boolean { return new Set(values).size === values.length }
function canonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}
function canonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 65_536) {
  return z.array(schema).max(maximum)
    .refine((values) => unique(values.map(String)), "Values must be unique")
    .refine((values) => canonical(values.map(String)), "Values must use canonical lexical ordering")
}
function requiredCanonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 65_536) {
  return canonicalList(schema, maximum).refine((values) => values.length > 0, "At least one value is required")
}
function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Design-to-Code Traceability candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const designToCodeTraceabilityDependencySchema = z.object({
  controlledDesignToCodeGeneration: exactReferenceSchema,
  approvedFigmaContextRetrieval: exactReferenceSchema,
  designBaseline: exactReferenceSchema,
  designToRequirementBinding: exactReferenceSchema,
  figmaToBoilerplateMapping: exactReferenceSchema,
  designToCodeBindingRegistry: exactReferenceSchema,
  routeScreenComponentMapping: exactReferenceSchema,
  backlogHierarchy: exactReferenceSchema,
  acceptanceCriteria: exactReferenceSchema,
  implementationUnitModel: exactReferenceSchema,
  proposedChangePreview: exactReferenceSchema,
  testInventory: exactReferenceSchema,
}).strict()

export const designToCodeTraceStateSchema = z.enum([
  "candidate-linked", "gap", "conflict", "stale", "not-assessed",
])

export const designToCodeTraceSubjectSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(65_536),
  traceKey: identifierSchema,
  generationTargetId: z.string().uuid(),
  generationTargetKey: identifierSchema,
  designToCodeBindingSubjectId: z.string().uuid(),
  designBindingKey: identifierSchema,
  designItemKey: identifierSchema,
  designItemKind: z.enum(["component", "component-set", "file", "prototype-flow", "style", "variable", "variable-collection"]),
  approvedExternalVersionDigest: digestSchema,
  baselineSemanticVersion: z.string().regex(/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?$/),
  requirementKeys: requiredCanonicalList(requirementKeySchema),
  backlogNodeIds: requiredCanonicalList(z.string().uuid()),
  backlogNodeKeys: requiredCanonicalList(identifierSchema),
  acceptanceCriterionIds: requiredCanonicalList(z.string().uuid()),
  acceptanceCriterionKeys: requiredCanonicalList(identifierSchema),
  implementationUnitId: z.string().uuid(),
  repositoryCandidate: identifierSchema,
  moduleCandidate: identifierSchema,
  pathCandidate: relativePathSchema,
  symbolCandidate: z.string().trim().min(1).max(512).optional(),
  expectedTestOutputs: requiredCanonicalList(shortTextSchema, 4_096),
  associatedTestAssetIds: requiredCanonicalList(z.string().uuid()),
  associatedTestAssetKeys: requiredCanonicalList(identifierSchema),
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  conflictReferenceCandidates: z.array(changedUnitEvidenceReferenceSchema).max(2_048),
  traceState: designToCodeTraceStateSchema,
  repositoryTruthState: z.literal("not-established"),
  pathSymbolTruthState: z.literal("not-established"),
  generatedOutputTruthState: z.literal("not-established"),
  testExecutionState: z.literal("not-performed"),
  testResultState: z.literal("not-established"),
  acceptanceState: z.literal("not-established"),
}).strict().superRefine((subject, context) => {
  if (subject.traceState === "candidate-linked" && subject.conflictReferenceCandidates.length > 0) {
    context.addIssue({ code: "custom", path: ["conflictReferenceCandidates"], message: "Linked trace candidates cannot carry conflicts" })
  }
  if (subject.traceState === "conflict" && subject.conflictReferenceCandidates.length === 0) {
    context.addIssue({ code: "custom", path: ["conflictReferenceCandidates"], message: "Conflicting trace candidates require exact conflict evidence" })
  }
})

const inputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  dependencies: designToCodeTraceabilityDependencySchema,
  traces: z.array(designToCodeTraceSubjectSchema).min(1).max(65_536),
  unresolvedQuestions: canonicalList(shortTextSchema, 512),
  limitations: canonicalList(shortTextSchema, 512).refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  designContentState: z.literal("not-materialized"),
  repositoryTruthState: z.literal("not-established"),
  sourceTruthState: z.literal("not-established"),
  pathSymbolTruthState: z.literal("not-established"),
  generatedOutputTruthState: z.literal("not-established"),
  testExecutionState: z.literal("not-performed"),
  testResultState: z.literal("not-established"),
  traceCompletenessState: z.literal("not-established"),
  approvalState: z.literal("not-established"),
  acceptanceState: z.literal("not-established"),
  nativeHostAcceptanceState: z.literal("not-established"),
  liveProviderAcceptanceState: z.literal("not-established"),
  securityAcceptanceState: z.literal("not-established"),
  releaseReadinessState: z.literal("not-established"),
  deploymentReadinessState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  if (!unique(candidate.traces.map((trace) => trace.id)) || !unique(candidate.traces.map((trace) => trace.traceKey)) ||
      !unique(candidate.traces.map((trace) => trace.generationTargetId))) {
    context.addIssue({ code: "custom", path: ["traces"], message: "Trace identities, keys, and generation targets must be unique" })
  }
  candidate.traces.forEach((trace, index) => {
    if (trace.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["traces", index, "ordinal"], message: "Traces must use contiguous canonical ordering" })
  })
  if (candidate.reviewState === "ready-for-human-review" &&
      (candidate.unresolvedQuestions.length > 0 || candidate.traces.some((trace) => trace.traceState !== "candidate-linked"))) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready traceability requires linked evidence-backed traces and no unresolved questions" })
  }
})

export const designToCodeTraceabilityInputSchema = rejectSecrets(inputBaseSchema)
const authorityBoundary = "design-to-code-traceability-is-a-versioned-portable-metadata-candidate-and-does-not-access-figma-or-protected-design-content-establish-design-requirement-backlog-acceptance-implementation-repository-path-symbol-generated-output-test-result-trace-completeness-approval-acceptance-release-deployment-or-action-authority" as const
export const designToCodeTraceabilitySchema = designToCodeTraceabilityInputSchema.safeExtend({
  schemaVersion: z.literal(1), kind: z.literal("design-to-code-traceability-candidate"),
  id: z.string().uuid(), productId: z.string().uuid(), revision: z.number().int().positive(),
  dependencyReceiptDigest: digestSchema, designVersionReceiptDigest: digestSchema,
  traceCatalogDigest: digestSchema, coverageReceiptDigest: digestSchema, evidenceReceiptDigest: digestSchema,
  assessmentReceiptDigest: digestSchema, predecessorDigest: digestSchema.optional(), state: z.literal("candidate"),
  createdBy: humanActorSchema, updatedBy: humanActorSchema, createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  authorityBoundary: z.literal(authorityBoundary),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only revisions after revision one require a predecessor digest" })
  }
})

export const exactDesignToCodeTraceabilityReferenceSchema = exactReferenceSchema
const statusAuthorityBoundary = "design-to-code-traceability-status-is-observational-and-grants-no-design-source-repository-symbol-output-test-approval-acceptance-release-deployment-or-action-authority" as const
export const designToCodeTraceabilityStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("design-to-code-traceability-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactReferenceSchema.optional(), dependencies: designToCodeTraceabilityDependencySchema.optional(),
  traceCount: z.number().int().nonnegative(), generationTargetCount: z.number().int().nonnegative(),
  requirementCount: z.number().int().nonnegative(), backlogNodeCount: z.number().int().nonnegative(),
  acceptanceCriterionCount: z.number().int().nonnegative(), implementationUnitCount: z.number().int().nonnegative(),
  codePathCount: z.number().int().nonnegative(), associatedTestCount: z.number().int().nonnegative(),
  linkedCount: z.number().int().nonnegative(), gapCount: z.number().int().nonnegative(), conflictCount: z.number().int().nonnegative(),
  staleTraceCount: z.number().int().nonnegative(), staleBindingCount: z.number().int().nonnegative(),
  coverageGapCount: z.number().int().nonnegative(), evidenceGapCount: z.number().int().nonnegative(), invalidCandidateCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative(), reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "candidate-defined"]), reasons: z.array(shortTextSchema).max(2_048),
  assessedAt: z.string().datetime(), authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict()

const projectionAuthorityBoundary = "design-to-code-traceability-projection-is-read-only-and-grants-no-design-source-repository-symbol-output-test-approval-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-bounded-identities-versions-repository-relative-candidate-locations-test-keys-states-and-digests-only-not-design-or-source-content-generated-output-test-results-machine-paths-personal-data-secrets-credentials-or-permissions" as const
const traceProjectionSchema = z.object({
  id: z.string().uuid(), traceKey: identifierSchema, generationTargetId: z.string().uuid(),
  generationTargetKey: identifierSchema, designItemKey: identifierSchema, approvedExternalVersionDigest: digestSchema,
  baselineSemanticVersion: z.string(), requirementKeys: requiredCanonicalList(requirementKeySchema),
  backlogNodeKeys: requiredCanonicalList(identifierSchema), acceptanceCriterionKeys: requiredCanonicalList(identifierSchema),
  implementationUnitId: z.string().uuid(), repositoryCandidate: identifierSchema, moduleCandidate: identifierSchema,
  pathCandidate: relativePathSchema, symbolCandidate: z.string().trim().min(1).max(512).optional(),
  associatedTestAssetKeys: requiredCanonicalList(identifierSchema), traceState: designToCodeTraceStateSchema,
  evidenceReferenceCount: z.number().int().positive(),
}).strict()
export const designToCodeTraceabilityProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("design-to-code-traceability-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: designToCodeTraceabilityStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.literal("candidate"),
    approvedExternalVersionDigest: digestSchema, baselineSemanticVersion: z.string(), traces: z.array(traceProjectionSchema).max(65_536),
    dependencyReceiptDigest: digestSchema, designVersionReceiptDigest: digestSchema, traceCatalogDigest: digestSchema,
    coverageReceiptDigest: digestSchema, evidenceReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary),
  authorityBoundary: z.literal(projectionAuthorityBoundary), snapshotDigest: digestSchema,
}).strict()

export type DesignToCodeTraceabilityInput = z.infer<typeof designToCodeTraceabilityInputSchema>
export type DesignToCodeTraceability = z.infer<typeof designToCodeTraceabilitySchema>
export type DesignToCodeTraceabilityStatus = z.infer<typeof designToCodeTraceabilityStatusSchema>
export type DesignToCodeTraceabilityProjection = z.infer<typeof designToCodeTraceabilityProjectionSchema>
