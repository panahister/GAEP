import assert from "node:assert/strict"
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import test, { after, before } from "node:test"

import {
  runPhase3aClaudeReadinessWorkflowArtifacts,
  verifyPhase3aClaudeReadinessWorkflowArtifactDirectory,
} from "./phase3a_claude_readiness_workflow_artifacts.mjs"

let temporaryDirectory
let artifactDirectory

before(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "gaep-phase3a-claude-readiness-test-"))
  artifactDirectory = resolve(temporaryDirectory, "artifact")
  await runPhase3aClaudeReadinessWorkflowArtifacts(artifactDirectory)
}, { timeout: 60_000 })

after(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true })
})

test("creates and independently verifies the deterministic Claude Phase 3A readiness workflow", async () => {
  const { receipt, manifest } = await verifyPhase3aClaudeReadinessWorkflowArtifactDirectory(artifactDirectory)
  assert.equal(receipt.scenario.id, "phase-3a-atlas-claude-readiness-workflow-v1")
  assert.equal(receipt.summary.stageCount, 20)
  assert.equal(receipt.summary.exactCurrentCandidateCount, 20)
  assert.equal(receipt.summary.implementationReadinessDependencyStageCount, 19)
  assert.equal(receipt.summary.reopenObservationCount, 2)
  assert.equal(receipt.summary.continuityMismatchCount, 0)
  assert.equal(receipt.summary.failureRecoveryCaseCount, 3)
  assert.equal(receipt.summary.holdCount, 3)
  assert.equal(receipt.summary.hostProjectionCount, 4)
  assert.equal(receipt.summary.productStudioProjectionCount, 1)
  assert.equal(receipt.summary.semanticParityMismatchCount, 0)
  assert.equal(receipt.summary.claudeExecutionState, "completed")
  assert.equal(receipt.summary.claudeExecutionMode, "claude-context-only")
  assert.equal(receipt.summary.claudeStagingPresent, false)
  assert.equal(receipt.summary.claudeToolDefinitionCount, 0)
  assert.equal(receipt.summary.claudeWriteScopeCount, 0)
  assert.equal(receipt.summary.liveProviderRequestCount, 0)
  assert.equal(receipt.summary.implementationEffectsApplied, 0)
  assert.equal(receipt.authority.readinessAuthority, "not-established")
  assert.equal(receipt.authority.productOwnerAcceptance, "not-established")
  assert.equal(manifest.inventory.fileCount, 12)

  const parity = JSON.parse(await readFile(resolve(artifactDirectory, "provider-parity.json"), "utf8"))
  assert.equal(parity.codex.scenarioId, "phase-3a-atlas-codex-readiness-workflow-v1")
  assert.equal(parity.claude.scenarioId, "phase-3a-atlas-claude-readiness-workflow-v1")
  assert.equal(parity.codex.scenarioSemanticDigest, parity.claude.scenarioSemanticDigest)
  assert.deepEqual(parity.claude.execution, {
    mode: "claude-context-only",
    stagingPresent: false,
    toolDefinitionCount: 0,
    writeScopeCount: 0,
  })
})

test("is byte-deterministic for the exact scenario and current bound evidence", async () => {
  const secondDirectory = resolve(temporaryDirectory, "second-artifact")
  const first = await verifyPhase3aClaudeReadinessWorkflowArtifactDirectory(artifactDirectory)
  const second = await runPhase3aClaudeReadinessWorkflowArtifacts(secondDirectory)
  assert.equal(second.receipt.compositionDigest, first.receipt.compositionDigest)
  assert.equal(second.manifest.inventory.inventoryDigest, first.manifest.inventory.inventoryDigest)
})

test("refuses to reuse or overwrite an existing artifact directory", async () => {
  await assert.rejects(runPhase3aClaudeReadinessWorkflowArtifacts(artifactDirectory), /already exists; refusing to reuse or overwrite/)
})

