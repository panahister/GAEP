import type { DesignToCodeTraceabilityProjection } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { designToCodeTraceabilityTable } from "./current-engine-studio-data-source.js"

const digest = (value: string) => `sha256:${value.repeat(64)}` as const

function projection(): DesignToCodeTraceabilityProjection {
  return {
    schemaVersion: 1,
    kind: "design-to-code-traceability-projection",
    product: {
      id: "11111111-1111-4111-8111-111111111111",
      revision: 3,
      digest: digest("1"),
    },
    initiative: {
      id: "22222222-2222-4222-8222-222222222222",
      revision: 2,
      digest: digest("2"),
      state: "active",
    },
    status: {
      schemaVersion: 1,
      kind: "design-to-code-traceability-status",
      productId: "11111111-1111-4111-8111-111111111111",
      productRevision: 3,
      initiativeId: "22222222-2222-4222-8222-222222222222",
      initiativeRevision: 2,
      candidate: {
        recordId: "33333333-3333-4333-8333-333333333333",
        revision: 1,
        digest: digest("3"),
      },
      traceCount: 1,
      generationTargetCount: 1,
      requirementCount: 2,
      backlogNodeCount: 1,
      acceptanceCriterionCount: 1,
      implementationUnitCount: 1,
      codePathCount: 1,
      associatedTestCount: 1,
      linkedCount: 1,
      gapCount: 0,
      conflictCount: 0,
      staleTraceCount: 0,
      staleBindingCount: 0,
      coverageGapCount: 0,
      evidenceGapCount: 0,
      invalidCandidateCount: 0,
      unresolvedQuestionCount: 0,
      reviewState: "ready-for-human-review",
      state: "candidate-defined",
      reasons: [],
      assessedAt: "2026-07-31T19:30:00.000Z",
      authorityBoundary: "design-to-code-traceability-status-is-observational-and-grants-no-design-source-repository-symbol-output-test-approval-acceptance-release-deployment-or-action-authority",
    },
    candidate: {
      id: "33333333-3333-4333-8333-333333333333",
      revision: 1,
      digest: digest("3"),
      state: "candidate",
      approvedExternalVersionDigest: digest("4"),
      baselineSemanticVersion: "1.2.0",
      traces: [{
        id: "44444444-4444-4444-8444-444444444444",
        traceKey: "trace.checkout-submit",
        generationTargetId: "55555555-5555-4555-8555-555555555555",
        generationTargetKey: "target.checkout-submit",
        designItemKey: "figma.checkout-submit",
        approvedExternalVersionDigest: digest("4"),
        baselineSemanticVersion: "1.2.0",
        requirementKeys: ["REQ-CHECKOUT-1", "REQ-CHECKOUT-2"],
        backlogNodeKeys: ["story.checkout-submit"],
        acceptanceCriterionKeys: ["criterion.checkout-submit"],
        implementationUnitId: "66666666-6666-4666-8666-666666666666",
        repositoryCandidate: "gaep",
        moduleCandidate: "vscode",
        pathCandidate: "apps/vscode/src/checkout-submit.ts",
        symbolCandidate: "CheckoutSubmit",
        associatedTestAssetKeys: ["test.checkout-submit"],
        traceState: "candidate-linked",
        evidenceReferenceCount: 2,
      }],
      dependencyReceiptDigest: digest("5"),
      designVersionReceiptDigest: digest("6"),
      traceCatalogDigest: digest("7"),
      coverageReceiptDigest: digest("8"),
      evidenceReceiptDigest: digest("9"),
      assessmentReceiptDigest: digest("a"),
      reviewState: "ready-for-human-review",
      updatedAt: "2026-07-31T19:30:00.000Z",
    },
    observedAt: "2026-07-31T19:30:00.000Z",
    privacyBoundary: "projection-contains-bounded-identities-versions-repository-relative-candidate-locations-test-keys-states-and-digests-only-not-design-or-source-content-generated-output-test-results-machine-paths-personal-data-secrets-credentials-or-permissions",
    authorityBoundary: "design-to-code-traceability-projection-is-read-only-and-grants-no-design-source-repository-symbol-output-test-approval-acceptance-release-deployment-or-action-authority",
    snapshotDigest: digest("b"),
  }
}

describe("Product Studio Design-to-Code Traceability", () => {
  it("renders bounded candidate links without promoting them to repository or acceptance truth", () => {
    const table = designToCodeTraceabilityTable([projection()])

    expect(table.id).toBe("design-to-code-traceability")
    expect(table.rows).toHaveLength(1)
    expect(table.rows[0]?.cells).toMatchObject({
      trace: "trace.checkout-submit",
      requirements: "REQ-CHECKOUT-1, REQ-CHECKOUT-2",
      backlog: "story.checkout-submit",
      acceptance: "criterion.checkout-submit",
      unit: "66666666-6666-4666-8666-666666666666",
      target: "target.checkout-submit",
      code: "gaep/vscode/apps/vscode/src/checkout-submit.ts · CheckoutSubmit",
      tests: "test.checkout-submit",
      state: "candidate-linked",
    })
    expect(table.rows[0]?.cells.boundary).toContain("unverified candidates")
    expect(table.rows[0]?.cells.boundary).toContain("does not expose design/source content")
    expect(table.rows[0]?.actions).toEqual([])
    expect(table.emptyState).toBeUndefined()
  })

  it("provides a bounded empty state with an explicit refresh path", () => {
    const table = designToCodeTraceabilityTable([])

    expect(table.rows).toEqual([])
    expect(table.emptyState?.title).toBe("No governed Design-to-Code Traceability candidate")
    expect(table.emptyState?.detail).toContain("Refresh Product Studio")
    expect(table.emptyState?.detail).toContain("cannot access Figma or source content")
  })
})
