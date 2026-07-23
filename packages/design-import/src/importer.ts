import { constants, type Stats } from "node:fs"
import {
  lstat,
  open,
  readdir,
  realpath,
  type FileHandle,
} from "node:fs/promises"
import { relative, resolve, sep } from "node:path"

import { containsSecretShapedValue } from "@gaep/contracts"

import { canonicalDigest, sha256 } from "./digest.js"
import { PortableDesignImportError } from "./errors.js"
import {
  MAX_PORTABLE_DESIGN_ARTIFACTS,
  MAX_PORTABLE_DESIGN_FILE_BYTES,
  MAX_PORTABLE_DESIGN_TOKENS,
  MAX_PORTABLE_DESIGN_TOTAL_BYTES,
  PORTABLE_DESIGN_IMPORT_POLICY,
  portableDesignBundlePathSchema,
  portableDesignImportResultSchema,
  portableDesignManifestSchema,
  type NormalizedDesignToken,
  type PortableDesignArtifact,
  type PortableDesignImportResult,
  type PortableDesignManifest,
} from "./schema.js"
import { parseStrictJson } from "./strict-json.js"
import { normalizeDesignTokens } from "./tokens.js"

const MAX_MANIFEST_BYTES = 1024 * 1024
const MAX_TEXT_ARTIFACT_BYTES = 8 * 1024 * 1024
const MAX_INVENTORY_ENTRIES = 2_048

export interface PortableDesignImportLimits {
  readonly maxArtifacts: number
  readonly maxFileBytes: number
  readonly maxTotalBytes: number
}

export interface PortableDesignImportOptions {
  readonly bundleRoot: string
  readonly manifestPath?: string
  readonly importedAt?: string
  readonly limits?: Partial<PortableDesignImportLimits>
}

interface VerifiedFile {
  readonly bytes: Buffer
  readonly digest: `sha256:${string}`
}

interface ValidatedArtifact {
  readonly artifact: PortableDesignArtifact
  readonly validation: "signature-verified" | "passive-svg-screened" | "tokens-normalized"
  readonly tokens: readonly NormalizedDesignToken[]
}

function ensureLimits(overrides: Partial<PortableDesignImportLimits> | undefined): PortableDesignImportLimits {
  const limits: PortableDesignImportLimits = {
    maxArtifacts: overrides?.maxArtifacts ?? MAX_PORTABLE_DESIGN_ARTIFACTS,
    maxFileBytes: overrides?.maxFileBytes ?? MAX_PORTABLE_DESIGN_FILE_BYTES,
    maxTotalBytes: overrides?.maxTotalBytes ?? MAX_PORTABLE_DESIGN_TOTAL_BYTES,
  }
  for (const [name, value, hardMaximum] of [
    ["maxArtifacts", limits.maxArtifacts, MAX_PORTABLE_DESIGN_ARTIFACTS],
    ["maxFileBytes", limits.maxFileBytes, MAX_PORTABLE_DESIGN_FILE_BYTES],
    ["maxTotalBytes", limits.maxTotalBytes, MAX_PORTABLE_DESIGN_TOTAL_BYTES],
  ] as const) {
    if (!Number.isSafeInteger(value) || value <= 0 || value > hardMaximum) {
      throw new PortableDesignImportError("limit-exceeded", `${name} must be a positive value at or below the hard policy maximum`)
    }
  }
  return limits
}

function isContained(root: string, candidate: string): boolean {
  const local = relative(root, candidate)
  return local === "" || (!local.startsWith(`..${sep}`) && local !== ".." && !local.startsWith(sep))
}

function candidatePath(root: string, portablePath: string): string {
  const candidate = resolve(root, ...portablePath.split("/"))
  if (!isContained(root, candidate)) throw new PortableDesignImportError("unsafe-path", "Bundle entry escapes the canonical bundle root")
  return candidate
}

function sameIdentity(left: Stats, right: Stats): boolean {
  if (left.dev !== 0 && left.ino !== 0 && right.dev !== 0 && right.ino !== 0) {
    return left.dev === right.dev && left.ino === right.ino
  }
  return true
}

async function safeLstat(path: string, portablePath: string): Promise<Stats> {
  try {
    return await lstat(path)
  } catch {
    throw new PortableDesignImportError("unsafe-path", `Required bundle entry is unavailable: ${portablePath}`)
  }
}

