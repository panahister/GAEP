import {
  phase1SummaryDashboardSchema,
  phase1ChangeImpactDashboardSchema,
  phase1AgentModelDashboardSchema,
  phase2UxFigmaDashboardSchema,
  phase2ChangeImpactAgentModelDashboardSchema,
  phase3aDashboardSchema,
  type AgentModelDashboard,
  type ChangeImpactDashboard,
  type Phase1SummaryDashboard,
  type Phase1ChangeImpactDashboard,
  type Phase1AgentModelDashboard,
  type PhaseDashboardFramework,
  type Phase2UxFigmaDashboard,
  type Phase2ChangeImpactAgentModelDashboard,
  type Phase3aDashboard,
} from "@gaep/contracts"

import { canonicalStudioDigest } from "./studio-digest.js"

export const studioProtocolVersion = 1 as const

export const studioRoutes = [
  "overview",
  "direction",
  "users-jobs",
  "outcomes",
  "scope",
  "delivery",
  "architecture",
  "risks-decisions",
  "trace",
  "agents-tools",
  "runs-evidence",
  "readiness",
] as const

export type StudioRoute = typeof studioRoutes[number]

export const studioRouteLabels: Readonly<Record<StudioRoute, string>> = {
  overview: "Overview",
  direction: "Direction",
  "users-jobs": "Users & Jobs",
  outcomes: "Outcomes",
  scope: "Scope",
  delivery: "Delivery",
  architecture: "Architecture",
  "risks-decisions": "Risks & Decisions",
  trace: "Trace",
  "agents-tools": "Agents & Tools",
  "runs-evidence": "Runs & Evidence",
  readiness: "Readiness",
}

export const runStageLabels = [
  "Initiative and objective",
  "Context pack",
  "Tools and effects",
  "Policy evaluation",
  "Evidence and stop conditions",
  "Provider control mapping",
  "Charter review",
  "Launch confirmation",
] as const

export const studioSurfaceKinds = [
  "uninitialized",
  "loading",
  "empty",
  "ready",
  "invalid",
  "blocked",
  "interrupted",
  "offline",
] as const

export const studioDraftStates = ["clean", "unsaved", "saved-locally", "revision-ready", "revision-created"] as const

export type RunStage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export type CompletionState = "not-started" | "in-progress" | "complete" | "blocked" | "invalid"
export type StudioSurfaceKind = typeof studioSurfaceKinds[number]
export type DraftState = typeof studioDraftStates[number]
export type ValidationState = "not-validated" | "valid" | "invalid" | "blocked"
export type DesignFieldState = "missing" | "weak" | "complete" | "deferred"

export const studioDomainWorkflows = [
  "create-change", "edit-change",
  "create-work-item", "edit-work-item",
  "create-requirement", "edit-requirement",
  "create-decision", "edit-decision",
  "create-risk", "edit-risk",
  "create-architecture", "edit-architecture",
  "create-evidence", "edit-evidence",
  "create-context-pack", "edit-context-pack",
  "create-instruction-privilege-grant", "revoke-instruction-privilege-grant",
  "create-workflow-plan", "edit-workflow-plan",
  "create-tool-definition", "edit-tool-definition",
  "create-run-tool-selection", "edit-run-tool-selection",
  "create-trace-link", "reassess-trace-link",
  "search", "export", "import-preview", "import-portable-design-snapshot", "workspace-health",
] as const

export type StudioDomainWorkflow = typeof studioDomainWorkflows[number]

export const studioDomainPageKinds = [
  "product-design-revision", "product-revision", "change", "work-item", "requirement", "decision", "risk",
  "architecture-record", "evidence", "trace-link", "context-pack", "workflow-plan", "tool-definition",
  "instruction-privilege-grant", "run-tool-selection", "portable-design-snapshot",
] as const

export type StudioDomainPageKind = typeof studioDomainPageKinds[number]

export interface StudioIssue {
  id: string
  message: string
  sourceRecordId?: string
  fieldId?: string
  severity: "information" | "warning" | "error" | "blocker"
}

export interface StudioActionControl {
  label: string
  action: StudioAction
  enabled: boolean
  disabledReason?: string
  emphasis?: "primary" | "secondary" | "danger"
}

export interface StudioSurfaceState {
  kind: StudioSurfaceKind
  title: string
  detail?: string
  issues: StudioIssue[]
  actions: StudioActionControl[]
  lastVerifiedState?: string
  knownEffects?: string[]
  unknownEffects?: string[]
}

export interface StudioNavigationItem {
  route: StudioRoute
  state: CompletionState
  gapCount: number
}

export interface StudioWorkspaceSnapshot {
  label: string
  trusted: boolean
  connectivity: "online" | "offline" | "provider-absent"
  health: string
}

export interface StudioSourceLine {
  recordId?: string
  sourceRevision?: number
  provenance: string
  freshness?: string
}

export interface StudioPageBase {
  route: StudioRoute
  title: string
  purpose: string
  source: StudioSourceLine
  actions: StudioActionControl[]
  design?: StudioDesignSectionSnapshot
}

export interface StudioDefinitionEntry {
  term: string
  value: string
  recordId?: string
}

export interface OverviewSectionStatus {
  route: StudioRoute
  state: CompletionState
  gapCount: number
}

export interface OverviewPageSnapshot extends StudioPageBase {
  kind: "overview"
  route: "overview"
  product: {
    name: string
    lifecycle: string
    revision?: number
    readinessStatement: string
  }
  primaryAction?: StudioActionControl
  sections: OverviewSectionStatus[]
  currentInitiative: StudioDefinitionEntry[]
  latestRun: StudioDefinitionEntry[]
  blockers: StudioIssue[]
}

export interface StudioFieldValidation {
  state: ValidationState
  message?: string
}

export interface StudioRepeatableItem {
  id: string
  values: Record<string, string>
}

export interface StudioFieldSnapshot {
  id: string
  label: string
  question: string
  kind: "single-line" | "long-text" | "string-list" | "repeatable"
  value: string | string[]
  required: boolean
  example?: string
  provenance: string
  validation: StudioFieldValidation
  columns?: Array<{ key: string; label: string }>
  items?: StudioRepeatableItem[]
  readOnly?: boolean
  designState?: DesignFieldState
  deferredReason?: string
  revisitTrigger?: string
  provenanceEntries?: string[]
}

export interface StudioDesignSectionSnapshot {
  sectionId: StudioRoute
  draftId: string
  draftRevision: number
  baseProductRevision: number
  readiness: "missing" | "weak" | "conflicted" | "deferred" | "complete"
  fields: StudioFieldSnapshot[]
  gaps: StudioIssue[]
  conflicts: StudioIssue[]
  materialChange: boolean
}

export type RecordFormRoute = "direction" | "users-jobs" | "outcomes" | "scope" | "architecture"

export interface RecordFormPageSnapshot extends StudioPageBase {
  kind: "record-form"
  route: RecordFormRoute
  recordId?: string
  draftId?: string
  baseRevision?: number
  fields: StudioFieldSnapshot[]
  gaps: StudioIssue[]
  conflicts: StudioIssue[]
  draft: {
    state: DraftState
    materialChange: boolean
    validation: ValidationState
  }
  relatedRecords?: StudioTableSnapshot[]
}

export interface StudioTableColumn {
  key: string
  label: string
  identifier?: boolean
}

export interface StudioTableRow {
  id: string
  cells: Record<string, string>
  state?: string
  actions: StudioActionControl[]
}

export interface StudioTableSnapshot {
  id: string
  title: string
  columns: StudioTableColumn[]
  rows: StudioTableRow[]
  emptyState?: StudioSurfaceState
  actions: StudioActionControl[]
  truncation?: {
    shown: number
    total: number
    message: string
  }
  pagination?: {
    offset: number
    limit: number
    total: number
    hasPrevious: boolean
    hasNext: boolean
  }
}

export interface DeliveryPageSnapshot extends StudioPageBase {
  kind: "delivery"
  route: "delivery"
  initiatives: StudioTableSnapshot
  sources: StudioTableSnapshot
  sourceBaselines: StudioTableSnapshot
  sourceProvenance: StudioTableSnapshot
  changes: StudioTableSnapshot
  workItems: StudioTableSnapshot
  backlogHierarchy?: StudioTableSnapshot
  mvpSliceDefinitions?: StudioTableSnapshot
  prioritizationModels?: StudioTableSnapshot
  acceptanceCriteria?: StudioTableSnapshot
  definitionOfReady?: StudioTableSnapshot
  definitionOfDone?: StudioTableSnapshot
  implementationUnits?: StudioTableSnapshot
  dependencyMappings?: StudioTableSnapshot
  technologyProfiles?: StudioTableSnapshot
  boilerplateRegistries?: StudioTableSnapshot
  boilerplateSelectionBindings?: StudioTableSnapshot
  boilerplateCompatibilityValidations?: StudioTableSnapshot
  figmaToBoilerplateMappings?: StudioTableSnapshot
  designToCodeBindingRegistries?: StudioTableSnapshot
  routeScreenComponentMappings?: StudioTableSnapshot
  testMethodologies?: StudioTableSnapshot
  testInventories?: StudioTableSnapshot
  highLevelDesigns?: StudioTableSnapshot
  lowLevelDesigns?: StudioTableSnapshot
  implementationReadinessGates?: StudioTableSnapshot
  changedUnitInventories?: StudioTableSnapshot
  proposedChangePreviews?: StudioTableSnapshot
  stagingWorkspaces?: StudioTableSnapshot
  controlledCodexImplementations?: StudioTableSnapshot
  controlledClaudeImplementations?: StudioTableSnapshot
  providerSwitchImplementations?: StudioTableSnapshot
  modelSwitchImplementations?: StudioTableSnapshot
  approvedFigmaContextRetrievals?: StudioTableSnapshot
  controlledDesignToCodeGenerations?: StudioTableSnapshot
  designToCodeTraceability?: StudioTableSnapshot
  boilerplateConstraintEnforcements?: StudioTableSnapshot
  backlogToCodeTraceability?: StudioTableSnapshot
  applyDiscardFoundations?: StudioTableSnapshot
  transitionPreview?: {
    recordType: "initiative" | "change" | "work-item"
    recordId: string
    currentState: string
    allowedNextStates: Array<{ state: string; enabled: boolean; reason?: string }>
  }
}

export interface RisksDecisionsPageSnapshot extends StudioPageBase {
  kind: "risks-decisions"
  route: "risks-decisions"
  risks: StudioTableSnapshot
  recommendations: StudioTableSnapshot
  decisions: StudioTableSnapshot
  decisionRegisters: StudioTableSnapshot
  riskRegisters: StudioTableSnapshot
  evidenceRegistries: StudioTableSnapshot
}

export interface TraceImpactGroup {
  label: string
  entries: StudioDefinitionEntry[]
}

export interface TracePageSnapshot extends StudioPageBase {
  kind: "trace"
  route: "trace"
  relationships: StudioTableSnapshot
  traceabilityGraphs: StudioTableSnapshot
  readinessGates: StudioTableSnapshot
  p5Handoffs: StudioTableSnapshot
  selectedRecordId?: string
  impact: TraceImpactGroup[]
  caveat?: string
  searchResults: StudioTableSnapshot
}

export interface AgentPageSnapshot extends StudioPageBase {
  kind: "agents-tools"
  route: "agents-tools"
  adapters: StudioTableSnapshot
  selection?: {
    agent: string
    model: string
    modelTruthClass: string
    modelAlias: boolean
    settings: StudioDefinitionEntry[]
    limitationsReviewed: boolean
    actions: StudioActionControl[]
  }
  selectedAgent: StudioDefinitionEntry[]
  limitations: StudioIssue[]
  handoffs: StudioTableSnapshot
  contextPacks: StudioTableSnapshot
  instructionPrivilegeGrants: StudioTableSnapshot
  workflowPlans: StudioTableSnapshot
  toolDefinitions: StudioTableSnapshot
  runToolSelections: StudioTableSnapshot
}

export interface RunComposerSnapshot {
  preparedRunId?: string
  currentStage: RunStage
  stages: Array<{
    stage: RunStage
    state: CompletionState
    summary?: string
    issues: StudioIssue[]
  }>
  reviewSections: Array<{ label: string; value: string; state?: string }>
  actions: StudioActionControl[]
}

export interface RunPageSnapshot extends StudioPageBase {
  kind: "runs-evidence"
  route: "runs-evidence"
  runs: StudioTableSnapshot
  composer?: RunComposerSnapshot
  selectedRun: StudioDefinitionEntry[]
  events: Array<{ id: string; time: string; kind: string; summary: string }>
  recovery: StudioTableSnapshot
  managedEvidence: StudioTableSnapshot
  evidence: StudioTableSnapshot
  handoffs: StudioTableSnapshot
  recoveryActions: StudioActionControl[]
}

