import { randomUUID } from "node:crypto"

import {
  exactSourceReferenceSchema,
  screenStateInventoryInputSchema,
  screenStateInventoryProjectionSchema,
  screenStateInventorySchema,
  screenStateInventoryStatusSchema,
  type BusinessContextBinding,
  type ExactSourceReference,
  type InformationArchitectureModel,
  type Initiative,
  type Product,
  type ScreenStateInventory,
  type ScreenStateInventoryInput,
  type ScreenStateInventoryProjection,
  type ScreenStateInventoryStatus,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"
import type { InformationArchitectureModelService } from "./information-architecture-model.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const weakEvidenceStates = new Set(["hypothesis", "disputed"])

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: ScreenStateInventory) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: ScreenStateInventoryInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    informationArchitectureModel: input.informationArchitectureModel,
    platforms: input.platforms,
    screens: input.screens,
    states: input.states,
    variants: input.variants,
    routeCoverage: input.routeCoverage,
    scopeCoverage: input.scopeCoverage,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    uiCompletenessState: input.uiCompletenessState,
    platformParityState: input.platformParityState,
    stateReachabilityState: input.stateReachabilityState,
    interactionQualityState: input.interactionQualityState,
    accessibilityValidationState: input.accessibilityValidationState,
    designApprovalState: input.designApprovalState,
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

function touchpointIdentity(journeyKey: string, touchpointKey: string): string {
  return `${journeyKey}:${touchpointKey}`
}

