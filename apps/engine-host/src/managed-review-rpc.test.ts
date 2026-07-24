import { describe, expect, it } from "vitest"

import { canonicalDigest } from "@gaep/agent-sdk"
import type { ManagedRunEvidence, ManagedRunRecord, ManagedRunResult } from "@gaep/contracts"
import type { ManagedExecutionReview, ManagedPendingReviewStatus } from "@gaep/engine"

import {
  managedReviewPreviewDto,
  managedReviewTransitionDto,
  recordManagedReviewWorkflowGatesNotAssessed,
} from "./managed-review-rpc.js"

const managedRunId = "11111111-1111-4111-8111-111111111111"
const runId = "22222222-2222-4222-8222-222222222222"
const productId = "33333333-3333-4333-8333-333333333333"
const initiativeId = "44444444-4444-4444-8444-444444444444"
const resultId = "55555555-5555-4555-8555-555555555555"
const evidenceId = "66666666-6666-4666-8666-666666666666"
const bindingsDigest = `sha256:${"1".repeat(64)}` as const

function fixtures(state: "review-required" | "discarded" = "review-required") {
  const evidence = {
    schemaVersion: 2,
    kind: "managed-run-evidence",
    id: evidenceId,
    managedRunId,
    runId,
    productId,
    bindingsDigest,
    events: [],
    eventsDigest: `sha256:${"2".repeat(64)}`,
    workflow: {
      plan: { recordType: "workflow-plan", recordId: "77777777-7777-4777-8777-777777777777", revision: 1, digest: `sha256:${"3".repeat(64)}` },
      strategy: "sequential",
      orderedStepIds: ["88888888-8888-4888-8888-888888888888"],
      attempts: [],
      completedStepIds: [],
      charterGates: { requiredEvidence: { status: "not-assessed" }, stopConditions: { status: "not-assessed" } },
      terminalReasonCode: state === "review-required" ? "apply-review-required" : "staged-review-discarded",
      capabilityBoundary: "natural-language-gates-require-explicit-human-or-system-assessment",
    },
    staging: {
      baselineDigest: `sha256:${"4".repeat(64)}`,
      finalDigest: `sha256:${"5".repeat(64)}`,
      changes: [
        {
          path: "src/z.ts",
          kind: "modified",
          beforeDigest: `sha256:${"6".repeat(64)}`,
          afterDigest: `sha256:${"7".repeat(64)}`,
          beforeSize: 10,
          afterSize: 12,
          beforeMode: 0o644,
          afterMode: 0o644,
        },
        {
          path: "src/a.ts",
          kind: "added",
          afterDigest: `sha256:${"8".repeat(64)}`,
          afterSize: 4,
          afterMode: 0o644,
        },
      ],
      excludedPathCount: 0,
      excludedPathSetDigest: canonicalDigest([]),
      applyState: state === "review-required" ? "pending" : "discarded",
    },
    actualEffects: [{ effect: "reversible-change", status: state === "review-required" ? "observed-provisional" : "blocked", evidenceDigest: `sha256:${"9".repeat(64)}` }],
    capturedAt: "2026-07-24T00:00:01.000Z",
    authorityBoundary: "evidence-does-not-self-assert-outcome-or-authorization",
  } as unknown as ManagedRunEvidence
  const result = {
    schemaVersion: 1,
    kind: "managed-run-result",
    id: resultId,
    managedRunId,
    runId,
    productId,
    mode: "codex-staged",
    provider: { adapterId: "gaep.codex-cli", agentId: "codex-cli", modelId: "gpt-test", capabilityDigest: `sha256:${"a".repeat(64)}` },
    providerDisposition: "completed",
    terminationCause: "normal",
    outcome: { status: "not-assessed", basis: "not-evaluated" },
    terminalState: state,
    evidenceId,
    evidenceDigest: canonicalDigest(evidence),
    warnings: ["provider-output-redacted"],
    startedAt: "2026-07-24T00:00:00.000Z",
    endedAt: "2026-07-24T00:00:01.000Z",
    authorityBoundary: "provider-completion-does-not-equal-outcome-completion",
  } as ManagedRunResult
  const record = {
    schemaVersion: 2,
    kind: "managed-run",
    id: managedRunId,
    revision: state === "review-required" ? 3 : 4,
    runId,
    productId,
    initiativeId,
    mode: "codex-staged",
    state,
    provider: result.provider,
    rootManagedRunId: managedRunId,
    attemptNumber: 1,
    recovery: { status: "not-required" },
    bindingsDigest,
    resultId,
    resultDigest: canonicalDigest(result),
    createdAt: "2026-07-24T00:00:00.000Z",
    startedAt: "2026-07-24T00:00:00.000Z",
    updatedAt: "2026-07-24T00:00:01.000Z",
    ...(state === "discarded" ? { endedAt: "2026-07-24T00:00:01.000Z" } : {}),
  } as unknown as ManagedRunRecord
  return { record, result, evidence }
}

function readers(fixture: ReturnType<typeof fixtures>) {
  return {
    readResult: async () => fixture.result,
    readEvidence: async () => fixture.evidence,
    readApplyDecision: async () => { throw new Error("not expected") },
  }
}