export interface ReadinessPageSnapshot extends StudioPageBase {
  kind: "readiness"
  route: "readiness"
  statement: string
  sections: OverviewSectionStatus[]
  gaps: StudioIssue[]
  conflicts: StudioIssue[]
  nextAction?: StudioActionControl
  health: StudioIssue[]
  designRevisions: StudioTableSnapshot
  productRevisions: StudioTableSnapshot
  portableDesignSnapshots: StudioTableSnapshot
  designerReadyGates: StudioTableSnapshot
  designDeltas: StudioTableSnapshot
  designConflictResolutions: StudioTableSnapshot
  humanDesignApprovals: StudioTableSnapshot
  designBaselines: StudioTableSnapshot
  designDriftDetections: StudioTableSnapshot
  portability: StudioDefinitionEntry[]
}

export type StudioPageSnapshot =
  | OverviewPageSnapshot
  | RecordFormPageSnapshot
  | DeliveryPageSnapshot
  | RisksDecisionsPageSnapshot
  | TracePageSnapshot
  | AgentPageSnapshot
  | RunPageSnapshot
  | ReadinessPageSnapshot

export interface StudioInspectorSnapshot {
  title: string
  recordId: string
  entries: StudioDefinitionEntry[]
  relationships: StudioDefinitionEntry[]
  actions: StudioActionControl[]
}

export interface StudioFooterSnapshot {
  draftState: DraftState
  sourceRevision?: number
  validationSummary: string
}

export interface StudioSnapshot {
  protocolVersion: typeof studioProtocolVersion
  contextGeneration: string
  snapshotRevision: number
  route: StudioRoute
  workspace: StudioWorkspaceSnapshot
  navigation: StudioNavigationItem[]
  surface: StudioSurfaceState
  dashboard?: PhaseDashboardFramework
  phase2UxFigma?: Phase2UxFigmaDashboard
  phase2ChangeImpactAgentModel?: Phase2ChangeImpactAgentModelDashboard
  phase3aDashboard?: Phase3aDashboard
  phase1Summary?: Phase1SummaryDashboard
  phase1ChangeImpact?: Phase1ChangeImpactDashboard
  changeImpact?: ChangeImpactDashboard
  agentModel?: AgentModelDashboard
  phase1AgentModel?: Phase1AgentModelDashboard
  page: StudioPageSnapshot
  inspector?: StudioInspectorSnapshot
  footer: StudioFooterSnapshot
}

export type StudioAction =
  | { kind: "navigate"; route: StudioRoute }
  | { kind: "initialize-product" }
  | { kind: "select-product-root" }
  | { kind: "create-initiative" }
  | { kind: "classify-initiative"; initiativeId: string; expectedRevision: number }
  | { kind: "resolve-initiative-applicability"; initiativeId: string; expectedRevision: number }
  | { kind: "prepare-run" }
  | { kind: "verify-audit" }
  | { kind: "show-diagnostics" }
  | { kind: "manage-workspace-trust" }
  | { kind: "retry-recovery" }
  | { kind: "open-record"; recordId: string }
  | { kind: "show-source"; recordId: string }
  | { kind: "select-record"; recordId: string }
  | { kind: "read-portable-design-snapshot"; bundleId: string }
  | { kind: "start-design-draft"; expectedProductRevision: number }
  | {
      kind: "save-draft"
      route: StudioRoute
      recordId?: string
      draftId?: string
      draftRevision?: number
      baseRevision?: number
      values: Record<string, string | string[]>
      states?: Record<string, DesignFieldState>
      deferredReasons?: Record<string, string>
      revisitTriggers?: Record<string, string>
    }
  | { kind: "validate-section"; route: StudioRoute; draftId?: string }
  | { kind: "create-revision"; route: StudioRoute; draftId: string; draftRevision?: number; baseRevision?: number }
  | { kind: "repeatable-item"; route: RecordFormRoute; fieldId: string; operation: "add" | "edit" | "move-up" | "move-down" | "remove"; itemId?: string }
  | { kind: "transition-record"; recordType: "initiative" | "change" | "work-item" | "risk" | "decision"; recordId: string; toState: string; reason: string }
  | { kind: "add-relationship"; sourceRecordId: string }
  | { kind: "analyze-impact"; recordId: string; recordType?: string; revision?: number; digest?: string }
  | {
      kind: "show-change-impact"
      expectedProductId: string
      expectedProductRevision: number
      expectedProductDigest: string
      expectedChangeId: string
      expectedChangeRevision: number
      expectedChangeDigest: string
    }
  | {
      kind: "domain-workflow"
      workflow: StudioDomainWorkflow
      recordId?: string
      expectedRevision?: number
      expectedProductRevision?: number
      expectedContextGeneration?: string
    }
  | { kind: "domain-page"; recordKind: StudioDomainPageKind; offset: number; limit: number }
  | { kind: "select-agent"; adapterId: string; agentId: string; modelId: string; settings: Record<string, string | number | boolean | string[]> }
  | { kind: "begin-handoff"; fromRunId: string; adapterId: string; agentId: string; modelId: string }
  | { kind: "set-run-stage"; preparedRunId: string; stage: RunStage }
  | { kind: "start-governed-run"; preparedRunId: string }
  | { kind: "cancel-prepared-run"; preparedRunId: string }
  | { kind: "recover-run"; runId: string; strategy: "inspect" | "mark-unknown" | "resume" | "cancel" }
  | { kind: "open-managed-discard"; managedRunId: string; expectedRevision: number }
  | { kind: "retry-provider"; adapterId: string }
  | { kind: "export-product"; sourceRevision?: number }
  | { kind: "import-product-preview" }

interface StudioEnvelope {
  protocolVersion: typeof studioProtocolVersion
  channelId: string
}

export type StudioToHostMessage = StudioEnvelope & (
  | { type: "studio.ready"; restoredRoute?: StudioRoute }
  | { type: "studio.navigate"; route: StudioRoute }
  | {
      type: "studio.action"
      requestId: string
      expectedContextGeneration: string
      expectedSnapshotRevision: number
      action: StudioAction
    }
)

export interface StudioActionResult {
  status: "accepted" | "rejected"
  announcement: string
  focusFieldId?: string
  diagnosticId?: string
}

export type HostToStudioMessage = StudioEnvelope & (
  | { type: "studio.snapshot"; snapshot: StudioSnapshot }
  | { type: "studio.action-result"; requestId: string; result: StudioActionResult; snapshot?: StudioSnapshot }
  | { type: "studio.focus-route"; route: StudioRoute }
  | { type: "studio.announce"; message: string; priority: "polite" | "assertive" }
)

const routeSet = new Set<string>(studioRoutes)
const recordFormRouteSet = new Set<string>(["direction", "users-jobs", "outcomes", "scope", "architecture"])
const domainWorkflowSet = new Set<string>(studioDomainWorkflows)
const domainPageKindSet = new Set<string>(studioDomainPageKinds)
const completionStateSet = new Set<string>(["not-started", "in-progress", "complete", "blocked", "invalid"])
const surfaceKindSet = new Set<string>(studioSurfaceKinds)
const draftStateSet = new Set<string>(studioDraftStates)
const phaseDashboardCatalog = {
  "phase-0-1a-foundation": ["Phase 0 / 1A — Four-IDE Platform Foundation", "foundation-summary"],
  "phase-1b-product": ["Phase 1B — Product P0–P4", "product-architecture"],
  "phase-1c-acceptance": ["Phase 1C — Four-IDE Phase 1 Release", "phase-release-readiness"],
  "phase-2-design": ["Phase 2 — UX and Figma Loop", "ux-figma"],
  "phase-3a-readiness": ["Phase 3A — Backlog and Implementation Readiness", "backlog-readiness"],
  "phase-3b-implementation": ["Phase 3B — Controlled Implementation and QA", "implementation-qa"],
  "phase-4-release-learning": ["Phase 4 — Release, Publish, and Learning", "release-learning"],
} as const
const phaseDashboardPanelCatalog = {
  "foundation-summary": ["phase", "Foundation summary and readiness"],
  "product-architecture": ["phase", "Product and architecture"],
  "phase-release-readiness": ["phase", "Phase release readiness"],
  "ux-figma": ["phase", "UX and Figma"],
  "backlog-readiness": ["phase", "Backlog and implementation readiness"],
  "implementation-qa": ["phase", "Controlled implementation and QA"],
  "release-learning": ["phase", "Release and learning"],
  "change-impact": ["change-impact", "Change and impact"],
  "agent-model": ["agent-model", "Agent and model"],
} as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys)
  return Object.keys(record).every((key) => allowed.has(key))
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 20_000
}

function isBoundedString(value: unknown): value is string {
  return typeof value === "string" && value.length <= 20_000
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isNonEmptyString(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
}

function isExactDashboardReference(
  value: unknown,
  recordType: "product" | "decision" | "work-item" | "risk",
): boolean {
  return isRecord(value) && hasOnlyKeys(value, ["recordType", "recordId", "revision", "digest"]) &&
    value.recordType === recordType && typeof value.recordId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value.recordId) &&
    isNonNegativeInteger(value.revision) && value.revision > 0 && typeof value.digest === "string" &&
    /^sha256:[0-9a-f]{64}$/u.test(value.digest)
}

function isDashboardApplicability(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ["status", "basis", "decision"])) return false
  if (!["applicable", "not-applicable", "unknown"].includes(String(value.status)) ||
      !["phase-contract", "governed-decision", "not-evaluated"].includes(String(value.basis))) return false
  if (value.basis === "phase-contract") return value.status === "applicable" && value.decision === undefined
  if (value.basis === "not-evaluated") return value.status === "unknown" && value.decision === undefined
  return value.status !== "unknown" && isExactDashboardReference(value.decision, "decision")
}

function isDashboardEvidenceCues(value: unknown, expectedFreshness?: string): boolean {
  return isRecord(value) && hasOnlyKeys(value, ["freshness", "confidence"]) &&
    ["current", "potentially-stale", "stale", "unknown"].includes(String(value.freshness)) &&
    (expectedFreshness === undefined || value.freshness === expectedFreshness) &&
    isRecord(value.confidence) && hasOnlyKeys(value.confidence, ["state", "basis"]) &&
    value.confidence.state === "not-assessed" &&
    value.confidence.basis === "no-governed-confidence-evaluation-is-bound"
}

function isPhaseDashboardFramework(value: unknown): value is PhaseDashboardFramework {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    "schemaVersion", "kind", "catalogVersion", "product", "phase", "panels", "evidenceCues", "observedAt", "sourceBoundary",
    "limitations", "authorityBoundary", "compositionDigest",
  ])) return false
  if (value.schemaVersion !== 1 || value.kind !== "phase-dashboard-framework" ||
      value.catalogVersion !== "gaep-phase-dashboards-v1" || !isExactDashboardReference(value.product, "product") ||
      !isRecord(value.phase) || !hasOnlyKeys(value.phase, ["id", "label"]) || typeof value.phase.id !== "string" ||
      !(value.phase.id in phaseDashboardCatalog) || typeof value.phase.label !== "string") return false
  const phase = phaseDashboardCatalog[value.phase.id as keyof typeof phaseDashboardCatalog]
  if (value.phase.label !== phase[0] || !Array.isArray(value.panels) || value.panels.length !== 3) return false
  const expected = [phase[1], "change-impact", "agent-model"] as const
  for (const [index, panel] of value.panels.entries()) {
    if (!isRecord(panel) || !hasOnlyKeys(panel, ["id", "role", "title", "applicability", "state"]) ||
        panel.id !== expected[index] || typeof panel.id !== "string" || !(panel.id in phaseDashboardPanelCatalog)) return false
    const definition = phaseDashboardPanelCatalog[panel.id as keyof typeof phaseDashboardPanelCatalog]
    if (panel.role !== definition[0] || panel.title !== definition[1] || !isDashboardApplicability(panel.applicability) ||
        !isRecord(panel.applicability)) return false
    const expectedState = panel.applicability.status === "applicable"
      ? "active"
      : panel.applicability.status === "not-applicable"
        ? "not-applicable"
        : "attention-required"
    if (panel.state !== expectedState) return false
  }
  return isDashboardEvidenceCues(value.evidenceCues, "current") &&
    typeof value.observedAt === "string" && Number.isFinite(Date.parse(value.observedAt)) &&
    value.sourceBoundary === "governed-repository-and-engine-only" && Array.isArray(value.limitations) &&
    value.limitations.length >= 1 && value.limitations.length <= 8 && value.limitations.every((item) => isNonEmptyString(item) && item.length <= 1_000) &&
    value.authorityBoundary === "dashboard-is-a-projection-not-phase-approval-readiness-or-applicability-evidence" &&
    typeof value.compositionDigest === "string" && /^sha256:[0-9a-f]{64}$/u.test(value.compositionDigest)
}

