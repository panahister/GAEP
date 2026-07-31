import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  boilerplateConstraintEnforcementInputSchema,
  boilerplateConstraintEnforcementProjectionSchema,
  boilerplateConstraintEnforcementSchema,
  boilerplateConstraintEnforcementStatusSchema,
  boilerplateConstraintKinds,
  type BoilerplateCompatibilityValidation,
  type BoilerplateConstraintEnforcement,
  type BoilerplateConstraintEnforcementInput,
  type BoilerplateConstraintEnforcementProjection,
  type BoilerplateConstraintEnforcementStatus,
  type BoilerplateRegistry,
  type BoilerplateSelectionBinding,
  type BusinessContextBinding,
  type ControlledDesignToCodeGeneration,
  type DesignToCodeBindingRegistry,
  type DesignToCodeTraceability,
  type FigmaToBoilerplateMapping,
  type ImplementationUnitModel,
  type Initiative,
  type Product,
  type ProposedChangePreview,
  type RouteScreenComponentMapping,
  type StagingWorkspace,
  type TechnologyProfile,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { z, type ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type CurrentReader<T> = { readCurrent(initiativeId: string): Promise<T | undefined> }
type ExactReference = { recordId: string; revision: number; digest: string }
interface Dependencies {
  technologyProfile: TechnologyProfile
  boilerplateRegistry: BoilerplateRegistry
  boilerplateSelectionBinding: BoilerplateSelectionBinding
  boilerplateCompatibilityValidation: BoilerplateCompatibilityValidation
  figmaToBoilerplateMapping: FigmaToBoilerplateMapping
  designToCodeBindingRegistry: DesignToCodeBindingRegistry
  routeScreenComponentMapping: RouteScreenComponentMapping
  implementationUnitModel: ImplementationUnitModel
  proposedChangePreview: ProposedChangePreview
  stagingWorkspace: StagingWorkspace
  controlledDesignToCodeGeneration: ControlledDesignToCodeGeneration
  designToCodeTraceability: DesignToCodeTraceability
}

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "boilerplate-constraint-enforcement-is-a-versioned-portable-policy-candidate-and-does-not-inspect-repository-source-or-generated-output-execute-enforcement-establish-stack-architecture-dependency-module-path-route-component-test-compliance-approval-waiver-acceptance-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "boilerplate-constraint-enforcement-status-is-observational-and-grants-no-repository-source-output-enforcement-compliance-approval-waiver-acceptance-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "boilerplate-constraint-enforcement-projection-is-read-only-and-grants-no-repository-source-output-enforcement-compliance-approval-waiver-acceptance-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-bounded-policy-rule-target-violation-identities-repository-relative-candidate-locations-states-counts-and-digests-only-not-source-or-generated-content-test-results-machine-paths-personal-data-secrets-credentials-or-permissions" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}
function sameReference(reference: ExactReference | undefined, record: { id: string; revision?: number } | undefined): boolean {
  return Boolean(reference && record && reference.recordId === record.id && reference.revision === revisionOf(record) && reference.digest === canonicalDigest(record))
}
function sameValues(left: readonly unknown[], right: readonly unknown[]): boolean { return canonicalDigest(left) === canonicalDigest(right) }

