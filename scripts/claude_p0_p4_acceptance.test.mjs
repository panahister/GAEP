import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import test from "node:test"

import { runClaudeP0P4Acceptance } from "./run_claude_p0_p4_acceptance.mjs"
import {
  canonicalDigest,
  verifyClaudeP0P4ReceiptFile,
  verifyClaudeP0P4ReceiptObject,
} from "./verify_claude_p0_p4_receipt.mjs"

const execute = promisify(execFile)
const repository = fileURLToPath(new URL("..", import.meta.url))
const runner = resolve(repository, "scripts/run_claude_p0_p4_acceptance.mjs")

async function withTemporaryDirectory(run) {
  const directory = await mkdtemp(join(tmpdir(), "gaep-claude-p0-p4-test-"))
  try {
    return await run(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test("repeats the strict Claude P0-P4 semantic receipt", async () => {
  const first = await runClaudeP0P4Acceptance()
  const second = await runClaudeP0P4Acceptance()
  assert.deepEqual(first, second)
  assert.equal(first.summary.governedRecordCount, 21)
  assert.equal(first.summary.readiness.outputCount, 25)
  assert.equal(first.summary.readiness.result, "passed")
  assert.equal(first.summary.handoff.itemCount, 25)
  assert.equal(first.summary.handoff.state, "complete-for-review")
  assert.equal(first.summary.execution.mode, "claude-context-only")
  assert.equal(first.summary.execution.outcomeBasis, "postcondition-evaluator")
  assert.equal(first.summary.execution.providerPostconditionStatus, "not-assessed")
  assert.equal(first.summary.execution.postconditionAuthority, "workflow-gate-evaluator")
  assert.equal(first.summary.execution.stagingPresent, false)
  assert.equal(first.summary.execution.toolDefinitionCount, 0)
  assert.equal(first.summary.execution.writeScopeCount, 0)
  assert.equal(first.summary.integrity.auditValid, true)
  assert.equal(first.summaryDigest, canonicalDigest(first.summary))
})

test("writes a private verified Claude receipt once and refuses overwrite", async () => {
  await withTemporaryDirectory(async (directory) => {
    const receiptPath = join(directory, "receipt.json")
    const { stdout, stderr } = await execute(process.execPath, [runner, "--output", receiptPath], {
      cwd: repository,
      maxBuffer: 256 * 1024,
    })
    assert.equal(stderr, "")
    const stdoutReceipt = JSON.parse(stdout)
    const storedReceipt = await verifyClaudeP0P4ReceiptFile(receiptPath)
    assert.deepEqual(stdoutReceipt, storedReceipt)
    await assert.rejects(
      execute(process.execPath, [runner, "--output", receiptPath], { cwd: repository, maxBuffer: 256 * 1024 }),
      /refusing to overwrite/,
    )
  })
})

test("rejects Claude semantic, digest, source, authority, and shape tampering", async () => {
  const receipt = await runClaudeP0P4Acceptance()

  const semantic = structuredClone(receipt)
  semantic.summary.execution.toolDefinitionCount = 1
  semantic.summaryDigest = canonicalDigest(semantic.summary)
  await assert.rejects(verifyClaudeP0P4ReceiptObject(semantic), /semantic summary differs/)

  const delegatedAuthority = structuredClone(receipt)
  delegatedAuthority.summary.execution.providerPostconditionStatus = "satisfied"
  delegatedAuthority.summaryDigest = canonicalDigest(delegatedAuthority.summary)
  await assert.rejects(verifyClaudeP0P4ReceiptObject(delegatedAuthority), /semantic summary differs/)

  const digest = structuredClone(receipt)
  digest.summaryDigest = `sha256:${"0".repeat(64)}`
  await assert.rejects(verifyClaudeP0P4ReceiptObject(digest), /summary digest differs/)

  const source = structuredClone(receipt)
  source.scenario.fakeStreamSourceDigest = `sha256:${"1".repeat(64)}`
  await assert.rejects(verifyClaudeP0P4ReceiptObject(source), /source digest differs/)

  const authority = structuredClone(receipt)
  authority.authority.liveProviderStatus = "accepted"
  await assert.rejects(verifyClaudeP0P4ReceiptObject(authority), /authority boundary differs/)

  const shape = structuredClone(receipt)
  shape.unexpected = true
  await assert.rejects(verifyClaudeP0P4ReceiptObject(shape), /receipt keys differ/)
})

test("rejects malformed and oversized Claude receipt files", async () => {
  await withTemporaryDirectory(async (directory) => {
    const malformed = join(directory, "malformed.json")
    await writeFile(malformed, "{not-json")
    await assert.rejects(verifyClaudeP0P4ReceiptFile(malformed), /valid JSON/)

    const oversized = join(directory, "oversized.json")
    await writeFile(oversized, JSON.stringify({ value: "x".repeat(64 * 1024) }))
    await assert.rejects(verifyClaudeP0P4ReceiptFile(oversized), /between 2 and/)

    assert.equal((await readFile(malformed, "utf8")), "{not-json")
  })
})
