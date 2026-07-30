import { describe, expect, it } from "vitest"

import { backlogHierarchyInputSchema, backlogHierarchySchema } from "./backlog-hierarchy.js"

const digest = (value: string) => `sha256:${value.length.toString(16).padStart(64, "0")}`
const ids = {
  initiative: "31000000-0000-4000-8000-000000000001",
  epic: "31000000-0000-4000-8000-000000000011",
  feature: "31000000-0000-4000-8000-000000000012",
  story: "31000000-0000-4000-8000-000000000013",
  task: "31000000-0000-4000-8000-000000000014",
  epicWork: "31000000-0000-4000-8000-000000000021",
  featureWork: "31000000-0000-4000-8000-000000000022",
  storyWork: "31000000-0000-4000-8000-000000000023",
  taskWork: "31000000-0000-4000-8000-000000000024",
  change: "31000000-0000-4000-8000-000000000031",
  requirement: "31000000-0000-4000-8000-000000000041",
  record: "31000000-0000-4000-8000-000000000051",
}

function input() {
  const change = { recordType: "change" as const, recordId: ids.change, revision: 1, digest: digest("change") }
  const requirement = {
    recordType: "requirement" as const,
    recordId: ids.requirement,
    revision: 1,
    digest: digest("requirement"),
    key: "ATLAS-001",
  }
  const node = (id: string, key: string, level: "epic" | "feature" | "story" | "task", workItemId: string,
    ordinal: number, parentId?: string) => ({
    id, key, level, title: `${level} backlog candidate`,
    workItem: { recordType: "work-item" as const, recordId: workItemId, revision: 1, digest: digest(workItemId) },
    change, ...(parentId ? { parentId } : {}), ordinal,
    requirements: level === "story" || level === "task" ? [requirement] : [],
  })
  return {
    initiativeId: ids.initiative,
    context: {
      productRevision: 1,
      productDigest: digest("product"),
      initiativeRevision: 1,
      initiativeDigest: digest("initiative"),
    },
    informationClassification: "internal" as const,
    title: "Atlas delivery backlog hierarchy",
    nodes: [
      node(ids.epic, "atlas.epic", "epic", ids.epicWork, 1),
      node(ids.feature, "atlas.feature", "feature", ids.featureWork, 2, ids.epic),
      node(ids.story, "atlas.story", "story", ids.storyWork, 3, ids.feature),
      node(ids.task, "atlas.task", "task", ids.taskWork, 4, ids.story),
    ],
    hierarchyCompletenessState: "candidate-complete" as const,
    unresolvedQuestions: [],
    limitations: ["Priority, commitment, readiness, assignment, and implementation authority remain unestablished."],
    reviewState: "ready-for-human-review" as const,
    prioritizationState: "not-established" as const,
    backlogCommitmentState: "not-established" as const,
    ownershipAuthorityState: "not-established" as const,
    readyDoneState: "not-established" as const,
    implementationReadinessState: "not-established" as const,
    implementationAuthorityState: "not-granted" as const,
  }
}

describe("Backlog Hierarchy contracts", () => {
  it("accepts one exact canonical Epic to Feature to Story to Task candidate", () => {
    const parsed = backlogHierarchyInputSchema.parse(input())
    expect(parsed.nodes.map((node) => node.level)).toEqual(["epic", "feature", "story", "task"])
  })

  it("rejects orphans, invalid levels, noncanonical ordering, and untraced delivery nodes", () => {
    const orphan = input()
    orphan.nodes[2] = { ...orphan.nodes[2]!, parentId: ids.epic }
    expect(() => backlogHierarchyInputSchema.parse(orphan)).toThrow(/feature parent/u)
    const unordered = input()
    unordered.nodes[2] = { ...unordered.nodes[2]!, ordinal: 4 }
    expect(() => backlogHierarchyInputSchema.parse(unordered)).toThrow(/ordinal/u)
    const untraced = input()
    untraced.nodes[3] = { ...untraced.nodes[3]!, requirements: [] }
    expect(() => backlogHierarchyInputSchema.parse(untraced)).toThrow(/Requirement trace/u)
  })

  it("rejects premature review state and secret-shaped portable content", () => {
    expect(() => backlogHierarchyInputSchema.parse({
      ...input(), hierarchyCompletenessState: "not-assessed", reviewState: "ready-for-human-review",
    })).toThrow(/candidate completeness/u)
    expect(() => backlogHierarchyInputSchema.parse({
      ...input(), title: "api_key=sk-abcdefghijklmnopqrstuvwxyz123456",
    })).toThrow(/secret-shaped/u)
  })

  it("requires exact predecessor semantics and immutable no-authority state", () => {
    const value = input()
    const first = backlogHierarchySchema.parse({
      ...value,
      schemaVersion: 1,
      kind: "backlog-hierarchy-candidate",
      id: ids.record,
      productId: "31000000-0000-4000-8000-000000000002",
      revision: 1,
      membershipDigest: digest(JSON.stringify(value)),
      state: "candidate",
      createdBy: { kind: "human", id: "founder" },
      updatedBy: { kind: "human", id: "founder" },
      createdAt: "2026-07-30T06:00:00.000Z",
      updatedAt: "2026-07-30T06:00:00.000Z",
      authorityBoundary: "backlog-hierarchy-is-a-versioned-candidate-overlay-on-exact-work-items-not-priority-commitment-ownership-ready-done-implementation-readiness-assignment-execution-or-action-authority",
    })
    expect(first.revision).toBe(1)
    expect(() => backlogHierarchySchema.parse({ ...first, revision: 2 })).toThrow(/predecessor/u)
  })
})
