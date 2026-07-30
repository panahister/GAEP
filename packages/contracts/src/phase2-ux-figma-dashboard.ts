import { z } from "zod"

const digestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const stateSchema = z.string().trim().min(2).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export const phase2UxFigmaDashboardSourceIds = [
  "design-applicability",
  "design-personas-roles",
  "user-journeys",
  "information-architecture",
  "screen-state-inventory",
  "design-requirements",
  "design-system-token-contract",
  "accessibility-design-rules",
  "responsive-multi-platform-targets",
  "manual-figma-execution-path",
  "figma-mcp-capability-discovery",
  "figma-read-snapshot",
  "figma-context-import",
  "outbound-design-brief-package",
  "governed-figma-write",
  "finalized-figma-snapshot-import",
  "design-to-requirement-binding",
  "designer-ready-gate",
  "design-delta",
  "design-conflict-resolution",
  "human-design-approval",
  "design-baseline",
  "design-drift-detection",
] as const

export const phase2UxFigmaDashboardSourceIdSchema = z.enum(phase2UxFigmaDashboardSourceIds)
export const phase2UxFigmaDashboardGroupSchema = z.enum([
  "experience",
  "design-system",
  "figma-exchange",
  "governance-assurance",
])

export const phase2UxFigmaDashboardSourceDefinitions = {
  "design-applicability": { title: "Design applicability", group: "experience", projectionKind: "design-applicability-projection" },
  "design-personas-roles": { title: "Design personas and roles", group: "experience", projectionKind: "design-persona-role-projection" },
  "user-journeys": { title: "User journeys", group: "experience", projectionKind: "user-journey-model-projection" },
  "information-architecture": { title: "Information architecture", group: "experience", projectionKind: "information-architecture-model-projection" },
  "screen-state-inventory": { title: "Screen and state inventory", group: "experience", projectionKind: "screen-state-inventory-projection" },
  "design-requirements": { title: "Design requirements", group: "design-system", projectionKind: "design-requirements-projection" },
  "design-system-token-contract": { title: "Design system and token contract", group: "design-system", projectionKind: "design-system-token-contract-projection" },
  "accessibility-design-rules": { title: "Accessibility design rules", group: "design-system", projectionKind: "accessibility-design-rules-projection" },
  "responsive-multi-platform-targets": { title: "Responsive and multi-platform targets", group: "design-system", projectionKind: "responsive-multi-platform-targets-projection" },
  "manual-figma-execution-path": { title: "Manual Figma execution path", group: "figma-exchange", projectionKind: "manual-figma-execution-path-projection" },
  "figma-mcp-capability-discovery": { title: "Figma MCP capability discovery", group: "figma-exchange", projectionKind: "figma-mcp-capability-discovery-projection" },
  "figma-read-snapshot": { title: "Figma read snapshot", group: "figma-exchange", projectionKind: "figma-read-snapshot-projection" },
  "figma-context-import": { title: "Figma context import", group: "figma-exchange", projectionKind: "figma-context-import-projection" },
  "outbound-design-brief-package": { title: "Outbound design brief package", group: "figma-exchange", projectionKind: "outbound-design-brief-package-projection" },
  "governed-figma-write": { title: "Governed Figma write", group: "figma-exchange", projectionKind: "governed-figma-write-projection" },
  "finalized-figma-snapshot-import": { title: "Finalized Figma snapshot import", group: "figma-exchange", projectionKind: "finalized-figma-snapshot-import-projection" },
  "design-to-requirement-binding": { title: "Design-to-requirement binding", group: "governance-assurance", projectionKind: "design-to-requirement-binding-projection" },
  "designer-ready-gate": { title: "Designer-ready gate", group: "governance-assurance", projectionKind: "designer-ready-gate-projection" },
  "design-delta": { title: "Design delta", group: "governance-assurance", projectionKind: "design-delta-projection" },
  "design-conflict-resolution": { title: "Design conflict resolution", group: "governance-assurance", projectionKind: "design-conflict-resolution-projection" },
  "human-design-approval": { title: "Human design approval", group: "governance-assurance", projectionKind: "human-design-approval-projection" },
  "design-baseline": { title: "Design baseline", group: "governance-assurance", projectionKind: "design-baseline-projection" },
  "design-drift-detection": { title: "Design drift detection", group: "governance-assurance", projectionKind: "design-drift-detection-projection" },
} as const satisfies Record<typeof phase2UxFigmaDashboardSourceIds[number], {
  readonly title: string
  readonly group: "experience" | "design-system" | "figma-exchange" | "governance-assurance"
  readonly projectionKind: string
}>

const exactRecordReferenceSchema = z.object({
  recordId: z.string().uuid(),
  revision: z.number().int().positive(),
  digest: digestSchema,
}).strict()

