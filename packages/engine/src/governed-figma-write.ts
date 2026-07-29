import { randomUUID } from "node:crypto"

import {
  exactSourceReferenceSchema,
  governedFigmaWriteInputSchema,
  governedFigmaWriteProjectionSchema,
  governedFigmaWriteSchema,
  governedFigmaWriteStatusSchema,
  type BusinessContextBinding,
  type ExactSourceReference,
  type GovernedFigmaWrite,
  type GovernedFigmaWriteInput,
  type GovernedFigmaWriteProjection,
  type GovernedFigmaWriteStatus,
  type Initiative,
  type OutboundDesignBriefPackage,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { OutboundDesignBriefPackageService } from "./outbound-design-brief-package.js"
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

function exactReference(record: GovernedFigmaWrite) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: GovernedFigmaWriteInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    objectiveDigest: input.objectiveDigest,
    outboundPackage: input.outboundPackage,
    target: input.target,
    requestFormat: input.requestFormat,
    requestDigest: input.requestDigest,
    effectDigest: input.effectDigest,
    preview: input.preview,
    approval: input.approval,
    permissionEvidence: input.permissionEvidence,
    idempotency: input.idempotency,
    recoveryPlan: input.recoveryPlan,
    disclosures: input.disclosures,
    sources: input.sources,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    writePlanState: input.writePlanState,
    packageMaterializationState: input.packageMaterializationState,
    contextTransferState: input.contextTransferState,
    figmaConnectionAuthorityState: input.figmaConnectionAuthorityState,
    credentialAuthorityState: input.credentialAuthorityState,
    permissionGrantState: input.permissionGrantState,
    figmaWriteAuthorityState: input.figmaWriteAuthorityState,
    writeExecutionState: input.writeExecutionState,
    writeResultState: input.writeResultState,
    externalVersionValidationState: input.externalVersionValidationState,
    targetValidityState: input.targetValidityState,
    designValidityState: input.designValidityState,
    designApprovalState: input.designApprovalState,
    designBaselineState: input.designBaselineState,
    readinessState: input.readinessState,
    implementationAuthorityState: input.implementationAuthorityState,
  }
}

function requestReceipt(input: GovernedFigmaWriteInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    objectiveDigest: input.objectiveDigest,
    outboundPackage: input.outboundPackage,
    target: {
      recipientKey: input.target.recipientKey,
      sourceTargetKey: input.target.sourceTargetKey,
      designScopeKey: input.target.designScopeKey,
      fileKey: input.target.fileKey,
      targetKind: input.target.targetKind,
      externalFileIdentityDigest: input.target.externalFileIdentityDigest,
      expectedExternalVersionDigest: input.target.expectedExternalVersionDigest,
      plannedWriteToolKey: input.target.plannedWriteToolKey,
      selectedEntryKeys: input.target.selectedEntryKeys,
      intendedEffect: input.target.intendedEffect,
    },
    requestFormat: input.requestFormat,
  }
}

function effectReceipt(input: GovernedFigmaWriteInput) {
  return {
    requestDigest: input.requestDigest,
    packageManifestDigest: input.outboundPackage.manifestDigest,
    packagePayloadDigest: input.outboundPackage.payloadDigest,
    externalFileIdentityDigest: input.target.externalFileIdentityDigest,
    expectedExternalVersionDigest: input.target.expectedExternalVersionDigest,
    plannedWriteToolKey: input.target.plannedWriteToolKey,
    selectedEntryKeys: input.target.selectedEntryKeys,
    intendedEffect: input.target.intendedEffect,
    idempotencyKeyDigest: input.idempotency.keyDigest,
    idempotencyScopeDigest: input.idempotency.scopeDigest,
  }
}

