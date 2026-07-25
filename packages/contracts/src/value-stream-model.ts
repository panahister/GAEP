import { z } from "zod"

import {
  businessCapabilityPlacementSchema,
  exactBusinessCapabilityMapReferenceSchema,
} from "./business-capability-map.js"
import {
  businessContextBindingSchema,
  exactBusinessUnderstandingReferenceSchema,
  exactStakeholderModelReferenceSchema,
} from "./business-understanding.js"
import {
  containsSecretShapedValue,
  informationClassificationSchema,
} from "./product-studio.js"
import { exactSourceReferenceSchema } from "./source-governance.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const longTextSchema = z.string().trim().min(10).max(20_000)
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()

function hasUniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function isCanonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Value Stream Model records cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalIdentifierListSchema = z.array(identifierSchema).max(512)
  .refine(hasUniqueValues, "Identifiers must be unique")
  .refine(isCanonical, "Identifiers must use canonical lexical ordering")

const requiredCanonicalIdentifierListSchema = canonicalIdentifierListSchema.refine(
  (values) => values.length > 0,
  "At least one identifier is required",
)

const canonicalTextListSchema = z.array(shortTextSchema).max(512)
  .refine(hasUniqueValues, "Values must be unique")
  .refine(isCanonical, "Values must use canonical lexical ordering")

const exactSourceListSchema = z.array(exactSourceReferenceSchema).max(256)
  .refine(
    (references) => hasUniqueValues(references.map((reference) =>
      `${reference.sourceId}:${reference.sourceRevision}:${reference.recordDigest}:${reference.contentDigest}`)),
    "Exact Source references must be unique",
  )
  .superRefine((references, context) => {
    const ordered = [...references].sort((left, right) =>
      left.sourceId.localeCompare(right.sourceId) || left.sourceRevision - right.sourceRevision)
    if (references.some((reference, index) =>
      reference.sourceId !== ordered[index]?.sourceId ||
      reference.sourceRevision !== ordered[index]?.sourceRevision)) {
      context.addIssue({
        code: "custom",
        message: "Exact Source references must use canonical Source identity ordering",
      })
    }
  })

const requiredExactSourceListSchema = exactSourceListSchema.refine(
  (references) => references.length > 0,
  "Value-stream claims require at least one exact Source reference",
)

export const valueStreamLifecycleSchema = z.enum([
  "candidate",
  "proposed",
  "active",
  "deprecated",
  "retired",
])

const valueStreamFlowEvidenceSchema = z.object({
  state: z.enum(["absent", "candidate", "observed", "disputed"]),
  statement: longTextSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((evidence, context) => {
  if (evidence.state === "observed" && evidence.sources.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["sources"],
      message: "Observed value-stream flow requires exact evidence",
    })
  }
})

const valueStreamStageSchema = z.object({
  key: identifierSchema,
  sequence: z.number().int().positive().max(512),
  name: z.string().trim().min(2).max(240),
  purpose: longTextSchema,
  entryCriteria: canonicalTextListSchema.refine(
    (values) => values.length > 0,
    "Value-stream stages require entry criteria",
  ),
  exitCriteria: canonicalTextListSchema.refine(
    (values) => values.length > 0,
    "Value-stream stages require exit criteria",
  ),
  capabilityKeys: requiredCanonicalIdentifierListSchema,
  participatingStakeholderKeys: requiredCanonicalIdentifierListSchema,
  outcomeIds: requiredCanonicalIdentifierListSchema,
  inputs: canonicalTextListSchema,
  outputs: canonicalTextListSchema.refine(
    (values) => values.length > 0,
    "Value-stream stages require at least one output",
  ),
  flowEvidence: valueStreamFlowEvidenceSchema,
  sources: requiredExactSourceListSchema,
}).strict()

const valueStreamBottleneckSchema = z.object({
  id: identifierSchema,
  stageKey: identifierSchema,
  severity: z.enum(["observation", "material", "critical"]),
  statement: longTextSchema,
  status: z.enum(["open", "candidate-addressed", "accepted-for-review", "resolved"]),
  ownerStakeholderKey: identifierSchema.optional(),
  reviewTrigger: shortTextSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((bottleneck, context) => {
  if (bottleneck.status === "resolved" && bottleneck.sources.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["sources"],
      message: "Resolved value-stream bottlenecks require exact evidence",
    })
  }
})

