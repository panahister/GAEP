import { z } from "zod"

import { exactAcceptanceCriteriaReferenceSchema } from "./acceptance-criteria.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactDefinitionOfDoneReferenceSchema } from "./definition-of-done.js"
import { exactDefinitionOfReadyReferenceSchema } from "./definition-of-ready.js"
import { exactDependencyMappingReferenceSchema } from "./dependency-mapping.js"
import { exactImplementationUnitModelReferenceSchema } from "./implementation-unit-model.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactRouteScreenComponentMappingReferenceSchema } from "./route-screen-component-mapping.js"
import { exactSecurityPrivacyAssessmentReferenceSchema } from "./security-privacy-assessment.js"

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
    message: "Portable Test Methodology candidates cannot contain secret-shaped values",
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

export const testMethodologyMethodKinds = [
  "acceptance-test-driven", "behavior-driven", "contract-testing", "example-mapping", "exploratory",
  "model-based", "property-based", "risk-based", "scenario-based", "test-driven",
] as const
export const testMethodologyMethodKindSchema = z.enum(testMethodologyMethodKinds)
export const testMethodologyLevels = [
  "acceptance", "accessibility", "component", "contract", "end-to-end", "integration", "performance",
  "recovery", "security", "system", "unit",
] as const
export const testMethodologyLevelSchema = z.enum(testMethodologyLevels)
export const testMethodologyRepresentations = [
  "benchmark", "checklist", "contract-schema", "example-map", "gherkin", "manual-script", "model",
  "property", "test-code", "threat-scenario",
] as const
export const testMethodologyRepresentationSchema = z.enum(testMethodologyRepresentations)
export const testMethodologyDispositionSchema = z.enum([
  "candidate-selected", "candidate-conflict", "candidate-not-applicable", "deferred", "not-assessed",
])

export const testMethodologyEvidenceReferenceSchema = z.object({
  kind: z.enum([
    "acceptance-criteria", "definition-of-done", "definition-of-ready", "dependency-mapping", "evidence",
    "implementation-unit", "requirement", "route-screen-component-mapping", "security-privacy-assessment",
    "test-inventory",
  ]),
  sourceId: shortTextSchema,
  revision: z.number().int().positive(),
  digest: digestSchema,
  evidenceState: z.enum(["candidate-asserted", "human-reviewed", "source-recorded"]),
}).strict()

const evidenceListSchema = z.array(testMethodologyEvidenceReferenceSchema).max(512).refine(
  (values) => unique(values.map((value) => `${value.kind}:${value.sourceId}:${value.revision}:${value.digest}`)),
  "Test Methodology evidence references must be unique",
)

export const testMethodologyScopeSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(65_536),
  implementationUnitId: z.string().uuid(),
  requirementKeys: requiredCanonicalRequirementKeysSchema,
  acceptanceCriterionIds: requiredCanonicalUuidsSchema,
  routeScreenComponentSubjectIds: canonicalUuidsSchema,
  threatCandidates: canonicalIdentifiersSchema,
  riskClass: z.enum(["critical", "high", "medium", "low", "not-assessed"]),
  evidenceReferences: evidenceListSchema,
}).strict()

export const testMethodologyEnvironmentSchema = z.object({
  id: identifierSchema,
  ordinal: z.number().int().positive().max(4_096),
  kind: z.enum(["local", "ci", "integration", "staging", "browser", "device", "production-shadow"]),
  platformKeys: requiredCanonicalIdentifiersSchema,
  availabilityState: z.enum(["candidate-available", "candidate-unavailable", "not-assessed"]),
  isolationState: z.enum(["candidate-isolated", "candidate-shared", "not-assessed"]),
  evidenceReferences: evidenceListSchema,
}).strict()

export const testMethodologyDataPolicySchema = z.object({
  id: identifierSchema,
  ordinal: z.number().int().positive().max(4_096),
  dataClass: z.enum(["anonymized", "masked", "none", "production-like", "synthetic"]),
  privacyReviewState: z.enum(["candidate-reviewed", "candidate-required", "not-assessed"]),
  retentionDaysCandidate: z.number().int().nonnegative().max(3_650),
  externalTransferState: z.literal("not-authorized"),
  evidenceReferences: evidenceListSchema,
}).strict()

