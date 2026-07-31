import type { BacklogToCodeTraceabilityProjection } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { backlogToCodeTraceabilityTable } from "./current-engine-studio-data-source.js"

const digest = (value: string) => `sha256:${value.repeat(64)}` as const

function projection(): BacklogToCodeTraceabilityProjection {
  return {
    initiative: { id: "22222222-2222-4222-8222-222222222222", revision: 1, digest: digest("2"), state: "active" },
    status: {
      state: "candidate-defined", reviewState: "ready-for-human-review", staleBindingCount: 0,
      coverageGapCount: 0, invalidCandidateCount: 0,
    },
    candidate: {
      id: "33333333-3333-4333-8333-333333333333", revision: 1,
      traces: [{
        id: "44444444-4444-4444-8444-444444444444", traceKey: "trace.story-product-view",
        backlogNodeKey: "story.product-view", repositoryCandidate: "gaep-web",
        moduleCandidate: "product-studio", pathCandidate: "src/product-view.tsx", symbolCandidate: "ProductView",
        testAssetKeys: ["test.product-view"], commitCandidateCount: 2, traceState: "candidate-linked",
      }],
      dependencyReceiptDigest: digest("3"), traceCatalogDigest: digest("4"),
      commitCandidateReceiptDigest: digest("5"), testCoverageReceiptDigest: digest("6"),
      evidenceReceiptDigest: digest("7"), assessmentReceiptDigest: digest("8"),
    },
  } as unknown as BacklogToCodeTraceabilityProjection
}

describe("Product Studio Backlog-to-Code Traceability", () => {
  it("renders bounded backlog, code, commit, and test candidates without promoting implementation truth", () => {
    const table = backlogToCodeTraceabilityTable([projection()])

    expect(table.id).toBe("backlog-to-code-traceability")
    expect(table.rows).toHaveLength(1)
    expect(table.rows[0]?.cells).toMatchObject({
      trace: "trace.story-product-view",
      backlog: "story.product-view",
      code: "gaep-web/product-studio/src/product-view.tsx · ProductView",
      tests: "test.product-view",
      commits: "2 bounded candidate(s) · truth not established",
      state: "candidate-linked",
    })
    expect(table.rows[0]?.cells.boundary).toContain("unverified candidates")
    expect(table.rows[0]?.cells.boundary).toContain("does not inspect source or commits")
    expect(table.rows[0]?.actions).toEqual([])
  })

  it("provides an explicit fail-closed empty and refresh state", () => {
    const table = backlogToCodeTraceabilityTable([])

    expect(table.rows).toEqual([])
    expect(table.emptyState?.title).toBe("No governed Backlog-to-Code Traceability candidate")
    expect(table.emptyState?.detail).toContain("Refresh Product Studio")
    expect(table.emptyState?.detail).toContain("cannot inspect source or commits")
  })
})