const valueStreamRecordSchema = z.object({
  key: identifierSchema,
  name: z.string().trim().min(2).max(240),
  purpose: longTextSchema,
  placement: businessCapabilityPlacementSchema,
  trigger: longTextSchema,
  valueProposition: longTextSchema,
  ownerStakeholderKey: identifierSchema.optional(),
  beneficiaryStakeholderKeys: requiredCanonicalIdentifierListSchema,
  participatingStakeholderKeys: requiredCanonicalIdentifierListSchema,
  objectiveIds: requiredCanonicalIdentifierListSchema,
  outcomeIds: requiredCanonicalIdentifierListSchema,
  capabilityKeys: requiredCanonicalIdentifierListSchema,
  dependencyKeys: canonicalIdentifierListSchema,
  stages: z.array(valueStreamStageSchema).min(1).max(512)
    .superRefine((stages, context) => {
      if (!hasUniqueValues(stages.map((stage) => stage.key))) {
        context.addIssue({ code: "custom", message: "Value-stream stage keys must be unique" })
      }
      if (stages.some((stage, index) => stage.sequence !== index + 1)) {
        context.addIssue({
          code: "custom",
          path: ["sequence"],
          message: "Value-stream stages must use contiguous one-based sequence ordering",
        })
      }
    }),
  bottlenecks: z.array(valueStreamBottleneckSchema).max(256)
    .refine(
      (bottlenecks) => hasUniqueValues(bottlenecks.map((bottleneck) => bottleneck.id)),
      "Value-stream bottleneck identities must be unique",
    )
    .refine(
      (bottlenecks) => isCanonical(bottlenecks.map((bottleneck) => bottleneck.id)),
      "Value-stream bottlenecks must use canonical identity ordering",
    ),
  externalDependencies: canonicalTextListSchema,
  burden: longTextSchema,
  risk: longTextSchema,
  exitPath: longTextSchema,
  lifecycle: valueStreamLifecycleSchema,
  sources: requiredExactSourceListSchema,
}).strict().superRefine((stream, context) => {
  const stageKeys = new Set(stream.stages.map((stage) => stage.key))
  const declaredCapabilities = new Set(stream.capabilityKeys)
  const stagedCapabilities = new Set(stream.stages.flatMap((stage) => stage.capabilityKeys))
  const declaredOutcomes = new Set(stream.outcomeIds)
  const stagedOutcomes = new Set(stream.stages.flatMap((stage) => stage.outcomeIds))
  for (const [index, stage] of stream.stages.entries()) {
    if (stage.capabilityKeys.some((key) => !declaredCapabilities.has(key))) {
      context.addIssue({
        code: "custom",
        path: ["stages", index, "capabilityKeys"],
        message: "Stage capabilities must be declared by their value stream",
      })
    }
    if (stage.outcomeIds.some((id) => !declaredOutcomes.has(id))) {
      context.addIssue({
        code: "custom",
        path: ["stages", index, "outcomeIds"],
        message: "Stage outcomes must be declared by their value stream",
      })
    }
  }
  if (stream.capabilityKeys.some((key) => !stagedCapabilities.has(key))) {
    context.addIssue({
      code: "custom",
      path: ["capabilityKeys"],
      message: "Every declared value-stream capability must be used by a stage",
    })
  }
  if (stream.outcomeIds.some((id) => !stagedOutcomes.has(id))) {
    context.addIssue({
      code: "custom",
      path: ["outcomeIds"],
      message: "Every declared value-stream outcome must be traced through a stage",
    })
  }
  for (const [index, bottleneck] of stream.bottlenecks.entries()) {
    if (!stageKeys.has(bottleneck.stageKey)) {
      context.addIssue({
        code: "custom",
        path: ["bottlenecks", index, "stageKey"],
        message: "Value-stream bottlenecks must reference a recorded stage",
      })
    }
  }
})

export const valueStreamModelInputSchema = rejectSecrets(z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  businessUnderstanding: exactBusinessUnderstandingReferenceSchema,
  stakeholderModel: exactStakeholderModelReferenceSchema,
  outcomeModel: exactBusinessUnderstandingReferenceSchema,
  capabilityMap: exactBusinessCapabilityMapReferenceSchema,
  valueStreams: z.array(valueStreamRecordSchema).min(1).max(256)
    .refine(
      (streams) => hasUniqueValues(streams.map((stream) => stream.key)),
      "Value-stream keys must be unique",
    )
    .refine(
      (streams) => isCanonical(streams.map((stream) => stream.key)),
      "Value streams must use canonical key ordering",
    ),
  limitations: canonicalTextListSchema,
}).strict().superRefine((model, context) => {
  const streamKeys = new Set(model.valueStreams.map((stream) => stream.key))
  const dependencies = new Map(model.valueStreams.map((stream) => [stream.key, stream.dependencyKeys]))
  for (const [index, stream] of model.valueStreams.entries()) {
    if (
      stream.dependencyKeys.includes(stream.key) ||
      stream.dependencyKeys.some((dependency) => !streamKeys.has(dependency))
    ) {
      context.addIssue({
        code: "custom",
        path: ["valueStreams", index, "dependencyKeys"],
        message: "Value-stream dependencies must reference distinct recorded value streams",
      })
    }
  }
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (key: string): void => {
    if (visiting.has(key)) {
      context.addIssue({
        code: "custom",
        path: ["valueStreams"],
        message: "Value-stream dependency graph cannot contain cycles",
      })
      return
    }
    if (visited.has(key)) return
    visiting.add(key)
    for (const dependency of dependencies.get(key) ?? []) visit(dependency)
    visiting.delete(key)
    visited.add(key)
  }
  for (const stream of model.valueStreams) visit(stream.key)
}))

