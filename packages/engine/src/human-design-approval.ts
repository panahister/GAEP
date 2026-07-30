import { randomUUID } from "node:crypto"

import {
  exactSourceReferenceSchema,
  humanDesignApprovalInputSchema,
  humanDesignApprovalPrerequisiteKeys,
  humanDesignApprovalPrerequisiteKinds,
  humanDesignApprovalProjectionSchema,
  humanDesignApprovalSchema,
  humanDesignApprovalStatusSchema,
  type BusinessContextBinding,
  type ExactHumanDesignApprovalPrerequisite,
  type ExactSourceReference,
  type FinalizedFigmaSnapshotImport,
  type HumanDesignApproval,
  type HumanDesignApprovalInput,
  type HumanDesignApprovalPrerequisiteKey,
  type HumanDesignApprovalProjection,
  type HumanDesignApprovalStatus,
  type Initiative,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type DependencyRecord = {
  kind: (typeof humanDesignApprovalPrerequisiteKinds)[HumanDesignApprovalPrerequisiteKey]
  id: string
  revision: number
  membershipDigest: string
}
type DependencyStatus = {
  state: "attention-required" | "complete-for-human-decision" | "complete-for-review"
  assessedAt: string
}
type DependencyService = {
  readCurrent(initiativeId: string): Promise<DependencyRecord | undefined>
  assess(initiativeId: string): Promise<DependencyStatus>
}
type HumanDesignApprovalDependencyServices = Record<HumanDesignApprovalPrerequisiteKey, DependencyService>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: HumanDesignApproval) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: HumanDesignApprovalInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    objectiveDigest: input.objectiveDigest,
    prerequisites: input.prerequisites,
    subject: input.subject,
    scope: input.scope,
    decision: input.decision,
    decisionDefinitionDigest: input.decisionDefinitionDigest,
    decisionReceiptDigest: input.decisionReceiptDigest,
    candidateResult: input.candidateResult,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    approverAuthorityState: input.approverAuthorityState,
    separationOfDutiesEnforcementState: input.separationOfDutiesEnforcementState,
    designApprovalState: input.designApprovalState,
    designBaselineState: input.designBaselineState,
    readinessState: input.readinessState,
    phaseEntryAuthorityState: input.phaseEntryAuthorityState,
    figmaConnectionAuthorityState: input.figmaConnectionAuthorityState,
    credentialAuthorityState: input.credentialAuthorityState,
    permissionGrantState: input.permissionGrantState,
    importExecutionState: input.importExecutionState,
    writeExecutionState: input.writeExecutionState,
    implementationAuthorityState: input.implementationAuthorityState,
  }
}

export function humanDesignApprovalPrerequisiteStatusDigest(status: DependencyStatus): string {
  const { assessedAt: _assessedAt, ...stable } = status
  return canonicalDigest(stable)
}

function prerequisiteReference(
  key: HumanDesignApprovalPrerequisiteKey,
  record: DependencyRecord,
  status: DependencyStatus,
): ExactHumanDesignApprovalPrerequisite {
  return {
    key,
    kind: humanDesignApprovalPrerequisiteKinds[key],
    recordId: record.id,
    revision: record.revision,
    digest: canonicalDigest(record),
    membershipDigest: record.membershipDigest,
    assessmentDigest: humanDesignApprovalPrerequisiteStatusDigest(status),
    assessmentState: status.state,
  }
}

export function humanDesignApprovalSubjectReference(record: FinalizedFigmaSnapshotImport) {
  return {
    kind: "finalized-figma-snapshot-import-candidate" as const,
    recordId: record.id,
    revision: record.revision,
    digest: canonicalDigest(record),
    membershipDigest: record.membershipDigest,
    externalFileIdentityDigest: record.returnReceipt.externalFileIdentityDigest,
    returnedExternalVersionDigest: record.returnReceipt.returnedExternalVersionDigest,
    itemCatalogDigest: canonicalDigest(record.items),
    itemCount: record.items.length,
  }
}

export function humanDesignApprovalScopeDigest(
  scope: Pick<HumanDesignApprovalInput["scope"], "excludedItemDigests" | "includedItemDigests" | "kind" | "subjectDigest">,
): string {
  return canonicalDigest({
    kind: scope.kind,
    subjectDigest: scope.subjectDigest,
    includedItemDigests: scope.includedItemDigests,
    excludedItemDigests: scope.excludedItemDigests,
  })
}

