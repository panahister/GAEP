const assert = require("node:assert/strict")
const { createHash } = require("node:crypto")
const { readFile } = require("node:fs/promises")
const path = require("node:path")

const vscode = require("vscode")
const { inspectPortableStore, verifyPortableStore } = require("../store-integrity.cjs")

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
  "gaepKiro.dashboard.phase1Summary",
  "gaepKiro.dashboard.phase1ChangeImpact",
  "gaepKiro.dashboard.changeImpact",
  "gaepKiro.dashboard.agentModel",
  "gaepKiro.dashboard.phase1AgentModel",
  "gaepKiro.dashboard.accessibleTables",
  "gaepKiro.initiativeEntry.inspect",
  "gaepKiro.initiativeEntry.classify",
  "gaepKiro.initiativeEntry.resolveApplicability",
  "gaepKiro.sourceGovernance.inspect",
  "gaepKiro.businessUnderstanding.inspect",
  "gaepKiro.businessCapabilityMap.inspect",
  "gaepKiro.valueStreamModel.inspect",
  "gaepKiro.operatingModel.inspect",
  "gaepKiro.businessRules.inspect",
  "gaepKiro.businessArchitectureBaseline.inspect",
  "gaepKiro.systemSolutionArchitecture.inspect",
  "gaepKiro.boundedContextModel.inspect",
  "gaepKiro.securityPrivacyAssessment.inspect",
  "gaepKiro.processModel.inspect",
  "gaepKiro.dataModel.inspect",
  "gaepKiro.authorizationModel.inspect",
  "gaepKiro.eventIntegrationModel.inspect",
  "gaepKiro.failureRecoveryModel.inspect",
  "gaepKiro.architectureChallengeModel.inspect",
  "gaepKiro.decisionRegister.inspect",
  "gaepKiro.riskRegister.inspect",
  "gaepKiro.evidenceRegistry.inspect",
  "gaepKiro.endToEndTraceability.inspect",
  "gaepKiro.p0P4ReadinessGate.inspect",
  "gaepKiro.p5HandoffPackage.inspect",
  "gaepKiro.portableDesign.import",
  "gaepKiro.portableDesign.list",
  "gaepKiro.portableDesign.read",
]
const studioViewType = "gaepKiro.productStudio"

async function run() {
  const workspace = path.resolve(process.env.GAEP_KIRO_E2E_WORKSPACE)
  const fixtureProductName = process.env.GAEP_KIRO_E2E_PRODUCT_NAME
  const fixtureInitiativeId = process.env.GAEP_KIRO_E2E_INITIATIVE_ID
  const fixtureStoreManifest = JSON.parse(process.env.GAEP_KIRO_E2E_STORE_MANIFEST)
  assert.equal(vscode.workspace.workspaceFolders?.length, 1)
  assert.equal(path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath), workspace)
  assert.equal(typeof fixtureProductName, "string")
  assert.match(fixtureInitiativeId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u)
  assert.deepEqual(await verifyPortableStore(path.join(workspace, ".gaep"), fixtureStoreManifest), fixtureStoreManifest)

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

  const dashboardRequest = vscode.commands.executeCommand("gaepKiro.dashboard.agentModel")
  const dashboardDocument = await waitFor(
    () => vscode.workspace.textDocuments.find((document) => document.getText().startsWith("GAEP exact Agent and Model dashboard\n")),
    "The installed package-local engine did not return the Agent and Model dashboard",
    60_000,
  )
  const dashboardText = dashboardDocument.getText()
  for (const marker of [
    "Selection: unselected",
    "Provider usage: unavailable; current Managed Run records have no provider usage contract.",
    "Provider cost: unavailable; current Managed Run records have no provider cost contract.",
    "Observed capabilities (2/2):",
    "gaep.codex-cli/codex-cli",
    "gaep.claude-code-cli/claude-code-cli",
    "Boundary: this read-only projection cannot select or switch an agent, create a handoff, launch a Run, authorize a Tool/write/effect, approve an outcome, establish readiness, or grant release authority.",
  ]) assert.ok(dashboardText.includes(marker), `Agent and Model dashboard must include ${marker}`)
  assertPrivateSafe(dashboardText, workspace, fixtureProductName)
  await dashboardRequest

  const phase1AgentModelRequest = vscode.commands.executeCommand(
    "gaepKiro.dashboard.phase1AgentModel",
    { initiativeId: fixtureInitiativeId },
  )
  const phase1AgentModelDocument = await waitFor(
    () => vscode.workspace.textDocuments.find((document) =>
      document.getText().startsWith("GAEP exact Phase 1 Agent and Model execution truth\n")),
    "The installed package-local engine did not return Phase 1 Agent and Model execution truth",
    60_000,
  )
  const phase1AgentModelText = phase1AgentModelDocument.getText()
  const capabilityTotals = phase1AgentModelText.match(
    /^Capabilities: 2\/2 shown · (\d+) detected · (\d+) unavailable · 0 selected$/mu,
  )
  assert.ok(capabilityTotals, "Phase 1 Agent and Model view must reconcile two unselected capability rows")
  assert.equal(Number(capabilityTotals[1]) + Number(capabilityTotals[2]), 2)
  for (const marker of [
    `Initiative: ${fixtureInitiativeId}@1 · proposed`,
    "Runs: 0/0 shown · 0 terminal · 0 non-terminal",
    "Live provider quality: not-assessed",
    "Semantic output quality: not-assessed",
    "Product Owner acceptance: not-established",
    "Boundary: this read-only Initiative-scoped projection does not establish provider readiness or quality",
  ]) assert.ok(phase1AgentModelText.includes(marker), `Phase 1 Agent and Model view must include ${marker}`)
  assertPrivateSafe(phase1AgentModelText, workspace, fixtureProductName)
  await phase1AgentModelRequest

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
  const finalStoreManifest = await inspectPortableStore(path.join(workspace, ".gaep"))
  assert.deepEqual(finalStoreManifest, fixtureStoreManifest)
  process.stdout.write("PASS installed compatible-host provider/model/Phase 1 dashboard smoke: two bounded capability rows, exact Initiative scope, unselected model state, unavailable usage/cost, private-safe output, and immutable fixture store\n")
  process.stdout.write(`PASS activation: forty-two bounded commands, machine-only configuration, static Product Studio, exact package-local engine ${packagedEngineSha256}, provider/model dashboards, empty audit-gated evidence workflow, and no workspace mutation\n`)
}

function assertPrivateSafe(content, workspace, fixtureProductName) {
  for (const privateValue of [workspace, fixtureProductName, "gaep.kiro-e2e-owner"]) {
    assert.equal(content.includes(privateValue), false, "installed metadata output exposed private fixture content")
  }
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
