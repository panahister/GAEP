import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import test from "node:test"

import { canonicalDigest } from "@gaep/agent-sdk"

import { verifyPhase0ExampleArtifactDirectory } from "./phase0_example_artifacts.mjs"
import { runPhase0Example } from "./run_phase0_example.mjs"
import { verifyPhase0ExampleReceiptFile, verifyPhase0ExampleReceiptObject } from "./verify_phase0_example_receipt.mjs"

const execute = promisify(execFile)
const repository = fileURLToPath(new URL("..", import.meta.url))
const runner = resolve(repository, "scripts/run_phase0_example.mjs")

async function withTemporaryDirectory(run) {
  const directory = await mkdtemp(join(tmpdir(), "gaep-phase0-example-test-"))
  try {
    return await run(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test("repeats the canonical semantic result while keeping generated Run identity honest", async () => {
  const first = await runPhase0Example()
  const second = await runPhase0Example()
  assert.deepEqual(first.summary, second.summary)
  assert.equal(first.summaryDigest, second.summaryDigest)
  assert.equal(first.summaryDigest, first.expectedSummaryDigest)
  assert.notEqual(first.portableRun.runId, second.portableRun.runId)
  assert.notEqual(first.portableRun.managedRunId, second.portableRun.managedRunId)
  assert.equal(first.integrity.auditValid, true)
  assert.equal(first.integrity.recordResultDigestMatches, true)
  assert.equal(first.integrity.resultEvidenceDigestMatches, true)
  assert.equal(first.integrity.evidenceEventsDigestMatches, true)
  assert.equal(first.integrity.dashboardProductDigestMatches, true)
  assert.equal(first.integrity.dashboardCompositionDigestMatches, true)
  assert.equal(first.integrity.changeCatalogSnapshotDigestMatches, true)
  assert.equal(first.integrity.changeImpactSnapshotDigestMatches, true)
  assert.equal(first.integrity.changeImpactProductBindingMatches, true)
  assert.equal(first.integrity.changeImpactChangeBindingMatches, true)
  assert.equal(first.integrity.agentModelSnapshotDigestMatches, true)
  assert.equal(first.integrity.agentModelProductBindingMatches, true)
  assert.equal(first.integrity.agentModelSelectionBindingMatches, true)
  assert.equal(first.integrity.agentModelRunBindingMatches, true)
  assert.equal(first.integrity.agentModelManagedBindingMatches, true)
  assert.equal(first.integrity.agentModelHandoffBindingMatches, true)
  assert.equal(first.dashboard.phase.id, "phase-0-1a-foundation")
  assert.deepEqual(first.dashboard.panels.map((panel) => panel.id), [
    "foundation-summary", "change-impact", "agent-model",
  ])
  assert.deepEqual(first.dashboard.panels.map((panel) => panel.state), ["attention-required", "active", "active"])
  assert.equal(first.changeImpact.catalog.total, 1)
  assert.equal(first.changeImpact.dashboard.workItems.length, 1)
  assert.equal(first.changeImpact.dashboard.changedArtifacts.length, 1)
  assert.equal(first.changeImpact.dashboard.effectTargets.length, 1)
  assert.equal(first.changeImpact.dashboard.affectedUnits.length, 2)
  assert.equal(first.changeImpact.dashboard.governance.decisions.length, 1)
  assert.equal(first.changeImpact.dashboard.governance.risks.length, 1)
  assert.equal(first.changeImpact.dashboard.freshness.state, "current")
  assert.equal(first.changeImpact.dashboard.governance.approval.state, "not-established")
  assert.equal(first.changeImpact.dashboard.limits.truncated, false)
  assert.equal(first.agentModel.capabilities.length, 1)
  assert.equal(first.agentModel.selection.status, "selected")
  assert.equal(first.agentModel.selection.capabilityState, "current")
  assert.equal(first.agentModel.runs.length, 1)
  assert.equal(first.agentModel.runs[0].managed.status, "observed")
  assert.equal(first.agentModel.runs[0].managed.result.status, "bound")
  assert.equal(first.agentModel.handoffs.length, 1)
  assert.equal(first.agentModel.providerMetrics.usage.state, "unavailable")
  assert.equal(first.agentModel.providerMetrics.cost.state, "unavailable")
  assert.equal(first.agentModel.freshness.state, "current")
  assert.equal(first.agentModel.limits.truncated, false)
})

test("creates a new inspectable artifact directory without exposing private runtime data", async () => {
  await withTemporaryDirectory(async (directory) => {
    const artifacts = join(directory, "artifacts")
    const { stdout, stderr } = await execute(process.execPath, [runner, "--artifacts", artifacts], {
      cwd: repository,
      maxBuffer: 512 * 1024,
    })
    assert.equal(stderr, "")
    const stdoutReceipt = JSON.parse(stdout)
    const receipt = await verifyPhase0ExampleReceiptFile(join(artifacts, "receipt.json"))
    const manifest = await verifyPhase0ExampleArtifactDirectory(artifacts)
    assert.deepEqual(stdoutReceipt, receipt)
    assert.equal(manifest.scenario.digest, receipt.scenario.digest)
    assert.equal(manifest.receipt.summaryDigest, receipt.summaryDigest)
    assert.equal(manifest.portableStore.checks.auditValid, true)
    assert.equal(manifest.portableStore.checks.managedResultMatches, true)
    assert.equal(manifest.portableStore.checks.managedEvidenceMatches, true)
    assert.equal(manifest.store.fileCount > 0, true)
    assert.equal(manifest.store.entries.length, manifest.store.fileCount)
    const workspace = await lstat(join(artifacts, "workspace"))
    const gaepStore = await lstat(join(artifacts, "workspace", ".gaep"))
    assert.equal(workspace.isDirectory(), true)
    assert.equal(gaepStore.isDirectory(), true)
    const serialized = JSON.stringify(receipt)
    assert.equal(serialized.includes(directory), false)
    assert.equal(serialized.includes("deterministic output"), false)
    assert.equal(serialized.includes("manual-thread-"), false)

    const storedRecord = manifest.store.entries.find((entry) => entry.path.endsWith(".json"))
    assert.notEqual(storedRecord, undefined)
    const storedRecordPath = join(artifacts, manifest.store.root, ...storedRecord.path.split("/"))
    const original = await readFile(storedRecordPath)
    await writeFile(storedRecordPath, Buffer.concat([original, Buffer.from(" ")]))
    await assert.rejects(
      verifyPhase0ExampleArtifactDirectory(artifacts),
      /artifact-manifest\.json differs from the exact receipt and portable store/,
    )
    await writeFile(storedRecordPath, original)
    await writeFile(join(artifacts, "workspace", ".gaep", "untracked.json"), "{}")
    await assert.rejects(
      verifyPhase0ExampleArtifactDirectory(artifacts),
      /artifact-manifest\.json differs from the exact receipt and portable store/,
    )

    await assert.rejects(
      execute(process.execPath, [runner, "--artifacts", artifacts], { cwd: repository }),
      /refusing to reuse or overwrite/,
    )
  })
})

test("writes a private receipt once and refuses overwrite", async () => {
  await withTemporaryDirectory(async (directory) => {
    const receiptPath = join(directory, "receipt.json")
    await execute(process.execPath, [runner, "--output", receiptPath], { cwd: repository })
    await verifyPhase0ExampleReceiptFile(receiptPath)
    if (process.platform !== "win32") {
      const mode = (await lstat(receiptPath)).mode & 0o777
      assert.equal(mode, 0o600)
    }
    await assert.rejects(
      execute(process.execPath, [runner, "--output", receiptPath], { cwd: repository }),
      /refusing to overwrite/,
    )
  })
})

test("refuses to reuse a non-empty workspace", async () => {
  await withTemporaryDirectory(async (directory) => {
    const marker = join(directory, "owner-data.txt")
    await writeFile(marker, "preserve me")
    await assert.rejects(runPhase0Example({ workspacePath: directory }), /must be empty/)
    assert.equal(await readFile(marker, "utf8"), "preserve me")
  })
})

test("rejects semantic tampering, oversized files, and symlink receipts", async () => {
  await withTemporaryDirectory(async (directory) => {
    const receipt = await runPhase0Example()
    const tampered = structuredClone(receipt)
    tampered.summary.state = "failed"
    await assert.rejects(verifyPhase0ExampleReceiptObject(tampered), /semantic summary differs/)

    const dashboardTampered = structuredClone(receipt)
    dashboardTampered.dashboard.panels[0].state = "active"
    await assert.rejects(
      verifyPhase0ExampleReceiptObject(dashboardTampered),
      /dashboard panel 0 differs from the canonical applicability contract/,
    )

    const dashboardCueTampered = structuredClone(receipt)
    dashboardCueTampered.dashboard.evidenceCues.freshness = "unknown"
    dashboardCueTampered.dashboard.compositionDigest = canonicalDigest(
      (({ compositionDigest: _, ...content }) => content)(dashboardCueTampered.dashboard),
    )
    await assert.rejects(
      verifyPhase0ExampleReceiptObject(dashboardCueTampered),
      /dashboard\.evidenceCues differ from governed evidence truth/,
    )

    const productBindingTampered = structuredClone(receipt)
    productBindingTampered.changeImpact.catalog.product.recordId = randomUUID()
    await assert.rejects(
      verifyPhase0ExampleReceiptObject(productBindingTampered),
      /Change catalog Product binding differs/,
    )

    const countTampered = structuredClone(receipt)
    countTampered.changeImpact.catalog.total = 2
    await assert.rejects(
      verifyPhase0ExampleReceiptObject(countTampered),
      /Change catalog counts must reconcile/,
    )

    const freshnessTampered = structuredClone(receipt)
    freshnessTampered.changeImpact.dashboard.freshness.state = "attention-required"
    await assert.rejects(
      verifyPhase0ExampleReceiptObject(freshnessTampered),
      /freshness differs from the current exact trace graph/,
    )

    const changeCueTampered = structuredClone(receipt)
    changeCueTampered.changeImpact.dashboard.evidenceCues.freshness = "stale"
    changeCueTampered.changeImpact.dashboard.snapshotDigest = canonicalDigest(
      (({ snapshotDigest: _, ...content }) => content)(changeCueTampered.changeImpact.dashboard),
    )
    await assert.rejects(
      verifyPhase0ExampleReceiptObject(changeCueTampered),
      /changeImpact\.dashboard\.evidenceCues differ from governed evidence truth/,
    )

    const authorityTampered = structuredClone(receipt)
    authorityTampered.changeImpact.dashboard.authorityBoundary = "dashboard-approves-change"
    await assert.rejects(
      verifyPhase0ExampleReceiptObject(authorityTampered),
      /identity or authority boundary differs/,
    )

    const digestTampered = structuredClone(receipt)
    digestTampered.changeImpact.dashboard.snapshotDigest = `sha256:${"0".repeat(64)}`
    await assert.rejects(
      verifyPhase0ExampleReceiptObject(digestTampered),
      /snapshot digest differs/,
    )

    const agentProductTampered = structuredClone(receipt)
    agentProductTampered.agentModel.product.recordId = randomUUID()
    await assert.rejects(
      verifyPhase0ExampleReceiptObject(agentProductTampered),
      /Agent\/Model dashboard Product binding differs/,
    )

    const agentSelectionTampered = structuredClone(receipt)
    agentSelectionTampered.agentModel.selection.selectionDigest = `sha256:${"1".repeat(64)}`
    await assert.rejects(
      verifyPhase0ExampleReceiptObject(agentSelectionTampered),
      /Agent\/Model selection digest differs/,
    )

    const agentCountTampered = structuredClone(receipt)
    agentCountTampered.agentModel.limits.runs.total = 2
    await assert.rejects(
      verifyPhase0ExampleReceiptObject(agentCountTampered),
      /agentModel\.limits\.runs does not reconcile/,
    )

    const agentFreshnessTampered = structuredClone(receipt)
    agentFreshnessTampered.agentModel.freshness.state = "attention-required"
    await assert.rejects(
      verifyPhase0ExampleReceiptObject(agentFreshnessTampered),
      /Agent\/Model freshness differs/,
    )

    const agentCueTampered = structuredClone(receipt)
    agentCueTampered.agentModel.evidenceCues.confidence.state = "supported"
    agentCueTampered.agentModel.snapshotDigest = canonicalDigest(
      (({ snapshotDigest: _, ...content }) => content)(agentCueTampered.agentModel),
    )
    await assert.rejects(
      verifyPhase0ExampleReceiptObject(agentCueTampered),
      /agentModel\.evidenceCues differ from governed evidence truth/,
    )

    const agentMetricTampered = structuredClone(receipt)
    agentMetricTampered.agentModel.providerMetrics.usage.state = "available"
    await assert.rejects(
      verifyPhase0ExampleReceiptObject(agentMetricTampered),
      /provider metrics must remain explicitly unavailable/,
    )

    const agentManagedTampered = structuredClone(receipt)
    agentManagedTampered.agentModel.runs[0].managed.result.digest = `sha256:${"2".repeat(64)}`
    await assert.rejects(
      verifyPhase0ExampleReceiptObject(agentManagedTampered),
      /Managed result binding differs/,
    )

    const agentAuthorityTampered = structuredClone(receipt)
    agentAuthorityTampered.agentModel.authorityBoundary = "dashboard-can-launch-runs"
    await assert.rejects(
      verifyPhase0ExampleReceiptObject(agentAuthorityTampered),
      /Agent\/Model dashboard identity or authority boundary differs/,
    )

    const agentDigestTampered = structuredClone(receipt)
    agentDigestTampered.agentModel.snapshotDigest = `sha256:${"3".repeat(64)}`
    await assert.rejects(
      verifyPhase0ExampleReceiptObject(agentDigestTampered),
      /Agent\/Model dashboard snapshot digest differs/,
    )

    const agentPrivateTampered = structuredClone(receipt)
    agentPrivateTampered.agentModel.providerToken = "must-not-pass"
    await assert.rejects(
      verifyPhase0ExampleReceiptObject(agentPrivateTampered),
      /receipt\.agentModel keys differ/,
    )

    const oversized = join(directory, "oversized.json")
    await writeFile(oversized, JSON.stringify({ padding: "x".repeat(129 * 1024) }))
    await assert.rejects(verifyPhase0ExampleReceiptFile(oversized), /between 2 and 131072 bytes/)

    if (process.platform !== "win32") {
      const target = join(directory, "target.json")
      const link = join(directory, "receipt-link.json")
      await writeFile(target, JSON.stringify(receipt))
      await symlink(target, link)
      await assert.rejects(verifyPhase0ExampleReceiptFile(link), /regular file/)
    }
  })
})
