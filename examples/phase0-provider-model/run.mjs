#!/usr/bin/env node
// GAEP-P0-CS02 — end-to-end provider/model vertical slice. It initializes a REAL temporary Product
// and a REAL governed Context Pack through the governed GAEP APIs, then drives the whole read-only
// analysis over the packaged Engine Host's protocol v3 RPC boundary: providerCatalog →
// selectProviderModel (Claude Code + sonnet) → startReadOnlyAnalysis → poll readAnalysisRun. It
// verifies the persisted Selection, run record, pre-run evidence, and result evidence, proves no
// Product source and no unauthorized `.gaep/**` path mutated, and shuts the Engine Host down cleanly.
//
// It never constructs GaepEngine to run the analysis, never calls engine.readOnlyAnalysis.start(),
// and never fabricates the context text or a Context Pack id. Verification outcome: completed → PASS;
// a specifically-classified auth-unavailable → truthful environment blocker (exit 0, recorded, never
// a pass); provider-error / internal / protocol-error / timeout / source-mutation → non-zero exit.
import { randomUUID, createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { CodexAdapter } from "@gaep/adapter-codex"
import { ClaudeAdapter } from "@gaep/adapter-claude"
import { canonicalDigest } from "@gaep/agent-sdk"
import {
  GaepEngine,
  computeSourceIdentity,
  snapshotProductDigests,
  diffProductDigests,
  snapshotWorkspaceDigests,
  isGovernedAllowlistedPath,
  readEngineHostLock,
} from "@gaep/engine"

import { createEngineHostRpc } from "../../scripts/lib/engine_host_rpc.mjs"

const verify = process.argv.includes("--verify")
const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "..", "..")
const engineHostMain = join(repoRoot, "apps", "engine-host", "dist", "main.js")
const acceptanceDir = join(here, "acceptance")
const evidenceDir = join(here, "evidence")
const outRoot = join(repoRoot, "dist", "phase0", "cs02")
const reportPath = join(acceptanceDir, "GAEP-P0-CS02_ACCEPTANCE_REPORT.json")
const manifestPath = join(acceptanceDir, "GAEP-P0-CS02_EVIDENCE_MANIFEST.md")

if (!existsSync(engineHostMain)) {
  process.stderr.write(`Missing ${engineHostMain}. Run "npm run build" first.\n`)
  process.exit(1)
}

const sha256Text = (t) => `sha256:${createHash("sha256").update(Buffer.from(t, "utf8")).digest("hex")}`
const sha256File = (p) => `sha256:${createHash("sha256").update(readFileSync(p)).digest("hex")}`
const fail = (message) => { process.stderr.write(`CS02 example verify: FAIL — ${message}\n`) }

// --- Governed setup: a real Product + a real governed Context Pack (governed APIs, NOT analysis) ---
const workspace = await mkdtemp(join(tmpdir(), "gaep-cs02-example-"))
const setupEngine = new GaepEngine(workspace, [new CodexAdapter(), new ClaudeAdapter()])
await setupEngine.createProduct({
  name: "CS02 Provider/Model Vertical Slice",
  summary: "A minimal Product that exercises the read-only provider/model slice end to end.",
  problem: "The provider/model slice must be provable over the real Engine Host RPC boundary.",
  affectedUsers: "Founders validating the read-only analysis path",
  desiredOutcome: "A bounded read-only analysis runs from a governed Context Pack without mutation.",
  successSignals: ["A terminal run record and evidence persist under .gaep"],
  firstWorkflow: "Select a provider/model and run one bounded read-only analysis.",
  exclusions: ["Any workspace mutation"],
  profile: "software",
}, "founder")

const contextContent = "GAEP bounded fact: the answer to the provider/model probe is the single word ACORN."
const contextPack = await setupEngine.productStudio.createContextPack({
  objective: "Provide the single bounded fact required to answer the provider/model probe.",
  recipient: { kind: "agent", id: "local-agent" },
  items: [{
    id: randomUUID(),
    source: { kind: "logical", value: "product-direction" },
    sourceDigest: canonicalDigest(contextContent),
    selectionReason: "The probe answer is the only required fact.",
    required: true,
    content: contextContent,
    contentDigest: canonicalDigest(contextContent),
    trust: {
      semanticAuthority: { standing: "advisory", domain: "Product design", owner: "founder", scope: ["Local Founder Edition"], precedence: 10 },
      epistemicRole: "reference",
      sourceAuthenticity: "verified",
      contentIntegrity: "verified",
      confidentiality: { classification: "internal", purpose: "Answer the bounded probe", recipients: ["local-agent"], retention: "Retain with the Product revision" },
      instructionPrivilege: "workflow-data",
      freshness: { status: "fresh", assessedAt: new Date().toISOString(), basis: "Current governed revision" },
      validity: { status: "valid", basis: "Schema and source checks passed" },
      revisionDisposition: "current",
      applicability: { status: "applicable", basis: "Directly answers the probe" },
    },
    transformations: [],
  }],
  omissions: [],
  warnings: [],
  conflicts: [],
  classificationCombinationRisk: "No additional combination risk for this single internal item.",
  sufficiencyCriteria: ["The bounded probe fact is present and valid"],
  sufficiencyEvaluator: { kind: "system", id: "gaep.context-evaluator" },
  sufficiencyAssumptions: [],
}, 1, "founder")

