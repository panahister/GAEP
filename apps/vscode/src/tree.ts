import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"

import * as vscode from "vscode"

interface TreeEntry {
  label: string
  description?: string
  icon?: string
  command?: vscode.Command
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>
  } catch {
    return null
  }
}

export class GaepTreeProvider implements vscode.TreeDataProvider<TreeEntry> {
  private readonly changes = new vscode.EventEmitter<TreeEntry | undefined>()
  readonly onDidChangeTreeData = this.changes.event

  constructor(
    private readonly workspacePath: string,
    private readonly view: "product" | "agent" | "governance",
  ) {}

  refresh(): void {
    this.changes.fire(undefined)
  }

  getTreeItem(element: TreeEntry): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None)
    item.description = element.description
    item.command = element.command
    item.iconPath = element.icon ? new vscode.ThemeIcon(element.icon) : undefined
    return item
  }

  async getChildren(): Promise<TreeEntry[]> {
    const root = join(this.workspacePath, ".gaep")
    if (this.view === "product") {
      const product = await readJson(join(root, "product.json"))
      if (!product) {
        return [{
          label: "Initialize Product",
          icon: "add",
          command: { command: "gaep.initializeProduct", title: "Initialize Product" },
        }]
      }
      let initiativeCount = 0
      try {
        initiativeCount = (await readdir(join(root, "initiatives"))).filter((name) => name.endsWith(".json")).length
      } catch {
        // Empty repository.
      }
      return [
        { label: String(product.name), description: String(product.lifecycleState ?? "active"), icon: "package" },
        { label: "Profile", description: String(product.profile), icon: "settings" },
        { label: "Initiatives", description: String(initiativeCount), icon: "target" },
        {
          label: "Create Initiative",
          icon: "add",
          command: { command: "gaep.createInitiative", title: "Create Initiative" },
        },
      ]
    }
    if (this.view === "agent") {
      const selection = await readJson(join(root, "runtime", "selection.json"))
      if (!selection) {
        return [{
          label: "Select Agent and Model",
          icon: "hubot",
          command: { command: "gaep.selectAgent", title: "Select Agent and Model" },
        }]
      }
      return [
        { label: String(selection.agentId), description: "agent", icon: "hubot" },
        { label: String(selection.modelId), description: "model", icon: "symbol-variable" },
        {
          label: "Model identity",
          description: `${String(selection.modelTruthClass ?? "configured")}${selection.modelAlias === true ? ", alias" : ""}`,
          icon: "inspect",
        },
        { label: String(selection.runtimeExecutable), description: "runtime", icon: "terminal" },
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
    let auditEvents = 0
    try {
      auditEvents = (await readFile(join(root, "audit", "events.jsonl"), "utf8")).split("\n").filter(Boolean).length
    } catch {
      // Audit log does not exist before Product initialization.
    }
    let latestRun: Record<string, unknown> | null = null
    try {
      const runNames = (await readdir(join(root, "sessions"))).filter((name) => /^run-.+\.json$/.test(name)).sort()
      latestRun = runNames.length > 0 ? await readJson(join(root, "sessions", runNames.at(-1)!)) : null
    } catch {
      // No sessions yet.
    }
    return [
      { label: "Local source of truth", description: ".gaep", icon: "repo" },
      { label: "High-impact effects", description: "explicit authorization", icon: "shield" },
      { label: "Audit events", description: String(auditEvents), icon: "history" },
      { label: "Latest run", description: String(latestRun?.state ?? "none"), icon: "pulse" },
      {
        label: "Verify Audit Chain",
        icon: "verified",
        command: { command: "gaep.verifyAudit", title: "Verify Audit Chain" },
      },
    ]
  }
}
