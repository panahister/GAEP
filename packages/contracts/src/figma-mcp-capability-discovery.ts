import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { exactDesignApplicabilityReferenceSchema } from "./design-applicability.js"
import { exactManualFigmaExecutionPathReferenceSchema } from "./manual-figma-execution-path.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactSourceReferenceSchema } from "./source-governance.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
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
    message: "Figma MCP Capability Discovery candidates cannot contain secret-shaped values",
  }) as unknown as T
}

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
const exactManualFigmaExecutionPathBindingSchema = exactManualFigmaExecutionPathReferenceSchema
  .extend({ membershipDigest: digestSchema }).strict()

const candidateOwnershipSchema = z.object({
  state: z.enum(["assigned-candidate", "unresolved"]),
  owner: actorSchema.optional(),
}).strict().superRefine((ownership, context) => {
  if ((ownership.state === "assigned-candidate") !== (ownership.owner !== undefined)) {
    context.addIssue({ code: "custom", message: "Candidate ownership requires an explicit actor; unresolved ownership forbids one" })
  }
})

export const figmaMcpCapabilityClasses = [
  "capability-discovery",
  "export",
  "read-content",
  "read-metadata",
  "read-variables",
  "unknown",
  "write-design",
] as const

const permissionRequirementSchema = z.object({
  key: identifierSchema,
  accessClass: z.enum(["administrative", "read", "unknown", "write"]),
  requirementState: z.enum(["not-required", "optional", "required", "unknown"]),
  grantState: z.literal("not-granted"),
  rationale: shortTextSchema,
  sources: exactSourceListSchema,
}).strict()

