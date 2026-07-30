import { randomUUID } from "node:crypto"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { BacklogHierarchyInput, MvpSliceDefinitionInput, PrioritizationModelInput } from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { GaepEngine } from "./engine.js"

const actorId = "founder"
const rootScope = { kind: "workspace-relative" as const, path: "." }
const engineScope = { kind: "workspace-relative" as const, path: "packages/engine" }

describe("MVP and Slice Definition engine", () => {
  let workspace: string
  let engine: GaepEngine

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-mvp-slice-definition-"))
    engine = new GaepEngine(workspace, [])
  })

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  async function fixture() {
    const product = await engine.createProduct({
      name: "Atlas",
      summary: "A governed MVP and vertical-slice test Product.",
      problem: "A hierarchy alone does not classify bounded delivery scope.",
      affectedUsers: "Founders and product engineering teams",
      desiredOutcome: "MVP scope and vertical slices remain exact without implying permission.",
      successSignals: ["One candidate-testable vertical slice can be inspected"],
      firstWorkflow: "Create and assess one bounded MVP and Slice Definition candidate.",
      exclusions: ["Automatic priority, commitment, readiness, assignment, or execution"],
      profile: "software",
    }, actorId)
    const initiative = await engine.createInitiative({
      title: "MVP slice definition",
      outcome: "Expose one governed candidate-testable vertical slice.",
      scope: ["Local Product Studio"],
      exclusions: ["Approval, readiness, assignment, execution, and release authority"],
    }, actorId)
    const requirement = await engine.productStudio.createRequirement({
      key: "SLICE-001",
      statement: "Every selected Story and Task must retain exact Requirement traceability.",
      rationale: "MVP decomposition must retain Product intent.",
      priority: "must",
      verificationCriteria: ["Inspect exact Requirement revision and digest links"],
      sourceRecords: [],
    }, product.revision!, actorId)
    const change = await engine.productStudio.createChange({
      initiativeId: initiative.id,
      title: "Introduce governed MVP slices",
      summary: "Add an exact candidate scope over the governed hierarchy.",
      baseline: {
        kind: "genesis",
        declaration: "No governed MVP and Slice Definition exists for this Initiative.",
        rationale: "Create the first bounded candidate.",
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
    const epicWork = await createWorkItem("Represent the MVP outcome", "Represent the Initiative outcome as an Epic candidate.")
    const featureWork = await createWorkItem("Represent the MVP capability", "Represent one Feature candidate beneath the Epic.")
    const storyWork = await createWorkItem("Represent slice user value", "Represent one Requirement-traced Story candidate.")
    const taskWork = await createWorkItem("Represent slice delivery step", "Represent one Requirement-traced Task candidate.")
    const changeReference = {
      recordType: "change" as const, recordId: change.id, revision: change.revision, digest: canonicalDigest(change),
    }
    const requirementReference = {
      recordType: "requirement" as const, recordId: requirement.id, revision: requirement.revision,
      digest: canonicalDigest(requirement), key: requirement.key,
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
      id, key, level, title: `${level} candidate`,
      workItem: { recordType: "work-item" as const, recordId: workItem.id, revision: workItem.revision, digest: canonicalDigest(workItem) },
      change: changeReference,
      ...(parentId ? { parentId } : {}),
      ordinal,
      requirements: level === "story" || level === "task" ? [requirementReference] : [],
    })
    const hierarchyInput: BacklogHierarchyInput = {
      initiativeId: initiative.id,
      context: {
        productRevision: product.revision!, productDigest: canonicalDigest(product),
        initiativeRevision: initiative.revision!, initiativeDigest: canonicalDigest(initiative),
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
    const hierarchy = await engine.backlogHierarchy.create(hierarchyInput, actorId)
    const input: MvpSliceDefinitionInput = {
      initiativeId: initiative.id,
      context: hierarchyInput.context,
      informationClassification: "internal",
      title: "Atlas MVP and vertical slice candidate",
      hierarchy: { recordId: hierarchy.id, revision: hierarchy.revision, digest: canonicalDigest(hierarchy) },
      scopeEntries: hierarchy.nodes.map((entry) => ({
        nodeId: entry.id,
        key: entry.key,
        level: entry.level,
        ordinal: entry.ordinal,
        disposition: "mvp" as const,
        rationale: `Include ${entry.level} candidate in the bounded MVP scope.`,
      })),
      slices: [{
        id: randomUUID(), key: "atlas.first.slice", ordinal: 1,
        storyNodeIds: [storyId], taskNodeIds: [taskId], dependencySliceIds: [],
        testabilityState: "candidate-testable",
      }],
      scopeCompletenessState: "candidate-complete",
      unresolvedQuestions: [],
      limitations: ["Scope approval, acceptance validity, readiness, assignment, execution, and implementation authority remain unestablished."],
      reviewState: "ready-for-human-review",
      prioritizationState: "not-established",
      backlogCommitmentState: "not-established",
      scopeApprovalState: "not-established",
      acceptanceCriteriaValidityState: "not-established",
      readyDoneState: "not-established",
      implementationReadinessState: "not-established",
      assignmentExecutionState: "not-established",
      implementationAuthorityState: "not-granted",
    }
    return { product, initiative, hierarchy, hierarchyInput, input }
  }

  function prioritizationInput(
    initiativeId: string,
    context: MvpSliceDefinitionInput["context"],
    mvp: Awaited<ReturnType<typeof engine.mvpSliceDefinition.create>>,
  ): PrioritizationModelInput {
    const evidence = (kind: "value-hypothesis" | "risk-register" | "dependency-analysis" | "cost-estimate") => [{
      kind,
      recordId: randomUUID(),
      revision: 1,
      digest: `sha256:${"1".repeat(64)}` as const,
    }]
    return {
      initiativeId,
      context,
      informationClassification: "internal",
      title: "Atlas explainable prioritization candidate",
      mvpSliceDefinition: { recordId: mvp.id, revision: mvp.revision, digest: canonicalDigest(mvp) },
      method: {
        key: "weighted.value-risk-dependency-cost",
        version: "1.0",
        calculation: "weighted-sum-v1",
        normalization: "zero-to-one-hundred",
        weights: { value: 40, riskReduction: 30, dependencyEnablement: 20, costSize: 10 },
        tieBreaker: "slice-ordinal-ascending",
      },
      subjects: mvp.slices.map((slice) => ({
        sliceId: slice.id,
        sliceKey: slice.key,
        ordinal: slice.ordinal,
        value: { state: "candidate-estimate", score: 80, evidence: evidence("value-hypothesis"), uncertainty: [] },
        riskReduction: { state: "candidate-estimate", score: 70, evidence: evidence("risk-register"), uncertainty: [] },
        dependencyEnablement: { state: "candidate-estimate", score: 60, evidence: evidence("dependency-analysis"), uncertainty: [] },
        costSize: { state: "candidate-estimate", score: 40, evidence: evidence("cost-estimate"), uncertainty: [] },
      })),
      unresolvedQuestions: [],
      limitations: ["Evidence validity, priority, commitment, scope, approval, readiness, assignment, execution, and action authority remain unestablished."],
      reviewState: "ready-for-human-review",
      evidenceValidityState: "not-established",
      priorityDecisionState: "not-established",
      commitmentState: "not-established",
      scopeDecisionState: "not-established",
      approvalState: "not-established",
      acceptanceCriteriaValidityState: "not-established",
      readyDoneState: "not-established",
      implementationReadinessState: "not-established",
      assignmentExecutionState: "not-established",
      implementationAuthorityState: "not-granted",
    }
  }

  it("persists immutable revisions and emits minimized exact audit evidence", async () => {
    const { initiative, input } = await fixture()
    const created = await engine.mvpSliceDefinition.create(input, actorId)
    expect(created.revision).toBe(1)
    const revised = await engine.mvpSliceDefinition.revise(created.id, created.revision, {
      ...input, title: "Atlas reviewed MVP and vertical slice candidate",
    }, actorId)
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created) })
    expect((await engine.mvpSliceDefinition.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect((await engine.mvpSliceDefinition.readRevision(created.id, 1)).title).toBe(input.title)
    await expect(engine.mvpSliceDefinition.create(input, actorId)).rejects.toThrow(/only one current/u)

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    const event = events.findLast((entry) => entry.eventType === "mvp-slice-definition.revised")
    expect(event?.payload).toMatchObject({
      initiativeId: initiative.id,
      revision: 2,
      scopeNodeCount: 4,
      sliceCount: 1,
      prioritizationState: "not-established",
      implementationAuthorityState: "not-granted",
      actionAuthorityState: "not-granted",
    })
    expect(JSON.stringify(event)).not.toContain("Include story candidate")
    expect((await engine.repository.verifyAudit()).valid).toBe(true)
  })

  it("assesses exact MVP scope and projects privacy-safe slice metadata", async () => {
    const { initiative, input } = await fixture()
    const created = await engine.mvpSliceDefinition.create(input, actorId)
    const status = await engine.mvpSliceDefinition.assess(initiative.id)
    expect(status).toMatchObject({
      state: "complete-for-review",
      scopeNodeCount: 4,
      mvpNodeCount: 4,
      laterNodeCount: 0,
      excludedNodeCount: 0,
      sliceCount: 1,
      storyCount: 1,
      taskCount: 1,
      staleBindingCount: 0,
      staleHierarchyCount: 0,
      invalidScopeCount: 0,
      invalidSliceCount: 0,
      unassignedMvpStoryTaskCount: 0,
    })
    const projection = await engine.mvpSliceDefinition.project(initiative.id)
    expect(projection.candidate).toMatchObject({ id: created.id, scopeNodeCount: 4, sliceCount: 1, storyCount: 1, taskCount: 1 })
    expect(projection.snapshotDigest).toMatch(/^sha256:[0-9a-f]{64}$/u)
    const serialized = JSON.stringify(projection)
    expect(serialized).not.toContain(input.title)
    expect(serialized).not.toContain(input.scopeEntries[0]!.rationale)
    expect(serialized).not.toContain("founder")
  })

  it("fails closed on stale hierarchy, incomplete scope, and invalid slice membership", async () => {
    const { input } = await fixture()
    const staleHierarchy = structuredClone(input)
    staleHierarchy.hierarchy.digest = `sha256:${"0".repeat(64)}`
    await expect(engine.mvpSliceDefinition.create(staleHierarchy, actorId)).rejects.toThrow(/exact current Backlog Hierarchy/u)

    const incompleteScope = structuredClone(input)
    incompleteScope.scopeEntries[3]!.nodeId = randomUUID()
    await expect(engine.mvpSliceDefinition.create(incompleteScope, actorId)).rejects.toThrow(/classify every exact/u)

    const invalidSlice = structuredClone(input)
    invalidSlice.slices[0]!.taskNodeIds = [input.scopeEntries[1]!.nodeId]
    await expect(engine.mvpSliceDefinition.create(invalidSlice, actorId)).rejects.toThrow(/exact MVP Stories/u)
  })

  it("reports superseded hierarchy binding without synthesizing readiness", async () => {
    const { initiative, hierarchy, hierarchyInput, input } = await fixture()
    const created = await engine.mvpSliceDefinition.create(input, actorId)
    await engine.backlogHierarchy.revise(hierarchy.id, hierarchy.revision, {
      ...hierarchyInput, title: "Superseding candidate delivery hierarchy",
    }, actorId)
    const status = await engine.mvpSliceDefinition.assess(initiative.id)
    expect(status).toMatchObject({ state: "attention-required", staleHierarchyCount: 1 })
    expect(status.reasons).toContain("The candidate does not bind the exact current Backlog Hierarchy")
    expect(status.authorityBoundary).toContain("does-not-establish-priority")
    expect(await engine.mvpSliceDefinition.healthIssues()).toEqual([
      expect.objectContaining({
        code: "mvp-slice-definition.binding-review-required",
        severity: "warning",
        record: { type: created.kind, id: created.id, revision: created.revision },
      }),
    ])
  })

  it("returns an explicit attention state when no candidate exists", async () => {
    const { initiative } = await fixture()
    const status = await engine.mvpSliceDefinition.assess(initiative.id)
    expect(status).toMatchObject({
      state: "attention-required",
      scopeNodeCount: 0,
      scopeCompletenessState: "not-assessed",
      reviewState: "draft",
    })
    expect(status.reasons).toEqual(["No versioned MVP and Slice Definition candidate exists for this Initiative"])
  })

  it("persists and assesses deterministic Prioritization Model candidates without synthesizing priority", async () => {
    const { initiative, input } = await fixture()
    const mvp = await engine.mvpSliceDefinition.create(input, actorId)
    const priorityInput = prioritizationInput(initiative.id, input.context, mvp)
    const created = await engine.prioritizationModel.create(priorityInput, actorId)
    expect(created.scoreCandidates).toEqual([
      expect.objectContaining({ sliceId: mvp.slices[0]!.id, state: "candidate-score", score: 71, rank: 1 }),
    ])
    const revised = await engine.prioritizationModel.revise(created.id, 1, {
      ...priorityInput,
      title: "Atlas reviewed explainable prioritization candidate",
    }, actorId)
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created) })
    expect((await engine.prioritizationModel.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    const status = await engine.prioritizationModel.assess(initiative.id)
    expect(status).toMatchObject({
      state: "complete-for-review",
      subjectCount: 1,
      scoredSubjectCount: 1,
      unassessedSubjectCount: 0,
      evidenceReferenceCount: 4,
      invalidSubjectCount: 0,
      invalidScoreCount: 0,
    })
    expect(status.authorityBoundary).toContain("does-not-establish-evidence-validity-priority")

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    const event = events.findLast((entry) => entry.eventType === "prioritization-model.revised")
    expect(event?.payload).toMatchObject({
      revision: 2,
      subjectCount: 1,
      scoredSubjectCount: 1,
      evidenceValidityState: "not-established",
      priorityDecisionState: "not-established",
      implementationAuthorityState: "not-granted",
      actionAuthorityState: "not-granted",
    })
    expect(JSON.stringify(event)).not.toContain(priorityInput.title)
    expect(JSON.stringify(event)).not.toContain(priorityInput.subjects[0]!.value.evidence[0]!.recordId)
    expect((await engine.repository.verifyAudit()).valid).toBe(true)
  })

  it("projects minimized Prioritization metadata and reports superseded MVP bindings", async () => {
    const { initiative, input } = await fixture()
    const mvp = await engine.mvpSliceDefinition.create(input, actorId)
    const priorityInput = prioritizationInput(initiative.id, input.context, mvp)
    const created = await engine.prioritizationModel.create(priorityInput, actorId)
    const projection = await engine.prioritizationModel.project(initiative.id)
    expect(projection.candidate).toMatchObject({ id: created.id, subjectCount: 1, scoredSubjectCount: 1, evidenceReferenceCount: 4 })
    expect(projection.snapshotDigest).toMatch(/^sha256:[0-9a-f]{64}$/u)
    const serialized = JSON.stringify(projection)
    expect(serialized).not.toContain(priorityInput.title)
    expect(serialized).not.toContain(priorityInput.subjects[0]!.value.evidence[0]!.recordId)
    expect(serialized).not.toContain("founder")

    await engine.mvpSliceDefinition.revise(mvp.id, mvp.revision, { ...input, title: "Superseding MVP slice candidate" }, actorId)
    const status = await engine.prioritizationModel.assess(initiative.id)
    expect(status).toMatchObject({ state: "attention-required", staleMvpSliceDefinitionCount: 1 })
    expect(await engine.prioritizationModel.healthIssues()).toEqual([
      expect.objectContaining({
        code: "prioritization-model.binding-review-required",
        severity: "warning",
        record: { type: created.kind, id: created.id, revision: created.revision },
      }),
    ])
  })

  it("fails closed on mismatched Prioritization subjects and incomplete estimates", async () => {
    const { initiative, input } = await fixture()
    const mvp = await engine.mvpSliceDefinition.create(input, actorId)
    const mismatched = prioritizationInput(initiative.id, input.context, mvp)
    mismatched.subjects[0]!.sliceId = randomUUID()
    await expect(engine.prioritizationModel.create(mismatched, actorId)).rejects.toThrow(/match every exact MVP Vertical Slice/u)

    const incomplete = prioritizationInput(initiative.id, input.context, mvp)
    incomplete.subjects[0]!.value = { state: "not-assessed", evidence: [], uncertainty: [] }
    incomplete.reviewState = "draft"
    await engine.prioritizationModel.create(incomplete, actorId)
    const status = await engine.prioritizationModel.assess(initiative.id)
    expect(status).toMatchObject({ state: "attention-required", scoredSubjectCount: 0, unassessedSubjectCount: 1 })
    expect(status.reasons).toContain("One or more Prioritization subjects are not fully assessed")
  })
})
