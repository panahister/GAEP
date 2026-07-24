import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, before, describe, it } from "node:test"

import { verifyVisualStudioWindowsReceipt } from "./verify_visual_studio_windows_receipt.mjs"

const revision = "1".repeat(40)
let temporaryRoot
let vsixPath
let receiptPath
let validReceipt

before(async () => {
  temporaryRoot = await mkdtemp(join(tmpdir(), "gaep-visual-studio-windows-receipt-"))
  vsixPath = join(temporaryRoot, "Gaep.VisualStudio.vsix")
  receiptPath = join(temporaryRoot, "visual-studio-windows.json")
  const vsix = Buffer.from("bounded synthetic VSIX receipt fixture", "utf8")
  await writeFile(vsixPath, vsix)
  validReceipt = {
    schemaVersion: 1,
    kind: "gaep-visual-studio-windows-package-lifecycle-v1",
    recordedAt: "2026-07-24T16:30:00.0000000+00:00",
    revision,
    runnerImage: "win22",
    visualStudioVersion: "17.14.37314.3",
    package: {
      id: "Gaep.VisualStudio.90e45161-916c-4c39-b2bf-c2379c168fe9",
      version: "0.1.0.0",
      bytes: vsix.length,
      digest: `sha256:${createHash("sha256").update(vsix).digest("hex")}`,
    },
    lifecycle: {
      install: "verified",
      uninstall: "verified-absent",
      reinstall: "verified",
      cleanup: "verified-absent",
    },
    remainingRequirements: [
      "Visual Studio activation and rendered Remote UI automation",
      "installed-package engine workflow",
      "real-provider managed read-only and staged-review workflows",
      "supported Windows and Visual Studio matrix",
      "publisher provenance, signing, and Product Owner acceptance",
    ],
    claimBoundary: "This receipt proves one ephemeral Windows runner package lifecycle only. It is not activation, UI, provider, signing, supported-matrix, release, or human acceptance evidence.",
  }
})

after(async () => {
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true })
})

async function verify(receipt) {
  await writeFile(receiptPath, `${JSON.stringify(receipt)}\n`)
  return verifyVisualStudioWindowsReceipt({ receiptPath, vsixPath, expectedRevision: revision })
}

describe("Visual Studio Windows lifecycle receipt verifier", () => {
  it("binds the exact private-safe receipt to the VSIX and CI revision", async () => {
    const result = await verify(validReceipt)
    assert.equal(result.vsixBytes, validReceipt.package.bytes)
    assert.equal(result.digest, validReceipt.package.digest)
  })

  it("fails closed on stale package bytes or unexpected receipt fields", async () => {
    await assert.rejects(verify({
      ...validReceipt,
      package: { ...validReceipt.package, digest: `sha256:${"0".repeat(64)}` },
    }), /package digest is stale/u)
    await assert.rejects(verify({ ...validReceipt, localPath: "C:\\private\\extension" }),
      /fields are incomplete or unexpected/u)
  })
})
