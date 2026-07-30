import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { exactImplementationUnitModelReferenceSchema } from "./implementation-unit-model.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactTechnologyProfileReferenceSchema } from "./technology-profile.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function canonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Boilerplate Registry candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalTextListSchema = z.array(shortTextSchema).max(512)
  .refine(unique, "Values must be unique")
  .refine(canonical, "Values must use canonical lexical ordering")

const canonicalUuidListSchema = z.array(z.string().uuid()).max(10_000)
  .refine(unique, "References must be unique")
  .refine(canonical, "References must use canonical lexical ordering")

export const boilerplateEvidenceReferenceSchema = z.object({
  kind: z.enum([
    "architecture", "build", "decision", "deployment", "design-system", "evidence",
    "implementation-unit", "license-policy", "packaging", "provenance", "repository-observation",
    "security-policy", "template-observation", "technology-profile", "test",
  ]),
  sourceId: shortTextSchema,
  revision: z.number().int().positive(),
  digest: digestSchema,
  observationState: z.enum(["candidate-asserted", "observed-not-validated"]),
}).strict()

const boilerplateEvidenceListSchema = z.array(boilerplateEvidenceReferenceSchema).max(256).refine(
  (values) => unique(values.map((value) => `${value.kind}:${value.sourceId}:${value.revision}:${value.digest}`)),
  "Boilerplate evidence references must be unique",
)

export const boilerplateKindSchema = z.enum([
  "client-template", "code-foundation", "deployment-template", "design-system", "infrastructure-template",
  "library-template", "project-template", "reference-implementation", "service-template", "starter-repository",
  "test-harness", "other",
])

export const boilerplateRegistryEntrySchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(10_000),
  canonicalName: z.string().trim().min(1).max(240),
  kind: boilerplateKindSchema,
  sourceKind: z.enum([
    "artifact-registry", "local-repository", "organization-repository", "package-registry",
    "template-catalog", "other",
  ]),
  sourceReference: z.string().trim().min(1).max(2_000),
  versionCandidate: z.string().trim().min(1).max(240),
  versionState: z.enum(["exact-candidate", "range-candidate", "unresolved"]),
  applicabilityState: z.enum(["candidate-mandatory", "candidate-optional", "candidate-preferred", "not-assessed"]),
  availabilityState: z.enum(["candidate-available", "candidate-inaccessible", "candidate-missing", "not-assessed"]),
  integrityState: z.enum(["candidate-verified", "candidate-mismatch", "not-assessed"]),
  provenanceState: z.enum(["candidate-traceable", "candidate-unverified", "not-assessed"]),
  supportState: z.enum(["candidate-supported", "candidate-unsupported", "not-assessed", "unknown"]),
  lifecycleState: z.enum(["active", "deprecated", "end-of-life", "maintenance", "unknown"]),
  technologyCompatibilityState: z.enum(["candidate-compatible", "candidate-conflict", "not-assessed"]),
  architectureCompatibilityState: z.enum(["candidate-compatible", "candidate-conflict", "not-assessed"]),
  licenseState: z.enum(["candidate-allowed", "candidate-prohibited", "candidate-review-required", "not-assessed"]),
  securityPolicyState: z.enum([
    "candidate-conformant", "candidate-nonconformant", "candidate-review-required", "not-assessed",
  ]),
  exceptionState: z.enum(["candidate-required", "not-required-candidate", "not-assessed"]),
  applicableTechnologyProfileIds: canonicalUuidListSchema,
  applicableImplementationUnitIds: canonicalUuidListSchema,
  capabilities: canonicalTextListSchema,
  knownLimitations: canonicalTextListSchema,
  rationale: shortTextSchema,
  evidenceReferences: boilerplateEvidenceListSchema,
  assessedBy: humanActorSchema,
  assessedAt: z.string().datetime(),
}).strict()

const boilerplateRegistryInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  implementationUnitModel: exactImplementationUnitModelReferenceSchema,
  technologyProfile: exactTechnologyProfileReferenceSchema,
  architectureEvidenceReferences: boilerplateEvidenceListSchema,
  entries: z.array(boilerplateRegistryEntrySchema).min(1).max(10_000),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  organizationalDesignationState: z.literal("not-established"),
  endorsementApprovalState: z.literal("not-established"),
  supportCommitmentState: z.literal("not-established"),
  compatibilityTruthState: z.literal("not-established"),
  compatibilityCompletenessState: z.literal("not-established"),
  licensingApprovalState: z.literal("not-established"),
  securityApprovalState: z.literal("not-established"),
  exceptionWaiverState: z.literal("not-established"),
  selectionBindingState: z.literal("not-established"),
  architectureBaselineDesignationState: z.literal("not-established"),
  implementationReadinessState: z.literal("not-established"),
  implementationCompletenessState: z.literal("not-established"),
  assignmentExecutionState: z.literal("not-established"),
  acceptanceDecisionState: z.literal("not-established"),
  mergeReadinessState: z.literal("not-established"),
  releaseReadinessState: z.literal("not-established"),
  deploymentReadinessState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  const entryIds = candidate.entries.map((entry) => entry.id)
  if (!unique(entryIds)) context.addIssue({ code: "custom", path: ["entries"], message: "Boilerplate entry identities must be unique" })
  for (const [index, entry] of candidate.entries.entries()) {
    if (entry.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["entries", index, "ordinal"], message: "Boilerplate entries must use contiguous canonical ordinal ordering" })
  }
  if (candidate.reviewState === "ready-for-human-review") {
    const incomplete = candidate.entries.some((entry) =>
      entry.versionState !== "exact-candidate" || entry.applicabilityState === "not-assessed" ||
      entry.availabilityState !== "candidate-available" || entry.integrityState !== "candidate-verified" ||
      entry.provenanceState !== "candidate-traceable" || entry.supportState !== "candidate-supported" ||
      ["deprecated", "end-of-life", "unknown"].includes(entry.lifecycleState) ||
      entry.technologyCompatibilityState !== "candidate-compatible" ||
      entry.architectureCompatibilityState !== "candidate-compatible" ||
      entry.licenseState !== "candidate-allowed" || entry.securityPolicyState !== "candidate-conformant" ||
      entry.exceptionState !== "not-required-candidate" || entry.evidenceReferences.length === 0)
    if (candidate.architectureEvidenceReferences.length === 0 || candidate.unresolvedQuestions.length > 0 || incomplete) {
      context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready Boilerplate Registry requires architecture evidence, exact available integrity-verified traceable supported compatible policy-safe evidence-backed entries, and no unresolved questions" })
    }
  }
})

export const boilerplateRegistryInputSchema = rejectSecrets(boilerplateRegistryInputBaseSchema)

export const boilerplateRegistrySchema = boilerplateRegistryInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("boilerplate-registry-candidate"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  entryCatalogDigest: digestSchema,
  sourceCatalogDigest: digestSchema,
  compatibilityAssessmentReceiptDigest: digestSchema,
  assessmentReceiptDigest: digestSchema,
  predecessorDigest: digestSchema.optional(),
  state: z.literal("candidate"),
  createdBy: humanActorSchema,
  updatedBy: humanActorSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  authorityBoundary: z.literal("boilerplate-registry-is-a-versioned-candidate-and-does-not-establish-organizational-designation-endorsement-approval-support-commitment-compatibility-truth-or-completeness-licensing-or-security-approval-exception-waiver-selection-binding-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority"),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Boilerplate Registry revisions after revision one require an exact predecessor digest" })
  }
})

export const exactBoilerplateRegistryReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const boilerplateRegistryStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("boilerplate-registry-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactBoilerplateRegistryReferenceSchema.optional(),
  implementationUnitModel: exactImplementationUnitModelReferenceSchema.optional(),
  technologyProfile: exactTechnologyProfileReferenceSchema.optional(),
  entryCount: z.number().int().nonnegative().max(10_000),
  exactVersionCandidateCount: z.number().int().nonnegative().max(10_000),
  rangeVersionCandidateCount: z.number().int().nonnegative().max(10_000),
  unresolvedVersionCount: z.number().int().nonnegative().max(10_000),
  mandatoryCandidateCount: z.number().int().nonnegative().max(10_000),
  missingEvidenceCount: z.number().int().nonnegative().max(10_000),
  unavailableEntryCount: z.number().int().nonnegative().max(10_000),
  integrityMismatchCount: z.number().int().nonnegative().max(10_000),
  provenanceGapCount: z.number().int().nonnegative().max(10_000),
  unsupportedEntryCount: z.number().int().nonnegative().max(10_000),
  lifecycleRiskCount: z.number().int().nonnegative().max(10_000),
  technologyConflictCount: z.number().int().nonnegative().max(10_000),
  architectureConflictCount: z.number().int().nonnegative().max(10_000),
  licenseReviewRequiredCount: z.number().int().nonnegative().max(10_000),
  licenseProhibitedCount: z.number().int().nonnegative().max(10_000),
  securityReviewRequiredCount: z.number().int().nonnegative().max(10_000),
  securityNonconformantCount: z.number().int().nonnegative().max(10_000),
  exceptionCandidateCount: z.number().int().nonnegative().max(10_000),
  staleBindingCount: z.number().int().nonnegative().max(1),
  staleImplementationUnitModelCount: z.number().int().nonnegative().max(1),
  staleTechnologyProfileCount: z.number().int().nonnegative().max(1),
  invalidRegistryCount: z.number().int().nonnegative().max(1),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "candidate-complete"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal("boilerplate-registry-status-is-observational-and-does-not-establish-organizational-designation-endorsement-approval-support-commitment-compatibility-truth-or-completeness-licensing-or-security-approval-exception-waiver-selection-binding-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority"),
}).strict().superRefine((status, context) => {
  if (status.exactVersionCandidateCount + status.rangeVersionCandidateCount + status.unresolvedVersionCount !== status.entryCount) {
    context.addIssue({ code: "custom", path: ["entryCount"], message: "Boilerplate version-state counts must reconcile" })
  }
  const gaps = status.rangeVersionCandidateCount + status.unresolvedVersionCount + status.missingEvidenceCount +
    status.unavailableEntryCount + status.integrityMismatchCount + status.provenanceGapCount +
    status.unsupportedEntryCount + status.lifecycleRiskCount + status.technologyConflictCount +
    status.architectureConflictCount + status.licenseReviewRequiredCount + status.licenseProhibitedCount +
    status.securityReviewRequiredCount + status.securityNonconformantCount + status.exceptionCandidateCount +
    status.staleBindingCount + status.staleImplementationUnitModelCount + status.staleTechnologyProfileCount +
    status.invalidRegistryCount + status.unresolvedQuestionCount
  if (status.state === "candidate-complete" &&
      (gaps > 0 || !status.candidate || !status.implementationUnitModel || !status.technologyProfile ||
       status.entryCount < 1 || status.reviewState !== "ready-for-human-review" || status.reasons.length > 0)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Candidate-complete Boilerplate Registry requires exact current dependencies and exact available integrity-verified traceable supported compatible policy-safe entries with no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Boilerplate Registry status must expose reasons" })
  }
})

export const boilerplateRegistryProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("boilerplate-registry-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  }).strict(),
  status: boilerplateRegistryStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.literal("candidate"), entryCatalogDigest: digestSchema, sourceCatalogDigest: digestSchema,
    compatibilityAssessmentReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    entryCount: z.number().int().nonnegative().max(10_000), mandatoryCandidateCount: z.number().int().nonnegative().max(10_000),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal("projection-contains-record-identities-counts-statuses-and-entry-source-compatibility-assessment-snapshot-digests-only-not-boilerplate-names-locators-versions-capabilities-limitations-evidence-rationale-technology-unit-architecture-repository-template-license-security-policy-personal-data-secrets-credentials-or-machine-paths"),
  authorityBoundary: z.literal("boilerplate-registry-projection-is-read-only-and-does-not-establish-organizational-designation-endorsement-approval-support-commitment-compatibility-truth-or-completeness-licensing-or-security-approval-exception-waiver-selection-binding-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority"),
  snapshotDigest: digestSchema,
}).strict()

export type BoilerplateRegistryInput = z.infer<typeof boilerplateRegistryInputSchema>
export type BoilerplateRegistry = z.infer<typeof boilerplateRegistrySchema>
export type BoilerplateRegistryStatus = z.infer<typeof boilerplateRegistryStatusSchema>
export type BoilerplateRegistryProjection = z.infer<typeof boilerplateRegistryProjectionSchema>
