import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import test from "node:test"

import JSZip from "jszip"

import { verifyKiroPackage } from "./verify-package.mjs"

const kiroRoot = resolve(import.meta.dirname, "..")
const packagePath = resolve(kiroRoot, "dist/gaep-kiro.vsix")

async function withTemporaryDirectory(run) {
  const directory = await mkdtemp(join(tmpdir(), "gaep-kiro-package-contract-"))
  try {
    return await run(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test("verifies the exact bounded Kiro VSIX payload and built-byte parity", async () => {
  const result = await verifyKiroPackage(packagePath)
  assert.equal(result.kind, "gaep-kiro-vsix-verification-v1")
  assert.equal(result.packageId, "gaep.gaep-kiro@0.1.0")
  assert.equal(result.entries, 7)
  assert.equal(result.commands, 77)
  assert.equal(result.nativeKiroAcceptance, "not-established")
  assert.match(result.archiveDigest, /^sha256:[0-9a-f]{64}$/u)
  assert.match(result.engineDigest, /^sha256:[0-9a-f]{64}$/u)
})

test("rejects an unlisted package payload", async () => {
  await withTemporaryDirectory(async (directory) => {
    const archive = await JSZip.loadAsync(await readFile(packagePath))
    archive.file("extension/unexpected.txt", "unexpected", { createFolders: false })
    const hostile = join(directory, "unexpected.vsix")
    await writeFile(hostile, await archive.generateAsync({ type: "nodebuffer" }))
    await assert.rejects(verifyKiroPackage(hostile), /archive entries differ/u)
  })
})

test("rejects a rebound VSIX identity", async () => {
  await withTemporaryDirectory(async (directory) => {
    const archive = await JSZip.loadAsync(await readFile(packagePath))
    const manifest = await archive.file("extension.vsixmanifest").async("string")
    archive.file("extension.vsixmanifest", manifest.replace('Id="gaep-kiro"', 'Id="different-package"'))
    const hostile = join(directory, "rebound.vsix")
    await writeFile(hostile, await archive.generateAsync({ type: "nodebuffer" }))
    await assert.rejects(verifyKiroPackage(hostile), /missing exact marker/u)
  })
})
