import { createHash, randomUUID } from "node:crypto"
import { constants, lstatSync, realpathSync, type BigIntStats } from "node:fs"
import { lstat, mkdir, open, readdir, realpath, rename, rm, unlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path"

import type { WorkspaceStage } from "./workspace-staging.js"

export type ManagedStageRegistryState =
  | "staging"
  | "review-required"
  | "applying"
  | "journal-retained"
  | "recovering"
  | "quarantined"

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
  sourceWorkspacePath: string
  state: ManagedStageRegistryState
  journalPath?: string
  journalDigest?: `sha256:${string}`
  journalRootIdentity?: FileIdentity
  journalFileIdentity?: FileIdentity
  quarantinePath?: string
  ownerLease?: {
    pid: number
    token: string
    acquiredAt: string
  }
  recoveryOperation?: {
    id: string
    fromState: Exclude<ManagedStageRegistryState, "recovering" | "quarantined">
    startedAt: string
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
  status: "absent" | "cleaned" | "quarantined"
  quarantinePath?: string
}

export type ManagedStageRecoveryReason =
  | "journal-missing"
  | "quarantine-missing"
  | "quarantine-conflict"
  | "stage-active"
  | "lock-timeout"
  | "quarantine-limit"

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
const maximumJournalBytes = 32 * 1024 * 1024
const maximumQuarantineEntries = 64
const maximumQuarantineFiles = 20_000
const maximumQuarantineBytes = 512 * 1024 * 1024
const defaultLockWaitMs = 15_000
const defaultStaleLockMs = 5_000

export interface ManagedStageRegistryOptions {
  lockWaitMs?: number
  staleLockMs?: number
  isProcessAlive?: (pid: number) => boolean
}

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

function parseRecord(value: unknown): ManagedStageRegistryRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Managed stage registry record is malformed")
  const record = value as Record<string, unknown>
  const keys = new Set(Object.keys(record))
  for (const key of [
    "schemaVersion", "generation", "managedRunId", "stageId", "stageTempRoot", "stageIdentity", "sourceWorkspacePath", "state",
    "journalPath", "journalDigest", "journalRootIdentity", "journalFileIdentity", "quarantinePath", "ownerLease",
    "recoveryOperation", "updatedAt",
  ]) keys.delete(key)
  const stageIdentity = parseIdentity(record.stageIdentity)
  const journalRootIdentity = record.journalRootIdentity === undefined ? undefined : parseIdentity(record.journalRootIdentity)
  const journalFileIdentity = record.journalFileIdentity === undefined ? undefined : parseIdentity(record.journalFileIdentity)
  const journalFieldsComplete = record.journalDigest !== undefined && journalRootIdentity !== undefined && journalFileIdentity !== undefined
  const journalFieldsAbsent = record.journalDigest === undefined && journalRootIdentity === undefined && journalFileIdentity === undefined
  const state = record.state
  const validState = typeof state === "string" &&
    ["staging", "review-required", "applying", "journal-retained", "recovering", "quarantined"].includes(state)
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
  const validStateFields = state === "journal-retained"
    ? typeof record.journalPath === "string" && record.quarantinePath === undefined && journalFieldsComplete &&
      record.ownerLease === undefined && record.recoveryOperation === undefined
    : state === "quarantined"
      ? record.journalPath === undefined && typeof record.quarantinePath === "string" && journalFieldsComplete &&
        record.ownerLease === undefined && record.recoveryOperation === undefined
      : state === "recovering"
        ? record.quarantinePath === undefined && validRecoveryOperation && record.ownerLease === undefined &&
          (record.journalPath === undefined ? journalFieldsAbsent : journalFieldsComplete)
        : record.journalPath === undefined && record.quarantinePath === undefined && journalFieldsAbsent &&
          validOwnerLease && record.recoveryOperation === undefined
  if (keys.size > 0 || record.schemaVersion !== 2 || !Number.isSafeInteger(record.generation) || Number(record.generation) < 1 ||
      typeof record.managedRunId !== "string" ||
      !runIdPattern.test(record.managedRunId) || typeof record.stageId !== "string" || !runIdPattern.test(record.stageId) ||
      typeof record.stageTempRoot !== "string" || !stageIdentity || typeof record.sourceWorkspacePath !== "string" ||
      !validState || typeof record.updatedAt !== "string" || !Number.isFinite(Date.parse(record.updatedAt)) ||
      (record.journalPath !== undefined && typeof record.journalPath !== "string") ||
      (record.journalDigest !== undefined && (typeof record.journalDigest !== "string" || !digestPattern.test(record.journalDigest))) ||
      (record.quarantinePath !== undefined && typeof record.quarantinePath !== "string") || !validStateFields) {
    throw new Error("Managed stage registry record is malformed")
  }
  return {
    ...(record as unknown as ManagedStageRegistryRecord),
    stageIdentity,
    ...(validOwnerLease ? { ownerLease: ownerLease as ManagedStageRegistryRecord["ownerLease"] } : {}),
    ...(validRecoveryOperation
      ? { recoveryOperation: recoveryOperation as ManagedStageRegistryRecord["recoveryOperation"] }
      : {}),
    ...(journalRootIdentity ? { journalRootIdentity } : {}),
    ...(journalFileIdentity ? { journalFileIdentity } : {}),
  }
}

