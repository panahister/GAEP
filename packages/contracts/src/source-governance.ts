import { z } from "zod"

import {
  containsSecretShapedValue,
  exactDomainRecordReferenceSchema,
  informationClassificationSchema,
  portableLocatorSchema,
  trustAssessmentLevelSchema,
} from "./product-studio.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const longTextSchema = z.string().trim().min(10).max(20_000)
const actorSchema = z.object({
  kind: z.enum(["human", "agent", "system", "external"]),
  id: shortTextSchema,
}).strict()
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()

function hasUniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable source-governance records cannot contain secret-shaped values",
  }) as unknown as T
}

export const sourceMaterialTypeSchema = z.enum([
  "stakeholder-note",
  "voice-transcript",
  "whiteboard",
  "feature-list",
  "research",
  "repository",
  "requirements",
  "design",
  "architecture",
  "production-observation",
  "policy",
  "standard",
  "boilerplate",
  "dataset",
  "external-system",
  "other",
])

export const sourceKnowledgeDispositionSchema = z.enum([
  "confirmed",
  "inferred",
  "assumed",
  "placeholder",
  "deferred",
  "unknown",
])

export const sourceRevisionIdentitySchema = z.object({
  kind: z.enum(["resource-revision", "external-revision", "snapshot", "content-version"]),
  value: z.string().trim().min(1).max(2_000).refine(
    (value) => !/^(?:current|latest|stable|head|main|master)$/iu.test(value),
    "Mutable aliases cannot be the exact source revision",
  ),
}).strict()

export const sourceOwnerSchema = z.object({
  kind: z.enum(["human", "organization", "role", "system", "unassigned"]),
  id: shortTextSchema.optional(),
}).strict().superRefine((owner, context) => {
  if (owner.kind === "unassigned" && owner.id !== undefined) {
    context.addIssue({ code: "custom", path: ["id"], message: "Unassigned source ownership cannot name an identity" })
  }
  if (owner.kind !== "unassigned" && owner.id === undefined) {
    context.addIssue({ code: "custom", path: ["id"], message: "Assigned source ownership requires an identity" })
  }
})

export const sourceSemanticAuthoritySchema = z.object({
  standing: z.enum(["authoritative", "advisory", "non-authoritative", "unknown"]),
  domain: shortTextSchema,
  scope: z.array(shortTextSchema).min(1).max(128).refine(hasUniqueValues, "Source authority scope must be unique"),
  basis: longTextSchema,
  declaredBy: humanActorSchema,
}).strict()

export const sourceRecordInputSchema = rejectSecrets(z.object({
  initiativeId: z.string().uuid(),
  sourceType: sourceMaterialTypeSchema,
  title: z.string().trim().min(2).max(240),
  description: longTextSchema,
  locator: portableLocatorSchema,
  revisionIdentity: sourceRevisionIdentitySchema,
  contentDigest: digestSchema,
  digestScope: shortTextSchema,
  owner: sourceOwnerSchema,
  semanticAuthority: sourceSemanticAuthoritySchema,
  knowledgeDisposition: sourceKnowledgeDispositionSchema,
  trust: z.object({
    sourceAuthenticity: trustAssessmentLevelSchema,
    contentIntegrity: trustAssessmentLevelSchema,
  }).strict(),
  informationClassification: informationClassificationSchema,
  rights: z.object({
    status: z.enum(["verified", "restricted", "unknown"]),
    basis: shortTextSchema,
  }).strict(),
  freshness: z.object({
    status: z.enum(["fresh", "potentially-stale", "stale", "unknown"]),
    assessedAt: z.string().datetime(),
    basis: shortTextSchema,
    validUntil: z.string().datetime().optional(),
  }).strict(),
  availability: z.object({
    status: z.enum(["available", "unavailable", "moved", "deleted", "unknown"]),
    basis: shortTextSchema,
  }).strict(),
  limitations: z.array(shortTextSchema).max(128).refine(hasUniqueValues, "Source limitations must be unique"),
}).strict().superRefine((source, context) => {
  if (source.freshness.validUntil &&
      Date.parse(source.freshness.validUntil) <= Date.parse(source.freshness.assessedAt)) {
    context.addIssue({
      code: "custom",
      path: ["freshness", "validUntil"],
      message: "Source freshness validity must end after assessment",
    })
  }
  if (source.rights.status !== "verified" && source.semanticAuthority.standing === "authoritative") {
    context.addIssue({
      code: "custom",
      path: ["semanticAuthority", "standing"],
      message: "A source with unverified or restricted rights cannot claim authoritative standing",
    })
  }
  if (
    source.trust.sourceAuthenticity === "failed" ||
    source.trust.contentIntegrity === "failed" ||
    ["unavailable", "deleted"].includes(source.availability.status)
  ) {
    if (source.semanticAuthority.standing === "authoritative") {
      context.addIssue({
        code: "custom",
        path: ["semanticAuthority", "standing"],
        message: "Failed or unavailable source material cannot claim authoritative standing",
      })
    }
  }
}))

