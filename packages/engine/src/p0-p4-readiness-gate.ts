import { randomUUID } from "node:crypto"

import {
  decisionRegisterSchema,
  exactSourceReferenceSchema,
  p0P4ReadinessGateInputSchema,
  p0P4ReadinessGateProjectionSchema,
  p0P4ReadinessGateSchema,
  p0P4ReadinessGateStatusSchema,
  riskRegisterSchema,
  type BusinessContextBinding,
  type ExactSourceReference,
  type Initiative,
  type P0P4ReadinessGate,
  type P0P4ReadinessGateInput,
  type P0P4ReadinessGateProjection,
  type P0P4ReadinessGateStatus,
  type Product,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { EndToEndTraceabilityService } from "./end-to-end-traceability.js"
import type { EvidenceRegistryService } from "./evidence-registry.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type ReadinessSubject = P0P4ReadinessGateInput["outputs"][number]["subjects"][number]

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const readinessInventoryLimit = 10_000
const subjectIdentitySchema = z.object({
  kind: z.string().min(2),
  id: z.string().uuid(),
  revision: z.number().int().positive().optional(),
  productId: z.string().uuid().optional(),
  initiativeId: z.string().uuid().optional(),
}).passthrough()

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: P0P4ReadinessGate) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function exactRecordMatches(
  reference: { recordId: string; revision: number; digest: string },
  record: { id: string; revision?: number },
): boolean {
  return reference.recordId === record.id && reference.revision === revisionOf(record) &&
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
  const unique = new Map(collectExactSourceReferences(value).map((reference) => [
    `${reference.sourceId}:${reference.sourceRevision}:${reference.recordDigest}:${reference.contentDigest}`,
    reference,
  ]))
  return [...unique.values()].sort((left, right) =>
    left.sourceId.localeCompare(right.sourceId) || left.sourceRevision - right.sourceRevision)
}

function membership(input: P0P4ReadinessGateInput) {
  return {
    evaluationDefinition: input.evaluationDefinition,
    evidenceRegistry: input.evidenceRegistry,
    traceability: input.traceability,
    outputs: input.outputs,
    waivers: input.waivers,
    unresolvedDecisions: input.unresolvedDecisions,
    conditions: input.conditions,
    requirementCoverage: input.requirementCoverage,
    readinessAuthorityState: input.readinessAuthorityState,
  }
}

