import { describe, expect, it } from "vitest"

import { ActiveRunRegistry, type ManagedAgentRun } from "./run-registry.js"

function managedRun(runId: string, behavior: "stop" | "fail" = "stop", rootPath = "/workspace"): ManagedAgentRun {
  return {
    runId,
    rootPath,
    stopAndWait: async () => {
      if (behavior === "fail") throw new Error("still running")
    },
  }
}

describe("active VS Code run registry", () => {
  it("tracks and unregisters every managed run", () => {
    const registry = new ActiveRunRegistry()
    const unregister = registry.register(managedRun("run-1"))
    expect(registry.size).toBe(1)
    expect(registry.hasRoot("/workspace")).toBe(true)
    unregister()
    expect(registry.size).toBe(0)
  })

  it("retains a run when process termination cannot be confirmed", async () => {
    const registry = new ActiveRunRegistry()
    registry.register(managedRun("run-ok"))
    registry.register(managedRun("run-stuck", "fail", "/other-workspace"))
    const result = await registry.stopAll()
    expect(result.stoppedRunIds).toEqual(["run-ok"])
    expect(result.failures).toEqual([{ runId: "run-stuck", error: "still running" }])
    expect(result.remainingRunIds).toEqual(["run-stuck"])
    expect(registry.size).toBe(1)
  })

  it("prevents concurrent provider processes for one Product root", () => {
    const registry = new ActiveRunRegistry()
    registry.register(managedRun("run-1"))
    expect(() => registry.register(managedRun("run-2"))).toThrow(/already active for Product root/)
  })
})
