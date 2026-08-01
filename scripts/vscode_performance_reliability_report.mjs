import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { stat } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { readVsixContentManifest } from "../apps/vscode/test/e2e/package-content.mjs"
import {
  readRepositoryRegularFile,
  writeExclusiveRepositoryFile,
} from "./lib/repository-files.mjs"
import { parseVitestSummary } from "./vscode_local_e2e_report.mjs"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const packagePath = "apps/vscode/dist/gaep-vscode.vsix"
const nativePhases = ["open", "reopen", "multi-root", "installed"]

export const performanceFocusedTestFiles = [
  "apps/vscode/src/studio-performance.test.ts",
  "apps/vscode/src/studio-session.test.ts",
  "apps/vscode/src/studio-data-source.test.ts",
  "apps/vscode/src/current-engine-studio-data-source.test.ts",
  "apps/vscode/src/managed-run-session.test.ts",
  "packages/agent-sdk/src/managed-stage-registry.test.ts",
  "packages/engine/src/managed-execution.test.ts",
]

export const performanceBudgets = Object.freeze({
  largeTableRows: 1_000,
  protocolTableRowLimit: 10_000,
  operationMs: 10_000,
  exportMs: 2_000,
  heapDeltaBytes: 256 * 1024 * 1024,
  csvBytes: 4 * 1024 * 1024,
  activationMs: 10_000,
  hostPhaseMs: 120_000,
  packageArchiveBytes: 16 * 1024 * 1024,
  packageContentFiles: 512,
  packageContentBytes: 32 * 1024 * 1024,
})

const reliabilitySourcePaths = {
  managedStageRegistry: "packages/agent-sdk/src/managed-stage-registry.ts",
  managedExecution: "packages/engine/src/managed-execution.ts",
  managedRunSession: "apps/vscode/src/managed-run-session.ts",
  studioDataSource: "apps/vscode/src/current-engine-studio-data-source.ts",
  packageContent: "apps/vscode/test/e2e/package-content.mjs",
}

