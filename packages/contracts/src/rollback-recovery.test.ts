import { randomUUID } from "node:crypto"
import { describe, expect, it } from "vitest"

import { rollbackRecoveryInputSchema } from "./rollback-recovery.js"

const digest = (value: string) => `sha256:${value.repeat(64)}` as const
const reference = () => ({ recordId: randomUUID(), revision: 1, digest: digest("a") })
function fixture() {
  const evidence = [{ kind: "review" as const, sourceId: "rollback-recovery-review", revision: 1, digest: digest("b"), evidenceState: "human-reviewed" as const }]
  const rollbackPointId = randomUUID(), subjectId = randomUUID(), selectedPathId = randomUUID(), stagingPathId = randomUUID(), workflowStepId = randomUUID()
  return { initiativeId: randomUUID(), context: { productRevision: 1, productDigest: digest("c"), initiativeRevision: 1, initiativeDigest: digest("d") },
    informationClassification: "internal" as const, title: "Rollback and recovery evidence candidate",
    dependencies: { failureRecoveryModel: reference(), stagingWorkspace: reference(), applyDiscardFoundation: reference(), scopedApply: reference() },
    stageIdentity: { namespace: "gaep-managed-stage" as const, stageKey: "stage.product-view", generation: 3, scopeDigest: digest("e") },
    rollbackPoints: [{ id: rollbackPointId, ordinal: 1, rollbackPointKey: "checkpoint.product-view", kind: "pre-apply-stage" as const,
      stageGeneration: 3, scopeDigest: digest("e"), checkpointDigest: digest("f"), bindingsDigest: digest("1"), workflowStrategy: "sequential" as const,
      orderedWorkflowStepIds: [workflowStepId], completedWorkflowStepIds: [], evidenceReferences: evidence, state: "candidate-defined" as const,
      actualCheckpointTruthState: "not-established" as const, rollbackExecutionState: "not-performed" as const }],
    subjects: [{ id: subjectId, ordinal: 1, subjectKey: "subject.product-view", scopedApplySelectedPathId: selectedPathId, stagingPathId,
      rollbackPointId, recoveryPlanKey: "recovery.product-view", pathCandidate: "apps/vscode/src/product-view.ts", stagingPathDigest: digest("2"),
      scopeState: "candidate-exact" as const, evidenceReferences: evidence, sourceMutationState: "not-performed" as const,
      rollbackExecutionState: "not-performed" as const, recoveryExecutionState: "not-performed" as const, outcomeTruthState: "not-established" as const }],
    recoveryPlans: [{ key: "recovery.product-view", rollbackPointId, failureModeKey: "failure.interrupted-apply", recoveryPlanKey: "plan.restore-stage",
      scope: "scoped-selection" as const, subjectIds: [subjectId], orderedSteps: [{ ordinal: 1, action: "contain" as const, executionState: "not-performed" as const },
        { ordinal: 2, action: "verify-checkpoint" as const, executionState: "not-performed" as const },
        { ordinal: 3, action: "revalidate" as const, executionState: "not-performed" as const }], evidenceReferences: evidence,
      state: "candidate-defined" as const, executionState: "not-performed" as const, successState: "not-established" as const, returnToServiceState: "not-authorized" as const }],
    safeguards: { staleStageRejectionState: "candidate-defined" as const, scopeConfinementState: "candidate-defined" as const,
      checkpointIntegrityState: "candidate-defined" as const, tamperRejectionState: "candidate-defined" as const, atomicityState: "candidate-defined" as const,
      powerLossState: "not-assessed" as const, unsupportedEffectState: "not-assessed" as const }, evidenceReferences: evidence,
    preconditions: ["Exact current stage, scope, checkpoint and recovery bindings must be revalidated before any effect"], unresolvedQuestions: [],
    limitations: ["This candidate does not execute rollback or recovery and does not establish power-loss behavior"], reviewState: "ready-for-human-review" as const,
    definedBy: { kind: "human" as const, id: "reviewer" }, definedAt: "2026-08-01T00:20:00.000Z", stageTruthState: "not-established" as const,
    repositoryTruthState: "not-established" as const, sourceTruthState: "not-established" as const, approvalState: "not-established" as const,
    authorizationState: "not-established" as const, sourceMutationState: "not-performed" as const, rollbackExecutionState: "not-performed" as const,
    recoveryExecutionState: "not-performed" as const, recoveryOutcomeState: "not-established" as const, returnToServiceState: "not-authorized" as const,
    acceptanceState: "not-established" as const, nativeHostAcceptanceState: "not-established" as const, liveProviderAcceptanceState: "not-established" as const,
    securityAcceptanceState: "not-established" as const, releaseReadinessState: "not-established" as const, deploymentReadinessState: "not-established" as const,
    actionAuthorityState: "not-granted" as const }
}

describe("Rollback and Recovery contract", () => {
  it("accepts exact candidate checkpoint, subject and plan coverage while all effects remain absent", () => {
    expect(rollbackRecoveryInputSchema.parse(fixture())).toMatchObject({ rollbackPoints: [{ state: "candidate-defined", rollbackExecutionState: "not-performed" }],
      subjects: [{ scopeState: "candidate-exact", recoveryExecutionState: "not-performed" }], safeguards: { powerLossState: "not-assessed" }, actionAuthorityState: "not-granted" })
  })
  it("rejects traversal, stale generation, incomplete or duplicate coverage, invalid checkpoints, and secrets", () => {
    const input = fixture(), point = input.rollbackPoints[0]!, subject = input.subjects[0]!, plan = input.recoveryPlans[0]!
    expect(rollbackRecoveryInputSchema.safeParse({ ...input, subjects: [{ ...subject, pathCandidate: "../escape.ts" }] }).success).toBe(false)
    expect(rollbackRecoveryInputSchema.safeParse({ ...input, rollbackPoints: [{ ...point, stageGeneration: 4 }] }).success).toBe(false)
    expect(rollbackRecoveryInputSchema.safeParse({ ...input, recoveryPlans: [{ ...plan, subjectIds: [] }] }).success).toBe(false)
    expect(rollbackRecoveryInputSchema.safeParse({ ...input, recoveryPlans: [{ ...plan }, { ...plan, key: "recovery.duplicate" }] }).success).toBe(false)
    expect(rollbackRecoveryInputSchema.safeParse({ ...input, rollbackPoints: [{ ...point, completedWorkflowStepIds: [randomUUID()] }] }).success).toBe(false)
    expect(rollbackRecoveryInputSchema.safeParse({ ...input, limitations: ["password=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false)
  })
})
