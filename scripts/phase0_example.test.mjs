import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import test from "node:test"

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
    assert.deepEqual(stdoutReceipt, receipt)
    const workspace = await lstat(join(artifacts, "workspace"))
    const gaepStore = await lstat(join(artifacts, "workspace", ".gaep"))
    assert.equal(workspace.isDirectory(), true)
    assert.equal(gaepStore.isDirectory(), true)
    const serialized = JSON.stringify(receipt)
    assert.equal(serialized.includes(directory), false)
    assert.equal(serialized.includes("deterministic output"), false)
    assert.equal(serialized.includes("manual-thread-"), false)

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
