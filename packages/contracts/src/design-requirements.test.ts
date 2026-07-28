import { describe, expect, it } from "vitest"

import {
  designRequirementsInputSchema,
  designRequirementsProjectionSchema,
  designRequirementsSchema,
  designRequirementsStatusSchema,
  type DesignRequirementsInput,
} from "./design-requirements.js"

const productId = "11111111-1111-4111-8111-111111111111"
const initiativeId = "22222222-2222-4222-8222-222222222222"
const candidateId = "33333333-3333-4333-8333-333333333333"
const outcomeModelId = "44444444-4444-4444-8444-444444444444"
const inventoryId = "55555555-5555-4555-8555-555555555555"
const requirementId = "66666666-6666-4666-8666-666666666666"
const workItemId = "77777777-7777-4777-8777-777777777777"
const sourceId = "88888888-8888-4888-8888-888888888888"
const observedAt = "2026-07-28T12:00:00.000Z"
const actor = { kind: "human" as const, id: "design-requirements-reviewer" }

function digest(value: string) {
  return `sha256:${value.repeat(64)}`
}

function source() {
  return { sourceId, sourceRevision: 1, recordDigest: digest("a"), contentDigest: digest("b") }
}

function input(): DesignRequirementsInput {
  return {
    initiativeId,
    context: {
      productRevision: 4,
      productDigest: digest("c"),
      initiativeRevision: 7,
      initiativeDigest: digest("d"),
    },
    informationClassification: "internal",
    title: "Customer portal Design Requirements candidate",
    outcomeModel: { recordId: outcomeModelId, revision: 2, digest: digest("e") },
    screenStateInventory: {
      recordId: inventoryId,
      revision: 3,
      digest: digest("f"),
      membershipDigest: digest("1"),
    },
    requirements: [{
      key: "DESIGN-REVIEW-01",
      requirement: { recordType: "requirement", recordId: requirementId, revision: 1, digest: digest("2") },
      outcomeIds: ["safe-release-review"],
      targets: {
        platformKeys: ["responsive-web"],
        screenKeys: ["release-review"],
        stateKeys: ["review-default", "review-error"],
        variantKeys: ["review-wide"],
        routeKeys: ["primary-route"],
        designScopeKeys: ["client-application.customer-portal"],
      },
      backlog: {
        state: "linked",
        workItems: [{ recordType: "work-item", recordId: workItemId, revision: 1, digest: digest("3") }],
        rationale: "The bounded implementation candidate is represented by one exact Product backlog record.",
      },
      evidence: { state: "human-reviewed", sources: [source()], reviewedBy: actor, reviewedAt: observedAt },
      verificationEvidenceState: "supported",
      requirementValidityState: "not-established",
      satisfactionState: "not-established",
    }],
    outcomeCoverage: [{
      outcomeId: "safe-release-review",
      status: "represented",
      requirementKeys: ["DESIGN-REVIEW-01"],
      rationale: "The candidate requirement explicitly links the governed review experience to this exact outcome.",
      sources: [source()],
    }],
    catalogCompletenessState: "candidate-complete",
    unresolvedQuestions: [],
    limitations: ["Requirement validity, catalog completeness, priority approval, satisfaction, backlog commitment, design approval, readiness, implementation, and action authority remain not established"],
    reviewState: "ready-for-human-review",
    priorityApprovalState: "not-established",
    designApprovalState: "not-established",
    backlogCommitmentState: "not-established",
    readinessState: "not-established",
    implementationAuthorityState: "not-established",
  }
}

