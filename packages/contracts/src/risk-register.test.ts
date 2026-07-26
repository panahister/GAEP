import { describe, expect, it } from "vitest"

import {
  riskRegisterInputSchema,
  riskRegisterRequirementIds,
  riskRegisterSchema,
  type RiskRegisterInput,
} from "./risk-register.js"

const id = (value: string) => `${value.repeat(8).slice(0, 8)}-${value.repeat(4).slice(0, 4)}-4${value.repeat(3).slice(0, 3)}-8${value.repeat(3).slice(0, 3)}-${value.repeat(12).slice(0, 12)}`
const digest = (value: string) => `sha256:${value.repeat(64).slice(0, 64)}` as const

const source = {
  sourceId: id("a"),
  sourceRevision: 1,
  recordDigest: digest("b"),
  contentDigest: digest("c"),
}

function notAssessed(rationale: string) {
  return { state: "not-assessed" as const, rationale }
}

function input(overrides: Partial<RiskRegisterInput> = {}): RiskRegisterInput {
  const riskKeys = ["shared-engine-correlated-failure"]
  return {
    initiativeId: id("d"),
    context: {
      productRevision: 3,
      productDigest: digest("e"),
      initiativeRevision: 2,
      initiativeDigest: digest("f"),
    },
    informationClassification: "internal",
    title: "Candidate Product Risk Register",
    scope: "Record material Product and architecture uncertainty, candidate controls, proposed treatment, residual-risk gaps, evidence, and review triggers without treating estimates or role labels as facts, assignments, approval, or action authority.",
    operatingModel: { recordId: id("1"), revision: 2, digest: digest("1") },
    architectureChallengeModel: { recordId: id("2"), revision: 1, digest: digest("2") },
    securityPrivacyAssessment: { recordId: id("3"), revision: 1, digest: digest("3") },
    decisionRegister: { recordId: id("4"), revision: 1, digest: digest("4") },
    risks: [{
      key: "shared-engine-correlated-failure",
      title: "Shared engine failure affects every native host",
      statement: {
        cause: "Every native host delegates governed Product semantics and persistence to one shared local engine implementation.",
        condition: "A semantic, persistence, packaging, compatibility, or protocol defect reaches the shared engine boundary.",
        consequence: "Multiple native hosts may fail consistently or expose the same governance error before independent detection.",
      },
      affectedObjectives: ["Cross-host governance integrity", "Native Product Studio continuity"],
      affectedScopes: ["Four native Product Studio hosts", "Shared local governed engine"],
      source: {
        kind: "dependency",
        statement: "The shared-engine architecture concentrates governed semantics and persistence in one implementation dependency.",
        activationTrigger: "A shared engine semantic, storage, package, or protocol regression is detected or a compatibility input changes.",
      },
      assessment: {
        methodState: "unresolved",
        likelihoodOrPlausibility: {
          kind: "plausibility",
          ...notAssessed("No approved Risk Profile or plausibility method exists for this candidate scope."),
        },
        impactDimensions: ["Availability", "Governance integrity", "Portability"],
        impactSeverity: notAssessed("No approved impact scale or assessor exists for this candidate scope."),
        exposure: notAssessed("No supported-host operational exposure baseline exists."),
        uncertainty: ["Independent supported-host acceptance and operating evidence remain incomplete"],
        assumptions: ["Every native host consumes the same packaged engine semantics"],
        confidence: notAssessed("No approved confidence method or independent assessment exists."),
        evidence: [source],
      },
      controls: [{
        key: "cross-host-conformance",
        name: "Cross-host conformance gate",
        kind: "detective",
        statement: "Exercise the same governed capability and hostile protocol fixtures through every native host before any supported-host claim.",
        implementationState: "observed-implemented",
        effectivenessState: "not-assessed",
        ownerRoleKey: "platform-quality-owner",
        ownerAssignmentState: "not-established",
        evidence: [source],
        failureBehavior: "A failed or missing host receipt keeps conformance and readiness incomplete and must not be converted to acceptance.",
        reviewTriggers: ["Host, engine, protocol, package, or conformance catalog changes"],
      }],
      treatment: {
        kind: "reduce",
        state: "proposed",
        rationale: "Independent host projections, hostile fixtures, deterministic packages, and fail-closed bindings reduce silent semantic drift and correlated release risk.",
        actions: ["Preserve exact host receipts", "Run cross-host negative cases for every governed capability"],
        controlKeys: ["cross-host-conformance"],
        ownerRoleKey: "platform-quality-owner",
        ownerAssignmentState: "not-established",
        dueOrReviewCondition: "Review before any supported-host acceptance, baseline promotion, readiness conclusion, release, deployment, or material engine or protocol change.",
        evidence: [source],
        authorityBoundary: "risk-treatment-is-proposed-and-does-not-establish-owner-assignment-control-effectiveness-risk-acceptance-or-action-authority",
      },
      residualRisk: {
        state: "not-assessed",
        statement: "Correlated implementation and package defects remain possible even when every local conformance receipt passes.",
        uncertainty: ["No native supported-platform acceptance evidence exists for every host"],
        evidence: [source],
        acceptanceState: "not-granted",
        acceptanceDecisionState: "not-established",
        approverAuthorityState: "not-established",
        validityState: "not-established",
        conditions: [],
        reviewTriggers: ["Independent acceptance, incident, material architecture change, or new risk evidence"],
        authorityBoundary: "residual-risk-description-does-not-establish-risk-acceptance-approval-exception-baseline-promotion-readiness-or-action-authority",
      },
      ownerRoleKey: "platform-quality-owner",
      ownerAssignmentState: "not-established",
      authoringLifecycle: "draft",
      revisionDisposition: "candidate",
      operationalEligibilityState: "not-established",
      reviewTriggers: ["Architecture, operating model, protocol, package, or host evidence changes"],
      escalationTriggers: ["A shared defect affects more than one host or invalidates governed records"],
      invalidationTriggers: ["The shared-engine architecture or exact upstream candidate revision changes"],
      relatedRecords: [{
        recordKind: "decision-record",
        recordId: id("4"),
        revision: 1,
        digest: digest("4"),
        relationship: "depends-on",
        elementKeys: ["shared-engine-boundary"],
      }],
      sources: [source],
    }],
    requirementCoverage: [...riskRegisterRequirementIds]
      .sort((left, right) => left.localeCompare(right))
      .map((requirementId) => ({
        requirementId,
        state: "covered-candidate" as const,
        riskKeys,
        basis: "The strict candidate record preserves exact scope, source, assessment method state, evidence, controls, proposed treatment, owner-role trace, residual risk, acceptance gaps, and review triggers without synthesizing authority.",
        evidence: [source],
      })),
    inconsistencies: [],
    unresolvedQuestions: ["Which approved Risk Profile, assessor assignment, owner assignment, and residual-risk acceptance authority govern this exact scope?"],
    limitations: ["No assessment fact, owner appointment, control-effectiveness conclusion, Risk Acceptance, Approval Determination, exception, baseline promotion, readiness conclusion, release, deployment, or action authority is represented"],
    ...overrides,
  }
}