export class BoilerplateConstraintEnforcementService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly readers: { [K in keyof Dependencies]: CurrentReader<Dependencies[K]> },
  ) {}

  async create(inputValue: BoilerplateConstraintEnforcementInput, actorId: string): Promise<BoilerplateConstraintEnforcement> {
    const input = boilerplateConstraintEnforcementInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      if (await this.readCurrent(input.initiativeId)) throw new Error("A current Boilerplate Constraint Enforcement candidate already exists; create a revision")
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies, product, initiative)
      const now = new Date().toISOString(), digests = this.composeDigests(input)
      const record = boilerplateConstraintEnforcementSchema.parse({
        schemaVersion: 1, kind: "boilerplate-constraint-enforcement-candidate", id: randomUUID(), productId: product.id,
        ...input, revision: 1, ...digests, state: "candidate", createdBy: { kind: "human", id: actorId },
        updatedBy: { kind: "human", id: actorId }, createdAt: now, updatedAt: now, authorityBoundary,
      })
      await this.commitVersionedRecord(record, "boilerplate-constraint-enforcement.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: BoilerplateConstraintEnforcementInput, actorId: string): Promise<BoilerplateConstraintEnforcement> {
    const input = boilerplateConstraintEnforcementInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Boilerplate Constraint Enforcement revision conflict")
      if (current.initiativeId !== input.initiativeId) throw new Error("Boilerplate Constraint Enforcement Initiative binding is immutable")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      this.validateCandidate(input, dependencies, product, initiative)
      const now = new Date().toISOString(), digests = this.composeDigests(input)
      const record = boilerplateConstraintEnforcementSchema.parse({
        ...current, ...input, revision: current.revision + 1, ...digests, predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId }, updatedAt: now,
      })
      await this.commitVersionedRecord(record, "boilerplate-constraint-enforcement.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<BoilerplateConstraintEnforcement> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Boilerplate Constraint Enforcement ID")), boilerplateConstraintEnforcementSchema)
  }
  async readCurrent(initiativeId: string): Promise<BoilerplateConstraintEnforcement | undefined> {
    const target = this.requireUuid(initiativeId, "Initiative ID")
    const matches = (await this.listRecords("boilerplate-constraint-enforcement", currentRecordPattern, boilerplateConstraintEnforcementSchema))
      .filter((record) => record.initiativeId === target)
    if (matches.length > 1) throw new Error("Multiple current Boilerplate Constraint Enforcement candidates target one Initiative")
    return matches[0]
  }
  async readRevision(id: string, revision: number): Promise<BoilerplateConstraintEnforcement> {
    const recordId = this.requireUuid(id, "Boilerplate Constraint Enforcement ID")
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Revision must be a positive integer")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), boilerplateConstraintEnforcementSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Boilerplate Constraint Enforcement history binding mismatch")
    return record
  }
  async listHistory(id: string): Promise<BoilerplateConstraintEnforcement[]> {
    const recordId = this.requireUuid(id, "Boilerplate Constraint Enforcement ID")
    const pattern = new RegExp(`^boilerplate-constraint-enforcement-${recordId}-r[1-9][0-9]*\\.json$`, "i")
    const records = await this.listRecords("boilerplate-constraint-enforcement-history", pattern, boilerplateConstraintEnforcementSchema)
    return records.sort((left, right) => right.revision - left.revision)
  }

  async assess(initiativeId: string): Promise<BoilerplateConstraintEnforcementStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, dependencies] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), this.readDependencies(targetId),
    ])
    const reasons: string[] = []
    let staleBindingCount = 0, coverageGapCount = 0, ruleGapCount = 0, invalidCandidateCount = 0
    if (!candidate) reasons.push("No current Boilerplate Constraint Enforcement candidate is recorded")
    if (Object.values(dependencies).some((value) => !value)) reasons.push("One or more required enforcement predecessor candidates are unavailable")
    if (candidate) {
      for (const key of Object.keys(dependencies) as (keyof Dependencies)[]) {
        if (!sameReference(candidate.dependencies[key], dependencies[key])) staleBindingCount += 1
      }
      const generationTargetCount = dependencies.controlledDesignToCodeGeneration?.targets.length ?? 0
      if (candidate.targets.length !== generationTargetCount) coverageGapCount += Math.abs(candidate.targets.length - generationTargetCount) || 1
      ruleGapCount = boilerplateConstraintKinds.filter((kind) => !candidate.rules.some((rule) => rule.kind === kind)).length
      for (const target of candidate.targets) {
        const kinds = new Set(target.applicableRuleIds.map((id) => candidate.rules.find((rule) => rule.id === id)?.kind).filter(Boolean))
        ruleGapCount += boilerplateConstraintKinds.filter((kind) => !kinds.has(kind)).length
      }
      try { if (this.completeDependencies(dependencies)) this.validateCandidate(candidate, dependencies, product, initiative) }
      catch { invalidCandidateCount += 1 }
    }
    const targets = candidate?.targets ?? []
    const conformantTargetCount = targets.filter((target) => target.enforcementState === "candidate-conformant").length
    const nonconformantTargetCount = targets.filter((target) => target.enforcementState === "candidate-nonconformant").length
    const exceptionTargetCount = targets.filter((target) => target.enforcementState === "exception-candidate").length
    const notAssessedTargetCount = targets.filter((target) => target.enforcementState === "not-assessed").length
    if (staleBindingCount) reasons.push("One or more exact predecessor bindings are stale")
    if (coverageGapCount) reasons.push("The controlled generation target catalog is not covered one-for-one")
    if (ruleGapCount) reasons.push("One or more policy or target rule-kind bindings are incomplete")
    if (nonconformantTargetCount) reasons.push("One or more targets record candidate nonconformance")
    if (exceptionTargetCount) reasons.push("One or more targets require an unresolved exception candidate")
    if (notAssessedTargetCount) reasons.push("One or more targets are not assessed")
    if (invalidCandidateCount) reasons.push("The enforcement continuity or deterministic receipts are invalid")
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    if (unresolvedQuestionCount) reasons.push("The candidate records unresolved questions")
    const reviewState = candidate?.reviewState ?? "draft"
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    const blocking = staleBindingCount + coverageGapCount + ruleGapCount + nonconformantTargetCount + exceptionTargetCount +
      notAssessedTargetCount + invalidCandidateCount + unresolvedQuestionCount
    return boilerplateConstraintEnforcementStatusSchema.parse({
      schemaVersion: 1, kind: "boilerplate-constraint-enforcement-status", productId: product.id, productRevision: revisionOf(product),
      initiativeId: initiative.id, initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate), dependencies: candidate.dependencies } : {}),
      ruleCount: candidate?.rules.length ?? 0, coveredKindCount: new Set(candidate?.rules.map((rule) => rule.kind) ?? []).size,
      targetCount: targets.length, generationTargetCount: dependencies.controlledDesignToCodeGeneration?.targets.length ?? 0,
      conformantTargetCount, nonconformantTargetCount, exceptionTargetCount, notAssessedTargetCount,
      violationCount: candidate?.violations.length ?? 0, staleBindingCount, coverageGapCount, ruleGapCount, invalidCandidateCount,
      unresolvedQuestionCount, reviewState,
      state: candidate && this.completeDependencies(dependencies) && blocking === 0 && reviewState === "ready-for-human-review" ? "candidate-defined" : "attention-required",
      reasons, assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary,
    })
  }

  async project(initiativeId: string): Promise<BoilerplateConstraintEnforcementProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    const ruleKindCounts = Object.fromEntries(boilerplateConstraintKinds.map((kind) => [kind, candidate?.rules.filter((rule) => rule.kind === kind).length ?? 0]))
    const withoutDigest = {
      schemaVersion: 1 as const, kind: "boilerplate-constraint-enforcement-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state }, status,
      ...(candidate ? { candidate: {
        id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), policyKey: candidate.policyKey,
        ruleKindCounts, targets: candidate.targets.map((target) => ({
          id: target.id, targetKey: target.targetKey, traceKey: target.traceKey, implementationUnitId: target.implementationUnitId,
          repositoryCandidate: target.repositoryCandidate, moduleCandidate: target.moduleCandidate, pathCandidate: target.pathCandidate,
          applicableRuleCount: target.applicableRuleIds.length, violationCount: target.violationIds.length,
          enforcementState: target.enforcementState,
        })), dependencyReceiptDigest: candidate.dependencyReceiptDigest, ruleCatalogDigest: candidate.ruleCatalogDigest,
        targetCoverageDigest: candidate.targetCoverageDigest, violationReceiptDigest: candidate.violationReceiptDigest,
        policyReceiptDigest: candidate.policyReceiptDigest, assessmentReceiptDigest: candidate.assessmentReceiptDigest,
        reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
      } } : {}), observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary,
    }
    return boilerplateConstraintEnforcementProjectionSchema.parse({ ...withoutDigest, snapshotDigest: canonicalDigest(withoutDigest) })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    for (const candidate of await this.listRecords("boilerplate-constraint-enforcement", currentRecordPattern, boilerplateConstraintEnforcementSchema)) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) throw new Error("Current candidate does not match immutable history")
        if ((await this.assess(candidate.initiativeId)).state === "attention-required") issues.push({
          code: "boilerplate-constraint-enforcement.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has a stale, incomplete, conflicting, or unresolved Boilerplate Constraint Enforcement candidate.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision }, repairActions: ["inspect-read-only", "create-superseding-revision"],
        })
      } catch (error) {
        issues.push({ code: "boilerplate-constraint-enforcement.invalid", severity: "error",
          message: `Boilerplate Constraint Enforcement ${candidate.id}: ${error instanceof Error ? error.message : "validation failed"}`,
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
  private completeDependencies(value: { [K in keyof Dependencies]: Dependencies[K] | undefined }): value is Dependencies {
    return Object.values(value).every(Boolean)
  }
  private async requireExactDependencies(input: BoilerplateConstraintEnforcementInput): Promise<Dependencies> {
    const dependencies = await this.readDependencies(input.initiativeId)
    for (const key of Object.keys(dependencies) as (keyof Dependencies)[]) {
      if (!sameReference(input.dependencies[key], dependencies[key])) throw new Error(`Boilerplate Constraint Enforcement must reference the exact current ${key}`)
    }
    if (!this.completeDependencies(dependencies)) throw new Error("Boilerplate Constraint Enforcement dependencies are incomplete")
    return dependencies
  }

  private validateCandidate(input: BoilerplateConstraintEnforcementInput, dependencies: Dependencies, product: Product, initiative: Initiative): void {
    for (const dependency of Object.values(dependencies)) {
      if (dependency.productId !== product.id || dependency.initiativeId !== initiative.id || canonicalDigest(dependency.context) !== canonicalDigest(input.context)) {
        throw new Error("Boilerplate Constraint Enforcement dependencies must bind the exact current Product, Initiative, and context")
      }
    }
    const sourceRecords = {
      "technology-profile": dependencies.technologyProfile,
      "boilerplate-registry": dependencies.boilerplateRegistry,
      "boilerplate-selection-binding": dependencies.boilerplateSelectionBinding,
      "boilerplate-compatibility-validation": dependencies.boilerplateCompatibilityValidation,
      "figma-to-boilerplate-mapping": dependencies.figmaToBoilerplateMapping,
      "design-to-code-binding-registry": dependencies.designToCodeBindingRegistry,
      "route-screen-component-mapping": dependencies.routeScreenComponentMapping,
      "implementation-unit-model": dependencies.implementationUnitModel,
    } as const
    for (const rule of input.rules) {
      if (!sameReference(rule.sourceRecord, sourceRecords[rule.source])) throw new Error(`Constraint rule ${rule.ruleKey} does not bind its exact source record`)
    }
    const generation = dependencies.controlledDesignToCodeGeneration
    const traceability = dependencies.designToCodeTraceability
    if (!sameReference(traceability.dependencies.controlledDesignToCodeGeneration, generation) ||
        !sameReference(generation.dependencies.technologyProfile, dependencies.technologyProfile) ||
        !sameReference(generation.dependencies.boilerplateSelectionBinding, dependencies.boilerplateSelectionBinding) ||
        !sameReference(generation.dependencies.boilerplateCompatibilityValidation, dependencies.boilerplateCompatibilityValidation) ||
        !sameReference(generation.dependencies.figmaToBoilerplateMapping, dependencies.figmaToBoilerplateMapping) ||
        !sameReference(generation.dependencies.designToCodeBindingRegistry, dependencies.designToCodeBindingRegistry) ||
        !sameReference(generation.dependencies.routeScreenComponentMapping, dependencies.routeScreenComponentMapping) ||
        !sameReference(generation.dependencies.implementationUnitModel, dependencies.implementationUnitModel) ||
        !sameReference(generation.dependencies.proposedChangePreview, dependencies.proposedChangePreview) ||
        !sameReference(generation.dependencies.stagingWorkspace, dependencies.stagingWorkspace)) {
      throw new Error("Boilerplate Constraint Enforcement predecessor continuity is stale")
    }
    if (input.targets.length !== generation.targets.length || input.targets.length !== traceability.traces.length) {
      throw new Error("Boilerplate Constraint Enforcement requires one target per controlled generation and traceability target")
    }
    for (const target of input.targets) {
      const generationTarget = generation.targets.find((entry) => entry.id === target.generationTargetId)
      const trace = traceability.traces.find((entry) => entry.id === target.traceId)
      const rules = target.applicableRuleIds.map((id) => input.rules.find((rule) => rule.id === id))
      const violations = target.violationIds.map((id) => input.violations.find((violation) => violation.id === id))
      if (!generationTarget || !trace || rules.some((rule) => !rule) || violations.some((violation) => !violation)) {
        throw new Error("Boilerplate Constraint Enforcement contains a missing generation, trace, rule, or violation subject")
      }
      if (target.targetKey !== generationTarget.targetKey || trace.generationTargetId !== generationTarget.id || target.traceKey !== trace.traceKey ||
          target.implementationUnitId !== generationTarget.implementationUnitId || target.implementationUnitId !== trace.implementationUnitId ||
          target.repositoryCandidate !== generationTarget.repositoryCandidate || target.repositoryCandidate !== trace.repositoryCandidate ||
          target.moduleCandidate !== generationTarget.moduleCandidate || target.moduleCandidate !== trace.moduleCandidate ||
          target.pathCandidate !== generationTarget.pathCandidate || target.pathCandidate !== trace.pathCandidate ||
          !sameValues(target.applicableRuleKeys, (rules as NonNullable<(typeof rules)[number]>[]).map((rule) => rule.ruleKey).sort()) ||
          !sameValues(target.violationKeys, (violations as NonNullable<(typeof violations)[number]>[]).map((violation) => violation.violationKey).sort()) ||
          !(violations as NonNullable<(typeof violations)[number]>[]).every((violation) => violation.targetId === target.id) ||
          !boilerplateConstraintKinds.every((kind) => rules.some((rule) => rule?.kind === kind))) {
        throw new Error("Boilerplate Constraint Enforcement does not preserve exact target, trace, path, rule, or violation continuity")
      }
    }
  }

  private composeDigests(input: BoilerplateConstraintEnforcementInput) {
    const dependencyReceiptDigest = canonicalDigest(input.dependencies)
    const ruleCatalogDigest = canonicalDigest(input.rules)
    const targetCoverageDigest = canonicalDigest(input.targets)
    const violationReceiptDigest = canonicalDigest(input.violations)
    const policyReceiptDigest = canonicalDigest({ policyKey: input.policyKey, dependencyReceiptDigest, ruleCatalogDigest, targetCoverageDigest, violationReceiptDigest })
    const assessmentReceiptDigest = canonicalDigest({ policyReceiptDigest, reviewState: input.reviewState,
      unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations, policyApprovalState: input.policyApprovalState,
      exceptionWaiverState: input.exceptionWaiverState, repositoryInspectionState: input.repositoryInspectionState,
      sourceInspectionState: input.sourceInspectionState, generatedOutputInspectionState: input.generatedOutputInspectionState,
      enforcementExecutionState: input.enforcementExecutionState, complianceTruthState: input.complianceTruthState,
      nativeHostAcceptanceState: input.nativeHostAcceptanceState, liveProviderAcceptanceState: input.liveProviderAcceptanceState,
      securityAcceptanceState: input.securityAcceptanceState, releaseReadinessState: input.releaseReadinessState,
      deploymentReadinessState: input.deploymentReadinessState, actionAuthorityState: input.actionAuthorityState })
    return { dependencyReceiptDigest, ruleCatalogDigest, targetCoverageDigest, violationReceiptDigest, policyReceiptDigest, assessmentReceiptDigest }
  }
  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id || canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) {
      throw new Error("Boilerplate Constraint Enforcement must bind exact current Product and Initiative revisions and digests")
    }
  }
  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return { productRevision: revisionOf(product), productDigest: canonicalDigest(product), initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) }
  }
  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Boilerplate Constraint Enforcement is immutable`)
    return { product, initiative }
  }
  private async commitVersionedRecord(record: BoilerplateConstraintEnforcement, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({ writes: [
      this.governed(this.currentPath(record.id), record, boilerplateConstraintEnforcementSchema),
      this.governed(this.historyPath(record.id, record.revision), record, boilerplateConstraintEnforcementSchema),
    ], audit: { eventType, actor: { kind: "human", id: actorId }, subjectId: record.id, payload: {
      initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record), dependencies: record.dependencies,
      ruleCount: record.rules.length, targetCount: record.targets.length, violationCount: record.violations.length,
      dependencyReceiptDigest: record.dependencyReceiptDigest, ruleCatalogDigest: record.ruleCatalogDigest,
      targetCoverageDigest: record.targetCoverageDigest, violationReceiptDigest: record.violationReceiptDigest,
      policyReceiptDigest: record.policyReceiptDigest, assessmentReceiptDigest: record.assessmentReceiptDigest,
      predecessorDigest: record.predecessorDigest, reviewState: record.reviewState, actionAuthorityState: record.actionAuthorityState,
      authorityBoundary: record.authorityBoundary,
    } } })
  }
  private currentPath(id: string): string { return this.repository.resolve("boilerplate-constraint-enforcement", `${id}.json`) }
  private historyPath(id: string, revision: number): string { return this.repository.resolve("boilerplate-constraint-enforcement-history", `boilerplate-constraint-enforcement-${id}-r${revision}.json`) }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string { const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data }
  private async assertIntegrity(): Promise<void> { const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed") }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error }
    if (names.length > inventoryLimit) throw new Error(`Boilerplate Constraint Enforcement directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => `${String((left as Record<string, unknown>).id ?? "")}:${String((left as Record<string, unknown>).revision ?? "")}`.localeCompare(`${String((right as Record<string, unknown>).id ?? "")}:${String((right as Record<string, unknown>).revision ?? "")}`))
  }
}
