import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { lstat, readFile } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { verifyClaudeP0P4ReceiptFile } from "./verify_claude_p0_p4_receipt.mjs"
import { verifyCodexP0P4ReceiptFile } from "./verify_codex_p0_p4_receipt.mjs"

const repository = fileURLToPath(new URL("..", import.meta.url))
const receiptByteLimit = 128 * 1024
const sourceByteLimit = 64 * 1024
const digestPattern = /^sha256:[0-9a-f]{64}$/

export const defaultProviderComparisonInputs = {
  codex: "evidence/examples/20260805T121000Z-phase-1-codex-p0-p4-acceptance.json",
  claude: "evidence/examples/20260805T121000Z-phase-1-claude-p0-p4-acceptance.json",
}

export const providerComparisonLimitations = [
  "Both inputs are deterministic local fixture receipts bound to the same realistic reference Product scenario; neither input establishes live-provider authentication, entitlement, reachability, model quality, reliability, usage, or cost.",
  "Provider output content is not retained in the portable receipts, so semantic correctness, usefulness, reasoning quality, style, latency, token use, and cost remain not assessed.",
  "Structural parity covers only exact governed candidate coverage, readiness, handoff, terminal Workflow fields, evidence integrity, and authority boundaries represented by both receipts.",
  "Expected transport differences do not rank providers or authorize automatic provider/model selection.",
  "Native-host interaction, accessibility, real Product validation, independent human review, Product Owner acceptance, security completion, release authorization, and deployment approval remain outside this comparison.",
]

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize)
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalize(child)]),
    )
  }
  return value
}