describe("Risk Register contract", () => {
  it("accepts a complete exact candidate while preserving assessment and authority boundaries", () => {
    const parsed = riskRegisterInputSchema.parse(input())
    expect(parsed.risks[0]?.assessment.methodState).toBe("unresolved")
    expect(parsed.risks[0]?.residualRisk.acceptanceState).toBe("not-granted")
    expect(parsed.risks[0]?.ownerAssignmentState).toBe("not-established")
    expect(parsed.requirementCoverage).toHaveLength(riskRegisterRequirementIds.length)
  })

  it("requires an exact method before accepting candidate assessment values", () => {
    const base = input()
    const risk = base.risks[0]!
    expect(() => riskRegisterInputSchema.parse({
      ...base,
      risks: [{
        ...risk,
        assessment: {
          ...risk.assessment,
          likelihoodOrPlausibility: {
            ...risk.assessment.likelihoodOrPlausibility,
            state: "candidate-estimate",
            value: "likely",
          },
        },
      }],
    })).toThrow(/declared assessment method/)
    const assessed = riskRegisterInputSchema.parse({
      ...base,
      risks: [{
        ...risk,
        assessment: {
          ...risk.assessment,
          methodState: "candidate-declared",
          methodName: "Candidate qualitative method",
          methodVersion: "0.1.0",
          likelihoodOrPlausibility: {
            ...risk.assessment.likelihoodOrPlausibility,
            state: "candidate-estimate",
            value: "likely",
          },
        },
      }],
    })
    expect(assessed.risks[0]?.assessment.likelihoodOrPlausibility.value).toBe("likely")
  })

  it("keeps treatment proposed, owner assignment unestablished, and residual acceptance ungranted", () => {
    const base = input()
    const risk = base.risks[0]!
    for (const patch of [
      { treatment: { ...risk.treatment, state: "approved" } },
      { ownerAssignmentState: "established" },
      { residualRisk: { ...risk.residualRisk, acceptanceState: "granted" } },
      { operationalEligibilityState: "eligible" },
    ]) {
      expect(() => riskRegisterInputSchema.parse({ ...base, risks: [{ ...risk, ...patch }] })).toThrow()
    }
  })

  it("rejects undeclared controls, missing catalog coverage, private fields, and secrets", () => {
    const base = input()
    const risk = base.risks[0]!
    expect(() => riskRegisterInputSchema.parse({
      ...base,
      risks: [{ ...risk, treatment: { ...risk.treatment, controlKeys: ["invented-control"] } }],
    })).toThrow(/declared Risk Controls/)
    expect(() => riskRegisterInputSchema.parse({ ...base, requirementCoverage: base.requirementCoverage.slice(1) })).toThrow()
    expect(() => riskRegisterInputSchema.parse({ ...base, privateNotes: "hidden" })).toThrow()
    expect(() => riskRegisterInputSchema.parse({
      ...base,
      scope: "api_key=sk-live-abcdefghijklmnopqrstuvwxyz123456 is not portable risk context",
    })).toThrow(/secret-shaped/)
  })

  it("binds immutable record revisions to an exact predecessor digest", () => {
    const base = input()
    const record = {
      ...base,
      schemaVersion: 1,
      kind: "risk-register-candidate",
      id: id("5"),
      productId: id("6"),
      revision: 1,
      membershipDigest: digest("7"),
      state: "candidate",
      createdBy: { kind: "human", id: "risk-author" },
      updatedBy: { kind: "human", id: "risk-author" },
      createdAt: "2026-07-27T00:00:00.000Z",
      updatedAt: "2026-07-27T00:00:00.000Z",
      authorityBoundary: "risk-register-is-a-candidate-record-and-does-not-establish-owner-or-authority-assignments-assessment-fact-control-effectiveness-risk-acceptance-approval-exception-baseline-promotion-readiness-or-action-authority",
    } as const
    expect(riskRegisterSchema.parse(record).revision).toBe(1)
    expect(() => riskRegisterSchema.parse({ ...record, predecessorDigest: digest("8") })).toThrow(/revision one/)
    expect(() => riskRegisterSchema.parse({ ...record, revision: 2 })).toThrow(/after revision one/)
  })
})
