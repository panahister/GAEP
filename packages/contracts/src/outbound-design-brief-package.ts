import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import {
  exactFigmaContextImportReferenceSchema,
  exactFigmaContextPackReferenceSchema,
  figmaContextSectionKinds,
} from "./figma-context-import.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactSourceReferenceSchema } from "./source-governance.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const requirementKeySchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/)
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
    message: "Outbound Design Brief Package candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalIdentifierListSchema = canonicalStringArray(identifierSchema, 16_384)
const canonicalUuidListSchema = canonicalStringArray(z.string().uuid(), 16_384)
const canonicalRequirementListSchema = canonicalStringArray(requirementKeySchema, 4_096)
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

export const exactOutboundFigmaContextImportBindingSchema = exactFigmaContextImportReferenceSchema.extend({
  membershipDigest: digestSchema,
}).strict()

const evidenceSchema = z.object({
  state: z.enum(["human-reviewed", "not-assessed", "source-recorded"]),
  evidenceDigests: canonicalDigestListSchema,
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
}).strict().superRefine((evidence, context) => {
  if ((evidence.state === "not-assessed") !== (evidence.evidenceDigests.length === 0)) {
    context.addIssue({ code: "custom", path: ["evidenceDigests"], message: "Assessed package evidence requires digests; not-assessed evidence forbids them" })
  }
  const reviewed = evidence.state === "human-reviewed"
  if (reviewed !== (evidence.reviewedBy !== undefined && evidence.reviewedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Human-reviewed package evidence requires an attributable reviewer and time; other states forbid them" })
  }
})

export const outboundDesignBriefPackageEntrySchema = z.object({
  key: identifierSchema,
  sourceSectionKey: identifierSchema,
  kind: z.enum(figmaContextSectionKinds),
  contextPackId: z.string().uuid(),
  contextItemIds: canonicalUuidListSchema.min(1),
  contentDigest: digestSchema,
  transformationDigest: digestSchema,
  selectionReasonDigest: digestSchema,
  informationClassification: informationClassificationSchema,
  redactionState: z.enum(["not-required", "redacted-and-reviewed", "unresolved"]),
  requirementKeys: canonicalRequirementListSchema,
  recipientKeys: canonicalIdentifierListSchema.min(1),
  evidence: evidenceSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((entry, context) => {
  if (entry.redactionState === "redacted-and-reviewed" && entry.evidence.state !== "human-reviewed") {
    context.addIssue({ code: "custom", path: ["evidence"], message: "Redacted package entries require attributable human review" })
  }
  if (["confidential", "restricted"].includes(entry.informationClassification) &&
      entry.redactionState === "not-required") {
    context.addIssue({ code: "custom", path: ["redactionState"], message: "Confidential or restricted package entries require explicit redaction review" })
  }
})

export const outboundDesignBriefRecipientSchema = z.object({
  key: identifierSchema,
  sourceTargetKey: identifierSchema,
  designScopeKey: identifierSchema,
  fileKey: identifierSchema,
  targetKind: z.literal("figma-file-root"),
  externalFileIdentityDigest: digestSchema,
  externalVersionDigest: digestSchema,
  plannedWriteToolKey: identifierSchema,
  expectedEffect: z.literal("write"),
  permissionRequirementState: z.literal("ungranted"),
  entryKeys: canonicalIdentifierListSchema.min(1),
  purposeDigest: digestSchema,
  policyBasisDigest: digestSchema,
  retentionRuleDigest: digestSchema,
  destinationState: z.literal("not-connected"),
  processorState: z.literal("not-selected"),
  deliveryState: z.literal("not-performed"),
  sources: exactSourceListSchema,
  limitations: requiredCanonicalTextListSchema,
}).strict()

export const outboundDesignBriefRequirementCoverageSchema = z.object({
  requirementKey: requirementKeySchema,
  state: z.enum(["represented", "unresolved"]),
  entryKeys: canonicalIdentifierListSchema,
  recipientKeys: canonicalIdentifierListSchema,
  rationaleDigest: digestSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((coverage, context) => {
  const represented = coverage.state === "represented"
  if (represented !== (coverage.entryKeys.length > 0 && coverage.recipientKeys.length > 0)) {
    context.addIssue({ code: "custom", message: "Represented Requirements require exact package entries and recipients; unresolved Requirements forbid invented coverage" })
  }
})

export const outboundDesignBriefDisclosureSchema = z.object({
  key: identifierSchema,
  kind: z.enum(["access-failure", "conflict", "exclusion"]),
  materiality: z.enum(["material", "non-material"]),
  state: z.enum(["resolved", "unresolved"]),
  subjectDigest: digestSchema,
  rationaleDigest: digestSchema,
  evidence: evidenceSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((disclosure, context) => {
  if (disclosure.state === "resolved" && disclosure.evidence.state !== "human-reviewed") {
    context.addIssue({ code: "custom", path: ["evidence"], message: "Resolved package disclosures require attributable human review" })
  }
})

export const outboundDesignBriefPreviewSchema = z.object({
  manifestDigest: digestSchema,
  payloadDigest: digestSchema,
  previewDigest: digestSchema.optional(),
  state: z.enum(["candidate-generated", "human-reviewed", "not-generated"]),
  evidenceDigests: canonicalDigestListSchema,
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
}).strict().superRefine((preview, context) => {
  if ((preview.state === "not-generated") !== (preview.previewDigest === undefined && preview.evidenceDigests.length === 0)) {
    context.addIssue({ code: "custom", message: "Generated package previews require exact preview and evidence digests; not-generated previews forbid them" })
  }
  const reviewed = preview.state === "human-reviewed"
  if (reviewed !== (preview.reviewedBy !== undefined && preview.reviewedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Human-reviewed package previews require an attributable reviewer and time; other states forbid them" })
  }
})

const outboundDesignBriefPackageInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  objectiveDigest: digestSchema,
  figmaContextImport: exactOutboundFigmaContextImportBindingSchema,
  contextPacks: z.array(exactFigmaContextPackReferenceSchema).min(1).max(32)
    .refine((entries) => unique(entries.map((entry) => entry.recordId)), "Context Pack bindings must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.recordId)), "Context Pack bindings must use canonical identity ordering"),
  manifestFormat: z.literal("gaep-outbound-design-brief-package-v1"),
  manifestDigest: digestSchema,
  payloadDigest: digestSchema,
  entries: z.array(outboundDesignBriefPackageEntrySchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Package entry keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Package entries must use canonical key ordering")
    .refine((entries) => unique(entries.map((entry) => entry.sourceSectionKey)), "Figma Context Import sections may appear in only one package entry")
    .refine((entries) => unique(entries.flatMap((entry) => entry.contextItemIds)), "Context Items may appear in only one package entry"),
  recipients: z.array(outboundDesignBriefRecipientSchema).min(1).max(256)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Package recipient keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Package recipients must use canonical key ordering")
    .refine((entries) => unique(entries.map((entry) => entry.sourceTargetKey)), "Figma Context Import targets may appear in only one package recipient"),
  requirementCoverage: z.array(outboundDesignBriefRequirementCoverageSchema).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.requirementKey)), "Requirement coverage entries must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.requirementKey)), "Requirement coverage must use canonical Requirement ordering"),
  disclosures: z.array(outboundDesignBriefDisclosureSchema).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Package disclosure keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Package disclosures must use canonical key ordering"),
  manifestState: z.enum(["candidate-complete", "not-assessed", "partial"]),
  provenanceState: z.enum(["exact", "not-assessed", "partial"]),
  redactionReviewState: z.enum(["complete", "not-assessed", "partial"]),
  preview: outboundDesignBriefPreviewSchema,
  unresolvedQuestions: canonicalTextListSchema,
  limitations: requiredCanonicalTextListSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  packageMaterializationState: z.literal("manifest-only"),
  contextTransferState: z.literal("not-performed"),
  figmaConnectionAuthorityState: z.literal("not-granted"),
  credentialAuthorityState: z.literal("not-granted"),
  permissionGrantState: z.literal("not-granted"),
  figmaWriteAuthorityState: z.literal("not-granted"),
  targetValidityState: z.literal("not-established"),
  externalCompletenessState: z.literal("not-established"),
  designValidityState: z.literal("not-established"),
  designApprovalState: z.literal("not-established"),
  designBaselineState: z.literal("not-established"),
  readinessState: z.literal("not-established"),
  implementationAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  const contextPackIds = new Set(candidate.contextPacks.map((entry) => entry.recordId))
  const entryKeys = new Set(candidate.entries.map((entry) => entry.key))
  const recipientKeys = new Set(candidate.recipients.map((entry) => entry.key))
  for (const [index, entry] of candidate.entries.entries()) {
    if (!contextPackIds.has(entry.contextPackId)) {
      context.addIssue({ code: "custom", path: ["entries", index, "contextPackId"], message: "Package entries must bind an exact selected Context Pack" })
    }
    if (entry.recipientKeys.some((key) => !recipientKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["entries", index, "recipientKeys"], message: "Package entries must reference exact recipients" })
    }
  }
  for (const [index, recipient] of candidate.recipients.entries()) {
    if (recipient.entryKeys.some((key) => !entryKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["recipients", index, "entryKeys"], message: "Package recipients must reference exact package entries" })
    }
  }
  for (const [index, coverage] of candidate.requirementCoverage.entries()) {
    if (coverage.entryKeys.some((key) => !entryKeys.has(key)) ||
        coverage.recipientKeys.some((key) => !recipientKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["requirementCoverage", index], message: "Requirement coverage must reference exact package entries and recipients" })
    }
  }
  const unresolvedMaterialDisclosure = candidate.disclosures.some((entry) =>
    entry.materiality === "material" && entry.state === "unresolved")
  if (candidate.manifestState === "candidate-complete" &&
      (candidate.entries.some((entry) => entry.evidence.state !== "human-reviewed" || entry.redactionState === "unresolved") ||
       candidate.requirementCoverage.some((entry) => entry.state !== "represented") || unresolvedMaterialDisclosure)) {
    context.addIssue({ code: "custom", path: ["manifestState"], message: "Candidate-complete manifests require reviewed entries, resolved redaction, represented Requirements, and no unresolved material disclosure" })
  }
  if (candidate.provenanceState === "exact" && candidate.entries.some((entry) => entry.evidence.state !== "human-reviewed")) {
    context.addIssue({ code: "custom", path: ["provenanceState"], message: "Exact package provenance requires attributable human-reviewed entry evidence" })
  }
  if (candidate.redactionReviewState === "complete" && candidate.entries.some((entry) => entry.redactionState === "unresolved")) {
    context.addIssue({ code: "custom", path: ["redactionReviewState"], message: "Complete package redaction review forbids unresolved entry redaction" })
  }
  if (candidate.reviewState === "ready-for-human-review" &&
      (candidate.manifestState !== "candidate-complete" || candidate.provenanceState !== "exact" ||
       candidate.redactionReviewState !== "complete" || candidate.preview.state !== "human-reviewed" ||
       candidate.unresolvedQuestions.length > 0)) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Outbound Design Brief Package candidates cannot be review-ready while manifest, provenance, redaction, preview, or questions remain unresolved" })
  }
})

export const outboundDesignBriefPackageInputSchema = rejectSecrets(outboundDesignBriefPackageInputBaseSchema)

export const outboundDesignBriefPackageSchema = outboundDesignBriefPackageInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("outbound-design-brief-package-candidate"),
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
    "outbound-design-brief-package-is-a-versioned-manifest-only-candidate-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
  ),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Outbound Design Brief Package revisions after revision one require an exact predecessor digest" })
  }
})

export const exactOutboundDesignBriefPackageReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const outboundDesignBriefPackageStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("outbound-design-brief-package-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactOutboundDesignBriefPackageReferenceSchema.optional(),
  contextPackCount: z.number().int().nonnegative().max(32),
  entryCount: z.number().int().nonnegative().max(4_096),
  contextItemCount: z.number().int().nonnegative().max(16_384),
  recipientCount: z.number().int().nonnegative().max(256),
  humanReviewedEntryCount: z.number().int().nonnegative().max(4_096),
  sourceRecordedEntryCount: z.number().int().nonnegative().max(4_096),
  notAssessedEntryCount: z.number().int().nonnegative().max(4_096),
  unresolvedRedactionCount: z.number().int().nonnegative().max(4_096),
  representedRequirementCount: z.number().int().nonnegative().max(4_096),
  unresolvedRequirementCount: z.number().int().nonnegative().max(4_096),
  unresolvedDisclosureCount: z.number().int().nonnegative().max(4_096),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  manifestState: z.enum(["candidate-complete", "not-assessed", "partial"]),
  provenanceState: z.enum(["exact", "not-assessed", "partial"]),
  redactionReviewState: z.enum(["complete", "not-assessed", "partial"]),
  previewState: z.enum(["candidate-generated", "human-reviewed", "not-generated"]),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "outbound-design-brief-package-status-is-observational-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
  ),
}).strict().superRefine((status, context) => {
  const gaps = status.sourceRecordedEntryCount + status.notAssessedEntryCount + status.unresolvedRedactionCount +
    status.unresolvedRequirementCount + status.unresolvedDisclosureCount + status.staleBindingCount +
    status.staleSourceReferenceCount + status.unresolvedQuestionCount
  if (status.state === "complete-for-review" &&
      (gaps > 0 || status.contextPackCount === 0 || status.entryCount === 0 || status.recipientCount === 0 ||
       status.manifestState !== "candidate-complete" || status.provenanceState !== "exact" ||
       status.redactionReviewState !== "complete" || status.previewState !== "human-reviewed" ||
       status.reviewState !== "ready-for-human-review" || status.reasons.length > 0 || !status.candidate)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires an exact reviewed Outbound Design Brief Package candidate with no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Outbound Design Brief Package status must expose reasons" })
  }
})

export const outboundDesignBriefPackageProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("outbound-design-brief-package-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: outboundDesignBriefPackageStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, membershipDigest: digestSchema,
    state: z.literal("candidate"), manifestFormat: z.literal("gaep-outbound-design-brief-package-v1"),
    manifestDigest: digestSchema, payloadDigest: digestSchema, contextPackCount: z.number().int().nonnegative(),
    entryCount: z.number().int().nonnegative(), contextItemCount: z.number().int().nonnegative(),
    recipientCount: z.number().int().nonnegative(), representedRequirementCount: z.number().int().nonnegative(),
    unresolvedDisclosureCount: z.number().int().nonnegative(),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-record-identities-counts-statuses-and-digests-only-not-brief-requirement-constraint-context-item-figma-target-tool-source-transformation-disclosure-or-personal-content-secrets-credentials-or-permissions",
  ),
  authorityBoundary: z.literal(
    "outbound-design-brief-package-projection-is-read-only-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Outbound Design Brief Package projection must bind exact Product and Initiative revisions" })
  }
})

export type OutboundDesignBriefPackageInput = z.infer<typeof outboundDesignBriefPackageInputSchema>
export type OutboundDesignBriefPackage = z.infer<typeof outboundDesignBriefPackageSchema>
export type ExactOutboundDesignBriefPackageReference = z.infer<typeof exactOutboundDesignBriefPackageReferenceSchema>
export type OutboundDesignBriefPackageStatus = z.infer<typeof outboundDesignBriefPackageStatusSchema>
export type OutboundDesignBriefPackageProjection = z.infer<typeof outboundDesignBriefPackageProjectionSchema>
