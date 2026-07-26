import { describe, expect, it } from "vitest"

import {
  evidenceRegistryInputSchema,
  evidenceRegistryRequirementIds,
  evidenceRegistrySchema,
  type EvidenceRegistryInput,
} from "./evidence-registry.js"

const id = (value: string) => `${value.repeat(8).slice(0, 8)}-${value.repeat(4).slice(0, 4)}-4${value.repeat(3).slice(0, 3)}-8${value.repeat(3).slice(0, 3)}-${value.repeat(12).slice(0, 12)}`
const digest = (value: string) => `sha256:${value.repeat(64).slice(0, 64)}` as const

const source = {
  sourceId: id("a"),
  sourceRevision: 1,
  recordDigest: digest("b"),
  contentDigest: digest("c"),
}

const claimAssessmentBoundary = "claim-assessment-is-attributed-epistemic-state-and-does-not-establish-review-approval-assurance-risk-acceptance-readiness-or-action-authority" as const
const evidenceAssessmentBoundary = "evidence-assessment-is-scoped-to-declared-claims-and-does-not-certify-other-subjects-versions-environments-configurations-or-claims" as const

function input(overrides: Partial<EvidenceRegistryInput> = {}): EvidenceRegistryInput {
  const claimKeys = ["current-cross-host-conformance"]
  const evidenceKeys = ["local-conformance-receipt"]
  return {
    initiativeId: id("d"),
    context: {
      productRevision: 3,
      productDigest: digest("e"),
      initiativeRevision: 2,
      initiativeDigest: digest("f"),
    },
    informationClassification: "internal",
    title: "Candidate Product Evidence Registry",
    scope: "Record claim-bounded, attributable, versioned Evidence Item metadata and explicit support, contradiction, and qualification warrants without treating record presence or favorable output as proof, approval, assurance, readiness, or action authority.",
    operatingModel: { recordId: id("0"), revision: 1, digest: digest("0") },
    architectureChallengeModel: { recordId: id("1"), revision: 1, digest: digest("1") },
    securityPrivacyAssessment: { recordId: id("2"), revision: 1, digest: digest("2") },
    decisionRegister: { recordId: id("3"), revision: 1, digest: digest("3") },
    riskRegister: { recordId: id("4"), revision: 1, digest: digest("4") },
    claims: [{
      key: "current-cross-host-conformance",
      type: "conformance-claim",
      ownerRoleKey: "platform-quality-owner",
      ownerAssignmentState: "not-established",
      statement: "The exact candidate shared-engine capability set has equivalent deterministic source and package behavior across the four declared native host projections for the recorded local snapshot only.",
      falsificationConditions: ["Any declared host capability marker, behavior receipt, package byte, or source snapshot differs from the exact recorded snapshot"],
      subjects: [{
        recordKind: "decision-record",
        recordId: id("3"),
        revision: 1,
        digest: digest("3"),
        relationship: "depends-on",
        elementKeys: ["shared-engine-boundary"],
      }],
      scope: ["Declared local four-host candidate capability snapshot"],
      environment: ["Recorded local deterministic test environment"],
      configuration: ["Exact source, contract, package, and evidence digests"],
      validFrom: "2026-07-27T00:00:00.000Z",
      applicableRequirements: ["gaep-cae-req-001"],
      applicablePolicies: [],
      relatedRiskKeys: ["shared-engine-correlated-failure"],
      assumptions: ["The recorded evidence producer and integrity path remain attributable"],
      requiredEvidenceClasses: ["Exact source snapshot and deterministic host behavior receipt"],
      acceptanceCriteria: ["Every declared host capability and deterministic behavior check passes against exact package bytes"],
      assessment: {
        state: "not-assessed",
        evidenceLinkKeys: [],
        rationale: "No accountable independent evaluator has assessed this candidate Claim and its exact Evidence links.",
        authorityBoundary: claimAssessmentBoundary,
      },
      knownGaps: ["Native supported-platform and human acceptance evidence is absent"],
      exclusions: ["Live-provider, native accessibility, release, deployment, and Product Owner acceptance"],
      residualUncertainty: ["Local deterministic coverage cannot establish supported-host behavior"],
      defeaters: ["A stale source binding, changed package byte, adverse host result, or omitted platform limitation"],
      reviewTriggers: ["Contract, source, package, host, provider, or acceptance state changes"],
      expiryTriggers: ["Declared evidence validity interval ends or a bound artifact changes"],
      invalidationTriggers: ["Any exact subject, environment, configuration, package, or evidence digest changes"],
      supersessionTriggers: ["A newer attributable registry revision binds replacement evidence"],
      authoringLifecycle: "draft",
      revisionDisposition: "candidate",
      operationalEligibilityState: "not-established",
    }],
    evidenceItems: [{
      key: "local-conformance-receipt",
      evidenceId: id("5"),
      evidenceRevision: 1,
      evidenceDigest: digest("5"),
      type: "deterministic-conformance-receipt",
      producer: { kind: "system", id: "gaep-local-conformance-runner" },
      capturedAt: "2026-07-27T00:01:00.000Z",
      subjects: [{
        recordKind: "decision-record",
        recordId: id("3"),
        revision: 1,
        digest: digest("3"),
        relationship: "depends-on",
        elementKeys: ["shared-engine-boundary"],
      }],
      claimKeys,
      outcome: "inconclusive",
      observation: "All declared deterministic local host-capability checks passed, while native supported-platform and human acceptance remain unavailable and explicitly outside this observation.",
      method: {
        name: "GAEP deterministic host conformance",
        version: "1.0.0",
        criteria: ["Exact contract, source marker, behavior receipt, and package digest agreement"],
        procedureVersion: "1.0.0",
        tools: ["GAEP local evidence runner"],
        configuration: ["Exact repository snapshot and isolated package lifecycle fixtures"],
        environment: ["Local developer workstation"],
        dataReferences: ["Privacy-safe generated receipt digests"],
        limitations: ["No native supported-platform or real-account acceptance is exercised"],
        reproducibilityConditions: ["Use the exact repository revision, toolchain, fixtures, package bytes, and declared commands"],
      },
      sources: [source],
      provenanceDigest: digest("6"),
      integrityDigest: digest("7"),
      evaluatorOrExecutor: { kind: "system", id: "gaep-local-conformance-runner" },
      independenceCharacteristics: ["Producer and evaluator are the same deterministic local capability"],
      informationClassification: "internal",
      permittedRecipientRoles: ["GAEP Assurance Authority"],
      retentionState: "active-retention",
      retentionObligations: ["Preserve unfavorable, failed, and inconclusive outcomes with the exact subject and source snapshot"],
      disposalObligations: ["Follow the controlling Data, Audit, and records-retention policies"],
      authoringLifecycle: "finalized",
      assessment: {
        state: "not-assessed",
        declaredClaimKeys: [],
        rationale: "No accountable human assessor has determined fitness for any declared Claim scope.",
        authorityBoundary: evidenceAssessmentBoundary,
      },
      freshness: "current",
      validity: "valid",
      revisionDisposition: "candidate",
      operationalEligibility: "eligible",
      quality: ([
        "authenticity", "coverage", "freshness", "independence", "integrity",
        "interpretability", "relevance", "reproducibility", "sensitivity", "validity",
      ] as const).map((dimension) => ({
        dimension,
        state: "not-assessed" as const,
        rationale: "This quality dimension has not been assessed by an accountable independent evaluator.",
      })),
      limitations: ["The result is bounded to local deterministic behavior and exact recorded inputs"],
      anomalies: [],
      expiryTriggers: ["The declared evidence validity interval ends"],
      invalidationTriggers: ["Any subject, source, method, tool, configuration, environment, data, or package digest changes"],
      supersessionTriggers: ["A newer exact Evidence Item revision is recorded"],
      adverseDispositionState: "pending-governed-disposition",
      authorityBoundary: "evidence-item-is-attributable-metadata-and-does-not-by-presence-or-outcome-prove-a-claim-grant-approval-establish-assurance-or-authorize-action",
    }],
    links: [{
      key: "local-receipt-qualifies-current-conformance",
      claimKey: "current-cross-host-conformance",
      evidenceKey: "local-conformance-receipt",
      relationship: "qualifies",
      warrant: "The exact local receipt qualifies the Claim by showing deterministic agreement only within its recorded source, package, fixture, configuration, and environment boundaries.",
      scope: ["Exact local deterministic snapshot only"],
      limitations: ["No native supported-platform, live-provider, human, accessibility, readiness, release, or deployment conclusion follows"],
      sufficiencyState: "not-established",
      acceptedForClaimState: "not-established",
      authorityBoundary: "claim-evidence-link-records-a-candidate-warrant-and-does-not-establish-evidence-sufficiency-claim-validation-assurance-approval-or-action-authority",
    }],
    requirementCoverage: [...evidenceRegistryRequirementIds]
      .sort((left, right) => left.localeCompare(right))
      .map((requirementId) => ({
        requirementId,
        state: "covered-candidate" as const,
        claimKeys,
        evidenceKeys,
        basis: "The candidate registry preserves exact subjects, attributable Evidence metadata, explicit warrants, adverse results, orthogonal state, freshness, history, limits and authority boundaries.",
        sources: [source],
      })),
    unresolvedQuestions: ["Which accountable independent evaluator and effective Assurance Profile govern this exact Claim and Evidence scope?"],
    inconsistencies: [],
    limitations: ["No Claim validation, Evidence sufficiency, Assurance Case conclusion, Review, Approval, Risk Acceptance, baseline promotion, readiness, release, deployment, or action authority is represented"],
    ...overrides,
  }
}

