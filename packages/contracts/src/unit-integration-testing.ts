import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { changedUnitEvidenceReferenceSchema } from "./changed-unit-inventory.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,127}$/)
const requirementKeySchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const relativePathSchema = z.string().trim().min(1).max(4_096).superRefine((value, context) => {
  if (value.startsWith("/") || value.startsWith("\\") || /^[A-Za-z]:/u.test(value) || value.includes("\\") ||
      value.split("/").some((segment) => ["", ".", ".."].includes(segment))) {
    context.addIssue({ code: "custom", message: "Unit and Integration Testing candidates must use normalized repository-relative paths" })
  }
})
const exactReferenceSchema = z.object({ recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict()
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()
function unique(values: readonly string[]): boolean { return new Set(values).size === values.length }
function canonical(values: readonly string[]): boolean { const ordered = [...values].sort((a, b) => a.localeCompare(b)); return values.every((value, index) => value === ordered[index]) }
function canonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 512) { return z.array(schema).max(maximum).refine((values) => unique(values.map(String)), "Values must be unique").refine((values) => canonical(values.map(String)), "Values must use canonical lexical ordering") }
function requiredCanonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 512) { return canonicalList(schema, maximum).refine((values) => values.length > 0, "At least one value is required") }
function rejectSecrets<T extends z.ZodType>(schema: T): T { return schema.refine((value) => !containsSecretShapedValue(value), { message: "Portable Unit and Integration Testing candidates cannot contain secret-shaped values" }) as unknown as T }

export const unitIntegrationTestingDependencySchema = z.object({
  testGeneration: exactReferenceSchema,
  testMethodology: exactReferenceSchema,
  testInventory: exactReferenceSchema,
  acceptanceCriteria: exactReferenceSchema,
  implementationUnitModel: exactReferenceSchema,
  changedUnitInventory: exactReferenceSchema,
  proposedChangePreview: exactReferenceSchema,
  stagingWorkspace: exactReferenceSchema,
  changeConflictDetection: exactReferenceSchema,
  riskRegister: exactReferenceSchema,
  evidenceRegistry: exactReferenceSchema,
}).strict()

export const unitIntegrationAssessmentStateSchema = z.enum([
  "candidate-defined", "gap", "conflict", "stale", "unavailable", "not-assessed", "invalid",
])
export const unitIntegrationCaseKindSchema = z.enum(["unit", "integration"])
export const unitIntegrationTestCaseSchema = z.object({
  id: z.string().uuid(), ordinal: z.number().int().positive().max(65_536), caseKey: identifierSchema,
  kind: unitIntegrationCaseKindSchema, testInventoryAssetId: z.string().uuid(), methodologyScopeId: z.string().uuid(),
  acceptanceCriterionIds: requiredCanonicalList(z.string().uuid(), 4_096), requirementKeys: requiredCanonicalList(requirementKeySchema, 4_096),
  riskKeys: requiredCanonicalList(identifierSchema, 4_096), frameworkCandidate: identifierSchema, environmentCandidate: identifierSchema,
  fixtureCandidates: requiredCanonicalList(shortTextSchema, 4_096), oracleCandidates: requiredCanonicalList(shortTextSchema, 4_096),
  expectedCoverageCandidates: requiredCanonicalList(identifierSchema, 4_096), evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  repeatabilityState: z.enum(["candidate-repeatable", "gap", "not-assessed"]),
  isolationState: z.enum(["candidate-isolated", "gap", "not-assessed"]), state: unitIntegrationAssessmentStateSchema,
  productTestExecutionState: z.literal("not-performed"), productTestResultState: z.literal("not-established"),
  productCoverageTruthState: z.literal("not-established"), qualityState: z.literal("not-established"), acceptanceState: z.literal("not-established"),
}).strict().superRefine((testCase, context) => {
  if (testCase.state === "candidate-defined" && (testCase.repeatabilityState !== "candidate-repeatable" || testCase.isolationState !== "candidate-isolated")) {
    context.addIssue({ code: "custom", path: ["state"], message: "Defined test cases require candidate repeatability and isolation metadata" })
  }
})

