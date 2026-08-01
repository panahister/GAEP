import { createHash } from "node:crypto"
import { createRequire } from "node:module"
import { lstat, readdir } from "node:fs/promises"
import { join, relative, sep } from "node:path"

import { readRepositoryRegularFile } from "../../../../scripts/lib/repository-files.mjs"

const require = createRequire(import.meta.url)
const { readZip } = require("@vscode/vsce/out/zip.js")

const maximumContentFiles = 512
const maximumContentBytes = 32 * 1024 * 1024

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function normalizePackageJson(bytes, installed) {
  if (bytes.byteLength < 1 || bytes.byteLength > 1024 * 1024) {
    throw new Error("VSIX package.json is outside the supported bound")
  }
  const value = JSON.parse(bytes.toString("utf8"))
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("VSIX package.json must contain an object")
  }
  if (installed) {
    const metadata = value.__metadata
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata) ||
        JSON.stringify(Object.keys(metadata).sort()) !== JSON.stringify(["installedTimestamp", "size", "targetPlatform"])) {
      throw new Error("Installed package.json has unsupported installer metadata")
    }
    if (!Number.isSafeInteger(metadata.installedTimestamp) || metadata.installedTimestamp < 1 ||
        !Number.isSafeInteger(metadata.size) || metadata.size < 1 || metadata.size > maximumContentBytes ||
        typeof metadata.targetPlatform !== "string" || !/^[a-z0-9_-]{1,64}$/u.test(metadata.targetPlatform)) {
      throw new Error("Installed package.json installer metadata is outside the supported bound")
    }
    delete value.__metadata
  } else if (Object.hasOwn(value, "__metadata")) {
    throw new Error("Source VSIX package.json must not contain installer metadata")
  }
  return Buffer.from(JSON.stringify(value))
}

function normalizedEntry(path, bytes, { installed = false } = {}) {
  if (!path || path.includes("\\") || path.startsWith("/") || path.split("/").includes("..")) {
    throw new Error(`VSIX content path is unsafe: ${JSON.stringify(path)}`)
  }
  if (path.toLowerCase() === "package.json") bytes = normalizePackageJson(bytes, installed)
  return { path: path.toLowerCase(), bytes: bytes.byteLength, sha256: digest(bytes) }
}

function manifest(entries) {
  const sorted = [...entries].sort((left, right) => left.path.localeCompare(right.path))
  if (sorted.length < 1 || sorted.length > maximumContentFiles) {
    throw new Error("VSIX content file count is outside the supported bound")
  }
  if (new Set(sorted.map((entry) => entry.path)).size !== sorted.length) {
    throw new Error("VSIX content contains duplicate case-insensitive paths")
  }
  const totalBytes = sorted.reduce((sum, entry) => sum + entry.bytes, 0)
  if (totalBytes < 1 || totalBytes > maximumContentBytes) {
    throw new Error("VSIX content bytes are outside the supported bound")
  }
  return {
    entries: sorted,
    contentFiles: sorted.length,
    contentBytes: totalBytes,
    contentManifestSha256: digest(Buffer.from(JSON.stringify(sorted))),
  }
}

export async function readVsixContentManifest(packagePath) {
  const archiveEntries = await readZip(
    packagePath,
    (name) => (name.startsWith("extension/") && !name.endsWith("/")) || name === "extension.vsixmanifest",
  )
  return manifest([...archiveEntries.entries()].map(([name, bytes]) => name === "extension.vsixmanifest"
    ? normalizedEntry(".vsixmanifest", bytes)
    : normalizedEntry(name.slice("extension/".length), bytes)))
}

async function extensionDirectory(extensionsRoot, packageId, version) {
  const prefix = `${packageId}-${version}`.toLowerCase()
  const matches = (await readdir(extensionsRoot, { withFileTypes: true }))
    .filter((entry) => entry.name.toLowerCase().startsWith(prefix))
  if (matches.length !== 1 || !matches[0].isDirectory() || matches[0].isSymbolicLink()) {
    throw new Error(`Expected one regular installed directory for ${packageId}@${version}`)
  }
  const path = join(extensionsRoot, matches[0].name)
  const metadata = await lstat(path)
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error(`Installed directory for ${packageId}@${version} is unsafe`)
  }
  return path
}

export async function readInstalledContentManifest(extensionsRoot, packageId, version) {
  const root = await extensionDirectory(extensionsRoot, packageId, version)
  const files = []
  const directories = [root]
  while (directories.length > 0) {
    const directory = directories.pop()
    const entries = (await readdir(directory, { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      if (entry.isSymbolicLink()) throw new Error("Installed extension content must not contain symbolic links")
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        directories.push(path)
        continue
      }
      if (!entry.isFile()) throw new Error("Installed extension content must contain only regular files")
      const relativePath = relative(root, path).split(sep).join("/")
      const artifact = await readRepositoryRegularFile(root, relativePath, {
        minimumBytes: 1,
        maximumBytes: maximumContentBytes,
      })
      files.push(normalizedEntry(relativePath, artifact.bytes, { installed: true }))
      if (files.length > maximumContentFiles) throw new Error("Installed extension content file count exceeded")
    }
  }
  const installed = manifest(files)
  const packageJson = await readRepositoryRegularFile(root, "package.json", { maximumBytes: 1024 * 1024 })
  const parsed = JSON.parse(packageJson.bytes.toString("utf8"))
  const [publisher, name] = packageId.split(".", 2)
  if (parsed.publisher !== publisher || parsed.name !== name || parsed.version !== version) {
    throw new Error("Installed extension manifest identity differs")
  }
  return installed
}

export function assertContentManifestsEqual(expected, actual, label = "Installed VSIX content") {
  if (JSON.stringify(actual.entries) !== JSON.stringify(expected.entries) ||
      actual.contentManifestSha256 !== expected.contentManifestSha256) {
    const expectedByPath = new Map(expected.entries.map((entry) => [entry.path, entry]))
    const actualByPath = new Map(actual.entries.map((entry) => [entry.path, entry]))
    const paths = [...new Set([...expectedByPath.keys(), ...actualByPath.keys()])].sort()
    const differences = paths.flatMap((path) => {
      const archived = expectedByPath.get(path)
      const installed = actualByPath.get(path)
      if (!archived) return [`unexpected:${path}`]
      if (!installed) return [`missing:${path}`]
      if (archived.bytes !== installed.bytes || archived.sha256 !== installed.sha256) {
        return [`changed:${path}:${archived.bytes}->${installed.bytes}`]
      }
      return []
    })
    const bounded = differences.slice(0, 8).join(",")
    throw new Error(`${label} differs from the source VSIX content manifest (${bounded || "digest-only"})`)
  }
}

export async function assertInstalledVsixContent({
  extensionsRoot,
  packageId,
  version,
  expected,
}) {
  const installed = await readInstalledContentManifest(extensionsRoot, packageId, version)
  assertContentManifestsEqual(expected, installed)
  return installed
}
