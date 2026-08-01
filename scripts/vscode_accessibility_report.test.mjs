import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  accessibilityTestFiles,
  composeAccessibilityReport,
  inspectAccessibilityManifest,
} from "./vscode_accessibility_report.mjs"

test("validates the exact accessible VS Code command and view manifest", async () => {
  const manifest = JSON.parse(await readFile(new URL("../apps/vscode/package.json", import.meta.url), "utf8"))
  const inspected = inspectAccessibilityManifest(manifest)
  assert.equal(inspected.views, 4)
  assert.ok(inspected.commands >= 40)

  const duplicated = structuredClone(manifest)
  duplicated.contributes.commands.push(structuredClone(duplicated.contributes.commands[0]))
  assert.throws(() => inspectAccessibilityManifest(duplicated), /unique bounded GAEP identifiers/u)
})

test("composes an authority-bounded automated-pass and manual-pending report", () => {
  const report = composeAccessibilityReport({
    checkpoint: "0123456",
    observedAt: "2026-08-01T00:00:00Z",
    focused: { status: "passed", files: accessibilityTestFiles.length, tests: 41, skipped: 0 },
    manifest: {
      commands: 54,
      views: 4,
      commandTitles: "bounded-and-nonempty",
      viewNames: "exact-and-nonempty",
      activationEvents: "complete",
    },
    sourceDigests: [{ path: "apps/vscode/src/studio-client.ts", bytes: 1, sha256: "0".repeat(64) }],
  })
  assert.equal(report.result, "automated-passed-manual-pending")
  assert.equal(report.manualChecklist.signed, false)
  assert.equal(report.coverage.find(({ id }) => id === "manual-native-accessibility")?.status, "pending-human")
  assert.match(report.authorityBoundary, /no manual.*acceptance authority/u)
})

test("rejects an incomplete accessibility focused result", () => {
  assert.throws(() => composeAccessibilityReport({
    checkpoint: "0123456",
    observedAt: "2026-08-01T00:00:00Z",
    focused: { status: "passed", files: accessibilityTestFiles.length, tests: 39, skipped: 0 },
    manifest: {},
    sourceDigests: [],
  }), /exact minimum gate/u)
})
