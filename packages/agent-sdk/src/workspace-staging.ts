import { createHash, randomUUID } from "node:crypto"
import { constants, lstatSync, realpathSync, type BigIntStats, type Dirent } from "node:fs"
import { lstat, mkdir, mkdtemp, open, opendir, realpath, rename, rm, rmdir, unlink, type FileHandle } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path"

import { canonicalDigest } from "./digest.js"
import type { ManagedChangedFile, ManagedStagingEvidence } from "./managed-runtime.js"

export interface WorkspaceStagingLimits {
  maxEntries: number
  maxDirectories: number
  maxExcludedPaths: number
  maxFiles: number
  maxFileBytes: number
  maxTotalBytes: number
  maxDepth: number
  maxRelativePathBytes: number
  maxPathMetadataBytes: number
  maxJournalBytes: number
}

export interface WorkspaceStage {
  readonly id: string
  readonly kind: "gaep-isolated-workspace-staging-v1"
  readonly sourceRoot: string
  readonly root: string
  /** Machine-local identity attestation captured by the staging service. */
  readonly tempRootIdentity: FileIdentity
  /** Machine-local identity attestation captured by the staging service. */
  readonly rootIdentity: FileIdentity
  readonly baselineDigest: `sha256:${string}`
  readonly excludedPaths: readonly string[]
  readonly state: "ready" | "cleaned"
}

export interface WorkspaceStageInspection {
  baselineDigest: `sha256:${string}`
  finalDigest: `sha256:${string}`
  changes: ManagedChangedFile[]
  excludedPaths: string[]
}

export interface WorkspaceStageManifestFile {
  readonly path: string
  readonly digest: `sha256:${string}`
  readonly size: number
  readonly mode: number
}

/**
 * Machine-local recovery metadata. It intentionally contains only paths,
 * digests, sizes, modes, and excluded-path names; file bytes and provider
 * input/output are never serialized into this manifest.
 */
export interface WorkspaceStageManifest {
  readonly schemaVersion: 1
  readonly kind: "gaep-workspace-stage-manifest-v1"
  readonly stage: {
    readonly id: string
    readonly sourceRoot: string
    readonly sourceIdentity: FileIdentity
    readonly root: string
    readonly baselineDigest: `sha256:${string}`
    readonly excludedPaths: readonly string[]
  }
  readonly baseline: {
    readonly digest: `sha256:${string}`
    readonly totalBytes: number
    readonly files: readonly WorkspaceStageManifestFile[]
  }
}

export interface WorkspaceApplyResult {
  status: "applied" | "conflict" | "no-changes"
  evidence: ManagedStagingEvidence
  journalDigest: `sha256:${string}`
  journalPath: string
}

export interface WorkspaceApplyOptions {
  authorizationId: string
  approvedPaths: string[]
  /** Exact digest of the inspection that was reviewed and authorized. */
  expectedInspectionDigest: `sha256:${string}`
  /** @internal Durably binds the prepared journal before any source-workspace mutation is attempted. */
  onJournalPrepared?: (
    journalPath: string,
    journalDigest: `sha256:${string}`,
    journalId: string,
  ) => void | Promise<void>
}

export interface WorkspaceStageRehydrateOptions {
  readonly expectedTempRootIdentity?: FileIdentity
  readonly expectedRootIdentity?: FileIdentity
}

interface FileSnapshot {
  path: string
  digest: `sha256:${string}`
  size: number
  mode: number
  device?: string
  inode?: string
  modifiedAt?: string
  changedAt?: string
}

export interface FileIdentity {
  readonly device: string
  readonly inode: string
}

type ExpectedFileState = (
  Pick<FileSnapshot, "digest" | "size" | "mode"> &
  Partial<Pick<FileSnapshot, "device" | "inode" | "modifiedAt" | "changedAt">>
) | undefined

interface StableFileCapture extends FileSnapshot {
  bytes: Buffer
  device: string
  inode: string
  modifiedAt: string
  changedAt: string
}

interface Snapshot {
  digest: `sha256:${string}`
  files: Map<string, FileSnapshot>
  directories: Map<string, DirectorySnapshotIdentity>
  totalBytes: number
}

type DirectorySnapshotIdentity = FileIdentity

interface StageRecord {
  publicStage: WorkspaceStage
  tempRoot: string
  tempRootIdentity: FileIdentity
  stageRootIdentity: FileIdentity
  sourceRootIdentity: FileIdentity
  baseline: Snapshot
  excludedPaths: string[]
  cleaned: boolean
}

interface ApplyJournalEntry {
  path: string
  kind: ManagedChangedFile["kind"]
  prepared: boolean
  backupPath?: string
  backupTemporaryPath?: string
  backupDigest?: `sha256:${string}`
  backupSize?: number
  backupMode?: number
  sourceTemporaryPath?: string
  sourceTemporaryDigest?: `sha256:${string}`
  sourceTemporarySize?: number
  sourceTemporaryMode?: number
  sourceTemporaryDevice?: string
  sourceTemporaryInode?: string
  rollbackTemporaryPath?: string
  rollbackTemporaryDigest?: `sha256:${string}`
  rollbackTemporarySize?: number
  rollbackTemporaryMode?: number
  rollbackTemporaryDevice?: string
  rollbackTemporaryInode?: string
  createdDirectories?: ApplyJournalDirectoryIntent[]
  applied: boolean
  rolledBack: boolean
}

interface ApplyJournalDirectoryIntent {
  path: string
  temporaryPath: string
  device?: string
  inode?: string
  created: boolean
}

interface ApplyJournal {
  schemaVersion: 2
  id: string
  stageId: string
  authorizationId: string
  baselineDigest: `sha256:${string}`
  intendedFinalDigest: `sha256:${string}`
  state: "prepared" | "conflict" | "applying" | "committed" | "rolling-back" | "rolled-back" | "rollback-failed"
  entries: ApplyJournalEntry[]
  error?: string
}

export class WorkspaceApplyError extends Error {
  constructor(
    message: string,
    readonly journalPath: string,
    readonly journalDigest: `sha256:${string}`,
    readonly rollbackSucceeded: boolean,
  ) {
    super(message)
    this.name = "WorkspaceApplyError"
  }
}

export class WorkspaceJournalPreparedError extends Error {
  constructor(
    message: string,
    readonly journalPath: string,
    readonly journalDigest: `sha256:${string}`,
    readonly journalId: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "WorkspaceJournalPreparedError"
  }
}

/** @internal Deliberately bypasses in-process cleanup to emulate process death in recovery tests. */
export class WorkspaceProcessDeathSimulationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "WorkspaceProcessDeathSimulationError"
  }
}

export interface WorkspaceStagingServiceOptions {
  tempParent?: string
  limits?: Partial<WorkspaceStagingLimits>
  beforeApplyOperation?: (path: string, index: number) => void | Promise<void>
  /** @internal Fault/concurrency hook after the write-ahead checkpoint and immediately before final source CAS validation. */
  beforeSourceMutation?: (path: string, index: number) => void | Promise<void>
  /** @internal Fault hook after the source syscall but before its caller can checkpoint completion. */
  afterSourceMutation?: (path: string, index: number) => void | Promise<void>
  /** @internal Concurrent-writer injection immediately before rollback's final exact revalidation. */
  beforeRollbackMutation?: (path: string, index: number) => void | Promise<void>
  beforeJournalWrite?: (state: ApplyJournal["state"], index: number) => void | Promise<void>
  /** @internal Process-death injection after a journal-bound source temporary file is durable. */
  afterSourceTemporarySync?: (phase: "apply" | "rollback", path: string) => void | Promise<void>
  /** @internal Process-death injection after a predeclared backup temporary file is durable. */
  afterBackupTemporarySync?: (path: string) => void | Promise<void>
  /** @internal Process-death injection after a journal-bound directory intent is atomically materialized. */
  afterCreatedDirectoryRename?: (path: string) => void | Promise<void>
  /** @internal Concurrent directory injection immediately before the final no-replace check. */
  beforeCreatedDirectoryRename?: (path: string) => void | Promise<void>
  /** @internal Process-death injection after exclusive mkdir and before its identity checkpoint. */
  afterCreatedDirectoryCreate?: (path: string) => void | Promise<void>
}

const maximumApplyJournalBytes = 32 * 1024 * 1024
const maximumApplyEntries = 128
const maximumApplyDirectoryIntents = 256
// Exact legal worst case: 4 lifecycle writes + 2*128 entry checkpoints +
// 128 source-temp checkpoints + 2*256 directory checkpoints + 128 rollback-temp checkpoints.
const maximumApplyJournalWrites = 1_028
const maximumApplyJournalTotalBytes = 256 * 1024 * 1024
const authenticWorkspaceStages = new WeakSet<object>()

/** @internal Verifies that a stage object was minted by this module in the current process. */
export function assertAuthenticWorkspaceStage(stage: WorkspaceStage): void {
  if (!authenticWorkspaceStages.has(stage)) {
    throw new Error("Workspace stage was not minted by the staging service")
  }
}

const defaultLimits: WorkspaceStagingLimits = {
  maxEntries: 50_000,
  maxDirectories: 10_000,
  maxExcludedPaths: 20_000,
  maxFiles: 20_000,
  maxFileBytes: 16 * 1024 * 1024,
  maxTotalBytes: 512 * 1024 * 1024,
  maxDepth: 64,
  maxRelativePathBytes: 4_096,
  // Keeps worst-case baseline + changed-file + excluded-path JSON below the
  // registry's 16 MiB durable review-manifest ceiling before provider launch.
  maxPathMetadataBytes: 1 * 1024 * 1024,
  maxJournalBytes: maximumApplyJournalBytes,
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const digestPattern = /^sha256:[0-9a-f]{64}$/u
const stageDirectoryPattern = /^gaep-stage-[a-z0-9_-]{1,128}$/iu

function portablePath(value: string): string {
  return value.split(sep).join("/")
}

function validatePortableRelativePath(value: string): void {
  if (!value || isAbsolute(value) || value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`Unsafe relative workspace path: ${JSON.stringify(value)}`)
  }
  for (const segment of value.split("/")) {
    if (segment !== segment.normalize("NFC")) {
      throw new Error(`Workspace path is not Unicode NFC portable: ${JSON.stringify(value)}`)
    }
    if (/[\\:*?"<>|\u0000-\u001F]/u.test(segment) || /[. ]$/u.test(segment)) {
      throw new Error(`Workspace path is not cross-host portable: ${JSON.stringify(value)}`)
    }
    if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(segment)) {
      throw new Error(`Workspace path uses a reserved cross-host name: ${JSON.stringify(value)}`)
    }
  }
}

function isExcluded(relativePath: string, directory: boolean): boolean {
  const segments = relativePath.split("/").map((segment) => segment.toLowerCase())
  const name = segments.at(-1)!
  if (segments.some((segment) => [".git", "node_modules", ".cache", "coverage"].includes(segment))) return true
  if (segments.some((segment) => [
    ".gaep",
    ".codex",
    ".claude",
    ".vscode",
    ".idea",
    ".ssh",
    ".aws",
    ".azure",
    ".gnupg",
    ".kube",
    ".secrets",
    "secrets",
  ].includes(segment))) return true
  if (directory) return false
  if (name === ".env" || (name.startsWith(".env.") && !name.endsWith(".example"))) return true
  if ([".npmrc", ".pypirc", "credentials.json", "id_rsa", "id_ed25519"].includes(name)) return true
  if (/\.(?:pem|key|p12|pfx)$/i.test(name) || /(?:^|[._-])secrets?(?:[._-]|$)/i.test(name)) return true
  return false
}

function containedPath(root: string, relativePath: string): string {
  validatePortableRelativePath(relativePath)
  const target = resolve(root, ...relativePath.split("/"))
  const difference = relative(root, target)
  if (difference === "" || difference.startsWith(`..${sep}`) || difference === ".." || isAbsolute(difference)) {
    throw new Error(`Workspace path escapes its root: ${relativePath}`)
  }
  return target
}

function digestBytes(value: Buffer): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

function snapshotDigest(files: Map<string, FileSnapshot>): `sha256:${string}` {
  return canonicalDigest([...files.values()]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map(({ path, digest, size, mode }) => ({ path, digest, size, mode: mode & 0o777 }))) as `sha256:${string}`
}

