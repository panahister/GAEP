import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { lstat, readFile, readdir } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { canonicalDigest } from "@gaep/agent-sdk"
import { GaepEngine } from "@gaep/engine"

import { verifyClaudeP0P4ReceiptFile } from "./verify_claude_p0_p4_receipt.mjs"
import { verifyCodexP0P4ReceiptFile } from "./verify_codex_p0_p4_receipt.mjs"
import { verifyProviderOutputComparisonFile } from "./verify_provider_output_comparison_receipt.mjs"

const repository = fileURLToPath(new URL("..", import.meta.url))
const sourceScenarioPath = resolve(repository, "examples/phase-1-realistic-reference/scenario.json")
const receiptByteLimit = 512 * 1024
const manifestByteLimit = 1024 * 1024
const artifactFileLimit = 2_048
const artifactFileByteLimit = 4 * 1024 * 1024
const artifactByteLimit = 64 * 1024 * 1024
const digestPattern = /^sha256:[0-9a-f]{64}$/
const expectedTopLevelEntries = [
  "artifact-manifest.json",
  "output-catalog.json",
  "providers",
  "receipt.json",
  "scenario.json",
  "workspaces",
]
const expectedProviderEntries = ["claude-receipt.json", "codex-receipt.json", "comparison-receipt.json"]
const expectedWorkspaceEntries = ["claude", "codex"]

export const realisticReferenceLimitations = [
  "The artifact exercises a deterministic realistic reference Product, not a real Product baseline, production dataset, readiness decision, or Product Owner acceptance.",
  "Codex and Claude use local fixtures; live authentication, entitlement, reachability, semantic quality, reliability, latency, usage, and cost remain untested.",
  "The portable stores make governed records inspectable, but native IDE installation, interaction, rendering, accessibility, and supported-host acceptance remain outside this artifact.",
  "The Product Owner explicitly skipped the interrupted Codex Security scan; the artifact is not security assurance or a security result.",
]