export class ScreenStateInventoryService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly informationArchitectureModel: InformationArchitectureModelService,
  ) {}

  async create(inputValue: ScreenStateInventoryInput, actorId: string): Promise<ScreenStateInventory> {
    const input = screenStateInventoryInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const architecture = await this.requireCurrentArchitecture(input)
      this.validateInventoryLinks(input, architecture)
      await this.validateSourceReferences(input, initiative.id)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Screen and State Inventory candidate")
      }
      const now = new Date().toISOString()
      const record = screenStateInventorySchema.parse({
        schemaVersion: 1,
        kind: "screen-state-inventory-candidate",
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
          "screen-state-inventory-is-candidate-guidance-and-does-not-prove-ui-completeness-platform-parity-state-reachability-interaction-quality-or-accessibility-approve-design-grant-readiness-or-authorize-action",
      })
      await this.commitVersionedRecord(record, "screen-state-inventory.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: ScreenStateInventoryInput,
    actorId: string,
  ): Promise<ScreenStateInventory> {
    const input = screenStateInventoryInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Screen and State Inventory revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Screen and State Inventory Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const architecture = await this.requireCurrentArchitecture(input)
      this.validateInventoryLinks(input, architecture)
      await this.validateSourceReferences(input, initiative.id)
      const record = screenStateInventorySchema.parse({
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
      await this.commitVersionedRecord(record, "screen-state-inventory.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<ScreenStateInventory> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Screen and State Inventory ID")), screenStateInventorySchema)
  }

  async readCurrent(initiativeId: string): Promise<ScreenStateInventory | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("screen-state-inventories", currentRecordPattern, screenStateInventorySchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Screen and State Inventory candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<ScreenStateInventory> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Screen and State Inventory history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Screen and State Inventory ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), screenStateInventorySchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Screen and State Inventory history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<ScreenStateInventory[]> {
    const recordId = this.requireUuid(id, "Screen and State Inventory ID")
    const records = await this.listRecords(
      "screen-state-inventory-history",
      new RegExp(`^screen-state-inventory-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      screenStateInventorySchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Screen and State Inventory history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<ScreenStateInventoryStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, architecture, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.informationArchitectureModel.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const staleBindingCount = candidate ? this.bindingMismatchCount(candidate, product, initiative, architecture) : 0
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(candidate).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const platforms = candidate?.platforms ?? []
    const screens = candidate?.screens ?? []
    const states = candidate?.states ?? []
    const variants = candidate?.variants ?? []
    const routeCoverage = candidate?.routeCoverage ?? []
    const scopeCoverage = candidate?.scopeCoverage ?? []
    const weakEvidenceItemCount = [...screens, ...states, ...variants]
      .filter((entry) => weakEvidenceStates.has(entry.evidence.state)).length
    const unresolvedPlatformCount = platforms.filter((entry) => entry.supportState === "unresolved").length
    const unresolvedRouteCount = routeCoverage.filter((entry) => entry.status === "unresolved").length
    const unresolvedScopeCount = scopeCoverage.filter((entry) => entry.status === "unresolved").length
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Screen and State Inventory candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind the exact current Product, Initiative, or Information Architecture record")
    if (staleSourceReferenceCount > 0) reasons.push("One or more platform, screen, state, variant, route, or scope assertions reference a superseded Source revision")
    if (unresolvedPlatformCount > 0) reasons.push("One or more experience platforms remain unresolved")
    if (unresolvedRouteCount > 0) reasons.push("One or more exact Information Architecture routes lack resolved screen and state coverage")
    if (unresolvedScopeCount > 0) reasons.push("One or more exact Information Architecture design scopes lack resolved screen coverage")
    if (weakEvidenceItemCount > 0) reasons.push("One or more screens, states, or variants retain hypothetical or disputed evidence")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved Screen and State Inventory questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return screenStateInventoryStatusSchema.parse({
      schemaVersion: 1,
      kind: "screen-state-inventory-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      platformCount: platforms.length,
      targetedPlatformCount: platforms.filter((entry) => entry.supportState === "targeted").length,
      unresolvedPlatformCount,
      screenCount: screens.length,
      stateCount: states.length,
      variantCount: variants.length,
      representedRouteCount: routeCoverage.filter((entry) => entry.status === "represented").length,
      unresolvedRouteCount,
      representedScopeCount: scopeCoverage.filter((entry) => entry.status === "represented").length,
      unresolvedScopeCount,
      weakEvidenceItemCount,
      staleBindingCount,
      staleSourceReferenceCount,
      unresolvedQuestionCount,
      reviewState,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "screen-state-inventory-status-is-observational-and-does-not-prove-ui-completeness-platform-parity-state-reachability-interaction-quality-or-accessibility-approve-design-grant-readiness-or-authorize-action",
    })
  }

  async project(initiativeId: string): Promise<ScreenStateInventoryProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Screen and State Inventory projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "screen-state-inventory-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest, state: candidate.state,
        platformCount: candidate.platforms.length, screenCount: candidate.screens.length,
        stateCount: candidate.states.length, variantCount: candidate.variants.length,
        reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-screen-state-variant-platform-content-persona-source-or-personal-content-secrets-or-credentials" as const,
      authorityBoundary:
        "screen-state-inventory-projection-is-read-only-and-does-not-prove-ui-completeness-platform-parity-state-reachability-interaction-quality-or-accessibility-approve-design-grant-readiness-or-authorize-write-or-action" as const,
    }
    return screenStateInventoryProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("screen-state-inventories", currentRecordPattern, screenStateInventorySchema)
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) {
          throw new Error("Screen and State Inventory membership digest is invalid")
        }
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Screen and State Inventory candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "screen-state-inventory.binding-review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale Screen and State Inventory bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "screen-state-inventory.invalid",
          severity: "error",
          message: `Screen and State Inventory ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Screen and State Inventory Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Screen and State Inventory candidate must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async requireCurrentArchitecture(input: ScreenStateInventoryInput): Promise<InformationArchitectureModel> {
    const architecture = await this.informationArchitectureModel.readCurrent(input.initiativeId)
    if (!architecture) throw new Error("Screen and State Inventory candidate requires a current Information Architecture model")
    if (input.informationArchitectureModel.recordId !== architecture.id ||
        input.informationArchitectureModel.revision !== architecture.revision ||
        input.informationArchitectureModel.digest !== canonicalDigest(architecture) ||
        input.informationArchitectureModel.membershipDigest !== architecture.membershipDigest) {
      throw new Error("Screen and State Inventory candidate must bind the exact current Information Architecture record and membership")
    }
    return architecture
  }

  private validateInventoryLinks(input: ScreenStateInventoryInput, architecture: InformationArchitectureModel): void {
    const nodeByKey = new Map(architecture.contentNodes.map((node) => [node.key, node]))
    const routeByKey = new Map(architecture.navigationRoutes.map((route) => [route.key, route]))
    const scopeByKey = new Map(architecture.scopeCoverage.map((scope) => [scope.designScopeKey, scope]))
    const journeyKeys = new Set(architecture.contentNodes.flatMap((node) => node.journeyKeys))
    const touchpoints = new Set(architecture.contentNodes.flatMap((node) =>
      node.touchpoints.map((entry) => touchpointIdentity(entry.journeyKey, entry.touchpointKey))))
    const personaKeys = new Set(architecture.contentNodes.flatMap((node) => node.personaKeys))
    for (const screen of input.screens) {
      if (screen.routeKeys.some((key) => !routeByKey.has(key)) ||
          screen.contentNodeKeys.some((key) => !nodeByKey.has(key)) ||
          screen.designScopeKeys.some((key) => !scopeByKey.has(key)) ||
          screen.journeyKeys.some((key) => !journeyKeys.has(key)) ||
          screen.touchpoints.some((entry) => !touchpoints.has(touchpointIdentity(entry.journeyKey, entry.touchpointKey))) ||
          screen.personaKeys.some((key) => !personaKeys.has(key))) {
        throw new Error("Screens must stay inside the exact current Information Architecture route, node, scope, journey, touchpoint, and persona boundaries")
      }
    }
    const expectedRoutes = [...routeByKey.keys()].sort((left, right) => left.localeCompare(right))
    if (canonicalDigest(input.routeCoverage.map((entry) => entry.routeKey)) !== canonicalDigest(expectedRoutes)) {
      throw new Error("Screen and State Inventory route coverage must include every exact current Information Architecture route once")
    }
    const screenByKey = new Map(input.screens.map((screen) => [screen.key, screen]))
    const stateByKey = new Map(input.states.map((state) => [state.key, state]))
    for (const coverage of input.routeCoverage) {
      if (coverage.screenKeys.some((key) => !screenByKey.get(key)?.routeKeys.includes(coverage.routeKey)) ||
          coverage.stateKeys.some((key) => !stateByKey.get(key)?.routeKeys.includes(coverage.routeKey))) {
        throw new Error("Represented route coverage must reference screens and states that declare the exact Information Architecture route")
      }
    }
    const expectedScopes = [...scopeByKey.keys()].sort((left, right) => left.localeCompare(right))
    if (canonicalDigest(input.scopeCoverage.map((entry) => entry.designScopeKey)) !== canonicalDigest(expectedScopes)) {
      throw new Error("Screen and State Inventory scope coverage must include every exact current Information Architecture scope once")
    }
    for (const coverage of input.scopeCoverage) {
      const architectureCoverage = scopeByKey.get(coverage.designScopeKey)
      if (!architectureCoverage || architectureCoverage.status !== coverage.status) {
        throw new Error("Screen and State Inventory scope coverage must preserve the exact current Information Architecture disposition")
      }
      if (coverage.screenKeys.some((key) => !screenByKey.get(key)?.designScopeKeys.includes(coverage.designScopeKey))) {
        throw new Error("Represented scope coverage must reference screens in the exact Information Architecture design scope")
      }
    }
  }

  private bindingMismatchCount(
    input: ScreenStateInventoryInput,
    product: Product,
    initiative: Initiative,
    architecture: InformationArchitectureModel | undefined,
  ): number {
    let mismatches = 0
    const expectedContext = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(input.context) !== canonicalDigest(expectedContext)) mismatches += 1
    if (!architecture || input.informationArchitectureModel.recordId !== architecture.id ||
        input.informationArchitectureModel.revision !== architecture.revision ||
        input.informationArchitectureModel.digest !== canonicalDigest(architecture) ||
        input.informationArchitectureModel.membershipDigest !== architecture.membershipDigest) mismatches += 1
    return mismatches
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Screen and State Inventory Source reference identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Screen and State Inventory guidance is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: ScreenStateInventory, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, screenStateInventorySchema),
        this.governed(this.historyPath(record.id, record.revision), record, screenStateInventorySchema),
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
          informationArchitectureModel: record.informationArchitectureModel,
          platformCount: record.platforms.length,
          targetedPlatformCount: record.platforms.filter((entry) => entry.supportState === "targeted").length,
          screenCount: record.screens.length,
          stateCount: record.states.length,
          variantCount: record.variants.length,
          stateKindCounts: Object.fromEntries([...new Set(record.states.map((entry) => entry.kind))].sort()
            .map((kind) => [kind, record.states.filter((entry) => entry.kind === kind).length])),
          routeCoverageStatusCounts: Object.fromEntries([...new Set(record.routeCoverage.map((entry) => entry.status))].sort()
            .map((status) => [status, record.routeCoverage.filter((entry) => entry.status === status).length])),
          scopeCoverageStatusCounts: Object.fromEntries([...new Set(record.scopeCoverage.map((entry) => entry.status))].sort()
            .map((status) => [status, record.scopeCoverage.filter((entry) => entry.status === status).length])),
          reviewState: record.reviewState,
          uiCompletenessState: record.uiCompletenessState,
          platformParityState: record.platformParityState,
          stateReachabilityState: record.stateReachabilityState,
          interactionQualityState: record.interactionQualityState,
          accessibilityValidationState: record.accessibilityValidationState,
          designApprovalState: record.designApprovalState,
          implementationAuthorityState: record.implementationAuthorityState,
          readinessAuthorityState: "not-established",
          writeAuthorityState: "not-granted",
          actionAuthorityState: "not-granted",
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("screen-state-inventories", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("screen-state-inventory-history", `screen-state-inventory-${id}-r${revision}.json`)
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
    if (names.length > inventoryLimit) throw new Error(`Screen and State Inventory directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
