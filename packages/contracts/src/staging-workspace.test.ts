import { randomUUID } from "node:crypto"

import { describe, expect, it } from "vitest"

import { stagingWorkspaceInputSchema, type StagingWorkspaceInput } from "./staging-workspace.js"

const digest = `sha256:${"a".repeat(64)}`
const evidence = { kind: "evidence" as const, sourceId: "stage-inspection", revision: 1, digest, evidenceState: "human-reviewed" as const }

function input(): StagingWorkspaceInput {
  const previewUnitId = randomUUID(), previewPathId = randomUUID(), implementationUnitId = randomUUID()
  return {
    initiativeId: randomUUID(),
    context: { productRevision: 1, productDigest: digest, initiativeRevision: 1, initiativeDigest: digest },
    informationClassification: "internal",
    title: "Isolated staging workspace candidate",
    proposedChangePreview: { recordId: randomUUID(), revision: 1, digest },
    stagingIdentity: { namespace: "gaep-managed-stage", stageKey: "candidate-stage-1", generation: 1, scopeDigest: digest },
    lifecycle: { definitionState: "candidate-defined", provisioningState: "not-performed", actualStageExistenceState: "not-established",
      inspectionState: "candidate-complete", applyState: "not-performed", discardState: "not-performed", disposalState: "not-performed" },
    units: [{ id: randomUUID(), ordinal: 1, proposedPreviewUnitId: previewUnitId, implementationUnitId, implementationUnitKey: "unit-a",
      previewUnitDigest: digest, evidenceReferences: [evidence], outcome: "candidate-defined",
      pathCandidates: [{ id: randomUUID(), ordinal: 1, proposedPathPreviewId: previewPathId, pathCandidate: "packages/example/src/index.ts",
        changeKind: "modify", previewPathDigest: digest, sourceEndpointDigest: digest, targetEndpointDigest: digest,
        diffMetadataDigest: digest, planOperationsDigest: digest, traceDigest: digest, inspectionState: "candidate-complete",
        evidenceReferences: [evidence], outcome: "candidate-defined" }] }],
    exclusionRuleIds: ["control-plane", "secrets", "symlinks"], excludedPathCandidateCount: 0, exclusionReceiptDigest: digest,
    capacity: { maximumFiles: 512, maximumBytes: 67_108_864, maximumSingleFileBytes: 8_388_608, maximumPathBytes: 4_096,
      maximumChanges: 512, candidateFileCount: 1, candidateByteCount: 120 },
    recovery: { strategy: "write-ahead-journal-candidate", journalKey: "candidate-journal-1", checkpointDigest: digest,
      replayState: "candidate-defined", inspectionEvidenceReferences: [evidence] },
    inspectionEvidenceReferences: [evidence], unresolvedQuestions: [],
    limitations: ["Candidate metadata does not prove that a machine-local stage exists"], reviewState: "ready-for-human-review",
    repositoryTruthState: "not-established", pathTruthState: "not-established", sourceObservationTruthState: "not-established",
    targetProposalTruthState: "not-established", diffTruthState: "not-established", approvedScopeState: "not-established",
    changeApprovalState: "not-established", codeMutationState: "not-performed", realStageCreationState: "not-performed",
    applyState: "not-performed", discardState: "not-performed", assignmentExecutionState: "not-established",
    acceptanceDecisionState: "not-established", mergeReadinessState: "not-established", releaseReadinessState: "not-established",
    deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
  }
}

describe("Staging Workspace contract", () => {
  it("accepts a bounded portable candidate without real-stage or action authority", () => {
    expect(stagingWorkspaceInputSchema.parse(input())).toMatchObject({
      realStageCreationState: "not-performed", applyState: "not-performed", actionAuthorityState: "not-granted",
      lifecycle: { actualStageExistenceState: "not-established" },
    })
  })

  it("rejects machine paths, over-capacity candidates, and secret-shaped content", () => {
    const base = input()
    expect(stagingWorkspaceInputSchema.safeParse({ ...base, units: base.units.map((unit) => ({ ...unit,
      pathCandidates: unit.pathCandidates.map((path) => ({ ...path, pathCandidate: "/Users/person/project/file.ts" })) })) }).success).toBe(false)
    expect(stagingWorkspaceInputSchema.safeParse({ ...base, capacity: { ...base.capacity, candidateFileCount: 513 } }).success).toBe(false)
    expect(stagingWorkspaceInputSchema.safeParse({ ...base, limitations: [`api_key=sk-${"x".repeat(32)}`] }).success).toBe(false)
  })
})
