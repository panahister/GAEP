import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { changedUnitEvidenceReferenceSchema } from "./changed-unit-inventory.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,127}$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const relativePathSchema = z.string().trim().min(1).max(4_096).superRefine((value, context) => {
  if (value.startsWith("/") || value.startsWith("\\") || /^[A-Za-z]:/u.test(value) || value.includes("\\") || value.split("/").some((segment) => ["", ".", ".."].includes(segment))) {
    context.addIssue({ code: "custom", message: "Rollback and recovery candidates must use normalized repository-relative paths" })
  }
})
const exactReferenceSchema = z.object({ recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict()
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()
function unique(values: readonly string[]): boolean { return new Set(values).size === values.length }
function canonical(values: readonly string[]): boolean { const ordered = [...values].sort((a, b) => a.localeCompare(b)); return values.every((v, i) => v === ordered[i]) }
function canonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 65_536) { return z.array(schema).max(maximum).refine((values) => unique(values.map(String)), "Values must be unique").refine((values) => canonical(values.map(String)), "Values must use canonical lexical ordering") }
function requiredCanonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 65_536) { return canonicalList(schema, maximum).refine((values) => values.length > 0, "At least one value is required") }
function rejectSecrets<T extends z.ZodType>(schema: T): T { return schema.refine((value) => !containsSecretShapedValue(value), { message: "Portable Rollback and Recovery candidates cannot contain secret-shaped values" }) as unknown as T }

export const rollbackRecoveryDependencySchema = z.object({
  failureRecoveryModel: exactReferenceSchema,
  stagingWorkspace: exactReferenceSchema,
  applyDiscardFoundation: exactReferenceSchema,
  scopedApply: exactReferenceSchema,
}).strict()

export const rollbackPointCandidateSchema = z.object({
  id: z.string().uuid(), ordinal: z.number().int().positive().max(65_536), rollbackPointKey: identifierSchema,
  kind: z.enum(["pre-apply-stage", "managed-workflow-checkpoint"]), stageGeneration: z.number().int().positive().max(1_000_000),
  scopeDigest: digestSchema, checkpointDigest: digestSchema, bindingsDigest: digestSchema,
  workflowStrategy: z.enum(["sequential", "parallel-readonly"]), orderedWorkflowStepIds: requiredCanonicalList(z.string().uuid(), 512),
  completedWorkflowStepIds: canonicalList(z.string().uuid(), 512), evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  state: z.enum(["candidate-defined", "gap", "conflict", "stale", "tamper-suspected", "not-assessed"]),
  actualCheckpointTruthState: z.literal("not-established"), rollbackExecutionState: z.literal("not-performed"),
}).strict().superRefine((point, context) => {
  const ordered = new Set(point.orderedWorkflowStepIds)
  if (point.completedWorkflowStepIds.some((id) => !ordered.has(id))) context.addIssue({ code: "custom", path: ["completedWorkflowStepIds"], message: "Completed Workflow steps must be a subset of the ordered candidate steps" })
})

export const rollbackRecoverySubjectSchema = z.object({
  id: z.string().uuid(), ordinal: z.number().int().positive().max(65_536), subjectKey: identifierSchema,
  scopedApplySelectedPathId: z.string().uuid(), stagingPathId: z.string().uuid(), rollbackPointId: z.string().uuid(), recoveryPlanKey: identifierSchema,
  pathCandidate: relativePathSchema, stagingPathDigest: digestSchema, scopeState: z.enum(["candidate-exact", "gap", "conflict", "stale", "not-assessed"]),
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048), sourceMutationState: z.literal("not-performed"),
  rollbackExecutionState: z.literal("not-performed"), recoveryExecutionState: z.literal("not-performed"), outcomeTruthState: z.literal("not-established"),
}).strict()

