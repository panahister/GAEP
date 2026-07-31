import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  changedUnitInventoryInputSchema, changedUnitInventoryProjectionSchema, changedUnitInventorySchema,
  changedUnitInventoryStatusSchema, type BacklogHierarchy, type BusinessContextBinding,
  type ChangedUnitInventory, type ChangedUnitInventoryInput, type ChangedUnitInventoryProjection,
  type ChangedUnitInventoryStatus, type DependencyMapping, type DesignToCodeBindingRegistry,
  type ImplementationReadinessGate, type ImplementationUnitModel, type Initiative, type Product,
  type RiskRegister, type RouteScreenComponentMapping, type TestInventory, type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type CurrentReader<T> = { readCurrent(initiativeId: string): Promise<T | undefined> }
type ExactReference = { recordId: string; revision: number; digest: string }

interface ExactDependencies {
  backlogHierarchy: BacklogHierarchy
  implementationUnitModel: ImplementationUnitModel
  dependencyMapping: DependencyMapping
  designToCodeBindingRegistry: DesignToCodeBindingRegistry
  routeScreenComponentMapping: RouteScreenComponentMapping
  testInventory: TestInventory
  riskRegister: RiskRegister
  implementationReadinessGate: ImplementationReadinessGate
}

const dependencyNames: (keyof ExactDependencies)[] = [
  "backlogHierarchy", "implementationUnitModel", "dependencyMapping", "designToCodeBindingRegistry",
  "routeScreenComponentMapping", "testInventory", "riskRegister", "implementationReadinessGate",
]
const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "changed-unit-inventory-is-a-versioned-candidate-and-does-not-establish-repository-or-path-truth-approved-change-scope-or-change-approval-owner-appointment-implementation-readiness-code-mutation-or-staging-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "changed-unit-inventory-status-is-observational-and-does-not-establish-repository-or-path-truth-approved-change-scope-or-change-approval-owner-appointment-implementation-readiness-code-mutation-or-staging-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "changed-unit-inventory-projection-is-read-only-and-does-not-establish-repository-or-path-truth-approved-change-scope-or-change-approval-owner-appointment-implementation-readiness-code-mutation-or-staging-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-repository-relative-path-candidates-change-kinds-trace-counts-statuses-and-receipt-digests-only-not-file-content-evidence-content-owner-details-personal-data-secrets-credentials-or-machine-paths" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}
function sameReference(reference: ExactReference | undefined, record: { id: string; revision?: number } | undefined): boolean {
  return Boolean(reference && record && reference.recordId === record.id && reference.revision === revisionOf(record) && reference.digest === canonicalDigest(record))
}
function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return canonicalDigest(left) === canonicalDigest(right)
}

