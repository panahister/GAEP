import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { afterEach, describe, expect, it } from "vitest"

import { CodexAppServerSupervisor, codexAppServerLaunchArgs } from "./codex-app-server.js"
import type { ManagedRuntimeEvent } from "./managed-runtime.js"
import { WorkspaceStagingService, type WorkspaceStage } from "./workspace-staging.js"

const fakeServer = fileURLToPath(new URL("../test/fixtures/fake-codex-app-server.mjs", import.meta.url))

async function nextMatching(
  iterator: AsyncIterator<ManagedRuntimeEvent>,
  predicate: (event: ManagedRuntimeEvent) => boolean,
): Promise<ManagedRuntimeEvent> {
  for (;;) {
    const next = await iterator.next()
    if (next.done) throw new Error("Managed event stream ended before the expected event")
    if (predicate(next.value)) return next.value
  }
}

async function eventualStreamFailure(iterator: AsyncIterator<ManagedRuntimeEvent>): Promise<Error> {
  for (let index = 0; index < 128; index += 1) {
    try {
      const next = await iterator.next()
      if (next.done) return new Error("Managed event stream closed without its expected failure")
    } catch (error) {
      return error instanceof Error ? error : new Error(String(error))
    }
  }
  return new Error("Managed event stream did not fail within the bounded observation window")
}

async function expectProcessGone(pid: number): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      process.kill(pid, 0)
    } catch {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`Process ${pid} survived managed process-group termination`)
}

