import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { changedUnitEvidenceReferenceSchema } from "./changed-unit-inventory.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,127}$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const relativePathSchema = z.string().trim().min(1).max(4_096).superRefine((value, context) => {
  if (value.startsWith("/") || value.startsWith("\\") || /^[A-Za-z]:/u.test(value) || value.includes("\\") ||
      value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    context.addIssue({ code: "custom", message: "Apply/discard candidates must use normalized repository-relative paths" })
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
  return schema.refine((value) => !containsSecretShapedValue(value), { message: "Portable Apply/Discard Foundation candidates cannot contain secret-shaped values" }) as unknown as T
}

export const applyDiscardFoundationDependencySchema = z.object({
  changedUnitInventory: exactReferenceSchema,
  proposedChangePreview: exactReferenceSchema,
  stagingWorkspace: exactReferenceSchema,
  controlledCodexImplementation: exactReferenceSchema,
  controlledClaudeImplementation: exactReferenceSchema,
  backlogToCodeTraceability: exactReferenceSchema,
}).strict()

export const applyDiscardPathDecisionSchema = z.object({
  id: z.string().uuid(), ordinal: z.number().int().positive().max(65_536), decisionPathKey: identifierSchema,
  changedUnitId: z.string().uuid(), changedPathId: z.string().uuid(), proposedPreviewUnitId: z.string().uuid(),
  proposedPreviewPathId: z.string().uuid(), stagingUnitId: z.string().uuid(), stagingPathId: z.string().uuid(),
  backlogTraceId: z.string().uuid(), backlogTraceKey: identifierSchema, implementationUnitId: z.string().uuid(),
  pathCandidate: relativePathSchema, stagingPathDigest: digestSchema,
  disposition: z.enum(["apply-candidate", "discard-candidate", "keep-pending"]),
  scopeState: z.enum(["candidate-exact", "gap", "conflict", "stale", "not-assessed"]),
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  conflictReferenceCandidates: z.array(changedUnitEvidenceReferenceSchema).max(2_048),
  sourceMutationState: z.literal("not-performed"), applyState: z.literal("not-performed"),
  discardState: z.literal("not-performed"), outcomeTruthState: z.literal("not-established"),
}).strict().superRefine((path, context) => {
  if (path.scopeState === "candidate-exact" && path.conflictReferenceCandidates.length) context.addIssue({ code: "custom", path: ["conflictReferenceCandidates"], message: "Exact candidate paths cannot carry conflicts" })
  if (path.scopeState === "conflict" && !path.conflictReferenceCandidates.length) context.addIssue({ code: "custom", path: ["conflictReferenceCandidates"], message: "Conflicting candidate paths require attributable conflict evidence" })
})

export const applyDiscardRecoveryCandidateSchema = z.object({
  strategy: z.literal("write-ahead-journal-candidate"), journalKey: identifierSchema,
  stageGeneration: z.number().int().positive().max(1_000_000), checkpointDigest: digestSchema,
  staleStageRejectionState: z.literal("candidate-defined"), scopeConfinementState: z.literal("candidate-defined"),
  atomicityState: z.literal("candidate-defined"), rollbackState: z.literal("candidate-defined"),
  recoveryExecutionState: z.literal("not-performed"), evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
}).strict()

const inputBaseSchema = z.object({
  initiativeId: z.string().uuid(), context: businessContextBindingSchema, informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240), dependencies: applyDiscardFoundationDependencySchema,
  stageIdentity: z.object({ namespace: z.literal("gaep-managed-stage"), stageKey: identifierSchema,
    generation: z.number().int().positive().max(1_000_000), scopeDigest: digestSchema }).strict(),
  decision: z.enum(["apply-entire-stage-candidate", "discard-entire-stage-candidate", "keep-pending"]),
  decisionActor: humanActorSchema, decidedAt: z.string().datetime(), paths: z.array(applyDiscardPathDecisionSchema).min(1).max(65_536),
  recovery: applyDiscardRecoveryCandidateSchema, preconditions: requiredCanonicalList(shortTextSchema, 256),
  unresolvedQuestions: canonicalList(shortTextSchema, 512), limitations: requiredCanonicalList(shortTextSchema, 512),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  actualStageExistenceState: z.literal("not-established"), repositoryTruthState: z.literal("not-established"),
  sourceTruthState: z.literal("not-established"), approvalState: z.literal("not-established"),
  authorizationState: z.literal("not-established"), sourceMutationState: z.literal("not-performed"),
  applyState: z.literal("not-performed"), discardState: z.literal("not-performed"), recoveryExecutionState: z.literal("not-performed"),
  outcomeTruthState: z.literal("not-established"), acceptanceState: z.literal("not-established"),
  nativeHostAcceptanceState: z.literal("not-established"), liveProviderAcceptanceState: z.literal("not-established"),
  securityAcceptanceState: z.literal("not-established"), releaseReadinessState: z.literal("not-established"),
  deploymentReadinessState: z.literal("not-established"), actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  if (!unique(candidate.paths.map((path) => path.id)) || !unique(candidate.paths.map((path) => path.decisionPathKey)) ||
      !unique(candidate.paths.map((path) => path.stagingPathId))) context.addIssue({ code: "custom", path: ["paths"], message: "Decision path identities, keys, and staging paths must be unique" })
  candidate.paths.forEach((path, index) => { if (path.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["paths", index, "ordinal"], message: "Decision paths must use contiguous canonical ordering" }) })
  const expectedDisposition = candidate.decision === "apply-entire-stage-candidate" ? "apply-candidate" :
    candidate.decision === "discard-entire-stage-candidate" ? "discard-candidate" : "keep-pending"
  if (candidate.paths.some((path) => path.disposition !== expectedDisposition)) context.addIssue({ code: "custom", path: ["paths"], message: "Every path disposition must match the whole-stage decision" })
  if (candidate.recovery.stageGeneration !== candidate.stageIdentity.generation) context.addIssue({ code: "custom", path: ["recovery", "stageGeneration"], message: "Recovery must bind the exact stage generation" })
  if (candidate.reviewState === "ready-for-human-review" && (candidate.unresolvedQuestions.length || candidate.paths.some((path) => path.scopeState !== "candidate-exact"))) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready apply/discard metadata requires exact path scope and no unresolved questions" })
  }
})

