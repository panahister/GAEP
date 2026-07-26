import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { exactBoundedContextModelReferenceSchema } from "./bounded-context-model.js"
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

function canonicalArray<T extends z.ZodType>(schema: T, maximum = 2_048) {
  return z.array(schema).max(maximum)
    .refine((values) => unique(values as string[]), "Values must be unique")
    .refine((values) => canonical(values as string[]), "Values must use canonical lexical ordering")
}

const canonicalIdentifierListSchema = canonicalArray(identifierSchema)
const requiredCanonicalIdentifierListSchema = canonicalIdentifierListSchema.refine(
  (values) => values.length > 0,
  "At least one identifier is required",
)
const canonicalTextListSchema = canonicalArray(shortTextSchema, 512)
const requiredCanonicalTextListSchema = canonicalTextListSchema.refine(
  (values) => values.length > 0,
  "At least one value is required",
)

const exactSourceListSchema = z.array(exactSourceReferenceSchema).min(1).max(256)
  .refine(
    (references) => unique(references.map((reference) =>
      `${reference.sourceId}:${reference.sourceRevision}:${reference.recordDigest}:${reference.contentDigest}`)),
    "Exact Source references must be unique",
  )
  .superRefine((references, context) => {
    const ordered = [...references].sort((left, right) =>
      left.sourceId.localeCompare(right.sourceId) || left.sourceRevision - right.sourceRevision)
    if (references.some((reference, index) =>
      reference.sourceId !== ordered[index]?.sourceId ||
      reference.sourceRevision !== ordered[index]?.sourceRevision)) {
      context.addIssue({ code: "custom", message: "Exact Source references must use canonical identity ordering" })
    }
  })

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Process Model candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const processStateRequirementIds = [
  "GAEP-STATE-REQ-001", "GAEP-STATE-REQ-002", "GAEP-STATE-REQ-003", "GAEP-STATE-REQ-004",
  "GAEP-STATE-REQ-005", "GAEP-STATE-REQ-006", "GAEP-STATE-REQ-007", "GAEP-STATE-REQ-008",
  "GAEP-STATE-REQ-009", "GAEP-STATE-REQ-010", "GAEP-STATE-REQ-011", "GAEP-STATE-REQ-012",
  "GAEP-STATE-REQ-016", "GAEP-STATE-REQ-017", "GAEP-STATE-REQ-018", "GAEP-STATE-REQ-019",
  "GAEP-STATE-REQ-020", "GAEP-STATE-REQ-021", "GAEP-STATE-REQ-023", "GAEP-STATE-REQ-024",
] as const

export const processDecisionRequirementIds = [
  "GAEP-DRAA-REQ-001", "GAEP-DRAA-REQ-003", "GAEP-DRAA-REQ-004", "GAEP-DRAA-REQ-005",
  "GAEP-DRAA-REQ-006", "GAEP-DRAA-REQ-008", "GAEP-DRAA-REQ-009", "GAEP-DRAA-REQ-013",
  "GAEP-DRAA-REQ-014", "GAEP-DRAA-REQ-015", "GAEP-DRAA-REQ-017", "GAEP-DRAA-REQ-018",
  "GAEP-DRAA-REQ-020", "GAEP-DRAA-REQ-022", "GAEP-DRAA-REQ-023", "GAEP-DRAA-REQ-024",
  "GAEP-DRAA-REQ-025", "GAEP-DRAA-REQ-026", "GAEP-DRAA-REQ-029", "GAEP-DRAA-REQ-033",
  "GAEP-DRAA-REQ-035", "GAEP-DRAA-REQ-036",
] as const

export const processWorkflowRequirementIds = [
  "GAEP-CWC-REQ-001", "GAEP-CWC-REQ-002", "GAEP-CWC-REQ-003", "GAEP-CWC-REQ-004",
  "GAEP-CWC-REQ-005", "GAEP-CWC-REQ-006", "GAEP-CWC-REQ-007", "GAEP-CWC-REQ-008",
  "GAEP-CWC-REQ-009", "GAEP-CWC-REQ-010", "GAEP-CWC-REQ-011", "GAEP-CWC-REQ-012",
  "GAEP-CWC-REQ-013", "GAEP-CWC-REQ-014", "GAEP-CWC-REQ-015", "GAEP-CWC-REQ-016",
  "GAEP-CWC-REQ-017", "GAEP-CWC-REQ-018", "GAEP-CWC-REQ-019", "GAEP-CWC-REQ-020",
  "GAEP-CWC-REQ-021", "GAEP-CWC-REQ-022", "GAEP-CWC-REQ-023", "GAEP-CWC-REQ-024",
  "GAEP-CWC-REQ-025", "GAEP-CWC-REQ-026", "GAEP-CWC-REQ-027", "GAEP-CWC-REQ-028",
] as const

