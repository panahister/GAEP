const assert = require("node:assert/strict")
const { createHash } = require("node:crypto")
const { access, readFile } = require("node:fs/promises")
const path = require("node:path")

const vscode = require("vscode")

const extensionId = "gaep.gaep-vscode"
const viewIds = ["gaep.overview", "gaep.agent", "gaep.governance", "gaep.runs"]
const studioViewType = "gaep.productStudio"

function expectedRoots() {
  return (process.env.GAEP_E2E_EXPECTED_ROOTS || "").split("\n").filter(Boolean).map((entry) => path.resolve(entry))
}

async function waitFor(predicate, message, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    try {
      const value = await predicate()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`${message}${lastError instanceof Error ? `: ${lastError.message}` : ""}`)
}

async function assertAbsent(target) {
  await assert.rejects(access(target), (error) => error && error.code === "ENOENT")
}

function studioTab() {
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (tab.input instanceof vscode.TabInputWebview && [
        studioViewType,
        `mainThreadWebview-${studioViewType}`,
      ].includes(tab.input.viewType)) return tab
    }
  }
  return undefined
}

async function activateExtension() {
  const extension = vscode.extensions.getExtension(extensionId)
  assert.ok(extension, `${extensionId} must be available in the clean Extension Development Host`)
  await extension.activate()
  assert.equal(extension.isActive, true, "GAEP must activate")
  return extension
}

async function assertWorkspace(expectedCount) {
  const roots = vscode.workspace.workspaceFolders || []
  assert.equal(roots.length, expectedCount, `expected ${expectedCount} workspace root(s)`)
  assert.deepEqual(
    roots.map((folder) => path.resolve(folder.uri.fsPath)).sort(),
    expectedRoots().sort(),
    "the Extension Development Host opened the isolated fixture roots",
  )
  assert.equal(vscode.workspace.isTrusted, true, "the test harness intentionally runs with workspace trust disabled")
}

async function assertCommandsAndViews(extension) {
  const contributed = (extension.packageJSON.contributes?.commands || []).map((entry) => entry.command)
  assert.ok(contributed.length >= 40, "the Product Studio command surface must be present")
  assert.equal(new Set(contributed).size, contributed.length, "contributed command identifiers must be unique")
  assert.deepEqual(
    (extension.packageJSON.contributes?.views?.gaep || []).map((entry) => ({ id: entry.id, name: entry.name })),
    [
      { id: "gaep.overview", name: "Product" },
      { id: "gaep.agent", name: "Agent" },
      { id: "gaep.governance", name: "Governance" },
      { id: "gaep.runs", name: "Runs" },
    ],
    "the GAEP container must contribute exactly the four approved views",
  )
  const activationEvents = new Set(extension.packageJSON.activationEvents || [])
  for (const viewId of viewIds) assert.ok(activationEvents.has(`onView:${viewId}`), `${viewId} must activate GAEP`)
  assert.ok(activationEvents.has(`onWebviewPanel:${studioViewType}`), "serialized Product Studio panels must activate GAEP")
  assert.ok(activationEvents.has("onChatParticipant:gaep.product"), "the native GAEP chat participant must activate GAEP")
  assert.deepEqual(
    (extension.packageJSON.contributes?.chatParticipants || []).map((participant) => ({
      id: participant.id,
      name: participant.name,
      commands: (participant.commands || []).map((command) => command.name),
    })),
    [{
      id: "gaep.product",
      name: "gaep",
      commands: ["initialize", "adopt", "revise", "initiative", "edit", "continue", "classification", "applicability", "intake", "align", "manifest", "record", "baseline", "provenance", "author", "inspect", "mode", "suggest", "roles", "resolve", "advisor", "agent", "model", "accept", "status", "review", "back", "commit", "cancel", "help"],
    }],
    "the package must contribute the exact stable native GAEP chat surface",
  )
  assert.deepEqual(
    extension.packageJSON.contributes?.languageModelChatProviders,
    [{ vendor: "gaep-workflow", displayName: "GAEP Local Workflow" }],
    "GAEP must contribute its local workflow model without requiring Copilot",
  )

  const registered = new Set(await vscode.commands.getCommands(true))
  for (const command of contributed) assert.ok(registered.has(command), `${command} must be registered after activation`)
  assert.ok(registered.has("workbench.view.extension.gaep"), "the GAEP Activity Bar container command must exist")
  for (const viewId of viewIds) assert.ok(registered.has(`${viewId}.focus`), `${viewId} must expose a native focus command`)

  const workflowModels = await vscode.lm.selectChatModels({ vendor: "gaep-workflow" })
  assert.equal(workflowModels.length, 1, "the GAEP local workflow model must be discoverable")
  assert.deepEqual({
    id: workflowModels[0].id,
    name: workflowModels[0].name,
    family: workflowModels[0].family,
    version: workflowModels[0].version,
    toolCalling: workflowModels[0].capabilities.toolCalling ?? false,
  }, {
    id: "governed-workflow",
    name: "GAEP Governed Workflow",
    family: "gaep-deterministic-workflow",
    version: "1",
    toolCalling: false,
  })

  await vscode.commands.executeCommand("workbench.view.extension.gaep")
  for (const viewId of viewIds) await vscode.commands.executeCommand(`${viewId}.focus`)
}

