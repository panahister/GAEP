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

const changeCatalogLimitations = [
  "The catalog contains exact current Change metadata only; Product text, Change text, and source content are withheld.",
  "At most 256 Changes are shown in deterministic ID order; omitted Changes require another governed selection surface.",
]

const changeImpactLimitations = [
  "Only persisted Work Item scopes and trace links are shown; missing trace does not prove missing impact.",
  "The current record model has no general Change approval record, so approval remains not established.",
]

function assertExactReference(reference, recordType, label) {
  assertExactKeys(reference, ["recordType", "recordId", "revision", "digest"], label)
  if (reference.recordType !== recordType) fail(`${label} record type differs`)
  assertUuid(reference.recordId, `${label}.recordId`)
  if (!Number.isSafeInteger(reference.revision) || reference.revision < 1) fail(`${label}.revision must be positive`)
  assertDigest(reference.digest, `${label}.digest`)
}

function assertSameReference(left, right, label) {
  if (left.recordType !== right.recordType || left.recordId.toLowerCase() !== right.recordId.toLowerCase() ||
      left.revision !== right.revision || left.digest !== right.digest) fail(`${label} differs`)
}

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

function verifyChangeCatalog(catalog, phaseProduct) {
  assertExactKeys(catalog, [
    "schemaVersion", "kind", "product", "items", "total", "omitted", "observedAt", "sourceBoundary",
    "limitations", "authorityBoundary", "snapshotDigest",
  ], "receipt.changeImpact.catalog")
  if (catalog.schemaVersion !== 1 || catalog.kind !== "change-impact-change-catalog" ||
      catalog.sourceBoundary !== "current-governed-change-metadata-only" ||
      catalog.authorityBoundary !== "change-catalog-selection-does-not-approve-change-or-authorize-effects") {
    fail("Change catalog identity or authority boundary differs")
  }
  assertExactReference(catalog.product, "product", "receipt.changeImpact.catalog.product")
  assertSameReference(catalog.product, phaseProduct, "Change catalog Product binding")
  if (!Array.isArray(catalog.items) || catalog.items.length !== 1 || catalog.total !== 1 || catalog.omitted !== 0) {
    fail("Change catalog counts must reconcile to the canonical one-Change projection")
  }
  const item = catalog.items[0]
  assertExactKeys(item, ["recordType", "recordId", "revision", "digest", "state", "effectEnvelope"], "receipt.changeImpact.catalog.items[0]")
  assertExactReference((({ state: _state, effectEnvelope: _effects, ...reference }) => reference)(item), "change", "receipt.changeImpact.catalog.items[0].reference")
  if (item.state !== "proposed" || canonicalJson(item.effectEnvelope) !== canonicalJson(["observe"])) {
    fail("Change catalog item differs from the canonical proposed observation-only Change")
  }
  assertDate(catalog.observedAt, "receipt.changeImpact.catalog.observedAt")
  if (canonicalJson(catalog.limitations) !== canonicalJson(changeCatalogLimitations)) fail("Change catalog limitations differ")
  assertDigest(catalog.snapshotDigest, "receipt.changeImpact.catalog.snapshotDigest")
  const { snapshotDigest, ...content } = catalog
  if (snapshotDigest !== canonicalDigest(content)) fail("Change catalog snapshot digest differs")
  return item
}

function assertLimit(limit, expected, label) {
  assertExactKeys(limit, ["shown", "total", "omitted"], label)
  if (limit.shown !== expected || limit.total !== expected || limit.omitted !== 0) {
    fail(`${label} does not reconcile to the canonical projection`)
  }
}

function verifyProjectedRecord(record, recordType, state, label) {
  assertExactKeys(record, ["record", "state"], label)
  assertExactReference(record.record, recordType, `${label}.record`)
  if (record.state !== state) fail(`${label} state differs`)
}

