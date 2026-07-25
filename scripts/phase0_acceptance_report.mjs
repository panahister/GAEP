import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { lstat, readFile, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { promisify } from "node:util"

import { canonicalDigest } from "@gaep/agent-sdk"

import { buildIdeConformanceReport } from "./lib/ide_conformance.mjs"
import { verifyPhase0ExampleReceiptFile } from "./verify_phase0_example_receipt.mjs"

const execute = promisify(execFile)
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const sourceByteLimit = 2 * 1024 * 1024
const reportByteLimit = 512 * 1024
const defaultPaths = {
  contract: "conformance/phase-0-ide-contract.json",
  packages: "evidence/local-packages/2026-07-25T093233Z-phase-1-source-governance.json",
  conformance: "evidence/ide-conformance/2026-07-25T093233Z-phase-1-source-governance.json",
  example: "evidence/examples/2026-07-24T233901Z-phase-0-inspectable-artifacts.json",
}
const gateDefinitions = [
  { id: "typecheck", command: ["npm", "run", "typecheck"], parser: parseTypecheck },
  { id: "repository-tests", command: ["npm", "run", "test"], parser: parseVitest },
  { id: "windows-ci-contract", command: ["npm", "run", "test:ci-contract"], parser: parseNodeTests },
  { id: "canonical-example", command: ["npm", "run", "test:example"], parser: parseNodeTests },
  { id: "documentation", command: ["npm", "run", "validate:docs"], parser: parseDocumentation },
  { id: "ide-conformance", command: ["npm", "run", "test:ide-conformance"], parser: parseNodeTests },
  { id: "phase-report-contract", command: ["npm", "run", "test:phase-report"], parser: parseNodeTests },
]

function fail(message) {
  throw new Error(`Invalid Phase 0 acceptance report: ${message}`)
}

function rawDigest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

function normalizeRelativePath(root, path, label) {
  const resolved = resolve(root, path)
  const normalized = relative(root, resolved)
  if (!normalized || normalized === ".." || normalized.startsWith(`..${sep}`) || isAbsolute(normalized)) {
    fail(`${label} must stay inside the repository`)
  }
  return { resolved, normalized: normalized.split(sep).join("/") }
}

async function readRegularFile(path, label, byteLimit = sourceByteLimit) {
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`${label} must be a regular file`)
  if (stat.size < 2 || stat.size > byteLimit) fail(`${label} must be between 2 and ${byteLimit} bytes`)
  return readFile(path)
}

async function readJsonSource(root, path, label) {
  const location = normalizeRelativePath(root, path, label)
  const bytes = await readRegularFile(location.resolved, label)
  let value
  try {
    value = JSON.parse(bytes.toString("utf8"))
  } catch {
    fail(`${label} must contain valid JSON`)
  }
  return { ...location, bytes, value }
}

function exactCommand(definition) {
  return definition.command.join(" ")
}

function parseInteger(output, pattern, label) {
  const match = output.match(pattern)
  if (!match) throw new Error(`Validation output did not include ${label}`)
  return Number(match[1])
}

function parseTypecheck() {
  return { projects: "workspace-build-graph", errors: 0 }
}

function parseVitest(output) {
  return {
    filesPassed: parseInteger(output, /Test Files\s+(\d+) passed/u, "the passed test-file count"),
    testsPassed: parseInteger(output, /Tests\s+(\d+) passed/u, "the passed test count"),
    testsSkipped: Number(output.match(/Tests[^\n]*\|\s+(\d+) skipped/u)?.[1] ?? 0),
    testsFailed: 0,
  }
}

function parseNodeTests(output) {
  const matches = (label) => [...output.matchAll(new RegExp(`(?:^|\\n)(?:ℹ )?${label}\\s+(\\d+)`, "gu"))]
  const last = (label) => {
    const values = matches(label)
    if (values.length === 0) throw new Error(`Validation output did not include ${label}`)
    return Number(values.at(-1)[1])
  }
  return {
    tests: last("tests"),
    passed: last("pass"),
    failed: last("fail"),
    skipped: last("skipped"),
  }
}

