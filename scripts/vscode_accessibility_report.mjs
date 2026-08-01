import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import {
  readRepositoryRegularFile,
  writeExclusiveRepositoryFile,
} from "./lib/repository-files.mjs"
import { parseVitestSummary } from "./vscode_local_e2e_report.mjs"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

export const accessibilityTestFiles = [
  "apps/vscode/src/studio-document.test.ts",
  "apps/vscode/src/studio-protocol.test.ts",
  "apps/vscode/src/studio-accessibility.test.ts",
  "apps/vscode/src/studio-command-registration.test.ts",
  "apps/vscode/src/studio-session.test.ts",
]

const reportInputFiles = [
  "apps/vscode/package.json",
  "apps/vscode/src/studio-accessibility.test.ts",
  "apps/vscode/src/studio-client.ts",
  "apps/vscode/src/studio-command-registration.test.ts",
  "apps/vscode/src/studio-document.test.ts",
  "apps/vscode/src/studio-document.ts",
  "apps/vscode/src/studio-protocol.test.ts",
  "apps/vscode/src/studio-protocol.ts",
  "apps/vscode/src/studio-session.test.ts",
  "apps/vscode/src/studio-session.ts",
  "apps/vscode/src/studio-styles.ts",
  "evidence/manual-checklists/p3b21-vscode-accessibility.md",
  "scripts/vscode_accessibility_report.mjs",
  "scripts/vscode_accessibility_report.test.mjs",
]

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function inspectAccessibilityManifest(manifest) {
  if (!isObject(manifest) || !isObject(manifest.contributes)) throw new Error("VS Code manifest is malformed")
  const commands = manifest.contributes.commands
  if (!Array.isArray(commands) || commands.length < 40 || commands.length > 128) {
    throw new Error("VS Code command inventory is outside the supported bound")
  }
  const commandIds = commands.map((entry) => entry?.command)
  if (commandIds.some((id) => typeof id !== "string" || !/^gaep\.[a-zA-Z0-9.]+$/u.test(id)) ||
      new Set(commandIds).size !== commandIds.length) {
    throw new Error("VS Code command identifiers must be unique bounded GAEP identifiers")
  }
  if (commands.some((entry) => typeof entry.title !== "string" || entry.title.trim().length < 4 || entry.title.length > 160)) {
    throw new Error("VS Code commands must have bounded accessible titles")
  }

  const expectedViews = [
    { id: "gaep.overview", name: "Product" },
    { id: "gaep.agent", name: "Agent" },
    { id: "gaep.governance", name: "Governance" },
    { id: "gaep.runs", name: "Runs" },
  ]
  const views = manifest.contributes.views?.gaep
  if (JSON.stringify(views) !== JSON.stringify(expectedViews)) {
    throw new Error("VS Code native view inventory differs from the approved accessible surface")
  }
  const activationEvents = new Set(manifest.activationEvents)
  if (!activationEvents.has("onWebviewPanel:gaep.productStudio") ||
      expectedViews.some(({ id }) => !activationEvents.has(`onView:${id}`))) {
    throw new Error("VS Code accessible surfaces are missing activation events")
  }
  return {
    commands: commands.length,
    views: expectedViews.length,
    commandTitles: "bounded-and-nonempty",
    viewNames: "exact-and-nonempty",
    activationEvents: "complete",
  }
}

