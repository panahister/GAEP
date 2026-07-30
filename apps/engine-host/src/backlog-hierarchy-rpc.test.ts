import { randomUUID } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { BacklogHierarchy, BacklogHierarchyInput, MvpSliceDefinitionInput } from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { EngineHost } from "./host.js"

describe("Backlog Hierarchy host protocol", () => {
  let workspace: string
  let host: EngineHost

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "gaep-backlog-host-"))
    host = new EngineHost(workspace)
  })

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  it("exposes strict protocol-v2 create, read, revise, assess, and snapshot operations", async () => {
    const product = await host.engine.createProduct({
      name: "Atlas",
      summary: "A governed Backlog Hierarchy host fixture.",
      problem: "Native hosts require one strict hierarchy protocol.",
      affectedUsers: "Product engineering teams",
      desiredOutcome: "Every host observes the same exact candidate hierarchy.",
      successSignals: ["The protocol projection digest verifies"],
      firstWorkflow: "Inspect a candidate hierarchy from a native host.",
      exclusions: ["Priority, assignment, and implementation authority"],
      profile: "software",
    }, "host-test")
    const initiative = await host.engine.createInitiative({
      title: "Backlog host projection",
      outcome: "Expose one bounded hierarchy protocol.",
      scope: ["Engine host protocol"],
      exclusions: ["External effects"],
    }, "host-test")
    const requirement = await host.engine.productStudio.createRequirement({
      key: "HOST-BACKLOG-001",
      statement: "Native hosts must display exact Story and Task Requirement traces.",
      rationale: "Host projections must not sever governed intent.",
      priority: "must",
      verificationCriteria: ["The exact Requirement digest crosses the engine boundary"],
      sourceRecords: [],
    }, product.revision!, "host-test")
    const change = await host.engine.productStudio.createChange({
      initiativeId: initiative.id,
      title: "Add Backlog Hierarchy host protocol",
      summary: "Expose the governed candidate lifecycle through protocol v2.",
      baseline: {
        kind: "genesis",
        declaration: "No Backlog Hierarchy host method exists.",
        rationale: "Create the first strict bounded protocol.",
      },
      effectEnvelope: ["reversible-change"],
    }, product.revision!, "host-test")
    const createWorkItem = (title: string) => host.engine.productStudio.createWorkItem({
      changeId: change.id,
      title,
      objective: `Represent the ${title} candidate without granting action authority.`,
      dependsOn: [],
      completionCriteria: ["The exact protocol contract parses"],
      evidenceCriteria: ["The host protocol test passes"],
      scope: {
        read: [{ kind: "workspace-relative", path: "." }],
        write: [{ kind: "workspace-relative", path: "apps/engine-host" }],
        effects: [],
      },
      owner: { kind: "unassigned" as const },
    }, product.revision!, "host-test")
    const epicWork = await createWorkItem("Epic")
    const featureWork = await createWorkItem("Feature")
    const storyWork = await createWorkItem("Story")
    const taskWork = await createWorkItem("Task")
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
      title: `${level} host candidate`,
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
      title: "Host candidate hierarchy",
      nodes: [
        node(epicId, "host.epic", "epic", epicWork, 1),
        node(featureId, "host.feature", "feature", featureWork, 2, epicId),
        node(storyId, "host.story", "story", storyWork, 3, featureId),
        node(taskId, "host.task", "task", taskWork, 4, storyId),
      ],
      hierarchyCompletenessState: "candidate-complete",
      unresolvedQuestions: [],
      limitations: ["Protocol transport does not establish Product Owner approval or implementation authority."],
      reviewState: "ready-for-human-review",
      prioritizationState: "not-established",
      backlogCommitmentState: "not-established",
      ownershipAuthorityState: "not-established",
      readyDoneState: "not-established",
      implementationReadinessState: "not-established",
      implementationAuthorityState: "not-granted",
    }

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "backlog-v1-rejected",
      protocolVersion: 1,
      method: "backlog.hierarchy.snapshot",
      params: { initiativeId: initiative.id },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "backlog-read-empty",
      protocolVersion: 2,
      method: "backlog.hierarchy.read",
      params: { initiativeId: initiative.id },
    })).resolves.toBeNull()

    const created = await host.dispatch({
      jsonrpc: "2.0",
      id: "backlog-create",
      protocolVersion: 2,
      method: "backlog.hierarchy.create",
      params: { actorId: "host-test", record: input },
    }) as { id: string; revision: number; membershipDigest: string }
    expect(created).toMatchObject({ revision: 1, membershipDigest: expect.stringMatching(/^sha256:/u) })

    const exactHierarchy = await host.dispatch({
      jsonrpc: "2.0",
      id: "backlog-read",
      protocolVersion: 2,
      method: "backlog.hierarchy.read",
      params: { initiativeId: initiative.id },
    }) as BacklogHierarchy
    expect(exactHierarchy).toMatchObject({ id: created.id, revision: 1 })

    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "backlog-assess",
      protocolVersion: 2,
      method: "backlog.hierarchy.assess",
      params: { initiativeId: initiative.id },
    })).resolves.toMatchObject({
      state: "complete-for-review",
      nodeCount: 4,
      requirementTraceCount: 2,
      authorityBoundary: expect.stringContaining("does-not-establish-priority"),
    })

    const snapshot = await host.dispatch({
      jsonrpc: "2.0",
      id: "backlog-snapshot",
      protocolVersion: 2,
      method: "backlog.hierarchy.snapshot",
      params: { initiativeId: initiative.id },
    }) as Record<string, unknown> & { snapshotDigest: string }
    const { snapshotDigest, ...snapshotBody } = snapshot
    expect(snapshotDigest).toBe(canonicalDigest(snapshotBody))
    expect(snapshot).toMatchObject({
      candidate: { id: created.id, nodeCount: 4, requirementTraceCount: 2 },
      privacyBoundary: expect.stringContaining("not-backlog-objectives"),
      authorityBoundary: expect.stringContaining("does-not-prioritize-commit-assign-admit-execute"),
    })
    expect(JSON.stringify(snapshot)).not.toContain(input.title)

    const mvpInput: MvpSliceDefinitionInput = {
      initiativeId: initiative.id,
      context: input.context,
      informationClassification: "internal",
      title: "Host MVP and vertical slice candidate",
      hierarchy: { recordId: exactHierarchy.id, revision: exactHierarchy.revision, digest: canonicalDigest(exactHierarchy) },
      scopeEntries: exactHierarchy.nodes.map((node) => ({
        nodeId: node.id,
        key: node.key,
        level: node.level,
        ordinal: node.ordinal,
        disposition: "mvp" as const,
        rationale: `Include ${node.level} candidate in the bounded MVP scope.`,
      })),
      slices: [{
        id: randomUUID(),
        key: "host.first.slice",
        ordinal: 1,
        storyNodeIds: [storyId],
        taskNodeIds: [taskId],
        dependencySliceIds: [],
        testabilityState: "candidate-testable",
      }],
      scopeCompletenessState: "candidate-complete",
      unresolvedQuestions: [],
      limitations: ["Protocol transport does not establish scope approval, readiness, assignment, execution, or implementation authority."],
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
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "mvp-v1-rejected",
      protocolVersion: 1,
      method: "planning.mvpSlices.snapshot",
      params: { initiativeId: initiative.id },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "mvp-read-empty",
      protocolVersion: 2,
      method: "planning.mvpSlices.read",
      params: { initiativeId: initiative.id },
    })).resolves.toBeNull()
    const mvpCreated = await host.dispatch({
      jsonrpc: "2.0",
      id: "mvp-create",
      protocolVersion: 2,
      method: "planning.mvpSlices.create",
      params: { actorId: "host-test", record: mvpInput },
    }) as { id: string; revision: number; membershipDigest: string }
    expect(mvpCreated).toMatchObject({ revision: 1, membershipDigest: expect.stringMatching(/^sha256:/u) })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "mvp-read",
      protocolVersion: 2,
      method: "planning.mvpSlices.read",
      params: { initiativeId: initiative.id },
    })).resolves.toMatchObject({ id: mvpCreated.id, revision: 1 })
    await expect(host.dispatch({
      jsonrpc: "2.0",
      id: "mvp-assess",
      protocolVersion: 2,
      method: "planning.mvpSlices.assess",
      params: { initiativeId: initiative.id },
    })).resolves.toMatchObject({
      state: "complete-for-review",
      scopeNodeCount: 4,
      sliceCount: 1,
      storyCount: 1,
      taskCount: 1,
      authorityBoundary: expect.stringContaining("does-not-establish-priority"),
    })
    const mvpSnapshot = await host.dispatch({
      jsonrpc: "2.0",
      id: "mvp-snapshot",
      protocolVersion: 2,
      method: "planning.mvpSlices.snapshot",
      params: { initiativeId: initiative.id },
    }) as Record<string, unknown> & { snapshotDigest: string }
    const { snapshotDigest: mvpSnapshotDigest, ...mvpSnapshotBody } = mvpSnapshot
    expect(mvpSnapshotDigest).toBe(canonicalDigest(mvpSnapshotBody))
    expect(mvpSnapshot).toMatchObject({
      candidate: { id: mvpCreated.id, scopeNodeCount: 4, sliceCount: 1, storyCount: 1, taskCount: 1 },
      privacyBoundary: expect.stringContaining("not-slice-titles-rationales"),
      authorityBoundary: expect.stringContaining("does-not-prioritize-commit-approve-scope"),
    })
    expect(JSON.stringify(mvpSnapshot)).not.toContain(mvpInput.title)
    const mvpRevised = await host.dispatch({
      jsonrpc: "2.0",
      id: "mvp-revise",
      protocolVersion: 2,
      method: "planning.mvpSlices.revise",
      params: {
        actorId: "host-test",
        recordId: mvpCreated.id,
        expectedRevision: mvpCreated.revision,
        record: { ...mvpInput, title: "Host reviewed MVP and vertical slice candidate" },
      },
    }) as { id: string; revision: number; predecessorDigest: string }
    expect(mvpRevised).toMatchObject({ id: mvpCreated.id, revision: 2, predecessorDigest: expect.stringMatching(/^sha256:/u) })

    const revised = await host.dispatch({
      jsonrpc: "2.0",
      id: "backlog-revise",
      protocolVersion: 2,
      method: "backlog.hierarchy.revise",
      params: {
        actorId: "host-test",
        recordId: created.id,
        expectedRevision: created.revision,
        record: { ...input, title: "Host reviewed candidate hierarchy" },
      },
    }) as { id: string; revision: number; predecessorDigest: string }
    expect(revised).toMatchObject({ id: created.id, revision: 2, predecessorDigest: expect.stringMatching(/^sha256:/u) })
  })
})
