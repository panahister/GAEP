import { stat } from "node:fs/promises"
import { isAbsolute, resolve } from "node:path"

export const protocolVersion = 2
export const maximumFrameBytes = 1024 * 1024
export const maximumOffset = 10_000
export const maximumPageSize = 200
export const defaultPageSize = 100
export const maximumSafeProductRevision = Number.MAX_SAFE_INTEGER

const maximumJsonDepth = 64
const maximumJsonCollectionEntries = 512
const summaryKind = "portable-design-snapshot-summary"
const governanceState = "pending-human-review"
const claimBoundary = "import-validation-is-not-design-approval-or-baseline"
const nonEscalation = "not-gaep-approval-design-baseline-implementation-or-release-readiness"
const summaryPrivacyBoundary = "Validated metadata only; no bundle root, artifact path, token value, source bytes, credentials, OAuth state, or external-account state."
const pageGovernanceBoundary = "Every item remains pending human review; source review is an upstream claim only."
const pagePrivacyBoundary = "Items contain validated metadata and digests only; local paths and source content are omitted."
const actorIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:@+-]*$/u
const toolPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u
const digestPattern = /^sha256:[0-9a-f]{64}$/u
const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/u
const emptyUuid = "00000000-0000-0000-0000-000000000000"
const rfc3339Pattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/u

type JsonRecord = Record<string, unknown>

export type PortableDesignClassification = "public" | "internal" | "confidential" | "restricted"
export type PortableDesignSourceReviewStatus = "unreviewed" | "reviewed" | "approved"
export type PortableDesignExportMethod = "manual-export" | "design-tool-export" | "plugin-export"

export interface PortableDesignGovernanceMetadata {
  readonly state: "pending-human-review"
  readonly humanReviewRequired: true
  readonly claimBoundary: "import-validation-is-not-design-approval-or-baseline"
  readonly nonEscalation: "not-gaep-approval-design-baseline-implementation-or-release-readiness"
}

export interface PortableDesignSourceReviewMetadata {
  readonly status: PortableDesignSourceReviewStatus
  readonly claimLabel: string
  readonly gaepApproval: false
}

export interface PortableDesignSourceMetadata {
  readonly tool: string
  readonly exportMethod: PortableDesignExportMethod
}

export interface PortableDesignCounts {
  readonly artifacts: number
  readonly normalizedDesignTokens: number
  readonly validationChecks: number
  readonly recordedLimitations: number
}

export interface PortableDesignDigests {
  readonly snapshot: string
  readonly evidence: string
  readonly manifest: string
  readonly artifactInventory: string
}

export interface PortableDesignTimestamps {
  readonly sourceExportedAt: string
  readonly importedAt: string
}

export interface PortableDesignSnapshotSummary {
  readonly schemaVersion: 1
  readonly kind: "portable-design-snapshot-summary"
  readonly bundleId: string
  readonly productId: string
  readonly initiativeId?: string
  readonly title: string
  readonly classification: PortableDesignClassification
  readonly governance: PortableDesignGovernanceMetadata
  readonly sourceReview: PortableDesignSourceReviewMetadata
  readonly source: PortableDesignSourceMetadata
  readonly counts: PortableDesignCounts
  readonly digests: PortableDesignDigests
  readonly timestamps: PortableDesignTimestamps
  readonly privacyBoundary: string
}

export interface PortableDesignSnapshotPage {
  readonly items: readonly PortableDesignSnapshotSummary[]
  readonly offset: number
  readonly limit: number
  readonly total: number
  readonly hasMore: boolean
  readonly governanceBoundary: string
  readonly privacyBoundary: string
}

export interface ProductBinding {
  readonly id: string
  readonly name: string
  readonly revision: number
}

export class GaepHostError extends Error {
  override readonly name = "GaepHostError"

  constructor(
    readonly code: number,
    readonly kind: string,
    message: string,
  ) {
    super(message)
  }
}

interface StableHostError {
  readonly code: number
  readonly message: string
}

