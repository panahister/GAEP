import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { copyFile, lstat, mkdir, mkdtemp, open, readFile, readdir, rename, rm } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  agentModelDashboardContentSchema,
  agentModelDashboardSchema,
  initiativeSchema,
  phase2UxFigmaDashboardContentSchema,
  phase2UxFigmaDashboardSchema,
  phase2UxFigmaDashboardSourceDefinitions,
  phase2UxFigmaDashboardSourceIds,
  productSchema,
} from "@gaep/contracts"
import { composePhase2ChangeImpactAgentModelDashboard } from "@gaep/engine"

const repository = fileURLToPath(new URL("..", import.meta.url))
const scenarioSourcePath = resolve(repository, "examples/phase-2-realistic-figma-loop/scenario.json")
const fileByteLimit = 4 * 1024 * 1024
const receiptByteLimit = 512 * 1024
const artifactByteLimit = 32 * 1024 * 1024
const artifactFileLimit = 128
const digestPattern = /^sha256:[0-9a-f]{64}$/
const expectedTopLevelEntries = [
  "artifact-manifest.json",
  "dashboards",
  "failure-recovery.json",
  "host-projections.json",
  "loop-catalog.json",
  "receipt.json",
  "scenario.json",
  "sources",
]
const expectedDashboardEntries = ["change-impact-agent-model.json", "phase2-ux-figma.json"]
const expectedSourceEntries = ["phase1-reference-receipt.json", "phase2-conformance.json", "phase2-report.json"]

export const phase2RealisticFigmaLoopLimitations = [
  "This is a deterministic local fixture, not real Product research, returned current Figma content, or a production dataset.",
  "No Figma or provider connection, authentication, permission grant, request, transfer, write, import, usage, cost, or semantic-quality assessment occurs.",
  "Recorded human-review, approval, and baseline objects remain candidates; accountable authority, enforced separation of duties, effective approval, and an actual Baseline Set are not established.",
  "Native host and Product Owner acceptance, readiness, security completion, release authorization, and deployment approval remain absent.",
]

function fail(message) {
  throw new Error(`Invalid Phase 2 realistic Figma loop artifact: ${message}`)
}

function rawDigest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

async function assertRegularDirectory(path, label) {
  const stat = await lstat(path)
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail(`${label} must be a regular directory`)
}

async function assertExactDirectoryEntries(path, expected, label) {
  const actual = (await readdir(path)).sort()
  const wanted = [...expected].sort()
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${label} entries differ; expected ${wanted.join(", ")}, received ${actual.join(", ")}`)
  }
}

async function readRegularFile(path, label, byteLimit = fileByteLimit) {
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`${label} must be a regular file`)
  if (stat.size < 2 || stat.size > byteLimit) fail(`${label} must be between 2 and ${byteLimit} bytes`)
  return readFile(path)
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString("utf8"))
  } catch {
    fail(`${label} must contain valid JSON`)
  }
}

function assertDigest(value, label) {
  if (typeof value !== "string" || !digestPattern.test(value)) fail(`${label} must be a SHA-256 digest`)
}

function verifyScenario(value) {
  if (value?.schemaVersion !== 1 || value.kind !== "gaep-phase2-realistic-figma-loop-scenario" ||
      value.id !== "phase-2-atlas-evidence-review-design-loop-v1" ||
      value.authorityBoundary !== "realistic-phase-2-loop-is-deterministic-candidate-evidence-not-figma-or-provider-execution-product-research-external-completeness-design-validity-approval-baseline-readiness-implementation-release-deployment-or-action-authority") {
    fail("scenario identity or authority boundary differs")
  }
  const product = productSchema.parse(value.product)
  const initiative = initiativeSchema.parse(value.initiative)
  if (initiative.productId !== product.id || value.observedAt !== product.updatedAt || value.observedAt !== initiative.updatedAt) {
    fail("scenario Product and Initiative bindings differ")
  }
  if (!Array.isArray(value.loopStages) || value.loopStages.length !== 12 ||
      value.loopStages.some((stage, index) => stage.ordinal !== index + 1) ||
      new Set(value.loopStages.map((stage) => stage.id)).size !== 12) {
    fail("scenario must declare 12 exact ordered loop stages")
  }
  if (!Array.isArray(value.failureCases) || value.failureCases.length !== 3 ||
      value.failureCases.some((item) => item.expectedState !== "hold" || item.automaticRetry || item.effectApplied) ||
      new Set(value.failureCases.map((item) => item.id)).size !== 3) {
    fail("scenario must declare three fail-closed recovery cases")
  }
  if (JSON.stringify(value.limitations) !== JSON.stringify(phase2RealisticFigmaLoopLimitations)) {
    fail("scenario limitations differ from the canonical boundary")
  }
  return { scenario: value, product, initiative }
}

function candidateId(index) {
  return `22000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
}

