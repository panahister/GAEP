import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import {
  exactP0P4ReadinessGateReferenceSchema,
  p0P4ReadinessOutputKinds,
  p0P4ReadinessOutputKindSchema,
  p0P4ReadinessRecordKinds,
} from "./p0-p4-readiness-gate.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactSourceReferenceSchema } from "./source-governance.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const longTextSchema = z.string().trim().min(10).max(20_000)
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function canonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}

function canonicalArray<T extends z.ZodType>(schema: T, maximum = 4_096) {
  return z.array(schema).max(maximum)
    .refine((values) => unique(values as string[]), "Values must be unique")
    .refine((values) => canonical(values as string[]), "Values must use canonical lexical ordering")
}

const canonicalTextListSchema = canonicalArray(shortTextSchema, 512)
const requiredCanonicalTextListSchema = canonicalTextListSchema.refine(
  (values) => values.length > 0,
  "At least one value is required",
)
const exactSourceListSchema = z.array(exactSourceReferenceSchema).max(256)
  .refine((entries) => unique(entries.map((entry) =>
    `${entry.sourceId}:${entry.sourceRevision}:${entry.recordDigest}:${entry.contentDigest}`)), "Source references must be unique")

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable P5 Handoff Package candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const p5HandoffRequirementIds = [
  "GAEP-CST-REQ-003",
  "GAEP-CST-REQ-014",
  "GAEP-CST-REQ-019",
  "GAEP-CST-REQ-021",
  "GAEP-CST-REQ-022",
  "GAEP-CST-REQ-024",
  "GAEP-CST-REQ-026",
  "GAEP-CST-REQ-029",
  "GAEP-CST-REQ-031",
  "GAEP-CST-REQ-033",
  "GAEP-CST-REQ-038",
  "GAEP-CST-REQ-040",
  "GAEP-CST-REQ-053",
  "GAEP-CST-REQ-055",
  "GAEP-CST-REQ-056",
  "GAEP-CST-REQ-058",
  "GAEP-CST-REQ-061",
  "GAEP-CST-REQ-064",
  "GAEP-CWC-REQ-003",
  "GAEP-CWC-REQ-004",
  "GAEP-CWC-REQ-011",
  "GAEP-CWC-REQ-012",
  "GAEP-CWC-REQ-015",
  "GAEP-CWC-REQ-016",
  "GAEP-CWC-REQ-017",
  "GAEP-CWC-REQ-018",
  "GAEP-CWC-REQ-019",
  "GAEP-CWC-REQ-020",
  "GAEP-CWC-REQ-021",
  "GAEP-CWC-REQ-022",
  "GAEP-CWC-REQ-023",
  "GAEP-CWC-REQ-024",
  "GAEP-CWC-REQ-025",
  "GAEP-CWC-REQ-027",
  "GAEP-CWC-REQ-028",
  "GAEP-PROD-REQ-001",
  "GAEP-PROD-REQ-003",
  "GAEP-PROD-REQ-004",
  "GAEP-PROD-REQ-005",
  "GAEP-PROD-REQ-009",
  "GAEP-PROD-REQ-010",
  "GAEP-PROD-REQ-011",
  "GAEP-PROD-REQ-012",
  "GAEP-REPO-REQ-002",
  "GAEP-REPO-REQ-004",
  "GAEP-REPO-REQ-005",
  "GAEP-REPO-REQ-006",
  "GAEP-REPO-REQ-007",
  "GAEP-REPO-REQ-008",
  "GAEP-RESVER-REQ-001",
  "GAEP-RESVER-REQ-002",
  "GAEP-RESVER-REQ-003",
  "GAEP-RESVER-REQ-004",
  "GAEP-RESVER-REQ-005",
  "GAEP-RESVER-REQ-006",
  "GAEP-RESVER-REQ-007",
  "GAEP-RESVER-REQ-008",
  "GAEP-RESVER-REQ-009",
  "GAEP-RESVER-REQ-010",
  "GAEP-RESVER-REQ-013",
  "GAEP-RESVER-REQ-015",
  "GAEP-TPS-REQ-002",
  "GAEP-TPS-REQ-005",
  "GAEP-TPS-REQ-009",
  "GAEP-TPS-REQ-010",
  "GAEP-TPS-REQ-024",
] as const