export function composeAccessibilityReport({ checkpoint, observedAt, focused, manifest, sourceDigests }) {
  if (focused.status !== "passed" || focused.files !== accessibilityTestFiles.length || focused.tests < 40) {
    throw new Error("Accessibility focused verification did not pass the exact minimum gate")
  }
  return {
    schemaVersion: 1,
    kind: "gaep-local-vscode-accessibility-report",
    scope: {
      host: "vscode",
      execution: "local-automated",
      repositoryCheckpoint: checkpoint,
      observedAt,
      otherHostMatrices: "not-run",
      normalProfile: "not-touched",
      externalSystems: "not-used",
    },
    result: "automated-passed-manual-pending",
    focusedVerification: {
      status: "passed",
      files: [...accessibilityTestFiles],
      fileCount: focused.files,
      tests: focused.tests,
      skipped: focused.skipped,
    },
    manifestVerification: manifest,
    coverage: [
      { id: "keyboard-route-and-native-controls", status: "passed-automated" },
      { id: "focus-route-edit-pagination-sort-filter", status: "passed-automated" },
      { id: "screen-reader-labels-live-announcements", status: "passed-automated" },
      { id: "delivery-table-order-and-completeness", status: "passed-automated", routes: 12, deliveryTables: 44 },
      { id: "sorting-filtering-visible-metadata-export", status: "passed-automated" },
      { id: "disabled-action-explanations", status: "passed-automated" },
      { id: "empty-loading-error-offline-interrupted", status: "passed-automated" },
      { id: "axe-core-dom-rules", status: "passed-automated", colorContrast: "not-computable-in-jsdom" },
      { id: "forced-colors-and-reduced-motion-rules", status: "passed-static-css" },
      { id: "manual-native-accessibility", status: "pending-human" },
    ],
    manualChecklist: {
      path: "evidence/manual-checklists/p3b21-vscode-accessibility.md",
      status: "pending-human",
      signed: false,
    },
    sourceDigests,
    privacy: {
      rawCommandOutputIncluded: false,
      absoluteMachinePathsIncluded: false,
      sourceBytesIncluded: false,
      environmentValuesIncluded: false,
      secretsIncluded: false,
    },
    authorityBoundary: "This report establishes deterministic local automated accessibility checks only. It grants no manual, assistive-technology, native-platform, Product Owner, security, release, publication, deployment, provider, Figma, or other-host acceptance authority.",
    limitations: [
      "JSDOM cannot calculate native theme color contrast, layout, zoom reflow, platform focus rendering, or assistive-technology speech output.",
      "Forced-colors and reduced-motion coverage verifies executable CSS rules, not every native OS and VS Code theme combination.",
      "The manual checklist remains unsigned and no human accessibility acceptance is established.",
      "No live provider, Figma, normal-profile extension, external system, publication, release or deployment action is used.",
    ],
  }
}

async function sourceDigests() {
  const entries = []
  for (const path of [...reportInputFiles].sort()) {
    const artifact = await readRepositoryRegularFile(repositoryRoot, path, { maximumBytes: 8 * 1024 * 1024 })
    entries.push({
      path,
      bytes: artifact.bytes.byteLength,
      sha256: createHash("sha256").update(artifact.bytes).digest("hex"),
    })
  }
  return entries
}

async function runCommand(executable, args) {
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
      else reject(new Error(`Accessibility verification failed with ${signal ? `signal ${signal}` : `exit code ${String(code)}`}`))
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
  if (!/^(?:working-tree|[0-9a-f]{7,64})$/u.test(result.checkpoint)) {
    throw new Error("--checkpoint must be working-tree or a Git object ID")
  }
  if (result.observedAt !== "not-recorded" && Number.isNaN(Date.parse(result.observedAt))) {
    throw new Error("--observed-at must be an ISO-8601 timestamp")
  }
  return result
}

function assertPrivacySafe(report) {
  const serialized = JSON.stringify(report)
  for (const prefix of ["/Users/", "/home/", "C:\\Users\\", "/tmp/", "/private/tmp/"]) {
    if (serialized.includes(prefix)) throw new Error(`Accessibility report contains an absolute path prefix: ${prefix}`)
  }
  if (report.sourceDigests.some((entry) => isAbsolute(entry.path) ||
      relative(repositoryRoot, resolve(repositoryRoot, entry.path)).startsWith(".."))) {
    throw new Error("Accessibility report contains a source path outside the repository")
  }
}

export async function runAccessibilityReport(args = process.argv.slice(2)) {
  const options = parseArguments(args)
  const vitestEntry = resolve(repositoryRoot, "node_modules/vitest/vitest.mjs")
  if (!existsSync(vitestEntry)) throw new Error("The local Vitest entrypoint is unavailable")
  const output = await runCommand(process.execPath, [
    vitestEntry,
    "run",
    ...accessibilityTestFiles,
    "--maxWorkers=2",
  ])
  const manifestArtifact = await readRepositoryRegularFile(repositoryRoot, "apps/vscode/package.json", { maximumBytes: 1024 * 1024 })
  const report = composeAccessibilityReport({
    checkpoint: options.checkpoint,
    observedAt: options.observedAt,
    focused: parseVitestSummary(output),
    manifest: inspectAccessibilityManifest(JSON.parse(manifestArtifact.bytes.toString("utf8"))),
    sourceDigests: await sourceDigests(),
  })
  assertPrivacySafe(report)
  const serialized = `${JSON.stringify(report, null, 2)}\n`
  if (options.output) {
    const path = await writeExclusiveRepositoryFile(repositoryRoot, options.output, serialized)
    process.stdout.write(`GAEP local VS Code accessibility report written: ${path}\n`)
  } else {
    process.stdout.write(serialized)
  }
  return report
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await runAccessibilityReport()
