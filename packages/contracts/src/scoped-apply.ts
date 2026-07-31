import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { changedUnitEvidenceReferenceSchema } from "./changed-unit-inventory.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,127}$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const relativePathSchema = z.string().trim().min(1).max(4_096).superRefine((value, context) => {
  if (value.startsWith("/") || value.startsWith("\\") || /^[A-Za-z]:/u.test(value) || value.includes("\\") || value.split("/").some((segment) => ["", ".", ".."].includes(segment))) {
    context.addIssue({ code: "custom", message: "Scoped apply candidates must use normalized repository-relative paths" })
  }
})
const exactReferenceSchema = z.object({ recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict()
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()
function unique(values: readonly string[]): boolean { return new Set(values).size === values.length }
function canonical(values: readonly string[]): boolean { const ordered = [...values].sort((a, b) => a.localeCompare(b)); return values.every((v, i) => v === ordered[i]) }
function canonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 65_536) { return z.array(schema).max(maximum).refine((values) => unique(values.map(String)), "Values must be unique").refine((values) => canonical(values.map(String)), "Values must use canonical lexical ordering") }
function requiredCanonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 65_536) { return canonicalList(schema, maximum).refine((values) => values.length > 0, "At least one value is required") }
function rejectSecrets<T extends z.ZodType>(schema: T): T { return schema.refine((value) => !containsSecretShapedValue(value), { message: "Portable Scoped Apply candidates cannot contain secret-shaped values" }) as unknown as T }

export const scopedApplyDependencySchema = z.object({ changedUnitInventory: exactReferenceSchema, proposedChangePreview: exactReferenceSchema,
  stagingWorkspace: exactReferenceSchema, controlledCodexImplementation: exactReferenceSchema,
  backlogToCodeTraceability: exactReferenceSchema, applyDiscardFoundation: exactReferenceSchema }).strict()

const pathBaseSchema = z.object({ id: z.string().uuid(), decisionPathId: z.string().uuid(), stagingPathId: z.string().uuid(),
  changedPathId: z.string().uuid(), backlogTraceId: z.string().uuid(), pathCandidate: relativePathSchema,
  stagingPathDigest: digestSchema, evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048) }).strict()
export const scopedApplySelectedPathSchema = pathBaseSchema.extend({ ordinal: z.number().int().positive().max(65_536),
  selectionKey: identifierSchema, writeEnvelopeCandidate: relativePathSchema, scopeState: z.enum(["candidate-exact", "gap", "conflict", "stale", "out-of-envelope", "not-assessed"]),
  sourceMutationState: z.literal("not-performed"), applyState: z.literal("not-performed"), outcomeTruthState: z.literal("not-established") }).strict()
export const scopedApplyExcludedPathSchema = pathBaseSchema.extend({ exclusionKey: identifierSchema,
  reason: shortTextSchema, disposition: z.literal("excluded-from-scoped-apply"), discardState: z.literal("not-performed") }).strict()

