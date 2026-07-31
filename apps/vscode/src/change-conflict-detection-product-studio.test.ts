import type { ChangeConflictDetectionProjection } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { changeConflictDetectionTable } from "./current-engine-studio-data-source.js"

const digest = (value: string) => `sha256:${value.repeat(64)}` as const
function projection(): ChangeConflictDetectionProjection {
  const kinds = ["baseline-drift", "overlapping-stage", "provider-handoff", "stale-generation", "user-edit"] as const
  return { initiative: { id: "22222222-2222-4222-8222-222222222222", revision: 1, digest: digest("2"), state: "active" },
    status: { state: "candidate-defined", conflictCandidateCount: 1, noConflictCandidateCount: 4, unavailableCount: 0, staleBindingCount: 0 },
    candidate: { id: "33333333-3333-4333-8333-333333333333", revision: 1,
      stageIdentity: { namespace: "gaep-managed-stage", stageKey: "stage.product-view", generation: 3, scopeDigest: digest("3") },
      subjects: [{ id: "44444444-4444-4444-8444-444444444444", subjectKey: "conflict.product-view", pathCandidate: "apps/vscode/src/product-view.ts",
        currentObservationState: "metadata-candidate", handoffObservationState: "metadata-candidate",
        findings: kinds.map((kind) => ({ kind, state: kind === "user-edit" ? "conflict-candidate" : "no-conflict-candidate" })) }],
      dependencyReceiptDigest: digest("4"), stageReceiptDigest: digest("5"), subjectReceiptDigest: digest("6"), observationReceiptDigest: digest("7"),
      conflictReceiptDigest: digest("8") },
  } as unknown as ChangeConflictDetectionProjection
}

describe("Product Studio Change Conflict Detection", () => {
  it("renders all five bounded findings without promoting no-conflict metadata to source or overwrite truth", () => {
    const table = changeConflictDetectionTable([projection()])
    expect(table.id).toBe("change-conflict-detection")
    expect(table.rows).toHaveLength(5)
    expect(table.rows.map((row) => row.cells.kind)).toEqual(["baseline-drift", "overlapping-stage", "provider-handoff", "stale-generation", "user-edit"])
    expect(table.rows.at(-1)?.cells).toMatchObject({ path: "apps/vscode/src/product-view.ts", kind: "user-edit", state: "conflict-candidate",
      currentObservation: "metadata-candidate", handoffObservation: "metadata-candidate" })
    expect(table.rows[0]?.cells.boundary).toContain("no-conflict candidate does not establish absence")
    expect(table.rows[0]?.cells.boundary).toContain("does not inspect or mutate source")
    expect(table.rows.every((row) => row.actions.length === 0)).toBe(true)
  })
  it("provides an explicit fail-closed empty and refresh state", () => {
    const table = changeConflictDetectionTable([])
    expect(table.emptyState?.title).toBe("No governed Change Conflict Detection candidate")
    expect(table.emptyState?.detail).toContain("Refresh Product Studio")
    expect(table.emptyState?.detail).toContain("cannot inspect or mutate source")
    expect(table.emptyState?.detail).toContain("overwrite user edits")
  })
})
