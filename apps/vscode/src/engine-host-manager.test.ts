import { describe, expect, it } from "vitest"

import { EngineHostClientManager, type ManagedEngineClient } from "./engine-host-manager.js"

/** A fake Engine Host client with a stable identity so tests can prove child-process reuse. */
class FakeClient implements ManagedEngineClient {
  static nextId = 1
  readonly processId = FakeClient.nextId++
  disposed = false
  requests: string[] = []
  private exit: (() => void) | undefined
  constructor(readonly rootPath: string) {}
  async request<T = unknown>(method: string): Promise<T> {
    this.requests.push(method)
    return { ok: true } as T
  }
  dispose(): void { this.disposed = true }
  onExit(listener: () => void): void { this.exit = listener }
  crash(): void { this.exit?.() }
}

function manager() {
  const created: FakeClient[] = []
  const mgr = new EngineHostClientManager((rootPath) => {
    const client = new FakeClient(rootPath)
    created.push(client)
    return client
  })
  return { mgr, created }
}

describe("EngineHostClientManager (persistent host per Product root)", () => {
  it("reuses the same child process across selection, run, poll, and cancel", async () => {
    const { mgr, created } = manager()
    const root = "/products/alpha"
    await mgr.with(root, (c) => c.request("selectProviderModel"))
    await mgr.with(root, (c) => c.request("startReadOnlyAnalysis"))
    await mgr.with(root, (c) => c.request("readAnalysisRun"))
    await mgr.with(root, (c) => c.request("cancelAnalysisRun"))

    expect(created).toHaveLength(1)
    expect(created[0]!.requests).toEqual(["selectProviderModel", "startReadOnlyAnalysis", "readAnalysisRun", "cancelAnalysisRun"])
    expect(created[0]!.disposed).toBe(false)
  })

  it("does not start a second host for a Dashboard read during a running analysis", async () => {
    const { mgr, created } = manager()
    const root = "/products/alpha"
    // Start an analysis, then read the dashboard while it is 'running' — same host, no second process.
    const running = mgr.with(root, (c) => c.request("startReadOnlyAnalysis"))
    await mgr.with(root, (c) => c.request("dashboardProjection"))
    await running
    expect(created).toHaveLength(1)
  })

  it("disposes the old client and connects a new one when the Product root changes", async () => {
    const { mgr, created } = manager()
    await mgr.with("/products/alpha", (c) => c.request("providerCatalog"))
    await mgr.with("/products/beta", (c) => c.request("providerCatalog"))

    expect(created).toHaveLength(2)
    expect(created[0]!.disposed).toBe(true)
    expect(created[1]!.disposed).toBe(false)
    expect(mgr.currentRoot).toBe("/products/beta")
  })

  it("reconnects only after the prior host is confirmed dead (crash)", async () => {
    const { mgr, created } = manager()
    const root = "/products/alpha"
    await mgr.with(root, (c) => c.request("providerCatalog"))
    expect(created).toHaveLength(1)

    // Crash the live host; the next call must connect a fresh one.
    created[0]!.crash()
    await mgr.with(root, (c) => c.request("dashboardProjection"))
    expect(created).toHaveLength(2)
    expect(created[0]!.disposed).toBe(true)
    expect(created[1]!.disposed).toBe(false)
  })

  it("dispose shuts down the live host", async () => {
    const { mgr, created } = manager()
    await mgr.with("/products/alpha", (c) => c.request("providerCatalog"))
    mgr.dispose()
    expect(created[0]!.disposed).toBe(true)
    expect(mgr.currentRoot).toBeUndefined()
  })
})
