import type { AdapterCapabilities, AgentSelection, Initiative, Product, Run } from "@gaep/contracts"

import { currentInitiative, initiativeRunEligibility, newestRun, unsafeSelectionReasons } from "./safety.js"
import { runtimeBindingKey, type RuntimeBindingIndex } from "./runtime-binding.js"
import type { StudioDataSource, StudioRequestContext } from "./studio-data-source.js"
import {
  studioProtocolVersion,
  studioRouteLabels,
  studioRoutes,
  type AgentPageSnapshot,
  type CompletionState,
  type DeliveryPageSnapshot,
  type OverviewPageSnapshot,
  type OverviewSectionStatus,
  type ReadinessPageSnapshot,
  type RecordFormPageSnapshot,
  type RecordFormRoute,
  type RisksDecisionsPageSnapshot,
  type RunPageSnapshot,
  type StudioAction,
  type StudioActionControl,
  type StudioActionResult,
  type StudioDefinitionEntry,
  type StudioFieldSnapshot,
  type StudioInspectorSnapshot,
  type StudioIssue,
  type StudioPageSnapshot,
  type StudioRoute,
  type StudioSnapshot,
  type StudioSurfaceState,
  type StudioTableSnapshot,
  type TracePageSnapshot,
} from "./studio-protocol.js"

export interface CurrentStudioEngineReader {
  readProduct(): Promise<Product>
  readSelection(): Promise<AgentSelection>
  listRuns(): Promise<Run[]>
  repository: {
    verifyAudit(): Promise<{ valid: boolean; events: number; error?: string; warning?: string }>
  }
}

export type ExistingStudioCommand =
  | "gaep.initializeProduct"
  | "gaep.selectWorkspaceRoot"
  | "gaep.createInitiative"
  | "gaep.changeInitiativeState"
  | "gaep.selectAgent"
  | "gaep.prepareRun"
  | "gaep.verifyAudit"
  | "gaep.showDiagnostics"
  | "gaep.manageWorkspaceTrust"
  | "gaep.retryRecovery"

export interface CurrentEngineStudioContext {
  contextGeneration(): string
  trusted(): boolean
  workspace(): { name: string; path: string } | undefined
  engine(): CurrentStudioEngineReader | undefined
  recoveryDiagnostic(): string | undefined
  hasGaepState(): Promise<boolean>
  listInitiatives(): Promise<Initiative[]>
  probeAgents(): Promise<AdapterCapabilities[]>
  runtimeBindings(): RuntimeBindingIndex
  executeCommand(expectedContextGeneration: string, command: ExistingStudioCommand, ...args: unknown[]): PromiseLike<unknown>
  logDiagnostic(message: string, error?: unknown): void
}

interface ObservedStudioState {
  product?: Product
  initiatives: Initiative[]
  runs: Run[]
  selection?: AgentSelection
  agents: AdapterCapabilities[]
  audit?: { valid: boolean; events: number; error?: string; warning?: string }
  issues: StudioIssue[]
  productState: "available" | "absent" | "invalid"
}

const unavailableDomains: Readonly<Record<StudioRoute, string | undefined>> = {
  overview: undefined,
  direction: "A governed Direction section is not available in the current engine. Bootstrap Product fields are shown read-only.",
  "users-jobs": "Governed User and Job records are not available in the current engine. Bootstrap Product fields are shown read-only.",
  outcomes: "Governed Outcome records are not available in the current engine. Bootstrap Product fields are shown read-only.",
  scope: "A governed Scope section is not available in the current engine. Bootstrap exclusions are shown read-only.",
  delivery: "Change and Work Item domains are not available. Current Initiative records remain usable.",
  architecture: "The current engine has no governed Architecture section.",
  "risks-decisions": "The current engine has no governed Risk, Recommendation, or Decision records.",
  trace: "The current engine has no persisted cross-domain trace graph.",
  "agents-tools": undefined,
  "runs-evidence": "Runs are available, but structured event and evidence records are not yet exposed by the current engine.",
  readiness: "Formal readiness evaluation is not available until the missing governed sections and trace evidence exist.",
}

function control(
  label: string,
  action: StudioAction,
  enabled = true,
  emphasis: StudioActionControl["emphasis"] = "secondary",
  disabledReason?: string,
): StudioActionControl {
  return { label, action, enabled, emphasis, ...(disabledReason ? { disabledReason } : {}) }
}

function issue(
  id: string,
  message: string,
  severity: StudioIssue["severity"] = "warning",
  sourceRecordId?: string,
): StudioIssue {
  return { id, message, severity, ...(sourceRecordId ? { sourceRecordId } : {}) }
}