const reportInputFiles = [
  ...Object.values(reliabilitySourcePaths),
  "apps/vscode/src/studio-performance.test.ts",
  "apps/vscode/src/studio-session.test.ts",
  "apps/vscode/src/managed-run-session.test.ts",
  "apps/vscode/test/e2e/run.mjs",
  "apps/vscode/test/e2e/suite/index.cjs",
  "apps/vscode/test/performance/README.md",
  "scripts/vscode_performance_reliability_report.mjs",
  "scripts/vscode_performance_reliability_report.test.mjs",
]

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function boundedInteger(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} is absent or outside the supported bound`)
  }
  return value
}

export function parsePerformanceMetrics(vitestOutput, nativeOutput) {
  const studioMatches = [...vitestOutput.matchAll(/^GAEP_PERFORMANCE_METRICS (\{[^\n]+\})$/gmu)]
  if (studioMatches.length !== 1) throw new Error("Expected exactly one Product Studio performance metric record")
  const studio = JSON.parse(studioMatches[0][1])
  const exactStudioKeys = [
    "largeTableRows", "protocolTableRowLimit", "renderMs", "sortMs", "exportMs", "filterMs",
    "heapDeltaBytes", "csvBytes",
  ]
  if (!isObject(studio) || JSON.stringify(Object.keys(studio).sort()) !== JSON.stringify(exactStudioKeys.sort())) {
    throw new Error("Product Studio performance metric record is malformed")
  }
  boundedInteger(studio.largeTableRows, performanceBudgets.largeTableRows, performanceBudgets.largeTableRows, "Large-table row count")
  boundedInteger(studio.protocolTableRowLimit, performanceBudgets.protocolTableRowLimit, performanceBudgets.protocolTableRowLimit, "Protocol row limit")
  for (const operation of ["renderMs", "sortMs", "filterMs"]) {
    boundedInteger(studio[operation], 0, performanceBudgets.operationMs, `Product Studio ${operation}`)
  }
  boundedInteger(studio.exportMs, 0, performanceBudgets.exportMs, "Product Studio exportMs")
  boundedInteger(studio.heapDeltaBytes, 0, performanceBudgets.heapDeltaBytes, "Product Studio heap delta")
  boundedInteger(studio.csvBytes, 1, performanceBudgets.csvBytes, "Product Studio CSV bytes")

  const native = Object.fromEntries(nativePhases.map((phase) => [phase, {}]))
  for (const match of nativeOutput.matchAll(/^GAEP_PERFORMANCE_METRIC phase=(open|reopen|multi-root|installed) (activationMs|hostPhaseMs)=(\d+)$/gmu)) {
    const [, phase, metric, rawValue] = match
    if (native[phase][metric] !== undefined) throw new Error(`Duplicate native performance metric: ${phase}.${metric}`)
    native[phase][metric] = Number(rawValue)
  }
  for (const phase of nativePhases) {
    boundedInteger(native[phase].activationMs, 0, performanceBudgets.activationMs, `${phase} activation`)
    boundedInteger(native[phase].hostPhaseMs, 1, performanceBudgets.hostPhaseMs, `${phase} host phase`)
  }
  return { studio, native }
}

export function inspectReliabilityContracts(sources) {
  const expected = Object.keys(reliabilitySourcePaths)
  if (!isObject(sources) || expected.some((key) => typeof sources[key] !== "string")) {
    throw new Error("Reliability source inventory is incomplete")
  }
  const checks = {
    managedStageReadConcurrency: /const readConcurrency = 32/u.test(sources.managedStageRegistry) ? 32 : 0,
    managedExecutionReadConcurrency: /const readConcurrency = 64/u.test(sources.managedExecution) ? 64 : 0,
    parallelReadOnlyConcurrency: /export const managedParallelReadOnlyConcurrency = 4/u.test(sources.managedExecution) ? 4 : 0,
    reviewManifestBytes: /const maximumReviewManifestBytes = 16 \* 1024 \* 1024/u.test(sources.managedStageRegistry)
      ? 16 * 1024 * 1024 : 0,
    shutdownTimeoutMs: /stopAndWait\(timeoutMs = 10_000\)/u.test(sources.managedRunSession) ? 10_000 : 0,
    staleProjectionRejection: /expectedSnapshotRevision !== this\.revision/u.test(sources.studioDataSource),
    packageContentFiles: /const maximumContentFiles = 512/u.test(sources.packageContent) ? 512 : 0,
    packageContentBytes: /const maximumContentBytes = 32 \* 1024 \* 1024/u.test(sources.packageContent)
      ? 32 * 1024 * 1024 : 0,
  }
  if (checks.managedStageReadConcurrency !== 32 || checks.managedExecutionReadConcurrency !== 64 ||
      checks.parallelReadOnlyConcurrency !== 4 || checks.reviewManifestBytes !== 16 * 1024 * 1024 ||
      checks.shutdownTimeoutMs !== 10_000 || checks.staleProjectionRejection !== true ||
      checks.packageContentFiles !== performanceBudgets.packageContentFiles ||
      checks.packageContentBytes !== performanceBudgets.packageContentBytes) {
    throw new Error("Reliability source bounds differ from the exact reviewed contract")
  }
  return checks
}

export function composePerformanceReliabilityReport({
  checkpoint,
  observedAt,
  focused,
  metrics,
  reliabilityContracts,
  packageArtifact,
  sourceDigests,
}) {
  if (focused.status !== "passed" || focused.files !== performanceFocusedTestFiles.length || focused.tests < 100 ||
      !isObject(metrics?.studio) || !isObject(metrics?.native) ||
      nativePhases.some((phase) => !isObject(metrics.native[phase])) ||
      !isObject(reliabilityContracts) ||
      !isObject(packageArtifact) || packageArtifact.archiveBytes < 1 ||
      packageArtifact.archiveBytes > performanceBudgets.packageArchiveBytes ||
      packageArtifact.contentFiles < 1 || packageArtifact.contentFiles > performanceBudgets.packageContentFiles ||
      packageArtifact.contentBytes < 1 || packageArtifact.contentBytes > performanceBudgets.packageContentBytes) {
    throw new Error("Performance and reliability report cannot compose from incomplete or over-budget evidence")
  }
  return {
    schemaVersion: 1,
    kind: "gaep-local-vscode-performance-reliability-report",
    scope: {
      host: "vscode",
      execution: "local-bounded-fixtures-and-isolated-host",
      repositoryCheckpoint: checkpoint,
      observedAt,
      normalProfile: "not-touched",
      otherHostMatrices: "not-run",
      externalSystems: "not-used",
    },
    result: "local-budgets-passed-native-power-loss-pending",
    focusedVerification: {
      status: "passed",
      files: [...performanceFocusedTestFiles],
      fileCount: focused.files,
      tests: focused.tests,
      skipped: focused.skipped,
    },
    budgets: performanceBudgets,
    measurements: metrics,
    reliabilityContracts,
    package: packageArtifact,
    coverage: [
      { id: "large-table-inventory", status: "passed-local", rows: metrics.studio.largeTableRows, protocolLimit: metrics.studio.protocolTableRowLimit },
      { id: "filter-sort-export-bounds", status: "passed-local" },
      { id: "bounded-read-concurrency", status: "passed-contract-and-focused" },
      { id: "cancellation-timeout-partial-failure", status: "passed-focused" },
      { id: "restart-reopen-and-crash-window", status: "passed-isolated-and-focused" },
      { id: "stale-projection-rejection", status: "passed-focused" },
      { id: "isolated-activation-time", status: "passed-measured" },
      { id: "heap-file-count-file-size-bounds", status: "passed-local" },
      { id: "native-power-loss-hostile-same-uid", status: "not-established" },
    ],
    sourceDigests,
    privacy: {
      rawTestOutputIncluded: false,
      absoluteMachinePathsIncluded: false,
      environmentValuesIncluded: false,
      sourceBytesIncluded: false,
      secretsIncluded: false,
    },
    authorityBoundary: "This report establishes bounded local fixture and isolated VS Code performance/reliability budgets only. It grants no sustained-production-load, native power-loss, hostile same-UID, supported-platform, live-provider, Figma, security, human, Product Owner, release, publication, deployment, or other-host acceptance authority.",
    limitations: [
      "Measured timings and heap deltas are machine-local observations with generous regression budgets, not production capacity or service-level objectives.",
      "The isolated host measures activation and phase duration on one local macOS/VS Code environment; supported-platform and normal-profile behavior remain untested.",
      "Deterministic fixtures cover cancellation, timeout, partial failure, restart/reopen, crash-window and stale-binding behavior but not physical power loss or hostile same-UID interference.",
      "No live provider, Figma, external system, publication, release or deployment action is used.",
    ],
  }
}

async function runCommand(executable, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(executable, args, {
      cwd: repositoryRoot,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    })
    let output = ""
    const append = (chunk, target) => {
      output += chunk
      if (Buffer.byteLength(output) > 16 * 1024 * 1024) {
        child.kill("SIGTERM")
        reject(new Error("Performance verification output exceeded its 16 MiB bound"))
        return
      }
      target.write(chunk)
    }
    child.stdout.on("data", (chunk) => append(chunk, process.stdout))
    child.stderr.on("data", (chunk) => append(chunk, process.stderr))
    child.on("error", reject)
    child.on("exit", (code, signal) => {
      if (code === 0) resolvePromise(output)
      else reject(new Error(`Performance verification failed with ${signal ? `signal ${signal}` : `exit code ${String(code)}`}`))
    })
  })
}

function parseArguments(args) {
  const result = { output: undefined, checkpoint: "working-tree", observedAt: "not-recorded" }
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]
    if (!["--output", "--checkpoint", "--observed-at"].includes(flag)) throw new Error(`Unknown argument: ${flag}`)
    const value = args[index + 1]
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`)
    if (flag === "--output") result.output = value
    if (flag === "--checkpoint") result.checkpoint = value
    if (flag === "--observed-at") result.observedAt = value
    index += 1
  }
  if (!/^(?:working-tree|[0-9a-f]{7,64})$/u.test(result.checkpoint)) {
    throw new Error("--checkpoint must be working-tree or a Git object ID")
  }
  if (result.observedAt !== "not-recorded" && Number.isNaN(Date.parse(result.observedAt))) {
    throw new Error("--observed-at must be an ISO-8601 timestamp")
  }
  return result
}