const capabilityLimitSchema = z.object({
  key: identifierSchema,
  kind: z.enum(["file-size", "node-count", "payload-size", "rate-limit", "timeout", "unknown", "other"]),
  state: z.enum(["declared", "observed", "unknown"]),
  value: z.number().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  unit: shortTextSchema.optional(),
  rationale: shortTextSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((limit, context) => {
  const resolved = limit.state !== "unknown"
  if (resolved !== (limit.value !== undefined && limit.unit !== undefined)) {
    context.addIssue({ code: "custom", message: "Resolved capability limits require a bounded value and unit; unknown limits forbid invented values" })
  }
})

export const figmaMcpToolObservationSchema = z.object({
  key: identifierSchema,
  toolName: shortTextSchema,
  capabilityClass: z.enum(figmaMcpCapabilityClasses),
  effectClass: z.enum(["figma-read", "figma-write", "observation-only", "unknown"]),
  availabilityState: z.enum(["advertised", "not-advertised", "unknown"]),
  versionState: z.enum(["known", "unknown"]),
  version: shortTextSchema.optional(),
  schemaDigest: digestSchema.optional(),
  permissions: z.array(permissionRequirementSchema).max(256)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Permission keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Permissions must use canonical key ordering"),
  limits: z.array(capabilityLimitSchema).max(256)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Capability limit keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Capability limits must use canonical key ordering"),
  evidenceState: z.enum(["human-reviewed", "not-assessed", "source-recorded"]),
  evidenceDigests: canonicalDigestListSchema,
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
  sources: exactSourceListSchema,
  limitations: canonicalTextListSchema,
}).strict().superRefine((tool, context) => {
  if ((tool.versionState === "known") !== (tool.version !== undefined)) {
    context.addIssue({ code: "custom", path: ["version"], message: "Known tool versions require an exact value; unknown versions forbid one" })
  }
  const reviewed = tool.evidenceState === "human-reviewed"
  if (reviewed !== (tool.reviewedBy !== undefined && tool.reviewedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Human-reviewed tool observations require an attributable reviewer and time; other states forbid them" })
  }
  if ((tool.evidenceState === "not-assessed") !== (tool.evidenceDigests.length === 0)) {
    context.addIssue({ code: "custom", path: ["evidenceDigests"], message: "Assessed tool observations require evidence digests; not-assessed observations forbid them" })
  }
  if (tool.availabilityState === "advertised" && tool.schemaDigest === undefined) {
    context.addIssue({ code: "custom", path: ["schemaDigest"], message: "Advertised tools require an exact observed schema digest" })
  }
  if (tool.effectClass === "figma-write" && tool.permissions.every((permission) => permission.accessClass !== "write")) {
    context.addIssue({ code: "custom", path: ["permissions"], message: "Advertised Figma-write tools require an explicit ungranted write permission requirement" })
  }
})

const adapterObservationSchema = z.object({
  key: identifierSchema,
  kind: z.literal("figma-mcp"),
  displayName: shortTextSchema,
  transportClass: z.enum(["local-process", "remote-service", "unknown"]),
  installationState: z.enum(["not-observed", "observed", "unknown"]),
  discoveryInterfaceState: z.enum(["advertised", "not-advertised", "unknown"]),
  adapterVersionState: z.enum(["known", "unknown"]),
  adapterVersion: shortTextSchema.optional(),
  protocolVersionState: z.enum(["known", "unknown"]),
  protocolVersion: shortTextSchema.optional(),
  sources: exactSourceListSchema,
  limitations: canonicalTextListSchema,
}).strict().superRefine((adapter, context) => {
  if ((adapter.adapterVersionState === "known") !== (adapter.adapterVersion !== undefined)) {
    context.addIssue({ code: "custom", path: ["adapterVersion"], message: "Known adapter versions require an exact value; unknown versions forbid one" })
  }
  if ((adapter.protocolVersionState === "known") !== (adapter.protocolVersion !== undefined)) {
    context.addIssue({ code: "custom", path: ["protocolVersion"], message: "Known protocol versions require an exact value; unknown versions forbid one" })
  }
})

const discoveryObservationSchema = z.object({
  state: z.enum(["human-reviewed", "not-assessed", "source-recorded"]),
  catalogDigest: digestSchema.optional(),
  observedAt: z.string().datetime().optional(),
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
}).strict().superRefine((observation, context) => {
  const assessed = observation.state !== "not-assessed"
  if (assessed !== (observation.catalogDigest !== undefined && observation.observedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Assessed discovery observations require an exact catalog digest and observation time; not-assessed observations forbid them" })
  }
  const reviewed = observation.state === "human-reviewed"
  if (reviewed !== (observation.reviewedBy !== undefined && observation.reviewedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Human-reviewed discovery observations require an attributable reviewer and review time; other states forbid them" })
  }
})

const figmaMcpCapabilityDiscoveryInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  designApplicability: exactDesignApplicabilityBindingSchema,
  manualFigmaExecutionPath: exactManualFigmaExecutionPathBindingSchema,
  adapter: adapterObservationSchema,
  observation: discoveryObservationSchema,
  tools: z.array(figmaMcpToolObservationSchema).max(16_384)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Observed tool keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Observed tools must use canonical key ordering")
    .refine((entries) => unique(entries.map((entry) => entry.toolName)), "Observed tool names must be unique"),
  catalogState: z.enum(["candidate-observation-complete", "not-assessed"]),
  permissionModelState: z.enum(["candidate-separated", "contradicted", "not-assessed"]),
  limitCatalogState: z.enum(["candidate-complete", "not-assessed"]),
  versionCatalogState: z.enum(["candidate-complete", "not-assessed"]),
  ownership: candidateOwnershipSchema,
  unresolvedQuestions: canonicalTextListSchema,
  limitations: canonicalTextListSchema.refine((values) => values.length > 0, "At least one limitation is required"),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  figmaConnectionState: z.literal("not-connected"),
  figmaRequestState: z.literal("not-sent"),
  credentialState: z.literal("not-requested"),
  permissionGrantState: z.literal("not-granted"),
  figmaWriteAuthorityState: z.literal("not-granted"),
  designApprovalState: z.literal("not-established"),
  designBaselineState: z.literal("not-established"),
  readinessState: z.literal("not-established"),
  implementationAuthorityState: z.literal("not-granted"),
}).strict().superRefine((discovery, context) => {
  if (discovery.observation.state === "not-assessed" && discovery.tools.length > 0) {
    context.addIssue({ code: "custom", path: ["tools"], message: "Not-assessed discovery cannot invent observed tools" })
  }
  if (discovery.catalogState === "candidate-observation-complete" &&
      (discovery.observation.state !== "human-reviewed" || discovery.tools.length === 0 ||
       discovery.tools.some((tool) => tool.evidenceState !== "human-reviewed"))) {
    context.addIssue({ code: "custom", path: ["catalogState"], message: "Candidate-complete discovery requires a human-reviewed non-empty tool observation catalog" })
  }
  if (discovery.permissionModelState === "candidate-separated" && discovery.tools.some((tool) =>
    tool.effectClass === "unknown" || tool.permissions.some((permission) => permission.accessClass === "unknown" || permission.requirementState === "unknown"))) {
    context.addIssue({ code: "custom", path: ["permissionModelState"], message: "Candidate-separated permissions forbid unknown effect or permission classes" })
  }
  if (discovery.limitCatalogState === "candidate-complete" && discovery.tools.some((tool) =>
    tool.limits.some((limit) => limit.state === "unknown"))) {
    context.addIssue({ code: "custom", path: ["limitCatalogState"], message: "Candidate-complete limit catalogs forbid unknown recorded limit entries" })
  }
  if (discovery.versionCatalogState === "candidate-complete" &&
      (discovery.adapter.adapterVersionState !== "known" || discovery.adapter.protocolVersionState !== "known" ||
       discovery.tools.some((tool) => tool.versionState !== "known"))) {
    context.addIssue({ code: "custom", path: ["versionCatalogState"], message: "Candidate-complete version catalogs require exact adapter, protocol, and tool versions" })
  }
})

export const figmaMcpCapabilityDiscoveryInputSchema = rejectSecrets(figmaMcpCapabilityDiscoveryInputBaseSchema)

export const figmaMcpCapabilityDiscoverySchema = figmaMcpCapabilityDiscoveryInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("figma-mcp-capability-discovery-candidate"),
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
    "figma-mcp-capability-discovery-is-source-backed-candidate-observation-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-establish-tool-availability-or-compatibility-authorize-write-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
  ),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Figma MCP Capability Discovery revisions after revision one require an exact predecessor digest" })
  }
})

