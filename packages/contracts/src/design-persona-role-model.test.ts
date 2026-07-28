import { describe, expect, it } from "vitest"

import {
  designPersonaRoleModelInputSchema,
  designPersonaRoleModelProjectionSchema,
  designPersonaRoleModelSchema,
  designPersonaRoleModelStatusSchema,
  designParticipantCategoryValues,
  designRoleKindValues,
} from "./design-persona-role-model.js"

const productId = "11111111-1111-4111-8111-111111111111"
const initiativeId = "22222222-2222-4222-8222-222222222222"
const candidateId = "33333333-3333-4333-8333-333333333333"
const sourceId = "44444444-4444-4444-8444-444444444444"
const stakeholderModelId = "55555555-5555-4555-8555-555555555555"
const designApplicabilityId = "66666666-6666-4666-8666-666666666666"
const digest = (character: string) => `sha256:${character.repeat(64)}`

function source() {
  return { sourceId, sourceRevision: 2, recordDigest: digest("a"), contentDigest: digest("b") }
}

function approval(status: "represented" | "not-applicable" | "unresolved") {
  if (status === "represented") return { state: "not-required" as const, conditions: [] }
  if (status === "unresolved") return { state: "pending" as const, conditions: ["Accountable human review is required"] }
  return {
    state: "approved" as const,
    decidedBy: { kind: "human" as const, id: "product-owner" },
    decidedAt: "2026-07-28T08:00:00.000Z",
    conditions: [],
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
    title: "Candidate design personas and roles for the customer portal",
    stakeholderModel: { recordId: stakeholderModelId, revision: 3, digest: digest("e") },
    designApplicability: {
      recordId: designApplicabilityId,
      revision: 2,
      digest: digest("f"),
      membershipDigest: digest("1"),
    },
    personas: [{
      key: "release-change-owner",
      label: "Release change owner",
      evidenceState: "human-reviewed" as const,
      participantCategories: [...designParticipantCategoryValues],
      stakeholderKeys: ["change-owner"],
      designScopeKeys: ["client-application.customer-portal"],
      jobs: ["Understand whether a release is ready for accountable review"],
      goals: ["Reach a traceable review decision with minimal governance burden"],
      constraints: ["Must preserve separation between evidence and approval authority"],
      behaviors: ["Reviews gaps before asking an accountable authority for a decision"],
      contexts: ["Uses the customer portal during a bounded release-readiness review"],
      accessibilityNeeds: ["Keyboard-operable review flow"],
      inclusionConsiderations: ["Do not assume familiarity with GAEP terminology"],
      sources: [source()],
      reviewedBy: { kind: "human" as const, id: "product-owner" },
      reviewedAt: "2026-07-28T08:00:00.000Z",
      validationState: "not-established" as const,
      privacyBoundary: "persona-is-a-purpose-limited-design-hypothesis-and-must-not-contain-direct-personal-identifiers-or-be-used-for-productivity-ranking" as const,
    }],
    participantCoverage: designParticipantCategoryValues.map((category) => ({
      category,
      status: "represented" as const,
      rationale: `${category} is explicitly represented by the evidence-linked release-change-owner persona hypothesis.`,
      sources: [source()],
      approval: approval("represented"),
    })),
    designRoles: [{
      key: "portal-product-designer",
      label: "Portal Product Designer",
      kind: "product-designer" as const,
      stakeholderKeys: ["change-owner"],
      personaKeys: ["release-change-owner"],
      designScopeKeys: ["client-application.customer-portal"],
      responsibilities: ["Translate reviewed persona evidence into candidate interaction and interface design decisions"],
      accountableDecisions: ["Recommend whether candidate experience evidence is sufficient for human review"],
      collaborationExpectations: ["Work with change owners, reviewers, stewards, and affected contributors"],
      absenceAndEscalation: "If Product Designer responsibility is unavailable, hold design review and escalate through the recorded contestability path.",
      sources: [source()],
      assignmentState: "not-established" as const,
      competenceState: "not-established" as const,
      authorityState: "not-established" as const,
      authorityBoundary: "design-role-is-candidate-responsibility-guidance-and-does-not-appoint-a-person-verify-competence-grant-authority-or-approve-design" as const,
    }],
    roleCoverage: designRoleKindValues.map((kind) => {
      const status = kind === "product-designer" ? "represented" as const : "not-applicable" as const
      return {
        kind,
        status,
        rationale: kind === "product-designer"
          ? "Product Designer responsibility is explicitly represented for this applicable design scope."
          : `${kind} is explicitly not applicable to this bounded candidate scope after accountable human review.`,
        sources: [source()],
        approval: approval(status),
      }
    }),
    contestability: {
      path: "Challenge persona assumptions or role boundaries through the recorded Product review channel.",
      ownerStakeholderKey: "change-owner",
      escalation: "Hold design use and escalate unresolved disputes to the accountable Product authority.",
      sources: [source()],
    },
    unresolvedQuestions: [],
    limitations: ["Persona validation, role appointment, competence, authority, design approval, readiness, and action are not established"],
    reviewState: "ready-for-human-review" as const,
    personaValidationState: "not-established" as const,
    roleAppointmentState: "not-established" as const,
    designApprovalState: "not-established" as const,
    implementationAuthorityState: "not-established" as const,
  }
}

