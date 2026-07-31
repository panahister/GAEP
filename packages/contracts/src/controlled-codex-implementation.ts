import { z } from "zod"

import { agentSelectionSchema } from "./agent.js"
import { changedUnitEvidenceReferenceSchema } from "./changed-unit-inventory.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { executionWorkspaceScopeSchema, toolPermissionSchema } from "./execution.js"
import { managedProviderBindingSchema } from "./managed-execution.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactProposedChangePreviewReferenceSchema } from "./proposed-change-preview.js"
import { exactStagingWorkspaceReferenceSchema } from "./staging-workspace.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,127}$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const exactReferenceSchema = z.object({ recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict()
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()

function unique(values: readonly string[]): boolean { return new Set(values).size === values.length }
function canonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}
function canonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 512) {
  return z.array(schema).max(maximum)
    .refine((values) => unique(values.map(String)), "Values must be unique")
    .refine((values) => canonical(values.map(String)), "Values must use canonical lexical ordering")
}
function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Controlled Codex Implementation candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const controlledCodexOutcomeSchema = z.enum([
  "candidate-defined", "unavailable", "gap", "conflict", "stale", "not-assessed",
])

export const controlledCodexPathSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(65_536),
  proposedPreviewPathId: z.string().uuid(),
  stagingPathId: z.string().uuid(),
  pathCandidate: executionWorkspaceScopeSchema,
  resourceScopeId: identifierSchema,
  toolCapabilities: canonicalList(identifierSchema, 256).refine((values) => values.length > 0, "A controlled path requires at least one bounded tool capability"),
  expectedEffect: z.enum(["provisional", "reversible-change"]),
  previewPathDigest: digestSchema,
  stagingPathDigest: digestSchema,
  stagedEffectReceiptDigest: digestSchema,
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  outcome: controlledCodexOutcomeSchema,
}).strict()

export const controlledCodexUnitSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(65_536),
  proposedPreviewUnitId: z.string().uuid(),
  stagingUnitId: z.string().uuid(),
  implementationUnitId: z.string().uuid(),
  implementationUnitKey: identifierSchema,
  previewUnitDigest: digestSchema,
  stagingUnitDigest: digestSchema,
  unitPlanReceiptDigest: digestSchema,
  paths: z.array(controlledCodexPathSchema).min(1).max(65_536),
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  outcome: controlledCodexOutcomeSchema,
}).strict().superRefine((unit, context) => {
  if (!unique(unit.paths.map((path) => path.id)) || !unique(unit.paths.map((path) => path.stagingPathId))) {
    context.addIssue({ code: "custom", path: ["paths"], message: "Controlled path and staging path identities must be unique within a unit" })
  }
  unit.paths.forEach((path, index) => {
    if (path.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["paths", index, "ordinal"], message: "Controlled paths must use contiguous ordering" })
  })
  if (unit.outcome === "candidate-defined" && unit.paths.some((path) => path.outcome !== "candidate-defined")) {
    context.addIssue({ code: "custom", path: ["outcome"], message: "Candidate-defined units require candidate-defined paths" })
  }
})

