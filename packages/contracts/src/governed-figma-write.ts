import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { exactOutboundDesignBriefPackageReferenceSchema } from "./outbound-design-brief-package.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactSourceReferenceSchema } from "./source-governance.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
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
    message: "Governed Figma Write candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalIdentifierListSchema = canonicalStringArray(identifierSchema, 4_096)
const canonicalDigestListSchema = canonicalStringArray(digestSchema, 1_024)
const canonicalTextListSchema = canonicalStringArray(shortTextSchema)
const requiredCanonicalTextListSchema = canonicalTextListSchema.refine(
  (values) => values.length > 0,
  "At least one limitation is required",
)
const exactSourceListSchema = z.array(exactSourceReferenceSchema).min(1).max(256)
  .refine((entries) => unique(entries.map((entry) =>
    `${entry.sourceId}:${entry.sourceRevision}:${entry.recordDigest}:${entry.contentDigest}`)),
  "Source references must be unique")
  .refine((entries) => canonical(entries.map((entry) =>
    `${entry.sourceId}:${String(entry.sourceRevision).padStart(12, "0")}`)),
  "Source references must use canonical identity ordering")

export const exactGovernedWritePackageBindingSchema = exactOutboundDesignBriefPackageReferenceSchema.extend({
  membershipDigest: digestSchema,
  manifestDigest: digestSchema,
  payloadDigest: digestSchema,
}).strict()

export const governedFigmaWriteTargetSchema = z.object({
  recipientKey: identifierSchema,
  sourceTargetKey: identifierSchema,
  designScopeKey: identifierSchema,
  fileKey: identifierSchema,
  targetKind: z.literal("figma-file-root"),
  externalFileIdentityDigest: digestSchema,
  expectedExternalVersionDigest: digestSchema,
  plannedWriteToolKey: identifierSchema,
  selectedEntryKeys: canonicalIdentifierListSchema.min(1),
  intendedEffect: z.literal("figma-write"),
  destinationState: z.literal("not-connected"),
  targetValidityState: z.literal("not-established"),
  sources: exactSourceListSchema,
}).strict()

export const governedFigmaWritePreviewSchema = z.object({
  packageManifestDigest: digestSchema,
  packagePayloadDigest: digestSchema,
  requestDigest: digestSchema,
  effectDigest: digestSchema,
  previewDigest: digestSchema.optional(),
  state: z.enum(["candidate-generated", "human-reviewed", "not-generated"]),
  evidenceDigests: canonicalDigestListSchema,
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
}).strict().superRefine((preview, context) => {
  if ((preview.state === "not-generated") !== (preview.previewDigest === undefined && preview.evidenceDigests.length === 0)) {
    context.addIssue({ code: "custom", message: "Generated governed-write previews require exact preview and evidence digests; not-generated previews forbid them" })
  }
  const reviewed = preview.state === "human-reviewed"
  if (reviewed !== (preview.reviewedBy !== undefined && preview.reviewedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Human-reviewed governed-write previews require an attributable reviewer and time; other states forbid them" })
  }
})

export const governedFigmaWriteApprovalSchema = z.object({
  state: z.enum(["not-requested", "pending", "granted", "declined", "expired", "revoked"]),
  scopeDigest: digestSchema.optional(),
  decisionDigest: digestSchema.optional(),
  evidenceDigests: canonicalDigestListSchema,
  decidedBy: humanActorSchema.optional(),
  decidedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
}).strict().superRefine((approval, context) => {
  const decided = ["granted", "declined", "expired", "revoked"].includes(approval.state)
  if (decided !== (approval.scopeDigest !== undefined && approval.decisionDigest !== undefined &&
      approval.evidenceDigests.length > 0 && approval.decidedBy !== undefined && approval.decidedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Decided governed-write approval states require exact scope, decision, evidence, actor, and time; undecided states forbid them" })
  }
  if (!decided && approval.expiresAt !== undefined) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "Undecided governed-write approval cannot declare an expiry" })
  }
  if (approval.expiresAt && approval.decidedAt && Date.parse(approval.expiresAt) <= Date.parse(approval.decidedAt)) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "Governed-write approval expiry must be after the decision time" })
  }
})