function isPhase1SummaryDashboard(value: unknown): value is Phase1SummaryDashboard {
  const parsed = phase1SummaryDashboardSchema.safeParse(value)
  if (!parsed.success) return false
  const { snapshotDigest, ...content } = parsed.data
  return snapshotDigest === canonicalStudioDigest(content)
}

function isPhase2UxFigmaDashboard(value: unknown): value is Phase2UxFigmaDashboard {
  const parsed = phase2UxFigmaDashboardSchema.safeParse(value)
  if (!parsed.success) return false
  const { snapshotDigest, ...content } = parsed.data
  return snapshotDigest === canonicalStudioDigest(content) &&
    parsed.data.phaseStatus.sourceCatalogDigest === canonicalStudioDigest(parsed.data.sources)
}

function isPhase2ChangeImpactAgentModelDashboard(value: unknown): value is Phase2ChangeImpactAgentModelDashboard {
  const parsed = phase2ChangeImpactAgentModelDashboardSchema.safeParse(value)
  if (!parsed.success) return false
  const { snapshotDigest, ...content } = parsed.data
  return snapshotDigest === canonicalStudioDigest(content)
}

function isPhase3aDashboard(value: unknown): value is Phase3aDashboard {
  const parsed = phase3aDashboardSchema.safeParse(value)
  if (!parsed.success) return false
  const { snapshotDigest, ...content } = parsed.data
  return snapshotDigest === canonicalStudioDigest(content) &&
    parsed.data.phaseStatus.sourceCatalogDigest === canonicalStudioDigest(parsed.data.sources)
}

function isPhase1ChangeImpactDashboard(value: unknown): value is Phase1ChangeImpactDashboard {
  const parsed = phase1ChangeImpactDashboardSchema.safeParse(value)
  if (!parsed.success) return false
  const { snapshotDigest, ...content } = parsed.data
  return snapshotDigest === canonicalStudioDigest(content)
}

function isPhase1AgentModelDashboard(value: unknown): value is Phase1AgentModelDashboard {
  const parsed = phase1AgentModelDashboardSchema.safeParse(value)
  if (!parsed.success) return false
  const { snapshotDigest, ...content } = parsed.data
  const { snapshotDigest: agentModelDigest, ...agentModelContent } = parsed.data.agentModel
  return snapshotDigest === canonicalStudioDigest(content) &&
    agentModelDigest === canonicalStudioDigest(agentModelContent)
}

const changeImpactEffects = new Set([
  "observe", "provisional", "reversible-change", "external-effect", "destructive-or-irreversible",
])
const traceRelationships = new Set([
  "targets", "derives-from", "contributes-to", "depends-on", "implements", "satisfies", "validates",
  "mitigates", "decides", "affects", "supersedes", "related-to",
])
const traceRecordTypes = new Set([
  "product", "design-revision", "initiative", "change", "work-item", "requirement", "decision", "risk",
  "architecture", "evidence", "context-pack", "workflow-plan", "tool-definition", "instruction-privilege-grant",
  "run-tool-selection", "run", "external",
])

function isPortableChangeImpactLocator(value: unknown): boolean {
  if (!isRecord(value) || typeof value.kind !== "string") return false
  if (value.kind === "workspace-relative") {
    if (!hasOnlyKeys(value, ["kind", "path"]) || typeof value.path !== "string" || value.path.length < 1 || value.path.length > 4_096) return false
    if (value.path === ".") return true
    const segments = value.path.split("/")
    return !value.path.startsWith("/") && !/^[A-Za-z]:/u.test(value.path) && !value.path.startsWith("~") &&
      !value.path.includes("\\") && !value.path.includes("\0") && !/%2e/iu.test(value.path) &&
      !segments.some((segment) => segment === "" || segment === "." || segment === "..")
  }
  if (value.kind === "logical") {
    return hasOnlyKeys(value, ["kind", "value"]) && typeof value.value === "string" &&
      /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(value.value)
  }
  if (value.kind !== "external-uri" || !hasOnlyKeys(value, ["kind", "uri"]) || typeof value.uri !== "string" || value.uri.length > 8_192) return false
  try {
    const uri = new URL(value.uri)
    if (!["http:", "https:", "urn:"].includes(uri.protocol) || uri.username || uri.password) return false
    const sensitive = /(token|password|passwd|secret|signature|credential|api.?key|access.?key|auth)/iu
    return ![...uri.searchParams.keys()].some((key) => sensitive.test(key)) && !(uri.hash && sensitive.test(uri.hash))
  } catch {
    return false
  }
}

function isChangeImpactTraceEndpoint(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ["recordType", "recordId", "revision", "digest"]) ||
      typeof value.recordType !== "string" || !traceRecordTypes.has(value.recordType) ||
      typeof value.recordId !== "string" || value.recordId.length < 1 || value.recordId.length > 500) return false
  if (value.recordType === "external") {
    return value.revision === undefined && value.digest === undefined && !value.recordId.startsWith("/") &&
      !value.recordId.startsWith("~") && !/^[A-Za-z]:/u.test(value.recordId) && !value.recordId.includes("\\")
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value.recordId) &&
    isNonNegativeInteger(value.revision) && value.revision > 0 && typeof value.digest === "string" &&
    /^sha256:[0-9a-f]{64}$/u.test(value.digest)
}

function isChangeImpactLimit(value: unknown): value is { shown: number; total: number; omitted: number } {
  return isRecord(value) && hasOnlyKeys(value, ["shown", "total", "omitted"]) &&
    isNonNegativeInteger(value.shown) && isNonNegativeInteger(value.total) && isNonNegativeInteger(value.omitted) &&
    value.shown + value.omitted === value.total
}

function isChangeImpactDashboard(value: unknown): value is ChangeImpactDashboard {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    "schemaVersion", "kind", "product", "change", "workItems", "changedArtifacts", "effectTargets", "affectedUnits",
    "governance", "freshness", "evidenceCues", "limits", "observedAt", "sourceBoundary", "limitations", "authorityBoundary", "snapshotDigest",
  ]) || value.schemaVersion !== 1 || value.kind !== "change-impact-dashboard" ||
    !isExactDashboardReference(value.product, "product") || !isRecord(value.change) || !hasOnlyKeys(value.change, [
      "recordType", "recordId", "revision", "digest", "state", "effectEnvelope",
    ]) || value.change.recordType !== "change" || typeof value.change.recordId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value.change.recordId) ||
    !isNonNegativeInteger(value.change.revision) || value.change.revision < 1 || typeof value.change.digest !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(value.change.digest) ||
    !["proposed", "planned", "active", "blocked", "completed", "cancelled"].includes(String(value.change.state)) ||
    !Array.isArray(value.change.effectEnvelope) || value.change.effectEnvelope.length < 1 ||
    value.change.effectEnvelope.length > changeImpactEffects.size ||
    !value.change.effectEnvelope.every((effect) => typeof effect === "string" && changeImpactEffects.has(effect)) ||
    new Set(value.change.effectEnvelope).size !== value.change.effectEnvelope.length) return false

  if (!Array.isArray(value.workItems) || value.workItems.length > 256 || !value.workItems.every((entry) =>
    isRecord(entry) && hasOnlyKeys(entry, ["record", "state"]) && isExactDashboardReference(entry.record, "work-item") &&
    ["proposed", "planned", "ready", "in-progress", "blocked", "completed", "cancelled"].includes(String(entry.state)))) return false
  const artifactRow = (entry: unknown): boolean => isRecord(entry) && hasOnlyKeys(entry, ["sourceWorkItem", "locator"]) &&
    isExactDashboardReference(entry.sourceWorkItem, "work-item") && isPortableChangeImpactLocator(entry.locator)
  if (!Array.isArray(value.changedArtifacts) || value.changedArtifacts.length > 512 || !value.changedArtifacts.every(artifactRow) ||
      !Array.isArray(value.effectTargets) || value.effectTargets.length > 512 || !value.effectTargets.every(artifactRow)) return false
  if (!Array.isArray(value.affectedUnits) || value.affectedUnits.length > 512 || !value.affectedUnits.every((entry) =>
    isRecord(entry) && hasOnlyKeys(entry, ["direction", "relationship", "endpoint", "trace"]) &&
    ["upstream", "downstream"].includes(String(entry.direction)) && typeof entry.relationship === "string" &&
    traceRelationships.has(entry.relationship) && isChangeImpactTraceEndpoint(entry.endpoint) && isRecord(entry.trace) &&
    hasOnlyKeys(entry.trace, ["recordId", "revision", "assessmentDigest", "assessedState"]) &&
    typeof entry.trace.recordId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(entry.trace.recordId) &&
    isNonNegativeInteger(entry.trace.revision) && entry.trace.revision > 0 && typeof entry.trace.assessmentDigest === "string" &&
    /^sha256:[0-9a-f]{64}$/u.test(entry.trace.assessmentDigest) &&
    ["valid", "unresolved", "stale", "invalid"].includes(String(entry.trace.assessedState)))) return false

  if (!isRecord(value.governance) || !hasOnlyKeys(value.governance, ["approval", "decisions", "risks", "authorityBoundary"]) ||
      !isRecord(value.governance.approval) || !hasOnlyKeys(value.governance.approval, ["state", "basis"]) ||
      value.governance.approval.state !== "not-established" ||
      value.governance.approval.basis !== "current-contract-has-no-change-approval-record" ||
      value.governance.authorityBoundary !== "decisions-and-risk-acceptance-do-not-approve-the-change" ||
      !Array.isArray(value.governance.decisions) || value.governance.decisions.length > 256 ||
      !value.governance.decisions.every((entry) => isRecord(entry) && hasOnlyKeys(entry, ["record", "state", "outcome"]) &&
        isExactDashboardReference(entry.record, "decision") && ["open", "decided", "deferred", "superseded"].includes(String(entry.state)) &&
        ["human-selected", "not-selected"].includes(String(entry.outcome)) &&
        ((entry.state === "decided") === (entry.outcome === "human-selected"))) ||
      !Array.isArray(value.governance.risks) || value.governance.risks.length > 256 ||
      !value.governance.risks.every((entry) => isRecord(entry) && hasOnlyKeys(entry, ["record", "state", "likelihood", "impact", "acceptance"]) &&
        isExactDashboardReference(entry.record, "risk") && ["open", "treated", "accepted", "closed"].includes(String(entry.state)) &&
        ["rare", "unlikely", "possible", "likely", "almost-certain", "unknown"].includes(String(entry.likelihood)) &&
        ["negligible", "minor", "moderate", "major", "critical", "unknown"].includes(String(entry.impact)) &&
        ["human-accepted", "not-accepted"].includes(String(entry.acceptance)) &&
        ((entry.state === "accepted") === (entry.acceptance === "human-accepted")))) return false

  if (!isRecord(value.freshness) || !hasOnlyKeys(value.freshness, [
    "state", "evaluatedAt", "unresolvedTraceLinks", "invalidTraceLinks", "staleTraceLinks", "staleGovernanceReferences",
    "traceAnalysisTruncated", "coverageBoundary",
  ]) || !["current", "attention-required"].includes(String(value.freshness.state)) ||
    typeof value.freshness.evaluatedAt !== "string" || !Number.isFinite(Date.parse(value.freshness.evaluatedAt)) ||
    !isNonNegativeInteger(value.freshness.unresolvedTraceLinks) || !isNonNegativeInteger(value.freshness.invalidTraceLinks) ||
    !isNonNegativeInteger(value.freshness.staleTraceLinks) || !isNonNegativeInteger(value.freshness.staleGovernanceReferences) ||
    typeof value.freshness.traceAnalysisTruncated !== "boolean" ||
    value.freshness.coverageBoundary !== "absence-of-a-trace-link-does-not-prove-absence-of-impact" ||
    !isRecord(value.limits) || !hasOnlyKeys(value.limits, [
      "workItems", "changedArtifacts", "effectTargets", "affectedUnits", "decisions", "risks", "truncated",
    ]) || typeof value.limits.truncated !== "boolean") return false
  const categoryLimits = [
    [value.workItems, value.limits.workItems],
    [value.changedArtifacts, value.limits.changedArtifacts],
    [value.effectTargets, value.limits.effectTargets],
    [value.affectedUnits, value.limits.affectedUnits],
    [value.governance.decisions, value.limits.decisions],
    [value.governance.risks, value.limits.risks],
  ] as const
  if (categoryLimits.some(([rows, limit]) => !isChangeImpactLimit(limit) || limit.shown !== rows.length)) return false
  const shouldBeTruncated = value.freshness.traceAnalysisTruncated || categoryLimits.some(([, limit]) =>
    isChangeImpactLimit(limit) && limit.omitted > 0)
  const shouldRequireAttention = shouldBeTruncated || value.freshness.unresolvedTraceLinks > 0 ||
    value.freshness.invalidTraceLinks > 0 || value.freshness.staleTraceLinks > 0 || value.freshness.staleGovernanceReferences > 0
  const expectedEvidenceFreshness = value.freshness.staleTraceLinks > 0 || value.freshness.staleGovernanceReferences > 0
    ? "stale"
    : value.freshness.unresolvedTraceLinks > 0 || value.freshness.invalidTraceLinks > 0 || shouldBeTruncated
      ? "potentially-stale"
      : "current"
  if (value.limits.truncated !== shouldBeTruncated ||
      ((value.freshness.state === "attention-required") !== shouldRequireAttention) ||
      !isDashboardEvidenceCues(value.evidenceCues, expectedEvidenceFreshness) ||
      typeof value.observedAt !== "string" || !Number.isFinite(Date.parse(value.observedAt)) ||
      Date.parse(value.freshness.evaluatedAt) > Date.parse(value.observedAt) ||
      value.sourceBoundary !== "current-governed-records-and-bounded-trace-analysis" ||
      !Array.isArray(value.limitations) || value.limitations.length < 1 || value.limitations.length > 8 ||
      !value.limitations.every((entry) => isNonEmptyString(entry) && entry.length <= 1_000) ||
      value.authorityBoundary !== "change-impact-dashboard-does-not-approve-change-accept-risk-or-authorize-effects" ||
      typeof value.snapshotDigest !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(value.snapshotDigest)) return false
  const unique = (keys: string[]) => new Set(keys).size === keys.length
  return unique(value.workItems.map((entry) => entry.record.recordId)) &&
    unique(value.changedArtifacts.map((entry) => `${entry.sourceWorkItem.recordId}:${JSON.stringify(entry.locator)}`)) &&
    unique(value.effectTargets.map((entry) => `${entry.sourceWorkItem.recordId}:${JSON.stringify(entry.locator)}`)) &&
    unique(value.affectedUnits.map((entry) => `${entry.direction}:${entry.endpoint.recordType}:${entry.endpoint.recordId}:${entry.trace.recordId}`)) &&
    unique(value.governance.decisions.map((entry) => entry.record.recordId)) &&
    unique(value.governance.risks.map((entry) => entry.record.recordId))
}