const stableHostErrors = new Map<string, StableHostError>([
  ["PORTABLE_DESIGN_SOURCE_INVALID", {
    code: -32_030,
    message: "The local portable design bundle did not pass bounded validation.",
  }],
  ["PORTABLE_DESIGN_PRODUCT_CONTEXT_CHANGED", {
    code: -32_031,
    message: "The portable design request no longer matches the exact Product revision.",
  }],
  ["PORTABLE_DESIGN_AUDIT_INVALID", {
    code: -32_032,
    message: "GAEP could not verify the governed audit boundary for this portable design request.",
  }],
  ["PORTABLE_DESIGN_INTEGRITY_INVALID", {
    code: -32_033,
    message: "GAEP could not verify the portable design snapshot inventory and metadata.",
  }],
  ["PORTABLE_DESIGN_CONFLICT", {
    code: -32_034,
    message: "The portable design snapshot identity conflicts with governed inventory.",
  }],
  ["PORTABLE_DESIGN_NOT_FOUND", {
    code: -32_035,
    message: "The requested portable design snapshot does not exist in the current Product.",
  }],
  ["INVALID_PARAMS", {
    code: -32_602,
    message: "The GAEP engine rejected the portable design request parameters.",
  }],
  ["PROTOCOL_UPGRADE_REQUIRED", {
    code: -32_021,
    message: "The GAEP engine requires protocol version 2 for portable design requests.",
  }],
  ["UNSUPPORTED_PROTOCOL_VERSION", {
    code: -32_020,
    message: "The GAEP engine does not support the requested portable design protocol version.",
  }],
  ["FRAME_TOO_LARGE", {
    code: -32_001,
    message: "The GAEP engine rejected a frame that exceeded the protocol boundary.",
  }],
  ["RESPONSE_TOO_LARGE", {
    code: -32_002,
    message: "The GAEP engine response exceeded the protocol boundary.",
  }],
  ["INVALID_UTF8", {
    code: -32_700,
    message: "The GAEP engine response was not valid UTF-8.",
  }],
])

export function invalidHostResponse(): GaepHostError {
  return new GaepHostError(
    -32_603,
    "HOST_RESPONSE_INVALID",
    "The GAEP engine returned a portable design response that could not be verified.",
  )
}

export function hostUnavailable(): GaepHostError {
  return new GaepHostError(
    -32_603,
    "HOST_UNAVAILABLE",
    "The local GAEP engine could not complete the portable design request.",
  )
}

export function responseTooLarge(): GaepHostError {
  return new GaepHostError(
    -32_002,
    "RESPONSE_TOO_LARGE",
    "The GAEP engine response exceeded the configured frame boundary.",
  )
}

export function invalidUtf8(): GaepHostError {
  return new GaepHostError(-32_700, "INVALID_UTF8", "The GAEP engine response was not valid UTF-8.")
}

export function frameTooLarge(): GaepHostError {
  return new GaepHostError(
    -32_001,
    "FRAME_TOO_LARGE",
    "The GAEP engine request exceeded the configured frame boundary.",
  )
}

export function normalizeActorId(actorId: string): string {
  if (actorId.length > 256) throw new TypeError("Actor ID must be a portable human principal")
  const normalized = actorId.trim()
  if (!normalized || normalized.length > 256 || !actorIdPattern.test(normalized)) {
    throw new TypeError("Actor ID must be a portable human principal")
  }
  return normalized
}

export function normalizeUuid(value: string, label: string): string {
  if (!uuidPattern.test(value) || value.toLowerCase() === emptyUuid) {
    throw new TypeError(`${label} must be a non-empty UUID`)
  }
  return value.toLowerCase()
}

export function validateProductRevision(revision: number): number {
  if (!Number.isSafeInteger(revision) || revision < 1 || revision > maximumSafeProductRevision) {
    throw new RangeError("Product revision must be a positive protocol-safe integer")
  }
  return revision
}

export function validatePage(offset: number, limit: number): void {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > maximumOffset) {
    throw new RangeError("Portable design offset must be between 0 and 10000")
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maximumPageSize) {
    throw new RangeError("Portable design limit must be between 1 and 200")
  }
}