export const exactValueStreamModelReferenceSchema = exactBusinessUnderstandingReferenceSchema

export const valueStreamModelSchema = valueStreamModelInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("value-stream-model"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  predecessorDigest: digestSchema.optional(),
  state: z.literal("candidate"),
  createdBy: humanActorSchema,
  updatedBy: humanActorSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "value-stream-model-records-candidate-value-flow-stages-dependencies-ownership-bottlenecks-and-does-not-approve-baseline-readiness-or-authorize-action",
  ),
}).strict().superRefine((record, context) => {
  if ((record.revision === 1) !== (record.predecessorDigest === undefined)) {
    context.addIssue({
      code: "custom",
      path: ["predecessorDigest"],
      message: "Only Value Stream Model revisions after revision one require an exact predecessor digest",
    })
  }
})

export const valueStreamModelAssessmentSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("value-stream-model-assessment"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  valueStreamModel: exactValueStreamModelReferenceSchema.optional(),
  valueStreamCount: z.number().int().nonnegative().max(256),
  ownedValueStreamCount: z.number().int().nonnegative().max(256),
  unownedValueStreamCount: z.number().int().nonnegative().max(256),
  stageCount: z.number().int().nonnegative().max(131_072),
  dependencyCount: z.number().int().nonnegative().max(65_536),
  capabilityCoverageCount: z.number().int().nonnegative().max(512),
  outcomeCoverageCount: z.number().int().nonnegative().max(512),
  absentFlowEvidenceCount: z.number().int().nonnegative().max(131_072),
  openBottleneckCount: z.number().int().nonnegative(),
  criticalBottleneckCount: z.number().int().nonnegative(),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  state: z.enum(["complete-for-review", "attention-required"]),
  reasons: z.array(shortTextSchema).max(512),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "value-stream-model-assessment-reports-recorded-candidate-flow-coverage-and-gaps-and-does-not-approve-baseline-readiness-or-authorize-action",
  ),
}).strict()

export const valueStreamModelProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("value-stream-model-projection"),
  product: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
  }).strict(),
  initiative: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    state: z.enum(["proposed", "active", "blocked", "completed", "cancelled"]),
  }).strict(),
  assessment: valueStreamModelAssessmentSchema,
  valueStreamModel: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    state: z.literal("candidate"),
    valueStreamCount: z.number().int().nonnegative().max(256),
    ownedValueStreamCount: z.number().int().nonnegative().max(256),
    stageCount: z.number().int().nonnegative().max(131_072),
    dependencyCount: z.number().int().nonnegative().max(65_536),
    openBottleneckCount: z.number().int().nonnegative(),
    criticalBottleneckCount: z.number().int().nonnegative(),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-identities-counts-statuses-and-digests-only-not-value-stream-narrative-personal-data-source-content-locators-or-credentials",
  ),
  authorityBoundary: z.literal(
    "value-stream-model-projection-does-not-approve-baseline-priority-readiness-or-authorize-action",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (
    projection.product.id !== projection.assessment.productId ||
    projection.product.revision !== projection.assessment.productRevision ||
    projection.initiative.id !== projection.assessment.initiativeId ||
    projection.initiative.revision !== projection.assessment.initiativeRevision
  ) {
    context.addIssue({
      code: "custom",
      path: ["assessment"],
      message: "Value Stream Model projection must bind the exact Product and Initiative revisions",
    })
  }
})

export type ValueStreamModelInput = z.infer<typeof valueStreamModelInputSchema>
export type ValueStreamModel = z.infer<typeof valueStreamModelSchema>
export type ExactValueStreamModelReference = z.infer<typeof exactValueStreamModelReferenceSchema>
export type ValueStreamModelAssessment = z.infer<typeof valueStreamModelAssessmentSchema>
export type ValueStreamModelProjection = z.infer<typeof valueStreamModelProjectionSchema>
