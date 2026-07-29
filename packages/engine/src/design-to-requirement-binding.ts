import { randomUUID } from "node:crypto"

import {
  designToRequirementBindingInputSchema,
  designToRequirementBindingProjectionSchema,
  designToRequirementBindingSchema,
  designToRequirementBindingStatusSchema,
  exactSourceReferenceSchema,
  type BusinessContextBinding,
  type DecisionRegister,
  type DesignRequirements,
  type DesignToRequirementBinding,
  type DesignToRequirementBindingInput,
  type DesignToRequirementBindingProjection,
  type DesignToRequirementBindingStatus,
  type ExactSourceReference,
  type FinalizedFigmaSnapshotImport,
  type Initiative,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { DecisionRegisterService } from "./decision-register.js"
import type { DesignRequirementsService } from "./design-requirements.js"
import type { FinalizedFigmaSnapshotImportService } from "./finalized-figma-snapshot-import.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: DesignToRequirementBinding) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function finalizedSnapshotReference(record: FinalizedFigmaSnapshotImport) {
  return {
    recordId: record.id,
    revision: record.revision,
    digest: canonicalDigest(record),
    membershipDigest: record.membershipDigest,
    itemCatalogDigest: canonicalDigest(record.items),
  }
}

function designRequirementsReference(record: DesignRequirements) {
  return {
    recordId: record.id,
    revision: record.revision,
    digest: canonicalDigest(record),
    membershipDigest: record.membershipDigest,
    requirementCatalogDigest: canonicalDigest(record.requirements),
  }
}

function decisionRegisterReference(record: DecisionRegister) {
  return {
    recordId: record.id,
    revision: record.revision,
    digest: canonicalDigest(record),
    membershipDigest: record.membershipDigest,
    decisionCatalogDigest: canonicalDigest(record.decisions),
  }
}

function membership(input: DesignToRequirementBindingInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    objectiveDigest: input.objectiveDigest,
    finalizedSnapshot: input.finalizedSnapshot,
    designRequirements: input.designRequirements,
    decisionRegister: input.decisionRegister,
    bindings: input.bindings,
    designItemCoverage: input.designItemCoverage,
    subjectCoverage: input.subjectCoverage,
    conflicts: input.conflicts,
    reconciliationDigest: input.reconciliationDigest,
    reconciliationState: input.reconciliationState,
    candidateCoverageState: input.candidateCoverageState,
    provenanceState: input.provenanceState,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    relationshipTruthState: input.relationshipTruthState,
    coverageCompletenessState: input.coverageCompletenessState,
    requirementSatisfactionState: input.requirementSatisfactionState,
    decisionEffectivenessState: input.decisionEffectivenessState,
    externalCompletenessState: input.externalCompletenessState,
    designValidityState: input.designValidityState,
    designApprovalState: input.designApprovalState,
    designBaselineState: input.designBaselineState,
    readinessState: input.readinessState,
    figmaConnectionAuthorityState: input.figmaConnectionAuthorityState,
    credentialAuthorityState: input.credentialAuthorityState,
    permissionGrantState: input.permissionGrantState,
    importExecutionState: input.importExecutionState,
    writeExecutionState: input.writeExecutionState,
    implementationAuthorityState: input.implementationAuthorityState,
  }
}

