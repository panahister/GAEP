import { createHash, randomUUID } from "node:crypto"
import { constants, lstatSync, realpathSync, type BigIntStats, type Dirent } from "node:fs"
import { lstat, mkdir, open, opendir, realpath, rename, rm, rmdir, unlink, type FileHandle } from "node:fs/promises"
import { tmpdir, userInfo } from "node:os"
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path"

import type { ManagedTerminalDisposition } from "./managed-runtime.js"
import {
  assertAuthenticWorkspaceStage,
  WorkspaceProcessDeathSimulationError,
  WorkspaceStagingService,
  type WorkspaceStage,
  type WorkspaceStageInspection,
  type WorkspaceStageManifest,
  type WorkspaceStageManifestFile,
} from "./workspace-staging.js"

export type ManagedStageRegistryState =
  | "staging"
  | "review-required"
  | "applying"
  | "journal-retained"
  | "recovering"
  | "quarantined"
  | "discarding"
  | "disposing"

interface FileIdentity {
  device: string
  inode: string
}

interface ManagedStageRegistryRecord {
  schemaVersion: 2
  generation: number
  managedRunId: string
  stageId: string
  stageTempRoot: string
  stageIdentity: FileIdentity
  stageWorkspaceIdentity: FileIdentity
  sourceWorkspacePath: string
  sourceWorkspaceIdentity: FileIdentity
  state: ManagedStageRegistryState
  journalPath?: string
  journalId?: string
  journalDigest?: `sha256:${string}`
  journalSemanticDigest?: `sha256:${string}`
  journalRootIdentity?: FileIdentity
  journalFileIdentity?: FileIdentity
  quarantinePath?: string
  reviewManifestPath?: string
  reviewManifestDigest?: `sha256:${string}`
  reviewManifestFileIdentity?: FileIdentity
  ownerLease?: {
    pid: number
    token: string
    acquiredAt: string
  }
  recoveryOperation?: {
    id: string
    fromState: Exclude<ManagedStageRegistryState, "recovering" | "quarantined" | "discarding" | "disposing">
    startedAt: string
  }
  disposalOperation?: {
    tombstonePath: string
    startedAt: string
  }
  discardOperation?: {
    startedAt: string
    localCleanupComplete: boolean
  }
  updatedAt: string
}

interface SafeFileSnapshot {
  bytes: Buffer
  identity: FileIdentity
}

interface RegistryRecordSnapshot {
  record: ManagedStageRegistryRecord
  fileIdentity: FileIdentity
}

export interface ManagedStageRecoveryResult {
  status: "absent" | "cleaned" | "quarantined" | "review-restored"
  quarantinePath?: string
  journalDigest?: `sha256:${string}`
}

export interface ManagedStageReviewManifest {
  readonly schemaVersion: 1
  readonly kind: "gaep-managed-stage-review-manifest-v1"
  readonly managedRunId: string
  readonly bindingsDigest: `sha256:${string}`
  readonly provider: {
    readonly adapterId: string
    readonly agentId: string
    readonly modelId: string
    readonly capabilityDigest: `sha256:${string}`
  }
  readonly stage: WorkspaceStageManifest
  readonly inspection: WorkspaceStageInspection
  readonly terminalDisposition: ManagedTerminalDisposition
}

export interface ManagedStageReviewClaim {
  readonly leaseToken: string
  readonly manifest: ManagedStageReviewManifest
  readonly stageTempRootIdentity: FileIdentity
  readonly stageRootIdentity: FileIdentity
}

const authenticManagedStageReviewClaims = new WeakSet<object>()

/** @internal Verifies that a review claim was minted by the registry in this process. */
export function assertAuthenticManagedStageReviewClaim(claim: ManagedStageReviewClaim): void {
  if (!authenticManagedStageReviewClaims.has(claim)) {
    throw new Error("Managed stage review claim was not minted by the registry")
  }
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  return Object.freeze(value)
}

export type ManagedStageRecoveryReason =
  | "journal-missing"
  | "quarantine-missing"
  | "quarantine-conflict"
  | "stage-active"
  | "lock-timeout"
  | "quarantine-limit"
  | "source-residue-conflict"

export class ManagedStageRecoveryError extends Error {
  constructor(
    readonly reasonCode: ManagedStageRecoveryReason,
    message: string,
  ) {
    super(message)
    this.name = "ManagedStageRecoveryError"
  }
}

const runIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const digestPattern = /^sha256:[0-9a-f]{64}$/
const stageDirectoryPattern = /^gaep-stage-[a-z0-9_-]{1,128}$/i
const journalDirectoryPattern = /^gaep-apply-journal-[a-z0-9_-]{1,128}$/i
const maximumRecordBytes = 64 * 1024
const maximumReviewManifestBytes = 16 * 1024 * 1024
const maximumJournalBytes = 32 * 1024 * 1024
const maximumQuarantineEntries = 64
const maximumWorkspaceEntries = 50_000
const maximumWorkspaceDirectories = 10_000
const maximumApplyEntries = 128
const maximumApplyDirectoryIntents = 256
// Must match WorkspaceStagingService's exact legal worst-case WAL rewrite count.
const maximumApplyJournalWrites = 1_028
const maximumWorkspaceFileBytes = 16 * 1024 * 1024
const maximumWorkspaceBytes = 512 * 1024 * 1024
const maximumPathMetadataBytes = 1 * 1024 * 1024
const maximumStageTreeEntries = maximumWorkspaceEntries + 1
const maximumQuarantineTreeEntries = maximumWorkspaceEntries + 4
const maximumQuarantineBytes = maximumWorkspaceBytes + (2 * maximumJournalBytes)
const durableJournalTemporaryPattern = /^\.gaep-durable-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
const defaultLockWaitMs = 15_000
const defaultStaleLockMs = 5_000

export interface ManagedStageRegistryOptions {
  lockWaitMs?: number
  staleLockMs?: number
  isProcessAlive?: (pid: number) => boolean
  /** @internal Allows the platform boundary to be exercised without mutating process globals. */
  hostPlatform?: "posix" | "windows"
  /** @internal Deterministic crash/fault injection for quarantine disposal tests. */
  beforeDisposalStep?: (
    step: "after-disposal-record" | "after-disposal-rename" | "after-disposal-remove",
  ) => void | Promise<void>
  /** @internal Fault injection immediately after a journal directory is durably moved to quarantine. */
  afterQuarantineMove?: () => void | Promise<void>
  /** @internal Process-death injection after a final run-lock inode is created but before its record is complete. */
  afterRunLockCreate?: () => void | Promise<void>
  /** @internal Fault injection after a registry record rename but before durable completion is reported. */
  afterRecordRename?: (record: { managedRunId: string; generation: number; state: ManagedStageRegistryState }) => void | Promise<void>
  /** @internal Fault injection after a review-manifest rename but before durable completion is reported. */
  afterManifestRename?: (managedRunId: string) => void | Promise<void>
}

interface PosixHostSecurity {
  kind: "posix"
  ownerUid: bigint
  directoryOpenFlag: number
  noFollowOpenFlag: number
}

interface WindowsHostSecurity {
  kind: "windows"
  trustedTempRoot: string
  trustedTempRootIdentity: FileIdentity
}

type ManagedStageHostSecurity = PosixHostSecurity | WindowsHostSecurity

interface RunLockRecord {
  schemaVersion: 1
  managedRunId: string
  token: string
  pid: number
  acquiredAt: string
}

function contained(root: string, candidate: string): boolean {
  const relation = relative(root, candidate)
  return relation !== "" && relation !== ".." && !relation.startsWith(`..${sep}`) && !isAbsolute(relation)
}

function identityOf(metadata: BigIntStats): FileIdentity {
  return { device: metadata.dev.toString(), inode: metadata.ino.toString() }
}

function sameIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return left.device === right.device && left.inode === right.inode
}

function parseIdentity(value: unknown): FileIdentity | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const identity = value as Record<string, unknown>
  if (Object.keys(identity).length !== 2 || typeof identity.device !== "string" || typeof identity.inode !== "string" ||
      !/^\d+$/.test(identity.device) || !/^\d+$/.test(identity.inode)) return undefined
  return { device: identity.device, inode: identity.inode }
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const expected = new Set(allowed)
  return Object.keys(value).length === expected.size && Object.keys(value).every((key) => expected.has(key))
}

function boundedString(value: unknown, maximumBytes: number): value is string {
  return typeof value === "string" && value.length > 0 && Buffer.byteLength(value) <= maximumBytes
}

function parseStageManifest(value: unknown): WorkspaceStageManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Managed stage review manifest is malformed")
  const manifest = value as Record<string, unknown>
  if (!exactKeys(manifest, ["schemaVersion", "kind", "stage", "baseline"]) || manifest.schemaVersion !== 1 ||
      manifest.kind !== "gaep-workspace-stage-manifest-v1" || !manifest.stage || typeof manifest.stage !== "object" ||
      Array.isArray(manifest.stage) || !manifest.baseline || typeof manifest.baseline !== "object" || Array.isArray(manifest.baseline)) {
    throw new Error("Managed stage review manifest is malformed")
  }
  const stage = manifest.stage as Record<string, unknown>
  const baseline = manifest.baseline as Record<string, unknown>
  const sourceIdentity = parseIdentity(stage.sourceIdentity)
  if (!exactKeys(stage, ["id", "sourceRoot", "sourceIdentity", "root", "baselineDigest", "excludedPaths"]) ||
      !sourceIdentity ||
      !runIdPattern.test(String(stage.id)) || !boundedString(stage.sourceRoot, 16 * 1024) ||
      !boundedString(stage.root, 16 * 1024) || typeof stage.baselineDigest !== "string" ||
      !digestPattern.test(stage.baselineDigest) || !Array.isArray(stage.excludedPaths) ||
      stage.excludedPaths.length > 20_000 || stage.excludedPaths.some((path) => !boundedString(path, 4_096)) ||
      !exactKeys(baseline, ["digest", "totalBytes", "files"]) || typeof baseline.digest !== "string" ||
      !digestPattern.test(baseline.digest) || baseline.digest !== stage.baselineDigest ||
      !Number.isSafeInteger(baseline.totalBytes) || Number(baseline.totalBytes) < 0 ||
      Number(baseline.totalBytes) > maximumWorkspaceBytes || !Array.isArray(baseline.files) || baseline.files.length > 20_000) {
    throw new Error("Managed stage review manifest is malformed")
  }
  let pathMetadataBytes = (stage.excludedPaths as string[]).reduce((total, path) => total + Buffer.byteLength(path), 0)
  if (pathMetadataBytes > maximumPathMetadataBytes) throw new Error("Managed stage review manifest path metadata exceeds its bound")
  const files: WorkspaceStageManifestFile[] = baseline.files.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Managed stage review manifest is malformed")
    const file = entry as Record<string, unknown>
    if (!exactKeys(file, ["path", "digest", "size", "mode"]) || !boundedString(file.path, 4_096) ||
        typeof file.digest !== "string" || !digestPattern.test(file.digest) || !Number.isSafeInteger(file.size) ||
        Number(file.size) < 0 || Number(file.size) > 16 * 1024 * 1024 || !Number.isSafeInteger(file.mode) ||
        Number(file.mode) < 0 || Number(file.mode) > 0o777) {
      throw new Error("Managed stage review manifest is malformed")
    }
    pathMetadataBytes += Buffer.byteLength(file.path)
    if (pathMetadataBytes > maximumPathMetadataBytes) {
      throw new Error("Managed stage review manifest path metadata exceeds its bound")
    }
    return { path: file.path, digest: file.digest as `sha256:${string}`, size: Number(file.size), mode: Number(file.mode) }
  })
  return {
    schemaVersion: 1,
    kind: "gaep-workspace-stage-manifest-v1",
    stage: {
      id: String(stage.id),
      sourceRoot: stage.sourceRoot,
      sourceIdentity,
      root: stage.root,
      baselineDigest: stage.baselineDigest as `sha256:${string}`,
      excludedPaths: (stage.excludedPaths as string[]).map(String),
    },
    baseline: {
      digest: baseline.digest as `sha256:${string}`,
      totalBytes: Number(baseline.totalBytes),
      files,
    },
  }
}

function parseStageInspection(value: unknown): WorkspaceStageInspection {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Managed stage review manifest is malformed")
  const inspection = value as Record<string, unknown>
  if (!exactKeys(inspection, ["baselineDigest", "finalDigest", "changes", "excludedPaths"]) ||
      typeof inspection.baselineDigest !== "string" || !digestPattern.test(inspection.baselineDigest) ||
      typeof inspection.finalDigest !== "string" || !digestPattern.test(inspection.finalDigest) ||
      !Array.isArray(inspection.changes) || inspection.changes.length > 20_000 || !Array.isArray(inspection.excludedPaths) ||
      inspection.excludedPaths.length > 20_000 || inspection.excludedPaths.some((path) => !boundedString(path, 4_096))) {
    throw new Error("Managed stage review manifest is malformed")
  }
  let pathMetadataBytes = (inspection.excludedPaths as string[]).reduce((total, path) => total + Buffer.byteLength(path), 0)
  if (pathMetadataBytes > maximumPathMetadataBytes) throw new Error("Managed stage review manifest path metadata exceeds its bound")
  const changes = inspection.changes.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Managed stage review manifest is malformed")
    const change = entry as Record<string, unknown>
    const allowed = ["path", "kind", "beforeDigest", "afterDigest", "beforeSize", "afterSize", "beforeMode", "afterMode"]
    if (Object.keys(change).some((key) => !allowed.includes(key)) || !boundedString(change.path, 4_096) ||
        !["added", "modified", "deleted"].includes(String(change.kind))) {
      throw new Error("Managed stage review manifest is malformed")
    }
    pathMetadataBytes += Buffer.byteLength(change.path)
    if (pathMetadataBytes > maximumPathMetadataBytes) {
      throw new Error("Managed stage review manifest path metadata exceeds its bound")
    }
    for (const digest of [change.beforeDigest, change.afterDigest]) {
      if (digest !== undefined && (typeof digest !== "string" || !digestPattern.test(digest))) {
        throw new Error("Managed stage review manifest is malformed")
      }
    }
    for (const numeric of [change.beforeSize, change.afterSize, change.beforeMode, change.afterMode]) {
      if (numeric !== undefined && (!Number.isSafeInteger(numeric) || Number(numeric) < 0)) {
        throw new Error("Managed stage review manifest is malformed")
      }
    }
    return structuredClone(change) as unknown as WorkspaceStageInspection["changes"][number]
  })
  return {
    baselineDigest: inspection.baselineDigest as `sha256:${string}`,
    finalDigest: inspection.finalDigest as `sha256:${string}`,
    changes,
    excludedPaths: (inspection.excludedPaths as string[]).map(String),
  }
}

function parseReviewManifest(value: unknown): ManagedStageReviewManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Managed stage review manifest is malformed")
  const manifest = value as Record<string, unknown>
  if (!exactKeys(manifest, [
    "schemaVersion", "kind", "managedRunId", "bindingsDigest", "provider", "stage", "inspection", "terminalDisposition",
  ]) || manifest.schemaVersion !== 1 || manifest.kind !== "gaep-managed-stage-review-manifest-v1" ||
      typeof manifest.managedRunId !== "string" || !runIdPattern.test(manifest.managedRunId) ||
      typeof manifest.bindingsDigest !== "string" || !digestPattern.test(manifest.bindingsDigest) ||
      !manifest.provider || typeof manifest.provider !== "object" || Array.isArray(manifest.provider) ||
      !["completed", "failed", "cancelled", "interrupted", "crashed", "protocol-error", "unknown"].includes(
        String(manifest.terminalDisposition),
      )) {
    throw new Error("Managed stage review manifest is malformed")
  }
  const provider = manifest.provider as Record<string, unknown>
  if (!exactKeys(provider, ["adapterId", "agentId", "modelId", "capabilityDigest"]) ||
      !boundedString(provider.adapterId, 1_024) || !boundedString(provider.agentId, 1_024) ||
      !boundedString(provider.modelId, 1_024) || typeof provider.capabilityDigest !== "string" ||
      !digestPattern.test(provider.capabilityDigest)) {
    throw new Error("Managed stage review manifest is malformed")
  }
  const stage = parseStageManifest(manifest.stage)
  const inspection = parseStageInspection(manifest.inspection)
  if (stage.stage.baselineDigest !== inspection.baselineDigest) throw new Error("Managed stage review baseline binding is invalid")
  return {
    schemaVersion: 1,
    kind: "gaep-managed-stage-review-manifest-v1",
    managedRunId: manifest.managedRunId,
    bindingsDigest: manifest.bindingsDigest as `sha256:${string}`,
    provider: {
      adapterId: provider.adapterId,
      agentId: provider.agentId,
      modelId: provider.modelId,
      capabilityDigest: provider.capabilityDigest as `sha256:${string}`,
    },
    stage,
    inspection,
    terminalDisposition: manifest.terminalDisposition as ManagedTerminalDisposition,
  }
}