function parseDocumentation(output) {
  const result = output.match(/(?:^|\n)result:\s+(\S+)/u)?.[1]
  if (result !== "PASS") throw new Error("Documentation validation did not report PASS")
  return {
    documents: parseInteger(output, /(?:^|\n)documents:\s+(\d+)/u, "the document count"),
    requirements: parseInteger(output, /(?:^|\n)requirement definitions:\s+(\d+)/u, "the requirement count"),
    warnings: parseInteger(output, /(?:^|\n)warnings:\s+(\d+)/u, "the warning count"),
  }
}

function validateTestEvidence(testEvidence) {
  if (!Array.isArray(testEvidence) || testEvidence.length !== gateDefinitions.length) {
    fail(`test evidence must contain ${gateDefinitions.length} exact gates`)
  }
  for (let index = 0; index < gateDefinitions.length; index++) {
    const definition = gateDefinitions[index]
    const evidence = testEvidence[index]
    if (evidence?.id !== definition.id || evidence.command !== exactCommand(definition) || evidence.result !== "pass" ||
        typeof evidence.outputDigest !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(evidence.outputDigest) ||
        evidence.summary === null || typeof evidence.summary !== "object" || Array.isArray(evidence.summary)) {
      fail(`test evidence ${index} differs from the exact passing gate contract`)
    }
    if (Object.values(evidence.summary).some((value) =>
      !(typeof value === "string" || Number.isSafeInteger(value)) || (typeof value === "number" && value < 0))) {
      fail(`test evidence ${definition.id} contains an invalid summary value`)
    }
    if (("failed" in evidence.summary && evidence.summary.failed !== 0) ||
        ("testsFailed" in evidence.summary && evidence.summary.testsFailed !== 0) ||
        ("errors" in evidence.summary && evidence.summary.errors !== 0) ||
        ("warnings" in evidence.summary && evidence.summary.warnings !== 0)) {
      fail(`test evidence ${definition.id} is not clean`)
    }
  }
}

async function sourceEvidence(id, source, expectedKind) {
  if (source.value?.kind !== expectedKind) fail(`${id} kind differs`)
  return {
    id,
    path: source.normalized,
    bytes: source.bytes.length,
    digest: rawDigest(source.bytes),
    kind: expectedKind,
  }
}

async function verifiedSources(root, paths) {
  const contract = await readJsonSource(root, paths.contract, "IDE conformance contract")
  const packages = await readJsonSource(root, paths.packages, "package report")
  const conformance = await readJsonSource(root, paths.conformance, "conformance report")
  const example = await readJsonSource(root, paths.example, "example receipt")
  if (conformance.value.recordedAt === undefined) fail("conformance report must bind recordedAt")
  const rebuiltConformance = await buildIdeConformanceReport({
    repositoryRoot: root,
    contractPath: contract.resolved,
    packageReportPath: packages.resolved,
    recordedAt: conformance.value.recordedAt,
  })
  try {
    assert.deepEqual(conformance.value, JSON.parse(JSON.stringify(rebuiltConformance)))
  } catch {
    fail("conformance report differs from current contract, package, host, provider, or source evidence")
  }
  const receipt = await verifyPhase0ExampleReceiptFile(example.resolved)
  const hostPath = conformance.value.hosts[0]?.runtimeEvidence?.source
  if (typeof hostPath !== "string" || conformance.value.hosts.some((host) => host.runtimeEvidence.source !== hostPath)) {
    fail("conformance hosts do not share one exact behavior receipt")
  }
  const providerPath = conformance.value.providerEvidence?.source
  if (typeof providerPath !== "string") fail("conformance provider evidence path is missing")
  const host = await readJsonSource(root, hostPath, "host behavior receipt")
  const provider = await readJsonSource(root, providerPath, "provider behavior receipt")
  const sources = [
    await sourceEvidence("ide-contract", contract, "gaep-phase-0-ide-conformance-contract-v1"),
    await sourceEvidence("package-report", packages, "gaep-local-ide-package-report-v1"),
    await sourceEvidence("host-behavior", host, "gaep-phase-0-host-behavior-evidence-v1"),
    await sourceEvidence("provider-behavior", provider, "gaep-phase-0-provider-behavior-evidence-v1"),
    await sourceEvidence("ide-conformance", conformance, "gaep-phase-0-ide-conformance-report-v1"),
    await sourceEvidence("canonical-example", example, "gaep-phase0-example-receipt"),
  ]
  return { packages: packages.value, conformance: conformance.value, receipt, sources }
}

