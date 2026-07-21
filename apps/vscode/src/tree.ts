import { lstat, readFile, readdir } from "node:fs/promises"
import { join } from "node:path"

import { adapterCapabilitiesSchema, initiativeSchema, runSchema, type Initiative, type Run } from "@gaep/contracts"
import { capabilityDigest } from "@gaep/agent-sdk"
import * as vscode from "vscode"

import { currentInitiative, newestRun, unsafeSelectionReasons } from "./safety.js"

export interface GaepViewContext {
  workspacePath?: string
  workspaceName?: string
  trusted: boolean
  recoveryDiagnostic?: string
}

interface TreeEntry {
  label: string
  description?: string
  tooltip?: string
  icon?: string
  command?: vscode.Command
}

type JsonResult =
  | { kind: "ok"; value: Record<string, unknown> }
  | { kind: "missing" }
  | { kind: "invalid"; error: string }

async function readJson(path: string): Promise<JsonResult> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"))
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected a JSON object record")
    return { kind: "ok", value: parsed as Record<string, unknown> }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return { kind: "missing" }
    return { kind: "invalid", error: error instanceof Error ? error.message : "Invalid JSON record" }
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false
    // Preserve unknown or inaccessible state instead of offering a destructive re-initialization path.
    return true
  }
}

