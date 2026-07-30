import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { exactDependencyMappingReferenceSchema } from "./dependency-mapping.js"
import { exactImplementationUnitModelReferenceSchema } from "./implementation-unit-model.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"

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
    message: "Portable Technology Profile candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalTextListSchema = z.array(shortTextSchema).max(512)
  .refine(unique, "Values must be unique")
  .refine(canonical, "Values must use canonical lexical ordering")

export const technologyEvidenceReferenceSchema = z.object({
  kind: z.enum([
    "architecture", "authorization", "data", "decision", "dependency-mapping", "event-integration",
    "evidence", "implementation-unit", "license-policy", "manifest-observation", "platform-policy",
    "process", "requirement", "risk", "security-policy", "toolchain-observation",
  ]),
  sourceId: shortTextSchema,
  revision: z.number().int().positive(),
  digest: digestSchema,
  observationState: z.enum(["candidate-asserted", "observed-not-validated"]),
}).strict()

const technologyEvidenceListSchema = z.array(technologyEvidenceReferenceSchema).max(256).refine(
  (values) => unique(values.map((value) => `${value.kind}:${value.sourceId}:${value.revision}:${value.digest}`)),
  "Technology evidence references must be unique",
)

export const technologyCategorySchema = z.enum([
  "build-tool", "cache", "communication", "database", "deployment-platform", "framework",
  "identity-platform", "infrastructure", "language", "library", "observability", "package-manager",
  "runtime", "search", "storage", "test-tool", "toolchain", "other",
])

export const technologyChoiceSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(10_000),
  category: technologyCategorySchema,
  canonicalName: z.string().trim().min(1).max(240),
  versionConstraint: z.string().trim().min(1).max(240),
  versionState: z.enum(["exact-candidate", "range-candidate", "unresolved"]),
  selectionState: z.enum(["candidate-selected", "not-assessed"]),
  registryStatus: z.enum([
    "candidate-approved", "candidate-exception", "candidate-experimental", "candidate-mandatory",
    "candidate-preferred", "candidate-prohibited", "candidate-supported", "not-assessed", "unregistered",
  ]),
  supportState: z.enum(["candidate-supported", "candidate-unsupported", "not-assessed", "unknown"]),
  lifecycleState: z.enum(["active", "deprecated", "end-of-life", "maintenance", "unknown"]),
  compatibilityState: z.enum(["candidate-compatible", "candidate-conflict", "not-assessed"]),
  licenseState: z.enum(["candidate-allowed", "candidate-prohibited", "candidate-review-required", "not-assessed"]),
  securityPolicyState: z.enum([
    "candidate-conformant", "candidate-nonconformant", "candidate-review-required", "not-assessed",
  ]),
  rationale: shortTextSchema,
  evidenceReferences: technologyEvidenceListSchema,
  assessedBy: humanActorSchema,
  assessedAt: z.string().datetime(),
}).strict()

export const technologyConstraintSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(10_000),
  kind: z.enum(["compatibility", "lifecycle", "licensing", "operational", "platform", "security", "support"]),
  requirement: shortTextSchema,
  disposition: z.enum(["advisory", "mandatory", "preferred"]),
  assessmentState: z.enum(["candidate-conflict", "candidate-satisfied", "not-assessed"]),
  evidenceReferences: technologyEvidenceListSchema,
  assessedBy: humanActorSchema,
  assessedAt: z.string().datetime(),
}).strict()

export const implementationUnitTechnologyProfileSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(10_000),
  implementationUnitId: z.string().uuid(),
  profileKind: z.enum(["client", "data", "deployment", "infrastructure", "integration", "module", "service", "workload"]),
  choices: z.array(technologyChoiceSchema).min(1).max(10_000),
  constraints: z.array(technologyConstraintSchema).max(10_000),
  assuranceObligations: canonicalTextListSchema,
  observabilityObligations: canonicalTextListSchema,
}).strict().superRefine((profile, context) => {
  const choiceIds = profile.choices.map((choice) => choice.id)
  const constraintIds = profile.constraints.map((constraint) => constraint.id)
  if (!unique(choiceIds)) context.addIssue({ code: "custom", path: ["choices"], message: "Technology choice identities must be unique" })
  if (!unique(constraintIds)) context.addIssue({ code: "custom", path: ["constraints"], message: "Technology constraint identities must be unique" })
  for (const [index, choice] of profile.choices.entries()) {
    if (choice.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["choices", index, "ordinal"], message: "Technology choices must use contiguous canonical ordinal ordering" })
  }
  for (const [index, constraint] of profile.constraints.entries()) {
    if (constraint.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["constraints", index, "ordinal"], message: "Technology constraints must use contiguous canonical ordinal ordering" })
  }
})

const technologyProfileInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  implementationUnitModel: exactImplementationUnitModelReferenceSchema,
  dependencyMapping: exactDependencyMappingReferenceSchema,
  architectureEvidenceReferences: technologyEvidenceListSchema,
  profiles: z.array(implementationUnitTechnologyProfileSchema).min(1).max(10_000),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  technologyApprovalState: z.literal("not-established"),
  supportCommitmentState: z.literal("not-established"),
  compatibilityTruthState: z.literal("not-established"),
  compatibilityCompletenessState: z.literal("not-established"),
  licensingApprovalState: z.literal("not-established"),
  securityApprovalState: z.literal("not-established"),
  exceptionWaiverState: z.literal("not-established"),
  architectureBaselineDesignationState: z.literal("not-established"),
  implementationReadinessState: z.literal("not-established"),
  implementationCompletenessState: z.literal("not-established"),
  assignmentExecutionState: z.literal("not-established"),
  approvalState: z.literal("not-established"),
  acceptanceDecisionState: z.literal("not-established"),
  mergeReadinessState: z.literal("not-established"),
  releaseReadinessState: z.literal("not-established"),
  deploymentReadinessState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  const unitIds = candidate.profiles.map((profile) => profile.implementationUnitId)
  const profileIds = candidate.profiles.map((profile) => profile.id)
  if (!unique(unitIds)) context.addIssue({ code: "custom", path: ["profiles"], message: "Each implementation unit may have only one Technology Profile" })
  if (!unique(profileIds)) context.addIssue({ code: "custom", path: ["profiles"], message: "Technology Profile identities must be unique" })
  for (const [index, profile] of candidate.profiles.entries()) {
    if (profile.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["profiles", index, "ordinal"], message: "Technology Profiles must use contiguous canonical ordinal ordering" })
  }
  const choiceIds = candidate.profiles.flatMap((profile) => profile.choices.map((choice) => choice.id))
  const constraintIds = candidate.profiles.flatMap((profile) => profile.constraints.map((constraint) => constraint.id))
  if (!unique(choiceIds)) context.addIssue({ code: "custom", path: ["profiles"], message: "Technology choice identities must be unique across the candidate" })
  if (!unique(constraintIds)) context.addIssue({ code: "custom", path: ["profiles"], message: "Technology constraint identities must be unique across the candidate" })
  if (candidate.reviewState === "ready-for-human-review") {
    const hasUnassessedChoice = candidate.profiles.some((profile) => profile.choices.some((choice) =>
      choice.versionState === "unresolved" || choice.selectionState === "not-assessed" ||
      choice.supportState === "not-assessed" || choice.supportState === "unknown" ||
      choice.compatibilityState === "not-assessed" || choice.licenseState === "not-assessed" ||
      choice.securityPolicyState === "not-assessed" || choice.lifecycleState === "unknown" ||
      choice.evidenceReferences.length === 0))
    const hasUnassessedConstraint = candidate.profiles.some((profile) => profile.constraints.some((constraint) =>
      constraint.assessmentState === "not-assessed" || constraint.evidenceReferences.length === 0))
    if (candidate.architectureEvidenceReferences.length === 0 || candidate.unresolvedQuestions.length > 0 ||
        hasUnassessedChoice || hasUnassessedConstraint) {
      context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready Technology Profile requires architecture evidence, assessed choices and constraints, evidence references, and no unresolved questions" })
    }
  }
})

export const technologyProfileInputSchema = rejectSecrets(technologyProfileInputBaseSchema)

export const technologyProfileSchema = technologyProfileInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("technology-profile-candidate"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  profileCatalogDigest: digestSchema,
  selectionCatalogDigest: digestSchema,
  compatibilityAssessmentReceiptDigest: digestSchema,
  assessmentReceiptDigest: digestSchema,
  predecessorDigest: digestSchema.optional(),
  state: z.literal("candidate"),
  createdBy: humanActorSchema,
  updatedBy: humanActorSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  authorityBoundary: z.literal("technology-profile-is-a-versioned-candidate-and-does-not-establish-technology-approval-support-commitment-compatibility-truth-or-completeness-licensing-or-security-approval-exception-waiver-authority-architecture-baseline-designation-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority"),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Technology Profile revisions after revision one require an exact predecessor digest" })
  }
})