async function safeRealpath(path: string, portablePath: string): Promise<string> {
  try {
    return await realpath(path)
  } catch {
    throw new PortableDesignImportError("unsafe-path", `Bundle entry cannot be resolved safely: ${portablePath}`)
  }
}

async function openNoFollow(path: string, portablePath: string): Promise<FileHandle> {
  const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW
  try {
    return await open(path, constants.O_RDONLY | noFollow)
  } catch {
    throw new PortableDesignImportError("unsafe-path", `Bundle entry cannot be opened without following links: ${portablePath}`)
  }
}

async function readVerifiedFile(
  root: string,
  portablePath: string,
  maximumBytes: number,
): Promise<VerifiedFile> {
  const path = candidatePath(root, portablePath)
  const beforePath = await safeLstat(path, portablePath)
  if (beforePath.isSymbolicLink() || !beforePath.isFile()) {
    throw new PortableDesignImportError("unsafe-path", `Bundle entry must be a link-free regular file: ${portablePath}`)
  }
  if (beforePath.size > maximumBytes) {
    throw new PortableDesignImportError("limit-exceeded", `Bundle entry exceeds its byte limit: ${portablePath}`)
  }
  const canonicalPath = await safeRealpath(path, portablePath)
  if (!isContained(root, canonicalPath)) {
    throw new PortableDesignImportError("unsafe-path", `Bundle entry resolves outside the canonical bundle root: ${portablePath}`)
  }

  const handle = await openNoFollow(path, portablePath)
  try {
    const beforeHandle = await handle.stat()
    if (!beforeHandle.isFile() || !sameIdentity(beforePath, beforeHandle)) {
      throw new PortableDesignImportError("file-changed", `Bundle entry identity changed before reading: ${portablePath}`)
    }
    if (beforeHandle.size > maximumBytes) {
      throw new PortableDesignImportError("limit-exceeded", `Bundle entry exceeds its byte limit: ${portablePath}`)
    }
    const bytes = await handle.readFile()
    const afterHandle = await handle.stat()
    if (
      bytes.length !== beforeHandle.size ||
      !sameIdentity(beforeHandle, afterHandle) ||
      beforeHandle.size !== afterHandle.size ||
      beforeHandle.mtimeMs !== afterHandle.mtimeMs ||
      beforeHandle.ctimeMs !== afterHandle.ctimeMs
    ) {
      throw new PortableDesignImportError("file-changed", `Bundle entry changed while it was read: ${portablePath}`)
    }
    const afterPath = await safeLstat(path, portablePath)
    const afterCanonicalPath = await safeRealpath(path, portablePath)
    if (
      afterPath.isSymbolicLink() ||
      !afterPath.isFile() ||
      !sameIdentity(afterHandle, afterPath) ||
      afterCanonicalPath !== canonicalPath
    ) {
      throw new PortableDesignImportError("file-changed", `Bundle entry changed after it was read: ${portablePath}`)
    }
    return { bytes, digest: sha256(bytes) }
  } finally {
    await handle.close()
  }
}

function decodeUtf8(bytes: Buffer, label: string): string {
  let text: string
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    throw new PortableDesignImportError("unsupported-content", `${label} must use valid UTF-8`)
  }
  if (text.startsWith("\uFEFF")) throw new PortableDesignImportError("unsupported-content", `${label} cannot contain a byte-order mark`)
  if (text.includes("\0")) throw new PortableDesignImportError("unsupported-content", `${label} cannot contain NUL characters`)
  return text
}

function parseManifest(bytes: Buffer): PortableDesignManifest {
  const text = decodeUtf8(bytes, "Design import manifest")
  const parsed = parseStrictJson(text, { maxDepth: 12, maxNodes: 20_000, maxStringLength: 2_000 })
  if (containsSecretShapedValue(parsed)) {
    throw new PortableDesignImportError("secret-shaped-content", "Design import manifest contains a secret-shaped value")
  }
  const result = portableDesignManifestSchema.safeParse(parsed)
  if (!result.success) {
    const paths = [...new Set(result.error.issues.map((issue) => issue.path.join(".") || "manifest"))].slice(0, 8)
    throw new PortableDesignImportError("invalid-manifest", `Design import manifest failed strict validation at: ${paths.join(", ")}`)
  }
  return result.data
}

