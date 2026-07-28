import { describe, expect, it } from "vitest"

import {
  accessibilityDesignRulesInputSchema,
  accessibilityDesignRulesProjectionSchema,
  accessibilityDesignRulesSchema,
  accessibilityDesignRulesStatusSchema,
  type AccessibilityDesignRulesInput,
} from "./accessibility-design-rules.js"

const productId = "11111111-1111-4111-8111-111111111111"
const initiativeId = "22222222-2222-4222-8222-222222222222"
const candidateId = "33333333-3333-4333-8333-333333333333"
const inventoryId = "44444444-4444-4444-8444-444444444444"
const requirementsId = "55555555-5555-4555-8555-555555555555"
const designSystemId = "66666666-6666-4666-8666-666666666666"
const sourceId = "77777777-7777-4777-8777-777777777777"
const observedAt = "2026-07-28T14:00:00.000Z"
const reviewer = { kind: "human" as const, id: "accessibility-reviewer" }
const owner = { state: "assigned-candidate" as const, owner: { kind: "role" as const, id: "product-designer" } }

function digest(value: string) {
  return `sha256:${value.repeat(64)}`
}

function source() {
  return { sourceId, sourceRevision: 1, recordDigest: digest("a"), contentDigest: digest("b") }
}

function input(): AccessibilityDesignRulesInput {
  return {
    initiativeId,
    context: {
      productRevision: 4,
      productDigest: digest("c"),
      initiativeRevision: 7,
      initiativeDigest: digest("d"),
    },
    informationClassification: "internal",
    title: "Customer portal Accessibility Design Rules candidate",
    screenStateInventory: { recordId: inventoryId, revision: 3, digest: digest("1"), membershipDigest: digest("2") },
    designRequirements: { recordId: requirementsId, revision: 2, digest: digest("3"), membershipDigest: digest("4") },
    designSystemTokenContract: { recordId: designSystemId, revision: 1, digest: digest("5"), membershipDigest: digest("6") },
    targets: [{
      key: "release-review-component",
      kind: "component",
      referenceKey: "release-review-card",
      platformKeys: ["responsive-web"],
      screenKeys: ["release-review"],
      stateKeys: ["review-default"],
      requirementKeys: ["DESIGN-REVIEW-01"],
      ownership: owner,
      sources: [source()],
      limitations: ["The governed target identity does not prove accessibility or implementation quality"],
    }],
    rules: [{
      key: "keyboard-operation",
      title: "Keyboard operation remains available",
      principle: "operable",
      applicability: "applicable",
      impact: "major",
      targetKeys: ["release-review-component"],
      requirementKeys: ["DESIGN-REVIEW-01"],
      checkKeys: ["keyboard-operation-review"],
      standardReferences: [{ family: "wcag", version: "2.2", criterion: "2.1.1", level: "A" }],
      ownership: owner,
      rationale: "The primary release-review interaction requires a defined keyboard design check before accountable human review.",
      sources: [source()],
    }],
    checks: [{
      key: "keyboard-operation-review",
      ruleKey: "keyboard-operation",
      targetKeys: ["release-review-component"],
      method: "manual",
      evidenceState: "human-reviewed",
      observation: "evidence-supports",
      evidenceDigests: [digest("7")],
      reviewedBy: reviewer,
      reviewedAt: observedAt,
      procedure: "Review the governed component design for keyboard reachability, visible focus, logical order, and non-pointer alternatives.",
      sources: [source()],
    }],
    requirementCoverage: [{
      requirementKey: "DESIGN-REVIEW-01",
      state: "represented",
      ruleKeys: ["keyboard-operation"],
      rationale: "The exact current Design Requirement is represented by the candidate keyboard-operation accessibility rule.",
      sources: [source()],
    }],
    catalogCompletenessState: "candidate-complete",
    unresolvedQuestions: [],
    limitations: ["Accessibility conformance, rule and check validity, legal compliance, ownership authority, design approval, baseline, readiness, and implementation remain not established"],
    reviewState: "ready-for-human-review",
    accessibilityConformanceState: "not-established",
    ruleValidityState: "not-established",
    legalComplianceState: "not-established",
    designApprovalState: "not-established",
    designBaselineState: "not-established",
    readinessState: "not-established",
    implementationAuthorityState: "not-established",
  }
}

