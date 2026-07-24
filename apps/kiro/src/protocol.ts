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

export type AgentTruthClass = "observed" | "provider-declared" | "configured" | "inferred" | "unknown"

export interface AgentModelReadiness {
  readonly id: string
  readonly label: string
  readonly truthClass: AgentTruthClass
  readonly alias: boolean
}

export type PortableAgentSettingValue = string | number | boolean | readonly string[]

export interface AgentSettingOption {
  readonly value: string
  readonly label: string
  readonly description?: string
}

export interface AgentSelectionSetting {
  readonly key: string
  readonly label: string
  readonly description: string
  readonly kind: "select" | "boolean" | "number" | "string" | "string-list"
  readonly required: boolean
  readonly sensitive: boolean
  readonly defaultValue?: PortableAgentSettingValue
  readonly options?: readonly AgentSettingOption[]
  readonly minimum?: number
  readonly maximum?: number
  readonly truthClass: AgentTruthClass
}

export interface AgentSelection {
  readonly schemaVersion: 2
  readonly adapterId: string
  readonly agentId: string
  readonly modelId: string
  readonly modelTruthClass: AgentTruthClass
  readonly modelAlias: boolean | null
  readonly settings: Readonly<Record<string, PortableAgentSettingValue>>
  readonly selectedAt: string
  readonly capabilityDigest: string
}

export type AgentSelectionState =
  | { readonly status: "unselected" }
  | { readonly status: "selected"; readonly selection: AgentSelection }
  | { readonly status: "migration-required"; readonly portableCandidate: AgentSelection }
  | { readonly status: "invalid" }