function buildLoopCatalog(scenario) {
  const sources = phase2UxFigmaDashboardSourceIds.map((id, index) => {
    const recordId = candidateId(index)
    const candidate = {
      recordId,
      revision: 1,
      digest: canonicalDigest({ scenarioId: scenario.id, sourceId: id, recordId, revision: 1, state: "candidate-recorded" }),
    }
    return {
      ordinal: index + 1,
      id,
      title: phase2UxFigmaDashboardSourceDefinitions[id].title,
      group: phase2UxFigmaDashboardSourceDefinitions[id].group,
      projectionKind: phase2UxFigmaDashboardSourceDefinitions[id].projectionKind,
      state: "attention-required",
      candidate,
      snapshotDigest: canonicalDigest({ scenarioId: scenario.id, sourceId: id, candidate }),
    }
  })
  const content = {
    schemaVersion: 1,
    kind: "gaep-phase2-realistic-figma-loop-catalog",
    scenario: { id: scenario.id, digest: canonicalDigest(scenario) },
    stages: scenario.loopStages,
    sources,
    counts: {
      stageCount: scenario.loopStages.length,
      sourceCount: sources.length,
      attentionRequiredSourceCount: sources.length,
      writesPerformed: 0,
      importsPerformed: 0,
      implementationEffectsApplied: 0,
    },
    authorityBoundary: "loop-catalog-records-deterministic-candidates-and-zero-effects-not-live-figma-provider-approval-baseline-readiness-implementation-or-action-authority",
  }
  return { ...content, catalogDigest: canonicalDigest(content) }
}

