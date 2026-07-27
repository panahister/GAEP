import { describe, expect, it } from "vitest"

import {
  designApplicabilityInputSchema,
  designApplicabilityProjectionSchema,
  designApplicabilitySchema,
  designApplicabilityStatusSchema,
} from "./design-applicability.js"

const productId = "11111111-1111-4111-8111-111111111111"
const initiativeId = "22222222-2222-4222-8222-222222222222"
const candidateId = "33333333-3333-4333-8333-333333333333"
const sourceId = "44444444-4444-4444-8444-444444444444"
const experienceDecisionId = "55555555-5555-4555-8555-555555555555"
const integrationDecisionId = "66666666-6666-4666-8666-666666666666"
const digest = (character: string) => `sha256:${character.repeat(64)}`

function source() {
  return { sourceId, sourceRevision: 2, recordDigest: digest("a"), contentDigest: digest("b") }
}

function decision(aspect: "design-work" | "figma" | "user-experience" | "user-interface") {
  return {
    aspect,
    status: aspect === "figma" ? "optional" as const : "required" as const,
    rationale: `${aspect} has an explicit evidence-backed applicability disposition for this exact target scope.`,
    sources: [source()],
    owner: "experience-owner",
    accountableApprover: "product-owner",
    conditions: [],
    reviewTriggers: ["Initiative scope or interaction posture changes"],
    approval: { state: "not-required" as const, conditions: [] },
    relatedDesignArtifacts: [],
    authorityBoundary: "design-applicability-decision-is-candidate-guidance-and-does-not-approve-design-establish-a-baseline-or-authorize-action" as const,
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
    title: "Candidate design applicability for the customer portal",
    classificationBinding: {
      digest: digest("e"),
      completenessPolicyVersion: "gaep-initiative-classification-completeness-v1" as const,
      completenessPolicyDigest: digest("f"),
    },
    applicabilityBinding: {
      matrixRevision: 3,
      matrixDigest: digest("1"),
      catalogVersion: "gaep-initiative-applicability-subjects-v1" as const,
      catalogDigest: digest("2"),
      experienceDesign: {
        subject: { type: "activity" as const, key: "experience-design" as const },
        decisionId: experienceDecisionId,
        revision: 2,
        digest: digest("3"),
        status: "required" as const,
      },
      designReferenceIntegration: {
        subject: { type: "capability" as const, key: "design-reference-integration" as const },
        decisionId: integrationDecisionId,
        revision: 2,
        digest: digest("4"),
        status: "optional" as const,
      },
    },
    scopes: [{
      scope: { kind: "client-application" as const, id: "customer-portal", label: "Customer portal" },
      affectedJourneys: ["Release readiness review"],
      approvedDesignSystems: ["GAEP product interface system"],
      requiredDepth: "standard" as const,
      designSource: {
        state: "selected" as const,
        modes: ["repository-native" as const],
        rationale: "Repository-native design records are the selected candidate source for this target.",
        sources: [source()],
      },
      decisions: [
        decision("design-work"),
        decision("figma"),
        decision("user-experience"),
        decision("user-interface"),
      ],
      limitations: ["This record does not establish a design baseline"],
    }],
    unresolvedQuestions: [],
    limitations: ["No design approval, baseline, readiness, implementation, or action authority is established"],
    reviewState: "ready-for-human-review" as const,
    designApprovalState: "not-established" as const,
    designBaselineState: "not-established" as const,
    implementationAuthorityState: "not-established" as const,
  }
}

function status() {
  return {
    schemaVersion: 1 as const,
    kind: "design-applicability-status" as const,
    productId,
    productRevision: 4,
    initiativeId,
    initiativeRevision: 7,
    candidate: { recordId: candidateId, revision: 1, digest: digest("5") },
    scopeCount: 1,
    decisionCount: 4,
    unresolvedDecisionCount: 0,
    blockedDecisionCount: 0,
    pendingApprovalCount: 0,
    rejectedApprovalCount: 0,
    unresolvedDepthCount: 0,
    unresolvedSourceCount: 0,
    staleBindingCount: 0,
    staleSourceReferenceCount: 0,
    unresolvedQuestionCount: 0,
    reviewState: "ready-for-human-review" as const,
    state: "complete-for-review" as const,
    reasons: [],
    assessedAt: "2026-07-28T03:00:00.000Z",
    authorityBoundary: "design-applicability-status-is-observational-and-does-not-approve-design-establish-a-baseline-grant-readiness-or-authorize-implementation-or-action" as const,
  }
}

