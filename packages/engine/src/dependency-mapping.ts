import { randomUUID } from "node:crypto"

import {
  dependencyMappingInputSchema,
  dependencyMappingProjectionSchema,
  dependencyMappingSchema,
  dependencyMappingStatusSchema,
  type BacklogHierarchy,
  type BusinessContextBinding,
  type DependencyMapping,
  type DependencyMappingInput,
  type DependencyMappingProjection,
  type DependencyMappingStatus,
  type ImplementationUnitModel,
  type Initiative,
  type MvpSliceDefinition,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { BacklogHierarchyService } from "./backlog-hierarchy.js"
import type { ImplementationUnitModelService } from "./implementation-unit-model.js"
import type { MvpSliceDefinitionService } from "./mvp-slice-definition.js"
import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type CriticalPath = DependencyMapping["criticalPath"]

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: DependencyMapping) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

interface ExactDependencies {
  hierarchy: BacklogHierarchy
  mvp: MvpSliceDefinition
  units: ImplementationUnitModel
}

interface GraphAssessment {
  missingNodeCount: number
  missingDeclaredEdgeCount: number
  extraEdgeCount: number
  invalidNodeCount: number
  invalidEdgeCount: number
  cycleCount: number
  rootNodeCount: number
  leafNodeCount: number
  criticalPath: CriticalPath
}