const digestPattern = /^sha256:[0-9a-f]{64}$/u
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

function isAgentModelReference(value: unknown, recordType: "product" | "run" | "managed-run" | "handoff"): boolean {
  return isRecord(value) && hasOnlyKeys(value, ["recordType", "recordId", "revision", "digest"]) &&
    value.recordType === recordType && typeof value.recordId === "string" && uuidPattern.test(value.recordId) &&
    isNonNegativeInteger(value.revision) && value.revision > 0 && typeof value.digest === "string" && digestPattern.test(value.digest)
}

function isAgentModelPortableSetting(value: unknown): boolean {
  const portableString = (candidate: unknown): candidate is string => typeof candidate === "string" && candidate.length <= 10_000 &&
    !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(candidate) &&
    !/^(?:\/|[A-Za-z]:[\\/]|\\\\|file:\/\/|~[\\/])/u.test(candidate) &&
    !/\bBearer\s+\S+/iu.test(candidate) && !/\b(?:sk|sk-ant)-[A-Za-z0-9_-]{8,}\b/u.test(candidate) &&
    !/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/u.test(candidate) &&
    !/\bAKIA[A-Z0-9]{16}\b/u.test(candidate) && !/-----BEGIN [A-Z ]*PRIVATE KEY-----/u.test(candidate) &&
    !/\b(?:token|secret|password|passwd|api[_-]?key)\s*[:=]\s*\S+/iu.test(candidate) &&
    !/^\$\{?[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY)[A-Z0-9_]*\}?$/iu.test(candidate)
  return portableString(value) || (typeof value === "number" && Number.isFinite(value)) || typeof value === "boolean" ||
    (Array.isArray(value) && value.length <= 256 && value.every(portableString))
}

function isAgentModelSettings(value: unknown): boolean {
  if (!isRecord(value) || Object.keys(value).length > 128) return false
  return Object.entries(value).every(([key, setting]) => /^[a-z][a-zA-Z0-9]{0,127}$/u.test(key) &&
    !/(?:apiKey|accessToken|refreshToken|authToken|bearerToken|password|passwd|clientSecret|privateKey|credential)/iu.test(key) &&
    !/^(?:secret|token)$/iu.test(key) && isAgentModelPortableSetting(setting))
}

function isAgentModelLimit(value: unknown): value is { shown: number; total: number; omitted: number } {
  return isRecord(value) && hasOnlyKeys(value, ["shown", "total", "omitted"]) &&
    isNonNegativeInteger(value.shown) && isNonNegativeInteger(value.total) && isNonNegativeInteger(value.omitted) &&
    value.shown + value.omitted === value.total
}

function isAgentModelSelection(value: unknown): boolean {
  if (!isRecord(value) || typeof value.status !== "string") return false
  if (value.status === "unselected" || value.status === "invalid") return hasOnlyKeys(value, ["status"])
  if (!hasOnlyKeys(value, [
    "status", "selectionDigest", "adapterId", "agentId", "modelId", "modelTruthClass", "modelAlias", "settings",
    "selectedAt", "capabilityDigest", "capabilityState",
  ]) || !["selected", "migration-required"].includes(value.status) || typeof value.selectionDigest !== "string" ||
    !digestPattern.test(value.selectionDigest) || !isNonEmptyString(value.adapterId) || !isNonEmptyString(value.agentId) ||
    !isNonEmptyString(value.modelId) || !["observed", "provider-declared", "configured", "inferred", "unknown"].includes(String(value.modelTruthClass)) ||
    !(value.modelAlias === null || typeof value.modelAlias === "boolean") || !isAgentModelSettings(value.settings) ||
    typeof value.selectedAt !== "string" || !Number.isFinite(Date.parse(value.selectedAt)) ||
    typeof value.capabilityDigest !== "string" || !digestPattern.test(value.capabilityDigest)) return false
  return value.status === "selected"
    ? ["current", "stale"].includes(String(value.capabilityState))
    : value.capabilityState === "migration-required"
}

function isAgentModelManaged(value: unknown): boolean {
  if (!isRecord(value) || typeof value.status !== "string") return false
  if (value.status === "not-observed-in-bounded-window") return hasOnlyKeys(value, ["status"])
  if (value.status !== "observed" || !hasOnlyKeys(value, [
    "status", "record", "mode", "state", "attemptNumber", "bindingsDigest", "provider", "result",
  ]) || !isAgentModelReference(value.record, "managed-run") ||
    !["codex-staged", "manual-offline", "claude-context-only"].includes(String(value.mode)) ||
    !["prepared", "running", "review-required", "applying", "completed", "failed", "cancelled", "timed-out", "unknown", "conflict", "discarded"].includes(String(value.state)) ||
    !isNonNegativeInteger(value.attemptNumber) || value.attemptNumber < 1 || value.attemptNumber > 1_000_000 ||
    typeof value.bindingsDigest !== "string" || !digestPattern.test(value.bindingsDigest) || !isRecord(value.provider) ||
    !hasOnlyKeys(value.provider, ["adapterId", "agentId", "modelId", "capabilityDigest"]) ||
    !isNonEmptyString(value.provider.adapterId) || !isNonEmptyString(value.provider.agentId) || !isNonEmptyString(value.provider.modelId) ||
    typeof value.provider.capabilityDigest !== "string" || !digestPattern.test(value.provider.capabilityDigest) || !isRecord(value.result)) return false
  if (value.result.status === "not-bound") return hasOnlyKeys(value.result, ["status"])
  if (value.result.status !== "bound" || !hasOnlyKeys(value.result, [
    "status", "recordId", "digest", "providerDisposition", "outcomeStatus", "evidence",
  ]) || typeof value.result.recordId !== "string" || !uuidPattern.test(value.result.recordId) ||
    typeof value.result.digest !== "string" || !digestPattern.test(value.result.digest) ||
    !["completed", "failed", "cancelled", "interrupted", "crashed", "protocol-error", "unknown"].includes(String(value.result.providerDisposition)) ||
    !["satisfied", "failed", "not-assessed", "indeterminate"].includes(String(value.result.outcomeStatus)) ||
    !isRecord(value.result.evidence) || !hasOnlyKeys(value.result.evidence, [
      "recordId", "digest", "eventCount", "eventsDigest", "actualEffectCount", "capturedAt",
    ])) return false
  const evidence = value.result.evidence
  return typeof evidence.recordId === "string" && uuidPattern.test(evidence.recordId) &&
    typeof evidence.digest === "string" && digestPattern.test(evidence.digest) &&
    isNonNegativeInteger(evidence.eventCount) && evidence.eventCount <= 4_096 &&
    typeof evidence.eventsDigest === "string" && digestPattern.test(evidence.eventsDigest) &&
    isNonNegativeInteger(evidence.actualEffectCount) && evidence.actualEffectCount <= 32 &&
    typeof evidence.capturedAt === "string" && Number.isFinite(Date.parse(evidence.capturedAt))
}

