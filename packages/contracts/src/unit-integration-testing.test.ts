import { randomUUID } from "node:crypto"
import { describe, expect, it } from "vitest"

import { unitIntegrationTestingInputSchema } from "./unit-integration-testing.js"

const digest = (value: string) => `sha256:${value.repeat(64)}` as const
const reference = () => ({ recordId: randomUUID(), revision: 1, digest: digest("a") })
function fixture() {
  const evidence = [{ kind: "review" as const, sourceId: "unit-integration-suite", revision: 1, digest: digest("b"), evidenceState: "human-reviewed" as const }]
  const dependencies = {
    testGeneration: reference(), testMethodology: reference(), testInventory: reference(), acceptanceCriteria: reference(), implementationUnitModel: reference(),
    changedUnitInventory: reference(), proposedChangePreview: reference(), stagingWorkspace: reference(), changeConflictDetection: reference(),
    riskRegister: reference(), evidenceRegistry: reference(),
  }
  const common = { testInventoryAssetId: randomUUID(), methodologyScopeId: randomUUID(), acceptanceCriterionIds: [randomUUID()],
    requirementKeys: ["REQ-TEST-1"], riskKeys: ["risk.test-isolation"], frameworkCandidate: "vitest", environmentCandidate: "node.isolated",
    fixtureCandidates: ["bounded Product Studio projection"], oracleCandidates: ["renders exact privacy-safe metadata"],
    expectedCoverageCandidates: ["coverage.product-view"], evidenceReferences: evidence, repeatabilityState: "candidate-repeatable" as const,
    isolationState: "candidate-isolated" as const, state: "candidate-defined" as const, productTestExecutionState: "not-performed" as const,
    productTestResultState: "not-established" as const, productCoverageTruthState: "not-established" as const,
    qualityState: "not-established" as const, acceptanceState: "not-established" as const }
  const suite = { id: randomUUID(), ordinal: 1, suiteKey: "suite.product-view", testGenerationTargetId: randomUUID(),
    changeConflictSubjectId: randomUUID(), implementationUnitId: randomUUID(), sourcePathCandidate: "apps/vscode/src/product-view.ts",
    testPathCandidate: "apps/vscode/src/product-view.test.ts", cases: [
      { ...common, id: randomUUID(), ordinal: 1, caseKey: "case.product-view.unit", kind: "unit" as const },
      { ...common, id: randomUUID(), ordinal: 2, caseKey: "case.product-view.integration", kind: "integration" as const },
    ], evidenceReferences: evidence, state: "candidate-defined" as const, repositoryTruthState: "not-established" as const,
    sourceTruthState: "not-established" as const, testAssetTruthState: "not-established" as const,
    productExecutionState: "not-performed" as const, productResultState: "not-established" as const }
  return { initiativeId: randomUUID(), context: { productRevision: 1, productDigest: digest("c"), initiativeRevision: 1, initiativeDigest: digest("d") },
    informationClassification: "internal" as const, title: "Unit and integration suite candidate", dependencies, suites: [suite], evidenceReferences: evidence,
    preconditions: ["Exact current test planning, change, risk, and evidence candidates must be revalidated"], unresolvedQuestions: [],
    limitations: ["Suite candidates do not establish source, test asset, Product execution, result, coverage, or quality truth"],
    reviewState: "ready-for-human-review" as const, plannedBy: { kind: "human" as const, id: "test-planner" }, plannedAt: "2026-08-01T08:00:00.000Z",
    repositoryTruthState: "not-established" as const, sourceTruthState: "not-established" as const, testAssetTruthState: "not-established" as const,
    localHarnessExecutionEvidenceState: "separate-not-bound-as-product-truth" as const, productTestExecutionState: "not-performed" as const,
    productTestResultState: "not-established" as const, productCoverageTruthState: "not-established" as const, qualityState: "not-established" as const,
    approvalState: "not-established" as const, acceptanceState: "not-established" as const, nativeHostAcceptanceState: "not-established" as const,
    securityAcceptanceState: "not-established" as const, releaseReadinessState: "not-established" as const,
    deploymentReadinessState: "not-established" as const, actionAuthorityState: "not-granted" as const }
}

describe("Unit and Integration Testing contract", () => {
  it("accepts bounded unit and integration suite metadata without claiming Product execution or results", () => {
    expect(unitIntegrationTestingInputSchema.parse(fixture())).toMatchObject({
      suites: [{ cases: [{ kind: "unit" }, { kind: "integration" }], productExecutionState: "not-performed" }],
      localHarnessExecutionEvidenceState: "separate-not-bound-as-product-truth", actionAuthorityState: "not-granted",
    })
  })

  it("rejects traversal, duplicate subjects, incomplete suites, invalid repeatability, and secrets", () => {
    const input = fixture(), suite = input.suites[0]!, unitCase = suite.cases[0]!
    expect(unitIntegrationTestingInputSchema.safeParse({ ...input, suites: [{ ...suite, testPathCandidate: "../escape.test.ts" }] }).success).toBe(false)
    expect(unitIntegrationTestingInputSchema.safeParse({ ...input, suites: [suite, { ...suite, id: randomUUID(), suiteKey: "suite.duplicate", testPathCandidate: "apps/vscode/src/duplicate.test.ts" }] }).success).toBe(false)
    expect(unitIntegrationTestingInputSchema.safeParse({ ...input, suites: [{ ...suite, cases: [unitCase] }] }).success).toBe(false)
    expect(unitIntegrationTestingInputSchema.safeParse({ ...input, suites: [{ ...suite, cases: [{ ...unitCase, repeatabilityState: "not-assessed" }, suite.cases[1]!] }] }).success).toBe(false)
    expect(unitIntegrationTestingInputSchema.safeParse({ ...input, limitations: ["api_key=abcdefghijklmnopqrstuvwxyz123456"] }).success).toBe(false)
  })
})