export const processRequirementIds = [
  ...processStateRequirementIds,
  ...processDecisionRequirementIds,
  ...processWorkflowRequirementIds,
] as const

export const processStateDimensionFamilySchema = z.enum([
  "approval-case-lifecycle", "approval-outcome", "authorization-validity", "authoring-lifecycle",
  "execution-activity", "execution-outcome", "execution-phase", "freshness", "operational-eligibility",
  "retention", "revision-disposition", "validity", "profile-defined",
])

const processStateValueSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  terminal: z.boolean(),
  meaning: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

const processStateDimensionSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  family: processStateDimensionFamilySchema,
  statechartVersion: z.number().int().positive(),
  initialStateKey: identifierSchema,
  states: z.array(processStateValueSchema).min(2).max(256)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "State values must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "State values must use canonical key ordering"),
  migrationAndCompatibility: longTextSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((dimension, context) => {
  if (!dimension.states.some((state) => state.key === dimension.initialStateKey)) {
    context.addIssue({ code: "custom", path: ["initialStateKey"], message: "Initial state must reference a declared value" })
  }
})

const processApprovalRequirementSchema = z.object({
  key: identifierSchema,
  level: z.enum(["A0", "A1", "A2", "A3", "A4"]),
  purpose: longTextSchema,
  exactSubject: longTextSchema,
  approverRoleKeys: requiredCanonicalIdentifierListSchema,
  segregationRules: requiredCanonicalTextListSchema,
  aggregationRule: longTextSchema,
  allowedOutcomes: requiredCanonicalIdentifierListSchema,
  evidenceRequirements: requiredCanonicalTextListSchema,
  validity: longTextSchema,
  reopeningTriggers: requiredCanonicalTextListSchema,
  approvalState: z.literal("not-granted"),
  sources: exactSourceListSchema,
}).strict()

const processTransitionSchema = z.object({
  key: identifierSchema,
  dimensionKey: identifierSchema,
  sourceStateKey: identifierSchema,
  targetStateKey: identifierSchema,
  trigger: longTextSchema,
  actorRoleKeys: requiredCanonicalIdentifierListSchema,
  authorityBasis: longTextSchema,
  guardCriteria: requiredCanonicalTextListSchema,
  evidenceRequirements: requiredCanonicalTextListSchema,
  approvalRequirementKeys: canonicalIdentifierListSchema,
  confirmationRequired: z.boolean(),
  idempotencyRequired: z.literal(true),
  concurrencyRule: z.enum(["compare-and-swap", "serialized", "explicit-re-evaluation"]),
  effects: requiredCanonicalTextListSchema,
  failureBehavior: longTextSchema,
  reopeningAndCompensation: longTextSchema,
  authorityState: z.literal("not-granted"),
  sources: exactSourceListSchema,
}).strict()

const processStepSchema = z.object({
  key: identifierSchema,
  sequence: z.number().int().positive().max(4_096),
  objective: longTextSchema,
  responsibility: z.enum(["agent", "deterministic", "external", "human", "mixed"]),
  dependencyKeys: canonicalIdentifierListSchema,
  roleKeys: requiredCanonicalIdentifierListSchema,
  boundedContextKeys: requiredCanonicalIdentifierListSchema,
  transitionKeys: requiredCanonicalIdentifierListSchema,
  approvalRequirementKeys: canonicalIdentifierListSchema,
  inputs: requiredCanonicalTextListSchema,
  outputs: requiredCanonicalTextListSchema,
  evidenceRequirements: requiredCanonicalTextListSchema,
  stopConditions: requiredCanonicalTextListSchema,
  recoveryExpectations: requiredCanonicalTextListSchema,
  proposedEffects: canonicalTextListSchema,
  authorizationState: z.literal("not-granted"),
  completionState: z.literal("not-assessed"),
  sources: exactSourceListSchema,
}).strict()