describe("managed review RPC projection", () => {
  it("records restarted post-apply Workflow gates as explicitly not assessed", async () => {
    const assessment = await recordManagedReviewWorkflowGatesNotAssessed({} as Parameters<typeof recordManagedReviewWorkflowGatesNotAssessed>[0])
    expect(assessment).toMatchObject({
      status: "not-assessed",
      basis: "system-evaluator",
      evaluator: { kind: "system", id: "gaep.engine-host.review-boundary", version: "1" },
    })
    expect(assessment.evaluator.digest).toMatch(/^sha256:[0-9a-f]{64}$/u)
  })

  it("binds a sorted exact staged inventory and write envelope without private state", async () => {
    const fixture = fixtures()
    const changedInventory = [...fixture.evidence.staging!.changes].sort((left, right) => left.path.localeCompare(right.path))
    const status: ManagedPendingReviewStatus = {
      managedRunId,
      state: "review-required",
      canApply: true,
      canDiscard: true,
      hasLocalJournal: false,
      applyConfirmation: {
        decision: "apply-exact-reviewed-inventory",
        reviewEvidenceId: evidenceId,
        reviewEvidenceDigest: canonicalDigest(fixture.evidence) as `sha256:${string}`,
        changedInventoryDigest: canonicalDigest(changedInventory) as `sha256:${string}`,
        writeEnvelope: ["src"],
        writeEnvelopeDigest: canonicalDigest(["src"]) as `sha256:${string}`,
      },
    }
    const preview = await managedReviewPreviewDto(fixture.record, status, readers(fixture))
    expect(preview.staging.changedInventory.map((change) => change.path)).toEqual(["src/a.ts", "src/z.ts"])
    expect(preview.applyConfirmation?.writeEnvelope).toEqual(["src"])
    expect(preview.postApplyGatePolicy).toBe("record-not-assessed")
    expect(preview.previewDigest).toBe(canonicalDigest(Object.fromEntries(
      Object.entries(preview).filter(([key]) => key !== "previewDigest"),
    )))
    expect(JSON.stringify(preview)).not.toContain("/private/")
    expect(JSON.stringify(preview)).not.toContain("PRIVATE-TOKEN")
  })

  it("rejects rebound state, substituted confirmation and absolute changed paths", async () => {
    const fixture = fixtures()
    const status: ManagedPendingReviewStatus = {
      managedRunId,
      state: "review-required",
      canApply: true,
      canDiscard: true,
      hasLocalJournal: false,
      applyConfirmation: {
        decision: "apply-exact-reviewed-inventory",
        reviewEvidenceId: evidenceId,
        reviewEvidenceDigest: canonicalDigest(fixture.evidence) as `sha256:${string}`,
        changedInventoryDigest: `sha256:${"0".repeat(64)}`,
        writeEnvelope: ["src"],
        writeEnvelopeDigest: canonicalDigest(["src"]) as `sha256:${string}`,
      },
    }
    await expect(managedReviewPreviewDto(fixture.record, { ...status, state: "conflict" }, readers(fixture)))
      .rejects.toThrow(/status/u)
    await expect(managedReviewPreviewDto(fixture.record, status, readers(fixture)))
      .rejects.toThrow(/confirmation/u)
    const privateEvidence = {
      ...fixture.evidence,
      staging: {
        ...fixture.evidence.staging!,
        changes: [{ ...fixture.evidence.staging!.changes[0]!, path: "/private/workspace/secret.ts" }],
      },
    } as ManagedRunEvidence
    const privateResult = { ...fixture.result, evidenceDigest: canonicalDigest(privateEvidence) } as ManagedRunResult
    const privateRecord = { ...fixture.record, resultDigest: canonicalDigest(privateResult) } as ManagedRunRecord
    await expect(managedReviewPreviewDto(privateRecord, {
      ...status,
      canApply: false,
      applyConfirmation: undefined,
    }, readers({ record: privateRecord, result: privateResult, evidence: privateEvidence })))
      .rejects.toThrow()
  })

  it("returns a digest-bound transition only after the reviewed revision advances", async () => {
    const sourceFixture = fixtures()
    const changedInventory = [...sourceFixture.evidence.staging!.changes].sort((left, right) => left.path.localeCompare(right.path))
    const source = await managedReviewPreviewDto(sourceFixture.record, {
      managedRunId,
      state: "review-required",
      canApply: true,
      canDiscard: true,
      hasLocalJournal: false,
      applyConfirmation: {
        decision: "apply-exact-reviewed-inventory",
        reviewEvidenceId: evidenceId,
        reviewEvidenceDigest: canonicalDigest(sourceFixture.evidence) as `sha256:${string}`,
        changedInventoryDigest: canonicalDigest(changedInventory) as `sha256:${string}`,
        writeEnvelope: ["src"],
        writeEnvelopeDigest: canonicalDigest(["src"]) as `sha256:${string}`,
      },
    }, readers(sourceFixture))
    const finalFixture = fixtures("discarded")
    const review = {
      ...finalFixture,
      canApply: false,
      canDiscard: false,
      hasLocalJournal: false,
      applyConfirmation: undefined,
      apply: async () => { throw new Error("not expected") },
      discard: async () => { throw new Error("not expected") },
      disposeLocalJournal: async () => undefined,
    } as ManagedExecutionReview
    const receipt = await managedReviewTransitionDto(
      "discard-exact-managed-review",
      source,
      review,
      readers(finalFixture),
    )
    expect(receipt.managedRunRevision).toBe(4)
    expect(receipt.state).toBe("discarded")
    expect(receipt.transitionDigest).toBe(canonicalDigest(Object.fromEntries(
      Object.entries(receipt).filter(([key]) => key !== "transitionDigest"),
    )))
    await expect(managedReviewTransitionDto(
      "discard-exact-managed-review",
      { ...source, managedRunRevision: 4 },
      review,
      readers(finalFixture),
    )).rejects.toThrow(/advance/u)
  })
})
