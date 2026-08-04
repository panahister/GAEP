import { inflateRawSync } from "node:zlib"
import { posix } from "node:path"

export type ProductChatOfficeFormat = "docx" | "xlsx"

export interface ProductChatOfficeExtraction {
  extraction: "docx-ooxml" | "xlsx-ooxml"
  text: string
  limitations: string[]
}

export class ProductChatOfficeExtractionError extends Error {
  constructor(
    readonly reason: "invalid-office-document" | "office-resource-limit",
    message: string,
  ) {
    super(message)
    this.name = "ProductChatOfficeExtractionError"
  }
}

interface ZipEntry {
  name: string
  flags: number
  compressionMethod: number
  crc32: number
  compressedSize: number
  uncompressedSize: number
  localHeaderOffset: number
}

interface XmlTag {
  name: string
  localName: string
  attributes: Record<string, string>
}

const ZIP_LOCAL_FILE = 0x04034b50
const ZIP_CENTRAL_FILE = 0x02014b50
const ZIP_END = 0x06054b50
const ZIP_MAX_ENTRIES = 512
const ZIP_MAX_ENTRY_BYTES = 2 * 1_024 * 1_024
const ZIP_MAX_TOTAL_BYTES = 8 * 1_024 * 1_024
const EXTRACTED_TEXT_LIMIT = 256 * 1_024
const XLSX_MAX_SHEETS = 64
const XLSX_MAX_CELLS = 50_000

function invalid(message: string): never {
  throw new ProductChatOfficeExtractionError("invalid-office-document", message)
}

function resourceLimit(message: string): never {
  throw new ProductChatOfficeExtractionError("office-resource-limit", message)
}

function readUInt32(buffer: Buffer, offset: number): number {
  if (offset < 0 || offset + 4 > buffer.length) invalid("The OOXML archive is truncated.")
  return buffer.readUInt32LE(offset)
}

function readUInt16(buffer: Buffer, offset: number): number {
  if (offset < 0 || offset + 2 > buffer.length) invalid("The OOXML archive is truncated.")
  return buffer.readUInt16LE(offset)
}

function decodeZipName(bytes: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    invalid("An OOXML archive entry name is not valid UTF-8.")
  }
}

function safeArchivePath(name: string): string {
  if (!name || name.includes("\\") || name.includes("\u0000") || name.startsWith("/") || /^[A-Za-z]:/u.test(name)) {
    invalid("An OOXML archive entry has an unsafe path.")
  }
  const candidate = name.endsWith("/") ? name.slice(0, -1) : name
  const normalized = posix.normalize(candidate)
  if (!candidate || normalized === ".." || normalized.startsWith("../") || normalized !== candidate) {
    invalid("An OOXML archive entry escapes its archive root.")
  }
  return normalized
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const lowerBound = Math.max(0, buffer.length - 65_557)
  for (let offset = buffer.length - 22; offset >= lowerBound; offset -= 1) {
    if (readUInt32(buffer, offset) === ZIP_END) return offset
  }
  return invalid("The selected file is not a supported OOXML ZIP archive.")
}

