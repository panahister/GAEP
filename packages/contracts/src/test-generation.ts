import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { changedUnitEvidenceReferenceSchema } from "./changed-unit-inventory.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { testInventoryKindSchema } from "./test-inventory.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,127}$/)
const requirementKeySchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const relativePathSchema = z.string().trim().min(1).max(4_096).superRefine((value, context) => {
  if (value.startsWith("/") || value.startsWith("\\") || /^[A-Za-z]:/u.test(value) || value.includes("\\") || value.split("/").some((segment) => ["", ".", ".."].includes(segment))) context.addIssue({ code: "custom", message: "Test Generation candidates must use normalized repository-relative paths" })
})
const exactReferenceSchema = z.object({ recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict()
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()
function unique(values: readonly string[]): boolean { return new Set(values).size === values.length }
function canonical(values: readonly string[]): boolean { const ordered = [...values].sort((a, b) => a.localeCompare(b)); return values.every((value, index) => value === ordered[index]) }
function canonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 512) { return z.array(schema).max(maximum).refine((values) => unique(values.map(String)), "Values must be unique").refine((values) => canonical(values.map(String)), "Values must use canonical lexical ordering") }
function requiredCanonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 512) { return canonicalList(schema, maximum).refine((values) => values.length > 0, "At least one value is required") }
function rejectSecrets<T extends z.ZodType>(schema: T): T { return schema.refine((value) => !containsSecretShapedValue(value), { message: "Portable Test Generation candidates cannot contain secret-shaped values" }) as unknown as T }

export const testGenerationDependencySchema = z.object({
  acceptanceCriteria: exactReferenceSchema,
  testMethodology: exactReferenceSchema,
  testInventory: exactReferenceSchema,
  implementationUnitModel: exactReferenceSchema,
  designToCodeTraceability: exactReferenceSchema,
  backlogToCodeTraceability: exactReferenceSchema,
  controlledDesignToCodeGeneration: exactReferenceSchema,
  proposedChangePreview: exactReferenceSchema,
  stagingWorkspace: exactReferenceSchema,
  changeConflictDetection: exactReferenceSchema,
}).strict()

export const testGenerationTargetStateSchema = z.enum(["candidate-defined", "gap", "conflict", "stale", "unavailable", "not-assessed"])
export const testGenerationTargetSchema = z.object({
  id: z.string().uuid(), ordinal: z.number().int().positive().max(65_536), targetKey: identifierSchema,
  changeConflictSubjectId: z.string().uuid(), generationTargetId: z.string().uuid(), designTraceId: z.string().uuid(), backlogTraceId: z.string().uuid(),
  implementationUnitId: z.string().uuid(), acceptanceCriterionIds: requiredCanonicalList(z.string().uuid(), 4_096),
  testInventoryAssetIds: requiredCanonicalList(z.string().uuid(), 4_096), methodologyScopeIds: requiredCanonicalList(z.string().uuid(), 4_096),
  requirementKeys: requiredCanonicalList(requirementKeySchema, 4_096), sourcePathCandidate: relativePathSchema, testPathCandidate: relativePathSchema,
  sourceSymbolCandidate: z.string().trim().min(1).max(512).optional(), testSymbolCandidate: z.string().trim().min(1).max(512).optional(),
  testKind: testInventoryKindSchema, frameworkCandidate: identifierSchema,
  fixtureCandidates: canonicalList(shortTextSchema, 4_096), oracleCandidates: requiredCanonicalList(shortTextSchema, 4_096),
  coverageTraceCandidates: requiredCanonicalList(identifierSchema, 4_096), riskTraceCandidates: requiredCanonicalList(identifierSchema, 4_096),
  expectedOutputCandidates: requiredCanonicalList(shortTextSchema, 4_096), evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  conflictReferenceCandidates: z.array(changedUnitEvidenceReferenceSchema).max(2_048), state: testGenerationTargetStateSchema,
  sourceInspectionState: z.literal("not-performed"), generationState: z.literal("not-performed"), testExecutionState: z.literal("not-performed"),
  testResultState: z.literal("not-established"), coverageTruthState: z.literal("not-established"), qualityState: z.literal("not-established"), acceptanceState: z.literal("not-established"),
}).strict().superRefine((target, context) => {
  if (target.sourcePathCandidate === target.testPathCandidate) context.addIssue({ code: "custom", path: ["testPathCandidate"], message: "Source and expected test path candidates must be distinct" })
  if (target.state === "candidate-defined" && target.conflictReferenceCandidates.length) context.addIssue({ code: "custom", path: ["conflictReferenceCandidates"], message: "Defined test candidates cannot carry conflict references" })
  if (target.state === "conflict" && !target.conflictReferenceCandidates.length) context.addIssue({ code: "custom", path: ["conflictReferenceCandidates"], message: "Conflicting test candidates require exact conflict evidence" })
})

