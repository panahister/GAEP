import type { TestGenerationProjection } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { testGenerationTable } from "./current-engine-studio-data-source.js"

const digest = (value: string) => `sha256:${value.repeat(64)}` as const
function projection(): TestGenerationProjection {
  return { initiative: { id: "22222222-2222-4222-8222-222222222222", revision: 1, digest: digest("2"), state: "active" },
    status: { state: "candidate-defined", definedCount: 1, gapCount: 0, conflictCount: 0, staleBindingCount: 0 },
    candidate: { id: "33333333-3333-4333-8333-333333333333", revision: 1,
      targets: [{ id: "44444444-4444-4444-8444-444444444444", targetKey: "test.product-view",
        sourcePathCandidate: "apps/vscode/src/product-view.ts", testPathCandidate: "apps/vscode/src/product-view.test.ts",
        sourceSymbolCandidate: "ProductView", testSymbolCandidate: "ProductView tests", testKind: "unit", frameworkCandidate: "vitest",
        fixtureCandidateCount: 1, oracleCandidateCount: 2, coverageTraceCount: 3, riskTraceCount: 1, state: "candidate-defined" }],
      dependencyReceiptDigest: digest("3"), targetCatalogDigest: digest("4"), pathSymbolReceiptDigest: digest("5"),
      fixtureOracleReceiptDigest: digest("6"), traceReceiptDigest: digest("7") },
  } as unknown as TestGenerationProjection
}

describe("Product Studio Test Generation", () => {
  it("renders bounded planning metadata with no generate, run, apply, or acceptance actions", () => {
    const table = testGenerationTable([projection()])
    expect(table.id).toBe("test-generation")
    expect(table.rows).toHaveLength(1)
    expect(table.rows[0]?.cells).toMatchObject({ sourcePath: "apps/vscode/src/product-view.ts", testPath: "apps/vscode/src/product-view.test.ts",
      kind: "unit", framework: "vitest", fixtures: "1", oracles: "2", coverage: "3", risks: "1", state: "candidate-defined" })
    expect(table.rows[0]?.cells.boundary).toContain("does not inspect source")
    expect(table.rows[0]?.cells.boundary).toContain("generate or execute tests")
    expect(table.rows[0]?.cells.boundary).toContain("approval or acceptance")
    expect(table.rows[0]?.actions).toEqual([])
    expect(table.actions).toEqual([])
  })
  it("provides an explicit fail-closed empty and refresh state", () => {
    const table = testGenerationTable([])
    expect(table.emptyState?.title).toBe("No governed Test Generation candidate")
    expect(table.emptyState?.detail).toContain("Refresh Product Studio")
    expect(table.emptyState?.detail).toContain("cannot inspect source")
    expect(table.emptyState?.detail).toContain("generate or execute tests")
  })
})
