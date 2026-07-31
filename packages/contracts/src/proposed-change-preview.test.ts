import { randomUUID } from "node:crypto"

import { describe, expect, it } from "vitest"

import { proposedChangePreviewInputSchema, type ProposedChangePreviewInput } from "./proposed-change-preview.js"

const digest = `sha256:${"a".repeat(64)}`

function input(): ProposedChangePreviewInput {
  const evidence = { kind: "evidence" as const, sourceId: "preview-review", revision: 1, digest, evidenceState: "human-reviewed" as const }
  return {
    initiativeId: randomUUID(), context: { productRevision: 1, productDigest: digest, initiativeRevision: 1, initiativeDigest: digest },
    informationClassification: "internal", title: "Proposed change preview candidate",
    changedUnitInventory: { recordId: randomUUID(), revision: 1, digest },
    previewUnits: [{ id: randomUUID(), ordinal: 1, changedUnitCandidateId: randomUUID(), implementationUnitId: randomUUID(), implementationUnitKey: "unit-a",
      dependencyUnitIds: [], directBlastRadiusUnitIds: [], indirectBlastRadiusUnitIds: [], evidenceReferences: [evidence], outcome: "candidate-previewed",
      pathPreviews: [{ id: randomUUID(), ordinal: 1, changedPathCandidateId: randomUUID(), pathCandidate: "packages/example/src/index.ts", changeKind: "modify",
        source: { state: "candidate-observed", digest, bytes: 100 }, target: { state: "candidate-generated", digest, bytes: 120 },
        diff: { state: "candidate-generated", format: "unified-text-metadata", patchDigest: digest, addedLineCount: 3, removedLineCount: 1, truncated: false },
        planOperations: ["replace", "verify"], traceDigest: digest, evidenceReferences: [evidence], outcome: "candidate-previewed" }] }],
    unresolvedQuestions: [], limitations: ["Source and target metadata require repository verification"], reviewState: "ready-for-human-review",
    repositoryTruthState: "not-established", pathTruthState: "not-established", sourceObservationTruthState: "not-established",
    targetProposalTruthState: "not-established", diffTruthState: "not-established", changeScopeApprovalState: "not-established",
    changeApprovalState: "not-established", codeMutationState: "not-performed", stagingState: "not-performed", applyDiscardState: "not-performed",
    assignmentExecutionState: "not-established", acceptanceDecisionState: "not-established", mergeReadinessState: "not-established",
    releaseReadinessState: "not-established", deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
  }
}

describe("Proposed Change Preview contract", () => {
  it("accepts privacy-safe pre-apply plan and diff metadata without authority", () => {
    expect(proposedChangePreviewInputSchema.parse(input())).toMatchObject({ diffTruthState: "not-established", stagingState: "not-performed", actionAuthorityState: "not-granted" })
  })

  it("rejects file content, machine paths, and inconsistent generated metadata", () => {
    const base = input()
    expect(proposedChangePreviewInputSchema.safeParse({ ...base, previewUnits: base.previewUnits.map((unit) => ({ ...unit,
      pathPreviews: unit.pathPreviews.map((path) => ({ ...path, pathCandidate: "/Users/person/project/file.ts" })) })) }).success).toBe(false)
    expect(proposedChangePreviewInputSchema.safeParse({ ...base, previewUnits: base.previewUnits.map((unit) => ({ ...unit,
      pathPreviews: unit.pathPreviews.map((path) => ({ ...path, diff: { state: "candidate-generated", format: "unified-text-metadata", truncated: false } })) })) }).success).toBe(false)
    expect(proposedChangePreviewInputSchema.safeParse({ ...base, limitations: [`file contents: api_key=sk-${"x".repeat(32)}`] }).success).toBe(false)
  })
})
