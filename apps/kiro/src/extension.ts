import { randomBytes } from "node:crypto"

import * as vscode from "vscode"

import { GaepEngineClient } from "./engine-client.js"
import {
  GaepHostError,
  normalizeActorId,
  normalizeExistingLocalFolder,
  normalizeUuid,
  validatePage,
  type AgentReadinessSnapshot,
  type AgentSelection,
  type AgentSelectionSetting,
  type PortableAgentSettingValue,
  type PortableDesignSnapshotPage,
  type PortableDesignSnapshotSummary,
  type ProductBinding,
} from "./protocol.js"

const productStudioViewType = "gaepKiro.productStudio"
const commandIds = {
  open: "gaepKiro.openProductStudio",
  readiness: "gaepKiro.agents.readiness",
  selectAgent: "gaepKiro.agents.select",
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

  async get(workspacePath: string): Promise<GaepEngineClient> {
    const executable = machineSetting("engineExecutable", "GAEP_ENGINE_EXECUTABLE", "gaep-engine")
    const digest = machineSetting("engineSha256", "GAEP_ENGINE_SHA256", "")
    const signature = JSON.stringify([executable, digest])
    const current = this.clients.get(workspacePath)
    if (current?.signature === signature) return current.client
    if (current) await current.client.dispose()
    const client = await GaepEngineClient.create({
      workspacePath,
      engineExecutable: executable,
      ...(digest ? { expectedEngineSha256: digest } : {}),
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
  const pool = new EngineClientPool()
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
    <p>Use the Kiro Command Palette to observe verified local readiness or record one guarded, portable Agent Selection.</p>
    <p>Selection records configuration only. It does not start a provider, resume work, approve tools or effects, create a Run, or grant execution authority. Active Runs, capability drift, legacy state, invalid state, and post-Run changes fail closed.</p>
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
      title: "Select one verified local agent adapter",
      placeHolder: "Selection records portable configuration only; it does not start an agent",
      ignoreFocusOut: true,
    },
  )
  if (!adapter) throw new WorkflowCancelled()

  const model = await selectAgentModel(adapter.snapshot)
  const settings = await collectAgentSettings(adapter.snapshot.settings)
  const actorId = normalizeActorId(machineSetting("actorId", undefined, "gaep.kiro-local-human"))
  const prior = current.status === "selected"
    ? ` Current selection: ${current.selection.agentId} / ${current.selection.modelId}.`
    : ""
  const confirmation = await vscode.window.showWarningMessage(
    `Record ${adapter.snapshot.agentLabel} / ${model} with ${Object.keys(settings).length} explicit portable setting${Object.keys(settings).length === 1 ? "" : "s"}?${prior} This does not start a provider, create or resume a Run, approve tools or effects, or grant execution authority. The engine will reject active-Run, capability-drift, legacy, invalid, and post-Run changes that require a handoff.`,
    { modal: true },
    "Confirm Selection",
  )
  if (confirmation !== "Confirm Selection") throw new WorkflowCancelled()
  requireTrustedWorkspace()
  const selected = await client.selectAgent({
    adapterId: adapter.snapshot.adapterId,
    modelId: model,
    settings,
    actorId,
  })
  await showAgentSelectionDocument(selected)
  await vscode.window.showInformationMessage(
    `Recorded ${selected.agentId} / ${selected.modelId} as portable Agent Selection. No agent was started and no Run authority was granted.`,
  )
  return selected
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
