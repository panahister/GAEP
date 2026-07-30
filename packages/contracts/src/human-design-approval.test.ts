import { describe, expect, it } from "vitest"

import {
  humanDesignApprovalInputSchema,
  humanDesignApprovalPrerequisiteKeys,
  humanDesignApprovalPrerequisiteKinds,
  humanDesignApprovalProjectionSchema,
} from "./human-design-approval.js"

const digest = (value: string) => `sha256:${value.repeat(64).slice(0, 64)}` as const
const recordIds = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
  "10000000-0000-4000-8000-000000000004",
  "10000000-0000-4000-8000-000000000005",
]

function input() {
  const prerequisites = humanDesignApprovalPrerequisiteKeys.map((key, index) => ({
    key,
    kind: humanDesignApprovalPrerequisiteKinds[key],
    recordId: recordIds[index]!,
    revision: 1,
    digest: digest(String(index + 1)),
    membershipDigest: digest(String(index + 2)),
    assessmentDigest: digest(String(index + 3)),
    assessmentState: key === "designer-ready-gate" ? "complete-for-human-decision" as const : "complete-for-review" as const,
  }))
  const finalized = prerequisites.find((entry) => entry.key === "finalized-figma-snapshot-import")!
  return {
    initiativeId: "20000000-0000-4000-8000-000000000001",
    context: {
      productRevision: 1, productDigest: digest("a"), initiativeRevision: 1, initiativeDigest: digest("b"),
    },
    informationClassification: "internal" as const,
    title: "Customer portal human design decision candidate",
    objectiveDigest: digest("c"),
    prerequisites,
    subject: {
      kind: "finalized-figma-snapshot-import-candidate" as const,
      recordId: finalized.recordId,
      revision: finalized.revision,
      digest: finalized.digest,
      membershipDigest: finalized.membershipDigest,
      externalFileIdentityDigest: digest("d"),
      returnedExternalVersionDigest: digest("e"),
      itemCatalogDigest: digest("f"),
      itemCount: 1,
    },
    scope: {
      kind: "exact-finalized-design-snapshot" as const,
      subjectDigest: finalized.digest,
      scopeDigest: digest("0"),
      includedItemDigests: [digest("1")],
      excludedItemDigests: [],
    },
    decision: {
      key: "approve-customer-portal",
      kind: "approve-candidate" as const,
      decisionDigest: digest("2"),
      rationaleDigest: digest("3"),
      conditionDigests: [digest("4")],
      evidenceDigests: [digest("5")],
      sources: [{
        sourceId: "30000000-0000-4000-8000-000000000001",
        sourceRevision: 1,
        recordDigest: digest("6"),
        contentDigest: digest("7"),
      }],
      decidedBy: { kind: "human" as const, id: "design-approver" },
      decidedAt: "2026-07-30T00:30:00Z",
      validUntil: "2030-07-30T00:30:00Z",
      authorityEvidenceState: "declared-not-verified" as const,
      independenceState: "distinct-actor-declared" as const,
      lifecycleState: "active-candidate" as const,
      effectState: "not-applied" as const,
    },
    decisionDefinitionDigest: digest("8"),
    decisionReceiptDigest: digest("9"),
    candidateResult: "approved-candidate" as const,
    unresolvedQuestions: [],
    limitations: ["Approver authority and separation of duties are recorded but not verified or enforced."],
    reviewState: "recorded-human-decision" as const,
    approverAuthorityState: "not-established" as const,
    separationOfDutiesEnforcementState: "not-established" as const,
    designApprovalState: "not-established" as const,
    designBaselineState: "not-established" as const,
    readinessState: "not-established" as const,
    phaseEntryAuthorityState: "not-granted" as const,
    figmaConnectionAuthorityState: "not-granted" as const,
    credentialAuthorityState: "not-granted" as const,
    permissionGrantState: "not-granted" as const,
    importExecutionState: "not-performed" as const,
    writeExecutionState: "not-performed" as const,
    implementationAuthorityState: "not-granted" as const,
  }
}