const objective = "Reply with the single fact contained in the bounded Context Pack and nothing else."
const sourceIdentity = await computeSourceIdentity(repoRoot)

// --- Drive the entire analysis over the real Engine Host protocol-v3 RPC boundary ---
const rpc = createEngineHostRpc({ command: process.execPath, args: [engineHostMain, "--workspace", workspace] })
const dispatch = (method, params) => rpc.request(method, params)
let catalog, projection
let lockReleased = false
let analysis = { adapterId: "gaep.claude-code-cli", modelId: "sonnet", state: "not-run", failureCategory: null, resultDigest: null, sourceMutated: false, unauthorizedGaepWrite: null, persisted: {} }
try {
  // Fail fast (rather than hang) if the Engine Host cannot start; this also warms the shared host.
  await rpc.awaitReady("providerCatalog")
  catalog = await dispatch("providerCatalog")
  projection = await dispatch("dashboardProjection")
  const claude = catalog.providers.find((p) => p.adapterId === "gaep.claude-code-cli")

  if (claude?.detected) {
    await dispatch("selectProviderModel", { adapterId: "gaep.claude-code-cli", modelId: "sonnet" })
    // Snapshot the whole workspace AFTER selection (a governed GAEP write) and immediately before the
    // analysis, so any change during the analysis window is attributable to it.
    const productBefore = await snapshotProductDigests(workspace)
    const workspaceBefore = await snapshotWorkspaceDigests(workspace)
    const started = await dispatch("startReadOnlyAnalysis", {
      objective,
      contextPackIds: [contextPack.id],
      timeoutMs: 120000,
      idempotencyKey: randomUUID(),
    })
    // Poll to terminal via readAnalysisRun.
    let record = started
    for (let attempt = 0; attempt < 130 && record.state === "running"; attempt += 1) {
      await new Promise((r) => setTimeout(r, 1000))
      record = await dispatch("readAnalysisRun", { analysisRunId: started.analysisRunId })
    }
    analysis.state = record.state
    analysis.failureCategory = record.failureCategory ?? null
    analysis.resultDigest = record.result ? sha256Text(record.result.text) : null

    // Verify persisted governed records exist.
    const runId = started.analysisRunId
    analysis.persisted = {
      selection: existsSync(join(workspace, ".gaep", "runtime", "selection.json")),
      run: existsSync(join(workspace, ".gaep", "runs", `${runId}.json`)),
      preRunEvidence: existsSync(join(workspace, ".gaep", "evidence", `${runId}.pre-run.json`)),
      resultEvidence: existsSync(join(workspace, ".gaep", "evidence", `${runId}.result.json`)),
    }

    // Prove no Product source mutated and every `.gaep` change is on the governed allowlist.
    const productAfter = await snapshotProductDigests(workspace)
    analysis.sourceMutated = diffProductDigests(productBefore, productAfter).length > 0
    const workspaceAfter = await snapshotWorkspaceDigests(workspace)
    const changed = diffProductDigests(workspaceBefore, workspaceAfter)
    const unauthorized = changed.filter((v) => v.path.startsWith(".gaep/") && !isGovernedAllowlistedPath(v.path))
    analysis.unauthorizedGaepWrite = unauthorized.length > 0 ? unauthorized[0].path : null
  } else {
    analysis.state = "not-run"
    analysis.failureCategory = "provider-unavailable"
  }
} finally {
  // Graceful shutdown: stdin close → awaited exit → forced kill only after a bounded grace.
  await rpc.close()
  // The machine-local Engine Host lock must be actually REMOVED on shutdown (its owner cleared it on
  // graceful exit). A merely stale lock file is NOT accepted as released. Poll briefly for the
  // filesystem removal to settle after the confirmed process exit.
  for (let attempt = 0; attempt < 20 && readEngineHostLock(workspace) !== undefined; attempt += 1) {
    await new Promise((r) => setTimeout(r, 25))
  }
  lockReleased = readEngineHostLock(workspace) === undefined
}

const packageManifest = existsSync(join(outRoot, "package-manifest.json"))
  ? JSON.parse(readFileSync(join(outRoot, "package-manifest.json"), "utf8"))
  : null
