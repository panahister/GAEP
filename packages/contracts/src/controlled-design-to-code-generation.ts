import { z } from "zod"

import { agentSelectionSchema } from "./agent.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { changedUnitEvidenceReferenceSchema } from "./changed-unit-inventory.js"
import { managedProviderBindingSchema } from "./managed-execution.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,127}$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const exactReferenceSchema = z.object({
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()
const relativePathSchema = z.string().trim().min(1).max(512).superRefine((value, context) => {
  if (value.startsWith("/") || value.startsWith("\\") || /^[A-Za-z]:/u.test(value) ||
      value.includes("\\") || value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    context.addIssue({ code: "custom", message: "Generation targets must use normalized repository-relative paths" })
  }
})

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
    message: "Portable Controlled Design-to-Code Generation candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const controlledDesignToCodeGenerationProviderSchema = z.enum(["codex", "claude"])

export const controlledDesignToCodeGenerationDependencySchema = z.object({
  approvedFigmaContextRetrieval: exactReferenceSchema,
  designBaseline: exactReferenceSchema,
  designToRequirementBinding: exactReferenceSchema,
  figmaToBoilerplateMapping: exactReferenceSchema,
  designToCodeBindingRegistry: exactReferenceSchema,
  routeScreenComponentMapping: exactReferenceSchema,
  implementationUnitModel: exactReferenceSchema,
  technologyProfile: exactReferenceSchema,
  boilerplateSelectionBinding: exactReferenceSchema,
  boilerplateCompatibilityValidation: exactReferenceSchema,
  proposedChangePreview: exactReferenceSchema,
  stagingWorkspace: exactReferenceSchema,
  controlledCodexImplementation: exactReferenceSchema,
  controlledClaudeImplementation: exactReferenceSchema,
  providerSwitchImplementation: exactReferenceSchema,
  modelSwitchImplementation: exactReferenceSchema,
}).strict()

export const controlledDesignGenerationContextSchema = z.object({
  approvedSnapshotReceiptDigest: digestSchema,
  approvedGenerationContextReceiptDigest: digestSchema,
  baselineMembershipDigest: digestSchema,
  baselineSemanticVersion: z.string().regex(/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?$/),
  designBindingCatalogDigest: digestSchema,
  routeSubjectCatalogDigest: digestSchema,
  contentBoundary: z.literal("metadata-and-digests-only"),
  materializationState: z.literal("not-performed"),
  transferState: z.literal("not-performed"),
}).strict()

export const controlledDesignGenerationTargetSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(65_536),
  targetKey: identifierSchema,
  designToCodeBindingSubjectId: z.string().uuid(),
  implementationUnitId: z.string().uuid(),
  repositoryCandidate: identifierSchema,
  moduleCandidate: identifierSchema,
  pathCandidate: relativePathSchema,
  expectedTraceKeys: canonicalList(identifierSchema, 4_096).refine((values) => values.length > 0, "Expected trace keys are required"),
  expectedTestOutputs: canonicalList(shortTextSchema, 4_096).refine((values) => values.length > 0, "Expected test outputs are required"),
  targetReceiptDigest: digestSchema,
  generationEffectState: z.literal("not-performed"),
  sourceMutationState: z.literal("not-performed"),
}).strict()

export const controlledDesignGenerationLifecycleSchema = z.object({
  planningState: z.literal("candidate-defined"),
  figmaAccessState: z.literal("not-performed"),
  contextMaterializationState: z.literal("not-performed"),
  contextTransferState: z.literal("not-performed"),
  providerExecutionState: z.literal("not-performed"),
  generatedOutputState: z.literal("not-created"),
  outputInspectionState: z.literal("not-performed"),
  realStageCreationState: z.literal("not-performed"),
  sourceMutationState: z.literal("not-performed"),
  approvalState: z.literal("not-established"),
  authorizationState: z.literal("not-established"),
  acceptanceState: z.literal("not-established"),
}).strict()

export const controlledDesignGenerationPrerequisiteSchema = z.object({
  key: z.enum([
    "approved-design-context-review",
    "exact-target-review",
    "expected-trace-test-review",
    "live-provider-readiness",
    "human-generation-approval",
    "stage-authorization",
  ]),
  state: z.literal("required-not-established"),
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).max(2_048),
}).strict()

const inputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  dependencies: controlledDesignToCodeGenerationDependencySchema,
  selectedProvider: controlledDesignToCodeGenerationProviderSchema,
  selection: agentSelectionSchema,
  provider: managedProviderBindingSchema,
  designContext: controlledDesignGenerationContextSchema,
  planKey: identifierSchema,
  targets: z.array(controlledDesignGenerationTargetSchema).min(1).max(65_536),
  prerequisites: z.array(controlledDesignGenerationPrerequisiteSchema).length(6),
  lifecycle: controlledDesignGenerationLifecycleSchema,
  evidenceReferences: z.array(changedUnitEvidenceReferenceSchema).min(1).max(2_048),
  unresolvedQuestions: canonicalList(shortTextSchema),
  limitations: canonicalList(shortTextSchema).refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  generationReadinessState: z.literal("not-established"),
  nativeHostAcceptanceState: z.literal("not-established"),
  liveProviderAcceptanceState: z.literal("not-established"),
  securityAcceptanceState: z.literal("not-established"),
  releaseReadinessState: z.literal("not-established"),
  deploymentReadinessState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  if (!unique(candidate.targets.map((target) => target.id)) ||
      !unique(candidate.targets.map((target) => target.targetKey)) ||
      !unique(candidate.targets.map((target) => target.designToCodeBindingSubjectId)) ||
      !unique(candidate.targets.map((target) => `${target.repositoryCandidate}:${target.pathCandidate}`))) {
    context.addIssue({ code: "custom", path: ["targets"], message: "Generation targets, binding subjects, keys, and repository paths must be unique" })
  }
  candidate.targets.forEach((target, index) => {
    if (target.ordinal !== index + 1) {
      context.addIssue({ code: "custom", path: ["targets", index, "ordinal"], message: "Generation targets must use contiguous canonical ordinal ordering" })
    }
  })
  const prerequisiteKeys = candidate.prerequisites.map((entry) => entry.key)
  const required = [
    "approved-design-context-review", "exact-target-review", "expected-trace-test-review",
    "human-generation-approval", "live-provider-readiness", "stage-authorization",
  ]
  if (!unique(prerequisiteKeys) || !required.every((key) => prerequisiteKeys.includes(key as never))) {
    context.addIssue({ code: "custom", path: ["prerequisites"], message: "All six controlled generation prerequisites are required" })
  }
  if (candidate.reviewState === "ready-for-human-review" && candidate.unresolvedQuestions.length > 0) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready generation plans cannot contain unresolved questions" })
  }
})

