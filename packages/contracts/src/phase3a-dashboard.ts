import { z } from "zod"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const stateSchema = z.string().trim().min(2).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const countSchema = z.number().int().nonnegative().max(10_000_000)

export const phase3aDashboardSourceIds = [
  "backlog-hierarchy",
  "mvp-slice-definition",
  "prioritization-model",
  "acceptance-criteria",
  "definition-of-ready",
  "definition-of-done",
  "implementation-unit-model",
  "dependency-mapping",
  "technology-profile",
  "boilerplate-registry",
  "boilerplate-selection-binding",
  "boilerplate-compatibility-validation",
  "figma-to-boilerplate-mapping",
  "design-to-code-binding-registry",
  "route-screen-component-mapping",
  "test-methodology",
  "test-inventory",
  "high-level-design",
  "low-level-design",
  "implementation-readiness-gate",
] as const

export const phase3aDashboardViewIds = [
  "backlog-slice",
  "readiness-gap",
  "boilerplate-design-code",
  "change-impact",
  "agent-model",
] as const

export const phase3aDashboardSourceIdSchema = z.enum(phase3aDashboardSourceIds)
export const phase3aDashboardViewIdSchema = z.enum(phase3aDashboardViewIds)

export const phase3aDashboardSourceDefinitions = {
  "backlog-hierarchy": { title: "Backlog hierarchy", group: "backlog-slice", projectionKind: "backlog-hierarchy-projection" },
  "mvp-slice-definition": { title: "MVP and slice definition", group: "backlog-slice", projectionKind: "mvp-slice-definition-projection" },
  "prioritization-model": { title: "Prioritization model", group: "backlog-slice", projectionKind: "prioritization-model-projection" },
  "acceptance-criteria": { title: "Acceptance criteria", group: "readiness-gap", projectionKind: "acceptance-criteria-projection" },
  "definition-of-ready": { title: "Definition of Ready", group: "readiness-gap", projectionKind: "definition-of-ready-projection" },
  "definition-of-done": { title: "Definition of Done", group: "readiness-gap", projectionKind: "definition-of-done-projection" },
  "implementation-unit-model": { title: "Implementation Unit model", group: "readiness-gap", projectionKind: "implementation-unit-model-projection" },
  "dependency-mapping": { title: "Dependency mapping", group: "readiness-gap", projectionKind: "dependency-mapping-projection" },
  "technology-profile": { title: "Technology profile", group: "boilerplate-design-code", projectionKind: "technology-profile-projection" },
  "boilerplate-registry": { title: "Boilerplate registry", group: "boilerplate-design-code", projectionKind: "boilerplate-registry-projection" },
  "boilerplate-selection-binding": { title: "Boilerplate selection and binding", group: "boilerplate-design-code", projectionKind: "boilerplate-selection-binding-projection" },
  "boilerplate-compatibility-validation": { title: "Boilerplate compatibility validation", group: "boilerplate-design-code", projectionKind: "boilerplate-compatibility-validation-projection" },
  "figma-to-boilerplate-mapping": { title: "Figma-to-boilerplate mapping", group: "boilerplate-design-code", projectionKind: "figma-to-boilerplate-mapping-projection" },
  "design-to-code-binding-registry": { title: "Design-to-code binding registry", group: "boilerplate-design-code", projectionKind: "design-to-code-binding-registry-projection" },
  "route-screen-component-mapping": { title: "Route, screen, and component mapping", group: "boilerplate-design-code", projectionKind: "route-screen-component-mapping-projection" },
  "test-methodology": { title: "Test methodology", group: "readiness-gap", projectionKind: "test-methodology-projection" },
  "test-inventory": { title: "Test inventory", group: "readiness-gap", projectionKind: "test-inventory-projection" },
  "high-level-design": { title: "High-Level Design", group: "readiness-gap", projectionKind: "high-level-design-projection" },
  "low-level-design": { title: "Low-Level Design", group: "readiness-gap", projectionKind: "low-level-design-projection" },
  "implementation-readiness-gate": { title: "Implementation Readiness Gate", group: "readiness-gap", projectionKind: "implementation-readiness-gate-projection" },
} as const satisfies Record<typeof phase3aDashboardSourceIds[number], {
  readonly title: string
  readonly group: "backlog-slice" | "readiness-gap" | "boilerplate-design-code"
  readonly projectionKind: string
}>

