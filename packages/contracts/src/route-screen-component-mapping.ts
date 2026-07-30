import { z } from "zod"

import { exactAcceptanceCriteriaReferenceSchema } from "./acceptance-criteria.js"
import { businessContextBindingSchema } from "./business-understanding.js"
import { exactDesignBaselineCandidateReferenceSchema } from "./design-baseline.js"
import { exactDesignRequirementsReferenceSchema } from "./design-requirements.js"
import { exactDesignToCodeBindingRegistryReferenceSchema } from "./design-to-code-binding-registry.js"
import { exactDesignToRequirementBindingReferenceSchema } from "./design-to-requirement-binding.js"
import { exactFigmaToBoilerplateMappingReferenceSchema } from "./figma-to-boilerplate-mapping.js"
import { exactImplementationUnitModelReferenceSchema } from "./implementation-unit-model.js"
import { exactInformationArchitectureModelReferenceSchema } from "./information-architecture-model.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactScreenStateInventoryReferenceSchema } from "./screen-state-inventory.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const requirementKeySchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()

function unique(values: readonly string[]): boolean { return new Set(values).size === values.length }
function canonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}
function canonicalList<T extends z.ZodTypeAny>(schema: T, maximum = 32_768) {
  return z.array(schema).max(maximum)
    .refine((values) => unique(values as string[]), "Values must be unique")
    .refine((values) => canonical(values as string[]), "Values must use canonical lexical ordering")
}
function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Route, Screen, and Component Mapping candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalIdentifiersSchema = canonicalList(identifierSchema)
const requiredCanonicalIdentifiersSchema = canonicalIdentifiersSchema
  .refine((values) => values.length > 0, "At least one identifier is required")
const canonicalUuidsSchema = canonicalList(z.string().uuid())
const requiredCanonicalUuidsSchema = canonicalUuidsSchema
  .refine((values) => values.length > 0, "At least one record identity is required")
const canonicalRequirementKeysSchema = canonicalList(requirementKeySchema, 4_096)
const requiredCanonicalRequirementKeysSchema = canonicalRequirementKeysSchema
  .refine((values) => values.length > 0, "At least one Requirement key is required")
const canonicalTextListSchema = canonicalList(shortTextSchema, 512)

export const routeScreenComponentSubjectKinds = ["component", "route", "screen", "state"] as const
export const routeScreenComponentSubjectKindSchema = z.enum(routeScreenComponentSubjectKinds)
export const routeScreenComponentDispositionSchema = z.enum([
  "candidate-conflict", "candidate-mapped", "candidate-unmapped", "not-assessed",
])
export const routeScreenComponentRelationshipKindSchema = z.enum([
  "fallback", "route-to-screen", "screen-to-component", "screen-to-state", "state-to-component", "transition",
])

export const routeScreenComponentEvidenceReferenceSchema = z.object({
  kind: z.enum([
    "acceptance-criteria", "design-baseline", "design-requirement", "design-to-code-binding",
    "design-to-requirement", "evidence", "figma-to-boilerplate-mapping", "implementation-unit",
    "information-architecture", "screen-state-inventory", "test-inventory",
  ]),
  sourceId: shortTextSchema,
  revision: z.number().int().positive(),
  digest: digestSchema,
  evidenceState: z.enum(["candidate-asserted", "human-reviewed", "source-recorded"]),
}).strict()

const evidenceListSchema = z.array(routeScreenComponentEvidenceReferenceSchema).max(256).refine(
  (values) => unique(values.map((value) => `${value.kind}:${value.sourceId}:${value.revision}:${value.digest}`)),
  "Route, Screen, and Component Mapping evidence references must be unique",
)

export const routeScreenComponentSubjectSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(65_536),
  subjectKind: routeScreenComponentSubjectKindSchema,
  sourceKey: identifierSchema,
  designToCodeBindingSubjectId: z.string().uuid().optional(),
  routeKeys: canonicalIdentifiersSchema,
  screenKeys: canonicalIdentifiersSchema,
  stateKeys: canonicalIdentifiersSchema,
  platformKeys: requiredCanonicalIdentifiersSchema,
  responsiveTargetKeys: requiredCanonicalIdentifiersSchema,
  designBindingKeys: canonicalIdentifiersSchema,
  requirementKeys: requiredCanonicalRequirementKeysSchema,
  acceptanceCriterionIds: requiredCanonicalUuidsSchema,
  implementationUnitIds: requiredCanonicalUuidsSchema,
  codeBindingSubjectIds: canonicalUuidsSchema,
  testHookCandidates: requiredCanonicalIdentifiersSchema,
  disposition: routeScreenComponentDispositionSchema,
  evidenceReferences: evidenceListSchema,
  conflictReferenceCandidates: evidenceListSchema,
  mappedBy: humanActorSchema.optional(),
  mappedAt: z.string().datetime().optional(),
  navigationTruthState: z.literal("not-established"),
  uiValidityState: z.literal("not-established"),
  repositoryTruthState: z.literal("not-established"),
  mappingTruthState: z.literal("not-established"),
  mappingCompletenessState: z.literal("not-established"),
  testCoverageState: z.literal("not-established"),
  codeMutationState: z.literal("not-performed"),
  implementationAuthorityState: z.literal("not-granted"),
}).strict().superRefine((subject, context) => {
  if (subject.subjectKind === "route" &&
      (subject.routeKeys.length !== 1 || subject.routeKeys[0] !== subject.sourceKey || subject.screenKeys.length === 0)) {
    context.addIssue({ code: "custom", path: ["routeKeys"], message: "Route subjects require their exact route key and at least one candidate screen" })
  }
  if (subject.subjectKind === "screen" &&
      (subject.screenKeys.length !== 1 || subject.screenKeys[0] !== subject.sourceKey || subject.routeKeys.length === 0)) {
    context.addIssue({ code: "custom", path: ["screenKeys"], message: "Screen subjects require their exact screen key and at least one candidate route" })
  }
  if (subject.subjectKind === "state" &&
      (subject.stateKeys.length !== 1 || subject.stateKeys[0] !== subject.sourceKey || subject.screenKeys.length !== 1)) {
    context.addIssue({ code: "custom", path: ["stateKeys"], message: "State subjects require their exact state key and one candidate parent screen" })
  }
  if (subject.subjectKind === "component" &&
      (!subject.designToCodeBindingSubjectId || subject.codeBindingSubjectIds.length === 0 || subject.screenKeys.length === 0)) {
    context.addIssue({ code: "custom", path: ["designToCodeBindingSubjectId"], message: "Component subjects require an exact design-to-code binding and at least one candidate parent screen" })
  }
  if (subject.subjectKind !== "component" && subject.designToCodeBindingSubjectId) {
    context.addIssue({ code: "custom", path: ["designToCodeBindingSubjectId"], message: "Only component subjects may identify a source design-to-code binding subject" })
  }
  if (subject.disposition === "candidate-mapped" &&
      (subject.evidenceReferences.length === 0 || !subject.mappedBy || !subject.mappedAt)) {
    context.addIssue({ code: "custom", path: ["disposition"], message: "A mapped candidate requires exact evidence and attributable human mapping metadata" })
  }
  if (subject.disposition !== "candidate-mapped" && (subject.mappedBy || subject.mappedAt)) {
    context.addIssue({ code: "custom", path: ["mappedBy"], message: "Only mapped candidates may carry human mapping attribution" })
  }
  if (subject.disposition === "candidate-conflict" && subject.conflictReferenceCandidates.length === 0) {
    context.addIssue({ code: "custom", path: ["conflictReferenceCandidates"], message: "A mapping conflict candidate requires an exact conflict reference candidate" })
  }
})

export const routeScreenComponentRelationshipSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().positive().max(262_144),
  relationshipKind: routeScreenComponentRelationshipKindSchema,
  fromSubjectId: z.string().uuid(),
  toSubjectId: z.string().uuid(),
  state: z.enum(["candidate-conflict", "candidate-defined", "not-assessed"]),
  evidenceReferences: evidenceListSchema,
}).strict().superRefine((relationship, context) => {
  if (relationship.fromSubjectId === relationship.toSubjectId) {
    context.addIssue({ code: "custom", path: ["toSubjectId"], message: "Mapping relationships cannot self-reference" })
  }
  if (relationship.state === "candidate-defined" && relationship.evidenceReferences.length === 0) {
    context.addIssue({ code: "custom", path: ["evidenceReferences"], message: "Candidate-defined relationships require exact evidence" })
  }
})

const routeScreenComponentMappingInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  informationArchitecture: exactInformationArchitectureModelReferenceSchema,
  screenStateInventory: exactScreenStateInventoryReferenceSchema,
  designRequirements: exactDesignRequirementsReferenceSchema,
  designBaseline: exactDesignBaselineCandidateReferenceSchema,
  designToRequirementBinding: exactDesignToRequirementBindingReferenceSchema,
  figmaToBoilerplateMapping: exactFigmaToBoilerplateMappingReferenceSchema,
  designToCodeBindingRegistry: exactDesignToCodeBindingRegistryReferenceSchema,
  implementationUnitModel: exactImplementationUnitModelReferenceSchema,
  acceptanceCriteria: exactAcceptanceCriteriaReferenceSchema,
  subjects: z.array(routeScreenComponentSubjectSchema).min(1).max(65_536),
  relationships: z.array(routeScreenComponentRelationshipSchema).min(1).max(262_144),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema.refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  figmaConnectionState: z.literal("not-connected"),
  returnedFigmaContentState: z.literal("not-established"),
  designValidityState: z.literal("not-established"),
  designApprovalState: z.literal("not-established"),
  designBaselineDesignationState: z.literal("not-established"),
  navigationTruthState: z.literal("not-established"),
  routeScreenComponentMappingTruthState: z.literal("not-established"),
  routeScreenComponentMappingCompletenessState: z.literal("not-established"),
  uiValidityState: z.literal("not-established"),
  responsiveBehaviorTruthState: z.literal("not-established"),
  platformParityState: z.literal("not-established"),
  requirementSatisfactionState: z.literal("not-established"),
  acceptanceCriteriaValidityState: z.literal("not-established"),
  repositoryTruthState: z.literal("not-established"),
  pathSymbolTruthState: z.literal("not-established"),
  testCoverageState: z.literal("not-established"),
  codeTargetMutationState: z.literal("not-performed"),
  codeGenerationState: z.literal("not-performed"),
  implementationReadinessState: z.literal("not-established"),
  implementationCompletenessState: z.literal("not-established"),
  assignmentExecutionState: z.literal("not-established"),
  acceptanceDecisionState: z.literal("not-established"),
  mergeReadinessState: z.literal("not-established"),
  releaseReadinessState: z.literal("not-established"),
  deploymentReadinessState: z.literal("not-established"),
  actionAuthorityState: z.literal("not-granted"),
}).strict().superRefine((candidate, context) => {
  const subjectIds = candidate.subjects.map((subject) => subject.id)
  const sourceKeys = candidate.subjects.map((subject) =>
    `${subject.subjectKind}:${subject.sourceKey}:${subject.designToCodeBindingSubjectId ?? ""}`)
  if (!unique(subjectIds) || !unique(sourceKeys)) {
    context.addIssue({ code: "custom", path: ["subjects"], message: "Mapping subject identities and source-kind keys must be unique" })
  }
  for (const [index, subject] of candidate.subjects.entries()) {
    if (subject.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["subjects", index, "ordinal"], message: "Mapping subjects must use contiguous canonical ordinal ordering" })
  }
  const availableSubjects = new Set(subjectIds)
  const relationshipIds = candidate.relationships.map((relationship) => relationship.id)
  if (!unique(relationshipIds)) context.addIssue({ code: "custom", path: ["relationships"], message: "Mapping relationship identities must be unique" })
  for (const [index, relationship] of candidate.relationships.entries()) {
    if (relationship.ordinal !== index + 1) context.addIssue({ code: "custom", path: ["relationships", index, "ordinal"], message: "Mapping relationships must use contiguous canonical ordinal ordering" })
    if (!availableSubjects.has(relationship.fromSubjectId) || !availableSubjects.has(relationship.toSubjectId)) {
      context.addIssue({ code: "custom", path: ["relationships", index], message: "Mapping relationships must reference declared subjects" })
    }
  }
  if (candidate.reviewState === "ready-for-human-review" &&
      (candidate.unresolvedQuestions.length > 0 ||
       candidate.subjects.some((subject) => subject.disposition !== "candidate-mapped" || subject.evidenceReferences.length === 0 || !subject.mappedBy || !subject.mappedAt) ||
       candidate.relationships.some((relationship) => relationship.state !== "candidate-defined" || relationship.evidenceReferences.length === 0))) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Review-ready Route, Screen, and Component Mapping requires complete evidence-backed mapped subjects and defined relationships with no unresolved questions" })
  }
})

export const routeScreenComponentMappingInputSchema = rejectSecrets(routeScreenComponentMappingInputBaseSchema)

const authorityBoundary = "route-screen-component-mapping-is-a-versioned-candidate-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-navigation-route-screen-state-component-responsive-platform-requirement-acceptance-criteria-test-coverage-repository-path-symbol-or-mapping-truth-or-completeness-create-or-change-code-or-design-targets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const

