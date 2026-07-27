import { describe, expect, it } from "vitest"

import {
  endToEndTraceabilityInputSchema,
  endToEndTraceabilityProjectionSchema,
  endToEndTraceabilityRequirementIds,
  endToEndTraceabilitySchema,
} from "./end-to-end-traceability.js"

const productId = "11111111-1111-4111-8111-111111111111"
const initiativeId = "22222222-2222-4222-8222-222222222222"
const sourceId = "33333333-3333-4333-8333-333333333333"
const evidenceRegistryId = "44444444-4444-4444-8444-444444444444"
const traceabilityId = "55555555-5555-4555-8555-555555555555"
const digest = (character: string) => `sha256:${character.repeat(64)}` as const

const exactSource = {
  sourceId,
  sourceRevision: 2,
  recordDigest: digest("1"),
  contentDigest: digest("2"),
}

function inputFixture() {
  return {
    initiativeId,
    context: {
      productRevision: 3,
      productDigest: digest("3"),
      initiativeRevision: 4,
      initiativeDigest: digest("4"),
    },
    informationClassification: "internal" as const,
    title: "Candidate end-to-end traceability graph",
    scope: "Connect exact governed Source and Evidence Registry revisions through attributable candidate semantics.",
    evidenceRegistry: { recordId: evidenceRegistryId, revision: 2, digest: digest("5") },
    nodes: [
      {
        key: "evidence-registry",
        subject: {
          recordKind: "evidence-registry" as const,
          recordId: evidenceRegistryId,
          revision: 2,
          digest: digest("5"),
          elementKeys: ["claim.customer-outcome"],
        },
        scope: ["candidate claim and evidence metadata"],
        sources: [exactSource],
        lifecycle: "current-candidate" as const,
        authorityState: "not-established" as const,
      },
      {
        key: "source-record",
        subject: {
          recordKind: "source-record" as const,
          recordId: sourceId,
          revision: 2,
          digest: digest("1"),
          elementKeys: [],
        },
        scope: ["governed source metadata"],
        sources: [exactSource],
        lifecycle: "current-candidate" as const,
        authorityState: "not-established" as const,
      },
    ],
    relationships: [{
      key: "derived-from",
      namespace: "gaep.trace",
      registryRevision: 1,
      definitionDigest: digest("6"),
      sourceKinds: ["source-record" as const],
      targetKinds: ["evidence-registry" as const],
      direction: "directed" as const,
      inverseRelationshipKey: "derives",
      transitivity: "not-transitive" as const,
      symmetry: "asymmetric" as const,
      impactBehavior: "direct" as const,
      sourceCardinality: "many" as const,
      targetCardinality: "many" as const,
      lifecycle: "candidate" as const,
      authoritativeUseState: "not-established" as const,
      rationale: "The relationship records candidate derivation semantics for exact governed revisions.",
      invalidationTriggers: ["either exact endpoint revision changes"],
      authorityBoundary: "relationship-definition-is-candidate-semantics-and-does-not-by-registration-establish-a-relationship-approval-baseline-readiness-or-action-authority" as const,
    }],
    links: [{
      key: "source-to-evidence-registry",
      sourceNodeKey: "source-record",
      targetNodeKey: "evidence-registry",
      relationshipKey: "derived-from",
      scope: ["candidate evidence lineage"],
      rationale: "The Evidence Registry declares this exact governed Source revision in its candidate metadata.",
      provenance: {
        kind: "human-asserted" as const,
        actor: { kind: "human" as const, id: "gaep.contract-reviewer" },
        assertedAt: "2026-07-27T00:10:00.000Z",
        method: "candidate trace authoring v1",
        sourceReferences: [exactSource],
      },
      state: "proposed" as const,
      verification: {
        endpointResolution: "resolved" as const,
        semanticFitness: "not-assessed" as const,
        rationale: "Both endpoints resolve, while semantic fitness still requires attributable human assessment.",
        authorityBoundary: "trace-verification-establishes-only-scoped-endpoint-and-semantic-assessment-not-approval-baseline-readiness-or-action-authority" as const,
      },
      effectiveFrom: "2026-07-27T00:10:00.000Z",
      invalidationConditions: ["either exact endpoint revision changes"],
      supersedesLinkKeys: [],
      authoritativeUseState: "not-established" as const,
      authorityBoundary: "trace-link-is-a-candidate-attributable-assertion-and-does-not-by-presence-or-verification-prove-completeness-grant-approval-promote-a-baseline-establish-readiness-or-authorize-action" as const,
    }],
    transformations: [{
      key: "source-to-registry-transformation",
      inputNodeKeys: ["source-record"],
      outputNodeKeys: ["evidence-registry"],
      methodName: "governed evidence metadata derivation",
      methodVersion: "v1",
      actor: { kind: "system" as const, id: "gaep.engine" },
      occurredAt: "2026-07-27T00:10:00.000Z",
      lossiness: "lossless" as const,
      omissions: [],
      aggregation: [],
      uncertainty: ["semantic fitness remains not assessed"],
      provenanceDigest: digest("7"),
    }],
    traceSpine: [{
      key: "source-to-evidence",
      sourceNodeKey: "source-record",
      targetNodeKey: "evidence-registry",
      relationshipKey: "derived-from",
      state: "covered-candidate" as const,
      linkKeys: ["source-to-evidence-registry"],
      basis: "The candidate graph includes an attributable exact Source-to-Evidence Registry link.",
      sources: [exactSource],
      applicabilityAuthorityState: "not-established" as const,
    }],
    requirementCoverage: endToEndTraceabilityRequirementIds.map((requirementId) => ({
      requirementId,
      state: "covered-candidate" as const,
      nodeKeys: ["evidence-registry", "source-record"],
      linkKeys: ["source-to-evidence-registry"],
      basis: `Candidate structure covers ${requirementId} without asserting acceptance or authority.`,
      sources: [exactSource],
    })),
    unknownRelationships: ["downstream operational relationships are not yet assessed"],
    unresolvedQuestions: ["which additional Product spine nodes are applicable"],
    inconsistencies: [],
    limitations: ["candidate coverage is not proof of complete real-world dependency knowledge"],
    coverageState: "not-established" as const,
  }
}

