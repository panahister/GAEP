import { randomUUID } from "node:crypto"
import { lstat, mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path"

import type { WorkspaceStage } from "./workspace-staging.js"

export type ManagedStageRegistryState = "staging" | "review-required" | "applying" | "journal-retained" | "quarantined"

interface ManagedStageRegistryRecord {
  schemaVersion: 1
  managedRunId: string
  stageId: string
  stageTempRoot: string
  sourceWorkspacePath: string
  state: ManagedStageRegistryState
  journalPath?: string
  journalDigest?: `sha256:${string}`
  quarantinePath?: string
  updatedAt: string
}

export interface ManagedStageRecoveryResult {
  status: "absent" | "cleaned" | "quarantined"
  quarantinePath?: string
}

const runIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const digestPattern = /^sha256:[0-9a-f]{64}$/

function contained(root: string, candidate: string): boolean {
  const relation = relative(root, candidate)
  return relation !== "" && relation !== ".." && !relation.startsWith(`..${sep}`) && !isAbsolute(relation)
}

function parseRecord(value: unknown): ManagedStageRegistryRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Managed stage registry record is malformed")
  const record = value as Record<string, unknown>
  const keys = new Set(Object.keys(record))
  for (const key of [
    "schemaVersion", "managedRunId", "stageId", "stageTempRoot", "sourceWorkspacePath", "state",
    "journalPath", "journalDigest", "quarantinePath", "updatedAt",
  ]) keys.delete(key)
  if (keys.size > 0 || record.schemaVersion !== 1 || typeof record.managedRunId !== "string" ||
      !runIdPattern.test(record.managedRunId) || typeof record.stageId !== "string" ||
      typeof record.stageTempRoot !== "string" || typeof record.sourceWorkspacePath !== "string" ||
      typeof record.state !== "string" || !["staging", "review-required", "applying", "journal-retained", "quarantined"].includes(record.state) ||
      typeof record.updatedAt !== "string" || !Number.isFinite(Date.parse(record.updatedAt)) ||
      (record.journalPath !== undefined && typeof record.journalPath !== "string") ||
      (record.journalDigest !== undefined && (typeof record.journalDigest !== "string" || !digestPattern.test(record.journalDigest))) ||
      (record.quarantinePath !== undefined && typeof record.quarantinePath !== "string")) {
    throw new Error("Managed stage registry record is malformed")
  }
  return record as unknown as ManagedStageRegistryRecord
}

export class ManagedStageRegistry {
  readonly root: string
  private readonly tempParent: string

  constructor(tempParent = tmpdir()) {
    this.tempParent = resolve(tempParent)
    this.root = join(this.tempParent, "gaep-managed-stage-registry-v1")
  }

  async register(managedRunId: string, stage: WorkspaceStage): Promise<void> {
    this.assertRunId(managedRunId)
    const stageTempRoot = dirname(resolve(stage.root))
    this.assertStageRoot(stageTempRoot)
    await this.write({
      schemaVersion: 1,
      managedRunId,
      stageId: stage.id,
      stageTempRoot,
      sourceWorkspacePath: resolve(stage.sourceRoot),
      state: "staging",
      updatedAt: new Date().toISOString(),
    })
  }

  async markReview(managedRunId: string): Promise<void> {
    await this.update(managedRunId, (record) => ({ ...record, state: "review-required" }))
  }

  async markApplying(managedRunId: string): Promise<void> {
    await this.update(managedRunId, (record) => ({ ...record, state: "applying" }))
  }

  async retainJournal(
    managedRunId: string,
    journalPath: string,
    journalDigest: `sha256:${string}`,
  ): Promise<void> {
    this.assertJournalPath(journalPath)
    if (!digestPattern.test(journalDigest)) throw new Error("Managed apply journal digest is invalid")
    await this.update(managedRunId, (record) => ({
      ...record,
      state: "journal-retained",
      journalPath: resolve(journalPath),
      journalDigest,
    }))
  }

