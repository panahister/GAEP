import type { BoilerplateConstraintEnforcementProjection } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { boilerplateConstraintEnforcementTable } from "./current-engine-studio-data-source.js"

const digest = (value: string) => `sha256:${value.repeat(64)}` as const

function projection(): BoilerplateConstraintEnforcementProjection {
  return {
    initiative: { id: "22222222-2222-4222-8222-222222222222", revision: 1, digest: digest("2"), state: "active" },
    status: {
      state: "candidate-defined", reviewState: "ready-for-human-review", staleBindingCount: 0,
      coverageGapCount: 0, ruleGapCount: 0,
    },
    candidate: {
      id: "33333333-3333-4333-8333-333333333333", revision: 1, policyKey: "policy.product-view",
      ruleKindCounts: { architecture: 1, component: 1, dependency: 1, module: 1, path: 1, route: 1, stack: 1, test: 1 },
      targets: [{
        id: "44444444-4444-4444-8444-444444444444", targetKey: "product-view", traceKey: "trace.product-view",
        implementationUnitId: "55555555-5555-4555-8555-555555555555", repositoryCandidate: "gaep-web",
        moduleCandidate: "product-studio", pathCandidate: "src/generated/product-view.tsx",
        applicableRuleCount: 8, violationCount: 0, enforcementState: "candidate-conformant",
      }],
      dependencyReceiptDigest: digest("3"), ruleCatalogDigest: digest("4"), targetCoverageDigest: digest("5"),
      violationReceiptDigest: digest("6"), policyReceiptDigest: digest("7"),
    },
  } as unknown as BoilerplateConstraintEnforcementProjection
}

describe("Product Studio Boilerplate Constraint Enforcement", () => {
  it("renders bounded policy coverage without promoting candidate conformance to implementation truth", () => {
    const table = boilerplateConstraintEnforcementTable([projection()])

    expect(table.id).toBe("boilerplate-constraint-enforcement")
    expect(table.rows).toHaveLength(1)
    expect(table.rows[0]?.cells).toMatchObject({
      policy: "policy.product-view",
      target: "product-view",
      trace: "trace.product-view",
      code: "gaep-web/product-studio/src/generated/product-view.tsx",
      violations: "0 candidate violation(s)",
      state: "candidate-conformant",
    })
    expect(table.rows[0]?.cells.rules).toContain("8 applicable")
    expect(table.rows[0]?.cells.rules).toContain("stack 1")
    expect(table.rows[0]?.cells.boundary).toContain("unverified candidates")
    expect(table.rows[0]?.cells.boundary).toContain("does not inspect repository")
    expect(table.rows[0]?.actions).toEqual([])
  })

  it("provides an explicit fail-closed empty and refresh state", () => {
    const table = boilerplateConstraintEnforcementTable([])

    expect(table.rows).toEqual([])
    expect(table.emptyState?.title).toBe("No governed Boilerplate Constraint Enforcement candidate")
    expect(table.emptyState?.detail).toContain("Refresh Product Studio")
    expect(table.emptyState?.detail).toContain("cannot inspect source or generated output")
  })
})
