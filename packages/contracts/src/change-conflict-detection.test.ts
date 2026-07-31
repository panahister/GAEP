import { randomUUID } from "node:crypto"
import { describe, expect, it } from "vitest"

import { changeConflictDetectionInputSchema } from "./change-conflict-detection.js"

const digest = (value: string) => `sha256:${value.repeat(64)}` as const
const reference = () => ({ recordId: randomUUID(), revision: 1, digest: digest("a") })
function fixture() {
  const evidence = [{ kind: "review" as const, sourceId: "change-conflict-review", revision: 1, digest: digest("b"), evidenceState: "human-reviewed" as const }]
  const findings = ["baseline-drift", "overlapping-stage", "provider-handoff", "stale-generation", "user-edit"].map((kind, index) => ({ kind,
    state: "no-conflict-candidate" as const, basisDigest: digest(String(index + 1)), evidenceReferences: evidence,
    resolutionState: "not-performed" as const, conflictTruthState: "not-established" as const }))
  return { initiativeId: randomUUID(), context: { productRevision: 1, productDigest: digest("c"), initiativeRevision: 1, initiativeDigest: digest("d") },
    informationClassification: "internal" as const, title: "Change conflict detection candidate", dependencies: { changedUnitInventory: reference(),
      proposedChangePreview: reference(), stagingWorkspace: reference(), providerSwitchImplementation: reference(), modelSwitchImplementation: reference(),
      applyDiscardFoundation: reference(), scopedApply: reference(), rollbackRecovery: reference() },
    stageIdentity: { namespace: "gaep-managed-stage" as const, stageKey: "stage.product-view", generation: 3, scopeDigest: digest("e") },
    subjects: [{ id: randomUUID(), ordinal: 1, subjectKey: "conflict.product-view", scopedApplySelectedPathId: randomUUID(), changedPathId: randomUUID(),
      proposedPreviewPathId: randomUUID(), stagingPathId: randomUUID(), rollbackRecoverySubjectId: randomUUID(), pathCandidate: "apps/vscode/src/product-view.ts",
      baselineDigestCandidate: digest("f"), stagedTargetDigestCandidate: digest("0"), currentContentDigestCandidate: digest("9"), currentObservationState: "metadata-candidate" as const,
      handoff: { providerSwitchId: randomUUID(), modelSwitchId: randomUUID(), providerHandoffReceiptDigest: digest("8"), modelTransitionReceiptDigest: digest("7"), observationState: "metadata-candidate" as const },
      findings, evidenceReferences: evidence, sourceInspectionState: "not-performed" as const, sourceMutationState: "not-performed" as const,
      resolutionState: "not-performed" as const, outcomeTruthState: "not-established" as const }], evidenceReferences: evidence,
    preconditions: ["Exact current endpoint, stage, selection, recovery and handoff candidates must be revalidated before any conflict decision"], unresolvedQuestions: [],
    limitations: ["No-conflict candidate metadata does not establish absence of user edits or baseline drift"], reviewState: "ready-for-human-review" as const,
    assessedBy: { kind: "human" as const, id: "reviewer" }, assessedAt: "2026-08-01T00:40:00.000Z", repositoryTruthState: "not-established" as const,
    sourceTruthState: "not-established" as const, conflictAbsenceTruthState: "not-established" as const, approvalState: "not-established" as const,
    authorizationState: "not-established" as const, sourceInspectionState: "not-performed" as const, sourceMutationState: "not-performed" as const,
    conflictResolutionState: "not-performed" as const, outcomeTruthState: "not-established" as const, acceptanceState: "not-established" as const,
    nativeHostAcceptanceState: "not-established" as const, liveProviderAcceptanceState: "not-established" as const, securityAcceptanceState: "not-established" as const,
    releaseReadinessState: "not-established" as const, deploymentReadinessState: "not-established" as const, actionAuthorityState: "not-granted" as const }
}

describe("Change Conflict Detection contract", () => {
  it("accepts bounded five-kind candidate findings without establishing conflict absence or resolution", () => {
    expect(changeConflictDetectionInputSchema.parse(fixture())).toMatchObject({ subjects: [{ currentObservationState: "metadata-candidate",
      sourceInspectionState: "not-performed", resolutionState: "not-performed" }], conflictAbsenceTruthState: "not-established", actionAuthorityState: "not-granted" })
  })
  it("rejects traversal, missing kinds, digest-state contradictions, duplicate paths, and secrets", () => {
    const input = fixture(), subject = input.subjects[0]!
    expect(changeConflictDetectionInputSchema.safeParse({ ...input, subjects: [{ ...subject, pathCandidate: "../escape.ts" }] }).success).toBe(false)
    expect(changeConflictDetectionInputSchema.safeParse({ ...input, subjects: [{ ...subject, findings: subject.findings.slice(1) }] }).success).toBe(false)
    expect(changeConflictDetectionInputSchema.safeParse({ ...input, subjects: [{ ...subject, currentObservationState: "unavailable" }] }).success).toBe(false)
    expect(changeConflictDetectionInputSchema.safeParse({ ...input, subjects: [subject, { ...subject, id: randomUUID(), subjectKey: "conflict.duplicate" }] }).success).toBe(false)
    expect(changeConflictDetectionInputSchema.safeParse({ ...input, limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false)
  })
})
