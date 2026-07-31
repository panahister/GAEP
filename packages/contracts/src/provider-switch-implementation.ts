import { z } from "zod"

import { agentSelectionSchema } from "./agent.js"
import { changedUnitEvidenceReferenceSchema } from "./changed-unit-inventory.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactControlledClaudeImplementationReferenceSchema } from "./controlled-claude-implementation.js"
import { exactControlledCodexImplementationReferenceSchema } from "./controlled-codex-implementation.js"
import { executionWorkspaceScopeSchema } from "./execution.js"
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
    message: "Portable Provider Switch candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const providerSwitchDirectionSchema = z.enum(["codex-to-claude", "claude-to-codex"])
export const providerSwitchOutcomeSchema = z.enum(["candidate-defined", "unavailable", "gap", "conflict", "stale", "not-assessed"])

export const providerSwitchPathContinuitySchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(65_536),
  proposedPreviewPathId: z.string().uuid(),
  stagingPathId: z.string().uuid(),
  controlledCodexPathId: z.string().uuid(),
  controlledClaudePathId: z.string().uuid(),
  pathCandidate: executionWorkspaceScopeSchema,
  codexPlanReceiptDigest: digestSchema,
  claudePlanReceiptDigest: digestSchema,
  continuityReceiptDigest: digestSchema,
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  outcome: providerSwitchOutcomeSchema,
}).strict()

export const providerSwitchUnitContinuitySchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(65_536),
  proposedPreviewUnitId: z.string().uuid(),
  stagingUnitId: z.string().uuid(),
  controlledCodexUnitId: z.string().uuid(),
  controlledClaudeUnitId: z.string().uuid(),
  implementationUnitId: z.string().uuid(),
  implementationUnitKey: identifierSchema,
  codexUnitPlanReceiptDigest: digestSchema,
  claudeUnitPlanReceiptDigest: digestSchema,
  continuityReceiptDigest: digestSchema,
  paths: z.array(providerSwitchPathContinuitySchema).min(1).max(65_536),
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  outcome: providerSwitchOutcomeSchema,
}).strict().superRefine((unit, context) => {
  if (!unique(unit.paths.map((path) => path.id)) || !unique(unit.paths.map((path) => path.stagingPathId))) {
    context.addIssue({ code: "custom", path: ["paths"], message: "Provider-switch path and staging identities must be unique within a unit" })
  }
  unit.paths.forEach((path, index) => {
    if (path.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["paths", index, "ordinal"], message: "Provider-switch paths must use contiguous ordering" })
  })
  if (unit.outcome === "candidate-defined" && unit.paths.some((path) => path.outcome !== "candidate-defined")) {
    context.addIssue({ code: "custom", path: ["outcome"], message: "Candidate-defined units require candidate-defined paths" })
  }
})

export const providerSwitchHandoffSchema = z.object({
  state: z.literal("candidate-not-recorded"),
  handoffKey: identifierSchema,
  sourceTerminalRunState: z.literal("not-established"),
  targetRuntimeReadinessState: z.literal("not-established"),
  stageOwnershipTransferState: z.literal("not-performed"),
  resumeState: z.literal("not-performed"),
  handoffReceiptDigest: digestSchema,
}).strict()

export const providerSwitchLifecycleSchema = z.object({
  planningState: z.literal("candidate-defined"),
  providerTransitionState: z.literal("not-performed"),
  handoffState: z.literal("not-recorded"),
  stageOwnershipState: z.literal("unchanged"),
  resumeState: z.literal("not-performed"),
  approvalState: z.literal("not-established"),
  authorizationState: z.literal("not-established"),
  sourceMutationState: z.literal("not-performed"),
  applyState: z.literal("not-performed"),
  discardState: z.literal("not-performed"),
  recoveryState: z.literal("not-exercised"),
}).strict()

export const providerSwitchPrerequisiteSchema = z.object({
  key: z.enum(["source-terminal-state-review", "target-runtime-readiness", "human-switch-approval", "stage-ownership-transfer-authorization", "apply-authorization"]),
  state: z.literal("required-not-established"),
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).max(2_048),
}).strict()

const inputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  proposedChangePreview: exactProposedChangePreviewReferenceSchema,
  stagingWorkspace: exactStagingWorkspaceReferenceSchema,
  controlledCodexImplementation: exactControlledCodexImplementationReferenceSchema,
  controlledClaudeImplementation: exactControlledClaudeImplementationReferenceSchema,
  direction: providerSwitchDirectionSchema,
  sourceSelection: agentSelectionSchema,
  targetSelection: agentSelectionSchema,
  sourceProvider: managedProviderBindingSchema,
  targetProvider: managedProviderBindingSchema,
  sourcePlanReceiptDigest: digestSchema,
  targetPlanReceiptDigest: digestSchema,
  sourceRecoveryReceiptDigest: digestSchema,
  targetRecoveryReceiptDigest: digestSchema,
  units: z.array(providerSwitchUnitContinuitySchema).min(1).max(65_536),
  handoff: providerSwitchHandoffSchema,
  prerequisites: z.array(providerSwitchPrerequisiteSchema).length(5),
  lifecycle: providerSwitchLifecycleSchema,
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
    context.addIssue({ code: "custom", path: ["units"], message: "Provider-switch unit and staging identities must be unique" })
  }
  candidate.units.forEach((unit, index) => {
    if (unit.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["units", index, "ordinal"], message: "Provider-switch units must use contiguous ordering" })
  })
  const sourceIsCodex = candidate.sourceProvider.adapterId === "gaep.codex-cli" && candidate.sourceProvider.agentId === "codex-cli"
  const targetIsCodex = candidate.targetProvider.adapterId === "gaep.codex-cli" && candidate.targetProvider.agentId === "codex-cli"
  const sourceIsClaude = candidate.sourceProvider.adapterId === "gaep.claude-code-cli" && candidate.sourceProvider.agentId === "claude-code-cli"
  const targetIsClaude = candidate.targetProvider.adapterId === "gaep.claude-code-cli" && candidate.targetProvider.agentId === "claude-code-cli"
  if ((candidate.direction === "codex-to-claude" && (!sourceIsCodex || !targetIsClaude)) ||
      (candidate.direction === "claude-to-codex" && (!sourceIsClaude || !targetIsCodex))) {
    context.addIssue({ code: "custom", path: ["direction"], message: "Provider-switch direction must match the exact Codex and Claude source and target identities" })
  }
  if (candidate.sourceProvider.adapterId === candidate.targetProvider.adapterId || candidate.sourceProvider.agentId === candidate.targetProvider.agentId) {
    context.addIssue({ code: "custom", path: ["targetProvider"], message: "Provider-switch source and target identities must differ" })
  }
  const prerequisiteKeys = candidate.prerequisites.map((entry) => entry.key)
  if (!unique(prerequisiteKeys) || !["apply-authorization", "human-switch-approval", "source-terminal-state-review", "stage-ownership-transfer-authorization", "target-runtime-readiness"].every((key) => prerequisiteKeys.includes(key as never))) {
    context.addIssue({ code: "custom", path: ["prerequisites"], message: "All five provider-switch prerequisites are required" })
  }
  if (candidate.reviewState === "ready-for-human-review" && (candidate.unresolvedQuestions.length > 0 || candidate.units.some((unit) => unit.outcome !== "candidate-defined"))) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready provider switches require complete continuity and no unresolved questions" })
  }
})

