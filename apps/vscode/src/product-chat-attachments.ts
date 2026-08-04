import { createHash } from "node:crypto"
import { basename, extname } from "node:path"

import {
  extractProductChatOfficeAttachment,
  ProductChatOfficeExtractionError,
  type ProductChatOfficeFormat,
} from "./product-chat-office-extraction.js"

export interface ProductChatAttachmentResource {
  label: string
  scheme: string
  path: string
  read(): Promise<Uint8Array>
}

export interface ProductChatAttachmentNode extends ProductChatAttachmentResource {
  kind(): Promise<"file" | "directory" | "symbolic-link" | "other">
  children(): Promise<ProductChatAttachmentNode[]>
}

export interface ProductChatAttachmentCandidate {
  label: string
  format: string
  extraction: "utf8-text" | "docx-ooxml" | "xlsx-ooxml"
  byteLength: number
  contentDigest: `sha256:${string}`
  limitations: string[]
  text: string
}

export interface ProductChatAttachmentRejection {
  label: string
  reason: "unsupported-scheme" | "unsupported-format" | "too-large" | "not-utf8" | "unreadable" |
    "symbolic-link" | "selection-limit" | "invalid-office-document" | "office-resource-limit" |
    "ignored-system-metadata"
}

export interface ProductChatAttachmentBatch {
  candidates: ProductChatAttachmentCandidate[]
  rejected: ProductChatAttachmentRejection[]
  totalBytes: number
  totalExtractedCharacters: number
}

export interface ProductChatAttachmentLimits {
  perFileBytes: number
  totalBytes: number
  files: number
  extractedCharacters?: number
}

const supportedTextExtensions = new Set([
  ".md", ".mdx", ".txt", ".json", ".jsonl", ".yaml", ".yml", ".csv", ".tsv", ".xml", ".html",
  ".htm", ".adoc", ".rst", ".toml", ".ini", ".properties", ".sql", ".graphql", ".gql",
])

const supportedOfficeExtensions = new Set([".docx", ".xlsx"])

const ignoredRecursiveDirectoryNames = new Set([
  ".git", ".hg", ".idea", ".svn", ".vscode", "__macosx", "node_modules",
])

const ignoredRecursiveFileNames = new Set([
  ".ds_store", "desktop.ini", "thumbs.db",
])

export const supportedProductChatAttachmentExtensions = [
  ...supportedTextExtensions,
  ...supportedOfficeExtensions,
].map((extension) => extension.slice(1)).sort()

export const defaultProductChatAttachmentLimits = {
  perFileBytes: 256 * 1_024,
  totalBytes: 1024 * 1_024,
  files: 100,
  extractedCharacters: 1024 * 1_024,
}

export const defaultProductChatFolderLimits = {
  depth: 8,
  entries: 2_000,
  files: defaultProductChatAttachmentLimits.files,
}

export function isSupportedProductChatAttachmentPath(path: string): boolean {
  const extension = extname(path).toLowerCase()
  return supportedTextExtensions.has(extension) || supportedOfficeExtensions.has(extension)
}

/**
 * Folder intake is for Product evidence, not editor, VCS, dependency, or OS metadata.
 * An explicitly selected file remains eligible so the human can intentionally inspect it.
 */
export function isIgnoredRecursiveProductChatEntry(path: string, kind: "file" | "directory"): boolean {
  const name = basename(path).toLowerCase()
  return kind === "directory"
    ? ignoredRecursiveDirectoryNames.has(name)
    : ignoredRecursiveFileNames.has(name)
}

export async function discoverProductChatAttachmentResources(
  roots: readonly ProductChatAttachmentNode[],
  limits = defaultProductChatFolderLimits,
): Promise<{ resources: ProductChatAttachmentResource[]; rejected: ProductChatAttachmentRejection[] }> {
  const resources: ProductChatAttachmentResource[] = []
  const rejected: ProductChatAttachmentRejection[] = []
  let visitedEntries = 0
  let selectionLimitReported = false

  const reportSelectionLimit = (label: string): void => {
    if (selectionLimitReported) return
    selectionLimitReported = true
    rejected.push({ label, reason: "selection-limit" })
  }

  const visit = async (node: ProductChatAttachmentNode, depth: number, fromFolder: boolean): Promise<void> => {
    if (visitedEntries >= limits.entries || resources.length >= limits.files) {
      reportSelectionLimit(node.label)
      return
    }
    visitedEntries += 1
    if (node.scheme !== "file") {
      resources.push(node)
      return
    }
    let kind: Awaited<ReturnType<ProductChatAttachmentNode["kind"]>>
    try {
      kind = await node.kind()
    } catch {
      rejected.push({ label: node.label, reason: "unreadable" })
      return
    }
    if (kind === "symbolic-link") {
      rejected.push({ label: node.label, reason: "symbolic-link" })
      return
    }
    if (fromFolder && (kind === "file" || kind === "directory") &&
      isIgnoredRecursiveProductChatEntry(node.path, kind)) {
      rejected.push({ label: node.label, reason: "ignored-system-metadata" })
      return
    }
    if (kind === "directory") {
      if (depth >= limits.depth) {
        rejected.push({ label: node.label, reason: "selection-limit" })
        return
      }
      let children: ProductChatAttachmentNode[]
      try {
        children = (await node.children()).sort((left, right) => left.label.localeCompare(right.label))
      } catch {
        rejected.push({ label: node.label, reason: "unreadable" })
        return
      }
      const remainingEntries = Math.max(0, limits.entries - visitedEntries)
      if (children.length > remainingEntries) reportSelectionLimit(node.label)
      for (const child of children.slice(0, remainingEntries)) {
        if (resources.length >= limits.files) {
          reportSelectionLimit(child.label)
          break
        }
        await visit(child, depth + 1, true)
      }
      return
    }
    if (kind !== "file") {
      rejected.push({ label: node.label, reason: "unreadable" })
      return
    }
    if (fromFolder && !isSupportedProductChatAttachmentPath(node.path)) {
      rejected.push({ label: node.label, reason: "unsupported-format" })
      return
    }
    resources.push(node)
  }

  for (const root of roots) await visit(root, 0, false)
  return { resources, rejected }
}

