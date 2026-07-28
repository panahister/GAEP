import { describe, expect, it } from "vitest"

import {
  responsiveMultiPlatformTargetsInputSchema,
  responsiveMultiPlatformTargetsProjectionSchema,
  responsiveMultiPlatformTargetsSchema,
  responsiveMultiPlatformTargetsStatusSchema,
  type ResponsiveMultiPlatformTargetsInput,
} from "./responsive-multi-platform-targets.js"

const productId = "11111111-1111-4111-8111-111111111111"
const initiativeId = "22222222-2222-4222-8222-222222222222"
const candidateId = "33333333-3333-4333-8333-333333333333"
const inventoryId = "44444444-4444-4444-8444-444444444444"
const requirementsId = "55555555-5555-4555-8555-555555555555"
const designSystemId = "66666666-6666-4666-8666-666666666666"
const accessibilityId = "77777777-7777-4777-8777-777777777777"
const sourceId = "88888888-8888-4888-8888-888888888888"
const observedAt = "2026-07-28T15:00:00.000Z"
const reviewer = { kind: "human" as const, id: "responsive-reviewer" }
const owner = { state: "assigned-candidate" as const, owner: { kind: "role" as const, id: "product-designer" } }

function digest(value: string) {
  return `sha256:${value.repeat(64)}`
}

function source() {
  return { sourceId, sourceRevision: 1, recordDigest: digest("a"), contentDigest: digest("b") }
}

function input(): ResponsiveMultiPlatformTargetsInput {
  return {
    initiativeId,
    context: {
      productRevision: 4,
      productDigest: digest("c"),
      initiativeRevision: 7,
      initiativeDigest: digest("d"),
    },
    informationClassification: "internal",
    title: "Customer portal Responsive and Multi-Platform Targets candidate",
    screenStateInventory: { recordId: inventoryId, revision: 3, digest: digest("1"), membershipDigest: digest("2") },
    designRequirements: { recordId: requirementsId, revision: 2, digest: digest("3"), membershipDigest: digest("4") },
    designSystemTokenContract: { recordId: designSystemId, revision: 1, digest: digest("5"), membershipDigest: digest("6") },
    accessibilityDesignRules: { recordId: accessibilityId, revision: 1, digest: digest("7"), membershipDigest: digest("8") },
    platformTargets: [{
      key: "responsive-web-target",
      platformKey: "responsive-web",
      formFactors: ["desktop", "phone", "tablet"],
      deliverySurfaces: ["responsive-web"],
      inputModes: ["keyboard", "pointer", "touch"],
      orientations: ["landscape", "portrait"],
      contextClassKeys: ["compact", "wide"],
      screenKeys: ["release-review"],
      requirementKeys: ["DESIGN-REVIEW-01"],
      ownership: owner,
      sources: [source()],
      limitations: ["Candidate form-factor coverage does not prove platform parity or responsive implementation quality"],
    }],
    breakpoints: [{
      key: "responsive-web-compact",
      platformKey: "responsive-web",
      contextClassKey: "compact",
      basis: "container",
      maximumInlineSizePxExclusive: 768,
      rationale: "The compact container class preserves the exact governed review flow below the candidate transition edge.",
      sources: [source()],
    }, {
      key: "responsive-web-wide",
      platformKey: "responsive-web",
      contextClassKey: "wide",
      basis: "container",
      minimumInlineSizePx: 768,
      rationale: "The wide container class permits the candidate split presentation without changing task or authorization semantics.",
      sources: [source()],
    }],
    behaviors: [{
      key: "release-review-layout",
      title: "Release review layout adapts without changing task order",
      kind: "layout",
      applicability: "applicable",
      platformKeys: ["responsive-web"],
      breakpointKeys: ["responsive-web-compact", "responsive-web-wide"],
      screenKeys: ["release-review"],
      stateKeys: ["review-default"],
      requirementKeys: ["DESIGN-REVIEW-01"],
      accessibilityRuleKeys: ["keyboard-operation"],
      adaptationRules: ["Collapse the wide candidate split view to one canonical ordered column in the compact class"],
      preservationRules: ["Preserve content priority, task order, authorization meaning, focus order, and recovery access"],
      ownership: owner,
      rationale: "The governed screen must retain one semantic task sequence across both exact candidate container classes.",
      sources: [source()],
    }],
    checks: [{
      key: "release-review-compact-check",
      behaviorKey: "release-review-layout",
      platformKey: "responsive-web",
      breakpointKey: "responsive-web-compact",
      screenKey: "release-review",
      stateKey: "review-default",
      method: "hybrid",
      evidenceState: "human-reviewed",
      observation: "evidence-supports",
      evidenceDigests: [digest("9")],
      reviewedBy: reviewer,
      reviewedAt: observedAt,
      procedure: "Inspect the compact candidate layout and recorded automation evidence for semantic order, focus continuity, overflow, and recovery access.",
      sources: [source()],
    }],
    requirementCoverage: [{
      requirementKey: "DESIGN-REVIEW-01",
      state: "represented",
      behaviorKeys: ["release-review-layout"],
      rationale: "The exact current Design Requirement is represented by the candidate cross-container release-review behavior.",
      sources: [source()],
    }],
    targetCatalogState: "candidate-complete",
    breakpointCatalogState: "candidate-complete",
    behaviorCatalogState: "candidate-complete",
    unresolvedQuestions: [],
    limitations: ["Responsive completeness, platform parity, breakpoint and behavior validity, accessibility, approval, baseline, readiness, and implementation remain not established"],
    reviewState: "ready-for-human-review",
    responsiveCompletenessState: "not-established",
    platformParityState: "not-established",
    breakpointValidityState: "not-established",
    behaviorValidityState: "not-established",
    accessibilityConformanceState: "not-established",
    designApprovalState: "not-established",
    designBaselineState: "not-established",
    readinessState: "not-established",
    implementationAuthorityState: "not-established",
  }
}

