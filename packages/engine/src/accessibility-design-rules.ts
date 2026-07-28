import { randomUUID } from "node:crypto"

import {
  accessibilityDesignRulesInputSchema,
  accessibilityDesignRulesProjectionSchema,
  accessibilityDesignRulesSchema,
  accessibilityDesignRulesStatusSchema,
  exactSourceReferenceSchema,
  type AccessibilityDesignRules,
  type AccessibilityDesignRulesInput,
  type AccessibilityDesignRulesProjection,
  type AccessibilityDesignRulesStatus,
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

function exactReference(record: AccessibilityDesignRules) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: AccessibilityDesignRulesInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    screenStateInventory: input.screenStateInventory,
    designRequirements: input.designRequirements,
    designSystemTokenContract: input.designSystemTokenContract,
    targets: input.targets,
    rules: input.rules,
    checks: input.checks,
    requirementCoverage: input.requirementCoverage,
    catalogCompletenessState: input.catalogCompletenessState,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    accessibilityConformanceState: input.accessibilityConformanceState,
    ruleValidityState: input.ruleValidityState,
    legalComplianceState: input.legalComplianceState,
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

export class AccessibilityDesignRulesService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly screenStateInventory: ScreenStateInventoryService,
    private readonly designRequirements: DesignRequirementsService,
    private readonly designSystemTokenContract: DesignSystemTokenContractService,
  ) {}

  async create(inputValue: AccessibilityDesignRulesInput, actorId: string): Promise<AccessibilityDesignRules> {
    const input = accessibilityDesignRulesInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const [inventory, requirements, designSystem] = await Promise.all([
        this.requireCurrentScreenStateInventory(input),
        this.requireCurrentDesignRequirements(input),
        this.requireCurrentDesignSystemTokenContract(input),
      ])
      this.validateCatalog(input, inventory, requirements, designSystem)
      await this.validateSourceReferences(input, initiative.id)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Accessibility Design Rules candidate")
      }
      const now = new Date().toISOString()
      const record = accessibilityDesignRulesSchema.parse({
        schemaVersion: 1,
        kind: "accessibility-design-rules-candidate",
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
          "accessibility-design-rules-are-candidate-metadata-and-do-not-establish-accessibility-conformance-rule-or-check-validity-legal-compliance-ownership-design-approval-baseline-readiness-implementation-or-action-authority",
      })
      await this.commitVersionedRecord(record, "accessibility-design-rules.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: AccessibilityDesignRulesInput,
    actorId: string,
  ): Promise<AccessibilityDesignRules> {
    const input = accessibilityDesignRulesInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Accessibility Design Rules revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Accessibility Design Rules Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const [inventory, requirements, designSystem] = await Promise.all([
        this.requireCurrentScreenStateInventory(input),
        this.requireCurrentDesignRequirements(input),
        this.requireCurrentDesignSystemTokenContract(input),
      ])
      this.validateCatalog(input, inventory, requirements, designSystem)
      await this.validateSourceReferences(input, initiative.id)
      const record = accessibilityDesignRulesSchema.parse({
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
      await this.commitVersionedRecord(record, "accessibility-design-rules.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<AccessibilityDesignRules> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Accessibility Design Rules ID")),
      accessibilityDesignRulesSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<AccessibilityDesignRules | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("accessibility-design-rules", currentRecordPattern, accessibilityDesignRulesSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Accessibility Design Rules candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<AccessibilityDesignRules> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Accessibility Design Rules history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Accessibility Design Rules ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), accessibilityDesignRulesSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Accessibility Design Rules history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<AccessibilityDesignRules[]> {
    const recordId = this.requireUuid(id, "Accessibility Design Rules ID")
    const records = await this.listRecords(
      "accessibility-design-rules-history",
      new RegExp(`^accessibility-design-rules-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      accessibilityDesignRulesSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Accessibility Design Rules history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<AccessibilityDesignRulesStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, inventory, requirements, designSystem, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.screenStateInventory.readCurrent(targetId),
      this.designRequirements.readCurrent(targetId),
      this.designSystemTokenContract.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    let staleBindingCount = candidate
      ? this.bindingMismatchCount(candidate, product, initiative, inventory, requirements, designSystem)
      : 0
    if (candidate && staleBindingCount === 0 && inventory && requirements && designSystem) {
      try {
        this.validateCatalog(candidate, inventory, requirements, designSystem)
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
    const targets = candidate?.targets ?? []
    const rules = candidate?.rules ?? []
    const checks = candidate?.checks ?? []
    const coverage = candidate?.requirementCoverage ?? []
    const applicableRuleCount = rules.filter((entry) => entry.applicability === "applicable").length
    const notApplicableRuleCount = rules.filter((entry) => entry.applicability === "not-applicable").length
    const unresolvedRuleCount = rules.filter((entry) => entry.applicability === "unresolved" || entry.impact === "not-assessed").length
    const notAssessedCheckCount = checks.filter((entry) => entry.evidenceState === "not-assessed").length
    const evidenceRecordedCheckCount = checks.filter((entry) => entry.evidenceState === "evidence-recorded").length
    const humanReviewedCheckCount = checks.filter((entry) => entry.evidenceState === "human-reviewed").length
    const contradictedCheckCount = checks.filter((entry) => entry.observation === "evidence-contradicts").length
    const representedRequirementCount = coverage.filter((entry) => entry.state === "represented").length
    const unresolvedRequirementCount = coverage.filter((entry) => entry.state === "unresolved").length
    const unresolvedOwnershipCount = targets.filter((entry) => entry.ownership.state === "unresolved").length +
      rules.filter((entry) => entry.ownership.state === "unresolved").length
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const catalogCompletenessState = candidate?.catalogCompletenessState ?? "not-assessed"
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Accessibility Design Rules candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind exact current Product, Initiative, Screen and State Inventory, Design Requirements, or Design System and Token Contract records")
    if (staleSourceReferenceCount > 0) reasons.push("One or more Accessibility Design Rules entries reference a superseded Source revision")
    if (unresolvedOwnershipCount > 0) reasons.push("One or more accessibility targets or rules have unresolved candidate ownership")
    if (unresolvedRuleCount > 0) reasons.push("One or more accessibility rules retain unresolved applicability or impact")
    if (notAssessedCheckCount > 0) reasons.push("One or more accessibility design checks have not been assessed")
    if (evidenceRecordedCheckCount > 0) reasons.push("One or more accessibility design checks have evidence that is not attributable human-reviewed")
    if (contradictedCheckCount > 0) reasons.push("One or more accessibility design checks record contradicting evidence")
    if (unresolvedRequirementCount > 0) reasons.push("One or more exact current Design Requirements have unresolved accessibility coverage")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved Accessibility Design Rules questions")
    if (candidate && catalogCompletenessState !== "candidate-complete") reasons.push("The accessibility target, rule, and check catalog is not marked candidate-complete")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return accessibilityDesignRulesStatusSchema.parse({
      schemaVersion: 1,
      kind: "accessibility-design-rules-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      targetCount: targets.length,
      ruleCount: rules.length,
      checkCount: checks.length,
      applicableRuleCount,
      notApplicableRuleCount,
      unresolvedRuleCount,
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
      catalogCompletenessState,
      reviewState,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "accessibility-design-rules-status-is-observational-and-does-not-establish-accessibility-conformance-rule-or-check-validity-legal-compliance-ownership-design-approval-baseline-readiness-implementation-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<AccessibilityDesignRulesProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Accessibility Design Rules projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "accessibility-design-rules-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        state: candidate.state,
        targetCount: candidate.targets.length,
        ruleCount: candidate.rules.length,
        checkCount: candidate.checks.length,
        representedRequirementCount: candidate.requirementCoverage.filter((entry) => entry.state === "represented").length,
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-rule-procedures-evidence-requirement-source-design-or-personal-content-secrets-or-credentials" as const,
      authorityBoundary:
        "accessibility-design-rules-projection-is-read-only-and-does-not-establish-accessibility-conformance-rule-or-check-validity-legal-compliance-ownership-design-approval-baseline-readiness-implementation-write-or-action-authority" as const,
    }
    return accessibilityDesignRulesProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("accessibility-design-rules", currentRecordPattern, accessibilityDesignRulesSchema)
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) {
          throw new Error("Accessibility Design Rules membership digest is invalid")
        }
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Accessibility Design Rules candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "accessibility-design-rules.binding-review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale Accessibility Design Rules bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "accessibility-design-rules.invalid",
          severity: "error",
          message: `Accessibility Design Rules ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Accessibility Design Rules Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Accessibility Design Rules candidate must bind exact current Product and Initiative revisions and digests")
    }
  }

  private async requireCurrentScreenStateInventory(input: AccessibilityDesignRulesInput): Promise<ScreenStateInventory> {
    const candidate = await this.screenStateInventory.readCurrent(input.initiativeId)
    if (!candidate) throw new Error("Accessibility Design Rules requires current Screen and State Inventory")
    if (input.screenStateInventory.recordId !== candidate.id || input.screenStateInventory.revision !== candidate.revision ||
        input.screenStateInventory.digest !== canonicalDigest(candidate) ||
        input.screenStateInventory.membershipDigest !== candidate.membershipDigest) {
      throw new Error("Accessibility Design Rules must bind exact current Screen and State Inventory and membership")
    }
    return candidate
  }

  private async requireCurrentDesignRequirements(input: AccessibilityDesignRulesInput): Promise<DesignRequirements> {
    const candidate = await this.designRequirements.readCurrent(input.initiativeId)
    if (!candidate) throw new Error("Accessibility Design Rules requires current Design Requirements")
    if (input.designRequirements.recordId !== candidate.id || input.designRequirements.revision !== candidate.revision ||
        input.designRequirements.digest !== canonicalDigest(candidate) ||
        input.designRequirements.membershipDigest !== candidate.membershipDigest) {
      throw new Error("Accessibility Design Rules must bind exact current Design Requirements and membership")
    }
    return candidate
  }

  private async requireCurrentDesignSystemTokenContract(input: AccessibilityDesignRulesInput): Promise<DesignSystemTokenContract> {
    const candidate = await this.designSystemTokenContract.readCurrent(input.initiativeId)
    if (!candidate) throw new Error("Accessibility Design Rules requires current Design System and Token Contract")
    if (input.designSystemTokenContract.recordId !== candidate.id ||
        input.designSystemTokenContract.revision !== candidate.revision ||
        input.designSystemTokenContract.digest !== canonicalDigest(candidate) ||
        input.designSystemTokenContract.membershipDigest !== candidate.membershipDigest) {
      throw new Error("Accessibility Design Rules must bind exact current Design System and Token Contract and membership")
    }
    return candidate
  }

  private validateCatalog(
    input: AccessibilityDesignRulesInput,
    inventory: ScreenStateInventory,
    requirements: DesignRequirements,
    designSystem: DesignSystemTokenContract,
  ): void {
    const catalogs = {
      platform: new Set(inventory.platforms.filter((entry) => entry.supportState === "targeted").map((entry) => entry.key)),
      screen: new Set(inventory.screens.map((entry) => entry.key)),
      state: new Set(inventory.states.map((entry) => entry.key)),
      "design-system": new Set(designSystem.designSystems.map((entry) => entry.key)),
      token: new Set(designSystem.tokens.map((entry) => entry.path)),
      variable: new Set(designSystem.variables.map((entry) => entry.key)),
      component: new Set(designSystem.components.map((entry) => entry.key)),
    }
    const requirementKeys = requirements.requirements.map((entry) => entry.key).sort((left, right) => left.localeCompare(right))
    const requirementKeySet = new Set(requirementKeys)
    const platformKeys = catalogs.platform
    const screenKeys = catalogs.screen
    const stateKeys = catalogs.state
    const assertKeys = (values: string[], allowed: Set<string>, label: string) => {
      if (values.some((value) => !allowed.has(value))) throw new Error(`${label} must stay inside the exact current governed catalog`)
    }
    for (const target of input.targets) {
      if (!catalogs[target.kind].has(target.referenceKey)) {
        throw new Error("Accessibility targets must reference exact current governed platform, screen, state, design-system, token, variable, or component entries")
      }
      assertKeys(target.platformKeys, platformKeys, "Accessibility target platform links")
      assertKeys(target.screenKeys, screenKeys, "Accessibility target screen links")
      assertKeys(target.stateKeys, stateKeys, "Accessibility target state links")
      assertKeys(target.requirementKeys, requirementKeySet, "Accessibility target Requirement links")
    }
    for (const rule of input.rules) assertKeys(rule.requirementKeys, requirementKeySet, "Accessibility rule Requirement links")
    if (canonicalDigest(input.requirementCoverage.map((entry) => entry.requirementKey)) !== canonicalDigest(requirementKeys)) {
      throw new Error("Accessibility Design Rules requirement coverage must include every exact current Design Requirement once")
    }
    const coverageByRequirement = new Map(input.requirementCoverage.map((entry) => [entry.requirementKey, entry]))
    const ruleByKey = new Map(input.rules.map((entry) => [entry.key, entry]))
    for (const rule of input.rules) {
      if (rule.requirementKeys.some((key) => !coverageByRequirement.get(key)?.ruleKeys.includes(rule.key))) {
        throw new Error("Accessibility rule Requirement links must reconcile to exact requirement coverage")
      }
    }
    for (const coverage of input.requirementCoverage) {
      if (coverage.ruleKeys.some((key) => !ruleByKey.get(key)?.requirementKeys.includes(coverage.requirementKey))) {
        throw new Error("Accessibility requirement coverage must reconcile to exact rule Requirement links")
      }
    }
    const linkedTargets = new Set(input.rules.flatMap((entry) => entry.targetKeys))
    if (input.catalogCompletenessState === "candidate-complete" && input.targets.some((target) => !linkedTargets.has(target.key))) {
      throw new Error("Candidate-complete Accessibility Design Rules require every governed target to be represented by a rule")
    }
  }

  private bindingMismatchCount(
    input: AccessibilityDesignRulesInput,
    product: Product,
    initiative: Initiative,
    inventory: ScreenStateInventory | undefined,
    requirements: DesignRequirements | undefined,
    designSystem: DesignSystemTokenContract | undefined,
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
    return mismatches
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Accessibility Design Rules Source identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Accessibility Design Rules guidance is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: AccessibilityDesignRules, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, accessibilityDesignRulesSchema),
        this.governed(this.historyPath(record.id, record.revision), record, accessibilityDesignRulesSchema),
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
          targetCount: record.targets.length,
          ruleCount: record.rules.length,
          checkCount: record.checks.length,
          targetCatalogDigest: canonicalDigest(record.targets.map((entry) => ({
            key: entry.key, kind: entry.kind, referenceKey: entry.referenceKey, ownershipState: entry.ownership.state,
          }))),
          ruleCatalogDigest: canonicalDigest(record.rules.map((entry) => ({
            key: entry.key, principle: entry.principle, applicability: entry.applicability, impact: entry.impact,
            targetKeys: entry.targetKeys, requirementKeys: entry.requirementKeys, checkKeys: entry.checkKeys,
            ownershipState: entry.ownership.state,
          }))),
          checkCatalogDigest: canonicalDigest(record.checks.map((entry) => ({
            key: entry.key, ruleKey: entry.ruleKey, targetKeys: entry.targetKeys, method: entry.method,
            evidenceState: entry.evidenceState, observation: entry.observation, evidenceDigests: entry.evidenceDigests,
          }))),
          requirementCoverageDigest: canonicalDigest(record.requirementCoverage.map((entry) => ({
            requirementKey: entry.requirementKey, state: entry.state, ruleKeys: entry.ruleKeys,
          }))),
          catalogCompletenessState: record.catalogCompletenessState,
          reviewState: record.reviewState,
          accessibilityConformanceState: record.accessibilityConformanceState,
          ruleValidityState: record.ruleValidityState,
          legalComplianceState: record.legalComplianceState,
          designApprovalState: record.designApprovalState,
          designBaselineState: record.designBaselineState,
          readinessState: record.readinessState,
          implementationAuthorityState: record.implementationAuthorityState,
          checkValidityState: "not-established",
          ownershipAuthorityState: "not-established",
          writeAuthorityState: "not-granted",
          actionAuthorityState: "not-granted",
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("accessibility-design-rules", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve(
      "accessibility-design-rules-history",
      `accessibility-design-rules-${id}-r${revision}.json`,
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
    if (names.length > inventoryLimit) throw new Error(`Accessibility Design Rules directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
