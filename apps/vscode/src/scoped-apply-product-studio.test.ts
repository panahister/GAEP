import type { ScopedApplyProjection } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { scopedApplyTable } from "./current-engine-studio-data-source.js"

const digest = (value: string) => `sha256:${value.repeat(64)}` as const

function projection(): ScopedApplyProjection {
  return {
    initiative: { id: "22222222-2222-4222-8222-222222222222", revision: 1, digest: digest("2"), state: "active" },
    status: { state: "candidate-defined", reviewState: "ready-for-human-review", staleBindingCount: 0,
      coverageGapCount: 0, outOfEnvelopeCount: 0, invalidCandidateCount: 0, excludedPathCount: 1,
      selectedPathCount: 1, stagePathCount: 2 },
    candidate: {
      id: "33333333-3333-4333-8333-333333333333", revision: 1,
      stageIdentity: { namespace: "gaep-managed-stage", stageKey: "stage.product-view", generation: 3, scopeDigest: digest("3") },
      selectedPaths: [{ id: "44444444-4444-4444-8444-444444444444", selectionKey: "select.product-view",
        pathCandidate: "apps/vscode/src/product-view.ts", scopeState: "candidate-exact" }],
      excludedPaths: [{ id: "55555555-5555-4555-8555-555555555555", exclusionKey: "exclude.shared-contract",
        pathCandidate: "packages/contracts/src/index.ts", reason: "Outside the selected Product Studio unit" }],
      writeEnvelopeCandidates: ["apps/vscode/src/product-view.ts"], dependencyReceiptDigest: digest("4"),
      stageReceiptDigest: digest("5"), selectionReceiptDigest: digest("6"), exclusionReceiptDigest: digest("7"),
      envelopeReceiptDigest: digest("8"), recoveryReceiptDigest: digest("9"),
    },
  } as unknown as ScopedApplyProjection
}

describe("Product Studio Scoped Apply", () => {
  it("renders exact selected and excluded path metadata without promoting either to repository effect or authority truth", () => {
    const table = scopedApplyTable([projection()])

    expect(table.id).toBe("scoped-apply")
    expect(table.rows).toHaveLength(2)
    expect(table.rows[0]?.cells).toMatchObject({ stage: "stage.product-view", generation: "3", partition: "selected",
      key: "select.product-view", path: "apps/vscode/src/product-view.ts", disposition: "scoped-apply-candidate",
      scope: "candidate-exact", envelope: "inside exact candidate envelope" })
    expect(table.rows[0]?.cells.boundary).toContain("does not inspect or create a real stage")
    expect(table.rows[0]?.cells.boundary).toContain("mutate source")
    expect(table.rows[0]?.actions).toEqual([])
    expect(table.rows[1]?.cells).toMatchObject({ partition: "excluded", key: "exclude.shared-contract",
      path: "packages/contracts/src/index.ts", disposition: "Outside the selected Product Studio unit",
      scope: "excluded-from-scoped-apply", envelope: "not in candidate write envelope" })
    expect(table.rows[1]?.cells.boundary).toContain("is not discard")
    expect(table.rows[1]?.actions).toEqual([])
  })

  it("provides an explicit fail-closed empty and refresh state", () => {
    const table = scopedApplyTable([])

    expect(table.rows).toEqual([])
    expect(table.emptyState?.title).toBe("No governed Scoped Apply candidate")
    expect(table.emptyState?.detail).toContain("Refresh Product Studio")
    expect(table.emptyState?.detail).toContain("cannot create or inspect a real stage")
    expect(table.emptyState?.detail).toContain("mutate source")
  })
})
