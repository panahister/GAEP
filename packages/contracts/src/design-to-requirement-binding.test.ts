import { describe, expect, it } from "vitest"

import {
  designToRequirementBindingInputSchema,
  designToRequirementBindingSchema,
  designToRequirementBindingStatusSchema,
  type DesignToRequirementBindingInput,
} from "./design-to-requirement-binding.js"

const digest = (value: string) => `sha256:${value.repeat(64)}`
const source = {
  sourceId: "11111111-1111-4111-8111-111111111111", sourceRevision: 1,
  recordDigest: digest("1"), contentDigest: digest("2"),
} as const

function input(): DesignToRequirementBindingInput {
  return {
    initiativeId: "22222222-2222-4222-8222-222222222222",
    context: { productRevision: 7, productDigest: digest("3"), initiativeRevision: 3, initiativeDigest: digest("4") },
    informationClassification: "internal",
    title: "Customer portal design binding registry",
    objectiveDigest: digest("5"),
    finalizedSnapshot: {
      recordId: "33333333-3333-4333-8333-333333333333", revision: 2, digest: digest("6"),
      membershipDigest: digest("7"), itemCatalogDigest: digest("8"),
    },
    designRequirements: {
      recordId: "44444444-4444-4444-8444-444444444444", revision: 3, digest: digest("9"),
      membershipDigest: digest("a"), requirementCatalogDigest: digest("b"),
    },
    decisionRegister: {
      recordId: "55555555-5555-4555-8555-555555555555", revision: 4, digest: digest("c"),
      membershipDigest: digest("d"), decisionCatalogDigest: digest("e"),
    },
    bindings: [{
      key: "portal-component-binding", designItemKey: "customer-portal-component", designItemKind: "component",
      requirementKeys: ["PORTAL-REQ-001"], decisionKeys: ["approve-portal-layout"],
      requirementRelationship: "addresses", decisionRelationship: "implements-outcome",
      provenanceDigest: digest("f"), evidenceState: "human-reviewed", evidenceDigests: [digest("1")],
      reviewedBy: { kind: "human", id: "Design trace reviewer" }, reviewedAt: "2026-07-29T21:00:00.000Z",
      sources: [source],
    }],
    designItemCoverage: [{
      itemKey: "customer-portal-component", state: "bound-candidate", bindingKeys: ["portal-component-binding"],
      rationaleDigest: digest("2"), sources: [source],
    }],
    subjectCoverage: [{
      subjectType: "decision", subjectKey: "approve-portal-layout", state: "bound-candidate",
      bindingKeys: ["portal-component-binding"], rationaleDigest: digest("3"), sources: [source],
    }, {
      subjectType: "requirement", subjectKey: "PORTAL-REQ-001", state: "bound-candidate",
      bindingKeys: ["portal-component-binding"], rationaleDigest: digest("4"), sources: [source],
    }],
    conflicts: [], reconciliationDigest: digest("5"), reconciliationState: "exact",
    candidateCoverageState: "candidate-complete", provenanceState: "exact", unresolvedQuestions: [],
    limitations: ["Bindings remain review candidates and do not prove relationship truth or coverage completeness"],
    reviewState: "ready-for-human-review", relationshipTruthState: "not-established",
    coverageCompletenessState: "not-established", requirementSatisfactionState: "not-established",
    decisionEffectivenessState: "not-established", externalCompletenessState: "not-established",
    designValidityState: "not-established", designApprovalState: "not-established",
    designBaselineState: "not-established", readinessState: "not-established",
    figmaConnectionAuthorityState: "not-granted", credentialAuthorityState: "not-granted",
    permissionGrantState: "not-granted", importExecutionState: "not-performed",
    writeExecutionState: "not-performed", implementationAuthorityState: "not-granted",
  }
}

