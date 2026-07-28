import { describe, expect, it } from "vitest"

import {
  screenStateInventoryInputSchema,
  screenStateInventoryProjectionSchema,
  screenStateInventorySchema,
  screenStateInventoryStatusSchema,
  type ScreenStateInventoryInput,
} from "./screen-state-inventory.js"

const productId = "11111111-1111-4111-8111-111111111111"
const initiativeId = "22222222-2222-4222-8222-222222222222"
const candidateId = "33333333-3333-4333-8333-333333333333"
const architectureId = "44444444-4444-4444-8444-444444444444"
const actor = { kind: "human" as const, id: "product-design-reviewer" }
const reviewedAt = "2026-07-28T11:00:00.000Z"

function digest(value: string) {
  return `sha256:${value.repeat(64)}`
}

function source() {
  return {
    sourceId: "55555555-5555-4555-8555-555555555555",
    sourceRevision: 1,
    recordDigest: digest("a"),
    contentDigest: digest("b"),
  }
}

function evidence() {
  return { state: "human-reviewed" as const, reviewedBy: actor, reviewedAt }
}

function input(): ScreenStateInventoryInput {
  return {
    initiativeId,
    context: {
      productRevision: 4,
      productDigest: digest("c"),
      initiativeRevision: 7,
      initiativeDigest: digest("d"),
    },
    informationClassification: "internal",
    title: "Customer portal Screen and State Inventory candidate",
    informationArchitectureModel: {
      recordId: architectureId,
      revision: 2,
      digest: digest("e"),
      membershipDigest: digest("f"),
    },
    platforms: [{
      key: "responsive-web",
      label: "Responsive web client",
      kind: "web",
      supportState: "targeted",
      interactionModes: ["keyboard", "pointer"],
      viewportOrContainerClasses: ["compact", "wide"],
      responsiveRules: ["Preserve task order and meaning while adapting presentation to the declared container class"],
      accessibilityRequirements: ["Keyboard and assistive-technology operation remains available at every declared container class"],
      privacyRequirements: ["Responsive behavior must not reveal data outside the current authorization and purpose boundary"],
      rationale: "The exact current Information Architecture route is intended for the approved responsive web experience surface.",
      sources: [source()],
      decision: { state: "not-required", conditions: [] },
    }],
    screens: [{
      key: "release-review",
      label: "Release readiness review",
      purpose: "Present the bounded governed release-readiness context and recovery choices for accountable human review.",
      platformKeys: ["responsive-web"],
      routeKeys: ["primary-route"],
      contentNodeKeys: ["portal-review"],
      designScopeKeys: ["client-application.customer-portal"],
      journeyKeys: ["release-review"],
      touchpoints: [{ journeyKey: "release-review", touchpointKey: "review-readiness" }],
      personaKeys: ["release-owner"],
      stateKeys: ["review-default", "review-error", "review-loading"],
      entryStateKey: "review-default",
      variantKeys: ["review-wide"],
      responsiveRequirements: ["The review sequence remains ordered in compact and wide container classes"],
      accessibilityRequirements: ["Status and recovery choices expose programmatic names, focus order, and non-color cues"],
      privacyAndDataUse: {
        dataCategories: ["governance-metadata"],
        purpose: "Display only the bounded governance metadata needed for the exact accountable review task.",
        minimization: "Exclude personal productivity rankings, source prose, credentials, and unrelated Product context.",
        prohibitedUses: ["Individual productivity ranking", "Use outside the declared release-review purpose"],
      },
      fallback: "If the interactive screen cannot render safely, expose the bounded read-only review summary and recovery path.",
      evidence: evidence(),
      sources: [source()],
      validationState: "not-established",
    }],
    states: [
      {
        key: "review-default",
        screenKey: "release-review",
        label: "Review ready",
        kind: "default",
        platformKeys: ["responsive-web"],
        routeKeys: ["primary-route"],
        visibleContentNodeKeys: ["portal-review"],
        entryConditions: ["The bounded readiness projection was read without a transport or integrity error"],
        exitConditions: ["The reviewer leaves the route or a declared loading or error condition becomes current"],
        availableActionKeys: ["inspect-evidence"],
        transitionStateKeys: ["review-error", "review-loading"],
        accessibilityRequirements: ["Focus begins at the screen heading and status changes are announced without stealing focus"],
        privacyRequirements: ["Only privacy-safe projection fields may be rendered"],
        fallback: "Retain the last verified privacy-safe projection with an explicit freshness warning.",
        evidence: evidence(),
        sources: [source()],
        validationState: "not-established",
      },
      {
        key: "review-error",
        screenKey: "release-review",
        label: "Review unavailable",
        kind: "error",
        platformKeys: ["responsive-web"],
        routeKeys: ["primary-route"],
        visibleContentNodeKeys: [],
        entryConditions: ["The bounded readiness projection could not be read or verified"],
        exitConditions: ["A verified retry returns the screen to its default state"],
        availableActionKeys: ["retry-read"],
        transitionStateKeys: ["review-default"],
        fallbackStateKey: "review-default",
        accessibilityRequirements: ["The error and retry choice are announced and keyboard reachable"],
        privacyRequirements: ["Raw transport errors, local paths, credentials, and source content remain hidden"],
        fallback: "Show a privacy-safe unavailable state and preserve the explicit retry path.",
        evidence: evidence(),
        sources: [source()],
        validationState: "not-established",
      },
      {
        key: "review-loading",
        screenKey: "release-review",
        label: "Review loading",
        kind: "loading",
        platformKeys: ["responsive-web"],
        routeKeys: ["primary-route"],
        visibleContentNodeKeys: [],
        entryConditions: ["A bounded readiness projection read is in progress"],
        exitConditions: ["The read resolves to the default or error state"],
        availableActionKeys: [],
        transitionStateKeys: ["review-default", "review-error"],
        accessibilityRequirements: ["Loading status is announced once without trapping focus"],
        privacyRequirements: ["No stale or unrelated content is exposed while loading"],
        fallback: "If loading exceeds the bounded interval, transition to the declared privacy-safe error state.",
        evidence: evidence(),
        sources: [source()],
        validationState: "not-established",
      },
    ],
    variants: [{
      key: "review-wide",
      screenKey: "release-review",
      label: "Wide review layout",
      platformKeys: ["responsive-web"],
      stateKeys: ["review-default", "review-error", "review-loading"],
      routeKeys: ["primary-route"],
      condition: "The responsive web container satisfies the declared wide class without changing task or authorization semantics.",
      differenceSummary: "Evidence navigation may be presented beside the status summary while preserving the same ordered content and actions.",
      responsiveRules: ["Collapse to the canonical ordered single-column flow when the wide class no longer applies"],
      accessibilityRequirements: ["Visual columns preserve one programmatic reading and focus order"],
      privacyRequirements: ["The wider layout does not introduce additional data fields"],
      fallback: "Use the canonical compact presentation when the container class cannot be established.",
      evidence: evidence(),
      sources: [source()],
      validationState: "not-established",
    }],
    routeCoverage: [{
      routeKey: "primary-route",
      status: "represented",
      screenKeys: ["release-review"],
      stateKeys: ["review-default", "review-error", "review-loading"],
      rationale: "The exact current primary Information Architecture route is represented by the bounded review screen and explicit states.",
      sources: [source()],
    }],
    scopeCoverage: [{
      designScopeKey: "client-application.customer-portal",
      status: "represented",
      screenKeys: ["release-review"],
      rationale: "The exact represented Information Architecture scope is covered by the declared review screen.",
      sources: [source()],
      decision: { state: "not-required", conditions: [] },
    }],
    unresolvedQuestions: [],
    limitations: ["UI completeness, platform parity, state reachability, interaction quality, accessibility validation, design approval, readiness, implementation, and action authority remain not established"],
    reviewState: "ready-for-human-review",
    uiCompletenessState: "not-established",
    platformParityState: "not-established",
    stateReachabilityState: "not-established",
    interactionQualityState: "not-established",
    accessibilityValidationState: "not-established",
    designApprovalState: "not-established",
    implementationAuthorityState: "not-established",
  }
}

