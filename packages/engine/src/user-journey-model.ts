import { randomUUID } from "node:crypto"

import {
  exactSourceReferenceSchema,
  userJourneyModelInputSchema,
  userJourneyModelProjectionSchema,
  userJourneyModelSchema,
  userJourneyModelStatusSchema,
  type BusinessContextBinding,
  type DesignApplicability,
  type DesignPersonaRoleModel,
  type ExactSourceReference,
  type Initiative,
  type Product,
  type UserJourneyModel,
  type UserJourneyModelInput,
  type UserJourneyModelProjection,
  type UserJourneyModelStatus,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { DesignApplicabilityService } from "./design-applicability.js"
import type { DesignPersonaRoleModelService } from "./design-persona-role-model.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const materialDesignStatuses = new Set([
  "required", "recommended", "optional", "conditionally-required", "already-satisfied", "reused",
])

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: UserJourneyModel) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: UserJourneyModelInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    designApplicability: input.designApplicability,
    designPersonaRoleModel: input.designPersonaRoleModel,
    journeys: input.journeys,
    scopeCoverage: input.scopeCoverage,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    journeyValidationState: input.journeyValidationState,
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

export class UserJourneyModelService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly designApplicability: DesignApplicabilityService,
    private readonly designPersonaRoleModel: DesignPersonaRoleModelService,
  ) {}

  async create(inputValue: UserJourneyModelInput, actorId: string): Promise<UserJourneyModel> {
    const input = userJourneyModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const { applicability, personaRole } = await this.requireCurrentBindings(input)
      this.validateLinks(input, applicability, personaRole)
      this.validateApplicabilityCoverage(input, applicability)
      await this.validateSourceReferences(input, initiative.id)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current User Journey candidate")
      }
      const now = new Date().toISOString()
      const record = userJourneyModelSchema.parse({
        schemaVersion: 1,
        kind: "user-journey-model-candidate",
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
          "user-journey-model-is-candidate-guidance-and-does-not-prove-observed-behavior-validate-a-journey-approve-design-grant-readiness-or-authorize-action",
      })
      await this.commitVersionedRecord(record, "user-journey.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: UserJourneyModelInput,
    actorId: string,
  ): Promise<UserJourneyModel> {
    const input = userJourneyModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("User Journey revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("User Journey Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const { applicability, personaRole } = await this.requireCurrentBindings(input)
      this.validateLinks(input, applicability, personaRole)
      this.validateApplicabilityCoverage(input, applicability)
      await this.validateSourceReferences(input, initiative.id)
      const record = userJourneyModelSchema.parse({
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
      await this.commitVersionedRecord(record, "user-journey.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<UserJourneyModel> {
    return this.repository.readJson(this.currentPath(this.requireUuid(id, "User Journey ID")), userJourneyModelSchema)
  }

  async readCurrent(initiativeId: string): Promise<UserJourneyModel | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("user-journey-models", currentRecordPattern, userJourneyModelSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current User Journey candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<UserJourneyModel> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("User Journey history revision must be a positive integer")
    const recordId = this.requireUuid(id, "User Journey ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), userJourneyModelSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("User Journey history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<UserJourneyModel[]> {
    const recordId = this.requireUuid(id, "User Journey ID")
    const records = await this.listRecords(
      "user-journey-model-history",
      new RegExp(`^user-journey-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      userJourneyModelSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("User Journey history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<UserJourneyModelStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, applicability, personaRole, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.designApplicability.readCurrent(targetId),
      this.designPersonaRoleModel.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const staleBindingCount = candidate
      ? this.bindingMismatchCount(candidate, product, initiative, applicability, personaRole)
      : 0
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(candidate).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const journeys = candidate?.journeys ?? []
    const paths = journeys.flatMap((journey) => journey.paths)
    const scopeCoverage = candidate?.scopeCoverage ?? []
    const weakEvidencePathCount = paths.filter((path) =>
      path.evidenceState === "hypothesis" || path.evidenceState === "disputed").length
    const unresolvedScopeCount = scopeCoverage.filter((coverage) => coverage.status === "unresolved").length
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned User Journey candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind the exact current Product, Initiative, Design Applicability, or Design Persona and Role record")
    if (staleSourceReferenceCount > 0) reasons.push("One or more journey, touchpoint, path, or coverage assertions reference a superseded Source revision")
    if (unresolvedScopeCount > 0) reasons.push("One or more Design Applicability scopes have unresolved User Journey coverage")
    if (weakEvidencePathCount > 0) reasons.push("One or more journey paths are hypotheses or remain disputed")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved User Journey questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return userJourneyModelStatusSchema.parse({
      schemaVersion: 1,
      kind: "user-journey-model-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      journeyCount: journeys.length,
      touchpointCount: journeys.reduce((count, journey) => count + journey.touchpoints.length, 0),
      primaryPathCount: paths.filter((path) => path.kind === "primary").length,
      successPathCount: paths.filter((path) => path.kind === "success").length,
      failurePathCount: paths.filter((path) => path.kind === "failure").length,
      recoveryPathCount: paths.filter((path) => path.kind === "recovery").length,
      representedScopeCount: scopeCoverage.filter((coverage) => coverage.status === "represented").length,
      unresolvedScopeCount,
      weakEvidencePathCount,
      staleBindingCount,
      staleSourceReferenceCount,
      unresolvedQuestionCount,
      reviewState,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "user-journey-model-status-is-observational-and-does-not-prove-observed-behavior-validate-journeys-approve-design-grant-readiness-or-authorize-action",
    })
  }

  async project(initiativeId: string): Promise<UserJourneyModelProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("User Journey projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "user-journey-model-projection" as const,
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
        journeyCount: candidate.journeys.length,
        touchpointCount: candidate.journeys.reduce((count, journey) => count + journey.touchpoints.length, 0),
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-journey-step-touchpoint-persona-source-or-personal-content-secrets-or-credentials" as const,
      authorityBoundary:
        "user-journey-model-projection-is-read-only-and-does-not-prove-observed-behavior-validate-journeys-approve-design-grant-readiness-or-authorize-write-or-action" as const,
    }
    return userJourneyModelProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("user-journey-models", currentRecordPattern, userJourneyModelSchema)
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) {
          throw new Error("User Journey membership digest is invalid")
        }
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current User Journey candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "user-journey.binding-review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale User Journey bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "user-journey.invalid",
          severity: "error",
          message: `User Journey ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("User Journey Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("User Journey candidate must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async requireCurrentBindings(input: UserJourneyModelInput): Promise<{
    applicability: DesignApplicability
    personaRole: DesignPersonaRoleModel
  }> {
    const [applicability, personaRole] = await Promise.all([
      this.designApplicability.readCurrent(input.initiativeId),
      this.designPersonaRoleModel.readCurrent(input.initiativeId),
    ])
    if (!applicability) throw new Error("User Journey candidate requires current Design Applicability")
    if (!personaRole) throw new Error("User Journey candidate requires a current Design Persona and Role model")
    if (input.designApplicability.recordId !== applicability.id ||
        input.designApplicability.revision !== applicability.revision ||
        input.designApplicability.digest !== canonicalDigest(applicability) ||
        input.designApplicability.membershipDigest !== applicability.membershipDigest) {
      throw new Error("User Journey candidate must bind the exact current Design Applicability record and membership")
    }
    if (input.designPersonaRoleModel.recordId !== personaRole.id ||
        input.designPersonaRoleModel.revision !== personaRole.revision ||
        input.designPersonaRoleModel.digest !== canonicalDigest(personaRole) ||
        input.designPersonaRoleModel.membershipDigest !== personaRole.membershipDigest) {
      throw new Error("User Journey candidate must bind the exact current Design Persona and Role record and membership")
    }
    return { applicability, personaRole }
  }

  private validateLinks(
    input: UserJourneyModelInput,
    applicability: DesignApplicability,
    personaRole: DesignPersonaRoleModel,
  ): void {
    const designScopeKeys = new Set(applicability.scopes.map(designScopeKey))
    const personaKeys = new Set(personaRole.personas.map((entry) => entry.key))
    const designRoleKeys = new Set(personaRole.designRoles.map((entry) => entry.key))
    const participantCategories = new Set<string>(personaRole.personas.flatMap((entry) => entry.participantCategories))
    for (const journey of input.journeys) {
      if (journey.designScopeKeys.some((key) => !designScopeKeys.has(key))) {
        throw new Error("User Journeys must reference exact current Design Applicability scope keys")
      }
      if (journey.personaKeys.some((key) => !personaKeys.has(key))) {
        throw new Error("User Journeys must reference personas in the exact current Design Persona and Role model")
      }
      if (journey.designRoleKeys.some((key) => !designRoleKeys.has(key))) {
        throw new Error("User Journeys must reference design roles in the exact current Design Persona and Role model")
      }
      if (journey.participantCategories.some((category) => !participantCategories.has(category))) {
        throw new Error("User Journeys must reference represented participant categories in the exact current Design Persona and Role model")
      }
    }
  }

  private validateApplicabilityCoverage(input: UserJourneyModelInput, applicability: DesignApplicability): void {
    const expectedKeys = applicability.scopes.map(designScopeKey).sort((left, right) => left.localeCompare(right))
    const observedKeys = input.scopeCoverage.map((entry) => entry.designScopeKey)
    if (canonicalDigest(expectedKeys) !== canonicalDigest(observedKeys)) {
      throw new Error("User Journey scope coverage must include every exact current Design Applicability scope once")
    }
    const scopeByKey = new Map(applicability.scopes.map((scope) => [designScopeKey(scope), scope]))
    for (const coverage of input.scopeCoverage) {
      const scope = scopeByKey.get(coverage.designScopeKey)
      if (!scope) throw new Error("User Journey scope coverage references an unknown Design Applicability scope")
      const disposition = designWorkDisposition(scope)
      if (disposition === "material" && coverage.status !== "represented") {
        throw new Error("Applicable design work requires represented User Journey coverage with primary, success, failure, and recovery paths")
      }
      if (disposition === "not-applicable" && coverage.status !== "not-applicable") {
        throw new Error("Not-applicable design work requires an attributable not-applicable User Journey coverage decision")
      }
      if (disposition === "unresolved" && coverage.status !== "unresolved") {
        throw new Error("Unresolved design work requires unresolved User Journey coverage")
      }
    }
  }

  private bindingMismatchCount(
    input: UserJourneyModelInput,
    product: Product,
    initiative: Initiative,
    applicability: DesignApplicability | undefined,
    personaRole: DesignPersonaRoleModel | undefined,
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
    return mismatches
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("User Journey Source reference identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} User Journey guidance is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: UserJourneyModel, eventType: string, actorId: string): Promise<void> {
    const paths = record.journeys.flatMap((journey) => journey.paths)
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, userJourneyModelSchema),
        this.governed(this.historyPath(record.id, record.revision), record, userJourneyModelSchema),
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
          journeyCount: record.journeys.length,
          touchpointCount: record.journeys.reduce((count, journey) => count + journey.touchpoints.length, 0),
          pathKindCounts: Object.fromEntries([...new Set(paths.map((path) => path.kind))].sort()
            .map((kind) => [kind, paths.filter((path) => path.kind === kind).length])),
          scopeCoverageStatusCounts: Object.fromEntries([...new Set(record.scopeCoverage.map((entry) => entry.status))]
            .sort().map((status) => [status, record.scopeCoverage.filter((entry) => entry.status === status).length])),
          reviewState: record.reviewState,
          journeyValidationState: record.journeyValidationState,
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
    return this.repository.resolve("user-journey-models", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("user-journey-model-history", `user-journey-${id}-r${revision}.json`)
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
    if (names.length > inventoryLimit) throw new Error(`User Journey directory ${directory} exceeds the safety limit`)
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
