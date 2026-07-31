import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  backlogToCodeTraceabilityInputSchema,
  backlogToCodeTraceabilityProjectionSchema,
  backlogToCodeTraceabilitySchema,
  backlogToCodeTraceabilityStatusSchema,
  type BacklogHierarchy,
  type BacklogToCodeTraceability,
  type BacklogToCodeTraceabilityInput,
  type BacklogToCodeTraceabilityProjection,
  type BacklogToCodeTraceabilityStatus,
  type BoilerplateConstraintEnforcement,
  type BusinessContextBinding,
  type ChangedUnitInventory,
  type ControlledDesignToCodeGeneration,
  type DesignToCodeTraceability,
  type Initiative,
  type Product,
  type ProposedChangePreview,
  type TestInventory,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type CurrentReader<T> = { readCurrent(initiativeId: string): Promise<T | undefined> }
type ExactReference = { recordId: string; revision: number; digest: string }
interface Dependencies {
  backlogHierarchy: BacklogHierarchy
  changedUnitInventory: ChangedUnitInventory
  proposedChangePreview: ProposedChangePreview
  controlledDesignToCodeGeneration: ControlledDesignToCodeGeneration
  designToCodeTraceability: DesignToCodeTraceability
  boilerplateConstraintEnforcement: BoilerplateConstraintEnforcement
  testInventory: TestInventory
}

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "backlog-to-code-traceability-is-a-versioned-portable-metadata-candidate-and-does-not-establish-backlog-change-repository-path-symbol-code-commit-test-result-outcome-approval-acceptance-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "backlog-to-code-traceability-status-is-observational-and-grants-no-repository-code-commit-test-outcome-approval-acceptance-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "backlog-to-code-traceability-projection-is-read-only-and-grants-no-repository-code-commit-test-outcome-approval-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-bounded-backlog-change-path-symbol-commit-candidate-test-evidence-identities-states-counts-and-digests-only-not-source-code-commit-content-test-results-machine-paths-personal-data-secrets-credentials-or-permissions" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}
function sameReference(reference: ExactReference | undefined, record: { id: string; revision?: number } | undefined): boolean {
  return Boolean(reference && record && reference.recordId === record.id && reference.revision === revisionOf(record) && reference.digest === canonicalDigest(record))
}
function sameValues(left: readonly unknown[], right: readonly unknown[]): boolean { return canonicalDigest(left) === canonicalDigest(right) }

