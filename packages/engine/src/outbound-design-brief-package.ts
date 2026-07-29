import { randomUUID } from "node:crypto"

import {
  exactSourceReferenceSchema,
  outboundDesignBriefPackageInputSchema,
  outboundDesignBriefPackageProjectionSchema,
  outboundDesignBriefPackageSchema,
  outboundDesignBriefPackageStatusSchema,
  type BusinessContextBinding,
  type ContextPack,
  type ExactSourceReference,
  type FigmaContextImport,
  type Initiative,
  type OutboundDesignBriefPackage,
  type OutboundDesignBriefPackageInput,
  type OutboundDesignBriefPackageProjection,
  type OutboundDesignBriefPackageStatus,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { FigmaContextImportService } from "./figma-context-import.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type ContextPackReader = (id: string) => Promise<ContextPack>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const classificationRank = { public: 0, internal: 1, confidential: 2, restricted: 3 } as const

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: OutboundDesignBriefPackage) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: OutboundDesignBriefPackageInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    objectiveDigest: input.objectiveDigest,
    figmaContextImport: input.figmaContextImport,
    contextPacks: input.contextPacks,
    manifestFormat: input.manifestFormat,
    manifestDigest: input.manifestDigest,
    payloadDigest: input.payloadDigest,
    entries: input.entries,
    recipients: input.recipients,
    requirementCoverage: input.requirementCoverage,
    disclosures: input.disclosures,
    manifestState: input.manifestState,
    provenanceState: input.provenanceState,
    redactionReviewState: input.redactionReviewState,
    preview: input.preview,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    packageMaterializationState: input.packageMaterializationState,
    contextTransferState: input.contextTransferState,
    figmaConnectionAuthorityState: input.figmaConnectionAuthorityState,
    credentialAuthorityState: input.credentialAuthorityState,
    permissionGrantState: input.permissionGrantState,
    figmaWriteAuthorityState: input.figmaWriteAuthorityState,
    targetValidityState: input.targetValidityState,
    externalCompletenessState: input.externalCompletenessState,
    designValidityState: input.designValidityState,
    designApprovalState: input.designApprovalState,
    designBaselineState: input.designBaselineState,
    readinessState: input.readinessState,
    implementationAuthorityState: input.implementationAuthorityState,
  }
}

function manifestReceipt(input: OutboundDesignBriefPackageInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    objectiveDigest: input.objectiveDigest,
    figmaContextImport: input.figmaContextImport,
    contextPacks: input.contextPacks,
    manifestFormat: input.manifestFormat,
    entries: input.entries,
    recipients: input.recipients,
    requirementCoverage: input.requirementCoverage,
    disclosures: input.disclosures,
  }
}

function payloadReceipt(input: OutboundDesignBriefPackageInput) {
  return {
    entries: input.entries.map((entry) => ({
      key: entry.key,
      sourceSectionKey: entry.sourceSectionKey,
      contextPackId: entry.contextPackId,
      contextItemIds: entry.contextItemIds,
      contentDigest: entry.contentDigest,
      transformationDigest: entry.transformationDigest,
      selectionReasonDigest: entry.selectionReasonDigest,
      informationClassification: entry.informationClassification,
      redactionState: entry.redactionState,
      requirementKeys: entry.requirementKeys,
      recipientKeys: entry.recipientKeys,
    })),
    recipients: input.recipients.map((recipient) => ({
      key: recipient.key,
      sourceTargetKey: recipient.sourceTargetKey,
      externalFileIdentityDigest: recipient.externalFileIdentityDigest,
      externalVersionDigest: recipient.externalVersionDigest,
      entryKeys: recipient.entryKeys,
      purposeDigest: recipient.purposeDigest,
      policyBasisDigest: recipient.policyBasisDigest,
      retentionRuleDigest: recipient.retentionRuleDigest,
    })),
    requirementCoverage: input.requirementCoverage.map((coverage) => ({
      requirementKey: coverage.requirementKey,
      state: coverage.state,
      entryKeys: coverage.entryKeys,
      recipientKeys: coverage.recipientKeys,
      rationaleDigest: coverage.rationaleDigest,
    })),
    disclosures: input.disclosures.map((disclosure) => ({
      key: disclosure.key,
      kind: disclosure.kind,
      materiality: disclosure.materiality,
      state: disclosure.state,
      subjectDigest: disclosure.subjectDigest,
      rationaleDigest: disclosure.rationaleDigest,
    })),
  }
}