  async complete(managedRunId: string): Promise<void> {
    this.assertRunId(managedRunId)
    await rm(this.recordPath(managedRunId), { force: true })
  }

  async recover(managedRunId: string): Promise<ManagedStageRecoveryResult> {
    this.assertRunId(managedRunId)
    const record = await this.read(managedRunId)
    if (!record) return { status: "absent" }
    if (record.state === "quarantined" && record.quarantinePath) {
      return { status: "quarantined", quarantinePath: record.quarantinePath }
    }
    this.assertStageRoot(record.stageTempRoot)
    await this.removeStage(record.stageTempRoot)
    if (record.journalPath) {
      this.assertJournalPath(record.journalPath)
      const journalRoot = dirname(resolve(record.journalPath))
      const quarantineRoot = join(this.root, "quarantine")
      await mkdir(quarantineRoot, { recursive: true, mode: 0o700 })
      const quarantinePath = join(quarantineRoot, `${managedRunId}-${Date.now()}-${randomUUID()}`)
      try {
        await rename(journalRoot, quarantinePath)
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
      }
      await this.write({
        ...record,
        state: "quarantined",
        journalPath: undefined,
        quarantinePath,
        updatedAt: new Date().toISOString(),
      })
      return { status: "quarantined", quarantinePath }
    }
    await this.complete(managedRunId)
    return { status: "cleaned" }
  }

  private async update(
    managedRunId: string,
    mutate: (record: ManagedStageRegistryRecord) => ManagedStageRegistryRecord,
  ): Promise<void> {
    const record = await this.read(managedRunId)
    if (!record) throw new Error("Managed stage registry record is unavailable")
    await this.write({ ...mutate(record), updatedAt: new Date().toISOString() })
  }

  private async read(managedRunId: string): Promise<ManagedStageRegistryRecord | undefined> {
    const path = this.recordPath(managedRunId)
    try {
      await this.assertSafeRegistryRoot()
      const metadata = await lstat(path)
      if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("Managed stage registry path is unsafe")
      return parseRecord(JSON.parse(await readFile(path, "utf8")))
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined
      throw error
    }
  }

  private async write(record: ManagedStageRegistryRecord): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 })
    await this.assertSafeRegistryRoot()
    const path = this.recordPath(record.managedRunId)
    const temporary = join(this.root, `.${record.managedRunId}.${randomUUID()}.tmp`)
    await writeFile(temporary, `${JSON.stringify(record)}\n`, { mode: 0o600, flag: "wx" })
    try {
      await rename(temporary, path)
      const handle = await open(this.root, "r")
      try { await handle.sync() } finally { await handle.close() }
    } catch (error) {
      await rm(temporary, { force: true })
      throw error
    }
  }

  private async removeStage(stageTempRoot: string): Promise<void> {
    try {
      const metadata = await lstat(stageTempRoot)
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new Error("Managed stage recovery target is unsafe")
      await rm(stageTempRoot, { recursive: true, force: true })
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
    }
  }

  private async assertSafeRegistryRoot(): Promise<void> {
    const metadata = await lstat(this.root)
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error("Managed stage registry root is unsafe")
    }
  }

  private recordPath(managedRunId: string): string {
    this.assertRunId(managedRunId)
    return join(this.root, `${managedRunId}.json`)
  }

  private assertRunId(value: string): void {
    if (!runIdPattern.test(value)) throw new Error("Managed stage registry requires a UUID Managed Run ID")
  }

  private assertStageRoot(value: string): void {
    const resolved = resolve(value)
    if (!contained(this.tempParent, resolved) || !basename(resolved).startsWith("gaep-stage-")) {
      throw new Error("Managed stage registry stage path is outside the expected local temporary root")
    }
  }

  private assertJournalPath(value: string): void {
    const resolved = resolve(value)
    const journalRoot = dirname(resolved)
    if (!contained(this.tempParent, resolved) || basename(resolved) !== "journal.json" ||
        !basename(journalRoot).startsWith("gaep-apply-journal-")) {
      throw new Error("Managed stage registry journal path is outside the expected local temporary root")
    }
  }
}