export class BacklogToCodeTraceabilityService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly readers: { [K in keyof Dependencies]: CurrentReader<Dependencies[K]> },
  ) {}

  async create(inputValue: BacklogToCodeTraceabilityInput, actorId: string): Promise<BacklogToCodeTraceability> {
    const input = backlogToCodeTraceabilityInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      if (await this.readCurrent(input.initiativeId)) throw new Error("A current Backlog-to-Code Traceability candidate already exists; create a revision")
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies, product, initiative)
      const now = new Date().toISOString(), digests = this.composeDigests(input)
      const record = backlogToCodeTraceabilitySchema.parse({
        schemaVersion: 1, kind: "backlog-to-code-traceability-candidate", id: randomUUID(), productId: product.id,
        ...input, revision: 1, ...digests, state: "candidate", createdBy: { kind: "human", id: actorId },
        updatedBy: { kind: "human", id: actorId }, createdAt: now, updatedAt: now, authorityBoundary,
      })
      await this.commitVersionedRecord(record, "backlog-to-code-traceability.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: BacklogToCodeTraceabilityInput, actorId: string): Promise<BacklogToCodeTraceability> {
    const input = backlogToCodeTraceabilityInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Backlog-to-Code Traceability revision conflict")
      if (current.initiativeId !== input.initiativeId) throw new Error("Backlog-to-Code Traceability Initiative binding is immutable")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies, product, initiative)
      const now = new Date().toISOString(), digests = this.composeDigests(input)
      const record = backlogToCodeTraceabilitySchema.parse({
        ...current, ...input, revision: current.revision + 1, ...digests, predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId }, updatedAt: now,
      })
      await this.commitVersionedRecord(record, "backlog-to-code-traceability.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<BacklogToCodeTraceability> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Backlog-to-Code Traceability ID")), backlogToCodeTraceabilitySchema)
  }
  async readCurrent(initiativeId: string): Promise<BacklogToCodeTraceability | undefined> {
    const target = this.requireUuid(initiativeId, "Initiative ID")
    const matches = (await this.listRecords("backlog-to-code-traceability", currentRecordPattern, backlogToCodeTraceabilitySchema))
      .filter((record) => record.initiativeId === target)
    if (matches.length > 1) throw new Error("Multiple current Backlog-to-Code Traceability candidates target one Initiative")
    return matches[0]
  }
  async readRevision(id: string, revision: number): Promise<BacklogToCodeTraceability> {
    const recordId = this.requireUuid(id, "Backlog-to-Code Traceability ID")
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Revision must be a positive integer")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), backlogToCodeTraceabilitySchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Backlog-to-Code Traceability history binding mismatch")
    return record
  }
  async listHistory(id: string): Promise<BacklogToCodeTraceability[]> {
    const recordId = this.requireUuid(id, "Backlog-to-Code Traceability ID")
    const pattern = new RegExp(`^backlog-to-code-traceability-${recordId}-r[1-9][0-9]*\\.json$`, "i")
    const records = await this.listRecords("backlog-to-code-traceability-history", pattern, backlogToCodeTraceabilitySchema)
    return records.sort((left, right) => right.revision - left.revision)
  }

  async assess(initiativeId: string): Promise<BacklogToCodeTraceabilityStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, dependencies] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), this.readDependencies(targetId),
    ])
    const reasons: string[] = []
    let staleBindingCount = 0, coverageGapCount = 0, invalidCandidateCount = 0
    if (!candidate) reasons.push("No current Backlog-to-Code Traceability candidate is recorded")
    if (Object.values(dependencies).some((value) => !value)) reasons.push("One or more required trace predecessor candidates are unavailable")
    if (candidate) {
      for (const key of Object.keys(dependencies) as (keyof Dependencies)[]) if (!sameReference(candidate.dependencies[key], dependencies[key])) staleBindingCount += 1
      const changedPathCount = dependencies.changedUnitInventory?.units.flatMap((unit) => unit.pathCandidates).length ?? 0
      if (candidate.traces.length !== changedPathCount) coverageGapCount = Math.abs(candidate.traces.length - changedPathCount) || 1
      try { if (this.completeDependencies(dependencies)) this.validateCandidate(candidate, dependencies, product, initiative) }
      catch { invalidCandidateCount += 1 }
    }
    const traces = candidate?.traces ?? []
    const linkedCount = traces.filter((trace) => trace.traceState === "candidate-linked").length
    const gapCount = traces.filter((trace) => trace.traceState === "gap" || trace.traceState === "not-assessed").length
    const conflictCount = traces.filter((trace) => trace.traceState === "conflict").length
    const staleTraceCount = traces.filter((trace) => trace.traceState === "stale").length
    if (staleBindingCount) reasons.push("One or more exact predecessor bindings are stale")
    if (coverageGapCount) reasons.push("The changed-path catalog is not covered one-for-one")
    if (gapCount) reasons.push("One or more backlog-to-code traces have a gap or are not assessed")
    if (conflictCount) reasons.push("One or more backlog-to-code traces record a conflict")
    if (staleTraceCount) reasons.push("One or more backlog-to-code traces are stale")
    if (invalidCandidateCount) reasons.push("Trace continuity or deterministic receipts are invalid")
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    if (unresolvedQuestionCount) reasons.push("The candidate records unresolved questions")
    const reviewState = candidate?.reviewState ?? "draft"
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    const blocking = staleBindingCount + coverageGapCount + gapCount + conflictCount + staleTraceCount + invalidCandidateCount + unresolvedQuestionCount
    return backlogToCodeTraceabilityStatusSchema.parse({
      schemaVersion: 1, kind: "backlog-to-code-traceability-status", productId: product.id, productRevision: revisionOf(product),
      initiativeId: initiative.id, initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate), dependencies: candidate.dependencies } : {}),
      traceCount: traces.length, backlogNodeCount: new Set(traces.map((trace) => trace.backlogNodeId)).size,
      changedPathCount: dependencies.changedUnitInventory?.units.flatMap((unit) => unit.pathCandidates).length ?? 0,
      codePathCount: new Set(traces.map((trace) => `${trace.repositoryCandidate}:${trace.pathCandidate}`)).size,
      commitCandidateCount: traces.reduce((sum, trace) => sum + trace.commitReferenceCandidates.length, 0),
      testAssetCount: new Set(traces.flatMap((trace) => trace.testAssetIds)).size,
      linkedCount, gapCount, conflictCount, staleTraceCount, staleBindingCount, coverageGapCount, invalidCandidateCount,
      unresolvedQuestionCount, reviewState,
      state: candidate && this.completeDependencies(dependencies) && blocking === 0 && reviewState === "ready-for-human-review" ? "candidate-defined" : "attention-required",
      reasons, assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary,
    })
  }

  async project(initiativeId: string): Promise<BacklogToCodeTraceabilityProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    const withoutDigest = {
      schemaVersion: 1 as const, kind: "backlog-to-code-traceability-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state }, status,
      ...(candidate ? { candidate: { id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate),
        traces: candidate.traces.map((trace) => ({ id: trace.id, traceKey: trace.traceKey, backlogNodeKey: trace.backlogNodeKey,
          repositoryCandidate: trace.repositoryCandidate, moduleCandidate: trace.moduleCandidate, pathCandidate: trace.pathCandidate,
          ...(trace.symbolCandidate ? { symbolCandidate: trace.symbolCandidate } : {}), testAssetKeys: trace.testAssetKeys,
          commitCandidateCount: trace.commitReferenceCandidates.length, traceState: trace.traceState })),
        dependencyReceiptDigest: candidate.dependencyReceiptDigest, traceCatalogDigest: candidate.traceCatalogDigest,
        commitCandidateReceiptDigest: candidate.commitCandidateReceiptDigest, testCoverageReceiptDigest: candidate.testCoverageReceiptDigest,
        evidenceReceiptDigest: candidate.evidenceReceiptDigest, assessmentReceiptDigest: candidate.assessmentReceiptDigest,
        reviewState: candidate.reviewState, updatedAt: candidate.updatedAt } } : {}),
      observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary,
    }
    return backlogToCodeTraceabilityProjectionSchema.parse({ ...withoutDigest, snapshotDigest: canonicalDigest(withoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    for (const candidate of await this.listRecords("backlog-to-code-traceability", currentRecordPattern, backlogToCodeTraceabilitySchema)) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) throw new Error("Current candidate does not match immutable history")
        if ((await this.assess(candidate.initiativeId)).state === "attention-required") issues.push({
          code: "backlog-to-code-traceability.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has a stale, incomplete, conflicting, or unresolved Backlog-to-Code Traceability candidate.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "create-superseding-revision"],
        })
      } catch (error) {
        issues.push({ code: "backlog-to-code-traceability.invalid", severity: "error",
          message: `Backlog-to-Code Traceability ${candidate.id}: ${error instanceof Error ? error.message : "validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "manual-repair-required"] })
      }
    }
    return issues
  }

  private async readDependencies(initiativeId: string): Promise<{ [K in keyof Dependencies]: Dependencies[K] | undefined }> {
    const keys = Object.keys(this.readers) as (keyof Dependencies)[]
    const values = await Promise.all(keys.map((key) => this.readers[key].readCurrent(initiativeId)))
    return Object.fromEntries(keys.map((key, index) => [key, values[index]])) as { [K in keyof Dependencies]: Dependencies[K] | undefined }
  }
  private completeDependencies(value: { [K in keyof Dependencies]: Dependencies[K] | undefined }): value is Dependencies { return Object.values(value).every(Boolean) }
  private async requireExactDependencies(input: BacklogToCodeTraceabilityInput): Promise<Dependencies> {
    const dependencies = await this.readDependencies(input.initiativeId)
    for (const key of Object.keys(dependencies) as (keyof Dependencies)[]) {
      if (!sameReference(input.dependencies[key], dependencies[key])) throw new Error(`Backlog-to-Code Traceability must reference the exact current ${key}`)
    }
    if (!this.completeDependencies(dependencies)) throw new Error("Backlog-to-Code Traceability dependencies are incomplete")
    return dependencies
  }

  private validateCandidate(input: BacklogToCodeTraceabilityInput, dependencies: Dependencies, product: Product, initiative: Initiative): void {
    for (const dependency of Object.values(dependencies)) {
      if (dependency.productId !== product.id || dependency.initiativeId !== initiative.id || canonicalDigest(dependency.context) !== canonicalDigest(input.context)) {
        throw new Error("Backlog-to-Code Traceability dependencies must bind the exact current Product, Initiative, and context")
      }
    }
    if (!sameReference(dependencies.proposedChangePreview.changedUnitInventory, dependencies.changedUnitInventory) ||
        !sameReference(dependencies.designToCodeTraceability.dependencies.controlledDesignToCodeGeneration, dependencies.controlledDesignToCodeGeneration) ||
        !sameReference(dependencies.designToCodeTraceability.dependencies.backlogHierarchy, dependencies.backlogHierarchy) ||
        !sameReference(dependencies.designToCodeTraceability.dependencies.testInventory, dependencies.testInventory) ||
        !sameReference(dependencies.boilerplateConstraintEnforcement.dependencies.controlledDesignToCodeGeneration, dependencies.controlledDesignToCodeGeneration) ||
        !sameReference(dependencies.boilerplateConstraintEnforcement.dependencies.designToCodeTraceability, dependencies.designToCodeTraceability)) {
      throw new Error("Backlog-to-Code Traceability predecessor continuity is stale")
    }
    const changedPaths = dependencies.changedUnitInventory.units.flatMap((unit) => unit.pathCandidates.map((path) => ({ unit, path })))
    if (input.traces.length !== changedPaths.length) throw new Error("Backlog-to-Code Traceability requires one trace per changed path candidate")
    for (const trace of input.traces) {
      const changed = changedPaths.find(({ unit, path }) => unit.id === trace.changedUnitId && path.id === trace.changedPathId)
      const backlogNode = dependencies.backlogHierarchy.nodes.find((node) => node.id === trace.backlogNodeId)
      const previewUnit = dependencies.proposedChangePreview.previewUnits.find((unit) => unit.changedUnitCandidateId === trace.changedUnitId)
      const previewPath = previewUnit?.pathPreviews.find((path) => path.changedPathCandidateId === trace.changedPathId)
      const generation = dependencies.controlledDesignToCodeGeneration.targets.find((target) => target.id === trace.generationTargetId)
      const designTrace = dependencies.designToCodeTraceability.traces.find((candidate) => candidate.id === trace.designTraceId)
      const constraint = dependencies.boilerplateConstraintEnforcement.targets.find((target) => target.id === trace.constraintTargetId)
      const tests = trace.testAssetIds.map((id) => dependencies.testInventory.assets.find((asset) => asset.id === id))
      if (!changed || !backlogNode || !previewPath || !generation || !designTrace || !constraint || tests.some((test) => !test)) {
        throw new Error("Backlog-to-Code Traceability contains a missing backlog, change, preview, generation, design, constraint, or test subject")
      }
      const exactTests = tests as NonNullable<(typeof tests)[number]>[]
      const expectedRequirements = changed.path.requirementKeys
      const backlogRequirements = backlogNode.requirements.map((reference) => reference.key).sort()
      if (!changed.path.backlogNodeIds.includes(backlogNode.id) || trace.backlogNodeKey !== backlogNode.key ||
          trace.implementationUnitId !== changed.unit.implementationUnitId || trace.pathCandidate !== changed.path.pathCandidate ||
          trace.repositoryCandidate !== changed.unit.repositoryCandidate || trace.moduleCandidate !== changed.unit.moduleCandidate ||
          previewPath.pathCandidate !== trace.pathCandidate || generation.implementationUnitId !== trace.implementationUnitId ||
          generation.pathCandidate !== trace.pathCandidate || generation.repositoryCandidate !== trace.repositoryCandidate ||
          generation.moduleCandidate !== trace.moduleCandidate || designTrace.generationTargetId !== generation.id ||
          designTrace.pathCandidate !== trace.pathCandidate || designTrace.symbolCandidate !== trace.symbolCandidate ||
          constraint.generationTargetId !== generation.id || constraint.traceId !== designTrace.id ||
          constraint.pathCandidate !== trace.pathCandidate || !sameValues(trace.requirementKeys, expectedRequirements) ||
          !trace.requirementKeys.every((key) => backlogRequirements.includes(key)) ||
          !sameValues(trace.testAssetIds, changed.path.testAssetIds) || !sameValues(trace.testAssetKeys, exactTests.map((test) => test.key).sort()) ||
          !exactTests.every((test) => test.implementationUnitIds.includes(trace.implementationUnitId) && trace.requirementKeys.some((key) => test.requirementKeys.includes(key)))) {
        throw new Error("Backlog-to-Code Traceability does not preserve exact backlog, change, code, constraint, or test continuity")
      }
    }
  }

  private composeDigests(input: BacklogToCodeTraceabilityInput) {
    const dependencyReceiptDigest = canonicalDigest(input.dependencies), traceCatalogDigest = canonicalDigest(input.traces)
    const commitCandidateReceiptDigest = canonicalDigest(input.traces.map((trace) => ({ id: trace.id, commitReferenceCandidates: trace.commitReferenceCandidates })))
    const testCoverageReceiptDigest = canonicalDigest(input.traces.map((trace) => ({ id: trace.id, requirementKeys: trace.requirementKeys, testAssetIds: trace.testAssetIds })))
    const evidenceReceiptDigest = canonicalDigest(input.traces.map((trace) => ({ id: trace.id, evidenceReferences: trace.evidenceReferences, conflictReferenceCandidates: trace.conflictReferenceCandidates })))
    const assessmentReceiptDigest = canonicalDigest({ dependencyReceiptDigest, traceCatalogDigest, commitCandidateReceiptDigest,
      testCoverageReceiptDigest, evidenceReceiptDigest, reviewState: input.reviewState, unresolvedQuestions: input.unresolvedQuestions,
      limitations: input.limitations, traceCompletenessState: input.traceCompletenessState, repositoryTruthState: input.repositoryTruthState,
      codeTruthState: input.codeTruthState, commitTruthState: input.commitTruthState, testExecutionState: input.testExecutionState,
      testResultState: input.testResultState, outcomeTruthState: input.outcomeTruthState, approvalState: input.approvalState,
      acceptanceState: input.acceptanceState, nativeHostAcceptanceState: input.nativeHostAcceptanceState,
      liveProviderAcceptanceState: input.liveProviderAcceptanceState, securityAcceptanceState: input.securityAcceptanceState,
      releaseReadinessState: input.releaseReadinessState, deploymentReadinessState: input.deploymentReadinessState,
      actionAuthorityState: input.actionAuthorityState })
    return { dependencyReceiptDigest, traceCatalogDigest, commitCandidateReceiptDigest, testCoverageReceiptDigest, evidenceReceiptDigest, assessmentReceiptDigest }
  }
  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id || canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) throw new Error("Backlog-to-Code Traceability must bind exact current Product and Initiative revisions and digests")
  }
  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return { productRevision: revisionOf(product), productDigest: canonicalDigest(product), initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) }
  }
  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Backlog-to-Code Traceability is immutable`)
    return { product, initiative }
  }
  private async commitVersionedRecord(record: BacklogToCodeTraceability, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({ writes: [this.governed(this.currentPath(record.id), record, backlogToCodeTraceabilitySchema),
      this.governed(this.historyPath(record.id, record.revision), record, backlogToCodeTraceabilitySchema)],
    audit: { eventType, actor: { kind: "human", id: actorId }, subjectId: record.id, payload: {
      initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record), dependencies: record.dependencies,
      traceCount: record.traces.length, commitCandidateCount: record.traces.reduce((sum, trace) => sum + trace.commitReferenceCandidates.length, 0),
      dependencyReceiptDigest: record.dependencyReceiptDigest, traceCatalogDigest: record.traceCatalogDigest,
      commitCandidateReceiptDigest: record.commitCandidateReceiptDigest, testCoverageReceiptDigest: record.testCoverageReceiptDigest,
      evidenceReceiptDigest: record.evidenceReceiptDigest, assessmentReceiptDigest: record.assessmentReceiptDigest,
      predecessorDigest: record.predecessorDigest, reviewState: record.reviewState, actionAuthorityState: record.actionAuthorityState,
      authorityBoundary: record.authorityBoundary } } })
  }
  private currentPath(id: string): string { return this.repository.resolve("backlog-to-code-traceability", `${id}.json`) }
  private historyPath(id: string, revision: number): string { return this.repository.resolve("backlog-to-code-traceability-history", `backlog-to-code-traceability-${id}-r${revision}.json`) }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string { const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data }
  private async assertIntegrity(): Promise<void> { const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed") }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error }
    if (names.length > inventoryLimit) throw new Error(`Backlog-to-Code Traceability directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => `${String((left as Record<string, unknown>).id ?? "")}:${String((left as Record<string, unknown>).revision ?? "")}`.localeCompare(`${String((right as Record<string, unknown>).id ?? "")}:${String((right as Record<string, unknown>).revision ?? "")}`))
  }
}
