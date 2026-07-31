import { z } from "zod"

import { changedUnitEvidenceReferenceSchema } from "./changed-unit-inventory.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactProposedChangePreviewReferenceSchema } from "./proposed-change-preview.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const identifierSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,127}$/)
const repositoryRelativePathSchema = z.string().trim().min(1).max(4_096).refine((value) => {
  if (value.startsWith("/") || value.includes("\\")) return false
  return value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
}, "Staging paths must be portable repository-relative candidates")
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()
const exactReferenceSchema = z.object({ recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict()

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
    message: "Portable Staging Workspace candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const stagingWorkspaceOutcomeSchema = z.enum([
  "candidate-defined", "unavailable", "gap", "conflict", "stale", "not-assessed",
])
export const stagingInspectionStateSchema = z.enum([
  "candidate-complete", "candidate-partial", "unavailable", "not-assessed",
])

export const stagingPathCandidateSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(65_536),
  proposedPathPreviewId: z.string().uuid(),
  pathCandidate: repositoryRelativePathSchema,
  sourcePathCandidate: repositoryRelativePathSchema.optional(),
  changeKind: z.enum(["add", "delete", "modify", "move", "not-assessed"]),
  previewPathDigest: digestSchema,
  sourceEndpointDigest: digestSchema,
  targetEndpointDigest: digestSchema,
  diffMetadataDigest: digestSchema,
  planOperationsDigest: digestSchema,
  traceDigest: digestSchema,
  inspectionState: stagingInspectionStateSchema,
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).max(2_048),
  outcome: stagingWorkspaceOutcomeSchema,
}).strict().superRefine((path, context) => {
  if ((path.changeKind === "move") !== (path.sourcePathCandidate !== undefined)) {
    context.addIssue({ code: "custom", path: ["sourcePathCandidate"], message: "Only move staging candidates require an exact source path candidate" })
  }
  if (path.outcome === "candidate-defined" && (path.inspectionState !== "candidate-complete" || path.evidenceReferences.length === 0)) {
    context.addIssue({ code: "custom", path: ["outcome"], message: "Candidate-defined staging paths require complete candidate inspection and attributable evidence" })
  }
})

export const stagingUnitCandidateSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(65_536),
  proposedPreviewUnitId: z.string().uuid(),
  implementationUnitId: z.string().uuid(),
  implementationUnitKey: identifierSchema,
  previewUnitDigest: digestSchema,
  pathCandidates: z.array(stagingPathCandidateSchema).min(1).max(65_536),
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).max(2_048),
  outcome: stagingWorkspaceOutcomeSchema,
}).strict().superRefine((unit, context) => {
  if (!unique(unit.pathCandidates.map((path) => path.id)) || !unique(unit.pathCandidates.map((path) => path.proposedPathPreviewId))) {
    context.addIssue({ code: "custom", path: ["pathCandidates"], message: "Staging path and source preview identities must be unique within a unit" })
  }
  unit.pathCandidates.forEach((path, index) => {
    if (path.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["pathCandidates", index, "ordinal"], message: "Staging paths must use contiguous canonical ordinal ordering" })
  })
  if (unit.outcome === "candidate-defined" && (unit.evidenceReferences.length === 0 || unit.pathCandidates.some((path) => path.outcome !== "candidate-defined"))) {
    context.addIssue({ code: "custom", path: ["outcome"], message: "Candidate-defined staging units require complete paths and attributable evidence" })
  }
})

export const stagingIdentitySchema = z.object({
  namespace: z.literal("gaep-managed-stage"),
  stageKey: identifierSchema,
  generation: z.number().int().positive().max(1_000_000),
  scopeDigest: digestSchema,
}).strict()

export const stagingLifecycleSchema = z.object({
  definitionState: z.literal("candidate-defined"),
  provisioningState: z.literal("not-performed"),
  actualStageExistenceState: z.literal("not-established"),
  inspectionState: stagingInspectionStateSchema,
  applyState: z.literal("not-performed"),
  discardState: z.literal("not-performed"),
  disposalState: z.literal("not-performed"),
}).strict()

export const stagingCapacitySchema = z.object({
  maximumFiles: z.number().int().positive().max(65_536),
  maximumBytes: z.number().int().positive().max(17_179_869_184),
  maximumSingleFileBytes: z.number().int().positive().max(1_073_741_824),
  maximumPathBytes: z.number().int().positive().max(16_384),
  maximumChanges: z.number().int().positive().max(65_536),
  candidateFileCount: z.number().int().nonnegative().max(65_536),
  candidateByteCount: z.number().int().nonnegative().max(17_179_869_184),
}).strict().superRefine((capacity, context) => {
  if (capacity.candidateFileCount > capacity.maximumFiles || capacity.candidateFileCount > capacity.maximumChanges || capacity.candidateByteCount > capacity.maximumBytes) {
    context.addIssue({ code: "custom", message: "Candidate staging scope must remain within every declared capacity ceiling" })
  }
  if (capacity.maximumSingleFileBytes > capacity.maximumBytes) {
    context.addIssue({ code: "custom", path: ["maximumSingleFileBytes"], message: "Single-file capacity cannot exceed total stage capacity" })
  }
})

