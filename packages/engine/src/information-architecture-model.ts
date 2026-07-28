import { randomUUID } from "node:crypto"

import {
  exactSourceReferenceSchema,
  informationArchitectureModelInputSchema,
  informationArchitectureModelProjectionSchema,
  informationArchitectureModelSchema,
  informationArchitectureModelStatusSchema,
  type BusinessContextBinding,
  type DesignApplicability,
  type DesignPersonaRoleModel,
  type ExactSourceReference,
  type InformationArchitectureModel,
  type InformationArchitectureModelInput,
  type InformationArchitectureModelProjection,
  type InformationArchitectureModelStatus,
  type Initiative,
  type Product,
  type UserJourneyModel,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { DesignApplicabilityService } from "./design-applicability.js"
import type { DesignPersonaRoleModelService } from "./design-persona-role-model.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"
import type { UserJourneyModelService } from "./user-journey-model.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const materialDesignStatuses = new Set([
  "required", "recommended", "optional", "conditionally-required", "already-satisfied", "reused",
])
const weakEvidenceStates = new Set(["hypothesis", "disputed"])

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: InformationArchitectureModel) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: InformationArchitectureModelInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    designApplicability: input.designApplicability,
    designPersonaRoleModel: input.designPersonaRoleModel,
    userJourneyModel: input.userJourneyModel,
    contentNodes: input.contentNodes,
    navigationRoutes: input.navigationRoutes,
    scopeCoverage: input.scopeCoverage,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    findabilityValidationState: input.findabilityValidationState,
    comprehensionValidationState: input.comprehensionValidationState,
    accessibilityValidationState: input.accessibilityValidationState,
    designApprovalState: input.designApprovalState,
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

function designScopeKey(scope: DesignApplicability["scopes"][number]): string {
  return `${scope.scope.kind}.${scope.scope.id}`
}

function designWorkDisposition(scope: DesignApplicability["scopes"][number]): "material" | "not-applicable" | "unresolved" {
  const status = scope.decisions.find((decision) => decision.aspect === "design-work")?.status ?? "awaiting-human-decision"
  if (status === "not-applicable") return "not-applicable"
  if (materialDesignStatuses.has(status)) return "material"
  return "unresolved"
}

function touchpointIdentity(journeyKey: string, touchpointKey: string): string {
  return `${journeyKey}:${touchpointKey}`
}

