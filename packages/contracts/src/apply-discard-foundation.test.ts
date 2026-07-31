import { randomUUID } from "node:crypto"

import { describe, expect, it } from "vitest"

import {
  applyDiscardFoundationInputSchema,
  applyDiscardFoundationSchema,
  type ApplyDiscardFoundationInput,
} from "./apply-discard-foundation.js"

const digest = (value: unknown) => {
  const seed = String(value).match(/[0-9a-f]/iu)?.[0]?.toLowerCase() ?? "a"
  return `sha256:${seed.repeat(64)}` as const
}
const reference = () => ({ recordId: randomUUID(), revision: 1, digest: digest(randomUUID()) })

function fixture(): ApplyDiscardFoundationInput {
  const generation = 3
  const evidence = [{ kind: "review" as const, sourceId: "apply-discard-review", revision: 1,
    digest: digest("reviewed"), evidenceState: "human-reviewed" as const }]
  return {
    initiativeId: randomUUID(),
    context: { productRevision: 1, productDigest: digest("product"), initiativeRevision: 1, initiativeDigest: digest("initiative") },
    informationClassification: "internal", title: "Apply or discard the exact staged candidate",
    dependencies: { changedUnitInventory: reference(), proposedChangePreview: reference(), stagingWorkspace: reference(),
      controlledCodexImplementation: reference(), controlledClaudeImplementation: reference(), backlogToCodeTraceability: reference() },
    stageIdentity: { namespace: "gaep-managed-stage", stageKey: "stage.checkout", generation, scopeDigest: digest("scope") },
    decision: "apply-entire-stage-candidate", decisionActor: { kind: "human", id: "reviewer" }, decidedAt: "2026-07-31T20:30:00.000Z",
    paths: [{ id: randomUUID(), ordinal: 1, decisionPathKey: "path.checkout", changedUnitId: randomUUID(), changedPathId: randomUUID(),
      proposedPreviewUnitId: randomUUID(), proposedPreviewPathId: randomUUID(), stagingUnitId: randomUUID(), stagingPathId: randomUUID(),
      backlogTraceId: randomUUID(), backlogTraceKey: "trace.checkout", implementationUnitId: randomUUID(),
      pathCandidate: "apps/vscode/src/checkout.ts", stagingPathDigest: digest("stage-path"),
      disposition: "apply-candidate", scopeState: "candidate-exact", evidenceReferences: evidence, conflictReferenceCandidates: [],
      sourceMutationState: "not-performed", applyState: "not-performed", discardState: "not-performed", outcomeTruthState: "not-established" }],
    recovery: { strategy: "write-ahead-journal-candidate", journalKey: "journal.checkout", stageGeneration: generation,
      checkpointDigest: digest("checkpoint"), staleStageRejectionState: "candidate-defined",
      scopeConfinementState: "candidate-defined", atomicityState: "candidate-defined", rollbackState: "candidate-defined",
      recoveryExecutionState: "not-performed", evidenceReferences: evidence },
    preconditions: ["Exact stage generation and path inventory must be revalidated before any effect"], unresolvedQuestions: [],
    limitations: ["This candidate records no repository mutation, apply, discard, recovery, outcome, or acceptance truth"],
    reviewState: "ready-for-human-review", actualStageExistenceState: "not-established", repositoryTruthState: "not-established",
    sourceTruthState: "not-established", approvalState: "not-established", authorizationState: "not-established",
    sourceMutationState: "not-performed", applyState: "not-performed", discardState: "not-performed",
    recoveryExecutionState: "not-performed", outcomeTruthState: "not-established", acceptanceState: "not-established",
    nativeHostAcceptanceState: "not-established", liveProviderAcceptanceState: "not-established",
    securityAcceptanceState: "not-established", releaseReadinessState: "not-established",
    deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
  }
}

describe("Apply/Discard Foundation contract", () => {
  it("accepts a versioned whole-stage decision candidate without inventing effect truth", () => {
    const input = fixture()
    expect(applyDiscardFoundationInputSchema.parse(input)).toMatchObject({ decision: "apply-entire-stage-candidate", applyState: "not-performed" })
    const now = "2026-07-31T20:30:00.000Z"
    expect(applyDiscardFoundationSchema.parse({ ...input, schemaVersion: 1, kind: "apply-discard-foundation-candidate",
      id: randomUUID(), productId: randomUUID(), revision: 1, dependencyReceiptDigest: digest("dependencies"),
      stageReceiptDigest: digest("stage"), decisionReceiptDigest: digest("decision"),
      scopeReceiptDigest: digest("paths"), recoveryReceiptDigest: digest("recovery"),
      evidenceReceiptDigest: digest("evidence"), assessmentReceiptDigest: digest("assessment"),
      state: "candidate", createdBy: { kind: "human", id: "reviewer" }, updatedBy: { kind: "human", id: "reviewer" },
      createdAt: now, updatedAt: now,
      authorityBoundary: "apply-discard-foundation-is-a-versioned-portable-decision-candidate-and-does-not-establish-real-stage-existence-repository-source-approval-authorization-mutation-apply-discard-recovery-outcome-acceptance-release-deployment-or-action-authority",
    })).toMatchObject({ revision: 1, sourceMutationState: "not-performed", actionAuthorityState: "not-granted" })
  })

  it("rejects traversal, mixed whole-stage dispositions, stale recovery generations, conflicts without evidence, and secrets", () => {
    const input = fixture(), path = input.paths[0]!
    expect(applyDiscardFoundationInputSchema.safeParse({ ...input, paths: [{ ...path, pathCandidate: "../escape.ts" }] }).success).toBe(false)
    expect(applyDiscardFoundationInputSchema.safeParse({ ...input, paths: [{ ...path, disposition: "discard-candidate" }] }).success).toBe(false)
    expect(applyDiscardFoundationInputSchema.safeParse({ ...input, recovery: { ...input.recovery, stageGeneration: 4 } }).success).toBe(false)
    expect(applyDiscardFoundationInputSchema.safeParse({ ...input, paths: [{ ...path, scopeState: "conflict" }] }).success).toBe(false)
    expect(applyDiscardFoundationInputSchema.safeParse({ ...input, limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false)
  })
})