export const controlledCodexPlanSchema = z.object({
  strategy: z.literal("managed-codex-staged-candidate"),
  planKey: identifierSchema,
  workflowPlan: z.object({ recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  planReceiptDigest: digestSchema,
  stagedEffectReceiptDigest: digestSchema,
}).strict()

export const controlledCodexPrerequisiteSchema = z.object({
  key: z.enum(["exact-preview-review", "exact-staging-review", "human-change-approval", "apply-authorization"]),
  state: z.literal("required-not-established"),
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).max(2_048),
}).strict()

export const controlledCodexLifecycleSchema = z.object({
  planningState: z.literal("candidate-defined"),
  providerExecutionState: z.literal("not-performed"),
  realStageCreationState: z.literal("not-performed"),
  approvalState: z.literal("not-established"),
  authorizationState: z.literal("not-established"),
  sourceMutationState: z.literal("not-performed"),
  applyState: z.literal("not-performed"),
  discardState: z.literal("not-performed"),
  cancellationState: z.literal("not-exercised"),
  resumeState: z.literal("not-exercised"),
  recoveryState: z.literal("not-exercised"),
}).strict()

const inputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  proposedChangePreview: exactProposedChangePreviewReferenceSchema,
  stagingWorkspace: exactStagingWorkspaceReferenceSchema,
  selection: agentSelectionSchema,
  provider: managedProviderBindingSchema,
  plan: controlledCodexPlanSchema,
  permissions: z.array(toolPermissionSchema).min(1).max(256),
  resourceScopes: canonicalList(executionWorkspaceScopeSchema, 65_536).refine((values) => values.length > 0, "At least one resource scope is required"),
  units: z.array(controlledCodexUnitSchema).min(1).max(65_536),
  prerequisites: z.array(controlledCodexPrerequisiteSchema).length(4),
  lifecycle: controlledCodexLifecycleSchema,
  recoveryJournal: z.object({
    strategy: z.literal("write-ahead-journal-candidate"),
    journalKey: identifierSchema,
    checkpointDigest: digestSchema,
    recoveryReceiptDigest: digestSchema,
  }).strict(),
  applyPreconditions: canonicalList(shortTextSchema, 256).refine((values) => values.length > 0, "Apply preconditions are required"),
  discardPreconditions: canonicalList(shortTextSchema, 256).refine((values) => values.length > 0, "Discard preconditions are required"),
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  unresolvedQuestions: canonicalList(shortTextSchema, 512),
  limitations: canonicalList(shortTextSchema, 512).refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  acceptanceDecisionState: z.literal("not-established"),
  nativeHostAcceptanceState: z.literal("not-established"),
  liveProviderAcceptanceState: z.literal("not-established"),
  securityAcceptanceState: z.literal("not-established"),
  releaseReadinessState: z.literal("not-established"),
  deploymentReadinessState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  if (!unique(candidate.units.map((unit) => unit.id)) || !unique(candidate.units.map((unit) => unit.stagingUnitId))) {
    context.addIssue({ code: "custom", path: ["units"], message: "Controlled unit and staging unit identities must be unique" })
  }
  candidate.units.forEach((unit, index) => {
    if (unit.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["units", index, "ordinal"], message: "Controlled units must use contiguous ordering" })
  })
  const prerequisiteKeys = candidate.prerequisites.map((entry) => entry.key)
  if (!unique(prerequisiteKeys) || !["apply-authorization", "exact-preview-review", "exact-staging-review", "human-change-approval"].every((key) => prerequisiteKeys.includes(key as never))) {
    context.addIssue({ code: "custom", path: ["prerequisites"], message: "All four distinct approval and authorization prerequisites are required" })
  }
  if (candidate.reviewState === "ready-for-human-review" && (candidate.unresolvedQuestions.length > 0 || candidate.units.some((unit) => unit.outcome !== "candidate-defined"))) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready candidates require complete unit coverage and no unresolved questions" })
  }
})

export const controlledCodexImplementationInputSchema = rejectSecrets(inputBaseSchema)
const authorityBoundary = "controlled-codex-implementation-is-a-versioned-portable-candidate-and-does-not-establish-provider-execution-real-stage-existence-approval-authorization-source-mutation-apply-discard-cancellation-resume-recovery-native-host-live-provider-security-acceptance-release-deployment-or-action-authority" as const
export const controlledCodexImplementationSchema = controlledCodexImplementationInputSchema.safeExtend({
  schemaVersion: z.literal(1), kind: z.literal("controlled-codex-implementation-candidate"), id: z.string().uuid(), productId: z.string().uuid(),
  revision: z.number().int().positive(), bindingReceiptDigest: digestSchema, providerReceiptDigest: digestSchema,
  scopeReceiptDigest: digestSchema, planReceiptDigestVerified: digestSchema, stagedEffectReceiptDigestVerified: digestSchema,
  lifecycleReceiptDigest: digestSchema, prerequisiteReceiptDigest: digestSchema, recoveryReceiptDigestVerified: digestSchema,
  assessmentReceiptDigest: digestSchema, predecessorDigest: digestSchema.optional(), state: z.literal("candidate"),
  createdBy: humanActorSchema, updatedBy: humanActorSchema, createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  authorityBoundary: z.literal(authorityBoundary),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only revisions after revision one require a predecessor digest" })
})

