import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { exactDesignApplicabilityReferenceSchema } from "./design-applicability.js"
import { exactDesignSystemTokenContractReferenceSchema } from "./design-system-token-contract.js"
import { exactFigmaMcpCapabilityDiscoveryReferenceSchema } from "./figma-mcp-capability-discovery.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactSourceReferenceSchema } from "./source-governance.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const externalIdentitySchema = z.string().trim().min(1).max(512)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const actorSchema = z.object({ kind: z.enum(["human", "role"]), id: shortTextSchema }).strict()
const humanActorSchema = z.object({ kind: z.literal("human"), id: shortTextSchema }).strict()

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function canonical(values: readonly string[]): boolean {
  const ordered = [...values].sort((left, right) => left.localeCompare(right))
  return values.every((value, index) => value === ordered[index])
}

function canonicalStringArray<T extends z.ZodType<string>>(schema: T, maximum = 512) {
  return z.array(schema).max(maximum)
    .refine((values) => unique(values), "Values must be unique")
    .refine((values) => canonical(values), "Values must use canonical lexical ordering")
}

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Figma Read Snapshot candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalIdentifierListSchema = canonicalStringArray(identifierSchema, 16_384)
const canonicalTextListSchema = canonicalStringArray(shortTextSchema)
const canonicalDigestListSchema = canonicalStringArray(digestSchema, 1_024)
const exactSourceListSchema = z.array(exactSourceReferenceSchema).min(1).max(256)
  .refine((entries) => unique(entries.map((entry) =>
    `${entry.sourceId}:${entry.sourceRevision}:${entry.recordDigest}:${entry.contentDigest}`)),
  "Source references must be unique")
  .refine((entries) => canonical(entries.map((entry) =>
    `${entry.sourceId}:${String(entry.sourceRevision).padStart(12, "0")}`)),
  "Source references must use canonical identity ordering")

const exactDesignApplicabilityBindingSchema = exactDesignApplicabilityReferenceSchema
  .extend({ membershipDigest: digestSchema }).strict()
const exactDesignSystemTokenContractBindingSchema = exactDesignSystemTokenContractReferenceSchema
  .extend({ membershipDigest: digestSchema }).strict()
const exactFigmaMcpCapabilityDiscoveryBindingSchema = exactFigmaMcpCapabilityDiscoveryReferenceSchema
  .extend({ membershipDigest: digestSchema }).strict()

const candidateOwnershipSchema = z.object({
  state: z.enum(["assigned-candidate", "unresolved"]),
  owner: actorSchema.optional(),
}).strict().superRefine((ownership, context) => {
  if ((ownership.state === "assigned-candidate") !== (ownership.owner !== undefined)) {
    context.addIssue({ code: "custom", message: "Candidate ownership requires an explicit actor; unresolved ownership forbids one" })
  }
})