function readZipEntries(bytes: Uint8Array): { buffer: Buffer; entries: Map<string, ZipEntry> } {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = findEndOfCentralDirectory(buffer)
  const diskNumber = readUInt16(buffer, end + 4)
  const centralDisk = readUInt16(buffer, end + 6)
  const entriesOnDisk = readUInt16(buffer, end + 8)
  const entryCount = readUInt16(buffer, end + 10)
  const centralSize = readUInt32(buffer, end + 12)
  const centralOffset = readUInt32(buffer, end + 16)
  const commentLength = readUInt16(buffer, end + 20)
  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) {
    invalid("Multi-disk OOXML archives are not supported.")
  }
  if (entryCount === 0 || entryCount === 0xffff || centralOffset === 0xffffffff || centralSize === 0xffffffff) {
    invalid("Empty and ZIP64 OOXML archives are not supported.")
  }
  if (entryCount > ZIP_MAX_ENTRIES) resourceLimit("The OOXML archive contains too many entries.")
  if (end + 22 + commentLength !== buffer.length || centralOffset + centralSize > end) {
    invalid("The OOXML central directory is inconsistent.")
  }

  const entries = new Map<string, ZipEntry>()
  let offset = centralOffset
  let totalUncompressed = 0
  for (let index = 0; index < entryCount; index += 1) {
    if (readUInt32(buffer, offset) !== ZIP_CENTRAL_FILE) invalid("The OOXML central directory is malformed.")
    const flags = readUInt16(buffer, offset + 8)
    const compressionMethod = readUInt16(buffer, offset + 10)
    const crc32 = readUInt32(buffer, offset + 16)
    const compressedSize = readUInt32(buffer, offset + 20)
    const uncompressedSize = readUInt32(buffer, offset + 24)
    const nameLength = readUInt16(buffer, offset + 28)
    const extraLength = readUInt16(buffer, offset + 30)
    const entryCommentLength = readUInt16(buffer, offset + 32)
    const diskStart = readUInt16(buffer, offset + 34)
    const localHeaderOffset = readUInt32(buffer, offset + 42)
    const next = offset + 46 + nameLength + extraLength + entryCommentLength
    if (next > centralOffset + centralSize || diskStart !== 0) invalid("The OOXML archive entry is malformed.")
    const name = safeArchivePath(decodeZipName(buffer.subarray(offset + 46, offset + 46 + nameLength)))
    if (entries.has(name)) invalid("The OOXML archive contains duplicate entry names.")
    if ((flags & 0x1) !== 0) invalid("Encrypted OOXML entries are not supported.")
    if (compressionMethod !== 0 && compressionMethod !== 8) invalid("The OOXML archive uses an unsupported compression method.")
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
      invalid("ZIP64 OOXML entries are not supported.")
    }
    if (uncompressedSize > ZIP_MAX_ENTRY_BYTES) resourceLimit("An OOXML archive entry exceeds the extraction limit.")
    totalUncompressed += uncompressedSize
    if (totalUncompressed > ZIP_MAX_TOTAL_BYTES) resourceLimit("The OOXML archive expands beyond the total extraction limit.")
    entries.set(name, { name, flags, compressionMethod, crc32, compressedSize, uncompressedSize, localHeaderOffset })
    offset = next
  }
  if (offset !== centralOffset + centralSize) invalid("The OOXML central directory length is inconsistent.")
  return { buffer, entries }
}

let crcTable: Uint32Array | undefined

function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let value = 0; value < 256; value += 1) {
      let current = value
      for (let bit = 0; bit < 8; bit += 1) current = (current & 1) !== 0 ? 0xedb88320 ^ (current >>> 1) : current >>> 1
      crcTable[value] = current >>> 0
    }
  }
  let current = 0xffffffff
  for (const value of bytes) current = (crcTable[(current ^ value) & 0xff] ?? 0) ^ (current >>> 8)
  return (current ^ 0xffffffff) >>> 0
}

function extractZipEntry(archive: { buffer: Buffer; entries: Map<string, ZipEntry> }, name: string): Uint8Array | undefined {
  const entry = archive.entries.get(name)
  if (!entry) return undefined
  const { buffer } = archive
  const offset = entry.localHeaderOffset
  if (readUInt32(buffer, offset) !== ZIP_LOCAL_FILE) invalid("An OOXML local file header is malformed.")
  const localFlags = readUInt16(buffer, offset + 6)
  const localCompressionMethod = readUInt16(buffer, offset + 8)
  const nameLength = readUInt16(buffer, offset + 26)
  const extraLength = readUInt16(buffer, offset + 28)
  const dataOffset = offset + 30 + nameLength + extraLength
  const dataEnd = dataOffset + entry.compressedSize
  if (dataEnd > buffer.length || localFlags !== entry.flags || localCompressionMethod !== entry.compressionMethod) {
    invalid("An OOXML local file header does not match its central directory entry.")
  }
  const localName = safeArchivePath(decodeZipName(buffer.subarray(offset + 30, offset + 30 + nameLength)))
  if (localName !== entry.name) invalid("An OOXML local entry name does not match its central directory entry.")
  const compressed = buffer.subarray(dataOffset, dataEnd)
  let output: Buffer
  try {
    output = entry.compressionMethod === 0
      ? Buffer.from(compressed)
      : inflateRawSync(compressed, { maxOutputLength: Math.max(1, entry.uncompressedSize) })
  } catch {
    invalid("An OOXML archive entry could not be decompressed within its declared limit.")
  }
  if (output.byteLength !== entry.uncompressedSize || crc32(output) !== entry.crc32) {
    invalid("An OOXML archive entry failed its size or CRC integrity check.")
  }
  return output
}

