import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { exactDesignApplicabilityReferenceSchema } from "./design-applicability.js"
import { exactDesignPersonaRoleModelReferenceSchema } from "./design-persona-role-model.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactSourceReferenceSchema } from "./source-governance.js"
import { exactUserJourneyModelReferenceSchema, userJourneyPathKindSchema } from "./user-journey-model.js"

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

function canonicalArray<T extends z.ZodType>(schema: T, maximum = 512) {
  return z.array(schema).max(maximum)
    .refine((values) => unique(values as string[]), "Values must be unique")
    .refine((values) => canonical(values as string[]), "Values must use canonical lexical ordering")
}

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Information Architecture candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalIdentifierListSchema = canonicalArray(identifierSchema)
const requiredCanonicalIdentifierListSchema = canonicalIdentifierListSchema
  .refine((values) => values.length > 0, "At least one identifier is required")
const canonicalTextListSchema = canonicalArray(shortTextSchema)
const requiredCanonicalTextListSchema = canonicalTextListSchema
  .refine((values) => values.length > 0, "At least one value is required")
const exactSourceListSchema = z.array(exactSourceReferenceSchema).min(1).max(256)
  .refine((entries) => unique(entries.map((entry) =>
    `${entry.sourceId}:${entry.sourceRevision}:${entry.recordDigest}:${entry.contentDigest}`)), "Source references must be unique")
  .superRefine((entries, context) => {
    const ordered = [...entries].sort((left, right) =>
      left.sourceId.localeCompare(right.sourceId) || left.sourceRevision - right.sourceRevision)
    if (entries.some((entry, index) => entry.sourceId !== ordered[index]?.sourceId ||
        entry.sourceRevision !== ordered[index]?.sourceRevision)) {
      context.addIssue({ code: "custom", message: "Source references must use canonical identity ordering" })
    }
  })

export const informationArchitectureNodeKindValues = [
  "action", "collection", "destination", "guidance", "navigation", "record", "workspace",
] as const
export const informationArchitectureNodeKindSchema = z.enum(informationArchitectureNodeKindValues)

export const informationArchitectureEvidenceStateValues = [
  "disputed", "evidence-linked", "human-reviewed", "hypothesis",
] as const
export const informationArchitectureEvidenceStateSchema = z.enum(informationArchitectureEvidenceStateValues)

const touchpointReferenceSchema = z.object({
  journeyKey: identifierSchema,
  touchpointKey: identifierSchema,
}).strict()

const canonicalTouchpointReferenceListSchema = z.array(touchpointReferenceSchema).max(4_096)
  .refine((entries) => unique(entries.map((entry) => `${entry.journeyKey}:${entry.touchpointKey}`)),
    "Touchpoint references must be unique")
  .refine((entries) => canonical(entries.map((entry) => `${entry.journeyKey}:${entry.touchpointKey}`)),
    "Touchpoint references must use canonical identity ordering")

const evidenceReviewSchema = z.object({
  structure: informationArchitectureEvidenceStateSchema,
  findability: informationArchitectureEvidenceStateSchema,
  comprehension: informationArchitectureEvidenceStateSchema,
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
}).strict().superRefine((evidence, context) => {
  const humanReviewed = [evidence.structure, evidence.findability, evidence.comprehension]
    .includes("human-reviewed")
  const reviewMetadata = evidence.reviewedBy !== undefined || evidence.reviewedAt !== undefined
  if (humanReviewed && (!evidence.reviewedBy || !evidence.reviewedAt)) {
    context.addIssue({ code: "custom", message: "Human-reviewed Information Architecture evidence requires an attributable reviewer and time" })
  }
  if (!humanReviewed && reviewMetadata) {
    context.addIssue({ code: "custom", message: "Only human-reviewed Information Architecture evidence can carry review metadata" })
  }
})

