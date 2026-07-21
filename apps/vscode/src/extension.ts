import { lstat, readdir } from "node:fs/promises"
import { join } from "node:path"

import { CodexAdapter } from "@gaep/adapter-codex"
import { ClaudeAdapter } from "@gaep/adapter-claude"
import {
  capabilityDigest,
  fingerprintExecutable,
  type ExecutableFingerprint,
} from "@gaep/agent-sdk"
import {
  productProfileSchema,
  type AdapterCapabilities,
  type AgentSetting,
  type Initiative,
  type ToolPermission,
} from "@gaep/contracts"
import { GaepEngine, initiativeTransitions } from "@gaep/engine"
import * as vscode from "vscode"

import { ActiveRunRegistry } from "./run-registry.js"
import {
  runtimeBindingKey,
  sameExecutableFingerprint,
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

const actorId = "gaep.local-founder"
const selectedWorkspaceKey = "gaep.selectedWorkspaceUri"
const runtimeBindingsKey = "gaep.runtimeBindings.v1"
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
  let selectedFolder: vscode.WorkspaceFolder | undefined
  let engine: GaepEngine | undefined
  let recoveryDiagnostic: string | undefined
  let gaepWatcher: vscode.FileSystemWatcher | undefined
  let refreshTimer: NodeJS.Timeout | undefined
  let lastStatusDiagnostic: string | undefined

  const runtimeBindings = (): RuntimeBindingIndex =>
    context.globalState.get<RuntimeBindingIndex>(runtimeBindingsKey) ?? {}

  const rememberRuntimeBinding = async (
    workspacePath: string,
    adapterId: string,
    executablePath: string,
  ): Promise<ExecutableFingerprint> => {
    const fingerprint = await fingerprintExecutable(executablePath)
    const next = {
      ...runtimeBindings(),
      [runtimeBindingKey(workspacePath, adapterId)]: {
        ...fingerprint,
        adapterId,
        observedAt: new Date().toISOString(),
      },
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
  ] as const
  context.subscriptions.push(
    diagnostics,
    vscode.window.registerTreeDataProvider("gaep.overview", providers[0]),
    vscode.window.registerTreeDataProvider("gaep.agent", providers[1]),
    vscode.window.registerTreeDataProvider("gaep.governance", providers[2]),
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
    if (activeAgentRuns.size > 0) {
      throw new Error("GAEP cannot replace its Product root or runtime configuration while a provider process remains active")
    }
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

  const probeAgentsResilient = async (runtimeEngine: GaepEngine): Promise<AdapterCapabilities[]> => {
    const outcomes = await Promise.all([...runtimeEngine.adapters.values()].map(async (adapter) => {
      try {
        return await adapter.probe({ refreshModels: true })
      } catch (error) {
        logDiagnostic(`Agent probe failed for ${adapter.id}`, error)
        return undefined
      }
    }))
    return outcomes.filter((outcome): outcome is AdapterCapabilities => outcome !== undefined)
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

  context.subscriptions.push(
    vscode.commands.registerCommand("gaep.refresh", refresh),
    vscode.commands.registerCommand("gaep.showDiagnostics", () => {
      diagnostics.info(`Workspace trusted: ${vscode.workspace.isTrusted}`)
      diagnostics.info(`Selected Product root: ${selectedFolder?.uri.fsPath ?? "none"}`)
      diagnostics.info(`Recovery diagnostic: ${recoveryDiagnostic ?? "none"}`)
      diagnostics.info(`Managed active runs: ${activeAgentRuns.list().map((run) => run.runId).join(", ") || "none"}`)
      diagnostics.show(true)
    }),
    vscode.commands.registerCommand("gaep.manageWorkspaceTrust", () => vscode.commands.executeCommand("workbench.trust.manage")),
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
    const capabilities = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "GAEP is detecting installed agents", cancellable: false },
      () => probeAgentsResilient(runtime.engine),
    )
    const detected = capabilities.filter((capability) =>
      capability.detected && capability.executionInterface !== "unavailable",
    )
    if (detected.length === 0) {
      const reviewOnly = capabilities.filter((capability) => capability.detected)
      if (reviewOnly.length > 0) {
        throw new Error(
          `${reviewOnly.map((capability) => capability.agentLabel).join(", ")} was detected for capability review, but this release has no technically enforceable execution boundary for it.`,
        )
      }
      throw new Error("No supported installed agent was detected. Configure a machine-scoped executable path in User Settings.")
    }
    const agent = await vscode.window.showQuickPick(
      detected.map((capability) => ({
        label: capability.agentLabel,
        description: capability.runtimeVersion ?? "version unknown",
        detail: `${capability.limitations.join(" ")} The VS Code safety boundary removes elevated permission modes and direct live-search enablement.`,
        capability,
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
    let currentSelection
    try {
      currentSelection = await runtime.engine.readSelection()
    } catch {
      currentSelection = undefined
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
    if (!agent.capability.executablePath) throw new Error("The selected agent has no executable identity")
    await rememberRuntimeBinding(runtime.path, agent.capability.adapterId, agent.capability.executablePath)
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
    const selectedCapabilities = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "GAEP is revalidating the selected agent runtime", cancellable: false },
      () => selectedAdapter.probe({ refreshModels: true }),
    )
    if (!selectedCapabilities.detected || selectedCapabilities.executablePath !== currentSelection.runtimeExecutable) {
      throw new Error("The selected executable no longer matches the trusted machine-scoped agent configuration; select the agent again")
    }
    if (capabilityDigest(selectedCapabilities) !== currentSelection.capabilityDigest) {
      throw new Error("The selected agent capabilities changed; review and select the agent/model/settings again before creating a charter")
    }
    const storedBinding = runtimeBindings()[runtimeBindingKey(runtime.path, currentSelection.adapterId)]
    if (!storedBinding) {
      throw new Error("No machine-local executable fingerprint is bound to this selection; select the agent again before running")
    }
    const currentFingerprint = await fingerprintExecutable(currentSelection.runtimeExecutable)
    if (!sameExecutableFingerprint(storedBinding, currentFingerprint)) {
      throw new Error("The selected agent executable changed after selection; probe and select it again before running")
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
      { capability: "read-workspace", mode: "allow", scope: [runtime.path] },
      { capability: "modify-workspace", mode: executionProfile.modifyMode, scope: [runtime.path] },
      { capability: "run-local-commands", mode: "allow", scope: [runtime.path] },
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
    const finalConfirmation = await vscode.window.showWarningMessage(
      `Start the resolved runtime ${prepared.invocation.executable}? This confirmation is mandatory and distinct from charter confirmation.`,
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