function emptySurface(title: string, detail: string, actions: StudioActionControl[] = []): StudioSurfaceState {
  return { kind: "empty", title, detail, issues: [], actions }
}

function emptyTable(id: string, title: string, detail: string): StudioTableSnapshot {
  return {
    id,
    title,
    columns: [],
    rows: [],
    actions: [],
    emptyState: emptySurface(`${title} unavailable`, detail),
  }
}

function source(product?: Product, provenance = "Current GAEP engine snapshot") {
  return {
    ...(product ? { recordId: product.id, sourceRevision: product.revision } : {}),
    provenance,
    freshness: "Read when this snapshot was created",
  }
}

function base<R extends StudioRoute>(route: R, product?: Product) {
  return {
    route,
    title: studioRouteLabels[route],
    purpose: purposeFor(route),
    source: source(product),
    actions: [] as StudioActionControl[],
  }
}

function purposeFor(route: StudioRoute): string {
  switch (route) {
    case "overview": return "See current Product truth, progress, blockers, and the next governed move."
    case "direction": return "Define why the Product should exist and which problem it addresses."
    case "users-jobs": return "Capture affected users, their jobs, and the workflow context."
    case "outcomes": return "Define desired outcomes and observable success signals."
    case "scope": return "Bound included and excluded Product scope."
    case "delivery": return "Manage bounded Initiatives and, when available, Changes and Work Items."
    case "architecture": return "Record the Product architecture and material technical constraints."
    case "risks-decisions": return "Track risks, recommendations, and accountable decisions."
    case "trace": return "Inspect relationships and downstream impact across governed records."
    case "agents-tools": return "Inspect installed agents and choose only a supported execution boundary."
    case "runs-evidence": return "Inspect governed runs, lifecycle state, and available evidence."
    case "readiness": return "Determine what is known, missing, conflicting, and safe to do next."
  }
}

function domainIssue(route: StudioRoute): StudioIssue[] {
  const message = unavailableDomains[route]
  return message ? [issue(`domain-${route}`, message, "warning")] : []
}

function textField(
  id: string,
  label: string,
  question: string,
  value: string | string[],
  provenance: string,
  kind: StudioFieldSnapshot["kind"] = "long-text",
): StudioFieldSnapshot {
  return {
    id,
    label,
    question,
    kind,
    value,
    required: false,
    provenance,
    validation: { state: "not-validated", message: "This is read-only bootstrap context, not a validated governed section." },
    readOnly: true,
  }
}

function legacyForm(route: RecordFormRoute, product?: Product): RecordFormPageSnapshot {
  const provenance = "Legacy Product bootstrap record (read-only)"
  const fields: StudioFieldSnapshot[] = []
  if (product) {
    switch (route) {
      case "direction":
        fields.push(
          textField("summary", "Summary", "What is the current Product summary?", product.summary, provenance, "single-line"),
          textField("problem", "Problem", "What problem does the Product currently claim to solve?", product.problem, provenance),
        )
        break
      case "users-jobs":
        fields.push(
          textField("affected-users", "Affected users", "Who is currently identified as affected?", product.affectedUsers, provenance),
          textField("first-workflow", "First workflow", "What first complete workflow was captured?", product.firstWorkflow, provenance),
        )
        break
      case "outcomes":
        fields.push(
          textField("desired-outcome", "Desired outcome", "What outcome is currently desired?", product.desiredOutcome, provenance),
          textField("success-signals", "Success signals", "Which signals were captured?", product.successSignals, provenance, "string-list"),
        )
        break
      case "scope":
        fields.push(textField("exclusions", "Exclusions", "What is explicitly excluded?", product.exclusions, provenance, "string-list"))
        break
      case "architecture":
        break
    }
  }
  return {
    ...base(route, product),
    kind: "record-form",
    ...(product ? { recordId: product.id, baseRevision: product.revision } : {}),
    fields,
    gaps: domainIssue(route),
    conflicts: [],
    draft: { state: "clean", materialChange: false, validation: "not-validated" },
  }
}

