import { randomBytes } from "node:crypto"
import { join } from "node:path"

import * as vscode from "vscode"

import { GaepEngineClient } from "./engine-client.js"
import {
  GaepHostError,
  normalizeActorId,
  normalizeExistingLocalFolder,
  normalizeUuid,
  validatePage,
  type AgentHandoff,
  type AgentReadinessSnapshot,
  type AgentRun,
  type AgentSelection,
  type AgentSelectionSetting,
  type ManagedReadOnlyPreview,
  type ManagedReadOnlyReceipt,
  type ManagedEvidenceDetail,
  type ManagedRunSummaryPage,
  type ManagedReviewPreview,
  type ManagedReviewTransition,
  type PortableAgentSettingValue,
  type PortableDesignSnapshotPage,
  type PortableDesignSnapshotSummary,
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
    <h2>Portable design</h2>
    <p>Use the Kiro Command Palette to import one local bundle folder, list metadata pages, or read one exact snapshot by UUID.</p>
    <p>Files, archives, <code>.fig</code> ingestion, OAuth, network fetches, and live design-tool accounts are not supported.</p>
  </section>
  <section>
    <h2>Codex and Claude</h2>
    <p>Use the Kiro Command Palette to observe verified local readiness, record one guarded portable Agent Selection, or create a versioned switch handoff from the latest terminal Run.</p>
    <p>Selection and handoff records are configuration and history only. The separate managed read-only command can run one exact, already-confirmed Charter and Workflow Plan after a digest-bound human attestation. It denies every Tool, write, and non-observation effect, uses a bounded timeout, and withholds success if staged changes appear.</p>
    <p>The Managed Run evidence command shows an audit-gated, snapshot-bound page of at most 100 runs and one exact verified detail. It displays portable states, counts, digests and timestamps only; it cannot apply, discard, resume, approve, or infer success.</p>
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
      await vscode.window.showInformationMessage("No Managed Runs exist in the verified bounded inventory.")
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
    if (error instanceof WorkflowCancelled) return undefined
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