export const unitIntegrationTestSuiteSchema = z.object({
  id: z.string().uuid(), ordinal: z.number().int().positive().max(65_536), suiteKey: identifierSchema,
  testGenerationTargetId: z.string().uuid(), changeConflictSubjectId: z.string().uuid(), implementationUnitId: z.string().uuid(),
  sourcePathCandidate: relativePathSchema, testPathCandidate: relativePathSchema,
  cases: z.array(unitIntegrationTestCaseSchema).min(2).max(65_536), evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  state: unitIntegrationAssessmentStateSchema, repositoryTruthState: z.literal("not-established"), sourceTruthState: z.literal("not-established"),
  testAssetTruthState: z.literal("not-established"), productExecutionState: z.literal("not-performed"), productResultState: z.literal("not-established"),
}).strict().superRefine((suite, context) => {
  if (suite.sourcePathCandidate === suite.testPathCandidate) context.addIssue({ code: "custom", path: ["testPathCandidate"], message: "Source and test path candidates must be distinct" })
  if (!unique(suite.cases.map((testCase) => testCase.id)) || !unique(suite.cases.map((testCase) => testCase.caseKey))) {
    context.addIssue({ code: "custom", path: ["cases"], message: "Test case identities and keys must be unique within a suite" })
  }
  suite.cases.forEach((testCase, index) => { if (testCase.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["cases", index, "ordinal"], message: "Test cases must use contiguous ordering" }) })
  if (suite.state === "candidate-defined" &&
      (!suite.cases.some((testCase) => testCase.kind === "unit") || !suite.cases.some((testCase) => testCase.kind === "integration") ||
       suite.cases.some((testCase) => testCase.state !== "candidate-defined"))) {
    context.addIssue({ code: "custom", path: ["state"], message: "Defined suites require defined unit and integration cases" })
  }
})

const inputBaseSchema = z.object({
  initiativeId: z.string().uuid(), context: businessContextBindingSchema, informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240), dependencies: unitIntegrationTestingDependencySchema,
  suites: z.array(unitIntegrationTestSuiteSchema).min(1).max(65_536), evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  preconditions: requiredCanonicalList(shortTextSchema, 256), unresolvedQuestions: canonicalList(shortTextSchema), limitations: requiredCanonicalList(shortTextSchema),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]), plannedBy: humanActorSchema, plannedAt: z.string().datetime(),
  repositoryTruthState: z.literal("not-established"), sourceTruthState: z.literal("not-established"), testAssetTruthState: z.literal("not-established"),
  localHarnessExecutionEvidenceState: z.literal("separate-not-bound-as-product-truth"), productTestExecutionState: z.literal("not-performed"),
  productTestResultState: z.literal("not-established"), productCoverageTruthState: z.literal("not-established"), qualityState: z.literal("not-established"),
  approvalState: z.literal("not-established"), acceptanceState: z.literal("not-established"), nativeHostAcceptanceState: z.literal("not-established"),
  securityAcceptanceState: z.literal("not-established"), releaseReadinessState: z.literal("not-established"), deploymentReadinessState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  if (!unique(candidate.suites.map((suite) => suite.id)) || !unique(candidate.suites.map((suite) => suite.suiteKey)) ||
      !unique(candidate.suites.map((suite) => suite.testGenerationTargetId)) || !unique(candidate.suites.map((suite) => suite.changeConflictSubjectId)) ||
      !unique(candidate.suites.map((suite) => suite.testPathCandidate))) {
    context.addIssue({ code: "custom", path: ["suites"], message: "Suite identities, keys, generation targets, change subjects, and test paths must be unique" })
  }
  candidate.suites.forEach((suite, index) => { if (suite.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["suites", index, "ordinal"], message: "Suites must use contiguous ordering" }) })
  if (candidate.reviewState === "ready-for-human-review" &&
      (candidate.unresolvedQuestions.length || candidate.suites.some((suite) => suite.state !== "candidate-defined"))) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready Unit and Integration Testing requires defined evidence-backed suites and no unresolved questions" })
  }
})