describe("Design-to-Requirement Binding contract", () => {
  it("accepts exact candidate links without relationship, approval, or action authority", () => {
    expect(designToRequirementBindingInputSchema.parse(input())).toMatchObject({
      reconciliationState: "exact", relationshipTruthState: "not-established",
    })
    expect(designToRequirementBindingSchema.parse({
      schemaVersion: 1, kind: "design-to-requirement-binding-candidate",
      id: "66666666-6666-4666-8666-666666666666", productId: "77777777-7777-4777-8777-777777777777",
      ...input(), revision: 1, membershipDigest: digest("6"), state: "candidate",
      createdBy: { kind: "human", id: "Binding author" }, updatedBy: { kind: "human", id: "Binding author" },
      createdAt: "2026-07-29T21:00:00.000Z", updatedAt: "2026-07-29T21:00:00.000Z",
      authorityBoundary: "design-to-requirement-binding-is-a-review-candidate-and-does-not-establish-relationship-truth-coverage-completeness-requirement-satisfaction-decision-effectiveness-external-completeness-design-validity-or-approval-baseline-readiness-implementation-write-import-or-action-authority",
    })).toMatchObject({ revision: 1, state: "candidate" })
  })

  it("rejects one-sided coverage and mismatched subject references", () => {
    const item: any = structuredClone(input())
    item.designItemCoverage[0].bindingKeys = []
    expect(designToRequirementBindingInputSchema.safeParse(item).success).toBe(false)

    const subject: any = structuredClone(input())
    subject.subjectCoverage[1].subjectKey = "PORTAL-REQ-999"
    expect(designToRequirementBindingInputSchema.safeParse(subject).success).toBe(false)
  })

  it("rejects invented human review, exclusion, non-applicability, and conflict resolution", () => {
    const review: any = structuredClone(input())
    delete review.bindings[0].reviewedBy
    expect(designToRequirementBindingInputSchema.safeParse(review).success).toBe(false)

    const conflict: any = structuredClone(input())
    conflict.conflicts = [{ key: "missing-requirement", kind: "requirement-gap", state: "resolved", subjectDigest: digest("1"), rationaleDigest: digest("2"), evidenceDigests: [], sources: [source] }]
    expect(designToRequirementBindingInputSchema.safeParse(conflict).success).toBe(false)
  })

  it("rejects review readiness while evidence, decisions, conflicts, or coverage gaps remain", () => {
    const hostile: any = structuredClone(input())
    hostile.bindings[0].decisionKeys = []
    delete hostile.bindings[0].decisionRelationship
    hostile.subjectCoverage = hostile.subjectCoverage.slice(1)
    expect(designToRequirementBindingInputSchema.safeParse(hostile).success).toBe(false)
  })

  it("requires attention statuses to expose reasons and complete statuses to have no gaps", () => {
    const base = {
      schemaVersion: 1, kind: "design-to-requirement-binding-status",
      productId: "77777777-7777-4777-8777-777777777777", productRevision: 7,
      initiativeId: input().initiativeId, initiativeRevision: 3,
      bindingCount: 1, humanReviewedBindingCount: 1, designItemCount: 1, boundDesignItemCount: 1,
      unboundDesignItemCount: 0, requirementCount: 1, boundRequirementCount: 1, unboundRequirementCount: 0,
      decisionCount: 1, boundDecisionCount: 1, unboundDecisionCount: 0, openConflictCount: 0,
      staleBindingCount: 0, staleSourceReferenceCount: 0, unresolvedQuestionCount: 0,
      reconciliationState: "exact", candidateCoverageState: "candidate-complete", provenanceState: "exact",
      reviewState: "ready-for-human-review", reasons: [], assessedAt: "2026-07-29T21:00:00.000Z",
      authorityBoundary: "design-to-requirement-binding-status-is-observational-and-does-not-establish-relationship-truth-coverage-completeness-requirement-satisfaction-decision-effectiveness-external-completeness-design-validity-or-approval-baseline-readiness-implementation-write-import-or-action-authority",
    }
    expect(designToRequirementBindingStatusSchema.safeParse({ ...base, state: "attention-required" }).success).toBe(false)
    expect(designToRequirementBindingStatusSchema.safeParse({
      ...base, state: "complete-for-review",
      candidate: { recordId: "66666666-6666-4666-8666-666666666666", revision: 1, digest: digest("6") },
    }).success).toBe(true)
  })

  it("rejects secret-shaped fields", () => {
    const hostile: any = structuredClone(input())
    hostile.apiToken = "figd_live_abcdefghijklmnopqrstuvwxyz1234567890"
    expect(designToRequirementBindingInputSchema.safeParse(hostile).success).toBe(false)
  })
})