function decodeXml(bytes: Uint8Array | undefined, requiredName: string): string {
  if (!bytes) invalid(`The OOXML package is missing ${requiredName}.`)
  try {
    const xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    if (/<!DOCTYPE|<!ENTITY/iu.test(xml)) invalid("DOCTYPE and entity declarations are not allowed in OOXML input.")
    return xml
  } catch (error) {
    if (error instanceof ProductChatOfficeExtractionError) throw error
    return invalid(`The OOXML part ${requiredName} is not valid UTF-8 XML.`)
  }
}

function decodeXmlValue(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/giu, (match, entity: string) => {
    if (entity === "amp") return "&"
    if (entity === "lt") return "<"
    if (entity === "gt") return ">"
    if (entity === "quot") return '"'
    if (entity === "apos") return "'"
    const radix = entity.toLowerCase().startsWith("#x") ? 16 : 10
    const numeric = Number.parseInt(entity.slice(radix === 16 ? 2 : 1), radix)
    return Number.isFinite(numeric) && numeric >= 0 && numeric <= 0x10ffff ? String.fromCodePoint(numeric) : match
  })
}

function attributesOf(source: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  const pattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu
  for (const match of source.matchAll(pattern)) attributes[match[1] ?? ""] = decodeXmlValue(match[2] ?? match[3] ?? "")
  return attributes
}

function parseXml(
  xml: string,
  handlers: {
    open?(tag: XmlTag): void
    close?(tag: XmlTag): void
    text?(value: string): void
  },
): void {
  const stack: XmlTag[] = []
  const tokens = xml.match(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<[^>]+>|[^<]+/gu)
  if (!tokens) invalid("An OOXML XML part is empty or malformed.")
  for (const token of tokens) {
    if (token.startsWith("<!--") || token.startsWith("<?")) continue
    if (token.startsWith("<![CDATA[")) {
      handlers.text?.(token.slice(9, -3))
      continue
    }
    if (token.startsWith("</")) {
      const name = token.slice(2, -1).trim()
      const tag = stack.pop()
      if (!tag || tag.name !== name) invalid("An OOXML XML part contains mismatched elements.")
      handlers.close?.(tag)
      continue
    }
    if (token.startsWith("<")) {
      if (token.startsWith("<!")) invalid("Unsupported XML declarations are not allowed in OOXML input.")
      const selfClosing = /\/\s*>$/u.test(token)
      const body = token.slice(1, selfClosing ? token.lastIndexOf("/") : -1).trim()
      const separator = body.search(/\s/u)
      const name = separator === -1 ? body : body.slice(0, separator)
      if (!name) invalid("An OOXML XML part contains an unnamed element.")
      const tag = { name, localName: name.includes(":") ? name.slice(name.lastIndexOf(":") + 1) : name, attributes: attributesOf(separator === -1 ? "" : body.slice(separator + 1)) }
      handlers.open?.(tag)
      if (selfClosing) handlers.close?.(tag)
      else stack.push(tag)
      continue
    }
    handlers.text?.(decodeXmlValue(token))
  }
  if (stack.length > 0) invalid("An OOXML XML part contains unclosed elements.")
}

function boundedText(value: string): string {
  const normalized = value
    .replace(/\r\n?/gu, "\n")
    .replace(/[ \u00a0]+\n/gu, "\n")
    .replace(/\n[ \u00a0]+/gu, "\n")
    .replace(/\t{2,}/gu, "\t")
    .replace(/\n{3,}/gu, "\n\n")
    .trim()
  if (!normalized) invalid("The selected Office document contains no extractable text.")
  if (normalized.length > EXTRACTED_TEXT_LIMIT) resourceLimit("The extracted Office text exceeds the Source Intake limit.")
  return normalized
}

function extractWordPart(xml: string): string {
  const output: string[] = []
  let captureText = 0
  parseXml(xml, {
    open(tag) {
      if (tag.localName === "t") captureText += 1
      else if (tag.localName === "tab") output.push("\t")
      else if (tag.localName === "br" || tag.localName === "cr") output.push("\n")
    },
    close(tag) {
      if (tag.localName === "t") captureText = Math.max(0, captureText - 1)
      else if (tag.localName === "tc") output.push("\t")
      else if (tag.localName === "tr" || tag.localName === "p") output.push("\n")
    },
    text(value) {
      if (captureText > 0) output.push(value)
    },
  })
  return output.join("")
}