describe("Design Requirements contract", () => {
  it("accepts exact outcome, requirement, design-target, and backlog links without authority", () => {
    expect(designRequirementsInputSchema.safeParse(input()).success).toBe(true)
  })

  it("rejects implicit targets, inconsistent outcome coverage, and invalid backlog dispositions", () => {
    const noTargets = structuredClone(input())
    noTargets.requirements[0]!.targets = {
      platformKeys: [], screenKeys: [], stateKeys: [], variantKeys: [], routeKeys: [], designScopeKeys: [],
    }
    expect(designRequirementsInputSchema.safeParse(noTargets).success).toBe(false)

    const inconsistentOutcome = structuredClone(input())
    inconsistentOutcome.outcomeCoverage[0]!.requirementKeys = []
    expect(designRequirementsInputSchema.safeParse(inconsistentOutcome).success).toBe(false)

    const implicitBacklog = structuredClone(input())
    implicitBacklog.requirements[0]!.backlog.state = "not-planned"
    expect(designRequirementsInputSchema.safeParse(implicitBacklog).success).toBe(false)
  })

  it("rejects unresolved review-ready guidance and secret-shaped portable content", () => {
    const unresolved = structuredClone(input())
    unresolved.requirements[0]!.backlog = {
      state: "unresolved",
      workItems: [],
      rationale: "The accountable backlog disposition remains unresolved pending a future human review.",
    }
    expect(designRequirementsInputSchema.safeParse(unresolved).success).toBe(false)

    const secret = structuredClone(input())
    secret.requirements[0]!.backlog.rationale = "Use API_KEY=123456789012345678901234567890 to create the linked backlog record."
    expect(designRequirementsInputSchema.safeParse(secret).success).toBe(false)
  })

  it("preserves history, observational status, privacy, and no-authority boundaries", () => {
    const candidate = {
      ...input(),
      schemaVersion: 1 as const,
      kind: "design-requirements-candidate" as const,
      id: candidateId,
      productId,
      revision: 1,
      membershipDigest: digest("4"),
      state: "candidate" as const,
      createdBy: actor,
      updatedBy: actor,
      createdAt: observedAt,
      updatedAt: observedAt,
      authorityBoundary: "design-requirements-are-candidate-links-and-do-not-establish-requirement-validity-completeness-priority-approval-satisfaction-backlog-commitment-design-approval-readiness-implementation-or-action-authority" as const,
    }
    expect(designRequirementsSchema.safeParse(candidate).success).toBe(true)
    expect(designRequirementsSchema.safeParse({ ...candidate, revision: 2 }).success).toBe(false)

    const status = {
      schemaVersion: 1 as const,
      kind: "design-requirements-status" as const,
      productId,
      productRevision: 4,
      initiativeId,
      initiativeRevision: 7,
      candidate: { recordId: candidateId, revision: 1, digest: digest("5") },
      requirementCount: 1,
      mustPriorityCount: 1,
      representedOutcomeCount: 1,
      unresolvedOutcomeCount: 0,
      linkedBacklogRequirementCount: 1,
      notPlannedRequirementCount: 0,
      unresolvedBacklogRequirementCount: 0,
      workItemCount: 1,
      weakEvidenceRequirementCount: 0,
      staleBindingCount: 0,
      staleDomainReferenceCount: 0,
      staleSourceReferenceCount: 0,
      unresolvedQuestionCount: 0,
      catalogCompletenessState: "candidate-complete" as const,
      reviewState: "ready-for-human-review" as const,
      state: "complete-for-review" as const,
      reasons: [],
      assessedAt: observedAt,
      authorityBoundary: "design-requirements-status-is-observational-and-does-not-establish-requirement-validity-completeness-priority-approval-satisfaction-backlog-commitment-design-approval-readiness-implementation-or-action-authority" as const,
    }
    expect(designRequirementsStatusSchema.safeParse(status).success).toBe(true)

    const projection = {
      schemaVersion: 1 as const,
      kind: "design-requirements-projection" as const,
      product: { id: productId, revision: 4, digest: digest("6") },
      initiative: { id: initiativeId, revision: 7, digest: digest("7"), state: "active" as const },
      status,
      candidate: {
        id: candidateId,
        revision: 1,
        digest: digest("5"),
        membershipDigest: digest("4"),
        state: "candidate" as const,
        requirementCount: 1,
        representedOutcomeCount: 1,
        workItemCount: 1,
        reviewState: "ready-for-human-review" as const,
        updatedAt: observedAt,
      },
      observedAt,
      privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-requirement-outcome-work-item-design-target-source-or-personal-content-secrets-or-credentials" as const,
      authorityBoundary: "design-requirements-projection-is-read-only-and-does-not-establish-requirement-validity-completeness-priority-approval-satisfaction-backlog-commitment-design-approval-readiness-implementation-or-write-or-action-authority" as const,
      snapshotDigest: digest("8"),
    }
    expect(designRequirementsProjectionSchema.safeParse(projection).success).toBe(true)
    expect(JSON.stringify(projection)).not.toContain("The bounded implementation candidate")
    expect(projection.authorityBoundary).toContain("does-not-establish")
  })
})
