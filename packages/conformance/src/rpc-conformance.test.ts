import { describe, expect, it } from "vitest"

import { platformReadinessReportSchema, type PlatformReadinessSnapshot } from "@gaep/contracts"

import { composePlatformReadinessReport } from "./index.js"
import { observeVsCodeHost, runEngineHostBoundaryCheck } from "./rpc-conformance.js"

const now = "2026-07-24T00:00:00.000Z"

function baseSnapshot(): PlatformReadinessSnapshot {
  return {
    schemaVersion: 1,
    generatedAt: now,
    engineVersion: "0.1.0",
    providers: [],
    workspace: {
      status: "uninitialized",
      initialized: false,
      auditValid: true,
      lockPresent: false,
      issueCount: 0,
      truthClass: "observed",
      observedAt: now,
    },
    hostMatrix: [
      { host: "vscode", state: "not-run", source: "base-default" },
      { host: "visual-studio", state: "pending-environment", source: "base-default" },
      { host: "rider", state: "pending-environment", source: "base-default" },
      { host: "kiro", state: "pending-environment", source: "base-default" },
    ],
  }
}

describe("composePlatformReadinessReport", () => {
  it("keeps every host at its Base default when no host is executed (unknown stays unknown)", () => {
    const report = composePlatformReadinessReport({ base: baseSnapshot(), now })
    expect(() => platformReadinessReportSchema.parse(report)).not.toThrow()
    expect(report.hostMatrix.every((row) => row.source === "base-default")).toBe(true)
    expect(report.hostMatrix.find((row) => row.host === "vscode")?.state).toBe("not-run")
    for (const host of ["visual-studio", "rider", "kiro"] as const) {
      expect(report.hostMatrix.find((row) => row.host === host)?.state).toBe("pending-environment")
    }
  })

  it("records VS Code passed only when fed a passing executed observation", () => {
    const observation = observeVsCodeHost({ executed: true, passed: true, evidenceSource: "apps/vscode/test/e2e", evidence: "PASS open", now })
    expect(observation).toBeDefined()
    const report = composePlatformReadinessReport({ base: baseSnapshot(), observations: observation ? [observation] : [], now })
    const vscode = report.hostMatrix.find((row) => row.host === "vscode")
    expect(vscode?.state).toBe("passed")
    expect(vscode?.source).toBe("observation")
  })

  it("produces no VS Code observation when the E2E did not execute, leaving the Base not-run default", () => {
    const observation = observeVsCodeHost({ executed: false, passed: false, evidenceSource: "apps/vscode/test/e2e", evidence: "", now })
    expect(observation).toBeUndefined()
    const report = composePlatformReadinessReport({ base: baseSnapshot(), observations: [], now })
    const vscode = report.hostMatrix.find((row) => row.host === "vscode")
    expect(vscode?.state).toBe("not-run")
    expect(vscode?.source).toBe("base-default")
  })

  it("rejects a direct host-state override that is not a valid executed observation", () => {
    const override = { host: "rider", state: "passed" } as never
    expect(() => composePlatformReadinessReport({ base: baseSnapshot(), observations: [override], now })).toThrow()
  })

  it("does not map an engine-host boundary result into the Four-IDE matrix", async () => {
    const boundary = await runEngineHostBoundaryCheck({
      dispatch: async (request: unknown) => {
        const req = request as { protocolVersion?: number }
        if (req.protocolVersion === 2) return baseSnapshot()
        throw Object.assign(new Error("upgrade required"), { code: -32_021, kind: "PROTOCOL_UPGRADE_REQUIRED" })
      },
      now,
    })
    expect(boundary.state).toBe("passed")
    expect(boundary.target).toBe("engine-host-rpc")

    const report = composePlatformReadinessReport({ base: baseSnapshot(), boundaryChecks: [boundary], now })
    expect(report.boundaryChecks).toHaveLength(1)
    // The boundary result is separate: it never appears as an IDE host row.
    expect(report.hostMatrix.some((row) => row.host === ("engine-host" as never))).toBe(false)
    expect(report.hostMatrix.every((row) => row.source === "base-default")).toBe(true)
  })

  it("passes when v1 is rejected via the stdio-shaped data.kind", async () => {
    const boundary = await runEngineHostBoundaryCheck({
      dispatch: async (request: unknown) => {
        const req = request as { protocolVersion?: number }
        if (req.protocolVersion === 2) return baseSnapshot()
        throw Object.assign(new Error("upgrade required"), { data: { kind: "PROTOCOL_UPGRADE_REQUIRED" } })
      },
      now,
    })
    expect(boundary.state).toBe("passed")
  })

  it("fails the boundary check when v1 is not rejected", async () => {
    const boundary = await runEngineHostBoundaryCheck({
      dispatch: async () => baseSnapshot(),
      now,
    })
    expect(boundary.state).toBe("failed")
  })

  it("fails the boundary check when v1 throws a generic/internal error, not PROTOCOL_UPGRADE_REQUIRED", async () => {
    const boundary = await runEngineHostBoundaryCheck({
      dispatch: async (request: unknown) => {
        const req = request as { protocolVersion?: number }
        if (req.protocolVersion === 2) return baseSnapshot()
        throw Object.assign(new Error("internal"), { code: -32_603, kind: "INTERNAL_ERROR" })
      },
      now,
    })
    expect(boundary.state).toBe("failed")
    expect(boundary.detail).toContain("unexpected error")
  })
})
