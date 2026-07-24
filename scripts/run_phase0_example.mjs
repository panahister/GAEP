import { randomUUID } from "node:crypto"
import { lstat, mkdir, mkdtemp, open, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { DeterministicManualAdapter, canonicalDigest } from "@gaep/agent-sdk"
import {
  composeChangeImpactChangeCatalog,
  composeChangeImpactDashboard,
  composePhaseDashboardFramework,
  GaepEngine,
} from "@gaep/engine"

import { loadPhase0ExampleContract, verifyPhase0ExampleReceiptObject } from "./verify_phase0_example_receipt.mjs"

const workspaceRoot = { kind: "workspace-relative", path: "." }
const receiptByteLimit = 128 * 1024
const limitations = [
  "Offline deterministic runtime evidence does not validate a real provider.",
  "This example does not validate native IDE installation, activation, rendering, or accessibility.",
  "A satisfied scripted outcome is not Product readiness, release acceptance, deployment approval, or production evidence.",
]

function contextTrust(scenario) {
  return {
    semanticAuthority: {
      standing: "advisory",
      domain: "Release readiness evidence",
      owner: scenario.actorId,
      scope: ["Canonical offline Phase 0 example"],
      precedence: 10,
    },
    epistemicRole: "reference",
    sourceAuthenticity: "verified",
    contentIntegrity: "verified",
    confidentiality: {
      classification: "internal",
      purpose: "Exercise the deterministic offline managed-runtime contract",
      recipients: [scenario.execution.agentId],
      retention: "Retain with the governed example Product",
    },
    instructionPrivilege: "workflow-data",
    freshness: { status: "fresh", assessedAt: "2026-07-24T00:00:00.000Z", basis: "Versioned canonical fixture" },
    validity: { status: "valid", basis: "Checked-in example contract" },
    revisionDisposition: "current",
    applicability: { status: "applicable", basis: "Targets this exact example Workflow" },
  }
}

function semanticSummary({
  scenario,
  preview,
  receipt,
  plan,
  evidence,
  audit,
  inventory,
  dashboard,
  changeCatalog,
  changeImpactDashboard,
}) {
  return {
    schemaVersion: 1,
    kind: "gaep-phase0-example-semantic-summary",
    scenarioId: scenario.id,
    adapterId: receipt.adapterId,
    agentId: receipt.agentId,
    modelId: receipt.modelId,
    executionMode: receipt.mode,
    state: receipt.state,
    providerDisposition: receipt.providerDisposition,
    outcomeStatus: receipt.outcomeStatus,
    outcomeBasis: receipt.outcomeBasis,
    workflowStrategy: preview.strategy,
    contextPackCount: preview.contextPackCount,
    toolDefinitionCount: plan.toolDefinitions.length,
    readScopeCount: preview.readScopeCount,
    writeScopeCount: plan.steps.reduce((count, step) => count + step.scope.write.length, 0),
    gatePhases: preview.gates.map((gate) => gate.phase),
    completedStepCount: receipt.completedStepCount,
    totalStepCount: receipt.totalStepCount,
    eventTypes: evidence.events.map((event) => event.type),
    eventCount: receipt.eventCount,
    actualEffects: evidence.actualEffects.map(({ effect, status }) => ({ effect, status })),
    stagingPresent: evidence.staging !== undefined,
    warnings: receipt.warnings,
    auditValid: audit.valid,
    managedInventoryCount: inventory.total,
    dashboardPhase: dashboard.phase.id,
    dashboardPanelIds: dashboard.panels.map((panel) => panel.id),
    dashboardApplicability: dashboard.panels.map((panel) => ({
      status: panel.applicability.status,
      basis: panel.applicability.basis,
    })),
    dashboardStates: dashboard.panels.map((panel) => panel.state),
    dashboardAuthorityBoundary: dashboard.authorityBoundary,
    changeCatalogCount: changeCatalog.total,
    changeCatalogOmitted: changeCatalog.omitted,
    changeImpactWorkItemCount: changeImpactDashboard.workItems.length,
    changeImpactChangedArtifactCount: changeImpactDashboard.changedArtifacts.length,
    changeImpactEffectTargetCount: changeImpactDashboard.effectTargets.length,
    changeImpactAffectedUnitCount: changeImpactDashboard.affectedUnits.length,
    changeImpactDecisionCount: changeImpactDashboard.governance.decisions.length,
    changeImpactRiskCount: changeImpactDashboard.governance.risks.length,
    changeImpactFreshness: changeImpactDashboard.freshness.state,
    changeImpactApproval: changeImpactDashboard.governance.approval.state,
    changeImpactTruncated: changeImpactDashboard.limits.truncated,
    changeImpactAuthorityBoundary: changeImpactDashboard.authorityBoundary,
  }
}

function exactReference(recordType, record) {
  return {
    recordType,
    recordId: record.id,
    revision: record.revision,
    digest: canonicalDigest(record),
  }
}

async function createExample(workspace, scenario, expectedSummary) {
  const adapter = new DeterministicManualAdapter()
  const engine = new GaepEngine(workspace, [adapter])
  const actorId = scenario.actorId
  const product = await engine.createProduct(scenario.product, actorId)
  const productRevision = product.revision ?? 1
  const productDigest = canonicalDigest(product)
  const dashboard = composePhaseDashboardFramework(product, {
    phase: "phase-0-1a-foundation",
    expectedProductId: product.id,
    expectedProductRevision: productRevision,
    expectedProductDigest: productDigest,
  }, "2026-07-24T00:00:00.000Z")
  const initiative = await engine.createInitiative(scenario.initiative, actorId)
  await engine.updateInitiativeState(initiative.id, "active", "Begin the canonical offline evidence review", actorId)

  const change = await engine.productStudio.createChange({
    initiativeId: initiative.id,
    ...scenario.changeImpact.change,
  }, productRevision, actorId)
  const workItem = await engine.productStudio.createWorkItem({
    changeId: change.id,
    ...scenario.changeImpact.workItem,
  }, productRevision, actorId)
  const decision = await engine.productStudio.createDecision({
    ...scenario.changeImpact.decision,
    affectedRecords: [exactReference("change", change)],
  }, productRevision, actorId)
  const risk = await engine.productStudio.createRisk(scenario.changeImpact.risk, productRevision, actorId)
  const changeReference = exactReference("change", change)
  for (const [recordType, record] of [["decision", decision], ["risk", risk]]) {
    await engine.productStudio.createTraceLink({
      source: exactReference(recordType, record),
      relationship: "affects",
      target: changeReference,
      provenance: { kind: "human", actorId, rationale: scenario.changeImpact.traceRationale },
    }, productRevision, actorId)
  }
  const traceImpact = await engine.productStudio.impactAnalysis(changeReference)
  const changeImpactObservedAt = traceImpact.evaluatedAt
  const changeCatalog = composeChangeImpactChangeCatalog(product, [change], {
    expectedProductId: product.id,
    expectedProductRevision: productRevision,
    expectedProductDigest: productDigest,
  }, changeImpactObservedAt)
  const changeImpactDashboard = composeChangeImpactDashboard({
    product,
    change,
    workItems: [workItem],
    traceImpact,
    decisions: [decision],
    risks: [risk],
  }, {
    expectedProductId: product.id,
    expectedProductRevision: productRevision,
    expectedProductDigest: productDigest,
    expectedChangeId: change.id,
    expectedChangeRevision: change.revision,
    expectedChangeDigest: canonicalDigest(change),
  }, changeImpactObservedAt)

  const probe = await adapter.probe()
  if (probe.capabilities.adapterId !== scenario.execution.adapterId ||
      probe.capabilities.agentId !== scenario.execution.agentId) {
    throw new Error("Deterministic adapter identity differs from the canonical scenario")
  }
  await engine.selectAgent(
    probe.capabilities,
    scenario.execution.modelId,
    { script: scenario.execution.script },
    actorId,
  )

  const contextItem = {
    id: randomUUID(),
    source: { kind: "logical", value: scenario.context.source },
    sourceDigest: canonicalDigest(scenario.context.content),
    selectionReason: scenario.context.selectionReason,
    required: true,
    content: scenario.context.content,
    contentDigest: canonicalDigest(scenario.context.content),
    trust: contextTrust(scenario),
    transformations: [],
  }
  const contextPack = await engine.productStudio.createContextPack({
    objective: scenario.context.objective,
    recipient: { kind: "agent", id: scenario.execution.agentId },
    items: [contextItem],
    omissions: [],
    warnings: [],
    conflicts: [],
    classificationCombinationRisk: "The single internal example item adds no material combination risk.",
    sufficiencyCriteria: scenario.context.sufficiencyCriteria,
    sufficiencyEvaluator: { kind: "system", id: "gaep.phase0-example" },
    sufficiencyAssumptions: [],
  }, product.revision ?? 1, actorId)
  const contextPackRef = {
    recordType: "context-pack",
    recordId: contextPack.id,
    revision: contextPack.revision,
    digest: canonicalDigest(contextPack),
  }

  const step = {
    id: randomUUID(),
    title: scenario.workflow.stepTitle,
    objective: scenario.workflow.stepObjective,
    responsibility: { kind: "agent", id: scenario.execution.agentId },
    contextPacks: [contextPackRef],
    toolDefinitions: [],
    dependsOn: [],
    preconditions: scenario.workflow.preconditions,
    outputs: scenario.workflow.outputs,
    evidenceCriteria: scenario.workflow.evidenceCriteria,
    retry: { maxAttempts: 1, backoffMs: 0, retryOn: [] },
    stopConditions: scenario.workflow.stopConditions,
    scope: { read: [workspaceRoot], write: [], effects: [] },
    effectEnvelope: ["observe"],
  }
  const draftPlan = await engine.productStudio.createWorkflowPlan({
    title: scenario.workflow.title,
    objective: scenario.workflow.objective,
    subject: {
      recordType: "product",
      recordId: product.id,
      revision: product.revision ?? 1,
      digest: canonicalDigest(product),
    },
    actor: { kind: "human", id: actorId },
    strategy: "sequential",
    contextPacks: [contextPackRef],
    toolDefinitions: [],
    steps: [step],
  }, product.revision ?? 1, actorId)
  const plan = await engine.productStudio.reviseWorkflowPlan(
    draftPlan.id,
    draftPlan.revision,
    { state: "resolved" },
    actorId,
    "The exact Context Pack, observation-only effect, and empty Tool/write envelope are resolved",
  )

  const charter = await engine.createCharter({
    initiativeId: initiative.id,
    objective: scenario.charter.objective,
    permissions: [{ capability: "all-tools", mode: "deny", scope: [] }],
    expectedEffects: ["observe"],
    forbiddenActions: scenario.charter.forbiddenActions,
    stopConditions: scenario.charter.stopConditions,
    requiredEvidence: scenario.charter.requiredEvidence,
    managedIntent: {
      workflowPlan: {
        recordType: "workflow-plan",
        recordId: plan.id,
        revision: plan.revision,
        digest: canonicalDigest(plan),
      },
      contextPacks: [contextPackRef],
      toolDefinitions: [],
      requestedEffects: ["observe"],
      requestedScopes: [],
    },
  }, actorId)
  await engine.confirmCharter(charter.id, actorId)
  const preview = await engine.previewManagedReadOnlyExecution(charter.id, plan.id)
  const receipt = await engine.executeManagedReadOnly({
    charterId: charter.id,
    workflowPlanId: plan.id,
    expectedPreviewDigest: preview.previewDigest,
    timeoutMs: scenario.execution.timeoutMs,
  }, actorId)

  const record = await engine.readManagedRun(receipt.managedRunId)
  if (!record.resultId) throw new Error("Completed managed Run does not bind a result")
  const result = await engine.readManagedRunResult(record.resultId)
  const evidence = await engine.readManagedRunEvidence(result.evidenceId)
  const [audit, inventory] = await Promise.all([
    engine.repository.verifyAudit(),
    engine.listManagedRunsPage({ offset: 0, limit: 10 }),
  ])
  const summary = semanticSummary({
    scenario,
    preview,
    receipt,
    plan,
    evidence,
    audit,
    inventory,
    dashboard,
    changeCatalog,
    changeImpactDashboard,
  })
  const summaryDigest = canonicalDigest(summary)
  const expectedSummaryDigest = canonicalDigest(expectedSummary)
  if (summaryDigest !== expectedSummaryDigest) {
    throw new Error(`Canonical semantic summary changed: expected ${expectedSummaryDigest}, observed ${summaryDigest}`)
  }

  const output = {
    schemaVersion: 2,
    kind: "gaep-phase0-example-receipt",
    scenario: { id: scenario.id, digest: canonicalDigest(scenario) },
    portableRun: {
      previewDigest: receipt.previewDigest,
      runId: receipt.runId,
      managedRunId: receipt.managedRunId,
      resultDigest: receipt.resultDigest,
      evidenceDigest: receipt.evidenceDigest,
      startedAt: receipt.startedAt,
      endedAt: receipt.endedAt,
    },
    dashboard,
    changeImpact: {
      catalog: changeCatalog,
      dashboard: changeImpactDashboard,
    },
    summary,
    summaryDigest,
    expectedSummaryDigest,
    integrity: {
      auditValid: audit.valid,
      auditEventCount: audit.events,
      inventoryCount: inventory.total,
      inventorySnapshotDigest: inventory.snapshotDigest,
      recordResultDigestMatches: record.resultDigest === canonicalDigest(result) && record.resultDigest === receipt.resultDigest,
      resultEvidenceDigestMatches: result.evidenceDigest === canonicalDigest(evidence) && result.evidenceDigest === receipt.evidenceDigest,
      evidenceEventsDigestMatches: evidence.eventsDigest === canonicalDigest(evidence.events),
      dashboardProductDigestMatches: dashboard.product.recordId === product.id &&
        dashboard.product.revision === productRevision && dashboard.product.digest === productDigest,
      dashboardCompositionDigestMatches: dashboard.compositionDigest === canonicalDigest((({ compositionDigest: _, ...content }) => content)(dashboard)),
      changeCatalogSnapshotDigestMatches: changeCatalog.snapshotDigest === canonicalDigest((({ snapshotDigest: _, ...content }) => content)(changeCatalog)),
      changeImpactSnapshotDigestMatches: changeImpactDashboard.snapshotDigest === canonicalDigest((({ snapshotDigest: _, ...content }) => content)(changeImpactDashboard)),
      changeImpactProductBindingMatches: changeCatalog.product.recordId === dashboard.product.recordId &&
        changeCatalog.product.revision === dashboard.product.revision && changeCatalog.product.digest === dashboard.product.digest &&
        changeImpactDashboard.product.recordId === dashboard.product.recordId &&
        changeImpactDashboard.product.revision === dashboard.product.revision && changeImpactDashboard.product.digest === dashboard.product.digest,
      changeImpactChangeBindingMatches: changeCatalog.items.length === 1 &&
        changeCatalog.items[0].recordId === changeImpactDashboard.change.recordId &&
        changeCatalog.items[0].revision === changeImpactDashboard.change.revision &&
        changeCatalog.items[0].digest === changeImpactDashboard.change.digest,
    },
    authority: {
      previewBoundary: preview.authorityBoundary,
      receiptBoundary: receipt.authorityBoundary,
      requestedEffects: ["observe"],
      toolPermissions: [{ capability: "all-tools", mode: "deny", scope: [] }],
      workspaceWriteScope: [],
      networkRequirement: "none-deterministic-in-process-runtime",
    },
    limitations,
  }
  const serialized = JSON.stringify(output)
  if (serialized.includes(workspace)) throw new Error("Example receipt exposed its fixture workspace path")
  if (Buffer.byteLength(serialized) > receiptByteLimit) throw new Error("Example receipt exceeded its byte limit")
  return verifyPhase0ExampleReceiptObject(output)
}

export async function runPhase0Example(options = {}) {
  const { scenario, expectedSummary } = await loadPhase0ExampleContract()
  const temporary = options.workspacePath === undefined
  const workspace = temporary
    ? await mkdtemp(resolve(tmpdir(), "gaep-phase0-example-"))
    : resolve(options.workspacePath)
  if (!temporary) {
    const stat = await lstat(workspace)
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Example workspace must be a regular directory")
    if ((await readdir(workspace)).length !== 0) throw new Error("Example workspace must be empty before execution")
  }
  try {
    return await createExample(workspace, scenario, expectedSummary)
  } finally {
    if (temporary) await rm(workspace, { recursive: true, force: true })
  }
}

async function writeExclusive(path, content) {
  const target = resolve(path)
  const parent = await lstat(dirname(target))
  if (!parent.isDirectory() || parent.isSymbolicLink()) throw new Error("Receipt parent must be a regular directory")
  let handle
  try {
    handle = await open(target, "wx", 0o600)
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error("Receipt output already exists; refusing to overwrite it")
    }
    throw error
  }
  try {
    await handle.writeFile(content, "utf8")
    await handle.sync()
  } finally {
    await handle.close()
  }
  const written = await lstat(target)
  if (!written.isFile() || written.isSymbolicLink() || written.size !== Buffer.byteLength(content)) {
    throw new Error("Receipt output is not the exact regular file that was written")
  }
}