function previewReceipt(input: GovernedFigmaWriteInput) {
  return {
    packageManifestDigest: input.outboundPackage.manifestDigest,
    packagePayloadDigest: input.outboundPackage.payloadDigest,
    requestDigest: input.requestDigest,
    effectDigest: input.effectDigest,
    title: input.title,
    informationClassification: input.informationClassification,
    externalFileIdentityDigest: input.target.externalFileIdentityDigest,
    expectedExternalVersionDigest: input.target.expectedExternalVersionDigest,
    selectedEntryCount: input.target.selectedEntryKeys.length,
    approvalState: input.approval.state,
    permissionEvidenceState: input.permissionEvidence.state,
    idempotencyState: input.idempotency.state,
    recoveryPlanState: input.recoveryPlan.state,
    limitations: input.limitations,
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

export class GovernedFigmaWriteService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly outboundDesignBriefPackage: OutboundDesignBriefPackageService,
  ) {}

  async create(inputValue: GovernedFigmaWriteInput, actorId: string): Promise<GovernedFigmaWrite> {
    const input = governedFigmaWriteInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const outboundPackage = await this.requireCurrentOutboundPackage(input)
      this.validateWritePlan(input, outboundPackage)
      await this.validateSourceReferences(input, initiative.id)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Governed Figma Write candidate")
      }
      const now = new Date().toISOString()
      const record = governedFigmaWriteSchema.parse({
        schemaVersion: 1,
        kind: "governed-figma-write-candidate",
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
          "governed-figma-write-is-an-authorization-review-candidate-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
      })
      await this.commitVersionedRecord(record, "governed-figma-write.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: GovernedFigmaWriteInput,
    actorId: string,
  ): Promise<GovernedFigmaWrite> {
    const input = governedFigmaWriteInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Governed Figma Write revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Governed Figma Write Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const outboundPackage = await this.requireCurrentOutboundPackage(input)
      this.validateWritePlan(input, outboundPackage)
      await this.validateSourceReferences(input, initiative.id)
      const record = governedFigmaWriteSchema.parse({
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
      await this.commitVersionedRecord(record, "governed-figma-write.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<GovernedFigmaWrite> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Governed Figma Write ID")), governedFigmaWriteSchema)
  }

  async readCurrent(initiativeId: string): Promise<GovernedFigmaWrite | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("governed-figma-writes", currentRecordPattern, governedFigmaWriteSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Governed Figma Write candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<GovernedFigmaWrite> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Governed Figma Write history revision must be a positive integer")
    const recordId = this.requireUuid(id, "Governed Figma Write ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), governedFigmaWriteSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Governed Figma Write history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<GovernedFigmaWrite[]> {
    const recordId = this.requireUuid(id, "Governed Figma Write ID")
    const records = await this.listRecords(
      "governed-figma-write-history",
      new RegExp(`^governed-figma-write-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      governedFigmaWriteSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Governed Figma Write history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<GovernedFigmaWriteStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, currentSources, outboundPackage] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
      this.outboundDesignBriefPackage.readCurrent(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    let staleBindingCount = candidate ? this.bindingMismatchCount(candidate, product, initiative, outboundPackage) : 0
    if (candidate && outboundPackage && staleBindingCount === 0) {
      try {
        this.validateWritePlan(candidate, outboundPackage)
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
    const unresolvedDisclosureCount = candidate?.disclosures.filter((entry) => entry.state === "unresolved").length ?? 0
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const previewState = candidate?.preview.state ?? "not-generated"
    const approvalState = candidate?.approval.state ?? "not-requested"
    const permissionEvidenceState = candidate?.permissionEvidence.state ?? "not-assessed"
    const idempotencyState = candidate?.idempotency.state ?? "not-assessed"
    const replayProtectionState = candidate?.idempotency.replayProtectionState ?? "not-assessed"
    const recoveryPlanState = candidate?.recoveryPlan.state ?? "not-assessed"
    const writePlanState = candidate?.writePlanState ?? "draft"
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Governed Figma Write candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind the exact current Outbound Design Brief Package or target recipient")
    if (staleSourceReferenceCount > 0) reasons.push("One or more governed-write fields reference a superseded Source revision")
    if (candidate && candidate.target.selectedEntryKeys.length === 0) reasons.push("No exact outbound package entries are selected")
    if (unresolvedDisclosureCount > 0) reasons.push("One or more governed-write disclosures remain unresolved")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved governed-write questions")
    if (candidate && previewState !== "human-reviewed") reasons.push("The governed-write preview is not attributable human-reviewed")
    if (candidate && approvalState === "not-requested") reasons.push("Governed-write approval has not been requested")
    if (candidate && ["declined", "expired", "revoked"].includes(approvalState)) reasons.push(`Governed-write approval is ${approvalState}`)
    if (candidate && permissionEvidenceState !== "verified") reasons.push("Exact write-permission evidence is not verified")
    if (candidate && idempotencyState !== "defined") reasons.push("The governed-write idempotency key and scope are not defined")
    if (candidate && replayProtectionState !== "defined") reasons.push("Governed-write replay protection is not defined")
    if (candidate && recoveryPlanState !== "defined") reasons.push("Partial-failure and unknown-result recovery are not defined")
    if (candidate && writePlanState !== "complete-for-authorization-review") reasons.push("The governed-write plan is not complete for authorization review")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return governedFigmaWriteStatusSchema.parse({
      schemaVersion: 1,
      kind: "governed-figma-write-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      selectedEntryCount: candidate?.target.selectedEntryKeys.length ?? 0,
      unresolvedDisclosureCount,
      staleBindingCount,
      staleSourceReferenceCount,
      unresolvedQuestionCount,
      previewState,
      approvalState,
      permissionEvidenceState,
      idempotencyState,
      replayProtectionState,
      recoveryPlanState,
      writePlanState,
      reviewState,
      writeExecutionState: "not-performed",
      writeResultState: "not-recorded",
      state: reasons.length === 0 ? "complete-for-authorization-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "governed-figma-write-status-is-observational-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<GovernedFigmaWriteProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Governed Figma Write projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "governed-figma-write-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        state: candidate.state,
        requestFormat: candidate.requestFormat,
        requestDigest: candidate.requestDigest,
        effectDigest: candidate.effectDigest,
        outboundPackage: candidate.outboundPackage,
        externalFileIdentityDigest: candidate.target.externalFileIdentityDigest,
        expectedExternalVersionDigest: candidate.target.expectedExternalVersionDigest,
        selectedEntryCount: candidate.target.selectedEntryKeys.length,
        previewState: candidate.preview.state,
        ...(candidate.preview.previewDigest ? { previewDigest: candidate.preview.previewDigest } : {}),
        approvalState: candidate.approval.state,
        permissionEvidenceState: candidate.permissionEvidence.state,
        idempotencyState: candidate.idempotency.state,
        recoveryPlanState: candidate.recoveryPlan.state,
        reviewState: candidate.reviewState,
        writeExecutionState: candidate.writeExecutionState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-brief-requirement-constraint-context-item-figma-target-tool-source-approval-actor-permission-evidence-recovery-or-personal-content-secrets-or-credentials" as const,
      authorityBoundary:
        "governed-figma-write-projection-is-read-only-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority" as const,
    }
    return governedFigmaWriteProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("governed-figma-writes", currentRecordPattern, governedFigmaWriteSchema)
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) {
          throw new Error("Governed Figma Write membership digest is invalid")
        }
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Governed Figma Write candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "governed-figma-write.binding-review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale Governed Figma Write bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "governed-figma-write.invalid",
          severity: "error",
          message: `Governed Figma Write ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Governed Figma Write Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Governed Figma Write candidate must bind exact current Product and Initiative revisions and digests")
    }
  }

  private async requireCurrentOutboundPackage(input: GovernedFigmaWriteInput): Promise<OutboundDesignBriefPackage> {
    const candidate = await this.outboundDesignBriefPackage.readCurrent(input.initiativeId)
    if (!candidate || input.outboundPackage.recordId !== candidate.id ||
        input.outboundPackage.revision !== candidate.revision ||
        input.outboundPackage.digest !== canonicalDigest(candidate) ||
        input.outboundPackage.membershipDigest !== candidate.membershipDigest ||
        input.outboundPackage.manifestDigest !== candidate.manifestDigest ||
        input.outboundPackage.payloadDigest !== candidate.payloadDigest) {
      throw new Error("Governed Figma Write must bind exact current Outbound Design Brief Package identity, revision, record, membership, manifest, and payload digests")
    }
    return candidate
  }

  private validateWritePlan(input: GovernedFigmaWriteInput, outboundPackage: OutboundDesignBriefPackage): void {
    if (input.informationClassification !== outboundPackage.informationClassification) {
      throw new Error("Governed Figma Write classification must exactly preserve its Outbound Design Brief Package classification")
    }
    const recipient = outboundPackage.recipients.find((entry) => entry.key === input.target.recipientKey)
    if (!recipient || input.target.sourceTargetKey !== recipient.sourceTargetKey ||
        input.target.designScopeKey !== recipient.designScopeKey || input.target.fileKey !== recipient.fileKey ||
        input.target.targetKind !== recipient.targetKind ||
        input.target.externalFileIdentityDigest !== recipient.externalFileIdentityDigest ||
        input.target.expectedExternalVersionDigest !== recipient.externalVersionDigest ||
        input.target.plannedWriteToolKey !== recipient.plannedWriteToolKey ||
        input.target.intendedEffect !== "figma-write" || recipient.expectedEffect !== "write" ||
        canonicalDigest(input.target.selectedEntryKeys) !== canonicalDigest(recipient.entryKeys) ||
        canonicalDigest(input.target.sources) !== canonicalDigest(recipient.sources)) {
      throw new Error("Governed Figma Write target must exactly preserve one current outbound package recipient and entry mapping")
    }
    if (input.requestDigest !== canonicalDigest(requestReceipt(input))) {
      throw new Error("Governed Figma Write request digest must bind the exact governed write request")
    }
    const expectedScopeDigest = canonicalDigest({
      outboundPackage: input.outboundPackage,
      recipientKey: input.target.recipientKey,
      externalFileIdentityDigest: input.target.externalFileIdentityDigest,
      expectedExternalVersionDigest: input.target.expectedExternalVersionDigest,
    })
    if (input.idempotency.scopeDigest !== expectedScopeDigest ||
        input.idempotency.keyDigest !== canonicalDigest({ scopeDigest: expectedScopeDigest, requestDigest: input.requestDigest })) {
      throw new Error("Governed Figma Write idempotency key and scope must bind the exact package, target version, and request")
    }
    if (input.effectDigest !== canonicalDigest(effectReceipt(input))) {
      throw new Error("Governed Figma Write effect digest must bind the exact planned write effect and idempotency receipts")
    }
    if (input.preview.packageManifestDigest !== input.outboundPackage.manifestDigest ||
        input.preview.packagePayloadDigest !== input.outboundPackage.payloadDigest ||
        input.preview.requestDigest !== input.requestDigest || input.preview.effectDigest !== input.effectDigest) {
      throw new Error("Governed Figma Write preview must bind exact package, request, and effect digests")
    }
    if (input.preview.previewDigest !== undefined && input.preview.previewDigest !== canonicalDigest(previewReceipt(input))) {
      throw new Error("Governed Figma Write preview digest must bind the exact privacy-safe preview receipt")
    }
    if (["granted", "declined", "expired", "revoked"].includes(input.approval.state)) {
      const expectedApprovalScopeDigest = canonicalDigest({
        requestDigest: input.requestDigest,
        effectDigest: input.effectDigest,
        outboundPackage: input.outboundPackage,
        target: {
          recipientKey: input.target.recipientKey,
          externalFileIdentityDigest: input.target.externalFileIdentityDigest,
          expectedExternalVersionDigest: input.target.expectedExternalVersionDigest,
        },
        idempotencyKeyDigest: input.idempotency.keyDigest,
      })
      if (input.approval.scopeDigest !== expectedApprovalScopeDigest) {
        throw new Error("Governed Figma Write approval must bind the exact package, request, effect, target version, and idempotency key")
      }
    }
    if (input.permissionEvidence.state === "verified") {
      const expectedPermissionDigest = canonicalDigest({
        plannedWriteToolKey: input.target.plannedWriteToolKey,
        externalFileIdentityDigest: input.target.externalFileIdentityDigest,
        permissionKeys: input.permissionEvidence.permissionKeys,
        evidenceDigests: input.permissionEvidence.evidenceDigests,
      })
      if (input.permissionEvidence.verificationDigest !== expectedPermissionDigest) {
        throw new Error("Governed Figma Write permission verification digest must bind exact tool, target, permission keys, and evidence")
      }
    }
  }

  private bindingMismatchCount(
    input: GovernedFigmaWriteInput,
    product: Product,
    initiative: Initiative,
    outboundPackage: OutboundDesignBriefPackage | undefined,
  ): number {
    let mismatches = 0
    const expectedContext = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(input.context) !== canonicalDigest(expectedContext)) mismatches += 1
    if (!outboundPackage || input.outboundPackage.recordId !== outboundPackage.id ||
        input.outboundPackage.revision !== outboundPackage.revision ||
        input.outboundPackage.digest !== canonicalDigest(outboundPackage) ||
        input.outboundPackage.membershipDigest !== outboundPackage.membershipDigest ||
        input.outboundPackage.manifestDigest !== outboundPackage.manifestDigest ||
        input.outboundPackage.payloadDigest !== outboundPackage.payloadDigest) mismatches += 1
    return mismatches
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Governed Figma Write Source identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Governed Figma Write is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: GovernedFigmaWrite, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, governedFigmaWriteSchema),
        this.governed(this.historyPath(record.id, record.revision), record, governedFigmaWriteSchema),
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
          outboundPackage: record.outboundPackage,
          requestFormat: record.requestFormat,
          requestDigest: record.requestDigest,
          effectDigest: record.effectDigest,
          targetDigest: canonicalDigest({
            recipientKey: record.target.recipientKey,
            sourceTargetKey: record.target.sourceTargetKey,
            designScopeKey: record.target.designScopeKey,
            fileKey: record.target.fileKey,
            externalFileIdentityDigest: record.target.externalFileIdentityDigest,
            expectedExternalVersionDigest: record.target.expectedExternalVersionDigest,
            plannedWriteToolKey: record.target.plannedWriteToolKey,
            selectedEntryKeys: record.target.selectedEntryKeys,
          }),
          selectedEntryCount: record.target.selectedEntryKeys.length,
          previewDigest: record.preview.previewDigest,
          previewState: record.preview.state,
          approvalState: record.approval.state,
          approvalScopeDigest: record.approval.scopeDigest,
          approvalDecisionDigest: record.approval.decisionDigest,
          approvalEvidenceDigest: canonicalDigest(record.approval.evidenceDigests),
          permissionEvidenceState: record.permissionEvidence.state,
          permissionVerificationDigest: record.permissionEvidence.verificationDigest,
          permissionEvidenceDigest: canonicalDigest(record.permissionEvidence.evidenceDigests),
          idempotencyKeyDigest: record.idempotency.keyDigest,
          idempotencyScopeDigest: record.idempotency.scopeDigest,
          idempotencyState: record.idempotency.state,
          replayProtectionState: record.idempotency.replayProtectionState,
          priorResultDigest: record.idempotency.priorResultDigest,
          recoveryPlanState: record.recoveryPlan.state,
          recoveryPlanDigest: canonicalDigest({
            strategyDigest: record.recoveryPlan.strategyDigest,
            rollbackScopeDigest: record.recoveryPlan.rollbackScopeDigest,
            partialFailureRuleDigest: record.recoveryPlan.partialFailureRuleDigest,
            unknownResultRuleDigest: record.recoveryPlan.unknownResultRuleDigest,
            evidenceDigests: record.recoveryPlan.evidenceDigests,
          }),
          disclosureCount: record.disclosures.length,
          disclosureCatalogDigest: canonicalDigest(record.disclosures.map((entry) => ({
            key: entry.key, kind: entry.kind, materiality: entry.materiality, state: entry.state,
            subjectDigest: entry.subjectDigest, rationaleDigest: entry.rationaleDigest,
          }))),
          unresolvedQuestionCount: record.unresolvedQuestions.length,
          reviewState: record.reviewState,
          writePlanState: record.writePlanState,
          packageMaterializationState: record.packageMaterializationState,
          contextTransferState: record.contextTransferState,
          figmaConnectionAuthorityState: record.figmaConnectionAuthorityState,
          credentialAuthorityState: record.credentialAuthorityState,
          permissionGrantState: record.permissionGrantState,
          figmaWriteAuthorityState: record.figmaWriteAuthorityState,
          writeExecutionState: record.writeExecutionState,
          writeResultState: record.writeResultState,
          externalVersionValidationState: record.externalVersionValidationState,
          targetValidityState: record.targetValidityState,
          designValidityState: record.designValidityState,
          designApprovalState: record.designApprovalState,
          designBaselineState: record.designBaselineState,
          readinessState: record.readinessState,
          implementationAuthorityState: record.implementationAuthorityState,
          writeAuthorityState: "not-granted",
          actionAuthorityState: "not-granted",
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("governed-figma-writes", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("governed-figma-write-history", `governed-figma-write-${id}-r${revision}.json`)
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
    if (names.length > inventoryLimit) throw new Error(`Governed Figma Write directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
