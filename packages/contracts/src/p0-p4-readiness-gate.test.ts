import { describe, expect, it } from "vitest"

import {
  p0P4ReadinessGateInputSchema,
  p0P4ReadinessGateProjectionSchema,
  p0P4ReadinessGateSchema,
  p0P4ReadinessGateStatusSchema,
  p0P4ReadinessOutputKinds,
  p0P4ReadinessRequirementIds,
} from "./p0-p4-readiness-gate.js"

const productId = "11111111-1111-4111-8111-111111111111"
const initiativeId = "22222222-2222-4222-8222-222222222222"
const gateId = "33333333-3333-4333-8333-333333333333"
const evidenceRegistryId = "44444444-4444-4444-8444-444444444444"
const traceabilityId = "55555555-5555-4555-8555-555555555555"
const digest = (character: string) => `sha256:${character.repeat(64)}`

const recordKinds = {
  "architecture-challenge-model": "architecture-challenge-model",
  "authorization-model": "authorization-model",
  "bounded-context-ownership": "bounded-context-model",
  "business-architecture-baseline": "business-architecture-baseline",
  "business-capability-map": "business-capability-map",
  "business-rule-catalog": "business-rule-catalog",
  "business-understanding": "business-understanding",
  "candidate-source-baseline": "source-baseline",
  "data-model": "data-model",
  "decision-register": "decision-register",
  "end-to-end-traceability": "end-to-end-traceability-candidate",
  "event-integration-model": "event-integration-model",
  "evidence-registry": "evidence-registry",
  "failure-recovery-model": "failure-recovery-model",
  "initiative-entry": "initiative",
  "operating-model": "operating-model",
  "outcome-success-model": "outcome-model",
  "process-model": "process-model",
  "risk-register": "risk-register",
  "security-privacy-threat-assessment": "security-privacy-threat-assessment",
  "source-intake": "source-record",
  "source-provenance": "source-provenance",
  "stakeholder-role-model": "stakeholder-model",
  "system-solution-architecture": "system-solution-architecture",
  "value-stream-model": "value-stream-model",
} as const

function input() {
  const applicable = new Set(["end-to-end-traceability", "evidence-registry", "initiative-entry"])
  return {
    initiativeId,
    context: {
      productRevision: 7,
      productDigest: digest("a"),
      initiativeRevision: 3,
      initiativeDigest: digest("b"),
    },
    informationClassification: "internal" as const,
    title: "Candidate P0-P4 readiness evaluation",
    scope: "Evaluate the exact applicable P0 through P4 candidate outputs for this Initiative revision.",
    evaluationDefinition: {
      id: "p0-p4-readiness-v1",
      version: "1.0.0",
      digest: digest("c"),
      criteria: ["Applicable outputs have exact current evidence", "Blocking findings remain visible"],
      expectedEvidence: ["Exact Evidence Registry entries", "Exact governed output revisions"],
      evaluatorRequirements: ["Current Product and Initiative access", "Read-only governed record access"],
      independenceRequirements: ["Approval remains outside the evaluator", "Evaluation remains separate from authoring"],
      failureBehavior: "Missing, stale, failed, unavailable or inconclusive evidence keeps the gate from passing.",
      invalidationTriggers: ["Applicable output revision changes", "Evidence freshness or policy changes"],
      authorityBoundary: "evaluation-definition-does-not-grant-approval-readiness-authorization-or-action-authority" as const,
    },
    evidenceRegistry: { recordId: evidenceRegistryId, revision: 4, digest: digest("d") },
    traceability: { recordId: traceabilityId, revision: 2, digest: digest("e") },
    outputs: p0P4ReadinessOutputKinds.map((outputKind, index) => {
      const isApplicable = applicable.has(outputKind)
      return {
        outputKind,
        applicability: isApplicable ? "applicable" as const : "not-applicable-candidate" as const,
        subjects: isApplicable ? [{
          recordKind: recordKinds[outputKind],
          recordId: `${String(index + 1).padStart(8, "0")}-0000-4000-8000-000000000001`,
          revision: 1,
          digest: digest("f"),
        }] : [],
        evaluationState: isApplicable ? "incomplete" as const : "not-applicable-candidate" as const,
        freshness: isApplicable ? "current" as const : "unknown" as const,
        evidenceItemKeys: [],
        waiverKeys: [],
        blockers: [],
        conditions: [],
        findings: isApplicable ? ["Independent evaluation remains pending"] : [],
        assessedBy: { kind: "agent" as const, id: "contract-test" },
        assessedAt: "2026-07-27T00:00:00.000Z",
        basis: isApplicable
          ? "The exact candidate exists, while substantive readiness evaluation remains incomplete."
          : "The candidate applicability decision records this output as not applicable without granting authority.",
        sources: [],
        authorityBoundary: "readiness-output-evaluation-is-candidate-epistemic-state-and-does-not-establish-approval-waiver-acceptance-readiness-phase-entry-implementation-authorization-or-action-authority" as const,
      }
    }),
    waivers: [],
    unresolvedDecisions: [{
      key: "architecture-approval",
      decisionRegister: { recordKind: "decision-register", recordId: "66666666-6666-4666-8666-666666666666", revision: 3, digest: digest("6") },
      decisionKey: "architecture-baseline",
      affectedOutputs: ["business-architecture-baseline" as const],
      state: "open" as const,
      blocking: true,
      basis: "The accountable architecture-baseline decision remains explicitly unresolved.",
    }],
    conditions: [],
    requirementCoverage: p0P4ReadinessRequirementIds.map((requirementId) => ({
      requirementId,
      state: "unresolved" as const,
      outputKinds: [],
      basis: "The requirement remains explicit until its exact evidence and independent evaluation are completed.",
      sources: [],
    })),
    unresolvedQuestions: ["Who holds exact phase-entry authority for this Initiative revision?"],
    inconsistencies: [],
    limitations: ["No live-provider, native-host, Product Owner or independent assurance acceptance is established"],
    readinessAuthorityState: "not-established" as const,
  }
}