function parseRecord(value: unknown): ManagedStageRegistryRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Managed stage registry record is malformed")
  const record = value as Record<string, unknown>
  const keys = new Set(Object.keys(record))
  for (const key of [
    "schemaVersion", "generation", "managedRunId", "stageId", "stageTempRoot", "stageIdentity", "stageWorkspaceIdentity", "sourceWorkspacePath", "sourceWorkspaceIdentity", "state",
    "journalPath", "journalId", "journalDigest", "journalSemanticDigest", "journalRootIdentity", "journalFileIdentity", "quarantinePath", "ownerLease",
    "recoveryOperation", "disposalOperation", "discardOperation", "reviewManifestPath", "reviewManifestDigest", "reviewManifestFileIdentity", "updatedAt",
  ]) keys.delete(key)
  const stageIdentity = parseIdentity(record.stageIdentity)
  const stageWorkspaceIdentity = parseIdentity(record.stageWorkspaceIdentity)
  const sourceWorkspaceIdentity = parseIdentity(record.sourceWorkspaceIdentity)
  const journalRootIdentity = record.journalRootIdentity === undefined ? undefined : parseIdentity(record.journalRootIdentity)
  const journalFileIdentity = record.journalFileIdentity === undefined ? undefined : parseIdentity(record.journalFileIdentity)
  const reviewManifestFileIdentity = record.reviewManifestFileIdentity === undefined
    ? undefined
    : parseIdentity(record.reviewManifestFileIdentity)
  const journalFieldsComplete = typeof record.journalId === "string" && runIdPattern.test(record.journalId) &&
    record.journalDigest !== undefined && typeof record.journalSemanticDigest === "string" &&
    digestPattern.test(record.journalSemanticDigest) && journalRootIdentity !== undefined && journalFileIdentity !== undefined
  const journalFieldsAbsent = record.journalId === undefined && record.journalDigest === undefined &&
    record.journalSemanticDigest === undefined && journalRootIdentity === undefined && journalFileIdentity === undefined
  const reviewManifestFieldsComplete = typeof record.reviewManifestPath === "string" &&
    typeof record.reviewManifestDigest === "string" && digestPattern.test(record.reviewManifestDigest) &&
    reviewManifestFileIdentity !== undefined
  const reviewManifestFieldsAbsent = record.reviewManifestPath === undefined && record.reviewManifestDigest === undefined &&
    record.reviewManifestFileIdentity === undefined
  const validReviewManifestState = reviewManifestFieldsAbsent ||
    ["review-required", "applying", "journal-retained", "recovering", "discarding"].includes(String(record.state))
  const state = record.state
  const validState = typeof state === "string" &&
    ["staging", "review-required", "applying", "journal-retained", "recovering", "quarantined", "discarding", "disposing"].includes(state)
  const ownerLease = record.ownerLease
  const validOwnerLease = ownerLease !== undefined && ownerLease !== null && typeof ownerLease === "object" && !Array.isArray(ownerLease) &&
    Object.keys(ownerLease).length === 3 && Number.isSafeInteger((ownerLease as Record<string, unknown>).pid) &&
    Number((ownerLease as Record<string, unknown>).pid) > 0 &&
    typeof (ownerLease as Record<string, unknown>).token === "string" &&
    runIdPattern.test(String((ownerLease as Record<string, unknown>).token)) &&
    typeof (ownerLease as Record<string, unknown>).acquiredAt === "string" &&
    Number.isFinite(Date.parse(String((ownerLease as Record<string, unknown>).acquiredAt)))
  const recoveryOperation = record.recoveryOperation
  const validRecoveryOperation = recoveryOperation !== undefined && recoveryOperation !== null && typeof recoveryOperation === "object" &&
    !Array.isArray(recoveryOperation) && Object.keys(recoveryOperation).length === 3 &&
    typeof (recoveryOperation as Record<string, unknown>).id === "string" &&
    runIdPattern.test(String((recoveryOperation as Record<string, unknown>).id)) &&
    ["staging", "review-required", "applying", "journal-retained"].includes(
      String((recoveryOperation as Record<string, unknown>).fromState),
    ) && typeof (recoveryOperation as Record<string, unknown>).startedAt === "string" &&
    Number.isFinite(Date.parse(String((recoveryOperation as Record<string, unknown>).startedAt)))
  const disposalOperation = record.disposalOperation
  const validDisposalOperation = disposalOperation !== undefined && disposalOperation !== null &&
    typeof disposalOperation === "object" && !Array.isArray(disposalOperation) &&
    Object.keys(disposalOperation).length === 2 &&
    typeof (disposalOperation as Record<string, unknown>).tombstonePath === "string" &&
    typeof (disposalOperation as Record<string, unknown>).startedAt === "string" &&
    Number.isFinite(Date.parse(String((disposalOperation as Record<string, unknown>).startedAt)))
  const discardOperation = record.discardOperation
  const validDiscardOperation = discardOperation !== undefined && discardOperation !== null &&
    typeof discardOperation === "object" && !Array.isArray(discardOperation) &&
    Object.keys(discardOperation).length === 2 &&
    typeof (discardOperation as Record<string, unknown>).startedAt === "string" &&
    Number.isFinite(Date.parse(String((discardOperation as Record<string, unknown>).startedAt))) &&
    typeof (discardOperation as Record<string, unknown>).localCleanupComplete === "boolean"
  const validStateFields = state === "journal-retained"
    ? typeof record.journalPath === "string" && record.quarantinePath === undefined && journalFieldsComplete &&
      record.ownerLease === undefined && record.recoveryOperation === undefined && record.disposalOperation === undefined &&
      record.discardOperation === undefined
    : state === "quarantined"
      ? record.journalPath === undefined && typeof record.quarantinePath === "string" && journalFieldsComplete &&
        record.ownerLease === undefined && record.recoveryOperation === undefined && record.disposalOperation === undefined &&
        record.discardOperation === undefined
      : state === "discarding"
        ? record.journalPath === undefined && record.quarantinePath === undefined && journalFieldsAbsent &&
          record.ownerLease === undefined && record.recoveryOperation === undefined && record.disposalOperation === undefined &&
          validDiscardOperation &&
          (!(discardOperation as Record<string, unknown>).localCleanupComplete || reviewManifestFieldsAbsent)
      : state === "disposing"
        ? record.journalPath === undefined && typeof record.quarantinePath === "string" && journalFieldsComplete &&
          record.ownerLease === undefined && record.recoveryOperation === undefined && validDisposalOperation &&
          record.discardOperation === undefined
      : state === "recovering"
        ? record.quarantinePath === undefined && validRecoveryOperation && record.ownerLease === undefined &&
          record.disposalOperation === undefined && record.discardOperation === undefined &&
          (record.journalPath === undefined ? journalFieldsAbsent : journalFieldsComplete)
        : state === "applying"
          ? record.quarantinePath === undefined && validOwnerLease && record.recoveryOperation === undefined &&
            record.disposalOperation === undefined && record.discardOperation === undefined &&
            (record.journalPath === undefined ? journalFieldsAbsent : journalFieldsComplete)
          : state === "review-required"
            ? record.journalPath === undefined && record.quarantinePath === undefined && journalFieldsAbsent &&
              (record.ownerLease === undefined || validOwnerLease) && record.recoveryOperation === undefined &&
              record.disposalOperation === undefined && record.discardOperation === undefined
            : record.journalPath === undefined && record.quarantinePath === undefined && journalFieldsAbsent &&
              validOwnerLease && record.recoveryOperation === undefined && record.disposalOperation === undefined &&
              record.discardOperation === undefined
  if (keys.size > 0 || record.schemaVersion !== 2 || !Number.isSafeInteger(record.generation) || Number(record.generation) < 1 ||
      typeof record.managedRunId !== "string" ||
      !runIdPattern.test(record.managedRunId) || typeof record.stageId !== "string" || !runIdPattern.test(record.stageId) ||
      typeof record.stageTempRoot !== "string" || !stageIdentity || !stageWorkspaceIdentity ||
      typeof record.sourceWorkspacePath !== "string" ||
      !sourceWorkspaceIdentity ||
      !validState || typeof record.updatedAt !== "string" || !Number.isFinite(Date.parse(record.updatedAt)) ||
      (record.journalPath !== undefined && typeof record.journalPath !== "string") ||
      (record.journalId !== undefined && (typeof record.journalId !== "string" || !runIdPattern.test(record.journalId))) ||
      (record.journalDigest !== undefined && (typeof record.journalDigest !== "string" || !digestPattern.test(record.journalDigest))) ||
      (record.journalSemanticDigest !== undefined &&
        (typeof record.journalSemanticDigest !== "string" || !digestPattern.test(record.journalSemanticDigest))) ||
      (!reviewManifestFieldsComplete && !reviewManifestFieldsAbsent) || !validReviewManifestState ||
      (record.quarantinePath !== undefined && typeof record.quarantinePath !== "string") || !validStateFields) {
    throw new Error("Managed stage registry record is malformed")
  }
  return {
    ...(record as unknown as ManagedStageRegistryRecord),
    stageIdentity,
    stageWorkspaceIdentity,
    sourceWorkspaceIdentity,
    ...(validOwnerLease ? { ownerLease: ownerLease as ManagedStageRegistryRecord["ownerLease"] } : {}),
    ...(validRecoveryOperation
      ? { recoveryOperation: recoveryOperation as ManagedStageRegistryRecord["recoveryOperation"] }
      : {}),
    ...(validDisposalOperation
      ? { disposalOperation: disposalOperation as ManagedStageRegistryRecord["disposalOperation"] }
      : {}),
    ...(validDiscardOperation
      ? { discardOperation: discardOperation as ManagedStageRegistryRecord["discardOperation"] }
      : {}),
    ...(journalRootIdentity ? { journalRootIdentity } : {}),
    ...(journalFileIdentity ? { journalFileIdentity } : {}),
    ...(reviewManifestFileIdentity ? { reviewManifestFileIdentity } : {}),
  }
}

function isNoEntry(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}

function digestBytes(value: Buffer): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

interface ParsedApplyJournal {
  id: string
  stageId: string
  authorizationId: string
  baselineDigest: `sha256:${string}`
  intendedFinalDigest: `sha256:${string}`
  state: string
  semanticDigest: `sha256:${string}`
  entries: ParsedApplyJournalEntry[]
}

interface ParsedApplyJournalTemporaryIntent {
  path: string
  digest: `sha256:${string}`
  size: number
  mode: number
  device?: string
  inode?: string
}

interface ParsedApplyJournalDirectoryIntent {
  path: string
  temporaryPath: string
  device?: string
  inode?: string
  created: boolean
}

interface ParsedApplyJournalEntry {
  path: string
  kind: "added" | "modified" | "deleted"
  prepared: boolean
  backup?: {
    path: string
    temporaryPath: string
    digest: `sha256:${string}`
    size: number
    mode: number
  }
  sourceTemporary?: ParsedApplyJournalTemporaryIntent
  rollbackTemporary?: ParsedApplyJournalTemporaryIntent
  createdDirectories: ParsedApplyJournalDirectoryIntent[]
}

function safeJournalRelativePath(value: unknown, backup = false): value is string {
  if (!boundedString(value, 4_096) || isAbsolute(value) || value.includes("\\")) return false
  const segments = value.split("/")
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return false
  return !backup || segments[0] === "backups"
}

function parseApplyJournal(bytes: Buffer): ParsedApplyJournal {
  let parsed: unknown
  try { parsed = JSON.parse(bytes.toString("utf8")) } catch { throw new Error("Managed apply journal is malformed") }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Managed apply journal is malformed")
  const journal = parsed as Record<string, unknown>
  const allowed = new Set([
    "schemaVersion", "id", "stageId", "authorizationId", "baselineDigest", "intendedFinalDigest", "state", "entries", "error",
  ])
  if (Object.keys(journal).some((key) => !allowed.has(key)) || journal.schemaVersion !== 2 ||
      typeof journal.id !== "string" || !runIdPattern.test(journal.id) || typeof journal.stageId !== "string" ||
      !runIdPattern.test(journal.stageId) || !boundedString(journal.authorizationId, 1_024) ||
      typeof journal.baselineDigest !== "string" || !digestPattern.test(journal.baselineDigest) ||
      typeof journal.intendedFinalDigest !== "string" || !digestPattern.test(journal.intendedFinalDigest) ||
      !["prepared", "conflict", "applying", "committed", "rolling-back", "rolled-back", "rollback-failed"].includes(
        String(journal.state),
      ) || !Array.isArray(journal.entries) || journal.entries.length > maximumApplyEntries ||
      (journal.error !== undefined && !boundedString(journal.error, 64 * 1_024))) {
    throw new Error("Managed apply journal is malformed")
  }
  const paths = new Set<string>()
  const directoryIntentPaths = new Set<string>()
  const directoryTemporaryPaths = new Set<string>()
  const allTemporaryPaths = new Set<string>()
  let directoryIntentCount = 0
  let aggregateBackupBytes = 0
  let aggregateSourceTemporaryBytes = 0
  let aggregateRollbackTemporaryBytes = 0
  const parsedEntries: ParsedApplyJournalEntry[] = []
  for (const [entryIndex, untrustedEntry] of journal.entries.entries()) {
    if (!untrustedEntry || typeof untrustedEntry !== "object" || Array.isArray(untrustedEntry)) {
      throw new Error("Managed apply journal is malformed")
    }
    const entry = untrustedEntry as Record<string, unknown>
    const entryAllowed = new Set([
      "path", "kind", "prepared", "backupPath", "backupTemporaryPath", "backupDigest", "backupSize", "backupMode", "applied", "rolledBack",
      "sourceTemporaryPath", "sourceTemporaryDigest", "sourceTemporarySize", "sourceTemporaryMode",
      "sourceTemporaryDevice", "sourceTemporaryInode", "rollbackTemporaryPath", "rollbackTemporaryDigest",
      "rollbackTemporarySize", "rollbackTemporaryMode", "rollbackTemporaryDevice", "rollbackTemporaryInode",
      "createdDirectories",
    ])
    if (Object.keys(entry).some((key) => !entryAllowed.has(key)) || !safeJournalRelativePath(entry.path) ||
        !["added", "modified", "deleted"].includes(String(entry.kind)) || typeof entry.prepared !== "boolean" ||
        typeof entry.applied !== "boolean" || typeof entry.rolledBack !== "boolean" || paths.has(entry.path) ||
        (entry.applied && !entry.prepared) || (entry.rolledBack && !entry.applied)) {
      throw new Error("Managed apply journal is malformed")
    }
    paths.add(entry.path)
    const backupPresent = entry.backupPath !== undefined || entry.backupTemporaryPath !== undefined || entry.backupDigest !== undefined ||
      entry.backupSize !== undefined || entry.backupMode !== undefined
    const backupComplete = safeJournalRelativePath(entry.backupPath, true) &&
      safeJournalRelativePath(entry.backupTemporaryPath) && typeof entry.backupDigest === "string" &&
      digestPattern.test(entry.backupDigest) && Number.isSafeInteger(entry.backupSize) && Number(entry.backupSize) >= 0 &&
      Number(entry.backupSize) <= maximumWorkspaceFileBytes && Number.isSafeInteger(entry.backupMode) &&
      Number(entry.backupMode) >= 0 && Number(entry.backupMode) <= 0o777
    if (backupPresent !== backupComplete || (entry.kind === "added" && backupPresent) ||
        (entry.prepared && entry.kind !== "added" && !backupComplete)) {
      throw new Error("Managed apply journal is malformed")
    }
    if (backupComplete) {
      if (entry.backupPath !== `backups/${entryIndex}.bin`) {
        throw new Error("Managed apply journal backup path binding is invalid")
      }
      if (entry.backupTemporaryPath !== `.gaep-backup-${journal.id}-${entryIndex}.tmp`) {
        throw new Error("Managed apply journal backup temporary path binding is invalid")
      }
      if (allTemporaryPaths.has(String(entry.backupTemporaryPath))) {
        throw new Error("Managed apply journal backup temporary path is duplicated")
      }
      allTemporaryPaths.add(String(entry.backupTemporaryPath))
      aggregateBackupBytes += Number(entry.backupSize)
      if (aggregateBackupBytes > maximumWorkspaceBytes) throw new Error("Managed apply journal backup byte bound is exceeded")
    }
    const parseTemporary = (prefix: "source" | "rollback"): ParsedApplyJournalTemporaryIntent | undefined => {
      const pathKey = `${prefix}TemporaryPath`
      const digestKey = `${prefix}TemporaryDigest`
      const sizeKey = `${prefix}TemporarySize`
      const modeKey = `${prefix}TemporaryMode`
      const deviceKey = `${prefix}TemporaryDevice`
      const inodeKey = `${prefix}TemporaryInode`
      const anyPresent = [pathKey, digestKey, sizeKey, modeKey, deviceKey, inodeKey]
        .some((key) => entry[key] !== undefined)
      if (!anyPresent) return undefined
      const identityComplete = boundedString(entry[deviceKey], 128) && boundedString(entry[inodeKey], 128)
      const identityAbsent = entry[deviceKey] === undefined && entry[inodeKey] === undefined
      if (!safeJournalRelativePath(entry[pathKey]) || typeof entry[digestKey] !== "string" ||
          !digestPattern.test(String(entry[digestKey])) || !Number.isSafeInteger(entry[sizeKey]) ||
          Number(entry[sizeKey]) < 0 || Number(entry[sizeKey]) > maximumWorkspaceFileBytes ||
          !Number.isSafeInteger(entry[modeKey]) || Number(entry[modeKey]) < 0 || Number(entry[modeKey]) > 0o777 ||
          (!identityComplete && !identityAbsent) ||
          (identityComplete && (!/^\d+$/.test(String(entry[deviceKey])) || !/^\d+$/.test(String(entry[inodeKey]))))) {
        throw new Error("Managed apply journal is malformed")
      }
      const intendedPath = String(entry[pathKey])
      const intendedParent = dirname(intendedPath)
      const entryParent = dirname(String(entry.path))
      const expectedName = prefix === "source"
        ? `.gaep-apply-${journal.id}-${entryIndex}.tmp`
        : `.gaep-rollback-${journal.id}-${entryIndex}.tmp`
      if ((intendedParent === "." ? "" : intendedParent) !== (entryParent === "." ? "" : entryParent) ||
          basename(intendedPath) !== expectedName) {
        throw new Error("Managed apply journal temporary path binding is invalid")
      }
      return {
        path: intendedPath,
        digest: entry[digestKey] as `sha256:${string}`,
        size: Number(entry[sizeKey]),
        mode: Number(entry[modeKey]),
        ...(identityComplete ? { device: String(entry[deviceKey]), inode: String(entry[inodeKey]) } : {}),
      }
    }
    const sourceTemporary = parseTemporary("source")
    const rollbackTemporary = parseTemporary("rollback")
    aggregateSourceTemporaryBytes += sourceTemporary?.size ?? 0
    aggregateRollbackTemporaryBytes += rollbackTemporary?.size ?? 0
    if (aggregateSourceTemporaryBytes > maximumWorkspaceBytes || aggregateRollbackTemporaryBytes > maximumWorkspaceBytes) {
      throw new Error("Managed apply journal temporary byte bound is exceeded")
    }
    for (const temporary of [sourceTemporary, rollbackTemporary]) {
      if (temporary && allTemporaryPaths.has(temporary.path)) throw new Error("Managed apply journal temporary path is duplicated")
      if (temporary) allTemporaryPaths.add(temporary.path)
    }
    if ((entry.kind !== "deleted" && !sourceTemporary) || (entry.kind === "deleted" && sourceTemporary) ||
        (entry.kind !== "added" && !rollbackTemporary) ||
        (rollbackTemporary && (entry.kind === "added" || !backupComplete)) ||
        (rollbackTemporary && (rollbackTemporary.digest !== entry.backupDigest ||
          rollbackTemporary.size !== Number(entry.backupSize) || rollbackTemporary.mode !== Number(entry.backupMode)))) {
      throw new Error("Managed apply journal is malformed")
    }
    const createdDirectories: ParsedApplyJournalDirectoryIntent[] = []
    if (entry.createdDirectories !== undefined) {
      if (!Array.isArray(entry.createdDirectories) || entry.createdDirectories.length > 64) {
        throw new Error("Managed apply journal is malformed")
      }
      const directoryPaths = new Set<string>()
      for (const [directoryIndex, untrustedDirectory] of entry.createdDirectories.entries()) {
        if (!untrustedDirectory || typeof untrustedDirectory !== "object" || Array.isArray(untrustedDirectory)) {
          throw new Error("Managed apply journal is malformed")
        }
        const directory = untrustedDirectory as Record<string, unknown>
        const identityComplete = boundedString(directory.device, 128) && boundedString(directory.inode, 128)
        const identityAbsent = directory.device === undefined && directory.inode === undefined
        if (!exactKeys(directory, identityComplete
          ? ["path", "temporaryPath", "device", "inode", "created"]
          : ["path", "temporaryPath", "created"]) ||
            !safeJournalRelativePath(directory.path) || !safeJournalRelativePath(directory.temporaryPath) ||
            typeof directory.created !== "boolean" || (!identityComplete && !identityAbsent) ||
            (identityComplete && (!/^\d+$/.test(String(directory.device)) || !/^\d+$/.test(String(directory.inode)))) ||
            (directory.created && !identityComplete) || directoryPaths.has(String(directory.path)) ||
            directoryIntentPaths.has(String(directory.path)) ||
            directoryTemporaryPaths.has(String(directory.temporaryPath)) ||
            allTemporaryPaths.has(String(directory.temporaryPath)) ||
            entry.kind === "deleted" ||
            !String(entry.path).startsWith(`${String(directory.path)}/`) ||
            (dirname(String(directory.temporaryPath)) === "." ? "" : dirname(String(directory.temporaryPath))) !==
              (dirname(String(directory.path)) === "." ? "" : dirname(String(directory.path))) ||
            basename(String(directory.temporaryPath)) !==
              `.gaep-dir-${journal.id}-${entryIndex}-${directoryIndex}.tmp`) {
          throw new Error("Managed apply journal directory intent is malformed")
        }
        directoryPaths.add(String(directory.path))
        directoryIntentPaths.add(String(directory.path))
        directoryTemporaryPaths.add(String(directory.temporaryPath))
        allTemporaryPaths.add(String(directory.temporaryPath))
        directoryIntentCount += 1
        if (directoryIntentCount > maximumWorkspaceDirectories || directoryIntentCount > maximumApplyDirectoryIntents) {
          throw new Error("Managed apply journal directory intent bound is exceeded")
        }
        createdDirectories.push({
          path: String(directory.path),
          temporaryPath: String(directory.temporaryPath),
          created: directory.created,
          ...(identityComplete ? { device: String(directory.device), inode: String(directory.inode) } : {}),
        })
      }
    }
    parsedEntries.push({
      path: String(entry.path),
      kind: entry.kind as ParsedApplyJournalEntry["kind"],
      prepared: entry.prepared,
      ...(backupComplete
        ? {
            backup: {
              path: String(entry.backupPath),
              temporaryPath: String(entry.backupTemporaryPath),
              digest: entry.backupDigest as `sha256:${string}`,
              size: Number(entry.backupSize),
              mode: Number(entry.backupMode),
            },
          }
        : {}),
      ...(sourceTemporary ? { sourceTemporary } : {}),
      ...(rollbackTemporary ? { rollbackTemporary } : {}),
      createdDirectories,
    })
  }
  const semanticProjection = {
    schemaVersion: 1,
    id: journal.id,
    stageId: journal.stageId,
    authorizationId: journal.authorizationId,
    baselineDigest: journal.baselineDigest,
    intendedFinalDigest: journal.intendedFinalDigest,
    entries: parsedEntries.map((entry) => ({
      path: entry.path,
      kind: entry.kind,
      ...(entry.backup ? { backup: entry.backup } : {}),
      ...(entry.sourceTemporary
        ? {
            sourceTemporary: {
              path: entry.sourceTemporary.path,
              digest: entry.sourceTemporary.digest,
              size: entry.sourceTemporary.size,
              mode: entry.sourceTemporary.mode,
            },
          }
        : {}),
      ...(entry.rollbackTemporary
        ? {
            rollbackTemporary: {
              path: entry.rollbackTemporary.path,
              digest: entry.rollbackTemporary.digest,
              size: entry.rollbackTemporary.size,
              mode: entry.rollbackTemporary.mode,
            },
          }
        : {}),
      createdDirectories: entry.createdDirectories.map(({ path, temporaryPath }) => ({ path, temporaryPath })),
    })),
  }
  return {
    id: journal.id,
    stageId: journal.stageId,
    authorizationId: String(journal.authorizationId),
    baselineDigest: journal.baselineDigest as `sha256:${string}`,
    intendedFinalDigest: journal.intendedFinalDigest as `sha256:${string}`,
    state: String(journal.state),
    semanticDigest: digestBytes(Buffer.from(JSON.stringify(semanticProjection))),
    entries: parsedEntries,
  }
}