async function reliabilitySources() {
  const sources = {}
  for (const [key, path] of Object.entries(reliabilitySourcePaths)) {
    const artifact = await readRepositoryRegularFile(repositoryRoot, path, { maximumBytes: 8 * 1024 * 1024 })
    sources[key] = artifact.bytes.toString("utf8")
  }
  return sources
}

async function sourceDigests() {
  const entries = []
  for (const path of [...new Set(reportInputFiles)].sort()) {
    const artifact = await readRepositoryRegularFile(repositoryRoot, path, { maximumBytes: 16 * 1024 * 1024 })
    entries.push({ path, bytes: artifact.bytes.byteLength, sha256: sha256(artifact.bytes) })
  }
  return entries
}

function assertPrivacySafe(report) {
  const serialized = JSON.stringify(report)
  for (const prefix of ["/Users/", "/home/", "C:\\Users\\", "/tmp/", "/private/tmp/"]) {
    if (serialized.includes(prefix)) throw new Error(`Performance report contains an absolute path prefix: ${prefix}`)
  }
  if (report.sourceDigests.some((entry) => isAbsolute(entry.path) ||
      relative(repositoryRoot, resolve(repositoryRoot, entry.path)).startsWith(".."))) {
    throw new Error("Performance report contains a source path outside the repository")
  }
}

