import { chmod, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { WorkspaceApplyError, WorkspaceStagingService } from "./workspace-staging.js"

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

  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
  })

  it("copies only bounded non-secret files and reports relative change evidence", async () => {
    const source = await workspace()
    await mkdir(join(source, ".git"))
    await writeFile(join(source, ".git", "config"), "secret-ish")
    await mkdir(join(source, ".GAEP", "runtime"), { recursive: true })
    await writeFile(join(source, ".GAEP", "runtime", "case-insensitive.json"), "{}")
    await writeFile(join(source, ".env"), "TOKEN=secret")
    const service = new WorkspaceStagingService()
    const stage = await service.create(source)

    await expect(readFile(join(stage.root, ".env"))).rejects.toMatchObject({ code: "ENOENT" })
    await writeFile(join(stage.root, "src", "a.txt"), "changed")
    await rm(join(stage.root, "src", "b.txt"))
    await writeFile(join(stage.root, "src", "c.txt"), "added")
    const inspection = await service.inspect(stage)

    expect(inspection.baselineDigest).not.toBe(inspection.finalDigest)
    expect(inspection.excludedPaths).toEqual(expect.arrayContaining([".git", ".env", ".GAEP/runtime"]))
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
    service.assertManagedStage(stage)
    await service.cleanup(stage)
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
    const result = await service.apply(stage, { authorizationId: "auth-mode", approvedPaths: ["src/a.txt"] })
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

    await expect(service.apply(stage, { authorizationId: "auth-1", approvedPaths: [] })).rejects.toThrow(
      "exactly match",
    )
    const result = await service.apply(stage, { authorizationId: "auth-1", approvedPaths: ["src/a.txt"] })
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

  it("records a conflict and never overwrites a changed original baseline", async () => {
    const source = await workspace()
    const service = new WorkspaceStagingService()
    const stage = await service.create(source)
    await writeFile(join(stage.root, "src", "a.txt"), "staged")
    await writeFile(join(source, "src", "b.txt"), "concurrent")

    const result = await service.apply(stage, { authorizationId: "auth-2", approvedPaths: ["src/a.txt"] })
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
      await service.apply(stage, { authorizationId: "auth-3", approvedPaths: ["src/a.txt", "src/b.txt"] })
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
      await service.apply(stage, { authorizationId: "auth-concurrent-rollback", approvedPaths: ["src/a.txt", "src/b.txt"] })
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
      await service.apply(stage, { authorizationId: "auth-race", approvedPaths: ["src/a.txt"] })
    } catch (error) {
      if (error instanceof WorkspaceApplyError) failure = error
      else throw error
    }
    expect(failure?.rollbackSucceeded).toBe(true)
    expect(await readFile(join(source, "src", "a.txt"), "utf8")).toBe("raced")
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
      await service.apply(stage, { authorizationId: "auth-journal", approvedPaths: ["src/a.txt", "src/b.txt"] })
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
