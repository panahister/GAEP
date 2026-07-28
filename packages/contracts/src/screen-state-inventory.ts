import { z } from "zod"

import { businessContextBindingSchema } from "./business-understanding.js"
import { exactInformationArchitectureModelReferenceSchema, informationArchitectureEvidenceStateSchema } from "./information-architecture-model.js"
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

function canonicalArray<T extends z.ZodType>(schema: T, maximum = 512) {
  return z.array(schema).max(maximum)
    .refine((values) => unique(values as string[]), "Values must be unique")
    .refine((values) => canonical(values as string[]), "Values must use canonical lexical ordering")
}

function rejectSecrets<T extends z.ZodType>(schema: T): T {
  return schema.refine((value) => !containsSecretShapedValue(value), {
    message: "Portable Screen and State Inventory candidates cannot contain secret-shaped values",
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

export const screenPlatformKindValues = ["desktop", "embedded", "mobile", "tablet", "terminal", "web"] as const
export const screenPlatformKindSchema = z.enum(screenPlatformKindValues)

export const screenStateKindValues = [
  "blocked", "default", "degraded", "empty", "error", "loading", "offline", "partial", "success", "unauthorized",
] as const
export const screenStateKindSchema = z.enum(screenStateKindValues)

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
  state: informationArchitectureEvidenceStateSchema,
  reviewedBy: humanActorSchema.optional(),
  reviewedAt: z.string().datetime().optional(),
}).strict().superRefine((evidence, context) => {
  const metadata = evidence.reviewedBy !== undefined || evidence.reviewedAt !== undefined
  if (evidence.state === "human-reviewed" && (!evidence.reviewedBy || !evidence.reviewedAt)) {
    context.addIssue({ code: "custom", message: "Human-reviewed inventory evidence requires an attributable reviewer and time" })
  }
  if (evidence.state !== "human-reviewed" && metadata) {
    context.addIssue({ code: "custom", message: "Only human-reviewed inventory evidence can carry review metadata" })
  }
})

const coverageDecisionSchema = z.object({
  state: z.enum(["approved", "not-required", "pending", "rejected"]),
  decidedBy: humanActorSchema.optional(),
  decidedAt: z.string().datetime().optional(),
  conditions: canonicalTextListSchema,
}).strict().superRefine((decision, context) => {
  const decided = decision.state === "approved" || decision.state === "rejected"
  if (decided !== (decision.decidedBy !== undefined && decision.decidedAt !== undefined)) {
    context.addIssue({ code: "custom", message: "Approved or rejected coverage requires an attributable human decision; other states forbid one" })
  }
})

const screenPlatformSchema = z.object({
  key: identifierSchema,
  label: z.string().trim().min(2).max(240),
  kind: screenPlatformKindSchema,
  supportState: z.enum(["excluded", "targeted", "unresolved"]),
  interactionModes: canonicalIdentifierListSchema,
  viewportOrContainerClasses: canonicalIdentifierListSchema,
  responsiveRules: canonicalTextListSchema,
  accessibilityRequirements: requiredCanonicalTextListSchema,
  privacyRequirements: requiredCanonicalTextListSchema,
  rationale: longTextSchema,
  sources: exactSourceListSchema,
  decision: coverageDecisionSchema,
}).strict().superRefine((platform, context) => {
  if (platform.supportState === "targeted" && (platform.interactionModes.length === 0 || platform.decision.state !== "not-required")) {
    context.addIssue({ code: "custom", message: "Targeted platforms require interaction modes and no exception decision" })
  }
  if (platform.supportState === "excluded" && platform.decision.state !== "approved") {
    context.addIssue({ code: "custom", message: "Excluded platforms require attributable human approval" })
  }
  if (platform.supportState === "unresolved" && platform.decision.state !== "pending") {
    context.addIssue({ code: "custom", message: "Unresolved platforms require a pending human decision" })
  }
})

const screenDefinitionSchema = z.object({
  key: identifierSchema,
  label: z.string().trim().min(2).max(240),
  purpose: longTextSchema,
  platformKeys: requiredCanonicalIdentifierListSchema,
  routeKeys: requiredCanonicalIdentifierListSchema,
  contentNodeKeys: requiredCanonicalIdentifierListSchema,
  designScopeKeys: requiredCanonicalIdentifierListSchema,
  journeyKeys: requiredCanonicalIdentifierListSchema,
  touchpoints: canonicalTouchpointReferenceListSchema,
  personaKeys: requiredCanonicalIdentifierListSchema,
  stateKeys: requiredCanonicalIdentifierListSchema,
  entryStateKey: identifierSchema,
  variantKeys: canonicalIdentifierListSchema,
  responsiveRequirements: requiredCanonicalTextListSchema,
  accessibilityRequirements: requiredCanonicalTextListSchema,
  privacyAndDataUse: z.object({
    dataCategories: canonicalIdentifierListSchema,
    purpose: longTextSchema,
    minimization: longTextSchema,
    prohibitedUses: requiredCanonicalTextListSchema,
  }).strict(),
  fallback: longTextSchema,
  evidence: evidenceReviewSchema,
  sources: exactSourceListSchema,
  validationState: z.literal("not-established"),
}).strict().superRefine((screen, context) => {
  if (!screen.stateKeys.includes(screen.entryStateKey)) {
    context.addIssue({ code: "custom", path: ["entryStateKey"], message: "A screen entry state must belong to the screen state inventory" })
  }
  if (screen.touchpoints.some((entry) => !screen.journeyKeys.includes(entry.journeyKey))) {
    context.addIssue({ code: "custom", path: ["touchpoints"], message: "Screen touchpoints must belong to a declared journey" })
  }
})

const screenStateDefinitionSchema = z.object({
  key: identifierSchema,
  screenKey: identifierSchema,
  label: z.string().trim().min(2).max(240),
  kind: screenStateKindSchema,
  platformKeys: requiredCanonicalIdentifierListSchema,
  routeKeys: requiredCanonicalIdentifierListSchema,
  visibleContentNodeKeys: canonicalIdentifierListSchema,
  entryConditions: requiredCanonicalTextListSchema,
  exitConditions: requiredCanonicalTextListSchema,
  availableActionKeys: canonicalIdentifierListSchema,
  transitionStateKeys: canonicalIdentifierListSchema,
  fallbackStateKey: identifierSchema.optional(),
  accessibilityRequirements: requiredCanonicalTextListSchema,
  privacyRequirements: requiredCanonicalTextListSchema,
  fallback: longTextSchema,
  evidence: evidenceReviewSchema,
  sources: exactSourceListSchema,
  validationState: z.literal("not-established"),
}).strict().superRefine((state, context) => {
  if (state.transitionStateKeys.includes(state.key) || state.fallbackStateKey === state.key) {
    context.addIssue({ code: "custom", message: "A screen state cannot transition or fall back to itself" })
  }
  if (["blocked", "degraded", "error", "offline", "unauthorized"].includes(state.kind) && !state.fallbackStateKey) {
    context.addIssue({ code: "custom", path: ["fallbackStateKey"], message: "Failure and degraded screen states require an explicit fallback state" })
  }
})

const screenVariantDefinitionSchema = z.object({
  key: identifierSchema,
  screenKey: identifierSchema,
  label: z.string().trim().min(2).max(240),
  platformKeys: requiredCanonicalIdentifierListSchema,
  stateKeys: requiredCanonicalIdentifierListSchema,
  routeKeys: requiredCanonicalIdentifierListSchema,
  condition: longTextSchema,
  differenceSummary: longTextSchema,
  responsiveRules: requiredCanonicalTextListSchema,
  accessibilityRequirements: requiredCanonicalTextListSchema,
  privacyRequirements: requiredCanonicalTextListSchema,
  fallback: longTextSchema,
  evidence: evidenceReviewSchema,
  sources: exactSourceListSchema,
  validationState: z.literal("not-established"),
}).strict()

const routeCoverageSchema = z.object({
  routeKey: identifierSchema,
  status: z.enum(["represented", "unresolved"]),
  screenKeys: canonicalIdentifierListSchema,
  stateKeys: canonicalIdentifierListSchema,
  rationale: longTextSchema,
  sources: exactSourceListSchema,
}).strict().superRefine((coverage, context) => {
  const represented = coverage.screenKeys.length > 0 && coverage.stateKeys.length > 0
  if ((coverage.status === "represented") !== represented) {
    context.addIssue({ code: "custom", message: "Represented route coverage requires screens and states; unresolved coverage forbids them" })
  }
})

const scopeCoverageSchema = z.object({
  designScopeKey: identifierSchema,
  status: z.enum(["not-applicable", "represented", "unresolved"]),
  screenKeys: canonicalIdentifierListSchema,
  rationale: longTextSchema,
  sources: exactSourceListSchema,
  decision: coverageDecisionSchema,
}).strict().superRefine((coverage, context) => {
  if ((coverage.status === "represented") !== (coverage.screenKeys.length > 0)) {
    context.addIssue({ code: "custom", message: "Represented scope coverage requires screens; other states forbid them" })
  }
  if (coverage.status === "represented" && coverage.decision.state !== "not-required") {
    context.addIssue({ code: "custom", message: "Represented scope coverage does not require an exception decision" })
  }
  if (coverage.status === "not-applicable" && coverage.decision.state !== "approved") {
    context.addIssue({ code: "custom", message: "Not-applicable scope coverage requires attributable human approval" })
  }
  if (coverage.status === "unresolved" && coverage.decision.state !== "pending") {
    context.addIssue({ code: "custom", message: "Unresolved scope coverage requires a pending human decision" })
  }
})

const exactInformationArchitectureBindingSchema = exactInformationArchitectureModelReferenceSchema
  .extend({ membershipDigest: digestSchema }).strict()

const screenStateInventoryInputBaseSchema = z.object({
  initiativeId: z.string().uuid(),
  context: businessContextBindingSchema,
  informationClassification: informationClassificationSchema,
  title: z.string().trim().min(2).max(240),
  informationArchitectureModel: exactInformationArchitectureBindingSchema,
  platforms: z.array(screenPlatformSchema).min(1).max(128)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Platform keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Platforms must use canonical key ordering"),
  screens: z.array(screenDefinitionSchema).max(4_096)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Screen keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Screens must use canonical key ordering"),
  states: z.array(screenStateDefinitionSchema).max(16_384)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "State keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "States must use canonical key ordering"),
  variants: z.array(screenVariantDefinitionSchema).max(8_192)
    .refine((entries) => unique(entries.map((entry) => entry.key)), "Variant keys must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.key)), "Variants must use canonical key ordering"),
  routeCoverage: z.array(routeCoverageSchema).max(2_048)
    .refine((entries) => unique(entries.map((entry) => entry.routeKey)), "Route coverage must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.routeKey)), "Route coverage must use canonical route ordering"),
  scopeCoverage: z.array(scopeCoverageSchema).min(1).max(1_024)
    .refine((entries) => unique(entries.map((entry) => entry.designScopeKey)), "Scope coverage must be unique")
    .refine((entries) => canonical(entries.map((entry) => entry.designScopeKey)), "Scope coverage must use canonical scope ordering"),
  unresolvedQuestions: canonicalTextListSchema,
  limitations: requiredCanonicalTextListSchema,
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  uiCompletenessState: z.literal("not-established"),
  platformParityState: z.literal("not-established"),
  stateReachabilityState: z.literal("not-established"),
  interactionQualityState: z.literal("not-established"),
  accessibilityValidationState: z.literal("not-established"),
  designApprovalState: z.literal("not-established"),
  implementationAuthorityState: z.literal("not-established"),
}).strict().superRefine((inventory, context) => {
  const platformByKey = new Map(inventory.platforms.map((platform) => [platform.key, platform]))
  const screenByKey = new Map(inventory.screens.map((screen) => [screen.key, screen]))
  const stateByKey = new Map(inventory.states.map((state) => [state.key, state]))
  const variantByKey = new Map(inventory.variants.map((variant) => [variant.key, variant]))
  for (const [index, screen] of inventory.screens.entries()) {
    if (screen.platformKeys.some((key) => platformByKey.get(key)?.supportState !== "targeted")) {
      context.addIssue({ code: "custom", path: ["screens", index, "platformKeys"], message: "Screens may reference only targeted platforms" })
    }
    if (screen.stateKeys.some((key) => stateByKey.get(key)?.screenKey !== screen.key) ||
        screen.variantKeys.some((key) => variantByKey.get(key)?.screenKey !== screen.key)) {
      context.addIssue({ code: "custom", path: ["screens", index], message: "Screen state and variant membership must be exact" })
    }
    if (stateByKey.get(screen.entryStateKey)?.kind !== "default") {
      context.addIssue({ code: "custom", path: ["screens", index, "entryStateKey"], message: "Every represented screen requires a default entry state" })
    }
  }
  for (const [index, state] of inventory.states.entries()) {
    const screen = screenByKey.get(state.screenKey)
    if (!screen || state.platformKeys.some((key) => !screen.platformKeys.includes(key)) ||
        state.routeKeys.some((key) => !screen.routeKeys.includes(key)) ||
        state.visibleContentNodeKeys.some((key) => !screen.contentNodeKeys.includes(key)) ||
        state.transitionStateKeys.some((key) => stateByKey.get(key)?.screenKey !== state.screenKey) ||
        (state.fallbackStateKey && stateByKey.get(state.fallbackStateKey)?.screenKey !== state.screenKey)) {
      context.addIssue({ code: "custom", path: ["states", index], message: "Screen states must stay inside the declared screen, platform, route, content, transition, and fallback boundaries" })
    }
  }
  for (const [index, variant] of inventory.variants.entries()) {
    const screen = screenByKey.get(variant.screenKey)
    if (!screen || variant.platformKeys.some((key) => !screen.platformKeys.includes(key)) ||
        variant.routeKeys.some((key) => !screen.routeKeys.includes(key)) ||
        variant.stateKeys.some((key) => stateByKey.get(key)?.screenKey !== variant.screenKey)) {
      context.addIssue({ code: "custom", path: ["variants", index], message: "Screen variants must stay inside the declared screen, platform, route, and state boundaries" })
    }
  }
  for (const platform of inventory.platforms) {
    const represented = inventory.screens.some((screen) => screen.platformKeys.includes(platform.key))
    if ((platform.supportState === "targeted") !== represented) {
      context.addIssue({ code: "custom", path: ["platforms"], message: "Every targeted platform requires a screen and excluded or unresolved platforms forbid screens" })
    }
  }
  const weakEvidence = [...inventory.screens, ...inventory.states, ...inventory.variants]
    .some((entry) => entry.evidence.state === "hypothesis" || entry.evidence.state === "disputed")
  const unresolvedCoverage = inventory.routeCoverage.some((entry) => entry.status === "unresolved") ||
    inventory.scopeCoverage.some((entry) => entry.status === "unresolved") ||
    inventory.platforms.some((entry) => entry.supportState === "unresolved")
  if (inventory.reviewState === "ready-for-human-review" &&
      (weakEvidence || unresolvedCoverage || inventory.unresolvedQuestions.length > 0)) {
    context.addIssue({ code: "custom", path: ["reviewState"], message: "Screen and State Inventory cannot be ready for human review while evidence, coverage, platforms, or questions remain unresolved" })
  }
})

export const screenStateInventoryInputSchema = rejectSecrets(screenStateInventoryInputBaseSchema)

export const screenStateInventorySchema = screenStateInventoryInputSchema.safeExtend({
  schemaVersion: z.literal(1),
  kind: z.literal("screen-state-inventory-candidate"),
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
    "screen-state-inventory-is-candidate-guidance-and-does-not-prove-ui-completeness-platform-parity-state-reachability-interaction-quality-or-accessibility-approve-design-grant-readiness-or-authorize-action",
  ),
}).strict().superRefine((candidate, context) => {
  if ((candidate.revision === 1) !== (candidate.predecessorDigest === undefined)) {
    context.addIssue({ code: "custom", path: ["predecessorDigest"], message: "Only Screen and State Inventory revisions after revision one require an exact predecessor digest" })
  }
})

export const exactScreenStateInventoryReferenceSchema = z.object({
  recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
}).strict()

export const screenStateInventoryStatusSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("screen-state-inventory-status"),
  productId: z.string().uuid(), productRevision: z.number().int().positive(),
  initiativeId: z.string().uuid(), initiativeRevision: z.number().int().positive(),
  candidate: exactScreenStateInventoryReferenceSchema.optional(),
  platformCount: z.number().int().nonnegative().max(128),
  targetedPlatformCount: z.number().int().nonnegative().max(128),
  unresolvedPlatformCount: z.number().int().nonnegative().max(128),
  screenCount: z.number().int().nonnegative().max(4_096),
  stateCount: z.number().int().nonnegative().max(16_384),
  variantCount: z.number().int().nonnegative().max(8_192),
  representedRouteCount: z.number().int().nonnegative().max(2_048),
  unresolvedRouteCount: z.number().int().nonnegative().max(2_048),
  representedScopeCount: z.number().int().nonnegative().max(1_024),
  unresolvedScopeCount: z.number().int().nonnegative().max(1_024),
  weakEvidenceItemCount: z.number().int().nonnegative().max(28_672),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative().max(512),
  reviewState: z.enum(["draft", "held", "ready-for-human-review"]),
  state: z.enum(["attention-required", "complete-for-review"]),
  reasons: z.array(shortTextSchema).max(1_024),
  assessedAt: z.string().datetime(),
  authorityBoundary: z.literal(
    "screen-state-inventory-status-is-observational-and-does-not-prove-ui-completeness-platform-parity-state-reachability-interaction-quality-or-accessibility-approve-design-grant-readiness-or-authorize-action",
  ),
}).strict().superRefine((status, context) => {
  const gaps = status.unresolvedPlatformCount + status.unresolvedRouteCount + status.unresolvedScopeCount +
    status.weakEvidenceItemCount + status.staleBindingCount + status.staleSourceReferenceCount + status.unresolvedQuestionCount
  if (status.state === "complete-for-review" &&
      (gaps > 0 || status.reviewState !== "ready-for-human-review" || status.reasons.length > 0 || !status.candidate)) {
    context.addIssue({ code: "custom", path: ["state"], message: "Complete-for-review requires an exact review-ready Screen and State Inventory candidate with no declared gaps" })
  }
  if (status.state === "attention-required" && status.reasons.length === 0) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Attention-required Screen and State Inventory status must expose reasons" })
  }
})

export const screenStateInventoryProjectionSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("screen-state-inventory-projection"),
  product: z.object({ id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema,
    state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  status: screenStateInventoryStatusSchema,
  candidate: z.object({
    id: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, membershipDigest: digestSchema,
    state: z.literal("candidate"), platformCount: z.number().int().nonnegative(), screenCount: z.number().int().nonnegative(),
    stateCount: z.number().int().nonnegative(), variantCount: z.number().int().nonnegative(),
    reviewState: z.enum(["draft", "held", "ready-for-human-review"]), updatedAt: z.string().datetime(),
  }).strict().optional(),
  observedAt: z.string().datetime(),
  privacyBoundary: z.literal(
    "projection-contains-record-identities-counts-statuses-and-digests-only-not-screen-state-variant-platform-content-persona-source-or-personal-content-secrets-or-credentials",
  ),
  authorityBoundary: z.literal(
    "screen-state-inventory-projection-is-read-only-and-does-not-prove-ui-completeness-platform-parity-state-reachability-interaction-quality-or-accessibility-approve-design-grant-readiness-or-authorize-write-or-action",
  ),
  snapshotDigest: digestSchema,
}).strict().superRefine((projection, context) => {
  if (projection.product.id !== projection.status.productId || projection.product.revision !== projection.status.productRevision ||
      projection.initiative.id !== projection.status.initiativeId || projection.initiative.revision !== projection.status.initiativeRevision) {
    context.addIssue({ code: "custom", path: ["status"], message: "Screen and State Inventory projection must bind the exact Product and Initiative revisions" })
  }
})

export type ScreenPlatformKind = z.infer<typeof screenPlatformKindSchema>
export type ScreenStateKind = z.infer<typeof screenStateKindSchema>
export type ScreenStateInventoryInput = z.infer<typeof screenStateInventoryInputSchema>
export type ScreenStateInventory = z.infer<typeof screenStateInventorySchema>
export type ExactScreenStateInventoryReference = z.infer<typeof exactScreenStateInventoryReferenceSchema>
export type ScreenStateInventoryStatus = z.infer<typeof screenStateInventoryStatusSchema>
export type ScreenStateInventoryProjection = z.infer<typeof screenStateInventoryProjectionSchema>
