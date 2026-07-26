import { z } from "zod"

import { exactBusinessArchitectureBaselineReferenceSchema } from "./business-architecture-baseline.js"
import { businessContextBindingSchema } from "./business-understanding.js"
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
    message: "Portable System/Solution Architecture candidates cannot contain secret-shaped values",
  }) as unknown as T
}

export const architectureConcernCategorySchema = z.enum([
  "boundary",
  "compatibility",
  "data",
  "deployment",
  "evolution",
  "failure-recovery",
  "identity-access",
  "integration",
  "observability",
  "quality-attribute",
  "security-trust",
  "topology",
])

export const architectureViewKindSchema = z.enum([
  "component",
  "container",
  "data-flow",
  "deployment",
  "interface",
  "sequence",
  "state",
  "system-context",
  "trust-boundary",
])

export const architectureElementKindSchema = z.enum([
  "data-asset",
  "deployable-unit",
  "deployment-target",
  "external-system",
  "interface",
  "logical-component",
  "workload",
])

export const architectureRelationKindSchema = z.enum([
  "calls",
  "contains",
  "depends-on",
  "deploys-to",
  "publishes",
  "reads",
  "subscribes",
  "trust-crossing",
  "uses",
  "writes",
])

export const qualityAttributeKindSchema = z.enum([
  "availability",
  "compatibility",
  "confidentiality",
  "consistency",
  "cost",
  "durability",
  "integrity",
  "latency",
  "maintainability",
  "observability",
  "privacy",
  "recoverability",
  "scalability",
  "security",
  "testability",
  "throughput",
])

const architectureConcernSchema = z.object({
  key: identifierSchema,
  category: architectureConcernCategorySchema,
  statement: longTextSchema,
  stakeholderRoleKeys: requiredCanonicalIdentifierListSchema,
  affectedBusinessElementKeys: canonicalIdentifierListSchema,
  priority: z.enum(["critical", "high", "medium", "low", "unresolved"]),
  sources: exactSourceListSchema,
}).strict()

const architectureElementSchema = z.object({
  key: identifierSchema,
  kind: architectureElementKindSchema,
  name: z.string().trim().min(2).max(240),
  responsibility: longTextSchema,
  ownerRoleKey: identifierSchema,
  boundaries: requiredCanonicalTextListSchema,
  technology: z.object({
    disposition: z.enum(["none", "candidate", "constrained", "unresolved"]),
    value: z.string().trim().min(1).max(500).optional(),
    rationale: longTextSchema,
  }).strict().superRefine((technology, context) => {
    if ((technology.disposition === "none" || technology.disposition === "unresolved") && technology.value) {
      context.addIssue({ code: "custom", path: ["value"], message: "No or unresolved technology disposition cannot name a technology" })
    }
    if ((technology.disposition === "candidate" || technology.disposition === "constrained") && !technology.value) {
      context.addIssue({ code: "custom", path: ["value"], message: "Candidate or constrained technology requires an explicit value" })
    }
  }),
  sources: exactSourceListSchema,
}).strict()

