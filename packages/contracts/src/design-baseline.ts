import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { humanDesignApprovalScopeSchema, humanDesignApprovalSubjectSchema } from "./human-design-approval.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactSourceReferenceSchema } from "./source-governance.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const semanticVersionSchema = z.string().regex(/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()
const unique = (values: readonly string[]) => new Set(values).size === values.length
const canonical = (values: readonly string[]) =>
  values.every((value, index) => value === [...values].sort((left, right) => left.localeCompare(right))[index])
const canonicalDigestsSchema = z.array(digestSchema).max(33_792)
  .refine(unique, "Digests must be unique").refine(canonical, "Digests must use canonical ordering")
const canonicalTextSchema = z.array(shortTextSchema).max(512)
  .refine(unique, "Values must be unique").refine(canonical, "Values must use canonical ordering")
const exactSourceListSchema = z.array(exactSourceReferenceSchema).min(1).max(256)
  .refine((entries) => unique(entries.map((entry) =>
    `${entry.sourceId}:${entry.sourceRevision}:${entry.recordDigest}:${entry.contentDigest}`)), "Source references must be unique")

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Design Baseline candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const exactDesignBaselineApprovalBindingSchema = z.object({
  kind: z.literal("human-design-approval-candidate"),
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
  membershipDigest: digestSchema,
  decisionReceiptDigest: digestSchema,
  subjectDigest: digestSchema,
  scopeDigest: digestSchema,
  candidateResult: z.literal("approved-candidate"),
  reviewState: z.literal("recorded-human-decision"),
  assessmentDigest: digestSchema,
  assessmentState: z.enum(["attention-required", "complete-for-recorded-decision"]),
}).strict()

export const exactDesignBaselineReferenceSchema = z.object({
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
  membershipDigest: digestSchema,
  baselineLineageId: z.string().uuid(),
  semanticVersion: semanticVersionSchema,
}).strict()

export const designBaselineDesignationKinds = [
  "propose-baseline-candidate",
  "restore-baseline-candidate",
  "supersede-baseline-candidate",
  "withdraw-baseline-candidate",
] as const

export const designBaselineDesignationSchema = z.object({
  key: identifierSchema,
  kind: z.enum(designBaselineDesignationKinds),
  designationDigest: digestSchema,
  rationaleDigest: digestSchema,
  evidenceDigests: canonicalDigestsSchema.refine((values) => values.length > 0, "A baseline designation candidate requires evidence"),
  sources: exactSourceListSchema,
  proposedBy: humanActorSchema,
  proposedAt: z.string().datetime(),
  validUntil: z.string().datetime(),
  authorityEvidenceState: z.enum(["declared-not-verified", "not-established"]),
  independenceState: z.enum(["distinct-actor-declared", "not-enforced-founder-mode"]),
  effectState: z.literal("not-applied"),
}).strict()

const candidateResultByDesignation = {
  "propose-baseline-candidate": "baseline-proposal-candidate",
  "restore-baseline-candidate": "restoration-candidate",
  "supersede-baseline-candidate": "supersession-candidate",
  "withdraw-baseline-candidate": "withdrawal-candidate",
} as const

const designBaselineInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  objectiveDigest: digestSchema,
  humanDesignApproval: exactDesignBaselineApprovalBindingSchema,
  subject: humanDesignApprovalSubjectSchema,
  scope: humanDesignApprovalScopeSchema,
  baselineLineageId: z.string().uuid(),
  candidateSetId: z.string().uuid(),
  candidateSetRevision: z.number().int().positive(),
  semanticVersion: semanticVersionSchema,
  versionPolicyDigest: digestSchema,
  designation: designBaselineDesignationSchema.optional(),
  supersedes: exactDesignBaselineReferenceSchema.optional(),
  designationDefinitionDigest: digestSchema,
  designationReceiptDigest: digestSchema,
  candidateResult: z.enum([
    "baseline-proposal-candidate", "blocked", "incomplete", "restoration-candidate",
    "supersession-candidate", "withdrawal-candidate",
  ]),
  unresolvedQuestions: canonicalTextSchema,
  limitations: canonicalTextSchema.refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  approvalDeterminationState: z.literal("not-established"),
  baselineDesignationState: z.literal("not-established"),
  approverAuthorityState: z.literal("not-established"),
  separationOfDutiesEnforcementState: z.literal("not-established"),
  readinessState: z.literal("not-established"),
  phaseEntryAuthorityState: z.literal("not-granted"),
  figmaConnectionAuthorityState: z.literal("not-granted"),
  credentialAuthorityState: z.literal("not-granted"),
  permissionGrantState: z.literal("not-granted"),
  importExecutionState: z.literal("not-performed"),
  writeExecutionState: z.literal("not-performed"),
  implementationAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  if (candidate.humanDesignApproval.subjectDigest !== candidate.subject.digest ||
      candidate.humanDesignApproval.scopeDigest !== candidate.scope.scopeDigest ||
      candidate.scope.subjectDigest !== candidate.subject.digest ||
      candidate.scope.includedItemDigests.length + candidate.scope.excludedItemDigests.length !== candidate.subject.itemCount) {
    context.addIssue({ code: "custom", path: ["subject"], message: "Design Baseline must preserve the exact approved-candidate subject and classify every finalized-snapshot item" })
  }
  if (!candidate.designation) {
    if (!["blocked", "incomplete"].includes(candidate.candidateResult) || candidate.reviewState === "ready-for-human-review") {
      context.addIssue({ code: "custom", path: ["candidateResult"], message: "Candidates without a designation proposal must remain blocked or incomplete" })
    }
  } else if (candidate.candidateResult !== candidateResultByDesignation[candidate.designation.kind]) {
    context.addIssue({ code: "custom", path: ["candidateResult"], message: "Candidate result must match the exact designation-candidate kind" })
  }
  const revisionAction = candidate.designation?.kind !== undefined && candidate.designation.kind !== "propose-baseline-candidate"
  if (revisionAction !== (candidate.supersedes !== undefined)) {
    context.addIssue({ code: "custom", path: ["supersedes"], message: "Supersession, withdrawal, and restoration candidates require one exact predecessor baseline reference" })
  }
})

