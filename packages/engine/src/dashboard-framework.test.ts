import { canonicalDigest } from "@gaep/agent-sdk"
import {
  deliveryPhaseDefinitions,
  deliveryPhaseIds,
  type PhaseDashboardCompositionRequest,
  type Product,
} from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { composePhaseDashboardFramework, DashboardProductBindingError } from "./dashboard-framework.js"

const product: Product = {
  schemaVersion: 1,
  id: "00000000-0000-4000-8000-000000000001",
  kind: "product",
  revision: 4,
  name: "Dashboard fixture",
  summary: "A bounded dashboard composition fixture",
  problem: "Dashboard composition needs exact phase and Product truth.",
  affectedUsers: "GAEP operators",
  desiredOutcome: "Every host receives the same bounded dashboard framework.",
  successSignals: ["The shared framework validates"],
  firstWorkflow: "Compose a phase dashboard from current governed Product state.",
  exclusions: [],
  profile: "internal-tool",
  lifecycleState: "active",
  createdAt: "2026-07-24T00:00:00.000Z",
  updatedAt: "2026-07-24T00:00:00.000Z",
}

function request(phase: PhaseDashboardCompositionRequest["phase"] = deliveryPhaseIds[0]): PhaseDashboardCompositionRequest {
  return {
    phase,
    expectedProductId: product.id,
    expectedProductRevision: product.revision ?? 1,
    expectedProductDigest: canonicalDigest(product),
  }
}

describe("phase dashboard framework composition", () => {
  it.each(deliveryPhaseIds)("selects the canonical phase dashboard for %s", (phase) => {
    const result = composePhaseDashboardFramework(product, request(phase), "2026-07-24T01:00:00.000Z")
    expect(result.phase).toEqual({ id: phase, label: deliveryPhaseDefinitions[phase].label })
    expect(result.panels.map((panel) => panel.id)).toEqual([
      deliveryPhaseDefinitions[phase].primaryDashboardId,
      "change-impact",
      "agent-model",
    ])
    expect(result.panels[0]).toMatchObject({
      applicability: { status: "unknown", basis: "not-evaluated" },
      state: "attention-required",
    })
    expect(result.panels.slice(1).every((panel) => panel.state === "active")).toBe(true)
  })

  it("is deterministic for an exact Product, request, and observation time", () => {
    const first = composePhaseDashboardFramework(product, request(), "2026-07-24T01:00:00.000Z")
    const second = composePhaseDashboardFramework(product, request(), "2026-07-24T01:00:00.000Z")
    expect(second).toEqual(first)
    const { compositionDigest, ...content } = first
    expect(compositionDigest).toBe(canonicalDigest(content))
  })

  it.each([
    ["identity", { expectedProductId: "00000000-0000-4000-8000-000000000002" }],
    ["revision", { expectedProductRevision: 3 }],
    ["digest", { expectedProductDigest: `sha256:${"0".repeat(64)}` }],
  ])("rejects stale Product %s bindings", (_label, change) => {
    expect(() => composePhaseDashboardFramework(product, { ...request(), ...change }))
      .toThrow(DashboardProductBindingError)
  })

  it("rejects caller-supplied applicability or readiness claims", () => {
    expect(() => composePhaseDashboardFramework(product, {
      ...request(),
      applicability: "applicable",
      ready: true,
    } as PhaseDashboardCompositionRequest)).toThrow()
  })
})