describe("Design Applicability contract", () => {
  it("accepts exact, complete, source-bound UX, UI, design-work, and Figma dispositions", () => {
    const parsed = designApplicabilityInputSchema.parse(input())
    expect(parsed.scopes[0]?.decisions.map((entry) => entry.aspect)).toEqual([
      "design-work", "figma", "user-experience", "user-interface",
    ])
    expect(parsed.designApprovalState).toBe("not-established")
  })

  it("rejects absent aspects, inconsistent Figma selection, unresolved review readiness, and secret-shaped content", () => {
    const absent: any = structuredClone(input())
    absent.scopes[0].decisions.pop()
    expect(designApplicabilityInputSchema.safeParse(absent).success).toBe(false)

    const figma: any = structuredClone(input())
    figma.scopes[0].decisions[1].status = "required"
    expect(designApplicabilityInputSchema.safeParse(figma).success).toBe(false)

    const unresolved: any = structuredClone(input())
    unresolved.scopes[0].decisions[0].status = "awaiting-human-decision"
    unresolved.scopes[0].decisions[0].approval.state = "pending"
    unresolved.scopes[0].requiredDepth = "unresolved"
    unresolved.scopes[0].designSource.state = "unresolved"
    unresolved.scopes[0].designSource.modes = []
    expect(designApplicabilityInputSchema.safeParse(unresolved).success).toBe(false)

    const secret: any = structuredClone(input())
    secret.limitations = ["Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456"]
    expect(designApplicabilityInputSchema.safeParse(secret).success).toBe(false)
  })

  it("requires attributable approval for material not-applicable decisions", () => {
    const notApplicable: any = structuredClone(input())
    for (const entry of notApplicable.scopes[0].decisions) {
      entry.status = "not-applicable"
    }
    notApplicable.scopes[0].requiredDepth = "none"
    notApplicable.scopes[0].designSource.state = "not-applicable"
    notApplicable.scopes[0].designSource.modes = []
    expect(designApplicabilityInputSchema.safeParse(notApplicable).success).toBe(false)

    for (const entry of notApplicable.scopes[0].decisions) {
      entry.approval = {
        state: "approved",
        decidedBy: { kind: "human", id: "product-owner" },
        decidedAt: "2026-07-28T03:00:00.000Z",
        conditions: [],
      }
    }
    expect(designApplicabilityInputSchema.safeParse(notApplicable).success).toBe(true)
  })

  it("rejects invalid immutable ancestry and forged status or projection context", () => {
    const record = {
      ...input(),
      schemaVersion: 1 as const,
      kind: "design-applicability-candidate" as const,
      id: candidateId,
      productId,
      revision: 2,
      membershipDigest: digest("6"),
      state: "candidate" as const,
      createdBy: { kind: "human" as const, id: "product-owner" },
      updatedBy: { kind: "human" as const, id: "product-owner" },
      createdAt: "2026-07-28T03:00:00.000Z",
      updatedAt: "2026-07-28T03:00:00.000Z",
      authorityBoundary: "design-applicability-is-candidate-guidance-and-does-not-approve-design-establish-a-baseline-grant-readiness-or-authorize-implementation-or-action" as const,
    }
    expect(designApplicabilitySchema.safeParse(record).success).toBe(false)

    const forged = structuredClone(status())
    forged.decisionCount = 3
    expect(designApplicabilityStatusSchema.safeParse(forged).success).toBe(false)

    const projection = {
      schemaVersion: 1 as const,
      kind: "design-applicability-projection" as const,
      product: { id: productId, revision: 4, digest: digest("c") },
      initiative: { id: initiativeId, revision: 7, digest: digest("d"), state: "active" as const },
      status: status(),
      candidate: {
        id: candidateId, revision: 1, digest: digest("5"), membershipDigest: digest("6"),
        state: "candidate" as const, scopeCount: 1, reviewState: "ready-for-human-review" as const,
        updatedAt: "2026-07-28T03:00:00.000Z",
      },
      observedAt: "2026-07-28T03:00:00.000Z",
      privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-rationales-source-content-journeys-design-content-personal-data-secrets-or-credentials" as const,
      authorityBoundary: "design-applicability-projection-is-read-only-and-does-not-approve-design-establish-a-baseline-grant-readiness-or-authorize-write-implementation-or-action" as const,
      snapshotDigest: digest("7"),
    }
    expect(designApplicabilityProjectionSchema.safeParse(projection).success).toBe(true)
    projection.initiative.revision = 8
    expect(designApplicabilityProjectionSchema.safeParse(projection).success).toBe(false)
  })
})
