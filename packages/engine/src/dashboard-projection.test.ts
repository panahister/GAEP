import { describe, expect, it } from "vitest"

import { buildDashboardProjection, defaultHostMatrix, CATALOG_STALE_AFTER_MS } from "./dashboard-projection.js"

describe("dashboard projection (INV-11/16)", () => {
  it("renders a friendly uninitialized state with empty data", () => {
    const p = buildDashboardProjection({
      workspaceState: "product-uninitialized",
      catalog: null,
      selection: null,
      latestRun: null,
      hostMatrix: defaultHostMatrix("0.2.0"),
      now: "2026-07-24T00:00:00.000Z",
    })
    expect(p.workspaceState).toBe("product-uninitialized")
    expect(p.workspaceMessage).toContain("Initialize Product first")
    expect(p.providers).toEqual([])
    expect(p.selection).toBeNull()
    expect(p.hostMatrix.map((r) => r.host)).toEqual(["vscode", "visual-studio", "rider", "kiro"])
    expect(p.catalogStale).toBe(false)
  })

  it("flags a stale catalog beyond the freshness bound", () => {
    const observedAt = "2026-07-24T00:00:00.000Z"
    const now = new Date(Date.parse(observedAt) + CATALOG_STALE_AFTER_MS + 1_000).toISOString()
    const p = buildDashboardProjection({
      workspaceState: "product-ready",
      catalog: { schemaVersion: 1, observedAt, providers: [] },
      selection: null,
      latestRun: null,
      hostMatrix: defaultHostMatrix("0.2.0"),
      now,
    })
    expect(p.catalogStale).toBe(true)
  })
})
