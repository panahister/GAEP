import { describe, expect, it } from "vitest"

import { mvpSliceDefinitionInputSchema, mvpSliceDefinitionSchema } from "./mvp-slice-definition.js"

const digest = (value: string) => `sha256:${value.length.toString(16).padStart(64, "0")}`
const ids = {
  initiative: "32000000-0000-4000-8000-000000000001",
  hierarchy: "32000000-0000-4000-8000-000000000002",
  epic: "32000000-0000-4000-8000-000000000011",
  feature: "32000000-0000-4000-8000-000000000012",
  story: "32000000-0000-4000-8000-000000000013",
  task: "32000000-0000-4000-8000-000000000014",
  slice: "32000000-0000-4000-8000-000000000021",
  record: "32000000-0000-4000-8000-000000000031",
}

function input() {
  return {
    initiativeId: ids.initiative,
    context: {
      productRevision: 1,
      productDigest: digest("product"),
      initiativeRevision: 1,
      initiativeDigest: digest("initiative"),
    },
    informationClassification: "internal" as const,
    title: "Atlas MVP and vertical slice candidate",
    hierarchy: { recordId: ids.hierarchy, revision: 2, digest: digest("hierarchy") },
    scopeEntries: [
      { nodeId: ids.epic, key: "atlas.epic", level: "epic" as const, ordinal: 1, disposition: "mvp" as const, rationale: "Parent context for the selected MVP capability." },
      { nodeId: ids.feature, key: "atlas.feature", level: "feature" as const, ordinal: 2, disposition: "mvp" as const, rationale: "Feature context for the selected end-to-end behavior." },
      { nodeId: ids.story, key: "atlas.story", level: "story" as const, ordinal: 3, disposition: "mvp" as const, rationale: "Story candidate selected for bounded MVP evaluation." },
      { nodeId: ids.task, key: "atlas.task", level: "task" as const, ordinal: 4, disposition: "mvp" as const, rationale: "Task candidate selected for bounded MVP evaluation." },
    ],
    slices: [{
      id: ids.slice,
      key: "atlas.slice",
      ordinal: 1,
      storyNodeIds: [ids.story],
      taskNodeIds: [ids.task],
      dependencySliceIds: [] as string[],
      testabilityState: "candidate-testable" as const,
    }],
    scopeCompletenessState: "candidate-complete" as const,
    unresolvedQuestions: [],
    limitations: ["Scope approval, acceptance validity, readiness, assignment, execution, and implementation authority remain unestablished."],
    reviewState: "ready-for-human-review" as const,
    prioritizationState: "not-established" as const,
    backlogCommitmentState: "not-established" as const,
    scopeApprovalState: "not-established" as const,
    acceptanceCriteriaValidityState: "not-established" as const,
    readyDoneState: "not-established" as const,
    implementationReadinessState: "not-established" as const,
    assignmentExecutionState: "not-established" as const,
    implementationAuthorityState: "not-granted" as const,
  }
}

describe("MVP and Slice Definition contracts", () => {
  it("accepts one exact candidate-complete MVP scope and testable vertical slice", () => {
    const parsed = mvpSliceDefinitionInputSchema.parse(input())
    expect(parsed.scopeEntries).toHaveLength(4)
    expect(parsed.slices[0]?.storyNodeIds).toEqual([ids.story])
    expect(parsed.slices[0]?.taskNodeIds).toEqual([ids.task])
  })

  it("rejects noncanonical scope and slice dependency ordering", () => {
    const unordered = input()
    unordered.scopeEntries[2] = { ...unordered.scopeEntries[2]!, ordinal: 4 }
    expect(() => mvpSliceDefinitionInputSchema.parse(unordered)).toThrow(/scope entries.*ordinal/u)

    const forwardDependency = input()
    forwardDependency.slices[0] = { ...forwardDependency.slices[0]!, dependencySliceIds: [ids.slice] }
    expect(() => mvpSliceDefinitionInputSchema.parse(forwardDependency)).toThrow(/earlier slices/u)
  })

  it("rejects duplicate Story assignment, premature review, and secret-shaped content", () => {
    const duplicate = input()
    duplicate.slices.push({
      ...duplicate.slices[0]!, id: "32000000-0000-4000-8000-000000000022", key: "atlas.slice.two", ordinal: 2,
    })
    expect(() => mvpSliceDefinitionInputSchema.parse(duplicate)).toThrow(/only one Vertical Slice/u)
    expect(() => mvpSliceDefinitionInputSchema.parse({
      ...input(), scopeCompletenessState: "not-assessed", reviewState: "ready-for-human-review",
    })).toThrow(/candidate completeness/u)
    expect(() => mvpSliceDefinitionInputSchema.parse({
      ...input(), title: "api_key=sk-abcdefghijklmnopqrstuvwxyz123456",
    })).toThrow(/secret-shaped/u)
  })

  it("requires exact predecessor semantics and immutable no-authority state", () => {
    const value = input()
    const first = mvpSliceDefinitionSchema.parse({
      ...value,
      schemaVersion: 1,
      kind: "mvp-slice-definition-candidate",
      id: ids.record,
      productId: "32000000-0000-4000-8000-000000000032",
      revision: 1,
      membershipDigest: digest(JSON.stringify(value)),
      state: "candidate",
      createdBy: { kind: "human", id: "founder" },
      updatedBy: { kind: "human", id: "founder" },
      createdAt: "2026-07-30T06:30:00.000Z",
      updatedAt: "2026-07-30T06:30:00.000Z",
      authorityBoundary: "mvp-slice-definition-is-a-versioned-candidate-scope-over-an-exact-backlog-hierarchy-not-priority-commitment-scope-approval-acceptance-criteria-validity-ready-done-implementation-readiness-assignment-execution-or-action-authority",
    })
    expect(first.revision).toBe(1)
    expect(() => mvpSliceDefinitionSchema.parse({ ...first, revision: 2 })).toThrow(/predecessor/u)
  })
})