export const rollbackRecoveryPlanSchema = z.object({
  key: identifierSchema, rollbackPointId: z.string().uuid(), failureModeKey: identifierSchema, recoveryPlanKey: identifierSchema,
  scope: z.enum(["scoped-selection", "whole-stage-fallback-candidate"]), subjectIds: requiredCanonicalList(z.string().uuid()),
  orderedSteps: z.array(z.object({ ordinal: z.number().int().positive().max(256), action: z.enum(["contain", "verify-checkpoint", "reconcile", "restore-candidate", "revalidate"]),
    executionState: z.literal("not-performed") }).strict()).min(1).max(256),
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048), state: z.enum(["candidate-defined", "gap", "conflict", "stale", "unsupported-effect", "not-assessed"]),
  executionState: z.literal("not-performed"), successState: z.literal("not-established"), returnToServiceState: z.literal("not-authorized"),
}).strict().superRefine((plan, context) => {
  if (plan.orderedSteps.some((step, index) => step.ordinal !== index + 1)) context.addIssue({ code: "custom", path: ["orderedSteps"], message: "Recovery steps must use contiguous ordering" })
})

const inputBaseSchema = z.object({
  initiativeId: z.string().uuid(), context: businessContextBindingSchema, informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240), dependencies: rollbackRecoveryDependencySchema,
  stageIdentity: z.object({ namespace: z.literal("gaep-managed-stage"), stageKey: identifierSchema, generation: z.number().int().positive().max(1_000_000), scopeDigest: digestSchema }).strict(),
  rollbackPoints: z.array(rollbackPointCandidateSchema).min(1).max(65_536), subjects: z.array(rollbackRecoverySubjectSchema).min(1).max(65_536),
  recoveryPlans: z.array(rollbackRecoveryPlanSchema).min(1).max(65_536),
  safeguards: z.object({ staleStageRejectionState: z.literal("candidate-defined"), scopeConfinementState: z.literal("candidate-defined"),
    checkpointIntegrityState: z.literal("candidate-defined"), tamperRejectionState: z.literal("candidate-defined"), atomicityState: z.literal("candidate-defined"),
    powerLossState: z.literal("not-assessed"), unsupportedEffectState: z.literal("not-assessed") }).strict(),
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048), preconditions: requiredCanonicalList(shortTextSchema, 256),
  unresolvedQuestions: canonicalList(shortTextSchema, 512), limitations: requiredCanonicalList(shortTextSchema, 512),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]), definedBy: humanActorSchema, definedAt: z.string().datetime(),
  stageTruthState: z.literal("not-established"), repositoryTruthState: z.literal("not-established"), sourceTruthState: z.literal("not-established"),
  approvalState: z.literal("not-established"), authorizationState: z.literal("not-established"), sourceMutationState: z.literal("not-performed"),
  rollbackExecutionState: z.literal("not-performed"), recoveryExecutionState: z.literal("not-performed"), recoveryOutcomeState: z.literal("not-established"),
  returnToServiceState: z.literal("not-authorized"), acceptanceState: z.literal("not-established"), nativeHostAcceptanceState: z.literal("not-established"),
  liveProviderAcceptanceState: z.literal("not-established"), securityAcceptanceState: z.literal("not-established"), releaseReadinessState: z.literal("not-established"),
  deploymentReadinessState: z.literal("not-established"), actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  if (!unique(candidate.rollbackPoints.map((point) => point.id)) || !unique(candidate.rollbackPoints.map((point) => point.rollbackPointKey))) context.addIssue({ code: "custom", path: ["rollbackPoints"], message: "Rollback point identities and keys must be unique" })
  candidate.rollbackPoints.forEach((point, index) => { if (point.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["rollbackPoints", index, "ordinal"], message: "Rollback points must use contiguous ordering" }) })
  if (candidate.rollbackPoints.some((point) => point.stageGeneration !== candidate.stageIdentity.generation || point.scopeDigest !== candidate.stageIdentity.scopeDigest)) context.addIssue({ code: "custom", path: ["rollbackPoints"], message: "Every rollback point must bind the exact stage generation and scope" })
  if (!unique(candidate.subjects.map((subject) => subject.id)) || !unique(candidate.subjects.map((subject) => subject.subjectKey)) || !unique(candidate.subjects.map((subject) => subject.scopedApplySelectedPathId)) || !unique(candidate.subjects.map((subject) => subject.stagingPathId))) context.addIssue({ code: "custom", path: ["subjects"], message: "Recovery subject identities, keys, selected paths, and staging paths must be unique" })
  candidate.subjects.forEach((subject, index) => { if (subject.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["subjects", index, "ordinal"], message: "Recovery subjects must use contiguous ordering" }) })
  const pointIds = new Set(candidate.rollbackPoints.map((point) => point.id)), subjectIds = new Set(candidate.subjects.map((subject) => subject.id)), planKeys = new Set(candidate.recoveryPlans.map((plan) => plan.key))
  if (candidate.subjects.some((subject) => !pointIds.has(subject.rollbackPointId) || !planKeys.has(subject.recoveryPlanKey))) context.addIssue({ code: "custom", path: ["subjects"], message: "Recovery subjects must reference declared rollback points and recovery plans" })
  if (!unique(candidate.recoveryPlans.map((plan) => plan.key)) || candidate.recoveryPlans.some((plan) => !pointIds.has(plan.rollbackPointId) || plan.subjectIds.some((id) => !subjectIds.has(id)))) context.addIssue({ code: "custom", path: ["recoveryPlans"], message: "Recovery plans must uniquely reference declared rollback points and subjects" })
  const covered = candidate.recoveryPlans.flatMap((plan) => plan.subjectIds)
  if (!unique(covered) || covered.length !== candidate.subjects.length || candidate.subjects.some((subject) => !covered.includes(subject.id))) context.addIssue({ code: "custom", path: ["recoveryPlans"], message: "Every recovery subject must be covered exactly once" })
  if (candidate.reviewState === "ready-for-human-review" && (candidate.unresolvedQuestions.length || candidate.rollbackPoints.some((point) => point.state !== "candidate-defined") || candidate.subjects.some((subject) => subject.scopeState !== "candidate-exact") || candidate.recoveryPlans.some((plan) => plan.state !== "candidate-defined"))) context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready recovery metadata requires exact complete candidates and no unresolved questions" })
})

