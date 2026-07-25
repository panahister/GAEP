import { randomUUID } from "node:crypto"

import {
  exactDomainRecordReferenceSchema,
  sourceBaselineInputSchema,
  sourceBaselineSchema,
  sourceGovernanceAssessmentSchema,
  sourceProvenanceInputSchema,
  sourceProvenanceSchema,
  sourceRecordInputSchema,
  sourceRecordRevisionSchema,
  sourceRecordSchema,
  type ExactDomainRecordReference,
  type ExactSourceReference,
  type Initiative,
  type Product,
  type SourceBaseline,
  type SourceBaselineInput,
  type SourceGovernanceAssessment,
  type SourceProvenance,
  type SourceProvenanceInput,
  type SourceRecord,
  type SourceRecordInput,
  type SourceRecordRevision,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type ExactDomainResolver = (reference: ExactDomainRecordReference) => Promise<unknown>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const sourceInventoryLimit = 10_000

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function targetDigest(target: SourceProvenance["target"]): string {
  if (target.kind === "governed-record") return target.reference.digest
  return target.digest
}

export class SourceGovernanceService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly resolveExactDomainRecord: ExactDomainResolver,
  ) {}

  async createSource(inputValue: SourceRecordInput, actorId: string): Promise<SourceRecord> {
    const input = sourceRecordInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      if (input.semanticAuthority.declaredBy.id !== actorId) {
        throw new Error("Source semantic-authority declaration must match the local mutation actor")
      }
      const now = new Date().toISOString()
      const record = sourceRecordSchema.parse({
        schemaVersion: 1,
        kind: "source-record",
        id: randomUUID(),
        productId: product.id,
        revision: 1,
        ...input,
        initiativeId: initiative.id,
        recordedBy: { kind: "human", id: actorId },
        createdAt: now,
        updatedAt: now,
        authorityBoundary:
          "source-semantic-authority-is-an-attributed-input-claim-and-does-not-grant-decision-approval-authorization-or-action-authority",
      })
      const history = this.sourceHistory(record)
      await this.repository.commitMutation({
        writes: [
          this.governed(this.sourcePath(record.id), record, sourceRecordSchema),
          this.governed(this.sourceHistoryPath(record.id, record.revision), history, sourceRecordRevisionSchema),
        ],
        audit: {
          eventType: "source.recorded",
          actor: { kind: "human", id: actorId },
          subjectId: record.id,
          payload: {
            initiativeId: initiative.id,
            revision: record.revision,
            recordDigest: history.recordDigest,
            contentDigest: record.contentDigest,
            semanticAuthorityStanding: record.semanticAuthority.standing,
            authorityBoundary: record.authorityBoundary,
          },
        },
      })
      return record
    })
  }

  async reviseSource(
    id: string,
    expectedRevision: number,
    inputValue: SourceRecordInput,
    actorId: string,
  ): Promise<SourceRecord> {
    const sourceId = this.requireUuid(id, "Source ID")
    const input = sourceRecordInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.readSource(sourceId)
      if (current.revision !== expectedRevision) {
        throw new Error("Source changed before revision; reload the exact current revision")
      }
      if (input.initiativeId !== current.initiativeId) {
        throw new Error("A Source revision cannot change its Initiative identity")
      }
      await this.requireMutableInitiative(current.initiativeId)
      if (input.semanticAuthority.declaredBy.id !== actorId) {
        throw new Error("Source semantic-authority declaration must match the local mutation actor")
      }
      if (canonicalDigest(input) === canonicalDigest(this.sourceInput(current))) {
        throw new Error("Source revision must contain a material change")
      }
      const now = new Date().toISOString()
      const updated = sourceRecordSchema.parse({
        ...current,
        ...input,
        revision: current.revision + 1,
        recordedBy: { kind: "human", id: actorId },
        updatedAt: now,
      })
      const history = this.sourceHistory(updated, canonicalDigest(current))
      await this.repository.commitMutation({
        writes: [
          this.governed(this.sourcePath(updated.id), updated, sourceRecordSchema),
          this.governed(this.sourceHistoryPath(updated.id, updated.revision), history, sourceRecordRevisionSchema),
        ],
        audit: {
          eventType: "source.revised",
          actor: { kind: "human", id: actorId },
          subjectId: updated.id,
          payload: {
            initiativeId: updated.initiativeId,
            revision: updated.revision,
            predecessorDigest: history.predecessorDigest,
            recordDigest: history.recordDigest,
            contentDigest: updated.contentDigest,
            semanticAuthorityStanding: updated.semanticAuthority.standing,
            authorityBoundary: updated.authorityBoundary,
          },
        },
      })
      return updated
    })
  }

  async readSource(id: string): Promise<SourceRecord> {
    return this.repository.readJson(this.sourcePath(this.requireUuid(id, "Source ID")), sourceRecordSchema)
  }

  async listSources(initiativeId?: string): Promise<SourceRecord[]> {
    const records = await this.listRecords("sources", currentRecordPattern, sourceRecordSchema)
    if (!initiativeId) return records
    const target = this.requireUuid(initiativeId, "Initiative ID")
    return records.filter((record) => record.initiativeId === target)
  }

  async readSourceRevision(id: string, revision: number): Promise<SourceRecordRevision> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Source history revision must be a positive integer")
    }
    const sourceId = this.requireUuid(id, "Source ID")
    const history = await this.repository.readJson(
      this.sourceHistoryPath(sourceId, revision),
      sourceRecordRevisionSchema,
    )
    if (history.sourceId !== sourceId || history.revision !== revision) {
      throw new Error("Source history identity or revision does not match")
    }
    this.verifySourceHistory(history)
    return history
  }

  async listSourceHistory(id: string): Promise<SourceRecordRevision[]> {
    const sourceId = this.requireUuid(id, "Source ID")
    const escaped = sourceId.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
    const records = await this.listRecords(
      "source-history",
      new RegExp(`^source-${escaped}-r[1-9][0-9]*\\.json$`, "iu"),
      sourceRecordRevisionSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, history] of ascending.entries()) {
      this.verifySourceHistory(history)
      if (
        history.sourceId !== sourceId ||
        history.revision !== index + 1 ||
        (index > 0 && history.predecessorDigest !== ascending[index - 1]?.recordDigest)
      ) throw new Error("Source history is incomplete or has an invalid predecessor chain")
    }
    return ascending.reverse()
  }

  async createBaseline(inputValue: SourceBaselineInput, actorId: string): Promise<SourceBaseline> {
    const input = sourceBaselineInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      await this.validateSourceMembers(input.members, initiative.id)
      const now = new Date().toISOString()
      const baseline = sourceBaselineSchema.parse({
        schemaVersion: 1,
        kind: "source-baseline-snapshot",
        id: randomUUID(),
        productId: product.id,
        revision: 1,
        ...input,
        initiativeId: initiative.id,
        membershipDigest: canonicalDigest(input.members),
        state: "candidate",
        createdBy: { kind: "human", id: actorId },
        createdAt: now,
        updatedAt: now,
        authorityBoundary:
          "source-baseline-snapshot-is-a-versioned-candidate-and-does-not-approve-designate-authorize-or-supersede",
      })
      await this.commitBaseline(baseline, "source.baseline.created", actorId)
      return baseline
    })
  }

  async reviseBaseline(
    id: string,
    expectedRevision: number,
    inputValue: SourceBaselineInput,
    actorId: string,
  ): Promise<SourceBaseline> {
    const baselineId = this.requireUuid(id, "Source Baseline ID")
    const input = sourceBaselineInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.readBaseline(baselineId)
      if (current.revision !== expectedRevision) {
        throw new Error("Source Baseline changed before revision; reload the exact current revision")
      }
      if (input.initiativeId !== current.initiativeId) {
        throw new Error("A Source Baseline revision cannot change its Initiative identity")
      }
      const { initiative } = await this.requireMutableInitiative(current.initiativeId)
      await this.validateSourceMembers(input.members, initiative.id)
      if (canonicalDigest(input) === canonicalDigest(this.baselineInput(current))) {
        throw new Error("Source Baseline revision must contain a material change")
      }
      const updated = sourceBaselineSchema.parse({
        ...current,
        ...input,
        revision: current.revision + 1,
        membershipDigest: canonicalDigest(input.members),
        predecessorDigest: canonicalDigest(current),
        createdBy: { kind: "human", id: actorId },
        updatedAt: new Date().toISOString(),
      })
      await this.commitBaseline(updated, "source.baseline.revised", actorId)
      return updated
    })
  }

  async readBaseline(id: string): Promise<SourceBaseline> {
    const baseline = await this.repository.readJson(
      this.baselinePath(this.requireUuid(id, "Source Baseline ID")),
      sourceBaselineSchema,
    )
    this.verifyBaseline(baseline)
    return baseline
  }

  async listBaselines(initiativeId?: string): Promise<SourceBaseline[]> {
    const records = await this.listRecords("source-baselines", currentRecordPattern, sourceBaselineSchema)
    for (const baseline of records) this.verifyBaseline(baseline)
    if (!initiativeId) return records
    const target = this.requireUuid(initiativeId, "Initiative ID")
    return records.filter((record) => record.initiativeId === target)
  }

  async readBaselineRevision(id: string, revision: number): Promise<SourceBaseline> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Source Baseline history revision must be a positive integer")
    }
    const baselineId = this.requireUuid(id, "Source Baseline ID")
    const baseline = await this.repository.readJson(
      this.baselineHistoryPath(baselineId, revision),
      sourceBaselineSchema,
    )
    if (baseline.id !== baselineId || baseline.revision !== revision) {
      throw new Error("Source Baseline history identity or revision does not match")
    }
    this.verifyBaseline(baseline)
    return baseline
  }

  async listBaselineHistory(id: string): Promise<SourceBaseline[]> {
    const baselineId = this.requireUuid(id, "Source Baseline ID")
    const escaped = baselineId.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
    const records = await this.listRecords(
      "source-baseline-history",
      new RegExp(`^baseline-${escaped}-r[1-9][0-9]*\\.json$`, "iu"),
      sourceBaselineSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, baseline] of ascending.entries()) {
      this.verifyBaseline(baseline)
      if (
        baseline.id !== baselineId ||
        baseline.revision !== index + 1 ||
        (index === 0 && baseline.predecessorDigest !== undefined) ||
        (index > 0 && baseline.predecessorDigest !== canonicalDigest(ascending[index - 1]))
      ) throw new Error("Source Baseline history is incomplete or has an invalid predecessor chain")
    }
    return ascending.reverse()
  }

  async recordProvenance(inputValue: SourceProvenanceInput, actorId: string): Promise<SourceProvenance> {
    const input = sourceProvenanceInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      await this.validateSourceMembers(input.sources.map((source) => source.reference), initiative.id)
      if (input.target.kind === "governed-record") {
        const resolved = await this.resolveExactDomainRecord(input.target.reference)
        const candidate = resolved as { productId?: string }
        if (candidate.productId !== undefined && candidate.productId !== product.id) {
          throw new Error("Provenance target belongs to a different Product")
        }
      }
      if (input.generation.kind === "run") {
        await this.resolveExactDomainRecord(exactDomainRecordReferenceSchema.parse(input.generation.run))
      }
      this.validateTransformationGraph(input)
      if (input.amendment) {
        const amended = await this.readProvenance(input.amendment.recordId)
        if (amended.initiativeId !== initiative.id || canonicalDigest(amended) !== input.amendment.recordDigest) {
          throw new Error("Provenance amendment does not bind the exact prior record")
        }
      }
      const record = sourceProvenanceSchema.parse({
        schemaVersion: 1,
        kind: "source-provenance-record",
        id: randomUUID(),
        productId: product.id,
        ...input,
        initiativeId: initiative.id,
        recordedBy: { kind: "human", id: actorId },
        recordedAt: new Date().toISOString(),
        authorityBoundary:
          "provenance-establishes-attributed-lineage-and-does-not-approve-validate-authorize-or-transfer-source-authority",
      })
      const recordDigest = canonicalDigest(record)
      await this.repository.commitMutation({
        writes: [this.governed(this.provenancePath(record.id), record, sourceProvenanceSchema)],
        audit: {
          eventType: "source.provenance.recorded",
          actor: { kind: "human", id: actorId },
          subjectId: record.id,
          payload: {
            initiativeId: record.initiativeId,
            targetDigest: targetDigest(record.target),
            sourceCount: record.sources.length,
            disposition: record.disposition,
            recordDigest,
            amendmentRecordId: record.amendment?.recordId,
            authorityBoundary: record.authorityBoundary,
          },
        },
      })
      return record
    })
  }

  async readProvenance(id: string): Promise<SourceProvenance> {
    return this.repository.readJson(
      this.provenancePath(this.requireUuid(id, "Source Provenance ID")),
      sourceProvenanceSchema,
    )
  }

  async listProvenance(initiativeId?: string): Promise<SourceProvenance[]> {
    const records = await this.listRecords("source-provenance", currentRecordPattern, sourceProvenanceSchema)
    if (!initiativeId) return records
    const target = this.requireUuid(initiativeId, "Initiative ID")
    return records.filter((record) => record.initiativeId === target)
  }

  async assess(initiativeId: string): Promise<SourceGovernanceAssessment> {
    const initiative = await this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))
    const product = await this.readProduct()
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const [sources, baselines, provenance] = await Promise.all([
      this.listSources(initiative.id),
      this.listBaselines(initiative.id),
      this.listProvenance(initiative.id),
    ])
    const currentBaseline = baselines[0]
    const currentSourceById = new Map(sources.map((source) => [source.id, source]))
    let baselineStatus: "current" | "stale" | "incomplete" | undefined
    const baselineMemberIds = new Set<string>()
    if (currentBaseline) {
      let stale = false
      for (const member of currentBaseline.members) {
        baselineMemberIds.add(member.sourceId)
        const source = currentSourceById.get(member.sourceId)
        if (
          !source ||
          source.revision !== member.sourceRevision ||
          canonicalDigest(source) !== member.recordDigest ||
          source.contentDigest !== member.contentDigest
        ) stale = true
      }
      baselineStatus = stale
        ? "stale"
        : sources.some((source) => !baselineMemberIds.has(source.id))
          ? "incomplete"
          : "current"
    }
    const exactProvenanced = new Set(provenance.flatMap((record) => record.sources.map((source) => {
      const reference = source.reference
      const current = currentSourceById.get(reference.sourceId)
      return current &&
        current.revision === reference.sourceRevision &&
        canonicalDigest(current) === reference.recordDigest &&
        current.contentDigest === reference.contentDigest
        ? current.id
        : undefined
    })).filter((id): id is string => id !== undefined))
    const staleSourceCount = sources.filter((source) =>
      ["potentially-stale", "stale"].includes(source.freshness.status)).length
    const unknownAuthorityCount = sources.filter((source) =>
      source.semanticAuthority.standing === "unknown").length
    const unbaselinedSourceCount = sources.filter((source) => !baselineMemberIds.has(source.id)).length
    const unprovenancedSourceCount = sources.filter((source) => !exactProvenanced.has(source.id)).length
    const reasons: string[] = []
    if (sources.length === 0) reasons.push("No governed source records are available for this Initiative")
    if (!currentBaseline) reasons.push("No versioned candidate source baseline snapshot is available")
    if (baselineStatus === "stale") reasons.push("The latest source baseline does not bind the exact current Source revisions")
    if (baselineStatus === "incomplete") reasons.push("The latest source baseline does not include every current Source")
    if (staleSourceCount > 0) reasons.push("One or more Sources require freshness review")
    if (unknownAuthorityCount > 0) reasons.push("One or more Sources have unknown semantic-authority standing")
    if (unbaselinedSourceCount > 0) reasons.push("One or more current Sources are not present in the latest candidate baseline")
    if (unprovenancedSourceCount > 0) reasons.push("One or more current Sources are not used by exact provenance")
    return sourceGovernanceAssessmentSchema.parse({
      schemaVersion: 1,
      kind: "source-governance-assessment",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      sourceCount: sources.length,
      baselineCount: baselines.length,
      provenanceCount: provenance.length,
      ...(currentBaseline ? {
        currentBaseline: {
          id: currentBaseline.id,
          revision: currentBaseline.revision,
          digest: canonicalDigest(currentBaseline),
          membershipDigest: currentBaseline.membershipDigest,
          status: baselineStatus!,
          memberCount: currentBaseline.members.length,
        },
      } : {}),
      staleSourceCount,
      unknownAuthorityCount,
      unbaselinedSourceCount,
      unprovenancedSourceCount,
      state: reasons.length === 0 ? "ready" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "source-governance-assessment-reports-recorded-evidence-and-does-not-designate-a-baseline-approve-readiness-or-authorize-action",
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const product = await this.readProduct()
    const sources = await this.listSources()
    const currentSourceById = new Map(sources.map((source) => [source.id, source]))
    for (const source of sources) {
      try {
        const initiative = await this.readInitiative(source.initiativeId)
        if (source.productId !== product.id || initiative.productId !== product.id) {
          throw new Error("Source Product or Initiative binding does not target the current Product")
        }
        const history = await this.listSourceHistory(source.id)
        if (history.length !== source.revision || history[0]?.recordDigest !== canonicalDigest(source)) {
          throw new Error("current Source does not match its complete immutable history")
        }
      } catch (error) {
        issues.push({
          code: "source.history-invalid",
          severity: "error",
          message: `Source ${source.id}: ${error instanceof Error ? error.message : "immutable history is invalid"}`,
          record: { type: "source-record", id: source.id, revision: source.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
      if (
        ["potentially-stale", "stale"].includes(source.freshness.status) ||
        (source.freshness.validUntil !== undefined && Date.parse(source.freshness.validUntil) <= Date.now())
      ) {
        issues.push({
          code: "source.freshness-review-required",
          severity: "warning",
          message: `Source ${source.id} requires an explicit freshness review.`,
          record: { type: "source-record", id: source.id, revision: source.revision },
          repairActions: ["inspect-read-only", "create-superseding-revision"],
        })
      }
      if (["unavailable", "moved", "deleted"].includes(source.availability.status)) {
        issues.push({
          code: "source.availability-review-required",
          severity: "warning",
          message: `Source ${source.id} availability is ${source.availability.status}.`,
          record: { type: "source-record", id: source.id, revision: source.revision },
          repairActions: ["inspect-read-only", "create-superseding-revision"],
        })
      }
    }

    for (const baseline of await this.listBaselines()) {
      try {
        const history = await this.listBaselineHistory(baseline.id)
        if (history.length !== baseline.revision || canonicalDigest(history[0]) !== canonicalDigest(baseline)) {
          throw new Error("current candidate Baseline does not match its complete immutable history")
        }
        await this.validateSourceMembers(baseline.members, baseline.initiativeId)
      } catch (error) {
        issues.push({
          code: "source.baseline-invalid",
          severity: "error",
          message: `Source Baseline ${baseline.id}: ${error instanceof Error ? error.message : "candidate Baseline is invalid"}`,
          record: { type: "source-baseline-snapshot", id: baseline.id, revision: baseline.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
        continue
      }
      if (baseline.members.some((member) => {
        const current = currentSourceById.get(member.sourceId)
        return !current ||
          current.revision !== member.sourceRevision ||
          canonicalDigest(current) !== member.recordDigest ||
          current.contentDigest !== member.contentDigest
      })) {
        issues.push({
          code: "source.baseline-stale",
          severity: "warning",
          message: `Source Baseline ${baseline.id} does not bind every exact current Source revision.`,
          record: { type: "source-baseline-snapshot", id: baseline.id, revision: baseline.revision },
          repairActions: ["inspect-read-only", "create-superseding-revision"],
        })
      }
    }

    for (const provenance of await this.listProvenance()) {
      try {
        await this.validateSourceMembers(
          provenance.sources.map((source) => source.reference),
          provenance.initiativeId,
        )
        if (provenance.target.kind === "governed-record") {
          const target = await this.resolveExactDomainRecord(provenance.target.reference)
          const candidate = target as { productId?: string }
          if (candidate.productId !== undefined && candidate.productId !== product.id) {
            throw new Error("Provenance target belongs to a different Product")
          }
        }
        if (provenance.generation.kind === "run") {
          await this.resolveExactDomainRecord(provenance.generation.run)
        }
        this.validateTransformationGraph(provenance)
        if (provenance.amendment) {
          const amended = await this.readProvenance(provenance.amendment.recordId)
          if (
            amended.initiativeId !== provenance.initiativeId ||
            canonicalDigest(amended) !== provenance.amendment.recordDigest
          ) throw new Error("Provenance amendment does not bind the exact prior record")
        }
      } catch (error) {
        issues.push({
          code: "source.provenance-invalid",
          severity: "error",
          message: `Source Provenance ${provenance.id}: ${error instanceof Error ? error.message : "lineage is invalid"}`,
          record: { type: "source-provenance-record", id: provenance.id },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
        continue
      }
      if (provenance.sources.some(({ reference }) => {
        const current = currentSourceById.get(reference.sourceId)
        return !current ||
          current.revision !== reference.sourceRevision ||
          canonicalDigest(current) !== reference.recordDigest ||
          current.contentDigest !== reference.contentDigest
      })) {
        issues.push({
          code: "source.provenance-stale",
          severity: "warning",
          message: `Source Provenance ${provenance.id} references a superseded Source revision.`,
          record: { type: "source-provenance-record", id: provenance.id },
          repairActions: ["inspect-read-only"],
        })
      }
    }
    return issues
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(),
      this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} source governance is immutable`)
    }
    return { product, initiative }
  }

  private async validateSourceMembers(
    members: readonly ExactSourceReference[],
    initiativeId: string,
  ): Promise<void> {
    for (const member of members) {
      const history = await this.readSourceRevision(member.sourceId, member.sourceRevision)
      if (
        history.snapshot.initiativeId !== initiativeId ||
        history.recordDigest !== member.recordDigest ||
        history.snapshot.contentDigest !== member.contentDigest
      ) throw new Error("Exact Source reference identity, Initiative, revision, record digest, or content digest does not match")
    }
  }

  private validateTransformationGraph(input: SourceProvenanceInput): void {
    const available = new Set(input.sources.map((source) => source.reference.contentDigest))
    const outputs = new Set<string>()
    for (const transformation of input.transformations) {
      if (transformation.inputDigests.some((digest) => !available.has(digest))) {
        throw new Error("Provenance transformation input does not resolve to an exact Source or prior transformation")
      }
      if (outputs.has(transformation.outputDigest)) {
        throw new Error("Provenance transformation outputs must be unique")
      }
      outputs.add(transformation.outputDigest)
      available.add(transformation.outputDigest)
    }
    if (!available.has(targetDigest(input.target))) {
      throw new Error("Provenance target digest is not produced by an exact Source or declared transformation")
    }
  }

  private async commitBaseline(
    baseline: SourceBaseline,
    eventType: "source.baseline.created" | "source.baseline.revised",
    actorId: string,
  ): Promise<void> {
    this.verifyBaseline(baseline)
    await this.repository.commitMutation({
      writes: [
        this.governed(this.baselinePath(baseline.id), baseline, sourceBaselineSchema),
        this.governed(
          this.baselineHistoryPath(baseline.id, baseline.revision),
          baseline,
          sourceBaselineSchema,
        ),
      ],
      audit: {
        eventType,
        actor: { kind: "human", id: actorId },
        subjectId: baseline.id,
        payload: {
          initiativeId: baseline.initiativeId,
          revision: baseline.revision,
          recordDigest: canonicalDigest(baseline),
          predecessorDigest: baseline.predecessorDigest,
          membershipDigest: baseline.membershipDigest,
          memberCount: baseline.members.length,
          state: baseline.state,
          authorityBoundary: baseline.authorityBoundary,
        },
      },
    })
  }

  private sourceHistory(record: SourceRecord, predecessorDigest?: string): SourceRecordRevision {
    return sourceRecordRevisionSchema.parse({
      schemaVersion: 1,
      kind: "source-record-revision",
      productId: record.productId,
      sourceId: record.id,
      revision: record.revision,
      recordDigest: canonicalDigest(record),
      predecessorDigest,
      snapshot: record,
      recordedAt: record.updatedAt,
    })
  }

  private verifySourceHistory(history: SourceRecordRevision): void {
    if (history.recordDigest !== canonicalDigest(history.snapshot)) {
      throw new Error("Source history record digest does not match its immutable snapshot")
    }
  }

  private verifyBaseline(baseline: SourceBaseline): void {
    if (baseline.membershipDigest !== canonicalDigest(baseline.members)) {
      throw new Error("Source Baseline membership digest does not match its exact members")
    }
  }

  private sourceInput(record: SourceRecord): SourceRecordInput {
    const {
      schemaVersion: _schemaVersion,
      kind: _kind,
      id: _id,
      productId: _productId,
      revision: _revision,
      recordedBy: _recordedBy,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      authorityBoundary: _authorityBoundary,
      ...input
    } = record
    return sourceRecordInputSchema.parse(input)
  }

  private baselineInput(record: SourceBaseline): SourceBaselineInput {
    const {
      schemaVersion: _schemaVersion,
      kind: _kind,
      id: _id,
      productId: _productId,
      revision: _revision,
      membershipDigest: _membershipDigest,
      predecessorDigest: _predecessorDigest,
      state: _state,
      createdBy: _createdBy,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      authorityBoundary: _authorityBoundary,
      ...input
    } = record
    return sourceBaselineInputSchema.parse(input)
  }

  private sourcePath(id: string): string {
    return this.repository.resolve("sources", `${id}.json`)
  }

  private sourceHistoryPath(id: string, revision: number): string {
    return this.repository.resolve("source-history", `source-${id}-r${revision}.json`)
  }

  private baselinePath(id: string): string {
    return this.repository.resolve("source-baselines", `${id}.json`)
  }

  private baselineHistoryPath(id: string, revision: number): string {
    return this.repository.resolve("source-baseline-history", `baseline-${id}-r${revision}.json`)
  }

  private provenancePath(id: string): string {
    return this.repository.resolve("source-provenance", `${id}.json`)
  }

  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> {
    return { path, value, schema, governed: true }
  }

  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try {
      names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name))
    } catch (error) {
      if (this.isMissing(error)) return []
      throw error
    }
    if (names.length > sourceInventoryLimit) {
      throw new Error(`Source-governance directory ${directory} exceeds the ${sourceInventoryLimit}-record safety limit`)
    }
    const records = await Promise.all(names.map((name) =>
      this.repository.readJson(this.repository.resolve(directory, name), schema),
    ))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      return String(rightRecord.updatedAt ?? rightRecord.recordedAt ?? "")
        .localeCompare(String(leftRecord.updatedAt ?? leftRecord.recordedAt ?? ""))
    })
  }

  private async assertIntegrity(): Promise<void> {
    const audit = await this.repository.verifyAudit()
    if (!audit.valid) throw new Error(`GAEP workspace integrity is invalid: ${audit.error ?? "unknown error"}`)
  }

  private requireUuid(value: string, label: string): string {
    const result = uuidSchema.safeParse(value)
    if (!result.success) throw new Error(`${label} must be a UUID`)
    return result.data
  }

  private isMissing(error: unknown): boolean {
    return error instanceof Error && "code" in error && error.code === "ENOENT"
  }
}
