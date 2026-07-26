import { z } from "zod"

import { exactAuthorizationModelReferenceSchema } from "./authorization-model.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactBoundedContextModelReferenceSchema } from "./bounded-context-model.js"
import { exactDataModelReferenceSchema } from "./data-model.js"
import { exactOperatingModelReferenceSchema } from "./operating-model.js"
import { exactProcessModelReferenceSchema } from "./process-model.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactSecurityPrivacyAssessmentReferenceSchema } from "./security-privacy-assessment.js"
import { exactSourceReferenceSchema } from "./source-governance.js"
import { exactSystemSolutionArchitectureReferenceSchema } from "./system-solution-architecture.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const commandNameSchema = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/)
const semanticVersionSchema = z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/)
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
      reference.sourceId !== ordered[index]?.sourceId || reference.sourceRevision !== ordered[index]?.sourceRevision)) {
      context.addIssue({ code: "custom", message: "Exact Source references must use canonical identity ordering" })
    }
  })

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Event and Integration Model candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const eventIntegrationStateRequirementIds = [
  "GAEP-STATE-REQ-010", "GAEP-STATE-REQ-011", "GAEP-STATE-REQ-012", "GAEP-STATE-REQ-023",
] as const

export const eventIntegrationWorkflowRequirementIds = [
  "GAEP-CWC-REQ-001", "GAEP-CWC-REQ-002", "GAEP-CWC-REQ-003", "GAEP-CWC-REQ-004",
  "GAEP-CWC-REQ-005", "GAEP-CWC-REQ-006", "GAEP-CWC-REQ-007", "GAEP-CWC-REQ-008",
  "GAEP-CWC-REQ-009", "GAEP-CWC-REQ-010", "GAEP-CWC-REQ-011", "GAEP-CWC-REQ-012",
  "GAEP-CWC-REQ-013", "GAEP-CWC-REQ-014", "GAEP-CWC-REQ-015", "GAEP-CWC-REQ-016",
  "GAEP-CWC-REQ-017", "GAEP-CWC-REQ-018", "GAEP-CWC-REQ-019", "GAEP-CWC-REQ-020",
  "GAEP-CWC-REQ-021", "GAEP-CWC-REQ-022", "GAEP-CWC-REQ-023", "GAEP-CWC-REQ-024",
  "GAEP-CWC-REQ-025", "GAEP-CWC-REQ-026", "GAEP-CWC-REQ-027", "GAEP-CWC-REQ-028",
] as const

export const eventIntegrationCompatibilityRequirementIds = [
  "GAEP-ECF-REQ-003", "GAEP-ECF-REQ-011", "GAEP-ECF-REQ-012", "GAEP-ECF-REQ-013",
  "GAEP-ECF-REQ-014", "GAEP-ECF-REQ-015", "GAEP-ECF-REQ-016", "GAEP-ECF-REQ-017",
  "GAEP-ECF-REQ-018", "GAEP-ECF-REQ-020", "GAEP-ECF-REQ-022", "GAEP-ECF-REQ-023",
] as const

export const eventIntegrationEffectRequirementIds = [
  "GAEP-EER-REQ-004", "GAEP-EER-REQ-011", "GAEP-EER-REQ-012", "GAEP-EER-REQ-014",
  "GAEP-EER-REQ-015", "GAEP-EER-REQ-027", "GAEP-EER-REQ-028", "GAEP-EER-REQ-030",
] as const

export const eventIntegrationMappingRequirementIds = [
  "GAEP-MAP-REQ-001", "GAEP-MAP-REQ-002", "GAEP-MAP-REQ-003", "GAEP-MAP-REQ-004",
  "GAEP-MAP-REQ-005", "GAEP-MAP-REQ-006", "GAEP-MAP-REQ-007", "GAEP-MAP-REQ-008",
  "GAEP-MAP-REQ-009", "GAEP-MAP-REQ-010", "GAEP-MAP-REQ-011", "GAEP-MAP-REQ-012",
  "GAEP-MAP-REQ-013", "GAEP-MAP-REQ-014", "GAEP-MAP-REQ-015", "GAEP-MAP-REQ-016",
  "GAEP-MAP-REQ-017", "GAEP-MAP-REQ-018", "GAEP-MAP-REQ-019",
] as const

