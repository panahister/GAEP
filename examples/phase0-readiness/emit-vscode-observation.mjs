#!/usr/bin/env node
// GAEP-P0-CS01-C1 — dedicated VS Code evidence producer.
//
// Creates the candidate directory, passes its exact path to the extension-host E2E via
// GAEP_E2E_CANDIDATE_DIR (never parses stdout), classifies the current attempt into exactly one
// of executed-passed / executed-failed / not-executed, then builds, VERIFIES, and atomically
// publishes the durable bundle so a stale `passed` can never remain effective.
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { mkdtemp, mkdir, rename, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { UNAVAILABILITY_REASON, computeSubjectDigest, resolveFailureSummary, verifyEvidenceBundle } from "@gaep/conformance"

const PARENT_CHANGE_SET_ID = "GAEP-P0-CS01"
const CORRECTION_SET_ID = "GAEP-P0-CS01-C1"
const CHECK_ID = "vscode.extension-host.e2e"

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "..", "..")
const extensionBundle = join(repoRoot, "apps", "vscode", "dist", "extension.cjs")
const publishDir = join(here, "acceptance", "vscode-e2e")

function sha256(text) {
  return `sha256:${createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex")}`
}

/** Build the three governed artifacts for a classified current attempt. */
function buildBundle({ outcome, snapshot, failureCategory, failureSummary, unavailabilityReason, subjectDigest }) {
  const observedAt = new Date().toISOString()
  const common = {
    schemaVersion: 1,
    parentChangeSetId: PARENT_CHANGE_SET_ID,
    correctionSetId: CORRECTION_SET_ID,
    checkId: CHECK_ID,
    observedAt,
    subjectDigest,
  }
  let envelope
  if (outcome === "passed") {
    envelope = { ...common, executionResult: "executed", testOutcome: "passed", snapshot }
  } else if (outcome === "failed") {
    envelope = { ...common, executionResult: "executed", testOutcome: "failed", failureCategory, failureSummary }
    if (snapshot) envelope.snapshot = snapshot
  } else {
    envelope = { ...common, executionResult: "not-executed", testOutcome: "not-run", unavailabilityReason }
  }

  const envelopeText = `${JSON.stringify(envelope, null, 2)}\n`
  const envelopeDigest = sha256(envelopeText)

  const observationResult = outcome === "not-executed"
    ? { observation: null }
    : {
        observation: {
          host: "vscode",
          checkId: CHECK_ID,
          state: outcome,
          truthClass: "observed",
          observedAt,
          evidenceSource: "readiness-evidence.json",
          executionResult: "executed",
          evidenceDigest: envelopeDigest,
        },
      }
  const observationText = `${JSON.stringify(observationResult, null, 2)}\n`

  const manifest = {
    schemaVersion: 1,
    parentChangeSetId: PARENT_CHANGE_SET_ID,
    correctionSetId: CORRECTION_SET_ID,
    host: "vscode",
    checkId: CHECK_ID,
    subjectDigest,
    artifacts: [
      { path: "readiness-evidence.json", digest: envelopeDigest },
      { path: "observation.json", digest: sha256(observationText) },
    ],
  }
  return {
    "readiness-evidence.json": envelopeText,
    "observation.json": observationText,
    "evidence-manifest.json": `${JSON.stringify(manifest, null, 2)}\n`,
  }
}

async function runE2e(candidateDir) {
  return new Promise((resolvePromise) => {
    const child = spawn("npm", ["run", "test:extension-host", "-w", "gaep-vscode"], {
      cwd: repoRoot,
      stdio: "inherit",
      env: { ...process.env, GAEP_E2E_EMIT_OBSERVATION: "1", GAEP_E2E_CANDIDATE_DIR: candidateDir },
    })
    child.on("close", (code) => resolvePromise(code ?? 1))
    child.on("error", () => resolvePromise(1))
  })
}

if (!existsSync(extensionBundle)) {
  process.stderr.write(`Missing ${extensionBundle}. Run "npm run build" first.\n`)
  process.exit(1)
}

const candidateDir = await mkdtemp(join(tmpdir(), "gaep-vscode-evidence-"))
const stagingDir = await mkdtemp(join(tmpdir(), "gaep-vscode-publish-"))

try {
  const exitCode = await runE2e(candidateDir)
  const subjectDigest = computeSubjectDigest(extensionBundle)
  const signalPath = join(candidateDir, "candidate-result.json")

  // Only allowlisted, constant summaries are persisted — never raw error text.
  let classified
  if (!existsSync(signalPath)) {
    // The extension host never executed the readiness check.
    classified = { outcome: "not-executed", unavailabilityReason: UNAVAILABILITY_REASON }
  } else {
    const signal = JSON.parse(readFileSync(signalPath, "utf8"))
    if (signal.outcome === "passed" && exitCode === 0) {
      classified = { outcome: "passed", snapshot: signal.snapshot }
    } else if (signal.outcome === "failed") {
      classified = { outcome: "failed", snapshot: signal.snapshot, ...resolveFailureSummary(signal.failureCode) }
    } else {
      // Readiness passed but a later E2E phase failed: not a clean pass.
      classified = { outcome: "failed", ...resolveFailureSummary("phase-failed") }
    }
  }

  const files = buildBundle({ ...classified, subjectDigest })
  for (const [name, text] of Object.entries(files)) await writeFile(join(stagingDir, name), text, "utf8")

  // Verify BEFORE publishing; a verification failure publishes nothing.
  verifyEvidenceBundle(stagingDir, subjectDigest)

  await mkdir(publishDir, { recursive: true })
  for (const name of Object.keys(files)) await rename(join(stagingDir, name), join(publishDir, name))

  process.stdout.write(`Published VS Code evidence bundle (${classified.outcome}) to ${publishDir}\n`)
  if (classified.outcome !== "passed") process.exitCode = 1
} catch (error) {
  process.stderr.write(`VS Code evidence production failed; nothing published: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
} finally {
  await rm(candidateDir, { recursive: true, force: true })
  await rm(stagingDir, { recursive: true, force: true })
}