export const governedFigmaWritePermissionEvidenceSchema = z.object({
  state: z.enum(["not-assessed", "missing", "verified"]),
  permissionKeys: canonicalIdentifierListSchema,
  evidenceDigests: canonicalDigestListSchema,
  verificationDigest: digestSchema.optional(),
  verifiedBy: humanActorSchema.optional(),
  verifiedAt: z.string().datetime().optional(),
}).strict().superRefine((permission, context) => {
  const verified = permission.state === "verified"
  if (verified !== (permission.permissionKeys.length > 0 && permission.evidenceDigests.length > 0 &&
      permission.verificationDigest !== undefined && permission.verifiedBy !== undefined && permission.verifiedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Verified governed-write permission evidence requires exact keys, evidence, digest, actor, and time; other states forbid them" })
  }
})

export const governedFigmaWriteIdempotencySchema = z.object({
  keyDigest: digestSchema,
  scopeDigest: digestSchema,
  requestDigest: digestSchema,
  state: z.enum(["defined", "not-assessed"]),
  priorResultDigest: digestSchema.optional(),
  replayProtectionState: z.enum(["defined", "not-assessed"]),
}).strict().superRefine((idempotency, context) => {
  if (idempotency.state === "not-assessed" && idempotency.priorResultDigest !== undefined) {
    context.addIssue({ code: "custom", path: ["priorResultDigest"], message: "Unassessed idempotency cannot bind a prior result" })
  }
})

export const governedFigmaWriteRecoveryPlanSchema = z.object({
  state: z.enum(["defined", "not-assessed"]),
  strategyDigest: digestSchema.optional(),
  rollbackScopeDigest: digestSchema.optional(),
  partialFailureRuleDigest: digestSchema.optional(),
  unknownResultRuleDigest: digestSchema.optional(),
  evidenceDigests: canonicalDigestListSchema,
}).strict().superRefine((recovery, context) => {
  const defined = recovery.state === "defined"
  if (defined !== (recovery.strategyDigest !== undefined && recovery.rollbackScopeDigest !== undefined &&
      recovery.partialFailureRuleDigest !== undefined && recovery.unknownResultRuleDigest !== undefined &&
      recovery.evidenceDigests.length > 0)) {
    context.addIssue({ code: "custom", message: "Defined governed-write recovery requires strategy, rollback, partial-failure, unknown-result, and evidence digests; unassessed recovery forbids them" })
  }
})

export const governedFigmaWriteDisclosureSchema = z.object({
  key: identifierSchema,
  kind: z.enum(["approval-gap", "permission-gap", "target-version-conflict", "recovery-gap"]),
  materiality: z.enum(["material", "non-material"]),
  state: z.enum(["resolved", "unresolved"]),
  subjectDigest: digestSchema,
  rationaleDigest: digestSchema,
  evidenceDigests: canonicalDigestListSchema,
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
  sources: exactSourceListSchema,
}).strict().superRefine((disclosure, context) => {
  const resolved = disclosure.state === "resolved"
  if (resolved !== (disclosure.evidenceDigests.length > 0 && disclosure.reviewedBy !== undefined && disclosure.reviewedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Resolved governed-write disclosures require exact evidence and attributable human review; unresolved disclosures forbid them" })
  }
})

const governedFigmaWriteInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  objectiveDigest: digestSchema,
  outboundPackage: exactGovernedWritePackageBindingSchema,
  target: governedFigmaWriteTargetSchema,
  requestFormat: z.literal("gaep-governed-figma-write-request-v1"),
  requestDigest: digestSchema,
  effectDigest: digestSchema,
  preview: governedFigmaWritePreviewSchema,
  approval: governedFigmaWriteApprovalSchema,
  permissionEvidence: governedFigmaWritePermissionEvidenceSchema,
  idempotency: governedFigmaWriteIdempotencySchema,
  recoveryPlan: governedFigmaWriteRecoveryPlanSchema,
  disclosures: z.array(governedFigmaWriteDisclosureSchema).max(1_024)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Governed-write disclosure keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Governed-write disclosures must use canonical key ordering"),
  sources: exactSourceListSchema,
  unresolvedQuestions: canonicalTextListSchema,
  limitations: requiredCanonicalTextListSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  writePlanState: z.enum(["draft", "held", "complete-for-authorization-review"]),
  packageMaterializationState: z.literal("manifest-only"),
  contextTransferState: z.literal("not-performed"),
  figmaConnectionAuthorityState: z.literal("not-granted"),
  credentialAuthorityState: z.literal("not-granted"),
  permissionGrantState: z.literal("not-granted"),
  figmaWriteAuthorityState: z.literal("not-granted"),
  writeExecutionState: z.literal("not-performed"),
  writeResultState: z.literal("not-recorded"),
  externalVersionValidationState: z.literal("not-established"),
  targetValidityState: z.literal("not-established"),
  designValidityState: z.literal("not-established"),
  designApprovalState: z.literal("not-established"),
  designBaselineState: z.literal("not-established"),
  readinessState: z.literal("not-established"),
  implementationAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  if (candidate.requestDigest !== candidate.preview.requestDigest || candidate.effectDigest !== candidate.preview.effectDigest ||
      candidate.outboundPackage.manifestDigest !== candidate.preview.packageManifestDigest ||
      candidate.outboundPackage.payloadDigest !== candidate.preview.packagePayloadDigest) {
    context.addIssue({ code: "custom", path: ["preview"], message: "Governed-write preview must bind the exact package, request, and effect digests" })
  }
  if (candidate.idempotency.requestDigest !== candidate.requestDigest) {
    context.addIssue({ code: "custom", path: ["idempotency", "requestDigest"], message: "Governed-write idempotency must bind the exact request digest" })
  }
  const unresolvedMaterialDisclosure = candidate.disclosures.some((entry) =>
    entry.materiality === "material" && entry.state === "unresolved")
  if (candidate.writePlanState === "complete-for-authorization-review" &&
      (candidate.preview.state !== "human-reviewed" || candidate.idempotency.state !== "defined" ||
       candidate.idempotency.replayProtectionState !== "defined" || candidate.recoveryPlan.state !== "defined" ||
       unresolvedMaterialDisclosure || candidate.unresolvedQuestions.length > 0)) {
    context.addIssue({ code: "custom", path: ["writePlanState"], message: "Complete governed-write plans require reviewed preview, defined idempotency/replay/recovery, no material disclosure, and no unresolved question" })
  }
  if (candidate.reviewState === "ready-for-human-review" && candidate.writePlanState !== "complete-for-authorization-review") {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready governed writes require a complete plan for authorization review" })
  }
})

