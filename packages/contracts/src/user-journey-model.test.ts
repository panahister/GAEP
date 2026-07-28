import { describe, expect, it } from "vitest"

import {
  userJourneyModelInputSchema,
  userJourneyModelProjectionSchema,
  userJourneyModelSchema,
  userJourneyModelStatusSchema,
  userJourneyPathKindValues,
} from "./user-journey-model.js"

const productId = "11111111-1111-4111-8111-111111111111"
const initiativeId = "22222222-2222-4222-8222-222222222222"
const candidateId = "33333333-3333-4333-8333-333333333333"
const applicabilityId = "44444444-4444-4444-8444-444444444444"
const personaRoleId = "55555555-5555-4555-8555-555555555555"
const sourceId = "66666666-6666-4666-8666-666666666666"
const digest = (character: string) => `sha256:${character.repeat(64)}`

function source() {
  return { sourceId, sourceRevision: 2, recordDigest: digest("a"), contentDigest: digest("b") }
}

function step(key: string) {
  return {
    key,
    sequence: 1,
    touchpointKey: "portal-review",
    personaKeys: ["release-change-owner"],
    objective: "Reach the bounded next state while preserving visible evidence, uncertainty, and authority boundaries.",
    participantAction: "The participant reviews the exact visible candidate state and chooses a non-authorizing next navigation action.",
    expectedExperience: "The interface explains the current state, omissions, and recovery path without claiming approval or readiness.",
    expectedSystemResponse: "The system renders the exact candidate metadata and preserves the governed source records without mutation.",
    evidenceCues: ["Exact candidate identity and unresolved gaps remain visible"],
    accessibilityChecks: ["The step is keyboard operable and has a textual status alternative"],
    privacyChecks: ["Only purpose-limited candidate metadata is displayed"],
    sources: [source()],
  }
}

function path(kind: typeof userJourneyPathKindValues[number]) {
  const key = `${kind}-path`
  return {
    key,
    kind,
    title: `${kind} release review path`,
    personaKeys: ["release-change-owner"],
    entryConditions: ["The exact current Product and Initiative context is available"],
    steps: [step(`${kind}-step`)],
    exitConditions: ["The participant can identify the next bounded state or explicit stop condition"],
    relatedPathKeys: kind === "failure" ? ["recovery-path"] : kind === "recovery" ? ["failure-path"] : [],
    evidenceState: "human-reviewed" as const,
    sources: [source()],
    reviewedBy: { kind: "human" as const, id: "product-owner" },
    reviewedAt: "2026-07-28T09:00:00.000Z",
    validationState: "not-established" as const,
  }
}