function compareSnapshots(before: Snapshot, after: Snapshot): ManagedChangedFile[] {
  const paths = new Set([...before.files.keys(), ...after.files.keys()])
  const changes: ManagedChangedFile[] = []
  for (const path of [...paths].sort()) {
    const previous = before.files.get(path)
    const next = after.files.get(path)
    if (!previous && next) {
      changes.push({ path, kind: "added", afterDigest: next.digest, afterSize: next.size, afterMode: next.mode & 0o777 })
    } else if (previous && !next) {
      changes.push({ path, kind: "deleted", beforeDigest: previous.digest, beforeSize: previous.size, beforeMode: previous.mode & 0o777 })
    } else if (previous && next && (previous.digest !== next.digest || (previous.mode & 0o777) !== (next.mode & 0o777))) {
      changes.push({
        path,
        kind: "modified",
        beforeDigest: previous.digest,
        afterDigest: next.digest,
        beforeSize: previous.size,
        afterSize: next.size,
        beforeMode: previous.mode & 0o777,
        afterMode: next.mode & 0o777,
      })
    }
  }
  return changes
}

export class WorkspaceStagingService {
  private readonly tempParent: string
  private readonly tempParentIdentity: FileIdentity
  private readonly tempParentOwnerUid?: bigint
  private readonly windowsTrustedTempRoot?: { path: string; identity: FileIdentity }
  private readonly limits: WorkspaceStagingLimits
  private readonly stages = new Map<string, StageRecord>()
  private readonly journals = new Map<string, {
    root: string
    identity: FileIdentity
    backupRoot: string
    backupIdentity: FileIdentity
  }>()
  private readonly stagingEvidence = new WeakMap<ManagedStagingEvidence, string>()
  private readonly beforeApplyOperation?: WorkspaceStagingServiceOptions["beforeApplyOperation"]
  private readonly beforeSourceMutation?: WorkspaceStagingServiceOptions["beforeSourceMutation"]
  private readonly afterSourceMutation?: WorkspaceStagingServiceOptions["afterSourceMutation"]
  private readonly beforeRollbackMutation?: WorkspaceStagingServiceOptions["beforeRollbackMutation"]
  private readonly beforeJournalWrite?: WorkspaceStagingServiceOptions["beforeJournalWrite"]
  private readonly afterSourceTemporarySync?: WorkspaceStagingServiceOptions["afterSourceTemporarySync"]
  private readonly afterBackupTemporarySync?: WorkspaceStagingServiceOptions["afterBackupTemporarySync"]
  private readonly afterCreatedDirectoryRename?: WorkspaceStagingServiceOptions["afterCreatedDirectoryRename"]
  private readonly beforeCreatedDirectoryRename?: WorkspaceStagingServiceOptions["beforeCreatedDirectoryRename"]
  private readonly afterCreatedDirectoryCreate?: WorkspaceStagingServiceOptions["afterCreatedDirectoryCreate"]
  private journalWriteSequence = 0

