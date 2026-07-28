import { describe, expect, it } from "vitest"

import {
  informationArchitectureModelInputSchema,
  informationArchitectureModelProjectionSchema,
  informationArchitectureModelSchema,
  informationArchitectureModelStatusSchema,
} from "./information-architecture-model.js"
import { userJourneyPathKindValues } from "./user-journey-model.js"

const productId = "11111111-1111-4111-8111-111111111111"
const initiativeId = "22222222-2222-4222-8222-222222222222"
const candidateId = "33333333-3333-4333-8333-333333333333"
const applicabilityId = "44444444-4444-4444-8444-444444444444"
const personaRoleId = "55555555-5555-4555-8555-555555555555"
const journeyModelId = "66666666-6666-4666-8666-666666666666"
const sourceId = "77777777-7777-4777-8777-777777777777"
const digest = (character: string) => `sha256:${character.repeat(64)}`

function source() {
  return { sourceId, sourceRevision: 2, recordDigest: digest("a"), contentDigest: digest("b") }
}

function route(kind: typeof userJourneyPathKindValues[number]) {
  return {
    key: `${kind}-route`,
    label: `${kind} release review route`,
    kind,
    journeyKey: "release-readiness-review",
    journeyPathKey: `${kind}-path`,
    personaKeys: ["release-change-owner"],
    entryNodeKey: "portal-review",
    nodeKeys: ["portal-review"],
    destinationNodeKey: "portal-review",
    purpose: "Map the exact governed journey path to a bounded navigation route without claiming that participants can find or understand it.",
    entryConditions: ["The exact current Product, Initiative, journey, and candidate architecture context is available"],
    successCues: ["The exact current state and bounded next navigation choice are visible"],
    failureCues: ["The participant cannot identify the current state or the bounded recovery route"],
    recoveryRouteKeys: kind === "failure" ? ["recovery-route"] : [],
    accessibilityChecks: ["The complete route has a keyboard-operable and textual representation"],
    privacyChecks: ["Only purpose-limited candidate metadata is presented"],
    fallback: "Provide the same bounded route, state, and recovery guidance through a portable textual representation.",
    evidenceState: "human-reviewed" as const,
    sources: [source()],
    reviewedBy: { kind: "human" as const, id: "product-owner" },
    reviewedAt: "2026-07-28T10:00:00.000Z",
    validationState: "not-established" as const,
  }
}

