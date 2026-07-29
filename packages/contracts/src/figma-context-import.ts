import { z } from "zod"

import { exactAccessibilityDesignRulesReferenceSchema } from "./accessibility-design-rules.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactDesignApplicabilityReferenceSchema } from "./design-applicability.js"
import { exactDesignRequirementsReferenceSchema } from "./design-requirements.js"
import { exactDesignSystemTokenContractReferenceSchema } from "./design-system-token-contract.js"
import { exactFigmaMcpCapabilityDiscoveryReferenceSchema } from "./figma-mcp-capability-discovery.js"
import { exactFigmaReadSnapshotReferenceSchema } from "./figma-read-snapshot.js"
import { exactManualFigmaExecutionPathReferenceSchema } from "./manual-figma-execution-path.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactResponsiveMultiPlatformTargetsReferenceSchema } from "./responsive-multi-platform-targets.js"
import { exactSourceReferenceSchema } from "./source-governance.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const requirementKeySchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
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
    message: "Figma Context Import candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalIdentifierListSchema = canonicalStringArray(identifierSchema, 16_384)
const canonicalUuidListSchema = canonicalStringArray(z.string().uuid(), 16_384)
const canonicalTextListSchema = canonicalStringArray(shortTextSchema)
const requiredCanonicalTextListSchema = canonicalTextListSchema.refine(
  (values) => values.length > 0,
  "At least one limitation is required",
)
const canonicalDigestListSchema = canonicalStringArray(digestSchema, 1_024)
const exactSourceListSchema = z.array(exactSourceReferenceSchema).min(1).max(256)
  .refine((entries) => unique(entries.map((entry) =>
    `${entry.sourceId}:${entry.sourceRevision}:${entry.recordDigest}:${entry.contentDigest}`)),
  "Source references must be unique")
  .refine((entries) => canonical(entries.map((entry) =>
    `${entry.sourceId}:${String(entry.sourceRevision).padStart(12, "0")}`)),
  "Source references must use canonical identity ordering")

const exactMembershipBinding = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.extend({ membershipDigest: digestSchema }).strict()

const exactDesignApplicabilityBindingSchema = exactMembershipBinding(exactDesignApplicabilityReferenceSchema)
const exactDesignRequirementsBindingSchema = exactMembershipBinding(exactDesignRequirementsReferenceSchema)
const exactDesignSystemTokenContractBindingSchema = exactMembershipBinding(exactDesignSystemTokenContractReferenceSchema)
const exactAccessibilityDesignRulesBindingSchema = exactMembershipBinding(exactAccessibilityDesignRulesReferenceSchema)
const exactResponsiveMultiPlatformTargetsBindingSchema = exactMembershipBinding(exactResponsiveMultiPlatformTargetsReferenceSchema)
const exactManualFigmaExecutionPathBindingSchema = exactMembershipBinding(exactManualFigmaExecutionPathReferenceSchema)
const exactFigmaMcpCapabilityDiscoveryBindingSchema = exactMembershipBinding(exactFigmaMcpCapabilityDiscoveryReferenceSchema)
const exactFigmaReadSnapshotBindingSchema = exactMembershipBinding(exactFigmaReadSnapshotReferenceSchema)

export const exactFigmaContextPackReferenceSchema = z.object({
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
  packDigest: digestSchema,
}).strict()

const candidateOwnershipSchema = z.object({
  state: z.enum(["assigned-candidate", "unresolved"]),
  owner: actorSchema.optional(),
}).strict().superRefine((ownership, context) => {
  if ((ownership.state === "assigned-candidate") !== (ownership.owner !== undefined)) {
    context.addIssue({ code: "custom", message: "Candidate ownership requires an explicit actor; unresolved ownership forbids one" })
  }
})

