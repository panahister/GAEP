import { createHash } from "node:crypto"
import { lstat, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const repository = fileURLToPath(new URL("..", import.meta.url))
const testFile = "packages/engine/src/business-understanding.test.ts"
const fakeServerFile = "packages/agent-sdk/test/fixtures/fake-codex-app-server.mjs"
const receiptByteLimit = 64 * 1024
const digestPattern = /^sha256:[0-9a-f]{64}$/

export const codexP0P4TestName = "executes an exact P0-P4 candidate chain through isolated Codex app-server evidence"
export const codexP0P4Limitations = [
  "The deterministic local Codex app-server fixture verifies the managed transport and evidence contract, not live provider authentication, entitlement, reachability, model quality, usage, or cost.",
  "The governed P0-P4 records are synthetic candidate fixtures and do not establish a real Product baseline, independent review, readiness, approval, or Product Owner acceptance.",
  "The integration runs through the shared engine and does not validate native IDE installation, activation, interaction, rendering, accessibility, or supported-host acceptance.",
  "The Product Owner explicitly skipped the interrupted Codex Security scan; this acceptance receipt is not security assurance or a security result.",
]

export const expectedCodexP0P4Summary = {
  schemaVersion: 1,
  kind: "gaep-codex-p0-p4-semantic-summary",
  governedRecordKinds: [
    "architecture",
    "architectureChallengeModel",
    "authorizationModel",
    "baseline",
    "boundedContextModel",
    "business",
    "businessRuleCatalog",
    "capabilityMap",
    "dataModel",
    "decisionRegister",
    "eventIntegrationModel",
    "evidenceRegistry",
    "failureRecoveryModel",
    "operatingModel",
    "outcome",
    "processModel",
    "riskRegister",
    "securityPrivacyAssessment",
    "stakeholder",
    "traceability",
    "valueStreamModel",
  ],
  governedRecordCount: 21,
  readiness: {
    result: "passed",
    outputCount: 25,
    applicableOutputCount: 3,
    notApplicableOutputCount: 22,
    readinessAuthorityState: "not-established",
  },
  handoff: {
    state: "complete-for-review",
    itemCount: 25,
    includedItemCount: 3,
    omittedNotApplicableItemCount: 22,
    acknowledgementState: "not-established",
    transferAuthorityState: "not-established",
  },
  execution: {
    adapterId: "gaep.codex-cli",
    agentId: "codex-cli",
    modelId: "fake-model",
    mode: "codex-staged",
    state: "completed",
    providerDisposition: "completed",
    outcomeStatus: "satisfied",
    completedStepCount: 1,
    totalStepCount: 1,
    stagingChangeCount: 0,
    stagingApplyState: "applied",
  },
  integrity: {
    auditValid: true,
    previewBound: true,
    resultBound: true,
    evidenceBound: true,
    eventsBound: true,
    contextBound: true,
  },
  authorityBoundary: "managed-readonly-receipt-does-not-grant-tool-write-effect-or-outcome-authority",
}

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

export function rawDigest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

export function exactCodexTestSource(source) {
  const text = Buffer.isBuffer(source) ? source.toString("utf8") : String(source)
  const marker = `  it(${JSON.stringify(codexP0P4TestName)}`
  const start = text.indexOf(marker)
  if (start < 0 || text.indexOf(marker, start + marker.length) >= 0) {
    throw new Error("Codex P0-P4 test source must contain exactly one named integration")
  }
  const end = text.indexOf("\n\n  it(\"", start + marker.length)
  if (end < 0) throw new Error("Codex P0-P4 test source boundary is missing")
  return Buffer.from(text.slice(start, end), "utf8")
}

function fail(message) {
  throw new Error(`Invalid Codex P0-P4 acceptance receipt: ${message}`)
}

function assertObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`)
}

function assertExactKeys(value, expected, label) {
  assertObject(value, label)
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${label} keys differ; expected ${wanted.join(", ")}, received ${actual.join(", ")}`)
  }
}

function assertDigest(value, label) {
  if (typeof value !== "string" || !digestPattern.test(value)) fail(`${label} must be a SHA-256 digest`)
}

