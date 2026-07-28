import { randomUUID } from "node:crypto"

import {
  designRequirementsInputSchema,
  designRequirementsProjectionSchema,
  designRequirementsSchema,
  designRequirementsStatusSchema,
  exactSourceReferenceSchema,
  type BusinessContextBinding,
  type DesignRequirements,
  type DesignRequirementsInput,
  type DesignRequirementsProjection,
  type DesignRequirementsStatus,
  type ExactSourceReference,
  type Initiative,
  type OutcomeModel,
  type Product,
  type Requirement,
  type ScreenStateInventory,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { BusinessUnderstandingService } from "./business-understanding.js"
import type { ProductStudioService } from "./product-studio.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { ScreenStateInventoryService } from "./screen-state-inventory.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const weakEvidenceStates = new Set(["hypothesis", "disputed"])
const weakVerificationStates = new Set(["not-assessed", "disputed"])

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: DesignRequirements) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: DesignRequirementsInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    outcomeModel: input.outcomeModel,
    screenStateInventory: input.screenStateInventory,
    requirements: input.requirements,
    outcomeCoverage: input.outcomeCoverage,
    catalogCompletenessState: input.catalogCompletenessState,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    priorityApprovalState: input.priorityApprovalState,
    designApprovalState: input.designApprovalState,
    backlogCommitmentState: input.backlogCommitmentState,
    readinessState: input.readinessState,
    implementationAuthorityState: input.implementationAuthorityState,
  }
}

function collectExactSourceReferences(value: unknown, collected: ExactSourceReference[] = []): ExactSourceReference[] {
  if (Array.isArray(value)) {
    for (const item of value) collectExactSourceReferences(item, collected)
    return collected
  }
  if (!value || typeof value !== "object") return collected
  const candidate = exactSourceReferenceSchema.safeParse(value)
  if (candidate.success) {
    collected.push(candidate.data)
    return collected
  }
  for (const child of Object.values(value)) collectExactSourceReferences(child, collected)
  return collected
}

function uniqueExactSourceReferences(value: unknown): ExactSourceReference[] {
  const unique = new Map(collectExactSourceReferences(value).map((reference) => [
    `${reference.sourceId}:${reference.sourceRevision}:${reference.recordDigest}:${reference.contentDigest}`,
    reference,
  ]))
  return [...unique.values()].sort((left, right) =>
    left.sourceId.localeCompare(right.sourceId) || left.sourceRevision - right.sourceRevision)
}