const architectureRelationSchema = z.object({
  key: identifierSchema,
  kind: architectureRelationKindSchema,
  fromElementKey: identifierSchema,
  toElementKey: identifierSchema,
  interactionStyle: longTextSchema,
  contract: longTextSchema,
  failureBehavior: longTextSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((relation, context) => {
  if (relation.fromElementKey === relation.toElementKey) {
    context.addIssue({ code: "custom", message: "Architecture relations must connect distinct elements" })
  }
})

const qualityAttributeScenarioSchema = z.object({
  key: identifierSchema,
  attribute: qualityAttributeKindSchema,
  source: longTextSchema,
  stimulus: longTextSchema,
  environment: longTextSchema,
  artifactElementKeys: requiredCanonicalIdentifierListSchema,
  response: longTextSchema,
  measure: longTextSchema,
  target: longTextSchema,
  state: z.enum(["candidate", "unresolved"]),
  verificationApproach: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

const architectureDecisionOptionSchema = z.object({
  key: identifierSchema,
  statement: longTextSchema,
  benefits: requiredCanonicalTextListSchema,
  tradeoffs: requiredCanonicalTextListSchema,
  risks: requiredCanonicalTextListSchema,
  sources: exactSourceListSchema,
}).strict()

const architectureDecisionSchema = z.object({
  key: identifierSchema,
  title: z.string().trim().min(2).max(240),
  concernKeys: requiredCanonicalIdentifierListSchema,
  disposition: z.enum(["candidate", "unresolved"]),
  options: z.array(architectureDecisionOptionSchema).min(2).max(64)
    .refine((options) => unique(options.map((option) => option.key)), "Architecture decision option keys must be unique")
    .refine((options) => canonical(options.map((option) => option.key)), "Architecture decision options must use canonical key ordering"),
  candidateOptionKey: identifierSchema.optional(),
  rationale: longTextSchema,
  assumptions: canonicalTextListSchema,
  consequences: requiredCanonicalTextListSchema,
  invalidationTriggers: requiredCanonicalTextListSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((decision, context) => {
  if ((decision.disposition === "candidate") !== Boolean(decision.candidateOptionKey)) {
    context.addIssue({ code: "custom", path: ["candidateOptionKey"], message: "Only a candidate decision must identify one candidate option" })
  }
  if (decision.candidateOptionKey && !decision.options.some((option) => option.key === decision.candidateOptionKey)) {
    context.addIssue({ code: "custom", path: ["candidateOptionKey"], message: "Candidate option must reference one declared option" })
  }
})

const architectureViewSchema = z.object({
  key: identifierSchema,
  kind: architectureViewKindSchema,
  title: z.string().trim().min(2).max(240),
  audienceRoleKeys: requiredCanonicalIdentifierListSchema,
  concernKeys: requiredCanonicalIdentifierListSchema,
  elementKeys: requiredCanonicalIdentifierListSchema,
  relationKeys: canonicalIdentifierListSchema,
  qualityAttributeKeys: canonicalIdentifierListSchema,
  decisionKeys: canonicalIdentifierListSchema,
  scope: longTextSchema,
  notation: z.enum(["structured-record", "c4-oriented", "mermaid", "uml", "table", "external-versioned"]),
  freshness: z.enum(["candidate-current", "potentially-stale", "stale", "invalidated"]),
  regenerationTriggers: requiredCanonicalTextListSchema,
  sources: exactSourceListSchema,
}).strict()

const architectureConformanceCriterionSchema = z.object({
  key: identifierSchema,
  statement: longTextSchema,
  subjectElementKeys: requiredCanonicalIdentifierListSchema,
  qualityAttributeKeys: canonicalIdentifierListSchema,
  decisionKeys: canonicalIdentifierListSchema,
  method: longTextSchema,
  evidenceExpectation: longTextSchema,
  state: z.enum(["candidate", "unresolved"]),
  sources: exactSourceListSchema,
}).strict()

export const architectureLifecycleTopicSchema = z.enum([
  "compatibility",
  "evolution",
  "migration",
  "recovery",
  "retirement",
])

const architectureLifecycleConsequenceSchema = z.object({
  topic: architectureLifecycleTopicSchema,
  statement: longTextSchema,
  ownerRoleKey: identifierSchema,
  state: z.enum(["candidate", "unresolved", "not-applicable"]),
  rationale: longTextSchema,
  triggers: requiredCanonicalTextListSchema,
  sources: exactSourceListSchema,
}).strict()

const architectureGovernanceSchema = z.object({
  ownerRoleKey: identifierSchema,
  reviewerRoleKeys: requiredCanonicalIdentifierListSchema,
  approvalState: z.literal("not-granted"),
  reviewState: z.enum(["draft", "under-challenge", "awaiting-human-review"]),
  basis: longTextSchema,
  sources: exactSourceListSchema,
}).strict()

const systemSolutionArchitectureInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  purpose: longTextSchema,
  businessArchitectureBaseline: exactBusinessArchitectureBaselineReferenceSchema,
  scope: z.object({
    included: requiredCanonicalTextListSchema,
    excluded: canonicalTextListSchema,
    boundaries: requiredCanonicalTextListSchema,
  }).strict(),
  concerns: z.array(architectureConcernSchema).min(1).max(1_024)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Architecture concern keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Architecture concerns must use canonical key ordering"),
  elements: z.array(architectureElementSchema).min(1).max(2_048)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Architecture element keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Architecture elements must use canonical key ordering"),
  relations: z.array(architectureRelationSchema).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Architecture relation keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Architecture relations must use canonical key ordering"),
  qualityAttributes: z.array(qualityAttributeScenarioSchema).min(1).max(1_024)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Quality-attribute keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Quality attributes must use canonical key ordering"),
  decisions: z.array(architectureDecisionSchema).min(1).max(1_024)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Architecture decision keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Architecture decisions must use canonical key ordering"),
  views: z.array(architectureViewSchema).min(1).max(1_024)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Architecture view keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Architecture views must use canonical key ordering"),
  conformanceCriteria: z.array(architectureConformanceCriterionSchema).min(1).max(2_048)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Architecture conformance-criterion keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Architecture conformance criteria must use canonical key ordering"),
  lifecycleConsequences: z.array(architectureLifecycleConsequenceSchema).length(5),
  inconsistencies: canonicalTextListSchema,
  unresolvedQuestions: canonicalTextListSchema,
  governance: architectureGovernanceSchema,
  limitations: canonicalTextListSchema,
}).strict().superRefine((record, context) => {
  const concerns = new Set(record.concerns.map((entry) => entry.key))
  const elements = new Set(record.elements.map((entry) => entry.key))
  const relations = new Set(record.relations.map((entry) => entry.key))
  const qualities = new Set(record.qualityAttributes.map((entry) => entry.key))
  const decisions = new Set(record.decisions.map((entry) => entry.key))
  for (const relation of record.relations) {
    if (!elements.has(relation.fromElementKey) || !elements.has(relation.toElementKey)) {
      context.addIssue({ code: "custom", path: ["relations"], message: "Architecture relations must reference declared elements" })
    }
  }
  for (const scenario of record.qualityAttributes) {
    if (scenario.artifactElementKeys.some((key) => !elements.has(key))) {
      context.addIssue({ code: "custom", path: ["qualityAttributes"], message: "Quality attributes must reference declared elements" })
    }
  }
  for (const decision of record.decisions) {
    if (decision.concernKeys.some((key) => !concerns.has(key))) {
      context.addIssue({ code: "custom", path: ["decisions"], message: "Architecture decisions must reference declared concerns" })
    }
  }
  for (const view of record.views) {
    if (view.concernKeys.some((key) => !concerns.has(key)) ||
        view.elementKeys.some((key) => !elements.has(key)) ||
        view.relationKeys.some((key) => !relations.has(key)) ||
        view.qualityAttributeKeys.some((key) => !qualities.has(key)) ||
        view.decisionKeys.some((key) => !decisions.has(key))) {
      context.addIssue({ code: "custom", path: ["views"], message: "Architecture views must reference declared concerns, elements, relations, quality attributes, and decisions" })
    }
  }
  const viewedConcerns = new Set(record.views.flatMap((entry) => entry.concernKeys))
  const viewedElements = new Set(record.views.flatMap((entry) => entry.elementKeys))
  const viewedQualities = new Set(record.views.flatMap((entry) => entry.qualityAttributeKeys))
  if ([...concerns].some((key) => !viewedConcerns.has(key)) ||
      [...elements].some((key) => !viewedElements.has(key)) ||
      [...qualities].some((key) => !viewedQualities.has(key))) {
    context.addIssue({ code: "custom", path: ["views"], message: "Selected views must cover every declared concern, element, and quality attribute" })
  }
  for (const criterion of record.conformanceCriteria) {
    if (criterion.subjectElementKeys.some((key) => !elements.has(key)) ||
        criterion.qualityAttributeKeys.some((key) => !qualities.has(key)) ||
        criterion.decisionKeys.some((key) => !decisions.has(key))) {
      context.addIssue({ code: "custom", path: ["conformanceCriteria"], message: "Conformance criteria must reference declared architecture subjects" })
    }
  }
  const lifecycleTopics = record.lifecycleConsequences.map((entry) => entry.topic)
  if (!unique(lifecycleTopics) || !canonical(lifecycleTopics) ||
      architectureLifecycleTopicSchema.options.some((topic) => !lifecycleTopics.includes(topic))) {
    context.addIssue({ code: "custom", path: ["lifecycleConsequences"], message: "Every lifecycle consequence topic must appear exactly once in canonical order" })
  }
})

export const systemSolutionArchitectureInputSchema = rejectSecrets(systemSolutionArchitectureInputBaseSchema)

export const systemSolutionArchitectureSchema = systemSolutionArchitectureInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("system-solution-architecture-candidate"),
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
    "system-solution-architecture-is-a-candidate-design-and-does-not-approve-or-designate-an-architecture-baseline-establish-readiness-prove-conformance-mandate-technology-or-authorize-action",
  ),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only System/Solution Architecture revisions after revision one require an exact predecessor digest" })
  }
})