function buildPhase2Dashboard(scenario, product, initiative, catalog) {
  const observedAt = scenario.observedAt
  const sources = catalog.sources.map((source) => ({
    id: source.id,
    title: source.title,
    group: source.group,
    projectionKind: source.projectionKind,
    availability: "attention-required",
    binding: {
      snapshotDigest: source.snapshotDigest,
      observedAt,
      assessedAt: observedAt,
      candidate: source.candidate,
    },
    assessment: {
      state: "candidate-recorded",
      reviewState: "pending-human-review",
      candidateResult: "not-assessed",
      reasonCount: 1,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      unresolvedQuestionCount: source.id === "design-drift-detection" ? scenario.metrics.unresolvedQuestionCount : 0,
      attentionRequired: true,
    },
  }))
  const metrics = scenario.metrics
  const content = phase2UxFigmaDashboardContentSchema.parse({
    schemaVersion: 1,
    kind: "phase-2-ux-figma-dashboard",
    viewDefinitionVersion: "gaep-phase-2-ux-figma-dashboard-v1",
    phase: { id: "phase-2-design", label: "Phase 2 — UX and Figma Loop" },
    product: { recordType: "product", recordId: product.id, revision: product.revision, digest: canonicalDigest(product) },
    initiative: { recordType: "initiative", recordId: initiative.id, revision: initiative.revision, digest: canonicalDigest(initiative), state: initiative.state },
    sources,
    experience: {
      personaCount: metrics.personaCount,
      designRoleCount: metrics.designRoleCount,
      journeyCount: metrics.journeyCount,
      touchpointCount: metrics.touchpointCount,
      informationArchitectureNodeCount: metrics.informationArchitectureNodeCount,
      routeCount: metrics.routeCount,
      screenCount: metrics.screenCount,
      stateCount: metrics.stateCount,
      variantCount: metrics.variantCount,
    },
    designSystem: {
      requirementCount: metrics.requirementCount,
      designSystemCount: metrics.designSystemCount,
      tokenCount: metrics.tokenCount,
      componentCount: metrics.componentCount,
      accessibilityRuleCount: metrics.accessibilityRuleCount,
      accessibilityCheckCount: metrics.accessibilityCheckCount,
      platformTargetCount: metrics.platformTargetCount,
      breakpointCount: metrics.breakpointCount,
    },
    figma: {
      fileCount: metrics.fileCount,
      componentCount: metrics.figmaComponentCount,
      variableCount: metrics.variableCount,
      designBindingCount: metrics.designBindingCount,
      humanReviewedBindingCount: metrics.humanReviewedBindingCount,
      unboundDesignItemCount: metrics.unboundDesignItemCount,
      connectionState: "not-established",
      writeExecutionState: "not-performed",
      importExecutionState: "not-performed",
    },
    governance: {
      designerReadyCandidateResult: "not-assessed",
      humanApprovalCandidateResult: "not-assessed",
      baselineCandidateResult: "not-assessed",
      baselineDesignationState: "not-established",
      driftCandidateResult: "not-assessed",
      approvalState: "not-established",
      readinessState: "not-established",
      remediationEffectState: "not-applied",
    },
    drift: {
      observationCount: metrics.driftObservationCount,
      requirementToDesignCount: metrics.requirementToDesignCount,
      designToImplementationCount: metrics.designToImplementationCount,
      conformantCount: metrics.conformantCount,
      driftCount: metrics.driftCount,
      unassessedCount: metrics.unassessedCount,
      blockerCount: metrics.blockerCount,
      highSeverityCount: metrics.highSeverityCount,
      remediationCandidateCount: metrics.remediationCandidateCount,
    },
    freshness: {
      state: "current",
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      unresolvedQuestionCount: metrics.unresolvedQuestionCount,
      oldestSourceObservedAt: observedAt,
      newestSourceObservedAt: observedAt,
    },
    phaseStatus: {
      state: "attention-required",
      expectedSourceCount: 23,
      currentSourceCount: 0,
      attentionRequiredSourceCount: 23,
      unavailableSourceCount: 0,
      sourceCatalogDigest: canonicalDigest(sources),
      productOwnerAcceptance: "not-established",
      readinessAuthority: "not-established",
      phaseEntryAuthority: "not-established",
    },
    evidenceCues: {
      freshness: "current",
      confidence: { state: "not-assessed", basis: "no-governed-confidence-evaluation-is-bound" },
    },
    observedAt,
    sourceBoundary: "current-governed-product-initiative-and-phase-2-projections-only",
    privacyBoundary: "dashboard-exposes-identities-counts-statuses-times-and-digests-not-design-requirement-figma-source-human-or-personal-content-secrets-credentials-or-permissions",
    limitations: [
      "All 23 sources are deterministic candidate projections that still require accountable human review.",
      "The returned-snapshot candidate is fixture evidence and not returned current Figma content.",
      "No connection, write, import, approval, baseline, readiness, remediation, implementation, or action effect is established.",
    ],
    authorityBoundary: "phase-2-dashboard-is-a-derived-read-only-view-not-a-second-source-of-truth-or-completeness-validity-approval-baseline-readiness-remediation-figma-implementation-or-action-authority",
  })
  return phase2UxFigmaDashboardSchema.parse({ ...content, snapshotDigest: canonicalDigest(content) })
}

