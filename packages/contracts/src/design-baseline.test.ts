import { describe, expect, it } from "vitest"

import {
  designBaselineInputSchema,
  designBaselineProjectionSchema,
} from "./design-baseline.js"

const digest = (character: string) => `sha256:${character.repeat(64)}`
const source = {
  sourceId: "11111111-1111-4111-8111-111111111111",
  sourceRevision: 1,
  recordDigest: digest("1"),
  contentDigest: digest("2"),
}
const subject = {
  kind: "finalized-figma-snapshot-import-candidate" as const,
  recordId: "22222222-2222-4222-8222-222222222222",
  revision: 2,
  digest: digest("3"),
  membershipDigest: digest("4"),
  externalFileIdentityDigest: digest("5"),
  returnedExternalVersionDigest: digest("6"),
  itemCatalogDigest: digest("7"),
  itemCount: 1,
}
const scope = {
  kind: "exact-finalized-design-snapshot" as const,
  subjectDigest: subject.digest,
  scopeDigest: digest("8"),
  includedItemDigests: [digest("9")],
  excludedItemDigests: [],
}

function input() {
  return {
    initiativeId: "33333333-3333-4333-8333-333333333333",
    context: {
      productRevision: 7,
      productDigest: digest("a"),
      initiativeRevision: 5,
      initiativeDigest: digest("b"),
    },
    informationClassification: "internal" as const,
    title: "Customer portal Design Baseline candidate",
    objectiveDigest: digest("c"),
    humanDesignApproval: {
      kind: "human-design-approval-candidate" as const,
      recordId: "44444444-4444-4444-8444-444444444444",
      revision: 2,
      digest: digest("d"),
      membershipDigest: digest("e"),
      decisionReceiptDigest: digest("f"),
      subjectDigest: subject.digest,
      scopeDigest: scope.scopeDigest,
      candidateResult: "approved-candidate" as const,
      reviewState: "recorded-human-decision" as const,
      assessmentDigest: digest("0"),
      assessmentState: "complete-for-recorded-decision" as const,
    },
    subject,
    scope,
    baselineLineageId: "55555555-5555-4555-8555-555555555555",
    candidateSetId: "66666666-6666-4666-8666-666666666666",
    candidateSetRevision: 1,
    semanticVersion: "1.0.0",
    versionPolicyDigest: digest("1"),
    designation: {
      key: "propose-customer-portal-baseline",
      kind: "propose-baseline-candidate" as const,
      designationDigest: digest("2"),
      rationaleDigest: digest("3"),
      evidenceDigests: [digest("4")],
      sources: [source],
      proposedBy: { kind: "human" as const, id: "baseline-proposer" },
      proposedAt: "2026-07-30T01:30:00Z",
      validUntil: "2030-07-30T01:30:00Z",
      authorityEvidenceState: "declared-not-verified" as const,
      independenceState: "distinct-actor-declared" as const,
      effectState: "not-applied" as const,
    },
    designationDefinitionDigest: digest("5"),
    designationReceiptDigest: digest("6"),
    candidateResult: "baseline-proposal-candidate" as const,
    unresolvedQuestions: [],
    limitations: ["An approval candidate is not an Approval Determination or Baseline Set designation."],
    reviewState: "ready-for-human-review" as const,
    approvalDeterminationState: "not-established" as const,
    baselineDesignationState: "not-established" as const,
    approverAuthorityState: "not-established" as const,
    separationOfDutiesEnforcementState: "not-established" as const,
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

describe("Design Baseline contract", () => {
  it("accepts an exact candidate-set version without granting baseline authority", () => {
    const parsed = designBaselineInputSchema.parse(input())
    expect(parsed.semanticVersion).toBe("1.0.0")
    expect(parsed.baselineDesignationState).toBe("not-established")
  })

  it("rejects subject drift, invalid version axes, and unbound supersession actions", () => {
    expect(() => designBaselineInputSchema.parse({ ...input(), semanticVersion: "latest" })).toThrow()
    expect(() => designBaselineInputSchema.parse({ ...input(), subject: { ...subject, digest: digest("a") } })).toThrow()
    expect(() => designBaselineInputSchema.parse({
      ...input(),
      designation: { ...input().designation, kind: "supersede-baseline-candidate" },
      candidateResult: "supersession-candidate",
    })).toThrow()
  })

  it("rejects private projection fields and forged snapshot shapes", () => {
    const projection = {
      schemaVersion: 1,
      kind: "design-baseline-projection",
      product: { id: input().context.productDigest.slice(0, 36), revision: 7, digest: digest("a") },
    }
    expect(() => designBaselineProjectionSchema.parse(projection)).toThrow()
    expect(() => designBaselineProjectionSchema.parse({ ...projection, rationale: "private" })).toThrow()
  })
})