function fail(message) {
  throw new Error(`Invalid Phase 1 realistic reference artifact: ${message}`)
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

async function readRegularFile(path, label, byteLimit = artifactFileByteLimit) {
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

function verifyScenario(scenario) {
  if (scenario?.schemaVersion !== 1 || scenario.kind !== "gaep-phase1-realistic-reference-scenario" ||
      scenario.id !== "phase-1-atlas-release-readiness-v1") {
    fail("scenario identity differs")
  }
  if (scenario.product?.name !== "Atlas Release Readiness" ||
      scenario.initiative?.title !== "Review the Atlas release evidence packet") {
    fail("scenario Product or Initiative identity differs")
  }
  if (!Array.isArray(scenario.expectedP0P4Outputs) || scenario.expectedP0P4Outputs.length !== 25 ||
      new Set(scenario.expectedP0P4Outputs).size !== 25) {
    fail("scenario must declare 25 unique P0-P4 output kinds")
  }
  if (scenario.authorityBoundary !==
      "realistic-reference-scenario-does-not-establish-product-baseline-readiness-approval-acceptance-phase-entry-release-deployment-or-action-authority") {
    fail("scenario authority boundary differs")
  }
  return scenario
}

function buildOutputCatalog(scenario, codex, claude) {
  const scenarioDigest = canonicalDigest(scenario)
  for (const [label, receipt] of [["Codex", codex], ["Claude", claude]]) {
    const reference = receipt.summary.referenceScenario
    if (reference.id !== scenario.id || reference.digest !== scenarioDigest ||
        JSON.stringify(reference.outputKinds) !== JSON.stringify(scenario.expectedP0P4Outputs)) {
      fail(`${label} receipt is not bound to the exact realistic reference scenario and output catalog`)
    }
  }
  const content = {
    schemaVersion: 1,
    kind: "gaep-phase1-realistic-reference-output-catalog",
    scenario: {
      id: scenario.id,
      digest: scenarioDigest,
      productName: scenario.product.name,
      initiativeTitle: scenario.initiative.title,
    },
    providers: {
      codexSummaryDigest: codex.summaryDigest,
      claudeSummaryDigest: claude.summaryDigest,
    },
    outputs: scenario.expectedP0P4Outputs.map((outputKind, index) => ({
      ordinal: index + 1,
      outputKind,
      codexEvidence: "represented",
      claudeEvidence: "represented",
    })),
    counts: {
      outputCount: 25,
      codexRepresentedCount: 25,
      claudeRepresentedCount: 25,
    },
    authorityBoundary: "output-catalog-is-inspectable-local-evidence-not-readiness-approval-acceptance-phase-entry-or-action-authority",
  }
  return { ...content, catalogDigest: canonicalDigest(content) }
}

async function verifyOutputCatalogFile(path, scenario, codex, claude) {
  const bytes = await readRegularFile(path, "output-catalog.json", receiptByteLimit)
  const catalog = parseJson(bytes, "output-catalog.json")
  const expected = buildOutputCatalog(scenario, codex, claude)
  try {
    assert.deepEqual(catalog, expected)
  } catch {
    fail("output-catalog.json differs from the exact scenario and provider receipts")
  }
  assertDigest(catalog.catalogDigest, "output-catalog.json catalogDigest")
  return { bytes, catalog }
}

async function inspectStore(workspace, provider, scenario) {
  await assertRegularDirectory(workspace, `${provider} workspace`)
  await assertExactDirectoryEntries(workspace, [".gaep"], `${provider} workspace`)
  const storeRoot = resolve(workspace, ".gaep")
  await assertRegularDirectory(storeRoot, `${provider} workspace/.gaep`)

  const entries = []
  let byteCount = 0
  async function walk(directory, segments) {
    for (const name of (await readdir(directory)).sort()) {
      if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\\")) {
        fail(`${provider} store contains an invalid entry name`)
      }
      const path = resolve(directory, name)
      const stat = await lstat(path)
      const relativePath = [...segments, name].join("/")
      if (stat.isSymbolicLink()) fail(`${provider} workspace/.gaep/${relativePath} must not be a symbolic link`)
      if (stat.isDirectory()) {
        await walk(path, [...segments, name])
        continue
      }
      if (!stat.isFile()) fail(`${provider} workspace/.gaep/${relativePath} must be a regular file`)
      if (stat.size < 2 || stat.size > artifactFileByteLimit) {
        fail(`${provider} workspace/.gaep/${relativePath} exceeds its file-size boundary`)
      }
      if (entries.length >= artifactFileLimit) fail(`${provider} store exceeds ${artifactFileLimit} files`)
      byteCount += stat.size
      if (byteCount > artifactByteLimit) fail(`${provider} store exceeds ${artifactByteLimit} bytes`)
      const bytes = await readFile(path)
      entries.push({ path: relativePath, bytes: stat.size, digest: rawDigest(bytes) })
    }
  }
  await walk(storeRoot, [])
  if (entries.length === 0) fail(`${provider} store must contain governed records`)

  const initiativeFiles = (await readdir(resolve(storeRoot, "initiatives"))).filter((name) => name.endsWith(".json"))
  if (initiativeFiles.length !== 1) fail(`${provider} store must contain exactly one current Initiative`)
  const initiativeRecord = parseJson(
    await readRegularFile(resolve(storeRoot, "initiatives", initiativeFiles[0]), `${provider} Initiative`),
    `${provider} Initiative`,
  )
  const engine = new GaepEngine(workspace, [])
  const [health, audit, product, initiative, readiness, handoff, managedRuns, runs] = await Promise.all([
    engine.workspaceHealth(),
    engine.repository.verifyAudit(),
    engine.readProduct(),
    engine.readInitiative(initiativeRecord.id),
    engine.p0P4ReadinessGate.assess(initiativeRecord.id),
    engine.p5HandoffPackage.assess(initiativeRecord.id),
    engine.listManagedRunsPage({ offset: 0, limit: 10 }),
    engine.listRuns(),
  ])
  const checks = {
    workspaceHealthy: health.status === "healthy",
    auditValid: audit.valid === true,
    productMatches: product.name === scenario.product.name,
    initiativeMatches: initiative.title === scenario.initiative.title && initiative.state === "active",
    readinessMatches: readiness.result === "passed" && readiness.outputCount === 25 &&
      readiness.applicableOutputCount === 3 && readiness.notApplicableOutputCount === 22,
    handoffMatches: handoff.state === "complete-for-review" && handoff.itemCount === 25 &&
      handoff.includedItemCount === 3 && handoff.omittedNotApplicableItemCount === 22,
    managedRunMatches: managedRuns.total === 1 && managedRuns.items[0]?.state === "completed",
    runMatches: runs.length === 1 && runs[0]?.state === "completed",
  }
  for (const [name, valid] of Object.entries(checks)) {
    if (!valid) fail(`${provider} portable store check failed: ${name}`)
  }
  return {
    root: `workspaces/${provider}/.gaep`,
    fileCount: entries.length,
    byteCount,
    inventoryDigest: canonicalDigest(entries),
    productDigest: canonicalDigest(product),
    initiativeDigest: canonicalDigest(initiative),
    auditEventCount: audit.events,
    managedRunCount: managedRuns.total,
    runCount: runs.length,
    readiness: {
      result: readiness.result,
      outputCount: readiness.outputCount,
      applicableOutputCount: readiness.applicableOutputCount,
      notApplicableOutputCount: readiness.notApplicableOutputCount,
    },
    handoff: {
      state: handoff.state,
      itemCount: handoff.itemCount,
      includedItemCount: handoff.includedItemCount,
      omittedNotApplicableItemCount: handoff.omittedNotApplicableItemCount,
    },
    checks,
  }
}

function fileBinding(path, bytes, receipt, mode) {
  return {
    path,
    bytes: bytes.length,
    digest: rawDigest(bytes),
    summaryDigest: receipt.summaryDigest,
    mode,
  }
}

export async function derivePhase1RealisticReferenceReceipt(artifactDirectory) {
  const target = resolve(artifactDirectory)
  const sourceScenarioBytes = await readRegularFile(sourceScenarioPath, "canonical scenario source", receiptByteLimit)
  const scenarioBytes = await readRegularFile(resolve(target, "scenario.json"), "scenario.json", receiptByteLimit)
  if (rawDigest(scenarioBytes) !== rawDigest(sourceScenarioBytes)) {
    fail("scenario.json differs from the canonical repository scenario")
  }
  const scenario = verifyScenario(parseJson(scenarioBytes, "scenario.json"))
  const codexPath = resolve(target, "providers/codex-receipt.json")
  const claudePath = resolve(target, "providers/claude-receipt.json")
  const comparisonPath = resolve(target, "providers/comparison-receipt.json")
  const [codexBytes, claudeBytes, comparisonBytes, codex, claude, comparison] = await Promise.all([
    readRegularFile(codexPath, "providers/codex-receipt.json", receiptByteLimit),
    readRegularFile(claudePath, "providers/claude-receipt.json", receiptByteLimit),
    readRegularFile(comparisonPath, "providers/comparison-receipt.json", receiptByteLimit),
    verifyCodexP0P4ReceiptFile(codexPath),
    verifyClaudeP0P4ReceiptFile(claudePath),
    verifyProviderOutputComparisonFile(comparisonPath, { root: target }),
  ])
  const { bytes: catalogBytes, catalog } = await verifyOutputCatalogFile(
    resolve(target, "output-catalog.json"), scenario, codex, claude,
  )
  const [codexStore, claudeStore] = await Promise.all([
    inspectStore(resolve(target, "workspaces/codex"), "codex", scenario),
    inspectStore(resolve(target, "workspaces/claude"), "claude", scenario),
  ])
  if (comparison.inputs.codex.path !== "providers/codex-receipt.json" ||
      comparison.inputs.claude.path !== "providers/claude-receipt.json" ||
      comparison.comparison.summary.structuralResult !== "satisfied" ||
      comparison.comparison.summary.materialDivergenceCount !== 0) {
    fail("provider comparison is not the exact artifact-local satisfied structural comparison")
  }
  const content = {
    schemaVersion: 1,
    kind: "gaep-phase1-realistic-reference-receipt",
    scenario: {
      id: scenario.id,
      path: "scenario.json",
      sourcePath: "examples/phase-1-realistic-reference/scenario.json",
      sourceDigest: rawDigest(sourceScenarioBytes),
      semanticDigest: canonicalDigest(scenario),
      productName: scenario.product.name,
      initiativeTitle: scenario.initiative.title,
    },
    providers: {
      codex: fileBinding("providers/codex-receipt.json", codexBytes, codex, codex.summary.execution.mode),
      claude: fileBinding("providers/claude-receipt.json", claudeBytes, claude, claude.summary.execution.mode),
      comparison: {
        path: "providers/comparison-receipt.json",
        bytes: comparisonBytes.length,
        digest: rawDigest(comparisonBytes),
        comparisonDigest: comparison.comparisonDigest,
        structuralResult: comparison.comparison.summary.structuralResult,
        structuralCriteriaSatisfied: comparison.comparison.summary.structuralCriteriaSatisfied,
        semanticQuality: comparison.comparison.summary.semanticQuality,
        liveProviderQuality: comparison.comparison.summary.liveProviderQuality,
      },
    },
    outputCatalog: {
      path: "output-catalog.json",
      bytes: catalogBytes.length,
      digest: rawDigest(catalogBytes),
      catalogDigest: catalog.catalogDigest,
      outputCount: catalog.counts.outputCount,
    },
    stores: { codex: codexStore, claude: claudeStore },
    summary: {
      governedRecordCountPerProvider: 21,
      p0P4OutputCount: 25,
      inspectableStoreCount: 2,
      completedManagedRunCount: codexStore.managedRunCount + claudeStore.managedRunCount,
      structuralCriteriaSatisfied: comparison.comparison.summary.structuralCriteriaSatisfied,
      materialDivergenceCount: comparison.comparison.summary.materialDivergenceCount,
      productOwnerAcceptance: "not-established",
      readinessAuthority: "not-established",
    },
    authority: {
      productOwnerAcceptance: "not-established",
      readinessAuthority: "not-established",
      liveProviderAcceptance: "not-established",
      nativeHostAcceptance: "not-established",
      securityScan: "skipped-by-product-owner",
      releaseAuthority: "not-granted",
      deploymentAuthority: "not-granted",
      boundary: "realistic-reference-receipt-is-local-inspectable-evidence-not-product-baseline-readiness-approval-acceptance-security-release-deployment-or-action-authority",
    },
    limitations: realisticReferenceLimitations,
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
      if (stat.size < 2 || stat.size > artifactFileByteLimit) fail(`${relativePath} exceeds its file-size boundary`)
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

export async function createPhase1RealisticReferenceManifest(artifactDirectory) {
  const target = resolve(artifactDirectory)
  await assertRegularDirectory(target, "artifact directory")
  const topLevelEntries = (await readdir(target)).sort()
  const withoutManifest = expectedTopLevelEntries.filter((name) => name !== "artifact-manifest.json").sort()
  const withManifest = [...expectedTopLevelEntries].sort()
  if (JSON.stringify(topLevelEntries) !== JSON.stringify(withoutManifest) &&
      JSON.stringify(topLevelEntries) !== JSON.stringify(withManifest)) {
    fail(`artifact directory entries differ; received ${topLevelEntries.join(", ")}`)
  }
  await assertExactDirectoryEntries(resolve(target, "providers"), expectedProviderEntries, "providers")
  await assertExactDirectoryEntries(resolve(target, "workspaces"), expectedWorkspaceEntries, "workspaces")
  const receipt = await derivePhase1RealisticReferenceReceipt(target)
  const receiptBytes = await readRegularFile(resolve(target, "receipt.json"), "receipt.json", receiptByteLimit)
  const inventory = await inventoryArtifacts(target)
  return {
    schemaVersion: 1,
    kind: "gaep-phase1-realistic-reference-artifact-manifest",
    scenario: receipt.scenario,
    receipt: {
      path: "receipt.json",
      bytes: receiptBytes.length,
      digest: rawDigest(receiptBytes),
      compositionDigest: receipt.compositionDigest,
    },
    inventory,
    stores: receipt.stores,
    authorityBoundary: "artifact-manifest-is-integrity-evidence-not-product-readiness-approval-acceptance-security-release-or-deployment-authority",
  }
}

export async function verifyPhase1RealisticReferenceArtifactDirectory(artifactDirectory) {
  const target = resolve(artifactDirectory)
  await assertRegularDirectory(target, "artifact directory")
  await assertExactDirectoryEntries(target, expectedTopLevelEntries, "artifact directory")
  await assertExactDirectoryEntries(resolve(target, "providers"), expectedProviderEntries, "providers")
  await assertExactDirectoryEntries(resolve(target, "workspaces"), expectedWorkspaceEntries, "workspaces")

  const receiptBytes = await readRegularFile(resolve(target, "receipt.json"), "receipt.json", receiptByteLimit)
  const receipt = parseJson(receiptBytes, "receipt.json")
  const expectedReceipt = await derivePhase1RealisticReferenceReceipt(target)
  try {
    assert.deepEqual(receipt, expectedReceipt)
  } catch {
    fail("receipt.json differs from the exact scenario, providers, output catalog, and stores")
  }
  assertDigest(receipt.compositionDigest, "receipt.json compositionDigest")

  const manifestBytes = await readRegularFile(
    resolve(target, "artifact-manifest.json"), "artifact-manifest.json", manifestByteLimit,
  )
  const manifest = parseJson(manifestBytes, "artifact-manifest.json")
  const expectedManifest = await createPhase1RealisticReferenceManifest(target)
  try {
    assert.deepEqual(manifest, expectedManifest)
  } catch {
    fail("artifact-manifest.json differs from the exact artifact inventory")
  }
  return { receipt, manifest }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 1) throw new Error("Usage: node scripts/phase1_realistic_reference_artifacts.mjs <artifact-directory>")
  const { receipt, manifest } = await verifyPhase1RealisticReferenceArtifactDirectory(args[0])
  process.stdout.write(`${JSON.stringify({
    valid: true,
    kind: receipt.kind,
    scenarioId: receipt.scenario.id,
    outputCount: receipt.summary.p0P4OutputCount,
    inspectableStoreCount: receipt.summary.inspectableStoreCount,
    artifactFileCount: manifest.inventory.fileCount,
    compositionDigest: receipt.compositionDigest,
  }, null, 2)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
