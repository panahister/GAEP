import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactSourceReferenceSchema } from "./source-governance.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
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
    message: "Human Design Approval candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const humanDesignApprovalPrerequisiteKinds = {
  "design-conflict-resolution": "design-conflict-resolution-candidate",
  "design-delta": "design-delta-candidate",
  "design-to-requirement-binding": "design-to-requirement-binding-candidate",
  "designer-ready-gate": "designer-ready-gate-candidate",
  "finalized-figma-snapshot-import": "finalized-figma-snapshot-import-candidate",
} as const

export const humanDesignApprovalPrerequisiteKeys = Object.keys(humanDesignApprovalPrerequisiteKinds).sort() as [
  keyof typeof humanDesignApprovalPrerequisiteKinds,
  ...(keyof typeof humanDesignApprovalPrerequisiteKinds)[],
]
export const humanDesignApprovalPrerequisiteKeySchema = z.enum(humanDesignApprovalPrerequisiteKeys)

export const exactHumanDesignApprovalPrerequisiteSchema = z.object({
  key: humanDesignApprovalPrerequisiteKeySchema,
  kind: z.enum(Object.values(humanDesignApprovalPrerequisiteKinds) as [
    (typeof humanDesignApprovalPrerequisiteKinds)[keyof typeof humanDesignApprovalPrerequisiteKinds],
    ...((typeof humanDesignApprovalPrerequisiteKinds)[keyof typeof humanDesignApprovalPrerequisiteKinds])[],
  ]),
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
  membershipDigest: digestSchema,
  assessmentDigest: digestSchema,
  assessmentState: z.enum(["attention-required", "complete-for-human-decision", "complete-for-review"]),
}).strict().superRefine((value, context) => {
  if (humanDesignApprovalPrerequisiteKinds[value.key] !== value.kind) {
    context.addIssue({ code: "custom", path: ["kind"], message: "Human Design Approval prerequisite kind must match its canonical key" })
  }
})

export const humanDesignApprovalSubjectSchema = z.object({
  kind: z.literal("finalized-figma-snapshot-import-candidate"),
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
  membershipDigest: digestSchema,
  externalFileIdentityDigest: digestSchema,
  returnedExternalVersionDigest: digestSchema,
  itemCatalogDigest: digestSchema,
  itemCount: z.number().int().positive().max(33_792),
}).strict()

export const humanDesignApprovalScopeSchema = z.object({
  kind: z.literal("exact-finalized-design-snapshot"),
  subjectDigest: digestSchema,
  scopeDigest: digestSchema,
  includedItemDigests: canonicalDigestsSchema.refine((values) => values.length > 0, "Approval scope requires at least one exact item digest"),
  excludedItemDigests: canonicalDigestsSchema,
}).strict().superRefine((scope, context) => {
  const included = new Set(scope.includedItemDigests)
  if (scope.excludedItemDigests.some((digest) => included.has(digest))) {
    context.addIssue({ code: "custom", path: ["excludedItemDigests"], message: "Included and excluded approval-scope items must be disjoint" })
  }
})

export const humanDesignApprovalDecisionKinds = [
  "abstain-candidate",
  "approve-candidate",
  "reject-candidate",
  "request-change-candidate",
] as const

export const humanDesignApprovalDecisionSchema = z.object({
  key: identifierSchema,
  kind: z.enum(humanDesignApprovalDecisionKinds),
  decisionDigest: digestSchema,
  rationaleDigest: digestSchema,
  conditionDigests: canonicalDigestsSchema,
  evidenceDigests: canonicalDigestsSchema.refine((values) => values.length > 0, "A recorded human design decision requires evidence"),
  sources: exactSourceListSchema,
  decidedBy: humanActorSchema,
  decidedAt: z.string().datetime(),
  validUntil: z.string().datetime(),
  authorityEvidenceState: z.enum(["declared-not-verified", "not-established"]),
  independenceState: z.enum(["distinct-actor-declared", "not-enforced-founder-mode"]),
  lifecycleState: z.enum(["active-candidate", "revoked-candidate"]),
  revokedAt: z.string().datetime().optional(),
  revocationDigest: digestSchema.optional(),
  effectState: z.literal("not-applied"),
}).strict().superRefine((decision, context) => {
  const revoked = decision.lifecycleState === "revoked-candidate"
  if (revoked !== (decision.revokedAt !== undefined && decision.revocationDigest !== undefined)) {
    context.addIssue({ code: "custom", message: "Revoked design-decision candidates require exact revocation time and digest; active candidates forbid them" })
  }
})