export async function readInitiatives(workspacePath: string): Promise<Initiative[]> {
  const directory = join(workspacePath, ".gaep", "initiatives")
  let names: string[]
  try {
    names = (await readdir(directory)).filter((name) => name.endsWith(".json"))
  } catch {
    return []
  }
  const initiatives: Initiative[] = []
  for (const name of names) {
    try {
      initiatives.push(initiativeSchema.parse(JSON.parse(await readFile(join(directory, name), "utf8"))))
    } catch {
      // Workspace diagnostics report malformed records without representing them as valid Initiatives.
    }
  }
  return initiatives.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function readRuns(workspacePath: string): Promise<Run[]> {
  const directory = join(workspacePath, ".gaep", "sessions")
  let names: string[]
  try {
    names = (await readdir(directory)).filter((name) => /^run-.+\.json$/.test(name))
  } catch {
    return []
  }
  const runs: Run[] = []
  for (const name of names) {
    try {
      runs.push(runSchema.parse(JSON.parse(await readFile(join(directory, name), "utf8"))))
    } catch {
      // Workspace diagnostics report malformed records without representing them as valid runs.
    }
  }
  return runs
}

async function findCapabilities(
  runtimePath: string,
  adapterId: string,
  agentId: string,
  expectedDigest: string | undefined,
): Promise<Record<string, unknown> | undefined> {
  let names: string[]
  try {
    names = (await readdir(runtimePath))
      .filter((name) => /^capabilities-[0-9a-f]{64}\.json$/.test(name))
      .slice(0, 128)
  } catch {
    return undefined
  }
  for (const name of names) {
    try {
      const parsed = adapterCapabilitiesSchema.parse(JSON.parse(await readFile(join(runtimePath, name), "utf8")))
      if (parsed.adapterId !== adapterId || parsed.agentId !== agentId) continue
      if (expectedDigest && capabilityDigest(parsed) !== expectedDigest) continue
      return parsed
    } catch {
      // Invalid or unrelated cached capability records never become display truth.
    }
  }
  return undefined
}

function openRecord(path: string, title: string): vscode.Command {
  return { command: "vscode.open", title, arguments: [vscode.Uri.file(path)] }
}

function diagnosticEntry(label: string, detail: string): TreeEntry {
  return {
    label,
    description: "attention required",
    tooltip: detail,
    icon: "warning",
    command: { command: "gaep.showDiagnostics", title: "Show GAEP Diagnostics" },
  }
}

function studioEntry(route: "overview" | "agents-tools" | "runs-evidence" | "readiness"): TreeEntry {
  return {
    label: "Open Product Studio",
    description: route,
    icon: "layout",
    command: { command: "gaep.openProductStudio", title: "Open Product Studio", arguments: [route] },
  }
}

export class GaepTreeProvider implements vscode.TreeDataProvider<TreeEntry> {
  private readonly changes = new vscode.EventEmitter<TreeEntry | undefined>()
  readonly onDidChangeTreeData = this.changes.event

  constructor(
    private readonly context: () => GaepViewContext,
    private readonly view: "product" | "agent" | "governance" | "runs",
  ) {}

  refresh(): void {
    this.changes.fire(undefined)
  }

  getTreeItem(element: TreeEntry): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None)
    item.description = element.description
    item.tooltip = element.tooltip
    item.command = element.command
    item.iconPath = element.icon ? new vscode.ThemeIcon(element.icon) : undefined
    return item
  }

  async getChildren(): Promise<TreeEntry[]> {
    const context = this.context()
    if (!context.trusted) {
      return [{
        label: "Trust Workspace to Enable GAEP",
        description: "execution disabled",
        tooltip: "GAEP will not inspect agent executables, mutate Product state, or start an agent in an untrusted workspace.",
        icon: "lock",
        command: { command: "gaep.manageWorkspaceTrust", title: "Manage Workspace Trust" },
      }]
    }
    if (!context.workspacePath) {
      return [{
        label: "Select Product Root",
        description: "workspace required",
        icon: "root-folder",
        command: { command: "gaep.selectWorkspaceRoot", title: "Select Product Root" },
      }]
    }

    const root = join(context.workspacePath, ".gaep")
    const recovery = context.recoveryDiagnostic
      ? [
          diagnosticEntry("GAEP Recovery Is Blocked", context.recoveryDiagnostic),
          {
            label: "Retry Recovery",
            description: "after resolving the diagnostic",
            icon: "refresh",
            command: { command: "gaep.retryRecovery", title: "Retry GAEP Recovery" },
          },
        ]
      : []

    if (this.view === "product") {
      const productResult = await readJson(join(root, "product.json"))
      if (productResult.kind !== "ok") {
        const existingState = await pathExists(root)
        if (existingState) {
          const reason = productResult.kind === "invalid"
            ? productResult.error
            : "The .gaep directory exists but product.json is missing. Initialization is disabled to preserve existing state."
          return [...recovery, diagnosticEntry("Product State Needs Repair", reason)]
        }
        return [...recovery, {
          label: "Initialize Product",
          description: context.workspaceName,
          icon: "add",
          command: { command: "gaep.initializeProduct", title: "Initialize Product" },
        }]
      }
      const product = productResult.value
      const initiatives = await readInitiatives(context.workspacePath)
      const selected = currentInitiative(initiatives)
      return [
        ...recovery,
        studioEntry("overview"),
        {
          label: String(product.name),
          description: String(product.lifecycleState ?? "active"),
          icon: "package",
          command: openRecord(join(root, "product.json"), "Open Product Record"),
        },
        { label: "Profile", description: String(product.profile), icon: "settings" },
        {
          label: "Current Initiative",
          description: selected ? `${selected.title} · ${selected.state}` : "none",
          icon: selected?.state === "blocked" ? "error" : "target",
          command: selected
            ? { command: "gaep.changeInitiativeState", title: "Change Initiative State", arguments: [selected.id] }
            : undefined,
        },
        ...initiatives.map((initiative) => ({
          label: initiative.title,
          description: initiative.state,
          tooltip: `${initiative.outcome}\n\nSelect to review allowed state transitions.`,
          icon: initiative.state === "blocked" ? "error" : initiative.state === "completed" ? "pass" : "circle-outline",
          command: { command: "gaep.changeInitiativeState", title: "Change Initiative State", arguments: [initiative.id] },
        })),
        {
          label: "Create Initiative",
          icon: "add",
          command: { command: "gaep.createInitiative", title: "Create Initiative" },
        },
      ]
    }

    if (this.view === "agent") {
      const selectionResult = await readJson(join(root, "runtime", "selection.json"))
      if (selectionResult.kind === "invalid") {
        return [...recovery, diagnosticEntry("Agent Selection Needs Repair", selectionResult.error)]
      }
      if (selectionResult.kind === "missing") {
        return [...recovery, {
          label: "Select Agent and Model",
          description: "no process starts during selection",
          icon: "hubot",
          command: { command: "gaep.selectAgent", title: "Select Agent and Model" },
        }]
      }
      const selection = selectionResult.value
      const settings = selection.settings && typeof selection.settings === "object"
        ? selection.settings as Record<string, unknown>
        : {}
      const unsafe = unsafeSelectionReasons(String(selection.agentId), settings)
      const capabilities = await findCapabilities(
        join(root, "runtime"),
        String(selection.adapterId),
        String(selection.agentId),
        typeof selection.capabilityDigest === "string" ? selection.capabilityDigest : undefined,
      )
      const runtimeVersion = capabilities?.runtimeVersion
      const nativeControls = String(selection.agentId) === "codex-cli"
        ? `sandbox=${String(settings.sandbox ?? "read-only")}, approvals=${String(settings.approvalPolicy ?? "fail-closed-noninteractive")}`
        : `permission mode=${String(settings.permissionMode ?? "default")}`
      return [
        ...recovery,
        studioEntry("agents-tools"),
        ...(unsafe.length > 0 ? [diagnosticEntry("Unsafe Stored Selection", unsafe.join("; "))] : []),
        { label: String(selection.agentId), description: runtimeVersion ? `v${String(runtimeVersion)}` : "agent", icon: "hubot" },
        { label: String(selection.modelId), description: "model", icon: "symbol-variable" },
        {
          label: "Model identity",
          description: `${String(selection.modelTruthClass ?? "configured")}${selection.modelAlias === true ? ", alias" : ""}`,
          icon: "inspect",
        },
        {
          label: "Provider-native controls",
          description: nativeControls,
          tooltip: "This direct-execution release launches only when provider-native controls enforce the effective read-only, network-disabled boundary.",
          icon: "shield",
        },
        {
          label: "Machine-local executable binding",
          description: "inspect in Product Studio",
          tooltip: "Absolute executable paths are shown only in the Product Studio machine-local runtime inspector.",
          icon: "terminal",
          command: { command: "gaep.openProductStudio", title: "Open Product Studio", arguments: ["agents-tools"] },
        },
        {
          label: "Change Agent or Model",
          icon: "arrow-swap",
          command: { command: "gaep.selectAgent", title: "Change Agent or Model" },
        },
        {
          label: "Create Charter and Start Run",
          icon: "play",
          command: { command: "gaep.prepareRun", title: "Create Charter and Start Run" },
        },
      ]
    }

    if (this.view === "runs") {
      const runs = await readRuns(context.workspacePath)
      const latest = newestRun(runs)
      const unknown = runs.filter((run) => run.state === "unknown")
      return [
        ...recovery,
        studioEntry("runs-evidence"),
        {
          label: "Latest run",
          description: latest ? latest.state : "none",
          tooltip: latest ? `${latest.id}\n${latest.agent.agentId} / ${latest.agent.modelId}` : "No governed run exists.",
          icon: latest?.state === "unknown" ? "error" : latest ? "pulse" : "circle-outline",
        },
        ...runs.map((run) => ({
          label: run.id,
          description: run.state,
          tooltip: `Initiative: ${run.initiativeId}\nAgent/model: ${run.agent.agentId} / ${run.agent.modelId}`,
          icon: run.state === "unknown" ? "error" : run.state === "completed" ? "pass" : run.state === "failed" ? "warning" : "pulse",
          command: run.state === "unknown"
            ? { command: "gaep.showDiagnostics", title: "Show GAEP Diagnostics" }
            : { command: "gaep.openProductStudio", title: "Open Product Studio", arguments: ["runs-evidence"] },
        })),
        ...(unknown.length > 0 ? [diagnosticEntry("Unknown run effects", `${unknown.length} run(s) require investigation before their effects can be trusted.`)] : []),
        {
          label: "Structured evidence",
          description: "not exposed by current engine",
          tooltip: "Run lifecycle records are available. Structured event and evidence records remain an explicit Product Studio gap.",
          icon: "info",
        },
        {
          label: "Create Charter and Start Run",
          description: "Codex observe-only",
          icon: "play",
          command: { command: "gaep.prepareRun", title: "Create Charter and Start Run" },
        },
      ]
    }

    const productResult = await readJson(join(root, "product.json"))
    const selectionResult = await readJson(join(root, "runtime", "selection.json"))
    const initiatives = await readInitiatives(context.workspacePath)
    const runs = await readRuns(context.workspacePath)
    const selected = currentInitiative(initiatives)
    const latestRun = newestRun(runs)
    const blockedInitiatives = initiatives.filter((initiative) => initiative.state === "blocked").length
    const unknownRuns = runs.filter((run) => run.state === "unknown").length
    let unsafeSelections = 0
    if (selectionResult.kind === "ok") {
      const settings = selectionResult.value.settings && typeof selectionResult.value.settings === "object"
        ? selectionResult.value.settings as Record<string, unknown>
        : {}
      unsafeSelections = unsafeSelectionReasons(String(selectionResult.value.agentId), settings).length > 0 ? 1 : 0
    }
    const blockerCount = blockedInitiatives + unknownRuns + unsafeSelections + (context.recoveryDiagnostic ? 1 : 0) +
      (productResult.kind === "invalid" || selectionResult.kind === "invalid" ? 1 : 0)
    let auditEvents = 0
    try {
      auditEvents = (await readFile(join(root, "audit", "events.jsonl"), "utf8")).split("\n").filter(Boolean).length
    } catch {
      // Audit log does not exist before Product initialization.
    }
    return [
      ...recovery,
      studioEntry("readiness"),
      { label: "Local source of truth", description: ".gaep", icon: "repo" },
      {
        label: "Policy enforcement",
        description: "fail-closed provider boundary",
        tooltip: "Direct provider execution is limited to an enforceable read-only, network-disabled profile. Workspace changes wait for isolated staging and controlled application.",
        icon: "shield",
      },
      { label: "Current Initiative", description: selected ? `${selected.title} · ${selected.state}` : "none", icon: "target" },
      { label: "Blockers", description: String(blockerCount), icon: blockerCount > 0 ? "error" : "pass" },
      { label: "Audit events", description: String(auditEvents), icon: "history" },
      { label: "Latest run", description: String(latestRun?.state ?? "none"), icon: "pulse" },
      {
        label: "Verify Audit Chain",
        icon: "verified",
        command: { command: "gaep.verifyAudit", title: "Verify Audit Chain" },
      },
      {
        label: "Show Diagnostics",
        icon: "output",
        command: { command: "gaep.showDiagnostics", title: "Show GAEP Diagnostics" },
      },
    ]
  }
}
