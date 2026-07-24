import type { ManagedRunRecord, ManagedRunResult } from "@gaep/contracts"
import { describe, expect, it } from "vitest"

import {
  managedRecoveryPassPresentation,
  managedRecoveryPresentation,
  privacySafeRecoveryDiagnostic,
  revalidateManagedDiscardAfterError,
} from "./managed-recovery-presentation.js"

function record(
  state: ManagedRunRecord["state"],
  recovery: ManagedRunRecord["recovery"] = { status: "not-required" },
): ManagedRunRecord {
  return { state, recovery } as ManagedRunRecord
}

function result(...warnings: ManagedRunResult["warnings"]): ManagedRunResult {
  return { warnings } as ManagedRunResult
}

describe("Managed Run recovery presentation", () => {
  it("keeps pending review provisional and exposes discard review without an apply claim", () => {
    expect(managedRecoveryPresentation(record("review-required"), result("provider-output-redacted"))).toMatchObject({
      kind: "pending-review",
      status: "Pending human review",
      canOpenDiscardReview: true,
      canRetryRecovery: false,
      meaning: expect.stringMatching(/not approval, apply success, or Product outcome completion/i),
    })
  })

  it("reports applying as deferred without inferring active ownership or recovery completion", () => {
    expect(managedRecoveryPresentation(record("applying"))).toMatchObject({
      kind: "recovery-deferred",
      status: "Apply or restart recovery is deferred",
      canOpenDiscardReview: false,
      canRetryRecovery: true,
      meaning: expect.stringMatching(/non-terminal.*not inferred/i),
    })
  })

  it("distinguishes conflict, quarantine, unknown outcome, and local-cleanup-pending truth", () => {
    expect(managedRecoveryPresentation(record("conflict"))).toMatchObject({
      kind: "conflict",
      canOpenDiscardReview: true,
      meaning: expect.stringMatching(/apply success is not claimed/i),
    })
    expect(managedRecoveryPresentation(record("unknown", {
      status: "resume-unavailable",
      reasonCode: "local-apply-journal-quarantined",
    }), result("local-cleanup-pending"))).toMatchObject({
      kind: "quarantined",
      status: "Quarantined recovery state",
      localCleanup: expect.stringMatching(/not verified/i),
      meaning: expect.stringMatching(/No cleanup, apply, resume, or outcome success is claimed/i),
    })
    expect(managedRecoveryPresentation(record("unknown"), result("local-cleanup-pending"))).toMatchObject({
      kind: "local-cleanup-pending",
      status: "Unknown outcome with local cleanup pending",
    })
  })

  it("withholds raw upstream errors, paths, and credential text from recovery diagnostics", () => {
    const failure = Object.assign(
      new Error("failed at /Users/private/recovery password=TOP-SECRET"),
      { reasonCode: "lock-timeout" },
    )
    const diagnostic = privacySafeRecoveryDiagnostic(failure)
    expect(diagnostic).toEqual({
      code: "lock-timeout",
      message: "Recovery is deferred because GAEP could not verify the persisted and machine-local recovery boundary.",
      diagnostic: "Recovery boundary lock-timeout; raw local paths, credentials, and upstream error text are withheld.",
    })
    expect(JSON.stringify(diagnostic)).not.toMatch(/Users\/private|TOP-SECRET/i)
    const hostile = privacySafeRecoveryDiagnostic({
      reasonCode: "password-top-secret",
      message: "/Users/private/recovery",
    })
    expect(hostile.code).toBe("recovery-verification-failed")
    expect(JSON.stringify(hostile)).not.toMatch(/password-top-secret|Users\/private/i)
  })

  it("never turns a returned recovery pass into an unqualified completion claim", () => {
    const deferred = managedRecoveryPassPresentation([record("applying")], true)
    expect(deferred).toMatchObject({
      level: "warning",
      message: expect.stringMatching(/remains non-terminal.*Recovery is deferred.*no apply, cleanup, or outcome success/i),
    })
    const bounded = managedRecoveryPassPresentation(
      Array.from({ length: 201 }, () => record("completed")),
      true,
    )
    expect(bounded).toMatchObject({
      level: "warning",
      message: expect.stringMatching(/bounded to the newest 200 of 201.*No complete recovery or cleanup claim/i),
    })
    const settled = managedRecoveryPassPresentation([record("completed")], true)
    expect(settled).toMatchObject({
      level: "information",
      message: expect.stringMatching(/does not attest provider outcome or machine-local cleanup/i),
    })
    expect([deferred.message, bounded.message, settled.message].join(" ")).not.toMatch(/recovery completed/i)
  })

  it("reports persisted discarded when a post-commit throw is followed by an exact audited advanced record", async () => {
    const previous = {
      ...record("review-required"),
      id: "66666666-6666-4666-8666-666666666666",
      productId: "11111111-1111-4111-8111-111111111111",
      initiativeId: "22222222-2222-4222-8222-222222222222",
      runId: "33333333-3333-4333-8333-333333333333",
      bindingsDigest: `sha256:${"a".repeat(64)}`,
      revision: 2,
    } as ManagedRunRecord
    const persisted = {
      ...previous,
      state: "discarded",
      revision: 3,
      resultId: "77777777-7777-4777-8777-777777777777",
      resultDigest: `sha256:${"b".repeat(64)}`,
    } as ManagedRunRecord
    let outcome
    try {
      await (async () => {
        // Simulate the engine persisting discard before an injected post-commit fault escapes.
        throw new Error("injected post-commit discard fault")
      })()
    } catch {
      outcome = await revalidateManagedDiscardAfterError(previous, {
        readManagedRun: async () => persisted,
        verifyAudit: async () => ({ valid: true }),
      })
    }
    expect(outcome).toBeDefined()
    if (!outcome) throw new Error("Expected post-error discard revalidation")
    expect(outcome).toMatchObject({
      status: "persisted-discarded",
      record: persisted,
      message: expect.stringMatching(/persisted state discarded.*cleanup, recovery completion, and provider outcome remain unknown/i),
    })
    expect(outcome.message).not.toMatch(/remains unresolved|pending/i)
  })

  it("reports the persisted discard outcome as unknown when the error cannot be revalidated", async () => {
    const previous = {
      ...record("conflict"),
      id: "66666666-6666-4666-8666-666666666666",
      revision: 4,
    } as ManagedRunRecord
    const outcome = await revalidateManagedDiscardAfterError(previous, {
      readManagedRun: async () => { throw new Error("/Users/private password=TOP-SECRET") },
      verifyAudit: async () => ({ valid: true }),
    })
    expect(outcome).toEqual({
      status: "unknown",
      message: "The persisted discard outcome is unknown. Runs & Evidence is refreshing; no pending, discarded, cleanup, recovery, or outcome state is claimed.",
    })
    expect(JSON.stringify(outcome)).not.toMatch(/remains unresolved|Users\/private|TOP-SECRET/i)
  })
})