function status() {
  return {
    schemaVersion: 1 as const,
    kind: "design-persona-role-status" as const,
    productId,
    productRevision: 4,
    initiativeId,
    initiativeRevision: 7,
    candidate: { recordId: candidateId, revision: 1, digest: digest("2") },
    personaCount: 1,
    designRoleCount: 1,
    representedParticipantCategoryCount: 5,
    unresolvedParticipantCategoryCount: 0,
    representedRoleKindCount: 1,
    unresolvedRoleKindCount: 0,
    weakEvidencePersonaCount: 0,
    humanReviewedPersonaCount: 1,
    staleBindingCount: 0,
    staleSourceReferenceCount: 0,
    unresolvedQuestionCount: 0,
    reviewState: "ready-for-human-review" as const,
    state: "complete-for-review" as const,
    reasons: [],
    assessedAt: "2026-07-28T08:00:00.000Z",
    authorityBoundary: "design-persona-role-status-is-observational-and-does-not-validate-personas-appoint-roles-verify-competence-approve-design-grant-readiness-or-authorize-action" as const,
  }
}

describe("Design Persona and Role contract", () => {
  it("accepts evidence-bound personas, participant coverage, and explicit Product Designer responsibilities without authority", () => {
    const parsed = designPersonaRoleModelInputSchema.parse(input())
    expect(parsed.participantCoverage.map((entry) => entry.category)).toEqual(designParticipantCategoryValues)
    expect(parsed.roleCoverage.map((entry) => entry.kind)).toEqual(designRoleKindValues)
    expect(parsed.designRoles[0]).toMatchObject({
      kind: "product-designer",
      assignmentState: "not-established",
      competenceState: "not-established",
      authorityState: "not-established",
    })
    expect(parsed.personas[0]?.validationState).toBe("not-established")
  })

  it("rejects prose without exact evidence, false represented coverage, appointment claims, weak review readiness, and secret-shaped content", () => {
    const noEvidence: any = structuredClone(input())
    noEvidence.personas[0].sources = []
    expect(designPersonaRoleModelInputSchema.safeParse(noEvidence).success).toBe(false)

    const falseCoverage: any = structuredClone(input())
    falseCoverage.personas[0].participantCategories = falseCoverage.personas[0].participantCategories.slice(1)
    expect(designPersonaRoleModelInputSchema.safeParse(falseCoverage).success).toBe(false)

    const appointment: any = structuredClone(input())
    appointment.designRoles[0].assignmentState = "confirmed"
    expect(designPersonaRoleModelInputSchema.safeParse(appointment).success).toBe(false)

    const weakEvidence: any = structuredClone(input())
    weakEvidence.personas[0].evidenceState = "hypothesis"
    delete weakEvidence.personas[0].reviewedBy
    delete weakEvidence.personas[0].reviewedAt
    expect(designPersonaRoleModelInputSchema.safeParse(weakEvidence).success).toBe(false)

    const secret: any = structuredClone(input())
    secret.limitations = ["Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456"]
    expect(designPersonaRoleModelInputSchema.safeParse(secret).success).toBe(false)
  })

  it("requires an attributable human decision before material participant or role coverage is declared not applicable", () => {
    const candidate: any = structuredClone(input())
    candidate.personas[0].participantCategories = candidate.personas[0].participantCategories.slice(1)
    candidate.participantCoverage[0].status = "not-applicable"
    candidate.participantCoverage[0].approval = { state: "not-required", conditions: [] }
    expect(designPersonaRoleModelInputSchema.safeParse(candidate).success).toBe(false)

    candidate.participantCoverage[0].approval = approval("not-applicable")
    expect(designPersonaRoleModelInputSchema.safeParse(candidate).success).toBe(true)
  })

  it("rejects invalid immutable ancestry and forged status or projection context", () => {
    const record = {
      ...input(),
      schemaVersion: 1 as const,
      kind: "design-persona-role-candidate" as const,
      id: candidateId,
      productId,
      revision: 2,
      membershipDigest: digest("3"),
      state: "candidate" as const,
      createdBy: { kind: "human" as const, id: "product-owner" },
      updatedBy: { kind: "human" as const, id: "product-owner" },
      createdAt: "2026-07-28T08:00:00.000Z",
      updatedAt: "2026-07-28T08:00:00.000Z",
      authorityBoundary: "design-persona-role-model-is-candidate-guidance-and-does-not-validate-a-persona-appoint-a-role-verify-competence-approve-design-grant-readiness-or-authorize-action" as const,
    }
    expect(designPersonaRoleModelSchema.safeParse(record).success).toBe(false)

    const forged = structuredClone(status())
    forged.state = "complete-for-review"
    forged.weakEvidencePersonaCount = 1
    expect(designPersonaRoleModelStatusSchema.safeParse(forged).success).toBe(false)

    const projection = {
      schemaVersion: 1 as const,
      kind: "design-persona-role-projection" as const,
      product: { id: productId, revision: 4, digest: digest("c") },
      initiative: { id: initiativeId, revision: 7, digest: digest("d"), state: "active" as const },
      status: status(),
      candidate: {
        id: candidateId, revision: 1, digest: digest("2"), membershipDigest: digest("3"),
        state: "candidate" as const, personaCount: 1, designRoleCount: 1,
        reviewState: "ready-for-human-review" as const, updatedAt: "2026-07-28T08:00:00.000Z",
      },
      observedAt: "2026-07-28T08:00:00.000Z",
      privacyBoundary: "projection-contains-record-identities-counts-statuses-and-digests-only-not-persona-content-behaviors-constraints-source-content-personal-data-secrets-or-credentials" as const,
      authorityBoundary: "design-persona-role-projection-is-read-only-and-does-not-validate-personas-appoint-roles-verify-competence-approve-design-grant-readiness-or-authorize-write-or-action" as const,
      snapshotDigest: digest("4"),
    }
    expect(designPersonaRoleModelProjectionSchema.safeParse(projection).success).toBe(true)
    projection.initiative.revision = 8
    expect(designPersonaRoleModelProjectionSchema.safeParse(projection).success).toBe(false)
  })
})