function contentNode() {
  return {
    key: "portal-review",
    label: "Portal review",
    kind: "workspace" as const,
    position: 1,
    purpose: "Organize the exact candidate evidence, status, limitations, and recovery navigation required for the bounded release-review journey.",
    designScopeKeys: ["client-application.customer-portal"],
    journeyKeys: ["release-readiness-review"],
    touchpoints: [{ journeyKey: "release-readiness-review", touchpointKey: "portal-review" }],
    personaKeys: ["release-change-owner"],
    designRoleKeys: ["portal-product-designer"],
    contentModel: {
      contentType: "governed-review-workspace",
      requiredElementKeys: ["candidate-identity", "current-state", "limitations", "recovery-navigation"],
      optionalElementKeys: ["supporting-evidence-summary"],
      ownerDesignRoleKeys: ["portal-product-designer"],
      lifecycleStates: ["candidate", "held", "ready-for-human-review"],
    },
    findability: {
      entryPointKeys: ["product-studio.users-jobs"],
      labelAlternatives: ["Governed release review", "Release readiness evidence"],
      searchTerms: ["candidate status", "release review"],
      orientationCues: ["Exact Product and Initiative identity remain visible"],
    },
    accessibilityRequirements: ["Landmarks, headings, status, and navigation order have complete textual semantics"],
    inclusionRequirements: ["Labels do not require prior knowledge of GAEP terminology"],
    privacyAndDataUse: {
      dataCategories: ["candidate-metadata"],
      purpose: "Support the bounded release-review navigation job without monitoring individual productivity.",
      minimization: "Display only record identity, status, counts, digests, limitations, and bounded route guidance.",
      retention: "Use the governed Product retention policy for candidate metadata.",
      prohibitedUses: ["Individual productivity ranking is prohibited"],
    },
    fallback: "Expose the same content hierarchy, labels, status, and routes in a portable textual representation.",
    evidence: {
      structure: "human-reviewed" as const,
      findability: "human-reviewed" as const,
      comprehension: "human-reviewed" as const,
      reviewedBy: { kind: "human" as const, id: "product-owner" },
      reviewedAt: "2026-07-28T10:00:00.000Z",
    },
    sources: [source()],
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
    title: "Customer portal Information Architecture candidate",
    designApplicability: {
      recordId: applicabilityId, revision: 2, digest: digest("e"), membershipDigest: digest("f"),
    },
    designPersonaRoleModel: {
      recordId: personaRoleId, revision: 3, digest: digest("1"), membershipDigest: digest("2"),
    },
    userJourneyModel: {
      recordId: journeyModelId, revision: 4, digest: digest("3"), membershipDigest: digest("4"),
    },
    contentNodes: [contentNode()],
    navigationRoutes: userJourneyPathKindValues.map(route),
    scopeCoverage: [{
      designScopeKey: "client-application.customer-portal",
      status: "represented" as const,
      nodeKeys: ["portal-review"],
      routeKeys: userJourneyPathKindValues.map((kind) => `${kind}-route`).sort(),
      rationale: "The exact customer portal design scope is represented by a source-linked content node and all governed journey paths.",
      sources: [source()],
      approval: { state: "not-required" as const, conditions: [] },
    }],
    unresolvedQuestions: [],
    limitations: ["Findability, comprehension, accessibility validation, content validation, design approval, readiness, implementation, and action authority are not established"],
    reviewState: "ready-for-human-review" as const,
    findabilityValidationState: "not-established" as const,
    comprehensionValidationState: "not-established" as const,
    accessibilityValidationState: "not-established" as const,
    designApprovalState: "not-established" as const,
    implementationAuthorityState: "not-established" as const,
  }
}

function status() {
  return {
    schemaVersion: 1 as const,
    kind: "information-architecture-model-status" as const,
    productId,
    productRevision: 4,
    initiativeId,
    initiativeRevision: 7,
    candidate: { recordId: candidateId, revision: 1, digest: digest("5") },
    nodeCount: 1,
    rootNodeCount: 1,
    routeCount: 4,
    representedScopeCount: 1,
    unresolvedScopeCount: 0,
    weakEvidenceNodeCount: 0,
    weakEvidenceRouteCount: 0,
    staleBindingCount: 0,
    staleSourceReferenceCount: 0,
    unresolvedQuestionCount: 0,
    reviewState: "ready-for-human-review" as const,
    state: "complete-for-review" as const,
    reasons: [],
    assessedAt: "2026-07-28T10:00:00.000Z",
    authorityBoundary: "information-architecture-status-is-observational-and-does-not-prove-findability-comprehension-or-accessibility-validate-content-approve-design-grant-readiness-or-authorize-action" as const,
  }
}