const sourceBindingSchema = z.object({
  snapshotDigest: digestSchema,
  observedAt: z.string().datetime(),
  assessedAt: z.string().datetime(),
  candidate: exactRecordReferenceSchema.optional(),
}).strict()

const sourceAssessmentSchema = z.object({
  state: stateSchema,
  reviewState: stateSchema.optional(),
  candidateResult: stateSchema.optional(),
  reasonCount: z.number().int().nonnegative().max(4_096),
  staleBindingCount: z.number().int().nonnegative(),
  staleSourceReferenceCount: z.number().int().nonnegative(),
  unresolvedQuestionCount: z.number().int().nonnegative().max(4_096),
  attentionRequired: z.boolean(),
}).strict()

export const phase2UxFigmaDashboardSourceSchema = z.object({
  id: phase2UxFigmaDashboardSourceIdSchema,
  title: z.string().trim().min(2).max(160),
  group: phase2UxFigmaDashboardGroupSchema,
  projectionKind: stateSchema,
  availability: z.enum(["current", "attention-required", "unavailable"]),
  binding: sourceBindingSchema.optional(),
  assessment: sourceAssessmentSchema.optional(),
}).strict().superRefine((source, context) => {
  const definition = phase2UxFigmaDashboardSourceDefinitions[source.id]
  if (source.title !== definition.title || source.group !== definition.group || source.projectionKind !== definition.projectionKind) {
    context.addIssue({ code: "custom", message: "Phase 2 dashboard source identity must match the canonical catalog" })
  }
  if (source.availability === "unavailable") {
    if (source.binding || source.assessment) {
      context.addIssue({ code: "custom", message: "Unavailable dashboard sources cannot claim bindings or assessments" })
    }
    return
  }
  if (!source.binding || !source.assessment) {
    context.addIssue({ code: "custom", message: "Available dashboard sources require exact bindings and assessments" })
    return
  }
  if ((source.availability === "attention-required") !== source.assessment.attentionRequired) {
    context.addIssue({ code: "custom", message: "Dashboard source availability must match its attention state" })
  }
})

const countSchema = z.number().int().nonnegative().max(10_000_000)

const dashboardFields = {
  schemaVersion: z.literal(1),
  kind: z.literal("phase-2-ux-figma-dashboard"),
  viewDefinitionVersion: z.literal("gaep-phase-2-ux-figma-dashboard-v1"),
  phase: z.object({ id: z.literal("phase-2-design"), label: z.literal("Phase 2 — UX and Figma Loop") }).strict(),
  product: z.object({ recordType: z.literal("product"), recordId: z.string().uuid(), revision: z.number().int().positive(), digest: digestSchema }).strict(),
  initiative: z.object({
    recordType: z.literal("initiative"), recordId: z.string().uuid(), revision: z.number().int().positive(),
    digest: digestSchema, state: z.enum(["active", "blocked", "cancelled", "completed", "proposed"]),
  }).strict(),
  sources: z.array(phase2UxFigmaDashboardSourceSchema).length(phase2UxFigmaDashboardSourceIds.length),
  experience: z.object({
    personaCount: countSchema, designRoleCount: countSchema, journeyCount: countSchema, touchpointCount: countSchema,
    informationArchitectureNodeCount: countSchema, routeCount: countSchema, screenCount: countSchema,
    stateCount: countSchema, variantCount: countSchema,
  }).strict(),
  designSystem: z.object({
    requirementCount: countSchema, designSystemCount: countSchema, tokenCount: countSchema,
    componentCount: countSchema, accessibilityRuleCount: countSchema, accessibilityCheckCount: countSchema,
    platformTargetCount: countSchema, breakpointCount: countSchema,
  }).strict(),
  figma: z.object({
    fileCount: countSchema, componentCount: countSchema, variableCount: countSchema,
    designBindingCount: countSchema, humanReviewedBindingCount: countSchema, unboundDesignItemCount: countSchema,
    connectionState: z.literal("not-established"), writeExecutionState: z.literal("not-performed"),
    importExecutionState: z.literal("not-performed"),
  }).strict(),
  governance: z.object({
    designerReadyCandidateResult: stateSchema,
    humanApprovalCandidateResult: stateSchema,
    baselineCandidateResult: stateSchema,
    baselineDesignationState: z.literal("not-established"),
    driftCandidateResult: stateSchema,
    approvalState: z.literal("not-established"), readinessState: z.literal("not-established"),
    remediationEffectState: z.literal("not-applied"),
  }).strict(),
  drift: z.object({
    observationCount: countSchema, requirementToDesignCount: countSchema, designToImplementationCount: countSchema,
    conformantCount: countSchema, driftCount: countSchema, unassessedCount: countSchema,
    blockerCount: countSchema, highSeverityCount: countSchema, remediationCandidateCount: countSchema,
  }).strict(),
  freshness: z.object({
    state: z.enum(["current", "attention-required"]),
    staleBindingCount: countSchema, staleSourceReferenceCount: countSchema,
    unresolvedQuestionCount: countSchema, oldestSourceObservedAt: z.string().datetime().optional(),
    newestSourceObservedAt: z.string().datetime().optional(),
  }).strict(),
  phaseStatus: z.object({
    state: z.enum(["candidate-complete-for-human-review", "attention-required"]),
    expectedSourceCount: z.literal(phase2UxFigmaDashboardSourceIds.length),
    currentSourceCount: countSchema,
    attentionRequiredSourceCount: countSchema,
    unavailableSourceCount: countSchema,
    sourceCatalogDigest: digestSchema,
    productOwnerAcceptance: z.literal("not-established"),
    readinessAuthority: z.literal("not-established"),
    phaseEntryAuthority: z.literal("not-established"),
  }).strict(),
  evidenceCues: z.object({
    freshness: z.enum(["current", "potentially-stale", "unknown"]),
    confidence: z.object({ state: z.literal("not-assessed"), basis: z.literal("no-governed-confidence-evaluation-is-bound") }).strict(),
  }).strict(),
  observedAt: z.string().datetime(),
  sourceBoundary: z.literal("current-governed-product-initiative-and-phase-2-projections-only"),
  privacyBoundary: z.literal("dashboard-exposes-identities-counts-statuses-times-and-digests-not-design-requirement-figma-source-human-or-personal-content-secrets-credentials-or-permissions"),
  limitations: z.array(z.string().trim().min(4).max(1_000)).min(2).max(8),
  authorityBoundary: z.literal("phase-2-dashboard-is-a-derived-read-only-view-not-a-second-source-of-truth-or-completeness-validity-approval-baseline-readiness-remediation-figma-implementation-or-action-authority"),
}

