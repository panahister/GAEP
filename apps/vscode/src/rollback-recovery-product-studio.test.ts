import type { RollbackRecoveryProjection } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import { rollbackRecoveryTable } from "./current-engine-studio-data-source.js"

const digest = (value: string) => `sha256:${value.repeat(64)}` as const
function projection(): RollbackRecoveryProjection {
  return { initiative: { id: "22222222-2222-4222-8222-222222222222", revision: 1, digest: digest("2"), state: "active" },
    status: { state: "candidate-defined", subjectCount: 1, recoveryPlanCount: 1, staleBindingCount: 0, coverageGapCount: 0,
      tamperSuspectedCount: 0, unsupportedEffectCount: 0 }, candidate: { id: "33333333-3333-4333-8333-333333333333", revision: 1,
      stageIdentity: { namespace: "gaep-managed-stage", stageKey: "stage.product-view", generation: 3, scopeDigest: digest("3") },
      rollbackPoints: [{ id: "44444444-4444-4444-8444-444444444444", rollbackPointKey: "checkpoint.product-view",
        kind: "pre-apply-stage", state: "candidate-defined", completedWorkflowStepCount: 0, checkpointDigest: digest("4") }],
      subjects: [{ id: "55555555-5555-4555-8555-555555555555", subjectKey: "subject.product-view",
        pathCandidate: "apps/vscode/src/product-view.ts", recoveryPlanKey: "recovery.product-view", scopeState: "candidate-exact" }],
      recoveryPlans: [{ key: "recovery.product-view", scope: "scoped-selection", subjectCount: 1, stepCount: 3, state: "candidate-defined" }],
      safeguards: { staleStageRejectionState: "candidate-defined", scopeConfinementState: "candidate-defined",
        checkpointIntegrityState: "candidate-defined", tamperRejectionState: "candidate-defined", atomicityState: "candidate-defined",
        powerLossState: "not-assessed", unsupportedEffectState: "not-assessed" }, subjectReceiptDigest: digest("5"), planReceiptDigest: digest("6"),
      reviewState: "ready-for-human-review" },
  } as unknown as RollbackRecoveryProjection
}

describe("Product Studio Rollback and Recovery", () => {
  it("renders bounded checkpoint, selected subject, plan and safeguard metadata without promoting it to effect or authority truth", () => {
    const table = rollbackRecoveryTable([projection()])
    expect(table.id).toBe("rollback-recovery")
    expect(table.rows).toHaveLength(3)
    expect(table.rows[0]?.cells).toMatchObject({ stage: "stage.product-view", generation: "3", kind: "rollback-point",
      key: "checkpoint.product-view", subject: "pre-apply-stage", state: "candidate-defined" })
    expect(table.rows[1]?.cells).toMatchObject({ kind: "recovery-subject", key: "subject.product-view",
      subject: "apps/vscode/src/product-view.ts", state: "candidate-exact", detail: "plan recovery.product-view" })
    expect(table.rows[2]?.cells).toMatchObject({ kind: "recovery-plan", key: "recovery.product-view", subject: "scoped-selection",
      state: "candidate-defined", detail: "1 subjects · 3 non-executed steps" })
    expect(table.rows[0]?.cells.safeguards).toContain("power-loss not-assessed")
    expect(table.rows[0]?.cells.boundary).toContain("does not inspect or create a real stage or checkpoint")
    expect(table.rows.every((row) => row.actions.length === 0)).toBe(true)
  })
  it("provides an explicit fail-closed empty and refresh state", () => {
    const table = rollbackRecoveryTable([])
    expect(table.rows).toEqual([])
    expect(table.emptyState?.title).toBe("No governed Rollback and Recovery candidate")
    expect(table.emptyState?.detail).toContain("Refresh Product Studio")
    expect(table.emptyState?.detail).toContain("cannot create or inspect a real stage or checkpoint")
    expect(table.emptyState?.detail).toContain("mutate source")
  })
})