function sectionsFor(state: ObservedStudioState): OverviewSectionStatus[] {
  const hasProduct = Boolean(state.product)
  const hasSelection = Boolean(state.selection)
  const section = (route: StudioRoute, completion: CompletionState, gapCount: number): OverviewSectionStatus =>
    ({ route, state: completion, gapCount })
  return [
    section("overview", hasProduct ? "complete" : "not-started", hasProduct ? 0 : 1),
    section("direction", hasProduct ? "in-progress" : "not-started", 1),
    section("users-jobs", hasProduct ? "in-progress" : "not-started", 1),
    section("outcomes", hasProduct ? "in-progress" : "not-started", 1),
    section("scope", hasProduct ? "in-progress" : "not-started", 1),
    section("delivery", state.initiatives.length > 0 ? "in-progress" : "not-started", 2),
    section("architecture", "not-started", 1),
    section("risks-decisions", "not-started", 3),
    section("trace", "not-started", 1),
    section("agents-tools", hasSelection ? "in-progress" : "not-started", hasSelection ? 1 : 2),
    section("runs-evidence", state.runs.length > 0 ? "in-progress" : "not-started", 2),
    section("readiness", "blocked", unavailableDomainsCount()),
  ]
}

function unavailableDomainsCount(): number {
  return Object.values(unavailableDomains).filter(Boolean).length
}

function selectedInitiativeEntries(initiatives: Initiative[]): StudioDefinitionEntry[] {
  const selected = currentInitiative(initiatives)
  if (!selected) return []
  return [
    { term: "Initiative", value: selected.title, recordId: selected.id },
    { term: "State", value: selected.state, recordId: selected.id },
    { term: "Outcome", value: selected.outcome, recordId: selected.id },
  ]
}

function latestRunEntries(runs: Run[]): StudioDefinitionEntry[] {
  const run = newestRun(runs)
  if (!run) return []
  return [
    { term: "Run", value: run.id, recordId: run.id },
    { term: "State", value: run.state, recordId: run.id },
    { term: "Agent", value: `${run.agent.agentId} / ${run.agent.modelId}`, recordId: run.id },
  ]
}

interface PrepareRunEligibility {
  eligible: boolean
  selectionReady: boolean
  initiativeReady: boolean
  reason?: string
  issues: StudioIssue[]
  selectedInitiative?: Initiative
}

function prepareRunEligibility(state: ObservedStudioState): PrepareRunEligibility {
  const issues: StudioIssue[] = []
  let selectionReady = false
  if (!state.selection) {
    issues.push(issue("agent-selection-missing", "Select a supported agent and model before preparing a run.", "blocker"))
  } else if (state.selection.agentId !== "codex-cli") {
    issues.push(issue(
      "agent-selection-unsupported",
      `${state.selection.agentId} is inspection-only in this release and cannot start a governed run.`,
      "blocker",
    ))
  } else {
    const unsafe = unsafeSelectionReasons(state.selection.agentId, state.selection.settings)
    if (unsafe.length === 0) selectionReady = true
    else issues.push(...unsafe.map((message, index) => issue(`selection-${index + 1}`, message, "blocker")))
  }

  const selectedInitiative = currentInitiative(state.initiatives)
  let initiativeReady = false
  if (!selectedInitiative) {
    issues.push(issue("initiative-missing", "Create and activate a bounded Initiative before preparing a run.", "blocker"))
  } else {
    const initiative = initiativeRunEligibility(selectedInitiative)
    initiativeReady = initiative.eligible
    if (!initiative.eligible) {
      issues.push(issue(
        `initiative-${selectedInitiative.id}`,
        initiative.reason ?? "The selected Initiative cannot prepare a run.",
        "blocker",
        selectedInitiative.id,
      ))
    }
  }

  const running = state.runs.find((run) => run.state === "running")
  if (running) issues.push(issue(`run-${running.id}`, `Run ${running.id} is already running.`, "blocker", running.id))
  for (const run of state.runs.filter((candidate) => candidate.state === "unknown")) {
    issues.push(issue(`run-${run.id}`, `Run ${run.id} has unknown effects and requires investigation.`, "blocker", run.id))
  }
  if (!state.audit) issues.push(issue("audit-unavailable", "The local audit chain could not be verified.", "blocker"))
  else if (!state.audit.valid) issues.push(issue("audit-invalid", "The local audit chain did not verify.", "blocker"))

  return {
    eligible: selectionReady && initiativeReady && issues.length === 0,
    selectionReady,
    initiativeReady,
    ...(issues[0] ? { reason: issues[0].message } : {}),
    issues,
    ...(selectedInitiative ? { selectedInitiative } : {}),
  }
}

function prepareRunControl(eligibility: PrepareRunEligibility): StudioActionControl {
  return control(
    "Create charter and start run",
    { kind: "prepare-run" },
    eligibility.eligible,
    "primary",
    eligibility.eligible ? undefined : eligibility.reason ?? "Resolve the current run-preparation blockers first.",
  )
}

function uniqueIssues(issues: StudioIssue[]): StudioIssue[] {
  return [...new Map(issues.map((candidate) => [candidate.id, candidate])).values()]
}