function status() {
  return {
    schemaVersion: 1 as const,
    kind: "p0-p4-readiness-gate-status" as const,
    productId,
    productRevision: 7,
    initiativeId,
    initiativeRevision: 3,
    gate: { recordId: gateId, revision: 1, digest: digest("9") },
    outputCount: 25,
    applicableOutputCount: 3,
    notApplicableOutputCount: 22,
    unresolvedApplicabilityCount: 0,
    satisfiedOutputCount: 0,
    conditionalOutputCount: 0,
    incompleteOutputCount: 3,
    failedOutputCount: 0,
    blockedOutputCount: 0,
    staleOrUnknownOutputCount: 0,
    pendingOrInvalidWaiverCount: 0,
    unresolvedDecisionCount: 1,
    unmetConditionCount: 0,
    unresolvedRequirementCount: 37,
    adverseEvidenceCount: 0,
    staleBindingCount: 0,
    staleSourceReferenceCount: 0,
    inconsistencyCount: 0,
    unresolvedQuestionCount: 1,
    result: "incomplete" as const,
    reasons: ["One or more applicable outputs remain incomplete"],
    assessedAt: "2026-07-27T00:00:00.000Z",
    gateBoundary: "a-passing-gate-is-an-evaluation-result-not-permission" as const,
    authorityBoundary: "p0-p4-readiness-gate-status-is-an-evaluation-result-and-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority" as const,
  }
}

