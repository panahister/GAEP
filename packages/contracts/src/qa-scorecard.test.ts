import { randomUUID } from "node:crypto"
import { describe, expect, it } from "vitest"

import { qaScorecardDimensionIds, qaScorecardInputSchema, type QaScorecardInput } from "./qa-scorecard.js"

const digest = (value: string) => `sha256:${value.repeat(64)}` as const
function fixture(): QaScorecardInput {
  const dimensions = qaScorecardDimensionIds.map((id, index) => ({
    id,
    ordinal: index + 1,
    state: "success" as const,
    evidence: [{ id: randomUUID(), dimensionId: id, kind: ([
      "local-functional-gate", "local-unit-integration-gate", "local-e2e-receipt", "local-security-report", "local-accessibility-report",
      "local-visual-fixture-report", "local-performance-report", "local-reliability-report", "trace-coverage-candidate", "gap-register",
    ] as const)[index]!, artifactId: `p3b24.${id}`, artifactPath: `evidence/vscode-checkpoints/${id}.json`, artifactDigest: digest(String((index % 9) + 1)),
      sourceCheckpoint: "063e5d12", observedAt: "2026-08-01T09:24:15.000Z", outcome: "success" as const, freshness: "current" as const,
      testCount: index === 9 ? 0 : 1, skippedCount: 0, limitationCount: 1, localExecutionOnly: true as const, acceptanceState: "not-established" as const }],
    gapKeys: [], reasons: ["Bounded local evidence is current"], localAutomationState: "passed" as const,
    humanValidationState: "not-established" as const, productOwnerAcceptanceState: "not-established" as const,
  }))
  return { initiativeId: randomUUID(), context: { productRevision: 1, productDigest: digest("a"), initiativeRevision: 1, initiativeDigest: digest("b") },
    informationClassification: "internal", title: "Local multi-dimensional QA scorecard", dimensions, unresolvedGapKeys: [],
    limitations: ["Local deterministic evidence does not establish Product truth or human acceptance"], reviewState: "ready-for-human-review",
    assessedBy: { kind: "human", id: "qa-reviewer" }, assessedAt: "2026-08-01T09:24:15.000Z", productTruthState: "not-established",
    nativeHumanAcceptanceState: "not-established", securityApprovalState: "not-established", productOwnerAcceptanceState: "not-established",
    releaseReadinessState: "not-established", deploymentReadinessState: "not-established", actionAuthorityState: "not-granted" }
}

describe("QA scorecard contract", () => {
  it("accepts all ten exact local evidence dimensions without synthesizing acceptance", () => {
    const parsed = qaScorecardInputSchema.parse(fixture())
    expect(parsed.dimensions).toHaveLength(10)
    expect(parsed.productOwnerAcceptanceState).toBe("not-established")
    expect(parsed.actionAuthorityState).toBe("not-granted")
  })

  it("distinguishes missing, failed, stale, and not-assessed dimensions", () => {
    for (const state of ["missing", "failure", "stale", "not-assessed"] as const) {
      const value = fixture(), dimension = value.dimensions[0]!
      if (state === "missing") Object.assign(dimension, { state, evidence: [], localAutomationState: "not-run", gapKeys: ["gap.functional-missing"] })
      if (state === "failure") Object.assign(dimension, { state, evidence: dimension.evidence.map((item) => ({ ...item, outcome: "failure" as const })), localAutomationState: "failed", gapKeys: ["gap.functional-failed"] })
      if (state === "stale") Object.assign(dimension, { state, evidence: dimension.evidence.map((item) => ({ ...item, freshness: "stale" as const })), localAutomationState: "not-run", gapKeys: ["gap.functional-stale"] })
      if (state === "not-assessed") Object.assign(dimension, { state, evidence: dimension.evidence.map((item) => ({ ...item, outcome: "not-assessed" as const })), localAutomationState: "not-run", gapKeys: ["gap.functional-not-assessed"] })
      value.unresolvedGapKeys = [...dimension.gapKeys]
      value.reviewState = state === "missing" || state === "stale" ? "held" : "ready-for-human-review"
      expect(qaScorecardInputSchema.parse(value).dimensions[0]?.state).toBe(state)
    }
  })

  it("rejects incomplete catalogs, mismatched evidence, false success, gap drift, traversal, unknown fields, and secrets", () => {
    const value = fixture()
    expect(qaScorecardInputSchema.safeParse({ ...value, dimensions: value.dimensions.slice(1) }).success).toBe(false)
    expect(qaScorecardInputSchema.safeParse({ ...value, dimensions: value.dimensions.map((dimension, index) => index ? dimension : { ...dimension, evidence: dimension.evidence.map((item) => ({ ...item, dimensionId: "security" as const })) }) }).success).toBe(false)
    expect(qaScorecardInputSchema.safeParse({ ...value, dimensions: value.dimensions.map((dimension, index) => index ? dimension : { ...dimension, gapKeys: ["gap.false-success"] }), unresolvedGapKeys: ["gap.false-success"] }).success).toBe(false)
    expect(qaScorecardInputSchema.safeParse({ ...value, unresolvedGapKeys: ["gap.unbound"] }).success).toBe(false)
    expect(qaScorecardInputSchema.safeParse({ ...value, dimensions: value.dimensions.map((dimension, index) => index ? dimension : { ...dimension, evidence: dimension.evidence.map((item) => ({ ...item, artifactPath: "../secret.json" })) }) }).success).toBe(false)
    expect(qaScorecardInputSchema.safeParse({ ...value, unexpected: true }).success).toBe(false)
    expect(qaScorecardInputSchema.safeParse({ ...value, limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false)
  })
})