describe("Evidence Registry contract", () => {
  it("accepts a complete exact candidate while preserving assessment and authority boundaries", () => {
    const parsed = evidenceRegistryInputSchema.parse(input())
    expect(parsed.claims[0]?.assessment.state).toBe("not-assessed")
    expect(parsed.evidenceItems[0]?.outcome).toBe("inconclusive")
    expect(parsed.links[0]?.sufficiencyState).toBe("not-established")
    expect(parsed.requirementCoverage).toHaveLength(evidenceRegistryRequirementIds.length)
  })

  it("requires exact human attribution for non-empty Claim and Evidence assessments", () => {
    const base = input()
    const claim = base.claims[0]!
    expect(() => evidenceRegistryInputSchema.parse({
      ...base,
      claims: [{ ...claim, assessment: { ...claim.assessment, state: "supported" } }],
    })).toThrow(/human assessor/)
    const evidence = base.evidenceItems[0]!
    expect(() => evidenceRegistryInputSchema.parse({
      ...base,
      evidenceItems: [{ ...evidence, assessment: { ...evidence.assessment, state: "fit-for-declared-use" } }],
    })).toThrow(/human assessor/)
  })

  it("retains adverse and inconclusive Evidence for visible governed disposition", () => {
    const base = input()
    const evidence = base.evidenceItems[0]!
    expect(() => evidenceRegistryInputSchema.parse({
      ...base,
      evidenceItems: [{ ...evidence, adverseDispositionState: "not-required" }],
    })).toThrow(/visible governed disposition/)
  })

  it("rejects dangling graph references, missing catalog coverage, private fields, and secrets", () => {
    const base = input()
    expect(() => evidenceRegistryInputSchema.parse({
      ...base,
      links: [{ ...base.links[0]!, evidenceKey: "invented-evidence" }],
    })).toThrow(/declared Claims and Evidence Items/)
    expect(() => evidenceRegistryInputSchema.parse({ ...base, requirementCoverage: base.requirementCoverage.slice(1) })).toThrow()
    expect(() => evidenceRegistryInputSchema.parse({ ...base, privateNotes: "hidden" })).toThrow()
    expect(() => evidenceRegistryInputSchema.parse({
      ...base,
      scope: "api_key=sk-live-abcdefghijklmnopqrstuvwxyz123456 must never enter portable evidence metadata",
    })).toThrow(/secret-shaped/)
  })

  it("binds immutable record revisions to an exact predecessor digest", () => {
    const base = input()
    const record = {
      ...base,
      schemaVersion: 1,
      kind: "evidence-registry-candidate",
      id: id("8"),
      productId: id("9"),
      revision: 1,
      membershipDigest: digest("8"),
      state: "candidate",
      createdBy: { kind: "human", id: "evidence-author" },
      updatedBy: { kind: "human", id: "evidence-author" },
      createdAt: "2026-07-27T00:00:00.000Z",
      updatedAt: "2026-07-27T00:00:00.000Z",
      authorityBoundary: "evidence-registry-is-a-candidate-record-and-does-not-establish-claim-validation-evidence-sufficiency-assurance-review-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority",
    } as const
    expect(evidenceRegistrySchema.parse(record).revision).toBe(1)
    expect(() => evidenceRegistrySchema.parse({ ...record, predecessorDigest: digest("9") })).toThrow(/revision one/)
    expect(() => evidenceRegistrySchema.parse({ ...record, revision: 2 })).toThrow(/after revision one/)
  })
})
