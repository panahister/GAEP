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
  type PortableDesignSnapshotPage,
  type PortableDesignSnapshotSummary,
  type ProductBinding,
} from "./protocol.js"

const productStudioViewType = "gaepKiro.productStudio"
const commandIds = {
  open: "gaepKiro.openProductStudio",
  readiness: "gaepKiro.agents.readiness",
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
    <h2>Codex and Claude readiness</h2>
    <p>Use the Kiro Command Palette to observe verified local adapter, runtime, model, and capability metadata.</p>
    <p>This view is observation-only. It cannot select a model, change settings, start an agent, resume work, or grant execution authority.</p>
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