export const applyDiscardFoundationInputSchema = rejectSecrets(inputBaseSchema)
const authorityBoundary = "apply-discard-foundation-is-a-versioned-portable-decision-candidate-and-does-not-establish-real-stage-existence-repository-source-approval-authorization-mutation-apply-discard-recovery-outcome-acceptance-release-deployment-or-action-authority" as const
export const applyDiscardFoundationSchema = applyDiscardFoundationInputSchema.safeExtend({
  schemaVersion: z.literal(1), kind: z.literal("apply-discard-foundation-candidate"), id: z.string().uuid(), productId: z.string().uuid(),
  revision: z.number().int().positive(), dependencyReceiptDigest: digestSchema, stageReceiptDigest: digestSchema,
  decisionReceiptDigest: digestSchema, scopeReceiptDigest: digestSchema, recoveryReceiptDigest: digestSchema,
  evidenceReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema, predecessorDigest: digestSchema.optional(),
  state: z.literal("candidate"), createdBy: humanActorSchema, updatedBy: humanActorSchema,
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(), authorityBoundary: z.literal(authorityBoundary),
}).strict().superRefine((record, context) => { if ((record.revision === 1) !== (record.predecessorDigest === undefined)) context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only later revisions require a predecessor digest" }) })

const statusAuthorityBoundary = "apply-discard-foundation-status-is-observational-and-grants-no-stage-repository-source-approval-authorization-mutation-apply-discard-recovery-outcome-acceptance-release-deployment-or-action-authority" as const
export const applyDiscardFoundationStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("apply-discard-foundation-status"), productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(), candidate: exactReferenceSchema.optional(), dependencies: applyDiscardFoundationDependencySchema.optional(),
  stageKey: identifierSchema.optional(), stageGeneration: z.number().int().positive().optional(), decision: z.enum(["apply-entire-stage-candidate", "discard-entire-stage-candidate", "keep-pending"]).optional(),
  pathCount: z.number().int().nonnegative(), applyCandidateCount: z.number().int().nonnegative(), discardCandidateCount: z.number().int().nonnegative(), pendingCount: z.number().int().nonnegative(),
  exactScopeCount: z.number().int().nonnegative(), gapCount: z.number().int().nonnegative(), conflictCount: z.number().int().nonnegative(), stalePathCount: z.number().int().nonnegative(),
  notAssessedCount: z.number().int().nonnegative(), staleBindingCount: z.number().int().nonnegative(), coverageGapCount: z.number().int().nonnegative(),
  invalidCandidateCount: z.number().int().nonnegative(), unresolvedQuestionCount: z.number().int().nonnegative(), reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "candidate-defined"]), reasons: z.array(shortTextSchema).max(2_048), assessedAt: z.string().datetime(), authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict()

const projectionAuthorityBoundary = "apply-discard-foundation-projection-is-read-only-and-grants-no-stage-repository-source-approval-authorization-mutation-apply-discard-recovery-outcome-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-bounded-stage-path-decision-evidence-identities-states-counts-and-digests-only-not-source-diff-commit-test-result-provider-output-machine-paths-personal-data-secrets-credentials-or-permissions" as const
export const applyDiscardFoundationProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("apply-discard-foundation-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: applyDiscardFoundationStatusSchema,
  candidate: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    stageIdentity: z.object({ namespace: z.literal("gaep-managed-stage"), stageKey: identifierSchema, generation: z.number().int().positive(), scopeDigest: digestSchema }).strict(),
    decision: z.enum(["apply-entire-stage-candidate", "discard-entire-stage-candidate", "keep-pending"]),
    paths: z.array(z.object({ id: z.string().uuid(), decisionPathKey: identifierSchema, backlogTraceKey: identifierSchema,
      pathCandidate: relativePathSchema, disposition: z.enum(["apply-candidate", "discard-candidate", "keep-pending"]),
      scopeState: z.enum(["candidate-exact", "gap", "conflict", "stale", "not-assessed"]), }).strict()).max(65_536),
    dependencyReceiptDigest: digestSchema, stageReceiptDigest: digestSchema, decisionReceiptDigest: digestSchema,
    scopeReceiptDigest: digestSchema, recoveryReceiptDigest: digestSchema, evidenceReceiptDigest: digestSchema,
    assessmentReceiptDigest: digestSchema, reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(), observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary), authorityBoundary: z.literal(projectionAuthorityBoundary), snapshotDigest: digestSchema,
}).strict()

export type ApplyDiscardFoundationInput = z.infer<typeof applyDiscardFoundationInputSchema>
export type ApplyDiscardFoundation = z.infer<typeof applyDiscardFoundationSchema>
export type ApplyDiscardFoundationStatus = z.infer<typeof applyDiscardFoundationStatusSchema>
export type ApplyDiscardFoundationProjection = z.infer<typeof applyDiscardFoundationProjectionSchema>