const evidenceSchema = z.object({
  state: z.enum(["human-reviewed", "not-assessed", "source-recorded"]),
  evidenceDigests: canonicalDigestListSchema,
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
}).strict().superRefine((evidence, context) => {
  if ((evidence.state === "not-assessed") !== (evidence.evidenceDigests.length === 0)) {
    context.addIssue({ code: "custom", path: ["evidenceDigests"], message: "Assessed context evidence requires digests; not-assessed evidence forbids them" })
  }
  const reviewed = evidence.state === "human-reviewed"
  if (reviewed !== (evidence.reviewedBy !== undefined && evidence.reviewedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Human-reviewed context evidence requires an attributable reviewer and time; other states forbid them" })
  }
})

export const figmaContextSectionKinds = [
  "accessibility-constraints",
  "architecture-decisions",
  "authorization-rules",
  "design-brief",
  "design-requirements",
  "design-system-constraints",
  "journey-context",
  "responsive-constraints",
  "screen-state-context",
  "source-index",
  "unresolved-limitations",
] as const

export const figmaContextImportSectionSchema = z.object({
  key: identifierSchema,
  kind: z.enum(figmaContextSectionKinds),
  contextPackId: z.string().uuid(),
  contextItemIds: canonicalUuidListSchema.min(1),
  contentDigest: digestSchema,
  transformationDigest: digestSchema,
  informationClassification: informationClassificationSchema,
  redactionState: z.enum(["not-required", "redacted-and-reviewed", "unresolved"]),
  evidence: evidenceSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((section, context) => {
  if (section.redactionState === "redacted-and-reviewed" && section.evidence.state !== "human-reviewed") {
    context.addIssue({ code: "custom", path: ["evidence"], message: "Redacted context sections require attributable human review" })
  }
  if (["confidential", "restricted"].includes(section.informationClassification) &&
      section.redactionState === "not-required") {
    context.addIssue({ code: "custom", path: ["redactionState"], message: "Confidential or restricted context sections require explicit redaction review" })
  }
})

export const figmaContextImportTargetSchema = z.object({
  key: identifierSchema,
  designScopeKey: identifierSchema,
  fileKey: identifierSchema,
  targetKind: z.literal("file-root"),
  externalFileIdentityDigest: digestSchema,
  externalVersionDigest: digestSchema,
  plannedWriteToolKey: identifierSchema,
  expectedEffect: z.literal("write"),
  permissionRequirementState: z.literal("ungranted"),
  sectionKeys: canonicalIdentifierListSchema.min(1),
  ownership: candidateOwnershipSchema,
  sources: exactSourceListSchema,
  limitations: requiredCanonicalTextListSchema,
}).strict()

export const figmaContextRequirementCoverageSchema = z.object({
  requirementKey: requirementKeySchema,
  state: z.enum(["represented", "unresolved"]),
  sectionKeys: canonicalIdentifierListSchema,
  targetKeys: canonicalIdentifierListSchema,
  rationaleDigest: digestSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((coverage, context) => {
  const represented = coverage.state === "represented"
  if (represented !== (coverage.sectionKeys.length > 0 && coverage.targetKeys.length > 0)) {
    context.addIssue({ code: "custom", message: "Represented Requirements require exact context sections and targets; unresolved Requirements forbid invented coverage" })
  }
})

export const figmaContextSelectionPreviewSchema = z.object({
  selectionDigest: digestSchema,
  previewDigest: digestSchema.optional(),
  state: z.enum(["candidate-generated", "human-reviewed", "not-generated"]),
  evidenceDigests: canonicalDigestListSchema,
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
}).strict().superRefine((preview, context) => {
  if ((preview.state === "not-generated") !== (preview.previewDigest === undefined && preview.evidenceDigests.length === 0)) {
    context.addIssue({ code: "custom", message: "Generated previews require exact preview and evidence digests; not-generated previews forbid them" })
  }
  const reviewed = preview.state === "human-reviewed"
  if (reviewed !== (preview.reviewedBy !== undefined && preview.reviewedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Human-reviewed previews require an attributable reviewer and time; other states forbid them" })
  }
})

const figmaContextImportInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  designApplicability: exactDesignApplicabilityBindingSchema,
  designRequirements: exactDesignRequirementsBindingSchema,
  designSystemTokenContract: exactDesignSystemTokenContractBindingSchema,
  accessibilityDesignRules: exactAccessibilityDesignRulesBindingSchema,
  responsiveMultiPlatformTargets: exactResponsiveMultiPlatformTargetsBindingSchema,
  manualFigmaExecutionPath: exactManualFigmaExecutionPathBindingSchema,
  figmaMcpCapabilityDiscovery: exactFigmaMcpCapabilityDiscoveryBindingSchema,
  figmaReadSnapshot: exactFigmaReadSnapshotBindingSchema,
  contextPacks: z.array(exactFigmaContextPackReferenceSchema).min(1).max(32)
    .refine((entries) => unique(entries.map((entry) => entry.recordId)), "Context Pack bindings must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.recordId)), "Context Pack bindings must use canonical identity ordering"),
  sections: z.array(figmaContextImportSectionSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Context section keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Context sections must use canonical key ordering")
    .refine((entries) => unique(entries.flatMap((entry) => entry.contextItemIds)), "Context Items may appear in only one selected section"),
  targets: z.array(figmaContextImportTargetSchema).min(1).max(256)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Figma context target keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Figma context targets must use canonical key ordering")
    .refine((entries) => unique(entries.map((entry) => entry.designScopeKey)), "Design scopes may appear in only one Figma context target"),
  requirementCoverage: z.array(figmaContextRequirementCoverageSchema).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.requirementKey)), "Requirement coverage entries must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.requirementKey)), "Requirement coverage must use canonical Requirement ordering"),
  preview: figmaContextSelectionPreviewSchema,
  contextSelectionState: z.enum(["candidate-selection-complete", "not-assessed", "partial"]),
  provenanceState: z.enum(["exact", "not-assessed", "partial"]),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: requiredCanonicalTextListSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  packagePreparationState: z.literal("not-started"),
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
  const sectionKeys = new Set(candidate.sections.map((entry) => entry.key))
  const targetKeys = new Set(candidate.targets.map((entry) => entry.key))
  for (const [index, section] of candidate.sections.entries()) {
    if (!contextPackIds.has(section.contextPackId)) {
      context.addIssue({ code: "custom", path: ["sections", index, "contextPackId"], message: "Context sections must bind an exact selected Context Pack" })
    }
  }
  for (const [index, target] of candidate.targets.entries()) {
    if (target.sectionKeys.some((key) => !sectionKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["targets", index, "sectionKeys"], message: "Figma context targets must reference exact selected sections" })
    }
  }
  for (const [index, coverage] of candidate.requirementCoverage.entries()) {
    if (coverage.sectionKeys.some((key) => !sectionKeys.has(key)) || coverage.targetKeys.some((key) => !targetKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["requirementCoverage", index], message: "Requirement coverage must reference exact selected sections and targets" })
    }
  }
  if (candidate.contextSelectionState === "candidate-selection-complete" &&
      (candidate.sections.some((entry) => entry.evidence.state !== "human-reviewed" || entry.redactionState === "unresolved") ||
       candidate.targets.some((entry) => entry.ownership.state !== "assigned-candidate") ||
       candidate.requirementCoverage.some((entry) => entry.state !== "represented"))) {
    context.addIssue({ code: "custom", path: ["contextSelectionState"], message: "Candidate-complete context selection requires reviewed sections, resolved redaction and ownership, and represented Requirements" })
  }
  if (candidate.provenanceState === "exact" && candidate.sections.some((entry) => entry.evidence.state !== "human-reviewed")) {
    context.addIssue({ code: "custom", path: ["provenanceState"], message: "Exact provenance requires attributable human-reviewed section evidence" })
  }
  if (candidate.reviewState === "ready-for-human-review" &&
      (candidate.contextSelectionState !== "candidate-selection-complete" || candidate.provenanceState !== "exact" ||
       candidate.preview.state !== "human-reviewed" || candidate.unresolvedQuestions.length > 0)) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Figma Context Import candidates cannot be review-ready while selection, provenance, preview, or questions remain unresolved" })
  }
})

export const figmaContextImportInputSchema = rejectSecrets(figmaContextImportInputBaseSchema)

export const figmaContextImportSchema = figmaContextImportInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("figma-context-import-candidate"),
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
    "figma-context-import-is-a-source-backed-candidate-selection-and-does-not-package-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
  ),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Figma Context Import revisions after revision one require an exact predecessor digest" })
  }
})

