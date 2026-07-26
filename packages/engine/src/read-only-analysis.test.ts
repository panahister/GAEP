import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { ProviderCatalogEntry, SourceIdentity } from "@gaep/contracts"

import {
  AnalysisError,
  MAX_CONTEXT_BYTES,
  ReadOnlyAnalysisService,
  type ProviderRunHandle,
  type ProviderRunOutcome,
  type ProviderRunner,
} from "./read-only-analysis.js"

const digest = `sha256:${"a".repeat(64)}`
const sourceIdentity: SourceIdentity = { sourceTreeDigest: digest, baseCommit: "b".repeat(40), dirty: false }

function entry(overrides: Partial<ProviderCatalogEntry> = {}): ProviderCatalogEntry {
  return {
    adapterId: "gaep.claude-code-cli",
    agentId: "claude-code-cli",
    agentLabel: "Claude Code",
    detected: true,
    runtimeVersion: "2.1.218",
    authReadiness: "auth-unverified",
    authTruthClass: "provider-declared",
    capabilityDigest: digest,
    models: [{ id: "sonnet", label: "Sonnet alias", truthClass: "provider-declared", alias: true }],
    ...overrides,
  } as ProviderCatalogEntry
}

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "gaep-analysis-"))
  mkdirSync(join(root, "src"), { recursive: true })
  writeFileSync(join(root, "src", "app.ts"), "export const a = 1\n")
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

function service(runner: ProviderRunner, onAuth?: (id: string, o: "auth-ready" | "auth-unavailable") => void): ReadOnlyAnalysisService {
  // Short hard-stop grace so cancel/timeout of a provider that ignores the abort finalizes fast.
  return new ReadOnlyAnalysisService(root, runner, onAuth, undefined, 30)
}

function startInput(overrides: Record<string, unknown> = {}) {
  return {
    adapterId: "gaep.claude-code-cli",
    modelId: "sonnet",
    objective: "Summarize the governed context",
    contextPackIds: ["11111111-1111-4111-8111-111111111111"],
    contextText: "bounded context",
    timeoutMs: 5_000,
    idempotencyKey: "22222222-2222-4222-8222-222222222222",
    catalogEntry: entry(),
    sourceIdentity,
    ...overrides,
  } as Parameters<ReadOnlyAnalysisService["start"]>[0]
}

const settle = async (): Promise<void> => { await new Promise((resolve) => setTimeout(resolve, 20)) }