  constructor(options: WorkspaceStagingServiceOptions = {}) {
    this.tempParent = realpathSync(resolve(options.tempParent ?? tmpdir()))
    const tempParentMetadata = lstatSync(this.tempParent, { bigint: true })
    if (!tempParentMetadata.isDirectory() || tempParentMetadata.isSymbolicLink()) {
      throw new Error("Workspace staging temporary parent is unsafe")
    }
    this.tempParentIdentity = this.fileIdentity(tempParentMetadata)
    if (process.platform === "win32") {
      const trustedTempRoot = realpathSync(resolve(tmpdir()))
      const trustedMetadata = lstatSync(trustedTempRoot, { bigint: true })
      if (this.tempParent !== trustedTempRoot || !trustedMetadata.isDirectory() || trustedMetadata.isSymbolicLink()) {
        throw new Error("Workspace staging custom temporary parents are unsupported on Windows")
      }
      this.windowsTrustedTempRoot = { path: trustedTempRoot, identity: this.fileIdentity(trustedMetadata) }
    } else {
      if (typeof process.getuid !== "function" || typeof constants.O_NOFOLLOW !== "number" ||
          typeof constants.O_DIRECTORY !== "number") {
        throw new Error("Workspace staging cannot establish a trusted POSIX temporary boundary")
      }
      const uid = process.getuid()
      if (!Number.isSafeInteger(uid) || uid < 0) {
        throw new Error("Workspace staging cannot establish current-user temporary ownership")
      }
      this.tempParentOwnerUid = BigInt(uid)
      const parentMode = Number(tempParentMetadata.mode & 0o7777n)
      const privateOwnedParent = tempParentMetadata.uid === this.tempParentOwnerUid && (parentMode & 0o077) === 0
      const protectedSharedParent = tempParentMetadata.uid === 0n && (parentMode & 0o1000) !== 0 && (parentMode & 0o002) !== 0
      if (!privateOwnedParent && !protectedSharedParent) {
        throw new Error("Workspace staging temporary parent lacks a trusted ownership and permission boundary")
      }
    }
    this.limits = { ...defaultLimits, ...options.limits }
    this.beforeApplyOperation = options.beforeApplyOperation
    this.beforeSourceMutation = options.beforeSourceMutation
    this.afterSourceMutation = options.afterSourceMutation
    this.beforeRollbackMutation = options.beforeRollbackMutation
    this.beforeJournalWrite = options.beforeJournalWrite
    this.afterSourceTemporarySync = options.afterSourceTemporarySync
    this.afterBackupTemporarySync = options.afterBackupTemporarySync
    this.afterCreatedDirectoryRename = options.afterCreatedDirectoryRename
    this.beforeCreatedDirectoryRename = options.beforeCreatedDirectoryRename
    this.afterCreatedDirectoryCreate = options.afterCreatedDirectoryCreate
    for (const [key, value] of Object.entries(this.limits)) {
      if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${key} must be a positive safe integer`)
      if (value > defaultLimits[key as keyof WorkspaceStagingLimits]) {
        throw new Error(`${key} cannot exceed the immutable workspace staging hard maximum`)
      }
    }
    if (this.limits.maxFileBytes > this.limits.maxTotalBytes ||
        this.limits.maxRelativePathBytes > this.limits.maxPathMetadataBytes) {
      throw new Error("Workspace staging limits are internally inconsistent")
    }
  }

  async create(sourcePath: string): Promise<WorkspaceStage> {
    const sourceRoot = await realpath(resolve(sourcePath))
    const sourceStats = await lstat(sourceRoot, { bigint: true })
    if (!sourceStats.isDirectory() || sourceStats.isSymbolicLink()) throw new Error("Staging source must be a real directory")
    await this.assertTempParentIdentity()
    const tempRoot = await realpath(await mkdtemp(join(this.tempParent, "gaep-stage-")))
    await this.assertTempParentIdentity()
    if (dirname(tempRoot) !== this.tempParent) throw new Error("Workspace stage root escaped its bound temporary parent")
    const tempRootStats = await lstat(tempRoot, { bigint: true })
    const tempRootIdentity = this.fileIdentity(tempRootStats)
    const stageRoot = join(tempRoot, "workspace")
    let stageRootIdentity: FileIdentity | undefined
    try {
      await mkdir(stageRoot, { mode: 0o700 })
      const stageRootStats = await lstat(stageRoot, { bigint: true })
      stageRootIdentity = this.fileIdentity(stageRootStats)
      const sourceRootIdentity = this.fileIdentity(sourceStats)
      await this.syncDirectoryPath(tempRoot)
      await this.syncParentDirectory(tempRoot)
      const excludedPaths: string[] = []
      await this.assertRootIdentity(sourceRoot, sourceRootIdentity, "Staging source")
      const baseline = await this.scan(
        sourceRoot,
        "source",
        stageRoot,
        excludedPaths,
        sourceRootIdentity,
        stageRootIdentity,
      )
      await this.assertRootIdentity(sourceRoot, sourceRootIdentity, "Staging source")
      const stageBaseline = await this.scan(stageRoot, "stage", undefined, [], stageRootIdentity)
      if (stageBaseline.digest !== baseline.digest) throw new Error("Staging copy digest does not match its source baseline")
      await this.assertRootIdentity(stageRoot, stageRootIdentity, "Staged workspace")
      const stage: WorkspaceStage = {
        id: randomUUID(),
        kind: "gaep-isolated-workspace-staging-v1",
        sourceRoot,
        root: stageRoot,
        tempRootIdentity: Object.freeze({ ...tempRootIdentity }),
        rootIdentity: Object.freeze({ ...stageRootIdentity }),
        baselineDigest: baseline.digest,
        excludedPaths: Object.freeze([...excludedPaths].sort()),
        state: "ready",
      }
      for (const key of ["id", "kind", "sourceRoot", "root", "tempRootIdentity", "rootIdentity", "baselineDigest", "excludedPaths"] as const) {
        Object.defineProperty(stage, key, { configurable: false, writable: false })
      }
      authenticWorkspaceStages.add(stage)
      this.stages.set(stage.id, {
        publicStage: stage,
        tempRoot,
        tempRootIdentity,
        stageRootIdentity,
        sourceRootIdentity,
        baseline,
        excludedPaths: [...excludedPaths].sort(),
        cleaned: false,
      })
      return stage
    } catch (error) {
      let cleanupError: unknown
      try {
        await this.removeOwnedRoot(
          tempRoot,
          tempRootIdentity,
          stageRootIdentity ? [{ path: stageRoot, identity: stageRootIdentity }] : [],
          `.gaep-stage-create-failed-${basename(tempRoot)}`,
          { requireEmpty: !stageRootIdentity },
        )
      } catch (caught) {
        cleanupError = caught
      }
      if (cleanupError) throw new AggregateError([error, cleanupError], "Stage creation and exact-owned cleanup both failed")
      throw error
    }
  }

  async inspect(stage: WorkspaceStage): Promise<WorkspaceStageInspection> {
    const record = this.requireStage(stage)
    await this.assertRootIdentity(record.tempRoot, record.tempRootIdentity, "Workspace stage temporary root")
    const final = await this.scan(record.publicStage.root, "stage", undefined, [], record.stageRootIdentity)
    await this.assertRootIdentity(record.tempRoot, record.tempRootIdentity, "Workspace stage temporary root")
    return {
      baselineDigest: record.baseline.digest,
      finalDigest: final.digest,
      changes: compareSnapshots(record.baseline, final),
      excludedPaths: [...record.excludedPaths],
    }
  }

  exportManifest(stage: WorkspaceStage): WorkspaceStageManifest {
    const record = this.requireStage(stage)
    return {
      schemaVersion: 1,
      kind: "gaep-workspace-stage-manifest-v1",
      stage: {
        id: stage.id,
        sourceRoot: stage.sourceRoot,
        sourceIdentity: { ...record.sourceRootIdentity },
        root: stage.root,
        baselineDigest: stage.baselineDigest,
        excludedPaths: [...record.excludedPaths],
      },
      baseline: {
        digest: record.baseline.digest,
        totalBytes: record.baseline.totalBytes,
        files: [...record.baseline.files.values()]
          .sort((left, right) => left.path.localeCompare(right.path))
          .map(({ path, digest, size, mode }) => ({ path, digest, size, mode: mode & 0o777 })),
      },
    }
  }

  async rehydrate(
    untrustedManifest: WorkspaceStageManifest,
    expectedInspection: WorkspaceStageInspection,
    options: WorkspaceStageRehydrateOptions = {},
  ): Promise<WorkspaceStage> {
    this.assertBoundedInspection(expectedInspection)
    const { stage, baseline, excludedPaths, tempRoot, tempRootIdentity, stageRootIdentity, sourceRootIdentity } =
      await this.parseManifest(untrustedManifest, options)
    if (this.stages.has(stage.id)) throw new Error("Workspace stage is already active in this staging service")
    const record: StageRecord = {
      publicStage: stage,
      tempRoot,
      tempRootIdentity,
      stageRootIdentity,
      sourceRootIdentity,
      baseline,
      excludedPaths,
      cleaned: false,
    }
    this.stages.set(stage.id, record)
    try {
      const actualInspection = await this.inspect(stage)
      if (canonicalDigest(actualInspection) !== canonicalDigest(expectedInspection)) {
        throw new Error("Rehydrated staged workspace no longer matches its exact persisted review inspection")
      }
      await this.assertRootIdentity(tempRoot, tempRootIdentity, "Workspace stage recovery temporary root")
      await this.assertRootIdentity(stage.root, stageRootIdentity, "Workspace stage recovery root")
      return stage
    } catch (error) {
      this.stages.delete(stage.id)
      throw error
    }
  }

  async assertExactInspection(
    stage: WorkspaceStage,
    expectedInspectionDigest: `sha256:${string}`,
  ): Promise<WorkspaceStageInspection> {
    if (!digestPattern.test(expectedInspectionDigest)) {
      throw new Error("Expected staged inspection digest must be a lowercase SHA-256 digest")
    }
    const inspection = await this.inspect(stage)
    if (canonicalDigest(inspection) !== expectedInspectionDigest) {
      throw new Error("Staged workspace no longer matches the exact reviewed inspection")
    }
    return inspection
  }

  assertManagedStage(stage: WorkspaceStage): void {
    this.requireStage(stage)
  }

  assertManagedEvidence(stage: WorkspaceStage, evidence: ManagedStagingEvidence): void {
    this.requireStage(stage)
    if (this.stagingEvidence.get(evidence) !== stage.id) {
      throw new Error("Staging evidence is unknown, forged, or belongs to another stage")
    }
  }

  async preflightApply(
    stage: WorkspaceStage,
    options: Pick<WorkspaceApplyOptions, "authorizationId" | "approvedPaths" | "expectedInspectionDigest">,
  ): Promise<WorkspaceStageInspection> {
    const record = this.requireStage(stage)
    await this.assertSourceRootIdentity(record)
    if (typeof options.authorizationId !== "string" || Buffer.byteLength(options.authorizationId) > 1_024) {
      throw new Error("A bounded non-empty apply authorization ID is required")
    }
    const authorizationId = options.authorizationId.trim()
    if (!authorizationId || Buffer.byteLength(authorizationId) > 1_024) {
      throw new Error("A bounded non-empty apply authorization ID is required")
    }
    if (!Array.isArray(options.approvedPaths) || options.approvedPaths.length > this.limits.maxFiles ||
        options.approvedPaths.length > maximumApplyEntries) {
      throw new Error("Approved path inventory exceeds its bound")
    }
    for (const path of options.approvedPaths as unknown[]) {
      if (typeof path !== "string" || Buffer.byteLength(path) > this.limits.maxRelativePathBytes) {
        throw new Error("Approved path inventory exceeds workspace staging bounds")
      }
      validatePortableRelativePath(path)
      if (path.split("/").length > this.limits.maxDepth) {
        throw new Error("Approved path inventory exceeds workspace staging bounds")
      }
    }
    const approvedPaths = [...new Set(options.approvedPaths)].sort()
    if (approvedPaths.length !== options.approvedPaths.length) {
      throw new Error("Approved paths must be unique")
    }
    for (const path of approvedPaths) {
      validatePortableRelativePath(path)
    }
    const inspection = await this.assertExactInspection(stage, options.expectedInspectionDigest)
    await this.assertSourceRootIdentity(record)
    const changedPaths = inspection.changes.map((change) => change.path).sort()
    if (JSON.stringify(changedPaths) !== JSON.stringify(approvedPaths)) {
      throw new Error("Approved paths must exactly match the inspected staged change inventory")
    }
    return inspection
  }

  async apply(stage: WorkspaceStage, options: WorkspaceApplyOptions): Promise<WorkspaceApplyResult> {
    const record = this.requireStage(stage)
    const inspection = await this.preflightApply(stage, options)

    const journal: ApplyJournal = {
      schemaVersion: 2,
      id: randomUUID(),
      stageId: stage.id,
      authorizationId: options.authorizationId.trim(),
      baselineDigest: inspection.baselineDigest,
      intendedFinalDigest: inspection.finalDigest,
      state: "prepared",
      entries: inspection.changes.map((change) => ({
        path: change.path,
        kind: change.kind,
        prepared: false,
        applied: false,
        rolledBack: false,
      })),
    }
    const changesByPath = new Map(inspection.changes.map((change) => [change.path, change]))
    const plannedDirectories = new Set<string>()
    let plannedDirectoryCount = 0
    for (const [index, entry] of journal.entries.entries()) {
      const change = changesByPath.get(entry.path)
      if (!change) throw new Error(`Apply journal references an unknown staged change: ${entry.path}`)
      if (entry.kind !== "added") {
        if (!change.beforeDigest || change.beforeSize === undefined || change.beforeMode === undefined) {
          throw new Error(`Staged baseline evidence is incomplete for ${entry.path}`)
        }
        entry.backupPath = `backups/${index}.bin`
        entry.backupTemporaryPath = `.gaep-backup-${journal.id}-${index}.tmp`
        entry.backupDigest = change.beforeDigest
        entry.backupSize = change.beforeSize
        entry.backupMode = change.beforeMode
        entry.rollbackTemporaryPath = this.sourceTemporaryPath(entry.path, journal.id, index, "rollback")
        entry.rollbackTemporaryDigest = change.beforeDigest
        entry.rollbackTemporarySize = change.beforeSize
        entry.rollbackTemporaryMode = change.beforeMode
      }
      if (entry.kind === "deleted") continue
      if (!change.afterDigest || change.afterSize === undefined || change.afterMode === undefined) {
        throw new Error(`Staged change evidence is incomplete for ${entry.path}`)
      }
      entry.sourceTemporaryPath = this.sourceTemporaryPath(entry.path, journal.id, index, "apply")
      entry.sourceTemporaryDigest = change.afterDigest
      entry.sourceTemporarySize = change.afterSize
      entry.sourceTemporaryMode = change.afterMode
      const target = containedPath(record.publicStage.sourceRoot, entry.path)
      entry.createdDirectories = (await this.planCreatedDirectories(
        record.publicStage.sourceRoot,
        target,
        journal.id,
        index,
      )).filter((intent) => {
        if (plannedDirectories.has(intent.path)) return false
        plannedDirectories.add(intent.path)
        plannedDirectoryCount += 1
        return true
      })
      for (const [directoryIndex, intent] of entry.createdDirectories.entries()) {
        const parent = dirname(intent.path)
        intent.temporaryPath = [
          ...(parent === "." ? [] : parent.split("/")),
          `.gaep-dir-${journal.id}-${index}-${directoryIndex}.tmp`,
        ].join("/")
      }
    }
    if (plannedDirectoryCount > this.limits.maxDirectories || plannedDirectoryCount > maximumApplyDirectoryIntents) {
      throw new Error("Apply created-directory intent count exceeds its hard bound")
    }
    const directoryIntentsByPath = new Map(
      journal.entries.flatMap((entry) => (entry.createdDirectories ?? []).map((intent) => [intent.path, intent] as const)),
    )
    this.assertProjectedJournalBound(journal)

    await this.assertTempParentIdentity()
    const journalRoot = await realpath(await mkdtemp(join(this.tempParent, "gaep-apply-journal-")))
    await this.assertTempParentIdentity()
    if (dirname(journalRoot) !== this.tempParent) throw new Error("Apply journal root escaped its bound temporary parent")
    const journalPath = join(journalRoot, "journal.json")
    const backupRoot = join(journalRoot, "backups")
    const journalRootMetadata = await lstat(journalRoot, { bigint: true })
    const journalRootIdentity = this.fileIdentity(journalRootMetadata)
    let backupRootIdentity: FileIdentity | undefined
    let preparedDigest: `sha256:${string}`
    try {
      await mkdir(backupRoot, { mode: 0o700 })
      backupRootIdentity = this.fileIdentity(await lstat(backupRoot, { bigint: true }))
      await this.syncDirectoryPath(journalRoot)
      await this.syncParentDirectory(journalRoot)
      this.journals.set(journalPath, {
        root: journalRoot,
        identity: journalRootIdentity,
        backupRoot,
        backupIdentity: backupRootIdentity,
      })
      preparedDigest = await this.writeJournal(journalPath, journal)
    } catch (error) {
      this.journals.delete(journalPath)
      let cleanupError: unknown
      try {
        await this.removeOwnedRoot(
          journalRoot,
          journalRootIdentity,
          backupRootIdentity ? [{ path: backupRoot, identity: backupRootIdentity }] : [],
          `.gaep-journal-create-failed-${basename(journalRoot)}`,
          { requireEmpty: !backupRootIdentity },
        )
      } catch (caught) {
        cleanupError = caught
      }
      if (cleanupError) throw new AggregateError([error, cleanupError], "Journal creation and exact-owned cleanup both failed")
      throw error
    }
    try {
      await options.onJournalPrepared?.(journalPath, preparedDigest, journal.id)
    } catch (error) {
      // The callback is a durable cross-store bind. Once invoked, rejection is
      // ambiguous: it may have committed the binding before a later fault. Keep
      // the WAL discoverable unless the caller subsequently proves non-binding.
      throw new WorkspaceJournalPreparedError(
        error instanceof Error ? error.message : String(error),
        journalPath,
        preparedDigest,
        journal.id,
        { cause: error },
      )
    }

    await this.assertSourceRootIdentity(record)
    const current = await this.scan(record.publicStage.sourceRoot, "source", undefined, [])
    await this.assertSourceRootIdentity(record)
    if (current.digest !== record.baseline.digest) {
      journal.state = "conflict"
      journal.error = "Original workspace no longer matches the staged baseline"
      const journalDigest = await this.writeJournal(journalPath, journal)
      return {
        status: "conflict",
        evidence: this.evidence(stage.id, inspection, false, journalDigest),
        journalDigest,
        journalPath,
      }
    }
    if (inspection.changes.length === 0) {
      journal.state = "committed"
      const journalDigest = await this.writeJournal(journalPath, journal)
      return {
        status: "no-changes",
        evidence: this.evidence(stage.id, inspection, true, journalDigest),
        journalDigest,
        journalPath,
      }
    }

    journal.state = "applying"
    await this.writeJournal(journalPath, journal)
    try {
      for (const [index, entry] of journal.entries.entries()) {
        await this.beforeApplyOperation?.(entry.path, index)
        await this.assertSourceRootIdentity(record)
        await this.assertSnapshotAncestors(record.publicStage.sourceRoot, entry.path, current.directories)
        const target = containedPath(record.publicStage.sourceRoot, entry.path)
        const freshBaseline = current.files.get(entry.path)
        const capturedTarget = await this.captureExpectedFile(record.publicStage.sourceRoot, entry.path, freshBaseline)
        if (capturedTarget) {
          if (!entry.backupPath || entry.backupDigest !== capturedTarget.digest ||
              entry.backupSize !== capturedTarget.size || entry.backupMode !== (capturedTarget.mode & 0o777)) {
            throw new Error(`Predeclared apply backup intent changed for ${entry.path}`)
          }
          const backupPath = containedPath(journalRoot, entry.backupPath)
          await this.durableAtomicWrite(backupPath, capturedTarget.bytes, capturedTarget.mode & 0o777, {
            temporaryPath: containedPath(journalRoot, entry.backupTemporaryPath!),
            afterDurableTemporary: () => this.afterBackupTemporarySync?.(entry.path),
            beforeTemporaryCreate: () => this.assertBoundJournalRoots(
              journalRoot,
              journalRootIdentity,
              backupRoot,
              backupRootIdentity!,
            ),
            beforeCommit: async () => {
              await this.assertBoundJournalRoots(
                journalRoot,
                journalRootIdentity,
                backupRoot,
                backupRootIdentity!,
              )
              await this.assertPathAbsent(backupPath, `Apply backup appeared concurrently: ${entry.path}`)
            },
            afterCommit: () => this.assertBoundJournalRoots(
              journalRoot,
              journalRootIdentity,
              backupRoot,
              backupRootIdentity!,
            ),
          })
        }
        const change = changesByPath.get(entry.path)
        if (!change) throw new Error(`Apply journal references an unknown staged change: ${entry.path}`)
        if (entry.kind !== "deleted") {
          if (!change.afterDigest || change.afterSize === undefined || change.afterMode === undefined) {
            throw new Error(`Staged change evidence is incomplete for ${entry.path}`)
          }
        }
        entry.prepared = true
        await this.writeJournal(journalPath, journal)
        if (entry.kind === "deleted") {
          await this.assertSafeAncestors(record.publicStage.sourceRoot, target)
          await this.beforeSourceMutation?.(entry.path, index)
          await this.assertSourceRootIdentity(record)
          await this.assertSnapshotAncestors(record.publicStage.sourceRoot, entry.path, current.directories)
          await this.assertCapturedFileStillCurrent(record.publicStage.sourceRoot, entry.path, capturedTarget)
          await unlink(target)
          await this.syncParentDirectory(target)
          await this.afterSourceMutation?.(entry.path, index)
        } else {
          const stagedFile = containedPath(record.publicStage.root, entry.path)
          const stagedCapture = await this.readBoundedStableFile(
            stagedFile,
            `Staged apply source ${entry.path}`,
            this.limits.maxFileBytes,
          )
          const stagedContent = stagedCapture.bytes
          const stagedAfter = stagedCapture.metadata
          if (
            !stagedAfter.isFile() ||
            stagedAfter.isSymbolicLink() ||
            stagedContent.length !== change.afterSize ||
            digestBytes(stagedContent) !== change.afterDigest ||
            Number(stagedAfter.mode & 0o777n) !== change.afterMode
          ) {
            throw new Error(`Staged apply source changed after inspection: ${entry.path}`)
          }
          await this.beforeSourceMutation?.(entry.path, index)
          await this.assertSourceRootIdentity(record)
          await this.assertSnapshotAncestors(record.publicStage.sourceRoot, entry.path, current.directories)
          await this.assertCapturedFileStillCurrent(record.publicStage.sourceRoot, entry.path, capturedTarget)
          await this.materializeCreatedDirectories(
            record.publicStage.sourceRoot,
            record.sourceRootIdentity,
            entry.createdDirectories ?? [],
            journalPath,
            journal,
            directoryIntentsByPath,
          )
          await this.assertJournalCreatedAncestors(record.publicStage.sourceRoot, entry.path, directoryIntentsByPath)
          await this.atomicWrite(
            record.publicStage.sourceRoot,
            target,
            stagedContent,
            Number(stagedAfter.mode),
            {
              temporaryPath: containedPath(record.publicStage.sourceRoot, entry.sourceTemporaryPath!),
              phase: "apply",
              relativePath: entry.path,
              afterTemporarySync: async (identity) => {
                entry.sourceTemporaryDevice = identity.device
                entry.sourceTemporaryInode = identity.inode
                await this.writeJournal(journalPath, journal)
              },
              beforeCommit: async () => {
                await this.assertSourceRootIdentity(record)
                await this.assertSnapshotAncestors(record.publicStage.sourceRoot, entry.path, current.directories)
                await this.assertCapturedFileStillCurrent(record.publicStage.sourceRoot, entry.path, capturedTarget)
              },
              afterCommit: () => this.afterSourceMutation?.(entry.path, index),
            },
          )
        }
        entry.applied = true
        await this.writeJournal(journalPath, journal)
      }
      await this.assertSourceRootIdentity(record)
      const applied = await this.scan(record.publicStage.sourceRoot, "source", undefined, [])
      await this.assertSourceRootIdentity(record)
      if (applied.digest !== inspection.finalDigest) throw new Error("Applied workspace digest does not match the inspected staged final digest")
      journal.state = "committed"
      const journalDigest = await this.writeJournal(journalPath, journal)
      return {
        status: "applied",
        evidence: this.evidence(stage.id, inspection, true, journalDigest),
        journalDigest,
        journalPath,
      }
    } catch (error) {
      if (error instanceof WorkspaceProcessDeathSimulationError) throw error
      journal.state = "rolling-back"
      journal.error = this.boundedJournalError(error instanceof Error ? error.message : String(error))
      await this.writeJournal(journalPath, journal)
      let rollbackSucceeded = true
      for (const entry of [...journal.entries].reverse()) {
        if (!entry.prepared) continue
        try {
          const target = containedPath(record.publicStage.sourceRoot, entry.path)
          const change = changesByPath.get(entry.path)
          if (!change) throw new Error(`Apply journal references an unknown staged change: ${entry.path}`)
          const appliedState: ExpectedFileState = entry.kind === "deleted"
            ? undefined
            : {
                digest: change.afterDigest!,
                size: change.afterSize!,
                mode: change.afterMode!,
              }
          const baselineState: ExpectedFileState = entry.kind === "added"
            ? undefined
            : {
                digest: change.beforeDigest!,
                size: change.beforeSize!,
                mode: change.beforeMode!,
              }
          let appliedCapture: StableFileCapture | undefined
          try {
            appliedCapture = await this.captureExpectedFile(record.publicStage.sourceRoot, entry.path, appliedState)
          } catch {
            if (await this.targetMatchesExpectedState(record.publicStage.sourceRoot, entry.path, baselineState)) {
              // No source effect was observed for a merely prepared intent.
              // Preserve applied=false/rolledBack=false so restart parsers do
              // not misreport a rollback that never had to occur.
              await this.cleanupJournalTemporaryFiles(record.publicStage.sourceRoot, entry)
              await this.cleanupCreatedDirectories(record.publicStage.sourceRoot, entry.createdDirectories ?? [])
              entry.rolledBack = entry.applied
              continue
            }
            throw new Error(`Apply target changed concurrently before rollback: ${entry.path}`)
          }
          if (entry.kind !== "deleted" &&
              (!entry.sourceTemporaryDevice || !entry.sourceTemporaryInode || !appliedCapture ||
               appliedCapture.device !== entry.sourceTemporaryDevice ||
               appliedCapture.inode !== entry.sourceTemporaryInode)) {
            throw new Error(`Applied target identity changed before rollback: ${entry.path}`)
          }
          entry.applied = true
          const entryIndex = journal.entries.indexOf(entry)
          if (entry.backupPath) {
            if (!entry.rollbackTemporaryPath) {
              throw new Error(`Apply rollback temporary intent is missing: ${entry.path}`)
            }
            const backup = containedPath(journalRoot, entry.backupPath)
            await this.assertBoundJournalRoots(
              journalRoot,
              journalRootIdentity,
              backupRoot,
              backupRootIdentity!,
            )
            const backupCapture = await this.readBoundedStableFile(
              backup,
              `Apply backup ${entry.path}`,
              this.limits.maxFileBytes,
            )
            const backupStats = backupCapture.metadata
            const backupBytes = backupCapture.bytes
            if (entry.backupDigest === undefined || entry.backupSize === undefined || entry.backupMode === undefined ||
                backupBytes.length !== entry.backupSize || digestBytes(backupBytes) !== entry.backupDigest ||
                Number(backupStats.mode & 0o777n) !== entry.backupMode) {
              throw new Error(`Apply backup changed before rollback: ${entry.path}`)
            }
            await this.atomicWrite(
              record.publicStage.sourceRoot,
              target,
              backupBytes,
              Number(backupStats.mode),
              {
                temporaryPath: containedPath(record.publicStage.sourceRoot, entry.rollbackTemporaryPath),
                phase: "rollback",
                relativePath: entry.path,
                afterTemporarySync: async (identity) => {
                  entry.rollbackTemporaryDevice = identity.device
                  entry.rollbackTemporaryInode = identity.inode
                  await this.writeJournal(journalPath, journal)
                },
                beforeCommit: async () => {
                  await this.beforeRollbackMutation?.(entry.path, entryIndex)
                  await this.assertSourceRootIdentity(record)
                  await this.assertCapturedFileStillCurrent(record.publicStage.sourceRoot, entry.path, appliedCapture)
                },
              },
            )
          } else {
            await this.assertSafeAncestors(record.publicStage.sourceRoot, target)
            await this.beforeRollbackMutation?.(entry.path, entryIndex)
            await this.assertSourceRootIdentity(record)
            await this.assertCapturedFileStillCurrent(record.publicStage.sourceRoot, entry.path, appliedCapture)
            await rm(target, { force: true })
            await this.syncParentDirectory(target)
          }
          if (!(await this.targetMatchesExpectedState(record.publicStage.sourceRoot, entry.path, baselineState))) {
            throw new Error(`Rollback verification failed for ${entry.path}`)
          }
          await this.cleanupJournalTemporaryFiles(record.publicStage.sourceRoot, entry)
          await this.cleanupCreatedDirectories(record.publicStage.sourceRoot, entry.createdDirectories ?? [])
          entry.rolledBack = true
        } catch (rollbackError) {
          if (rollbackError instanceof WorkspaceProcessDeathSimulationError) throw rollbackError
          rollbackSucceeded = false
          const rollbackMessage = rollbackError instanceof Error
            ? rollbackError.message.slice(0, 4_096)
            : String(rollbackError).slice(0, 4_096)
          journal.error = this.boundedJournalError(
            `${journal.error}; rollback failed for ${entry.path}: ${rollbackMessage}`,
          )
        }
      }
      journal.state = rollbackSucceeded ? "rolled-back" : "rollback-failed"
      const journalDigest = await this.writeJournal(journalPath, journal)
      throw new WorkspaceApplyError(journal.error, journalPath, journalDigest, rollbackSucceeded)
    }
  }

  async cleanup(stage: WorkspaceStage): Promise<void> {
    const record = this.requireStage(stage)
    await this.removeOwnedRoot(
      record.tempRoot,
      record.tempRootIdentity,
      [{ path: record.publicStage.root, identity: record.stageRootIdentity }],
      `.gaep-stage-dispose-${record.publicStage.id}`,
    )
    record.cleaned = true
    Object.defineProperty(record.publicStage, "state", { configurable: false, value: "cleaned", writable: false })
    this.stages.delete(stage.id)
  }

  async disposeJournal(journalPath: string, expectedDigest: `sha256:${string}`): Promise<void> {
    const resolvedPath = resolve(journalPath)
    const journal = this.journals.get(resolvedPath)
    if (!journal || resolvedPath !== join(journal.root, "journal.json")) {
      throw new Error("Apply journal is unknown or already disposed")
    }
    await this.assertBoundJournalRoots(
      journal.root,
      journal.identity,
      journal.backupRoot,
      journal.backupIdentity,
    )
    const actualDigest = digestBytes((await this.readBoundedStableFile(
      resolvedPath,
      "Apply journal",
      this.limits.maxJournalBytes,
    )).bytes)
    if (actualDigest !== expectedDigest) throw new Error("Apply journal digest changed before disposal")
    await this.removeOwnedRoot(
      journal.root,
      journal.identity,
      [{ path: journal.backupRoot, identity: journal.backupIdentity }],
      `.gaep-journal-dispose-${basename(journal.root)}`,
    )
    this.journals.delete(resolvedPath)
  }

  private requireStage(stage: WorkspaceStage): StageRecord {
    const record = this.stages.get(stage.id)
    if (!record || record.publicStage !== stage || record.cleaned || stage.state !== "ready" || stage.kind !== "gaep-isolated-workspace-staging-v1") {
      throw new Error("Workspace stage is unknown, forged, or already cleaned")
    }
    return record
  }

  private assertBoundedInspection(untrusted: unknown): asserts untrusted is WorkspaceStageInspection {
    if (!untrusted || typeof untrusted !== "object" || Array.isArray(untrusted)) {
      throw new Error("Expected workspace inspection is malformed")
    }
    const inspection = untrusted as Record<string, unknown>
    const inspectionKeys = Object.keys(inspection)
    if (inspectionKeys.length !== 4 ||
        !inspectionKeys.every((key) => ["baselineDigest", "finalDigest", "changes", "excludedPaths"].includes(key)) ||
        typeof inspection.baselineDigest !== "string" || Buffer.byteLength(inspection.baselineDigest) > 128 ||
        !digestPattern.test(inspection.baselineDigest) ||
        typeof inspection.finalDigest !== "string" || Buffer.byteLength(inspection.finalDigest) > 128 ||
        !digestPattern.test(inspection.finalDigest) ||
        !Array.isArray(inspection.changes) || inspection.changes.length > this.limits.maxFiles ||
        !Array.isArray(inspection.excludedPaths) || inspection.excludedPaths.length > this.limits.maxExcludedPaths) {
      throw new Error("Expected workspace inspection exceeds its input bounds")
    }
    let pathMetadataBytes = 0
    const seenPaths = new Set<string>()
    for (const untrustedChange of inspection.changes) {
      if (!untrustedChange || typeof untrustedChange !== "object" || Array.isArray(untrustedChange)) {
        throw new Error("Expected workspace inspection contains a malformed change")
      }
      const change = untrustedChange as Record<string, unknown>
      if (typeof change.path !== "string" || Buffer.byteLength(change.path) > this.limits.maxRelativePathBytes ||
          !["added", "modified", "deleted"].includes(String(change.kind))) {
        throw new Error("Expected workspace inspection contains an out-of-bounds change")
      }
      validatePortableRelativePath(change.path)
      if (change.path.split("/").length > this.limits.maxDepth || seenPaths.has(change.path)) {
        throw new Error("Expected workspace inspection contains duplicate or out-of-bounds paths")
      }
      seenPaths.add(change.path)
      pathMetadataBytes += Buffer.byteLength(change.path)
      if (pathMetadataBytes > this.limits.maxPathMetadataBytes) {
        throw new Error("Expected workspace inspection path metadata exceeds its bound")
      }
      const expectedKeys = change.kind === "added"
        ? ["path", "kind", "afterDigest", "afterSize", "afterMode"]
        : change.kind === "deleted"
          ? ["path", "kind", "beforeDigest", "beforeSize", "beforeMode"]
          : ["path", "kind", "beforeDigest", "afterDigest", "beforeSize", "afterSize", "beforeMode", "afterMode"]
      const keys = Object.keys(change)
      if (keys.length !== expectedKeys.length || !keys.every((key) => expectedKeys.includes(key))) {
        throw new Error("Expected workspace inspection change fields are malformed")
      }
      for (const digest of [change.beforeDigest, change.afterDigest]) {
        if (digest !== undefined &&
            (typeof digest !== "string" || Buffer.byteLength(digest) > 128 || !digestPattern.test(digest))) {
          throw new Error("Expected workspace inspection change digest is malformed")
        }
      }
      for (const size of [change.beforeSize, change.afterSize]) {
        if (size !== undefined && (!Number.isSafeInteger(size) || Number(size) < 0 || Number(size) > this.limits.maxFileBytes)) {
          throw new Error("Expected workspace inspection change size is invalid")
        }
      }
      for (const mode of [change.beforeMode, change.afterMode]) {
        if (mode !== undefined && (!Number.isSafeInteger(mode) || Number(mode) < 0 || Number(mode) > 0o777)) {
          throw new Error("Expected workspace inspection change mode is invalid")
        }
      }
    }
    const seenExcluded = new Set<string>()
    for (const untrustedPath of inspection.excludedPaths) {
      if (typeof untrustedPath !== "string" || Buffer.byteLength(untrustedPath) > this.limits.maxRelativePathBytes) {
        throw new Error("Expected workspace inspection excluded path exceeds its bound")
      }
      validatePortableRelativePath(untrustedPath)
      if (untrustedPath.split("/").length > this.limits.maxDepth || seenExcluded.has(untrustedPath)) {
        throw new Error("Expected workspace inspection excluded path is invalid")
      }
      seenExcluded.add(untrustedPath)
      pathMetadataBytes += Buffer.byteLength(untrustedPath)
      if (pathMetadataBytes > this.limits.maxPathMetadataBytes) {
        throw new Error("Expected workspace inspection path metadata exceeds its bound")
      }
    }
  }

  private async parseManifest(
    untrusted: WorkspaceStageManifest,
    options: WorkspaceStageRehydrateOptions,
  ): Promise<{
    stage: WorkspaceStage
    baseline: Snapshot
    excludedPaths: string[]
    tempRoot: string
    tempRootIdentity: FileIdentity
    stageRootIdentity: FileIdentity
    sourceRootIdentity: FileIdentity
  }> {
    const raw = untrusted as unknown
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("Workspace stage recovery manifest is malformed")
    }
    const rawManifest = raw as Record<string, unknown>
    const rawStage = rawManifest.stage
    const rawBaseline = rawManifest.baseline
    if (rawManifest.schemaVersion !== 1 || rawManifest.kind !== "gaep-workspace-stage-manifest-v1" ||
        !rawStage || typeof rawStage !== "object" || Array.isArray(rawStage) ||
        !rawBaseline || typeof rawBaseline !== "object" || Array.isArray(rawBaseline)) {
      throw new Error("Workspace stage recovery manifest is malformed")
    }
    const rawStageRecord = rawStage as Record<string, unknown>
    const rawBaselineRecord = rawBaseline as Record<string, unknown>
    if (typeof rawStageRecord.id !== "string" || Buffer.byteLength(rawStageRecord.id) > 128 ||
        typeof rawStageRecord.sourceRoot !== "string" || Buffer.byteLength(rawStageRecord.sourceRoot) > 16 * 1024 ||
        typeof rawStageRecord.root !== "string" || Buffer.byteLength(rawStageRecord.root) > 16 * 1024 ||
        typeof rawStageRecord.baselineDigest !== "string" || Buffer.byteLength(rawStageRecord.baselineDigest) > 128 ||
        !Array.isArray(rawStageRecord.excludedPaths) || rawStageRecord.excludedPaths.length > this.limits.maxExcludedPaths ||
        typeof rawBaselineRecord.digest !== "string" || Buffer.byteLength(rawBaselineRecord.digest) > 128 ||
        !Array.isArray(rawBaselineRecord.files) || rawBaselineRecord.files.length > this.limits.maxFiles) {
      throw new Error("Workspace stage recovery manifest exceeds its input bounds")
    }
    const value = untrusted as WorkspaceStageManifest
    const stageValue = value.stage
    const sourceRootIdentity = this.parseFileIdentity(stageValue.sourceIdentity)
    if (!uuidPattern.test(stageValue.id) || !isAbsolute(stageValue.sourceRoot) || !isAbsolute(stageValue.root) ||
        !sourceRootIdentity ||
        !digestPattern.test(stageValue.baselineDigest) || !Array.isArray(stageValue.excludedPaths) ||
        value.baseline.digest !== stageValue.baselineDigest || !digestPattern.test(value.baseline.digest) ||
        !Number.isSafeInteger(value.baseline.totalBytes) || value.baseline.totalBytes < 0 ||
        value.baseline.totalBytes > this.limits.maxTotalBytes || !Array.isArray(value.baseline.files) ||
        value.baseline.files.length > this.limits.maxFiles) {
      throw new Error("Workspace stage recovery manifest is malformed")
    }
    const sourceRoot = await realpath(resolve(stageValue.sourceRoot))
    const stageRoot = await realpath(resolve(stageValue.root))
    if (sourceRoot !== stageValue.sourceRoot || stageRoot !== stageValue.root) {
      throw new Error("Workspace stage recovery manifest paths are not canonical")
    }
    const sourceStats = await lstat(sourceRoot, { bigint: true })
    const stageStats = await lstat(stageRoot, { bigint: true })
    const tempRoot = dirname(stageRoot)
    const canonicalTempParent = await realpath(this.tempParent)
    if (!sourceStats.isDirectory() || sourceStats.isSymbolicLink() || !stageStats.isDirectory() ||
        stageStats.isSymbolicLink() || basename(stageRoot) !== "workspace" || dirname(tempRoot) !== canonicalTempParent ||
        !stageDirectoryPattern.test(basename(tempRoot))) {
      throw new Error("Workspace stage recovery manifest paths are unsafe")
    }
    const tempStats = await lstat(tempRoot, { bigint: true })
    if (!tempStats.isDirectory() || tempStats.isSymbolicLink() || await realpath(tempRoot) !== tempRoot) {
      throw new Error("Workspace stage recovery temporary root is unsafe")
    }
    if (!this.sameFileIdentity(this.fileIdentity(sourceStats), sourceRootIdentity)) {
      throw new Error("Workspace stage recovery source root identity changed")
    }
    const tempRootIdentity = this.fileIdentity(tempStats)
    const stageRootIdentity = this.fileIdentity(stageStats)
    const expectedTempRootIdentity = options.expectedTempRootIdentity === undefined
      ? undefined
      : this.parseFileIdentity(options.expectedTempRootIdentity)
    const expectedStageRootIdentity = options.expectedRootIdentity === undefined
      ? undefined
      : this.parseFileIdentity(options.expectedRootIdentity)
    if ((options.expectedTempRootIdentity !== undefined && !expectedTempRootIdentity) ||
        (options.expectedRootIdentity !== undefined && !expectedStageRootIdentity) ||
        (expectedTempRootIdentity && !this.sameFileIdentity(tempRootIdentity, expectedTempRootIdentity)) ||
        (expectedStageRootIdentity && !this.sameFileIdentity(stageRootIdentity, expectedStageRootIdentity))) {
      throw new Error("Workspace stage recovery identity attestation changed")
    }

    const files = new Map<string, FileSnapshot>()
    const portableIdentities = new Set<string>()
    let totalBytes = 0
    let pathMetadataBytes = 0
    for (const file of value.baseline.files) {
      if (!file || typeof file !== "object" || typeof file.path !== "string" ||
          typeof file.digest !== "string" || !digestPattern.test(file.digest) ||
          !Number.isSafeInteger(file.size) || file.size < 0 || file.size > this.limits.maxFileBytes ||
          !Number.isSafeInteger(file.mode) || file.mode < 0 || file.mode > 0o777) {
        throw new Error("Workspace stage recovery manifest contains an invalid baseline file")
      }
      const pathBytes = Buffer.byteLength(file.path)
      if (pathBytes > this.limits.maxRelativePathBytes) {
        throw new Error("Workspace stage recovery manifest contains an out-of-bounds path")
      }
      validatePortableRelativePath(file.path)
      if (file.path.split("/").length > this.limits.maxDepth) {
        throw new Error("Workspace stage recovery manifest contains an out-of-bounds path")
      }
      pathMetadataBytes += pathBytes
      if (pathMetadataBytes > this.limits.maxPathMetadataBytes) {
        throw new Error("Workspace stage recovery manifest path metadata exceeds its bound")
      }
      const portableIdentity = file.path.toLowerCase()
      if (portableIdentities.has(portableIdentity)) {
        throw new Error("Workspace stage recovery manifest contains duplicate or cross-host colliding paths")
      }
      portableIdentities.add(portableIdentity)
      totalBytes += file.size
      if (totalBytes > this.limits.maxTotalBytes) throw new Error("Workspace stage recovery manifest exceeds its total size bound")
      files.set(file.path, { path: file.path, digest: file.digest, size: file.size, mode: file.mode })
    }
    if (totalBytes !== value.baseline.totalBytes) throw new Error("Workspace stage recovery manifest total size is inconsistent")
    const baseline: Snapshot = { digest: snapshotDigest(files), files, directories: new Map(), totalBytes }
    if (baseline.digest !== value.baseline.digest) throw new Error("Workspace stage recovery manifest baseline digest is invalid")

    const excludedPaths = [...stageValue.excludedPaths]
    if (excludedPaths.length > this.limits.maxExcludedPaths || new Set(excludedPaths).size !== excludedPaths.length) {
      throw new Error("Workspace stage recovery manifest excluded paths are invalid")
    }
    for (const path of excludedPaths) {
      if (typeof path !== "string") throw new Error("Workspace stage recovery manifest excluded path is invalid")
      const pathBytes = Buffer.byteLength(path)
      if (pathBytes > this.limits.maxRelativePathBytes) {
        throw new Error("Workspace stage recovery manifest excluded path exceeds its bound")
      }
      validatePortableRelativePath(path)
      if (path.split("/").length > this.limits.maxDepth) {
        throw new Error("Workspace stage recovery manifest excluded path exceeds its bound")
      }
      pathMetadataBytes += pathBytes
      if (pathMetadataBytes > this.limits.maxPathMetadataBytes) {
        throw new Error("Workspace stage recovery manifest path metadata exceeds its bound")
      }
    }
    const stage: WorkspaceStage = {
      id: stageValue.id,
      kind: "gaep-isolated-workspace-staging-v1",
      sourceRoot,
      root: stageRoot,
      tempRootIdentity: Object.freeze({ ...tempRootIdentity }),
      rootIdentity: Object.freeze({ ...stageRootIdentity }),
      baselineDigest: baseline.digest,
      excludedPaths: Object.freeze([...excludedPaths]),
      state: "ready",
    }
    for (const key of ["id", "kind", "sourceRoot", "root", "tempRootIdentity", "rootIdentity", "baselineDigest", "excludedPaths"] as const) {
      Object.defineProperty(stage, key, { configurable: false, writable: false })
    }
    authenticWorkspaceStages.add(stage)
    return { stage, baseline, excludedPaths, tempRoot, tempRootIdentity, stageRootIdentity, sourceRootIdentity }
  }

  private async scan(
    root: string,
    mode: "source" | "stage",
    copyRoot?: string,
    excludedPaths: string[] = [],
    expectedRootIdentity?: FileIdentity,
    expectedCopyRootIdentity?: FileIdentity,
  ): Promise<Snapshot> {
    const files = new Map<string, FileSnapshot>()
    const directories = new Map<string, DirectorySnapshotIdentity>()
    const portableIdentities = new Map<string, string>()
    let totalBytes = 0
    let pathMetadataBytes = 0
    let entriesVisited = 0
    let directoriesVisited = 1
    const copyDirectoryIdentities = new Map<string, FileIdentity>()
    if (copyRoot) {
      if (!expectedCopyRootIdentity) throw new Error("Workspace copy root identity binding is required")
      copyDirectoryIdentities.set("", expectedCopyRootIdentity)
    }
    const sameDirectory = (left: BigIntStats, right: BigIntStats): boolean =>
      left.isDirectory() && right.isDirectory() && !left.isSymbolicLink() && !right.isSymbolicLink() &&
      left.dev === right.dev && left.ino === right.ino && left.ctimeNs === right.ctimeNs
    const assertDirectory = async (directory: string, expected: BigIntStats): Promise<void> => {
      const current = await lstat(directory, { bigint: true })
      if (!sameDirectory(current, expected)) throw new Error(`Workspace directory changed while staging: ${portablePath(relative(root, directory)) || "."}`)
    }
    const visit = async (directory: string, segments: string[], expectedDirectory: BigIntStats): Promise<void> => {
      await assertDirectory(directory, expectedDirectory)
      directories.set(segments.join("/"), {
        ...this.fileIdentity(expectedDirectory),
      })
      const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0
      const directoryHandle = await open(
        directory,
        constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | noFollow,
      )
      let entries: Dirent[]
      try {
        const opened = await directoryHandle.stat({ bigint: true })
        if (!sameDirectory(opened, expectedDirectory)) {
          throw new Error(`Workspace directory changed before staging enumeration: ${portablePath(relative(root, directory)) || "."}`)
        }
        entries = await this.readBoundedDirectory(
          directory,
          this.limits.maxEntries - entriesVisited,
          "Workspace staging directory",
          "Workspace staging entry count limit exceeded",
        )
        const after = await directoryHandle.stat({ bigint: true })
        const pathAfter = await lstat(directory, { bigint: true })
        if (!sameDirectory(opened, after) || !sameDirectory(after, pathAfter)) {
          throw new Error(`Workspace directory changed during staging enumeration: ${portablePath(relative(root, directory)) || "."}`)
        }
      } finally {
        await directoryHandle.close()
      }
      entries.sort((left, right) => left.name.localeCompare(right.name))
      for (const entry of entries) {
        await assertDirectory(directory, expectedDirectory)
        entriesVisited += 1
        if (entriesVisited > this.limits.maxEntries) throw new Error("Workspace staging entry count limit exceeded")
        const childSegments = [...segments, entry.name]
        const relativePath = childSegments.join("/")
        validatePortableRelativePath(relativePath)
        pathMetadataBytes += Buffer.byteLength(relativePath)
        if (pathMetadataBytes > this.limits.maxPathMetadataBytes) {
          throw new Error("Workspace staging path metadata limit exceeded")
        }
        const portableIdentity = relativePath.toLowerCase()
        const collidingPath = portableIdentities.get(portableIdentity)
        if (collidingPath && collidingPath !== relativePath) {
          throw new Error(`Workspace contains cross-host colliding paths: ${collidingPath} and ${relativePath}`)
        }
        portableIdentities.set(portableIdentity, relativePath)
        const depth = childSegments.length
        if (depth > this.limits.maxDepth) throw new Error(`Workspace staging depth limit exceeded at ${relativePath}`)
        if (Buffer.byteLength(relativePath) > this.limits.maxRelativePathBytes) {
          throw new Error(`Workspace staging path length limit exceeded at ${relativePath}`)
        }
        const source = join(directory, entry.name)
        const before = await lstat(source, { bigint: true })
        if (before.isSymbolicLink()) throw new Error(`Workspace staging rejects symbolic links: ${relativePath}`)
        if (before.isDirectory()) {
          directoriesVisited += 1
          if (directoriesVisited > this.limits.maxDirectories) {
            throw new Error("Workspace staging directory count limit exceeded")
          }
        }
        const excluded = isExcluded(relativePath, before.isDirectory())
        if (excluded) {
          if (mode === "stage") throw new Error(`Staged workspace contains excluded secret or runtime path: ${relativePath}`)
          excludedPaths.push(relativePath)
          if (excludedPaths.length > this.limits.maxExcludedPaths) {
            throw new Error("Workspace staging excluded-path count limit exceeded")
          }
          continue
        }
        if (before.isDirectory()) {
          if (copyRoot && expectedCopyRootIdentity) {
            await this.assertCopyAncestors(copyRoot, expectedCopyRootIdentity, relativePath, copyDirectoryIdentities)
            const copyDirectory = containedPath(copyRoot, relativePath)
            await mkdir(copyDirectory, { mode: 0o700 })
            const copyMetadata = await lstat(copyDirectory, { bigint: true })
            if (!copyMetadata.isDirectory() || copyMetadata.isSymbolicLink()) {
              throw new Error(`Workspace copy directory is unsafe: ${relativePath}`)
            }
            copyDirectoryIdentities.set(relativePath, this.fileIdentity(copyMetadata))
            await this.assertCopyAncestors(copyRoot, expectedCopyRootIdentity, `${relativePath}/.sentinel`, copyDirectoryIdentities)
            await this.syncParentDirectory(copyDirectory)
          }
          await visit(source, childSegments, before)
          continue
        }
        if (!before.isFile()) throw new Error(`Workspace staging rejects non-regular files: ${relativePath}`)
        if (before.size > BigInt(this.limits.maxFileBytes)) throw new Error(`Workspace staging file size limit exceeded at ${relativePath}`)
        if (files.size + 1 > this.limits.maxFiles) throw new Error("Workspace staging file count limit exceeded")
        const capture = await this.readBoundedStableFile(
          source,
          `Workspace file ${relativePath}`,
          this.limits.maxFileBytes,
          before,
        )
        await assertDirectory(directory, expectedDirectory)
        const content = capture.bytes
        totalBytes += content.length
        if (totalBytes > this.limits.maxTotalBytes) throw new Error("Workspace staging total size limit exceeded")
        const snapshot: FileSnapshot = {
          path: relativePath,
          digest: digestBytes(content),
          size: content.length,
          mode: Number(capture.metadata.mode),
          device: capture.metadata.dev.toString(),
          inode: capture.metadata.ino.toString(),
          modifiedAt: capture.metadata.mtimeNs.toString(),
          changedAt: capture.metadata.ctimeNs.toString(),
        }
        files.set(relativePath, snapshot)
        if (copyRoot && expectedCopyRootIdentity) {
          const target = containedPath(copyRoot, relativePath)
          const assertCopyTarget = () => this.assertCopyAncestors(
            copyRoot,
            expectedCopyRootIdentity,
            relativePath,
            copyDirectoryIdentities,
          )
          await assertCopyTarget()
          await this.durableAtomicWrite(target, content, Number(capture.metadata.mode & 0o777n), {
            beforeTemporaryCreate: assertCopyTarget,
            beforeCommit: async () => {
              await assertCopyTarget()
              try {
                await lstat(target)
                throw new Error(`Workspace copy target appeared concurrently: ${relativePath}`)
              } catch (error) {
                if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
              }
            },
          })
        }
      }
      await assertDirectory(directory, expectedDirectory)
    }
    const rootMetadata = await lstat(root, { bigint: true })
    if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
      throw new Error("Workspace staging root is not a safe directory")
    }
    if (expectedRootIdentity && !this.sameFileIdentity(this.fileIdentity(rootMetadata), expectedRootIdentity)) {
      throw new Error("Workspace staging root identity changed")
    }
    await visit(root, [], rootMetadata)
    if (expectedRootIdentity) await this.assertRootIdentity(root, expectedRootIdentity, "Workspace staging")
    return { digest: snapshotDigest(files), files, directories, totalBytes }
  }

  private async readBoundedDirectory(
    path: string,
    maximumEntries: number,
    label: string,
    overflowMessage?: string,
  ): Promise<Dirent[]> {
    if (!Number.isSafeInteger(maximumEntries) || maximumEntries < 0) {
      throw new Error(`${label} inventory bound is invalid`)
    }
    const entries: Dirent[] = []
    const directory = await opendir(path)
    for await (const entry of directory) {
      if (entries.length >= maximumEntries) throw new Error(overflowMessage ?? `${label} inventory exceeds its bound`)
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

  private async assertSafeAncestors(root: string, target: string): Promise<void> {
    const difference = relative(root, target)
    if (!difference || difference.startsWith(`..${sep}`) || difference === ".." || isAbsolute(difference)) {
      throw new Error("Apply target escapes the source workspace")
    }
    let current = root
    for (const segment of difference.split(sep).slice(0, -1)) {
      current = join(current, segment)
      try {
        const stats = await lstat(current)
        if (stats.isSymbolicLink() || !stats.isDirectory()) throw new Error(`Unsafe apply ancestor: ${portablePath(relative(root, current))}`)
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") break
        throw error
      }
    }
  }

  private async assertCopyAncestors(
    root: string,
    rootIdentity: FileIdentity,
    relativeTarget: string,
    directoryIdentities: ReadonlyMap<string, FileIdentity>,
  ): Promise<void> {
    await this.assertRootIdentity(root, rootIdentity, "Workspace copy")
    const segments = relativeTarget.split("/")
    for (let index = 1; index < segments.length; index += 1) {
      const relativeDirectory = segments.slice(0, index).join("/")
      const expected = directoryIdentities.get(relativeDirectory)
      if (!expected) throw new Error(`Workspace copy ancestor is unbound: ${relativeDirectory}`)
      const metadata = await lstat(containedPath(root, relativeDirectory), { bigint: true })
      if (!metadata.isDirectory() || metadata.isSymbolicLink() ||
          !this.sameFileIdentity(this.fileIdentity(metadata), expected)) {
        throw new Error(`Workspace copy ancestor changed: ${relativeDirectory}`)
      }
    }
  }

  private async assertSnapshotAncestors(
    root: string,
    relativeTarget: string,
    directoryIdentities: ReadonlyMap<string, DirectorySnapshotIdentity>,
  ): Promise<void> {
    const segments = relativeTarget.split("/")
    for (let index = 0; index < segments.length; index += 1) {
      const relativeDirectory = segments.slice(0, index).join("/")
      const expected = directoryIdentities.get(relativeDirectory)
      if (!expected) break
      const directory = relativeDirectory ? containedPath(root, relativeDirectory) : root
      const metadata = await lstat(directory, { bigint: true })
      if (!metadata.isDirectory() || metadata.isSymbolicLink() ||
          !this.sameFileIdentity(this.fileIdentity(metadata), expected)) {
        throw new Error(`Source ancestor changed after baseline verification: ${relativeDirectory || "."}`)
      }
    }
  }

  private async assertPathAbsent(path: string, message: string): Promise<void> {
    try {
      await lstat(path)
      throw new Error(message)
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return
      throw error
    }
  }

  private sourceTemporaryPath(
    targetPath: string,
    journalId: string,
    entryIndex: number,
    phase: "apply" | "rollback",
  ): string {
    const segments = targetPath.split("/")
    segments.pop()
    return [...segments, `.gaep-${phase}-${journalId}-${entryIndex}.tmp`].join("/")
  }

  private async planCreatedDirectories(
    root: string,
    target: string,
    journalId: string,
    entryIndex: number,
  ): Promise<ApplyJournalDirectoryIntent[]> {
    const parentRelative = portablePath(relative(root, dirname(target)))
    if (!parentRelative) return []
    validatePortableRelativePath(parentRelative)
    const segments = parentRelative.split("/")
    const intents: ApplyJournalDirectoryIntent[] = []
    let missing = false
    for (let directoryIndex = 0; directoryIndex < segments.length; directoryIndex += 1) {
      const path = segments.slice(0, directoryIndex + 1).join("/")
      const absolute = containedPath(root, path)
      if (!missing) {
        try {
          const metadata = await lstat(absolute)
          if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
            throw new Error(`Unsafe apply ancestor: ${path}`)
          }
          continue
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
          missing = true
        }
      }
      const parentSegments = segments.slice(0, directoryIndex)
      intents.push({
        path,
        temporaryPath: [
          ...parentSegments,
          `.gaep-dir-${journalId}-${entryIndex}-${directoryIndex}.tmp`,
        ].join("/"),
        created: false,
      })
    }
    return intents
  }

  private async materializeCreatedDirectories(
    root: string,
    rootIdentity: FileIdentity,
    intents: ApplyJournalDirectoryIntent[],
    journalPath: string,
    journal: ApplyJournal,
    directoryIntentsByPath: ReadonlyMap<string, ApplyJournalDirectoryIntent>,
  ): Promise<void> {
    for (const intent of intents) {
      const target = containedPath(root, intent.path)
      await this.assertRootIdentity(root, rootIdentity, "Source workspace")
      await this.assertJournalCreatedAncestors(root, intent.path, directoryIntentsByPath)
      await this.assertSafeAncestors(root, target)
      await this.beforeCreatedDirectoryRename?.(intent.path)
      await this.assertRootIdentity(root, rootIdentity, "Source workspace")
      await this.assertJournalCreatedAncestors(root, intent.path, directoryIntentsByPath)
      // mkdir is the no-replace primitive for create-only directory effects;
      // unlike rename, it cannot replace a concurrently-created empty target.
      await mkdir(target, { mode: 0o700 })
      const metadata = await lstat(target, { bigint: true })
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        throw new Error(`Created-directory target is unsafe: ${intent.path}`)
      }
      intent.device = metadata.dev.toString()
      intent.inode = metadata.ino.toString()
      await this.afterCreatedDirectoryCreate?.(intent.path)
      await this.writeJournal(journalPath, journal)
      const materialized = await lstat(target, { bigint: true })
      if (!materialized.isDirectory() || materialized.isSymbolicLink() ||
          materialized.dev.toString() !== intent.device || materialized.ino.toString() !== intent.inode) {
        throw new Error(`Created apply directory identity changed during materialization: ${intent.path}`)
      }
      await this.syncParentDirectory(target)
      try {
        await this.afterCreatedDirectoryRename?.(intent.path)
      } catch (error) {
        if (error instanceof WorkspaceProcessDeathSimulationError) throw error
        throw error
      }
      intent.created = true
      await this.writeJournal(journalPath, journal)
    }
  }

  private async cleanupCreatedDirectories(root: string, intents: ApplyJournalDirectoryIntent[]): Promise<void> {
    for (const intent of [...intents].reverse()) {
      const unusedTemporary = containedPath(root, intent.temporaryPath)
      await this.assertSafeAncestors(root, unusedTemporary)
      try {
        await lstat(unusedTemporary)
        throw new Error(`Unowned directory temporary path was preserved: ${intent.temporaryPath}`)
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
      }
      if (intent.device && intent.inode) {
        await this.removeOwnedEmptyDirectory(
          root,
          containedPath(root, intent.path),
          { device: intent.device, inode: intent.inode },
          false,
        )
      } else {
        try {
          await lstat(containedPath(root, intent.path))
          throw new Error(`Unbound apply directory target was preserved: ${intent.path}`)
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
        }
      }
    }
  }

  private async cleanupJournalTemporaryFiles(root: string, entry: ApplyJournalEntry): Promise<void> {
    for (const temporary of [
      entry.sourceTemporaryPath && entry.sourceTemporaryDigest && entry.sourceTemporarySize !== undefined &&
          entry.sourceTemporaryMode !== undefined && entry.sourceTemporaryDevice && entry.sourceTemporaryInode
        ? {
            path: entry.sourceTemporaryPath,
            digest: entry.sourceTemporaryDigest,
            size: entry.sourceTemporarySize,
            mode: entry.sourceTemporaryMode,
            device: entry.sourceTemporaryDevice,
            inode: entry.sourceTemporaryInode,
          }
        : undefined,
      entry.rollbackTemporaryPath && entry.rollbackTemporaryDigest && entry.rollbackTemporarySize !== undefined &&
          entry.rollbackTemporaryMode !== undefined && entry.rollbackTemporaryDevice && entry.rollbackTemporaryInode
        ? {
            path: entry.rollbackTemporaryPath,
            digest: entry.rollbackTemporaryDigest,
            size: entry.rollbackTemporarySize,
            mode: entry.rollbackTemporaryMode,
            device: entry.rollbackTemporaryDevice,
            inode: entry.rollbackTemporaryInode,
          }
        : undefined,
    ]) {
      if (!temporary) continue
      const path = containedPath(root, temporary.path)
      await this.assertSafeAncestors(root, path)
      let captured
      try {
        captured = await this.readBoundedStableFile(
          path,
          `Journal-bound source temporary ${temporary.path}`,
          this.limits.maxFileBytes,
        )
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") continue
        throw error
      }
      const metadata = captured.metadata
      if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1n ||
          metadata.dev.toString() !== temporary.device || metadata.ino.toString() !== temporary.inode ||
          captured.bytes.length !== temporary.size || Number(metadata.mode & 0o777n) !== temporary.mode ||
          digestBytes(captured.bytes) !== temporary.digest) {
        throw new Error(`Journal-bound source temporary changed before rollback cleanup: ${temporary.path}`)
      }
      await this.assertSafeAncestors(root, path)
      const final = await this.readBoundedStableFile(
        path,
        `Journal-bound source temporary ${temporary.path}`,
        this.limits.maxFileBytes,
        metadata,
      )
      if (!final.bytes.equals(captured.bytes)) {
        throw new Error(`Journal-bound source temporary changed during rollback cleanup: ${temporary.path}`)
      }
      await unlink(path)
      await this.syncParentDirectory(path)
    }
  }

  private async assertJournalCreatedAncestors(
    root: string,
    targetPath: string,
    directoryIntentsByPath: ReadonlyMap<string, ApplyJournalDirectoryIntent>,
  ): Promise<void> {
    const segments = targetPath.split("/")
    for (let index = 1; index < segments.length; index += 1) {
      const path = segments.slice(0, index).join("/")
      const intent = directoryIntentsByPath.get(path)
      if (!intent?.device || !intent.inode) continue
      const metadata = await lstat(containedPath(root, intent.path), { bigint: true })
      if (!metadata.isDirectory() || metadata.isSymbolicLink() ||
          metadata.dev.toString() !== intent.device || metadata.ino.toString() !== intent.inode) {
        throw new Error(`Created apply parent identity changed before source mutation: ${intent.path}`)
      }
    }
  }

  private async removeOwnedEmptyDirectory(
    root: string,
    path: string,
    expectedIdentity: { device: string; inode: string } | undefined,
    allowUnboundReservedTemporary: boolean,
  ): Promise<void> {
    await this.assertSafeAncestors(root, path)
    let metadata
    try {
      metadata = await lstat(path, { bigint: true })
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return
      throw error
    }
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(`Owned apply directory changed before cleanup: ${path}`)
    if (expectedIdentity &&
        (metadata.dev.toString() !== expectedIdentity.device || metadata.ino.toString() !== expectedIdentity.inode)) {
      throw new Error(`Owned apply directory identity changed before cleanup: ${path}`)
    }
    if (!expectedIdentity && !allowUnboundReservedTemporary) return
    if (!await this.isDirectoryEmpty(path)) throw new Error(`Owned apply directory is nonempty and was preserved: ${path}`)
    await this.assertSafeAncestors(root, path)
    const final = await lstat(path, { bigint: true })
    if (!final.isDirectory() || final.isSymbolicLink() || final.dev !== metadata.dev || final.ino !== metadata.ino ||
        !await this.isDirectoryEmpty(path)) {
      throw new Error(`Owned apply directory changed during cleanup: ${path}`)
    }
    await rmdir(path)
    await this.syncParentDirectory(path)
  }

  private async syncParentDirectory(path: string): Promise<void> {
    if (process.platform === "win32") return
    const parent = dirname(path)
    const handle = await open(parent, constants.O_RDONLY | (constants.O_DIRECTORY ?? 0))
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
  }

  private async syncDirectoryPath(path: string): Promise<void> {
    if (process.platform === "win32") return
    const handle = await open(path, constants.O_RDONLY | (constants.O_DIRECTORY ?? 0))
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
  }

  private fileIdentity(metadata: BigIntStats): FileIdentity {
    return { device: metadata.dev.toString(), inode: metadata.ino.toString() }
  }

  private sameFileIdentity(left: FileIdentity, right: FileIdentity): boolean {
    return left.device === right.device && left.inode === right.inode
  }

  private parseFileIdentity(value: unknown): FileIdentity | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
    const identity = value as Record<string, unknown>
    if (Object.keys(identity).length !== 2 || typeof identity.device !== "string" ||
        typeof identity.inode !== "string" || !/^\d+$/u.test(identity.device) || !/^\d+$/u.test(identity.inode)) {
      return undefined
    }
    return { device: identity.device, inode: identity.inode }
  }

  private sameStableMetadata(left: BigIntStats, right: BigIntStats): boolean {
    return left.isFile() && right.isFile() && !left.isSymbolicLink() && !right.isSymbolicLink() &&
      left.nlink === 1n && right.nlink === 1n && left.dev === right.dev && left.ino === right.ino &&
      left.size === right.size && left.mode === right.mode && left.mtimeNs === right.mtimeNs &&
      left.ctimeNs === right.ctimeNs
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

  private async readBoundedStableFile(
    path: string,
    label: string,
    maximumBytes: number,
    expectedMetadata?: BigIntStats,
  ): Promise<{ bytes: Buffer; metadata: BigIntStats }> {
    const before = await lstat(path, { bigint: true })
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n) {
      throw new Error(`${label} is not a safe regular file`)
    }
    if (before.size > BigInt(maximumBytes)) throw new Error(`${label} exceeds its bounded size`)
    if (expectedMetadata && !this.sameStableMetadata(before, expectedMetadata)) {
      throw new Error(`${label} changed before bounded capture`)
    }
    const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0
    const handle = await open(path, constants.O_RDONLY | noFollow)
    try {
      const opened = await handle.stat({ bigint: true })
      if (!this.sameStableMetadata(before, opened)) throw new Error(`${label} changed before it could be opened`)
      const bytes = await this.readExactBounded(handle, Number(opened.size), maximumBytes, label)
      const after = await handle.stat({ bigint: true })
      const pathAfter = await lstat(path, { bigint: true })
      if (!this.sameStableMetadata(opened, after) || !this.sameStableMetadata(after, pathAfter)) {
        throw new Error(`${label} changed while it was being read`)
      }
      return { bytes, metadata: after }
    } finally {
      await handle.close()
    }
  }

  private async assertExactTemporary(
    path: string,
    content: Buffer,
    mode: number,
    expectedIdentity: FileIdentity,
    expectedMetadata: BigIntStats,
  ): Promise<void> {
    const captured = await this.readBoundedStableFile(path, "Journal-bound temporary", content.length, expectedMetadata)
    if (!this.sameFileIdentity(this.fileIdentity(captured.metadata), expectedIdentity) ||
        Number(captured.metadata.mode & 0o777n) !== (mode & 0o777) || !captured.bytes.equals(content)) {
      throw new Error("Journal-bound temporary changed and was preserved")
    }
  }

  private async assertExactTemporaryMetadata(
    path: string,
    mode: number,
    expectedIdentity: FileIdentity,
    expectedMetadata: BigIntStats,
  ): Promise<void> {
    const metadata = await lstat(path, { bigint: true })
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1n ||
        !this.sameFileIdentity(this.fileIdentity(metadata), expectedIdentity) ||
        !this.sameStableMetadata(metadata, expectedMetadata) ||
        Number(metadata.mode & 0o777n) !== (mode & 0o777)) {
      throw new Error("Journal-bound temporary changed immediately before atomic replacement")
    }
  }

  private async assertRootIdentity(root: string, expected: FileIdentity, label: string): Promise<void> {
    const metadata = await lstat(root, { bigint: true })
    if (!metadata.isDirectory() || metadata.isSymbolicLink() ||
        !this.sameFileIdentity(this.fileIdentity(metadata), expected) || await realpath(root) !== root) {
      throw new Error(`${label} root identity changed`)
    }
  }

  private async assertTempParentIdentity(): Promise<void> {
    const metadata = await lstat(this.tempParent, { bigint: true })
    if (!metadata.isDirectory() || metadata.isSymbolicLink() ||
        !this.sameFileIdentity(this.fileIdentity(metadata), this.tempParentIdentity) ||
        await realpath(this.tempParent) !== this.tempParent) {
      throw new Error("Workspace staging temporary parent identity changed")
    }
    if (this.tempParentOwnerUid !== undefined) {
      const mode = Number(metadata.mode & 0o7777n)
      const privateOwnedParent = metadata.uid === this.tempParentOwnerUid && (mode & 0o077) === 0
      const protectedSharedParent = metadata.uid === 0n && (mode & 0o1000) !== 0 && (mode & 0o002) !== 0
      if (!privateOwnedParent && !protectedSharedParent) {
        throw new Error("Workspace staging temporary parent lost its trusted ownership or permission boundary")
      }
    }
    if (this.windowsTrustedTempRoot) {
      const trusted = await lstat(this.windowsTrustedTempRoot.path, { bigint: true })
      if (!trusted.isDirectory() || trusted.isSymbolicLink() ||
          !this.sameFileIdentity(this.fileIdentity(trusted), this.windowsTrustedTempRoot.identity) ||
          await realpath(this.windowsTrustedTempRoot.path) !== this.windowsTrustedTempRoot.path) {
        throw new Error("Workspace staging Windows temporary boundary changed")
      }
    }
  }

  private async assertSourceRootIdentity(record: StageRecord): Promise<void> {
    await this.assertRootIdentity(record.publicStage.sourceRoot, record.sourceRootIdentity, "Source workspace")
  }

  private async assertBoundJournalRoots(
    journalRoot: string,
    journalRootIdentity: FileIdentity,
    backupRoot: string,
    backupRootIdentity: FileIdentity,
  ): Promise<void> {
    await this.assertTempParentIdentity()
    if (dirname(journalRoot) !== this.tempParent || backupRoot !== join(journalRoot, "backups")) {
      throw new Error("Apply journal root binding escaped its trusted temporary parent")
    }
    await this.assertRootIdentity(journalRoot, journalRootIdentity, "Apply journal")
    await this.assertRootIdentity(backupRoot, backupRootIdentity, "Apply journal backup")
  }

  private async removeOwnedRoot(
    root: string,
    expectedIdentity: FileIdentity,
    boundChildren: readonly { path: string; identity: FileIdentity }[],
    tombstoneName: string,
    options: { requireEmpty?: boolean } = {},
  ): Promise<void> {
    await this.assertTempParentIdentity()
    if (dirname(root) !== this.tempParent) throw new Error("Owned temporary root escapes its parent")
    const tombstone = join(this.tempParent, tombstoneName)
    let sourcePresent = false
    try {
      await this.assertRootIdentity(root, expectedIdentity, "Owned temporary")
      sourcePresent = true
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
    }
    if (sourcePresent) {
      for (const child of boundChildren) await this.assertRootIdentity(child.path, child.identity, "Owned temporary child")
    }
    let tombstonePresent = false
    try {
      await this.assertRootIdentity(tombstone, expectedIdentity, "Owned temporary tombstone")
      tombstonePresent = true
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
    }
    if (tombstonePresent) {
      for (const child of boundChildren) {
        try {
          await this.assertRootIdentity(
            join(tombstone, relative(root, child.path)),
            child.identity,
            "Owned temporary tombstone child",
          )
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
        }
      }
    }
    if (sourcePresent && tombstonePresent) throw new Error("Owned temporary exists in active and tombstone locations")
    if (!sourcePresent && !tombstonePresent) return
    if (sourcePresent) {
      await rename(root, tombstone)
      await this.syncParentDirectory(tombstone)
      await this.assertRootIdentity(tombstone, expectedIdentity, "Owned temporary tombstone")
      for (const child of boundChildren) {
        await this.assertRootIdentity(
          join(tombstone, relative(root, child.path)),
          child.identity,
          "Owned temporary tombstone child",
        )
      }
    }
    if (options.requireEmpty) {
      if (!await this.isDirectoryEmpty(tombstone)) {
        throw new Error("Owned temporary tombstone became nonempty and was preserved")
      }
      await rmdir(tombstone)
    } else {
      await rm(tombstone, { recursive: true })
    }
    await this.syncParentDirectory(tombstone)
  }

  private async atomicWrite(
    root: string,
    target: string,
    content: Buffer,
    mode: number,
    options: {
      temporaryPath: string
      phase: "apply" | "rollback"
      relativePath: string
      afterTemporarySync: (identity: { device: string; inode: string }) => void | Promise<void>
      beforeCommit?: () => void | Promise<void>
      afterCommit?: () => void | Promise<void>
    },
  ): Promise<void> {
    await this.assertSafeAncestors(root, target)
    if (dirname(options.temporaryPath) !== dirname(target)) {
      throw new Error("Journal-bound source temporary path must share the apply target parent")
    }
    await this.durableAtomicWrite(
      target,
      content,
      mode & 0o777,
      {
        temporaryPath: options.temporaryPath,
        afterTemporarySync: options.afterTemporarySync,
        afterDurableTemporary: () => this.afterSourceTemporarySync?.(options.phase, options.relativePath),
        beforeCommit: async () => {
          await this.assertSafeAncestors(root, target)
          await options.beforeCommit?.()
        },
        afterCommit: options.afterCommit,
      },
    )
  }

  private evidence(
    stageId: string,
    inspection: WorkspaceStageInspection,
    applied: boolean,
    journalDigest: `sha256:${string}`,
  ): ManagedStagingEvidence {
    const evidence: ManagedStagingEvidence = {
      baselineDigest: inspection.baselineDigest,
      finalDigest: inspection.finalDigest,
      changes: inspection.changes,
      excludedPaths: inspection.excludedPaths,
      applied,
      applyJournalDigest: journalDigest,
    }
    this.stagingEvidence.set(evidence, stageId)
    return evidence
  }

  private assertProjectedJournalBound(journal: ApplyJournal): void {
    const projected = structuredClone(journal)
    projected.state = "rollback-failed"
    projected.error = "x".repeat(4_096)
    const identityMaximum = "9".repeat(128)
    const digestMaximum = `sha256:${"f".repeat(64)}` as const
    for (const [index, entry] of projected.entries.entries()) {
      if (entry.kind !== "deleted") {
        entry.sourceTemporaryDevice = identityMaximum
        entry.sourceTemporaryInode = identityMaximum
      }
      if (entry.kind !== "added") {
        entry.backupPath = `backups/${index}.bin`
        entry.backupTemporaryPath = `.gaep-backup-${projected.id}-${index}.tmp`
        entry.backupDigest = digestMaximum
        entry.backupSize = this.limits.maxFileBytes
        entry.backupMode = 0o777
        entry.rollbackTemporaryPath = this.sourceTemporaryPath(entry.path, projected.id, index, "rollback")
        entry.rollbackTemporaryDigest = digestMaximum
        entry.rollbackTemporarySize = this.limits.maxFileBytes
        entry.rollbackTemporaryMode = 0o777
        entry.rollbackTemporaryDevice = identityMaximum
        entry.rollbackTemporaryInode = identityMaximum
      }
      for (const directory of entry.createdDirectories ?? []) {
        directory.device = identityMaximum
        directory.inode = identityMaximum
        directory.created = false
      }
    }
    const projectedBytes = Buffer.byteLength(`${JSON.stringify(projected, null, 2)}\n`)
    if (projectedBytes > this.limits.maxJournalBytes) {
      throw new Error("Projected apply journal exceeds its immutable hard byte bound")
    }
    const nonDeleted = projected.entries.filter((entry) => entry.kind !== "deleted").length
    const nonAdded = projected.entries.filter((entry) => entry.kind !== "added").length
    const directoryCount = projected.entries.reduce(
      (count, entry) => count + (entry.createdDirectories?.length ?? 0),
      0,
    )
    const projectedWrites = 4 + (projected.entries.length * 2) + nonDeleted + (directoryCount * 2) + nonAdded
    if (projectedWrites > maximumApplyJournalWrites ||
        projectedBytes * projectedWrites > maximumApplyJournalTotalBytes) {
      throw new Error("Projected apply journal rewrite work exceeds its immutable hard budget")
    }
  }

  private boundedJournalError(value: string): string {
    const projectionSafe = value.slice(0, 4_096).replace(/[^\x20-\x21\x23-\x5B\x5D-\x7E]/gu, "?")
    return projectionSafe.length <= 4_096 ? projectionSafe : projectionSafe.slice(0, 4_096)
  }

  private async writeJournal(path: string, journal: ApplyJournal): Promise<`sha256:${string}`> {
    await this.beforeJournalWrite?.(journal.state, this.journalWriteSequence++)
    const serialized = `${JSON.stringify(journal, null, 2)}\n`
    if (Buffer.byteLength(serialized) > this.limits.maxJournalBytes) {
      throw new Error("Apply journal exceeds its immutable hard byte bound")
    }
    const binding = this.journals.get(resolve(path))
    if (!binding || path !== join(binding.root, "journal.json")) {
      throw new Error("Apply journal root identity binding is unavailable")
    }
    const assertBinding = () => this.assertBoundJournalRoots(
      binding.root,
      binding.identity,
      binding.backupRoot,
      binding.backupIdentity,
    )
    await this.durableAtomicWrite(path, Buffer.from(serialized), 0o600, {
      beforeTemporaryCreate: assertBinding,
      beforeCommit: assertBinding,
      afterCommit: assertBinding,
    })
    return digestBytes(Buffer.from(serialized))
  }

  private async durableAtomicWrite(
    path: string,
    content: Buffer,
    mode: number,
    options?: {
      temporaryPath?: string
      afterTemporarySync?: (identity: { device: string; inode: string }) => void | Promise<void>
      afterDurableTemporary?: () => void | Promise<void>
      beforeTemporaryCreate?: () => void | Promise<void>
      beforeCommit?: () => void | Promise<void>
      afterCommit?: () => void | Promise<void>
    },
  ): Promise<void> {
    const parent = dirname(path)
    const temporary = options?.temporaryPath ?? join(parent, `.gaep-durable-${randomUUID()}`)
    let handle: FileHandle | undefined
    let createdIdentity: FileIdentity | undefined
    let durableIdentity: FileIdentity | undefined
    let durableMetadata: BigIntStats | undefined
    let preserveTemporary = false
    let primaryError: unknown
    try {
      await options?.beforeTemporaryCreate?.()
      handle = await open(temporary, "wx", mode)
      const openedMetadata = await handle.stat({ bigint: true })
      createdIdentity = this.fileIdentity(openedMetadata)
      await handle.chmod(mode & 0o777)
      await handle.writeFile(content)
      await handle.sync()
      durableMetadata = await handle.stat({ bigint: true })
      durableIdentity = this.fileIdentity(durableMetadata)
      if (!this.sameFileIdentity(createdIdentity, durableIdentity) || durableMetadata.size !== BigInt(content.length) ||
          Number(durableMetadata.mode & 0o777n) !== (mode & 0o777)) {
        throw new Error("Journal-bound source temporary identity changed while it was written")
      }
      await options?.afterTemporarySync?.(durableIdentity)
      await handle.close()
      handle = undefined
      try {
        await options?.afterDurableTemporary?.()
      } catch (error) {
        if (error instanceof WorkspaceProcessDeathSimulationError) preserveTemporary = true
        throw error
      }
      await this.assertExactTemporary(temporary, content, mode, durableIdentity, durableMetadata)
      await options?.beforeCommit?.()
      await this.assertExactTemporaryMetadata(temporary, mode, durableIdentity, durableMetadata)
      await rename(temporary, path)
      await options?.afterCommit?.()
      await this.syncParentDirectory(path)
    } catch (error) {
      primaryError = error
    }

    let cleanupError: unknown
    try {
      await handle?.close()
      if (!preserveTemporary && createdIdentity) {
        let exists = true
        try {
          await lstat(temporary)
        } catch (error) {
          if (error instanceof Error && "code" in error && error.code === "ENOENT") exists = false
          else throw error
        }
        if (!exists) {
          await this.syncParentDirectory(temporary)
        } else if (!durableIdentity || !durableMetadata) {
          throw new Error("Owned temporary could not be exact-validated after an incomplete write and was preserved")
        } else {
          await this.assertExactTemporary(temporary, content, mode, durableIdentity, durableMetadata)
          await unlink(temporary)
          await this.syncParentDirectory(temporary)
        }
      }
    } catch (error) {
      cleanupError = error
    }
    if (primaryError && cleanupError) {
      throw new AggregateError([primaryError, cleanupError], "Durable atomic write and exact-owned cleanup both failed")
    }
    if (primaryError) throw primaryError
    if (cleanupError) throw cleanupError
  }

  private async captureExpectedFile(
    root: string,
    relativePath: string,
    baseline: ExpectedFileState,
  ): Promise<StableFileCapture | undefined> {
    const target = containedPath(root, relativePath)
    await this.assertSafeAncestors(root, target)
    if (!baseline) {
      try {
        await lstat(target)
        throw new Error(`Apply target appeared after baseline: ${relativePath}`)
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined
        throw error
      }
    }
    try {
      const captured = await this.readStableFile(target, relativePath)
      if (captured.size !== baseline.size || captured.digest !== baseline.digest ||
          (captured.mode & 0o777) !== (baseline.mode & 0o777) ||
          (baseline.device !== undefined && captured.device !== baseline.device) ||
          (baseline.inode !== undefined && captured.inode !== baseline.inode) ||
          (baseline.modifiedAt !== undefined && captured.modifiedAt !== baseline.modifiedAt) ||
          (baseline.changedAt !== undefined && captured.changedAt !== baseline.changedAt)) {
        throw new Error(`Apply target changed after baseline verification: ${relativePath}`)
      }
      return captured
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        if (baseline) throw new Error(`Apply target disappeared after baseline verification: ${relativePath}`)
        return undefined
      }
      throw error
    }
  }

  private async assertCapturedFileStillCurrent(
    root: string,
    relativePath: string,
    captured: StableFileCapture | undefined,
  ): Promise<void> {
    const current = await this.captureExpectedFile(root, relativePath, captured)
    if (!captured || !current) return
    if (current.device !== captured.device || current.inode !== captured.inode ||
        current.modifiedAt !== captured.modifiedAt || current.changedAt !== captured.changedAt ||
        current.digest !== captured.digest || current.size !== captured.size ||
        (current.mode & 0o777) !== (captured.mode & 0o777)) {
      throw new Error(`Apply target changed immediately before source mutation: ${relativePath}`)
    }
  }

  private async readStableFile(path: string, relativePath: string): Promise<StableFileCapture> {
    const captured = await this.readBoundedStableFile(path, `Apply target ${relativePath}`, this.limits.maxFileBytes)
    const metadata = captured.metadata
    return {
      path: relativePath,
      bytes: captured.bytes,
      digest: digestBytes(captured.bytes),
      size: captured.bytes.length,
      mode: Number(metadata.mode & 0o777n),
      device: metadata.dev.toString(),
      inode: metadata.ino.toString(),
      modifiedAt: metadata.mtimeNs.toString(),
      changedAt: metadata.ctimeNs.toString(),
    }
  }

  private async targetMatchesExpectedState(
    root: string,
    relativePath: string,
    expected: ExpectedFileState,
  ): Promise<boolean> {
    const target = containedPath(root, relativePath)
    try {
      await this.assertSafeAncestors(root, target)
      if (!expected) {
        await lstat(target)
        return false
      }
      const captured = await this.readBoundedStableFile(target, `Apply target ${relativePath}`, this.limits.maxFileBytes)
      return captured.bytes.length === expected.size && digestBytes(captured.bytes) === expected.digest &&
        Number(captured.metadata.mode & 0o777n) === (expected.mode & 0o777)
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return expected === undefined
      throw error
    }
  }
}