export class InformationArchitectureModelService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly designApplicability: DesignApplicabilityService,
    private readonly designPersonaRoleModel: DesignPersonaRoleModelService,
    private readonly userJourneyModel: UserJourneyModelService,
  ) {}

  async create(inputValue: InformationArchitectureModelInput, actorId: string): Promise<InformationArchitectureModel> {
    const input = informationArchitectureModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const bindings = await this.requireCurrentBindings(input)
      this.validateLinks(input, bindings.applicability, bindings.personaRole, bindings.journeyModel)
      this.validateApplicabilityCoverage(input, bindings.applicability, bindings.journeyModel)
      await this.validateSourceReferences(input, initiative.id)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Information Architecture candidate")
      }
      const now = new Date().toISOString()
      const record = informationArchitectureModelSchema.parse({
        schemaVersion: 1,
        kind: "information-architecture-model-candidate",
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
          "information-architecture-is-candidate-guidance-and-does-not-prove-findability-comprehension-or-accessibility-validate-content-approve-design-grant-readiness-or-authorize-action",
      })
      await this.commitVersionedRecord(record, "information-architecture.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: InformationArchitectureModelInput,
    actorId: string,
  ): Promise<InformationArchitectureModel> {
    const input = informationArchitectureModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Information Architecture revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Information Architecture Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const bindings = await this.requireCurrentBindings(input)
      this.validateLinks(input, bindings.applicability, bindings.personaRole, bindings.journeyModel)
      this.validateApplicabilityCoverage(input, bindings.applicability, bindings.journeyModel)
      await this.validateSourceReferences(input, initiative.id)
      const record = informationArchitectureModelSchema.parse({
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
      await this.commitVersionedRecord(record, "information-architecture.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<InformationArchitectureModel> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "Information Architecture ID")), informationArchitectureModelSchema)
  }

  async readCurrent(initiativeId: string): Promise<InformationArchitectureModel | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("information-architecture-models", currentRecordPattern, informationArchitectureModelSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Information Architecture candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<InformationArchitectureModel> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Information Architecture history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Information Architecture ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), informationArchitectureModelSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Information Architecture history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<InformationArchitectureModel[]> {
    const recordId = this.requireUuid(id, "Information Architecture ID")
    const records = await this.listRecords(
      "information-architecture-model-history",
      new RegExp(`^information-architecture-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      informationArchitectureModelSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Information Architecture history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<InformationArchitectureModelStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, applicability, personaRole, journeyModel, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.designApplicability.readCurrent(targetId),
      this.designPersonaRoleModel.readCurrent(targetId),
      this.userJourneyModel.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const staleBindingCount = candidate
      ? this.bindingMismatchCount(candidate, product, initiative, applicability, personaRole, journeyModel)
      : 0
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(candidate).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const nodes = candidate?.contentNodes ?? []
    const routes = candidate?.navigationRoutes ?? []
    const scopeCoverage = candidate?.scopeCoverage ?? []
    const weakEvidenceNodeCount = nodes.filter((node) =>
      [node.evidence.structure, node.evidence.findability, node.evidence.comprehension]
        .some((state) => weakEvidenceStates.has(state))).length
    const weakEvidenceRouteCount = routes.filter((route) => weakEvidenceStates.has(route.evidenceState)).length
    const unresolvedScopeCount = scopeCoverage.filter((coverage) => coverage.status === "unresolved").length
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Information Architecture candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind the exact current Product, Initiative, Design Applicability, Design Persona and Role, or User Journey record")
    if (staleSourceReferenceCount > 0) reasons.push("One or more hierarchy, node, route, or coverage assertions reference a superseded Source revision")
    if (unresolvedScopeCount > 0) reasons.push("One or more Design Applicability scopes have unresolved Information Architecture coverage")
    if (weakEvidenceNodeCount > 0) reasons.push("One or more content nodes retain hypothetical or disputed structure, findability, or comprehension evidence")
    if (weakEvidenceRouteCount > 0) reasons.push("One or more navigation routes are hypotheses or remain disputed")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved Information Architecture questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return informationArchitectureModelStatusSchema.parse({
      schemaVersion: 1,
      kind: "information-architecture-model-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      nodeCount: nodes.length,
      rootNodeCount: nodes.filter((node) => node.parentKey === undefined).length,
      routeCount: routes.length,
      representedScopeCount: scopeCoverage.filter((coverage) => coverage.status === "represented").length,
      unresolvedScopeCount,
      weakEvidenceNodeCount,
      weakEvidenceRouteCount,
      staleBindingCount,
      staleSourceReferenceCount,
      unresolvedQuestionCount,
      reviewState,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "information-architecture-status-is-observational-and-does-not-prove-findability-comprehension-or-accessibility-validate-content-approve-design-grant-readiness-or-authorize-action",
    })
  }

  async project(initiativeId: string): Promise<InformationArchitectureModelProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Information Architecture projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "information-architecture-model-projection" as const,
      product: { id: product.id, revision: revisionOf(product), digest: canonicalDigest(product) },
      initiative: {
        id: initiative.id, revision: revisionOf(initiative), digest: canonicalDigest(initiative), state: initiative.state,
      },
      status,
      ...(candidate ? { candidate: {
        id: candidate.id,
        revision: candidate.revision,
        digest: canonicalDigest(candidate),
        membershipDigest: candidate.membershipDigest,
        state: candidate.state,
        nodeCount: candidate.contentNodes.length,
        rootNodeCount: candidate.contentNodes.filter((node) => node.parentKey === undefined).length,
        routeCount: candidate.navigationRoutes.length,
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-node-route-content-persona-source-or-personal-content-secrets-or-credentials" as const,
      authorityBoundary:
        "information-architecture-projection-is-read-only-and-does-not-prove-findability-comprehension-or-accessibility-validate-content-approve-design-grant-readiness-or-authorize-write-or-action" as const,
    }
    return informationArchitectureModelProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("information-architecture-models", currentRecordPattern, informationArchitectureModelSchema)
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) {
          throw new Error("Information Architecture membership digest is invalid")
        }
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Information Architecture candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "information-architecture.binding-review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale Information Architecture bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "information-architecture.invalid",
          severity: "error",
          message: `Information Architecture ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Information Architecture Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Information Architecture candidate must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async requireCurrentBindings(input: InformationArchitectureModelInput): Promise<{
    applicability: DesignApplicability
    personaRole: DesignPersonaRoleModel
    journeyModel: UserJourneyModel
  }> {
    const [applicability, personaRole, journeyModel] = await Promise.all([
      this.designApplicability.readCurrent(input.initiativeId),
      this.designPersonaRoleModel.readCurrent(input.initiativeId),
      this.userJourneyModel.readCurrent(input.initiativeId),
    ])
    if (!applicability) throw new Error("Information Architecture candidate requires current Design Applicability")
    if (!personaRole) throw new Error("Information Architecture candidate requires a current Design Persona and Role model")
    if (!journeyModel) throw new Error("Information Architecture candidate requires a current User Journey model")
    if (input.designApplicability.recordId !== applicability.id ||
        input.designApplicability.revision !== applicability.revision ||
        input.designApplicability.digest !== canonicalDigest(applicability) ||
        input.designApplicability.membershipDigest !== applicability.membershipDigest) {
      throw new Error("Information Architecture candidate must bind the exact current Design Applicability record and membership")
    }
    if (input.designPersonaRoleModel.recordId !== personaRole.id ||
        input.designPersonaRoleModel.revision !== personaRole.revision ||
        input.designPersonaRoleModel.digest !== canonicalDigest(personaRole) ||
        input.designPersonaRoleModel.membershipDigest !== personaRole.membershipDigest) {
      throw new Error("Information Architecture candidate must bind the exact current Design Persona and Role record and membership")
    }
    if (input.userJourneyModel.recordId !== journeyModel.id ||
        input.userJourneyModel.revision !== journeyModel.revision ||
        input.userJourneyModel.digest !== canonicalDigest(journeyModel) ||
        input.userJourneyModel.membershipDigest !== journeyModel.membershipDigest) {
      throw new Error("Information Architecture candidate must bind the exact current User Journey record and membership")
    }
    return { applicability, personaRole, journeyModel }
  }

  private validateLinks(
    input: InformationArchitectureModelInput,
    applicability: DesignApplicability,
    personaRole: DesignPersonaRoleModel,
    journeyModel: UserJourneyModel,
  ): void {
    const designScopeKeys = new Set(applicability.scopes.map(designScopeKey))
    const personaKeys = new Set(personaRole.personas.map((entry) => entry.key))
    const designRoleKeys = new Set(personaRole.designRoles.map((entry) => entry.key))
    const journeyByKey = new Map(journeyModel.journeys.map((entry) => [entry.key, entry]))
    const touchpoints = new Set(journeyModel.journeys.flatMap((journey) =>
      journey.touchpoints.map((touchpoint) => touchpointIdentity(journey.key, touchpoint.key))))
    for (const node of input.contentNodes) {
      if (node.designScopeKeys.some((key) => !designScopeKeys.has(key))) {
        throw new Error("Information Architecture nodes must reference exact current Design Applicability scope keys")
      }
      if (node.journeyKeys.some((key) => !journeyByKey.has(key))) {
        throw new Error("Information Architecture nodes must reference journeys in the exact current User Journey model")
      }
      if (node.touchpoints.some((entry) => !touchpoints.has(touchpointIdentity(entry.journeyKey, entry.touchpointKey)))) {
        throw new Error("Information Architecture nodes must reference touchpoints in the exact current User Journey model")
      }
      if (node.personaKeys.some((key) => !personaKeys.has(key))) {
        throw new Error("Information Architecture nodes must reference personas in the exact current Design Persona and Role model")
      }
      if (node.designRoleKeys.some((key) => !designRoleKeys.has(key))) {
        throw new Error("Information Architecture nodes must reference design roles in the exact current Design Persona and Role model")
      }
    }
    const routeByKey = new Map(input.navigationRoutes.map((route) => [route.key, route]))
    for (const route of input.navigationRoutes) {
      const journey = journeyByKey.get(route.journeyKey)
      const path = journey?.paths.find((entry) => entry.key === route.journeyPathKey)
      if (!journey || !path || path.kind !== route.kind) {
        throw new Error("Information Architecture routes must reference exact current User Journey paths with matching kinds")
      }
      if (route.personaKeys.some((key) => !personaKeys.has(key) || !journey.personaKeys.includes(key))) {
        throw new Error("Information Architecture routes must stay inside the exact journey and persona boundaries")
      }
      if (route.recoveryRouteKeys.some((key) => routeByKey.get(key)?.journeyKey !== route.journeyKey)) {
        throw new Error("Information Architecture recovery routes must stay inside one exact journey")
      }
    }
  }

  private validateApplicabilityCoverage(
    input: InformationArchitectureModelInput,
    applicability: DesignApplicability,
    journeyModel: UserJourneyModel,
  ): void {
    const expectedKeys = applicability.scopes.map(designScopeKey).sort((left, right) => left.localeCompare(right))
    const observedKeys = input.scopeCoverage.map((entry) => entry.designScopeKey)
    if (canonicalDigest(expectedKeys) !== canonicalDigest(observedKeys)) {
      throw new Error("Information Architecture scope coverage must include every exact current Design Applicability scope once")
    }
    const scopeByKey = new Map(applicability.scopes.map((scope) => [designScopeKey(scope), scope]))
    for (const coverage of input.scopeCoverage) {
      const scope = scopeByKey.get(coverage.designScopeKey)
      if (!scope) throw new Error("Information Architecture scope coverage references an unknown Design Applicability scope")
      const disposition = designWorkDisposition(scope)
      if (disposition === "material" && coverage.status !== "represented") {
        throw new Error("Applicable design work requires represented Information Architecture nodes and routes")
      }
      if (disposition === "not-applicable" && coverage.status !== "not-applicable") {
        throw new Error("Not-applicable design work requires an attributable not-applicable Information Architecture decision")
      }
      if (disposition === "unresolved" && coverage.status !== "unresolved") {
        throw new Error("Unresolved design work requires unresolved Information Architecture coverage")
      }
      if (coverage.status !== "represented") continue
      const routeKeys = new Set(coverage.routeKeys)
      const nodeKeys = new Set(coverage.nodeKeys)
      const journeys = journeyModel.journeys.filter((journey) => journey.designScopeKeys.includes(coverage.designScopeKey))
      for (const journey of journeys) {
        for (const path of journey.paths) {
          if (!input.navigationRoutes.some((route) => routeKeys.has(route.key) &&
              route.journeyKey === journey.key && route.journeyPathKey === path.key && route.kind === path.kind)) {
            throw new Error("Represented Information Architecture must route every exact current User Journey path")
          }
        }
        for (const touchpoint of journey.touchpoints) {
          if (!input.contentNodes.some((node) => nodeKeys.has(node.key) && node.touchpoints.some((reference) =>
            reference.journeyKey === journey.key && reference.touchpointKey === touchpoint.key))) {
            throw new Error("Represented Information Architecture must place every exact current User Journey touchpoint")
          }
        }
      }
    }
  }

  private bindingMismatchCount(
    input: InformationArchitectureModelInput,
    product: Product,
    initiative: Initiative,
    applicability: DesignApplicability | undefined,
    personaRole: DesignPersonaRoleModel | undefined,
    journeyModel: UserJourneyModel | undefined,
  ): number {
    let mismatches = 0
    const expectedContext = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(input.context) !== canonicalDigest(expectedContext)) mismatches += 1
    if (!applicability || input.designApplicability.recordId !== applicability.id ||
        input.designApplicability.revision !== applicability.revision ||
        input.designApplicability.digest !== canonicalDigest(applicability) ||
        input.designApplicability.membershipDigest !== applicability.membershipDigest) mismatches += 1
    if (!personaRole || input.designPersonaRoleModel.recordId !== personaRole.id ||
        input.designPersonaRoleModel.revision !== personaRole.revision ||
        input.designPersonaRoleModel.digest !== canonicalDigest(personaRole) ||
        input.designPersonaRoleModel.membershipDigest !== personaRole.membershipDigest) mismatches += 1
    if (!journeyModel || input.userJourneyModel.recordId !== journeyModel.id ||
        input.userJourneyModel.revision !== journeyModel.revision ||
        input.userJourneyModel.digest !== canonicalDigest(journeyModel) ||
        input.userJourneyModel.membershipDigest !== journeyModel.membershipDigest) mismatches += 1
    return mismatches
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Information Architecture Source reference identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Information Architecture guidance is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(
    record: InformationArchitectureModel,
    eventType: string,
    actorId: string,
  ): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, informationArchitectureModelSchema),
        this.governed(this.historyPath(record.id, record.revision), record, informationArchitectureModelSchema),
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
          designPersonaRoleModel: record.designPersonaRoleModel,
          userJourneyModel: record.userJourneyModel,
          nodeCount: record.contentNodes.length,
          rootNodeCount: record.contentNodes.filter((node) => node.parentKey === undefined).length,
          routeCount: record.navigationRoutes.length,
          nodeKindCounts: Object.fromEntries([...new Set(record.contentNodes.map((node) => node.kind))].sort()
            .map((kind) => [kind, record.contentNodes.filter((node) => node.kind === kind).length])),
          routeKindCounts: Object.fromEntries([...new Set(record.navigationRoutes.map((route) => route.kind))].sort()
            .map((kind) => [kind, record.navigationRoutes.filter((route) => route.kind === kind).length])),
          scopeCoverageStatusCounts: Object.fromEntries([...new Set(record.scopeCoverage.map((entry) => entry.status))]
            .sort().map((status) => [status, record.scopeCoverage.filter((entry) => entry.status === status).length])),
          reviewState: record.reviewState,
          findabilityValidationState: record.findabilityValidationState,
          comprehensionValidationState: record.comprehensionValidationState,
          accessibilityValidationState: record.accessibilityValidationState,
          designApprovalState: record.designApprovalState,
          implementationAuthorityState: record.implementationAuthorityState,
          readinessAuthorityState: "not-established",
          writeAuthorityState: "not-granted",
          actionAuthorityState: "not-granted",
          authorityBoundary: record.authorityBoundary,
        },
      },
    })
  }

  private currentPath(id: string): string {
    return this.repository.resolve("information-architecture-models", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("information-architecture-model-history", `information-architecture-${id}-r${revision}.json`)
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
    if (names.length > inventoryLimit) throw new Error(`Information Architecture directory ${directory} exceeds the safety limit`)
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