export const exactSystemSolutionArchitectureReferenceSchema = exactBusinessArchitectureBaselineReferenceSchema

export const systemSolutionArchitectureAssessmentSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("system-solution-architecture-assessment"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  architecture: exactSystemSolutionArchitectureReferenceSchema.optional(),
  concernCount: z.number().int().nonnegative().max(1_024),
  viewCount: z.number().int().nonnegative().max(1_024),
  elementCount: z.number().int().nonnegative().max(2_048),
  relationCount: z.number().int().nonnegative().max(4_096),
  qualityAttributeCount: z.number().int().nonnegative().max(1_024),
  unresolvedQualityAttributeCount: z.number().int().nonnegative().max(1_024),
  decisionCount: z.number().int().nonnegative().max(1_024),
  unresolvedDecisionCount: z.number().int().nonnegative().max(1_024),
  conformanceCriterionCount: z.number().int().nonnegative().max(2_048),
  unresolvedConformanceCriterionCount: z.number().int().nonnegative().max(2_048),
  lifecycleGapCount: z.number().int().nonnegative().max(5),
  inconsistencyCount: z.number().int().nonnegative().max(512),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  state: z.enum(["complete-for-review", "attention-required"]),
  reasons: z.array(shortTextSchema).max(512),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "system-solution-architecture-assessment-reports-candidate-coverage-and-gaps-and-does-not-approve-baseline-readiness-conformance-technology-or-action",
  ),
}).strict()

