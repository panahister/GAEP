import { randomUUID } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { hostname, tmpdir } from "node:os"
import { join } from "node:path"

import { productSchema, repositoryManifestSchema } from "@gaep/contracts"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GaepRepository, type RepositoryFaultPoint } from "./repository.js"

const transactionFaultPoints: RepositoryFaultPoint[] = [
  "after-journal",
  "after-record-writes",
  "after-audit-append",
  "after-state-write",
  "after-checkpoint-write",
]

describe("GAEP repository safety", () => {
  let workspace: string
  let repository: GaepRepository

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-repository-"))
    repository = new GaepRepository(workspace, { lockLeaseMs: 100 })
  })

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  it("reports a new workspace as uninitialized without inventing audit evidence", async () => {
    const health = await repository.workspaceHealth()
    expect(health.status).toBe("uninitialized")
    expect(health.initialized).toBe(false)
    expect(health.audit).toEqual({ valid: true, events: 0 })
  })

  it("recovers a stale lock lease and preserves a live lock", async () => {
    await mkdir(repository.resolve("runtime"), { recursive: true })
    const staleAt = new Date(Date.now() - 60_000).toISOString()
    await writeFile(repository.resolve("runtime", "engine.lock"), JSON.stringify({
      token: randomUUID(),
      pid: 2_147_483_647,
      hostname: hostname(),
      acquiredAt: staleAt,
      heartbeatAt: staleAt,
    }))

    let executed = false
    await repository.withLock(async () => {
      executed = true
      await expect(repository.withLock(async () => undefined)).rejects.toThrow(/Another GAEP operation/)
    })
    expect(executed).toBe(true)
    await expect(readFile(repository.resolve("runtime", "engine.lock"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    })
  })

  it("renews the owned lock heartbeat while an operation remains active", async () => {
    const shortLeaseRepository = new GaepRepository(workspace, { lockLeaseMs: 60 })
    await shortLeaseRepository.withLock(async () => {
      const lockPath = shortLeaseRepository.resolve("runtime", "engine.lock")
      const before = JSON.parse(await readFile(lockPath, "utf8")) as { token: string; heartbeatAt: string }
      await new Promise((resolve) => setTimeout(resolve, 90))
      const after = JSON.parse(await readFile(lockPath, "utf8")) as { token: string; heartbeatAt: string }
      expect(after.token).toBe(before.token)
      expect(Date.parse(after.heartbeatAt)).toBeGreaterThan(Date.parse(before.heartbeatAt))
      await expect(
        new GaepRepository(workspace, { lockLeaseMs: 60 }).withLock(async () => undefined),
      ).rejects.toThrow(/Another GAEP operation/)
    })
  })

  it.each(transactionFaultPoints)(
    "finishes an interrupted %s transaction during the next health check",
    async (faultPoint) => {
      let injected = false
      const failing = new GaepRepository(workspace, {
        faultInjector: (point) => {
          if (!injected && point === faultPoint) {
            injected = true
            throw new Error(`Injected fault at ${point}`)
          }
        },
      })
      await failing.prepareLayout()
      const product = productSchema.parse({
        schemaVersion: 1,
        id: randomUUID(),
        kind: "product",
        revision: 1,
        name: "Fault Recovery Product",
        summary: "A Product used to verify deterministic transaction recovery.",
        problem: "A process can fail after only part of a governed mutation is durable.",
        affectedUsers: "GAEP workspace owners",
        desiredOutcome: "Interrupted mutations recover to one complete committed state.",
        successSignals: ["Record, audit, state index, and checkpoint agree"],
        firstWorkflow: "Inject a failure and open workspace health.",
        exclusions: [],
        profile: "software",
        lifecycleState: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      const manifest = failing.createManifest(product.id)

      await expect(failing.withLock(() => failing.commitMutation({
        initialization: true,
        writes: [
          {
            path: failing.resolve("manifest.json"),
            value: manifest,
            schema: repositoryManifestSchema,
            governed: true,
          },
          {
            path: failing.resolve("product.json"),
            value: product,
            schema: productSchema,
            governed: true,
          },
        ],
        audit: {
          eventType: "product.created",
          actor: { kind: "human", id: "fault-test" },
          subjectId: product.id,
        },
      }))).rejects.toThrow(`Injected fault at ${faultPoint}`)

      expect(await readFile(failing.resolve("runtime", "transaction.json"), "utf8")).toContain(product.id)
      const recovering = new GaepRepository(workspace)
      const health = await recovering.workspaceHealth()
      expect(health.status).toBe("healthy")
      expect(health.audit).toMatchObject({ valid: true, events: 1 })
      expect((await recovering.readJson(recovering.resolve("product.json"), productSchema)).id).toBe(product.id)
      await expect(
        readFile(recovering.resolve("runtime", "transaction.json"), "utf8"),
      ).rejects.toMatchObject({ code: "ENOENT" })
    },
  )

  it("rejects a Product record without a manifest instead of adopting or overwriting it", async () => {
    await mkdir(repository.root, { recursive: true })
    await writeFile(repository.resolve("product.json"), "{}\n")
    await expect(repository.assertCanCreateProduct()).rejects.toThrow(/already initialized/i)
    const health = await repository.workspaceHealth()
    expect(health.status).toBe("invalid")
    expect(health.issues.some((issue) => issue.code === "workspace.manifest-missing")).toBe(true)
  })

  it("refuses repository mutations that do not own the workspace lock", async () => {
    await expect(repository.commitMutation({
      writes: [],
      audit: {
        eventType: "unsafe.mutation",
        actor: { kind: "system", id: "test" },
      },
    })).rejects.toThrow(/require.*workspace lock/i)
  })

  it("rejects symbolic-link repository roots", async () => {
    if (process.platform === "win32") return
    const outside = join(workspace, "outside")
    await mkdir(outside)
    await symlink(outside, repository.root)
    await expect(repository.prepareLayout()).rejects.toThrow(/symbolic-link repository paths/i)
  })

  it("rejects symbolic-link repository directories before listing their contents", async () => {
    if (process.platform === "win32") return
    const outside = join(workspace, "outside-sessions")
    await mkdir(outside)
    await mkdir(repository.root)
    await symlink(outside, repository.resolve("sessions"))

    await expect(repository.readDirectory(repository.resolve("sessions"))).rejects.toThrow(
      /symbolic-link repository paths/i,
    )
  })
})