export function canonicalDigest(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(normalize(value))).digest("hex")}`
}

function rawDigest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

function fail(message) {
  throw new Error(`Invalid provider output comparison receipt: ${message}`)
}

function repositoryPath(root, path, label) {
  if (typeof path !== "string" || path.length === 0) fail(`${label} path is missing`)
  const target = resolve(root, path)
  const normalized = relative(root, target)
  if (!normalized || normalized === ".." || normalized.startsWith(`..${sep}`) || isAbsolute(normalized)) {
    fail(`${label} path must stay inside the repository`)
  }
  return { target, path: normalized.split(sep).join("/") }
}

async function readRegularSource(root, path, label) {
  const location = repositoryPath(root, path, label)
  const stat = await lstat(location.target)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > sourceByteLimit) {
    fail(`${label} must be a bounded regular file`)
  }
  return { ...location, bytes: await readFile(location.target) }
}

function parityCriterion(id, category, left, right, basis) {
  const leftDigest = canonicalDigest(left)
  const rightDigest = canonicalDigest(right)
  return {
    id,
    category,
    status: leftDigest === rightDigest ? "satisfied" : "diverged",
    leftDigest,
    rightDigest,
    evidenceDigest: canonicalDigest({ id, leftDigest, rightDigest }),
    basis,
  }
}

function unassessedCriterion(id, category, basis) {
  return {
    id,
    category,
    status: "not-assessed",
    evidenceDigest: canonicalDigest({ id, status: "not-assessed", basis }),
    basis,
  }
}

function expectedDivergence(id, field, left, right, basis) {
  return {
    id,
    field,
    classification: "expected-runtime",
    leftDigest: canonicalDigest(left),
    rightDigest: canonicalDigest(right),
    basis,
  }
}

function commonExecution(summary) {
  return {
    state: summary.execution.state,
    providerDisposition: summary.execution.providerDisposition,
    outcomeStatus: summary.execution.outcomeStatus,
    completedStepCount: summary.execution.completedStepCount,
    totalStepCount: summary.execution.totalStepCount,
  }
}

function inputBinding(source, receipt) {
  return {
    path: source.path,
    kind: receipt.kind,
    scenarioId: receipt.scenario.id,
    fileDigest: rawDigest(source.bytes),
    summaryDigest: receipt.summaryDigest,
  }
}

export async function buildProviderOutputComparison({
  root = repository,
  codexReceiptPath = defaultProviderComparisonInputs.codex,
  claudeReceiptPath = defaultProviderComparisonInputs.claude,
} = {}) {
  const normalizedRoot = resolve(root)
  const [codexSource, claudeSource] = await Promise.all([
    readRegularSource(normalizedRoot, codexReceiptPath, "Codex receipt"),
    readRegularSource(normalizedRoot, claudeReceiptPath, "Claude receipt"),
  ])
  const [codex, claude] = await Promise.all([
    verifyCodexP0P4ReceiptFile(codexSource.target),
    verifyClaudeP0P4ReceiptFile(claudeSource.target),
  ])
  const inputs = {
    codex: inputBinding(codexSource, codex),
    claude: inputBinding(claudeSource, claude),
  }
  const criteria = [
    parityCriterion(
      "reference-scenario",
      "structural-parity",
      codex.summary.referenceScenario,
      claude.summary.referenceScenario,
      "Exact canonical realistic Product scenario, output catalog, digest, and authority boundary",
    ),
    parityCriterion(
      "governed-record-coverage",
      "structural-parity",
      { kinds: codex.summary.governedRecordKinds, count: codex.summary.governedRecordCount },
      { kinds: claude.summary.governedRecordKinds, count: claude.summary.governedRecordCount },
      "Exact governed candidate kinds and counts in both verified semantic receipts",
    ),
    parityCriterion(
      "readiness-evaluation",
      "structural-parity",
      codex.summary.readiness,
      claude.summary.readiness,
      "Exact readiness result, counts, applicability, and no-authority state",
    ),
    parityCriterion(
      "handoff-package",
      "structural-parity",
      codex.summary.handoff,
      claude.summary.handoff,
      "Exact handoff state, counts, acknowledgement, and transfer-authority state",
    ),
    parityCriterion(
      "terminal-workflow",
      "structural-parity",
      commonExecution(codex.summary),
      commonExecution(claude.summary),
      "Only terminal Workflow fields represented by both receipts are comparable",
    ),
    parityCriterion(
      "evidence-integrity",
      "structural-parity",
      codex.summary.integrity,
      claude.summary.integrity,
      "Exact audit, preview, result, evidence, event, and Context binding flags",
    ),
    parityCriterion(
      "authority-boundary",
      "structural-parity",
      { receipt: codex.authority, summary: codex.summary.authorityBoundary },
      { receipt: claude.authority, summary: claude.summary.authorityBoundary },
      "Exact receipt and managed-readonly no-authority boundaries",
    ),
    unassessedCriterion(
      "semantic-output-quality",
      "quality",
      "Portable receipts intentionally retain no raw provider output suitable for semantic quality assessment",
    ),
    unassessedCriterion(
      "live-provider-operational-quality",
      "quality",
      "Both verified receipts explicitly record live provider status as not tested",
    ),
  ]
  const divergences = [
    expectedDivergence(
      "provider-identity",
      "execution.provider",
      { adapterId: codex.summary.execution.adapterId, agentId: codex.summary.execution.agentId, modelId: codex.summary.execution.modelId },
      { adapterId: claude.summary.execution.adapterId, agentId: claude.summary.execution.agentId, modelId: claude.summary.execution.modelId },
      "The comparison intentionally exercises distinct providers and deterministic fixture models",
    ),
    expectedDivergence(
      "managed-execution-mode",
      "execution.mode",
      codex.summary.execution.mode,
      claude.summary.execution.mode,
      "Codex uses isolated zero-change staging while Claude is tool-free and context-only",
    ),
    expectedDivergence(
      "staging-evidence",
      "execution.staging",
      { changeCount: codex.summary.execution.stagingChangeCount, applyState: codex.summary.execution.stagingApplyState },
      { present: claude.summary.execution.stagingPresent },
      "Only the Codex managed mode creates an isolated stage; its exact changed inventory is empty",
    ),
    expectedDivergence(
      "provider-postcondition-evidence",
      "execution.providerPostcondition",
      { status: "not-projected-by-p1-30-summary", authority: "postcondition-evaluator-after-zero-change-apply" },
      {
        status: claude.summary.execution.providerPostconditionStatus,
        authority: claude.summary.execution.postconditionAuthority,
      },
      "The Claude receipt explicitly preserves a conservative raw provider postcondition and Workflow evaluator authority",
    ),
    expectedDivergence(
      "runtime-warning-evidence",
      "execution.warningCodes",
      [],
      claude.summary.execution.warningCodes,
      "The Claude fixture deliberately exercises runtime-warning and provider-output-redaction evidence",
    ),
  ]
  const structuralCriteria = criteria.filter((criterion) => criterion.category === "structural-parity")
  const qualityCriteria = criteria.filter((criterion) => criterion.category === "quality")
  const materialDivergenceCount = structuralCriteria.filter((criterion) => criterion.status === "diverged").length
  const comparison = {
    criteria,
    criteriaDigest: canonicalDigest(criteria),
    divergences,
    divergencesDigest: canonicalDigest(divergences),
    summary: {
      criteriaCount: criteria.length,
      structuralCriteriaSatisfied: structuralCriteria.filter((criterion) => criterion.status === "satisfied").length,
      structuralCriteriaDiverged: materialDivergenceCount,
      qualityCriteriaNotAssessed: qualityCriteria.filter((criterion) => criterion.status === "not-assessed").length,
      expectedRuntimeDivergenceCount: divergences.length,
      materialDivergenceCount,
      structuralResult: materialDivergenceCount === 0 ? "satisfied" : "diverged",
      semanticQuality: "not-assessed",
      liveProviderQuality: "not-assessed",
      providerPreference: "not-established",
      automaticSelectionAuthority: "not-granted",
    },
  }
  const receipt = {
    schemaVersion: 1,
    kind: "gaep-provider-output-comparison-receipt",
    scenario: {
      id: "P1-32",
      subject: "deterministic-codex-claude-p0-p4-structural-parity",
    },
    inputs,
    inputsDigest: canonicalDigest(inputs),
    comparison,
    comparisonDigest: canonicalDigest(comparison),
    authority: {
      liveProviderAcceptance: "not-established",
      semanticQualityAssessment: "not-established",
      providerPreference: "not-established",
      automaticSelectionAuthority: "not-granted",
      productOwnerAcceptance: "not-established",
      readinessAuthority: "not-established",
      securityScan: "skipped-by-product-owner",
      releaseAuthority: "not-granted",
      boundary: "comparison-receipt-is-structural-local-evidence-not-provider-ranking-selection-product-readiness-security-release-or-deployment-authority",
    },
    limitations: providerComparisonLimitations,
  }
  return receipt
}

export async function verifyProviderOutputComparisonObject(receipt, options = {}) {
  if (receipt === null || typeof receipt !== "object" || Array.isArray(receipt)) fail("receipt must be an object")
  if (receipt.schemaVersion !== 1 || receipt.kind !== "gaep-provider-output-comparison-receipt") {
    fail("schema or kind differs")
  }
  if (receipt.inputs === null || typeof receipt.inputs !== "object" || Array.isArray(receipt.inputs)) {
    fail("inputs must be an object")
  }
  for (const provider of ["codex", "claude"]) {
    const input = receipt.inputs[provider]
    if (input === null || typeof input !== "object" || Array.isArray(input)) fail(`${provider} input is missing`)
    if (!digestPattern.test(input.fileDigest ?? "") || !digestPattern.test(input.summaryDigest ?? "")) {
      fail(`${provider} input digests are invalid`)
    }
  }
  const rebuilt = await buildProviderOutputComparison({
    root: options.root ?? repository,
    codexReceiptPath: receipt.inputs.codex.path,
    claudeReceiptPath: receipt.inputs.claude.path,
  })
  try {
    assert.deepEqual(receipt, rebuilt)
  } catch {
    fail("receipt differs from the exact verified inputs and fail-closed comparison projection")
  }
  return receipt
}

export async function verifyProviderOutputComparisonFile(path, options = {}) {
  const target = resolve(path)
  const stat = await lstat(target)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > receiptByteLimit) {
    fail(`receipt must be a regular file between 2 and ${receiptByteLimit} bytes`)
  }
  let receipt
  try {
    receipt = JSON.parse(await readFile(target, "utf8"))
  } catch {
    fail("receipt must contain valid JSON")
  }
  return verifyProviderOutputComparisonObject(receipt, options)
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 1) throw new Error("Usage: node scripts/verify_provider_output_comparison_receipt.mjs <receipt.json>")
  const receipt = await verifyProviderOutputComparisonFile(args[0])
  process.stdout.write(`${JSON.stringify({
    valid: true,
    kind: receipt.kind,
    scenarioId: receipt.scenario.id,
    structuralResult: receipt.comparison.summary.structuralResult,
    semanticQuality: receipt.comparison.summary.semanticQuality,
    providerPreference: receipt.comparison.summary.providerPreference,
    comparisonDigest: receipt.comparisonDigest,
  }, null, 2)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