export class DesignRequirementsService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly businessUnderstanding: BusinessUnderstandingService,
    private readonly screenStateInventory: ScreenStateInventoryService,
    private readonly productStudio: ProductStudioService,
  ) {}

  async create(inputValue: DesignRequirementsInput, actorId: string): Promise<DesignRequirements> {
    const input = designRequirementsInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const [outcomeModel, inventory] = await Promise.all([
        this.requireCurrentOutcomeModel(input),
        this.requireCurrentScreenStateInventory(input),
      ])
      this.validateDesignLinks(input, outcomeModel, inventory)
      await this.validateDomainReferences(input, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Design Requirements candidate")
      }
      const now = new Date().toISOString()
      const record = designRequirementsSchema.parse({
        schemaVersion: 1,
        kind: "design-requirements-candidate",
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
          "design-requirements-are-candidate-links-and-do-not-establish-requirement-validity-completeness-priority-approval-satisfaction-backlog-commitment-design-approval-readiness-implementation-or-action-authority",
      })
      await this.commitVersionedRecord(record, "design-requirements.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: DesignRequirementsInput,
    actorId: string,
  ): Promise<DesignRequirements> {
    const input = designRequirementsInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Design Requirements revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Design Requirements Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const [outcomeModel, inventory] = await Promise.all([
        this.requireCurrentOutcomeModel(input),
        this.requireCurrentScreenStateInventory(input),
      ])
      this.validateDesignLinks(input, outcomeModel, inventory)
      await this.validateDomainReferences(input, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      const record = designRequirementsSchema.parse({
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
      await this.commitVersionedRecord(record, "design-requirements.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<DesignRequirements> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Design Requirements ID")), designRequirementsSchema)
  }

  async readCurrent(initiativeId: string): Promise<DesignRequirements | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("design-requirements", currentRecordPattern, designRequirementsSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Design Requirements candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<DesignRequirements> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Design Requirements history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Design Requirements ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), designRequirementsSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Design Requirements history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<DesignRequirements[]> {
    const recordId = this.requireUuid(id, "Design Requirements ID")
    const records = await this.listRecords(
      "design-requirements-history",
      new RegExp(`^design-requirements-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      designRequirementsSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Design Requirements history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<DesignRequirementsStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, outcomeModel, inventory, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.businessUnderstanding.readCurrentOutcomeModel(targetId),
      this.screenStateInventory.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const staleBindingCount = candidate
      ? this.bindingMismatchCount(candidate, product, initiative, outcomeModel, inventory)
      : 0
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(candidate).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const requirements = candidate?.requirements ?? []
    let staleDomainReferenceCount = 0
    const currentRequirementById = new Map<string, Requirement>()
    for (const linked of requirements) {
      try {
        const requirement = await this.productStudio.readRequirement(linked.requirement.recordId)
        currentRequirementById.set(requirement.id, requirement)
        if (requirement.productId !== product.id || requirement.key !== linked.key ||
            requirement.revision !== linked.requirement.revision ||
            canonicalDigest(requirement) !== linked.requirement.digest || requirement.state === "rejected") {
          staleDomainReferenceCount += 1
        }
      } catch {
        staleDomainReferenceCount += 1
      }
      for (const workItemReference of linked.backlog.workItems) {
        try {
          const workItem = await this.productStudio.readWorkItem(workItemReference.recordId)
          const change = await this.productStudio.readChange(workItem.changeId)
          if (workItem.productId !== product.id || change.initiativeId !== initiative.id ||
              workItem.revision !== workItemReference.revision ||
              canonicalDigest(workItem) !== workItemReference.digest) {
            staleDomainReferenceCount += 1
          }
        } catch {
          staleDomainReferenceCount += 1
        }
      }
    }
    const outcomeCoverage = candidate?.outcomeCoverage ?? []
    const weakEvidenceRequirementCount = requirements.filter((entry) =>
      weakEvidenceStates.has(entry.evidence.state) || weakVerificationStates.has(entry.verificationEvidenceState)).length
    const unresolvedOutcomeCount = outcomeCoverage.filter((entry) => entry.status === "unresolved").length
    const unresolvedBacklogRequirementCount = requirements.filter((entry) => entry.backlog.state === "unresolved").length
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const catalogCompletenessState = candidate?.catalogCompletenessState ?? "not-assessed"
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Design Requirements candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind the exact current Product, Initiative, Outcome Model, or Screen and State Inventory")
    if (staleDomainReferenceCount > 0) reasons.push("One or more Requirement or Work Item links are missing, superseded, rejected, or outside the exact Initiative backlog")
    if (staleSourceReferenceCount > 0) reasons.push("One or more requirement or outcome links reference a superseded Source revision")
    if (unresolvedOutcomeCount > 0) reasons.push("One or more exact current outcomes lack represented Design Requirements")
    if (unresolvedBacklogRequirementCount > 0) reasons.push("One or more Design Requirements lack an explicit backlog disposition")
    if (weakEvidenceRequirementCount > 0) reasons.push("One or more Design Requirements retain weak linkage or verification evidence")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved Design Requirements questions")
    if (candidate && catalogCompletenessState !== "candidate-complete") reasons.push("The candidate catalog is not marked candidate-complete")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    const workItemIds = new Set(requirements.flatMap((entry) => entry.backlog.workItems.map((reference) => reference.recordId)))
    return designRequirementsStatusSchema.parse({
      schemaVersion: 1,
      kind: "design-requirements-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      requirementCount: requirements.length,
      mustPriorityCount: [...currentRequirementById.values()].filter((entry) => entry.priority === "must").length,
      representedOutcomeCount: outcomeCoverage.filter((entry) => entry.status === "represented").length,
      unresolvedOutcomeCount,
      linkedBacklogRequirementCount: requirements.filter((entry) => entry.backlog.state === "linked").length,
      notPlannedRequirementCount: requirements.filter((entry) => entry.backlog.state === "not-planned").length,
      unresolvedBacklogRequirementCount,
      workItemCount: workItemIds.size,
      weakEvidenceRequirementCount,
      staleBindingCount,
      staleDomainReferenceCount,
      staleSourceReferenceCount,
      unresolvedQuestionCount,
      catalogCompletenessState,
      reviewState,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "design-requirements-status-is-observational-and-does-not-establish-requirement-validity-completeness-priority-approval-satisfaction-backlog-commitment-design-approval-readiness-implementation-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<DesignRequirementsProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Design Requirements projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "design-requirements-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        state: candidate.state,
        requirementCount: candidate.requirements.length,
        representedOutcomeCount: candidate.outcomeCoverage.filter((entry) => entry.status === "represented").length,
        workItemCount: new Set(candidate.requirements.flatMap((entry) =>
          entry.backlog.workItems.map((reference) => reference.recordId))).size,
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-requirement-outcome-work-item-design-target-source-or-personal-content-secrets-or-credentials" as const,
      authorityBoundary:
        "design-requirements-projection-is-read-only-and-does-not-establish-requirement-validity-completeness-priority-approval-satisfaction-backlog-commitment-design-approval-readiness-implementation-or-write-or-action-authority" as const,
    }
    return designRequirementsProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("design-requirements", currentRecordPattern, designRequirementsSchema)
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) {
          throw new Error("Design Requirements membership digest is invalid")
        }
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Design Requirements candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleDomainReferenceCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "design-requirements.binding-review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale Design Requirements bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "design-requirements.invalid",
          severity: "error",
          message: `Design Requirements ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Design Requirements Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Design Requirements candidate must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async requireCurrentOutcomeModel(input: DesignRequirementsInput): Promise<OutcomeModel> {
    const model = await this.businessUnderstanding.readCurrentOutcomeModel(input.initiativeId)
    if (!model) throw new Error("Design Requirements candidate requires a current Outcome Model")
    if (input.outcomeModel.recordId !== model.id || input.outcomeModel.revision !== model.revision ||
        input.outcomeModel.digest !== canonicalDigest(model)) {
      throw new Error("Design Requirements candidate must bind the exact current Outcome Model")
    }
    return model
  }

  private async requireCurrentScreenStateInventory(input: DesignRequirementsInput): Promise<ScreenStateInventory> {
    const inventory = await this.screenStateInventory.readCurrent(input.initiativeId)
    if (!inventory) throw new Error("Design Requirements candidate requires a current Screen and State Inventory")
    if (input.screenStateInventory.recordId !== inventory.id ||
        input.screenStateInventory.revision !== inventory.revision ||
        input.screenStateInventory.digest !== canonicalDigest(inventory) ||
        input.screenStateInventory.membershipDigest !== inventory.membershipDigest) {
      throw new Error("Design Requirements candidate must bind the exact current Screen and State Inventory record and membership")
    }
    return inventory
  }

  private validateDesignLinks(
    input: DesignRequirementsInput,
    outcomeModel: OutcomeModel,
    inventory: ScreenStateInventory,
  ): void {
    const outcomeIds = outcomeModel.outcomes.map((outcome) => outcome.id).sort((left, right) => left.localeCompare(right))
    if (canonicalDigest(input.outcomeCoverage.map((entry) => entry.outcomeId)) !== canonicalDigest(outcomeIds)) {
      throw new Error("Design Requirements outcome coverage must include every exact current Outcome Model outcome once")
    }
    const targetSets = {
      platformKeys: new Set(inventory.platforms.filter((entry) => entry.supportState === "targeted").map((entry) => entry.key)),
      screenKeys: new Set(inventory.screens.map((entry) => entry.key)),
      stateKeys: new Set(inventory.states.map((entry) => entry.key)),
      variantKeys: new Set(inventory.variants.map((entry) => entry.key)),
      routeKeys: new Set(inventory.routeCoverage.filter((entry) => entry.status === "represented").map((entry) => entry.routeKey)),
      designScopeKeys: new Set(inventory.scopeCoverage.filter((entry) => entry.status === "represented").map((entry) => entry.designScopeKey)),
    }
    for (const requirement of input.requirements) {
      for (const [kind, values] of Object.entries(requirement.targets) as [keyof typeof targetSets, string[]][]) {
        if (values.some((value) => !targetSets[kind].has(value))) {
          throw new Error(`Design Requirement ${kind} must stay inside the exact current Screen and State Inventory`)
        }
      }
    }
  }

  private async validateDomainReferences(
    input: DesignRequirementsInput,
    product: Product,
    initiative: Initiative,
  ): Promise<void> {
    for (const linked of input.requirements) {
      const requirement = await this.productStudio.readRequirement(linked.requirement.recordId)
      if (requirement.productId !== product.id || requirement.key !== linked.key ||
          requirement.revision !== linked.requirement.revision ||
          canonicalDigest(requirement) !== linked.requirement.digest) {
        throw new Error("Design Requirements must reference the exact current Product Requirement identity, key, revision, and digest")
      }
      if (requirement.state === "rejected") {
        throw new Error("Rejected Requirements cannot be represented as current Design Requirements")
      }
      for (const reference of linked.backlog.workItems) {
        const workItem = await this.productStudio.readWorkItem(reference.recordId)
        const change = await this.productStudio.readChange(workItem.changeId)
        if (workItem.productId !== product.id || change.initiativeId !== initiative.id ||
            workItem.revision !== reference.revision || canonicalDigest(workItem) !== reference.digest) {
          throw new Error("Design Requirements backlog must reference exact current Work Items from the same Product and Initiative")
        }
      }
    }
  }

  private bindingMismatchCount(
    input: DesignRequirementsInput,
    product: Product,
    initiative: Initiative,
    outcomeModel: OutcomeModel | undefined,
    inventory: ScreenStateInventory | undefined,
  ): number {
    let mismatches = 0
    const expectedContext = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(input.context) !== canonicalDigest(expectedContext)) mismatches += 1
    if (!outcomeModel || input.outcomeModel.recordId !== outcomeModel.id ||
        input.outcomeModel.revision !== outcomeModel.revision || input.outcomeModel.digest !== canonicalDigest(outcomeModel)) {
      mismatches += 1
    }
    if (!inventory || input.screenStateInventory.recordId !== inventory.id ||
        input.screenStateInventory.revision !== inventory.revision ||
        input.screenStateInventory.digest !== canonicalDigest(inventory) ||
        input.screenStateInventory.membershipDigest !== inventory.membershipDigest) {
      mismatches += 1
    }
    return mismatches
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Design Requirements Source reference identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Design Requirements guidance is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: DesignRequirements, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, designRequirementsSchema),
        this.governed(this.historyPath(record.id, record.revision), record, designRequirementsSchema),
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
          outcomeModel: record.outcomeModel,
          screenStateInventory: record.screenStateInventory,
          requirementCount: record.requirements.length,
          requirementCatalogDigest: canonicalDigest(record.requirements.map((entry) => ({ key: entry.key, requirement: entry.requirement }))),
          outcomeCoverageDigest: canonicalDigest(record.outcomeCoverage.map((entry) => ({ outcomeId: entry.outcomeId, status: entry.status, requirementKeys: entry.requirementKeys }))),
          backlogDispositionCounts: Object.fromEntries([...new Set(record.requirements.map((entry) => entry.backlog.state))].sort()
            .map((state) => [state, record.requirements.filter((entry) => entry.backlog.state === state).length])),
          workItemCount: new Set(record.requirements.flatMap((entry) =>
            entry.backlog.workItems.map((reference) => reference.recordId))).size,
          catalogCompletenessState: record.catalogCompletenessState,
          reviewState: record.reviewState,
          priorityApprovalState: record.priorityApprovalState,
          designApprovalState: record.designApprovalState,
          backlogCommitmentState: record.backlogCommitmentState,
          readinessState: record.readinessState,
          implementationAuthorityState: record.implementationAuthorityState,
          requirementValidityState: "not-established",
          requirementSatisfactionState: "not-established",
          writeAuthorityState: "not-granted",
          actionAuthorityState: "not-granted",
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("design-requirements", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("design-requirements-history", `design-requirements-${id}-r${revision}.json`)
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
    if (names.length > inventoryLimit) throw new Error(`Design Requirements directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
