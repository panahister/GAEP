#!/usr/bin/env node
// GAEP-P0-CS01 — Phase 0 Platform Readiness realistic example.
//
// Spawns the shared engine-host, calls the protocol-v2 `platformReadiness` endpoint, runs the
// conformance boundary check + explicit merge, writes machine-local raw logs under `evidence/`
// (git-ignored), and emits two tracked, durable artifacts under `acceptance/`:
//   - GAEP-P0-CS01_READINESS_REPORT.json   (normalized, sanitized Final Report)
//   - GAEP-P0-CS01_EVIDENCE_MANIFEST.md     (references + SHA-256 hashes the report)
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  composePlatformReadinessReport,
  computeSubjectDigest,
  runEngineHostBoundaryCheck,
  verifyEvidenceBundle,
} from "@gaep/conformance"

const CHANGE_SET_ID = "GAEP-P0-CS01"
const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, "..", "..")
const engineHostMain = join(repoRoot, "apps", "engine-host", "dist", "main.js")
const extensionBundle = join(repoRoot, "apps", "vscode", "dist", "extension.cjs")
const evidenceDir = join(here, "evidence")
const acceptanceDir = join(here, "acceptance")
const vscodeBundleDir = join(acceptanceDir, "vscode-e2e")
const reportPath = join(acceptanceDir, `${CHANGE_SET_ID}_READINESS_REPORT.json`)
const manifestPath = join(acceptanceDir, `${CHANGE_SET_ID}_EVIDENCE_MANIFEST.md`)

if (!existsSync(engineHostMain)) {
  process.stderr.write(`Missing ${engineHostMain}. Run "npm run build" first.\n`)
  process.exit(1)
}

function createRpcClient(child) {
  const pending = new Map()
  let buffer = ""
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString("utf8")
    let index = buffer.indexOf("\n")
    while (index >= 0) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (line) {
        const message = JSON.parse(line)
        const resolver = pending.get(message.id)
        if (resolver) {
          pending.delete(message.id)
          resolver(message)
        }
      }
      index = buffer.indexOf("\n")
    }
  })
  let nextId = 0
  return (request) => new Promise((resolvePromise, rejectPromise) => {
    const id = request.id ?? `example-${++nextId}`
    pending.set(id, (message) => {
      if (message.error) {
        // Preserve RPC error metadata so the boundary check can distinguish a specific
        // PROTOCOL_UPGRADE_REQUIRED rejection from generic/internal/transport failures.
        const error = new Error(message.error.message || "engine-host error")
        error.code = message.error.code
        error.data = message.error.data
        error.kind = message.error.data?.kind
        rejectPromise(error)
      } else resolvePromise(message.result)
    })
    child.stdin.write(`${JSON.stringify({ ...request, id })}\n`)
  })
}

const workspace = await mkdtemp(join(tmpdir(), "gaep-phase0-readiness-"))
const child = spawn(process.execPath, [engineHostMain, "--workspace", workspace], { stdio: ["pipe", "pipe", "pipe"] })
let stderr = ""
child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8") })

