import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"

import {
  compareVisualCapture,
  composeVisualRegressionReport,
  inspectPng,
  validateVisualBaselineManifest,
  validateVisualScenarioMatrix,
  validateVisualSourceBinding,
  visualFocusedTestFiles,
  visualScenarioMatrix,
} from "./vscode_visual_regression.mjs"

function png(width, height, marker = 0) {
  const bytes = Buffer.alloc(33, marker)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0)
  bytes.writeUInt32BE(13, 8)
  bytes.write("IHDR", 12, "ascii")
  bytes.writeUInt32BE(width, 16)
  bytes.writeUInt32BE(height, 20)
  return bytes
}

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function manifest(rendererFingerprint = "google-chrome-1.2.3.4-headless-dsf1") {
  return {
    schemaVersion: 1,
    kind: "gaep-vscode-product-studio-visual-baseline",
    renderer: {
      name: "chrome-headless",
      product: "Google Chrome",
      version: "1.2.3.4",
      fingerprint: rendererFingerprint,
    },
    source: { bundleSha256: "a".repeat(64), scenarioCatalogSha256: "b".repeat(64) },
    scenarios: visualScenarioMatrix.map((scenario) => {
      const bytes = png(scenario.width, scenario.height)
      return {
        id: scenario.id,
        route: scenario.route,
        surface: scenario.surface,
        theme: scenario.theme,
        viewport: { width: scenario.width, height: scenario.height },
        image: {
          path: `apps/vscode/test/visual/baselines/p3b22/${scenario.id}.png`,
          bytes: bytes.byteLength,
          sha256: hash(bytes),
          width: scenario.width,
          height: scenario.height,
        },
        dom: { ready: true, tableCount: scenario.route === "delivery" ? 45 : 0 },
      }
    }),
    authorityBoundary: "Fixture only.",
    limitations: ["renderer-bound", "fixture-only", "human-pending"],
  }
}

test("validates the exact bounded visual scenario matrix", () => {
  assert.deepEqual(validateVisualScenarioMatrix(), { scenarios: 6, routes: 4, surfaces: 3, themes: 2 })
  assert.throws(
    () => validateVisualScenarioMatrix(visualScenarioMatrix.slice(0, 5)),
    /exactly six scenarios/u,
  )
})

test("validates renderer-bound baseline manifests and rejects drift", () => {
  const candidate = manifest()
  assert.equal(validateVisualBaselineManifest(candidate, candidate.renderer.fingerprint).scenarios, 6)
  assert.throws(
    () => validateVisualBaselineManifest(candidate, "google-chrome-9.9.9.9-headless-dsf1"),
    /different renderer/u,
  )
  const missing = structuredClone(candidate)
  missing.scenarios.pop()
  assert.throws(() => validateVisualBaselineManifest(missing, candidate.renderer.fingerprint), /malformed/u)
})

test("detects exact PNG baseline tamper and candidate regressions", () => {
  const bytes = png(1280, 900)
  const entry = {
    id: "overview-ready-wide",
    viewport: { width: 1280, height: 900 },
    image: { ...inspectPng(bytes), path: "unused" },
  }
  assert.equal(compareVisualCapture(entry, bytes, Buffer.from(bytes)).sha256, entry.image.sha256)
  const changed = Buffer.from(bytes)
  changed[32] = 1
  assert.throws(() => compareVisualCapture(entry, bytes, changed), /Visual regression detected/u)
  assert.throws(() => compareVisualCapture(entry, changed, bytes), /tampered or stale/u)
})

test("rejects stale visual source and scenario bindings", () => {
  const bundle = Buffer.from("bundle")
  const scenarios = Buffer.from("scenarios")
  const candidate = manifest()
  candidate.source = {
    bundleSha256: hash(bundle),
    scenarioCatalogSha256: hash(scenarios),
  }
  assert.equal(validateVisualSourceBinding(candidate, bundle, scenarios).bundleSha256, hash(bundle))
  assert.throws(
    () => validateVisualSourceBinding(candidate, Buffer.from("changed"), scenarios),
    /stale or tampered/u,
  )
})

test("composes an authority-bounded exact-fixture report", () => {
  const report = composeVisualRegressionReport({
    checkpoint: "0123456",
    observedAt: "2026-08-01T00:00:00Z",
    renderer: manifest().renderer,
    baselineManifestSha256: "c".repeat(64),
    focused: { status: "passed", files: visualFocusedTestFiles.length, tests: 24, skipped: 0 },
    captures: visualScenarioMatrix.map((scenario) => ({
      id: scenario.id,
      status: "exact-match",
    })),
    sourceDigests: [{ path: "apps/vscode/src/studio-client.ts", bytes: 1, sha256: "d".repeat(64) }],
  })
  assert.equal(report.result, "fixture-baselines-exact-human-design-acceptance-pending")
  assert.equal(report.baseline.environmentBound, true)
  assert.match(report.authorityBoundary, /no Figma.*human design.*acceptance authority/u)
})

test("rejects incomplete visual verification", () => {
  assert.throws(() => composeVisualRegressionReport({
    checkpoint: "0123456",
    observedAt: "2026-08-01T00:00:00Z",
    renderer: manifest().renderer,
    baselineManifestSha256: "c".repeat(64),
    focused: { status: "passed", files: visualFocusedTestFiles.length, tests: 19, skipped: 0 },
    captures: [],
    sourceDigests: [],
  }), /incomplete verification/u)
})