export const unitIntegrationTestingInputSchema = rejectSecrets(inputBaseSchema)
const authorityBoundary = "unit-integration-testing-is-a-versioned-portable-suite-candidate-and-does-not-inspect-source-create-or-mutate-tests-execute-product-tests-establish-results-coverage-quality-approval-acceptance-security-release-deployment-or-action-authority" as const
export const unitIntegrationTestingSchema = unitIntegrationTestingInputSchema.safeExtend({
  schemaVersion: z.literal(1), kind: z.literal("unit-integration-testing-candidate"), id: z.string().uuid(), productId: z.string().uuid(), revision: z.number().int().positive(),
  dependencyReceiptDigest: digestSchema, suiteReceiptDigest: digestSchema, caseReceiptDigest: digestSchema, fixtureOracleReceiptDigest: digestSchema,
  coverageReceiptDigest: digestSchema, evidenceReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema, predecessorDigest: digestSchema.optional(),
  state: z.literal("candidate"), createdBy: humanActorSchema, updatedBy: humanActorSchema, createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  authorityBoundary: z.literal(authorityBoundary),
}).strict().superRefine((record, context) => { if ((record.revision === 1) !== (record.predecessorDigest === undefined)) context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only later revisions require a predecessor digest" }) })

export const exactUnitIntegrationTestingReferenceSchema = exactReferenceSchema
const statusAuthorityBoundary = "unit-integration-testing-status-is-observational-and-grants-no-source-inspection-test-creation-mutation-product-execution-result-coverage-quality-approval-acceptance-security-release-deployment-or-action-authority" as const
export const unitIntegrationTestingStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("unit-integration-testing-status"), productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(), candidate: exactReferenceSchema.optional(),
  dependencies: unitIntegrationTestingDependencySchema.optional(), suiteCount: z.number().int().nonnegative(), caseCount: z.number().int().nonnegative(),
  unitCaseCount: z.number().int().nonnegative(), integrationCaseCount: z.number().int().nonnegative(), definedSuiteCount: z.number().int().nonnegative(),
  gapSuiteCount: z.number().int().nonnegative(), conflictSuiteCount: z.number().int().nonnegative(), staleSuiteCount: z.number().int().nonnegative(),
  unavailableSuiteCount: z.number().int().nonnegative(), notAssessedSuiteCount: z.number().int().nonnegative(), invalidSuiteCount: z.number().int().nonnegative(),
  staleBindingCount: z.number().int().nonnegative(), coverageGapCount: z.number().int().nonnegative(), invalidCandidateCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative(), reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "candidate-defined"]), reasons: z.array(shortTextSchema).max(2_048), assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict().superRefine((status, context) => {
  if (status.definedSuiteCount + status.gapSuiteCount + status.conflictSuiteCount + status.staleSuiteCount + status.unavailableSuiteCount +
      status.notAssessedSuiteCount + status.invalidSuiteCount !== status.suiteCount) context.addIssue({ code: "custom", path: ["suiteCount"], message: "Suite counts must reconcile" })
  if (status.unitCaseCount + status.integrationCaseCount !== status.caseCount) context.addIssue({ code: "custom", path: ["caseCount"], message: "Case counts must reconcile" })
})

const projectionAuthorityBoundary = "unit-integration-testing-projection-is-read-only-and-grants-no-source-inspection-test-creation-mutation-product-execution-result-coverage-quality-approval-acceptance-security-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-bounded-suite-case-path-framework-environment-trace-evidence-identities-counts-states-and-receipts-only-not-source-code-test-code-fixture-data-oracle-data-results-machine-paths-personal-data-secrets-credentials-or-permissions" as const
export const unitIntegrationTestingProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("unit-integration-testing-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: unitIntegrationTestingStatusSchema, candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    suites: z.array(z.object({ id: z.string().uuid(), suiteKey: identifierSchema, implementationUnitId: z.string().uuid(), sourcePathCandidate: relativePathSchema,
      testPathCandidate: relativePathSchema, unitCaseCount: z.number().int().nonnegative(), integrationCaseCount: z.number().int().nonnegative(),
      frameworkCandidates: canonicalList(identifierSchema, 256), environmentCandidates: canonicalList(identifierSchema, 256),
      fixtureCandidateCount: z.number().int().nonnegative(), oracleCandidateCount: z.number().int().nonnegative(), coverageCandidateCount: z.number().int().nonnegative(),
      state: unitIntegrationAssessmentStateSchema }).strict()).max(65_536),
    dependencyReceiptDigest: digestSchema, suiteReceiptDigest: digestSchema, caseReceiptDigest: digestSchema, fixtureOracleReceiptDigest: digestSchema,
    coverageReceiptDigest: digestSchema, evidenceReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(), observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary),
  authorityBoundary: z.literal(projectionAuthorityBoundary), snapshotDigest: digestSchema,
}).strict()

export type UnitIntegrationTestingInput = z.infer<typeof unitIntegrationTestingInputSchema>
export type UnitIntegrationTesting = z.infer<typeof unitIntegrationTestingSchema>
export type UnitIntegrationTestingStatus = z.infer<typeof unitIntegrationTestingStatusSchema>
export type UnitIntegrationTestingProjection = z.infer<typeof unitIntegrationTestingProjectionSchema>
