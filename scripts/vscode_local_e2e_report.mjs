import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const ansiPattern = /\u001b\[[0-?]*[ -/]*[@-~]/gu

export const focusedTestFiles = Object.freeze([
  "packages/contracts/src/test-generation.test.ts",
  "packages/contracts/src/unit-integration-testing.test.ts",
  "packages/engine/src/test-generation.test.ts",
  "packages/engine/src/unit-integration-testing.test.ts",
  "apps/vscode/src/test-generation-product-studio.test.ts",
  "apps/vscode/src/unit-integration-testing-product-studio.test.ts",
  "apps/vscode/src/current-engine-studio-data-source.test.ts",
  "apps/vscode/src/studio-protocol.test.ts",
  "apps/vscode/src/studio-accessibility.test.ts",
  "apps/vscode/src/studio-session.test.ts",
])

const reportInputFiles = Object.freeze([
  ...focusedTestFiles,
  "apps/vscode/test/e2e/README.md",
  "apps/vscode/test/e2e/run.mjs",
  "apps/vscode/test/e2e/suite/index.cjs",
  "apps/vscode/package.json",
  "package.json",
])

function stripAnsi(value) {
  return value.replace(ansiPattern, "")
}

export function parseVitestSummary(output) {
  const plain = stripAnsi(output)
  const fileMatch = plain.match(/Test Files\s+(\d+) passed/iu)
  const testMatch = plain.match(/Tests\s+(\d+) passed/iu)
  const skippedMatch = plain.match(/Tests\s+.*?(\d+) skipped/iu)
  if (!fileMatch || !testMatch) throw new Error("Focused Vitest output did not contain a passing file and test summary")
  return {
    status: "passed",
    files: Number(fileMatch[1]),
    tests: Number(testMatch[1]),
    skipped: skippedMatch ? Number(skippedMatch[1]) : 0,
  }
}

export function parseNativeResult(output) {
  const line = stripAnsi(output).split(/\r?\n/u).findLast((candidate) => candidate.startsWith("GAEP_LOCAL_VSCODE_NATIVE_RESULT="))
  if (!line) throw new Error("Extension-host output did not contain the bounded native result")
  const result = JSON.parse(line.slice("GAEP_LOCAL_VSCODE_NATIVE_RESULT=".length))
  if (result?.schemaVersion !== 1 || result.scope !== "local-isolated-vscode") {
    throw new Error("Extension-host result has an unsupported schema or scope")
  }
  for (const phase of ["open", "reopen", "multi-root"]) {
    if (!result.phases?.includes(phase)) throw new Error(`Extension-host result omitted required ${phase} phase`)
  }
  if (result.packageLifecycle?.status === "passed" && !result.phases.includes("installed")) {
    throw new Error("Extension-host result passed package lifecycle without exact installed-package activation")
  }
  if (result.workspaceFingerprint !== "unchanged") throw new Error("Extension-host result did not preserve the fixture fingerprint")
  if (result.restartReopen !== "explicit-command-after-isolated-restart") {
    throw new Error("Extension-host result did not verify the bounded restart and explicit reopen workflow")
  }
  if (result.normalProfileTouched !== false || result.externalSystemsUsed !== false || result.otherHostMatricesRun !== false) {
    throw new Error("Extension-host result exceeded the local VS Code-only scope")
  }
  return result
}

export function composeReport({ checkpoint, observedAt, focused, native, sourceDigests }) {
  const packagePassed = native.packageLifecycle.status === "passed"
  return {
    schemaVersion: 1,
    kind: "gaep-local-vscode-end-to-end-report",
    scope: {
      host: "vscode",
      execution: "local-isolated",
      repositoryCheckpoint: checkpoint,
      observedAt,
      otherHostMatrices: "not-run",
      normalProfile: "not-touched",
      externalSystems: "not-used",
    },
    result: packagePassed ? "passed" : "passed-with-installed-package-limitation",
    focusedVerification: {
      ...focused,
      files: focusedTestFiles,
    },
    nativeVerification: native,
    coverage: [
      { id: "extension-activation", status: "passed", evidence: packagePassed ? ["native:open", "native:installed"] : ["native:open"] },
      { id: "product-studio-open-refresh", status: "passed", evidence: ["native:open", "native:reopen", "studio-session"] },
      { id: "surface-states", status: "passed", states: ["empty", "loading", "error-as-invalid", "offline", "interrupted"] },
      { id: "exact-product-initiative-binding", status: "passed", evidence: ["test-generation-engine", "unit-integration-engine", "current-engine-product-studio"] },
      { id: "p3b-candidate-continuity", status: "passed", evidence: ["test-generation-contract-engine", "unit-integration-contract-engine"] },
      { id: "test-plan-suite-projection", status: "passed", evidence: ["test-generation-product-studio", "unit-integration-product-studio"] },
      { id: "restart-explicit-reopen", status: "passed", evidence: ["native:reopen", "studio-session"] },
      { id: "isolated-package-lifecycle", status: packagePassed ? "passed" : "unverified", evidence: native.packageLifecycle.operations ?? [] },
      { id: "workspace-mutation", status: "passed", evidence: packagePassed
        ? ["exact-tree-and-content-fingerprint", "single-root", "multi-root", "installed-package"]
        : ["exact-tree-and-content-fingerprint", "single-root", "multi-root"] },
      { id: "privacy-safe-evidence", status: "passed", evidence: ["relative-source-digests", "bounded-counts", "no-raw-output"] },
    ],
    sourceDigests,
    privacy: {
      rawCommandOutputIncluded: false,
      absoluteMachinePathsIncluded: false,
      promptsIncluded: false,
      sourceBytesIncluded: false,
      environmentValuesIncluded: false,
      secretsIncluded: false,
    },
    authorityBoundary: "This report establishes deterministic local candidate behavior only. It grants no Product, Product Owner, security, release, publication, deployment, provider, native-manual, or other-host acceptance authority.",
    limitations: [
      "The extension-host harness disables workspace-trust enforcement; native untrusted-workspace behavior is not established.",
      "The controlled extension-host shutdown verifies restart with the same isolated profile and explicit reopen; automatic native window or webview restoration is not established.",
      "The isolated package lifecycle is conditional on a local VS Code installation.",
      "No live provider, Figma, credential, network service, normal-profile extension, release, publication, or deployment action is used.",
    ],
  }
}

async function sourceDigests() {
  const entries = []
  for (const path of [...reportInputFiles].sort()) {
    const bytes = await readFile(resolve(repositoryRoot, path))
    entries.push({ path, bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") })
  }
  return entries
}

async function runCommand(label, executable, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(executable, args, {
      cwd: repositoryRoot,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    })
    let output = ""
    child.stdout.on("data", (chunk) => {
      output += chunk
      process.stdout.write(chunk)
    })
    child.stderr.on("data", (chunk) => {
      output += chunk
      process.stderr.write(chunk)
    })
    child.on("error", reject)
    child.on("exit", (code, signal) => {
      if (code === 0) resolvePromise(output)
      else reject(new Error(`${label} failed with ${signal ? `signal ${signal}` : `exit code ${String(code)}`}`))
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
  if (!/^(?:working-tree|[0-9a-f]{7,64})$/u.test(result.checkpoint)) throw new Error("--checkpoint must be working-tree or a Git object ID")
  if (result.observedAt !== "not-recorded" && Number.isNaN(Date.parse(result.observedAt))) throw new Error("--observed-at must be an ISO-8601 timestamp")
  return result
}

function assertPrivacySafeReport(report) {
  const serialized = JSON.stringify(report)
  for (const prefix of ["/Users/", "/home/", "C:\\\\Users\\\\", "/tmp/", "/private/tmp/"]) {
    if (serialized.includes(prefix)) throw new Error(`Report contains an absolute machine path prefix: ${prefix}`)
  }
  if (report.sourceDigests.some((entry) => isAbsolute(entry.path) || relative(repositoryRoot, resolve(repositoryRoot, entry.path)).startsWith(".."))) {
    throw new Error("Report contains a source path outside the repository")
  }
}

export async function runLocalVsCodeReport(args = process.argv.slice(2)) {
  const options = parseArguments(args)
  const vitestEntry = resolve(repositoryRoot, "node_modules/vitest/vitest.mjs")
  if (!existsSync(vitestEntry)) throw new Error("The local Vitest entrypoint is unavailable")
  const npmEntry = process.env.npm_execpath
  if (!npmEntry || !existsSync(npmEntry)) throw new Error("Run this report through npm so the exact npm entrypoint is available")

  const focusedOutput = await runCommand("focused VS Code verification", process.execPath, [
    vitestEntry,
    "run",
    ...focusedTestFiles,
    "--maxWorkers=4",
  ])
  const nativeOutput = await runCommand("isolated VS Code extension-host verification", process.execPath, [
    npmEntry,
    "run",
    "test:vscode:extension-host",
  ])
  const report = composeReport({
    checkpoint: options.checkpoint,
    observedAt: options.observedAt,
    focused: parseVitestSummary(focusedOutput),
    native: parseNativeResult(nativeOutput),
    sourceDigests: await sourceDigests(),
  })
  assertPrivacySafeReport(report)
  const serialized = `${JSON.stringify(report, null, 2)}\n`
  if (options.output) {
    const outputPath = resolve(repositoryRoot, options.output)
    const repositoryRelativeOutput = relative(repositoryRoot, outputPath)
    if (repositoryRelativeOutput.startsWith("..") || isAbsolute(repositoryRelativeOutput)) {
      throw new Error("--output must stay within the repository")
    }
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, serialized, "utf8")
    process.stdout.write(`GAEP local VS Code end-to-end report written: ${repositoryRelativeOutput}\n`)
  } else {
    process.stdout.write(serialized)
  }
  return report
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runLocalVsCodeReport()
}
