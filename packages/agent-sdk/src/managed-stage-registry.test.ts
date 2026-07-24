import { access, chmod, chown, link, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, symlink, truncate, utimes, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { canonicalDigest } from "./digest.js"
import {
  ManagedStageRecoveryError,
  ManagedStageRegistry,
  type ManagedStageReviewManifest,
} from "./managed-stage-registry.js"
import {
  WorkspaceJournalPreparedError,
  WorkspaceProcessDeathSimulationError,
  WorkspaceStagingService,
  type WorkspaceStage,
} from "./workspace-staging.js"

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

  async function applyExact(stage: WorkspaceStage, authorizationId = "test-authorization") {
    const inspection = await staging.inspect(stage)
    return staging.apply(stage, {
      authorizationId,
      approvedPaths: inspection.changes.map((change) => change.path),
      expectedInspectionDigest: canonicalDigest(inspection) as `sha256:${string}`,
    })
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
    const applied = await applyExact(stage)
    await registry.retainJournal(managedRunId, applied.journalPath, applied.journalDigest)
    return { stage, journalPath: applied.journalPath, journalDigest: applied.journalDigest }
  }

  async function createReviewManifest(stage: WorkspaceStage): Promise<ManagedStageReviewManifest> {
    await writeFile(join(stage.root, "source.txt"), "reviewed")
    return {
      schemaVersion: 1,
      kind: "gaep-managed-stage-review-manifest-v1",
      managedRunId,
      bindingsDigest: `sha256:${"1".repeat(64)}`,
      provider: {
        adapterId: "gaep.codex-cli",
        agentId: "codex-cli",
        modelId: "test-model",
        capabilityDigest: `sha256:${"2".repeat(64)}`,
      },
      stage: staging.exportManifest(stage),
      inspection: await staging.inspect(stage),
      terminalDisposition: "completed",
    }
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

  it("persists a bounded review manifest and atomically replaces its process lease", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    const originalLease = await registry.markReview(managedRunId, await createReviewManifest(stage))
    expect(originalLease).toMatch(/^[0-9a-f-]{36}$/)

    const restarted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })
    const claim = await restarted.claimReview(managedRunId)
    expect(claim.manifest).toMatchObject({
      managedRunId,
      bindingsDigest: `sha256:${"1".repeat(64)}`,
      inspection: { changes: [expect.objectContaining({ path: "source.txt", kind: "modified" })] },
    })
    await expect(registry.markApplying(managedRunId, originalLease)).rejects.toThrow(/lease is missing, stale/)
    await expect(restarted.markApplying(managedRunId, claim.leaseToken)).resolves.toBeUndefined()
    await expect(restarted.recover(managedRunId)).resolves.toEqual({ status: "cleaned" })
  })

  it.each(["manifest", "record"] as const)(
    "resolves an exact committed review after a post-%s-rename persistence fault",
    async (fault) => {
      const stage = await staging.create(source)
      await registry.register(managedRunId, stage)
      const manifest = await createReviewManifest(stage)
      const faulted = new ManagedStageRegistry(temporary, {
        afterManifestRename: fault === "manifest" ? () => {
          throw new Error("injected post-manifest-rename fault")
        } : undefined,
        afterRecordRename: fault === "record" ? (record) => {
          if (record.generation === 2 && record.state === "review-required") {
            throw new Error("injected post-record-rename fault")
          }
        } : undefined,
      })

      await expect(faulted.markReview(managedRunId, manifest)).resolves.toMatch(/^[0-9a-f-]{36}$/)
      expect(JSON.parse(await readFile(recordPath(), "utf8"))).toMatchObject({
        generation: 2,
        state: "review-required",
        reviewManifestPath: expect.any(String),
      })
      const restarted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })
      await expect(restarted.claimReview(managedRunId)).resolves.toMatchObject({
        manifest: { managedRunId },
      })
    },
  )

  it("recovers an exactly linked unbound manifest after process death immediately after rename", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    const manifest = await createReviewManifest(stage)
    const crashing = new ManagedStageRegistry(temporary, {
      afterManifestRename: () => {
        throw new WorkspaceProcessDeathSimulationError("simulated manifest publication process death")
      },
    })

    await expect(crashing.markReview(managedRunId, manifest)).rejects.toBeInstanceOf(
      WorkspaceProcessDeathSimulationError,
    )
    const manifestPath = join(registry.root, "manifests", `${managedRunId}.json`)
    expect(JSON.parse(await readFile(recordPath(), "utf8"))).toMatchObject({ state: "staging", generation: 1 })
    await expect(access(manifestPath)).resolves.toBeUndefined()

    const restarted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })
    await expect(restarted.recover(managedRunId)).resolves.toEqual({ status: "cleaned" })
    await expect(access(stage.root)).rejects.toMatchObject({ code: "ENOENT" })
    await expect(access(manifestPath)).rejects.toMatchObject({ code: "ENOENT" })
    await expect(access(recordPath())).rejects.toMatchObject({ code: "ENOENT" })
  })

  it("rejects a changed durable review manifest before a restart can claim it", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    await registry.markReview(managedRunId, await createReviewManifest(stage))
    const manifestPath = join(registry.root, "manifests", `${managedRunId}.json`)
    await writeFile(manifestPath, "{}\n")
    await chmod(manifestPath, 0o600)

    const restarted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })
    await expect(restarted.claimReview(managedRunId)).rejects.toThrow(/manifest digest changed|changed while/)
    await expect(access(stage.root)).resolves.toBeUndefined()
    await expect(restarted.recover(managedRunId)).resolves.toEqual({ status: "cleaned" })
    await expect(access(stage.root)).rejects.toMatchObject({ code: "ENOENT" })
    await expect(access(recordPath())).rejects.toMatchObject({ code: "ENOENT" })
  })

  it("lets only the exact restart claimant discard a failed rehydration stage", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    const staleLease = await registry.markReview(managedRunId, await createReviewManifest(stage))
    const restarted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })
    const claim = await restarted.claimReview(managedRunId)

    await expect(registry.discardReview(managedRunId, staleLease!)).rejects.toThrow(/lease is missing, stale/)
    await expect(restarted.discardReview(managedRunId, claim.leaseToken)).resolves.toBeUndefined()
    await expect(access(stage.root)).rejects.toMatchObject({ code: "ENOENT" })
    await expect(access(join(registry.root, "manifests", `${managedRunId}.json`))).rejects.toMatchObject({ code: "ENOENT" })
    expect(JSON.parse(await readFile(recordPath(), "utf8"))).toMatchObject({
      state: "discarding",
      discardOperation: { localCleanupComplete: true },
    })
    await restarted.completeDiscard(managedRunId)
    await expect(access(recordPath())).rejects.toMatchObject({ code: "ENOENT" })
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

  it("inventories registered and unknown stage roots under immutable aggregate bounds", async () => {
    const registered = await staging.create(source)
    await registry.register(managedRunId, registered)
    const unknown = await staging.create(source)

    const inventory = await registry.inspectStageStorage()

    expect(inventory).toMatchObject({
      schemaVersion: 1,
      kind: "gaep-managed-stage-storage-inventory-v1",
      status: "attention-required",
      totals: {
        registryRecords: 1,
        stageRoots: 2,
        registeredStageRoots: 1,
        unregisteredStageRoots: 1,
        liveOwnedStageRoots: 1,
      },
      records: [{
        managedRunId,
        state: "staging",
        stageTempRoot: dirname(registered.root),
        stagePresent: true,
        owner: "live",
      }],
      unregisteredStageRoots: [dirname(unknown.root)],
    })
    expect(inventory.totals.treeEntries).toBeGreaterThanOrEqual(4)
    expect(inventory.totals.bytes).toBeGreaterThan(0)
    expect(Object.isFrozen(inventory)).toBe(true)
  })

  it("scavenges only exact dead registered roots and preserves unknown roots", async () => {
    const registered = await staging.create(source)
    await registry.register(managedRunId, registered)
    const unknown = await staging.create(source)
    const restarted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })

    const result = await restarted.scavengeOrphanStages()

    expect(result.recovered).toEqual([{ managedRunId, result: "cleaned" }])
    expect(result.deferredLiveManagedRunIds).toEqual([])
    expect(result.inventory).toMatchObject({
      status: "attention-required",
      totals: { registryRecords: 0, stageRoots: 1, registeredStageRoots: 0, unregisteredStageRoots: 1 },
      unregisteredStageRoots: [dirname(unknown.root)],
    })
    await expect(access(registered.root)).rejects.toMatchObject({ code: "ENOENT" })
    await expect(access(unknown.root)).resolves.toBeUndefined()
    await expect(access(recordPath())).rejects.toMatchObject({ code: "ENOENT" })
  })

  it("preserves a dead review for exact restart claiming during scavenging", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    await registry.markReview(managedRunId, await createReviewManifest(stage))
    const restarted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })

    const result = await restarted.scavengeOrphanStages()

    expect(result.recovered).toEqual([{ managedRunId, result: "review-restored" }])
    expect(result.inventory.records).toEqual([
      expect.objectContaining({ managedRunId, state: "review-required", stagePresent: true, owner: "unowned" }),
    ])
    await expect(access(stage.root)).resolves.toBeUndefined()
    await expect(restarted.claimReview(managedRunId)).resolves.toMatchObject({
      manifest: { managedRunId },
    })
  })

  it("defers live owners during a global stage scavenging pass", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)

    const result = await registry.scavengeOrphanStages()

    expect(result.recovered).toEqual([])
    expect(result.deferredLiveManagedRunIds).toEqual([managedRunId])
    expect(result.inventory.status).toBe("within-limits")
    await expect(access(stage.root)).resolves.toBeUndefined()
  })

  it("fails closed when global stage root or byte ceilings are exceeded", async () => {
    await staging.create(source)
    await staging.create(source)
    const rootBounded = new ManagedStageRegistry(temporary, {
      stageStorageLimits: { maxStageRoots: 1 },
    })
    await expect(rootBounded.inspectStageStorage()).rejects.toMatchObject({ reasonCode: "stage-storage-limit" })

    const byteBounded = new ManagedStageRegistry(temporary, {
      stageStorageLimits: { maxStageBytes: 1 },
    })
    await expect(byteBounded.inspectStageStorage()).rejects.toMatchObject({ reasonCode: "stage-storage-limit" })
  })

  it("restores an exact no-journal apply review after a crash in the recovery checkpoint", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    const lease = await registry.markReview(managedRunId, await createReviewManifest(stage))
    await registry.markApplying(managedRunId, lease)

    const faulted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })
    const mutableFaulted = faulted as unknown as {
      removeStage: (...args: unknown[]) => Promise<void>
    }
    mutableFaulted.removeStage = async () => {
      throw new Error("injected crash after recovery checkpoint")
    }
    await expect(faulted.recover(managedRunId)).rejects.toThrow("injected crash after recovery checkpoint")
    expect(JSON.parse(await readFile(recordPath(), "utf8"))).toMatchObject({
      state: "recovering",
      recoveryOperation: { fromState: "applying" },
    })

    const restarted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })
    await expect(restarted.recover(managedRunId, { preserveReview: true })).resolves.toEqual({
      status: "review-restored",
    })
    expect(JSON.parse(await readFile(recordPath(), "utf8"))).toMatchObject({ state: "review-required" })
    await expect(access(stage.root)).resolves.toBeUndefined()
    await expect(restarted.claimReview(managedRunId)).resolves.toMatchObject({
      manifest: { inspection: { changes: [expect.objectContaining({ path: "source.txt" })] } },
    })
  })

  it("restores an exact review-required stage from an existing recovery checkpoint", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    await registry.markReview(managedRunId, await createReviewManifest(stage))

    const faulted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })
    const mutableFaulted = faulted as unknown as {
      removeStage: (...args: unknown[]) => Promise<void>
    }
    mutableFaulted.removeStage = async () => {
      throw new Error("injected review cleanup crash")
    }
    await expect(faulted.recover(managedRunId)).rejects.toThrow("injected review cleanup crash")
    expect(JSON.parse(await readFile(recordPath(), "utf8"))).toMatchObject({
      state: "recovering",
      recoveryOperation: { fromState: "review-required" },
    })

    const restarted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })
    await expect(restarted.recover(managedRunId, { preserveReview: true })).resolves.toEqual({
      status: "review-restored",
    })
    await expect(restarted.claimReview(managedRunId)).resolves.toMatchObject({
      manifest: { inspection: { changes: [expect.objectContaining({ path: "source.txt" })] } },
    })
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

  it("disposes a retained journal through verified quarantine and remains restart-idempotent", async () => {
    const { journalPath, journalDigest } = await createRetainedJournal()

    await expect(registry.disposeRetainedJournal(managedRunId, journalDigest)).resolves.toBeUndefined()
    await expect(access(journalPath)).rejects.toMatchObject({ code: "ENOENT" })
    await expect(access(recordPath())).rejects.toMatchObject({ code: "ENOENT" })
    await expect(registry.disposeRetainedJournal(managedRunId, journalDigest)).resolves.toBeUndefined()
  })

  it("resumes deterministic quarantine disposal through the public retained-journal lifecycle", async () => {
    const { journalDigest } = await createRetainedJournal()
    const faulted = new ManagedStageRegistry(temporary, {
      beforeDisposalStep: (step) => {
        if (step === "after-disposal-rename") throw new Error("injected disposal crash")
      },
    })

    await expect(faulted.disposeRetainedJournal(managedRunId, journalDigest)).rejects.toThrow("injected disposal crash")
    expect(JSON.parse(await readFile(recordPath(), "utf8"))).toMatchObject({
      state: "disposing",
      disposalOperation: {
        tombstonePath: join(registry.root, "tombstones", `.quarantine-${managedRunId}`),
      },
    })
    const tombstone = join(registry.root, "tombstones", `.quarantine-${managedRunId}`)
    await rm(join(tombstone, "backups", "0.bin"))
    const restarted = new ManagedStageRegistry(temporary)
    await expect(restarted.disposeRetainedJournal(managedRunId, journalDigest)).resolves.toBeUndefined()
    await expect(access(recordPath())).rejects.toMatchObject({ code: "ENOENT" })
    await expect(access(join(registry.root, "tombstones", `.quarantine-${managedRunId}`))).rejects.toMatchObject({ code: "ENOENT" })
  })

  it("discovers an advanced prebound write-ahead journal and quarantines its exact final identity", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    await writeFile(join(stage.root, "source.txt"), "after")
    await registry.markReview(managedRunId)
    await registry.markApplying(managedRunId)
    const inspection = await staging.inspect(stage)
    let preparedDigest: `sha256:${string}` | undefined
    const applied = await staging.apply(stage, {
      authorizationId: "prebound-journal",
      approvedPaths: ["source.txt"],
      expectedInspectionDigest: canonicalDigest(inspection) as `sha256:${string}`,
      onJournalPrepared: async (journalPath, journalDigest, journalId) => {
        preparedDigest = journalDigest
        await registry.bindApplyingJournal(managedRunId, journalPath, journalDigest, journalId)
      },
    })
    expect(preparedDigest).toBeDefined()
    expect(preparedDigest).not.toBe(applied.journalDigest)
    expect(JSON.parse(await readFile(recordPath(), "utf8"))).toMatchObject({
      state: "applying",
      journalDigest: preparedDigest,
    })
    const durableResidue = ".gaep-durable-00000000-0000-4000-8000-000000000000"
    await writeFile(join(dirname(applied.journalPath), durableResidue), "replacement residue", { mode: 0o600 })
    await chmod(join(dirname(applied.journalPath), durableResidue), 0o600)

    const restarted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })
    const recovered = await restarted.recover(managedRunId)
    expect(recovered).toMatchObject({ status: "quarantined", journalDigest: applied.journalDigest })
    expect(JSON.parse(await readFile(join(recovered.quarantinePath!, "journal.json"), "utf8"))).toMatchObject({
      state: "committed",
    })
    await expect(access(join(recovered.quarantinePath!, durableResidue))).resolves.toBeUndefined()
  })

  it.each(["malformed", "directory", "symlink", "oversized", "mass"] as const)(
    "rejects %s durable journal residue without adopting it",
    async (variant) => {
      const { journalPath } = await createRetainedJournal()
      const root = dirname(journalPath)
      const exactName = ".gaep-durable-00000000-0000-4000-8000-000000000001"
      const residue = join(root, variant === "malformed" ? ".gaep-durable-not-a-uuid" : exactName)
      if (variant === "directory") {
        await mkdir(residue, { mode: 0o700 })
      } else if (variant === "symlink") {
        const outside = join(temporary, "outside-durable-residue")
        await writeFile(outside, "outside", { mode: 0o600 })
        await symlink(outside, residue)
      } else if (variant === "oversized") {
        await writeFile(residue, "", { mode: 0o600 })
        await truncate(residue, (32 * 1024 * 1024) + 1)
      } else if (variant === "mass") {
        for (let index = 0; index < 1_029; index += 1) {
          const name = `.gaep-durable-00000000-0000-4000-8000-${String(index).padStart(12, "0")}`
          await writeFile(join(root, name), "", { mode: 0o600 })
        }
      } else {
        await writeFile(residue, "malformed", { mode: 0o600 })
      }

      const restarted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })
      await expect(restarted.recover(managedRunId)).rejects.toThrow(/journal|durable|inventory|unexpected|bound/)
      await expect(access(residue)).resolves.toBeUndefined()
    },
  )

  it("preserves a durably bound prepared journal when the bind callback rejects ambiguously", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    await writeFile(join(stage.root, "source.txt"), "after")
    await registry.markReview(managedRunId)
    await registry.markApplying(managedRunId)
    const inspection = await staging.inspect(stage)
    let preparedPath: string | undefined
    let preparedDigest: `sha256:${string}` | undefined

    const attempted = staging.apply(stage, {
      authorizationId: "ambiguous-bound-journal",
      approvedPaths: ["source.txt"],
      expectedInspectionDigest: canonicalDigest(inspection) as `sha256:${string}`,
      onJournalPrepared: async (journalPath, journalDigest, journalId) => {
        preparedPath = journalPath
        preparedDigest = journalDigest
        await registry.bindApplyingJournal(managedRunId, journalPath, journalDigest, journalId)
        throw new Error("injected post-bind failure")
      },
    })
    await expect(attempted).rejects.toBeInstanceOf(WorkspaceJournalPreparedError)
    expect(await readFile(join(source, "source.txt"), "utf8")).toBe("before")
    await expect(access(preparedPath!)).resolves.toBeUndefined()
    const boundRecord = JSON.parse(await readFile(recordPath(), "utf8"))
    expect(boundRecord).toMatchObject({
      state: "applying",
      journalDigest: preparedDigest,
    })
    expect(boundRecord.journalPath).toBe(await realpath(preparedPath!))

    const restarted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })
    const recovered = await restarted.recover(managedRunId)
    expect(recovered).toMatchObject({ status: "quarantined", journalDigest: preparedDigest })
    expect(JSON.parse(await readFile(join(recovered.quarantinePath!, "journal.json"), "utf8"))).toMatchObject({
      state: "prepared",
    })
    expect(await readFile(join(source, "source.txt"), "utf8")).toBe("before")
  })

  it("cleans an exact journal-bound apply temporary after simulated process death and quarantines the WAL", async () => {
    const crashStaging = new WorkspaceStagingService({
      tempParent: temporary,
      afterSourceTemporarySync: (phase) => {
        if (phase === "apply") throw new WorkspaceProcessDeathSimulationError("simulated apply process death")
      },
    })
    const stage = await crashStaging.create(source)
    await registry.register(managedRunId, stage)
    await writeFile(join(stage.root, "source.txt"), "after")
    await registry.markReview(managedRunId)
    await registry.markApplying(managedRunId)
    const inspection = await crashStaging.inspect(stage)

    await expect(crashStaging.apply(stage, {
      authorizationId: "crash-apply-temp",
      approvedPaths: ["source.txt"],
      expectedInspectionDigest: canonicalDigest(inspection) as `sha256:${string}`,
      onJournalPrepared: (path, digest, id) => registry.bindApplyingJournal(managedRunId, path, digest, id),
    })).rejects.toBeInstanceOf(WorkspaceProcessDeathSimulationError)
    const applyingRecord = JSON.parse(await readFile(recordPath(), "utf8")) as { journalPath: string }
    const interruptedJournal = JSON.parse(await readFile(applyingRecord.journalPath, "utf8")) as {
      entries: Array<{ sourceTemporaryPath: string }>
    }
    const residue = join(source, ...interruptedJournal.entries[0]!.sourceTemporaryPath.split("/"))
    await expect(access(residue)).resolves.toBeUndefined()
    expect(await readFile(join(source, "source.txt"), "utf8")).toBe("before")

    const restarted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })
    await expect(restarted.recover(managedRunId)).resolves.toMatchObject({ status: "quarantined" })
    await expect(access(residue)).rejects.toMatchObject({ code: "ENOENT" })
    expect(await readFile(join(source, "source.txt"), "utf8")).toBe("before")
  })

  it("quarantines an exact interrupted deletion without inventing rollback or restoring bytes", async () => {
    const crashStaging = new WorkspaceStagingService({
      tempParent: temporary,
      afterSourceMutation: () => {
        throw new WorkspaceProcessDeathSimulationError("simulated post-unlink process death")
      },
    })
    const stage = await crashStaging.create(source)
    await registry.register(managedRunId, stage)
    await rm(join(stage.root, "source.txt"))
    await registry.markReview(managedRunId)
    await registry.markApplying(managedRunId)
    const inspection = await crashStaging.inspect(stage)

    await expect(crashStaging.apply(stage, {
      authorizationId: "crash-delete",
      approvedPaths: ["source.txt"],
      expectedInspectionDigest: canonicalDigest(inspection) as `sha256:${string}`,
      onJournalPrepared: (path, digest, id) => registry.bindApplyingJournal(managedRunId, path, digest, id),
    })).rejects.toBeInstanceOf(WorkspaceProcessDeathSimulationError)
    await expect(access(join(source, "source.txt"))).rejects.toMatchObject({ code: "ENOENT" })

    const restarted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })
    const recovered = await restarted.recover(managedRunId)
    expect(recovered).toMatchObject({ status: "quarantined" })
    expect(JSON.parse(await readFile(join(recovered.quarantinePath!, "journal.json"), "utf8"))).toMatchObject({
      state: "applying",
      entries: [expect.objectContaining({ kind: "deleted", prepared: true, applied: false })],
    })
    await expect(access(join(source, "source.txt"))).rejects.toMatchObject({ code: "ENOENT" })
  })

  it("cleans an exact journal-bound rollback temporary after simulated process death without inventing rollback", async () => {
    await writeFile(join(source, "z.txt"), "z-before")
    const crashStaging = new WorkspaceStagingService({
      tempParent: temporary,
      beforeApplyOperation: (_path, index) => {
        if (index === 1) throw new Error("force rollback")
      },
      afterSourceTemporarySync: (phase) => {
        if (phase === "rollback") throw new WorkspaceProcessDeathSimulationError("simulated rollback process death")
      },
    })
    const stage = await crashStaging.create(source)
    await registry.register(managedRunId, stage)
    await writeFile(join(stage.root, "source.txt"), "source-after")
    await writeFile(join(stage.root, "z.txt"), "z-after")
    await registry.markReview(managedRunId)
    await registry.markApplying(managedRunId)
    const inspection = await crashStaging.inspect(stage)

    await expect(crashStaging.apply(stage, {
      authorizationId: "crash-rollback-temp",
      approvedPaths: inspection.changes.map((change) => change.path),
      expectedInspectionDigest: canonicalDigest(inspection) as `sha256:${string}`,
      onJournalPrepared: (path, digest, id) => registry.bindApplyingJournal(managedRunId, path, digest, id),
    })).rejects.toBeInstanceOf(WorkspaceProcessDeathSimulationError)
    const applyingRecord = JSON.parse(await readFile(recordPath(), "utf8")) as { journalPath: string }
    const interruptedJournal = JSON.parse(await readFile(applyingRecord.journalPath, "utf8")) as {
      entries: Array<{ rollbackTemporaryPath?: string }>
    }
    const rollbackEntry = interruptedJournal.entries.find((entry) => entry.rollbackTemporaryPath)!
    const residue = join(source, ...rollbackEntry.rollbackTemporaryPath!.split("/"))
    await expect(access(residue)).resolves.toBeUndefined()
    expect(await readFile(join(source, "source.txt"), "utf8")).toBe("source-after")

    const restarted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })
    await expect(restarted.recover(managedRunId)).resolves.toMatchObject({ status: "quarantined" })
    await expect(access(residue)).rejects.toMatchObject({ code: "ENOENT" })
    expect(await readFile(join(source, "source.txt"), "utf8")).toBe("source-after")
  })

  it("removes exact empty nested directory intents after simulated process death", async () => {
    const crashStaging = new WorkspaceStagingService({
      tempParent: temporary,
      afterCreatedDirectoryRename: (path) => {
        if (path === "nested/deep") throw new WorkspaceProcessDeathSimulationError("simulated directory process death")
      },
    })
    const stage = await crashStaging.create(source)
    await registry.register(managedRunId, stage)
    await mkdir(join(stage.root, "nested", "deep"), { recursive: true })
    await writeFile(join(stage.root, "nested", "deep", "added.txt"), "added")
    await registry.markReview(managedRunId)
    await registry.markApplying(managedRunId)
    const inspection = await crashStaging.inspect(stage)

    await expect(crashStaging.apply(stage, {
      authorizationId: "crash-directory-intent",
      approvedPaths: ["nested/deep/added.txt"],
      expectedInspectionDigest: canonicalDigest(inspection) as `sha256:${string}`,
      onJournalPrepared: (path, digest, id) => registry.bindApplyingJournal(managedRunId, path, digest, id),
    })).rejects.toBeInstanceOf(WorkspaceProcessDeathSimulationError)
    await expect(access(join(source, "nested", "deep"))).resolves.toBeUndefined()

    const restarted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })
    await expect(restarted.recover(managedRunId)).resolves.toMatchObject({ status: "quarantined" })
    await expect(access(join(source, "nested"))).rejects.toMatchObject({ code: "ENOENT" })
  })

  it("preserves a nonempty journal-owned directory and keeps recovery visibly pending", async () => {
    const crashStaging = new WorkspaceStagingService({
      tempParent: temporary,
      afterCreatedDirectoryRename: async (path) => {
        if (path !== "nested/deep") return
        await writeFile(join(source, path, "external.txt"), "external")
        throw new WorkspaceProcessDeathSimulationError("simulated nonempty directory process death")
      },
    })
    const stage = await crashStaging.create(source)
    await registry.register(managedRunId, stage)
    await mkdir(join(stage.root, "nested", "deep"), { recursive: true })
    await writeFile(join(stage.root, "nested", "deep", "added.txt"), "added")
    await registry.markReview(managedRunId)
    await registry.markApplying(managedRunId)
    const inspection = await crashStaging.inspect(stage)
    await expect(crashStaging.apply(stage, {
      authorizationId: "crash-nonempty-directory",
      approvedPaths: ["nested/deep/added.txt"],
      expectedInspectionDigest: canonicalDigest(inspection) as `sha256:${string}`,
      onJournalPrepared: (path, digest, id) => registry.bindApplyingJournal(managedRunId, path, digest, id),
    })).rejects.toBeInstanceOf(WorkspaceProcessDeathSimulationError)

    const restarted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })
    await expect(restarted.recover(managedRunId)).rejects.toMatchObject({ reasonCode: "source-residue-conflict" })
    expect(await readFile(join(source, "nested", "deep", "external.txt"), "utf8")).toBe("external")
    expect(JSON.parse(await readFile(recordPath(), "utf8"))).toMatchObject({ state: "recovering" })
  })

  it("resumes a prebound applying recovery that crashed after the quarantine rename", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    await writeFile(join(stage.root, "source.txt"), "after")
    await registry.markReview(managedRunId)
    await registry.markApplying(managedRunId)
    const inspection = await staging.inspect(stage)
    const applied = await staging.apply(stage, {
      authorizationId: "prebound-crash",
      approvedPaths: ["source.txt"],
      expectedInspectionDigest: canonicalDigest(inspection) as `sha256:${string}`,
      onJournalPrepared: (journalPath, journalDigest, journalId) =>
        registry.bindApplyingJournal(managedRunId, journalPath, journalDigest, journalId),
    })
    const faulted = new ManagedStageRegistry(temporary, {
      isProcessAlive: () => false,
      afterQuarantineMove: () => {
        throw new Error("injected quarantine crash")
      },
    })
    await expect(faulted.recover(managedRunId)).rejects.toThrow("injected quarantine crash")
    expect(JSON.parse(await readFile(recordPath(), "utf8"))).toMatchObject({ state: "recovering" })

    const restarted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })
    await expect(restarted.recover(managedRunId)).resolves.toMatchObject({
      status: "quarantined",
      journalDigest: applied.journalDigest,
    })
  })

  it("cleans deterministic stage and manifest tombstones left by an interrupted recovery", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    await registry.markReview(managedRunId, await createReviewManifest(stage))
    const tombstoneRoot = join(registry.root, "tombstones")
    await mkdir(tombstoneRoot, { mode: 0o700 })
    await chmod(tombstoneRoot, 0o700)
    await rename(dirname(await realpath(stage.root)), join(tombstoneRoot, `.stage-${managedRunId}`))
    await rename(
      join(registry.root, "manifests", `${managedRunId}.json`),
      join(tombstoneRoot, `.manifest-${managedRunId}`),
    )

    const restarted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })
    await expect(restarted.recover(managedRunId)).resolves.toEqual({ status: "cleaned" })
    await expect(access(join(tombstoneRoot, `.stage-${managedRunId}`))).rejects.toMatchObject({ code: "ENOENT" })
    await expect(access(join(tombstoneRoot, `.manifest-${managedRunId}`))).rejects.toMatchObject({ code: "ENOENT" })
    await expect(access(recordPath())).rejects.toMatchObject({ code: "ENOENT" })
  })

  it("finishes an interrupted deterministic quarantine move idempotently", async () => {
    const { stage, journalPath } = await createRetainedJournal()
    const quarantineRoot = join(registry.root, "quarantine")
    const quarantinePath = join(quarantineRoot, managedRunId)
    await mkdir(quarantineRoot, { mode: 0o700 })
    await chmod(quarantineRoot, 0o700)
    await rename(dirname(await realpath(journalPath)), quarantinePath)

    await expect(registry.recover(managedRunId)).resolves.toMatchObject({ status: "quarantined", quarantinePath })
    await expect(access(stage.root)).rejects.toMatchObject({ code: "ENOENT" })
    await expect(registry.recover(managedRunId)).resolves.toMatchObject({ status: "quarantined", quarantinePath })
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

  it("rejects a same-content staged workspace replacement before registration", async () => {
    const stage = await staging.create(source)
    const displaced = `${stage.root}-displaced`
    await rename(stage.root, displaced)
    await mkdir(stage.root, { mode: 0o700 })
    await chmod(stage.root, 0o700)
    await writeFile(join(stage.root, "source.txt"), "before")

    await expect(registry.register(managedRunId, stage)).rejects.toThrow(/identity|replaced/)
    await expect(readFile(join(stage.root, "source.txt"), "utf8")).resolves.toBe("before")
    await expect(readFile(join(displaced, "source.txt"), "utf8")).resolves.toBe("before")
  })

  it("resumes deletion of an identity-bound stage tombstone after partial recursive removal", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    const tombstoneRoot = join(registry.root, "tombstones")
    await mkdir(tombstoneRoot, { mode: 0o700 })
    await chmod(tombstoneRoot, 0o700)
    const tombstone = join(tombstoneRoot, `.stage-${managedRunId}`)
    await rename(dirname(stage.root), tombstone)
    await rm(join(tombstone, "workspace"), { recursive: true })

    const restarted = new ManagedStageRegistry(temporary, { isProcessAlive: () => false })
    await expect(restarted.recover(managedRunId)).resolves.toEqual({ status: "cleaned" })
    await expect(access(tombstone)).rejects.toMatchObject({ code: "ENOENT" })
    await expect(access(recordPath())).rejects.toMatchObject({ code: "ENOENT" })
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
    const applied = await applyExact(stage)
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
    const applied = await applyExact(stage)
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

  it("reaps a stale zero-byte run lock left by process death and progresses", async () => {
    const stage = await staging.create(source)
    const crashing = new ManagedStageRegistry(temporary, {
      afterRunLockCreate: () => {
        throw new WorkspaceProcessDeathSimulationError("injected lock publication death")
      },
      staleLockMs: 1,
      lockWaitMs: 100,
    })
    await expect(crashing.register(managedRunId, stage)).rejects.toBeInstanceOf(WorkspaceProcessDeathSimulationError)
    const lockPath = join(crashing.root, "locks", `${managedRunId}.lock`)
    expect((await lstat(lockPath)).size).toBe(0)
    await utimes(lockPath, new Date(0), new Date(0))

    const restarted = new ManagedStageRegistry(temporary, {
      isProcessAlive: () => false,
      staleLockMs: 1,
      lockWaitMs: 500,
    })
    await expect(restarted.register(managedRunId, stage)).resolves.toBeUndefined()
    expect(JSON.parse(await readFile(join(restarted.root, `${managedRunId}.json`), "utf8"))).toMatchObject({
      state: "staging",
    })
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
    const applied = await applyExact(stage)
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
