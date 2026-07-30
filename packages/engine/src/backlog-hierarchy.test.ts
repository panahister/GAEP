import { randomUUID } from "node:crypto"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { BacklogHierarchyInput } from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GaepEngine } from "./engine.js"

const actorId = "founder"
const rootScope = { kind: "workspace-relative" as const, path: "." }
const engineScope = { kind: "workspace-relative" as const, path: "packages/engine" }

describe("Backlog Hierarchy engine", () => {
  let workspace: string
  let engine: GaepEngine

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-backlog-hierarchy-"))
    engine = new GaepEngine(workspace, [])
  })

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  async function fixture() {
    const product = await engine.createProduct({
      name: "Atlas",
      summary: "A governed backlog hierarchy test Product.",
      problem: "Flat delivery records do not expose an inspectable planning hierarchy.",
      affectedUsers: "Founders and product engineering teams",
      desiredOutcome: "Every planning layer remains exactly traceable without implying commitment.",
      successSignals: ["Epic through Task candidate relationships can be reviewed"],
      firstWorkflow: "Create and assess one bounded backlog hierarchy candidate.",
      exclusions: ["Automatic prioritization or implementation"],
      profile: "software",
    }, actorId)
    const initiative = await engine.createInitiative({
      title: "Backlog hierarchy slice",
      outcome: "Expose governed Epic through Task candidate relationships.",
      scope: ["Local Product Studio"],
      exclusions: ["Approval, assignment, execution, and release authority"],
    }, actorId)
    const requirement = await engine.productStudio.createRequirement({
      key: "BACKLOG-001",
      statement: "Story and Task candidates must retain exact Requirement traceability.",
      rationale: "Delivery decomposition must not sever Product intent.",
      priority: "must",
      verificationCriteria: ["Inspect exact Requirement revision and digest links"],
      sourceRecords: [],
    }, product.revision!, actorId)
    const change = await engine.productStudio.createChange({
      initiativeId: initiative.id,
      title: "Introduce governed backlog hierarchy",
      summary: "Add an exact candidate overlay to existing Work Items.",
      baseline: {
        kind: "genesis",
        declaration: "No governed backlog hierarchy exists for this Initiative.",
        rationale: "Create the first bounded hierarchy candidate.",
      },
      effectEnvelope: ["reversible-change"],
    }, product.revision!, actorId)
    const createWorkItem = (title: string, objective: string) => engine.productStudio.createWorkItem({
      changeId: change.id,
      title,
      objective,
      dependsOn: [],
      completionCriteria: ["The candidate record passes its exact contract"],
      evidenceCriteria: ["Focused engine tests pass"],
      scope: { read: [rootScope], write: [engineScope], effects: [] },
      owner: { kind: "unassigned" as const },
    }, product.revision!, actorId)
    const epicWork = await createWorkItem(
      "Represent governed planning outcome",
      "Represent the Initiative outcome as an inspectable Epic candidate.",
    )
    const featureWork = await createWorkItem(
      "Represent hierarchy capability",
      "Represent one bounded Feature candidate beneath the Epic.",
    )
    const storyWork = await createWorkItem(
      "Represent traced user value",
      "Represent one Requirement-traced Story candidate beneath the Feature.",
    )
    const taskWork = await createWorkItem(
      "Represent traced delivery step",
      "Represent one Requirement-traced Task candidate beneath the Story.",
    )
    const changeReference = {
      recordType: "change" as const,
      recordId: change.id,
      revision: change.revision,
      digest: canonicalDigest(change),
    }
    const requirementReference = {
      recordType: "requirement" as const,
      recordId: requirement.id,
      revision: requirement.revision,
      digest: canonicalDigest(requirement),
      key: requirement.key,
    }
    const epicId = randomUUID()
    const featureId = randomUUID()
    const storyId = randomUUID()
    const taskId = randomUUID()
    const node = (
      id: string,
      key: string,
      level: "epic" | "feature" | "story" | "task",
      workItem: typeof epicWork,
      ordinal: number,
      parentId?: string,
    ) => ({
      id,
      key,
      level,
      title: `${level} candidate`,
      workItem: {
        recordType: "work-item" as const,
        recordId: workItem.id,
        revision: workItem.revision,
        digest: canonicalDigest(workItem),
      },
      change: changeReference,
      ...(parentId ? { parentId } : {}),
      ordinal,
      requirements: level === "story" || level === "task" ? [requirementReference] : [],
    })
    const input: BacklogHierarchyInput = {
      initiativeId: initiative.id,
      context: {
        productRevision: product.revision!,
        productDigest: canonicalDigest(product),
        initiativeRevision: initiative.revision!,
        initiativeDigest: canonicalDigest(initiative),
      },
      informationClassification: "internal",
      title: "Atlas candidate delivery hierarchy",
      nodes: [
        node(epicId, "atlas.epic", "epic", epicWork, 1),
        node(featureId, "atlas.feature", "feature", featureWork, 2, epicId),
        node(storyId, "atlas.story", "story", storyWork, 3, featureId),
        node(taskId, "atlas.task", "task", taskWork, 4, storyId),
      ],
      hierarchyCompletenessState: "candidate-complete",
      unresolvedQuestions: [],
      limitations: ["Priority, commitment, ownership, ready and done, and implementation authority remain unestablished."],
      reviewState: "ready-for-human-review",
      prioritizationState: "not-established",
      backlogCommitmentState: "not-established",
      ownershipAuthorityState: "not-established",
      readyDoneState: "not-established",
      implementationReadinessState: "not-established",
      implementationAuthorityState: "not-granted",
    }
    return { product, initiative, requirement, change, input }
  }

  it("persists immutable candidate revisions and emits minimized exact audit evidence", async () => {
    const { initiative, input } = await fixture()
    const created = await engine.backlogHierarchy.create(input, actorId)
    expect(created.revision).toBe(1)
    expect(created.membershipDigest).toBe(canonicalDigest({
      initiativeId: input.initiativeId,
      context: input.context,
      informationClassification: input.informationClassification,
      title: input.title,
      nodes: input.nodes,
      hierarchyCompletenessState: input.hierarchyCompletenessState,
      unresolvedQuestions: input.unresolvedQuestions,
      limitations: input.limitations,
      reviewState: input.reviewState,
      prioritizationState: input.prioritizationState,
      backlogCommitmentState: input.backlogCommitmentState,
      ownershipAuthorityState: input.ownershipAuthorityState,
      readyDoneState: input.readyDoneState,
      implementationReadinessState: input.implementationReadinessState,
      implementationAuthorityState: input.implementationAuthorityState,
    }))
    const revised = await engine.backlogHierarchy.revise(created.id, created.revision, {
      ...input,
      title: "Atlas reviewed candidate delivery hierarchy",
    }, actorId)
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created) })
    expect((await engine.backlogHierarchy.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect((await engine.backlogHierarchy.readRevision(created.id, 1)).title).toBe(input.title)
    await expect(engine.backlogHierarchy.create(input, actorId)).rejects.toThrow(/only one current/u)

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    const event = events.findLast((entry) => entry.eventType === "backlog-hierarchy.revised")
    expect(event?.payload).toMatchObject({
      initiativeId: initiative.id,
      revision: 2,
      nodeCount: 4,
      requirementTraceCount: 2,
      prioritizationState: "not-established",
      implementationAuthorityState: "not-granted",
      actionAuthorityState: "not-granted",
    })
    expect(JSON.stringify(event)).not.toContain("Story and Task candidates")
    expect((await engine.repository.verifyAudit()).valid).toBe(true)
  })

  it("assesses an exact four-level hierarchy and projects metadata without backlog content", async () => {
    const { initiative, input } = await fixture()
    const created = await engine.backlogHierarchy.create(input, actorId)
    const status = await engine.backlogHierarchy.assess(initiative.id)
    expect(status).toMatchObject({
      state: "complete-for-review",
      nodeCount: 4,
      epicCount: 1,
      featureCount: 1,
      storyCount: 1,
      taskCount: 1,
      rootCount: 1,
      leafCount: 1,
      requirementTraceCount: 2,
      staleBindingCount: 0,
      staleWorkItemCount: 0,
      staleChangeCount: 0,
      staleRequirementCount: 0,
    })
    const projection = await engine.backlogHierarchy.project(initiative.id)
    expect(projection.candidate).toMatchObject({ id: created.id, nodeCount: 4, requirementTraceCount: 2 })
    expect(projection.snapshotDigest).toMatch(/^sha256:[0-9a-f]{64}$/u)
    const serialized = JSON.stringify(projection)
    expect(serialized).not.toContain(input.title)
    expect(serialized).not.toContain(input.nodes[2]!.title)
    expect(serialized).not.toContain("founder")
  })

  it("fails closed on stale Work Item and Change references before persistence", async () => {
    const { input } = await fixture()
    const staleWorkItem = structuredClone(input)
    staleWorkItem.nodes[0]!.workItem.digest = `sha256:${"0".repeat(64)}`
    await expect(engine.backlogHierarchy.create(staleWorkItem, actorId)).rejects.toThrow(/exact current Work Items/u)
    expect(await engine.backlogHierarchy.readCurrent(input.initiativeId)).toBeUndefined()

    const staleChange = structuredClone(input)
    staleChange.nodes[0]!.change.digest = `sha256:${"0".repeat(64)}`
    await expect(engine.backlogHierarchy.create(staleChange, actorId)).rejects.toThrow(/exact current Changes/u)
    expect(await engine.backlogHierarchy.readCurrent(input.initiativeId)).toBeUndefined()
  })

  it("reports superseded Requirement bindings without converting them into readiness authority", async () => {
    const { initiative, requirement, input } = await fixture()
    const created = await engine.backlogHierarchy.create(input, actorId)
    await engine.productStudio.reviseRequirement(
      requirement.id,
      requirement.revision,
      { state: "accepted" },
      actorId,
      "Accept the exact Product Requirement without changing backlog authority.",
    )
    const status = await engine.backlogHierarchy.assess(initiative.id)
    expect(status).toMatchObject({ state: "attention-required", staleRequirementCount: 2 })
    expect(status.reasons).toContain("One or more Story or Task traces reference a missing, superseded, rejected, or out-of-Product Requirement")
    expect(status.authorityBoundary).toContain("does-not-establish-priority")
    expect(await engine.backlogHierarchy.healthIssues()).toEqual([
      expect.objectContaining({
        code: "backlog-hierarchy.binding-review-required",
        severity: "warning",
        record: { type: created.kind, id: created.id, revision: created.revision },
      }),
    ])
  })

  it("returns an explicit attention state when no candidate exists", async () => {
    const { initiative } = await fixture()
    const status = await engine.backlogHierarchy.assess(initiative.id)
    expect(status).toMatchObject({
      state: "attention-required",
      nodeCount: 0,
      hierarchyCompletenessState: "not-assessed",
      reviewState: "draft",
    })
    expect(status.reasons).toEqual(["No versioned Backlog Hierarchy candidate exists for this Initiative"])
  })
})