export const providerSwitchImplementationInputSchema = rejectSecrets(inputBaseSchema)
const authorityBoundary = "provider-switch-implementation-is-a-versioned-portable-candidate-and-does-not-establish-provider-transition-handoff-resume-stage-ownership-transfer-approval-authorization-source-mutation-apply-discard-recovery-native-host-live-provider-security-acceptance-release-deployment-or-action-authority" as const
export const providerSwitchImplementationSchema = providerSwitchImplementationInputSchema.safeExtend({
  schemaVersion: z.literal(1), kind: z.literal("provider-switch-implementation-candidate"), id: z.string().uuid(), productId: z.string().uuid(),
  revision: z.number().int().positive(), bindingReceiptDigest: digestSchema, providerReceiptDigest: digestSchema,
  continuityReceiptDigest: digestSchema, handoffReceiptDigestVerified: digestSchema, lifecycleReceiptDigest: digestSchema,
  prerequisiteReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema, predecessorDigest: digestSchema.optional(), state: z.literal("candidate"),
  createdBy: humanActorSchema, updatedBy: humanActorSchema, createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  authorityBoundary: z.literal(authorityBoundary),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only revisions after revision one require a predecessor digest" })
})

export const exactProviderSwitchImplementationReferenceSchema = exactReferenceSchema
const statusAuthorityBoundary = "provider-switch-implementation-status-is-observational-and-grants-no-provider-transition-handoff-resume-stage-transfer-mutation-apply-discard-recovery-acceptance-release-deployment-or-action-authority" as const
export const providerSwitchImplementationStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("provider-switch-implementation-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(), initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactReferenceSchema.optional(), proposedChangePreview: exactProposedChangePreviewReferenceSchema.optional(), stagingWorkspace: exactStagingWorkspaceReferenceSchema.optional(),
  controlledCodexImplementation: exactControlledCodexImplementationReferenceSchema.optional(), controlledClaudeImplementation: exactControlledClaudeImplementationReferenceSchema.optional(),
  unitCount: z.number().int().nonnegative(), pathCount: z.number().int().nonnegative(), candidateDefinedCount: z.number().int().nonnegative(), gapCount: z.number().int().nonnegative(),
  staleBindingCount: z.number().int().nonnegative(), providerGapCount: z.number().int().nonnegative(), continuityGapCount: z.number().int().nonnegative(),
  handoffGapCount: z.number().int().nonnegative(), prerequisiteGapCount: z.number().int().nonnegative(), evidenceGapCount: z.number().int().nonnegative(),
  invalidCandidateCount: z.number().int().nonnegative(), unresolvedQuestionCount: z.number().int().nonnegative(),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]), state: z.enum(["attention-required", "candidate-defined"]),
  reasons: z.array(shortTextSchema).max(2_048), assessedAt: z.string().datetime(), authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict()

const projectionAuthorityBoundary = "provider-switch-implementation-projection-is-read-only-and-grants-no-provider-transition-handoff-resume-stage-transfer-mutation-apply-discard-recovery-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-repository-relative-path-candidates-provider-model-identifiers-counts-states-and-receipt-digests-only-not-prompts-context-source-diffs-provider-output-machine-paths-personal-data-secrets-or-credentials" as const
export const providerSwitchImplementationProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("provider-switch-implementation-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: providerSwitchImplementationStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.literal("candidate"), direction: providerSwitchDirectionSchema,
    sourceProvider: managedProviderBindingSchema, targetProvider: managedProviderBindingSchema, sourceSelection: agentSelectionSchema, targetSelection: agentSelectionSchema,
    handoff: providerSwitchHandoffSchema, lifecycle: providerSwitchLifecycleSchema,
    unitCount: z.number().int().nonnegative(), pathCount: z.number().int().nonnegative(), prerequisiteCount: z.number().int().nonnegative(),
    bindingReceiptDigest: digestSchema, providerReceiptDigest: digestSchema, continuityReceiptDigest: digestSchema,
    handoffReceiptDigest: digestSchema, lifecycleReceiptDigest: digestSchema, prerequisiteReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary), authorityBoundary: z.literal(projectionAuthorityBoundary), snapshotDigest: digestSchema,
}).strict()

export type ProviderSwitchImplementationInput = z.infer<typeof providerSwitchImplementationInputSchema>
export type ProviderSwitchImplementation = z.infer<typeof providerSwitchImplementationSchema>
export type ProviderSwitchImplementationStatus = z.infer<typeof providerSwitchImplementationStatusSchema>
export type ProviderSwitchImplementationProjection = z.infer<typeof providerSwitchImplementationProjectionSchema>
