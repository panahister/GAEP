import { randomBytes } from "node:crypto"
import { join } from "node:path"

import * as vscode from "vscode"

import {
  collectInitiativeApplicability,
  collectInitiativeClassification,
  containsSecretShapedValue,
  InitiativeEntryWorkflowCancelled,
  type BusinessArchitectureBaselineProjection,
  type BoundedContextModelProjection,
  type BusinessCapabilityMapProjection,
  type BusinessRuleCatalogProjection,
  type BusinessUnderstandingProjection,
  type DataModelProjection,
  type AuthorizationModelProjection,
  type EventIntegrationModelProjection,
  type FailureRecoveryModelProjection,
  type ArchitectureChallengeModelProjection,
  type Initiative,
  type InitiativeEntryAssessment,
  type InitiativeEntryWorkflowUi,
  type OperatingModelProjection,
  type SecurityPrivacyAssessmentProjection,
  type ProcessModelProjection,
  type SourceGovernanceProjection,
  type SystemSolutionArchitectureProjection,
  type ValueStreamModelProjection,
} from "@gaep/contracts"

import {
  accessibleTableCsv,
  buildAccessibleTableView,
  createAccessibleMetadataTable,
  renderAccessibleTableText,
  type AccessibleMetadataTable,
  type AccessibleTableColumn,
  type AccessibleTableRow,
  type AccessibleTableSortDirection,
} from "./accessible-table.js"
import { GaepEngineClient } from "./engine-client.js"
import {
  GaepHostError,
  normalizeActorId,
  normalizeExistingLocalFolder,
  normalizeUuid,
  validatePage,
  type AgentHandoff,
  type AgentModelDashboard,
  type AgentReadinessSnapshot,
  type AgentRun,
  type AgentSelection,
  type AgentSelectionSetting,
  type ChangeImpactChangeCatalog,
  type ChangeImpactDashboard,
  type ManagedReadOnlyPreview,
  type ManagedReadOnlyReceipt,
  type ManagedEvidenceDetail,
  type ManagedRunSummaryPage,
  type ManagedReviewPreview,
  type ManagedReviewTransition,
  type PortableAgentSettingValue,
  type PortableDesignSnapshotPage,
  type PortableDesignSnapshotSummary,
  type PhaseDashboardFramework,
  type ProductBinding,
} from "./protocol.js"

declare const __GAEP_PACKAGED_ENGINE_SHA256__: string

const productStudioViewType = "gaepKiro.productStudio"
const commandIds = {
  open: "gaepKiro.openProductStudio",
  readiness: "gaepKiro.agents.readiness",
  selectAgent: "gaepKiro.agents.select",
  handoffAgent: "gaepKiro.agents.handoff",
  managedReadOnly: "gaepKiro.runs.managedReadOnly",
  evidence: "gaepKiro.runs.evidence",
  stagedReview: "gaepKiro.runs.stagedReview",
  dashboard: "gaepKiro.dashboard.phase",
  changeImpact: "gaepKiro.dashboard.changeImpact",
  agentModel: "gaepKiro.dashboard.agentModel",
  accessibleTables: "gaepKiro.dashboard.accessibleTables",
  initiativeEntry: "gaepKiro.initiativeEntry.inspect",
  classifyInitiative: "gaepKiro.initiativeEntry.classify",
  resolveApplicability: "gaepKiro.initiativeEntry.resolveApplicability",
  sourceGovernance: "gaepKiro.sourceGovernance.inspect",
  businessUnderstanding: "gaepKiro.businessUnderstanding.inspect",
  businessCapabilityMap: "gaepKiro.businessCapabilityMap.inspect",
  valueStreamModel: "gaepKiro.valueStreamModel.inspect",
  operatingModel: "gaepKiro.operatingModel.inspect",
  businessRules: "gaepKiro.businessRules.inspect",
  businessArchitectureBaseline: "gaepKiro.businessArchitectureBaseline.inspect",
  systemSolutionArchitecture: "gaepKiro.systemSolutionArchitecture.inspect",
  boundedContextModel: "gaepKiro.boundedContextModel.inspect",
  securityPrivacyAssessment: "gaepKiro.securityPrivacyAssessment.inspect",
  processModel: "gaepKiro.processModel.inspect",
  dataModel: "gaepKiro.dataModel.inspect",
  authorizationModel: "gaepKiro.authorizationModel.inspect",
  eventIntegrationModel: "gaepKiro.eventIntegrationModel.inspect",
  failureRecoveryModel: "gaepKiro.failureRecoveryModel.inspect",
  architectureChallengeModel: "gaepKiro.architectureChallengeModel.inspect",
  import: "gaepKiro.portableDesign.import",
  list: "gaepKiro.portableDesign.list",
  read: "gaepKiro.portableDesign.read",
} as const

class WorkflowCancelled extends Error {}
class ConfigurationBoundaryError extends Error {}

interface ClientEntry {
  readonly signature: string
  readonly client: GaepEngineClient
}

class EngineClientPool implements vscode.Disposable {
  private readonly clients = new Map<string, ClientEntry>()

  constructor(private readonly extensionPath: string) {}

  async get(workspacePath: string): Promise<GaepEngineClient> {
    const executable = machineSetting("engineExecutable", "GAEP_ENGINE_EXECUTABLE", "").trim()
    const digest = machineSetting("engineSha256", "GAEP_ENGINE_SHA256", "")
    if (!executable && digest.trim()) {
      throw new ConfigurationBoundaryError(
        "gaepKiro.engineSha256 can pin only an explicitly configured external engine executable. Clear it to use the package-local digest-bound engine.",
      )
    }
    const packagedEnginePath = join(this.extensionPath, "dist", "gaep-engine.mjs")
    const signature = executable
      ? JSON.stringify(["external", executable, digest])
      : JSON.stringify(["packaged", process.execPath, packagedEnginePath, __GAEP_PACKAGED_ENGINE_SHA256__])
    const current = this.clients.get(workspacePath)
    if (current?.signature === signature) return current.client
    if (current) await current.client.dispose()
    const client = await GaepEngineClient.create(executable
      ? {
          workspacePath,
          engineExecutable: executable,
          ...(digest ? { expectedEngineSha256: digest } : {}),
        }
      : {
          workspacePath,
          engineExecutable: process.execPath,
          packagedEngine: {
            path: packagedEnginePath,
            expectedSha256: __GAEP_PACKAGED_ENGINE_SHA256__,
          },
        })
    this.clients.set(workspacePath, { signature, client })
    return client
  }

  async clear(): Promise<void> {
    const clients = [...this.clients.values()].map((entry) => entry.client)
    this.clients.clear()
    await Promise.all(clients.map((client) => client.dispose()))
  }

  dispose(): void {
    void this.clear()
  }
}

let studioPanel: vscode.WebviewPanel | undefined
let activePool: EngineClientPool | undefined

export function activate(context: vscode.ExtensionContext): void {
  const pool = new EngineClientPool(context.extensionPath)
  activePool = pool
  context.subscriptions.push(
    pool,
    vscode.window.registerWebviewPanelSerializer(productStudioViewType, {
      async deserializeWebviewPanel(panel): Promise<void> {
        configureProductStudioPanel(panel)
      },
    }),
    vscode.commands.registerCommand(commandIds.open, () => openProductStudio()),
    vscode.commands.registerCommand(commandIds.readiness, () => runUserCommand(() => showAgentReadiness(pool))),
    vscode.commands.registerCommand(commandIds.selectAgent, () => runUserCommand(() => selectAgent(pool))),
    vscode.commands.registerCommand(commandIds.handoffAgent, () => runUserCommand(() => handoffAgent(pool))),
    vscode.commands.registerCommand(commandIds.managedReadOnly, () => runUserCommand(() => runManagedReadOnly(pool))),
    vscode.commands.registerCommand(commandIds.evidence, () => runUserCommand(() => showManagedEvidenceDashboard(pool))),
    vscode.commands.registerCommand(commandIds.stagedReview, () => runUserCommand(() => reviewManagedStagedChanges(pool))),
    vscode.commands.registerCommand(commandIds.dashboard, () => runUserCommand(() => showPhaseDashboard(pool))),
    vscode.commands.registerCommand(commandIds.changeImpact, () => runUserCommand(() => showChangeImpactDashboard(pool))),
    vscode.commands.registerCommand(commandIds.agentModel, () => runUserCommand(() => showAgentModelDashboard(pool))),
    vscode.commands.registerCommand(commandIds.accessibleTables, () => runUserCommand(() => showAccessibleDashboardTables(pool))),
    vscode.commands.registerCommand(commandIds.initiativeEntry, (input?: unknown) => runUserCommand(() => showInitiativeEntry(pool, input))),
    vscode.commands.registerCommand(commandIds.classifyInitiative, (input?: unknown) => runUserCommand(() => classifyInitiative(pool, input))),
    vscode.commands.registerCommand(commandIds.resolveApplicability, (input?: unknown) => runUserCommand(() => resolveInitiativeApplicability(pool, input))),
    vscode.commands.registerCommand(commandIds.sourceGovernance, (input?: unknown) => runUserCommand(() => showSourceGovernance(pool, input))),
    vscode.commands.registerCommand(commandIds.businessUnderstanding, (input?: unknown) => runUserCommand(() => showBusinessUnderstanding(pool, input))),
    vscode.commands.registerCommand(commandIds.businessCapabilityMap, (input?: unknown) => runUserCommand(() => showBusinessCapabilityMap(pool, input))),
    vscode.commands.registerCommand(commandIds.valueStreamModel, (input?: unknown) => runUserCommand(() => showValueStreamModel(pool, input))),
    vscode.commands.registerCommand(commandIds.operatingModel, (input?: unknown) => runUserCommand(() => showOperatingModel(pool, input))),
    vscode.commands.registerCommand(commandIds.businessRules, (input?: unknown) => runUserCommand(() => showBusinessRuleCatalog(pool, input))),
    vscode.commands.registerCommand(commandIds.businessArchitectureBaseline, (input?: unknown) => runUserCommand(() => showBusinessArchitectureBaseline(pool, input))),
    vscode.commands.registerCommand(commandIds.systemSolutionArchitecture, (input?: unknown) => runUserCommand(() => showSystemSolutionArchitecture(pool, input))),
    vscode.commands.registerCommand(commandIds.boundedContextModel, (input?: unknown) => runUserCommand(() => showBoundedContextModel(pool, input))),
    vscode.commands.registerCommand(commandIds.securityPrivacyAssessment, (input?: unknown) => runUserCommand(() => showSecurityPrivacyAssessment(pool, input))),
    vscode.commands.registerCommand(commandIds.processModel, (input?: unknown) => runUserCommand(() => showProcessModel(pool, input))),
    vscode.commands.registerCommand(commandIds.dataModel, (input?: unknown) => runUserCommand(() => showDataModel(pool, input))),
    vscode.commands.registerCommand(commandIds.authorizationModel, (input?: unknown) => runUserCommand(() => showAuthorizationModel(pool, input))),
    vscode.commands.registerCommand(commandIds.eventIntegrationModel, (input?: unknown) => runUserCommand(() => showEventIntegrationModel(pool, input))),
    vscode.commands.registerCommand(commandIds.failureRecoveryModel, (input?: unknown) => runUserCommand(() => showFailureRecoveryModel(pool, input))),
    vscode.commands.registerCommand(commandIds.architectureChallengeModel, (input?: unknown) => runUserCommand(() => showArchitectureChallengeModel(pool, input))),
    vscode.commands.registerCommand(commandIds.import, () => runUserCommand(() => importPortableDesign(pool))),
    vscode.commands.registerCommand(commandIds.list, (input?: unknown) => runUserCommand(() => listPortableDesign(pool, input))),
    vscode.commands.registerCommand(commandIds.read, (input?: unknown) => runUserCommand(() => readPortableDesign(pool, input))),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("gaepKiro")) void pool.clear()
    }),
  )
}

export async function deactivate(): Promise<void> {
  const pool = activePool
  activePool = undefined
  studioPanel?.dispose()
  studioPanel = undefined
  await pool?.clear()
}

function openProductStudio(): void {
  if (studioPanel) {
    studioPanel.reveal(vscode.ViewColumn.Active)
    studioPanel.webview.html = productStudioHtml()
    return
  }
  const panel = vscode.window.createWebviewPanel(
    productStudioViewType,
    "GAEP for Kiro Product Studio",
    vscode.ViewColumn.Active,
    { enableScripts: false, retainContextWhenHidden: false },
  )
  configureProductStudioPanel(panel)
}

function configureProductStudioPanel(panel: vscode.WebviewPanel): void {
  studioPanel = panel
  panel.webview.options = { enableScripts: false, localResourceRoots: [] }
  panel.webview.html = productStudioHtml()
  panel.onDidDispose(() => {
    if (studioPanel === panel) studioPanel = undefined
  })
}

