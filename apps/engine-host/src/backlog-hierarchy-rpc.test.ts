import { randomUUID } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  boilerplateCompatibilityDimensions,
  type AcceptanceCriteriaInput,
  type BacklogHierarchy,
  type BacklogHierarchyInput,
  type MvpSliceDefinition,
  type MvpSliceDefinitionInput,
  type PrioritizationModelInput,
} from "@gaep/contracts"
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
    }) as MvpSliceDefinition
    expect(mvpRevised).toMatchObject({ id: mvpCreated.id, revision: 2, predecessorDigest: expect.stringMatching(/^sha256:/u) })

    const estimate = (kind: "value-hypothesis" | "risk-register" | "dependency-analysis" | "cost-estimate", score: number) => ({
      state: "candidate-estimate" as const,
      score,
      evidence: [{ kind, recordId: randomUUID(), revision: 1, digest: `sha256:${"1".repeat(64)}` as const }],
      uncertainty: [],
    })
    const prioritizationInput: PrioritizationModelInput = {
      initiativeId: initiative.id,
      context: mvpInput.context,
      informationClassification: "internal",
      title: "Host explainable prioritization candidate",
      mvpSliceDefinition: { recordId: mvpRevised.id, revision: mvpRevised.revision, digest: canonicalDigest(mvpRevised) },
      method: {
        key: "weighted.value-risk-dependency-cost",
        version: "1.0",
        calculation: "weighted-sum-v1",
        normalization: "zero-to-one-hundred",
        weights: { value: 40, riskReduction: 30, dependencyEnablement: 20, costSize: 10 },
        tieBreaker: "slice-ordinal-ascending",
      },
      subjects: mvpRevised.slices.map((slice) => ({
        sliceId: slice.id,
        sliceKey: slice.key,
        ordinal: slice.ordinal,
        value: estimate("value-hypothesis", 80),
        riskReduction: estimate("risk-register", 70),
        dependencyEnablement: estimate("dependency-analysis", 60),
        costSize: estimate("cost-estimate", 40),
      })),
      unresolvedQuestions: [],
      limitations: ["Host transport does not establish evidence validity, priority, commitment, approval, readiness, assignment, execution, or action authority."],
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
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "priority-v1-rejected", protocolVersion: 1,
      method: "planning.prioritization.snapshot", params: { initiativeId: initiative.id },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "priority-read-empty", protocolVersion: 2,
      method: "planning.prioritization.read", params: { initiativeId: initiative.id },
    })).resolves.toBeNull()
    const priorityCreated = await host.dispatch({
      jsonrpc: "2.0", id: "priority-create", protocolVersion: 2,
      method: "planning.prioritization.create", params: { actorId: "host-test", record: prioritizationInput },
    }) as { id: string; revision: number; rankingDigest: string }
    expect(priorityCreated).toMatchObject({ revision: 1, rankingDigest: expect.stringMatching(/^sha256:/u) })
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "priority-assess", protocolVersion: 2,
      method: "planning.prioritization.assess", params: { initiativeId: initiative.id },
    })).resolves.toMatchObject({
      state: "complete-for-review",
      subjectCount: 1,
      scoredSubjectCount: 1,
      evidenceReferenceCount: 4,
      authorityBoundary: expect.stringContaining("does-not-establish-evidence-validity-priority"),
    })
    const prioritySnapshot = await host.dispatch({
      jsonrpc: "2.0", id: "priority-snapshot", protocolVersion: 2,
      method: "planning.prioritization.snapshot", params: { initiativeId: initiative.id },
    }) as Record<string, unknown> & { snapshotDigest: string }
    const { snapshotDigest: prioritySnapshotDigest, ...prioritySnapshotBody } = prioritySnapshot
    expect(prioritySnapshotDigest).toBe(canonicalDigest(prioritySnapshotBody))
    expect(prioritySnapshot).toMatchObject({
      candidate: { id: priorityCreated.id, subjectCount: 1, scoredSubjectCount: 1, evidenceReferenceCount: 4 },
      privacyBoundary: expect.stringContaining("not-dimension-estimates-evidence-identities"),
      authorityBoundary: expect.stringContaining("does-not-establish-evidence-validity-priority"),
    })
    expect(JSON.stringify(prioritySnapshot)).not.toContain(prioritizationInput.title)
    expect(JSON.stringify(prioritySnapshot)).not.toContain(prioritizationInput.subjects[0]!.value.evidence[0]!.recordId)
    const priorityRevised = await host.dispatch({
      jsonrpc: "2.0", id: "priority-revise", protocolVersion: 2,
      method: "planning.prioritization.revise",
      params: {
        actorId: "host-test",
        recordId: priorityCreated.id,
        expectedRevision: priorityCreated.revision,
        record: { ...prioritizationInput, title: "Host reviewed explainable prioritization candidate" },
      },
    }) as { id: string; revision: number; predecessorDigest: string }
    expect(priorityRevised).toMatchObject({ id: priorityCreated.id, revision: 2, predecessorDigest: expect.stringMatching(/^sha256:/u) })

    const criteriaInput: AcceptanceCriteriaInput = {
      initiativeId: initiative.id,
      context: input.context,
      informationClassification: "internal",
      title: "Host structured Acceptance Criteria candidate",
      hierarchy: { recordId: exactHierarchy.id, revision: exactHierarchy.revision, digest: canonicalDigest(exactHierarchy) },
      mvpSliceDefinition: { recordId: mvpRevised.id, revision: mvpRevised.revision, digest: canonicalDigest(mvpRevised) },
      prioritizationModel: { recordId: priorityRevised.id, revision: priorityRevised.revision, digest: canonicalDigest(await host.engine.prioritizationModel.read(priorityRevised.id)) },
      verificationMethods: [{
        key: "automated-host-contract",
        kind: "automated-test",
        state: "candidate-defined",
        evidenceReferences: [{ kind: "test", recordId: randomUUID(), revision: 1, digest: `sha256:${"2".repeat(64)}` }],
      }],
      criteria: exactHierarchy.nodes.filter((node) => node.level === "story" || node.level === "task").map((node, index) => ({
        id: randomUUID(),
        key: `${node.key}.observable-result`,
        subjectNodeId: node.id,
        subjectKey: node.key,
        subjectLevel: node.level as "story" | "task",
        ordinal: index + 1,
        classification: "functional-positive",
        precondition: `Given exact ${node.level} inputs satisfy their preconditions`,
        stimulus: `When the ${node.level} behavior crosses the bounded host protocol`,
        expectedResult: `Then the ${node.level} returns one observable result without undeclared effects`,
        requirements: structuredClone(node.requirements),
        verificationMethodKeys: ["automated-host-contract"],
        testabilityState: "candidate-testable",
      })),
      criterionSetCompletenessState: "candidate-complete",
      requirementCoverageState: "candidate-complete",
      unresolvedQuestions: [],
      limitations: ["Host transport does not establish criterion validity, Requirement satisfaction, acceptance, readiness, execution, or action authority."],
      reviewState: "ready-for-human-review",
      criterionValidityState: "not-established",
      requirementSatisfactionState: "not-established",
      priorityDecisionState: "not-established",
      commitmentState: "not-established",
      approvalState: "not-established",
      readyDoneState: "not-established",
      implementationReadinessState: "not-established",
      assignmentExecutionState: "not-established",
      acceptanceDecisionState: "not-established",
      implementationAuthorityState: "not-granted",
    }
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "criteria-v1-rejected", protocolVersion: 1,
      method: "planning.acceptanceCriteria.snapshot", params: { initiativeId: initiative.id },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "criteria-read-empty", protocolVersion: 2,
      method: "planning.acceptanceCriteria.read", params: { initiativeId: initiative.id },
    })).resolves.toBeNull()
    const criteriaCreated = await host.dispatch({
      jsonrpc: "2.0", id: "criteria-create", protocolVersion: 2,
      method: "planning.acceptanceCriteria.create", params: { actorId: "host-test", record: criteriaInput },
    }) as { id: string; revision: number; criterionCatalogDigest: string }
    expect(criteriaCreated).toMatchObject({ revision: 1, criterionCatalogDigest: expect.stringMatching(/^sha256:/u) })
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "criteria-assess", protocolVersion: 2,
      method: "planning.acceptanceCriteria.assess", params: { initiativeId: initiative.id },
    })).resolves.toMatchObject({
      state: "complete-for-review",
      subjectCount: 2,
      criterionCount: 2,
      testableCriterionCount: 2,
      requirementTraceCount: 2,
      authorityBoundary: expect.stringContaining("does-not-establish-criterion-validity"),
    })
    const criteriaSnapshot = await host.dispatch({
      jsonrpc: "2.0", id: "criteria-snapshot", protocolVersion: 2,
      method: "planning.acceptanceCriteria.snapshot", params: { initiativeId: initiative.id },
    }) as Record<string, unknown> & { snapshotDigest: string }
    const { snapshotDigest: criteriaSnapshotDigest, ...criteriaSnapshotBody } = criteriaSnapshot
    expect(criteriaSnapshotDigest).toBe(canonicalDigest(criteriaSnapshotBody))
    expect(criteriaSnapshot).toMatchObject({
      candidate: { id: criteriaCreated.id, subjectCount: 2, criterionCount: 2, requirementTraceCount: 2 },
      privacyBoundary: expect.stringContaining("not-criterion-text-requirement-identities"),
      authorityBoundary: expect.stringContaining("does-not-establish-criterion-validity"),
    })
    expect(JSON.stringify(criteriaSnapshot)).not.toContain(criteriaInput.title)
    expect(JSON.stringify(criteriaSnapshot)).not.toContain(criteriaInput.criteria[0]!.expectedResult)
    const criteriaRevised = await host.dispatch({
      jsonrpc: "2.0", id: "criteria-revise", protocolVersion: 2,
      method: "planning.acceptanceCriteria.revise",
      params: {
        actorId: "host-test",
        recordId: criteriaCreated.id,
        expectedRevision: criteriaCreated.revision,
        record: { ...criteriaInput, title: "Host reviewed structured Acceptance Criteria candidate" },
      },
    }) as typeof criteriaCreated & { predecessorDigest: string }
    expect(criteriaRevised).toMatchObject({ id: criteriaCreated.id, revision: 2, predecessorDigest: expect.stringMatching(/^sha256:/u) })

    const readyInput = {
      initiativeId: initiative.id,
      context: input.context,
      informationClassification: "internal" as const,
      title: "Host Definition of Ready item evaluations",
      hierarchy: { recordId: created.id, revision: created.revision, digest: canonicalDigest(created) },
      mvpSliceDefinition: criteriaInput.mvpSliceDefinition,
      prioritizationModel: criteriaInput.prioritizationModel,
      acceptanceCriteria: { recordId: criteriaRevised.id, revision: criteriaRevised.revision, digest: canonicalDigest(criteriaRevised) },
      policyVersion: 1,
      policyEntries: [{
        key: "acceptance-criteria", kind: "acceptance-criteria" as const, title: "Acceptance Criteria candidate",
        rule: "The exact current Acceptance Criteria candidate must be available", notApplicableAllowed: false, evidenceRequired: true,
      }],
      itemEvaluations: exactHierarchy.nodes.filter((node) => node.level === "story" || node.level === "task").map((node, index) => ({
        id: randomUUID(), ordinal: index + 1, subjectNodeId: node.id, subjectKey: node.key,
        subjectLevel: node.level as "story" | "task", prerequisiteKey: "acceptance-criteria", applicability: "required" as const,
        assessmentState: "candidate-satisfied" as const,
        rationale: `The current candidate covers the exact ${node.level} for human review`,
        evidenceReferences: [{ kind: "acceptance-criteria" as const, recordId: criteriaRevised.id, revision: criteriaRevised.revision, digest: canonicalDigest(criteriaRevised) }],
        assessedBy: { kind: "human" as const, id: "host-reviewer" }, assessedAt: "2026-07-30T00:00:00.000Z",
      })),
      validUntil: "2099-07-30T00:00:00.000Z",
      unresolvedQuestions: [], limitations: ["Passing does not admit an item or grant implementation permission."],
      reviewState: "ready-for-human-review" as const,
      prerequisiteTruthState: "not-established" as const, criterionValidityState: "not-established" as const,
      requirementSatisfactionState: "not-established" as const, priorityDecisionState: "not-established" as const,
      commitmentState: "not-established" as const, approvalState: "not-established" as const,
      readyDoneState: "not-established" as const, exceptionWaiverAuthorityState: "not-established" as const,
      phaseEntryState: "not-established" as const, implementationReadinessState: "not-established" as const,
      assignmentExecutionState: "not-established" as const, acceptanceDecisionState: "not-established" as const,
      implementationAuthorityState: "not-granted" as const,
    }
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "ready-v1-rejected", protocolVersion: 1,
      method: "planning.definitionOfReady.snapshot", params: { initiativeId: initiative.id },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "ready-read-empty", protocolVersion: 2,
      method: "planning.definitionOfReady.read", params: { initiativeId: initiative.id },
    })).resolves.toBeNull()
    const readyCreated = await host.dispatch({
      jsonrpc: "2.0", id: "ready-create", protocolVersion: 2,
      method: "planning.definitionOfReady.create", params: { actorId: "host-test", record: readyInput },
    }) as { id: string; revision: number; receiptDigest: string }
    expect(readyCreated).toMatchObject({ revision: 1, receiptDigest: expect.stringMatching(/^sha256:/u) })
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "ready-assess", protocolVersion: 2,
      method: "planning.definitionOfReady.assess", params: { initiativeId: initiative.id },
    })).resolves.toMatchObject({
      result: "candidate-passed", subjectCount: 2, policyEntryCount: 1, expectedEvaluationCount: 2,
      evaluationCount: 2, candidateSatisfiedCount: 2,
      gateBoundary: expect.stringContaining("not-admission-readiness-assignment-execution-or-implementation-permission"),
    })
    const readySnapshot = await host.dispatch({
      jsonrpc: "2.0", id: "ready-snapshot", protocolVersion: 2,
      method: "planning.definitionOfReady.snapshot", params: { initiativeId: initiative.id },
    }) as Record<string, unknown> & { snapshotDigest: string }
    const { snapshotDigest: readySnapshotDigest, ...readySnapshotBody } = readySnapshot
    expect(readySnapshotDigest).toBe(canonicalDigest(readySnapshotBody))
    expect(readySnapshot).toMatchObject({
      candidate: { id: readyCreated.id, subjectCount: 2, policyEntryCount: 1, evaluationCount: 2 },
      privacyBoundary: expect.stringContaining("not-rules-rationales-evidence-identities-assessor-identities"),
      authorityBoundary: expect.stringContaining("does-not-establish-prerequisite-truth"),
    })
    expect(JSON.stringify(readySnapshot)).not.toContain(readyInput.title)
    expect(JSON.stringify(readySnapshot)).not.toContain(readyInput.itemEvaluations[0]!.rationale)
    const readyRevised = await host.dispatch({
      jsonrpc: "2.0", id: "ready-revise", protocolVersion: 2,
      method: "planning.definitionOfReady.revise",
      params: {
        actorId: "host-test", recordId: readyCreated.id, expectedRevision: readyCreated.revision,
        record: { ...readyInput, title: "Host reviewed Definition of Ready item evaluations" },
      },
    }) as typeof readyCreated & { predecessorDigest: string }
    expect(readyRevised).toMatchObject({ id: readyCreated.id, revision: 2, predecessorDigest: expect.stringMatching(/^sha256:/u) })

    const doneInput = {
      initiativeId: initiative.id,
      context: input.context,
      informationClassification: "internal" as const,
      title: "Host Definition of Done item evaluations",
      hierarchy: { recordId: created.id, revision: created.revision, digest: canonicalDigest(created) },
      mvpSliceDefinition: criteriaInput.mvpSliceDefinition,
      prioritizationModel: criteriaInput.prioritizationModel,
      acceptanceCriteria: { recordId: criteriaRevised.id, revision: criteriaRevised.revision, digest: canonicalDigest(criteriaRevised) },
      definitionOfReady: { recordId: readyRevised.id, revision: readyRevised.revision, digest: canonicalDigest(readyRevised) },
      policyVersion: 1,
      policyEntries: [{
        key: "test-evidence", kind: "test" as const, title: "Test evidence candidate",
        rule: "Exact candidate test evidence must be available", notApplicableAllowed: false, evidenceRequired: true,
      }],
      itemEvaluations: exactHierarchy.nodes.filter((node) => node.level === "story" || node.level === "task").map((node, index) => ({
        id: randomUUID(), ordinal: index + 1, subjectNodeId: node.id, subjectKey: node.key,
        subjectLevel: node.level as "story" | "task", prerequisiteKey: "test-evidence", applicability: "required" as const,
        assessmentState: "candidate-satisfied" as const,
        rationale: `The exact test evidence candidate covers the current ${node.level} for human review`,
        evidenceReferences: [{ kind: "test" as const, recordId: randomUUID(), revision: 1, digest: `sha256:${"8".repeat(64)}` }],
        assessedBy: { kind: "human" as const, id: "host-quality-reviewer" }, assessedAt: "2026-07-30T00:00:00.000Z",
      })),
      validUntil: "2099-07-30T00:00:00.000Z",
      unresolvedQuestions: [], limitations: ["Passing does not establish completion, acceptance, release, or deployment readiness."],
      reviewState: "ready-for-human-review" as const,
      evidenceTruthState: "not-established" as const, testResultState: "not-established" as const,
      qualityState: "not-established" as const, requirementSatisfactionState: "not-established" as const,
      acceptanceCriteriaSatisfactionState: "not-established" as const, approvalState: "not-established" as const,
      readyDoneState: "not-established" as const, exceptionWaiverAuthorityState: "not-established" as const,
      implementationCompletenessState: "not-established" as const, mergeReadinessState: "not-established" as const,
      releaseReadinessState: "not-established" as const, deploymentReadinessState: "not-established" as const,
      assignmentExecutionState: "not-established" as const, acceptanceDecisionState: "not-established" as const,
      actionAuthorityState: "not-granted" as const,
    }
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "done-v1-rejected", protocolVersion: 1,
      method: "planning.definitionOfDone.snapshot", params: { initiativeId: initiative.id },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "done-read-empty", protocolVersion: 2,
      method: "planning.definitionOfDone.read", params: { initiativeId: initiative.id },
    })).resolves.toBeNull()
    const doneCreated = await host.dispatch({
      jsonrpc: "2.0", id: "done-create", protocolVersion: 2,
      method: "planning.definitionOfDone.create", params: { actorId: "host-test", record: doneInput },
    }) as { id: string; revision: number; receiptDigest: string }
    expect(doneCreated).toMatchObject({ revision: 1, receiptDigest: expect.stringMatching(/^sha256:/u) })
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "done-assess", protocolVersion: 2,
      method: "planning.definitionOfDone.assess", params: { initiativeId: initiative.id },
    })).resolves.toMatchObject({
      result: "candidate-passed", subjectCount: 2, policyEntryCount: 1, expectedEvaluationCount: 2,
      evaluationCount: 2, candidateSatisfiedCount: 2,
      gateBoundary: expect.stringContaining("not-completion-acceptance-approval-merge-release-deployment-or-action-permission"),
    })
    const doneSnapshot = await host.dispatch({
      jsonrpc: "2.0", id: "done-snapshot", protocolVersion: 2,
      method: "planning.definitionOfDone.snapshot", params: { initiativeId: initiative.id },
    }) as Record<string, unknown> & { snapshotDigest: string }
    const { snapshotDigest: doneSnapshotDigest, ...doneSnapshotBody } = doneSnapshot
    expect(doneSnapshotDigest).toBe(canonicalDigest(doneSnapshotBody))
    expect(doneSnapshot).toMatchObject({
      candidate: { id: doneCreated.id, subjectCount: 2, policyEntryCount: 1, evaluationCount: 2 },
      privacyBoundary: expect.stringContaining("not-rules-rationales-evidence-identities-assessor-identities"),
      authorityBoundary: expect.stringContaining("does-not-establish-evidence-truth"),
    })
    expect(JSON.stringify(doneSnapshot)).not.toContain(doneInput.title)
    expect(JSON.stringify(doneSnapshot)).not.toContain(doneInput.itemEvaluations[0]!.rationale)
    const doneRevised = await host.dispatch({
      jsonrpc: "2.0", id: "done-revise", protocolVersion: 2,
      method: "planning.definitionOfDone.revise",
      params: {
        actorId: "host-test", recordId: doneCreated.id, expectedRevision: doneCreated.revision,
        record: { ...doneInput, title: "Host reviewed Definition of Done item evaluations" },
      },
    }) as typeof doneCreated & { predecessorDigest: string }
    expect(doneRevised).toMatchObject({ id: doneCreated.id, revision: 2, predecessorDigest: expect.stringMatching(/^sha256:/u) })

    const unitIds = [randomUUID(), randomUUID()]
    const subjects = exactHierarchy.nodes.filter((node) => node.level === "story" || node.level === "task")
    const implementationUnitInput = {
      initiativeId: initiative.id,
      context: input.context,
      informationClassification: "internal" as const,
      title: "Host implementation unit model candidate",
      hierarchy: { recordId: created.id, revision: created.revision, digest: canonicalDigest(created) },
      mvpSliceDefinition: criteriaInput.mvpSliceDefinition,
      acceptanceCriteria: { recordId: criteriaRevised.id, revision: criteriaRevised.revision, digest: canonicalDigest(criteriaRevised) },
      definitionOfReady: { recordId: readyRevised.id, revision: readyRevised.revision, digest: canonicalDigest(readyRevised) },
      definitionOfDone: { recordId: doneRevised.id, revision: doneRevised.revision, digest: canonicalDigest(doneRevised) },
      units: [
        {
          id: unitIds[0]!, ordinal: 1, key: "api-service", kind: "service" as const,
          title: "Host API service candidate", boundary: "Owns the candidate protocol API boundary",
          subjectNodeIds: [subjects[0]!.id], requirementReferences: structuredClone(subjects[0]!.requirements),
          repository: { repositoryKey: "gaep", modulePath: "apps/engine-host", placementState: "candidate-not-verified" as const, evidenceReferences: [] },
          ownerCandidate: { kind: "human" as const, id: "host-maintainer-candidate" }, dependencyUnitIds: [],
          blastRadius: {
            assessmentState: "candidate-assessed" as const, affectedUnitIds: [unitIds[1]!], affectedSurfaceKeys: ["host-protocol"],
            rationale: "Protocol changes may affect the candidate native-host projection surface",
            assessedBy: { kind: "human" as const, id: "host-architecture-reviewer" }, assessedAt: "2026-07-30T00:00:00.000Z",
          },
        },
        {
          id: unitIds[1]!, ordinal: 2, key: "native-host-projection", kind: "integration" as const,
          title: "Native host projection candidate", boundary: "Owns the candidate native-host inspection boundary",
          subjectNodeIds: [subjects[1]!.id], requirementReferences: structuredClone(subjects[1]!.requirements),
          repository: { repositoryKey: "gaep", modulePath: "apps/vscode", placementState: "candidate-not-verified" as const, evidenceReferences: [] },
          ownerCandidate: { kind: "human" as const, id: "native-host-maintainer-candidate" }, dependencyUnitIds: [unitIds[0]!],
          blastRadius: {
            assessmentState: "candidate-assessed" as const, affectedUnitIds: [], affectedSurfaceKeys: ["native-host-ui"],
            rationale: "Projection changes are assessed against the candidate native-host inspection surface",
            assessedBy: { kind: "human" as const, id: "host-architecture-reviewer" }, assessedAt: "2026-07-30T00:00:00.000Z",
          },
        },
      ],
      unresolvedQuestions: [], limitations: ["Repository, owner, dependency, and impact claims remain candidates for human review."],
      reviewState: "ready-for-human-review" as const,
      repositoryTruthState: "not-established" as const, ownershipAppointmentState: "not-established" as const,
      dependencyCompletenessState: "not-established" as const, impactCompletenessState: "not-established" as const,
      implementationReadinessState: "not-established" as const, implementationCompletenessState: "not-established" as const,
      assignmentExecutionState: "not-established" as const, approvalState: "not-established" as const,
      acceptanceDecisionState: "not-established" as const, mergeReadinessState: "not-established" as const,
      releaseReadinessState: "not-established" as const, deploymentReadinessState: "not-established" as const,
      actionAuthorityState: "not-granted" as const,
    }
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "units-v1-rejected", protocolVersion: 1,
      method: "planning.implementationUnits.snapshot", params: { initiativeId: initiative.id },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "units-read-empty", protocolVersion: 2,
      method: "planning.implementationUnits.read", params: { initiativeId: initiative.id },
    })).resolves.toBeNull()
    const unitsCreated = await host.dispatch({
      jsonrpc: "2.0", id: "units-create", protocolVersion: 2,
      method: "planning.implementationUnits.create", params: { actorId: "host-test", record: implementationUnitInput },
    }) as { id: string; revision: number; assessmentReceiptDigest: string }
    expect(unitsCreated).toMatchObject({ revision: 1, assessmentReceiptDigest: expect.stringMatching(/^sha256:/u) })
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "units-assess", protocolVersion: 2,
      method: "planning.implementationUnits.assess", params: { initiativeId: initiative.id },
    })).resolves.toMatchObject({
      state: "candidate-complete", unitCount: 2, subjectCount: 2, requirementReferenceCount: 2,
      repositoryCandidateCount: 2, ownerCandidateCount: 2, dependencyEdgeCount: 1,
      candidateAssessedBlastRadiusCount: 2,
    })
    const unitsSnapshot = await host.dispatch({
      jsonrpc: "2.0", id: "units-snapshot", protocolVersion: 2,
      method: "planning.implementationUnits.snapshot", params: { initiativeId: initiative.id },
    }) as Record<string, unknown> & { snapshotDigest: string }
    const { snapshotDigest: unitsSnapshotDigest, ...unitsSnapshotBody } = unitsSnapshot
    expect(unitsSnapshotDigest).toBe(canonicalDigest(unitsSnapshotBody))
    expect(unitsSnapshot).toMatchObject({
      candidate: { id: unitsCreated.id, unitCount: 2, subjectCount: 2, requirementReferenceCount: 2 },
      privacyBoundary: expect.stringContaining("not-unit-titles-boundaries-subject-or-requirement-identities"),
      authorityBoundary: expect.stringContaining("does-not-establish-repository-truth-ownership-appointment"),
    })
    expect(JSON.stringify(unitsSnapshot)).not.toContain(implementationUnitInput.title)
    expect(JSON.stringify(unitsSnapshot)).not.toContain(implementationUnitInput.units[0]!.repository.modulePath)
    const unitsRevised = await host.dispatch({
      jsonrpc: "2.0", id: "units-revise", protocolVersion: 2,
      method: "planning.implementationUnits.revise",
      params: {
        actorId: "host-test", recordId: unitsCreated.id, expectedRevision: unitsCreated.revision,
        record: { ...implementationUnitInput, title: "Host reviewed implementation unit model candidate" },
      },
    }) as typeof unitsCreated & { predecessorDigest: string }
    expect(unitsRevised).toMatchObject({ id: unitsCreated.id, revision: 2, predecessorDigest: expect.stringMatching(/^sha256:/u) })

    const dependencyMappingInput = {
      initiativeId: initiative.id,
      context: input.context,
      informationClassification: "internal" as const,
      title: "Host dependency mapping candidate",
      hierarchy: { recordId: created.id, revision: created.revision, digest: canonicalDigest(created) },
      mvpSliceDefinition: criteriaInput.mvpSliceDefinition,
      implementationUnitModel: {
        recordId: unitsRevised.id, revision: unitsRevised.revision, digest: canonicalDigest(unitsRevised),
      },
      nodes: unitIds.map((implementationUnitId, index) => ({
        implementationUnitId, ordinal: index + 1, candidateEffortPoints: index === 0 ? 8 : 5,
        estimateState: "candidate-not-validated" as const, evidenceReferences: [],
        assessedBy: { kind: "human" as const, id: "host-architecture-reviewer" },
        assessedAt: "2026-07-30T00:00:00.000Z",
      })),
      edges: [{
        id: randomUUID(), ordinal: 1, predecessorUnitId: unitIds[0]!, successorUnitId: unitIds[1]!,
        kind: "integration" as const, strength: "required" as const,
        evidenceState: "candidate-asserted" as const,
        rationale: "The candidate native host unit consumes the candidate engine host contract",
        evidenceReferences: [],
        assessedBy: { kind: "human" as const, id: "host-architecture-reviewer" },
        assessedAt: "2026-07-30T00:00:00.000Z",
      }],
      criticalPathPolicy: {
        algorithm: "longest-candidate-effort-path-v1" as const,
        tieBreak: "canonical-unit-ordinal-v1" as const,
      },
      unresolvedQuestions: [],
      limitations: ["Dependency and critical-path results remain candidates for accountable human review."],
      reviewState: "ready-for-human-review" as const,
      dependencyTruthState: "not-established" as const, dependencyCompletenessState: "not-established" as const,
      criticalPathAuthorityState: "not-established" as const, sequencingCommitmentState: "not-established" as const,
      ownershipAppointmentState: "not-established" as const, implementationReadinessState: "not-established" as const,
      implementationCompletenessState: "not-established" as const, assignmentExecutionState: "not-established" as const,
      approvalState: "not-established" as const, acceptanceDecisionState: "not-established" as const,
      mergeReadinessState: "not-established" as const, releaseReadinessState: "not-established" as const,
      deploymentReadinessState: "not-established" as const, actionAuthorityState: "not-granted" as const,
    }
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "dependency-v1-rejected", protocolVersion: 1,
      method: "planning.dependencyMapping.snapshot", params: { initiativeId: initiative.id },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "dependency-read-empty", protocolVersion: 2,
      method: "planning.dependencyMapping.read", params: { initiativeId: initiative.id },
    })).resolves.toBeNull()
    const dependencyCreated = await host.dispatch({
      jsonrpc: "2.0", id: "dependency-create", protocolVersion: 2,
      method: "planning.dependencyMapping.create", params: { actorId: "host-test", record: dependencyMappingInput },
    }) as { id: string; revision: number; graphDigest: string; criticalPathDigest: string }
    expect(dependencyCreated).toMatchObject({
      revision: 1, graphDigest: expect.stringMatching(/^sha256:/u), criticalPathDigest: expect.stringMatching(/^sha256:/u),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "dependency-assess", protocolVersion: 2,
      method: "planning.dependencyMapping.assess", params: { initiativeId: initiative.id },
    })).resolves.toMatchObject({
      state: "candidate-complete", nodeCount: 2, edgeCount: 1, requiredEdgeCount: 1,
      criticalPathUnitCount: 2, criticalPathCandidateEffortPoints: 13,
      missingNodeCount: 0, missingDeclaredEdgeCount: 0, extraEdgeCount: 0,
    })
    const dependencySnapshot = await host.dispatch({
      jsonrpc: "2.0", id: "dependency-snapshot", protocolVersion: 2,
      method: "planning.dependencyMapping.snapshot", params: { initiativeId: initiative.id },
    }) as Record<string, unknown> & { snapshotDigest: string }
    const { snapshotDigest: dependencySnapshotDigest, ...dependencySnapshotBody } = dependencySnapshot
    expect(dependencySnapshotDigest).toBe(canonicalDigest(dependencySnapshotBody))
    expect(dependencySnapshot).toMatchObject({
      candidate: { id: dependencyCreated.id, nodeCount: 2, edgeCount: 1, criticalPathUnitCount: 2 },
      privacyBoundary: expect.stringContaining("not-unit-node-edge-evidence-rationale-estimate"),
      authorityBoundary: expect.stringContaining("does-not-establish-dependency-truth-or-completeness"),
    })
    expect(JSON.stringify(dependencySnapshot)).not.toContain(dependencyMappingInput.title)
    expect(JSON.stringify(dependencySnapshot)).not.toContain(dependencyMappingInput.edges[0]!.rationale)
    const dependencyRevised = await host.dispatch({
      jsonrpc: "2.0", id: "dependency-revise", protocolVersion: 2,
      method: "planning.dependencyMapping.revise",
      params: {
        actorId: "host-test", recordId: dependencyCreated.id, expectedRevision: dependencyCreated.revision,
        record: { ...dependencyMappingInput, title: "Host reviewed dependency mapping candidate" },
      },
    }) as typeof dependencyCreated & { predecessorDigest: string }
    expect(dependencyRevised).toMatchObject({ id: dependencyCreated.id, revision: 2, predecessorDigest: expect.stringMatching(/^sha256:/u) })

    const architectureEvidence = {
      kind: "architecture" as const,
      sourceId: "host-system-solution-architecture-candidate",
      revision: 1,
      digest: canonicalDigest({ initiativeId: initiative.id, kind: "architecture-candidate" }),
      observationState: "candidate-asserted" as const,
    }
    const technologyProfileInput = {
      initiativeId: initiative.id,
      context: input.context,
      informationClassification: "internal" as const,
      title: "Host Technology Profile candidate",
      implementationUnitModel: {
        recordId: unitsRevised.id, revision: unitsRevised.revision, digest: canonicalDigest(unitsRevised),
      },
      dependencyMapping: {
        recordId: dependencyRevised.id, revision: dependencyRevised.revision, digest: canonicalDigest(dependencyRevised),
      },
      architectureEvidenceReferences: [architectureEvidence],
      profiles: unitIds.map((implementationUnitId, index) => ({
        id: randomUUID(), ordinal: index + 1, implementationUnitId,
        profileKind: index === 0 ? "service" as const : "client" as const,
        choices: [{
          id: randomUUID(), ordinal: 1, category: "runtime" as const, canonicalName: "Node.js",
          versionConstraint: "24.4.1", versionState: "exact-candidate" as const,
          selectionState: "candidate-selected" as const, registryStatus: "candidate-supported" as const,
          supportState: "candidate-supported" as const, lifecycleState: "active" as const,
          compatibilityState: "candidate-compatible" as const, licenseState: "candidate-allowed" as const,
          securityPolicyState: "candidate-conformant" as const,
          rationale: "The exact host fixture manifest observation identifies this candidate runtime version",
          evidenceReferences: [{
            kind: "manifest-observation" as const, sourceId: `unit-${index + 1}-manifest-observation`, revision: 1,
            digest: canonicalDigest({ implementationUnitId, runtime: "node-24.4.1" }),
            observationState: "observed-not-validated" as const,
          }],
          assessedBy: { kind: "human" as const, id: "host-technology-reviewer" },
          assessedAt: "2026-07-30T00:00:00.000Z",
        }],
        constraints: [{
          id: randomUUID(), ordinal: 1, kind: "platform" as const,
          requirement: "The candidate runtime must remain portable across the declared host platforms",
          disposition: "mandatory" as const, assessmentState: "candidate-satisfied" as const,
          evidenceReferences: [architectureEvidence],
          assessedBy: { kind: "human" as const, id: "host-technology-reviewer" },
          assessedAt: "2026-07-30T00:00:00.000Z",
        }],
        assuranceObligations: ["Verify the exact runtime candidate through governed package evidence"],
        observabilityObligations: ["Retain bounded runtime and package lifecycle evidence"],
      })),
      unresolvedQuestions: [],
      limitations: ["Observed facts and selected technologies remain candidates for accountable review"],
      reviewState: "ready-for-human-review" as const,
      technologyApprovalState: "not-established" as const, supportCommitmentState: "not-established" as const,
      compatibilityTruthState: "not-established" as const, compatibilityCompletenessState: "not-established" as const,
      licensingApprovalState: "not-established" as const, securityApprovalState: "not-established" as const,
      exceptionWaiverState: "not-established" as const, architectureBaselineDesignationState: "not-established" as const,
      implementationReadinessState: "not-established" as const, implementationCompletenessState: "not-established" as const,
      assignmentExecutionState: "not-established" as const, approvalState: "not-established" as const,
      acceptanceDecisionState: "not-established" as const, mergeReadinessState: "not-established" as const,
      releaseReadinessState: "not-established" as const, deploymentReadinessState: "not-established" as const,
      actionAuthorityState: "not-granted" as const,
    }
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "technology-v1-rejected", protocolVersion: 1,
      method: "planning.technologyProfile.snapshot", params: { initiativeId: initiative.id },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "technology-read-empty", protocolVersion: 2,
      method: "planning.technologyProfile.read", params: { initiativeId: initiative.id },
    })).resolves.toBeNull()
    const technologyCreated = await host.dispatch({
      jsonrpc: "2.0", id: "technology-create", protocolVersion: 2,
      method: "planning.technologyProfile.create", params: { actorId: "host-test", record: technologyProfileInput },
    }) as { id: string; revision: number; profileCatalogDigest: string; selectionCatalogDigest: string }
    expect(technologyCreated).toMatchObject({
      revision: 1, profileCatalogDigest: expect.stringMatching(/^sha256:/u),
      selectionCatalogDigest: expect.stringMatching(/^sha256:/u),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "technology-assess", protocolVersion: 2,
      method: "planning.technologyProfile.assess", params: { initiativeId: initiative.id },
    })).resolves.toMatchObject({
      state: "candidate-complete", unitProfileCount: 2, technologyChoiceCount: 2,
      exactVersionCandidateCount: 2, constraintCount: 2, missingProfileCount: 0,
      invalidProfileCount: 0, staleDependencyMappingCount: 0,
    })
    const technologySnapshot = await host.dispatch({
      jsonrpc: "2.0", id: "technology-snapshot", protocolVersion: 2,
      method: "planning.technologyProfile.snapshot", params: { initiativeId: initiative.id },
    }) as Record<string, unknown> & { snapshotDigest: string }
    const { snapshotDigest: technologySnapshotDigest, ...technologySnapshotBody } = technologySnapshot
    expect(technologySnapshotDigest).toBe(canonicalDigest(technologySnapshotBody))
    expect(technologySnapshot).toMatchObject({
      candidate: { id: technologyCreated.id, unitProfileCount: 2, technologyChoiceCount: 2, constraintCount: 2 },
      privacyBoundary: expect.stringContaining("not-technology-names-versions-constraints-evidence-rationale"),
      authorityBoundary: expect.stringContaining("does-not-establish-technology-approval-support-commitment"),
    })
    expect(JSON.stringify(technologySnapshot)).not.toContain(technologyProfileInput.title)
    expect(JSON.stringify(technologySnapshot)).not.toContain("Node.js")
    const technologyRevised = await host.dispatch({
      jsonrpc: "2.0", id: "technology-revise", protocolVersion: 2,
      method: "planning.technologyProfile.revise",
      params: {
        actorId: "host-test", recordId: technologyCreated.id, expectedRevision: technologyCreated.revision,
        record: { ...technologyProfileInput, title: "Host reviewed Technology Profile candidate" },
      },
    }) as { id: string; revision: number; predecessorDigest: string }
    expect(technologyRevised).toMatchObject({ id: technologyCreated.id, revision: 2, predecessorDigest: expect.stringMatching(/^sha256:/u) })

    const boilerplateRegistryInput = {
      initiativeId: initiative.id,
      context: input.context,
      informationClassification: "internal" as const,
      title: "Host Boilerplate Registry candidate",
      implementationUnitModel: {
        recordId: unitsRevised.id, revision: unitsRevised.revision, digest: canonicalDigest(unitsRevised),
      },
      technologyProfile: {
        recordId: technologyRevised.id, revision: technologyRevised.revision, digest: canonicalDigest(technologyRevised),
      },
      architectureEvidenceReferences: [architectureEvidence],
      entries: technologyProfileInput.profiles.map((profile, index) => ({
        id: randomUUID(), ordinal: index + 1,
        canonicalName: `Host candidate ${profile.profileKind} foundation ${index + 1}`,
        kind: profile.profileKind === "service" ? "service-template" as const : "client-template" as const,
        sourceKind: "local-repository" as const, sourceReference: `templates/${profile.profileKind}-${index + 1}`,
        versionCandidate: `host-candidate-commit-${index + 1}`, versionState: "exact-candidate" as const,
        applicabilityState: "candidate-preferred" as const, availabilityState: "candidate-available" as const,
        integrityState: "candidate-verified" as const, provenanceState: "candidate-traceable" as const,
        supportState: "candidate-supported" as const, lifecycleState: "active" as const,
        technologyCompatibilityState: "candidate-compatible" as const,
        architectureCompatibilityState: "candidate-compatible" as const,
        licenseState: "candidate-allowed" as const, securityPolicyState: "candidate-conformant" as const,
        exceptionState: "not-required-candidate" as const, applicableTechnologyProfileIds: [profile.id],
        applicableImplementationUnitIds: [profile.implementationUnitId],
        capabilities: ["Provides a bounded host candidate foundation"],
        knownLimitations: ["Registry evidence does not designate, approve, select, or bind this candidate"],
        rationale: "The exact local host fixture observation identifies an inspectable candidate without organizational authority",
        evidenceReferences: [{
          kind: "repository-observation" as const, sourceId: `host-foundation-${index + 1}`, revision: 1,
          digest: canonicalDigest({ profileId: profile.id, implementationUnitId: profile.implementationUnitId }),
          observationState: "observed-not-validated" as const,
        }],
        assessedBy: { kind: "human" as const, id: "host-boilerplate-reviewer" },
        assessedAt: "2026-07-30T00:00:00.000Z",
      })),
      unresolvedQuestions: [],
      limitations: ["Candidate entries require accountable organizational review"],
      reviewState: "ready-for-human-review" as const,
      organizationalDesignationState: "not-established" as const, endorsementApprovalState: "not-established" as const,
      supportCommitmentState: "not-established" as const, compatibilityTruthState: "not-established" as const,
      compatibilityCompletenessState: "not-established" as const, licensingApprovalState: "not-established" as const,
      securityApprovalState: "not-established" as const, exceptionWaiverState: "not-established" as const,
      selectionBindingState: "not-established" as const, architectureBaselineDesignationState: "not-established" as const,
      implementationReadinessState: "not-established" as const, implementationCompletenessState: "not-established" as const,
      assignmentExecutionState: "not-established" as const, acceptanceDecisionState: "not-established" as const,
      mergeReadinessState: "not-established" as const, releaseReadinessState: "not-established" as const,
      deploymentReadinessState: "not-established" as const, actionAuthorityState: "not-granted" as const,
    }
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "boilerplate-v1-rejected", protocolVersion: 1,
      method: "planning.boilerplateRegistry.snapshot", params: { initiativeId: initiative.id },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "boilerplate-read-empty", protocolVersion: 2,
      method: "planning.boilerplateRegistry.read", params: { initiativeId: initiative.id },
    })).resolves.toBeNull()
    const boilerplateCreated = await host.dispatch({
      jsonrpc: "2.0", id: "boilerplate-create", protocolVersion: 2,
      method: "planning.boilerplateRegistry.create", params: { actorId: "host-test", record: boilerplateRegistryInput },
    }) as typeof boilerplateRegistryInput & { id: string; revision: number; entryCatalogDigest: string; sourceCatalogDigest: string }
    expect(boilerplateCreated).toMatchObject({
      revision: 1, entryCatalogDigest: expect.stringMatching(/^sha256:/u), sourceCatalogDigest: expect.stringMatching(/^sha256:/u),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "boilerplate-assess", protocolVersion: 2,
      method: "planning.boilerplateRegistry.assess", params: { initiativeId: initiative.id },
    })).resolves.toMatchObject({
      state: "candidate-complete", entryCount: 2, exactVersionCandidateCount: 2,
      unavailableEntryCount: 0, integrityMismatchCount: 0, staleTechnologyProfileCount: 0,
    })
    const boilerplateSnapshot = await host.dispatch({
      jsonrpc: "2.0", id: "boilerplate-snapshot", protocolVersion: 2,
      method: "planning.boilerplateRegistry.snapshot", params: { initiativeId: initiative.id },
    }) as Record<string, unknown> & { snapshotDigest: string }
    const { snapshotDigest: boilerplateSnapshotDigest, ...boilerplateSnapshotBody } = boilerplateSnapshot
    expect(boilerplateSnapshotDigest).toBe(canonicalDigest(boilerplateSnapshotBody))
    expect(boilerplateSnapshot).toMatchObject({
      candidate: { id: boilerplateCreated.id, entryCount: 2, mandatoryCandidateCount: 0 },
      privacyBoundary: expect.stringContaining("not-boilerplate-names-locators-versions-capabilities"),
      authorityBoundary: expect.stringContaining("does-not-establish-organizational-designation-endorsement-approval"),
    })
    expect(JSON.stringify(boilerplateSnapshot)).not.toContain(boilerplateRegistryInput.title)
    expect(JSON.stringify(boilerplateSnapshot)).not.toContain(boilerplateRegistryInput.entries[0]!.canonicalName)
    expect(JSON.stringify(boilerplateSnapshot)).not.toContain(boilerplateRegistryInput.entries[0]!.sourceReference)
    const boilerplateRevised = await host.dispatch({
      jsonrpc: "2.0", id: "boilerplate-revise", protocolVersion: 2,
      method: "planning.boilerplateRegistry.revise",
      params: {
        actorId: "host-test", recordId: boilerplateCreated.id, expectedRevision: boilerplateCreated.revision,
        record: { ...boilerplateRegistryInput, title: "Host reviewed Boilerplate Registry candidate" },
      },
    }) as typeof boilerplateCreated & { predecessorDigest: string }
    expect(boilerplateRevised).toMatchObject({ id: boilerplateCreated.id, revision: 2, predecessorDigest: expect.stringMatching(/^sha256:/u) })

    const boilerplateSelectionBindingInput = {
      initiativeId: initiative.id,
      context: input.context,
      informationClassification: "internal" as const,
      title: "Host Boilerplate Selection and Binding candidate",
      implementationUnitModel: {
        recordId: unitsRevised.id, revision: unitsRevised.revision, digest: canonicalDigest(unitsRevised),
      },
      dependencyMapping: {
        recordId: dependencyRevised.id, revision: dependencyRevised.revision, digest: canonicalDigest(dependencyRevised),
      },
      technologyProfile: {
        recordId: technologyRevised.id, revision: technologyRevised.revision, digest: canonicalDigest(technologyRevised),
      },
      boilerplateRegistry: {
        recordId: boilerplateRevised.id, revision: boilerplateRevised.revision, digest: canonicalDigest(boilerplateRevised),
      },
      decisions: technologyProfileInput.profiles.map((profile, index) => {
        const registryEntry = boilerplateRegistryInput.entries.find((entry) =>
          entry.applicableTechnologyProfileIds.includes(profile.id) &&
          entry.applicableImplementationUnitIds.includes(profile.implementationUnitId))!
        return {
          id: randomUUID(), ordinal: index + 1, implementationUnitId: profile.implementationUnitId,
          technologyProfileId: profile.id, disposition: "candidate-selected" as const,
          boilerplateRegistryEntryId: registryEntry.id,
          boilerplateVersionCandidate: registryEntry.versionCandidate, bindingRole: "primary-foundation" as const,
          accountableDecisionRoleCandidate: "organizational-boilerplate-owner-candidate",
          rationale: "The exact current host registry entry is a bounded candidate for this unit and profile",
          conditions: ["Accountable approval and compatibility validation remain required"],
          alternativeRegistryEntryIds: [], deviationCandidates: ["No effective deviation is granted"],
          exceptionReferenceCandidates: [],
          evidenceReferences: [{
            kind: "boilerplate-registry" as const, sourceId: registryEntry.id,
            revision: boilerplateRevised.revision, digest: canonicalDigest(registryEntry),
            evidenceState: "observed-not-validated" as const,
          }],
          assessedBy: { kind: "human" as const, id: "host-binding-reviewer" },
          assessedAt: "2026-07-30T00:00:00.000Z",
          organizationalApprovalState: "not-established" as const,
          selectionDecisionEffectivenessState: "not-established" as const,
          bindingEffectivenessState: "not-established" as const,
          compatibilityValidationState: "not-established" as const,
        }
      }),
      unresolvedQuestions: [], limitations: ["Candidate decisions require accountable organizational review"],
      reviewState: "ready-for-human-review" as const,
      organizationalDesignationState: "not-established" as const,
      endorsementApprovalState: "not-established" as const, supportCommitmentState: "not-established" as const,
      selectionDecisionState: "not-established" as const, bindingEffectivenessState: "not-established" as const,
      compatibilityTruthState: "not-established" as const, compatibilityCompletenessState: "not-established" as const,
      compatibilityValidationState: "not-established" as const, licensingApprovalState: "not-established" as const,
      securityApprovalState: "not-established" as const, exceptionWaiverState: "not-established" as const,
      sourceRetrievalState: "not-established" as const, assetImportInstantiationState: "not-established" as const,
      architectureBaselineDesignationState: "not-established" as const,
      implementationReadinessState: "not-established" as const,
      implementationCompletenessState: "not-established" as const,
      assignmentExecutionState: "not-established" as const, acceptanceDecisionState: "not-established" as const,
      mergeReadinessState: "not-established" as const, releaseReadinessState: "not-established" as const,
      deploymentReadinessState: "not-established" as const, actionAuthorityState: "not-granted" as const,
    }
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "boilerplate-binding-v1-rejected", protocolVersion: 1,
      method: "planning.boilerplateSelectionBinding.snapshot", params: { initiativeId: initiative.id },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "boilerplate-binding-read-empty", protocolVersion: 2,
      method: "planning.boilerplateSelectionBinding.read", params: { initiativeId: initiative.id },
    })).resolves.toBeNull()
    const bindingCreated = await host.dispatch({
      jsonrpc: "2.0", id: "boilerplate-binding-create", protocolVersion: 2,
      method: "planning.boilerplateSelectionBinding.create",
      params: { actorId: "host-test", record: boilerplateSelectionBindingInput },
    }) as typeof boilerplateSelectionBindingInput & {
      id: string; revision: number; unitDecisionCatalogDigest: string; selectionReceiptDigest: string
    }
    expect(bindingCreated).toMatchObject({
      revision: 1, unitDecisionCatalogDigest: expect.stringMatching(/^sha256:/u),
      selectionReceiptDigest: expect.stringMatching(/^sha256:/u),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "boilerplate-binding-assess", protocolVersion: 2,
      method: "planning.boilerplateSelectionBinding.assess", params: { initiativeId: initiative.id },
    })).resolves.toMatchObject({
      state: "candidate-complete", decisionCount: 2, selectedCandidateCount: 2,
      missingUnitDecisionCount: 0, invalidSelectionCount: 0, staleBoilerplateRegistryCount: 0,
    })
    const bindingSnapshot = await host.dispatch({
      jsonrpc: "2.0", id: "boilerplate-binding-snapshot", protocolVersion: 2,
      method: "planning.boilerplateSelectionBinding.snapshot", params: { initiativeId: initiative.id },
    }) as Record<string, unknown> & { snapshotDigest: string }
    const { snapshotDigest: bindingSnapshotDigest, ...bindingSnapshotBody } = bindingSnapshot
    expect(bindingSnapshotDigest).toBe(canonicalDigest(bindingSnapshotBody))
    expect(bindingSnapshot).toMatchObject({
      candidate: { id: bindingCreated.id, decisionCount: 2, selectedCandidateCount: 2 },
      privacyBoundary: expect.stringContaining("not-boilerplate-names-locators-versions-unit-or-profile-identities"),
      authorityBoundary: expect.stringContaining("does-not-establish-organizational-designation-endorsement-approval"),
    })
    expect(JSON.stringify(bindingSnapshot)).not.toContain(boilerplateSelectionBindingInput.title)
    expect(JSON.stringify(bindingSnapshot)).not.toContain(boilerplateSelectionBindingInput.decisions[0]!.implementationUnitId)
    expect(JSON.stringify(bindingSnapshot)).not.toContain(boilerplateSelectionBindingInput.decisions[0]!.boilerplateRegistryEntryId)
    const bindingRevised = await host.dispatch({
      jsonrpc: "2.0", id: "boilerplate-binding-revise", protocolVersion: 2,
      method: "planning.boilerplateSelectionBinding.revise",
      params: {
        actorId: "host-test", recordId: bindingCreated.id, expectedRevision: bindingCreated.revision,
        record: { ...boilerplateSelectionBindingInput, title: "Host reviewed Boilerplate Selection and Binding candidate" },
      },
    }) as typeof bindingCreated & { predecessorDigest: string }
    expect(bindingRevised).toMatchObject({
      id: bindingCreated.id, revision: 2, predecessorDigest: expect.stringMatching(/^sha256:/u),
    })

    const boilerplateCompatibilityValidationInput = {
      initiativeId: initiative.id,
      context: input.context,
      informationClassification: "internal" as const,
      title: "Host Boilerplate Compatibility Validation candidate",
      implementationUnitModel: {
        recordId: unitsRevised.id, revision: unitsRevised.revision, digest: canonicalDigest(unitsRevised),
      },
      dependencyMapping: {
        recordId: dependencyRevised.id, revision: dependencyRevised.revision, digest: canonicalDigest(dependencyRevised),
      },
      technologyProfile: {
        recordId: technologyRevised.id, revision: technologyRevised.revision, digest: canonicalDigest(technologyRevised),
      },
      boilerplateRegistry: {
        recordId: boilerplateRevised.id, revision: boilerplateRevised.revision, digest: canonicalDigest(boilerplateRevised),
      },
      boilerplateSelectionBinding: {
        recordId: bindingRevised.id, revision: bindingRevised.revision, digest: canonicalDigest(bindingRevised),
      },
      subjects: boilerplateSelectionBindingInput.decisions.map((decision, subjectIndex) => ({
        id: randomUUID(), ordinal: subjectIndex + 1, bindingDecisionId: decision.id,
        implementationUnitId: decision.implementationUnitId,
        technologyProfileId: decision.technologyProfileId,
        boilerplateRegistryEntryId: decision.boilerplateRegistryEntryId!,
        boilerplateVersionCandidate: decision.boilerplateVersionCandidate!,
        outcome: "candidate-compatible" as const,
        dimensionAssessments: boilerplateCompatibilityDimensions.map((dimension, dimensionIndex) => ({
          id: randomUUID(), ordinal: dimensionIndex + 1, dimension,
          outcome: "candidate-compatible" as const,
          claim: `The host ${dimension} dimension is an evidence-backed compatibility candidate only`,
          evidenceReferences: [{
            kind: "evidence" as const, sourceId: `${decision.id}-${dimension}-host-evidence`, revision: 1,
            digest: canonicalDigest({ decisionId: decision.id, dimension, subjectIndex, context: input.context }),
            evidenceState: "observed-not-validated" as const,
          }],
          exceptionReferenceCandidates: [],
          assessedBy: { kind: "human" as const, id: "host-compatibility-reviewer" },
          assessedAt: "2026-07-30T00:00:00.000Z",
          compatibilityTruthState: "not-established" as const,
          approvalState: "not-established" as const,
          exceptionWaiverState: "not-established" as const,
        })),
      })),
      unresolvedQuestions: [],
      limitations: ["Candidate validation does not establish actual asset behavior or compatibility truth"],
      reviewState: "ready-for-human-review" as const,
      compatibilityTruthState: "not-established" as const,
      compatibilityCompletenessState: "not-established" as const,
      validationDecisionState: "not-established" as const,
      actualAssetBehaviorState: "not-established" as const,
      testExecutionState: "not-established" as const,
      designValidityState: "not-established" as const,
      securityPrivacyApprovalState: "not-established" as const,
      licensingApprovalState: "not-established" as const,
      exceptionWaiverState: "not-established" as const,
      selectionBindingEffectivenessState: "not-established" as const,
      sourceRetrievalState: "not-established" as const,
      assetImportInstantiationState: "not-established" as const,
      architectureBaselineDesignationState: "not-established" as const,
      implementationReadinessState: "not-established" as const,
      implementationCompletenessState: "not-established" as const,
      assignmentExecutionState: "not-established" as const,
      acceptanceDecisionState: "not-established" as const,
      mergeReadinessState: "not-established" as const,
      releaseReadinessState: "not-established" as const,
      deploymentReadinessState: "not-established" as const,
      actionAuthorityState: "not-granted" as const,
    }
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "boilerplate-compatibility-v1-rejected", protocolVersion: 1,
      method: "planning.boilerplateCompatibilityValidation.snapshot", params: { initiativeId: initiative.id },
    })).rejects.toMatchObject({ kind: "PROTOCOL_UPGRADE_REQUIRED" })
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "boilerplate-compatibility-read-empty", protocolVersion: 2,
      method: "planning.boilerplateCompatibilityValidation.read", params: { initiativeId: initiative.id },
    })).resolves.toBeNull()
    const compatibilityCreated = await host.dispatch({
      jsonrpc: "2.0", id: "boilerplate-compatibility-create", protocolVersion: 2,
      method: "planning.boilerplateCompatibilityValidation.create",
      params: { actorId: "host-test", record: boilerplateCompatibilityValidationInput },
    }) as typeof boilerplateCompatibilityValidationInput & {
      id: string; revision: number; validationSubjectCatalogDigest: string; dimensionCatalogDigest: string
    }
    expect(compatibilityCreated).toMatchObject({
      revision: 1, validationSubjectCatalogDigest: expect.stringMatching(/^sha256:/u),
      dimensionCatalogDigest: expect.stringMatching(/^sha256:/u),
    })
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "boilerplate-compatibility-assess", protocolVersion: 2,
      method: "planning.boilerplateCompatibilityValidation.assess", params: { initiativeId: initiative.id },
    })).resolves.toMatchObject({
      state: "candidate-complete", selectedBindingCount: 2, subjectCount: 2,
      compatibleCandidateCount: 2, dimensionAssessmentCount: 28,
      missingSubjectCount: 0, staleSelectionBindingCount: 0,
    })
    const compatibilitySnapshot = await host.dispatch({
      jsonrpc: "2.0", id: "boilerplate-compatibility-snapshot", protocolVersion: 2,
      method: "planning.boilerplateCompatibilityValidation.snapshot", params: { initiativeId: initiative.id },
    }) as Record<string, unknown> & { snapshotDigest: string }
    const { snapshotDigest: compatibilitySnapshotDigest, ...compatibilitySnapshotBody } = compatibilitySnapshot
    expect(compatibilitySnapshotDigest).toBe(canonicalDigest(compatibilitySnapshotBody))
    expect(compatibilitySnapshot).toMatchObject({
      candidate: { id: compatibilityCreated.id, subjectCount: 2, compatibleCandidateCount: 2 },
      privacyBoundary: expect.stringContaining("not-boilerplate-names-locators-versions-unit-profile-entry-or-binding-identities"),
      authorityBoundary: expect.stringContaining("does-not-establish-compatibility-truth-or-completeness"),
    })
    expect(JSON.stringify(compatibilitySnapshot)).not.toContain(boilerplateCompatibilityValidationInput.title)
    expect(JSON.stringify(compatibilitySnapshot)).not.toContain(boilerplateCompatibilityValidationInput.subjects[0]!.bindingDecisionId)
    expect(JSON.stringify(compatibilitySnapshot)).not.toContain(boilerplateCompatibilityValidationInput.subjects[0]!.dimensionAssessments[0]!.claim)
    await expect(host.dispatch({
      jsonrpc: "2.0", id: "boilerplate-compatibility-revise", protocolVersion: 2,
      method: "planning.boilerplateCompatibilityValidation.revise",
      params: {
        actorId: "host-test", recordId: compatibilityCreated.id,
        expectedRevision: compatibilityCreated.revision,
        record: {
          ...boilerplateCompatibilityValidationInput,
          title: "Host reviewed Boilerplate Compatibility Validation candidate",
        },
      },
    })).resolves.toMatchObject({
      id: compatibilityCreated.id, revision: 2, predecessorDigest: expect.stringMatching(/^sha256:/u),
    })

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