export const stagingRecoveryCandidateSchema = z.object({
  strategy: z.literal("write-ahead-journal-candidate"),
  journalKey: identifierSchema,
  checkpointDigest: digestSchema,
  replayState: z.enum(["candidate-defined", "unavailable", "not-assessed"]),
  inspectionEvidenceReferences: z.array(changedUnitEvidenceReferenceSchema).max(2_048),
}).strict().superRefine((recovery, context) => {
  if (recovery.replayState === "candidate-defined" && recovery.inspectionEvidenceReferences.length === 0) {
    context.addIssue({ code: "custom", path: ["inspectionEvidenceReferences"], message: "Candidate recovery requires attributable inspection evidence" })
  }
})

const inputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  proposedChangePreview: exactProposedChangePreviewReferenceSchema,
  stagingIdentity: stagingIdentitySchema,
  lifecycle: stagingLifecycleSchema,
  units: z.array(stagingUnitCandidateSchema).min(1).max(65_536),
  exclusionRuleIds: canonicalList(identifierSchema, 512).refine((values) => values.length > 0, "At least one staging exclusion rule is required"),
  excludedPathCandidateCount: z.number().int().nonnegative().max(65_536),
  exclusionReceiptDigest: digestSchema,
  capacity: stagingCapacitySchema,
  recovery: stagingRecoveryCandidateSchema,
  inspectionEvidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  unresolvedQuestions: canonicalList(shortTextSchema, 512),
  limitations: canonicalList(shortTextSchema, 512).refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  repositoryTruthState: z.literal("not-established"), pathTruthState: z.literal("not-established"),
  sourceObservationTruthState: z.literal("not-established"), targetProposalTruthState: z.literal("not-established"),
  diffTruthState: z.literal("not-established"), approvedScopeState: z.literal("not-established"),
  changeApprovalState: z.literal("not-established"), codeMutationState: z.literal("not-performed"),
  realStageCreationState: z.literal("not-performed"), applyState: z.literal("not-performed"), discardState: z.literal("not-performed"),
  assignmentExecutionState: z.literal("not-established"), acceptanceDecisionState: z.literal("not-established"),
  mergeReadinessState: z.literal("not-established"), releaseReadinessState: z.literal("not-established"),
  deploymentReadinessState: z.literal("not-established"), actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  if (!unique(candidate.units.map((unit) => unit.id)) || !unique(candidate.units.map((unit) => unit.proposedPreviewUnitId))) {
    context.addIssue({ code: "custom", path: ["units"], message: "Staging unit and source preview identities must be unique" })
  }
  candidate.units.forEach((unit, index) => {
    if (unit.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["units", index, "ordinal"], message: "Staging units must use contiguous canonical ordinal ordering" })
  })
  const complete = candidate.units.every((unit) => unit.outcome === "candidate-defined") &&
    candidate.lifecycle.inspectionState === "candidate-complete" && candidate.recovery.replayState === "candidate-defined"
  if (candidate.reviewState === "ready-for-human-review" && (!complete || candidate.unresolvedQuestions.length > 0)) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready staging requires complete candidate inspection, recovery, unit coverage, and no unresolved questions" })
  }
})

export const stagingWorkspaceInputSchema = rejectSecrets(inputBaseSchema)
const authorityBoundary = "staging-workspace-is-a-versioned-portable-candidate-and-does-not-establish-real-stage-existence-repository-path-source-target-or-diff-truth-approved-scope-or-change-approval-code-mutation-apply-discard-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
export const stagingWorkspaceSchema = stagingWorkspaceInputSchema.safeExtend({
  schemaVersion: z.literal(1), kind: z.literal("staging-workspace-candidate"), id: z.string().uuid(), productId: z.string().uuid(),
  revision: z.number().int().positive(), bindingReceiptDigest: digestSchema, inventoryReceiptDigest: digestSchema,
  lifecycleReceiptDigest: digestSchema, exclusionReceiptDigestVerified: digestSchema, capacityReceiptDigest: digestSchema,
  recoveryReceiptDigest: digestSchema, inspectionReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
  predecessorDigest: digestSchema.optional(), state: z.literal("candidate"),
  createdBy: humanActorSchema, updatedBy: humanActorSchema, createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  authorityBoundary: z.literal(authorityBoundary),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only revisions after revision one require an exact predecessor digest" })
})