export const testMethodologyEvidenceExpectationSchema = z.object({
  id: identifierSchema,
  ordinal: z.number().int().positive().max(8_192),
  kind: z.enum(["artifact", "coverage-observation", "human-review", "log", "report", "result", "trace"]),
  requiredState: z.enum(["candidate-required", "candidate-not-applicable", "not-assessed"]),
  retentionClass: z.enum(["ephemeral", "phase-record", "release-record"]),
}).strict()

export const testMethodologyDecisionSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(65_536),
  scopeId: z.string().uuid(),
  methodKind: testMethodologyMethodKindSchema,
  level: testMethodologyLevelSchema,
  representation: testMethodologyRepresentationSchema,
  disposition: testMethodologyDispositionSchema,
  automationIntent: z.enum(["automated", "hybrid", "manual", "not-assessed"]),
  environmentIds: canonicalIdentifiersSchema,
  dataPolicyIds: canonicalIdentifiersSchema,
  evidenceExpectationIds: canonicalIdentifiersSchema,
  ownerCandidateIds: canonicalTextListSchema,
  entryCriterionIds: requiredCanonicalIdentifiersSchema,
  exitCriterionIds: requiredCanonicalIdentifiersSchema,
  evidenceReferences: evidenceListSchema,
  conflictReferenceCandidates: evidenceListSchema,
  selectedBy: humanActorSchema.optional(),
  selectedAt: z.string().datetime().optional(),
  executionState: z.literal("not-performed"),
  resultState: z.literal("not-established"),
  evidenceTruthState: z.literal("not-established"),
  coverageTruthState: z.literal("not-established"),
  qualityState: z.literal("not-established"),
  ownershipAuthorityState: z.literal("not-granted"),
  approvalState: z.literal("not-established"),
}).strict().superRefine((decision, context) => {
  if (decision.disposition === "candidate-selected" &&
      (decision.environmentIds.length === 0 || decision.evidenceExpectationIds.length === 0 ||
       decision.ownerCandidateIds.length === 0 || decision.evidenceReferences.length === 0 ||
       !decision.selectedBy || !decision.selectedAt || decision.automationIntent === "not-assessed")) {
    context.addIssue({ code: "custom", path: ["disposition"], message: "A selected methodology requires bounded environments, evidence expectations, owner candidates, evidence, attribution, and automation intent" })
  }
  if (decision.disposition !== "candidate-selected" && (decision.selectedBy || decision.selectedAt)) {
    context.addIssue({ code: "custom", path: ["selectedBy"], message: "Only selected methodology candidates may carry human selection attribution" })
  }
  if (decision.disposition === "candidate-conflict" && decision.conflictReferenceCandidates.length === 0) {
    context.addIssue({ code: "custom", path: ["conflictReferenceCandidates"], message: "A methodology conflict requires an exact conflict reference candidate" })
  }
})

export const testMethodologyCriterionSchema = z.object({
  id: identifierSchema,
  ordinal: z.number().int().positive().max(8_192),
  kind: z.enum(["entry", "exit"]),
  scopeIds: requiredCanonicalUuidsSchema,
  evidenceExpectationIds: canonicalIdentifiersSchema,
  assessmentState: z.enum(["candidate-defined", "candidate-conflict", "not-assessed"]),
  evidenceReferences: evidenceListSchema,
}).strict()

const testMethodologyInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  acceptanceCriteria: exactAcceptanceCriteriaReferenceSchema,
  definitionOfReady: exactDefinitionOfReadyReferenceSchema,
  definitionOfDone: exactDefinitionOfDoneReferenceSchema,
  implementationUnitModel: exactImplementationUnitModelReferenceSchema,
  dependencyMapping: exactDependencyMappingReferenceSchema,
  securityPrivacyAssessment: exactSecurityPrivacyAssessmentReferenceSchema,
  routeScreenComponentMapping: exactRouteScreenComponentMappingReferenceSchema,
  scopes: z.array(testMethodologyScopeSchema).min(1).max(65_536),
  decisions: z.array(testMethodologyDecisionSchema).min(1).max(65_536),
  environments: z.array(testMethodologyEnvironmentSchema).min(1).max(4_096),
  dataPolicies: z.array(testMethodologyDataPolicySchema).min(1).max(4_096),
  evidenceExpectations: z.array(testMethodologyEvidenceExpectationSchema).min(1).max(8_192),
  criteria: z.array(testMethodologyCriterionSchema).min(2).max(8_192),
  alternativesConsidered: canonicalTextListSchema,
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema.refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  requirementTruthState: z.literal("not-established"),
  acceptanceCriteriaValidityState: z.literal("not-established"),
  methodologyTruthState: z.literal("not-established"),
  methodologyCompletenessState: z.literal("not-established"),
  environmentAvailabilityState: z.literal("not-established"),
  dataFitnessState: z.literal("not-established"),
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
  const uniqueBy = (values: readonly { id: string }[], path: string) => {
    if (!unique(values.map((value) => value.id))) context.addIssue({ code: "custom", path: [path], message: `${path} identities must be unique` })
  }
  uniqueBy(candidate.scopes, "scopes"); uniqueBy(candidate.decisions, "decisions")
  uniqueBy(candidate.environments, "environments"); uniqueBy(candidate.dataPolicies, "dataPolicies")
  uniqueBy(candidate.evidenceExpectations, "evidenceExpectations"); uniqueBy(candidate.criteria, "criteria")
  for (const [path, values] of [["scopes", candidate.scopes], ["decisions", candidate.decisions],
    ["environments", candidate.environments], ["dataPolicies", candidate.dataPolicies],
    ["evidenceExpectations", candidate.evidenceExpectations], ["criteria", candidate.criteria]] as const) {
    values.forEach((value, index) => {
      if (value.ordinal !== index + 1) context.addIssue({ code: "custom", path: [path, index, "ordinal"], message: `${path} must use contiguous canonical ordinal ordering` })
    })
  }
  const scopeIds = new Set(candidate.scopes.map((value) => value.id))
  const environmentIds = new Set(candidate.environments.map((value) => value.id))
  const policyIds = new Set(candidate.dataPolicies.map((value) => value.id))
  const expectationIds = new Set(candidate.evidenceExpectations.map((value) => value.id))
  const criterionIds = new Set(candidate.criteria.map((value) => value.id))
  for (const [index, decision] of candidate.decisions.entries()) {
    if (!scopeIds.has(decision.scopeId) || decision.environmentIds.some((id) => !environmentIds.has(id)) ||
        decision.dataPolicyIds.some((id) => !policyIds.has(id)) ||
        decision.evidenceExpectationIds.some((id) => !expectationIds.has(id)) ||
        [...decision.entryCriterionIds, ...decision.exitCriterionIds].some((id) => !criterionIds.has(id))) {
      context.addIssue({ code: "custom", path: ["decisions", index], message: "Methodology decisions must reference declared scopes, environments, data policies, evidence expectations, and criteria" })
    }
  }
  if (!candidate.criteria.some((value) => value.kind === "entry") || !candidate.criteria.some((value) => value.kind === "exit")) {
    context.addIssue({ code: "custom", path: ["criteria"], message: "Test Methodology requires entry and exit criteria" })
  }
  if (candidate.reviewState === "ready-for-human-review" &&
      (candidate.unresolvedQuestions.length > 0 || candidate.scopes.some((scope) => scope.evidenceReferences.length === 0) ||
       candidate.decisions.some((decision) => decision.disposition !== "candidate-selected") ||
       candidate.environments.some((environment) => environment.availabilityState === "not-assessed") ||
       candidate.criteria.some((criterion) => criterion.assessmentState !== "candidate-defined"))) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready Test Methodology requires evidence-backed scopes, selected decisions, assessed environments, defined criteria, and no unresolved questions" })
  }
})

