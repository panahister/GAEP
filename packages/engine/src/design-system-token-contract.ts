import { randomUUID } from "node:crypto"

import {
  designSystemTokenContractInputSchema,
  designSystemTokenContractProjectionSchema,
  designSystemTokenContractSchema,
  designSystemTokenContractStatusSchema,
  exactSourceReferenceSchema,
  type BusinessContextBinding,
  type DesignApplicability,
  type DesignRequirements,
  type DesignSystemTokenContract,
  type DesignSystemTokenContractInput,
  type DesignSystemTokenContractProjection,
  type DesignSystemTokenContractStatus,
  type ExactSourceReference,
  type Initiative,
  type Product,
  type ScreenStateInventory,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { DesignApplicabilityService } from "./design-applicability.js"
import type { DesignRequirementsService } from "./design-requirements.js"
import type { ProductStudioService } from "./product-studio.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { ScreenStateInventoryService } from "./screen-state-inventory.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type PortableDesignSnapshot = Awaited<ReturnType<ProductStudioService["readPortableDesignSnapshot"]>>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: DesignSystemTokenContract) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: DesignSystemTokenContractInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    designApplicability: input.designApplicability,
    screenStateInventory: input.screenStateInventory,
    designRequirements: input.designRequirements,
    portableDesignSnapshot: input.portableDesignSnapshot,
    designSystems: input.designSystems,
    tokens: input.tokens,
    variableCollections: input.variableCollections,
    variables: input.variables,
    components: input.components,
    requirementCoverage: input.requirementCoverage,
    catalogCompletenessState: input.catalogCompletenessState,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    designSystemValidityState: input.designSystemValidityState,
    ownershipAuthorityState: input.ownershipAuthorityState,
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

