import { randomUUID } from "node:crypto"

import {
  endToEndTraceabilityInputSchema,
  endToEndTraceabilityProjectionSchema,
  endToEndTraceabilitySchema,
  endToEndTraceabilityStatusSchema,
  exactSourceReferenceSchema,
  type BusinessContextBinding,
  type EndToEndTraceability,
  type EndToEndTraceabilityInput,
  type EndToEndTraceabilityProjection,
  type EndToEndTraceabilityStatus,
  type ExactEndToEndTraceabilityReference,
  type ExactSourceReference,
  type ExactTraceabilitySubjectReference,
  type Initiative,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { EvidenceRegistryService } from "./evidence-registry.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const traceabilityInventoryLimit = 10_000
const subjectIdentitySchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int().positive(),
  productId: z.string().uuid().optional(),
  initiativeId: z.string().uuid().optional(),
}).passthrough()

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: EndToEndTraceability): ExactEndToEndTraceabilityReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function exactRecordMatches(
  reference: { recordId: string; revision: number; digest: string },
  record: { id: string; revision: number },
): boolean {
  return reference.recordId === record.id && reference.revision === record.revision &&
    reference.digest === canonicalDigest(record)
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
  const references = collectExactSourceReferences(value)
  const unique = new Map(references.map((reference) => [
    `${reference.sourceId}:${reference.sourceRevision}:${reference.recordDigest}:${reference.contentDigest}`,
    reference,
  ]))
  return [...unique.values()].sort((left, right) =>
    left.sourceId.localeCompare(right.sourceId) || left.sourceRevision - right.sourceRevision)
}

function membership(input: EndToEndTraceabilityInput) {
  return {
    evidenceRegistry: input.evidenceRegistry,
    nodes: input.nodes.map((node) => ({ key: node.key, subject: node.subject, lifecycle: node.lifecycle })),
    relationships: input.relationships.map((relationship) => ({
      key: relationship.key,
      namespace: relationship.namespace,
      registryRevision: relationship.registryRevision,
      definitionDigest: relationship.definitionDigest,
      sourceKinds: relationship.sourceKinds,
      targetKinds: relationship.targetKinds,
      direction: relationship.direction,
      inverseRelationshipKey: relationship.inverseRelationshipKey,
      transitivity: relationship.transitivity,
      symmetry: relationship.symmetry,
      impactBehavior: relationship.impactBehavior,
      sourceCardinality: relationship.sourceCardinality,
      targetCardinality: relationship.targetCardinality,
      lifecycle: relationship.lifecycle,
    })),
    links: input.links.map((link) => ({
      key: link.key,
      sourceNodeKey: link.sourceNodeKey,
      targetNodeKey: link.targetNodeKey,
      relationshipKey: link.relationshipKey,
      provenance: link.provenance,
      state: link.state,
      verification: link.verification,
      effectiveFrom: link.effectiveFrom,
      expiresAt: link.expiresAt,
      invalidationConditions: link.invalidationConditions,
      supersedesLinkKeys: link.supersedesLinkKeys,
    })),
    transformations: input.transformations,
    traceSpine: input.traceSpine,
    requirementCoverage: input.requirementCoverage,
    coverageState: input.coverageState,
  }
}