export const exactTechnologyProfileReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const technologyProfileStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("technology-profile-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactTechnologyProfileReferenceSchema.optional(),
  implementationUnitModel: exactImplementationUnitModelReferenceSchema.optional(),
  dependencyMapping: exactDependencyMappingReferenceSchema.optional(),
  unitProfileCount: z.number().int().nonnegative().max(10_000),
  technologyChoiceCount: z.number().int().nonnegative().max(100_000_000),
  exactVersionCandidateCount: z.number().int().nonnegative().max(100_000_000),
  rangeVersionCandidateCount: z.number().int().nonnegative().max(100_000_000),
  unresolvedVersionCount: z.number().int().nonnegative().max(100_000_000),
  constraintCount: z.number().int().nonnegative().max(100_000_000),
  missingProfileCount: z.number().int().nonnegative().max(10_000),
  invalidProfileCount: z.number().int().nonnegative().max(10_000),
  missingEvidenceCount: z.number().int().nonnegative().max(100_000_000),
  unsupportedChoiceCount: z.number().int().nonnegative().max(100_000_000),
  lifecycleRiskCount: z.number().int().nonnegative().max(100_000_000),
  compatibilityConflictCount: z.number().int().nonnegative().max(100_000_000),
  licenseReviewRequiredCount: z.number().int().nonnegative().max(100_000_000),
  licenseProhibitedCount: z.number().int().nonnegative().max(100_000_000),
  securityReviewRequiredCount: z.number().int().nonnegative().max(100_000_000),
  securityNonconformantCount: z.number().int().nonnegative().max(100_000_000),
  exceptionCandidateCount: z.number().int().nonnegative().max(100_000_000),
  constraintConflictCount: z.number().int().nonnegative().max(100_000_000),
  staleBindingCount: z.number().int().nonnegative().max(1),
  staleImplementationUnitModelCount: z.number().int().nonnegative().max(1),
  staleDependencyMappingCount: z.number().int().nonnegative().max(1),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "candidate-complete"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal("technology-profile-status-is-observational-and-does-not-establish-technology-approval-support-commitment-compatibility-truth-or-completeness-licensing-or-security-approval-exception-waiver-authority-architecture-baseline-designation-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority"),
}).strict().superRefine((status, context) => {
  if (status.exactVersionCandidateCount + status.rangeVersionCandidateCount + status.unresolvedVersionCount !== status.technologyChoiceCount) {
    context.addIssue({ code: "custom", path: ["technologyChoiceCount"], message: "Technology version-state counts must reconcile" })
  }
  const gaps = status.missingProfileCount + status.invalidProfileCount + status.missingEvidenceCount +
    status.unsupportedChoiceCount + status.lifecycleRiskCount + status.compatibilityConflictCount +
    status.licenseReviewRequiredCount + status.licenseProhibitedCount + status.securityReviewRequiredCount +
    status.securityNonconformantCount + status.exceptionCandidateCount + status.constraintConflictCount +
    status.staleBindingCount + status.staleImplementationUnitModelCount + status.staleDependencyMappingCount +
    status.unresolvedVersionCount + status.unresolvedQuestionCount
  if (status.state === "candidate-complete" &&
      (gaps > 0 || !status.candidate || !status.implementationUnitModel || !status.dependencyMapping ||
       status.reviewState !== "ready-for-human-review" || status.unitProfileCount < 1 ||
       status.technologyChoiceCount < 1 || status.reasons.length > 0)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Candidate-complete Technology Profile requires exact current dependencies, complete unit coverage, assessed evidence-backed technology choices and constraints, and no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Technology Profile status must expose reasons" })
  }
})

export const technologyProfileProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("technology-profile-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  }).strict(),
  status: technologyProfileStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.literal("candidate"), profileCatalogDigest: digestSchema, selectionCatalogDigest: digestSchema,
    compatibilityAssessmentReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    unitProfileCount: z.number().int().nonnegative().max(10_000),
    technologyChoiceCount: z.number().int().nonnegative().max(100_000_000),
    constraintCount: z.number().int().nonnegative().max(100_000_000),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal("projection-contains-record-identities-counts-statuses-and-profile-selection-compatibility-assessment-snapshot-digests-only-not-technology-names-versions-constraints-evidence-rationale-unit-architecture-repository-toolchain-license-security-policy-personal-data-secrets-credentials-or-machine-paths"),
  authorityBoundary: z.literal("technology-profile-projection-is-read-only-and-does-not-establish-technology-approval-support-commitment-compatibility-truth-or-completeness-licensing-or-security-approval-exception-waiver-authority-architecture-baseline-designation-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority"),
  snapshotDigest: digestSchema,
}).strict()

export type TechnologyProfileInput = z.infer<typeof technologyProfileInputSchema>
export type TechnologyProfile = z.infer<typeof technologyProfileSchema>
export type TechnologyProfileStatus = z.infer<typeof technologyProfileStatusSchema>
export type TechnologyProfileProjection = z.infer<typeof technologyProfileProjectionSchema>
