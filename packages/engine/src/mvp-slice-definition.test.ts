import { randomUUID } from "node:crypto"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { AcceptanceCriteriaInput, BacklogHierarchyInput, BoilerplateRegistryInput, DefinitionOfDoneInput, DefinitionOfReadyInput, DependencyMappingInput, ImplementationUnitModelInput, MvpSliceDefinitionInput, PrioritizationModelInput, TechnologyProfileInput } from "@gaep/contracts"
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

  function acceptanceCriteriaInput(
    initiativeId: string,
    context: MvpSliceDefinitionInput["context"],
    hierarchy: Awaited<ReturnType<typeof engine.backlogHierarchy.create>>,
    mvp: Awaited<ReturnType<typeof engine.mvpSliceDefinition.create>>,
    priority: Awaited<ReturnType<typeof engine.prioritizationModel.create>>,
  ): AcceptanceCriteriaInput {
    const subjects = hierarchy.nodes.filter((node) => node.level === "story" || node.level === "task")
    return {
      initiativeId,
      context,
      informationClassification: "internal",
      title: "Atlas structured Acceptance Criteria candidate",
      hierarchy: { recordId: hierarchy.id, revision: hierarchy.revision, digest: canonicalDigest(hierarchy) },
      mvpSliceDefinition: { recordId: mvp.id, revision: mvp.revision, digest: canonicalDigest(mvp) },
      prioritizationModel: { recordId: priority.id, revision: priority.revision, digest: canonicalDigest(priority) },
      verificationMethods: [{
        key: "automated-contract-test",
        kind: "automated-test",
        state: "candidate-defined",
        evidenceReferences: [{ kind: "test", recordId: randomUUID(), revision: 1, digest: `sha256:${"2".repeat(64)}` }],
      }],
      criteria: subjects.map((node, index) => ({
        id: randomUUID(),
        key: `${node.key}.observable-result`,
        subjectNodeId: node.id,
        subjectKey: node.key,
        subjectLevel: node.level as "story" | "task",
        ordinal: index + 1,
        classification: "functional-positive",
        precondition: `Given exact ${node.level} inputs satisfy their declared preconditions`,
        stimulus: `When the ${node.level} behavior is exercised through its bounded interface`,
        expectedResult: `Then the ${node.level} produces one observable result without undeclared effects`,
        requirements: structuredClone(node.requirements),
        verificationMethodKeys: ["automated-contract-test"],
        testabilityState: "candidate-testable",
      })),
      criterionSetCompletenessState: "candidate-complete",
      requirementCoverageState: "candidate-complete",
      unresolvedQuestions: [],
      limitations: ["Criterion validity, Requirement satisfaction, acceptance, readiness, execution, and authority remain unestablished."],
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
  }

  function definitionOfReadyInput(
    initiativeId: string,
    context: MvpSliceDefinitionInput["context"],
    hierarchy: Awaited<ReturnType<typeof engine.backlogHierarchy.create>>,
    mvp: Awaited<ReturnType<typeof engine.mvpSliceDefinition.create>>,
    priority: Awaited<ReturnType<typeof engine.prioritizationModel.create>>,
    criteria: Awaited<ReturnType<typeof engine.acceptanceCriteria.create>>,
  ): DefinitionOfReadyInput {
    const subjects = hierarchy.nodes.filter((node) => node.level === "story" || node.level === "task")
    return {
      initiativeId,
      context,
      informationClassification: "internal",
      title: "Atlas item Definition of Ready candidate",
      hierarchy: { recordId: hierarchy.id, revision: hierarchy.revision, digest: canonicalDigest(hierarchy) },
      mvpSliceDefinition: { recordId: mvp.id, revision: mvp.revision, digest: canonicalDigest(mvp) },
      prioritizationModel: { recordId: priority.id, revision: priority.revision, digest: canonicalDigest(priority) },
      acceptanceCriteria: { recordId: criteria.id, revision: criteria.revision, digest: canonicalDigest(criteria) },
      policyVersion: 1,
      policyEntries: [{
        key: "acceptance-criteria",
        kind: "acceptance-criteria",
        title: "Acceptance Criteria candidate",
        rule: "An exact current Acceptance Criteria candidate must be available for each item",
        notApplicableAllowed: false,
        evidenceRequired: true,
      }],
      itemEvaluations: subjects.map((subject, index) => ({
        id: randomUUID(),
        ordinal: index + 1,
        subjectNodeId: subject.id,
        subjectKey: subject.key,
        subjectLevel: subject.level as "story" | "task",
        prerequisiteKey: "acceptance-criteria",
        applicability: "required",
        assessmentState: "candidate-satisfied",
        rationale: `The exact current Acceptance Criteria candidate covers this ${subject.level} for human review`,
        evidenceReferences: [{
          kind: "acceptance-criteria",
          recordId: criteria.id,
          revision: criteria.revision,
          digest: canonicalDigest(criteria),
        }],
        assessedBy: { kind: "human", id: actorId },
        assessedAt: "2026-07-30T00:00:00.000Z",
      })),
      validUntil: "2099-07-30T00:00:00.000Z",
      unresolvedQuestions: [],
      limitations: ["A passing candidate does not admit work or grant implementation permission."],
      reviewState: "ready-for-human-review",
      prerequisiteTruthState: "not-established",
      criterionValidityState: "not-established",
      requirementSatisfactionState: "not-established",
      priorityDecisionState: "not-established",
      commitmentState: "not-established",
      approvalState: "not-established",
      readyDoneState: "not-established",
      exceptionWaiverAuthorityState: "not-established",
      phaseEntryState: "not-established",
      implementationReadinessState: "not-established",
      assignmentExecutionState: "not-established",
      acceptanceDecisionState: "not-established",
      implementationAuthorityState: "not-granted",
    }
  }

  function definitionOfDoneInput(
    initiativeId: string,
    context: MvpSliceDefinitionInput["context"],
    hierarchy: Awaited<ReturnType<typeof engine.backlogHierarchy.create>>,
    mvp: Awaited<ReturnType<typeof engine.mvpSliceDefinition.create>>,
    priority: Awaited<ReturnType<typeof engine.prioritizationModel.create>>,
    criteria: Awaited<ReturnType<typeof engine.acceptanceCriteria.create>>,
    ready: Awaited<ReturnType<typeof engine.definitionOfReady.create>>,
  ): DefinitionOfDoneInput {
    const subjects = hierarchy.nodes.filter((node) => node.level === "story" || node.level === "task")
    const testEvidenceId = randomUUID()
    return {
      initiativeId,
      context,
      informationClassification: "internal",
      title: "Atlas item Definition of Done candidate",
      hierarchy: { recordId: hierarchy.id, revision: hierarchy.revision, digest: canonicalDigest(hierarchy) },
      mvpSliceDefinition: { recordId: mvp.id, revision: mvp.revision, digest: canonicalDigest(mvp) },
      prioritizationModel: { recordId: priority.id, revision: priority.revision, digest: canonicalDigest(priority) },
      acceptanceCriteria: { recordId: criteria.id, revision: criteria.revision, digest: canonicalDigest(criteria) },
      definitionOfReady: { recordId: ready.id, revision: ready.revision, digest: canonicalDigest(ready) },
      policyVersion: 1,
      policyEntries: [{
        key: "test-evidence",
        kind: "test",
        title: "Test evidence candidate",
        rule: "Exact candidate test evidence must be available for each item",
        notApplicableAllowed: false,
        evidenceRequired: true,
      }],
      itemEvaluations: subjects.map((subject, index) => ({
        id: randomUUID(),
        ordinal: index + 1,
        subjectNodeId: subject.id,
        subjectKey: subject.key,
        subjectLevel: subject.level as "story" | "task",
        prerequisiteKey: "test-evidence",
        applicability: "required",
        assessmentState: "candidate-satisfied",
        rationale: `The exact test evidence candidate covers this ${subject.level} for human review`,
        evidenceReferences: [{
          kind: "test",
          recordId: testEvidenceId,
          revision: 1,
          digest: `sha256:${"8".repeat(64)}`,
        }],
        assessedBy: { kind: "human", id: actorId },
        assessedAt: "2026-07-30T00:00:00.000Z",
      })),
      validUntil: "2099-07-30T00:00:00.000Z",
      unresolvedQuestions: [],
      limitations: ["A passing candidate does not establish completion, acceptance, release, or deployment readiness."],
      reviewState: "ready-for-human-review",
      evidenceTruthState: "not-established",
      testResultState: "not-established",
      qualityState: "not-established",
      requirementSatisfactionState: "not-established",
      acceptanceCriteriaSatisfactionState: "not-established",
      approvalState: "not-established",
      readyDoneState: "not-established",
      exceptionWaiverAuthorityState: "not-established",
      implementationCompletenessState: "not-established",
      mergeReadinessState: "not-established",
      releaseReadinessState: "not-established",
      deploymentReadinessState: "not-established",
      assignmentExecutionState: "not-established",
      acceptanceDecisionState: "not-established",
      actionAuthorityState: "not-granted",
    }
  }

  function implementationUnitModelInput(
    initiativeId: string,
    context: MvpSliceDefinitionInput["context"],
    hierarchy: Awaited<ReturnType<typeof engine.backlogHierarchy.create>>,
    mvp: Awaited<ReturnType<typeof engine.mvpSliceDefinition.create>>,
    criteria: Awaited<ReturnType<typeof engine.acceptanceCriteria.create>>,
    ready: Awaited<ReturnType<typeof engine.definitionOfReady.create>>,
    done: Awaited<ReturnType<typeof engine.definitionOfDone.create>>,
  ): ImplementationUnitModelInput {
    const subjects = hierarchy.nodes.filter((node) => node.level === "story" || node.level === "task")
    const apiUnitId = randomUUID()
    const webUnitId = randomUUID()
    return {
      initiativeId,
      context,
      informationClassification: "internal",
      title: "Atlas implementation unit model candidate",
      hierarchy: { recordId: hierarchy.id, revision: hierarchy.revision, digest: canonicalDigest(hierarchy) },
      mvpSliceDefinition: { recordId: mvp.id, revision: mvp.revision, digest: canonicalDigest(mvp) },
      acceptanceCriteria: { recordId: criteria.id, revision: criteria.revision, digest: canonicalDigest(criteria) },
      definitionOfReady: { recordId: ready.id, revision: ready.revision, digest: canonicalDigest(ready) },
      definitionOfDone: { recordId: done.id, revision: done.revision, digest: canonicalDigest(done) },
      units: [
        {
          id: apiUnitId, ordinal: 1, key: "api-service", kind: "service",
          title: "Atlas API service candidate", boundary: "Owns the candidate governed API interaction boundary",
          subjectNodeIds: [subjects[0]!.id], requirementReferences: structuredClone(subjects[0]!.requirements),
          repository: {
            repositoryKey: "gaep", modulePath: "apps/api", placementState: "candidate-not-verified",
            evidenceReferences: [],
          },
          ownerCandidate: { kind: "human", id: "api-maintainer-candidate" },
          dependencyUnitIds: [],
          blastRadius: {
            assessmentState: "candidate-assessed", affectedUnitIds: [webUnitId], affectedSurfaceKeys: ["api"],
            rationale: "API behavior may affect the candidate web application integration surface",
            assessedBy: { kind: "human", id: "architecture-reviewer" }, assessedAt: "2026-07-30T00:00:00.000Z",
          },
        },
        {
          id: webUnitId, ordinal: 2, key: "web-application", kind: "application",
          title: "Atlas web application candidate", boundary: "Owns the candidate governed browser presentation boundary",
          subjectNodeIds: [subjects[1]!.id], requirementReferences: structuredClone(subjects[1]!.requirements),
          repository: {
            repositoryKey: "gaep", modulePath: "apps/web", placementState: "candidate-not-verified",
            evidenceReferences: [],
          },
          ownerCandidate: { kind: "human", id: "web-maintainer-candidate" },
          dependencyUnitIds: [apiUnitId],
          blastRadius: {
            assessmentState: "candidate-assessed", affectedUnitIds: [], affectedSurfaceKeys: ["browser-ui"],
            rationale: "Presentation changes are assessed against the candidate browser interaction surface",
            assessedBy: { kind: "human", id: "architecture-reviewer" }, assessedAt: "2026-07-30T00:00:00.000Z",
          },
        },
      ],
      unresolvedQuestions: [],
      limitations: ["Repository, owner, dependency, and impact claims remain candidates for human review."],
      reviewState: "ready-for-human-review",
      repositoryTruthState: "not-established",
      ownershipAppointmentState: "not-established",
      dependencyCompletenessState: "not-established",
      impactCompletenessState: "not-established",
      implementationReadinessState: "not-established",
      implementationCompletenessState: "not-established",
      assignmentExecutionState: "not-established",
      approvalState: "not-established",
      acceptanceDecisionState: "not-established",
      mergeReadinessState: "not-established",
      releaseReadinessState: "not-established",
      deploymentReadinessState: "not-established",
      actionAuthorityState: "not-granted",
    }
  }

  function dependencyMappingInput(
    initiativeId: string,
    context: MvpSliceDefinitionInput["context"],
    hierarchy: Awaited<ReturnType<typeof engine.backlogHierarchy.create>>,
    mvp: Awaited<ReturnType<typeof engine.mvpSliceDefinition.create>>,
    units: Awaited<ReturnType<typeof engine.implementationUnitModel.create>>,
  ): DependencyMappingInput {
    const edges = units.units.flatMap((unit) => unit.dependencyUnitIds.map((dependencyId) => ({
      id: randomUUID(),
      ordinal: 0,
      predecessorUnitId: dependencyId,
      successorUnitId: unit.id,
      kind: "integration" as const,
      strength: "required" as const,
      evidenceState: "candidate-asserted" as const,
      rationale: "The successor unit consumes the predecessor unit candidate contract",
      evidenceReferences: [{
        kind: "implementation-unit" as const,
        recordId: units.id,
        revision: units.revision,
        digest: canonicalDigest(units),
      }],
      assessedBy: { kind: "human" as const, id: "architecture-reviewer" },
      assessedAt: "2026-07-30T00:00:00.000Z",
    }))).map((edge, index) => ({ ...edge, ordinal: index + 1 }))
    return {
      initiativeId,
      context,
      informationClassification: "internal",
      title: "Atlas dependency mapping candidate",
      hierarchy: { recordId: hierarchy.id, revision: hierarchy.revision, digest: canonicalDigest(hierarchy) },
      mvpSliceDefinition: { recordId: mvp.id, revision: mvp.revision, digest: canonicalDigest(mvp) },
      implementationUnitModel: { recordId: units.id, revision: units.revision, digest: canonicalDigest(units) },
      nodes: units.units.map((unit, index) => ({
        implementationUnitId: unit.id,
        ordinal: index + 1,
        candidateEffortPoints: index === 0 ? 8 : 5,
        estimateState: "candidate-not-validated",
        evidenceReferences: [],
        assessedBy: { kind: "human", id: "architecture-reviewer" },
        assessedAt: "2026-07-30T00:00:00.000Z",
      })),
      edges,
      criticalPathPolicy: {
        algorithm: "longest-candidate-effort-path-v1",
        tieBreak: "canonical-unit-ordinal-v1",
      },
      unresolvedQuestions: [],
      limitations: ["Dependency and critical-path results remain candidates for accountable human review."],
      reviewState: "ready-for-human-review",
      dependencyTruthState: "not-established",
      dependencyCompletenessState: "not-established",
      criticalPathAuthorityState: "not-established",
      sequencingCommitmentState: "not-established",
      ownershipAppointmentState: "not-established",
      implementationReadinessState: "not-established",
      implementationCompletenessState: "not-established",
      assignmentExecutionState: "not-established",
      approvalState: "not-established",
      acceptanceDecisionState: "not-established",
      mergeReadinessState: "not-established",
      releaseReadinessState: "not-established",
      deploymentReadinessState: "not-established",
      actionAuthorityState: "not-granted",
    }
  }

  function technologyProfileInput(
    initiativeId: string,
    context: MvpSliceDefinitionInput["context"],
    units: Awaited<ReturnType<typeof engine.implementationUnitModel.create>>,
    dependencyMapping: Awaited<ReturnType<typeof engine.dependencyMapping.create>>,
  ): TechnologyProfileInput {
    const architectureEvidence = {
      kind: "architecture" as const,
      sourceId: "atlas-system-solution-architecture-candidate",
      revision: 1,
      digest: canonicalDigest({ initiativeId, context, kind: "architecture-candidate" }),
      observationState: "candidate-asserted" as const,
    }
    return {
      initiativeId,
      context,
      informationClassification: "internal",
      title: "Atlas implementation-unit technology profiles",
      implementationUnitModel: { recordId: units.id, revision: units.revision, digest: canonicalDigest(units) },
      dependencyMapping: {
        recordId: dependencyMapping.id, revision: dependencyMapping.revision, digest: canonicalDigest(dependencyMapping),
      },
      architectureEvidenceReferences: [architectureEvidence],
      profiles: units.units.map((unit, index) => {
        const observation = {
          kind: "manifest-observation" as const,
          sourceId: `${unit.key}-package-manifest-observation`,
          revision: 1,
          digest: canonicalDigest({ repository: unit.repository.repositoryKey, module: unit.repository.modulePath }),
          observationState: "observed-not-validated" as const,
        }
        return {
          id: randomUUID(),
          ordinal: index + 1,
          implementationUnitId: unit.id,
          profileKind: unit.kind === "service" ? "service" as const : "client" as const,
          choices: [{
            id: randomUUID(),
            ordinal: 1,
            category: "runtime" as const,
            canonicalName: "Node.js",
            versionConstraint: "24.4.1",
            versionState: "exact-candidate" as const,
            selectionState: "candidate-selected" as const,
            registryStatus: "candidate-supported" as const,
            supportState: "candidate-supported" as const,
            lifecycleState: "active" as const,
            compatibilityState: "candidate-compatible" as const,
            licenseState: "candidate-allowed" as const,
            securityPolicyState: "candidate-conformant" as const,
            rationale: "The exact repository manifest observation identifies this candidate runtime version",
            evidenceReferences: [observation],
            assessedBy: { kind: "human" as const, id: "technology-reviewer" },
            assessedAt: "2026-07-30T00:00:00.000Z",
          }],
          constraints: [{
            id: randomUUID(),
            ordinal: 1,
            kind: "platform" as const,
            requirement: "The candidate runtime must remain portable across the declared host platforms",
            disposition: "mandatory" as const,
            assessmentState: "candidate-satisfied" as const,
            evidenceReferences: [architectureEvidence],
            assessedBy: { kind: "human" as const, id: "technology-reviewer" },
            assessedAt: "2026-07-30T00:00:00.000Z",
          }],
          assuranceObligations: ["Verify the exact runtime candidate through governed package evidence"],
          observabilityObligations: ["Retain bounded runtime and package lifecycle evidence"],
        }
      }),
      unresolvedQuestions: [],
      limitations: ["Observed facts and selected technologies remain candidates for accountable review"],
      reviewState: "ready-for-human-review",
      technologyApprovalState: "not-established",
      supportCommitmentState: "not-established",
      compatibilityTruthState: "not-established",
      compatibilityCompletenessState: "not-established",
      licensingApprovalState: "not-established",
      securityApprovalState: "not-established",
      exceptionWaiverState: "not-established",
      architectureBaselineDesignationState: "not-established",
      implementationReadinessState: "not-established",
      implementationCompletenessState: "not-established",
      assignmentExecutionState: "not-established",
      approvalState: "not-established",
      acceptanceDecisionState: "not-established",
      mergeReadinessState: "not-established",
      releaseReadinessState: "not-established",
      deploymentReadinessState: "not-established",
      actionAuthorityState: "not-granted",
    }
  }

  function boilerplateRegistryInput(
    initiativeId: string,
    context: MvpSliceDefinitionInput["context"],
    units: Awaited<ReturnType<typeof engine.implementationUnitModel.create>>,
    technologyProfile: Awaited<ReturnType<typeof engine.technologyProfile.create>>,
  ): BoilerplateRegistryInput {
    const architectureEvidence = {
      kind: "architecture" as const,
      sourceId: "atlas-system-solution-architecture-candidate",
      revision: 1,
      digest: canonicalDigest({ initiativeId, context, kind: "architecture-candidate" }),
      observationState: "candidate-asserted" as const,
    }
    return {
      initiativeId,
      context,
      informationClassification: "internal",
      title: "Atlas candidate organizational boilerplate registry",
      implementationUnitModel: { recordId: units.id, revision: units.revision, digest: canonicalDigest(units) },
      technologyProfile: {
        recordId: technologyProfile.id, revision: technologyProfile.revision, digest: canonicalDigest(technologyProfile),
      },
      architectureEvidenceReferences: [architectureEvidence],
      entries: technologyProfile.profiles.map((profile, index) => ({
        id: randomUUID(),
        ordinal: index + 1,
        canonicalName: `Candidate ${profile.profileKind} foundation ${index + 1}`,
        kind: profile.profileKind === "service" ? "service-template" as const : "client-template" as const,
        sourceKind: "local-repository" as const,
        sourceReference: `templates/${profile.profileKind}-foundation-${index + 1}`,
        versionCandidate: `candidate-commit-${index + 1}`,
        versionState: "exact-candidate" as const,
        applicabilityState: "candidate-preferred" as const,
        availabilityState: "candidate-available" as const,
        integrityState: "candidate-verified" as const,
        provenanceState: "candidate-traceable" as const,
        supportState: "candidate-supported" as const,
        lifecycleState: "active" as const,
        technologyCompatibilityState: "candidate-compatible" as const,
        architectureCompatibilityState: "candidate-compatible" as const,
        licenseState: "candidate-allowed" as const,
        securityPolicyState: "candidate-conformant" as const,
        exceptionState: "not-required-candidate" as const,
        applicableTechnologyProfileIds: [profile.id],
        applicableImplementationUnitIds: [profile.implementationUnitId],
        capabilities: ["Provides a bounded candidate foundation for the current implementation-unit profile"],
        knownLimitations: ["Registry evidence does not designate, approve, select, or bind the candidate asset"],
        rationale: "The exact local repository observation identifies an inspectable candidate without asserting organizational authority",
        evidenceReferences: [{
          kind: "repository-observation" as const,
          sourceId: `candidate-foundation-${index + 1}`,
          revision: 1,
          digest: canonicalDigest({ profileId: profile.id, implementationUnitId: profile.implementationUnitId, index }),
          observationState: "observed-not-validated" as const,
        }],
        assessedBy: { kind: "human" as const, id: "boilerplate-reviewer" },
        assessedAt: "2026-07-30T00:00:00.000Z",
      })),
      unresolvedQuestions: [],
      limitations: ["Candidate entries require accountable organizational review before designation or use"],
      reviewState: "ready-for-human-review",
      organizationalDesignationState: "not-established",
      endorsementApprovalState: "not-established",
      supportCommitmentState: "not-established",
      compatibilityTruthState: "not-established",
      compatibilityCompletenessState: "not-established",
      licensingApprovalState: "not-established",
      securityApprovalState: "not-established",
      exceptionWaiverState: "not-established",
      selectionBindingState: "not-established",
      architectureBaselineDesignationState: "not-established",
      implementationReadinessState: "not-established",
      implementationCompletenessState: "not-established",
      assignmentExecutionState: "not-established",
      acceptanceDecisionState: "not-established",
      mergeReadinessState: "not-established",
      releaseReadinessState: "not-established",
      deploymentReadinessState: "not-established",
      actionAuthorityState: "not-granted",
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

  it("persists and assesses exact structured Acceptance Criteria without synthesizing acceptance", async () => {
    const { initiative, hierarchy, input } = await fixture()
    const mvp = await engine.mvpSliceDefinition.create(input, actorId)
    const priority = await engine.prioritizationModel.create(prioritizationInput(initiative.id, input.context, mvp), actorId)
    const criteriaInput = acceptanceCriteriaInput(initiative.id, input.context, hierarchy, mvp, priority)
    const created = await engine.acceptanceCriteria.create(criteriaInput, actorId)
    const revised = await engine.acceptanceCriteria.revise(created.id, created.revision, {
      ...criteriaInput,
      title: "Atlas reviewed structured Acceptance Criteria candidate",
    }, actorId)
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created) })
    expect((await engine.acceptanceCriteria.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    const status = await engine.acceptanceCriteria.assess(initiative.id)
    expect(status).toMatchObject({
      state: "complete-for-review",
      subjectCount: 2,
      coveredSubjectCount: 2,
      uncoveredSubjectCount: 0,
      criterionCount: 2,
      testableCriterionCount: 2,
      unassessedCriterionCount: 0,
      requirementTraceCount: 2,
      uncoveredRequirementCount: 0,
      verificationMethodCount: 1,
      invalidCriterionCount: 0,
    })
    expect(status.authorityBoundary).toContain("does-not-establish-criterion-validity")

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    const event = events.findLast((entry) => entry.eventType === "acceptance-criteria.revised")
    expect(event?.payload).toMatchObject({
      revision: 2,
      subjectCount: 2,
      criterionCount: 2,
      requirementTraceCount: 2,
      criterionValidityState: "not-established",
      requirementSatisfactionState: "not-established",
      acceptanceDecisionState: "not-established",
      implementationAuthorityState: "not-granted",
      actionAuthorityState: "not-granted",
    })
    expect(JSON.stringify(event)).not.toContain(criteriaInput.title)
    expect(JSON.stringify(event)).not.toContain(criteriaInput.criteria[0]!.expectedResult)
    expect((await engine.repository.verifyAudit()).valid).toBe(true)
  })

  it("projects privacy-safe Acceptance Criteria metadata and reports superseded priority bindings", async () => {
    const { initiative, hierarchy, input } = await fixture()
    const mvp = await engine.mvpSliceDefinition.create(input, actorId)
    const priorityInput = prioritizationInput(initiative.id, input.context, mvp)
    const priority = await engine.prioritizationModel.create(priorityInput, actorId)
    const criteriaInput = acceptanceCriteriaInput(initiative.id, input.context, hierarchy, mvp, priority)
    const created = await engine.acceptanceCriteria.create(criteriaInput, actorId)
    const projection = await engine.acceptanceCriteria.project(initiative.id)
    expect(projection.candidate).toMatchObject({
      id: created.id, subjectCount: 2, criterionCount: 2, testableCriterionCount: 2,
      requirementTraceCount: 2, verificationMethodCount: 1,
    })
    expect(projection.snapshotDigest).toMatch(/^sha256:[0-9a-f]{64}$/u)
    const serialized = JSON.stringify(projection)
    expect(serialized).not.toContain(criteriaInput.title)
    expect(serialized).not.toContain(criteriaInput.criteria[0]!.precondition)
    expect(serialized).not.toContain(criteriaInput.criteria[0]!.requirements[0]!.recordId)
    expect(serialized).not.toContain("founder")

    await engine.prioritizationModel.revise(priority.id, priority.revision, {
      ...priorityInput,
      title: "Superseding prioritization candidate",
    }, actorId)
    const status = await engine.acceptanceCriteria.assess(initiative.id)
    expect(status).toMatchObject({ state: "attention-required", stalePrioritizationModelCount: 1 })
    expect(await engine.acceptanceCriteria.healthIssues()).toEqual([
      expect.objectContaining({
        code: "acceptance-criteria.binding-review-required",
        severity: "warning",
        record: { type: created.kind, id: created.id, revision: created.revision },
      }),
    ])
  })

  it("fails closed on foreign Requirement traces and reports incomplete draft coverage", async () => {
    const { initiative, hierarchy, input } = await fixture()
    const mvp = await engine.mvpSliceDefinition.create(input, actorId)
    const priority = await engine.prioritizationModel.create(prioritizationInput(initiative.id, input.context, mvp), actorId)
    const invalid = acceptanceCriteriaInput(initiative.id, input.context, hierarchy, mvp, priority)
    invalid.criteria[0]!.requirements[0]!.digest = `sha256:${"0".repeat(64)}`
    await expect(engine.acceptanceCriteria.create(invalid, actorId)).rejects.toThrow(/exact Requirement traces/u)

    const incomplete = acceptanceCriteriaInput(initiative.id, input.context, hierarchy, mvp, priority)
    incomplete.criteria = [incomplete.criteria[0]!]
    incomplete.criterionSetCompletenessState = "not-assessed"
    incomplete.requirementCoverageState = "not-assessed"
    incomplete.reviewState = "draft"
    await engine.acceptanceCriteria.create(incomplete, actorId)
    const status = await engine.acceptanceCriteria.assess(initiative.id)
    expect(status).toMatchObject({
      state: "attention-required",
      subjectCount: 2,
      coveredSubjectCount: 1,
      uncoveredSubjectCount: 1,
      uncoveredRequirementCount: 1,
    })
    expect(status.reasons).toContain("One or more exact MVP Story or Task subjects lack candidate criteria")
  })

  it("persists, revises, assesses, and projects exact Definition of Ready item evaluations without granting admission", async () => {
    const { initiative, hierarchy, input } = await fixture()
    const mvp = await engine.mvpSliceDefinition.create(input, actorId)
    const priority = await engine.prioritizationModel.create(prioritizationInput(initiative.id, input.context, mvp), actorId)
    const criteria = await engine.acceptanceCriteria.create(
      acceptanceCriteriaInput(initiative.id, input.context, hierarchy, mvp, priority), actorId,
    )
    const readyInput = definitionOfReadyInput(initiative.id, input.context, hierarchy, mvp, priority, criteria)
    const created = await engine.definitionOfReady.create(readyInput, actorId)
    const revised = await engine.definitionOfReady.revise(created.id, created.revision, {
      ...readyInput,
      title: "Atlas reviewed item Definition of Ready candidate",
    }, actorId)
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created) })
    expect((await engine.definitionOfReady.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])

    const status = await engine.definitionOfReady.assess(initiative.id)
    expect(status).toMatchObject({
      result: "candidate-passed",
      subjectCount: 2,
      policyEntryCount: 1,
      expectedEvaluationCount: 2,
      evaluationCount: 2,
      candidateSatisfiedCount: 2,
      missingEvaluationCount: 0,
      expiredCount: 0,
    })
    expect(status.gateBoundary).toContain("not-admission-readiness-assignment-execution-or-implementation-permission")

    const projection = await engine.definitionOfReady.project(initiative.id)
    expect(projection.candidate).toMatchObject({
      id: revised.id, revision: 2, policyVersion: 1, subjectCount: 2, policyEntryCount: 1, evaluationCount: 2,
    })
    expect(projection.snapshotDigest).toMatch(/^sha256:[0-9a-f]{64}$/u)
    const serialized = JSON.stringify(projection)
    expect(serialized).not.toContain(readyInput.title)
    expect(serialized).not.toContain(readyInput.itemEvaluations[0]!.rationale)
    expect(serialized).not.toContain(actorId)

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    const event = events.findLast((entry) => entry.eventType === "definition-of-ready.revised")
    expect(event?.payload).toMatchObject({
      revision: 2, subjectCount: 2, policyEntryCount: 1, expectedEvaluationCount: 2, evaluationCount: 2,
      prerequisiteTruthState: "not-established", exceptionWaiverAuthorityState: "not-established",
      phaseEntryState: "not-established", implementationReadinessState: "not-established",
      implementationAuthorityState: "not-granted", actionAuthorityState: "not-granted",
    })
    expect(JSON.stringify(event)).not.toContain(readyInput.title)
    expect(JSON.stringify(event)).not.toContain(readyInput.itemEvaluations[0]!.rationale)
    expect((await engine.repository.verifyAudit()).valid).toBe(true)
  })

  it("fails closed on incomplete ready evaluations and reports superseded Acceptance Criteria bindings", async () => {
    const { initiative, hierarchy, input } = await fixture()
    const mvp = await engine.mvpSliceDefinition.create(input, actorId)
    const priority = await engine.prioritizationModel.create(prioritizationInput(initiative.id, input.context, mvp), actorId)
    const criteriaInput = acceptanceCriteriaInput(initiative.id, input.context, hierarchy, mvp, priority)
    const criteria = await engine.acceptanceCriteria.create(criteriaInput, actorId)
    const incomplete = definitionOfReadyInput(initiative.id, input.context, hierarchy, mvp, priority, criteria)
    incomplete.itemEvaluations = [incomplete.itemEvaluations[0]!]
    await expect(engine.definitionOfReady.create(incomplete, actorId)).rejects.toThrow(/evaluate every policy prerequisite/u)

    const ready = await engine.definitionOfReady.create(
      definitionOfReadyInput(initiative.id, input.context, hierarchy, mvp, priority, criteria), actorId,
    )
    await engine.acceptanceCriteria.revise(criteria.id, criteria.revision, {
      ...criteriaInput,
      title: "Superseding Acceptance Criteria candidate",
    }, actorId)
    const status = await engine.definitionOfReady.assess(initiative.id)
    expect(status).toMatchObject({ result: "attention-required", staleAcceptanceCriteriaCount: 1 })
    expect(await engine.definitionOfReady.healthIssues()).toEqual([
      expect.objectContaining({
        code: "definition-of-ready.binding-review-required",
        severity: "warning",
        record: { type: ready.kind, id: ready.id, revision: ready.revision },
      }),
    ])
  })

  it("persists, revises, assesses, and projects exact Definition of Done evaluations without granting completion", async () => {
    const { initiative, hierarchy, input } = await fixture()
    const mvp = await engine.mvpSliceDefinition.create(input, actorId)
    const priority = await engine.prioritizationModel.create(prioritizationInput(initiative.id, input.context, mvp), actorId)
    const criteria = await engine.acceptanceCriteria.create(
      acceptanceCriteriaInput(initiative.id, input.context, hierarchy, mvp, priority), actorId,
    )
    const ready = await engine.definitionOfReady.create(
      definitionOfReadyInput(initiative.id, input.context, hierarchy, mvp, priority, criteria), actorId,
    )
    const doneInput = definitionOfDoneInput(initiative.id, input.context, hierarchy, mvp, priority, criteria, ready)
    const created = await engine.definitionOfDone.create(doneInput, actorId)
    const revised = await engine.definitionOfDone.revise(created.id, created.revision, {
      ...doneInput,
      title: "Atlas reviewed item Definition of Done candidate",
    }, actorId)
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created) })
    expect((await engine.definitionOfDone.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])

    const status = await engine.definitionOfDone.assess(initiative.id)
    expect(status).toMatchObject({
      result: "candidate-passed",
      subjectCount: 2,
      policyEntryCount: 1,
      expectedEvaluationCount: 2,
      evaluationCount: 2,
      candidateSatisfiedCount: 2,
      missingEvaluationCount: 0,
      staleDefinitionOfReadyCount: 0,
      expiredCount: 0,
    })
    expect(status.gateBoundary).toContain("not-completion-acceptance-approval-merge-release-deployment-or-action-permission")

    const projection = await engine.definitionOfDone.project(initiative.id)
    expect(projection.candidate).toMatchObject({
      id: revised.id, revision: 2, policyVersion: 1, subjectCount: 2, policyEntryCount: 1, evaluationCount: 2,
    })
    expect(projection.snapshotDigest).toMatch(/^sha256:[0-9a-f]{64}$/u)
    const serialized = JSON.stringify(projection)
    expect(serialized).not.toContain(doneInput.title)
    expect(serialized).not.toContain(doneInput.itemEvaluations[0]!.rationale)
    expect(serialized).not.toContain(actorId)

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    const event = events.findLast((entry) => entry.eventType === "definition-of-done.revised")
    expect(event?.payload).toMatchObject({
      revision: 2, subjectCount: 2, policyEntryCount: 1, expectedEvaluationCount: 2, evaluationCount: 2,
      evidenceTruthState: "not-established", testResultState: "not-established", qualityState: "not-established",
      exceptionWaiverAuthorityState: "not-established", implementationCompletenessState: "not-established",
      mergeReadinessState: "not-established", releaseReadinessState: "not-established",
      deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
    })
    expect(JSON.stringify(event)).not.toContain(doneInput.title)
    expect(JSON.stringify(event)).not.toContain(doneInput.itemEvaluations[0]!.rationale)
    expect((await engine.repository.verifyAudit()).valid).toBe(true)
  })

  it("fails closed on incomplete done evaluations and reports superseded Definition of Ready bindings", async () => {
    const { initiative, hierarchy, input } = await fixture()
    const mvp = await engine.mvpSliceDefinition.create(input, actorId)
    const priority = await engine.prioritizationModel.create(prioritizationInput(initiative.id, input.context, mvp), actorId)
    const criteria = await engine.acceptanceCriteria.create(
      acceptanceCriteriaInput(initiative.id, input.context, hierarchy, mvp, priority), actorId,
    )
    const readyInput = definitionOfReadyInput(initiative.id, input.context, hierarchy, mvp, priority, criteria)
    const ready = await engine.definitionOfReady.create(readyInput, actorId)
    const incomplete = definitionOfDoneInput(initiative.id, input.context, hierarchy, mvp, priority, criteria, ready)
    incomplete.itemEvaluations = [incomplete.itemEvaluations[0]!]
    await expect(engine.definitionOfDone.create(incomplete, actorId)).rejects.toThrow(/evaluate every policy prerequisite/u)

    const done = await engine.definitionOfDone.create(
      definitionOfDoneInput(initiative.id, input.context, hierarchy, mvp, priority, criteria, ready), actorId,
    )
    await engine.definitionOfReady.revise(ready.id, ready.revision, {
      ...readyInput,
      title: "Superseding Definition of Ready candidate",
    }, actorId)
    const status = await engine.definitionOfDone.assess(initiative.id)
    expect(status).toMatchObject({ result: "attention-required", staleDefinitionOfReadyCount: 1 })
    expect(await engine.definitionOfDone.healthIssues()).toEqual([
      expect.objectContaining({
        code: "definition-of-done.binding-review-required",
        severity: "warning",
        record: { type: done.kind, id: done.id, revision: done.revision },
      }),
    ])
  })

  it("persists, revises, assesses, and privately projects exact implementation-unit candidates", async () => {
    const { initiative, hierarchy, input } = await fixture()
    const mvp = await engine.mvpSliceDefinition.create(input, actorId)
    const priority = await engine.prioritizationModel.create(prioritizationInput(initiative.id, input.context, mvp), actorId)
    const criteria = await engine.acceptanceCriteria.create(
      acceptanceCriteriaInput(initiative.id, input.context, hierarchy, mvp, priority), actorId,
    )
    const ready = await engine.definitionOfReady.create(
      definitionOfReadyInput(initiative.id, input.context, hierarchy, mvp, priority, criteria), actorId,
    )
    const doneInput = definitionOfDoneInput(initiative.id, input.context, hierarchy, mvp, priority, criteria, ready)
    const done = await engine.definitionOfDone.create(doneInput, actorId)
    const unitInput = implementationUnitModelInput(initiative.id, input.context, hierarchy, mvp, criteria, ready, done)
    const created = await engine.implementationUnitModel.create(unitInput, actorId)
    const revised = await engine.implementationUnitModel.revise(created.id, created.revision, {
      ...unitInput,
      title: "Atlas reviewed implementation unit model candidate",
    }, actorId)
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created) })
    expect((await engine.implementationUnitModel.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect((await engine.implementationUnitModel.readRevision(created.id, 1)).title).toBe(unitInput.title)

    const status = await engine.implementationUnitModel.assess(initiative.id)
    expect(status).toMatchObject({
      state: "candidate-complete", unitCount: 2, subjectCount: 2, requirementReferenceCount: 2,
      repositoryCandidateCount: 2, ownerCandidateCount: 2, dependencyEdgeCount: 1,
      candidateAssessedBlastRadiusCount: 2, missingSubjectCount: 0, invalidUnitCount: 0,
      staleDefinitionOfDoneCount: 0,
    })
    const projection = await engine.implementationUnitModel.project(initiative.id)
    expect(projection.candidate).toMatchObject({ id: revised.id, revision: 2, unitCount: 2, subjectCount: 2 })
    expect(projection.snapshotDigest).toMatch(/^sha256:[0-9a-f]{64}$/u)
    const serialized = JSON.stringify(projection)
    expect(serialized).not.toContain(unitInput.title)
    expect(serialized).not.toContain(unitInput.units[0]!.repository.modulePath)
    expect(serialized).not.toContain(unitInput.units[0]!.ownerCandidate.id)

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    const event = events.findLast((entry) => entry.eventType === "implementation-unit-model.revised")
    expect(event?.payload).toMatchObject({
      revision: 2, unitCount: 2, subjectCount: 2, requirementReferenceCount: 2,
      repositoryTruthState: "not-established", ownershipAppointmentState: "not-established",
      dependencyCompletenessState: "not-established", impactCompletenessState: "not-established",
      implementationReadinessState: "not-established", implementationCompletenessState: "not-established",
      assignmentExecutionState: "not-established", approvalState: "not-established",
      acceptanceDecisionState: "not-established", mergeReadinessState: "not-established",
      releaseReadinessState: "not-established", deploymentReadinessState: "not-established",
      actionAuthorityState: "not-granted",
    })
    expect(JSON.stringify(event)).not.toContain(unitInput.title)
    expect(JSON.stringify(event)).not.toContain(unitInput.units[0]!.repository.modulePath)
    expect((await engine.repository.verifyAudit()).valid).toBe(true)

    await engine.definitionOfDone.revise(done.id, done.revision, {
      ...doneInput,
      title: "Superseding Atlas item Definition of Done candidate",
    }, actorId)
    expect(await engine.implementationUnitModel.assess(initiative.id)).toMatchObject({
      state: "attention-required", staleDefinitionOfDoneCount: 1,
    })
    expect(await engine.implementationUnitModel.healthIssues()).toEqual([
      expect.objectContaining({ code: "implementation-unit-model.binding-review-required", severity: "warning" }),
    ])
  })

  it("fails closed when a review-ready implementation-unit candidate omits an exact MVP subject", async () => {
    const { initiative, hierarchy, input } = await fixture()
    const mvp = await engine.mvpSliceDefinition.create(input, actorId)
    const priority = await engine.prioritizationModel.create(prioritizationInput(initiative.id, input.context, mvp), actorId)
    const criteria = await engine.acceptanceCriteria.create(
      acceptanceCriteriaInput(initiative.id, input.context, hierarchy, mvp, priority), actorId,
    )
    const ready = await engine.definitionOfReady.create(
      definitionOfReadyInput(initiative.id, input.context, hierarchy, mvp, priority, criteria), actorId,
    )
    const done = await engine.definitionOfDone.create(
      definitionOfDoneInput(initiative.id, input.context, hierarchy, mvp, priority, criteria, ready), actorId,
    )
    const unitInput = implementationUnitModelInput(initiative.id, input.context, hierarchy, mvp, criteria, ready, done)
    unitInput.units = [unitInput.units[0]!]
    unitInput.units[0]!.blastRadius.affectedUnitIds = []
    await expect(engine.implementationUnitModel.create(unitInput, actorId)).rejects.toThrow(/assign every exact MVP Story and Task/u)
  })

  it("persists, revises, assesses, and privately projects exact dependency mapping candidates", async () => {
    const { initiative, hierarchy, input } = await fixture()
    const mvp = await engine.mvpSliceDefinition.create(input, actorId)
    const priority = await engine.prioritizationModel.create(prioritizationInput(initiative.id, input.context, mvp), actorId)
    const criteria = await engine.acceptanceCriteria.create(
      acceptanceCriteriaInput(initiative.id, input.context, hierarchy, mvp, priority), actorId,
    )
    const ready = await engine.definitionOfReady.create(
      definitionOfReadyInput(initiative.id, input.context, hierarchy, mvp, priority, criteria), actorId,
    )
    const done = await engine.definitionOfDone.create(
      definitionOfDoneInput(initiative.id, input.context, hierarchy, mvp, priority, criteria, ready), actorId,
    )
    const unitInput = implementationUnitModelInput(initiative.id, input.context, hierarchy, mvp, criteria, ready, done)
    const units = await engine.implementationUnitModel.create(unitInput, actorId)
    const mappingInput = dependencyMappingInput(initiative.id, input.context, hierarchy, mvp, units)
    const created = await engine.dependencyMapping.create(mappingInput, actorId)
    expect(created.criticalPath).toMatchObject({
      orderedUnitIds: mappingInput.nodes.map((node) => node.implementationUnitId),
      totalCandidateEffortPoints: 13,
    })
    const revised = await engine.dependencyMapping.revise(created.id, created.revision, {
      ...mappingInput,
      title: "Atlas reviewed dependency mapping candidate",
    }, actorId)
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created) })
    expect((await engine.dependencyMapping.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect((await engine.dependencyMapping.readRevision(created.id, 1)).title).toBe(mappingInput.title)

    const status = await engine.dependencyMapping.assess(initiative.id)
    expect(status).toMatchObject({
      state: "candidate-complete", nodeCount: 2, edgeCount: 1, requiredEdgeCount: 1,
      rootNodeCount: 1, leafNodeCount: 1, criticalPathUnitCount: 2,
      criticalPathCandidateEffortPoints: 13, missingNodeCount: 0, missingDeclaredEdgeCount: 0,
      extraEdgeCount: 0, invalidNodeCount: 0, invalidEdgeCount: 0, cycleCount: 0,
      staleImplementationUnitModelCount: 0,
    })
    const projection = await engine.dependencyMapping.project(initiative.id)
    expect(projection.candidate).toMatchObject({
      id: revised.id, revision: 2, nodeCount: 2, edgeCount: 1,
      criticalPathUnitCount: 2, criticalPathCandidateEffortPoints: 13,
    })
    expect(projection.snapshotDigest).toMatch(/^sha256:[0-9a-f]{64}$/u)
    const serialized = JSON.stringify(projection)
    expect(serialized).not.toContain(mappingInput.title)
    expect(serialized).not.toContain(mappingInput.nodes[0]!.implementationUnitId)
    expect(serialized).not.toContain(mappingInput.edges[0]!.rationale)

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    const event = events.findLast((entry) => entry.eventType === "dependency-mapping.revised")
    expect(event?.payload).toMatchObject({
      revision: 2, nodeCount: 2, edgeCount: 1, requiredEdgeCount: 1,
      criticalPathUnitCount: 2, criticalPathCandidateEffortPoints: 13,
      dependencyTruthState: "not-established", dependencyCompletenessState: "not-established",
      criticalPathAuthorityState: "not-established", sequencingCommitmentState: "not-established",
      ownershipAppointmentState: "not-established", implementationReadinessState: "not-established",
      implementationCompletenessState: "not-established", assignmentExecutionState: "not-established",
      approvalState: "not-established", acceptanceDecisionState: "not-established",
      mergeReadinessState: "not-established", releaseReadinessState: "not-established",
      deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
    })
    expect(JSON.stringify(event)).not.toContain(mappingInput.title)
    expect(JSON.stringify(event)).not.toContain(mappingInput.edges[0]!.rationale)
    expect((await engine.repository.verifyAudit()).valid).toBe(true)

    await engine.implementationUnitModel.revise(units.id, units.revision, {
      ...unitInput,
      title: "Superseding Atlas implementation unit model candidate",
    }, actorId)
    expect(await engine.dependencyMapping.assess(initiative.id)).toMatchObject({
      state: "attention-required", staleImplementationUnitModelCount: 1,
    })
    expect(await engine.dependencyMapping.healthIssues()).toEqual([
      expect.objectContaining({ code: "dependency-mapping.binding-review-required", severity: "warning" }),
    ])
  })

  it("fails closed when a review-ready dependency mapping omits an exact declared edge", async () => {
    const { initiative, hierarchy, input } = await fixture()
    const mvp = await engine.mvpSliceDefinition.create(input, actorId)
    const priority = await engine.prioritizationModel.create(prioritizationInput(initiative.id, input.context, mvp), actorId)
    const criteria = await engine.acceptanceCriteria.create(
      acceptanceCriteriaInput(initiative.id, input.context, hierarchy, mvp, priority), actorId,
    )
    const ready = await engine.definitionOfReady.create(
      definitionOfReadyInput(initiative.id, input.context, hierarchy, mvp, priority, criteria), actorId,
    )
    const done = await engine.definitionOfDone.create(
      definitionOfDoneInput(initiative.id, input.context, hierarchy, mvp, priority, criteria, ready), actorId,
    )
    const units = await engine.implementationUnitModel.create(
      implementationUnitModelInput(initiative.id, input.context, hierarchy, mvp, criteria, ready, done), actorId,
    )
    const mappingInput = dependencyMappingInput(initiative.id, input.context, hierarchy, mvp, units)
    mappingInput.edges = []
    await expect(engine.dependencyMapping.create(mappingInput, actorId)).rejects.toThrow(/every exact implementation unit and declared dependency/u)
  })

  it("persists, revises, assesses, and privately projects exact Technology Profile candidates", async () => {
    const { initiative, hierarchy, input } = await fixture()
    const mvp = await engine.mvpSliceDefinition.create(input, actorId)
    const priority = await engine.prioritizationModel.create(prioritizationInput(initiative.id, input.context, mvp), actorId)
    const criteria = await engine.acceptanceCriteria.create(
      acceptanceCriteriaInput(initiative.id, input.context, hierarchy, mvp, priority), actorId,
    )
    const ready = await engine.definitionOfReady.create(
      definitionOfReadyInput(initiative.id, input.context, hierarchy, mvp, priority, criteria), actorId,
    )
    const done = await engine.definitionOfDone.create(
      definitionOfDoneInput(initiative.id, input.context, hierarchy, mvp, priority, criteria, ready), actorId,
    )
    const units = await engine.implementationUnitModel.create(
      implementationUnitModelInput(initiative.id, input.context, hierarchy, mvp, criteria, ready, done), actorId,
    )
    const mappingInput = dependencyMappingInput(initiative.id, input.context, hierarchy, mvp, units)
    const mapping = await engine.dependencyMapping.create(mappingInput, actorId)
    const profileInput = technologyProfileInput(initiative.id, input.context, units, mapping)
    const created = await engine.technologyProfile.create(profileInput, actorId)
    const revised = await engine.technologyProfile.revise(created.id, created.revision, {
      ...profileInput,
      title: "Atlas reviewed implementation-unit technology profiles",
    }, actorId)
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created) })
    expect((await engine.technologyProfile.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect((await engine.technologyProfile.readRevision(created.id, 1)).title).toBe(profileInput.title)

    const status = await engine.technologyProfile.assess(initiative.id)
    expect(status).toMatchObject({
      state: "candidate-complete", unitProfileCount: 2, technologyChoiceCount: 2,
      exactVersionCandidateCount: 2, rangeVersionCandidateCount: 0, unresolvedVersionCount: 0,
      constraintCount: 2, missingProfileCount: 0, invalidProfileCount: 0, missingEvidenceCount: 0,
      unsupportedChoiceCount: 0, lifecycleRiskCount: 0, compatibilityConflictCount: 0,
      licenseReviewRequiredCount: 0, licenseProhibitedCount: 0, securityReviewRequiredCount: 0,
      securityNonconformantCount: 0, exceptionCandidateCount: 0, constraintConflictCount: 0,
      staleImplementationUnitModelCount: 0, staleDependencyMappingCount: 0,
    })
    const projection = await engine.technologyProfile.project(initiative.id)
    expect(projection.candidate).toMatchObject({
      id: revised.id, revision: 2, unitProfileCount: 2, technologyChoiceCount: 2, constraintCount: 2,
    })
    expect(projection.snapshotDigest).toMatch(/^sha256:[0-9a-f]{64}$/u)
    const serialized = JSON.stringify(projection)
    expect(serialized).not.toContain(profileInput.title)
    expect(serialized).not.toContain("Node.js")
    expect(serialized).not.toContain(units.units[0]!.id)

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    const event = events.findLast((entry) => entry.eventType === "technology-profile.revised")
    expect(event?.payload).toMatchObject({
      revision: 2, unitProfileCount: 2, technologyChoiceCount: 2, exactVersionCandidateCount: 2,
      constraintCount: 2, technologyApprovalState: "not-established",
      supportCommitmentState: "not-established", compatibilityTruthState: "not-established",
      compatibilityCompletenessState: "not-established", licensingApprovalState: "not-established",
      securityApprovalState: "not-established", exceptionWaiverState: "not-established",
      architectureBaselineDesignationState: "not-established", implementationReadinessState: "not-established",
      implementationCompletenessState: "not-established", assignmentExecutionState: "not-established",
      approvalState: "not-established", acceptanceDecisionState: "not-established",
      mergeReadinessState: "not-established", releaseReadinessState: "not-established",
      deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
    })
    expect(JSON.stringify(event)).not.toContain(profileInput.title)
    expect(JSON.stringify(event)).not.toContain("Node.js")
    expect((await engine.repository.verifyAudit()).valid).toBe(true)

    await engine.dependencyMapping.revise(mapping.id, mapping.revision, {
      ...mappingInput,
      title: "Superseding Atlas dependency mapping candidate",
    }, actorId)
    expect(await engine.technologyProfile.assess(initiative.id)).toMatchObject({
      state: "attention-required", staleDependencyMappingCount: 1,
    })
    expect(await engine.technologyProfile.healthIssues()).toEqual([
      expect.objectContaining({ code: "technology-profile.binding-review-required", severity: "warning" }),
    ])
  })

  it("fails closed when a review-ready Technology Profile omits a current unit or records a compatibility conflict", async () => {
    const { initiative, hierarchy, input } = await fixture()
    const mvp = await engine.mvpSliceDefinition.create(input, actorId)
    const priority = await engine.prioritizationModel.create(prioritizationInput(initiative.id, input.context, mvp), actorId)
    const criteria = await engine.acceptanceCriteria.create(
      acceptanceCriteriaInput(initiative.id, input.context, hierarchy, mvp, priority), actorId,
    )
    const ready = await engine.definitionOfReady.create(
      definitionOfReadyInput(initiative.id, input.context, hierarchy, mvp, priority, criteria), actorId,
    )
    const done = await engine.definitionOfDone.create(
      definitionOfDoneInput(initiative.id, input.context, hierarchy, mvp, priority, criteria, ready), actorId,
    )
    const units = await engine.implementationUnitModel.create(
      implementationUnitModelInput(initiative.id, input.context, hierarchy, mvp, criteria, ready, done), actorId,
    )
    const mapping = await engine.dependencyMapping.create(
      dependencyMappingInput(initiative.id, input.context, hierarchy, mvp, units), actorId,
    )
    const profileInput = technologyProfileInput(initiative.id, input.context, units, mapping)
    await expect(engine.technologyProfile.create({
      ...profileInput,
      profiles: profileInput.profiles.slice(0, 1),
    }, actorId)).rejects.toThrow(/cover every exact implementation unit/u)
    await expect(engine.technologyProfile.create({
      ...profileInput,
      profiles: profileInput.profiles.map((profile, profileIndex) => ({
        ...profile,
        choices: profile.choices.map((choice) => ({
          ...choice,
          compatibilityState: profileIndex === 0 ? "candidate-conflict" as const : choice.compatibilityState,
        })),
      })),
    }, actorId)).rejects.toThrow(/supported compatible lifecycle-safe/u)
  })

  it("persists, revises, assesses, and privately projects exact Boilerplate Registry candidates", async () => {
    const { initiative, hierarchy, input } = await fixture()
    const mvp = await engine.mvpSliceDefinition.create(input, actorId)
    const priority = await engine.prioritizationModel.create(prioritizationInput(initiative.id, input.context, mvp), actorId)
    const criteria = await engine.acceptanceCriteria.create(acceptanceCriteriaInput(initiative.id, input.context, hierarchy, mvp, priority), actorId)
    const ready = await engine.definitionOfReady.create(definitionOfReadyInput(initiative.id, input.context, hierarchy, mvp, priority, criteria), actorId)
    const done = await engine.definitionOfDone.create(definitionOfDoneInput(initiative.id, input.context, hierarchy, mvp, priority, criteria, ready), actorId)
    const units = await engine.implementationUnitModel.create(implementationUnitModelInput(initiative.id, input.context, hierarchy, mvp, criteria, ready, done), actorId)
    const mapping = await engine.dependencyMapping.create(dependencyMappingInput(initiative.id, input.context, hierarchy, mvp, units), actorId)
    const profileInput = technologyProfileInput(initiative.id, input.context, units, mapping)
    const technologyProfile = await engine.technologyProfile.create(profileInput, actorId)
    const registryInput = boilerplateRegistryInput(initiative.id, input.context, units, technologyProfile)
    const created = await engine.boilerplateRegistry.create(registryInput, actorId)
    const revised = await engine.boilerplateRegistry.revise(created.id, created.revision, {
      ...registryInput, title: "Atlas reviewed candidate organizational boilerplate registry",
    }, actorId)
    expect(revised).toMatchObject({ revision: 2, predecessorDigest: canonicalDigest(created) })
    expect((await engine.boilerplateRegistry.listHistory(created.id)).map((record) => record.revision)).toEqual([2, 1])
    expect((await engine.boilerplateRegistry.readRevision(created.id, 1)).title).toBe(registryInput.title)

    const status = await engine.boilerplateRegistry.assess(initiative.id)
    expect(status).toMatchObject({
      state: "candidate-complete", entryCount: 2, exactVersionCandidateCount: 2,
      rangeVersionCandidateCount: 0, unresolvedVersionCount: 0, mandatoryCandidateCount: 0,
      missingEvidenceCount: 0, unavailableEntryCount: 0, integrityMismatchCount: 0, provenanceGapCount: 0,
      unsupportedEntryCount: 0, lifecycleRiskCount: 0, technologyConflictCount: 0, architectureConflictCount: 0,
      licenseReviewRequiredCount: 0, licenseProhibitedCount: 0, securityReviewRequiredCount: 0,
      securityNonconformantCount: 0, exceptionCandidateCount: 0, staleImplementationUnitModelCount: 0,
      staleTechnologyProfileCount: 0, invalidRegistryCount: 0,
    })
    const projection = await engine.boilerplateRegistry.project(initiative.id)
    expect(projection.candidate).toMatchObject({ id: revised.id, revision: 2, entryCount: 2, mandatoryCandidateCount: 0 })
    expect(projection.snapshotDigest).toMatch(/^sha256:[0-9a-f]{64}$/u)
    const serialized = JSON.stringify(projection)
    expect(serialized).not.toContain(registryInput.title)
    expect(serialized).not.toContain(registryInput.entries[0]!.canonicalName)
    expect(serialized).not.toContain(registryInput.entries[0]!.sourceReference)
    expect(serialized).not.toContain(units.units[0]!.id)

    const events = (await readFile(join(workspace, ".gaep", "audit", "events.jsonl"), "utf8"))
      .trim().split("\n").map((line) => JSON.parse(line) as { eventType: string; payload: Record<string, unknown> })
    const event = events.findLast((entry) => entry.eventType === "boilerplate-registry.revised")
    expect(event?.payload).toMatchObject({
      revision: 2, entryCount: 2, exactVersionCandidateCount: 2, mandatoryCandidateCount: 0,
      organizationalDesignationState: "not-established", endorsementApprovalState: "not-established",
      supportCommitmentState: "not-established", compatibilityTruthState: "not-established",
      compatibilityCompletenessState: "not-established", licensingApprovalState: "not-established",
      securityApprovalState: "not-established", exceptionWaiverState: "not-established",
      selectionBindingState: "not-established", architectureBaselineDesignationState: "not-established",
      implementationReadinessState: "not-established", implementationCompletenessState: "not-established",
      assignmentExecutionState: "not-established", acceptanceDecisionState: "not-established",
      mergeReadinessState: "not-established", releaseReadinessState: "not-established",
      deploymentReadinessState: "not-established", actionAuthorityState: "not-granted",
    })
    expect(JSON.stringify(event)).not.toContain(registryInput.title)
    expect(JSON.stringify(event)).not.toContain(registryInput.entries[0]!.canonicalName)
    expect((await engine.repository.verifyAudit()).valid).toBe(true)

    await engine.technologyProfile.revise(technologyProfile.id, technologyProfile.revision, {
      ...profileInput, title: "Superseding Atlas technology profiles",
    }, actorId)
    expect(await engine.boilerplateRegistry.assess(initiative.id)).toMatchObject({
      state: "attention-required", staleTechnologyProfileCount: 1,
    })
    expect(await engine.boilerplateRegistry.healthIssues()).toEqual([
      expect.objectContaining({ code: "boilerplate-registry.binding-review-required", severity: "warning" }),
    ])
  })

  it("fails closed when a review-ready Boilerplate Registry omits profile applicability or records an integrity gap", async () => {
    const { initiative, hierarchy, input } = await fixture()
    const mvp = await engine.mvpSliceDefinition.create(input, actorId)
    const priority = await engine.prioritizationModel.create(prioritizationInput(initiative.id, input.context, mvp), actorId)
    const criteria = await engine.acceptanceCriteria.create(acceptanceCriteriaInput(initiative.id, input.context, hierarchy, mvp, priority), actorId)
    const ready = await engine.definitionOfReady.create(definitionOfReadyInput(initiative.id, input.context, hierarchy, mvp, priority, criteria), actorId)
    const done = await engine.definitionOfDone.create(definitionOfDoneInput(initiative.id, input.context, hierarchy, mvp, priority, criteria, ready), actorId)
    const units = await engine.implementationUnitModel.create(implementationUnitModelInput(initiative.id, input.context, hierarchy, mvp, criteria, ready, done), actorId)
    const mapping = await engine.dependencyMapping.create(dependencyMappingInput(initiative.id, input.context, hierarchy, mvp, units), actorId)
    const technologyProfile = await engine.technologyProfile.create(technologyProfileInput(initiative.id, input.context, units, mapping), actorId)
    const registryInput = boilerplateRegistryInput(initiative.id, input.context, units, technologyProfile)
    await expect(engine.boilerplateRegistry.create({
      ...registryInput,
      entries: registryInput.entries.map((entry, index) => ({
        ...entry, applicableTechnologyProfileIds: index === 0 ? [] : entry.applicableTechnologyProfileIds,
      })),
    }, actorId)).rejects.toThrow(/exact current dependencies and exact available/u)
    await expect(engine.boilerplateRegistry.create({
      ...registryInput,
      entries: registryInput.entries.map((entry, index) => ({
        ...entry, integrityState: index === 0 ? "candidate-mismatch" as const : entry.integrityState,
      })),
    }, actorId)).rejects.toThrow(/integrity-verified/u)
  })
})