function isAgentModelDashboard(value: unknown): value is AgentModelDashboard {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    "schemaVersion", "kind", "product", "capabilities", "selection", "runs", "handoffs", "providerMetrics",
    "freshness", "evidenceCues", "limits", "observedAt", "sourceBoundary", "limitations", "authorityBoundary", "snapshotDigest",
  ]) || value.schemaVersion !== 1 || value.kind !== "agent-model-dashboard" ||
    !isAgentModelReference(value.product, "product") || !Array.isArray(value.capabilities) || value.capabilities.length > 16 ||
    !isAgentModelSelection(value.selection) || !Array.isArray(value.runs) || value.runs.length > 256 ||
    !Array.isArray(value.handoffs) || value.handoffs.length > 256) return false
  if (!value.capabilities.every((entry) => isRecord(entry) && hasOnlyKeys(entry, [
    "adapterId", "adapterVersion", "agentId", "agentLabel", "runtimeVersion", "capabilityDigest", "detected",
    "executionInterface", "interfaceMaturity", "support", "modelCount", "limitations", "observedAt", "selected",
  ]) && isNonEmptyString(entry.adapterId) && isNonEmptyString(entry.adapterVersion) && isNonEmptyString(entry.agentId) &&
    isNonEmptyString(entry.agentLabel) && (entry.runtimeVersion === null || isNonEmptyString(entry.runtimeVersion)) &&
    typeof entry.capabilityDigest === "string" && digestPattern.test(entry.capabilityDigest) && typeof entry.detected === "boolean" &&
    ["cli-jsonl", "cli-stream-json", "stdio-rpc", "managed-in-process", "unavailable"].includes(String(entry.executionInterface)) &&
    ["stable", "beta", "experimental", "unknown"].includes(String(entry.interfaceMaturity)) && isRecord(entry.support) &&
    hasOnlyKeys(entry.support, ["resume", "cancel", "checkpoints", "modelDiscovery", "toolSelection"]) &&
    Object.values(entry.support).every((flag) => typeof flag === "boolean") && isNonNegativeInteger(entry.modelCount) && entry.modelCount <= 512 &&
    isRecord(entry.limitations) && hasOnlyKeys(entry.limitations, ["values", "shown", "total", "omitted"]) &&
    Array.isArray(entry.limitations.values) && entry.limitations.values.length <= 64 && entry.limitations.values.every(isNonEmptyString) &&
    isNonNegativeInteger(entry.limitations.shown) && isNonNegativeInteger(entry.limitations.total) && isNonNegativeInteger(entry.limitations.omitted) &&
    entry.limitations.values.length === entry.limitations.shown && entry.limitations.shown + entry.limitations.omitted === entry.limitations.total &&
    typeof entry.observedAt === "string" && Number.isFinite(Date.parse(entry.observedAt)) && typeof entry.selected === "boolean")) return false
  if (!value.runs.every((entry) => isRecord(entry) && hasOnlyKeys(entry, ["record", "initiativeId", "state", "agent", "startedAt", "endedAt", "managed"]) &&
    isAgentModelReference(entry.record, "run") && typeof entry.initiativeId === "string" && uuidPattern.test(entry.initiativeId) &&
    ["prepared", "running", "paused", "completed", "failed", "cancelled", "unknown"].includes(String(entry.state)) &&
    isRecord(entry.agent) && hasOnlyKeys(entry.agent, ["adapterId", "agentId", "modelId", "selectionDigest"]) &&
    isNonEmptyString(entry.agent.adapterId) && isNonEmptyString(entry.agent.agentId) && isNonEmptyString(entry.agent.modelId) &&
    typeof entry.agent.selectionDigest === "string" && digestPattern.test(entry.agent.selectionDigest) &&
    (entry.startedAt === null || (typeof entry.startedAt === "string" && Number.isFinite(Date.parse(entry.startedAt)))) &&
    (entry.endedAt === null || (typeof entry.endedAt === "string" && Number.isFinite(Date.parse(entry.endedAt)))) && isAgentModelManaged(entry.managed))) return false
  if (!value.handoffs.every((entry) => isRecord(entry) && hasOnlyKeys(entry, [
    "record", "fromRun", "toSelection", "state", "createdAt", "acknowledgedAt",
  ]) && isAgentModelReference(entry.record, "handoff") && isRecord(entry.record) && entry.record.revision === 1 &&
    isAgentModelReference(entry.fromRun, "run") && isRecord(entry.toSelection) &&
    hasOnlyKeys(entry.toSelection, ["adapterId", "agentId", "modelId", "selectionDigest"]) &&
    isNonEmptyString(entry.toSelection.adapterId) && isNonEmptyString(entry.toSelection.agentId) && isNonEmptyString(entry.toSelection.modelId) &&
    typeof entry.toSelection.selectionDigest === "string" && digestPattern.test(entry.toSelection.selectionDigest) &&
    ["pending-acknowledgement", "acknowledged"].includes(String(entry.state)) && typeof entry.createdAt === "string" &&
    Number.isFinite(Date.parse(entry.createdAt)) && (entry.acknowledgedAt === null ||
      (typeof entry.acknowledgedAt === "string" && Number.isFinite(Date.parse(entry.acknowledgedAt)))))) return false
  const unavailableMetric = (metric: unknown): boolean => isRecord(metric) && hasOnlyKeys(metric, ["state", "basis"]) &&
    metric.state === "unavailable" && metric.basis === "current-managed-records-have-no-provider-usage-or-cost-contract"
  if (!isRecord(value.providerMetrics) || !hasOnlyKeys(value.providerMetrics, ["usage", "cost"]) ||
    !unavailableMetric(value.providerMetrics.usage) || !unavailableMetric(value.providerMetrics.cost) ||
    !isRecord(value.freshness) || !hasOnlyKeys(value.freshness, [
      "state", "selectionCapabilityState", "oldestCapabilityObservedAt", "newestCapabilityObservedAt", "truncated", "coverageBoundary",
    ]) || !["current", "attention-required"].includes(String(value.freshness.state)) ||
    !["current", "unselected", "stale", "migration-required", "invalid"].includes(String(value.freshness.selectionCapabilityState)) ||
    typeof value.freshness.oldestCapabilityObservedAt !== "string" || !Number.isFinite(Date.parse(value.freshness.oldestCapabilityObservedAt)) ||
    typeof value.freshness.newestCapabilityObservedAt !== "string" || !Number.isFinite(Date.parse(value.freshness.newestCapabilityObservedAt)) ||
    typeof value.freshness.truncated !== "boolean" ||
    value.freshness.coverageBoundary !== "bounded-current-records-do-not-prove-provider-account-or-native-host-readiness" ||
    !isRecord(value.limits) || !hasOnlyKeys(value.limits, ["capabilities", "runs", "handoffs", "managedRuns", "truncated"]) ||
    !isAgentModelLimit(value.limits.capabilities) || !isAgentModelLimit(value.limits.runs) ||
    !isAgentModelLimit(value.limits.handoffs) || !isAgentModelLimit(value.limits.managedRuns) || typeof value.limits.truncated !== "boolean") return false
  const categories = [[value.capabilities, value.limits.capabilities], [value.runs, value.limits.runs], [value.handoffs, value.limits.handoffs]] as const
  if (categories.some(([rows, limit]) => limit.shown !== rows.length)) return false
  const truncated = categories.some(([, limit]) => limit.omitted > 0) || value.limits.managedRuns.omitted > 0
  const selection = value.selection as Record<string, unknown>
  const selectionState = selection.status === "selected" ? selection.capabilityState : selection.status
  const expectedEvidenceFreshness = selectionState === "stale"
    ? "stale"
    : selectionState === "invalid"
      ? "unknown"
      : truncated || selectionState === "migration-required"
        ? "potentially-stale"
        : "current"
  const selectedCapabilities = value.capabilities.filter((entry) => isRecord(entry) && entry.selected)
  if (value.freshness.selectionCapabilityState !== selectionState || value.limits.truncated !== truncated || value.freshness.truncated !== truncated ||
    !isDashboardEvidenceCues(value.evidenceCues, expectedEvidenceFreshness) ||
    ((value.freshness.state === "attention-required") !== (truncated || ["stale", "migration-required", "invalid"].includes(String(selectionState))))) return false
  if (selection.status === "selected") {
    if (selectedCapabilities.length !== 1 || selectedCapabilities[0]?.adapterId !== selection.adapterId ||
      selectedCapabilities[0]?.agentId !== selection.agentId ||
      ((selectedCapabilities[0]?.capabilityDigest === selection.capabilityDigest) !== (selection.capabilityState === "current"))) return false
  } else if (selectedCapabilities.length !== 0) return false
  const unique = (keys: string[]) => new Set(keys).size === keys.length
  const runIds = new Set(value.runs.map((entry) => (entry as { record: { recordId: string } }).record.recordId))
  if (!unique(value.capabilities.map((entry) => `${entry.adapterId}:${entry.agentId}`)) ||
    !unique(value.runs.map((entry) => entry.record.recordId)) || !unique(value.handoffs.map((entry) => entry.record.recordId)) ||
    !unique(value.runs.flatMap((entry) => entry.managed.status === "observed" ? [entry.managed.record.recordId] : [])) ||
    (value.limits.runs.omitted === 0 && value.handoffs.some((entry) => !runIds.has(entry.fromRun.recordId)))) return false
  if (typeof value.observedAt !== "string" || !Number.isFinite(Date.parse(value.observedAt)) ||
    Date.parse(value.freshness.oldestCapabilityObservedAt) > Date.parse(value.freshness.newestCapabilityObservedAt) ||
    Date.parse(value.freshness.newestCapabilityObservedAt) > Date.parse(value.observedAt) ||
    value.sourceBoundary !== "current-governed-agent-selection-run-handoff-and-managed-evidence-metadata" ||
    !Array.isArray(value.limitations) || value.limitations.length < 1 || value.limitations.length > 8 ||
    !value.limitations.every((entry) => isNonEmptyString(entry) && entry.length <= 1_000) ||
    value.authorityBoundary !== "agent-model-dashboard-does-not-select-switch-handoff-launch-or-authorize-effects" ||
    typeof value.snapshotDigest !== "string" || !digestPattern.test(value.snapshotDigest)) return false
  const { snapshotDigest, ...content } = value
  return snapshotDigest === canonicalStudioDigest(content)
}

function isOpaqueContextGeneration(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,256}$/.test(value)
}

export function isStudioRoute(value: unknown): value is StudioRoute {
  return typeof value === "string" && routeSet.has(value)
}

function isRunStage(value: unknown): value is RunStage {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 8
}

function isStringValueMap(value: unknown): value is Record<string, string | string[]> {
  if (!isRecord(value)) return false
  const entries = Object.entries(value)
  if (entries.length > 512) return false
  return entries.every(([key, entry]) =>
    isNonEmptyString(key) && (
      (typeof entry === "string" && entry.length <= 50_000) ||
      (Array.isArray(entry) && entry.length <= 512 && entry.every((item) => typeof item === "string" && item.length <= 10_000))
    ),
  )
}

function isDesignStateMap(value: unknown): value is Record<string, DesignFieldState> {
  if (!isRecord(value)) return false
  const entries = Object.entries(value)
  return entries.length <= 512 && entries.every(([key, entry]) =>
    isNonEmptyString(key) && ["missing", "weak", "complete", "deferred"].includes(String(entry)),
  )
}

function isBoundedStringMap(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false
  const entries = Object.entries(value)
  return entries.length <= 512 && entries.every(([key, entry]) => isNonEmptyString(key) && isBoundedString(entry))
}

function isAgentSettingMap(value: unknown): value is Record<string, string | number | boolean | string[]> {
  if (!isRecord(value)) return false
  const entries = Object.entries(value)
  if (entries.length > 512) return false
  return entries.every(([key, entry]) =>
    isNonEmptyString(key) && (
      (typeof entry === "string" && entry.length <= 20_000) || typeof entry === "boolean" ||
      (typeof entry === "number" && Number.isFinite(entry)) ||
      (Array.isArray(entry) && entry.length <= 512 && entry.every((item) => typeof item === "string" && item.length <= 20_000))
    ),
  )
}

export function isStudioAction(value: unknown): value is StudioAction {
  if (!isRecord(value) || !isNonEmptyString(value.kind)) return false
  switch (value.kind) {
    case "navigate":
      return hasOnlyKeys(value, ["kind", "route"]) && isStudioRoute(value.route)
    case "initialize-product":
    case "select-product-root":
    case "create-initiative":
    case "prepare-run":
    case "verify-audit":
    case "show-diagnostics":
    case "manage-workspace-trust":
    case "retry-recovery":
      return hasOnlyKeys(value, ["kind"])
    case "open-record":
    case "show-source":
    case "select-record":
      return hasOnlyKeys(value, ["kind", "recordId"]) && isNonEmptyString(value.recordId)
    case "classify-initiative":
    case "resolve-initiative-applicability":
      return hasOnlyKeys(value, ["kind", "initiativeId", "expectedRevision"]) &&
        typeof value.initiativeId === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value.initiativeId) &&
        isNonNegativeInteger(value.expectedRevision) && value.expectedRevision > 0
    case "read-portable-design-snapshot":
      return hasOnlyKeys(value, ["kind", "bundleId"]) && typeof value.bundleId === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value.bundleId)
    case "analyze-impact":
      return hasOnlyKeys(value, ["kind", "recordId", "recordType", "revision", "digest"]) && isNonEmptyString(value.recordId) &&
        isOptionalString(value.recordType) && (value.revision === undefined || (isNonNegativeInteger(value.revision) && value.revision > 0)) &&
        isOptionalString(value.digest)
    case "show-change-impact":
      return hasOnlyKeys(value, [
        "kind", "expectedProductId", "expectedProductRevision", "expectedProductDigest", "expectedChangeId",
        "expectedChangeRevision", "expectedChangeDigest",
      ]) && typeof value.expectedProductId === "string" && typeof value.expectedChangeId === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value.expectedProductId) &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value.expectedChangeId) &&
        isNonNegativeInteger(value.expectedProductRevision) && value.expectedProductRevision > 0 &&
        isNonNegativeInteger(value.expectedChangeRevision) && value.expectedChangeRevision > 0 &&
        typeof value.expectedProductDigest === "string" && /^sha256:[0-9a-f]{64}$/u.test(value.expectedProductDigest) &&
        typeof value.expectedChangeDigest === "string" && /^sha256:[0-9a-f]{64}$/u.test(value.expectedChangeDigest)
    case "start-design-draft":
      return hasOnlyKeys(value, ["kind", "expectedProductRevision"]) && isNonNegativeInteger(value.expectedProductRevision) &&
        value.expectedProductRevision > 0
    case "save-draft":
      return hasOnlyKeys(value, [
        "kind", "route", "recordId", "draftId", "draftRevision", "baseRevision", "values", "states", "deferredReasons",
        "revisitTriggers",
      ]) && isStudioRoute(value.route) &&
        isOptionalString(value.recordId) && isOptionalString(value.draftId) &&
        (value.draftRevision === undefined || isNonNegativeInteger(value.draftRevision)) &&
        (value.baseRevision === undefined || isNonNegativeInteger(value.baseRevision)) && isStringValueMap(value.values)
        && (value.states === undefined || isDesignStateMap(value.states))
        && (value.deferredReasons === undefined || isBoundedStringMap(value.deferredReasons))
        && (value.revisitTriggers === undefined || isBoundedStringMap(value.revisitTriggers))
    case "validate-section":
      return hasOnlyKeys(value, ["kind", "route", "draftId"]) &&
        isStudioRoute(value.route) && isOptionalString(value.draftId)
    case "create-revision":
      return hasOnlyKeys(value, ["kind", "route", "draftId", "draftRevision", "baseRevision"]) &&
        isStudioRoute(value.route) && isNonEmptyString(value.draftId) &&
        (value.draftRevision === undefined || isNonNegativeInteger(value.draftRevision)) &&
        (value.baseRevision === undefined || isNonNegativeInteger(value.baseRevision))
    case "repeatable-item":
      return hasOnlyKeys(value, ["kind", "route", "fieldId", "operation", "itemId"]) &&
        typeof value.route === "string" && recordFormRouteSet.has(value.route) && isNonEmptyString(value.fieldId) &&
        ["add", "edit", "move-up", "move-down", "remove"].includes(String(value.operation)) &&
        isOptionalString(value.itemId)
    case "transition-record":
      return hasOnlyKeys(value, ["kind", "recordType", "recordId", "toState", "reason"]) &&
        ["initiative", "change", "work-item", "risk", "decision"].includes(String(value.recordType)) &&
        isNonEmptyString(value.recordId) && isNonEmptyString(value.toState) && isNonEmptyString(value.reason)
    case "add-relationship":
      return hasOnlyKeys(value, ["kind", "sourceRecordId"]) && isNonEmptyString(value.sourceRecordId)
    case "domain-workflow":
      return hasOnlyKeys(value, ["kind", "workflow", "recordId", "expectedRevision", "expectedProductRevision", "expectedContextGeneration"]) &&
        typeof value.workflow === "string" && domainWorkflowSet.has(value.workflow) && isOptionalString(value.recordId) &&
        (value.expectedRevision === undefined || (isNonNegativeInteger(value.expectedRevision) && value.expectedRevision > 0)) &&
        (value.expectedProductRevision === undefined || (isNonNegativeInteger(value.expectedProductRevision) && value.expectedProductRevision > 0)) &&
        isOptionalString(value.expectedContextGeneration)
    case "domain-page":
      return hasOnlyKeys(value, ["kind", "recordKind", "offset", "limit"]) &&
        typeof value.recordKind === "string" && domainPageKindSet.has(value.recordKind) &&
        isNonNegativeInteger(value.offset) && value.offset <= 1_000_000 &&
        isNonNegativeInteger(value.limit) && value.limit >= 1 && value.limit <= 200
    case "select-agent":
      return hasOnlyKeys(value, ["kind", "adapterId", "agentId", "modelId", "settings"]) &&
        isNonEmptyString(value.adapterId) && isNonEmptyString(value.agentId) && isNonEmptyString(value.modelId) &&
        isAgentSettingMap(value.settings)
    case "begin-handoff":
      return hasOnlyKeys(value, ["kind", "fromRunId", "adapterId", "agentId", "modelId"]) &&
        isNonEmptyString(value.fromRunId) && isNonEmptyString(value.adapterId) &&
        isNonEmptyString(value.agentId) && isNonEmptyString(value.modelId)
    case "set-run-stage":
      return hasOnlyKeys(value, ["kind", "preparedRunId", "stage"]) &&
        isNonEmptyString(value.preparedRunId) && isRunStage(value.stage)
    case "start-governed-run":
    case "cancel-prepared-run":
      return hasOnlyKeys(value, ["kind", "preparedRunId"]) && isNonEmptyString(value.preparedRunId)
    case "recover-run":
      return hasOnlyKeys(value, ["kind", "runId", "strategy"]) && isNonEmptyString(value.runId) &&
        ["inspect", "mark-unknown", "resume", "cancel"].includes(String(value.strategy))
    case "open-managed-discard":
      return hasOnlyKeys(value, ["kind", "managedRunId", "expectedRevision"]) &&
        typeof value.managedRunId === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value.managedRunId) &&
        isNonNegativeInteger(value.expectedRevision) && value.expectedRevision > 0
    case "retry-provider":
      return hasOnlyKeys(value, ["kind", "adapterId"]) && isNonEmptyString(value.adapterId)
    case "export-product":
      return hasOnlyKeys(value, ["kind", "sourceRevision"]) &&
        (value.sourceRevision === undefined || isNonNegativeInteger(value.sourceRevision))
    case "import-product-preview":
      return hasOnlyKeys(value, ["kind"])
    default:
      return false
  }
}