function primaryAction(state: ObservedStudioState, eligibility = prepareRunEligibility(state)): StudioActionControl | undefined {
  if (!state.product) return control("Initialize Product", { kind: "initialize-product" }, true, "primary")
  if (!state.selection || !eligibility.selectionReady) {
    return control("Select agent and model", { kind: "select-agent", adapterId: "native-picker", agentId: "native-picker", modelId: "native-picker", settings: {} }, true, "primary")
  }
  const selected = eligibility.selectedInitiative
  if (!selected) return control("Create Initiative", { kind: "create-initiative" }, true, "primary")
  if (!eligibility.initiativeReady) {
    return control("Review Initiative state", {
      kind: "transition-record",
      recordType: "initiative",
      recordId: selected.id,
      toState: "native-picker",
      reason: "Confirm in the native GAEP workflow",
    }, true, "primary")
  }
  return prepareRunControl(eligibility)
}

function overviewPage(state: ObservedStudioState): OverviewPageSnapshot {
  const product = state.product
  const eligibility = prepareRunEligibility(state)
  const blockers = uniqueIssues([
    ...state.issues,
    ...state.initiatives.filter((candidate) => candidate.state === "blocked")
      .map((candidate) => issue(`initiative-${candidate.id}`, `${candidate.title} is blocked.`, "blocker", candidate.id)),
    ...eligibility.issues,
  ])
  const primary = primaryAction(state, eligibility)
  return {
    ...base("overview", product),
    kind: "overview",
    product: {
      name: product?.name ?? "Product not initialized",
      lifecycle: product?.lifecycleState ?? "uninitialized",
      ...(product?.revision ? { revision: product.revision } : {}),
      readinessStatement: product
        ? "Bootstrap Product truth is available; formal Product readiness is not assessed because governed design domains and trace evidence are incomplete."
        : "Initialize a Product before readiness can be evaluated.",
    },
    ...(primary ? { primaryAction: primary } : {}),
    sections: sectionsFor(state),
    currentInitiative: selectedInitiativeEntries(state.initiatives),
    latestRun: latestRunEntries(state.runs),
    blockers,
  }
}

function deliveryPage(state: ObservedStudioState): DeliveryPageSnapshot {
  const initiatives: StudioTableSnapshot = {
    id: "initiatives",
    title: "Initiatives",
    columns: [
      { key: "title", label: "Initiative", identifier: true },
      { key: "outcome", label: "Outcome" },
      { key: "state", label: "State" },
      { key: "updated", label: "Updated" },
    ],
    rows: state.initiatives.map((candidate) => ({
      id: candidate.id,
      cells: { title: candidate.title, outcome: candidate.outcome, state: candidate.state, updated: candidate.updatedAt },
      state: candidate.state,
      actions: [control("Change state", {
        kind: "transition-record",
        recordType: "initiative",
        recordId: candidate.id,
        toState: "native-picker",
        reason: "Confirm in the native GAEP workflow",
      })],
    })),
    actions: [control("Create Initiative", { kind: "create-initiative" }, true, "primary")],
    ...(state.initiatives.length === 0 ? { emptyState: emptySurface("No Initiatives", "Create a bounded Initiative before preparing a run.", [control("Create Initiative", { kind: "create-initiative" }, true, "primary")]) } : {}),
  }
  return {
    ...base("delivery", state.product),
    kind: "delivery",
    actions: [control("Create Initiative", { kind: "create-initiative" }, true, "primary")],
    initiatives,
    changes: emptyTable("changes", "Changes", "The current engine does not expose governed Change records."),
    workItems: emptyTable("work-items", "Work Items", "The current engine does not expose governed Work Item records."),
  }
}

function risksPage(state: ObservedStudioState): RisksDecisionsPageSnapshot {
  return {
    ...base("risks-decisions", state.product),
    kind: "risks-decisions",
    risks: emptyTable("risks", "Risks", "Governed Risk records are not available."),
    recommendations: emptyTable("recommendations", "Recommendations", "Governed Recommendation records are not available."),
    decisions: emptyTable("decisions", "Decisions", "Governed Decision records are not available."),
  }
}

function tracePage(state: ObservedStudioState): TracePageSnapshot {
  return {
    ...base("trace", state.product),
    kind: "trace",
    relationships: emptyTable("relationships", "Relationships", "A persisted trace graph is not available in the current engine."),
    impact: [],
    caveat: "No relationship or impact claim is inferred from filenames or co-location.",
  }
}

