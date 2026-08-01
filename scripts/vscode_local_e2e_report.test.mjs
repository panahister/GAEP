import assert from "node:assert/strict"
import test from "node:test"

import {
  composeReport,
  focusedTestFiles,
  parseNativeResult,
  parseVitestSummary,
} from "./vscode_local_e2e_report.mjs"

const native = {
  schemaVersion: 1,
  scope: "local-isolated-vscode",
  phases: ["open", "reopen", "multi-root", "installed"],
  packageLifecycle: {
    status: "passed",
    operations: ["previous-install", "upgrade", "reinstall", "rollback", "uninstall", "absence", "final-install"],
  },
  workspaceFingerprint: "unchanged",
  restartReopen: "explicit-command-after-isolated-restart",
  normalProfileTouched: false,
  externalSystemsUsed: false,
  otherHostMatricesRun: false,
}

test("parses only a passing focused summary", () => {
  assert.deepEqual(parseVitestSummary(" Test Files  10 passed (10)\n Tests  151 passed (151)"), {
    status: "passed",
    files: 10,
    tests: 151,
    skipped: 0,
  })
  assert.throws(() => parseVitestSummary("Tests failed"), /passing file and test summary/u)
})

test("requires the bounded VS Code-only native phases and safeguards", () => {
  const parsed = parseNativeResult(`noise\nGAEP_LOCAL_VSCODE_NATIVE_RESULT=${JSON.stringify(native)}\n`)
  assert.deepEqual(parsed, native)
  assert.throws(
    () => parseNativeResult(`GAEP_LOCAL_VSCODE_NATIVE_RESULT=${JSON.stringify({ ...native, normalProfileTouched: true })}`),
    /exceeded the local VS Code-only scope/u,
  )
})

test("composes one privacy-safe authority-bounded report", () => {
  const report = composeReport({
    checkpoint: "0123456",
    observedAt: "2026-08-01T00:00:00Z",
    focused: { status: "passed", files: 10, tests: 151, skipped: 0 },
    native,
    sourceDigests: [{ path: "apps/vscode/src/studio-session.test.ts", bytes: 1, sha256: "0".repeat(64) }],
  })
  assert.equal(report.result, "passed")
  assert.deepEqual(report.focusedVerification.files, focusedTestFiles)
  assert.equal(report.coverage.find((entry) => entry.id === "surface-states")?.status, "passed")
  assert.equal(report.scope.otherHostMatrices, "not-run")
  assert.equal(report.privacy.rawCommandOutputIncluded, false)
  assert.match(report.authorityBoundary, /grants no Product/u)
})
