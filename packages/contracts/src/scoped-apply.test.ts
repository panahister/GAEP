import { randomUUID } from "node:crypto"
import { describe, expect, it } from "vitest"

import { scopedApplyInputSchema } from "./scoped-apply.js"

const digest = (value: string) => `sha256:${value.repeat(64)}` as const
const reference = () => ({ recordId: randomUUID(), revision: 1, digest: digest("a") })
function fixture() {
  const evidence = [{ kind: "review" as const, sourceId: "scoped-apply-review", revision: 1, digest: digest("b"), evidenceState: "human-reviewed" as const }]
  const stageGeneration = 3, selectedStagePathId = randomUUID(), excludedStagePathId = randomUUID()
  const basePath = { decisionPathId: randomUUID(), changedPathId: randomUUID(), backlogTraceId: randomUUID(), stagingPathDigest: digest("c"), evidenceReferences: evidence }
  return { initiativeId: randomUUID(), context: { productRevision: 1, productDigest: digest("d"), initiativeRevision: 1, initiativeDigest: digest("e") },
    informationClassification: "internal" as const, title: "Scoped apply subset candidate",
    dependencies: { changedUnitInventory: reference(), proposedChangePreview: reference(), stagingWorkspace: reference(),
      controlledCodexImplementation: reference(), backlogToCodeTraceability: reference(), applyDiscardFoundation: reference() },
    stageIdentity: { namespace: "gaep-managed-stage" as const, stageKey: "stage.product-view", generation: stageGeneration, scopeDigest: digest("f") },
    selectionActor: { kind: "human" as const, id: "reviewer" }, selectedAt: "2026-07-31T20:40:00.000Z",
    selectedPaths: [{ ...basePath, id: randomUUID(), ordinal: 1, selectionKey: "select.product-view", stagingPathId: selectedStagePathId,
      pathCandidate: "apps/vscode/src/product-view.ts", writeEnvelopeCandidate: "apps/vscode/src/product-view.ts", scopeState: "candidate-exact" as const,
      sourceMutationState: "not-performed" as const, applyState: "not-performed" as const, outcomeTruthState: "not-established" as const }],
    excludedPaths: [{ ...basePath, id: randomUUID(), exclusionKey: "exclude.product-test", stagingPathId: excludedStagePathId,
      pathCandidate: "apps/vscode/src/product-view.test.ts", reason: "Excluded from this bounded subset candidate",
      disposition: "excluded-from-scoped-apply" as const, discardState: "not-performed" as const }],
    writeEnvelopeCandidates: ["apps/vscode/src/product-view.ts"], recovery: { strategy: "write-ahead-journal-candidate" as const,
      journalKey: "journal.product-view", stageGeneration, checkpointDigest: digest("1"), staleStageRejectionState: "candidate-defined" as const,
      scopeConfinementState: "candidate-defined" as const, atomicityState: "candidate-defined" as const, rollbackState: "candidate-defined" as const,
      recoveryExecutionState: "not-performed" as const, evidenceReferences: evidence },
    preconditions: ["Exact selected and excluded stage paths must be revalidated before any effect"], unresolvedQuestions: [],
    limitations: ["This subset candidate does not mutate source or execute apply"], reviewState: "ready-for-human-review" as const,
    stageTruthState: "not-established" as const, repositoryTruthState: "not-established" as const, sourceTruthState: "not-established" as const,
    approvalState: "not-established" as const, authorizationState: "not-established" as const, sourceMutationState: "not-performed" as const,
    applyState: "not-performed" as const, wholeStageDiscardState: "not-performed" as const, recoveryExecutionState: "not-performed" as const,
    outcomeTruthState: "not-established" as const, acceptanceState: "not-established" as const, nativeHostAcceptanceState: "not-established" as const,
    liveProviderAcceptanceState: "not-established" as const, securityAcceptanceState: "not-established" as const,
    releaseReadinessState: "not-established" as const, deploymentReadinessState: "not-established" as const, actionAuthorityState: "not-granted" as const }
}

describe("Scoped Apply contract", () => {
  it("accepts an exact included/excluded partition while all effects remain unperformed", () => {
    expect(scopedApplyInputSchema.parse(fixture())).toMatchObject({ selectedPaths: [{ scopeState: "candidate-exact", applyState: "not-performed" }], wholeStageDiscardState: "not-performed", actionAuthorityState: "not-granted" })
  })
  it("rejects traversal, overlap, out-of-envelope selection, stale recovery generation, and secrets", () => {
    const input = fixture(), selected = input.selectedPaths[0]!, excluded = input.excludedPaths[0]!
    expect(scopedApplyInputSchema.safeParse({ ...input, selectedPaths: [{ ...selected, pathCandidate: "../escape.ts" }] }).success).toBe(false)
    expect(scopedApplyInputSchema.safeParse({ ...input, excludedPaths: [{ ...excluded, stagingPathId: selected.stagingPathId }] }).success).toBe(false)
    expect(scopedApplyInputSchema.safeParse({ ...input, writeEnvelopeCandidates: ["apps/vscode/src/other.ts"] }).success).toBe(false)
    expect(scopedApplyInputSchema.safeParse({ ...input, recovery: { ...input.recovery, stageGeneration: 4 } }).success).toBe(false)
    expect(scopedApplyInputSchema.safeParse({ ...input, limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false)
  })
})