const informationArchitectureContentNodeSchema = z.object({
  key: identifierSchema,
  label: z.string().trim().min(2).max(240),
  kind: informationArchitectureNodeKindSchema,
  parentKey: identifierSchema.optional(),
  position: z.number().int().positive().max(4_096),
  purpose: longTextSchema,
  designScopeKeys: requiredCanonicalIdentifierListSchema,
  journeyKeys: requiredCanonicalIdentifierListSchema,
  touchpoints: canonicalTouchpointReferenceListSchema,
  personaKeys: requiredCanonicalIdentifierListSchema,
  designRoleKeys: requiredCanonicalIdentifierListSchema,
  contentModel: z.object({
    contentType: identifierSchema,
    requiredElementKeys: requiredCanonicalIdentifierListSchema,
    optionalElementKeys: canonicalIdentifierListSchema,
    ownerDesignRoleKeys: requiredCanonicalIdentifierListSchema,
    lifecycleStates: requiredCanonicalIdentifierListSchema,
  }).strict().superRefine((model, context) => {
    if (model.requiredElementKeys.some((key) => model.optionalElementKeys.includes(key))) {
      context.addIssue({ code: "custom", path: ["optionalElementKeys"], message: "Required and optional content elements must be disjoint" })
    }
  }),
  findability: z.object({
    entryPointKeys: requiredCanonicalIdentifierListSchema,
    labelAlternatives: requiredCanonicalTextListSchema,
    searchTerms: requiredCanonicalTextListSchema,
    orientationCues: requiredCanonicalTextListSchema,
  }).strict(),
  accessibilityRequirements: requiredCanonicalTextListSchema,
  inclusionRequirements: requiredCanonicalTextListSchema,
  privacyAndDataUse: z.object({
    dataCategories: canonicalIdentifierListSchema,
    purpose: longTextSchema,
    minimization: longTextSchema,
    retention: shortTextSchema,
    prohibitedUses: requiredCanonicalTextListSchema,
  }).strict(),
  fallback: longTextSchema,
  evidence: evidenceReviewSchema,
  sources: exactSourceListSchema,
  validationState: z.literal("not-established"),
}).strict().superRefine((node, context) => {
  if (node.parentKey === node.key) {
    context.addIssue({ code: "custom", path: ["parentKey"], message: "An Information Architecture node cannot parent itself" })
  }
  if (node.touchpoints.some((entry) => !node.journeyKeys.includes(entry.journeyKey))) {
    context.addIssue({ code: "custom", path: ["touchpoints"], message: "Content-node touchpoints must belong to a declared journey" })
  }
  if (node.contentModel.ownerDesignRoleKeys.some((key) => !node.designRoleKeys.includes(key))) {
    context.addIssue({ code: "custom", path: ["contentModel", "ownerDesignRoleKeys"], message: "Content owners must belong to the node design-role boundary" })
  }
})

const informationArchitectureRouteSchema = z.object({
  key: identifierSchema,
  label: z.string().trim().min(2).max(240),
  kind: userJourneyPathKindSchema,
  journeyKey: identifierSchema,
  journeyPathKey: identifierSchema,
  personaKeys: requiredCanonicalIdentifierListSchema,
  entryNodeKey: identifierSchema,
  nodeKeys: z.array(identifierSchema).min(1).max(4_096)
    .refine((values) => unique(values), "Navigation route node keys must be unique"),
  destinationNodeKey: identifierSchema,
  purpose: longTextSchema,
  entryConditions: requiredCanonicalTextListSchema,
  successCues: requiredCanonicalTextListSchema,
  failureCues: requiredCanonicalTextListSchema,
  recoveryRouteKeys: canonicalIdentifierListSchema,
  accessibilityChecks: requiredCanonicalTextListSchema,
  privacyChecks: requiredCanonicalTextListSchema,
  fallback: longTextSchema,
  evidenceState: informationArchitectureEvidenceStateSchema,
  sources: exactSourceListSchema,
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
  validationState: z.literal("not-established"),
}).strict().superRefine((route, context) => {
  if (route.nodeKeys[0] !== route.entryNodeKey || route.nodeKeys.at(-1) !== route.destinationNodeKey) {
    context.addIssue({ code: "custom", path: ["nodeKeys"], message: "Navigation route endpoints must match the first and last ordered node keys" })
  }
  if (route.recoveryRouteKeys.includes(route.key)) {
    context.addIssue({ code: "custom", path: ["recoveryRouteKeys"], message: "A navigation route cannot recover through itself" })
  }
  const reviewed = route.reviewedBy !== undefined || route.reviewedAt !== undefined
  if (route.evidenceState === "human-reviewed" && (!route.reviewedBy || !route.reviewedAt)) {
    context.addIssue({ code: "custom", message: "Human-reviewed navigation routes require an attributable reviewer and time" })
  }
  if (route.evidenceState !== "human-reviewed" && reviewed) {
    context.addIssue({ code: "custom", message: "Only human-reviewed navigation routes can carry review metadata" })
  }
})