function extractDocx(archive: { buffer: Buffer; entries: Map<string, ZipEntry> }): ProductChatOfficeExtraction {
  const contentTypes = decodeXml(extractZipEntry(archive, "[Content_Types].xml"), "[Content_Types].xml")
  if (!contentTypes.includes("wordprocessingml.document.main+xml")) invalid("The selected ZIP package is not a DOCX document.")
  const parts = ["word/document.xml", ...[...archive.entries.keys()]
    .filter((name) => /^word\/(?:header|footer)\d+\.xml$/u.test(name) || /^word\/(?:footnotes|endnotes|comments)\.xml$/u.test(name))
    .sort()]
  const sections: string[] = []
  for (const name of parts) {
    const xml = decodeXml(extractZipEntry(archive, name), name)
    const extracted = extractWordPart(xml).trim()
    if (!extracted) continue
    sections.push(name === "word/document.xml" ? extracted : `[${name}]\n${extracted}`)
  }
  return {
    extraction: "docx-ooxml",
    text: boundedText(sections.join("\n\n")),
    limitations: [
      "DOCX text and table-cell content were extracted; visual layout, images, macros, embedded objects, external links, and change-author metadata were not imported.",
    ],
  }
}

function relationshipTarget(base: string, target: string): string {
  if (!target || target.includes("\\") || target.startsWith("//") || /^[A-Za-z]+:/u.test(target)) invalid("An XLSX relationship target is unsafe.")
  // OOXML permits package-absolute part names such as /xl/worksheets/sheet1.xml.
  // They are package paths, not filesystem paths; strip exactly one leading slash
  // and retain the workbook-root containment check below.
  const candidate = target.startsWith("/") ? target.slice(1) : posix.join(base, target)
  const resolved = posix.normalize(candidate)
  if (!resolved.startsWith("xl/")) invalid("An XLSX relationship escapes the workbook root.")
  return resolved
}

function parseRelationships(xml: string): Map<string, string> {
  const relationships = new Map<string, string>()
  parseXml(xml, {
    open(tag) {
      if (tag.localName !== "Relationship") return
      const id = tag.attributes.Id
      const target = tag.attributes.Target
      const type = tag.attributes.Type ?? ""
      if (id && target && type.endsWith("/worksheet")) relationships.set(id, relationshipTarget("xl", target))
    },
  })
  return relationships
}

function parseWorkbook(xml: string): Array<{ name: string; relationshipId: string; state?: string }> {
  const sheets: Array<{ name: string; relationshipId: string; state?: string }> = []
  parseXml(xml, {
    open(tag) {
      if (tag.localName !== "sheet") return
      const name = tag.attributes.name
      const relationshipId = tag.attributes["r:id"] ?? tag.attributes.id
      if (!name || !relationshipId) invalid("An XLSX workbook sheet is missing its name or relationship.")
      sheets.push({ name, relationshipId, state: tag.attributes.state })
    },
  })
  if (sheets.length === 0) invalid("The XLSX workbook contains no worksheets.")
  if (sheets.length > XLSX_MAX_SHEETS) resourceLimit("The XLSX workbook contains too many worksheets.")
  return sheets
}

function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return []
  const values: string[] = []
  let current: string[] | undefined
  let captureText = 0
  parseXml(xml, {
    open(tag) {
      if (tag.localName === "si") current = []
      else if (tag.localName === "t" && current) captureText += 1
    },
    close(tag) {
      if (tag.localName === "t") captureText = Math.max(0, captureText - 1)
      else if (tag.localName === "si" && current) {
        values.push(current.join(""))
        current = undefined
      }
    },
    text(value) {
      if (current && captureText > 0) current.push(value)
    },
  })
  return values
}

