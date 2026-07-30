import { randomUUID } from "node:crypto"

import {
  designBaselineInputSchema,
  designBaselineProjectionSchema,
  designBaselineSchema,
  designBaselineStatusSchema,
  exactSourceReferenceSchema,
  type BusinessContextBinding,
  type DesignBaseline,
  type DesignBaselineInput,
  type DesignBaselineProjection,
  type DesignBaselineStatus,
  type ExactSourceReference,
  type HumanDesignApproval,
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
type HumanDesignApprovalReader = {
  readCurrent(initiativeId: string): Promise<HumanDesignApproval | undefined>
  assess(initiativeId: string): Promise<HumanDesignApprovalStatus>
}

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: DesignBaseline) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function exactBaselineReference(record: DesignBaseline) {
  return {
    recordId: record.id,
    revision: record.revision,
    digest: canonicalDigest(record),
    membershipDigest: record.membershipDigest,
    baselineLineageId: record.baselineLineageId,
    semanticVersion: record.semanticVersion,
  }
}

function membership(input: DesignBaselineInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    objectiveDigest: input.objectiveDigest,
    humanDesignApproval: input.humanDesignApproval,
    subject: input.subject,
    scope: input.scope,
    baselineLineageId: input.baselineLineageId,
    candidateSetId: input.candidateSetId,
    candidateSetRevision: input.candidateSetRevision,
    semanticVersion: input.semanticVersion,
    versionPolicyDigest: input.versionPolicyDigest,
    designation: input.designation,
    supersedes: input.supersedes,
    designationDefinitionDigest: input.designationDefinitionDigest,
    designationReceiptDigest: input.designationReceiptDigest,
    candidateResult: input.candidateResult,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    approvalDeterminationState: input.approvalDeterminationState,
    baselineDesignationState: input.baselineDesignationState,
    approverAuthorityState: input.approverAuthorityState,
    separationOfDutiesEnforcementState: input.separationOfDutiesEnforcementState,
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

export function designBaselineApprovalStatusDigest(status: HumanDesignApprovalStatus): string {
  const { assessedAt: _assessedAt, ...stable } = status
  return canonicalDigest(stable)
}

export function designBaselineApprovalReference(
  record: HumanDesignApproval,
  status: HumanDesignApprovalStatus,
) {
  return {
    kind: record.kind,
    recordId: record.id,
    revision: record.revision,
    digest: canonicalDigest(record),
    membershipDigest: record.membershipDigest,
    decisionReceiptDigest: record.decisionReceiptDigest,
    subjectDigest: record.subject.digest,
    scopeDigest: record.scope.scopeDigest,
    candidateResult: "approved-candidate" as const,
    reviewState: "recorded-human-decision" as const,
    assessmentDigest: designBaselineApprovalStatusDigest(status),
    assessmentState: status.state,
  }
}

export function designBaselineDesignationReceiptDigest(
  input: Pick<DesignBaselineInput,
    "baselineLineageId" | "candidateSetId" | "candidateSetRevision" | "designation" |
    "designationDefinitionDigest" | "humanDesignApproval" | "scope" | "semanticVersion" |
    "subject" | "supersedes" | "versionPolicyDigest">,
): string {
  return canonicalDigest({
    humanDesignApproval: input.humanDesignApproval,
    subject: input.subject,
    scope: input.scope,
    baselineLineageId: input.baselineLineageId,
    candidateSetId: input.candidateSetId,
    candidateSetRevision: input.candidateSetRevision,
    semanticVersion: input.semanticVersion,
    versionPolicyDigest: input.versionPolicyDigest,
    designationDefinitionDigest: input.designationDefinitionDigest,
    designation: input.designation,
    supersedes: input.supersedes,
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

export class DesignBaselineService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly humanDesignApproval: HumanDesignApprovalReader,
  ) {}

  async create(inputValue: DesignBaselineInput, actorId: string): Promise<DesignBaseline> {
    const input = designBaselineInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const approval = await this.requireCurrentApproval(input)
      this.validateSubjectAndScope(input, approval.record)
      this.validateDesignationReceipt(input)
      await this.validateSourceReferences(input, initiative.id)
      if (input.supersedes) throw new Error("Initial Design Baseline candidate cannot supersede a prior record")
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Design Baseline candidate")
      }
      const now = new Date().toISOString()
      const record = designBaselineSchema.parse({
        schemaVersion: 1,
        kind: "design-baseline-candidate",
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
          "design-baseline-is-a-versioned-designation-candidate-and-does-not-convert-an-approval-candidate-into-approval-verify-approver-authority-enforce-separation-of-duties-establish-a-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority",
      })
      await this.commitVersionedRecord(record, "design-baseline.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: DesignBaselineInput,
    actorId: string,
  ): Promise<DesignBaseline> {
    const input = designBaselineInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Design Baseline revision changed before update")
      if (current.initiativeId !== input.initiativeId || current.baselineLineageId !== input.baselineLineageId) {
        throw new Error("Design Baseline Initiative and lineage cannot change")
      }
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const approval = await this.requireCurrentApproval(input)
      this.validateSubjectAndScope(input, approval.record)
      this.validateDesignationReceipt(input)
      await this.validateSourceReferences(input, initiative.id)
      const revisionAction = input.designation?.kind !== undefined && input.designation.kind !== "propose-baseline-candidate"
      if (revisionAction && canonicalDigest(input.supersedes) !== canonicalDigest(exactBaselineReference(current))) {
        throw new Error("Design Baseline revision action must exact-bind the current predecessor candidate")
      }
      const record = designBaselineSchema.parse({
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
      await this.commitVersionedRecord(record, "design-baseline.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<DesignBaseline> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Design Baseline ID")), designBaselineSchema)
  }

  async readCurrent(initiativeId: string): Promise<DesignBaseline | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("design-baselines", currentRecordPattern, designBaselineSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Design Baseline candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<DesignBaseline> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Design Baseline history revision must be a positive integer")
    const recordId = this.requireUuid(id, "Design Baseline ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), designBaselineSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Design Baseline history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<DesignBaseline[]> {
    const recordId = this.requireUuid(id, "Design Baseline ID")
    const records = await this.listRecords(
      "design-baseline-history",
      new RegExp(`^design-baseline-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      designBaselineSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      const predecessor = index > 0 ? ascending[index - 1] : undefined
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (predecessor && record.predecessorDigest !== canonicalDigest(predecessor))) {
        throw new Error("Design Baseline history is incomplete or has an invalid predecessor chain")
      }
      if (record.supersedes && predecessor && canonicalDigest(record.supersedes) !== canonicalDigest(exactBaselineReference(predecessor))) {
        throw new Error("Design Baseline supersession reference does not match its exact predecessor")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<DesignBaselineStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, currentSources, approvalRecord, approvalStatus] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
      this.humanDesignApproval.readCurrent(targetId),
      this.humanDesignApproval.assess(targetId),
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
      if (candidate.designationReceiptDigest !== designBaselineDesignationReceiptDigest(candidate)) staleBindingCount += 1
      if (!approvalRecord || approvalRecord.candidateResult !== "approved-candidate" ||
          approvalRecord.reviewState !== "recorded-human-decision" ||
          canonicalDigest(candidate.humanDesignApproval) !== canonicalDigest(designBaselineApprovalReference(approvalRecord, approvalStatus))) {
        staleBindingCount += 1
      }
      try {
        if (!approvalRecord) throw new Error("missing approval candidate")
        this.validateSubjectAndScope(candidate, approvalRecord)
        await this.listHistory(candidate.id)
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
    const designation = candidate?.designation
    const expiredDesignationCount = designation && designation.validUntil <= assessedAt ? 1 : 0
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Design Baseline candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The Design Baseline does not bind exact current context, approval candidate, subject, scope, predecessor, or receipts")
    if (staleSourceReferenceCount > 0) reasons.push("The baseline designation candidate references a superseded Source revision")
    if (!approvalRecord || approvalRecord.candidateResult !== "approved-candidate" || approvalRecord.reviewState !== "recorded-human-decision") {
      reasons.push("The exact current Human Design Approval does not contain an approved recorded-decision candidate")
    }
    if (approvalStatus.state !== "complete-for-recorded-decision") reasons.push("The Human Design Approval candidate is not complete for recorded-decision review")
    if (!designation && candidate) reasons.push("No attributable human baseline designation proposal is recorded")
    if (expiredDesignationCount > 0) reasons.push("The baseline designation candidate is expired")
    if ((candidate?.unresolvedQuestions.length ?? 0) > 0) reasons.push("The Design Baseline records unresolved questions")
    if (candidate && ["blocked", "incomplete"].includes(candidate.candidateResult)) reasons.push("The Design Baseline candidate is blocked or incomplete")
    if (candidate && candidate.reviewState !== "ready-for-human-review") reasons.push("The Design Baseline candidate is not ready for human review")
    return designBaselineStatusSchema.parse({
      schemaVersion: 1,
      kind: "design-baseline-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      candidateSetCount: candidate ? 1 : 0,
      designationCandidateCount: designation ? 1 : 0,
      supersessionCandidateCount: designation?.kind === "supersede-baseline-candidate" ? 1 : 0,
      withdrawalCandidateCount: designation?.kind === "withdraw-baseline-candidate" ? 1 : 0,
      restorationCandidateCount: designation?.kind === "restore-baseline-candidate" ? 1 : 0,
      expiredDesignationCount,
      staleBindingCount,
      staleSourceReferenceCount,
      unresolvedQuestionCount: candidate?.unresolvedQuestions.length ?? 0,
      candidateResult: candidate?.candidateResult ?? "not-assessed",
      reviewState: candidate?.reviewState ?? "draft",
      approvalDeterminationState: "not-established",
      baselineDesignationState: "not-established",
      state: reasons.length === 0 ? "complete-for-baseline-review" : "attention-required",
      reasons,
      assessedAt,
      authorityBoundary:
        "design-baseline-status-is-observational-and-does-not-convert-an-approval-candidate-into-approval-verify-approver-authority-enforce-separation-of-duties-establish-a-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<DesignBaselineProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Design Baseline projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "design-baseline-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        state: candidate.state,
        humanDesignApproval: candidate.humanDesignApproval,
        subject: candidate.subject,
        scopeDigest: candidate.scope.scopeDigest,
        baselineLineageId: candidate.baselineLineageId,
        candidateSetId: candidate.candidateSetId,
        candidateSetRevision: candidate.candidateSetRevision,
        semanticVersion: candidate.semanticVersion,
        versionPolicyDigest: candidate.versionPolicyDigest,
        designationDefinitionDigest: candidate.designationDefinitionDigest,
        designationReceiptDigest: candidate.designationReceiptDigest,
        ...(candidate.designation ? {
          designationKind: candidate.designation.kind,
          designationDigest: candidate.designation.designationDigest,
        } : {}),
        ...(candidate.supersedes ? { supersedes: candidate.supersedes } : {}),
        candidateResult: candidate.candidateResult,
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-version-axes-counts-results-and-digests-only-not-design-content-rationale-evidence-source-content-human-attribution-personal-content-secrets-credentials-or-permissions" as const,
      authorityBoundary:
        "design-baseline-projection-is-read-only-and-does-not-convert-an-approval-candidate-into-approval-verify-approver-authority-enforce-separation-of-duties-establish-a-baseline-readiness-phase-entry-or-grant-implementation-write-import-or-action-authority" as const,
    }
    return designBaselineProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("design-baselines", currentRecordPattern, designBaselineSchema)
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) throw new Error("Design Baseline membership digest is invalid")
        if (candidate.designationReceiptDigest !== designBaselineDesignationReceiptDigest(candidate)) throw new Error("Design Baseline designation receipt digest is invalid")
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Design Baseline candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0 || status.expiredDesignationCount > 0) {
          issues.push({
            code: "design-baseline.review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale or expired Design Baseline candidate evidence.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "design-baseline.invalid",
          severity: "error",
          message: `Design Baseline ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Design Baseline Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Design Baseline candidate must bind exact current Product and Initiative revisions and digests")
    }
  }

  private async requireCurrentApproval(input: DesignBaselineInput) {
    const [record, status] = await Promise.all([
      this.humanDesignApproval.readCurrent(input.initiativeId),
      this.humanDesignApproval.assess(input.initiativeId),
    ])
    if (!record || record.candidateResult !== "approved-candidate" || record.reviewState !== "recorded-human-decision") {
      throw new Error("Design Baseline requires the exact current approved Human Design Approval decision candidate")
    }
    const expected = designBaselineApprovalReference(record, status)
    if (canonicalDigest(input.humanDesignApproval) !== canonicalDigest(expected)) {
      throw new Error("Design Baseline must bind the exact current Human Design Approval candidate and assessment")
    }
    return { record, status }
  }

  private validateSubjectAndScope(input: DesignBaselineInput | DesignBaseline, approval: HumanDesignApproval): void {
    if (canonicalDigest(input.subject) !== canonicalDigest(approval.subject) ||
        canonicalDigest(input.scope) !== canonicalDigest(approval.scope)) {
      throw new Error("Design Baseline must preserve the exact Human Design Approval subject and scope")
    }
  }

  private validateDesignationReceipt(input: DesignBaselineInput): void {
    if (input.designationReceiptDigest !== designBaselineDesignationReceiptDigest(input)) {
      throw new Error("Design Baseline designation receipt must bind exact approval, subject, scope, version axes, definition, designation, and predecessor")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Design Baseline Source identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Design Baseline is immutable`)
    return { product, initiative }
  }

  private async commitVersionedRecord(record: DesignBaseline, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, designBaselineSchema),
        this.governed(this.historyPath(record.id, record.revision), record, designBaselineSchema),
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
          humanDesignApproval: record.humanDesignApproval,
          subject: record.subject,
          scopeDigest: record.scope.scopeDigest,
          includedItemCount: record.scope.includedItemDigests.length,
          excludedItemCount: record.scope.excludedItemDigests.length,
          baselineLineageId: record.baselineLineageId,
          candidateSetId: record.candidateSetId,
          candidateSetRevision: record.candidateSetRevision,
          semanticVersion: record.semanticVersion,
          versionPolicyDigest: record.versionPolicyDigest,
          designationDefinitionDigest: record.designationDefinitionDigest,
          designationReceiptDigest: record.designationReceiptDigest,
          designation: record.designation ? {
            key: record.designation.key,
            kind: record.designation.kind,
            designationDigest: record.designation.designationDigest,
            rationaleDigest: record.designation.rationaleDigest,
            evidenceDigests: record.designation.evidenceDigests,
            proposedAt: record.designation.proposedAt,
            validUntil: record.designation.validUntil,
            authorityEvidenceState: record.designation.authorityEvidenceState,
            independenceState: record.designation.independenceState,
            effectState: record.designation.effectState,
          } : undefined,
          supersedes: record.supersedes,
          candidateResult: record.candidateResult,
          unresolvedQuestionCount: record.unresolvedQuestions.length,
          reviewState: record.reviewState,
          approvalDeterminationState: record.approvalDeterminationState,
          baselineDesignationState: record.baselineDesignationState,
          approverAuthorityState: record.approverAuthorityState,
          separationOfDutiesEnforcementState: record.separationOfDutiesEnforcementState,
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
    return this.repository.resolve("design-baselines", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("design-baseline-history", `design-baseline-${id}-r${revision}.json`)
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
    if (names.length > inventoryLimit) throw new Error(`Design Baseline directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
