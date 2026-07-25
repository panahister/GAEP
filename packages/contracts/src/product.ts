import { z } from "zod"

export const productProfileSchema = z.enum([
  "software",
  "saas",
  "ai-enabled",
  "integration",
  "security-sensitive",
  "data-sensitive",
  "internal-tool",
  "mobile",
])

export const productSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  kind: z.literal("product"),
  revision: z.number().int().positive().optional(),
  name: z.string().trim().min(2).max(160),
  summary: z.string().trim().min(4).max(2_000),
  problem: z.string().trim().min(10).max(10_000),
  affectedUsers: z.string().trim().min(2).max(5_000),
  desiredOutcome: z.string().trim().min(10).max(10_000),
  successSignals: z.array(z.string().trim().min(2).max(2_000)).min(1).max(256),
  firstWorkflow: z.string().trim().min(4).max(10_000),
  exclusions: z.array(z.string().trim().min(2).max(2_000)).max(256).default([]),
  profile: productProfileSchema,
  lifecycleState: z.enum(["active", "paused", "retired"]).default("active"),
  currentDesign: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  }).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

const initiativeBoundedTextSchema = z.string().trim().min(2).max(2_000)
const initiativeDigestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const initiativeIdentifierSchema = z.string().regex(/^[a-z][a-z0-9.-]{0,127}$/)

export const initiativeTypeSchema = z.enum([
  "product",
  "platform",
  "product-increment",
  "feature",
  "epic",
  "backlog-item",
  "service",
  "module",
  "client-application",
  "mobile-application",
  "api",
  "integration",
  "migration",
  "modernization",
  "refactoring",
  "technical-debt-remediation",
  "security-remediation",
  "infrastructure",
  "devops",
  "observability",
  "library",
  "sdk",
  "cli",
  "worker",
  "event-processor",
  "defect-fix",
  "experiment",
  "research",
  "data-capability",
  "ai-capability",
])

export const initiativeClassificationInputSchema = z.object({
  primaryType: initiativeTypeSchema,
  secondaryTypes: z.array(initiativeTypeSchema).max(29),
  systemState: z.enum(["greenfield", "brownfield", "mixed", "unknown"]),
  changePosture: z.enum(["new", "existing", "replacement", "modernization", "migration", "retirement", "mixed"]),
  motivations: z.array(z.enum(["business-driven", "technical", "regulatory", "operational", "security-driven", "mixed"]))
    .min(1).max(6),
  characteristics: z.object({
    userInterface: z.enum(["ui-bearing", "non-ui", "unknown"]),
    data: z.enum(["data-bearing", "stateless", "unknown"]),
    integration: z.enum(["integration-heavy", "isolated", "mixed", "unknown"]),
    interactionModes: z.array(z.enum(["synchronous", "asynchronous", "batch", "streaming", "interactive", "mixed"]))
      .min(1).max(6),
    exposure: z.enum(["internal", "partner", "public", "mixed", "unknown"]),
  }).strict(),
  regulated: z.boolean(),
  policyDomains: z.array(initiativeIdentifierSchema).max(64),
  sensitivities: z.array(z.enum(["security", "privacy", "data", "safety", "financial", "operational", "none", "unknown"]))
    .min(1).max(8),
  expectedLifetime: z.enum(["short-lived", "medium-term", "long-lived", "indefinite", "unknown"]),
  maintenanceHorizon: initiativeBoundedTextSchema,
  risk: z.object({
    blastRadius: z.enum(["localized", "multi-unit", "organization", "external", "unknown"]),
    reversibility: z.enum(["reversible", "partially-reversible", "irreversible", "unknown"]),
    urgency: z.enum(["low", "normal", "high", "critical", "unknown"]),
    costOfFailure: z.enum(["low", "medium", "high", "critical", "unknown"]),
  }).strict(),
  dependencies: z.array(initiativeBoundedTextSchema).max(256),
  affectedAssets: z.array(initiativeBoundedTextSchema).max(256),
  owner: initiativeBoundedTextSchema,
  accountableAuthority: initiativeBoundedTextSchema,
  confidence: z.object({
    level: z.enum(["low", "medium", "high"]),
    basis: initiativeBoundedTextSchema,
  }).strict(),
  evidence: z.array(z.object({
    kind: z.enum(["rule", "policy", "evidence", "requirement", "dependency", "human-decision"]),
    reference: initiativeBoundedTextSchema,
    digest: initiativeDigestSchema.optional(),
  }).strict()).min(1).max(256),
  unresolvedQuestions: z.array(initiativeBoundedTextSchema).max(256),
  rationale: z.string().trim().min(10).max(10_000),
}).strict().superRefine((classification, context) => {
  if (new Set(classification.secondaryTypes).size !== classification.secondaryTypes.length) {
    context.addIssue({ code: "custom", path: ["secondaryTypes"], message: "Secondary Initiative types must be unique" })
  }
  if (classification.secondaryTypes.includes(classification.primaryType)) {
    context.addIssue({ code: "custom", path: ["secondaryTypes"], message: "The primary Initiative type cannot also be secondary" })
  }
  for (const [path, values] of [
    [["motivations"], classification.motivations],
    [["characteristics", "interactionModes"], classification.characteristics.interactionModes],
    [["policyDomains"], classification.policyDomains],
    [["sensitivities"], classification.sensitivities],
    [["dependencies"], classification.dependencies],
    [["affectedAssets"], classification.affectedAssets],
  ] as const) {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: "custom", path: [...path], message: "Initiative classification lists must be unique" })
    }
  }
  if (classification.sensitivities.includes("none") && classification.sensitivities.length > 1) {
    context.addIssue({ code: "custom", path: ["sensitivities"], message: "Sensitivity 'none' cannot be combined with another sensitivity" })
  }
  const evidenceKeys = classification.evidence.map((entry) => `${entry.kind}:${entry.reference}:${entry.digest ?? ""}`)
  if (new Set(evidenceKeys).size !== evidenceKeys.length) {
    context.addIssue({ code: "custom", path: ["evidence"], message: "Initiative classification evidence must be unique" })
  }
})