const inputBaseSchema = z.object({ initiativeId: z.string().uuid(), context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema, title: z.string().trim().min(2).max(240), dependencies: scopedApplyDependencySchema,
  stageIdentity: z.object({ namespace: z.literal("gaep-managed-stage"), stageKey: identifierSchema, generation: z.number().int().positive().max(1_000_000), scopeDigest: digestSchema }).strict(),
  selectionActor: humanActorSchema, selectedAt: z.string().datetime(), selectedPaths: z.array(scopedApplySelectedPathSchema).min(1).max(65_536),
  excludedPaths: z.array(scopedApplyExcludedPathSchema).max(65_536), writeEnvelopeCandidates: requiredCanonicalList(relativePathSchema),
  recovery: z.object({ strategy: z.literal("write-ahead-journal-candidate"), journalKey: identifierSchema,
    stageGeneration: z.number().int().positive(), checkpointDigest: digestSchema, staleStageRejectionState: z.literal("candidate-defined"),
    scopeConfinementState: z.literal("candidate-defined"), atomicityState: z.literal("candidate-defined"), rollbackState: z.literal("candidate-defined"),
    recoveryExecutionState: z.literal("not-performed"), evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048) }).strict(),
  preconditions: requiredCanonicalList(shortTextSchema, 256), unresolvedQuestions: canonicalList(shortTextSchema, 512), limitations: requiredCanonicalList(shortTextSchema, 512),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]), stageTruthState: z.literal("not-established"),
  repositoryTruthState: z.literal("not-established"), sourceTruthState: z.literal("not-established"), approvalState: z.literal("not-established"),
  authorizationState: z.literal("not-established"), sourceMutationState: z.literal("not-performed"), applyState: z.literal("not-performed"),
  wholeStageDiscardState: z.literal("not-performed"), recoveryExecutionState: z.literal("not-performed"), outcomeTruthState: z.literal("not-established"),
  acceptanceState: z.literal("not-established"), nativeHostAcceptanceState: z.literal("not-established"), liveProviderAcceptanceState: z.literal("not-established"),
  securityAcceptanceState: z.literal("not-established"), releaseReadinessState: z.literal("not-established"), deploymentReadinessState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted") }).strict().superRefine((candidate, context) => {
  if (!unique(candidate.selectedPaths.map((path) => path.id)) || !unique(candidate.selectedPaths.map((path) => path.selectionKey)) || !unique(candidate.selectedPaths.map((path) => path.stagingPathId))) context.addIssue({ code: "custom", path: ["selectedPaths"], message: "Selected path identities, keys, and staging paths must be unique" })
  candidate.selectedPaths.forEach((path, index) => { if (path.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["selectedPaths", index, "ordinal"], message: "Selected paths must use contiguous canonical ordering" }) })
  if (!unique(candidate.excludedPaths.map((path) => path.id)) || !unique(candidate.excludedPaths.map((path) => path.exclusionKey)) || !unique(candidate.excludedPaths.map((path) => path.stagingPathId))) context.addIssue({ code: "custom", path: ["excludedPaths"], message: "Excluded path identities, keys, and staging paths must be unique" })
  const selected = new Set(candidate.selectedPaths.map((path) => path.stagingPathId)); if (candidate.excludedPaths.some((path) => selected.has(path.stagingPathId))) context.addIssue({ code: "custom", path: ["excludedPaths"], message: "Selected and excluded stage paths cannot overlap" })
  if (candidate.selectedPaths.some((path) => path.writeEnvelopeCandidate !== path.pathCandidate || !candidate.writeEnvelopeCandidates.includes(path.pathCandidate))) context.addIssue({ code: "custom", path: ["writeEnvelopeCandidates"], message: "Every selected path must be exact-bound within the candidate write envelope" })
  if (candidate.recovery.stageGeneration !== candidate.stageIdentity.generation) context.addIssue({ code: "custom", path: ["recovery", "stageGeneration"], message: "Recovery must bind the exact stage generation" })
  if (candidate.reviewState === "ready-for-human-review" && (candidate.unresolvedQuestions.length || candidate.selectedPaths.some((path) => path.scopeState !== "candidate-exact"))) context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready scoped apply requires exact selections and no unresolved questions" })
})
export const scopedApplyInputSchema = rejectSecrets(inputBaseSchema)
const authorityBoundary = "scoped-apply-is-a-versioned-portable-subset-selection-candidate-and-does-not-establish-stage-repository-source-approval-authorization-mutation-apply-discard-recovery-outcome-acceptance-release-deployment-or-action-authority" as const
export const scopedApplySchema = scopedApplyInputSchema.safeExtend({ schemaVersion: z.literal(1), kind: z.literal("scoped-apply-candidate"), id: z.string().uuid(), productId: z.string().uuid(), revision: z.number().int().positive(),
  dependencyReceiptDigest: digestSchema, stageReceiptDigest: digestSchema, selectionReceiptDigest: digestSchema, exclusionReceiptDigest: digestSchema,
  envelopeReceiptDigest: digestSchema, recoveryReceiptDigest: digestSchema, evidenceReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
  predecessorDigest: digestSchema.optional(), state: z.literal("candidate"), createdBy: humanActorSchema, updatedBy: humanActorSchema,
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(), authorityBoundary: z.literal(authorityBoundary) }).strict()
  .superRefine((record, context) => { if ((record.revision === 1) !== (record.predecessorDigest === undefined)) context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only later revisions require a predecessor digest" }) })

const statusAuthorityBoundary = "scoped-apply-status-is-observational-and-grants-no-stage-repository-source-approval-authorization-mutation-apply-discard-recovery-outcome-acceptance-release-deployment-or-action-authority" as const
export const scopedApplyStatusSchema = z.object({ schemaVersion: z.literal(1), kind: z.literal("scoped-apply-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(), initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactReferenceSchema.optional(), dependencies: scopedApplyDependencySchema.optional(), stageKey: identifierSchema.optional(), stageGeneration: z.number().int().positive().optional(),
  stagePathCount: z.number().int().nonnegative(), selectedPathCount: z.number().int().nonnegative(), excludedPathCount: z.number().int().nonnegative(),
  exactScopeCount: z.number().int().nonnegative(), gapCount: z.number().int().nonnegative(), conflictCount: z.number().int().nonnegative(), stalePathCount: z.number().int().nonnegative(),
  outOfEnvelopeCount: z.number().int().nonnegative(), notAssessedCount: z.number().int().nonnegative(), staleBindingCount: z.number().int().nonnegative(),
  coverageGapCount: z.number().int().nonnegative(), invalidCandidateCount: z.number().int().nonnegative(), unresolvedQuestionCount: z.number().int().nonnegative(),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]), state: z.enum(["attention-required", "candidate-defined"]),
  reasons: z.array(shortTextSchema).max(2_048), assessedAt: z.string().datetime(), authorityBoundary: z.literal(statusAuthorityBoundary) }).strict()

const projectionAuthorityBoundary = "scoped-apply-projection-is-read-only-and-grants-no-stage-repository-source-approval-authorization-mutation-apply-discard-recovery-outcome-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-bounded-stage-path-selection-exclusion-envelope-evidence-identities-states-counts-and-digests-only-not-source-diff-commit-provider-output-machine-paths-personal-data-secrets-credentials-or-permissions" as const
export const scopedApplyProjectionSchema = z.object({ schemaVersion: z.literal(1), kind: z.literal("scoped-apply-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: scopedApplyStatusSchema,
  candidate: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    stageIdentity: z.object({ namespace: z.literal("gaep-managed-stage"), stageKey: identifierSchema, generation: z.number().int().positive(), scopeDigest: digestSchema }).strict(),
    selectedPaths: z.array(z.object({ id: z.string().uuid(), selectionKey: identifierSchema, pathCandidate: relativePathSchema,
      scopeState: z.enum(["candidate-exact", "gap", "conflict", "stale", "out-of-envelope", "not-assessed"]) }).strict()).max(65_536),
    excludedPaths: z.array(z.object({ id: z.string().uuid(), exclusionKey: identifierSchema, pathCandidate: relativePathSchema, reason: shortTextSchema }).strict()).max(65_536),
    writeEnvelopeCandidates: z.array(relativePathSchema).max(65_536), dependencyReceiptDigest: digestSchema, stageReceiptDigest: digestSchema,
    selectionReceiptDigest: digestSchema, exclusionReceiptDigest: digestSchema, envelopeReceiptDigest: digestSchema,
    recoveryReceiptDigest: digestSchema, evidenceReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime() }).strict().optional(),
  observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary), authorityBoundary: z.literal(projectionAuthorityBoundary), snapshotDigest: digestSchema }).strict()

export type ScopedApplyInput = z.infer<typeof scopedApplyInputSchema>
export type ScopedApply = z.infer<typeof scopedApplySchema>
export type ScopedApplyStatus = z.infer<typeof scopedApplyStatusSchema>
export type ScopedApplyProjection = z.infer<typeof scopedApplyProjectionSchema>
