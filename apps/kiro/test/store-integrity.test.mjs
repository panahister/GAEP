import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import storeIntegrity from "./e2e/store-integrity.cjs"

const { inspectPortableStore, verifyPortableStore } = storeIntegrity

async function withStore(run) {
  const directory = await mkdtemp(join(tmpdir(), "gaep-kiro-store-contract-"))
  const store = join(directory, ".gaep")
  try {
    await mkdir(join(store, "records"), { recursive: true })
    await writeFile(join(store, "manifest.json"), "{\"kind\":\"fixture\"}\n", "utf8")
    await writeFile(join(store, "records", "product.json"), "{\"revision\":1}\n", "utf8")
    return await run({ directory, store })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test("binds every bounded regular fixture-store file without exposing its root", async () => {
  await withStore(async ({ directory, store }) => {
    const manifest = await inspectPortableStore(store)
    assert.equal(manifest.kind, "gaep-kiro-e2e-store-manifest-v1")
    assert.equal(manifest.fileCount, 2)
    assert.deepEqual(manifest.files.map((entry) => entry.path), ["manifest.json", "records/product.json"])
    assert.match(manifest.digest, /^sha256:[0-9a-f]{64}$/u)
    assert.equal(JSON.stringify(manifest).includes(directory), false)
    assert.deepEqual(await verifyPortableStore(store, manifest), manifest)
  })
})

test("rejects content tampering and unlisted-file injection against the exact baseline", async () => {
  await withStore(async ({ store }) => {
    const baseline = await inspectPortableStore(store)
    await writeFile(join(store, "records", "product.json"), "{\"revision\":2}\n", "utf8")
    await assert.rejects(verifyPortableStore(store, baseline), /differs from the exact baseline/u)
    await writeFile(join(store, "records", "product.json"), "{\"revision\":1}\n", "utf8")
    await writeFile(join(store, "unlisted.json"), "{}\n", "utf8")
    await assert.rejects(verifyPortableStore(store, baseline), /differs from the exact baseline/u)
  })
})

test("rejects symbolic links inside the fixture store", { skip: process.platform === "win32" }, async () => {
  await withStore(async ({ directory, store }) => {
    await writeFile(join(directory, "outside.json"), "{}\n", "utf8")
    await symlink(join(directory, "outside.json"), join(store, "linked.json"))
    await assert.rejects(inspectPortableStore(store), /must not be a symbolic link/u)
  })
})
