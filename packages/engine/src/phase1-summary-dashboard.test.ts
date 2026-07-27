import { canonicalDigest } from "@gaep/agent-sdk"
import {
  type Initiative,
  type P0P4ReadinessGateProjection,
  type P5HandoffPackageProjection,
  type Phase1SummaryDashboardRequest,
  type Product,
} from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { composePhase1SummaryDashboard, Phase1SummaryBindingError } from "./phase1-summary-dashboard.js"

const product: Product = {
  schemaVersion: 1,
  id: "00000000-0000-4000-8000-000000000001",
  kind: "product",
  revision: 4,
  name: "Phase summary fixture",
  summary: "A bounded Phase 1 summary fixture",
  problem: "Phase status must remain exact and conservative.",
  affectedUsers: "GAEP operators",
  desiredOutcome: "Every host receives the same exact summary.",
  successSignals: ["The governed projections reconcile"],
  firstWorkflow: "Compose a summary from exact readiness and handoff projections.",
  exclusions: [],
  profile: "internal-tool",
  lifecycleState: "active",
  createdAt: "2026-07-27T00:00:00.000Z",
  updatedAt: "2026-07-27T00:00:00.000Z",
}

const initiative: Initiative = {
  schemaVersion: 1,
  id: "00000000-0000-4000-8000-000000000002",
  kind: "initiative",
  revision: 3,
  productId: product.id,
  title: "Phase summary Initiative",
  outcome: "Expose exact Phase 1 progress without synthesizing authority.",
  scope: ["P0-P4 readiness and P5 handoff status"],
  exclusions: [],
  state: "active",
  createdAt: "2026-07-27T00:00:00.000Z",
  updatedAt: "2026-07-27T00:00:00.000Z",
}

const digest = (value: string): `sha256:${string}` => canonicalDigest(value) as `sha256:${string}`
const productBinding = { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) }
const initiativeBinding = {
  id: initiative.id,
  revision: initiative.revision ?? 1,
  digest: canonicalDigest(initiative),
  state: initiative.state,
}

function readiness(passed = false): P0P4ReadinessGateProjection {
  const status: P0P4ReadinessGateProjection["status"] = {
    schemaVersion: 1,
    kind: "p0-p4-readiness-gate-status",
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    ...(passed ? { gate: { recordId: "00000000-0000-4000-8000-000000000003", revision: 1, digest: digest("gate") } } : {}),
    outputCount: passed ? 25 : 0,
    applicableOutputCount: passed ? 25 : 0,
    notApplicableOutputCount: 0,
    unresolvedApplicabilityCount: 0,
    satisfiedOutputCount: passed ? 25 : 0,
    conditionalOutputCount: 0,
    incompleteOutputCount: 0,
    failedOutputCount: 0,
    blockedOutputCount: 0,
    staleOrUnknownOutputCount: 0,
    pendingOrInvalidWaiverCount: 0,
    unresolvedDecisionCount: 0,
    unmetConditionCount: 0,
    unresolvedRequirementCount: 0,
    adverseEvidenceCount: 0,
    staleBindingCount: 0,
    staleSourceReferenceCount: 0,
    inconsistencyCount: 0,
    unresolvedQuestionCount: 0,
    result: passed ? "passed" : "not-assessed",
    reasons: passed ? [] : ["No current readiness gate candidate is available"],
    assessedAt: "2026-07-27T01:00:00.000Z",
    gateBoundary: "a-passing-gate-is-an-evaluation-result-not-permission",
    authorityBoundary: "p0-p4-readiness-gate-status-is-an-evaluation-result-and-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority",
  }
  return {
    schemaVersion: 1,
    kind: "p0-p4-readiness-gate-projection",
    product: productBinding,
    initiative: initiativeBinding,
    status,
    ...(passed ? {
      gate: {
        id: status.gate!.recordId,
        revision: status.gate!.revision,
        digest: status.gate!.digest,
        membershipDigest: digest("membership"),
        state: "candidate",
        evaluationDefinitionDigest: digest("definition"),
        outputCount: 25,
        waiverCount: 0,
        unresolvedDecisionCount: 0,
        conditionCount: 0,
        updatedAt: "2026-07-27T00:30:00.000Z",
      },
    } : {}),
    observedAt: "2026-07-27T01:01:00.000Z",
    privacyBoundary: "projection-contains-identities-counts-results-and-digests-only-not-output-content-criteria-findings-waiver-rationale-decision-content-evidence-content-source-content-personal-data-secrets-or-credentials",
    authorityBoundary: "p0-p4-readiness-gate-projection-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority",
    snapshotDigest: digest(passed ? "readiness-passed" : "readiness-not-assessed"),
  }
}

