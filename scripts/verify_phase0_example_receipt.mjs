import { lstat, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { canonicalDigest, canonicalJson } from "@gaep/agent-sdk"

const scriptDirectory = fileURLToPath(new URL(".", import.meta.url))
const exampleDirectory = resolve(scriptDirectory, "../examples/phase-0-managed-readonly")
const scenarioPath = resolve(exampleDirectory, "scenario.json")
const expectedSummaryPath = resolve(exampleDirectory, "expected-summary.json")
const receiptByteLimit = 128 * 1024
const digestPattern = /^sha256:[0-9a-f]{64}$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function fail(message) {
  throw new Error(`Invalid Phase 0 example receipt: ${message}`)
}

function assertObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`)
}

function assertExactKeys(value, expected, label) {
  assertObject(value, label)
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${label} keys differ; expected ${wanted.join(", ")}, received ${actual.join(", ")}`)
  }
}

function assertDigest(value, label) {
  if (typeof value !== "string" || !digestPattern.test(value)) fail(`${label} must be a canonical SHA-256 digest`)
}

function assertUuid(value, label) {
  if (typeof value !== "string" || !uuidPattern.test(value)) fail(`${label} must be a UUID`)
}

function assertDate(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) fail(`${label} must be an ISO date-time`)
}

const dashboardLimitations = [
  "The selected phase scopes presentation only; it does not prove phase entry, completion, acceptance, or release readiness.",
  "The phase dashboard remains attention-required until a governed applicability decision is bound.",
]

function verifyPhaseDashboard(dashboard) {
  assertExactKeys(dashboard, [
    "schemaVersion", "kind", "catalogVersion", "product", "phase", "panels", "observedAt", "sourceBoundary",
    "limitations", "authorityBoundary", "compositionDigest",
  ], "receipt.dashboard")
  if (dashboard.schemaVersion !== 1 || dashboard.kind !== "phase-dashboard-framework" ||
      dashboard.catalogVersion !== "gaep-phase-dashboards-v1" ||
      dashboard.sourceBoundary !== "governed-repository-and-engine-only" ||
      dashboard.authorityBoundary !== "dashboard-is-a-projection-not-phase-approval-readiness-or-applicability-evidence") {
    fail("dashboard identity or authority boundary differs")
  }
  assertExactKeys(dashboard.product, ["recordType", "recordId", "revision", "digest"], "receipt.dashboard.product")
  if (dashboard.product.recordType !== "product") fail("dashboard Product reference type differs")
  assertUuid(dashboard.product.recordId, "receipt.dashboard.product.recordId")
  if (!Number.isSafeInteger(dashboard.product.revision) || dashboard.product.revision < 1) {
    fail("dashboard Product revision must be positive")
  }
  assertDigest(dashboard.product.digest, "receipt.dashboard.product.digest")
  assertExactKeys(dashboard.phase, ["id", "label"], "receipt.dashboard.phase")
  if (dashboard.phase.id !== "phase-0-1a-foundation" ||
      dashboard.phase.label !== "Phase 0 / 1A — Four-IDE Platform Foundation") {
    fail("dashboard phase differs from the canonical Phase 0/1A example")
  }
  const expectedPanels = [
    ["foundation-summary", "phase", "Foundation summary and readiness", "unknown", "not-evaluated", "attention-required"],
    ["change-impact", "change-impact", "Change and impact", "applicable", "phase-contract", "active"],
    ["agent-model", "agent-model", "Agent and model", "applicable", "phase-contract", "active"],
  ]
  if (!Array.isArray(dashboard.panels) || dashboard.panels.length !== expectedPanels.length) {
    fail("dashboard must contain the canonical three panels")
  }
  dashboard.panels.forEach((panel, index) => {
    assertExactKeys(panel, ["id", "role", "title", "applicability", "state"], `receipt.dashboard.panels[${index}]`)
    assertExactKeys(panel.applicability, ["status", "basis"], `receipt.dashboard.panels[${index}].applicability`)
    const [id, role, title, status, basis, state] = expectedPanels[index]
    if (panel.id !== id || panel.role !== role || panel.title !== title || panel.applicability.status !== status ||
        panel.applicability.basis !== basis || panel.state !== state) {
      fail(`dashboard panel ${index} differs from the canonical applicability contract`)
    }
  })
  assertDate(dashboard.observedAt, "receipt.dashboard.observedAt")
  if (dashboard.observedAt !== "2026-07-24T00:00:00.000Z") fail("dashboard observation time is not deterministic")
  if (canonicalJson(dashboard.limitations) !== canonicalJson(dashboardLimitations)) fail("dashboard limitations differ")
  assertDigest(dashboard.compositionDigest, "receipt.dashboard.compositionDigest")
  const { compositionDigest, ...content } = dashboard
  if (compositionDigest !== canonicalDigest(content)) fail("dashboard composition digest differs")
}