const processEventDefinitionSchema = z.object({
  key: identifierSchema,
  category: z.enum(["audit", "domain", "execution", "governance", "integration"]),
  schemaVersion: z.number().int().positive(),
  subject: longTextSchema,
  producerRoleKeys: requiredCanonicalIdentifierListSchema,
  transitionKeys: requiredCanonicalIdentifierListSchema,
  payloadContract: longTextSchema,
  classification: informationClassificationSchema,
  provenanceAndIntegrity: longTextSchema,
  correctionSemantics: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

const processDefinitionSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  purpose: longTextSchema,
  ownerRoleKey: identifierSchema,
  participantRoleKeys: requiredCanonicalIdentifierListSchema,
  valueStreamKeys: requiredCanonicalIdentifierListSchema,
  boundedContextKeys: requiredCanonicalIdentifierListSchema,
  businessRuleKeys: requiredCanonicalIdentifierListSchema,
  trigger: longTextSchema,
  inputs: requiredCanonicalTextListSchema,
  outputs: requiredCanonicalTextListSchema,
  stateDimensions: z.array(processStateDimensionSchema).min(1).max(64)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "State dimensions must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "State dimensions must use canonical key ordering"),
  approvalRequirements: z.array(processApprovalRequirementSchema).min(1).max(256)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Approval requirements must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Approval requirements must use canonical key ordering"),
  transitions: z.array(processTransitionSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Transitions must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Transitions must use canonical key ordering"),
  steps: z.array(processStepSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Process steps must be unique"),
  events: z.array(processEventDefinitionSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Event definitions must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Event definitions must use canonical key ordering"),
  assumptions: canonicalTextListSchema,
  inconsistencies: canonicalTextListSchema,
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((process, context) => {
  const dimensionByKey = new Map(process.stateDimensions.map((entry) => [entry.key, entry]))
  const approvalKeys = new Set(process.approvalRequirements.map((entry) => entry.key))
  const transitionKeys = new Set(process.transitions.map((entry) => entry.key))
  const stepKeys = new Set(process.steps.map((entry) => entry.key))
  for (const transition of process.transitions) {
    const dimension = dimensionByKey.get(transition.dimensionKey)
    const stateKeys = new Set(dimension?.states.map((entry) => entry.key) ?? [])
    if (!dimension || !stateKeys.has(transition.sourceStateKey) || !stateKeys.has(transition.targetStateKey) ||
        transition.sourceStateKey === transition.targetStateKey) {
      context.addIssue({ code: "custom", path: ["transitions"], message: "Transitions must connect distinct declared states in one declared dimension" })
    }
    if (transition.approvalRequirementKeys.some((key) => !approvalKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["transitions"], message: "Transitions must reference declared approval requirements" })
    }
  }
  for (const [index, step] of process.steps.entries()) {
    if (step.sequence !== index + 1 || step.dependencyKeys.includes(step.key) ||
        step.dependencyKeys.some((key) => !stepKeys.has(key)) ||
        step.transitionKeys.some((key) => !transitionKeys.has(key)) ||
        step.approvalRequirementKeys.some((key) => !approvalKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["steps", index], message: "Steps require contiguous order and declared dependencies, transitions, and approvals" })
    }
    const priorKeys = new Set(process.steps.slice(0, index).map((entry) => entry.key))
    if (step.dependencyKeys.some((key) => !priorKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["steps", index, "dependencyKeys"], message: "Step dependencies must reference earlier steps" })
    }
  }
  const steppedTransitions = new Set(process.steps.flatMap((entry) => entry.transitionKeys))
  const eventTransitions = new Set(process.events.flatMap((entry) => entry.transitionKeys))
  if (process.transitions.some((entry) => !steppedTransitions.has(entry.key) || !eventTransitions.has(entry.key))) {
    context.addIssue({ code: "custom", path: ["transitions"], message: "Every transition requires explicit step and event coverage" })
  }
  const usedApprovals = new Set([
    ...process.transitions.flatMap((entry) => entry.approvalRequirementKeys),
    ...process.steps.flatMap((entry) => entry.approvalRequirementKeys),
  ])
  if (process.approvalRequirements.some((entry) => !usedApprovals.has(entry.key))) {
    context.addIssue({ code: "custom", path: ["approvalRequirements"], message: "Every approval requirement must guard a declared transition or step" })
  }
})

const processRequirementCoverageSchema = z.object({
  requirementId: z.enum(processRequirementIds),
  state: z.enum(["covered-candidate", "not-applicable-candidate", "unresolved"]),
  processKeys: canonicalIdentifierListSchema,
  transitionKeys: canonicalIdentifierListSchema,
  basis: longTextSchema,
  evidence: exactSourceListSchema,
}).strict()

const processGovernanceSchema = z.object({
  processOwnerRoleKey: identifierSchema,
  stateStewardRoleKey: identifierSchema,
  approvalCoordinatorRoleKey: identifierSchema,
  reviewerRoleKeys: requiredCanonicalIdentifierListSchema,
  authoringLifecycle: z.enum(["draft", "under-challenge", "awaiting-human-review"]),
  transitionAuthorityState: z.literal("not-granted"),
  approvalState: z.literal("not-granted"),
  operationalReadinessState: z.literal("not-established"),
  executionAuthorityState: z.literal("not-granted"),
  basis: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

const processModelInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  scope: longTextSchema,
  valueStreamModel: exactBoundedContextModelReferenceSchema,
  operatingModel: exactBoundedContextModelReferenceSchema,
  businessRuleCatalog: exactBoundedContextModelReferenceSchema,
  boundedContextModel: exactBoundedContextModelReferenceSchema,
  securityPrivacyAssessment: exactBoundedContextModelReferenceSchema,
  processes: z.array(processDefinitionSchema).min(1).max(512)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Process definitions must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Process definitions must use canonical key ordering"),
  requirementCoverage: z.array(processRequirementCoverageSchema).length(processRequirementIds.length)
    .refine((entries) => unique(entries.map((entry) => entry.requirementId)), "Requirement coverage must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.requirementId)), "Requirement coverage must use canonical ID ordering"),
  governance: processGovernanceSchema,
  assumptions: canonicalTextListSchema,
  inconsistencies: canonicalTextListSchema,
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema,
}).strict().superRefine((record, context) => {
  const expected = [...processRequirementIds].sort((left, right) => left.localeCompare(right))
  if (record.requirementCoverage.some((entry, index) => entry.requirementId !== expected[index])) {
    context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must contain the complete canonical Process Model catalog" })
  }
  const processKeys = new Set(record.processes.map((entry) => entry.key))
  const transitionKeys = new Set(record.processes.flatMap((entry) => entry.transitions.map((transition) => transition.key)))
  for (const coverage of record.requirementCoverage) {
    if (coverage.processKeys.some((key) => !processKeys.has(key)) || coverage.transitionKeys.some((key) => !transitionKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must reference declared processes and transitions" })
    }
  }
})

export const processModelInputSchema = rejectSecrets(processModelInputBaseSchema)

export const processModelSchema = processModelInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("process-model-candidate"),
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
    "process-model-is-a-candidate-record-and-does-not-approve-a-workflow-grant-transition-or-execution-authority-establish-operational-readiness-or-authorize-action",
  ),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Process Model revisions after revision one require an exact predecessor digest" })
  }
})

