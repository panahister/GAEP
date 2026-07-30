import { describe, expect, it } from "vitest"

import {
  boilerplateSelectionBindingInputSchema,
  boilerplateSelectionBindingStatusSchema,
} from "./boilerplate-selection-binding.js"

const digest = (value: string) => `sha256:${value.repeat(64)}`
const ids = Array.from({ length: 12 }, (_, index) => `16000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`)

function evidence(kind: "boilerplate-registry" | "implementation-unit" = "boilerplate-registry") {
  return { kind, sourceId: `${kind}-source`, revision: 1, digest: digest(kind === "boilerplate-registry" ? "a" : "b"), evidenceState: "observed-not-validated" as const }
}

function input() {
  return {
    initiativeId: ids[0], context: { productRevision: 1, productDigest: digest("1"), initiativeRevision: 1, initiativeDigest: digest("2") },
    informationClassification: "internal" as const, title: "Candidate boilerplate selection and binding",
    implementationUnitModel: { recordId: ids[1], revision: 1, digest: digest("3") },
    dependencyMapping: { recordId: ids[2], revision: 1, digest: digest("4") },
    technologyProfile: { recordId: ids[3], revision: 1, digest: digest("5") },
    boilerplateRegistry: { recordId: ids[4], revision: 1, digest: digest("6") },
    decisions: [{
      id: ids[5], ordinal: 1, implementationUnitId: ids[6], technologyProfileId: ids[7],
      disposition: "candidate-selected" as const, boilerplateRegistryEntryId: ids[8],
      boilerplateVersionCandidate: "commit-candidate-1", bindingRole: "primary-foundation" as const,
      accountableDecisionRoleCandidate: "organizational-boilerplate-owner-candidate",
      rationale: "The current registry entry is a bounded candidate for this exact implementation unit and profile",
      conditions: ["Accountable approval and compatibility validation remain required"],
      alternativeRegistryEntryIds: [ids[9]], deviationCandidates: ["No effective deviation is granted"],
      exceptionReferenceCandidates: [], evidenceReferences: [evidence(), evidence("implementation-unit")],
      assessedBy: { kind: "human" as const, id: "binding-reviewer" }, assessedAt: "2026-07-30T00:00:00.000Z",
      organizationalApprovalState: "not-established" as const,
      selectionDecisionEffectivenessState: "not-established" as const,
      bindingEffectivenessState: "not-established" as const,
      compatibilityValidationState: "not-established" as const,
    }],
    unresolvedQuestions: [], limitations: ["Candidate decisions require accountable organizational review"],
    reviewState: "ready-for-human-review" as const, organizationalDesignationState: "not-established" as const,
    endorsementApprovalState: "not-established" as const, supportCommitmentState: "not-established" as const,
    selectionDecisionState: "not-established" as const, bindingEffectivenessState: "not-established" as const,
    compatibilityTruthState: "not-established" as const, compatibilityCompletenessState: "not-established" as const,
    compatibilityValidationState: "not-established" as const, licensingApprovalState: "not-established" as const,
    securityApprovalState: "not-established" as const, exceptionWaiverState: "not-established" as const,
    sourceRetrievalState: "not-established" as const, assetImportInstantiationState: "not-established" as const,
    architectureBaselineDesignationState: "not-established" as const, implementationReadinessState: "not-established" as const,
    implementationCompletenessState: "not-established" as const, assignmentExecutionState: "not-established" as const,
    acceptanceDecisionState: "not-established" as const, mergeReadinessState: "not-established" as const,
    releaseReadinessState: "not-established" as const, deploymentReadinessState: "not-established" as const,
    actionAuthorityState: "not-granted" as const,
  }
}

describe("Boilerplate Selection and Binding contracts", () => {
  it("accepts one exact candidate selection without making the decision or binding effective", () => {
    expect(boilerplateSelectionBindingInputSchema.parse(input())).toEqual(input())
  })

  it("rejects duplicate unit decisions, noncanonical order, and incomplete review-ready decisions", () => {
    const duplicate = input()
    duplicate.decisions.push({ ...structuredClone(duplicate.decisions[0]!), id: ids[10], ordinal: 2 })
    expect(() => boilerplateSelectionBindingInputSchema.parse(duplicate)).toThrow(/exactly one/u)

    const ordinal = input()
    ordinal.decisions[0]!.ordinal = 2
    expect(() => boilerplateSelectionBindingInputSchema.parse(ordinal)).toThrow(/contiguous canonical/u)

    const incomplete = {
      ...input(),
      decisions: input().decisions.map(({ boilerplateRegistryEntryId: _entryId, boilerplateVersionCandidate: _version, ...decision }) => ({
        ...decision, disposition: "not-assessed" as const,
      })),
    }
    expect(() => boilerplateSelectionBindingInputSchema.parse(incomplete)).toThrow(/complete evidence-backed/u)
  })

  it("rejects inconsistent selection shape, secrets, and forged effective authority", () => {
    const missingSelection = input()
    delete missingSelection.decisions[0]!.boilerplateRegistryEntryId
    expect(() => boilerplateSelectionBindingInputSchema.parse(missingSelection)).toThrow(/exact registry entry/u)

    const secret = input()
    secret.decisions[0]!.rationale = `api_key=${"x".repeat(24)}`
    expect(() => boilerplateSelectionBindingInputSchema.parse(secret)).toThrow(/secret-shaped/u)
    expect(() => boilerplateSelectionBindingInputSchema.parse({ ...input(), selectionDecisionState: "effective" })).toThrow()
    expect(() => boilerplateSelectionBindingInputSchema.parse({ ...input(), sourceRetrievalState: "retrieved" })).toThrow()
    expect(() => boilerplateSelectionBindingInputSchema.parse({ ...input(), actionAuthorityState: "granted" })).toThrow()
  })

  it("rejects forged candidate-complete status without exact dependencies", () => {
    expect(() => boilerplateSelectionBindingStatusSchema.parse({
      schemaVersion: 1, kind: "boilerplate-selection-binding-status", productId: ids[0], productRevision: 1,
      initiativeId: ids[0], initiativeRevision: 1, decisionCount: 1, selectedCandidateCount: 1,
      notApplicableCandidateCount: 0, deferredCandidateCount: 0, notAssessedCount: 0,
      missingUnitDecisionCount: 0, invalidSelectionCount: 0, registryGapCount: 0, profileMismatchCount: 0,
      unitScopeMismatchCount: 0, versionMismatchCount: 0, missingEvidenceCount: 0, staleBindingCount: 0,
      staleImplementationUnitModelCount: 0, staleDependencyMappingCount: 0, staleTechnologyProfileCount: 0,
      staleBoilerplateRegistryCount: 0, invalidCandidateCount: 0, unresolvedQuestionCount: 0,
      reviewState: "ready-for-human-review", state: "candidate-complete", reasons: [],
      assessedAt: "2026-07-30T00:00:00.000Z",
      authorityBoundary: "boilerplate-selection-binding-status-is-observational-and-does-not-establish-organizational-designation-endorsement-approval-support-commitment-selection-decision-effectiveness-binding-effectiveness-compatibility-truth-or-completeness-or-validation-licensing-or-security-approval-exception-waiver-source-retrieval-import-instantiation-architecture-baseline-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority",
    })).toThrow(/exact current dependencies/u)
  })
})
