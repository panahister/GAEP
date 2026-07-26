const assert = require("node:assert/strict")
const { access } = require("node:fs/promises")
const { writeFileSync } = require("node:fs")
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

  const registered = new Set(await vscode.commands.getCommands(true))
  for (const command of contributed) assert.ok(registered.has(command), `${command} must be registered after activation`)
  assert.ok(registered.has("workbench.view.extension.gaep"), "the GAEP Activity Bar container command must exist")
  for (const viewId of viewIds) assert.ok(registered.has(`${viewId}.focus`), `${viewId} must expose a native focus command`)

  await vscode.commands.executeCommand("workbench.view.extension.gaep")
  for (const viewId of viewIds) await vscode.commands.executeCommand(`${viewId}.focus`)
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

const FOUR_IDE_HOSTS = ["kiro", "rider", "visual-studio", "vscode"]

/**
 * Write an untracked candidate signal into the exact directory the producer created
 * (GAEP_E2E_CANDIDATE_DIR). The suite never publishes tracked acceptance artifacts; the
 * producer builds, verifies, and atomically publishes the durable bundle from this signal.
 */
/**
 * Only a fixed failure CODE is signalled — never a raw error message. The producer maps the
 * code to an allowlisted one-line summary, so absolute paths, candidate directories, newlines,
 * logs, and secrets can never reach tracked evidence.
 */
function writeCandidateSignal(outcome, snapshot, failureCode) {
  const candidateDir = process.env.GAEP_E2E_CANDIDATE_DIR
  if (process.env.GAEP_E2E_EMIT_OBSERVATION !== "1" || !candidateDir) return
  try {
    const signal = { outcome, observedAt: new Date().toISOString() }
    if (snapshot) signal.snapshot = snapshot
    if (failureCode) signal.failureCode = failureCode
    writeFileSync(path.join(candidateDir, "candidate-result.json"), `${JSON.stringify(signal, null, 2)}\n`)
  } catch (error) {
    process.stdout.write(`GAEP candidate signal write failed: ${error && error.message}\n`)
  }
}

async function assertPlatformReadinessReadOnly(root) {
  const registered = new Set(await vscode.commands.getCommands(true))
  assert.ok(registered.has("gaep.showPlatformReadiness"), "gaep.showPlatformReadiness must be registered after activation")
  let snapshot
  let failureCode = "assertion-failed"
  try {
    // Computation proof: the command must return the actual computed snapshot.
    failureCode = "readiness-command-failed"
    snapshot = await vscode.commands.executeCommand("gaep.showPlatformReadiness")
    assert.ok(snapshot && typeof snapshot === "object", "the readiness command must return a computed snapshot")
    assert.ok(Array.isArray(snapshot.providers), "the readiness snapshot must carry a providers array")
    failureCode = "matrix-assertion-failed"
    assert.deepEqual(
      (snapshot.hostMatrix || []).map((row) => row.host).sort(),
      FOUR_IDE_HOSTS,
      "the readiness snapshot must carry exactly the Four-IDE host matrix",
    )
    // Read-only proof: executing the command must not create Product state.
    failureCode = "workspace-mutation-detected"
    await assertAbsent(path.join(root, ".gaep"))
  } catch (error) {
    writeCandidateSignal("failed", snapshot, failureCode)
    throw error
  }
  writeCandidateSignal("passed", snapshot)
}

async function assertAgentModelDashboardReadOnly(root) {
  const registered = new Set(await vscode.commands.getCommands(true))
  for (const command of ["gaep.selectProvider", "gaep.selectModel", "gaep.runReadOnlyAnalysis", "gaep.cancelAnalysis", "gaep.showAgentModelDashboard"]) {
    assert.ok(registered.has(command), `${command} must be registered after activation`)
  }
  // The dashboard command is read-only: it must not create Product state, even when the packaged
  // Engine Host runtime is unavailable in the unbuilt test host.
  await vscode.commands.executeCommand("gaep.showAgentModelDashboard")
  await assertAbsent(path.join(root, ".gaep"))
}

async function runOpenPhase() {
  await assertWorkspace(1)
  const extension = await activateExtension()
  await assertCommandsAndViews(extension)
  await assertAbsent(path.join(expectedRoots()[0], ".gaep"))
  await assertPlatformReadinessReadOnly(expectedRoots()[0])
  await assertAgentModelDashboardReadOnly(expectedRoots()[0])
  await openStudio()
  await assertAbsent(path.join(expectedRoots()[0], ".gaep"))
  process.stdout.write("PASS open: activation, all contributed commands, four native views, read-only platform readiness, read-only agent/model dashboard, and Product Studio open\n")
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
  if (phase === "multi-root") return runMultiRootPhase()
  throw new Error(`Unknown GAEP_E2E_PHASE: ${String(phase)}`)
}

module.exports = { run }