function verifyChangeImpactDashboard(dashboard, phaseProduct, catalogItem) {
  assertExactKeys(dashboard, [
    "schemaVersion", "kind", "product", "change", "workItems", "changedArtifacts", "effectTargets",
    "affectedUnits", "governance", "freshness", "limits", "observedAt", "sourceBoundary", "limitations",
    "authorityBoundary", "snapshotDigest",
  ], "receipt.changeImpact.dashboard")
  if (dashboard.schemaVersion !== 1 || dashboard.kind !== "change-impact-dashboard" ||
      dashboard.sourceBoundary !== "current-governed-records-and-bounded-trace-analysis" ||
      dashboard.authorityBoundary !== "change-impact-dashboard-does-not-approve-change-accept-risk-or-authorize-effects") {
    fail("Change/Impact dashboard identity or authority boundary differs")
  }
  assertExactReference(dashboard.product, "product", "receipt.changeImpact.dashboard.product")
  assertSameReference(dashboard.product, phaseProduct, "Change/Impact dashboard Product binding")
  assertExactKeys(dashboard.change, ["recordType", "recordId", "revision", "digest", "state", "effectEnvelope"], "receipt.changeImpact.dashboard.change")
  assertExactReference((({ state: _state, effectEnvelope: _effects, ...reference }) => reference)(dashboard.change), "change", "receipt.changeImpact.dashboard.change.reference")
  assertSameReference(dashboard.change, catalogItem, "Change/Impact selected Change binding")
  if (dashboard.change.state !== "proposed" || canonicalJson(dashboard.change.effectEnvelope) !== canonicalJson(["observe"])) {
    fail("Change/Impact selected Change semantics differ")
  }

  if (!Array.isArray(dashboard.workItems) || dashboard.workItems.length !== 1) fail("Change/Impact dashboard must contain one Work Item")
  verifyProjectedRecord(dashboard.workItems[0], "work-item", "proposed", "receipt.changeImpact.dashboard.workItems[0]")
  const workItemReference = dashboard.workItems[0].record
  const verifyArtifact = (artifact, locator, label) => {
    assertExactKeys(artifact, ["sourceWorkItem", "locator"], label)
    assertExactReference(artifact.sourceWorkItem, "work-item", `${label}.sourceWorkItem`)
    assertSameReference(artifact.sourceWorkItem, workItemReference, `${label} Work Item binding`)
    if (canonicalJson(artifact.locator) !== canonicalJson(locator)) fail(`${label} locator differs`)
  }
  if (!Array.isArray(dashboard.changedArtifacts) || dashboard.changedArtifacts.length !== 1) {
    fail("Change/Impact dashboard must contain one changed artifact")
  }
  verifyArtifact(dashboard.changedArtifacts[0], {
    kind: "workspace-relative", path: "packages/engine/src/change-impact-dashboard.ts",
  }, "receipt.changeImpact.dashboard.changedArtifacts[0]")
  if (!Array.isArray(dashboard.effectTargets) || dashboard.effectTargets.length !== 1) {
    fail("Change/Impact dashboard must contain one effect target")
  }
  verifyArtifact(dashboard.effectTargets[0], {
    kind: "logical", value: "phase0.example.change-impact",
  }, "receipt.changeImpact.dashboard.effectTargets[0]")

  if (!Array.isArray(dashboard.affectedUnits) || dashboard.affectedUnits.length !== 2) {
    fail("Change/Impact dashboard must contain the exact Decision and Risk affected units")
  }
  const affectedTypes = new Set()
  for (const [index, unit] of dashboard.affectedUnits.entries()) {
    const label = `receipt.changeImpact.dashboard.affectedUnits[${index}]`
    assertExactKeys(unit, ["direction", "relationship", "endpoint", "trace"], label)
    if (unit.direction !== "upstream" || unit.relationship !== "affects") fail(`${label} relationship differs`)
    assertExactReference(unit.endpoint, unit.endpoint?.recordType, `${label}.endpoint`)
    if (unit.endpoint.recordType !== "decision" && unit.endpoint.recordType !== "risk") fail(`${label} endpoint type differs`)
    if (affectedTypes.has(unit.endpoint.recordType)) fail("Change/Impact affected unit types must be unique")
    affectedTypes.add(unit.endpoint.recordType)
    assertExactKeys(unit.trace, ["recordId", "revision", "assessmentDigest", "assessedState"], `${label}.trace`)
    assertUuid(unit.trace.recordId, `${label}.trace.recordId`)
    if (unit.trace.revision !== 1 || unit.trace.assessedState !== "valid") fail(`${label} trace assessment differs`)
    assertDigest(unit.trace.assessmentDigest, `${label}.trace.assessmentDigest`)
  }

  assertExactKeys(dashboard.governance, ["approval", "decisions", "risks", "authorityBoundary"], "receipt.changeImpact.dashboard.governance")
  assertExactKeys(dashboard.governance.approval, ["state", "basis"], "receipt.changeImpact.dashboard.governance.approval")
  if (dashboard.governance.approval.state !== "not-established" ||
      dashboard.governance.approval.basis !== "current-contract-has-no-change-approval-record" ||
      dashboard.governance.authorityBoundary !== "decisions-and-risk-acceptance-do-not-approve-the-change") {
    fail("Change/Impact governance authority differs")
  }
  if (!Array.isArray(dashboard.governance.decisions) || dashboard.governance.decisions.length !== 1) {
    fail("Change/Impact governance must contain one Decision")
  }
  const decision = dashboard.governance.decisions[0]
  assertExactKeys(decision, ["record", "state", "outcome"], "receipt.changeImpact.dashboard.governance.decisions[0]")
  assertExactReference(decision.record, "decision", "receipt.changeImpact.dashboard.governance.decisions[0].record")
  if (decision.state !== "open" || decision.outcome !== "not-selected") fail("Change/Impact Decision semantics differ")
  if (!Array.isArray(dashboard.governance.risks) || dashboard.governance.risks.length !== 1) {
    fail("Change/Impact governance must contain one Risk")
  }
  const risk = dashboard.governance.risks[0]
  assertExactKeys(risk, ["record", "state", "likelihood", "impact", "acceptance"], "receipt.changeImpact.dashboard.governance.risks[0]")
  assertExactReference(risk.record, "risk", "receipt.changeImpact.dashboard.governance.risks[0].record")
  if (risk.state !== "open" || risk.likelihood !== "possible" || risk.impact !== "major" || risk.acceptance !== "not-accepted") {
    fail("Change/Impact Risk semantics differ")
  }
  const affectedIds = new Map(dashboard.affectedUnits.map((unit) => [unit.endpoint.recordType, unit.endpoint.recordId]))
  if (affectedIds.get("decision") !== decision.record.recordId || affectedIds.get("risk") !== risk.record.recordId) {
    fail("Change/Impact trace endpoints differ from the projected governance records")
  }

  assertExactKeys(dashboard.freshness, [
    "state", "evaluatedAt", "unresolvedTraceLinks", "invalidTraceLinks", "staleTraceLinks",
    "staleGovernanceReferences", "traceAnalysisTruncated", "coverageBoundary",
  ], "receipt.changeImpact.dashboard.freshness")
  if (dashboard.freshness.state !== "current" || dashboard.freshness.unresolvedTraceLinks !== 0 ||
      dashboard.freshness.invalidTraceLinks !== 0 || dashboard.freshness.staleTraceLinks !== 0 ||
      dashboard.freshness.staleGovernanceReferences !== 0 || dashboard.freshness.traceAnalysisTruncated !== false ||
      dashboard.freshness.coverageBoundary !== "absence-of-a-trace-link-does-not-prove-absence-of-impact") {
    fail("Change/Impact freshness differs from the current exact trace graph")
  }
  assertDate(dashboard.freshness.evaluatedAt, "receipt.changeImpact.dashboard.freshness.evaluatedAt")
  assertDate(dashboard.observedAt, "receipt.changeImpact.dashboard.observedAt")
  if (dashboard.freshness.evaluatedAt !== dashboard.observedAt) fail("Change/Impact observation is not bound to its trace evaluation")

  assertExactKeys(dashboard.limits, [
    "workItems", "changedArtifacts", "effectTargets", "affectedUnits", "decisions", "risks", "truncated",
  ], "receipt.changeImpact.dashboard.limits")
  assertLimit(dashboard.limits.workItems, 1, "receipt.changeImpact.dashboard.limits.workItems")
  assertLimit(dashboard.limits.changedArtifacts, 1, "receipt.changeImpact.dashboard.limits.changedArtifacts")
  assertLimit(dashboard.limits.effectTargets, 1, "receipt.changeImpact.dashboard.limits.effectTargets")
  assertLimit(dashboard.limits.affectedUnits, 2, "receipt.changeImpact.dashboard.limits.affectedUnits")
  assertLimit(dashboard.limits.decisions, 1, "receipt.changeImpact.dashboard.limits.decisions")
  assertLimit(dashboard.limits.risks, 1, "receipt.changeImpact.dashboard.limits.risks")
  if (dashboard.limits.truncated !== false) fail("Change/Impact dashboard must not claim truncation")
  if (canonicalJson(dashboard.limitations) !== canonicalJson(changeImpactLimitations)) fail("Change/Impact dashboard limitations differ")
  assertDigest(dashboard.snapshotDigest, "receipt.changeImpact.dashboard.snapshotDigest")
  const { snapshotDigest, ...content } = dashboard
  if (snapshotDigest !== canonicalDigest(content)) fail("Change/Impact dashboard snapshot digest differs")
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

function changeImpactSemanticProjection(changeImpact) {
  return {
    changeCatalogCount: changeImpact.catalog.total,
    changeCatalogOmitted: changeImpact.catalog.omitted,
    changeImpactWorkItemCount: changeImpact.dashboard.workItems.length,
    changeImpactChangedArtifactCount: changeImpact.dashboard.changedArtifacts.length,
    changeImpactEffectTargetCount: changeImpact.dashboard.effectTargets.length,
    changeImpactAffectedUnitCount: changeImpact.dashboard.affectedUnits.length,
    changeImpactDecisionCount: changeImpact.dashboard.governance.decisions.length,
    changeImpactRiskCount: changeImpact.dashboard.governance.risks.length,
    changeImpactFreshness: changeImpact.dashboard.freshness.state,
    changeImpactApproval: changeImpact.dashboard.governance.approval.state,
    changeImpactTruncated: changeImpact.dashboard.limits.truncated,
    changeImpactAuthorityBoundary: changeImpact.dashboard.authorityBoundary,
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
    "schemaVersion", "kind", "id", "actorId", "product", "initiative", "changeImpact", "context", "workflow", "charter", "execution",
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
    "dashboardAuthorityBoundary", "changeCatalogCount", "changeCatalogOmitted", "changeImpactWorkItemCount",
    "changeImpactChangedArtifactCount", "changeImpactEffectTargetCount", "changeImpactAffectedUnitCount",
    "changeImpactDecisionCount", "changeImpactRiskCount", "changeImpactFreshness", "changeImpactApproval",
    "changeImpactTruncated", "changeImpactAuthorityBoundary",
  ], "expected summary")
  if (expectedSummary.schemaVersion !== 1 || expectedSummary.kind !== "gaep-phase0-example-semantic-summary" ||
      expectedSummary.scenarioId !== scenario.id) fail("expected summary identity differs from the canonical scenario")
  return { scenario, expectedSummary }
}