function isStudioIssue(value: unknown): value is StudioIssue {
  return isRecord(value) && hasOnlyKeys(value, ["id", "message", "sourceRecordId", "fieldId", "severity"]) &&
    isNonEmptyString(value.id) && isNonEmptyString(value.message) && isOptionalString(value.sourceRecordId) &&
    isOptionalString(value.fieldId) && ["information", "warning", "error", "blocker"].includes(String(value.severity))
}

function isStudioActionControl(value: unknown): value is StudioActionControl {
  return isRecord(value) && hasOnlyKeys(value, ["label", "action", "enabled", "disabledReason", "emphasis"]) &&
    isNonEmptyString(value.label) && isStudioAction(value.action) && typeof value.enabled === "boolean" &&
    isOptionalString(value.disabledReason) &&
    (value.emphasis === undefined || ["primary", "secondary", "danger"].includes(String(value.emphasis)))
}

function isStudioSourceLine(value: unknown): value is StudioSourceLine {
  return isRecord(value) && hasOnlyKeys(value, ["recordId", "sourceRevision", "provenance", "freshness"]) &&
    isOptionalString(value.recordId) &&
    (value.sourceRevision === undefined || isNonNegativeInteger(value.sourceRevision)) &&
    isNonEmptyString(value.provenance) && isOptionalString(value.freshness)
}

function isStudioSurfaceState(value: unknown): value is StudioSurfaceState {
  return isRecord(value) && hasOnlyKeys(value, [
    "kind", "title", "detail", "issues", "actions", "lastVerifiedState", "knownEffects", "unknownEffects",
  ]) && typeof value.kind === "string" && surfaceKindSet.has(value.kind) && isNonEmptyString(value.title) &&
    isOptionalString(value.detail) && Array.isArray(value.issues) && value.issues.length <= 1_000 &&
    value.issues.every(isStudioIssue) && Array.isArray(value.actions) && value.actions.length <= 100 &&
    value.actions.every(isStudioActionControl) && isOptionalString(value.lastVerifiedState) &&
    (value.knownEffects === undefined || (Array.isArray(value.knownEffects) && value.knownEffects.length <= 1_000 &&
      value.knownEffects.every(isNonEmptyString))) &&
    (value.unknownEffects === undefined || (Array.isArray(value.unknownEffects) && value.unknownEffects.length <= 1_000 &&
      value.unknownEffects.every(isNonEmptyString)))
}

function isDefinitionEntry(value: unknown): value is StudioDefinitionEntry {
  return isRecord(value) && hasOnlyKeys(value, ["term", "value", "recordId"]) &&
    isNonEmptyString(value.term) && isBoundedString(value.value) && isOptionalString(value.recordId)
}

function isOverviewSection(value: unknown): value is OverviewSectionStatus {
  return isRecord(value) && hasOnlyKeys(value, ["route", "state", "gapCount"]) && isStudioRoute(value.route) &&
    typeof value.state === "string" && completionStateSet.has(value.state) && isNonNegativeInteger(value.gapCount)
}

function isTableSnapshot(value: unknown): value is StudioTableSnapshot {
  if (!isRecord(value) || !hasOnlyKeys(value, ["id", "title", "columns", "rows", "emptyState", "actions", "truncation", "pagination"]) ||
    !isNonEmptyString(value.id) || !isNonEmptyString(value.title) || !Array.isArray(value.columns) || value.columns.length > 64 ||
    !Array.isArray(value.rows) || value.rows.length > 10_000 || !Array.isArray(value.actions) || value.actions.length > 100 ||
    !value.actions.every(isStudioActionControl) || (value.emptyState !== undefined && !isStudioSurfaceState(value.emptyState))) return false
  if (value.truncation !== undefined && (!isRecord(value.truncation) ||
    !hasOnlyKeys(value.truncation, ["shown", "total", "message"]) || !isNonNegativeInteger(value.truncation.shown) ||
    !isNonNegativeInteger(value.truncation.total) || value.truncation.shown > value.truncation.total ||
    !isNonEmptyString(value.truncation.message))) return false
  if (value.pagination !== undefined && (!isRecord(value.pagination) ||
    !hasOnlyKeys(value.pagination, ["offset", "limit", "total", "hasPrevious", "hasNext"]) ||
    !isNonNegativeInteger(value.pagination.offset) || value.pagination.offset > 1_000_000 ||
    !isNonNegativeInteger(value.pagination.limit) || value.pagination.limit < 1 ||
    value.pagination.limit > 200 || !isNonNegativeInteger(value.pagination.total) ||
    value.rows.length > value.pagination.limit || value.pagination.offset + value.rows.length > value.pagination.total ||
    typeof value.pagination.hasPrevious !== "boolean" || typeof value.pagination.hasNext !== "boolean" ||
    value.pagination.hasPrevious !== (value.pagination.offset > 0) ||
    value.pagination.hasNext !== (
      value.pagination.offset + value.rows.length < value.pagination.total &&
      value.pagination.offset + value.pagination.limit <= 1_000_000
    ))) return false
  const columnsValid = value.columns.every((column) => isRecord(column) && hasOnlyKeys(column, ["key", "label", "identifier"]) &&
    isNonEmptyString(column.key) && isNonEmptyString(column.label) &&
    (column.identifier === undefined || typeof column.identifier === "boolean"))
  if (!columnsValid) return false
  return value.rows.every((row) => {
    if (!isRecord(row) || !hasOnlyKeys(row, ["id", "cells", "state", "actions"]) || !isNonEmptyString(row.id) ||
      !isRecord(row.cells) || !isOptionalString(row.state) || !Array.isArray(row.actions) || row.actions.length > 100 ||
      !row.actions.every(isStudioActionControl)) return false
    return Object.entries(row.cells).every(([key, cell]) => isNonEmptyString(key) && isBoundedString(cell))
  })
}

function isFieldSnapshot(value: unknown): value is StudioFieldSnapshot {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    "id", "label", "question", "kind", "value", "required", "example", "provenance", "validation", "columns", "items", "readOnly",
    "designState", "deferredReason", "revisitTrigger", "provenanceEntries",
  ]) || !isNonEmptyString(value.id) || !isNonEmptyString(value.label) || !isNonEmptyString(value.question) ||
    !["single-line", "long-text", "string-list", "repeatable"].includes(String(value.kind)) ||
    !(isBoundedString(value.value) || (Array.isArray(value.value) && value.value.length <= 1_000 && value.value.every(isBoundedString))) ||
    typeof value.required !== "boolean" || !isOptionalString(value.example) || !isNonEmptyString(value.provenance) ||
    !isRecord(value.validation) || !hasOnlyKeys(value.validation, ["state", "message"]) ||
    !["not-validated", "valid", "invalid", "blocked"].includes(String(value.validation.state)) ||
    !isOptionalString(value.validation.message) || (value.readOnly !== undefined && typeof value.readOnly !== "boolean")) return false
  if (value.designState !== undefined && !["missing", "weak", "complete", "deferred"].includes(String(value.designState))) return false
  if (!isOptionalString(value.deferredReason) || !isOptionalString(value.revisitTrigger)) return false
  if (value.provenanceEntries !== undefined && (!Array.isArray(value.provenanceEntries) || value.provenanceEntries.length > 512 ||
    !value.provenanceEntries.every(isNonEmptyString))) return false
  if (value.columns !== undefined && (!Array.isArray(value.columns) || value.columns.length > 64 || !value.columns.every((column) =>
    isRecord(column) && hasOnlyKeys(column, ["key", "label"]) && isNonEmptyString(column.key) && isNonEmptyString(column.label)))) return false
  if (value.items !== undefined && (!Array.isArray(value.items) || value.items.length > 10_000 || !value.items.every((item) =>
    isRecord(item) && hasOnlyKeys(item, ["id", "values"]) && isNonEmptyString(item.id) && isRecord(item.values) &&
    Object.entries(item.values).every(([key, entry]) => isNonEmptyString(key) && isBoundedString(entry))))) return false
  return true
}

function isDesignSection(value: unknown, route: StudioRoute): value is StudioDesignSectionSnapshot {
  return isRecord(value) && hasOnlyKeys(value, [
    "sectionId", "draftId", "draftRevision", "baseProductRevision", "readiness", "fields", "gaps", "conflicts", "materialChange",
  ]) && value.sectionId === route && isNonEmptyString(value.draftId) && isNonNegativeInteger(value.draftRevision) &&
    value.draftRevision > 0 && isNonNegativeInteger(value.baseProductRevision) && value.baseProductRevision > 0 &&
    ["missing", "weak", "conflicted", "deferred", "complete"].includes(String(value.readiness)) &&
    Array.isArray(value.fields) && value.fields.length <= 256 && value.fields.every(isFieldSnapshot) &&
    Array.isArray(value.gaps) && value.gaps.length <= 256 && value.gaps.every(isStudioIssue) &&
    Array.isArray(value.conflicts) && value.conflicts.length <= 128 && value.conflicts.every(isStudioIssue) &&
    typeof value.materialChange === "boolean"
}

function isPageBase(page: Record<string, unknown>, route: StudioRoute): boolean {
  return page.route === route && isNonEmptyString(page.title) && isNonEmptyString(page.purpose) &&
    isStudioSourceLine(page.source) && Array.isArray(page.actions) && page.actions.length <= 100 &&
    page.actions.every(isStudioActionControl) && (page.design === undefined || isDesignSection(page.design, route))
}