function agentStatus(capability: AdapterCapabilities): string {
  if (!capability.detected) return "Not detected"
  if (capability.agentId === "claude-code-cli" || capability.executionInterface === "unavailable") return "Detected · inspection only"
  if (capability.agentId === "codex-cli") return "Detected · observe-only direct runs"
  return "Detected · execution not enabled by this VS Code release"
}

function displaySettingValue(value: unknown): string {
  if (value === undefined) return "undefined"
  if (typeof value === "string") return value.slice(0, 20_000)
  if (typeof value === "number" || typeof value === "boolean" || value === null) return String(value)
  try {
    return (JSON.stringify(value) ?? "unknown").slice(0, 20_000)
  } catch {
    return "unavailable"
  }
}

function agentPage(
  state: ObservedStudioState,
  bindings: RuntimeBindingIndex,
  workspacePath?: string,
): { page: AgentPageSnapshot; inspector?: StudioInspectorSnapshot } {
  const index = new Map(state.agents.map((candidate) => [candidate.adapterId, candidate]))
  const rows = state.agents.map((capability) => {
    const binding = workspacePath ? bindings[runtimeBindingKey(workspacePath, capability.adapterId)] : undefined
    const selectable = capability.detected && capability.executionInterface !== "unavailable" && capability.agentId === "codex-cli"
    const modelId = capability.models[0]?.id ?? "provider-selected"
    return {
      id: capability.adapterId,
      cells: {
        agent: capability.agentLabel,
        runtime: capability.runtimeVersion ?? "not observed",
        executable: binding?.digest ? `${binding.digest.slice(0, 18)}…` : "no trusted fingerprint",
        interface: capability.executionInterface,
        maturity: capability.interfaceMaturity,
        status: agentStatus(capability),
      },
      state: selectable ? "available" : capability.detected ? "detection-only" : "absent",
      actions: [control(
        "Select",
        { kind: "select-agent", adapterId: capability.adapterId, agentId: capability.agentId, modelId, settings: {} },
        selectable,
        "secondary",
        selectable ? undefined : "Only Codex with the observe-only direct-execution boundary is selectable in this release.",
      )],
    }
  })
  const selectedCapability = state.selection ? index.get(state.selection.adapterId) : undefined
  const sensitiveKeys = new Set(selectedCapability?.settings.filter((setting) => setting.sensitive).map((setting) => setting.key) ?? [])
  const settings = state.selection
    ? Object.entries(state.selection.settings).map(([key, value]) => ({
        term: key,
        value: sensitiveKeys.has(key) ? "[redacted]" : displaySettingValue(value),
      }))
    : []
  const limitations: StudioIssue[] = state.agents.flatMap((capability) => capability.limitations.slice(0, 50).map((message, index) =>
    issue(`${capability.adapterId}-limitation-${index + 1}`, `${capability.agentLabel}: ${message}`, "information")))
  if (state.agents.some((candidate) => candidate.agentId === "claude-code-cli" && candidate.detected)) {
    limitations.unshift(issue("claude-inspection-only", "Claude Code is detected for inspection only; this extension will not launch it.", "warning"))
  }
  if (state.agents.some((candidate) => candidate.agentId === "codex-cli" && candidate.detected)) {
    limitations.unshift(issue("codex-observe-only", "Direct Codex runs are restricted to read-only workspace access with network and escalation denied.", "information"))
  }
  const page: AgentPageSnapshot = {
    ...base("agents-tools", state.product),
    kind: "agents-tools",
    actions: [control("Select agent and model", { kind: "select-agent", adapterId: "native-picker", agentId: "native-picker", modelId: "native-picker", settings: {} }, true, "primary")],
    adapters: {
      id: "adapters",
      title: "Installed agent adapters",
      columns: [
        { key: "agent", label: "Agent", identifier: true },
        { key: "runtime", label: "Runtime" },
        { key: "executable", label: "Trusted fingerprint" },
        { key: "interface", label: "Interface" },
        { key: "maturity", label: "Maturity" },
        { key: "status", label: "Status" },
      ],
      rows,
      actions: [],
      ...(rows.length === 0 ? { emptyState: emptySurface("No agent observation", "No adapter probe completed successfully.", [control("Retry detection", { kind: "retry-provider", adapterId: "native-picker" })]) } : {}),
    },
    ...(state.selection ? {
      selection: {
        agent: state.selection.agentId,
        model: state.selection.modelId,
        modelTruthClass: state.selection.modelTruthClass,
        modelAlias: state.selection.modelAlias === true,
        settings,
        limitationsReviewed: false,
        actions: [control("Change selection", { kind: "select-agent", adapterId: "native-picker", agentId: "native-picker", modelId: "native-picker", settings: {} })],
      },
    } : {}),
    selectedAgent: state.selection ? [
      { term: "Adapter", value: state.selection.adapterId },
      { term: "Agent", value: state.selection.agentId },
      { term: "Model", value: state.selection.modelId },
      { term: "Model truth", value: state.selection.modelTruthClass },
    ] : [],
    limitations,
    handoffs: emptyTable("handoffs", "Handoffs", "The current engine does not expose a handoff list to Product Studio."),
  }
  const inspector: StudioInspectorSnapshot | undefined = state.selection ? {
    title: "Machine-local runtime inspector",
    recordId: state.selection.adapterId,
    entries: [
      { term: "Resolved executable", value: state.selection.runtimeExecutable },
      { term: "Capability digest", value: state.selection.capabilityDigest },
      { term: "Selected at", value: state.selection.selectedAt },
    ],
    relationships: [],
    actions: [control("Show diagnostics", { kind: "show-diagnostics" })],
  } : undefined
  return { page, inspector }
}

