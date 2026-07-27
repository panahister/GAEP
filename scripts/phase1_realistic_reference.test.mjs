import assert from "node:assert/strict"
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import test, { after, before } from "node:test"

import {
  verifyPhase1RealisticReferenceArtifactDirectory,
} from "./phase1_realistic_reference_artifacts.mjs"
import { runPhase1RealisticReferenceArtifacts } from "./run_phase1_realistic_reference.mjs"

let temporaryDirectory
let artifactDirectory

before(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "gaep-phase1-reference-test-"))
  artifactDirectory = resolve(temporaryDirectory, "artifact")
  await runPhase1RealisticReferenceArtifacts(artifactDirectory)
}, { timeout: 60_000 })

after(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true })
})

test("creates and independently verifies two inspectable realistic P0-P4 stores", async () => {
  const { receipt, manifest } = await verifyPhase1RealisticReferenceArtifactDirectory(artifactDirectory)
  assert.equal(receipt.scenario.id, "phase-1-atlas-release-readiness-v1")
  assert.equal(receipt.scenario.productName, "Atlas Release Readiness")
  assert.equal(receipt.summary.governedRecordCountPerProvider, 21)
  assert.equal(receipt.summary.p0P4OutputCount, 25)
  assert.equal(receipt.summary.inspectableStoreCount, 2)
  assert.equal(receipt.summary.completedManagedRunCount, 2)
  assert.equal(receipt.summary.structuralCriteriaSatisfied, 7)
  assert.equal(receipt.summary.materialDivergenceCount, 0)
  assert.equal(receipt.summary.productOwnerAcceptance, "not-established")
  assert.equal(receipt.summary.readinessAuthority, "not-established")
  assert.equal(receipt.stores.codex.checks.workspaceHealthy, true)
  assert.equal(receipt.stores.claude.checks.workspaceHealthy, true)
  assert.ok(manifest.inventory.fileCount > 100)
})

test("refuses to reuse or overwrite an existing realistic reference artifact", async () => {
  await assert.rejects(
    runPhase1RealisticReferenceArtifacts(artifactDirectory),
    /already exists; refusing to reuse or overwrite/,
  )
})

test("rejects receipt, scenario, and portable-store tampering", async () => {
  const forgedReceiptDirectory = resolve(temporaryDirectory, "forged-receipt")
  await cp(artifactDirectory, forgedReceiptDirectory, { recursive: true })
  const receiptPath = resolve(forgedReceiptDirectory, "receipt.json")
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"))
  receipt.authority.productOwnerAcceptance = "accepted"
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
  await assert.rejects(
    verifyPhase1RealisticReferenceArtifactDirectory(forgedReceiptDirectory),
    /receipt.json differs/,
  )

  const forgedScenarioDirectory = resolve(temporaryDirectory, "forged-scenario")
  await cp(artifactDirectory, forgedScenarioDirectory, { recursive: true })
  const scenarioPath = resolve(forgedScenarioDirectory, "scenario.json")
  const scenario = JSON.parse(await readFile(scenarioPath, "utf8"))
  scenario.product.name = "Forged readiness"
  await writeFile(scenarioPath, `${JSON.stringify(scenario, null, 2)}\n`)
  await assert.rejects(
    verifyPhase1RealisticReferenceArtifactDirectory(forgedScenarioDirectory),
    /differs from the canonical repository scenario/,
  )

  const forgedStoreDirectory = resolve(temporaryDirectory, "forged-store")
  await cp(artifactDirectory, forgedStoreDirectory, { recursive: true })
  const productPath = resolve(forgedStoreDirectory, "workspaces/codex/.gaep/product.json")
  const product = JSON.parse(await readFile(productPath, "utf8"))
  product.name = "Forged store Product"
  await writeFile(productPath, `${JSON.stringify(product, null, 2)}\n`)
  await assert.rejects(
    verifyPhase1RealisticReferenceArtifactDirectory(forgedStoreDirectory),
    /portable store check failed|Audit integrity verification failed|Invalid audit chain|Product identity|health/,
  )
})

test("rejects symbolic-link substitution in the artifact", async () => {
  const forgedDirectory = resolve(temporaryDirectory, "forged-symlink")
  await cp(artifactDirectory, forgedDirectory, { recursive: true })
  const catalogPath = resolve(forgedDirectory, "output-catalog.json")
  await rm(catalogPath)
  await symlink(resolve(forgedDirectory, "scenario.json"), catalogPath)
  await assert.rejects(
    verifyPhase1RealisticReferenceArtifactDirectory(forgedDirectory),
    /must be a regular file/,
  )
})
