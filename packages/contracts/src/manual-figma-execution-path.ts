import { z } from "zod"

import { exactAccessibilityDesignRulesReferenceSchema } from "./accessibility-design-rules.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactDesignApplicabilityReferenceSchema } from "./design-applicability.js"
import { exactDesignRequirementsReferenceSchema } from "./design-requirements.js"
import { exactDesignSystemTokenContractReferenceSchema } from "./design-system-token-contract.js"
import { containsSecretShapedValue, informationClassificationSchema, workspaceRelativePathSchema } from "./product-studio.js"
import { exactResponsiveMultiPlatformTargetsReferenceSchema } from "./responsive-multi-platform-targets.js"
import { exactScreenStateInventoryReferenceSchema } from "./screen-state-inventory.js"
import { exactSourceReferenceSchema } from "./source-governance.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const requirementKeySchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const longTextSchema = z.string().trim().min(10).max(20_000)
const actorSchema = z.object({ kind: z.enum(["human", "role"]), id: shortTextSchema }).strict()
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function canonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}

function canonicalStringArray<T extends z.ZodType<string>>(schema: T, maximum = 512) {
  return z.array(schema).max(maximum)
    .refine((values) => unique(values), "Values must be unique")
    .refine((values) => canonical(values), "Values must use canonical lexical ordering")
}

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Manual Figma Execution Path candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalIdentifierListSchema = canonicalStringArray(identifierSchema, 16_384)
const canonicalDigestListSchema = canonicalStringArray(digestSchema, 1_024)
const canonicalTextListSchema = canonicalStringArray(shortTextSchema)
const requiredCanonicalTextListSchema = canonicalTextListSchema
  .refine((values) => values.length > 0, "At least one value is required")
const exactSourceListSchema = z.array(exactSourceReferenceSchema).min(1).max(256)
  .refine((entries) => unique(entries.map((entry) =>
    `${entry.sourceId}:${entry.sourceRevision}:${entry.recordDigest}:${entry.contentDigest}`)),
  "Source references must be unique")
  .refine((entries) => canonical(entries.map((entry) =>
    `${entry.sourceId}:${String(entry.sourceRevision).padStart(12, "0")}`)),
  "Source references must use canonical identity ordering")

const exactDesignApplicabilityBindingSchema = exactDesignApplicabilityReferenceSchema
  .extend({ membershipDigest: digestSchema }).strict()
const exactScreenStateInventoryBindingSchema = exactScreenStateInventoryReferenceSchema
  .extend({ membershipDigest: digestSchema }).strict()
const exactDesignRequirementsBindingSchema = exactDesignRequirementsReferenceSchema
  .extend({ membershipDigest: digestSchema }).strict()
const exactDesignSystemTokenContractBindingSchema = exactDesignSystemTokenContractReferenceSchema
  .extend({ membershipDigest: digestSchema }).strict()
const exactAccessibilityDesignRulesBindingSchema = exactAccessibilityDesignRulesReferenceSchema
  .extend({ membershipDigest: digestSchema }).strict()
const exactResponsiveMultiPlatformTargetsBindingSchema = exactResponsiveMultiPlatformTargetsReferenceSchema
  .extend({ membershipDigest: digestSchema }).strict()

const candidateOwnershipSchema = z.object({
  state: z.enum(["assigned-candidate", "unresolved"]),
  owner: actorSchema.optional(),
}).strict().superRefine((ownership, context) => {
  if ((ownership.state === "assigned-candidate") !== (ownership.owner !== undefined)) {
    context.addIssue({ code: "custom", message: "Candidate ownership requires an explicit actor; unresolved ownership forbids one" })
  }
})

export const manualFigmaHandoffArtifactKinds = [
  "accessibility-rules",
  "design-brief",
  "design-requirements",
  "design-system-token-contract",
  "responsive-platform-targets",
  "review-checklist",
  "screen-state-inventory",
  "source-index",
] as const
export const manualFigmaReturnArtifactKinds = [
  "decisions",
  "exports",
  "file-reference",
  "node-identities",
  "review-evidence",
  "screenshots",
  "tokens",
] as const
export const manualFigmaInstructionKinds = [
  "prepare",
  "handoff",
  "manual-figma-execution",
  "export-return",
  "human-review",
] as const

