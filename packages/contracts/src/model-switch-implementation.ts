import { z } from "zod"

import { agentSelectionSchema } from "./agent.js"
import { changedUnitEvidenceReferenceSchema } from "./changed-unit-inventory.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactControlledClaudeImplementationReferenceSchema } from "./controlled-claude-implementation.js"
import { exactControlledCodexImplementationReferenceSchema } from "./controlled-codex-implementation.js"
import { managedProviderBindingSchema } from "./managed-execution.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactProposedChangePreviewReferenceSchema } from "./proposed-change-preview.js"
import { exactProviderSwitchImplementationReferenceSchema } from "./provider-switch-implementation.js"
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
  return z.array(schema).max(maximum).refine((values) => unique(values.map(String)), "Values must be unique")
    .refine((values) => canonical(values.map(String)), "Values must use canonical lexical ordering")
}
function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Model Switch candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const modelSwitchProviderSchema = z.enum(["codex", "claude"])
export const modelSwitchProviderRoleSchema = z.enum(["provider-switch-source-candidate", "provider-switch-target-candidate"])

export const modelSwitchTransitionSchema = z.object({
  state: z.literal("candidate-not-recorded"),
  transitionKey: identifierSchema,
  sourceModelState: z.literal("candidate-bound"),
  targetModelAvailabilityState: z.literal("not-established"),
  capabilityRefreshState: z.literal("not-performed"),
  contextTransferState: z.literal("not-performed"),
  handoffState: z.literal("not-recorded"),
  resumeState: z.literal("not-performed"),
  transitionReceiptDigest: digestSchema,
}).strict()

export const modelSwitchLifecycleSchema = z.object({
  planningState: z.literal("candidate-defined"),
  modelTransitionState: z.literal("not-performed"),
  providerExecutionState: z.literal("not-performed"),
  capabilityRefreshState: z.literal("not-performed"),
  contextTransferState: z.literal("not-performed"),
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

export const modelSwitchPrerequisiteSchema = z.object({
  key: z.enum(["source-model-review", "target-model-discovery", "capability-refresh-review", "human-model-switch-approval", "resume-authorization"]),
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
  providerSwitchImplementation: exactProviderSwitchImplementationReferenceSchema,
  provider: modelSwitchProviderSchema,
  providerSwitchRole: modelSwitchProviderRoleSchema,
  sourceSelection: agentSelectionSchema,
  targetSelection: agentSelectionSchema,
  sourceProvider: managedProviderBindingSchema,
  targetProvider: managedProviderBindingSchema,
  sourcePlanReceiptDigest: digestSchema,
  sourceRecoveryReceiptDigest: digestSchema,
  providerSwitchContinuityReceiptDigest: digestSchema,
  unitCount: z.number().int().positive().max(65_536),
  pathCount: z.number().int().positive().max(65_536),
  transition: modelSwitchTransitionSchema,
  prerequisites: z.array(modelSwitchPrerequisiteSchema).length(5),
  lifecycle: modelSwitchLifecycleSchema,
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  unresolvedQuestions: canonicalList(shortTextSchema),
  limitations: canonicalList(shortTextSchema).refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  acceptanceDecisionState: z.literal("not-established"), nativeHostAcceptanceState: z.literal("not-established"),
  liveProviderAcceptanceState: z.literal("not-established"), securityAcceptanceState: z.literal("not-established"),
  releaseReadinessState: z.literal("not-established"), deploymentReadinessState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  if (candidate.sourceSelection.adapterId !== candidate.targetSelection.adapterId || candidate.sourceSelection.agentId !== candidate.targetSelection.agentId ||
      candidate.sourceProvider.adapterId !== candidate.targetProvider.adapterId || candidate.sourceProvider.agentId !== candidate.targetProvider.agentId) {
    context.addIssue({ code: "custom", path: ["targetSelection"], message: "Model-switch source and target must remain within one provider and agent" })
  }
  if (candidate.sourceSelection.modelId === candidate.targetSelection.modelId || candidate.sourceProvider.modelId === candidate.targetProvider.modelId) {
    context.addIssue({ code: "custom", path: ["targetSelection", "modelId"], message: "Model-switch target model must differ from the source model" })
  }
  if (candidate.sourceSelection.capabilityDigest !== candidate.targetSelection.capabilityDigest || candidate.sourceProvider.capabilityDigest !== candidate.targetProvider.capabilityDigest) {
    context.addIssue({ code: "custom", path: ["targetSelection", "capabilityDigest"], message: "Model-switch candidates require one exact capability snapshot" })
  }
  const keys = candidate.prerequisites.map((entry) => entry.key)
  const required = ["capability-refresh-review", "human-model-switch-approval", "resume-authorization", "source-model-review", "target-model-discovery"]
  if (!unique(keys) || !required.every((key) => keys.includes(key as never))) {
    context.addIssue({ code: "custom", path: ["prerequisites"], message: "All five model-switch prerequisites are required" })
  }
  if (candidate.reviewState === "ready-for-human-review" && candidate.unresolvedQuestions.length > 0) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready model switches cannot contain unresolved questions" })
  }
})

export const modelSwitchImplementationInputSchema = rejectSecrets(inputBaseSchema)
const authorityBoundary = "model-switch-implementation-is-a-versioned-portable-candidate-and-does-not-establish-model-availability-capability-refresh-provider-execution-model-transition-context-transfer-handoff-resume-stage-ownership-transfer-approval-authorization-source-mutation-apply-discard-recovery-native-host-live-provider-security-acceptance-release-deployment-or-action-authority" as const
export const modelSwitchImplementationSchema = modelSwitchImplementationInputSchema.safeExtend({
  schemaVersion: z.literal(1), kind: z.literal("model-switch-implementation-candidate"), id: z.string().uuid(), productId: z.string().uuid(),
  revision: z.number().int().positive(), bindingReceiptDigest: digestSchema, modelReceiptDigest: digestSchema,
  continuityReceiptDigest: digestSchema, transitionReceiptDigestVerified: digestSchema, lifecycleReceiptDigest: digestSchema,
  prerequisiteReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema, predecessorDigest: digestSchema.optional(), state: z.literal("candidate"),
  createdBy: humanActorSchema, updatedBy: humanActorSchema, createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  authorityBoundary: z.literal(authorityBoundary),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only revisions after revision one require a predecessor digest" })
})

export const exactModelSwitchImplementationReferenceSchema = exactReferenceSchema
const statusAuthorityBoundary = "model-switch-implementation-status-is-observational-and-grants-no-model-transition-context-transfer-handoff-resume-stage-transfer-mutation-apply-discard-recovery-acceptance-release-deployment-or-action-authority" as const
export const modelSwitchImplementationStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("model-switch-implementation-status"), productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(), candidate: exactReferenceSchema.optional(),
  providerSwitchImplementation: exactProviderSwitchImplementationReferenceSchema.optional(), controlledCodexImplementation: exactControlledCodexImplementationReferenceSchema.optional(),
  controlledClaudeImplementation: exactControlledClaudeImplementationReferenceSchema.optional(), unitCount: z.number().int().nonnegative(), pathCount: z.number().int().nonnegative(),
  staleBindingCount: z.number().int().nonnegative(), providerGapCount: z.number().int().nonnegative(), modelGapCount: z.number().int().nonnegative(),
  continuityGapCount: z.number().int().nonnegative(), transitionGapCount: z.number().int().nonnegative(), prerequisiteGapCount: z.number().int().nonnegative(),
  evidenceGapCount: z.number().int().nonnegative(), invalidCandidateCount: z.number().int().nonnegative(), unresolvedQuestionCount: z.number().int().nonnegative(),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]), state: z.enum(["attention-required", "candidate-defined"]),
  reasons: z.array(shortTextSchema).max(2_048), assessedAt: z.string().datetime(), authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict()