if (verify && packageManifest && packageManifest.sourceIdentity.sourceTreeDigest !== sourceIdentity.sourceTreeDigest) {
  await rm(workspace, { recursive: true, force: true })
  throw new Error("stale artifacts: package-manifest sourceTreeDigest does not match the current source tree")
}

const providers = (catalog?.providers ?? []).map((p) => ({
  adapterId: p.adapterId, detected: p.detected, runtimeVersion: p.runtimeVersion ?? null,
  authReadiness: p.authReadiness, models: p.models.map((m) => ({ id: m.id, truthClass: m.truthClass, alias: m.alias })),
  analysisState: p.adapterId === "gaep.claude-code-cli" ? analysis.state : "not-run",
}))

mkdirSync(acceptanceDir, { recursive: true })
mkdirSync(evidenceDir, { recursive: true })
if (catalog) writeFileSync(join(evidenceDir, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`)

const report = {
  schemaVersion: 1, changeSetId: "GAEP-P0-CS02", generatedAt: new Date().toISOString(), sourceIdentity,
  workspaceState: projection?.workspaceState ?? "unknown", providers,
  analysis: {
    adapterId: analysis.adapterId, modelId: analysis.modelId, state: analysis.state, failureCategory: analysis.failureCategory,
    resultDigest: analysis.resultDigest, productSourceMutated: analysis.sourceMutated, unauthorizedGaepWrite: analysis.unauthorizedGaepWrite,
    contextPackId: contextPack.id, persisted: analysis.persisted, transport: "engine-host-protocol-v3-rpc", engineHostLockReleased: lockReleased,
  },
  hostMatrix: (projection?.hostMatrix ?? []).map((r) => ({ host: r.host, conformanceState: r.conformanceState, evidenceState: r.evidenceState })),
  packageManifestDigest: packageManifest ? sha256Text(`${JSON.stringify(packageManifest, null, 2)}\n`) : null,
  packageArtifacts: packageManifest ? packageManifest.artifacts.map((a) => ({ ideHost: a.ideHost, buildState: a.buildState, installTestState: a.installTestState, workflowTestState: a.workflowTestState })) : [],
  notes: [
    "Provider catalog, selection, analysis start, and polling are driven entirely over the packaged Engine Host protocol v3 (no direct engine analysis).",
    "The bounded context is a real governed Context Pack created through the governed GAEP APIs; the context id and text are never fabricated.",
    "completed → PASS; a classified auth-unavailable → truthful environment blocker; provider-error/internal/protocol-error/timeout/source-mutation → verification FAIL.",
  ],
}
const reportText = `${JSON.stringify(report, null, 2)}\n`
writeFileSync(reportPath, reportText)
const reportDigest = sha256Text(reportText)

const hashed = [{ path: "acceptance/GAEP-P0-CS02_ACCEPTANCE_REPORT.json", digest: reportDigest }]
for (const rel of ["package-manifest.json", "SHA256SUMS.txt"]) {
  const abs = join(outRoot, rel)
  if (existsSync(abs)) hashed.push({ path: `dist/phase0/cs02/${rel}`, digest: sha256File(abs) })
}

const claudeP = providers.find((p) => p.adapterId === "gaep.claude-code-cli")
const manifestMd = `# GAEP Evidence Manifest — GAEP-P0-CS02

**Change Set ID:** GAEP-P0-CS02
**Generated at:** ${report.generatedAt}
**Source tree digest:** ${sourceIdentity.sourceTreeDigest}
**Base commit / dirty (provenance only):** ${sourceIdentity.baseCommit} / ${sourceIdentity.dirty}

## Commands

- \`npm run build\`
- \`npm run release:cs02 -- --verify\`
- \`npm run example:cs02 -- --verify\`

## Environment (observed)

- OS/arch: ${process.platform}/${process.arch}; Node: ${process.version}
- Codex present: ${providers.find((p) => p.adapterId === "gaep.codex-cli")?.detected ? "yes" : "no"}
- Claude Code present: ${claudeP?.detected ? "yes" : "no"} (${claudeP?.runtimeVersion ?? "n/a"})

## Read-only analysis (protocol v3 RPC)

- Provider/model: ${analysis.adapterId} / ${analysis.modelId}
- Context Pack: \`${contextPack.id}\` (governed)
- Terminal state: **${analysis.state}**${analysis.failureCategory ? ` (${analysis.failureCategory})` : ""}
- Persisted: selection=${analysis.persisted.selection ? "yes" : "no"}, run=${analysis.persisted.run ? "yes" : "no"}, pre-run evidence=${analysis.persisted.preRunEvidence ? "yes" : "no"}, result evidence=${analysis.persisted.resultEvidence ? "yes" : "no"}
- Product source mutated: **${analysis.sourceMutated ? "YES — fail closed" : "no"}**; unauthorized \`.gaep\` write: **${analysis.unauthorizedGaepWrite ?? "none"}**
- Result digest: ${analysis.resultDigest ?? "n/a"}

## Provider / model truth

${providers.map((p) => `- \`${p.adapterId}\`: ${p.detected ? "detected" : "not-detected"}; auth=${p.authReadiness}; models=${p.models.map((m) => `${m.id}[${m.truthClass}${m.alias ? ",alias" : ""}]`).join(", ") || "none"}; analysis=${p.analysisState}`).join("\n")}