describe("Screen and State Inventory contract", () => {
  it("accepts an exact bounded platform, screen, state, variant, route, and scope inventory", () => {
    expect(screenStateInventoryInputSchema.safeParse(input()).success).toBe(true)
  })

  it("rejects implicit platform coverage and invalid screen-state boundaries", () => {
    const noScreen = structuredClone(input())
    noScreen.screens = []
    noScreen.states = []
    noScreen.variants = []
    noScreen.routeCoverage[0]!.screenKeys = []
    noScreen.routeCoverage[0]!.stateKeys = []
    noScreen.routeCoverage[0]!.status = "unresolved"
    noScreen.scopeCoverage[0]!.screenKeys = []
    noScreen.scopeCoverage[0]!.status = "unresolved"
    noScreen.scopeCoverage[0]!.decision = { state: "pending", conditions: [] }
    expect(screenStateInventoryInputSchema.safeParse(noScreen).success).toBe(false)

    const crossScreen = structuredClone(input())
    crossScreen.states[0]!.screenKey = "missing-screen"
    expect(screenStateInventoryInputSchema.safeParse(crossScreen).success).toBe(false)

    const invalidFallback = structuredClone(input())
    delete invalidFallback.states[1]!.fallbackStateKey
    expect(screenStateInventoryInputSchema.safeParse(invalidFallback).success).toBe(false)
  })

  it("rejects unresolved review-ready guidance and secret-shaped portable content", () => {
    const unresolved = structuredClone(input())
    unresolved.routeCoverage[0] = {
      ...unresolved.routeCoverage[0]!, status: "unresolved", screenKeys: [], stateKeys: [],
    }
    expect(screenStateInventoryInputSchema.safeParse(unresolved).success).toBe(false)

    const secret = structuredClone(input())
    secret.screens[0]!.fallback = "Use API_KEY=123456789012345678901234567890 when the screen fails."
    expect(screenStateInventoryInputSchema.safeParse(secret).success).toBe(false)
  })

  it("preserves candidate history, status, projection, privacy, and no-authority invariants", () => {
    const candidate = {
      ...input(),
      schemaVersion: 1 as const,
      kind: "screen-state-inventory-candidate" as const,
      id: candidateId,
      productId,
      revision: 1,
      membershipDigest: digest("1"),
      state: "candidate" as const,
      createdBy: actor,
      updatedBy: actor,
      createdAt: reviewedAt,
      updatedAt: reviewedAt,
      authorityBoundary: "screen-state-inventory-is-candidate-guidance-and-does-not-prove-ui-completeness-platform-parity-state-reachability-interaction-quality-or-accessibility-approve-design-grant-readiness-or-authorize-action" as const,
    }
    expect(screenStateInventorySchema.safeParse(candidate).success).toBe(true)
    expect(screenStateInventorySchema.safeParse({ ...candidate, revision: 2 }).success).toBe(false)

    const status = {
      schemaVersion: 1 as const,
      kind: "screen-state-inventory-status" as const,
      productId, productRevision: 4, initiativeId, initiativeRevision: 7,
      candidate: { recordId: candidateId, revision: 1, digest: digest("2") },
      platformCount: 1, targetedPlatformCount: 1, unresolvedPlatformCount: 0,
      screenCount: 1, stateCount: 3, variantCount: 1,
      representedRouteCount: 1, unresolvedRouteCount: 0,
      representedScopeCount: 1, unresolvedScopeCount: 0,
      weakEvidenceItemCount: 0, staleBindingCount: 0, staleSourceReferenceCount: 0, unresolvedQuestionCount: 0,
      reviewState: "ready-for-human-review" as const,
      state: "complete-for-review" as const,
      reasons: [], assessedAt: reviewedAt,
      authorityBoundary: "screen-state-inventory-status-is-observational-and-does-not-prove-ui-completeness-platform-parity-state-reachability-interaction-quality-or-accessibility-approve-design-grant-readiness-or-authorize-action" as const,
    }
    expect(screenStateInventoryStatusSchema.safeParse(status).success).toBe(true)
    expect(screenStateInventoryStatusSchema.safeParse({ ...status, unresolvedRouteCount: 1 }).success).toBe(false)

    const projection = {
      schemaVersion: 1 as const,
      kind: "screen-state-inventory-projection" as const,
      product: { id: productId, revision: 4, digest: digest("3") },
      initiative: { id: initiativeId, revision: 7, digest: digest("4"), state: "active" as const },
      status,
      candidate: {
        id: candidateId, revision: 1, digest: digest("5"), membershipDigest: digest("6"), state: "candidate" as const,
        platformCount: 1, screenCount: 1, stateCount: 3, variantCount: 1,
        reviewState: "ready-for-human-review" as const, updatedAt: reviewedAt,
      },
      observedAt: reviewedAt,
      privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-screen-state-variant-platform-content-persona-source-or-personal-content-secrets-or-credentials" as const,
      authorityBoundary: "screen-state-inventory-projection-is-read-only-and-does-not-prove-ui-completeness-platform-parity-state-reachability-interaction-quality-or-accessibility-approve-design-grant-readiness-or-authorize-write-or-action" as const,
      snapshotDigest: digest("7"),
    }
    expect(screenStateInventoryProjectionSchema.safeParse(projection).success).toBe(true)
    projection.initiative.revision = 8
    expect(screenStateInventoryProjectionSchema.safeParse(projection).success).toBe(false)
  })
})