export const initiativeClassificationSchema = initiativeClassificationInputSchema.safeExtend({
  productProfile: productProfileSchema,
  productRevision: z.number().int().positive(),
  productDigest: initiativeDigestSchema,
  classifiedBy: z.object({ kind: z.literal("human"), id: initiativeBoundedTextSchema }).strict(),
  classifiedAt: z.string().datetime(),
  authorityBoundary: z.literal("classification-guides-profile-selection-and-does-not-grant-approval-or-action-authority"),
}).strict()

export const initiativeApplicabilityStatusSchema = z.enum([
  "required",
  "recommended",
  "optional",
  "not-applicable",
  "deferred",
  "conditionally-required",
  "already-satisfied",
  "reused",
  "blocked",
  "awaiting-human-decision",
])

export const initiativeApplicabilitySubjectSchema = z.object({
  type: z.enum(["phase", "activity", "artifact", "capability", "test-method", "test-level", "approval", "evidence-obligation"]),
  key: initiativeIdentifierSchema,
  label: initiativeBoundedTextSchema,
}).strict()

const initiativeRelatedRecordSchema = z.object({
  recordType: initiativeIdentifierSchema,
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: initiativeDigestSchema,
}).strict()

const initiativeApplicabilityApprovalSchema = z.object({
  state: z.enum(["not-required", "pending", "approved", "rejected"]),
  decidedBy: z.object({ kind: z.literal("human"), id: initiativeBoundedTextSchema }).strict().optional(),
  decidedAt: z.string().datetime().optional(),
  conditions: z.array(initiativeBoundedTextSchema).max(128),
}).strict().superRefine((approval, context) => {
  const decided = approval.state === "approved" || approval.state === "rejected"
  if (decided !== (approval.decidedBy !== undefined && approval.decidedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Approved or rejected applicability requires an attributable decision; other states forbid one" })
  }
})

export const initiativeApplicabilityDecisionInputSchema = z.object({
  subject: initiativeApplicabilitySubjectSchema,
  status: initiativeApplicabilityStatusSchema,
  rationale: z.string().trim().min(10).max(10_000),
  sources: z.array(z.object({
    kind: z.enum(["rule", "policy", "evidence", "requirement", "dependency", "human-decision"]),
    reference: initiativeBoundedTextSchema,
    digest: initiativeDigestSchema.optional(),
  }).strict()).min(1).max(256),
  owner: initiativeBoundedTextSchema,
  accountableApprover: initiativeBoundedTextSchema.optional(),
  dependencies: z.array(initiativeIdentifierSchema).max(256),
  conditions: z.array(initiativeBoundedTextSchema).max(256),
  reviewTriggers: z.array(initiativeBoundedTextSchema).min(1).max(256),
  approval: initiativeApplicabilityApprovalSchema,
  relatedRecords: z.array(initiativeRelatedRecordSchema).max(256),
  relatedImplementationUnits: z.array(initiativeIdentifierSchema).max(256),
}).strict().superRefine((decision, context) => {
  for (const [path, values] of [
    ["dependencies", decision.dependencies],
    ["conditions", decision.conditions],
    ["reviewTriggers", decision.reviewTriggers],
    ["relatedImplementationUnits", decision.relatedImplementationUnits],
  ] as const) {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: "custom", path: [path], message: "Applicability decision lists must be unique" })
    }
  }
  const sourceKeys = decision.sources.map((entry) => `${entry.kind}:${entry.reference}:${entry.digest ?? ""}`)
  if (new Set(sourceKeys).size !== sourceKeys.length) {
    context.addIssue({ code: "custom", path: ["sources"], message: "Applicability decision sources must be unique" })
  }
  const relatedKeys = decision.relatedRecords.map((entry) => `${entry.recordType}:${entry.recordId}:${entry.revision}`)
  if (new Set(relatedKeys).size !== relatedKeys.length) {
    context.addIssue({ code: "custom", path: ["relatedRecords"], message: "Applicability decision related records must be unique" })
  }
  if (["deferred", "conditionally-required", "blocked"].includes(decision.status) && decision.conditions.length === 0) {
    context.addIssue({ code: "custom", path: ["conditions"], message: "Deferred, conditional, and blocked applicability requires an explicit condition" })
  }
  if (["already-satisfied", "reused"].includes(decision.status) && decision.relatedRecords.length === 0) {
    context.addIssue({ code: "custom", path: ["relatedRecords"], message: "Satisfied or reused applicability requires an exact related record" })
  }
  if (decision.status === "awaiting-human-decision" && decision.approval.state !== "pending") {
    context.addIssue({ code: "custom", path: ["approval", "state"], message: "Awaiting-human applicability must retain a pending approval state" })
  }
})

