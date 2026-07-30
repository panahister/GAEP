import { canonicalDigest } from "@gaep/agent-sdk"
import {
  type DesignDriftDetectionProjection,
  type Initiative,
  type Phase2UxFigmaDashboardRequest,
  type Product,
} from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { composePhase2UxFigmaDashboard, Phase2UxFigmaDashboardBindingError } from "./phase2-ux-figma-dashboard.js"

const product: Product = {
  schemaVersion: 1,
  id: "00000000-0000-4000-8000-000000000001",
  kind: "product",
  revision: 4,
  name: "Phase 2 dashboard fixture",
  summary: "A bounded Phase 2 UX and Figma dashboard fixture",
  problem: "Design state is fragmented across governed projections.",
  affectedUsers: "Product owners, designers, reviewers, and engineers",
  desiredOutcome: "One derived read-only view exposes exact Phase 2 evidence without becoming authoritative.",
  successSignals: ["All source bindings remain exact and explicit"],
  firstWorkflow: "Inspect Phase 2 state and follow the next governed action.",
  exclusions: ["Automatic approval", "Automatic Figma or implementation effects"],
  profile: "internal-tool",
  lifecycleState: "active",
  createdAt: "2026-07-30T03:00:00.000Z",
  updatedAt: "2026-07-30T03:00:00.000Z",
}

const initiative: Initiative = {
  schemaVersion: 1,
  id: "00000000-0000-4000-8000-000000000002",
  kind: "initiative",
  revision: 3,
  productId: product.id,
  title: "Phase 2 dashboard Initiative",
  outcome: "Expose exact UX and Figma evidence without synthesizing readiness.",
  scope: ["P2-01 through P2-23 derived state"],
  exclusions: ["Approval, baseline, readiness, Figma, remediation, or implementation authority"],
  state: "active",
  createdAt: "2026-07-30T03:00:00.000Z",
  updatedAt: "2026-07-30T03:00:00.000Z",
}

const digest = (value: string): `sha256:${string}` => canonicalDigest(value) as `sha256:${string}`
const productBinding = { id: product.id, revision: product.revision ?? 1, digest: canonicalDigest(product) }
const initiativeBinding = {
  id: initiative.id,
  revision: initiative.revision ?? 1,
  digest: canonicalDigest(initiative),
  state: initiative.state,
}

function request(): Phase2UxFigmaDashboardRequest {
  return {
    expectedProductId: product.id,
    expectedProductRevision: product.revision ?? 1,
    expectedProductDigest: canonicalDigest(product),
    expectedInitiativeId: initiative.id,
    expectedInitiativeRevision: initiative.revision ?? 1,
    expectedInitiativeDigest: canonicalDigest(initiative),
  }
}

function driftProjection(): DesignDriftDetectionProjection {
  return {
    schemaVersion: 1,
    kind: "design-drift-detection-projection",
    product: productBinding,
    initiative: initiativeBinding,
    status: {
      schemaVersion: 1,
      kind: "design-drift-detection-status",
      productId: product.id,
      productRevision: product.revision ?? 1,
      initiativeId: initiative.id,
      initiativeRevision: initiative.revision ?? 1,
      implementationTargetCount: 2,
      humanReviewedImplementationTargetCount: 1,
      observationCount: 3,
      humanReviewedObservationCount: 2,
      requirementToDesignCount: 2,
      designToImplementationCount: 1,
      conformantCount: 1,
      driftCount: 1,
      unassessedCount: 1,
      blockerCount: 0,
      highSeverityCount: 1,
      remediationCandidateCount: 1,
      expiredRemediationCandidateCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      unresolvedQuestionCount: 1,
      candidateResult: "not-assessed",
      reviewState: "held",
      state: "attention-required",
      reasons: ["The exact current implementation target and one observation still require human review."],
      assessedAt: "2026-07-30T03:05:00.000Z",
      authorityBoundary: "design-drift-detection-status-is-observational-and-does-not-establish-an-actual-baseline-comparison-completeness-external-completeness-design-or-implementation-validity-approval-readiness-remediation-effect-or-figma-import-write-implementation-or-action-authority",
    },
    observedAt: "2026-07-30T03:05:00.000Z",
    privacyBoundary: "projection-contains-record-identities-version-axes-counts-classifications-severities-statuses-and-digests-only-not-design-requirement-or-implementation-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions",
    authorityBoundary: "design-drift-detection-projection-is-read-only-and-does-not-establish-an-actual-baseline-comparison-completeness-external-completeness-design-or-implementation-validity-approval-readiness-remediation-effect-or-figma-import-write-implementation-or-action-authority",
    snapshotDigest: digest("drift-snapshot"),
  }
}

describe("Phase 2 UX/Figma dashboard composition", () => {
  it("projects missing sources explicitly and never converts zero counts into completeness", () => {
    const dashboard = composePhase2UxFigmaDashboard(product, initiative, [], request(), "2026-07-30T03:10:00.000Z")
    expect(dashboard.sources).toHaveLength(23)
    expect(dashboard.phaseStatus).toMatchObject({
      state: "attention-required",
      currentSourceCount: 0,
      attentionRequiredSourceCount: 0,
      unavailableSourceCount: 23,
      productOwnerAcceptance: "not-established",
      readinessAuthority: "not-established",
    })
    expect(dashboard.evidenceCues.freshness).toBe("unknown")
    expect(dashboard.figma).toMatchObject({ connectionState: "not-established", writeExecutionState: "not-performed" })
    const { snapshotDigest, ...content } = dashboard
    expect(snapshotDigest).toBe(canonicalDigest(content))
  })

  it("derives bounded drift and freshness cues from an exact source projection", () => {
    const dashboard = composePhase2UxFigmaDashboard(
      product,
      initiative,
      [driftProjection()],
      request(),
      "2026-07-30T03:10:00.000Z",
    )
    expect(dashboard.drift).toMatchObject({ observationCount: 3, driftCount: 1, unassessedCount: 1, highSeverityCount: 1 })
    expect(dashboard.sources.at(-1)).toMatchObject({
      id: "design-drift-detection",
      availability: "attention-required",
      assessment: { unresolvedQuestionCount: 1, attentionRequired: true },
    })
    expect(dashboard.phaseStatus).toMatchObject({ attentionRequiredSourceCount: 1, unavailableSourceCount: 22 })
    expect(dashboard.governance).toMatchObject({
      driftCandidateResult: "not-assessed",
      baselineDesignationState: "not-established",
      remediationEffectState: "not-applied",
    })
  })

  it("rejects stale, duplicate, and unknown source bindings", () => {
    expect(() => composePhase2UxFigmaDashboard(product, initiative, [], {
      ...request(),
      expectedInitiativeRevision: 2,
    })).toThrow(Phase2UxFigmaDashboardBindingError)
    expect(() => composePhase2UxFigmaDashboard(
      product,
      initiative,
      [driftProjection(), driftProjection()],
      request(),
    )).toThrow(Phase2UxFigmaDashboardBindingError)
    expect(() => composePhase2UxFigmaDashboard(
      product,
      initiative,
      [{ ...driftProjection(), kind: "invented-phase-2-projection" }],
      request(),
    )).toThrow(Phase2UxFigmaDashboardBindingError)
  })

  it("is deterministic for exact inputs and observation time", () => {
    const first = composePhase2UxFigmaDashboard(product, initiative, [driftProjection()], request(), "2026-07-30T03:10:00.000Z")
    const second = composePhase2UxFigmaDashboard(product, initiative, [driftProjection()], request(), "2026-07-30T03:10:00.000Z")
    expect(second).toEqual(first)
  })
})
