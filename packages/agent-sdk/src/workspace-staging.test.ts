import { createHash } from "node:crypto"
import { access, chmod, mkdir, mkdtemp, readFile, rename, rm, stat, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { canonicalDigest } from "./digest.js"
import {
  WorkspaceApplyError,
  WorkspaceJournalPreparedError,
  WorkspaceStagingService,
  type WorkspaceApplyOptions,
  type WorkspaceStage,
} from "./workspace-staging.js"

describe("isolated workspace staging", () => {
  const temporaryDirectories: string[] = []

  async function workspace(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "gaep-staging-test-"))
    temporaryDirectories.push(root)
    await mkdir(join(root, "src"), { recursive: true })
    await writeFile(join(root, "src", "a.txt"), "alpha")
    await writeFile(join(root, "src", "b.txt"), "beta")
    return root
  }

  async function applyExact(
    service: WorkspaceStagingService,
    stage: WorkspaceStage,
    options: Omit<WorkspaceApplyOptions, "expectedInspectionDigest">,
  ) {
    const inspection = await service.inspect(stage)
    return service.apply(stage, {
      ...options,
      expectedInspectionDigest: canonicalDigest(inspection) as `sha256:${string}`,
    })
  }

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
  })

  it("copies only bounded non-secret files and reports relative change evidence", async () => {
    const source = await workspace()
    await mkdir(join(source, ".git"))
    await writeFile(join(source, ".git", "config"), "secret-ish")
    await mkdir(join(source, ".GAEP", "runtime"), { recursive: true })
    await writeFile(join(source, ".GAEP", "runtime", "case-insensitive.json"), "{}")
    await mkdir(join(source, ".codex"), { recursive: true })
    await writeFile(join(source, ".codex", "config.toml"), "danger_full_access = true")
    await mkdir(join(source, "secrets"), { recursive: true })
    await writeFile(join(source, "secrets", "provider.txt"), "TOKEN=secret")
    await writeFile(join(source, ".env"), "TOKEN=secret")
    const service = new WorkspaceStagingService()
    const stage = await service.create(source)

    await expect(readFile(join(stage.root, ".env"))).rejects.toMatchObject({ code: "ENOENT" })
    await writeFile(join(stage.root, "src", "a.txt"), "changed")
    await rm(join(stage.root, "src", "b.txt"))
    await writeFile(join(stage.root, "src", "c.txt"), "added")
    const inspection = await service.inspect(stage)

    expect(inspection.baselineDigest).not.toBe(inspection.finalDigest)
    expect(inspection.excludedPaths).toEqual(expect.arrayContaining([".git", ".env", ".GAEP", ".codex", "secrets"]))
    expect(inspection.changes.map(({ path, kind }) => ({ path, kind }))).toEqual([
      { path: "src/a.txt", kind: "modified" },
      { path: "src/b.txt", kind: "deleted" },
      { path: "src/c.txt", kind: "added" },
    ])
    expect(inspection.changes.every((change) => !change.path.startsWith("/"))).toBe(true)
    await service.cleanup(stage)
    expect(stage.state).toBe("cleaned")
  })

  it("makes managed stage authority fields immutable", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService()
    const stage = await service.create(source)

    expect(() => {
      (stage as unknown as { root: string }).root = source
    }).toThrow()
    expect(() => {
      (stage.excludedPaths as string[]).push("forged")
    }).toThrow()
    expect(() => {
      (stage.rootIdentity as { inode: string }).inode = "0"
    }).toThrow()
    expect(() => {
      (stage.tempRootIdentity as { device: string }).device = "0"
    }).toThrow()
    service.assertManagedStage(stage)
    await service.cleanup(stage)
  })

  it("resumes exact stage tombstone cleanup after its bound workspace child was removed", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService()
    const stage = await service.create(source)
    const tempRoot = dirname(stage.root)
    const tombstone = join(dirname(tempRoot), `.gaep-stage-dispose-${stage.id}`)
    await rename(tempRoot, tombstone)
    await rm(join(tombstone, "workspace"), { recursive: true })

    await expect(service.cleanup(stage)).resolves.toBeUndefined()
    await expect(access(tombstone)).rejects.toMatchObject({ code: "ENOENT" })
  })

  it("rehydrates an exact bounded stage manifest and preserves apply conflict checks", async () => {
    const source = await workspace()
    const original = new WorkspaceStagingService()
    const stage = await original.create(source)
    const manifest = original.exportManifest(stage)
    await writeFile(join(stage.root, "src", "a.txt"), "rehydrated")
    const inspection = await original.inspect(stage)

    const restarted = new WorkspaceStagingService()
    const rehydrated = await restarted.rehydrate(manifest, inspection)
    expect(rehydrated).not.toBe(stage)
    expect(restarted.exportManifest(rehydrated)).toEqual(manifest)
    const applied = await applyExact(restarted, rehydrated, {
      authorizationId: "durable-review-authorization",
      approvedPaths: ["src/a.txt"],
    })
    expect(applied.status).toBe("applied")
    expect(await readFile(join(source, "src", "a.txt"), "utf8")).toBe("rehydrated")
    await restarted.cleanup(rehydrated)
    await restarted.disposeJournal(applied.journalPath, applied.journalDigest)
  })

  it("rejects a rehydrated stage when its manifest or reviewed contents changed", async () => {
    const source = await workspace()
    const original = new WorkspaceStagingService()
    const stage = await original.create(source)
    const manifest = original.exportManifest(stage)
    await writeFile(join(stage.root, "src", "a.txt"), "reviewed")
    const inspection = await original.inspect(stage)

    const forged = structuredClone(manifest)
    ;(forged.baseline.files[0] as { digest: string }).digest = `sha256:${"0".repeat(64)}`
    await expect(new WorkspaceStagingService().rehydrate(forged, inspection)).rejects.toThrow(/baseline digest is invalid/)

    await writeFile(join(stage.root, "src", "a.txt"), "changed-after-review")
    await expect(new WorkspaceStagingService().rehydrate(manifest, inspection)).rejects.toThrow(
      /no longer matches its exact persisted review inspection/,
    )
    await original.cleanup(stage)
  })

  it.runIf(process.platform !== "win32")("rejects symbolic links instead of following them", async () => {
    const source = await workspace()
    await symlink("/tmp", join(source, "src", "escape"))
    await expect(new WorkspaceStagingService().create(source)).rejects.toThrow("rejects symbolic links")
  })

  it("rejects secret-shaped paths introduced inside staging", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService()
    const stage = await service.create(source)
    await writeFile(join(stage.root, ".env"), "SECRET=introduced")
    await expect(service.inspect(stage)).rejects.toThrow("excluded secret or runtime path")
    await service.cleanup(stage)
  })

  it.runIf(process.platform !== "win32")("rejects symbolic links introduced inside staging", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService()
    const stage = await service.create(source)
    await symlink("/tmp", join(stage.root, "src", "introduced-link"))
    await expect(service.inspect(stage)).rejects.toThrow("rejects symbolic links")
    await service.cleanup(stage)
  })

  it("enforces file and total-size limits before copying", async () => {
    const source = await workspace()
    await writeFile(join(source, "large.bin"), Buffer.alloc(32))
    await expect(new WorkspaceStagingService({ limits: { maxFileBytes: 16 } }).create(source)).rejects.toThrow(
      "file size limit exceeded",
    )
  })

  it("treats every public resource limit as a tightening-only hard ceiling", () => {
    const hardMaximums = {
      maxEntries: 50_000,
      maxDirectories: 10_000,
      maxExcludedPaths: 20_000,
      maxFiles: 20_000,
      maxFileBytes: 16 * 1024 * 1024,
      maxTotalBytes: 512 * 1024 * 1024,
      maxDepth: 64,
      maxRelativePathBytes: 4_096,
      maxPathMetadataBytes: 1 * 1024 * 1024,
    } as const
    for (const [key, value] of Object.entries(hardMaximums)) {
      expect(() => new WorkspaceStagingService({ limits: { [key]: value + 1 } }))
        .toThrow(/hard maximum/)
    }
    expect(() => new WorkspaceStagingService({ limits: { maxFileBytes: 2, maxTotalBytes: 1 } }))
      .toThrow(/internally inconsistent/)
    expect(() => new WorkspaceStagingService({ limits: { maxRelativePathBytes: 2, maxPathMetadataBytes: 1 } }))
      .toThrow(/internally inconsistent/)
  })

  it("rejects cumulative path metadata before copying a provider workspace", async () => {
    const source = await workspace()
    await expect(new WorkspaceStagingService({
      limits: { maxRelativePathBytes: 16, maxPathMetadataBytes: 16 },
    }).create(source)).rejects.toThrow("path metadata limit exceeded")
  })

  it("bounds every scanned directory entry, directory, and excluded root", async () => {
    const source = await workspace()
    await mkdir(join(source, "empty-a"))
    await mkdir(join(source, "empty-b"))
    await mkdir(join(source, ".git"))
    await mkdir(join(source, ".codex"))

    await expect(new WorkspaceStagingService({ limits: { maxEntries: 3 } }).create(source)).rejects.toThrow(
      "entry count limit exceeded",
    )
    await expect(new WorkspaceStagingService({ limits: { maxDirectories: 2 } }).create(source)).rejects.toThrow(
      "directory count limit exceeded",
    )
    await expect(new WorkspaceStagingService({ limits: { maxExcludedPaths: 1 } }).create(source)).rejects.toThrow(
      "excluded-path count limit exceeded",
    )
  })

  it("rejects an untrusted world-writable custom temporary parent", async () => {
    const parent = await mkdtemp(join(tmpdir(), "gaep-untrusted-staging-parent-"))
    temporaryDirectories.push(parent)
    await chmod(parent, 0o777)
    expect(() => new WorkspaceStagingService({ tempParent: parent })).toThrow(/trusted ownership and permission boundary/)
  })

  it("accepts exactly 128 approved additions at preflight and rejects 129", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService()
    const stage128 = await service.create(source)
    await Promise.all(Array.from({ length: 128 }, (_, index) =>
      writeFile(join(stage128.root, `added-${String(index).padStart(3, "0")}.txt`), "added")))
    const inspection128 = await service.inspect(stage128)
    await expect(service.preflightApply(stage128, {
      authorizationId: "auth-128",
      approvedPaths: inspection128.changes.map((change) => change.path),
      expectedInspectionDigest: canonicalDigest(inspection128) as `sha256:${string}`,
    })).resolves.toEqual(inspection128)
    await service.cleanup(stage128)

    const stage129 = await service.create(source)
    await Promise.all(Array.from({ length: 129 }, (_, index) =>
      writeFile(join(stage129.root, `added-${String(index).padStart(3, "0")}.txt`), "added")))
    const inspection129 = await service.inspect(stage129)
    await expect(service.preflightApply(stage129, {
      authorizationId: "auth-129",
      approvedPaths: inspection129.changes.map((change) => change.path),
      expectedInspectionDigest: canonicalDigest(inspection129) as `sha256:${string}`,
    })).rejects.toThrow(/Approved path inventory exceeds its bound/)
    await service.cleanup(stage129)
  })

  it("admits the 128-entry worst-case rewrite plan within the composite budget", async () => {
    const source = await workspace()
    await Promise.all(Array.from({ length: 128 }, (_, index) =>
      writeFile(join(source, `rewrite-${String(index).padStart(3, "0")}.txt`), "before")))
    const service = new WorkspaceStagingService()
    const stage = await service.create(source)
    await Promise.all(Array.from({ length: 128 }, (_, index) =>
      writeFile(join(stage.root, `rewrite-${String(index).padStart(3, "0")}.txt`), "after")))
    const inspection = await service.inspect(stage)

    let prepared: WorkspaceJournalPreparedError | undefined
    try {
      await service.apply(stage, {
      authorizationId: "auth-rewrite-bound",
      approvedPaths: inspection.changes.map((change) => change.path),
      expectedInspectionDigest: canonicalDigest(inspection) as `sha256:${string}`,
        onJournalPrepared: () => {
          throw new Error("stop after bounded WAL preparation")
        },
      })
    } catch (error) {
      if (error instanceof WorkspaceJournalPreparedError) prepared = error
      else throw error
    }
    expect(prepared).toBeDefined()
    expect(await readFile(join(source, "rewrite-000.txt"), "utf8")).toBe("before")
    await service.disposeJournal(prepared!.journalPath, prepared!.journalDigest)
    await service.cleanup(stage)
  }, 20_000)

  it("admits exactly 256 created-directory intents and rejects 257", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService()
    const stage256 = await service.create(source)
    await Promise.all(Array.from({ length: 128 }, async (_, index) => {
      const directory = join(stage256.root, `d-${String(index).padStart(3, "0")}`, "nested")
      await mkdir(directory, { recursive: true })
      await writeFile(join(directory, "added.txt"), "added")
    }))
    const inspection256 = await service.inspect(stage256)
    let prepared: WorkspaceJournalPreparedError | undefined
    try {
      await service.apply(stage256, {
        authorizationId: "auth-256-directories",
        approvedPaths: inspection256.changes.map((change) => change.path),
        expectedInspectionDigest: canonicalDigest(inspection256) as `sha256:${string}`,
        onJournalPrepared: () => {
          throw new Error("stop after 256-directory WAL preparation")
        },
      })
    } catch (error) {
      if (error instanceof WorkspaceJournalPreparedError) prepared = error
      else throw error
    }
    expect(prepared).toBeDefined()
    await service.disposeJournal(prepared!.journalPath, prepared!.journalDigest)
    await service.cleanup(stage256)

    const stage257 = await service.create(source)
    await Promise.all(Array.from({ length: 128 }, async (_, index) => {
      const segments = index === 127
        ? [`d-${String(index).padStart(3, "0")}`, "nested", "extra"]
        : [`d-${String(index).padStart(3, "0")}`, "nested"]
      const directory = join(stage257.root, ...segments)
      await mkdir(directory, { recursive: true })
      await writeFile(join(directory, "added.txt"), "added")
    }))
    const inspection257 = await service.inspect(stage257)
    await expect(service.apply(stage257, {
      authorizationId: "auth-257-directories",
      approvedPaths: inspection257.changes.map((change) => change.path),
      expectedInspectionDigest: canonicalDigest(inspection257) as `sha256:${string}`,
    })).rejects.toThrow(/created-directory intent count exceeds/)
    await service.cleanup(stage257)
  })

  it("enforces the independent 256 MiB projected WAL rewrite-byte budget below count ceilings", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService()
    const stage = await service.create(source)
    await Promise.all(Array.from({ length: 128 }, async (_, index) => {
      const first = `${String(index).padStart(3, "0")}-${"a".repeat(235)}`
      const second = "b".repeat(240)
      const directory = join(stage.root, first, second)
      await mkdir(directory, { recursive: true })
      await writeFile(join(directory, "added.txt"), "added")
    }))
    const inspection = await service.inspect(stage)

    await expect(service.apply(stage, {
      authorizationId: "auth-rewrite-byte-budget",
      approvedPaths: inspection.changes.map((change) => change.path),
      expectedInspectionDigest: canonicalDigest(inspection) as `sha256:${string}`,
      onJournalPrepared: () => {
        throw new Error("count ceilings passed unexpectedly without byte-budget rejection")
      },
    })).rejects.toThrow(/rewrite work exceeds its immutable hard budget/)
    await service.cleanup(stage)
  })

  it.runIf(process.platform !== "win32")("rejects paths that cannot round-trip across supported hosts", async () => {
    const source = await workspace()
    await writeFile(join(source, "bad:name.txt"), "not portable")
    await expect(new WorkspaceStagingService().create(source)).rejects.toThrow("cross-host portable")
  })

  it.runIf(process.platform !== "win32")("detects and applies executable-mode-only changes", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService()
    const stage = await service.create(source)
    const beforeMode = (await stat(join(source, "src", "a.txt"))).mode & 0o777
    await chmod(join(stage.root, "src", "a.txt"), 0o755)

    const inspection = await service.inspect(stage)
    expect(inspection.changes).toEqual([expect.objectContaining({
      path: "src/a.txt",
      kind: "modified",
      beforeMode,
      afterMode: 0o755,
    })])
    const result = await applyExact(service, stage, { authorizationId: "auth-mode", approvedPaths: ["src/a.txt"] })
    expect(result.status).toBe("applied")
    expect((await stat(join(source, "src", "a.txt"))).mode & 0o777).toBe(0o755)
    await service.cleanup(stage)
    await service.disposeJournal(result.journalPath, result.journalDigest)
  })

  it("applies an exact approved inventory only when the original baseline still matches", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService()
    const stage = await service.create(source)
    await writeFile(join(stage.root, "src", "a.txt"), "approved")

    await expect(applyExact(service, stage, { authorizationId: "auth-1", approvedPaths: [] })).rejects.toThrow(
      "exactly match",
    )
    const result = await applyExact(service, stage, { authorizationId: "auth-1", approvedPaths: ["src/a.txt"] })
    expect(result.status).toBe("applied")
    expect(result.evidence.applied).toBe(true)
    expect(await readFile(join(source, "src", "a.txt"), "utf8")).toBe("approved")
    expect(result.evidence.changes[0]?.path).toBe("src/a.txt")
    service.assertManagedEvidence(stage, result.evidence)
    expect(() => service.assertManagedEvidence(stage, structuredClone(result.evidence))).toThrow("unknown, forged")
    await service.cleanup(stage)
    await expect(readFile(result.journalPath, "utf8")).resolves.toContain('"state": "committed"')
    await service.disposeJournal(result.journalPath, result.journalDigest)
  })

  it("durably publishes the prepared journal before source mutation and checkpoints exact backup intent", async () => {
    const source = await workspace()
    let prepared: Record<string, unknown> | undefined
    const service = new WorkspaceStagingService()
    const stage = await service.create(source)
    await writeFile(join(stage.root, "src", "a.txt"), "approved")
    const inspection = await service.inspect(stage)
    const result = await service.apply(stage, {
      authorizationId: "auth-write-ahead",
      approvedPaths: ["src/a.txt"],
      expectedInspectionDigest: canonicalDigest(inspection) as `sha256:${string}`,
      onJournalPrepared: async (journalPath, _digest, journalId) => {
        prepared = JSON.parse(await readFile(journalPath, "utf8")) as Record<string, unknown>
        expect(prepared).toMatchObject({ schemaVersion: 2, id: journalId, state: "prepared" })
        expect(prepared.entries).toEqual([
          expect.objectContaining({ path: "src/a.txt", prepared: false, applied: false }),
        ])
        expect(await readFile(join(source, "src", "a.txt"), "utf8")).toBe("alpha")
      },
    })

    expect(result.status).toBe("applied")
    expect(prepared).toBeDefined()
    expect(JSON.parse(await readFile(result.journalPath, "utf8"))).toMatchObject({
      state: "committed",
      entries: [expect.objectContaining({
        path: "src/a.txt",
        prepared: true,
        applied: true,
        backupSize: 5,
      })],
    })
    await service.cleanup(stage)
    await service.disposeJournal(result.journalPath, result.journalDigest)
  })

  it("rejects changed staged bytes even when the approved path inventory is unchanged", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService()
    const stage = await service.create(source)
    await writeFile(join(stage.root, "src", "a.txt"), "reviewed bytes")
    const reviewed = await service.inspect(stage)
    const expectedInspectionDigest = canonicalDigest(reviewed) as `sha256:${string}`

    await writeFile(join(stage.root, "src", "a.txt"), "different bytes")
    await expect(service.apply(stage, {
      authorizationId: "auth-exact-content",
      approvedPaths: ["src/a.txt"],
      expectedInspectionDigest,
    })).rejects.toThrow(/no longer matches the exact reviewed inspection/)
    expect(await readFile(join(source, "src", "a.txt"), "utf8")).toBe("alpha")
    await service.cleanup(stage)
  })

  it("records a conflict and never overwrites a changed original baseline", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService()
    const stage = await service.create(source)
    await writeFile(join(stage.root, "src", "a.txt"), "staged")
    await writeFile(join(source, "src", "b.txt"), "concurrent")

    const result = await applyExact(service, stage, { authorizationId: "auth-2", approvedPaths: ["src/a.txt"] })
    expect(result.status).toBe("conflict")
    expect(result.evidence.applied).toBe(false)
    expect(await readFile(join(source, "src", "a.txt"), "utf8")).toBe("alpha")
    expect(JSON.parse(await readFile(result.journalPath, "utf8"))).toMatchObject({ state: "conflict" })
    await service.cleanup(stage)
    await service.disposeJournal(result.journalPath, result.journalDigest)
  })

  it("rolls back already-applied files and journals a deterministic mid-apply failure", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService({
      beforeApplyOperation: (_path, index) => {
        if (index === 1) throw new Error("injected apply failure")
      },
    })
    const stage = await service.create(source)
    await writeFile(join(stage.root, "src", "a.txt"), "changed-a")
    await writeFile(join(stage.root, "src", "b.txt"), "changed-b")

    let failure: WorkspaceApplyError | undefined
    try {
      await applyExact(service, stage, { authorizationId: "auth-3", approvedPaths: ["src/a.txt", "src/b.txt"] })
    } catch (error) {
      if (error instanceof WorkspaceApplyError) failure = error
      else throw error
    }
    expect(failure?.rollbackSucceeded).toBe(true)
    expect(await readFile(join(source, "src", "a.txt"), "utf8")).toBe("alpha")
    expect(await readFile(join(source, "src", "b.txt"), "utf8")).toBe("beta")
    expect(JSON.parse(await readFile(failure!.journalPath, "utf8"))).toMatchObject({ state: "rolled-back" })
    await service.cleanup(stage)
    await service.disposeJournal(failure!.journalPath, failure!.journalDigest)
  })

  it("does not overwrite a concurrent edit to an already-applied file during rollback", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService({
      beforeApplyOperation: async (_path, index) => {
        if (index === 1) {
          await writeFile(join(source, "src", "a.txt"), "concurrent-after-apply")
          throw new Error("injected failure after concurrent edit")
        }
      },
    })
    const stage = await service.create(source)
    await writeFile(join(stage.root, "src", "a.txt"), "changed-a")
    await writeFile(join(stage.root, "src", "b.txt"), "changed-b")

    let failure: WorkspaceApplyError | undefined
    try {
      await applyExact(service, stage, { authorizationId: "auth-concurrent-rollback", approvedPaths: ["src/a.txt", "src/b.txt"] })
    } catch (error) {
      if (error instanceof WorkspaceApplyError) failure = error
      else throw error
    }

    expect(failure?.rollbackSucceeded).toBe(false)
    expect(await readFile(join(source, "src", "a.txt"), "utf8")).toBe("concurrent-after-apply")
    expect(await readFile(join(source, "src", "b.txt"), "utf8")).toBe("beta")
    expect(JSON.parse(await readFile(failure!.journalPath, "utf8"))).toMatchObject({ state: "rollback-failed" })
    await service.cleanup(stage)
    await service.disposeJournal(failure!.journalPath, failure!.journalDigest)
  })

  it("revalidates exact applied identity immediately before rollback and preserves a last-moment writer", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService({
      beforeApplyOperation: (_path, index) => {
        if (index === 1) throw new Error("force rollback")
      },
      beforeRollbackMutation: async (path) => {
        if (path === "src/a.txt") await writeFile(join(source, "src", "a.txt"), "rollback-window-writer")
      },
    })
    const stage = await service.create(source)
    await writeFile(join(stage.root, "src", "a.txt"), "changed-a")
    await writeFile(join(stage.root, "src", "b.txt"), "changed-b")

    let failure: WorkspaceApplyError | undefined
    try {
      await applyExact(service, stage, { authorizationId: "auth-rollback-cas", approvedPaths: ["src/a.txt", "src/b.txt"] })
    } catch (error) {
      if (error instanceof WorkspaceApplyError) failure = error
      else throw error
    }
    expect(failure?.rollbackSucceeded).toBe(false)
    expect(await readFile(join(source, "src", "a.txt"), "utf8")).toBe("rollback-window-writer")
    expect(JSON.parse(await readFile(failure!.journalPath, "utf8"))).toMatchObject({ state: "rollback-failed" })
    await service.cleanup(stage)
    await service.disposeJournal(failure!.journalPath, failure!.journalDigest)
  })

  it("revalidates an added file immediately before rollback deletion and preserves a last-moment writer", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService({
      afterSourceMutation: () => {
        throw new Error("force rollback after added-file rename")
      },
      beforeRollbackMutation: async (path) => {
        if (path === "src/added.txt") await writeFile(join(source, path), "rollback-window-writer")
      },
    })
    const stage = await service.create(source)
    await writeFile(join(stage.root, "src", "added.txt"), "staged-added")

    let failure: WorkspaceApplyError | undefined
    try {
      await applyExact(service, stage, { authorizationId: "auth-added-rollback-cas", approvedPaths: ["src/added.txt"] })
    } catch (error) {
      if (error instanceof WorkspaceApplyError) failure = error
      else throw error
    }
    expect(failure?.rollbackSucceeded).toBe(false)
    expect(await readFile(join(source, "src", "added.txt"), "utf8")).toBe("rollback-window-writer")
    expect(JSON.parse(await readFile(failure!.journalPath, "utf8"))).toMatchObject({ state: "rollback-failed" })
    await service.cleanup(stage)
    await service.disposeJournal(failure!.journalPath, failure!.journalDigest)
  })

  it("removes its exact newly-created directory chain during ordinary rollback", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService({
      afterCreatedDirectoryRename: (path) => {
        if (path === "src/nested/deep") throw new Error("injected failure after directory materialization")
      },
    })
    const stage = await service.create(source)
    await mkdir(join(stage.root, "src", "nested", "deep"), { recursive: true })
    await writeFile(join(stage.root, "src", "nested", "deep", "added.txt"), "staged")

    let failure: WorkspaceApplyError | undefined
    try {
      await applyExact(service, stage, {
        authorizationId: "auth-nested-rollback",
        approvedPaths: ["src/nested/deep/added.txt"],
      })
    } catch (error) {
      if (error instanceof WorkspaceApplyError) failure = error
      else throw error
    }
    expect(failure?.rollbackSucceeded).toBe(true)
    await expect(access(join(source, "src", "nested"))).rejects.toMatchObject({ code: "ENOENT" })
    await service.cleanup(stage)
    await service.disposeJournal(failure!.journalPath, failure!.journalDigest)
  })

  it("does not adopt or delete a concurrently-created empty directory target", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService({
      beforeCreatedDirectoryRename: async (path) => {
        if (path === "src/concurrent") await mkdir(join(source, path))
      },
    })
    const stage = await service.create(source)
    await mkdir(join(stage.root, "src", "concurrent"), { recursive: true })
    await writeFile(join(stage.root, "src", "concurrent", "added.txt"), "staged")

    let failure: WorkspaceApplyError | undefined
    try {
      await applyExact(service, stage, {
        authorizationId: "auth-concurrent-directory",
        approvedPaths: ["src/concurrent/added.txt"],
      })
    } catch (error) {
      if (error instanceof WorkspaceApplyError) failure = error
      else throw error
    }
    expect(failure?.rollbackSucceeded).toBe(false)
    await expect(access(join(source, "src", "concurrent"))).resolves.toBeUndefined()
    await expect(access(join(source, "src", "concurrent", "added.txt"))).rejects.toMatchObject({ code: "ENOENT" })
    await service.cleanup(stage)
    await service.disposeJournal(failure!.journalPath, failure!.journalDigest)
  })

  it("rejects a cross-entry swap of an earlier journal-owned shared parent", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService({
      beforeCreatedDirectoryRename: async (path) => {
        if (path !== "src/shared/deep") return
        await rename(join(source, "src", "shared"), join(source, "src", "shared-original"))
        await mkdir(join(source, "src", "shared"))
        await writeFile(join(source, "src", "shared", "external.txt"), "external")
      },
    })
    const stage = await service.create(source)
    await mkdir(join(stage.root, "src", "shared", "deep"), { recursive: true })
    await writeFile(join(stage.root, "src", "shared", "a.txt"), "first")
    await writeFile(join(stage.root, "src", "shared", "deep", "b.txt"), "second")

    let failure: WorkspaceApplyError | undefined
    try {
      await applyExact(service, stage, {
        authorizationId: "auth-cross-entry-parent",
        approvedPaths: ["src/shared/a.txt", "src/shared/deep/b.txt"],
      })
    } catch (error) {
      if (error instanceof WorkspaceApplyError) failure = error
      else throw error
    }
    expect(failure?.rollbackSucceeded).toBe(false)
    expect(await readFile(join(source, "src", "shared", "external.txt"), "utf8")).toBe("external")
    await expect(access(join(source, "src", "shared", "deep", "b.txt"))).rejects.toMatchObject({ code: "ENOENT" })
    await service.cleanup(stage)
    await service.disposeJournal(failure!.journalPath, failure!.journalDigest)
  })

  it("detects a target race after whole-workspace baseline verification", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService({
      beforeApplyOperation: async (_path, index) => {
        if (index === 0) await writeFile(join(source, "src", "a.txt"), "raced")
      },
    })
    const stage = await service.create(source)
    await writeFile(join(stage.root, "src", "a.txt"), "staged")

    let failure: WorkspaceApplyError | undefined
    try {
      await applyExact(service, stage, { authorizationId: "auth-race", approvedPaths: ["src/a.txt"] })
    } catch (error) {
      if (error instanceof WorkspaceApplyError) failure = error
      else throw error
    }
    expect(failure?.rollbackSucceeded).toBe(true)
    expect(await readFile(join(source, "src", "a.txt"), "utf8")).toBe("raced")
    await service.cleanup(stage)
    await service.disposeJournal(failure!.journalPath, failure!.journalDigest)
  })

  it("rejects a same-content source replacement after fresh baseline verification", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService({
      beforeApplyOperation: async (_path, index) => {
        if (index !== 0) return
        await rename(join(source, "src", "a.txt"), join(source, "src", "a-original.txt"))
        await writeFile(join(source, "src", "a.txt"), "alpha")
      },
    })
    const stage = await service.create(source)
    await writeFile(join(stage.root, "src", "a.txt"), "staged")

    let failure: WorkspaceApplyError | undefined
    try {
      await applyExact(service, stage, { authorizationId: "auth-same-content-swap", approvedPaths: ["src/a.txt"] })
    } catch (error) {
      if (error instanceof WorkspaceApplyError) failure = error
      else throw error
    }
    expect(failure?.rollbackSucceeded).toBe(true)
    expect(await readFile(join(source, "src", "a.txt"), "utf8")).toBe("alpha")
    expect(await readFile(join(source, "src", "a-original.txt"), "utf8")).toBe("alpha")
    await service.cleanup(stage)
    await service.disposeJournal(failure!.journalPath, failure!.journalDigest)
  })

  it("rejects a same-content source parent replacement even when the file inode is preserved", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService({
      beforeApplyOperation: async (_path, index) => {
        if (index !== 0) return
        await rename(join(source, "src"), join(source, "src-original"))
        await mkdir(join(source, "src"))
        await rename(join(source, "src-original", "a.txt"), join(source, "src", "a.txt"))
        await rename(join(source, "src-original", "b.txt"), join(source, "src", "b.txt"))
      },
    })
    const stage = await service.create(source)
    await writeFile(join(stage.root, "src", "a.txt"), "staged")

    let failure: WorkspaceApplyError | undefined
    try {
      await applyExact(service, stage, { authorizationId: "auth-parent-swap", approvedPaths: ["src/a.txt"] })
    } catch (error) {
      if (error instanceof WorkspaceApplyError) failure = error
      else throw error
    }
    expect(failure?.rollbackSucceeded).toBe(true)
    expect(await readFile(join(source, "src", "a.txt"), "utf8")).toBe("alpha")
    await expect(access(join(source, "src-original"))).resolves.toBeUndefined()
    await service.cleanup(stage)
    await service.disposeJournal(failure!.journalPath, failure!.journalDigest)
  })

  it("never overwrites a concurrently created final backup", async () => {
    const source = await workspace()
    let journalPath: string | undefined
    const service = new WorkspaceStagingService({
      afterBackupTemporarySync: async () => {
        await writeFile(join(dirname(journalPath!), "backups", "0.bin"), "external-backup", { mode: 0o600 })
      },
    })
    const stage = await service.create(source)
    await writeFile(join(stage.root, "src", "a.txt"), "staged")
    const inspection = await service.inspect(stage)

    let failure: WorkspaceApplyError | undefined
    try {
      await service.apply(stage, {
        authorizationId: "auth-backup-cas",
        approvedPaths: ["src/a.txt"],
        expectedInspectionDigest: canonicalDigest(inspection) as `sha256:${string}`,
        onJournalPrepared: (path) => {
          journalPath = path
        },
      })
    } catch (error) {
      if (error instanceof WorkspaceApplyError) failure = error
      else throw error
    }
    expect(await readFile(join(dirname(failure!.journalPath), "backups", "0.bin"), "utf8")).toBe("external-backup")
    expect(await readFile(join(source, "src", "a.txt"), "utf8")).toBe("alpha")
    await service.cleanup(stage)
    await service.disposeJournal(failure!.journalPath, failure!.journalDigest)
  })

  it("rejects a backup-root symlink swap without writing source bytes outside the journal", async () => {
    const source = await workspace()
    const external = await mkdtemp(join(tmpdir(), "gaep-external-backups-"))
    temporaryDirectories.push(external)
    let journalPath: string | undefined
    let displacedBackupRoot: string | undefined
    const service = new WorkspaceStagingService({
      afterBackupTemporarySync: async () => {
        const backupRoot = join(dirname(journalPath!), "backups")
        displacedBackupRoot = `${backupRoot}-displaced`
        await rename(backupRoot, displacedBackupRoot)
        await symlink(external, backupRoot)
      },
    })
    const stage = await service.create(source)
    await writeFile(join(stage.root, "src", "a.txt"), "staged")
    const inspection = await service.inspect(stage)

    await expect(service.apply(stage, {
      authorizationId: "auth-backup-root-swap",
      approvedPaths: ["src/a.txt"],
      expectedInspectionDigest: canonicalDigest(inspection) as `sha256:${string}`,
      onJournalPrepared: (path) => {
        journalPath = path
      },
    })).rejects.toThrow(/journal backup|root identity|symbolic/i)
    await expect(access(join(external, "0.bin"))).rejects.toMatchObject({ code: "ENOENT" })
    await rm(join(dirname(journalPath!), "backups"))
    await rename(displacedBackupRoot!, join(dirname(journalPath!), "backups"))
    const journalBytes = await readFile(journalPath!)
    const journalDigest = `sha256:${createHash("sha256").update(journalBytes).digest("hex")}` as const
    await service.cleanup(stage)
    await service.disposeJournal(journalPath!, journalDigest)
  })

  it("rejects a journal-root symlink swap before creating a redirected WAL temporary", async () => {
    const source = await workspace()
    const external = await mkdtemp(join(tmpdir(), "gaep-external-journal-"))
    temporaryDirectories.push(external)
    let journalPath: string | undefined
    let displacedJournalRoot: string | undefined
    const service = new WorkspaceStagingService({
      beforeJournalWrite: async (state) => {
        if (state !== "applying" || !journalPath || displacedJournalRoot) return
        const journalRoot = dirname(journalPath)
        displacedJournalRoot = `${journalRoot}-displaced`
        await rename(journalRoot, displacedJournalRoot)
        await symlink(external, journalRoot)
      },
    })
    const stage = await service.create(source)
    await writeFile(join(stage.root, "src", "a.txt"), "staged")
    const inspection = await service.inspect(stage)

    await expect(service.apply(stage, {
      authorizationId: "auth-journal-root-swap",
      approvedPaths: ["src/a.txt"],
      expectedInspectionDigest: canonicalDigest(inspection) as `sha256:${string}`,
      onJournalPrepared: (path) => {
        journalPath = path
      },
    })).rejects.toThrow(/journal.*identity|root identity|symbolic/i)
    await expect(access(join(external, "journal.json"))).rejects.toMatchObject({ code: "ENOENT" })
    await rm(dirname(journalPath!))
    await rename(displacedJournalRoot!, dirname(journalPath!))
    const journalBytes = await readFile(journalPath!)
    const journalDigest = `sha256:${createHash("sha256").update(journalBytes).digest("hex")}` as const
    await service.cleanup(stage)
    await service.disposeJournal(journalPath!, journalDigest)
  })

  it("fails closed on a same-path edit after the write-ahead checkpoint and preserves the external bytes", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService({
      beforeSourceMutation: async () => {
        await writeFile(join(source, "src", "a.txt"), "external-writer")
      },
    })
    const stage = await service.create(source)
    await writeFile(join(stage.root, "src", "a.txt"), "staged")

    let failure: WorkspaceApplyError | undefined
    try {
      await applyExact(service, stage, { authorizationId: "auth-final-cas", approvedPaths: ["src/a.txt"] })
    } catch (error) {
      if (error instanceof WorkspaceApplyError) failure = error
      else throw error
    }
    expect(failure?.rollbackSucceeded).toBe(false)
    expect(await readFile(join(source, "src", "a.txt"), "utf8")).toBe("external-writer")
    expect(JSON.parse(await readFile(failure!.journalPath, "utf8"))).toMatchObject({ state: "rollback-failed" })
    await service.cleanup(stage)
    await service.disposeJournal(failure!.journalPath, failure!.journalDigest)
  })

  it("reconciles and rolls back a source syscall that faults before its applied checkpoint", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService({
      afterSourceMutation: () => {
        throw new Error("injected post-rename fault")
      },
    })
    const stage = await service.create(source)
    await writeFile(join(stage.root, "src", "a.txt"), "staged")

    let failure: WorkspaceApplyError | undefined
    try {
      await applyExact(service, stage, { authorizationId: "auth-post-rename", approvedPaths: ["src/a.txt"] })
    } catch (error) {
      if (error instanceof WorkspaceApplyError) failure = error
      else throw error
    }
    expect(failure?.rollbackSucceeded).toBe(true)
    expect(await readFile(join(source, "src", "a.txt"), "utf8")).toBe("alpha")
    expect(JSON.parse(await readFile(failure!.journalPath, "utf8"))).toMatchObject({
      state: "rolled-back",
      entries: [expect.objectContaining({ prepared: true, applied: true, rolledBack: true })],
    })
    await service.cleanup(stage)
    await service.disposeJournal(failure!.journalPath, failure!.journalDigest)
  })

  it("restores an exactly deleted file when the post-unlink checkpoint path faults", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService({
      afterSourceMutation: () => {
        throw new Error("injected post-unlink fault")
      },
    })
    const stage = await service.create(source)
    await rm(join(stage.root, "src", "a.txt"))

    let failure: WorkspaceApplyError | undefined
    try {
      await applyExact(service, stage, { authorizationId: "auth-delete-rollback", approvedPaths: ["src/a.txt"] })
    } catch (error) {
      if (error instanceof WorkspaceApplyError) failure = error
      else throw error
    }
    expect(failure?.rollbackSucceeded).toBe(true)
    expect(await readFile(join(source, "src", "a.txt"), "utf8")).toBe("alpha")
    expect(JSON.parse(await readFile(failure!.journalPath, "utf8"))).toMatchObject({
      state: "rolled-back",
      entries: [expect.objectContaining({ kind: "deleted", applied: true, rolledBack: true })],
    })
    await service.cleanup(stage)
    await service.disposeJournal(failure!.journalPath, failure!.journalDigest)
  })

  it("preserves a same-content replacement of the applied inode instead of rolling it back", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService({
      afterSourceMutation: async () => {
        const target = join(source, "src", "a.txt")
        await rename(target, join(source, "src", "applied-original.txt"))
        await writeFile(target, "staged")
        throw new Error("injected same-content post-apply replacement")
      },
    })
    const stage = await service.create(source)
    await writeFile(join(stage.root, "src", "a.txt"), "staged")

    let failure: WorkspaceApplyError | undefined
    try {
      await applyExact(service, stage, { authorizationId: "auth-rollback-identity", approvedPaths: ["src/a.txt"] })
    } catch (error) {
      if (error instanceof WorkspaceApplyError) failure = error
      else throw error
    }
    expect(failure?.rollbackSucceeded).toBe(false)
    expect(await readFile(join(source, "src", "a.txt"), "utf8")).toBe("staged")
    expect(JSON.parse(await readFile(failure!.journalPath, "utf8"))).toMatchObject({ state: "rollback-failed" })
    await service.cleanup(stage)
    await service.disposeJournal(failure!.journalPath, failure!.journalDigest)
  })

  it("rolls back when a durable journal checkpoint fails after an applied operation", async () => {
    const source = await workspace()
    let applyingWrites = 0
    const service = new WorkspaceStagingService({
      beforeJournalWrite: (state) => {
        if (state === "applying" && ++applyingWrites === 2) throw new Error("injected journal fault")
      },
    })
    const stage = await service.create(source)
    await writeFile(join(stage.root, "src", "a.txt"), "changed-a")
    await writeFile(join(stage.root, "src", "b.txt"), "changed-b")

    let failure: WorkspaceApplyError | undefined
    try {
      await applyExact(service, stage, { authorizationId: "auth-journal", approvedPaths: ["src/a.txt", "src/b.txt"] })
    } catch (error) {
      if (error instanceof WorkspaceApplyError) failure = error
      else throw error
    }
    expect(failure?.rollbackSucceeded).toBe(true)
    expect(await readFile(join(source, "src", "a.txt"), "utf8")).toBe("alpha")
    expect(await readFile(join(source, "src", "b.txt"), "utf8")).toBe("beta")
    expect(JSON.parse(await readFile(failure!.journalPath, "utf8"))).toMatchObject({ state: "rolled-back" })
    await service.cleanup(stage)
    await service.disposeJournal(failure!.journalPath, failure!.journalDigest)
  })
})