function digest(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`
}

function decodeUtf8(bytes: Uint8Array): string | undefined {
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    if (decoded.includes("\u0000")) return undefined
    const value = decoded.trim()
    return value || undefined
  } catch {
    return undefined
  }
}

export async function readProductChatAttachments(
  resources: readonly ProductChatAttachmentResource[],
  limits: ProductChatAttachmentLimits = defaultProductChatAttachmentLimits,
): Promise<ProductChatAttachmentBatch> {
  const candidates: ProductChatAttachmentCandidate[] = []
  const rejected: ProductChatAttachmentRejection[] = []
  let totalBytes = 0
  let totalExtractedCharacters = 0
  for (const resource of resources.slice(0, limits.files)) {
    if (resource.scheme !== "file") {
      rejected.push({ label: resource.label, reason: "unsupported-scheme" })
      continue
    }
    const format = extname(resource.path).toLowerCase()
    if (!supportedTextExtensions.has(format) && !supportedOfficeExtensions.has(format)) {
      rejected.push({ label: resource.label, reason: "unsupported-format" })
      continue
    }
    let bytes: Uint8Array
    try {
      bytes = await resource.read()
    } catch {
      rejected.push({ label: resource.label, reason: "unreadable" })
      continue
    }
    if (bytes.byteLength > limits.perFileBytes || totalBytes + bytes.byteLength > limits.totalBytes) {
      rejected.push({ label: resource.label, reason: "too-large" })
      continue
    }
    let text: string
    let extraction: ProductChatAttachmentCandidate["extraction"] = "utf8-text"
    let limitations: string[] = []
    if (supportedOfficeExtensions.has(format)) {
      try {
        const office = extractProductChatOfficeAttachment(format.slice(1) as ProductChatOfficeFormat, bytes)
        text = office.text
        extraction = office.extraction
        limitations = office.limitations
      } catch (error) {
        rejected.push({
          label: resource.label,
          reason: error instanceof ProductChatOfficeExtractionError ? error.reason : "invalid-office-document",
        })
        continue
      }
    } else {
      const decoded = decodeUtf8(bytes)
      if (!decoded) {
        rejected.push({ label: resource.label, reason: "not-utf8" })
        continue
      }
      text = decoded
    }
    if (totalExtractedCharacters + text.length > (limits.extractedCharacters ?? defaultProductChatAttachmentLimits.extractedCharacters)) {
      rejected.push({
        label: resource.label,
        reason: supportedOfficeExtensions.has(format) ? "office-resource-limit" : "too-large",
      })
      continue
    }
    totalBytes += bytes.byteLength
    totalExtractedCharacters += text.length
    candidates.push({
      label: resource.label,
      format: format.slice(1),
      extraction,
      byteLength: bytes.byteLength,
      contentDigest: digest(bytes),
      limitations,
      text,
    })
  }
  return { candidates, rejected, totalBytes, totalExtractedCharacters }
}

export function attachmentAlignmentInput(batch: ProductChatAttachmentBatch): string {
  return batch.candidates.map((candidate, index) => [
    `--- Candidate source ${index + 1}: ${candidate.label} ---`,
    `Format: ${candidate.format}; extraction: ${candidate.extraction}; bytes: ${candidate.byteLength}; digest: ${candidate.contentDigest}`,
    ...candidate.limitations.map((limitation) => `Extraction limitation: ${limitation}`),
    candidate.text,
  ].join("\n")).join("\n\n")
}

export function portableAttachmentMetadata(batch: ProductChatAttachmentBatch): Array<Omit<ProductChatAttachmentCandidate, "text">> {
  return batch.candidates.map(({ text: _text, ...candidate }) => candidate)
}
