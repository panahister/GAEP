import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { copyFile, lstat, mkdir, mkdtemp, open, readFile, readdir, rename, rm } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { runClaudeP0P4Acceptance } from "./run_claude_p0_p4_acceptance.mjs"
import { verifyClaudeP0P4ReceiptObject } from "./verify_claude_p0_p4_receipt.mjs"
import { verifyPhase3aCodexReadinessWorkflowArtifactDirectory } from "./phase3a_codex_readiness_workflow_artifacts.mjs"

const repository = fileURLToPath(new URL("..", import.meta.url))
const scenarioSourcePath = resolve(repository, "examples/phase-3a-claude-readiness-workflow/scenario.json")
const codexScenarioSourcePath = resolve(repository, "examples/phase-3a-codex-readiness-workflow/scenario.json")
const codexArtifactDirectory = resolve(repository, "evidence/examples/20260731T110500Z-phase-3a-codex-readiness-workflow")
const codexWorkflowReceiptSourcePath = resolve(codexArtifactDirectory, "receipt.json")
const fileByteLimit = 4 * 1024 * 1024
const artifactByteLimit = 24 * 1024 * 1024
const artifactFileLimit = 64
const digestPattern = /^sha256:[0-9a-f]{64}$/u
const expectedTopLevelEntries = [
  "artifact-manifest.json",
  "candidate-chain.json",
  "failure-recovery.json",
  "host-projections.json",
  "provider-parity.json",
  "receipt.json",
  "reopen-continuity.json",
  "scenario.json",
  "sources",
]
const expectedSourceEntries = [
  "claude-receipt.json",
  "codex-parity-scenario.json",
  "codex-workflow-receipt.json",
  "phase3a-conformance.json",
  "phase3a-report.json",
]

export const phase3aClaudeReadinessWorkflowLimitations = [
  "This is a deterministic local fixture and not real Product, backlog, design, boilerplate, test, risk, security, or readiness evidence.",
  "Claude execution uses the isolated fake stream, tool-free context-only contract and makes no live provider request or semantic-quality claim.",
  "No OAuth, keychain, API key helper, administrator-policy override, authentication bypass, or supported-runtime claim is attempted.",
  "Reopen, recovery, Product Studio, and host projections prove bounded deterministic continuity and Codex scenario parity only, not native-host interaction or acceptance.",
  "No waiver, owner appointment, implementation readiness, assignment, execution, acceptance, security, release, deployment, or action authority is established.",
]

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize)
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, normalize(child)]))
  }
  return value
}

