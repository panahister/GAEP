import assert from "node:assert/strict"
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import test, { after, before } from "node:test"

import {
  runPhase3aRealisticReadinessExampleArtifacts,
  verifyPhase3aRealisticReadinessExampleArtifactDirectory,
} from "./phase3a_realistic_readiness_example_artifacts.mjs"

let temporaryDirectory
let artifactDirectory

before(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "gaep-phase3a-realistic-readiness-test-"))
  artifactDirectory = resolve(temporaryDirectory, "artifact")
  await runPhase3aRealisticReadinessExampleArtifacts(artifactDirectory)
}, { timeout: 30_000 })

after(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true })
})

test("creates and independently verifies the realistic Phase 3A readiness candidate", async () => {
  const { receipt, manifest } = await verifyPhase3aRealisticReadinessExampleArtifactDirectory(artifactDirectory)
  assert.equal(receipt.scenario.id, "phase-3a-atlas-realistic-readiness-example-v1")
  assert.equal(receipt.summary.sourceCount, 20)
  assert.equal(receipt.summary.exactCurrentCandidateCount, 20)
  assert.equal(receipt.summary.evidenceReferenceCount, 81)
  assert.equal(receipt.summary.dashboardViewCount, 5)
  assert.equal(receipt.summary.providerWorkflowEvidenceCount, 2)
  assert.equal(receipt.summary.candidatePhaseState, "candidate-complete-for-human-review")
  assert.equal(receipt.summary.reopenObservationCount, 2)
  assert.equal(receipt.summary.failureRecoveryCaseCount, 3)
  assert.equal(receipt.summary.hostProjectionCount, 4)
  assert.equal(receipt.summary.liveProviderRequestCount, 0)
  assert.equal(receipt.summary.implementationEffectsApplied, 0)
  assert.equal(receipt.authority.readinessAuthority, "not-established")
  assert.equal(receipt.authority.implementationAuthorization, "not-granted")
  assert.equal(receipt.authority.productOwnerAcceptance, "not-established")
  assert.equal(manifest.inventory.fileCount, 12)
})

test("is byte-deterministic for the exact realistic scenario and sealed evidence", async () => {
  const secondDirectory = resolve(temporaryDirectory, "second-artifact")
  const first = await verifyPhase3aRealisticReadinessExampleArtifactDirectory(artifactDirectory)
  const second = await runPhase3aRealisticReadinessExampleArtifacts(secondDirectory)
  assert.equal(second.receipt.compositionDigest, first.receipt.compositionDigest)
  assert.equal(second.manifest.inventory.inventoryDigest, first.manifest.inventory.inventoryDigest)
})

test("refuses to reuse or overwrite an existing artifact directory", async () => {
  await assert.rejects(
    runPhase3aRealisticReadinessExampleArtifacts(artifactDirectory),
    /already exists; refusing to reuse or overwrite/,
  )
})

test("rejects receipt, scenario, dashboard, and sealed-source tampering", async () => {
  const forgedReceiptDirectory = resolve(temporaryDirectory, "forged-receipt")
  await cp(artifactDirectory, forgedReceiptDirectory, { recursive: true })
  const receiptPath = resolve(forgedReceiptDirectory, "receipt.json")
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"))
  receipt.authority.implementationAuthorization = "granted"
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
  await assert.rejects(
    verifyPhase3aRealisticReadinessExampleArtifactDirectory(forgedReceiptDirectory),
    /receipt.json differs/,
  )

  const forgedScenarioDirectory = resolve(temporaryDirectory, "forged-scenario")
  await cp(artifactDirectory, forgedScenarioDirectory, { recursive: true })
  const scenarioPath = resolve(forgedScenarioDirectory, "scenario.json")
  const scenario = JSON.parse(await readFile(scenarioPath, "utf8"))
  scenario.caseStudy.problem = "Forged Product content"
  await writeFile(scenarioPath, `${JSON.stringify(scenario, null, 2)}\n`)
  await assert.rejects(
    verifyPhase3aRealisticReadinessExampleArtifactDirectory(forgedScenarioDirectory),
    /differs from its exact sealed repository source/,
  )

  const forgedDashboardDirectory = resolve(temporaryDirectory, "forged-dashboard")
  await cp(artifactDirectory, forgedDashboardDirectory, { recursive: true })
  const dashboardPath = resolve(forgedDashboardDirectory, "dashboard.json")
  const dashboard = JSON.parse(await readFile(dashboardPath, "utf8"))
  dashboard.phaseStatus.readinessAuthority = "established"
  await writeFile(dashboardPath, `${JSON.stringify(dashboard, null, 2)}\n`)
  await assert.rejects(
    verifyPhase3aRealisticReadinessExampleArtifactDirectory(forgedDashboardDirectory),
    /dashboard.json differs/,
  )

  const forgedSourceDirectory = resolve(temporaryDirectory, "forged-source")
  await cp(artifactDirectory, forgedSourceDirectory, { recursive: true })
  const conformancePath = resolve(forgedSourceDirectory, "sources/phase3a-conformance.json")
  const conformance = JSON.parse(await readFile(conformancePath, "utf8"))
  conformance.summary.acceptedHosts = 4
  await writeFile(conformancePath, `${JSON.stringify(conformance, null, 2)}\n`)
  await assert.rejects(
    verifyPhase3aRealisticReadinessExampleArtifactDirectory(forgedSourceDirectory),
    /differs from its exact sealed repository source/,
  )
})

test("rejects symbolic-link substitution in the artifact", async () => {
  const forgedDirectory = resolve(temporaryDirectory, "forged-symlink")
  await cp(artifactDirectory, forgedDirectory, { recursive: true })
  const catalogPath = resolve(forgedDirectory, "readiness-catalog.json")
  await rm(catalogPath)
  await symlink(resolve(forgedDirectory, "scenario.json"), catalogPath)
  await assert.rejects(
    verifyPhase3aRealisticReadinessExampleArtifactDirectory(forgedDirectory),
    /must be a regular file/,
  )
})