function isOverviewPage(page: Record<string, unknown>): boolean {
  return hasOnlyKeys(page, [
    "kind", "route", "title", "purpose", "source", "actions", "design", "product", "primaryAction", "sections", "currentInitiative", "latestRun", "blockers",
  ]) && isPageBase(page, "overview") && page.kind === "overview" && isRecord(page.product) &&
    hasOnlyKeys(page.product, ["name", "lifecycle", "revision", "readinessStatement"]) &&
    isNonEmptyString(page.product.name) && isNonEmptyString(page.product.lifecycle) &&
    (page.product.revision === undefined || isNonNegativeInteger(page.product.revision)) &&
    isNonEmptyString(page.product.readinessStatement) &&
    (page.primaryAction === undefined || isStudioActionControl(page.primaryAction)) &&
    Array.isArray(page.sections) && page.sections.length === studioRoutes.length && page.sections.every(isOverviewSection) &&
    Array.isArray(page.currentInitiative) && page.currentInitiative.every(isDefinitionEntry) &&
    Array.isArray(page.latestRun) && page.latestRun.every(isDefinitionEntry) &&
    Array.isArray(page.blockers) && page.blockers.length <= 1_000 && page.blockers.every(isStudioIssue)
}

function isRecordFormPage(page: Record<string, unknown>, route: RecordFormRoute): boolean {
  return hasOnlyKeys(page, [
    "kind", "route", "title", "purpose", "source", "actions", "design", "recordId", "draftId", "baseRevision", "fields", "gaps", "conflicts", "draft",
    "relatedRecords",
  ]) && isPageBase(page, route) && page.kind === "record-form" && isOptionalString(page.recordId) &&
    isOptionalString(page.draftId) && (page.baseRevision === undefined || isNonNegativeInteger(page.baseRevision)) &&
    Array.isArray(page.fields) && page.fields.length <= 200 && page.fields.every(isFieldSnapshot) &&
    Array.isArray(page.gaps) && page.gaps.length <= 1_000 && page.gaps.every(isStudioIssue) &&
    Array.isArray(page.conflicts) && page.conflicts.length <= 1_000 && page.conflicts.every(isStudioIssue) &&
    isRecord(page.draft) && hasOnlyKeys(page.draft, ["state", "materialChange", "validation"]) &&
    typeof page.draft.state === "string" && draftStateSet.has(page.draft.state) && typeof page.draft.materialChange === "boolean" &&
    ["not-validated", "valid", "invalid", "blocked"].includes(String(page.draft.validation)) &&
    (page.relatedRecords === undefined || (Array.isArray(page.relatedRecords) && page.relatedRecords.length <= 32 &&
      page.relatedRecords.every(isTableSnapshot)))
}

function isDeliveryPage(page: Record<string, unknown>): boolean {
  if (!hasOnlyKeys(page, [
    "kind", "route", "title", "purpose", "source", "actions", "design", "initiatives", "sources",
    "sourceBaselines", "sourceProvenance", "changes", "workItems", "backlogHierarchy", "mvpSliceDefinitions", "prioritizationModels", "acceptanceCriteria", "definitionOfReady", "definitionOfDone", "implementationUnits", "dependencyMappings", "technologyProfiles", "boilerplateRegistries", "boilerplateSelectionBindings", "boilerplateCompatibilityValidations", "figmaToBoilerplateMappings", "designToCodeBindingRegistries", "routeScreenComponentMappings", "testMethodologies", "testInventories", "highLevelDesigns", "lowLevelDesigns", "implementationReadinessGates", "changedUnitInventories", "proposedChangePreviews", "stagingWorkspaces", "controlledCodexImplementations", "controlledClaudeImplementations", "providerSwitchImplementations", "modelSwitchImplementations", "approvedFigmaContextRetrievals", "controlledDesignToCodeGenerations", "designToCodeTraceability", "boilerplateConstraintEnforcements", "backlogToCodeTraceability", "applyDiscardFoundations", "transitionPreview",
  ]) || !isPageBase(page, "delivery") || page.kind !== "delivery" || !isTableSnapshot(page.initiatives) ||
    !isTableSnapshot(page.sources) || !isTableSnapshot(page.sourceBaselines) ||
    !isTableSnapshot(page.sourceProvenance) || !isTableSnapshot(page.changes) ||
    !isTableSnapshot(page.workItems) ||
    (page.backlogHierarchy !== undefined && !isTableSnapshot(page.backlogHierarchy)) ||
    (page.mvpSliceDefinitions !== undefined && !isTableSnapshot(page.mvpSliceDefinitions)) ||
    (page.prioritizationModels !== undefined && !isTableSnapshot(page.prioritizationModels)) ||
    (page.acceptanceCriteria !== undefined && !isTableSnapshot(page.acceptanceCriteria)) ||
    (page.definitionOfReady !== undefined && !isTableSnapshot(page.definitionOfReady)) ||
    (page.definitionOfDone !== undefined && !isTableSnapshot(page.definitionOfDone)) ||
    (page.implementationUnits !== undefined && !isTableSnapshot(page.implementationUnits)) ||
    (page.dependencyMappings !== undefined && !isTableSnapshot(page.dependencyMappings)) ||
    (page.technologyProfiles !== undefined && !isTableSnapshot(page.technologyProfiles)) ||
    (page.boilerplateRegistries !== undefined && !isTableSnapshot(page.boilerplateRegistries)) ||
    (page.boilerplateSelectionBindings !== undefined && !isTableSnapshot(page.boilerplateSelectionBindings)) ||
    (page.boilerplateCompatibilityValidations !== undefined && !isTableSnapshot(page.boilerplateCompatibilityValidations)) ||
    (page.figmaToBoilerplateMappings !== undefined && !isTableSnapshot(page.figmaToBoilerplateMappings)) ||
    (page.designToCodeBindingRegistries !== undefined && !isTableSnapshot(page.designToCodeBindingRegistries)) ||
    (page.routeScreenComponentMappings !== undefined && !isTableSnapshot(page.routeScreenComponentMappings)) ||
    (page.testMethodologies !== undefined && !isTableSnapshot(page.testMethodologies)) ||
    (page.testInventories !== undefined && !isTableSnapshot(page.testInventories)) ||
    (page.highLevelDesigns !== undefined && !isTableSnapshot(page.highLevelDesigns)) ||
    (page.lowLevelDesigns !== undefined && !isTableSnapshot(page.lowLevelDesigns)) ||
    (page.implementationReadinessGates !== undefined && !isTableSnapshot(page.implementationReadinessGates)) ||
    (page.changedUnitInventories !== undefined && !isTableSnapshot(page.changedUnitInventories)) ||
    (page.proposedChangePreviews !== undefined && !isTableSnapshot(page.proposedChangePreviews)) ||
    (page.stagingWorkspaces !== undefined && !isTableSnapshot(page.stagingWorkspaces)) ||
    (page.controlledCodexImplementations !== undefined && !isTableSnapshot(page.controlledCodexImplementations)) ||
    (page.controlledClaudeImplementations !== undefined && !isTableSnapshot(page.controlledClaudeImplementations)) ||
    (page.providerSwitchImplementations !== undefined && !isTableSnapshot(page.providerSwitchImplementations)) ||
    (page.modelSwitchImplementations !== undefined && !isTableSnapshot(page.modelSwitchImplementations)) ||
    (page.approvedFigmaContextRetrievals !== undefined && !isTableSnapshot(page.approvedFigmaContextRetrievals)) ||
    (page.controlledDesignToCodeGenerations !== undefined && !isTableSnapshot(page.controlledDesignToCodeGenerations)) ||
    (page.designToCodeTraceability !== undefined && !isTableSnapshot(page.designToCodeTraceability)) ||
    (page.boilerplateConstraintEnforcements !== undefined && !isTableSnapshot(page.boilerplateConstraintEnforcements)) ||
    (page.backlogToCodeTraceability !== undefined && !isTableSnapshot(page.backlogToCodeTraceability)) ||
    (page.applyDiscardFoundations !== undefined && !isTableSnapshot(page.applyDiscardFoundations))) return false
  if (page.transitionPreview === undefined) return true
  return isRecord(page.transitionPreview) && hasOnlyKeys(page.transitionPreview, [
    "recordType", "recordId", "currentState", "allowedNextStates",
  ]) && ["initiative", "change", "work-item"].includes(String(page.transitionPreview.recordType)) &&
    isNonEmptyString(page.transitionPreview.recordId) && isNonEmptyString(page.transitionPreview.currentState) &&
    Array.isArray(page.transitionPreview.allowedNextStates) && page.transitionPreview.allowedNextStates.length <= 100 &&
    page.transitionPreview.allowedNextStates.every((next) => isRecord(next) && hasOnlyKeys(next, ["state", "enabled", "reason"]) &&
      isNonEmptyString(next.state) && typeof next.enabled === "boolean" && isOptionalString(next.reason))
}

function isRisksDecisionsPage(page: Record<string, unknown>): boolean {
  return hasOnlyKeys(page, [
    "kind", "route", "title", "purpose", "source", "actions", "design", "risks", "recommendations", "decisions", "decisionRegisters", "riskRegisters", "evidenceRegistries",
  ]) && isPageBase(page, "risks-decisions") && page.kind === "risks-decisions" &&
    isTableSnapshot(page.risks) && isTableSnapshot(page.recommendations) && isTableSnapshot(page.decisions) &&
    isTableSnapshot(page.decisionRegisters) && isTableSnapshot(page.riskRegisters) &&
    isTableSnapshot(page.evidenceRegistries)
}

function isTracePage(page: Record<string, unknown>): boolean {
  return hasOnlyKeys(page, [
    "kind", "route", "title", "purpose", "source", "actions", "design", "relationships", "traceabilityGraphs", "readinessGates", "p5Handoffs", "selectedRecordId", "impact", "caveat", "searchResults",
  ]) && isPageBase(page, "trace") && page.kind === "trace" && isTableSnapshot(page.relationships) &&
    isTableSnapshot(page.traceabilityGraphs) && isTableSnapshot(page.readinessGates) &&
    isTableSnapshot(page.p5Handoffs) && isTableSnapshot(page.searchResults) && isOptionalString(page.selectedRecordId) && isOptionalString(page.caveat) && Array.isArray(page.impact) && page.impact.length <= 100 &&
    page.impact.every((group) => isRecord(group) && hasOnlyKeys(group, ["label", "entries"]) && isNonEmptyString(group.label) &&
      Array.isArray(group.entries) && group.entries.length <= 10_000 && group.entries.every(isDefinitionEntry))
}

function isAgentPage(page: Record<string, unknown>): boolean {
  if (!hasOnlyKeys(page, [
    "kind", "route", "title", "purpose", "source", "actions", "design", "adapters", "selection", "selectedAgent", "limitations", "handoffs",
    "contextPacks", "instructionPrivilegeGrants", "workflowPlans", "toolDefinitions", "runToolSelections",
  ]) || !isPageBase(page, "agents-tools") || page.kind !== "agents-tools" || !isTableSnapshot(page.adapters) ||
    !Array.isArray(page.selectedAgent) || !page.selectedAgent.every(isDefinitionEntry) ||
    !Array.isArray(page.limitations) || !page.limitations.every(isStudioIssue) || !isTableSnapshot(page.handoffs) ||
    !isTableSnapshot(page.contextPacks) || !isTableSnapshot(page.instructionPrivilegeGrants) || !isTableSnapshot(page.workflowPlans) || !isTableSnapshot(page.toolDefinitions) ||
    !isTableSnapshot(page.runToolSelections)) return false
  if (page.selection === undefined) return true
  return isRecord(page.selection) && hasOnlyKeys(page.selection, [
    "agent", "model", "modelTruthClass", "modelAlias", "settings", "limitationsReviewed", "actions",
  ]) && isNonEmptyString(page.selection.agent) && isNonEmptyString(page.selection.model) &&
    isNonEmptyString(page.selection.modelTruthClass) && typeof page.selection.modelAlias === "boolean" &&
    Array.isArray(page.selection.settings) && page.selection.settings.every(isDefinitionEntry) &&
    typeof page.selection.limitationsReviewed === "boolean" && Array.isArray(page.selection.actions) &&
    page.selection.actions.every(isStudioActionControl)
}