describe("P0-P4 Readiness Gate contract", () => {
  it("accepts the complete canonical candidate catalog and keeps the result non-authorizing", () => {
    expect(p0P4ReadinessGateInputSchema.parse(input()).outputs).toHaveLength(25)
    expect(p0P4ReadinessGateStatusSchema.parse(status()).gateBoundary)
      .toBe("a-passing-gate-is-an-evaluation-result-not-permission")
  })

  it("rejects incomplete catalogs, applicability inference, stale satisfaction and unknown waiver links", () => {
    const missingOutput: any = structuredClone(input())
    missingOutput.outputs.pop()
    expect(p0P4ReadinessGateInputSchema.safeParse(missingOutput).success).toBe(false)

    const inferred: any = structuredClone(input())
    inferred.outputs.find((entry: any) => entry.outputKind === "initiative-entry")!.applicability = "unresolved"
    inferred.outputs.find((entry: any) => entry.outputKind === "initiative-entry")!.evaluationState = "satisfied"
    expect(p0P4ReadinessGateInputSchema.safeParse(inferred).success).toBe(false)

    const stale: any = structuredClone(input())
    stale.outputs.find((entry: any) => entry.outputKind === "initiative-entry")!.evaluationState = "satisfied"
    stale.outputs.find((entry: any) => entry.outputKind === "initiative-entry")!.freshness = "stale"
    expect(p0P4ReadinessGateInputSchema.safeParse(stale).success).toBe(false)

    const unknownWaiver: any = structuredClone(input())
    unknownWaiver.outputs.find((entry: any) => entry.outputKind === "initiative-entry")!.waiverKeys = ["missing-waiver"]
    expect(p0P4ReadinessGateInputSchema.safeParse(unknownWaiver).success).toBe(false)
  })

  it("requires exact approval and authorization references for a claimed granted waiver", () => {
    const candidate: any = structuredClone(input())
    candidate.waivers = [{
      key: "architecture-exception",
      outputKinds: ["business-architecture-baseline"],
      rule: "Architecture baseline review",
      scope: "Candidate exception limited to this exact Initiative and architecture revision.",
      state: "granted",
      decision: { register: { recordKind: "decision-register", recordId: "66666666-6666-4666-8666-666666666666", revision: 3, digest: digest("6") }, decisionKey: "architecture-baseline" },
      risk: { register: { recordKind: "risk-register", recordId: "77777777-7777-4777-8777-777777777777", revision: 2, digest: digest("7") }, riskKey: "architecture-exception-risk" },
      owner: { kind: "human", id: "accountable-owner" },
      obligations: ["Complete independent architecture review before expiry"],
      validation: "Re-evaluate the exact architecture and evidence revisions before any dependent decision.",
      rationale: "The claimed exception remains invalid until exact approval and authorization references exist.",
      sources: [],
      authorityBoundary: "readiness-waiver-entry-records-a-claimed-disposition-and-does-not-by-presence-or-state-establish-valid-approval-risk-acceptance-authorization-or-permission",
    }]
    expect(p0P4ReadinessGateInputSchema.safeParse(candidate).success).toBe(false)
  })

  it("rejects secret-shaped values and invalid immutable revision ancestry", () => {
    const secret: any = structuredClone(input())
    secret.limitations = ["Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456"]
    expect(p0P4ReadinessGateInputSchema.safeParse(secret).success).toBe(false)

    const record = {
      ...input(), schemaVersion: 1 as const, kind: "p0-p4-readiness-gate-candidate" as const,
      id: gateId, productId, revision: 2, membershipDigest: digest("8"), state: "candidate" as const,
      createdBy: { kind: "human" as const, id: "product-owner" },
      updatedBy: { kind: "human" as const, id: "product-owner" },
      createdAt: "2026-07-27T00:00:00.000Z", updatedAt: "2026-07-27T00:00:00.000Z",
      authorityBoundary: "p0-p4-readiness-gate-is-a-candidate-evaluation-and-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority" as const,
    }
    expect(p0P4ReadinessGateSchema.safeParse(record).success).toBe(false)
  })

  it("rejects forged projection context and count arithmetic", () => {
    const invalidCounts = structuredClone(status())
    invalidCounts.notApplicableOutputCount = 21
    expect(p0P4ReadinessGateStatusSchema.safeParse(invalidCounts).success).toBe(false)

    const projection = {
      schemaVersion: 1 as const,
      kind: "p0-p4-readiness-gate-projection" as const,
      product: { id: productId, revision: 7, digest: digest("a") },
      initiative: { id: initiativeId, revision: 3, digest: digest("b"), state: "active" as const },
      status: status(),
      gate: {
        id: gateId, revision: 1, digest: digest("9"), membershipDigest: digest("8"), state: "candidate" as const,
        evaluationDefinitionDigest: digest("c"), outputCount: 25, waiverCount: 0,
        unresolvedDecisionCount: 1, conditionCount: 0, updatedAt: "2026-07-27T00:00:00.000Z",
      },
      observedAt: "2026-07-27T00:00:00.000Z",
      privacyBoundary: "projection-contains-identities-counts-results-and-digests-only-not-output-content-criteria-findings-waiver-rationale-decision-content-evidence-content-source-content-personal-data-secrets-or-credentials" as const,
      authorityBoundary: "p0-p4-readiness-gate-projection-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority" as const,
      snapshotDigest: digest("0"),
    }
    expect(p0P4ReadinessGateProjectionSchema.safeParse(projection).success).toBe(true)
    projection.product.revision = 8
    expect(p0P4ReadinessGateProjectionSchema.safeParse(projection).success).toBe(false)
  })
})
