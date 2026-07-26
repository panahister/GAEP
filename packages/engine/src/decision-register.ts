import { randomUUID } from "node:crypto"

import {
  decisionRegisterInputSchema,
  decisionRegisterProjectionSchema,
  decisionRegisterSchema,
  decisionRegisterStatusSchema,
  exactSourceReferenceSchema,
  type BusinessContextBinding,
  type DecisionRegister,
  type DecisionRegisterInput,
  type DecisionRegisterProjection,
  type DecisionRegisterStatus,
  type ExactDecisionRegisterReference,
  type ExactDecisionSubjectReference,
  type ExactSourceReference,
  type Initiative,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { ArchitectureChallengeModelService } from "./architecture-challenge-model.js"
import type { OperatingModelService } from "./operating-model.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const decisionRegisterInventoryLimit = 10_000
const subjectIdentitySchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int().positive(),
  productId: z.string().uuid().optional(),
  initiativeId: z.string().uuid().optional(),
}).passthrough()

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: DecisionRegister): ExactDecisionRegisterReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: DecisionRegisterInput) {
  return {
    operatingModel: input.operatingModel,
    architectureChallengeModel: input.architectureChallengeModel,
    decisions: input.decisions.map((decision) => ({
      key: decision.key,
      subjects: decision.subjects,
      relationships: decision.relationships,
      sourceReferences: uniqueExactSourceReferences(decision),
    })),
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
  const references = collectExactSourceReferences(value)
  const unique = new Map(references.map((reference) => [
    `${reference.sourceId}:${reference.sourceRevision}:${reference.recordDigest}:${reference.contentDigest}`,
    reference,
  ]))
  return [...unique.values()].sort((left, right) =>
    left.sourceId.localeCompare(right.sourceId) || left.sourceRevision - right.sourceRevision)
}

function uniqueSubjectReferences(value: DecisionRegisterInput | DecisionRegister): ExactDecisionSubjectReference[] {
  const references = value.decisions.flatMap((decision) => [...decision.subjects, ...decision.relationships])
  const unique = new Map(references.map((reference) => [
    `${reference.recordKind}:${reference.recordId}:${reference.revision}:${reference.digest}`,
    reference,
  ]))
  return [...unique.values()].sort((left, right) =>
    left.recordKind.localeCompare(right.recordKind) || left.recordId.localeCompare(right.recordId) ||
    left.revision - right.revision)
}

function exactRecordMatches(
  reference: { recordId: string; revision: number; digest: string },
  record: { id: string; revision: number },
): boolean {
  return reference.recordId === record.id && reference.revision === record.revision &&
    reference.digest === canonicalDigest(record)
}

export class DecisionRegisterService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly operatingModels: OperatingModelService,
    private readonly architectureChallengeModels: ArchitectureChallengeModelService,
  ) {}

  async create(inputValue: DecisionRegisterInput, actorId: string): Promise<DecisionRegister> {
    const input = decisionRegisterInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindingsAndTrace(input, product, initiative)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Decision Register candidate")
      }
      const now = new Date().toISOString()
      const record = decisionRegisterSchema.parse({
        schemaVersion: 1,
        kind: "decision-register-candidate",
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
          "decision-register-is-a-candidate-record-and-does-not-establish-owner-or-authority-assignments-decision-effectiveness-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority",
      })
      await this.commitVersionedRecord(record, "decision.register.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: DecisionRegisterInput,
    actorId: string,
  ): Promise<DecisionRegister> {
    const input = decisionRegisterInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Decision Register revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Decision Register Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindingsAndTrace(input, product, initiative)
      const record = decisionRegisterSchema.parse({
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
      await this.commitVersionedRecord(record, "decision.register.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<DecisionRegister> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Decision Register ID")),
      decisionRegisterSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<DecisionRegister | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("decision-registers", currentRecordPattern, decisionRegisterSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Decision Register candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<DecisionRegister> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Decision Register history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Decision Register ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), decisionRegisterSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Decision Register history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<DecisionRegister[]> {
    const recordId = this.requireUuid(id, "Decision Register ID")
    const records = await this.listRecords(
      "decision-register-history",
      new RegExp(`^decision-register-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      decisionRegisterSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Decision Register history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<DecisionRegisterStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, register, operatingModel, architectureChallengeModel, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.operatingModels.readCurrent(targetId),
      this.architectureChallengeModels.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const expectedContext: BusinessContextBinding = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    let staleBindingCount = 0
    if (register) {
      if (canonicalDigest(register.context) !== canonicalDigest(expectedContext)) staleBindingCount += 1
      if (!operatingModel || !exactRecordMatches(register.operatingModel, operatingModel)) staleBindingCount += 1
      if (!architectureChallengeModel ||
          !exactRecordMatches(register.architectureChallengeModel, architectureChallengeModel)) staleBindingCount += 1
      if (register.membershipDigest !== canonicalDigest(membership(register))) staleBindingCount += 1
      for (const reference of uniqueSubjectReferences(register)) {
        if (!(await this.subjectMatches(reference, product, initiative))) staleBindingCount += 1
      }
    }
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(register).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const unresolvedDecisionCount = register?.decisions.filter((decision) => decision.outcome.state === "unresolved").length ?? 0
    const selectedPendingDecisionCount = register?.decisions.filter((decision) =>
      ["no-action-selected", "option-selected", "option-set-rejected"].includes(decision.outcome.state) &&
      decision.outcome.effectivenessState === "pending").length ?? 0
    const deferredDecisionCount = register?.decisions.filter((decision) => decision.outcome.state === "deferred").length ?? 0
    const unresolvedRequirementCount = register?.requirementCoverage
      .filter((entry) => entry.state === "unresolved").length ?? 0
    const inconsistencyCount = register?.inconsistencies.length ?? 0
    const unresolvedQuestionCount = register?.unresolvedQuestions.length ?? 0
    const reasons: string[] = []
    if (!register) reasons.push("No versioned Decision Register candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The Decision Register does not bind exact current Product, Initiative, operating, challenge, or governed subject records")
    if (staleSourceReferenceCount > 0) reasons.push("One or more Decision claims reference a superseded Source revision")
    if (unresolvedDecisionCount > 0) reasons.push("One or more Decision Questions remain unresolved")
    if (deferredDecisionCount > 0) reasons.push("One or more Decision Questions remain explicitly deferred")
    if (unresolvedRequirementCount > 0) reasons.push("One or more Decision Register requirements remain unresolved")
    if (inconsistencyCount > 0) reasons.push("The Decision Register records explicit inconsistencies")
    if (unresolvedQuestionCount > 0) reasons.push("The Decision Register records unresolved questions")
    return decisionRegisterStatusSchema.parse({
      schemaVersion: 1,
      kind: "decision-register-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(register ? { register: exactReference(register) } : {}),
      decisionCount: register?.decisions.length ?? 0,
      unresolvedDecisionCount,
      selectedPendingDecisionCount,
      deferredDecisionCount,
      unresolvedRequirementCount,
      staleBindingCount,
      staleSourceReferenceCount,
      inconsistencyCount,
      unresolvedQuestionCount,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "decision-register-status-reports-candidate-coverage-and-gaps-and-does-not-establish-decision-effectiveness-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<DecisionRegisterProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, register] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Decision Register projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "decision-register-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: {
        id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative),
        state: initiative.state,
      },
      status,
      ...(register ? { register: {
        id: register.id,
        revision: register.revision,
        digest: canonicalDigest(register),
        membershipDigest: register.membershipDigest,
        state: register.state,
        decisionCount: register.decisions.length,
        updatedAt: register.updatedAt,
      } } : {}),
      observedAt: new Date().toISOString(),
      privacyBoundary:
        "projection-contains-identities-counts-statuses-and-digests-only-not-decision-questions-options-recommendations-outcomes-rationale-evidence-subject-content-personal-data-secrets-or-credentials" as const,
      authorityBoundary:
        "decision-register-projection-does-not-establish-decision-effectiveness-approval-risk-acceptance-baseline-promotion-readiness-or-action-authority" as const,
    }
    return decisionRegisterProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const [product, records] = await Promise.all([
      this.readProduct(),
      this.listRecords("decision-registers", currentRecordPattern, decisionRegisterSchema),
    ])
    for (const register of records) {
      try {
        const initiative = await this.readInitiative(register.initiativeId)
        this.validateContext(register.context, product, initiative)
        await this.validateSourceReferences(register, initiative.id)
        await this.validateBindingsAndTrace(register, product, initiative)
        if (register.membershipDigest !== canonicalDigest(membership(register))) {
          throw new Error("Decision Register membership digest is invalid")
        }
        const history = await this.listHistory(register.id)
        if (history.length !== register.revision || canonicalDigest(history[0]) !== canonicalDigest(register)) {
          throw new Error("Current Decision Register does not match its complete immutable history")
        }
        const status = await this.assess(register.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "decision-register.binding-review-required",
            severity: "warning",
            message: `Initiative ${register.initiativeId} has stale Decision Register bindings.`,
            record: { type: register.kind, id: register.id, revision: register.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "decision-register.invalid",
          severity: "error",
          message: `Decision Register ${register.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: register.kind, id: register.id, revision: register.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private async validateBindingsAndTrace(
    input: DecisionRegisterInput,
    product: Product,
    initiative: Initiative,
  ): Promise<void> {
    const [operatingModel, architectureChallengeModel] = await Promise.all([
      this.operatingModels.readCurrent(input.initiativeId),
      this.architectureChallengeModels.readCurrent(input.initiativeId),
    ])
    if (!operatingModel || !exactRecordMatches(input.operatingModel, operatingModel)) {
      throw new Error("Decision Register must bind the exact current Operating Model")
    }
    if (!architectureChallengeModel ||
        !exactRecordMatches(input.architectureChallengeModel, architectureChallengeModel)) {
      throw new Error("Decision Register must bind the exact current Architecture Challenge")
    }
    const roleKeys = new Set(operatingModel.roles.map((entry) => entry.key))
    const rightByKey = new Map(operatingModel.decisionRights.map((entry) => [entry.key, entry]))
    for (const decision of input.decisions) {
      const governedRoles = [decision.ownerRoleKey, ...decision.decisionAuthorityRoleKeys]
      if (governedRoles.some((key) => !roleKeys.has(key))) {
        throw new Error("Decision owner and authority roles must reference exact bound Operating Model roles")
      }
      const rights = decision.decisionRightKeys.map((key) => rightByKey.get(key))
      if (rights.some((right) => !right)) {
        throw new Error("Decision rights must reference exact bound Operating Model decision rights")
      }
      if (rights.some((right) => right && !decision.decisionAuthorityRoleKeys.includes(right.accountableRoleKey))) {
        throw new Error("Every Decision Right accountable role must be declared as a Decision authority role")
      }
    }
    for (const reference of uniqueSubjectReferences(input)) {
      if (!(await this.subjectMatches(reference, product, initiative))) {
        throw new Error("Decision subjects must bind exact current governed records in the same Product and Initiative scope")
      }
    }
  }

  private async subjectMatches(
    reference: ExactDecisionSubjectReference,
    product: Product,
    initiative: Initiative,
  ): Promise<boolean> {
    try {
      if (reference.recordKind === "product") return exactRecordMatches(reference, { ...product, revision: revisionOf(product) })
      if (reference.recordKind === "initiative") return exactRecordMatches(reference, { ...initiative, revision: revisionOf(initiative) })
      const path = this.currentSubjectPath(reference)
      const record = await this.repository.readJson(path, subjectIdentitySchema)
      return exactRecordMatches(reference, record) &&
        (record.productId === undefined || record.productId === product.id) &&
        (record.initiativeId === undefined || record.initiativeId === initiative.id)
    } catch {
      return false
    }
  }

  private currentSubjectPath(reference: ExactDecisionSubjectReference): string {
    const directories: Record<ExactDecisionSubjectReference["recordKind"], string> = {
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
      "evidence-record": "evidence",
      "event-integration-model": "event-integration-models",
      "failure-recovery-model": "failure-recovery-models",
      "initiative": "initiatives",
      "operating-model": "operating-models",
      "outcome-model": "outcome-models",
      "process-model": "process-models",
      "product": "",
      "product-design-revision": "design-revisions",
      "requirement": "requirements",
      "risk-record": "risks",
      "security-privacy-assessment": "security-privacy-assessments",
      "source-record": "sources",
      "stakeholder-model": "stakeholder-models",
      "system-solution-architecture": "system-solution-architectures",
      "value-stream-model": "value-stream-models",
      "work-item": "work-items",
    }
    const directory = directories[reference.recordKind]
    if (!directory) throw new Error(`Decision Subject kind ${reference.recordKind} has no current record directory`)
    return this.repository.resolve(directory, `${reference.recordId}.json`)
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Decision Register Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Decision Register must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Decision Register Source reference identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Decision Register is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: DecisionRegister, eventType: string, actorId: string): Promise<void> {
    const unresolvedDecisionCount = record.decisions.filter((decision) => decision.outcome.state === "unresolved").length
    const selectedPendingDecisionCount = record.decisions.filter((decision) =>
      ["no-action-selected", "option-selected", "option-set-rejected"].includes(decision.outcome.state) &&
      decision.outcome.effectivenessState === "pending").length
    const deferredDecisionCount = record.decisions.filter((decision) => decision.outcome.state === "deferred").length
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, decisionRegisterSchema),
        this.governed(this.historyPath(record.id, record.revision), record, decisionRegisterSchema),
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
          state: record.state,
          decisionCount: record.decisions.length,
          unresolvedDecisionCount,
          selectedPendingDecisionCount,
          deferredDecisionCount,
          authorityEligibilityState: "not-established",
          decisionEffectivenessState: "pending",
          approvalState: "not-established",
          riskAcceptanceState: "not-granted",
          baselinePromotionState: "not-granted",
          readinessState: "not-established",
          actionAuthorityState: "not-granted",
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("decision-registers", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("decision-register-history", `decision-register-${id}-r${revision}.json`)
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
    if (names.length > decisionRegisterInventoryLimit) {
      throw new Error(`Decision Register directory ${directory} exceeds the ${decisionRegisterInventoryLimit}-record safety limit`)
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
