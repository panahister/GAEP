import { randomUUID } from "node:crypto"

import {
  exactSourceReferenceSchema,
  figmaMcpCapabilityDiscoveryInputSchema,
  figmaMcpCapabilityDiscoveryProjectionSchema,
  figmaMcpCapabilityDiscoverySchema,
  figmaMcpCapabilityDiscoveryStatusSchema,
  type BusinessContextBinding,
  type DesignApplicability,
  type ExactSourceReference,
  type FigmaMcpCapabilityDiscovery,
  type FigmaMcpCapabilityDiscoveryInput,
  type FigmaMcpCapabilityDiscoveryProjection,
  type FigmaMcpCapabilityDiscoveryStatus,
  type Initiative,
  type ManualFigmaExecutionPath,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { DesignApplicabilityService } from "./design-applicability.js"
import type { ManualFigmaExecutionPathService } from "./manual-figma-execution-path.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
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

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: FigmaMcpCapabilityDiscovery) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: FigmaMcpCapabilityDiscoveryInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    designApplicability: input.designApplicability,
    manualFigmaExecutionPath: input.manualFigmaExecutionPath,
    adapter: input.adapter,
    observation: input.observation,
    tools: input.tools,
    catalogState: input.catalogState,
    permissionModelState: input.permissionModelState,
    limitCatalogState: input.limitCatalogState,
    versionCatalogState: input.versionCatalogState,
    ownership: input.ownership,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    figmaConnectionState: input.figmaConnectionState,
    figmaRequestState: input.figmaRequestState,
    credentialState: input.credentialState,
    permissionGrantState: input.permissionGrantState,
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
  manualFigmaExecutionPath: ManualFigmaExecutionPath
}