describe("End-to-End Traceability contract", () => {
  it("accepts canonical exact candidate nodes, relationship semantics, links, lineage, spine, and coverage", () => {
    const parsed = endToEndTraceabilityInputSchema.parse(inputFixture())
    expect(parsed.nodes).toHaveLength(2)
    expect(parsed.requirementCoverage.map((entry) => entry.requirementId)).toEqual(endToEndTraceabilityRequirementIds)
    expect(parsed.coverageState).toBe("not-established")
  })

  it("rejects dangling nodes, relationship mismatches, and false covered spine entries", () => {
    const dangling: any = structuredClone(inputFixture())
    dangling.links[0]!.targetNodeKey = "missing-node"
    expect(endToEndTraceabilityInputSchema.safeParse(dangling).success).toBe(false)

    const mismatch: any = structuredClone(inputFixture())
    mismatch.relationships[0]!.targetKinds = ["decision-register"]
    expect(endToEndTraceabilityInputSchema.safeParse(mismatch).success).toBe(false)

    const missingLink: any = structuredClone(inputFixture())
    missingLink.traceSpine[0]!.linkKeys = []
    expect(endToEndTraceabilityInputSchema.safeParse(missingLink).success).toBe(false)
  })

  it("requires attributable human semantic assessment and keeps inferred links proposed", () => {
    const unattributed: any = structuredClone(inputFixture())
    unattributed.links[0]!.state = "verified"
    unattributed.links[0]!.verification.semanticFitness = "fit"
    expect(endToEndTraceabilityInputSchema.safeParse(unattributed).success).toBe(false)

    const inferred: any = structuredClone(inputFixture())
    inferred.links[0]!.provenance.kind = "inferred"
    inferred.links[0]!.state = "verified"
    inferred.links[0]!.verification = {
      endpointResolution: "resolved",
      semanticFitness: "fit",
      verifier: { kind: "human", id: "gaep.trace-reviewer" },
      verifiedAt: "2026-07-27T00:11:00.000Z",
      methodName: "semantic trace review",
      methodVersion: "v1",
      rationale: "The relationship semantics fit the exact declared scope after attributable review.",
      authorityBoundary: "trace-verification-establishes-only-scoped-endpoint-and-semantic-assessment-not-approval-baseline-readiness-or-action-authority",
    }
    expect(endToEndTraceabilityInputSchema.safeParse(inferred).success).toBe(false)
  })

  it("requires lossy transformation disclosure and complete canonical requirement coverage", () => {
    const lossy: any = structuredClone(inputFixture())
    lossy.transformations[0]!.lossiness = "lossy"
    expect(endToEndTraceabilityInputSchema.safeParse(lossy).success).toBe(false)

    const incomplete: any = structuredClone(inputFixture())
    incomplete.requirementCoverage.pop()
    expect(endToEndTraceabilityInputSchema.safeParse(incomplete).success).toBe(false)
  })

  it("rejects authority-shaped additions, secrets, and invalid revision lineage", () => {
    const authority = { ...inputFixture(), traceComplete: true }
    expect(endToEndTraceabilityInputSchema.safeParse(authority).success).toBe(false)

    const secret: any = structuredClone(inputFixture())
    secret.limitations = ["api_key=sk-live-abcdefghijklmnopqrstuvwxyz123456 must never enter portable trace metadata"]
    expect(endToEndTraceabilityInputSchema.safeParse(secret).success).toBe(false)

    const record = {
      ...inputFixture(),
      schemaVersion: 1 as const,
      kind: "end-to-end-traceability-candidate" as const,
      id: traceabilityId,
      productId,
      revision: 1,
      membershipDigest: digest("8"),
      predecessorDigest: digest("9"),
      state: "candidate" as const,
      createdBy: { kind: "human" as const, id: "gaep.author" },
      updatedBy: { kind: "human" as const, id: "gaep.author" },
      createdAt: "2026-07-27T00:10:00.000Z",
      updatedAt: "2026-07-27T00:10:00.000Z",
      authorityBoundary: "end-to-end-traceability-is-a-candidate-graph-and-does-not-establish-relationship-truth-completeness-approval-baseline-promotion-readiness-or-action-authority" as const,
    }
    expect(endToEndTraceabilitySchema.safeParse(record).success).toBe(false)
  })

  it("keeps projection metadata strict, privacy-safe, exact-bound, and non-authorizing", () => {
    const status = {
      schemaVersion: 1 as const,
      kind: "end-to-end-traceability-status" as const,
      productId,
      productRevision: 3,
      initiativeId,
      initiativeRevision: 4,
      traceability: { recordId: traceabilityId, revision: 2, digest: digest("a") },
      nodeCount: 2,
      relationshipCount: 1,
      linkCount: 1,
      transformationCount: 1,
      verifiedLinkCount: 0,
      proposedLinkCount: 1,
      invalidOrHistoricalLinkCount: 0,
      unresolvedEndpointCount: 0,
      notAssessedSemanticCount: 1,
      missingSpineCount: 0,
      unknownRelationshipCount: 1,
      unresolvedRequirementCount: 0,
      staleBindingCount: 0,
      staleSourceReferenceCount: 0,
      inconsistencyCount: 0,
      unresolvedQuestionCount: 1,
      state: "attention-required" as const,
      reasons: ["One or more Trace Link semantic assessments remain explicitly not assessed"],
      assessedAt: "2026-07-27T00:12:00.000Z",
      coverageBoundary: "absence-of-a-trace-link-does-not-prove-absence-of-impact-or-relationship" as const,
      authorityBoundary: "end-to-end-traceability-status-reports-candidate-coverage-and-gaps-and-does-not-establish-relationship-truth-completeness-approval-readiness-or-action-authority" as const,
    }
    const projection = {
      schemaVersion: 1 as const,
      kind: "end-to-end-traceability-projection" as const,
      product: { id: productId, revision: 3, digest: digest("3") },
      initiative: { id: initiativeId, revision: 4, digest: digest("4"), state: "active" as const },
      status,
      traceability: {
        id: traceabilityId,
        revision: 2,
        digest: digest("a"),
        membershipDigest: digest("b"),
        state: "candidate" as const,
        nodeCount: 2,
        relationshipCount: 1,
        linkCount: 1,
        transformationCount: 1,
        updatedAt: "2026-07-27T00:11:00.000Z",
      },
      observedAt: status.assessedAt,
      privacyBoundary: "projection-contains-identities-counts-statuses-and-digests-only-not-node-content-link-rationale-transformation-detail-source-content-personal-data-secrets-or-credentials" as const,
      authorityBoundary: "end-to-end-traceability-projection-does-not-establish-relationship-truth-completeness-approval-baseline-promotion-readiness-or-action-authority" as const,
      snapshotDigest: digest("c"),
    }
    expect(endToEndTraceabilityProjectionSchema.safeParse(projection).success).toBe(true)
    expect(endToEndTraceabilityProjectionSchema.safeParse({ ...projection, traceComplete: true }).success).toBe(false)
  })
})