export interface AgentReadinessSnapshot {
  readonly schemaVersion: 1
  readonly adapterId: string
  readonly adapterVersion: string
  readonly agentId: string
  readonly agentLabel: string
  readonly runtimeVersion?: string
  readonly detected: boolean
  readonly executionInterface: "cli-jsonl" | "cli-stream-json" | "stdio-rpc" | "managed-in-process" | "unavailable"
  readonly interfaceMaturity: "stable" | "beta" | "experimental" | "unknown"
  readonly supportsResume: boolean
  readonly supportsCancel: boolean
  readonly supportsCheckpoints: boolean
  readonly supportsModelDiscovery: boolean
  readonly supportsToolSelection: boolean
  readonly settingsCount: number
  readonly settings: readonly AgentSelectionSetting[]
  readonly models: readonly AgentModelReadiness[]
  readonly limitations: readonly string[]
  readonly observedAt: string
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
  ["INVALID_CAPABILITY_SNAPSHOT", {
    code: -32_010,
    message: "The GAEP engine could not verify the agent capability snapshot.",
  }],
  ["CAPABILITIES_NOT_AVAILABLE", {
    code: -32_011,
    message: "The GAEP engine could not observe agent capabilities.",
  }],
  ["EXECUTABLE_UNAVAILABLE", {
    code: -32_013,
    message: "The configured agent executable is unavailable.",
  }],
  ["EXECUTABLE_CHANGED", {
    code: -32_014,
    message: "The configured agent executable changed during capability discovery.",
  }],
  ["AGENT_SELECTION_ACTIVE_RUN", {
    code: -32_015,
    message: "Agent selection cannot change while a Run is non-terminal.",
  }],
  ["AGENT_SELECTION_MIGRATION_REQUIRED", {
    code: -32_016,
    message: "The legacy Agent Selection requires explicit re-probe and reconfirmation.",
  }],
  ["AGENT_SELECTION_HANDOFF_REQUIRED", {
    code: -32_017,
    message: "A versioned handoff is required before changing agent, model, or settings after a Run.",
  }],
  ["AGENT_SELECTION_INVALID", {
    code: -32_018,
    message: "The persisted Agent Selection is invalid and cannot be replaced implicitly.",
  }],
  ["CAPABILITIES_CHANGED", {
    code: -32_012,
    message: "Agent capabilities changed during selection; probe again.",
  }],
  ["INVALID_PARAMS", {
    code: -32_602,
    message: "The GAEP engine rejected the local request parameters.",
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
    "The GAEP engine returned a local response that could not be verified.",
  )
}

export function hostUnavailable(): GaepHostError {
  return new GaepHostError(
    -32_603,
    "HOST_UNAVAILABLE",
    "The local GAEP engine could not complete the request.",
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

export function parseAgentReadiness(result: unknown): readonly AgentReadinessSnapshot[] {
  if (!Array.isArray(result) || result.length < 1 || result.length > 16) throw invalidHostResponse()
  const snapshots = result.map((entry) => parseAgentReadinessSnapshot(requireRecord(entry)))
  if (new Set(snapshots.map((snapshot) => snapshot.adapterId)).size !== snapshots.length ||
    new Set(snapshots.map((snapshot) => snapshot.agentId)).size !== snapshots.length) {
    throw invalidHostResponse()
  }
  return Object.freeze(snapshots.sort((left, right) => left.agentLabel.localeCompare(right.agentLabel)))
}

export function parseAgentSelectionState(result: unknown): AgentSelectionState {
  const state = requireRecord(result)
  const status = requireString(state, "status")
  if (status === "unselected" || status === "invalid") {
    requireExactKeys(state, ["status"])
    return Object.freeze({ status })
  }
  if (status === "selected") {
    requireExactKeys(state, ["status", "selection"])
    return Object.freeze({ status, selection: parseAgentSelection(state.selection) })
  }
  if (status === "migration-required") {
    requireExactKeys(state, ["status", "portableCandidate"])
    return Object.freeze({ status, portableCandidate: parseAgentSelection(state.portableCandidate) })
  }
  throw invalidHostResponse()
}

export function parseAgentSelection(result: unknown): AgentSelection {
  const selection = requireRecord(result)
  requireExactKeys(selection, [
    "schemaVersion", "adapterId", "agentId", "modelId", "modelTruthClass", "modelAlias", "settings",
    "selectedAt", "capabilityDigest",
  ])
  if (requireSafeInteger(selection, "schemaVersion") !== 2) throw invalidHostResponse()
  const modelAlias = selection.modelAlias
  if (modelAlias !== null && typeof modelAlias !== "boolean") throw invalidHostResponse()
  const capabilityDigest = requireString(selection, "capabilityDigest")
  if (!/^sha256:[0-9a-f]{64}$/u.test(capabilityDigest)) throw invalidHostResponse()
  return Object.freeze({
    schemaVersion: 2,
    adapterId: requirePortableText(selection, "adapterId", 1),
    agentId: requirePortableText(selection, "agentId", 1),
    modelId: requirePortableText(selection, "modelId", 1),
    modelTruthClass: requireTruthClass(selection, "modelTruthClass"),
    modelAlias,
    settings: parsePortableSelectionSettings(selection.settings),
    selectedAt: requireTimestamp(selection, "selectedAt"),
    capabilityDigest,
  })
}

export function parsePortableSelectionSettings(value: unknown): Readonly<Record<string, PortableAgentSettingValue>> {
  const settings = requireRecord(value)
  const entries = Object.entries(settings)
  if (entries.length > 128) throw invalidHostResponse()
  const parsed: Record<string, PortableAgentSettingValue> = Object.create(null) as Record<string, PortableAgentSettingValue>
  for (const [key, rawValue] of entries) {
    if (!/^[a-z][a-zA-Z0-9]{0,127}$/u.test(key) ||
      /(?:apiKey|accessToken|refreshToken|authToken|bearerToken|password|passwd|clientSecret|privateKey|credential)/iu.test(key) ||
      /^(?:secret|token)$/iu.test(key)) throw invalidHostResponse()
    parsed[key] = parsePortableSettingValue(rawValue)
  }
  return Object.freeze(parsed)
}

function parseAgentReadinessSnapshot(snapshot: JsonRecord): AgentReadinessSnapshot {
  requireExactKeys(snapshot, [
    "schemaVersion", "adapterId", "adapterVersion", "agentId", "agentLabel", "runtimeVersion", "detected",
    "executionInterface", "interfaceMaturity", "supportsResume", "supportsCancel", "supportsCheckpoints",
    "supportsModelDiscovery", "supportsToolSelection", "settings", "models", "limitations", "observedAt",
  ].filter((key) => key !== "runtimeVersion" || Object.hasOwn(snapshot, "runtimeVersion")))
  if (requireSafeInteger(snapshot, "schemaVersion") !== 1) throw invalidHostResponse()
  const adapterId = requirePortableText(snapshot, "adapterId", 1)
  const adapterVersion = requirePortableText(snapshot, "adapterVersion", 1)
  const agentId = requirePortableText(snapshot, "agentId", 1)
  const agentLabel = requirePortableText(snapshot, "agentLabel", 1)
  const runtimeVersion = Object.hasOwn(snapshot, "runtimeVersion")
    ? requirePortableText(snapshot, "runtimeVersion")
    : undefined
  const executionInterface = requireString(snapshot, "executionInterface")
  const interfaceMaturity = requireString(snapshot, "interfaceMaturity")
  if (!(["cli-jsonl", "cli-stream-json", "stdio-rpc", "managed-in-process", "unavailable"] as const)
      .includes(executionInterface as AgentReadinessSnapshot["executionInterface"]) ||
    !(["stable", "beta", "experimental", "unknown"] as const)
      .includes(interfaceMaturity as AgentReadinessSnapshot["interfaceMaturity"])) {
    throw invalidHostResponse()
  }
  if (!Array.isArray(snapshot.settings) || snapshot.settings.length > 256 ||
    !Array.isArray(snapshot.models) || snapshot.models.length > 512 ||
    !Array.isArray(snapshot.limitations) || snapshot.limitations.length > 512) {
    throw invalidHostResponse()
  }
  const settings = Object.freeze(snapshot.settings.map((setting) => parseAgentSetting(setting)))
  const models = Object.freeze(snapshot.models.map((model) => parseAgentModel(requireRecord(model))))
  if (new Set(models.map((model) => model.id)).size !== models.length) throw invalidHostResponse()
  const limitations = Object.freeze(snapshot.limitations.map((limitation) => portableText(limitation)))
  return Object.freeze({
    schemaVersion: 1,
    adapterId,
    adapterVersion,
    agentId,
    agentLabel,
    ...(runtimeVersion !== undefined ? { runtimeVersion } : {}),
    detected: requireBoolean(snapshot, "detected"),
    executionInterface: executionInterface as AgentReadinessSnapshot["executionInterface"],
    interfaceMaturity: interfaceMaturity as AgentReadinessSnapshot["interfaceMaturity"],
    supportsResume: requireBoolean(snapshot, "supportsResume"),
    supportsCancel: requireBoolean(snapshot, "supportsCancel"),
    supportsCheckpoints: requireBoolean(snapshot, "supportsCheckpoints"),
    supportsModelDiscovery: requireBoolean(snapshot, "supportsModelDiscovery"),
    supportsToolSelection: requireBoolean(snapshot, "supportsToolSelection"),
    settingsCount: settings.length,
    settings,
    models,
    limitations,
    observedAt: requireTimestamp(snapshot, "observedAt"),
  })
}

function parseAgentModel(model: JsonRecord): AgentModelReadiness {
  requireKeys(
    model,
    ["id", "label", "reasoningOptions", "inputModalities", "truthClass", "alias"],
    ["description", "contextWindow"],
  )
  const id = requirePortableText(model, "id", 1)
  const label = requirePortableText(model, "label", 1)
  if (Object.hasOwn(model, "description")) requirePortableText(model, "description")
  validatePortableTextArray(model.reasoningOptions, 64)
  validatePortableTextArray(model.inputModalities, 32)
  if (Object.hasOwn(model, "contextWindow")) {
    const contextWindow = requireSafeInteger(model, "contextWindow")
    if (contextWindow < 1) throw invalidHostResponse()
  }
  const truthClass = requireTruthClass(model, "truthClass")
  return Object.freeze({ id, label, truthClass, alias: requireBoolean(model, "alias") })
}

function parseAgentSetting(value: unknown): AgentSelectionSetting {
  const setting = requireRecord(value)
  requireKeys(
    setting,
    ["key", "label", "description", "kind", "required", "sensitive", "truthClass"],
    ["defaultValue", "options", "minimum", "maximum"],
  )
  const key = requireString(setting, "key")
  if (!/^[a-z][a-zA-Z0-9]{0,127}$/u.test(key)) throw invalidHostResponse()
  const label = requirePortableText(setting, "label", 1)
  const description = requirePortableText(setting, "description", 1)
  const kind = requireString(setting, "kind")
  if (!(["select", "boolean", "number", "string", "string-list"] as const)
      .includes(kind as AgentSelectionSetting["kind"])) throw invalidHostResponse()
  const required = requireBoolean(setting, "required")
  const sensitive = requireBoolean(setting, "sensitive")
  const truthClass = requireTruthClass(setting, "truthClass")
  const defaultValue = Object.hasOwn(setting, "defaultValue")
    ? parsePortableSettingValue(setting.defaultValue)
    : undefined
  if (Object.hasOwn(setting, "defaultValue")) {
    if (sensitive) throw invalidHostResponse()
  }
  let options: readonly AgentSettingOption[] | undefined
  if (Object.hasOwn(setting, "options")) {
    if (!Array.isArray(setting.options) || setting.options.length > 256) throw invalidHostResponse()
    options = Object.freeze(setting.options.map((value): AgentSettingOption => {
      const option = requireRecord(value)
      requireKeys(option, ["value", "label"], ["description"])
      const description = Object.hasOwn(option, "description")
        ? requirePortableText(option, "description")
        : undefined
      return Object.freeze({
        value: requirePortableText(option, "value"),
        label: requirePortableText(option, "label"),
        ...(description !== undefined ? { description } : {}),
      })
    }))
  }
  const bounds: { minimum?: number; maximum?: number } = {}
  for (const name of ["minimum", "maximum"]) {
    if (Object.hasOwn(setting, name) && (typeof setting[name] !== "number" || !Number.isFinite(setting[name]))) {
      throw invalidHostResponse()
    }
    if (typeof setting[name] === "number") bounds[name as "minimum" | "maximum"] = setting[name]
  }
  if (bounds.minimum !== undefined && bounds.maximum !== undefined && bounds.minimum > bounds.maximum) {
    throw invalidHostResponse()
  }
  return Object.freeze({
    key,
    label,
    description,
    kind: kind as AgentSelectionSetting["kind"],
    required,
    sensitive,
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    ...(options !== undefined ? { options } : {}),
    ...bounds,
    truthClass,
  })
}

function parsePortableSettingValue(value: unknown): PortableAgentSettingValue {
  if (typeof value === "string") {
    return portableText(value, 0, 10_000)
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw invalidHostResponse()
    return value
  }
  if (typeof value === "boolean") return value
  if (!Array.isArray(value) || value.length > 256) throw invalidHostResponse()
  return Object.freeze(value.map((item) => portableText(item, 0, 10_000)))
}

function validatePortableTextArray(value: unknown, maximumItems: number, maximumText = 20_000): void {
  if (!Array.isArray(value) || value.length > maximumItems) throw invalidHostResponse()
  value.forEach((item) => portableText(item, 0, maximumText))
}

function requirePortableText(record: JsonRecord, name: string, minimum = 0): string {
  return portableText(requireString(record, name), minimum)
}

function requireTruthClass(record: JsonRecord, name: string): AgentTruthClass {
  const value = requireString(record, name)
  if (!(["observed", "provider-declared", "configured", "inferred", "unknown"] as const)
      .includes(value as AgentTruthClass)) throw invalidHostResponse()
  return value as AgentTruthClass
}

function portableText(value: unknown, minimum = 0, maximum = 20_000): string {
  if (typeof value !== "string" || value.length < minimum || value.length > maximum || containsControl(value) ||
    /^(?:\/[^\s]*|[A-Za-z]:[\\/][^\s]*|\\\\[^\s]*|file:\/\/[^\s]*)$/u.test(value.trim()) ||
    /(?:^|[\s(="'])(?:\/(?:Users|home|tmp|private|Volumes)\/[^\s"'<>)]*|[A-Za-z]:\\[^\s"'<>)]*|\\\\[^\s"'<>)]*)/u.test(value) ||
    /\bBearer\s+\S+|\b(?:sk|sk-ant)-[A-Za-z0-9_-]{8,}\b|\b(?:token|secret|password|passwd|api[_-]?key)\s*[:=]\s*\S+/iu.test(value)) {
    throw invalidHostResponse()
  }
  return value
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
  if (!stable) return new GaepHostError(-32_603, "HOST_ERROR", "The GAEP engine could not complete the request.")
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
