import { randomUUID } from "node:crypto"

import {
  responsiveMultiPlatformTargetsInputSchema,
  responsiveMultiPlatformTargetsProjectionSchema,
  responsiveMultiPlatformTargetsSchema,
  responsiveMultiPlatformTargetsStatusSchema,
  exactSourceReferenceSchema,
  type ResponsiveMultiPlatformTargets,
  type ResponsiveMultiPlatformTargetsInput,
  type ResponsiveMultiPlatformTargetsProjection,
  type ResponsiveMultiPlatformTargetsStatus,
  type AccessibilityDesignRules,
  type BusinessContextBinding,
  type DesignRequirements,
  type DesignSystemTokenContract,
  type ExactSourceReference,
  type Initiative,
  type Product,
  type ScreenStateInventory,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { DesignRequirementsService } from "./design-requirements.js"
import type { DesignSystemTokenContractService } from "./design-system-token-contract.js"
import type { AccessibilityDesignRulesService } from "./accessibility-design-rules.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { ScreenStateInventoryService } from "./screen-state-inventory.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: ResponsiveMultiPlatformTargets) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: ResponsiveMultiPlatformTargetsInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    screenStateInventory: input.screenStateInventory,
    designRequirements: input.designRequirements,
    designSystemTokenContract: input.designSystemTokenContract,
    accessibilityDesignRules: input.accessibilityDesignRules,
    platformTargets: input.platformTargets,
    breakpoints: input.breakpoints,
    behaviors: input.behaviors,
    checks: input.checks,
    requirementCoverage: input.requirementCoverage,
    targetCatalogState: input.targetCatalogState,
    breakpointCatalogState: input.breakpointCatalogState,
    behaviorCatalogState: input.behaviorCatalogState,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    responsiveCompletenessState: input.responsiveCompletenessState,
    platformParityState: input.platformParityState,
    breakpointValidityState: input.breakpointValidityState,
    behaviorValidityState: input.behaviorValidityState,
    accessibilityConformanceState: input.accessibilityConformanceState,
    designApprovalState: input.designApprovalState,
    designBaselineState: input.designBaselineState,
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