export const designBaselineInputSchema = rejectSecrets(designBaselineInputBaseSchema)

export const designBaselineSchema = designBaselineInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("design-baseline-candidate"),
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
  authorityBoundary: z.literal("design-baseline-is-a-versioned-designation-candidate-and-does-not-convert-an-approval-candidate-into-approval-verify-approver-authority-enforce-separation-of-duties-establish-a-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority"),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Design Baseline revisions after revision one require an exact predecessor digest" })
  }
})

export const exactDesignBaselineCandidateReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const designBaselineStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("design-baseline-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactDesignBaselineCandidateReferenceSchema.optional(),
  candidateSetCount: z.number().int().nonnegative().max(1),
  designationCandidateCount: z.number().int().nonnegative().max(1),
  supersessionCandidateCount: z.number().int().nonnegative().max(1),
  withdrawalCandidateCount: z.number().int().nonnegative().max(1),
  restorationCandidateCount: z.number().int().nonnegative().max(1),
  expiredDesignationCount: z.number().int().nonnegative().max(1),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  candidateResult: z.enum([
    "baseline-proposal-candidate", "blocked", "incomplete", "not-assessed", "restoration-candidate",
    "supersession-candidate", "withdrawal-candidate",
  ]),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  approvalDeterminationState: z.literal("not-established"),
  baselineDesignationState: z.literal("not-established"),
  state: z.enum(["attention-required", "complete-for-baseline-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal("design-baseline-status-is-observational-and-does-not-convert-an-approval-candidate-into-approval-verify-approver-authority-enforce-separation-of-duties-establish-a-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority"),
}).strict().superRefine((status, context) => {
  const specialized = status.supersessionCandidateCount + status.withdrawalCandidateCount + status.restorationCandidateCount
  if (specialized > status.designationCandidateCount) {
    context.addIssue({ code: "custom", path: ["designationCandidateCount"], message: "Specialized designation counts cannot exceed the designation candidate count" })
  }
  const gaps = status.expiredDesignationCount + status.staleBindingCount +
    status.staleSourceReferenceCount + status.unresolvedQuestionCount
  if (status.state === "complete-for-baseline-review" && (!status.candidate || status.reasons.length > 0 ||
      status.candidateSetCount !== 1 || status.designationCandidateCount !== 1 || gaps > 0 ||
      status.reviewState !== "ready-for-human-review")) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete baseline review requires one exact current candidate set, one active designation candidate, and no declared gap" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Design Baseline status must expose reasons" })
  }
})

export const designBaselineProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("design-baseline-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]) }).strict(),
  status: designBaselineStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    membershipDigest: digestSchema, state: z.literal("candidate"),
    humanDesignApproval: exactDesignBaselineApprovalBindingSchema,
    subject: humanDesignApprovalSubjectSchema,
    scopeDigest: digestSchema,
    baselineLineageId: z.string().uuid(), candidateSetId: z.string().uuid(),
    candidateSetRevision: z.number().int().positive(), semanticVersion: semanticVersionSchema,
    versionPolicyDigest: digestSchema, designationDefinitionDigest: digestSchema,
    designationReceiptDigest: digestSchema, designationKind: z.enum(designBaselineDesignationKinds).optional(),
    designationDigest: digestSchema.optional(), supersedes: exactDesignBaselineReferenceSchema.optional(),
    candidateResult: z.enum([
      "baseline-proposal-candidate", "blocked", "incomplete", "restoration-candidate",
      "supersession-candidate", "withdrawal-candidate",
    ]),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal("projection-contains-record-identities-version-axes-counts-results-and-digests-only-not-design-content-rationale-evidence-source-content-human-attribution-personal-content-secrets-credentials-or-permissions"),
  authorityBoundary: z.literal("design-baseline-projection-is-read-only-and-does-not-convert-an-approval-candidate-into-approval-verify-approver-authority-enforce-separation-of-duties-establish-a-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority"),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Design Baseline projection must bind exact Product and Initiative revisions" })
  }
})

export type ExactDesignBaselineApprovalBinding = z.infer<typeof exactDesignBaselineApprovalBindingSchema>
export type DesignBaselineInput = z.infer<typeof designBaselineInputSchema>
export type DesignBaseline = z.infer<typeof designBaselineSchema>
export type DesignBaselineStatus = z.infer<typeof designBaselineStatusSchema>
export type DesignBaselineProjection = z.infer<typeof designBaselineProjectionSchema>
