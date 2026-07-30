import assert from "node:assert/strict"
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import test, { after, before } from "node:test"

import {
  runPhase2RealisticFigmaLoopArtifacts,
  verifyPhase2RealisticFigmaLoopArtifactDirectory,
} from "./phase2_realistic_figma_loop_artifacts.mjs"

let temporaryDirectory
let artifactDirectory

before(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "gaep-phase2-figma-loop-test-"))
  artifactDirectory = resolve(temporaryDirectory, "artifact")
  await runPhase2RealisticFigmaLoopArtifacts(artifactDirectory)
}, { timeout: 30_000 })

after(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true })
})

test("creates and independently verifies the deterministic candidate-only Figma loop", async () => {
  const { receipt, manifest } = await verifyPhase2RealisticFigmaLoopArtifactDirectory(artifactDirectory)
  assert.equal(receipt.scenario.id, "phase-2-atlas-evidence-review-design-loop-v1")
  assert.equal(receipt.summary.loopStageCount, 12)
  assert.equal(receipt.summary.governedSourceCount, 23)
  assert.equal(receipt.summary.dashboardCount, 2)
  assert.equal(receipt.summary.hostProjectionCount, 4)
  assert.equal(receipt.summary.failureRecoveryCaseCount, 3)
  assert.equal(receipt.summary.writesPerformed, 0)
  assert.equal(receipt.summary.importsPerformed, 0)
  assert.equal(receipt.summary.approvalsEstablished, 0)
  assert.equal(receipt.summary.baselinesDesignated, 0)
  assert.equal(receipt.authority.productOwnerAcceptance, "not-established")
  assert.equal(receipt.authority.readinessAuthority, "not-established")
  assert.equal(manifest.inventory.fileCount, 10)
})

test("is byte-deterministic for the exact scenario and source evidence", async () => {
  const secondDirectory = resolve(temporaryDirectory, "second-artifact")
  const first = await verifyPhase2RealisticFigmaLoopArtifactDirectory(artifactDirectory)
  const second = await runPhase2RealisticFigmaLoopArtifacts(secondDirectory)
  assert.equal(second.receipt.compositionDigest, first.receipt.compositionDigest)
  assert.equal(second.manifest.inventory.inventoryDigest, first.manifest.inventory.inventoryDigest)
})

test("refuses to reuse or overwrite an existing artifact directory", async () => {
  await assert.rejects(
    runPhase2RealisticFigmaLoopArtifacts(artifactDirectory),
    /already exists; refusing to reuse or overwrite/,
  )
})

test("rejects receipt, scenario, dashboard, and host-source tampering", async () => {
  const forgedReceiptDirectory = resolve(temporaryDirectory, "forged-receipt")
  await cp(artifactDirectory, forgedReceiptDirectory, { recursive: true })
  const receiptPath = resolve(forgedReceiptDirectory, "receipt.json")
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"))
  receipt.authority.approval = "approved"
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
  await assert.rejects(
    verifyPhase2RealisticFigmaLoopArtifactDirectory(forgedReceiptDirectory),
    /receipt.json differs/,
  )

  const forgedScenarioDirectory = resolve(temporaryDirectory, "forged-scenario")
  await cp(artifactDirectory, forgedScenarioDirectory, { recursive: true })
  const scenarioPath = resolve(forgedScenarioDirectory, "scenario.json")
  const scenario = JSON.parse(await readFile(scenarioPath, "utf8"))
  scenario.product.name = "Forged Product"
  await writeFile(scenarioPath, `${JSON.stringify(scenario, null, 2)}\n`)
  await assert.rejects(
    verifyPhase2RealisticFigmaLoopArtifactDirectory(forgedScenarioDirectory),
    /differs from the canonical repository scenario/,
  )

  const forgedDashboardDirectory = resolve(temporaryDirectory, "forged-dashboard")
  await cp(artifactDirectory, forgedDashboardDirectory, { recursive: true })
  const dashboardPath = resolve(forgedDashboardDirectory, "dashboards/change-impact-agent-model.json")
  const dashboard = JSON.parse(await readFile(dashboardPath, "utf8"))
  dashboard.governance.effectAuthority = "granted"
  await writeFile(dashboardPath, `${JSON.stringify(dashboard, null, 2)}\n`)
  await assert.rejects(
    verifyPhase2RealisticFigmaLoopArtifactDirectory(forgedDashboardDirectory),
    /change-impact-agent-model.json differs/,
  )

  const forgedHostDirectory = resolve(temporaryDirectory, "forged-host")
  await cp(artifactDirectory, forgedHostDirectory, { recursive: true })
  const conformancePath = resolve(forgedHostDirectory, "sources/phase2-conformance.json")
  const conformance = JSON.parse(await readFile(conformancePath, "utf8"))
  conformance.summary.acceptedHosts = 4
  await writeFile(conformancePath, `${JSON.stringify(conformance, null, 2)}\n`)
  await assert.rejects(
    verifyPhase2RealisticFigmaLoopArtifactDirectory(forgedHostDirectory),
    /76-capability boundary/,
  )
})

test("rejects symbolic-link substitution in the artifact", async () => {
  const forgedDirectory = resolve(temporaryDirectory, "forged-symlink")
  await cp(artifactDirectory, forgedDirectory, { recursive: true })
  const catalogPath = resolve(forgedDirectory, "loop-catalog.json")
  await rm(catalogPath)
  await symlink(resolve(forgedDirectory, "scenario.json"), catalogPath)
  await assert.rejects(
    verifyPhase2RealisticFigmaLoopArtifactDirectory(forgedDirectory),
    /must be a regular file/,
  )
})