const observationEvidenceSchema = z.object({
  state: z.enum(["human-reviewed", "not-assessed", "source-recorded"]),
  evidenceDigests: canonicalDigestListSchema,
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
}).strict().superRefine((evidence, context) => {
  if ((evidence.state === "not-assessed") !== (evidence.evidenceDigests.length === 0)) {
    context.addIssue({ code: "custom", path: ["evidenceDigests"], message: "Assessed observations require evidence digests; not-assessed observations forbid them" })
  }
  const reviewed = evidence.state === "human-reviewed"
  if (reviewed !== (evidence.reviewedBy !== undefined && evidence.reviewedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Human-reviewed observations require an attributable reviewer and time; other states forbid them" })
  }
})

const externalObjectProvenanceSchema = z.object({
  provider: z.literal("figma"),
  externalObjectId: externalIdentitySchema,
  externalVersion: externalIdentitySchema,
  observedAt: z.string().datetime(),
  contentDigest: digestSchema,
  evidence: observationEvidenceSchema,
  sources: exactSourceListSchema,
}).strict()

export const figmaFileSnapshotEntrySchema = z.object({
  key: identifierSchema,
  name: shortTextSchema,
  provenance: externalObjectProvenanceSchema,
  lastModifiedAt: z.string().datetime().optional(),
  freshnessState: z.enum(["current-at-capture", "stale-at-capture", "unknown"]),
  accessState: z.literal("read-only-observation"),
  limitations: canonicalTextListSchema,
}).strict()

export const figmaComponentSnapshotEntrySchema = z.object({
  key: identifierSchema,
  fileKey: identifierSchema,
  nodeId: externalIdentitySchema,
  name: shortTextSchema,
  componentKind: z.enum(["component", "component-set", "instance", "variant"]),
  componentKey: externalIdentitySchema.optional(),
  descriptionDigest: digestSchema.optional(),
  propertyDefinitionDigest: digestSchema.optional(),
  provenance: externalObjectProvenanceSchema,
  evidenceState: z.enum(["human-reviewed", "not-assessed", "source-recorded"]),
  sources: exactSourceListSchema,
}).strict()

export const figmaVariableCollectionSnapshotEntrySchema = z.object({
  key: identifierSchema,
  fileKey: identifierSchema,
  collectionId: externalIdentitySchema,
  name: shortTextSchema,
  modeKeys: canonicalIdentifierListSchema,
  variableKeys: canonicalIdentifierListSchema,
  provenance: externalObjectProvenanceSchema,
  evidenceState: z.enum(["human-reviewed", "not-assessed", "source-recorded"]),
  sources: exactSourceListSchema,
}).strict().superRefine((collection, context) => {
  if (collection.modeKeys.length === 0) {
    context.addIssue({ code: "custom", path: ["modeKeys"], message: "Observed variable collections require at least one exact mode" })
  }
})

const modeValueDigestSchema = z.object({
  modeKey: identifierSchema,
  valueDigest: digestSchema,
}).strict()

export const figmaVariableSnapshotEntrySchema = z.object({
  key: identifierSchema,
  fileKey: identifierSchema,
  collectionKey: identifierSchema,
  variableId: externalIdentitySchema,
  name: shortTextSchema,
  resolvedType: z.enum(["boolean", "color", "float", "string", "unknown"]),
  modeValueDigests: z.array(modeValueDigestSchema).max(1_024)
    .refine((entries) => unique(entries.map((entry) => entry.modeKey)), "Variable mode values must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.modeKey)), "Variable mode values must use canonical mode ordering"),
  descriptionDigest: digestSchema.optional(),
  provenance: externalObjectProvenanceSchema,
  evidenceState: z.enum(["human-reviewed", "not-assessed", "source-recorded"]),
  sources: exactSourceListSchema,
}).strict().superRefine((variable, context) => {
  if (variable.resolvedType !== "unknown" && variable.modeValueDigests.length === 0) {
    context.addIssue({ code: "custom", path: ["modeValueDigests"], message: "Resolved variables require at least one exact mode-value digest" })
  }
  if (variable.resolvedType === "unknown" && variable.modeValueDigests.length > 0) {
    context.addIssue({ code: "custom", path: ["modeValueDigests"], message: "Unknown variable types cannot assert resolved mode-value digests" })
  }
})

const captureReceiptSchema = z.object({
  mode: z.enum(["figma-mcp-read-receipt", "manual-export", "source-backed-record"]),
  requestedToolKeys: canonicalIdentifierListSchema,
  readEffectState: z.literal("read-only"),
  receiptDigest: digestSchema,
  payloadDigest: digestSchema,
  capturedAt: z.string().datetime(),
  evidence: observationEvidenceSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((capture, context) => {
  if (capture.mode === "figma-mcp-read-receipt" && capture.requestedToolKeys.length === 0) {
    context.addIssue({ code: "custom", path: ["requestedToolKeys"], message: "Figma MCP read receipts require at least one exact observed read tool key" })
  }
})

const figmaReadSnapshotInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  designApplicability: exactDesignApplicabilityBindingSchema,
  designSystemTokenContract: exactDesignSystemTokenContractBindingSchema,
  figmaMcpCapabilityDiscovery: exactFigmaMcpCapabilityDiscoveryBindingSchema,
  capture: captureReceiptSchema,
  files: z.array(figmaFileSnapshotEntrySchema).min(1).max(256)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Figma file keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Figma files must use canonical key ordering")
    .refine((entries) => unique(entries.map((entry) => entry.provenance.externalObjectId)), "External Figma file identities must be unique"),
  components: z.array(figmaComponentSnapshotEntrySchema).max(16_384)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Figma component keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Figma components must use canonical key ordering")
    .refine((entries) => unique(entries.map((entry) => `${entry.fileKey}:${entry.nodeId}`)), "External Figma component identities must be unique within a file"),
  variableCollections: z.array(figmaVariableCollectionSnapshotEntrySchema).max(1_024)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Figma variable collection keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Figma variable collections must use canonical key ordering")
    .refine((entries) => unique(entries.map((entry) => `${entry.fileKey}:${entry.collectionId}`)), "External Figma collection identities must be unique within a file"),
  variables: z.array(figmaVariableSnapshotEntrySchema).max(16_384)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Figma variable keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Figma variables must use canonical key ordering")
    .refine((entries) => unique(entries.map((entry) => `${entry.fileKey}:${entry.variableId}`)), "External Figma variable identities must be unique within a file"),
  snapshotCompletenessState: z.enum(["candidate-observation-complete", "partial", "not-assessed"]),
  provenanceState: z.enum(["exact", "partial", "not-assessed"]),
  ownership: candidateOwnershipSchema,
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema.refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  figmaConnectionAuthorityState: z.literal("not-granted"),
  credentialAuthorityState: z.literal("not-granted"),
  permissionGrantState: z.literal("not-granted"),
  figmaWriteAuthorityState: z.literal("not-granted"),
  externalCompletenessState: z.literal("not-established"),
  designValidityState: z.literal("not-established"),
  designApprovalState: z.literal("not-established"),
  designBaselineState: z.literal("not-established"),
  readinessState: z.literal("not-established"),
  implementationAuthorityState: z.literal("not-granted"),
}).strict().superRefine((snapshot, context) => {
  const fileKeys = new Set(snapshot.files.map((entry) => entry.key))
  const collectionByKey = new Map(snapshot.variableCollections.map((entry) => [entry.key, entry]))
  const variableByKey = new Map(snapshot.variables.map((entry) => [entry.key, entry]))
  for (const [index, component] of snapshot.components.entries()) {
    if (!fileKeys.has(component.fileKey)) {
      context.addIssue({ code: "custom", path: ["components", index, "fileKey"], message: "Figma components must target an exact file in the snapshot" })
    }
  }
  for (const [index, collection] of snapshot.variableCollections.entries()) {
    if (!fileKeys.has(collection.fileKey) || collection.variableKeys.some((key) => {
      const variable = variableByKey.get(key)
      return !variable || variable.collectionKey !== collection.key || variable.fileKey !== collection.fileKey
    })) {
      context.addIssue({ code: "custom", path: ["variableCollections", index], message: "Figma variable collections must target an exact file and exact same-file variables" })
    }
  }
  for (const [index, variable] of snapshot.variables.entries()) {
    const collection = collectionByKey.get(variable.collectionKey)
    if (!fileKeys.has(variable.fileKey) || !collection || collection.fileKey !== variable.fileKey || !collection.variableKeys.includes(variable.key) ||
        variable.modeValueDigests.some((value) => !collection.modeKeys.includes(value.modeKey))) {
      context.addIssue({ code: "custom", path: ["variables", index], message: "Figma variables must reconcile to an exact same-file collection and declared modes" })
    }
  }
  const observations = [
    ...snapshot.files.map((entry) => entry.provenance.evidence.state),
    ...snapshot.components.map((entry) => entry.evidenceState),
    ...snapshot.variableCollections.map((entry) => entry.evidenceState),
    ...snapshot.variables.map((entry) => entry.evidenceState),
  ]
  if (snapshot.snapshotCompletenessState === "candidate-observation-complete" &&
      (snapshot.components.length === 0 || snapshot.variableCollections.length === 0 || snapshot.variables.length === 0 ||
       observations.some((state) => state !== "human-reviewed"))) {
    context.addIssue({ code: "custom", path: ["snapshotCompletenessState"], message: "Candidate-observation-complete snapshots require non-empty human-reviewed file, component, collection, and variable catalogs" })
  }
  if (snapshot.provenanceState === "exact" &&
      (snapshot.capture.evidence.state !== "human-reviewed" || observations.some((state) => state !== "human-reviewed"))) {
    context.addIssue({ code: "custom", path: ["provenanceState"], message: "Exact provenance requires human-reviewed capture and catalog evidence" })
  }
  if (snapshot.reviewState === "ready-for-human-review" &&
      (snapshot.snapshotCompletenessState !== "candidate-observation-complete" || snapshot.provenanceState !== "exact" ||
       snapshot.files.some((entry) => entry.freshnessState !== "current-at-capture") ||
       snapshot.ownership.state !== "assigned-candidate" || snapshot.unresolvedQuestions.length > 0)) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Figma Read Snapshots cannot be review-ready while snapshot evidence, provenance, freshness, ownership, or questions remain unresolved" })
  }
})

export const figmaReadSnapshotInputSchema = rejectSecrets(figmaReadSnapshotInputBaseSchema)

export const figmaReadSnapshotSchema = figmaReadSnapshotInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("figma-read-snapshot-candidate"),
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
    "figma-read-snapshot-is-source-backed-read-only-candidate-evidence-and-does-not-itself-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-authorize-write-validate-or-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
  ),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Figma Read Snapshot revisions after revision one require an exact predecessor digest" })
  }
})

export const exactFigmaReadSnapshotReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const figmaReadSnapshotStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("figma-read-snapshot-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactFigmaReadSnapshotReferenceSchema.optional(),
  fileCount: z.number().int().nonnegative().max(256),
  componentCount: z.number().int().nonnegative().max(16_384),
  variableCollectionCount: z.number().int().nonnegative().max(1_024),
  variableCount: z.number().int().nonnegative().max(16_384),
  sourceRecordedItemCount: z.number().int().nonnegative().max(33_792),
  humanReviewedItemCount: z.number().int().nonnegative().max(33_792),
  notAssessedItemCount: z.number().int().nonnegative().max(33_792),
  staleFileCount: z.number().int().nonnegative().max(256),
  unknownFreshnessFileCount: z.number().int().nonnegative().max(256),
  unresolvedTypeCount: z.number().int().nonnegative().max(16_384),
  unresolvedOwnershipCount: z.number().int().nonnegative().max(1),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  snapshotCompletenessState: z.enum(["candidate-observation-complete", "partial", "not-assessed"]),
  provenanceState: z.enum(["exact", "partial", "not-assessed"]),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "figma-read-snapshot-status-is-observational-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-authorize-write-validate-or-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
  ),
}).strict().superRefine((status, context) => {
  const gaps = status.sourceRecordedItemCount + status.notAssessedItemCount + status.staleFileCount +
    status.unknownFreshnessFileCount + status.unresolvedTypeCount + status.unresolvedOwnershipCount +
    status.staleBindingCount + status.staleSourceReferenceCount + status.unresolvedQuestionCount
  if (status.state === "complete-for-review" &&
      (gaps > 0 || status.fileCount === 0 || status.componentCount === 0 || status.variableCollectionCount === 0 ||
       status.variableCount === 0 || status.snapshotCompletenessState !== "candidate-observation-complete" ||
       status.provenanceState !== "exact" || status.reviewState !== "ready-for-human-review" ||
       status.reasons.length > 0 || !status.candidate)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires an exact human-reviewed Figma Read Snapshot candidate with no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Figma Read Snapshot status must expose reasons" })
  }
})

