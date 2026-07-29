import { describe, expect, it } from "vitest"

import {
  designerReadyGateInputSchema,
  designerReadyGateProjectionSchema,
  designerReadyGateSchema,
  designerReadyGateStatusSchema,
  designerReadyPrerequisiteKeys,
  designerReadyPrerequisiteKinds,
  type DesignerReadyGateInput,
} from "./designer-ready-gate.js"

const digest = (value: string) => `sha256:${value.repeat(64).slice(0, 64)}`
const now = "2026-07-29T22:10:00Z"
const productId = "11111111-1111-4111-8111-111111111111"
const initiativeId = "22222222-2222-4222-8222-222222222222"
const sourceId = "33333333-3333-4333-8333-333333333333"

function input(overrides: Partial<DesignerReadyGateInput> = {}): DesignerReadyGateInput {
  return {
    initiativeId,
    context: {
      productRevision: 3,
      productDigest: digest("a"),
      initiativeRevision: 5,
      initiativeDigest: digest("b"),
    },
    informationClassification: "internal",
    title: "Designer readiness review candidate",
    objectiveDigest: digest("c"),
    prerequisites: designerReadyPrerequisiteKeys.map((key, index) => ({
      key,
      kind: designerReadyPrerequisiteKinds[key],
      recordId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      revision: 1,
      digest: digest(((index + 1) % 10).toString()),
      membershipDigest: digest(((index + 2) % 10).toString()),
      assessmentDigest: digest(((index + 3) % 10).toString()),
      assessmentState: "complete-for-review",
    })),
    evaluations: designerReadyPrerequisiteKeys.map((prerequisiteKey, index) => ({
      prerequisiteKey,
      evaluationState: "satisfied-candidate",
      freshness: "current",
      evidenceState: "human-reviewed",
      criteriaDigest: digest(((index + 4) % 10).toString()),
      evidenceDigests: [digest(((index + 5) % 10).toString())],
      sources: [{
        sourceId,
        sourceRevision: 1,
        recordDigest: digest("d"),
        contentDigest: digest("e"),
      }],
      reviewedBy: { kind: "human", id: "design-reviewer" },
      reviewedAt: now,
    })),
    exceptions: [],
    assessmentDefinitionDigest: digest("f"),
    assessmentReceiptDigest: digest("1"),
    candidateResult: "pass-candidate",
    unresolvedQuestions: [],
    limitations: ["This evaluation candidate is not permission or readiness."],
    reviewState: "ready-for-human-decision",
    designCompletenessState: "not-established",
    externalCompletenessState: "not-established",
    designValidityState: "not-established",
    designApprovalState: "not-established",
    designBaselineState: "not-established",
    readinessState: "not-established",
    exceptionAuthorityState: "not-granted",
    figmaConnectionAuthorityState: "not-granted",
    credentialAuthorityState: "not-granted",
    permissionGrantState: "not-granted",
    importExecutionState: "not-performed",
    writeExecutionState: "not-performed",
    implementationAuthorityState: "not-granted",
    ...overrides,
  }
}

