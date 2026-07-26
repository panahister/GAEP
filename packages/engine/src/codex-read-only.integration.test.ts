import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { WorkspaceStagingService, codexAppServerLaunchArgs, type AdapterProbeResult, type AgentAdapter, type AgentInvocation, type WorkspaceStage } from "@gaep/agent-sdk"
import { adapterCapabilitiesSnapshotSchema, type AdapterCapabilities, type ProviderCatalogEntry, type SourceIdentity } from "@gaep/contracts"

import { GaepEngine, buildCodexReadOnlySupervisorOptions, type CodexReadOnlyRuntime, type CodexReadOnlyRuntimeFactory, type CodexStagingLike, type CodexSupervisorLike } from "./engine.js"

/**
 * GAEP-P0-CS02 Item 1 — integration test of the REAL Codex read-only dispatch. It exercises the
 * production path GaepEngine.readOnlyAnalysis.start → runReadOnlyProvider → providerRunnerKind →
 * runCodexReadOnlyProvider → createCodexTurnDriver → runCodexReadOnlyTurn, faking ONLY the Codex
 * supervisor boundary (no installed Codex binary required). It proves dispatch reaches the Codex
 * driver, the bounded governed context reaches the turn, read-only enforcement is configured, and
 * cancellation terminates the driver and removes the staged workspace.
 */

const digest = `sha256:${"c".repeat(64)}`
const sourceIdentity: SourceIdentity = { sourceTreeDigest: digest, baseCommit: "d".repeat(40), dirty: false }

function codexCapabilities(): AdapterCapabilities {
  return adapterCapabilitiesSnapshotSchema.parse({
    schemaVersion: 1,
    adapterId: "gaep.codex-cli",
    adapterVersion: "0.1.0",
    agentId: "codex-cli",
    agentLabel: "Codex CLI",
    runtimeVersion: "0.9.0",
    detected: true,
    executionInterface: "cli-jsonl",
    interfaceMaturity: "stable",
    supportsResume: true,
    supportsCancel: true,
    supportsCheckpoints: false,
    supportsModelDiscovery: true,
    supportsToolSelection: false,
    settings: [],
    models: [{ id: "gpt-5-codex", label: "Codex", reasoningOptions: [], inputModalities: ["text"], truthClass: "provider-declared", alias: false }],
    limitations: [],
    observedAt: new Date().toISOString(),
  })
}

function catalogEntry(): ProviderCatalogEntry {
  return {
    adapterId: "gaep.codex-cli",
    agentId: "codex-cli",
    agentLabel: "Codex CLI",
    detected: true,
    runtimeVersion: "0.9.0",
    authReadiness: "auth-unverified",
    authTruthClass: "provider-declared",
    capabilityDigest: digest,
    models: [{ id: "gpt-5-codex", label: "Codex", truthClass: "provider-declared", alias: false }],
  } as ProviderCatalogEntry
}

class FakeCodexAdapter implements AgentAdapter {
  readonly id = "gaep.codex-cli"
  probeCount = 0
  constructor(private readonly probeDelayMs = 0) {}
  async probe(): Promise<AdapterProbeResult> {
    this.probeCount += 1
    if (this.probeDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.probeDelayMs))
    return {
      capabilities: codexCapabilities(),
      runtimeBinding: {
        scope: "machine-local",
        kind: "executable",
        adapterId: this.id,
        agentId: "codex-cli",
        executablePath: "/opt/codex/bin/codex",
        executableFingerprint: { requested: "codex", canonicalPath: "/opt/codex/bin/codex", digest: digest as `sha256:${string}`, size: 1, modifiedAtMs: 0 },
      },
    }
  }
  validateSelection(): string[] { return [] }
  buildInvocation(): AgentInvocation { throw new Error("not used in read-only analysis") }
}

/** A controllable event stream backing the fake supervisor. */
function eventChannel() {
  const items: unknown[] = []
  let done = false
  let notify: (() => void) | undefined
  return {
    push(event: unknown): void { items.push(event); notify?.() },
    end(): void { done = true; notify?.() },
    iterable: {
      async *[Symbol.asyncIterator]() {
        for (;;) {
          while (items.length) yield items.shift()
          if (done) return
          await new Promise<void>((resolve) => { notify = resolve })
        }
      },
    } as AsyncIterable<unknown>,
  }
}

interface FakeSupervisor extends CodexSupervisorLike {
  readonly calls: { start: number; thread: number; turn: number; cancel: number; stop: number; lastPrompt?: string }
}