function knownGaps(inputs) {
  return [
    {
      id: "native-package-and-host-acceptance",
      state: "open",
      basis: `${inputs.packages.summary.missingNativePlatformArtifacts} native package missing; ${inputs.conformance.summary.acceptedHosts}/${inputs.conformance.summary.hosts} hosts accepted`,
    },
    {
      id: "live-provider-acceptance",
      state: "open",
      basis: `${inputs.conformance.summary.acceptedProviders}/${inputs.conformance.summary.providers} providers live accepted`,
    },
    {
      id: "product-owner-acceptance",
      state: "not-established",
      basis: "local implementation approval does not grant feature, phase, readiness, release, or deployment acceptance",
    },
    {
      id: "security-review",
      state: "not-completed",
      basis: "the limited Codex Security scan was explicitly skipped and no final security result exists",
    },
    {
      id: "release-controls",
      state: "not-established",
      basis: "signing, publication, supported-platform certification, release approval, deployment, and rollback acceptance are absent",
    },
    {
      id: "later-phase-reports",
      state: "not-produced",
      basis: "this report covers Phase 0 / 1A local evidence only; later phases require separate revalidation",
    },
  ]
}

export async function buildPhase0AcceptanceReport({
  root = repositoryRoot,
  paths = defaultPaths,
  recordedAt,
  sourceCommit,
  testEvidence,
}) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(recordedAt ?? "")) fail("recordedAt is invalid")
  if (!/^[0-9a-f]{40}$/u.test(sourceCommit ?? "")) fail("sourceCommit must be an exact Git commit")
  validateTestEvidence(testEvidence)
  const inputs = await verifiedSources(resolve(root), paths)
  const gaps = knownGaps(inputs)
  const report = {
    schemaVersion: 1,
    kind: "gaep-phase-acceptance-report-v1",
    phase: "phase-0-1a-foundation",
    evidenceScope: "phase-0-local",
    recordedAt,
    sourceCommit,
    verificationResult: "pass",
    reportingStatus: "current-local-evidence-bound",
    phaseGate: "incomplete",
    acceptance: "not-established",
    readiness: "not-established",
    securityReview: "not-completed-explicitly-skipped",
    releaseAuthorization: "not-authorized",
    summary: {
      packagesExpected: inputs.packages.summary.expected,
      packagesProduced: inputs.packages.summary.produced,
      hosts: inputs.conformance.summary.hosts,
      hostCapabilities: inputs.conformance.summary.capabilities,
      hostAssessments: inputs.conformance.summary.assessments,
      hostAssessmentsImplemented: inputs.conformance.summary.implemented,
      hostAssessmentsPartial: inputs.conformance.summary.partial,
      hostAssessmentsNotImplemented: inputs.conformance.summary["not-implemented"],
      hostsAccepted: inputs.conformance.summary.acceptedHosts,
      providers: inputs.conformance.summary.providers,
      providersAccepted: inputs.conformance.summary.acceptedProviders,
      validationGatesPassed: testEvidence.length,
      validationGatesFailed: 0,
      exampleSummaryDigest: inputs.receipt.summaryDigest,
      knownGaps: gaps.length,
    },
    sources: inputs.sources,
    tests: testEvidence,
    testsDigest: canonicalDigest(testEvidence),
    knownGaps: gaps,
    knownGapsDigest: canonicalDigest(gaps),
    claimBoundary: "This report binds current local Phase 0 / 1A package, test, host, provider, conformance and example evidence. It is not native-host or live-provider acceptance, Product readiness, security approval, release authorization, deployment approval, or a later-phase report.",
  }
  return report
}