const inputBaseSchema = z.object({
  initiativeId: z.string().uuid(), context: businessContextBindingSchema, informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240), dependencies: testGenerationDependencySchema, targets: z.array(testGenerationTargetSchema).min(1).max(65_536),
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048), preconditions: requiredCanonicalList(shortTextSchema, 256),
  unresolvedQuestions: canonicalList(shortTextSchema), limitations: requiredCanonicalList(shortTextSchema), reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  plannedBy: humanActorSchema, plannedAt: z.string().datetime(), repositoryTruthState: z.literal("not-established"), sourceTruthState: z.literal("not-established"),
  testAssetTruthState: z.literal("not-established"), generationState: z.literal("not-performed"), sourceMutationState: z.literal("not-performed"),
  testExecutionState: z.literal("not-performed"), testResultState: z.literal("not-established"), coverageTruthState: z.literal("not-established"),
  qualityState: z.literal("not-established"), approvalState: z.literal("not-established"), acceptanceState: z.literal("not-established"),
  nativeHostAcceptanceState: z.literal("not-established"), liveProviderAcceptanceState: z.literal("not-established"), securityAcceptanceState: z.literal("not-established"),
  releaseReadinessState: z.literal("not-established"), deploymentReadinessState: z.literal("not-established"), actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  if (!unique(candidate.targets.map((target) => target.id)) || !unique(candidate.targets.map((target) => target.targetKey)) ||
      !unique(candidate.targets.map((target) => target.changeConflictSubjectId)) || !unique(candidate.targets.map((target) => target.testPathCandidate))) {
    context.addIssue({ code: "custom", path: ["targets"], message: "Test target identities, keys, change subjects, and expected paths must be unique" })
  }
  candidate.targets.forEach((target, index) => { if (target.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["targets", index, "ordinal"], message: "Test targets must use contiguous ordering" }) })
  if (candidate.reviewState === "ready-for-human-review" && (candidate.unresolvedQuestions.length || candidate.targets.some((target) => target.state !== "candidate-defined"))) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready Test Generation requires defined evidence-backed targets and no unresolved questions" })
  }
})

export const testGenerationInputSchema = rejectSecrets(inputBaseSchema)
const authorityBoundary = "test-generation-is-a-versioned-portable-plan-candidate-and-does-not-inspect-source-create-or-mutate-files-generate-or-execute-tests-establish-results-coverage-quality-approval-acceptance-release-deployment-or-action-authority" as const
export const testGenerationSchema = testGenerationInputSchema.safeExtend({
  schemaVersion: z.literal(1), kind: z.literal("test-generation-candidate"), id: z.string().uuid(), productId: z.string().uuid(), revision: z.number().int().positive(),
  dependencyReceiptDigest: digestSchema, targetCatalogDigest: digestSchema, pathSymbolReceiptDigest: digestSchema, fixtureOracleReceiptDigest: digestSchema,
  traceReceiptDigest: digestSchema, evidenceReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema, predecessorDigest: digestSchema.optional(),
  state: z.literal("candidate"), createdBy: humanActorSchema, updatedBy: humanActorSchema, createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  authorityBoundary: z.literal(authorityBoundary),
}).strict().superRefine((record, context) => { if ((record.revision === 1) !== (record.predecessorDigest === undefined)) context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only later revisions require a predecessor digest" }) })

export const exactTestGenerationReferenceSchema = exactReferenceSchema
const statusAuthorityBoundary = "test-generation-status-is-observational-and-grants-no-source-inspection-file-creation-mutation-test-generation-execution-result-coverage-quality-approval-acceptance-release-deployment-or-action-authority" as const
export const testGenerationStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("test-generation-status"), productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(), candidate: exactReferenceSchema.optional(), dependencies: testGenerationDependencySchema.optional(),
  targetCount: z.number().int().nonnegative(), definedCount: z.number().int().nonnegative(), gapCount: z.number().int().nonnegative(), conflictCount: z.number().int().nonnegative(),
  staleCount: z.number().int().nonnegative(), unavailableCount: z.number().int().nonnegative(), notAssessedCount: z.number().int().nonnegative(),
  staleBindingCount: z.number().int().nonnegative(), coverageGapCount: z.number().int().nonnegative(), invalidCandidateCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative(), reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "candidate-defined"]), reasons: z.array(shortTextSchema).max(2_048), assessedAt: z.string().datetime(), authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict().superRefine((status, context) => {
  if (status.definedCount + status.gapCount + status.conflictCount + status.staleCount + status.unavailableCount + status.notAssessedCount !== status.targetCount) context.addIssue({ code: "custom", path: ["targetCount"], message: "Test Generation target counts must reconcile" })
})

const projectionAuthorityBoundary = "test-generation-projection-is-read-only-and-grants-no-source-inspection-file-creation-mutation-test-generation-execution-result-coverage-quality-approval-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-bounded-test-path-symbol-framework-fixture-oracle-trace-evidence-identities-states-counts-and-receipts-only-not-source-code-generated-tests-results-machine-paths-personal-data-secrets-credentials-or-permissions" as const
export const testGenerationProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("test-generation-projection"), product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: testGenerationStatusSchema, candidate: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    targets: z.array(z.object({ id: z.string().uuid(), targetKey: identifierSchema, sourcePathCandidate: relativePathSchema, testPathCandidate: relativePathSchema,
      sourceSymbolCandidate: z.string().optional(), testSymbolCandidate: z.string().optional(), testKind: testInventoryKindSchema, frameworkCandidate: identifierSchema,
      fixtureCandidateCount: z.number().int().nonnegative(), oracleCandidateCount: z.number().int().nonnegative(), coverageTraceCount: z.number().int().nonnegative(),
      riskTraceCount: z.number().int().nonnegative(), state: testGenerationTargetStateSchema }).strict()).max(65_536),
    dependencyReceiptDigest: digestSchema, targetCatalogDigest: digestSchema, pathSymbolReceiptDigest: digestSchema, fixtureOracleReceiptDigest: digestSchema,
    traceReceiptDigest: digestSchema, evidenceReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema, reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(), observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary), authorityBoundary: z.literal(projectionAuthorityBoundary), snapshotDigest: digestSchema,
}).strict()

export type TestGenerationInput = z.infer<typeof testGenerationInputSchema>
export type TestGeneration = z.infer<typeof testGenerationSchema>
export type TestGenerationStatus = z.infer<typeof testGenerationStatusSchema>
export type TestGenerationProjection = z.infer<typeof testGenerationProjectionSchema>