export class P0P4ReadinessGateService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly evidenceRegistries: EvidenceRegistryService,
    private readonly traceabilityGraphs: EndToEndTraceabilityService,
  ) {}

  async create(inputValue: P0P4ReadinessGateInput, actorId: string): Promise<P0P4ReadinessGate> {
    const input = p0P4ReadinessGateInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindings(input, product, initiative)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current P0-P4 Readiness Gate candidate")
      }
      const now = new Date().toISOString()
      const record = p0P4ReadinessGateSchema.parse({
        schemaVersion: 1,
        kind: "p0-p4-readiness-gate-candidate",
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
          "p0-p4-readiness-gate-is-a-candidate-evaluation-and-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority",
      })
      await this.commitVersionedRecord(record, "readiness-gate.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: P0P4ReadinessGateInput,
    actorId: string,
  ): Promise<P0P4ReadinessGate> {
    const input = p0P4ReadinessGateInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("P0-P4 Readiness Gate revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("P0-P4 Readiness Gate Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      await this.validateSourceReferences(input, initiative.id)
      await this.validateBindings(input, product, initiative)
      const record = p0P4ReadinessGateSchema.parse({
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
      await this.commitVersionedRecord(record, "readiness-gate.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<P0P4ReadinessGate> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "P0-P4 Readiness Gate ID")), p0P4ReadinessGateSchema)
  }

  async readCurrent(initiativeId: string): Promise<P0P4ReadinessGate | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("p0-p4-readiness-gates", currentRecordPattern, p0P4ReadinessGateSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current P0-P4 Readiness Gate candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<P0P4ReadinessGate> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("P0-P4 Readiness Gate history revision must be a positive integer")
    const recordId = this.requireUuid(id, "P0-P4 Readiness Gate ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), p0P4ReadinessGateSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("P0-P4 Readiness Gate history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<P0P4ReadinessGate[]> {
    const recordId = this.requireUuid(id, "P0-P4 Readiness Gate ID")
    const records = await this.listRecords(
      "p0-p4-readiness-gate-history",
      new RegExp(`^p0-p4-readiness-gate-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      p0P4ReadinessGateSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("P0-P4 Readiness Gate history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<P0P4ReadinessGateStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, gate, evidenceRegistry, traceability, evidenceStatus] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.evidenceRegistries.readCurrent(targetId),
      this.traceabilityGraphs.readCurrent(targetId),
      this.evidenceRegistries.assess(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const expectedContext: BusinessContextBinding = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    let staleBindingCount = 0
    if (gate) {
      if (canonicalDigest(gate.context) !== canonicalDigest(expectedContext)) staleBindingCount += 1
      if (!evidenceRegistry || !exactRecordMatches(gate.evidenceRegistry, evidenceRegistry)) staleBindingCount += 1
      if (!traceability || !exactRecordMatches(gate.traceability, traceability)) staleBindingCount += 1
      if (gate.membershipDigest !== canonicalDigest(membership(gate))) staleBindingCount += 1
      for (const output of gate.outputs) {
        for (const subject of output.subjects) {
          if (!(await this.subjectMatches(subject, product, initiative))) staleBindingCount += 1
        }
      }
      for (const waiver of gate.waivers) {
        if (!(await this.referenceMatches(waiver.decision.register, product, initiative)) ||
            !(await this.referenceMatches(waiver.risk.register, product, initiative))) staleBindingCount += 1
      }
      for (const decision of gate.unresolvedDecisions) {
        if (!(await this.referenceMatches(decision.decisionRegister, product, initiative))) staleBindingCount += 1
      }
      for (const condition of gate.conditions) {
        if (!(await this.referenceMatches(condition.sourceReference, product, initiative))) staleBindingCount += 1
      }
    }
    const currentSources = await this.sourceGovernance.listSources(targetId)
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(gate).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const outputs = gate?.outputs ?? []
    const countState = (state: P0P4ReadinessGateInput["outputs"][number]["evaluationState"]) =>
      outputs.filter((entry) => entry.evaluationState === state).length
    const applicableOutputCount = outputs.filter((entry) => entry.applicability === "applicable").length
    const notApplicableOutputCount = outputs.filter((entry) => entry.applicability === "not-applicable-candidate").length
    const unresolvedApplicabilityCount = outputs.filter((entry) => entry.applicability === "unresolved").length
    const satisfiedOutputCount = countState("satisfied")
    const conditionalOutputCount = countState("conditionally-satisfied")
    const incompleteOutputCount = countState("incomplete") + countState("not-assessed")
    const failedOutputCount = countState("failed")
    const blockedOutputCount = countState("blocked")
    const staleOrUnknownOutputCount = outputs.filter((entry) =>
      entry.applicability === "applicable" && entry.freshness !== "current").length
    const pendingOrInvalidWaiverCount = gate?.waivers.filter((waiver) => waiver.state !== "granted").length ?? 0
    const unresolvedDecisionCount = gate?.unresolvedDecisions.length ?? 0
    const blockingDecisionCount = gate?.unresolvedDecisions.filter((decision) => decision.blocking).length ?? 0
    const unmetConditionCount = gate?.conditions.filter((condition) => condition.state !== "satisfied").length ?? 0
    const violatedConditionCount = gate?.conditions.filter((condition) =>
      condition.state === "overdue" || condition.state === "violated").length ?? 0
    const unresolvedRequirementCount = gate?.requirementCoverage.filter((entry) => entry.state === "unresolved").length ?? 0
    const adverseEvidenceCount = evidenceStatus.adverseEvidencePendingDispositionCount +
      evidenceStatus.invalidatedEvidenceCount + evidenceStatus.staleOrUnknownEvidenceCount
    const inconsistencyCount = gate?.inconsistencies.length ?? 0
    const unresolvedQuestionCount = gate?.unresolvedQuestions.length ?? 0
    const reasons: string[] = []
    if (!gate) reasons.push("No versioned P0-P4 Readiness Gate candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The readiness evaluation does not bind exact current governed records")
    if (staleSourceReferenceCount > 0) reasons.push("One or more readiness assertions reference a superseded Source revision")
    if (unresolvedApplicabilityCount > 0) reasons.push("One or more canonical outputs have unresolved applicability")
    if (incompleteOutputCount > 0) reasons.push("One or more applicable outputs remain incomplete or not assessed")
    if (failedOutputCount > 0) reasons.push("One or more applicable output evaluations failed")
    if (blockedOutputCount > 0) reasons.push("One or more applicable output evaluations are blocked")
    if (staleOrUnknownOutputCount > 0) reasons.push("One or more applicable outputs have stale or unknown freshness")
    if (pendingOrInvalidWaiverCount > 0) reasons.push("One or more waiver claims are pending, denied, expired, revoked, or unverifiable")
    if (unresolvedDecisionCount > 0) reasons.push("One or more decisions remain explicitly unresolved or deferred")
    if (unmetConditionCount > 0) reasons.push("One or more readiness conditions remain unmet")
    if (unresolvedRequirementCount > 0) reasons.push("One or more P0-P4 Readiness Gate requirements remain unresolved")
    if (adverseEvidenceCount > 0) reasons.push("The exact Evidence Registry contains adverse, invalidated, stale, or unknown evidence")
    if (inconsistencyCount > 0) reasons.push("The readiness candidate records explicit inconsistencies")
    if (unresolvedQuestionCount > 0) reasons.push("The readiness candidate records unresolved questions")
    let result: P0P4ReadinessGateStatus["result"] = "not-assessed"
    if (gate) {
      if (blockedOutputCount > 0 || blockingDecisionCount > 0 || violatedConditionCount > 0) result = "blocked"
      else if (failedOutputCount > 0 || adverseEvidenceCount > 0) result = "failed"
      else if (unresolvedApplicabilityCount + incompleteOutputCount + staleOrUnknownOutputCount +
        pendingOrInvalidWaiverCount + unresolvedDecisionCount + unresolvedRequirementCount + staleBindingCount +
        staleSourceReferenceCount + inconsistencyCount + unresolvedQuestionCount > 0) result = "incomplete"
      else if (conditionalOutputCount > 0) result = "conditionally-passed"
      else result = "passed"
    }
    return p0P4ReadinessGateStatusSchema.parse({
      schemaVersion: 1,
      kind: "p0-p4-readiness-gate-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(gate ? { gate: exactReference(gate) } : {}),
      outputCount: outputs.length,
      applicableOutputCount,
      notApplicableOutputCount,
      unresolvedApplicabilityCount,
      satisfiedOutputCount,
      conditionalOutputCount,
      incompleteOutputCount,
      failedOutputCount,
      blockedOutputCount,
      staleOrUnknownOutputCount,
      pendingOrInvalidWaiverCount,
      unresolvedDecisionCount,
      unmetConditionCount,
      unresolvedRequirementCount,
      adverseEvidenceCount,
      staleBindingCount,
      staleSourceReferenceCount,
      inconsistencyCount,
      unresolvedQuestionCount,
      result,
      reasons,
      assessedAt: new Date().toISOString(),
      gateBoundary: "a-passing-gate-is-an-evaluation-result-not-permission",
      authorityBoundary:
        "p0-p4-readiness-gate-status-is-an-evaluation-result-and-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority",
    })
  }

  async project(initiativeId: string): Promise<P0P4ReadinessGateProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, gate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("P0-P4 Readiness Gate projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "p0-p4-readiness-gate-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: {
        id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state,
      },
      status,
      ...(gate ? { gate: {
        id: gate.id,
        revision: gate.revision,
        digest: canonicalDigest(gate),
        membershipDigest: gate.membershipDigest,
        state: gate.state,
        evaluationDefinitionDigest: gate.evaluationDefinition.digest,
        outputCount: gate.outputs.length,
        waiverCount: gate.waivers.length,
        unresolvedDecisionCount: gate.unresolvedDecisions.length,
        conditionCount: gate.conditions.length,
        updatedAt: gate.updatedAt,
      } } : {}),
      observedAt: new Date().toISOString(),
      privacyBoundary:
        "projection-contains-identities-counts-results-and-digests-only-not-output-content-criteria-findings-waiver-rationale-decision-content-evidence-content-source-content-personal-data-secrets-or-credentials" as const,
      authorityBoundary:
        "p0-p4-readiness-gate-projection-does-not-establish-readiness-approval-waiver-acceptance-phase-entry-implementation-authorization-baseline-promotion-or-action-authority" as const,
    }
    return p0P4ReadinessGateProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("p0-p4-readiness-gates", currentRecordPattern, p0P4ReadinessGateSchema)
    for (const gate of records) {
      try {
        if (gate.membershipDigest !== canonicalDigest(membership(gate))) throw new Error("P0-P4 Readiness Gate membership digest is invalid")
        const history = await this.listHistory(gate.id)
        if (history.length !== gate.revision || canonicalDigest(history[0]) !== canonicalDigest(gate)) {
          throw new Error("Current P0-P4 Readiness Gate does not match its complete immutable history")
        }
        const status = await this.assess(gate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "p0-p4-readiness-gate.binding-review-required",
            severity: "warning",
            message: `Initiative ${gate.initiativeId} has stale P0-P4 Readiness Gate bindings.`,
            record: { type: gate.kind, id: gate.id, revision: gate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "p0-p4-readiness-gate.invalid",
          severity: "error",
          message: `P0-P4 Readiness Gate ${gate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: gate.kind, id: gate.id, revision: gate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("P0-P4 Readiness Gate Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("P0-P4 Readiness Gate must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async validateBindings(input: P0P4ReadinessGateInput, product: Product, initiative: Initiative): Promise<void> {
    const [evidenceRegistry, traceability] = await Promise.all([
      this.evidenceRegistries.readCurrent(initiative.id),
      this.traceabilityGraphs.readCurrent(initiative.id),
    ])
    if (!evidenceRegistry || !exactRecordMatches(input.evidenceRegistry, evidenceRegistry)) {
      throw new Error("P0-P4 Readiness Gate must bind the exact current Evidence Registry")
    }
    if (!traceability || !exactRecordMatches(input.traceability, traceability)) {
      throw new Error("P0-P4 Readiness Gate must bind the exact current End-to-End Traceability candidate")
    }
    const evidenceKeys = new Set(evidenceRegistry.evidenceItems.map((item) => item.key))
    for (const output of input.outputs) {
      for (const subject of output.subjects) {
        if (!(await this.subjectMatches(subject, product, initiative))) {
          throw new Error(`Readiness output ${output.outputKind} does not bind an exact current governed subject`)
        }
      }
      if (output.evidenceItemKeys.some((key) => !evidenceKeys.has(key))) {
        throw new Error(`Readiness output ${output.outputKind} references an unknown Evidence Item`)
      }
    }
    const decisionCache = new Map<string, Awaited<ReturnType<typeof decisionRegisterSchema.parse>>>()
    const riskCache = new Map<string, Awaited<ReturnType<typeof riskRegisterSchema.parse>>>()
    const readDecision = async (reference: ReadinessSubject) => {
      const key = `${reference.recordId}:${reference.revision}:${reference.digest}`
      let record = decisionCache.get(key)
      if (!record) {
        record = await this.repository.readJson(this.currentSubjectPath(reference), decisionRegisterSchema)
        if (!exactRecordMatches(reference, record) || record.productId !== product.id || record.initiativeId !== initiative.id) {
          throw new Error("Readiness waiver or unresolved decision does not bind the exact current Decision Register")
        }
        decisionCache.set(key, record)
      }
      return record
    }
    const readRisk = async (reference: ReadinessSubject) => {
      const key = `${reference.recordId}:${reference.revision}:${reference.digest}`
      let record = riskCache.get(key)
      if (!record) {
        record = await this.repository.readJson(this.currentSubjectPath(reference), riskRegisterSchema)
        if (!exactRecordMatches(reference, record) || record.productId !== product.id || record.initiativeId !== initiative.id) {
          throw new Error("Readiness waiver does not bind the exact current Risk Register")
        }
        riskCache.set(key, record)
      }
      return record
    }
    for (const waiver of input.waivers) {
      if (waiver.state === "granted") {
        throw new Error("Granted waiver authority cannot be verified by the current repository authority model")
      }
      const [decisions, risks] = await Promise.all([readDecision(waiver.decision.register), readRisk(waiver.risk.register)])
      if (!decisions.decisions.some((decision) => decision.key === waiver.decision.decisionKey) ||
          !risks.risks.some((risk) => risk.key === waiver.risk.riskKey)) {
        throw new Error("Readiness waiver references an unknown Decision or Risk key")
      }
    }
    for (const unresolved of input.unresolvedDecisions) {
      const decisions = await readDecision(unresolved.decisionRegister)
      if (!decisions.decisions.some((decision) => decision.key === unresolved.decisionKey)) {
        throw new Error("Readiness unresolved-decision entry references an unknown Decision key")
      }
    }
    for (const condition of input.conditions) {
      if (!(await this.referenceMatches(condition.sourceReference, product, initiative))) {
        throw new Error("Readiness condition does not bind an exact current governed source record")
      }
    }
  }

  private async subjectMatches(reference: ReadinessSubject, product: Product, initiative: Initiative): Promise<boolean> {
    try {
      if (reference.recordKind === "initiative") return exactRecordMatches(reference, initiative)
      const record = await this.repository.readJson(this.currentSubjectPath(reference), subjectIdentitySchema)
      return exactRecordMatches(reference, record) &&
        (record.productId === undefined || record.productId === product.id) &&
        (record.initiativeId === undefined || record.initiativeId === initiative.id)
    } catch {
      return false
    }
  }

  private async referenceMatches(reference: ReadinessSubject, product: Product, initiative: Initiative): Promise<boolean> {
    if (reference.recordKind === "approval-determination" || reference.recordKind === "authorization-grant") return false
    return this.subjectMatches(reference, product, initiative)
  }

  private currentSubjectPath(reference: ReadinessSubject): string {
    const directories: Record<string, string> = {
      "architecture-challenge-model": "architecture-challenge-models",
      "authorization-model": "authorization-models",
      "bounded-context-model": "bounded-context-models",
      "business-architecture-baseline": "business-architecture-baselines",
      "business-capability-map": "business-capability-maps",
      "business-rule-catalog": "business-rule-catalogs",
      "business-understanding": "business-understanding",
      "data-model": "data-models",
      "decision-register": "decision-registers",
      "end-to-end-traceability-candidate": "end-to-end-traceability",
      "event-integration-model": "event-integration-models",
      "evidence-registry": "evidence-registries",
      "failure-recovery-model": "failure-recovery-models",
      "initiative": "initiatives",
      "operating-model": "operating-models",
      "outcome-model": "outcome-models",
      "process-model": "process-models",
      "risk-register": "risk-registers",
      "security-privacy-threat-assessment": "security-privacy-assessments",
      "source-baseline": "source-baselines",
      "source-provenance": "source-provenance",
      "source-record": "sources",
      "stakeholder-model": "stakeholder-models",
      "system-solution-architecture": "system-solution-architectures",
      "value-stream-model": "value-stream-models",
    }
    const directory = directories[reference.recordKind]
    if (!directory) throw new Error(`Readiness subject kind ${reference.recordKind} has no current record directory`)
    return this.repository.resolve(directory, `${reference.recordId}.json`)
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Readiness Source reference identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} P0-P4 Readiness Gate is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: P0P4ReadinessGate, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, p0P4ReadinessGateSchema),
        this.governed(this.historyPath(record.id, record.revision), record, p0P4ReadinessGateSchema),
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
          evaluationDefinitionDigest: record.evaluationDefinition.digest,
          evidenceRegistry: record.evidenceRegistry,
          traceability: record.traceability,
          outputCount: record.outputs.length,
          applicableOutputCount: record.outputs.filter((entry) => entry.applicability === "applicable").length,
          notApplicableOutputCount: record.outputs.filter((entry) => entry.applicability === "not-applicable-candidate").length,
          unresolvedApplicabilityCount: record.outputs.filter((entry) => entry.applicability === "unresolved").length,
          waiverCount: record.waivers.length,
          unresolvedDecisionCount: record.unresolvedDecisions.length,
          conditionCount: record.conditions.length,
          unresolvedRequirementCount: record.requirementCoverage.filter((entry) => entry.state === "unresolved").length,
          gateResultState: "not-established-until-assessed",
          readinessState: "not-established",
          approvalState: "not-established",
          waiverAcceptanceState: "not-established",
          phaseEntryState: "not-granted",
          implementationAuthorizationState: "not-granted",
          baselinePromotionState: "not-granted",
          actionAuthorityState: "not-granted",
          gateBoundary: "a-passing-gate-is-an-evaluation-result-not-permission",
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("p0-p4-readiness-gates", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("p0-p4-readiness-gate-history", `p0-p4-readiness-gate-${id}-r${revision}.json`)
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
    if (names.length > readinessInventoryLimit) throw new Error(`P0-P4 Readiness Gate directory ${directory} exceeds the safety limit`)
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