async function createArtifactDirectory(path) {
  const target = resolve(path)
  const parent = await lstat(dirname(target))
  if (!parent.isDirectory() || parent.isSymbolicLink()) throw new Error("Artifact parent must be a regular directory")
  try {
    await mkdir(target, { mode: 0o700 })
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error("Artifact directory already exists; refusing to reuse or overwrite it")
    }
    throw error
  }
  const workspace = resolve(target, "workspace")
  await mkdir(workspace, { mode: 0o700 })
  return { target, workspace, receipt: resolve(target, "receipt.json") }
}

function parseArguments(args) {
  if (args.length === 0) return {}
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) return { help: true }
  if (args.length === 2 && args[0] === "--output" && args[1]) return { output: args[1] }
  if (args.length === 2 && args[0] === "--artifacts" && args[1]) return { artifacts: args[1] }
  throw new Error("Usage: node scripts/run_phase0_example.mjs [--output <new-receipt.json> | --artifacts <new-directory>]")
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    process.stdout.write("Usage: npm run example:phase0 -- [--output <new-receipt.json> | --artifacts <new-directory>]\n")
    return
  }
  const artifactDirectory = options.artifacts ? await createArtifactDirectory(options.artifacts) : undefined
  const receipt = await runPhase0Example({ workspacePath: artifactDirectory?.workspace })
  const output = `${JSON.stringify(receipt, null, 2)}\n`
  if (artifactDirectory) await writeExclusive(artifactDirectory.receipt, output)
  else if (options.output) await writeExclusive(options.output, output)
  process.stdout.write(output)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
