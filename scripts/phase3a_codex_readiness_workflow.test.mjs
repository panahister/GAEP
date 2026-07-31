import assert from "node:assert/strict"
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import test, { after, before } from "node:test"

import {
  runPhase3aCodexReadinessWorkflowArtifacts,
  verifyPhase3aCodexReadinessWorkflowArtifactDirectory,
} from "./phase3a_codex_readiness_workflow_artifacts.mjs"

let temporaryDirectory
let artifactDirectory

before(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "gaep-phase3a-codex-readiness-test-"))
  artifactDirectory = resolve(temporaryDirectory, "artifact")
  await runPhase3aCodexReadinessWorkflowArtifacts(artifactDirectory)
}, { timeout: 60_000 })

after(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true })
})

test("creates and independently verifies the deterministic Codex Phase 3A readiness workflow", async () => {
  const { receipt, manifest } = await verifyPhase3aCodexReadinessWorkflowArtifactDirectory(artifactDirectory)
  assert.equal(receipt.scenario.id, "phase-3a-atlas-codex-readiness-workflow-v1")
  assert.equal(receipt.summary.stageCount, 20)
  assert.equal(receipt.summary.exactCurrentCandidateCount, 20)
  assert.equal(receipt.summary.implementationReadinessDependencyStageCount, 19)
  assert.equal(receipt.summary.reopenObservationCount, 2)
  assert.equal(receipt.summary.continuityMismatchCount, 0)
  assert.equal(receipt.summary.failureRecoveryCaseCount, 3)
  assert.equal(receipt.summary.holdCount, 3)
  assert.equal(receipt.summary.hostProjectionCount, 4)
  assert.equal(receipt.summary.productStudioProjectionCount, 1)
  assert.equal(receipt.summary.codexExecutionState, "completed")
  assert.equal(receipt.summary.codexStagingChangeCount, 0)
  assert.equal(receipt.summary.liveProviderRequestCount, 0)
  assert.equal(receipt.summary.implementationEffectsApplied, 0)
  assert.equal(receipt.authority.readinessAuthority, "not-established")
  assert.equal(receipt.authority.productOwnerAcceptance, "not-established")
  assert.equal(manifest.inventory.fileCount, 9)
})

test("is byte-deterministic for the exact scenario and current bound evidence", async () => {
  const secondDirectory = resolve(temporaryDirectory, "second-artifact")
  const first = await verifyPhase3aCodexReadinessWorkflowArtifactDirectory(artifactDirectory)
  const second = await runPhase3aCodexReadinessWorkflowArtifacts(secondDirectory)
  assert.equal(second.receipt.compositionDigest, first.receipt.compositionDigest)
  assert.equal(second.manifest.inventory.inventoryDigest, first.manifest.inventory.inventoryDigest)
})

test("refuses to reuse or overwrite an existing artifact directory", async () => {
  await assert.rejects(runPhase3aCodexReadinessWorkflowArtifacts(artifactDirectory), /already exists; refusing to reuse or overwrite/)
})

test("rejects receipt, chain, host, and Codex-source tampering", async () => {
  const forgedReceiptDirectory = resolve(temporaryDirectory, "forged-receipt")
  await cp(artifactDirectory, forgedReceiptDirectory, { recursive: true })
  const receiptPath = resolve(forgedReceiptDirectory, "receipt.json")
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"))
  receipt.authority.readinessAuthority = "granted"
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
  await assert.rejects(verifyPhase3aCodexReadinessWorkflowArtifactDirectory(forgedReceiptDirectory), /receipt.json differs/)

  const forgedChainDirectory = resolve(temporaryDirectory, "forged-chain")
  await cp(artifactDirectory, forgedChainDirectory, { recursive: true })
  const chainPath = resolve(forgedChainDirectory, "candidate-chain.json")
  const chain = JSON.parse(await readFile(chainPath, "utf8"))
  chain.stages.pop()
  await writeFile(chainPath, `${JSON.stringify(chain, null, 2)}\n`)
  await assert.rejects(verifyPhase3aCodexReadinessWorkflowArtifactDirectory(forgedChainDirectory), /candidate-chain.json differs/)

  const forgedHostDirectory = resolve(temporaryDirectory, "forged-host")
  await cp(artifactDirectory, forgedHostDirectory, { recursive: true })
  const conformancePath = resolve(forgedHostDirectory, "sources/phase3a-conformance.json")
  const conformance = JSON.parse(await readFile(conformancePath, "utf8"))
  conformance.summary.acceptedHosts = 4
  await writeFile(conformancePath, `${JSON.stringify(conformance, null, 2)}\n`)
  await assert.rejects(verifyPhase3aCodexReadinessWorkflowArtifactDirectory(forgedHostDirectory), /96-capability incomplete-acceptance boundary/)

  const forgedCodexDirectory = resolve(temporaryDirectory, "forged-codex")
  await cp(artifactDirectory, forgedCodexDirectory, { recursive: true })
  const codexPath = resolve(forgedCodexDirectory, "sources/codex-receipt.json")
  const codex = JSON.parse(await readFile(codexPath, "utf8"))
  codex.authority.liveProviderStatus = "accepted"
  await writeFile(codexPath, `${JSON.stringify(codex, null, 2)}\n`)
  await assert.rejects(verifyPhase3aCodexReadinessWorkflowArtifactDirectory(forgedCodexDirectory), /authority boundary differs/)
})

test("rejects symbolic-link substitution in the artifact", async () => {
  const forgedDirectory = resolve(temporaryDirectory, "forged-symlink")
  await cp(artifactDirectory, forgedDirectory, { recursive: true })
  const chainPath = resolve(forgedDirectory, "candidate-chain.json")
  await rm(chainPath)
  await symlink(resolve(forgedDirectory, "scenario.json"), chainPath)
  await assert.rejects(verifyPhase3aCodexReadinessWorkflowArtifactDirectory(forgedDirectory), /must be a regular file/)
})
