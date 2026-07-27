import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { exactEndToEndTraceabilityReferenceSchema } from "./end-to-end-traceability.js"
import { exactEvidenceRegistryReferenceSchema } from "./evidence-registry.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactSourceReferenceSchema } from "./source-governance.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const longTextSchema = z.string().trim().min(10).max(20_000)
const actorSchema = z.object({ kind: z.enum(["agent", "human", "system"]), id: shortTextSchema }).strict()
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

const canonicalIdentifierListSchema = canonicalArray(identifierSchema)
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
    message: "Portable P0-P4 Readiness Gate candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const p0P4ReadinessRequirementIds = [
  "GAEP-CAE-REQ-003",
  "GAEP-CAE-REQ-006",
  "GAEP-CAE-REQ-010",
  "GAEP-CAE-REQ-013",
  "GAEP-CAE-REQ-014",
  "GAEP-CAE-REQ-016",
  "GAEP-CAE-REQ-017",
  "GAEP-CAE-REQ-018",
  "GAEP-CAE-REQ-019",
  "GAEP-CAE-REQ-020",
  "GAEP-CAE-REQ-024",
  "GAEP-CST-REQ-004",
  "GAEP-CST-REQ-007",
  "GAEP-CST-REQ-008",
  "GAEP-CST-REQ-013",
  "GAEP-CST-REQ-015",
  "GAEP-CST-REQ-016",
  "GAEP-CST-REQ-017",
  "GAEP-CST-REQ-025",
  "GAEP-DRAA-REQ-009",
  "GAEP-DRAA-REQ-014",
  "GAEP-DRAA-REQ-017",
  "GAEP-DRAA-REQ-029",
  "GAEP-DRAA-REQ-033",
  "GAEP-DRAA-REQ-035",
  "GAEP-POLICY-REQ-025",
  "GAEP-POLICY-REQ-027",
  "GAEP-RESVER-REQ-006",
  "GAEP-RESVER-REQ-007",
  "GAEP-RESVER-REQ-008",
  "GAEP-RESVER-REQ-013",
  "GAEP-RESVER-REQ-015",
  "GAEP-SCOPE-REQ-014",
  "GAEP-SCOPE-REQ-015",
  "GAEP-SCOPE-REQ-016",
  "GAEP-STATE-REQ-019",
  "GAEP-STATE-REQ-024",
] as const

export const p0P4ReadinessOutputKinds = [
  "architecture-challenge-model",
  "authorization-model",
  "bounded-context-ownership",
  "business-architecture-baseline",
  "business-capability-map",
  "business-rule-catalog",
  "business-understanding",
  "candidate-source-baseline",
  "data-model",
  "decision-register",
  "end-to-end-traceability",
  "event-integration-model",
  "evidence-registry",
  "failure-recovery-model",
  "initiative-entry",
  "operating-model",
  "outcome-success-model",
  "process-model",
  "risk-register",
  "security-privacy-threat-assessment",
  "source-intake",
  "source-provenance",
  "stakeholder-role-model",
  "system-solution-architecture",
  "value-stream-model",
] as const

export const p0P4ReadinessOutputKindSchema = z.enum(p0P4ReadinessOutputKinds)

export const p0P4ReadinessRecordKinds = {
  "architecture-challenge-model": "architecture-challenge-model",
  "authorization-model": "authorization-model",
  "bounded-context-ownership": "bounded-context-model",
  "business-architecture-baseline": "business-architecture-baseline",
  "business-capability-map": "business-capability-map",
  "business-rule-catalog": "business-rule-catalog",
  "business-understanding": "business-understanding",
  "candidate-source-baseline": "source-baseline",
  "data-model": "data-model",
  "decision-register": "decision-register",
  "end-to-end-traceability": "end-to-end-traceability-candidate",
  "event-integration-model": "event-integration-model",
  "evidence-registry": "evidence-registry",
  "failure-recovery-model": "failure-recovery-model",
  "initiative-entry": "initiative",
  "operating-model": "operating-model",
  "outcome-success-model": "outcome-model",
  "process-model": "process-model",
  "risk-register": "risk-register",
  "security-privacy-threat-assessment": "security-privacy-threat-assessment",
  "source-intake": "source-record",
  "source-provenance": "source-provenance",
  "stakeholder-role-model": "stakeholder-model",
  "system-solution-architecture": "system-solution-architecture",
  "value-stream-model": "value-stream-model",
} as const