describe("read-only analysis service", () => {
  it("claude: completes a bounded run and sanitizes the result", async () => {
    const svc = service(async () => ({ kind: "completed", text: "answer from /Users/me/secret.txt" }))
    const started = await svc.start(startInput())
    expect(started.state).toBe("running")
    await settle()
    const done = svc.read(started.analysisRunId)
    expect(done.state).toBe("completed")
    expect(done.result?.text).toContain("[redacted-path]")
    expect(done.envelope.modelTruthClass).toBe("provider-declared")
    expect(done.envelope.modelAlias).toBe(true)
  })

  it("codex: records the truthful read-breadth limitation", async () => {
    const svc = service(async () => ({ kind: "completed", text: "ok" }))
    const started = await svc.start(startInput({ adapterId: "gaep.codex-cli", catalogEntry: entry({ adapterId: "gaep.codex-cli" }) }))
    expect(started.knownLimitation).toContain("read-only sandbox")
  })

  it("unavailable: an absent provider never runs and never passes (INV-08)", async () => {
    const svc = service(async () => ({ kind: "completed", text: "should not happen" }))
    await expect(svc.start(startInput({ catalogEntry: entry({ detected: false }) })))
      .rejects.toMatchObject({ kind: "PROVIDER_UNAVAILABLE" })
    expect(svc.list()).toHaveLength(0)
  })

  it("auth: a successful attempt records auth-ready; a classified failure records auth-unavailable", async () => {
    const observations: Array<[string, string]> = []
    const ok = service(async () => ({ kind: "completed", text: "hi" }), (id, o) => observations.push([id, o]))
    await ok.start(startInput())
    await settle()
    expect(observations).toContainEqual(["gaep.claude-code-cli", "auth-ready"])

    const bad = service(async () => ({ kind: "failed", failureCategory: "auth-unavailable" }), (id, o) => observations.push([id, o]))
    const run = await bad.start(startInput({ idempotencyKey: "99999999-9999-4999-8999-999999999999" }))
    await settle()
    expect(bad.read(run.analysisRunId).failureCategory).toBe("auth-unavailable")
    expect(observations).toContainEqual(["gaep.claude-code-cli", "auth-unavailable"])
  })

  it("lifecycle: one active run, idempotency, cancel idempotency, terminal immutability (INV-25/26)", async () => {
    let release: (value: ProviderRunOutcome) => void = () => {}
    const svc = service(() => new Promise<ProviderRunOutcome>((resolve) => { release = resolve }))
    const first = await svc.start(startInput())

    // Concurrency: a second start is rejected while one is running.
    await expect(svc.start(startInput({ idempotencyKey: "33333333-3333-4333-8333-333333333333" })))
      .rejects.toMatchObject({ kind: "ANALYSIS_ALREADY_RUNNING" })

    // Idempotency: the same key returns the existing run.
    const repeat = await svc.start(startInput())
    expect(repeat.analysisRunId).toBe(first.analysisRunId)

    const cancelled = await svc.cancel(first.analysisRunId)
    expect(cancelled.state).toBe("cancelled")
    // Cancel is idempotent and terminal state is immutable.
    expect((await svc.cancel(first.analysisRunId)).state).toBe("cancelled")
    release({ kind: "completed", text: "late" })
    await settle()
    expect(svc.read(first.analysisRunId).state).toBe("cancelled")
  })

  it("context: rejects an oversized bounded context (INV-24)", async () => {
    const svc = service(async () => ({ kind: "completed", text: "ok" }))
    await expect(svc.start(startInput({ contextText: "x".repeat(MAX_CONTEXT_BYTES + 1) })))
      .rejects.toMatchObject({ kind: "CONTEXT_TOO_LARGE" })
  })

  it("source-mutation: a run that changes Product source fails closed (INV-04)", async () => {
    const svc = service(async () => {
      writeFileSync(join(root, "src", "app.ts"), "export const a = 999\n")
      return { kind: "completed", text: "mutated" }
    })
    const started = await svc.start(startInput())
    await settle()
    const record = svc.read(started.analysisRunId)
    expect(record.state).toBe("failed")
    expect(record.failureCategory).toBe("source-mutation")
    expect(record.result).toBeUndefined()
  })

  it("orphan: a stale running record is reconciled to failed/process-loss", async () => {
    const svc = service(() => new Promise<ProviderRunOutcome>(() => {}))
    const started = await svc.start(startInput())
    svc.reconcileOrphans()
    const record = svc.read(started.analysisRunId)
    expect(record.state).toBe("failed")
    expect(record.terminationCause).toBe("process-loss")
  })

  it("list: newest-first and bounded; unknown id throws ANALYSIS_NOT_FOUND", async () => {
    const svc = service(async () => ({ kind: "completed", text: "ok" }))
    await svc.start(startInput())
    await settle()
    expect(svc.list(10).length).toBe(1)
    expect(() => svc.read("44444444-4444-4444-8444-444444444444")).toThrow(AnalysisError)
  })
})