function isNoEntry(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}

function digestBytes(value: Buffer): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`
}

export class ManagedStageRegistry {
  readonly root: string
  private readonly tempParent: string
  private readonly tempParentIdentity: FileIdentity
  private readonly ownerUid: bigint
  private readonly lockWaitMs: number
  private readonly staleLockMs: number
  private readonly isProcessAlive: (pid: number) => boolean
  private registryRootIdentity: FileIdentity | undefined

  constructor(tempParent = tmpdir(), options: ManagedStageRegistryOptions = {}) {
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
    this.ownerUid = BigInt(uid)
    const requestedParent = resolve(tempParent)
    this.tempParent = realpathSync(requestedParent)
    const parentMetadata = lstatSync(this.tempParent, { bigint: true })
    if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink()) {
      throw new Error("Managed stage registry temporary parent is unsafe")
    }
    const parentMode = Number(parentMetadata.mode & 0o7777n)
    const privateOwnedParent = parentMetadata.uid === this.ownerUid && (parentMode & 0o077) === 0
    const protectedSharedParent = parentMetadata.uid === 0n && (parentMode & 0o1000) !== 0 && (parentMode & 0o002) !== 0
    if (!privateOwnedParent && !protectedSharedParent) {
      throw new Error("Managed stage registry temporary parent lacks a trusted ownership and permission boundary")
    }
    this.tempParentIdentity = identityOf(parentMetadata)
    this.root = join(this.tempParent, `gaep-managed-stage-registry-v2-u${uid}`)
    this.lockWaitMs = options.lockWaitMs ?? defaultLockWaitMs
    this.staleLockMs = options.staleLockMs ?? defaultStaleLockMs
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
    await this.withRunLock(managedRunId, async () => {
      if (!runIdPattern.test(stage.id) || stage.kind !== "gaep-isolated-workspace-staging-v1" || stage.state !== "ready") {
        throw new Error("Managed stage registry requires a valid ready workspace stage")
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
      const stageIdentity = await this.assertStageRoot(stageTempRoot)
      const workspaceIdentity = await this.assertPrivateDirectory(stageRoot, "Managed workspace stage", 0o700)
      const sourceWorkspacePath = resolve(stage.sourceRoot)
      if (sourceWorkspacePath !== stage.sourceRoot) throw new Error("Managed stage registry source workspace path is not canonical")
      const sourceMetadata = await lstat(sourceWorkspacePath)
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
        sourceWorkspacePath,
        state: "staging",
        ownerLease: { pid: process.pid, token: randomUUID(), acquiredAt: now },
        updatedAt: now,
      }, { mustBeAbsent: true })
    })
  }

  async markReview(managedRunId: string): Promise<void> {
    await this.withRunLock(managedRunId, () => this.updateLocked(managedRunId, (record) => {
      if (record.state !== "staging") throw new Error("Managed stage registry can mark review only from staging state")
      return { ...record, state: "review-required" }
    }))
  }

  async markApplying(managedRunId: string): Promise<void> {
    await this.withRunLock(managedRunId, () => this.updateLocked(managedRunId, (record) => {
      if (record.state !== "review-required") throw new Error("Managed stage registry can mark applying only from review-required state")
      return { ...record, state: "applying" }
    }))
  }

  async retainJournal(
    managedRunId: string,
    journalPath: string,
    journalDigest: `sha256:${string}`,
  ): Promise<void> {
    this.assertRunId(managedRunId)
    await this.withRunLock(managedRunId, async () => {
      if (!digestPattern.test(journalDigest)) throw new Error("Managed apply journal digest is invalid")
      const presentedJournalPath = resolve(journalPath)
      const presentedJournalMetadata = await lstat(presentedJournalPath)
      if (!presentedJournalMetadata.isFile() || presentedJournalMetadata.isSymbolicLink()) {
        throw new Error("Managed apply journal path is unsafe")
      }
      const canonicalJournalPath = await realpath(presentedJournalPath)
      const inspected = await this.inspectJournal(canonicalJournalPath, { expectedDigest: journalDigest })
      await this.updateLocked(managedRunId, (record) => {
        if (record.state !== "applying") throw new Error("Managed stage registry can retain a journal only from applying state")
        return {
          ...record,
          state: "journal-retained",
          ownerLease: undefined,
          journalPath: canonicalJournalPath,
          journalDigest,
          journalRootIdentity: inspected.rootIdentity,
          journalFileIdentity: inspected.fileIdentity,
        }
      })
    })
  }

  async complete(managedRunId: string): Promise<void> {
    this.assertRunId(managedRunId)
    await this.withRunLock(managedRunId, async () => {
      const snapshot = await this.read(managedRunId)
      if (!snapshot) return
      const { record } = snapshot
      if (await this.pathExists(record.stageTempRoot)) {
        throw new Error("Managed stage registry cannot complete while its staged workspace still exists")
      }
      if (record.journalPath && await this.pathExists(dirname(record.journalPath))) {
        throw new Error("Managed stage registry cannot complete while its apply journal still exists")
      }
      if (record.quarantinePath && await this.pathExists(record.quarantinePath)) {
        throw new Error("Managed stage registry cannot complete while its quarantined journal still exists")
      }
      await this.removeRecord(managedRunId, snapshot.fileIdentity)
    })
  }

  async recover(managedRunId: string): Promise<ManagedStageRecoveryResult> {
    this.assertRunId(managedRunId)
    return this.withRunLock(managedRunId, () => this.recoverLocked(managedRunId))
  }

  async disposeQuarantine(managedRunId: string): Promise<void> {
    this.assertRunId(managedRunId)
    await this.withRunLock(managedRunId, async () => {
      const snapshot = await this.read(managedRunId)
      if (!snapshot) return
      const { record } = snapshot
      if (record.state !== "quarantined" || !record.quarantinePath) {
        throw new Error("Managed stage registry can dispose only an explicitly quarantined journal")
      }
      const quarantinePath = this.assertQuarantinePath(managedRunId, record.quarantinePath)
      await this.inspectQuarantinedJournal(record, quarantinePath)
      const registryIdentity = await this.ensureSafeRegistryRoot()
      const tombstoneRoot = await this.ensureTombstoneRoot(registryIdentity)
      const tombstone = join(tombstoneRoot.path, `.quarantine-${managedRunId}-${randomUUID()}`)
      await rename(quarantinePath, tombstone)
      await this.assertPrivateDirectory(
        tombstone,
        "Managed quarantined journal tombstone",
        0o700,
        record.journalRootIdentity,
      )
      await this.inspectBoundedPrivateTree(tombstone, maximumQuarantineFiles, maximumQuarantineBytes)
      await rm(tombstone, { recursive: true })
      await this.syncDirectory(tombstoneRoot.path, tombstoneRoot.identity, "Managed stage tombstone root", 0o700, true)
      const quarantineRoot = await this.ensureQuarantineRoot(registryIdentity)
      await this.syncDirectory(quarantineRoot.path, quarantineRoot.identity, "Managed stage quarantine root", 0o700, true)
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

  private async recoverLocked(managedRunId: string): Promise<ManagedStageRecoveryResult> {
    let snapshot = await this.read(managedRunId)
    if (!snapshot) return { status: "absent" }
    let { record } = snapshot
    if (record.state === "quarantined") {
      const quarantinePath = this.assertQuarantinePath(managedRunId, record.quarantinePath!)
      try {
        await this.inspectQuarantinedJournal(record, quarantinePath)
      } catch (error) {
        if (isNoEntry(error)) {
          throw new ManagedStageRecoveryError(
            "quarantine-missing",
            "Managed apply journal quarantine is missing; recovery is incomplete",
          )
        }
        throw error
      }
      return { status: "quarantined", quarantinePath }
    }

    if (record.state !== "recovering") {
      if (record.ownerLease && this.isProcessAlive(record.ownerLease.pid)) {
        throw new ManagedStageRecoveryError(
          "stage-active",
          `Managed stage is still owned by live process ${record.ownerLease.pid}; recovery is deferred`,
        )
      }
      const operationId = randomUUID()
      const now = new Date().toISOString()
      await this.write({
        ...record,
        generation: record.generation + 1,
        state: "recovering",
        ownerLease: undefined,
        recoveryOperation: {
          id: operationId,
          fromState: record.state,
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
      const quarantinePath = await this.quarantineJournal(record)
      await this.removeStage(record.stageTempRoot, record.stageIdentity)
      await this.write({
        ...record,
        generation: record.generation + 1,
        state: "quarantined",
        journalPath: undefined,
        quarantinePath,
        recoveryOperation: undefined,
        updatedAt: new Date().toISOString(),
      }, { expectedIdentity: snapshot.fileIdentity, expectedGeneration: record.generation })
      return { status: "quarantined", quarantinePath }
    }

    await this.removeStage(record.stageTempRoot, record.stageIdentity)
    await this.removeRecord(managedRunId, snapshot.fileIdentity)
    return { status: "cleaned" }
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
        let handle = await open(
          lockPath,
          constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
          0o600,
        )
        try {
          await handle.chmod(0o600)
          await handle.writeFile(bytes)
          await handle.sync()
          const metadata = await handle.stat({ bigint: true })
          this.assertOwnedPrivateMetadata(metadata, "Managed stage registry run lock", "file", 0o600, true)
        } finally {
          await handle.close()
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
    const lock = this.parseRunLock(snapshot.bytes, managedRunId)
    if (Date.now() - Date.parse(lock.acquiredAt) < this.staleLockMs || this.isProcessAlive(lock.pid)) return
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
    const movedLock = this.parseRunLock(moved.bytes, managedRunId)
    if (movedLock.token !== lock.token) throw new Error("Managed stage registry stale lock identity changed during reclamation")
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
    let handle
    try {
      handle = await open(
        temporary,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o600,
      )
      await handle.chmod(0o600)
      await handle.writeFile(serialized)
      await handle.sync()
      const temporaryMetadata = await handle.stat({ bigint: true })
      this.assertOwnedPrivateMetadata(temporaryMetadata, "Managed stage registry temporary record", "file", 0o600, true)
      await handle.close()
      handle = undefined
      await this.assertSafeRegistryRoot(rootIdentity)
      await this.assertRecordExpectation(path, expectation)
      await rename(temporary, path)
      await this.syncDirectory(this.root, rootIdentity, "Managed stage registry root", 0o700, true)
      const persisted = await this.readSafeFile(path, "Managed stage registry record", 0o600, maximumRecordBytes)
      if (!persisted.bytes.equals(serialized)) throw new Error("Managed stage registry record changed during durable replacement")
      await this.assertSafeRegistryRoot(rootIdentity)
    } finally {
      await handle?.close()
      await rm(temporary, { force: true })
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
    }
    await this.inspectQuarantinedJournal(record, quarantinePath)
    await this.assertSafeRegistryRoot(registryIdentity)
    return quarantinePath
  }

  private async inspectQuarantinedJournal(record: ManagedStageRegistryRecord, quarantinePath: string): Promise<void> {
    this.assertQuarantinePath(record.managedRunId, quarantinePath)
    const quarantineIdentity = await this.assertPrivateDirectory(
      quarantinePath,
      "Managed quarantined apply journal",
      0o700,
      record.journalRootIdentity,
    )
    const journal = await this.readSafeFile(
      join(quarantinePath, "journal.json"),
      "Managed quarantined apply journal file",
      0o600,
      maximumJournalBytes,
      record.journalFileIdentity,
    )
    if (digestBytes(journal.bytes) !== record.journalDigest) {
      throw new Error("Managed quarantined apply journal digest changed")
    }
    await this.inspectBoundedPrivateTree(quarantinePath, maximumQuarantineFiles, maximumQuarantineBytes)
    await this.assertPrivateDirectory(
      quarantinePath,
      "Managed quarantined apply journal",
      0o700,
      quarantineIdentity,
    )
  }

  private async inspectJournal(
    value: string,
    expected: {
      expectedDigest: `sha256:${string}`
      expectedRootIdentity?: FileIdentity
      expectedFileIdentity?: FileIdentity
    },
  ): Promise<{ rootIdentity: FileIdentity; fileIdentity: FileIdentity }> {
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
    await this.assertPrivateDirectory(journalRoot, "Managed apply journal root", 0o700, rootIdentity)
    return { rootIdentity, fileIdentity: journal.identity }
  }

  private async assertQuarantineCapacity(quarantineRoot: string, incomingRoot: string): Promise<void> {
    const entries = await readdir(quarantineRoot, { withFileTypes: true })
    if (entries.length >= maximumQuarantineEntries) {
      throw new ManagedStageRecoveryError("quarantine-limit", "Managed stage quarantine entry limit is reached")
    }
    let files = 0
    let bytes = 0
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || !runIdPattern.test(entry.name)) {
        throw new Error("Managed stage quarantine root contains an unsafe entry")
      }
      const observed = await this.inspectBoundedPrivateTree(
        join(quarantineRoot, entry.name),
        maximumQuarantineFiles - files,
        maximumQuarantineBytes - bytes,
      )
      files += observed.files
      bytes += observed.bytes
    }
    const incoming = await this.inspectBoundedPrivateTree(
      incomingRoot,
      maximumQuarantineFiles - files,
      maximumQuarantineBytes - bytes,
    )
    files += incoming.files
    bytes += incoming.bytes
    if (files > maximumQuarantineFiles || bytes > maximumQuarantineBytes) {
      throw new ManagedStageRecoveryError("quarantine-limit", "Managed stage quarantine aggregate limit would be exceeded")
    }
  }

  private async inspectBoundedPrivateTree(
    root: string,
    maximumFiles: number,
    maximumBytes: number,
  ): Promise<{ files: number; bytes: number }> {
    const stack = [root]
    let files = 0
    let bytes = 0
    while (stack.length > 0) {
      const directory = stack.pop()!
      const metadata = await lstat(directory, { bigint: true })
      if (!metadata.isDirectory() || metadata.isSymbolicLink() || metadata.uid !== this.ownerUid || await realpath(directory) !== directory) {
        throw new Error("Managed stage quarantine tree contains an unsafe directory")
      }
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name)
        const entryMetadata = await lstat(path, { bigint: true })
        if (entryMetadata.isSymbolicLink() || entryMetadata.uid !== this.ownerUid || await realpath(path) !== path) {
          throw new Error("Managed stage quarantine tree contains an unsafe entry")
        }
        if (entryMetadata.isDirectory()) {
          stack.push(path)
          continue
        }
        if (!entryMetadata.isFile() || entryMetadata.nlink !== 1n) {
          throw new Error("Managed stage quarantine tree contains an unsupported entry")
        }
        files += 1
        bytes += Number(entryMetadata.size)
        if (files > maximumFiles || bytes > maximumBytes) {
          throw new ManagedStageRecoveryError("quarantine-limit", "Managed stage quarantine aggregate limit is exceeded")
        }
      }
    }
    return { files, bytes }
  }

  private async removeStage(stageTempRoot: string, expectedIdentity: FileIdentity): Promise<void> {
    const parentIdentity = await this.assertSafeTempParent()
    let identity: FileIdentity
    try {
      identity = await this.assertStageRoot(stageTempRoot, expectedIdentity)
    } catch (error) {
      if (isNoEntry(error)) return
      throw error
    }
    if (!sameIdentity(identity, expectedIdentity)) throw new Error("Managed stage recovery target was replaced")
    const registryIdentity = await this.ensureSafeRegistryRoot()
    const tombstoneRoot = await this.ensureTombstoneRoot(registryIdentity)
    const tombstone = join(tombstoneRoot.path, `.stage-${randomUUID()}`)
    await rename(stageTempRoot, tombstone)
    await this.assertPrivateDirectory(tombstone, "Managed stage recovery tombstone", 0o700, expectedIdentity)
    await rm(tombstone, { recursive: true })
    await this.syncDirectory(tombstoneRoot.path, tombstoneRoot.identity, "Managed stage tombstone root", 0o700, true)
    await this.syncDirectory(this.tempParent, parentIdentity, "Managed stage temporary parent")
    try {
      await lstat(stageTempRoot)
      throw new Error("Managed stage recovery target was replaced while it was being removed")
    } catch (error) {
      if (!isNoEntry(error)) throw error
    }
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

  private async ensureTombstoneRoot(registryIdentity: FileIdentity): Promise<{ path: string; identity: FileIdentity }> {
    return this.ensurePrivateChildDirectory("tombstones", "Managed stage tombstone root", registryIdentity)
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
    const metadata = await lstat(this.tempParent, { bigint: true })
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || await realpath(this.tempParent) !== this.tempParent) {
      throw new Error("Managed stage registry temporary parent is unsafe")
    }
    const identity = identityOf(metadata)
    if (!sameIdentity(identity, expectedIdentity)) throw new Error("Managed stage registry temporary parent was replaced")
    const mode = Number(metadata.mode & 0o7777n)
    const privateOwnedParent = metadata.uid === this.ownerUid && (mode & 0o077) === 0
    const protectedSharedParent = metadata.uid === 0n && (mode & 0o1000) !== 0 && (mode & 0o002) !== 0
    if (!privateOwnedParent && !protectedSharedParent) {
      throw new Error("Managed stage registry temporary parent lost its trusted ownership or permission boundary")
    }
    return identity
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
    const handle = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
    try {
      await handle.chmod(0o700)
      const metadata = await handle.stat({ bigint: true })
      this.assertOwnedPrivateMetadata(metadata, label, "directory", 0o700, false)
      await handle.sync()
    } finally {
      await handle.close()
    }
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
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    try {
      const opened = await handle.stat({ bigint: true })
      this.assertOwnedPrivateMetadata(opened, label, "file", mode, true)
      if (!sameIdentity(identityOf(opened), beforeIdentity) || before.size !== opened.size ||
          before.mtimeNs !== opened.mtimeNs || before.ctimeNs !== opened.ctimeNs) {
        throw new Error(`${label} was replaced or changed before it could be opened`)
      }
      if (opened.size > BigInt(maximumBytes)) throw new Error(`${label} exceeds its bounded size`)
      const bytes = await handle.readFile()
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
    if (metadata.uid !== this.ownerUid) throw new Error(`${label} is not owned by the current user`)
    if (Number(metadata.mode & 0o777n) !== mode) throw new Error(`${label} must have mode ${mode.toString(8)}`)
    if (requireSingleLink && metadata.nlink !== 1n) throw new Error(`${label} has an unsafe link count`)
  }

  private async syncDirectory(
    path: string,
    expectedIdentity: FileIdentity,
    label: string,
    privateMode?: number,
    requireOwner = false,
  ): Promise<void> {
    const handle = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW)
    try {
      const metadata = await handle.stat({ bigint: true })
      if (!metadata.isDirectory() || metadata.isSymbolicLink() || !sameIdentity(identityOf(metadata), expectedIdentity)) {
        throw new Error(`${label} was replaced before durable synchronization`)
      }
      if (requireOwner && metadata.uid !== this.ownerUid) throw new Error(`${label} is not owned by the current user`)
      if (privateMode !== undefined && Number(metadata.mode & 0o777n) !== privateMode) {
        throw new Error(`${label} must have mode ${privateMode.toString(8)}`)
      }
      await handle.sync()
    } finally {
      await handle.close()
    }
  }

  private recordPath(managedRunId: string): string {
    this.assertRunId(managedRunId)
    return join(this.root, `${managedRunId}.json`)
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
  }
}