function runPage(state: ObservedStudioState): RunPageSnapshot {
  const unknownRuns = state.runs.filter((run) => run.state === "unknown")
  const eligibility = prepareRunEligibility(state)
  return {
    ...base("runs-evidence", state.product),
    kind: "runs-evidence",
    actions: [prepareRunControl(eligibility)],
    runs: {
      id: "runs",
      title: "Governed runs",
      columns: [
        { key: "run", label: "Run", identifier: true },
        { key: "initiative", label: "Initiative" },
        { key: "agent", label: "Agent / model" },
        { key: "state", label: "State" },
        { key: "started", label: "Started" },
        { key: "ended", label: "Ended" },
      ],
      rows: state.runs.map((run) => ({
        id: run.id,
        cells: {
          run: run.id,
          initiative: run.initiativeId,
          agent: `${run.agent.agentId} / ${run.agent.modelId}`,
          state: run.state,
          started: run.startedAt ?? "not started",
          ended: run.endedAt ?? "not ended",
        },
        state: run.state,
        actions: run.state === "unknown" ? [control("Inspect diagnostics", { kind: "show-diagnostics" })] : [],
      })),
      actions: [],
      ...(state.runs.length === 0 ? { emptyState: emptySurface("No runs", "Create an active Initiative and select Codex before preparing an observe-only run.") } : {}),
    },
    selectedRun: latestRunEntries(state.runs),
    events: [],
    evidence: emptyTable("evidence", "Evidence", "Structured run evidence is not exposed by the current engine."),
    recoveryActions: unknownRuns.length > 0 ? [control("Show diagnostics", { kind: "show-diagnostics" })] : [],
  }
}

function readinessPage(state: ObservedStudioState): ReadinessPageSnapshot {
  const sections = sectionsFor(state)
  const gaps = studioRoutes.flatMap((route) => domainIssue(route))
  if (!state.selection) gaps.push(issue("agent-selection-missing", "No agent and model selection exists.", "blocker"))
  if (state.initiatives.length === 0) gaps.push(issue("initiative-missing", "No bounded Initiative exists.", "blocker"))
  gaps.push(...state.issues)
  const next = primaryAction(state)
  return {
    ...base("readiness", state.product),
    kind: "readiness",
    statement: "Not formally ready. Current bootstrap, Initiative, agent-selection, run, and audit truth can be inspected, but missing governed design domains and trace evidence prevent a complete readiness claim.",
    sections,
    gaps,
    conflicts: state.audit && !state.audit.valid ? [issue("audit-conflict", "Audit verification conflicts with a healthy governance claim.", "blocker")] : [],
    ...(next ? { nextAction: next } : {}),
  }
}

function pageFor(
  route: StudioRoute,
  state: ObservedStudioState,
  bindings: RuntimeBindingIndex,
  workspacePath?: string,
): { page: StudioPageSnapshot; inspector?: StudioInspectorSnapshot } {
  switch (route) {
    case "overview": return { page: overviewPage(state) }
    case "direction":
    case "users-jobs":
    case "outcomes":
    case "scope":
    case "architecture": return { page: legacyForm(route, state.product) }
    case "delivery": return { page: deliveryPage(state) }
    case "risks-decisions": return { page: risksPage(state) }
    case "trace": return { page: tracePage(state) }
    case "agents-tools": return agentPage(state, bindings, workspacePath)
    case "runs-evidence": return { page: runPage(state) }
    case "readiness": return { page: readinessPage(state) }
  }
}

