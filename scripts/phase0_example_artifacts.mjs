import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { lstat, readFile, readdir } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { DeterministicManualAdapter, canonicalDigest } from "@gaep/agent-sdk"
import { GaepEngine } from "@gaep/engine"

import { verifyPhase0ExampleReceiptFile } from "./verify_phase0_example_receipt.mjs"

const manifestByteLimit = 512 * 1024
const storeFileLimit = 512
const storeFileByteLimit = 2 * 1024 * 1024
const storeByteLimit = 16 * 1024 * 1024
const expectedArtifactEntries = ["artifact-manifest.json", "receipt.json", "workspace"]
const expectedWorkspaceEntries = [".gaep"]

function fail(message) {
  throw new Error(`Invalid Phase 0 example artifact directory: ${message}`)
}

function rawDigest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

async function assertRegularDirectory(path, label) {
  const stat = await lstat(path)
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail(`${label} must be a regular directory`)
}

async function readRegularFile(path, label, byteLimit) {
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`${label} must be a regular file`)
  if (stat.size < 2 || stat.size > byteLimit) fail(`${label} must be between 2 and ${byteLimit} bytes`)
  return readFile(path)
}

async function assertExactDirectoryEntries(path, expected, label) {
  const actual = (await readdir(path)).sort()
  const wanted = [...expected].sort()
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${label} entries differ; expected ${wanted.join(", ")}, received ${actual.join(", ")}`)
  }
}

async function inspectStore(storeRoot) {
  await assertRegularDirectory(storeRoot, "workspace/.gaep")
  const entries = []
  let byteCount = 0

  async function walk(directory, segments) {
    const names = (await readdir(directory)).sort()
    for (const name of names) {
      if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\\")) {
        fail("workspace/.gaep contains an invalid entry name")
      }
      const path = resolve(directory, name)
      const stat = await lstat(path)
      if (stat.isSymbolicLink()) fail(`workspace/.gaep/${[...segments, name].join("/")} must not be a symbolic link`)
      if (stat.isDirectory()) {
        await walk(path, [...segments, name])
        continue
      }
      if (!stat.isFile()) fail(`workspace/.gaep/${[...segments, name].join("/")} must be a regular file`)
      if (stat.size < 2 || stat.size > storeFileByteLimit) {
        fail(`workspace/.gaep/${[...segments, name].join("/")} exceeds its file-size boundary`)
      }
      if (entries.length >= storeFileLimit) fail(`workspace/.gaep exceeds ${storeFileLimit} files`)
      byteCount += stat.size
      if (byteCount > storeByteLimit) fail(`workspace/.gaep exceeds ${storeByteLimit} bytes`)
      const bytes = await readFile(path)
      entries.push({
        path: [...segments, name].join("/"),
        bytes: stat.size,
        digest: rawDigest(bytes),
      })
    }
  }

  await walk(storeRoot, [])
  if (entries.length === 0) fail("workspace/.gaep must contain portable records")
  return {
    root: "workspace/.gaep",
    fileCount: entries.length,
    byteCount,
    entries,
    inventoryDigest: canonicalDigest(entries),
  }
}

async function inspectPortableStore(workspace, receipt) {
  const engine = new GaepEngine(workspace, [new DeterministicManualAdapter()])
  const [audit, inventory, runs, handoffs, selection] = await Promise.all([
    engine.repository.verifyAudit(),
    engine.listManagedRunsPage({ offset: 0, limit: 10 }),
    engine.listRuns(),
    engine.listHandoffs(),
    engine.readSelectionState(),
  ])
  const record = await engine.readManagedRun(receipt.portableRun.managedRunId)
  if (!record.resultId) fail("stored Managed Run does not bind a result")
  const result = await engine.readManagedRunResult(record.resultId)
  const evidence = await engine.readManagedRunEvidence(result.evidenceId)
  const run = runs.find((entry) => entry.id === receipt.portableRun.runId)
  const handoff = handoffs.find((entry) => entry.fromRunId === receipt.portableRun.runId)

  const checks = {
    auditValid: audit.valid === true && audit.events === receipt.integrity.auditEventCount,
    inventoryMatches: inventory.total === receipt.integrity.inventoryCount &&
      inventory.snapshotDigest === receipt.integrity.inventorySnapshotDigest,
    managedResultMatches: record.resultDigest === receipt.portableRun.resultDigest &&
      record.resultDigest === canonicalDigest(result),
    managedEvidenceMatches: result.evidenceDigest === receipt.portableRun.evidenceDigest &&
      result.evidenceDigest === canonicalDigest(evidence) &&
      evidence.eventsDigest === canonicalDigest(evidence.events),
    runMatches: run !== undefined && run.state === "completed" &&
      record.runId === receipt.portableRun.runId && record.bindings.run.recordId === run.id,
    handoffMatches: handoff !== undefined && receipt.agentModel.handoffs.length === 1 &&
      receipt.agentModel.handoffs[0].fromRun.recordId === handoff.fromRunId,
    selectionMatches: selection.status === "selected" &&
      receipt.agentModel.selection.status === "selected" &&
      receipt.agentModel.selection.selectionDigest === canonicalDigest(selection.selection),
  }
  for (const [name, valid] of Object.entries(checks)) {
    if (!valid) fail(`stored portable runtime check failed: ${name}`)
  }
  return {
    auditEventCount: audit.events,
    managedInventoryCount: inventory.total,
    inventorySnapshotDigest: inventory.snapshotDigest,
    runCount: runs.length,
    handoffCount: handoffs.length,
    selectionStatus: selection.status,
    checks,
  }
}

async function buildManifest(artifactDirectory) {
  const target = resolve(artifactDirectory)
  const workspace = resolve(target, "workspace")
  const receiptPath = resolve(target, "receipt.json")
  await assertRegularDirectory(target, "artifact directory")
  await assertRegularDirectory(workspace, "workspace")
  await assertExactDirectoryEntries(workspace, expectedWorkspaceEntries, "workspace")
  const receiptBytes = await readRegularFile(receiptPath, "receipt.json", 128 * 1024)
  const receipt = await verifyPhase0ExampleReceiptFile(receiptPath)
  const store = await inspectStore(resolve(workspace, ".gaep"))
  const portableStore = await inspectPortableStore(workspace, receipt)
  return {
    schemaVersion: 1,
    kind: "gaep-phase0-example-artifact-manifest",
    scenario: receipt.scenario,
    portableRun: {
      runId: receipt.portableRun.runId,
      managedRunId: receipt.portableRun.managedRunId,
    },
    receipt: {
      path: "receipt.json",
      bytes: receiptBytes.length,
      digest: rawDigest(receiptBytes),
      summaryDigest: receipt.summaryDigest,
    },
    store,
    portableStore,
    authorityBoundary: "artifact-manifest-is-integrity-evidence-not-runtime-effect-readiness-or-acceptance-authority",
  }
}

export async function createPhase0ExampleArtifactManifest(artifactDirectory) {
  const target = resolve(artifactDirectory)
  await assertExactDirectoryEntries(target, ["receipt.json", "workspace"], "new artifact directory")
  return buildManifest(target)
}

export async function verifyPhase0ExampleArtifactDirectory(artifactDirectory) {
  const target = resolve(artifactDirectory)
  await assertRegularDirectory(target, "artifact directory")
  await assertExactDirectoryEntries(target, expectedArtifactEntries, "artifact directory")
  const manifestBytes = await readRegularFile(
    resolve(target, "artifact-manifest.json"),
    "artifact-manifest.json",
    manifestByteLimit,
  )
  let manifest
  try {
    manifest = JSON.parse(manifestBytes.toString("utf8"))
  } catch {
    fail("artifact-manifest.json must contain valid JSON")
  }
  const expected = await buildManifest(target)
  try {
    assert.deepEqual(manifest, expected)
  } catch {
    fail("artifact-manifest.json differs from the exact receipt and portable store")
  }
  return manifest
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 1) throw new Error("Usage: node scripts/phase0_example_artifacts.mjs <artifact-directory>")
  const manifest = await verifyPhase0ExampleArtifactDirectory(args[0])
  process.stdout.write(`${JSON.stringify({
    valid: true,
    kind: manifest.kind,
    scenarioId: manifest.scenario.id,
    summaryDigest: manifest.receipt.summaryDigest,
    storeFileCount: manifest.store.fileCount,
    storeInventoryDigest: manifest.store.inventoryDigest,
  }, null, 2)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