export const exactStagingWorkspaceReferenceSchema = exactReferenceSchema
const statusAuthorityBoundary = "staging-workspace-status-is-observational-and-does-not-establish-real-stage-existence-repository-path-source-target-or-diff-truth-approved-scope-or-change-approval-code-mutation-apply-discard-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
export const stagingWorkspaceStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("staging-workspace-status"), productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(), candidate: exactReferenceSchema.optional(),
  proposedChangePreview: exactProposedChangePreviewReferenceSchema.optional(), previewUnitCount: z.number().int().nonnegative(),
  previewPathCount: z.number().int().nonnegative(), stagingUnitCount: z.number().int().nonnegative(), stagingPathCount: z.number().int().nonnegative(),
  candidateDefinedCount: z.number().int().nonnegative(), unavailableCount: z.number().int().nonnegative(), gapCount: z.number().int().nonnegative(),
  conflictCount: z.number().int().nonnegative(), staleCount: z.number().int().nonnegative(), notAssessedCount: z.number().int().nonnegative(),
  orphanUnitCount: z.number().int().nonnegative(), orphanPathCount: z.number().int().nonnegative(), inspectionGapCount: z.number().int().nonnegative(),
  exclusionGapCount: z.number().int().nonnegative(), capacityGapCount: z.number().int().nonnegative(), recoveryGapCount: z.number().int().nonnegative(),
  evidenceGapCount: z.number().int().nonnegative(), staleBindingCount: z.number().int().nonnegative(), stalePreviewCount: z.number().int().nonnegative(),
  invalidCandidateCount: z.number().int().nonnegative(), unresolvedQuestionCount: z.number().int().nonnegative(),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]), state: z.enum(["attention-required", "candidate-defined"]),
  reasons: z.array(shortTextSchema).max(2_048), assessedAt: z.string().datetime(), authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict().superRefine((status, context) => {
  const gaps = status.unavailableCount + status.gapCount + status.conflictCount + status.staleCount + status.notAssessedCount + status.orphanUnitCount + status.orphanPathCount + status.inspectionGapCount + status.exclusionGapCount + status.capacityGapCount + status.recoveryGapCount + status.evidenceGapCount + status.staleBindingCount + status.stalePreviewCount + status.invalidCandidateCount + status.unresolvedQuestionCount
  if (status.state === "candidate-defined" && (gaps > 0 || !status.candidate || !status.proposedChangePreview || status.reviewState !== "ready-for-human-review" || status.reasons.length > 0 || status.previewUnitCount !== status.stagingUnitCount || status.previewPathCount !== status.stagingPathCount)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Candidate-defined status requires exact current preview coverage and human-review candidacy" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required staging must expose reasons" })
})

const projectionAuthorityBoundary = "staging-workspace-projection-is-read-only-and-does-not-establish-real-stage-existence-repository-path-source-target-or-diff-truth-approved-scope-or-change-approval-code-mutation-apply-discard-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-repository-relative-path-candidates-staging-identity-lifecycle-capacity-exclusion-recovery-counts-statuses-and-receipt-digests-only-not-machine-stage-paths-file-or-diff-content-evidence-content-personal-data-secrets-or-credentials" as const
export const stagingWorkspaceProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("staging-workspace-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: stagingWorkspaceStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.literal("candidate"),
    stagingIdentity: stagingIdentitySchema, lifecycle: stagingLifecycleSchema, capacity: stagingCapacitySchema,
    exclusionRuleIds: z.array(identifierSchema).max(512), excludedPathCandidateCount: z.number().int().nonnegative(),
    recovery: z.object({ strategy: z.literal("write-ahead-journal-candidate"), journalKey: identifierSchema, replayState: z.enum(["candidate-defined", "unavailable", "not-assessed"]), checkpointDigest: digestSchema }).strict(),
    bindingReceiptDigest: digestSchema, inventoryReceiptDigest: digestSchema, lifecycleReceiptDigest: digestSchema,
    exclusionReceiptDigest: digestSchema, capacityReceiptDigest: digestSchema, recoveryReceiptDigest: digestSchema,
    inspectionReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
    units: z.array(z.object({ implementationUnitId: z.string().uuid(), implementationUnitKey: identifierSchema,
      outcome: stagingWorkspaceOutcomeSchema, paths: z.array(z.object({ pathCandidate: repositoryRelativePathSchema,
        sourcePathCandidate: repositoryRelativePathSchema.optional(), changeKind: z.enum(["add", "delete", "modify", "move", "not-assessed"]),
        inspectionState: stagingInspectionStateSchema, outcome: stagingWorkspaceOutcomeSchema, previewPathDigest: digestSchema,
      }).strict()).max(65_536),
    }).strict()).max(65_536),
  }).strict().optional(),
  observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary), authorityBoundary: z.literal(projectionAuthorityBoundary), snapshotDigest: digestSchema,
}).strict()

export type StagingPathCandidate = z.infer<typeof stagingPathCandidateSchema>
export type StagingWorkspaceInput = z.infer<typeof stagingWorkspaceInputSchema>
export type StagingWorkspace = z.infer<typeof stagingWorkspaceSchema>
export type StagingWorkspaceStatus = z.infer<typeof stagingWorkspaceStatusSchema>
export type StagingWorkspaceProjection = z.infer<typeof stagingWorkspaceProjectionSchema>
