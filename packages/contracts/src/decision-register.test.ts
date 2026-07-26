import { describe, expect, it } from "vitest"

import {
  decisionRegisterInputSchema,
  decisionRegisterRequirementIds,
  decisionRegisterSchema,
  type DecisionRegisterInput,
} from "./decision-register.js"

const id = (value: string) => `${value.repeat(8).slice(0, 8)}-${value.repeat(4).slice(0, 4)}-4${value.repeat(3).slice(0, 3)}-8${value.repeat(3).slice(0, 3)}-${value.repeat(12).slice(0, 12)}`
const digest = (value: string) => `sha256:${value.repeat(64).slice(0, 64)}` as const

const source = {
  sourceId: id("a"),
  sourceRevision: 1,
  recordDigest: digest("b"),
  contentDigest: digest("c"),
}

function input(overrides: Partial<DecisionRegisterInput> = {}): DecisionRegisterInput {
  const decisionKeys = ["shared-engine-boundary"]
  return {
    initiativeId: id("d"),
    context: {
      productRevision: 3,
      productDigest: digest("e"),
      initiativeRevision: 2,
      initiativeDigest: digest("f"),
    },
    informationClassification: "internal",
    title: "Candidate Product Decision Register",
    scope: "Record one exact cross-step Product decision question, alternatives, recommendation, human selection state, consequences, authority gaps, and review triggers without treating any record as approval or action authority.",
    operatingModel: { recordId: id("1"), revision: 2, digest: digest("1") },
    architectureChallengeModel: { recordId: id("2"), revision: 1, digest: digest("2") },
    decisions: [{
      key: "shared-engine-boundary",
      question: "Should every native Product Studio host delegate governed Product semantics and persistence to one shared local engine?",
      scope: {
        included: ["Four native Product Studio hosts", "Shared local governed engine"],
        excluded: ["Deployment authorization", "Production release"],
      },
      ownerRoleKey: "product-owner",
      decisionAuthorityRoleKeys: ["architecture-decision-owner", "product-owner"],
      decisionRightKeys: ["select-system-boundary"],
      ownerAssignmentState: "not-established",
      authorityAssignmentState: "not-established",
      subjects: [{
        recordKind: "architecture-challenge-model",
        recordId: id("2"),
        revision: 1,
        digest: digest("2"),
        relationship: "answers-for",
        elementKeys: ["shared-engine-decision"],
      }],
      options: [{
        key: "host-local-semantics",
        name: "Host-local semantics",
        description: "Each native host implements and persists governed Product semantics independently.",
        noAction: false,
        consequences: ["Each host requires independent semantic-parity and migration evidence"],
        constraints: ["Four authority-bearing implementations must remain compatible"],
        risks: ["Host-local governance semantics may silently diverge"],
        evidence: [source],
      }, {
        key: "shared-governed-engine",
        name: "Shared governed engine",
        description: "Every native host delegates governed Product semantics and persistence to one shared strict engine contract.",
        noAction: false,
        consequences: ["All hosts depend on one strict protocol and governed-store boundary"],
        constraints: ["Packaging and compatibility must work in every supported host"],
        risks: ["A shared engine defect can affect every native host"],
        evidence: [source],
      }],
      criteria: [{
        key: "authority-integrity",
        statement: "The selected boundary must preserve one inspectable and fail-closed authority model across every host.",
        importance: "critical",
        evidence: [source],
      }],
      recommendations: [{
        key: "shared-engine-candidate",
        preference: "option",
        optionKey: "shared-governed-engine",
        rationale: "One strict governed engine minimizes host-specific semantic drift while preserving a single inspectable audit boundary.",
        assumptions: ["Every supported host can launch or connect to the exact packaged engine"],
        uncertainty: ["Native supported-platform acceptance remains incomplete"],
        proposedBy: { kind: "agent", id: "gaep-product-analysis" },
        proposedAt: "2026-07-27T00:00:00.000Z",
        evidence: [source],
        authorityBoundary: "recommendation-is-advisory-and-does-not-establish-a-decision-outcome-approval-risk-acceptance-or-action-authority",
      }],
      outcome: {
        state: "unresolved",
        rationale: "No eligible human Decision authority has been established for this exact candidate revision.",
        evidence: [source],
        authorityEligibilityState: "not-established",
        effectivenessState: "pending",
        approvalState: "not-established",
        riskAcceptanceState: "not-granted",
        baselinePromotionState: "not-granted",
        actionAuthorityState: "not-granted",
        authorityBoundary: "recorded-outcome-does-not-establish-authority-eligibility-approval-risk-acceptance-baseline-promotion-or-action-authority",
      },
      authoringLifecycle: "draft",
      revisionDisposition: "candidate",
      operationalEligibilityState: "not-established",
      assumptions: ["The exact Architecture Challenge revision remains the current decision-support input"],
      uncertainty: ["Independent human challenge and supported-host evidence remain incomplete"],
      dissent: [],
      conflicts: [],
      consequences: ["The selected boundary will shape every native host integration and portability contract"],
      risks: ["A wrong boundary selection could create systemic cross-host governance drift or correlated failure"],
      obligations: ["Preserve exact-version evidence and re-open the question on material protocol or host changes"],
      implementationBoundary: "A recorded selection would guide candidate implementation only; separate Approval Determinations and an exact Authorization Grant remain required for any governed effect that needs them.",
      reviewTriggers: ["Architecture Challenge, supported-host evidence, operating authority, or protocol compatibility changes"],
      relationships: [{
        recordKind: "architecture-challenge-model",
        recordId: id("2"),
        revision: 1,
        digest: digest("2"),
        relationship: "depends-on",
        elementKeys: ["shared-engine-decision"],
      }],
      sources: [source],
    }],
    requirementCoverage: [...decisionRegisterRequirementIds]
      .sort((left, right) => left.localeCompare(right))
      .map((requirementId) => ({
        requirementId,
        state: "covered-candidate" as const,
        decisionKeys,
        basis: "The strict candidate record separates recommendations, outcomes, effectiveness, approval, and authority while preserving exact subject, actor, source, state, consequence, and review-trigger bindings.",
        evidence: [source],
      })),
    inconsistencies: [],
    unresolvedQuestions: ["Which eligible human role assignment and standing authority source govern this exact Decision Question?"],
    limitations: ["No owner appointment, authority eligibility, effective Decision, Approval Determination, risk acceptance, baseline promotion, readiness conclusion, release, deployment, or action authority is represented"],
    ...overrides,
  }
}