export class EndToEndTraceabilityService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly evidenceRegistries: EvidenceRegistryService,
  ) {}

  async create(inputValue: EndToEndTraceabilityInput, actorId: string): Promise<EndToEndTraceability> {
    const input = endToEndTraceabilityInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindings(input, product, initiative)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current End-to-End Traceability candidate")
      }
      const now = new Date().toISOString()
      const record = endToEndTraceabilitySchema.parse({
        schemaVersion: 1,
        kind: "end-to-end-traceability-candidate",
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
          "end-to-end-traceability-is-a-candidate-graph-and-does-not-establish-relationship-truth-completeness-approval-baseline-promotion-readiness-or-action-authority",
      })
      await this.commitVersionedRecord(record, "traceability.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: EndToEndTraceabilityInput,
    actorId: string,
  ): Promise<EndToEndTraceability> {
    const input = endToEndTraceabilityInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) {
        throw new Error("End-to-End Traceability revision changed before update")
      }
      if (current.initiativeId !== input.initiativeId) {
        throw new Error("End-to-End Traceability Initiative cannot change")
      }
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindings(input, product, initiative)
      const record = endToEndTraceabilitySchema.parse({
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
      await this.commitVersionedRecord(record, "traceability.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<EndToEndTraceability> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "End-to-End Traceability ID")),
      endToEndTraceabilitySchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<EndToEndTraceability | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("end-to-end-traceability", currentRecordPattern, endToEndTraceabilitySchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) {
      throw new Error("Initiative has more than one current End-to-End Traceability candidate")
    }
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<EndToEndTraceability> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("End-to-End Traceability history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "End-to-End Traceability ID")
    const record = await this.repository.readJson(
      this.historyPath(recordId, revision),
      endToEndTraceabilitySchema,
    )
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("End-to-End Traceability history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<EndToEndTraceability[]> {
    const recordId = this.requireUuid(id, "End-to-End Traceability ID")
    const records = await this.listRecords(
      "end-to-end-traceability-history",
      new RegExp(`^end-to-end-traceability-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      endToEndTraceabilitySchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("End-to-End Traceability history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<EndToEndTraceabilityStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, traceability, evidenceRegistry, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.evidenceRegistries.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const expectedContext: BusinessContextBinding = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    let staleBindingCount = 0
    if (traceability) {
      if (canonicalDigest(traceability.context) !== canonicalDigest(expectedContext)) staleBindingCount += 1
      if (!evidenceRegistry || !exactRecordMatches(traceability.evidenceRegistry, evidenceRegistry)) {
        staleBindingCount += 1
      }
      if (traceability.membershipDigest !== canonicalDigest(membership(traceability))) staleBindingCount += 1
      for (const node of traceability.nodes) {
        if (!(await this.subjectMatches(node.subject, product, initiative))) staleBindingCount += 1
      }
    }
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(traceability).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const verifiedLinkCount = traceability?.links.filter((link) => link.state === "verified").length ?? 0
    const proposedLinkCount = traceability?.links.filter((link) => link.state === "proposed").length ?? 0
    const invalidOrHistoricalLinkCount = traceability?.links.filter((link) =>
      link.state === "invalidated" || link.state === "historical").length ?? 0
    const unresolvedEndpointCount = traceability?.links.filter((link) =>
      link.verification.endpointResolution === "unresolved").length ?? 0
    const notAssessedSemanticCount = traceability?.links.filter((link) =>
      link.verification.semanticFitness === "not-assessed").length ?? 0
    const missingSpineCount = traceability?.traceSpine.filter((entry) => entry.state === "missing").length ?? 0
    const unknownRelationshipCount = traceability?.unknownRelationships.length ?? 0
    const unresolvedRequirementCount = traceability?.requirementCoverage.filter((entry) =>
      entry.state === "unresolved").length ?? 0
    const inconsistencyCount = traceability?.inconsistencies.length ?? 0
    const unresolvedQuestionCount = traceability?.unresolvedQuestions.length ?? 0
    const reasons: string[] = []
    if (!traceability) reasons.push("No versioned End-to-End Traceability candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The traceability graph does not bind exact current Product, Initiative, Evidence Registry, membership, or governed subject records")
    if (staleSourceReferenceCount > 0) reasons.push("One or more traceability assertions reference a superseded Source revision")
    if (unresolvedEndpointCount > 0) reasons.push("One or more Trace Links have unresolved endpoints")
    if (notAssessedSemanticCount > 0) reasons.push("One or more Trace Links remain explicitly not assessed for semantic fitness")
    if (missingSpineCount > 0) reasons.push("One or more minimum trace-spine segments are missing")
    if (unknownRelationshipCount > 0) reasons.push("The traceability graph records unknown relationships")
    if (unresolvedRequirementCount > 0) reasons.push("One or more End-to-End Traceability requirements remain unresolved")
    if (inconsistencyCount > 0) reasons.push("The traceability graph records explicit inconsistencies")
    if (unresolvedQuestionCount > 0) reasons.push("The traceability graph records unresolved questions")
    return endToEndTraceabilityStatusSchema.parse({
      schemaVersion: 1,
      kind: "end-to-end-traceability-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(traceability ? { traceability: exactReference(traceability) } : {}),
      nodeCount: traceability?.nodes.length ?? 0,
      relationshipCount: traceability?.relationships.length ?? 0,
      linkCount: traceability?.links.length ?? 0,
      transformationCount: traceability?.transformations.length ?? 0,
      verifiedLinkCount,
      proposedLinkCount,
      invalidOrHistoricalLinkCount,
      unresolvedEndpointCount,
      notAssessedSemanticCount,
      missingSpineCount,
      unknownRelationshipCount,
      unresolvedRequirementCount,
      staleBindingCount,
      staleSourceReferenceCount,
      inconsistencyCount,
      unresolvedQuestionCount,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      coverageBoundary: "absence-of-a-trace-link-does-not-prove-absence-of-impact-or-relationship",
      authorityBoundary:
        "end-to-end-traceability-status-reports-candidate-coverage-and-gaps-and-does-not-establish-relationship-truth-completeness-approval-readiness-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<EndToEndTraceabilityProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, traceability] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("End-to-End Traceability projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "end-to-end-traceability-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: {
        id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative),
        state: initiative.state,
      },
      status,
      ...(traceability ? { traceability: {
        id: traceability.id,
        revision: traceability.revision,
        digest: canonicalDigest(traceability),
        membershipDigest: traceability.membershipDigest,
        state: traceability.state,
        nodeCount: traceability.nodes.length,
        relationshipCount: traceability.relationships.length,
        linkCount: traceability.links.length,
        transformationCount: traceability.transformations.length,
        updatedAt: traceability.updatedAt,
      } } : {}),
      observedAt: new Date().toISOString(),
      privacyBoundary:
        "projection-contains-identities-counts-statuses-and-digests-only-not-node-content-link-rationale-transformation-detail-source-content-personal-data-secrets-or-credentials" as const,
      authorityBoundary:
        "end-to-end-traceability-projection-does-not-establish-relationship-truth-completeness-approval-baseline-promotion-readiness-or-action-authority" as const,
    }
    return endToEndTraceabilityProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords(
      "end-to-end-traceability",
      currentRecordPattern,
      endToEndTraceabilitySchema,
    )
    for (const traceability of records) {
      try {
        if (traceability.membershipDigest !== canonicalDigest(membership(traceability))) {
          throw new Error("End-to-End Traceability membership digest is invalid")
        }
        const history = await this.listHistory(traceability.id)
        if (history.length !== traceability.revision ||
            canonicalDigest(history[0]) !== canonicalDigest(traceability)) {
          throw new Error("Current End-to-End Traceability does not match its complete immutable history")
        }
        const status = await this.assess(traceability.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "end-to-end-traceability.binding-review-required",
            severity: "warning",
            message: `Initiative ${traceability.initiativeId} has stale End-to-End Traceability bindings.`,
            record: { type: traceability.kind, id: traceability.id, revision: traceability.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "end-to-end-traceability.invalid",
          severity: "error",
          message: `End-to-End Traceability ${traceability.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: traceability.kind, id: traceability.id, revision: traceability.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private async validateBindings(
    input: EndToEndTraceabilityInput,
    product: Product,
    initiative: Initiative,
  ): Promise<void> {
    const evidenceRegistry = await this.evidenceRegistries.readCurrent(input.initiativeId)
    if (!evidenceRegistry || !exactRecordMatches(input.evidenceRegistry, evidenceRegistry)) {
      throw new Error("End-to-End Traceability must bind the exact current Evidence Registry")
    }
    for (const node of input.nodes) {
      if (!(await this.subjectMatches(node.subject, product, initiative))) {
        throw new Error("Traceability nodes must bind exact current governed records in the same Product and Initiative scope")
      }
    }
  }

  private async subjectMatches(
    reference: ExactTraceabilitySubjectReference,
    product: Product,
    initiative: Initiative,
  ): Promise<boolean> {
    try {
      if (reference.recordKind === "product") {
        return exactRecordMatches(reference, { ...product, revision: revisionOf(product) })
      }
      if (reference.recordKind === "initiative") {
        return exactRecordMatches(reference, { ...initiative, revision: revisionOf(initiative) })
      }
      const record = await this.repository.readJson(this.currentSubjectPath(reference), subjectIdentitySchema)
      return exactRecordMatches(reference, record) &&
        (record.productId === undefined || record.productId === product.id) &&
        (record.initiativeId === undefined || record.initiativeId === initiative.id)
    } catch {
      return false
    }
  }

  private currentSubjectPath(reference: ExactTraceabilitySubjectReference): string {
    const directories: Record<ExactTraceabilitySubjectReference["recordKind"], string> = {
      "architecture-challenge-model": "architecture-challenge-models",
      "architecture-record": "architecture",
      "authorization-model": "authorization-models",
      "bounded-context-model": "bounded-context-models",
      "business-architecture-baseline": "business-architecture-baselines",
      "business-capability-map": "business-capability-maps",
      "business-rule-catalog": "business-rule-catalogs",
      "business-understanding": "business-understanding",
      "change": "changes",
      "data-model": "data-models",
      "decision-record": "decisions",
      "decision-register": "decision-registers",
      "event-integration-model": "event-integration-models",
      "evidence-record": "evidence",
      "evidence-registry": "evidence-registries",
      "failure-recovery-model": "failure-recovery-models",
      "initiative": "initiatives",
      "operating-model": "operating-models",
      "outcome-model": "outcome-models",
      "process-model": "process-models",
      "product": "",
      "product-design-revision": "design-revisions",
      "requirement": "requirements",
      "risk-record": "risks",
      "risk-register": "risk-registers",
      "security-privacy-assessment": "security-privacy-assessments",
      "source-record": "sources",
      "stakeholder-model": "stakeholder-models",
      "system-solution-architecture": "system-solution-architectures",
      "value-stream-model": "value-stream-models",
      "work-item": "work-items",
    }
    const directory = directories[reference.recordKind]
    if (!directory) {
      throw new Error(`Traceability subject kind ${reference.recordKind} has no current record directory`)
    }
    return this.repository.resolve(directory, `${reference.recordId}.json`)
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) {
      throw new Error("End-to-End Traceability Initiative targets a different Product")
    }
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("End-to-End Traceability must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Traceability Source reference identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} End-to-End Traceability is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(
    record: EndToEndTraceability,
    eventType: string,
    actorId: string,
  ): Promise<void> {
    const verifiedLinkCount = record.links.filter((link) => link.state === "verified").length
    const proposedLinkCount = record.links.filter((link) => link.state === "proposed").length
    const invalidOrHistoricalLinkCount = record.links.filter((link) =>
      link.state === "invalidated" || link.state === "historical").length
    const unresolvedEndpointCount = record.links.filter((link) =>
      link.verification.endpointResolution === "unresolved").length
    const notAssessedSemanticCount = record.links.filter((link) =>
      link.verification.semanticFitness === "not-assessed").length
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, endToEndTraceabilitySchema),
        this.governed(this.historyPath(record.id, record.revision), record, endToEndTraceabilitySchema),
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
          evidenceRegistry: record.evidenceRegistry,
          state: record.state,
          nodeCount: record.nodes.length,
          relationshipCount: record.relationships.length,
          linkCount: record.links.length,
          transformationCount: record.transformations.length,
          traceSpineCount: record.traceSpine.length,
          verifiedLinkCount,
          proposedLinkCount,
          invalidOrHistoricalLinkCount,
          unresolvedEndpointCount,
          notAssessedSemanticCount,
          unknownRelationshipCount: record.unknownRelationships.length,
          unresolvedRequirementCount: record.requirementCoverage.filter((entry) => entry.state === "unresolved").length,
          relationshipTruthState: "not-established",
          completenessState: "not-established",
          approvalState: "not-established",
          baselinePromotionState: "not-granted",
          readinessState: "not-established",
          actionAuthorityState: "not-granted",
          coverageBoundary: "absence-of-a-trace-link-does-not-prove-absence-of-impact-or-relationship",
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("end-to-end-traceability", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve(
      "end-to-end-traceability-history",
      `end-to-end-traceability-${id}-r${revision}.json`,
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
      names = (await this.repository.readDirectory(this.repository.resolve(directory)))
        .filter((name) => pattern.test(name))
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return []
      throw error
    }
    if (names.length > traceabilityInventoryLimit) {
      throw new Error(`End-to-End Traceability directory ${directory} exceeds the ${traceabilityInventoryLimit}-record safety limit`)
    }
    const records = await Promise.all(names.map((name) =>
      this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      const recency = String(rightRecord.updatedAt ?? "").localeCompare(String(leftRecord.updatedAt ?? ""))
      return recency !== 0 ? recency : String(leftRecord.id ?? "").localeCompare(String(rightRecord.id ?? ""))
    })
  }
}