describe("Codex app-server managed transport", () => {
  const roots: string[] = []

  async function setup(approvalMediator?: ConstructorParameters<typeof CodexAppServerSupervisor>[0]["approvalMediator"], limits: Partial<ConstructorParameters<typeof CodexAppServerSupervisor>[0]> = {}): Promise<{
    supervisor: CodexAppServerSupervisor
    service: WorkspaceStagingService
    stage: WorkspaceStage
  }> {
    const source = await mkdtemp(join(tmpdir(), "gaep-app-server-source-"))
    roots.push(source)
    await writeFile(join(source, "source.txt"), "baseline")
    const service = new WorkspaceStagingService()
    const stage = await service.create(source)
    const supervisor = new CodexAppServerSupervisor({
      executable: process.execPath,
      args: [fakeServer],
      stagingService: service,
      approvalMediator,
      requestTimeoutMs: 1_000,
      terminationGraceMs: 50,
      ...limits,
    })
    await supervisor.start()
    return { supervisor, service, stage }
  }

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true })))
  })

  it("pins a strict app-server launch with ambient integrations and project instructions disabled", () => {
    expect(codexAppServerLaunchArgs(false)).toEqual([
      "--strict-config",
      "-c", "mcp_servers={}",
      "-c", 'web_search="disabled"',
      "-c", 'shell_environment_policy.inherit="none"',
      "-c", "project_doc_max_bytes=0",
      "-c", "project_doc_fallback_filenames=[]",
      "-c", "features.apps=false",
      "-c", "features.goals=false",
      "-c", "features.hooks=false",
      "-c", "features.memories=false",
      "-c", "features.multi_agent=false",
      "-c", "features.remote_plugin=false",
      "-c", "features.shell_snapshot=false",
      "-c", "features.shell_tool=false",
      "app-server", "--listen", "stdio://",
    ])
  })

  it("sends exact fail-closed thread and turn policies when commands and file changes are disabled", async () => {
    const { supervisor, service, stage } = await setup(undefined, {
      allowShellTool: false,
      allowFileChanges: false,
    })
    const iterator = supervisor.events[Symbol.asyncIterator]()
    const { threadId } = await supervisor.startStagedThread({ stage, model: "fake-model" })
    await supervisor.startStagedTurn({ stage, threadId, prompt: "inspect-policy" })
    const output = await nextMatching(iterator, (event) => event.type === "output-delta" && event.text.startsWith("policy="))
    if (output.type !== "output-delta") throw new Error("Expected a policy inspection event")
    const policy = JSON.parse(output.text.slice("policy=".length)) as Record<string, any>

    expect(policy).toMatchObject({
      threadSandbox: "read-only",
      config: {
        mcp_servers: {},
        web_search: "disabled",
        shell_environment_policy: { inherit: "none" },
        project_doc_max_bytes: 0,
        project_doc_fallback_filenames: [],
        features: {
          apps: false,
          goals: false,
          hooks: false,
          memories: false,
          multi_agent: false,
          remote_plugin: false,
          shell_snapshot: false,
          shell_tool: false,
        },
      },
      turnSandboxPolicy: { type: "readOnly", networkAccess: false },
    })
    await supervisor.stop()
    await service.cleanup(stage)
  })

  it("denies command escalation even when a mediator allows it if the shell tool is disabled", async () => {
    const { supervisor, service, stage } = await setup(async () => ({
      outcome: "allow-once",
      authorizationId: "must-not-be-used",
      reason: "test mediator approval that policy must override",
    }), { allowShellTool: false })
    const iterator = supervisor.events[Symbol.asyncIterator]()
    const { threadId } = await supervisor.startStagedThread({ stage, model: "fake-model" })
    await supervisor.startStagedTurn({ stage, threadId, prompt: "approval" })
    const approval = await nextMatching(iterator, (event) => event.type === "approval")
    const response = await nextMatching(iterator, (event) => event.type === "output-delta" && event.text.startsWith("approval="))

    expect(approval).toMatchObject({ approvalKind: "command", outcome: "denied" })
    expect(response).toMatchObject({ text: "approval=decline" })
    await supervisor.stop()
    await service.cleanup(stage)
  })

  it("handshakes, starts only in managed staging, and normalizes streamed events", async () => {
    const { supervisor, service, stage } = await setup()
    const iterator = supervisor.events[Symbol.asyncIterator]()
    await nextMatching(iterator, (event) => event.type === "lifecycle" && event.phase === "initialized")
    const { threadId } = await supervisor.startStagedThread({ stage, model: "fake-model" })
    const { turnId } = await supervisor.startStagedTurn({ stage, threadId, prompt: "stream" })
    const completed = await nextMatching(iterator, (event) =>
      event.type === "lifecycle" && event.phase === "turn-completed" && event.turnId === turnId,
    )
    expect(completed).toMatchObject({ threadId, turnId })
    const result = await supervisor.buildResult({
      stage,
      providerThreadId: threadId,
      providerTurnId: turnId,
      terminalDisposition: "completed",
      postconditionStatus: "satisfied",
    })

    expect(result.portable.provider).toEqual({ adapterId: "gaep.codex-app-server", agentId: "codex-app-server" })
    expect(result.portable.staging?.changes).toEqual([])
    expect(JSON.stringify(result.portable)).not.toContain(stage.root)
    expect(result.local).toMatchObject({
      executablePath: process.execPath,
      stagingWorkspacePath: stage.root,
      executableFingerprint: { digest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/) },
    })
    await supervisor.stop()
    await service.cleanup(stage)
  })

  it.each([
    ["deny", "decline", "denied"],
    ["allow-once", "accept", "allowed-once"],
  ] as const)("maps mediated %s command approval without session-wide grants", async (outcome, providerDecision, normalized) => {
    const { supervisor, service, stage } = await setup(async () => outcome === "deny"
      ? { outcome: "deny", reason: "test denial" }
      : { outcome: "allow-once", authorizationId: "auth-once", reason: "test approval" })
    const iterator = supervisor.events[Symbol.asyncIterator]()
    const { threadId } = await supervisor.startStagedThread({ stage, model: "fake-model" })
    await supervisor.startStagedTurn({ stage, threadId, prompt: "approval" })
    const approval = await nextMatching(iterator, (event) => event.type === "approval")
    const response = await nextMatching(iterator, (event) => event.type === "output-delta" && event.text.startsWith("approval="))

    expect(approval).toMatchObject({ approvalKind: "command", outcome: normalized })
    expect(response).toMatchObject({ text: `approval=${providerDecision}` })
    await supervisor.stop()
    await service.cleanup(stage)
  })

  it("interrupts a running turn and supports restart plus explicit thread resume", async () => {
    const { supervisor, service, stage } = await setup()
    const iterator = supervisor.events[Symbol.asyncIterator]()
    const { threadId } = await supervisor.startStagedThread({ stage, model: "fake-model" })
    const { turnId } = await supervisor.startStagedTurn({ stage, threadId, prompt: "wait" })
    await supervisor.cancelTurn(threadId, turnId)
    await nextMatching(iterator, (event) => event.type === "lifecycle" && event.phase === "turn-completed")
    await supervisor.restart()
    const resumed = await supervisor.resumeStagedThread({ stage, threadId, model: "fake-model" })

    expect(resumed.threadId).toBe(threadId)
    await nextMatching(iterator, (event) => event.type === "lifecycle" && event.phase === "thread-resumed")
    await supervisor.stop()
    await service.cleanup(stage)
  })

  it("redacts local paths, secret-shaped values, and control bytes before portable recording", async () => {
    const previousCodexHome = process.env.CODEX_HOME
    process.env.CODEX_HOME = "/custom-provider-home-private"
    try {
      const { supervisor, service, stage } = await setup()
      const iterator = supervisor.events[Symbol.asyncIterator]()
      const { threadId } = await supervisor.startStagedThread({ stage, model: "fake-model" })
      const { turnId } = await supervisor.startStagedTurn({ stage, threadId, prompt: "sensitive" })
      await nextMatching(iterator, (event) => event.type === "lifecycle" && event.phase === "turn-completed")
      const result = await supervisor.buildResult({ stage, providerThreadId: threadId, providerTurnId: turnId, terminalDisposition: "completed" })
      const portable = JSON.stringify(result.portable)

      expect(portable).not.toContain(stage.root)
      expect(portable).not.toContain("/custom-provider-home-private")
      expect(portable).not.toContain("top-secret")
      expect(portable).not.toContain("\\u0000")
      expect(portable).toContain("[LOCAL_PATH]")
      expect(portable).toContain("[REDACTED]")
      await supervisor.stop()
      await service.cleanup(stage)
    } finally {
      if (previousCodexHome === undefined) delete process.env.CODEX_HOME
      else process.env.CODEX_HOME = previousCodexHome
    }
  })

  it.runIf(process.platform !== "win32")("SIGKILLs surviving descendants after the app-server leader exits", async () => {
    const { supervisor, service, stage } = await setup(undefined, { terminationGraceMs: 75 })
    const iterator = supervisor.events[Symbol.asyncIterator]()
    const { threadId } = await supervisor.startStagedThread({ stage, model: "fake-model" })
    await supervisor.startStagedTurn({ stage, threadId, prompt: "descendant" })
    const event = await nextMatching(iterator, (candidate) => candidate.type === "output-delta" && candidate.text.startsWith("pid="))
    if (event.type !== "output-delta") throw new Error("Expected descendant PID event")
    const pid = Number(event.text.slice("pid=".length))
    await supervisor.stop()
    await expectProcessGone(pid)
    await service.cleanup(stage)
  })

  it.runIf(process.platform !== "win32")("kills the process group when the app-server leader exits first", async () => {
    const { supervisor, service, stage } = await setup(undefined, { terminationGraceMs: 75 })
    const iterator = supervisor.events[Symbol.asyncIterator]()
    const { threadId } = await supervisor.startStagedThread({ stage, model: "fake-model" })
    await supervisor.startStagedTurn({ stage, threadId, prompt: "descendant-leader-exit" })
    const event = await nextMatching(iterator, (candidate) => candidate.type === "output-delta" && candidate.text.startsWith("pid="))
    if (event.type !== "output-delta") throw new Error("Expected descendant PID event")
    const pid = Number(event.text.slice("pid=".length))
    await nextMatching(iterator, (candidate) => candidate.type === "error")
    await expectProcessGone(pid)
    await supervisor.stop()
    await service.cleanup(stage)
  })

  it("fails closed on oversized frames", async () => {
    const { supervisor, service, stage } = await setup(undefined, { maxFrameBytes: 1_024, maxBufferedBytes: 2_048 })
    const iterator = supervisor.events[Symbol.asyncIterator]()
    const { threadId } = await supervisor.startStagedThread({ stage, model: "fake-model" })
    await supervisor.startStagedTurn({ stage, threadId, prompt: "oversized" })

    expect((await eventualStreamFailure(iterator)).message).toMatch(/frame|buffer.*configured bound/)
    await supervisor.stop()
    await service.cleanup(stage)
  })

  it("fails closed when an unconsumed event stream exceeds backpressure bounds", async () => {
    const { supervisor, service, stage } = await setup(undefined, {
      maxQueuedEvents: 8,
      maxQueuedEventBytes: 4_096,
    })
    const iterator = supervisor.events[Symbol.asyncIterator]()
    const { threadId } = await supervisor.startStagedThread({ stage, model: "fake-model" })
    await nextMatching(iterator, (event) => event.type === "lifecycle" && event.phase === "thread-started")
    await supervisor.startStagedTurn({ stage, threadId, prompt: "flood" })

    expect((await eventualStreamFailure(iterator)).message).toContain("event buffer exceeded")
    await supervisor.stop()
    await service.cleanup(stage)
  })
})