function makeFakeSupervisor(mode: "complete" | "await-cancel"): FakeSupervisor {
  const channel = eventChannel()
  const calls = { start: 0, thread: 0, turn: 0, cancel: 0, stop: 0, lastPrompt: undefined as string | undefined }
  return {
    calls,
    events: channel.iterable,
    async start() { calls.start++ },
    async startStagedThread() { calls.thread++; return { threadId: "thread-1" } },
    async startStagedTurn(options) {
      calls.turn++
      calls.lastPrompt = options.prompt
      if (mode === "complete") { channel.push({ type: "turn.completed", text: "codex answer" }); channel.end() }
      return { threadId: options.threadId, turnId: "turn-1" }
    },
    async cancelTurn() { calls.cancel++; channel.push({ type: "turn.completed" }); channel.end() },
    async buildResult() { return { status: "completed", text: "codex answer" } },
    async stop() { calls.stop++ },
  }
}

/** Real staging (a genuine temp copy) wrapped so the test can assert cleanup removed the stage. */
function recordingStaging(created: WorkspaceStage[]): CodexStagingLike {
  const real = new WorkspaceStagingService()
  return {
    async create(sourcePath) { const stage = await real.create(sourcePath); created.push(stage); return stage },
    async cleanup(stage) { await real.cleanup(stage) },
  }
}

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "gaep-codex-int-"))
  mkdirSync(join(root, "src"), { recursive: true })
  writeFileSync(join(root, "src", "app.ts"), "export const a = 1\n")
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

function engineWith(factory: CodexReadOnlyRuntimeFactory): GaepEngine {
  return new GaepEngine(root, [new FakeCodexAdapter()], {}, undefined, factory)
}