export const exactFigmaMcpCapabilityDiscoveryReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const figmaMcpCapabilityDiscoveryStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("figma-mcp-capability-discovery-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactFigmaMcpCapabilityDiscoveryReferenceSchema.optional(),
  toolCount: z.number().int().nonnegative().max(16_384),
  advertisedToolCount: z.number().int().nonnegative().max(16_384),
  unavailableToolCount: z.number().int().nonnegative().max(16_384),
  unknownAvailabilityCount: z.number().int().nonnegative().max(16_384),
  readToolCount: z.number().int().nonnegative().max(16_384),
  writeToolCount: z.number().int().nonnegative().max(16_384),
  unknownEffectCount: z.number().int().nonnegative().max(16_384),
  notAssessedToolCount: z.number().int().nonnegative().max(16_384),
  sourceRecordedToolCount: z.number().int().nonnegative().max(16_384),
  humanReviewedToolCount: z.number().int().nonnegative().max(16_384),
  unresolvedPermissionCount: z.number().int().nonnegative().max(65_536),
  unresolvedLimitCount: z.number().int().nonnegative().max(65_536),
  unresolvedVersionCount: z.number().int().nonnegative().max(16_386),
  unresolvedOwnershipCount: z.number().int().nonnegative().max(1),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  catalogState: z.enum(["candidate-observation-complete", "not-assessed"]),
  permissionModelState: z.enum(["candidate-separated", "contradicted", "not-assessed"]),
  limitCatalogState: z.enum(["candidate-complete", "not-assessed"]),
  versionCatalogState: z.enum(["candidate-complete", "not-assessed"]),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "figma-mcp-capability-discovery-status-is-observational-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-establish-tool-availability-or-compatibility-authorize-write-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
  ),
}).strict().superRefine((status, context) => {
  const gaps = status.unknownAvailabilityCount + status.unknownEffectCount + status.notAssessedToolCount +
    status.sourceRecordedToolCount + status.unresolvedPermissionCount + status.unresolvedLimitCount +
    status.unresolvedVersionCount + status.unresolvedOwnershipCount + status.staleBindingCount +
    status.staleSourceReferenceCount + status.unresolvedQuestionCount
  if (status.state === "complete-for-review" &&
      (gaps > 0 || status.toolCount === 0 || status.catalogState !== "candidate-observation-complete" ||
       status.permissionModelState !== "candidate-separated" || status.limitCatalogState !== "candidate-complete" ||
       status.versionCatalogState !== "candidate-complete" || status.reviewState !== "ready-for-human-review" ||
       status.reasons.length > 0 || !status.candidate)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires an exact human-reviewed capability observation with no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Figma MCP Capability Discovery status must expose reasons" })
  }
})

export const figmaMcpCapabilityDiscoveryProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("figma-mcp-capability-discovery-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: figmaMcpCapabilityDiscoveryStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, membershipDigest: digestSchema,
    state: z.literal("candidate"), toolCount: z.number().int().nonnegative(),
    advertisedToolCount: z.number().int().nonnegative(), readToolCount: z.number().int().nonnegative(),
    writeToolCount: z.number().int().nonnegative(), reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
    updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-record-identities-counts-statuses-and-digests-only-not-tool-names-schemas-permissions-limits-versions-source-content-personal-content-secrets-credentials-or-figma-content",
  ),
  authorityBoundary: z.literal(
    "figma-mcp-capability-discovery-projection-is-read-only-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-establish-tool-availability-or-compatibility-authorize-write-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Figma MCP Capability Discovery projection must bind exact Product and Initiative revisions" })
  }
})

export type FigmaMcpCapabilityDiscoveryInput = z.infer<typeof figmaMcpCapabilityDiscoveryInputSchema>
export type FigmaMcpCapabilityDiscovery = z.infer<typeof figmaMcpCapabilityDiscoverySchema>
export type ExactFigmaMcpCapabilityDiscoveryReference = z.infer<typeof exactFigmaMcpCapabilityDiscoveryReferenceSchema>
export type FigmaMcpCapabilityDiscoveryStatus = z.infer<typeof figmaMcpCapabilityDiscoveryStatusSchema>
export type FigmaMcpCapabilityDiscoveryProjection = z.infer<typeof figmaMcpCapabilityDiscoveryProjectionSchema>