export const exactProcessModelReferenceSchema = exactBoundedContextModelReferenceSchema

export const processModelStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("process-model-status"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  model: exactProcessModelReferenceSchema.optional(),
  processCount: z.number().int().nonnegative().max(512),
  stepCount: z.number().int().nonnegative().max(65_536),
  stateDimensionCount: z.number().int().nonnegative().max(32_768),
  stateValueCount: z.number().int().nonnegative().max(65_536),
  transitionCount: z.number().int().nonnegative().max(65_536),
  eventDefinitionCount: z.number().int().nonnegative().max(65_536),
  approvalRequirementCount: z.number().int().nonnegative().max(32_768),
  uncoveredValueStreamCount: z.number().int().nonnegative().max(2_048),
  uncoveredBoundedContextCount: z.number().int().nonnegative().max(2_048),
  uncoveredBusinessRuleCount: z.number().int().nonnegative().max(4_096),
  unresolvedRequirementCount: z.number().int().nonnegative().max(processRequirementIds.length),
  inconsistencyCount: z.number().int().nonnegative().max(512),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  state: z.enum(["complete-for-review", "attention-required"]),
  reasons: z.array(shortTextSchema).max(512),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "process-model-status-reports-candidate-coverage-and-gaps-and-does-not-approve-workflows-grant-transition-or-execution-authority-establish-operational-readiness-or-authorize-action",
  ),
}).strict()

export const processModelProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("process-model-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  }).strict(),
  status: processModelStatusSchema,
  model: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    membershipDigest: digestSchema,
    state: z.literal("candidate"),
    processCount: z.number().int().nonnegative().max(512),
    transitionCount: z.number().int().nonnegative().max(65_536),
    approvalRequirementCount: z.number().int().nonnegative().max(32_768),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-identities-counts-statuses-and-digests-only-not-process-narrative-transition-guards-approval-content-source-content-personal-data-locators-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "process-model-projection-does-not-approve-workflows-grant-transition-or-execution-authority-establish-operational-readiness-or-authorize-action",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId ||
      projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId ||
      projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Process Model projection must bind the exact Product and Initiative revisions" })
  }
})

export type ProcessModelInput = z.infer<typeof processModelInputSchema>
export type ProcessModel = z.infer<typeof processModelSchema>
export type ExactProcessModelReference = z.infer<typeof exactProcessModelReferenceSchema>
export type ProcessModelStatus = z.infer<typeof processModelStatusSchema>
export type ProcessModelProjection = z.infer<typeof processModelProjectionSchema>