export async function verifyPhase0ExampleReceiptObject(receipt) {
  const { scenario, expectedSummary } = await loadPhase0ExampleContract()
  assertExactKeys(receipt, [
    "schemaVersion", "kind", "scenario", "portableRun", "dashboard", "changeImpact", "summary", "summaryDigest",
    "expectedSummaryDigest", "integrity", "authority", "limitations",
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
  assertExactKeys(receipt.changeImpact, ["catalog", "dashboard"], "receipt.changeImpact")
  const catalogItem = verifyChangeCatalog(receipt.changeImpact.catalog, receipt.dashboard.product)
  verifyChangeImpactDashboard(receipt.changeImpact.dashboard, receipt.dashboard.product, catalogItem)

  if (canonicalJson(receipt.summary) !== canonicalJson(expectedSummary)) fail("semantic summary differs from the checked-in expectation")
  const semanticProjection = {
    ...dashboardSemanticProjection(receipt.dashboard),
    ...changeImpactSemanticProjection(receipt.changeImpact),
  }
  for (const [key, value] of Object.entries(semanticProjection)) {
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
    "dashboardCompositionDigestMatches", "changeCatalogSnapshotDigestMatches", "changeImpactSnapshotDigestMatches",
    "changeImpactProductBindingMatches", "changeImpactChangeBindingMatches",
  ], "receipt.integrity")
  if (receipt.integrity.auditValid !== true) fail("portable audit is not valid")
  if (!Number.isSafeInteger(receipt.integrity.auditEventCount) || receipt.integrity.auditEventCount < 1 ||
      receipt.integrity.auditEventCount > 10_000) fail("audit event count is outside the receipt bound")
  if (receipt.integrity.inventoryCount !== 1) fail("managed Run inventory must contain exactly one item")
  assertDigest(receipt.integrity.inventorySnapshotDigest, "receipt.integrity.inventorySnapshotDigest")
  for (const key of [
    "recordResultDigestMatches", "resultEvidenceDigestMatches", "evidenceEventsDigestMatches",
    "dashboardProductDigestMatches", "dashboardCompositionDigestMatches", "changeCatalogSnapshotDigestMatches",
    "changeImpactSnapshotDigestMatches", "changeImpactProductBindingMatches", "changeImpactChangeBindingMatches",
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
  for (const forbidden of [
    "deterministic output", "manual-thread-", "manual-turn-", "providerThreadId", "providerTurnId",
    "Add an exact Change and impact projection", "Incomplete trace coverage",
  ]) {
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