const exactHandoffSubjectReferenceSchema = z.object({
  recordKind: z.string().trim().min(2).max(160),
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

const p5HandoffItemSchema = z.object({
  outputKind: p0P4ReadinessOutputKindSchema,
  applicability: z.enum(["applicable", "not-applicable-candidate", "unresolved"]),
  subjects: z.array(exactHandoffSubjectReferenceSchema).max(512)
    .refine((entries) => unique(entries.map((entry) => `${entry.recordKind}:${entry.recordId}:${entry.revision}`)), "Handoff subjects must be unique")
    .refine((entries) => canonical(entries.map((entry) => `${entry.recordKind}:${entry.recordId}:${String(entry.revision).padStart(12, "0")}`)), "Handoff subjects must use canonical ordering"),
  disposition: z.enum(["included", "omitted-not-applicable", "reference-only", "unresolved"]),
  representation: z.enum(["bounded-summary", "exact-reference", "omitted", "unresolved"]),
  semanticRelationship: z.enum(["exact", "lossy", "not-applicable", "unresolved"]),
  freshness: z.enum(["current", "stale", "unknown"]),
  consumerPurpose: longTextSchema,
  selectionRationale: longTextSchema,
  materialOmissions: canonicalTextListSchema,
  uncertainties: canonicalTextListSchema,
  limitations: canonicalTextListSchema,
  sources: exactSourceListSchema,
  authorityBoundary: z.literal(
    "handoff-item-transfers-candidate-context-only-and-does-not-transfer-source-ownership-approve-content-establish-readiness-or-authorize-action",
  ),
}).strict().superRefine((item, context) => {
  if ((item.applicability === "applicable") !== (item.subjects.length > 0)) {
    context.addIssue({ code: "custom", path: ["subjects"], message: "Applicable handoff items require exact subjects and other applicability states must not invent them" })
  }
  if (item.subjects.some((subject) => subject.recordKind !== p0P4ReadinessRecordKinds[item.outputKind])) {
    context.addIssue({ code: "custom", path: ["subjects"], message: "Handoff subject kind does not match its canonical output class" })
  }
  if (item.applicability === "not-applicable-candidate" &&
      (item.disposition !== "omitted-not-applicable" || item.representation !== "omitted" ||
       item.semanticRelationship !== "not-applicable")) {
    context.addIssue({ code: "custom", path: ["disposition"], message: "Candidate not-applicable handoff items must remain explicitly omitted" })
  }
  if (item.applicability === "unresolved" &&
      (item.disposition !== "unresolved" || item.representation !== "unresolved" ||
       item.semanticRelationship !== "unresolved")) {
    context.addIssue({ code: "custom", path: ["disposition"], message: "Unresolved applicability must remain unresolved in the handoff" })
  }
  if (item.applicability === "applicable" && !["included", "reference-only"].includes(item.disposition)) {
    context.addIssue({ code: "custom", path: ["disposition"], message: "Applicable handoff items must be included or transferred by exact reference" })
  }
  if (item.semanticRelationship === "lossy" && item.materialOmissions.length === 0) {
    context.addIssue({ code: "custom", path: ["materialOmissions"], message: "Lossy handoff transformations must disclose material omissions" })
  }
  if (item.representation === "bounded-summary" && item.semanticRelationship !== "lossy") {
    context.addIssue({ code: "custom", path: ["semanticRelationship"], message: "A bounded summary must remain explicitly lossy" })
  }
  if (item.representation === "exact-reference" && item.semanticRelationship !== "exact") {
    context.addIssue({ code: "custom", path: ["semanticRelationship"], message: "An exact-reference representation must preserve exact semantics" })
  }
})

const p5HandoffRequirementCoverageSchema = z.object({
  requirementId: z.enum(p5HandoffRequirementIds),
  state: z.enum(["covered-candidate", "not-applicable-candidate", "unresolved"]),
  itemKinds: canonicalArray(p0P4ReadinessOutputKindSchema, p0P4ReadinessOutputKinds.length),
  basis: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

const p5HandoffPackageInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  objective: longTextSchema,
  scope: longTextSchema,
  readinessGate: exactP0P4ReadinessGateReferenceSchema,
  readinessStatusDigest: digestSchema,
  readinessResult: z.enum(["blocked", "conditionally-passed", "failed", "incomplete", "not-assessed", "passed"]),
  target: z.object({
    phase: z.literal("p5-experience-and-figma"),
    capability: z.literal("experience-design"),
    audience: z.object({ kind: z.enum(["role", "team"]), id: identifierSchema }).strict(),
    deliveryMode: z.enum(["disconnected", "governed-figma", "repository"]),
  }).strict(),
  items: z.array(p5HandoffItemSchema).length(p0P4ReadinessOutputKinds.length)
    .refine((entries) => unique(entries.map((entry) => entry.outputKind)), "P5 handoff items must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.outputKind)), "P5 handoff items must use canonical ordering"),
  requirementCoverage: z.array(p5HandoffRequirementCoverageSchema).length(p5HandoffRequirementIds.length)
    .refine((entries) => unique(entries.map((entry) => entry.requirementId)), "P5 handoff requirement coverage must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.requirementId)), "P5 handoff requirement coverage must use canonical ID ordering"),
  assumptions: canonicalTextListSchema,
  unresolvedQuestions: canonicalTextListSchema,
  conflicts: canonicalTextListSchema,
  limitations: requiredCanonicalTextListSchema,
  nextActions: requiredCanonicalTextListSchema,
  transferState: z.enum(["draft", "held", "ready-for-human-review"]),
  acknowledgementState: z.literal("not-established"),
  sourceOwnershipState: z.literal("retained"),
  transferAuthorityState: z.literal("not-established"),
  p5EntryAuthorityState: z.literal("not-established"),
}).strict().superRefine((handoff, context) => {
  const expectedKinds = [...p0P4ReadinessOutputKinds].sort((left, right) => left.localeCompare(right))
  if (handoff.items.some((entry, index) => entry.outputKind !== expectedKinds[index])) {
    context.addIssue({ code: "custom", path: ["items"], message: "P5 handoff items must contain the complete P0-P4 output catalog" })
  }
  const expectedRequirements = [...p5HandoffRequirementIds].sort((left, right) => left.localeCompare(right))
  if (handoff.requirementCoverage.some((entry, index) => entry.requirementId !== expectedRequirements[index])) {
    context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must contain the complete P5 Handoff Package catalog" })
  }
  const hasReviewGap = handoff.readinessResult !== "passed" ||
    handoff.items.some((item) => item.applicability === "unresolved" ||
      (item.applicability === "applicable" && item.freshness !== "current")) ||
    handoff.requirementCoverage.some((entry) => entry.state === "unresolved") ||
    handoff.unresolvedQuestions.length > 0 || handoff.conflicts.length > 0
  if (handoff.transferState === "ready-for-human-review" && hasReviewGap) {
    context.addIssue({ code: "custom", path: ["transferState"], message: "A P5 handoff cannot be ready for human review while declared readiness, freshness, applicability, requirement, question, or conflict gaps remain" })
  }
})

export const p5HandoffPackageInputSchema = rejectSecrets(p5HandoffPackageInputBaseSchema)

export const p5HandoffPackageSchema = p5HandoffPackageInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("p5-handoff-package-candidate"),
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
    "p5-handoff-package-is-candidate-context-and-does-not-transfer-source-ownership-establish-acknowledgement-approve-design-authorize-p5-entry-or-authorize-action",
  ),
}).strict().superRefine((handoff, context) => {
  if ((handoff.revision === 1) !== (handoff.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only P5 Handoff Package revisions after revision one require an exact predecessor digest" })
  }
})

export const exactP5HandoffPackageReferenceSchema = z.object({
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

export const p5HandoffPackageStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("p5-handoff-package-status"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  handoff: exactP5HandoffPackageReferenceSchema.optional(),
  itemCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
  includedItemCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
  referenceOnlyItemCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
  omittedNotApplicableItemCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
  unresolvedItemCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
  staleOrUnknownItemCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
  lossyTransformationCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
  unresolvedRequirementCount: z.number().int().nonnegative().max(p5HandoffRequirementIds.length),
  conflictCount: z.number().int().nonnegative().max(512),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  readinessResult: z.enum(["blocked", "conditionally-passed", "failed", "incomplete", "not-assessed", "passed"]),
  transferState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  handoffBoundary: z.literal("handoff-transfers-exact-candidate-context-not-source-ownership-or-authority"),
  authorityBoundary: z.literal(
    "p5-handoff-package-status-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-or-action-authority",
  ),
}).strict().superRefine((status, context) => {
  if (status.includedItemCount + status.referenceOnlyItemCount + status.omittedNotApplicableItemCount +
      status.unresolvedItemCount !== status.itemCount) {
    context.addIssue({ code: "custom", message: "P5 handoff disposition counts must equal the item total" })
  }
  const gapCount = status.unresolvedItemCount + status.staleOrUnknownItemCount + status.unresolvedRequirementCount +
    status.conflictCount + status.unresolvedQuestionCount + status.staleBindingCount + status.staleSourceReferenceCount
  if (status.state === "complete-for-review" &&
      (gapCount > 0 || status.readinessResult !== "passed" || status.transferState !== "ready-for-human-review" || status.reasons.length > 0)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires a current passed evaluation, review-ready transfer state, and no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "An attention-required P5 handoff must expose reasons" })
  }
  if (!status.handoff && status.state !== "attention-required") {
    context.addIssue({ code: "custom", path: ["handoff"], message: "A P5 handoff status cannot be complete without an exact candidate record" })
  }
})

export const p5HandoffPackageProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("p5-handoff-package-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: p5HandoffPackageStatusSchema,
  handoff: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    membershipDigest: digestSchema,
    state: z.literal("candidate"),
    readinessStatusDigest: digestSchema,
    itemCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
    requirementCount: z.number().int().nonnegative().max(p5HandoffRequirementIds.length),
    deliveryMode: z.enum(["disconnected", "governed-figma", "repository"]),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-identities-counts-statuses-and-digests-only-not-item-content-summaries-omissions-uncertainties-source-content-personal-data-secrets-credentials-or-destinations",
  ),
  authorityBoundary: z.literal(
    "p5-handoff-package-projection-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-write-or-action-authority",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId ||
      projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId ||
      projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "P5 Handoff Package projection must bind the exact Product and Initiative revisions" })
  }
})

export type P5HandoffPackageInput = z.infer<typeof p5HandoffPackageInputSchema>
export type P5HandoffPackage = z.infer<typeof p5HandoffPackageSchema>
export type ExactP5HandoffPackageReference = z.infer<typeof exactP5HandoffPackageReferenceSchema>
export type P5HandoffPackageStatus = z.infer<typeof p5HandoffPackageStatusSchema>
export type P5HandoffPackageProjection = z.infer<typeof p5HandoffPackageProjectionSchema>
