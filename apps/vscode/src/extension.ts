import { randomUUID } from "node:crypto"
import { lstat, readdir } from "node:fs/promises"
import { join } from "node:path"

import { CodexAdapter } from "@gaep/adapter-codex"
import { ClaudeAdapter } from "@gaep/adapter-claude"
import {
  capabilityDigest,
  canonicalDigest,
  fingerprintExecutable,
  type AdapterProbeResult,
  type ExecutableFingerprint,
} from "@gaep/agent-sdk"
import {
  containsSecretShapedValue,
  productProfileSchema,
  type AdapterCapabilities,
  type AgentSetting,
  type Initiative,
  type ToolPermission,
} from "@gaep/contracts"
import { GaepEngine, initiativeTransitions } from "@gaep/engine"
import * as vscode from "vscode"

import { ActiveRunRegistry } from "./run-registry.js"
import { CurrentEngineStudioDataSource } from "./current-engine-studio-data-source.js"
import { resolveLocalActorPrincipal } from "./local-actor.js"
import {
  resolveRuntimeBinding,
  runtimeBindingKey,
  sameExecutableFingerprint,
  verifiedExecutableBinding,
  type RuntimeBinding,
  type RuntimeBindingIndex,
} from "./runtime-binding.js"
import { AgentRunTerminal } from "./run-terminal.js"
import {
  constrainedSetting,
  currentInitiative,
  initiativeRunEligibility,
  machineScopedSettingValue,
  unsafeSelectionReasons,
} from "./safety.js"
import { GaepTreeProvider, readInitiatives, type GaepViewContext } from "./tree.js"
import { StudioProvider } from "./studio-provider.js"
import {
  isStudioAction,
  isStudioRoute,
  studioDomainWorkflows,
  studioRouteLabels,
  studioRoutes,
  type StudioAction,
  type StudioDomainWorkflow,
} from "./studio-protocol.js"

const selectedWorkspaceKey = "gaep.selectedWorkspaceUri"
const runtimeBindingsKey = "gaep.runtimeBindings.v2"
const legacyRuntimeBindingsKey = "gaep.runtimeBindings.v1"
const activeAgentRuns = new ActiveRunRegistry()
const productProfiles = [
  "software",
  "saas",
  "ai-enabled",
  "integration",
  "security-sensitive",
  "data-sensitive",
  "internal-tool",
  "mobile",
] as const

class WorkflowCancelled extends Error {
  constructor() {
    super("GAEP workflow cancelled")
  }
}

async function requiredInput(prompt: string, options: vscode.InputBoxOptions = {}): Promise<string> {
  const value = await vscode.window.showInputBox({ prompt, ignoreFocusOut: true, ...options })
  if (!value?.trim()) throw new WorkflowCancelled()
  return value.trim()
}

async function collectSetting(setting: AgentSetting): Promise<unknown> {
  if (setting.kind === "select" && setting.options) {
    if (setting.options.length === 0) throw new Error(`${setting.label} has no safe supported option`)
    const selected = await vscode.window.showQuickPick(
      setting.options.map((option) => ({ label: option.label, description: option.description, value: option.value })),
      { title: setting.label, placeHolder: setting.description, ignoreFocusOut: true },
    )
    if (!selected) throw new WorkflowCancelled()
    return selected.value
  }
  if (setting.kind === "boolean") {
    const selected = await vscode.window.showQuickPick(
      [{ label: "Enabled", value: true }, { label: "Disabled", value: false }],
      { title: setting.label, placeHolder: setting.description, ignoreFocusOut: true },
    )
    if (!selected) throw new WorkflowCancelled()
    return selected.value
  }
  const value = await vscode.window.showInputBox({
    title: setting.label,
    prompt: setting.description,
    value: typeof setting.defaultValue === "string" ? setting.defaultValue : undefined,
    password: setting.sensitive,
    ignoreFocusOut: true,
    validateInput: setting.kind === "number"
      ? (candidate) => {
          if (!candidate.trim() && !setting.required) return undefined
          const number = Number(candidate)
          if (!Number.isFinite(number)) return "Enter a finite number"
          if (setting.minimum !== undefined && number < setting.minimum) return `Minimum: ${setting.minimum}`
          if (setting.maximum !== undefined && number > setting.maximum) return `Maximum: ${setting.maximum}`
          return undefined
        }
      : undefined,
  })
  if (value === undefined) throw new WorkflowCancelled()
  if (value.trim() === "") {
    if (setting.required && setting.defaultValue === undefined) throw new Error(`${setting.label} is required`)
    return setting.defaultValue
  }
  if (setting.kind === "number") return Number(value)
  if (setting.kind === "string-list") return value.split(",").map((item) => item.trim()).filter(Boolean)
  return value.trim()
}

async function chooseModel(capabilities: AdapterCapabilities): Promise<string> {
  const custom = { label: "Enter model identifier...", description: "Use a model accepted by the installed agent", id: "" }
  const picked = await vscode.window.showQuickPick(
    [
      ...capabilities.models.map((model) => ({
        label: model.label,
        description: `${model.id}${model.alias ? " (provider alias)" : ""}`,
        detail: model.description,
        id: model.id,
      })),
      custom,
    ],
    { title: `Select ${capabilities.agentLabel} model`, ignoreFocusOut: true },
  )
  if (!picked) throw new WorkflowCancelled()
  return picked.id || requiredInput("Enter the exact model identifier")
}

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false
    // Fail closed: inaccessible or indeterminate state must never be treated as safe-to-initialize absence.
    return true
  }
}

