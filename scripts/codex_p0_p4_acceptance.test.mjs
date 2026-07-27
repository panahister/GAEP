import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import test from "node:test"

import { runCodexP0P4Acceptance } from "./run_codex_p0_p4_acceptance.mjs"
import {
  canonicalDigest,
  verifyCodexP0P4ReceiptFile,
  verifyCodexP0P4ReceiptObject,
} from "./verify_codex_p0_p4_receipt.mjs"

const execute = promisify(execFile)
const repository = fileURLToPath(new URL("..", import.meta.url))
const runner = resolve(repository, "scripts/run_codex_p0_p4_acceptance.mjs")

async function withTemporaryDirectory(run) {
  const directory = await mkdtemp(join(tmpdir(), "gaep-codex-p0-p4-test-"))
  try {
    return await run(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test("repeats the strict Codex P0-P4 semantic receipt", async () => {
  const first = await runCodexP0P4Acceptance()
  const second = await runCodexP0P4Acceptance()
  assert.deepEqual(first, second)
  assert.equal(first.summary.referenceScenario.id, "phase-1-atlas-release-readiness-v1")
  assert.equal(first.summary.referenceScenario.productName, "Atlas Release Readiness")
  assert.equal(first.summary.referenceScenario.outputKinds.length, 25)
  assert.equal(first.summary.governedRecordCount, 21)
  assert.equal(first.summary.readiness.outputCount, 25)
  assert.equal(first.summary.readiness.result, "passed")
  assert.equal(first.summary.handoff.itemCount, 25)
  assert.equal(first.summary.handoff.state, "complete-for-review")
  assert.equal(first.summary.execution.mode, "codex-staged")
  assert.equal(first.summary.execution.stagingChangeCount, 0)
  assert.equal(first.summary.integrity.auditValid, true)
  assert.equal(first.summaryDigest, canonicalDigest(first.summary))
})

test("writes a private verified receipt once and refuses overwrite", async () => {
  await withTemporaryDirectory(async (directory) => {
    const receiptPath = join(directory, "receipt.json")
    const { stdout, stderr } = await execute(process.execPath, [runner, "--output", receiptPath], {
      cwd: repository,
      maxBuffer: 256 * 1024,
    })
    assert.equal(stderr, "")
    const stdoutReceipt = JSON.parse(stdout)
    const storedReceipt = await verifyCodexP0P4ReceiptFile(receiptPath)
    assert.deepEqual(stdoutReceipt, storedReceipt)
    await assert.rejects(
      execute(process.execPath, [runner, "--output", receiptPath], { cwd: repository, maxBuffer: 256 * 1024 }),
      /refusing to overwrite/,
    )
  })
})

test("rejects semantic, digest, source, authority, and shape tampering", async () => {
  const receipt = await runCodexP0P4Acceptance()

  const semantic = structuredClone(receipt)
  semantic.summary.execution.stagingChangeCount = 1
  semantic.summaryDigest = canonicalDigest(semantic.summary)
  await assert.rejects(verifyCodexP0P4ReceiptObject(semantic), /semantic summary differs/)

  const digest = structuredClone(receipt)
  digest.summaryDigest = `sha256:${"0".repeat(64)}`
  await assert.rejects(verifyCodexP0P4ReceiptObject(digest), /summary digest differs/)

  const source = structuredClone(receipt)
  source.scenario.testSourceDigest = `sha256:${"1".repeat(64)}`
  await assert.rejects(verifyCodexP0P4ReceiptObject(source), /source digest differs/)

  const scenario = structuredClone(receipt)
  scenario.scenario.referenceScenarioSourceDigest = `sha256:${"2".repeat(64)}`
  await assert.rejects(verifyCodexP0P4ReceiptObject(scenario), /source digest differs/)

  const authority = structuredClone(receipt)
  authority.authority.productOwnerAcceptance = "accepted"
  await assert.rejects(verifyCodexP0P4ReceiptObject(authority), /authority boundary differs/)

  const shape = structuredClone(receipt)
  shape.unexpected = true
  await assert.rejects(verifyCodexP0P4ReceiptObject(shape), /receipt keys differ/)
})

test("rejects malformed and oversized receipt files", async () => {
  await withTemporaryDirectory(async (directory) => {
    const malformed = join(directory, "malformed.json")
    await writeFile(malformed, "{not-json")
    await assert.rejects(verifyCodexP0P4ReceiptFile(malformed), /valid JSON/)

    const oversized = join(directory, "oversized.json")
    await writeFile(oversized, JSON.stringify({ value: "x".repeat(64 * 1024) }))
    await assert.rejects(verifyCodexP0P4ReceiptFile(oversized), /between 2 and/)

    assert.equal((await readFile(malformed, "utf8")), "{not-json")
  })
})