const exactReadinessSubjectReferenceSchema = z.object({
  recordKind: z.string().trim().min(2).max(160),
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

const readinessOutputEvaluationSchema = z.object({
  outputKind: p0P4ReadinessOutputKindSchema,
  applicability: z.enum(["applicable", "not-applicable-candidate", "unresolved"]),
  subjects: z.array(exactReadinessSubjectReferenceSchema).max(512)
    .refine((entries) => unique(entries.map((entry) => `${entry.recordKind}:${entry.recordId}:${entry.revision}`)), "Readiness output subjects must be unique")
    .refine((entries) => canonical(entries.map((entry) => `${entry.recordKind}:${entry.recordId}:${String(entry.revision).padStart(12, "0")}`)), "Readiness output subjects must use canonical ordering"),
  evaluationState: z.enum([
    "blocked",
    "conditionally-satisfied",
    "failed",
    "incomplete",
    "not-applicable-candidate",
    "not-assessed",
    "satisfied",
  ]),
  freshness: z.enum(["current", "stale", "unknown"]),
  evidenceItemKeys: canonicalIdentifierListSchema,
  waiverKeys: canonicalIdentifierListSchema,
  blockers: canonicalTextListSchema,
  conditions: canonicalTextListSchema,
  findings: canonicalTextListSchema,
  assessedBy: actorSchema,
  assessedAt: z.string().datetime(),
  basis: longTextSchema,
  sources: exactSourceListSchema,
  authorityBoundary: z.literal(
    "readiness-output-evaluation-is-candidate-epistemic-state-and-does-not-establish-approval-waiver-acceptance-readiness-phase-entry-implementation-authorization-or-action-authority",
  ),
}).strict().superRefine((entry, context) => {
  if ((entry.applicability === "applicable") !== (entry.subjects.length > 0)) {
    context.addIssue({ code: "custom", path: ["subjects"], message: "Applicable outputs require exact subjects and other applicability states must not invent them" })
  }
  if (entry.subjects.some((subject) => subject.recordKind !== p0P4ReadinessRecordKinds[entry.outputKind])) {
    context.addIssue({ code: "custom", path: ["subjects"], message: "Readiness output subject kind does not match its canonical output class" })
  }
  if ((entry.applicability === "not-applicable-candidate") !==
      (entry.evaluationState === "not-applicable-candidate")) {
    context.addIssue({ code: "custom", path: ["evaluationState"], message: "Candidate not-applicable output state must remain distinct" })
  }
  if (entry.applicability === "unresolved" &&
      !["blocked", "incomplete", "not-assessed"].includes(entry.evaluationState)) {
    context.addIssue({ code: "custom", path: ["evaluationState"], message: "Unresolved applicability cannot satisfy a readiness output" })
  }
  if (["satisfied", "conditionally-satisfied"].includes(entry.evaluationState) && entry.freshness !== "current") {
    context.addIssue({ code: "custom", path: ["freshness"], message: "Satisfied output evaluations require current evidence" })
  }
  if (["failed", "blocked"].includes(entry.evaluationState) && entry.blockers.length === 0) {
    context.addIssue({ code: "custom", path: ["blockers"], message: "Failed or blocked outputs must expose blockers" })
  }
  if (entry.evaluationState === "conditionally-satisfied" &&
      entry.conditions.length === 0 && entry.waiverKeys.length === 0) {
    context.addIssue({ code: "custom", path: ["conditions"], message: "Conditional output evaluation requires conditions or a referenced waiver" })
  }
})

const readinessWaiverSchema = z.object({
  key: identifierSchema,
  outputKinds: canonicalArray(p0P4ReadinessOutputKindSchema, p0P4ReadinessOutputKinds.length)
    .refine((values) => values.length > 0, "Waiver output scope is required"),
  rule: shortTextSchema,
  scope: longTextSchema,
  state: z.enum(["denied", "expired", "granted", "pending", "revoked"]),
  decision: z.object({ register: exactReadinessSubjectReferenceSchema, decisionKey: identifierSchema }).strict(),
  risk: z.object({ register: exactReadinessSubjectReferenceSchema, riskKey: identifierSchema }).strict(),
  approval: exactReadinessSubjectReferenceSchema.optional(),
  authorization: exactReadinessSubjectReferenceSchema.optional(),
  owner: humanActorSchema,
  effectiveFrom: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  obligations: requiredCanonicalTextListSchema,
  validation: longTextSchema,
  rationale: longTextSchema,
  sources: exactSourceListSchema,
  authorityBoundary: z.literal(
    "readiness-waiver-entry-records-a-claimed-disposition-and-does-not-by-presence-or-state-establish-valid-approval-risk-acceptance-authorization-or-permission",
  ),
}).strict().superRefine((waiver, context) => {
  if (waiver.state === "granted" &&
      (!waiver.approval || !waiver.authorization || !waiver.effectiveFrom || !waiver.expiresAt)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Granted waiver claims require exact approval, authorization, effective time and expiry references" })
  }
  if (waiver.state !== "granted" && waiver.authorization !== undefined) {
    context.addIssue({ code: "custom", path: ["authorization"], message: "Only a granted waiver claim may reference authorization" })
  }
  if (waiver.effectiveFrom && waiver.expiresAt && Date.parse(waiver.expiresAt) <= Date.parse(waiver.effectiveFrom)) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "Waiver expiry must follow its effective time" })
  }
})

