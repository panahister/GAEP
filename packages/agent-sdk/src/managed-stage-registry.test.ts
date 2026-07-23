import { access, chmod, chown, link, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { ManagedStageRecoveryError, ManagedStageRegistry } from "./managed-stage-registry.js"
import { WorkspaceStagingService, type WorkspaceStage } from "./workspace-staging.js"

describe("machine-local managed stage registry", () => {
  let temporary: string
  let source: string
  let staging: WorkspaceStagingService
  let registry: ManagedStageRegistry
  const managedRunId = "00000000-0000-4000-8000-000000000111"

  beforeEach(async () => {
    temporary = await mkdtemp(join(tmpdir(), "gaep-stage-registry-test-"))
    source = join(temporary, "source")
    await mkdir(source)
    await writeFile(join(source, "source.txt"), "before")
    staging = new WorkspaceStagingService({ tempParent: temporary })
    registry = new ManagedStageRegistry(temporary)
  })

  afterEach(async () => {
    await rm(temporary, { recursive: true, force: true })
  })

  function recordPath(): string {
    return join(registry.root, `${managedRunId}.json`)
  }

  async function createRetainedJournal(): Promise<{
    stage: WorkspaceStage
    journalPath: string
    journalDigest: `sha256:${string}`
  }> {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    await writeFile(join(stage.root, "source.txt"), "after")
    await registry.markReview(managedRunId)
    await registry.markApplying(managedRunId)
    const applied = await staging.apply(stage, {
      authorizationId: "test-authorization",
      approvedPaths: ["source.txt"],
    })
    await registry.retainJournal(managedRunId, applied.journalPath, applied.journalDigest)
    return { stage, journalPath: applied.journalPath, journalDigest: applied.journalDigest }
  }

  it("uses a current-user scoped private root and private records", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)

    const rootMetadata = await lstat(registry.root, { bigint: true })
    const recordMetadata = await lstat(recordPath(), { bigint: true })
    if (process.platform === "win32") {
      expect(basename(registry.root)).toMatch(/^gaep-managed-stage-registry-v2-w[0-9a-f]{24}$/)
    } else {
      expect(basename(registry.root)).toBe(`gaep-managed-stage-registry-v2-u${process.getuid!()}`)
      expect(rootMetadata.uid).toBe(BigInt(process.getuid!()))
      expect(rootMetadata.mode & 0o777n).toBe(0o700n)
      expect(recordMetadata.uid).toBe(BigInt(process.getuid!()))
      expect(recordMetadata.mode & 0o777n).toBe(0o600n)
    }
    expect(recordMetadata.nlink).toBe(1n)
  })

  it("uses the Windows host boundary without requiring Unix ownership or open flags", async () => {
    const windowsRegistry = new ManagedStageRegistry(temporary, {
      hostPlatform: "windows",
      isProcessAlive: () => false,
    })
    const stage = await staging.create(source)
    await windowsRegistry.register(managedRunId, stage)
    await windowsRegistry.markReview(managedRunId)

    expect(basename(windowsRegistry.root)).toMatch(/^gaep-managed-stage-registry-v2-w[0-9a-f]{24}$/)
    const restarted = new ManagedStageRegistry(temporary, {
      hostPlatform: "windows",
      isProcessAlive: () => false,
    })
    await expect(restarted.recover(managedRunId)).resolves.toEqual({ status: "cleaned" })
    await expect(access(stage.root)).rejects.toMatchObject({ code: "ENOENT" })
    await expect(restarted.recover(managedRunId)).resolves.toEqual({ status: "absent" })
  })

  it("keeps link-identity defenses enabled under the Windows host boundary", async () => {
    const windowsRegistry = new ManagedStageRegistry(temporary, { hostPlatform: "windows" })
    const stage = await staging.create(source)
    await windowsRegistry.register(managedRunId, stage)
    const windowsRecordPath = join(windowsRegistry.root, `${managedRunId}.json`)
    const outsideLink = join(temporary, "windows-record-hard-link.json")
    await link(windowsRecordPath, outsideLink)

    await expect(windowsRegistry.markReview(managedRunId)).rejects.toThrow(/unsafe link count/)
    await expect(access(outsideLink)).resolves.toBeUndefined()
    await staging.cleanup(stage)
  })

  it("cleans an orphaned review stage after restart and removes its local registry record", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    await registry.markReview(managedRunId)

    await expect(registry.recover(managedRunId)).rejects.toMatchObject({ reasonCode: "stage-active" })
    const restarted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })
    await expect(restarted.recover(managedRunId)).resolves.toEqual({ status: "cleaned" })
    await expect(access(stage.root)).rejects.toMatchObject({ code: "ENOENT" })
    await expect(restarted.recover(managedRunId)).resolves.toEqual({ status: "absent" })
  })

  it("quarantines a retained apply journal while cleaning the orphaned stage", async () => {
    const { stage, journalPath } = await createRetainedJournal()

    const recovered = await registry.recover(managedRunId)
    expect(recovered.status).toBe("quarantined")
    expect(recovered.quarantinePath).toBe(join(registry.root, "quarantine", managedRunId))
    await expect(access(stage.root)).rejects.toMatchObject({ code: "ENOENT" })
    await expect(access(journalPath)).rejects.toMatchObject({ code: "ENOENT" })
    await expect(access(recovered.quarantinePath!)).resolves.toBeUndefined()
    expect((await lstat(join(registry.root, "quarantine"), { bigint: true })).mode & 0o777n).toBe(0o700n)
    expect((await lstat(recovered.quarantinePath!, { bigint: true })).mode & 0o777n).toBe(0o700n)
    expect((await lstat(join(recovered.quarantinePath!, "journal.json"), { bigint: true })).mode & 0o777n).toBe(0o600n)
    await expect(registry.recover(managedRunId)).resolves.toEqual(recovered)
  })

  it("disposes a verified quarantine only through the explicit bounded lifecycle", async () => {
    await createRetainedJournal()
    const recovered = await registry.recover(managedRunId)
    await registry.disposeQuarantine(managedRunId)

    await expect(access(recovered.quarantinePath!)).rejects.toMatchObject({ code: "ENOENT" })
    await expect(access(recordPath())).rejects.toMatchObject({ code: "ENOENT" })
    await expect(registry.disposeQuarantine(managedRunId)).resolves.toBeUndefined()
  })

  it("finishes an interrupted deterministic quarantine move idempotently", async () => {
    const { stage, journalPath } = await createRetainedJournal()
    const quarantineRoot = join(registry.root, "quarantine")
    const quarantinePath = join(quarantineRoot, managedRunId)
    await mkdir(quarantineRoot, { mode: 0o700 })
    await chmod(quarantineRoot, 0o700)
    await rename(dirname(await realpath(journalPath)), quarantinePath)

    await expect(registry.recover(managedRunId)).resolves.toEqual({ status: "quarantined", quarantinePath })
    await expect(access(stage.root)).rejects.toMatchObject({ code: "ENOENT" })
    await expect(registry.recover(managedRunId)).resolves.toEqual({ status: "quarantined", quarantinePath })
  })

  it("does not claim quarantine when the retained journal is missing", async () => {
    const { stage, journalPath } = await createRetainedJournal()
    await rm(dirname(journalPath), { recursive: true })

    const recovery = registry.recover(managedRunId)
    await expect(recovery).rejects.toMatchObject({
      name: "ManagedStageRecoveryError",
      reasonCode: "journal-missing",
    })
    await expect(access(stage.root)).resolves.toBeUndefined()
    await expect(access(join(registry.root, "quarantine", managedRunId))).rejects.toMatchObject({ code: "ENOENT" })
  })

  it("reports a missing recorded quarantine instead of repeating a false success", async () => {
    await createRetainedJournal()
    const recovered = await registry.recover(managedRunId)
    await rm(recovered.quarantinePath!, { recursive: true })

    await expect(registry.recover(managedRunId)).rejects.toMatchObject({
      name: "ManagedStageRecoveryError",
      reasonCode: "quarantine-missing",
    })
  })

  it("rejects a retained journal changed after its identity and digest were recorded", async () => {
    const { stage, journalPath } = await createRetainedJournal()
    await writeFile(journalPath, "tampered\n")
    await chmod(journalPath, 0o600)

    await expect(registry.recover(managedRunId)).rejects.toThrow(/journal.*changed/)
    await expect(access(stage.root)).resolves.toBeUndefined()
    await expect(access(journalPath)).resolves.toBeUndefined()
  })

  it("rejects unbound content pre-existing at the quarantine destination", async () => {
    const { journalPath } = await createRetainedJournal()
    const quarantinePath = join(registry.root, "quarantine", managedRunId)
    await mkdir(join(registry.root, "quarantine"), { mode: 0o700 })
    await chmod(join(registry.root, "quarantine"), 0o700)
    await mkdir(quarantinePath, { mode: 0o700 })
    await chmod(quarantinePath, 0o700)
    await writeFile(join(quarantinePath, "journal.json"), await readFile(journalPath), { mode: 0o600 })
    await chmod(join(quarantinePath, "journal.json"), 0o600)

    await expect(registry.recover(managedRunId)).rejects.toBeInstanceOf(Error)
    await expect(access(journalPath)).resolves.toBeUndefined()
  })

  it("rejects a stage directory replaced after registration and preserves the replacement", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    await registry.markReview(managedRunId)
    const stageTempRoot = dirname(await realpath(stage.root))
    await rm(stageTempRoot, { recursive: true })
    await mkdir(stageTempRoot, { mode: 0o700 })
    await chmod(stageTempRoot, 0o700)
    await writeFile(join(stageTempRoot, "replacement.txt"), "preserve")

    const restarted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })
    await expect(restarted.recover(managedRunId)).rejects.toThrow(/replaced/)
    await expect(readFile(join(stageTempRoot, "replacement.txt"), "utf8")).resolves.toBe("preserve")
  })

  it("rejects a symbolic-link registry root", async () => {
    const stage = await staging.create(source)
    const outside = join(temporary, "outside-registry")
    await mkdir(outside, { mode: 0o700 })
    await chmod(outside, 0o700)
    await symlink(outside, registry.root)

    await expect(registry.register(managedRunId, stage)).rejects.toThrow(/registry root|safe directory/)
    await expect(access(stage.root)).resolves.toBeUndefined()
  })

  it("rejects a registry root replaced after it was established", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    const displacedRoot = `${registry.root}-displaced`
    await rename(registry.root, displacedRoot)
    await mkdir(registry.root, { mode: 0o700 })
    await chmod(registry.root, 0o700)

    await expect(registry.complete(managedRunId)).rejects.toThrow(/replaced/)
    await expect(access(join(displacedRoot, `${managedRunId}.json`))).resolves.toBeUndefined()
  })

  it("rejects a symbolic-link record before reading or replacing it", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    const outsideRecord = join(temporary, "outside-record.json")
    await writeFile(outsideRecord, "{}", { mode: 0o600 })
    await rm(recordPath())
    await symlink(outsideRecord, recordPath())

    await expect(registry.markReview(managedRunId)).rejects.toThrow(/record.*safe file|record.*unsafe|record.*resolves/)
    await expect(readFile(outsideRecord, "utf8")).resolves.toBe("{}")
  })

  it("rejects a hard-linked registry record", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    const outsideLink = join(temporary, "record-hard-link.json")
    await link(recordPath(), outsideLink)

    await expect(registry.markReview(managedRunId)).rejects.toThrow(/unsafe link count/)
    await expect(access(outsideLink)).resolves.toBeUndefined()
  })

  it("rejects a symbolic-link journal instead of retaining external content", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    await writeFile(join(stage.root, "source.txt"), "after")
    await registry.markReview(managedRunId)
    await registry.markApplying(managedRunId)
    const applied = await staging.apply(stage, {
      authorizationId: "test-authorization",
      approvedPaths: ["source.txt"],
    })
    const outsideJournal = join(temporary, "outside-journal.json")
    await writeFile(outsideJournal, await readFile(applied.journalPath), { mode: 0o600 })
    await rm(applied.journalPath)
    await symlink(outsideJournal, applied.journalPath)

    await expect(registry.retainJournal(managedRunId, applied.journalPath, applied.journalDigest)).rejects.toThrow(/unsafe/)
    await expect(access(outsideJournal)).resolves.toBeUndefined()
  })

  it("rejects a symbolic-link quarantine root and preserves the retained journal", async () => {
    const { stage, journalPath } = await createRetainedJournal()
    const outside = join(temporary, "outside-quarantine")
    await mkdir(outside, { mode: 0o700 })
    await chmod(outside, 0o700)
    await symlink(outside, join(registry.root, "quarantine"))

    await expect(registry.recover(managedRunId)).rejects.toThrow(/quarantine root|safe directory/)
    await expect(access(stage.root)).resolves.toBeUndefined()
    await expect(access(journalPath)).resolves.toBeUndefined()
  })

  it("rejects non-private registry and record modes", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    await chmod(recordPath(), 0o644)
    await expect(registry.recover(managedRunId)).rejects.toThrow(/mode 600/)
    await chmod(recordPath(), 0o600)
    await chmod(registry.root, 0o755)
    await expect(registry.complete(managedRunId)).rejects.toThrow(/mode 700/)
    await expect(access(recordPath())).resolves.toBeUndefined()
  })

  it("rejects a non-private stage root during registration", async () => {
    const stage = await staging.create(source)
    await chmod(dirname(await realpath(stage.root)), 0o755)

    await expect(registry.register(managedRunId, stage)).rejects.toThrow(/mode 700/)
  })

  it("rejects a non-private retained journal", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    await writeFile(join(stage.root, "source.txt"), "after")
    await registry.markReview(managedRunId)
    await registry.markApplying(managedRunId)
    const applied = await staging.apply(stage, {
      authorizationId: "test-authorization",
      approvedPaths: ["source.txt"],
    })
    await chmod(applied.journalPath, 0o644)

    await expect(registry.retainJournal(managedRunId, applied.journalPath, applied.journalDigest)).rejects.toThrow(/mode 600/)
  })

  it("rejects malformed recorded recovery targets without deleting them", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    await registry.markReview(managedRunId)
    const record = JSON.parse(await readFile(recordPath(), "utf8")) as Record<string, unknown>
    record.stageTempRoot = source
    await writeFile(recordPath(), `${JSON.stringify(record)}\n`)
    await chmod(recordPath(), 0o600)

    await expect(registry.recover(managedRunId)).rejects.toThrow(/unsafe stage path/)
    await expect(readFile(join(source, "source.txt"), "utf8")).resolves.toBe("before")
    await expect(access(stage.root)).resolves.toBeUndefined()
  })

  it("rejects malformed record JSON instead of deleting unverified state", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    await writeFile(recordPath(), "not-json\n")
    await chmod(recordPath(), 0o600)

    await expect(registry.complete(managedRunId)).rejects.toThrow(/record is malformed/)
    await expect(access(recordPath())).resolves.toBeUndefined()
    await expect(access(stage.root)).resolves.toBeUndefined()
  })

  it("linearizes duplicate state transitions across independent registry instances", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    const second = new ManagedStageRegistry(temporary)

    const results = await Promise.allSettled([
      registry.markReview(managedRunId),
      second.markReview(managedRunId),
    ])
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
    expect(JSON.parse(await readFile(recordPath(), "utf8"))).toMatchObject({ state: "review-required", generation: 2 })
    await expect(access(stage.root)).resolves.toBeUndefined()
  })

  it("does not let recovery delete a stage while a live owner advances it to applying", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    await registry.markReview(managedRunId)
    const second = new ManagedStageRegistry(temporary)

    const results = await Promise.allSettled([
      registry.markApplying(managedRunId),
      second.recover(managedRunId),
    ])
    expect(results[0]?.status).toBe("fulfilled")
    expect(results[1]).toMatchObject({ status: "rejected", reason: expect.objectContaining({ reasonCode: "stage-active" }) })
    expect(JSON.parse(await readFile(recordPath(), "utf8"))).toMatchObject({ state: "applying", generation: 3 })
    await expect(access(stage.root)).resolves.toBeUndefined()
  })

  it("refuses to erase the recovery pointer while bound stage or journal state exists", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    await expect(registry.complete(managedRunId)).rejects.toThrow(/staged workspace still exists/)
    await expect(access(recordPath())).resolves.toBeUndefined()

    await registry.markReview(managedRunId)
    await registry.markApplying(managedRunId)
    await writeFile(join(stage.root, "source.txt"), "after")
    const applied = await staging.apply(stage, {
      authorizationId: "test-authorization",
      approvedPaths: ["source.txt"],
    })
    await registry.retainJournal(managedRunId, applied.journalPath, applied.journalDigest)
    await staging.cleanup(stage)
    await expect(registry.complete(managedRunId)).rejects.toThrow(/apply journal still exists/)
    await expect(access(recordPath())).resolves.toBeUndefined()
    await expect(access(applied.journalPath)).resolves.toBeUndefined()
  })

  it("rejects path-shaped identifiers before touching local state", async () => {
    const stage = await staging.create(source)
    await expect(registry.register("../../escape", stage)).rejects.toThrow(/UUID/)
    await staging.cleanup(stage)
  })

  it.runIf(typeof process.getuid === "function" && process.getuid() === 0)(
    "rejects registry records owned by another user when ownership testing is permitted",
    async () => {
      const stage = await staging.create(source)
      await registry.register(managedRunId, stage)
      await chown(recordPath(), 1, typeof process.getgid === "function" ? process.getgid() : 0)

      await expect(registry.complete(managedRunId)).rejects.toThrow(/not owned by the current user/)
      await expect(access(recordPath())).resolves.toBeUndefined()
    },
  )

  it("exposes structured reasons for incomplete recovery", () => {
    const error = new ManagedStageRecoveryError("journal-missing", "missing")
    expect(error).toMatchObject({ name: "ManagedStageRecoveryError", reasonCode: "journal-missing" })
  })
})
