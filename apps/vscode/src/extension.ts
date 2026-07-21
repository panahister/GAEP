import { readdir } from "node:fs/promises"
import { join } from "node:path"

import { CodexAdapter } from "@gaep/adapter-codex"
import { ClaudeAdapter } from "@gaep/adapter-claude"
import { productProfileSchema, type AdapterCapabilities, type AgentSetting, type ToolPermission } from "@gaep/contracts"
import { GaepEngine } from "@gaep/engine"
import * as vscode from "vscode"

import { AgentRunTerminal } from "./run-terminal.js"
import { GaepTreeProvider } from "./tree.js"

const actorId = "gaep.local-founder"
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

function workspacePath(): string {
  const folder = vscode.workspace.workspaceFolders?.[0]
  if (!folder) throw new Error("Open a workspace folder before using GAEP")
  return folder.uri.fsPath
}

async function requiredInput(prompt: string, options: vscode.InputBoxOptions = {}): Promise<string> {
  const value = await vscode.window.showInputBox({ prompt, ignoreFocusOut: true, ...options })
  if (!value?.trim()) throw new Error("GAEP workflow cancelled")
  return value.trim()
}

async function collectSetting(setting: AgentSetting): Promise<unknown> {
  if (setting.kind === "select" && setting.options) {
    const selected = await vscode.window.showQuickPick(
      setting.options.map((option) => ({ label: option.label, description: option.description, value: option.value })),
      { title: setting.label, placeHolder: setting.description, ignoreFocusOut: true },
    )
    return selected?.value ?? setting.defaultValue
  }
  if (setting.kind === "boolean") {
    const selected = await vscode.window.showQuickPick(
      [{ label: "Enabled", value: true }, { label: "Disabled", value: false }],
      { title: setting.label, placeHolder: setting.description, ignoreFocusOut: true },
    )
    return selected?.value ?? setting.defaultValue
  }
  const value = await vscode.window.showInputBox({
    title: setting.label,
    prompt: setting.description,
    value: typeof setting.defaultValue === "string" ? setting.defaultValue : undefined,
    password: setting.sensitive,
    ignoreFocusOut: true,
  })
  if (value === undefined || value.trim() === "") return setting.defaultValue
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
  if (!picked) throw new Error("GAEP workflow cancelled")
  return picked.id || requiredInput("Enter the exact model identifier")
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  let path: string
  try {
    path = workspacePath()
  } catch {
    return
  }
  const configuration = vscode.workspace.getConfiguration("gaep")
  const engine = new GaepEngine(path, [
    new CodexAdapter(configuration.get("codex.executable", "codex")),
    new ClaudeAdapter(configuration.get("claude.executable", "claude")),
  ])
  await engine.recoverInterruptedRuns("gaep.vscode.restart")
  const providers = [
    new GaepTreeProvider(path, "product"),
    new GaepTreeProvider(path, "agent"),
    new GaepTreeProvider(path, "governance"),
  ] as const
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("gaep.overview", providers[0]),
    vscode.window.registerTreeDataProvider("gaep.agent", providers[1]),
    vscode.window.registerTreeDataProvider("gaep.governance", providers[2]),
  )
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 40)
  status.name = "GAEP Context"
  status.command = "gaep.refresh"
  context.subscriptions.push(status)
  const refreshStatus = async () => {
    try {
      const product = await engine.readProduct()
      let agent = "no agent"
      let model = "no model"
      try {
        const selection = await engine.readSelection()
        agent = selection.agentId
        model = selection.modelId
      } catch {
        // Agent selection is optional during onboarding.
      }
      const runs = await engine.listRuns()
      const runState = runs[0]?.state ?? "no run"
      status.text = `$(shield) GAEP | ${product.name} | ${agent} | ${model} | ${runState}`
      status.tooltip = "Current GAEP Product, selected agent/model, and latest run state"
      status.show()
    } catch {
      status.text = "$(shield) GAEP | Initialize Product"
      status.tooltip = "Initialize a governed GAEP Product in this workspace"
      status.show()
    }
  }
  const refresh = () => {
    providers.forEach((provider) => provider.refresh())
    void refreshStatus()
  }
  refresh()

  context.subscriptions.push(vscode.commands.registerCommand("gaep.refresh", refresh))
  context.subscriptions.push(vscode.commands.registerCommand("gaep.initializeProduct", async () => {
    try {
      const name = await requiredInput("Product name", { validateInput: (value) => value.trim().length < 2 ? "Use at least 2 characters" : undefined })
      const summary = await requiredInput("One-sentence product summary")
      const problem = await requiredInput("What problem does this Product solve?")
      const affectedUsers = await requiredInput("Who is affected by this problem?")
      const desiredOutcome = await requiredInput("What outcome should the Product create?")
      const successSignals = (await requiredInput("Success signals, separated by commas")).split(",").map((item) => item.trim()).filter(Boolean)
      const firstWorkflow = await requiredInput("Describe the first complete user workflow")
      const exclusionsInput = await vscode.window.showInputBox({ prompt: "Initial exclusions, separated by commas", ignoreFocusOut: true })
      const profile = await vscode.window.showQuickPick(
        [...productProfiles],
        { title: "Select the initial GAEP profile", ignoreFocusOut: true },
      )
      if (!profile) throw new Error("GAEP workflow cancelled")
      const product = await engine.createProduct({
        name,
        summary,
        problem,
        affectedUsers,
        desiredOutcome,
        successSignals,
        firstWorkflow,
        exclusions: (exclusionsInput ?? "").split(",").map((item) => item.trim()).filter(Boolean),
        profile: productProfileSchema.parse(profile),
      }, actorId)
      refresh()
      await vscode.window.showInformationMessage(`GAEP Product created: ${product.name}`)
      await vscode.commands.executeCommand("gaep.selectAgent")
    } catch (error) {
      if (error instanceof Error && error.message !== "GAEP workflow cancelled") {
        await vscode.window.showErrorMessage(error.message)
      }
    }
  }))

  context.subscriptions.push(vscode.commands.registerCommand("gaep.selectAgent", async () => {
    try {
      await engine.readProduct()
      const capabilities = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "GAEP is detecting installed agents" },
        () => engine.probeAgents(),
      )
      const detected = capabilities.filter((capability) => capability.detected)
      if (detected.length === 0) throw new Error("No supported installed agent was detected")
      const agent = await vscode.window.showQuickPick(
        detected.map((capability) => ({
          label: capability.agentLabel,
          description: capability.runtimeVersion ?? "version unknown",
          detail: capability.limitations.join(" "),
          capability,
        })),
        { title: "Select the agent that will execute GAEP work", ignoreFocusOut: true },
      )
      if (!agent) throw new Error("GAEP workflow cancelled")
      const modelId = await chooseModel(agent.capability)
      const settings: Record<string, unknown> = {}
      for (const setting of agent.capability.settings) {
        const value = await collectSetting(setting)
        if (value !== undefined) settings[setting.key] = value
      }
      const unsafeCodex = agent.capability.agentId === "codex-cli" && (
        settings.sandbox === "danger-full-access" || settings.approvalPolicy === "never"
      )
      const unsafeClaude = agent.capability.agentId === "claude-code-cli" && (
        settings.permissionMode === "dontAsk" || settings.permissionMode === "auto"
      )
      if (unsafeCodex || unsafeClaude) {
        const accepted = await vscode.window.showWarningMessage(
          "This provider configuration weakens native safety controls. GAEP charter rules do not technically restore a removed sandbox or approval prompt.",
          { modal: true },
          "Accept Elevated Risk",
        )
        if (accepted !== "Accept Elevated Risk") throw new Error("GAEP workflow cancelled")
      }
      let currentSelection
      try {
        currentSelection = await engine.readSelection()
      } catch {
        currentSelection = undefined
      }
      const priorRuns = await engine.listRuns()
      const selectionChanges = currentSelection && (
        currentSelection.adapterId !== agent.capability.adapterId ||
        currentSelection.modelId !== modelId ||
        JSON.stringify(currentSelection.settings) !== JSON.stringify(settings)
      )
      if (selectionChanges && priorRuns.length > 0) {
        const reason = await requiredInput("Why are you switching agent, model, or settings?")
        const completedWork = (await requiredInput("Completed work to hand off, separated by commas"))
          .split(",").map((item) => item.trim()).filter(Boolean)
        const unresolvedMatters = (await requiredInput("Unresolved matters, separated by commas"))
          .split(",").map((item) => item.trim()).filter(Boolean)
        const handoff = await engine.createHandoff({
          fromRunId: priorRuns[0]!.id,
          toCapabilities: agent.capability,
          toModelId: modelId,
          toSettings: settings,
          reason,
          completedWork,
          unresolvedMatters,
          decisions: [],
          evidence: [],
        }, actorId)
        const accepted = await vscode.window.showWarningMessage(
          `Review switch: ${handoff.capabilityDifferences.join(" ")}`,
          { modal: true },
          "Accept Handoff",
        )
        if (accepted !== "Accept Handoff") throw new Error("GAEP workflow cancelled")
      }
      await engine.selectAgent(agent.capability, modelId, settings, actorId)
      refresh()
      await vscode.window.showInformationMessage(`${agent.capability.agentLabel} with ${modelId} is selected for GAEP`)
    } catch (error) {
      if (error instanceof Error && error.message !== "GAEP workflow cancelled") {
        await vscode.window.showErrorMessage(error.message)
      }
    }
  }))

  context.subscriptions.push(vscode.commands.registerCommand("gaep.createInitiative", async () => {
    try {
      const title = await requiredInput("Initiative title")
      const outcome = await requiredInput("Bounded outcome for this Initiative")
      const scope = (await requiredInput("Included scope, separated by commas")).split(",").map((item) => item.trim()).filter(Boolean)
      const exclusions = (await vscode.window.showInputBox({ prompt: "Excluded scope, separated by commas", ignoreFocusOut: true }) ?? "")
        .split(",").map((item) => item.trim()).filter(Boolean)
      const initiative = await engine.createInitiative({ title, outcome, scope, exclusions }, actorId)
      refresh()
      await vscode.window.showInformationMessage(`Initiative created: ${initiative.title}`)
    } catch (error) {
      if (error instanceof Error && error.message !== "GAEP workflow cancelled") {
        await vscode.window.showErrorMessage(error.message)
      }
    }
  }))

  context.subscriptions.push(vscode.commands.registerCommand("gaep.prepareRun", async () => {
    try {
      const initiativeFiles = (await readdir(join(path, ".gaep", "initiatives"))).filter((name) => name.endsWith(".json"))
      if (initiativeFiles.length === 0) throw new Error("Create an Initiative before preparing a run")
      const initiatives = await Promise.all(initiativeFiles.map((name) => engine.readInitiative(name.replace(/\.json$/, ""))))
      const picked = await vscode.window.showQuickPick(
        initiatives.map((initiative) => ({ label: initiative.title, description: initiative.state, initiative })),
        { title: "Select the bounded Initiative", ignoreFocusOut: true },
      )
      if (!picked) throw new Error("GAEP workflow cancelled")
      const objective = await requiredInput("What should the selected agent accomplish in this run?")
      const permissions: ToolPermission[] = [
        { capability: "read-workspace", mode: "allow", scope: [path] },
        { capability: "modify-workspace", mode: "ask", scope: [path] },
        { capability: "run-local-commands", mode: "ask", scope: [path] },
        { capability: "network-access", mode: "ask", scope: [] },
        { capability: "commit", mode: "deny", scope: [] },
        { capability: "push", mode: "deny", scope: [] },
        { capability: "deploy", mode: "deny", scope: [] },
      ]
      const charter = await engine.createCharter({
        initiativeId: picked.initiative.id,
        objective,
        permissions,
        expectedEffects: ["observe", "provisional", "reversible-change"],
        forbiddenActions: ["Push, deploy, delete, publish, spend, or change privileges without an exact Authorization Grant."],
        stopConditions: ["Required authority is missing.", "The requested scope changes materially.", "An effect is partial, unknown, or cannot be verified."],
        requiredEvidence: ["Relevant tests and validation output", "Changed-file inventory", "Unresolved risks and limitations"],
      }, actorId)
      const confirmation = await vscode.window.showWarningMessage(
        `Confirm charter for ${picked.initiative.title} using ${charter.agent.agentId} / ${charter.agent.modelId}. High-impact effects remain denied.`,
        { modal: true },
        "Confirm Charter",
      )
      if (confirmation !== "Confirm Charter") throw new Error("GAEP workflow cancelled")
      await engine.confirmCharter(charter.id, actorId)
      const prepared = await engine.prepareRun(charter.id, actorId)
      const finalConfirmation = vscode.workspace.getConfiguration("gaep").get("confirmBeforeAgentRun", true)
        ? await vscode.window.showWarningMessage(
            `Start ${prepared.invocation.executable} for this confirmed charter?`,
            { modal: true },
            "Start Run",
          )
        : "Start Run"
      if (finalConfirmation !== "Start Run") {
        await engine.markRunState(prepared.run.id, "cancelled", { kind: "human", id: actorId })
        throw new Error("GAEP workflow cancelled")
      }
      const terminal = vscode.window.createTerminal({
        name: `GAEP: ${picked.initiative.title}`,
        pty: new AgentRunTerminal(engine, prepared.run.id, prepared.invocation),
        iconPath: new vscode.ThemeIcon("hubot"),
      })
      terminal.show(true)
      refresh()
    } catch (error) {
      if (error instanceof Error && error.message !== "GAEP workflow cancelled") {
        await vscode.window.showErrorMessage(error.message)
      }
    }
  }))

  context.subscriptions.push(vscode.commands.registerCommand("gaep.verifyAudit", async () => {
    const result = await engine.repository.verifyAudit()
    if (result.valid) await vscode.window.showInformationMessage(`GAEP audit chain is valid (${result.events} events)`)
    else await vscode.window.showErrorMessage(`GAEP audit chain failed after ${result.events} events: ${result.error}`)
  }))
}

export function deactivate(): void {
  // Active pseudoterminals receive close from VS Code.
}
