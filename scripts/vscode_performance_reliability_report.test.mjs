import assert from "node:assert/strict"
import test from "node:test"

import {
  composePerformanceReliabilityReport,
  inspectReliabilityContracts,
  parsePerformanceMetrics,
  performanceBudgets,
  performanceFocusedTestFiles,
} from "./vscode_performance_reliability_report.mjs"

const studioMetrics = {
  largeTableRows: 1_000,
  protocolTableRowLimit: 10_000,
  renderMs: 100,
  sortMs: 80,
  exportMs: 10,
  filterMs: 50,
  heapDeltaBytes: 32 * 1024 * 1024,
  csvBytes: 80_000,
}

function nativeOutput(overrides = {}) {
  return ["open", "reopen", "multi-root", "installed"].flatMap((phase) => [
    `GAEP_PERFORMANCE_METRIC phase=${phase} activationMs=${overrides.activationMs ?? 50}`,
    `GAEP_PERFORMANCE_METRIC phase=${phase} hostPhaseMs=${overrides.hostPhaseMs ?? 1000}`,
  ]).join("\n")
}

const contracts = {
  managedStageRegistry: "const maximumReviewManifestBytes = 16 * 1024 * 1024\nconst readConcurrency = 32",
  managedExecution: "export const managedParallelReadOnlyConcurrency = 4\nconst readConcurrency = 64",
  managedRunSession: "stopAndWait(timeoutMs = 10_000)",
  studioDataSource: "expectedSnapshotRevision !== this.revision",
  packageContent: "const maximumContentFiles = 512\nconst maximumContentBytes = 32 * 1024 * 1024",
}

test("parses exact Product Studio and isolated-host metrics within budgets", () => {
  const metrics = parsePerformanceMetrics(
    `GAEP_PERFORMANCE_METRICS ${JSON.stringify(studioMetrics)}\n`,
    nativeOutput(),
  )
  assert.equal(metrics.studio.largeTableRows, 1_000)
  assert.equal(metrics.native.installed.activationMs, 50)
  assert.throws(
    () => parsePerformanceMetrics(
      `GAEP_PERFORMANCE_METRICS ${JSON.stringify({ ...studioMetrics, renderMs: performanceBudgets.operationMs + 1 })}\n`,
      nativeOutput(),
    ),
    /renderMs.*outside/u,
  )
})

test("binds the exact reviewed concurrency, size, shutdown, stale, and package contracts", () => {
  const result = inspectReliabilityContracts(contracts)
  assert.equal(result.managedStageReadConcurrency, 32)
  assert.equal(result.managedExecutionReadConcurrency, 64)
  assert.equal(result.parallelReadOnlyConcurrency, 4)
  assert.equal(result.staleProjectionRejection, true)
  assert.throws(
    () => inspectReliabilityContracts({ ...contracts, managedExecution: "const readConcurrency = 65" }),
    /differ/u,
  )
})

test("composes a bounded local pass without native power-loss authority", () => {
  const metrics = parsePerformanceMetrics(
    `GAEP_PERFORMANCE_METRICS ${JSON.stringify(studioMetrics)}\n`,
    nativeOutput(),
  )
  const report = composePerformanceReliabilityReport({
    checkpoint: "0123456",
    observedAt: "2026-08-01T00:00:00Z",
    focused: { status: "passed", files: performanceFocusedTestFiles.length, tests: 120, skipped: 0 },
    metrics,
    reliabilityContracts: inspectReliabilityContracts(contracts),
    packageArtifact: {
      path: "apps/vscode/dist/gaep-vscode.vsix",
      archiveBytes: 1_000_000,
      archiveSha256: "a".repeat(64),
      contentFiles: 8,
      contentBytes: 3_000_000,
      contentManifestSha256: "b".repeat(64),
      exactInstalledLifecycle: "passed",
    },
    sourceDigests: [{ path: "apps/vscode/src/studio-client.ts", bytes: 1, sha256: "c".repeat(64) }],
  })
  assert.equal(report.result, "local-budgets-passed-native-power-loss-pending")
  assert.equal(report.coverage.at(-1).status, "not-established")
  assert.match(report.authorityBoundary, /no sustained-production-load.*power-loss.*acceptance authority/u)
})

test("rejects incomplete or over-budget package evidence", () => {
  const metrics = parsePerformanceMetrics(
    `GAEP_PERFORMANCE_METRICS ${JSON.stringify(studioMetrics)}\n`,
    nativeOutput(),
  )
  assert.throws(() => composePerformanceReliabilityReport({
    checkpoint: "0123456",
    observedAt: "2026-08-01T00:00:00Z",
    focused: { status: "passed", files: performanceFocusedTestFiles.length, tests: 120, skipped: 0 },
    metrics,
    reliabilityContracts: inspectReliabilityContracts(contracts),
    packageArtifact: {
      archiveBytes: performanceBudgets.packageArchiveBytes + 1,
      contentFiles: 8,
      contentBytes: 3_000_000,
    },
    sourceDigests: [],
  }), /incomplete or over-budget/u)
})
