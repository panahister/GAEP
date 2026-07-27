import { createHash } from "node:crypto"
import { lstat, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const repository = fileURLToPath(new URL("..", import.meta.url))
const testFile = "packages/engine/src/business-understanding.test.ts"
const fakeStreamFile = "packages/agent-sdk/test/fixtures/fake-claude-stream.mjs"
const referenceScenarioFile = "examples/phase-1-realistic-reference/scenario.json"
const receiptByteLimit = 64 * 1024
const digestPattern = /^sha256:[0-9a-f]{64}$/

export const claudeP0P4TestName = "executes an exact P0-P4 candidate chain through tool-free Claude stream evidence"
export const claudeP0P4Limitations = [
  "The deterministic local Claude stream fixture verifies production invocation construction, stream parsing, redaction, and governed evidence behavior, not live provider authentication, entitlement, reachability, model quality, usage, or cost.",
  "The production Claude lane remains tool-free, context-only, observation-only, fresh-process, and non-resumable; this receipt grants no Tool, filesystem, browser, MCP, write, approval, or external-effect authority.",
  "The governed P0-P4 records exercise one source-bound realistic reference scenario but do not establish a real Product baseline, independent review, readiness, approval, or Product Owner acceptance.",
  "The integration runs through the shared engine and does not validate native IDE installation, activation, interaction, rendering, accessibility, or supported-host acceptance.",
  "The Product Owner explicitly skipped the interrupted Codex Security scan; this acceptance receipt is not security assurance or a security result.",
]

const referenceScenarioBytes = await readFile(resolve(repository, referenceScenarioFile))
const referenceScenario = JSON.parse(referenceScenarioBytes.toString("utf8"))

export const expectedClaudeP0P4Summary = {
  schemaVersion: 1,
  kind: "gaep-claude-p0-p4-semantic-summary",
  referenceScenario: {
    id: referenceScenario.id,
    kind: referenceScenario.kind,
    digest: canonicalDigest(referenceScenario),
    productName: referenceScenario.product.name,
    initiativeTitle: referenceScenario.initiative.title,
    outputKinds: referenceScenario.expectedP0P4Outputs,
    authorityBoundary: referenceScenario.authorityBoundary,
  },
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
    adapterId: "gaep.claude-code-cli",
    agentId: "claude-code-cli",
    modelId: "success",
    mode: "claude-context-only",
    state: "completed",
    providerDisposition: "completed",
    outcomeStatus: "satisfied",
    outcomeBasis: "postcondition-evaluator",
    completedStepCount: 1,
    totalStepCount: 1,
    stagingPresent: false,
    toolDefinitionCount: 0,
    writeScopeCount: 0,
    providerPostconditionStatus: "not-assessed",
    postconditionAuthority: "workflow-gate-evaluator",
    warningCodes: ["runtime-warning", "provider-output-redacted"],
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

export function exactTestSource(source) {
  const text = Buffer.isBuffer(source) ? source.toString("utf8") : String(source)
  const marker = `  it(${JSON.stringify(claudeP0P4TestName)}`
  const start = text.indexOf(marker)
  if (start < 0 || text.indexOf(marker, start + marker.length) >= 0) {
    throw new Error("Claude P0-P4 test source must contain exactly one named integration")
  }
  const end = text.indexOf("\n\n  it(\"", start + marker.length)
  if (end < 0) throw new Error("Claude P0-P4 test source boundary is missing")
  return Buffer.from(text.slice(start, end), "utf8")
}

function fail(message) {
  throw new Error(`Invalid Claude P0-P4 acceptance receipt: ${message}`)
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
  const [testBytes, fakeStreamBytes, currentReferenceScenarioBytes] = await Promise.all([
    readFile(resolve(repository, testFile)),
    readFile(resolve(repository, fakeStreamFile)),
    readFile(resolve(repository, referenceScenarioFile)),
  ])
  return {
    testSourceDigest: rawDigest(exactTestSource(testBytes)),
    fakeStreamSourceDigest: rawDigest(fakeStreamBytes),
    referenceScenarioSourceDigest: rawDigest(currentReferenceScenarioBytes),
  }
}

export async function verifyClaudeP0P4ReceiptObject(receipt) {
  assertExactKeys(receipt, [
    "schemaVersion", "kind", "scenario", "execution", "summary", "summaryDigest", "authority", "limitations",
  ], "receipt")
  if (receipt.schemaVersion !== 1 || receipt.kind !== "gaep-claude-p0-p4-acceptance-receipt") {
    fail("schema or kind differs")
  }
  assertExactKeys(receipt.scenario, [
    "id", "testFile", "testName", "testSourceDigest", "fakeStreamFile", "fakeStreamSourceDigest",
    "referenceScenarioFile", "referenceScenarioSourceDigest",
  ], "receipt.scenario")
  const sourceDigests = await currentSourceDigests()
  if (receipt.scenario.id !== "P1-31" || receipt.scenario.testFile !== testFile ||
      receipt.scenario.testName !== claudeP0P4TestName || receipt.scenario.fakeStreamFile !== fakeStreamFile ||
      receipt.scenario.referenceScenarioFile !== referenceScenarioFile) {
    fail("scenario identity differs")
  }
  assertDigest(receipt.scenario.testSourceDigest, "receipt.scenario.testSourceDigest")
  assertDigest(receipt.scenario.fakeStreamSourceDigest, "receipt.scenario.fakeStreamSourceDigest")
  assertDigest(receipt.scenario.referenceScenarioSourceDigest, "receipt.scenario.referenceScenarioSourceDigest")
  if (receipt.scenario.testSourceDigest !== sourceDigests.testSourceDigest ||
      receipt.scenario.fakeStreamSourceDigest !== sourceDigests.fakeStreamSourceDigest ||
      receipt.scenario.referenceScenarioSourceDigest !== sourceDigests.referenceScenarioSourceDigest) {
    fail("scenario source digest differs from the current executable fixture")
  }
  assertExactKeys(receipt.execution, ["runner", "exitCode", "semanticSummaryCount"], "receipt.execution")
  if (receipt.execution.runner !== "vitest-isolated-child-process" || receipt.execution.exitCode !== 0 ||
      receipt.execution.semanticSummaryCount !== 1) {
    fail("execution evidence differs from one successful isolated test")
  }
  if (JSON.stringify(receipt.summary) !== JSON.stringify(expectedClaudeP0P4Summary)) {
    fail("semantic summary differs from the strict P1-31 contract")
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
  if (JSON.stringify(receipt.limitations) !== JSON.stringify(claudeP0P4Limitations)) fail("limitations differ")
  return receipt
}

export async function verifyClaudeP0P4ReceiptFile(path) {
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
  return verifyClaudeP0P4ReceiptObject(receipt)
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length !== 1) throw new Error("Usage: node scripts/verify_claude_p0_p4_receipt.mjs <receipt.json>")
  const receipt = await verifyClaudeP0P4ReceiptFile(args[0])
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