const handoffArtifactKindSchema = z.enum(manualFigmaHandoffArtifactKinds)
const returnArtifactKindSchema = z.enum(manualFigmaReturnArtifactKinds)
const instructionKindSchema = z.enum(manualFigmaInstructionKinds)
const requiredHandoffArtifactsSchema = canonicalStringArray(handoffArtifactKindSchema, 32).min(1)
const requiredReturnArtifactsSchema = canonicalStringArray(returnArtifactKindSchema, 32).min(1)

export const manualFigmaExecutionScopeSchema = z.object({
  key: identifierSchema,
  designScopeKey: identifierSchema,
  figmaMode: z.enum(["figma-design", "figma-make"]),
  executionMode: z.literal("manual-disconnected"),
  handoffLocation: workspaceRelativePathSchema,
  handoffManifestDigest: digestSchema,
  handoffPackageDigest: digestSchema,
  includedArtifacts: requiredHandoffArtifactsSchema,
  requiredReturns: requiredReturnArtifactsSchema,
  instructionStepKeys: canonicalIdentifierListSchema.min(1),
  ownership: candidateOwnershipSchema,
  sources: exactSourceListSchema,
  limitations: canonicalTextListSchema,
}).strict()

export const manualFigmaInstructionStepSchema = z.object({
  key: identifierSchema,
  sequence: z.number().int().positive().max(10_000),
  kind: instructionKindSchema,
  scopeKeys: canonicalIdentifierListSchema.min(1),
  instruction: longTextSchema,
  requiredInputs: canonicalStringArray(handoffArtifactKindSchema, 32),
  expectedOutputs: canonicalStringArray(returnArtifactKindSchema, 32),
  humanActionRequired: z.boolean(),
  completionState: z.literal("not-executed"),
  actionAuthorityState: z.literal("not-granted"),
  sources: exactSourceListSchema,
}).strict().superRefine((step, context) => {
  if (step.kind === "manual-figma-execution" && !step.humanActionRequired) {
    context.addIssue({ code: "custom", path: ["humanActionRequired"], message: "Manual Figma execution must remain an explicit human action" })
  }
  if (step.kind === "export-return" && step.expectedOutputs.length === 0) {
    context.addIssue({ code: "custom", path: ["expectedOutputs"], message: "Export-return instructions require explicit expected output classes" })
  }
})