function validateDashboard(value: {
  sources: Array<{ id: typeof phase2UxFigmaDashboardSourceIds[number]; availability: "current" | "attention-required" | "unavailable" }>
  phaseStatus: { currentSourceCount: number; attentionRequiredSourceCount: number; unavailableSourceCount: number; state: string }
  freshness: { state: string; staleBindingCount: number; staleSourceReferenceCount: number }
}, context: z.RefinementCtx): void {
  for (const [index, expectedId] of phase2UxFigmaDashboardSourceIds.entries()) {
    if (value.sources[index]?.id !== expectedId) {
      context.addIssue({ code: "custom", path: ["sources", index], message: "Phase 2 dashboard sources must follow canonical order" })
    }
  }
  const current = value.sources.filter((source) => source.availability === "current").length
  const attention = value.sources.filter((source) => source.availability === "attention-required").length
  const unavailable = value.sources.filter((source) => source.availability === "unavailable").length
  if (value.phaseStatus.currentSourceCount !== current || value.phaseStatus.attentionRequiredSourceCount !== attention ||
      value.phaseStatus.unavailableSourceCount !== unavailable || current + attention + unavailable !== phase2UxFigmaDashboardSourceIds.length) {
    context.addIssue({ code: "custom", path: ["phaseStatus"], message: "Phase 2 dashboard source counts must reconcile" })
  }
  const requiresAttention = attention > 0 || unavailable > 0 || value.freshness.staleBindingCount > 0 ||
    value.freshness.staleSourceReferenceCount > 0
  if ((value.phaseStatus.state === "attention-required") !== requiresAttention ||
      (value.freshness.state === "attention-required") !==
        (value.freshness.staleBindingCount > 0 || value.freshness.staleSourceReferenceCount > 0)) {
    context.addIssue({ code: "custom", path: ["phaseStatus", "state"], message: "Phase 2 dashboard state must reconcile to declared attention" })
  }
}

export const phase2UxFigmaDashboardContentSchema = z.object(dashboardFields).strict().superRefine(validateDashboard)
export const phase2UxFigmaDashboardSchema = z.object({ ...dashboardFields, snapshotDigest: digestSchema }).strict().superRefine(validateDashboard)

export const phase2UxFigmaDashboardRequestSchema = z.object({
  expectedProductId: z.string().uuid(), expectedProductRevision: z.number().int().positive(), expectedProductDigest: digestSchema,
  expectedInitiativeId: z.string().uuid(), expectedInitiativeRevision: z.number().int().positive(), expectedInitiativeDigest: digestSchema,
}).strict()

export type Phase2UxFigmaDashboardSourceId = z.infer<typeof phase2UxFigmaDashboardSourceIdSchema>
export type Phase2UxFigmaDashboardSource = z.infer<typeof phase2UxFigmaDashboardSourceSchema>
export type Phase2UxFigmaDashboard = z.infer<typeof phase2UxFigmaDashboardSchema>
export type Phase2UxFigmaDashboardRequest = z.infer<typeof phase2UxFigmaDashboardRequestSchema>
