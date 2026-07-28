import { randomUUID } from "node:crypto"

import {
  exactSourceReferenceSchema,
  manualFigmaExecutionPathInputSchema,
  manualFigmaExecutionPathProjectionSchema,
  manualFigmaExecutionPathSchema,
  manualFigmaExecutionPathStatusSchema,
  manualFigmaInstructionKinds,
  type AccessibilityDesignRules,
  type BusinessContextBinding,
  type DesignApplicability,
  type DesignRequirements,
  type DesignSystemTokenContract,
  type ExactSourceReference,
  type Initiative,
  type ManualFigmaExecutionPath,
  type ManualFigmaExecutionPathInput,
  type ManualFigmaExecutionPathProjection,
  type ManualFigmaExecutionPathStatus,
  type Product,
  type ResponsiveMultiPlatformTargets,
  type ScreenStateInventory,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { AccessibilityDesignRulesService } from "./accessibility-design-rules.js"
import type { DesignApplicabilityService } from "./design-applicability.js"
import type { DesignRequirementsService } from "./design-requirements.js"
import type { DesignSystemTokenContractService } from "./design-system-token-contract.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { ResponsiveMultiPlatformTargetsService } from "./responsive-multi-platform-targets.js"
import type { ScreenStateInventoryService } from "./screen-state-inventory.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const materialApplicability = new Set([
  "already-satisfied",
  "conditionally-required",
  "optional",
  "recommended",
  "required",
  "reused",
])
const manualCheckKinds = [
  "accessibility-reviewed",
  "handoff-manifest-digest-verified",
  "handoff-package-digest-verified",
  "handoff-path-contained",
  "instructions-reviewed",
  "privacy-reviewed",
  "responsive-targets-reviewed",
  "return-contract-reviewed",
] as const

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: ManualFigmaExecutionPath) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: ManualFigmaExecutionPathInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    designApplicability: input.designApplicability,
    screenStateInventory: input.screenStateInventory,
    designRequirements: input.designRequirements,
    designSystemTokenContract: input.designSystemTokenContract,
    accessibilityDesignRules: input.accessibilityDesignRules,
    responsiveMultiPlatformTargets: input.responsiveMultiPlatformTargets,
    scopes: input.scopes,
    instructions: input.instructions,
    checks: input.checks,
    requirementCoverage: input.requirementCoverage,
    guideCatalogState: input.guideCatalogState,
    handoffCatalogState: input.handoffCatalogState,
    returnContractState: input.returnContractState,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    figmaConnectionState: input.figmaConnectionState,
    figmaExecutionState: input.figmaExecutionState,
    figmaWriteAuthorityState: input.figmaWriteAuthorityState,
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

interface CurrentBindings {
  designApplicability: DesignApplicability
  screenStateInventory: ScreenStateInventory
  designRequirements: DesignRequirements
  designSystemTokenContract: DesignSystemTokenContract
  accessibilityDesignRules: AccessibilityDesignRules
  responsiveMultiPlatformTargets: ResponsiveMultiPlatformTargets
}