export class DependencyMappingService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly backlogHierarchy: BacklogHierarchyService,
    private readonly mvpSliceDefinition: MvpSliceDefinitionService,
    private readonly implementationUnitModel: ImplementationUnitModelService,
  ) {}

  async create(inputValue: DependencyMappingInput, actorId: string): Promise<DependencyMapping> {
    const input = dependencyMappingInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input, initiative)
      const assessment = this.assessGraph(input, dependencies.units)
      this.requireValidGraph(input, assessment)
      if (await this.readCurrent(initiative.id)) throw new Error("An Initiative can have only one current Dependency Mapping candidate")
      const now = new Date().toISOString()
      const record = dependencyMappingSchema.parse({
        schemaVersion: 1,
        kind: "dependency-mapping-candidate",
        id: randomUUID(),
        productId: product.id,
        ...input,
        initiativeId: initiative.id,
        revision: 1,
        ...this.composeDigests(input, assessment.criticalPath),
        criticalPath: assessment.criticalPath,
        state: "candidate",
        createdBy: { kind: "human", id: actorId },
        updatedBy: { kind: "human", id: actorId },
        createdAt: now,
        updatedAt: now,
        authorityBoundary: "dependency-mapping-is-a-versioned-candidate-and-does-not-establish-dependency-truth-or-completeness-critical-path-authority-sequencing-commitment-ownership-appointment-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority",
      })
      await this.commitVersionedRecord(record, assessment, "dependency-mapping.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: DependencyMappingInput, actorId: string): Promise<DependencyMapping> {
    const input = dependencyMappingInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Dependency Mapping revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Dependency Mapping Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input, initiative)
      const assessment = this.assessGraph(input, dependencies.units)
      this.requireValidGraph(input, assessment)
      const record = dependencyMappingSchema.parse({
        ...current,
        ...input,
        productId: product.id,
        initiativeId: initiative.id,
        revision: current.revision + 1,
        ...this.composeDigests(input, assessment.criticalPath),
        criticalPath: assessment.criticalPath,
        predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId },
        updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, assessment, "dependency-mapping.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<DependencyMapping> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Dependency Mapping ID")), dependencyMappingSchema)
  }

  async readCurrent(initiativeId: string): Promise<DependencyMapping | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("dependency-mappings", currentRecordPattern, dependencyMappingSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Dependency Mapping candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<DependencyMapping> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Dependency Mapping history revision must be a positive integer")
    const recordId = this.requireUuid(id, "Dependency Mapping ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), dependencyMappingSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Dependency Mapping history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<DependencyMapping[]> {
    const recordId = this.requireUuid(id, "Dependency Mapping ID")
    const records = await this.listRecords(
      "dependency-mapping-history",
      new RegExp(`^dependency-mapping-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      dependencyMappingSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Dependency Mapping history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<DependencyMappingStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, hierarchy, mvp, units] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId),
      this.backlogHierarchy.readCurrent(targetId), this.mvpSliceDefinition.readCurrent(targetId),
      this.implementationUnitModel.readCurrent(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const staleBindingCount = candidate && canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative)) ? 1 : 0
    const staleHierarchyCount = candidate && !this.matches(candidate.hierarchy, hierarchy) ? 1 : 0
    const staleMvpSliceDefinitionCount = candidate && !this.matches(candidate.mvpSliceDefinition, mvp) ? 1 : 0
    const staleImplementationUnitModelCount = candidate && !this.matches(candidate.implementationUnitModel, units) ? 1 : 0
    const assessment = candidate && units
      ? this.assessGraph(candidate, units)
      : this.emptyAssessment()
    let invalidNodeCount = assessment.invalidNodeCount
    let invalidEdgeCount = assessment.invalidEdgeCount
    if (candidate) {
      const digests = this.composeDigests(candidate, assessment.criticalPath)
      if (candidate.graphDigest !== digests.graphDigest ||
          candidate.criticalPathDigest !== digests.criticalPathDigest ||
          candidate.assessmentReceiptDigest !== digests.assessmentReceiptDigest ||
          canonicalDigest(candidate.criticalPath) !== canonicalDigest(assessment.criticalPath)) {
        invalidNodeCount += 1
      }
      if (candidate.criticalPath.pathDigest !== assessment.criticalPath.pathDigest) invalidEdgeCount += 1
    }
    const nodes = candidate?.nodes ?? []
    const edges = candidate?.edges ?? []
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Dependency Mapping candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind the exact current Product and Initiative")
    if (staleHierarchyCount > 0) reasons.push("The candidate does not bind the exact current Backlog Hierarchy")
    if (staleMvpSliceDefinitionCount > 0) reasons.push("The candidate does not bind the exact current MVP and Slice Definition")
    if (staleImplementationUnitModelCount > 0) reasons.push("The candidate does not bind the exact current Implementation Unit Model")
    if (assessment.missingNodeCount > 0) reasons.push("One or more exact current implementation units are absent from the dependency node catalog")
    if (assessment.missingDeclaredEdgeCount > 0) reasons.push("One or more declared implementation-unit dependencies are absent from the dependency edge catalog")
    if (assessment.extraEdgeCount > 0) reasons.push("One or more dependency edges are not declared by the exact current Implementation Unit Model")
    if (invalidNodeCount > 0) reasons.push("One or more dependency nodes, candidate estimates, critical-path values, or integrity digests are invalid")
    if (invalidEdgeCount > 0) reasons.push("One or more dependency edges are invalid or not assessed")
    if (assessment.cycleCount > 0) reasons.push("The dependency graph contains a cycle")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved Dependency Mapping questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return dependencyMappingStatusSchema.parse({
      schemaVersion: 1,
      kind: "dependency-mapping-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? {
        candidate: exactReference(candidate), hierarchy: candidate.hierarchy,
        mvpSliceDefinition: candidate.mvpSliceDefinition, implementationUnitModel: candidate.implementationUnitModel,
      } : {}),
      nodeCount: nodes.length,
      edgeCount: edges.length,
      requiredEdgeCount: edges.filter((edge) => edge.strength === "required").length,
      conditionalEdgeCount: edges.filter((edge) => edge.strength === "conditional").length,
      advisoryEdgeCount: edges.filter((edge) => edge.strength === "advisory").length,
      rootNodeCount: assessment.rootNodeCount,
      leafNodeCount: assessment.leafNodeCount,
      criticalPathUnitCount: candidate?.criticalPath.orderedUnitIds.length ?? 0,
      criticalPathCandidateEffortPoints: candidate?.criticalPath.totalCandidateEffortPoints ?? 0,
      missingNodeCount: assessment.missingNodeCount,
      missingDeclaredEdgeCount: assessment.missingDeclaredEdgeCount,
      extraEdgeCount: assessment.extraEdgeCount,
      invalidNodeCount,
      invalidEdgeCount,
      cycleCount: assessment.cycleCount,
      staleBindingCount,
      staleHierarchyCount,
      staleMvpSliceDefinitionCount,
      staleImplementationUnitModelCount,
      unresolvedQuestionCount,
      reviewState,
      state: reasons.length === 0 ? "candidate-complete" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary: "dependency-mapping-status-is-observational-and-does-not-establish-dependency-truth-or-completeness-critical-path-authority-sequencing-commitment-ownership-appointment-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<DependencyMappingProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Dependency Mapping projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "dependency-mapping-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        graphDigest: candidate.graphDigest, criticalPathDigest: candidate.criticalPathDigest,
        assessmentReceiptDigest: candidate.assessmentReceiptDigest, nodeCount: candidate.nodes.length,
        edgeCount: candidate.edges.length, criticalPathUnitCount: candidate.criticalPath.orderedUnitIds.length,
        criticalPathCandidateEffortPoints: candidate.criticalPath.totalCandidateEffortPoints,
        reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary: "projection-contains-record-identities-counts-statuses-and-graph-critical-path-assessment-snapshot-digests-only-not-unit-node-edge-evidence-rationale-estimate-owner-repository-module-requirement-architecture-risk-test-or-personal-data-secrets-credentials-or-machine-paths" as const,
      authorityBoundary: "dependency-mapping-projection-is-read-only-and-does-not-establish-dependency-truth-or-completeness-critical-path-authority-sequencing-commitment-ownership-appointment-implementation-readiness-or-completeness-assignment-execution-approval-acceptance-merge-release-deployment-or-action-authority" as const,
    }
    return dependencyMappingProjectionSchema.parse({ ...projectionWithoutDigest, snapshotDigest: canonicalDigest(projectionWithoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("dependency-mappings", currentRecordPattern, dependencyMappingSchema)
    for (const candidate of records) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Dependency Mapping candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount + status.staleHierarchyCount + status.staleMvpSliceDefinitionCount +
            status.staleImplementationUnitModelCount + status.missingNodeCount + status.missingDeclaredEdgeCount +
            status.extraEdgeCount + status.invalidNodeCount + status.invalidEdgeCount + status.cycleCount > 0) {
          issues.push({
            code: "dependency-mapping.binding-review-required", severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale or invalid Dependency Mapping bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "dependency-mapping.invalid", severity: "error",
          message: `Dependency Mapping ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private assessGraph(input: Pick<DependencyMappingInput, "nodes" | "edges" | "criticalPathPolicy">, units: ImplementationUnitModel): GraphAssessment {
    const expectedNodeIds = units.units.map((unit) => unit.id)
    const expectedNodeSet = new Set(expectedNodeIds)
    const actualNodeSet = new Set(input.nodes.map((node) => node.implementationUnitId))
    const missingNodeCount = expectedNodeIds.filter((id) => !actualNodeSet.has(id)).length
    let invalidNodeCount = input.nodes.filter((node) => !expectedNodeSet.has(node.implementationUnitId)).length
    for (const [index, node] of input.nodes.entries()) {
      if (expectedNodeIds[index] !== node.implementationUnitId) invalidNodeCount += 1
    }
    const expectedPairs = new Set(units.units.flatMap((unit) =>
      unit.dependencyUnitIds.map((dependencyId) => `${dependencyId}:${unit.id}`)))
    const actualPairs = new Set(input.edges.map((edge) => `${edge.predecessorUnitId}:${edge.successorUnitId}`))
    const missingDeclaredEdgeCount = [...expectedPairs].filter((pair) => !actualPairs.has(pair)).length
    const extraEdgeCount = [...actualPairs].filter((pair) => !expectedPairs.has(pair)).length
    const invalidEdgeCount = input.edges.filter((edge) =>
      !actualNodeSet.has(edge.predecessorUnitId) || !actualNodeSet.has(edge.successorUnitId) ||
      edge.evidenceState === "not-assessed").length
    const incoming = new Map(input.nodes.map((node) => [node.implementationUnitId, 0]))
    const outgoing = new Map(input.nodes.map((node) => [node.implementationUnitId, 0]))
    for (const edge of input.edges) {
      incoming.set(edge.successorUnitId, (incoming.get(edge.successorUnitId) ?? 0) + 1)
      outgoing.set(edge.predecessorUnitId, (outgoing.get(edge.predecessorUnitId) ?? 0) + 1)
    }
    let criticalPath: CriticalPath
    let cycleCount = 0
    try {
      criticalPath = this.composeCriticalPath(input)
    } catch {
      cycleCount = 1
      criticalPath = this.singleNodeCriticalPath(input.nodes[0]!)
    }
    return {
      missingNodeCount, missingDeclaredEdgeCount, extraEdgeCount, invalidNodeCount, invalidEdgeCount, cycleCount,
      rootNodeCount: [...incoming.values()].filter((count) => count === 0).length,
      leafNodeCount: [...outgoing.values()].filter((count) => count === 0).length,
      criticalPath,
    }
  }

  private requireValidGraph(input: DependencyMappingInput, assessment: GraphAssessment): void {
    if (input.reviewState === "ready-for-human-review" &&
        (assessment.missingNodeCount + assessment.missingDeclaredEdgeCount + assessment.extraEdgeCount +
         assessment.invalidNodeCount + assessment.invalidEdgeCount + assessment.cycleCount > 0)) {
      throw new Error("Review-ready Dependency Mapping must cover every exact implementation unit and declared dependency with one valid acyclic graph")
    }
  }

  private composeCriticalPath(input: Pick<DependencyMappingInput, "nodes" | "edges" | "criticalPathPolicy">): CriticalPath {
    const nodeById = new Map(input.nodes.map((node) => [node.implementationUnitId, node]))
    const ordinalById = new Map(input.nodes.map((node) => [node.implementationUnitId, node.ordinal]))
    const indegree = new Map(input.nodes.map((node) => [node.implementationUnitId, 0]))
    const successors = new Map(input.nodes.map((node) => [node.implementationUnitId, [] as string[]]))
    const predecessors = new Map(input.nodes.map((node) => [node.implementationUnitId, [] as string[]]))
    for (const edge of input.edges) {
      indegree.set(edge.successorUnitId, (indegree.get(edge.successorUnitId) ?? 0) + 1)
      successors.get(edge.predecessorUnitId)?.push(edge.successorUnitId)
      predecessors.get(edge.successorUnitId)?.push(edge.predecessorUnitId)
    }
    const byOrdinal = (left: string, right: string) => (ordinalById.get(left) ?? 0) - (ordinalById.get(right) ?? 0)
    for (const values of successors.values()) values.sort(byOrdinal)
    for (const values of predecessors.values()) values.sort(byOrdinal)
    const ready = input.nodes.filter((node) => indegree.get(node.implementationUnitId) === 0)
      .map((node) => node.implementationUnitId).sort(byOrdinal)
    const topological: string[] = []
    while (ready.length > 0) {
      const id = ready.shift()!
      topological.push(id)
      for (const successor of successors.get(id) ?? []) {
        const next = (indegree.get(successor) ?? 0) - 1
        indegree.set(successor, next)
        if (next === 0) {
          ready.push(successor)
          ready.sort(byOrdinal)
        }
      }
    }
    if (topological.length !== input.nodes.length) throw new Error("Dependency Mapping graph contains a cycle")
    const best = new Map<string, { effort: number; path: string[] }>()
    for (const id of topological) {
      const effort = nodeById.get(id)!.candidateEffortPoints
      const options = (predecessors.get(id) ?? []).map((predecessor) => best.get(predecessor)!)
      const prior = options.sort((left, right) => this.comparePathCandidates(left, right, ordinalById))[0]
      best.set(id, prior ? { effort: prior.effort + effort, path: [...prior.path, id] } : { effort, path: [id] })
    }
    const selected = [...best.values()].sort((left, right) => this.comparePathCandidates(left, right, ordinalById))[0]!
    const definition = {
      algorithm: input.criticalPathPolicy.algorithm,
      tieBreak: input.criticalPathPolicy.tieBreak,
      orderedUnitIds: selected.path,
      totalCandidateEffortPoints: selected.effort,
    }
    return { ...definition, pathDigest: canonicalDigest(definition) }
  }

  private comparePathCandidates(
    left: { effort: number; path: string[] },
    right: { effort: number; path: string[] },
    ordinalById: Map<string, number>,
  ): number {
    if (left.effort !== right.effort) return right.effort - left.effort
    const maximum = Math.max(left.path.length, right.path.length)
    for (let index = 0; index < maximum; index++) {
      const difference = (ordinalById.get(left.path[index] ?? "") ?? Number.MAX_SAFE_INTEGER) -
        (ordinalById.get(right.path[index] ?? "") ?? Number.MAX_SAFE_INTEGER)
      if (difference !== 0) return difference
    }
    return left.path.length - right.path.length
  }

  private singleNodeCriticalPath(node: DependencyMappingInput["nodes"][number]): CriticalPath {
    const definition = {
      algorithm: "longest-candidate-effort-path-v1" as const,
      tieBreak: "canonical-unit-ordinal-v1" as const,
      orderedUnitIds: [node.implementationUnitId],
      totalCandidateEffortPoints: node.candidateEffortPoints,
    }
    return { ...definition, pathDigest: canonicalDigest(definition) }
  }

  private emptyAssessment(): GraphAssessment {
    const placeholder = {
      implementationUnitId: "00000000-0000-4000-8000-000000000000",
      ordinal: 1,
      candidateEffortPoints: 1,
      estimateState: "candidate-not-validated" as const,
      evidenceReferences: [],
      assessedBy: { kind: "human" as const, id: "not-assessed" },
      assessedAt: "1970-01-01T00:00:00.000Z",
    }
    return {
      missingNodeCount: 0, missingDeclaredEdgeCount: 0, extraEdgeCount: 0,
      invalidNodeCount: 0, invalidEdgeCount: 0, cycleCount: 0, rootNodeCount: 0, leafNodeCount: 0,
      criticalPath: this.singleNodeCriticalPath(placeholder),
    }
  }

  private composeDigests(input: DependencyMappingInput, criticalPath: CriticalPath) {
    const graphDigest = canonicalDigest({ nodes: input.nodes, edges: input.edges, criticalPathPolicy: input.criticalPathPolicy })
    const criticalPathDigest = canonicalDigest(criticalPath)
    const assessmentReceiptDigest = canonicalDigest({
      context: input.context, hierarchy: input.hierarchy, mvpSliceDefinition: input.mvpSliceDefinition,
      implementationUnitModel: input.implementationUnitModel, graphDigest, criticalPathDigest,
      reviewState: input.reviewState, unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations,
      dependencyTruthState: input.dependencyTruthState, dependencyCompletenessState: input.dependencyCompletenessState,
      criticalPathAuthorityState: input.criticalPathAuthorityState,
      sequencingCommitmentState: input.sequencingCommitmentState,
      ownershipAppointmentState: input.ownershipAppointmentState,
      implementationReadinessState: input.implementationReadinessState,
      implementationCompletenessState: input.implementationCompletenessState,
      assignmentExecutionState: input.assignmentExecutionState, approvalState: input.approvalState,
      acceptanceDecisionState: input.acceptanceDecisionState, mergeReadinessState: input.mergeReadinessState,
      releaseReadinessState: input.releaseReadinessState, deploymentReadinessState: input.deploymentReadinessState,
      actionAuthorityState: input.actionAuthorityState,
    })
    return { graphDigest, criticalPathDigest, assessmentReceiptDigest }
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Dependency Mapping Initiative targets a different Product")
    if (canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) {
      throw new Error("Dependency Mapping must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
  }

  private async requireExactDependencies(input: DependencyMappingInput, initiative: Initiative): Promise<ExactDependencies> {
    const [hierarchy, mvp, units] = await Promise.all([
      this.backlogHierarchy.readCurrent(initiative.id), this.mvpSliceDefinition.readCurrent(initiative.id),
      this.implementationUnitModel.readCurrent(initiative.id),
    ])
    if (!this.matches(input.hierarchy, hierarchy)) throw new Error("Dependency Mapping must reference the exact current Backlog Hierarchy candidate")
    if (!this.matches(input.mvpSliceDefinition, mvp)) throw new Error("Dependency Mapping must reference the exact current MVP and Slice Definition candidate")
    if (!this.matches(input.implementationUnitModel, units)) throw new Error("Dependency Mapping must reference the exact current Implementation Unit Model candidate")
    return { hierarchy: hierarchy!, mvp: mvp!, units: units! }
  }

  private matches(reference: { recordId: string; revision: number; digest: string }, record: { id: string; revision: number } | undefined): boolean {
    return !!record && record.id === reference.recordId && record.revision === reference.revision && canonicalDigest(record) === reference.digest
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Dependency Mapping is immutable`)
    return { product, initiative }
  }

  private async commitVersionedRecord(record: DependencyMapping, assessment: GraphAssessment, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, dependencyMappingSchema),
        this.governed(this.historyPath(record.id, record.revision), record, dependencyMappingSchema),
      ],
      audit: {
        eventType, actor: { kind: "human", id: actorId }, subjectId: record.id,
        payload: {
          initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record),
          graphDigest: record.graphDigest, criticalPathDigest: record.criticalPathDigest,
          assessmentReceiptDigest: record.assessmentReceiptDigest, predecessorDigest: record.predecessorDigest,
          hierarchy: record.hierarchy, mvpSliceDefinition: record.mvpSliceDefinition,
          implementationUnitModel: record.implementationUnitModel, nodeCount: record.nodes.length,
          edgeCount: record.edges.length, requiredEdgeCount: record.edges.filter((edge) => edge.strength === "required").length,
          conditionalEdgeCount: record.edges.filter((edge) => edge.strength === "conditional").length,
          advisoryEdgeCount: record.edges.filter((edge) => edge.strength === "advisory").length,
          rootNodeCount: assessment.rootNodeCount, leafNodeCount: assessment.leafNodeCount,
          criticalPathUnitCount: record.criticalPath.orderedUnitIds.length,
          criticalPathCandidateEffortPoints: record.criticalPath.totalCandidateEffortPoints,
          reviewState: record.reviewState, dependencyTruthState: record.dependencyTruthState,
          dependencyCompletenessState: record.dependencyCompletenessState,
          criticalPathAuthorityState: record.criticalPathAuthorityState,
          sequencingCommitmentState: record.sequencingCommitmentState,
          ownershipAppointmentState: record.ownershipAppointmentState,
          implementationReadinessState: record.implementationReadinessState,
          implementationCompletenessState: record.implementationCompletenessState,
          assignmentExecutionState: record.assignmentExecutionState, approvalState: record.approvalState,
          acceptanceDecisionState: record.acceptanceDecisionState, mergeReadinessState: record.mergeReadinessState,
          releaseReadinessState: record.releaseReadinessState, deploymentReadinessState: record.deploymentReadinessState,
          actionAuthorityState: record.actionAuthorityState, authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string { return this.repository.resolve("dependency-mappings", `${id}.json`) }
  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("dependency-mapping-history", `dependency-mapping-${id}-r${revision}.json`)
  }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string {
    const parsed = uuidSchema.safeParse(value)
    if (!parsed.success) throw new Error(`${label} must be a UUID`)
    return parsed.data
  }
  private async assertIntegrity(): Promise<void> {
    const integrity = await this.repository.verifyAudit()
    if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed")
  }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try {
      names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name))
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return []
      throw error
    }
    if (names.length > inventoryLimit) throw new Error(`Dependency Mapping directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
