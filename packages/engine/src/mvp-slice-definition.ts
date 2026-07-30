import { randomUUID } from "node:crypto"

import {
  mvpSliceDefinitionInputSchema,
  mvpSliceDefinitionProjectionSchema,
  mvpSliceDefinitionSchema,
  mvpSliceDefinitionStatusSchema,
  type BacklogHierarchy,
  type BusinessContextBinding,
  type Initiative,
  type MvpSliceDefinition,
  type MvpSliceDefinitionInput,
  type MvpSliceDefinitionProjection,
  type MvpSliceDefinitionStatus,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { BacklogHierarchyService } from "./backlog-hierarchy.js"
import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: MvpSliceDefinition) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: MvpSliceDefinitionInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    hierarchy: input.hierarchy,
    scopeEntries: input.scopeEntries,
    slices: input.slices,
    scopeCompletenessState: input.scopeCompletenessState,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    prioritizationState: input.prioritizationState,
    backlogCommitmentState: input.backlogCommitmentState,
    scopeApprovalState: input.scopeApprovalState,
    acceptanceCriteriaValidityState: input.acceptanceCriteriaValidityState,
    readyDoneState: input.readyDoneState,
    implementationReadinessState: input.implementationReadinessState,
    assignmentExecutionState: input.assignmentExecutionState,
    implementationAuthorityState: input.implementationAuthorityState,
  }
}

type DefinitionCounts = {
  invalidScopeCount: number
  invalidSliceCount: number
  unassignedMvpStoryTaskCount: number
}

