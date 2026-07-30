import { randomUUID } from "node:crypto"

import { canonicalDigest } from "@gaep/agent-sdk"
import {
  routeScreenComponentMappingInputSchema,
  routeScreenComponentMappingProjectionSchema,
  routeScreenComponentMappingSchema,
  routeScreenComponentMappingStatusSchema,
  type AcceptanceCriteria,
  type BusinessContextBinding,
  type DesignBaseline,
  type DesignRequirements,
  type DesignToCodeBindingRegistry,
  type DesignToRequirementBinding,
  type FigmaToBoilerplateMapping,
  type ImplementationUnitModel,
  type InformationArchitectureModel,
  type Initiative,
  type Product,
  type RouteScreenComponentMapping,
  type RouteScreenComponentMappingInput,
  type RouteScreenComponentMappingProjection,
  type RouteScreenComponentMappingStatus,
  type ScreenStateInventory,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { z, type ZodType } from "zod"

import type { AcceptanceCriteriaService } from "./acceptance-criteria.js"
import type { DesignBaselineService } from "./design-baseline.js"
import type { DesignRequirementsService } from "./design-requirements.js"
import type { DesignToCodeBindingRegistryService } from "./design-to-code-binding-registry.js"
import type { DesignToRequirementBindingService } from "./design-to-requirement-binding.js"
import type { FigmaToBoilerplateMappingService } from "./figma-to-boilerplate-mapping.js"
import type { ImplementationUnitModelService } from "./implementation-unit-model.js"
import type { InformationArchitectureModelService } from "./information-architecture-model.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { ScreenStateInventoryService } from "./screen-state-inventory.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>
type ExactReference = { recordId: string; revision: number; digest: string }

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const authorityBoundary = "route-screen-component-mapping-is-a-versioned-candidate-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-navigation-route-screen-state-component-responsive-platform-requirement-acceptance-criteria-test-coverage-repository-path-symbol-or-mapping-truth-or-completeness-create-or-change-code-or-design-targets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const statusAuthorityBoundary = "route-screen-component-mapping-status-is-observational-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-navigation-route-screen-state-component-responsive-platform-requirement-acceptance-criteria-test-coverage-repository-path-symbol-or-mapping-truth-or-completeness-create-or-change-code-or-design-targets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const projectionAuthorityBoundary = "route-screen-component-mapping-projection-is-read-only-and-does-not-connect-to-or-call-figma-establish-returned-figma-content-design-validity-approval-or-baseline-navigation-route-screen-state-component-responsive-platform-requirement-acceptance-criteria-test-coverage-repository-path-symbol-or-mapping-truth-or-completeness-create-or-change-code-or-design-targets-establish-implementation-readiness-or-completeness-assignment-execution-acceptance-merge-release-deployment-or-action-authority" as const
const privacyBoundary = "projection-contains-record-identities-counts-statuses-and-subject-relationship-trace-mapping-assessment-snapshot-digests-only-not-route-pattern-screen-state-component-design-requirement-criterion-unit-repository-module-path-symbol-test-hook-evidence-reviewer-personal-data-secrets-credentials-or-machine-paths" as const

function revisionOf(record: { revision?: number }): number { return record.revision ?? 1 }
function exactReference(record: { id: string; revision: number }): ExactReference {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}
function sameReference(reference: ExactReference, record: { id: string; revision: number } | undefined): boolean {
  return !!record && reference.recordId === record.id && reference.revision === record.revision &&
    reference.digest === canonicalDigest(record)
}
function sameList(left: readonly string[], right: readonly string[]): boolean {
  return canonicalDigest(left) === canonicalDigest(right)
}
function canonicalValues(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right))
}

interface ExactDependencies {
  informationArchitecture: InformationArchitectureModel
  screenStateInventory: ScreenStateInventory
  designRequirements: DesignRequirements
  designBaseline: DesignBaseline
  designToRequirementBinding: DesignToRequirementBinding
  figmaToBoilerplateMapping: FigmaToBoilerplateMapping
  designToCodeBindingRegistry: DesignToCodeBindingRegistry
  implementationUnitModel: ImplementationUnitModel
  acceptanceCriteria: AcceptanceCriteria
}

interface MappingAssessment {
  sourceRouteCount: number
  sourceScreenCount: number
  sourceStateCount: number
  sourceComponentCount: number
  missingSubjectCount: number
  extraSubjectCount: number
  invalidSubjectCount: number
  missingRelationshipCount: number
  invalidRelationshipCount: number
  traceGapCount: number
  evidenceGapCount: number
  componentPlacementGapCount: number
  testHookGapCount: number
}

type MappingSubject = RouteScreenComponentMappingInput["subjects"][number]
type MappingRelationship = RouteScreenComponentMappingInput["relationships"][number]

