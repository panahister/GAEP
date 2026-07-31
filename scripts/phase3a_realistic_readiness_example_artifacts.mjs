import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { copyFile, lstat, mkdir, mkdtemp, open, readFile, readdir, rename, rm } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  phase3aDashboardContentSchema,
  phase3aDashboardSchema,
  phase3aDashboardSourceDefinitions,
  phase3aDashboardSourceIds,
  phase3aDashboardViewDefinitions,
  phase3aDashboardViewIds,
} from "@gaep/contracts"

const repository = fileURLToPath(new URL("..", import.meta.url))
const scenarioSourcePath = resolve(repository, "examples/phase-3a-realistic-readiness-example/scenario.json")
const fileByteLimit = 4 * 1024 * 1024
const artifactByteLimit = 32 * 1024 * 1024
const artifactFileLimit = 96
const digestPattern = /^sha256:[0-9a-f]{64}$/u
const expectedTopLevelEntries = [
  "artifact-manifest.json",
  "dashboard.json",
  "failure-recovery.json",
  "host-projections.json",
  "readiness-catalog.json",
  "receipt.json",
  "reopen-continuity.json",
  "scenario.json",
  "sources",
]
const expectedSourceEntries = [
  "claude-receipt.json",
  "codex-candidate-chain.json",
  "codex-receipt.json",
  "phase3a-conformance.json",
  "phase3a-report.json",
]

export const phase3aRealisticReadinessExampleLimitations = [
  "This is a deterministic local realistic fixture, not a real Product, repository, source, design, test, risk, security, or production dataset.",
  "The 20 source candidates and 81 evidence-reference metadata entries demonstrate structural continuity only; truth, completeness, quality, priority, readiness, waiver, and ownership remain accountable human decisions.",
  "Codex and Claude bindings reference sealed offline deterministic workflows; no live request, authentication, semantic-quality assessment, source-code write, or implementation effect occurs.",
  "Candidate-complete-for-human-review is not implementation authorization, Product Owner acceptance, native-host acceptance, security completion, release authorization, or deployment approval.",
  "Reopen, failure recovery, Product Studio, and four-host projections prove bounded deterministic evidence behavior only.",
]

function fail(message) {
  throw new Error(`Invalid Phase 3A realistic readiness example artifact: ${message}`)
}

function rawDigest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

