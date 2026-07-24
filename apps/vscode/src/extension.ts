import { randomUUID } from "node:crypto"
import { constants as fsConstants, type Stats } from "node:fs"
import { lstat, open, readdir } from "node:fs/promises"
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
  handoffSchema,
  productProfileSchema,
  type AdapterCapabilities,
  type AgentSelection,
  type AgentSetting,
  type Initiative,
} from "@gaep/contracts"
import {
  GaepEngine,
  initiativeTransitions,
  type ManagedExecutionReview,
} from "@gaep/engine"
import * as vscode from "vscode"

import { ActiveRunRegistry } from "./run-registry.js"
import { CurrentEngineStudioDataSource } from "./current-engine-studio-data-source.js"
import { observePortableHandoffs } from "./handoff-observation.js"
import { resolveLocalActorPrincipal } from "./local-actor.js"
import { readVerifiedManagedArtifacts } from "./managed-evidence-verifier.js"
import {
  managedRecoveryPassPresentation,
  privacySafeRecoveryDiagnostic,
  revalidateManagedDiscardAfterError,
} from "./managed-recovery-presentation.js"
import { ManagedRunSession } from "./managed-run-session.js"
import { runPortableDesignImportWorkflow } from "./portable-design-workflow.js"
import { manualModelEntryCopy } from "./provider-truth.js"
import {
  buildManagedWorkflowEnvelope,
  buildRunToolSelectionInput,
  createHumanWorkflowGateEvaluator,
  humanWorkflowGatePrompt,
  toolSelectionSummary,
} from "./managed-workflow.js"
import {
  resolveRuntimeBinding,
  runtimeBindingKey,
  sameExecutableFingerprint,
  verifiedExecutableBinding,
  type RuntimeBinding,
  type RuntimeBindingIndex,
} from "./runtime-binding.js"
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

function sameStableFile(left: Stats, right: Stats): boolean {
  return left.isFile() && right.isFile() &&
    left.dev !== 0 && left.ino !== 0 && right.dev !== 0 && right.ino !== 0 &&
    left.dev === right.dev && left.ino === right.ino && left.size === right.size &&
    left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs
}

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
  const custom = { label: manualModelEntryCopy.label, description: manualModelEntryCopy.description, id: "" }
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
  return picked.id || requiredInput(manualModelEntryCopy.prompt)
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

type ManagedReviewSnapshot = Pick<ManagedExecutionReview, "record" | "result" | "evidence">

function managedEvidenceEventDiagnostic(
  event: ManagedExecutionReview["evidence"]["events"][number],
): string {
  const prefix = `Managed event ${event.sequence}`
  switch (event.type) {
    case "lifecycle": return `${prefix}: lifecycle ${event.phase}${event.turnStatus ? ` (${event.turnStatus})` : ""}`
    case "output": return `${prefix}: ${event.channel} output, ${event.byteLength} byte(s), ${event.redactionCount} redaction(s)`
    case "item": return `${prefix}: ${event.itemType} ${event.status}`
    case "approval": return `${prefix}: ${event.approvalKind} approval ${event.outcome}`
    case "warning": return `${prefix}: warning ${event.code}`
    case "error": return `${prefix}: error ${event.code}${event.retryable ? " (retryable)" : ""}`
  }
}