export class MvpSliceDefinitionService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly backlogHierarchy: BacklogHierarchyService,
  ) {}

  async create(inputValue: MvpSliceDefinitionInput, actorId: string): Promise<MvpSliceDefinition> {
    const input = mvpSliceDefinitionInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const hierarchy = await this.requireExactHierarchy(input, initiative)
      this.requireValidDefinition(input, hierarchy)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current MVP and Slice Definition candidate")
      }
      const now = new Date().toISOString()
      const record = mvpSliceDefinitionSchema.parse({
        schemaVersion: 1,
        kind: "mvp-slice-definition-candidate",
        id: randomUUID(),
        productId: product.id,
        ...input,
        initiativeId: initiative.id,
        revision: 1,
        membershipDigest: canonicalDigest(membership(input)),
        state: "candidate",
        createdBy: { kind: "human", id: actorId },
        updatedBy: { kind: "human", id: actorId },
        createdAt: now,
        updatedAt: now,
        authorityBoundary:
          "mvp-slice-definition-is-a-versioned-candidate-scope-over-an-exact-backlog-hierarchy-not-priority-commitment-scope-approval-acceptance-criteria-validity-ready-done-implementation-readiness-assignment-execution-or-action-authority",
      })
      await this.commitVersionedRecord(record, "mvp-slice-definition.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: MvpSliceDefinitionInput,
    actorId: string,
  ): Promise<MvpSliceDefinition> {
    const input = mvpSliceDefinitionInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("MVP and Slice Definition revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("MVP and Slice Definition Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const hierarchy = await this.requireExactHierarchy(input, initiative)
      this.requireValidDefinition(input, hierarchy)
      const record = mvpSliceDefinitionSchema.parse({
        ...current,
        ...input,
        productId: product.id,
        initiativeId: initiative.id,
        revision: current.revision + 1,
        membershipDigest: canonicalDigest(membership(input)),
        predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId },
        updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, "mvp-slice-definition.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<MvpSliceDefinition> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "MVP and Slice Definition ID")), mvpSliceDefinitionSchema)
  }

  async readCurrent(initiativeId: string): Promise<MvpSliceDefinition | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("mvp-slice-definitions", currentRecordPattern, mvpSliceDefinitionSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current MVP and Slice Definition candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<MvpSliceDefinition> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("MVP and Slice Definition history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "MVP and Slice Definition ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), mvpSliceDefinitionSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("MVP and Slice Definition history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<MvpSliceDefinition[]> {
    const recordId = this.requireUuid(id, "MVP and Slice Definition ID")
    const records = await this.listRecords(
      "mvp-slice-definition-history",
      new RegExp(`^mvp-slice-definition-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      mvpSliceDefinitionSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("MVP and Slice Definition history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<MvpSliceDefinitionStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, hierarchy] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), this.backlogHierarchy.readCurrent(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    let staleBindingCount = 0
    let staleHierarchyCount = 0
    let invalidScopeCount = 0
    let invalidSliceCount = 0
    let unassignedMvpStoryTaskCount = 0
    if (candidate && canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative))) {
      staleBindingCount += 1
    }
    if (candidate) {
      if (!hierarchy || hierarchy.id !== candidate.hierarchy.recordId ||
          hierarchy.revision !== candidate.hierarchy.revision || canonicalDigest(hierarchy) !== candidate.hierarchy.digest) {
        staleHierarchyCount = 1
      } else {
        const counts = this.definitionCounts(candidate, hierarchy)
        invalidScopeCount = counts.invalidScopeCount
        invalidSliceCount = counts.invalidSliceCount
        unassignedMvpStoryTaskCount = counts.unassignedMvpStoryTaskCount
      }
    }
    const scopeEntries = candidate?.scopeEntries ?? []
    const slices = candidate?.slices ?? []
    const dispositionCount = (disposition: "mvp" | "later" | "excluded") =>
      scopeEntries.filter((entry) => entry.disposition === disposition).length
    const storyIds = new Set(slices.flatMap((slice) => slice.storyNodeIds))
    const taskIds = new Set(slices.flatMap((slice) => slice.taskNodeIds))
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const scopeCompletenessState = candidate?.scopeCompletenessState ?? "not-assessed"
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned MVP and Slice Definition candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind the exact current Product and Initiative")
    if (staleHierarchyCount > 0) reasons.push("The candidate does not bind the exact current Backlog Hierarchy")
    if (invalidScopeCount > 0) reasons.push("One or more MVP scope entries do not match the exact Backlog Hierarchy")
    if (invalidSliceCount > 0) reasons.push("One or more Vertical Slices violate exact hierarchy or dependency rules")
    if (unassignedMvpStoryTaskCount > 0) reasons.push("One or more MVP Story or Task nodes are not assigned to exactly one Vertical Slice")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved MVP or slice questions")
    if (candidate && scopeCompletenessState !== "candidate-complete") reasons.push("The MVP scope is not marked candidate-complete")
    if (candidate && slices.some((slice) => slice.testabilityState !== "candidate-testable")) {
      reasons.push("One or more Vertical Slices are not marked candidate-testable")
    }
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return mvpSliceDefinitionStatusSchema.parse({
      schemaVersion: 1,
      kind: "mvp-slice-definition-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate), hierarchy: candidate.hierarchy } : {}),
      scopeNodeCount: scopeEntries.length,
      mvpNodeCount: dispositionCount("mvp"),
      laterNodeCount: dispositionCount("later"),
      excludedNodeCount: dispositionCount("excluded"),
      sliceCount: slices.length,
      storyCount: storyIds.size,
      taskCount: taskIds.size,
      dependencyCount: slices.reduce((count, slice) => count + slice.dependencySliceIds.length, 0),
      unassignedMvpStoryTaskCount,
      staleBindingCount,
      staleHierarchyCount,
      invalidScopeCount,
      invalidSliceCount,
      unresolvedQuestionCount,
      scopeCompletenessState,
      reviewState,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "mvp-slice-definition-status-is-observational-and-does-not-establish-priority-commitment-scope-approval-acceptance-criteria-validity-ready-done-implementation-readiness-assignment-execution-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<MvpSliceDefinitionProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("MVP and Slice Definition projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "mvp-slice-definition-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        hierarchyDigest: candidate.hierarchy.digest,
        state: candidate.state,
        scopeNodeCount: candidate.scopeEntries.length,
        mvpNodeCount: candidate.scopeEntries.filter((entry) => entry.disposition === "mvp").length,
        laterNodeCount: candidate.scopeEntries.filter((entry) => entry.disposition === "later").length,
        excludedNodeCount: candidate.scopeEntries.filter((entry) => entry.disposition === "excluded").length,
        sliceCount: candidate.slices.length,
        storyCount: new Set(candidate.slices.flatMap((slice) => slice.storyNodeIds)).size,
        taskCount: new Set(candidate.slices.flatMap((slice) => slice.taskNodeIds)).size,
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-scope-and-slice-counts-statuses-and-digests-only-not-slice-titles-rationales-objectives-criteria-scope-content-requirement-content-personal-data-secrets-credentials-or-machine-paths" as const,
      authorityBoundary:
        "mvp-slice-definition-projection-is-read-only-and-does-not-prioritize-commit-approve-scope-admit-assign-execute-or-authorize-implementation-or-action" as const,
    }
    return mvpSliceDefinitionProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("mvp-slice-definitions", currentRecordPattern, mvpSliceDefinitionSchema)
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) {
          throw new Error("MVP and Slice Definition membership digest is invalid")
        }
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current MVP and Slice Definition candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleHierarchyCount > 0 ||
            status.invalidScopeCount > 0 || status.invalidSliceCount > 0) {
          issues.push({
            code: "mvp-slice-definition.binding-review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale or invalid MVP and Slice Definition bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "mvp-slice-definition.invalid",
          severity: "error",
          message: `MVP and Slice Definition ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("MVP and Slice Definition Initiative targets a different Product")
    if (canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) {
      throw new Error("MVP and Slice Definition must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return {
      productRevision: revisionOf(product),
      productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative),
      initiativeDigest: canonicalDigest(initiative),
    }
  }

  private async requireExactHierarchy(input: MvpSliceDefinitionInput, initiative: Initiative): Promise<BacklogHierarchy> {
    const hierarchy = await this.backlogHierarchy.readCurrent(initiative.id)
    if (!hierarchy || hierarchy.id !== input.hierarchy.recordId || hierarchy.revision !== input.hierarchy.revision ||
        canonicalDigest(hierarchy) !== input.hierarchy.digest) {
      throw new Error("MVP and Slice Definition must reference the exact current Backlog Hierarchy candidate")
    }
    return hierarchy
  }

  private requireValidDefinition(input: MvpSliceDefinitionInput, hierarchy: BacklogHierarchy): void {
    const counts = this.definitionCounts(input, hierarchy)
    if (counts.invalidScopeCount > 0) {
      throw new Error("MVP scope must classify every exact Backlog Hierarchy node once in canonical hierarchy order")
    }
    if (counts.invalidSliceCount > 0) {
      throw new Error("Vertical Slices must contain exact MVP Stories and their exact child Tasks with valid earlier-only dependencies")
    }
    if (counts.unassignedMvpStoryTaskCount > 0) {
      throw new Error("Every MVP Story and Task must belong to exactly one Vertical Slice")
    }
  }

  private definitionCounts(input: MvpSliceDefinitionInput, hierarchy: BacklogHierarchy): DefinitionCounts {
    let invalidScopeCount = 0
    let invalidSliceCount = 0
    const hierarchyById = new Map(hierarchy.nodes.map((node) => [node.id, node]))
    const scopeById = new Map(input.scopeEntries.map((entry) => [entry.nodeId, entry]))
    if (input.scopeEntries.length !== hierarchy.nodes.length) invalidScopeCount += 1
    for (const [index, node] of hierarchy.nodes.entries()) {
      const entry = input.scopeEntries[index]
      if (!entry || entry.nodeId !== node.id || entry.key !== node.key || entry.level !== node.level || entry.ordinal !== node.ordinal) {
        invalidScopeCount += 1
      }
    }
    for (const entry of input.scopeEntries) if (!hierarchyById.has(entry.nodeId)) invalidScopeCount += 1

    const mvpDeliveryIds = new Set(input.scopeEntries
      .filter((entry) => entry.disposition === "mvp" && (entry.level === "story" || entry.level === "task"))
      .map((entry) => entry.nodeId))
    const assignedIds: string[] = []
    for (const slice of input.slices) {
      const storyIds = new Set(slice.storyNodeIds)
      for (const id of [...slice.storyNodeIds, ...slice.taskNodeIds]) {
        assignedIds.push(id)
        const node = hierarchyById.get(id)
        const scope = scopeById.get(id)
        if (!node || !scope || scope.disposition !== "mvp" ||
            (slice.storyNodeIds.includes(id) && node.level !== "story") ||
            (slice.taskNodeIds.includes(id) && node.level !== "task")) invalidSliceCount += 1
      }
      for (const taskId of slice.taskNodeIds) {
        const task = hierarchyById.get(taskId)
        if (!task?.parentId || !storyIds.has(task.parentId)) invalidSliceCount += 1
      }
    }
    const assignedSet = new Set(assignedIds)
    if (assignedSet.size !== assignedIds.length) invalidSliceCount += assignedIds.length - assignedSet.size
    for (const entry of input.scopeEntries.filter((value) => value.disposition === "mvp")) {
      let node = hierarchyById.get(entry.nodeId)
      while (node?.parentId) {
        const parentScope = scopeById.get(node.parentId)
        if (parentScope?.disposition !== "mvp") invalidScopeCount += 1
        node = hierarchyById.get(node.parentId)
      }
    }
    const unassignedMvpStoryTaskCount = [...mvpDeliveryIds].filter((id) => !assignedSet.has(id)).length
    for (const id of assignedSet) if (!mvpDeliveryIds.has(id)) invalidSliceCount += 1
    return { invalidScopeCount, invalidSliceCount, unassignedMvpStoryTaskCount }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} MVP and Slice Definition guidance is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: MvpSliceDefinition, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, mvpSliceDefinitionSchema),
        this.governed(this.historyPath(record.id, record.revision), record, mvpSliceDefinitionSchema),
      ],
      audit: {
        eventType,
        actor: { kind: "human", id: actorId },
        subjectId: record.id,
        payload: {
          initiativeId: record.initiativeId,
          revision: record.revision,
          recordDigest: canonicalDigest(record),
          membershipDigest: record.membershipDigest,
          predecessorDigest: record.predecessorDigest,
          hierarchy: record.hierarchy,
          scopeNodeCount: record.scopeEntries.length,
          scopeCatalogDigest: canonicalDigest(record.scopeEntries.map((entry) => ({
            nodeId: entry.nodeId, key: entry.key, level: entry.level, ordinal: entry.ordinal, disposition: entry.disposition,
          }))),
          sliceCount: record.slices.length,
          sliceCatalogDigest: canonicalDigest(record.slices.map((slice) => ({
            id: slice.id, key: slice.key, ordinal: slice.ordinal, storyNodeIds: slice.storyNodeIds,
            taskNodeIds: slice.taskNodeIds, dependencySliceIds: slice.dependencySliceIds,
            testabilityState: slice.testabilityState,
          }))),
          scopeCompletenessState: record.scopeCompletenessState,
          reviewState: record.reviewState,
          prioritizationState: record.prioritizationState,
          backlogCommitmentState: record.backlogCommitmentState,
          scopeApprovalState: record.scopeApprovalState,
          acceptanceCriteriaValidityState: record.acceptanceCriteriaValidityState,
          readyDoneState: record.readyDoneState,
          implementationReadinessState: record.implementationReadinessState,
          assignmentExecutionState: record.assignmentExecutionState,
          implementationAuthorityState: record.implementationAuthorityState,
          actionAuthorityState: "not-granted",
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("mvp-slice-definitions", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("mvp-slice-definition-history", `mvp-slice-definition-${id}-r${revision}.json`)
  }

  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> {
    return { path, value, schema, governed: true }
  }

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
    if (names.length > inventoryLimit) throw new Error(`MVP and Slice Definition directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