export const testMethodologyInputSchema = rejectSecrets(testMethodologyInputBaseSchema)
const authorityBoundary = "test-methodology-is-a-versioned-candidate-and-does-not-establish-requirement-or-acceptance-criteria-truth-methodology-validity-or-completeness-environment-availability-test-data-fitness-privacy-or-security-approval-owner-appointment-test-execution-or-results-evidence-or-coverage-truth-quality-implementation-readiness-acceptance-release-deployment-or-action-authority" as const

export const testMethodologySchema = testMethodologyInputSchema.safeExtend({
  schemaVersion: z.literal(1), kind: z.literal("test-methodology-candidate"), id: z.string().uuid(),
  productId: z.string().uuid(), revision: z.number().int().positive(), scopeCatalogDigest: digestSchema,
  methodologyReceiptDigest: digestSchema, environmentReceiptDigest: digestSchema, dataPolicyReceiptDigest: digestSchema,
  ownershipReceiptDigest: digestSchema, traceReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
  predecessorDigest: digestSchema.optional(), state: z.literal("candidate"), createdBy: humanActorSchema,
  updatedBy: humanActorSchema, createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  authorityBoundary: z.literal(authorityBoundary),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Test Methodology revisions after revision one require an exact predecessor digest" })
})

export const exactTestMethodologyReferenceSchema = z.object({ recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict()
const statusAuthorityBoundary = "test-methodology-status-is-observational-and-does-not-establish-requirement-or-acceptance-criteria-truth-methodology-validity-or-completeness-environment-availability-test-data-fitness-privacy-or-security-approval-owner-appointment-test-execution-or-results-evidence-or-coverage-truth-quality-implementation-readiness-acceptance-release-deployment-or-action-authority" as const

export const testMethodologyStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("test-methodology-status"), productId: z.string().uuid(),
  productRevision: z.number().int().positive(), initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactTestMethodologyReferenceSchema.optional(), acceptanceCriteria: exactAcceptanceCriteriaReferenceSchema.optional(),
  definitionOfReady: exactDefinitionOfReadyReferenceSchema.optional(), definitionOfDone: exactDefinitionOfDoneReferenceSchema.optional(),
  implementationUnitModel: exactImplementationUnitModelReferenceSchema.optional(), dependencyMapping: exactDependencyMappingReferenceSchema.optional(),
  securityPrivacyAssessment: exactSecurityPrivacyAssessmentReferenceSchema.optional(), routeScreenComponentMapping: exactRouteScreenComponentMappingReferenceSchema.optional(),
  sourceUnitCount: z.number().int().nonnegative().max(65_536), sourceRequirementCount: z.number().int().nonnegative().max(65_536),
  sourceCriterionCount: z.number().int().nonnegative().max(65_536), sourceMappingSubjectCount: z.number().int().nonnegative().max(65_536),
  scopeCount: z.number().int().nonnegative().max(65_536), decisionCount: z.number().int().nonnegative().max(65_536),
  selectedDecisionCount: z.number().int().nonnegative().max(65_536), conflictDecisionCount: z.number().int().nonnegative().max(65_536),
  notApplicableDecisionCount: z.number().int().nonnegative().max(65_536), deferredDecisionCount: z.number().int().nonnegative().max(65_536),
  notAssessedDecisionCount: z.number().int().nonnegative().max(65_536), environmentCount: z.number().int().nonnegative().max(4_096),
  dataPolicyCount: z.number().int().nonnegative().max(4_096), evidenceExpectationCount: z.number().int().nonnegative().max(8_192),
  entryCriterionCount: z.number().int().nonnegative().max(8_192), exitCriterionCount: z.number().int().nonnegative().max(8_192),
  missingScopeCount: z.number().int().nonnegative().max(65_536), extraScopeCount: z.number().int().nonnegative().max(65_536),
  invalidDecisionCount: z.number().int().nonnegative().max(65_536), environmentGapCount: z.number().int().nonnegative().max(4_096),
  dataPolicyGapCount: z.number().int().nonnegative().max(4_096), ownershipGapCount: z.number().int().nonnegative().max(65_536),
  traceGapCount: z.number().int().nonnegative().max(65_536), evidenceGapCount: z.number().int().nonnegative().max(65_536),
  criterionGapCount: z.number().int().nonnegative().max(8_192), staleBindingCount: z.number().int().nonnegative().max(1),
  staleDependencyCount: z.number().int().nonnegative().max(7), invalidCandidateCount: z.number().int().nonnegative().max(1),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512), reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "candidate-complete"]), reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(), authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict().superRefine((status, context) => {
  if (status.selectedDecisionCount + status.conflictDecisionCount + status.notApplicableDecisionCount + status.deferredDecisionCount + status.notAssessedDecisionCount !== status.decisionCount) {
    context.addIssue({ code: "custom", path: ["decisionCount"], message: "Test Methodology decision disposition counts must reconcile" })
  }
  const gaps = status.conflictDecisionCount + status.deferredDecisionCount + status.notAssessedDecisionCount + status.missingScopeCount + status.extraScopeCount + status.invalidDecisionCount + status.environmentGapCount + status.dataPolicyGapCount + status.ownershipGapCount + status.traceGapCount + status.evidenceGapCount + status.criterionGapCount + status.staleBindingCount + status.staleDependencyCount + status.invalidCandidateCount + status.unresolvedQuestionCount
  const dependencies = [status.acceptanceCriteria, status.definitionOfReady, status.definitionOfDone, status.implementationUnitModel, status.dependencyMapping, status.securityPrivacyAssessment, status.routeScreenComponentMapping]
  if (status.state === "candidate-complete" && (gaps > 0 || !status.candidate || dependencies.some((dependency) => !dependency) || status.scopeCount !== status.sourceUnitCount || status.selectedDecisionCount !== status.decisionCount || status.reviewState !== "ready-for-human-review" || status.entryCriterionCount === 0 || status.exitCriterionCount === 0 || status.reasons.length > 0)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Candidate-complete Test Methodology requires exact current dependencies, complete selected decisions and criteria, and no structural gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Test Methodology status must expose reasons" })
})

const projectionAuthorityBoundary = "test-methodology-projection-is-read-only-and-does-not-establish-requirement-or-acceptance-criteria-truth-methodology-validity-or-completeness-environment-availability-test-data-fitness-privacy-or-security-approval-owner-appointment-test-execution-or-results-evidence-or-coverage-truth-quality-implementation-readiness-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-counts-statuses-and-methodology-scope-environment-data-ownership-trace-assessment-snapshot-digests-only-not-requirement-criterion-method-rationale-environment-address-test-data-owner-evidence-result-personal-data-secrets-credentials-or-machine-paths" as const

export const testMethodologyProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("test-methodology-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: testMethodologyStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.literal("candidate"),
    scopeCatalogDigest: digestSchema, methodologyReceiptDigest: digestSchema, environmentReceiptDigest: digestSchema,
    dataPolicyReceiptDigest: digestSchema, ownershipReceiptDigest: digestSchema, traceReceiptDigest: digestSchema,
    assessmentReceiptDigest: digestSchema, scopeCount: z.number().int().nonnegative().max(65_536),
    decisionCount: z.number().int().nonnegative().max(65_536), selectedDecisionCount: z.number().int().nonnegative().max(65_536),
    conflictDecisionCount: z.number().int().nonnegative().max(65_536), environmentCount: z.number().int().nonnegative().max(4_096),
    dataPolicyCount: z.number().int().nonnegative().max(4_096), evidenceExpectationCount: z.number().int().nonnegative().max(8_192),
    entryCriterionCount: z.number().int().nonnegative().max(8_192), exitCriterionCount: z.number().int().nonnegative().max(8_192),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary), authorityBoundary: z.literal(projectionAuthorityBoundary), snapshotDigest: digestSchema,
}).strict()

export type TestMethodologyInput = z.infer<typeof testMethodologyInputSchema>
export type TestMethodology = z.infer<typeof testMethodologySchema>
export type TestMethodologyStatus = z.infer<typeof testMethodologyStatusSchema>
export type TestMethodologyProjection = z.infer<typeof testMethodologyProjectionSchema>