describe("Decision Register contract", () => {
  it("accepts a complete exact candidate while preserving every authority boundary", () => {
    const parsed = decisionRegisterInputSchema.parse(input())
    expect(parsed.decisions[0]?.outcome).toMatchObject({
      state: "unresolved",
      authorityEligibilityState: "not-established",
      effectivenessState: "pending",
      approvalState: "not-established",
      riskAcceptanceState: "not-granted",
      baselinePromotionState: "not-granted",
      actionAuthorityState: "not-granted",
    })
    expect(parsed.requirementCoverage).toHaveLength(decisionRegisterRequirementIds.length)
  })

  it("keeps recommendations advisory and bound to declared options", () => {
    const base = input()
    expect(() => decisionRegisterInputSchema.parse({
      ...base,
      decisions: base.decisions.map((decision) => ({
        ...decision,
        recommendations: decision.recommendations.map((recommendation) => ({
          ...recommendation,
          optionKey: "invented-option",
        })),
      })),
    })).toThrow(/declared Decision Options/)
    expect(() => decisionRegisterInputSchema.parse({
      ...base,
      decisions: base.decisions.map((decision) => ({
        ...decision,
        recommendations: decision.recommendations.map((recommendation) => ({
          ...recommendation,
          approvalState: "approved",
        })),
      })),
    })).toThrow()
  })

  it("requires attributable human selection but never promotes it to effectiveness or authority", () => {
    const base = input()
    const decision = base.decisions[0]!
    const selected = {
      ...base,
      decisions: [{
        ...decision,
        outcome: {
          ...decision.outcome,
          state: "option-selected" as const,
          optionKey: "shared-governed-engine",
          selectedBy: { kind: "human" as const, id: "named-human-principal" },
          selectedAt: "2026-07-27T01:00:00.000Z",
          rationale: "The named human selected the shared candidate while its authority eligibility remains unestablished and effectiveness remains pending.",
        },
      }],
    }
    expect(decisionRegisterInputSchema.parse(selected).decisions[0]?.outcome.effectivenessState).toBe("pending")
    expect(() => decisionRegisterInputSchema.parse({
      ...selected,
      decisions: selected.decisions.map((entry) => ({
        ...entry,
        outcome: { ...entry.outcome, selectedBy: { kind: "agent", id: "agent-selector" } },
      })),
    })).toThrow()
    expect(() => decisionRegisterInputSchema.parse({
      ...selected,
      decisions: selected.decisions.map((entry) => ({
        ...entry,
        outcome: { ...entry.outcome, effectivenessState: "effective" },
      })),
    })).toThrow()
  })

  it("rejects no-action substitution, missing catalog coverage, private fields, and secrets", () => {
    const base = input()
    const decision = base.decisions[0]!
    expect(() => decisionRegisterInputSchema.parse({
      ...base,
      decisions: [{
        ...decision,
        outcome: {
          ...decision.outcome,
          state: "no-action-selected",
          optionKey: "shared-governed-engine",
          selectedBy: { kind: "human", id: "named-human-principal" },
          selectedAt: "2026-07-27T01:00:00.000Z",
        },
      }],
    })).toThrow(/no-action option/)
    expect(() => decisionRegisterInputSchema.parse({
      ...base,
      requirementCoverage: base.requirementCoverage.slice(1),
    })).toThrow()
    expect(() => decisionRegisterInputSchema.parse({ ...base, privateNotes: "hidden" })).toThrow()
    expect(() => decisionRegisterInputSchema.parse({
      ...base,
      scope: "api_key=sk-live-abcdefghijklmnopqrstuvwxyz123456 is not portable decision context",
    })).toThrow(/secret-shaped/)
  })

  it("binds immutable record revisions to an exact predecessor digest", () => {
    const base = input()
    const record = {
      ...base,
      schemaVersion: 1,
      kind: "decision-register-candidate",
      id: id("3"),
      productId: id("4"),
      revision: 1,
      membershipDigest: digest("5"),
      state: "candidate",
      createdBy: { kind: "human", id: "product-owner" },
      updatedBy: { kind: "human", id: "product-owner" },
      createdAt: "2026-07-27T00:00:00.000Z",
      updatedAt: "2026-07-27T00:00:00.000Z",
      authorityBoundary: "decision-register-is-a-candidate-record-and-does-not-establish-owner-or-authority-assignments-decision-effectiveness-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority",
    } as const
    expect(decisionRegisterSchema.parse(record).revision).toBe(1)
    expect(() => decisionRegisterSchema.parse({ ...record, predecessorDigest: digest("6") })).toThrow(/revision one/)
    expect(() => decisionRegisterSchema.parse({ ...record, revision: 2 })).toThrow(/after revision one/)
  })
})