export const eventIntegrationRequirementIds = [
  ...eventIntegrationStateRequirementIds,
  ...eventIntegrationWorkflowRequirementIds,
  ...eventIntegrationCompatibilityRequirementIds,
  ...eventIntegrationEffectRequirementIds,
  ...eventIntegrationMappingRequirementIds,
] as const

const eventEnvelopeContractSchema = z.object({
  eventIdentity: z.literal("required"),
  typeAndSchemaVersion: z.literal("required"),
  subjectAndExactRevision: z.literal("required"),
  occurrenceTime: z.literal("required-when-observed"),
  recordedTime: z.literal("required-when-observed"),
  producerAndActor: z.literal("required"),
  accountableScope: z.literal("required"),
  causationAndCorrelation: z.literal("required"),
  ordering: z.enum(["explicit-no-guarantee", "partition-sequence", "subject-sequence"]),
  classificationAndHandling: z.literal("required"),
  provenanceAndIntegrity: z.literal("required"),
  correctionLink: z.literal("required-when-applicable"),
}).strict()

const eventTypeDefinitionSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  category: z.enum(["audit", "domain", "execution", "governance", "integration"]),
  schemaVersion: z.number().int().positive(),
  processEventKeys: requiredCanonicalIdentifierListSchema,
  producerBoundedContextKey: identifierSchema,
  producerRoleKeys: requiredCanonicalIdentifierListSchema,
  subjectKind: z.enum(["architecture-element", "bounded-context", "data-entity", "process"]),
  subjectKeys: requiredCanonicalIdentifierListSchema,
  payloadDataEntityKeys: canonicalIdentifierListSchema,
  envelope: eventEnvelopeContractSchema,
  payloadContract: longTextSchema,
  orderingScope: longTextSchema,
  correctionSemantics: longTextSchema,
  classification: informationClassificationSchema,
  occurrenceState: z.literal("definition-only-not-observed"),
  sources: exactSourceListSchema,
}).strict()

const commandContractSchema = z.object({
  key: identifierSchema,
  name: commandNameSchema,
  semanticVersion: semanticVersionSchema,
  purpose: longTextSchema,
  mode: z.enum(["analyze", "approve-request", "draft", "modify", "operate", "review"]),
  processKeys: requiredCanonicalIdentifierListSchema,
  actorRoleKeys: requiredCanonicalIdentifierListSchema,
  targetBoundedContextKeys: requiredCanonicalIdentifierListSchema,
  inputDataEntityKeys: canonicalIdentifierListSchema,
  outputDataEntityKeys: canonicalIdentifierListSchema,
  authorizationActionKeys: requiredCanonicalIdentifierListSchema,
  authorizationRuleKeys: requiredCanonicalIdentifierListSchema,
  preconditions: requiredCanonicalTextListSchema,
  contextRequirements: requiredCanonicalTextListSchema,
  outputContract: longTextSchema,
  evidenceRequirements: requiredCanonicalTextListSchema,
  effectDescriptors: canonicalIdentifierListSchema,
  idempotencyRule: longTextSchema,
  timeoutRetryCancellation: longTextSchema,
  deliveryState: z.literal("not-sent"),
  executionState: z.literal("not-executed"),
  authorizationState: z.literal("not-granted"),
  sources: exactSourceListSchema,
}).strict()

const adapterDefinitionSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  semanticVersion: semanticVersionSchema,
  kind: z.enum(["agent-or-tool", "external-system", "provider", "transport"]),
  boundedContextKeys: requiredCanonicalIdentifierListSchema,
  supportedEventTypeKeys: requiredCanonicalIdentifierListSchema,
  supportedCommandKeys: requiredCanonicalIdentifierListSchema,
  supportedContractVersions: requiredCanonicalTextListSchema,
  capabilityLimits: requiredCanonicalTextListSchema,
  semanticLosses: requiredCanonicalTextListSchema,
  dataHandling: longTextSchema,
  effectSemantics: longTextSchema,
  failureSemantics: longTextSchema,
  idempotencyAndRetry: longTextSchema,
  evidenceContract: longTextSchema,
  compatibilityState: z.literal("unknown"),
  evaluationState: z.literal("not-established"),
  activationState: z.literal("not-granted"),
  credentialBindingState: z.literal("external-reference-only"),
  sources: exactSourceListSchema,
}).strict()

const externalContractSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  semanticVersion: semanticVersionSchema,
  externalSystem: shortTextSchema,
  namespace: shortTextSchema,
  authorityDomain: shortTextSchema,
  producerBoundedContextKeys: requiredCanonicalIdentifierListSchema,
  consumerBoundedContextKeys: requiredCanonicalIdentifierListSchema,
  eventTypeKeys: requiredCanonicalIdentifierListSchema,
  commandKeys: requiredCanonicalIdentifierListSchema,
  schemaAndRepresentation: longTextSchema,
  versioningAndMigration: longTextSchema,
  classification: informationClassificationSchema,
  compatibilityState: z.literal("unknown"),
  consumerAcceptanceState: z.literal("not-established"),
  sources: exactSourceListSchema,
}).strict()

export const integrationDirectionSchema = z.enum([
  "bidirectional", "export", "import", "manual", "observe-only",
])

export const integrationFidelitySchema = z.enum([
  "exact", "extended", "lossy", "narrowed", "transformed", "unsupported",
])

const integrationMappingRowSchema = z.object({
  key: identifierSchema,
  gaepSubjectKey: identifierSchema,
  externalSubject: shortTextSchema,
  authority: z.enum(["conditional", "external", "gaep", "no-authoritative-write-path"]),
  direction: integrationDirectionSchema,
  fidelity: integrationFidelitySchema,
  conflictRule: longTextSchema,
  timeAndVersionRule: longTextSchema,
  deletionAndRetentionRule: longTextSchema,
  effectAndAuthorizationRule: longTextSchema,
  evidenceRule: longTextSchema,
  truthClass: z.enum(["configured", "external-asserted", "inferred", "observed", "transformed", "unknown"]),
  sources: exactSourceListSchema,
}).strict()

const integrationMappingSchema = z.object({
  key: identifierSchema,
  adapterKey: identifierSchema,
  externalContractKey: identifierSchema,
  namespaceBinding: shortTextSchema,
  rows: z.array(integrationMappingRowSchema).min(1).max(16_384)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Mapping row keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Mapping rows must use canonical key ordering"),
  synchronizationTriggers: requiredCanonicalTextListSchema,
  reconciliationOwnerRoleKey: identifierSchema,
  divergenceBehavior: longTextSchema,
  duplicateDeliveryBehavior: longTextSchema,
  reorderingBehavior: longTextSchema,
  partialApplicationBehavior: longTextSchema,
  retryAndReplayBehavior: longTextSchema,
  unknownFinalStateBehavior: longTextSchema,
  credentialBindingState: z.literal("not-included"),
  evaluationState: z.literal("not-established"),
  activationState: z.literal("not-granted"),
  sources: exactSourceListSchema,
}).strict()

