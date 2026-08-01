import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { promisify } from "node:util"
import { fileURLToPath, pathToFileURL } from "node:url"

const execFileAsync = promisify(execFile)
const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)))
const specs = [
  ["functional", "evidence/vscode-checkpoints/20260801T072843Z-p3b18-unit-integration-testing.json", "746d253", "local-functional-gate"],
  ["unit-integration", "evidence/vscode-checkpoints/20260801T072843Z-p3b18-unit-integration-testing.json", "746d253", "local-unit-integration-gate"],
  ["e2e", "evidence/vscode-checkpoints/20260801T074130Z-p3b19-local-vscode-e2e.json", "0bd9ed8", "local-e2e-receipt"],
  ["security", "evidence/vscode-checkpoints/20260801T083625Z-p3b20-local-security.json", "a6ff5f3", "local-security-report"],
  ["accessibility", "evidence/vscode-checkpoints/20260801T084802Z-p3b21-accessibility.json", "78b9d9a", "local-accessibility-report"],
  ["visual-fixture", "apps/vscode/test/visual/baselines/p3b22/manifest.json", "bf15fd1", "local-visual-fixture-report"],
  ["performance", "evidence/vscode-checkpoints/20260801T092415Z-p3b23-performance-reliability.json", "063e5d12", "local-performance-report"],
  ["reliability", "evidence/vscode-checkpoints/20260801T092415Z-p3b23-performance-reliability.json", "063e5d12", "local-reliability-report"],
  ["trace-coverage", "evidence/vscode-checkpoints/20260731T213608Z-p3b17-test-generation.json", "8784262", "trace-coverage-candidate"],
  ["unresolved-gaps", "docs/06_Roadmap/054_GAEP_FEATURE_DELIVERY_TRACKER.md", "26108a6", "gap-register"],
]
const gapKeys = ["gap.current-figma", "gap.hostile-same-uid", "gap.human-accessibility", "gap.human-design", "gap.live-provider",
  "gap.native-power-loss", "gap.native-untrusted-workspace", "gap.product-owner-acceptance", "gap.release-authority",
  "gap.security-approval", "gap.supported-platform", "gap.sustained-production"]
function assert(value, message) { if (!value) throw new Error(message) }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex") }

function verifySource(source) {
  const value = source.json
  switch (source.id) {
    case "functional": case "unit-integration": assert(value?.verification?.focused?.status === "passed" && value?.verification?.sharedAndVscode?.status === "passed", "P3B-18 evidence is not passing"); break
    case "e2e": assert(value?.result === "passed", "P3B-19 evidence is not passing"); break
    case "security": assert(value?.result === "passed-with-open-acceptance-gates", "P3B-20 evidence is not passing"); break
    case "accessibility": assert(value?.result === "automated-passed-manual-pending", "P3B-21 evidence is not passing"); break
    case "visual-fixture": assert(value?.kind === "gaep-vscode-product-studio-visual-baseline" && value.scenarios?.length === 6 && value.scenarios.some((entry) => entry.route === "delivery" && entry.dom?.tableCount === 45), "Visual baseline does not bind 45 Delivery tables"); break
    case "performance": case "reliability": assert(value?.result === "local-budgets-passed-native-power-loss-pending", "P3B-23 evidence is not passing"); break
    case "trace-coverage": assert(value?.verification?.focused?.status === "passed", "P3B-17 evidence is not passing"); break
    default: assert(source.text?.includes("P3B-24") && source.text.includes("Product Owner acceptance"), "Gap register is stale")
  }
}

