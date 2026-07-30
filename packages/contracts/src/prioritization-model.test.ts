import { randomUUID } from "node:crypto"

import { describe, expect, it } from "vitest"

import { prioritizationModelInputSchema } from "./prioritization-model.js"

const digest = `sha256:${"1".repeat(64)}`

function candidate() {
  const sliceId = randomUUID()
  const estimate = (kind: "value-hypothesis" | "risk-register" | "dependency-analysis" | "cost-estimate") => ({
    state: "candidate-estimate" as const,
    score: 50,
    evidence: [{ kind, recordId: randomUUID(), revision: 1, digest }],
    uncertainty: [],
  })
  return {
    initiativeId: randomUUID(),
    context: { productRevision: 1, productDigest: digest, initiativeRevision: 1, initiativeDigest: digest },
    informationClassification: "internal" as const,
    title: "Explainable candidate ordering",
    mvpSliceDefinition: { recordId: randomUUID(), revision: 1, digest },
    method: {
      key: "weighted.value-risk-dependency-cost",
      version: "1.0",
      calculation: "weighted-sum-v1" as const,
      normalization: "zero-to-one-hundred" as const,
      weights: { value: 40, riskReduction: 30, dependencyEnablement: 20, costSize: 10 },
      tieBreaker: "slice-ordinal-ascending" as const,
    },
    subjects: [{
      sliceId, sliceKey: "atlas.first.slice", ordinal: 1,
      value: estimate("value-hypothesis"),
      riskReduction: estimate("risk-register"),
      dependencyEnablement: estimate("dependency-analysis"),
      costSize: estimate("cost-estimate"),
    }],
    unresolvedQuestions: [],
    limitations: ["Candidate scoring does not establish priority authority."],
    reviewState: "ready-for-human-review" as const,
    evidenceValidityState: "not-established" as const,
    priorityDecisionState: "not-established" as const,
    commitmentState: "not-established" as const,
    scopeDecisionState: "not-established" as const,
    approvalState: "not-established" as const,
    acceptanceCriteriaValidityState: "not-established" as const,
    readyDoneState: "not-established" as const,
    implementationReadinessState: "not-established" as const,
    assignmentExecutionState: "not-established" as const,
    implementationAuthorityState: "not-granted" as const,
  }
}

describe("Prioritization Model contracts", () => {
  it("accepts an exact, explainable candidate without priority authority", () => {
    expect(prioritizationModelInputSchema.parse(candidate())).toMatchObject({
      reviewState: "ready-for-human-review",
      priorityDecisionState: "not-established",
      implementationAuthorityState: "not-granted",
    })
  })

  it("rejects invalid weights and review-ready incomplete estimates", () => {
    const invalidWeights = candidate()
    invalidWeights.method.weights.value = 39
    expect(prioritizationModelInputSchema.safeParse(invalidWeights).success).toBe(false)

    const incomplete = candidate()
    incomplete.subjects[0]!.value = { state: "not-assessed", evidence: [], uncertainty: [] } as never
    expect(prioritizationModelInputSchema.safeParse(incomplete).success).toBe(false)
  })

  it("rejects secret-shaped candidate content", () => {
    const secret = candidate()
    secret.limitations = ["api_key=sk-test-12345678901234567890"]
    expect(prioritizationModelInputSchema.safeParse(secret).success).toBe(false)
  })
})
