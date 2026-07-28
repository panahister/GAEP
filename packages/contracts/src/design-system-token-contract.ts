import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { exactDesignApplicabilityReferenceSchema } from "./design-applicability.js"
import { exactDesignRequirementsReferenceSchema } from "./design-requirements.js"
import { containsSecretShapedValue, informationClassificationSchema } from "./product-studio.js"
import { exactScreenStateInventoryReferenceSchema } from "./screen-state-inventory.js"
import { exactSourceReferenceSchema } from "./source-governance.js"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const identifierSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/)
const requirementKeySchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/)
const tokenPathSchema = z.string().regex(/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/).max(512)
const shortTextSchema = z.string().trim().min(2).max(2_000)
const longTextSchema = z.string().trim().min(10).max(20_000)
const actorSchema = z.object({ kind: z.enum(["human", "role"]), id: shortTextSchema }).strict()
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
    message: "Portable Design System and Token Contract candidates cannot contain secret-shaped values",
  }) as unknown as T
}

const canonicalIdentifierListSchema = canonicalArray(identifierSchema, 16_384)
const canonicalRequirementKeyListSchema = canonicalArray(requirementKeySchema, 4_096)
const canonicalTokenPathListSchema = canonicalArray(tokenPathSchema, 5_000)
const canonicalTextListSchema = canonicalArray(shortTextSchema)
const requiredCanonicalTextListSchema = canonicalTextListSchema
  .refine((values) => values.length > 0, "At least one value is required")
const exactSourceListSchema = z.array(exactSourceReferenceSchema).min(1).max(256)
  .refine((entries) => unique(entries.map((entry) =>
    `${entry.sourceId}:${entry.sourceRevision}:${entry.recordDigest}:${entry.contentDigest}`)),
  "Source references must be unique")
  .refine((entries) => canonical(entries.map((entry) =>
    `${entry.sourceId}:${String(entry.sourceRevision).padStart(12, "0")}`)),
  "Source references must use canonical identity ordering")

const exactDesignApplicabilityBindingSchema = exactDesignApplicabilityReferenceSchema
  .extend({ membershipDigest: digestSchema }).strict()
const exactScreenStateInventoryBindingSchema = exactScreenStateInventoryReferenceSchema
  .extend({ membershipDigest: digestSchema }).strict()
const exactDesignRequirementsBindingSchema = exactDesignRequirementsReferenceSchema
  .extend({ membershipDigest: digestSchema }).strict()

export const exactPortableDesignSnapshotReferenceSchema = z.object({
  bundleId: z.string().uuid(),
  snapshotDigest: digestSchema,
  evidenceDigest: digestSchema,
  sourceReviewStatus: z.enum(["approved", "reviewed", "unreviewed"]),
}).strict()

const candidateOwnershipSchema = z.object({
  state: z.enum(["assigned-candidate", "unresolved"]),
  owner: actorSchema.optional(),
}).strict().superRefine((ownership, context) => {
  if ((ownership.state === "assigned-candidate") !== (ownership.owner !== undefined)) {
    context.addIssue({ code: "custom", message: "Candidate ownership requires an explicit actor; unresolved ownership forbids one" })
  }
})

const approvedDesignSystemReferenceSchema = z.object({
  scopeKind: z.enum(["client-application", "design-artifact", "initiative"]),
  scopeId: identifierSchema,
  name: shortTextSchema,
}).strict()

export const designSystemEntrySchema = z.object({
  key: identifierSchema,
  name: shortTextSchema,
  disposition: z.enum(["candidate-new", "reuse-approved", "unresolved"]),
  approvedReference: approvedDesignSystemReferenceSchema.optional(),
  ownership: candidateOwnershipSchema,
  sources: exactSourceListSchema,
  limitations: canonicalTextListSchema,
}).strict().superRefine((system, context) => {
  if ((system.disposition === "reuse-approved") !== (system.approvedReference !== undefined)) {
    context.addIssue({ code: "custom", path: ["approvedReference"], message: "Reuse-approved systems require an exact Design Applicability reference; other dispositions forbid one" })
  }
})

const importedTokenReferenceSchema = z.object({
  artifactId: z.string().trim().min(1).max(256),
  path: tokenPathSchema,
  type: z.string().regex(/^[a-z][a-z0-9-]*$/).max(80),
  valueDigest: digestSchema,
}).strict()