export class ChangedUnitInventoryService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly backlogHierarchy: CurrentReader<BacklogHierarchy>,
    private readonly implementationUnitModel: CurrentReader<ImplementationUnitModel>,
    private readonly dependencyMapping: CurrentReader<DependencyMapping>,
    private readonly designToCodeBindingRegistry: CurrentReader<DesignToCodeBindingRegistry>,
    private readonly routeScreenComponentMapping: CurrentReader<RouteScreenComponentMapping>,
    private readonly testInventory: CurrentReader<TestInventory>,
    private readonly riskRegister: CurrentReader<RiskRegister>,
    private readonly implementationReadinessGate: CurrentReader<ImplementationReadinessGate>,
  ) {}

  async create(inputValue: ChangedUnitInventoryInput, actorId: string): Promise<ChangedUnitInventory> {
    const input = changedUnitInventoryInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      this.validateUnits(input, dependencies)
      if (await this.readCurrent(initiative.id)) throw new Error("An Initiative can have only one current Changed Unit Inventory candidate")
      const now = new Date().toISOString()
      const record = changedUnitInventorySchema.parse({
        schemaVersion: 1, kind: "changed-unit-inventory-candidate", id: randomUUID(), productId: product.id,
        ...input, initiativeId: initiative.id, revision: 1, ...this.composeDigests(input), state: "candidate",
        createdBy: { kind: "human", id: actorId }, updatedBy: { kind: "human", id: actorId },
        createdAt: now, updatedAt: now, authorityBoundary,
      })
      await this.commitVersionedRecord(record, "changed-unit-inventory.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: ChangedUnitInventoryInput, actorId: string): Promise<ChangedUnitInventory> {
    const input = changedUnitInventoryInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Changed Unit Inventory revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Changed Unit Inventory Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      this.validateUnits(input, dependencies)
      const record = changedUnitInventorySchema.parse({
        ...current, ...input, productId: product.id, initiativeId: initiative.id, revision: current.revision + 1,
        ...this.composeDigests(input), predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId }, updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, "changed-unit-inventory.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<ChangedUnitInventory> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Changed Unit Inventory ID")), changedUnitInventorySchema)
  }

  async readCurrent(initiativeId: string): Promise<ChangedUnitInventory | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const matches = (await this.listRecords("changed-unit-inventories", currentRecordPattern, changedUnitInventorySchema))
      .filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Changed Unit Inventory candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<ChangedUnitInventory> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Changed Unit Inventory history revision must be a positive integer")
    const recordId = this.requireUuid(id, "Changed Unit Inventory ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), changedUnitInventorySchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Changed Unit Inventory history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<ChangedUnitInventory[]> {
    const recordId = this.requireUuid(id, "Changed Unit Inventory ID")
    const records = await this.listRecords("changed-unit-inventory-history",
      new RegExp(`^changed-unit-inventory-${recordId}-r[1-9][0-9]*\\.json$`, "iu"), changedUnitInventorySchema)
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Changed Unit Inventory history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<ChangedUnitInventoryStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, ...records] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), ...this.readDependencies(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const dependencies = this.toDependencies(records)
    const presentDependencyCount = records.filter(Boolean).length + (candidate?.realisticExample ? 1 : 0)
    const staleBindingCount = candidate && canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative)) ? 1 : 0
    const staleDependencyCount = candidate ? dependencyNames.filter((name) => !sameReference(candidate[name], dependencies?.[name])).length : 0
    const sourceUnits = dependencies?.implementationUnitModel.units ?? []
    const units = candidate?.units ?? []
    const count = (outcome: ChangedUnitInventoryInput["units"][number]["outcome"]) => units.filter((unit) => unit.outcome === outcome).length
    const sourceIds = new Set(sourceUnits.map((unit) => unit.id))
    const orphanUnitCount = units.filter((unit) => !sourceIds.has(unit.implementationUnitId)).length + sourceUnits.filter((unit) => !units.some((entry) => entry.implementationUnitId === unit.id)).length
    const traceGapCount = units.filter((unit) => unit.pathCandidates.some((path) => path.backlogNodeIds.length === 0 || path.requirementKeys.length === 0 || path.testAssetIds.length === 0)).length
    const evidenceGapCount = units.filter((unit) => unit.evidenceReferences.length === 0 || unit.pathCandidates.some((path) => path.evidenceReferences.length === 0)).length
    const ownershipGapCount = units.filter((unit) => unit.ownerCandidateIds.length === 0).length
    const blastRadiusGapCount = units.filter((unit) => unit.blastRadiusAssessmentState !== "candidate-assessed").length
    let invalidCandidateCount = 0
    if (candidate) {
      const digests = this.composeDigests(candidate)
      if (Object.entries(digests).some(([name, digest]) => candidate[name as keyof typeof digests] !== digest)) invalidCandidateCount = 1
      try { if (dependencies) this.validateUnits(candidate, dependencies) }
      catch { invalidCandidateCount = 1 }
    }
    const gapCount = count("gap"), conflictCount = count("conflict"), staleCount = count("stale"), notAssessedCount = count("not-assessed")
    const candidateScopedCount = count("candidate-scoped"), unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Changed Unit Inventory candidate exists for this Initiative")
    if (presentDependencyCount !== dependencyNames.length + 1) reasons.push(`Changed-unit inventory is missing ${dependencyNames.length + 1 - presentDependencyCount} current governed dependencies or realistic-example binding`)
    if (staleBindingCount) reasons.push("The inventory candidate does not bind the exact current Product and Initiative")
    if (staleDependencyCount) reasons.push(`The inventory candidate has ${staleDependencyCount} stale or missing exact governed dependencies`)
    if (orphanUnitCount) reasons.push("The inventory does not cover the exact current Implementation Unit catalog")
    if (traceGapCount) reasons.push("One or more path candidates lack backlog, requirement, or test traces")
    if (evidenceGapCount) reasons.push("One or more inventory or path candidates lack attributable evidence")
    if (ownershipGapCount) reasons.push("One or more inventory units lack owner candidates")
    if (blastRadiusGapCount) reasons.push("One or more inventory units lack a candidate blast-radius assessment")
    if (gapCount) reasons.push("One or more inventory units record gaps")
    if (conflictCount) reasons.push("One or more inventory units record conflicts")
    if (staleCount) reasons.push("One or more inventory units record stale evidence")
    if (notAssessedCount) reasons.push("One or more inventory units remain not assessed")
    if (invalidCandidateCount) reasons.push("The inventory candidate receipts or exact traces are invalid")
    if (unresolvedQuestionCount) reasons.push("The inventory candidate records unresolved questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The inventory candidate is not marked ready for human review")
    const hasBlockingGap = gapCount + conflictCount + staleCount + notAssessedCount + orphanUnitCount + traceGapCount + evidenceGapCount + ownershipGapCount + blastRadiusGapCount + staleBindingCount + staleDependencyCount + invalidCandidateCount + unresolvedQuestionCount > 0
    return changedUnitInventoryStatusSchema.parse({
      schemaVersion: 1, kind: "changed-unit-inventory-status", productId: product.id, productRevision: revisionOf(product),
      initiativeId: initiative.id, initiativeRevision: revisionOf(initiative), ...(candidate ? { candidate: exactReference(candidate), realisticExample: candidate.realisticExample, ...this.dependencyReferences(candidate) } : {}),
      dependencyCount: dependencyNames.length + 1, presentDependencyCount, sourceUnitCount: sourceUnits.length, inventoryUnitCount: units.length,
      pathCandidateCount: units.reduce((sum, unit) => sum + unit.pathCandidates.length, 0), candidateScopedCount, gapCount, conflictCount, staleCount,
      notAssessedCount, orphanUnitCount, traceGapCount, evidenceGapCount, ownershipGapCount, blastRadiusGapCount,
      staleBindingCount, staleDependencyCount, invalidCandidateCount, unresolvedQuestionCount, reviewState,
      state: candidate && !hasBlockingGap && reviewState === "ready-for-human-review" ? "candidate-inventoried" : "attention-required",
      reasons, assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary,
    })
  }

  async project(initiativeId: string): Promise<ChangedUnitInventoryProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) || status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Changed Unit Inventory projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const, kind: "changed-unit-inventory-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status, ...(candidate ? { candidate: { id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        dependencyReceiptDigest: candidate.dependencyReceiptDigest, inventoryReceiptDigest: candidate.inventoryReceiptDigest,
        traceReceiptDigest: candidate.traceReceiptDigest, blastRadiusReceiptDigest: candidate.blastRadiusReceiptDigest,
        evidenceReceiptDigest: candidate.evidenceReceiptDigest, ownershipReceiptDigest: candidate.ownershipReceiptDigest,
        assessmentReceiptDigest: candidate.assessmentReceiptDigest, reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
        units: candidate.units.map((unit) => ({ implementationUnitId: unit.implementationUnitId, implementationUnitKey: unit.implementationUnitKey,
          repositoryCandidate: unit.repositoryCandidate, moduleCandidate: unit.moduleCandidate, outcome: unit.outcome,
          paths: unit.pathCandidates.map((path) => ({ pathCandidate: path.pathCandidate, ...(path.sourcePathCandidate ? { sourcePathCandidate: path.sourcePathCandidate } : {}), changeKind: path.changeKind })) })) } } : {}),
      observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary,
    }
    return changedUnitInventoryProjectionSchema.parse({ ...projectionWithoutDigest, snapshotDigest: canonicalDigest(projectionWithoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("changed-unit-inventories", currentRecordPattern, changedUnitInventorySchema)
    for (const candidate of records) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) throw new Error("Current candidate does not match complete immutable history")
        if ((await this.assess(candidate.initiativeId)).state === "attention-required") issues.push({ code: "changed-unit-inventory.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has a stale, incomplete, conflicted, or unresolved Changed Unit Inventory candidate.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "create-superseding-revision"] })
      } catch (error) {
        issues.push({ code: "changed-unit-inventory.invalid", severity: "error",
          message: `Changed Unit Inventory ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "manual-repair-required"] })
      }
    }
    return issues
  }

  private validateUnits(input: ChangedUnitInventoryInput, dependencies: ExactDependencies): void {
    const sourceUnits = dependencies.implementationUnitModel.units
    if (input.units.length !== sourceUnits.length) throw new Error("Changed Unit Inventory requires exactly one candidate for every current Implementation Unit")
    const backlogNodes = new Map(dependencies.backlogHierarchy.nodes.map((node) => [node.id, node]))
    const requirements = new Set(dependencies.backlogHierarchy.nodes.flatMap((node) => node.requirements.map((reference) => reference.key)))
    const designSubjects = new Map(dependencies.designToCodeBindingRegistry.subjects.map((subject) => [subject.id, subject]))
    const mappingSubjects = new Map(dependencies.routeScreenComponentMapping.subjects.map((subject) => [subject.id, subject]))
    const testAssets = new Map(dependencies.testInventory.assets.map((asset) => [asset.id, asset]))
    const riskKeys = new Set(dependencies.riskRegister.risks.map((risk) => risk.key))
    for (const [index, sourceUnit] of sourceUnits.entries()) {
      const unit = input.units[index]
      if (!unit || unit.implementationUnitId !== sourceUnit.id || unit.implementationUnitKey !== sourceUnit.key) throw new Error("Inventory units must follow exact current Implementation Unit ordering and identity")
      if (unit.repositoryCandidate !== sourceUnit.repository.repositoryKey || unit.moduleCandidate !== sourceUnit.repository.modulePath) throw new Error("Inventory units must retain exact current repository and module candidates")
      if (!sameStrings(unit.dependencyUnitIds, sourceUnit.dependencyUnitIds) || !sameStrings(unit.directBlastRadiusUnitIds, sourceUnit.blastRadius.affectedUnitIds) || !sameStrings(unit.affectedSurfaceKeys, sourceUnit.blastRadius.affectedSurfaceKeys) || unit.blastRadiusAssessmentState !== sourceUnit.blastRadius.assessmentState) throw new Error("Inventory units must retain exact current dependency and direct blast-radius candidates")
      const direct = new Set(unit.directBlastRadiusUnitIds)
      if (unit.indirectBlastRadiusUnitIds.some((id) => id === unit.implementationUnitId || direct.has(id) || !sourceUnits.some((entry) => entry.id === id))) throw new Error("Indirect blast-radius candidates must reference distinct current Implementation Units")
      for (const path of unit.pathCandidates) {
        if (path.backlogNodeIds.some((id) => !backlogNodes.has(id) || !sourceUnit.subjectNodeIds.includes(id))) throw new Error("Path backlog traces must reference exact nodes assigned to the current Implementation Unit")
        if (path.requirementKeys.some((key) => !requirements.has(key))) throw new Error("Path requirement traces must reference exact current backlog Requirements")
        if (path.designToCodeBindingSubjectIds.some((id) => designSubjects.get(id)?.implementationUnitId !== unit.implementationUnitId)) throw new Error("Path design-to-code traces must reference exact subjects for the current Implementation Unit")
        if (path.routeScreenComponentSubjectIds.some((id) => !mappingSubjects.get(id)?.implementationUnitIds.includes(unit.implementationUnitId))) throw new Error("Path route/screen/component traces must reference exact subjects for the current Implementation Unit")
        if (path.testAssetIds.some((id) => !testAssets.get(id)?.implementationUnitIds.includes(unit.implementationUnitId))) throw new Error("Path test traces must reference exact assets for the current Implementation Unit")
        if (path.riskKeys.some((key) => !riskKeys.has(key))) throw new Error("Path risk traces must reference exact current Risk Register keys")
      }
    }
  }

  private composeDigests(input: ChangedUnitInventoryInput) {
    const dependencyReceiptDigest = canonicalDigest({ ...this.dependencyReferences(input), realisticExample: input.realisticExample })
    const inventoryReceiptDigest = canonicalDigest(input.units.map((unit) => ({ id: unit.id, ordinal: unit.ordinal, implementationUnitId: unit.implementationUnitId, implementationUnitKey: unit.implementationUnitKey, repositoryCandidate: unit.repositoryCandidate, moduleCandidate: unit.moduleCandidate, paths: unit.pathCandidates.map((path) => ({ id: path.id, ordinal: path.ordinal, pathCandidate: path.pathCandidate, sourcePathCandidate: path.sourcePathCandidate, changeKind: path.changeKind })) })))
    const traceReceiptDigest = canonicalDigest(input.units.map((unit) => ({ unitId: unit.id, paths: unit.pathCandidates.map((path) => ({ pathId: path.id, backlogNodeIds: path.backlogNodeIds, requirementKeys: path.requirementKeys, designToCodeBindingSubjectIds: path.designToCodeBindingSubjectIds, routeScreenComponentSubjectIds: path.routeScreenComponentSubjectIds, testAssetIds: path.testAssetIds, riskKeys: path.riskKeys })) })))
    const blastRadiusReceiptDigest = canonicalDigest(input.units.map((unit) => ({ unitId: unit.id, dependencyUnitIds: unit.dependencyUnitIds, directBlastRadiusUnitIds: unit.directBlastRadiusUnitIds, indirectBlastRadiusUnitIds: unit.indirectBlastRadiusUnitIds, affectedSurfaceKeys: unit.affectedSurfaceKeys, blastRadiusAssessmentState: unit.blastRadiusAssessmentState })))
    const evidenceReceiptDigest = canonicalDigest(input.units.map((unit) => ({ unitId: unit.id, evidenceReferences: unit.evidenceReferences, paths: unit.pathCandidates.map((path) => ({ pathId: path.id, evidenceReferences: path.evidenceReferences })) })))
    const ownershipReceiptDigest = canonicalDigest(input.units.map((unit) => ({ unitId: unit.id, ownerCandidateIds: unit.ownerCandidateIds, reviewCandidateIds: unit.reviewCandidateIds })))
    const assessmentReceiptDigest = canonicalDigest({ context: input.context, dependencyReceiptDigest, inventoryReceiptDigest, traceReceiptDigest, blastRadiusReceiptDigest, evidenceReceiptDigest, ownershipReceiptDigest, outcomes: input.units.map((unit) => ({ unitId: unit.id, outcome: unit.outcome })), unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations, reviewState: input.reviewState, repositoryTruthState: input.repositoryTruthState, pathTruthState: input.pathTruthState, changeScopeApprovalState: input.changeScopeApprovalState, changeApprovalState: input.changeApprovalState, ownershipAppointmentState: input.ownershipAppointmentState, implementationReadinessState: input.implementationReadinessState, codeMutationState: input.codeMutationState, stagingState: input.stagingState, assignmentExecutionState: input.assignmentExecutionState, acceptanceDecisionState: input.acceptanceDecisionState, mergeReadinessState: input.mergeReadinessState, releaseReadinessState: input.releaseReadinessState, deploymentReadinessState: input.deploymentReadinessState, actionAuthorityState: input.actionAuthorityState })
    return { dependencyReceiptDigest, inventoryReceiptDigest, traceReceiptDigest, blastRadiusReceiptDigest, evidenceReceiptDigest, ownershipReceiptDigest, assessmentReceiptDigest }
  }

  private dependencyReferences(input: ChangedUnitInventoryInput): Record<keyof ExactDependencies, ExactReference> {
    return Object.fromEntries(dependencyNames.map((name) => [name, input[name]])) as Record<keyof ExactDependencies, ExactReference>
  }
  private readDependencies(initiativeId: string): Promise<unknown>[] {
    return [this.backlogHierarchy.readCurrent(initiativeId), this.implementationUnitModel.readCurrent(initiativeId), this.dependencyMapping.readCurrent(initiativeId),
      this.designToCodeBindingRegistry.readCurrent(initiativeId), this.routeScreenComponentMapping.readCurrent(initiativeId), this.testInventory.readCurrent(initiativeId),
      this.riskRegister.readCurrent(initiativeId), this.implementationReadinessGate.readCurrent(initiativeId)]
  }
  private toDependencies(records: unknown[]): ExactDependencies | undefined {
    if (records.some((record) => !record)) return undefined
    return Object.fromEntries(dependencyNames.map((name, index) => [name, records[index]])) as unknown as ExactDependencies
  }
  private async requireExactDependencies(input: ChangedUnitInventoryInput): Promise<ExactDependencies> {
    const dependencies = this.toDependencies(await Promise.all(this.readDependencies(input.initiativeId)))
    if (!dependencies) throw new Error("Changed Unit Inventory requires all eight current governed dependencies")
    for (const name of dependencyNames) if (!sameReference(input[name], dependencies[name])) throw new Error(`Changed Unit Inventory must reference the exact current ${name} candidate`)
    return dependencies
  }
  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Changed Unit Inventory Initiative targets a different Product")
    if (canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) throw new Error("Changed Unit Inventory must bind the exact current Product and Initiative revisions and digests")
  }
  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return { productRevision: revisionOf(product), productDigest: canonicalDigest(product), initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) }
  }
  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Changed Unit Inventory is immutable`)
    return { product, initiative }
  }
  private async commitVersionedRecord(record: ChangedUnitInventory, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({ writes: [this.governed(this.currentPath(record.id), record, changedUnitInventorySchema),
      this.governed(this.historyPath(record.id, record.revision), record, changedUnitInventorySchema)],
    audit: { eventType, actor: { kind: "human", id: actorId }, subjectId: record.id, payload: {
      initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record),
      dependencyReceiptDigest: record.dependencyReceiptDigest, inventoryReceiptDigest: record.inventoryReceiptDigest,
      traceReceiptDigest: record.traceReceiptDigest, blastRadiusReceiptDigest: record.blastRadiusReceiptDigest,
      evidenceReceiptDigest: record.evidenceReceiptDigest, ownershipReceiptDigest: record.ownershipReceiptDigest,
      assessmentReceiptDigest: record.assessmentReceiptDigest, predecessorDigest: record.predecessorDigest,
      dependencyCount: dependencyNames.length + 1, unitCount: record.units.length,
      outcomes: record.units.map((unit) => ({ inventoryUnitId: unit.id, implementationUnitId: unit.implementationUnitId, outcome: unit.outcome })),
      reviewState: record.reviewState, repositoryTruthState: record.repositoryTruthState, pathTruthState: record.pathTruthState,
      changeScopeApprovalState: record.changeScopeApprovalState, codeMutationState: record.codeMutationState,
      stagingState: record.stagingState, actionAuthorityState: record.actionAuthorityState, authorityBoundary: record.authorityBoundary,
    } } })
  }
  private currentPath(id: string): string { return this.repository.resolve("changed-unit-inventories", `${id}.json`) }
  private historyPath(id: string, revision: number): string { return this.repository.resolve("changed-unit-inventory-history", `changed-unit-inventory-${id}-r${revision}.json`) }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string { const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data }
  private async assertIntegrity(): Promise<void> { const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed") }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error }
    if (names.length > inventoryLimit) throw new Error(`Changed Unit Inventory directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => `${String((left as Record<string, unknown>).id ?? "")}:${String((left as Record<string, unknown>).revision ?? "")}`.localeCompare(`${String((right as Record<string, unknown>).id ?? "")}:${String((right as Record<string, unknown>).revision ?? "")}`))
  }
}