function allowedDirectories(paths: readonly string[]): Set<string> {
  const allowed = new Set<string>()
  for (const path of paths) {
    const segments = path.split("/")
    for (let count = 1; count < segments.length; count += 1) allowed.add(segments.slice(0, count).join("/"))
  }
  return allowed
}

async function verifyExactInventory(root: string, expectedPaths: readonly string[]): Promise<void> {
  const expected = new Set(expectedPaths)
  if (expected.size !== expectedPaths.length) {
    throw new PortableDesignImportError("invalid-manifest", "Manifest and artifact paths must be distinct")
  }
  const allowedDirs = allowedDirectories(expectedPaths)
  const actualFiles = new Set<string>()
  const caseFolded = new Set<string>()
  let entries = 0

  const visit = async (relativeDirectory: string): Promise<void> => {
    const directory = relativeDirectory === "" ? root : candidatePath(root, relativeDirectory)
    const directoryIdentity = await safeLstat(directory, relativeDirectory || ".")
    if (directoryIdentity.isSymbolicLink() || !directoryIdentity.isDirectory()) {
      throw new PortableDesignImportError("unsafe-path", "Bundle directories must be link-free directories")
    }
    const canonicalDirectory = await safeRealpath(directory, relativeDirectory || ".")
    if (!isContained(root, canonicalDirectory)) {
      throw new PortableDesignImportError("unsafe-path", "Bundle directory resolves outside the canonical bundle root")
    }

    let children
    try {
      children = await readdir(directory, { withFileTypes: true })
    } catch {
      throw new PortableDesignImportError("unsafe-path", "Bundle inventory cannot be read safely")
    }
    children.sort((left, right) => left.name.localeCompare(right.name))
    for (const child of children) {
      entries += 1
      if (entries > MAX_INVENTORY_ENTRIES) {
        throw new PortableDesignImportError("limit-exceeded", "Bundle inventory exceeds the entry limit")
      }
      const portablePath = relativeDirectory ? `${relativeDirectory}/${child.name}` : child.name
      if (!portableDesignBundlePathSchema.safeParse(portablePath).success) {
        throw new PortableDesignImportError("unsafe-path", "Bundle contains a non-portable path")
      }
      const folded = portablePath.toLowerCase()
      if (caseFolded.has(folded)) {
        throw new PortableDesignImportError("unsafe-path", "Bundle contains case-insensitively colliding paths")
      }
      caseFolded.add(folded)
      const identity = await safeLstat(candidatePath(root, portablePath), portablePath)
      if (identity.isSymbolicLink()) throw new PortableDesignImportError("unsafe-path", "Bundle cannot contain symbolic links")
      if (identity.isDirectory()) {
        if (!allowedDirs.has(portablePath)) {
          throw new PortableDesignImportError("unexpected-inventory", "Bundle contains an undeclared directory")
        }
        await visit(portablePath)
      } else if (identity.isFile()) {
        if (!expected.has(portablePath)) {
          throw new PortableDesignImportError("unexpected-inventory", "Bundle contains an undeclared file")
        }
        actualFiles.add(portablePath)
      } else {
        throw new PortableDesignImportError("unsafe-path", "Bundle cannot contain special filesystem entries")
      }
    }
  }

  await visit("")
  if (actualFiles.size !== expected.size || expectedPaths.some((path) => !actualFiles.has(path))) {
    throw new PortableDesignImportError("unexpected-inventory", "Bundle inventory does not match the exact manifest inventory")
  }
}

function hasBytes(bytes: Buffer, expected: readonly number[], offset = 0): boolean {
  return expected.every((value, index) => bytes[offset + index] === value)
}