function dashboardSemanticProjection(dashboard) {
  return {
    dashboardPhase: dashboard.phase.id,
    dashboardPanelIds: dashboard.panels.map((panel) => panel.id),
    dashboardApplicability: dashboard.panels.map((panel) => ({
      status: panel.applicability.status,
      basis: panel.applicability.basis,
    })),
    dashboardStates: dashboard.panels.map((panel) => panel.state),
    dashboardAuthorityBoundary: dashboard.authorityBoundary,
  }
}

async function readBoundedJson(path, label, byteLimit = receiptByteLimit) {
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`${label} must be a regular file`)
  if (stat.size < 2 || stat.size > byteLimit) fail(`${label} must be between 2 and ${byteLimit} bytes`)
  let parsed
  try {
    parsed = JSON.parse(await readFile(path, "utf8"))
  } catch {
    fail(`${label} must contain valid JSON`)
  }
  return parsed
}

export async function loadPhase0ExampleContract() {
  const [scenario, expectedSummary] = await Promise.all([
    readBoundedJson(scenarioPath, "scenario", 64 * 1024),
    readBoundedJson(expectedSummaryPath, "expected summary", 64 * 1024),
  ])
  assertExactKeys(scenario, [
    "schemaVersion", "kind", "id", "actorId", "product", "initiative", "context", "workflow", "charter", "execution",
  ], "scenario")
  if (scenario.schemaVersion !== 1 || scenario.kind !== "gaep-phase0-example-scenario") fail("scenario identity is unsupported")
  if (scenario.id !== "phase-0-managed-readonly-v1") fail("scenario ID is unsupported")
  if (scenario.execution?.adapterId !== "gaep.manual" || scenario.execution?.agentId !== "manual" ||
      scenario.execution?.modelId !== "manual-deterministic-v1" || scenario.execution?.script !== "success") {
    fail("scenario must use the deterministic offline success runtime")
  }
  if (!Number.isSafeInteger(scenario.execution.timeoutMs) || scenario.execution.timeoutMs < 1_000 ||
      scenario.execution.timeoutMs > 300_000) fail("scenario timeout is outside the managed read-only bounds")
  assertExactKeys(expectedSummary, [
    "schemaVersion", "kind", "scenarioId", "adapterId", "agentId", "modelId", "executionMode", "state",
    "providerDisposition", "outcomeStatus", "outcomeBasis", "workflowStrategy", "contextPackCount",
    "toolDefinitionCount", "readScopeCount", "writeScopeCount", "gatePhases", "completedStepCount",
    "totalStepCount", "eventTypes", "eventCount", "actualEffects", "stagingPresent", "warnings", "auditValid",
    "managedInventoryCount", "dashboardPhase", "dashboardPanelIds", "dashboardApplicability", "dashboardStates",
    "dashboardAuthorityBoundary",
  ], "expected summary")
  if (expectedSummary.schemaVersion !== 1 || expectedSummary.kind !== "gaep-phase0-example-semantic-summary" ||
      expectedSummary.scenarioId !== scenario.id) fail("expected summary identity differs from the canonical scenario")
  return { scenario, expectedSummary }
}