const waitTerminal = async (engine: GaepEngine, id: string, ms = 1_500) => {
  const deadline = Date.now() + ms
  while (Date.now() < deadline && engine.readOnlyAnalysis.read(id).state === "running") {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  return engine.readOnlyAnalysis.read(id)
}

function startInput(overrides: Record<string, unknown> = {}) {
  return {
    adapterId: "gaep.codex-cli",
    modelId: "gpt-5-codex",
    objective: "Summarize the governed context",
    contextPackIds: ["11111111-1111-4111-8111-111111111111"],
    contextText: "GOVERNED-CONTEXT-PACK-MARKER",
    timeoutMs: 5_000,
    idempotencyKey: "22222222-2222-4222-8222-222222222222",
    catalogEntry: catalogEntry(),
    sourceIdentity,
    ...overrides,
  } as Parameters<GaepEngine["readOnlyAnalysis"]["start"]>[0]
}

describe("Codex read-only integration (real GaepEngine dispatch, faked supervisor boundary)", () => {
  it("dispatches a detected Codex adapter through the real runner to the Codex driver and completes", async () => {
    const created: WorkspaceStage[] = []
    const supervisor = makeFakeSupervisor("complete")
    const factory: CodexReadOnlyRuntimeFactory = () => ({ supervisor, stagingService: recordingStaging(created) } as CodexReadOnlyRuntime)
    const engine = engineWith(factory)

    const started = await engine.readOnlyAnalysis.start(startInput())
    const record = await waitTerminal(engine, started.analysisRunId)

    expect(record.state).toBe("completed")
    // Production dispatch actually reached the Codex driver/supervisor.
    expect(supervisor.calls.start).toBe(1)
    expect(supervisor.calls.thread).toBe(1)
    expect(supervisor.calls.turn).toBe(1)
    // The bounded governed context reached the turn prompt.
    expect(supervisor.calls.lastPrompt).toContain("GOVERNED-CONTEXT-PACK-MARKER")
    expect(supervisor.calls.lastPrompt).toContain("Summarize the governed context")
    expect(supervisor.calls.lastPrompt).toContain("Do not modify files or run tools")
    // Staging was created and then cleaned up — no staged workspace is left behind.
    expect(created).toHaveLength(1)
    expect(supervisor.calls.stop).toBe(1)
    expect(existsSync(created[0]!.root)).toBe(false)
  })

  it("cancellation terminates the supervisor, cleans staging, and resolves as cancelled", async () => {
    const created: WorkspaceStage[] = []
    const supervisor = makeFakeSupervisor("await-cancel")
    const factory: CodexReadOnlyRuntimeFactory = () => ({ supervisor, stagingService: recordingStaging(created) } as CodexReadOnlyRuntime)
    const engine = engineWith(factory)

    const started = await engine.readOnlyAnalysis.start(startInput())
    // Let the driver reach awaitResult (thread + turn started) before cancelling.
    const deadline = Date.now() + 1_000
    while (Date.now() < deadline && supervisor.calls.turn === 0) await new Promise((r) => setTimeout(r, 5))

    const cancelled = await engine.readOnlyAnalysis.cancel(started.analysisRunId)
    expect(cancelled.state).toBe("cancelled")
    expect(supervisor.calls.cancel).toBe(1)
    expect(supervisor.calls.stop).toBe(1)
    expect(existsSync(created[0]!.root)).toBe(false)
  })

  it("the production Codex read-only configuration disables shell tools, file changes, network, and writable roots", () => {
    const staging = new WorkspaceStagingService()
    const options = buildCodexReadOnlySupervisorOptions({ executable: "/opt/codex/bin/codex", processCwd: root, requestTimeoutMs: 5_000, stagingService: staging })
    // Read-only enforcement toggles: file-change authority off ⇒ read-only sandbox + networkAccess:false,
    // no writable roots (the supervisor derives those from allowFileChanges:false); shell tool off.
    expect(options.allowShellTool).toBe(false)
    expect(options.allowFileChanges).toBe(false)
    expect(options.args).toEqual(codexAppServerLaunchArgs(false))
    expect(codexAppServerLaunchArgs(false)).toContain("features.shell_tool=false")
    expect(options.requestTimeoutMs).toBe(5_000)
  })
})

describe("Codex hard-stop initialization race (real runReadOnlyProvider lifecycle)", () => {
  // A factory that records whether it was invoked; if it ever runs, its supervisor `start()` would
  // write an unauthorized `.gaep` file — so "never invoked" also proves no post-terminal mutation.
  function recordingFactory(): { factory: CodexReadOnlyRuntimeFactory; calls: () => number } {
    let count = 0
    const factory: CodexReadOnlyRuntimeFactory = () => {
      count += 1
      const supervisor = makeFakeSupervisor("await-cancel")
      const original = supervisor.start
      supervisor.start = async () => { mkdirSync(join(root, ".gaep"), { recursive: true }); writeFileSync(join(root, ".gaep", "evil.json"), "{}\n"); await original() }
      return { supervisor, stagingService: recordingStaging([]) } as CodexReadOnlyRuntime
    }
    return { factory, calls: () => count }
  }

  it("(a,d) cancel during a slow probe prevents provider startup and leaves no mutation", async () => {
    const adapter = new FakeCodexAdapter(200)
    const { factory, calls } = recordingFactory()
    const engine = new GaepEngine(root, [adapter], {}, undefined, factory)
    const started = await engine.readOnlyAnalysis.start(startInput())
    await new Promise((r) => setTimeout(r, 20)) // cancel while the probe is still running
    const record = await engine.readOnlyAnalysis.cancel(started.analysisRunId)

    expect(record.state).toBe("cancelled")
    expect(adapter.probeCount).toBeGreaterThan(0) // the probe ran…
    expect(calls()).toBe(0) // …but no provider was ever created after cancellation
    expect(existsSync(join(root, ".gaep", "evil.json"))).toBe(false) // no post-terminal mutation
  })

  it("(b) timeout during initialization publishes no terminal record until completion settles, and starts no provider", async () => {
    const adapter = new FakeCodexAdapter(1_500) // probe outlasts the timeout
    const { factory, calls } = recordingFactory()
    const engine = new GaepEngine(root, [adapter], {}, undefined, factory)
    const started = await engine.readOnlyAnalysis.start(startInput({ timeoutMs: 1_000 }))
    const record = await waitTerminal(engine, started.analysisRunId, 4_000)

    expect(record.state).toBe("timed-out")
    expect(calls()).toBe(0)
  })

  it("(c) cancel does not publish a terminal record while the provider run is still unsettled", async () => {
    const adapter = new FakeCodexAdapter(150)
    const { factory } = recordingFactory()
    const engine = new GaepEngine(root, [adapter], {}, undefined, factory)
    const started = await engine.readOnlyAnalysis.start(startInput())
    await new Promise((r) => setTimeout(r, 20))

    const cancelPromise = engine.readOnlyAnalysis.cancel(started.analysisRunId)
    // Synchronously after requesting cancel, the run is still running: finalization waits for the
    // real completion (the slow probe) to settle before publishing the terminal record.
    expect(engine.readOnlyAnalysis.read(started.analysisRunId).state).toBe("running")
    const record = await cancelPromise
    expect(record.state).toBe("cancelled")
  })
})