function productStudioHtml(): string {
  const styleNonce = randomBytes(18).toString("base64")
  const trustState = vscode.workspace.isTrusted
    ? "Trusted. Portable-design commands may start only the configured local GAEP engine."
    : "Untrusted stop line. No Product state is inspected and no process is started."
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${styleNonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GAEP for Kiro Product Studio</title>
  <style nonce="${styleNonce}">
    body { color: var(--vscode-foreground); background: var(--vscode-editor-background); font: var(--vscode-font-size)/1.55 var(--vscode-font-family); margin: 0 auto; max-width: 760px; padding: 32px; }
    h1, h2 { line-height: 1.2; } section { border: 1px solid var(--vscode-panel-border); border-radius: 6px; margin: 18px 0; padding: 16px; }
    code { color: var(--vscode-textPreformat-foreground); } .stop { color: var(--vscode-errorForeground); }
  </style>
</head>
<body>
  <h1>GAEP for Kiro Product Studio</h1>
  <p class="${vscode.workspace.isTrusted ? "" : "stop"}">${escapeHtml(trustState)}</p>
  <section>
    <h2>Initiative entry</h2>
    <p>Use the Kiro Command Palette to inspect one exact Initiative entry assessment by UUID, record a multi-dimensional human classification, or resolve an explicit applicability matrix.</p>
    <p>Every write rechecks the exact Initiative and current Product binding, is cancel-default, rejects secret-shaped input, and records no implicit not-applicable, approval, readiness, or action authority.</p>
  </section>
  <section>
    <h2>Portable design</h2>
    <p>Use the Kiro Command Palette to import one local bundle folder, list metadata pages, or read one exact snapshot by UUID.</p>
    <p>Files, archives, <code>.fig</code> ingestion, OAuth, network fetches, and live design-tool accounts are not supported.</p>
  </section>
  <section>
    <h2>Codex and Claude</h2>
    <p>Use the Kiro Command Palette to observe verified local readiness, record one guarded portable Agent Selection, or create a versioned switch handoff from the latest terminal Run.</p>
    <p>Selection and handoff records are configuration and history only. The separate managed read-only command can run one exact, already-confirmed Charter and Workflow Plan after a digest-bound human attestation. It denies every Tool, write, and non-observation effect, uses a bounded timeout, and withholds success if staged changes appear.</p>
    <p>The Managed Run evidence command shows an audit-gated, snapshot-bound page of at most 100 runs and one exact verified detail. It displays portable states, counts, digests and timestamps only; it cannot apply, discard, resume, approve, or infer success.</p>
    <p>The phase-dashboard command shows the exact Phase 0/1A slice plus required Change/Impact and Agent/Model views. The Change/Impact command separately selects one exact current Change from an audit-gated metadata-only catalog and shows bounded Work Items, portable changed/effect targets, trace assessments, Decisions, Risks, freshness and omissions. The Agent/Model command shows exact current capability, portable selection, Run, Managed evidence, handoff, freshness and unavailable usage/cost metadata. The accessible-tables command uses native keyboard and screen-reader controls to select one of those verified tables, apply deterministic sorting and a bounded visible-metadata filter, open a textual alternative, and optionally copy only the visible columns and rows as formula-neutralized CSV. Phase applicability remains attention-required until a governed decision exists; these projections cannot select or switch an agent, launch a Run, authorize effects, approve a Change, or complete a phase.</p>
    <p>The separate staged-review command can inspect one exact pending Codex inventory of at most 512 workspace-relative changed paths and then, only after a cancel-default digest-bound human decision, ask the engine to apply that inventory or persist discard. It receives no source bytes or general filesystem-write authority. Post-apply Workflow gates are recorded not assessed, so this surface cannot claim governed outcome satisfaction.</p>
  </section>
  <section>
    <h2>Governance boundary</h2>
    <p>Every result remains <code>pending-human-review</code>. An upstream <code>approved</code> value is not GAEP approval, a Design Baseline, implementation readiness, or release readiness.</p>
    <p>Only validated metadata and digests are shown. Local paths, source bytes, token values, credentials, and external-account state are withheld.</p>
  </section>
</body>
</html>`
}

function initiativeEntryUi(): InitiativeEntryWorkflowUi {
  return {
    pick: async <T extends string>(title: string, options: readonly T[]): Promise<T | undefined> => {
      const selected = await vscode.window.showQuickPick(
        options.map((value) => ({ label: value, value })),
        { title, ignoreFocusOut: true },
      )
      return selected?.value
    },
    pickMany: async <T extends string>(title: string, options: readonly T[], minimum = 0): Promise<T[] | undefined> => {
      const selected = await vscode.window.showQuickPick(
        options.map((value) => ({ label: value, value })),
        { title, ignoreFocusOut: true, canPickMany: true, placeHolder: minimum > 0 ? `Select at least ${minimum}` : "Optional" },
      )
      if (!selected) return undefined
      if (selected.length < minimum) throw new TypeError(`${title} requires at least ${minimum} selection${minimum === 1 ? "" : "s"}`)
      return selected.map((entry) => entry.value)
    },
    input: async (prompt, options = {}) => vscode.window.showInputBox({
      prompt,
      ignoreFocusOut: true,
      ...(options.value !== undefined ? { value: options.value } : {}),
      ...(options.secret !== undefined ? { password: options.secret } : {}),
      validateInput: (value) => validatePortableInput(value.trim(), options.required !== false, prompt),
    }),
    confirm: async (message, acceptLabel) => (await vscode.window.showWarningMessage(
      message,
      { modal: true },
      acceptLabel,
    )) === acceptLabel,
  }
}

function initiativeInput(input: unknown): { initiativeId?: string; expectedRevision?: number } {
  if (input === undefined) return {}
  if (typeof input === "string") return { initiativeId: normalizeUuid(input, "Initiative ID") }
  if (!isRecord(input) || Object.keys(input).some((key) => key !== "initiativeId" && key !== "expectedRevision")) {
    throw new TypeError("Initiative entry input accepts only initiativeId and expectedRevision")
  }
  const initiativeId = typeof input.initiativeId === "string"
    ? normalizeUuid(input.initiativeId, "Initiative ID")
    : undefined
  const expectedRevision = input.expectedRevision === undefined
    ? undefined
    : validatePageRevision(input.expectedRevision, "Expected Initiative revision")
  return { ...(initiativeId ? { initiativeId } : {}), ...(expectedRevision ? { expectedRevision } : {}) }
}

function validatePageRevision(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new TypeError(`${label} must be a positive integer`)
  return value as number
}

async function readInitiativeEntryContext(
  pool: EngineClientPool,
  input: unknown,
): Promise<{
  folder: vscode.WorkspaceFolder
  client: GaepEngineClient
  initiative: Initiative
  assessment: InitiativeEntryAssessment
}> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  let initiativeId = normalized.initiativeId
  if (!initiativeId) {
    const value = await vscode.window.showInputBox({
      title: "Inspect one exact Initiative entry",
      prompt: "Initiative UUID",
      ignoreFocusOut: true,
      validateInput: (candidate) => {
        try { normalizeUuid(candidate, "Initiative ID"); return undefined } catch { return "Enter an exact Initiative UUID" }
      },
    })
    if (value === undefined) throw new WorkflowCancelled()
    initiativeId = normalizeUuid(value, "Initiative ID")
  }
  const [initiative, assessment] = await Promise.all([
    client.readInitiative(initiativeId),
    client.assessInitiativeEntry(initiativeId),
  ])
  if (assessment.initiativeRevision !== (initiative.revision ?? 1)) {
    throw new ConfigurationBoundaryError("The Initiative changed while its entry assessment was read. Refresh the exact record.")
  }
  if (normalized.expectedRevision !== undefined && normalized.expectedRevision !== (initiative.revision ?? 1)) {
    throw new ConfigurationBoundaryError("The Initiative changed since this entry action was offered. Refresh the exact revision.")
  }
  return { folder, client, initiative, assessment }
}

async function showInitiativeEntry(pool: EngineClientPool, input: unknown): Promise<InitiativeEntryAssessment> {
  const context = await readInitiativeEntryContext(pool, input)
  await showInitiativeEntryDocument(context.initiative, context.assessment)
  return context.assessment
}

async function classifyInitiative(pool: EngineClientPool, input: unknown): Promise<InitiativeEntryAssessment> {
  const context = await readInitiativeEntryContext(pool, input)
  if (["completed", "cancelled"].includes(context.initiative.state)) {
    throw new ConfigurationBoundaryError(`Terminal Initiative ${context.initiative.state} entry records are immutable.`)
  }
  const classification = await collectInitiativeClassification(initiativeEntryUi())
  if (containsSecretShapedValue(classification)) {
    throw new ConfigurationBoundaryError("The Initiative classification contains a secret-shaped value and was not persisted.")
  }
  const actorId = normalizeActorId(machineSetting("actorId", undefined, "gaep.kiro-local-human"))
  const updated = await context.client.classifyInitiative(
    context.initiative.id,
    context.initiative.revision ?? 1,
    classification,
    actorId,
  )
  const assessment = await context.client.assessInitiativeEntry(updated.id)
  if (assessment.initiativeRevision !== updated.revision) throw new ConfigurationBoundaryError("The classified Initiative could not be revalidated.")
  await showInitiativeEntryDocument(updated, assessment)
  return assessment
}

async function resolveInitiativeApplicability(pool: EngineClientPool, input: unknown): Promise<InitiativeEntryAssessment> {
  const context = await readInitiativeEntryContext(pool, input)
  if (["completed", "cancelled"].includes(context.initiative.state)) {
    throw new ConfigurationBoundaryError(`Terminal Initiative ${context.initiative.state} entry records are immutable.`)
  }
  if (context.assessment.classification.status !== "current") {
    throw new ConfigurationBoundaryError("Record a classification bound to the current Product revision before resolving applicability.")
  }
  const actorId = normalizeActorId(machineSetting("actorId", undefined, "gaep.kiro-local-human"))
  const applicability = await collectInitiativeApplicability(initiativeEntryUi(), actorId)
  if (containsSecretShapedValue(applicability)) {
    throw new ConfigurationBoundaryError("The Initiative applicability matrix contains a secret-shaped value and was not persisted.")
  }
  const coverage = context.assessment.applicability.coverage
  if (!coverage?.catalogVersion || !coverage.catalogDigest || coverage.subjectCount < 1) {
    throw new ConfigurationBoundaryError("The canonical applicability subject catalog is unavailable. Refresh the exact entry assessment.")
  }
  const updated = await context.client.resolveInitiativeApplicability(
    context.initiative.id,
    context.initiative.revision ?? 1,
    {
      ...applicability,
      subjectCatalog: {
        catalogVersion: coverage.catalogVersion,
        digest: coverage.catalogDigest,
        subjectCount: coverage.subjectCount,
      },
    },
    actorId,
  )
  const assessment = await context.client.assessInitiativeEntry(updated.id)
  if (assessment.initiativeRevision !== updated.revision) throw new ConfigurationBoundaryError("The resolved Initiative could not be revalidated.")
  await showInitiativeEntryDocument(updated, assessment)
  return assessment
}

async function showInitiativeEntryDocument(
  initiative: Initiative,
  assessment: InitiativeEntryAssessment,
): Promise<void> {
  const lines = [
    "GAEP Initiative entry assessment",
    "",
    `Initiative ID: ${initiative.id}`,
    `Initiative revision: ${initiative.revision ?? 1}`,
    `Lifecycle state: ${initiative.state}`,
    `Classification: ${assessment.classification.status}${initiative.classification ? ` · ${initiative.classification.primaryType} / ${initiative.classification.productProfile}` : ""}`,
    `Classification completeness: ${assessment.classification.completeness?.status ?? "unreported"}`,
    `Completeness policy: ${assessment.classification.completeness?.policyVersion ?? "unreported"}`,
    `Classification unknown dimensions: ${assessment.classification.completeness?.unknownDimensionCount ?? "unreported"}`,
    `Classification unresolved questions: ${assessment.classification.completeness?.unresolvedQuestionCount ?? "unreported"}`,
    `Classification missing conditional dimensions: ${assessment.classification.completeness?.missingConditionalDimensionCount ?? "unreported"}`,
    `Classification confidence sufficient: ${assessment.classification.completeness?.confidenceSufficient ?? "unreported"}`,
    `Applicability: ${assessment.applicability.status} · matrix revision ${assessment.applicability.matrixRevision ?? "not recorded"}`,
    `Applicability coverage: ${assessment.applicability.coverage?.status ?? "unreported"}`,
    `Canonical subject coverage: ${assessment.applicability.coverage ? `${assessment.applicability.coverage.coveredSubjectCount}/${assessment.applicability.coverage.subjectCount}` : "unreported"}`,
    `Coverage gaps: ${assessment.applicability.coverage ? `${assessment.applicability.coverage.missingSubjectCount} missing · ${assessment.applicability.coverage.unexpectedSubjectCount} unexpected · ${assessment.applicability.coverage.mismatchedSubjectCount} mismatched` : "unreported"}`,
    `Decisions: ${assessment.applicability.decisionCount}`,
    `Unresolved subjects: ${assessment.applicability.unresolvedSubjectCount}`,
    `Awaiting human decisions: ${assessment.applicability.pendingHumanDecisionCount}`,
    `Blocked decisions: ${assessment.applicability.blockedDecisionCount}`,
    `Pending approvals: ${assessment.applicability.pendingApprovalCount}`,
    `Rejected approvals: ${assessment.applicability.rejectedApprovalCount}`,
    `Assessment: ${assessment.state}`,
    ...assessment.reasons.map((reason) => `  - ${reason}`),
    "",
    "Boundary: entry assessment is read-only and grants no approval, readiness, not-applicable inference, or action authority.",
    "Product and Initiative narrative, evidence content, owners, local paths, credentials, and raw engine output are withheld from this compact view.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
}

async function showSourceGovernance(
  pool: EngineClientPool,
  input: unknown,
): Promise<SourceGovernanceProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Source governance", "Initiative ID")
  const projection = await client.readSourceGovernance(initiativeId)
  const renderLimit = 50
  const lines = [
    "GAEP Source governance",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${projection.assessment.state}`,
    `Sources: ${projection.assessment.sourceCount}`,
    `Candidate Baselines: ${projection.assessment.baselineCount}`,
    `Provenance records: ${projection.assessment.provenanceCount}`,
    `Current candidate Baseline: ${projection.assessment.currentBaseline
      ? `${projection.assessment.currentBaseline.id}@${projection.assessment.currentBaseline.revision} · ${projection.assessment.currentBaseline.status}`
      : "not recorded"}`,
    `Source gaps: ${projection.assessment.staleSourceCount} stale · ${projection.assessment.unknownAuthorityCount} unknown authority · ${projection.assessment.unbaselinedSourceCount} unbaselined · ${projection.assessment.unprovenancedSourceCount} unprovenanced`,
    ...projection.assessment.reasons.map((reason) => `  - ${reason}`),
    "",
    `Source records (showing ${Math.min(projection.sources.length, renderLimit)} of ${projection.limits.sources.total})`,
    ...projection.sources.slice(0, renderLimit).map((source) =>
      `  - ${source.title} · ${source.id}@${source.revision} · owner ${source.owner.kind}:${source.owner.id ?? "unassigned"} · authority ${source.semanticAuthority.standing} · ${source.knowledgeDisposition} · ${source.freshness}/${source.availability}`),
    "",
    `Candidate Baselines (showing ${Math.min(projection.baselines.length, renderLimit)} of ${projection.limits.baselines.total})`,
    ...projection.baselines.slice(0, renderLimit).map((baseline) =>
      `  - ${baseline.title} · ${baseline.id}@${baseline.revision} · ${baseline.memberCount} member(s) · ${baseline.assessmentStatus}`),
    "",
    `Provenance (showing ${Math.min(projection.provenance.length, renderLimit)} of ${projection.limits.provenance.total})`,
    ...projection.provenance.slice(0, renderLimit).map((record) =>
      `  - ${record.id} · ${record.targetKind} · ${record.disposition} · ${record.sourceCount} source(s) · ${record.transformationCount} transformation(s)`),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showBusinessUnderstanding(
  pool: EngineClientPool,
  input: unknown,
): Promise<BusinessUnderstandingProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Business Understanding", "Initiative ID")
  const projection = await client.readBusinessUnderstanding(initiativeId)
  const business = projection.businessUnderstanding
  const stakeholders = projection.stakeholderModel
  const outcomes = projection.outcomeModel
  const lines = [
    "GAEP governed Business Understanding",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${projection.assessment.state}`,
    `Assessment counts: ${projection.assessment.unresolvedQuestionCount} unresolved questions · ${projection.assessment.blockingQuestionCount} blocking questions · ${projection.assessment.staleBindingCount} stale bindings · ${projection.assessment.staleSourceReferenceCount} stale Source references`,
    ...projection.assessment.reasons.map((reason) => `  - ${reason}`),
    "",
    `Business Understanding: ${business
      ? `${business.id}@${business.revision} · ${business.state} · ${business.digest}`
      : "not recorded"}`,
    ...(business ? [
      `Business counts: ${business.objectiveCount} objectives · ${business.constraintCount} constraints · ${business.assumptionCount} assumptions · ${business.unresolvedQuestionCount} unresolved questions · ${business.glossaryTermCount} glossary terms`,
    ] : []),
    "",
    `Stakeholder Model: ${stakeholders
      ? `${stakeholders.id}@${stakeholders.revision} · ${stakeholders.state} · ${stakeholders.digest}`
      : "not recorded"}`,
    ...(stakeholders ? [
      `Stakeholder counts: ${stakeholders.stakeholderCount} stakeholders · ${stakeholders.representedCategoryCount} represented categories · ${stakeholders.unresolvedCategoryCount} unresolved categories · ${stakeholders.verifiedAuthorityCount} verified authority claims`,
    ] : []),
    "",
    `Outcome Model: ${outcomes
      ? `${outcomes.id}@${outcomes.revision} · ${outcomes.state} · ${outcomes.digest}`
      : "not recorded"}`,
    ...(outcomes ? [
      `Outcome counts: ${outcomes.outcomeCount} outcomes · ${outcomes.measureCount} measures · ${outcomes.countermetricCount} countermetrics · ${outcomes.burdenMeasureCount} burden measures · ${outcomes.observedBaselineCount} observed baselines`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showBusinessCapabilityMap(
  pool: EngineClientPool,
  input: unknown,
): Promise<BusinessCapabilityMapProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Business Capability Map", "Initiative ID")
  const projection = await client.readBusinessCapabilityMap(initiativeId)
  const map = projection.capabilityMap
  const lines = [
    "GAEP governed Business Capability Map",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${projection.assessment.state}`,
    `Assessment counts: ${projection.assessment.capabilityCount} capabilities · ${projection.assessment.ownedCapabilityCount} owned · ${projection.assessment.unownedCapabilityCount} unowned · ${projection.assessment.objectiveCoverageCount} objectives covered · ${projection.assessment.outcomeCoverageCount} outcomes covered`,
    `Gaps and uncertainty: ${projection.assessment.openGapCount} open gaps · ${projection.assessment.criticalGapCount} critical gaps · ${projection.assessment.unknownCurrentMaturityCount} unknown current maturity · ${projection.assessment.unassessedPriorityCount} unassessed priority · ${projection.assessment.staleBindingCount} stale bindings · ${projection.assessment.staleSourceReferenceCount} stale Source references`,
    ...projection.assessment.reasons.map((reason) => `  - ${reason}`),
    "",
    `Business Capability Map: ${map
      ? `${map.id}@${map.revision} · ${map.state} · ${map.digest}`
      : "not recorded"}`,
    ...(map ? [
      `Map counts: ${map.capabilityCount} capabilities · ${map.ownedCapabilityCount} owned · ${map.openGapCount} open gaps · ${map.criticalGapCount} critical gaps · ${map.candidatePriorityCount} candidate priorities`,
      `Updated: ${map.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showValueStreamModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<ValueStreamModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Value Stream Model", "Initiative ID")
  const projection = await client.readValueStreamModel(initiativeId)
  const model = projection.valueStreamModel
  const lines = [
    "GAEP governed Value Stream Model",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${projection.assessment.state}`,
    `Assessment counts: ${projection.assessment.valueStreamCount} value streams · ${projection.assessment.ownedValueStreamCount} owned · ${projection.assessment.unownedValueStreamCount} unowned · ${projection.assessment.stageCount} stages · ${projection.assessment.dependencyCount} dependencies · ${projection.assessment.capabilityCoverageCount} capabilities covered · ${projection.assessment.outcomeCoverageCount} outcomes covered`,
    `Flow gaps: ${projection.assessment.absentFlowEvidenceCount} stages without evidence · ${projection.assessment.openBottleneckCount} open bottlenecks · ${projection.assessment.criticalBottleneckCount} critical bottlenecks · ${projection.assessment.staleBindingCount} stale bindings · ${projection.assessment.staleSourceReferenceCount} stale Source references`,
    ...projection.assessment.reasons.map((reason) => `  - ${reason}`),
    "",
    `Value Stream Model: ${model
      ? `${model.id}@${model.revision} · ${model.state} · ${model.digest}`
      : "not recorded"}`,
    ...(model ? [
      `Model counts: ${model.valueStreamCount} value streams · ${model.ownedValueStreamCount} owned · ${model.stageCount} stages · ${model.dependencyCount} dependencies · ${model.openBottleneckCount} open bottlenecks · ${model.criticalBottleneckCount} critical bottlenecks`,
      `Updated: ${model.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showOperatingModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<OperatingModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Operating Model", "Initiative ID")
  const projection = await client.readOperatingModel(initiativeId)
  const model = projection.operatingModel
  const lines = [
    "GAEP governed Operating Model",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${projection.assessment.state}`,
    `Structural counts: ${projection.assessment.roleCount} roles · ${projection.assessment.governanceSystemCount} governance systems · ${projection.assessment.decisionRightCount} decision rights · ${projection.assessment.forumCount} forums · ${projection.assessment.cycleCount} cycles`,
    `Candidate gaps: ${projection.assessment.unassignedAppointingAuthorityCount} appointing authorities · ${projection.assessment.insufficientCapacityCount} capacity · ${projection.assessment.unfundedCapacityCount} funding · ${projection.assessment.unassignedDecisionAuthorityCount} decision authorities · ${projection.assessment.supportCapacityGapCount} support capacity · ${projection.assessment.emergencyAuthorityGapCount} emergency authority · ${projection.assessment.staleBindingCount} stale bindings · ${projection.assessment.staleSourceReferenceCount} stale Source references`,
    ...projection.assessment.reasons.map((reason) => `  - ${reason}`),
    "",
    `Operating Model: ${model ? `${model.id}@${model.revision} · ${model.state} · ${model.digest}` : "not recorded"}`,
    ...(model ? [
      `Model counts: ${model.roleCount} roles · ${model.decisionRightCount} decision rights · ${model.forumCount} forums · ${model.cycleCount} cycles`,
      `Updated: ${model.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showBusinessRuleCatalog(
  pool: EngineClientPool,
  input: unknown,
): Promise<BusinessRuleCatalogProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Business Rule Catalog", "Initiative ID")
  const projection = await client.readBusinessRuleCatalog(initiativeId)
  const catalog = projection.businessRuleCatalog
  const lines = [
    "GAEP governed Business Rule Catalog",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${projection.assessment.state}`,
    `Rule counts: ${projection.assessment.ruleCount} rules · ${projection.assessment.sourceBackedRuleCount} source-backed · ${projection.assessment.nonExceptionableRuleCount} non-exceptionable · ${projection.assessment.enforcementTargetCount} enforcement targets · ${projection.assessment.exceptionCount} exceptions`,
    `Candidate gaps: ${projection.assessment.unassignedEnforcementTargetCount} unassigned targets · ${projection.assessment.unverifiedEnforcementTargetCount} unverified targets · ${projection.assessment.unassignedExceptionAuthorityCount} unassigned exception authorities · ${projection.assessment.staleBindingCount} stale bindings · ${projection.assessment.staleSourceReferenceCount} stale Source references`,
    ...projection.assessment.reasons.map((reason) => `  - ${reason}`),
    "",
    `Business Rule Catalog: ${catalog ? `${catalog.id}@${catalog.revision} · ${catalog.state} · ${catalog.digest}` : "not recorded"}`,
    ...(catalog ? [
      `Catalog counts: ${catalog.ruleCount} rules · ${catalog.enforcementTargetCount} enforcement targets · ${catalog.exceptionCount} exceptions · ${catalog.nonExceptionableRuleCount} non-exceptionable`,
      `Updated: ${catalog.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showBusinessArchitectureBaseline(
  pool: EngineClientPool,
  input: unknown,
): Promise<BusinessArchitectureBaselineProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Business Architecture Baseline candidate", "Initiative ID")
  const projection = await client.readBusinessArchitectureBaseline(initiativeId)
  const baseline = projection.baseline
  const lines = [
    "GAEP governed Business Architecture Baseline candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${projection.assessment.state}`,
    `Coverage counts: ${projection.assessment.coveredElementCount} covered · ${projection.assessment.includedElementCount} included · ${projection.assessment.excludedElementCount} excluded · ${projection.assessment.unresolvedElementCount} unresolved`,
    `Coherence: ${projection.assessment.integrationClaimCount} integration claims · ${projection.assessment.consistencyCheckCount} consistency checks · ${projection.assessment.consistencyGapCount} gaps · ${projection.assessment.staleBindingCount} stale bindings · ${projection.assessment.staleSourceReferenceCount} stale Source references`,
    ...projection.assessment.reasons.map((reason) => `  - ${reason}`),
    "",
    `Baseline candidate: ${baseline ? `${baseline.id}@${baseline.revision} · ${baseline.state} · ${baseline.digest}` : "not recorded"}`,
    ...(baseline ? [
      `Membership digest: ${baseline.membershipDigest}`,
      `Candidate counts: ${baseline.coveredElementCount} elements · ${baseline.integrationClaimCount} integration claims · ${baseline.consistencyGapCount} consistency gaps`,
      `Updated: ${baseline.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showSystemSolutionArchitecture(
  pool: EngineClientPool,
  input: unknown,
): Promise<SystemSolutionArchitectureProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the System/Solution Architecture candidate", "Initiative ID")
  const projection = await client.readSystemSolutionArchitecture(initiativeId)
  const architecture = projection.architecture
  const lines = [
    "GAEP governed System/Solution Architecture candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${projection.assessment.state}`,
    `Coverage: ${projection.assessment.concernCount} concerns · ${projection.assessment.viewCount} views · ${projection.assessment.elementCount} elements · ${projection.assessment.relationCount} relations · ${projection.assessment.qualityAttributeCount} quality scenarios · ${projection.assessment.decisionCount} decisions · ${projection.assessment.conformanceCriterionCount} conformance criteria`,
    `Candidate gaps: ${projection.assessment.unresolvedQualityAttributeCount} quality scenarios · ${projection.assessment.unresolvedDecisionCount} decisions · ${projection.assessment.unresolvedConformanceCriterionCount} conformance criteria · ${projection.assessment.lifecycleGapCount} lifecycle consequences · ${projection.assessment.inconsistencyCount} inconsistencies · ${projection.assessment.unresolvedQuestionCount} questions · ${projection.assessment.staleBindingCount} stale bindings · ${projection.assessment.staleSourceReferenceCount} stale Source references`,
    ...projection.assessment.reasons.map((reason) => `  - ${reason}`),
    "",
    `Architecture candidate: ${architecture ? `${architecture.id}@${architecture.revision} · ${architecture.state} · ${architecture.digest}` : "not recorded"}`,
    ...(architecture ? [
      `Membership digest: ${architecture.membershipDigest}`,
      `Candidate counts: ${architecture.concernCount} concerns · ${architecture.viewCount} views · ${architecture.elementCount} elements · ${architecture.qualityAttributeCount} quality scenarios · ${architecture.decisionCount} decisions`,
      `Updated: ${architecture.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showBoundedContextModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<BoundedContextModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Bounded Context and Ownership candidate", "Initiative ID")
  const projection = await client.readBoundedContextModel(initiativeId)
  const model = projection.model
  const lines = [
    "GAEP governed Bounded Context and Ownership candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${projection.assessment.state}`,
    `Coverage: ${projection.assessment.boundedContextCount} contexts · ${projection.assessment.coreContextCount} core contexts · ${projection.assessment.languageTermCount} language terms · ${projection.assessment.contractCount} contracts · ${projection.assessment.relationshipCount} relationships`,
    `Candidate gaps: ${projection.assessment.unresolvedContractCount} contracts · ${projection.assessment.unresolvedRelationshipCount} relationships · ${projection.assessment.unassignedArchitectureElementCount} unassigned elements · ${projection.assessment.unownedDataAssetCount} unowned data assets · ${projection.assessment.unmappedCrossContextRelationCount} unmapped relations · ${projection.assessment.inconsistencyCount} inconsistencies · ${projection.assessment.unresolvedQuestionCount} questions · ${projection.assessment.staleBindingCount} stale bindings · ${projection.assessment.staleSourceReferenceCount} stale Source references`,
    ...projection.assessment.reasons.map((reason) => `  - ${reason}`),
    "",
    `Boundary candidate: ${model ? `${model.id}@${model.revision} · ${model.state} · ${model.digest}` : "not recorded"}`,
    ...(model ? [
      `Membership digest: ${model.membershipDigest}`,
      `Candidate counts: ${model.boundedContextCount} contexts · ${model.contractCount} contracts · ${model.relationshipCount} relationships`,
      `Updated: ${model.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showSecurityPrivacyAssessment(
  pool: EngineClientPool,
  input: unknown,
): Promise<SecurityPrivacyAssessmentProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Security, Privacy, and Threat Assessment candidate", "Initiative ID")
  const projection = await client.readSecurityPrivacyAssessment(initiativeId)
  const assessment = projection.status
  const record = projection.assessment
  const lines = [
    "GAEP governed Security, Privacy, and Threat Assessment candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${assessment.state}`,
    `Coverage: ${assessment.assetCount} assets · ${assessment.actorCount} actors · ${assessment.trustBoundaryCount} trust boundaries · ${assessment.dataClassCount} data classes · ${assessment.dataFlowCount} data flows · ${assessment.controlCount} controls · ${assessment.threatCount} threats`,
    `Candidate gaps: ${assessment.unresolvedThreatCount} threats · ${assessment.unverifiedControlCount} controls · ${assessment.unresolvedProcessingAuthorityCount} processing authorities · ${assessment.uncoveredArchitectureElementCount} architecture elements · ${assessment.unmappedArchitectureRelationCount} architecture relations · ${assessment.unresolvedRequirementCount} profile requirements · ${assessment.inconsistencyCount} inconsistencies · ${assessment.unresolvedQuestionCount} questions · ${assessment.staleBindingCount} stale bindings · ${assessment.staleSourceReferenceCount} stale Source references`,
    ...assessment.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate counts: ${record.assetCount} assets · ${record.trustBoundaryCount} trust boundaries · ${record.dataClassCount} data classes · ${record.controlCount} controls · ${record.threatCount} threats`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showProcessModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<ProcessModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Process Model candidate", "Initiative ID")
  const projection = await client.readProcessModel(initiativeId)
  const status = projection.status
  const record = projection.model
  const lines = [
    "GAEP governed Process Model candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${status.state}`,
    `Coverage: ${status.processCount} processes · ${status.stepCount} steps · ${status.stateDimensionCount} state dimensions · ${status.stateValueCount} state values · ${status.transitionCount} transitions · ${status.eventDefinitionCount} events · ${status.approvalRequirementCount} approval requirements`,
    `Candidate gaps: ${status.uncoveredValueStreamCount} value streams · ${status.uncoveredBoundedContextCount} bounded contexts · ${status.uncoveredBusinessRuleCount} business rules · ${status.unresolvedRequirementCount} requirements · ${status.inconsistencyCount} inconsistencies · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate counts: ${record.processCount} processes · ${record.transitionCount} transitions · ${record.approvalRequirementCount} approval requirements`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showDataModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<DataModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Data Model candidate", "Initiative ID")
  const projection = await client.readDataModel(initiativeId)
  const status = projection.status
  const record = projection.model
  const lines = [
    "GAEP governed Data Model candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${status.state}`,
    `Coverage: ${status.entityCount} entities · ${status.attributeCount} attributes · ${status.relationshipCount} relationships · ${status.lifecycleCount} lifecycles · ${status.transformationCount} transformations`,
    `Candidate gaps: ${status.uncoveredBoundedContextCount} bounded contexts · ${status.uncoveredSecurityDataClassCount} security data classes · ${status.uncoveredProcessCount} processes · ${status.unresolvedSystemOfRecordCount} systems of record · ${status.unresolvedTransformationCount} transformations · ${status.unresolvedRequirementCount} requirements · ${status.inconsistencyCount} inconsistencies · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate counts: ${record.entityCount} entities · ${record.relationshipCount} relationships · ${record.lifecycleCount} lifecycles`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showAuthorizationModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<AuthorizationModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Authorization Model candidate", "Initiative ID")
  const projection = await client.readAuthorizationModel(initiativeId)
  const status = projection.status
  const record = projection.model
  const lines = [
    "GAEP governed Authorization Model candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${status.state}`,
    `Coverage: ${status.principalCount} principals · ${status.roleAssignmentCount} role assignments · ${status.resourceCount} resources · ${status.actionCount} actions · ${status.approvalBindingCount} approval bindings · ${status.ruleCount} rules`,
    `Candidate gaps: ${status.uncoveredOperatingRoleCount} operating roles · ${status.uncoveredProcessCount} processes · ${status.uncoveredDataEntityCount} data entities · ${status.unresolvedIdentityCount} identities · ${status.unresolvedRuleCount} rules · ${status.unresolvedRequirementCount} requirements · ${status.inconsistencyCount} inconsistencies · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate counts: ${record.principalCount} principals · ${record.actionCount} actions · ${record.ruleCount} rules`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showEventIntegrationModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<EventIntegrationModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Event and Integration Model candidate", "Initiative ID")
  const projection = await client.readEventIntegrationModel(initiativeId)
  const status = projection.status
  const record = projection.model
  const lines = [
    "GAEP governed Event and Integration Model candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${status.state}`,
    `Coverage: ${status.eventTypeCount} event types · ${status.commandCount} commands · ${status.adapterCount} adapters · ${status.externalContractCount} external contracts · ${status.mappingCount} mappings · ${status.routeCount} routes`,
    `Candidate gaps: ${status.uncoveredProcessEventCount} process events · ${status.uncoveredProcessCount} processes · ${status.uncoveredBoundedContextCount} bounded contexts · ${status.uncoveredDataEntityCount} data entities · ${status.uncoveredAuthorizationActionCount} authorization actions · ${status.unknownMappingTruthCount} mapping truths · ${status.unresolvedRequirementCount} requirements · ${status.inconsistencyCount} inconsistencies · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate counts: ${record.eventTypeCount} event types · ${record.commandCount} commands · ${record.adapterCount} adapters · ${record.externalContractCount} external contracts · ${record.mappingCount} mappings · ${record.routeCount} routes`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showFailureRecoveryModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<FailureRecoveryModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Failure and Recovery Model candidate", "Initiative ID")
  const projection = await client.readFailureRecoveryModel(initiativeId)
  const status = projection.status
  const record = projection.model
  const lines = [
    "GAEP governed Failure and Recovery Model candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${status.state}`,
    `Coverage: ${status.failureModeCount} failure modes · ${status.retryPolicyCount} retry policies · ${status.compensationPlanCount} compensation plans · ${status.recoveryPlanCount} recovery plans · ${status.recoveryEvidenceDefinitionCount} recovery evidence definitions`,
    `Candidate gaps: ${status.uncoveredProcessCount} processes · ${status.uncoveredCommandCount} commands · ${status.uncoveredRouteCount} routes · ${status.uncoveredAuthorizationActionCount} authorization actions · ${status.unresolvedRecoveryEvidenceCount} recovery evidence definitions · ${status.unresolvedRequirementCount} requirements · ${status.inconsistencyCount} inconsistencies · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate counts: ${record.failureModeCount} failure modes · ${record.retryPolicyCount} retry policies · ${record.compensationPlanCount} compensation plans · ${record.recoveryPlanCount} recovery plans · ${record.recoveryEvidenceDefinitionCount} recovery evidence definitions`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showArchitectureChallengeModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<ArchitectureChallengeModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Architecture Challenge candidate", "Initiative ID")
  const projection = await client.readArchitectureChallengeModel(initiativeId)
  const status = projection.status
  const record = projection.model
  const lines = [
    "GAEP governed Architecture Challenge candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${status.state}`,
    `Coverage: ${status.challengeSubjectCount} challenge subjects · ${status.assumptionCount} assumptions · ${status.alternativeCount} alternatives · ${status.findingCount} findings · ${status.responseCount} responses`,
    `Candidate gaps: ${status.unrespondedFindingCount} unresponded findings · ${status.unresolvedAssumptionCount} unresolved assumptions · ${status.unresolvedRequirementCount} requirements · ${status.inconsistencyCount} inconsistencies · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate counts: ${record.challengeSubjectCount} challenge subjects · ${record.assumptionCount} assumptions · ${record.alternativeCount} alternatives · ${record.findingCount} findings · ${record.responseCount} responses`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function importPortableDesign(pool: EngineClientPool): Promise<PortableDesignSnapshotSummary> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const actorId = normalizeActorId(machineSetting("actorId", undefined, "gaep.kiro-local-human"))
  const client = await pool.get(folder.uri.fsPath)
  const initial = await client.readProduct()

  const selected = await vscode.window.showOpenDialog({
    title: "Select one local portable design bundle folder",
    openLabel: "Select Local Bundle Folder",
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
  })
  const source = selected?.[0]
  if (!source) throw new WorkflowCancelled()
  if (source.scheme !== "file") {
    throw new ConfigurationBoundaryError(
      "Select one existing local folder. Files, archives, remote URLs, external accounts, and live design-tool connections are not supported.",
    )
  }
  const bundleRoot = await normalizeExistingLocalFolder(source.fsPath)
  await assertExactContext(folder, client, initial)
  const confirmation = await vscode.window.showWarningMessage(
    `Import one local bundle into ${initial.name} at exact Product revision ${initial.revision}? Only validated metadata and digests are retained, and the result remains pending human review even when upstream sourceReview says approved.`,
    { modal: true },
    "Import as Pending Review",
  )
  if (confirmation !== "Import as Pending Review") throw new WorkflowCancelled()
  await assertExactContext(folder, client, initial)
  const snapshot = await client.importPortableDesignSnapshot({
    bundleRoot,
    expectedProductId: initial.id,
    expectedProductRevision: initial.revision,
    actorId,
  })
  await vscode.window.showInformationMessage(importAnnouncement(snapshot))
  return snapshot
}

async function listPortableDesign(pool: EngineClientPool, input: unknown): Promise<PortableDesignSnapshotPage> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  if (input !== undefined && !isRecord(input)) throw new TypeError("Portable-design list input must be an object")
  const record = isRecord(input) ? input : {}
  if (Object.keys(record).some((key) => key !== "offset" && key !== "limit")) {
    throw new TypeError("Portable-design list input accepts only offset and limit")
  }
  if ((Object.hasOwn(record, "offset") && typeof record.offset !== "number") ||
    (Object.hasOwn(record, "limit") && typeof record.limit !== "number")) {
    throw new TypeError("Portable-design offset and limit must be integers")
  }
  const offset = typeof record.offset === "number" ? record.offset : 0
  const limit = typeof record.limit === "number" ? record.limit : 50
  validatePage(offset, limit)
  const page = await (await pool.get(folder.uri.fsPath)).listPortableDesignSnapshots(offset, limit)
  if (page.items.length === 0) {
    await vscode.window.showInformationMessage(`No portable-design snapshots were found on metadata page ${offset}–${offset + limit - 1}.`)
    return page
  }
  const selected = await vscode.window.showQuickPick(
    page.items.map((summary) => ({
      label: summary.title,
      description: `${summary.classification} · ${summary.governance.state}`,
      detail: `${summary.bundleId} · upstream ${summary.sourceReview.status} claim`,
      summary,
    })),
    {
      title: `Portable-design metadata (${page.items.length} of ${page.total})`,
      placeHolder: "Select one metadata-only snapshot to inspect; dismiss to keep the list unchanged",
      ignoreFocusOut: true,
    },
  )
  if (selected) await showSnapshotDocument(selected.summary)
  return page
}

async function readPortableDesign(pool: EngineClientPool, input: unknown): Promise<PortableDesignSnapshotSummary> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  if (input !== undefined && typeof input !== "string" && !isRecord(input)) {
    throw new TypeError("Portable-design read input must be a bundle UUID or object")
  }
  if (isRecord(input) && Object.keys(input).some((key) => key !== "bundleId")) {
    throw new TypeError("Portable-design read input accepts only bundleId")
  }
  let requestedId = typeof input === "string"
    ? input
    : isRecord(input) && typeof input.bundleId === "string"
      ? input.bundleId
      : undefined
  if (!requestedId) {
    const page = await client.listPortableDesignSnapshots(0, 200)
    const selected = await vscode.window.showQuickPick(
      page.items.map((summary) => ({
        label: summary.title,
        description: summary.bundleId,
        detail: `${summary.governance.state} · upstream ${summary.sourceReview.status} claim`,
        bundleId: summary.bundleId,
      })),
      { title: "Read one exact portable-design snapshot", ignoreFocusOut: true },
    )
    requestedId = selected?.bundleId
  }
  if (!requestedId) throw new WorkflowCancelled()
  const bundleId = normalizeUuid(requestedId, "Bundle ID")
  const summary = await client.readPortableDesignSnapshot(bundleId)
  await showSnapshotDocument(summary)
  return summary
}

async function showSnapshotDocument(summary: PortableDesignSnapshotSummary): Promise<void> {
  const document = await vscode.workspace.openTextDocument({
    language: "json",
    content: `${JSON.stringify(summary, null, 2)}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
}

async function showAgentReadiness(pool: EngineClientPool): Promise<readonly AgentReadinessSnapshot[]> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const snapshots = await (await pool.get(folder.uri.fsPath)).probeAgentReadiness()
  const content = [
    "GAEP Codex and Claude readiness",
    "",
    "Observation only: this view cannot select a model, change settings, start an agent, resume work, or grant execution authority.",
    "Only verified, path-free capability metadata is shown. Executable paths, provider credentials, and raw engine output are withheld.",
    "",
    ...snapshots.flatMap(renderAgentReadiness),
  ].join("\n")
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${content}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return snapshots
}

async function selectAgent(pool: EngineClientPool): Promise<AgentSelection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const current = await client.readAgentSelection()
  if (current.status === "migration-required") {
    throw new ConfigurationBoundaryError(
      "The existing legacy Agent Selection requires explicit migration review. Kiro will not overwrite it implicitly.",
    )
  }
  if (current.status === "invalid") {
    throw new ConfigurationBoundaryError(
      "The existing Agent Selection is invalid. Repair or review the governed record before selecting another agent.",
    )
  }

  const target = await collectAgentTarget(client, "Select one verified local agent adapter")
  const actorId = normalizeActorId(machineSetting("actorId", undefined, "gaep.kiro-local-human"))
  const prior = current.status === "selected"
    ? ` Current selection: ${current.selection.agentId} / ${current.selection.modelId}.`
    : ""
  const confirmation = await vscode.window.showWarningMessage(
    `Record ${target.snapshot.agentLabel} / ${target.modelId} with ${Object.keys(target.settings).length} explicit portable setting${Object.keys(target.settings).length === 1 ? "" : "s"}?${prior} This does not start a provider, create or resume a Run, approve tools or effects, or grant execution authority. The engine will reject active-Run, capability-drift, legacy, invalid, and post-Run changes that require a handoff.`,
    { modal: true },
    "Confirm Selection",
  )
  if (confirmation !== "Confirm Selection") throw new WorkflowCancelled()
  requireTrustedWorkspace()
  const selected = await client.selectAgent({
    adapterId: target.snapshot.adapterId,
    modelId: target.modelId,
    settings: target.settings,
    actorId,
  })
  await showAgentSelectionDocument(selected)
  await vscode.window.showInformationMessage(
    `Recorded ${selected.agentId} / ${selected.modelId} as portable Agent Selection. No agent was started and no Run authority was granted.`,
  )
  return selected
}

async function handoffAgent(pool: EngineClientPool): Promise<AgentHandoff> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const current = await client.readAgentSelection()
  if (current.status === "unselected") {
    throw new ConfigurationBoundaryError("No prior Agent Selection exists. Use guarded selection before creating Runs or handoffs.")
  }
  if (current.status === "migration-required") {
    throw new ConfigurationBoundaryError(
      "The existing legacy Agent Selection requires explicit migration review before a versioned handoff.",
    )
  }
  if (current.status === "invalid") {
    throw new ConfigurationBoundaryError(
      "The existing Agent Selection is invalid. Repair or review the governed record before creating a handoff.",
    )
  }

  const runs = await client.listRuns()
  const active = runs.filter((run) => !isTerminalRun(run))
  if (active.length > 0) {
    throw new ConfigurationBoundaryError(
      `A versioned handoff cannot be created while ${active.length} Run${active.length === 1 ? " is" : "s are"} non-terminal. Stop, cancel, or reconcile the Run first.`,
    )
  }
  const sourceRun = runs[0]
  if (!sourceRun) {
    throw new ConfigurationBoundaryError("No prior terminal Run exists to bind as the source of a versioned handoff.")
  }
  if (!samePortableBinding(sourceRun.agent, current.selection)) {
    throw new ConfigurationBoundaryError(
      "The latest terminal Run is not bound to the current Agent Selection. Refresh or reconcile governed state before handing off.",
    )
  }

  const target = await collectAgentTarget(client, "Select the target for a versioned handoff")
  if (samePortableBinding(current.selection, {
    adapterId: target.snapshot.adapterId,
    modelId: target.modelId,
    settings: target.settings,
  })) {
    throw new ConfigurationBoundaryError(
      "The handoff target is identical to the current portable Agent Selection. Choose a different adapter, model, or setting.",
    )
  }

  const reason = await collectHandoffText("Why is this provider, model, or setting switch required?", true)
  const completedWork = await collectHandoffList("Completed work to preserve, separated by commas")
  const unresolvedMatters = await collectHandoffList("Unresolved matters to preserve, separated by commas")
  const decisions = await collectHandoffList("Decisions to preserve, separated by commas")
  const evidence = await collectHandoffList("Portable evidence references to preserve, separated by commas")
  if (completedWork.length === 0 && unresolvedMatters.length === 0 && decisions.length === 0 && evidence.length === 0) {
    throw new ConfigurationBoundaryError(
      "Record at least one completed-work, unresolved-matter, decision, or portable evidence entry before creating a handoff.",
    )
  }

  const confirmation = await vscode.window.showWarningMessage(
    [
      `Create a versioned handoff from terminal Run ${sourceRun.id}?`,
      `Prior selection: ${current.selection.agentId} / ${current.selection.modelId}.`,
      `Target selection: ${target.snapshot.agentLabel} / ${target.modelId} with ${Object.keys(target.settings).length} explicit portable setting${Object.keys(target.settings).length === 1 ? "" : "s"}.`,
      `Preserved entries: ${completedWork.length} completed, ${unresolvedMatters.length} unresolved, ${decisions.length} decisions, ${evidence.length} evidence.`,
      "The engine will atomically record the handoff and replace Agent Selection only after fresh capability verification. It will not start or resume a provider, create a Run, approve tools or effects, or grant execution authority.",
    ].join("\n\n"),
    { modal: true },
    "Create Handoff and Switch",
  )
  if (confirmation !== "Create Handoff and Switch") throw new WorkflowCancelled()
  requireTrustedWorkspace()

  const [freshSelection, freshRuns] = await Promise.all([client.readAgentSelection(), client.listRuns()])
  const freshSource = freshRuns[0]
  if (freshSelection.status !== "selected" || !sameExactSelection(freshSelection.selection, current.selection) ||
    freshRuns.some((run) => !isTerminalRun(run)) || !freshSource || freshSource.id !== sourceRun.id ||
    !samePortableBinding(freshSource.agent, current.selection)) {
    throw new ConfigurationBoundaryError(
      "Agent Selection or Run history changed while the handoff form was open. No handoff was requested; reopen the flow and review fresh state.",
    )
  }

  const actorId = normalizeActorId(machineSetting("actorId", undefined, "gaep.kiro-local-human"))
  const handoff = await client.createHandoff({
    fromRunId: sourceRun.id,
    productId: sourceRun.productId,
    initiativeId: sourceRun.initiativeId,
    toAdapterId: target.snapshot.adapterId,
    toAgentId: target.snapshot.agentId,
    toModelId: target.modelId,
    toSettings: target.settings,
    reason,
    completedWork,
    unresolvedMatters,
    decisions,
    evidence,
    actorId,
  })
  await showAgentHandoffDocument(handoff)
  await vscode.window.showInformationMessage(
    `Recorded versioned handoff ${handoff.id} and switched portable Agent Selection to ${handoff.toAgent.agentId} / ${handoff.toAgent.modelId}. No provider was started and no Run authority was granted.`,
  )
  return handoff
}

async function runManagedReadOnly(pool: EngineClientPool): Promise<ManagedReadOnlyReceipt> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const charterId = await collectUuid("Enter the exact confirmed Execution Charter UUID", "Charter ID")
  const workflowPlanId = await collectUuid("Enter the Workflow Plan UUID bound by that Charter", "Workflow Plan ID")
  const preview = await client.previewManagedReadOnly(charterId, workflowPlanId)
  await showManagedReadOnlyPreview(preview)

  const confirmation = await vscode.window.showWarningMessage(
    [
      `Attest and execute exact preview ${preview.previewDigest}?`,
      `Provider binding: ${preview.agentId} / ${preview.modelId}; strategy: ${preview.strategy}; steps: ${preview.stepIds.length}; gates: ${preview.gates.length}.`,
      `Read-only envelope: ${preview.readScopeCount} declared read scope${preview.readScopeCount === 1 ? "" : "s"}; every Tool permission is denied; write scopes and non-observation effects are forbidden.`,
      "This is one bounded local request with a 120-second timeout. Kiro cannot interactively cancel or resume it over this stdio surface. If any staged change appears, GAEP attempts to discard it and withholds a success receipt.",
      "Provider completion and governed outcome satisfaction are separate receipt fields. Neither grants approval, implementation readiness, release readiness, or future Run authority.",
    ].join("\n\n"),
    { modal: true },
    "Attest Exact Preview and Run",
  )
  if (confirmation !== "Attest Exact Preview and Run") throw new WorkflowCancelled()
  requireTrustedWorkspace()
  const actorId = normalizeActorId(machineSetting("actorId", undefined, "gaep.kiro-local-human"))
  const receipt = await client.executeManagedReadOnly({ preview, timeoutMs: 120_000, actorId })
  await showManagedReadOnlyReceipt(receipt)
  await vscode.window.showInformationMessage(
    `Managed read-only Run ${receipt.managedRunId} ended ${receipt.state}; provider=${receipt.providerDisposition}; outcome=${receipt.outcomeStatus}. No Tool, write, or non-observation effect authority was granted.`,
  )
  return receipt
}

async function collectUuid(prompt: string, label: string): Promise<string> {
  const value = await vscode.window.showInputBox({
    prompt,
    ignoreFocusOut: true,
    validateInput: (candidate) => {
      try {
        normalizeUuid(candidate, label)
        return undefined
      } catch {
        return `${label} must be a non-empty UUID`
      }
    },
  })
  if (value === undefined) throw new WorkflowCancelled()
  return normalizeUuid(value, label)
}

async function showManagedReadOnlyPreview(preview: ManagedReadOnlyPreview): Promise<void> {
  const lines = [
    "GAEP managed read-only execution preview",
    "",
    `Preview digest: ${preview.previewDigest}`,
    `Charter: ${preview.charterId} (${preview.charterDigest})`,
    `Workflow Plan: ${preview.workflowPlanId} (${preview.workflowPlanDigest})`,
    `Provider: ${preview.adapterId} / ${preview.agentId} / ${preview.modelId}`,
    `Strategy: ${preview.strategy}`,
    `Workflow steps: ${preview.stepIds.length}`,
    `Context packs: ${preview.contextPackCount}`,
    `Declared read scopes: ${preview.readScopeCount}`,
    "",
    "Exact attestation gates:",
    ...preview.gates.flatMap((gate) => [
      `- ${gate.key} [${gate.phase}]${gate.stepId ? ` step=${gate.stepId}` : ""} digest=${gate.criteriaDigest}`,
      ...gate.criteria.map((criterion) => `    - ${criterion}`),
    ]),
    "",
    "Authority boundary: this preview grants no execution, Tool, write, effect, outcome, approval, or release authority.",
    "Dismiss the next modal to cancel by default.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
}

async function showManagedReadOnlyReceipt(receipt: ManagedReadOnlyReceipt): Promise<void> {
  const lines = [
    "GAEP managed read-only execution receipt",
    "",
    `Managed Run: ${receipt.managedRunId}`,
    `Governed Run: ${receipt.runId}`,
    `Attested preview: ${receipt.previewDigest}`,
    `Provider: ${receipt.adapterId} / ${receipt.agentId} / ${receipt.modelId}`,
    `Mode: ${receipt.mode}`,
    `Terminal state: ${receipt.state}`,
    `Provider disposition: ${receipt.providerDisposition}`,
    `Governed outcome: ${receipt.outcomeStatus} (${receipt.outcomeBasis})`,
    `Workflow completion: ${receipt.completedStepCount}/${receipt.totalStepCount}`,
    `Evidence events: ${receipt.eventCount}`,
    `Result digest: ${receipt.resultDigest}`,
    `Evidence digest: ${receipt.evidenceDigest}`,
    `Started: ${receipt.startedAt}`,
    `Ended: ${receipt.endedAt}`,
    `Warnings: ${receipt.warnings.length === 0 ? "none" : receipt.warnings.join(", ")}`,
    "",
    "Boundary: provider completion does not equal governed outcome satisfaction. This receipt grants no Tool, write, effect, approval, implementation-readiness, release-readiness, or future Run authority.",
    "Raw provider output, prompts, context content, executable paths, process state, workspace paths, and credentials are withheld.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
}

async function showManagedEvidenceDashboard(pool: EngineClientPool): Promise<ManagedRunSummaryPage> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const firstPage = await client.listManagedEvidence(0, 100)
  const pages = [firstPage]
  while (true) {
    const page = pages.at(-1)!
    await showManagedEvidencePage(page)
    if (page.items.length === 0) {
      void vscode.window.showInformationMessage("No Managed Runs exist in the verified bounded inventory.")
      return page
    }
    const choices: Array<vscode.QuickPickItem & {
      readonly action: "read" | "next" | "previous"
      readonly managedRunId?: string
    }> = page.items.map((item) => ({
      label: `${item.state} · ${item.mode}`,
      description: item.managedRunId,
      detail: `${item.agentId} / ${item.modelId} · updated ${item.updatedAt} · ${item.hasResult ? "bound result" : "record only"}`,
      managedRunId: item.managedRunId,
      action: "read" as const,
    }))
    if (pages.length > 1) {
      choices.unshift({
        label: "$(arrow-left) Previous verified page",
        description: `Return to offset ${pages.at(-2)!.offset}`,
        action: "previous",
      })
    }
    if (page.hasMore) {
      choices.push({
        label: "$(arrow-right) Next verified page",
        description: `Continue at offset ${page.offset + page.items.length} under the same snapshot`,
        action: "next",
      })
    }
    const selected = await vscode.window.showQuickPick(choices, {
      title: `Managed Run evidence (${page.offset + 1}-${page.offset + page.items.length} of ${page.total}; ${page.omittedCount} outside this page)`,
      placeHolder: "Read one exact Run, navigate the verified snapshot, or dismiss to keep this observation-only",
      ignoreFocusOut: true,
    })
    if (!selected) return page
    if (selected.action === "previous") {
      pages.pop()
      continue
    }
    if (selected.action === "next") {
      pages.push(await client.listManagedEvidence(
        page.offset + page.items.length,
        page.limit,
        firstPage.snapshotDigest,
        firstPage.total,
      ))
      continue
    }
    await showManagedEvidenceDetail(await client.readManagedEvidence(selected.managedRunId!))
    return page
  }
}

async function showPhaseDashboard(pool: EngineClientPool): Promise<PhaseDashboardFramework> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const product = await client.readProduct()
  const dashboard = await client.readPhaseDashboard(product, "phase-0-1a-foundation")
  const lines = [
    "GAEP phase-scoped dashboard framework",
    "",
    `Delivery phase: ${dashboard.phase.label}`,
    `Exact Product revision: ${dashboard.product.revision}`,
    `Product digest: ${dashboard.product.digest}`,
    `Composition digest: ${dashboard.compositionDigest}`,
    `Observed: ${dashboard.observedAt}`,
    `Source: ${dashboard.sourceBoundary}`,
    `Evidence freshness: ${dashboard.evidenceCues.freshness}`,
    "Confidence: not assessed; no governed confidence evaluation is bound.",
    "",
    ...dashboard.panels.map((panel) =>
      `${panel.title} · ${panel.role} · applicability=${panel.applicability.status} (${panel.applicability.basis}) · state=${panel.state}`),
    "",
    ...dashboard.limitations.map((limitation) => `Limit: ${limitation}`),
    "",
    "Boundary: this is a read-only governed-state projection. It grants no mutation, applicability, phase-entry, approval, readiness, acceptance, release, Run, Tool, or effect authority.",
    "Product text, source bytes, local paths, provider output, prompts, executable state, and credentials are withheld.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return dashboard
}

async function showChangeImpactDashboard(pool: EngineClientPool): Promise<ChangeImpactDashboard> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const product = await client.readProduct()
  const catalog: ChangeImpactChangeCatalog = await client.listChangeImpactChanges(product)
  if (catalog.items.length === 0) {
    throw new ConfigurationBoundaryError("No current Change metadata is available for the exact Change/Impact dashboard.")
  }
  const selected = await vscode.window.showQuickPick(catalog.items.map((change) => ({
    label: change.recordId,
    description: `${change.state} · revision ${change.revision}`,
    detail: `Effects: ${change.effectEnvelope.join(", ")} · digest ${change.digest}`,
    change,
  })), {
    title: `Select one exact current Change (${catalog.items.length} of ${catalog.total}; ${catalog.omitted} omitted)`,
    placeHolder: "Open a read-only exact Change/Impact projection; selection grants no approval or effect authority",
    ignoreFocusOut: true,
  })
  if (!selected) throw new WorkflowCancelled()
  const dashboard = await client.readChangeImpact(product, selected.change)
  const locator = (value: ChangeImpactDashboard["changedArtifacts"][number]["locator"]): string =>
    value.kind === "workspace-relative" ? value.path : value.kind === "logical" ? value.value : value.uri
  const lines = [
    "GAEP exact Change and impact dashboard",
    "",
    `Change: ${dashboard.change.recordId}`,
    `Change revision / state: ${dashboard.change.revision} / ${dashboard.change.state}`,
    `Change digest: ${dashboard.change.digest}`,
    `Product revision: ${dashboard.product.revision}`,
    `Product digest: ${dashboard.product.digest}`,
    `Snapshot digest: ${dashboard.snapshotDigest}`,
    `Effects: ${dashboard.change.effectEnvelope.join(", ")}`,
    `Freshness: ${dashboard.freshness.state}; observed ${dashboard.observedAt}; trace evaluated ${dashboard.freshness.evaluatedAt}`,
    `Source: ${dashboard.sourceBoundary}`,
    `Evidence freshness: ${dashboard.evidenceCues.freshness}`,
    "Confidence: not assessed; no governed confidence evaluation is bound.",
    "Approval: not established. The current contract has no general Change approval record.",
    "",
    `Work Items (${dashboard.limits.workItems.shown}/${dashboard.limits.workItems.total}):`,
    ...dashboard.workItems.map((entry) => `  ${entry.record.recordId}@${entry.record.revision} · ${entry.state} · ${entry.record.digest}`),
    "",
    `Changed artifacts (${dashboard.limits.changedArtifacts.shown}/${dashboard.limits.changedArtifacts.total}):`,
    ...dashboard.changedArtifacts.map((entry) => `  ${locator(entry.locator)} · ${entry.locator.kind} · Work Item ${entry.sourceWorkItem.recordId}`),
    "",
    `Effect targets (${dashboard.limits.effectTargets.shown}/${dashboard.limits.effectTargets.total}):`,
    ...dashboard.effectTargets.map((entry) => `  ${locator(entry.locator)} · ${entry.locator.kind} · Work Item ${entry.sourceWorkItem.recordId}`),
    "",
    `Affected units (${dashboard.limits.affectedUnits.shown}/${dashboard.limits.affectedUnits.total}):`,
    ...dashboard.affectedUnits.map((entry) =>
      `  ${entry.direction} · ${entry.endpoint.recordType}:${entry.endpoint.recordId} · ${entry.relationship} · ${entry.trace.assessedState}`),
    "",
    `Related Decisions (${dashboard.limits.decisions.shown}/${dashboard.limits.decisions.total}):`,
    ...dashboard.governance.decisions.map((entry) =>
      `  ${entry.record.recordId}@${entry.record.revision} · ${entry.state} · ${entry.outcome}`),
    "",
    `Related Risks (${dashboard.limits.risks.shown}/${dashboard.limits.risks.total}):`,
    ...dashboard.governance.risks.map((entry) =>
      `  ${entry.record.recordId}@${entry.record.revision} · ${entry.state} · ${entry.likelihood}/${entry.impact} · ${entry.acceptance}`),
    "",
    `Trace attention: unresolved=${dashboard.freshness.unresolvedTraceLinks}; invalid=${dashboard.freshness.invalidTraceLinks}; stale=${dashboard.freshness.staleTraceLinks}; stale governance=${dashboard.freshness.staleGovernanceReferences}`,
    `Omissions: ${dashboard.limits.truncated ? "one or more bounded categories are truncated" : "none in bounded categories"}`,
    "Coverage: absence of a trace link does not prove absence of impact.",
    ...dashboard.limitations.map((limitation) => `Limit: ${limitation}`),
    "",
    "Boundary: this read-only projection grants no Change approval, risk acceptance, mutation, Run, Tool, write, effect, phase-entry, readiness, release, or outcome authority.",
    "Product text, Change text, Work Item text, source bytes, absolute paths, provider output, prompts, executable state, and credentials are withheld.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return dashboard
}

async function showAgentModelDashboard(pool: EngineClientPool): Promise<AgentModelDashboard> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const product = await client.readProduct()
  const dashboard = await client.readAgentModel(product)
  const selectionLines = dashboard.selection.status === "selected" || dashboard.selection.status === "migration-required"
    ? [
        `Selection: ${dashboard.selection.status} · ${dashboard.selection.adapterId}/${dashboard.selection.agentId} · ${dashboard.selection.modelId}`,
        `Selection digest: ${dashboard.selection.selectionDigest}`,
        `Selection capability: ${dashboard.selection.capabilityState} · ${dashboard.selection.capabilityDigest}`,
        ...Object.entries(dashboard.selection.settings).map(([key, value]) =>
          `  setting ${key}=${Array.isArray(value) ? value.join(", ") : String(value)}`),
      ]
    : [`Selection: ${dashboard.selection.status}`]
  const lines = [
    "GAEP exact Agent and Model dashboard",
    "",
    `Product revision: ${dashboard.product.revision}`,
    `Product digest: ${dashboard.product.digest}`,
    `Snapshot digest: ${dashboard.snapshotDigest}`,
    `Freshness: ${dashboard.freshness.state} · selection capability ${dashboard.freshness.selectionCapabilityState}`,
    `Source: ${dashboard.sourceBoundary}`,
    `Evidence freshness: ${dashboard.evidenceCues.freshness}`,
    "Confidence: not assessed; no governed confidence evaluation is bound.",
    `Capability observation range: ${dashboard.freshness.oldestCapabilityObservedAt} to ${dashboard.freshness.newestCapabilityObservedAt}`,
    "Provider usage: unavailable; current Managed Run records have no provider usage contract.",
    "Provider cost: unavailable; current Managed Run records have no provider cost contract.",
    "",
    ...selectionLines,
    "",
    `Observed capabilities (${dashboard.limits.capabilities.shown}/${dashboard.limits.capabilities.total}):`,
    ...dashboard.capabilities.map((entry) =>
      `  ${entry.adapterId}/${entry.agentId} · ${entry.agentLabel} · ${entry.executionInterface}/${entry.interfaceMaturity} · models=${entry.modelCount} · selected=${entry.selected} · ${entry.capabilityDigest}`),
    "",
    `Runs (${dashboard.limits.runs.shown}/${dashboard.limits.runs.total}):`,
    ...dashboard.runs.map((entry) => {
      const managed = entry.managed.status === "observed"
        ? `${entry.managed.state}/attempt-${entry.managed.attemptNumber}/${entry.managed.result.status}`
        : entry.managed.status
      return `  ${entry.record.recordId}@${entry.record.revision} · ${entry.state} · ${entry.agent.adapterId}/${entry.agent.agentId}/${entry.agent.modelId} · managed=${managed}`
    }),
    "",
    `Agent/model handoffs (${dashboard.limits.handoffs.shown}/${dashboard.limits.handoffs.total}):`,
    ...dashboard.handoffs.map((entry) =>
      `  ${entry.record.recordId} · Run ${entry.fromRun.recordId} -> ${entry.toSelection.adapterId}/${entry.toSelection.agentId}/${entry.toSelection.modelId} · ${entry.state}`),
    "",
    `Managed Run observations: ${dashboard.limits.managedRuns.shown}/${dashboard.limits.managedRuns.total}`,
    `Omissions: ${dashboard.limits.truncated ? "one or more bounded categories are truncated" : "none in reported categories"}`,
    "Coverage: bounded current records do not prove provider-account or native-host readiness.",
    ...dashboard.limitations.map((limitation) => `Limit: ${limitation}`),
    "",
    "Boundary: this read-only projection cannot select or switch an agent, create a handoff, launch a Run, authorize a Tool/write/effect, approve an outcome, establish readiness, or grant release authority.",
    "Product text, Run narrative, source bytes, absolute paths, provider output, prompts, executable state, credentials, and sensitive setting values are withheld.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return dashboard
}

async function showAccessibleDashboardTables(pool: EngineClientPool): Promise<void> {
  requireTrustedWorkspace()
  const dashboardKind = await vscode.window.showQuickPick([
    {
      label: "Phase dashboard tables",
      description: "Exact phase-panel metadata",
      value: "phase" as const,
    },
    {
      label: "Change and impact tables",
      description: "Exact Work Item, artifact, effect, trace, Decision, and Risk metadata",
      value: "change-impact" as const,
    },
    {
      label: "Agent and model tables",
      description: "Exact capability, selection, Run, handoff, and unavailable-metric metadata",
      value: "agent-model" as const,
    },
  ], {
    title: "Select an accessible GAEP dashboard table group",
    placeHolder: "Keyboard and screen-reader flow; all rows remain read-only verified metadata",
    ignoreFocusOut: true,
  })
  if (!dashboardKind) throw new WorkflowCancelled()

  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const product = await client.readProduct()
  let tables: readonly AccessibleMetadataTable[]
  if (dashboardKind.value === "phase") {
    tables = phaseDashboardTables(await client.readPhaseDashboard(product, "phase-0-1a-foundation"))
  } else if (dashboardKind.value === "change-impact") {
    const catalog = await client.listChangeImpactChanges(product)
    if (catalog.items.length === 0) {
      throw new ConfigurationBoundaryError("No current Change metadata is available for accessible Change/Impact tables.")
    }
    const selectedChange = await vscode.window.showQuickPick(catalog.items.map((change) => ({
      label: change.recordId,
      description: `${change.state} · revision ${change.revision}`,
      detail: `Effects: ${change.effectEnvelope.join(", ")} · digest ${change.digest}`,
      change,
    })), {
      title: `Select one exact current Change (${catalog.items.length} of ${catalog.total}; ${catalog.omitted} omitted)`,
      placeHolder: "Table selection grants no approval or effect authority",
      ignoreFocusOut: true,
    })
    if (!selectedChange) throw new WorkflowCancelled()
    tables = changeImpactDashboardTables(await client.readChangeImpact(product, selectedChange.change))
  } else {
    tables = agentModelDashboardTables(await client.readAgentModel(product))
  }

  const selectedTable = await vscode.window.showQuickPick(tables.map((table) => ({
    label: table.title,
    description: `${table.rows.length} verified row${table.rows.length === 1 ? "" : "s"} · ${table.omitted} omitted upstream`,
    detail: "Sort and filter only these already-bounded visible metadata columns",
    table,
  })), {
    title: "Select one accessible metadata table",
    placeHolder: "Dismiss to leave all governed state unchanged",
    ignoreFocusOut: true,
  })
  if (!selectedTable) throw new WorkflowCancelled()

  const sourceOrder = Symbol("source-order")
  const sort = await vscode.window.showQuickPick([
    { label: "Keep verified source order", description: "No client-side sort", value: sourceOrder as string | typeof sourceOrder },
    ...selectedTable.table.columns.map((column) => ({
      label: `Sort by ${column.label}`,
      description: "Deterministic text sort with row-ID tie breaking",
      value: column.key as string | typeof sourceOrder,
    })),
  ], {
    title: `Sort ${selectedTable.table.title}`,
    placeHolder: "Choose a visible column or keep verified source order",
    ignoreFocusOut: true,
  })
  if (!sort) throw new WorkflowCancelled()
  let sortDirection: AccessibleTableSortDirection | undefined
  if (sort.value !== sourceOrder) {
    const direction = await vscode.window.showQuickPick([
      { label: "Ascending", description: "A to Z", value: "ascending" as const },
      { label: "Descending", description: "Z to A", value: "descending" as const },
    ], {
      title: `Choose ${sort.label.toLocaleLowerCase()} direction`,
      ignoreFocusOut: true,
    })
    if (!direction) throw new WorkflowCancelled()
    sortDirection = direction.value
  }

  const filter = await vscode.window.showInputBox({
    title: `Filter ${selectedTable.table.title}`,
    prompt: "Optional: match up to 256 characters against only the visible verified metadata columns",
    placeHolder: "Leave empty to show every verified row",
    ignoreFocusOut: true,
    validateInput: (value) => value.length > 256 ? "Use at most 256 characters" : undefined,
  })
  if (filter === undefined) throw new WorkflowCancelled()
  const view = sort.value === sourceOrder
    ? buildAccessibleTableView(selectedTable.table, { filter })
    : buildAccessibleTableView(selectedTable.table, { filter, sortKey: sort.value, sortDirection: sortDirection! })
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: renderAccessibleTableText(view),
  })
  await vscode.window.showTextDocument(document, { preview: true })
  if (view.rows.length === 0) {
    void vscode.window.showInformationMessage(
      `${view.table.title}: showing 0 of ${view.table.rows.length} verified rows. Nothing was copied.`,
    )
    return
  }
  const action = await vscode.window.showInformationMessage(
    `${view.table.title}: showing ${view.rows.length} of ${view.table.rows.length} verified rows.`,
    "Copy Visible Rows as CSV",
  )
  if (action !== "Copy Visible Rows as CSV") return
  try {
    await vscode.env.clipboard.writeText(accessibleTableCsv(view))
    void vscode.window.showInformationMessage(
      `${view.table.title}: copied ${view.rows.length} visible metadata row${view.rows.length === 1 ? "" : "s"} as CSV.`,
    )
  } catch {
    await vscode.window.showErrorMessage(`${view.table.title}: CSV copy failed. No file was written.`)
  }
}

function phaseDashboardTables(dashboard: PhaseDashboardFramework): readonly AccessibleMetadataTable[] {
  return [metadataTable({
    id: "phase-panels",
    title: `${dashboard.phase.label} panels`,
    columns: columns([
      ["panel-id", "Panel ID"], ["title", "Title"], ["role", "Role"], ["applicability", "Applicability"],
      ["basis", "Applicability basis"], ["state", "State"], ["decision", "Decision binding"],
    ]),
    rows: dashboard.panels.map((panel) => metadataRow(panel.id, {
      "panel-id": panel.id,
      title: panel.title,
      role: panel.role,
      applicability: panel.applicability.status,
      basis: panel.applicability.basis,
      state: panel.state,
      decision: panel.applicability.decision
        ? `${panel.applicability.decision.recordId}@${panel.applicability.decision.revision} · ${panel.applicability.decision.digest}`
        : "not bound",
    })),
    total: dashboard.panels.length,
    omitted: 0,
    snapshotDigest: dashboard.compositionDigest,
    sourceBoundary: dashboard.sourceBoundary,
    authorityBoundary: dashboard.authorityBoundary,
  })]
}

function changeImpactDashboardTables(dashboard: ChangeImpactDashboard): readonly AccessibleMetadataTable[] {
  const locator = (value: ChangeImpactDashboard["changedArtifacts"][number]["locator"]): string =>
    value.kind === "workspace-relative" ? value.path : value.kind === "logical" ? value.value : value.uri
  const common = {
    snapshotDigest: dashboard.snapshotDigest,
    sourceBoundary: dashboard.sourceBoundary,
    authorityBoundary: dashboard.authorityBoundary,
  }
  return [
    metadataTable({
      ...common,
      id: "change-work-items",
      title: "Change Work Items",
      columns: columns([["record-id", "Record ID"], ["revision", "Revision"], ["state", "State"], ["digest", "Digest"]]),
      rows: dashboard.workItems.map((entry) => metadataRow(entry.record.recordId, {
        "record-id": entry.record.recordId, revision: String(entry.record.revision), state: entry.state, digest: entry.record.digest,
      })),
      total: dashboard.limits.workItems.total,
      omitted: dashboard.limits.workItems.omitted,
    }),
    metadataTable({
      ...common,
      id: "changed-artifacts",
      title: "Changed artifacts",
      columns: columns([["locator", "Locator"], ["kind", "Kind"], ["work-item", "Source Work Item"]]),
      rows: dashboard.changedArtifacts.map((entry, index) => metadataRow(`${entry.sourceWorkItem.recordId}:artifact:${index}`, {
        locator: locator(entry.locator), kind: entry.locator.kind, "work-item": entry.sourceWorkItem.recordId,
      })),
      total: dashboard.limits.changedArtifacts.total,
      omitted: dashboard.limits.changedArtifacts.omitted,
    }),
    metadataTable({
      ...common,
      id: "effect-targets",
      title: "Effect targets",
      columns: columns([["locator", "Locator"], ["kind", "Kind"], ["work-item", "Source Work Item"]]),
      rows: dashboard.effectTargets.map((entry, index) => metadataRow(`${entry.sourceWorkItem.recordId}:effect:${index}`, {
        locator: locator(entry.locator), kind: entry.locator.kind, "work-item": entry.sourceWorkItem.recordId,
      })),
      total: dashboard.limits.effectTargets.total,
      omitted: dashboard.limits.effectTargets.omitted,
    }),
    metadataTable({
      ...common,
      id: "affected-units",
      title: "Affected units",
      columns: columns([
        ["direction", "Direction"], ["endpoint", "Endpoint"], ["relationship", "Relationship"],
        ["trace-state", "Trace state"], ["trace-id", "Trace ID"], ["assessment-digest", "Assessment digest"],
      ]),
      rows: dashboard.affectedUnits.map((entry) => metadataRow(`${entry.trace.recordId}:${entry.direction}:${entry.endpoint.recordId}`, {
        direction: entry.direction,
        endpoint: `${entry.endpoint.recordType}:${entry.endpoint.recordId}`,
        relationship: entry.relationship,
        "trace-state": entry.trace.assessedState,
        "trace-id": entry.trace.recordId,
        "assessment-digest": entry.trace.assessmentDigest,
      })),
      total: dashboard.limits.affectedUnits.total,
      omitted: dashboard.limits.affectedUnits.omitted,
    }),
    metadataTable({
      ...common,
      id: "related-decisions",
      title: "Related Decisions",
      columns: columns([["record-id", "Record ID"], ["revision", "Revision"], ["state", "State"], ["outcome", "Outcome"], ["digest", "Digest"]]),
      rows: dashboard.governance.decisions.map((entry) => metadataRow(entry.record.recordId, {
        "record-id": entry.record.recordId, revision: String(entry.record.revision), state: entry.state,
        outcome: entry.outcome, digest: entry.record.digest,
      })),
      total: dashboard.limits.decisions.total,
      omitted: dashboard.limits.decisions.omitted,
    }),
    metadataTable({
      ...common,
      id: "related-risks",
      title: "Related Risks",
      columns: columns([
        ["record-id", "Record ID"], ["revision", "Revision"], ["state", "State"], ["likelihood", "Likelihood"],
        ["impact", "Impact"], ["acceptance", "Acceptance"], ["digest", "Digest"],
      ]),
      rows: dashboard.governance.risks.map((entry) => metadataRow(entry.record.recordId, {
        "record-id": entry.record.recordId, revision: String(entry.record.revision), state: entry.state,
        likelihood: entry.likelihood, impact: entry.impact, acceptance: entry.acceptance, digest: entry.record.digest,
      })),
      total: dashboard.limits.risks.total,
      omitted: dashboard.limits.risks.omitted,
    }),
  ]
}

function agentModelDashboardTables(dashboard: AgentModelDashboard): readonly AccessibleMetadataTable[] {
  const common = {
    snapshotDigest: dashboard.snapshotDigest,
    sourceBoundary: dashboard.sourceBoundary,
    authorityBoundary: dashboard.authorityBoundary,
  }
  const selection = dashboard.selection
  return [
    metadataTable({
      ...common,
      id: "agent-capabilities",
      title: "Observed agent capabilities",
      columns: columns([
        ["agent", "Agent"], ["adapter-version", "Adapter version"], ["runtime-version", "Runtime version"],
        ["detected", "Detected"], ["interface", "Execution interface"], ["maturity", "Interface maturity"],
        ["models", "Model count"], ["selected", "Selected"], ["observed-at", "Observed at"], ["digest", "Capability digest"],
      ]),
      rows: dashboard.capabilities.map((entry) => metadataRow(`${entry.adapterId}:${entry.agentId}`, {
        agent: `${entry.adapterId}/${entry.agentId} · ${entry.agentLabel}`,
        "adapter-version": entry.adapterVersion,
        "runtime-version": entry.runtimeVersion ?? "not observed",
        detected: String(entry.detected),
        interface: entry.executionInterface,
        maturity: entry.interfaceMaturity,
        models: String(entry.modelCount),
        selected: String(entry.selected),
        "observed-at": entry.observedAt,
        digest: entry.capabilityDigest,
      })),
      total: dashboard.limits.capabilities.total,
      omitted: dashboard.limits.capabilities.omitted,
    }),
    metadataTable({
      ...common,
      id: "agent-selection",
      title: "Current Agent Selection",
      columns: columns([
        ["status", "Status"], ["agent", "Agent"], ["model", "Model"], ["truth-class", "Model truth class"],
        ["alias", "Model alias"], ["capability-state", "Capability state"], ["selected-at", "Selected at"],
        ["selection-digest", "Selection digest"], ["capability-digest", "Capability digest"],
      ]),
      rows: [metadataRow("current-selection", {
        status: selection.status,
        agent: selection.status === "selected" || selection.status === "migration-required" ? `${selection.adapterId}/${selection.agentId}` : "not available",
        model: selection.status === "selected" || selection.status === "migration-required" ? selection.modelId : "not available",
        "truth-class": selection.status === "selected" || selection.status === "migration-required" ? selection.modelTruthClass : "not available",
        alias: selection.status === "selected" || selection.status === "migration-required" ? String(selection.modelAlias) : "not available",
        "capability-state": selection.status === "selected" || selection.status === "migration-required" ? selection.capabilityState : "not available",
        "selected-at": selection.status === "selected" || selection.status === "migration-required" ? selection.selectedAt : "not available",
        "selection-digest": selection.status === "selected" || selection.status === "migration-required" ? selection.selectionDigest : "not available",
        "capability-digest": selection.status === "selected" || selection.status === "migration-required" ? selection.capabilityDigest : "not available",
      })],
      total: 1,
      omitted: 0,
    }),
    metadataTable({
      ...common,
      id: "agent-runs",
      title: "Agent Runs and Managed evidence",
      columns: columns([
        ["run-id", "Run ID"], ["revision", "Revision"], ["state", "State"], ["agent", "Agent"], ["model", "Model"],
        ["started-at", "Started at"], ["ended-at", "Ended at"], ["managed-state", "Managed state"],
        ["managed-result", "Managed result"], ["digest", "Run digest"],
      ]),
      rows: dashboard.runs.map((entry) => metadataRow(entry.record.recordId, {
        "run-id": entry.record.recordId,
        revision: String(entry.record.revision),
        state: entry.state,
        agent: `${entry.agent.adapterId}/${entry.agent.agentId}`,
        model: entry.agent.modelId,
        "started-at": entry.startedAt ?? "not recorded",
        "ended-at": entry.endedAt ?? "not recorded",
        "managed-state": entry.managed.status === "observed" ? `${entry.managed.state} · attempt ${entry.managed.attemptNumber}` : entry.managed.status,
        "managed-result": entry.managed.status === "observed" ? entry.managed.result.status : "not observed",
        digest: entry.record.digest,
      })),
      total: dashboard.limits.runs.total,
      omitted: dashboard.limits.runs.omitted,
    }),
    metadataTable({
      ...common,
      id: "agent-handoffs",
      title: "Agent and model handoffs",
      columns: columns([
        ["handoff-id", "Handoff ID"], ["from-run", "From Run"], ["target", "Target selection"], ["state", "State"],
        ["created-at", "Created at"], ["acknowledged-at", "Acknowledged at"], ["digest", "Handoff digest"],
      ]),
      rows: dashboard.handoffs.map((entry) => metadataRow(entry.record.recordId, {
        "handoff-id": entry.record.recordId,
        "from-run": entry.fromRun.recordId,
        target: `${entry.toSelection.adapterId}/${entry.toSelection.agentId}/${entry.toSelection.modelId}`,
        state: entry.state,
        "created-at": entry.createdAt,
        "acknowledged-at": entry.acknowledgedAt ?? "not acknowledged",
        digest: entry.record.digest,
      })),
      total: dashboard.limits.handoffs.total,
      omitted: dashboard.limits.handoffs.omitted,
    }),
    metadataTable({
      ...common,
      id: "provider-metrics",
      title: "Provider usage and cost metadata",
      columns: columns([["metric", "Metric"], ["state", "State"], ["basis", "Basis"]]),
      rows: [
        metadataRow("usage", { metric: "Usage", state: dashboard.providerMetrics.usage.state, basis: dashboard.providerMetrics.usage.basis }),
        metadataRow("cost", { metric: "Cost", state: dashboard.providerMetrics.cost.state, basis: dashboard.providerMetrics.cost.basis }),
      ],
      total: 2,
      omitted: 0,
    }),
  ]
}

function columns(values: readonly (readonly [key: string, label: string])[]): readonly AccessibleTableColumn[] {
  return values.map(([key, label]) => ({ key, label }))
}

function metadataRow(id: string, cells: Readonly<Record<string, string>>): AccessibleTableRow {
  return { id, cells }
}

function metadataTable(table: AccessibleMetadataTable): AccessibleMetadataTable {
  return createAccessibleMetadataTable(table)
}

async function showManagedEvidencePage(page: ManagedRunSummaryPage): Promise<void> {
  const lines = [
    "GAEP bounded Managed Run evidence",
    "",
    `Snapshot: ${page.snapshotDigest}`,
    `Offset / limit: ${page.offset} / ${page.limit}`,
    `Displayed: ${page.items.length} of ${page.total}`,
    `Omitted from this page: ${page.omittedCount}`,
    `More pages available: ${page.hasMore ? "yes" : "no"}`,
    "",
    ...page.items.map((item) => [
      `${item.managedRunId} · ${item.state} · ${item.mode}`,
      `  Provider: ${item.adapterId} / ${item.agentId} / ${item.modelId}`,
      `  Updated: ${item.updatedAt}; recovery=${item.recoveryStatus}; result=${item.hasResult ? "bound" : "not bound"}; apply decision=${item.hasApplyDecision ? "bound" : "not bound"}`,
    ].join("\n")),
    "",
    "Boundary: this audit-gated observation cannot start, resume, cancel, apply, discard, approve, or grant Run, Tool, write, effect, outcome, implementation-readiness, or release authority.",
    "Raw provider output, prompts, context content, changed paths, source bytes, executable paths, process state, workspace paths, and credentials are withheld.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
}

async function showManagedEvidenceDetail(detail: ManagedEvidenceDetail): Promise<void> {
  const { summary, result, evidence, applyDecision } = detail
  const lines = [
    "GAEP exact Managed Run evidence detail",
    "",
    `Managed Run: ${summary.managedRunId}`,
    `Governed Run: ${summary.runId}`,
    `Product / Initiative: ${summary.productId} / ${summary.initiativeId}`,
    `State / mode: ${summary.state} / ${summary.mode}`,
    `Provider: ${summary.adapterId} / ${summary.agentId} / ${summary.modelId}`,
    `Recovery: ${summary.recoveryStatus}; attempt ${summary.attemptNumber}; checkpoints ${summary.workflowCheckpointCount}`,
    `Artifact status: ${detail.artifactStatus}`,
    `Bindings digest: ${summary.bindingsDigest}`,
    ...(result ? [
      "",
      "Verified result:",
      `  Result: ${result.resultId} (${result.resultDigest})`,
      `  Terminal state: ${result.terminalState}`,
      `  Provider disposition: ${result.providerDisposition}; termination cause: ${result.terminationCause}`,
      `  Governed outcome: ${result.outcomeStatus} (${result.outcomeBasis})`,
      `  Warnings: ${result.warningCodes.length === 0 ? "none" : result.warningCodes.join(", ")}`,
      `  Started / ended: ${result.startedAt} / ${result.endedAt}`,
    ] : ["", "No committed result/evidence pair is bound to this record. No terminal outcome is inferred."]),
    ...(evidence ? [
      "",
      "Verified evidence:",
      `  Evidence: ${evidence.evidenceId} (${evidence.evidenceDigest})`,
      `  Events: ${evidence.eventCount}; lifecycle=${evidence.eventTypeCounts.lifecycle}; output=${evidence.eventTypeCounts.output}; item=${evidence.eventTypeCounts.item}; approval=${evidence.eventTypeCounts.approval}; warning=${evidence.eventTypeCounts.warning}; error=${evidence.eventTypeCounts.error}`,
      `  Workflow: ${evidence.workflowStrategy}; ${evidence.completedStepCount}/${evidence.workflowStepCount} steps; ${evidence.workflowAttemptCount} attempts`,
      `  Charter gates: evidence=${evidence.charterEvidenceStatus}; stop=${evidence.charterStopStatus}; reason=${evidence.terminalReasonCode}`,
      `  Actual effects: not-observed=${evidence.actualEffectCounts["not-observed"]}; provisional=${evidence.actualEffectCounts["observed-provisional"]}; applied=${evidence.actualEffectCounts.applied}; blocked=${evidence.actualEffectCounts.blocked}; unknown=${evidence.actualEffectCounts.unknown}`,
      ...(evidence.staging ? [
        `  Staging: ${evidence.staging.applyState}; changes=${evidence.staging.changeCount}; excluded=${evidence.staging.excludedPathCount}`,
        `  Stage digests: baseline=${evidence.staging.baselineDigest}; final=${evidence.staging.finalDigest}; inventory=${evidence.staging.changedInventoryDigest}`,
      ] : ["  Staging: not present"]),
      `  Captured: ${evidence.capturedAt}`,
    ] : []),
    ...(applyDecision ? [
      "",
      "Verified apply-decision evidence (observation only):",
      `  Receipt: ${applyDecision.receiptId} (${applyDecision.receiptDigest})`,
      `  Bound revision: ${applyDecision.managedRunRevision}; changed inventory count=${applyDecision.changedInventoryCount}; write-envelope count=${applyDecision.writeEnvelopeCount}`,
      `  Decided: ${applyDecision.decidedAt}`,
    ] : []),
    "",
    "Boundary: provider completion is separate from governed outcome. Apply-decision evidence records a past exact decision and grants this view no apply, discard, approval, Tool, write, effect, implementation-readiness, release, or future Run authority.",
    "Raw provider output, prompts, context content, changed paths, source bytes, executable paths, process state, workspace paths, and credentials are withheld.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
}

async function reviewManagedStagedChanges(
  pool: EngineClientPool,
): Promise<ManagedReviewPreview | ManagedReviewTransition> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const managedRunId = await collectUuid("Enter the exact pending Managed Run UUID", "Managed Run ID")
  const preview = await client.readManagedReview(managedRunId)
  await showManagedReviewPreview(preview)

  const actions = [
    ...(preview.canApply ? ["Apply Exact Reviewed Inventory"] : []),
    ...(preview.canDiscard ? ["Discard Staged Changes"] : []),
  ]
  const selected = await vscode.window.showWarningMessage(
    [
      `Managed Run ${preview.managedRunId} revision ${preview.managedRunRevision} is ${preview.state}.`,
      `${preview.staging.changeCount} exact staged file change(s); inventory ${preview.staging.changedInventoryDigest}; preview ${preview.previewDigest}.`,
      preview.canApply
        ? "Apply can change only the exact reviewed workspace-relative inventory and write envelope. Post-apply Workflow gates will be recorded not assessed, so governed outcome success cannot be claimed."
        : "Apply is unavailable. Exact discard remains available for this recovery state.",
      "Dismiss to keep the review pending. No mutation occurs by opening this review.",
    ].join("\n\n"),
    { modal: true },
    ...actions,
  )
  if (!selected) return preview

  const decision = selected === "Apply Exact Reviewed Inventory"
    ? "apply-exact-managed-review"
    : "discard-exact-managed-review"
  const confirmationLabel = decision === "apply-exact-managed-review"
    ? "Confirm Exact Apply"
    : "Confirm Exact Discard"
  const confirmation = await vscode.window.showWarningMessage(
    [
      `${confirmationLabel} for Managed Run ${preview.managedRunId}?`,
      `Bound revision: ${preview.managedRunRevision}; preview: ${preview.previewDigest}; changes: ${preview.staging.changeCount}; inventory: ${preview.staging.changedInventoryDigest}.`,
      decision === "apply-exact-managed-review"
        ? `Write envelope: ${preview.applyConfirmation?.writeEnvelope.join(", ") || "none"}. This can mutate those exact source-workspace paths. Workflow gates remain not assessed.`
        : "Discard persists a governed discarded state. Machine-local stage and recovery-journal cleanup remain separate, unproven claims.",
      "Dismiss to cancel and keep the current review pending.",
    ].join("\n\n"),
    { modal: true },
    confirmationLabel,
  )
  if (confirmation !== confirmationLabel) return preview

  requireTrustedWorkspace()
  const actorId = normalizeActorId(machineSetting("actorId", undefined, "gaep.kiro-local-human"))
  const transition = decision === "apply-exact-managed-review"
    ? await client.applyManagedReview(preview, actorId)
    : await client.discardManagedReview(preview, actorId)
  await showManagedReviewTransition(transition)
  await vscode.window.showInformationMessage(
    decision === "apply-exact-managed-review"
      ? `Exact apply transition persisted as ${transition.state}. Workflow gates were not assessed; no governed outcome success or cleanup completion is inferred.`
      : `Exact discard transition persisted as ${transition.state}. Machine-local cleanup completion is not independently claimed.`,
  )
  return transition
}

async function showManagedReviewPreview(preview: ManagedReviewPreview): Promise<void> {
  const inventory = preview.staging.changedInventory.length === 0
    ? ["No staged workspace file changes were recorded."]
    : preview.staging.changedInventory.flatMap((change, index) => [
        `${index + 1}. ${change.kind.toUpperCase()} ${change.path}`,
        `   Before: ${change.beforeDigest ?? "absent"}; ${change.beforeSize ?? 0} byte(s); mode ${change.beforeMode?.toString(8) ?? "absent"}`,
        `   After: ${change.afterDigest ?? "absent"}; ${change.afterSize ?? 0} byte(s); mode ${change.afterMode?.toString(8) ?? "absent"}`,
      ])
  const lines = [
    "GAEP exact staged Managed Run review",
    "",
    `Managed Run: ${preview.managedRunId}`,
    `Governed Run: ${preview.runId}`,
    `Revision / state: ${preview.managedRunRevision} / ${preview.state}`,
    `Product / Initiative: ${preview.productId} / ${preview.initiativeId}`,
    `Bindings digest: ${preview.bindingsDigest}`,
    `Result: ${preview.result.resultId} (${preview.result.resultDigest})`,
    `Provider disposition: ${preview.result.providerDisposition}`,
    `Governed outcome before decision: ${preview.result.outcomeStatus} (${preview.result.outcomeBasis})`,
    `Evidence: ${preview.staging.evidenceId} (${preview.staging.evidenceDigest})`,
    `Stage: ${preview.staging.applyState}; baseline=${preview.staging.baselineDigest}; final=${preview.staging.finalDigest}`,
    `Complete bounded inventory: ${preview.staging.changeCount}/${preview.staging.changedInventoryLimit}; omitted=${preview.staging.omittedCount}; digest=${preview.staging.changedInventoryDigest}`,
    `Excluded staged paths: ${preview.staging.excludedPathCount}; set digest=${preview.staging.excludedPathSetDigest}`,
    `Apply available: ${preview.canApply ? "yes" : "no"}; discard available: ${preview.canDiscard ? "yes" : "no"}; local journal observed: ${preview.hasLocalJournal ? "yes" : "no"}`,
    `Exact write envelope: ${preview.applyConfirmation?.writeEnvelope.join(", ") || "not available"}`,
    `Preview digest: ${preview.previewDigest}`,
    `Warnings: ${preview.result.warningCodes.length === 0 ? "none" : preview.result.warningCodes.join(", ")}`,
    "",
    "Exact changed-file inventory",
    "",
    ...inventory,
    "",
    "Boundary: this view authorizes no mutation. Apply or discard requires a separate exact revision-and-preview-digest-bound human decision and a second cancel-default confirmation.",
    "Apply is limited to this exact changed inventory and write envelope. The host records post-apply Workflow gates not assessed, so it cannot claim governed outcome satisfaction.",
    "Provider output, prompts, context content, staged source bytes, absolute paths, executable paths, process state, workspace paths and credentials are withheld.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
}

async function showManagedReviewTransition(transition: ManagedReviewTransition): Promise<void> {
  const detail = transition.detail
  const lines = [
    "GAEP managed staged-review transition",
    "",
    `Decision: ${transition.decision}`,
    `Managed Run: ${transition.managedRunId}`,
    `Revision: ${transition.sourceManagedRunRevision} -> ${transition.managedRunRevision}`,
    `Persisted state: ${transition.state}`,
    `Source preview: ${transition.sourcePreviewDigest}`,
    `Transition digest: ${transition.transitionDigest}`,
    `Apply available: ${transition.canApply ? "yes" : "no"}; discard available: ${transition.canDiscard ? "yes" : "no"}`,
    `Local journal observed: ${transition.hasLocalJournal ? "yes" : "no"}`,
    `Result digest: ${detail.summary.resultDigest ?? "not bound"}`,
    `Apply-decision digest: ${detail.summary.applyDecisionDigest ?? "not bound"}`,
    `Provider disposition: ${detail.result?.providerDisposition ?? "not available"}`,
    `Governed outcome: ${detail.result ? `${detail.result.outcomeStatus} (${detail.result.outcomeBasis})` : "not available"}`,
    "",
    "Boundary: this receipt proves only the verified persisted transition. Provider completion, governed outcome satisfaction, machine-local stage cleanup and recovery-journal cleanup remain separate claims.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
}

function isTerminalRun(run: AgentRun): boolean {
  return run.state === "completed" || run.state === "failed" || run.state === "cancelled"
}

function samePortableBinding(
  left: Pick<AgentSelection, "adapterId" | "modelId" | "settings">,
  right: Pick<AgentSelection, "adapterId" | "modelId" | "settings">,
): boolean {
  return left.adapterId === right.adapterId && left.modelId === right.modelId &&
    JSON.stringify(sortedSettings(left.settings)) === JSON.stringify(sortedSettings(right.settings))
}

function sameExactSelection(left: AgentSelection, right: AgentSelection): boolean {
  return left.schemaVersion === right.schemaVersion && left.adapterId === right.adapterId && left.agentId === right.agentId &&
    left.modelId === right.modelId && left.modelTruthClass === right.modelTruthClass && left.modelAlias === right.modelAlias &&
    left.selectedAt === right.selectedAt && left.capabilityDigest === right.capabilityDigest &&
    JSON.stringify(sortedSettings(left.settings)) === JSON.stringify(sortedSettings(right.settings))
}

function sortedSettings(settings: Readonly<Record<string, PortableAgentSettingValue>>): Record<string, PortableAgentSettingValue> {
  return Object.fromEntries(Object.entries(settings).sort(([left], [right]) => left.localeCompare(right)))
}

async function collectHandoffText(prompt: string, required: boolean): Promise<string> {
  const value = await vscode.window.showInputBox({
    prompt,
    ignoreFocusOut: true,
    validateInput: (candidate) => validateHandoffText(candidate, required),
  })
  if (value === undefined) throw new WorkflowCancelled()
  const issue = validateHandoffText(value, required)
  if (issue) throw new TypeError(issue)
  return value.trim()
}

async function collectHandoffList(prompt: string): Promise<readonly string[]> {
  const value = await collectHandoffText(prompt, false)
  if (!value) return Object.freeze([])
  const entries = value.split(",").map((entry) => entry.trim())
  if (entries.length > 256) throw new TypeError("Handoff detail lists can contain at most 256 entries")
  for (const entry of entries) {
    const issue = validateHandoffText(entry, true, 2_000)
    if (issue) throw new TypeError(issue)
  }
  return Object.freeze(entries)
}

function validateHandoffText(value: string, required: boolean, maximum = 5_000): string | undefined {
  const normalized = value.trim()
  if (required && normalized.length < 2) return "Enter at least two portable characters"
  if (!normalized && !required) return undefined
  if (normalized.length > maximum || /[\u0000-\u001F\u007F-\u009F]/u.test(normalized) ||
    /(?:^|[\s(="'])(?:~[\\/]|\/(?!\/)[^\s"'<>)]*|[A-Za-z]:[\\/][^\s"'<>)]*|\\\\[^\s"'<>)]*|file:\/\/[^\s"'<>)]*)/u.test(normalized) ||
    /\bBearer\s+\S+|\b(?:sk|sk-ant)-[A-Za-z0-9_-]{8,}\b|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b|\bAKIA[A-Z0-9]{16}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:token|secret|password|passwd|api[_-]?key)\s*[:=]\s*\S+/iu.test(normalized)) {
    return "Use portable text without machine paths, controls, or secret-shaped values"
  }
  return undefined
}

async function showAgentHandoffDocument(handoff: AgentHandoff): Promise<void> {
  const lines = [
    "GAEP versioned Agent Handoff",
    "",
    `Handoff: ${handoff.id}`,
    `Source Run: ${handoff.fromRunId}`,
    `Target: ${handoff.toAgent.agentId} / ${handoff.toAgent.modelId}`,
    `Created at: ${handoff.createdAt}`,
    `Workspace observation: dirty=${handoff.workspaceBaseline.dirty ?? "unknown"}; changed files=${handoff.workspaceBaseline.changedFiles.length}; truth=${handoff.workspaceBaseline.truthClass ?? "not recorded"}`,
    `Preserved entries: completed=${handoff.completedWork.length}; unresolved=${handoff.unresolvedMatters.length}; decisions=${handoff.decisions.length}; evidence=${handoff.evidence.length}`,
    "Capability differences:",
    ...handoff.capabilityDifferences.map((difference) => `  - ${difference}`),
    "",
    "Boundary: the handoff atomically replaced portable Agent Selection, but did not start or resume a provider, create a Run, approve tools or effects, or grant execution authority.",
    "Machine-local paths, credentials, provider sessions, and raw provider output are not included.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
}

interface AgentTarget {
  readonly snapshot: AgentReadinessSnapshot
  readonly modelId: string
  readonly settings: Readonly<Record<string, PortableAgentSettingValue>>
}

async function collectAgentTarget(client: GaepEngineClient, title: string): Promise<AgentTarget> {
  const snapshots = await client.probeAgentReadiness()
  const available = snapshots.filter((snapshot) => snapshot.detected && snapshot.executionInterface !== "unavailable")
  if (available.length === 0) {
    throw new ConfigurationBoundaryError("No verified local Codex or Claude adapter is currently available for selection.")
  }
  const adapter = await vscode.window.showQuickPick(
    available.map((snapshot) => ({
      label: snapshot.agentLabel,
      description: `${snapshot.adapterId} · ${snapshot.executionInterface} (${snapshot.interfaceMaturity})`,
      detail: `${snapshot.models.length} model${snapshot.models.length === 1 ? "" : "s"}; ${snapshot.settings.length} portable setting${snapshot.settings.length === 1 ? "" : "s"}`,
      snapshot,
    })),
    {
      title,
      placeHolder: "Portable configuration only; this does not start an agent",
      ignoreFocusOut: true,
    },
  )
  if (!adapter) throw new WorkflowCancelled()
  return Object.freeze({
    snapshot: adapter.snapshot,
    modelId: await selectAgentModel(adapter.snapshot),
    settings: await collectAgentSettings(adapter.snapshot.settings),
  })
}

async function selectAgentModel(snapshot: AgentReadinessSnapshot): Promise<string> {
  const manual = Symbol("manual-model")
  const chosen = await vscode.window.showQuickPick(
    [
      ...snapshot.models.map((model) => ({
        label: model.label,
        description: `${model.id} · ${model.truthClass}${model.alias ? " · alias" : ""}`,
        value: model.id as string | typeof manual,
      })),
      {
        label: "Enter another model ID…",
        description: "The engine will verify it against the current capability snapshot",
        value: manual as string | typeof manual,
      },
    ],
    {
      title: `Select a model for ${snapshot.agentLabel}`,
      placeHolder: "Dismiss to leave Agent Selection unchanged",
      ignoreFocusOut: true,
    },
  )
  if (!chosen) throw new WorkflowCancelled()
  if (chosen.value !== manual) return chosen.value
  const entered = await vscode.window.showInputBox({
    title: `Enter a portable model ID for ${snapshot.agentLabel}`,
    prompt: "The local engine must verify this model against the current adapter capabilities.",
    ignoreFocusOut: true,
    validateInput: (value) => validatePortableInput(value, true, "Model ID"),
  })
  if (entered === undefined) throw new WorkflowCancelled()
  const issue = validatePortableInput(entered, true, "Model ID")
  if (issue) throw new TypeError(issue)
  return entered
}

async function collectAgentSettings(
  declarations: readonly AgentSelectionSetting[],
): Promise<Readonly<Record<string, PortableAgentSettingValue>>> {
  const values: Record<string, PortableAgentSettingValue> = Object.create(null) as Record<string, PortableAgentSettingValue>
  for (const setting of declarations) {
    if (setting.sensitive) {
      throw new ConfigurationBoundaryError(
        `${setting.label} requires a machine-local credential binding, which this portable Kiro selection flow does not collect or store.`,
      )
    }
    const value = await collectAgentSetting(setting)
    if (value !== undefined) values[setting.key] = value
  }
  return Object.freeze(values)
}

async function collectAgentSetting(setting: AgentSelectionSetting): Promise<PortableAgentSettingValue | undefined> {
  if (setting.kind === "select") {
    const options = setting.options ?? []
    if (options.length === 0 && setting.required && setting.defaultValue === undefined) {
      throw new ConfigurationBoundaryError(`${setting.label} is required but the verified adapter declared no selectable values.`)
    }
    const useDefault = Symbol("use-default")
    const choices: Array<vscode.QuickPickItem & { readonly value: string | typeof useDefault }> = []
    if (!setting.required || setting.defaultValue !== undefined) {
      choices.push({
        label: "Use adapter default",
        description: setting.defaultValue === undefined ? "No explicit override" : `Declared default: ${formatSettingDefault(setting.defaultValue)}`,
        value: useDefault,
      })
    }
    choices.push(...options.map((option) => ({
      label: option.label,
      description: option.value,
      ...(option.description !== undefined ? { detail: option.description } : {}),
      value: option.value,
    })))
    const selected = await vscode.window.showQuickPick(
      choices,
      { title: setting.label, placeHolder: setting.description, ignoreFocusOut: true },
    )
    if (!selected) throw new WorkflowCancelled()
    return selected.value === useDefault ? undefined : selected.value
  }
  if (setting.kind === "boolean") {
    const useDefault = Symbol("use-default")
    const selected = await vscode.window.showQuickPick(
      [
        ...(setting.required && setting.defaultValue === undefined ? [] : [{
          label: "Use adapter default",
          description: setting.defaultValue === undefined ? "No explicit override" : `Declared default: ${formatSettingDefault(setting.defaultValue)}`,
          value: useDefault as boolean | typeof useDefault,
        }]),
        { label: "True", value: true as boolean | typeof useDefault },
        { label: "False", value: false as boolean | typeof useDefault },
      ],
      { title: setting.label, placeHolder: setting.description, ignoreFocusOut: true },
    )
    if (!selected) throw new WorkflowCancelled()
    return selected.value === useDefault ? undefined : selected.value
  }

  const defaultText = setting.defaultValue === undefined ? "" : formatSettingDefault(setting.defaultValue)
  const entered = await vscode.window.showInputBox({
    title: setting.label,
    prompt: setting.kind === "string-list" ? `${setting.description} Enter comma-separated values.` : setting.description,
    value: defaultText,
    ignoreFocusOut: true,
    validateInput: (value) => validateSettingInput(setting, value),
  })
  if (entered === undefined) throw new WorkflowCancelled()
  const issue = validateSettingInput(setting, entered)
  if (issue) throw new TypeError(issue)
  if (!entered.trim() && (!setting.required || setting.defaultValue !== undefined)) return undefined
  if (setting.kind === "number") return Number(entered)
  if (setting.kind === "string-list") return Object.freeze(entered.split(",").map((value) => value.trim()))
  return entered
}

function validateSettingInput(setting: AgentSelectionSetting, value: string): string | undefined {
  if (!value.trim() && (!setting.required || setting.defaultValue !== undefined)) return undefined
  if (!value.trim()) return `${setting.label} is required`
  if (setting.kind === "number") {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return `${setting.label} must be a finite number`
    if (setting.minimum !== undefined && parsed < setting.minimum) return `${setting.label} must be at least ${setting.minimum}`
    if (setting.maximum !== undefined && parsed > setting.maximum) return `${setting.label} must be at most ${setting.maximum}`
    return undefined
  }
  if (setting.kind === "string-list") {
    const items = value.split(",").map((item) => item.trim())
    if (items.some((item) => !item)) return `${setting.label} must be a comma-separated list of non-empty values`
    for (const item of items) {
      const issue = validatePortableInput(item, true, setting.label)
      if (issue) return issue
    }
    return undefined
  }
  return validatePortableInput(value, true, setting.label)
}

function validatePortableInput(value: string, required: boolean, label: string): string | undefined {
  if (required && !value) return `${label} is required`
  if (value.length > 10_000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value) ||
    /^(?:\/|[A-Za-z]:[\\/]|\\\\|file:\/\/|~[\\/])/u.test(value) ||
    /\bBearer\s+\S+|\b(?:sk|sk-ant)-[A-Za-z0-9_-]{8,}\b|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b|\bAKIA[A-Z0-9]{16}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:token|secret|password|passwd|api[_-]?key)\s*[:=]\s*\S+|^\$\{?[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY)[A-Z0-9_]*\}?$/iu.test(value)) {
    return `${label} must be portable text without paths, controls, or secret-shaped values`
  }
  return undefined
}

function formatSettingDefault(value: PortableAgentSettingValue): string {
  return Array.isArray(value) ? value.join(", ") : String(value)
}

async function showAgentSelectionDocument(selection: AgentSelection): Promise<void> {
  const lines = [
    "GAEP guarded Agent Selection",
    "",
    `Agent: ${selection.agentId}`,
    `Adapter: ${selection.adapterId}`,
    `Model: ${selection.modelId}`,
    `Model evidence: ${selection.modelTruthClass}${selection.modelAlias ? " (alias)" : ""}`,
    `Selected at: ${selection.selectedAt}`,
    `Portable settings: ${Object.keys(selection.settings).length}`,
    ...Object.entries(selection.settings).map(([key, value]) => `  - ${key}: ${formatSettingDefault(value)}`),
    "",
    "Boundary: this record does not start a provider, create or resume a Run, approve tools or effects, or grant execution authority.",
    "Machine-local executable paths, credentials, and raw provider output are not included.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
}

function renderAgentReadiness(snapshot: AgentReadinessSnapshot): readonly string[] {
  const models = snapshot.models.slice(0, 20).map((model) =>
    `  - ${model.label} (${model.id}; ${model.truthClass}${model.alias ? "; alias" : ""})`,
  )
  const limitations = snapshot.limitations.slice(0, 20).map((limitation) => `  - ${limitation}`)
  return [
    snapshot.agentLabel,
    `  Adapter: ${snapshot.adapterId} ${snapshot.adapterVersion}`,
    `  Detected: ${snapshot.detected ? "yes" : "no"}`,
    `  Runtime version: ${snapshot.runtimeVersion ?? "not observed"}`,
    `  Interface: ${snapshot.executionInterface} (${snapshot.interfaceMaturity})`,
    `  Capabilities: resume=${yesNo(snapshot.supportsResume)}, cancel=${yesNo(snapshot.supportsCancel)}, checkpoints=${yesNo(snapshot.supportsCheckpoints)}, model discovery=${yesNo(snapshot.supportsModelDiscovery)}, tool selection=${yesNo(snapshot.supportsToolSelection)}`,
    `  Declared settings: ${snapshot.settingsCount}`,
    `  Models observed: ${snapshot.models.length}`,
    ...(models.length ? models : ["  - none observed"]),
    ...(snapshot.models.length > models.length ? [`  - ${snapshot.models.length - models.length} more withheld from this compact view`] : []),
    `  Limitations: ${snapshot.limitations.length}`,
    ...(limitations.length ? limitations : ["  - none declared"]),
    ...(snapshot.limitations.length > limitations.length ? [`  - ${snapshot.limitations.length - limitations.length} more withheld from this compact view`] : []),
    `  Observed at: ${snapshot.observedAt}`,
    "",
  ]
}

function yesNo(value: boolean): "yes" | "no" {
  return value ? "yes" : "no"
}

async function assertExactContext(
  folder: vscode.WorkspaceFolder,
  client: GaepEngineClient,
  expected: ProductBinding,
): Promise<void> {
  requireTrustedWorkspace()
  const currentFolder = vscode.workspace.workspaceFolders?.find((candidate) => candidate.uri.toString() === folder.uri.toString())
  if (!currentFolder || currentFolder.uri.scheme !== "file") {
    throw new ConfigurationBoundaryError(
      "The Product root or trust context changed while the import was open. No portable-design snapshot was imported.",
    )
  }
  const current = await client.readProduct()
  if (current.id !== expected.id || current.revision !== expected.revision) {
    throw new ConfigurationBoundaryError(
      "The Product identity or revision changed while the import was open. Refresh Product Studio before trying again.",
    )
  }
}

function importAnnouncement(snapshot: PortableDesignSnapshotSummary): string {
  return [
    `Imported one local portable-design snapshot as ${snapshot.governance.state} with ${snapshot.counts.artifacts} validated artifact${snapshot.counts.artifacts === 1 ? "" : "s"}.`,
    `The upstream sourceReview value is ${snapshot.sourceReview.status}; it is not GAEP approval, a Design Baseline, implementation readiness, or release readiness.`,
    "Only validated metadata and digests were retained; local paths, source bytes, access tokens, credentials, and external-account state were not copied into this host.",
  ].join(" ")
}

function requireTrustedWorkspace(): void {
  if (!vscode.workspace.isTrusted) {
    throw new ConfigurationBoundaryError(
      "Trust this workspace before GAEP for Kiro inspects Product state or starts the local engine.",
    )
  }
}

async function selectWorkspaceFolder(): Promise<vscode.WorkspaceFolder> {
  const localFolders = (vscode.workspace.workspaceFolders ?? []).filter((folder) => folder.uri.scheme === "file")
  if (localFolders.length === 0) {
    throw new ConfigurationBoundaryError("Open a local workspace folder that owns the GAEP Product before continuing.")
  }
  if (localFolders.length === 1) return localFolders[0]!
  const selected = await vscode.window.showQuickPick(
    localFolders.map((folder) => ({ label: folder.name, description: folder.uri.fsPath, folder })),
    { title: "Select the exact local GAEP Product root", ignoreFocusOut: true },
  )
  if (!selected) throw new WorkflowCancelled()
  return selected.folder
}

function machineSetting(key: string, environmentName: string | undefined, fallback: string): string {
  const inspected = vscode.workspace.getConfiguration("gaepKiro").inspect<string>(key)
  if (inspected && hasWorkspaceOverride(inspected)) {
    throw new ConfigurationBoundaryError(
      `GAEP for Kiro rejected a workspace-scoped override for gaepKiro.${key}. Configure it at machine/user scope instead.`,
    )
  }
  const environmentValue = environmentName ? process.env[environmentName] : undefined
  const value = inspected?.globalValue ?? environmentValue ?? inspected?.defaultValue ?? fallback
  if (typeof value !== "string") {
    throw new ConfigurationBoundaryError(`GAEP for Kiro requires gaepKiro.${key} to be a machine-scoped string.`)
  }
  return value
}

function hasWorkspaceOverride(inspected: ReturnType<vscode.WorkspaceConfiguration["inspect"]>): boolean {
  if (!inspected) return false
  const candidate = inspected as unknown as Record<string, unknown>
  return ["workspaceValue", "workspaceFolderValue", "workspaceLanguageValue", "workspaceFolderLanguageValue"]
    .some((name) => candidate[name] !== undefined)
}

async function runUserCommand<T>(operation: () => Promise<T>): Promise<T | undefined> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof WorkflowCancelled || error instanceof InitiativeEntryWorkflowCancelled) return undefined
    if (error instanceof GaepHostError || error instanceof ConfigurationBoundaryError ||
      error instanceof TypeError || error instanceof RangeError) {
      await vscode.window.showErrorMessage(error.message)
      return undefined
    }
    await vscode.window.showErrorMessage(
      "GAEP for Kiro could not complete the local request. No raw engine output or provider state was shown.",
    )
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]!)
}