export class ResponsiveMultiPlatformTargetsService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly screenStateInventory: ScreenStateInventoryService,
    private readonly designRequirements: DesignRequirementsService,
    private readonly designSystemTokenContract: DesignSystemTokenContractService,
    private readonly accessibilityDesignRules: AccessibilityDesignRulesService,
  ) {}

  async create(inputValue: ResponsiveMultiPlatformTargetsInput, actorId: string): Promise<ResponsiveMultiPlatformTargets> {
    const input = responsiveMultiPlatformTargetsInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const [inventory, requirements, designSystem, accessibility] = await Promise.all([
        this.requireCurrentScreenStateInventory(input),
        this.requireCurrentDesignRequirements(input),
        this.requireCurrentDesignSystemTokenContract(input),
        this.requireCurrentAccessibilityDesignRules(input),
      ])
      this.validateCatalog(input, inventory, requirements, designSystem, accessibility)
      await this.validateSourceReferences(input, initiative.id)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Responsive and Multi-Platform Targets candidate")
      }
      const now = new Date().toISOString()
      const record = responsiveMultiPlatformTargetsSchema.parse({
        schemaVersion: 1,
        kind: "responsive-multi-platform-targets-candidate",
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
          "responsive-multi-platform-targets-are-candidate-metadata-and-do-not-establish-responsive-completeness-platform-parity-breakpoint-or-behavior-validity-accessibility-conformance-ownership-design-approval-baseline-readiness-implementation-or-action-authority",
      })
      await this.commitVersionedRecord(record, "responsive-multi-platform-targets.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: ResponsiveMultiPlatformTargetsInput,
    actorId: string,
  ): Promise<ResponsiveMultiPlatformTargets> {
    const input = responsiveMultiPlatformTargetsInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Responsive and Multi-Platform Targets revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Responsive and Multi-Platform Targets Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const [inventory, requirements, designSystem, accessibility] = await Promise.all([
        this.requireCurrentScreenStateInventory(input),
        this.requireCurrentDesignRequirements(input),
        this.requireCurrentDesignSystemTokenContract(input),
        this.requireCurrentAccessibilityDesignRules(input),
      ])
      this.validateCatalog(input, inventory, requirements, designSystem, accessibility)
      await this.validateSourceReferences(input, initiative.id)
      const record = responsiveMultiPlatformTargetsSchema.parse({
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
      await this.commitVersionedRecord(record, "responsive-multi-platform-targets.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<ResponsiveMultiPlatformTargets> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Responsive and Multi-Platform Targets ID")),
      responsiveMultiPlatformTargetsSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<ResponsiveMultiPlatformTargets | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("responsive-multi-platform-targets", currentRecordPattern, responsiveMultiPlatformTargetsSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Responsive and Multi-Platform Targets candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<ResponsiveMultiPlatformTargets> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Responsive and Multi-Platform Targets history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Responsive and Multi-Platform Targets ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), responsiveMultiPlatformTargetsSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Responsive and Multi-Platform Targets history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<ResponsiveMultiPlatformTargets[]> {
    const recordId = this.requireUuid(id, "Responsive and Multi-Platform Targets ID")
    const records = await this.listRecords(
      "responsive-multi-platform-targets-history",
      new RegExp(`^responsive-multi-platform-targets-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      responsiveMultiPlatformTargetsSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Responsive and Multi-Platform Targets history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<ResponsiveMultiPlatformTargetsStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, inventory, requirements, designSystem, accessibility, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.screenStateInventory.readCurrent(targetId),
      this.designRequirements.readCurrent(targetId),
      this.designSystemTokenContract.readCurrent(targetId),
      this.accessibilityDesignRules.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    let staleBindingCount = candidate
      ? this.bindingMismatchCount(candidate, product, initiative, inventory, requirements, designSystem, accessibility)
      : 0
    if (candidate && staleBindingCount === 0 && inventory && requirements && designSystem && accessibility) {
      try {
        this.validateCatalog(candidate, inventory, requirements, designSystem, accessibility)
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
    const platformTargets = candidate?.platformTargets ?? []
    const breakpoints = candidate?.breakpoints ?? []
    const behaviors = candidate?.behaviors ?? []
    const checks = candidate?.checks ?? []
    const coverage = candidate?.requirementCoverage ?? []
    const applicableBehaviorCount = behaviors.filter((entry) => entry.applicability === "applicable").length
    const unresolvedBehaviorCount = behaviors.filter((entry) => entry.applicability === "unresolved").length
    const notAssessedCheckCount = checks.filter((entry) => entry.evidenceState === "not-assessed").length
    const evidenceRecordedCheckCount = checks.filter((entry) => entry.evidenceState === "evidence-recorded").length
    const humanReviewedCheckCount = checks.filter((entry) => entry.evidenceState === "human-reviewed").length
    const contradictedCheckCount = checks.filter((entry) => entry.observation === "evidence-contradicts").length
    const representedRequirementCount = coverage.filter((entry) => entry.state === "represented").length
    const unresolvedRequirementCount = coverage.filter((entry) => entry.state === "unresolved").length
    const unresolvedOwnershipCount = platformTargets.filter((entry) => entry.ownership.state === "unresolved").length +
      behaviors.filter((entry) => entry.ownership.state === "unresolved").length
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const targetCatalogState = candidate?.targetCatalogState ?? "not-assessed"
    const breakpointCatalogState = candidate?.breakpointCatalogState ?? "not-assessed"
    const behaviorCatalogState = candidate?.behaviorCatalogState ?? "not-assessed"
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Responsive and Multi-Platform Targets candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind exact current Product, Initiative, Screen and State Inventory, Design Requirements, Design System and Token Contract, or Accessibility Design Rules records")
    if (staleSourceReferenceCount > 0) reasons.push("One or more Responsive and Multi-Platform Targets entries reference a superseded Source revision")
    if (unresolvedOwnershipCount > 0) reasons.push("One or more responsive platform targets or behaviors have unresolved candidate ownership")
    if (unresolvedBehaviorCount > 0) reasons.push("One or more responsive platform behaviors retain unresolved applicability")
    if (notAssessedCheckCount > 0) reasons.push("One or more responsive platform checks have not been assessed")
    if (evidenceRecordedCheckCount > 0) reasons.push("One or more responsive platform checks have evidence that is not attributable human-reviewed")
    if (contradictedCheckCount > 0) reasons.push("One or more responsive platform checks record contradicting evidence")
    if (unresolvedRequirementCount > 0) reasons.push("One or more exact current Design Requirements have unresolved responsive behavior coverage")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved Responsive and Multi-Platform Targets questions")
    if (candidate && targetCatalogState !== "candidate-complete") reasons.push("The responsive platform target catalog is not marked candidate-complete")
    if (candidate && breakpointCatalogState !== "candidate-complete") reasons.push("The responsive breakpoint catalog is not marked candidate-complete")
    if (candidate && behaviorCatalogState !== "candidate-complete") reasons.push("The responsive platform behavior catalog is not marked candidate-complete")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return responsiveMultiPlatformTargetsStatusSchema.parse({
      schemaVersion: 1,
      kind: "responsive-multi-platform-targets-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      platformTargetCount: platformTargets.length,
      breakpointCount: breakpoints.length,
      behaviorCount: behaviors.length,
      checkCount: checks.length,
      applicableBehaviorCount,
      unresolvedBehaviorCount,
      notAssessedCheckCount,
      evidenceRecordedCheckCount,
      humanReviewedCheckCount,
      contradictedCheckCount,
      representedRequirementCount,
      unresolvedRequirementCount,
      unresolvedOwnershipCount,
      staleBindingCount,
      staleSourceReferenceCount,
      unresolvedQuestionCount,
      targetCatalogState,
      breakpointCatalogState,
      behaviorCatalogState,
      reviewState,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "responsive-multi-platform-targets-status-is-observational-and-does-not-establish-responsive-completeness-platform-parity-breakpoint-or-behavior-validity-accessibility-conformance-ownership-design-approval-baseline-readiness-implementation-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<ResponsiveMultiPlatformTargetsProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Responsive and Multi-Platform Targets projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "responsive-multi-platform-targets-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        state: candidate.state,
        platformTargetCount: candidate.platformTargets.length,
        breakpointCount: candidate.breakpoints.length,
        behaviorCount: candidate.behaviors.length,
        checkCount: candidate.checks.length,
        representedRequirementCount: candidate.requirementCoverage.filter((entry) => entry.state === "represented").length,
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-breakpoint-rules-behavior-procedures-evidence-requirement-source-design-or-personal-content-secrets-or-credentials" as const,
      authorityBoundary:
        "responsive-multi-platform-targets-projection-is-read-only-and-does-not-establish-responsive-completeness-platform-parity-breakpoint-or-behavior-validity-accessibility-conformance-ownership-design-approval-baseline-readiness-implementation-write-or-action-authority" as const,
    }
    return responsiveMultiPlatformTargetsProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("responsive-multi-platform-targets", currentRecordPattern, responsiveMultiPlatformTargetsSchema)
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) {
          throw new Error("Responsive and Multi-Platform Targets membership digest is invalid")
        }
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Responsive and Multi-Platform Targets candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "responsive-multi-platform-targets.binding-review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale Responsive and Multi-Platform Targets bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "responsive-multi-platform-targets.invalid",
          severity: "error",
          message: `Responsive and Multi-Platform Targets ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Responsive and Multi-Platform Targets Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Responsive and Multi-Platform Targets candidate must bind exact current Product and Initiative revisions and digests")
    }
  }

  private async requireCurrentScreenStateInventory(input: ResponsiveMultiPlatformTargetsInput): Promise<ScreenStateInventory> {
    const candidate = await this.screenStateInventory.readCurrent(input.initiativeId)
    if (!candidate) throw new Error("Responsive and Multi-Platform Targets requires current Screen and State Inventory")
    if (input.screenStateInventory.recordId !== candidate.id || input.screenStateInventory.revision !== candidate.revision ||
        input.screenStateInventory.digest !== canonicalDigest(candidate) ||
        input.screenStateInventory.membershipDigest !== candidate.membershipDigest) {
      throw new Error("Responsive and Multi-Platform Targets must bind exact current Screen and State Inventory and membership")
    }
    return candidate
  }

  private async requireCurrentDesignRequirements(input: ResponsiveMultiPlatformTargetsInput): Promise<DesignRequirements> {
    const candidate = await this.designRequirements.readCurrent(input.initiativeId)
    if (!candidate) throw new Error("Responsive and Multi-Platform Targets requires current Design Requirements")
    if (input.designRequirements.recordId !== candidate.id || input.designRequirements.revision !== candidate.revision ||
        input.designRequirements.digest !== canonicalDigest(candidate) ||
        input.designRequirements.membershipDigest !== candidate.membershipDigest) {
      throw new Error("Responsive and Multi-Platform Targets must bind exact current Design Requirements and membership")
    }
    return candidate
  }

  private async requireCurrentDesignSystemTokenContract(input: ResponsiveMultiPlatformTargetsInput): Promise<DesignSystemTokenContract> {
    const candidate = await this.designSystemTokenContract.readCurrent(input.initiativeId)
    if (!candidate) throw new Error("Responsive and Multi-Platform Targets requires current Design System and Token Contract")
    if (input.designSystemTokenContract.recordId !== candidate.id ||
        input.designSystemTokenContract.revision !== candidate.revision ||
        input.designSystemTokenContract.digest !== canonicalDigest(candidate) ||
        input.designSystemTokenContract.membershipDigest !== candidate.membershipDigest) {
      throw new Error("Responsive and Multi-Platform Targets must bind exact current Design System and Token Contract and membership")
    }
    return candidate
  }

  private async requireCurrentAccessibilityDesignRules(input: ResponsiveMultiPlatformTargetsInput): Promise<AccessibilityDesignRules> {
    const candidate = await this.accessibilityDesignRules.readCurrent(input.initiativeId)
    if (!candidate) throw new Error("Responsive and Multi-Platform Targets requires current Accessibility Design Rules")
    if (input.accessibilityDesignRules.recordId !== candidate.id ||
        input.accessibilityDesignRules.revision !== candidate.revision ||
        input.accessibilityDesignRules.digest !== canonicalDigest(candidate) ||
        input.accessibilityDesignRules.membershipDigest !== candidate.membershipDigest) {
      throw new Error("Responsive and Multi-Platform Targets must bind exact current Accessibility Design Rules and membership")
    }
    return candidate
  }

  private validateCatalog(
    input: ResponsiveMultiPlatformTargetsInput,
    inventory: ScreenStateInventory,
    requirements: DesignRequirements,
    _designSystem: DesignSystemTokenContract,
    accessibility: AccessibilityDesignRules,
  ): void {
    const targetedPlatforms = inventory.platforms
      .filter((entry) => entry.supportState === "targeted")
      .sort((left, right) => left.key.localeCompare(right.key))
    const platformByKey = new Map(targetedPlatforms.map((entry) => [entry.key, entry]))
    const platformKeys = new Set(platformByKey.keys())
    const screenKeys = new Set(inventory.screens.map((entry) => entry.key))
    const stateKeys = new Set(inventory.states.map((entry) => entry.key))
    const requirementKeys = requirements.requirements.map((entry) => entry.key).sort((left, right) => left.localeCompare(right))
    const requirementKeySet = new Set(requirementKeys)
    const accessibilityRuleKeys = new Set(accessibility.rules.map((entry) => entry.key))
    const breakpointByKey = new Map(input.breakpoints.map((entry) => [entry.key, entry]))
    const behaviorByKey = new Map(input.behaviors.map((entry) => [entry.key, entry]))
    const assertKeys = (values: string[], allowed: Set<string>, label: string) => {
      if (values.some((value) => !allowed.has(value))) throw new Error(`${label} must stay inside the exact current governed catalog`)
    }

    for (const target of input.platformTargets) {
      const platform = platformByKey.get(target.platformKey)
      if (!platform) throw new Error("Responsive platform targets must reference exact current targeted platforms")
      assertKeys(target.contextClassKeys, new Set(platform.viewportOrContainerClasses), "Responsive target context-class links")
      assertKeys(target.screenKeys, screenKeys, "Responsive target screen links")
      assertKeys(target.requirementKeys, requirementKeySet, "Responsive target Requirement links")
      if (input.targetCatalogState === "candidate-complete" &&
          canonicalDigest(target.contextClassKeys) !== canonicalDigest(platform.viewportOrContainerClasses)) {
        throw new Error("Candidate-complete responsive targets must include every exact governed platform context class")
      }
    }
    if (input.targetCatalogState === "candidate-complete" &&
        canonicalDigest(input.platformTargets.map((entry) => entry.platformKey).sort((left, right) => left.localeCompare(right))) !==
        canonicalDigest([...platformKeys].sort((left, right) => left.localeCompare(right)))) {
      throw new Error("Candidate-complete Responsive and Multi-Platform Targets must include every exact current targeted platform once")
    }

    for (const breakpoint of input.breakpoints) {
      const platform = platformByKey.get(breakpoint.platformKey)
      if (!platform || !platform.viewportOrContainerClasses.includes(breakpoint.contextClassKey)) {
        throw new Error("Responsive breakpoints must reference exact current platform context classes")
      }
    }

    for (const behavior of input.behaviors) {
      assertKeys(behavior.platformKeys, platformKeys, "Responsive behavior platform links")
      assertKeys(behavior.screenKeys, screenKeys, "Responsive behavior screen links")
      assertKeys(behavior.stateKeys, stateKeys, "Responsive behavior state links")
      assertKeys(behavior.requirementKeys, requirementKeySet, "Responsive behavior Requirement links")
      assertKeys(behavior.accessibilityRuleKeys, accessibilityRuleKeys, "Responsive behavior Accessibility Rule links")
      if (behavior.breakpointKeys.some((key) => !breakpointByKey.has(key))) {
        throw new Error("Responsive behaviors must reference exact current candidate breakpoints")
      }
    }

    for (const check of input.checks) {
      const behavior = behaviorByKey.get(check.behaviorKey)
      if (!behavior || !behavior.platformKeys.includes(check.platformKey) || !behavior.screenKeys.includes(check.screenKey) ||
          (check.stateKey !== undefined && !behavior.stateKeys.includes(check.stateKey)) ||
          (check.breakpointKey !== undefined && !behavior.breakpointKeys.includes(check.breakpointKey))) {
        throw new Error("Responsive platform checks must reconcile exact current candidate behavior scope")
      }
    }

    if (canonicalDigest(input.requirementCoverage.map((entry) => entry.requirementKey)) !== canonicalDigest(requirementKeys)) {
      throw new Error("Responsive and Multi-Platform Targets requirement coverage must include every exact current Design Requirement once")
    }
    const coverageByRequirement = new Map(input.requirementCoverage.map((entry) => [entry.requirementKey, entry]))
    for (const behavior of input.behaviors) {
      if (behavior.requirementKeys.some((key) => !coverageByRequirement.get(key)?.behaviorKeys.includes(behavior.key))) {
        throw new Error("Responsive behavior Requirement links must reconcile to exact requirement coverage")
      }
    }
    for (const coverage of input.requirementCoverage) {
      if (coverage.behaviorKeys.some((key) => !behaviorByKey.get(key)?.requirementKeys.includes(coverage.requirementKey))) {
        throw new Error("Responsive requirement coverage must reconcile to exact behavior Requirement links")
      }
    }

    if (input.behaviorCatalogState === "candidate-complete") {
      const representedPlatforms = new Set(input.behaviors.flatMap((entry) => entry.platformKeys))
      const representedBreakpoints = new Set(input.behaviors.flatMap((entry) => entry.breakpointKeys))
      if ([...platformKeys].some((key) => !representedPlatforms.has(key)) ||
          input.breakpoints.some((entry) => !representedBreakpoints.has(entry.key))) {
        throw new Error("Candidate-complete responsive behaviors must represent every governed platform and candidate breakpoint")
      }
    }
  }

  private bindingMismatchCount(
    input: ResponsiveMultiPlatformTargetsInput,
    product: Product,
    initiative: Initiative,
    inventory: ScreenStateInventory | undefined,
    requirements: DesignRequirements | undefined,
    designSystem: DesignSystemTokenContract | undefined,
    accessibility: AccessibilityDesignRules | undefined,
  ): number {
    let mismatches = 0
    const expectedContext = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(input.context) !== canonicalDigest(expectedContext)) mismatches += 1
    if (!inventory || input.screenStateInventory.recordId !== inventory.id ||
        input.screenStateInventory.revision !== inventory.revision || input.screenStateInventory.digest !== canonicalDigest(inventory) ||
        input.screenStateInventory.membershipDigest !== inventory.membershipDigest) mismatches += 1
    if (!requirements || input.designRequirements.recordId !== requirements.id ||
        input.designRequirements.revision !== requirements.revision || input.designRequirements.digest !== canonicalDigest(requirements) ||
        input.designRequirements.membershipDigest !== requirements.membershipDigest) mismatches += 1
    if (!designSystem || input.designSystemTokenContract.recordId !== designSystem.id ||
        input.designSystemTokenContract.revision !== designSystem.revision ||
        input.designSystemTokenContract.digest !== canonicalDigest(designSystem) ||
        input.designSystemTokenContract.membershipDigest !== designSystem.membershipDigest) mismatches += 1
    if (!accessibility || input.accessibilityDesignRules.recordId !== accessibility.id ||
        input.accessibilityDesignRules.revision !== accessibility.revision ||
        input.accessibilityDesignRules.digest !== canonicalDigest(accessibility) ||
        input.accessibilityDesignRules.membershipDigest !== accessibility.membershipDigest) mismatches += 1
    return mismatches
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Responsive and Multi-Platform Targets Source identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Responsive and Multi-Platform Targets guidance is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: ResponsiveMultiPlatformTargets, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, responsiveMultiPlatformTargetsSchema),
        this.governed(this.historyPath(record.id, record.revision), record, responsiveMultiPlatformTargetsSchema),
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
          screenStateInventory: record.screenStateInventory,
          designRequirements: record.designRequirements,
          designSystemTokenContract: record.designSystemTokenContract,
          accessibilityDesignRules: record.accessibilityDesignRules,
          platformTargetCount: record.platformTargets.length,
          breakpointCount: record.breakpoints.length,
          behaviorCount: record.behaviors.length,
          checkCount: record.checks.length,
          platformTargetCatalogDigest: canonicalDigest(record.platformTargets.map((entry) => ({
            key: entry.key, platformKey: entry.platformKey, formFactors: entry.formFactors,
            deliverySurfaces: entry.deliverySurfaces, contextClassKeys: entry.contextClassKeys,
            screenKeys: entry.screenKeys, requirementKeys: entry.requirementKeys, ownershipState: entry.ownership.state,
          }))),
          breakpointCatalogDigest: canonicalDigest(record.breakpoints.map((entry) => ({
            key: entry.key, platformKey: entry.platformKey, contextClassKey: entry.contextClassKey, basis: entry.basis,
            minimumInlineSizePx: entry.minimumInlineSizePx,
            maximumInlineSizePxExclusive: entry.maximumInlineSizePxExclusive,
          }))),
          behaviorCatalogDigest: canonicalDigest(record.behaviors.map((entry) => ({
            key: entry.key, kind: entry.kind, applicability: entry.applicability,
            platformKeys: entry.platformKeys, breakpointKeys: entry.breakpointKeys, screenKeys: entry.screenKeys,
            stateKeys: entry.stateKeys, requirementKeys: entry.requirementKeys,
            accessibilityRuleKeys: entry.accessibilityRuleKeys,
            ownershipState: entry.ownership.state,
          }))),
          checkCatalogDigest: canonicalDigest(record.checks.map((entry) => ({
            key: entry.key, behaviorKey: entry.behaviorKey, platformKey: entry.platformKey,
            breakpointKey: entry.breakpointKey, screenKey: entry.screenKey, stateKey: entry.stateKey, method: entry.method,
            evidenceState: entry.evidenceState, observation: entry.observation, evidenceDigests: entry.evidenceDigests,
          }))),
          requirementCoverageDigest: canonicalDigest(record.requirementCoverage.map((entry) => ({
            requirementKey: entry.requirementKey, state: entry.state, behaviorKeys: entry.behaviorKeys,
          }))),
          targetCatalogState: record.targetCatalogState,
          breakpointCatalogState: record.breakpointCatalogState,
          behaviorCatalogState: record.behaviorCatalogState,
          reviewState: record.reviewState,
          responsiveCompletenessState: record.responsiveCompletenessState,
          platformParityState: record.platformParityState,
          breakpointValidityState: record.breakpointValidityState,
          behaviorValidityState: record.behaviorValidityState,
          accessibilityConformanceState: record.accessibilityConformanceState,
          designApprovalState: record.designApprovalState,
          designBaselineState: record.designBaselineState,
          readinessState: record.readinessState,
          implementationAuthorityState: record.implementationAuthorityState,
          ownershipAuthorityState: "not-established",
          writeAuthorityState: "not-granted",
          actionAuthorityState: "not-granted",
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("responsive-multi-platform-targets", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve(
      "responsive-multi-platform-targets-history",
      `responsive-multi-platform-targets-${id}-r${revision}.json`,
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
    if (names.length > inventoryLimit) throw new Error(`Responsive and Multi-Platform Targets directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
