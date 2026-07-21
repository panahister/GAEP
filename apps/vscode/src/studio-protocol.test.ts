import { describe, expect, it } from "vitest"

import {
  isStudioAction,
  isStudioSnapshot,
  parseHostToStudioMessage,
  parseStudioToHostMessage,
  runStageLabels,
  studioDraftStates,
  studioProtocolVersion,
  studioRouteLabels,
  studioRoutes,
  studioSurfaceKinds,
  type StudioPageSnapshot,
  type StudioRoute,
  type StudioSnapshot,
} from "./studio-protocol.js"

const channelId = "channel_token_1234567890"
const contextGeneration = "context_generation_1234567890"

function pageFor(route: StudioRoute): StudioPageSnapshot {
  const baseFor = <R extends StudioRoute>(candidate: R) => ({
    route: candidate,
    title: studioRouteLabels[candidate],
    purpose: "Host supplied purpose",
    source: { provenance: "Host snapshot" },
    actions: [],
  })
  const sections = studioRoutes.map((candidate) => ({ route: candidate, state: "not-started" as const, gapCount: 0 }))
  const table = (id: string) => ({ id, title: id, columns: [], rows: [], actions: [] })
  switch (route) {
    case "overview":
      return {
        ...baseFor(route),
        kind: "overview",
        product: { name: "Product", lifecycle: "active", readinessStatement: "Host supplied readiness" },
        sections,
        currentInitiative: [],
        latestRun: [],
        blockers: [],
      }
    case "direction":
    case "users-jobs":
    case "outcomes":
    case "scope":
    case "architecture":
      return {
        ...baseFor(route),
        kind: "record-form",
        fields: [],
        gaps: [],
        conflicts: [],
        draft: { state: "clean", materialChange: false, validation: "not-validated" },
      }
    case "delivery":
      return { ...baseFor(route), kind: "delivery", initiatives: table("initiatives"), changes: table("changes"), workItems: table("work-items") }
    case "risks-decisions":
      return { ...baseFor(route), kind: "risks-decisions", risks: table("risks"), recommendations: table("recommendations"), decisions: table("decisions") }
    case "trace":
      return { ...baseFor(route), kind: "trace", relationships: table("relationships"), impact: [] }
    case "agents-tools":
      return { ...baseFor(route), kind: "agents-tools", adapters: table("adapters"), selectedAgent: [], limitations: [], handoffs: table("handoffs") }
    case "runs-evidence":
      return { ...baseFor(route), kind: "runs-evidence", runs: table("runs"), selectedRun: [], events: [], evidence: table("evidence"), recoveryActions: [] }
    case "readiness":
      return { ...baseFor(route), kind: "readiness", statement: "Host supplied readiness", sections, gaps: [], conflicts: [] }
  }
}

function snapshot(route: StudioRoute): StudioSnapshot {
  return {
    protocolVersion: studioProtocolVersion,
    contextGeneration,
    snapshotRevision: 1,
    route,
    workspace: { label: "Workspace", trusted: true, connectivity: "online", health: "valid" },
    navigation: studioRoutes.map((candidate) => ({ route: candidate, state: "not-started", gapCount: 0 })),
    surface: { kind: "ready", title: "Ready", issues: [], actions: [] },
    page: pageFor(route),
    footer: { draftState: "clean", validationSummary: "Not validated" },
  }
}

