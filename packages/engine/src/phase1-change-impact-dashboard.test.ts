import { canonicalDigest } from "@gaep/agent-sdk"
import {
  type Change,
  type Initiative,
  type P0P4ReadinessGateProjection,
  type P5HandoffPackageProjection,
  type Phase1ChangeImpactDashboardRequest,
  type Product,
  type TraceImpact,
} from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { composeChangeImpactDashboard } from "./change-impact-dashboard.js"
import {
  composePhase1ChangeImpactDashboard,
  Phase1ChangeImpactBindingError,
} from "./phase1-change-impact-dashboard.js"

const product: Product = {
  schemaVersion: 1,
  id: "00000000-0000-4000-8000-000000000001",
  kind: "product",
  revision: 4,
  name: "Phase impact fixture",
  summary: "A bounded Phase 1 impact fixture.",
  problem: "Trace evidence must not be reinterpreted as complete impact coverage.",
  affectedUsers: "GAEP operators",
  desiredOutcome: "Every host receives the same conservative output catalog.",
  successSignals: ["Unknown impact remains explicit"],
  firstWorkflow: "Inspect one exact Change against current Phase 1 projections.",
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
  title: "Phase impact Initiative",
  outcome: "Expose bounded impact without synthesizing authority.",
  scope: ["P0-P4 governed outputs"],
  exclusions: [],
  state: "active",
  createdAt: "2026-07-27T00:00:00.000Z",
  updatedAt: "2026-07-27T00:00:00.000Z",
}

const change: Change = {
  schemaVersion: 1,
  id: "00000000-0000-4000-8000-000000000003",
  kind: "change",
  productId: product.id,
  initiativeId: initiative.id,
  revision: 2,
  title: "Add Phase 1 impact coverage",
  summary: "Bind the exact Phase 1 context to bounded Change trace evidence.",
  baseline: { kind: "genesis", declaration: "No Phase 1 impact view exists.", rationale: "First exact projection." },
  state: "active",
  effectEnvelope: ["observe"],
  createdAt: "2026-07-27T00:10:00.000Z",
  updatedAt: "2026-07-27T00:10:00.000Z",
}

const productBinding = { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) }
const initiativeBinding = {
  id: initiative.id,
  revision: initiative.revision ?? 1,
  digest: canonicalDigest(initiative),
  state: initiative.state,
}

function withDigest<T extends Record<string, unknown>>(content: T): T & { snapshotDigest: string } {
  return { ...content, snapshotDigest: canonicalDigest(content) }
}

function readiness(): P0P4ReadinessGateProjection {
  return withDigest({
    schemaVersion: 1,
    kind: "p0-p4-readiness-gate-projection",
    product: productBinding,
    initiative: initiativeBinding,
    status: {
      schemaVersion: 1,
      kind: "p0-p4-readiness-gate-status",
      productId: product.id,
      productRevision: product.revision ?? 1,
      initiativeId: initiative.id,
      initiativeRevision: initiative.revision ?? 1,
      outputCount: 0,
      applicableOutputCount: 0,
      notApplicableOutputCount: 0,
      unresolvedApplicabilityCount: 0,
      satisfiedOutputCount: 0,
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
      result: "not-assessed",
      reasons: ["No current readiness gate candidate is available"],
      assessedAt: "2026-07-27T01:00:00.000Z",
      gateBoundary: "a-passing-gate-is-an-evaluation-result-not-permission",
      authorityBoundary: "p0-p4-readiness-gate-status-is-an-evaluation-result-and-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority",
    },
    observedAt: "2026-07-27T01:01:00.000Z",
    privacyBoundary: "projection-contains-identities-counts-results-and-digests-only-not-output-content-criteria-findings-waiver-rationale-decision-content-evidence-content-source-content-personal-data-secrets-or-credentials",
    authorityBoundary: "p0-p4-readiness-gate-projection-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority",
  }) as P0P4ReadinessGateProjection
}

function handoff(): P5HandoffPackageProjection {
  return withDigest({
    schemaVersion: 1,
    kind: "p5-handoff-package-projection",
    product: productBinding,
    initiative: initiativeBinding,
    status: {
      schemaVersion: 1,
      kind: "p5-handoff-package-status",
      productId: product.id,
      productRevision: product.revision ?? 1,
      initiativeId: initiative.id,
      initiativeRevision: initiative.revision ?? 1,
      itemCount: 0,
      includedItemCount: 0,
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
      readinessResult: "not-assessed",
      transferState: "draft",
      state: "attention-required",
      reasons: ["No current P5 Handoff Package candidate is available"],
      assessedAt: "2026-07-27T01:02:00.000Z",
      handoffBoundary: "handoff-transfers-exact-candidate-context-not-source-ownership-or-authority",
      authorityBoundary: "p5-handoff-package-status-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-or-action-authority",
    },
    observedAt: "2026-07-27T01:03:00.000Z",
    privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-item-content-summaries-omissions-uncertainties-source-content-personal-data-secrets-credentials-or-destinations",
    authorityBoundary: "p5-handoff-package-projection-does-not-establish-acknowledgement-readiness-approval-design-baseline-p5-entry-transfer-write-or-action-authority",
  }) as P5HandoffPackageProjection
}