export const exactFigmaContextImportReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const figmaContextImportStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("figma-context-import-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactFigmaContextImportReferenceSchema.optional(),
  contextPackCount: z.number().int().nonnegative().max(32),
  sectionCount: z.number().int().nonnegative().max(4_096),
  contextItemCount: z.number().int().nonnegative().max(16_384),
  targetCount: z.number().int().nonnegative().max(256),
  humanReviewedSectionCount: z.number().int().nonnegative().max(4_096),
  sourceRecordedSectionCount: z.number().int().nonnegative().max(4_096),
  notAssessedSectionCount: z.number().int().nonnegative().max(4_096),
  unresolvedRedactionCount: z.number().int().nonnegative().max(4_096),
  representedRequirementCount: z.number().int().nonnegative().max(4_096),
  unresolvedRequirementCount: z.number().int().nonnegative().max(4_096),
  unresolvedOwnershipCount: z.number().int().nonnegative().max(256),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  contextSelectionState: z.enum(["candidate-selection-complete", "not-assessed", "partial"]),
  provenanceState: z.enum(["exact", "not-assessed", "partial"]),
  previewState: z.enum(["candidate-generated", "human-reviewed", "not-generated"]),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "figma-context-import-status-is-observational-and-does-not-package-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
  ),
}).strict().superRefine((status, context) => {
  const gaps = status.sourceRecordedSectionCount + status.notAssessedSectionCount + status.unresolvedRedactionCount +
    status.unresolvedRequirementCount + status.unresolvedOwnershipCount + status.staleBindingCount +
    status.staleSourceReferenceCount + status.unresolvedQuestionCount
  if (status.state === "complete-for-review" &&
      (gaps > 0 || status.contextPackCount === 0 || status.sectionCount === 0 || status.targetCount === 0 ||
       status.contextSelectionState !== "candidate-selection-complete" || status.provenanceState !== "exact" ||
       status.previewState !== "human-reviewed" || status.reviewState !== "ready-for-human-review" ||
       status.reasons.length > 0 || !status.candidate)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires an exact reviewed Figma Context Import candidate with no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Figma Context Import status must expose reasons" })
  }
})

export const figmaContextImportProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("figma-context-import-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: figmaContextImportStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, membershipDigest: digestSchema,
    state: z.literal("candidate"), contextPackCount: z.number().int().nonnegative(),
    sectionCount: z.number().int().nonnegative(), contextItemCount: z.number().int().nonnegative(),
    targetCount: z.number().int().nonnegative(), representedRequirementCount: z.number().int().nonnegative(),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-record-identities-counts-statuses-and-digests-only-not-brief-requirement-constraint-context-item-figma-target-tool-source-or-personal-content-secrets-credentials-or-permissions",
  ),
  authorityBoundary: z.literal(
    "figma-context-import-projection-is-read-only-and-does-not-package-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Figma Context Import projection must bind exact Product and Initiative revisions" })
  }
})

export type FigmaContextImportInput = z.infer<typeof figmaContextImportInputSchema>
export type FigmaContextImport = z.infer<typeof figmaContextImportSchema>
export type ExactFigmaContextImportReference = z.infer<typeof exactFigmaContextImportReferenceSchema>
export type FigmaContextImportStatus = z.infer<typeof figmaContextImportStatusSchema>
export type FigmaContextImportProjection = z.infer<typeof figmaContextImportProjectionSchema>