export function humanDesignApprovalDecisionReceiptDigest(
  input: Pick<HumanDesignApprovalInput, "decision" | "decisionDefinitionDigest" | "prerequisites" | "scope" | "subject">,
): string {
  return canonicalDigest({
    decisionDefinitionDigest: input.decisionDefinitionDigest,
    prerequisites: input.prerequisites,
    subject: input.subject,
    scope: input.scope,
    decision: input.decision,
  })
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

function expectedCompleteState(key: HumanDesignApprovalPrerequisiteKey): DependencyStatus["state"] {
  return key === "designer-ready-gate" ? "complete-for-human-decision" : "complete-for-review"
}

export class HumanDesignApprovalService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly dependencies: HumanDesignApprovalDependencyServices,
  ) {}

  async create(inputValue: HumanDesignApprovalInput, actorId: string): Promise<HumanDesignApproval> {
    const input = humanDesignApprovalInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const snapshots = await this.requireCurrentDependencies(input)
      this.validateSubjectAndScope(input, snapshots)
      this.validateDecisionReceipt(input)
      await this.validateSourceReferences(input, initiative.id)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Human Design Approval candidate")
      }
      const now = new Date().toISOString()
      const record = humanDesignApprovalSchema.parse({
        schemaVersion: 1,
        kind: "human-design-approval-candidate",
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
          "human-design-approval-is-a-recorded-decision-candidate-and-does-not-verify-approver-authority-enforce-separation-of-duties-establish-design-approval-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority",
      })
      await this.commitVersionedRecord(record, "human-design-approval.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: HumanDesignApprovalInput,
    actorId: string,
  ): Promise<HumanDesignApproval> {
    const input = humanDesignApprovalInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Human Design Approval revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Human Design Approval Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const snapshots = await this.requireCurrentDependencies(input)
      this.validateSubjectAndScope(input, snapshots)
      this.validateDecisionReceipt(input)
      await this.validateSourceReferences(input, initiative.id)
      const record = humanDesignApprovalSchema.parse({
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
      await this.commitVersionedRecord(record, "human-design-approval.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<HumanDesignApproval> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Human Design Approval ID")), humanDesignApprovalSchema)
  }

  async readCurrent(initiativeId: string): Promise<HumanDesignApproval | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("human-design-approvals", currentRecordPattern, humanDesignApprovalSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Human Design Approval candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<HumanDesignApproval> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Human Design Approval history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Human Design Approval ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), humanDesignApprovalSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Human Design Approval history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<HumanDesignApproval[]> {
    const recordId = this.requireUuid(id, "Human Design Approval ID")
    const records = await this.listRecords(
      "human-design-approval-history",
      new RegExp(`^human-design-approval-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      humanDesignApprovalSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Human Design Approval history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<HumanDesignApprovalStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, currentSources, snapshots] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
      this.readDependencySnapshots(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    let staleBindingCount = 0
    if (candidate) {
      const expectedContext = {
        productRevision: revisionOf(product), productDigest: canonicalDigest(product),
        initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
      }
      if (canonicalDigest(candidate.context) !== canonicalDigest(expectedContext)) staleBindingCount += 1
      if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) staleBindingCount += 1
      if (candidate.scope.scopeDigest !== humanDesignApprovalScopeDigest(candidate.scope)) staleBindingCount += 1
      if (candidate.decisionReceiptDigest !== humanDesignApprovalDecisionReceiptDigest(candidate)) staleBindingCount += 1
      const inputByKey = new Map(candidate.prerequisites.map((entry) => [entry.key, entry]))
      for (const [key, snapshot] of snapshots) {
        const expected = snapshot.record ? prerequisiteReference(key, snapshot.record, snapshot.status) : undefined
        if (!expected || canonicalDigest(inputByKey.get(key)) !== canonicalDigest(expected)) staleBindingCount += 1
      }
      try {
        this.validateSubjectAndScope(candidate, snapshots)
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
    const assessedAt = new Date().toISOString()
    const decision = candidate?.decision
    const decisionCount = decision ? 1 : 0
    const expiredDecisionCount = decision && decision.validUntil <= assessedAt ? 1 : 0
    const revokedDecisionCount = decision?.lifecycleState === "revoked-candidate" ? 1 : 0
    const completePrerequisiteCount = candidate?.prerequisites.filter((entry) =>
      entry.assessmentState === expectedCompleteState(entry.key)).length ?? 0
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Human Design Approval candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The Human Design Approval does not bind exact current prerequisites, subject, scope, or receipts")
    if (staleSourceReferenceCount > 0) reasons.push("The recorded design decision references a superseded Source revision")
    if (candidate && completePrerequisiteCount !== humanDesignApprovalPrerequisiteKeys.length) reasons.push("One or more Human Design Approval prerequisites are not complete for human decision review")
    if (!decision && candidate) reasons.push("No attributable human design decision is recorded")
    if (expiredDecisionCount > 0) reasons.push("The recorded human design decision candidate is expired")
    if (revokedDecisionCount > 0) reasons.push("The recorded human design decision candidate is revoked")
    if ((candidate?.unresolvedQuestions.length ?? 0) > 0) reasons.push("The Human Design Approval records unresolved questions")
    if (candidate && ["blocked", "incomplete"].includes(candidate.candidateResult)) reasons.push("The Human Design Approval candidate is blocked or incomplete")
    if (candidate && candidate.reviewState !== "recorded-human-decision") reasons.push("The Human Design Approval does not record a complete attributable human decision")
    return humanDesignApprovalStatusSchema.parse({
      schemaVersion: 1,
      kind: "human-design-approval-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      prerequisiteCount: candidate?.prerequisites.length ?? 0,
      completePrerequisiteCount,
      decisionCount,
      approveCount: decision?.kind === "approve-candidate" ? 1 : 0,
      rejectCount: decision?.kind === "reject-candidate" ? 1 : 0,
      requestChangeCount: decision?.kind === "request-change-candidate" ? 1 : 0,
      abstainCount: decision?.kind === "abstain-candidate" ? 1 : 0,
      expiredDecisionCount,
      revokedDecisionCount,
      staleBindingCount,
      staleSourceReferenceCount,
      unresolvedQuestionCount: candidate?.unresolvedQuestions.length ?? 0,
      candidateResult: candidate?.candidateResult ?? "not-assessed",
      reviewState: candidate?.reviewState ?? "draft",
      approverAuthorityState: "not-established",
      separationOfDutiesEnforcementState: "not-established",
      state: reasons.length === 0 ? "complete-for-recorded-decision" : "attention-required",
      reasons,
      assessedAt,
      authorityBoundary:
        "human-design-approval-status-is-observational-and-does-not-verify-approver-authority-enforce-separation-of-duties-establish-design-approval-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<HumanDesignApprovalProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Human Design Approval projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "human-design-approval-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        state: candidate.state,
        prerequisiteCatalogDigest: canonicalDigest(candidate.prerequisites),
        subject: candidate.subject,
        scopeDigest: candidate.scope.scopeDigest,
        decisionDefinitionDigest: candidate.decisionDefinitionDigest,
        decisionReceiptDigest: candidate.decisionReceiptDigest,
        ...(candidate.decision ? {
          decisionKind: candidate.decision.kind,
          decisionDigest: candidate.decision.decisionDigest,
          decisionLifecycleState: candidate.decision.lifecycleState,
        } : {}),
        candidateResult: candidate.candidateResult,
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-counts-results-and-digests-only-not-design-content-decision-rationale-condition-evidence-source-content-human-attribution-personal-content-secrets-credentials-or-permissions" as const,
      authorityBoundary:
        "human-design-approval-projection-is-read-only-and-does-not-verify-approver-authority-enforce-separation-of-duties-establish-design-approval-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority" as const,
    }
    return humanDesignApprovalProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("human-design-approvals", currentRecordPattern, humanDesignApprovalSchema)
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) {
          throw new Error("Human Design Approval membership digest is invalid")
        }
        if (candidate.scope.scopeDigest !== humanDesignApprovalScopeDigest(candidate.scope)) {
          throw new Error("Human Design Approval scope digest is invalid")
        }
        if (candidate.decisionReceiptDigest !== humanDesignApprovalDecisionReceiptDigest(candidate)) {
          throw new Error("Human Design Approval decision receipt digest is invalid")
        }
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Human Design Approval candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0 ||
            status.expiredDecisionCount > 0 || status.revokedDecisionCount > 0) {
          issues.push({
            code: "human-design-approval.review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale, expired, or revoked Human Design Approval evidence.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "human-design-approval.invalid",
          severity: "error",
          message: `Human Design Approval ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Human Design Approval Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Human Design Approval candidate must bind exact current Product and Initiative revisions and digests")
    }
  }

  private async readDependencySnapshots(initiativeId: string): Promise<Map<HumanDesignApprovalPrerequisiteKey, {
    record: DependencyRecord | undefined
    status: DependencyStatus
  }>> {
    const entries = await Promise.all(humanDesignApprovalPrerequisiteKeys.map(async (key) => {
      const service = this.dependencies[key]
      const [record, status] = await Promise.all([service.readCurrent(initiativeId), service.assess(initiativeId)])
      return [key, { record, status }] as const
    }))
    return new Map(entries)
  }

  private async requireCurrentDependencies(input: HumanDesignApprovalInput) {
    const snapshots = await this.readDependencySnapshots(input.initiativeId)
    const inputByKey = new Map(input.prerequisites.map((entry) => [entry.key, entry]))
    for (const key of humanDesignApprovalPrerequisiteKeys) {
      const snapshot = snapshots.get(key)
      if (!snapshot?.record || snapshot.record.kind !== humanDesignApprovalPrerequisiteKinds[key]) {
        throw new Error(`Human Design Approval requires the exact current ${key} candidate`)
      }
      const expected = prerequisiteReference(key, snapshot.record, snapshot.status)
      if (canonicalDigest(inputByKey.get(key)) !== canonicalDigest(expected)) {
        throw new Error(`Human Design Approval must bind the exact current ${key} candidate and assessment`)
      }
    }
    return snapshots
  }

  private validateSubjectAndScope(
    input: HumanDesignApprovalInput | HumanDesignApproval,
    snapshots: Map<HumanDesignApprovalPrerequisiteKey, { record: DependencyRecord | undefined; status: DependencyStatus }>,
  ): void {
    const record = snapshots.get("finalized-figma-snapshot-import")?.record as FinalizedFigmaSnapshotImport | undefined
    if (!record || canonicalDigest(input.subject) !== canonicalDigest(humanDesignApprovalSubjectReference(record))) {
      throw new Error("Human Design Approval subject must bind the exact current Finalized Figma Snapshot Import candidate")
    }
    if (input.scope.scopeDigest !== humanDesignApprovalScopeDigest(input.scope)) {
      throw new Error("Human Design Approval scope digest must bind the exact subject and included and excluded item digests")
    }
    const expectedItemDigests = record.items.map((item) => canonicalDigest(item)).sort()
    const actualItemDigests = [...input.scope.includedItemDigests, ...input.scope.excludedItemDigests].sort()
    if (canonicalDigest(actualItemDigests) !== canonicalDigest(expectedItemDigests)) {
      throw new Error("Human Design Approval scope must classify every exact finalized-snapshot item once")
    }
  }

  private validateDecisionReceipt(input: HumanDesignApprovalInput): void {
    if (input.decisionReceiptDigest !== humanDesignApprovalDecisionReceiptDigest(input)) {
      throw new Error("Human Design Approval decision receipt must bind exact prerequisites, subject, scope, definition, and decision")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Human Design Approval Source identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Human Design Approval is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: HumanDesignApproval, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, humanDesignApprovalSchema),
        this.governed(this.historyPath(record.id, record.revision), record, humanDesignApprovalSchema),
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
          prerequisiteCount: record.prerequisites.length,
          prerequisiteCatalogDigest: canonicalDigest(record.prerequisites),
          subject: record.subject,
          scopeDigest: record.scope.scopeDigest,
          includedItemCount: record.scope.includedItemDigests.length,
          excludedItemCount: record.scope.excludedItemDigests.length,
          decisionDefinitionDigest: record.decisionDefinitionDigest,
          decisionReceiptDigest: record.decisionReceiptDigest,
          decision: record.decision ? {
            key: record.decision.key,
            kind: record.decision.kind,
            decisionDigest: record.decision.decisionDigest,
            rationaleDigest: record.decision.rationaleDigest,
            conditionCount: record.decision.conditionDigests.length,
            evidenceDigests: record.decision.evidenceDigests,
            decidedAt: record.decision.decidedAt,
            validUntil: record.decision.validUntil,
            authorityEvidenceState: record.decision.authorityEvidenceState,
            independenceState: record.decision.independenceState,
            lifecycleState: record.decision.lifecycleState,
            revokedAt: record.decision.revokedAt,
            revocationDigest: record.decision.revocationDigest,
            effectState: record.decision.effectState,
          } : undefined,
          candidateResult: record.candidateResult,
          unresolvedQuestionCount: record.unresolvedQuestions.length,
          reviewState: record.reviewState,
          approverAuthorityState: record.approverAuthorityState,
          separationOfDutiesEnforcementState: record.separationOfDutiesEnforcementState,
          designApprovalState: record.designApprovalState,
          designBaselineState: record.designBaselineState,
          readinessState: record.readinessState,
          phaseEntryAuthorityState: record.phaseEntryAuthorityState,
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
    return this.repository.resolve("human-design-approvals", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("human-design-approval-history", `human-design-approval-${id}-r${revision}.json`)
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
    if (names.length > inventoryLimit) throw new Error(`Human Design Approval directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) =>
      this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