function isRunComposer(value: unknown): value is RunComposerSnapshot {
  return isRecord(value) && hasOnlyKeys(value, ["preparedRunId", "currentStage", "stages", "reviewSections", "actions"]) &&
    isOptionalString(value.preparedRunId) && isRunStage(value.currentStage) && Array.isArray(value.stages) &&
    value.stages.length === runStageLabels.length && value.stages.every((stage) => isRecord(stage) &&
      hasOnlyKeys(stage, ["stage", "state", "summary", "issues"]) && isRunStage(stage.stage) &&
      typeof stage.state === "string" && completionStateSet.has(stage.state) && isOptionalString(stage.summary) &&
      Array.isArray(stage.issues) && stage.issues.every(isStudioIssue)) && Array.isArray(value.reviewSections) &&
    value.reviewSections.length <= 100 && value.reviewSections.every((section) => isRecord(section) &&
      hasOnlyKeys(section, ["label", "value", "state"]) && isNonEmptyString(section.label) &&
      isBoundedString(section.value) && isOptionalString(section.state)) && Array.isArray(value.actions) &&
    value.actions.length <= 100 && value.actions.every(isStudioActionControl)
}

function isRunPage(page: Record<string, unknown>): boolean {
  return hasOnlyKeys(page, [
    "kind", "route", "title", "purpose", "source", "actions", "design", "runs", "composer", "selectedRun", "events", "recovery", "managedEvidence", "evidence", "handoffs", "recoveryActions",
  ]) && isPageBase(page, "runs-evidence") && page.kind === "runs-evidence" && isTableSnapshot(page.runs) &&
    (page.composer === undefined || isRunComposer(page.composer)) && Array.isArray(page.selectedRun) &&
    page.selectedRun.every(isDefinitionEntry) && Array.isArray(page.events) && page.events.length <= 10_000 &&
    page.events.every((event) => isRecord(event) && hasOnlyKeys(event, ["id", "time", "kind", "summary"]) &&
      isNonEmptyString(event.id) && isNonEmptyString(event.time) && isNonEmptyString(event.kind) && isBoundedString(event.summary)) &&
    isTableSnapshot(page.recovery) && isTableSnapshot(page.managedEvidence) && isTableSnapshot(page.evidence) && isTableSnapshot(page.handoffs) &&
    Array.isArray(page.recoveryActions) && page.recoveryActions.length <= 100 &&
    page.recoveryActions.every(isStudioActionControl)
}

function isReadinessPage(page: Record<string, unknown>): boolean {
  return hasOnlyKeys(page, [
    "kind", "route", "title", "purpose", "source", "actions", "design", "statement", "sections", "gaps", "conflicts", "nextAction",
    "health", "designRevisions", "productRevisions", "portableDesignSnapshots", "designerReadyGates", "designDeltas", "designConflictResolutions", "humanDesignApprovals", "designBaselines", "designDriftDetections", "portability",
  ]) && isPageBase(page, "readiness") && page.kind === "readiness" && isNonEmptyString(page.statement) &&
    Array.isArray(page.sections) && page.sections.length === studioRoutes.length && page.sections.every(isOverviewSection) &&
    Array.isArray(page.gaps) && page.gaps.length <= 1_000 && page.gaps.every(isStudioIssue) &&
    Array.isArray(page.conflicts) && page.conflicts.length <= 1_000 && page.conflicts.every(isStudioIssue) &&
    (page.nextAction === undefined || isStudioActionControl(page.nextAction)) && Array.isArray(page.health) &&
    page.health.length <= 1_000 && page.health.every(isStudioIssue) && isTableSnapshot(page.designRevisions) &&
    isTableSnapshot(page.productRevisions) && isTableSnapshot(page.portableDesignSnapshots) &&
    isTableSnapshot(page.designerReadyGates) && isTableSnapshot(page.designDeltas) &&
    isTableSnapshot(page.designConflictResolutions) &&
    isTableSnapshot(page.humanDesignApprovals) &&
    isTableSnapshot(page.designBaselines) &&
    isTableSnapshot(page.designDriftDetections) &&
    Array.isArray(page.portability) && page.portability.every(isDefinitionEntry)
}

function isEnvelope(value: Record<string, unknown>, expectedChannelId: string): boolean {
  return value.protocolVersion === studioProtocolVersion && value.channelId === expectedChannelId
}

function routeMatchesPage(route: StudioRoute, page: Record<string, unknown>): boolean {
  switch (route) {
    case "overview": return isOverviewPage(page)
    case "direction":
    case "users-jobs":
    case "outcomes":
    case "scope":
    case "architecture": return isRecordFormPage(page, route)
    case "delivery": return isDeliveryPage(page)
    case "risks-decisions": return isRisksDecisionsPage(page)
    case "trace": return isTracePage(page)
    case "agents-tools": return isAgentPage(page)
    case "runs-evidence": return isRunPage(page)
    case "readiness": return isReadinessPage(page)
  }
}

export function isStudioSnapshot(value: unknown): value is StudioSnapshot {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    "protocolVersion", "contextGeneration", "snapshotRevision", "route", "workspace", "navigation", "surface", "dashboard", "phase2UxFigma", "phase2ChangeImpactAgentModel", "phase3aDashboard", "phase1Summary", "phase1ChangeImpact", "changeImpact", "agentModel", "phase1AgentModel", "page", "inspector", "footer",
  ])) return false
  if (value.protocolVersion !== studioProtocolVersion || !isOpaqueContextGeneration(value.contextGeneration) ||
    !isNonNegativeInteger(value.snapshotRevision) || !isStudioRoute(value.route)) {
    return false
  }
  if (!isRecord(value.workspace) || !isRecord(value.surface) || !isRecord(value.page) || !isRecord(value.footer)) return false
  if (!hasOnlyKeys(value.workspace, ["label", "trusted", "connectivity", "health"]) ||
    !isNonEmptyString(value.workspace.label) || typeof value.workspace.trusted !== "boolean" ||
    !["online", "offline", "provider-absent"].includes(String(value.workspace.connectivity)) ||
    !isNonEmptyString(value.workspace.health)) return false
  if (!isStudioSurfaceState(value.surface)) return false
  if (value.dashboard !== undefined && !isPhaseDashboardFramework(value.dashboard)) return false
  if (value.phase2UxFigma !== undefined &&
      (!isPhase2UxFigmaDashboard(value.phase2UxFigma) || !isRecord(value.dashboard) ||
       !isRecord(value.dashboard.phase) || value.dashboard.phase.id !== "phase-2-design")) return false
  if (value.phase2ChangeImpactAgentModel !== undefined &&
      (value.route !== "agents-tools" || !isPhase2ChangeImpactAgentModelDashboard(value.phase2ChangeImpactAgentModel) ||
       !isPhase2UxFigmaDashboard(value.phase2UxFigma) || !isPhase1AgentModelDashboard(value.phase1AgentModel) ||
       value.phase2ChangeImpactAgentModel.sources.phase2UxFigmaSnapshotDigest !== value.phase2UxFigma.snapshotDigest ||
       value.phase2ChangeImpactAgentModel.sources.phase2SourceCatalogDigest !== value.phase2UxFigma.phaseStatus.sourceCatalogDigest ||
       value.phase2ChangeImpactAgentModel.sources.agentModelSnapshotDigest !== value.phase1AgentModel.agentModel.snapshotDigest)) return false
  if (value.phase3aDashboard !== undefined &&
      (!isPhase3aDashboard(value.phase3aDashboard) || !isRecord(value.dashboard) || !isRecord(value.dashboard.phase) ||
       value.dashboard.phase.id !== "phase-3a-readiness")) return false
  if (value.phase1Summary !== undefined && !isPhase1SummaryDashboard(value.phase1Summary)) return false
  if (value.phase1ChangeImpact !== undefined && (value.route !== "delivery" || !isPhase1ChangeImpactDashboard(value.phase1ChangeImpact))) return false
  if (value.changeImpact !== undefined && (value.route !== "delivery" || !isChangeImpactDashboard(value.changeImpact))) return false
  if (value.agentModel !== undefined && (value.route !== "agents-tools" || !isAgentModelDashboard(value.agentModel))) return false
  if (value.phase1AgentModel !== undefined && (value.route !== "agents-tools" || !isPhase1AgentModelDashboard(value.phase1AgentModel))) return false
  if (!Array.isArray(value.navigation) || value.navigation.length !== studioRoutes.length) return false
  const navigationRoutes = value.navigation.flatMap((entry) =>
    isRecord(entry) && hasOnlyKeys(entry, ["route", "state", "gapCount"]) && isStudioRoute(entry.route) &&
      typeof entry.state === "string" && completionStateSet.has(entry.state) && isNonNegativeInteger(entry.gapCount)
      ? [entry.route]
      : [],
  )
  if (new Set(navigationRoutes).size !== studioRoutes.length) return false
  if (!hasOnlyKeys(value.footer, ["draftState", "sourceRevision", "validationSummary"]) ||
    typeof value.footer.draftState !== "string" || !draftStateSet.has(value.footer.draftState) ||
    (value.footer.sourceRevision !== undefined && !isNonNegativeInteger(value.footer.sourceRevision)) ||
    !isNonEmptyString(value.footer.validationSummary)) return false
  if (value.inspector !== undefined) {
    if (!isRecord(value.inspector) || !hasOnlyKeys(value.inspector, ["title", "recordId", "entries", "relationships", "actions"]) ||
      !isNonEmptyString(value.inspector.title) || !isNonEmptyString(value.inspector.recordId) ||
      !Array.isArray(value.inspector.entries) || value.inspector.entries.length > 1_000 ||
      !value.inspector.entries.every(isDefinitionEntry) ||
      !Array.isArray(value.inspector.relationships) || value.inspector.relationships.length > 1_000 ||
      !value.inspector.relationships.every(isDefinitionEntry) ||
      !Array.isArray(value.inspector.actions) || value.inspector.actions.length > 100 ||
      !value.inspector.actions.every(isStudioActionControl)) return false
  }
  return routeMatchesPage(value.route, value.page)
}

export function parseStudioToHostMessage(value: unknown, expectedChannelId: string): StudioToHostMessage | undefined {
  if (!isRecord(value) || !isEnvelope(value, expectedChannelId) || !isNonEmptyString(value.type)) return undefined
  switch (value.type) {
    case "studio.ready":
      if (!hasOnlyKeys(value, ["protocolVersion", "channelId", "type", "restoredRoute"])) return undefined
      if (value.restoredRoute !== undefined && !isStudioRoute(value.restoredRoute)) return undefined
      return value as unknown as StudioToHostMessage
    case "studio.navigate":
      if (!hasOnlyKeys(value, ["protocolVersion", "channelId", "type", "route"]) || !isStudioRoute(value.route)) return undefined
      return value as unknown as StudioToHostMessage
    case "studio.action":
      if (!hasOnlyKeys(value, [
        "protocolVersion", "channelId", "type", "requestId", "expectedContextGeneration", "expectedSnapshotRevision", "action",
      ]) || !isNonEmptyString(value.requestId) || !isOpaqueContextGeneration(value.expectedContextGeneration) ||
        !isNonNegativeInteger(value.expectedSnapshotRevision) || !isStudioAction(value.action)) {
        return undefined
      }
      return value as unknown as StudioToHostMessage
    default:
      return undefined
  }
}

function isActionResult(value: unknown): value is StudioActionResult {
  return isRecord(value) && hasOnlyKeys(value, ["status", "announcement", "focusFieldId", "diagnosticId"]) &&
    ["accepted", "rejected"].includes(String(value.status)) && isNonEmptyString(value.announcement) &&
    isOptionalString(value.focusFieldId) && isOptionalString(value.diagnosticId)
}

export function parseHostToStudioMessage(value: unknown, expectedChannelId: string): HostToStudioMessage | undefined {
  if (!isRecord(value) || !isEnvelope(value, expectedChannelId) || !isNonEmptyString(value.type)) return undefined
  switch (value.type) {
    case "studio.snapshot":
      if (!hasOnlyKeys(value, ["protocolVersion", "channelId", "type", "snapshot"]) || !isStudioSnapshot(value.snapshot)) return undefined
      return value as unknown as HostToStudioMessage
    case "studio.action-result":
      if (!hasOnlyKeys(value, ["protocolVersion", "channelId", "type", "requestId", "result", "snapshot"]) ||
        !isNonEmptyString(value.requestId) || !isActionResult(value.result) ||
        (value.snapshot !== undefined && !isStudioSnapshot(value.snapshot))) return undefined
      return value as unknown as HostToStudioMessage
    case "studio.focus-route":
      if (!hasOnlyKeys(value, ["protocolVersion", "channelId", "type", "route"]) || !isStudioRoute(value.route)) return undefined
      return value as unknown as HostToStudioMessage
    case "studio.announce":
      if (!hasOnlyKeys(value, ["protocolVersion", "channelId", "type", "message", "priority"]) ||
        !isNonEmptyString(value.message) || !["polite", "assertive"].includes(String(value.priority))) return undefined
      return value as unknown as HostToStudioMessage
    default:
      return undefined
  }
}