function buildAgentModelDashboard(scenario, product) {
  const capabilityDigest = canonicalDigest({ scenarioId: scenario.id, adapterId: "gaep.codex-cli", mode: "fixture-only" })
  const content = agentModelDashboardContentSchema.parse({
    schemaVersion: 1,
    kind: "agent-model-dashboard",
    product: { recordType: "product", recordId: product.id, revision: product.revision, digest: canonicalDigest(product) },
    capabilities: [{
      adapterId: "gaep.codex-cli",
      adapterVersion: "1.0.0",
      agentId: "codex-cli",
      agentLabel: "Codex CLI",
      runtimeVersion: null,
      capabilityDigest,
      detected: true,
      executionInterface: "cli-jsonl",
      interfaceMaturity: "stable",
      support: { resume: true, cancel: true, checkpoints: true, modelDiscovery: false, toolSelection: true },
      modelCount: 0,
      limitations: { values: ["No provider execution occurs in the realistic Phase 2 fixture."], shown: 1, total: 1, omitted: 0 },
      observedAt: scenario.observedAt,
      selected: false,
    }],
    selection: { status: "unselected" },
    runs: [],
    handoffs: [],
    providerMetrics: {
      usage: { state: "unavailable", basis: "current-managed-records-have-no-provider-usage-or-cost-contract" },
      cost: { state: "unavailable", basis: "current-managed-records-have-no-provider-usage-or-cost-contract" },
    },
    freshness: {
      state: "current",
      selectionCapabilityState: "unselected",
      oldestCapabilityObservedAt: scenario.observedAt,
      newestCapabilityObservedAt: scenario.observedAt,
      truncated: false,
      coverageBoundary: "bounded-current-records-do-not-prove-provider-account-or-native-host-readiness",
    },
    evidenceCues: { freshness: "current", confidence: { state: "not-assessed", basis: "no-governed-confidence-evaluation-is-bound" } },
    limits: {
      capabilities: { shown: 1, total: 1, omitted: 0 },
      runs: { shown: 0, total: 0, omitted: 0 },
      handoffs: { shown: 0, total: 0, omitted: 0 },
      managedRuns: { shown: 0, total: 0, omitted: 0 },
      truncated: false,
    },
    observedAt: scenario.observedAt,
    sourceBoundary: "current-governed-agent-selection-run-handoff-and-managed-evidence-metadata",
    limitations: ["The deterministic example records capability metadata only and does not select a model or launch a Run."],
    authorityBoundary: "agent-model-dashboard-does-not-select-switch-handoff-launch-or-authorize-effects",
  })
  return agentModelDashboardSchema.parse({ ...content, snapshotDigest: canonicalDigest(content) })
}

function buildIntegratedDashboard(scenario, product, initiative, phase2) {
  const agentModel = buildAgentModelDashboard(scenario, product)
  return composePhase2ChangeImpactAgentModelDashboard(product, initiative, phase2, agentModel, {
    expectedProductId: product.id,
    expectedProductRevision: product.revision,
    expectedProductDigest: canonicalDigest(product),
    expectedInitiativeId: initiative.id,
    expectedInitiativeRevision: initiative.revision,
    expectedInitiativeDigest: canonicalDigest(initiative),
    agentModel: {
      expectedProductId: product.id,
      expectedProductRevision: product.revision,
      expectedProductDigest: canonicalDigest(product),
      expectedSelection: { status: "unselected" },
      expectedCapabilities: [{
        adapterId: "gaep.codex-cli",
        agentId: "codex-cli",
        capabilityDigest: agentModel.capabilities[0].capabilityDigest,
      }],
    },
  }, "2026-07-30T05:21:00.000Z")
}

function buildFailureRecovery(scenario) {
  const cases = scenario.failureCases.map((item) => ({ ...item, caseDigest: canonicalDigest(item) }))
  const content = {
    schemaVersion: 1,
    kind: "gaep-phase2-realistic-figma-loop-failure-recovery",
    scenario: { id: scenario.id, digest: canonicalDigest(scenario) },
    cases,
    summary: {
      caseCount: cases.length,
      holdCount: cases.length,
      automaticRetryCount: 0,
      appliedEffectCount: 0,
    },
    authorityBoundary: "failure-recovery-catalog-records-holds-and-unapplied-recovery-candidates-not-retry-write-import-approval-baseline-remediation-or-action-authority",
  }
  return { ...content, recoveryDigest: canonicalDigest(content) }
}

function buildHostProjections(bytes, report) {
  if (report?.kind !== "gaep-phase-0-ide-conformance-report-v1" || report.verificationResult !== "pass" ||
      report.summary?.hosts !== 4 || report.summary?.capabilities !== 76 || report.summary?.assessments !== 304 ||
      report.summary?.implemented !== 304 || report.summary?.acceptedHosts !== 0) {
    fail("copied Phase 2 conformance evidence differs from the exact 76-capability boundary")
  }
  const hosts = report.hosts.map((host) => {
    const capability = host.capabilities.find((item) => item.capabilityId === "phase2-change-impact-agent-model-dashboard")
    if (capability?.state !== "implemented" || host.acceptance !== "incomplete") {
      fail(`${host.id} does not preserve the integrated dashboard capability and incomplete acceptance boundary`)
    }
    return {
      id: host.id,
      displayName: host.displayName,
      capabilityState: capability.state,
      sourceProbesVerified: capability.sourceProbesVerified,
      packageStatus: host.package.status,
      runtimeEvidenceLevel: host.runtimeEvidence.level,
      runtimeSourceSnapshotDigest: host.runtimeEvidence.sourceSnapshotDigest,
      acceptance: "incomplete",
    }
  })
  const content = {
    schemaVersion: 1,
    kind: "gaep-phase2-realistic-figma-loop-host-projections",
    source: {
      path: "sources/phase2-conformance.json",
      bytes: bytes.length,
      digest: rawDigest(bytes),
      recordedAt: report.recordedAt,
    },
    hosts,
    summary: {
      hostCount: hosts.length,
      implementedProjectionCount: hosts.length,
      acceptedHostCount: 0,
      producedPackageCount: report.summary.producedPackages,
    },
    authorityBoundary: "host-projection-binding-proves-bounded-local-capability-evidence-not-native-host-supported-platform-product-owner-readiness-release-or-deployment-acceptance",
  }
  return { ...content, hostProjectionDigest: canonicalDigest(content) }
}