function machineSetting(key: "codex.executable" | "claude.executable", fallback: string): string {
  const inspected = vscode.workspace.getConfiguration("gaep").inspect<string>(key)
  return machineScopedSettingValue(inspected, fallback)
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const diagnostics = vscode.window.createOutputChannel("GAEP Diagnostics", { log: true })
  const localActor = await resolveLocalActorPrincipal(context.globalState)
  const actorId = localActor.id
  let selectedFolder: vscode.WorkspaceFolder | undefined
  let engine: GaepEngine | undefined
  let recoveryDiagnostic: string | undefined
  let gaepWatcher: vscode.FileSystemWatcher | undefined
  let refreshTimer: NodeJS.Timeout | undefined
  let lastStatusDiagnostic: string | undefined
  let studioProvider: StudioProvider | undefined
  let studioContextGeneration = randomUUID()
  let productDomainMutationActive = false
  const productDomainMutationWaiters = new Set<() => void>()

  const rotateStudioContext = (): void => {
    studioContextGeneration = randomUUID()
  }

  const waitForProductDomainMutation = (): Promise<void> => productDomainMutationActive
    ? new Promise((resolve) => productDomainMutationWaiters.add(resolve))
    : Promise.resolve()

  const withProductDomainMutation = async <T>(operation: () => Promise<T>): Promise<T> => {
    if (productDomainMutationActive) throw new Error("Another Product-domain mutation is already completing")
    productDomainMutationActive = true
    try {
      return await operation()
    } finally {
      productDomainMutationActive = false
      for (const resolve of productDomainMutationWaiters) resolve()
      productDomainMutationWaiters.clear()
    }
  }

  const runtimeBindings = (): RuntimeBindingIndex => ({
    ...(context.globalState.get<RuntimeBindingIndex>(legacyRuntimeBindingsKey) ?? {}),
    ...(context.globalState.get<RuntimeBindingIndex>(runtimeBindingsKey) ?? {}),
  })

  const rememberRuntimeBinding = async (
    workspacePath: string,
    probe: AdapterProbeResult,
  ): Promise<ExecutableFingerprint> => {
    const { capabilities, runtimeBinding } = probe
    if (!capabilities.detected || runtimeBinding.kind !== "executable") {
      throw new Error("The selected agent has no verified executable binding")
    }
    if (
      runtimeBinding.adapterId !== capabilities.adapterId ||
      runtimeBinding.agentId !== capabilities.agentId
    ) {
      throw new Error("The selected agent probe returned an inconsistent machine-local binding")
    }
    const fingerprint = await fingerprintExecutable(runtimeBinding.executablePath)
    if (!sameExecutableFingerprint(fingerprint, runtimeBinding.executableFingerprint)) {
      throw new Error("The selected agent executable changed before its machine-local binding could be recorded")
    }
    const record: RuntimeBinding = {
      schemaVersion: 2,
      scope: "machine-local",
      kind: "executable",
      adapterId: capabilities.adapterId,
      agentId: capabilities.agentId,
      capabilityDigest: capabilityDigest(capabilities),
      executable: fingerprint,
      observedAt: new Date().toISOString(),
    }
    const next = {
      ...(context.globalState.get<RuntimeBindingIndex>(runtimeBindingsKey) ?? {}),
      [runtimeBindingKey(workspacePath, capabilities.adapterId)]: record,
    }
    await context.globalState.update(runtimeBindingsKey, next)
    return fingerprint
  }

  const logDiagnostic = (message: string, error?: unknown): void => {
    const detail = error instanceof Error ? `${message}: ${error.message}` : message
    diagnostics.error(detail)
  }

  const viewContext = (): GaepViewContext => ({
    workspacePath: selectedFolder?.uri.fsPath,
    workspaceName: selectedFolder?.name,
    trusted: vscode.workspace.isTrusted,
    recoveryDiagnostic,
  })
  const providers = [
    new GaepTreeProvider(viewContext, "product"),
    new GaepTreeProvider(viewContext, "agent"),
    new GaepTreeProvider(viewContext, "governance"),
    new GaepTreeProvider(viewContext, "runs"),
  ] as const
  context.subscriptions.push(
    diagnostics,
    vscode.window.registerTreeDataProvider("gaep.overview", providers[0]),
    vscode.window.registerTreeDataProvider("gaep.agent", providers[1]),
    vscode.window.registerTreeDataProvider("gaep.governance", providers[2]),
    vscode.window.registerTreeDataProvider("gaep.runs", providers[3]),
  )

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 40)
  status.name = "GAEP Context"
  context.subscriptions.push(status)

  const refreshStatus = async (): Promise<void> => {
    if (!vscode.workspace.isTrusted) {
      status.text = "$(lock) GAEP | Workspace untrusted"
      status.tooltip = "Trust the workspace before GAEP reads Product state, probes an agent, or starts a process."
      status.command = "gaep.manageWorkspaceTrust"
      status.show()
      return
    }
    if (!selectedFolder || !engine) {
      status.text = "$(root-folder) GAEP | Select Product Root"
      status.tooltip = "Select which workspace folder owns the GAEP Product."
      status.command = "gaep.selectWorkspaceRoot"
      status.show()
      return
    }
    if (recoveryDiagnostic) {
      status.text = "$(error) GAEP | Recovery blocked | 1 blocker"
      status.tooltip = recoveryDiagnostic
      status.command = "gaep.showDiagnostics"
      status.show()
      return
    }
    try {
      const product = await engine.readProduct()
      let agent = "no agent"
      let model = "no model"
      let selectionBlockers = 0
      try {
        const selection = await engine.readSelection()
        agent = selection.agentId
        model = selection.modelId
        selectionBlockers = unsafeSelectionReasons(selection.agentId, selection.settings).length > 0 ? 1 : 0
      } catch {
        selectionBlockers = 1
      }
      const initiatives = await readInitiatives(selectedFolder.uri.fsPath)
      const initiative = currentInitiative(initiatives)
      const runs = await engine.listRuns()
      const audit = await engine.repository.verifyAudit()
      const blockers = selectionBlockers +
        initiatives.filter((item) => item.state === "blocked").length +
        runs.filter((run) => run.state === "unknown").length +
        (audit.valid ? 0 : 1)
      status.text = `$(shield) GAEP | ${product.name} | ${agent} | ${model} | ${initiative?.state ?? "no initiative"} | ${blockers} blocker${blockers === 1 ? "" : "s"}`
      status.tooltip = [
        `Product: ${product.name}`,
        `Agent/model: ${agent} / ${model}`,
        `Initiative: ${initiative ? `${initiative.title} (${initiative.state})` : "none"}`,
        `Blockers: ${blockers}`,
      ].join("\n")
      status.command = "gaep.refresh"
      status.show()
      lastStatusDiagnostic = undefined
    } catch (error) {
      const gaepRootExists = await exists(join(selectedFolder.uri.fsPath, ".gaep"))
      const message = error instanceof Error ? error.message : "Product is not initialized"
      if (gaepRootExists && message !== lastStatusDiagnostic) {
        logDiagnostic("Product state inspection failed", error)
        lastStatusDiagnostic = message
      }
      status.text = gaepRootExists ? "$(warning) GAEP | Product state needs attention" : "$(shield) GAEP | Initialize Product"
      status.tooltip = message
      status.command = gaepRootExists ? "gaep.showDiagnostics" : "gaep.initializeProduct"
      status.show()
    }
  }

  const refresh = (): void => {
    providers.forEach((provider) => provider.refresh())
    void refreshStatus()
    void studioProvider?.refresh().catch((error) => logDiagnostic("Product Studio refresh failed", error))
  }
  const scheduleRefresh = (): void => {
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = setTimeout(refresh, 100)
  }

  const configureWatcher = (folder: vscode.WorkspaceFolder): void => {
    gaepWatcher?.dispose()
    gaepWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, ".gaep/**/*"))
    gaepWatcher.onDidCreate(scheduleRefresh)
    gaepWatcher.onDidChange(scheduleRefresh)
    gaepWatcher.onDidDelete(scheduleRefresh)
  }
  context.subscriptions.push({
    dispose: () => {
      gaepWatcher?.dispose()
      if (refreshTimer) clearTimeout(refreshTimer)
    },
  })

  const stopActiveRuns = async (reason: string, requireConfirmation: boolean): Promise<void> => {
    if (activeAgentRuns.size === 0) return
    const runIds = activeAgentRuns.list().map((run) => run.runId)
    if (requireConfirmation) {
      const accepted = await vscode.window.showWarningMessage(
        `${reason} GAEP must first stop and confirm exit for ${runIds.length} active provider process${runIds.length === 1 ? "" : "es"}.`,
        { modal: true },
        "Stop Runs and Continue",
      )
      if (accepted !== "Stop Runs and Continue") throw new WorkflowCancelled()
    }
    diagnostics.warn(`${reason} Stopping active run(s): ${runIds.join(", ")}`)
    const stopped = await activeAgentRuns.stopAll(10_000)
    if (stopped.failures.length > 0 || stopped.remainingRunIds.length > 0) {
      const failures = stopped.failures.map((failure) => `${failure.runId}: ${failure.error}`).join("; ")
      throw new Error(
        `GAEP could not confirm every provider process exited; root and runtime state were preserved. ${failures || `Still active: ${stopped.remainingRunIds.join(", ")}`}`,
      )
    }
  }

  const configureRoot = async (folder: vscode.WorkspaceFolder, recover: boolean): Promise<void> => {
    if (productDomainMutationActive) throw new Error("GAEP cannot replace its Product root while a Product-domain mutation is completing")
    if (activeAgentRuns.size > 0) {
      throw new Error("GAEP cannot replace its Product root or runtime configuration while a provider process remains active")
    }
    rotateStudioContext()
    selectedFolder = folder
    recoveryDiagnostic = undefined
    lastStatusDiagnostic = undefined
    engine = new GaepEngine(folder.uri.fsPath, [
      new CodexAdapter(machineSetting("codex.executable", "codex")),
      new ClaudeAdapter(machineSetting("claude.executable", "claude")),
    ])
    configureWatcher(folder)
    await context.workspaceState.update(selectedWorkspaceKey, folder.uri.toString())
    diagnostics.info(`Selected Product root: ${folder.uri.fsPath}`)
    if (recover && vscode.workspace.isTrusted) {
      try {
        const recovered = await engine.recoverInterruptedRuns("gaep.vscode.restart")
        if (recovered.length > 0) diagnostics.warn(`Recovered ${recovered.length} interrupted run(s) as unknown.`)
      } catch (error) {
        recoveryDiagnostic = error instanceof Error ? error.message : "Unknown recovery failure"
        logDiagnostic("Interrupted-run recovery failed; GAEP remains in diagnostic mode", error)
      }
    }
    refresh()
  }

  const initialRoot = async (): Promise<vscode.WorkspaceFolder | undefined> => {
    const folders = vscode.workspace.workspaceFolders ?? []
    if (folders.length === 1) return folders[0]
    const stored = context.workspaceState.get<string>(selectedWorkspaceKey)
    const remembered = folders.find((folder) => folder.uri.toString() === stored)
    if (remembered) return remembered
    const initialized: vscode.WorkspaceFolder[] = []
    for (const folder of folders) {
      if (await exists(join(folder.uri.fsPath, ".gaep"))) initialized.push(folder)
    }
    return initialized.length === 1 ? initialized[0] : undefined
  }

  const selectWorkspaceRoot = async (): Promise<void> => {
    if (!vscode.workspace.isTrusted) throw new Error("Trust the workspace before selecting a GAEP Product root")
    const folders = vscode.workspace.workspaceFolders ?? []
    if (folders.length === 0) throw new Error("Open a workspace folder before using GAEP")
    const choices = await Promise.all(folders.map(async (folder) => ({
      label: folder.name,
      description: await exists(join(folder.uri.fsPath, ".gaep")) ? "GAEP state detected" : "not initialized",
      detail: folder.uri.fsPath,
      folder,
    })))
    const picked = await vscode.window.showQuickPick(choices, {
      title: "Select the workspace folder that owns the GAEP Product",
      ignoreFocusOut: true,
    })
    if (!picked) throw new WorkflowCancelled()
    if (selectedFolder?.uri.toString() === picked.folder.uri.toString()) {
      refresh()
      return
    }
    await stopActiveRuns("Changing the selected Product root will replace the current GAEP runtime context.", true)
    await configureRoot(picked.folder, true)
  }

  const requireRuntime = async (): Promise<{ engine: GaepEngine; path: string }> => {
    if (!vscode.workspace.isTrusted) throw new Error("Trust the workspace before GAEP can inspect agents or change Product state")
    if (!selectedFolder || !engine) await selectWorkspaceRoot()
    if (!selectedFolder || !engine) throw new Error("Select a GAEP Product root")
    if (recoveryDiagnostic) throw new Error(`GAEP recovery is blocked: ${recoveryDiagnostic}`)
    return { engine, path: selectedFolder.uri.fsPath }
  }

  const probeAdaptersResilient = async (runtimeEngine: GaepEngine): Promise<AdapterProbeResult[]> => {
    const outcomes = await Promise.all([...runtimeEngine.adapters.values()].map(async (adapter) => {
      try {
        return await adapter.probe({ refreshModels: true })
      } catch (error) {
        logDiagnostic(`Agent probe failed for ${adapter.id}`, error)
        return undefined
      }
    }))
    return outcomes.filter((outcome): outcome is AdapterProbeResult => outcome !== undefined)
  }

  const safely = (operation: () => Promise<void>): (() => Promise<void>) => async () => {
    try {
      await operation()
    } catch (error) {
      if (error instanceof WorkflowCancelled) return
      const message = error instanceof Error ? error.message : "Unknown GAEP failure"
      logDiagnostic("Command failed", error)
      await vscode.window.showErrorMessage(message, "Show Diagnostics").then((selected) => {
        if (selected === "Show Diagnostics") diagnostics.show(true)
      })
    }
  }

  const studioDataSource = new CurrentEngineStudioDataSource({
    contextGeneration: () => studioContextGeneration,
    trusted: () => vscode.workspace.isTrusted,
    workspace: () => selectedFolder ? { name: selectedFolder.name, path: selectedFolder.uri.fsPath } : undefined,
    engine: () => engine,
    recoveryDiagnostic: () => recoveryDiagnostic,
    hasGaepState: async () => selectedFolder ? exists(join(selectedFolder.uri.fsPath, ".gaep")) : false,
    listInitiatives: async () => selectedFolder ? readInitiatives(selectedFolder.uri.fsPath) : [],
    probeAgents: async () => engine
      ? (await probeAdaptersResilient(engine)).map((probe) => probe.capabilities)
      : [],
    runtimeBindings,
    actorId: () => actorId,
    executeCommand: (expectedContextGeneration, command, ...args) => {
      if (expectedContextGeneration !== studioContextGeneration) {
        throw new Error("The Product Studio context changed before the native workflow could start")
      }
      return vscode.commands.executeCommand(command, ...args)
    },
    logDiagnostic,
  })
  studioProvider = new StudioProvider(context.extensionUri, studioDataSource, logDiagnostic)
  context.subscriptions.push(
    studioProvider,
    vscode.window.registerWebviewPanelSerializer(StudioProvider.viewType, studioProvider),
    vscode.commands.registerCommand("gaep.openProductStudio", async (route?: unknown) => {
      await studioProvider?.open(isStudioRoute(route) ? route : "overview")
    }),
  )

  type DomainWorkflowAction = Extract<StudioAction, { kind: "domain-workflow" }>
  const domainInputDrafts = new Map<string, Record<string, unknown>>()
  const recordLimit = 200
  const instructionSourcePlaceholderDigest = canonicalDigest("replace-with-reviewed-instruction-source")

  const cloneStructured = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

  const summarizeStructured = (value: unknown): string => {
    if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`
    if (value && typeof value === "object") return `${Object.keys(value).length} field${Object.keys(value).length === 1 ? "" : "s"}`
    if (typeof value === "string") return value.length > 100 ? `${value.slice(0, 97)}...` : value || "empty string"
    return String(value)
  }

  const editStructuredValue = async (value: unknown, path: string): Promise<unknown> => {
    if (Array.isArray(value)) {
      const current = cloneStructured(value)
      while (true) {
        const picked = await vscode.window.showQuickPick([
          { label: "$(check) Done", description: summarizeStructured(current), operation: "done" as const },
          { label: "$(add) Add item", description: "Add a typed array item", operation: "add" as const },
          ...current.map((entry, index) => ({
            label: `${index + 1}. ${summarizeStructured(entry)}`,
            description: Array.isArray(entry) ? "array" : entry === null ? "null" : typeof entry,
            operation: "edit" as const,
            index,
          })),
        ], { title: `${path} — edit ordered items`, ignoreFocusOut: true })
        if (!picked) throw new WorkflowCancelled()
        if (picked.operation === "done") return current
        if (picked.operation === "add") {
          const type = await vscode.window.showQuickPick(["string", "object", "number", "boolean"], {
            title: `${path} — new item type`,
            ignoreFocusOut: true,
          })
          if (!type) throw new WorkflowCancelled()
          const seed: unknown = type === "object" ? {} : type === "number" ? 0 : type === "boolean" ? false : ""
          current.push(await editStructuredValue(seed, `${path}[${current.length}]`))
          continue
        }
        const selectedIndex = picked.index
        const operation = await vscode.window.showQuickPick([
          { label: "Edit item", operation: "edit" as const },
          { label: "Remove item", operation: "remove" as const },
          { label: "Move item up", operation: "up" as const },
          { label: "Move item down", operation: "down" as const },
        ], { title: `${path}[${selectedIndex}]`, ignoreFocusOut: true })
        if (!operation) throw new WorkflowCancelled()
        if (operation.operation === "remove") current.splice(selectedIndex, 1)
        else if (operation.operation === "up" && selectedIndex > 0) {
          const [entry] = current.splice(selectedIndex, 1)
          current.splice(selectedIndex - 1, 0, entry)
        } else if (operation.operation === "down" && selectedIndex < current.length - 1) {
          const [entry] = current.splice(selectedIndex, 1)
          current.splice(selectedIndex + 1, 0, entry)
        } else if (operation.operation === "edit") {
          current[selectedIndex] = await editStructuredValue(current[selectedIndex], `${path}[${selectedIndex}]`)
        }
      }
    }
    if (value && typeof value === "object") {
      const current = cloneStructured(value as Record<string, unknown>)
      while (true) {
        const picked = await vscode.window.showQuickPick([
          { label: "$(check) Done", description: summarizeStructured(current), operation: "done" as const },
          { label: "$(add) Add optional field", description: "Add a typed field that is not present", operation: "add" as const },
          ...Object.entries(current).map(([key, entry]) => ({
            label: key,
            description: summarizeStructured(entry),
            detail: Array.isArray(entry) ? "array" : entry === null ? "null" : typeof entry,
            operation: "edit" as const,
            key,
          })),
        ], { title: `${path} — edit structured fields`, ignoreFocusOut: true })
        if (!picked) throw new WorkflowCancelled()
        if (picked.operation === "done") return current
        if (picked.operation === "add") {
          const key = await requiredInput(`${path}: optional field name`)
          if (Object.hasOwn(current, key)) {
            await vscode.window.showWarningMessage(`${key} already exists in ${path}`)
            continue
          }
          const type = await vscode.window.showQuickPick(["string", "object", "array", "number", "boolean"], {
            title: `${path}.${key} — field type`,
            ignoreFocusOut: true,
          })
          if (!type) throw new WorkflowCancelled()
          const seed: unknown = type === "object" ? {} : type === "array" ? [] : type === "number" ? 0 : type === "boolean" ? false : ""
          current[key] = await editStructuredValue(seed, `${path}.${key}`)
          continue
        }
        const selectedKey = picked.key
        const operation = await vscode.window.showQuickPick([
          { label: "Edit field", operation: "edit" as const },
          { label: "Remove optional field", operation: "remove" as const },
        ], { title: `${path}.${selectedKey}`, ignoreFocusOut: true })
        if (!operation) throw new WorkflowCancelled()
        if (operation.operation === "remove") delete current[selectedKey]
        else current[selectedKey] = await editStructuredValue(current[selectedKey], `${path}.${selectedKey}`)
      }
    }
    if (typeof value === "boolean") {
      const picked = await vscode.window.showQuickPick([
        { label: "True", value: true },
        { label: "False", value: false },
      ], { title: path, ignoreFocusOut: true })
      if (!picked) throw new WorkflowCancelled()
      return picked.value
    }
    if (typeof value === "number") {
      const input = await requiredInput(path, {
        value: String(value),
        validateInput: (candidate) => Number.isFinite(Number(candidate)) ? undefined : "Enter a finite number",
      })
      return Number(input)
    }
    return requiredInput(path, { value: typeof value === "string" ? value : "" })
  }

  const collectStructuredObject = async (
    draftKey: string,
    title: string,
    template: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    let current = cloneStructured(domainInputDrafts.get(draftKey) ?? template)
    while (true) {
      const picked = await vscode.window.showQuickPick([
        { label: "$(check) Validate and continue", description: summarizeStructured(current), operation: "submit" as const },
        ...Object.entries(current).map(([key, value]) => ({
          label: key,
          description: summarizeStructured(value),
          detail: Array.isArray(value) ? "array" : value === null ? "null" : typeof value,
          operation: "edit" as const,
          key,
        })),
        { label: "$(add) Add optional field", description: "Add a field supported by the governed contract", operation: "add" as const },
        { label: "$(discard) Reset this session draft", description: "Restore the engine-derived template", operation: "reset" as const },
      ], { title: `${title} — structured editor`, placeHolder: "Choose a field; no JSON editing is required", ignoreFocusOut: true })
      if (!picked) throw new WorkflowCancelled()
      if (picked.operation === "submit") {
        if (containsSecretShapedValue(current)) {
          domainInputDrafts.delete(draftKey)
          throw new Error("Portable Product-domain input contains a secret-shaped value and was not retained")
        }
        if (JSON.stringify(current).length > 8 * 1024 * 1024) {
          domainInputDrafts.delete(draftKey)
          throw new Error("Product Studio input exceeds the 8 MiB local safety limit and was not retained")
        }
        domainInputDrafts.set(draftKey, cloneStructured(current))
        return current
      }
      if (picked.operation === "reset") {
        current = cloneStructured(template)
        domainInputDrafts.set(draftKey, cloneStructured(current))
        continue
      }
      if (picked.operation === "add") {
        current = await editStructuredValue(current, title) as Record<string, unknown>
        domainInputDrafts.set(draftKey, cloneStructured(current))
        continue
      }
      current[picked.key] = await editStructuredValue(current[picked.key], `${title}.${picked.key}`)
      domainInputDrafts.set(draftKey, cloneStructured(current))
    }
  }

  const recordFields = (record: unknown, fields: readonly string[]): Record<string, unknown> => {
    const source = record as Record<string, unknown>
    return Object.fromEntries(fields.flatMap((field) => field in source ? [[field, source[field]]] : []))
  }

  const workflowRecordKind = (workflow: StudioDomainWorkflow): Parameters<GaepEngine["productStudio"]["listDomainPage"]>[0] | undefined => {
    switch (workflow) {
      case "edit-change": return "change"
      case "edit-work-item": return "work-item"
      case "edit-requirement": return "requirement"
      case "edit-decision": return "decision"
      case "edit-risk": return "risk"
      case "edit-architecture": return "architecture-record"
      case "edit-evidence": return "evidence"
      case "edit-context-pack": return "context-pack"
      case "edit-workflow-plan": return "workflow-plan"
      case "edit-tool-definition": return "tool-definition"
      case "edit-run-tool-selection": return "run-tool-selection"
      case "reassess-trace-link": return "trace-link"
      case "revoke-instruction-privilege-grant": return "instruction-privilege-grant"
      default: return undefined
    }
  }

  const readDomainRecord = async (
    workflow: StudioDomainWorkflow,
    runtimeEngine: GaepEngine,
    id: string,
  ): Promise<unknown> => {
    const studio = runtimeEngine.productStudio
    switch (workflow) {
      case "edit-change": return studio.readChange(id)
      case "edit-work-item": return studio.readWorkItem(id)
      case "edit-requirement": return studio.readRequirement(id)
      case "edit-decision": return studio.readDecision(id)
      case "edit-risk": return studio.readRisk(id)
      case "edit-architecture": return studio.readArchitectureRecord(id)
      case "edit-evidence": return studio.readEvidence(id)
      case "edit-context-pack": return studio.readContextPack(id)
      case "edit-workflow-plan": return studio.readWorkflowPlan(id)
      case "edit-tool-definition": return studio.readToolDefinition(id)
      case "edit-run-tool-selection": return studio.readRunToolSelection(id)
      case "reassess-trace-link": return studio.readTraceLink(id)
      case "revoke-instruction-privilege-grant": return studio.readInstructionPrivilegeGrant(id)
      default: throw new Error(`No direct Product-domain reader is available for ${workflow}`)
    }
  }

  const readDomainRecords = async (
    workflow: StudioDomainWorkflow,
    runtimeEngine: GaepEngine,
  ): Promise<{ records: unknown[]; total: number }> => {
    const kind = workflowRecordKind(workflow)
    if (!kind) return { records: [], total: 0 }
    const page = await runtimeEngine.productStudio.listDomainPage(kind, { offset: 0, limit: recordLimit })
    return { records: page.items, total: page.total }
  }

  const mutableDomainInput = (workflow: StudioDomainWorkflow, record: Record<string, unknown>): Record<string, unknown> => {
    switch (workflow) {
      case "edit-change": return recordFields(record, ["title", "summary", "baseline", "state", "effectEnvelope"])
      case "edit-work-item": return recordFields(record, ["title", "objective", "state", "dependsOn", "completionCriteria", "evidenceCriteria", "scope", "owner"])
      case "edit-requirement": return recordFields(record, ["key", "statement", "rationale", "priority", "state", "verificationCriteria", "sourceRecords"])
      case "edit-decision": return recordFields(record, ["question", "options", "recommendation", "selectedOutcome", "dissentAndUncertainty", "affectedRecords", "state"])
      case "edit-risk": return recordFields(record, [
        "title", "cause", "condition", "consequence", "likelihood", "impact", "uncertainty", "treatment", "owner",
        "reviewTriggers", "residualRisk", "evidence", "state", "acceptance",
      ])
      case "edit-architecture": return recordFields(record, ["recordType", "title", "description", "rationale", "assumptions", "constraints", "affectedRecords", "state"])
      case "edit-evidence": return recordFields(record, ["subjects", "origin", "method", "result", "artifactDigest", "limitations", "verification", "freshness", "collectedAt", "validUntil"])
      case "edit-context-pack": return {
        ...recordFields(record, ["objective", "recipient", "items", "omissions", "warnings", "conflicts"]),
        classificationCombinationRisk: (record.classification as Record<string, unknown> | undefined)?.combinationRisk,
        sufficiencyCriteria: (record.sufficiency as Record<string, unknown> | undefined)?.criteria,
        sufficiencyEvaluator: (record.sufficiency as Record<string, unknown> | undefined)?.evaluator,
        sufficiencyAssumptions: (record.sufficiency as Record<string, unknown> | undefined)?.assumptions,
      }
      case "edit-workflow-plan": return recordFields(record, ["title", "objective", "subject", "actor", "strategy", "contextPacks", "toolDefinitions", "steps", "state"])
      case "edit-tool-definition": return recordFields(record, [
        "definitionType", "key", "name", "binding", "purpose", "inputContract", "outputContract", "allowedScopes",
        "requiredPermissions", "effectEnvelope", "trust", "limitations", "enabled", "policy",
      ])
      case "edit-run-tool-selection": return recordFields(record, ["tools", "requestedEffects", "requestedScopes", "confirmedToolIds"])
      default: return record
    }
  }

  const exactProductReference = async (runtimeEngine: GaepEngine): Promise<Record<string, unknown>> => {
    const product = await runtimeEngine.readProduct()
    const revision = await runtimeEngine.productStudio.readProductRevision(product.revision ?? 1)
    return { recordType: "product", recordId: product.id, revision: revision.revision, digest: revision.productDigest }
  }

  const instructionAuthorityReference = async (runtimeEngine: GaepEngine): Promise<Record<string, unknown>> => {
    const candidates = [
      { kind: "requirement" as const, recordType: "requirement", eligible: new Set(["accepted", "satisfied"]) },
      { kind: "decision" as const, recordType: "decision", eligible: new Set(["decided"]) },
      { kind: "architecture-record" as const, recordType: "architecture", eligible: new Set(["accepted"]) },
    ]
    const choices: Array<{ selectionKind: "record"; label: string; description: string; detail: string; reference: Record<string, unknown> }> = []
    let authorityCorpusTruncated = false
    for (const candidate of candidates) {
      let offset = 0
      while (choices.length < recordLimit) {
        const page = await runtimeEngine.productStudio.listDomainPage(candidate.kind, { offset, limit: recordLimit })
        for (const typedRecord of page.items) {
          const record = typedRecord as Record<string, unknown>
          if (!candidate.eligible.has(String(record.state))) continue
          choices.push({
            selectionKind: "record",
            label: String(record.title ?? record.key ?? record.question ?? record.id),
            description: `${candidate.recordType} · ${String(record.state)} · revision ${String(record.revision)}`,
            detail: String(record.id),
            reference: {
              recordType: candidate.recordType,
              recordId: record.id,
              revision: record.revision,
              digest: canonicalDigest(record),
            },
          })
          if (choices.length >= recordLimit) break
        }
        if (!page.hasMore) break
        offset += page.limit
        if (offset >= 10_000) {
          authorityCorpusTruncated = true
          break
        }
      }
      if (choices.length >= recordLimit) authorityCorpusTruncated = true
    }
    if (choices.length === 0) {
      throw new Error("Create a governed Requirement, Decision, or Architecture record before granting instruction privilege")
    }
    if (authorityCorpusTruncated) {
      await vscode.window.showWarningMessage(
        `The eligible authority picker is bounded to ${choices.length} records and a 10,000-record scan per type. Use Product Studio paging to inspect records outside this boundary.`,
      )
    }
    const selected = await vscode.window.showQuickPick([
      ...choices,
      {
        selectionKind: "exact-id" as const,
        label: "$(search) Use an exact authority record ID",
        description: "Select any eligible current record beyond the bounded picker",
        detail: "The record will be read and validated before review",
      },
    ], {
      title: "Select the exact governed authority for this Instruction Privilege Grant",
      placeHolder: "A grant cannot create its own authority",
      ignoreFocusOut: true,
    })
    if (!selected) throw new WorkflowCancelled()
    if (selected.selectionKind === "record") return selected.reference
    const type = await vscode.window.showQuickPick(candidates.map((candidate) => ({
      label: candidate.recordType,
      candidate,
    })), { title: "Select the exact authority record type", ignoreFocusOut: true })
    if (!type) throw new WorkflowCancelled()
    const id = await requiredInput("Exact current authority record UUID", {
      validateInput: (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
        ? undefined
        : "Enter a valid UUID",
    })
    const record = type.candidate.kind === "requirement"
      ? await runtimeEngine.productStudio.readRequirement(id)
      : type.candidate.kind === "decision"
        ? await runtimeEngine.productStudio.readDecision(id)
        : await runtimeEngine.productStudio.readArchitectureRecord(id)
    if (!type.candidate.eligible.has(record.state)) {
      throw new Error(`${type.candidate.recordType} ${id} is ${record.state}; it is not eligible to authorize instruction privilege`)
    }
    return {
      recordType: type.candidate.recordType,
      recordId: record.id,
      revision: record.revision,
      digest: canonicalDigest(record),
    }
  }

  const createTemplate = async (workflow: StudioDomainWorkflow, runtimeEngine: GaepEngine): Promise<Record<string, unknown>> => {
    const now = new Date().toISOString()
    const productReference = await exactProductReference(runtimeEngine).catch(() => ({
      recordType: "product",
      recordId: "replace-with-product-uuid",
      revision: 1,
      digest: `sha256:${"0".repeat(64)}`,
    }))
    switch (workflow) {
      case "create-change": return {
        initiativeId: "replace-with-initiative-uuid", title: "Bounded change", summary: "Describe the exact change.",
        baseline: { kind: "exact", subjectType: "product", subjectId: productReference.recordId, revision: productReference.revision, digest: productReference.digest },
        effectEnvelope: ["reversible-change"],
      }
      case "create-work-item": return {
        changeId: "replace-with-change-uuid", title: "Bounded work item", objective: "Describe the exact objective.", dependsOn: [],
        completionCriteria: ["An observable completion criterion"], evidenceCriteria: ["Evidence that supports the completion claim"],
        scope: { read: [{ kind: "workspace-relative", path: "." }], write: [], effects: [] }, owner: { kind: "unassigned" },
      }
      case "create-requirement": return {
        key: "GAEP-REQ-001", statement: "A testable requirement statement.", rationale: "Why this requirement matters.", priority: "must",
        verificationCriteria: ["An observable verification criterion"], sourceRecords: [productReference],
      }
      case "create-decision": {
        const first = randomUUID()
        const second = randomUUID()
        return {
          question: "Which bounded option should be selected?",
          options: [
            { id: first, label: "Option A", description: "First bounded option", tradeoffs: ["Document a tradeoff"] },
            { id: second, label: "Option B", description: "Second bounded option", tradeoffs: ["Document a tradeoff"] },
          ],
          recommendation: { optionId: first, rationale: "Why this option is recommended", proposedBy: { kind: "human", id: actorId }, proposedAt: now },
          dissentAndUncertainty: ["Document material uncertainty"], affectedRecords: [productReference],
        }
      }
      case "create-risk": return {
        title: "Material risk", cause: "Describe the cause.", condition: "Describe the condition.", consequence: "Describe the consequence.",
        likelihood: "unknown", impact: "unknown", uncertainty: "What remains uncertain", treatment: "Proposed treatment",
        owner: { kind: "unassigned" }, reviewTriggers: ["A concrete review trigger"], residualRisk: "Describe residual risk", evidence: [],
      }
      case "create-architecture": return {
        recordType: "direction", title: "Architecture direction", description: "Describe the bounded direction.", rationale: "Why this direction applies.",
        assumptions: ["A material assumption"], constraints: ["A material constraint"], affectedRecords: [productReference],
      }
      case "create-evidence": return {
        subjects: [productReference], origin: { kind: "manual-observation", locator: { kind: "logical", value: "manual-observation" }, actor: { kind: "human", id: actorId } },
        method: "Describe how the observation was obtained.", result: { status: "observation", summary: "Describe the observed result." },
        artifactDigest: canonicalDigest("replace-with-artifact-content"), limitations: ["State what this evidence does not prove"],
        verification: { status: "unverified" }, freshness: { status: "unknown", assessedAt: now, basis: "Not independently assessed" }, collectedAt: now,
      }
      case "create-context-pack": {
        const content = "Replace with selected, redacted context content."
        const digest = canonicalDigest(content)
        return {
          objective: "Bounded context objective", recipient: { kind: "human", id: actorId },
          items: [{
            id: randomUUID(), source: { kind: "logical", value: "product-context" }, sourceDigest: digest,
            selectionReason: "Why this context is necessary", required: true, content, contentDigest: digest,
            trust: {
              semanticAuthority: { standing: "advisory", domain: "product", scope: ["bounded objective"] }, epistemicRole: "reference",
              sourceAuthenticity: "unknown", contentIntegrity: "unknown",
              confidentiality: { classification: "internal", purpose: "Bounded Product design", recipients: [actorId], retention: "Local Product lifecycle" },
              instructionPrivilege: "inert-evidence", freshness: { status: "unknown", assessedAt: now, basis: "Not assessed" },
              validity: { status: "unknown", basis: "Not assessed" }, revisionDisposition: "unknown",
              applicability: { status: "unknown", basis: "Not assessed" },
            }, transformations: [],
          }],
          omissions: [], warnings: ["Context sufficiency does not grant authority"], conflicts: [],
          classificationCombinationRisk: "Combination risk requires human review", sufficiencyCriteria: ["Required context is present"],
          sufficiencyEvaluator: { kind: "human", id: actorId }, sufficiencyAssumptions: ["No omitted material dependency"],
        }
      }
      case "create-instruction-privilege-grant": {
        const authority = await instructionAuthorityReference(runtimeEngine)
        return {
          source: { kind: "logical", value: "replace-with-reviewed-instruction-source" },
          sourceDigest: instructionSourcePlaceholderDigest,
          privilege: "governing-instruction",
          purpose: "Describe the exact purpose for which these instructions may be followed.",
          recipient: { kind: "agent", id: "replace-with-exact-agent-id" },
          scope: ["Describe the exact bounded instruction scope"],
          authority,
        }
      }
      case "create-workflow-plan": return {
        title: "Bounded workflow plan", objective: "Describe the workflow objective.", subject: productReference,
        actor: { kind: "human", id: actorId }, strategy: "sequential", contextPacks: [], toolDefinitions: [],
        steps: [{
          id: randomUUID(), title: "First bounded step", objective: "Describe this step.", responsibility: { kind: "human", id: actorId },
          contextPacks: [], toolDefinitions: [], dependsOn: [], preconditions: ["A concrete precondition"], outputs: ["A concrete output"],
          evidenceCriteria: ["A concrete evidence criterion"], retry: { maxAttempts: 1, backoffMs: 0, retryOn: [] },
          stopConditions: ["Required authority or context is missing"], scope: { read: [], write: [], effects: [] }, effectEnvelope: ["observe"],
        }],
      }
      case "create-tool-definition": return {
        definitionType: "tool", key: "example-tool", name: "Example Tool", binding: { toolName: "example-tool" },
        purpose: "Describe the bounded tool purpose.", inputContract: ["Document accepted input"], outputContract: ["Document produced output"],
        allowedScopes: [], requiredPermissions: [], effectEnvelope: ["observe"],
        trust: { source: "configured", maturity: "unknown", assessedAt: now, basis: "Requires review" },
        limitations: ["Tool presence does not grant authority"], enabled: false,
        policy: { requiresHumanConfirmation: true, forbiddenInUntrustedWorkspace: true, allowedProfiles: [] },
      }
      case "create-run-tool-selection": return {
        runId: "replace-with-run-uuid", tools: [], requestedEffects: ["observe"],
        requestedScopes: [{ kind: "workspace-relative", path: "." }], confirmedToolIds: [],
      }
      case "create-trace-link": return {
        source: productReference, relationship: "related-to", target: { ...productReference },
        provenance: { kind: "human", actorId, rationale: "Why this relationship is asserted" },
      }
      default: return {}
    }
  }

  const performDomainMutation = async (
    action: DomainWorkflowAction,
    runtimeEngine: GaepEngine,
    input: Record<string, unknown>,
    record?: Record<string, unknown>,
    revisionReason?: string,
    expectedProductRevision?: number,
  ): Promise<unknown> => {
    const studio = runtimeEngine.productStudio
    const product = await runtimeEngine.readProduct()
    const productRevision = product.revision ?? 1
    if (expectedProductRevision && productRevision !== expectedProductRevision) {
      throw new Error(`Product is now revision ${productRevision}; refresh before changing revision ${expectedProductRevision}`)
    }
    const id = action.recordId ?? String(record?.id ?? "")
    const expectedRevision = action.expectedRevision ?? Number(record?.revision)
    switch (action.workflow) {
      case "create-change": return studio.createChange(input as never, productRevision, actorId)
      case "edit-change": return studio.reviseChange(id, expectedRevision, input as never, actorId, revisionReason)
      case "create-work-item": return studio.createWorkItem(input as never, productRevision, actorId)
      case "edit-work-item": return studio.reviseWorkItem(id, expectedRevision, input as never, actorId, revisionReason)
      case "create-requirement": return studio.createRequirement(input as never, productRevision, actorId)
      case "edit-requirement": return studio.reviseRequirement(id, expectedRevision, input as never, actorId, revisionReason)
      case "create-decision": return studio.createDecision(input as never, productRevision, actorId)
      case "edit-decision": return studio.reviseDecision(id, expectedRevision, input as never, actorId, revisionReason)
      case "create-risk": return studio.createRisk(input as never, productRevision, actorId)
      case "edit-risk": return studio.reviseRisk(id, expectedRevision, input as never, actorId, revisionReason)
      case "create-architecture": return studio.createArchitectureRecord(input as never, productRevision, actorId)
      case "edit-architecture": return studio.reviseArchitectureRecord(id, expectedRevision, input as never, actorId, revisionReason)
      case "create-evidence": return studio.createEvidence(input as never, productRevision, actorId)
      case "edit-evidence": return studio.reviseEvidence(id, expectedRevision, input as never, actorId)
      case "create-context-pack": return studio.createContextPack(input as never, productRevision, actorId)
      case "edit-context-pack": return studio.reviseContextPack(id, expectedRevision, input as never, actorId)
      case "create-instruction-privilege-grant": return studio.createInstructionPrivilegeGrant(input as never, productRevision, actorId)
      case "create-workflow-plan": return studio.createWorkflowPlan(input as never, productRevision, actorId)
      case "edit-workflow-plan": return studio.reviseWorkflowPlan(id, expectedRevision, input as never, actorId, revisionReason)
      case "create-tool-definition": return studio.createToolDefinition(input as never, productRevision, actorId)
      case "edit-tool-definition": return studio.reviseToolDefinition(id, expectedRevision, input as never, actorId)
      case "create-run-tool-selection": return studio.createRunToolSelection({ ...input, workspaceTrusted: vscode.workspace.isTrusted } as never, productRevision, actorId)
      case "edit-run-tool-selection": return studio.reviseRunToolSelection(id, expectedRevision, { ...input, workspaceTrusted: vscode.workspace.isTrusted } as never, actorId)
      case "create-trace-link": return studio.createTraceLink(input as never, productRevision, actorId)
      default: throw new Error(`Unsupported Product-domain mutation: ${action.workflow}`)
    }
  }

  const executeProductStudioWorkflow = async (action: DomainWorkflowAction): Promise<unknown> => {
    const runtime = await requireRuntime()
    const studio = runtime.engine.productStudio
    const expectedContextGeneration = action.expectedContextGeneration ?? studioContextGeneration
    const initialProduct = await runtime.engine.readProduct()
    const expectedProductRevision = action.expectedProductRevision ?? (initialProduct.revision ?? 1)
    const assertWorkflowContext = async (): Promise<void> => {
      if (!vscode.workspace.isTrusted || recoveryDiagnostic || studioContextGeneration !== expectedContextGeneration ||
        selectedFolder?.uri.fsPath !== runtime.path || engine !== runtime.engine) {
        throw new Error("The Product root, trust, engine, or recovery context changed while this workflow was open; no Product-domain mutation was performed")
      }
      const current = await runtime.engine.readProduct()
      if ((current.revision ?? 1) !== expectedProductRevision) {
        throw new Error(`Product is now revision ${current.revision ?? 1}; refresh before continuing from revision ${expectedProductRevision}`)
      }
    }
    await assertWorkflowContext()
    if (action.workflow === "search") {
      const query = await requiredInput("Search Product-domain records (at least two characters)")
      const results = await studio.search({ query })
      const bounded = results.slice(0, recordLimit)
      if (results.length > bounded.length) {
        await vscode.window.showWarningMessage(`Search returned ${results.length} records. Product Studio shows the newest ${bounded.length}; refine the query to inspect omitted matches.`)
      }
      return { kind: "search-results", results: bounded, total: results.length }
    }
    if (action.workflow === "workspace-health") {
      const issues = await studio.healthIssues()
      if (issues.length === 0) await vscode.window.showInformationMessage("GAEP Product-domain workspace health has no reported issues")
      else await vscode.window.showWarningMessage(`GAEP Product-domain health reports ${issues.length} issue(s). Open Product Studio Readiness for the bounded list.`)
      refresh()
      return issues.slice(0, recordLimit)
    }
    if (action.workflow === "export") {
      const sensitiveContextPacks: Array<{ id: string; classification: string }> = []
      let offset = 0
      while (true) {
        const page = await studio.listDomainPage("context-pack", { offset, limit: recordLimit })
        sensitiveContextPacks.push(...page.items
          .filter((pack) => ["confidential", "restricted"].includes(pack.classification.level))
          .map((pack) => ({ id: pack.id, classification: pack.classification.level })))
        if (!page.hasMore) break
        offset += page.limit
        if (offset >= 10_000) throw new Error("Context Pack disclosure review exceeds the portable export safety limit")
      }
      let reviewedAt: string | undefined
      if (sensitiveContextPacks.length > 0) {
        const exactInventory = sensitiveContextPacks
          .map((record) => `${record.id} (${record.classification})`)
          .join("\n")
        const approval = await vscode.window.showWarningMessage(
          `This export includes ${sensitiveContextPacks.length} confidential or restricted Context Pack(s). Review the exact IDs below. The disclosure decision will be attributed to ${actorId} with the confirmation time.\n\n${exactInventory}`,
          { modal: true },
          "I Reviewed These Exact IDs",
        )
        if (approval !== "I Reviewed These Exact IDs") throw new WorkflowCancelled()
        reviewedAt = new Date().toISOString()
      }
      await assertWorkflowContext()
      const bundle = await withProductDomainMutation(async () => {
        await assertWorkflowContext()
        return studio.buildPortableExport(sensitiveContextPacks.length > 0 ? {
          reviewedRecordIds: sensitiveContextPacks.map((record) => record.id),
          actorId,
          reviewedAt: reviewedAt!,
        } : {})
      })
      if (bundle.manifest.productRevision !== expectedProductRevision) {
        throw new Error(`Portable export observed Product revision ${bundle.manifest.productRevision}; expected ${expectedProductRevision}. No file was saved.`)
      }
      const target = await vscode.window.showSaveDialog({
        title: "Save portable GAEP Product export",
        filters: { "GAEP Product export": ["json"] },
        defaultUri: vscode.Uri.joinPath(vscode.Uri.file(runtime.path), `${bundle.manifest.productId}-r${bundle.manifest.productRevision}.gaep.json`),
      })
      if (!target) throw new WorkflowCancelled()
      const temporary = target.with({ path: `${target.path}.gaep-${randomUUID()}.tmp` })
      try {
        await vscode.workspace.fs.writeFile(temporary, new TextEncoder().encode(`${JSON.stringify(bundle, null, 2)}\n`))
        await vscode.workspace.fs.rename(temporary, target, { overwrite: true })
      } catch (error) {
        await Promise.resolve(vscode.workspace.fs.delete(temporary, { recursive: false, useTrash: false })).catch(() => undefined)
        throw error
      }
      await vscode.window.showInformationMessage(`Portable Product export saved with ${bundle.manifest.members.length} member(s). This does not grant authority or implementation approval.`)
      return bundle.manifest
    }
    if (action.workflow === "import-preview") {
      const selected = await vscode.window.showOpenDialog({
        title: "Preview a portable GAEP Product export (no mutation)",
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { "GAEP Product export": ["json"] },
      })
      const source = selected?.[0]
      if (!source) throw new WorkflowCancelled()
      if (source.scheme !== "file") throw new Error("Import preview currently requires a local file URI; no mutation was performed")
      const preview = await studio.previewImportFile(source.fsPath)
      await vscode.window.showInformationMessage(`Import preview: ${preview.status}; ${preview.memberCount} member(s); ${preview.conflicts.length} conflict(s). No mutation was performed.`)
      return preview
    }
    if (action.workflow === "revoke-instruction-privilege-grant") {
      let record = action.recordId
        ? await readDomainRecord(action.workflow, runtime.engine, action.recordId) as Awaited<ReturnType<typeof studio.readInstructionPrivilegeGrant>>
        : undefined
      if (!record) {
        const page = await studio.listDomainPage("instruction-privilege-grant", { offset: 0, limit: recordLimit })
        const active = page.items.filter((candidate) => candidate.state === "active")
        if (active.length === 0) {
          throw new Error(page.hasMore
            ? "No active Instruction Privilege Grant is present on the bounded first page; open the paged Product Studio table and revoke the exact record"
            : "No active Instruction Privilege Grant exists")
        }
        if (page.hasMore) {
          await vscode.window.showWarningMessage(
            `There are ${page.total} Instruction Privilege Grants. This picker shows the bounded first ${page.items.length}; use the paged Product Studio table for omitted records.`,
          )
        }
        const picked = await vscode.window.showQuickPick(active.map((candidate) => ({
          label: candidate.purpose,
          description: `${candidate.privilege} · revision ${candidate.revision}`,
          detail: candidate.id,
          record: candidate,
        })), { title: "Select an active Instruction Privilege Grant to revoke", ignoreFocusOut: true })
        if (!picked) throw new WorkflowCancelled()
        record = picked.record
      }
      if (action.expectedRevision && record.revision !== action.expectedRevision) {
        throw new Error(`The selected Instruction Privilege Grant is now revision ${record.revision}; refresh before revoking revision ${action.expectedRevision}`)
      }
      if (record.state !== "active") throw new Error(`Instruction Privilege Grant is already ${record.state}`)
      const reason = await requiredInput("Why must this exact Instruction Privilege Grant be revoked?")
      const confirmation = await vscode.window.showWarningMessage(
        `Revoke Instruction Privilege Grant ${record.id} revision ${record.revision}, attributed to ${actorId}?\n\nReason: ${reason}`,
        { modal: true },
        "Revoke Exact Grant",
      )
      if (confirmation !== "Revoke Exact Grant") throw new WorkflowCancelled()
      await assertWorkflowContext()
      const revoked = await withProductDomainMutation(async () => {
        await assertWorkflowContext()
        return studio.revokeInstructionPrivilegeGrant(record.id, record.revision, reason, actorId)
      })
      refresh()
      return revoked
    }
    if (action.workflow === "reassess-trace-link") {
      let id = action.recordId
      let expectedRevision = action.expectedRevision
      if (!id || !expectedRevision) {
        const page = await studio.listDomainPage("trace-link", { offset: 0, limit: recordLimit })
        const picked = await vscode.window.showQuickPick(page.items.map((record) => ({
          label: `${record.source.recordType}:${record.source.recordId} ${record.relationship} ${record.target.recordType}:${record.target.recordId}`,
          description: `${record.state} · revision ${record.revision}`,
          record,
        })), { title: "Select a Trace link to reassess", ignoreFocusOut: true })
        if (!picked) throw new WorkflowCancelled()
        id = picked.record.id
        expectedRevision = picked.record.revision
      }
      await assertWorkflowContext()
      const result = await withProductDomainMutation(async () => {
        await assertWorkflowContext()
        return studio.reassessTraceLink(id, expectedRevision, actorId)
      })
      refresh()
      return result
    }

    const editing = action.workflow.startsWith("edit-")
    let record: Record<string, unknown> | undefined
    if (editing) {
      record = action.recordId
        ? await readDomainRecord(action.workflow, runtime.engine, action.recordId) as Record<string, unknown>
        : undefined
      if (!record) {
        const page = await readDomainRecords(action.workflow, runtime.engine)
        const records = page.records as Record<string, unknown>[]
        if (records.length === 0) throw new Error("No matching governed record exists")
        if (page.total > records.length) {
          await vscode.window.showWarningMessage(`There are ${page.total} matching records. The picker is bounded to ${records.length}; use Product-domain search or the paged Product Studio table to locate omitted records.`)
        }
        const picked = await vscode.window.showQuickPick(records.slice(0, recordLimit).map((candidate) => ({
          label: String(candidate.title ?? candidate.key ?? candidate.question ?? candidate.objective ?? candidate.id),
          description: `revision ${String(candidate.revision)}${candidate.state ? ` · ${String(candidate.state)}` : ""}`,
          detail: String(candidate.id),
          record: candidate,
        })), { title: `Select a record for ${action.workflow.replaceAll("-", " ")}`, ignoreFocusOut: true })
        if (!picked) throw new WorkflowCancelled()
        record = picked.record
      }
      if (action.expectedRevision && Number(record.revision) !== action.expectedRevision) {
        throw new Error(`The selected record is now revision ${String(record.revision)}; refresh before editing revision ${action.expectedRevision}`)
      }
    }
    const template = editing && record ? mutableDomainInput(action.workflow, record) : await createTemplate(action.workflow, runtime.engine)
    const draftKey = `${runtime.path}\u0000${action.workflow}\u0000${String(record?.id ?? "new")}`
    const input = await collectStructuredObject(draftKey, `GAEP: ${action.workflow.replaceAll("-", " ")}`, template)
    const stateChanged = editing && record && "state" in input && input.state !== record.state
    const revisionReason = stateChanged
      ? await requiredInput(`Why should ${action.workflow.replaceAll("edit-", "").replaceAll("-", " ")} transition from ${String(record?.state)} to ${String(input.state)}?`)
      : undefined
    if (action.workflow === "create-instruction-privilege-grant") {
      const serialized = JSON.stringify(input)
      if (serialized.includes("replace-with") || input.sourceDigest === instructionSourcePlaceholderDigest) {
        throw new Error("Replace every Instruction Privilege Grant placeholder, including the independently verified source digest, before authorization review")
      }
      if (typeof input.sourceDigest !== "string" || !/^sha256:[0-9a-f]{64}$/.test(input.sourceDigest)) {
        throw new Error("Instruction Privilege Grant source digest must be an exact lowercase sha256 digest")
      }
      const scope = Array.isArray(input.scope) && input.scope.every((entry) => typeof entry === "string") ? input.scope : []
      const authority = input.authority as Record<string, unknown> | undefined
      const recipient = input.recipient as Record<string, unknown> | undefined
      const source = input.source as Record<string, unknown> | undefined
      const exactSummary = [
        `Source: ${JSON.stringify(source)}`,
        `Source digest: ${String(input.sourceDigest)}`,
        `Privilege: ${String(input.privilege)}`,
        `Purpose: ${String(input.purpose)}`,
        `Recipient: ${String(recipient?.kind)}:${String(recipient?.id)}`,
        `Scope (${scope.length}): ${scope.join(" | ")}`,
        `Authority: ${String(authority?.recordType)}:${String(authority?.recordId)}@${String(authority?.revision)} · ${String(authority?.digest)}`,
        `Expiry: ${typeof input.expiresAt === "string" ? input.expiresAt : "NO EXPIRY — explicitly reviewed"}`,
        `Actor: ${actorId}`,
      ].join("\n")
      if (exactSummary.length > 20_000) {
        throw new Error("The Instruction Privilege Grant is too large for exact authorization review; split it into narrower grants")
      }
      const confirmation = await vscode.window.showWarningMessage(
        `Create this exact active Instruction Privilege Grant? A grant does not create its own authority.\n\n${exactSummary}`,
        { modal: true },
        "Create Exact Grant",
      )
      if (confirmation !== "Create Exact Grant") throw new WorkflowCancelled()
    } else {
      const confirmation = await vscode.window.showWarningMessage(
        `Commit ${action.workflow.replaceAll("-", " ")} as local governed state attributed to ${actorId}? Engine validation, exact revision checks, audit recording, and transaction recovery apply.`,
        { modal: true },
        "Validate and Commit",
      )
      if (confirmation !== "Validate and Commit") throw new WorkflowCancelled()
    }
    await assertWorkflowContext()
    const result = await withProductDomainMutation(async () => {
      await assertWorkflowContext()
      return performDomainMutation(
        action,
        runtime.engine,
        input,
        record,
        revisionReason,
        expectedProductRevision,
      )
    })
    domainInputDrafts.delete(draftKey)
    refresh()
    return result
  }

  context.subscriptions.push(vscode.commands.registerCommand("gaep.productStudio.domainWorkflow", async (candidate?: unknown) => {
    if (!isStudioAction(candidate) || candidate.kind !== "domain-workflow") throw new Error("A valid Product Studio workflow action is required")
    try {
      return await executeProductStudioWorkflow(candidate)
    } catch (error) {
      if (error instanceof WorkflowCancelled) return undefined
      logDiagnostic(`Product Studio ${candidate.workflow} failed`, error)
      throw error
    }
  }))

  const contributedDomainCommands: Array<{ command: string; workflow: StudioDomainWorkflow }> = studioDomainWorkflows.map((workflow) => ({
    command: `gaep.productStudio.${workflow.replaceAll("-", ".")}`,
    workflow,
  }))
  for (const contributed of contributedDomainCommands) {
    context.subscriptions.push(vscode.commands.registerCommand(contributed.command, () => vscode.commands.executeCommand(
      "gaep.productStudio.domainWorkflow",
      { kind: "domain-workflow", workflow: contributed.workflow },
    )))
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("gaep.productStudio.startDesignDraft", safely(async () => {
      const runtime = await requireRuntime()
      const product = await runtime.engine.readProduct()
      const draft = await runtime.engine.productStudio.startOrResumeDesignDraft(product.revision ?? 1)
      refresh()
      await vscode.window.showInformationMessage(`Product design draft ${draft.id} is available at local draft revision ${draft.revision}.`)
    })),
    vscode.commands.registerCommand("gaep.productStudio.editDesignSection", safely(async () => {
      const runtime = await requireRuntime()
      const product = await runtime.engine.readProduct()
      const draft = await runtime.engine.productStudio.startOrResumeDesignDraft(product.revision ?? 1)
      const picked = await vscode.window.showQuickPick(studioRoutes.map((route) => ({
        label: studioRouteLabels[route],
        description: runtime.engine.productStudio.evaluateDesignReadiness(draft).sections.find((section) => section.sectionId === route)?.state,
        route,
      })), { title: "Select the governed Product design section to edit", ignoreFocusOut: true })
      if (!picked) throw new WorkflowCancelled()
      const section = draft.sections[picked.route]
      const template = {
        fields: section.fields.map((field) => ({
          key: field.key,
          value: field.value,
          state: field.state,
          ...(field.deferredReason ? { deferredReason: field.deferredReason } : {}),
          ...(field.revisitTrigger ? { revisitTrigger: field.revisitTrigger } : {}),
        })),
      }
      const key = `${runtime.path}\u0000design\u0000${picked.route}`
      const input = await collectStructuredObject(key, `Edit ${picked.label} design fields`, template)
      if (!Array.isArray(input.fields)) throw new Error("Design input requires a fields array")
      const byKey = new Map(input.fields.flatMap((candidate): Array<[string, Record<string, unknown>]> => {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return []
        const field = candidate as Record<string, unknown>
        return typeof field.key === "string" ? [[field.key, field]] : []
      }))
      const nextSection = {
        ...section,
        fields: section.fields.map((field) => {
          const candidate = byKey.get(field.key)
          if (!candidate) return field
          const state = candidate.state
          if (!["missing", "weak", "complete", "deferred"].includes(String(state))) {
            throw new Error(`${field.key} has an invalid design state`)
          }
          const value = candidate.value
          if (!(typeof value === "string" || (Array.isArray(value) && value.every((entry) => typeof entry === "string")))) {
            throw new Error(`${field.key} value must be a string or string array`)
          }
          const deferredReason = typeof candidate.deferredReason === "string" ? candidate.deferredReason.trim() : undefined
          const revisitTrigger = typeof candidate.revisitTrigger === "string" ? candidate.revisitTrigger.trim() : undefined
          const clean = { ...field }
          delete clean.deferredReason
          delete clean.revisitTrigger
          return {
            ...clean,
            value,
            state: state as typeof field.state,
            provenance: [...new Set([...field.provenance, `human:${actorId}`])],
            ...(state === "deferred" && deferredReason ? { deferredReason } : {}),
            ...(state === "deferred" && revisitTrigger ? { revisitTrigger } : {}),
          }
        }),
        updatedAt: new Date().toISOString(),
      }
      const confirmation = await vscode.window.showWarningMessage(
        `Save ${picked.label} against draft revision ${draft.revision} and Product revision ${draft.baseProductRevision}?`,
        { modal: true },
        "Save Draft Section",
      )
      if (confirmation !== "Save Draft Section") throw new WorkflowCancelled()
      await runtime.engine.productStudio.saveDesignDraft({
        draftId: draft.id,
        sections: { ...draft.sections, [picked.route]: nextSection },
        expectedDraftRevision: draft.revision,
        expectedProductRevision: draft.baseProductRevision,
      })
      domainInputDrafts.delete(key)
      refresh()
    })),
    vscode.commands.registerCommand("gaep.productStudio.evaluateDesignReadiness", safely(async () => {
      const runtime = await requireRuntime()
      const product = await runtime.engine.readProduct()
      const draft = await runtime.engine.productStudio.readDesignDraft(product.id)
      const report = runtime.engine.productStudio.evaluateDesignReadiness(draft)
      const incomplete = report.sections.filter((section) => !["complete", "deferred"].includes(section.state))
      await vscode.window.showInformationMessage(
        `Product design readiness: ${report.status}; ${incomplete.length} incomplete section(s); ${report.deferredFieldCount} deferred field(s). This is not implementation approval.`,
      )
    })),
    vscode.commands.registerCommand("gaep.productStudio.createDesignRevision", safely(async () => {
      const runtime = await requireRuntime()
      const product = await runtime.engine.readProduct()
      const draft = await runtime.engine.productStudio.readDesignDraft(product.id)
      const report = runtime.engine.productStudio.evaluateDesignReadiness(draft)
      const confirmation = await vscode.window.showWarningMessage(
        `Create immutable Product design history from local draft revision ${draft.revision}? Readiness is ${report.status}; this does not approve implementation.`,
        { modal: true },
        "Create Design Revision",
      )
      if (confirmation !== "Create Design Revision") throw new WorkflowCancelled()
      const created = await runtime.engine.productStudio.createDesignRevision({
        draftId: draft.id,
        expectedDraftRevision: draft.revision,
        expectedProductRevision: draft.baseProductRevision,
      }, actorId)
      refresh()
      await vscode.window.showInformationMessage(`Created design revision ${created.revision.revision} and Product revision ${created.product.revision}.`)
    })),
    vscode.commands.registerCommand("gaep.productStudio.analyzeImpact", safely(async () => {
      const runtime = await requireRuntime()
      const recordType = await requiredInput("Exact trace record type")
      const recordId = await requiredInput("Exact trace record ID")
      const external = recordType === "external"
      const revision = external ? undefined : Number(await requiredInput("Exact record revision", {
        validateInput: (value) => Number.isInteger(Number(value)) && Number(value) > 0 ? undefined : "Enter a positive integer",
      }))
      const digest = external ? undefined : await requiredInput("Exact sha256 record digest")
      const impact = await runtime.engine.productStudio.impactAnalysis({
        recordType: recordType as never,
        recordId,
        ...(revision ? { revision } : {}),
        ...(digest ? { digest } : {}),
      })
      await vscode.window.showInformationMessage(
        `Impact analysis: ${impact.upstream.length} upstream, ${impact.downstream.length} downstream, ${impact.unresolved.length} unresolved, ${impact.invalid.length} invalid, ${impact.stale.length} stale.${impact.truncated ? " Results are explicitly truncated." : ""}`,
      )
    })),
    vscode.commands.registerCommand("gaep.productStudio.inspectRecord", safely(async () => {
      const runtime = await requireRuntime()
      const query = await requiredInput("Search for a Product-domain record to inspect")
      const results = await runtime.engine.productStudio.search({ query })
      if (results.length === 0) throw new Error("No Product-domain records matched the search")
      if (results.length > recordLimit) {
        await vscode.window.showWarningMessage(`Search returned ${results.length} records. The inspector picker is bounded to ${recordLimit}; refine the query for omitted matches.`)
      }
      const picked = await vscode.window.showQuickPick(results.slice(0, recordLimit).map((record) => ({
        label: record.label,
        description: `${record.kind} · revision ${record.revision}`,
        detail: record.excerpt,
        record,
      })), { title: "Inspect Product-domain record", ignoreFocusOut: true })
      if (!picked) throw new WorkflowCancelled()
      await vscode.window.showInformationMessage(
        `${picked.record.kind} ${picked.record.id} revision ${picked.record.revision}: ${picked.record.excerpt}`,
        { modal: true },
      )
    })),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand("gaep.refresh", refresh),
    vscode.commands.registerCommand("gaep.showDiagnostics", () => {
      diagnostics.info(`Workspace trusted: ${vscode.workspace.isTrusted}`)
      diagnostics.info(`Selected Product root: ${selectedFolder?.uri.fsPath ?? "none"}`)
      diagnostics.info(`Recovery diagnostic: ${recoveryDiagnostic ?? "none"}`)
      diagnostics.info(`Managed active runs: ${activeAgentRuns.list().map((run) => run.runId).join(", ") || "none"}`)
      diagnostics.info(`Local actor: ${localActor.id} (machine-local attribution only; not an approval authority)`)
      diagnostics.show(true)
    }),
    vscode.commands.registerCommand("gaep.manageWorkspaceTrust", () => vscode.commands.executeCommand("workbench.trust.manage")),
    vscode.commands.registerCommand("gaep.migrateLegacyAgentSelection", () => vscode.commands.executeCommand("gaep.selectAgent")),
    vscode.commands.registerCommand("gaep.selectWorkspaceRoot", safely(selectWorkspaceRoot)),
    vscode.commands.registerCommand("gaep.retryRecovery", safely(async () => {
      if (!vscode.workspace.isTrusted) throw new Error("Trust the workspace before retrying GAEP recovery")
      if (!selectedFolder) throw new Error("Select a GAEP Product root before retrying recovery")
      if (activeAgentRuns.size > 0) throw new Error("Stop the active provider process before retrying interrupted-run recovery")
      await configureRoot(selectedFolder, true)
      if (!recoveryDiagnostic) await vscode.window.showInformationMessage("GAEP recovery completed")
    })),
  )

  context.subscriptions.push(vscode.commands.registerCommand("gaep.initializeProduct", safely(async () => {
    const runtime = await requireRuntime()
    if (await exists(join(runtime.path, ".gaep"))) {
      throw new Error("A .gaep directory already exists. Initialization is disabled to preserve existing or partial state; inspect diagnostics instead.")
    }
    const name = await requiredInput("Product name", { validateInput: (value) => value.trim().length < 2 ? "Use at least 2 characters" : undefined })
    const summary = await requiredInput("One-sentence product summary")
    const problem = await requiredInput("What problem does this Product solve?")
    const affectedUsers = await requiredInput("Who is affected by this problem?")
    const desiredOutcome = await requiredInput("What outcome should the Product create?")
    const successSignals = (await requiredInput("Success signals, separated by commas")).split(",").map((item) => item.trim()).filter(Boolean)
    const firstWorkflow = await requiredInput("Describe the first complete user workflow")
    const exclusionsInput = await vscode.window.showInputBox({ prompt: "Initial exclusions, separated by commas", ignoreFocusOut: true })
    if (exclusionsInput === undefined) throw new WorkflowCancelled()
    const profile = await vscode.window.showQuickPick([...productProfiles], { title: "Select the initial GAEP profile", ignoreFocusOut: true })
    if (!profile) throw new WorkflowCancelled()
    const product = await runtime.engine.createProduct({
      name,
      summary,
      problem,
      affectedUsers,
      desiredOutcome,
      successSignals,
      firstWorkflow,
      exclusions: exclusionsInput.split(",").map((item) => item.trim()).filter(Boolean),
      profile: productProfileSchema.parse(profile),
    }, actorId)
    refresh()
    await vscode.window.showInformationMessage(`GAEP Product created: ${product.name}`)
    await vscode.commands.executeCommand("gaep.selectAgent")
  })))

  context.subscriptions.push(vscode.commands.registerCommand("gaep.selectAgent", safely(async () => {
    const runtime = await requireRuntime()
    await runtime.engine.readProduct()
    const running = (await runtime.engine.listRuns()).filter((run) => run.state === "running")
    if (running.length > 0 || activeAgentRuns.hasRoot(runtime.path)) {
      throw new Error("Stop the active agent process before changing agent, model, or settings")
    }
    let currentSelection
    let legacySelectionPresent = false
    try {
      const compatibility = await runtime.engine.repository.readAgentSelectionCompatibility()
      if (compatibility.status === "current") currentSelection = compatibility.selection
      else if (compatibility.status === "migration-required") legacySelectionPresent = true
      else {
        throw new Error(`The stored Agent Selection is invalid: ${compatibility.issues.join("; ")}`)
      }
    } catch (error) {
      if (await exists(join(runtime.path, ".gaep", "runtime", "selection.json"))) {
        if (!legacySelectionPresent) throw error
      }
    }
    if (legacySelectionPresent) {
      diagnostics.warn("A legacy non-portable agent selection is present. Only the explicit engine migration path may replace it.")
    }
    const probes = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "GAEP is detecting installed agents", cancellable: false },
      () => probeAdaptersResilient(runtime.engine),
    )
    const detected = probes.filter((probe) =>
      probe.capabilities.detected &&
      probe.capabilities.executionInterface !== "unavailable" &&
      probe.runtimeBinding.kind === "executable",
    )
    if (detected.length === 0) {
      const reviewOnly = probes.map((probe) => probe.capabilities).filter((capability) => capability.detected)
      if (reviewOnly.length > 0) {
        throw new Error(
          `${reviewOnly.map((capability) => capability.agentLabel).join(", ")} was detected for capability review, but this release has no technically enforceable execution boundary for it.`,
        )
      }
      throw new Error("No supported installed agent was detected. Configure a machine-scoped executable path in User Settings.")
    }
    const agent = await vscode.window.showQuickPick(
      detected.map((probe) => ({
        capability: probe.capabilities,
        probe,
        label: probe.capabilities.agentLabel,
        description: probe.capabilities.runtimeVersion ?? "version unknown",
        detail: `${probe.capabilities.limitations.join(" ")} The VS Code safety boundary removes elevated permission modes and direct live-search enablement.`,
      })),
      { title: "Select the agent that will execute GAEP work", ignoreFocusOut: true },
    )
    if (!agent) throw new WorkflowCancelled()
    const modelId = await chooseModel(agent.capability)
    const settings: Record<string, unknown> = {}
    for (const rawSetting of agent.capability.settings) {
      if (agent.capability.agentId === "codex-cli" && rawSetting.key === "search") {
        settings.search = false
        continue
      }
      const setting = constrainedSetting(agent.capability.agentId, rawSetting)
      const value = await collectSetting(setting)
      if (value !== undefined) settings[setting.key] = value
    }
    const unsafe = unsafeSelectionReasons(agent.capability.agentId, settings)
    if (unsafe.length > 0) throw new Error(unsafe.join("; "))
    if (legacySelectionPresent) {
      const accepted = await vscode.window.showWarningMessage(
        [
          "GAEP found a legacy path-bearing agent selection.",
          `Reconfirm ${agent.capability.agentLabel} / ${modelId} and migrate it to the portable selection contract?`,
          "The engine will require the same agent identity and an exact fresh capability match. It will not copy the executable path into governed records.",
        ].join("\n\n"),
        { modal: true },
        "Reconfirm and Migrate",
      )
      if (accepted !== "Reconfirm and Migrate") throw new WorkflowCancelled()
      await runtime.engine.migrateLegacyAgentSelection({
        capabilities: agent.capability,
        modelId,
        settings,
        confirmation: "reconfirm-portable-agent-selection",
      }, actorId)
      await rememberRuntimeBinding(runtime.path, agent.probe)
      refresh()
      await vscode.window.showInformationMessage(`${agent.capability.agentLabel} selection migrated and rebound for this machine`)
      return
    }
    const priorRuns = await runtime.engine.listRuns()
    const selectionChanges = currentSelection && (
      currentSelection.adapterId !== agent.capability.adapterId ||
      currentSelection.modelId !== modelId ||
      JSON.stringify(currentSelection.settings) !== JSON.stringify(settings)
    )
    let selectionCommittedByHandoff = false
    if (currentSelection && selectionChanges && priorRuns.length > 0) {
      const reason = await requiredInput("Why are you switching agent, model, or settings?")
      const completedWork = (await requiredInput("Completed work to hand off, separated by commas"))
        .split(",").map((item) => item.trim()).filter(Boolean)
      const unresolvedMatters = (await requiredInput("Unresolved matters, separated by commas"))
        .split(",").map((item) => item.trim()).filter(Boolean)
      const handoffInput = {
        fromRunId: priorRuns[0]!.id,
        toCapabilities: agent.capability,
        toModelId: modelId,
        toSettings: settings,
        reason,
        completedWork,
        unresolvedMatters,
        decisions: [],
        evidence: [],
      }
      const preview = await runtime.engine.previewHandoff(handoffInput)
      const accepted = await vscode.window.showWarningMessage(
        `Review switch before GAEP atomically records the handoff and new selection: ${preview.capabilityDifferences.join(" ")}`,
        { modal: true },
        "Accept Handoff and Switch",
      )
      if (accepted !== "Accept Handoff and Switch") throw new WorkflowCancelled()
      await runtime.engine.createHandoff(handoffInput, actorId)
      selectionCommittedByHandoff = true
    }
    if (!selectionCommittedByHandoff) {
      await runtime.engine.selectAgent(agent.capability, modelId, settings, actorId)
    }
    await rememberRuntimeBinding(runtime.path, agent.probe)
    refresh()
    await vscode.window.showInformationMessage(`${agent.capability.agentLabel} with ${modelId} is selected for GAEP`)
  })))

  context.subscriptions.push(vscode.commands.registerCommand("gaep.createInitiative", safely(async () => {
    const runtime = await requireRuntime()
    const title = await requiredInput("Initiative title")
    const outcome = await requiredInput("Bounded outcome for this Initiative")
    const scope = (await requiredInput("Included scope, separated by commas")).split(",").map((item) => item.trim()).filter(Boolean)
    const exclusionsInput = await vscode.window.showInputBox({ prompt: "Excluded scope, separated by commas", ignoreFocusOut: true })
    if (exclusionsInput === undefined) throw new WorkflowCancelled()
    const initiative = await runtime.engine.createInitiative({
      title,
      outcome,
      scope,
      exclusions: exclusionsInput.split(",").map((item) => item.trim()).filter(Boolean),
    }, actorId)
    refresh()
    const action = await vscode.window.showInformationMessage(
      `Initiative created in proposed state: ${initiative.title}. Activate it explicitly before preparing a run.`,
      { modal: true },
      "Activate Initiative",
      "Keep Proposed",
    )
    if (action === "Activate Initiative") {
      const reason = await requiredInput("Why is this Initiative ready to become active?")
      await runtime.engine.updateInitiativeState(initiative.id, "active", reason, actorId)
      refresh()
      await vscode.window.showInformationMessage(`Initiative activated: ${initiative.title}`)
    }
  })))

  context.subscriptions.push(vscode.commands.registerCommand(
    "gaep.changeInitiativeState",
    (initiativeId?: string) => safely(async () => {
      const runtime = await requireRuntime()
      const initiativeFiles = (await readdir(join(runtime.path, ".gaep", "initiatives")))
        .filter((name) => name.endsWith(".json"))
      if (initiativeFiles.length === 0) throw new Error("Create an Initiative before changing Initiative state")
      const initiatives = await Promise.all(
        initiativeFiles.map((name) => runtime.engine.readInitiative(name.replace(/\.json$/, ""))),
      )
      let initiative: Initiative | undefined
      if (initiativeId) initiative = initiatives.find((candidate) => candidate.id === initiativeId)
      if (!initiative) {
        const selected = await vscode.window.showQuickPick(
          initiatives.map((candidate) => ({
            label: candidate.title,
            description: candidate.state,
            detail: candidate.outcome,
            initiative: candidate,
          })),
          { title: "Select the Initiative whose state should change", ignoreFocusOut: true },
        )
        if (!selected) throw new WorkflowCancelled()
        initiative = selected.initiative
      }
      const managedRunIds = new Set(
        activeAgentRuns.list().filter((run) => run.rootPath === runtime.path).map((run) => run.runId),
      )
      const activeRun = (await runtime.engine.listRuns()).find((run) =>
        run.initiativeId === initiative.id && (run.state === "running" || managedRunIds.has(run.id)),
      )
      if (activeRun) {
        throw new Error(`Stop run ${activeRun.id} before changing the state of ${initiative.title}`)
      }
      const allowed = initiativeTransitions[initiative.state]
      if (allowed.length === 0) {
        await vscode.window.showInformationMessage(
          `${initiative.title} is ${initiative.state}, a terminal state with no further transitions.`,
        )
        return
      }
      const target = await vscode.window.showQuickPick(
        allowed.map((state) => ({ label: state, state })),
        { title: `Change ${initiative.title} from ${initiative.state}`, ignoreFocusOut: true },
      )
      if (!target) throw new WorkflowCancelled()
      const reason = await requiredInput(`Why should ${initiative.title} change from ${initiative.state} to ${target.state}?`)
      const updated = await runtime.engine.updateInitiativeState(initiative.id, target.state, reason, actorId)
      refresh()
      await vscode.window.showInformationMessage(`${updated.title} is now ${updated.state}`)
    })(),
  ))

  context.subscriptions.push(vscode.commands.registerCommand("gaep.prepareRun", safely(async () => {
    const runtime = await requireRuntime()
    const currentSelection = await runtime.engine.readSelection()
    const unsafe = unsafeSelectionReasons(currentSelection.agentId, currentSelection.settings)
    if (unsafe.length > 0) throw new Error(`Reselect the agent before running: ${unsafe.join("; ")}`)
    const selectedAdapter = runtime.engine.adapters.get(currentSelection.adapterId)
    if (!selectedAdapter) throw new Error("The selected agent adapter is unavailable; select the agent again")
    const selectedProbe = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "GAEP is revalidating the selected agent runtime", cancellable: false },
      () => selectedAdapter.probe({ refreshModels: true }),
    )
    const bindingResolution = resolveRuntimeBinding(runtimeBindings(), runtime.path, currentSelection.adapterId)
    const observedFingerprint = verifiedExecutableBinding(currentSelection, selectedProbe, bindingResolution)
    const currentFingerprint = await fingerprintExecutable(observedFingerprint.canonicalPath)
    if (!sameExecutableFingerprint(observedFingerprint, currentFingerprint)) {
      throw new Error("The selected agent executable changed during run preparation; probe and select it again")
    }
    if ((await runtime.engine.listRuns()).some((run) => run.state === "running") || activeAgentRuns.hasRoot(runtime.path)) {
      throw new Error("A GAEP agent process is already running in this Product root")
    }
    const initiativeFiles = (await readdir(join(runtime.path, ".gaep", "initiatives"))).filter((name) => name.endsWith(".json"))
    if (initiativeFiles.length === 0) throw new Error("Create an Initiative before preparing a run")
    const initiatives = await Promise.all(initiativeFiles.map((name) => runtime.engine.readInitiative(name.replace(/\.json$/, ""))))
    const activeInitiatives = initiatives.filter((initiative) => initiativeRunEligibility(initiative).eligible)
    const unavailableInitiatives = initiatives.filter((initiative) => !initiativeRunEligibility(initiative).eligible)
    if (activeInitiatives.length === 0) {
      const reasons = unavailableInitiatives.slice(0, 3).map((initiative) =>
        `${initiative.title} (${initiative.state}): ${initiativeRunEligibility(initiative).reason}`,
      )
      if (unavailableInitiatives.length > 3) reasons.push(`And ${unavailableInitiatives.length - 3} more unavailable Initiative(s).`)
      const action = await vscode.window.showWarningMessage(
        `Only active Initiatives can prepare a run. ${reasons.join(" ")}`,
        "Change Initiative State",
      )
      if (action === "Change Initiative State") await vscode.commands.executeCommand("gaep.changeInitiativeState")
      throw new WorkflowCancelled()
    }
    type InitiativePickItem = vscode.QuickPickItem & { initiative?: Initiative }
    const initiativeItems: InitiativePickItem[] = activeInitiatives.map((initiative) => ({
      label: initiative.title,
      description: "active",
      detail: initiative.outcome,
      initiative,
    }))
    initiativeItems.push(...unavailableInitiatives.map((initiative) => ({
      kind: vscode.QuickPickItemKind.Separator,
      label: `Unavailable: ${initiative.title} (${initiative.state}) — ${initiativeRunEligibility(initiative).reason}`,
    })))
    const picked = await vscode.window.showQuickPick(
      initiativeItems,
      { title: "Select an active bounded Initiative", ignoreFocusOut: true },
    )
    if (!picked?.initiative) throw new WorkflowCancelled()
    const eligibility = initiativeRunEligibility(picked.initiative)
    if (!eligibility.eligible) throw new Error(eligibility.reason ?? "The selected Initiative cannot prepare a run")
    const objective = await requiredInput("What should the selected agent accomplish in this run?")
    const executionProfile = await vscode.window.showQuickPick([{
      label: "Observe-only",
      description: "all writes and network access denied",
      detail: "Allows workspace analysis and local commands inside Codex's read-only, network-disabled sandbox. Staged workspace changes require the managed execution boundary planned for the next completion wave.",
      modifyMode: "deny" as const,
      expectedEffects: ["observe"] as const,
    }], {
      title: "Choose the CLI Charter permission profile",
      placeHolder: "Direct CLI execution is restricted to the technically enforced observe-only profile.",
      ignoreFocusOut: true,
    })
    if (!executionProfile) throw new WorkflowCancelled()
    const permissions: ToolPermission[] = [
      { capability: "read-workspace", mode: "allow", scope: ["."] },
      { capability: "modify-workspace", mode: executionProfile.modifyMode, scope: ["."] },
      { capability: "run-local-commands", mode: "allow", scope: ["."] },
      { capability: "network-access", mode: "deny", scope: [] },
      { capability: "commit", mode: "deny", scope: [] },
      { capability: "push", mode: "deny", scope: [] },
      { capability: "deploy", mode: "deny", scope: [] },
      { capability: "publish", mode: "deny", scope: [] },
      { capability: "external-communication", mode: "deny", scope: [] },
      { capability: "spend", mode: "deny", scope: [] },
      { capability: "privilege-change", mode: "deny", scope: [] },
      { capability: "delete", mode: "deny", scope: [] },
      { capability: "destructive-delete", mode: "deny", scope: [] },
    ]
    const charter = await runtime.engine.createCharter({
      initiativeId: picked.initiative.id,
      objective,
      permissions,
      expectedEffects: [...executionProfile.expectedEffects],
      forbiddenActions: ["Push, deploy, delete, publish, spend, or change privileges without an exact Authorization Grant."],
      stopConditions: ["Required authority is missing.", "The requested scope changes materially.", "An effect is partial, unknown, or cannot be verified."],
      requiredEvidence: ["Relevant tests and validation output", "Changed-file inventory", "Unresolved risks and limitations"],
    }, actorId)
    const confirmation = await vscode.window.showWarningMessage(
      [
        `Confirm charter for ${picked.initiative.title} using ${charter.agent.agentId} / ${charter.agent.modelId}.`,
        `Technical profile: ${executionProfile.label}. Workspace reads and local analysis commands are allowed; every workspace write and network effect is denied.`,
        "Codex's OS sandbox is the technical read-only and network boundary. Non-interactive approval mode refuses escalation.",
        "GAEP will not launch a provider whose declared interface cannot enforce this profile.",
      ].join("\n\n"),
      { modal: true },
      "Confirm Charter",
    )
    if (confirmation !== "Confirm Charter") throw new WorkflowCancelled()
    await runtime.engine.confirmCharter(charter.id, actorId)
    const prepared = await runtime.engine.prepareRun(charter.id, actorId)
    const preparedFingerprint = await fingerprintExecutable(prepared.invocation.executable)
    if (!sameExecutableFingerprint(currentFingerprint, preparedFingerprint)) {
      await runtime.engine.markRunState(prepared.run.id, "cancelled", { kind: "system", id: "gaep.vscode.binding" })
      throw new Error("The engine-prepared runtime no longer matches the confirmed machine-local binding; GAEP cancelled the run")
    }
    const finalConfirmation = await vscode.window.showWarningMessage(
      `Start the selected ${charter.agent.agentId} runtime? This confirmation is mandatory and distinct from charter confirmation.`,
      { modal: true },
      "Start Run",
    )
    if (finalConfirmation !== "Start Run") {
      await runtime.engine.markRunState(prepared.run.id, "cancelled", { kind: "human", id: actorId })
      throw new WorkflowCancelled()
    }
    if (!vscode.workspace.isTrusted) {
      await runtime.engine.markRunState(prepared.run.id, "cancelled", { kind: "system", id: "gaep.vscode.trust" })
      throw new Error("Workspace trust changed before process launch")
    }
    if (engine !== runtime.engine || selectedFolder?.uri.fsPath !== runtime.path) {
      await runtime.engine.markRunState(prepared.run.id, "cancelled", { kind: "system", id: "gaep.vscode.root-context" })
      throw new Error("The selected Product root changed before process launch; create a new charter in the current root")
    }
    let unregister = (): void => undefined
    const runTerminal = new AgentRunTerminal(
      runtime.engine,
      prepared.run.id,
      prepared.invocation,
      currentFingerprint,
      scheduleRefresh,
      () => {
        unregister()
        scheduleRefresh()
      },
    )
    try {
      unregister = activeAgentRuns.register(runTerminal)
    } catch (error) {
      await runtime.engine.markRunState(prepared.run.id, "cancelled", { kind: "system", id: "gaep.vscode.run-registry" })
      throw error
    }
    try {
      const terminal = vscode.window.createTerminal({
        name: `GAEP: ${picked.initiative.title}`,
        pty: runTerminal,
        iconPath: new vscode.ThemeIcon("hubot"),
      })
      terminal.show(true)
    } catch (error) {
      await runTerminal.stopAndWait().catch((stopError) => logDiagnostic("Provider cleanup after terminal creation failure failed", stopError))
      unregister()
      throw error
    }
    refresh()
  })))

  context.subscriptions.push(vscode.commands.registerCommand("gaep.verifyAudit", safely(async () => {
    const runtime = await requireRuntime()
    const result = await runtime.engine.repository.verifyAudit()
    if (result.valid) await vscode.window.showInformationMessage(`GAEP audit chain is valid (${result.events} events)`)
    else await vscode.window.showErrorMessage(`GAEP audit chain failed after ${result.events} events: ${result.error}`)
    refresh()
  })))

  context.subscriptions.push(
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      rotateStudioContext()
      void (async () => {
        try {
          const folder = selectedFolder ?? await initialRoot()
          if (folder) await configureRoot(folder, true)
          else refresh()
        } catch (error) {
          logDiagnostic("GAEP could not reconfigure after workspace trust changed", error)
          refresh()
        }
      })()
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void (async () => {
        const folders = vscode.workspace.workspaceFolders ?? []
        if (selectedFolder && folders.some((folder) => folder.uri.toString() === selectedFolder?.uri.toString())) return
        await waitForProductDomainMutation()
        rotateStudioContext()
        try {
          await stopActiveRuns("The selected Product root was removed from the workspace.", false)
        } catch (error) {
          recoveryDiagnostic = error instanceof Error ? error.message : "Unable to stop the provider process for the removed Product root"
          logDiagnostic("Selected Product root removal is blocked by an active provider process", error)
          refresh()
          return
        }
        selectedFolder = undefined
        engine = undefined
        recoveryDiagnostic = undefined
        gaepWatcher?.dispose()
        gaepWatcher = undefined
        try {
          const folder = await initialRoot()
          if (folder) await configureRoot(folder, vscode.workspace.isTrusted)
          else refresh()
        } catch (error) {
          logDiagnostic("GAEP could not select a replacement Product root", error)
          refresh()
        }
      })()
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration("gaep.codex.executable") && !event.affectsConfiguration("gaep.claude.executable")) return
      if (!selectedFolder) return
      if (activeAgentRuns.size > 0) {
        diagnostics.warn("Agent executable configuration changed during an active run. The current runtime remains pinned; retry recovery after the run exits to apply the new machine setting.")
        void vscode.window.showWarningMessage(
          "GAEP kept the current agent runtime because a provider process is active. After it exits, run GAEP: Retry Recovery to apply the new executable setting.",
        )
        return
      }
      void configureRoot(selectedFolder, false).catch((error) => {
        logDiagnostic("Agent executable configuration refresh failed", error)
        refresh()
      })
    }),
  )

  const folder = await initialRoot()
  if (folder) await configureRoot(folder, vscode.workspace.isTrusted)
  else refresh()
}

export async function deactivate(): Promise<void> {
  const stopped = await activeAgentRuns.stopAll(10_000)
  if (stopped.failures.length > 0 || stopped.remainingRunIds.length > 0) {
    const detail = stopped.failures.map((failure) => `${failure.runId}: ${failure.error}`).join("; ") ||
      `Still active: ${stopped.remainingRunIds.join(", ")}`
    throw new Error(`GAEP extension deactivation could not confirm provider-process exit: ${detail}`)
  }
}