export async function normalizeExistingLocalFolder(rawPath: string): Promise<string> {
  if (!rawPath || rawPath.length > 32_768 || rawPath.includes("\0") || !isAbsolute(rawPath) || isNetworkPath(rawPath)) {
    throw new TypeError("Portable design bundle root must be an absolute local folder")
  }
  const normalized = resolve(rawPath)
  let metadata
  try {
    metadata = await stat(normalized)
  } catch {
    throw new TypeError("Portable design bundle root must be an existing local folder")
  }
  if (!metadata.isDirectory()) throw new TypeError("Portable design bundle root must be an existing local folder")
  return normalized
}

export function parseHostResult(raw: string, expectedId: number): unknown {
  const envelope = requireRecord(parseStrictJson(raw))
  if (requireString(envelope, "jsonrpc") !== "2.0" || requireSafeInteger(envelope, "id") !== expectedId) {
    throw invalidHostResponse()
  }
  if (Object.hasOwn(envelope, "error")) {
    requireExactKeys(envelope, ["jsonrpc", "id", "error"])
    throw parseHostError(requireRecord(envelope.error))
  }
  requireExactKeys(envelope, ["jsonrpc", "id", "result"])
  if (!Object.hasOwn(envelope, "result")) throw invalidHostResponse()
  return envelope.result
}

export function parseProductBinding(result: unknown): ProductBinding {
  const product = requireRecord(result)
  const id = normalizeUuid(requireString(product, "id"), "Product ID")
  const name = requireString(product, "name")
  if (!name.trim() || name !== name.trim() || name.length > 240 || containsControl(name)) throw invalidHostResponse()
  const revision = Object.hasOwn(product, "revision") ? requireSafeInteger(product, "revision") : 1
  validateProductRevision(revision)
  return Object.freeze({ id, name, revision })
}

export function parseSnapshotResult(
  result: unknown,
  expected: { readonly bundleId?: string; readonly productId?: string } = {},
): PortableDesignSnapshotSummary {
  const summary = parseSnapshot(requireRecord(result))
  if ((expected.bundleId && summary.bundleId !== normalizeUuid(expected.bundleId, "Bundle ID")) ||
    (expected.productId && summary.productId !== normalizeUuid(expected.productId, "Product ID"))) {
    throw invalidHostResponse()
  }
  return summary
}

export function parsePageResult(result: unknown, expectedOffset: number, expectedLimit: number): PortableDesignSnapshotPage {
  const page = requireRecord(result)
  requireExactKeys(page, ["items", "offset", "limit", "total", "hasMore", "governanceBoundary", "privacyBoundary"])
  if (!Array.isArray(page.items)) throw invalidHostResponse()
  const offset = requireSafeInteger(page, "offset")
  const limit = requireSafeInteger(page, "limit")
  const total = requireSafeInteger(page, "total")
  const hasMore = requireBoolean(page, "hasMore")
  if (offset !== expectedOffset || limit !== expectedLimit || offset < 0 || offset > maximumOffset ||
    limit < 1 || limit > maximumPageSize || total < 0 || page.items.length > limit ||
    page.items.length > maximumPageSize || (page.items.length > 0 && offset + page.items.length > total) ||
    hasMore !== (offset + page.items.length < total) ||
    requireString(page, "governanceBoundary") !== pageGovernanceBoundary ||
    requireString(page, "privacyBoundary") !== pagePrivacyBoundary) {
    throw invalidHostResponse()
  }
  const items = Object.freeze(page.items.map((item) => parseSnapshot(requireRecord(item))))
  if (new Set(items.map((item) => item.bundleId)).size !== items.length) throw invalidHostResponse()
  return Object.freeze({
    items,
    offset,
    limit,
    total,
    hasMore,
    governanceBoundary: pageGovernanceBoundary,
    privacyBoundary: pagePrivacyBoundary,
  })
}