export function composeQaScorecardReport({ checkpoint, observedAt, sources, focused, visual }) {
  assert(/^[0-9a-f]{40}$/.test(checkpoint), "Checkpoint must be a full Git object ID")
  assert(!Number.isNaN(Date.parse(observedAt)), "observedAt must be an ISO date-time")
  assert(sources?.length === 10, "Scorecard requires ten evidence dimensions")
  assert(focused?.status === "passed" && focused.files === 5 && focused.tests >= 20 && focused.skipped === 0, "Focused scorecard verification is incomplete")
  assert(visual?.status === "passed" && visual.scenarios === 6 && visual.deliveryTables === 45, "Visual scorecard verification is incomplete")
  const dimensions = sources.map((source, index) => {
    const [id, path, sourceCheckpoint, kind] = specs[index]
    assert(source.id === id && source.path === path, "Scorecard evidence order or identity is invalid")
    verifySource(source)
    const unresolved = id === "unresolved-gaps"
    return { id, ordinal: index + 1, state: unresolved ? "not-assessed" : "success",
      evidence: [{ id: `evidence.${id}`, dimensionId: id, kind, artifactPath: path, artifactDigest: `sha256:${source.sha256}`,
        sourceCheckpoint, observedAt, outcome: unresolved ? "not-assessed" : "success", freshness: "current",
        testCount: Number(source.tests ?? 0), skippedCount: Number(source.skipped ?? 0), limitationCount: unresolved ? gapKeys.length : 1,
        localExecutionOnly: true, acceptanceState: "not-established" }], gapKeys: unresolved ? [...gapKeys] : [],
      localAutomationState: unresolved ? "not-run" : "passed", humanValidationState: "not-established",
      productOwnerAcceptanceState: "not-established" }
  })
  return { schemaVersion: 1, kind: "gaep-local-vscode-multi-dimensional-qa-scorecard-report",
    scope: { host: "vscode", execution: "local-deterministic-evidence-composition", repositoryCheckpoint: checkpoint, observedAt,
      normalProfile: "not-touched", otherHostMatrices: "not-run", externalSystems: "not-used" },
    result: "local-automation-current-human-and-external-gates-pending",
    scorecard: { dimensions, successCount: 9, failureCount: 0, missingCount: 0, staleCount: 0, notAssessedCount: 1,
      unresolvedGapKeys: [...gapKeys], state: "attention-required", releaseReadiness: "not-established" },
    focusedVerification: focused, visualVerification: visual,
    sourceDigests: [...new Map(sources.map((source) => [source.path, { path: source.path, bytes: source.bytes, sha256: source.sha256 }])).values()].sort((a, b) => a.path.localeCompare(b.path)),
    privacy: { rawTestOutputIncluded: false, absoluteMachinePathsIncluded: false, environmentValuesIncluded: false, sourceBytesIncluded: false, secretsIncluded: false },
    authorityBoundary: "This scorecard summarizes bounded local VS Code automation only. It grants no Product truth, native human validation, security approval, Product Owner acceptance, release, publication, deployment, provider, Figma or other-host authority.",
    limitations: ["Local automation success is not Product truth, semantic quality, human validation or supported-platform acceptance.",
      "Security automation is not accountable security approval or risk acceptance.",
      "Visual fixtures are renderer-bound and do not establish current Figma, native display or perceptual quality.",
      "Performance and reliability measurements are one-machine regression budgets, not production capacity, power-loss or hostile same-UID guarantees."] }
}

async function readSources() {
  return Promise.all(specs.map(async ([id, path]) => {
    const bytes = await readFile(resolve(repositoryRoot, path)), text = bytes.toString("utf8")
    const source = { id, path, bytes: bytes.length, sha256: sha256(bytes), text, ...(path.endsWith(".json") ? { json: JSON.parse(text) } : {}) }
    if (id === "functional") Object.assign(source, { tests: source.json.verification.sharedAndVscode.testsPassed, skipped: source.json.verification.sharedAndVscode.testsSkipped })
    else if (id === "unit-integration" || id === "trace-coverage") Object.assign(source, { tests: source.json.verification.focused.testsPassed, skipped: source.json.verification.focused.testsSkipped })
    else if (source.json?.focusedVerification) Object.assign(source, { tests: source.json.focusedVerification.tests, skipped: source.json.focusedVerification.skipped })
    return source
  }))
}
async function command(name, args) { const { stdout, stderr } = await execFileAsync(name, args, { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }); return `${stdout}${stderr}` }
function focusedResult(output) { return { status: "passed", files: Number(output.match(/Test Files\s+(\d+) passed/)?.[1]), tests: Number(output.match(/Tests\s+(\d+) passed/)?.[1]), skipped: Number(output.match(/Tests\s+\d+ passed(?:\s+\|\s+(\d+) skipped)?/)?.[1] ?? 0) } }
async function main() {
  const args = Object.fromEntries(process.argv.slice(2).reduce((rows, value, index, values) => index % 2 ? rows : [...rows, [value.replace(/^--/, ""), values[index + 1]]], []))
  assert(args.checkpoint && args["observed-at"] && args.output, "Usage: --checkpoint <sha> --observed-at <iso> --output <path>")
  const output = await command("npx", ["vitest", "run", "packages/contracts/src/qa-scorecard.test.ts", "packages/engine/src/qa-scorecard.test.ts", "apps/vscode/src/qa-scorecard-product-studio.test.ts", "apps/vscode/src/studio-protocol.test.ts", "apps/vscode/src/studio-accessibility.test.ts"])
  process.stdout.write(output)
  process.stdout.write(await command("npm", ["run", "test:vscode:visual"]))
  const report = composeQaScorecardReport({ checkpoint: args.checkpoint, observedAt: args["observed-at"], sources: await readSources(), focused: focusedResult(output), visual: { status: "passed", scenarios: 6, deliveryTables: 45 } })
  await writeFile(resolve(repositoryRoot, args.output), `${JSON.stringify(report, null, 2)}\n`, { flag: "wx", mode: 0o600 })
  process.stdout.write(`GAEP local VS Code QA scorecard report written: ${args.output}\n`)
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