describe("Designer-Ready Gate contract", () => {
  it("accepts one exact current human-reviewed evaluation for every canonical prerequisite", () => {
    const parsed = designerReadyGateInputSchema.parse(input())
    expect(parsed.prerequisites.map((entry) => entry.key)).toEqual(designerReadyPrerequisiteKeys)
    expect(parsed.candidateResult).toBe("pass-candidate")
    expect(parsed.readinessState).toBe("not-established")
  })

  it("rejects missing, reordered, mismatched, or stale positive prerequisites", () => {
    const missing = input()
    missing.prerequisites = missing.prerequisites.slice(1)
    expect(designerReadyGateInputSchema.safeParse(missing).success).toBe(false)

    const mismatched = input()
    mismatched.prerequisites[0] = { ...mismatched.prerequisites[0]!, kind: "decision-register-candidate" }
    expect(designerReadyGateInputSchema.safeParse(mismatched).success).toBe(false)

    const stale = input()
    stale.evaluations[0] = { ...stale.evaluations[0]!, freshness: "stale" }
    expect(designerReadyGateInputSchema.safeParse(stale).success).toBe(false)

    const attention = input()
    attention.prerequisites[0] = { ...attention.prerequisites[0]!, assessmentState: "attention-required" }
    expect(designerReadyGateInputSchema.safeParse(attention).success).toBe(false)
  })

  it("requires attributable evidence and bounded exception candidates without granting waiver authority", () => {
    const conditional = input({
      candidateResult: "conditional-pass-candidate",
      exceptions: [{
        key: "accessibility-review-window",
        prerequisiteKey: "accessibility-design-rules",
        state: "granted-candidate",
        decisionKey: "designer-gate-exception",
        rationaleDigest: digest("2"),
        evidenceDigests: [digest("3")],
        sources: [{ sourceId, sourceRevision: 1, recordDigest: digest("d"), contentDigest: digest("e") }],
        decidedBy: { kind: "human", id: "accountable-decision-owner" },
        decidedAt: now,
        validUntil: "2026-08-05T22:10:00Z",
      }],
    })
    expect(designerReadyGateInputSchema.parse(conditional).exceptionAuthorityState).toBe("not-granted")

    const unbounded = structuredClone(conditional)
    delete unbounded.exceptions[0]!.validUntil
    expect(designerReadyGateInputSchema.safeParse(unbounded).success).toBe(false)

    const unconditional = structuredClone(conditional)
    unconditional.candidateResult = "pass-candidate"
    expect(designerReadyGateInputSchema.safeParse(unconditional).success).toBe(false)
  })

  it("rejects inferred readiness, missing limitations, secrets, and non-candidate authority", () => {
    const noLimit = input({ limitations: [] })
    expect(designerReadyGateInputSchema.safeParse(noLimit).success).toBe(false)

    const secret = { ...input(), token: "ghp_123456789012345678901234567890123456" }
    expect(designerReadyGateInputSchema.safeParse(secret).success).toBe(false)

    const inferred = { ...input(), readinessState: "ready" }
    expect(designerReadyGateInputSchema.safeParse(inferred).success).toBe(false)

    const record = {
      ...input(),
      schemaVersion: 1,
      kind: "designer-ready-gate-candidate",
      id: "44444444-4444-4444-8444-444444444444",
      productId,
      revision: 1,
      membershipDigest: digest("4"),
      state: "candidate",
      createdBy: { kind: "human", id: "design-reviewer" },
      updatedBy: { kind: "human", id: "design-reviewer" },
      createdAt: now,
      updatedAt: now,
      gateBoundary: "a-passing-designer-ready-gate-candidate-is-an-evaluation-result-not-permission-or-readiness",
      authorityBoundary: "designer-ready-gate-is-a-candidate-evaluation-and-does-not-establish-design-completeness-external-completeness-design-validity-approval-baseline-readiness-exception-waiver-acceptance-phase-entry-implementation-write-import-or-action-authority",
    }
    expect(designerReadyGateSchema.parse(record).revision).toBe(1)
    expect(designerReadyGateSchema.safeParse({ ...record, state: "approved" }).success).toBe(false)
  })

  it("keeps status and projection exact, privacy-safe, and non-authoritative", () => {
    const status = designerReadyGateStatusSchema.parse({
      schemaVersion: 1,
      kind: "designer-ready-gate-status",
      productId,
      productRevision: 3,
      initiativeId,
      initiativeRevision: 5,
      candidate: { recordId: "44444444-4444-4444-8444-444444444444", revision: 1, digest: digest("5") },
      prerequisiteCount: designerReadyPrerequisiteKeys.length,
      satisfiedCount: designerReadyPrerequisiteKeys.length,
      notApplicableCount: 0,
      unsatisfiedCount: 0,
      notAssessedCount: 0,
      staleOrUnknownCount: 0,
      humanReviewedCount: designerReadyPrerequisiteKeys.length,
      pendingExceptionCount: 0,
      grantedExceptionCandidateCount: 0,
      invalidExceptionCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      unresolvedQuestionCount: 0,
      candidateResult: "pass-candidate",
      reviewState: "ready-for-human-decision",
      state: "complete-for-human-decision",
      reasons: [],
      assessedAt: now,
      gateBoundary: "a-passing-designer-ready-gate-candidate-is-an-evaluation-result-not-permission-or-readiness",
      authorityBoundary: "designer-ready-gate-status-is-observational-and-does-not-establish-design-completeness-external-completeness-design-validity-approval-baseline-readiness-exception-waiver-acceptance-phase-entry-implementation-write-import-or-action-authority",
    })
    const projection = designerReadyGateProjectionSchema.parse({
      schemaVersion: 1,
      kind: "designer-ready-gate-projection",
      product: { id: productId, revision: 3, digest: digest("a") },
      initiative: { id: initiativeId, revision: 5, digest: digest("b"), state: "active" },
      status,
      observedAt: now,
      privacyBoundary: "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-criteria-findings-exception-rationale-decision-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions",
      authorityBoundary: "designer-ready-gate-projection-is-read-only-and-does-not-establish-design-completeness-external-completeness-design-validity-approval-baseline-readiness-exception-waiver-acceptance-phase-entry-implementation-write-import-or-action-authority",
      snapshotDigest: digest("6"),
    })
    expect(projection.status.state).toBe("complete-for-human-decision")
    expect(JSON.stringify(projection)).not.toContain("design-reviewer")
  })
})