describe("Information Architecture Model contract", () => {
  it("accepts source-bound hierarchy, content models, and exact journey-path routes without validation authority", () => {
    const parsed = informationArchitectureModelInputSchema.parse(input())
    expect(parsed.contentNodes).toHaveLength(1)
    expect(parsed.navigationRoutes.map((entry) => entry.kind).sort()).toEqual([...userJourneyPathKindValues])
    expect(parsed.findabilityValidationState).toBe("not-established")
    expect(parsed.comprehensionValidationState).toBe("not-established")
  })

  it("rejects hierarchy cycles, unknown route nodes, uncovered represented scope, and secret-shaped content", () => {
    const cyclic: any = structuredClone(input())
    const first: any = contentNode()
    first.key = "portal-root"
    first.parentKey = "portal-review"
    const second: any = contentNode()
    second.parentKey = "portal-root"
    cyclic.contentNodes = [first, second].sort((left, right) => left.key.localeCompare(right.key))
    expect(informationArchitectureModelInputSchema.safeParse(cyclic).success).toBe(false)

    const unknownNode: any = structuredClone(input())
    unknownNode.navigationRoutes[0].nodeKeys = ["missing-node"]
    expect(informationArchitectureModelInputSchema.safeParse(unknownNode).success).toBe(false)

    const uncovered: any = structuredClone(input())
    uncovered.scopeCoverage[0].routeKeys = []
    expect(informationArchitectureModelInputSchema.safeParse(uncovered).success).toBe(false)

    const secret: any = structuredClone(input())
    secret.limitations = ["Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456"]
    expect(informationArchitectureModelInputSchema.safeParse(secret).success).toBe(false)
  })

  it("requires attributable exceptions and blocks weak findability or route evidence from review readiness", () => {
    const notApplicable: any = structuredClone(input())
    notApplicable.contentNodes = []
    notApplicable.navigationRoutes = []
    notApplicable.scopeCoverage[0] = {
      ...notApplicable.scopeCoverage[0], status: "not-applicable", nodeKeys: [], routeKeys: [],
      approval: { state: "not-required", conditions: [] },
    }
    expect(informationArchitectureModelInputSchema.safeParse(notApplicable).success).toBe(false)
    notApplicable.scopeCoverage[0].approval = {
      state: "approved", decidedBy: { kind: "human", id: "product-owner" },
      decidedAt: "2026-07-28T10:00:00.000Z", conditions: [],
    }
    expect(informationArchitectureModelInputSchema.safeParse(notApplicable).success).toBe(true)

    const weakNode: any = structuredClone(input())
    weakNode.contentNodes[0].evidence.findability = "hypothesis"
    delete weakNode.contentNodes[0].evidence.reviewedBy
    delete weakNode.contentNodes[0].evidence.reviewedAt
    expect(informationArchitectureModelInputSchema.safeParse(weakNode).success).toBe(false)

    const weakRoute: any = structuredClone(input())
    weakRoute.navigationRoutes[0].evidenceState = "disputed"
    delete weakRoute.navigationRoutes[0].reviewedBy
    delete weakRoute.navigationRoutes[0].reviewedAt
    expect(informationArchitectureModelInputSchema.safeParse(weakRoute).success).toBe(false)
  })

  it("rejects invalid immutable ancestry and forged status or projection context", () => {
    const record = {
      ...input(),
      schemaVersion: 1 as const,
      kind: "information-architecture-model-candidate" as const,
      id: candidateId,
      productId,
      revision: 2,
      membershipDigest: digest("6"),
      state: "candidate" as const,
      createdBy: { kind: "human" as const, id: "product-owner" },
      updatedBy: { kind: "human" as const, id: "product-owner" },
      createdAt: "2026-07-28T10:00:00.000Z",
      updatedAt: "2026-07-28T10:00:00.000Z",
      authorityBoundary: "information-architecture-is-candidate-guidance-and-does-not-prove-findability-comprehension-or-accessibility-validate-content-approve-design-grant-readiness-or-authorize-action" as const,
    }
    expect(informationArchitectureModelSchema.safeParse(record).success).toBe(false)

    const forged = structuredClone(status())
    forged.weakEvidenceNodeCount = 1
    expect(informationArchitectureModelStatusSchema.safeParse(forged).success).toBe(false)

    const projection = {
      schemaVersion: 1 as const,
      kind: "information-architecture-model-projection" as const,
      product: { id: productId, revision: 4, digest: digest("c") },
      initiative: { id: initiativeId, revision: 7, digest: digest("d"), state: "active" as const },
      status: status(),
      candidate: {
        id: candidateId, revision: 1, digest: digest("5"), membershipDigest: digest("6"), state: "candidate" as const,
        nodeCount: 1, rootNodeCount: 1, routeCount: 4, reviewState: "ready-for-human-review" as const,
        updatedAt: "2026-07-28T10:00:00.000Z",
      },
      observedAt: "2026-07-28T10:00:00.000Z",
      privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-node-route-content-persona-source-or-personal-content-secrets-or-credentials" as const,
      authorityBoundary: "information-architecture-projection-is-read-only-and-does-not-prove-findability-comprehension-or-accessibility-validate-content-approve-design-grant-readiness-or-authorize-write-or-action" as const,
      snapshotDigest: digest("7"),
    }
    expect(informationArchitectureModelProjectionSchema.safeParse(projection).success).toBe(true)
    projection.initiative.revision = 8
    expect(informationArchitectureModelProjectionSchema.safeParse(projection).success).toBe(false)
  })
})