async function currentSourceDigests() {
  const [testBytes, fakeServerBytes] = await Promise.all([
    readFile(resolve(repository, testFile)),
    readFile(resolve(repository, fakeServerFile)),
  ])
  return {
    testSourceDigest: rawDigest(exactCodexTestSource(testBytes)),
    fakeServerSourceDigest: rawDigest(fakeServerBytes),
  }
}

export async function verifyCodexP0P4ReceiptObject(receipt) {
  assertExactKeys(receipt, [
    "schemaVersion", "kind", "scenario", "execution", "summary", "summaryDigest", "authority", "limitations",
  ], "receipt")
  if (receipt.schemaVersion !== 1 || receipt.kind !== "gaep-codex-p0-p4-acceptance-receipt") {
    fail("schema or kind differs")
  }
  assertExactKeys(receipt.scenario, [
    "id", "testFile", "testName", "testSourceDigest", "fakeServerFile", "fakeServerSourceDigest",
  ], "receipt.scenario")
  const sourceDigests = await currentSourceDigests()
  if (receipt.scenario.id !== "P1-30" || receipt.scenario.testFile !== testFile ||
      receipt.scenario.testName !== codexP0P4TestName || receipt.scenario.fakeServerFile !== fakeServerFile) {
    fail("scenario identity differs")
  }
  assertDigest(receipt.scenario.testSourceDigest, "receipt.scenario.testSourceDigest")
  assertDigest(receipt.scenario.fakeServerSourceDigest, "receipt.scenario.fakeServerSourceDigest")
  if (receipt.scenario.testSourceDigest !== sourceDigests.testSourceDigest ||
      receipt.scenario.fakeServerSourceDigest !== sourceDigests.fakeServerSourceDigest) {
    fail("scenario source digest differs from the current executable fixture")
  }
  assertExactKeys(receipt.execution, ["runner", "exitCode", "semanticSummaryCount"], "receipt.execution")
  if (receipt.execution.runner !== "vitest-isolated-child-process" || receipt.execution.exitCode !== 0 ||
      receipt.execution.semanticSummaryCount !== 1) {
    fail("execution evidence differs from one successful isolated test")
  }
  if (JSON.stringify(receipt.summary) !== JSON.stringify(expectedCodexP0P4Summary)) {
    fail("semantic summary differs from the strict P1-30 contract")
  }
  assertDigest(receipt.summaryDigest, "receipt.summaryDigest")
  if (receipt.summaryDigest !== canonicalDigest(receipt.summary)) fail("semantic summary digest differs")
  assertExactKeys(receipt.authority, [
    "liveProviderStatus", "productOwnerAcceptance", "readinessAuthority", "releaseAuthority", "securityScan", "boundary",
  ], "receipt.authority")
  if (receipt.authority.liveProviderStatus !== "not-tested" ||
      receipt.authority.productOwnerAcceptance !== "not-established" ||
      receipt.authority.readinessAuthority !== "not-established" ||
      receipt.authority.releaseAuthority !== "not-granted" ||
      receipt.authority.securityScan !== "skipped-by-product-owner" ||
      receipt.authority.boundary !== "acceptance-receipt-is-deterministic-local-evidence-not-live-provider-product-owner-readiness-security-or-release-authority") {
    fail("authority boundary differs")
  }
  if (JSON.stringify(receipt.limitations) !== JSON.stringify(codexP0P4Limitations)) fail("limitations differ")
  return receipt
}

export async function verifyCodexP0P4ReceiptFile(path) {
  const target = resolve(path)
  const stat = await lstat(target)
  if (!stat.isFile() || stat.isSymbolicLink()) fail("receipt must be a regular file")
  if (stat.size < 2 || stat.size > receiptByteLimit) fail(`receipt must be between 2 and ${receiptByteLimit} bytes`)
  let receipt
  try {
    receipt = JSON.parse(await readFile(target, "utf8"))
  } catch {
    fail("receipt must contain valid JSON")
  }
  return verifyCodexP0P4ReceiptObject(receipt)
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 1) throw new Error("Usage: node scripts/verify_codex_p0_p4_receipt.mjs <receipt.json>")
  const receipt = await verifyCodexP0P4ReceiptFile(args[0])
  process.stdout.write(`${JSON.stringify({
    valid: true,
    kind: receipt.kind,
    scenarioId: receipt.scenario.id,
    summaryDigest: receipt.summaryDigest,
  }, null, 2)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