export const phase3aDashboardViewDefinitions = {
  "backlog-slice": {
    title: "Backlog and slice",
    sourceIds: ["backlog-hierarchy", "mvp-slice-definition", "prioritization-model"],
  },
  "readiness-gap": {
    title: "Readiness and gaps",
    sourceIds: ["acceptance-criteria", "definition-of-ready", "definition-of-done", "implementation-unit-model", "dependency-mapping", "boilerplate-compatibility-validation", "test-methodology", "test-inventory", "high-level-design", "low-level-design", "implementation-readiness-gate"],
  },
  "boilerplate-design-code": {
    title: "Boilerplate and design-to-code",
    sourceIds: ["technology-profile", "boilerplate-registry", "boilerplate-selection-binding", "boilerplate-compatibility-validation", "figma-to-boilerplate-mapping", "design-to-code-binding-registry", "route-screen-component-mapping"],
  },
  "change-impact": {
    title: "Change and impact",
    sourceIds: ["dependency-mapping", "design-to-code-binding-registry", "route-screen-component-mapping", "high-level-design", "low-level-design", "implementation-readiness-gate"],
  },
  "agent-model": {
    title: "Agent and model",
    sourceIds: ["implementation-readiness-gate"],
  },
} as const satisfies Record<typeof phase3aDashboardViewIds[number], {
  readonly title: string
  readonly sourceIds: readonly typeof phase3aDashboardSourceIds[number][]
}>