describe("Human Design Approval contracts", () => {
  it("accepts an exact attributed approval candidate without granting authority", () => {
    const parsed = humanDesignApprovalInputSchema.parse(input())
    expect(parsed.candidateResult).toBe("approved-candidate")
    expect(parsed.approverAuthorityState).toBe("not-established")
    expect(parsed.designApprovalState).toBe("not-established")
  })

  it("rejects subject, scope, decision-result, and secret-shaped forgeries", () => {
    expect(() => humanDesignApprovalInputSchema.parse({
      ...input(),
      subject: { ...input().subject, recordId: "40000000-0000-4000-8000-000000000001" },
    })).toThrow(/subject/u)
    expect(() => humanDesignApprovalInputSchema.parse({
      ...input(),
      scope: { ...input().scope, includedItemDigests: [], excludedItemDigests: [] },
    })).toThrow(/scope|item/u)
    expect(() => humanDesignApprovalInputSchema.parse({ ...input(), candidateResult: "rejected-candidate" })).toThrow(/result/u)
    expect(() => humanDesignApprovalInputSchema.parse({
      ...input(),
      limitations: ["api_key=abcdefghijklmnopqrstuvwxyz1234567890"],
    })).toThrow(/secret/u)
  })

  it("requires exact revocation metadata for a revoked decision candidate", () => {
    const value = input()
    expect(() => humanDesignApprovalInputSchema.parse({
      ...value,
      decision: { ...value.decision, lifecycleState: "revoked-candidate" },
    })).toThrow(/Revoked/u)
    expect(humanDesignApprovalInputSchema.parse({
      ...value,
      decision: {
        ...value.decision,
        lifecycleState: "revoked-candidate",
        revokedAt: "2026-07-30T00:40:00Z",
        revocationDigest: digest("a"),
      },
    }).decision?.lifecycleState).toBe("revoked-candidate")
  })

  it("keeps projections privacy-safe and authority-denying", () => {
    const value = input()
    expect(() => humanDesignApprovalProjectionSchema.parse({
      schemaVersion: 1,
      kind: "human-design-approval-projection",
      product: { id: "50000000-0000-4000-8000-000000000001", revision: 1, digest: digest("a") },
      initiative: { id: value.initiativeId, revision: 1, digest: digest("b"), state: "active" },
      status: {
        schemaVersion: 1,
        kind: "human-design-approval-status",
        productId: "50000000-0000-4000-8000-000000000001",
        productRevision: 1,
        initiativeId: value.initiativeId,
        initiativeRevision: 1,
        prerequisiteCount: 0,
        completePrerequisiteCount: 0,
        decisionCount: 0,
        approveCount: 0,
        rejectCount: 0,
        requestChangeCount: 0,
        abstainCount: 0,
        expiredDecisionCount: 0,
        revokedDecisionCount: 0,
        staleBindingCount: 0,
        staleSourceReferenceCount: 0,
        unresolvedQuestionCount: 0,
        candidateResult: "not-assessed",
        reviewState: "draft",
        approverAuthorityState: "not-established",
        separationOfDutiesEnforcementState: "not-established",
        state: "attention-required",
        reasons: ["No candidate exists"],
        assessedAt: "2026-07-30T00:40:00Z",
        authorityBoundary: "human-design-approval-status-is-observational-and-does-not-verify-approver-authority-enforce-separation-of-duties-establish-design-approval-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority",
      },
      observedAt: "2026-07-30T00:40:00Z",
      privacyBoundary: "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-decision-rationale-condition-evidence-source-content-human-attribution-personal-content-secrets-credentials-or-permissions",
      authorityBoundary: "human-design-approval-projection-is-read-only-and-does-not-verify-approver-authority-enforce-separation-of-duties-establish-design-approval-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority",
      snapshotDigest: digest("c"),
    })).not.toThrow()
  })
})