export class FigmaMcpCapabilityDiscoveryService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly designApplicability: DesignApplicabilityService,
    private readonly manualFigmaExecutionPath: ManualFigmaExecutionPathService,
  ) {}

  async create(inputValue: FigmaMcpCapabilityDiscoveryInput, actorId: string): Promise<FigmaMcpCapabilityDiscovery> {
    const input = figmaMcpCapabilityDiscoveryInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const bindings = await this.requireCurrentBindings(input)
      this.validateObservation(input, bindings.designApplicability)
      await this.validateSourceReferences(input, initiative.id)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Figma MCP Capability Discovery candidate")
      }
      const now = new Date().toISOString()
      const record = figmaMcpCapabilityDiscoverySchema.parse({
        schemaVersion: 1,
        kind: "figma-mcp-capability-discovery-candidate",
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
          "figma-mcp-capability-discovery-is-source-backed-candidate-observation-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-establish-tool-availability-or-compatibility-authorize-write-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
      })
      await this.commitVersionedRecord(record, "figma-mcp-capability-discovery.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: FigmaMcpCapabilityDiscoveryInput,
    actorId: string,
  ): Promise<FigmaMcpCapabilityDiscovery> {
    const input = figmaMcpCapabilityDiscoveryInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Figma MCP Capability Discovery revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Figma MCP Capability Discovery Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const bindings = await this.requireCurrentBindings(input)
      this.validateObservation(input, bindings.designApplicability)
      await this.validateSourceReferences(input, initiative.id)
      const record = figmaMcpCapabilityDiscoverySchema.parse({
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
      await this.commitVersionedRecord(record, "figma-mcp-capability-discovery.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<FigmaMcpCapabilityDiscovery> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Figma MCP Capability Discovery ID")),
      figmaMcpCapabilityDiscoverySchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<FigmaMcpCapabilityDiscovery | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords(
      "figma-mcp-capability-discoveries",
      currentRecordPattern,
      figmaMcpCapabilityDiscoverySchema,
    )
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Figma MCP Capability Discovery candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<FigmaMcpCapabilityDiscovery> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Figma MCP Capability Discovery history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Figma MCP Capability Discovery ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), figmaMcpCapabilityDiscoverySchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Figma MCP Capability Discovery history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<FigmaMcpCapabilityDiscovery[]> {
    const recordId = this.requireUuid(id, "Figma MCP Capability Discovery ID")
    const records = await this.listRecords(
      "figma-mcp-capability-discovery-history",
      new RegExp(`^figma-mcp-capability-discovery-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      figmaMcpCapabilityDiscoverySchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Figma MCP Capability Discovery history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<FigmaMcpCapabilityDiscoveryStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, designApplicability, manualFigmaExecutionPath, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.designApplicability.readCurrent(targetId),
      this.manualFigmaExecutionPath.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    let staleBindingCount = candidate ? this.bindingMismatchCount(candidate, product, initiative, {
      designApplicability,
      manualFigmaExecutionPath,
    }) : 0
    if (candidate && staleBindingCount === 0 && designApplicability) {
      try {
        this.validateObservation(candidate, designApplicability)
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
    const tools = candidate?.tools ?? []
    const advertisedToolCount = tools.filter((entry) => entry.availabilityState === "advertised").length
    const unavailableToolCount = tools.filter((entry) => entry.availabilityState === "not-advertised").length
    const unknownAvailabilityCount = tools.filter((entry) => entry.availabilityState === "unknown").length
    const readToolCount = tools.filter((entry) => entry.effectClass === "figma-read").length
    const writeToolCount = tools.filter((entry) => entry.effectClass === "figma-write").length
    const unknownEffectCount = tools.filter((entry) => entry.effectClass === "unknown").length
    const notAssessedToolCount = tools.filter((entry) => entry.evidenceState === "not-assessed").length
    const sourceRecordedToolCount = tools.filter((entry) => entry.evidenceState === "source-recorded").length
    const humanReviewedToolCount = tools.filter((entry) => entry.evidenceState === "human-reviewed").length
    const unresolvedPermissionCount = tools.flatMap((entry) => entry.permissions).filter((entry) =>
      entry.accessClass === "unknown" || entry.requirementState === "unknown").length
    const unresolvedLimitCount = tools.flatMap((entry) => entry.limits).filter((entry) => entry.state === "unknown").length
    const unresolvedVersionCount = (candidate?.adapter.adapterVersionState === "unknown" ? 1 : 0) +
      (candidate?.adapter.protocolVersionState === "unknown" ? 1 : 0) +
      tools.filter((entry) => entry.versionState === "unknown").length
    const unresolvedOwnershipCount = candidate?.ownership.state === "unresolved" ? 1 : 0
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const catalogState = candidate?.catalogState ?? "not-assessed"
    const permissionModelState = candidate?.permissionModelState ?? "not-assessed"
    const limitCatalogState = candidate?.limitCatalogState ?? "not-assessed"
    const versionCatalogState = candidate?.versionCatalogState ?? "not-assessed"
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Figma MCP Capability Discovery candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind exact current Product, Initiative, Design Applicability, or Manual Figma Execution Path records")
    if (staleSourceReferenceCount > 0) reasons.push("One or more capability observations reference a superseded Source revision")
    if (tools.length === 0) reasons.push("No bounded Figma MCP tool observations are recorded")
    if (unknownAvailabilityCount > 0) reasons.push("One or more tool observations retain unknown advertised availability")
    if (unknownEffectCount > 0) reasons.push("One or more tool observations retain an unknown effect class")
    if (notAssessedToolCount > 0) reasons.push("One or more tool observations have not been assessed")
    if (sourceRecordedToolCount > 0) reasons.push("One or more tool observations are source-recorded but not attributable human-reviewed")
    if (unresolvedPermissionCount > 0) reasons.push("One or more advertised permission requirements remain unresolved")
    if (unresolvedLimitCount > 0) reasons.push("One or more advertised capability limits remain unresolved")
    if (unresolvedVersionCount > 0) reasons.push("One or more adapter, protocol, or tool versions remain unresolved")
    if (unresolvedOwnershipCount > 0) reasons.push("Figma MCP capability observation ownership remains unresolved")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved Figma MCP capability questions")
    if (candidate && catalogState !== "candidate-observation-complete") reasons.push("The observed tool catalog is not marked candidate-complete")
    if (candidate && permissionModelState !== "candidate-separated") reasons.push("Read and write permission requirements are not recorded as candidate-separated")
    if (candidate && limitCatalogState !== "candidate-complete") reasons.push("The observed limit catalog is not marked candidate-complete")
    if (candidate && versionCatalogState !== "candidate-complete") reasons.push("The observed version catalog is not marked candidate-complete")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return figmaMcpCapabilityDiscoveryStatusSchema.parse({
      schemaVersion: 1,
      kind: "figma-mcp-capability-discovery-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      toolCount: tools.length,
      advertisedToolCount,
      unavailableToolCount,
      unknownAvailabilityCount,
      readToolCount,
      writeToolCount,
      unknownEffectCount,
      notAssessedToolCount,
      sourceRecordedToolCount,
      humanReviewedToolCount,
      unresolvedPermissionCount,
      unresolvedLimitCount,
      unresolvedVersionCount,
      unresolvedOwnershipCount,
      staleBindingCount,
      staleSourceReferenceCount,
      unresolvedQuestionCount,
      catalogState,
      permissionModelState,
      limitCatalogState,
      versionCatalogState,
      reviewState,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "figma-mcp-capability-discovery-status-is-observational-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-establish-tool-availability-or-compatibility-authorize-write-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<FigmaMcpCapabilityDiscoveryProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Figma MCP Capability Discovery projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "figma-mcp-capability-discovery-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        state: candidate.state,
        toolCount: candidate.tools.length,
        advertisedToolCount: candidate.tools.filter((entry) => entry.availabilityState === "advertised").length,
        readToolCount: candidate.tools.filter((entry) => entry.effectClass === "figma-read").length,
        writeToolCount: candidate.tools.filter((entry) => entry.effectClass === "figma-write").length,
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-tool-names-schemas-permissions-limits-versions-source-content-personal-content-secrets-credentials-or-figma-content" as const,
      authorityBoundary:
        "figma-mcp-capability-discovery-projection-is-read-only-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-establish-tool-availability-or-compatibility-authorize-write-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority" as const,
    }
    return figmaMcpCapabilityDiscoveryProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords(
      "figma-mcp-capability-discoveries",
      currentRecordPattern,
      figmaMcpCapabilityDiscoverySchema,
    )
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) {
          throw new Error("Figma MCP Capability Discovery membership digest is invalid")
        }
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Figma MCP Capability Discovery candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "figma-mcp-capability-discovery.binding-review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale Figma MCP Capability Discovery bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "figma-mcp-capability-discovery.invalid",
          severity: "error",
          message: `Figma MCP Capability Discovery ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Figma MCP Capability Discovery Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Figma MCP Capability Discovery candidate must bind exact current Product and Initiative revisions and digests")
    }
  }

  private async requireCurrentBindings(input: FigmaMcpCapabilityDiscoveryInput): Promise<CurrentBindings> {
    const [designApplicability, manualFigmaExecutionPath] = await Promise.all([
      this.designApplicability.readCurrent(input.initiativeId),
      this.manualFigmaExecutionPath.readCurrent(input.initiativeId),
    ])
    if (!designApplicability) throw new Error("Figma MCP Capability Discovery requires current Design Applicability")
    if (!manualFigmaExecutionPath) throw new Error("Figma MCP Capability Discovery requires current Manual Figma Execution Path")
    const bindings = { designApplicability, manualFigmaExecutionPath }
    for (const key of Object.keys(bindings) as (keyof CurrentBindings)[]) {
      const candidate = bindings[key]
      const reference = input[key]
      if (reference.recordId !== candidate.id || reference.revision !== candidate.revision ||
          reference.digest !== canonicalDigest(candidate) || reference.membershipDigest !== candidate.membershipDigest) {
        throw new Error(`Figma MCP Capability Discovery must bind exact current ${key} and membership`)
      }
    }
    return bindings
  }

  private validateObservation(input: FigmaMcpCapabilityDiscoveryInput, designApplicability: DesignApplicability): void {
    const hasMaterialFigmaScope = designApplicability.scopes.some((scope) => {
      const decision = scope.decisions.find((entry) => entry.aspect === "figma")
      return decision && materialApplicability.has(decision.status) &&
        scope.designSource.modes.some((mode) => mode === "figma-design" || mode === "figma-make")
    })
    if (!hasMaterialFigmaScope) {
      throw new Error("Figma MCP Capability Discovery requires exact current material Figma applicability and an explicit Figma source mode")
    }
    if (input.permissionModelState === "candidate-separated") {
      for (const tool of input.tools) {
        if (tool.effectClass === "figma-read" && tool.permissions.some((entry) => entry.accessClass === "write")) {
          throw new Error("Candidate-separated read tools cannot declare write permission requirements")
        }
        if (tool.effectClass === "figma-write" && !tool.permissions.some((entry) => entry.accessClass === "write")) {
          throw new Error("Candidate-separated write tools require an explicit ungranted write permission requirement")
        }
      }
    }
    if (input.catalogState === "candidate-observation-complete" &&
        input.observation.catalogDigest !== canonicalDigest(input.tools.map((tool) => ({
          key: tool.key,
          toolName: tool.toolName,
          capabilityClass: tool.capabilityClass,
          effectClass: tool.effectClass,
          availabilityState: tool.availabilityState,
          versionState: tool.versionState,
          version: tool.version,
          schemaDigest: tool.schemaDigest,
          permissions: tool.permissions,
          limits: tool.limits,
        })))) {
      throw new Error("Candidate-complete Figma MCP discovery catalog digest must bind the exact observed tool inventory")
    }
  }

  private bindingMismatchCount(
    input: FigmaMcpCapabilityDiscoveryInput,
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
        throw new Error("Figma MCP Capability Discovery Source identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Figma MCP Capability Discovery is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: FigmaMcpCapabilityDiscovery, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, figmaMcpCapabilityDiscoverySchema),
        this.governed(this.historyPath(record.id, record.revision), record, figmaMcpCapabilityDiscoverySchema),
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
          manualFigmaExecutionPath: record.manualFigmaExecutionPath,
          adapterKey: record.adapter.key,
          adapterKind: record.adapter.kind,
          transportClass: record.adapter.transportClass,
          installationState: record.adapter.installationState,
          discoveryInterfaceState: record.adapter.discoveryInterfaceState,
          adapterVersionState: record.adapter.adapterVersionState,
          protocolVersionState: record.adapter.protocolVersionState,
          observationState: record.observation.state,
          observationCatalogDigest: record.observation.catalogDigest,
          toolCount: record.tools.length,
          toolCatalogDigest: canonicalDigest(record.tools.map((entry) => ({
            key: entry.key,
            capabilityClass: entry.capabilityClass,
            effectClass: entry.effectClass,
            availabilityState: entry.availabilityState,
            versionState: entry.versionState,
            schemaDigest: entry.schemaDigest,
            permissionCatalogDigest: canonicalDigest(entry.permissions),
            limitCatalogDigest: canonicalDigest(entry.limits),
            evidenceState: entry.evidenceState,
            evidenceDigests: entry.evidenceDigests,
          }))),
          catalogState: record.catalogState,
          permissionModelState: record.permissionModelState,
          limitCatalogState: record.limitCatalogState,
          versionCatalogState: record.versionCatalogState,
          ownershipState: record.ownership.state,
          reviewState: record.reviewState,
          figmaConnectionState: record.figmaConnectionState,
          figmaRequestState: record.figmaRequestState,
          credentialState: record.credentialState,
          permissionGrantState: record.permissionGrantState,
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
    return this.repository.resolve("figma-mcp-capability-discoveries", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve(
      "figma-mcp-capability-discovery-history",
      `figma-mcp-capability-discovery-${id}-r${revision}.json`,
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
    if (names.length > inventoryLimit) throw new Error(`Figma MCP Capability Discovery directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