describe("Accessibility Design Rules", () => {
  it("accepts exact targets, rules, checks, evidence, coverage, and ownership without conformance authority", () => {
    expect(accessibilityDesignRulesInputSchema.safeParse(input()).success).toBe(true)
  })

  it("rejects orphan targets, checks, and requirement coverage", () => {
    const orphanTarget = structuredClone(input())
    orphanTarget.rules[0]!.targetKeys = ["unknown-target"]
    expect(accessibilityDesignRulesInputSchema.safeParse(orphanTarget).success).toBe(false)

    const orphanCheck = structuredClone(input())
    orphanCheck.checks[0]!.ruleKey = "unknown-rule"
    expect(accessibilityDesignRulesInputSchema.safeParse(orphanCheck).success).toBe(false)

    const orphanCoverage = structuredClone(input())
    orphanCoverage.requirementCoverage[0]!.ruleKeys = ["unknown-rule"]
    expect(accessibilityDesignRulesInputSchema.safeParse(orphanCoverage).success).toBe(false)
  })

  it("requires attributable decisions and evidence while rejecting unresolved review-ready or secret-shaped candidates", () => {
    const implicitNotApplicable = structuredClone(input())
    implicitNotApplicable.rules[0]!.applicability = "not-applicable"
    implicitNotApplicable.rules[0]!.checkKeys = []
    expect(accessibilityDesignRulesInputSchema.safeParse(implicitNotApplicable).success).toBe(false)

    const missingEvidence = structuredClone(input())
    missingEvidence.checks[0]!.evidenceDigests = []
    expect(accessibilityDesignRulesInputSchema.safeParse(missingEvidence).success).toBe(false)

    const unresolved = structuredClone(input())
    unresolved.checks[0]!.evidenceState = "not-assessed"
    unresolved.checks[0]!.observation = "not-assessed"
    unresolved.checks[0]!.evidenceDigests = []
    delete unresolved.checks[0]!.reviewedBy
    delete unresolved.checks[0]!.reviewedAt
    expect(accessibilityDesignRulesInputSchema.safeParse(unresolved).success).toBe(false)

    const secret = structuredClone(input())
    secret.limitations = ["Use API_KEY=123456789012345678901234567890 to inspect the design evidence"]
    expect(accessibilityDesignRulesInputSchema.safeParse(secret).success).toBe(false)
  })

  it("preserves immutable history plus observational, privacy-safe, no-authority status and projection contracts", () => {
    const candidate = {
      ...input(),
      schemaVersion: 1 as const,
      kind: "accessibility-design-rules-candidate" as const,
      id: candidateId,
      productId,
      revision: 1,
      membershipDigest: digest("8"),
      state: "candidate" as const,
      createdBy: reviewer,
      updatedBy: reviewer,
      createdAt: observedAt,
      updatedAt: observedAt,
      authorityBoundary: "accessibility-design-rules-are-candidate-metadata-and-do-not-establish-accessibility-conformance-rule-or-check-validity-legal-compliance-ownership-design-approval-baseline-readiness-implementation-or-action-authority" as const,
    }
    expect(accessibilityDesignRulesSchema.safeParse(candidate).success).toBe(true)
    expect(accessibilityDesignRulesSchema.safeParse({ ...candidate, revision: 2 }).success).toBe(false)

    const status = {
      schemaVersion: 1 as const,
      kind: "accessibility-design-rules-status" as const,
      productId,
      productRevision: 4,
      initiativeId,
      initiativeRevision: 7,
      candidate: { recordId: candidateId, revision: 1, digest: digest("9") },
      targetCount: 1,
      ruleCount: 1,
      checkCount: 1,
      applicableRuleCount: 1,
      notApplicableRuleCount: 0,
      unresolvedRuleCount: 0,
      notAssessedCheckCount: 0,
      evidenceRecordedCheckCount: 0,
      humanReviewedCheckCount: 1,
      contradictedCheckCount: 0,
      representedRequirementCount: 1,
      unresolvedRequirementCount: 0,
      unresolvedOwnershipCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      unresolvedQuestionCount: 0,
      catalogCompletenessState: "candidate-complete" as const,
      reviewState: "ready-for-human-review" as const,
      state: "complete-for-review" as const,
      reasons: [],
      assessedAt: observedAt,
      authorityBoundary: "accessibility-design-rules-status-is-observational-and-does-not-establish-accessibility-conformance-rule-or-check-validity-legal-compliance-ownership-design-approval-baseline-readiness-implementation-or-action-authority" as const,
    }
    expect(accessibilityDesignRulesStatusSchema.safeParse(status).success).toBe(true)

    const projection = {
      schemaVersion: 1 as const,
      kind: "accessibility-design-rules-projection" as const,
      product: { id: productId, revision: 4, digest: digest("1") },
      initiative: { id: initiativeId, revision: 7, digest: digest("2"), state: "active" as const },
      status,
      candidate: {
        id: candidateId,
        revision: 1,
        digest: digest("9"),
        membershipDigest: digest("8"),
        state: "candidate" as const,
        targetCount: 1,
        ruleCount: 1,
        checkCount: 1,
        representedRequirementCount: 1,
        reviewState: "ready-for-human-review" as const,
        updatedAt: observedAt,
      },
      observedAt,
      privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-rule-procedures-evidence-requirement-source-design-or-personal-content-secrets-or-credentials" as const,
      authorityBoundary: "accessibility-design-rules-projection-is-read-only-and-does-not-establish-accessibility-conformance-rule-or-check-validity-legal-compliance-ownership-design-approval-baseline-readiness-implementation-write-or-action-authority" as const,
      snapshotDigest: digest("3"),
    }
    expect(accessibilityDesignRulesProjectionSchema.safeParse(projection).success).toBe(true)
    expect(JSON.stringify(projection)).not.toContain("keyboard-operation")
    expect(projection.authorityBoundary).toContain("does-not-establish")
  })
})
