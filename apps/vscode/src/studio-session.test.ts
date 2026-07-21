import { describe, expect, it } from "vitest"

import { StudioMessageController, type StudioDataSource } from "./studio-data-source.js"
import { StudioHostSession, type StudioMessagePort } from "./studio-session.js"
import {
  studioProtocolVersion,
  studioRouteLabels,
  studioRoutes,
  type HostToStudioMessage,
  type StudioActionResult,
  type StudioPageSnapshot,
  type StudioRoute,
  type StudioSnapshot,
} from "./studio-protocol.js"

const channelId = "studio_channel_1234567890"
const contextGeneration = "context_generation_1234567890"

function snapshot(route: StudioRoute): StudioSnapshot {
  return {
    protocolVersion: studioProtocolVersion,
    contextGeneration,
    snapshotRevision: 1,
    route,
    workspace: { label: "Workspace", trusted: true, connectivity: "online", health: "valid" },
    navigation: studioRoutes.map((candidate) => ({ route: candidate, state: "not-started", gapCount: 1 })),
    surface: { kind: "ready", title: "Ready", issues: [], actions: [] },
    page: {
      kind: "record-form",
      route,
      title: studioRouteLabels[route],
      purpose: "Test page",
      source: { provenance: "Test" },
      actions: [],
      fields: [],
      gaps: [],
      conflicts: [],
      draft: { state: "clean", materialChange: false, validation: "not-validated" },
    } as unknown as StudioPageSnapshot,
    footer: { draftState: "clean", validationSummary: "Not assessed" },
  }
}

class FakeSource implements StudioDataSource {
  async readSnapshot(route: StudioRoute): Promise<StudioSnapshot> {
    return snapshot(route)
  }

  async execute(): Promise<StudioActionResult> {
    return { status: "accepted", announcement: "Accepted" }
  }
}

class DeferredSource implements StudioDataSource {
  readCount = 0
  observedSignal?: AbortSignal
  private resolveStarted!: () => void
  private resolveSnapshot?: (value: StudioSnapshot) => void
  readonly started = new Promise<void>((resolve) => { this.resolveStarted = resolve })

  readSnapshot(route: StudioRoute, signal?: AbortSignal): Promise<StudioSnapshot> {
    this.readCount += 1
    this.observedSignal = signal
    this.resolveStarted()
    return new Promise<StudioSnapshot>((resolve) => {
      this.resolveSnapshot = resolve
    }).then(() => snapshot(route))
  }

  async execute(): Promise<StudioActionResult> {
    return { status: "accepted", announcement: "Accepted" }
  }

  release(): void {
    this.resolveSnapshot?.(snapshot("overview"))
  }
}

class FakePort implements StudioMessagePort {
  readonly posted: HostToStudioMessage[] = []
  private listener?: (message: unknown) => void

  postMessage(message: HostToStudioMessage): Promise<boolean> {
    this.posted.push(message)
    return Promise.resolve(true)
  }

  onDidReceiveMessage(listener: (message: unknown) => void): { dispose(): void } {
    this.listener = listener
    return { dispose: () => { this.listener = undefined } }
  }

  send(message: unknown): void {
    this.listener?.(message)
  }
}

describe("Product Studio host session", () => {
  it("serializes mocked webview messages and supports host refresh navigation", async () => {
    const diagnostics: string[] = []
    const session = new StudioHostSession(
      new StudioMessageController(new FakeSource(), { channelId }),
      (message) => diagnostics.push(message),
    )
    const port = new FakePort()
    session.connect(port)
    port.send({ protocolVersion: 1, channelId, type: "studio.ready" })
    await session.refresh(port, "direction")
    expect(port.posted.map((message) => message.type)).toEqual(["studio.snapshot", "studio.snapshot"])
    expect(port.posted.at(-1)).toMatchObject({ type: "studio.snapshot", snapshot: { route: "direction" } })
    expect(session.currentRoute()).toBe("direction")
    expect(diagnostics).toEqual([])
    session.dispose()
  })

  it("ignores malformed or cross-channel messages", async () => {
    const session = new StudioHostSession(
      new StudioMessageController(new FakeSource(), { channelId }),
      () => undefined,
    )
    const port = new FakePort()
    session.connect(port)
    port.send({ protocolVersion: 1, channelId: "wrong_channel_123456", type: "studio.ready" })
    await session.refresh(port)
    expect(port.posted).toHaveLength(1)
  })

  it("aborts in-flight work, skips queued work, and suppresses late posts after disposal", async () => {
    const diagnostics: string[] = []
    const source = new DeferredSource()
    const session = new StudioHostSession(
      new StudioMessageController(source, { channelId }),
      (message) => diagnostics.push(message),
    )
    const port = new FakePort()
    session.connect(port)
    port.send({ protocolVersion: 1, channelId, type: "studio.ready" })
    const queuedRefresh = session.refresh(port, "direction")
    await source.started

    session.dispose()
    expect(source.observedSignal?.aborted).toBe(true)
    source.release()
    await queuedRefresh

    expect(source.readCount).toBe(1)
    expect(port.posted).toEqual([])
    expect(diagnostics).toEqual([])
  })
})