export async function runPerformanceReliabilityReport(args = process.argv.slice(2)) {
  const options = parseArguments(args)
  const vitestEntry = resolve(repositoryRoot, "node_modules/vitest/vitest.mjs")
  if (!existsSync(vitestEntry)) throw new Error("The local Vitest entrypoint is unavailable")
  const focusedOutput = await runCommand(process.execPath, [
    vitestEntry,
    "run",
    ...performanceFocusedTestFiles,
    "--maxWorkers=2",
  ])
  const nativeOutput = await runCommand("npm", ["run", "test:vscode:extension-host"])
  const metrics = parsePerformanceMetrics(focusedOutput, nativeOutput)
  const packageAbsolutePath = resolve(repositoryRoot, packagePath)
  const packageMetadata = await stat(packageAbsolutePath)
  const packageArtifact = await readRepositoryRegularFile(repositoryRoot, packagePath, { maximumBytes: performanceBudgets.packageArchiveBytes })
  const content = await readVsixContentManifest(packageAbsolutePath)
  const report = composePerformanceReliabilityReport({
    checkpoint: options.checkpoint,
    observedAt: options.observedAt,
    focused: parseVitestSummary(focusedOutput),
    metrics,
    reliabilityContracts: inspectReliabilityContracts(await reliabilitySources()),
    packageArtifact: {
      path: packagePath,
      archiveBytes: Number(packageMetadata.size),
      archiveSha256: sha256(packageArtifact.bytes),
      contentFiles: content.contentFiles,
      contentBytes: content.contentBytes,
      contentManifestSha256: content.contentManifestSha256,
      exactInstalledLifecycle: "passed",
    },
    sourceDigests: await sourceDigests(),
  })
  assertPrivacySafe(report)
  const serialized = `${JSON.stringify(report, null, 2)}\n`
  if (options.output) {
    const path = await writeExclusiveRepositoryFile(repositoryRoot, options.output, serialized)
    process.stdout.write(`GAEP local VS Code performance/reliability report written: ${path}\n`)
  } else process.stdout.write(serialized)
  return report
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await runPerformanceReliabilityReport()