const integrationRouteSchema = z.object({
  key: identifierSchema,
  eventTypeKeys: requiredCanonicalIdentifierListSchema,
  commandKeys: requiredCanonicalIdentifierListSchema,
  adapterKey: identifierSchema,
  externalContractKey: identifierSchema,
  mappingKey: identifierSchema,
  producerBoundedContextKeys: requiredCanonicalIdentifierListSchema,
  consumerBoundedContextKeys: requiredCanonicalIdentifierListSchema,
  deliveryGuarantee: z.enum(["at-least-once-candidate", "at-most-once-candidate", "none-declared", "provider-specific"]),
  orderingAndConcurrency: longTextSchema,
  idempotencyAndDuplicateDetection: longTextSchema,
  authoritativeReceiptContract: longTextSchema,
  timeoutAndUncertainResult: longTextSchema,
  failureAndDegradedBehavior: longTextSchema,
  deliveryState: z.literal("not-attempted"),
  externalAcceptanceState: z.literal("not-established"),
  executionState: z.literal("not-executed"),
  sources: exactSourceListSchema,
}).strict()

const eventIntegrationRequirementCoverageSchema = z.object({
  requirementId: z.enum(eventIntegrationRequirementIds),
  state: z.enum(["covered-candidate", "not-applicable-candidate", "unresolved"]),
  eventTypeKeys: canonicalIdentifierListSchema,
  commandKeys: canonicalIdentifierListSchema,
  adapterKeys: canonicalIdentifierListSchema,
  externalContractKeys: canonicalIdentifierListSchema,
  mappingKeys: canonicalIdentifierListSchema,
  routeKeys: canonicalIdentifierListSchema,
  basis: longTextSchema,
  evidence: exactSourceListSchema,
}).strict()

