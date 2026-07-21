import { randomUUID } from "node:crypto"
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import {
  auditEventSchema,
  repositoryManifestSchema,
  type AuditEvent,
  type RepositoryManifest,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import type { ZodType } from "zod"

const directoryNames = [
  "profiles",
  "initiatives",
  "changes",
  "decisions",
  "requirements",
  "architecture",
  "risks",
  "evidence",
  "candidates",
  "sessions",
  "handoffs",
  "audit",
  "policies",
  "runtime",
] as const

export class GaepRepository {
  readonly root: string

  constructor(readonly workspacePath: string) {
    this.root = join(workspacePath, ".gaep")
  }

  resolve(...segments: string[]): string {
    return join(this.root, ...segments)
  }

  async initialize(productId: string, engineVersion = "0.1.0"): Promise<RepositoryManifest> {
    await mkdir(this.root, { recursive: true })
    for (const directory of directoryNames) await mkdir(this.resolve(directory), { recursive: true })
    const path = this.resolve("manifest.json")
    try {
      return await this.readJson(path, repositoryManifestSchema)
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
    }
    const manifest: RepositoryManifest = {
      format: "gaep-project",
      schemaVersion: 1,
      productId,
      createdAt: new Date().toISOString(),
      engineVersion,
    }
    await this.writeJson(path, manifest, repositoryManifestSchema)
    return manifest
  }

  async readJson<T>(path: string, schema: ZodType<T>): Promise<T> {
    const text = await readFile(path, "utf8")
    return schema.parse(JSON.parse(text))
  }

  async writeJson<T>(path: string, value: T, schema: ZodType<T>): Promise<void> {
    const validated = schema.parse(value)
    await mkdir(dirname(path), { recursive: true })
    const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, { encoding: "utf8", mode: 0o600 })
    await rename(temporaryPath, path)
  }

  async appendAudit(input: {
    eventType: string
    actor: AuditEvent["actor"]
    subjectId?: string
    payload?: Record<string, unknown>
  }): Promise<AuditEvent> {
    const path = this.resolve("audit", "events.jsonl")
    await mkdir(dirname(path), { recursive: true })
    let previous: AuditEvent | undefined
    try {
      const lines = (await readFile(path, "utf8")).trim().split("\n").filter(Boolean)
      if (lines.length > 0) previous = auditEventSchema.parse(JSON.parse(lines.at(-1)!))
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
    }
    const unsigned = {
      schemaVersion: 1 as const,
      id: randomUUID(),
      sequence: (previous?.sequence ?? 0) + 1,
      eventType: input.eventType,
      occurredAt: new Date().toISOString(),
      actor: input.actor,
      subjectId: input.subjectId,
      payload: input.payload ?? {},
      previousHash: previous?.hash ?? null,
    }
    const event = auditEventSchema.parse({ ...unsigned, hash: canonicalDigest(unsigned) })
    const handle = await open(path, "a", 0o600)
    try {
      await handle.write(`${JSON.stringify(event)}\n`)
      await handle.sync()
    } finally {
      await handle.close()
    }
    return event
  }

  async verifyAudit(): Promise<{ valid: boolean; events: number; error?: string }> {
    const path = this.resolve("audit", "events.jsonl")
    let lines: string[]
    try {
      lines = (await readFile(path, "utf8")).trim().split("\n").filter(Boolean)
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return { valid: true, events: 0 }
      throw error
    }
    let previousHash: string | null = null
    for (let index = 0; index < lines.length; index += 1) {
      try {
        const event = auditEventSchema.parse(JSON.parse(lines[index]!))
        const { hash, ...unsigned } = event
        if (event.sequence !== index + 1) return { valid: false, events: index, error: "Sequence gap" }
        if (event.previousHash !== previousHash) return { valid: false, events: index, error: "Previous hash mismatch" }
        if (canonicalDigest(unsigned) !== hash) return { valid: false, events: index, error: "Event hash mismatch" }
        previousHash = hash
      } catch (error) {
        return { valid: false, events: index, error: error instanceof Error ? error.message : "Invalid audit event" }
      }
    }
    return { valid: true, events: lines.length }
  }

  async withLock<T>(operation: () => Promise<T>): Promise<T> {
    const lockPath = this.resolve("runtime", "engine.lock")
    await mkdir(dirname(lockPath), { recursive: true })
    let lock
    try {
      lock = await open(lockPath, "wx", 0o600)
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") {
        throw new Error("Another GAEP operation is changing this workspace")
      }
      throw error
    }
    try {
      await lock.writeFile(JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }))
      return await operation()
    } finally {
      await lock.close()
      await rm(lockPath, { force: true })
    }
  }
}