export const rollbackRecoveryInputSchema = rejectSecrets(inputBaseSchema)
const authorityBoundary = "rollback-recovery-is-a-versioned-portable-evidence-candidate-and-does-not-establish-stage-repository-source-checkpoint-approval-authorization-mutation-rollback-recovery-outcome-return-to-service-acceptance-release-deployment-or-action-authority" as const
export const rollbackRecoverySchema = rollbackRecoveryInputSchema.safeExtend({ schemaVersion: z.literal(1), kind: z.literal("rollback-recovery-candidate"), id: z.string().uuid(), productId: z.string().uuid(), revision: z.number().int().positive(),
  dependencyReceiptDigest: digestSchema, stageReceiptDigest: digestSchema, checkpointReceiptDigest: digestSchema, subjectReceiptDigest: digestSchema,
  planReceiptDigest: digestSchema, safeguardReceiptDigest: digestSchema, evidenceReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
  predecessorDigest: digestSchema.optional(), state: z.literal("candidate"), createdBy: humanActorSchema, updatedBy: humanActorSchema,
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(), authorityBoundary: z.literal(authorityBoundary) }).strict()
  .superRefine((record, context) => { if ((record.revision === 1) !== (record.predecessorDigest === undefined)) context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only later revisions require a predecessor digest" }) })

const statusAuthorityBoundary = "rollback-recovery-status-is-observational-and-grants-no-stage-repository-source-checkpoint-approval-authorization-mutation-rollback-recovery-outcome-return-to-service-acceptance-release-deployment-or-action-authority" as const
export const rollbackRecoveryStatusSchema = z.object({ schemaVersion: z.literal(1), kind: z.literal("rollback-recovery-status"), productId: z.string().uuid(), productRevision: z.number().int().positive(), initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactReferenceSchema.optional(), dependencies: rollbackRecoveryDependencySchema.optional(), stageKey: identifierSchema.optional(), stageGeneration: z.number().int().positive().optional(),
  rollbackPointCount: z.number().int().nonnegative(), subjectCount: z.number().int().nonnegative(), recoveryPlanCount: z.number().int().nonnegative(), completedWorkflowStepCount: z.number().int().nonnegative(),
  gapCount: z.number().int().nonnegative(), conflictCount: z.number().int().nonnegative(), staleCount: z.number().int().nonnegative(), tamperSuspectedCount: z.number().int().nonnegative(),
  unsupportedEffectCount: z.number().int().nonnegative(), notAssessedCount: z.number().int().nonnegative(), staleBindingCount: z.number().int().nonnegative(), coverageGapCount: z.number().int().nonnegative(),
  invalidCandidateCount: z.number().int().nonnegative(), unresolvedQuestionCount: z.number().int().nonnegative(), reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "candidate-defined"]), reasons: z.array(shortTextSchema).max(2_048), assessedAt: z.string().datetime(), authorityBoundary: z.literal(statusAuthorityBoundary) }).strict()