const eventIntegrationGovernanceSchema = z.object({
  integrationStewardRoleKeys: requiredCanonicalIdentifierListSchema,
  eventStewardRoleKeys: requiredCanonicalIdentifierListSchema,
  contractReviewerRoleKeys: requiredCanonicalIdentifierListSchema,
  reviewState: z.enum(["awaiting-human-review", "draft", "under-challenge"]),
  eventRegistryApprovalState: z.literal("not-granted"),
  commandRegistryApprovalState: z.literal("not-granted"),
  adapterEvaluationState: z.literal("not-established"),
  externalContractAcceptanceState: z.literal("not-established"),
  activationState: z.literal("not-granted"),
  operationalReadinessState: z.literal("not-established"),
  executionAuthorityState: z.literal("not-granted"),
  basis: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

const eventIntegrationModelInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  scope: longTextSchema,
  systemSolutionArchitecture: exactSystemSolutionArchitectureReferenceSchema,
  boundedContextModel: exactBoundedContextModelReferenceSchema,
  operatingModel: exactOperatingModelReferenceSchema,
  securityPrivacyAssessment: exactSecurityPrivacyAssessmentReferenceSchema,
  processModel: exactProcessModelReferenceSchema,
  dataModel: exactDataModelReferenceSchema,
  authorizationModel: exactAuthorizationModelReferenceSchema,
  eventTypes: z.array(eventTypeDefinitionSchema).min(1).max(8_192)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Event Type keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Event Types must use canonical key ordering"),
  commands: z.array(commandContractSchema).min(1).max(8_192)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Command keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Commands must use canonical key ordering"),
  adapters: z.array(adapterDefinitionSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Adapter keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Adapters must use canonical key ordering"),
  externalContracts: z.array(externalContractSchema).min(1).max(8_192)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "External Contract keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "External Contracts must use canonical key ordering"),
  mappings: z.array(integrationMappingSchema).min(1).max(8_192)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Integration Mapping keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Integration Mappings must use canonical key ordering"),
  routes: z.array(integrationRouteSchema).min(1).max(8_192)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Integration Route keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Integration Routes must use canonical key ordering"),
  requirementCoverage: z.array(eventIntegrationRequirementCoverageSchema).length(eventIntegrationRequirementIds.length)
    .refine((entries) => unique(entries.map((entry) => entry.requirementId)), "Requirement coverage must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.requirementId)), "Requirement coverage must use canonical ID ordering"),
  governance: eventIntegrationGovernanceSchema,
  assumptions: canonicalTextListSchema,
  inconsistencies: canonicalTextListSchema,
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema,
}).strict().superRefine((record, context) => {
  const expected = [...eventIntegrationRequirementIds].sort((left, right) => left.localeCompare(right))
  if (record.requirementCoverage.some((entry, index) => entry.requirementId !== expected[index])) {
    context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must contain the complete Event and Integration Model catalog" })
  }
  const eventKeys = new Set(record.eventTypes.map((entry) => entry.key))
  const commandKeys = new Set(record.commands.map((entry) => entry.key))
  const adapterKeys = new Set(record.adapters.map((entry) => entry.key))
  const contractKeys = new Set(record.externalContracts.map((entry) => entry.key))
  const mappingKeys = new Set(record.mappings.map((entry) => entry.key))
  const routeKeys = new Set(record.routes.map((entry) => entry.key))
  for (const adapter of record.adapters) {
    if (adapter.supportedEventTypeKeys.some((key) => !eventKeys.has(key)) ||
        adapter.supportedCommandKeys.some((key) => !commandKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["adapters"], message: "Adapters must reference declared Event Types and Commands" })
    }
  }
  for (const contract of record.externalContracts) {
    if (contract.eventTypeKeys.some((key) => !eventKeys.has(key)) ||
        contract.commandKeys.some((key) => !commandKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["externalContracts"], message: "External Contracts must reference declared Event Types and Commands" })
    }
  }
  for (const mapping of record.mappings) {
    if (!adapterKeys.has(mapping.adapterKey) || !contractKeys.has(mapping.externalContractKey)) {
      context.addIssue({ code: "custom", path: ["mappings"], message: "Mappings must reference declared Adapters and External Contracts" })
    }
  }
  for (const route of record.routes) {
    if (route.eventTypeKeys.some((key) => !eventKeys.has(key)) || route.commandKeys.some((key) => !commandKeys.has(key)) ||
        !adapterKeys.has(route.adapterKey) || !contractKeys.has(route.externalContractKey) || !mappingKeys.has(route.mappingKey)) {
      context.addIssue({ code: "custom", path: ["routes"], message: "Routes must reference declared Events, Commands, Adapters, External Contracts, and Mappings" })
    }
  }
  const routedEvents = new Set(record.routes.flatMap((entry) => entry.eventTypeKeys))
  const routedCommands = new Set(record.routes.flatMap((entry) => entry.commandKeys))
  const routedAdapters = new Set(record.routes.map((entry) => entry.adapterKey))
  const routedContracts = new Set(record.routes.map((entry) => entry.externalContractKey))
  const routedMappings = new Set(record.routes.map((entry) => entry.mappingKey))
  if ([...eventKeys].some((key) => !routedEvents.has(key)) || [...commandKeys].some((key) => !routedCommands.has(key)) ||
      [...adapterKeys].some((key) => !routedAdapters.has(key)) || [...contractKeys].some((key) => !routedContracts.has(key)) ||
      [...mappingKeys].some((key) => !routedMappings.has(key))) {
    context.addIssue({ code: "custom", path: ["routes"], message: "Every Event, Command, Adapter, External Contract, and Mapping requires explicit route coverage" })
  }
  for (const coverage of record.requirementCoverage) {
    if (coverage.eventTypeKeys.some((key) => !eventKeys.has(key)) ||
        coverage.commandKeys.some((key) => !commandKeys.has(key)) ||
        coverage.adapterKeys.some((key) => !adapterKeys.has(key)) ||
        coverage.externalContractKeys.some((key) => !contractKeys.has(key)) ||
        coverage.mappingKeys.some((key) => !mappingKeys.has(key)) ||
        coverage.routeKeys.some((key) => !routeKeys.has(key))) {
      context.addIssue({ code: "custom", path: ["requirementCoverage"], message: "Requirement coverage must reference declared Event and Integration subjects" })
    }
  }
})