export const manualFigmaExecutionCheckSchema = z.object({
  key: identifierSchema,
  scopeKey: identifierSchema,
  kind: z.enum([
    "accessibility-reviewed",
    "handoff-manifest-digest-verified",
    "handoff-package-digest-verified",
    "handoff-path-contained",
    "instructions-reviewed",
    "privacy-reviewed",
    "responsive-targets-reviewed",
    "return-contract-reviewed",
  ]),
  evidenceState: z.enum(["not-assessed", "evidence-recorded", "human-reviewed"]),
  observation: z.enum(["not-assessed", "evidence-supports", "evidence-contradicts"]),
  evidenceDigests: canonicalDigestListSchema,
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
  procedure: longTextSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((check, context) => {
  const reviewed = check.evidenceState === "human-reviewed"
  if (reviewed !== (check.reviewedBy !== undefined && check.reviewedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Human-reviewed manual-path checks require an attributable reviewer and time; other states forbid them" })
  }
  if ((check.evidenceState === "not-assessed") !== (check.observation === "not-assessed")) {
    context.addIssue({ code: "custom", path: ["observation"], message: "Only assessed manual-path checks may record a supporting or contradicting observation" })
  }
  if ((check.evidenceState === "not-assessed") !== (check.evidenceDigests.length === 0)) {
    context.addIssue({ code: "custom", path: ["evidenceDigests"], message: "Assessed manual-path checks require evidence digests; not-assessed checks forbid them" })
  }
})

export const manualFigmaRequirementCoverageSchema = z.object({
  requirementKey: requirementKeySchema,
  state: z.enum(["represented", "unresolved"]),
  scopeKeys: canonicalIdentifierListSchema,
  rationale: longTextSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((coverage, context) => {
  if ((coverage.state === "represented") !== (coverage.scopeKeys.length > 0)) {
    context.addIssue({ code: "custom", path: ["scopeKeys"], message: "Represented Requirements require manual execution scopes; unresolved Requirements forbid invented scope coverage" })
  }
})

const manualFigmaExecutionPathInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  designApplicability: exactDesignApplicabilityBindingSchema,
  screenStateInventory: exactScreenStateInventoryBindingSchema,
  designRequirements: exactDesignRequirementsBindingSchema,
  designSystemTokenContract: exactDesignSystemTokenContractBindingSchema,
  accessibilityDesignRules: exactAccessibilityDesignRulesBindingSchema,
  responsiveMultiPlatformTargets: exactResponsiveMultiPlatformTargetsBindingSchema,
  scopes: z.array(manualFigmaExecutionScopeSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Manual execution scope keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Manual execution scopes must use canonical key ordering")
    .refine((entries) => unique(entries.map((entry) => entry.designScopeKey)), "Design applicability scopes may appear only once"),
  instructions: z.array(manualFigmaInstructionStepSchema).min(1).max(16_384)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Manual instruction keys must be unique")
    .refine((entries) => unique(entries.map((entry) => String(entry.sequence))), "Manual instruction sequences must be unique")
    .refine((entries) => entries.every((entry, index) => entry.sequence === index + 1), "Manual instructions must use contiguous execution order"),
  checks: z.array(manualFigmaExecutionCheckSchema).max(16_384)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Manual execution checks must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Manual execution checks must use canonical key ordering"),
  requirementCoverage: z.array(manualFigmaRequirementCoverageSchema).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.requirementKey)), "Requirement coverage entries must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.requirementKey)), "Requirement coverage must use canonical Requirement ordering"),
  guideCatalogState: z.enum(["candidate-complete", "not-assessed"]),
  handoffCatalogState: z.enum(["candidate-complete", "not-assessed"]),
  returnContractState: z.enum(["candidate-complete", "not-assessed"]),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: requiredCanonicalTextListSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  figmaConnectionState: z.literal("disconnected-only"),
  figmaExecutionState: z.literal("not-executed"),
  figmaWriteAuthorityState: z.literal("not-granted"),
  designApprovalState: z.literal("not-established"),
  designBaselineState: z.literal("not-established"),
  readinessState: z.literal("not-established"),
  implementationAuthorityState: z.literal("not-granted"),
}).strict().superRefine((path, context) => {
  const scopeKeys = new Set(path.scopes.map((entry) => entry.key))
  const instructionKeys = new Set(path.instructions.map((entry) => entry.key))
  for (const scope of path.scopes) {
    if (scope.instructionStepKeys.some((key) => !instructionKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["scopes"], message: "Manual scopes must reference exact candidate instruction steps" })
    }
  }
  for (const step of path.instructions) {
    if (step.scopeKeys.some((key) => !scopeKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["instructions"], message: "Manual instructions must reference exact candidate scopes" })
    }
  }
  for (const check of path.checks) {
    if (!scopeKeys.has(check.scopeKey)) {
      context.addIssue({ code: "custom", path: ["checks"], message: "Manual execution checks must reference exact candidate scopes" })
    }
  }
  for (const coverage of path.requirementCoverage) {
    if (coverage.scopeKeys.some((key) => !scopeKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must reference exact candidate scopes" })
    }
  }
  const exactHandoffKinds = [...manualFigmaHandoffArtifactKinds]
  const exactReturnKinds = [...manualFigmaReturnArtifactKinds]
  if (path.handoffCatalogState === "candidate-complete" && path.scopes.some((scope) =>
    JSON.stringify(scope.includedArtifacts) !== JSON.stringify(exactHandoffKinds))) {
    context.addIssue({ code: "custom", path: ["scopes"], message: "Candidate-complete manual handoffs require the complete canonical artifact catalog" })
  }
  if (path.returnContractState === "candidate-complete" && path.scopes.some((scope) =>
    JSON.stringify(scope.requiredReturns) !== JSON.stringify(exactReturnKinds))) {
    context.addIssue({ code: "custom", path: ["scopes"], message: "Candidate-complete manual returns require the complete canonical return catalog" })
  }
  if (path.guideCatalogState === "candidate-complete" &&
      JSON.stringify(path.instructions.map((entry) => entry.kind)) !== JSON.stringify(manualFigmaInstructionKinds)) {
    context.addIssue({ code: "custom", path: ["instructions"], message: "Candidate-complete manual guidance requires the complete canonical ordered instruction catalog" })
  }
})

export const manualFigmaExecutionPathInputSchema = rejectSecrets(manualFigmaExecutionPathInputBaseSchema)

export const manualFigmaExecutionPathSchema = manualFigmaExecutionPathInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("manual-figma-execution-path-candidate"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  membershipDigest: digestSchema,
  predecessorDigest: digestSchema.optional(),
  state: z.literal("candidate"),
  createdBy: humanActorSchema,
  updatedBy: humanActorSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "manual-figma-execution-path-is-candidate-guidance-and-does-not-connect-to-figma-execute-design-actions-grant-write-authority-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
  ),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Manual Figma Execution Path revisions after revision one require an exact predecessor digest" })
  }
})

export const exactManualFigmaExecutionPathReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const manualFigmaExecutionPathStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("manual-figma-execution-path-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactManualFigmaExecutionPathReferenceSchema.optional(),
  scopeCount: z.number().int().nonnegative().max(4_096),
  instructionCount: z.number().int().nonnegative().max(16_384),
  checkCount: z.number().int().nonnegative().max(16_384),
  notAssessedCheckCount: z.number().int().nonnegative().max(16_384),
  evidenceRecordedCheckCount: z.number().int().nonnegative().max(16_384),
  humanReviewedCheckCount: z.number().int().nonnegative().max(16_384),
  contradictedCheckCount: z.number().int().nonnegative().max(16_384),
  representedRequirementCount: z.number().int().nonnegative().max(4_096),
  unresolvedRequirementCount: z.number().int().nonnegative().max(4_096),
  unresolvedOwnershipCount: z.number().int().nonnegative().max(4_096),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  guideCatalogState: z.enum(["candidate-complete", "not-assessed"]),
  handoffCatalogState: z.enum(["candidate-complete", "not-assessed"]),
  returnContractState: z.enum(["candidate-complete", "not-assessed"]),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "manual-figma-execution-path-status-is-observational-and-does-not-connect-to-figma-prove-execution-or-return-completeness-grant-write-authority-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
  ),
}).strict().superRefine((status, context) => {
  const gaps = status.notAssessedCheckCount + status.evidenceRecordedCheckCount + status.contradictedCheckCount +
    status.unresolvedRequirementCount + status.unresolvedOwnershipCount + status.staleBindingCount +
    status.staleSourceReferenceCount + status.unresolvedQuestionCount
  if (status.state === "complete-for-review" &&
      (gaps > 0 || status.guideCatalogState !== "candidate-complete" ||
       status.handoffCatalogState !== "candidate-complete" || status.returnContractState !== "candidate-complete" ||
       status.reviewState !== "ready-for-human-review" || status.reasons.length > 0 || !status.candidate)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires exact review-ready Manual Figma Execution guidance with no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Manual Figma Execution Path status must expose reasons" })
  }
})

export const manualFigmaExecutionPathProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("manual-figma-execution-path-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: manualFigmaExecutionPathStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, membershipDigest: digestSchema,
    state: z.literal("candidate"), scopeCount: z.number().int().nonnegative(),
    instructionCount: z.number().int().nonnegative(), checkCount: z.number().int().nonnegative(),
    representedRequirementCount: z.number().int().nonnegative(),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-record-identities-counts-statuses-and-digests-only-not-handoff-content-instructions-figma-identifiers-returned-design-source-or-personal-content-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "manual-figma-execution-path-projection-is-read-only-and-does-not-connect-to-figma-prove-execution-or-return-completeness-grant-write-authority-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Manual Figma Execution Path projection must bind exact Product and Initiative revisions" })
  }
})

export type ManualFigmaExecutionPathInput = z.infer<typeof manualFigmaExecutionPathInputSchema>
export type ManualFigmaExecutionPath = z.infer<typeof manualFigmaExecutionPathSchema>
export type ExactManualFigmaExecutionPathReference = z.infer<typeof exactManualFigmaExecutionPathReferenceSchema>
export type ManualFigmaExecutionPathStatus = z.infer<typeof manualFigmaExecutionPathStatusSchema>
export type ManualFigmaExecutionPathProjection = z.infer<typeof manualFigmaExecutionPathProjectionSchema>