export class DesignSystemTokenContractService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly designApplicability: DesignApplicabilityService,
    private readonly screenStateInventory: ScreenStateInventoryService,
    private readonly designRequirements: DesignRequirementsService,
    private readonly productStudio: ProductStudioService,
  ) {}

  async create(inputValue: DesignSystemTokenContractInput, actorId: string): Promise<DesignSystemTokenContract> {
    const input = designSystemTokenContractInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const [applicability, inventory, requirements, snapshot] = await Promise.all([
        this.requireCurrentDesignApplicability(input),
        this.requireCurrentScreenStateInventory(input),
        this.requireCurrentDesignRequirements(input),
        this.requirePortableDesignSnapshot(input, product, initiative),
      ])
      this.validateCatalog(input, applicability, inventory, requirements, snapshot)
      await this.validateSourceReferences(input, initiative.id)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Design System and Token Contract candidate")
      }
      const now = new Date().toISOString()
      const record = designSystemTokenContractSchema.parse({
        schemaVersion: 1,
        kind: "design-system-token-contract-candidate",
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
          "design-system-token-contract-is-candidate-metadata-and-does-not-establish-design-system-token-variable-or-component-validity-ownership-authority-accessibility-design-approval-baseline-readiness-implementation-or-action-authority",
      })
      await this.commitVersionedRecord(record, "design-system-token-contract.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: DesignSystemTokenContractInput,
    actorId: string,
  ): Promise<DesignSystemTokenContract> {
    const input = designSystemTokenContractInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Design System and Token Contract revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Design System and Token Contract Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const [applicability, inventory, requirements, snapshot] = await Promise.all([
        this.requireCurrentDesignApplicability(input),
        this.requireCurrentScreenStateInventory(input),
        this.requireCurrentDesignRequirements(input),
        this.requirePortableDesignSnapshot(input, product, initiative),
      ])
      this.validateCatalog(input, applicability, inventory, requirements, snapshot)
      await this.validateSourceReferences(input, initiative.id)
      const record = designSystemTokenContractSchema.parse({
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
      await this.commitVersionedRecord(record, "design-system-token-contract.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<DesignSystemTokenContract> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Design System and Token Contract ID")),
      designSystemTokenContractSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<DesignSystemTokenContract | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("design-system-token-contracts", currentRecordPattern, designSystemTokenContractSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Design System and Token Contract candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<DesignSystemTokenContract> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Design System and Token Contract history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Design System and Token Contract ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), designSystemTokenContractSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Design System and Token Contract history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<DesignSystemTokenContract[]> {
    const recordId = this.requireUuid(id, "Design System and Token Contract ID")
    const records = await this.listRecords(
      "design-system-token-contracts-history",
      new RegExp(`^design-system-token-contract-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      designSystemTokenContractSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Design System and Token Contract history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<DesignSystemTokenContractStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, applicability, inventory, requirements, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.designApplicability.readCurrent(targetId),
      this.screenStateInventory.readCurrent(targetId),
      this.designRequirements.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    let staleBindingCount = candidate
      ? this.bindingMismatchCount(candidate, product, initiative, applicability, inventory, requirements)
      : 0
    let snapshot: PortableDesignSnapshot | undefined
    let stalePortableSnapshotCount = 0
    if (candidate?.portableDesignSnapshot) {
      try {
        snapshot = await this.productStudio.readPortableDesignSnapshot(candidate.portableDesignSnapshot.bundleId)
        if (!this.portableSnapshotMatches(candidate, snapshot, product, initiative)) stalePortableSnapshotCount = 1
      } catch {
        stalePortableSnapshotCount = 1
      }
    }
    if (candidate && staleBindingCount === 0 && stalePortableSnapshotCount === 0 && applicability && inventory && requirements) {
      try {
        this.validateCatalog(candidate, applicability, inventory, requirements, snapshot)
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
    const systems = candidate?.designSystems ?? []
    const tokens = candidate?.tokens ?? []
    const collections = candidate?.variableCollections ?? []
    const variables = candidate?.variables ?? []
    const components = candidate?.components ?? []
    const coverage = candidate?.requirementCoverage ?? []
    const unresolvedOwnershipCount = [...systems, ...tokens, ...collections, ...variables, ...components]
      .filter((entry) => entry.ownership.state === "unresolved").length
    const unresolvedCatalogItemCount = systems.filter((entry) => entry.disposition === "unresolved").length +
      tokens.filter((entry) => entry.origin === "unresolved").length +
      variables.filter((entry) => entry.state === "unresolved").length +
      components.filter((entry) => entry.disposition === "unresolved").length
    const accessibilityReviewGapCount = tokens.filter((entry) => entry.accessibilityImpact !== "human-reviewed").length +
      components.filter((entry) => entry.accessibilityEvidenceState === "not-assessed").length
    const representedRequirementCount = coverage.filter((entry) => entry.state === "represented").length
    const unresolvedRequirementCount = coverage.filter((entry) => entry.state === "unresolved").length
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const catalogCompletenessState = candidate?.catalogCompletenessState ?? "not-assessed"
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Design System and Token Contract candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind exact current Product, Initiative, Design Applicability, Screen and State Inventory, or Design Requirements records")
    if (stalePortableSnapshotCount > 0) reasons.push("The imported token or component metadata does not bind the exact current portable design snapshot evidence")
    if (staleSourceReferenceCount > 0) reasons.push("One or more design-system catalog entries reference a superseded Source revision")
    if (unresolvedOwnershipCount > 0) reasons.push("One or more design-system catalog entries have unresolved candidate ownership")
    if (unresolvedCatalogItemCount > 0) reasons.push("One or more Design Systems, Tokens, Variables, or Components remain unresolved")
    if (accessibilityReviewGapCount > 0) reasons.push("One or more Token or Component entries retain an accessibility review gap")
    if (unresolvedRequirementCount > 0) reasons.push("One or more exact current Design Requirements lack represented catalog coverage")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved Design System and Token Contract questions")
    if (candidate && catalogCompletenessState !== "candidate-complete") reasons.push("The candidate catalog is not marked candidate-complete")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return designSystemTokenContractStatusSchema.parse({
      schemaVersion: 1,
      kind: "design-system-token-contract-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      designSystemCount: systems.length,
      tokenCount: tokens.length,
      variableCollectionCount: collections.length,
      variableCount: variables.length,
      componentCount: components.length,
      representedRequirementCount,
      unresolvedRequirementCount,
      unresolvedOwnershipCount,
      unresolvedCatalogItemCount,
      accessibilityReviewGapCount,
      staleBindingCount,
      stalePortableSnapshotCount,
      staleSourceReferenceCount,
      unresolvedQuestionCount,
      catalogCompletenessState,
      reviewState,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "design-system-token-contract-status-is-observational-and-does-not-establish-design-system-token-variable-or-component-validity-ownership-authority-accessibility-design-approval-baseline-readiness-implementation-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<DesignSystemTokenContractProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Design System and Token Contract projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "design-system-token-contract-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        state: candidate.state,
        designSystemCount: candidate.designSystems.length,
        tokenCount: candidate.tokens.length,
        variableCollectionCount: candidate.variableCollections.length,
        variableCount: candidate.variables.length,
        componentCount: candidate.components.length,
        representedRequirementCount: candidate.requirementCoverage.filter((entry) => entry.state === "represented").length,
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-token-values-component-content-requirement-source-design-or-personal-content-secrets-or-credentials" as const,
      authorityBoundary:
        "design-system-token-contract-projection-is-read-only-and-does-not-establish-design-system-token-variable-or-component-validity-ownership-authority-accessibility-design-approval-baseline-readiness-implementation-write-or-action-authority" as const,
    }
    return designSystemTokenContractProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("design-system-token-contracts", currentRecordPattern, designSystemTokenContractSchema)
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) {
          throw new Error("Design System and Token Contract membership digest is invalid")
        }
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Design System and Token Contract candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.stalePortableSnapshotCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "design-system-token-contract.binding-review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale Design System and Token Contract bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "design-system-token-contract.invalid",
          severity: "error",
          message: `Design System and Token Contract ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Design System and Token Contract Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Design System and Token Contract candidate must bind exact current Product and Initiative revisions and digests")
    }
  }

  private async requireCurrentDesignApplicability(input: DesignSystemTokenContractInput): Promise<DesignApplicability> {
    const candidate = await this.designApplicability.readCurrent(input.initiativeId)
    if (!candidate) throw new Error("Design System and Token Contract requires current Design Applicability")
    if (input.designApplicability.recordId !== candidate.id || input.designApplicability.revision !== candidate.revision ||
        input.designApplicability.digest !== canonicalDigest(candidate) ||
        input.designApplicability.membershipDigest !== candidate.membershipDigest) {
      throw new Error("Design System and Token Contract must bind exact current Design Applicability and membership")
    }
    return candidate
  }

  private async requireCurrentScreenStateInventory(input: DesignSystemTokenContractInput): Promise<ScreenStateInventory> {
    const candidate = await this.screenStateInventory.readCurrent(input.initiativeId)
    if (!candidate) throw new Error("Design System and Token Contract requires current Screen and State Inventory")
    if (input.screenStateInventory.recordId !== candidate.id || input.screenStateInventory.revision !== candidate.revision ||
        input.screenStateInventory.digest !== canonicalDigest(candidate) ||
        input.screenStateInventory.membershipDigest !== candidate.membershipDigest) {
      throw new Error("Design System and Token Contract must bind exact current Screen and State Inventory and membership")
    }
    return candidate
  }

  private async requireCurrentDesignRequirements(input: DesignSystemTokenContractInput): Promise<DesignRequirements> {
    const candidate = await this.designRequirements.readCurrent(input.initiativeId)
    if (!candidate) throw new Error("Design System and Token Contract requires current Design Requirements")
    if (input.designRequirements.recordId !== candidate.id || input.designRequirements.revision !== candidate.revision ||
        input.designRequirements.digest !== canonicalDigest(candidate) ||
        input.designRequirements.membershipDigest !== candidate.membershipDigest) {
      throw new Error("Design System and Token Contract must bind exact current Design Requirements and membership")
    }
    return candidate
  }

  private async requirePortableDesignSnapshot(
    input: DesignSystemTokenContractInput,
    product: Product,
    initiative: Initiative,
  ): Promise<PortableDesignSnapshot | undefined> {
    const imported = input.tokens.some((entry) => entry.origin === "imported-snapshot") ||
      input.components.some((entry) => entry.disposition === "imported-snapshot")
    if (!input.portableDesignSnapshot) {
      if (imported) throw new Error("Imported Tokens or Components require an exact portable design snapshot")
      return undefined
    }
    const snapshot = await this.productStudio.readPortableDesignSnapshot(input.portableDesignSnapshot.bundleId)
    if (!this.portableSnapshotMatches(input, snapshot, product, initiative)) {
      throw new Error("Portable design snapshot identity, Product, Initiative, source review, snapshot digest, or evidence digest differs")
    }
    return snapshot
  }

  private portableSnapshotMatches(
    input: DesignSystemTokenContractInput,
    snapshot: PortableDesignSnapshot,
    product: Product,
    initiative: Initiative,
  ): boolean {
    const reference = input.portableDesignSnapshot
    return Boolean(reference && snapshot.bundleId === reference.bundleId && snapshot.productId === product.id &&
      snapshot.initiativeId === initiative.id && snapshot.snapshotDigest === reference.snapshotDigest &&
      snapshot.evidence.evidenceDigest === reference.evidenceDigest && snapshot.sourceReview.status === reference.sourceReviewStatus)
  }

  private validateCatalog(
    input: DesignSystemTokenContractInput,
    applicability: DesignApplicability,
    inventory: ScreenStateInventory,
    requirements: DesignRequirements,
    snapshot: PortableDesignSnapshot | undefined,
  ): void {
    const approvedSystems = new Set(applicability.scopes.flatMap((scope) => scope.approvedDesignSystems.map((name) =>
      `${scope.scope.kind}:${scope.scope.id}:${name}`)))
    for (const system of input.designSystems) {
      if (system.approvedReference && !approvedSystems.has(
        `${system.approvedReference.scopeKind}:${system.approvedReference.scopeId}:${system.approvedReference.name}`)) {
        throw new Error("Reuse-approved Design Systems must match an exact current Design Applicability scope and name")
      }
    }
    const requirementKeys = requirements.requirements.map((entry) => entry.key).sort((left, right) => left.localeCompare(right))
    if (canonicalDigest(input.requirementCoverage.map((entry) => entry.requirementKey)) !== canonicalDigest(requirementKeys)) {
      throw new Error("Design System and Token Contract requirement coverage must include every exact current Design Requirement once")
    }
    const requirementKeySet = new Set(requirementKeys)
    const platformKeys = new Set(inventory.platforms.filter((entry) => entry.supportState === "targeted").map((entry) => entry.key))
    const screenKeys = new Set(inventory.screens.map((entry) => entry.key))
    const stateKeys = new Set(inventory.states.map((entry) => entry.key))
    const variantKeys = new Set(inventory.variants.map((entry) => entry.key))
    const assertKeys = (values: string[], allowed: Set<string>, label: string) => {
      if (values.some((value) => !allowed.has(value))) throw new Error(`${label} must stay inside the exact current governed catalog`)
    }
    for (const token of input.tokens) {
      assertKeys(token.requirementKeys, requirementKeySet, "Token Requirement links")
      assertKeys(token.platformKeys, platformKeys, "Token platform links")
      assertKeys(token.screenKeys, screenKeys, "Token screen links")
    }
    for (const variable of input.variables) assertKeys(variable.requirementKeys, requirementKeySet, "Variable Requirement links")
    for (const component of input.components) {
      assertKeys(component.requirementKeys, requirementKeySet, "Component Requirement links")
      assertKeys(component.platformKeys, platformKeys, "Component platform links")
      assertKeys(component.screenKeys, screenKeys, "Component screen links")
      assertKeys(component.stateKeys, stateKeys, "Component state links")
      assertKeys(component.variantKeys, variantKeys, "Component variant links")
    }
    const coverageByRequirement = new Map(input.requirementCoverage.map((entry) => [entry.requirementKey, entry]))
    for (const token of input.tokens) {
      if (token.requirementKeys.some((key) => !coverageByRequirement.get(key)?.tokenPaths.includes(token.path))) {
        throw new Error("Token Requirement links must reconcile to exact requirement coverage")
      }
    }
    for (const variable of input.variables) {
      if (variable.requirementKeys.some((key) => !coverageByRequirement.get(key)?.variableKeys.includes(variable.key))) {
        throw new Error("Variable Requirement links must reconcile to exact requirement coverage")
      }
    }
    for (const component of input.components) {
      if (component.requirementKeys.some((key) => !coverageByRequirement.get(key)?.componentKeys.includes(component.key))) {
        throw new Error("Component Requirement links must reconcile to exact requirement coverage")
      }
    }
    if (snapshot) {
      const importedTokens = new Map(snapshot.tokens.map((entry) => [
        `${entry.artifactId}:${entry.path}`,
        entry,
      ]))
      for (const token of input.tokens.filter((entry) => entry.origin === "imported-snapshot")) {
        const reference = token.importedToken!
        const imported = importedTokens.get(`${reference.artifactId}:${reference.path}`)
        if (!imported || imported.type !== reference.type || imported.valueDigest !== reference.valueDigest) {
          throw new Error("Imported Token reference does not match exact normalized portable design snapshot metadata")
        }
      }
      const importedComponents = new Map(snapshot.artifacts.filter((entry) => entry.kind === "component")
        .map((entry) => [entry.id, entry]))
      for (const component of input.components.filter((entry) => entry.disposition === "imported-snapshot")) {
        const reference = component.importedComponent!
        const imported = importedComponents.get(reference.artifactId)
        if (!imported || imported.digest !== reference.digest) {
          throw new Error("Imported Component reference does not match exact portable design snapshot metadata")
        }
      }
    }
  }

  private bindingMismatchCount(
    input: DesignSystemTokenContractInput,
    product: Product,
    initiative: Initiative,
    applicability: DesignApplicability | undefined,
    inventory: ScreenStateInventory | undefined,
    requirements: DesignRequirements | undefined,
  ): number {
    let mismatches = 0
    const expectedContext = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(input.context) !== canonicalDigest(expectedContext)) mismatches += 1
    if (!applicability || input.designApplicability.recordId !== applicability.id ||
        input.designApplicability.revision !== applicability.revision || input.designApplicability.digest !== canonicalDigest(applicability) ||
        input.designApplicability.membershipDigest !== applicability.membershipDigest) mismatches += 1
    if (!inventory || input.screenStateInventory.recordId !== inventory.id ||
        input.screenStateInventory.revision !== inventory.revision || input.screenStateInventory.digest !== canonicalDigest(inventory) ||
        input.screenStateInventory.membershipDigest !== inventory.membershipDigest) mismatches += 1
    if (!requirements || input.designRequirements.recordId !== requirements.id ||
        input.designRequirements.revision !== requirements.revision || input.designRequirements.digest !== canonicalDigest(requirements) ||
        input.designRequirements.membershipDigest !== requirements.membershipDigest) mismatches += 1
    return mismatches
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Design System and Token Contract Source identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Design System and Token Contract guidance is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: DesignSystemTokenContract, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, designSystemTokenContractSchema),
        this.governed(this.historyPath(record.id, record.revision), record, designSystemTokenContractSchema),
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
          portableDesignSnapshot: record.portableDesignSnapshot,
          designSystemCount: record.designSystems.length,
          tokenCount: record.tokens.length,
          variableCollectionCount: record.variableCollections.length,
          variableCount: record.variables.length,
          componentCount: record.components.length,
          requirementCoverageDigest: canonicalDigest(record.requirementCoverage.map((entry) => ({
            requirementKey: entry.requirementKey,
            state: entry.state,
            tokenPaths: entry.tokenPaths,
            variableKeys: entry.variableKeys,
            componentKeys: entry.componentKeys,
          }))),
          designSystemCatalogDigest: canonicalDigest(record.designSystems.map((entry) => ({
            key: entry.key,
            disposition: entry.disposition,
            ownershipState: entry.ownership.state,
          }))),
          tokenCatalogDigest: canonicalDigest(record.tokens.map((entry) => ({
            path: entry.path,
            designSystemKey: entry.designSystemKey,
            origin: entry.origin,
            valueDigest: entry.valueDigest,
            ownershipState: entry.ownership.state,
          }))),
          variableCatalogDigest: canonicalDigest(record.variables.map((entry) => ({
            key: entry.key,
            collectionKey: entry.collectionKey,
            designSystemKey: entry.designSystemKey,
            state: entry.state,
            tokenPath: entry.tokenPath,
            ownershipState: entry.ownership.state,
          }))),
          componentCatalogDigest: canonicalDigest(record.components.map((entry) => ({
            key: entry.key,
            designSystemKey: entry.designSystemKey,
            disposition: entry.disposition,
            ownershipState: entry.ownership.state,
          }))),
          catalogCompletenessState: record.catalogCompletenessState,
          reviewState: record.reviewState,
          designSystemValidityState: record.designSystemValidityState,
          ownershipAuthorityState: record.ownershipAuthorityState,
          designApprovalState: record.designApprovalState,
          designBaselineState: record.designBaselineState,
          readinessState: record.readinessState,
          implementationAuthorityState: record.implementationAuthorityState,
          tokenVariableComponentValidityState: "not-established",
          accessibilityValidityState: "not-established",
          writeAuthorityState: "not-granted",
          actionAuthorityState: "not-granted",
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("design-system-token-contracts", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve(
      "design-system-token-contracts-history",
      `design-system-token-contract-${id}-r${revision}.json`,
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
    if (names.length > inventoryLimit) throw new Error(`Design System and Token Contract directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
