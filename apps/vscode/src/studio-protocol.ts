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
  "search", "export", "import-preview", "workspace-health",
] as const

export type StudioDomainWorkflow = typeof studioDomainWorkflows[number]

export const studioDomainPageKinds = [
  "product-design-revision", "product-revision", "change", "work-item", "requirement", "decision", "risk",
  "architecture-record", "evidence", "trace-link", "context-pack", "workflow-plan", "tool-definition",
  "instruction-privilege-grant", "run-tool-selection",
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
  changes: StudioTableSnapshot
  workItems: StudioTableSnapshot
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
}

export interface TraceImpactGroup {
  label: string
  entries: StudioDefinitionEntry[]
}

export interface TracePageSnapshot extends StudioPageBase {
  kind: "trace"
  route: "trace"
  relationships: StudioTableSnapshot
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
    modelAlias: boolean | null
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
  evidence: StudioTableSnapshot
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
  page: StudioPageSnapshot
  inspector?: StudioInspectorSnapshot
  footer: StudioFooterSnapshot
}

export type StudioAction =
  | { kind: "navigate"; route: StudioRoute }
  | { kind: "initialize-product" }
  | { kind: "select-product-root" }
  | { kind: "create-initiative" }
  | { kind: "prepare-run" }
  | { kind: "verify-audit" }
  | { kind: "show-diagnostics" }
  | { kind: "manage-workspace-trust" }
  | { kind: "retry-recovery" }
  | { kind: "open-record"; recordId: string }
  | { kind: "show-source"; recordId: string }
  | { kind: "select-record"; recordId: string }
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
    case "analyze-impact":
      return hasOnlyKeys(value, ["kind", "recordId", "recordType", "revision", "digest"]) && isNonEmptyString(value.recordId) &&
        isOptionalString(value.recordType) && (value.revision === undefined || (isNonNegativeInteger(value.revision) && value.revision > 0)) &&
        isOptionalString(value.digest)
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
    "kind", "route", "title", "purpose", "source", "actions", "design", "initiatives", "changes", "workItems", "transitionPreview",
  ]) || !isPageBase(page, "delivery") || page.kind !== "delivery" || !isTableSnapshot(page.initiatives) ||
    !isTableSnapshot(page.changes) || !isTableSnapshot(page.workItems)) return false
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
    "kind", "route", "title", "purpose", "source", "actions", "design", "risks", "recommendations", "decisions",
  ]) && isPageBase(page, "risks-decisions") && page.kind === "risks-decisions" &&
    isTableSnapshot(page.risks) && isTableSnapshot(page.recommendations) && isTableSnapshot(page.decisions)
}

function isTracePage(page: Record<string, unknown>): boolean {
  return hasOnlyKeys(page, [
    "kind", "route", "title", "purpose", "source", "actions", "design", "relationships", "selectedRecordId", "impact", "caveat", "searchResults",
  ]) && isPageBase(page, "trace") && page.kind === "trace" && isTableSnapshot(page.relationships) &&
    isTableSnapshot(page.searchResults) && isOptionalString(page.selectedRecordId) && isOptionalString(page.caveat) && Array.isArray(page.impact) && page.impact.length <= 100 &&
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
    isNonEmptyString(page.selection.modelTruthClass) &&
    (typeof page.selection.modelAlias === "boolean" || page.selection.modelAlias === null) &&
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
    "kind", "route", "title", "purpose", "source", "actions", "design", "runs", "composer", "selectedRun", "events", "evidence", "recoveryActions",
  ]) && isPageBase(page, "runs-evidence") && page.kind === "runs-evidence" && isTableSnapshot(page.runs) &&
    (page.composer === undefined || isRunComposer(page.composer)) && Array.isArray(page.selectedRun) &&
    page.selectedRun.every(isDefinitionEntry) && Array.isArray(page.events) && page.events.length <= 10_000 &&
    page.events.every((event) => isRecord(event) && hasOnlyKeys(event, ["id", "time", "kind", "summary"]) &&
      isNonEmptyString(event.id) && isNonEmptyString(event.time) && isNonEmptyString(event.kind) && isBoundedString(event.summary)) &&
    isTableSnapshot(page.evidence) && Array.isArray(page.recoveryActions) && page.recoveryActions.length <= 100 &&
    page.recoveryActions.every(isStudioActionControl)
}

function isReadinessPage(page: Record<string, unknown>): boolean {
  return hasOnlyKeys(page, [
    "kind", "route", "title", "purpose", "source", "actions", "design", "statement", "sections", "gaps", "conflicts", "nextAction",
    "health", "designRevisions", "productRevisions", "portability",
  ]) && isPageBase(page, "readiness") && page.kind === "readiness" && isNonEmptyString(page.statement) &&
    Array.isArray(page.sections) && page.sections.length === studioRoutes.length && page.sections.every(isOverviewSection) &&
    Array.isArray(page.gaps) && page.gaps.length <= 1_000 && page.gaps.every(isStudioIssue) &&
    Array.isArray(page.conflicts) && page.conflicts.length <= 1_000 && page.conflicts.every(isStudioIssue) &&
    (page.nextAction === undefined || isStudioActionControl(page.nextAction)) && Array.isArray(page.health) &&
    page.health.length <= 1_000 && page.health.every(isStudioIssue) && isTableSnapshot(page.designRevisions) &&
    isTableSnapshot(page.productRevisions) && Array.isArray(page.portability) && page.portability.every(isDefinitionEntry)
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
    "protocolVersion", "contextGeneration", "snapshotRevision", "route", "workspace", "navigation", "surface", "page", "inspector", "footer",
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