function managedReviewDocument(snapshot: ManagedReviewSnapshot): string {
  const staging = snapshot.evidence.staging
  const changes = staging?.changes ?? []
  const inventory = changes.length > 0
    ? changes.map((change, index) => [
        `${index + 1}. **${change.kind.toUpperCase()}** \`${change.path}\``,
        `   - Before: ${change.beforeDigest ?? "absent"}; ${change.beforeSize ?? 0} byte(s); mode ${change.beforeMode?.toString(8) ?? "absent"}`,
        `   - After: ${change.afterDigest ?? "absent"}; ${change.afterSize ?? 0} byte(s); mode ${change.afterMode?.toString(8) ?? "absent"}`,
      ].join("\n")).join("\n")
    : "No staged workspace file changes were recorded."
  return [
    "# GAEP Managed Run Review",
    "",
    `- Managed Run: \`${snapshot.record.id}\``,
    `- Underlying Run: \`${snapshot.record.runId}\``,
    `- State: **${snapshot.record.state}**`,
    `- Provider disposition: **${snapshot.result.providerDisposition}**`,
    `- Outcome: **${snapshot.result.outcome.status}** (${snapshot.result.outcome.basis})`,
    `- Evidence: \`${snapshot.evidence.id}\``,
    `- Evidence digest: \`${canonicalDigest(snapshot.evidence)}\``,
    `- Bindings digest: \`${snapshot.record.bindingsDigest}\``,
    `- Apply state: **${staging?.applyState ?? "not-applicable"}**`,
    `- Warnings: ${snapshot.result.warnings.join(", ") || "none"}`,
    "",
    "## Exact changed-file inventory",
    "",
    inventory,
    "",
    "## Review boundary",
    "",
    "This view contains the complete engine-recorded path, kind, digest, size, and mode inventory. Provider output remains redacted/digest-only, and the current engine does not expose staged file contents to the host. Applying confirms this exact inventory and write envelope; it does not convert provider completion into independently verified Product outcome completion.",
    "",
  ].join("\n")
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

  const recordRecoveryFailure = (message: string, error: unknown): void => {
    const safe = privacySafeRecoveryDiagnostic(error)
    recoveryDiagnostic = safe.message
    diagnostics.error(`${message}: ${safe.diagnostic}`)
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
    if (engine) {
      const pendingReviews = await engine.listPendingManagedReviewStatuses()
      if (pendingReviews.length > 0) {
        throw new Error("Resolve or discard every pending Managed Run review before replacing the Product root or runtime configuration")
      }
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
    diagnostics.info(`Selected Product root: ${folder.name} (machine path withheld)`)
    if (recover && vscode.workspace.isTrusted) {
      try {
        const recovered = await engine.recoverInterruptedRuns("gaep.vscode.restart")
        if (recovered.length > 0) {
          diagnostics.warn(
            `Recovery pass returned ${recovered.length} Managed Run record(s) for persisted-state review; recovery, cleanup, apply, and outcome completion are not inferred.`,
          )
        }
      } catch (error) {
        recordRecoveryFailure("Interrupted-run recovery is deferred; GAEP remains in diagnostic mode", error)
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

  const safely = <TArgs extends unknown[]>(
    operation: (...args: TArgs) => Promise<void>,
  ): ((...args: TArgs) => Promise<void>) => async (...args: TArgs) => {
    try {
      await operation(...args)
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
    listHandoffs: async () => {
      const runtimeEngine = engine
      if (!runtimeEngine) return {
        records: [], total: 0, selectedFileCount: 0, omittedOutsideWindow: 0, omittedForResourceSafety: 0,
        platformAttestationUnavailable: false,
      }
      const handoffFile = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/iu
      let names: string[]
      try {
        names = (await runtimeEngine.repository.readDirectory(runtimeEngine.repository.resolve("handoffs")))
          .filter((name) => handoffFile.test(name))
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") return {
          records: [], total: 0, selectedFileCount: 0, omittedOutsideWindow: 0, omittedForResourceSafety: 0,
          platformAttestationUnavailable: false,
        }
        throw error
      }
      const noFollowOpenFlags = process.platform === "win32" || typeof fsConstants.O_NOFOLLOW !== "number"
        ? undefined
        : fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW
      if (noFollowOpenFlags === undefined) {
        logDiagnostic("Portable handoff contents are withheld because this native platform cannot attest no-follow file identity")
      }
      const observation = await observePortableHandoffs(names, {
        read: async (name, maxBytes) => {
          if (noFollowOpenFlags === undefined) return { status: "omitted" }
          try {
            const path = runtimeEngine.repository.resolve("handoffs", name)
            const before = await lstat(path)
            if (!before.isFile() || before.isSymbolicLink() || !Number.isSafeInteger(before.size) ||
                before.size < 0 || before.size > maxBytes) {
              return { status: "omitted" }
            }
            const handle = await open(path, noFollowOpenFlags)
            try {
              const opened = await handle.stat()
              if (!sameStableFile(before, opened) || !Number.isSafeInteger(opened.size) ||
                  opened.size < 0 || opened.size > maxBytes) {
                return { status: "omitted" }
              }
              const bytes = Buffer.alloc(opened.size + 1)
              let byteLength = 0
              while (byteLength < bytes.length) {
                const chunk = await handle.read(bytes, byteLength, bytes.length - byteLength, byteLength)
                if (chunk.bytesRead === 0) break
                byteLength += chunk.bytesRead
              }
              const after = await handle.stat()
              const currentPath = await lstat(path)
              if (byteLength !== opened.size || !sameStableFile(opened, after) ||
                  currentPath.isSymbolicLink() || !sameStableFile(after, currentPath)) {
                return { status: "omitted" }
              }
              return {
                status: "read",
                record: handoffSchema.parse(JSON.parse(
                  new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, byteLength)),
                )),
                byteLength,
              }
            } finally {
              await handle.close()
            }
          } catch (error) {
            logDiagnostic(`Portable handoff ${name} was withheld because stable bounded file identity could not be attested`, error)
            return { status: "omitted" }
          }
        },
      })
      return { ...observation, platformAttestationUnavailable: noFollowOpenFlags === undefined }
    },
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
    if (action.workflow === "import-portable-design-snapshot") {
      const outcome = await runPortableDesignImportWorkflow({
        trusted: () => vscode.workspace.isTrusted,
        contextGeneration: () => studioContextGeneration,
        productRootIdentity: () => selectedFolder?.uri.toString(),
        actorId: () => actorId,
        readProduct: () => runtime.engine.readProduct(),
        importSnapshot: (input, importActorId) => withProductDomainMutation(async () => {
          await assertWorkflowContext()
          return studio.importPortableDesignSnapshot(input, importActorId)
        }),
      }, {
        selectLocalBundleFolder: async () => {
          const selected = await vscode.window.showOpenDialog({
            title: "Select one local portable design bundle folder",
            openLabel: "Select Local Bundle Folder",
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
          })
          const source = selected?.[0]
          return source ? { scheme: source.scheme, path: source.fsPath, kind: "folder" } : undefined
        },
        confirmImport: async (binding) => {
          const confirmed = await vscode.window.showWarningMessage(
            `Import the selected local bundle into ${binding.name} at Product revision ${binding.revision}? GAEP will save only validated metadata and digests. The result remains pending human review even when upstream sourceReview says approved.`,
            { modal: true },
            "Import as Pending Review",
          )
          return confirmed === "Import as Pending Review"
        },
      })
      if (outcome.status === "cancelled") throw new WorkflowCancelled()
      refresh()
      await vscode.window.showInformationMessage(outcome.announcement)
      return {
        bundleId: outcome.snapshot.bundleId,
        productId: outcome.snapshot.productId,
        governanceState: outcome.snapshot.governance.state,
        sourceReviewStatus: outcome.snapshot.sourceReview.status,
        artifactCount: outcome.snapshot.artifacts.length,
        importedAt: outcome.snapshot.evidence.importedAt,
      }
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
      diagnostics.info(`Selected Product root: ${selectedFolder?.name ?? "none"} (machine path withheld)`)
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
      if (recoveryDiagnostic || !engine) {
        await vscode.window.showWarningMessage(
          recoveryDiagnostic ?? "Recovery remains deferred because persisted state could not be reread.",
          "Show Diagnostics",
        ).then((selected) => {
          if (selected === "Show Diagnostics") diagnostics.show(true)
        })
        return
      }
      let audit: Awaited<ReturnType<GaepEngine["repository"]["verifyAudit"]>>
      let page: Awaited<ReturnType<GaepEngine["listManagedRunsPage"]>>
      try {
        [audit, page] = await Promise.all([
          engine.repository.verifyAudit(),
          engine.listManagedRunsPage({ offset: 0, limit: 200 }),
        ])
      } catch (error) {
        recordRecoveryFailure("Recovery inventory revalidation is deferred", error)
        refresh()
        await vscode.window.showWarningMessage(
          "GAEP could not revalidate the persisted recovery inventory. No recovery, cleanup, apply, or outcome success is claimed.",
          "Show Diagnostics",
        ).then((selected) => {
          if (selected === "Show Diagnostics") diagnostics.show(true)
        })
        return
      }
      const presentation = managedRecoveryPassPresentation(page.items, audit.valid, page.limit, page.total)
      if (presentation.level === "warning") await vscode.window.showWarningMessage(presentation.message)
      else await vscode.window.showInformationMessage(presentation.message)
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

  type ManagedRuntimeContext = { engine: GaepEngine; path: string }
  interface ManagedLaunchRequest {
    runtime: ManagedRuntimeContext
    selection: AgentSelection
    runId: string
    workflowPlanId: string
    runToolSelectionId?: string
    initiativeTitle: string
    previousManagedRunId?: string
  }

  const revalidateManagedRuntime = async (
    runtime: ManagedRuntimeContext,
    selection: AgentSelection,
  ): Promise<ExecutableFingerprint> => {
    const adapter = runtime.engine.adapters.get(selection.adapterId)
    if (!adapter) throw new Error("The selected agent adapter is unavailable; select the agent again")
    const probe = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "GAEP is revalidating the exact managed runtime", cancellable: false },
      () => adapter.probe({ refreshModels: true }),
    )
    const resolution = resolveRuntimeBinding(runtimeBindings(), runtime.path, selection.adapterId)
    const observed = verifiedExecutableBinding(selection, probe, resolution)
    const current = await fingerprintExecutable(observed.canonicalPath)
    if (!sameExecutableFingerprint(observed, current)) {
      throw new Error("The selected agent executable changed during managed run preparation; probe and select it again")
    }
    return current
  }

  const openManagedReview = async (snapshot: ManagedReviewSnapshot): Promise<void> => {
    const document = await vscode.workspace.openTextDocument({
      language: "markdown",
      content: managedReviewDocument(snapshot),
    })
    await vscode.window.showTextDocument(document, { preview: true, preserveFocus: false })
  }

  const workflowGateEvaluator = createHumanWorkflowGateEvaluator(actorId, async (request) => {
    if (request.signal.aborted) return "not-assessed"
    const prompt = humanWorkflowGatePrompt(request)
    const actions = [
      ...(prompt.canAttest ? [prompt.satisfiedLabel] : []),
      "Record Failed",
      "Not Assessed",
    ]
    const decision = await vscode.window.showWarningMessage(
      `${prompt.title}\n\n${prompt.message}`,
      { modal: true },
      ...actions,
    )
    if (request.signal.aborted) return "not-assessed"
    if (decision === prompt.satisfiedLabel) return "satisfied"
    if (decision === "Record Failed") return "failed"
    return "not-assessed"
  })

  const maybeOfferManagedJournalDisposal = (review: ManagedExecutionReview): void => {
    if (!review.hasLocalJournal || review.canApply || review.canDiscard) return
    void vscode.window.showInformationMessage(
      `Managed Run ${review.record.id} retained a machine-local recovery journal after ${review.record.state}. Keep it until you no longer need local recovery evidence.`,
      "Dispose Local Recovery Journal",
    ).then(async (action) => {
      if (action !== "Dispose Local Recovery Journal") return
      try {
        await review.disposeLocalJournal()
        diagnostics.info(
          `Local journal disposal request returned for Managed Run ${review.record.id}; persisted cleanup success is not independently verified or claimed.`,
        )
      } catch (error) {
        const safe = privacySafeRecoveryDiagnostic(error)
        diagnostics.error(`Local recovery journal disposal could not be verified: ${safe.diagnostic}`)
      }
    })
  }

  const managedRecoveryBoundaryFailure = (contextMessage: string, error: unknown): Error => {
    const safe = privacySafeRecoveryDiagnostic(error)
    diagnostics.error(`${contextMessage}: ${safe.diagnostic}`)
    return new Error(
      "GAEP could not verify the persisted Managed Run recovery boundary. No apply, discard, cleanup, recovery, or outcome success is claimed.",
    )
  }

  const verifyPersistedManagedReview = async (
    runtime: ManagedRuntimeContext,
    review: ManagedExecutionReview,
    previousRevision?: number,
  ): Promise<ManagedExecutionReview["record"]> => {
    try {
      const [persisted, audit] = await Promise.all([
        runtime.engine.readManagedRun(review.record.id),
        runtime.engine.repository.verifyAudit(),
      ])
      if (!audit.valid || persisted.id !== review.record.id || persisted.revision !== review.record.revision ||
          persisted.state !== review.record.state ||
          (previousRevision !== undefined && persisted.revision <= previousRevision)) {
        throw new Error("persisted Managed Run review binding did not revalidate")
      }
      return persisted
    } catch (error) {
      const safe = privacySafeRecoveryDiagnostic(error)
      diagnostics.error(`Managed Run review persistence could not be verified: ${safe.diagnostic}`)
      throw new Error("GAEP could not verify persisted Managed Run state after the review action. No apply, discard, cleanup, or outcome success is claimed.")
    }
  }

  const reviewManagedRun = async (
    initial: ManagedExecutionReview,
    runtime: ManagedRuntimeContext,
    allowResume: boolean,
  ): Promise<"done" | "resume"> => {
    let review = initial
    while (review.canApply || review.canDiscard) {
      const changeCount = review.evidence.staging?.changes.length ?? 0
      const actions = ["Open Exact Inventory"]
      if (review.canApply) actions.push("Apply Exact Reviewed Inventory")
      if (review.canDiscard) actions.push("Discard Staged Changes")
      actions.push("Keep Pending")
      const action = await vscode.window.showWarningMessage(
        [
          `Managed Run ${review.record.id} is ${review.record.state}.`,
          `${changeCount} staged file change(s); outcome ${review.result.outcome.status}; evidence ${review.evidence.id}.`,
          "No source-workspace mutation occurs unless you explicitly apply the exact reviewed inventory.",
        ].join("\n\n"),
        { modal: true },
        ...actions,
      )
      if (action === "Open Exact Inventory") {
        try {
          await openManagedReview(review)
        } catch (error) {
          throw managedRecoveryBoundaryFailure("Managed Run exact inventory could not be opened", error)
        }
        continue
      }
      if (action === "Apply Exact Reviewed Inventory") {
        if (!vscode.workspace.isTrusted || engine !== runtime.engine || selectedFolder?.uri.fsPath !== runtime.path) {
          throw new Error("Workspace trust or Product root changed before apply; the staged review remains pending")
        }
        const confirmation = review.applyConfirmation
        if (!confirmation) throw new Error("The engine did not expose an exact apply confirmation for this review")
        const previousRevision = review.record.revision
        try {
          review = await review.apply({ confirmation }, actorId)
        } catch (error) {
          throw managedRecoveryBoundaryFailure("Managed Run apply transition could not be verified", error)
        }
        await verifyPersistedManagedReview(runtime, review, previousRevision)
        diagnostics.info(`Managed Run ${review.record.id} apply decision ended in ${review.record.state}`)
        scheduleRefresh()
        continue
      }
      if (action === "Discard Staged Changes") {
        const previousRevision = review.record.revision
        try {
          review = await review.discard(actorId)
        } catch (error) {
          throw managedRecoveryBoundaryFailure("Managed Run discard transition could not be verified", error)
        }
        await verifyPersistedManagedReview(runtime, review, previousRevision)
        diagnostics.info(
          `Managed Run ${review.record.id} persisted state ${review.record.state}; machine-local cleanup and provider outcome remain separate claims.`,
        )
        scheduleRefresh()
        continue
      }
      void vscode.window.showWarningMessage(
        "The review remains pending only in this engine session. After an extension restart the current engine can recover and discard the durable stage, but it cannot safely reconstruct apply authority.",
      )
      return "done"
    }
    const persisted = await verifyPersistedManagedReview(runtime, review)
    void vscode.window.showInformationMessage(
      `Managed Run ${persisted.id} has persisted state ${persisted.state}. This does not independently attest provider outcome or machine-local cleanup.`,
    )
    maybeOfferManagedJournalDisposal(review)
    if (allowResume && review.record.state === "unknown") {
      const action = await vscode.window.showWarningMessage(
        "This Managed Run is unknown. Resume is available only while the exact machine-local provider binding remains in this engine session; restart recovery cannot recreate it.",
        { modal: true },
        "Resume Exact Run",
      )
      if (action === "Resume Exact Run") return "resume"
    }
    return "done"
  }

  let launchManagedSession: (request: ManagedLaunchRequest) => Promise<void>
  launchManagedSession = async (request): Promise<void> => {
    const { runtime, selection } = request
    if (!vscode.workspace.isTrusted || engine !== runtime.engine || selectedFolder?.uri.fsPath !== runtime.path) {
      throw new Error("Workspace trust or Product root changed before managed process launch")
    }
    const persistedSelection = await runtime.engine.readSelection()
    if (canonicalDigest(persistedSelection) !== canonicalDigest(selection)) {
      throw new Error("Agent, model, or settings changed before managed process launch")
    }
    let handle: Awaited<ReturnType<GaepEngine["startManagedRun"]>>
    try {
      if (activeAgentRuns.hasRoot(runtime.path)) throw new Error("A GAEP managed provider is already active in this Product root")
      const action = await vscode.window.showWarningMessage(
        `${request.previousManagedRunId ? "Resume" : "Start"} the exact managed run for ${request.initiativeTitle}? Workflow gates require explicit human assessment. Codex writes remain isolated until exact apply; Claude remains context-only.`,
        { modal: true },
        request.previousManagedRunId ? "Resume Managed Run" : "Start Managed Run",
      )
      const expectedAction = request.previousManagedRunId ? "Resume Managed Run" : "Start Managed Run"
      if (action !== expectedAction) throw new WorkflowCancelled()
      await revalidateManagedRuntime(runtime, selection)
      if (!vscode.workspace.isTrusted || engine !== runtime.engine || selectedFolder?.uri.fsPath !== runtime.path) {
        throw new Error("Workspace trust or Product root changed during managed process confirmation")
      }
      handle = await runtime.engine.startManagedRun({
        runId: request.runId,
        workflowPlanId: request.workflowPlanId,
        runToolSelectionId: request.runToolSelectionId,
        previousManagedRunId: request.previousManagedRunId,
        evaluateWorkflowGate: workflowGateEvaluator,
      }, actorId)
    } catch (error) {
      if (!request.previousManagedRunId) {
        await runtime.engine.markRunState(
          request.runId,
          "cancelled",
          { kind: error instanceof WorkflowCancelled ? "human" : "system", id: actorId },
        ).catch(() => undefined)
      }
      throw error
    }
    let unregister = (): void => undefined
    let resumeRequested = false
    const session = new ManagedRunSession(runtime.path, handle, {
      onEvent: (event) => {
        diagnostics.info(managedEvidenceEventDiagnostic(event))
        scheduleRefresh()
      },
      onReview: async (review) => {
        diagnostics.info(`Managed Run ${review.record.id} reached ${review.record.state}`)
        resumeRequested = await reviewManagedRun(review, runtime, true) === "resume"
      },
      onError: (error) => {
        logDiagnostic(`Managed Run ${handle.record.id} failed`, error)
        void vscode.window.showErrorMessage(`Managed Run failed: ${error.message}`, "Show Diagnostics").then((selected) => {
          if (selected === "Show Diagnostics") diagnostics.show(true)
        })
      },
      onSettled: () => {
        unregister()
        scheduleRefresh()
        if (resumeRequested) {
          setTimeout(() => {
            void safely(() => launchManagedSession({
              ...request,
              previousManagedRunId: handle.record.id,
            }))()
          }, 0)
        }
      },
    })
    try {
      unregister = activeAgentRuns.register(session)
    } catch (error) {
      await session.stopAndWait().catch((stopError) => logDiagnostic("Managed provider cleanup after registry failure failed", stopError))
      throw error
    }
    diagnostics.info(`Managed Run ${session.runId} started for underlying Run ${request.runId}`)
    void vscode.window.showInformationMessage(
      `Managed Run started for ${request.initiativeTitle}. Use “GAEP: Cancel Active Managed Run” to stop it.`,
    )
    refresh()
  }

  const resolvePendingManagedReview = async (
    runtime: ManagedRuntimeContext,
    requestedManagedRunId?: string,
    mode: "full" | "discard-only" = "full",
    expectedRevision?: number,
  ): Promise<boolean> => {
    let allStatuses: Awaited<ReturnType<GaepEngine["listPendingManagedReviewStatuses"]>>
    try {
      allStatuses = await runtime.engine.listPendingManagedReviewStatuses()
    } catch (error) {
      throw managedRecoveryBoundaryFailure("Pending Managed Run status lookup failed", error)
    }
    const statuses = requestedManagedRunId
      ? allStatuses.filter((status) => status.managedRunId === requestedManagedRunId)
      : allStatuses
    if (statuses.length === 0) {
      if (requestedManagedRunId) {
        throw new Error("The selected Managed Run is no longer awaiting a supported discard review. Refresh Runs & Evidence.")
      }
      return false
    }
    let choices: Array<{
      label: string
      description: string
      detail: string
      status: (typeof statuses)[number]
      record: Awaited<ReturnType<GaepEngine["readManagedRun"]>>
    }>
    try {
      choices = await Promise.all(statuses.map(async (status) => {
        const record = await runtime.engine.readManagedRun(status.managedRunId)
        return {
          label: `Managed Run ${record.id}`,
          description: record.state,
          detail: mode === "discard-only"
            ? "Recovery view permits exact inspection or discard only; it does not offer apply"
            : status.canApply
              ? "In-session exact apply or discard is available"
              : "Durable apply is unavailable; exact inspection and discard remain available",
          status,
          record,
        }
      }))
    } catch (error) {
      throw managedRecoveryBoundaryFailure("Pending Managed Run records could not be revalidated", error)
    }
    const picked = choices.length === 1 ? choices[0] : await vscode.window.showQuickPick(choices, {
      title: "Resolve a pending Managed Run review",
      ignoreFocusOut: true,
    })
    if (!picked) throw new WorkflowCancelled()
    const record = picked.record
    if (expectedRevision !== undefined && record.revision !== expectedRevision) {
      throw new Error("The selected Managed Run changed after this recovery action was offered. Refresh Runs & Evidence.")
    }
    let result: Awaited<ReturnType<GaepEngine["readManagedRunResult"]>>
    let evidence: Awaited<ReturnType<GaepEngine["readManagedRunEvidence"]>>
    try {
      const artifacts = await readVerifiedManagedArtifacts(record, {
        readResult: (id) => runtime.engine.readManagedRunResult(id),
        readEvidence: (id) => runtime.engine.readManagedRunEvidence(id),
        readApplyDecision: (id) => runtime.engine.readManagedApplyDecision(id),
      })
      const [audit, revalidatedRecord] = await Promise.all([
        runtime.engine.repository.verifyAudit(),
        runtime.engine.readManagedRun(record.id),
      ])
      if (!audit.valid || canonicalDigest(revalidatedRecord) !== canonicalDigest(record) ||
          !artifacts.result || !artifacts.evidence) {
        throw new Error("pending Managed Run review binding did not revalidate")
      }
      result = artifacts.result
      evidence = artifacts.evidence
    } catch (error) {
      throw managedRecoveryBoundaryFailure("Pending Managed Run evidence could not be revalidated", error)
    }
    while (true) {
      const actions = ["Open Exact Inventory"]
      if (mode === "full" && picked.status.canApply && picked.status.applyConfirmation) {
        actions.push("Apply Exact Reviewed Inventory")
      }
      if (picked.status.canDiscard) actions.push("Discard Staged Changes")
      actions.push("Keep Pending")
      const action = await vscode.window.showWarningMessage(
        `Managed Run ${record.id} is ${record.state} with ${evidence.staging?.changes.length ?? 0} staged file change(s).`,
        { modal: true },
        ...actions,
      )
      if (action === "Open Exact Inventory") {
        try {
          await openManagedReview({ record, result, evidence })
        } catch (error) {
          throw managedRecoveryBoundaryFailure("Managed Run exact inventory could not be opened", error)
        }
        continue
      }
      if (action === "Apply Exact Reviewed Inventory" && picked.status.applyConfirmation) {
        if (!vscode.workspace.isTrusted || engine !== runtime.engine || selectedFolder?.uri.fsPath !== runtime.path) {
          throw new Error("Workspace trust or Product root changed before apply; the staged review remains pending")
        }
        let review: ManagedExecutionReview
        try {
          review = await runtime.engine.applyPendingManagedReview(
            record.id,
            { confirmation: picked.status.applyConfirmation },
            actorId,
          )
        } catch (error) {
          throw managedRecoveryBoundaryFailure("Pending Managed Run apply transition could not be verified", error)
        }
        await verifyPersistedManagedReview(runtime, review, record.revision)
        await reviewManagedRun(review, runtime, false)
        return true
      }
      if (action === "Discard Staged Changes") {
        let review: ManagedExecutionReview
        try {
          review = await runtime.engine.discardPendingManagedReview(record.id, actorId)
          await verifyPersistedManagedReview(runtime, review, record.revision)
        } catch (error) {
          const safe = privacySafeRecoveryDiagnostic(error)
          diagnostics.error(`Managed Run discard could not be verified: ${safe.diagnostic}`)
          const revalidation = await revalidateManagedDiscardAfterError(record, {
            readManagedRun: (id) => runtime.engine.readManagedRun(id),
            verifyAudit: () => runtime.engine.repository.verifyAudit(),
          })
          scheduleRefresh()
          if (revalidation.status === "persisted-discarded") {
            await vscode.window.showInformationMessage(revalidation.message)
          } else {
            await vscode.window.showWarningMessage(
              revalidation.message,
              "Show Diagnostics",
            ).then((selected) => {
              if (selected === "Show Diagnostics") diagnostics.show(true)
            })
          }
          return true
        }
        void vscode.window.showInformationMessage(
          `Managed Run ${review.record.id} has persisted state discarded. Machine-local cleanup is not claimed; review recovery state separately.`,
        )
        scheduleRefresh()
        return true
      }
      return true
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("gaep.cancelActiveRun", safely(async () => {
      if (activeAgentRuns.size === 0) {
        await vscode.window.showInformationMessage("No GAEP managed provider is active.")
        return
      }
      await stopActiveRuns("Cancelling active Managed Run(s).", true)
      refresh()
    })),
    vscode.commands.registerCommand("gaep.reviewManagedRun", safely(async (
      requestedManagedRunId?: unknown,
      requestedMode?: unknown,
      requestedRevision?: unknown,
    ) => {
      if (requestedManagedRunId !== undefined && (
        typeof requestedManagedRunId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(requestedManagedRunId)
      )) {
        throw new Error("The requested Managed Run identity is invalid")
      }
      const mode = requestedMode === undefined || requestedMode === "full"
        ? "full"
        : requestedMode === "discard-only"
          ? "discard-only"
          : undefined
      if (!mode) throw new Error("The requested Managed Run review mode is unsupported")
      if (requestedRevision !== undefined && (
        typeof requestedRevision !== "number" || !Number.isInteger(requestedRevision) || requestedRevision < 1
      )) {
        throw new Error("The requested Managed Run revision is invalid")
      }
      const runtime = await requireRuntime()
      if (!await resolvePendingManagedReview(
        runtime,
        requestedManagedRunId,
        mode,
        requestedRevision,
      )) {
        await vscode.window.showInformationMessage("No Managed Run is awaiting staged review.")
      }
    })),
  )

  context.subscriptions.push(vscode.commands.registerCommand("gaep.prepareRun", safely(async () => {
    const runtime = await requireRuntime()
    if (await resolvePendingManagedReview(runtime)) return
    const currentSelection = await runtime.engine.readSelection()
    const unsafe = unsafeSelectionReasons(currentSelection.agentId, currentSelection.settings)
    if (unsafe.length > 0) throw new Error(`Reselect the agent before running: ${unsafe.join("; ")}`)
    await revalidateManagedRuntime(runtime, currentSelection)
    if ((await runtime.engine.listRuns()).some((run) => run.state === "running") || activeAgentRuns.hasRoot(runtime.path)) {
      throw new Error("A GAEP managed provider or unresolved Run is already active in this Product root")
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
    const pickedInitiative = await vscode.window.showQuickPick(
      initiativeItems,
      { title: "Select an active bounded Initiative", ignoreFocusOut: true },
    )
    if (!pickedInitiative?.initiative) throw new WorkflowCancelled()
    const eligibility = initiativeRunEligibility(pickedInitiative.initiative)
    if (!eligibility.eligible) throw new Error(eligibility.reason ?? "The selected Initiative cannot prepare a run")

    const allPlans = await runtime.engine.productStudio.listWorkflowPlans()
    const resolvedPlans = allPlans.filter((plan) => plan.state === "resolved")
    const compatiblePlans = resolvedPlans.filter((plan) => plan.steps.every((step) =>
      step.responsibility.kind === "agent" &&
      (step.responsibility.id === currentSelection.agentId || step.responsibility.id === currentSelection.adapterId),
    ))
    if (compatiblePlans.length === 0) {
      throw new Error(
        resolvedPlans.length === 0
          ? "Create and resolve a Workflow Plan before preparing a managed run"
          : "No resolved Workflow Plan assigns every step to the exact selected agent; revise the Plan or selection",
      )
    }
    const pickedPlan = await vscode.window.showQuickPick(
      compatiblePlans.map((plan) => ({
        label: plan.title,
        description: `${plan.steps.length} step(s), ${plan.toolDefinitions.length} Tool(s), ${plan.contextPacks.length} Context Pack(s)`,
        detail: plan.objective,
        plan,
      })),
      { title: "Select the exact resolved Workflow Plan", ignoreFocusOut: true },
    )
    if (!pickedPlan) throw new WorkflowCancelled()
    const plan = pickedPlan.plan
    const tools = await Promise.all(plan.toolDefinitions.map((reference) =>
      runtime.engine.productStudio.readToolDefinition(reference.recordId)))
    const envelope = buildManagedWorkflowEnvelope(plan, tools, currentSelection.adapterId)
    const objective = await requiredInput("Confirm or refine the bounded run objective", { value: plan.objective })
    const scopeSummary = envelope.managedIntent.requestedScopes.map((scope) => JSON.stringify(scope)).join(", ") || "none"
    const toolSummary = toolSelectionSummary(
      { tools: plan.toolDefinitions },
      tools,
    )
    const charter = await runtime.engine.createCharter({
      initiativeId: pickedInitiative.initiative.id,
      objective,
      permissions: envelope.permissions,
      expectedEffects: envelope.expectedEffects,
      forbiddenActions: [
        "Do not exceed the exact Workflow Plan, Context Pack, Tool, effect, or workspace scope bindings.",
        "Do not push, deploy, publish, communicate externally, spend, elevate privilege, or perform destructive actions.",
      ],
      stopConditions: envelope.stopConditions.length > 0
        ? envelope.stopConditions
        : ["Stop when authority, scope, evidence, runtime identity, or outcome cannot be verified."],
      requiredEvidence: envelope.requiredEvidence,
      managedIntent: envelope.managedIntent,
    }, actorId)
    const charterConfirmation = await vscode.window.showWarningMessage(
      [
        `Confirm the exact managed Charter for ${pickedInitiative.initiative.title}.`,
        `Agent/model: ${charter.agent.agentId} / ${charter.agent.modelId}`,
        `Workflow: ${plan.title} revision ${plan.revision}`,
        `Context Packs: ${plan.contextPacks.length}; Tools: ${tools.length}; effects: ${envelope.expectedEffects.join(", ") || "none"}; write scopes: ${scopeSummary}.`,
        toolSummary.length > 0 ? `Tool inventory:\n${toolSummary.join("\n")}` : "No Tool Definition is selected.",
        "This Charter grants only the displayed envelope. Tool selection, process start, Workflow gates, and staged apply remain separate decisions.",
      ].join("\n\n"),
      { modal: true },
      "Confirm Managed Charter",
    )
    if (charterConfirmation !== "Confirm Managed Charter") throw new WorkflowCancelled()
    await runtime.engine.confirmCharter(charter.id, actorId)
    const run = await runtime.engine.prepareManagedRun(charter.id, actorId)
    let runToolSelectionId: string | undefined
    if (tools.length > 0 || envelope.managedIntent.requestedScopes.length > 0) {
      const confirmation = await vscode.window.showWarningMessage(
        [
          `Confirm the exact Tool selection for Run ${run.id}.`,
          ...toolSummary,
          `Requested scopes: ${scopeSummary}.`,
          "Tools that require human confirmation will be bound only by this explicit decision.",
        ].join("\n"),
        { modal: true },
        "Confirm Exact Tool Selection",
      )
      if (confirmation !== "Confirm Exact Tool Selection") {
        await runtime.engine.markRunState(run.id, "cancelled", { kind: "human", id: actorId })
        throw new WorkflowCancelled()
      }
      const product = await runtime.engine.readProduct()
      const selection = await runtime.engine.productStudio.createRunToolSelection(
        buildRunToolSelectionInput(run.id, plan, tools, envelope, vscode.workspace.isTrusted),
        product.revision ?? 1,
        actorId,
      )
      if (selection.readiness.status !== "ready") {
        await runtime.engine.markRunState(run.id, "cancelled", { kind: "system", id: "gaep.vscode.tool-selection" })
        throw new Error(`Run Tool Selection is not ready: ${selection.readiness.issues.join("; ")}`)
      }
      runToolSelectionId = selection.id
    }
    if (!vscode.workspace.isTrusted || engine !== runtime.engine || selectedFolder?.uri.fsPath !== runtime.path) {
      await runtime.engine.markRunState(run.id, "cancelled", { kind: "system", id: "gaep.vscode.root-context" })
      throw new Error("Workspace trust or Product root changed before managed launch")
    }
    await launchManagedSession({
      runtime,
      selection: currentSelection,
      runId: run.id,
      workflowPlanId: plan.id,
      runToolSelectionId,
      initiativeTitle: pickedInitiative.initiative.title,
    })
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
          recordRecoveryFailure("Selected Product root removal is blocked by an active provider process", error)
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