function reconciliationReceipt(input: DesignToRequirementBindingInput) {
  return {
    finalizedSnapshot: input.finalizedSnapshot,
    designRequirements: input.designRequirements,
    decisionRegister: input.decisionRegister,
    bindingCatalogDigest: canonicalDigest(input.bindings),
    designItemCoverageDigest: canonicalDigest(input.designItemCoverage),
    subjectCoverageDigest: canonicalDigest(input.subjectCoverage),
    conflictCatalogDigest: canonicalDigest(input.conflicts),
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

export class DesignToRequirementBindingService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly finalizedFigmaSnapshotImport: FinalizedFigmaSnapshotImportService,
    private readonly designRequirements: DesignRequirementsService,
    private readonly decisionRegister: DecisionRegisterService,
  ) {}

  async create(inputValue: DesignToRequirementBindingInput, actorId: string): Promise<DesignToRequirementBinding> {
    const input = designToRequirementBindingInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireCurrentDependencies(input)
      this.validateRegistry(input, ...dependencies)
      await this.validateSourceReferences(input, initiative.id)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Design-to-Requirement Binding candidate")
      }
      const now = new Date().toISOString()
      const record = designToRequirementBindingSchema.parse({
        schemaVersion: 1,
        kind: "design-to-requirement-binding-candidate",
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
          "design-to-requirement-binding-is-a-review-candidate-and-does-not-establish-relationship-truth-coverage-completeness-requirement-satisfaction-decision-effectiveness-external-completeness-design-validity-or-approval-baseline-readiness-implementation-write-import-or-action-authority",
      })
      await this.commitVersionedRecord(record, "design-to-requirement-binding.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: DesignToRequirementBindingInput,
    actorId: string,
  ): Promise<DesignToRequirementBinding> {
    const input = designToRequirementBindingInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Design-to-Requirement Binding revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Design-to-Requirement Binding Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireCurrentDependencies(input)
      this.validateRegistry(input, ...dependencies)
      await this.validateSourceReferences(input, initiative.id)
      const record = designToRequirementBindingSchema.parse({
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
      await this.commitVersionedRecord(record, "design-to-requirement-binding.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<DesignToRequirementBinding> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Design-to-Requirement Binding ID")),
      designToRequirementBindingSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<DesignToRequirementBinding | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords(
      "design-to-requirement-bindings",
      currentRecordPattern,
      designToRequirementBindingSchema,
    )
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Design-to-Requirement Binding candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<DesignToRequirementBinding> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Design-to-Requirement Binding history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Design-to-Requirement Binding ID")
    const record = await this.repository.readJson(
      this.historyPath(recordId, revision),
      designToRequirementBindingSchema,
    )
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Design-to-Requirement Binding history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<DesignToRequirementBinding[]> {
    const recordId = this.requireUuid(id, "Design-to-Requirement Binding ID")
    const records = await this.listRecords(
      "design-to-requirement-binding-history",
      new RegExp(`^design-to-requirement-binding-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      designToRequirementBindingSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Design-to-Requirement Binding history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<DesignToRequirementBindingStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, currentSources, finalizedSnapshot, requirements, decisions] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
      this.finalizedFigmaSnapshotImport.readCurrent(targetId),
      this.designRequirements.readCurrent(targetId),
      this.decisionRegister.readCurrent(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    let staleBindingCount = candidate
      ? this.bindingMismatchCount(candidate, product, initiative, finalizedSnapshot, requirements, decisions)
      : 0
    if (candidate && finalizedSnapshot && requirements && decisions && staleBindingCount === 0) {
      try {
        this.validateRegistry(candidate, finalizedSnapshot, requirements, decisions)
      } catch {
        staleBindingCount += 1
      }
    }
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(candidate).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const designItemCoverage = candidate?.designItemCoverage ?? []
    const requirementCoverage = candidate?.subjectCoverage.filter((entry) => entry.subjectType === "requirement") ?? []
    const decisionCoverage = candidate?.subjectCoverage.filter((entry) => entry.subjectType === "decision") ?? []
    const bindingCount = candidate?.bindings.length ?? 0
    const humanReviewedBindingCount = candidate?.bindings.filter((entry) => entry.evidenceState === "human-reviewed").length ?? 0
    const boundDesignItemCount = designItemCoverage.filter((entry) => entry.state === "bound-candidate").length
    const unboundDesignItemCount = designItemCoverage.filter((entry) => entry.state === "unbound").length
    const boundRequirementCount = requirementCoverage.filter((entry) => entry.state === "bound-candidate").length
    const unboundRequirementCount = requirementCoverage.filter((entry) => entry.state === "unbound").length
    const boundDecisionCount = decisionCoverage.filter((entry) => entry.state === "bound-candidate").length
    const unboundDecisionCount = decisionCoverage.filter((entry) => entry.state === "unbound").length
    const openConflictCount = candidate?.conflicts.filter((entry) => entry.state === "open").length ?? 0
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reconciliationState = candidate?.reconciliationState ?? "not-assessed"
    const candidateCoverageState = candidate?.candidateCoverageState ?? "not-assessed"
    const provenanceState = candidate?.provenanceState ?? "not-assessed"
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Design-to-Requirement Binding candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The registry does not bind the exact current design, Requirement, or Decision dependencies")
    if (staleSourceReferenceCount > 0) reasons.push("One or more binding fields reference a superseded Source revision")
    if (candidate && bindingCount === 0) reasons.push("The registry contains no candidate bindings")
    if (humanReviewedBindingCount < bindingCount) reasons.push("One or more candidate bindings lack exact human-reviewed evidence")
    if (unboundDesignItemCount > 0) reasons.push("One or more finalized design items remain unbound")
    if (unboundRequirementCount > 0) reasons.push("One or more Design Requirements remain unbound")
    if (unboundDecisionCount > 0) reasons.push("One or more Decisions remain unbound")
    if (openConflictCount > 0) reasons.push("One or more design binding conflicts remain open")
    if (unresolvedQuestionCount > 0) reasons.push("The registry records unresolved binding questions")
    if (candidate && reconciliationState !== "exact") reasons.push("Binding reconciliation is not exact")
    if (candidate && candidateCoverageState !== "candidate-complete") reasons.push("Candidate binding coverage is not complete for review")
    if (candidate && provenanceState !== "exact") reasons.push("Binding provenance is not exact")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The registry is not marked ready for human review")
    return designToRequirementBindingStatusSchema.parse({
      schemaVersion: 1,
      kind: "design-to-requirement-binding-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      bindingCount,
      humanReviewedBindingCount,
      designItemCount: designItemCoverage.length,
      boundDesignItemCount,
      unboundDesignItemCount,
      requirementCount: requirementCoverage.length,
      boundRequirementCount,
      unboundRequirementCount,
      decisionCount: decisionCoverage.length,
      boundDecisionCount,
      unboundDecisionCount,
      openConflictCount,
      staleBindingCount,
      staleSourceReferenceCount,
      unresolvedQuestionCount,
      reconciliationState,
      candidateCoverageState,
      provenanceState,
      reviewState,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "design-to-requirement-binding-status-is-observational-and-does-not-establish-relationship-truth-coverage-completeness-requirement-satisfaction-decision-effectiveness-external-completeness-design-validity-or-approval-baseline-readiness-implementation-write-import-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<DesignToRequirementBindingProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Design-to-Requirement Binding projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "design-to-requirement-binding-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        state: candidate.state,
        finalizedSnapshot: candidate.finalizedSnapshot,
        designRequirements: candidate.designRequirements,
        decisionRegister: candidate.decisionRegister,
        reconciliationDigest: candidate.reconciliationDigest,
        bindingCount: candidate.bindings.length,
        designItemCoverageCount: candidate.designItemCoverage.length,
        subjectCoverageCount: candidate.subjectCoverage.length,
        conflictCount: candidate.conflicts.length,
        reconciliationState: candidate.reconciliationState,
        candidateCoverageState: candidate.candidateCoverageState,
        provenanceState: candidate.provenanceState,
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-figma-content-external-identities-requirement-text-decision-content-source-content-human-attribution-personal-content-secrets-credentials-or-permissions" as const,
      authorityBoundary:
        "design-to-requirement-binding-projection-is-read-only-and-does-not-establish-relationship-truth-coverage-completeness-requirement-satisfaction-decision-effectiveness-external-completeness-design-validity-or-approval-baseline-readiness-implementation-write-import-or-action-authority" as const,
    }
    return designToRequirementBindingProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords(
      "design-to-requirement-bindings",
      currentRecordPattern,
      designToRequirementBindingSchema,
    )
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) {
          throw new Error("Design-to-Requirement Binding membership digest is invalid")
        }
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Design-to-Requirement Binding candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "design-to-requirement-binding.review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale Design-to-Requirement Binding evidence.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "design-to-requirement-binding.invalid",
          severity: "error",
          message: `Design-to-Requirement Binding ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Design-to-Requirement Binding Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Design-to-Requirement Binding candidate must bind exact current Product and Initiative revisions and digests")
    }
  }

  private async requireCurrentDependencies(input: DesignToRequirementBindingInput): Promise<[
    FinalizedFigmaSnapshotImport,
    DesignRequirements,
    DecisionRegister,
  ]> {
    const [finalizedSnapshot, requirements, decisions] = await Promise.all([
      this.finalizedFigmaSnapshotImport.readCurrent(input.initiativeId),
      this.designRequirements.readCurrent(input.initiativeId),
      this.decisionRegister.readCurrent(input.initiativeId),
    ])
    if (!finalizedSnapshot || canonicalDigest(input.finalizedSnapshot) !== canonicalDigest(finalizedSnapshotReference(finalizedSnapshot))) {
      throw new Error("Design-to-Requirement Binding must bind the exact current Finalized Figma Snapshot Import and item catalog")
    }
    if (!requirements || canonicalDigest(input.designRequirements) !== canonicalDigest(designRequirementsReference(requirements))) {
      throw new Error("Design-to-Requirement Binding must bind the exact current Design Requirements and requirement catalog")
    }
    if (!decisions || canonicalDigest(input.decisionRegister) !== canonicalDigest(decisionRegisterReference(decisions))) {
      throw new Error("Design-to-Requirement Binding must bind the exact current Decision Register and decision catalog")
    }
    return [finalizedSnapshot, requirements, decisions]
  }

  private validateRegistry(
    input: DesignToRequirementBindingInput,
    finalizedSnapshot: FinalizedFigmaSnapshotImport,
    requirements: DesignRequirements,
    decisions: DecisionRegister,
  ): void {
    const itemByKey = new Map(finalizedSnapshot.items.map((entry) => [entry.key, entry]))
    const requirementKeys = requirements.requirements.map((entry) => entry.key).sort((left, right) => left.localeCompare(right))
    const decisionKeys = decisions.decisions.map((entry) => entry.key).sort((left, right) => left.localeCompare(right))
    const itemCoverageKeys = input.designItemCoverage.map((entry) => entry.itemKey)
    const requirementCoverageKeys = input.subjectCoverage
      .filter((entry) => entry.subjectType === "requirement").map((entry) => entry.subjectKey)
    const decisionCoverageKeys = input.subjectCoverage
      .filter((entry) => entry.subjectType === "decision").map((entry) => entry.subjectKey)
    if (canonicalDigest(itemCoverageKeys) !== canonicalDigest([...itemByKey.keys()].sort((left, right) => left.localeCompare(right)))) {
      throw new Error("Design-to-Requirement Binding must reconcile every exact finalized design item once")
    }
    if (canonicalDigest(requirementCoverageKeys) !== canonicalDigest(requirementKeys)) {
      throw new Error("Design-to-Requirement Binding must reconcile every exact current Design Requirement once")
    }
    if (canonicalDigest(decisionCoverageKeys) !== canonicalDigest(decisionKeys)) {
      throw new Error("Design-to-Requirement Binding must reconcile every exact current Decision once")
    }
    const requirementKeySet = new Set(requirementKeys)
    const decisionKeySet = new Set(decisionKeys)
    for (const binding of input.bindings) {
      const item = itemByKey.get(binding.designItemKey)
      if (!item || item.kind !== binding.designItemKind) {
        throw new Error("Design-to-Requirement Binding references an unknown or mismatched finalized design item")
      }
      if (binding.requirementKeys.some((key) => !requirementKeySet.has(key))) {
        throw new Error("Design-to-Requirement Binding references a Requirement outside the exact current catalog")
      }
      if (binding.decisionKeys.some((key) => !decisionKeySet.has(key))) {
        throw new Error("Design-to-Requirement Binding references a Decision outside the exact current register")
      }
    }
    if (input.reconciliationDigest !== canonicalDigest(reconciliationReceipt(input))) {
      throw new Error("Design-to-Requirement Binding reconciliation digest must bind exact dependencies, links, coverage, and conflicts")
    }
  }

  private bindingMismatchCount(
    input: DesignToRequirementBindingInput,
    product: Product,
    initiative: Initiative,
    finalizedSnapshot: FinalizedFigmaSnapshotImport | undefined,
    requirements: DesignRequirements | undefined,
    decisions: DecisionRegister | undefined,
  ): number {
    let mismatches = 0
    const expectedContext = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(input.context) !== canonicalDigest(expectedContext)) mismatches += 1
    if (!finalizedSnapshot || canonicalDigest(input.finalizedSnapshot) !== canonicalDigest(finalizedSnapshotReference(finalizedSnapshot))) mismatches += 1
    if (!requirements || canonicalDigest(input.designRequirements) !== canonicalDigest(designRequirementsReference(requirements))) mismatches += 1
    if (!decisions || canonicalDigest(input.decisionRegister) !== canonicalDigest(decisionRegisterReference(decisions))) mismatches += 1
    return mismatches
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Design-to-Requirement Binding Source identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Design-to-Requirement Binding is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(
    record: DesignToRequirementBinding,
    eventType: string,
    actorId: string,
  ): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, designToRequirementBindingSchema),
        this.governed(this.historyPath(record.id, record.revision), record, designToRequirementBindingSchema),
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
          objectiveDigest: record.objectiveDigest,
          finalizedSnapshot: record.finalizedSnapshot,
          designRequirements: record.designRequirements,
          decisionRegister: record.decisionRegister,
          bindingCount: record.bindings.length,
          bindingCatalogDigest: canonicalDigest(record.bindings.map((entry) => ({
            key: entry.key,
            designItemKey: entry.designItemKey,
            designItemKind: entry.designItemKind,
            requirementKeys: entry.requirementKeys,
            decisionKeys: entry.decisionKeys,
            requirementRelationship: entry.requirementRelationship,
            decisionRelationship: entry.decisionRelationship,
            provenanceDigest: entry.provenanceDigest,
            evidenceState: entry.evidenceState,
          }))),
          designItemCoverageCount: record.designItemCoverage.length,
          designItemCoverageDigest: canonicalDigest(record.designItemCoverage.map((entry) => ({
            itemKey: entry.itemKey, state: entry.state, bindingKeys: entry.bindingKeys,
          }))),
          subjectCoverageCount: record.subjectCoverage.length,
          subjectCoverageDigest: canonicalDigest(record.subjectCoverage.map((entry) => ({
            subjectType: entry.subjectType, subjectKey: entry.subjectKey, state: entry.state, bindingKeys: entry.bindingKeys,
          }))),
          conflictCount: record.conflicts.length,
          conflictCatalogDigest: canonicalDigest(record.conflicts.map((entry) => ({
            key: entry.key, kind: entry.kind, state: entry.state, subjectDigest: entry.subjectDigest,
          }))),
          reconciliationDigest: record.reconciliationDigest,
          reconciliationState: record.reconciliationState,
          candidateCoverageState: record.candidateCoverageState,
          provenanceState: record.provenanceState,
          unresolvedQuestionCount: record.unresolvedQuestions.length,
          reviewState: record.reviewState,
          relationshipTruthState: record.relationshipTruthState,
          coverageCompletenessState: record.coverageCompletenessState,
          requirementSatisfactionState: record.requirementSatisfactionState,
          decisionEffectivenessState: record.decisionEffectivenessState,
          externalCompletenessState: record.externalCompletenessState,
          designValidityState: record.designValidityState,
          designApprovalState: record.designApprovalState,
          designBaselineState: record.designBaselineState,
          readinessState: record.readinessState,
          figmaConnectionAuthorityState: record.figmaConnectionAuthorityState,
          credentialAuthorityState: record.credentialAuthorityState,
          permissionGrantState: record.permissionGrantState,
          importExecutionState: record.importExecutionState,
          writeExecutionState: record.writeExecutionState,
          implementationAuthorityState: record.implementationAuthorityState,
          actionAuthorityState: "not-granted",
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("design-to-requirement-bindings", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve(
      "design-to-requirement-binding-history",
      `design-to-requirement-binding-${id}-r${revision}.json`,
    )
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
    if (names.length > inventoryLimit) {
      throw new Error(`Design-to-Requirement Binding directory ${directory} exceeds the safety limit`)
    }
    const records = await Promise.all(
      names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)),
    )
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