function handoff(complete = false): P5HandoffPackageProjection {
  const status: P5HandoffPackageProjection["status"] = {
    schemaVersion: 1,
    kind: "p5-handoff-package-status",
    productId: product.id,
    productRevision: product.revision ?? 1,
    initiativeId: initiative.id,
    initiativeRevision: initiative.revision ?? 1,
    ...(complete ? { handoff: { recordId: "00000000-0000-4000-8000-000000000004", revision: 2, digest: digest("handoff") } } : {}),
    itemCount: complete ? 25 : 0,
    includedItemCount: complete ? 25 : 0,
    referenceOnlyItemCount: 0,
    omittedNotApplicableItemCount: 0,
    unresolvedItemCount: 0,
    staleOrUnknownItemCount: 0,
    lossyTransformationCount: 0,
    unresolvedRequirementCount: 0,
    conflictCount: 0,
    unresolvedQuestionCount: 0,
    staleBindingCount: 0,
    staleSourceReferenceCount: 0,
    readinessResult: complete ? "passed" : "not-assessed",
    transferState: complete ? "ready-for-human-review" : "draft",
    state: complete ? "complete-for-review" : "attention-required",
    reasons: complete ? [] : ["No current P5 Handoff Package candidate is available"],
    assessedAt: "2026-07-27T01:02:00.000Z",
    handoffBoundary: "handoff-transfers-exact-candidate-context-not-source-ownership-or-authority",
    authorityBoundary: "p5-handoff-package-status-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-or-action-authority",
  }
  return {
    schemaVersion: 1,
    kind: "p5-handoff-package-projection",
    product: productBinding,
    initiative: initiativeBinding,
    status,
    ...(complete ? {
      handoff: {
        id: status.handoff!.recordId,
        revision: status.handoff!.revision,
        digest: status.handoff!.digest,
        membershipDigest: digest("handoff-membership"),
        state: "candidate",
        readinessStatusDigest: digest("readiness-status"),
        itemCount: 25,
        requirementCount: 66,
        deliveryMode: "repository",
        updatedAt: "2026-07-27T00:45:00.000Z",
      },
    } : {}),
    observedAt: "2026-07-27T01:03:00.000Z",
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-item-content-summaries-omissions-uncertainties-source-content-personal-data-secrets-credentials-or-destinations",
    authorityBoundary: "p5-handoff-package-projection-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-write-or-action-authority",
    snapshotDigest: digest(complete ? "handoff-complete" : "handoff-attention"),
  }
}

function request(): Phase1SummaryDashboardRequest {
  return {
    expectedProductId: product.id,
    expectedProductRevision: product.revision ?? 1,
    expectedProductDigest: canonicalDigest(product),
    expectedInitiativeId: initiative.id,
    expectedInitiativeRevision: initiative.revision ?? 1,
    expectedInitiativeDigest: canonicalDigest(initiative),
  }
}

describe("Phase 1 summary and readiness dashboard", () => {
  it("projects exact attention state without inventing owners or authority", () => {
    const readinessProjection = readiness()
    const handoffProjection = handoff()
    const summary = composePhase1SummaryDashboard(
      product,
      initiative,
      readinessProjection,
      handoffProjection,
      request(),
      "2026-07-27T01:04:00.000Z",
    )
    expect(summary.phaseStatus).toEqual({
      state: "attention-required",
      declaredGapCount: 0,
      attentionSignalCount: 2,
      productOwnerAcceptance: "not-established",
      readinessAuthority: "not-established",
      phaseEntryAuthority: "not-established",
    })
    expect(summary.owners).toEqual({
      state: "unbound",
      boundOwnerCount: 0,
      basis: "no-governed-phase-owner-assignment-is-bound",
    })
    expect(summary.readiness.reasonCount).toBe(1)
    expect(summary.handoff.reasonCount).toBe(1)
    const { snapshotDigest, ...content } = summary
    expect(snapshotDigest).toBe(canonicalDigest(content))
  })

  it("distinguishes candidate completeness from human acceptance and readiness authority", () => {
    const readinessProjection = readiness(true)
    const handoffProjection = handoff(true)
    const summary = composePhase1SummaryDashboard(
      product,
      initiative,
      readinessProjection,
      handoffProjection,
      request(),
      "2026-07-27T01:04:00.000Z",
    )
    expect(summary.phaseStatus).toMatchObject({
      state: "candidate-complete-for-human-review",
      declaredGapCount: 0,
      attentionSignalCount: 0,
      productOwnerAcceptance: "not-established",
      readinessAuthority: "not-established",
    })
    expect(summary.readiness.outputs).toMatchObject({ total: 25, applicable: 25, satisfied: 25 })
    expect(summary.handoff.items).toMatchObject({ total: 25, included: 25 })
  })

  it("exposes stale governed bindings through gap and freshness counts", () => {
    const readinessProjection = readiness()
    readinessProjection.status.staleBindingCount = 1
    const handoffProjection = handoff()
    handoffProjection.status.staleSourceReferenceCount = 2
    const summary = composePhase1SummaryDashboard(
      product,
      initiative,
      readinessProjection,
      handoffProjection,
      request(),
      "2026-07-27T01:04:00.000Z",
    )
    expect(summary.phaseStatus).toMatchObject({ declaredGapCount: 3, attentionSignalCount: 3 })
    expect(summary.freshness).toMatchObject({
      state: "attention-required",
      staleBindingCount: 1,
      staleSourceReferenceCount: 2,
    })
    expect(summary.evidenceCues.freshness).toBe("potentially-stale")
  })

  it.each([
    ["Product", { expectedProductRevision: 2 }],
    ["Initiative", { expectedInitiativeDigest: digest("stale-initiative") }],
  ])("rejects stale exact %s bindings", (_label, change) => {
    const readinessProjection = readiness()
    const handoffProjection = handoff()
    expect(() => composePhase1SummaryDashboard(
      product,
      initiative,
      readinessProjection,
      handoffProjection,
      { ...request(), ...change },
    )).toThrow(Phase1SummaryBindingError)
  })

  it("rejects readiness or handoff projections bound to another Initiative revision", () => {
    const readinessProjection = readiness()
    readinessProjection.initiative.revision = 2
    const handoffProjection = handoff()
    expect(() => composePhase1SummaryDashboard(
      product,
      initiative,
      readinessProjection,
      handoffProjection,
      request(),
    )).toThrow()
  })

  it("rejects caller-supplied readiness and owner claims", () => {
    const readinessProjection = readiness()
    const handoffProjection = handoff()
    expect(() => composePhase1SummaryDashboard(
      product,
      initiative,
      readinessProjection,
      handoffProjection,
      { ...request(), ready: true, owner: "caller" } as Phase1SummaryDashboardRequest,
    )).toThrow()
  })
})