describe("Product Studio protocol", () => {
  it("defines the approved twelve-route order and eight run stages", () => {
    expect(studioRoutes).toEqual([
      "overview",
      "direction",
      "users-jobs",
      "outcomes",
      "scope",
      "delivery",
      "architecture",
      "risks-decisions",
      "trace",
      "agents-tools",
      "runs-evidence",
      "readiness",
    ])
    expect(Object.values(studioRouteLabels)).toHaveLength(12)
    expect(runStageLabels).toHaveLength(8)
    expect(runStageLabels.at(-1)).toBe("Launch confirmation")
    expect(studioSurfaceKinds).toEqual([
      "uninitialized", "loading", "empty", "ready", "invalid", "blocked", "interrupted", "offline",
    ])
    expect(studioDraftStates).toEqual(["clean", "unsaved", "saved-locally", "revision-ready", "revision-created"])
  })

  it("accepts route-matched snapshots for all twelve surfaces", () => {
    for (const route of studioRoutes) expect(isStudioSnapshot(snapshot(route)), route).toBe(true)
    expect(isStudioSnapshot({ ...snapshot("overview"), route: "trace" })).toBe(false)
    expect(isStudioSnapshot({ ...snapshot("overview"), unexpected: true })).toBe(false)
  })

  it("deeply validates and bounds machine-local inspector entries", () => {
    const valid = {
      ...snapshot("agents-tools"),
      inspector: {
        title: "Machine-local inspector",
        recordId: "adapter-1",
        entries: [{ term: "Executable", value: "/opt/codex" }],
        relationships: [{ term: "Binding", value: "observed" }],
        actions: [],
      },
    }
    expect(isStudioSnapshot(valid)).toBe(true)
    expect(isStudioSnapshot({
      ...valid,
      inspector: { ...valid.inspector, entries: [{ term: "Executable" }] },
    })).toBe(false)
    expect(isStudioSnapshot({
      ...valid,
      inspector: { ...valid.inspector, relationships: Array.from({ length: 1_001 }, () => ({ term: "Link", value: "bounded" })) },
    })).toBe(false)
  })

  it("allows only typed semantic actions and never arbitrary commands or paths", () => {
    expect(isStudioAction({ kind: "select-product-root" })).toBe(true)
    expect(isStudioAction({ kind: "create-initiative" })).toBe(true)
    expect(isStudioAction({ kind: "prepare-run", command: "workbench.action.terminal.new" })).toBe(false)
    expect(isStudioAction({ kind: "select-product-root", path: "/tmp/untrusted" })).toBe(false)
    expect(isStudioAction({ kind: "open-record", recordId: "record-1" })).toBe(true)
    expect(isStudioAction({ kind: "execute-command", command: "workbench.action.terminal.sendSequence" })).toBe(false)
    expect(isStudioAction({ kind: "set-run-stage", preparedRunId: "run-1", stage: 9 })).toBe(false)
    expect(isStudioAction({
      kind: "save-draft",
      route: "direction",
      values: { problem: "Bounded content" },
    })).toBe(true)
  })

  it("binds messages to the expected channel and rejects extra envelope fields", () => {
    const ready = {
      protocolVersion: studioProtocolVersion,
      channelId,
      type: "studio.ready",
      restoredRoute: "overview",
    }
    expect(parseStudioToHostMessage(ready, channelId)?.type).toBe("studio.ready")
    expect(parseStudioToHostMessage(ready, "another_channel_123456")).toBeUndefined()
    expect(parseStudioToHostMessage({ ...ready, command: "arbitrary" }, channelId)).toBeUndefined()

    const action = {
      protocolVersion: studioProtocolVersion,
      channelId,
      type: "studio.action",
      requestId: "request-1",
      expectedContextGeneration: contextGeneration,
      expectedSnapshotRevision: 1,
      action: { kind: "show-diagnostics" },
    }
    expect(parseStudioToHostMessage(action, channelId)?.type).toBe("studio.action")
    const withoutGeneration: Record<string, unknown> = { ...action }
    delete withoutGeneration.expectedContextGeneration
    expect(parseStudioToHostMessage(withoutGeneration, channelId)).toBeUndefined()
    expect(parseStudioToHostMessage({ ...action, expectedContextGeneration: "short" }, channelId)).toBeUndefined()

    const hostSnapshot = {
      protocolVersion: studioProtocolVersion,
      channelId,
      type: "studio.snapshot",
      snapshot: snapshot("readiness"),
    }
    expect(parseHostToStudioMessage(hostSnapshot, channelId)?.type).toBe("studio.snapshot")
    expect(parseHostToStudioMessage({ ...hostSnapshot, path: "/private" }, channelId)).toBeUndefined()
  })
})