export const governedFigmaWriteInputSchema = rejectSecrets(governedFigmaWriteInputBaseSchema)

export const governedFigmaWriteSchema = governedFigmaWriteInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("governed-figma-write-candidate"),
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
    "governed-figma-write-is-an-authorization-review-candidate-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
  ),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Governed Figma Write revisions after revision one require an exact predecessor digest" })
  }
})

export const exactGovernedFigmaWriteReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const governedFigmaWriteStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("governed-figma-write-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactGovernedFigmaWriteReferenceSchema.optional(),
  selectedEntryCount: z.number().int().nonnegative().max(4_096),
  unresolvedDisclosureCount: z.number().int().nonnegative().max(1_024),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  previewState: z.enum(["candidate-generated", "human-reviewed", "not-generated"]),
  approvalState: z.enum(["not-requested", "pending", "granted", "declined", "expired", "revoked"]),
  permissionEvidenceState: z.enum(["not-assessed", "missing", "verified"]),
  idempotencyState: z.enum(["defined", "not-assessed"]),
  replayProtectionState: z.enum(["defined", "not-assessed"]),
  recoveryPlanState: z.enum(["defined", "not-assessed"]),
  writePlanState: z.enum(["draft", "held", "complete-for-authorization-review"]),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  writeExecutionState: z.literal("not-performed"),
  writeResultState: z.literal("not-recorded"),
  state: z.enum(["attention-required", "complete-for-authorization-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "governed-figma-write-status-is-observational-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
  ),
}).strict().superRefine((status, context) => {
  const gaps = status.unresolvedDisclosureCount + status.staleBindingCount + status.staleSourceReferenceCount + status.unresolvedQuestionCount
  if (status.state === "complete-for-authorization-review" &&
      (gaps > 0 || status.selectedEntryCount === 0 || status.previewState !== "human-reviewed" ||
       status.permissionEvidenceState !== "verified" || status.idempotencyState !== "defined" ||
       status.replayProtectionState !== "defined" || status.recoveryPlanState !== "defined" ||
       status.writePlanState !== "complete-for-authorization-review" || status.reviewState !== "ready-for-human-review" ||
       status.reasons.length > 0 || !status.candidate)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-authorization-review requires exact reviewed governed-write evidence with no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Governed Figma Write status must expose reasons" })
  }
})

export const governedFigmaWriteProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("governed-figma-write-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: governedFigmaWriteStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, membershipDigest: digestSchema,
    state: z.literal("candidate"), requestFormat: z.literal("gaep-governed-figma-write-request-v1"),
    requestDigest: digestSchema, effectDigest: digestSchema, outboundPackage: exactGovernedWritePackageBindingSchema,
    externalFileIdentityDigest: digestSchema, expectedExternalVersionDigest: digestSchema,
    selectedEntryCount: z.number().int().nonnegative(), previewState: z.enum(["candidate-generated", "human-reviewed", "not-generated"]),
    previewDigest: digestSchema.optional(), approvalState: z.enum(["not-requested", "pending", "granted", "declined", "expired", "revoked"]),
    permissionEvidenceState: z.enum(["not-assessed", "missing", "verified"]),
    idempotencyState: z.enum(["defined", "not-assessed"]), recoveryPlanState: z.enum(["defined", "not-assessed"]),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), writeExecutionState: z.literal("not-performed"),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-record-identities-counts-statuses-and-digests-only-not-brief-requirement-constraint-context-item-figma-target-tool-source-approval-actor-permission-evidence-recovery-or-personal-content-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "governed-figma-write-projection-is-read-only-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Governed Figma Write projection must bind exact Product and Initiative revisions" })
  }
})

export type GovernedFigmaWriteInput = z.infer<typeof governedFigmaWriteInputSchema>
export type GovernedFigmaWrite = z.infer<typeof governedFigmaWriteSchema>
export type ExactGovernedFigmaWriteReference = z.infer<typeof exactGovernedFigmaWriteReferenceSchema>
export type GovernedFigmaWriteStatus = z.infer<typeof governedFigmaWriteStatusSchema>
export type GovernedFigmaWriteProjection = z.infer<typeof governedFigmaWriteProjectionSchema>