export const exactControlledCodexImplementationReferenceSchema = exactReferenceSchema
const statusAuthorityBoundary = "controlled-codex-implementation-status-is-observational-and-grants-no-execution-stage-approval-authorization-mutation-apply-discard-recovery-acceptance-release-deployment-or-action-authority" as const
export const controlledCodexImplementationStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("controlled-codex-implementation-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(), initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactReferenceSchema.optional(), proposedChangePreview: exactProposedChangePreviewReferenceSchema.optional(), stagingWorkspace: exactStagingWorkspaceReferenceSchema.optional(),
  unitCount: z.number().int().nonnegative(), pathCount: z.number().int().nonnegative(), resourceScopeCount: z.number().int().nonnegative(), toolPermissionCount: z.number().int().nonnegative(),
  candidateDefinedCount: z.number().int().nonnegative(), gapCount: z.number().int().nonnegative(), staleBindingCount: z.number().int().nonnegative(), providerGapCount: z.number().int().nonnegative(),
  scopeGapCount: z.number().int().nonnegative(), planGapCount: z.number().int().nonnegative(), prerequisiteGapCount: z.number().int().nonnegative(), recoveryGapCount: z.number().int().nonnegative(),
  evidenceGapCount: z.number().int().nonnegative(), invalidCandidateCount: z.number().int().nonnegative(), unresolvedQuestionCount: z.number().int().nonnegative(),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]), state: z.enum(["attention-required", "candidate-defined"]),
  reasons: z.array(shortTextSchema).max(2_048), assessedAt: z.string().datetime(), authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict()

const projectionAuthorityBoundary = "controlled-codex-implementation-projection-is-read-only-and-grants-no-execution-stage-approval-authorization-mutation-apply-discard-recovery-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-repository-relative-scopes-provider-identifiers-counts-states-and-receipt-digests-only-not-prompts-context-source-diffs-provider-output-machine-paths-personal-data-secrets-or-credentials" as const
export const controlledCodexImplementationProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("controlled-codex-implementation-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: controlledCodexImplementationStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.literal("candidate"),
    provider: managedProviderBindingSchema, plan: controlledCodexPlanSchema, lifecycle: controlledCodexLifecycleSchema,
    resourceScopes: z.array(executionWorkspaceScopeSchema).max(65_536), permissions: z.array(toolPermissionSchema).max(256),
    unitCount: z.number().int().nonnegative(), pathCount: z.number().int().nonnegative(), prerequisiteCount: z.number().int().nonnegative(),
    bindingReceiptDigest: digestSchema, providerReceiptDigest: digestSchema, scopeReceiptDigest: digestSchema,
    planReceiptDigest: digestSchema, stagedEffectReceiptDigest: digestSchema, lifecycleReceiptDigest: digestSchema,
    prerequisiteReceiptDigest: digestSchema, recoveryReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary), authorityBoundary: z.literal(projectionAuthorityBoundary), snapshotDigest: digestSchema,
}).strict()

export type ControlledCodexImplementationInput = z.infer<typeof controlledCodexImplementationInputSchema>
export type ControlledCodexImplementation = z.infer<typeof controlledCodexImplementationSchema>
export type ControlledCodexImplementationStatus = z.infer<typeof controlledCodexImplementationStatusSchema>
export type ControlledCodexImplementationProjection = z.infer<typeof controlledCodexImplementationProjectionSchema>