try {
  const dispatch = createRpcClient(child)
  const now = new Date().toISOString()

  const base = await dispatch({ jsonrpc: "2.0", protocolVersion: 2, method: "platformReadiness", params: {} })
  const boundary = await runEngineHostBoundaryCheck({ dispatch, now })

  // Consume ONLY the current verified VS Code evidence bundle for the current subject.
  // passed -> passed; failed -> failed; observation:null / missing / stale / invalid -> no
  // observation, so VS Code keeps its Base `not-run` default.
  const observations = []
  let vsCodeEvidenceNote = "no VS Code evidence bundle present; VS Code remains not-run"
  if (existsSync(vscodeBundleDir) && existsSync(extensionBundle)) {
    try {
      const subjectDigest = computeSubjectDigest(extensionBundle)
      const verified = verifyEvidenceBundle(vscodeBundleDir, subjectDigest)
      if (verified.kind === "observation") {
        observations.push(verified.observation)
        vsCodeEvidenceNote = `verified VS Code observation (state=${verified.observation.state})`
      } else {
        vsCodeEvidenceNote = "verified not-executed VS Code bundle; VS Code remains not-run"
      }
    } catch (error) {
      vsCodeEvidenceNote = `VS Code evidence bundle rejected (${error instanceof Error ? error.message : "unverifiable"}); VS Code remains not-run`
    }
  }

  const report = composePlatformReadinessReport({ base, observations, boundaryChecks: [boundary], changeSetId: CHANGE_SET_ID, now })

  await mkdir(evidenceDir, { recursive: true })
  await mkdir(acceptanceDir, { recursive: true })
  await writeFile(join(evidenceDir, "engine-host-base-snapshot.json"), `${JSON.stringify(base, null, 2)}\n`, "utf8")
  await writeFile(join(evidenceDir, "engine-host.stderr.log"), stderr, "utf8")

  const normalized = `${JSON.stringify(report, null, 2)}\n`
  await writeFile(reportPath, normalized, "utf8")
  const digest = `sha256:${createHash("sha256").update(normalized).digest("hex")}`

  const hostRows = report.hostMatrix.map((row) => `| \`${row.host}\` | \`${row.state}\` | ${row.source === "observation" ? "executed observation" : "base-default (not executed)"} |`).join("\n")
  const providerRows = report.providers.map((provider) => `| \`${provider.adapterId}\` | ${provider.detected ? "detected" : "not-detected"} | \`${provider.truthClass}\` |`).join("\n")
  const manifest = `# GAEP Evidence Manifest — ${CHANGE_SET_ID}

**Change Set ID:** ${CHANGE_SET_ID}
**Generated at:** ${report.generatedAt}
**Engine version:** ${report.engineVersion}

## Commands

- \`npm run build\`
- \`npm run example:phase0\`

## Environment

- OS/arch: ${process.platform}/${process.arch}
- Node: ${process.version}
- Codex present: ${report.providers.find((provider) => provider.adapterId === "gaep.codex-cli")?.detected ? "yes" : "no"}
- Claude Code present: ${report.providers.find((provider) => provider.adapterId === "gaep.claude-code-cli")?.detected ? "yes" : "no"}

## Tracked normalized report

- Path: \`acceptance/${CHANGE_SET_ID}_READINESS_REPORT.json\`
- Truth class: report is composed only from provider probes, workspace health, and executed observations
- **SHA-256:** \`${digest}\`

## Engine-host boundary result (not an IDE host row)

- \`${boundary.checkId}\` → target \`${boundary.target}\` → **${boundary.state}**

## Provider readiness

| Adapter | Detected | Truth class |
|---|---|---|
${providerRows || "| (none) | | |"}

## Four-IDE Host Matrix

| Host | State | Source |
|---|---|---|
${hostRows}

## VS Code evidence (current attempt)

- ${vsCodeEvidenceNote}
- Bundle path: \`acceptance/vscode-e2e/\` (produced by \`npm run evidence:vscode\`)

## Known gaps

- Visual Studio, Rider, and Kiro are not executed in this change set (no observations); rows stay at \`pending-environment\`.

## Raw (machine-local, git-ignored)

- \`evidence/engine-host-base-snapshot.json\`
- \`evidence/engine-host.stderr.log\`
`
  await writeFile(manifestPath, manifest, "utf8")

  process.stdout.write(`Phase 0 readiness example complete.\n`)
  process.stdout.write(`Normalized report: ${reportPath}\n`)
  process.stdout.write(`Evidence manifest: ${manifestPath}\n`)
  process.stdout.write(`Report digest: ${digest}\n`)
} finally {
  child.stdin.end()
  child.kill()
  await rm(workspace, { recursive: true, force: true })
}