async function writeExclusive(path, value) {
  const content = typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`
  let handle
  try {
    handle = await open(path, "wx", 0o600)
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error(`${path} already exists; refusing to overwrite it`)
    }
    throw error
  }
  try {
    await handle.writeFile(content, "utf8")
    await handle.sync()
  } finally {
    await handle.close()
  }
}

function fileBinding(path, bytes, semanticDigest) {
  return { path, bytes: bytes.length, digest: rawDigest(bytes), semanticDigest }
}

async function readArtifactInputs(target) {
  const scenarioSourceBytes = await readRegularFile(scenarioSourcePath, "canonical scenario source", receiptByteLimit)
  const scenarioBytes = await readRegularFile(resolve(target, "scenario.json"), "scenario.json", receiptByteLimit)
  if (rawDigest(scenarioBytes) !== rawDigest(scenarioSourceBytes)) {
    fail("scenario.json differs from the canonical repository scenario")
  }
  const { scenario, product, initiative } = verifyScenario(parseJson(scenarioBytes, "scenario.json"))
  const sourcePaths = {
    phase1: resolve(target, "sources/phase1-reference-receipt.json"),
    conformance: resolve(target, "sources/phase2-conformance.json"),
    report: resolve(target, "sources/phase2-report.json"),
  }
  const [phase1Bytes, conformanceBytes, reportBytes] = await Promise.all([
    readRegularFile(sourcePaths.phase1, "sources/phase1-reference-receipt.json", receiptByteLimit),
    readRegularFile(sourcePaths.conformance, "sources/phase2-conformance.json"),
    readRegularFile(sourcePaths.report, "sources/phase2-report.json", receiptByteLimit),
  ])
  const phase1 = parseJson(phase1Bytes, "sources/phase1-reference-receipt.json")
  const conformance = parseJson(conformanceBytes, "sources/phase2-conformance.json")
  const report = parseJson(reportBytes, "sources/phase2-report.json")
  if (phase1.kind !== "gaep-phase1-realistic-reference-receipt" ||
      phase1.authority?.productOwnerAcceptance !== "not-established" ||
      phase1.authority?.readinessAuthority !== "not-established") {
    fail("copied Phase 1 reference receipt does not preserve its no-authority boundary")
  }
  if (report.kind !== "gaep-phase-acceptance-report-v1" ||
      report.evidenceScope !== "phase-2-change-impact-agent-model-dashboard-local" ||
      report.verificationResult !== "pass" || report.phaseGate !== "incomplete" ||
      report.summary?.validationGatesPassed !== 7 || report.summary?.hostsAccepted !== 0) {
    fail("copied P2-25 report differs from the exact passing-local incomplete-gate boundary")
  }
  return {
    scenarioSourceBytes,
    scenarioBytes,
    scenario,
    product,
    initiative,
    sourceFiles: {
      phase1: { bytes: phase1Bytes, value: phase1 },
      conformance: { bytes: conformanceBytes, value: conformance },
      report: { bytes: reportBytes, value: report },
    },
  }
}

async function expectedOutputs(target, inputs) {
  const loopCatalog = buildLoopCatalog(inputs.scenario)
  const phase2Dashboard = buildPhase2Dashboard(inputs.scenario, inputs.product, inputs.initiative, loopCatalog)
  const integratedDashboard = buildIntegratedDashboard(inputs.scenario, inputs.product, inputs.initiative, phase2Dashboard)
  const failureRecovery = buildFailureRecovery(inputs.scenario)
  const hostProjections = buildHostProjections(inputs.sourceFiles.conformance.bytes, inputs.sourceFiles.conformance.value)
  const definitions = [
    ["loop-catalog.json", loopCatalog, loopCatalog.catalogDigest],
    ["dashboards/phase2-ux-figma.json", phase2Dashboard, phase2Dashboard.snapshotDigest],
    ["dashboards/change-impact-agent-model.json", integratedDashboard, integratedDashboard.snapshotDigest],
    ["failure-recovery.json", failureRecovery, failureRecovery.recoveryDigest],
    ["host-projections.json", hostProjections, hostProjections.hostProjectionDigest],
  ]
  const outputFiles = {}
  for (const [path, expected, semanticDigest] of definitions) {
    const bytes = await readRegularFile(resolve(target, path), path)
    const actual = parseJson(bytes, path)
    try {
      assert.deepEqual(actual, expected)
    } catch {
      fail(`${path} differs from the exact scenario and source evidence`)
    }
    assertDigest(semanticDigest, `${path} semantic digest`)
    outputFiles[path] = { bytes, value: actual, semanticDigest }
  }
  return { loopCatalog, phase2Dashboard, integratedDashboard, failureRecovery, hostProjections, outputFiles }
}

export async function derivePhase2RealisticFigmaLoopReceipt(artifactDirectory) {
  const target = resolve(artifactDirectory)
  const inputs = await readArtifactInputs(target)
  const outputs = await expectedOutputs(target, inputs)
  const sources = [
    fileBinding("sources/phase1-reference-receipt.json", inputs.sourceFiles.phase1.bytes, inputs.sourceFiles.phase1.value.compositionDigest),
    fileBinding("sources/phase2-conformance.json", inputs.sourceFiles.conformance.bytes, canonicalDigest(inputs.sourceFiles.conformance.value)),
    fileBinding("sources/phase2-report.json", inputs.sourceFiles.report.bytes, inputs.sourceFiles.report.value.testsDigest),
  ]
  const outputBindings = Object.fromEntries(Object.entries(outputs.outputFiles).map(([path, item]) => [
    path,
    fileBinding(path, item.bytes, item.semanticDigest),
  ]))
  const summary = {
    loopStageCount: outputs.loopCatalog.counts.stageCount,
    governedSourceCount: outputs.loopCatalog.counts.sourceCount,
    dashboardCount: 2,
    hostProjectionCount: outputs.hostProjections.summary.hostCount,
    failureRecoveryCaseCount: outputs.failureRecovery.summary.caseCount,
    writesPerformed: 0,
    importsPerformed: 0,
    implementationEffectsApplied: 0,
    approvalsEstablished: 0,
    baselinesDesignated: 0,
    hostsAccepted: 0,
    providersAccepted: 0,
    productOwnerAcceptance: "not-established",
    readinessAuthority: "not-established",
  }
  const content = {
    schemaVersion: 1,
    kind: "gaep-phase2-realistic-figma-loop-receipt",
    scenario: {
      id: inputs.scenario.id,
      path: "scenario.json",
      sourcePath: "examples/phase-2-realistic-figma-loop/scenario.json",
      sourceDigest: rawDigest(inputs.scenarioSourceBytes),
      semanticDigest: canonicalDigest(inputs.scenario),
      product: { id: inputs.product.id, revision: inputs.product.revision, digest: canonicalDigest(inputs.product) },
      initiative: { id: inputs.initiative.id, revision: inputs.initiative.revision, digest: canonicalDigest(inputs.initiative) },
    },
    sources,
    outputs: outputBindings,
    summary,
    summaryDigest: canonicalDigest(summary),
    authority: {
      figmaConnection: "not-established",
      providerConnection: "not-established",
      writeAuthority: "not-granted",
      importAuthority: "not-granted",
      approval: "not-established",
      baselineDesignation: "not-established",
      readinessAuthority: "not-established",
      productOwnerAcceptance: "not-established",
      nativeHostAcceptance: "not-established",
      securityScan: "skipped-by-product-owner",
      releaseAuthority: "not-granted",
      deploymentAuthority: "not-granted",
      boundary: "realistic-phase-2-loop-receipt-is-local-candidate-evidence-not-live-execution-product-research-completeness-validity-approval-baseline-readiness-security-release-deployment-or-action-authority",
    },
    limitations: phase2RealisticFigmaLoopLimitations,
  }
  return { ...content, compositionDigest: canonicalDigest(content) }
}

async function inventoryArtifacts(target) {
  const entries = []
  let byteCount = 0
  async function walk(directory, segments) {
    for (const name of (await readdir(directory)).sort()) {
      if (segments.length === 0 && name === "artifact-manifest.json") continue
      const path = resolve(directory, name)
      const stat = await lstat(path)
      const relativePath = [...segments, name].join("/")
      if (stat.isSymbolicLink()) fail(`${relativePath} must not be a symbolic link`)
      if (stat.isDirectory()) {
        await walk(path, [...segments, name])
        continue
      }
      if (!stat.isFile()) fail(`${relativePath} must be a regular file`)
      if (stat.size < 2 || stat.size > fileByteLimit) fail(`${relativePath} exceeds its file-size boundary`)
      if (entries.length >= artifactFileLimit) fail(`artifact exceeds ${artifactFileLimit} files`)
      byteCount += stat.size
      if (byteCount > artifactByteLimit) fail(`artifact exceeds ${artifactByteLimit} bytes`)
      const bytes = await readFile(path)
      entries.push({ path: relativePath, bytes: stat.size, digest: rawDigest(bytes) })
    }
  }
  await walk(target, [])
  return { fileCount: entries.length, byteCount, entries, inventoryDigest: canonicalDigest(entries) }
}

export async function createPhase2RealisticFigmaLoopManifest(artifactDirectory) {
  const target = resolve(artifactDirectory)
  await assertRegularDirectory(target, "artifact directory")
  const entries = (await readdir(target)).sort()
  const withoutManifest = expectedTopLevelEntries.filter((name) => name !== "artifact-manifest.json").sort()
  if (JSON.stringify(entries) !== JSON.stringify(withoutManifest) &&
      JSON.stringify(entries) !== JSON.stringify([...expectedTopLevelEntries].sort())) {
    fail(`artifact directory entries differ; received ${entries.join(", ")}`)
  }
  await assertExactDirectoryEntries(resolve(target, "dashboards"), expectedDashboardEntries, "dashboards")
  await assertExactDirectoryEntries(resolve(target, "sources"), expectedSourceEntries, "sources")
  const receipt = await derivePhase2RealisticFigmaLoopReceipt(target)
  const receiptBytes = await readRegularFile(resolve(target, "receipt.json"), "receipt.json", receiptByteLimit)
  const inventory = await inventoryArtifacts(target)
  return {
    schemaVersion: 1,
    kind: "gaep-phase2-realistic-figma-loop-artifact-manifest",
    scenario: receipt.scenario,
    receipt: {
      path: "receipt.json",
      bytes: receiptBytes.length,
      digest: rawDigest(receiptBytes),
      compositionDigest: receipt.compositionDigest,
    },
    inventory,
    authorityBoundary: "artifact-manifest-is-integrity-evidence-not-live-figma-provider-product-research-approval-baseline-readiness-security-release-or-deployment-authority",
  }
}

export async function verifyPhase2RealisticFigmaLoopArtifactDirectory(artifactDirectory) {
  const target = resolve(artifactDirectory)
  await assertRegularDirectory(target, "artifact directory")
  await assertExactDirectoryEntries(target, expectedTopLevelEntries, "artifact directory")
  await assertExactDirectoryEntries(resolve(target, "dashboards"), expectedDashboardEntries, "dashboards")
  await assertExactDirectoryEntries(resolve(target, "sources"), expectedSourceEntries, "sources")
  const receiptBytes = await readRegularFile(resolve(target, "receipt.json"), "receipt.json", receiptByteLimit)
  const receipt = parseJson(receiptBytes, "receipt.json")
  const expectedReceipt = await derivePhase2RealisticFigmaLoopReceipt(target)
  try {
    assert.deepEqual(receipt, expectedReceipt)
  } catch {
    fail("receipt.json differs from the exact scenario, sources, dashboards, recovery, and host projections")
  }
  assertDigest(receipt.compositionDigest, "receipt.json compositionDigest")
  const manifestBytes = await readRegularFile(resolve(target, "artifact-manifest.json"), "artifact-manifest.json")
  const manifest = parseJson(manifestBytes, "artifact-manifest.json")
  const expectedManifest = await createPhase2RealisticFigmaLoopManifest(target)
  try {
    assert.deepEqual(manifest, expectedManifest)
  } catch {
    fail("artifact-manifest.json differs from the exact artifact inventory")
  }
  return { receipt, manifest }
}

export async function runPhase2RealisticFigmaLoopArtifacts(path) {
  const target = resolve(path)
  const parent = dirname(target)
  const parentStat = await lstat(parent)
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
    throw new Error("Artifact parent must be a regular directory")
  }
  try {
    await lstat(target)
    throw new Error("Artifact directory already exists; refusing to reuse or overwrite it")
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
  }
  const staging = await mkdtemp(join(parent, ".gaep-phase2-figma-loop-"))
  try {
    await mkdir(resolve(staging, "dashboards"), { mode: 0o700 })
    await mkdir(resolve(staging, "sources"), { mode: 0o700 })
    await copyFile(scenarioSourcePath, resolve(staging, "scenario.json"))
    const scenario = verifyScenario(JSON.parse(await readFile(scenarioSourcePath, "utf8"))).scenario
    await Promise.all([
      copyFile(resolve(repository, scenario.sourcePaths.phase1ReferenceReceipt), resolve(staging, "sources/phase1-reference-receipt.json")),
      copyFile(resolve(repository, scenario.sourcePaths.phase2Conformance), resolve(staging, "sources/phase2-conformance.json")),
      copyFile(resolve(repository, scenario.sourcePaths.phase2Report), resolve(staging, "sources/phase2-report.json")),
    ])
    const inputs = await readArtifactInputs(staging)
    const loopCatalog = buildLoopCatalog(inputs.scenario)
    const phase2Dashboard = buildPhase2Dashboard(inputs.scenario, inputs.product, inputs.initiative, loopCatalog)
    const integratedDashboard = buildIntegratedDashboard(inputs.scenario, inputs.product, inputs.initiative, phase2Dashboard)
    const failureRecovery = buildFailureRecovery(inputs.scenario)
    const hostProjections = buildHostProjections(inputs.sourceFiles.conformance.bytes, inputs.sourceFiles.conformance.value)
    await writeExclusive(resolve(staging, "loop-catalog.json"), loopCatalog)
    await writeExclusive(resolve(staging, "dashboards/phase2-ux-figma.json"), phase2Dashboard)
    await writeExclusive(resolve(staging, "dashboards/change-impact-agent-model.json"), integratedDashboard)
    await writeExclusive(resolve(staging, "failure-recovery.json"), failureRecovery)
    await writeExclusive(resolve(staging, "host-projections.json"), hostProjections)
    const receipt = await derivePhase2RealisticFigmaLoopReceipt(staging)
    await writeExclusive(resolve(staging, "receipt.json"), receipt)
    const manifest = await createPhase2RealisticFigmaLoopManifest(staging)
    await writeExclusive(resolve(staging, "artifact-manifest.json"), manifest)
    await verifyPhase2RealisticFigmaLoopArtifactDirectory(staging)
    await rename(staging, target)
    return verifyPhase2RealisticFigmaLoopArtifactDirectory(target)
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    throw error
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 2 && args[0] === "--artifacts") {
    const { receipt, manifest } = await runPhase2RealisticFigmaLoopArtifacts(args[1])
    process.stdout.write(`${JSON.stringify({
      artifactDirectory: resolve(args[1]),
      scenarioId: receipt.scenario.id,
      loopStageCount: receipt.summary.loopStageCount,
      hostProjectionCount: receipt.summary.hostProjectionCount,
      failureRecoveryCaseCount: receipt.summary.failureRecoveryCaseCount,
      artifactFileCount: manifest.inventory.fileCount,
      compositionDigest: receipt.compositionDigest,
    }, null, 2)}\n`)
    return
  }
  if (args.length === 1) {
    const { receipt, manifest } = await verifyPhase2RealisticFigmaLoopArtifactDirectory(args[0])
    process.stdout.write(`${JSON.stringify({
      valid: true,
      kind: receipt.kind,
      scenarioId: receipt.scenario.id,
      loopStageCount: receipt.summary.loopStageCount,
      hostProjectionCount: receipt.summary.hostProjectionCount,
      artifactFileCount: manifest.inventory.fileCount,
      compositionDigest: receipt.compositionDigest,
    }, null, 2)}\n`)
    return
  }
  throw new Error("Usage: node scripts/phase2_realistic_figma_loop_artifacts.mjs [--artifacts] <artifact-directory>")
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
