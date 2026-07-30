import { describe, expect, it } from "vitest"

import {
  dependencyMappingInputSchema,
  dependencyMappingStatusSchema,
} from "./dependency-mapping.js"

const digest = (value: string) => `sha256:${value.repeat(64)}`
const ids = Array.from({ length: 24 }, (_, index) => `13000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`)

function input() {
  return {
    initiativeId: ids[0],
    context: { productRevision: 1, productDigest: digest("1"), initiativeRevision: 1, initiativeDigest: digest("2") },
    informationClassification: "internal" as const,
    title: "Candidate implementation dependency mapping",
    hierarchy: { recordId: ids[1], revision: 1, digest: digest("3") },
    mvpSliceDefinition: { recordId: ids[2], revision: 1, digest: digest("4") },
    implementationUnitModel: { recordId: ids[3], revision: 1, digest: digest("5") },
    nodes: [
      {
        implementationUnitId: ids[4], ordinal: 1, candidateEffortPoints: 8,
        estimateState: "candidate-not-validated" as const,
        evidenceReferences: [{ kind: "implementation-unit" as const, recordId: ids[3], revision: 1, digest: digest("5") }],
        assessedBy: { kind: "human" as const, id: "architecture-reviewer" },
        assessedAt: "2026-07-30T00:00:00.000Z",
      },
      {
        implementationUnitId: ids[5], ordinal: 2, candidateEffortPoints: 5,
        estimateState: "candidate-not-validated" as const, evidenceReferences: [],
        assessedBy: { kind: "human" as const, id: "architecture-reviewer" },
        assessedAt: "2026-07-30T00:00:00.000Z",
      },
    ],
    edges: [{
      id: ids[6], ordinal: 1, predecessorUnitId: ids[4], successorUnitId: ids[5],
      kind: "integration" as const, strength: "required" as const,
      evidenceState: "candidate-asserted" as const,
      rationale: "The candidate web unit consumes the candidate API unit contract",
      evidenceReferences: [{ kind: "architecture" as const, recordId: ids[7], revision: 1, digest: digest("6") }],
      assessedBy: { kind: "human" as const, id: "architecture-reviewer" },
      assessedAt: "2026-07-30T00:00:00.000Z",
    }],
    criticalPathPolicy: {
      algorithm: "longest-candidate-effort-path-v1" as const,
      tieBreak: "canonical-unit-ordinal-v1" as const,
    },
    unresolvedQuestions: [],
    limitations: ["Dependency and critical-path results remain candidates for accountable human review"],
    reviewState: "ready-for-human-review" as const,
    dependencyTruthState: "not-established" as const,
    dependencyCompletenessState: "not-established" as const,
    criticalPathAuthorityState: "not-established" as const,
    sequencingCommitmentState: "not-established" as const,
    ownershipAppointmentState: "not-established" as const,
    implementationReadinessState: "not-established" as const,
    implementationCompletenessState: "not-established" as const,
    assignmentExecutionState: "not-established" as const,
    approvalState: "not-established" as const,
    acceptanceDecisionState: "not-established" as const,
    mergeReadinessState: "not-established" as const,
    releaseReadinessState: "not-established" as const,
    deploymentReadinessState: "not-established" as const,
    actionAuthorityState: "not-granted" as const,
  }
}

describe("Dependency Mapping contracts", () => {
  it("accepts an exact candidate DAG and candidate-effort policy without granting sequencing authority", () => {
    expect(dependencyMappingInputSchema.parse(input())).toEqual(input())
  })

  it("rejects cycles, unknown endpoints, duplicate directed pairs, and self-dependencies", () => {
    const cyclic = input()
    cyclic.edges.push({ ...structuredClone(cyclic.edges[0]!), id: ids[8], ordinal: 2, predecessorUnitId: ids[5], successorUnitId: ids[4] })
    expect(() => dependencyMappingInputSchema.parse(cyclic)).toThrow(/acyclic directed graph/u)

    const unknown = input()
    unknown.edges[0]!.successorUnitId = ids[9]
    expect(() => dependencyMappingInputSchema.parse(unknown)).toThrow(/exact node catalog/u)

    const duplicate = input()
    duplicate.edges.push({ ...structuredClone(duplicate.edges[0]!), id: ids[8], ordinal: 2 })
    expect(() => dependencyMappingInputSchema.parse(duplicate)).toThrow(/directed unit pairs must be unique/u)

    const self = input()
    self.edges[0]!.successorUnitId = self.edges[0]!.predecessorUnitId
    expect(() => dependencyMappingInputSchema.parse(self)).toThrow(/same predecessor and successor/u)
  })

  it("rejects review-ready unassessed edges and secret-shaped rationales", () => {
    expect(() => dependencyMappingInputSchema.parse({
      ...input(),
      edges: input().edges.map((edge) => ({ ...edge, evidenceState: "not-assessed" as const })),
    })).toThrow(/assessed edge candidates/u)

    const secret = input()
    secret.edges[0]!.rationale = `api_key=${"x".repeat(24)}`
    expect(() => dependencyMappingInputSchema.parse(secret)).toThrow(/secret-shaped/u)
  })

  it("rejects forged candidate-complete status without exact current dependencies", () => {
    expect(() => dependencyMappingStatusSchema.parse({
      schemaVersion: 1, kind: "dependency-mapping-status",
      productId: ids[0], productRevision: 1, initiativeId: ids[0], initiativeRevision: 1,
      nodeCount: 2, edgeCount: 1, requiredEdgeCount: 1, conditionalEdgeCount: 0, advisoryEdgeCount: 0,
      rootNodeCount: 1, leafNodeCount: 1, criticalPathUnitCount: 2, criticalPathCandidateEffortPoints: 13,
      missingNodeCount: 0, missingDeclaredEdgeCount: 0, extraEdgeCount: 0, invalidNodeCount: 0,
      invalidEdgeCount: 0, cycleCount: 0, staleBindingCount: 0, staleHierarchyCount: 0,
      staleMvpSliceDefinitionCount: 0, staleImplementationUnitModelCount: 0, unresolvedQuestionCount: 0,
      reviewState: "ready-for-human-review", state: "candidate-complete", reasons: [],
      assessedAt: "2026-07-30T00:00:00.000Z",
      authorityBoundary: "dependency-mapping-status-is-observational-and-does-not-establish-dependency-truth-or-completeness-critical-path-authority-sequencing-commitment-ownership-appointment-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority",
    })).toThrow(/exact current dependencies/u)
  })

  it("rejects forged truth, sequencing, and action authority states", () => {
    expect(() => dependencyMappingInputSchema.parse({ ...input(), dependencyTruthState: "established" })).toThrow()
    expect(() => dependencyMappingInputSchema.parse({ ...input(), sequencingCommitmentState: "committed" })).toThrow()
    expect(() => dependencyMappingInputSchema.parse({ ...input(), actionAuthorityState: "granted" })).toThrow()
  })
})