describe("read-only analysis durability (INV-25/26)", () => {
  it("persists run + evidence and reloads across a restart", async () => {
    const svc = service(async () => ({ kind: "completed", text: "durable answer" }))
    const started = await svc.start(startInput())
    await settle()
    expect(svc.read(started.analysisRunId).state).toBe("completed")
    // Run record and result evidence persisted under the governed paths.
    expect(existsSync(join(root, ".gaep", "runs", `${started.analysisRunId}.json`))).toBe(true)
    expect(existsSync(join(root, ".gaep", "evidence", `${started.analysisRunId}.result.json`))).toBe(true)
    expect(existsSync(join(root, ".gaep", "evidence", `${started.analysisRunId}.pre-run.json`))).toBe(true)

    // A fresh service instance (restart) reloads the persisted run and its idempotency key.
    const restarted = service(async () => ({ kind: "completed", text: "should not run again" }))
    expect(restarted.read(started.analysisRunId).state).toBe("completed")
    const repeat = await restarted.start(startInput())
    expect(repeat.analysisRunId).toBe(started.analysisRunId)
  })

  it("reconciles a persisted orphaned running record to failed/process-loss", async () => {
    const svc = service(() => new Promise(() => {}))
    const started = await svc.start(startInput())
    // Simulate a crash: a new instance loads the still-'running' record from disk.
    const restarted = service(() => new Promise(() => {}))
    expect(restarted.read(started.analysisRunId).state).toBe("running")
    restarted.reconcileOrphans()
    const record = restarted.read(started.analysisRunId)
    expect(record.state).toBe("failed")
    expect(record.terminationCause).toBe("process-loss")
  })

  it("enforces the timeout at the service boundary", async () => {
    const svc = service(() => new Promise(() => {}))
    const started = await svc.start(startInput({ timeoutMs: 1_000 }))
    await new Promise((resolve) => setTimeout(resolve, 1_200))
    const record = svc.read(started.analysisRunId)
    expect(record.state).toBe("timed-out")
    expect(record.terminationCause).toBe("timeout")
  })
})

describe("workspace mutation allowlist enforcement (INV-05, service path)", () => {
  it("provider writing an unauthorized .gaep path fails with source-mutation", async () => {
    const svc = service(async () => {
      // A provider that tries to hide a write inside .gaep during its execution window.
      mkdirSync(join(root, ".gaep"), { recursive: true })
      writeFileSync(join(root, ".gaep", "evil.json"), "{}\n")
      return { kind: "completed", text: "sneaky" }
    })
    const started = await svc.start(startInput())
    await settle()
    const record = svc.read(started.analysisRunId)
    expect(record.state).toBe("failed")
    expect(record.failureCategory).toBe("source-mutation")
    expect(record.result).toBeUndefined()
  })

  it("provider writing an unauthorized Product source file fails with source-mutation", async () => {
    const svc = service(async () => {
      writeFileSync(join(root, "src", "app.ts"), "export const a = 2\n")
      return { kind: "completed", text: "sneaky" }
    })
    const started = await svc.start(startInput())
    await settle()
    expect(svc.read(started.analysisRunId).failureCategory).toBe("source-mutation")
  })

  it("GAEP's own governed run + evidence writes are permitted (outside the provider window)", async () => {
    const svc = service(async () => ({ kind: "completed", text: "clean" }))
    const started = await svc.start(startInput())
    await settle()
    const record = svc.read(started.analysisRunId)
    // GAEP wrote .gaep/runs/<id>.json and .gaep/evidence/<id>.result.json legitimately.
    expect(record.state).toBe("completed")
    expect(existsSync(join(root, ".gaep", "runs", `${started.analysisRunId}.json`))).toBe(true)
    expect(existsSync(join(root, ".gaep", "evidence", `${started.analysisRunId}.result.json`))).toBe(true)
  })
})

/** A provider that runs the given side effect on abort, then terminates — modeling a provider that
 * keeps working briefly after receiving cancel/timeout. */
function onAbortRunner(effect: () => void, kind: ProviderRunOutcome = { kind: "completed", text: "post" }): ProviderRunner {
  return ({ signal }) =>
    new Promise<ProviderRunOutcome>((resolve) => {
      const fire = (): void => { effect(); resolve(kind) }
      if (signal.aborted) fire()
      else signal.addEventListener("abort", fire, { once: true })
    })
}

async function waitTerminal(svc: ReadOnlyAnalysisService, id: string, ms = 2_500) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline && svc.read(id).state === "running") {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  return svc.read(id)
}

