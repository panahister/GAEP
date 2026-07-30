import { randomUUID } from "node:crypto"

import {
  backlogHierarchyInputSchema,
  backlogHierarchyProjectionSchema,
  backlogHierarchySchema,
  backlogHierarchyStatusSchema,
  type BacklogHierarchy,
  type BacklogHierarchyInput,
  type BacklogHierarchyProjection,
  type BacklogHierarchyStatus,
  type BusinessContextBinding,
  type Initiative,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { ProductStudioService } from "./product-studio.js"
import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: BacklogHierarchy) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: BacklogHierarchyInput) {
  return {
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
  }
}

export class BacklogHierarchyService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly productStudio: ProductStudioService,
  ) {}

  async create(inputValue: BacklogHierarchyInput, actorId: string): Promise<BacklogHierarchy> {
    const input = backlogHierarchyInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateDomainReferences(input, product, initiative)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Backlog Hierarchy candidate")
      }
      const now = new Date().toISOString()
      const record = backlogHierarchySchema.parse({
        schemaVersion: 1,
        kind: "backlog-hierarchy-candidate",
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
          "backlog-hierarchy-is-a-versioned-candidate-overlay-on-exact-work-items-not-priority-commitment-ownership-ready-done-implementation-readiness-assignment-execution-or-action-authority",
      })
      await this.commitVersionedRecord(record, "backlog-hierarchy.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: BacklogHierarchyInput,
    actorId: string,
  ): Promise<BacklogHierarchy> {
    const input = backlogHierarchyInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Backlog Hierarchy revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Backlog Hierarchy Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateDomainReferences(input, product, initiative)
      const record = backlogHierarchySchema.parse({
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
      await this.commitVersionedRecord(record, "backlog-hierarchy.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<BacklogHierarchy> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Backlog Hierarchy ID")), backlogHierarchySchema)
  }

  async readCurrent(initiativeId: string): Promise<BacklogHierarchy | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("backlog-hierarchies", currentRecordPattern, backlogHierarchySchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Backlog Hierarchy candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<BacklogHierarchy> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Backlog Hierarchy history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Backlog Hierarchy ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), backlogHierarchySchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Backlog Hierarchy history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<BacklogHierarchy[]> {
    const recordId = this.requireUuid(id, "Backlog Hierarchy ID")
    const records = await this.listRecords(
      "backlog-hierarchy-history",
      new RegExp(`^backlog-hierarchy-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      backlogHierarchySchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Backlog Hierarchy history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<BacklogHierarchyStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const nodes = candidate?.nodes ?? []
    let staleBindingCount = 0
    let staleWorkItemCount = 0
    let staleChangeCount = 0
    let staleRequirementCount = 0
    if (candidate && canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative))) {
      staleBindingCount += 1
    }
    for (const node of nodes) {
      try {
        const workItem = await this.productStudio.readWorkItem(node.workItem.recordId)
        if (workItem.productId !== product.id || workItem.changeId !== node.change.recordId ||
            workItem.revision !== node.workItem.revision || canonicalDigest(workItem) !== node.workItem.digest) {
          staleWorkItemCount += 1
        }
      } catch {
        staleWorkItemCount += 1
      }
      try {
        const change = await this.productStudio.readChange(node.change.recordId)
        if (change.productId !== product.id || change.initiativeId !== initiative.id ||
            revisionOf(change) !== node.change.revision || canonicalDigest(change) !== node.change.digest) {
          staleChangeCount += 1
        }
      } catch {
        staleChangeCount += 1
      }
      for (const reference of node.requirements) {
        try {
          const requirement = await this.productStudio.readRequirement(reference.recordId)
          if (requirement.productId !== product.id || requirement.key !== reference.key ||
              requirement.revision !== reference.revision || canonicalDigest(requirement) !== reference.digest ||
              requirement.state === "rejected") {
            staleRequirementCount += 1
          }
        } catch {
          staleRequirementCount += 1
        }
      }
    }
    const levelCount = (level: "epic" | "feature" | "story" | "task") =>
      nodes.filter((node) => node.level === level).length
    const parentIds = new Set(nodes.flatMap((node) => node.parentId ? [node.parentId] : []))
    const requirementTraceCount = nodes.reduce((count, node) => count + node.requirements.length, 0)
    const untracedStoryTaskCount = nodes.filter((node) =>
      (node.level === "story" || node.level === "task") && node.requirements.length === 0).length
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const hierarchyCompletenessState = candidate?.hierarchyCompletenessState ?? "not-assessed"
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Backlog Hierarchy candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind the exact current Product and Initiative")
    if (staleWorkItemCount > 0) reasons.push("One or more hierarchy nodes reference a missing or superseded Work Item")
    if (staleChangeCount > 0) reasons.push("One or more hierarchy nodes reference a missing, superseded, or out-of-Initiative Change")
    if (staleRequirementCount > 0) reasons.push("One or more Story or Task traces reference a missing, superseded, rejected, or out-of-Product Requirement")
    if (untracedStoryTaskCount > 0) reasons.push("One or more Story or Task nodes lack an exact Requirement trace")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved hierarchy questions")
    if (candidate && hierarchyCompletenessState !== "candidate-complete") reasons.push("The hierarchy is not marked candidate-complete")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The hierarchy is not marked ready for human review")
    return backlogHierarchyStatusSchema.parse({
      schemaVersion: 1,
      kind: "backlog-hierarchy-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      nodeCount: nodes.length,
      epicCount: levelCount("epic"),
      featureCount: levelCount("feature"),
      storyCount: levelCount("story"),
      taskCount: levelCount("task"),
      rootCount: nodes.filter((node) => node.level === "epic").length,
      leafCount: nodes.filter((node) => !parentIds.has(node.id)).length,
      requirementTraceCount,
      untracedStoryTaskCount,
      staleBindingCount,
      staleWorkItemCount,
      staleChangeCount,
      staleRequirementCount,
      unresolvedQuestionCount,
      hierarchyCompletenessState,
      reviewState,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "backlog-hierarchy-status-is-observational-and-does-not-establish-priority-commitment-ownership-ready-done-implementation-readiness-assignment-execution-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<BacklogHierarchyProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Backlog Hierarchy projection context changed while governed records were read")
    }
    const levelCount = (level: "epic" | "feature" | "story" | "task") =>
      candidate?.nodes.filter((node) => node.level === level).length ?? 0
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "backlog-hierarchy-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        state: candidate.state,
        nodeCount: candidate.nodes.length,
        epicCount: levelCount("epic"),
        featureCount: levelCount("feature"),
        storyCount: levelCount("story"),
        taskCount: levelCount("task"),
        requirementTraceCount: candidate.nodes.reduce((count, node) => count + node.requirements.length, 0),
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-level-counts-statuses-and-digests-only-not-backlog-objectives-criteria-scope-owner-requirement-content-personal-data-secrets-credentials-or-machine-paths" as const,
      authorityBoundary:
        "backlog-hierarchy-projection-is-read-only-and-does-not-prioritize-commit-assign-admit-execute-or-authorize-implementation-or-action" as const,
    }
    return backlogHierarchyProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("backlog-hierarchies", currentRecordPattern, backlogHierarchySchema)
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) {
          throw new Error("Backlog Hierarchy membership digest is invalid")
        }
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Backlog Hierarchy candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleWorkItemCount > 0 ||
            status.staleChangeCount > 0 || status.staleRequirementCount > 0) {
          issues.push({
            code: "backlog-hierarchy.binding-review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale Backlog Hierarchy bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "backlog-hierarchy.invalid",
          severity: "error",
          message: `Backlog Hierarchy ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Backlog Hierarchy Initiative targets a different Product")
    if (canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) {
      throw new Error("Backlog Hierarchy must bind the exact current Product and Initiative revisions and digests")
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

  private async validateDomainReferences(
    input: BacklogHierarchyInput,
    product: Product,
    initiative: Initiative,
  ): Promise<void> {
    for (const node of input.nodes) {
      const workItem = await this.productStudio.readWorkItem(node.workItem.recordId)
      if (workItem.productId !== product.id || workItem.changeId !== node.change.recordId ||
          workItem.revision !== node.workItem.revision || canonicalDigest(workItem) !== node.workItem.digest) {
        throw new Error("Backlog Hierarchy nodes must reference exact current Work Items from the same Product and declared Change")
      }
      const change = await this.productStudio.readChange(node.change.recordId)
      if (change.productId !== product.id || change.initiativeId !== initiative.id ||
          revisionOf(change) !== node.change.revision || canonicalDigest(change) !== node.change.digest) {
        throw new Error("Backlog Hierarchy nodes must reference exact current Changes from the same Product and Initiative")
      }
      for (const reference of node.requirements) {
        const requirement = await this.productStudio.readRequirement(reference.recordId)
        if (requirement.productId !== product.id || requirement.key !== reference.key ||
            requirement.revision !== reference.revision || canonicalDigest(requirement) !== reference.digest) {
          throw new Error("Backlog Hierarchy Story and Task traces must reference exact current Product Requirements")
        }
        if (requirement.state === "rejected") {
          throw new Error("Rejected Requirements cannot be represented in a current Backlog Hierarchy")
        }
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Backlog Hierarchy guidance is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: BacklogHierarchy, eventType: string, actorId: string): Promise<void> {
    const levelCounts = Object.fromEntries(["epic", "feature", "story", "task"].map((level) => [
      level, record.nodes.filter((node) => node.level === level).length,
    ]))
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, backlogHierarchySchema),
        this.governed(this.historyPath(record.id, record.revision), record, backlogHierarchySchema),
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
          nodeCount: record.nodes.length,
          nodeCatalogDigest: canonicalDigest(record.nodes.map((node) => ({
            id: node.id,
            key: node.key,
            level: node.level,
            workItem: node.workItem,
            change: node.change,
            parentId: node.parentId,
            ordinal: node.ordinal,
            requirements: node.requirements,
          }))),
          levelCounts,
          requirementTraceCount: record.nodes.reduce((count, node) => count + node.requirements.length, 0),
          hierarchyCompletenessState: record.hierarchyCompletenessState,
          reviewState: record.reviewState,
          prioritizationState: record.prioritizationState,
          backlogCommitmentState: record.backlogCommitmentState,
          ownershipAuthorityState: record.ownershipAuthorityState,
          readyDoneState: record.readyDoneState,
          implementationReadinessState: record.implementationReadinessState,
          implementationAuthorityState: record.implementationAuthorityState,
          assignmentState: "not-established",
          executionState: "not-established",
          actionAuthorityState: "not-granted",
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("backlog-hierarchies", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("backlog-hierarchy-history", `backlog-hierarchy-${id}-r${revision}.json`)
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
    if (names.length > inventoryLimit) throw new Error(`Backlog Hierarchy directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