export const controlledDesignToCodeGenerationInputSchema = rejectSecrets(inputBaseSchema)
const authorityBoundary = "controlled-design-to-code-generation-is-an-offline-versioned-portable-generation-plan-candidate-and-does-not-call-figma-or-a-live-provider-materialize-or-transfer-protected-context-generate-or-inspect-code-create-stage-effects-mutate-source-establish-approval-authorization-acceptance-readiness-release-deployment-or-action-authority" as const
export const controlledDesignToCodeGenerationSchema = controlledDesignToCodeGenerationInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("controlled-design-to-code-generation-candidate"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  dependencyReceiptDigest: digestSchema,
  providerReceiptDigest: digestSchema,
  designContextReceiptDigest: digestSchema,
  targetCatalogDigest: digestSchema,
  expectedOutputReceiptDigest: digestSchema,
  lifecycleReceiptDigest: digestSchema,
  prerequisiteReceiptDigest: digestSchema,
  assessmentReceiptDigest: digestSchema,
  predecessorDigest: digestSchema.optional(),
  state: z.literal("candidate"),
  createdBy: humanActorSchema,
  updatedBy: humanActorSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  authorityBoundary: z.literal(authorityBoundary),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only revisions after revision one require a predecessor digest" })
  }
})

export const exactControlledDesignToCodeGenerationReferenceSchema = exactReferenceSchema
const statusAuthorityBoundary = "controlled-design-to-code-generation-status-is-observational-and-grants-no-figma-or-provider-access-context-transfer-generation-output-stage-mutation-approval-authorization-acceptance-release-deployment-or-action-authority" as const
export const controlledDesignToCodeGenerationStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("controlled-design-to-code-generation-status"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  candidate: exactReferenceSchema.optional(),
  dependencies: controlledDesignToCodeGenerationDependencySchema.optional(),
  selectedProvider: controlledDesignToCodeGenerationProviderSchema.optional(),
  targetCount: z.number().int().nonnegative(),
  implementationUnitCount: z.number().int().nonnegative(),
  pathCount: z.number().int().nonnegative(),
  expectedTraceCount: z.number().int().nonnegative(),
  expectedTestOutputCount: z.number().int().nonnegative(),
  staleBindingCount: z.number().int().nonnegative(),
  targetGapCount: z.number().int().nonnegative(),
  providerGapCount: z.number().int().nonnegative(),
  contextGapCount: z.number().int().nonnegative(),
  lifecycleGapCount: z.number().int().nonnegative(),
  prerequisiteGapCount: z.number().int().nonnegative(),
  evidenceGapCount: z.number().int().nonnegative(),
  invalidCandidateCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative(),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "candidate-defined"]),
  reasons: z.array(shortTextSchema).max(2_048),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict()

const projectionAuthorityBoundary = "controlled-design-to-code-generation-projection-is-read-only-and-grants-no-figma-or-provider-access-context-transfer-generation-output-stage-mutation-approval-authorization-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-provider-model-identifiers-target-counts-states-and-receipt-digests-only-not-design-content-prompts-provider-output-source-diffs-machine-paths-personal-data-secrets-credentials-or-permissions" as const
export const controlledDesignToCodeGenerationProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("controlled-design-to-code-generation-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: controlledDesignToCodeGenerationStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.literal("candidate"),
    selectedProvider: controlledDesignToCodeGenerationProviderSchema, selection: agentSelectionSchema,
    provider: managedProviderBindingSchema, designContext: controlledDesignGenerationContextSchema,
    planKey: identifierSchema, targetCount: z.number().int().positive(), implementationUnitCount: z.number().int().positive(),
    pathCount: z.number().int().positive(), dependencyReceiptDigest: digestSchema, providerReceiptDigest: digestSchema,
    designContextReceiptDigest: digestSchema, targetCatalogDigest: digestSchema, expectedOutputReceiptDigest: digestSchema,
    lifecycleReceiptDigest: digestSchema, prerequisiteReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    lifecycle: controlledDesignGenerationLifecycleSchema, reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(privacyBoundary),
  authorityBoundary: z.literal(projectionAuthorityBoundary),
  snapshotDigest: digestSchema,
}).strict()

export type ControlledDesignToCodeGenerationInput = z.infer<typeof controlledDesignToCodeGenerationInputSchema>
export type ControlledDesignToCodeGeneration = z.infer<typeof controlledDesignToCodeGenerationSchema>
export type ControlledDesignToCodeGenerationStatus = z.infer<typeof controlledDesignToCodeGenerationStatusSchema>
export type ControlledDesignToCodeGenerationProjection = z.infer<typeof controlledDesignToCodeGenerationProjectionSchema>