const projectionAuthorityBoundary = "model-switch-implementation-projection-is-read-only-and-grants-no-model-transition-context-transfer-handoff-resume-stage-transfer-mutation-apply-discard-recovery-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-provider-model-identifiers-counts-states-and-receipt-digests-only-not-prompts-context-source-diffs-provider-output-machine-paths-personal-data-secrets-or-credentials" as const
export const modelSwitchImplementationProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("model-switch-implementation-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: modelSwitchImplementationStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.literal("candidate"), provider: modelSwitchProviderSchema,
    providerSwitchRole: modelSwitchProviderRoleSchema, sourceSelection: agentSelectionSchema, targetSelection: agentSelectionSchema,
    sourceProvider: managedProviderBindingSchema, targetProvider: managedProviderBindingSchema, transition: modelSwitchTransitionSchema,
    lifecycle: modelSwitchLifecycleSchema, unitCount: z.number().int().nonnegative(), pathCount: z.number().int().nonnegative(), prerequisiteCount: z.number().int().nonnegative(),
    bindingReceiptDigest: digestSchema, modelReceiptDigest: digestSchema, continuityReceiptDigest: digestSchema,
    transitionReceiptDigest: digestSchema, lifecycleReceiptDigest: digestSchema, prerequisiteReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary), authorityBoundary: z.literal(projectionAuthorityBoundary), snapshotDigest: digestSchema,
}).strict()

export type ModelSwitchImplementationInput = z.infer<typeof modelSwitchImplementationInputSchema>
export type ModelSwitchImplementation = z.infer<typeof modelSwitchImplementationSchema>
export type ModelSwitchImplementationStatus = z.infer<typeof modelSwitchImplementationStatusSchema>
export type ModelSwitchImplementationProjection = z.infer<typeof modelSwitchImplementationProjectionSchema>
