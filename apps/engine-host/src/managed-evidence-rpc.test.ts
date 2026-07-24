import { describe, expect, it } from "vitest"

import { canonicalDigest } from "@gaep/agent-sdk"
import type { ManagedRunEvidence, ManagedRunRecord, ManagedRunResult } from "@gaep/contracts"

import { managedEvidenceDetailDto, managedRunPageDto } from "./managed-evidence-rpc.js"

const managedRunId = "11111111-1111-4111-8111-111111111111"
const runId = "22222222-2222-4222-8222-222222222222"
const productId = "33333333-3333-4333-8333-333333333333"
const initiativeId = "44444444-4444-4444-8444-444444444444"
const resultId = "55555555-5555-4555-8555-555555555555"
const evidenceId = "66666666-6666-4666-8666-666666666666"
const stepId = "77777777-7777-4777-8777-777777777777"
const bindingsDigest = `sha256:${"1".repeat(64)}`

function fixtures(): { record: ManagedRunRecord; result: ManagedRunResult; evidence: ManagedRunEvidence } {
  const evidence = {
    schemaVersion: 2,
    kind: "managed-run-evidence",
    id: evidenceId,
    managedRunId,
    runId,
    productId,
    bindingsDigest,
    events: [{ sequence: 0, observedAt: "2026-07-24T00:00:00.000Z", type: "lifecycle", phase: "initialized" }],
    eventsDigest: `sha256:${"2".repeat(64)}`,
    workflow: {
      plan: { recordType: "workflow-plan", recordId: "88888888-8888-4888-8888-888888888888", revision: 1, digest: `sha256:${"3".repeat(64)}` },
      strategy: "sequential",
      orderedStepIds: [stepId],
      attempts: [],
      completedStepIds: [],
      charterGates: {
        requiredEvidence: { status: "not-assessed" },
        stopConditions: { status: "not-assessed" },
      },
      terminalReasonCode: "provider-failed",
      capabilityBoundary: "natural-language-gates-require-explicit-human-or-system-assessment",
    },
    actualEffects: [{ effect: "filesystem-write", status: "not-observed", evidenceDigest: `sha256:${"4".repeat(64)}` }],
    capturedAt: "2026-07-24T00:00:01.000Z",
    authorityBoundary: "evidence-does-not-self-assert-outcome-or-authorization",
  } as unknown as ManagedRunEvidence
  const evidenceDigest = canonicalDigest(evidence)
  const result = {
    schemaVersion: 1,
    kind: "managed-run-result",
    id: resultId,
    managedRunId,
    runId,
    productId,
    mode: "manual-offline",
    provider: { adapterId: "gaep.manual", agentId: "manual", modelId: "offline", capabilityDigest: `sha256:${"5".repeat(64)}` },
    providerDisposition: "failed",
    terminationCause: "provider-failure",
    outcome: { status: "indeterminate", basis: "provider-failure" },
    terminalState: "failed",
    evidenceId,
    evidenceDigest,
    warnings: ["provider-warning-redacted"],
    startedAt: "2026-07-24T00:00:00.000Z",
    endedAt: "2026-07-24T00:00:01.000Z",
    authorityBoundary: "provider-completion-does-not-equal-outcome-completion",
  } as ManagedRunResult
  const record = {
    schemaVersion: 2,
    kind: "managed-run",
    id: managedRunId,
    revision: 2,
    runId,
    productId,
    initiativeId,
    mode: "manual-offline",
    state: "failed",
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
    endedAt: "2026-07-24T00:00:01.000Z",
  } as unknown as ManagedRunRecord
  return { record, result, evidence }
}

describe("managed evidence RPC projection", () => {
  it("projects bounded inventory and exact private-safe evidence without authority", async () => {
    const { record, result, evidence } = fixtures()
    const page = managedRunPageDto({
      items: [record],
      offset: 0,
      limit: 100,
      total: 3,
      snapshotDigest: `sha256:${"6".repeat(64)}`,
      hasMore: true,
    })
    expect(page).toMatchObject({ total: 3, omittedCount: 2, hasMore: true })
    const detail = await managedEvidenceDetailDto(record, {
      readResult: async () => result,
      readEvidence: async () => evidence,
      readApplyDecision: async () => { throw new Error("not expected") },
    })
    expect(detail).toMatchObject({
      artifactStatus: "verified-result-and-evidence",
      result: { providerDisposition: "failed", outcomeStatus: "indeterminate" },
      evidence: { eventCount: 1, workflowStepCount: 1, completedStepCount: 0 },
    })
    expect(detail.evidence?.eventTypeCounts).toEqual({ lifecycle: 1, output: 0, item: 0, approval: 0, warning: 0, error: 0 })
    expect(JSON.stringify({ page, detail })).not.toContain("/private/workspace")
    expect(JSON.stringify(detail)).not.toContain("changedFiles")
  })

  it("rejects substituted result and evidence bindings", async () => {
    const { record, result, evidence } = fixtures()
    await expect(managedEvidenceDetailDto(record, {
      readResult: async () => ({ ...result, productId: initiativeId }),
      readEvidence: async () => evidence,
      readApplyDecision: async () => { throw new Error("not expected") },
    })).rejects.toThrow(/result.*binding/u)
    await expect(managedEvidenceDetailDto(record, {
      readResult: async () => result,
      readEvidence: async () => ({ ...evidence, bindingsDigest: `sha256:${"0".repeat(64)}` }),
      readApplyDecision: async () => { throw new Error("not expected") },
    })).rejects.toThrow(/evidence.*binding/u)
  })
})