function surfaceFor(route: StudioRoute, context: CurrentEngineStudioContext, state: ObservedStudioState): StudioSurfaceState {
  if (!context.trusted()) {
    return {
      kind: "blocked",
      title: "Workspace trust required",
      detail: "GAEP will not inspect Product state, probe executables, or start a provider in an untrusted workspace.",
      issues: [issue("workspace-untrusted", "Workspace trust is the current stop line.", "blocker")],
      actions: [control("Manage Workspace Trust", { kind: "manage-workspace-trust" }, true, "primary")],
    }
  }
  if (!context.workspace()) {
    return {
      kind: "uninitialized",
      title: "Select a Product root",
      detail: "Choose which workspace folder owns GAEP Product state.",
      issues: [],
      actions: [control("Select Product Root", { kind: "select-product-root" }, true, "primary")],
    }
  }
  if (!context.engine()) {
    return { kind: "loading", title: "Loading Product context", detail: "The selected root is being configured.", issues: [], actions: [] }
  }
  if (context.recoveryDiagnostic()) {
    return {
      kind: "blocked",
      title: "Recovery is blocked",
      detail: "Resolve the diagnostic before changing Product state or starting a provider.",
      issues: [issue("recovery-blocked", "Interrupted-run recovery did not complete.", "blocker")],
      actions: [control("Retry Recovery", { kind: "retry-recovery" }, true, "primary"), control("Show Diagnostics", { kind: "show-diagnostics" })],
    }
  }
  if (state.productState === "absent") {
    return {
      kind: "uninitialized",
      title: "Initialize this Product",
      detail: "No .gaep state exists in the selected root.",
      issues: [],
      actions: [control("Initialize Product", { kind: "initialize-product" }, true, "primary")],
    }
  }
  if (state.productState === "invalid") {
    return {
      kind: "invalid",
      title: "Product state needs repair",
      detail: "Existing GAEP state could not be read safely. Initialization remains disabled to preserve it.",
      issues: [issue("product-invalid", "Review GAEP diagnostics for the local validation failure.", "blocker")],
      actions: [control("Show Diagnostics", { kind: "show-diagnostics" }, true, "primary")],
    }
  }
  if (["architecture", "risks-decisions", "trace"].includes(route)) {
    return {
      kind: "empty",
      title: `${studioRouteLabels[route]} is not available yet`,
      detail: unavailableDomains[route],
      issues: domainIssue(route),
      actions: [],
    }
  }
  return {
    kind: "ready",
    title: `${studioRouteLabels[route]} loaded`,
    issues: state.issues,
    actions: [],
    lastVerifiedState: state.audit ? `${state.audit.valid ? "Valid" : "Invalid"} audit chain · ${state.audit.events} events` : "Audit not assessed",
    knownEffects: route === "agents-tools"
      ? [
          "This snapshot reads local GAEP state.",
          "It invokes configured agent executables for bounded version and model-catalog discovery; it does not start a governed provider run.",
        ]
      : ["This snapshot reads local GAEP state only."],
    unknownEffects: unavailableDomains[route] ? [unavailableDomains[route]!] : [],
  }
}

function commandFor(action: StudioAction): { command: ExistingStudioCommand; args: unknown[]; announcement: string } | undefined {
  switch (action.kind) {
    case "initialize-product": return { command: "gaep.initializeProduct", args: [], announcement: "Opened the native Product initialization workflow." }
    case "select-product-root": return { command: "gaep.selectWorkspaceRoot", args: [], announcement: "Opened the native Product-root picker." }
    case "create-initiative": return { command: "gaep.createInitiative", args: [], announcement: "Opened the native Initiative workflow." }
    case "prepare-run": return { command: "gaep.prepareRun", args: [], announcement: "Opened the native governed-run workflow." }
    case "verify-audit": return { command: "gaep.verifyAudit", args: [], announcement: "Audit verification completed in the extension host." }
    case "show-diagnostics": return { command: "gaep.showDiagnostics", args: [], announcement: "Opened GAEP diagnostics." }
    case "manage-workspace-trust": return { command: "gaep.manageWorkspaceTrust", args: [], announcement: "Opened Workspace Trust management." }
    case "retry-recovery": return { command: "gaep.retryRecovery", args: [], announcement: "Opened the native recovery workflow." }
    case "select-agent":
    case "retry-provider":
    case "begin-handoff": return { command: "gaep.selectAgent", args: [], announcement: "Opened the native agent and model workflow." }
    case "transition-record":
      return action.recordType === "initiative"
        ? { command: "gaep.changeInitiativeState", args: [action.recordId], announcement: "Opened the native Initiative transition workflow." }
        : undefined
    default: return undefined
  }
}

export class CurrentEngineStudioDataSource implements StudioDataSource {
  private revision = 0

  constructor(private readonly context: CurrentEngineStudioContext) {}

