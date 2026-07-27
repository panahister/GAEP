import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import test from "node:test"

import { runProviderOutputComparison } from "./run_provider_output_comparison.mjs"
import {
  canonicalDigest,
  verifyProviderOutputComparisonFile,
  verifyProviderOutputComparisonObject,
} from "./verify_provider_output_comparison_receipt.mjs"

const execute = promisify(execFile)
const repository = fileURLToPath(new URL("..", import.meta.url))
const runner = resolve(repository, "scripts/run_provider_output_comparison.mjs")

async function withTemporaryDirectory(run) {
  const directory = await mkdtemp(join(tmpdir(), "gaep-provider-comparison-test-"))
  try {
    return await run(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test("derives one deterministic structural comparison without ranking providers", async () => {
  const first = await runProviderOutputComparison()
  const second = await runProviderOutputComparison()
  assert.deepEqual(first, second)
  assert.equal(first.scenario.id, "P1-32")
  assert.equal(first.comparison.summary.criteriaCount, 8)
  assert.equal(first.comparison.summary.structuralCriteriaSatisfied, 6)
  assert.equal(first.comparison.summary.structuralCriteriaDiverged, 0)
  assert.equal(first.comparison.summary.qualityCriteriaNotAssessed, 2)
  assert.equal(first.comparison.summary.expectedRuntimeDivergenceCount, 5)
  assert.equal(first.comparison.summary.materialDivergenceCount, 0)
  assert.equal(first.comparison.summary.structuralResult, "satisfied")
  assert.equal(first.comparison.summary.semanticQuality, "not-assessed")
  assert.equal(first.comparison.summary.liveProviderQuality, "not-assessed")
  assert.equal(first.comparison.summary.providerPreference, "not-established")
  assert.equal(first.comparison.summary.automaticSelectionAuthority, "not-granted")
  assert.equal(first.comparisonDigest, canonicalDigest(first.comparison))
})

test("writes a private comparison once and refuses overwrite", async () => {
  await withTemporaryDirectory(async (directory) => {
    const receiptPath = join(directory, "comparison.json")
    const { stdout, stderr } = await execute(process.execPath, [runner, "--output", receiptPath], {
      cwd: repository,
      maxBuffer: 512 * 1024,
    })
    assert.equal(stderr, "")
    const stdoutReceipt = JSON.parse(stdout)
    const storedReceipt = await verifyProviderOutputComparisonFile(receiptPath)
    assert.deepEqual(stdoutReceipt, storedReceipt)
    await assert.rejects(
      execute(process.execPath, [runner, "--output", receiptPath], { cwd: repository, maxBuffer: 512 * 1024 }),
      /refusing to overwrite/,
    )
  })
})

test("rejects forged quality, preference, divergence, source, digest, and shape claims", async () => {
  const receipt = await runProviderOutputComparison()

  const quality = structuredClone(receipt)
  quality.comparison.summary.semanticQuality = "satisfied"
  quality.comparisonDigest = canonicalDigest(quality.comparison)
  await assert.rejects(verifyProviderOutputComparisonObject(quality), /fail-closed comparison projection/)

  const preference = structuredClone(receipt)
  preference.authority.providerPreference = "claude"
  await assert.rejects(verifyProviderOutputComparisonObject(preference), /fail-closed comparison projection/)

  const divergence = structuredClone(receipt)
  divergence.comparison.divergences[0].classification = "material"
  divergence.comparison.divergencesDigest = canonicalDigest(divergence.comparison.divergences)
  divergence.comparisonDigest = canonicalDigest(divergence.comparison)
  await assert.rejects(verifyProviderOutputComparisonObject(divergence), /fail-closed comparison projection/)

  const source = structuredClone(receipt)
  source.inputs.codex.path = "../outside.json"
  await assert.rejects(verifyProviderOutputComparisonObject(source), /stay inside the repository/)

  const digest = structuredClone(receipt)
  digest.inputsDigest = `sha256:${"0".repeat(64)}`
  await assert.rejects(verifyProviderOutputComparisonObject(digest), /fail-closed comparison projection/)

  const shape = structuredClone(receipt)
  shape.unexpected = true
  await assert.rejects(verifyProviderOutputComparisonObject(shape), /fail-closed comparison projection/)
})

test("rejects malformed and oversized comparison files", async () => {
  await withTemporaryDirectory(async (directory) => {
    const malformed = join(directory, "malformed.json")
    await writeFile(malformed, "{not-json")
    await assert.rejects(verifyProviderOutputComparisonFile(malformed), /valid JSON/)

    const oversized = join(directory, "oversized.json")
    await writeFile(oversized, JSON.stringify({ value: "x".repeat(128 * 1024) }))
    await assert.rejects(verifyProviderOutputComparisonFile(oversized), /between 2 and/)

    assert.equal(await readFile(malformed, "utf8"), "{not-json")
  })
})
