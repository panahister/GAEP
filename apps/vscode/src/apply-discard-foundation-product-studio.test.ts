import type { ApplyDiscardFoundationProjection } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { applyDiscardFoundationTable } from "./current-engine-studio-data-source.js"

const digest = (value: string) => `sha256:${value.repeat(64)}` as const

function projection(): ApplyDiscardFoundationProjection {
  return {
    initiative: { id: "22222222-2222-4222-8222-222222222222", revision: 1, digest: digest("2"), state: "active" },
    status: { state: "candidate-defined", reviewState: "ready-for-human-review", staleBindingCount: 0,
      coverageGapCount: 0, invalidCandidateCount: 0 },
    candidate: {
      id: "33333333-3333-4333-8333-333333333333", revision: 1,
      stageIdentity: { namespace: "gaep-managed-stage", stageKey: "stage.product-view", generation: 2, scopeDigest: digest("3") },
      decision: "apply-entire-stage-candidate",
      paths: [{ id: "44444444-4444-4444-8444-444444444444", decisionPathKey: "path.product-view",
        backlogTraceKey: "trace.product-view", pathCandidate: "apps/vscode/src/product-view.ts",
        disposition: "apply-candidate", scopeState: "candidate-exact" }],
      dependencyReceiptDigest: digest("4"), stageReceiptDigest: digest("5"), decisionReceiptDigest: digest("6"),
      scopeReceiptDigest: digest("7"), recoveryReceiptDigest: digest("8"), evidenceReceiptDigest: digest("9"),
      assessmentReceiptDigest: digest("a"),
    },
  } as unknown as ApplyDiscardFoundationProjection
}

describe("Product Studio Apply/Discard Foundation", () => {
  it("renders bounded whole-stage decision metadata without promoting it to effect or authority truth", () => {
    const table = applyDiscardFoundationTable([projection()])

    expect(table.id).toBe("apply-discard-foundation")
    expect(table.rows).toHaveLength(1)
    expect(table.rows[0]?.cells).toMatchObject({ stage: "stage.product-view", generation: "2",
      decision: "apply-entire-stage-candidate", decisionPath: "path.product-view", backlogTrace: "trace.product-view",
      path: "apps/vscode/src/product-view.ts", disposition: "apply-candidate", scope: "candidate-exact" })
    expect(table.rows[0]?.cells.boundary).toContain("unverified candidates")
    expect(table.rows[0]?.cells.boundary).toContain("does not inspect or create a real stage")
    expect(table.rows[0]?.actions).toEqual([])
  })

  it("provides an explicit fail-closed empty and refresh state", () => {
    const table = applyDiscardFoundationTable([])

    expect(table.rows).toEqual([])
    expect(table.emptyState?.title).toBe("No governed Apply/Discard Foundation candidate")
    expect(table.emptyState?.detail).toContain("Refresh Product Studio")
    expect(table.emptyState?.detail).toContain("cannot create or inspect a real stage")
    expect(table.emptyState?.detail).toContain("mutate source")
  })
})