function request(): Phase1ChangeImpactDashboardRequest {
  return {
    expectedProductId: product.id,
    expectedProductRevision: product.revision ?? 1,
    expectedProductDigest: canonicalDigest(product),
    expectedInitiativeId: initiative.id,
    expectedInitiativeRevision: initiative.revision ?? 1,
    expectedInitiativeDigest: canonicalDigest(initiative),
    expectedChangeId: change.id,
    expectedChangeRevision: change.revision,
    expectedChangeDigest: canonicalDigest(change),
  }
}

function sourceValues() {
  const traceImpact: TraceImpact = {
    subject: { recordType: "change", recordId: change.id, revision: change.revision, digest: canonicalDigest(change) },
    upstream: [],
    downstream: [],
    validatingEvidence: [],
    decisionsAndRisks: [],
    unresolved: [],
    invalid: [],
    stale: [],
    invalidatedByProposedRevision: [],
    coverageBoundary: "absence-of-a-trace-link-does-not-prove-absence-of-impact",
    truncated: false,
    evaluatedAt: "2026-07-27T01:04:00.000Z",
  }
  const changeImpact = composeChangeImpactDashboard(
    { product, change, workItems: [], traceImpact, decisions: [], risks: [] },
    {
      expectedProductId: product.id,
      expectedProductRevision: product.revision ?? 1,
      expectedProductDigest: canonicalDigest(product),
      expectedChangeId: change.id,
      expectedChangeRevision: change.revision,
      expectedChangeDigest: canonicalDigest(change),
    },
    "2026-07-27T01:05:00.000Z",
  )
  return { product, initiative, change, changeImpact, readiness: readiness(), handoff: handoff() }
}

function compose() {
  return composePhase1ChangeImpactDashboard(
    sourceValues(),
    request(),
    "2026-07-27T01:06:00.000Z",
  )
}

describe("Phase 1 Change and Impact dashboard", () => {
  it("keeps all 25 governed output impacts and revalidation states explicitly unestablished", () => {
    const dashboard = compose()
    expect(dashboard.outputs).toHaveLength(25)
    expect(dashboard.coverage).toMatchObject({
      state: "bounded-not-complete",
      impactNotEstablishedOutputCount: 25,
      revalidationNotEstablishedOutputCount: 25,
    })
    expect(dashboard.outputs.every((output) => output.impact.state === "not-established" &&
      output.impact.revalidationState === "not-established")).toBe(true)
    expect(dashboard.governance).toEqual({
      changeApproval: "not-established",
      riskAcceptanceAuthority: "not-established",
      revalidationAuthority: "not-established",
      productOwnerAcceptance: "not-established",
      effectAuthority: "not-established",
    })
  })

  it("binds a canonical digest without exposing private narrative content", () => {
    const dashboard = compose()
    const { snapshotDigest, ...content } = dashboard
    expect(snapshotDigest).toBe(canonicalDigest(content))
    expect(JSON.stringify(dashboard)).not.toContain(product.name)
    expect(JSON.stringify(dashboard)).not.toContain(change.title)
  })

  it("rejects stale exact Initiative and Change bindings", () => {
    expect(() => composePhase1ChangeImpactDashboard(
      sourceValues(),
      { ...request(), expectedChangeRevision: 1 },
    )).toThrow(Phase1ChangeImpactBindingError)
    expect(() => composePhase1ChangeImpactDashboard(
      sourceValues(),
      { ...request(), expectedInitiativeDigest: canonicalDigest("stale") },
    )).toThrow(Phase1ChangeImpactBindingError)
  })

  it("rejects caller-supplied impact and approval claims", () => {
    const baseline = request()
    expect(() => composePhase1ChangeImpactDashboard({} as never, {
      ...baseline,
      impactComplete: true,
      approved: true,
    } as Phase1ChangeImpactDashboardRequest)).toThrow()
    expect(new Phase1ChangeImpactBindingError()).toBeInstanceOf(Error)
  })
})
