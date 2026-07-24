const assert = require("node:assert/strict")
const { access } = require("node:fs/promises")
const path = require("node:path")

const vscode = require("vscode")

const extensionId = "gaep.gaep-kiro"
const commands = [
  "gaepKiro.openProductStudio",
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

  const registered = new Set(await vscode.commands.getCommands(true))
  for (const command of commands) assert.ok(registered.has(command), `${command} must be registered after activation`)
  await vscode.commands.executeCommand("gaepKiro.openProductStudio")
  const tab = await waitFor(productStudioTab, "GAEP for Kiro Product Studio did not open")
  assert.equal(tab.label, "GAEP for Kiro Product Studio")
  await assert.rejects(access(path.join(workspace, ".gaep")), (error) => error?.code === "ENOENT")
  process.stdout.write("PASS activation: four bounded commands, machine-only configuration, static Product Studio, and no workspace mutation\n")
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