export class ManualFigmaExecutionPathService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly designApplicability: DesignApplicabilityService,
    private readonly screenStateInventory: ScreenStateInventoryService,
    private readonly designRequirements: DesignRequirementsService,
    private readonly designSystemTokenContract: DesignSystemTokenContractService,
    private readonly accessibilityDesignRules: AccessibilityDesignRulesService,
    private readonly responsiveMultiPlatformTargets: ResponsiveMultiPlatformTargetsService,
  ) {}

  async create(inputValue: ManualFigmaExecutionPathInput, actorId: string): Promise<ManualFigmaExecutionPath> {
    const input = manualFigmaExecutionPathInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const bindings = await this.requireCurrentBindings(input)
      this.validateCatalog(input, bindings.designApplicability, bindings.designRequirements)
      await this.validateSourceReferences(input, initiative.id)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Manual Figma Execution Path candidate")
      }
      const now = new Date().toISOString()
      const record = manualFigmaExecutionPathSchema.parse({
        schemaVersion: 1,
        kind: "manual-figma-execution-path-candidate",
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
          "manual-figma-execution-path-is-candidate-guidance-and-does-not-connect-to-figma-execute-design-actions-grant-write-authority-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
      })
      await this.commitVersionedRecord(record, "manual-figma-execution-path.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: ManualFigmaExecutionPathInput,
    actorId: string,
  ): Promise<ManualFigmaExecutionPath> {
    const input = manualFigmaExecutionPathInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Manual Figma Execution Path revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Manual Figma Execution Path Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const bindings = await this.requireCurrentBindings(input)
      this.validateCatalog(input, bindings.designApplicability, bindings.designRequirements)
      await this.validateSourceReferences(input, initiative.id)
      const record = manualFigmaExecutionPathSchema.parse({
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
      await this.commitVersionedRecord(record, "manual-figma-execution-path.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<ManualFigmaExecutionPath> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Manual Figma Execution Path ID")),
      manualFigmaExecutionPathSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<ManualFigmaExecutionPath | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("manual-figma-execution-paths", currentRecordPattern, manualFigmaExecutionPathSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Manual Figma Execution Path candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<ManualFigmaExecutionPath> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Manual Figma Execution Path history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Manual Figma Execution Path ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), manualFigmaExecutionPathSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Manual Figma Execution Path history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<ManualFigmaExecutionPath[]> {
    const recordId = this.requireUuid(id, "Manual Figma Execution Path ID")
    const records = await this.listRecords(
      "manual-figma-execution-path-history",
      new RegExp(`^manual-figma-execution-path-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      manualFigmaExecutionPathSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Manual Figma Execution Path history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<ManualFigmaExecutionPathStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, designApplicability, screenStateInventory, designRequirements,
      designSystemTokenContract, accessibilityDesignRules, responsiveMultiPlatformTargets, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.designApplicability.readCurrent(targetId),
      this.screenStateInventory.readCurrent(targetId),
      this.designRequirements.readCurrent(targetId),
      this.designSystemTokenContract.readCurrent(targetId),
      this.accessibilityDesignRules.readCurrent(targetId),
      this.responsiveMultiPlatformTargets.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    let staleBindingCount = candidate ? this.bindingMismatchCount(candidate, product, initiative, {
      designApplicability,
      screenStateInventory,
      designRequirements,
      designSystemTokenContract,
      accessibilityDesignRules,
      responsiveMultiPlatformTargets,
    }) : 0
    if (candidate && staleBindingCount === 0 && designApplicability && designRequirements) {
      try {
        this.validateCatalog(candidate, designApplicability, designRequirements)
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
    const scopes = candidate?.scopes ?? []
    const instructions = candidate?.instructions ?? []
    const checks = candidate?.checks ?? []
    const coverage = candidate?.requirementCoverage ?? []
    const notAssessedCheckCount = checks.filter((entry) => entry.evidenceState === "not-assessed").length
    const evidenceRecordedCheckCount = checks.filter((entry) => entry.evidenceState === "evidence-recorded").length
    const humanReviewedCheckCount = checks.filter((entry) => entry.evidenceState === "human-reviewed").length
    const contradictedCheckCount = checks.filter((entry) => entry.observation === "evidence-contradicts").length
    const representedRequirementCount = coverage.filter((entry) => entry.state === "represented").length
    const unresolvedRequirementCount = coverage.filter((entry) => entry.state === "unresolved").length
    const unresolvedOwnershipCount = scopes.filter((entry) => entry.ownership.state === "unresolved").length
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const guideCatalogState = candidate?.guideCatalogState ?? "not-assessed"
    const handoffCatalogState = candidate?.handoffCatalogState ?? "not-assessed"
    const returnContractState = candidate?.returnContractState ?? "not-assessed"
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Manual Figma Execution Path candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind exact current Product, Initiative, design guidance, or responsive-target records")
    if (staleSourceReferenceCount > 0) reasons.push("One or more Manual Figma Execution Path entries reference a superseded Source revision")
    if (unresolvedOwnershipCount > 0) reasons.push("One or more manual execution scopes have unresolved candidate ownership")
    if (notAssessedCheckCount > 0) reasons.push("One or more manual execution checks have not been assessed")
    if (evidenceRecordedCheckCount > 0) reasons.push("One or more manual execution checks have evidence that is not attributable human-reviewed")
    if (contradictedCheckCount > 0) reasons.push("One or more manual execution checks record contradicting evidence")
    if (unresolvedRequirementCount > 0) reasons.push("One or more exact current Design Requirements have unresolved manual execution coverage")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved Manual Figma Execution Path questions")
    if (candidate && guideCatalogState !== "candidate-complete") reasons.push("The manual execution guide catalog is not marked candidate-complete")
    if (candidate && handoffCatalogState !== "candidate-complete") reasons.push("The manual handoff artifact catalog is not marked candidate-complete")
    if (candidate && returnContractState !== "candidate-complete") reasons.push("The manual return contract is not marked candidate-complete")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return manualFigmaExecutionPathStatusSchema.parse({
      schemaVersion: 1,
      kind: "manual-figma-execution-path-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      scopeCount: scopes.length,
      instructionCount: instructions.length,
      checkCount: checks.length,
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
      guideCatalogState,
      handoffCatalogState,
      returnContractState,
      reviewState,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "manual-figma-execution-path-status-is-observational-and-does-not-connect-to-figma-prove-execution-or-return-completeness-grant-write-authority-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<ManualFigmaExecutionPathProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Manual Figma Execution Path projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "manual-figma-execution-path-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        state: candidate.state,
        scopeCount: candidate.scopes.length,
        instructionCount: candidate.instructions.length,
        checkCount: candidate.checks.length,
        representedRequirementCount: candidate.requirementCoverage.filter((entry) => entry.state === "represented").length,
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-handoff-content-instructions-figma-identifiers-returned-design-source-or-personal-content-secrets-or-credentials" as const,
      authorityBoundary:
        "manual-figma-execution-path-projection-is-read-only-and-does-not-connect-to-figma-prove-execution-or-return-completeness-grant-write-authority-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority" as const,
    }
    return manualFigmaExecutionPathProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("manual-figma-execution-paths", currentRecordPattern, manualFigmaExecutionPathSchema)
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) {
          throw new Error("Manual Figma Execution Path membership digest is invalid")
        }
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Manual Figma Execution Path candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "manual-figma-execution-path.binding-review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale Manual Figma Execution Path bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "manual-figma-execution-path.invalid",
          severity: "error",
          message: `Manual Figma Execution Path ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Manual Figma Execution Path Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Manual Figma Execution Path candidate must bind exact current Product and Initiative revisions and digests")
    }
  }

  private async requireCurrentBindings(input: ManualFigmaExecutionPathInput): Promise<CurrentBindings> {
    const [designApplicability, screenStateInventory, designRequirements, designSystemTokenContract,
      accessibilityDesignRules, responsiveMultiPlatformTargets] = await Promise.all([
      this.designApplicability.readCurrent(input.initiativeId),
      this.screenStateInventory.readCurrent(input.initiativeId),
      this.designRequirements.readCurrent(input.initiativeId),
      this.designSystemTokenContract.readCurrent(input.initiativeId),
      this.accessibilityDesignRules.readCurrent(input.initiativeId),
      this.responsiveMultiPlatformTargets.readCurrent(input.initiativeId),
    ])
    const bindings = { designApplicability, screenStateInventory, designRequirements, designSystemTokenContract,
      accessibilityDesignRules, responsiveMultiPlatformTargets }
    for (const [key, candidate] of Object.entries(bindings)) {
      if (!candidate) throw new Error(`Manual Figma Execution Path requires current ${key}`)
      const reference = input[key as keyof Pick<ManualFigmaExecutionPathInput,
        "designApplicability" | "screenStateInventory" | "designRequirements" | "designSystemTokenContract" |
        "accessibilityDesignRules" | "responsiveMultiPlatformTargets">]
      if (reference.recordId !== candidate.id || reference.revision !== candidate.revision ||
          reference.digest !== canonicalDigest(candidate) || reference.membershipDigest !== candidate.membershipDigest) {
        throw new Error(`Manual Figma Execution Path must bind exact current ${key} and membership`)
      }
    }
    return bindings as CurrentBindings
  }

  private validateCatalog(
    input: ManualFigmaExecutionPathInput,
    designApplicability: DesignApplicability,
    designRequirements: DesignRequirements,
  ): void {
    const applicableScopes = new Map(designApplicability.scopes.flatMap((scope) => {
      const figma = scope.decisions.find((decision) => decision.aspect === "figma")
      if (!figma || !materialApplicability.has(figma.status)) return []
      const modes = scope.designSource.modes.filter((mode): mode is "figma-design" | "figma-make" =>
        mode === "figma-design" || mode === "figma-make")
      return modes.length > 0 ? [[scope.scope.id, new Set(modes)] as const] : []
    }))
    const scopeByKey = new Map(input.scopes.map((scope) => [scope.key, scope]))
    const instructionByKey = new Map(input.instructions.map((step) => [step.key, step]))
    for (const scope of input.scopes) {
      const allowedModes = applicableScopes.get(scope.designScopeKey)
      if (!allowedModes || !allowedModes.has(scope.figmaMode)) {
        throw new Error("Manual execution scopes must reference exact current material Figma applicability and selected modes")
      }
      const linkedInstructionKeys = input.instructions.filter((step) => step.scopeKeys.includes(scope.key)).map((step) => step.key).sort()
      if (canonicalDigest(scope.instructionStepKeys) !== canonicalDigest(linkedInstructionKeys)) {
        throw new Error("Manual execution scope instruction links must reconcile bidirectionally")
      }
    }
    if (new Set(input.scopes.map((scope) => scope.handoffLocation)).size !== input.scopes.length) {
      throw new Error("Manual execution scopes require unique configured repository handoff locations")
    }
    for (const step of input.instructions) {
      if (step.scopeKeys.some((key) => !scopeByKey.has(key))) {
        throw new Error("Manual execution instructions must stay inside the candidate scope catalog")
      }
    }
    if (input.guideCatalogState === "candidate-complete") {
      if (canonicalDigest(input.instructions.map((entry) => entry.kind)) !== canonicalDigest(manualFigmaInstructionKinds)) {
        throw new Error("Candidate-complete manual guidance requires the canonical instruction sequence")
      }
      for (const scope of input.scopes) {
        if (manualFigmaInstructionKinds.some((kind) =>
          !input.instructions.some((step) => step.kind === kind && step.scopeKeys.includes(scope.key)))) {
          throw new Error("Candidate-complete manual guidance must address every governed scope in every canonical instruction stage")
        }
      }
    }
    const exactScopeIds = [...applicableScopes.keys()].sort()
    if (input.guideCatalogState === "candidate-complete" && input.handoffCatalogState === "candidate-complete" &&
        input.returnContractState === "candidate-complete" &&
        canonicalDigest(input.scopes.map((scope) => scope.designScopeKey).sort()) !== canonicalDigest(exactScopeIds)) {
      throw new Error("Candidate-complete Manual Figma Execution Path must cover every exact current material Figma scope once")
    }
    if (input.reviewState === "ready-for-human-review") {
      for (const scope of input.scopes) {
        const kinds = input.checks.filter((check) => check.scopeKey === scope.key).map((check) => check.kind).sort()
        if (canonicalDigest(kinds) !== canonicalDigest([...manualCheckKinds])) {
          throw new Error("Review-ready manual guidance requires every canonical check for every execution scope")
        }
      }
    }
    for (const scope of input.scopes) {
      if (scope.instructionStepKeys.some((key) => !instructionByKey.has(key))) {
        throw new Error("Manual execution scopes must reference exact candidate instruction steps")
      }
    }
    const requirementKeys = designRequirements.requirements.map((entry) => entry.key).sort()
    if (canonicalDigest(input.requirementCoverage.map((entry) => entry.requirementKey)) !== canonicalDigest(requirementKeys)) {
      throw new Error("Manual Figma Execution Path coverage must include every exact current Design Requirement once")
    }
  }

  private bindingMismatchCount(
    input: ManualFigmaExecutionPathInput,
    product: Product,
    initiative: Initiative,
    bindings: { [K in keyof CurrentBindings]: CurrentBindings[K] | undefined },
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
          reference.digest !== canonicalDigest(candidate) || reference.membershipDigest !== candidate.membershipDigest) {
        mismatches += 1
      }
    }
    return mismatches
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Manual Figma Execution Path Source identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Manual Figma Execution Path guidance is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: ManualFigmaExecutionPath, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, manualFigmaExecutionPathSchema),
        this.governed(this.historyPath(record.id, record.revision), record, manualFigmaExecutionPathSchema),
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
          screenStateInventory: record.screenStateInventory,
          designRequirements: record.designRequirements,
          designSystemTokenContract: record.designSystemTokenContract,
          accessibilityDesignRules: record.accessibilityDesignRules,
          responsiveMultiPlatformTargets: record.responsiveMultiPlatformTargets,
          scopeCount: record.scopes.length,
          instructionCount: record.instructions.length,
          checkCount: record.checks.length,
          scopeCatalogDigest: canonicalDigest(record.scopes.map((entry) => ({
            key: entry.key,
            designScopeKey: entry.designScopeKey,
            figmaMode: entry.figmaMode,
            executionMode: entry.executionMode,
            handoffLocation: entry.handoffLocation,
            handoffManifestDigest: entry.handoffManifestDigest,
            handoffPackageDigest: entry.handoffPackageDigest,
            includedArtifacts: entry.includedArtifacts,
            requiredReturns: entry.requiredReturns,
            instructionStepKeys: entry.instructionStepKeys,
            ownershipState: entry.ownership.state,
          }))),
          instructionCatalogDigest: canonicalDigest(record.instructions.map((entry) => ({
            key: entry.key,
            sequence: entry.sequence,
            kind: entry.kind,
            scopeKeys: entry.scopeKeys,
            requiredInputs: entry.requiredInputs,
            expectedOutputs: entry.expectedOutputs,
            humanActionRequired: entry.humanActionRequired,
            completionState: entry.completionState,
            actionAuthorityState: entry.actionAuthorityState,
          }))),
          checkCatalogDigest: canonicalDigest(record.checks.map((entry) => ({
            key: entry.key,
            scopeKey: entry.scopeKey,
            kind: entry.kind,
            evidenceState: entry.evidenceState,
            observation: entry.observation,
            evidenceDigests: entry.evidenceDigests,
          }))),
          requirementCoverageDigest: canonicalDigest(record.requirementCoverage.map((entry) => ({
            requirementKey: entry.requirementKey,
            state: entry.state,
            scopeKeys: entry.scopeKeys,
          }))),
          guideCatalogState: record.guideCatalogState,
          handoffCatalogState: record.handoffCatalogState,
          returnContractState: record.returnContractState,
          reviewState: record.reviewState,
          figmaConnectionState: record.figmaConnectionState,
          figmaExecutionState: record.figmaExecutionState,
          figmaWriteAuthorityState: record.figmaWriteAuthorityState,
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
    return this.repository.resolve("manual-figma-execution-paths", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve(
      "manual-figma-execution-path-history",
      `manual-figma-execution-path-${id}-r${revision}.json`,
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
    if (names.length > inventoryLimit) throw new Error(`Manual Figma Execution Path directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