export class RouteScreenComponentMappingService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly informationArchitecture: InformationArchitectureModelService,
    private readonly screenStateInventory: ScreenStateInventoryService,
    private readonly designRequirements: DesignRequirementsService,
    private readonly designBaseline: DesignBaselineService,
    private readonly designToRequirementBinding: DesignToRequirementBindingService,
    private readonly figmaToBoilerplateMapping: FigmaToBoilerplateMappingService,
    private readonly designToCodeBindingRegistry: DesignToCodeBindingRegistryService,
    private readonly implementationUnitModel: ImplementationUnitModelService,
    private readonly acceptanceCriteria: AcceptanceCriteriaService,
  ) {}

  async create(inputValue: RouteScreenComponentMappingInput, actorId: string): Promise<RouteScreenComponentMapping> {
    const input = routeScreenComponentMappingInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      const assessment = this.assessSubjects(input, dependencies)
      this.requireValidCandidate(input, assessment)
      if (await this.readCurrent(initiative.id)) throw new Error("An Initiative can have only one current Route, Screen, and Component Mapping candidate")
      const now = new Date().toISOString()
      const record = routeScreenComponentMappingSchema.parse({
        schemaVersion: 1, kind: "route-screen-component-mapping-candidate", id: randomUUID(),
        productId: product.id, ...input, initiativeId: initiative.id, revision: 1,
        ...this.composeDigests(input), state: "candidate",
        createdBy: { kind: "human", id: actorId }, updatedBy: { kind: "human", id: actorId },
        createdAt: now, updatedAt: now, authorityBoundary,
      })
      await this.commitVersionedRecord(record, assessment, "route-screen-component-mapping.created", actorId)
      return record
    })
  }

  async revise(id: string, expectedRevision: number, inputValue: RouteScreenComponentMappingInput, actorId: string): Promise<RouteScreenComponentMapping> {
    const input = routeScreenComponentMappingInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Route, Screen, and Component Mapping revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Route, Screen, and Component Mapping Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const dependencies = await this.requireExactDependencies(input)
      const assessment = this.assessSubjects(input, dependencies)
      this.requireValidCandidate(input, assessment)
      const record = routeScreenComponentMappingSchema.parse({
        ...current, ...input, productId: product.id, initiativeId: initiative.id,
        revision: current.revision + 1, ...this.composeDigests(input), predecessorDigest: canonicalDigest(current),
        updatedBy: { kind: "human", id: actorId }, updatedAt: new Date().toISOString(),
      })
      await this.commitVersionedRecord(record, assessment, "route-screen-component-mapping.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<RouteScreenComponentMapping> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Route, Screen, and Component Mapping ID")), routeScreenComponentMappingSchema)
  }

  async readCurrent(initiativeId: string): Promise<RouteScreenComponentMapping | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const matches = (await this.listRecords("route-screen-component-mappings", currentRecordPattern, routeScreenComponentMappingSchema))
      .filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Route, Screen, and Component Mapping candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<RouteScreenComponentMapping> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Route, Screen, and Component Mapping history revision must be a positive integer")
    const recordId = this.requireUuid(id, "Route, Screen, and Component Mapping ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), routeScreenComponentMappingSchema)
    if (record.id !== recordId || record.revision !== revision) throw new Error("Route, Screen, and Component Mapping history identity or revision does not match")
    return record
  }

  async listHistory(id: string): Promise<RouteScreenComponentMapping[]> {
    const recordId = this.requireUuid(id, "Route, Screen, and Component Mapping ID")
    const records = await this.listRecords(
      "route-screen-component-mapping-history",
      new RegExp(`^route-screen-component-mapping-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      routeScreenComponentMappingSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Route, Screen, and Component Mapping history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<RouteScreenComponentMappingStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, ...records] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.readCurrent(targetId), ...this.readDependencies(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const dependencies = this.toDependencies(records)
    const dependencyNames: (keyof ExactDependencies)[] = [
      "informationArchitecture", "screenStateInventory", "designRequirements", "designBaseline",
      "designToRequirementBinding", "figmaToBoilerplateMapping", "designToCodeBindingRegistry",
      "implementationUnitModel", "acceptanceCriteria",
    ]
    const staleBindingCount = candidate && canonicalDigest(candidate.context) !== canonicalDigest(this.exactContext(product, initiative)) ? 1 : 0
    const staleDependencyCount = candidate ? dependencyNames.filter((name) => !sameReference(candidate[name], dependencies?.[name])).length : 0
    const assessment = candidate && dependencies ? this.assessSubjects(candidate, dependencies) : this.emptyAssessment(dependencies)
    let invalidCandidateCount = 0
    if (candidate) {
      const digests = this.composeDigests(candidate)
      if (candidate.subjectCatalogDigest !== digests.subjectCatalogDigest ||
          candidate.relationshipCatalogDigest !== digests.relationshipCatalogDigest ||
          candidate.traceReceiptDigest !== digests.traceReceiptDigest ||
          candidate.mappingReceiptDigest !== digests.mappingReceiptDigest ||
          candidate.assessmentReceiptDigest !== digests.assessmentReceiptDigest) invalidCandidateCount = 1
    }
    const subjects = candidate?.subjects ?? []
    const relationships = candidate?.relationships ?? []
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Route, Screen, and Component Mapping candidate exists for this Initiative")
    if (staleBindingCount) reasons.push("The mapping candidate does not bind the exact current Product and Initiative")
    if (staleDependencyCount) reasons.push(`The mapping candidate has ${staleDependencyCount} stale or missing exact governed dependencies`)
    if (assessment.missingSubjectCount) reasons.push("One or more current route, screen, state, or component sources lack a mapping subject")
    if (assessment.extraSubjectCount) reasons.push("One or more mapping subjects do not belong to the current governed source catalogs")
    if (assessment.invalidSubjectCount) reasons.push("One or more mapping subjects do not match their exact governed source kind and identity")
    if (assessment.missingRelationshipCount) reasons.push("One or more exact route-screen, screen-state, transition, or fallback relationships are missing")
    if (assessment.invalidRelationshipCount) reasons.push("One or more mapping relationships are duplicated, invalid, or cross an undeclared source boundary")
    if (assessment.traceGapCount) reasons.push("One or more mapping subjects do not preserve exact route, screen, state, component, platform, Requirement, criterion, unit, or code-binding trace")
    if (assessment.evidenceGapCount) reasons.push("One or more mapped subjects lack exact evidence or human attribution")
    if (assessment.componentPlacementGapCount) reasons.push("One or more component subjects lack a candidate screen or state placement relationship")
    if (assessment.testHookGapCount) reasons.push("One or more mapping subjects lack a bounded candidate test hook")
    if (subjects.some((subject) => subject.disposition !== "candidate-mapped")) reasons.push("One or more source subjects are conflicted, unmapped, or not assessed")
    if (relationships.some((relationship) => relationship.state !== "candidate-defined")) reasons.push("One or more mapping relationships are conflicted or not assessed")
    if (invalidCandidateCount) reasons.push("The Route, Screen, and Component Mapping receipt digests are invalid")
    if (unresolvedQuestionCount) reasons.push("The candidate records unresolved Route, Screen, and Component Mapping questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return routeScreenComponentMappingStatusSchema.parse({
      schemaVersion: 1, kind: "route-screen-component-mapping-status", productId: product.id,
      productRevision: revisionOf(product), initiativeId: initiative.id, initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate), ...Object.fromEntries(dependencyNames.map((name) => [name, candidate[name]])) } : {}),
      ...this.sourceCounts(assessment), subjectCount: subjects.length, ...this.subjectCounts(subjects),
      relationshipCount: relationships.length, ...this.relationshipCounts(relationships),
      missingSubjectCount: assessment.missingSubjectCount, extraSubjectCount: assessment.extraSubjectCount,
      invalidSubjectCount: assessment.invalidSubjectCount, missingRelationshipCount: assessment.missingRelationshipCount,
      invalidRelationshipCount: assessment.invalidRelationshipCount, traceGapCount: assessment.traceGapCount,
      evidenceGapCount: assessment.evidenceGapCount, componentPlacementGapCount: assessment.componentPlacementGapCount,
      testHookGapCount: assessment.testHookGapCount, staleBindingCount, staleDependencyCount, invalidCandidateCount,
      unresolvedQuestionCount, reviewState, state: reasons.length === 0 ? "candidate-complete" : "attention-required",
      reasons, assessedAt: new Date().toISOString(), authorityBoundary: statusAuthorityBoundary,
    })
  }

  async project(initiativeId: string): Promise<RouteScreenComponentMappingProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Route, Screen, and Component Mapping projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const, kind: "route-screen-component-mapping-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: { id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id, revision: candidate.revision, digest: canonicalDigest(candidate), state: candidate.state,
        subjectCatalogDigest: candidate.subjectCatalogDigest, relationshipCatalogDigest: candidate.relationshipCatalogDigest,
        traceReceiptDigest: candidate.traceReceiptDigest, mappingReceiptDigest: candidate.mappingReceiptDigest,
        assessmentReceiptDigest: candidate.assessmentReceiptDigest, subjectCount: candidate.subjects.length,
        ...this.subjectCounts(candidate.subjects), relationshipCount: candidate.relationships.length,
        definedRelationshipCount: candidate.relationships.filter((relationship) => relationship.state === "candidate-defined").length,
        reviewState: candidate.reviewState, updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt, privacyBoundary, authorityBoundary: projectionAuthorityBoundary,
    }
    return routeScreenComponentMappingProjectionSchema.parse({
      ...projectionWithoutDigest, snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("route-screen-component-mappings", currentRecordPattern, routeScreenComponentMappingSchema)
    for (const candidate of records) {
      try {
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Route, Screen, and Component Mapping candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.state === "attention-required") issues.push({
          code: "route-screen-component-mapping.review-required", severity: "warning",
          message: `Initiative ${candidate.initiativeId} has stale, incomplete, invalid, or unresolved Route, Screen, and Component Mapping candidates.`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "create-superseding-revision"],
        })
      } catch (error) {
        issues.push({
          code: "route-screen-component-mapping.invalid", severity: "error",
          message: `Route, Screen, and Component Mapping ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private assessSubjects(input: Pick<RouteScreenComponentMappingInput, "subjects" | "relationships" | "reviewState">, dependencies: ExactDependencies): MappingAssessment {
    const routes = dependencies.informationArchitecture.navigationRoutes
    const screens = dependencies.screenStateInventory.screens
    const states = dependencies.screenStateInventory.states
    const components = dependencies.designToCodeBindingRegistry.subjects.filter((subject) => subject.bindingKind === "component")
    const expectedKeys = new Set([
      ...routes.map((route) => `route:${route.key}`), ...screens.map((screen) => `screen:${screen.key}`),
      ...states.map((state) => `state:${state.key}`), ...components.map((component) => `component:${component.id}`),
    ])
    const subjectKey = (subject: MappingSubject) => subject.subjectKind === "component"
      ? `component:${subject.designToCodeBindingSubjectId ?? "missing"}` : `${subject.subjectKind}:${subject.sourceKey}`
    const subjectByKey = new Map(input.subjects.map((subject) => [subjectKey(subject), subject]))
    const subjectById = new Map(input.subjects.map((subject) => [subject.id, subject]))
    const screensByKey = new Map(screens.map((screen) => [screen.key, screen]))
    const statesByKey = new Map(states.map((state) => [state.key, state]))
    const routeCoverageByKey = new Map(dependencies.screenStateInventory.routeCoverage.map((coverage) => [coverage.routeKey, coverage]))
    const componentsById = new Map(components.map((component) => [component.id, component]))
    const unitIds = new Set(dependencies.implementationUnitModel.units.map((unit) => unit.id))
    const criterionById = new Map(dependencies.acceptanceCriteria.criteria.map((criterion) => [criterion.id, criterion]))
    const codeBindingIds = new Set(dependencies.designToCodeBindingRegistry.subjects.map((subject) => subject.id))
    const designBindingKeys = new Set(dependencies.designToCodeBindingRegistry.subjects.map((subject) => subject.designBindingKey))
    const requirementKeysFor = (targetKind: "routeKeys" | "screenKeys" | "stateKeys", key: string) => canonicalValues(
      dependencies.designRequirements.requirements
        .filter((requirement) => requirement.targets[targetKind].includes(key)).map((requirement) => requirement.key),
    )
    let invalidSubjectCount = 0
    let traceGapCount = 0
    let evidenceGapCount = 0
    let testHookGapCount = 0
    for (const [index, subject] of input.subjects.entries()) {
      const key = subjectKey(subject)
      if (subject.ordinal !== index + 1 || !expectedKeys.has(key)) invalidSubjectCount += 1
      let expectedRouteKeys: string[] | undefined
      let expectedScreenKeys: string[] | undefined
      let expectedStateKeys: string[] | undefined
      let expectedPlatformKeys: string[] | undefined
      let expectedRequirementKeys: string[] | undefined
      if (subject.subjectKind === "route") {
        const coverage = routeCoverageByKey.get(subject.sourceKey)
        expectedRouteKeys = [subject.sourceKey]
        expectedScreenKeys = coverage?.screenKeys ?? []
        expectedStateKeys = coverage?.stateKeys ?? []
        expectedPlatformKeys = canonicalValues((coverage?.screenKeys ?? []).flatMap((screenKey) => screensByKey.get(screenKey)?.platformKeys ?? []))
        expectedRequirementKeys = requirementKeysFor("routeKeys", subject.sourceKey)
        if (!routes.some((route) => route.key === subject.sourceKey) || coverage?.status !== "represented") invalidSubjectCount += 1
      } else if (subject.subjectKind === "screen") {
        const screen = screensByKey.get(subject.sourceKey)
        expectedRouteKeys = screen?.routeKeys ?? []
        expectedScreenKeys = [subject.sourceKey]
        expectedStateKeys = screen?.stateKeys ?? []
        expectedPlatformKeys = screen?.platformKeys ?? []
        expectedRequirementKeys = requirementKeysFor("screenKeys", subject.sourceKey)
        if (!screen) invalidSubjectCount += 1
      } else if (subject.subjectKind === "state") {
        const state = statesByKey.get(subject.sourceKey)
        expectedRouteKeys = state?.routeKeys ?? []
        expectedScreenKeys = state ? [state.screenKey] : []
        expectedStateKeys = [subject.sourceKey]
        expectedPlatformKeys = state?.platformKeys ?? []
        expectedRequirementKeys = requirementKeysFor("stateKeys", subject.sourceKey)
        if (!state) invalidSubjectCount += 1
      } else {
        const component = subject.designToCodeBindingSubjectId ? componentsById.get(subject.designToCodeBindingSubjectId) : undefined
        if (!component || subject.sourceKey !== component.designItemKey ||
            !sameList(subject.designBindingKeys, [component.designBindingKey]) ||
            !sameList(subject.requirementKeys, component.requirementKeys) ||
            !sameList(subject.implementationUnitIds, [component.implementationUnitId]) ||
            !sameList(subject.codeBindingSubjectIds, [component.id])) traceGapCount += 1
      }
      if (expectedRouteKeys &&
          (!sameList(subject.routeKeys, expectedRouteKeys) || !sameList(subject.screenKeys, expectedScreenKeys ?? []) ||
           !sameList(subject.stateKeys, expectedStateKeys ?? []) || !sameList(subject.platformKeys, expectedPlatformKeys ?? []) ||
           !sameList(subject.requirementKeys, expectedRequirementKeys ?? []))) traceGapCount += 1
      if (subject.implementationUnitIds.some((id) => !unitIds.has(id)) ||
          subject.acceptanceCriterionIds.some((id) => {
            const criterion = criterionById.get(id)
            return !criterion || !criterion.requirements.some((requirement) => subject.requirementKeys.includes(requirement.key))
          }) || subject.codeBindingSubjectIds.some((id) => !codeBindingIds.has(id)) ||
          subject.designBindingKeys.some((key) => !designBindingKeys.has(key))) traceGapCount += 1
      if (subject.disposition === "candidate-mapped" &&
          (subject.evidenceReferences.length === 0 || !subject.mappedBy || !subject.mappedAt)) evidenceGapCount += 1
      if (subject.testHookCandidates.length === 0) testHookGapCount += 1
    }

    const expectedRelationships = new Set<string>()
    for (const coverage of dependencies.screenStateInventory.routeCoverage.filter((value) => value.status === "represented")) {
      for (const screenKey of coverage.screenKeys) expectedRelationships.add(`route-to-screen:route:${coverage.routeKey}:screen:${screenKey}`)
    }
    for (const screen of screens) {
      for (const stateKey of screen.stateKeys) expectedRelationships.add(`screen-to-state:screen:${screen.key}:state:${stateKey}`)
    }
    for (const state of states) {
      for (const target of state.transitionStateKeys) expectedRelationships.add(`transition:state:${state.key}:state:${target}`)
      if (state.fallbackStateKey) expectedRelationships.add(`fallback:state:${state.key}:state:${state.fallbackStateKey}`)
    }
    const relationshipKeys = new Map<string, number>()
    let invalidRelationshipCount = 0
    for (const [index, relationship] of input.relationships.entries()) {
      const from = subjectById.get(relationship.fromSubjectId)
      const to = subjectById.get(relationship.toSubjectId)
      const key = from && to ? `${relationship.relationshipKind}:${subjectKey(from)}:${subjectKey(to)}` : "invalid"
      relationshipKeys.set(key, (relationshipKeys.get(key) ?? 0) + 1)
      if (relationship.ordinal !== index + 1 || !from || !to || !this.validRelationship(relationship, from, to, screensByKey, statesByKey, routeCoverageByKey) ||
          (relationshipKeys.get(key) ?? 0) > 1) invalidRelationshipCount += 1
    }
    const missingRelationshipCount = [...expectedRelationships].filter((key) => !relationshipKeys.has(key)).length
    const componentPlacementGapCount = input.subjects.filter((subject) => subject.subjectKind === "component" &&
      !input.relationships.some((relationship) => relationship.toSubjectId === subject.id &&
        (relationship.relationshipKind === "screen-to-component" || relationship.relationshipKind === "state-to-component"))).length
    return {
      sourceRouteCount: routes.length, sourceScreenCount: screens.length, sourceStateCount: states.length,
      sourceComponentCount: components.length,
      missingSubjectCount: [...expectedKeys].filter((key) => !subjectByKey.has(key)).length,
      extraSubjectCount: [...subjectByKey.keys()].filter((key) => !expectedKeys.has(key)).length,
      invalidSubjectCount, missingRelationshipCount, invalidRelationshipCount, traceGapCount,
      evidenceGapCount, componentPlacementGapCount, testHookGapCount,
    }
  }

  private validRelationship(
    relationship: MappingRelationship,
    from: MappingSubject,
    to: MappingSubject,
    screens: Map<string, ScreenStateInventory["screens"][number]>,
    states: Map<string, ScreenStateInventory["states"][number]>,
    routeCoverage: Map<string, ScreenStateInventory["routeCoverage"][number]>,
  ): boolean {
    if (relationship.relationshipKind === "route-to-screen") {
      return from.subjectKind === "route" && to.subjectKind === "screen" &&
        (routeCoverage.get(from.sourceKey)?.screenKeys.includes(to.sourceKey) ?? false)
    }
    if (relationship.relationshipKind === "screen-to-state") {
      return from.subjectKind === "screen" && to.subjectKind === "state" &&
        (screens.get(from.sourceKey)?.stateKeys.includes(to.sourceKey) ?? false)
    }
    if (relationship.relationshipKind === "transition") {
      return from.subjectKind === "state" && to.subjectKind === "state" &&
        (states.get(from.sourceKey)?.transitionStateKeys.includes(to.sourceKey) ?? false)
    }
    if (relationship.relationshipKind === "fallback") {
      return from.subjectKind === "state" && to.subjectKind === "state" &&
        states.get(from.sourceKey)?.fallbackStateKey === to.sourceKey
    }
    if (relationship.relationshipKind === "screen-to-component") {
      return from.subjectKind === "screen" && to.subjectKind === "component" && to.screenKeys.includes(from.sourceKey)
    }
    return from.subjectKind === "state" && to.subjectKind === "component" && to.stateKeys.includes(from.sourceKey)
  }

  private requireValidCandidate(input: RouteScreenComponentMappingInput, assessment: MappingAssessment): void {
    const incompleteSubjects = input.subjects.filter((subject) => subject.disposition !== "candidate-mapped").length
    const incompleteRelationships = input.relationships.filter((relationship) => relationship.state !== "candidate-defined").length
    const gaps = assessment.missingSubjectCount + assessment.extraSubjectCount + assessment.invalidSubjectCount +
      assessment.missingRelationshipCount + assessment.invalidRelationshipCount + assessment.traceGapCount +
      assessment.evidenceGapCount + assessment.componentPlacementGapCount + assessment.testHookGapCount +
      incompleteSubjects + incompleteRelationships
    if (input.reviewState === "ready-for-human-review" && gaps > 0) {
      throw new Error("Review-ready Route, Screen, and Component Mapping requires exact complete route, screen, state, component, platform, Requirement, criterion, unit, code-binding, test-hook, evidence, and relationship coverage")
    }
  }

  private emptyAssessment(dependencies: ExactDependencies | undefined): MappingAssessment {
    return {
      sourceRouteCount: dependencies?.informationArchitecture.navigationRoutes.length ?? 0,
      sourceScreenCount: dependencies?.screenStateInventory.screens.length ?? 0,
      sourceStateCount: dependencies?.screenStateInventory.states.length ?? 0,
      sourceComponentCount: dependencies?.designToCodeBindingRegistry.subjects.filter((subject) => subject.bindingKind === "component").length ?? 0,
      missingSubjectCount: 0, extraSubjectCount: 0, invalidSubjectCount: 0, missingRelationshipCount: 0,
      invalidRelationshipCount: 0, traceGapCount: 0, evidenceGapCount: 0, componentPlacementGapCount: 0, testHookGapCount: 0,
    }
  }

  private sourceCounts(assessment: MappingAssessment) {
    return { sourceRouteCount: assessment.sourceRouteCount, sourceScreenCount: assessment.sourceScreenCount,
      sourceStateCount: assessment.sourceStateCount, sourceComponentCount: assessment.sourceComponentCount }
  }

  private subjectCounts(subjects: RouteScreenComponentMappingInput["subjects"]) {
    return {
      routeSubjectCount: subjects.filter((subject) => subject.subjectKind === "route").length,
      screenSubjectCount: subjects.filter((subject) => subject.subjectKind === "screen").length,
      stateSubjectCount: subjects.filter((subject) => subject.subjectKind === "state").length,
      componentSubjectCount: subjects.filter((subject) => subject.subjectKind === "component").length,
      mappedCandidateCount: subjects.filter((subject) => subject.disposition === "candidate-mapped").length,
      conflictCandidateCount: subjects.filter((subject) => subject.disposition === "candidate-conflict").length,
      unmappedCandidateCount: subjects.filter((subject) => subject.disposition === "candidate-unmapped").length,
      notAssessedCount: subjects.filter((subject) => subject.disposition === "not-assessed").length,
    }
  }

  private relationshipCounts(relationships: RouteScreenComponentMappingInput["relationships"]) {
    return {
      definedRelationshipCount: relationships.filter((relationship) => relationship.state === "candidate-defined").length,
      conflictRelationshipCount: relationships.filter((relationship) => relationship.state === "candidate-conflict").length,
      notAssessedRelationshipCount: relationships.filter((relationship) => relationship.state === "not-assessed").length,
    }
  }

  private composeDigests(input: RouteScreenComponentMappingInput) {
    const subjectCatalogDigest = canonicalDigest(input.subjects.map((subject) => ({
      id: subject.id, ordinal: subject.ordinal, subjectKind: subject.subjectKind, sourceKey: subject.sourceKey,
      designToCodeBindingSubjectId: subject.designToCodeBindingSubjectId, disposition: subject.disposition,
    })))
    const relationshipCatalogDigest = canonicalDigest(input.relationships.map((relationship) => ({
      id: relationship.id, ordinal: relationship.ordinal, relationshipKind: relationship.relationshipKind,
      fromSubjectId: relationship.fromSubjectId, toSubjectId: relationship.toSubjectId, state: relationship.state,
    })))
    const traceReceiptDigest = canonicalDigest(input.subjects.map((subject) => ({
      subjectId: subject.id, routeKeys: subject.routeKeys, screenKeys: subject.screenKeys, stateKeys: subject.stateKeys,
      platformKeys: subject.platformKeys, responsiveTargetKeys: subject.responsiveTargetKeys,
      designBindingKeys: subject.designBindingKeys, requirementKeys: subject.requirementKeys,
      acceptanceCriterionIds: subject.acceptanceCriterionIds, implementationUnitIds: subject.implementationUnitIds,
      codeBindingSubjectIds: subject.codeBindingSubjectIds, testHookCandidates: subject.testHookCandidates,
      evidenceReferences: subject.evidenceReferences, conflictReferenceCandidates: subject.conflictReferenceCandidates,
    })))
    const mappingReceiptDigest = canonicalDigest({
      informationArchitecture: input.informationArchitecture, screenStateInventory: input.screenStateInventory,
      designRequirements: input.designRequirements, designBaseline: input.designBaseline,
      designToRequirementBinding: input.designToRequirementBinding,
      figmaToBoilerplateMapping: input.figmaToBoilerplateMapping,
      designToCodeBindingRegistry: input.designToCodeBindingRegistry,
      implementationUnitModel: input.implementationUnitModel, acceptanceCriteria: input.acceptanceCriteria,
      subjectCatalogDigest, relationshipCatalogDigest, traceReceiptDigest,
      subjectAttribution: input.subjects.map((subject) => ({ id: subject.id, mappedBy: subject.mappedBy, mappedAt: subject.mappedAt })),
      relationshipEvidence: input.relationships.map((relationship) => ({ id: relationship.id, evidenceReferences: relationship.evidenceReferences })),
    })
    const assessmentReceiptDigest = canonicalDigest({
      context: input.context, informationClassification: input.informationClassification,
      subjectCatalogDigest, relationshipCatalogDigest, traceReceiptDigest, mappingReceiptDigest,
      reviewState: input.reviewState, unresolvedQuestions: input.unresolvedQuestions, limitations: input.limitations,
      figmaConnectionState: input.figmaConnectionState, returnedFigmaContentState: input.returnedFigmaContentState,
      designValidityState: input.designValidityState, designApprovalState: input.designApprovalState,
      designBaselineDesignationState: input.designBaselineDesignationState,
      navigationTruthState: input.navigationTruthState,
      routeScreenComponentMappingTruthState: input.routeScreenComponentMappingTruthState,
      routeScreenComponentMappingCompletenessState: input.routeScreenComponentMappingCompletenessState,
      uiValidityState: input.uiValidityState, responsiveBehaviorTruthState: input.responsiveBehaviorTruthState,
      platformParityState: input.platformParityState, requirementSatisfactionState: input.requirementSatisfactionState,
      acceptanceCriteriaValidityState: input.acceptanceCriteriaValidityState,
      repositoryTruthState: input.repositoryTruthState, pathSymbolTruthState: input.pathSymbolTruthState,
      testCoverageState: input.testCoverageState, codeTargetMutationState: input.codeTargetMutationState,
      codeGenerationState: input.codeGenerationState, implementationReadinessState: input.implementationReadinessState,
      implementationCompletenessState: input.implementationCompletenessState,
      assignmentExecutionState: input.assignmentExecutionState, acceptanceDecisionState: input.acceptanceDecisionState,
      mergeReadinessState: input.mergeReadinessState, releaseReadinessState: input.releaseReadinessState,
      deploymentReadinessState: input.deploymentReadinessState, actionAuthorityState: input.actionAuthorityState,
    })
    return { subjectCatalogDigest, relationshipCatalogDigest, traceReceiptDigest, mappingReceiptDigest, assessmentReceiptDigest }
  }

  private readDependencies(initiativeId: string): Promise<unknown>[] {
    return [
      this.informationArchitecture.readCurrent(initiativeId), this.screenStateInventory.readCurrent(initiativeId),
      this.designRequirements.readCurrent(initiativeId), this.designBaseline.readCurrent(initiativeId),
      this.designToRequirementBinding.readCurrent(initiativeId), this.figmaToBoilerplateMapping.readCurrent(initiativeId),
      this.designToCodeBindingRegistry.readCurrent(initiativeId), this.implementationUnitModel.readCurrent(initiativeId),
      this.acceptanceCriteria.readCurrent(initiativeId),
    ]
  }

  private toDependencies(records: unknown[]): ExactDependencies | undefined {
    if (records.some((record) => !record)) return undefined
    const [informationArchitecture, screenStateInventory, designRequirements, designBaseline,
      designToRequirementBinding, figmaToBoilerplateMapping, designToCodeBindingRegistry,
      implementationUnitModel, acceptanceCriteria] = records
    return { informationArchitecture, screenStateInventory, designRequirements, designBaseline,
      designToRequirementBinding, figmaToBoilerplateMapping, designToCodeBindingRegistry,
      implementationUnitModel, acceptanceCriteria } as ExactDependencies
  }

  private async requireExactDependencies(input: RouteScreenComponentMappingInput): Promise<ExactDependencies> {
    const dependencies = this.toDependencies(await Promise.all(this.readDependencies(input.initiativeId)))
    if (!dependencies) throw new Error("Route, Screen, and Component Mapping requires all 9 current governed dependencies")
    const names: (keyof ExactDependencies)[] = [
      "informationArchitecture", "screenStateInventory", "designRequirements", "designBaseline",
      "designToRequirementBinding", "figmaToBoilerplateMapping", "designToCodeBindingRegistry",
      "implementationUnitModel", "acceptanceCriteria",
    ]
    for (const name of names) {
      if (!sameReference(input[name], dependencies[name])) {
        throw new Error(`Route, Screen, and Component Mapping must reference the exact current ${name} candidate`)
      }
    }
    return dependencies
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Route, Screen, and Component Mapping Initiative targets a different Product")
    if (canonicalDigest(binding) !== canonicalDigest(this.exactContext(product, initiative))) {
      throw new Error("Route, Screen, and Component Mapping must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private exactContext(product: Product, initiative: Initiative): BusinessContextBinding {
    return { productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative) }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID"))])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) throw new Error(`Terminal Initiative ${initiative.state} Route, Screen, and Component Mapping is immutable`)
    return { product, initiative }
  }

  private async commitVersionedRecord(record: RouteScreenComponentMapping, assessment: MappingAssessment, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [this.governed(this.currentPath(record.id), record, routeScreenComponentMappingSchema),
        this.governed(this.historyPath(record.id, record.revision), record, routeScreenComponentMappingSchema)],
      audit: {
        eventType, actor: { kind: "human", id: actorId }, subjectId: record.id,
        payload: {
          initiativeId: record.initiativeId, revision: record.revision, recordDigest: canonicalDigest(record),
          subjectCatalogDigest: record.subjectCatalogDigest, relationshipCatalogDigest: record.relationshipCatalogDigest,
          traceReceiptDigest: record.traceReceiptDigest, mappingReceiptDigest: record.mappingReceiptDigest,
          assessmentReceiptDigest: record.assessmentReceiptDigest, predecessorDigest: record.predecessorDigest,
          informationArchitecture: record.informationArchitecture, screenStateInventory: record.screenStateInventory,
          designRequirements: record.designRequirements, designBaseline: record.designBaseline,
          designToRequirementBinding: record.designToRequirementBinding,
          figmaToBoilerplateMapping: record.figmaToBoilerplateMapping,
          designToCodeBindingRegistry: record.designToCodeBindingRegistry,
          implementationUnitModel: record.implementationUnitModel, acceptanceCriteria: record.acceptanceCriteria,
          ...this.sourceCounts(assessment), subjectCount: record.subjects.length, ...this.subjectCounts(record.subjects),
          relationshipCount: record.relationships.length, ...this.relationshipCounts(record.relationships),
          missingSubjectCount: assessment.missingSubjectCount, extraSubjectCount: assessment.extraSubjectCount,
          invalidSubjectCount: assessment.invalidSubjectCount, missingRelationshipCount: assessment.missingRelationshipCount,
          invalidRelationshipCount: assessment.invalidRelationshipCount, traceGapCount: assessment.traceGapCount,
          evidenceGapCount: assessment.evidenceGapCount, componentPlacementGapCount: assessment.componentPlacementGapCount,
          testHookGapCount: assessment.testHookGapCount, reviewState: record.reviewState,
          figmaConnectionState: record.figmaConnectionState, returnedFigmaContentState: record.returnedFigmaContentState,
          designValidityState: record.designValidityState, designApprovalState: record.designApprovalState,
          designBaselineDesignationState: record.designBaselineDesignationState,
          navigationTruthState: record.navigationTruthState,
          routeScreenComponentMappingTruthState: record.routeScreenComponentMappingTruthState,
          routeScreenComponentMappingCompletenessState: record.routeScreenComponentMappingCompletenessState,
          uiValidityState: record.uiValidityState, responsiveBehaviorTruthState: record.responsiveBehaviorTruthState,
          platformParityState: record.platformParityState, requirementSatisfactionState: record.requirementSatisfactionState,
          acceptanceCriteriaValidityState: record.acceptanceCriteriaValidityState,
          repositoryTruthState: record.repositoryTruthState, pathSymbolTruthState: record.pathSymbolTruthState,
          testCoverageState: record.testCoverageState, codeTargetMutationState: record.codeTargetMutationState,
          codeGenerationState: record.codeGenerationState, implementationReadinessState: record.implementationReadinessState,
          implementationCompletenessState: record.implementationCompletenessState,
          assignmentExecutionState: record.assignmentExecutionState, acceptanceDecisionState: record.acceptanceDecisionState,
          mergeReadinessState: record.mergeReadinessState, releaseReadinessState: record.releaseReadinessState,
          deploymentReadinessState: record.deploymentReadinessState,
          actionAuthorityState: record.actionAuthorityState, authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string { return this.repository.resolve("route-screen-component-mappings", `${id}.json`) }
  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("route-screen-component-mapping-history", `route-screen-component-mapping-${id}-r${revision}.json`)
  }
  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> { return { path, value, schema, governed: true } }
  private requireUuid(value: string, label: string): string {
    const parsed = uuidSchema.safeParse(value); if (!parsed.success) throw new Error(`${label} must be a UUID`); return parsed.data
  }
  private async assertIntegrity(): Promise<void> {
    const integrity = await this.repository.verifyAudit(); if (!integrity.valid) throw new Error(integrity.error ?? "Audit integrity check failed")
  }
  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try { names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name)) }
    catch (error) { if (error instanceof Error && "code" in error && error.code === "ENOENT") return []; throw error }
    if (names.length > inventoryLimit) throw new Error(`Route, Screen, and Component Mapping directory ${directory} exceeds the safety limit`)
    const records = await Promise.all(names.map((name) => this.repository.readJson(this.repository.resolve(directory, name), schema)))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>; const rightRecord = right as Record<string, unknown>
      return `${String(leftRecord.id ?? "")}:${String(leftRecord.revision ?? "")}`.localeCompare(`${String(rightRecord.id ?? "")}:${String(rightRecord.revision ?? "")}`)
    })
  }
}