export async function verifyPhase0AcceptanceReportObject(report, options = {}) {
  if (report === null || typeof report !== "object" || Array.isArray(report)) fail("report must be an object")
  const rebuilt = await buildPhase0AcceptanceReport({
    root: options.root ?? repositoryRoot,
    paths: options.paths ?? defaultPaths,
    recordedAt: report.recordedAt,
    sourceCommit: report.sourceCommit,
    testEvidence: report.tests,
  })
  try {
    assert.deepEqual(report, rebuilt)
  } catch {
    fail("report differs from the exact current evidence and fail-closed acceptance projection")
  }
  return report
}

export async function verifyPhase0AcceptanceReportFile(path, options = {}) {
  const bytes = await readRegularFile(resolve(path), "phase acceptance report", reportByteLimit)
  let report
  try {
    report = JSON.parse(bytes.toString("utf8"))
  } catch {
    fail("phase acceptance report must contain valid JSON")
  }
  return verifyPhase0AcceptanceReportObject(report, options)
}

async function runValidationGates(root) {
  const evidence = []
  for (const definition of gateDefinitions) {
    const [executable, ...args] = definition.command
    const result = await execute(executable, args, {
      cwd: root,
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
      timeout: 5 * 60 * 1000,
      maxBuffer: 16 * 1024 * 1024,
    })
    const output = `${result.stdout}${result.stderr}`
    evidence.push({
      id: definition.id,
      command: exactCommand(definition),
      result: "pass",
      summary: definition.parser(output),
      outputDigest: rawDigest(output),
    })
  }
  return evidence
}

async function gitOutput(root, args) {
  return (await execute("git", args, { cwd: root, timeout: 30_000, maxBuffer: 1024 * 1024 })).stdout.trim()
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 2 && args[0] === "--verify") {
    const report = await verifyPhase0AcceptanceReportFile(resolve(repositoryRoot, args[1]))
    process.stdout.write(`${JSON.stringify({
      valid: true,
      kind: report.kind,
      phase: report.phase,
      reportingStatus: report.reportingStatus,
      phaseGate: report.phaseGate,
      validationGatesPassed: report.summary.validationGatesPassed,
      knownGaps: report.summary.knownGaps,
    }, null, 2)}\n`)
    return
  }
  if (args.length !== 2 || args[0] !== "--output") {
    throw new Error("Usage: node scripts/phase0_acceptance_report.mjs <--output|--verify> <repository-relative-report.json>")
  }
  const output = normalizeRelativePath(repositoryRoot, args[1], "phase report output")
  const initialStatus = await gitOutput(repositoryRoot, ["status", "--porcelain", "--untracked-files=no"])
  if (initialStatus) throw new Error("Phase report generation requires a clean tracked worktree")
  const sourceCommit = await gitOutput(repositoryRoot, ["rev-parse", "HEAD"])
  const testEvidence = await runValidationGates(repositoryRoot)
  const finalStatus = await gitOutput(repositoryRoot, ["status", "--porcelain", "--untracked-files=no"])
  if (finalStatus) throw new Error("Validation gates changed tracked files; refusing to publish a stale phase report")
  const report = await buildPhase0AcceptanceReport({
    recordedAt: new Date().toISOString().replace(/\.\d{3}Z$/u, "Z"),
    sourceCommit,
    testEvidence,
  })
  await writeFile(output.resolved, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 })
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
