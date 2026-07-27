import { copyFile, lstat, mkdir, mkdtemp, open, readFile, rename, rm } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { canonicalDigest } from "@gaep/agent-sdk"

import { runClaudeP0P4Acceptance } from "./run_claude_p0_p4_acceptance.mjs"
import { runCodexP0P4Acceptance } from "./run_codex_p0_p4_acceptance.mjs"
import { runProviderOutputComparison } from "./run_provider_output_comparison.mjs"
import {
  createPhase1RealisticReferenceManifest,
  derivePhase1RealisticReferenceReceipt,
  verifyPhase1RealisticReferenceArtifactDirectory,
} from "./phase1_realistic_reference_artifacts.mjs"

const repository = fileURLToPath(new URL("..", import.meta.url))
const scenarioSource = resolve(repository, "examples/phase-1-realistic-reference/scenario.json")

async function writeExclusive(path, value) {
  const content = typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`
  let handle
  try {
    handle = await open(path, "wx", 0o600)
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error(`${path} already exists; refusing to overwrite it`)
    }
    throw error
  }
  try {
    await handle.writeFile(content, "utf8")
    await handle.sync()
  } finally {
    await handle.close()
  }
}

function buildOutputCatalog(scenario, codex, claude) {
  const content = {
    schemaVersion: 1,
    kind: "gaep-phase1-realistic-reference-output-catalog",
    scenario: {
      id: scenario.id,
      digest: codex.summary.referenceScenario.digest,
      productName: scenario.product.name,
      initiativeTitle: scenario.initiative.title,
    },
    providers: {
      codexSummaryDigest: codex.summaryDigest,
      claudeSummaryDigest: claude.summaryDigest,
    },
    outputs: scenario.expectedP0P4Outputs.map((outputKind, index) => ({
      ordinal: index + 1,
      outputKind,
      codexEvidence: "represented",
      claudeEvidence: "represented",
    })),
    counts: {
      outputCount: 25,
      codexRepresentedCount: 25,
      claudeRepresentedCount: 25,
    },
    authorityBoundary: "output-catalog-is-inspectable-local-evidence-not-readiness-approval-acceptance-phase-entry-or-action-authority",
  }
  return { ...content, catalogDigest: canonicalDigest(content) }
}

export async function runPhase1RealisticReferenceArtifacts(path) {
  const target = resolve(path)
  const parent = dirname(target)
  const parentStat = await lstat(parent)
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
    throw new Error("Artifact parent must be a regular directory")
  }
  try {
    await lstat(target)
    throw new Error("Artifact directory already exists; refusing to reuse or overwrite it")
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
  }

  const staging = await mkdtemp(join(parent, ".gaep-phase1-reference-"))
  try {
    await mkdir(resolve(staging, "providers"), { mode: 0o700 })
    await mkdir(resolve(staging, "workspaces"), { mode: 0o700 })
    await copyFile(scenarioSource, resolve(staging, "scenario.json"))
    const scenario = JSON.parse(await readFile(scenarioSource, "utf8"))
    const [codex, claude] = await Promise.all([
      runCodexP0P4Acceptance({ artifactWorkspace: resolve(staging, "workspaces/codex") }),
      runClaudeP0P4Acceptance({ artifactWorkspace: resolve(staging, "workspaces/claude") }),
    ])
    await writeExclusive(resolve(staging, "providers/codex-receipt.json"), codex)
    await writeExclusive(resolve(staging, "providers/claude-receipt.json"), claude)
    const comparison = await runProviderOutputComparison({
      root: staging,
      codexReceiptPath: "providers/codex-receipt.json",
      claudeReceiptPath: "providers/claude-receipt.json",
    })
    await writeExclusive(resolve(staging, "providers/comparison-receipt.json"), comparison)
    await writeExclusive(resolve(staging, "output-catalog.json"), await buildOutputCatalog(scenario, codex, claude))
    const receipt = await derivePhase1RealisticReferenceReceipt(staging)
    await writeExclusive(resolve(staging, "receipt.json"), receipt)
    const manifest = await createPhase1RealisticReferenceManifest(staging)
    await writeExclusive(resolve(staging, "artifact-manifest.json"), manifest)
    await verifyPhase1RealisticReferenceArtifactDirectory(staging)
    await rename(staging, target)
    return verifyPhase1RealisticReferenceArtifactDirectory(target)
  } catch (error) {
    await rm(staging, { recursive: true, force: true })
    throw error
  }
}

function parseArguments(args) {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) return { help: true }
  if (args.length === 2 && args[0] === "--artifacts" && args[1]) return { artifacts: args[1] }
  throw new Error("Usage: node scripts/run_phase1_realistic_reference.mjs --artifacts <new-directory>")
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    process.stdout.write("Usage: node scripts/run_phase1_realistic_reference.mjs --artifacts <new-directory>\n")
    return
  }
  const { receipt, manifest } = await runPhase1RealisticReferenceArtifacts(options.artifacts)
  process.stdout.write(`${JSON.stringify({
    artifactDirectory: resolve(options.artifacts),
    scenarioId: receipt.scenario.id,
    outputCount: receipt.summary.p0P4OutputCount,
    inspectableStoreCount: receipt.summary.inspectableStoreCount,
    artifactFileCount: manifest.inventory.fileCount,
    compositionDigest: receipt.compositionDigest,
  }, null, 2)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