export const sourceRecordSchema = sourceRecordInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("source-record"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  recordedBy: humanActorSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "source-semantic-authority-is-an-attributed-input-claim-and-does-not-grant-decision-approval-authorization-or-action-authority",
  ),
}).strict()

export const exactSourceReferenceSchema = z.object({
  sourceId: z.string().uuid(),
  sourceRevision: z.number().int().positive(),
  recordDigest: digestSchema,
  contentDigest: digestSchema,
}).strict()

export const sourceRecordRevisionSchema = rejectSecrets(z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("source-record-revision"),
  productId: z.string().uuid(),
  sourceId: z.string().uuid(),
  revision: z.number().int().positive(),
  recordDigest: digestSchema,
  predecessorDigest: digestSchema.optional(),
  snapshot: sourceRecordSchema,
  recordedAt: z.string().datetime(),
}).strict().superRefine((history, context) => {
  if (
    history.snapshot.productId !== history.productId ||
    history.snapshot.id !== history.sourceId ||
    history.snapshot.revision !== history.revision
  ) {
    context.addIssue({
      code: "custom",
      path: ["snapshot"],
      message: "Source history identity and revision must match its snapshot",
    })
  }
  if ((history.revision === 1) !== (history.predecessorDigest === undefined)) {
    context.addIssue({
      code: "custom",
      path: ["predecessorDigest"],
      message: "Only source revisions after revision one require an exact predecessor digest",
    })
  }
}))

export const sourceBaselineInputSchema = rejectSecrets(z.object({
  initiativeId: z.string().uuid(),
  title: z.string().trim().min(2).max(240),
  purpose: longTextSchema,
  scope: z.array(shortTextSchema).min(1).max(128).refine(hasUniqueValues, "Source baseline scope must be unique"),
  members: z.array(exactSourceReferenceSchema).min(1).max(2_000).refine(
    (members) => hasUniqueValues(members.map((member) => member.sourceId)),
    "A source can appear only once in a baseline snapshot",
  ).superRefine((members, context) => {
    const ordered = [...members].sort((left, right) => left.sourceId.localeCompare(right.sourceId))
    if (members.some((member, index) => member.sourceId !== ordered[index]?.sourceId)) {
      context.addIssue({
        code: "custom",
        message: "Source baseline members must use canonical source-ID ordering",
      })
    }
  }),
  limitations: z.array(shortTextSchema).max(128).refine(hasUniqueValues, "Source baseline limitations must be unique"),
}).strict())

export const sourceBaselineSchema = sourceBaselineInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("source-baseline-snapshot"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  revision: z.number().int().positive(),
  membershipDigest: digestSchema,
  predecessorDigest: digestSchema.optional(),
  state: z.literal("candidate"),
  createdBy: humanActorSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "source-baseline-snapshot-is-a-versioned-candidate-and-does-not-approve-designate-authorize-or-supersede",
  ),
}).strict().superRefine((baseline, context) => {
  if ((baseline.revision === 1) !== (baseline.predecessorDigest === undefined)) {
    context.addIssue({
      code: "custom",
      path: ["predecessorDigest"],
      message: "Only baseline revisions after revision one require an exact predecessor digest",
    })
  }
})