## Host packages (truthful)

${report.packageArtifacts.map((a) => `- ${a.ideHost}: build=${a.buildState}, install=${a.installTestState}, workflow=${a.workflowTestState}`).join("\n") || "- (no package manifest present)"}

## Hashed artifacts (this manifest does NOT hash itself)

${hashed.map((h) => `- \`${h.path}\`: ${h.digest}`).join("\n")}

## Trust boundary

Digests establish integrity and consistency against the supplied artifacts; they do **not** establish cryptographic producer authenticity. Unavailable hosts/providers remain \`not-run\`/\`pending-environment\` and are never marked passed.

## Known gaps

- Visual Studio (\`requires-windows-visual-studio\`) and Rider (\`requires-jdk21\`) build via external lanes; not executed here.
- Kiro install/workflow require a Kiro installation.
- Codex analysis requires an available Codex runtime.
- A \`completed\` Claude analysis requires an authenticated Claude Code runtime; a classified \`auth-unavailable\` is a truthful environment blocker, never a pass.
`
writeFileSync(manifestPath, manifestMd)

// --- Verification outcome mapping ---
if (verify) {
  if (sha256File(reportPath) !== reportDigest) { fail("acceptance report digest mismatch"); await rm(workspace, { recursive: true, force: true }); process.exit(1) }
  for (const h of hashed.slice(1)) {
    if (sha256File(join(repoRoot, h.path)) !== h.digest) { fail(`artifact digest mismatch: ${h.path}`); await rm(workspace, { recursive: true, force: true }); process.exit(1) }
  }

  const FAIL_CATEGORIES = new Set(["provider-error", "internal", "protocol-error", "timeout", "source-mutation"])
  let exitCode = 0
  if (!lockReleased) { fail("the machine-local Engine Host lock was not released on shutdown"); exitCode = 1 }
  else if (analysis.sourceMutated) { fail("read-only analysis mutated Product source"); exitCode = 1 }
  else if (analysis.unauthorizedGaepWrite) { fail(`unauthorized .gaep write: ${analysis.unauthorizedGaepWrite}`); exitCode = 1 }
  else if (analysis.state === "completed") {
    // A completed run must have persisted its governed records and its result evidence.
    if (!analysis.persisted.selection || !analysis.persisted.run || !analysis.persisted.preRunEvidence || !analysis.persisted.resultEvidence) {
      fail("a completed analysis is missing a persisted selection/run/evidence record"); exitCode = 1
    } else {
      process.stdout.write("CS02 example verify: PASS (completed read-only analysis over protocol v3)\n")
    }
  } else if (analysis.state === "failed" && analysis.failureCategory === "auth-unavailable") {
    // Truthful environment blocker: recorded, exit 0, and NEVER a pass.
    process.stdout.write("CS02 example verify: BLOCKED (auth-unavailable) — an authenticated Claude runtime is required; this is a truthful environment blocker, not a pass.\n")
  } else if (analysis.state === "not-run" && analysis.failureCategory === "provider-unavailable") {
    process.stdout.write("CS02 example verify: BLOCKED (provider-unavailable) — Claude Code is not detected in this environment.\n")
  } else if (FAIL_CATEGORIES.has(analysis.failureCategory)) {
    fail(`analysis terminated as ${analysis.state} (${analysis.failureCategory})`); exitCode = 1
  } else {
    fail(`analysis terminated in an unexpected state: ${analysis.state} (${analysis.failureCategory ?? "n/a"})`); exitCode = 1
  }

  await rm(workspace, { recursive: true, force: true })
  if (exitCode !== 0) process.exit(exitCode)
  process.stdout.write(`Acceptance report: ${reportPath}\nReport digest: ${reportDigest}\n`)
  process.exit(0)
}

await rm(workspace, { recursive: true, force: true })
process.stdout.write(`CS02 example complete.\nAnalysis: ${analysis.state}${analysis.failureCategory ? ` (${analysis.failureCategory})` : ""}; source mutated: ${analysis.sourceMutated}\nAcceptance report: ${reportPath}\nReport digest: ${reportDigest}\n`)
