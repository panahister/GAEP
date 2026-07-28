import { randomUUID } from "node:crypto"

import {
  exactSourceReferenceSchema,
  figmaReadSnapshotInputSchema,
  figmaReadSnapshotProjectionSchema,
  figmaReadSnapshotSchema,
  figmaReadSnapshotStatusSchema,
  type BusinessContextBinding,
  type DesignApplicability,
  type DesignSystemTokenContract,
  type ExactSourceReference,
  type FigmaMcpCapabilityDiscovery,
  type FigmaReadSnapshot,
  type FigmaReadSnapshotInput,
  type FigmaReadSnapshotProjection,
  type FigmaReadSnapshotStatus,
  type Initiative,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { DesignApplicabilityService } from "./design-applicability.js"
import type { DesignSystemTokenContractService } from "./design-system-token-contract.js"
import type { FigmaMcpCapabilityDiscoveryService } from "./figma-mcp-capability-discovery.js"
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
const allowedReadCapabilities = new Set(["read-content", "read-metadata", "read-variables"])

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: FigmaReadSnapshot) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: FigmaReadSnapshotInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    designApplicability: input.designApplicability,
    designSystemTokenContract: input.designSystemTokenContract,
    figmaMcpCapabilityDiscovery: input.figmaMcpCapabilityDiscovery,
    capture: input.capture,
    files: input.files,
    components: input.components,
    variableCollections: input.variableCollections,
    variables: input.variables,
    snapshotCompletenessState: input.snapshotCompletenessState,
    provenanceState: input.provenanceState,
    ownership: input.ownership,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    figmaConnectionAuthorityState: input.figmaConnectionAuthorityState,
    credentialAuthorityState: input.credentialAuthorityState,
    permissionGrantState: input.permissionGrantState,
    figmaWriteAuthorityState: input.figmaWriteAuthorityState,
    externalCompletenessState: input.externalCompletenessState,
    designValidityState: input.designValidityState,
    designApprovalState: input.designApprovalState,
    designBaselineState: input.designBaselineState,
    readinessState: input.readinessState,
    implementationAuthorityState: input.implementationAuthorityState,
  }
}

function snapshotPayload(input: FigmaReadSnapshotInput) {
  return {
    files: input.files,
    components: input.components,
    variableCollections: input.variableCollections,
    variables: input.variables,
  }
}