export const provenanceTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("governed-record"),
    reference: exactDomainRecordReferenceSchema,
  }).strict(),
  z.object({
    kind: z.literal("claim"),
    lineageId: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    label: shortTextSchema,
  }).strict(),
  z.object({
    kind: z.literal("artifact"),
    lineageId: z.string().uuid(),
    revisionIdentity: sourceRevisionIdentitySchema,
    digest: digestSchema,
    locator: portableLocatorSchema,
    label: shortTextSchema,
  }).strict(),
])

export const sourceProvenanceInputSchema = rejectSecrets(z.object({
  initiativeId: z.string().uuid(),
  target: provenanceTargetSchema,
  disposition: sourceKnowledgeDispositionSchema,
  sources: z.array(z.object({
    reference: exactSourceReferenceSchema,
    role: z.enum(["origin", "supporting", "constraint", "challenge"]),
    rationale: longTextSchema,
  }).strict()).min(1).max(256).refine(
    (sources) => hasUniqueValues(sources.map((source) => source.reference.sourceId)),
    "Provenance source identities must be unique",
  ),
  transformations: z.array(z.object({
    kind: z.enum(["none", "excerpt", "summary", "translation", "aggregation", "inference", "import", "other"]),
    description: longTextSchema,
    inputDigests: z.array(digestSchema).min(1).max(256).refine(
      hasUniqueValues,
      "Transformation input digests must be unique",
    ),
    outputDigest: digestSchema,
    performedBy: actorSchema,
  }).strict()).max(128),
  contributors: z.array(actorSchema).min(1).max(128).refine(
    (contributors) => hasUniqueValues(contributors.map((actor) => `${actor.kind}:${actor.id}`)),
    "Provenance contributors must be unique",
  ),
  generation: z.discriminatedUnion("kind", [
    z.object({
      kind: z.enum(["manual", "import", "transformation"]),
      processId: identifierSchema,
    }).strict(),
    z.object({
      kind: z.literal("run"),
      processId: identifierSchema,
      run: exactDomainRecordReferenceSchema.refine(
        (reference) => reference.recordType === "run",
        "Run provenance requires an exact Run record reference",
      ),
    }).strict(),
  ]),
  omissions: z.array(shortTextSchema).max(128).refine(hasUniqueValues, "Provenance omissions must be unique"),
  uncertainty: z.array(shortTextSchema).max(128).refine(hasUniqueValues, "Provenance uncertainty must be unique"),
  amendment: z.object({
    recordId: z.string().uuid(),
    recordDigest: digestSchema,
    rationale: longTextSchema,
  }).strict().optional(),
}).strict())

export const sourceProvenanceSchema = sourceProvenanceInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("source-provenance-record"),
  id: z.string().uuid(),
  productId: z.string().uuid(),
  recordedBy: humanActorSchema,
  recordedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "provenance-establishes-attributed-lineage-and-does-not-approve-validate-authorize-or-transfer-source-authority",
  ),
}).strict()

export const sourceGovernanceAssessmentSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("source-governance-assessment"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  sourceCount: z.number().int().nonnegative(),
  baselineCount: z.number().int().nonnegative(),
  provenanceCount: z.number().int().nonnegative(),
  currentBaseline: z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    digest: digestSchema,
    membershipDigest: digestSchema,
    status: z.enum(["current", "stale", "incomplete"]),
    memberCount: z.number().int().positive(),
  }).strict().optional(),
  staleSourceCount: z.number().int().nonnegative(),
  unknownAuthorityCount: z.number().int().nonnegative(),
  unbaselinedSourceCount: z.number().int().nonnegative(),
  unprovenancedSourceCount: z.number().int().nonnegative(),
  state: z.enum(["ready", "attention-required"]),
  reasons: z.array(shortTextSchema).max(512),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "source-governance-assessment-reports-recorded-evidence-and-does-not-designate-a-baseline-approve-readiness-or-authorize-action",
  ),
}).strict()