describe("cancel/timeout post-provider mutation enforcement (INV-05 lifecycle)", () => {
  it("a provider that writes .gaep/evil.json AFTER cancellation fails closed as source-mutation", async () => {
    const svc = service(onAbortRunner(() => {
      mkdirSync(join(root, ".gaep"), { recursive: true })
      writeFileSync(join(root, ".gaep", "evil.json"), "{}\n")
    }))
    const started = await svc.start(startInput())
    const result = await svc.cancel(started.analysisRunId)
    expect(result.state).toBe("failed")
    expect(result.failureCategory).toBe("source-mutation")
  })

  it("a provider that writes Product source AFTER timeout/abort fails closed as source-mutation", async () => {
    const svc = service(onAbortRunner(() => {
      writeFileSync(join(root, "src", "app.ts"), "export const a = 42\n")
    }))
    const started = await svc.start(startInput({ timeoutMs: 1000 }))
    const record = await waitTerminal(svc, started.analysisRunId)
    expect(record.state).toBe("failed")
    expect(record.failureCategory).toBe("source-mutation")
  })

  it("a clean cancellation (no post-abort mutation) resolves as cancelled", async () => {
    const svc = service(onAbortRunner(() => {}))
    const started = await svc.start(startInput())
    expect((await svc.cancel(started.analysisRunId)).state).toBe("cancelled")
  })

  it("a clean timeout (no post-abort mutation) resolves as timed-out", async () => {
    const svc = service(onAbortRunner(() => {}))
    const started = await svc.start(startInput({ timeoutMs: 1000 }))
    expect((await waitTerminal(svc, started.analysisRunId)).state).toBe("timed-out")
  })

  it("the terminal record is immutable once published: a later cancel does not change it", async () => {
    const svc = service(onAbortRunner(() => {}))
    const started = await svc.start(startInput({ timeoutMs: 1000 }))
    const timedOut = await waitTerminal(svc, started.analysisRunId)
    expect(timedOut.state).toBe("timed-out")
    expect((await svc.cancel(started.analysisRunId)).state).toBe("timed-out")
  })

  it("GAEP-owned run + evidence writes remain permitted through a clean cancel", async () => {
    const svc = service(onAbortRunner(() => {}))
    const started = await svc.start(startInput())
    await svc.cancel(started.analysisRunId)
    expect(existsSync(join(root, ".gaep", "runs", `${started.analysisRunId}.json`))).toBe(true)
  })
})

/**
 * A provider that IGNORES the AbortSignal and stays alive past the hard-stop grace. Only forceStop
 * terminates it — and it manages one last workspace write on the way down, modeling a real process
 * that keeps writing after cancel/timeout until it is force-killed.
 */
function stubbornProvider(lateWrite: () => void): ProviderRunner {
  return (): ProviderRunHandle => {
    let settle: (value: ProviderRunOutcome) => void = () => {}
    const completion = new Promise<ProviderRunOutcome>((resolve) => { settle = resolve })
    let stopped = false
    return {
      completion,
      // Real force-stop: the provider writes its last bytes, then terminates (completion settles).
      forceStop: async () => {
        if (stopped) return
        stopped = true
        lateWrite()
        settle({ kind: "completed", text: "post-kill output that must be ignored" })
      },
    }
  }
}

describe("real provider hard-stop (INV-05 confirmed termination)", () => {
  it("force-stops a provider that ignores cancel, detects its late .gaep write, and never publishes a premature cancelled record", async () => {
    const svc = service(stubbornProvider(() => {
      mkdirSync(join(root, ".gaep"), { recursive: true })
      writeFileSync(join(root, ".gaep", "evil.json"), "{}\n")
    }))
    const started = await svc.start(startInput())
    // The record stays running until confirmed termination — no premature cancelled/terminal record.
    expect(svc.read(started.analysisRunId).state).toBe("running")
    const result = await svc.cancel(started.analysisRunId)
    // The late write during force-stop wins as source-mutation; the outcome is never `cancelled`.
    expect(result.state).toBe("failed")
    expect(result.failureCategory).toBe("source-mutation")
  })

  it("force-stops a provider that ignores timeout and detects a late Product-source write", async () => {
    const svc = service(stubbornProvider(() => {
      writeFileSync(join(root, "src", "app.ts"), "export const a = 7\n")
    }))
    const started = await svc.start(startInput({ timeoutMs: 1000 }))
    const record = await waitTerminal(svc, started.analysisRunId)
    expect(record.state).toBe("failed")
    expect(record.failureCategory).toBe("source-mutation")
  })
})