function verifyBinarySignature(format: PortableDesignArtifact["format"], bytes: Buffer): void {
  if (format === "png" && bytes.length >= 8 && hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return
  if (format === "jpeg" && bytes.length >= 5 && hasBytes(bytes, [0xff, 0xd8, 0xff]) && hasBytes(bytes, [0xff, 0xd9], bytes.length - 2)) return
  if (format === "webp" && bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return
  if (format === "pdf" && bytes.length >= 10 && bytes.subarray(0, 5).toString("ascii") === "%PDF-" && bytes.subarray(-2_048).includes(Buffer.from("%%EOF"))) return
  throw new PortableDesignImportError("unsupported-content", `Artifact content does not match the declared ${format} signature`)
}

function verifyPassiveSvg(bytes: Buffer): void {
  const text = decodeUtf8(bytes, "SVG artifact")
  if (containsSecretShapedValue(text)) {
    throw new PortableDesignImportError("secret-shaped-content", "SVG content contains a secret-shaped value")
  }
  const opening = /^(?:\s*<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|>)/iu
  if (!opening.test(text)) throw new PortableDesignImportError("unsupported-content", "SVG artifact does not contain a valid SVG root")
  const activePatterns = [
    /<!DOCTYPE|<!ENTITY/iu,
    /<(?:script|foreignObject|iframe|object|embed)(?:\s|>)/iu,
    /\son[a-z]+\s*=/iu,
    /javascript\s*:/iu,
    /data\s*:\s*text\/html/iu,
    /@import\b/iu,
    /(?:href|xlink:href)\s*=\s*["'](?!#)[^"']+/iu,
    /url\(\s*["']?(?!#)/iu,
  ]
  if (activePatterns.some((pattern) => pattern.test(text))) {
    throw new PortableDesignImportError("unsupported-content", "SVG artifact contains active or external content")
  }
}

async function validateArtifact(
  root: string,
  artifact: PortableDesignArtifact,
  maximumBytes: number,
): Promise<ValidatedArtifact> {
  if (artifact.sizeBytes > maximumBytes) {
    throw new PortableDesignImportError("limit-exceeded", "Artifact exceeds the configured file-size limit")
  }
  const textLimit = artifact.format === "svg" || artifact.format === "design-tokens-json"
    ? Math.min(maximumBytes, MAX_TEXT_ARTIFACT_BYTES)
    : maximumBytes
  const file = await readVerifiedFile(root, artifact.path, textLimit)
  if (file.bytes.length !== artifact.sizeBytes) {
    throw new PortableDesignImportError("file-changed", `Artifact size does not match the manifest: ${artifact.path}`)
  }
  if (file.digest !== artifact.digest) {
    throw new PortableDesignImportError("digest-mismatch", `Artifact digest does not match the manifest: ${artifact.path}`)
  }

  if (artifact.format === "design-tokens-json") {
    const text = decodeUtf8(file.bytes, "Design token artifact")
    const json = parseStrictJson(text, { maxDepth: 24, maxNodes: 100_000, maxStringLength: 50_000 })
    return { artifact, validation: "tokens-normalized", tokens: normalizeDesignTokens(artifact.id, json) }
  }
  if (artifact.format === "svg") {
    verifyPassiveSvg(file.bytes)
    return { artifact, validation: "passive-svg-screened", tokens: [] }
  }
  verifyBinarySignature(artifact.format, file.bytes)
  return { artifact, validation: "signature-verified", tokens: [] }
}

function resolveImportedAt(value: string | undefined): string {
  const importedAt = value ?? new Date().toISOString()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(importedAt) || Number.isNaN(Date.parse(importedAt))) {
    throw new PortableDesignImportError("invalid-manifest", "Import evidence time must be a UTC ISO-8601 timestamp")
  }
  return importedAt
}

export async function importPortableDesignBundle(
  options: PortableDesignImportOptions,
): Promise<PortableDesignImportResult> {
  const limits = ensureLimits(options.limits)
  const manifestPath = options.manifestPath ?? "gaep-design-import.json"
  if (!portableDesignBundlePathSchema.safeParse(manifestPath).success || !manifestPath.toLowerCase().endsWith(".json")) {
    throw new PortableDesignImportError("unsafe-path", "Manifest path must be a portable relative JSON path")
  }

  const rootIdentity = await safeLstat(options.bundleRoot, ".")
  if (rootIdentity.isSymbolicLink() || !rootIdentity.isDirectory()) {
    throw new PortableDesignImportError("unsafe-path", "Bundle root must be a link-free directory")
  }
  const root = await safeRealpath(options.bundleRoot, ".")
  const canonicalRootIdentity = await safeLstat(root, ".")
  if (!sameIdentity(rootIdentity, canonicalRootIdentity)) {
    throw new PortableDesignImportError("file-changed", "Bundle root identity changed before import")
  }
  const firstManifestFile = await readVerifiedFile(root, manifestPath, MAX_MANIFEST_BYTES)
  const manifest = parseManifest(firstManifestFile.bytes)
  const importedAt = resolveImportedAt(options.importedAt)
  if (Date.parse(importedAt) < Date.parse(manifest.source.exportedAt)) {
    throw new PortableDesignImportError("invalid-manifest", "Import evidence time cannot predate the source export")
  }
  if (manifest.artifacts.length > limits.maxArtifacts) {
    throw new PortableDesignImportError("limit-exceeded", "Artifact count exceeds the configured import limit")
  }
  const declaredBytes = manifest.artifacts.reduce((total, artifact) => total + artifact.sizeBytes, 0)
  if (declaredBytes > limits.maxTotalBytes) {
    throw new PortableDesignImportError("limit-exceeded", "Bundle size exceeds the configured import limit")
  }

  const expectedPaths = [manifestPath, ...manifest.artifacts.map((artifact) => artifact.path)]
  await verifyExactInventory(root, expectedPaths)

  const validated: ValidatedArtifact[] = []
  for (const artifact of [...manifest.artifacts].sort((left, right) => left.path.localeCompare(right.path))) {
    validated.push(await validateArtifact(root, artifact, limits.maxFileBytes))
  }

  await verifyExactInventory(root, expectedPaths)
  const finalManifestFile = await readVerifiedFile(root, manifestPath, MAX_MANIFEST_BYTES)
  if (finalManifestFile.digest !== firstManifestFile.digest) {
    throw new PortableDesignImportError("file-changed", "Design import manifest changed during import")
  }
  const finalRootIdentity = await safeLstat(root, ".")
  if (!finalRootIdentity.isDirectory() || !sameIdentity(canonicalRootIdentity, finalRootIdentity)) {
    throw new PortableDesignImportError("file-changed", "Bundle root identity changed during import")
  }

  const artifacts = validated.map(({ artifact, validation }) => ({
    ...artifact,
    targets: [...artifact.targets].sort((left, right) =>
      `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`),
    ),
    validation,
  }))
  const tokens = validated.flatMap((item) => item.tokens).sort((left, right) =>
    `${left.artifactId}:${left.path}`.localeCompare(`${right.artifactId}:${right.path}`),
  )
  if (tokens.length > MAX_PORTABLE_DESIGN_TOKENS) {
    throw new PortableDesignImportError("limit-exceeded", "Combined design token count exceeds the import limit")
  }
  const artifactInventoryDigest = canonicalDigest(artifacts.map((artifact) => ({
    id: artifact.id,
    path: artifact.path,
    kind: artifact.kind,
    format: artifact.format,
    mediaType: artifact.mediaType,
    sizeBytes: artifact.sizeBytes,
    digest: artifact.digest,
    title: artifact.title,
    targets: artifact.targets,
    validation: artifact.validation,
  })))
  const snapshotBody = {
    schemaVersion: 1 as const,
    kind: "portable-design-snapshot" as const,
    bundleId: manifest.id,
    productId: manifest.productId,
    initiativeId: manifest.initiativeId,
    title: manifest.title,
    classification: manifest.classification,
    owner: manifest.owner,
    source: manifest.source,
    sourceReview: manifest.sourceReview,
    governance: {
      state: "pending-human-review" as const,
      claimBoundary: "import-validation-is-not-design-approval-or-baseline" as const,
    },
    artifacts,
    tokens,
  }
  const snapshotDigest = canonicalDigest(snapshotBody)
  const evidenceBody = {
    policy: PORTABLE_DESIGN_IMPORT_POLICY,
    importedAt,
    manifestDigest: firstManifestFile.digest,
    artifactInventoryDigest,
    checks: [
      "manifest-strict-schema",
      "bundle-exact-inventory",
      "paths-contained-and-link-free",
      "sizes-and-digests-exact",
      "text-secret-scan-clear",
      "formats-passively-validated",
    ] as const,
    limitations: [
      "Source ownership, review, and approval claims are preserved but not independently verified.",
      "Binary assets are signature-checked and digest-bound; they are not decoded or rendered by this importer.",
      "SVG is accepted only as passive, link-free content and is not rendered by this importer.",
      "Design-token values are normalized structurally; token semantics and references are not resolved by this importer.",
      "A successful import remains pending human review and does not establish a Design Baseline.",
    ],
  }
  const result = portableDesignImportResultSchema.safeParse({
    ...snapshotBody,
    snapshotDigest,
    evidence: { ...evidenceBody, evidenceDigest: canonicalDigest({ snapshotDigest, ...evidenceBody }) },
  })
  if (!result.success) {
    throw new PortableDesignImportError("invalid-manifest", "Imported design snapshot failed the portable output contract")
  }
  return result.data
}
