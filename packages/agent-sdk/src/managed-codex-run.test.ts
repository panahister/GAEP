import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { afterEach, describe, expect, it } from "vitest"

import { startManagedCodexStagedRun, type ManagedCodexStagedRunHandle } from "./managed-codex-run.js"
import type { ManagedRuntimeEvent } from "./managed-runtime.js"
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
    const { review } = await collect(await start(source, "write-stage", { stagingService: service }))

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
    const { review } = await collect(await start(source, "write-stage"))

    await expect(review.apply({ authorizationId: "test-authority", approvedPaths: [] }))
      .rejects.toThrow("exactly match")
    expect(review.state).toBe("review-required")
    expect(await readFile(join(source, "source.txt"), "utf8")).toBe("baseline")
    await review.discard()
  })

  it("fails closed on source-workspace races without overwriting concurrent changes", async () => {
    const source = await sourceWorkspace()
    const service = new WorkspaceStagingService()
    const { review } = await collect(await start(source, "write-stage", { stagingService: service }))
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
})