const exactBindingSchema = z.object({
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

export const phase3aDashboardSourceSchema = z.object({
  id: phase3aDashboardSourceIdSchema,
  title: z.string().trim().min(2).max(160),
  group: z.enum(["backlog-slice", "readiness-gap", "boilerplate-design-code"]),
  projectionKind: stateSchema,
  availability: z.enum(["current", "attention-required", "unavailable"]),
  binding: z.object({
    snapshotDigest: digestSchema,
    observedAt: z.string().datetime(),
    candidate: exactBindingSchema.optional(),
  }).strict().optional(),
  assessment: z.object({
    state: stateSchema,
    reviewState: stateSchema.optional(),
    reasonCount: countSchema,
    candidateCount: countSchema.max(1),
    evidenceReferenceCount: countSchema,
    gapCount: countSchema,
    conflictCount: countSchema,
    staleCount: countSchema,
    unresolvedCount: countSchema,
    attentionRequired: z.boolean(),
  }).strict().optional(),
}).strict().superRefine((source, context) => {
  const definition = phase3aDashboardSourceDefinitions[source.id]
  if (source.title !== definition.title || source.group !== definition.group || source.projectionKind !== definition.projectionKind) {
    context.addIssue({ code: "custom", message: "Phase 3A dashboard source identity must match the canonical catalog" })
  }
  if (source.availability === "unavailable") {
    if (source.binding || source.assessment) context.addIssue({ code: "custom", message: "Unavailable sources cannot claim bindings or assessments" })
  } else if (!source.binding || !source.assessment) {
    context.addIssue({ code: "custom", message: "Available sources require exact bindings and assessments" })
  } else if ((source.availability === "attention-required") !== source.assessment.attentionRequired) {
    context.addIssue({ code: "custom", message: "Source availability must match its attention assessment" })
  }
})

export const phase3aDashboardWorkflowSchema = z.object({
  provider: z.enum(["codex", "claude"]),
  availability: z.enum(["sealed-local-deterministic", "unavailable"]),
  binding: z.object({
    product: exactBindingSchema,
    initiative: exactBindingSchema,
    scenarioId: stateSchema,
    receiptDigest: digestSchema,
    sourceDigest: digestSchema,
    observedAt: z.string().datetime(),
  }).strict().optional(),
  executionMode: z.literal("offline-deterministic"),
  liveAcceptance: z.literal("not-established"),
  semanticQuality: z.literal("not-assessed"),
  authority: z.literal("not-granted"),
}).strict().superRefine((workflow, context) => {
  if ((workflow.availability === "sealed-local-deterministic") !== Boolean(workflow.binding)) {
    context.addIssue({ code: "custom", message: "Workflow availability must match its exact evidence binding" })
  }
})

export const phase3aDashboardViewSchema = z.object({
  id: phase3aDashboardViewIdSchema,
  title: z.string().trim().min(2).max(160),
  sourceIds: z.array(phase3aDashboardSourceIdSchema).min(1).max(20),
  state: z.enum(["current", "attention-required", "unavailable"]),
  currentSourceCount: countSchema,
  attentionRequiredSourceCount: countSchema,
  unavailableSourceCount: countSchema,
  candidateCount: countSchema,
  evidenceReferenceCount: countSchema,
  gapCount: countSchema,
  conflictCount: countSchema,
  staleCount: countSchema,
  unresolvedCount: countSchema,
  workflowEvidenceCount: countSchema.max(2),
}).strict()

const dashboardFields = {
  schemaVersion: z.literal(1),
  kind: z.literal("phase-3a-dashboard"),
  viewDefinitionVersion: z.literal("gaep-phase-3a-dashboard-v1"),
  phase: z.object({ id: z.literal("phase-3a-readiness"), label: z.literal("Phase 3A — Backlog and Implementation Readiness") }).strict(),
  product: z.object({ recordType: z.literal("product"), recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({ recordType: z.literal("initiative"), recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema, state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]) }).strict(),
  sources: z.array(phase3aDashboardSourceSchema).length(phase3aDashboardSourceIds.length),
  views: z.array(phase3aDashboardViewSchema).length(phase3aDashboardViewIds.length),
  workflows: z.array(phase3aDashboardWorkflowSchema).length(2),
  freshness: z.object({
    state: z.enum(["current", "attention-required", "unknown"]),
    staleCount: countSchema,
    unresolvedCount: countSchema,
    oldestSourceObservedAt: z.string().datetime().optional(),
    newestSourceObservedAt: z.string().datetime().optional(),
  }).strict(),
  phaseStatus: z.object({
    state: z.enum(["candidate-complete-for-human-review", "attention-required"]),
    expectedSourceCount: z.literal(phase3aDashboardSourceIds.length),
    currentSourceCount: countSchema,
    attentionRequiredSourceCount: countSchema,
    unavailableSourceCount: countSchema,
    sourceCatalogDigest: digestSchema,
    providerWorkflowEvidenceCount: countSchema.max(2),
    liveProviderAcceptanceCount: z.literal(0),
    nativeHostAcceptanceCount: z.literal(0),
    readinessAuthority: z.literal("not-established"),
    waiverAuthority: z.literal("not-established"),
    ownershipAuthority: z.literal("not-established"),
    productOwnerAcceptance: z.literal("not-established"),
  }).strict(),
  pagination: z.object({ offset: z.literal(0), limit: z.literal(20), total: z.literal(20), truncated: z.literal(false) }).strict(),
  export: z.object({ format: z.literal("csv-visible-metadata-only"), formulaPrefixesNeutralized: z.literal(true), hiddenContentExcluded: z.literal(true) }).strict(),
  evidenceCues: z.object({
    freshness: z.enum(["current", "potentially-stale", "unknown"]),
    confidence: z.object({ state: z.literal("not-assessed"), basis: z.literal("no-governed-confidence-or-semantic-quality-evaluation-is-bound") }).strict(),
  }).strict(),
  observedAt: z.string().datetime(),
  sourceBoundary: z.literal("current-governed-product-initiative-p3a-projections-and-explicit-sealed-local-workflow-evidence-only"),
  privacyBoundary: z.literal("dashboard-exposes-identities-counts-states-times-and-digests-not-product-design-source-code-provider-output-personal-content-secrets-credentials-permissions-or-private-paths"),
  limitations: z.array(z.string().trim().min(4).max(1_000)).min(3).max(8),
  authorityBoundary: z.literal("phase-3a-dashboard-is-a-derived-read-only-view-not-completeness-priority-readiness-waiver-ownership-implementation-acceptance-release-deployment-or-action-authority"),
}

function validateDashboard(value: {
  sources: Array<{ id: typeof phase3aDashboardSourceIds[number]; availability: "current" | "attention-required" | "unavailable"; assessment?: { staleCount: number; unresolvedCount: number } }>
  views: Array<{ id: typeof phase3aDashboardViewIds[number]; title: string; sourceIds: typeof phase3aDashboardSourceIds[number][]; state: string; currentSourceCount: number; attentionRequiredSourceCount: number; unavailableSourceCount: number; workflowEvidenceCount: number }>
  workflows: Array<{ provider: "codex" | "claude"; availability: "sealed-local-deterministic" | "unavailable" }>
  freshness: { state: string; staleCount: number; unresolvedCount: number }
  phaseStatus: { state: string; currentSourceCount: number; attentionRequiredSourceCount: number; unavailableSourceCount: number; providerWorkflowEvidenceCount: number }
}, context: z.RefinementCtx): void {
  for (const [index, id] of phase3aDashboardSourceIds.entries()) {
    if (value.sources[index]?.id !== id) context.addIssue({ code: "custom", path: ["sources", index], message: "Phase 3A sources must follow canonical order" })
  }
  for (const [index, id] of phase3aDashboardViewIds.entries()) {
    const view = value.views[index]
    const definition = phase3aDashboardViewDefinitions[id]
    if (view?.id !== id || view.title !== definition.title || JSON.stringify(view.sourceIds) !== JSON.stringify(definition.sourceIds)) {
      context.addIssue({ code: "custom", path: ["views", index], message: "Phase 3A views must match the canonical catalog" })
    }
    if (view) {
      const entries = view.sourceIds.map((sourceId) => value.sources[phase3aDashboardSourceIds.indexOf(sourceId)]!)
      const current = entries.filter((source) => source.availability === "current").length
      const attention = entries.filter((source) => source.availability === "attention-required").length
      const unavailable = entries.filter((source) => source.availability === "unavailable").length
      if (view.currentSourceCount !== current || view.attentionRequiredSourceCount !== attention || view.unavailableSourceCount !== unavailable) {
        context.addIssue({ code: "custom", path: ["views", index], message: "Phase 3A view source counts must reconcile" })
      }
      const expectedState = unavailable === entries.length ? "unavailable" : attention > 0 || unavailable > 0 ? "attention-required" : "current"
      if (view.state !== expectedState) context.addIssue({ code: "custom", path: ["views", index, "state"], message: "Phase 3A view state must reconcile" })
    }
  }
  if (value.workflows[0]?.provider !== "codex" || value.workflows[1]?.provider !== "claude") {
    context.addIssue({ code: "custom", path: ["workflows"], message: "Provider workflows must follow canonical order" })
  }
  const current = value.sources.filter((source) => source.availability === "current").length
  const attention = value.sources.filter((source) => source.availability === "attention-required").length
  const unavailable = value.sources.filter((source) => source.availability === "unavailable").length
  const workflowEvidenceCount = value.workflows.filter((workflow) => workflow.availability === "sealed-local-deterministic").length
  if (value.phaseStatus.currentSourceCount !== current || value.phaseStatus.attentionRequiredSourceCount !== attention ||
      value.phaseStatus.unavailableSourceCount !== unavailable || value.phaseStatus.providerWorkflowEvidenceCount !== workflowEvidenceCount) {
    context.addIssue({ code: "custom", path: ["phaseStatus"], message: "Phase 3A phase counts must reconcile" })
  }
  const requiresAttention = attention > 0 || unavailable > 0 || value.freshness.staleCount > 0 || value.freshness.unresolvedCount > 0
  if ((value.phaseStatus.state === "attention-required") !== requiresAttention) {
    context.addIssue({ code: "custom", path: ["phaseStatus", "state"], message: "Phase 3A phase state must reconcile" })
  }
}

export const phase3aDashboardContentSchema = z.object(dashboardFields).strict().superRefine(validateDashboard)
export const phase3aDashboardSchema = z.object({ ...dashboardFields, snapshotDigest: digestSchema }).strict().superRefine(validateDashboard)

export const phase3aDashboardRequestSchema = z.object({
  expectedProductId: z.string().uuid(), expectedProductRevision: z.number().int().positive(), expectedProductDigest: digestSchema,
  expectedInitiativeId: z.string().uuid(), expectedInitiativeRevision: z.number().int().positive(), expectedInitiativeDigest: digestSchema,
}).strict()

export type Phase3aDashboardSourceId = z.infer<typeof phase3aDashboardSourceIdSchema>
export type Phase3aDashboardSource = z.infer<typeof phase3aDashboardSourceSchema>
export type Phase3aDashboardView = z.infer<typeof phase3aDashboardViewSchema>
export type Phase3aDashboardWorkflow = z.infer<typeof phase3aDashboardWorkflowSchema>
export type Phase3aDashboard = z.infer<typeof phase3aDashboardSchema>
export type Phase3aDashboardRequest = z.infer<typeof phase3aDashboardRequestSchema>
