import { canonicalDigest } from "@gaep/agent-sdk"
import { type Initiative, type Phase3aDashboardRequest, type Phase3aDashboardWorkflow, type Product } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { composePhase3aDashboard, Phase3aDashboardBindingError } from "./phase3a-dashboard.js"

const product: Product = {
  schemaVersion: 1, id: "00000000-0000-4000-8000-000000000001", kind: "product", revision: 4,
  name: "Phase 3A dashboard fixture", summary: "A bounded dashboard fixture", problem: "Planning state is fragmented.",
  affectedUsers: "Product owners and engineers", desiredOutcome: "One derived read-only planning view.",
  successSignals: ["All source bindings remain exact"], firstWorkflow: "Inspect current planning state.",
  exclusions: ["Automatic readiness or implementation"], profile: "internal-tool", lifecycleState: "active",
  createdAt: "2026-07-31T08:30:00.000Z", updatedAt: "2026-07-31T08:30:00.000Z",
}

const initiative: Initiative = {
  schemaVersion: 1, id: "00000000-0000-4000-8000-000000000002", kind: "initiative", revision: 3,
  productId: product.id, title: "Phase 3A dashboard Initiative", outcome: "Expose exact planning evidence.",
  scope: ["P3A-01 through P3A-22"], exclusions: ["Readiness, waiver, ownership, implementation, or acceptance authority"],
  state: "active", createdAt: "2026-07-31T08:30:00.000Z", updatedAt: "2026-07-31T08:30:00.000Z",
}

function request(): Phase3aDashboardRequest {
  return {
    expectedProductId: product.id, expectedProductRevision: product.revision ?? 1, expectedProductDigest: canonicalDigest(product),
    expectedInitiativeId: initiative.id, expectedInitiativeRevision: initiative.revision ?? 1, expectedInitiativeDigest: canonicalDigest(initiative),
  }
}

function workflow(provider: "codex" | "claude"): Phase3aDashboardWorkflow {
  return {
    provider, availability: "sealed-local-deterministic",
    binding: {
      product: { recordId: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) },
      initiative: { recordId: initiative.id, revision: initiative.revision ?? 1, digest: canonicalDigest(initiative) },
      scenarioId: `phase-3a-atlas-${provider}-readiness-workflow-v1`,
      receiptDigest: canonicalDigest(`${provider}-receipt`), sourceDigest: canonicalDigest(`${provider}-source`),
      observedAt: "2026-07-31T08:40:00.000Z",
    },
    executionMode: "offline-deterministic", liveAcceptance: "not-established", semanticQuality: "not-assessed", authority: "not-granted",
  }
}

describe("Phase 3A dashboard composition", () => {
  it("projects missing sources and provider evidence explicitly without authority", () => {
    const dashboard = composePhase3aDashboard(product, initiative, [], request(), [], "2026-07-31T08:45:00.000Z")
    expect(dashboard.phaseStatus).toMatchObject({ currentSourceCount: 0, unavailableSourceCount: 20, providerWorkflowEvidenceCount: 0, liveProviderAcceptanceCount: 0, nativeHostAcceptanceCount: 0 })
    expect(dashboard.workflows.map((entry) => entry.availability)).toEqual(["unavailable", "unavailable"])
    const { snapshotDigest, ...content } = dashboard
    expect(snapshotDigest).toBe(canonicalDigest(content))
  })

  it("binds explicit sealed local provider workflows without converting them to live acceptance", () => {
    const dashboard = composePhase3aDashboard(product, initiative, [], request(), [workflow("codex"), workflow("claude")], "2026-07-31T08:45:00.000Z")
    expect(dashboard.phaseStatus.providerWorkflowEvidenceCount).toBe(2)
    expect(dashboard.views.find((view) => view.id === "agent-model")?.workflowEvidenceCount).toBe(2)
    expect(dashboard.workflows.every((entry) => entry.liveAcceptance === "not-established" && entry.semanticQuality === "not-assessed")).toBe(true)
  })

  it("fails closed on stale context, unknown sources, and provider rebinding", () => {
    expect(() => composePhase3aDashboard(product, initiative, [], { ...request(), expectedProductRevision: 5 })).toThrow(Phase3aDashboardBindingError)
    expect(() => composePhase3aDashboard(product, initiative, [{ kind: "invented-projection" }], request())).toThrow(Phase3aDashboardBindingError)
    const stale = workflow("codex")
    stale.binding!.initiative.revision = 9
    expect(() => composePhase3aDashboard(product, initiative, [], request(), [stale])).toThrow(Phase3aDashboardBindingError)
  })

  it("is deterministic for the exact source and time inputs", () => {
    const first = composePhase3aDashboard(product, initiative, [], request(), [workflow("codex")], "2026-07-31T08:45:00.000Z")
    const second = composePhase3aDashboard(product, initiative, [], request(), [workflow("codex")], "2026-07-31T08:45:00.000Z")
    expect(second).toEqual(first)
  })
})