export const designTokenEntrySchema = z.object({
  path: tokenPathSchema,
  designSystemKey: identifierSchema,
  origin: z.enum(["candidate-declared", "imported-snapshot", "unresolved"]),
  type: z.string().regex(/^[a-z][a-z0-9-]*$/).max(80).optional(),
  valueDigest: digestSchema.optional(),
  importedToken: importedTokenReferenceSchema.optional(),
  ownership: candidateOwnershipSchema,
  requirementKeys: canonicalRequirementKeyListSchema,
  platformKeys: canonicalIdentifierListSchema,
  screenKeys: canonicalIdentifierListSchema,
  accessibilityImpact: z.enum(["human-reviewed", "not-assessed", "review-required"]),
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
  sources: exactSourceListSchema,
}).strict().superRefine((token, context) => {
  const resolved = token.origin !== "unresolved"
  if (resolved !== (token.type !== undefined && token.valueDigest !== undefined)) {
    context.addIssue({ code: "custom", message: "Resolved tokens require type and value digest; unresolved tokens forbid them" })
  }
  if ((token.origin === "imported-snapshot") !== (token.importedToken !== undefined)) {
    context.addIssue({ code: "custom", path: ["importedToken"], message: "Imported tokens require an exact snapshot token reference; other origins forbid one" })
  }
  if (token.importedToken && (token.importedToken.path !== token.path || token.importedToken.type !== token.type ||
      token.importedToken.valueDigest !== token.valueDigest)) {
    context.addIssue({ code: "custom", path: ["importedToken"], message: "Imported token metadata must agree with the governed token entry" })
  }
  const reviewed = token.accessibilityImpact === "human-reviewed"
  if (reviewed !== (token.reviewedBy !== undefined && token.reviewedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Human-reviewed token accessibility impact requires an attributable reviewer and time; other states forbid them" })
  }
})

export const designVariableCollectionSchema = z.object({
  key: identifierSchema,
  designSystemKey: identifierSchema,
  ownership: candidateOwnershipSchema,
  variableKeys: canonicalIdentifierListSchema,
  platformKeys: canonicalIdentifierListSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((collection, context) => {
  if (collection.variableKeys.length === 0) {
    context.addIssue({ code: "custom", path: ["variableKeys"], message: "Variable collections require at least one exact variable" })
  }
})

export const designVariableEntrySchema = z.object({
  key: identifierSchema,
  collectionKey: identifierSchema,
  designSystemKey: identifierSchema,
  state: z.enum(["bound-to-token", "unresolved"]),
  tokenPath: tokenPathSchema.optional(),
  ownership: candidateOwnershipSchema,
  requirementKeys: canonicalRequirementKeyListSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((variable, context) => {
  if ((variable.state === "bound-to-token") !== (variable.tokenPath !== undefined)) {
    context.addIssue({ code: "custom", path: ["tokenPath"], message: "Bound variables require an exact token path; unresolved variables forbid one" })
  }
})

const importedComponentReferenceSchema = z.object({
  artifactId: z.string().trim().min(1).max(256),
  digest: digestSchema,
}).strict()

export const designComponentEntrySchema = z.object({
  key: identifierSchema,
  designSystemKey: identifierSchema,
  disposition: z.enum(["candidate-new", "imported-snapshot", "reuse-approved", "unresolved"]),
  importedComponent: importedComponentReferenceSchema.optional(),
  ownership: candidateOwnershipSchema,
  tokenPaths: canonicalTokenPathListSchema,
  variableKeys: canonicalIdentifierListSchema,
  requirementKeys: canonicalRequirementKeyListSchema,
  platformKeys: canonicalIdentifierListSchema,
  screenKeys: canonicalIdentifierListSchema,
  stateKeys: canonicalIdentifierListSchema,
  variantKeys: canonicalIdentifierListSchema,
  accessibilityEvidenceState: z.enum(["human-reviewed", "not-assessed", "supported"]),
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
  sources: exactSourceListSchema,
}).strict().superRefine((component, context) => {
  if ((component.disposition === "imported-snapshot") !== (component.importedComponent !== undefined)) {
    context.addIssue({ code: "custom", path: ["importedComponent"], message: "Imported components require an exact snapshot artifact reference; other dispositions forbid one" })
  }
  const reviewed = component.accessibilityEvidenceState === "human-reviewed"
  if (reviewed !== (component.reviewedBy !== undefined && component.reviewedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Human-reviewed component accessibility evidence requires an attributable reviewer and time; other states forbid them" })
  }
})

const requirementCoverageSchema = z.object({
  requirementKey: requirementKeySchema,
  state: z.enum(["represented", "unresolved"]),
  tokenPaths: canonicalTokenPathListSchema,
  variableKeys: canonicalIdentifierListSchema,
  componentKeys: canonicalIdentifierListSchema,
  rationale: longTextSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((coverage, context) => {
  const linked = coverage.tokenPaths.length + coverage.variableKeys.length + coverage.componentKeys.length
  if ((coverage.state === "represented") !== (linked > 0)) {
    context.addIssue({ code: "custom", message: "Represented requirements require token, variable, or component links; unresolved coverage forbids them" })
  }
})

const designSystemTokenContractInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  designApplicability: exactDesignApplicabilityBindingSchema,
  screenStateInventory: exactScreenStateInventoryBindingSchema,
  designRequirements: exactDesignRequirementsBindingSchema,
  portableDesignSnapshot: exactPortableDesignSnapshotReferenceSchema.optional(),
  designSystems: z.array(designSystemEntrySchema).min(1).max(256)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Design System keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Design Systems must use canonical key ordering"),
  tokens: z.array(designTokenEntrySchema).max(5_000)
    .refine((entries) => unique(entries.map((entry) => entry.path)), "Design Token paths must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.path)), "Design Tokens must use canonical path ordering"),
  variableCollections: z.array(designVariableCollectionSchema).max(1_024)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Variable Collection keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Variable Collections must use canonical key ordering"),
  variables: z.array(designVariableEntrySchema).max(16_384)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Variable keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Variables must use canonical key ordering"),
  components: z.array(designComponentEntrySchema).max(16_384)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Component keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Components must use canonical key ordering"),
  requirementCoverage: z.array(requirementCoverageSchema).min(1).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.requirementKey)), "Requirement coverage keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.requirementKey)), "Requirement coverage must use canonical key ordering"),
  catalogCompletenessState: z.enum(["candidate-complete", "not-assessed"]),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: requiredCanonicalTextListSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  designSystemValidityState: z.literal("not-established"),
  ownershipAuthorityState: z.literal("not-established"),
  designApprovalState: z.literal("not-established"),
  designBaselineState: z.literal("not-established"),
  readinessState: z.literal("not-established"),
  implementationAuthorityState: z.literal("not-established"),
}).strict().superRefine((candidate, context) => {
  const systemKeys = new Set(candidate.designSystems.map((entry) => entry.key))
  const tokenPaths = new Set(candidate.tokens.map((entry) => entry.path))
  const collectionByKey = new Map(candidate.variableCollections.map((entry) => [entry.key, entry]))
  const variableByKey = new Map(candidate.variables.map((entry) => [entry.key, entry]))
  const componentByKey = new Map(candidate.components.map((entry) => [entry.key, entry]))
  for (const [index, token] of candidate.tokens.entries()) {
    if (!systemKeys.has(token.designSystemKey)) context.addIssue({ code: "custom", path: ["tokens", index, "designSystemKey"], message: "Tokens must target an exact Design System" })
  }
  for (const [index, collection] of candidate.variableCollections.entries()) {
    if (!systemKeys.has(collection.designSystemKey) || collection.variableKeys.some((key) => variableByKey.get(key)?.collectionKey !== collection.key)) {
      context.addIssue({ code: "custom", path: ["variableCollections", index], message: "Variable Collections must target exact same-system Variables" })
    }
  }
  for (const [index, variable] of candidate.variables.entries()) {
    const collection = collectionByKey.get(variable.collectionKey)
    if (!collection || collection.designSystemKey !== variable.designSystemKey || !collection.variableKeys.includes(variable.key) ||
        (variable.tokenPath !== undefined && !tokenPaths.has(variable.tokenPath))) {
      context.addIssue({ code: "custom", path: ["variables", index], message: "Variables must reconcile to an exact same-system collection and token" })
    }
  }
  for (const [index, component] of candidate.components.entries()) {
    if (!systemKeys.has(component.designSystemKey) || component.tokenPaths.some((path) => !tokenPaths.has(path)) ||
        component.variableKeys.some((key) => !variableByKey.has(key))) {
      context.addIssue({ code: "custom", path: ["components", index], message: "Components must target exact Design Systems, Tokens, and Variables" })
    }
  }
  for (const [index, coverage] of candidate.requirementCoverage.entries()) {
    if (coverage.tokenPaths.some((path) => !tokenPaths.has(path)) || coverage.variableKeys.some((key) => !variableByKey.has(key)) ||
        coverage.componentKeys.some((key) => !componentByKey.has(key))) {
      context.addIssue({ code: "custom", path: ["requirementCoverage", index], message: "Requirement coverage must reference exact Tokens, Variables, and Components" })
    }
  }
  const unresolved = candidate.designSystems.some((entry) => entry.disposition === "unresolved" || entry.ownership.state === "unresolved") ||
    candidate.tokens.some((entry) => entry.origin === "unresolved" || entry.ownership.state === "unresolved" || entry.accessibilityImpact !== "human-reviewed") ||
    candidate.variables.some((entry) => entry.state === "unresolved" || entry.ownership.state === "unresolved") ||
    candidate.components.some((entry) => entry.disposition === "unresolved" || entry.ownership.state === "unresolved" || entry.accessibilityEvidenceState === "not-assessed") ||
    candidate.requirementCoverage.some((entry) => entry.state === "unresolved")
  if (candidate.reviewState === "ready-for-human-review" &&
      (candidate.catalogCompletenessState !== "candidate-complete" || unresolved || candidate.unresolvedQuestions.length > 0)) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Design System and Token Contract cannot be review-ready while catalogs, ownership, accessibility, coverage, or questions remain unresolved" })
  }
})

export const designSystemTokenContractInputSchema = rejectSecrets(designSystemTokenContractInputBaseSchema)

export const designSystemTokenContractSchema = designSystemTokenContractInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("design-system-token-contract-candidate"),
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
    "design-system-token-contract-is-candidate-metadata-and-does-not-establish-design-system-token-variable-or-component-validity-ownership-authority-accessibility-design-approval-baseline-readiness-implementation-or-action-authority",
  ),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Design System and Token Contract revisions after revision one require an exact predecessor digest" })
  }
})

export const exactDesignSystemTokenContractReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const designSystemTokenContractStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("design-system-token-contract-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactDesignSystemTokenContractReferenceSchema.optional(),
  designSystemCount: z.number().int().nonnegative().max(256),
  tokenCount: z.number().int().nonnegative().max(5_000),
  variableCollectionCount: z.number().int().nonnegative().max(1_024),
  variableCount: z.number().int().nonnegative().max(16_384),
  componentCount: z.number().int().nonnegative().max(16_384),
  representedRequirementCount: z.number().int().nonnegative().max(4_096),
  unresolvedRequirementCount: z.number().int().nonnegative().max(4_096),
  unresolvedOwnershipCount: z.number().int().nonnegative().max(38_208),
  unresolvedCatalogItemCount: z.number().int().nonnegative().max(38_208),
  accessibilityReviewGapCount: z.number().int().nonnegative().max(21_384),
  staleBindingCount: z.number().int().nonnegative(),
  stalePortableSnapshotCount: z.number().int().nonnegative().max(1),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  catalogCompletenessState: z.enum(["candidate-complete", "not-assessed"]),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "design-system-token-contract-status-is-observational-and-does-not-establish-design-system-token-variable-or-component-validity-ownership-authority-accessibility-design-approval-baseline-readiness-implementation-or-action-authority",
  ),
}).strict().superRefine((status, context) => {
  const gaps = status.unresolvedRequirementCount + status.unresolvedOwnershipCount + status.unresolvedCatalogItemCount +
    status.accessibilityReviewGapCount + status.staleBindingCount + status.stalePortableSnapshotCount +
    status.staleSourceReferenceCount + status.unresolvedQuestionCount
  if (status.state === "complete-for-review" &&
      (gaps > 0 || status.catalogCompletenessState !== "candidate-complete" || status.reviewState !== "ready-for-human-review" ||
       status.reasons.length > 0 || !status.candidate)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires an exact review-ready Design System and Token Contract candidate with no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Design System and Token Contract status must expose reasons" })
  }
})

