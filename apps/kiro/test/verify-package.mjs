import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { lstat, readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import yauzl from "yauzl"

const kiroRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const maximumArchiveBytes = 8 * 1024 * 1024
const maximumEntryBytes = 4 * 1024 * 1024
const maximumTotalBytes = 8 * 1024 * 1024
const expectedEntries = [
  "[Content_Types].xml",
  "extension.vsixmanifest",
  "extension/LICENSE.txt",
  "extension/dist/extension.cjs",
  "extension/dist/gaep-engine.mjs",
  "extension/package.json",
  "extension/readme.md",
]

function fail(message) {
  throw new Error(`Invalid GAEP Kiro VSIX: ${message}`)
}

function digest(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`
}

async function readBoundedRegularFile(path, label, maximumBytes = maximumArchiveBytes) {
  const stat = await lstat(path)
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`${label} must be a regular file`)
  if (stat.size < 1 || stat.size > maximumBytes) fail(`${label} is outside its byte boundary`)
  return readFile(path)
}

function openArchive(bytes) {
  return new Promise((resolveOpen, rejectOpen) => {
    yauzl.fromBuffer(bytes, {
      lazyEntries: true,
      decodeStrings: true,
      validateEntrySizes: true,
      strictFileNames: true,
    }, (error, archive) => error ? rejectOpen(error) : resolveOpen(archive))
  })
}

function readEntry(archive, entry) {
  return new Promise((resolveEntry, rejectEntry) => {
    archive.openReadStream(entry, (error, stream) => {
      if (error) {
        rejectEntry(error)
        return
      }
      const chunks = []
      let bytes = 0
      stream.on("data", (chunk) => {
        bytes += chunk.length
        if (bytes > maximumEntryBytes) stream.destroy(new Error("VSIX entry exceeded its byte boundary"))
        else chunks.push(chunk)
      })
      stream.once("error", rejectEntry)
      stream.once("end", () => resolveEntry(Buffer.concat(chunks)))
    })
  })
}

async function archiveEntries(bytes) {
  const archive = await openArchive(bytes)
  return new Promise((resolveEntries, rejectEntries) => {
    const entries = new Map()
    let totalBytes = 0
    let settled = false
    const reject = (error) => {
      if (settled) return
      settled = true
      archive.close()
      rejectEntries(error)
    }
    archive.once("error", reject)
    archive.on("entry", async (entry) => {
      try {
        const name = entry.fileName
        const segments = name.split("/")
        if (!name || name.startsWith("/") || name.includes("\\") || segments.includes("..") || name.endsWith("/")) {
          fail(`unsafe or directory archive entry: ${name}`)
        }
        if (entries.has(name)) fail(`duplicate archive entry: ${name}`)
        if (!Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 1 ||
            entry.uncompressedSize > maximumEntryBytes) fail(`archive entry is outside its byte boundary: ${name}`)
        totalBytes += entry.uncompressedSize
        if (totalBytes > maximumTotalBytes) fail("archive expands beyond its aggregate byte boundary")
        const content = await readEntry(archive, entry)
        if (content.length !== entry.uncompressedSize) fail(`archive entry size differs after extraction: ${name}`)
        entries.set(name, content)
        archive.readEntry()
      } catch (error) {
        reject(error)
      }
    })
    archive.once("end", () => {
      if (settled) return
      settled = true
      resolveEntries(entries)
    })
    archive.readEntry()
  })
}

function assertExactEntries(entries) {
  const actual = [...entries.keys()].sort()
  if (JSON.stringify(actual) !== JSON.stringify(expectedEntries)) {
    fail(`archive entries differ; expected ${expectedEntries.join(", ")}, received ${actual.join(", ")}`)
  }
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString("utf8"))
  } catch {
    fail(`${label} must contain valid JSON`)
  }
}

export async function verifyKiroPackage(packagePath = resolve(kiroRoot, "dist/gaep-kiro.vsix")) {
  const archiveBytes = await readBoundedRegularFile(resolve(packagePath), "VSIX")
  const entries = await archiveEntries(archiveBytes)
  assertExactEntries(entries)

  const packagedManifest = parseJson(entries.get("extension/package.json"), "extension/package.json")
  const sourceManifest = parseJson(
    await readBoundedRegularFile(resolve(kiroRoot, "package.json"), "source package.json", 64 * 1024),
    "source package.json",
  )
  try {
    assert.deepEqual(packagedManifest, sourceManifest)
  } catch {
    fail("packaged extension/package.json differs from the source manifest")
  }
  if (packagedManifest.name !== "gaep-kiro" || packagedManifest.publisher !== "gaep" ||
      packagedManifest.version !== "0.1.0" || packagedManifest.main !== "dist/extension.cjs" ||
      packagedManifest.engines?.vscode !== "^1.95.0" ||
      JSON.stringify(packagedManifest.extensionKind) !== JSON.stringify(["workspace"])) {
    fail("package identity, host engine, entry point, or extension kind differs")
  }
  const commands = packagedManifest.contributes?.commands
  if (!Array.isArray(commands) || commands.length !== 58 ||
      new Set(commands.map((command) => command.command)).size !== commands.length ||
      !commands.some((command) => command.command === "gaepKiro.dashboard.phase1Summary") ||
      !commands.some((command) => command.command === "gaepKiro.dashboard.phase1ChangeImpact") ||
      !commands.some((command) => command.command === "gaepKiro.dashboard.phase1AgentModel") ||
      !commands.some((command) => command.command === "gaepKiro.designApplicability.inspect") ||
      !commands.some((command) => command.command === "gaepKiro.designPersonasRoles.inspect") ||
      !commands.some((command) => command.command === "gaepKiro.userJourneys.inspect") ||
      !commands.some((command) => command.command === "gaepKiro.informationArchitecture.inspect") ||
      !commands.some((command) => command.command === "gaepKiro.screenStateInventory.inspect") ||
      !commands.some((command) => command.command === "gaepKiro.designRequirements.inspect") ||
      !commands.some((command) => command.command === "gaepKiro.designSystemTokenContract.inspect") ||
      !commands.some((command) => command.command === "gaepKiro.accessibilityDesignRules.inspect") ||
      !commands.some((command) => command.command === "gaepKiro.responsiveMultiPlatformTargets.inspect") ||
      !commands.some((command) => command.command === "gaepKiro.manualFigmaExecutionPath.inspect") ||
      !commands.some((command) => command.command === "gaepKiro.figmaMcpCapabilityDiscovery.inspect") ||
      !commands.some((command) => command.command === "gaepKiro.figmaReadSnapshot.inspect") ||
      !commands.some((command) => command.command === "gaepKiro.figmaContextImport.inspect") ||
      !commands.some((command) => command.command === "gaepKiro.outboundDesignBriefPackage.inspect") ||
      !commands.some((command) => command.command === "gaepKiro.governedFigmaWrite.inspect") ||
      !commands.some((command) => command.command === "gaepKiro.finalizedFigmaSnapshotImport.inspect")) {
    fail("package command inventory must contain 58 unique commands including all three Phase 1 dashboards and governed Design phase candidates through Finalized Figma Snapshot Import")
  }
  const activationCommands = packagedManifest.activationEvents
    .filter((event) => event.startsWith("onCommand:"))
    .map((event) => event.slice("onCommand:".length))
    .sort()
  if (JSON.stringify(activationCommands) !== JSON.stringify(commands.map((command) => command.command).sort())) {
    fail("command activation events differ from the declared command inventory")
  }
  if (packagedManifest.capabilities?.untrustedWorkspaces?.supported !== "limited") {
    fail("untrusted-workspace capability must remain limited")
  }

  const vsixManifest = entries.get("extension.vsixmanifest").toString("utf8")
  for (const marker of [
    'Id="gaep-kiro" Version="0.1.0" Publisher="gaep"',
    'Id="Microsoft.VisualStudio.Code.Engine" Value="^1.95.0"',
    'Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace"',
    'Id="Microsoft.VisualStudio.Code.ExecutesCode" Value="true"',
    'Path="extension/package.json"',
    'Path="extension/readme.md"',
    'Path="extension/LICENSE.txt"',
  ]) {
    if (!vsixManifest.includes(marker)) fail(`extension.vsixmanifest is missing exact marker: ${marker}`)
  }

  const contentTypes = entries.get("[Content_Types].xml").toString("utf8")
  if (!contentTypes.includes('Extension=".json" ContentType="application/json"') ||
      !contentTypes.includes('Extension=".md" ContentType="text/markdown"') ||
      !contentTypes.includes('Extension=".mjs" ContentType="application/javascript"') ||
      !contentTypes.includes('Extension=".cjs" ContentType="application/octet-stream"')) {
    fail("VSIX content types do not bind JSON and Markdown assets")
  }

  const sourcePairs = [
    ["extension/LICENSE.txt", "LICENSE"],
    ["extension/readme.md", "README.md"],
    ["extension/dist/extension.cjs", "dist/extension.cjs"],
    ["extension/dist/gaep-engine.mjs", "dist/gaep-engine.mjs"],
  ]
  for (const [entryPath, sourcePath] of sourcePairs) {
    const source = await readBoundedRegularFile(resolve(kiroRoot, sourcePath), sourcePath, maximumEntryBytes)
    if (!entries.get(entryPath).equals(source)) fail(`${entryPath} differs from ${sourcePath}`)
  }
  const engineDigest = digest(entries.get("extension/dist/gaep-engine.mjs"))
  if (!entries.get("extension/dist/extension.cjs").includes(Buffer.from(engineDigest))) {
    fail("installed extension bundle does not embed the exact packaged-engine digest")
  }

  return {
    kind: "gaep-kiro-vsix-verification-v1",
    packageId: "gaep.gaep-kiro@0.1.0",
    archiveBytes: archiveBytes.length,
    archiveDigest: digest(archiveBytes),
    entries: expectedEntries.length,
    commands: commands.length,
    engineDigest,
    nativeKiroAcceptance: "not-established",
    claimBoundary: "Exact VSIX structure and built-byte parity are not publisher provenance, signing, native Kiro acceptance, supported-platform certification, Product readiness, or release approval.",
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length > 1) throw new Error("Usage: node test/verify-package.mjs [gaep-kiro.vsix]")
  const result = await verifyKiroPackage(args[0] ? resolve(process.cwd(), args[0]) : undefined)
  process.stdout.write(`PASS exact bounded Kiro VSIX payload and built-byte parity\n${JSON.stringify(result, null, 2)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
