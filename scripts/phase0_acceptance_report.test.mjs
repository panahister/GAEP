import assert from "node:assert/strict"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  buildPhase0AcceptanceReport,
  verifyPhase0AcceptanceReportObject,
} from "./phase0_acceptance_report.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const recordedAt = "2026-07-24T23:45:00Z"
const sourceCommit = "0".repeat(40)

function passingTestEvidence() {
  const outputDigest = `sha256:${"1".repeat(64)}`
  return [
    {
      id: "typecheck",
      command: "npm run typecheck",
      result: "pass",
      summary: { projects: "workspace-build-graph", errors: 0 },
      outputDigest,
    },
    {
      id: "repository-tests",
      command: "npm run test",
      result: "pass",
      summary: { filesPassed: 71, testsPassed: 724, testsSkipped: 1, testsFailed: 0 },
      outputDigest,
    },
    {
      id: "windows-ci-contract",
      command: "npm run test:ci-contract",
      result: "pass",
      summary: { tests: 4, passed: 4, failed: 0, skipped: 0 },
      outputDigest,
    },
    {
      id: "canonical-example",
      command: "npm run test:example",
      result: "pass",
      summary: { tests: 5, passed: 5, failed: 0, skipped: 0 },
      outputDigest,
    },
    {
      id: "documentation",
      command: "npm run validate:docs",
      result: "pass",
      summary: { documents: 83, requirements: 868, warnings: 0 },
      outputDigest,
    },
    {
      id: "ide-conformance",
      command: "npm run test:ide-conformance",
      result: "pass",
      summary: { tests: 10, passed: 10, failed: 0, skipped: 0 },
      outputDigest,
    },
    {
      id: "phase-report-contract",
      command: "npm run test:phase-report",
      result: "pass",
      summary: { tests: 4, passed: 4, failed: 0, skipped: 0 },
      outputDigest,
    },
  ]
}

test("binds exact Phase 0 package, conformance, provider, host, example, test and gap truth", async () => {
  const report = await buildPhase0AcceptanceReport({ root, recordedAt, sourceCommit, testEvidence: passingTestEvidence() })
  assert.equal(report.verificationResult, "pass")
  assert.equal(report.phase, "phase-2-ux-figma-loop")
  assert.equal(report.evidenceScope, "phase-2-screen-state-inventory-local")
  assert.match(report.claimBoundary, /exact governed Screen and State Inventory candidate lifecycle/u)
  assert.equal(report.reportingStatus, "current-local-evidence-bound")
  assert.equal(report.phaseGate, "incomplete")
  assert.equal(report.acceptance, "not-established")
  assert.equal(report.securityReview, "not-completed-explicitly-skipped")
  assert.equal(report.releaseAuthorization, "not-authorized")
  assert.equal(report.summary.packagesProduced, 3)
  assert.equal(report.summary.hostsAccepted, 0)
  assert.equal(report.summary.providersAccepted, 0)
  assert.equal(report.sources.length, 6)
  assert.equal(report.tests.length, 7)
  assert.equal(report.knownGaps.length, 6)
  assert.equal(report.knownGaps.at(-1).id, "phase-2-screen-state-inventory-closure")
  await verifyPhase0AcceptanceReportObject(report, { root })
})

test("rejects a forged phase acceptance or release claim", async () => {
  const report = await buildPhase0AcceptanceReport({ root, recordedAt, sourceCommit, testEvidence: passingTestEvidence() })
  report.phaseGate = "complete"
  report.acceptance = "accepted"
  report.releaseAuthorization = "authorized"
  await assert.rejects(
    verifyPhase0AcceptanceReportObject(report, { root }),
    /fail-closed acceptance projection/,
  )
})

test("rejects source-evidence rebinding even when the claimed source digest is well formed", async () => {
  const report = await buildPhase0AcceptanceReport({ root, recordedAt, sourceCommit, testEvidence: passingTestEvidence() })
  report.sources[1].digest = `sha256:${"2".repeat(64)}`
  await assert.rejects(
    verifyPhase0AcceptanceReportObject(report, { root }),
    /fail-closed acceptance projection/,
  )
})

test("rejects failed, missing, reordered, or invented validation gates", async () => {
  const failed = passingTestEvidence()
  failed[1].summary.testsFailed = 1
  await assert.rejects(
    buildPhase0AcceptanceReport({ root, recordedAt, sourceCommit, testEvidence: failed }),
    /repository-tests is not clean/,
  )
  const reordered = passingTestEvidence().reverse()
  await assert.rejects(
    buildPhase0AcceptanceReport({ root, recordedAt, sourceCommit, testEvidence: reordered }),
    /test evidence 0 differs/,
  )
})