function assertDigest(value, label) {
  if (typeof value !== "string" || !digestPattern.test(value)) fail(`${label} must be a SHA-256 digest`)
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

async function writeExclusive(path, value) {
  const content = `${JSON.stringify(value, null, 2)}\n`
  let handle
  try {
    handle = await open(path, "wx", 0o600)
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error("Artifact output already exists; refusing to overwrite it")
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

function verifyScenario(value) {
  if (value?.schemaVersion !== 1 || value.kind !== "gaep-phase3a-realistic-readiness-scenario" ||
      value.id !== "phase-3a-atlas-realistic-readiness-example-v1" ||
      value.authorityBoundary !== "phase-3a-realistic-readiness-example-is-deterministic-candidate-evidence-not-real-product-source-completeness-priority-readiness-waiver-ownership-implementation-live-provider-native-host-product-owner-security-release-deployment-or-action-authority") {
    fail("scenario identity or authority boundary differs")
  }
  if (value.product?.id !== "33000000-0000-4000-8000-000000000001" || value.product?.revision !== 1 ||
      value.initiative?.id !== "33000000-0000-4000-8000-000000000002" || value.initiative?.revision !== 1 ||
      value.initiative?.productId !== value.product.id || value.initiative?.state !== "active") {
    fail("scenario Product and Initiative bindings differ")
  }
  if (!Array.isArray(value.caseStudy?.implementationUnits) || value.caseStudy.implementationUnits.length !== 3 ||
      value.caseStudy?.counts?.implementationUnitCount !== 3 || value.caseStudy?.counts?.requirementCount !== 8 ||
      value.caseStudy?.counts?.acceptanceCriterionCount !== 12 || value.caseStudy?.counts?.testInventoryCount !== 18 ||
      value.caseStudy?.candidateDisposition !== "complete-for-accountable-human-readiness-review") {
    fail("scenario case-study scope differs")
  }
  if (!Array.isArray(value.sourceFacts) || value.sourceFacts.length !== phase3aDashboardSourceIds.length ||
      value.sourceFacts.some((item, index) => item.id !== phase3aDashboardSourceIds[index] ||
        !Number.isInteger(item.evidenceReferenceCount) || item.evidenceReferenceCount < 1 || item.evidenceReferenceCount > 20) ||
      value.sourceFacts.reduce((sum, item) => sum + item.evidenceReferenceCount, 0) !== 81) {
    fail("scenario must declare the exact 20-source, 81-evidence candidate catalog")
  }
  if (!Array.isArray(value.failureCases) || value.failureCases.length !== 3 ||
      value.failureCases.some((item) => item.expectedState !== "hold") ||
      new Set(value.failureCases.map((item) => item.injectedState)).size !== 3) {
    fail("scenario must declare three distinct fail-closed recovery cases")
  }
  if (JSON.stringify(value.limitations) !== JSON.stringify(phase3aRealisticReadinessExampleLimitations)) {
    fail("scenario limitations differ")
  }
  return value
}

function verifyWorkflowReceipt(value, provider) {
  const expectedKind = `gaep-phase3a-${provider}-readiness-workflow-receipt`
  if (value?.kind !== expectedKind || value.summary?.stageCount !== 20 ||
      value.summary?.exactCurrentCandidateCount !== 20 || value.summary?.failureRecoveryCaseCount !== 3 ||
      value.summary?.hostProjectionCount !== 4 || value.summary?.liveProviderRequestCount !== 0 ||
      value.summary?.implementationEffectsApplied !== 0 || value.summary?.hostsAccepted !== 0 ||
      value.summary?.providersAccepted !== 0 || value.summary?.productOwnerAcceptance !== "not-established" ||
      value.summary?.readinessAuthority !== "not-established") {
    fail(`${provider} workflow receipt differs from the sealed deterministic boundary`)
  }
  assertDigest(value.compositionDigest, `${provider} workflow composition`)
  assertDigest(value.scenario?.product?.digest, `${provider} Product binding`)
  assertDigest(value.scenario?.initiative?.digest, `${provider} Initiative binding`)
  return value
}

function verifyCandidateChain(value) {
  if (value?.kind !== "gaep-phase3a-codex-readiness-candidate-chain" || value.summary?.stageCount !== 20 ||
      value.summary?.exactCurrentCandidateCount !== 20 || value.summary?.missingStageCount !== 0 ||
      value.summary?.staleBindingCount !== 0 || value.summary?.writesApplied !== 0 ||
      !Array.isArray(value.stages) || value.stages.length !== 20 ||
      value.stages.some((stage, index) => stage.id !== `P3A-${String(index + 1).padStart(2, "0")}`)) {
    fail("Codex candidate chain differs from the exact 20-stage boundary")
  }
  assertDigest(value.chainDigest, "Codex candidate chain")
  return value
}

function buildReadinessCatalog(scenario, candidateChain) {
  const sources = phase3aDashboardSourceIds.map((id, index) => {
    const definition = phase3aDashboardSourceDefinitions[id]
    const stage = candidateChain.stages[index]
    const fact = scenario.sourceFacts[index]
    const content = {
      ordinal: index + 1,
      id,
      title: definition.title,
      group: definition.group,
      projectionKind: definition.projectionKind,
      stageId: stage.id,
      candidate: stage.candidate,
      observedAt: scenario.observedAt,
      assessment: {
        state: "candidate-evidence-complete",
        reviewState: "ready-for-human-review",
        reasonCount: 0,
        candidateCount: 1,
        evidenceReferenceCount: fact.evidenceReferenceCount,
        gapCount: 0,
        conflictCount: 0,
        staleCount: 0,
        unresolvedCount: 0,
        attentionRequired: false,
      },
    }
    return { ...content, snapshotDigest: canonicalDigest(content) }
  })
  const content = {
    schemaVersion: 1,
    kind: "gaep-phase3a-realistic-readiness-catalog",
    scenario: { id: scenario.id, digest: canonicalDigest(scenario) },
    product: { id: scenario.product.id, revision: scenario.product.revision, digest: canonicalDigest(scenario.product) },
    initiative: { id: scenario.initiative.id, revision: scenario.initiative.revision, digest: canonicalDigest(scenario.initiative) },
    caseStudy: scenario.caseStudy,
    sources,
    summary: {
      sourceCount: sources.length,
      exactCurrentCandidateCount: sources.length,
      evidenceReferenceCount: sources.reduce((sum, source) => sum + source.assessment.evidenceReferenceCount, 0),
      gapCount: 0,
      conflictCount: 0,
      staleCount: 0,
      unresolvedCount: 0,
      writesApplied: 0,
      implementationEffectsApplied: 0,
    },
    authorityBoundary: "readiness-catalog-is-candidate-structural-evidence-for-human-review-not-source-truth-completeness-priority-readiness-waiver-ownership-implementation-or-action-authority",
  }
  return { ...content, catalogDigest: canonicalDigest(content) }
}

function workflowBinding(scenario, provider, receipt, bytes) {
  return {
    provider,
    availability: "sealed-local-deterministic",
    binding: {
      product: { recordId: receipt.scenario.product.id, revision: receipt.scenario.product.revision, digest: receipt.scenario.product.digest },
      initiative: { recordId: receipt.scenario.initiative.id, revision: receipt.scenario.initiative.revision, digest: receipt.scenario.initiative.digest },
      scenarioId: receipt.scenario.id,
      receiptDigest: receipt.compositionDigest,
      sourceDigest: rawDigest(bytes),
      observedAt: scenario.observedAt,
    },
    executionMode: "offline-deterministic",
    liveAcceptance: "not-established",
    semanticQuality: "not-assessed",
    authority: "not-granted",
  }
}

function buildDashboard(scenario, catalog, codex, claude) {
  const sources = catalog.sources.map((source) => ({
    id: source.id,
    title: source.title,
    group: source.group,
    projectionKind: source.projectionKind,
    availability: "current",
    binding: { snapshotDigest: source.snapshotDigest, observedAt: source.observedAt, candidate: source.candidate },
    assessment: source.assessment,
  }))
  const workflows = [
    workflowBinding(scenario, "codex", codex.value, codex.bytes),
    workflowBinding(scenario, "claude", claude.value, claude.bytes),
  ]
  for (const workflow of workflows) {
    if (workflow.binding.product.recordId !== scenario.product.id || workflow.binding.product.revision !== scenario.product.revision ||
        workflow.binding.product.digest !== canonicalDigest(scenario.product) ||
        workflow.binding.initiative.recordId !== scenario.initiative.id || workflow.binding.initiative.revision !== scenario.initiative.revision ||
        workflow.binding.initiative.digest !== canonicalDigest(scenario.initiative)) {
      fail(`${workflow.provider} workflow does not bind the exact realistic Product and Initiative`)
    }
  }
  const views = phase3aDashboardViewIds.map((id) => {
    const definition = phase3aDashboardViewDefinitions[id]
    const entries = definition.sourceIds.map((sourceId) => sources[phase3aDashboardSourceIds.indexOf(sourceId)])
    const total = (key) => entries.reduce((sum, source) => sum + source.assessment[key], 0)
    return {
      id,
      title: definition.title,
      sourceIds: [...definition.sourceIds],
      state: "current",
      currentSourceCount: entries.length,
      attentionRequiredSourceCount: 0,
      unavailableSourceCount: 0,
      candidateCount: total("candidateCount"),
      evidenceReferenceCount: total("evidenceReferenceCount"),
      gapCount: 0,
      conflictCount: 0,
      staleCount: 0,
      unresolvedCount: 0,
      workflowEvidenceCount: id === "agent-model" ? 2 : 0,
    }
  })
  const content = phase3aDashboardContentSchema.parse({
    schemaVersion: 1,
    kind: "phase-3a-dashboard",
    viewDefinitionVersion: "gaep-phase-3a-dashboard-v1",
    phase: { id: "phase-3a-readiness", label: "Phase 3A — Backlog and Implementation Readiness" },
    product: { recordType: "product", recordId: scenario.product.id, revision: scenario.product.revision, digest: canonicalDigest(scenario.product) },
    initiative: { recordType: "initiative", recordId: scenario.initiative.id, revision: scenario.initiative.revision, digest: canonicalDigest(scenario.initiative), state: scenario.initiative.state },
    sources,
    views,
    workflows,
    freshness: { state: "current", staleCount: 0, unresolvedCount: 0, oldestSourceObservedAt: scenario.observedAt, newestSourceObservedAt: scenario.observedAt },
    phaseStatus: {
      state: "candidate-complete-for-human-review",
      expectedSourceCount: 20,
      currentSourceCount: 20,
      attentionRequiredSourceCount: 0,
      unavailableSourceCount: 0,
      sourceCatalogDigest: canonicalDigest(sources),
      providerWorkflowEvidenceCount: 2,
      liveProviderAcceptanceCount: 0,
      nativeHostAcceptanceCount: 0,
      readinessAuthority: "not-established",
      waiverAuthority: "not-established",
      ownershipAuthority: "not-established",
      productOwnerAcceptance: "not-established",
    },
    pagination: { offset: 0, limit: 20, total: 20, truncated: false },
    export: { format: "csv-visible-metadata-only", formulaPrefixesNeutralized: true, hiddenContentExcluded: true },
    evidenceCues: { freshness: "current", confidence: { state: "not-assessed", basis: "no-governed-confidence-or-semantic-quality-evaluation-is-bound" } },
    observedAt: scenario.observedAt,
    sourceBoundary: "current-governed-product-initiative-p3a-projections-and-explicit-sealed-local-workflow-evidence-only",
    privacyBoundary: "dashboard-exposes-identities-counts-states-times-and-digests-not-product-design-source-code-provider-output-personal-content-secrets-credentials-permissions-or-private-paths",
    limitations: phase3aRealisticReadinessExampleLimitations,
    authorityBoundary: "phase-3a-dashboard-is-a-derived-read-only-view-not-completeness-priority-readiness-waiver-ownership-implementation-acceptance-release-deployment-or-action-authority",
  })
  return phase3aDashboardSchema.parse({ ...content, snapshotDigest: canonicalDigest(content) })
}

function buildReopenContinuity(scenario, catalog, dashboard) {
  const snapshot = {
    scenarioId: scenario.id,
    product: dashboard.product,
    initiative: dashboard.initiative,
    sourceCatalogDigest: catalog.catalogDigest,
    dashboardSnapshotDigest: dashboard.snapshotDigest,
    sourceReferences: catalog.sources.map((source) => ({ id: source.id, candidate: source.candidate, snapshotDigest: source.snapshotDigest })),
  }
  const content = {
    schemaVersion: 1,
    kind: "gaep-phase3a-realistic-readiness-reopen-continuity",
    scenario: { id: scenario.id, digest: canonicalDigest(scenario) },
    observations: [
      { ordinal: 1, event: "realistic-readiness-artifact-closed", snapshot, snapshotDigest: canonicalDigest(snapshot) },
      { ordinal: 2, event: "realistic-readiness-artifact-reopened-and-reverified", snapshot, snapshotDigest: canonicalDigest(snapshot) },
    ],
    summary: { observationCount: 2, sourceReferenceCount: 20, continuityMismatchCount: 0, mutationDuringReopenCount: 0, implementationEffectsApplied: 0 },
    authorityBoundary: "reopen-continuity-proves-deterministic-artifact-stability-not-source-truth-readiness-native-host-product-owner-or-action-authority",
  }
  return { ...content, continuityDigest: canonicalDigest(content) }
}

function buildFailureRecovery(scenario, catalog) {
  const cases = scenario.failureCases.map((item, index) => {
    const observation = { scenarioId: scenario.id, caseId: item.id, injectedState: item.injectedState, boundCatalogDigest: catalog.catalogDigest }
    const recoveryCandidate = { recovery: item.recovery, supersedesObservationDigest: canonicalDigest(observation), resultingState: "candidate-recomputation-required" }
    return {
      ordinal: index + 1,
      ...item,
      observationDigest: canonicalDigest(observation),
      gateState: "attention-required",
      automaticRetry: false,
      recoveryCandidate: { ...recoveryCandidate, digest: canonicalDigest(recoveryCandidate) },
      waiverGranted: false,
      readinessGranted: false,
      ownerAppointed: false,
      effectApplied: false,
    }
  })
  const content = {
    schemaVersion: 1,
    kind: "gaep-phase3a-realistic-readiness-failure-recovery",
    scenario: { id: scenario.id, digest: canonicalDigest(scenario) },
    cases,
    summary: { caseCount: 3, holdCount: 3, automaticRetryCount: 0, waiversGranted: 0, readinessGrants: 0, ownersAppointed: 0, effectsApplied: 0 },
    authorityBoundary: "failure-recovery-records-hold-and-recomputation-candidates-not-waiver-readiness-ownership-approval-implementation-or-action-authority",
  }
  return { ...content, recoveryDigest: canonicalDigest(content) }
}

function buildHostProjections(scenario, conformance, studioBytes, dashboard) {
  if (conformance?.kind !== "gaep-phase-0-ide-conformance-report-v1" || conformance.summary?.hosts !== 4 ||
      conformance.summary?.capabilities !== 97 || conformance.summary?.assessments !== 388 ||
      conformance.summary?.implemented !== 388 || conformance.summary?.acceptedHosts !== 0 ||
      conformance.summary?.acceptedProviders !== 0) {
    fail("P3A-23 conformance differs from the exact 97-capability incomplete-acceptance boundary")
  }
  const studioSource = studioBytes.toString("utf8")
  if (!studioSource.includes("phase3aDashboard = composePhase3aDashboard") || !studioSource.includes("...(phase3aDashboard ? { phase3aDashboard } : {})")) {
    fail("Product Studio source no longer exposes the exact Phase 3A dashboard")
  }
  const hosts = conformance.hosts.map((host) => {
    const capability = host.capabilities.find((item) => item.capabilityId === "phase3a-dashboard")
    if (!capability || capability.state !== "implemented") fail(`host ${host.id} lacks the exact Phase 3A dashboard projection`)
    return {
      id: host.id,
      phase3aDashboard: { state: capability.state, sourceProbesVerified: capability.sourceProbesVerified, snapshotDigest: dashboard.snapshotDigest },
      packageStatus: host.package.status,
      runtimeLevel: host.runtimeEvidence.level,
      runtimeSourceSnapshotDigest: host.runtimeEvidence.sourceSnapshotDigest,
      acceptance: host.acceptance,
    }
  })
  const content = {
    schemaVersion: 1,
    kind: "gaep-phase3a-realistic-readiness-host-projections",
    scenario: { id: scenario.id, digest: canonicalDigest(scenario) },
    productStudio: {
      host: "vscode",
      viewId: "phase3aDashboard",
      sourcePath: scenario.sourcePaths.productStudio,
      sourceDigest: rawDigest(studioBytes),
      dashboardSnapshotDigest: dashboard.snapshotDigest,
      projectionState: "implemented-local",
    },
    hosts,
    summary: { productStudioProjectionCount: 1, hostCount: 4, implementedHostProjectionCount: 4, acceptedHostCount: 0 },
    authorityBoundary: "host-projections-bind-current-local-source-package-runtime-and-dashboard-evidence-not-native-interaction-live-provider-or-host-acceptance",
  }
  return { ...content, hostProjectionDigest: canonicalDigest(content) }
}

function fileBinding(path, bytes, semanticDigest) {
  assertDigest(semanticDigest, `${path} semantic digest`)
  return { path, bytes: bytes.length, digest: rawDigest(bytes), semanticDigest }
}

async function readArtifactInputs(target) {
  const scenario = verifyScenario(parseJson(await readRegularFile(scenarioSourcePath, "canonical scenario"), "canonical scenario"))
  const sourcePaths = {
    codexReceipt: resolve(repository, scenario.sourcePaths.codexArtifact, "receipt.json"),
    codexCandidateChain: resolve(repository, scenario.sourcePaths.codexArtifact, "candidate-chain.json"),
    claudeReceipt: resolve(repository, scenario.sourcePaths.claudeArtifact, "receipt.json"),
    conformance: resolve(repository, scenario.sourcePaths.phase3aConformance),
    report: resolve(repository, scenario.sourcePaths.phase3aReport),
    studio: resolve(repository, scenario.sourcePaths.productStudio),
  }
  const [scenarioBytes, scenarioSourceBytes, codexBytes, codexSourceBytes, chainBytes, chainSourceBytes, claudeBytes, claudeSourceBytes,
    conformanceBytes, conformanceSourceBytes, reportBytes, reportSourceBytes, studioBytes] = await Promise.all([
    readRegularFile(resolve(target, "scenario.json"), "scenario.json"),
    readRegularFile(scenarioSourcePath, "canonical scenario"),
    readRegularFile(resolve(target, "sources/codex-receipt.json"), "sources/codex-receipt.json"),
    readRegularFile(sourcePaths.codexReceipt, "sealed Codex receipt"),
    readRegularFile(resolve(target, "sources/codex-candidate-chain.json"), "sources/codex-candidate-chain.json"),
    readRegularFile(sourcePaths.codexCandidateChain, "sealed Codex candidate chain"),
    readRegularFile(resolve(target, "sources/claude-receipt.json"), "sources/claude-receipt.json"),
    readRegularFile(sourcePaths.claudeReceipt, "sealed Claude receipt"),
    readRegularFile(resolve(target, "sources/phase3a-conformance.json"), "sources/phase3a-conformance.json"),
    readRegularFile(sourcePaths.conformance, "P3A-23 conformance"),
    readRegularFile(resolve(target, "sources/phase3a-report.json"), "sources/phase3a-report.json"),
    readRegularFile(sourcePaths.report, "P3A-23 report"),
    readRegularFile(sourcePaths.studio, "Product Studio source"),
  ])
  const pairs = [
    [scenarioBytes, scenarioSourceBytes, "scenario.json"],
    [codexBytes, codexSourceBytes, "sources/codex-receipt.json"],
    [chainBytes, chainSourceBytes, "sources/codex-candidate-chain.json"],
    [claudeBytes, claudeSourceBytes, "sources/claude-receipt.json"],
    [conformanceBytes, conformanceSourceBytes, "sources/phase3a-conformance.json"],
    [reportBytes, reportSourceBytes, "sources/phase3a-report.json"],
  ]
  for (const [actual, expected, label] of pairs) if (!actual.equals(expected)) fail(`${label} differs from its exact sealed repository source`)
  const codex = verifyWorkflowReceipt(parseJson(codexBytes, "sources/codex-receipt.json"), "codex")
  const claude = verifyWorkflowReceipt(parseJson(claudeBytes, "sources/claude-receipt.json"), "claude")
  const candidateChain = verifyCandidateChain(parseJson(chainBytes, "sources/codex-candidate-chain.json"))
  const conformance = parseJson(conformanceBytes, "sources/phase3a-conformance.json")
  const report = parseJson(reportBytes, "sources/phase3a-report.json")
  if (report?.kind !== "gaep-phase-acceptance-report-v1" || report.evidenceScope !== "phase-3a-dashboard-local" ||
      report.verificationResult !== "pass" || report.phaseGate !== "incomplete" || report.summary?.validationGatesPassed !== 7 ||
      report.summary?.hostsAccepted !== 0 || report.summary?.providersAccepted !== 0) {
    fail("P3A-23 report differs from the exact passing-local incomplete-gate boundary")
  }
  if (codex.scenario.product.digest !== claude.scenario.product.digest || codex.scenario.initiative.digest !== claude.scenario.initiative.digest ||
      codex.scenario.product.digest !== canonicalDigest(scenario.product) || codex.scenario.initiative.digest !== canonicalDigest(scenario.initiative)) {
    fail("sealed provider workflows do not bind the exact realistic Product and Initiative")
  }
  return {
    scenarioBytes,
    scenario,
    codex: { bytes: codexBytes, value: codex },
    claude: { bytes: claudeBytes, value: claude },
    candidateChain: { bytes: chainBytes, value: candidateChain },
    conformance: { bytes: conformanceBytes, value: conformance },
    report: { bytes: reportBytes, value: report },
    studioBytes,
  }
}

async function expectedOutputs(target, inputs) {
  const readinessCatalog = buildReadinessCatalog(inputs.scenario, inputs.candidateChain.value)
  const dashboard = buildDashboard(inputs.scenario, readinessCatalog, inputs.codex, inputs.claude)
  const reopenContinuity = buildReopenContinuity(inputs.scenario, readinessCatalog, dashboard)
  const failureRecovery = buildFailureRecovery(inputs.scenario, readinessCatalog)
  const hostProjections = buildHostProjections(inputs.scenario, inputs.conformance.value, inputs.studioBytes, dashboard)
  const definitions = [
    ["readiness-catalog.json", readinessCatalog, readinessCatalog.catalogDigest],
    ["dashboard.json", dashboard, dashboard.snapshotDigest],
    ["reopen-continuity.json", reopenContinuity, reopenContinuity.continuityDigest],
    ["failure-recovery.json", failureRecovery, failureRecovery.recoveryDigest],
    ["host-projections.json", hostProjections, hostProjections.hostProjectionDigest],
  ]
  const outputFiles = {}
  for (const [path, expected, semanticDigest] of definitions) {
    const bytes = await readRegularFile(resolve(target, path), path)
    const actual = parseJson(bytes, path)
    try { assert.deepEqual(actual, expected) } catch { fail(`${path} differs from the exact realistic scenario and sealed source evidence`) }
    outputFiles[path] = { bytes, semanticDigest }
  }
  return { readinessCatalog, dashboard, reopenContinuity, failureRecovery, hostProjections, outputFiles }
}

export async function derivePhase3aRealisticReadinessExampleReceipt(artifactDirectory) {
  const target = resolve(artifactDirectory)
  const inputs = await readArtifactInputs(target)
  const outputs = await expectedOutputs(target, inputs)
  const sources = [
    fileBinding("sources/codex-receipt.json", inputs.codex.bytes, inputs.codex.value.compositionDigest),
    fileBinding("sources/codex-candidate-chain.json", inputs.candidateChain.bytes, inputs.candidateChain.value.chainDigest),
    fileBinding("sources/claude-receipt.json", inputs.claude.bytes, inputs.claude.value.compositionDigest),
    fileBinding("sources/phase3a-conformance.json", inputs.conformance.bytes, canonicalDigest(inputs.conformance.value)),
    fileBinding("sources/phase3a-report.json", inputs.report.bytes, inputs.report.value.testsDigest),
    { path: inputs.scenario.sourcePaths.productStudio, bytes: inputs.studioBytes.length, digest: rawDigest(inputs.studioBytes), semanticDigest: outputs.hostProjections.productStudio.sourceDigest },
  ]
  const outputBindings = Object.fromEntries(Object.entries(outputs.outputFiles).map(([path, item]) => [path, fileBinding(path, item.bytes, item.semanticDigest)]))
  const summary = {
    sourceCount: outputs.readinessCatalog.summary.sourceCount,
    exactCurrentCandidateCount: outputs.readinessCatalog.summary.exactCurrentCandidateCount,
    evidenceReferenceCount: outputs.readinessCatalog.summary.evidenceReferenceCount,
    gapCount: 0,
    conflictCount: 0,
    staleCount: 0,
    unresolvedCount: 0,
    dashboardViewCount: outputs.dashboard.views.length,
    providerWorkflowEvidenceCount: outputs.dashboard.phaseStatus.providerWorkflowEvidenceCount,
    candidatePhaseState: outputs.dashboard.phaseStatus.state,
    reopenObservationCount: outputs.reopenContinuity.summary.observationCount,
    continuityMismatchCount: 0,
    failureRecoveryCaseCount: outputs.failureRecovery.summary.caseCount,
    holdCount: outputs.failureRecovery.summary.holdCount,
    hostProjectionCount: outputs.hostProjections.summary.hostCount,
    productStudioProjectionCount: outputs.hostProjections.summary.productStudioProjectionCount,
    liveProviderRequestCount: 0,
    implementationEffectsApplied: 0,
    hostsAccepted: 0,
    providersAccepted: 0,
    productOwnerAcceptance: "not-established",
    readinessAuthority: "not-established",
  }
  const content = {
    schemaVersion: 1,
    kind: "gaep-phase3a-realistic-readiness-example-receipt",
    scenario: {
      id: inputs.scenario.id,
      path: "scenario.json",
      sourcePath: "examples/phase-3a-realistic-readiness-example/scenario.json",
      sourceDigest: rawDigest(inputs.scenarioBytes),
      semanticDigest: canonicalDigest(inputs.scenario),
      product: outputs.dashboard.product,
      initiative: outputs.dashboard.initiative,
    },
    sources,
    outputs: outputBindings,
    summary,
    summaryDigest: canonicalDigest(summary),
    authority: {
      productTruth: "not-established",
      sourceCompleteness: "not-established",
      priorityAuthority: "not-established",
      readinessAuthority: "not-established",
      waiverAuthority: "not-granted",
      ownershipAppointment: "not-established",
      implementationAuthorization: "not-granted",
      liveProviderStatus: "not-tested",
      nativeHostAcceptance: "not-established",
      productOwnerAcceptance: "not-established",
      securityScan: "skipped-by-product-owner",
      releaseAuthority: "not-granted",
      deploymentAuthority: "not-granted",
      actionAuthority: "not-granted",
      boundary: "phase-3a-realistic-readiness-receipt-is-deterministic-local-candidate-evidence-not-real-product-source-truth-readiness-waiver-ownership-implementation-live-provider-native-host-product-owner-security-release-deployment-or-action-authority",
    },
    limitations: phase3aRealisticReadinessExampleLimitations,
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
      if (stat.isDirectory()) { await walk(path, [...segments, name]); continue }
      if (!stat.isFile() || stat.size < 2 || stat.size > fileByteLimit) fail(`${relativePath} exceeds its regular-file boundary`)
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

export async function createPhase3aRealisticReadinessExampleManifest(artifactDirectory) {
  const target = resolve(artifactDirectory)
  await assertRegularDirectory(target, "artifact directory")
  const entries = (await readdir(target)).sort()
  const withoutManifest = expectedTopLevelEntries.filter((name) => name !== "artifact-manifest.json").sort()
  if (JSON.stringify(entries) !== JSON.stringify(withoutManifest) && JSON.stringify(entries) !== JSON.stringify([...expectedTopLevelEntries].sort())) {
    fail(`artifact directory entries differ; received ${entries.join(", ")}`)
  }
  await assertExactDirectoryEntries(resolve(target, "sources"), expectedSourceEntries, "sources")
  const receipt = await derivePhase3aRealisticReadinessExampleReceipt(target)
  const receiptBytes = await readRegularFile(resolve(target, "receipt.json"), "receipt.json")
  const inventory = await inventoryArtifacts(target)
  return {
    schemaVersion: 1,
    kind: "gaep-phase3a-realistic-readiness-example-artifact-manifest",
    scenario: receipt.scenario,
    receipt: { path: "receipt.json", bytes: receiptBytes.length, digest: rawDigest(receiptBytes), compositionDigest: receipt.compositionDigest },
    inventory,
    authorityBoundary: "artifact-manifest-is-integrity-evidence-not-product-truth-readiness-implementation-live-provider-native-host-product-owner-security-release-or-deployment-authority",
  }
}

export async function verifyPhase3aRealisticReadinessExampleArtifactDirectory(artifactDirectory) {
  const target = resolve(artifactDirectory)
  await assertRegularDirectory(target, "artifact directory")
  await assertExactDirectoryEntries(target, expectedTopLevelEntries, "artifact directory")
  await assertExactDirectoryEntries(resolve(target, "sources"), expectedSourceEntries, "sources")
  const receipt = parseJson(await readRegularFile(resolve(target, "receipt.json"), "receipt.json"), "receipt.json")
  const expectedReceipt = await derivePhase3aRealisticReadinessExampleReceipt(target)
  try { assert.deepEqual(receipt, expectedReceipt) } catch { fail("receipt.json differs from the exact scenario, sources, catalog, dashboard, continuity, recovery, and host projections") }
  const manifest = parseJson(await readRegularFile(resolve(target, "artifact-manifest.json"), "artifact-manifest.json"), "artifact-manifest.json")
  const expectedManifest = await createPhase3aRealisticReadinessExampleManifest(target)
  try { assert.deepEqual(manifest, expectedManifest) } catch { fail("artifact-manifest.json differs from the exact artifact inventory") }
  return { receipt, manifest }
}

export async function runPhase3aRealisticReadinessExampleArtifacts(path) {
  const target = resolve(path)
  const parent = dirname(target)
  const parentStat = await lstat(parent)
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) throw new Error("Artifact parent must be a regular directory")
  try {
    await lstat(target)
    throw new Error("Artifact directory already exists; refusing to reuse or overwrite it")
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
  }
  const scenario = verifyScenario(parseJson(await readFile(scenarioSourcePath), "canonical scenario"))
  const staging = await mkdtemp(join(parent, ".gaep-phase3a-realistic-readiness-"))
  try {
    await mkdir(resolve(staging, "sources"), { mode: 0o700 })
    await copyFile(scenarioSourcePath, resolve(staging, "scenario.json"))
    await Promise.all([
      copyFile(resolve(repository, scenario.sourcePaths.codexArtifact, "receipt.json"), resolve(staging, "sources/codex-receipt.json")),
      copyFile(resolve(repository, scenario.sourcePaths.codexArtifact, "candidate-chain.json"), resolve(staging, "sources/codex-candidate-chain.json")),
      copyFile(resolve(repository, scenario.sourcePaths.claudeArtifact, "receipt.json"), resolve(staging, "sources/claude-receipt.json")),
      copyFile(resolve(repository, scenario.sourcePaths.phase3aConformance), resolve(staging, "sources/phase3a-conformance.json")),
      copyFile(resolve(repository, scenario.sourcePaths.phase3aReport), resolve(staging, "sources/phase3a-report.json")),
    ])
    const inputs = await readArtifactInputs(staging)
    const readinessCatalog = buildReadinessCatalog(inputs.scenario, inputs.candidateChain.value)
    const dashboard = buildDashboard(inputs.scenario, readinessCatalog, inputs.codex, inputs.claude)
    await writeExclusive(resolve(staging, "readiness-catalog.json"), readinessCatalog)
    await writeExclusive(resolve(staging, "dashboard.json"), dashboard)
    await writeExclusive(resolve(staging, "reopen-continuity.json"), buildReopenContinuity(inputs.scenario, readinessCatalog, dashboard))
    await writeExclusive(resolve(staging, "failure-recovery.json"), buildFailureRecovery(inputs.scenario, readinessCatalog))
    await writeExclusive(resolve(staging, "host-projections.json"), buildHostProjections(inputs.scenario, inputs.conformance.value, inputs.studioBytes, dashboard))
    await writeExclusive(resolve(staging, "receipt.json"), await derivePhase3aRealisticReadinessExampleReceipt(staging))
    await writeExclusive(resolve(staging, "artifact-manifest.json"), await createPhase3aRealisticReadinessExampleManifest(staging))
    await verifyPhase3aRealisticReadinessExampleArtifactDirectory(staging)
    await rename(staging, target)
    return verifyPhase3aRealisticReadinessExampleArtifactDirectory(target)
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    throw error
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 2 && args[0] === "--artifacts") {
    const { receipt, manifest } = await runPhase3aRealisticReadinessExampleArtifacts(args[1])
    process.stdout.write(`${JSON.stringify({ artifactDirectory: resolve(args[1]), scenarioId: receipt.scenario.id,
      sourceCount: receipt.summary.sourceCount, dashboardViewCount: receipt.summary.dashboardViewCount,
      providerWorkflowEvidenceCount: receipt.summary.providerWorkflowEvidenceCount,
      failureRecoveryCaseCount: receipt.summary.failureRecoveryCaseCount, artifactFileCount: manifest.inventory.fileCount,
      compositionDigest: receipt.compositionDigest }, null, 2)}\n`)
    return
  }
  if (args.length === 1) {
    const { receipt, manifest } = await verifyPhase3aRealisticReadinessExampleArtifactDirectory(args[0])
    process.stdout.write(`${JSON.stringify({ valid: true, kind: receipt.kind, scenarioId: receipt.scenario.id,
      sourceCount: receipt.summary.sourceCount, dashboardViewCount: receipt.summary.dashboardViewCount,
      artifactFileCount: manifest.inventory.fileCount, compositionDigest: receipt.compositionDigest }, null, 2)}\n`)
    return
  }
  throw new Error("Usage: node scripts/phase3a_realistic_readiness_example_artifacts.mjs [--artifacts] <artifact-directory>")
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