const coverageApprovalSchema = z.object({
  state: z.enum(["approved", "not-required", "pending", "rejected"]),
  decidedBy: humanActorSchema.optional(),
  decidedAt: z.string().datetime().optional(),
  conditions: canonicalTextListSchema,
}).strict().superRefine((approval, context) => {
  const decided = approval.state === "approved" || approval.state === "rejected"
  if (decided !== (approval.decidedBy !== undefined && approval.decidedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Approved or rejected coverage requires an attributable human decision; other states forbid one" })
  }
})

const informationArchitectureScopeCoverageSchema = z.object({
  designScopeKey: identifierSchema,
  status: z.enum(["not-applicable", "represented", "unresolved"]),
  nodeKeys: canonicalIdentifierListSchema,
  routeKeys: canonicalIdentifierListSchema,
  rationale: longTextSchema,
  sources: exactSourceListSchema,
  approval: coverageApprovalSchema,
}).strict().superRefine((coverage, context) => {
  const represented = coverage.nodeKeys.length > 0 && coverage.routeKeys.length > 0
  if ((coverage.status === "represented") !== represented) {
    context.addIssue({ code: "custom", message: "Represented Information Architecture coverage requires nodes and routes; other states forbid them" })
  }
  if (coverage.status === "represented" && coverage.approval.state !== "not-required") {
    context.addIssue({ code: "custom", path: ["approval", "state"], message: "Represented Information Architecture coverage does not require an exception approval" })
  }
  if (coverage.status === "unresolved" && coverage.approval.state !== "pending") {
    context.addIssue({ code: "custom", path: ["approval", "state"], message: "Unresolved Information Architecture coverage must retain a pending human decision" })
  }
  if (coverage.status === "not-applicable" && coverage.approval.state !== "approved") {
    context.addIssue({ code: "custom", path: ["approval", "state"], message: "Not-applicable Information Architecture coverage requires attributable human approval" })
  }
})

const exactDesignApplicabilityBindingSchema = exactDesignApplicabilityReferenceSchema.extend({ membershipDigest: digestSchema }).strict()
const exactDesignPersonaRoleBindingSchema = exactDesignPersonaRoleModelReferenceSchema.extend({ membershipDigest: digestSchema }).strict()
const exactUserJourneyBindingSchema = exactUserJourneyModelReferenceSchema.extend({ membershipDigest: digestSchema }).strict()

const informationArchitectureModelInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  designApplicability: exactDesignApplicabilityBindingSchema,
  designPersonaRoleModel: exactDesignPersonaRoleBindingSchema,
  userJourneyModel: exactUserJourneyBindingSchema,
  contentNodes: z.array(informationArchitectureContentNodeSchema).max(2_048)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Information Architecture node keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Information Architecture nodes must use canonical key ordering"),
  navigationRoutes: z.array(informationArchitectureRouteSchema).max(2_048)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Information Architecture route keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Information Architecture routes must use canonical key ordering"),
  scopeCoverage: z.array(informationArchitectureScopeCoverageSchema).min(1).max(1_024)
    .refine((entries) => unique(entries.map((entry) => entry.designScopeKey)), "Information Architecture scope coverage must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.designScopeKey)), "Information Architecture scope coverage must use canonical scope ordering"),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: requiredCanonicalTextListSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  findabilityValidationState: z.literal("not-established"),
  comprehensionValidationState: z.literal("not-established"),
  accessibilityValidationState: z.literal("not-established"),
  designApprovalState: z.literal("not-established"),
  implementationAuthorityState: z.literal("not-established"),
}).strict().superRefine((model, context) => {
  const nodeByKey = new Map(model.contentNodes.map((node) => [node.key, node]))
  const routeByKey = new Map(model.navigationRoutes.map((route) => [route.key, route]))
  for (const [index, node] of model.contentNodes.entries()) {
    if (node.parentKey && !nodeByKey.has(node.parentKey)) {
      context.addIssue({ code: "custom", path: ["contentNodes", index, "parentKey"], message: "Information Architecture parent must reference a declared node" })
    }
    const visited = new Set([node.key])
    let parentKey = node.parentKey
    while (parentKey) {
      if (visited.has(parentKey)) {
        context.addIssue({ code: "custom", path: ["contentNodes", index, "parentKey"], message: "Information Architecture hierarchy cannot contain cycles" })
        break
      }
      visited.add(parentKey)
      parentKey = nodeByKey.get(parentKey)?.parentKey
    }
  }
  const siblingGroups = new Map<string, number[]>()
  for (const node of model.contentNodes) {
    const key = node.parentKey ?? "<root>"
    siblingGroups.set(key, [...(siblingGroups.get(key) ?? []), node.position])
  }
  for (const positions of siblingGroups.values()) {
    const ordered = [...positions].sort((left, right) => left - right)
    if (ordered.some((position, index) => position !== index + 1)) {
      context.addIssue({ code: "custom", path: ["contentNodes"], message: "Information Architecture siblings must use unique contiguous one-based positions" })
    }
  }
  for (const [index, route] of model.navigationRoutes.entries()) {
    if (route.nodeKeys.some((key) => !nodeByKey.has(key))) {
      context.addIssue({ code: "custom", path: ["navigationRoutes", index, "nodeKeys"], message: "Navigation routes must reference declared content nodes" })
    }
    if (route.recoveryRouteKeys.some((key) => !routeByKey.has(key))) {
      context.addIssue({ code: "custom", path: ["navigationRoutes", index, "recoveryRouteKeys"], message: "Recovery routes must reference declared navigation routes" })
    }
    if (route.kind === "failure" && !route.recoveryRouteKeys.some((key) => routeByKey.get(key)?.kind === "recovery")) {
      context.addIssue({ code: "custom", path: ["navigationRoutes", index, "recoveryRouteKeys"], message: "Every failure navigation route must link to an explicit recovery route" })
    }
    if (route.kind === "recovery" && !model.navigationRoutes.some((candidate) =>
      candidate.kind === "failure" && candidate.journeyKey === route.journeyKey && candidate.recoveryRouteKeys.includes(route.key))) {
      context.addIssue({ code: "custom", path: ["navigationRoutes", index], message: "Every recovery navigation route must be linked from a failure route in the same journey" })
    }
  }
  for (const [index, coverage] of model.scopeCoverage.entries()) {
    if (coverage.nodeKeys.some((key) => !nodeByKey.has(key) || !nodeByKey.get(key)?.designScopeKeys.includes(coverage.designScopeKey)) ||
        coverage.routeKeys.some((key) => !routeByKey.has(key) || !routeByKey.get(key)?.nodeKeys.some((nodeKey) =>
          nodeByKey.get(nodeKey)?.designScopeKeys.includes(coverage.designScopeKey)))) {
      context.addIssue({ code: "custom", path: ["scopeCoverage", index], message: "Information Architecture coverage must reference nodes and routes in the same design scope" })
    }
  }
  const weakNodeEvidence = model.contentNodes.some((node) =>
    [node.evidence.structure, node.evidence.findability, node.evidence.comprehension]
      .some((state) => state === "hypothesis" || state === "disputed"))
  const weakRouteEvidence = model.navigationRoutes.some((route) =>
    route.evidenceState === "hypothesis" || route.evidenceState === "disputed")
  const unresolvedCoverage = model.scopeCoverage.some((coverage) =>
    coverage.status === "unresolved" || coverage.approval.state === "pending" || coverage.approval.state === "rejected")
  if (model.reviewState === "ready-for-human-review" &&
      (weakNodeEvidence || weakRouteEvidence || unresolvedCoverage || model.unresolvedQuestions.length > 0)) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Information Architecture guidance cannot be ready for human review while evidence, coverage, or questions remain unresolved" })
  }
})