function parseSnapshot(snapshot: JsonRecord): PortableDesignSnapshotSummary {
  requireKeys(
    snapshot,
    [
      "schemaVersion", "kind", "bundleId", "productId", "title", "classification", "governance",
      "sourceReview", "source", "counts", "digests", "timestamps", "privacyBoundary",
    ],
    ["initiativeId"],
  )
  if (requireSafeInteger(snapshot, "schemaVersion") !== 1 || requireString(snapshot, "kind") !== summaryKind) {
    throw invalidHostResponse()
  }
  const bundleId = normalizeUuid(requireString(snapshot, "bundleId"), "Bundle ID")
  const productId = normalizeUuid(requireString(snapshot, "productId"), "Product ID")
  const initiativeId = Object.hasOwn(snapshot, "initiativeId")
    ? normalizeUuid(requireString(snapshot, "initiativeId"), "Initiative ID")
    : undefined
  const title = requireString(snapshot, "title")
  if (title.length < 2 || title.length > 240 || title !== title.trim() || containsControl(title)) {
    throw invalidHostResponse()
  }
  const classification = requireString(snapshot, "classification")
  if (!["public", "internal", "confidential", "restricted"].includes(classification)) throw invalidHostResponse()

  const governance = requireRecord(snapshot.governance)
  requireExactKeys(governance, ["state", "humanReviewRequired", "claimBoundary", "nonEscalation"])
  if (requireString(governance, "state") !== governanceState ||
    requireBoolean(governance, "humanReviewRequired") !== true ||
    requireString(governance, "claimBoundary") !== claimBoundary ||
    requireString(governance, "nonEscalation") !== nonEscalation) {
    throw invalidHostResponse()
  }

  const sourceReview = requireRecord(snapshot.sourceReview)
  requireExactKeys(sourceReview, ["status", "claimLabel", "gaepApproval"])
  const reviewStatus = requireString(sourceReview, "status")
  if (!["unreviewed", "reviewed", "approved"].includes(reviewStatus)) throw invalidHostResponse()
  const expectedClaim = `${reviewStatus} upstream claim; not GAEP approval, a Design Baseline, implementation readiness, or release readiness`
  if (requireString(sourceReview, "claimLabel") !== expectedClaim || requireBoolean(sourceReview, "gaepApproval")) {
    throw invalidHostResponse()
  }

  const source = requireRecord(snapshot.source)
  requireExactKeys(source, ["tool", "exportMethod"])
  const tool = requireString(source, "tool")
  const exportMethod = requireString(source, "exportMethod")
  if (tool.length < 1 || tool.length > 80 || !toolPattern.test(tool) ||
    !["manual-export", "design-tool-export", "plugin-export"].includes(exportMethod)) {
    throw invalidHostResponse()
  }

  const counts = requireRecord(snapshot.counts)
  requireExactKeys(counts, ["artifacts", "normalizedDesignTokens", "validationChecks", "recordedLimitations"])
  const artifactCount = requireSafeInteger(counts, "artifacts")
  const tokenCount = requireSafeInteger(counts, "normalizedDesignTokens")
  const validationChecks = requireSafeInteger(counts, "validationChecks")
  const recordedLimitations = requireSafeInteger(counts, "recordedLimitations")
  if (artifactCount < 1 || artifactCount > 512 || tokenCount < 0 || tokenCount > 5_000 ||
    validationChecks !== 6 || recordedLimitations < 1 || recordedLimitations > 32) {
    throw invalidHostResponse()
  }

  const digests = requireRecord(snapshot.digests)
  requireExactKeys(digests, ["snapshot", "evidence", "manifest", "artifactInventory"])
  const parsedDigests = Object.freeze({
    snapshot: requireDigest(digests, "snapshot"),
    evidence: requireDigest(digests, "evidence"),
    manifest: requireDigest(digests, "manifest"),
    artifactInventory: requireDigest(digests, "artifactInventory"),
  })

  const timestamps = requireRecord(snapshot.timestamps)
  requireExactKeys(timestamps, ["sourceExportedAt", "importedAt"])
  const parsedTimestamps = Object.freeze({
    sourceExportedAt: requireTimestamp(timestamps, "sourceExportedAt"),
    importedAt: requireTimestamp(timestamps, "importedAt"),
  })
  if (requireString(snapshot, "privacyBoundary") !== summaryPrivacyBoundary) throw invalidHostResponse()

  const summary: PortableDesignSnapshotSummary = {
    schemaVersion: 1,
    kind: summaryKind,
    bundleId,
    productId,
    ...(initiativeId ? { initiativeId } : {}),
    title,
    classification: classification as PortableDesignClassification,
    governance: Object.freeze({
      state: governanceState,
      humanReviewRequired: true,
      claimBoundary,
      nonEscalation,
    }),
    sourceReview: Object.freeze({
      status: reviewStatus as PortableDesignSourceReviewStatus,
      claimLabel: expectedClaim,
      gaepApproval: false,
    }),
    source: Object.freeze({ tool, exportMethod: exportMethod as PortableDesignExportMethod }),
    counts: Object.freeze({
      artifacts: artifactCount,
      normalizedDesignTokens: tokenCount,
      validationChecks,
      recordedLimitations,
    }),
    digests: parsedDigests,
    timestamps: parsedTimestamps,
    privacyBoundary: summaryPrivacyBoundary,
  }
  return Object.freeze(summary)
}