const sourceProjectionLimitSchema = z.object({
  shown: z.number().int().nonnegative().max(200),
  total: z.number().int().nonnegative().max(10_000),
  omitted: z.number().int().nonnegative().max(10_000),
}).strict().refine(
  (limit) => limit.shown + limit.omitted === limit.total,
  "Source projection shown and omitted counts must reconcile to the total",
)

export const sourceGovernanceProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("source-governance-projection"),
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
  assessment: sourceGovernanceAssessmentSchema,
  sources: z.array(z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    title: z.string().trim().min(2).max(240),
    sourceType: sourceMaterialTypeSchema,
    owner: sourceOwnerSchema,
    semanticAuthority: z.object({
      standing: z.enum(["authoritative", "advisory", "non-authoritative", "unknown"]),
      domain: shortTextSchema,
      scope: z.array(shortTextSchema).min(1).max(128),
    }).strict(),
    knowledgeDisposition: sourceKnowledgeDispositionSchema,
    informationClassification: informationClassificationSchema,
    freshness: z.enum(["fresh", "potentially-stale", "stale", "unknown"]),
    availability: z.enum(["available", "unavailable", "moved", "deleted", "unknown"]),
    contentDigest: digestSchema,
    recordDigest: digestSchema,
    updatedAt: z.string().datetime(),
  }).strict()).max(200),
  baselines: z.array(z.object({
    id: z.string().uuid(),
    revision: z.number().int().positive(),
    title: z.string().trim().min(2).max(240),
    state: z.literal("candidate"),
    membershipDigest: digestSchema,
    memberCount: z.number().int().positive().max(2_000),
    assessmentStatus: z.enum(["current", "stale", "incomplete", "not-assessed"]),
    updatedAt: z.string().datetime(),
  }).strict()).max(200),
  provenance: z.array(z.object({
    id: z.string().uuid(),
    targetKind: z.enum(["governed-record", "claim", "artifact"]),
    targetDigest: digestSchema,
    disposition: sourceKnowledgeDispositionSchema,
    sourceCount: z.number().int().positive().max(256),
    transformationCount: z.number().int().nonnegative().max(128),
    amendmentRecordId: z.string().uuid().optional(),
    recordedAt: z.string().datetime(),
  }).strict()).max(200),
  limits: z.object({
    sources: sourceProjectionLimitSchema,
    baselines: sourceProjectionLimitSchema,
    provenance: sourceProjectionLimitSchema,
  }).strict(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-portable-governance-metadata-and-digests-only-not-source-bytes-locators-local-paths-or-credentials",
  ),
  authorityBoundary: z.literal(
    "source-governance-projection-does-not-designate-a-baseline-approve-readiness-transfer-authority-or-authorize-action",
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
      message: "Source projection assessment must bind the exact Product and Initiative revisions",
    })
  }
  for (const key of ["sources", "baselines", "provenance"] as const) {
    if (projection[key].length !== projection.limits[key].shown) {
      context.addIssue({
        code: "custom",
        path: [key],
        message: `Source projection ${key} rows must match the shown count`,
      })
    }
  }
})

export type SourceRecordInput = z.infer<typeof sourceRecordInputSchema>
export type SourceRecord = z.infer<typeof sourceRecordSchema>
export type ExactSourceReference = z.infer<typeof exactSourceReferenceSchema>
export type SourceRecordRevision = z.infer<typeof sourceRecordRevisionSchema>
export type SourceBaselineInput = z.infer<typeof sourceBaselineInputSchema>
export type SourceBaseline = z.infer<typeof sourceBaselineSchema>
export type SourceProvenanceInput = z.infer<typeof sourceProvenanceInputSchema>
export type SourceProvenance = z.infer<typeof sourceProvenanceSchema>
export type SourceGovernanceAssessment = z.infer<typeof sourceGovernanceAssessmentSchema>
export type SourceGovernanceProjection = z.infer<typeof sourceGovernanceProjectionSchema>