export const informationArchitectureModelInputSchema = rejectSecrets(informationArchitectureModelInputBaseSchema)

export const informationArchitectureModelSchema = informationArchitectureModelInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("information-architecture-model-candidate"),
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
    "information-architecture-is-candidate-guidance-and-does-not-prove-findability-comprehension-or-accessibility-validate-content-approve-design-grant-readiness-or-authorize-action",
  ),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Information Architecture revisions after revision one require an exact predecessor digest" })
  }
})

export const exactInformationArchitectureModelReferenceSchema = z.object({
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

export const informationArchitectureModelStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("information-architecture-model-status"),
  productId: z.string().uuid(),
  productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(),
  initiativeRevision: z.number().int().positive(),
  candidate: exactInformationArchitectureModelReferenceSchema.optional(),
  nodeCount: z.number().int().nonnegative().max(2_048),
  rootNodeCount: z.number().int().nonnegative().max(2_048),
  routeCount: z.number().int().nonnegative().max(2_048),
  representedScopeCount: z.number().int().nonnegative().max(1_024),
  unresolvedScopeCount: z.number().int().nonnegative().max(1_024),
  weakEvidenceNodeCount: z.number().int().nonnegative().max(2_048),
  weakEvidenceRouteCount: z.number().int().nonnegative().max(2_048),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "information-architecture-status-is-observational-and-does-not-prove-findability-comprehension-or-accessibility-validate-content-approve-design-grant-readiness-or-authorize-action",
  ),
}).strict().superRefine((status, context) => {
  const gaps = status.unresolvedScopeCount + status.weakEvidenceNodeCount + status.weakEvidenceRouteCount +
    status.staleBindingCount + status.staleSourceReferenceCount + status.unresolvedQuestionCount
  if (status.state === "complete-for-review" &&
      (gaps > 0 || status.reviewState !== "ready-for-human-review" || status.reasons.length > 0 || !status.candidate)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires an exact review-ready Information Architecture candidate with no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Information Architecture status must expose reasons" })
  }
})