function parseHostError(error: JsonRecord): GaepHostError {
  requireExactKeys(error, ["code", "message", "data"])
  const code = requireSafeInteger(error, "code")
  requireString(error, "message")
  const data = requireRecord(error.data)
  requireKeys(data, ["kind"], ["detail"])
  const kind = requireString(data, "kind")
  const stable = stableHostErrors.get(kind)
  if (!stable) return new GaepHostError(-32_603, "HOST_ERROR", "The GAEP engine could not complete the portable design request.")
  if (stable.code !== code) return invalidHostResponse()
  return new GaepHostError(stable.code, kind, stable.message)
}

class StrictJsonParser {
  private offset = 0

  constructor(private readonly raw: string) {}

  parse(): unknown {
    const value = this.parseValue(0)
    this.skipWhitespace()
    if (this.offset !== this.raw.length) throw invalidHostResponse()
    return value
  }

  private parseValue(depth: number): unknown {
    if (depth > maximumJsonDepth) throw invalidHostResponse()
    this.skipWhitespace()
    const token = this.raw[this.offset]
    if (token === "{") return this.parseObject(depth)
    if (token === "[") return this.parseArray(depth)
    if (token === "\"") return this.parseString()
    if (token === "t") return this.parseLiteral("true", true)
    if (token === "f") return this.parseLiteral("false", false)
    if (token === "n") return this.parseLiteral("null", null)
    if (token === "-" || (token !== undefined && token >= "0" && token <= "9")) return this.parseNumber()
    throw invalidHostResponse()
  }

  private parseObject(depth: number): JsonRecord {
    this.offset++
    const value: JsonRecord = Object.create(null) as JsonRecord
    const names = new Set<string>()
    this.skipWhitespace()
    if (this.raw[this.offset] === "}") {
      this.offset++
      return value
    }
    while (true) {
      if (names.size >= maximumJsonCollectionEntries || this.raw[this.offset] !== "\"") throw invalidHostResponse()
      const name = this.parseString()
      if (names.has(name)) throw invalidHostResponse()
      names.add(name)
      this.skipWhitespace()
      if (this.raw[this.offset++] !== ":") throw invalidHostResponse()
      value[name] = this.parseValue(depth + 1)
      this.skipWhitespace()
      const delimiter = this.raw[this.offset++]
      if (delimiter === "}") return value
      if (delimiter !== ",") throw invalidHostResponse()
      this.skipWhitespace()
    }
  }

  private parseArray(depth: number): unknown[] {
    this.offset++
    const value: unknown[] = []
    this.skipWhitespace()
    if (this.raw[this.offset] === "]") {
      this.offset++
      return value
    }
    while (true) {
      if (value.length >= maximumJsonCollectionEntries) throw invalidHostResponse()
      value.push(this.parseValue(depth + 1))
      this.skipWhitespace()
      const delimiter = this.raw[this.offset++]
      if (delimiter === "]") return value
      if (delimiter !== ",") throw invalidHostResponse()
      this.skipWhitespace()
    }
  }

  private parseString(): string {
    const start = this.offset
    this.offset++
    while (this.offset < this.raw.length) {
      const character = this.raw[this.offset++]!
      if (character === "\"") {
        try {
          return JSON.parse(this.raw.slice(start, this.offset)) as string
        } catch {
          throw invalidHostResponse()
        }
      }
      if (character.charCodeAt(0) < 0x20) throw invalidHostResponse()
      if (character !== "\\") continue
      const escape = this.raw[this.offset++]
      if (escape === "u") {
        const digits = this.raw.slice(this.offset, this.offset + 4)
        if (!/^[0-9a-fA-F]{4}$/u.test(digits)) throw invalidHostResponse()
        this.offset += 4
      } else if (!escape || !"\"\\/bfnrt".includes(escape)) {
        throw invalidHostResponse()
      }
    }
    throw invalidHostResponse()
  }