const resultByDecisionKind = {
  "abstain-candidate": "abstained-candidate",
  "approve-candidate": "approved-candidate",
  "reject-candidate": "rejected-candidate",
  "request-change-candidate": "changes-requested-candidate",
} as const

const humanDesignApprovalInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  objectiveDigest: digestSchema,
  prerequisites: z.array(exactHumanDesignApprovalPrerequisiteSchema).length(humanDesignApprovalPrerequisiteKeys.length)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Prerequisite keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Prerequisites must use canonical key ordering"),
  subject: humanDesignApprovalSubjectSchema,
  scope: humanDesignApprovalScopeSchema,
  decision: humanDesignApprovalDecisionSchema.optional(),
  decisionDefinitionDigest: digestSchema,
  decisionReceiptDigest: digestSchema,
  candidateResult: z.enum(["abstained-candidate", "approved-candidate", "blocked", "changes-requested-candidate", "incomplete", "rejected-candidate"]),
  unresolvedQuestions: canonicalTextSchema,
  limitations: canonicalTextSchema.refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "recorded-human-decision"]),
  approverAuthorityState: z.literal("not-established"),
  separationOfDutiesEnforcementState: z.literal("not-established"),
  designApprovalState: z.literal("not-established"),
  designBaselineState: z.literal("not-established"),
  readinessState: z.literal("not-established"),
  phaseEntryAuthorityState: z.literal("not-granted"),
  figmaConnectionAuthorityState: z.literal("not-granted"),
  credentialAuthorityState: z.literal("not-granted"),
  permissionGrantState: z.literal("not-granted"),
  importExecutionState: z.literal("not-performed"),
  writeExecutionState: z.literal("not-performed"),
  implementationAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  const expected = humanDesignApprovalPrerequisiteKeys.join("|")
  if (candidate.prerequisites.map((entry) => entry.key).join("|") !== expected) {
    context.addIssue({ code: "custom", path: ["prerequisites"], message: "Human Design Approval must bind every canonical prerequisite exactly once" })
  }
  const finalized = candidate.prerequisites.find((entry) => entry.key === "finalized-figma-snapshot-import")
  if (!finalized || finalized.recordId !== candidate.subject.recordId || finalized.revision !== candidate.subject.revision ||
      finalized.digest !== candidate.subject.digest || finalized.membershipDigest !== candidate.subject.membershipDigest) {
    context.addIssue({ code: "custom", path: ["subject"], message: "Approval subject must be the exact finalized-snapshot prerequisite" })
  }
  if (candidate.scope.subjectDigest !== candidate.subject.digest ||
      candidate.scope.includedItemDigests.length + candidate.scope.excludedItemDigests.length !== candidate.subject.itemCount) {
    context.addIssue({ code: "custom", path: ["scope"], message: "Approval scope must bind and classify every exact finalized-snapshot item" })
  }
  if (!candidate.decision) {
    if (!["blocked", "incomplete"].includes(candidate.candidateResult) || candidate.reviewState === "recorded-human-decision") {
      context.addIssue({ code: "custom", path: ["candidateResult"], message: "Candidates without a human decision must remain blocked or incomplete" })
    }
    return
  }
  if (candidate.candidateResult !== resultByDecisionKind[candidate.decision.kind]) {
    context.addIssue({ code: "custom", path: ["candidateResult"], message: "Candidate result must match the exact recorded human decision kind" })
  }
  if (candidate.reviewState !== "recorded-human-decision" || candidate.unresolvedQuestions.length > 0) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Recorded human decisions require no unresolved question and the exact decision review state" })
  }
})

export const humanDesignApprovalInputSchema = rejectSecrets(humanDesignApprovalInputBaseSchema)

export const humanDesignApprovalSchema = humanDesignApprovalInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("human-design-approval-candidate"),
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
  authorityBoundary: z.literal("human-design-approval-is-a-recorded-decision-candidate-and-does-not-verify-approver-authority-enforce-separation-of-duties-establish-design-approval-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority"),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Human Design Approval revisions after revision one require an exact predecessor digest" })
  }
})

export const exactHumanDesignApprovalReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const humanDesignApprovalStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("human-design-approval-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactHumanDesignApprovalReferenceSchema.optional(),
  prerequisiteCount: z.number().int().nonnegative().max(humanDesignApprovalPrerequisiteKeys.length),
  completePrerequisiteCount: z.number().int().nonnegative().max(humanDesignApprovalPrerequisiteKeys.length),
  decisionCount: z.number().int().nonnegative().max(1),
  approveCount: z.number().int().nonnegative().max(1),
  rejectCount: z.number().int().nonnegative().max(1),
  requestChangeCount: z.number().int().nonnegative().max(1),
  abstainCount: z.number().int().nonnegative().max(1),
  expiredDecisionCount: z.number().int().nonnegative().max(1),
  revokedDecisionCount: z.number().int().nonnegative().max(1),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  candidateResult: z.enum(["abstained-candidate", "approved-candidate", "blocked", "changes-requested-candidate", "incomplete", "not-assessed", "rejected-candidate"]),
  reviewState: z.enum(["draft", "held", "recorded-human-decision"]),
  approverAuthorityState: z.literal("not-established"),
  separationOfDutiesEnforcementState: z.literal("not-established"),
  state: z.enum(["attention-required", "complete-for-recorded-decision"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal("human-design-approval-status-is-observational-and-does-not-verify-approver-authority-enforce-separation-of-duties-establish-design-approval-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority"),
}).strict().superRefine((status, context) => {
  const decisions = status.approveCount + status.rejectCount + status.requestChangeCount + status.abstainCount
  if (decisions !== status.decisionCount) {
    context.addIssue({ code: "custom", path: ["decisionCount"], message: "Human Design Approval decision counts must reconcile" })
  }
  const gaps = status.expiredDecisionCount + status.revokedDecisionCount + status.staleBindingCount +
    status.staleSourceReferenceCount + status.unresolvedQuestionCount
  if (status.state === "complete-for-recorded-decision" && (!status.candidate || status.reasons.length > 0 ||
      status.prerequisiteCount !== humanDesignApprovalPrerequisiteKeys.length ||
      status.completePrerequisiteCount !== humanDesignApprovalPrerequisiteKeys.length || status.decisionCount !== 1 ||
      gaps > 0 || status.reviewState !== "recorded-human-decision")) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete recorded decisions require exact current prerequisites, one active bounded human decision, and no declared gap" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Human Design Approval status must expose reasons" })
  }
})

export const humanDesignApprovalProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("human-design-approval-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]) }).strict(),
  status: humanDesignApprovalStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    membershipDigest: digestSchema, state: z.literal("candidate"),
    prerequisiteCatalogDigest: digestSchema, subject: humanDesignApprovalSubjectSchema,
    scopeDigest: digestSchema, decisionDefinitionDigest: digestSchema, decisionReceiptDigest: digestSchema,
    decisionKind: z.enum(humanDesignApprovalDecisionKinds).optional(),
    decisionDigest: digestSchema.optional(), decisionLifecycleState: z.enum(["active-candidate", "revoked-candidate"]).optional(),
    candidateResult: z.enum(["abstained-candidate", "approved-candidate", "blocked", "changes-requested-candidate", "incomplete", "rejected-candidate"]),
    reviewState: z.enum(["draft", "held", "recorded-human-decision"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal("projection-contains-record-identities-counts-results-and-digests-only-not-design-content-decision-rationale-condition-evidence-source-content-human-attribution-personal-content-secrets-credentials-or-permissions"),
  authorityBoundary: z.literal("human-design-approval-projection-is-read-only-and-does-not-verify-approver-authority-enforce-separation-of-duties-establish-design-approval-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority"),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Human Design Approval projection must bind exact Product and Initiative revisions" })
  }
})

export type HumanDesignApprovalPrerequisiteKey = z.infer<typeof humanDesignApprovalPrerequisiteKeySchema>
export type ExactHumanDesignApprovalPrerequisite = z.infer<typeof exactHumanDesignApprovalPrerequisiteSchema>
export type HumanDesignApprovalInput = z.infer<typeof humanDesignApprovalInputSchema>
export type HumanDesignApproval = z.infer<typeof humanDesignApprovalSchema>
export type HumanDesignApprovalStatus = z.infer<typeof humanDesignApprovalStatusSchema>
export type HumanDesignApprovalProjection = z.infer<typeof humanDesignApprovalProjectionSchema>