export const informationArchitectureModelProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("information-architecture-model-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: informationArchitectureModelStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    membershipDigest: digestSchema, state: z.literal("candidate"),
    nodeCount: z.number().int().nonnegative(), rootNodeCount: z.number().int().nonnegative(),
    routeCount: z.number().int().nonnegative(),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-record-identities-counts-statuses-and-digests-only-not-node-route-content-persona-source-or-personal-content-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "information-architecture-projection-is-read-only-and-does-not-prove-findability-comprehension-or-accessibility-validate-content-approve-design-grant-readiness-or-authorize-write-or-action",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Information Architecture projection must bind the exact Product and Initiative revisions" })
  }
})

export type InformationArchitectureNodeKind = z.infer<typeof informationArchitectureNodeKindSchema>
export type InformationArchitectureEvidenceState = z.infer<typeof informationArchitectureEvidenceStateSchema>
export type InformationArchitectureModelInput = z.infer<typeof informationArchitectureModelInputSchema>
export type InformationArchitectureModel = z.infer<typeof informationArchitectureModelSchema>
export type ExactInformationArchitectureModelReference = z.infer<typeof exactInformationArchitectureModelReferenceSchema>
export type InformationArchitectureModelStatus = z.infer<typeof informationArchitectureModelStatusSchema>
export type InformationArchitectureModelProjection = z.infer<typeof informationArchitectureModelProjectionSchema>
