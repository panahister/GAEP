const assert = require("node:assert/strict")
const { createHash } = require("node:crypto")
const { access, readFile } = require("node:fs/promises")
const path = require("node:path")

const vscode = require("vscode")

const extensionId = "gaep.gaep-kiro"
const commands = [
  "gaepKiro.openProductStudio",
  "gaepKiro.agents.readiness",
  "gaepKiro.agents.select",
  "gaepKiro.agents.handoff",
  "gaepKiro.runs.managedReadOnly",
  "gaepKiro.runs.evidence",
  "gaepKiro.runs.stagedReview",
  "gaepKiro.dashboard.phase",
  "gaepKiro.dashboard.changeImpact",
  "gaepKiro.dashboard.agentModel",
  "gaepKiro.dashboard.accessibleTables",
  "gaepKiro.portableDesign.import",
  "gaepKiro.portableDesign.list",
  "gaepKiro.portableDesign.read",
]
const studioViewType = "gaepKiro.productStudio"

async function run() {
  const workspace = path.resolve(process.env.GAEP_KIRO_E2E_WORKSPACE)
  assert.equal(vscode.workspace.workspaceFolders?.length, 1)
  assert.equal(path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath), workspace)

  const extension = vscode.extensions.getExtension(extensionId)
  assert.ok(extension, `${extensionId} must be present in the isolated Extension Development Host`)
  await extension.activate()
  assert.equal(extension.isActive, true)

  const contributed = extension.packageJSON.contributes.commands.map((entry) => entry.command)
  assert.deepEqual(contributed, commands)
  assert.equal(new Set(contributed).size, commands.length)
  const activationEvents = new Set(extension.packageJSON.activationEvents)
  for (const command of commands) assert.ok(activationEvents.has(`onCommand:${command}`))
  assert.ok(activationEvents.has(`onWebviewPanel:${studioViewType}`))
  assert.equal(extension.packageJSON.capabilities.untrustedWorkspaces.supported, "limited")
  for (const setting of ["engineExecutable", "engineSha256", "actorId"]) {
    assert.equal(extension.packageJSON.contributes.configuration.properties[`gaepKiro.${setting}`].scope, "machine")
  }
  assert.equal(extension.packageJSON.contributes.configuration.properties["gaepKiro.engineExecutable"].default, "")

  const packagedEnginePath = path.join(extension.extensionPath, "dist", "gaep-engine.mjs")
  const extensionBundlePath = path.join(extension.extensionPath, "dist", "extension.cjs")
  const [packagedEngine, extensionBundle] = await Promise.all([
    readFile(packagedEnginePath),
    readFile(extensionBundlePath, "utf8"),
  ])
  const packagedEngineSha256 = createHash("sha256").update(packagedEngine).digest("hex")
  assert.ok(extensionBundle.includes(`sha256:${packagedEngineSha256}`), "installed extension must embed the exact packaged-engine digest")

  const registered = new Set(await vscode.commands.getCommands(true))
  for (const command of commands) assert.ok(registered.has(command), `${command} must be registered after activation`)
  await vscode.commands.executeCommand("gaepKiro.openProductStudio")
  const tab = await waitFor(productStudioTab, "GAEP for Kiro Product Studio did not open")
  assert.equal(tab.label, "GAEP for Kiro Product Studio")
  const evidenceRequest = vscode.commands.executeCommand("gaepKiro.runs.evidence")
  const evidenceDocument = await waitFor(
    () => vscode.workspace.textDocuments.find((document) => document.getText().startsWith("GAEP bounded Managed Run evidence\n")),
    "The installed package-local engine did not return a Managed Run evidence page",
  )
  const evidenceText = evidenceDocument.getText()
  assert.ok(evidenceText.includes("Offset / limit: 0 / 100"))
  assert.ok(evidenceText.includes("Displayed: 0 of 0"))
  assert.ok(evidenceText.includes("More pages available: no"))
  assert.equal(evidenceText.includes(workspace), false)
  await vscode.commands.executeCommand("notifications.clearAll")
  await evidenceRequest
  await assert.rejects(access(path.join(workspace, ".gaep")), (error) => error?.code === "ENOENT")
  process.stdout.write(`PASS activation: fourteen bounded commands, machine-only configuration, static Product Studio, exact package-local engine ${packagedEngineSha256}, empty audit-gated evidence workflow, and no workspace mutation\n`)
}

function productStudioTab() {
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

async function waitFor(predicate, message, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = predicate()
    if (value) return value
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(message)
}

module.exports = { run }