export const initiativeApplicabilityDecisionSchema = initiativeApplicabilityDecisionInputSchema.safeExtend({
  id: z.string().uuid(),
  revision: z.number().int().positive(),
  initiativeRevision: z.number().int().positive(),
  decidedBy: z.object({ kind: z.literal("human"), id: initiativeBoundedTextSchema }).strict(),
  decidedAt: z.string().datetime(),
  authorityBoundary: z.literal("applicability-decision-does-not-grant-approval-readiness-or-action-authority"),
}).strict()

export const initiativeApplicabilityMatrixInputSchema = z.object({
  decisions: z.array(initiativeApplicabilityDecisionInputSchema).min(1).max(512),
  unresolvedSubjects: z.array(z.object({
    subject: initiativeApplicabilitySubjectSchema,
    reason: initiativeBoundedTextSchema,
    owner: initiativeBoundedTextSchema,
  }).strict()).max(512),
}).strict().superRefine((matrix, context) => {
  const decisionKeys = matrix.decisions.map((decision) => `${decision.subject.type}:${decision.subject.key}`)
  if (new Set(decisionKeys).size !== decisionKeys.length) {
    context.addIssue({ code: "custom", path: ["decisions"], message: "Applicability subjects must be decided at most once per matrix" })
  }
  const unresolvedKeys = matrix.unresolvedSubjects.map((entry) => `${entry.subject.type}:${entry.subject.key}`)
  if (new Set(unresolvedKeys).size !== unresolvedKeys.length) {
    context.addIssue({ code: "custom", path: ["unresolvedSubjects"], message: "Unresolved applicability subjects must be unique" })
  }
  if (unresolvedKeys.some((key) => decisionKeys.includes(key))) {
    context.addIssue({ code: "custom", path: ["unresolvedSubjects"], message: "An applicability subject cannot be both decided and unresolved" })
  }
})