  async readSnapshot(route: StudioRoute, signal?: AbortSignal): Promise<StudioSnapshot> {
    signal?.throwIfAborted()
    const contextGeneration = this.context.contextGeneration()
    const observed = await this.observe(route)
    signal?.throwIfAborted()
    if (contextGeneration !== this.context.contextGeneration()) {
      throw new Error("Product Studio context changed while the snapshot was being read")
    }
    const workspace = this.context.workspace()
    const page = pageFor(route, observed, this.context.runtimeBindings(), workspace?.path)
    const sections = sectionsFor(observed)
    return {
      protocolVersion: studioProtocolVersion,
      contextGeneration,
      snapshotRevision: ++this.revision,
      route,
      workspace: {
        label: workspace?.name ?? "No Product root selected",
        trusted: this.context.trusted(),
        connectivity: observed.runs.some((run) => run.state === "running") ? "online" : "provider-absent",
        health: observed.productState === "available" ? (observed.audit?.valid === false ? "audit invalid" : "local state loaded") : observed.productState,
      },
      navigation: sections,
      surface: surfaceFor(route, this.context, observed),
      page: page.page,
      ...(page.inspector ? { inspector: page.inspector } : {}),
      footer: {
        draftState: "clean",
        ...(observed.product?.revision ? { sourceRevision: observed.product.revision } : {}),
        validationSummary: "Current engine state observed; formal Product-section validation not assessed.",
      },
    }
  }

  async execute(action: StudioAction, request: StudioRequestContext): Promise<StudioActionResult> {
    request.signal?.throwIfAborted()
    if (request.expectedContextGeneration !== this.context.contextGeneration()) {
      return { status: "rejected", announcement: "The Product root or trust context changed since this action was offered. Review the refreshed state and try again." }
    }
    if (request.expectedSnapshotRevision !== this.revision) {
      return { status: "rejected", announcement: "Product Studio changed since this action was offered. Review the refreshed state and try again." }
    }
    if (action.kind === "navigate") return { status: "accepted", announcement: `Opened ${studioRouteLabels[action.route]}.` }
    const mapped = commandFor(action)
    if (!mapped) {
      return { status: "rejected", announcement: "This Product-domain operation is not available in the current engine. No state was changed." }
    }
    request.signal?.throwIfAborted()
    await this.context.executeCommand(request.expectedContextGeneration, mapped.command, ...mapped.args)
    return { status: "accepted", announcement: mapped.announcement }
  }

  private async observe(route: StudioRoute): Promise<ObservedStudioState> {
    const empty: ObservedStudioState = {
      initiatives: [], runs: [], agents: [], issues: [], productState: "absent",
    }
    if (!this.context.trusted() || !this.context.workspace() || !this.context.engine()) return empty
    const engine = this.context.engine()!
    try {
      empty.product = await engine.readProduct()
      empty.productState = "available"
    } catch (error) {
      let hasState = true
      try { hasState = await this.context.hasGaepState() } catch { hasState = true }
      empty.productState = hasState ? "invalid" : "absent"
      if (hasState) this.context.logDiagnostic("Product Studio could not read existing Product state", error)
      return empty
    }
    const outcomes = await Promise.allSettled([
      this.context.listInitiatives(),
      engine.listRuns(),
      engine.readSelection(),
      engine.repository.verifyAudit(),
      route === "agents-tools" ? this.context.probeAgents() : Promise.resolve([]),
    ] as const)
    const [initiatives, runs, selection, audit, agents] = outcomes
    if (initiatives.status === "fulfilled") empty.initiatives = initiatives.value
    else this.recordObservationFailure(empty, "initiatives", initiatives.reason)
    if (runs.status === "fulfilled") empty.runs = runs.value
    else this.recordObservationFailure(empty, "runs", runs.reason)
    if (selection.status === "fulfilled") empty.selection = selection.value
    else empty.issues.push(issue("selection-unavailable", "No valid agent selection is currently available.", "information"))
    if (audit.status === "fulfilled") empty.audit = audit.value
    else this.recordObservationFailure(empty, "audit", audit.reason)
    if (agents.status === "fulfilled") empty.agents = agents.value
    else this.recordObservationFailure(empty, "agent-probe", agents.reason)
    return empty
  }

  private recordObservationFailure(state: ObservedStudioState, area: string, error: unknown): void {
    this.context.logDiagnostic(`Product Studio ${area} observation failed`, error)
    state.issues.push(issue(`${area}-unavailable`, `${area.replaceAll("-", " ")} could not be observed. Review GAEP diagnostics.`, "warning"))
  }
}