export function canonicalDigest(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(normalize(value))).digest("hex")}`
}

function rawDigest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

function fail(message) {
  throw new Error(`Invalid Phase 3A Claude readiness workflow artifact: ${message}`)
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
  if (value?.schemaVersion !== 1 || value.kind !== "gaep-phase3a-claude-readiness-workflow-scenario" ||
      value.id !== "phase-3a-atlas-claude-readiness-workflow-v1" ||
      value.authorityBoundary !== "phase-3a-claude-readiness-workflow-is-deterministic-offline-tool-free-parity-evidence-not-live-provider-runtime-authentication-policy-product-truth-readiness-waiver-ownership-native-host-product-owner-security-release-deployment-or-action-authority") {
    fail("scenario identity or authority boundary differs")
  }
  if (value.initiative?.productId !== value.product?.id || value.product?.revision !== 1 || value.initiative?.revision !== 1 ||
      value.initiative?.state !== "active") fail("scenario Product and Initiative bindings differ")
  if (value.provider?.adapterId !== "gaep.claude-code-cli" || value.provider?.agentId !== "claude-code-cli" ||
      value.provider?.executionMode !== "deterministic-offline-tool-free-context-contract" ||
      value.provider?.liveRequestExpected !== false || value.provider?.stagingExpected !== false ||
      value.provider?.toolDefinitionCountExpected !== 0 || value.provider?.writeScopeCountExpected !== 0) {
    fail("scenario provider boundary differs")
  }
  if (value.parity?.sourceScenarioPath !== "examples/phase-3a-codex-readiness-workflow/scenario.json" ||
      value.parity?.sourceWorkflowReceiptPath !== "evidence/examples/20260731T110500Z-phase-3a-codex-readiness-workflow/receipt.json" ||
      value.parity?.expectedStageCount !== 20 || value.parity?.expectedReopenObservationCount !== 2 ||
      value.parity?.expectedFailureRecoveryCaseCount !== 3 || value.parity?.expectedHostProjectionCount !== 4) {
    fail("scenario Codex parity boundary differs")
  }
  if (!Array.isArray(value.stages) || value.stages.length !== 20 ||
      value.stages.some((stage, index) => stage.ordinal !== index + 1 || stage.id !== `P3A-${String(index + 1).padStart(2, "0")}`) ||
      new Set(value.stages.map((stage) => stage.artifactKind)).size !== 20) {
    fail("scenario must declare the exact ordered P3A-01 through P3A-20 candidate stages")
  }
  if (!Array.isArray(value.failureCases) || value.failureCases.length !== 3 ||
      value.failureCases.some((item) => item.expectedState !== "hold") ||
      new Set(value.failureCases.map((item) => item.injectedState)).size !== 3) {
    fail("scenario must declare three distinct fail-closed recovery cases")
  }
  if (JSON.stringify(value.limitations) !== JSON.stringify(phase3aClaudeReadinessWorkflowLimitations)) {
    fail("scenario limitations differ")
  }
  return value
}

function candidateId(index) {
  return `34000000-0000-4000-8000-${String(index + 101).padStart(12, "0")}`
}

function buildCandidateChain(scenario) {
  const stages = scenario.stages.map((stage, index) => {
    const dependencyStageIds = index === 0 ? [] : index === scenario.stages.length - 1
      ? scenario.stages.slice(0, index).map((item) => item.id)
      : [scenario.stages[index - 1].id]
    const identity = {
      scenarioId: scenario.id,
      stageId: stage.id,
      artifactKind: stage.artifactKind,
      recordId: candidateId(index),
      revision: 1,
      dependencyStageIds,
      state: "candidate-recorded",
    }
    return { ...stage, dependencyStageIds, candidate: { recordId: identity.recordId, revision: 1, digest: canonicalDigest(identity) }, state: identity.state }
  })
  const content = {
    schemaVersion: 1,
    kind: "gaep-phase3a-claude-readiness-candidate-chain",
    scenario: { id: scenario.id, digest: canonicalDigest(scenario) },
    product: { id: scenario.product.id, revision: scenario.product.revision, digest: canonicalDigest(scenario.product) },
    initiative: { id: scenario.initiative.id, revision: scenario.initiative.revision, digest: canonicalDigest(scenario.initiative) },
    stages,
    summary: {
      stageCount: stages.length,
      exactCurrentCandidateCount: stages.length,
      implementationReadinessDependencyStageCount: stages.at(-1).dependencyStageIds.length,
      staleBindingCount: 0,
      missingStageCount: 0,
      writesApplied: 0,
    },
    authorityBoundary: "candidate-chain-is-deterministic-workflow-evidence-not-product-artifact-completeness-readiness-approval-waiver-ownership-implementation-or-action-authority",
  }
  return { ...content, chainDigest: canonicalDigest(content) }
}

function buildReopenContinuity(scenario, chain) {
  const snapshot = {
    product: chain.product,
    initiative: chain.initiative,
    stageReferences: chain.stages.map((stage) => ({ stageId: stage.id, candidate: stage.candidate })),
    chainDigest: chain.chainDigest,
  }
  const content = {
    schemaVersion: 1,
    kind: "gaep-phase3a-claude-readiness-reopen-continuity",
    scenario: { id: scenario.id, digest: canonicalDigest(scenario) },
    observations: [
      { ordinal: 1, event: "workspace-closed-after-candidate-chain", snapshot, snapshotDigest: canonicalDigest(snapshot) },
      { ordinal: 2, event: "workspace-reopened-and-chain-recomputed", snapshot, snapshotDigest: canonicalDigest(snapshot) },
    ],
    summary: {
      observationCount: 2,
      exactStageReferenceCount: snapshot.stageReferences.length,
      continuityMismatchCount: 0,
      mutationDuringReopenCount: 0,
      implementationEffectsApplied: 0,
    },
    authorityBoundary: "reopen-continuity-proves-deterministic-reference-stability-not-source-truth-readiness-native-host-acceptance-or-action-authority",
  }
  return { ...content, continuityDigest: canonicalDigest(content) }
}

function buildFailureRecovery(scenario, chain) {
  const cases = scenario.failureCases.map((item, index) => {
    const observation = {
      scenarioId: scenario.id,
      caseId: item.id,
      injectedState: item.injectedState,
      boundChainDigest: chain.chainDigest,
    }
    const recoveryCandidate = {
      recovery: item.recovery,
      supersedesObservationDigest: canonicalDigest(observation),
      resultingState: "candidate-continuity-restored",
    }
    return {
      ordinal: index + 1,
      ...item,
      observationDigest: canonicalDigest(observation),
      gateState: "attention-required",
      automaticRetry: false,
      recoveryCandidate: { ...recoveryCandidate, digest: canonicalDigest(recoveryCandidate) },
      readinessGranted: false,
      effectApplied: false,
    }
  })
  const content = {
    schemaVersion: 1,
    kind: "gaep-phase3a-claude-readiness-failure-recovery",
    scenario: { id: scenario.id, digest: canonicalDigest(scenario) },
    cases,
    summary: { caseCount: cases.length, holdCount: cases.length, recoveredCandidateCount: cases.length, automaticRetryCount: 0, effectsApplied: 0 },
    authorityBoundary: "failure-recovery-records-hold-and-superseding-candidate-evidence-not-waiver-readiness-approval-implementation-or-action-authority",
  }
  return { ...content, recoveryDigest: canonicalDigest(content) }
}

function buildHostProjections(scenario, conformance, studioBytes) {
  if (conformance?.kind !== "gaep-phase-0-ide-conformance-report-v1" || conformance.summary?.hosts !== 4 ||
      conformance.summary?.capabilities !== 96 || conformance.summary?.assessments !== 384 ||
      conformance.summary?.implemented !== 384 || conformance.summary?.acceptedHosts !== 0) {
    fail("P3A-21 conformance differs from the exact 96-capability incomplete-acceptance boundary")
  }
  const studioSource = studioBytes.toString("utf8")
  if (!studioSource.includes("implementationReadinessGates: implementationReadinessGateTable(state)") ||
      !studioSource.includes("function implementationReadinessGateTable")) {
    fail("Product Studio source no longer exposes the exact Implementation Readiness Gate table")
  }
  const hosts = conformance.hosts.map((host) => {
    const capability = host.capabilities.find((item) => item.capabilityId === "implementation-readiness-gate")
    if (!capability || capability.state !== "implemented") fail(`host ${host.id} lacks the exact Implementation Readiness Gate projection`)
    return {
      id: host.id,
      implementationReadinessGate: { state: capability.state, sourceProbesVerified: capability.sourceProbesVerified },
      packageStatus: host.package.status,
      runtimeLevel: host.runtimeEvidence.level,
      runtimeSourceSnapshotDigest: host.runtimeEvidence.sourceSnapshotDigest,
      acceptance: host.acceptance,
    }
  })
  const content = {
    schemaVersion: 1,
    kind: "gaep-phase3a-claude-readiness-host-projections",
    scenario: { id: scenario.id, digest: canonicalDigest(scenario) },
    productStudio: {
      host: "vscode",
      tableId: "implementationReadinessGates",
      sourcePath: scenario.sourcePaths.productStudio,
      sourceDigest: rawDigest(studioBytes),
      projectionState: "implemented-local",
    },
    hosts,
    summary: { productStudioProjectionCount: 1, hostCount: hosts.length, implementedHostProjectionCount: hosts.length, acceptedHostCount: 0 },
    authorityBoundary: "host-projections-bind-current-local-source-package-and-runtime-evidence-not-native-interaction-live-provider-or-host-acceptance",
  }
  return { ...content, hostProjectionDigest: canonicalDigest(content) }
}

function paritySemantics(scenario) {
  return {
    product: scenario.product,
    initiative: scenario.initiative,
    stages: scenario.stages,
    failureCases: scenario.failureCases,
  }
}

function buildProviderParity(scenario, codexScenario, codexReceipt, claudeReceipt) {
  const claudeSemantics = paritySemantics(scenario)
  const codexSemantics = paritySemantics(codexScenario)
  try { assert.deepEqual(claudeSemantics, codexSemantics) } catch {
    fail("Claude scenario differs from the exact Codex Product, Initiative, stage, or recovery semantics")
  }
  const claudeExecution = claudeReceipt.summary?.execution
  if (claudeExecution?.adapterId !== scenario.provider.adapterId || claudeExecution?.agentId !== scenario.provider.agentId ||
      claudeExecution?.mode !== "claude-context-only" || claudeExecution?.state !== "completed" ||
      claudeExecution?.stagingPresent !== false || claudeExecution?.toolDefinitionCount !== 0 ||
      claudeExecution?.writeScopeCount !== 0 || claudeExecution?.providerPostconditionStatus !== "not-assessed" ||
      claudeExecution?.postconditionAuthority !== "workflow-gate-evaluator") {
    fail("Claude receipt differs from the exact deterministic tool-free context-only boundary")
  }
  if (codexReceipt?.kind !== "gaep-phase3a-codex-readiness-workflow-receipt" ||
      codexReceipt.scenario?.id !== "phase-3a-atlas-codex-readiness-workflow-v1" ||
      codexReceipt.summary?.stageCount !== scenario.parity.expectedStageCount ||
      codexReceipt.summary?.reopenObservationCount !== scenario.parity.expectedReopenObservationCount ||
      codexReceipt.summary?.failureRecoveryCaseCount !== scenario.parity.expectedFailureRecoveryCaseCount ||
      codexReceipt.summary?.hostProjectionCount !== scenario.parity.expectedHostProjectionCount ||
      codexReceipt.summary?.liveProviderRequestCount !== 0 || codexReceipt.summary?.implementationEffectsApplied !== 0) {
    fail("sealed Codex workflow receipt differs from the exact parity boundary")
  }
  const content = {
    schemaVersion: 1,
    kind: "gaep-phase3a-claude-readiness-provider-parity",
    scenario: { id: scenario.id, digest: canonicalDigest(scenario) },
    codex: {
      scenarioId: codexScenario.id,
      provider: codexScenario.provider,
      scenarioSemanticDigest: canonicalDigest(codexSemantics),
      workflowCompositionDigest: codexReceipt.compositionDigest,
    },
    claude: {
      scenarioId: scenario.id,
      provider: scenario.provider,
      scenarioSemanticDigest: canonicalDigest(claudeSemantics),
      receiptSummaryDigest: claudeReceipt.summaryDigest,
      execution: {
        mode: claudeExecution.mode,
        stagingPresent: claudeExecution.stagingPresent,
        toolDefinitionCount: claudeExecution.toolDefinitionCount,
        writeScopeCount: claudeExecution.writeScopeCount,
      },
    },
    summary: {
      semanticParityMismatchCount: 0,
      stageCount: scenario.stages.length,
      reopenObservationCount: scenario.parity.expectedReopenObservationCount,
      failureRecoveryCaseCount: scenario.failureCases.length,
      hostProjectionCount: scenario.parity.expectedHostProjectionCount,
      liveProviderRequestCount: 0,
      implementationEffectsApplied: 0,
    },
    authorityBoundary: "provider-parity-proves-deterministic-fixture-contract-equivalence-not-live-provider-runtime-authentication-policy-semantic-quality-readiness-or-action-authority",
  }
  return { ...content, parityDigest: canonicalDigest(content) }
}

function fileBinding(path, bytes, semanticDigest) {
  assertDigest(semanticDigest, `${path} semantic digest`)
  return { path, bytes: bytes.length, digest: rawDigest(bytes), semanticDigest }
}

async function readArtifactInputs(target) {
  const [scenarioSourceBytes, scenarioBytes, claudeBytes, codexScenarioBytes, codexWorkflowReceiptBytes,
    conformanceBytes, reportBytes, studioBytes, verifiedCodexArtifact] = await Promise.all([
    readRegularFile(scenarioSourcePath, "canonical scenario"),
    readRegularFile(resolve(target, "scenario.json"), "scenario.json"),
    readRegularFile(resolve(target, "sources/claude-receipt.json"), "sources/claude-receipt.json"),
    readRegularFile(resolve(target, "sources/codex-parity-scenario.json"), "sources/codex-parity-scenario.json"),
    readRegularFile(resolve(target, "sources/codex-workflow-receipt.json"), "sources/codex-workflow-receipt.json"),
    readRegularFile(resolve(target, "sources/phase3a-conformance.json"), "sources/phase3a-conformance.json"),
    readRegularFile(resolve(target, "sources/phase3a-report.json"), "sources/phase3a-report.json"),
    readRegularFile(resolve(repository, "apps/vscode/src/current-engine-studio-data-source.ts"), "Product Studio source"),
    verifyPhase3aCodexReadinessWorkflowArtifactDirectory(codexArtifactDirectory),
  ])
  if (!scenarioBytes.equals(scenarioSourceBytes)) fail("scenario.json differs from the canonical repository scenario")
  const canonicalCodexScenarioBytes = await readRegularFile(codexScenarioSourcePath, "canonical Codex parity scenario")
  if (!codexScenarioBytes.equals(canonicalCodexScenarioBytes)) fail("Codex parity scenario differs from the canonical repository source")
  const canonicalCodexReceiptBytes = await readRegularFile(codexWorkflowReceiptSourcePath, "sealed Codex workflow receipt")
  if (!codexWorkflowReceiptBytes.equals(canonicalCodexReceiptBytes)) fail("Codex workflow receipt differs from the sealed P3A-21 artifact")
  const scenario = verifyScenario(parseJson(scenarioBytes, "scenario.json"))
  const claude = await verifyClaudeP0P4ReceiptObject(parseJson(claudeBytes, "sources/claude-receipt.json"))
  const codexScenario = parseJson(codexScenarioBytes, "sources/codex-parity-scenario.json")
  const codexWorkflowReceipt = parseJson(codexWorkflowReceiptBytes, "sources/codex-workflow-receipt.json")
  try { assert.deepEqual(codexWorkflowReceipt, verifiedCodexArtifact.receipt) } catch {
    fail("Codex workflow receipt does not independently verify against the sealed P3A-21 artifact")
  }
  const conformance = parseJson(conformanceBytes, "sources/phase3a-conformance.json")
  const report = parseJson(reportBytes, "sources/phase3a-report.json")
  if (report?.kind !== "gaep-phase-acceptance-report-v1" || report.evidenceScope !== "phase-3a-codex-readiness-workflow-local" ||
      report.verificationResult !== "pass" || report.phaseGate !== "incomplete" || report.summary?.validationGatesPassed !== 7 ||
      report.summary?.hostsAccepted !== 0 || report.summary?.providersAccepted !== 0) {
    fail("P3A-21 report differs from the exact passing-local incomplete-gate boundary")
  }
  return { scenarioSourceBytes, scenarioBytes, scenario, claude: { bytes: claudeBytes, value: claude },
    codexScenario: { bytes: codexScenarioBytes, value: codexScenario },
    codexWorkflowReceipt: { bytes: codexWorkflowReceiptBytes, value: codexWorkflowReceipt },
    conformance: { bytes: conformanceBytes, value: conformance }, report: { bytes: reportBytes, value: report }, studioBytes }
}

async function expectedOutputs(target, inputs) {
  const candidateChain = buildCandidateChain(inputs.scenario)
  const reopenContinuity = buildReopenContinuity(inputs.scenario, candidateChain)
  const failureRecovery = buildFailureRecovery(inputs.scenario, candidateChain)
  const hostProjections = buildHostProjections(inputs.scenario, inputs.conformance.value, inputs.studioBytes)
  const providerParity = buildProviderParity(inputs.scenario, inputs.codexScenario.value,
    inputs.codexWorkflowReceipt.value, inputs.claude.value)
  const definitions = [
    ["candidate-chain.json", candidateChain, candidateChain.chainDigest],
    ["reopen-continuity.json", reopenContinuity, reopenContinuity.continuityDigest],
    ["failure-recovery.json", failureRecovery, failureRecovery.recoveryDigest],
    ["host-projections.json", hostProjections, hostProjections.hostProjectionDigest],
    ["provider-parity.json", providerParity, providerParity.parityDigest],
  ]
  const outputFiles = {}
  for (const [path, expected, semanticDigest] of definitions) {
    const bytes = await readRegularFile(resolve(target, path), path)
    const actual = parseJson(bytes, path)
    try { assert.deepEqual(actual, expected) } catch { fail(`${path} differs from the exact scenario and source evidence`) }
    outputFiles[path] = { bytes, value: actual, semanticDigest }
  }
  return { candidateChain, reopenContinuity, failureRecovery, hostProjections, providerParity, outputFiles }
}

export async function derivePhase3aClaudeReadinessWorkflowReceipt(artifactDirectory) {
  const target = resolve(artifactDirectory)
  const inputs = await readArtifactInputs(target)
  const outputs = await expectedOutputs(target, inputs)
  const sources = [
    fileBinding("sources/claude-receipt.json", inputs.claude.bytes, inputs.claude.value.summaryDigest),
    fileBinding("sources/codex-parity-scenario.json", inputs.codexScenario.bytes, canonicalDigest(inputs.codexScenario.value)),
    fileBinding("sources/codex-workflow-receipt.json", inputs.codexWorkflowReceipt.bytes,
      inputs.codexWorkflowReceipt.value.compositionDigest),
    fileBinding("sources/phase3a-conformance.json", inputs.conformance.bytes, canonicalDigest(inputs.conformance.value)),
    fileBinding("sources/phase3a-report.json", inputs.report.bytes, inputs.report.value.testsDigest),
    { path: inputs.scenario.sourcePaths.productStudio, bytes: inputs.studioBytes.length, digest: rawDigest(inputs.studioBytes),
      semanticDigest: outputs.hostProjections.productStudio.sourceDigest },
  ]
  const outputBindings = Object.fromEntries(Object.entries(outputs.outputFiles).map(([path, item]) => [path, fileBinding(path, item.bytes, item.semanticDigest)]))
  const summary = {
    stageCount: outputs.candidateChain.summary.stageCount,
    exactCurrentCandidateCount: outputs.candidateChain.summary.exactCurrentCandidateCount,
    implementationReadinessDependencyStageCount: outputs.candidateChain.summary.implementationReadinessDependencyStageCount,
    reopenObservationCount: outputs.reopenContinuity.summary.observationCount,
    continuityMismatchCount: outputs.reopenContinuity.summary.continuityMismatchCount,
    failureRecoveryCaseCount: outputs.failureRecovery.summary.caseCount,
    holdCount: outputs.failureRecovery.summary.holdCount,
    hostProjectionCount: outputs.hostProjections.summary.hostCount,
    productStudioProjectionCount: outputs.hostProjections.summary.productStudioProjectionCount,
    semanticParityMismatchCount: outputs.providerParity.summary.semanticParityMismatchCount,
    claudeExecutionState: inputs.claude.value.summary.execution.state,
    claudeExecutionMode: inputs.claude.value.summary.execution.mode,
    claudeStagingPresent: inputs.claude.value.summary.execution.stagingPresent,
    claudeToolDefinitionCount: inputs.claude.value.summary.execution.toolDefinitionCount,
    claudeWriteScopeCount: inputs.claude.value.summary.execution.writeScopeCount,
    liveProviderRequestCount: 0,
    implementationEffectsApplied: 0,
    hostsAccepted: 0,
    providersAccepted: 0,
    productOwnerAcceptance: "not-established",
    readinessAuthority: "not-established",
  }
  const content = {
    schemaVersion: 1,
    kind: "gaep-phase3a-claude-readiness-workflow-receipt",
    scenario: {
      id: inputs.scenario.id,
      path: "scenario.json",
      sourcePath: "examples/phase-3a-claude-readiness-workflow/scenario.json",
      sourceDigest: rawDigest(inputs.scenarioSourceBytes),
      semanticDigest: canonicalDigest(inputs.scenario),
      product: { id: inputs.scenario.product.id, revision: inputs.scenario.product.revision, digest: canonicalDigest(inputs.scenario.product) },
      initiative: { id: inputs.scenario.initiative.id, revision: inputs.scenario.initiative.revision, digest: canonicalDigest(inputs.scenario.initiative) },
    },
    sources,
    outputs: outputBindings,
    summary,
    summaryDigest: canonicalDigest(summary),
    authority: {
      liveProviderStatus: "not-tested",
      productTruth: "not-established",
      readinessAuthority: "not-established",
      waiverAuthority: "not-granted",
      ownershipAppointment: "not-established",
      nativeHostAcceptance: "not-established",
      productOwnerAcceptance: "not-established",
      securityScan: "skipped-by-product-owner",
      releaseAuthority: "not-granted",
      deploymentAuthority: "not-granted",
      actionAuthority: "not-granted",
      boundary: "phase-3a-claude-readiness-receipt-is-deterministic-offline-tool-free-parity-evidence-not-live-provider-runtime-authentication-policy-semantic-quality-product-truth-readiness-waiver-ownership-native-host-product-owner-security-release-deployment-or-action-authority",
    },
    limitations: phase3aClaudeReadinessWorkflowLimitations,
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

export async function createPhase3aClaudeReadinessWorkflowManifest(artifactDirectory) {
  const target = resolve(artifactDirectory)
  await assertRegularDirectory(target, "artifact directory")
  const entries = (await readdir(target)).sort()
  const withoutManifest = expectedTopLevelEntries.filter((name) => name !== "artifact-manifest.json").sort()
  if (JSON.stringify(entries) !== JSON.stringify(withoutManifest) && JSON.stringify(entries) !== JSON.stringify([...expectedTopLevelEntries].sort())) {
    fail(`artifact directory entries differ; received ${entries.join(", ")}`)
  }
  await assertExactDirectoryEntries(resolve(target, "sources"), expectedSourceEntries, "sources")
  const receipt = await derivePhase3aClaudeReadinessWorkflowReceipt(target)
  const receiptBytes = await readRegularFile(resolve(target, "receipt.json"), "receipt.json")
  const inventory = await inventoryArtifacts(target)
  return {
    schemaVersion: 1,
    kind: "gaep-phase3a-claude-readiness-workflow-artifact-manifest",
    scenario: receipt.scenario,
    receipt: { path: "receipt.json", bytes: receiptBytes.length, digest: rawDigest(receiptBytes), compositionDigest: receipt.compositionDigest },
    inventory,
    authorityBoundary: "artifact-manifest-is-integrity-evidence-not-live-provider-readiness-native-host-product-owner-security-release-or-deployment-authority",
  }
}

export async function verifyPhase3aClaudeReadinessWorkflowArtifactDirectory(artifactDirectory) {
  const target = resolve(artifactDirectory)
  await assertRegularDirectory(target, "artifact directory")
  await assertExactDirectoryEntries(target, expectedTopLevelEntries, "artifact directory")
  await assertExactDirectoryEntries(resolve(target, "sources"), expectedSourceEntries, "sources")
  const receipt = parseJson(await readRegularFile(resolve(target, "receipt.json"), "receipt.json"), "receipt.json")
  const expectedReceipt = await derivePhase3aClaudeReadinessWorkflowReceipt(target)
  try { assert.deepEqual(receipt, expectedReceipt) } catch { fail("receipt.json differs from the exact scenario, sources, chain, continuity, recovery, provider parity, and host projections") }
  const manifest = parseJson(await readRegularFile(resolve(target, "artifact-manifest.json"), "artifact-manifest.json"), "artifact-manifest.json")
  const expectedManifest = await createPhase3aClaudeReadinessWorkflowManifest(target)
  try { assert.deepEqual(manifest, expectedManifest) } catch { fail("artifact-manifest.json differs from the exact artifact inventory") }
  return { receipt, manifest }
}

export async function runPhase3aClaudeReadinessWorkflowArtifacts(path) {
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
  const staging = await mkdtemp(join(parent, ".gaep-phase3a-claude-readiness-"))
  try {
    await mkdir(resolve(staging, "sources"), { mode: 0o700 })
    await copyFile(scenarioSourcePath, resolve(staging, "scenario.json"))
    const scenario = verifyScenario(parseJson(await readFile(scenarioSourcePath), "canonical scenario"))
    await Promise.all([
      copyFile(resolve(repository, scenario.sourcePaths.phase3aConformance), resolve(staging, "sources/phase3a-conformance.json")),
      copyFile(resolve(repository, scenario.sourcePaths.phase3aReport), resolve(staging, "sources/phase3a-report.json")),
      copyFile(codexScenarioSourcePath, resolve(staging, "sources/codex-parity-scenario.json")),
      copyFile(codexWorkflowReceiptSourcePath, resolve(staging, "sources/codex-workflow-receipt.json")),
    ])
    await writeExclusive(resolve(staging, "sources/claude-receipt.json"), await runClaudeP0P4Acceptance())
    const inputs = await readArtifactInputs(staging)
    const candidateChain = buildCandidateChain(inputs.scenario)
    await writeExclusive(resolve(staging, "candidate-chain.json"), candidateChain)
    await writeExclusive(resolve(staging, "reopen-continuity.json"), buildReopenContinuity(inputs.scenario, candidateChain))
    await writeExclusive(resolve(staging, "failure-recovery.json"), buildFailureRecovery(inputs.scenario, candidateChain))
    await writeExclusive(resolve(staging, "host-projections.json"), buildHostProjections(inputs.scenario, inputs.conformance.value, inputs.studioBytes))
    await writeExclusive(resolve(staging, "provider-parity.json"), buildProviderParity(inputs.scenario,
      inputs.codexScenario.value, inputs.codexWorkflowReceipt.value, inputs.claude.value))
    await writeExclusive(resolve(staging, "receipt.json"), await derivePhase3aClaudeReadinessWorkflowReceipt(staging))
    await writeExclusive(resolve(staging, "artifact-manifest.json"), await createPhase3aClaudeReadinessWorkflowManifest(staging))
    await verifyPhase3aClaudeReadinessWorkflowArtifactDirectory(staging)
    await rename(staging, target)
    return verifyPhase3aClaudeReadinessWorkflowArtifactDirectory(target)
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    throw error
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 2 && args[0] === "--artifacts") {
    const { receipt, manifest } = await runPhase3aClaudeReadinessWorkflowArtifacts(args[1])
    process.stdout.write(`${JSON.stringify({ artifactDirectory: resolve(args[1]), scenarioId: receipt.scenario.id,
      stageCount: receipt.summary.stageCount, hostProjectionCount: receipt.summary.hostProjectionCount,
      failureRecoveryCaseCount: receipt.summary.failureRecoveryCaseCount, artifactFileCount: manifest.inventory.fileCount,
      compositionDigest: receipt.compositionDigest }, null, 2)}\n`)
    return
  }
  if (args.length === 1) {
    const { receipt, manifest } = await verifyPhase3aClaudeReadinessWorkflowArtifactDirectory(args[0])
    process.stdout.write(`${JSON.stringify({ valid: true, kind: receipt.kind, scenarioId: receipt.scenario.id,
      stageCount: receipt.summary.stageCount, hostProjectionCount: receipt.summary.hostProjectionCount,
      artifactFileCount: manifest.inventory.fileCount, compositionDigest: receipt.compositionDigest }, null, 2)}\n`)
    return
  }
  throw new Error("Usage: node scripts/phase3a_claude_readiness_workflow_artifacts.mjs [--artifacts] <artifact-directory>")
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