function input() {
  return {
    initiativeId,
    context: {
      productRevision: 4,
      productDigest: digest("c"),
      initiativeRevision: 7,
      initiativeDigest: digest("d"),
    },
    informationClassification: "internal" as const,
    title: "Customer portal User Journey candidate",
    designApplicability: {
      recordId: applicabilityId, revision: 2, digest: digest("e"), membershipDigest: digest("f"),
    },
    designPersonaRoleModel: {
      recordId: personaRoleId, revision: 3, digest: digest("1"), membershipDigest: digest("2"),
    },
    journeys: [{
      key: "release-readiness-review",
      title: "Release readiness review",
      purpose: "Help a release change owner understand exact candidate readiness evidence and recovery choices without granting approval.",
      designScopeKeys: ["client-application.customer-portal"],
      personaKeys: ["release-change-owner"],
      designRoleKeys: ["portal-product-designer"],
      participantCategories: ["change-owner"],
      jobStatements: ["Understand whether the release candidate can proceed to accountable human review"],
      intendedOutcomeKeys: ["bounded-review-decision"],
      entryConditions: ["A current governed readiness candidate exists for the exact Initiative"],
      touchpoints: [{
        key: "portal-review",
        label: "Portal review surface",
        channel: "ide" as const,
        purpose: "Present exact candidate identity, evidence gaps, and recovery navigation for the bounded review job.",
        personaKeys: ["release-change-owner"],
        participantCategories: ["change-owner"],
        designScopeKeys: ["client-application.customer-portal"],
        accessibilityConsiderations: ["Keyboard operation and a complete textual alternative are required"],
        inclusionConsiderations: ["Do not assume prior knowledge of GAEP terminology"],
        privacyAndDataUse: {
          dataCategories: ["candidate-metadata"],
          purpose: "Support the exact release-readiness review without monitoring individual productivity.",
          minimization: "Show only record identity, status, counts, digests, gaps, and declared next-step guidance.",
          retention: "Use the governed Product retention policy for candidate metadata.",
          prohibitedUses: ["Individual productivity ranking is prohibited"],
        },
        fallback: "Provide the same bounded evidence and recovery instructions as a portable textual representation.",
        sources: [source()],
        validationState: "not-established" as const,
      }],
      paths: userJourneyPathKindValues.map(path),
      successCriteria: ["The participant can distinguish candidate completeness from approval and identify the next accountable review"],
      failureIndicators: ["The participant cannot explain the stop condition or recovery path"],
      accessibilityRequirements: ["All path states have keyboard and textual equivalents"],
      inclusionRequirements: ["Language remains understandable without specialist GAEP vocabulary"],
      burdenAndAttentionLimits: ["Only material deltas and unresolved gaps are foregrounded"],
      contestability: {
        path: "Challenge an incorrect journey, touchpoint, or authority assumption through an attributable review request.",
        ownerPersonaKey: "release-change-owner",
        escalation: "Hold design use and escalate unresolved evidence or authority disputes to the separate accountable Product authority.",
        sources: [source()],
      },
      sources: [source()],
      validationState: "not-established" as const,
    }],
    scopeCoverage: [{
      designScopeKey: "client-application.customer-portal",
      status: "represented" as const,
      journeyKeys: ["release-readiness-review"],
      rationale: "The exact customer portal design scope is represented by the evidence-linked release-readiness journey candidate.",
      sources: [source()],
      approval: { state: "not-required" as const, conditions: [] },
    }],
    unresolvedQuestions: [],
    limitations: ["Journey observation, validation, design approval, readiness, implementation, and action authority are not established"],
    reviewState: "ready-for-human-review" as const,
    journeyValidationState: "not-established" as const,
    designApprovalState: "not-established" as const,
    implementationAuthorityState: "not-established" as const,
  }
}

function status() {
  return {
    schemaVersion: 1 as const,
    kind: "user-journey-model-status" as const,
    productId,
    productRevision: 4,
    initiativeId,
    initiativeRevision: 7,
    candidate: { recordId: candidateId, revision: 1, digest: digest("3") },
    journeyCount: 1,
    touchpointCount: 1,
    primaryPathCount: 1,
    successPathCount: 1,
    failurePathCount: 1,
    recoveryPathCount: 1,
    representedScopeCount: 1,
    unresolvedScopeCount: 0,
    weakEvidencePathCount: 0,
    staleBindingCount: 0,
    staleSourceReferenceCount: 0,
    unresolvedQuestionCount: 0,
    reviewState: "ready-for-human-review" as const,
    state: "complete-for-review" as const,
    reasons: [],
    assessedAt: "2026-07-28T09:00:00.000Z",
    authorityBoundary: "user-journey-model-status-is-observational-and-does-not-prove-observed-behavior-validate-journeys-approve-design-grant-readiness-or-authorize-action" as const,
  }
}

