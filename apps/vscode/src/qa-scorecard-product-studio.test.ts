import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import { qaScorecardDimensionIds, qaScorecardProjectionSchema } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { qaScorecardTable } from "./current-engine-studio-data-source.js"

const product = { id: randomUUID(), revision: 1 }
const initiative = { id: randomUUID(), revision: 1, state: "active" as const }
const evidenceCatalogDigest = canonicalDigest({ evidence: true })
function projection() {
  const body = {
    schemaVersion: 1 as const,
    kind: "qa-scorecard-projection" as const,
    product: { ...product, digest: canonicalDigest(product) },
    initiative: { ...initiative, digest: canonicalDigest(initiative) },
    status: { schemaVersion: 1 as const, kind: "qa-scorecard-status" as const, productId: product.id, productRevision: 1,
      initiativeId: initiative.id, initiativeRevision: 1, candidate: { recordId: randomUUID(), revision: 1, digest: canonicalDigest({ scorecard: true }) },
      dimensionCount: 10 as const, successCount: 8, failureCount: 0, missingCount: 0, staleCount: 1, notAssessedCount: 1,
      evidenceCount: 10, unresolvedGapCount: 2, reviewState: "held" as const, state: "attention-required" as const,
      reasons: ["Stale visual evidence", "Human validation is not assessed"], assessedAt: "2026-08-01T09:24:15.000Z",
      authorityBoundary: "qa-scorecard-status-is-observational-and-grants-no-product-truth-human-validation-security-approval-product-owner-acceptance-release-deployment-or-action-authority" as const },
    candidate: { id: randomUUID(), revision: 1, digest: canonicalDigest({ candidate: true }), dimensions: qaScorecardDimensionIds.map((id, index) => ({
      id, ordinal: index + 1, state: index === 5 ? "stale" as const : index === 9 ? "not-assessed" as const : "success" as const,
      evidenceCount: 1, gapCount: index === 5 || index === 9 ? 1 : 0, limitationCount: 1,
      localAutomationState: index === 5 || index === 9 ? "not-run" as const : "passed" as const, humanValidationState: "not-established" as const })),
      evidenceCatalogDigest, dimensionReceiptDigest: canonicalDigest({ dimensions: true }), gapReceiptDigest: canonicalDigest({ gaps: true }),
      assessmentReceiptDigest: canonicalDigest({ assessment: true }), reviewState: "held" as const, updatedAt: "2026-08-01T09:24:15.000Z" },
    observedAt: "2026-08-01T09:24:15.000Z",
    privacyBoundary: "projection-contains-bounded-dimension-evidence-identities-repository-relative-paths-digests-counts-times-states-gaps-and-receipts-only-not-test-output-source-code-product-content-personal-data-secrets-credentials-permissions-or-machine-paths" as const,
    authorityBoundary: "qa-scorecard-projection-is-read-only-and-grants-no-product-truth-human-validation-security-approval-product-owner-acceptance-release-deployment-or-action-authority" as const,
  }
  return qaScorecardProjectionSchema.parse({ ...body, snapshotDigest: canonicalDigest(body) })
}

describe("Product Studio QA scorecard", () => {
  it("renders every dimension with explicit fail-closed evidence and human boundaries", () => {
    const table = qaScorecardTable([projection()])
    expect(table.id).toBe("qa-scorecard")
    expect(table.rows).toHaveLength(10)
    expect(table.rows.map((row) => row.cells.dimension)).toEqual(qaScorecardDimensionIds)
    expect(table.rows[5]?.cells).toMatchObject({ state: "stale", gaps: "1", humanValidation: "not-established" })
    expect(table.rows[9]?.cells).toMatchObject({ state: "not-assessed", gaps: "1" })
    expect(table.rows.every((row) => row.actions.length === 0 && row.cells.boundary?.includes("not Product truth"))).toBe(true)
  })

  it("renders an explanatory no-action empty state", () => {
    const table = qaScorecardTable([])
    expect(table.rows).toEqual([])
    expect(table.emptyState).toMatchObject({ title: "No governed multi-dimensional QA scorecard" })
    expect(table.actions).toEqual([])
  })
})