export const initiativeApplicabilityMatrixSchema = initiativeApplicabilityMatrixInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("initiative-applicability-matrix"),
  decisions: z.array(initiativeApplicabilityDecisionSchema).min(1).max(512),
  revision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  productId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  classificationDigest: initiativeDigestSchema,
  state: z.enum(["current", "stale"]),
  invalidatedAt: z.string().datetime().optional(),
  invalidationReason: initiativeBoundedTextSchema.optional(),
  evaluatedBy: z.object({ kind: z.literal("human"), id: initiativeBoundedTextSchema }).strict(),
  evaluatedAt: z.string().datetime(),
  authorityBoundary: z.literal("applicability-matrix-does-not-grant-approval-readiness-or-action-authority"),
}).strict().superRefine((matrix, context) => {
  const invalidated = matrix.state === "stale"
  if (invalidated !== (matrix.invalidatedAt !== undefined && matrix.invalidationReason !== undefined)) {
    context.addIssue({ code: "custom", path: ["state"], message: "A stale applicability matrix requires exact invalidation metadata; a current matrix forbids it" })
  }
  for (const [index, decision] of matrix.decisions.entries()) {
    if (decision.initiativeRevision !== matrix.initiativeRevision) {
      context.addIssue({ code: "custom", path: ["decisions", index, "initiativeRevision"], message: "Applicability decisions must bind the matrix Initiative revision" })
    }
  }
})

export const initiativeEntryAssessmentSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("initiative-entry-assessment"),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  productDigest: initiativeDigestSchema,
  classification: z.object({
    status: z.enum(["missing", "current", "stale"]),
    digest: initiativeDigestSchema.optional(),
  }).strict(),
  applicability: z.object({
    status: z.enum(["missing", "current", "stale"]),
    matrixRevision: z.number().int().positive().optional(),
    digest: initiativeDigestSchema.optional(),
    decisionCount: z.number().int().nonnegative(),
    unresolvedSubjectCount: z.number().int().nonnegative(),
    pendingHumanDecisionCount: z.number().int().nonnegative(),
    blockedDecisionCount: z.number().int().nonnegative(),
    pendingApprovalCount: z.number().int().nonnegative(),
    rejectedApprovalCount: z.number().int().nonnegative(),
  }).strict(),
  state: z.enum(["ready", "attention-required", "blocked"]),
  reasons: z.array(initiativeBoundedTextSchema).max(256),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal("entry-assessment-is-read-only-and-does-not-grant-approval-readiness-or-action-authority"),
}).strict().superRefine((assessment, context) => {
  if ((assessment.classification.status === "missing") !== (assessment.classification.digest === undefined)) {
    context.addIssue({ code: "custom", path: ["classification", "digest"], message: "Only a present classification can carry a digest" })
  }
  const hasMatrixRevision = assessment.applicability.matrixRevision !== undefined
  const hasMatrixDigest = assessment.applicability.digest !== undefined
  if (hasMatrixRevision !== hasMatrixDigest || (assessment.applicability.status === "missing") === hasMatrixRevision) {
    context.addIssue({ code: "custom", path: ["applicability", "digest"], message: "Only a present applicability matrix can carry identity" })
  }
  if (assessment.state === "ready" && assessment.reasons.length > 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "A ready entry assessment cannot carry blockers or attention reasons" })
  }
  if (assessment.state !== "ready" && assessment.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "A non-ready entry assessment requires exact reasons" })
  }
})

export const initiativeSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  kind: z.literal("initiative"),
  revision: z.number().int().positive().optional(),
  productId: z.string().uuid(),
  title: z.string().trim().min(2).max(240),
  outcome: z.string().trim().min(4).max(5_000),
  scope: z.array(z.string().trim().min(2).max(2_000)).min(1).max(256),
  exclusions: z.array(z.string().trim().min(2).max(2_000)).max(256).default([]),
  classification: initiativeClassificationSchema.optional(),
  applicability: initiativeApplicabilityMatrixSchema.optional(),
  state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Product = z.infer<typeof productSchema>
export type Initiative = z.infer<typeof initiativeSchema>
export type InitiativeType = z.infer<typeof initiativeTypeSchema>
export type InitiativeClassificationInput = z.infer<typeof initiativeClassificationInputSchema>
export type InitiativeClassification = z.infer<typeof initiativeClassificationSchema>
export type InitiativeApplicabilityStatus = z.infer<typeof initiativeApplicabilityStatusSchema>
export type InitiativeApplicabilitySubject = z.infer<typeof initiativeApplicabilitySubjectSchema>
export type InitiativeApplicabilityDecisionInput = z.infer<typeof initiativeApplicabilityDecisionInputSchema>
export type InitiativeApplicabilityDecision = z.infer<typeof initiativeApplicabilityDecisionSchema>
export type InitiativeApplicabilityMatrixInput = z.infer<typeof initiativeApplicabilityMatrixInputSchema>
export type InitiativeApplicabilityMatrix = z.infer<typeof initiativeApplicabilityMatrixSchema>
export type InitiativeEntryAssessment = z.infer<typeof initiativeEntryAssessmentSchema>