function previewReceipt(input: OutboundDesignBriefPackageInput) {
  return {
    manifestDigest: input.manifestDigest,
    payloadDigest: input.payloadDigest,
    title: input.title,
    informationClassification: input.informationClassification,
    contextPackCount: input.contextPacks.length,
    entryCount: input.entries.length,
    contextItemCount: input.entries.reduce((total, entry) => total + entry.contextItemIds.length, 0),
    recipientCount: input.recipients.length,
    representedRequirementCount: input.requirementCoverage.filter((entry) => entry.state === "represented").length,
    unresolvedDisclosureCount: input.disclosures.filter((entry) => entry.state === "unresolved").length,
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

export class OutboundDesignBriefPackageService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly readContextPack: ContextPackReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly figmaContextImport: FigmaContextImportService,
  ) {}

  async create(inputValue: OutboundDesignBriefPackageInput, actorId: string): Promise<OutboundDesignBriefPackage> {
    const input = outboundDesignBriefPackageInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const contextImport = await this.requireCurrentContextImport(input)
      const contextPacks = await this.requireCurrentContextPacks(input, product)
      this.validateManifest(input, contextImport, contextPacks)
      await this.validateSourceReferences(input, initiative.id)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Outbound Design Brief Package candidate")
      }
      const now = new Date().toISOString()
      const record = outboundDesignBriefPackageSchema.parse({
        schemaVersion: 1,
        kind: "outbound-design-brief-package-candidate",
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
          "outbound-design-brief-package-is-a-versioned-manifest-only-candidate-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
      })
      await this.commitVersionedRecord(record, "outbound-design-brief-package.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: OutboundDesignBriefPackageInput,
    actorId: string,
  ): Promise<OutboundDesignBriefPackage> {
    const input = outboundDesignBriefPackageInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Outbound Design Brief Package revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Outbound Design Brief Package Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const contextImport = await this.requireCurrentContextImport(input)
      const contextPacks = await this.requireCurrentContextPacks(input, product)
      this.validateManifest(input, contextImport, contextPacks)
      await this.validateSourceReferences(input, initiative.id)
      const record = outboundDesignBriefPackageSchema.parse({
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
      await this.commitVersionedRecord(record, "outbound-design-brief-package.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<OutboundDesignBriefPackage> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Outbound Design Brief Package ID")),
      outboundDesignBriefPackageSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<OutboundDesignBriefPackage | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("outbound-design-brief-packages", currentRecordPattern, outboundDesignBriefPackageSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Outbound Design Brief Package candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<OutboundDesignBriefPackage> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Outbound Design Brief Package history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Outbound Design Brief Package ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), outboundDesignBriefPackageSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Outbound Design Brief Package history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<OutboundDesignBriefPackage[]> {
    const recordId = this.requireUuid(id, "Outbound Design Brief Package ID")
    const records = await this.listRecords(
      "outbound-design-brief-package-history",
      new RegExp(`^outbound-design-brief-package-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      outboundDesignBriefPackageSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Outbound Design Brief Package history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<OutboundDesignBriefPackageStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, currentSources, contextImport] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
      this.figmaContextImport.readCurrent(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const contextPacks = candidate
      ? await this.readCurrentContextPacks(candidate.contextPacks.map((entry) => entry.recordId))
      : new Map<string, ContextPack>()
    let staleBindingCount = candidate
      ? this.bindingMismatchCount(candidate, product, initiative, contextImport, contextPacks)
      : 0
    if (candidate && contextImport && staleBindingCount === 0 && contextPacks.size === candidate.contextPacks.length) {
      try {
        this.validateManifest(candidate, contextImport, [...contextPacks.values()])
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
    const entries = candidate?.entries ?? []
    const coverage = candidate?.requirementCoverage ?? []
    const recipients = candidate?.recipients ?? []
    const disclosures = candidate?.disclosures ?? []
    const humanReviewedEntryCount = entries.filter((entry) => entry.evidence.state === "human-reviewed").length
    const sourceRecordedEntryCount = entries.filter((entry) => entry.evidence.state === "source-recorded").length
    const notAssessedEntryCount = entries.filter((entry) => entry.evidence.state === "not-assessed").length
    const unresolvedRedactionCount = entries.filter((entry) => entry.redactionState === "unresolved").length
    const representedRequirementCount = coverage.filter((entry) => entry.state === "represented").length
    const unresolvedRequirementCount = coverage.filter((entry) => entry.state === "unresolved").length
    const unresolvedDisclosureCount = disclosures.filter((entry) => entry.state === "unresolved").length
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const manifestState = candidate?.manifestState ?? "not-assessed"
    const provenanceState = candidate?.provenanceState ?? "not-assessed"
    const redactionReviewState = candidate?.redactionReviewState ?? "not-assessed"
    const previewState = candidate?.preview.state ?? "not-generated"
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Outbound Design Brief Package candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind exact current Figma Context Import or Context Pack records")
    if (staleSourceReferenceCount > 0) reasons.push("One or more package entries reference a superseded Source revision")
    if (candidate && candidate.contextPacks.length === 0) reasons.push("No exact Context Packs are bound")
    if (entries.length === 0) reasons.push("No bounded outbound package entries are recorded")
    if (recipients.length === 0) reasons.push("No bounded Figma recipients are recorded")
    if (sourceRecordedEntryCount > 0) reasons.push("One or more package entries are source-recorded but not attributable human-reviewed")
    if (notAssessedEntryCount > 0) reasons.push("One or more package entries have not been assessed")
    if (unresolvedRedactionCount > 0) reasons.push("One or more package entry redactions remain unresolved")
    if (unresolvedRequirementCount > 0) reasons.push("One or more Design Requirements remain unrepresented")
    if (unresolvedDisclosureCount > 0) reasons.push("One or more exclusions, conflicts, or access failures remain unresolved")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved outbound package questions")
    if (candidate && manifestState !== "candidate-complete") reasons.push("The outbound manifest is not marked candidate-complete")
    if (candidate && provenanceState !== "exact") reasons.push("The outbound manifest provenance is not exact")
    if (candidate && redactionReviewState !== "complete") reasons.push("The outbound manifest redaction review is not complete")
    if (candidate && previewState !== "human-reviewed") reasons.push("The outbound package preview is not human-reviewed")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return outboundDesignBriefPackageStatusSchema.parse({
      schemaVersion: 1,
      kind: "outbound-design-brief-package-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      contextPackCount: candidate?.contextPacks.length ?? 0,
      entryCount: entries.length,
      contextItemCount: entries.reduce((total, entry) => total + entry.contextItemIds.length, 0),
      recipientCount: recipients.length,
      humanReviewedEntryCount,
      sourceRecordedEntryCount,
      notAssessedEntryCount,
      unresolvedRedactionCount,
      representedRequirementCount,
      unresolvedRequirementCount,
      unresolvedDisclosureCount,
      staleBindingCount,
      staleSourceReferenceCount,
      unresolvedQuestionCount,
      manifestState,
      provenanceState,
      redactionReviewState,
      previewState,
      reviewState,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "outbound-design-brief-package-status-is-observational-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<OutboundDesignBriefPackageProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Outbound Design Brief Package projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "outbound-design-brief-package-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        state: candidate.state,
        manifestFormat: candidate.manifestFormat,
        manifestDigest: candidate.manifestDigest,
        payloadDigest: candidate.payloadDigest,
        contextPackCount: candidate.contextPacks.length,
        entryCount: candidate.entries.length,
        contextItemCount: candidate.entries.reduce((total, entry) => total + entry.contextItemIds.length, 0),
        recipientCount: candidate.recipients.length,
        representedRequirementCount: candidate.requirementCoverage.filter((entry) => entry.state === "represented").length,
        unresolvedDisclosureCount: candidate.disclosures.filter((entry) => entry.state === "unresolved").length,
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-brief-requirement-constraint-context-item-figma-target-tool-source-transformation-disclosure-or-personal-content-secrets-credentials-or-permissions" as const,
      authorityBoundary:
        "outbound-design-brief-package-projection-is-read-only-and-does-not-materialize-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority" as const,
    }
    return outboundDesignBriefPackageProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("outbound-design-brief-packages", currentRecordPattern, outboundDesignBriefPackageSchema)
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) {
          throw new Error("Outbound Design Brief Package membership digest is invalid")
        }
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Outbound Design Brief Package candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "outbound-design-brief-package.binding-review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale Outbound Design Brief Package bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "outbound-design-brief-package.invalid",
          severity: "error",
          message: `Outbound Design Brief Package ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Outbound Design Brief Package Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Outbound Design Brief Package candidate must bind exact current Product and Initiative revisions and digests")
    }
  }

  private async requireCurrentContextImport(input: OutboundDesignBriefPackageInput): Promise<FigmaContextImport> {
    const candidate = await this.figmaContextImport.readCurrent(input.initiativeId)
    if (!candidate || input.figmaContextImport.recordId !== candidate.id ||
        input.figmaContextImport.revision !== candidate.revision ||
        input.figmaContextImport.digest !== canonicalDigest(candidate) ||
        input.figmaContextImport.membershipDigest !== candidate.membershipDigest) {
      throw new Error("Outbound Design Brief Package must bind exact current Figma Context Import identity, revision, digest, and membership")
    }
    return candidate
  }

  private async requireCurrentContextPacks(input: OutboundDesignBriefPackageInput, product: Product): Promise<ContextPack[]> {
    const packs: ContextPack[] = []
    for (const reference of input.contextPacks) {
      const pack = await this.readContextPack(reference.recordId)
      if (pack.productId !== product.id || pack.revision !== reference.revision || canonicalDigest(pack) !== reference.digest ||
          pack.packDigest !== reference.packDigest) {
        throw new Error("Outbound Design Brief Package must bind exact current Context Pack identity, revision, record digest, and pack digest")
      }
      packs.push(pack)
    }
    return packs
  }

  private async readCurrentContextPacks(ids: string[]): Promise<Map<string, ContextPack>> {
    const results = await Promise.allSettled(ids.map((id) => this.readContextPack(id)))
    const packs = new Map<string, ContextPack>()
    for (const result of results) if (result.status === "fulfilled") packs.set(result.value.id, result.value)
    return packs
  }

  private validateManifest(
    input: OutboundDesignBriefPackageInput,
    contextImport: FigmaContextImport,
    contextPacks: ContextPack[],
  ): void {
    if (canonicalDigest(input.contextPacks) !== canonicalDigest(contextImport.contextPacks)) {
      throw new Error("Outbound Design Brief Package Context Pack catalog must exactly match the current Figma Context Import selection")
    }
    const packById = new Map(contextPacks.map((pack) => [pack.id, pack]))
    const importSectionByKey = new Map(contextImport.sections.map((section) => [section.key, section]))
    const entryBySourceSection = new Map(input.entries.map((entry) => [entry.sourceSectionKey, entry]))
    for (const entry of input.entries) {
      const section = importSectionByKey.get(entry.sourceSectionKey)
      if (!section || section.kind !== entry.kind || section.contextPackId !== entry.contextPackId ||
          canonicalDigest(section.contextItemIds) !== canonicalDigest(entry.contextItemIds) ||
          section.contentDigest !== entry.contentDigest || section.transformationDigest !== entry.transformationDigest ||
          section.informationClassification !== entry.informationClassification || section.redactionState !== entry.redactionState ||
          canonicalDigest(section.sources) !== canonicalDigest(entry.sources)) {
        throw new Error("Outbound Design Brief Package entry must exactly preserve its selected Figma Context Import section")
      }
      const pack = packById.get(entry.contextPackId)
      if (!pack || entry.contextItemIds.some((id) => !pack.items.some((item) => item.id === id))) {
        throw new Error("Outbound Design Brief Package entry contains an unknown Context Item")
      }
      if (entry.selectionReasonDigest !== canonicalDigest({
        objectiveDigest: input.objectiveDigest,
        sourceSectionKey: entry.sourceSectionKey,
        requirementKeys: entry.requirementKeys,
        recipientKeys: entry.recipientKeys,
      })) {
        throw new Error("Outbound Design Brief Package entry selection reason digest must bind objective, section, Requirements, and recipients")
      }
    }
    if (input.manifestState === "candidate-complete" &&
        (entryBySourceSection.size !== contextImport.sections.length ||
         contextImport.sections.some((section) => !entryBySourceSection.has(section.key)))) {
      throw new Error("Candidate-complete Outbound Design Brief Package must preserve every selected Figma Context Import section")
    }
    const importTargetByKey = new Map(contextImport.targets.map((target) => [target.key, target]))
    const recipientBySourceTarget = new Map(input.recipients.map((recipient) => [recipient.sourceTargetKey, recipient]))
    for (const recipient of input.recipients) {
      const target = importTargetByKey.get(recipient.sourceTargetKey)
      const expectedEntryKeys = target?.sectionKeys.map((sectionKey) => entryBySourceSection.get(sectionKey)?.key)
      if (!target || target.designScopeKey !== recipient.designScopeKey || target.fileKey !== recipient.fileKey ||
          target.externalFileIdentityDigest !== recipient.externalFileIdentityDigest ||
          target.externalVersionDigest !== recipient.externalVersionDigest ||
          target.plannedWriteToolKey !== recipient.plannedWriteToolKey || target.expectedEffect !== recipient.expectedEffect ||
          target.permissionRequirementState !== recipient.permissionRequirementState ||
          expectedEntryKeys?.some((key) => key === undefined) ||
          canonicalDigest(expectedEntryKeys) !== canonicalDigest(recipient.entryKeys) ||
          canonicalDigest(target.sources) !== canonicalDigest(recipient.sources)) {
        throw new Error("Outbound Design Brief Package recipient must exactly preserve its Figma Context Import target and entry mapping")
      }
      if (recipient.purposeDigest !== canonicalDigest({
        objectiveDigest: input.objectiveDigest,
        sourceTargetKey: recipient.sourceTargetKey,
        entryKeys: recipient.entryKeys,
      })) {
        throw new Error("Outbound Design Brief Package recipient purpose digest must bind objective, target, and entries")
      }
    }
    if (input.manifestState === "candidate-complete" &&
        (recipientBySourceTarget.size !== contextImport.targets.length ||
         contextImport.targets.some((target) => !recipientBySourceTarget.has(target.key)))) {
      throw new Error("Candidate-complete Outbound Design Brief Package must preserve every selected Figma Context Import target")
    }
    const importCoverageByRequirement = new Map(contextImport.requirementCoverage.map((coverage) => [coverage.requirementKey, coverage]))
    for (const coverage of input.requirementCoverage) {
      const imported = importCoverageByRequirement.get(coverage.requirementKey)
      const expectedEntryKeys = imported?.sectionKeys.map((key) => entryBySourceSection.get(key)?.key)
      const expectedRecipientKeys = imported?.targetKeys.map((key) => recipientBySourceTarget.get(key)?.key)
      if (!imported || imported.state !== coverage.state || imported.rationaleDigest !== coverage.rationaleDigest ||
          expectedEntryKeys?.some((key) => key === undefined) || expectedRecipientKeys?.some((key) => key === undefined) ||
          canonicalDigest(expectedEntryKeys) !== canonicalDigest(coverage.entryKeys) ||
          canonicalDigest(expectedRecipientKeys) !== canonicalDigest(coverage.recipientKeys) ||
          canonicalDigest(imported.sources) !== canonicalDigest(coverage.sources)) {
        throw new Error("Outbound Design Brief Package Requirement coverage must exactly preserve the Figma Context Import mapping")
      }
    }
    if (input.requirementCoverage.length !== contextImport.requirementCoverage.length) {
      throw new Error("Outbound Design Brief Package coverage must reconcile every Figma Context Import Requirement")
    }
    const maximumClassification = contextPacks.reduce<keyof typeof classificationRank>((maximum, pack) =>
      classificationRank[pack.classification.level] > classificationRank[maximum] ? pack.classification.level : maximum,
    "public")
    if (input.informationClassification !== maximumClassification) {
      throw new Error("Outbound Design Brief Package classification must equal the highest selected Context Pack classification")
    }
    if (input.manifestDigest !== canonicalDigest(manifestReceipt(input))) {
      throw new Error("Outbound Design Brief Package manifest digest must bind the exact governed manifest")
    }
    if (input.payloadDigest !== canonicalDigest(payloadReceipt(input))) {
      throw new Error("Outbound Design Brief Package payload digest must bind the exact digest-only payload manifest")
    }
    if (input.preview.manifestDigest !== input.manifestDigest || input.preview.payloadDigest !== input.payloadDigest) {
      throw new Error("Outbound Design Brief Package preview must bind the exact manifest and payload digests")
    }
    if (input.preview.previewDigest !== undefined && input.preview.previewDigest !== canonicalDigest(previewReceipt(input))) {
      throw new Error("Outbound Design Brief Package preview digest must bind the exact privacy-safe preview receipt")
    }
  }

  private bindingMismatchCount(
    input: OutboundDesignBriefPackageInput,
    product: Product,
    initiative: Initiative,
    contextImport: FigmaContextImport | undefined,
    contextPacks: Map<string, ContextPack>,
  ): number {
    let mismatches = 0
    const expectedContext = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(input.context) !== canonicalDigest(expectedContext)) mismatches += 1
    if (!contextImport || input.figmaContextImport.recordId !== contextImport.id ||
        input.figmaContextImport.revision !== contextImport.revision ||
        input.figmaContextImport.digest !== canonicalDigest(contextImport) ||
        input.figmaContextImport.membershipDigest !== contextImport.membershipDigest) mismatches += 1
    for (const reference of input.contextPacks) {
      const pack = contextPacks.get(reference.recordId)
      if (!pack || pack.productId !== product.id || pack.revision !== reference.revision ||
          canonicalDigest(pack) !== reference.digest || pack.packDigest !== reference.packDigest) mismatches += 1
    }
    return mismatches
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Outbound Design Brief Package Source identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Outbound Design Brief Package is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: OutboundDesignBriefPackage, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, outboundDesignBriefPackageSchema),
        this.governed(this.historyPath(record.id, record.revision), record, outboundDesignBriefPackageSchema),
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
          figmaContextImport: record.figmaContextImport,
          contextPackCount: record.contextPacks.length,
          contextPackCatalogDigest: canonicalDigest(record.contextPacks),
          manifestFormat: record.manifestFormat,
          manifestDigest: record.manifestDigest,
          payloadDigest: record.payloadDigest,
          entryCount: record.entries.length,
          contextItemCount: record.entries.reduce((total, entry) => total + entry.contextItemIds.length, 0),
          entryCatalogDigest: canonicalDigest(record.entries.map((entry) => ({
            key: entry.key,
            sourceSectionKey: entry.sourceSectionKey,
            kind: entry.kind,
            contextPackId: entry.contextPackId,
            contextItemCount: entry.contextItemIds.length,
            contentDigest: entry.contentDigest,
            transformationDigest: entry.transformationDigest,
            selectionReasonDigest: entry.selectionReasonDigest,
            informationClassification: entry.informationClassification,
            redactionState: entry.redactionState,
            evidenceState: entry.evidence.state,
          }))),
          recipientCount: record.recipients.length,
          recipientCatalogDigest: canonicalDigest(record.recipients.map((recipient) => ({
            key: recipient.key,
            sourceTargetKey: recipient.sourceTargetKey,
            designScopeKey: recipient.designScopeKey,
            fileKey: recipient.fileKey,
            externalFileIdentityDigest: recipient.externalFileIdentityDigest,
            externalVersionDigest: recipient.externalVersionDigest,
            plannedWriteToolKey: recipient.plannedWriteToolKey,
            permissionRequirementState: recipient.permissionRequirementState,
            purposeDigest: recipient.purposeDigest,
            policyBasisDigest: recipient.policyBasisDigest,
            retentionRuleDigest: recipient.retentionRuleDigest,
            destinationState: recipient.destinationState,
            deliveryState: recipient.deliveryState,
          }))),
          requirementCoverageCount: record.requirementCoverage.length,
          requirementCoverageDigest: canonicalDigest(record.requirementCoverage.map((coverage) => ({
            requirementKey: coverage.requirementKey,
            state: coverage.state,
            rationaleDigest: coverage.rationaleDigest,
          }))),
          disclosureCount: record.disclosures.length,
          disclosureCatalogDigest: canonicalDigest(record.disclosures.map((disclosure) => ({
            key: disclosure.key,
            kind: disclosure.kind,
            materiality: disclosure.materiality,
            state: disclosure.state,
            subjectDigest: disclosure.subjectDigest,
            rationaleDigest: disclosure.rationaleDigest,
            evidenceState: disclosure.evidence.state,
          }))),
          previewDigest: record.preview.previewDigest,
          previewState: record.preview.state,
          manifestState: record.manifestState,
          provenanceState: record.provenanceState,
          redactionReviewState: record.redactionReviewState,
          reviewState: record.reviewState,
          packageMaterializationState: record.packageMaterializationState,
          contextTransferState: record.contextTransferState,
          figmaConnectionAuthorityState: record.figmaConnectionAuthorityState,
          credentialAuthorityState: record.credentialAuthorityState,
          permissionGrantState: record.permissionGrantState,
          figmaWriteAuthorityState: record.figmaWriteAuthorityState,
          targetValidityState: record.targetValidityState,
          externalCompletenessState: record.externalCompletenessState,
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
    return this.repository.resolve("outbound-design-brief-packages", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("outbound-design-brief-package-history", `outbound-design-brief-package-${id}-r${revision}.json`)
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
    if (names.length > inventoryLimit) throw new Error(`Outbound Design Brief Package directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
