import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { afterEach, describe, expect, it } from "vitest"

import {
  ManagedCodexPreJournalApplyError,
  rehydrateManagedCodexStageReview,
  startManagedCodexStagedRun,
  type ManagedCodexStagedRunHandle,
} from "./managed-codex-run.js"
import type { ManagedRuntimeEvent } from "./managed-runtime.js"
import { ManagedStageRegistry } from "./managed-stage-registry.js"
import { WorkspaceStagingService } from "./workspace-staging.js"

const fakeServer = fileURLToPath(new URL("../test/fixtures/fake-codex-app-server.mjs", import.meta.url))

async function collect(handle: ManagedCodexStagedRunHandle): Promise<{
  events: ManagedRuntimeEvent[]
  review: Awaited<ManagedCodexStagedRunHandle["completion"]>
}> {
  const events: ManagedRuntimeEvent[] = []
  const draining = (async () => {
    for await (const event of handle.events) events.push(event)
  })()
  const review = await handle.completion
  await draining
  return { events, review }
}

describe("managed Codex staged-run coordinator", () => {
  const roots: string[] = []

  async function sourceWorkspace(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "gaep-managed-codex-source-"))
    roots.push(root)
    await writeFile(join(root, "source.txt"), "baseline")
    return realpath(root)
  }

  async function start(
    sourceWorkspacePath: string,
    prompt: string,
    options: {
      timeoutMs?: number
      allowCommands?: boolean
      allowFileChanges?: boolean
      stagingService?: WorkspaceStagingService
      stageRegistry?: ManagedStageRegistry
      managedRunId?: string
    } = {},
  ): Promise<ManagedCodexStagedRunHandle> {
    return startManagedCodexStagedRun({
      executable: process.execPath,
      sourceWorkspacePath,
      model: "fake-model",
      prompt,
      timeoutMs: options.timeoutMs,
      policy: {
        allowCommands: options.allowCommands ?? false,
        allowFileChanges: options.allowFileChanges ?? false,
      },
      stagingService: options.stagingService,
      stageRegistry: options.stageRegistry,
      managedRunId: options.managedRunId,
      ...(options.managedRunId
        ? {
            bindingsDigest: `sha256:${"1".repeat(64)}` as const,
            capabilityDigest: `sha256:${"2".repeat(64)}` as const,
            managedProvider: { adapterId: "gaep.codex-cli", agentId: "codex-cli" },
          }
        : {}),
      appServerOptions: {
        args: [fakeServer],
        requestTimeoutMs: 1_000,
        terminationGraceMs: 50,
      },
    })
  }

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it("finishes provider work as review-required without mutating the source workspace", async () => {
    const source = await sourceWorkspace()
    const { events, review } = await collect(await start(source, "stream"))

    expect(review.state).toBe("review-required")
    expect(review.inspection.changes).toEqual([])
    expect(review.result.portable.terminalDisposition).toBe("completed")
    expect(review.result.portable.postconditionStatus).toBe("not-assessed")
    expect(events.some((event) => event.type === "lifecycle" && event.phase === "turn-completed")).toBe(true)
    expect(await readFile(join(source, "source.txt"), "utf8")).toBe("baseline")
    await review.discard()
    expect(review.state).toBe("discarded")
  })

  it("applies exactly the approved staged inventory and keeps portable evidence path-free", async () => {
    const source = await sourceWorkspace()
    const service = new WorkspaceStagingService()
    const { review } = await collect(await start(source, "write-stage", {
      stagingService: service,
      allowFileChanges: true,
    }))

    expect(review.inspection.changes).toEqual([
      expect.objectContaining({ path: "source.txt", kind: "modified" }),
    ])
    const result = await review.apply({
      authorizationId: "test-authority",
      approvedPaths: ["source.txt"],
      evaluatePostconditions: async ({ sourceWorkspacePath, applyResult }) => {
        expect(sourceWorkspacePath).toBe(source)
        expect(applyResult?.status).toBe("applied")
        return (await readFile(join(sourceWorkspacePath, "source.txt"), "utf8")) === "managed update"
          ? "satisfied"
          : "failed"
      },
    })

    expect(review.state).toBe("applied")
    expect(await readFile(join(source, "source.txt"), "utf8")).toBe("managed update")
    expect(result.portable.staging).toMatchObject({ applied: true })
    expect(result.portable.postconditionStatus).toBe("satisfied")
    expect(JSON.stringify(result.portable)).not.toContain(source)
    expect(result.local).toMatchObject({
      sourceWorkspacePath: source,
      applyJournalPath: expect.any(String),
    })
    await service.disposeJournal(result.local.applyJournalPath!, result.portable.staging!.applyJournalDigest!)
  })

  it("rejects an approval inventory that differs from the inspected change set", async () => {
    const source = await sourceWorkspace()
    const { review } = await collect(await start(source, "write-stage", { allowFileChanges: true }))

    await expect(review.apply({ authorizationId: "test-authority", approvedPaths: [] }))
      .rejects.toThrow("exactly match")
    expect(review.state).toBe("review-required")
    expect(await readFile(join(source, "source.txt"), "utf8")).toBe("baseline")
    await review.discard()
  })

  it("keeps zero-mutation preflight failures review-required and restart-claimable for a corrected apply", async () => {
    const source = await sourceWorkspace()
    const managedRunId = "00000000-0000-4000-8000-000000000555"
    const registryParent = await mkdtemp(join(tmpdir(), "gaep-managed-codex-registry-"))
    roots.push(registryParent)
    const registry = new ManagedStageRegistry(registryParent)
    const staging = new WorkspaceStagingService({ tempParent: registryParent })
    const { review } = await collect(await start(source, "write-stage", {
      allowFileChanges: true,
      managedRunId,
      stageRegistry: registry,
      stagingService: staging,
    }))

    await expect(review.apply({ authorizationId: "test-authority", approvedPaths: [] }))
      .rejects.toThrow("exactly match")
    await expect(review.apply({ authorizationId: "   ", approvedPaths: ["source.txt"] }))
      .rejects.toThrow(/required/)
    expect(review.state).toBe("review-required")
    expect(await readFile(join(source, "source.txt"), "utf8")).toBe("baseline")
    const registryRecord = JSON.parse(await readFile(join(registry.root, `${managedRunId}.json`), "utf8"))
    expect(registryRecord).toMatchObject({ state: "review-required" })
    expect(registryRecord).not.toHaveProperty("journalPath")

    const restarted = new ManagedStageRegistry(registryParent, { isProcessAlive: () => false })
    const claim = await restarted.claimReview(managedRunId)
    expect(() => {
      (claim.stageRootIdentity as { inode: string }).inode = "0"
    }).toThrow()
    expect(() => {
      (claim.manifest.stage.stage as { root: string }).root = source
    }).toThrow()
    await expect(rehydrateManagedCodexStageReview({
      claim: structuredClone(claim),
      initialResult: review.result,
      stageRegistry: restarted,
      stagingService: new WorkspaceStagingService({ tempParent: registryParent }),
    })).rejects.toThrow(/not minted by the registry/)
    const rehydrated = await rehydrateManagedCodexStageReview({
      claim,
      initialResult: review.result,
      stageRegistry: restarted,
      stagingService: new WorkspaceStagingService({ tempParent: registryParent }),
    })
    const applied = await rehydrated.review.apply({
      authorizationId: "corrected-authority",
      approvedPaths: ["source.txt"],
    })
    expect(applied.portable.staging).toMatchObject({ applied: true })
    expect(await readFile(join(source, "source.txt"), "utf8")).toBe("managed update")
    await restarted.disposeRetainedJournal(managedRunId, applied.portable.staging!.applyJournalDigest!)
  })

  it("restores a durable review when initial WAL persistence fails after mark-applying", async () => {
    const source = await sourceWorkspace()
    const managedRunId = "00000000-0000-4000-8000-000000000556"
    const registryParent = await mkdtemp(join(tmpdir(), "gaep-managed-codex-registry-"))
    roots.push(registryParent)
    let failInitialJournal = true
    const staging = new WorkspaceStagingService({
      tempParent: registryParent,
      beforeJournalWrite: (state) => {
        if (failInitialJournal && state === "prepared") {
          failInitialJournal = false
          throw new Error("injected initial WAL failure")
        }
      },
    })
    const registry = new ManagedStageRegistry(registryParent)
    const { review } = await collect(await start(source, "write-stage", {
      allowFileChanges: true,
      managedRunId,
      stageRegistry: registry,
      stagingService: staging,
    }))

    await expect(review.apply({ authorizationId: "first-authority", approvedPaths: ["source.txt"] }))
      .rejects.toBeInstanceOf(ManagedCodexPreJournalApplyError)
    expect(review.state).toBe("review-required")
    expect(await readFile(join(source, "source.txt"), "utf8")).toBe("baseline")
    const registryRecord = JSON.parse(await readFile(join(registry.root, `${managedRunId}.json`), "utf8"))
    expect(registryRecord).toMatchObject({ state: "review-required" })
    expect(registryRecord).not.toHaveProperty("journalPath")

    const restarted = new ManagedStageRegistry(registryParent, { isProcessAlive: () => false })
    const claim = await restarted.claimReview(managedRunId)
    const rehydrated = await rehydrateManagedCodexStageReview({
      claim,
      initialResult: review.result,
      stageRegistry: restarted,
      stagingService: new WorkspaceStagingService({ tempParent: registryParent }),
    })
    const applied = await rehydrated.review.apply({
      authorizationId: "corrected-authority",
      approvedPaths: ["source.txt"],
    })
    expect(applied.portable.staging).toMatchObject({ applied: true })
    expect(await readFile(join(source, "source.txt"), "utf8")).toBe("managed update")
    await restarted.disposeRetainedJournal(managedRunId, applied.portable.staging!.applyJournalDigest!)
  })

  it("validates postcondition deadlines before mutation and bounds a non-returning evaluator with abort", async () => {
    const source = await sourceWorkspace()
    const service = new WorkspaceStagingService()
    const { review } = await collect(await start(source, "write-stage", {
      stagingService: service,
      allowFileChanges: true,
    }))

    await expect(review.apply({
      authorizationId: "test-authority",
      approvedPaths: ["source.txt"],
      evaluatePostconditions: async () => "satisfied",
      postconditionTimeoutMs: 0,
    })).rejects.toThrow(/between 1 ms and 24 hours/)
    expect(review.state).toBe("review-required")
    expect(await readFile(join(source, "source.txt"), "utf8")).toBe("baseline")

    let aborted = false
    const result = await review.apply({
      authorizationId: "test-authority",
      approvedPaths: ["source.txt"],
      postconditionTimeoutMs: 5,
      evaluatePostconditions: ({ signal }) => new Promise((resolve) => {
        signal.addEventListener("abort", () => {
          aborted = true
          resolve("satisfied")
        }, { once: true })
      }),
    })
    expect(aborted).toBe(true)
    expect(result.portable.postconditionStatus).toBe("indeterminate")
    expect(result.portable.warnings).toContain(
      "The postcondition evaluator timed out after apply; it was aborted and outcome verification is indeterminate.",
    )
    expect(await readFile(join(source, "source.txt"), "utf8")).toBe("managed update")
    await service.disposeJournal(result.local.applyJournalPath!, result.portable.staging!.applyJournalDigest!)
  })

  it("fails closed on source-workspace races without overwriting concurrent changes", async () => {
    const source = await sourceWorkspace()
    const service = new WorkspaceStagingService()
    const { review } = await collect(await start(source, "write-stage", {
      stagingService: service,
      allowFileChanges: true,
    }))
    await writeFile(join(source, "source.txt"), "concurrent change")

    const result = await review.apply({ authorizationId: "test-authority", approvedPaths: ["source.txt"] })

    expect(review.state).toBe("conflict")
    expect(result.portable.staging).toMatchObject({ applied: false })
    expect(result.portable.postconditionStatus).toBe("indeterminate")
    expect(await readFile(join(source, "source.txt"), "utf8")).toBe("concurrent change")
    await service.disposeJournal(result.local.applyJournalPath!, result.portable.staging!.applyJournalDigest!)
    await review.discard()
  })

  it("cancels a live turn and forbids applying its staged workspace", async () => {
    const source = await sourceWorkspace()
    const handle = await start(source, "wait")
    const events: ManagedRuntimeEvent[] = []
    const draining = (async () => {
      for await (const event of handle.events) {
        events.push(event)
        if (event.type === "lifecycle" && event.phase === "turn-started") await handle.cancel("test cancellation")
      }
    })()
    const review = await handle.completion
    await draining

    expect(review.result.portable.terminalDisposition).toBe("cancelled")
    await expect(review.apply({ authorizationId: "test-authority", approvedPaths: [] }))
      .rejects.toThrow("cannot be applied")
    await review.discard()
  })

  it("marks timed-out work interrupted and keeps the source unchanged", async () => {
    const source = await sourceWorkspace()
    const { review } = await collect(await start(source, "wait", { timeoutMs: 25 }))

    expect(review.result.portable.terminalDisposition).toBe("interrupted")
    expect(await readFile(join(source, "source.txt"), "utf8")).toBe("baseline")
    await review.discard()
  })

  it("preserves a provider-declared failed terminal status", async () => {
    const source = await sourceWorkspace()
    const { review } = await collect(await start(source, "failed"))

    expect(review.result.portable.terminalDisposition).toBe("failed")
    await expect(review.apply({ authorizationId: "test-authority", approvedPaths: [] }))
      .rejects.toThrow("cannot be applied")
    await review.discard()
  })

  it("cancels safely even while the app-server is still starting", async () => {
    const source = await sourceWorkspace()
    const handle = await start(source, "wait")
    await handle.cancel("immediate cancellation")
    const { review } = await collect(handle)

    expect(review.result.portable.terminalDisposition).toBe("cancelled")
    await review.discard()
  })

  it.each([
    [false, "denied"],
    [true, "allowed-once"],
  ] as const)("mediates command approval with allowCommands=%s", async (allowCommands, expectedOutcome) => {
    const source = await sourceWorkspace()
    const { events, review } = await collect(await start(source, "approval", { allowCommands }))

    expect(events).toContainEqual(expect.objectContaining({
      type: "approval",
      approvalKind: "command",
      outcome: expectedOutcome,
    }))
    expect(review.result.portable.terminalDisposition).toBe("completed")
    await review.discard()
  })

  it("prevents staged writes when file changes are disabled", async () => {
    const source = await sourceWorkspace()
    const { review } = await collect(await start(source, "write-stage", { allowFileChanges: false }))

    expect(review.result.portable.terminalDisposition).toBe("failed")
    expect(review.inspection.changes).toEqual([])
    expect(await readFile(join(source, "source.txt"), "utf8")).toBe("baseline")
    await review.discard()
  })
})