describe("User Journey Model contract", () => {
  it("accepts evidence-bound touchpoints and explicit primary, success, failure, and recovery paths without authority", () => {
    const parsed = userJourneyModelInputSchema.parse(input())
    expect(parsed.journeys[0]?.paths.map((entry) => entry.kind).sort()).toEqual([...userJourneyPathKindValues])
    expect(parsed.journeys[0]?.validationState).toBe("not-established")
    expect(parsed.journeyValidationState).toBe("not-established")
  })

  it("rejects an unlinked failure, unknown touchpoint, false represented coverage, and secret-shaped content", () => {
    const unlinked: any = structuredClone(input())
    unlinked.journeys[0].paths.find((entry: any) => entry.kind === "failure").relatedPathKeys = []
    expect(userJourneyModelInputSchema.safeParse(unlinked).success).toBe(false)

    const touchpoint: any = structuredClone(input())
    touchpoint.journeys[0].paths[0].steps[0].touchpointKey = "missing-touchpoint"
    expect(userJourneyModelInputSchema.safeParse(touchpoint).success).toBe(false)

    const coverage: any = structuredClone(input())
    coverage.scopeCoverage[0].journeyKeys = []
    expect(userJourneyModelInputSchema.safeParse(coverage).success).toBe(false)

    const secret: any = structuredClone(input())
    secret.limitations = ["Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456"]
    expect(userJourneyModelInputSchema.safeParse(secret).success).toBe(false)
  })

  it("requires attributable not-applicable coverage and blocks weak evidence from review readiness", () => {
    const notApplicable: any = structuredClone(input())
    notApplicable.journeys = []
    notApplicable.scopeCoverage[0] = {
      ...notApplicable.scopeCoverage[0],
      status: "not-applicable",
      journeyKeys: [],
      approval: { state: "not-required", conditions: [] },
    }
    expect(userJourneyModelInputSchema.safeParse(notApplicable).success).toBe(false)
    notApplicable.scopeCoverage[0].approval = {
      state: "approved", decidedBy: { kind: "human", id: "product-owner" },
      decidedAt: "2026-07-28T09:00:00.000Z", conditions: [],
    }
    expect(userJourneyModelInputSchema.safeParse(notApplicable).success).toBe(true)

    const weak: any = structuredClone(input())
    const pathEntry = weak.journeys[0].paths[0]
    pathEntry.evidenceState = "hypothesis"
    delete pathEntry.reviewedBy
    delete pathEntry.reviewedAt
    expect(userJourneyModelInputSchema.safeParse(weak).success).toBe(false)
  })

  it("rejects invalid immutable ancestry and forged status or projection context", () => {
    const record = {
      ...input(),
      schemaVersion: 1 as const,
      kind: "user-journey-model-candidate" as const,
      id: candidateId,
      productId,
      revision: 2,
      membershipDigest: digest("4"),
      state: "candidate" as const,
      createdBy: { kind: "human" as const, id: "product-owner" },
      updatedBy: { kind: "human" as const, id: "product-owner" },
      createdAt: "2026-07-28T09:00:00.000Z",
      updatedAt: "2026-07-28T09:00:00.000Z",
      authorityBoundary: "user-journey-model-is-candidate-guidance-and-does-not-prove-observed-behavior-validate-a-journey-approve-design-grant-readiness-or-authorize-action" as const,
    }
    expect(userJourneyModelSchema.safeParse(record).success).toBe(false)

    const forged = structuredClone(status())
    forged.weakEvidencePathCount = 1
    expect(userJourneyModelStatusSchema.safeParse(forged).success).toBe(false)

    const projection = {
      schemaVersion: 1 as const,
      kind: "user-journey-model-projection" as const,
      product: { id: productId, revision: 4, digest: digest("c") },
      initiative: { id: initiativeId, revision: 7, digest: digest("d"), state: "active" as const },
      status: status(),
      candidate: {
        id: candidateId, revision: 1, digest: digest("3"), membershipDigest: digest("4"), state: "candidate" as const,
        journeyCount: 1, touchpointCount: 1, reviewState: "ready-for-human-review" as const,
        updatedAt: "2026-07-28T09:00:00.000Z",
      },
      observedAt: "2026-07-28T09:00:00.000Z",
      privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-journey-step-touchpoint-persona-source-or-personal-content-secrets-or-credentials" as const,
      authorityBoundary: "user-journey-model-projection-is-read-only-and-does-not-prove-observed-behavior-validate-journeys-approve-design-grant-readiness-or-authorize-write-or-action" as const,
      snapshotDigest: digest("5"),
    }
    expect(userJourneyModelProjectionSchema.safeParse(projection).success).toBe(true)
    projection.initiative.revision = 8
    expect(userJourneyModelProjectionSchema.safeParse(projection).success).toBe(false)
  })
})
