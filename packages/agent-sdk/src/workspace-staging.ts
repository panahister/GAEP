import { createHash, randomUUID } from "node:crypto"
import { lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rename, rm, unlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"

import { canonicalDigest } from "./digest.js"
import type { ManagedChangedFile, ManagedStagingEvidence } from "./managed-runtime.js"

export interface WorkspaceStagingLimits {
  maxFiles: number
  maxFileBytes: number
  maxTotalBytes: number
  maxDepth: number
  maxRelativePathBytes: number
}

export interface WorkspaceStage {
  readonly id: string
  readonly kind: "gaep-isolated-workspace-staging-v1"
  readonly sourceRoot: string
  readonly root: string
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

export interface WorkspaceApplyResult {
  status: "applied" | "conflict" | "no-changes"
  evidence: ManagedStagingEvidence
  journalDigest: `sha256:${string}`
  journalPath: string
}

export interface WorkspaceApplyOptions {
  authorizationId: string
  approvedPaths: string[]
}

interface FileSnapshot {
  path: string
  digest: `sha256:${string}`
  size: number
  mode: number
}

type ExpectedFileState = Pick<FileSnapshot, "digest" | "size" | "mode"> | undefined

interface Snapshot {
  digest: `sha256:${string}`
  files: Map<string, FileSnapshot>
  totalBytes: number
}

interface StageRecord {
  publicStage: WorkspaceStage
  tempRoot: string
  baseline: Snapshot
  excludedPaths: string[]
  cleaned: boolean
}

interface ApplyJournalEntry {
  path: string
  kind: ManagedChangedFile["kind"]
  backupPath?: string
  applied: boolean
  rolledBack: boolean
}

interface ApplyJournal {
  schemaVersion: 1
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

export interface WorkspaceStagingServiceOptions {
  tempParent?: string
  limits?: Partial<WorkspaceStagingLimits>
  beforeApplyOperation?: (path: string, index: number) => void | Promise<void>
  beforeJournalWrite?: (state: ApplyJournal["state"], index: number) => void | Promise<void>
}

const defaultLimits: WorkspaceStagingLimits = {
  maxFiles: 20_000,
  maxFileBytes: 16 * 1024 * 1024,
  maxTotalBytes: 512 * 1024 * 1024,
  maxDepth: 64,
  maxRelativePathBytes: 4_096,
}

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
  if (segments.some((segment, index) => segment === ".gaep" && ["runtime", "locks", "sessions", "local"].includes(segments[index + 1] ?? ""))) return true
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
  private readonly limits: WorkspaceStagingLimits
  private readonly stages = new Map<string, StageRecord>()
  private readonly journals = new Map<string, string>()
  private readonly stagingEvidence = new WeakMap<ManagedStagingEvidence, string>()
  private readonly beforeApplyOperation?: WorkspaceStagingServiceOptions["beforeApplyOperation"]
  private readonly beforeJournalWrite?: WorkspaceStagingServiceOptions["beforeJournalWrite"]
  private journalWriteSequence = 0

  constructor(options: WorkspaceStagingServiceOptions = {}) {
    this.tempParent = resolve(options.tempParent ?? tmpdir())
    this.limits = { ...defaultLimits, ...options.limits }
    this.beforeApplyOperation = options.beforeApplyOperation
    this.beforeJournalWrite = options.beforeJournalWrite
    for (const [key, value] of Object.entries(this.limits)) {
      if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${key} must be a positive safe integer`)
    }
  }

  async create(sourcePath: string): Promise<WorkspaceStage> {
    const sourceRoot = await realpath(resolve(sourcePath))
    const sourceStats = await lstat(sourceRoot)
    if (!sourceStats.isDirectory() || sourceStats.isSymbolicLink()) throw new Error("Staging source must be a real directory")
    const tempRoot = await mkdtemp(join(this.tempParent, "gaep-stage-"))
    const stageRoot = join(tempRoot, "workspace")
    await mkdir(stageRoot, { mode: 0o700 })
    try {
      const excludedPaths: string[] = []
      const baseline = await this.scan(sourceRoot, "source", stageRoot, excludedPaths)
      const stageBaseline = await this.scan(stageRoot, "stage")
      if (stageBaseline.digest !== baseline.digest) throw new Error("Staging copy digest does not match its source baseline")
      const stage: WorkspaceStage = {
        id: randomUUID(),
        kind: "gaep-isolated-workspace-staging-v1",
        sourceRoot,
        root: stageRoot,
        baselineDigest: baseline.digest,
        excludedPaths: Object.freeze([...excludedPaths].sort()),
        state: "ready",
      }
      for (const key of ["id", "kind", "sourceRoot", "root", "baselineDigest", "excludedPaths"] as const) {
        Object.defineProperty(stage, key, { configurable: false, writable: false })
      }
      this.stages.set(stage.id, {
        publicStage: stage,
        tempRoot,
        baseline,
        excludedPaths: [...excludedPaths].sort(),
        cleaned: false,
      })
      return stage
    } catch (error) {
      await rm(tempRoot, { recursive: true, force: true })
      throw error
    }
  }

  async inspect(stage: WorkspaceStage): Promise<WorkspaceStageInspection> {
    const record = this.requireStage(stage)
    const final = await this.scan(record.publicStage.root, "stage")
    return {
      baselineDigest: record.baseline.digest,
      finalDigest: final.digest,
      changes: compareSnapshots(record.baseline, final),
      excludedPaths: [...record.excludedPaths],
    }
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

  async apply(stage: WorkspaceStage, options: WorkspaceApplyOptions): Promise<WorkspaceApplyResult> {
    const record = this.requireStage(stage)
    if (!options.authorizationId.trim()) throw new Error("A non-empty apply authorization ID is required")
    const inspection = await this.inspect(stage)
    const changedPaths = inspection.changes.map((change) => change.path).sort()
    const approvedPaths = [...new Set(options.approvedPaths)].sort()
    for (const path of approvedPaths) validatePortableRelativePath(path)
    if (JSON.stringify(changedPaths) !== JSON.stringify(approvedPaths)) {
      throw new Error("Approved paths must exactly match the inspected staged change inventory")
    }

    const journalRoot = await mkdtemp(join(this.tempParent, "gaep-apply-journal-"))
    const journalPath = join(journalRoot, "journal.json")
    this.journals.set(journalPath, journalRoot)
    const backupRoot = join(journalRoot, "backups")
    await mkdir(backupRoot, { recursive: true, mode: 0o700 })
    const journal: ApplyJournal = {
      schemaVersion: 1,
      id: randomUUID(),
      stageId: stage.id,
      authorizationId: options.authorizationId,
      baselineDigest: inspection.baselineDigest,
      intendedFinalDigest: inspection.finalDigest,
      state: "prepared",
      entries: inspection.changes.map((change) => ({ path: change.path, kind: change.kind, applied: false, rolledBack: false })),
    }
    const changesByPath = new Map(inspection.changes.map((change) => [change.path, change]))

    const current = await this.scan(record.publicStage.sourceRoot, "source", undefined, [])
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
        const target = containedPath(record.publicStage.sourceRoot, entry.path)
        const baseline = record.baseline.files.get(entry.path)
        await this.assertTargetMatchesBaseline(record.publicStage.sourceRoot, entry.path, baseline)
        if (baseline) {
          const backupPath = containedPath(backupRoot, entry.path)
          await mkdir(dirname(backupPath), { recursive: true, mode: 0o700 })
          await this.durableAtomicWrite(backupPath, await readFile(target), baseline.mode & 0o777)
          entry.backupPath = portablePath(relative(journalRoot, backupPath))
        }
        if (entry.kind === "deleted") {
          await this.assertSafeAncestors(record.publicStage.sourceRoot, target)
          await unlink(target)
        } else {
          const stagedFile = containedPath(record.publicStage.root, entry.path)
          const change = changesByPath.get(entry.path)
          if (!change?.afterDigest || change.afterSize === undefined || change.afterMode === undefined) {
            throw new Error(`Staged change evidence is incomplete for ${entry.path}`)
          }
          const stagedStats = await lstat(stagedFile)
          if (!stagedStats.isFile() || stagedStats.isSymbolicLink()) throw new Error(`Staged apply source is not a regular file: ${entry.path}`)
          const stagedContent = await readFile(stagedFile)
          const stagedAfter = await lstat(stagedFile)
          if (
            !stagedAfter.isFile() ||
            stagedAfter.isSymbolicLink() ||
            stagedStats.dev !== stagedAfter.dev ||
            stagedStats.ino !== stagedAfter.ino ||
            stagedStats.size !== stagedAfter.size ||
            stagedStats.mtimeMs !== stagedAfter.mtimeMs ||
            stagedContent.length !== change.afterSize ||
            digestBytes(stagedContent) !== change.afterDigest ||
            (stagedAfter.mode & 0o777) !== change.afterMode
          ) {
            throw new Error(`Staged apply source changed after inspection: ${entry.path}`)
          }
          await this.atomicWrite(record.publicStage.sourceRoot, target, stagedContent, stagedAfter.mode)
        }
        entry.applied = true
        await this.writeJournal(journalPath, journal)
      }
      const applied = await this.scan(record.publicStage.sourceRoot, "source", undefined, [])
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
      journal.state = "rolling-back"
      journal.error = error instanceof Error ? error.message : String(error)
      await this.writeJournal(journalPath, journal)
      let rollbackSucceeded = true
      for (const entry of [...journal.entries].reverse()) {
        if (!entry.applied) continue
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
          if (!(await this.targetMatchesExpectedState(record.publicStage.sourceRoot, entry.path, appliedState))) {
            if (await this.targetMatchesExpectedState(record.publicStage.sourceRoot, entry.path, baselineState)) {
              entry.rolledBack = true
              continue
            }
            throw new Error(`Apply target changed concurrently before rollback: ${entry.path}`)
          }
          if (entry.backupPath) {
            const backup = containedPath(journalRoot, entry.backupPath)
            const backupStats = await lstat(backup)
            await this.atomicWrite(record.publicStage.sourceRoot, target, await readFile(backup), backupStats.mode)
          } else {
            await rm(target, { force: true })
          }
          if (!(await this.targetMatchesExpectedState(record.publicStage.sourceRoot, entry.path, baselineState))) {
            throw new Error(`Rollback verification failed for ${entry.path}`)
          }
          entry.rolledBack = true
        } catch (rollbackError) {
          rollbackSucceeded = false
          journal.error += `; rollback failed for ${entry.path}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`
        }
      }
      journal.state = rollbackSucceeded ? "rolled-back" : "rollback-failed"
      const journalDigest = await this.writeJournal(journalPath, journal)
      throw new WorkspaceApplyError(journal.error, journalPath, journalDigest, rollbackSucceeded)
    }
  }

  async cleanup(stage: WorkspaceStage): Promise<void> {
    const record = this.requireStage(stage)
    record.cleaned = true
    Object.defineProperty(record.publicStage, "state", { configurable: false, value: "cleaned", writable: false })
    await rm(record.tempRoot, { recursive: true, force: true })
    this.stages.delete(stage.id)
  }

  async disposeJournal(journalPath: string, expectedDigest: `sha256:${string}`): Promise<void> {
    const resolvedPath = resolve(journalPath)
    const journalRoot = this.journals.get(resolvedPath)
    if (!journalRoot || resolvedPath !== join(journalRoot, "journal.json")) {
      throw new Error("Apply journal is unknown or already disposed")
    }
    const actualDigest = digestBytes(await readFile(resolvedPath))
    if (actualDigest !== expectedDigest) throw new Error("Apply journal digest changed before disposal")
    await rm(journalRoot, { recursive: true, force: true })
    this.journals.delete(resolvedPath)
  }

  private requireStage(stage: WorkspaceStage): StageRecord {
    const record = this.stages.get(stage.id)
    if (!record || record.publicStage !== stage || record.cleaned || stage.state !== "ready" || stage.kind !== "gaep-isolated-workspace-staging-v1") {
      throw new Error("Workspace stage is unknown, forged, or already cleaned")
    }
    return record
  }

  private async scan(
    root: string,
    mode: "source" | "stage",
    copyRoot?: string,
    excludedPaths: string[] = [],
  ): Promise<Snapshot> {
    const files = new Map<string, FileSnapshot>()
    const portableIdentities = new Map<string, string>()
    let totalBytes = 0
    const visit = async (directory: string, segments: string[]): Promise<void> => {
      const entries = await readdir(directory, { withFileTypes: true })
      entries.sort((left, right) => left.name.localeCompare(right.name))
      for (const entry of entries) {
        const childSegments = [...segments, entry.name]
        const relativePath = childSegments.join("/")
        validatePortableRelativePath(relativePath)
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
        const excluded = isExcluded(relativePath, entry.isDirectory())
        if (excluded) {
          if (mode === "stage") throw new Error(`Staged workspace contains excluded secret or runtime path: ${relativePath}`)
          excludedPaths.push(relativePath)
          continue
        }
        const source = join(directory, entry.name)
        const before = await lstat(source)
        if (before.isSymbolicLink() || entry.isSymbolicLink()) throw new Error(`Workspace staging rejects symbolic links: ${relativePath}`)
        if (before.isDirectory()) {
          if (copyRoot) await mkdir(containedPath(copyRoot, relativePath), { recursive: true, mode: 0o700 })
          await visit(source, childSegments)
          continue
        }
        if (!before.isFile()) throw new Error(`Workspace staging rejects non-regular files: ${relativePath}`)
        if (before.size > this.limits.maxFileBytes) throw new Error(`Workspace staging file size limit exceeded at ${relativePath}`)
        if (files.size + 1 > this.limits.maxFiles) throw new Error("Workspace staging file count limit exceeded")
        totalBytes += before.size
        if (totalBytes > this.limits.maxTotalBytes) throw new Error("Workspace staging total size limit exceeded")
        const content = await readFile(source)
        const after = await lstat(source)
        if (!after.isFile() || after.isSymbolicLink() || before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
          throw new Error(`Workspace file changed while staging: ${relativePath}`)
        }
        const snapshot: FileSnapshot = {
          path: relativePath,
          digest: digestBytes(content),
          size: content.length,
          mode: before.mode,
        }
        files.set(relativePath, snapshot)
        if (copyRoot) {
          const target = containedPath(copyRoot, relativePath)
          await mkdir(dirname(target), { recursive: true, mode: 0o700 })
          await writeFile(target, content, { mode: before.mode & 0o777 })
        }
      }
    }
    await visit(root, [])
    return { digest: snapshotDigest(files), files, totalBytes }
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

  private async atomicWrite(root: string, target: string, content: Buffer, mode: number): Promise<void> {
    await this.assertSafeAncestors(root, target)
    await mkdir(dirname(target), { recursive: true, mode: 0o700 })
    await this.assertSafeAncestors(root, target)
    await this.durableAtomicWrite(target, content, mode & 0o777)
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

  private async writeJournal(path: string, journal: ApplyJournal): Promise<`sha256:${string}`> {
    await this.beforeJournalWrite?.(journal.state, this.journalWriteSequence++)
    const serialized = `${JSON.stringify(journal, null, 2)}\n`
    await this.durableAtomicWrite(path, Buffer.from(serialized), 0o600)
    return digestBytes(Buffer.from(serialized))
  }

  private async durableAtomicWrite(path: string, content: Buffer, mode: number): Promise<void> {
    const parent = dirname(path)
    const temporary = join(parent, `.gaep-durable-${randomUUID()}`)
    let handle
    try {
      handle = await open(temporary, "wx", mode)
      await handle.writeFile(content)
      await handle.sync()
      await handle.close()
      handle = undefined
      try {
        await rename(temporary, path)
      } catch (error) {
        if (process.platform !== "win32" || !(error instanceof Error && "code" in error && ["EEXIST", "EPERM"].includes(String(error.code)))) {
          throw error
        }
        await rm(path, { force: true })
        await rename(temporary, path)
      }
      const parentHandle = await open(parent, "r")
      try {
        await parentHandle.sync()
      } finally {
        await parentHandle.close()
      }
    } finally {
      await handle?.close()
      await rm(temporary, { force: true })
    }
  }

  private async assertTargetMatchesBaseline(
    root: string,
    relativePath: string,
    baseline: FileSnapshot | undefined,
  ): Promise<void> {
    const target = containedPath(root, relativePath)
    try {
      const stats = await lstat(target)
      if (!baseline) throw new Error(`Apply target appeared after baseline: ${relativePath}`)
      if (!stats.isFile() || stats.isSymbolicLink()) throw new Error(`Apply target is no longer a regular file: ${relativePath}`)
      const content = await readFile(target)
      if (content.length !== baseline.size || digestBytes(content) !== baseline.digest) {
        throw new Error(`Apply target changed after baseline verification: ${relativePath}`)
      }
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        if (baseline) throw new Error(`Apply target disappeared after baseline verification: ${relativePath}`)
        return
      }
      throw error
    }
  }

  private async targetMatchesExpectedState(
    root: string,
    relativePath: string,
    expected: ExpectedFileState,
  ): Promise<boolean> {
    const target = containedPath(root, relativePath)
    try {
      const before = await lstat(target)
      if (!expected || !before.isFile() || before.isSymbolicLink()) return false
      const content = await readFile(target)
      const after = await lstat(target)
      return after.isFile() &&
        !after.isSymbolicLink() &&
        before.dev === after.dev &&
        before.ino === after.ino &&
        before.size === after.size &&
        before.mtimeMs === after.mtimeMs &&
        content.length === expected.size &&
        digestBytes(content) === expected.digest &&
        (after.mode & 0o777) === (expected.mode & 0o777)
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return expected === undefined
      throw error
    }
  }
}
