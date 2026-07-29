import { randomUUID } from "node:crypto"

import {
  exactSourceReferenceSchema,
  figmaContextImportInputSchema,
  figmaContextImportProjectionSchema,
  figmaContextImportSchema,
  figmaContextImportStatusSchema,
  type AccessibilityDesignRules,
  type BusinessContextBinding,
  type ContextPack,
  type DesignApplicability,
  type DesignRequirements,
  type DesignSystemTokenContract,
  type ExactSourceReference,
  type FigmaContextImport,
  type FigmaContextImportInput,
  type FigmaContextImportProjection,
  type FigmaContextImportStatus,
  type FigmaMcpCapabilityDiscovery,
  type FigmaReadSnapshot,
  type Initiative,
  type ManualFigmaExecutionPath,
  type Product,
  type ResponsiveMultiPlatformTargets,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { AccessibilityDesignRulesService } from "./accessibility-design-rules.js"
import type { DesignApplicabilityService } from "./design-applicability.js"
import type { DesignRequirementsService } from "./design-requirements.js"
import type { DesignSystemTokenContractService } from "./design-system-token-contract.js"
import type { FigmaMcpCapabilityDiscoveryService } from "./figma-mcp-capability-discovery.js"
import type { FigmaReadSnapshotService } from "./figma-read-snapshot.js"
import type { ManualFigmaExecutionPathService } from "./manual-figma-execution-path.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { ResponsiveMultiPlatformTargetsService } from "./responsive-multi-platform-targets.js"
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

function exactReference(record: FigmaContextImport) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: FigmaContextImportInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    designApplicability: input.designApplicability,
    designRequirements: input.designRequirements,
    designSystemTokenContract: input.designSystemTokenContract,
    accessibilityDesignRules: input.accessibilityDesignRules,
    responsiveMultiPlatformTargets: input.responsiveMultiPlatformTargets,
    manualFigmaExecutionPath: input.manualFigmaExecutionPath,
    figmaMcpCapabilityDiscovery: input.figmaMcpCapabilityDiscovery,
    figmaReadSnapshot: input.figmaReadSnapshot,
    contextPacks: input.contextPacks,
    sections: input.sections,
    targets: input.targets,
    requirementCoverage: input.requirementCoverage,
    preview: input.preview,
    contextSelectionState: input.contextSelectionState,
    provenanceState: input.provenanceState,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    packagePreparationState: input.packagePreparationState,
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

function selectionReceipt(input: FigmaContextImportInput) {
  return {
    designApplicability: input.designApplicability,
    designRequirements: input.designRequirements,
    designSystemTokenContract: input.designSystemTokenContract,
    accessibilityDesignRules: input.accessibilityDesignRules,
    responsiveMultiPlatformTargets: input.responsiveMultiPlatformTargets,
    manualFigmaExecutionPath: input.manualFigmaExecutionPath,
    figmaMcpCapabilityDiscovery: input.figmaMcpCapabilityDiscovery,
    figmaReadSnapshot: input.figmaReadSnapshot,
    contextPacks: input.contextPacks,
    sections: input.sections,
    targets: input.targets,
    requirementCoverage: input.requirementCoverage,
  }
}

function previewReceipt(input: FigmaContextImportInput) {
  return {
    selectionDigest: input.preview.selectionDigest,
    title: input.title,
    informationClassification: input.informationClassification,
    contextPackCount: input.contextPacks.length,
    sectionCount: input.sections.length,
    contextItemCount: input.sections.reduce((total, section) => total + section.contextItemIds.length, 0),
    targetCount: input.targets.length,
    requirementCoverageCount: input.requirementCoverage.length,
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

interface CurrentBindings {
  designApplicability: DesignApplicability
  designRequirements: DesignRequirements
  designSystemTokenContract: DesignSystemTokenContract
  accessibilityDesignRules: AccessibilityDesignRules
  responsiveMultiPlatformTargets: ResponsiveMultiPlatformTargets
  manualFigmaExecutionPath: ManualFigmaExecutionPath
  figmaMcpCapabilityDiscovery: FigmaMcpCapabilityDiscovery
  figmaReadSnapshot: FigmaReadSnapshot
}

export class FigmaContextImportService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly readContextPack: ContextPackReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly designApplicability: DesignApplicabilityService,
    private readonly designRequirements: DesignRequirementsService,
    private readonly designSystemTokenContract: DesignSystemTokenContractService,
    private readonly accessibilityDesignRules: AccessibilityDesignRulesService,
    private readonly responsiveMultiPlatformTargets: ResponsiveMultiPlatformTargetsService,
    private readonly manualFigmaExecutionPath: ManualFigmaExecutionPathService,
    private readonly figmaMcpCapabilityDiscovery: FigmaMcpCapabilityDiscoveryService,
    private readonly figmaReadSnapshot: FigmaReadSnapshotService,
  ) {}

  async create(inputValue: FigmaContextImportInput, actorId: string): Promise<FigmaContextImport> {
    const input = figmaContextImportInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const bindings = await this.requireCurrentBindings(input)
      const contextPacks = await this.requireCurrentContextPacks(input, product)
      this.validateSelection(input, bindings, contextPacks)
      await this.validateSourceReferences(input, initiative.id)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Figma Context Import candidate")
      }
      const now = new Date().toISOString()
      const record = figmaContextImportSchema.parse({
        schemaVersion: 1,
        kind: "figma-context-import-candidate",
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
          "figma-context-import-is-a-source-backed-candidate-selection-and-does-not-package-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
      })
      await this.commitVersionedRecord(record, "figma-context-import.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: FigmaContextImportInput,
    actorId: string,
  ): Promise<FigmaContextImport> {
    const input = figmaContextImportInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Figma Context Import revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Figma Context Import Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const bindings = await this.requireCurrentBindings(input)
      const contextPacks = await this.requireCurrentContextPacks(input, product)
      this.validateSelection(input, bindings, contextPacks)
      await this.validateSourceReferences(input, initiative.id)
      const record = figmaContextImportSchema.parse({
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
      await this.commitVersionedRecord(record, "figma-context-import.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<FigmaContextImport> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Figma Context Import ID")),
      figmaContextImportSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<FigmaContextImport | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("figma-context-imports", currentRecordPattern, figmaContextImportSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Figma Context Import candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<FigmaContextImport> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Figma Context Import history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Figma Context Import ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), figmaContextImportSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Figma Context Import history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<FigmaContextImport[]> {
    const recordId = this.requireUuid(id, "Figma Context Import ID")
    const records = await this.listRecords(
      "figma-context-import-history",
      new RegExp(`^figma-context-import-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      figmaContextImportSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Figma Context Import history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<FigmaContextImportStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const bindings = await this.readCurrentBindings(targetId)
    const contextPacks = candidate ? await this.readCurrentContextPacks(candidate.contextPacks.map((entry) => entry.recordId)) : new Map<string, ContextPack>()
    let staleBindingCount = candidate ? this.bindingMismatchCount(candidate, product, initiative, bindings, contextPacks) : 0
    if (candidate && staleBindingCount === 0 && this.hasAllBindings(bindings) && contextPacks.size === candidate.contextPacks.length) {
      try {
        this.validateSelection(candidate, bindings, [...contextPacks.values()])
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
    const sections = candidate?.sections ?? []
    const coverage = candidate?.requirementCoverage ?? []
    const targets = candidate?.targets ?? []
    const humanReviewedSectionCount = sections.filter((entry) => entry.evidence.state === "human-reviewed").length
    const sourceRecordedSectionCount = sections.filter((entry) => entry.evidence.state === "source-recorded").length
    const notAssessedSectionCount = sections.filter((entry) => entry.evidence.state === "not-assessed").length
    const unresolvedRedactionCount = sections.filter((entry) => entry.redactionState === "unresolved").length
    const representedRequirementCount = coverage.filter((entry) => entry.state === "represented").length
    const unresolvedRequirementCount = coverage.filter((entry) => entry.state === "unresolved").length
    const unresolvedOwnershipCount = targets.filter((entry) => entry.ownership.state === "unresolved").length
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const contextSelectionState = candidate?.contextSelectionState ?? "not-assessed"
    const provenanceState = candidate?.provenanceState ?? "not-assessed"
    const previewState = candidate?.preview.state ?? "not-generated"
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Figma Context Import candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind exact current governed design, Figma observation, or Context Pack records")
    if (staleSourceReferenceCount > 0) reasons.push("One or more context selections reference a superseded Source revision")
    if (candidate && candidate.contextPacks.length === 0) reasons.push("No exact Context Packs are selected")
    if (sections.length === 0) reasons.push("No bounded context sections are selected")
    if (targets.length === 0) reasons.push("No bounded Figma targets are selected")
    if (sourceRecordedSectionCount > 0) reasons.push("One or more context sections are source-recorded but not attributable human-reviewed")
    if (notAssessedSectionCount > 0) reasons.push("One or more context sections have not been assessed")
    if (unresolvedRedactionCount > 0) reasons.push("One or more context section redactions remain unresolved")
    if (unresolvedRequirementCount > 0) reasons.push("One or more Design Requirements remain unrepresented")
    if (unresolvedOwnershipCount > 0) reasons.push("One or more candidate target ownership assignments remain unresolved")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved context import questions")
    if (candidate && contextSelectionState !== "candidate-selection-complete") reasons.push("The context selection is not marked candidate-complete")
    if (candidate && provenanceState !== "exact") reasons.push("The context selection provenance is not exact")
    if (candidate && previewState !== "human-reviewed") reasons.push("The context selection preview is not human-reviewed")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return figmaContextImportStatusSchema.parse({
      schemaVersion: 1,
      kind: "figma-context-import-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      contextPackCount: candidate?.contextPacks.length ?? 0,
      sectionCount: sections.length,
      contextItemCount: sections.reduce((total, section) => total + section.contextItemIds.length, 0),
      targetCount: targets.length,
      humanReviewedSectionCount,
      sourceRecordedSectionCount,
      notAssessedSectionCount,
      unresolvedRedactionCount,
      representedRequirementCount,
      unresolvedRequirementCount,
      unresolvedOwnershipCount,
      staleBindingCount,
      staleSourceReferenceCount,
      unresolvedQuestionCount,
      contextSelectionState,
      provenanceState,
      previewState,
      reviewState,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "figma-context-import-status-is-observational-and-does-not-package-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<FigmaContextImportProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Figma Context Import projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "figma-context-import-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        state: candidate.state,
        contextPackCount: candidate.contextPacks.length,
        sectionCount: candidate.sections.length,
        contextItemCount: candidate.sections.reduce((total, section) => total + section.contextItemIds.length, 0),
        targetCount: candidate.targets.length,
        representedRequirementCount: candidate.requirementCoverage.filter((entry) => entry.state === "represented").length,
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-brief-requirement-constraint-context-item-figma-target-tool-source-or-personal-content-secrets-credentials-or-permissions" as const,
      authorityBoundary:
        "figma-context-import-projection-is-read-only-and-does-not-package-or-transfer-context-connect-to-or-call-figma-request-credentials-grant-permissions-authorize-or-perform-write-validate-targets-or-design-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority" as const,
    }
    return figmaContextImportProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("figma-context-imports", currentRecordPattern, figmaContextImportSchema)
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) {
          throw new Error("Figma Context Import membership digest is invalid")
        }
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Figma Context Import candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "figma-context-import.binding-review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale Figma Context Import bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "figma-context-import.invalid",
          severity: "error",
          message: `Figma Context Import ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Figma Context Import Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Figma Context Import candidate must bind exact current Product and Initiative revisions and digests")
    }
  }

  private async readCurrentBindings(initiativeId: string): Promise<{ [K in keyof CurrentBindings]: CurrentBindings[K] | undefined }> {
    const [designApplicability, designRequirements, designSystemTokenContract, accessibilityDesignRules,
      responsiveMultiPlatformTargets, manualFigmaExecutionPath, figmaMcpCapabilityDiscovery, figmaReadSnapshot] = await Promise.all([
      this.designApplicability.readCurrent(initiativeId),
      this.designRequirements.readCurrent(initiativeId),
      this.designSystemTokenContract.readCurrent(initiativeId),
      this.accessibilityDesignRules.readCurrent(initiativeId),
      this.responsiveMultiPlatformTargets.readCurrent(initiativeId),
      this.manualFigmaExecutionPath.readCurrent(initiativeId),
      this.figmaMcpCapabilityDiscovery.readCurrent(initiativeId),
      this.figmaReadSnapshot.readCurrent(initiativeId),
    ])
    return { designApplicability, designRequirements, designSystemTokenContract, accessibilityDesignRules,
      responsiveMultiPlatformTargets, manualFigmaExecutionPath, figmaMcpCapabilityDiscovery, figmaReadSnapshot }
  }

  private hasAllBindings(bindings: { [K in keyof CurrentBindings]: CurrentBindings[K] | undefined }): bindings is CurrentBindings {
    return Object.values(bindings).every((value) => value !== undefined)
  }

  private async requireCurrentBindings(input: FigmaContextImportInput): Promise<CurrentBindings> {
    const bindings = await this.readCurrentBindings(input.initiativeId)
    if (!this.hasAllBindings(bindings)) {
      const missing = (Object.keys(bindings) as (keyof CurrentBindings)[]).filter((key) => !bindings[key])
      throw new Error(`Figma Context Import requires current governed records: ${missing.join(", ")}`)
    }
    for (const key of Object.keys(bindings) as (keyof CurrentBindings)[]) {
      const candidate = bindings[key]
      const reference = input[key]
      if (reference.recordId !== candidate.id || reference.revision !== candidate.revision ||
          reference.digest !== canonicalDigest(candidate) || reference.membershipDigest !== candidate.membershipDigest) {
        throw new Error(`Figma Context Import must bind exact current ${key} and membership`)
      }
    }
    return bindings
  }

  private async requireCurrentContextPacks(input: FigmaContextImportInput, product: Product): Promise<ContextPack[]> {
    const packs: ContextPack[] = []
    for (const reference of input.contextPacks) {
      const pack = await this.readContextPack(reference.recordId)
      if (pack.productId !== product.id || pack.revision !== reference.revision || canonicalDigest(pack) !== reference.digest ||
          pack.packDigest !== reference.packDigest) {
        throw new Error("Figma Context Import must bind exact current Context Pack identity, revision, record digest, and pack digest")
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

  private validateSelection(input: FigmaContextImportInput, bindings: CurrentBindings, contextPacks: ContextPack[]): void {
    const packById = new Map(contextPacks.map((pack) => [pack.id, pack]))
    const selectedItemIds = new Set<string>()
    for (const section of input.sections) {
      const pack = packById.get(section.contextPackId)
      if (!pack) throw new Error("Figma Context Import section targets a Context Pack outside the exact selection")
      const itemById = new Map(pack.items.map((item) => [item.id, item]))
      const items = section.contextItemIds.map((id) => itemById.get(id))
      if (items.some((item) => item === undefined)) throw new Error("Figma Context Import section contains an unknown Context Item")
      for (const id of section.contextItemIds) selectedItemIds.add(id)
      const exactItems = items as ContextPack["items"]
      if (section.contentDigest !== canonicalDigest(exactItems.map((item) => ({ id: item.id, contentDigest: item.contentDigest })))) {
        throw new Error("Figma Context Import section content digest must bind exact selected Context Item digests")
      }
      if (section.transformationDigest !== canonicalDigest(exactItems.map((item) => ({ id: item.id, transformations: item.transformations })))) {
        throw new Error("Figma Context Import section transformation digest must bind exact selected Context Item transformations")
      }
      if (section.informationClassification !== pack.classification.level) {
        throw new Error("Figma Context Import section classification must preserve its exact Context Pack classification")
      }
    }
    const allItems = contextPacks.flatMap((pack) => pack.items)
    if (input.contextSelectionState === "candidate-selection-complete" &&
        (selectedItemIds.size !== allItems.length || allItems.some((item) => !selectedItemIds.has(item.id)) ||
         contextPacks.some((pack) => pack.sufficiency.status === "insufficient" ||
           pack.omissions.some((omission) => omission.required || omission.material) ||
           pack.conflicts.some((conflict) => conflict.state === "open")))) {
      throw new Error("Candidate-complete Figma Context Import must select every exact Context Item and forbid insufficient packs, material omissions, or open conflicts")
    }
    const maximumClassification = contextPacks.reduce<keyof typeof classificationRank>((maximum, pack) =>
      classificationRank[pack.classification.level] > classificationRank[maximum] ? pack.classification.level : maximum,
    "public")
    if (input.informationClassification !== maximumClassification) {
      throw new Error("Figma Context Import classification must equal the highest selected Context Pack classification")
    }
    if (contextPacks.some((pack) => pack.recipient.kind !== "tool" || pack.recipient.id !== bindings.figmaMcpCapabilityDiscovery.adapter.key)) {
      throw new Error("Figma Context Import Context Packs must target the exact observed Figma MCP adapter as a tool recipient")
    }
    const requirements = new Set(bindings.designRequirements.requirements.map((requirement) => requirement.key))
    const covered = new Set(input.requirementCoverage.map((entry) => entry.requirementKey))
    if (requirements.size !== covered.size || [...requirements].some((key) => !covered.has(key))) {
      throw new Error("Figma Context Import coverage must reconcile every exact current Design Requirement")
    }
    const fileByKey = new Map(bindings.figmaReadSnapshot.files.map((file) => [file.key, file]))
    const toolByKey = new Map(bindings.figmaMcpCapabilityDiscovery.tools.map((tool) => [tool.key, tool]))
    for (const target of input.targets) {
      const file = fileByKey.get(target.fileKey)
      if (!file || target.externalFileIdentityDigest !== canonicalDigest(file.provenance.externalObjectId) ||
          target.externalVersionDigest !== canonicalDigest(file.provenance.externalVersion)) {
        throw new Error("Figma Context Import target must bind an exact observed Figma file identity and version")
      }
      const tool = toolByKey.get(target.plannedWriteToolKey)
      if (!tool || tool.availabilityState !== "advertised" || tool.capabilityClass !== "write-design" ||
          tool.effectClass !== "figma-write" || !tool.permissions.some((permission) =>
            permission.accessClass === "write" && permission.requirementState === "required" && permission.grantState === "not-granted")) {
        throw new Error("Figma Context Import planning may reference only an advertised exact write-design tool with required ungranted write permission")
      }
    }
    if (input.preview.selectionDigest !== canonicalDigest(selectionReceipt(input))) {
      throw new Error("Figma Context Import selection digest must bind the exact governed selection receipt")
    }
    if (input.preview.previewDigest !== undefined && input.preview.previewDigest !== canonicalDigest(previewReceipt(input))) {
      throw new Error("Figma Context Import preview digest must bind the exact privacy-safe preview receipt")
    }
  }

  private bindingMismatchCount(
    input: FigmaContextImportInput,
    product: Product,
    initiative: Initiative,
    bindings: { [K in keyof CurrentBindings]: CurrentBindings[K] | undefined },
    contextPacks: Map<string, ContextPack>,
  ): number {
    let mismatches = 0
    const expectedContext = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(input.context) !== canonicalDigest(expectedContext)) mismatches += 1
    for (const key of Object.keys(bindings) as (keyof CurrentBindings)[]) {
      const candidate = bindings[key]
      const reference = input[key]
      if (!candidate || reference.recordId !== candidate.id || reference.revision !== candidate.revision ||
          reference.digest !== canonicalDigest(candidate) || reference.membershipDigest !== candidate.membershipDigest) mismatches += 1
    }
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
        throw new Error("Figma Context Import Source identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Figma Context Import is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: FigmaContextImport, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, figmaContextImportSchema),
        this.governed(this.historyPath(record.id, record.revision), record, figmaContextImportSchema),
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
          designApplicability: record.designApplicability,
          designRequirements: record.designRequirements,
          designSystemTokenContract: record.designSystemTokenContract,
          accessibilityDesignRules: record.accessibilityDesignRules,
          responsiveMultiPlatformTargets: record.responsiveMultiPlatformTargets,
          manualFigmaExecutionPath: record.manualFigmaExecutionPath,
          figmaMcpCapabilityDiscovery: record.figmaMcpCapabilityDiscovery,
          figmaReadSnapshot: record.figmaReadSnapshot,
          contextPackCount: record.contextPacks.length,
          contextPackCatalogDigest: canonicalDigest(record.contextPacks),
          sectionCount: record.sections.length,
          contextItemCount: record.sections.reduce((total, section) => total + section.contextItemIds.length, 0),
          sectionCatalogDigest: canonicalDigest(record.sections.map((section) => ({
            key: section.key,
            kind: section.kind,
            contextPackId: section.contextPackId,
            contextItemCount: section.contextItemIds.length,
            contentDigest: section.contentDigest,
            transformationDigest: section.transformationDigest,
            informationClassification: section.informationClassification,
            redactionState: section.redactionState,
            evidenceState: section.evidence.state,
          }))),
          targetCount: record.targets.length,
          targetCatalogDigest: canonicalDigest(record.targets.map((target) => ({
            key: target.key,
            designScopeKey: target.designScopeKey,
            fileKey: target.fileKey,
            externalFileIdentityDigest: target.externalFileIdentityDigest,
            externalVersionDigest: target.externalVersionDigest,
            plannedWriteToolKey: target.plannedWriteToolKey,
            permissionRequirementState: target.permissionRequirementState,
            ownershipState: target.ownership.state,
          }))),
          requirementCoverageCount: record.requirementCoverage.length,
          requirementCoverageDigest: canonicalDigest(record.requirementCoverage.map((coverage) => ({
            requirementKey: coverage.requirementKey,
            state: coverage.state,
            rationaleDigest: coverage.rationaleDigest,
          }))),
          selectionDigest: record.preview.selectionDigest,
          previewDigest: record.preview.previewDigest,
          previewState: record.preview.state,
          contextSelectionState: record.contextSelectionState,
          provenanceState: record.provenanceState,
          reviewState: record.reviewState,
          packagePreparationState: record.packagePreparationState,
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
    return this.repository.resolve("figma-context-imports", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("figma-context-import-history", `figma-context-import-${id}-r${revision}.json`)
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
    if (names.length > inventoryLimit) throw new Error(`Figma Context Import directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