const readinessUnresolvedDecisionSchema = z.object({
  key: identifierSchema,
  decisionRegister: exactReadinessSubjectReferenceSchema,
  decisionKey: identifierSchema,
  affectedOutputs: canonicalArray(p0P4ReadinessOutputKindSchema, p0P4ReadinessOutputKinds.length)
    .refine((values) => values.length > 0, "Affected readiness outputs are required"),
  state: z.enum(["deferred", "open"]),
  blocking: z.boolean(),
  basis: longTextSchema,
}).strict()

const readinessConditionSchema = z.object({
  key: identifierSchema,
  source: z.enum(["approval", "gate", "policy", "waiver"]),
  outputKinds: canonicalArray(p0P4ReadinessOutputKindSchema, p0P4ReadinessOutputKinds.length)
    .refine((values) => values.length > 0, "Condition output scope is required"),
  owner: humanActorSchema,
  dueOrTrigger: shortTextSchema,
  validation: longTextSchema,
  consequence: longTextSchema,
  state: z.enum(["overdue", "pending", "satisfied", "violated"]),
  sourceReference: exactReadinessSubjectReferenceSchema,
}).strict()

const readinessRequirementCoverageSchema = z.object({
  requirementId: z.enum(p0P4ReadinessRequirementIds),
  state: z.enum(["covered-candidate", "not-applicable-candidate", "unresolved"]),
  outputKinds: canonicalArray(p0P4ReadinessOutputKindSchema, p0P4ReadinessOutputKinds.length),
  basis: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

const p0P4ReadinessGateInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  scope: longTextSchema,
  evaluationDefinition: z.object({
    id: identifierSchema,
    version: shortTextSchema,
    digest: digestSchema,
    criteria: requiredCanonicalTextListSchema,
    expectedEvidence: requiredCanonicalTextListSchema,
    evaluatorRequirements: requiredCanonicalTextListSchema,
    independenceRequirements: requiredCanonicalTextListSchema,
    failureBehavior: longTextSchema,
    invalidationTriggers: requiredCanonicalTextListSchema,
    authorityBoundary: z.literal("evaluation-definition-does-not-grant-approval-readiness-authorization-or-action-authority"),
  }).strict(),
  evidenceRegistry: exactEvidenceRegistryReferenceSchema,
  traceability: exactEndToEndTraceabilityReferenceSchema,
  outputs: z.array(readinessOutputEvaluationSchema).length(p0P4ReadinessOutputKinds.length)
    .refine((entries) => unique(entries.map((entry) => entry.outputKind)), "Readiness output evaluations must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.outputKind)), "Readiness output evaluations must use canonical ordering"),
  waivers: z.array(readinessWaiverSchema).max(512)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Readiness waiver keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Readiness waivers must use canonical ordering"),
  unresolvedDecisions: z.array(readinessUnresolvedDecisionSchema).max(512)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Unresolved decision keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Unresolved decisions must use canonical ordering"),
  conditions: z.array(readinessConditionSchema).max(512)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Readiness condition keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Readiness conditions must use canonical ordering"),
  requirementCoverage: z.array(readinessRequirementCoverageSchema).length(p0P4ReadinessRequirementIds.length)
    .refine((entries) => unique(entries.map((entry) => entry.requirementId)), "Requirement coverage must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.requirementId)), "Requirement coverage must use canonical ID ordering"),
  unresolvedQuestions: canonicalTextListSchema,
  inconsistencies: canonicalTextListSchema,
  limitations: requiredCanonicalTextListSchema,
  readinessAuthorityState: z.literal("not-established"),
}).strict().superRefine((gate, context) => {
  const expectedOutputs = [...p0P4ReadinessOutputKinds].sort((left, right) => left.localeCompare(right))
  if (gate.outputs.some((entry, index) => entry.outputKind !== expectedOutputs[index])) {
    context.addIssue({ code: "custom", path: ["outputs"], message: "Readiness output evaluations must contain the complete P0-P4 output catalog" })
  }
  for (const requiredKind of ["end-to-end-traceability", "evidence-registry", "initiative-entry"] as const) {
    if (gate.outputs.find((entry) => entry.outputKind === requiredKind)?.applicability !== "applicable") {
      context.addIssue({ code: "custom", path: ["outputs"], message: `${requiredKind} is a mandatory cross-step readiness input` })
    }
  }
  const expectedRequirements = [...p0P4ReadinessRequirementIds].sort((left, right) => left.localeCompare(right))
  if (gate.requirementCoverage.some((entry, index) => entry.requirementId !== expectedRequirements[index])) {
    context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must contain the complete P0-P4 Readiness Gate catalog" })
  }
  const waiverKeys = new Set(gate.waivers.map((waiver) => waiver.key))
  if (gate.outputs.some((entry) => entry.waiverKeys.some((key) => !waiverKeys.has(key)))) {
    context.addIssue({ code: "custom", path: ["outputs"], message: "Readiness outputs may reference only declared waivers" })
  }
})

export const p0P4ReadinessGateInputSchema = rejectSecrets(p0P4ReadinessGateInputBaseSchema)

export const p0P4ReadinessGateSchema = p0P4ReadinessGateInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("p0-p4-readiness-gate-candidate"),
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
    "p0-p4-readiness-gate-is-a-candidate-evaluation-and-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority",
  ),
}).strict().superRefine((gate, context) => {
  if ((gate.revision === 1) !== (gate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only P0-P4 Readiness Gate revisions after revision one require an exact predecessor digest" })
  }
})

export const exactP0P4ReadinessGateReferenceSchema = z.object({
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

export const p0P4ReadinessGateStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("p0-p4-readiness-gate-status"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  gate: exactP0P4ReadinessGateReferenceSchema.optional(),
  outputCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
  applicableOutputCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
  notApplicableOutputCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
  unresolvedApplicabilityCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
  satisfiedOutputCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
  conditionalOutputCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
  incompleteOutputCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
  failedOutputCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
  blockedOutputCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
  staleOrUnknownOutputCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
  pendingOrInvalidWaiverCount: z.number().int().nonnegative().max(512),
  unresolvedDecisionCount: z.number().int().nonnegative().max(512),
  unmetConditionCount: z.number().int().nonnegative().max(512),
  unresolvedRequirementCount: z.number().int().nonnegative().max(p0P4ReadinessRequirementIds.length),
  adverseEvidenceCount: z.number().int().nonnegative().max(32_768),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  inconsistencyCount: z.number().int().nonnegative().max(512),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  result: z.enum(["blocked", "conditionally-passed", "failed", "incomplete", "not-assessed", "passed"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  gateBoundary: z.literal("a-passing-gate-is-an-evaluation-result-not-permission"),
  authorityBoundary: z.literal(
    "p0-p4-readiness-gate-status-is-an-evaluation-result-and-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority",
  ),
}).strict().superRefine((status, context) => {
  if (status.applicableOutputCount + status.notApplicableOutputCount + status.unresolvedApplicabilityCount !== status.outputCount) {
    context.addIssue({ code: "custom", message: "Readiness applicability counts must equal the output total" })
  }
  if (status.satisfiedOutputCount + status.conditionalOutputCount + status.incompleteOutputCount +
      status.failedOutputCount + status.blockedOutputCount + status.notApplicableOutputCount > status.outputCount) {
    context.addIssue({ code: "custom", message: "Readiness evaluation counts cannot exceed the output total" })
  }
  const gapCount = status.unresolvedApplicabilityCount + status.conditionalOutputCount + status.incompleteOutputCount +
    status.failedOutputCount + status.blockedOutputCount + status.staleOrUnknownOutputCount +
    status.pendingOrInvalidWaiverCount + status.unresolvedDecisionCount + status.unmetConditionCount +
    status.unresolvedRequirementCount + status.adverseEvidenceCount + status.staleBindingCount +
    status.staleSourceReferenceCount + status.inconsistencyCount + status.unresolvedQuestionCount
  if (status.result === "passed" &&
      (gapCount > 0 || status.satisfiedOutputCount !== status.applicableOutputCount || status.reasons.length > 0)) {
    context.addIssue({ code: "custom", path: ["result"], message: "A passed readiness evaluation requires every applicable output satisfied and no recorded gaps" })
  }
  if (status.result !== "passed" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "A non-passing readiness evaluation must expose reasons" })
  }
  if (status.result === "conditionally-passed" &&
      (status.conditionalOutputCount === 0 || status.failedOutputCount > 0 || status.blockedOutputCount > 0)) {
    context.addIssue({ code: "custom", path: ["result"], message: "Conditional pass requires explicit conditional outputs and cannot hide failed or blocked outputs" })
  }
  if (!status.gate && status.result !== "not-assessed") {
    context.addIssue({ code: "custom", path: ["gate"], message: "A readiness result cannot exist without an exact candidate gate record" })
  }
})

export const p0P4ReadinessGateProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("p0-p4-readiness-gate-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: p0P4ReadinessGateStatusSchema,
  gate: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    membershipDigest: digestSchema,
    state: z.literal("candidate"),
    evaluationDefinitionDigest: digestSchema,
    outputCount: z.number().int().nonnegative().max(p0P4ReadinessOutputKinds.length),
    waiverCount: z.number().int().nonnegative().max(512),
    unresolvedDecisionCount: z.number().int().nonnegative().max(512),
    conditionCount: z.number().int().nonnegative().max(512),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-identities-counts-results-and-digests-only-not-output-content-criteria-findings-waiver-rationale-decision-content-evidence-content-source-content-personal-data-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "p0-p4-readiness-gate-projection-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId ||
      projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId ||
      projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "P0-P4 Readiness Gate projection must bind the exact Product and Initiative revisions" })
  }
})

export type P0P4ReadinessOutputKind = z.infer<typeof p0P4ReadinessOutputKindSchema>
export type P0P4ReadinessGateInput = z.infer<typeof p0P4ReadinessGateInputSchema>
export type P0P4ReadinessGate = z.infer<typeof p0P4ReadinessGateSchema>
export type ExactP0P4ReadinessGateReference = z.infer<typeof exactP0P4ReadinessGateReferenceSchema>
export type P0P4ReadinessGateStatus = z.infer<typeof p0P4ReadinessGateStatusSchema>
export type P0P4ReadinessGateProjection = z.infer<typeof p0P4ReadinessGateProjectionSchema>
