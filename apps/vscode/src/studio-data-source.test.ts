import { describe, expect, it } from "vitest"

import { StudioMessageController, type StudioDataSource } from "./studio-data-source.js"
import {
  studioProtocolVersion,
  studioRoutes,
  studioRouteLabels,
  type StudioActionResult,
  type StudioPageSnapshot,
  type StudioRoute,
  type StudioSnapshot,
} from "./studio-protocol.js"

const channelId = "channel_token_1234567890"
const contextGeneration = "context_generation_1234567890"

function snapshot(route: StudioRoute, revision = 1): StudioSnapshot {
  const kind = route === "overview"
    ? "overview"
    : ["direction", "users-jobs", "outcomes", "scope", "architecture"].includes(route)
      ? "record-form"
      : route
  return {
    protocolVersion: studioProtocolVersion,
    contextGeneration,
    snapshotRevision: revision,
    route,
    workspace: { label: "Workspace", trusted: true, connectivity: "online", health: "valid" },
    navigation: studioRoutes.map((candidate) => ({ route: candidate, state: "not-started", gapCount: 0 })),
    surface: { kind: "ready", title: "Ready", issues: [], actions: [] },
    page: {
      kind,
      route,
      title: studioRouteLabels[route],
      purpose: "Host supplied purpose",
      source: { provenance: "Host snapshot" },
      actions: [],
    } as unknown as StudioPageSnapshot,
    footer: { draftState: "clean", validationSummary: "Not validated" },
  }
}

class FakeSource implements StudioDataSource {
  readonly routes: StudioRoute[] = []
  nextResult: StudioActionResult = { status: "accepted", announcement: "Accepted" }
  fail = false

  async readSnapshot(route: StudioRoute): Promise<StudioSnapshot> {
    this.routes.push(route)
    return snapshot(route, this.routes.length)
  }

  async execute(): Promise<StudioActionResult> {
    if (this.fail) throw new Error("raw provider secret must not escape")
    return this.nextResult
  }
}

describe("Product Studio data-source controller", () => {
  it("routes ready, navigation, and allowlisted actions through one typed boundary", async () => {
    const source = new FakeSource()
    const controller = new StudioMessageController(source, { channelId, initialRoute: "overview" })
    const ready = await controller.handle({ protocolVersion: 1, channelId, type: "studio.ready" })
    expect(ready?.type).toBe("studio.snapshot")
    const navigated = await controller.handle({ protocolVersion: 1, channelId, type: "studio.navigate", route: "trace" })
    expect(navigated?.type).toBe("studio.snapshot")
    expect(source.routes).toEqual(["overview", "trace"])

    const action = await controller.handle({
      protocolVersion: 1,
      channelId,
      type: "studio.action",
      requestId: "request-1",
      expectedContextGeneration: contextGeneration,
      expectedSnapshotRevision: 2,
      action: { kind: "open-record", recordId: "record-1" },
    })
    expect(action?.type).toBe("studio.action-result")
    expect(source.routes.at(-1)).toBe("trace")
  })

  it("ignores invalid messages and redacts thrown implementation errors", async () => {
    const source = new FakeSource()
    source.fail = true
    const controller = new StudioMessageController(source, {
      channelId,
      createRequestId: () => "diagnostic-1",
    })
    expect(await controller.handle({ protocolVersion: 1, channelId, type: "studio.command", command: "arbitrary" }))
      .toBeUndefined()
    const result = await controller.handle({
      protocolVersion: 1,
      channelId,
      type: "studio.action",
      requestId: "request-1",
      expectedContextGeneration: contextGeneration,
      expectedSnapshotRevision: 1,
      action: { kind: "export-product" },
    })
    expect(result).toMatchObject({
      type: "studio.action-result",
      result: {
        status: "rejected",
        announcement: "The operation could not be completed. Review GAEP diagnostics.",
        diagnosticId: "diagnostic-1",
      },
    })
    expect(JSON.stringify(result)).not.toContain("raw provider secret")
  })
})