export const eventIntegrationModelInputSchema = rejectSecrets(eventIntegrationModelInputBaseSchema)

export const eventIntegrationModelSchema = eventIntegrationModelInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("event-integration-model-candidate"),
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
    "event-integration-model-is-a-candidate-registry-and-does-not-prove-event-occurrence-send-or-deliver-a-command-accept-an-external-contract-activate-an-adapter-create-an-authorization-grant-execute-an-effect-establish-operational-readiness-or-authorize-action",
  ),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Event and Integration Model revisions after revision one require an exact predecessor digest" })
  }
})

export const exactEventIntegrationModelReferenceSchema = exactBoundedContextModelReferenceSchema

export const eventIntegrationModelStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("event-integration-model-status"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  model: exactEventIntegrationModelReferenceSchema.optional(),
  eventTypeCount: z.number().int().nonnegative().max(8_192),
  commandCount: z.number().int().nonnegative().max(8_192),
  adapterCount: z.number().int().nonnegative().max(4_096),
  externalContractCount: z.number().int().nonnegative().max(8_192),
  mappingCount: z.number().int().nonnegative().max(8_192),
  routeCount: z.number().int().nonnegative().max(8_192),
  uncoveredProcessEventCount: z.number().int().nonnegative().max(65_536),
  uncoveredProcessCount: z.number().int().nonnegative().max(512),
  uncoveredBoundedContextCount: z.number().int().nonnegative().max(2_048),
  uncoveredDataEntityCount: z.number().int().nonnegative().max(2_048),
  uncoveredAuthorizationActionCount: z.number().int().nonnegative().max(4_096),
  unknownMappingTruthCount: z.number().int().nonnegative().max(131_072),
  unresolvedRequirementCount: z.number().int().nonnegative().max(eventIntegrationRequirementIds.length),
  inconsistencyCount: z.number().int().nonnegative().max(512),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(512),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "event-integration-model-status-reports-candidate-coverage-and-gaps-and-does-not-prove-event-occurrence-send-or-deliver-a-command-accept-an-external-contract-activate-an-adapter-create-an-authorization-grant-execute-an-effect-establish-operational-readiness-or-authorize-action",
  ),
}).strict()

export const eventIntegrationModelProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("event-integration-model-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: eventIntegrationModelStatusSchema,
  model: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    membershipDigest: digestSchema,
    state: z.literal("candidate"),
    eventTypeCount: z.number().int().nonnegative().max(8_192),
    commandCount: z.number().int().nonnegative().max(8_192),
    adapterCount: z.number().int().nonnegative().max(4_096),
    externalContractCount: z.number().int().nonnegative().max(8_192),
    mappingCount: z.number().int().nonnegative().max(8_192),
    routeCount: z.number().int().nonnegative().max(8_192),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-identities-counts-statuses-and-digests-only-not-event-payloads-command-inputs-mapping-content-external-locators-source-content-personal-data-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "event-integration-model-projection-does-not-prove-event-occurrence-send-or-deliver-a-command-accept-an-external-contract-activate-an-adapter-create-an-authorization-grant-execute-an-effect-establish-operational-readiness-or-authorize-action",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId ||
      projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId ||
      projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Event and Integration Model projection must bind the exact Product and Initiative revisions" })
  }
})

export type EventIntegrationModelInput = z.infer<typeof eventIntegrationModelInputSchema>
export type EventIntegrationModel = z.infer<typeof eventIntegrationModelSchema>
export type ExactEventIntegrationModelReference = z.infer<typeof exactEventIntegrationModelReferenceSchema>
export type EventIntegrationModelStatus = z.infer<typeof eventIntegrationModelStatusSchema>
export type EventIntegrationModelProjection = z.infer<typeof eventIntegrationModelProjectionSchema>