async function assertGuideSurface(extension) {
  const guideUri = vscode.Uri.joinPath(extension.extensionUri, "media", "GAEP_GUIDE.md")
  const guide = new TextDecoder().decode(await vscode.workspace.fs.readFile(guideUri))
  let visual = {}
  if (process.env.GAEP_E2E_PHASE === "open") {
    try {
      const visualConfigPath = path.resolve(extension.extensionPath, "../..", ".gaep-visual-inspection.json")
      visual = JSON.parse(await readFile(visualConfigPath, "utf8"))
    } catch (error) {
      if (error?.code !== "ENOENT") throw error
    }
  }
  const visualHold = Number(visual.holdMs || 0)
  if (visualHold > 0 && visual.theme) {
    await vscode.workspace
      .getConfiguration("workbench")
      .update("colorTheme", visual.theme, vscode.ConfigurationTarget.Global)
  }
  assert.match(guide, /^# GAEP Product-to-Operate Enterprise Guideline$/m)
  assert.match(guide, /GAEP-REG-013 v0\.2\.1/)
  assert.match(guide, /3dcfe5531a1bb4630dc3afdb2990389728e2d39cac2ac915986badb9fe9e5c17/)
  assert.match(guide, /^## 1\. Executive orientation$/m)
  assert.match(guide, /^## 4\. Methodology and maintainer appendix$/m)
  assert.match(guide, /<!-- GAEP-VISUAL:lifecycle-architecture-plan -->/)
  assert.match(guide, /Product Design preparation and iterative evidence/)
  assert.match(guide, /\[PD\] Planned \/ deferred/)
  assert.match(guide, /Unknown means not assessed or not established; it never means No\./)

  const marketGuideUri = vscode.Uri.joinPath(extension.extensionUri, "media", "GAEP_MARKET_DECISION_GUIDE.md")
  const marketGuide = new TextDecoder().decode(await vscode.workspace.fs.readFile(marketGuideUri))
  assert.match(marketGuide, /^# GAEP Product × Capability Decision Guide$/m)
  assert.match(marketGuide, /all 450 evidence-bounded cells/)
  assert.match(marketGuide, /<!-- CELL:GAEP-CAP-101:GAEP-PRD-001 -->/)
  assert.match(marketGuide, /<!-- CELL:GAEP-CAP-130:GAEP-PRD-016 -->/)

  const expectedHashes = JSON.parse(process.env.GAEP_E2E_EXPECTED_ASSET_HASHES || "{}")
  for (const relativePath of [
    "dist/extension.cjs",
    "dist/studio-client.js",
    "media/GAEP_GUIDE.md",
    "media/GAEP_MARKET_DECISION_GUIDE.md",
  ]) {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(extension.extensionUri, ...relativePath.split("/")))
    const actualHash = createHash("sha256").update(bytes).digest("hex")
    assert.equal(actualHash, expectedHashes[relativePath], `${relativePath} source/package/installed parity`)
  }

  const visualArtifact = visual.artifact === "market" ? "market" : "guide"
  const visualText = visualArtifact === "market" ? marketGuide : guide
  const visualUri = visualArtifact === "market" ? marketGuideUri : guideUri
  if (visualHold > 0 && visual.target) {
    const targetIndex = visualText.indexOf(visual.target)
    assert.ok(targetIndex >= 0, `visual target not found: ${visual.target}`)
    const document = await vscode.workspace.openTextDocument(visualUri)
    const editor = await vscode.window.showTextDocument(document, { preview: false })
    const position = document.positionAt(targetIndex)
    editor.selection = new vscode.Selection(position, position)
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.AtTop)
  }
  const visualPreviewUri = visual.fragment
    ? visualUri.with({ fragment: visual.fragment })
    : visualUri
  if (visualHold > 0 && visual.narrow) await vscode.commands.executeCommand("markdown.showPreviewToSide", visualPreviewUri)
  else if (visualArtifact === "market" && visualHold > 0) await vscode.commands.executeCommand("markdown.showPreview", visualPreviewUri)
  else await vscode.commands.executeCommand("gaep.openGuide")
  const preview = await waitFor(
    () => vscode.window.tabGroups.all.flatMap((group) => group.tabs).find((tab) => /GAEP_(?:MARKET_DECISION_)?GUIDE|GAEP Product-to-Operate/i.test(tab.label)),
    "GAEP visual Guideline preview did not open",
  )
  assert.equal(preview.isDirty, false, "generated Guide preview must not be dirty")
  if (visualHold > 0) await new Promise((resolve) => setTimeout(resolve, visualHold))
  await vscode.window.tabGroups.close(preview)
}

async function openStudio() {
  if (process.env.GAEP_E2E_LOG_CSP === "1") {
    const diagnosticPanel = vscode.window.createWebviewPanel("gaep.cspDiagnostic", "GAEP CSP diagnostic", vscode.ViewColumn.Active, {})
    process.stdout.write(`GAEP host CSP source: ${JSON.stringify(diagnosticPanel.webview.cspSource)}\n`)
    diagnosticPanel.dispose()
  }
  await vscode.commands.executeCommand("gaep.openProductStudio", "trace")
  const tab = await waitFor(studioTab, "Product Studio did not open")
  assert.equal(tab.label, "GAEP Product Studio")
  assert.equal(tab.isDirty, false)
  await new Promise((resolve) => setTimeout(resolve, 1_000))
  return tab
}

async function runOpenPhase() {
  await assertWorkspace(1)
  const extension = await activateExtension()
  await assertCommandsAndViews(extension)
  await assertGuideSurface(extension)
  await assertAbsent(path.join(expectedRoots()[0], ".gaep"))
  await openStudio()
  await assertAbsent(path.join(expectedRoots()[0], ".gaep"))
  process.stdout.write("PASS open: activation, native @gaep registration, all contributed commands, four native views, visual Guide preview, Product Studio, asset parity, and no implicit Product mutation\n")
}

async function runInstalledPhase() {
  await assertWorkspace(1)
  const extension = await activateExtension()
  await assertCommandsAndViews(extension)
  await assertGuideSurface(extension)
  await assertAbsent(path.join(expectedRoots()[0], ".gaep"))
  await openStudio()
  await assertAbsent(path.join(expectedRoots()[0], ".gaep"))
  const dismissNotifications = setInterval(() => {
    void vscode.commands.executeCommand("notifications.clearAll")
  }, 100)
  let recovery
  try {
    recovery = await vscode.commands.executeCommand("gaep.retryRecovery")
  } finally {
    clearInterval(dismissNotifications)
    await vscode.commands.executeCommand("notifications.clearAll")
  }
  assert.deepEqual(recovery, {
    level: "information",
    message: "The recovery pass returned and the bounded persisted inventory has no interrupted non-terminal Managed Run. This does not attest provider outcome or machine-local cleanup.",
  })
  await assertAbsent(path.join(expectedRoots()[0], ".gaep"))
  process.stdout.write("PASS installed: exact VSIX activation, commands, views, visual Guide preview, source/package/installed asset parity, Product Studio, bundled-engine empty recovery/evidence workflow, and no workspace mutation\n")
}

async function runMultiRootPhase() {
  await assertWorkspace(2)
  const extension = await activateExtension()
  await assertCommandsAndViews(extension)
  for (const root of expectedRoots()) await assertAbsent(path.join(root, ".gaep"))
  const tab = await openStudio()
  for (const root of expectedRoots()) await assertAbsent(path.join(root, ".gaep"))
  await vscode.window.tabGroups.close(tab)
  process.stdout.write("PASS multi-root: explicit two-root context opens without silently initializing or mutating either Product root\n")
}

async function run() {
  const phase = process.env.GAEP_E2E_PHASE
  if (phase === "open") return runOpenPhase()
  if (phase === "installed") return runInstalledPhase()
  if (phase === "multi-root") return runMultiRootPhase()
  throw new Error(`Unknown GAEP_E2E_PHASE: ${String(phase)}`)
}

module.exports = { run }