export const figmaReadSnapshotProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("figma-read-snapshot-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: figmaReadSnapshotStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, membershipDigest: digestSchema,
    state: z.literal("candidate"), fileCount: z.number().int().nonnegative(), componentCount: z.number().int().nonnegative(),
    variableCollectionCount: z.number().int().nonnegative(), variableCount: z.number().int().nonnegative(),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-record-identities-counts-statuses-and-digests-only-not-figma-file-component-variable-names-external-identities-values-source-content-personal-content-secrets-credentials-or-permissions",
  ),
  authorityBoundary: z.literal(
    "figma-read-snapshot-projection-is-read-only-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-authorize-write-validate-or-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Figma Read Snapshot projection must bind exact Product and Initiative revisions" })
  }
})

export type FigmaReadSnapshotInput = z.infer<typeof figmaReadSnapshotInputSchema>
export type FigmaReadSnapshot = z.infer<typeof figmaReadSnapshotSchema>
export type ExactFigmaReadSnapshotReference = z.infer<typeof exactFigmaReadSnapshotReferenceSchema>
export type FigmaReadSnapshotStatus = z.infer<typeof figmaReadSnapshotStatusSchema>
export type FigmaReadSnapshotProjection = z.infer<typeof figmaReadSnapshotProjectionSchema>
