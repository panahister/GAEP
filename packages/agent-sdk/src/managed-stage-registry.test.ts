import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { ManagedStageRegistry } from "./managed-stage-registry.js"
import { WorkspaceStagingService } from "./workspace-staging.js"

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

  it("cleans an orphaned review stage after restart and removes its local registry record", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    await registry.markReview(managedRunId)

    await expect(registry.recover(managedRunId)).resolves.toEqual({ status: "cleaned" })
    await expect(access(stage.root)).rejects.toMatchObject({ code: "ENOENT" })
    await expect(registry.recover(managedRunId)).resolves.toEqual({ status: "absent" })
  })

  it("quarantines a retained apply journal while cleaning the orphaned stage", async () => {
    const stage = await staging.create(source)
    await registry.register(managedRunId, stage)
    await writeFile(join(stage.root, "source.txt"), "after")
    await registry.markApplying(managedRunId)
    const applied = await staging.apply(stage, {
      authorizationId: "test-authorization",
      approvedPaths: ["source.txt"],
    })
    await registry.retainJournal(managedRunId, applied.journalPath, applied.journalDigest)

    const recovered = await registry.recover(managedRunId)
    expect(recovered.status).toBe("quarantined")
    expect(recovered.quarantinePath).toBeDefined()
    await expect(access(stage.root)).rejects.toMatchObject({ code: "ENOENT" })
    await expect(access(applied.journalPath)).rejects.toMatchObject({ code: "ENOENT" })
    await expect(access(recovered.quarantinePath!)).resolves.toBeUndefined()
    await expect(registry.recover(managedRunId)).resolves.toEqual(recovered)
  })

  it("rejects path-shaped identifiers before touching local state", async () => {
    const stage = await staging.create(source)
    await expect(registry.register("../../escape", stage)).rejects.toThrow(/UUID/)
    await staging.cleanup(stage)
  })
})