function parseWorksheet(xml: string, sharedStrings: readonly string[]): { lines: string[]; cellCount: number } {
  const lines: string[] = []
  let cellCount = 0
  let currentCell: { reference: string; type?: string; value: string[]; formula: string[]; inline: string[] } | undefined
  let capture: "value" | "formula" | "inline" | undefined
  let rowCells: string[] = []
  const flushRow = (): void => {
    if (rowCells.length > 0) lines.push(rowCells.join(" | "))
    rowCells = []
  }
  parseXml(xml, {
    open(tag) {
      if (tag.localName === "row") flushRow()
      else if (tag.localName === "c") {
        cellCount += 1
        if (cellCount > XLSX_MAX_CELLS) resourceLimit("The XLSX workbook contains too many populated cells.")
        currentCell = { reference: tag.attributes.r ?? `cell-${cellCount}`, type: tag.attributes.t, value: [], formula: [], inline: [] }
      } else if (currentCell && tag.localName === "v") capture = "value"
      else if (currentCell && tag.localName === "f") capture = "formula"
      else if (currentCell && tag.localName === "t") capture = "inline"
    },
    close(tag) {
      if (tag.localName === "v" || tag.localName === "f" || tag.localName === "t") capture = undefined
      else if (tag.localName === "c" && currentCell) {
        const raw = currentCell.value.join("").trim()
        let value = currentCell.inline.join("")
        if (currentCell.type === "s") {
          const index = Number.parseInt(raw, 10)
          value = Number.isInteger(index) && index >= 0 && index < sharedStrings.length ? sharedStrings[index] ?? "" : `[invalid shared string ${raw}]`
        } else if (!value) {
          value = currentCell.type === "b" ? raw === "1" ? "TRUE" : "FALSE"
            : currentCell.type === "e" ? `[error: ${raw}]` : raw
        }
        const formula = currentCell.formula.join("").trim()
        if (formula) value = `=${formula}${value ? ` [cached: ${value}]` : ""}`
        if (value) rowCells.push(`${currentCell.reference} = ${value.replace(/\s+/gu, " ").trim()}`)
        currentCell = undefined
      } else if (tag.localName === "row") flushRow()
    },
    text(value) {
      if (!currentCell || !capture) return
      currentCell[capture].push(value)
    },
  })
  flushRow()
  return { lines, cellCount }
}

function extractXlsx(archive: { buffer: Buffer; entries: Map<string, ZipEntry> }): ProductChatOfficeExtraction {
  const contentTypes = decodeXml(extractZipEntry(archive, "[Content_Types].xml"), "[Content_Types].xml")
  if (!contentTypes.includes("spreadsheetml.sheet.main+xml")) invalid("The selected ZIP package is not an XLSX workbook.")
  const workbook = parseWorkbook(decodeXml(extractZipEntry(archive, "xl/workbook.xml"), "xl/workbook.xml"))
  const relationships = parseRelationships(decodeXml(extractZipEntry(archive, "xl/_rels/workbook.xml.rels"), "xl/_rels/workbook.xml.rels"))
  const sharedEntry = extractZipEntry(archive, "xl/sharedStrings.xml")
  const sharedStrings = parseSharedStrings(sharedEntry ? decodeXml(sharedEntry, "xl/sharedStrings.xml") : undefined)
  const sections: string[] = []
  let totalCells = 0
  for (const sheet of workbook) {
    const target = relationships.get(sheet.relationshipId)
    if (!target) invalid(`The XLSX worksheet relationship ${sheet.relationshipId} is missing.`)
    const parsed = parseWorksheet(decodeXml(extractZipEntry(archive, target), target), sharedStrings)
    totalCells += parsed.cellCount
    if (totalCells > XLSX_MAX_CELLS) resourceLimit("The XLSX workbook contains too many populated cells.")
    const state = sheet.state && sheet.state !== "visible" ? ` (${sheet.state})` : ""
    sections.push(`## Sheet: ${sheet.name}${state}\n${parsed.lines.join("\n") || "[no populated cells]"}`)
  }
  return {
    extraction: "xlsx-ooxml",
    text: boundedText(sections.join("\n\n")),
    limitations: [
      "XLSX cell values and formulas were extracted as text; formulas were not executed, and formatting, charts, macros, external links, and workbook automation were not imported.",
    ],
  }
}

export function extractProductChatOfficeAttachment(
  format: ProductChatOfficeFormat,
  bytes: Uint8Array,
): ProductChatOfficeExtraction {
  const archive = readZipEntries(bytes)
  return format === "docx" ? extractDocx(archive) : extractXlsx(archive)
}