  private parseNumber(): number {
    const start = this.offset
    if (this.raw[this.offset] === "-") this.offset++
    if (this.raw[this.offset] === "0") {
      this.offset++
      if (isDigit(this.raw[this.offset])) throw invalidHostResponse()
    } else {
      if (!isDigitOneToNine(this.raw[this.offset])) throw invalidHostResponse()
      while (isDigit(this.raw[this.offset])) this.offset++
    }
    if (this.raw[this.offset] === ".") {
      this.offset++
      if (!isDigit(this.raw[this.offset])) throw invalidHostResponse()
      while (isDigit(this.raw[this.offset])) this.offset++
    }
    if (this.raw[this.offset] === "e" || this.raw[this.offset] === "E") {
      this.offset++
      if (this.raw[this.offset] === "+" || this.raw[this.offset] === "-") this.offset++
      if (!isDigit(this.raw[this.offset])) throw invalidHostResponse()
      while (isDigit(this.raw[this.offset])) this.offset++
    }
    const value = Number(this.raw.slice(start, this.offset))
    if (!Number.isFinite(value)) throw invalidHostResponse()
    return value
  }

  private parseLiteral<T>(literal: string, value: T): T {
    if (this.raw.slice(this.offset, this.offset + literal.length) !== literal) throw invalidHostResponse()
    this.offset += literal.length
    return value
  }

  private skipWhitespace(): void {
    while ([" ", "\t", "\r", "\n"].includes(this.raw[this.offset] ?? "")) this.offset++
  }
}

function parseStrictJson(raw: string): unknown {
  try {
    return new StrictJsonParser(raw).parse()
  } catch (error) {
    if (error instanceof GaepHostError) throw error
    throw invalidHostResponse()
  }
}

function requireRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidHostResponse()
  return value as JsonRecord
}

function requireString(record: JsonRecord, name: string): string {
  const value = record[name]
  if (typeof value !== "string") throw invalidHostResponse()
  return value
}

function requireBoolean(record: JsonRecord, name: string): boolean {
  const value = record[name]
  if (typeof value !== "boolean") throw invalidHostResponse()
  return value
}

function requireSafeInteger(record: JsonRecord, name: string): number {
  const value = record[name]
  if (!Number.isSafeInteger(value)) throw invalidHostResponse()
  return value as number
}

function requireDigest(record: JsonRecord, name: string): string {
  const value = requireString(record, name)
  if (!digestPattern.test(value)) throw invalidHostResponse()
  return value
}

function requireTimestamp(record: JsonRecord, name: string): string {
  const value = requireString(record, name)
  const match = rfc3339Pattern.exec(value)
  if (!match) throw invalidHostResponse()
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const offsetHour = Number(match[8] ?? 0)
  const offsetMinute = Number(match[9] ?? 0)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59 ||
    offsetHour > 23 || offsetMinute > 59 || !Number.isFinite(Date.parse(value))) {
    throw invalidHostResponse()
  }
  return value
}

function requireExactKeys(record: JsonRecord, expected: readonly string[]): void {
  const keys = Object.keys(record)
  if (keys.length !== expected.length || keys.some((key) => !expected.includes(key))) throw invalidHostResponse()
}

function requireKeys(record: JsonRecord, required: readonly string[], optional: readonly string[]): void {
  const keys = Object.keys(record)
  if (required.some((key) => !Object.hasOwn(record, key)) || keys.some((key) => !required.includes(key) && !optional.includes(key))) {
    throw invalidHostResponse()
  }
}

function isNetworkPath(value: string): boolean {
  return value.startsWith("//") || value.startsWith("\\\\")
}

function containsControl(value: string): boolean {
  return /[\u0000-\u001F\u007F-\u009F]/u.test(value)
}

function isDigit(value: string | undefined): boolean {
  return value !== undefined && value >= "0" && value <= "9"
}

function isDigitOneToNine(value: string | undefined): boolean {
  return value !== undefined && value >= "1" && value <= "9"
}
