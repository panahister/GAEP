import { randomUUID } from "node:crypto"

import { describe, expect, it } from "vitest"

import { changedUnitInventoryInputSchema, type ChangedUnitInventoryInput } from "./changed-unit-inventory.js"

const digest = `sha256:${"a".repeat(64)}`
const ref = () => ({ recordId: randomUUID(), revision: 1, digest })

function input(): ChangedUnitInventoryInput {
  const unitId = randomUUID()
  const evidence = { kind: "evidence" as const, sourceId: "inventory-review", revision: 1, digest, evidenceState: "human-reviewed" as const }
  return {
    initiativeId: randomUUID(), context: { productRevision: 1, productDigest: digest, initiativeRevision: 1, initiativeDigest: digest },
    informationClassification: "internal", title: "Changed unit inventory candidate",
    backlogHierarchy: ref(), implementationUnitModel: ref(), dependencyMapping: ref(), designToCodeBindingRegistry: ref(),
    routeScreenComponentMapping: ref(), testInventory: ref(), riskRegister: ref(), implementationReadinessGate: ref(),
    realisticExample: { scenarioId: "phase3a-realistic-readiness", revision: 1, receiptDigest: digest, compositionDigest: digest },
    units: [{ id: randomUUID(), ordinal: 1, implementationUnitId: unitId, implementationUnitKey: "unit-a",
      repositoryCandidate: "gaep", moduleCandidate: "packages/example", dependencyUnitIds: [], directBlastRadiusUnitIds: [],
      indirectBlastRadiusUnitIds: [], affectedSurfaceKeys: ["surface-a"], blastRadiusAssessmentState: "candidate-assessed",
      ownerCandidateIds: ["unit-owner"], reviewCandidateIds: ["unit-reviewer"], evidenceReferences: [evidence], outcome: "candidate-scoped",
      pathCandidates: [{ id: randomUUID(), ordinal: 1, pathCandidate: "packages/example/src/index.ts", changeKind: "modify",
        backlogNodeIds: [randomUUID()], requirementKeys: ["REQ-1"], designToCodeBindingSubjectIds: [], routeScreenComponentSubjectIds: [],
        testAssetIds: [randomUUID()], riskKeys: [], evidenceReferences: [evidence] }] }],
    unresolvedQuestions: [], limitations: ["Candidate paths require repository verification"], reviewState: "ready-for-human-review",
    repositoryTruthState: "not-established", pathTruthState: "not-established", changeScopeApprovalState: "not-established",
    changeApprovalState: "not-established", ownershipAppointmentState: "not-established", implementationReadinessState: "not-established",
    codeMutationState: "not-performed", stagingState: "not-performed", assignmentExecutionState: "not-established",
    acceptanceDecisionState: "not-established", mergeReadinessState: "not-established", releaseReadinessState: "not-established",
    deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
  }
}

describe("Changed Unit Inventory contract", () => {
  it("accepts portable, non-authoritative candidates", () => {
    expect(changedUnitInventoryInputSchema.parse(input())).toMatchObject({ codeMutationState: "not-performed", actionAuthorityState: "not-granted" })
  })

  it("rejects machine paths, incomplete move candidates, and secret-shaped values", () => {
    const base = input()
    expect(changedUnitInventoryInputSchema.safeParse({ ...base, units: base.units.map((unit) => ({ ...unit,
      pathCandidates: unit.pathCandidates.map((path) => ({ ...path, pathCandidate: "/Users/person/project/file.ts" })) })) }).success).toBe(false)
    expect(changedUnitInventoryInputSchema.safeParse({ ...base, units: base.units.map((unit) => ({ ...unit,
      pathCandidates: unit.pathCandidates.map((path) => ({ ...path, changeKind: "move" })) })) }).success).toBe(false)
    expect(changedUnitInventoryInputSchema.safeParse({ ...base, title: `api_key=sk-${"x".repeat(32)}` }).success).toBe(false)
  })
})