export const routeScreenComponentMappingSchema = routeScreenComponentMappingInputSchema.safeExtend({
  schemaVersion: z.literal(1), kind: z.literal("route-screen-component-mapping-candidate"),
  id: z.string().uuid(), productId: z.string().uuid(), revision: z.number().int().positive(),
  subjectCatalogDigest: digestSchema, relationshipCatalogDigest: digestSchema, traceReceiptDigest: digestSchema,
  mappingReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
  predecessorDigest: digestSchema.optional(), state: z.literal("candidate"),
  createdBy: humanActorSchema, updatedBy: humanActorSchema,
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(), authorityBoundary: z.literal(authorityBoundary),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Route, Screen, and Component Mapping revisions after revision one require an exact predecessor digest" })
  }
})

export const exactRouteScreenComponentMappingReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

const statusAuthorityBoundary = "route-screen-component-mapping-status-is-observational-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-navigation-route-screen-state-component-responsive-platform-requirement-acceptance-criteria-test-coverage-repository-path-symbol-or-mapping-truth-or-completeness-create-or-change-code-or-design-targets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const

export const routeScreenComponentMappingStatusSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("route-screen-component-mapping-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactRouteScreenComponentMappingReferenceSchema.optional(),
  informationArchitecture: exactInformationArchitectureModelReferenceSchema.optional(),
  screenStateInventory: exactScreenStateInventoryReferenceSchema.optional(),
  designRequirements: exactDesignRequirementsReferenceSchema.optional(),
  designBaseline: exactDesignBaselineCandidateReferenceSchema.optional(),
  designToRequirementBinding: exactDesignToRequirementBindingReferenceSchema.optional(),
  figmaToBoilerplateMapping: exactFigmaToBoilerplateMappingReferenceSchema.optional(),
  designToCodeBindingRegistry: exactDesignToCodeBindingRegistryReferenceSchema.optional(),
  implementationUnitModel: exactImplementationUnitModelReferenceSchema.optional(),
  acceptanceCriteria: exactAcceptanceCriteriaReferenceSchema.optional(),
  sourceRouteCount: z.number().int().nonnegative().max(16_384),
  sourceScreenCount: z.number().int().nonnegative().max(16_384),
  sourceStateCount: z.number().int().nonnegative().max(65_536),
  sourceComponentCount: z.number().int().nonnegative().max(65_536),
  subjectCount: z.number().int().nonnegative().max(65_536),
  routeSubjectCount: z.number().int().nonnegative().max(16_384),
  screenSubjectCount: z.number().int().nonnegative().max(16_384),
  stateSubjectCount: z.number().int().nonnegative().max(65_536),
  componentSubjectCount: z.number().int().nonnegative().max(65_536),
  mappedCandidateCount: z.number().int().nonnegative().max(65_536),
  conflictCandidateCount: z.number().int().nonnegative().max(65_536),
  unmappedCandidateCount: z.number().int().nonnegative().max(65_536),
  notAssessedCount: z.number().int().nonnegative().max(65_536),
  relationshipCount: z.number().int().nonnegative().max(262_144),
  definedRelationshipCount: z.number().int().nonnegative().max(262_144),
  conflictRelationshipCount: z.number().int().nonnegative().max(262_144),
  notAssessedRelationshipCount: z.number().int().nonnegative().max(262_144),
  missingSubjectCount: z.number().int().nonnegative().max(65_536),
  extraSubjectCount: z.number().int().nonnegative().max(65_536),
  invalidSubjectCount: z.number().int().nonnegative().max(65_536),
  missingRelationshipCount: z.number().int().nonnegative().max(262_144),
  invalidRelationshipCount: z.number().int().nonnegative().max(262_144),
  traceGapCount: z.number().int().nonnegative().max(65_536),
  evidenceGapCount: z.number().int().nonnegative().max(65_536),
  componentPlacementGapCount: z.number().int().nonnegative().max(65_536),
  testHookGapCount: z.number().int().nonnegative().max(65_536),
  staleBindingCount: z.number().int().nonnegative().max(1),
  staleDependencyCount: z.number().int().nonnegative().max(9),
  invalidCandidateCount: z.number().int().nonnegative().max(1),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "candidate-complete"]),
  reasons: z.array(shortTextSchema).max(1_024), assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(statusAuthorityBoundary),
}).strict().superRefine((status, context) => {
  if (status.routeSubjectCount + status.screenSubjectCount + status.stateSubjectCount + status.componentSubjectCount !== status.subjectCount ||
      status.mappedCandidateCount + status.conflictCandidateCount + status.unmappedCandidateCount + status.notAssessedCount !== status.subjectCount ||
      status.definedRelationshipCount + status.conflictRelationshipCount + status.notAssessedRelationshipCount !== status.relationshipCount) {
    context.addIssue({ code: "custom", path: ["subjectCount"], message: "Mapping subject, disposition, and relationship counts must reconcile" })
  }
  const gaps = status.conflictCandidateCount + status.unmappedCandidateCount + status.notAssessedCount +
    status.conflictRelationshipCount + status.notAssessedRelationshipCount + status.missingSubjectCount +
    status.extraSubjectCount + status.invalidSubjectCount + status.missingRelationshipCount +
    status.invalidRelationshipCount + status.traceGapCount + status.evidenceGapCount +
    status.componentPlacementGapCount + status.testHookGapCount + status.staleBindingCount +
    status.staleDependencyCount + status.invalidCandidateCount + status.unresolvedQuestionCount
  const dependencies = [status.informationArchitecture, status.screenStateInventory, status.designRequirements,
    status.designBaseline, status.designToRequirementBinding, status.figmaToBoilerplateMapping,
    status.designToCodeBindingRegistry, status.implementationUnitModel, status.acceptanceCriteria]
  const sourceCount = status.sourceRouteCount + status.sourceScreenCount + status.sourceStateCount + status.sourceComponentCount
  if (status.state === "candidate-complete" &&
      (gaps > 0 || !status.candidate || dependencies.some((dependency) => !dependency) ||
       status.subjectCount !== sourceCount || status.mappedCandidateCount !== status.subjectCount ||
       status.definedRelationshipCount !== status.relationshipCount || status.reviewState !== "ready-for-human-review" ||
       status.reasons.length > 0)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Candidate-complete Route, Screen, and Component Mapping requires exact current dependencies and complete evidence-backed subject and relationship coverage with no structural gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Route, Screen, and Component Mapping status must expose reasons" })
  }
})