export async function verifyPhase0ExampleReceiptObject(receipt) {
  const { scenario, expectedSummary } = await loadPhase0ExampleContract()
  assertExactKeys(receipt, [
    "schemaVersion", "kind", "scenario", "portableRun", "dashboard", "summary", "summaryDigest", "expectedSummaryDigest",
    "integrity", "authority", "limitations",
  ], "receipt")
  if (receipt.schemaVersion !== 2 || receipt.kind !== "gaep-phase0-example-receipt") fail("receipt identity is unsupported")

  assertExactKeys(receipt.scenario, ["id", "digest"], "receipt.scenario")
  if (receipt.scenario.id !== scenario.id) fail("scenario ID differs from the canonical example")
  assertDigest(receipt.scenario.digest, "receipt.scenario.digest")
  if (receipt.scenario.digest !== canonicalDigest(scenario)) fail("scenario digest differs from the canonical example")

  assertExactKeys(receipt.portableRun, [
    "previewDigest", "runId", "managedRunId", "resultDigest", "evidenceDigest", "startedAt", "endedAt",
  ], "receipt.portableRun")
  for (const key of ["previewDigest", "resultDigest", "evidenceDigest"]) assertDigest(receipt.portableRun[key], `receipt.portableRun.${key}`)
  for (const key of ["runId", "managedRunId"]) assertUuid(receipt.portableRun[key], `receipt.portableRun.${key}`)
  for (const key of ["startedAt", "endedAt"]) assertDate(receipt.portableRun[key], `receipt.portableRun.${key}`)
  if (Date.parse(receipt.portableRun.endedAt) < Date.parse(receipt.portableRun.startedAt)) fail("portable Run end precedes its start")

  verifyPhaseDashboard(receipt.dashboard)

  if (canonicalJson(receipt.summary) !== canonicalJson(expectedSummary)) fail("semantic summary differs from the checked-in expectation")
  const dashboardProjection = dashboardSemanticProjection(receipt.dashboard)
  for (const [key, value] of Object.entries(dashboardProjection)) {
    if (canonicalJson(receipt.summary[key]) !== canonicalJson(value)) fail(`semantic summary ${key} differs from dashboard`)
  }
  assertDigest(receipt.summaryDigest, "receipt.summaryDigest")
  assertDigest(receipt.expectedSummaryDigest, "receipt.expectedSummaryDigest")
  const expectedDigest = canonicalDigest(expectedSummary)
  if (receipt.summaryDigest !== expectedDigest || receipt.expectedSummaryDigest !== expectedDigest) {
    fail("semantic summary digest does not match the checked-in expectation")
  }

  assertExactKeys(receipt.integrity, [
    "auditValid", "auditEventCount", "inventoryCount", "inventorySnapshotDigest", "recordResultDigestMatches",
    "resultEvidenceDigestMatches", "evidenceEventsDigestMatches", "dashboardProductDigestMatches",
    "dashboardCompositionDigestMatches",
  ], "receipt.integrity")
  if (receipt.integrity.auditValid !== true) fail("portable audit is not valid")
  if (!Number.isSafeInteger(receipt.integrity.auditEventCount) || receipt.integrity.auditEventCount < 1 ||
      receipt.integrity.auditEventCount > 10_000) fail("audit event count is outside the receipt bound")
  if (receipt.integrity.inventoryCount !== 1) fail("managed Run inventory must contain exactly one item")
  assertDigest(receipt.integrity.inventorySnapshotDigest, "receipt.integrity.inventorySnapshotDigest")
  for (const key of [
    "recordResultDigestMatches", "resultEvidenceDigestMatches", "evidenceEventsDigestMatches",
    "dashboardProductDigestMatches", "dashboardCompositionDigestMatches",
  ]) {
    if (receipt.integrity[key] !== true) fail(`${key} must be true`)
  }

  assertExactKeys(receipt.authority, [
    "previewBoundary", "receiptBoundary", "requestedEffects", "toolPermissions", "workspaceWriteScope", "networkRequirement",
  ], "receipt.authority")
  if (receipt.authority.previewBoundary !== "managed-readonly-preview-does-not-grant-execution-or-effect-authority" ||
      receipt.authority.receiptBoundary !== "managed-readonly-receipt-does-not-grant-tool-write-effect-or-outcome-authority") {
    fail("managed read-only authority boundaries differ")
  }
  if (canonicalJson(receipt.authority.requestedEffects) !== canonicalJson(["observe"]) ||
      canonicalJson(receipt.authority.toolPermissions) !== canonicalJson([{ capability: "all-tools", mode: "deny", scope: [] }]) ||
      canonicalJson(receipt.authority.workspaceWriteScope) !== canonicalJson([]) ||
      receipt.authority.networkRequirement !== "none-deterministic-in-process-runtime") {
    fail("receipt grants or implies authority outside the canonical observation-only envelope")
  }

  const expectedLimitations = [
    "Offline deterministic runtime evidence does not validate a real provider.",
    "This example does not validate native IDE installation, activation, rendering, or accessibility.",
    "A satisfied scripted outcome is not Product readiness, release acceptance, deployment approval, or production evidence.",
  ]
  if (canonicalJson(receipt.limitations) !== canonicalJson(expectedLimitations)) fail("receipt limitations differ")

  const serialized = JSON.stringify(receipt)
  if (Buffer.byteLength(serialized) > receiptByteLimit) fail("serialized receipt exceeds the byte limit")
  for (const forbidden of ["deterministic output", "manual-thread-", "manual-turn-", "providerThreadId", "providerTurnId"]) {
    if (serialized.includes(forbidden)) fail(`receipt exposes forbidden provider-local data: ${forbidden}`)
  }
  if (/(?:^|["'\s])\/(?:Users|private|tmp|home)\//.test(serialized) || /[A-Za-z]:\\/.test(serialized)) {
    fail("receipt exposes a local absolute path")
  }
  return receipt
}

export async function verifyPhase0ExampleReceiptFile(path) {
  return verifyPhase0ExampleReceiptObject(await readBoundedJson(resolve(path), "receipt"))
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 1) throw new Error("Usage: node scripts/verify_phase0_example_receipt.mjs <receipt.json>")
  const receipt = await verifyPhase0ExampleReceiptFile(args[0])
  process.stdout.write(`${JSON.stringify({
    valid: true,
    kind: receipt.kind,
    scenarioId: receipt.scenario.id,
    summaryDigest: receipt.summaryDigest,
  }, null, 2)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