function captureReceipt(input: FigmaReadSnapshotInput) {
  return {
    mode: input.capture.mode,
    requestedToolKeys: input.capture.requestedToolKeys,
    readEffectState: input.capture.readEffectState,
    payloadDigest: input.capture.payloadDigest,
    capturedAt: input.capture.capturedAt,
    evidence: input.capture.evidence,
    sources: input.capture.sources,
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
  designSystemTokenContract: DesignSystemTokenContract
  figmaMcpCapabilityDiscovery: FigmaMcpCapabilityDiscovery
}

export class FigmaReadSnapshotService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly designApplicability: DesignApplicabilityService,
    private readonly designSystemTokenContract: DesignSystemTokenContractService,
    private readonly figmaMcpCapabilityDiscovery: FigmaMcpCapabilityDiscoveryService,
  ) {}

  async create(inputValue: FigmaReadSnapshotInput, actorId: string): Promise<FigmaReadSnapshot> {
    const input = figmaReadSnapshotInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const bindings = await this.requireCurrentBindings(input)
      this.validateSnapshot(input, bindings)
      await this.validateSourceReferences(input, initiative.id)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Figma Read Snapshot candidate")
      }
      const now = new Date().toISOString()
      const record = figmaReadSnapshotSchema.parse({
        schemaVersion: 1,
        kind: "figma-read-snapshot-candidate",
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
          "figma-read-snapshot-is-source-backed-read-only-candidate-evidence-and-does-not-itself-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-authorize-write-validate-or-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
      })
      await this.commitVersionedRecord(record, "figma-read-snapshot.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: FigmaReadSnapshotInput,
    actorId: string,
  ): Promise<FigmaReadSnapshot> {
    const input = figmaReadSnapshotInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Figma Read Snapshot revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Figma Read Snapshot Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const bindings = await this.requireCurrentBindings(input)
      this.validateSnapshot(input, bindings)
      await this.validateSourceReferences(input, initiative.id)
      const record = figmaReadSnapshotSchema.parse({
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
      await this.commitVersionedRecord(record, "figma-read-snapshot.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<FigmaReadSnapshot> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Figma Read Snapshot ID")),
      figmaReadSnapshotSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<FigmaReadSnapshot | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("figma-read-snapshots", currentRecordPattern, figmaReadSnapshotSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Figma Read Snapshot candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<FigmaReadSnapshot> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Figma Read Snapshot history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Figma Read Snapshot ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), figmaReadSnapshotSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Figma Read Snapshot history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<FigmaReadSnapshot[]> {
    const recordId = this.requireUuid(id, "Figma Read Snapshot ID")
    const records = await this.listRecords(
      "figma-read-snapshot-history",
      new RegExp(`^figma-read-snapshot-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      figmaReadSnapshotSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Figma Read Snapshot history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<FigmaReadSnapshotStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, designApplicability, designSystemTokenContract, figmaMcpCapabilityDiscovery, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.designApplicability.readCurrent(targetId),
      this.designSystemTokenContract.readCurrent(targetId),
      this.figmaMcpCapabilityDiscovery.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    let staleBindingCount = candidate ? this.bindingMismatchCount(candidate, product, initiative, {
      designApplicability,
      designSystemTokenContract,
      figmaMcpCapabilityDiscovery,
    }) : 0
    if (candidate && staleBindingCount === 0 && designApplicability && designSystemTokenContract && figmaMcpCapabilityDiscovery) {
      try {
        this.validateSnapshot(candidate, { designApplicability, designSystemTokenContract, figmaMcpCapabilityDiscovery })
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
    const files = candidate?.files ?? []
    const components = candidate?.components ?? []
    const variableCollections = candidate?.variableCollections ?? []
    const variables = candidate?.variables ?? []
    const itemEvidenceStates = [
      ...files.map((entry) => entry.provenance.evidence.state),
      ...components.map((entry) => entry.evidenceState),
      ...variableCollections.map((entry) => entry.evidenceState),
      ...variables.map((entry) => entry.evidenceState),
    ]
    const sourceRecordedItemCount = itemEvidenceStates.filter((state) => state === "source-recorded").length
    const humanReviewedItemCount = itemEvidenceStates.filter((state) => state === "human-reviewed").length
    const notAssessedItemCount = itemEvidenceStates.filter((state) => state === "not-assessed").length
    const staleFileCount = files.filter((entry) => entry.freshnessState === "stale-at-capture").length
    const unknownFreshnessFileCount = files.filter((entry) => entry.freshnessState === "unknown").length
    const unresolvedTypeCount = variables.filter((entry) => entry.resolvedType === "unknown").length
    const unresolvedOwnershipCount = candidate?.ownership.state === "unresolved" ? 1 : 0
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const snapshotCompletenessState = candidate?.snapshotCompletenessState ?? "not-assessed"
    const provenanceState = candidate?.provenanceState ?? "not-assessed"
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Figma Read Snapshot candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind exact current Product, Initiative, Design Applicability, Design System and Token Contract, or Figma MCP Capability Discovery records")
    if (staleSourceReferenceCount > 0) reasons.push("One or more snapshot observations reference a superseded Source revision")
    if (files.length === 0) reasons.push("No bounded Figma file observations are recorded")
    if (components.length === 0) reasons.push("No bounded Figma component observations are recorded")
    if (variableCollections.length === 0) reasons.push("No bounded Figma variable collection observations are recorded")
    if (variables.length === 0) reasons.push("No bounded Figma variable observations are recorded")
    if (sourceRecordedItemCount > 0) reasons.push("One or more snapshot items are source-recorded but not attributable human-reviewed")
    if (notAssessedItemCount > 0) reasons.push("One or more snapshot items have not been assessed")
    if (staleFileCount > 0) reasons.push("One or more Figma files were already stale at capture")
    if (unknownFreshnessFileCount > 0) reasons.push("One or more Figma file freshness states are unknown")
    if (unresolvedTypeCount > 0) reasons.push("One or more Figma variable types remain unresolved")
    if (unresolvedOwnershipCount > 0) reasons.push("Figma Read Snapshot ownership remains unresolved")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved Figma snapshot questions")
    if (candidate && snapshotCompletenessState !== "candidate-observation-complete") reasons.push("The observed Figma snapshot catalog is not marked candidate-complete")
    if (candidate && provenanceState !== "exact") reasons.push("The observed Figma snapshot provenance is not exact")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return figmaReadSnapshotStatusSchema.parse({
      schemaVersion: 1,
      kind: "figma-read-snapshot-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      fileCount: files.length,
      componentCount: components.length,
      variableCollectionCount: variableCollections.length,
      variableCount: variables.length,
      sourceRecordedItemCount,
      humanReviewedItemCount,
      notAssessedItemCount,
      staleFileCount,
      unknownFreshnessFileCount,
      unresolvedTypeCount,
      unresolvedOwnershipCount,
      staleBindingCount,
      staleSourceReferenceCount,
      unresolvedQuestionCount,
      snapshotCompletenessState,
      provenanceState,
      reviewState,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "figma-read-snapshot-status-is-observational-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-authorize-write-validate-or-approve-design-establish-a-baseline-readiness-implementation-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<FigmaReadSnapshotProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Figma Read Snapshot projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "figma-read-snapshot-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        state: candidate.state,
        fileCount: candidate.files.length,
        componentCount: candidate.components.length,
        variableCollectionCount: candidate.variableCollections.length,
        variableCount: candidate.variables.length,
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-figma-file-component-variable-names-external-identities-values-source-content-personal-content-secrets-credentials-or-permissions" as const,
      authorityBoundary:
        "figma-read-snapshot-projection-is-read-only-and-does-not-connect-to-or-call-figma-request-credentials-grant-permissions-prove-external-completeness-authorize-write-validate-or-approve-design-establish-a-baseline-readiness-implementation-write-or-action-authority" as const,
    }
    return figmaReadSnapshotProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("figma-read-snapshots", currentRecordPattern, figmaReadSnapshotSchema)
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) {
          throw new Error("Figma Read Snapshot membership digest is invalid")
        }
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Figma Read Snapshot candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "figma-read-snapshot.binding-review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale Figma Read Snapshot bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "figma-read-snapshot.invalid",
          severity: "error",
          message: `Figma Read Snapshot ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Figma Read Snapshot Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Figma Read Snapshot candidate must bind exact current Product and Initiative revisions and digests")
    }
  }

  private async requireCurrentBindings(input: FigmaReadSnapshotInput): Promise<CurrentBindings> {
    const [designApplicability, designSystemTokenContract, figmaMcpCapabilityDiscovery] = await Promise.all([
      this.designApplicability.readCurrent(input.initiativeId),
      this.designSystemTokenContract.readCurrent(input.initiativeId),
      this.figmaMcpCapabilityDiscovery.readCurrent(input.initiativeId),
    ])
    if (!designApplicability) throw new Error("Figma Read Snapshot requires current Design Applicability")
    if (!designSystemTokenContract) throw new Error("Figma Read Snapshot requires current Design System and Token Contract")
    if (!figmaMcpCapabilityDiscovery) throw new Error("Figma Read Snapshot requires current Figma MCP Capability Discovery")
    const bindings = { designApplicability, designSystemTokenContract, figmaMcpCapabilityDiscovery }
    for (const key of Object.keys(bindings) as (keyof CurrentBindings)[]) {
      const candidate = bindings[key]
      const reference = input[key]
      if (reference.recordId !== candidate.id || reference.revision !== candidate.revision ||
          reference.digest !== canonicalDigest(candidate) || reference.membershipDigest !== candidate.membershipDigest) {
        throw new Error(`Figma Read Snapshot must bind exact current ${key} and membership`)
      }
    }
    return bindings
  }

  private validateSnapshot(input: FigmaReadSnapshotInput, bindings: CurrentBindings): void {
    const hasMaterialFigmaScope = bindings.designApplicability.scopes.some((scope) => {
      const decision = scope.decisions.find((entry) => entry.aspect === "figma")
      return decision && materialApplicability.has(decision.status) &&
        scope.designSource.modes.some((mode) => mode === "figma-design" || mode === "figma-make")
    })
    if (!hasMaterialFigmaScope) {
      throw new Error("Figma Read Snapshot requires exact current material Figma applicability and an explicit Figma source mode")
    }
    if (input.capture.payloadDigest !== canonicalDigest(snapshotPayload(input))) {
      throw new Error("Figma Read Snapshot payload digest must bind the exact file, component, collection, and variable catalogs")
    }
    if (input.capture.receiptDigest !== canonicalDigest(captureReceipt(input))) {
      throw new Error("Figma Read Snapshot receipt digest must bind the exact read-only capture receipt")
    }
    if (input.capture.mode !== "figma-mcp-read-receipt" && input.capture.requestedToolKeys.length > 0) {
      throw new Error("Only a Figma MCP read receipt may bind observed tool keys")
    }
    if (input.capture.mode === "figma-mcp-read-receipt") {
      const tools = new Map(bindings.figmaMcpCapabilityDiscovery.tools.map((tool) => [tool.key, tool]))
      const observedCapabilities = new Set<string>()
      for (const key of input.capture.requestedToolKeys) {
        const tool = tools.get(key)
        if (!tool || tool.availabilityState !== "advertised" || tool.effectClass !== "figma-read" ||
            !allowedReadCapabilities.has(tool.capabilityClass) || tool.permissions.some((permission) => permission.accessClass === "write")) {
          throw new Error("Figma Read Snapshot MCP receipts may bind only exact advertised read tools without write permission requirements")
        }
        observedCapabilities.add(tool.capabilityClass)
      }
      const requiredCapabilities = new Set(["read-metadata"])
      if (input.components.length > 0) requiredCapabilities.add("read-content")
      if (input.variableCollections.length > 0 || input.variables.length > 0) requiredCapabilities.add("read-variables")
      if ([...requiredCapabilities].some((capability) => !observedCapabilities.has(capability))) {
        throw new Error("Figma Read Snapshot MCP receipts must cover exact advertised metadata, content, and variable read capabilities used by the captured catalogs")
      }
    }
    const fileByKey = new Map(input.files.map((file) => [file.key, file]))
    for (const item of [...input.components, ...input.variableCollections, ...input.variables]) {
      const file = fileByKey.get(item.fileKey)
      if (!file || item.provenance.externalVersion !== file.provenance.externalVersion ||
          item.provenance.observedAt !== file.provenance.observedAt) {
        throw new Error("Figma Read Snapshot child observations must bind the exact parent file version and observation time")
      }
    }
  }

  private bindingMismatchCount(
    input: FigmaReadSnapshotInput,
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
        throw new Error("Figma Read Snapshot Source identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Figma Read Snapshot is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: FigmaReadSnapshot, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, figmaReadSnapshotSchema),
        this.governed(this.historyPath(record.id, record.revision), record, figmaReadSnapshotSchema),
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
          designSystemTokenContract: record.designSystemTokenContract,
          figmaMcpCapabilityDiscovery: record.figmaMcpCapabilityDiscovery,
          captureMode: record.capture.mode,
          requestedToolKeys: record.capture.requestedToolKeys,
          readEffectState: record.capture.readEffectState,
          receiptDigest: record.capture.receiptDigest,
          payloadDigest: record.capture.payloadDigest,
          captureEvidenceState: record.capture.evidence.state,
          fileCount: record.files.length,
          fileCatalogDigest: canonicalDigest(record.files.map((entry) => ({
            key: entry.key,
            contentDigest: entry.provenance.contentDigest,
            freshnessState: entry.freshnessState,
            evidenceState: entry.provenance.evidence.state,
          }))),
          componentCount: record.components.length,
          componentCatalogDigest: canonicalDigest(record.components.map((entry) => ({
            key: entry.key, fileKey: entry.fileKey, contentDigest: entry.provenance.contentDigest, evidenceState: entry.evidenceState,
          }))),
          variableCollectionCount: record.variableCollections.length,
          variableCollectionCatalogDigest: canonicalDigest(record.variableCollections.map((entry) => ({
            key: entry.key, fileKey: entry.fileKey, contentDigest: entry.provenance.contentDigest, evidenceState: entry.evidenceState,
          }))),
          variableCount: record.variables.length,
          variableCatalogDigest: canonicalDigest(record.variables.map((entry) => ({
            key: entry.key, fileKey: entry.fileKey, collectionKey: entry.collectionKey,
            contentDigest: entry.provenance.contentDigest, evidenceState: entry.evidenceState,
          }))),
          snapshotCompletenessState: record.snapshotCompletenessState,
          provenanceState: record.provenanceState,
          ownershipState: record.ownership.state,
          reviewState: record.reviewState,
          figmaConnectionAuthorityState: record.figmaConnectionAuthorityState,
          credentialAuthorityState: record.credentialAuthorityState,
          permissionGrantState: record.permissionGrantState,
          figmaWriteAuthorityState: record.figmaWriteAuthorityState,
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
    return this.repository.resolve("figma-read-snapshots", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("figma-read-snapshot-history", `figma-read-snapshot-${id}-r${revision}.json`)
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
    if (names.length > inventoryLimit) throw new Error(`Figma Read Snapshot directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