const projectionAuthorityBoundary = "route-screen-component-mapping-projection-is-read-only-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-navigation-route-screen-state-component-responsive-platform-requirement-acceptance-criteria-test-coverage-repository-path-symbol-or-mapping-truth-or-completeness-create-or-change-code-or-design-targets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-counts-statuses-and-subject-relationship-trace-mapping-assessment-snapshot-digests-only-not-route-pattern-screen-state-component-design-requirement-criterion-unit-repository-module-path-symbol-test-hook-evidence-reviewer-personal-data-secrets-credentials-or-machine-paths" as const

export const routeScreenComponentMappingProjectionSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal("route-screen-component-mapping-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]) }).strict(),
  status: routeScreenComponentMappingStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.literal("candidate"),
    subjectCatalogDigest: digestSchema, relationshipCatalogDigest: digestSchema, traceReceiptDigest: digestSchema,
    mappingReceiptDigest: digestSchema, assessmentReceiptDigest: digestSchema,
    subjectCount: z.number().int().nonnegative().max(65_536),
    routeSubjectCount: z.number().int().nonnegative().max(16_384),
    screenSubjectCount: z.number().int().nonnegative().max(16_384),
    stateSubjectCount: z.number().int().nonnegative().max(65_536),
    componentSubjectCount: z.number().int().nonnegative().max(65_536),
    mappedCandidateCount: z.number().int().nonnegative().max(65_536),
    conflictCandidateCount: z.number().int().nonnegative().max(65_536),
    unmappedCandidateCount: z.number().int().nonnegative().max(65_536),
    notAssessedCount: z.number().int().nonnegative().max(65_536),
    relationshipCount: z.number().int().nonnegative().max(262_144),
    definedRelationshipCount: z.number().int().nonnegative().max(262_144),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(), privacyBoundary: z.literal(privacyBoundary),
  authorityBoundary: z.literal(projectionAuthorityBoundary), snapshotDigest: digestSchema,
}).strict()

export type RouteScreenComponentSubjectKind = z.infer<typeof routeScreenComponentSubjectKindSchema>
export type RouteScreenComponentEvidenceReference = z.infer<typeof routeScreenComponentEvidenceReferenceSchema>
export type RouteScreenComponentMappingInput = z.infer<typeof routeScreenComponentMappingInputSchema>
export type RouteScreenComponentMapping = z.infer<typeof routeScreenComponentMappingSchema>
export type RouteScreenComponentMappingStatus = z.infer<typeof routeScreenComponentMappingStatusSchema>
export type RouteScreenComponentMappingProjection = z.infer<typeof routeScreenComponentMappingProjectionSchema>