const projectionAuthorityBoundary = "rollback-recovery-projection-is-read-only-and-grants-no-stage-repository-source-checkpoint-approval-authorization-mutation-rollback-recovery-outcome-return-to-service-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-bounded-stage-checkpoint-subject-plan-evidence-identities-states-counts-and-digests-only-not-source-diff-provider-output-machine-paths-personal-data-secrets-credentials-or-permissions" as const
export const rollbackRecoveryProjectionSchema = z.object({ schemaVersion: z.literal(1), kind: z.literal("rollback-recovery-projection"), product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: rollbackRecoveryStatusSchema, candidate: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    stageIdentity: z.object({ namespace: z.literal("gaep-managed-stage"), stageKey: identifierSchema, generation: z.number().int().positive(), scopeDigest: digestSchema }).strict(),
    rollbackPoints: z.array(z.object({ id: z.string().uuid(), rollbackPointKey: identifierSchema, kind: z.enum(["pre-apply-stage", "managed-workflow-checkpoint"]), state: z.enum(["candidate-defined", "gap", "conflict", "stale", "tamper-suspected", "not-assessed"]), completedWorkflowStepCount: z.number().int().nonnegative(), checkpointDigest: digestSchema }).strict()).max(65_536),
    subjects: z.array(z.object({ id: z.string().uuid(), subjectKey: identifierSchema, pathCandidate: relativePathSchema, recoveryPlanKey: identifierSchema, scopeState: z.enum(["candidate-exact", "gap", "conflict", "stale", "not-assessed"]) }).strict()).max(65_536),
    recoveryPlans: z.array(z.object({ key: identifierSchema, scope: z.enum(["scoped-selection", "whole-stage-fallback-candidate"]), subjectCount: z.number().int().positive(), stepCount: z.number().int().positive(), state: z.enum(["candidate-defined", "gap", "conflict", "stale", "unsupported-effect", "not-assessed"]) }).strict()).max(65_536),
    safeguards: z.object({ staleStageRejectionState: z.literal("candidate-defined"), scopeConfinementState: z.literal("candidate-defined"),
      checkpointIntegrityState: z.literal("candidate-defined"), tamperRejectionState: z.literal("candidate-defined"), atomicityState: z.literal("candidate-defined"),
      powerLossState: z.literal("not-assessed"), unsupportedEffectState: z.literal("not-assessed") }).strict(),
    dependencyReceiptDigest: digestSchema, stageReceiptDigest: digestSchema, checkpointReceiptDigest: digestSchema, subjectReceiptDigest: digestSchema,
    planReceiptDigest: digestSchema, safeguardReceiptDigest: digestSchema, evidenceReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime() }).strict().optional(),
  observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary), authorityBoundary: z.literal(projectionAuthorityBoundary), snapshotDigest: digestSchema }).strict()

export type RollbackRecoveryInput = z.infer<typeof rollbackRecoveryInputSchema>
export type RollbackRecovery = z.infer<typeof rollbackRecoverySchema>
export type RollbackRecoveryStatus = z.infer<typeof rollbackRecoveryStatusSchema>
export type RollbackRecoveryProjection = z.infer<typeof rollbackRecoveryProjectionSchema>
