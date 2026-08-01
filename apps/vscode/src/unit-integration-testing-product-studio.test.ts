import type { UnitIntegrationTestingProjection } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { unitIntegrationTestingTable } from "./current-engine-studio-data-source.js"

const digest = (value: string) => `sha256:${value.repeat(64)}` as const
function projection(): UnitIntegrationTestingProjection {
  return { initiative: { id: "22222222-2222-4222-8222-222222222222", revision: 1, digest: digest("2"), state: "active" },
    status: { state: "candidate-defined", definedSuiteCount: 1, gapSuiteCount: 0, conflictSuiteCount: 0, staleBindingCount: 0 },
    candidate: { id: "33333333-3333-4333-8333-333333333333", revision: 1,
      suites: [{ id: "44444444-4444-4444-8444-444444444444", suiteKey: "suite.product-view",
        implementationUnitId: "55555555-5555-4555-8555-555555555555", sourcePathCandidate: "apps/vscode/src/product-view.ts",
        testPathCandidate: "apps/vscode/src/product-view.test.ts", unitCaseCount: 1, integrationCaseCount: 1,
        frameworkCandidates: ["vitest"], environmentCandidates: ["node.isolated"], fixtureCandidateCount: 2,
        oracleCandidateCount: 2, coverageCandidateCount: 2, state: "candidate-defined" }],
      dependencyReceiptDigest: digest("3"), suiteReceiptDigest: digest("4"), caseReceiptDigest: digest("5"),
      fixtureOracleReceiptDigest: digest("6"), coverageReceiptDigest: digest("7") },
  } as unknown as UnitIntegrationTestingProjection
}

describe("Product Studio Unit and Integration Testing", () => {
  it("renders bounded suite metadata with no create, run, apply, approval, or acceptance actions", () => {
    const table = unitIntegrationTestingTable([projection()])
    expect(table.id).toBe("unit-integration-testing")
    expect(table.rows).toHaveLength(1)
    expect(table.rows[0]?.cells).toMatchObject({ sourcePath: "apps/vscode/src/product-view.ts", testPath: "apps/vscode/src/product-view.test.ts",
      unitCases: "1", integrationCases: "1", frameworks: "vitest", environments: "node.isolated", fixtures: "2", oracles: "2",
      coverage: "2", state: "candidate-defined" })
    expect(table.rows[0]?.cells.boundary).toContain("Local GAEP harness evidence remains separate from Product test truth")
    expect(table.rows[0]?.cells.boundary).toContain("does not inspect source")
    expect(table.rows[0]?.cells.boundary).toContain("execute Product tests")
    expect(table.rows[0]?.cells.boundary).toContain("security approval")
    expect(table.rows[0]?.actions).toEqual([])
    expect(table.actions).toEqual([])
  })

  it("provides an explicit fail-closed empty and refresh state", () => {
    const table = unitIntegrationTestingTable([])
    expect(table.emptyState?.title).toBe("No governed Unit and Integration Testing candidate")
    expect(table.emptyState?.detail).toContain("Refresh Product Studio")
    expect(table.emptyState?.detail).toContain("cannot inspect source")
    expect(table.emptyState?.detail).toContain("execute Product tests")
    expect(table.emptyState?.detail).toContain("security approval")
  })
})