export const designSystemTokenContractProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("design-system-token-contract-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: designSystemTokenContractStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, membershipDigest: digestSchema,
    state: z.literal("candidate"), designSystemCount: z.number().int().nonnegative(), tokenCount: z.number().int().nonnegative(),
    variableCollectionCount: z.number().int().nonnegative(), variableCount: z.number().int().nonnegative(),
    componentCount: z.number().int().nonnegative(), representedRequirementCount: z.number().int().nonnegative(),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-record-identities-counts-statuses-and-digests-only-not-token-values-component-content-requirement-source-design-or-personal-content-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "design-system-token-contract-projection-is-read-only-and-does-not-establish-design-system-token-variable-or-component-validity-ownership-authority-accessibility-design-approval-baseline-readiness-implementation-write-or-action-authority",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Design System and Token Contract projection must bind exact Product and Initiative revisions" })
  }
})

export type ExactPortableDesignSnapshotReference = z.infer<typeof exactPortableDesignSnapshotReferenceSchema>
export type DesignSystemTokenContractInput = z.infer<typeof designSystemTokenContractInputSchema>
export type DesignSystemTokenContract = z.infer<typeof designSystemTokenContractSchema>
export type ExactDesignSystemTokenContractReference = z.infer<typeof exactDesignSystemTokenContractReferenceSchema>
export type DesignSystemTokenContractStatus = z.infer<typeof designSystemTokenContractStatusSchema>
export type DesignSystemTokenContractProjection = z.infer<typeof designSystemTokenContractProjectionSchema>
