import * as vscode from "vscode"

import { StudioMessageController, type StudioDataSource } from "./studio-data-source.js"
import { createStudioDocument, createStudioNonce } from "./studio-document.js"
import { isStudioRoute, type StudioRoute } from "./studio-protocol.js"
import { StudioHostSession } from "./studio-session.js"

export class StudioProvider implements vscode.Disposable, vscode.WebviewPanelSerializer {
  static readonly viewType = "gaep.productStudio"

  private panel?: vscode.WebviewPanel
  private session?: StudioHostSession
  private panelDisposables: vscode.Disposable[] = []

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly dataSource: StudioDataSource,
    private readonly diagnostic: (message: string, error?: unknown) => void,
  ) {}

  async open(route: StudioRoute = "overview"): Promise<void> {
    if (this.panel) {
      this.panel.reveal(this.panel.viewColumn, true)
      await this.session?.refresh(this.panel.webview, route)
      return
    }
    const panel = vscode.window.createWebviewPanel(
      StudioProvider.viewType,
      "GAEP Product Studio",
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: false },
    )
    this.configure(panel, route)
  }

  async deserializeWebviewPanel(panel: vscode.WebviewPanel, state: unknown): Promise<void> {
    const restoredRoute = typeof state === "object" && state !== null && "route" in state &&
      isStudioRoute((state as { route?: unknown }).route)
      ? (state as { route: StudioRoute }).route
      : "overview"
    this.configure(panel, restoredRoute)
  }

  async refresh(): Promise<void> {
    if (!this.panel || !this.session) return
    await this.session.refresh(this.panel.webview)
  }

  dispose(): void {
    this.disposePanelState()
    this.panel?.dispose()
    this.panel = undefined
  }

  private configure(panel: vscode.WebviewPanel, route: StudioRoute): void {
    const previousPanel = this.panel
    this.disposePanelState()
    if (previousPanel && previousPanel !== panel) previousPanel.dispose()
    this.panel = panel
    const dist = vscode.Uri.joinPath(this.extensionUri, "dist")
    panel.webview.options = { enableScripts: true, localResourceRoots: [dist] }
    const channelId = createStudioNonce()
    const nonce = createStudioNonce()
    const controller = new StudioMessageController(this.dataSource, { channelId, initialRoute: route })
    const session = new StudioHostSession(controller, this.diagnostic)
    session.connect(panel.webview)
    this.session = session
    panel.webview.html = createStudioDocument({
      cspSource: panel.webview.cspSource,
      clientScriptUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(dist, "studio-client.js")).toString(),
      channelId,
      nonce,
      initialRoute: route,
    })
    this.panelDisposables.push(panel.onDidDispose(() => {
      if (this.panel !== panel) return
      this.disposePanelState()
      this.panel = undefined
    }))
  }

  private disposePanelState(): void {
    this.session?.dispose()
    this.session = undefined
    for (const disposable of this.panelDisposables.splice(0)) disposable.dispose()
  }
}