describe("Responsive and Multi-Platform Targets", () => {
  it("accepts exact targets, breakpoints, behaviors, checks, evidence, coverage, and ownership without parity authority", () => {
    expect(responsiveMultiPlatformTargetsInputSchema.safeParse(input()).success).toBe(true)
  })

  it("rejects orphan breakpoint, behavior, check, and requirement references", () => {
    const orphanBreakpoint = structuredClone(input())
    orphanBreakpoint.breakpoints[0]!.platformKey = "unknown-platform"
    expect(responsiveMultiPlatformTargetsInputSchema.safeParse(orphanBreakpoint).success).toBe(false)

    const orphanBehavior = structuredClone(input())
    orphanBehavior.behaviors[0]!.breakpointKeys = ["unknown-breakpoint"]
    expect(responsiveMultiPlatformTargetsInputSchema.safeParse(orphanBehavior).success).toBe(false)

    const orphanCheck = structuredClone(input())
    orphanCheck.checks[0]!.behaviorKey = "unknown-behavior"
    expect(responsiveMultiPlatformTargetsInputSchema.safeParse(orphanCheck).success).toBe(false)

    const orphanCoverage = structuredClone(input())
    orphanCoverage.requirementCoverage[0]!.behaviorKeys = ["unknown-behavior"]
    expect(responsiveMultiPlatformTargetsInputSchema.safeParse(orphanCoverage).success).toBe(false)
  })

  it("requires bounded breakpoints, attributable evidence, and resolved review-ready candidates while rejecting secrets", () => {
    const unbounded = structuredClone(input())
    delete unbounded.breakpoints[0]!.maximumInlineSizePxExclusive
    expect(responsiveMultiPlatformTargetsInputSchema.safeParse(unbounded).success).toBe(false)

    const unresolved = structuredClone(input())
    unresolved.checks[0]!.evidenceState = "not-assessed"
    unresolved.checks[0]!.observation = "not-assessed"
    unresolved.checks[0]!.evidenceDigests = []
    delete unresolved.checks[0]!.reviewedBy
    delete unresolved.checks[0]!.reviewedAt
    expect(responsiveMultiPlatformTargetsInputSchema.safeParse(unresolved).success).toBe(false)

    const secret = structuredClone(input())
    secret.limitations = ["Use API_KEY=123456789012345678901234567890 to inspect responsive evidence"]
    expect(responsiveMultiPlatformTargetsInputSchema.safeParse(secret).success).toBe(false)
  })

  it("preserves immutable history plus observational, privacy-safe, no-authority status and projection contracts", () => {
    const candidate = {
      ...input(),
      schemaVersion: 1 as const,
      kind: "responsive-multi-platform-targets-candidate" as const,
      id: candidateId,
      productId,
      revision: 1,
      membershipDigest: digest("e"),
      state: "candidate" as const,
      createdBy: reviewer,
      updatedBy: reviewer,
      createdAt: observedAt,
      updatedAt: observedAt,
      authorityBoundary: "responsive-multi-platform-targets-are-candidate-metadata-and-do-not-establish-responsive-completeness-platform-parity-breakpoint-or-behavior-validity-accessibility-conformance-ownership-design-approval-baseline-readiness-implementation-or-action-authority" as const,
    }
    expect(responsiveMultiPlatformTargetsSchema.safeParse(candidate).success).toBe(true)
    expect(responsiveMultiPlatformTargetsSchema.safeParse({ ...candidate, revision: 2 }).success).toBe(false)

    const status = {
      schemaVersion: 1 as const,
      kind: "responsive-multi-platform-targets-status" as const,
      productId,
      productRevision: 4,
      initiativeId,
      initiativeRevision: 7,
      candidate: { recordId: candidateId, revision: 1, digest: digest("f") },
      platformTargetCount: 1,
      breakpointCount: 2,
      behaviorCount: 1,
      checkCount: 1,
      applicableBehaviorCount: 1,
      unresolvedBehaviorCount: 0,
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
      targetCatalogState: "candidate-complete" as const,
      breakpointCatalogState: "candidate-complete" as const,
      behaviorCatalogState: "candidate-complete" as const,
      reviewState: "ready-for-human-review" as const,
      state: "complete-for-review" as const,
      reasons: [],
      assessedAt: observedAt,
      authorityBoundary: "responsive-multi-platform-targets-status-is-observational-and-does-not-establish-responsive-completeness-platform-parity-breakpoint-or-behavior-validity-accessibility-conformance-ownership-design-approval-baseline-readiness-implementation-or-action-authority" as const,
    }
    expect(responsiveMultiPlatformTargetsStatusSchema.safeParse(status).success).toBe(true)

    const projection = {
      schemaVersion: 1 as const,
      kind: "responsive-multi-platform-targets-projection" as const,
      product: { id: productId, revision: 4, digest: digest("1") },
      initiative: { id: initiativeId, revision: 7, digest: digest("2"), state: "active" as const },
      status,
      candidate: {
        id: candidateId,
        revision: 1,
        digest: digest("f"),
        membershipDigest: digest("e"),
        state: "candidate" as const,
        platformTargetCount: 1,
        breakpointCount: 2,
        behaviorCount: 1,
        checkCount: 1,
        representedRequirementCount: 1,
        reviewState: "ready-for-human-review" as const,
        updatedAt: observedAt,
      },
      observedAt,
      privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-breakpoint-rules-behavior-procedures-evidence-requirement-source-design-or-personal-content-secrets-or-credentials" as const,
      authorityBoundary: "responsive-multi-platform-targets-projection-is-read-only-and-does-not-establish-responsive-completeness-platform-parity-breakpoint-or-behavior-validity-accessibility-conformance-ownership-design-approval-baseline-readiness-implementation-write-or-action-authority" as const,
      snapshotDigest: digest("3"),
    }
    expect(responsiveMultiPlatformTargetsProjectionSchema.safeParse(projection).success).toBe(true)
    expect(JSON.stringify(projection)).not.toContain("release-review-layout")
    expect(projection.authorityBoundary).toContain("does-not-establish")
  })
})