export const systemSolutionArchitectureProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("system-solution-architecture-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  }).strict(),
  assessment: systemSolutionArchitectureAssessmentSchema,
  architecture: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    membershipDigest: digestSchema,
    state: z.literal("candidate"),
    concernCount: z.number().int().nonnegative().max(1_024),
    viewCount: z.number().int().nonnegative().max(1_024),
    elementCount: z.number().int().nonnegative().max(2_048),
    qualityAttributeCount: z.number().int().nonnegative().max(1_024),
    decisionCount: z.number().int().nonnegative().max(1_024),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-identities-counts-statuses-and-digests-only-not-architecture-narrative-source-content-personal-data-locators-or-credentials",
  ),
  authorityBoundary: z.literal(
    "system-solution-architecture-projection-does-not-approve-or-designate-an-architecture-baseline-establish-readiness-prove-conformance-mandate-technology-or-authorize-action",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.assessment.productId ||
      projection.product.revision !== projection.assessment.productRevision ||
      projection.initiative.id !== projection.assessment.initiativeId ||
      projection.initiative.revision !== projection.assessment.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["assessment"], message: "System/Solution Architecture projection must bind the exact Product and Initiative revisions" })
  }
})

export type SystemSolutionArchitectureInput = z.infer<typeof systemSolutionArchitectureInputSchema>
export type SystemSolutionArchitecture = z.infer<typeof systemSolutionArchitectureSchema>
export type ExactSystemSolutionArchitectureReference = z.infer<typeof exactSystemSolutionArchitectureReferenceSchema>
export type SystemSolutionArchitectureAssessment = z.infer<typeof systemSolutionArchitectureAssessmentSchema>
export type SystemSolutionArchitectureProjection = z.infer<typeof systemSolutionArchitectureProjectionSchema>