test("rejects receipt, chain, host, and Claude-source tampering", async () => {
  const forgedReceiptDirectory = resolve(temporaryDirectory, "forged-receipt")
  await cp(artifactDirectory, forgedReceiptDirectory, { recursive: true })
  const receiptPath = resolve(forgedReceiptDirectory, "receipt.json")
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"))
  receipt.authority.readinessAuthority = "granted"
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
  await assert.rejects(verifyPhase3aClaudeReadinessWorkflowArtifactDirectory(forgedReceiptDirectory), /receipt.json differs/)

  const forgedChainDirectory = resolve(temporaryDirectory, "forged-chain")
  await cp(artifactDirectory, forgedChainDirectory, { recursive: true })
  const chainPath = resolve(forgedChainDirectory, "candidate-chain.json")
  const chain = JSON.parse(await readFile(chainPath, "utf8"))
  chain.stages.pop()
  await writeFile(chainPath, `${JSON.stringify(chain, null, 2)}\n`)
  await assert.rejects(verifyPhase3aClaudeReadinessWorkflowArtifactDirectory(forgedChainDirectory), /candidate-chain.json differs/)

  const forgedHostDirectory = resolve(temporaryDirectory, "forged-host")
  await cp(artifactDirectory, forgedHostDirectory, { recursive: true })
  const conformancePath = resolve(forgedHostDirectory, "sources/phase3a-conformance.json")
  const conformance = JSON.parse(await readFile(conformancePath, "utf8"))
  conformance.summary.acceptedHosts = 4
  await writeFile(conformancePath, `${JSON.stringify(conformance, null, 2)}\n`)
  await assert.rejects(verifyPhase3aClaudeReadinessWorkflowArtifactDirectory(forgedHostDirectory), /96-capability incomplete-acceptance boundary/)

  const forgedClaudeDirectory = resolve(temporaryDirectory, "forged-claude")
  await cp(artifactDirectory, forgedClaudeDirectory, { recursive: true })
  const claudePath = resolve(forgedClaudeDirectory, "sources/claude-receipt.json")
  const claude = JSON.parse(await readFile(claudePath, "utf8"))
  claude.authority.liveProviderStatus = "accepted"
  await writeFile(claudePath, `${JSON.stringify(claude, null, 2)}\n`)
  await assert.rejects(verifyPhase3aClaudeReadinessWorkflowArtifactDirectory(forgedClaudeDirectory), /authority boundary differs/)

  const forgedParityScenarioDirectory = resolve(temporaryDirectory, "forged-codex-parity-scenario")
  await cp(artifactDirectory, forgedParityScenarioDirectory, { recursive: true })
  const parityScenarioPath = resolve(forgedParityScenarioDirectory, "sources/codex-parity-scenario.json")
  const parityScenario = JSON.parse(await readFile(parityScenarioPath, "utf8"))
  parityScenario.stages[0].title = "Forged Backlog"
  await writeFile(parityScenarioPath, `${JSON.stringify(parityScenario, null, 2)}\n`)
  await assert.rejects(verifyPhase3aClaudeReadinessWorkflowArtifactDirectory(forgedParityScenarioDirectory),
    /Codex parity scenario differs/)

  const forgedCodexReceiptDirectory = resolve(temporaryDirectory, "forged-codex-workflow-receipt")
  await cp(artifactDirectory, forgedCodexReceiptDirectory, { recursive: true })
  const codexReceiptPath = resolve(forgedCodexReceiptDirectory, "sources/codex-workflow-receipt.json")
  const codexReceipt = JSON.parse(await readFile(codexReceiptPath, "utf8"))
  codexReceipt.summary.liveProviderRequestCount = 1
  await writeFile(codexReceiptPath, `${JSON.stringify(codexReceipt, null, 2)}\n`)
  await assert.rejects(verifyPhase3aClaudeReadinessWorkflowArtifactDirectory(forgedCodexReceiptDirectory),
    /Codex workflow receipt differs/)
})

test("rejects symbolic-link substitution in the artifact", async () => {
  const forgedDirectory = resolve(temporaryDirectory, "forged-symlink")
  await cp(artifactDirectory, forgedDirectory, { recursive: true })
  const chainPath = resolve(forgedDirectory, "candidate-chain.json")
  await rm(chainPath)
  await symlink(resolve(forgedDirectory, "scenario.json"), chainPath)
  await assert.rejects(verifyPhase3aClaudeReadinessWorkflowArtifactDirectory(forgedDirectory), /must be a regular file/)
})