export class ManagedStageRegistry {
  readonly root: string
  private readonly tempParent: string
  private readonly tempParentIdentity: FileIdentity
  private readonly hostSecurity: ManagedStageHostSecurity
  private readonly lockWaitMs: number
  private readonly staleLockMs: number
  private readonly isProcessAlive: (pid: number) => boolean
  private readonly beforeDisposalStep?: ManagedStageRegistryOptions["beforeDisposalStep"]
  private readonly afterQuarantineMove?: ManagedStageRegistryOptions["afterQuarantineMove"]
  private readonly afterRunLockCreate?: ManagedStageRegistryOptions["afterRunLockCreate"]
  private readonly afterRecordRename?: ManagedStageRegistryOptions["afterRecordRename"]
  private readonly afterManifestRename?: ManagedStageRegistryOptions["afterManifestRename"]
  private registryRootIdentity: FileIdentity | undefined

  constructor(tempParent = tmpdir(), options: ManagedStageRegistryOptions = {}) {
    const requestedParent = resolve(tempParent)
    this.tempParent = realpathSync(requestedParent)
    const parentMetadata = lstatSync(this.tempParent, { bigint: true })
    if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink()) {
      throw new Error("Managed stage registry temporary parent is unsafe")
    }
    this.tempParentIdentity = identityOf(parentMetadata)
    const hostPlatform = options.hostPlatform ?? (process.platform === "win32" ? "windows" : "posix")
    if (hostPlatform === "posix") {
      if (typeof process.getuid !== "function") {
        throw new Error("Managed stage registry cannot establish current-user filesystem ownership on this host")
      }
      if (typeof constants.O_NOFOLLOW !== "number" || typeof constants.O_DIRECTORY !== "number") {
        throw new Error("Managed stage registry requires no-follow directory filesystem operations")
      }
      const uid = process.getuid()
      if (!Number.isSafeInteger(uid) || uid < 0) {
        throw new Error("Managed stage registry cannot establish current-user filesystem ownership on this host")
      }
      const ownerUid = BigInt(uid)
      const parentMode = Number(parentMetadata.mode & 0o7777n)
      const privateOwnedParent = parentMetadata.uid === ownerUid && (parentMode & 0o077) === 0
      const protectedSharedParent = parentMetadata.uid === 0n && (parentMode & 0o1000) !== 0 && (parentMode & 0o002) !== 0
      if (!privateOwnedParent && !protectedSharedParent) {
        throw new Error("Managed stage registry temporary parent lacks a trusted ownership and permission boundary")
      }
      this.hostSecurity = {
        kind: "posix",
        ownerUid,
        directoryOpenFlag: constants.O_DIRECTORY,
        noFollowOpenFlag: constants.O_NOFOLLOW,
      }
      this.root = join(this.tempParent, `gaep-managed-stage-registry-v2-u${uid}`)
    } else {
      const trustedTempRoot = realpathSync(resolve(tmpdir()))
      const trustedTempRootMetadata = lstatSync(trustedTempRoot, { bigint: true })
      if (!trustedTempRootMetadata.isDirectory() || trustedTempRootMetadata.isSymbolicLink() ||
          (this.tempParent !== trustedTempRoot && !contained(trustedTempRoot, this.tempParent))) {
        throw new Error("Managed stage registry temporary parent is outside the Windows user temporary boundary")
      }
      const user = userInfo()
      const userScope = createHash("sha256")
        .update(`${user.username}\0${user.homedir}`)
        .digest("hex")
        .slice(0, 24)
      this.hostSecurity = {
        kind: "windows",
        trustedTempRoot,
        trustedTempRootIdentity: identityOf(trustedTempRootMetadata),
      }
      this.root = join(this.tempParent, `gaep-managed-stage-registry-v2-w${userScope}`)
    }
    this.lockWaitMs = options.lockWaitMs ?? defaultLockWaitMs
    this.staleLockMs = options.staleLockMs ?? defaultStaleLockMs
    this.beforeDisposalStep = options.beforeDisposalStep
    this.afterQuarantineMove = options.afterQuarantineMove
    this.afterRunLockCreate = options.afterRunLockCreate
    this.afterRecordRename = options.afterRecordRename
    this.afterManifestRename = options.afterManifestRename
    if (!Number.isSafeInteger(this.lockWaitMs) || this.lockWaitMs < 1 ||
        !Number.isSafeInteger(this.staleLockMs) || this.staleLockMs < 1) {
      throw new Error("Managed stage registry lock timing is invalid")
    }
    this.isProcessAlive = options.isProcessAlive ?? ((pid) => {
      try {
        process.kill(pid, 0)
        return true
      } catch (error) {
        return !(error instanceof Error && "code" in error && error.code === "ESRCH")
      }
    })
  }

  async register(managedRunId: string, stage: WorkspaceStage): Promise<void> {
    this.assertRunId(managedRunId)
    assertAuthenticWorkspaceStage(stage)
    await this.withRunLock(managedRunId, async () => {
      if (!runIdPattern.test(stage.id) || stage.kind !== "gaep-isolated-workspace-staging-v1" || stage.state !== "ready") {
        throw new Error("Managed stage registry requires a valid ready workspace stage")
      }
      const presentedTempRootIdentity = parseIdentity(stage.tempRootIdentity)
      const presentedWorkspaceIdentity = parseIdentity(stage.rootIdentity)
      if (!presentedTempRootIdentity || !presentedWorkspaceIdentity) {
        throw new Error("Managed stage registry requires staging-service identity attestations")
      }
      const presentedStageRoot = resolve(stage.root)
      const presentedStageMetadata = await lstat(presentedStageRoot)
      if (!presentedStageMetadata.isDirectory() || presentedStageMetadata.isSymbolicLink()) {
        throw new Error("Managed stage registry requires a real managed workspace stage directory")
      }
      const stageRoot = await realpath(presentedStageRoot)
      const stageTempRoot = dirname(stageRoot)
      if (stageRoot !== join(stageTempRoot, "workspace")) {
        throw new Error("Managed stage registry requires the exact managed workspace stage path")
      }
      const stageIdentity = await this.assertStageRoot(stageTempRoot, presentedTempRootIdentity)
      const workspaceIdentity = await this.assertPrivateDirectory(
        stageRoot,
        "Managed workspace stage",
        0o700,
        presentedWorkspaceIdentity,
      )
      const sourceWorkspacePath = resolve(stage.sourceRoot)
      if (sourceWorkspacePath !== stage.sourceRoot) throw new Error("Managed stage registry source workspace path is not canonical")
      const sourceMetadata = await lstat(sourceWorkspacePath, { bigint: true })
      if (!sourceMetadata.isDirectory() || sourceMetadata.isSymbolicLink() || await realpath(sourceWorkspacePath) !== sourceWorkspacePath) {
        throw new Error("Managed stage registry source workspace path is unsafe")
      }
      await this.assertStageRoot(stageTempRoot, stageIdentity)
      await this.assertPrivateDirectory(stageRoot, "Managed workspace stage", 0o700, workspaceIdentity)
      const now = new Date().toISOString()
      await this.write({
        schemaVersion: 2,
        generation: 1,
        managedRunId,
        stageId: stage.id,
        stageTempRoot,
        stageIdentity,
        stageWorkspaceIdentity: workspaceIdentity,
        sourceWorkspacePath,
        sourceWorkspaceIdentity: identityOf(sourceMetadata),
        state: "staging",
        ownerLease: { pid: process.pid, token: randomUUID(), acquiredAt: now },
        updatedAt: now,
      }, { mustBeAbsent: true })
    })
  }

  async markReview(
    managedRunId: string,
    untrustedManifest?: ManagedStageReviewManifest,
  ): Promise<string | undefined> {
    this.assertRunId(managedRunId)
    return this.withRunLock(managedRunId, async () => {
      const snapshot = await this.read(managedRunId)
      if (!snapshot || snapshot.record.state !== "staging") {
        throw new Error("Managed stage registry can mark review only from staging state")
      }
      const record = snapshot.record
      if (record.ownerLease?.pid !== process.pid) throw new Error("Managed stage registry staging owner changed before review")
      const manifest = untrustedManifest === undefined ? undefined : parseReviewManifest(untrustedManifest)
      if (manifest && (manifest.managedRunId !== managedRunId || manifest.stage.stage.id !== record.stageId ||
          manifest.stage.stage.root !== join(record.stageTempRoot, "workspace") ||
          manifest.stage.stage.sourceRoot !== record.sourceWorkspacePath ||
          !sameIdentity(manifest.stage.stage.sourceIdentity, record.sourceWorkspaceIdentity))) {
        throw new Error("Managed stage review manifest does not match its registered staged workspace")
      }
      if (manifest) await this.syncDurableStageTree(record)
      const binding = manifest ? await this.writeReviewManifest(managedRunId, manifest) : undefined
      const leaseToken = randomUUID()
      const now = new Date().toISOString()
      try {
        await this.write({
          ...record,
          generation: record.generation + 1,
          state: "review-required",
          ownerLease: { pid: process.pid, token: leaseToken, acquiredAt: now },
          ...(binding
            ? {
                reviewManifestPath: binding.path,
                reviewManifestDigest: binding.digest,
                reviewManifestFileIdentity: binding.identity,
              }
            : {}),
          updatedAt: now,
        }, { expectedIdentity: snapshot.fileIdentity, expectedGeneration: record.generation })
      } catch (error) {
        if (binding) {
          await this.removeBoundFile(
            binding.path,
            binding.identity,
            "Managed stage review manifest",
            managedRunId,
          ).catch(() => undefined)
        }
        throw error
      }
      return manifest ? leaseToken : undefined
    })
  }

  async claimReview(managedRunId: string): Promise<ManagedStageReviewClaim> {
    this.assertRunId(managedRunId)
    return this.withRunLock(managedRunId, async () => {
      const snapshot = await this.read(managedRunId)
      if (!snapshot || snapshot.record.state !== "review-required") {
        throw new Error("Managed stage registry can claim only a review-required stage")
      }
      const record = snapshot.record
      if (!record.reviewManifestPath || !record.reviewManifestDigest || !record.reviewManifestFileIdentity) {
        throw new Error("Managed stage review has no durable rehydration manifest")
      }
      if (record.ownerLease && this.isProcessAlive(record.ownerLease.pid)) {
        throw new ManagedStageRecoveryError(
          "stage-active",
          `Managed stage review is still owned by live process ${record.ownerLease.pid}`,
        )
      }
      await this.assertStageRoot(record.stageTempRoot, record.stageIdentity)
      await this.assertPrivateDirectory(
        join(record.stageTempRoot, "workspace"),
        "Managed workspace stage",
        0o700,
        record.stageWorkspaceIdentity,
      )
      const manifest = await this.readReviewManifest(record)
      const leaseToken = randomUUID()
      const now = new Date().toISOString()
      await this.write({
        ...record,
        generation: record.generation + 1,
        ownerLease: { pid: process.pid, token: leaseToken, acquiredAt: now },
        updatedAt: now,
      }, { expectedIdentity: snapshot.fileIdentity, expectedGeneration: record.generation })
      const claim = deepFreeze({
        leaseToken,
        manifest: structuredClone(manifest),
        stageTempRootIdentity: { ...record.stageIdentity },
        stageRootIdentity: { ...record.stageWorkspaceIdentity },
      })
      authenticManagedStageReviewClaims.add(claim)
      return claim
    })
  }

  async markApplying(managedRunId: string, reviewLeaseToken?: string): Promise<void> {
    await this.withRunLock(managedRunId, () => this.updateLocked(managedRunId, (record) => {
      if (record.state !== "review-required") throw new Error("Managed stage registry can mark applying only from review-required state")
      this.assertReviewLease(record, reviewLeaseToken)
      return { ...record, state: "applying" }
    }))
  }

  async restoreReviewAfterPreJournalFailure(managedRunId: string, reviewLeaseToken?: string): Promise<void> {
    await this.withRunLock(managedRunId, () => this.updateLocked(managedRunId, (record) => {
      if (record.state === "review-required") {
        this.assertReviewLease(record, reviewLeaseToken)
        return record
      }
      if (record.state !== "applying" || record.journalPath || record.journalDigest || record.journalId) {
        throw new Error("Managed stage registry can restore review only before any apply journal is durably bound")
      }
      this.assertReviewLease(record, reviewLeaseToken)
      return { ...record, state: "review-required" }
    }))
  }

  async bindApplyingJournal(
    managedRunId: string,
    journalPath: string,
    journalDigest: `sha256:${string}`,
    journalId: string,
    reviewLeaseToken?: string,
  ): Promise<void> {
    this.assertRunId(managedRunId)
    if (!digestPattern.test(journalDigest) || !runIdPattern.test(journalId)) {
      throw new Error("Managed apply journal binding is invalid")
    }
    await this.withRunLock(managedRunId, async () => {
      const presentedJournalPath = resolve(journalPath)
      const presentedJournalMetadata = await lstat(presentedJournalPath)
      if (!presentedJournalMetadata.isFile() || presentedJournalMetadata.isSymbolicLink()) {
        throw new Error("Managed apply journal path is unsafe")
      }
      const canonicalJournalPath = await realpath(presentedJournalPath)
      const inspected = await this.inspectJournal(canonicalJournalPath, { expectedDigest: journalDigest })
      if (inspected.journal.id !== journalId) throw new Error("Managed apply journal identity changed before registry binding")
      await this.updateLocked(managedRunId, (record) => {
        if (record.state !== "applying" || record.journalPath) {
          throw new Error("Managed stage registry can bind a prepared journal only once while applying")
        }
        this.assertReviewLease(record, reviewLeaseToken)
        if (inspected.journal.stageId !== record.stageId) throw new Error("Managed apply journal stage binding is inconsistent")
        return {
          ...record,
          journalPath: canonicalJournalPath,
          journalId,
          journalDigest,
          journalSemanticDigest: inspected.journal.semanticDigest,
          journalRootIdentity: inspected.rootIdentity,
          journalFileIdentity: inspected.fileIdentity,
        }
      })
    })
  }

  async retainJournal(
    managedRunId: string,
    journalPath: string,
    journalDigest: `sha256:${string}`,
    reviewLeaseToken?: string,
  ): Promise<void> {
    this.assertRunId(managedRunId)
    await this.withRunLock(managedRunId, async () => {
      if (!digestPattern.test(journalDigest)) throw new Error("Managed apply journal digest is invalid")
      const snapshot = await this.read(managedRunId)
      if (!snapshot || snapshot.record.state !== "applying") {
        throw new Error("Managed stage registry can retain a journal only from applying state")
      }
      const record = snapshot.record
      this.assertReviewLease(record, reviewLeaseToken)
      const presentedJournalPath = resolve(journalPath)
      const presentedJournalMetadata = await lstat(presentedJournalPath)
      if (!presentedJournalMetadata.isFile() || presentedJournalMetadata.isSymbolicLink()) {
        throw new Error("Managed apply journal path is unsafe")
      }
      const canonicalJournalPath = await realpath(presentedJournalPath)
      const inspected = record.journalPath
        ? await this.inspectMutableJournal(canonicalJournalPath, {
            expectedDigest: journalDigest,
            expectedRootIdentity: record.journalRootIdentity!,
            expectedJournalId: record.journalId!,
            expectedStageId: record.stageId,
            expectedSemanticDigest: record.journalSemanticDigest!,
          })
        : await this.inspectJournal(canonicalJournalPath, { expectedDigest: journalDigest })
      if (record.journalPath && canonicalJournalPath !== record.journalPath) {
        throw new Error("Managed apply journal path changed after durable registry binding")
      }
      if (inspected.journal.stageId !== record.stageId) throw new Error("Managed apply journal stage binding is inconsistent")
      await this.write({
        ...record,
        generation: record.generation + 1,
        state: "journal-retained",
        ownerLease: undefined,
        journalPath: canonicalJournalPath,
        journalId: inspected.journal.id,
        journalDigest,
        journalSemanticDigest: inspected.journal.semanticDigest,
        journalRootIdentity: inspected.rootIdentity,
        journalFileIdentity: inspected.fileIdentity,
        updatedAt: new Date().toISOString(),
      }, { expectedIdentity: snapshot.fileIdentity, expectedGeneration: record.generation })
    })
  }

  async complete(managedRunId: string, reviewLeaseToken?: string): Promise<void> {
    this.assertRunId(managedRunId)
    await this.withRunLock(managedRunId, async () => {
      const snapshot = await this.read(managedRunId)
      if (!snapshot) return
      const { record } = snapshot
      if (record.state === "review-required") this.assertReviewLease(record, reviewLeaseToken)
      if (await this.pathExists(record.stageTempRoot)) {
        throw new Error("Managed stage registry cannot complete while its staged workspace still exists")
      }
      if (record.journalPath && await this.pathExists(dirname(record.journalPath))) {
        throw new Error("Managed stage registry cannot complete while its apply journal still exists")
      }
      if (record.quarantinePath && await this.pathExists(record.quarantinePath)) {
        throw new Error("Managed stage registry cannot complete while its quarantined journal still exists")
      }
      await this.removeReviewManifest(record)
      await this.removeRecord(managedRunId, snapshot.fileIdentity)
    })
  }

  async discardReview(
    managedRunId: string,
    reviewLeaseToken?: string,
    options: { terminalAuthorized?: boolean } = {},
  ): Promise<void> {
    this.assertRunId(managedRunId)
    await this.withRunLock(managedRunId, async () => {
      let snapshot = await this.read(managedRunId)
      if (!snapshot) {
        if (options.terminalAuthorized) return
        throw new Error("Managed stage registry discard checkpoint is unavailable")
      }
      let { record } = snapshot
      if (record.state === "review-required") {
        if (options.terminalAuthorized) {
          // The governed portable terminal record is the discard authority;
          // the machine-local state is now only an idempotent cleanup cursor.
        } else if (reviewLeaseToken) {
          this.assertReviewLease(record, reviewLeaseToken)
        } else if (record.ownerLease && this.isProcessAlive(record.ownerLease.pid)) {
          throw new ManagedStageRecoveryError(
            "stage-active",
            `Managed stage review is still owned by live process ${record.ownerLease.pid}`,
          )
        }
        const now = new Date().toISOString()
        await this.write({
          ...record,
          generation: record.generation + 1,
          state: "discarding",
          ownerLease: undefined,
          discardOperation: { startedAt: now, localCleanupComplete: false },
          updatedAt: now,
        }, { expectedIdentity: snapshot.fileIdentity, expectedGeneration: record.generation })
        snapshot = await this.read(managedRunId)
        if (!snapshot) throw new Error("Managed stage registry discard checkpoint disappeared")
        record = snapshot.record
      }
      if (record.state !== "discarding" || !record.discardOperation) {
        throw new Error("Managed stage registry can discard only a review-required or discarding stage")
      }
      if (record.discardOperation.localCleanupComplete) return
      await this.removeStage(
        record.managedRunId, record.stageTempRoot, record.stageIdentity, record.stageWorkspaceIdentity,
      )
      await this.removeReviewManifest(record)
      await this.write({
        ...record,
        generation: record.generation + 1,
        reviewManifestPath: undefined,
        reviewManifestDigest: undefined,
        reviewManifestFileIdentity: undefined,
        discardOperation: { ...record.discardOperation, localCleanupComplete: true },
        updatedAt: new Date().toISOString(),
      }, { expectedIdentity: snapshot.fileIdentity, expectedGeneration: record.generation })
    })
  }

  async completeDiscard(managedRunId: string): Promise<void> {
    this.assertRunId(managedRunId)
    await this.withRunLock(managedRunId, async () => {
      const snapshot = await this.read(managedRunId)
      if (!snapshot) return
      const { record } = snapshot
      if (record.state !== "discarding") return
      if (!record.discardOperation?.localCleanupComplete) {
        throw new Error("Managed stage registry discard is not locally complete")
      }
      if (await this.pathExists(record.stageTempRoot) ||
          (record.reviewManifestPath && await this.pathExists(record.reviewManifestPath))) {
        throw new Error("Managed stage registry discard still has local review material")
      }
      await this.removeRecord(managedRunId, snapshot.fileIdentity)
    })
  }

  async retainedJournalDigest(managedRunId: string): Promise<`sha256:${string}` | undefined> {
    this.assertRunId(managedRunId)
    return this.withRunLock(managedRunId, async () => {
      const snapshot = await this.read(managedRunId)
      if (!snapshot) return undefined
      const { record } = snapshot
      if (record.state === "journal-retained" && record.journalPath && record.journalDigest &&
          record.journalId && record.journalRootIdentity) {
        await this.inspectMutableJournal(record.journalPath, {
          expectedDigest: record.journalDigest,
          expectedRootIdentity: record.journalRootIdentity,
          expectedJournalId: record.journalId,
          expectedStageId: record.stageId,
          expectedSemanticDigest: record.journalSemanticDigest!,
        })
        return record.journalDigest
      }
      if (record.state === "quarantined" && record.quarantinePath && record.journalDigest) {
        await this.inspectQuarantinedJournal(record, this.assertQuarantinePath(managedRunId, record.quarantinePath))
        return record.journalDigest
      }
      return undefined
    })
  }

  async disposeRetainedJournal(managedRunId: string, expectedDigest: `sha256:${string}`): Promise<void> {
    this.assertRunId(managedRunId)
    if (!digestPattern.test(expectedDigest)) throw new Error("Managed apply journal digest is invalid")
    const state = await this.withRunLock(managedRunId, async () => {
      const snapshot = await this.read(managedRunId)
      if (!snapshot) return "absent" as const
      const { record } = snapshot
      if (!["journal-retained", "quarantined", "disposing"].includes(record.state) || record.journalDigest !== expectedDigest ||
          !record.journalRootIdentity || !record.journalFileIdentity ||
          (record.state === "journal-retained" && !record.journalPath) ||
          (["quarantined", "disposing"].includes(record.state) && !record.quarantinePath)) {
        throw new Error("Managed stage registry has no exact retained apply journal to dispose")
      }
      return record.state
    })
    if (state === "absent") return
    if (state === "journal-retained") {
      const recovered = await this.recover(managedRunId)
      if (recovered.status !== "quarantined") {
        throw new Error("Managed retained apply journal did not enter verified quarantine before disposal")
      }
    }
    await this.disposeQuarantine(managedRunId)
  }

  async recover(
    managedRunId: string,
    options: { preserveReview?: boolean } = {},
  ): Promise<ManagedStageRecoveryResult> {
    this.assertRunId(managedRunId)
    return this.withRunLock(managedRunId, () => this.recoverLocked(managedRunId, options.preserveReview === true))
  }

  async disposeQuarantine(managedRunId: string): Promise<void> {
    this.assertRunId(managedRunId)
    await this.withRunLock(managedRunId, async () => {
      let snapshot = await this.read(managedRunId)
      if (!snapshot) return
      let { record } = snapshot
      if (!["quarantined", "disposing"].includes(record.state) || !record.quarantinePath) {
        throw new Error("Managed stage registry can dispose only an explicitly quarantined journal")
      }
      const quarantinePath = this.assertQuarantinePath(managedRunId, record.quarantinePath)
      const registryIdentity = await this.ensureSafeRegistryRoot()
      const quarantineRoot = await this.ensureQuarantineRoot(registryIdentity)
      const tombstoneRoot = await this.ensureTombstoneRoot(registryIdentity)
      const tombstone = this.assertDisposalTombstonePath(
        managedRunId,
        join(tombstoneRoot.path, `.quarantine-${managedRunId}`),
      )
      if (record.state === "quarantined") {
        await this.inspectQuarantinedJournal(record, quarantinePath)
        await this.write({
          ...record,
          generation: record.generation + 1,
          state: "disposing",
          disposalOperation: { tombstonePath: tombstone, startedAt: new Date().toISOString() },
          updatedAt: new Date().toISOString(),
        }, { expectedIdentity: snapshot.fileIdentity, expectedGeneration: record.generation })
        await this.beforeDisposalStep?.("after-disposal-record")
        snapshot = await this.read(managedRunId)
        if (!snapshot) throw new Error("Managed apply journal disposal record disappeared")
        record = snapshot.record
      }
      if (record.state !== "disposing" || record.disposalOperation?.tombstonePath !== tombstone) {
        throw new Error("Managed apply journal disposal checkpoint is inconsistent")
      }
      let quarantinePresent = false
      let tombstonePresent = false
      try {
        await this.inspectQuarantinedJournal(record, quarantinePath)
        quarantinePresent = true
      } catch (error) {
        if (!isNoEntry(error)) throw error
      }
      try {
        await this.inspectBoundJournalTree(record, tombstone, "Managed quarantined journal tombstone")
        tombstonePresent = true
      } catch (error) {
        try {
          await this.assertPrivateDirectory(
            tombstone,
            "Managed quarantined journal tombstone",
            0o700,
            record.journalRootIdentity,
          )
          await this.inspectBoundedPrivateTree(tombstone, maximumQuarantineTreeEntries, maximumQuarantineBytes)
          tombstonePresent = true
        } catch (partialError) {
          if (!isNoEntry(partialError)) throw partialError
          if (!isNoEntry(error)) throw error
        }
      }
      if (quarantinePresent && tombstonePresent) {
        throw new ManagedStageRecoveryError(
          "quarantine-conflict",
          "Managed apply journal exists in both quarantine and disposal tombstone locations",
        )
      }
      if (quarantinePresent) {
        await rename(quarantinePath, tombstone)
        await this.syncDirectory(quarantineRoot.path, quarantineRoot.identity, "Managed stage quarantine root", 0o700, true)
        await this.syncDirectory(tombstoneRoot.path, tombstoneRoot.identity, "Managed stage tombstone root", 0o700, true)
        await this.inspectBoundJournalTree(record, tombstone, "Managed quarantined journal tombstone")
        tombstonePresent = true
        await this.beforeDisposalStep?.("after-disposal-rename")
      }
      if (tombstonePresent) {
        await rm(tombstone, { recursive: true })
      }
      await this.syncDirectory(tombstoneRoot.path, tombstoneRoot.identity, "Managed stage tombstone root", 0o700, true)
      await this.syncDirectory(quarantineRoot.path, quarantineRoot.identity, "Managed stage quarantine root", 0o700, true)
      await this.beforeDisposalStep?.("after-disposal-remove")
      await this.removeRecord(managedRunId, snapshot.fileIdentity)
    })
  }

  private async updateLocked(
    managedRunId: string,
    mutate: (record: ManagedStageRegistryRecord) => ManagedStageRegistryRecord,
  ): Promise<void> {
    const snapshot = await this.read(managedRunId)
    if (!snapshot) throw new Error("Managed stage registry record is unavailable")
    const next = mutate(snapshot.record)
    await this.write(
      { ...next, generation: snapshot.record.generation + 1, updatedAt: new Date().toISOString() },
      { expectedIdentity: snapshot.fileIdentity, expectedGeneration: snapshot.record.generation },
    )
  }

  private async recoverLocked(managedRunId: string, preserveReview = false): Promise<ManagedStageRecoveryResult> {
    let snapshot = await this.read(managedRunId)
    if (!snapshot) return { status: "absent" }
    let { record } = snapshot
    if (record.state === "quarantined") {
      const quarantinePath = this.assertQuarantinePath(managedRunId, record.quarantinePath!)
      try {
        const journal = await this.inspectQuarantinedJournal(record, quarantinePath)
        await this.reconcileSourceResidues(record, journal)
      } catch (error) {
        if (isNoEntry(error)) {
          throw new ManagedStageRecoveryError(
            "quarantine-missing",
            "Managed apply journal quarantine is missing; recovery is incomplete",
          )
        }
        throw error
      }
      return { status: "quarantined", quarantinePath, journalDigest: record.journalDigest }
    }
    if (record.state === "disposing") {
      throw new Error("Managed apply journal disposal is incomplete and must be resumed explicitly")
    }

    const recoverableNoJournalReview = !record.journalPath && (
      record.state === "review-required" ||
      record.state === "applying" ||
      (record.state === "recovering" &&
        ["applying", "review-required"].includes(record.recoveryOperation?.fromState ?? ""))
    )
    if (preserveReview && recoverableNoJournalReview) {
      if (record.ownerLease && this.isProcessAlive(record.ownerLease.pid)) {
        throw new ManagedStageRecoveryError(
          "stage-active",
          `Managed stage is still owned by live process ${record.ownerLease.pid}; recovery is deferred`,
        )
      }
      await this.validateRecoverableReview(record)
      const now = new Date().toISOString()
      await this.write({
        ...record,
        generation: record.generation + 1,
        state: "review-required",
        ownerLease: undefined,
        recoveryOperation: undefined,
        updatedAt: now,
      }, { expectedIdentity: snapshot.fileIdentity, expectedGeneration: record.generation })
      return { status: "review-restored" }
    }

    if (record.state !== "recovering") {
      if (record.ownerLease && this.isProcessAlive(record.ownerLease.pid)) {
        throw new ManagedStageRecoveryError(
          "stage-active",
          `Managed stage is still owned by live process ${record.ownerLease.pid}; recovery is deferred`,
        )
      }
      if (record.state === "applying" && record.journalPath) {
        snapshot = await this.refreshMutableJournalBinding(snapshot)
        record = snapshot.record
      }
      if (!["staging", "review-required", "applying", "journal-retained"].includes(record.state)) {
        throw new Error("Managed stage recovery state changed while its journal binding was refreshed")
      }
      const fromState = record.state as "staging" | "review-required" | "applying" | "journal-retained"
      const operationId = randomUUID()
      const now = new Date().toISOString()
      await this.write({
        ...record,
        generation: record.generation + 1,
        state: "recovering",
        ownerLease: undefined,
        recoveryOperation: {
          id: operationId,
          fromState,
          startedAt: now,
        },
        updatedAt: now,
      }, { expectedIdentity: snapshot.fileIdentity, expectedGeneration: record.generation })
      snapshot = await this.read(managedRunId)
      if (!snapshot || snapshot.record.state !== "recovering" || snapshot.record.recoveryOperation?.id !== operationId) {
        throw new Error("Managed stage recovery operation was not durably claimed")
      }
      record = snapshot.record
    }

    if (record.journalPath) {
      let inspected: Awaited<ReturnType<ManagedStageRegistry["inspectJournal"]>> | undefined
      try {
        inspected = await this.inspectJournal(record.journalPath, {
          expectedDigest: record.journalDigest!,
          expectedRootIdentity: record.journalRootIdentity!,
          expectedFileIdentity: record.journalFileIdentity!,
          expectedSemanticDigest: record.journalSemanticDigest!,
        })
      } catch (error) {
        // A previous recovery can only move the journal to quarantine after
        // residue reconciliation completed. Let quarantineJournal verify that
        // exact moved identity when the original path is already absent.
        if (!isNoEntry(error)) throw error
      }
      if (inspected) await this.reconcileSourceResidues(record, inspected.journal)
      const quarantinePath = await this.quarantineJournal(record)
      await this.removeStage(
        record.managedRunId, record.stageTempRoot, record.stageIdentity, record.stageWorkspaceIdentity,
      )
      await this.removeReviewManifest(record)
      await this.write({
        ...record,
        generation: record.generation + 1,
        state: "quarantined",
        journalPath: undefined,
        quarantinePath,
        reviewManifestPath: undefined,
        reviewManifestDigest: undefined,
        reviewManifestFileIdentity: undefined,
        recoveryOperation: undefined,
        updatedAt: new Date().toISOString(),
      }, { expectedIdentity: snapshot.fileIdentity, expectedGeneration: record.generation })
      return { status: "quarantined", quarantinePath, journalDigest: record.journalDigest }
    }

    await this.removeStage(
      record.managedRunId, record.stageTempRoot, record.stageIdentity, record.stageWorkspaceIdentity,
    )
    await this.removeReviewManifest(record)
    await this.removeRecord(managedRunId, snapshot.fileIdentity)
    return { status: "cleaned" }
  }

  private async validateRecoverableReview(record: ManagedStageRegistryRecord): Promise<void> {
    await this.assertStageRoot(record.stageTempRoot, record.stageIdentity)
    await this.assertPrivateDirectory(
      join(record.stageTempRoot, "workspace"),
      "Managed workspace stage",
      0o700,
      record.stageWorkspaceIdentity,
    )
    const manifest = await this.readReviewManifest(record)
    const validator = new WorkspaceStagingService({ tempParent: this.tempParent })
    await validator.rehydrate(manifest.stage, manifest.inspection, {
      expectedTempRootIdentity: record.stageIdentity,
      expectedRootIdentity: record.stageWorkspaceIdentity,
    })
    await this.assertStageRoot(record.stageTempRoot, record.stageIdentity)
    await this.assertPrivateDirectory(
      join(record.stageTempRoot, "workspace"),
      "Managed workspace stage",
      0o700,
      record.stageWorkspaceIdentity,
    )
  }

  private sourceResiduePath(root: string, value: string): string {
    if (!safeJournalRelativePath(value)) throw new Error("Managed apply source residue path is unsafe")
    const target = resolve(root, ...value.split("/"))
    if (!contained(root, target)) throw new Error("Managed apply source residue escapes its workspace")
    return target
  }

  private async assertSafeSourceAncestors(
    root: string,
    target: string,
    expectedRootIdentity: FileIdentity,
  ): Promise<boolean> {
    const difference = relative(root, target)
    if (!difference || difference === ".." || difference.startsWith(".." + sep) || isAbsolute(difference)) {
      throw new Error("Managed apply source residue escapes its workspace")
    }
    const rootMetadata = await lstat(root, { bigint: true })
    if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink() ||
        !sameIdentity(identityOf(rootMetadata), expectedRootIdentity) || await realpath(root) !== root) {
      throw new ManagedStageRecoveryError("source-residue-conflict", "Managed apply source workspace identity changed")
    }
    let current = root
    for (const segment of difference.split(sep).slice(0, -1)) {
      current = join(current, segment)
      let metadata
      try {
        metadata = await lstat(current)
      } catch (error) {
        if (isNoEntry(error)) return false
        throw error
      }
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        throw new ManagedStageRecoveryError(
          "source-residue-conflict",
          "Managed apply source residue ancestor is unsafe: " + relative(root, current),
        )
      }
    }
    return true
  }

  private async reconcileSourceResidues(
    record: ManagedStageRegistryRecord,
    journal: ParsedApplyJournal,
  ): Promise<void> {
    const sourceMetadata = await lstat(record.sourceWorkspacePath, { bigint: true })
    const sourceRoot = await realpath(record.sourceWorkspacePath)
    if (!sourceMetadata.isDirectory() || sourceMetadata.isSymbolicLink() || sourceRoot !== record.sourceWorkspacePath ||
        !sameIdentity(identityOf(sourceMetadata), record.sourceWorkspaceIdentity)) {
      throw new Error("Managed apply source workspace identity changed")
    }
    const appliedRequiredDirectories = new Set<string>()
    for (const entry of journal.entries) {
      if (entry.sourceTemporary &&
          await this.sourceFileMatchesIntent(sourceRoot, record.sourceWorkspaceIdentity, entry.path, entry.sourceTemporary)) {
        const segments = entry.path.split("/")
        for (let index = 1; index < segments.length; index += 1) {
          appliedRequiredDirectories.add(segments.slice(0, index).join("/"))
        }
      }
    }
    for (const entry of [...journal.entries].reverse()) {
      let reconciled = true
      if (entry.sourceTemporary) reconciled = await this.removeExactSourceTemporary(
        sourceRoot, record.sourceWorkspaceIdentity, entry.sourceTemporary,
      ) && reconciled
      if (entry.rollbackTemporary) reconciled = await this.removeExactSourceTemporary(
        sourceRoot, record.sourceWorkspaceIdentity, entry.rollbackTemporary,
      ) && reconciled
      for (const directory of [...entry.createdDirectories].reverse()) {
        reconciled = await this.removeExactEmptySourceDirectory(
          sourceRoot,
          record.sourceWorkspaceIdentity,
          directory.temporaryPath,
          directory,
          false,
        ) && reconciled
        const directoryRequiredByAppliedEffect = appliedRequiredDirectories.has(directory.path)
        if (!directoryRequiredByAppliedEffect && directory.device && directory.inode) {
          reconciled = await this.removeExactEmptySourceDirectory(
            sourceRoot,
            record.sourceWorkspaceIdentity,
            directory.path,
            directory,
            false,
          ) && reconciled
        } else if (!directoryRequiredByAppliedEffect && (!directory.device || !directory.inode)) {
          try {
            const unboundDirectory = this.sourceResiduePath(sourceRoot, directory.path)
            if (await this.assertSafeSourceAncestors(
              sourceRoot, unboundDirectory, record.sourceWorkspaceIdentity,
            )) {
              await lstat(unboundDirectory)
              reconciled = false
            }
          } catch (error) {
            if (!isNoEntry(error)) throw error
          }
        }
      }
      if (!reconciled) {
        throw new ManagedStageRecoveryError(
          "source-residue-conflict",
          `Managed apply source residue changed or became nonempty at ${entry.path}; recovery remains pending`,
        )
      }
    }
  }

  private sameStableSourceMetadata(left: BigIntStats, right: BigIntStats): boolean {
    return left.isFile() && right.isFile() && !left.isSymbolicLink() && !right.isSymbolicLink() &&
      left.nlink === 1n && right.nlink === 1n && left.dev === right.dev && left.ino === right.ino &&
      left.size === right.size && left.mode === right.mode && left.mtimeNs === right.mtimeNs &&
      left.ctimeNs === right.ctimeNs
  }

  private async readStableSourceFile(
    path: string,
    label: string,
    maximumBytes: number,
    expectedMetadata?: BigIntStats,
  ): Promise<{ bytes: Buffer; metadata: BigIntStats }> {
    const before = await lstat(path, { bigint: true })
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n) throw new Error(`${label} is unsafe`)
    if (before.size > BigInt(maximumBytes)) throw new Error(`${label} exceeds its bounded size`)
    if (expectedMetadata && !this.sameStableSourceMetadata(before, expectedMetadata)) {
      throw new Error(`${label} changed before final validation`)
    }
    const handle = await open(path, constants.O_RDONLY | this.noFollowOpenFlag())
    try {
      const opened = await handle.stat({ bigint: true })
      if (!this.sameStableSourceMetadata(before, opened)) throw new Error(`${label} changed before it could be opened`)
      const bytes = await this.readExactBounded(handle, Number(opened.size), maximumBytes, label)
      const after = await handle.stat({ bigint: true })
      const pathAfter = await lstat(path, { bigint: true })
      if (!this.sameStableSourceMetadata(opened, after) || !this.sameStableSourceMetadata(after, pathAfter)) {
        throw new Error(`${label} changed while it was being read`)
      }
      return { bytes, metadata: after }
    } finally {
      await handle.close()
    }
  }

  private async sourceFileMatchesIntent(
    root: string,
    rootIdentity: FileIdentity,
    relativePath: string,
    intent: ParsedApplyJournalTemporaryIntent,
  ): Promise<boolean> {
    const path = this.sourceResiduePath(root, relativePath)
    if (!(await this.assertSafeSourceAncestors(root, path, rootIdentity))) return false
    let captured
    try {
      captured = await this.readStableSourceFile(path, `Managed apply source ${relativePath}`, 16 * 1024 * 1024)
    } catch (error) {
      if (isNoEntry(error)) return false
      throw error
    }
    if (!(await this.assertSafeSourceAncestors(root, path, rootIdentity))) return false
    return captured.bytes.length === intent.size && digestBytes(captured.bytes) === intent.digest &&
      Number(captured.metadata.mode & 0o777n) === intent.mode
  }

  private async removeExactSourceTemporary(
    root: string,
    rootIdentity: FileIdentity,
    intent: ParsedApplyJournalTemporaryIntent,
  ): Promise<boolean> {
    const path = this.sourceResiduePath(root, intent.path)
    if (!(await this.assertSafeSourceAncestors(root, path, rootIdentity))) return true
    let captured
    try {
      captured = await this.readStableSourceFile(path, `Managed apply temporary ${intent.path}`, 16 * 1024 * 1024)
    } catch (error) {
      if (isNoEntry(error)) return true
      throw error
    }
    const before = captured.metadata
    if (!intent.device || !intent.inode ||
        before.dev.toString() !== intent.device || before.ino.toString() !== intent.inode) return false
    if (captured.bytes.length !== intent.size || Number(before.mode & 0o777n) !== intent.mode ||
        digestBytes(captured.bytes) !== intent.digest) return false
    if (!(await this.assertSafeSourceAncestors(root, path, rootIdentity))) return false
    const final = await this.readStableSourceFile(
      path,
      `Managed apply temporary ${intent.path}`,
      16 * 1024 * 1024,
      before,
    )
    if (!final.bytes.equals(captured.bytes)) return false
    await unlink(path)
    await this.syncSourceParent(path)
    return true
  }

  private async removeExactEmptySourceDirectory(
    root: string,
    rootIdentity: FileIdentity,
    relativePath: string,
    intent: ParsedApplyJournalDirectoryIntent,
    allowUnboundTemporary: boolean,
  ): Promise<boolean> {
    const path = this.sourceResiduePath(root, relativePath)
    if (!(await this.assertSafeSourceAncestors(root, path, rootIdentity))) return true
    let metadata
    try {
      metadata = await lstat(path, { bigint: true })
    } catch (error) {
      if (isNoEntry(error)) return true
      throw error
    }
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) return false
    if (intent.device && metadata.dev.toString() !== intent.device) return false
    if (intent.inode && metadata.ino.toString() !== intent.inode) return false
    if ((!intent.device || !intent.inode) && !allowUnboundTemporary) return false
    if (!await this.isDirectoryEmpty(path)) return false
    if (!(await this.assertSafeSourceAncestors(root, path, rootIdentity))) return false
    const final = await lstat(path, { bigint: true })
    if (final.dev !== metadata.dev || final.ino !== metadata.ino || !final.isDirectory() || final.isSymbolicLink() ||
        !await this.isDirectoryEmpty(path)) return false
    await rmdir(path)
    await this.syncSourceParent(path)
    return true
  }

  private async syncSourceParent(path: string): Promise<void> {
    if (this.hostSecurity.kind === "windows") return
    const parent = dirname(path)
    const handle = await open(parent, constants.O_RDONLY | this.hostSecurity.directoryOpenFlag)
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
  }

  private async refreshMutableJournalBinding(snapshot: RegistryRecordSnapshot): Promise<RegistryRecordSnapshot> {
    const record = snapshot.record
    if (!record.journalPath || !record.journalId || !record.journalRootIdentity) return snapshot
    const inspected = await this.inspectMutableJournal(record.journalPath, {
      expectedRootIdentity: record.journalRootIdentity,
      expectedJournalId: record.journalId,
      expectedStageId: record.stageId,
      expectedSemanticDigest: record.journalSemanticDigest!,
    })
    if (record.journalDigest === inspected.digest && record.journalFileIdentity &&
        sameIdentity(record.journalFileIdentity, inspected.fileIdentity)) {
      return snapshot
    }
    await this.write({
      ...record,
      generation: record.generation + 1,
      journalDigest: inspected.digest,
      journalFileIdentity: inspected.fileIdentity,
      updatedAt: new Date().toISOString(),
    }, { expectedIdentity: snapshot.fileIdentity, expectedGeneration: record.generation })
    const refreshed = await this.read(record.managedRunId)
    if (!refreshed) throw new Error("Managed apply journal binding disappeared during recovery")
    return refreshed
  }

  private async withRunLock<T>(managedRunId: string, operation: () => Promise<T>): Promise<T> {
    this.assertRunId(managedRunId)
    const release = await this.acquireRunLock(managedRunId)
    try {
      return await operation()
    } finally {
      await release()
    }
  }

  private async acquireRunLock(managedRunId: string): Promise<() => Promise<void>> {
    const lockRoot = await this.ensureLockRoot()
    const lockPath = join(lockRoot.path, `${managedRunId}.lock`)
    const deadline = Date.now() + this.lockWaitMs
    const token = randomUUID()
    const lockRecord: RunLockRecord = {
      schemaVersion: 1,
      managedRunId,
      token,
      pid: process.pid,
      acquiredAt: new Date().toISOString(),
    }
    const bytes = Buffer.from(`${JSON.stringify(lockRecord)}\n`)
    while (Date.now() <= deadline) {
      try {
        let handle: FileHandle | undefined
        let createdIdentity: FileIdentity | undefined
        let preservePartial = false
        try {
          handle = await open(
            lockPath,
            constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | this.noFollowOpenFlag(),
            0o600,
          )
          createdIdentity = identityOf(await handle.stat({ bigint: true }))
          try {
            await this.afterRunLockCreate?.()
          } catch (error) {
            if (error instanceof WorkspaceProcessDeathSimulationError) preservePartial = true
            throw error
          }
          await handle.chmod(0o600)
          await handle.writeFile(bytes)
          await handle.sync()
          const metadata = await handle.stat({ bigint: true })
          this.assertOwnedPrivateMetadata(metadata, "Managed stage registry run lock", "file", 0o600, true)
          await handle.close()
          handle = undefined
        } catch (error) {
          let cleanupError: unknown
          try {
            await handle?.close()
            if (createdIdentity && !preservePartial) {
              await this.cleanupFailedRunLock(lockPath, lockRoot, managedRunId, token, createdIdentity)
            }
          } catch (caught) {
            cleanupError = caught
          }
          if (cleanupError) {
            throw new AggregateError([error, cleanupError], "Managed run lock publication and cleanup both failed")
          }
          throw error
        }
        await this.syncDirectory(lockRoot.path, lockRoot.identity, "Managed stage registry lock root", 0o700, true)
        const acquired = await this.readSafeFile(lockPath, "Managed stage registry run lock", 0o600, maximumRecordBytes)
        if (!acquired.bytes.equals(bytes)) throw new Error("Managed stage registry run lock changed during acquisition")
        return async () => this.releaseRunLock(lockPath, lockRoot, acquired.identity, token)
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error
        try {
          await this.reapStaleRunLock(lockPath, lockRoot, managedRunId)
        } catch (inspectionError) {
          if (!(isNoEntry(inspectionError) ||
              (inspectionError instanceof Error && /run lock (?:was replaced|changed)/i.test(inspectionError.message)))) {
            throw inspectionError
          }
        }
        if (Date.now() > deadline) break
        await new Promise<void>((resolveDelay) => {
          setTimeout(resolveDelay, 20)
        })
      }
    }
    throw new ManagedStageRecoveryError("lock-timeout", `Timed out waiting for Managed Run lock ${managedRunId}`)
  }

  private async reapStaleRunLock(
    lockPath: string,
    lockRoot: { path: string; identity: FileIdentity },
    managedRunId: string,
  ): Promise<void> {
    const snapshot = await this.readSafeFile(lockPath, "Managed stage registry run lock", 0o600, maximumRecordBytes)
    let lock: RunLockRecord | undefined
    try {
      lock = this.parseRunLock(snapshot.bytes, managedRunId)
    } catch {
      const metadata = await lstat(lockPath, { bigint: true })
      if (!sameIdentity(identityOf(metadata), snapshot.identity) ||
          Date.now() - Number(metadata.mtimeMs) < this.staleLockMs) return
    }
    if (lock && (Date.now() - Date.parse(lock.acquiredAt) < this.staleLockMs || this.isProcessAlive(lock.pid))) return
    const tombstone = join(lockRoot.path, `.stale-${managedRunId}-${randomUUID()}.lock`)
    try {
      await rename(lockPath, tombstone)
    } catch (error) {
      if (isNoEntry(error)) return
      throw error
    }
    const moved = await this.readSafeFile(
      tombstone,
      "Managed stage registry stale run lock",
      0o600,
      maximumRecordBytes,
      snapshot.identity,
    )
    if (lock) {
      const movedLock = this.parseRunLock(moved.bytes, managedRunId)
      if (movedLock.token !== lock.token) throw new Error("Managed stage registry stale lock identity changed during reclamation")
    }
    await unlink(tombstone)
    await this.syncDirectory(lockRoot.path, lockRoot.identity, "Managed stage registry lock root", 0o700, true)
  }

  private async cleanupFailedRunLock(
    lockPath: string,
    lockRoot: { path: string; identity: FileIdentity },
    managedRunId: string,
    token: string,
    expectedIdentity: FileIdentity,
  ): Promise<void> {
    let metadata
    try {
      metadata = await lstat(lockPath, { bigint: true })
    } catch (error) {
      if (isNoEntry(error)) return
      throw error
    }
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1n ||
        !sameIdentity(identityOf(metadata), expectedIdentity)) {
      throw new Error("Managed stage registry failed run lock was replaced and was preserved")
    }
    const tombstone = join(lockRoot.path, `.failed-${managedRunId}-${token}.lock`)
    try {
      await lstat(tombstone)
      throw new Error("Managed stage registry failed run lock tombstone already exists")
    } catch (error) {
      if (!isNoEntry(error)) throw error
    }
    await rename(lockPath, tombstone)
    await this.readSafeFile(
      tombstone,
      "Managed stage registry failed run lock",
      Number(metadata.mode & 0o777n),
      maximumRecordBytes,
      expectedIdentity,
    )
    await unlink(tombstone)
    await this.syncDirectory(lockRoot.path, lockRoot.identity, "Managed stage registry lock root", 0o700, true)
  }

  private async releaseRunLock(
    lockPath: string,
    lockRoot: { path: string; identity: FileIdentity },
    expectedIdentity: FileIdentity,
    token: string,
  ): Promise<void> {
    const snapshot = await this.readSafeFile(
      lockPath,
      "Managed stage registry run lock",
      0o600,
      maximumRecordBytes,
      expectedIdentity,
    )
    const lock = this.parseRunLock(snapshot.bytes)
    if (lock.token !== token || lock.pid !== process.pid) throw new Error("Managed stage registry cannot release a lock it does not own")
    const tombstone = join(lockRoot.path, `.released-${lock.managedRunId}-${randomUUID()}.lock`)
    await rename(lockPath, tombstone)
    await this.readSafeFile(
      tombstone,
      "Managed stage registry released run lock",
      0o600,
      maximumRecordBytes,
      expectedIdentity,
    )
    await unlink(tombstone)
    await this.syncDirectory(lockRoot.path, lockRoot.identity, "Managed stage registry lock root", 0o700, true)
  }

  private parseRunLock(bytes: Buffer, expectedManagedRunId?: string): RunLockRecord {
    let parsed: unknown
    try { parsed = JSON.parse(bytes.toString("utf8")) } catch { throw new Error("Managed stage registry run lock is malformed") }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Managed stage registry run lock is malformed")
    const value = parsed as Record<string, unknown>
    if (Object.keys(value).length !== 5 || value.schemaVersion !== 1 || typeof value.managedRunId !== "string" ||
        !runIdPattern.test(value.managedRunId) || typeof value.token !== "string" || !runIdPattern.test(value.token) ||
        !Number.isSafeInteger(value.pid) || Number(value.pid) < 1 || typeof value.acquiredAt !== "string" ||
        !Number.isFinite(Date.parse(value.acquiredAt))) {
      throw new Error("Managed stage registry run lock is malformed")
    }
    if (expectedManagedRunId && value.managedRunId !== expectedManagedRunId) {
      throw new Error("Managed stage registry run lock identity is inconsistent")
    }
    return value as unknown as RunLockRecord
  }

  private async read(managedRunId: string): Promise<RegistryRecordSnapshot | undefined> {
    const rootIdentity = await this.ensureSafeRegistryRoot()
    const path = this.recordPath(managedRunId)
    let file: SafeFileSnapshot
    try {
      file = await this.readSafeFile(path, "Managed stage registry record", 0o600, maximumRecordBytes)
    } catch (error) {
      if (isNoEntry(error)) {
        await this.assertSafeRegistryRoot(rootIdentity)
        return undefined
      }
      throw error
    }
    await this.assertSafeRegistryRoot(rootIdentity)
    let parsed: unknown
    try {
      parsed = JSON.parse(file.bytes.toString("utf8"))
    } catch {
      throw new Error("Managed stage registry record is malformed")
    }
    const record = parseRecord(parsed)
    if (record.managedRunId !== managedRunId) throw new Error("Managed stage registry record identity does not match its path")
    this.assertRecordPaths(record)
    return { record, fileIdentity: file.identity }
  }

  private async writePrivateFileAtomically(
    path: string,
    temporary: string,
    serialized: Buffer,
    maximumBytes: number,
    label: string,
    parent: { path: string; identity: FileIdentity; label: string },
    beforeCommit?: () => void | Promise<void>,
    afterRename?: () => void | Promise<void>,
  ): Promise<SafeFileSnapshot> {
    let handle: FileHandle | undefined
    let createdIdentity: FileIdentity | undefined
    let durableMetadata: BigIntStats | undefined
    let primaryError: unknown
    let persisted: SafeFileSnapshot | undefined
    try {
      handle = await open(
        temporary,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | this.noFollowOpenFlag(),
        0o600,
      )
      createdIdentity = identityOf(await handle.stat({ bigint: true }))
      await handle.chmod(0o600)
      await handle.writeFile(serialized)
      await handle.sync()
      durableMetadata = await handle.stat({ bigint: true })
      this.assertOwnedPrivateMetadata(durableMetadata, `${label} temporary file`, "file", 0o600, true)
      if (!sameIdentity(identityOf(durableMetadata), createdIdentity) || durableMetadata.size !== BigInt(serialized.length)) {
        throw new Error(`${label} temporary file changed while it was written`)
      }
      await handle.close()
      handle = undefined
      const verified = await this.readSafeFile(
        temporary,
        `${label} temporary file`,
        0o600,
        maximumBytes,
        createdIdentity,
      )
      if (!verified.bytes.equals(serialized)) throw new Error(`${label} temporary content changed`)
      await beforeCommit?.()
      const finalMetadata = await lstat(temporary, { bigint: true })
      this.assertOwnedPrivateMetadata(finalMetadata, `${label} temporary file`, "file", 0o600, true)
      if (!sameIdentity(identityOf(finalMetadata), createdIdentity) || !durableMetadata ||
          finalMetadata.size !== durableMetadata.size || finalMetadata.mode !== durableMetadata.mode ||
          finalMetadata.mtimeNs !== durableMetadata.mtimeNs || finalMetadata.ctimeNs !== durableMetadata.ctimeNs) {
        throw new Error(`${label} temporary file changed immediately before replacement`)
      }
      await rename(temporary, path)
      await afterRename?.()
      await this.syncDirectory(parent.path, parent.identity, parent.label, 0o700, true)
      persisted = await this.readSafeFile(path, label, 0o600, maximumBytes, createdIdentity)
      if (!persisted.bytes.equals(serialized)) throw new Error(`${label} changed during durable replacement`)
    } catch (error) {
      primaryError = error
    }

    let cleanupError: unknown
    try {
      await handle?.close()
      if (createdIdentity) {
        let temporarySnapshot: SafeFileSnapshot | undefined
        try {
          temporarySnapshot = await this.readSafeFile(
            temporary,
            `${label} temporary file`,
            0o600,
            maximumBytes,
            createdIdentity,
          )
        } catch (error) {
          if (!isNoEntry(error)) throw error
        }
        if (temporarySnapshot) {
          if (!durableMetadata || !temporarySnapshot.bytes.equals(serialized)) {
            throw new Error(`${label} temporary changed before exact-owned cleanup and was preserved`)
          }
          await unlink(temporary)
          await this.syncDirectory(parent.path, parent.identity, parent.label, 0o700, true)
        }
      }
    } catch (error) {
      cleanupError = error
    }
    if (primaryError && cleanupError) {
      throw new AggregateError([primaryError, cleanupError], `${label} write and exact-owned cleanup both failed`)
    }
    if (primaryError) throw primaryError
    if (cleanupError) throw cleanupError
    if (!persisted) throw new Error(`${label} persistence did not produce a bound file`)
    return persisted
  }

  private async write(
    unparsedRecord: ManagedStageRegistryRecord,
    expectation: { mustBeAbsent: true } | { expectedIdentity: FileIdentity; expectedGeneration: number },
  ): Promise<void> {
    const record = parseRecord(unparsedRecord)
    this.assertRecordPaths(record)
    const rootIdentity = await this.ensureSafeRegistryRoot()
    const path = this.recordPath(record.managedRunId)
    await this.assertRecordExpectation(path, expectation)
    const temporary = join(this.root, `.${record.managedRunId}.${randomUUID()}.tmp`)
    const serialized = Buffer.from(`${JSON.stringify(record)}\n`)
    try {
      await this.writePrivateFileAtomically(
        path,
        temporary,
        serialized,
        maximumRecordBytes,
        "Managed stage registry record",
        { path: this.root, identity: rootIdentity, label: "Managed stage registry root" },
        async () => {
          await this.assertSafeRegistryRoot(rootIdentity)
          await this.assertRecordExpectation(path, expectation)
        },
        () => this.afterRecordRename?.({
          managedRunId: record.managedRunId,
          generation: record.generation,
          state: record.state,
        }),
      )
      await this.assertSafeRegistryRoot(rootIdentity)
    } catch (error) {
      let exactCommit = false
      try {
        await this.assertSafeRegistryRoot(rootIdentity)
        const committed = await this.readSafeFile(
          path,
          "Managed stage registry record",
          0o600,
          maximumRecordBytes,
        )
        exactCommit = committed.bytes.equals(serialized)
      } catch {
        exactCommit = false
      }
      if (!exactCommit) throw error
    }
  }

  private async assertRecordExpectation(
    path: string,
    expectation: { mustBeAbsent: true } | { expectedIdentity: FileIdentity; expectedGeneration: number },
  ): Promise<void> {
    try {
      const snapshot = await this.readSafeFile(path, "Managed stage registry record", 0o600, maximumRecordBytes)
      if ("mustBeAbsent" in expectation) throw new Error("Managed stage registry record already exists")
      if (!sameIdentity(snapshot.identity, expectation.expectedIdentity)) {
        throw new Error("Managed stage registry record was replaced during the operation")
      }
      let parsed: unknown
      try { parsed = JSON.parse(snapshot.bytes.toString("utf8")) } catch { throw new Error("Managed stage registry record is malformed") }
      if (parseRecord(parsed).generation !== expectation.expectedGeneration) {
        throw new Error("Managed stage registry record generation changed during the operation")
      }
    } catch (error) {
      if (isNoEntry(error)) {
        if ("mustBeAbsent" in expectation) return
        throw new Error("Managed stage registry record disappeared during the operation")
      }
      throw error
    }
  }

  private async removeRecord(managedRunId: string, expectedIdentity: FileIdentity): Promise<void> {
    const rootIdentity = await this.ensureSafeRegistryRoot()
    const path = this.recordPath(managedRunId)
    const existing = await this.readSafeFile(path, "Managed stage registry record", 0o600, maximumRecordBytes, expectedIdentity)
    const tombstoneRoot = await this.ensureTombstoneRoot(rootIdentity)
    const tombstone = join(tombstoneRoot.path, `.record-${managedRunId}-${randomUUID()}`)
    await rename(path, tombstone)
    await this.readSafeFile(
      tombstone,
      "Managed stage registry record tombstone",
      0o600,
      maximumRecordBytes,
      existing.identity,
    )
    await unlink(tombstone)
    await this.syncDirectory(tombstoneRoot.path, tombstoneRoot.identity, "Managed stage tombstone root", 0o700, true)
    await this.syncDirectory(this.root, rootIdentity, "Managed stage registry root", 0o700, true)
    try {
      await lstat(path)
      throw new Error("Managed stage registry record was replaced while it was being removed")
    } catch (error) {
      if (!isNoEntry(error)) throw error
    }
    await this.assertSafeRegistryRoot(rootIdentity)
  }

  private async quarantineJournal(record: ManagedStageRegistryRecord): Promise<string> {
    const journalPath = record.journalPath!
    const journalRootIdentity = record.journalRootIdentity!
    const journalFileIdentity = record.journalFileIdentity!
    const journalDigest = record.journalDigest!
    const registryIdentity = await this.ensureSafeRegistryRoot()
    const quarantine = await this.ensureQuarantineRoot(registryIdentity)
    const quarantinePath = this.assertQuarantinePath(record.managedRunId, join(quarantine.path, record.managedRunId))
    const journalRoot = dirname(journalPath)

    let journalPresent = true
    try {
      await this.inspectJournal(journalPath, {
        expectedDigest: journalDigest,
        expectedRootIdentity: journalRootIdentity,
        expectedFileIdentity: journalFileIdentity,
        expectedSemanticDigest: record.journalSemanticDigest!,
      })
    } catch (error) {
      if (!isNoEntry(error)) throw error
      journalPresent = false
    }
    let quarantinePresent = true
    try {
      await this.inspectQuarantinedJournal(record, quarantinePath)
    } catch (error) {
      if (!isNoEntry(error)) throw error
      quarantinePresent = false
    }
    if (journalPresent && quarantinePresent) {
      throw new ManagedStageRecoveryError(
        "quarantine-conflict",
        "Managed apply journal exists in both retained and quarantine locations; recovery is ambiguous",
      )
    }
    if (!journalPresent && !quarantinePresent) {
      throw new ManagedStageRecoveryError(
        "journal-missing",
        "Managed apply journal is missing; recovery cannot claim successful quarantine",
      )
    }
    if (journalPresent) {
      const parentIdentity = await this.assertSafeTempParent()
      await this.assertSafeRegistryRoot(registryIdentity)
      await this.assertPrivateDirectory(quarantine.path, "Managed stage quarantine root", 0o700, quarantine.identity)
      await this.assertQuarantineCapacity(quarantine.path, journalRoot)
      try {
        await rename(journalRoot, quarantinePath)
      } catch (error) {
        if (!isNoEntry(error)) throw error
        try {
          await this.inspectQuarantinedJournal(record, quarantinePath)
        } catch (quarantineError) {
          if (isNoEntry(quarantineError)) {
            throw new ManagedStageRecoveryError(
              "journal-missing",
              "Managed apply journal disappeared before quarantine could be verified",
            )
          }
          throw quarantineError
        }
      }
      await this.syncDirectory(this.tempParent, parentIdentity, "Managed stage temporary parent")
      await this.syncDirectory(quarantine.path, quarantine.identity, "Managed stage quarantine root", 0o700, true)
      await this.afterQuarantineMove?.()
    }
    await this.inspectQuarantinedJournal(record, quarantinePath)
    await this.assertSafeRegistryRoot(registryIdentity)
    return quarantinePath
  }

  private async inspectQuarantinedJournal(
    record: ManagedStageRegistryRecord,
    quarantinePath: string,
  ): Promise<ParsedApplyJournal> {
    this.assertQuarantinePath(record.managedRunId, quarantinePath)
    return this.inspectBoundJournalTree(record, quarantinePath, "Managed quarantined apply journal")
  }

  private async inspectBoundJournalTree(
    record: ManagedStageRegistryRecord,
    root: string,
    label: string,
  ): Promise<ParsedApplyJournal> {
    const quarantineIdentity = await this.assertPrivateDirectory(
      root,
      label,
      0o700,
      record.journalRootIdentity,
    )
    const journal = await this.readSafeFile(
      join(root, "journal.json"),
      `${label} file`,
      0o600,
      maximumJournalBytes,
      record.journalFileIdentity,
    )
    if (digestBytes(journal.bytes) !== record.journalDigest) {
      throw new Error("Managed quarantined apply journal digest changed")
    }
    const parsed = parseApplyJournal(journal.bytes)
    if (parsed.id !== record.journalId || parsed.stageId !== record.stageId) {
      throw new Error("Managed quarantined apply journal identity is inconsistent")
    }
    if (parsed.semanticDigest !== record.journalSemanticDigest) {
      throw new Error("Managed quarantined apply journal semantic binding changed")
    }
    await this.inspectBoundJournalBackups(root, parsed)
    await this.inspectBoundedPrivateTree(root, maximumQuarantineTreeEntries, maximumQuarantineBytes)
    await this.assertPrivateDirectory(
      root,
      label,
      0o700,
      quarantineIdentity,
    )
    return parsed
  }

  private async inspectJournal(
    value: string,
    expected: {
      expectedDigest: `sha256:${string}`
      expectedRootIdentity?: FileIdentity
      expectedFileIdentity?: FileIdentity
      expectedSemanticDigest?: `sha256:${string}`
    },
  ): Promise<{ rootIdentity: FileIdentity; fileIdentity: FileIdentity; journal: ParsedApplyJournal }> {
    const journalPath = this.assertJournalPath(value)
    const journalRoot = dirname(journalPath)
    const rootIdentity = await this.assertPrivateDirectory(
      journalRoot,
      "Managed apply journal root",
      0o700,
      expected.expectedRootIdentity,
    )
    const journal = await this.readSafeFile(
      journalPath,
      "Managed apply journal file",
      0o600,
      maximumJournalBytes,
      expected.expectedFileIdentity,
    )
    if (digestBytes(journal.bytes) !== expected.expectedDigest) throw new Error("Managed apply journal digest changed")
    const parsed = parseApplyJournal(journal.bytes)
    if (expected.expectedSemanticDigest && parsed.semanticDigest !== expected.expectedSemanticDigest) {
      throw new Error("Managed apply journal semantic binding changed")
    }
    await this.inspectBoundJournalBackups(journalRoot, parsed)
    await this.inspectBoundedPrivateTree(journalRoot, maximumQuarantineTreeEntries, maximumQuarantineBytes)
    await this.assertPrivateDirectory(journalRoot, "Managed apply journal root", 0o700, rootIdentity)
    return { rootIdentity, fileIdentity: journal.identity, journal: parsed }
  }

  private async inspectMutableJournal(
    value: string,
    expected: {
      expectedDigest?: `sha256:${string}`
      expectedRootIdentity: FileIdentity
      expectedJournalId: string
      expectedStageId: string
      expectedSemanticDigest: `sha256:${string}`
    },
  ): Promise<{
    rootIdentity: FileIdentity
    fileIdentity: FileIdentity
    digest: `sha256:${string}`
    journal: ParsedApplyJournal
  }> {
    const journalPath = this.assertJournalPath(value)
    const journalRoot = dirname(journalPath)
    const rootIdentity = await this.assertPrivateDirectory(
      journalRoot,
      "Managed mutable apply journal root",
      0o700,
      expected.expectedRootIdentity,
    )
    const snapshot = await this.readSafeFile(
      journalPath,
      "Managed mutable apply journal file",
      0o600,
      maximumJournalBytes,
    )
    const digest = digestBytes(snapshot.bytes)
    if (expected.expectedDigest && digest !== expected.expectedDigest) throw new Error("Managed apply journal digest changed")
    const journal = parseApplyJournal(snapshot.bytes)
    if (journal.id !== expected.expectedJournalId || journal.stageId !== expected.expectedStageId) {
      throw new Error("Managed mutable apply journal identity is inconsistent")
    }
    if (journal.semanticDigest !== expected.expectedSemanticDigest) {
      throw new Error("Managed mutable apply journal semantic binding changed")
    }
    await this.inspectBoundJournalBackups(journalRoot, journal)
    await this.inspectBoundedPrivateTree(journalRoot, maximumQuarantineTreeEntries, maximumQuarantineBytes)
    await this.assertPrivateDirectory(journalRoot, "Managed mutable apply journal root", 0o700, rootIdentity)
    return { rootIdentity, fileIdentity: snapshot.identity, digest, journal }
  }

  private async inspectBoundJournalBackups(root: string, journal: ParsedApplyJournal): Promise<void> {
    const backupRoot = join(root, "backups")
    const backupRootIdentity = await this.assertPrivateDirectory(
      backupRoot,
      "Managed apply journal backup root",
      0o700,
    )
    const expected = new Map(
      journal.entries.flatMap((entry) => entry.backup
        ? [[basename(entry.backup.path), { intent: entry.backup, required: entry.prepared }] as const]
        : []),
    )
    const expectedTemporary = new Map(
      journal.entries.flatMap((entry) => entry.backup
        ? [[basename(entry.backup.temporaryPath), { intent: entry.backup, prepared: entry.prepared }] as const]
        : []),
    )
    const rootInventoryLimit = 2 + maximumApplyEntries + maximumApplyJournalWrites
    const rootEntries = await this.readBoundedDirectory(root, rootInventoryLimit, "Managed apply journal root")
    const rootEntryNames = new Set(rootEntries.map((entry) => entry.name))
    if (rootEntries.some((entry) =>
      !["journal.json", "backups"].includes(entry.name) && !expectedTemporary.has(entry.name) &&
      !durableJournalTemporaryPattern.test(entry.name))) {
      throw new Error("Managed apply journal root contains an unexpected entry")
    }
    const observed = await this.readBoundedDirectory(
      backupRoot,
      maximumApplyEntries,
      "Managed apply journal backup root",
    )
    const observedNames = new Set(observed.map((entry) => entry.name))
    if ([...expected.entries()].some(([name, value]) => value.required && !observedNames.has(name)) ||
        observed.some((entry) => !expected.has(entry.name))) {
      throw new Error("Managed apply journal backup inventory is inconsistent")
    }
    for (const entry of observed) {
      const binding = expected.get(entry.name)
      if (!binding || !entry.isFile() || entry.isSymbolicLink()) {
        throw new Error("Managed apply journal backup inventory contains an unexpected entry")
      }
      const snapshot = await this.readSafeFile(
        join(backupRoot, entry.name),
        `Managed apply backup ${entry.name}`,
        binding.intent.mode,
        maximumWorkspaceFileBytes,
      )
      if (snapshot.bytes.length !== binding.intent.size || digestBytes(snapshot.bytes) !== binding.intent.digest) {
        throw new Error("Managed apply journal backup content changed")
      }
    }
    for (const [temporaryName, binding] of expectedTemporary) {
      if (!rootEntryNames.has(temporaryName)) continue
      if (binding.prepared || observedNames.has(basename(binding.intent.path))) {
        throw new Error("Managed apply backup temporary inventory is inconsistent")
      }
      const temporaryPath = join(root, temporaryName)
      const metadata = await lstat(temporaryPath, { bigint: true })
      if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1n ||
          !this.isCurrentUserOwned(metadata) || metadata.size > BigInt(binding.intent.size) ||
          await realpath(temporaryPath) !== temporaryPath) {
        throw new Error("Managed apply backup temporary is unsafe or oversized")
      }
      await this.readSafeFile(
        temporaryPath,
        `Managed apply backup temporary ${temporaryName}`,
        Number(metadata.mode & 0o777n),
        maximumWorkspaceFileBytes,
      )
    }
    let durableTemporaryCount = 0
    let durableTemporaryBytes = 0
    for (const entry of rootEntries) {
      if (!durableJournalTemporaryPattern.test(entry.name)) continue
      durableTemporaryCount += 1
      if (durableTemporaryCount > maximumApplyJournalWrites) {
        throw new Error("Managed apply journal durable temporary count exceeds its bound")
      }
      if (!entry.isFile() || entry.isSymbolicLink()) {
        throw new Error("Managed apply journal durable temporary is unsafe")
      }
      const snapshot = await this.readSafeFile(
        join(root, entry.name),
        `Managed apply journal durable temporary ${entry.name}`,
        0o600,
        maximumJournalBytes,
      )
      durableTemporaryBytes += snapshot.bytes.length
      if (durableTemporaryBytes > maximumQuarantineBytes) {
        throw new Error("Managed apply journal durable temporary aggregate exceeds its bound")
      }
    }
    const finalNames = (await this.readBoundedDirectory(
      backupRoot,
      maximumApplyEntries,
      "Managed apply journal backup root",
    )).map((entry) => entry.name).sort()
    if (JSON.stringify(finalNames) !== JSON.stringify([...observedNames].sort())) {
      throw new Error("Managed apply journal backup inventory changed during inspection")
    }
    await this.assertPrivateDirectory(
      backupRoot,
      "Managed apply journal backup root",
      0o700,
      backupRootIdentity,
    )
    const finalRootNames = (await this.readBoundedDirectory(
      root,
      rootInventoryLimit,
      "Managed apply journal root",
    )).map((entry) => entry.name).sort()
    if (JSON.stringify(finalRootNames) !== JSON.stringify([...rootEntryNames].sort())) {
      throw new Error("Managed apply journal root inventory changed during inspection")
    }
  }

  private async assertQuarantineCapacity(quarantineRoot: string, incomingRoot: string): Promise<void> {
    const entries = await this.readBoundedDirectory(
      quarantineRoot,
      maximumQuarantineEntries,
      "Managed stage quarantine root",
    )
    if (entries.length >= maximumQuarantineEntries) {
      throw new ManagedStageRecoveryError("quarantine-limit", "Managed stage quarantine entry limit is reached")
    }
    let entriesCount = 0
    let bytes = 0
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || !runIdPattern.test(entry.name)) {
        throw new Error("Managed stage quarantine root contains an unsafe entry")
      }
      const observed = await this.inspectBoundedPrivateTree(
        join(quarantineRoot, entry.name),
        maximumQuarantineTreeEntries - entriesCount,
        maximumQuarantineBytes - bytes,
      )
      entriesCount += observed.entries
      bytes += observed.bytes
    }
    const incoming = await this.inspectBoundedPrivateTree(
      incomingRoot,
      maximumQuarantineTreeEntries - entriesCount,
      maximumQuarantineBytes - bytes,
    )
    entriesCount += incoming.entries
    bytes += incoming.bytes
    if (entriesCount > maximumQuarantineTreeEntries || bytes > maximumQuarantineBytes) {
      throw new ManagedStageRecoveryError("quarantine-limit", "Managed stage quarantine aggregate limit would be exceeded")
    }
  }

  private async inspectBoundedPrivateTree(
    root: string,
    maximumFiles: number,
    maximumBytes: number,
  ): Promise<{ files: number; entries: number; directories: number; bytes: number }> {
    const stack = [root]
    let files = 0
    let entryCount = 0
    let directories = 1
    let bytes = 0
    while (stack.length > 0) {
      const directory = stack.pop()!
      const metadata = await lstat(directory, { bigint: true })
      if (!metadata.isDirectory() || metadata.isSymbolicLink() || !this.isCurrentUserOwned(metadata) ||
          await realpath(directory) !== directory) {
        throw new Error("Managed stage quarantine tree contains an unsafe directory")
      }
      for (const entry of await this.readBoundedDirectory(
        directory,
        maximumFiles - entryCount,
        "Managed stage quarantine tree directory",
      )) {
        entryCount += 1
        if (entryCount > maximumFiles) {
          throw new ManagedStageRecoveryError("quarantine-limit", "Managed stage quarantine tree entry limit is exceeded")
        }
        const path = join(directory, entry.name)
        const entryMetadata = await lstat(path, { bigint: true })
        if (entryMetadata.isSymbolicLink() || !this.isCurrentUserOwned(entryMetadata) || await realpath(path) !== path) {
          throw new Error("Managed stage quarantine tree contains an unsafe entry")
        }
        if (entryMetadata.isDirectory()) {
          directories += 1
          if (directories > maximumFiles) {
            throw new ManagedStageRecoveryError("quarantine-limit", "Managed stage quarantine tree directory limit is exceeded")
          }
          stack.push(path)
          continue
        }
        if (!entryMetadata.isFile() || entryMetadata.nlink !== 1n) {
          throw new Error("Managed stage quarantine tree contains an unsupported entry")
        }
        files += 1
        bytes += Number(entryMetadata.size)
        if (entryCount > maximumFiles || bytes > maximumBytes) {
          throw new ManagedStageRecoveryError("quarantine-limit", "Managed stage quarantine aggregate limit is exceeded")
        }
      }
    }
    return { files, entries: entryCount, directories, bytes }
  }

  private async syncDurableStageTree(record: ManagedStageRegistryRecord): Promise<void> {
    const parentIdentity = await this.assertSafeTempParent()
    await this.assertStageRoot(record.stageTempRoot, record.stageIdentity)
    const workspaceRoot = join(record.stageTempRoot, "workspace")
    await this.assertPrivateDirectory(
      workspaceRoot,
      "Managed workspace stage",
      0o700,
      record.stageWorkspaceIdentity,
    )
    const stack: Array<{ path: string; identity: FileIdentity }> = [
      { path: workspaceRoot, identity: record.stageWorkspaceIdentity },
    ]
    const directories: Array<{ path: string; identity: FileIdentity }> = []
    let entryCount = 0
    let directoryCount = 1
    let fileCount = 0
    let totalBytes = 0
    while (stack.length > 0) {
      const directory = stack.pop()!
      const directoryMetadata = await lstat(directory.path, { bigint: true })
      if (!directoryMetadata.isDirectory() || directoryMetadata.isSymbolicLink() ||
          !this.isCurrentUserOwned(directoryMetadata) || !sameIdentity(identityOf(directoryMetadata), directory.identity) ||
          await realpath(directory.path) !== directory.path) {
        throw new Error("Managed workspace stage changed during durability synchronization")
      }
      directories.push(directory)
      for (const entry of await this.readBoundedDirectory(
        directory.path,
        maximumWorkspaceEntries - entryCount,
        "Managed workspace stage directory",
      )) {
        entryCount += 1
        if (entryCount > maximumWorkspaceEntries) throw new Error("Managed workspace stage entry bound is exceeded")
        const path = join(directory.path, entry.name)
        const metadata = await lstat(path, { bigint: true })
        if (metadata.isSymbolicLink() || !this.isCurrentUserOwned(metadata) || await realpath(path) !== path) {
          throw new Error("Managed workspace stage contains an unsafe entry")
        }
        if (metadata.isDirectory()) {
          directoryCount += 1
          if (directoryCount > maximumWorkspaceDirectories) {
            throw new Error("Managed workspace stage directory bound is exceeded")
          }
          stack.push({ path, identity: identityOf(metadata) })
          continue
        }
        if (!metadata.isFile() || metadata.nlink !== 1n || metadata.size > BigInt(maximumWorkspaceFileBytes)) {
          throw new Error("Managed workspace stage contains an unsafe or oversized file")
        }
        fileCount += 1
        totalBytes += Number(metadata.size)
        if (fileCount > 20_000 || totalBytes > maximumWorkspaceBytes) {
          throw new Error("Managed workspace stage file bound is exceeded")
        }
        const handle = await open(path, constants.O_RDONLY | this.noFollowOpenFlag())
        try {
          const opened = await handle.stat({ bigint: true })
          if (!opened.isFile() || opened.isSymbolicLink() || opened.nlink !== 1n ||
              opened.dev !== metadata.dev || opened.ino !== metadata.ino || opened.size !== metadata.size ||
              opened.mtimeNs !== metadata.mtimeNs || opened.ctimeNs !== metadata.ctimeNs) {
            throw new Error("Managed workspace stage file changed before durability synchronization")
          }
          await handle.sync()
          const after = await handle.stat({ bigint: true })
          const pathAfter = await lstat(path, { bigint: true })
          if (after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size ||
              after.mtimeNs !== opened.mtimeNs || after.ctimeNs !== opened.ctimeNs ||
              pathAfter.dev !== after.dev || pathAfter.ino !== after.ino || pathAfter.size !== after.size ||
              pathAfter.mtimeNs !== after.mtimeNs || pathAfter.ctimeNs !== after.ctimeNs) {
            throw new Error("Managed workspace stage file changed during durability synchronization")
          }
        } finally {
          await handle.close()
        }
      }
    }
    for (const directory of directories.reverse()) {
      await this.syncDirectory(directory.path, directory.identity, "Managed workspace stage directory", undefined, true)
    }
    await this.syncDirectory(record.stageTempRoot, record.stageIdentity, "Managed stage temporary root", 0o700, true)
    await this.syncDirectory(this.tempParent, parentIdentity, "Managed stage temporary parent")
    await this.assertPrivateDirectory(
      workspaceRoot,
      "Managed workspace stage",
      0o700,
      record.stageWorkspaceIdentity,
    )
  }

  private async removeStage(
    managedRunId: string,
    stageTempRoot: string,
    expectedIdentity: FileIdentity,
    expectedWorkspaceIdentity: FileIdentity,
  ): Promise<void> {
    const parentIdentity = await this.assertSafeTempParent()
    const registryIdentity = await this.ensureSafeRegistryRoot()
    const tombstoneRoot = await this.ensureTombstoneRoot(registryIdentity)
    const tombstone = join(tombstoneRoot.path, `.stage-${managedRunId}`)
    let stagePresent = false
    try {
      await this.assertStageRoot(stageTempRoot, expectedIdentity)
      await this.assertPrivateDirectory(
        join(stageTempRoot, "workspace"),
        "Managed workspace stage",
        0o700,
        expectedWorkspaceIdentity,
      )
      stagePresent = true
    } catch (error) {
      if (!isNoEntry(error)) throw error
    }
    let tombstonePresent = false
    try {
      await this.assertPrivateDirectory(tombstone, "Managed stage recovery tombstone", 0o700, expectedIdentity)
      try {
        await this.assertPrivateDirectory(
          join(tombstone, "workspace"),
          "Managed workspace stage tombstone",
          0o700,
          expectedWorkspaceIdentity,
        )
      } catch (error) {
        if (!isNoEntry(error)) throw error
      }
      await this.inspectBoundedPrivateTree(tombstone, maximumStageTreeEntries, maximumWorkspaceBytes)
      tombstonePresent = true
    } catch (error) {
      if (!isNoEntry(error)) throw error
    }
    if (stagePresent && tombstonePresent) {
      throw new Error("Managed stage exists in both active and recovery tombstone locations")
    }
    if (stagePresent) {
      await rename(stageTempRoot, tombstone)
      await this.assertPrivateDirectory(tombstone, "Managed stage recovery tombstone", 0o700, expectedIdentity)
      await this.assertPrivateDirectory(
        join(tombstone, "workspace"),
        "Managed workspace stage tombstone",
        0o700,
        expectedWorkspaceIdentity,
      )
      await this.inspectBoundedPrivateTree(tombstone, maximumStageTreeEntries, maximumWorkspaceBytes)
      tombstonePresent = true
      await this.syncDirectory(this.tempParent, parentIdentity, "Managed stage temporary parent")
      await this.syncDirectory(tombstoneRoot.path, tombstoneRoot.identity, "Managed stage tombstone root", 0o700, true)
    }
    if (tombstonePresent) {
      await rm(tombstone, { recursive: true })
      await this.syncDirectory(tombstoneRoot.path, tombstoneRoot.identity, "Managed stage tombstone root", 0o700, true)
    }
    try {
      await lstat(stageTempRoot)
      throw new Error("Managed stage recovery target was replaced while it was being removed")
    } catch (error) {
      if (!isNoEntry(error)) throw error
    }
    try {
      await lstat(tombstone)
      throw new Error("Managed stage recovery tombstone remains after disposal")
    } catch (error) {
      if (!isNoEntry(error)) throw error
    }
    await this.syncDirectory(this.tempParent, parentIdentity, "Managed stage temporary parent")
  }

  private async ensureSafeRegistryRoot(): Promise<FileIdentity> {
    const parentIdentity = await this.assertSafeTempParent()
    if (this.registryRootIdentity) return this.assertSafeRegistryRoot(this.registryRootIdentity)
    let created = false
    try {
      await mkdir(this.root, { mode: 0o700 })
      created = true
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error
    }
    if (created) await this.normalizeCreatedDirectory(this.root, "Managed stage registry root")
    const identity = await this.assertSafeRegistryRoot()
    if (created) await this.syncDirectory(this.tempParent, parentIdentity, "Managed stage temporary parent")
    this.registryRootIdentity = identity
    return identity
  }

  private async ensureQuarantineRoot(registryIdentity: FileIdentity): Promise<{ path: string; identity: FileIdentity }> {
    await this.assertSafeRegistryRoot(registryIdentity)
    const path = join(this.root, "quarantine")
    let created = false
    try {
      await mkdir(path, { mode: 0o700 })
      created = true
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error
    }
    if (created) await this.normalizeCreatedDirectory(path, "Managed stage quarantine root")
    const identity = await this.assertPrivateDirectory(path, "Managed stage quarantine root", 0o700)
    if (created) await this.syncDirectory(this.root, registryIdentity, "Managed stage registry root", 0o700, true)
    await this.assertSafeRegistryRoot(registryIdentity)
    return { path, identity }
  }

  private async ensureLockRoot(): Promise<{ path: string; identity: FileIdentity }> {
    const registryIdentity = await this.ensureSafeRegistryRoot()
    return this.ensurePrivateChildDirectory("locks", "Managed stage registry lock root", registryIdentity)
  }

  private async ensureManifestRoot(): Promise<{ path: string; identity: FileIdentity }> {
    const registryIdentity = await this.ensureSafeRegistryRoot()
    return this.ensurePrivateChildDirectory("manifests", "Managed stage manifest root", registryIdentity)
  }

  private async ensureTombstoneRoot(registryIdentity: FileIdentity): Promise<{ path: string; identity: FileIdentity }> {
    return this.ensurePrivateChildDirectory("tombstones", "Managed stage tombstone root", registryIdentity)
  }

  private async writeReviewManifest(
    managedRunId: string,
    untrustedManifest: ManagedStageReviewManifest,
  ): Promise<{ path: string; digest: `sha256:${string}`; identity: FileIdentity }> {
    const manifest = parseReviewManifest(untrustedManifest)
    const serialized = Buffer.from(`${JSON.stringify(manifest)}\n`)
    if (serialized.length > maximumReviewManifestBytes) throw new Error("Managed stage review manifest exceeds its bounded size")
    const root = await this.ensureManifestRoot()
    const path = this.reviewManifestPath(managedRunId)
    if (await this.pathExists(path)) throw new Error("Managed stage review manifest already exists")
    const temporary = join(root.path, `.${managedRunId}.${randomUUID()}.tmp`)
    let persisted: SafeFileSnapshot
    try {
      persisted = await this.writePrivateFileAtomically(
        path,
        temporary,
        serialized,
        maximumReviewManifestBytes,
        "Managed stage review manifest",
        { path: root.path, identity: root.identity, label: "Managed stage manifest root" },
        async () => {
          if (await this.pathExists(path)) throw new Error("Managed stage review manifest appeared during persistence")
        },
        () => this.afterManifestRename?.(managedRunId),
      )
    } catch (error) {
      if (error instanceof WorkspaceProcessDeathSimulationError) throw error
      try {
        await this.assertPrivateDirectory(root.path, "Managed stage manifest root", 0o700, root.identity)
        const exact = await this.readSafeFile(
          path,
          "Managed stage review manifest",
          0o600,
          maximumReviewManifestBytes,
        )
        if (!exact.bytes.equals(serialized)) throw error
        persisted = exact
      } catch {
        throw error
      }
    }
    return { path, digest: digestBytes(serialized), identity: persisted.identity }
  }

  private async readReviewManifest(record: ManagedStageRegistryRecord): Promise<ManagedStageReviewManifest> {
    if (!record.reviewManifestPath || !record.reviewManifestDigest || !record.reviewManifestFileIdentity) {
      throw new Error("Managed stage review manifest binding is unavailable")
    }
    if (record.reviewManifestPath !== this.reviewManifestPath(record.managedRunId)) {
      throw new Error("Managed stage review manifest path is unsafe")
    }
    const snapshot = await this.readSafeFile(
      record.reviewManifestPath,
      "Managed stage review manifest",
      0o600,
      maximumReviewManifestBytes,
      record.reviewManifestFileIdentity,
    )
    if (digestBytes(snapshot.bytes) !== record.reviewManifestDigest) {
      throw new Error("Managed stage review manifest digest changed")
    }
    let parsed: unknown
    try { parsed = JSON.parse(snapshot.bytes.toString("utf8")) } catch {
      throw new Error("Managed stage review manifest is malformed")
    }
    const manifest = parseReviewManifest(parsed)
    if (manifest.managedRunId !== record.managedRunId || manifest.stage.stage.id !== record.stageId ||
        manifest.stage.stage.root !== join(record.stageTempRoot, "workspace") ||
        manifest.stage.stage.sourceRoot !== record.sourceWorkspacePath ||
        !sameIdentity(manifest.stage.stage.sourceIdentity, record.sourceWorkspaceIdentity)) {
      throw new Error("Managed stage review manifest binding is inconsistent")
    }
    return manifest
  }

  private async removeReviewManifest(record: ManagedStageRegistryRecord): Promise<void> {
    if (!record.reviewManifestPath && !record.reviewManifestFileIdentity && !record.reviewManifestDigest) {
      const orphanPath = this.reviewManifestPath(record.managedRunId)
      let orphan: SafeFileSnapshot
      try {
        orphan = await this.readSafeFile(
          orphanPath,
          "Unbound managed stage review manifest",
          0o600,
          maximumReviewManifestBytes,
        )
      } catch (error) {
        if (isNoEntry(error)) return
        throw error
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(orphan.bytes.toString("utf8"))
      } catch {
        throw new Error("Unbound managed stage review manifest is malformed and was preserved")
      }
      const manifest = parseReviewManifest(parsed)
      if (manifest.managedRunId !== record.managedRunId || manifest.stage.stage.id !== record.stageId ||
          manifest.stage.stage.root !== join(record.stageTempRoot, "workspace") ||
          manifest.stage.stage.sourceRoot !== record.sourceWorkspacePath ||
          !sameIdentity(manifest.stage.stage.sourceIdentity, record.sourceWorkspaceIdentity)) {
        throw new Error("Unbound managed stage review manifest does not match its staging record and was preserved")
      }
      await this.removeBoundFile(
        orphanPath,
        orphan.identity,
        "Unbound managed stage review manifest",
        record.managedRunId,
      )
      return
    }
    try {
      await this.removeBoundFile(
        record.reviewManifestPath!,
        record.reviewManifestFileIdentity!,
        "Managed stage review manifest",
        record.managedRunId,
      )
    } catch (error) {
      if (!isNoEntry(error)) throw error
    }
  }

  private async removeBoundFile(
    path: string,
    expectedIdentity: FileIdentity,
    label: string,
    managedRunId: string,
  ): Promise<void> {
    const manifestRoot = await this.ensureManifestRoot()
    if (dirname(path) !== manifestRoot.path || basename(path).startsWith(".")) throw new Error(`${label} path is unsafe`)
    const registryIdentity = await this.ensureSafeRegistryRoot()
    const tombstoneRoot = await this.ensureTombstoneRoot(registryIdentity)
    const tombstone = join(tombstoneRoot.path, `.manifest-${managedRunId}`)
    let sourcePresent = false
    try {
      await this.readSafeFile(path, label, 0o600, maximumReviewManifestBytes, expectedIdentity)
      sourcePresent = true
    } catch (error) {
      if (!isNoEntry(error)) throw error
    }
    let tombstonePresent = false
    try {
      await this.readSafeFile(tombstone, `${label} tombstone`, 0o600, maximumReviewManifestBytes, expectedIdentity)
      tombstonePresent = true
    } catch (error) {
      if (!isNoEntry(error)) throw error
    }
    if (sourcePresent && tombstonePresent) throw new Error(`${label} exists in both active and tombstone locations`)
    if (sourcePresent) {
      await rename(path, tombstone)
      await this.readSafeFile(tombstone, `${label} tombstone`, 0o600, maximumReviewManifestBytes, expectedIdentity)
      tombstonePresent = true
      await this.syncDirectory(manifestRoot.path, manifestRoot.identity, "Managed stage manifest root", 0o700, true)
      await this.syncDirectory(tombstoneRoot.path, tombstoneRoot.identity, "Managed stage tombstone root", 0o700, true)
    }
    if (tombstonePresent) await unlink(tombstone)
    await this.syncDirectory(tombstoneRoot.path, tombstoneRoot.identity, "Managed stage tombstone root", 0o700, true)
    await this.syncDirectory(manifestRoot.path, manifestRoot.identity, "Managed stage manifest root", 0o700, true)
  }

  private async ensurePrivateChildDirectory(
    name: string,
    label: string,
    registryIdentity: FileIdentity,
  ): Promise<{ path: string; identity: FileIdentity }> {
    await this.assertSafeRegistryRoot(registryIdentity)
    const path = join(this.root, name)
    let created = false
    try {
      await mkdir(path, { mode: 0o700 })
      created = true
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error
    }
    if (created) await this.normalizeCreatedDirectory(path, label)
    const identity = await this.assertPrivateDirectory(path, label, 0o700)
    if (created) await this.syncDirectory(this.root, registryIdentity, "Managed stage registry root", 0o700, true)
    return { path, identity }
  }

  private async assertSafeTempParent(expectedIdentity = this.tempParentIdentity): Promise<FileIdentity> {
    await this.assertWindowsTempBoundary()
    const metadata = await lstat(this.tempParent, { bigint: true })
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || await realpath(this.tempParent) !== this.tempParent) {
      throw new Error("Managed stage registry temporary parent is unsafe")
    }
    const identity = identityOf(metadata)
    if (!sameIdentity(identity, expectedIdentity)) throw new Error("Managed stage registry temporary parent was replaced")
    if (this.hostSecurity.kind === "posix") {
      const mode = Number(metadata.mode & 0o7777n)
      const privateOwnedParent = metadata.uid === this.hostSecurity.ownerUid && (mode & 0o077) === 0
      const protectedSharedParent = metadata.uid === 0n && (mode & 0o1000) !== 0 && (mode & 0o002) !== 0
      if (!privateOwnedParent && !protectedSharedParent) {
        throw new Error("Managed stage registry temporary parent lost its trusted ownership or permission boundary")
      }
    }
    return identity
  }

  private async assertWindowsTempBoundary(): Promise<void> {
    if (this.hostSecurity.kind !== "windows") return
    const metadata = await lstat(this.hostSecurity.trustedTempRoot, { bigint: true })
    if (!metadata.isDirectory() || metadata.isSymbolicLink() ||
        await realpath(this.hostSecurity.trustedTempRoot) !== this.hostSecurity.trustedTempRoot ||
        !sameIdentity(identityOf(metadata), this.hostSecurity.trustedTempRootIdentity) ||
        (this.tempParent !== this.hostSecurity.trustedTempRoot && !contained(this.hostSecurity.trustedTempRoot, this.tempParent))) {
      throw new Error("Managed stage registry Windows user temporary boundary is unsafe or was replaced")
    }
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await lstat(path)
      return true
    } catch (error) {
      if (isNoEntry(error)) return false
      throw error
    }
  }

  private async readBoundedDirectory(path: string, maximumEntries: number, label: string): Promise<Dirent[]> {
    if (!Number.isSafeInteger(maximumEntries) || maximumEntries < 0) {
      throw new Error(`${label} inventory bound is invalid`)
    }
    const entries: Dirent[] = []
    const directory = await opendir(path)
    for await (const entry of directory) {
      if (entries.length >= maximumEntries) {
        throw new Error(`${label} inventory exceeds its bound`)
      }
      entries.push(entry)
    }
    return entries
  }

  private async isDirectoryEmpty(path: string): Promise<boolean> {
    const directory = await opendir(path)
    try {
      return await directory.read() === null
    } finally {
      await directory.close()
    }
  }

  private async assertSafeRegistryRoot(expectedIdentity?: FileIdentity): Promise<FileIdentity> {
    await this.assertSafeTempParent()
    if (dirname(this.root) !== this.tempParent || !contained(this.tempParent, this.root)) {
      throw new Error("Managed stage registry root escapes its canonical temporary parent")
    }
    const identity = await this.assertPrivateDirectory(this.root, "Managed stage registry root", 0o700, expectedIdentity)
    await this.assertSafeTempParent()
    return identity
  }

  private async assertPrivateDirectory(
    path: string,
    label: string,
    mode: number,
    expectedIdentity?: FileIdentity,
  ): Promise<FileIdentity> {
    const metadata = await lstat(path, { bigint: true })
    this.assertOwnedPrivateMetadata(metadata, label, "directory", mode, false)
    if (await realpath(path) !== path) throw new Error(`${label} resolves through an unsafe path`)
    const identity = identityOf(metadata)
    if (expectedIdentity && !sameIdentity(identity, expectedIdentity)) throw new Error(`${label} was replaced`)
    return identity
  }

  private async normalizeCreatedDirectory(path: string, label: string): Promise<void> {
    if (this.hostSecurity.kind === "windows") {
      const metadata = await lstat(path, { bigint: true })
      this.assertOwnedPrivateMetadata(metadata, label, "directory", 0o700, false)
      if (await realpath(path) !== path) throw new Error(`${label} resolves through an unsafe path`)
      return
    }
    const handle = await open(
      path,
      constants.O_RDONLY | this.hostSecurity.directoryOpenFlag | this.hostSecurity.noFollowOpenFlag,
    )
    try {
      await handle.chmod(0o700)
      const metadata = await handle.stat({ bigint: true })
      this.assertOwnedPrivateMetadata(metadata, label, "directory", 0o700, false)
      await handle.sync()
    } finally {
      await handle.close()
    }
  }

  private async readExactBounded(
    handle: FileHandle,
    expectedSize: number,
    maximumBytes: number,
    label: string,
  ): Promise<Buffer> {
    if (!Number.isSafeInteger(expectedSize) || expectedSize < 0 || expectedSize > maximumBytes) {
      throw new Error(`${label} exceeds its bounded size`)
    }
    const buffer = Buffer.allocUnsafe(expectedSize + 1)
    let offset = 0
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset)
      if (bytesRead === 0) break
      offset += bytesRead
    }
    if (offset !== expectedSize) throw new Error(`${label} changed size while it was being read`)
    return buffer.subarray(0, expectedSize)
  }

  private async readSafeFile(
    path: string,
    label: string,
    mode: number,
    maximumBytes: number,
    expectedIdentity?: FileIdentity,
  ): Promise<SafeFileSnapshot> {
    const before = await lstat(path, { bigint: true })
    this.assertOwnedPrivateMetadata(before, label, "file", mode, true)
    if (await realpath(path) !== path) throw new Error(`${label} resolves through an unsafe path`)
    const beforeIdentity = identityOf(before)
    if (expectedIdentity && !sameIdentity(beforeIdentity, expectedIdentity)) throw new Error(`${label} was replaced`)
    if (before.size > BigInt(maximumBytes)) throw new Error(`${label} exceeds its bounded size`)
    const handle = await open(path, constants.O_RDONLY | this.noFollowOpenFlag())
    try {
      const opened = await handle.stat({ bigint: true })
      this.assertOwnedPrivateMetadata(opened, label, "file", mode, true)
      if (!sameIdentity(identityOf(opened), beforeIdentity) || before.size !== opened.size ||
          before.mtimeNs !== opened.mtimeNs || before.ctimeNs !== opened.ctimeNs) {
        throw new Error(`${label} was replaced or changed before it could be opened`)
      }
      if (opened.size > BigInt(maximumBytes)) throw new Error(`${label} exceeds its bounded size`)
      const bytes = await this.readExactBounded(handle, Number(opened.size), maximumBytes, label)
      const after = await handle.stat({ bigint: true })
      this.assertOwnedPrivateMetadata(after, label, "file", mode, true)
      if (!sameIdentity(identityOf(after), beforeIdentity) || opened.size !== after.size || opened.mtimeNs !== after.mtimeNs ||
          opened.ctimeNs !== after.ctimeNs || bytes.length !== Number(after.size)) {
        throw new Error(`${label} changed while it was being read`)
      }
      return { bytes, identity: beforeIdentity }
    } finally {
      await handle.close()
    }
  }

  private assertOwnedPrivateMetadata(
    metadata: BigIntStats,
    label: string,
    kind: "directory" | "file",
    mode: number,
    requireSingleLink: boolean,
  ): void {
    const correctKind = kind === "directory" ? metadata.isDirectory() : metadata.isFile()
    if (!correctKind || metadata.isSymbolicLink()) throw new Error(`${label} is not a safe ${kind}`)
    if (!this.isCurrentUserOwned(metadata)) throw new Error(`${label} is not owned by the current user`)
    if (this.hostSecurity.kind === "posix" && Number(metadata.mode & 0o777n) !== mode) {
      throw new Error(`${label} must have mode ${mode.toString(8)}`)
    }
    if (requireSingleLink && metadata.nlink !== 1n) throw new Error(`${label} has an unsafe link count`)
  }

  private async syncDirectory(
    path: string,
    expectedIdentity: FileIdentity,
    label: string,
    privateMode?: number,
    requireOwner = false,
  ): Promise<void> {
    if (this.hostSecurity.kind === "windows") {
      await this.assertWindowsTempBoundary()
      const metadata = await lstat(path, { bigint: true })
      if (!metadata.isDirectory() || metadata.isSymbolicLink() || !sameIdentity(identityOf(metadata), expectedIdentity) ||
          await realpath(path) !== path) {
        throw new Error(`${label} was replaced before durable synchronization`)
      }
      return
    }
    const handle = await open(
      path,
      constants.O_RDONLY | this.hostSecurity.directoryOpenFlag | this.hostSecurity.noFollowOpenFlag,
    )
    try {
      const metadata = await handle.stat({ bigint: true })
      if (!metadata.isDirectory() || metadata.isSymbolicLink() || !sameIdentity(identityOf(metadata), expectedIdentity)) {
        throw new Error(`${label} was replaced before durable synchronization`)
      }
      if (requireOwner && metadata.uid !== this.hostSecurity.ownerUid) throw new Error(`${label} is not owned by the current user`)
      if (privateMode !== undefined && Number(metadata.mode & 0o777n) !== privateMode) {
        throw new Error(`${label} must have mode ${privateMode.toString(8)}`)
      }
      await handle.sync()
    } finally {
      await handle.close()
    }
  }

  private noFollowOpenFlag(): number {
    return this.hostSecurity.kind === "posix" ? this.hostSecurity.noFollowOpenFlag : 0
  }

  private isCurrentUserOwned(metadata: BigIntStats): boolean {
    return this.hostSecurity.kind === "windows" || metadata.uid === this.hostSecurity.ownerUid
  }

  private assertReviewLease(record: ManagedStageRegistryRecord, reviewLeaseToken: string | undefined): void {
    if (!record.reviewManifestPath) return
    if (!reviewLeaseToken || !runIdPattern.test(reviewLeaseToken) || record.ownerLease?.pid !== process.pid ||
        record.ownerLease.token !== reviewLeaseToken) {
      throw new Error("Managed stage review lease is missing, stale, or owned by another process")
    }
  }

  private recordPath(managedRunId: string): string {
    this.assertRunId(managedRunId)
    return join(this.root, `${managedRunId}.json`)
  }

  private reviewManifestPath(managedRunId: string): string {
    this.assertRunId(managedRunId)
    return join(this.root, "manifests", `${managedRunId}.json`)
  }

  private assertRunId(value: string): void {
    if (!runIdPattern.test(value)) throw new Error("Managed stage registry requires a UUID Managed Run ID")
  }

  private async assertStageRoot(value: string, expectedIdentity?: FileIdentity): Promise<FileIdentity> {
    const resolved = resolve(value)
    if (value !== resolved || dirname(resolved) !== this.tempParent || !contained(this.tempParent, resolved) ||
        !stageDirectoryPattern.test(basename(resolved))) {
      throw new Error("Managed stage registry stage path is outside the expected local temporary root")
    }
    return this.assertPrivateDirectory(resolved, "Managed stage recovery target", 0o700, expectedIdentity)
  }

  private assertJournalPath(value: string): string {
    const resolved = resolve(value)
    const journalRoot = dirname(resolved)
    if (value !== resolved || dirname(journalRoot) !== this.tempParent || !contained(this.tempParent, resolved) ||
        basename(resolved) !== "journal.json" || !journalDirectoryPattern.test(basename(journalRoot))) {
      throw new Error("Managed stage registry journal path is outside the expected local temporary root")
    }
    return resolved
  }

  private assertQuarantinePath(managedRunId: string, value: string): string {
    const expected = join(this.root, "quarantine", managedRunId)
    if (value !== expected || resolve(value) !== value || !contained(this.root, value)) {
      throw new Error("Managed stage registry quarantine path is outside its private registry root")
    }
    return value
  }

  private assertDisposalTombstonePath(managedRunId: string, value: string): string {
    const expected = join(this.root, "tombstones", `.quarantine-${managedRunId}`)
    if (value !== expected || resolve(value) !== value || !contained(this.root, value)) {
      throw new Error("Managed stage registry disposal tombstone path is unsafe")
    }
    return value
  }

  private assertRecordPaths(record: ManagedStageRegistryRecord): void {
    const stageRoot = resolve(record.stageTempRoot)
    if (record.stageTempRoot !== stageRoot || dirname(stageRoot) !== this.tempParent ||
        !stageDirectoryPattern.test(basename(stageRoot)) || !contained(this.tempParent, stageRoot)) {
      throw new Error("Managed stage registry record contains an unsafe stage path")
    }
    if (!isAbsolute(record.sourceWorkspacePath) || resolve(record.sourceWorkspacePath) !== record.sourceWorkspacePath) {
      throw new Error("Managed stage registry record contains an unsafe source workspace path")
    }
    if (record.journalPath) this.assertJournalPath(record.journalPath)
    if (record.quarantinePath) this.assertQuarantinePath(record.managedRunId, record.quarantinePath)
    if (record.disposalOperation) {
      this.assertDisposalTombstonePath(record.managedRunId, record.disposalOperation.tombstonePath)
    }
    if (record.reviewManifestPath && record.reviewManifestPath !== this.reviewManifestPath(record.managedRunId)) {
      throw new Error("Managed stage registry record contains an unsafe review manifest path")
    }
  }
}
