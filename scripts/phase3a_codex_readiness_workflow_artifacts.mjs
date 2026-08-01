import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { copyFile, lstat, mkdir, mkdtemp, open, readFile, readdir, rename, rm } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { runCodexP0P4Acceptance } from "./run_codex_p0_p4_acceptance.mjs"
import { verifyCodexP0P4ReceiptObject } from "./verify_codex_p0_p4_receipt.mjs"

const repository = fileURLToPath(new URL("..", import.meta.url))
const scenarioSourcePath = resolve(repository, "examples/phase-3a-codex-readiness-workflow/scenario.json")
const fileByteLimit = 4 * 1024 * 1024
const artifactByteLimit = 24 * 1024 * 1024
const artifactFileLimit = 64
const digestPattern = /^sha256:[0-9a-f]{64}$/u
const expectedTopLevelEntries = [
  "artifact-manifest.json",
  "candidate-chain.json",
  "failure-recovery.json",
  "host-projections.json",
  "receipt.json",
  "reopen-continuity.json",
  "scenario.json",
  "sources",
]
const expectedSourceEntries = ["codex-receipt.json", "phase3a-conformance.json", "phase3a-report.json", "product-studio-source.ts"]

export const phase3aCodexReadinessWorkflowLimitations = [
  "This is a deterministic local fixture and not real Product, backlog, design, boilerplate, test, risk, security, or readiness evidence.",
  "Codex execution uses the isolated fake app-server contract and makes no live provider request or semantic-quality claim.",
  "Reopen, recovery, Product Studio, and host projections prove bounded deterministic continuity only and not native-host interaction or acceptance.",
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
  throw new Error(`Invalid Phase 3A Codex readiness workflow artifact: ${message}`)
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
  if (value?.schemaVersion !== 1 || value.kind !== "gaep-phase3a-codex-readiness-workflow-scenario" ||
      value.id !== "phase-3a-atlas-codex-readiness-workflow-v1" ||
      value.authorityBoundary !== "phase-3a-codex-readiness-workflow-is-deterministic-local-candidate-evidence-not-live-provider-product-truth-readiness-waiver-ownership-native-host-product-owner-security-release-deployment-or-action-authority") {
    fail("scenario identity or authority boundary differs")
  }
  if (value.initiative?.productId !== value.product?.id || value.product?.revision !== 1 || value.initiative?.revision !== 1 ||
      value.initiative?.state !== "active") fail("scenario Product and Initiative bindings differ")
  if (value.provider?.adapterId !== "gaep.codex-cli" || value.provider?.agentId !== "codex-cli" ||
      value.provider?.executionMode !== "deterministic-offline-staged-contract" || value.provider?.liveRequestExpected !== false) {
    fail("scenario provider boundary differs")
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
  if (JSON.stringify(value.limitations) !== JSON.stringify(phase3aCodexReadinessWorkflowLimitations)) {
    fail("scenario limitations differ")
  }
  return value
}

function candidateId(index) {
  return `33000000-0000-4000-8000-${String(index + 101).padStart(12, "0")}`
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
    kind: "gaep-phase3a-codex-readiness-candidate-chain",
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
    kind: "gaep-phase3a-codex-readiness-reopen-continuity",
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
    kind: "gaep-phase3a-codex-readiness-failure-recovery",
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
    fail("P3A-20 conformance differs from the exact 96-capability incomplete-acceptance boundary")
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
    kind: "gaep-phase3a-codex-readiness-host-projections",
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

function fileBinding(path, bytes, semanticDigest) {
  assertDigest(semanticDigest, `${path} semantic digest`)
  return { path, bytes: bytes.length, digest: rawDigest(bytes), semanticDigest }
}

async function readArtifactInputs(target) {
  const [scenarioSourceBytes, scenarioBytes, codexBytes, conformanceBytes, reportBytes, studioBytes] = await Promise.all([
    readRegularFile(resolve(target, "scenario.json"), "scenario source snapshot"),
    readRegularFile(resolve(target, "scenario.json"), "scenario.json"),
    readRegularFile(resolve(target, "sources/codex-receipt.json"), "sources/codex-receipt.json"),
    readRegularFile(resolve(target, "sources/phase3a-conformance.json"), "sources/phase3a-conformance.json"),
    readRegularFile(resolve(target, "sources/phase3a-report.json"), "sources/phase3a-report.json"),
    readRegularFile(resolve(target, "sources/product-studio-source.ts"), "Product Studio source snapshot"),
  ])
  const scenario = verifyScenario(parseJson(scenarioBytes, "scenario.json"))
  const codex = await verifyCodexP0P4ReceiptObject(parseJson(codexBytes, "sources/codex-receipt.json"))
  const conformance = parseJson(conformanceBytes, "sources/phase3a-conformance.json")
  const report = parseJson(reportBytes, "sources/phase3a-report.json")
  if (report?.kind !== "gaep-phase-acceptance-report-v1" || report.evidenceScope !== "phase-3a-implementation-readiness-gate-local" ||
      report.verificationResult !== "pass" || report.phaseGate !== "incomplete" || report.summary?.validationGatesPassed !== 7 ||
      report.summary?.hostsAccepted !== 0 || report.summary?.providersAccepted !== 0) {
    fail("P3A-20 report differs from the exact passing-local incomplete-gate boundary")
  }
  return { scenarioSourceBytes, scenarioBytes, scenario, codex: { bytes: codexBytes, value: codex },
    conformance: { bytes: conformanceBytes, value: conformance }, report: { bytes: reportBytes, value: report }, studioBytes }
}

async function expectedOutputs(target, inputs) {
  const candidateChain = buildCandidateChain(inputs.scenario)
  const reopenContinuity = buildReopenContinuity(inputs.scenario, candidateChain)
  const failureRecovery = buildFailureRecovery(inputs.scenario, candidateChain)
  const hostProjections = buildHostProjections(inputs.scenario, inputs.conformance.value, inputs.studioBytes)
  const definitions = [
    ["candidate-chain.json", candidateChain, candidateChain.chainDigest],
    ["reopen-continuity.json", reopenContinuity, reopenContinuity.continuityDigest],
    ["failure-recovery.json", failureRecovery, failureRecovery.recoveryDigest],
    ["host-projections.json", hostProjections, hostProjections.hostProjectionDigest],
  ]
  const outputFiles = {}
  for (const [path, expected, semanticDigest] of definitions) {
    const bytes = await readRegularFile(resolve(target, path), path)
    const actual = parseJson(bytes, path)
    try { assert.deepEqual(actual, expected) } catch { fail(`${path} differs from the exact scenario and source evidence`) }
    outputFiles[path] = { bytes, value: actual, semanticDigest }
  }
  return { candidateChain, reopenContinuity, failureRecovery, hostProjections, outputFiles }
}

export async function derivePhase3aCodexReadinessWorkflowReceipt(artifactDirectory) {
  const target = resolve(artifactDirectory)
  const inputs = await readArtifactInputs(target)
  const outputs = await expectedOutputs(target, inputs)
  const sources = [
    fileBinding("sources/codex-receipt.json", inputs.codex.bytes, inputs.codex.value.summaryDigest),
    fileBinding("sources/phase3a-conformance.json", inputs.conformance.bytes, canonicalDigest(inputs.conformance.value)),
    fileBinding("sources/phase3a-report.json", inputs.report.bytes, inputs.report.value.testsDigest),
    { path: "sources/product-studio-source.ts", bytes: inputs.studioBytes.length, digest: rawDigest(inputs.studioBytes),
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
    codexExecutionState: inputs.codex.value.summary.execution.state,
    codexStagingChangeCount: inputs.codex.value.summary.execution.stagingChangeCount,
    liveProviderRequestCount: 0,
    implementationEffectsApplied: 0,
    hostsAccepted: 0,
    providersAccepted: 0,
    productOwnerAcceptance: "not-established",
    readinessAuthority: "not-established",
  }
  const content = {
    schemaVersion: 1,
    kind: "gaep-phase3a-codex-readiness-workflow-receipt",
    scenario: {
      id: inputs.scenario.id,
      path: "scenario.json",
      sourcePath: "examples/phase-3a-codex-readiness-workflow/scenario.json",
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
      boundary: "phase-3a-codex-readiness-receipt-is-deterministic-local-candidate-evidence-not-live-provider-product-truth-readiness-waiver-ownership-native-host-product-owner-security-release-deployment-or-action-authority",
    },
    limitations: phase3aCodexReadinessWorkflowLimitations,
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

export async function createPhase3aCodexReadinessWorkflowManifest(artifactDirectory) {
  const target = resolve(artifactDirectory)
  await assertRegularDirectory(target, "artifact directory")
  const entries = (await readdir(target)).sort()
  const withoutManifest = expectedTopLevelEntries.filter((name) => name !== "artifact-manifest.json").sort()
  if (JSON.stringify(entries) !== JSON.stringify(withoutManifest) && JSON.stringify(entries) !== JSON.stringify([...expectedTopLevelEntries].sort())) {
    fail(`artifact directory entries differ; received ${entries.join(", ")}`)
  }
  await assertExactDirectoryEntries(resolve(target, "sources"), expectedSourceEntries, "sources")
  const receipt = await derivePhase3aCodexReadinessWorkflowReceipt(target)
  const receiptBytes = await readRegularFile(resolve(target, "receipt.json"), "receipt.json")
  const inventory = await inventoryArtifacts(target)
  return {
    schemaVersion: 1,
    kind: "gaep-phase3a-codex-readiness-workflow-artifact-manifest",
    scenario: receipt.scenario,
    receipt: { path: "receipt.json", bytes: receiptBytes.length, digest: rawDigest(receiptBytes), compositionDigest: receipt.compositionDigest },
    inventory,
    authorityBoundary: "artifact-manifest-is-integrity-evidence-not-live-provider-readiness-native-host-product-owner-security-release-or-deployment-authority",
  }
}

export async function verifyPhase3aCodexReadinessWorkflowArtifactDirectory(artifactDirectory) {
  const target = resolve(artifactDirectory)
  await assertRegularDirectory(target, "artifact directory")
  await assertExactDirectoryEntries(target, expectedTopLevelEntries, "artifact directory")
  await assertExactDirectoryEntries(resolve(target, "sources"), expectedSourceEntries, "sources")
  const receipt = parseJson(await readRegularFile(resolve(target, "receipt.json"), "receipt.json"), "receipt.json")
  const expectedReceipt = await derivePhase3aCodexReadinessWorkflowReceipt(target)
  try { assert.deepEqual(receipt, expectedReceipt) } catch { fail("receipt.json differs from the exact scenario, sources, chain, continuity, recovery, and host projections") }
  const manifest = parseJson(await readRegularFile(resolve(target, "artifact-manifest.json"), "artifact-manifest.json"), "artifact-manifest.json")
  const expectedManifest = await createPhase3aCodexReadinessWorkflowManifest(target)
  try { assert.deepEqual(manifest, expectedManifest) } catch { fail("artifact-manifest.json differs from the exact artifact inventory") }
  return { receipt, manifest }
}

export async function runPhase3aCodexReadinessWorkflowArtifacts(path) {
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
  const staging = await mkdtemp(join(parent, ".gaep-phase3a-codex-readiness-"))
  try {
    await mkdir(resolve(staging, "sources"), { mode: 0o700 })
    await copyFile(scenarioSourcePath, resolve(staging, "scenario.json"))
    const scenario = verifyScenario(parseJson(await readFile(scenarioSourcePath), "canonical scenario"))
    await Promise.all([
      copyFile(resolve(repository, scenario.sourcePaths.phase3aConformance), resolve(staging, "sources/phase3a-conformance.json")),
      copyFile(resolve(repository, scenario.sourcePaths.phase3aReport), resolve(staging, "sources/phase3a-report.json")),
      copyFile(resolve(repository, scenario.sourcePaths.productStudio), resolve(staging, "sources/product-studio-source.ts")),
    ])
    await writeExclusive(resolve(staging, "sources/codex-receipt.json"), await runCodexP0P4Acceptance())
    const inputs = await readArtifactInputs(staging)
    const candidateChain = buildCandidateChain(inputs.scenario)
    await writeExclusive(resolve(staging, "candidate-chain.json"), candidateChain)
    await writeExclusive(resolve(staging, "reopen-continuity.json"), buildReopenContinuity(inputs.scenario, candidateChain))
    await writeExclusive(resolve(staging, "failure-recovery.json"), buildFailureRecovery(inputs.scenario, candidateChain))
    await writeExclusive(resolve(staging, "host-projections.json"), buildHostProjections(inputs.scenario, inputs.conformance.value, inputs.studioBytes))
    await writeExclusive(resolve(staging, "receipt.json"), await derivePhase3aCodexReadinessWorkflowReceipt(staging))
    await writeExclusive(resolve(staging, "artifact-manifest.json"), await createPhase3aCodexReadinessWorkflowManifest(staging))
    await verifyPhase3aCodexReadinessWorkflowArtifactDirectory(staging)
    await rename(staging, target)
    return verifyPhase3aCodexReadinessWorkflowArtifactDirectory(target)
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    throw error
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 2 && args[0] === "--artifacts") {
    const { receipt, manifest } = await runPhase3aCodexReadinessWorkflowArtifacts(args[1])
    process.stdout.write(`${JSON.stringify({ artifactDirectory: resolve(args[1]), scenarioId: receipt.scenario.id,
      stageCount: receipt.summary.stageCount, hostProjectionCount: receipt.summary.hostProjectionCount,
      failureRecoveryCaseCount: receipt.summary.failureRecoveryCaseCount, artifactFileCount: manifest.inventory.fileCount,
      compositionDigest: receipt.compositionDigest }, null, 2)}\n`)
    return
  }
  if (args.length === 1) {
    const { receipt, manifest } = await verifyPhase3aCodexReadinessWorkflowArtifactDirectory(args[0])
    process.stdout.write(`${JSON.stringify({ valid: true, kind: receipt.kind, scenarioId: receipt.scenario.id,
      stageCount: receipt.summary.stageCount, hostProjectionCount: receipt.summary.hostProjectionCount,
      artifactFileCount: manifest.inventory.fileCount, compositionDigest: receipt.compositionDigest }, null, 2)}\n`)
    return
  }
  throw new Error("Usage: node scripts/phase3a_codex_readiness_workflow_artifacts.mjs [--artifacts] <artifact-directory>")
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
