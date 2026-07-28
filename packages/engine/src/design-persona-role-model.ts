import { randomUUID } from "node:crypto"

import {
  designPersonaRoleModelInputSchema,
  designPersonaRoleModelProjectionSchema,
  designPersonaRoleModelSchema,
  designPersonaRoleModelStatusSchema,
  exactSourceReferenceSchema,
  type BusinessContextBinding,
  type DesignApplicability,
  type DesignPersonaRoleModel,
  type DesignPersonaRoleModelInput,
  type DesignPersonaRoleModelProjection,
  type DesignPersonaRoleModelStatus,
  type ExactSourceReference,
  type Initiative,
  type Product,
  type StakeholderModel,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { z, type ZodType } from "zod"

import type { BusinessUnderstandingService } from "./business-understanding.js"
import type { DesignApplicabilityService } from "./design-applicability.js"
import type { GaepRepository, MutationWrite } from "./repository.js"
import type { SourceGovernanceService } from "./source-governance.js"

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

const uuidSchema = z.string().uuid()
const currentRecordPattern = /^[0-9a-f-]+\.json$/i
const inventoryLimit = 10_000
const requiredEvaluationParticipantCategories = [
  "affected-contributor",
  "change-owner",
  "reviewer",
  "workspace-steward",
] as const
const materialDesignStatuses = new Set([
  "required",
  "recommended",
  "optional",
  "conditionally-required",
  "already-satisfied",
  "reused",
])

function revisionOf(record: { revision?: number }): number {
  return record.revision ?? 1
}

function exactReference(record: DesignPersonaRoleModel) {
  return { recordId: record.id, revision: record.revision, digest: canonicalDigest(record) }
}

function membership(input: DesignPersonaRoleModelInput) {
  return {
    initiativeId: input.initiativeId,
    context: input.context,
    informationClassification: input.informationClassification,
    title: input.title,
    stakeholderModel: input.stakeholderModel,
    designApplicability: input.designApplicability,
    personas: input.personas,
    participantCoverage: input.participantCoverage,
    designRoles: input.designRoles,
    roleCoverage: input.roleCoverage,
    contestability: input.contestability,
    unresolvedQuestions: input.unresolvedQuestions,
    limitations: input.limitations,
    reviewState: input.reviewState,
    personaValidationState: input.personaValidationState,
    roleAppointmentState: input.roleAppointmentState,
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

function designWorkDisposition(candidate: DesignApplicability): "material" | "not-applicable" | "unresolved" {
  const statuses = candidate.scopes.map((scope) =>
    scope.decisions.find((decision) => decision.aspect === "design-work")?.status ?? "awaiting-human-decision")
  if (statuses.every((status) => status === "not-applicable")) return "not-applicable"
  if (statuses.some((status) => materialDesignStatuses.has(status))) return "material"
  return "unresolved"
}

export class DesignPersonaRoleModelService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
    private readonly sourceGovernance: SourceGovernanceService,
    private readonly businessUnderstanding: BusinessUnderstandingService,
    private readonly designApplicability: DesignApplicabilityService,
  ) {}

  async create(inputValue: DesignPersonaRoleModelInput, actorId: string): Promise<DesignPersonaRoleModel> {
    const input = designPersonaRoleModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const { stakeholder, applicability } = await this.requireCurrentBindings(input)
      this.validateLinks(input, stakeholder, applicability)
      this.validateApplicabilityCoverage(input, applicability)
      await this.validateSourceReferences(input, initiative.id)
      if (await this.readCurrent(initiative.id)) {
        throw new Error("An Initiative can have only one current Design Persona and Role candidate")
      }
      const now = new Date().toISOString()
      const record = designPersonaRoleModelSchema.parse({
        schemaVersion: 1,
        kind: "design-persona-role-candidate",
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
          "design-persona-role-model-is-candidate-guidance-and-does-not-validate-a-persona-appoint-a-role-verify-competence-approve-design-grant-readiness-or-authorize-action",
      })
      await this.commitVersionedRecord(record, "design-persona-role.created", actorId)
      return record
    })
  }

  async revise(
    id: string,
    expectedRevision: number,
    inputValue: DesignPersonaRoleModelInput,
    actorId: string,
  ): Promise<DesignPersonaRoleModel> {
    const input = designPersonaRoleModelInputSchema.parse(inputValue)
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.read(id)
      if (current.revision !== expectedRevision) throw new Error("Design Persona and Role revision changed before update")
      if (current.initiativeId !== input.initiativeId) throw new Error("Design Persona and Role Initiative cannot change")
      const { product, initiative } = await this.requireMutableInitiative(input.initiativeId)
      this.validateContext(input.context, product, initiative)
      const { stakeholder, applicability } = await this.requireCurrentBindings(input)
      this.validateLinks(input, stakeholder, applicability)
      this.validateApplicabilityCoverage(input, applicability)
      await this.validateSourceReferences(input, initiative.id)
      const record = designPersonaRoleModelSchema.parse({
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
      await this.commitVersionedRecord(record, "design-persona-role.revised", actorId)
      return record
    })
  }

  async read(id: string): Promise<DesignPersonaRoleModel> {
    return this.repository.readJson(
      this.currentPath(this.requireUuid(id, "Design Persona and Role ID")),
      designPersonaRoleModelSchema,
    )
  }

  async readCurrent(initiativeId: string): Promise<DesignPersonaRoleModel | undefined> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const records = await this.listRecords("design-persona-role-models", currentRecordPattern, designPersonaRoleModelSchema)
    const matches = records.filter((record) => record.initiativeId === targetId)
    if (matches.length > 1) throw new Error("Initiative has more than one current Design Persona and Role candidate")
    return matches[0]
  }

  async readRevision(id: string, revision: number): Promise<DesignPersonaRoleModel> {
    if (!Number.isInteger(revision) || revision < 1) {
      throw new Error("Design Persona and Role history revision must be a positive integer")
    }
    const recordId = this.requireUuid(id, "Design Persona and Role ID")
    const record = await this.repository.readJson(this.historyPath(recordId, revision), designPersonaRoleModelSchema)
    if (record.id !== recordId || record.revision !== revision) {
      throw new Error("Design Persona and Role history identity or revision does not match")
    }
    return record
  }

  async listHistory(id: string): Promise<DesignPersonaRoleModel[]> {
    const recordId = this.requireUuid(id, "Design Persona and Role ID")
    const records = await this.listRecords(
      "design-persona-role-model-history",
      new RegExp(`^design-persona-role-${recordId}-r[1-9][0-9]*\\.json$`, "iu"),
      designPersonaRoleModelSchema,
    )
    const ascending = [...records].sort((left, right) => left.revision - right.revision)
    for (const [index, record] of ascending.entries()) {
      if (record.id !== recordId || record.revision !== index + 1 ||
          (index === 0 && record.predecessorDigest !== undefined) ||
          (index > 0 && record.predecessorDigest !== canonicalDigest(ascending[index - 1]))) {
        throw new Error("Design Persona and Role history is incomplete or has an invalid predecessor chain")
      }
    }
    return ascending.reverse()
  }

  async assess(initiativeId: string): Promise<DesignPersonaRoleModelStatus> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, candidate, stakeholder, applicability, currentSources] = await Promise.all([
      this.readProduct(),
      this.readInitiative(targetId),
      this.readCurrent(targetId),
      this.businessUnderstanding.readCurrentStakeholderModel(targetId),
      this.designApplicability.readCurrent(targetId),
      this.sourceGovernance.listSources(targetId),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    const staleBindingCount = candidate
      ? this.bindingMismatchCount(candidate, product, initiative, stakeholder, applicability)
      : 0
    const currentSourceById = new Map(currentSources.map((entry) => [entry.id, entry]))
    const staleSourceReferenceCount = uniqueExactSourceReferences(candidate).filter((reference) => {
      const current = currentSourceById.get(reference.sourceId)
      return !current || current.revision !== reference.sourceRevision ||
        canonicalDigest(current) !== reference.recordDigest || current.contentDigest !== reference.contentDigest
    }).length
    const participantCoverage = candidate?.participantCoverage ?? []
    const roleCoverage = candidate?.roleCoverage ?? []
    const personas = candidate?.personas ?? []
    const representedParticipantCategoryCount = participantCoverage.filter((entry) => entry.status === "represented").length
    const unresolvedParticipantCategoryCount = participantCoverage.filter((entry) => entry.status === "unresolved").length
    const representedRoleKindCount = roleCoverage.filter((entry) => entry.status === "represented").length
    const unresolvedRoleKindCount = roleCoverage.filter((entry) => entry.status === "unresolved").length
    const weakEvidencePersonaCount = personas.filter((persona) =>
      persona.evidenceState === "hypothesis" || persona.evidenceState === "disputed").length
    const humanReviewedPersonaCount = personas.filter((persona) => persona.evidenceState === "human-reviewed").length
    const unresolvedQuestionCount = candidate?.unresolvedQuestions.length ?? 0
    const reviewState = candidate?.reviewState ?? "draft"
    const reasons: string[] = []
    if (!candidate) reasons.push("No versioned Design Persona and Role candidate exists for this Initiative")
    if (staleBindingCount > 0) reasons.push("The candidate does not bind the exact current Product, Initiative, Stakeholder Model, or Design Applicability record")
    if (staleSourceReferenceCount > 0) reasons.push("One or more persona, coverage, or role assertions reference a superseded Source revision")
    if (unresolvedParticipantCategoryCount > 0) reasons.push("One or more required design participant categories remain unresolved")
    if (unresolvedRoleKindCount > 0) reasons.push("One or more design role kinds remain unresolved")
    if (weakEvidencePersonaCount > 0) reasons.push("One or more persona hypotheses lack evidence linkage or remain disputed")
    if (unresolvedQuestionCount > 0) reasons.push("The candidate records unresolved persona or design-role questions")
    if (candidate && reviewState !== "ready-for-human-review") reasons.push("The candidate is not marked ready for human review")
    return designPersonaRoleModelStatusSchema.parse({
      schemaVersion: 1,
      kind: "design-persona-role-status",
      productId: product.id,
      productRevision: revisionOf(product),
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      ...(candidate ? { candidate: exactReference(candidate) } : {}),
      personaCount: personas.length,
      designRoleCount: candidate?.designRoles.length ?? 0,
      representedParticipantCategoryCount,
      unresolvedParticipantCategoryCount,
      representedRoleKindCount,
      unresolvedRoleKindCount,
      weakEvidencePersonaCount,
      humanReviewedPersonaCount,
      staleBindingCount,
      staleSourceReferenceCount,
      unresolvedQuestionCount,
      reviewState,
      state: reasons.length === 0 ? "complete-for-review" : "attention-required",
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary:
        "design-persona-role-status-is-observational-and-does-not-validate-personas-appoint-roles-verify-competence-approve-design-grant-readiness-or-authorize-action",
    })
  }

  async project(initiativeId: string): Promise<DesignPersonaRoleModelProjection> {
    const targetId = this.requireUuid(initiativeId, "Initiative ID")
    const [product, initiative, status, candidate] = await Promise.all([
      this.readProduct(), this.readInitiative(targetId), this.assess(targetId), this.readCurrent(targetId),
    ])
    if (status.productId !== product.id || status.productRevision !== revisionOf(product) ||
        status.initiativeId !== initiative.id || status.initiativeRevision !== revisionOf(initiative)) {
      throw new Error("Design Persona and Role projection context changed while governed records were read")
    }
    const projectionWithoutDigest = {
      schemaVersion: 1 as const,
      kind: "design-persona-role-projection" as const,
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
        personaCount: candidate.personas.length,
        designRoleCount: candidate.designRoles.length,
        reviewState: candidate.reviewState,
        updatedAt: candidate.updatedAt,
      } } : {}),
      observedAt: status.assessedAt,
      privacyBoundary:
        "projection-contains-record-identities-counts-statuses-and-digests-only-not-persona-content-behaviors-constraints-source-content-personal-data-secrets-or-credentials" as const,
      authorityBoundary:
        "design-persona-role-projection-is-read-only-and-does-not-validate-personas-appoint-roles-verify-competence-approve-design-grant-readiness-or-authorize-write-or-action" as const,
    }
    return designPersonaRoleModelProjectionSchema.parse({
      ...projectionWithoutDigest,
      snapshotDigest: canonicalDigest(projectionWithoutDigest),
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const records = await this.listRecords("design-persona-role-models", currentRecordPattern, designPersonaRoleModelSchema)
    for (const candidate of records) {
      try {
        if (candidate.membershipDigest !== canonicalDigest(membership(candidate))) {
          throw new Error("Design Persona and Role membership digest is invalid")
        }
        const history = await this.listHistory(candidate.id)
        if (history.length !== candidate.revision || canonicalDigest(history[0]) !== canonicalDigest(candidate)) {
          throw new Error("Current Design Persona and Role candidate does not match its complete immutable history")
        }
        const status = await this.assess(candidate.initiativeId)
        if (status.staleBindingCount > 0 || status.staleSourceReferenceCount > 0) {
          issues.push({
            code: "design-persona-role.binding-review-required",
            severity: "warning",
            message: `Initiative ${candidate.initiativeId} has stale Design Persona and Role bindings.`,
            record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
            repairActions: ["inspect-read-only", "create-superseding-revision"],
          })
        }
      } catch (error) {
        issues.push({
          code: "design-persona-role.invalid",
          severity: "error",
          message: `Design Persona and Role ${candidate.id}: ${error instanceof Error ? error.message : "record validation failed"}`,
          record: { type: candidate.kind, id: candidate.id, revision: candidate.revision },
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    }
    return issues
  }

  private validateContext(binding: BusinessContextBinding, product: Product, initiative: Initiative): void {
    if (initiative.productId !== product.id) throw new Error("Design Persona and Role Initiative targets a different Product")
    const expected = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(binding) !== canonicalDigest(expected)) {
      throw new Error("Design Persona and Role candidate must bind the exact current Product and Initiative revisions and digests")
    }
  }

  private async requireCurrentBindings(input: DesignPersonaRoleModelInput): Promise<{
    stakeholder: StakeholderModel
    applicability: DesignApplicability
  }> {
    const [stakeholder, applicability] = await Promise.all([
      this.businessUnderstanding.readCurrentStakeholderModel(input.initiativeId),
      this.designApplicability.readCurrent(input.initiativeId),
    ])
    if (!stakeholder) throw new Error("Design Persona and Role candidate requires a current Stakeholder Model")
    if (!applicability) throw new Error("Design Persona and Role candidate requires current Design Applicability")
    if (input.stakeholderModel.recordId !== stakeholder.id || input.stakeholderModel.revision !== stakeholder.revision ||
        input.stakeholderModel.digest !== canonicalDigest(stakeholder)) {
      throw new Error("Design Persona and Role candidate must bind the exact current Stakeholder Model")
    }
    if (input.designApplicability.recordId !== applicability.id ||
        input.designApplicability.revision !== applicability.revision ||
        input.designApplicability.digest !== canonicalDigest(applicability) ||
        input.designApplicability.membershipDigest !== applicability.membershipDigest) {
      throw new Error("Design Persona and Role candidate must bind the exact current Design Applicability record and membership")
    }
    return { stakeholder, applicability }
  }

  private validateLinks(
    input: DesignPersonaRoleModelInput,
    stakeholder: StakeholderModel,
    applicability: DesignApplicability,
  ): void {
    const stakeholderKeys = new Set(stakeholder.stakeholders.map((entry) => entry.key))
    const referencedStakeholderKeys = new Set([
      ...input.personas.flatMap((persona) => persona.stakeholderKeys),
      ...input.designRoles.flatMap((role) => role.stakeholderKeys),
      input.contestability.ownerStakeholderKey,
    ])
    if ([...referencedStakeholderKeys].some((key) => !stakeholderKeys.has(key))) {
      throw new Error("Design personas, roles, and contestability must reference stakeholders in the exact current Stakeholder Model")
    }
    const scopeKeys = new Set(applicability.scopes.map(designScopeKey))
    const referencedScopeKeys = new Set([
      ...input.personas.flatMap((persona) => persona.designScopeKeys),
      ...input.designRoles.flatMap((role) => role.designScopeKeys),
    ])
    if ([...referencedScopeKeys].some((key) => !scopeKeys.has(key))) {
      throw new Error("Design personas and roles must reference exact current Design Applicability scope keys")
    }
  }

  private validateApplicabilityCoverage(input: DesignPersonaRoleModelInput, applicability: DesignApplicability): void {
    const disposition = designWorkDisposition(applicability)
    const participantCoverage = new Map(input.participantCoverage.map((entry) => [entry.category, entry.status]))
    const productDesignerCoverage = input.roleCoverage.find((entry) => entry.kind === "product-designer")?.status
    if (disposition === "material") {
      if (requiredEvaluationParticipantCategories.some((category) => participantCoverage.get(category) !== "represented")) {
        throw new Error("Applicable design work requires represented change-owner, reviewer, workspace-steward, and affected-contributor personas")
      }
      if (productDesignerCoverage !== "represented") {
        throw new Error("Applicable design work requires explicit Product Designer responsibilities")
      }
    } else if (disposition === "not-applicable") {
      if (productDesignerCoverage !== "not-applicable") {
        throw new Error("Not-applicable design work requires an attributable not-applicable Product Designer role decision")
      }
    } else if (productDesignerCoverage !== "unresolved") {
      throw new Error("Unresolved design work requires unresolved Product Designer role coverage")
    }
  }

  private bindingMismatchCount(
    input: DesignPersonaRoleModelInput,
    product: Product,
    initiative: Initiative,
    stakeholder: StakeholderModel | undefined,
    applicability: DesignApplicability | undefined,
  ): number {
    let mismatches = 0
    const expectedContext = {
      productRevision: revisionOf(product), productDigest: canonicalDigest(product),
      initiativeRevision: revisionOf(initiative), initiativeDigest: canonicalDigest(initiative),
    }
    if (canonicalDigest(input.context) !== canonicalDigest(expectedContext)) mismatches += 1
    if (!stakeholder || input.stakeholderModel.recordId !== stakeholder.id ||
        input.stakeholderModel.revision !== stakeholder.revision ||
        input.stakeholderModel.digest !== canonicalDigest(stakeholder)) mismatches += 1
    if (!applicability || input.designApplicability.recordId !== applicability.id ||
        input.designApplicability.revision !== applicability.revision ||
        input.designApplicability.digest !== canonicalDigest(applicability) ||
        input.designApplicability.membershipDigest !== applicability.membershipDigest) mismatches += 1
    return mismatches
  }

  private async validateSourceReferences(value: unknown, initiativeId: string): Promise<void> {
    for (const reference of uniqueExactSourceReferences(value)) {
      const history = await this.sourceGovernance.readSourceRevision(reference.sourceId, reference.sourceRevision)
      if (history.snapshot.initiativeId !== initiativeId || history.recordDigest !== reference.recordDigest ||
          history.snapshot.contentDigest !== reference.contentDigest) {
        throw new Error("Design Persona and Role Source reference identity, Initiative, revision, record digest, or content digest does not match")
      }
    }
  }

  private async requireMutableInitiative(initiativeId: string): Promise<{ product: Product; initiative: Initiative }> {
    const [product, initiative] = await Promise.all([
      this.readProduct(), this.readInitiative(this.requireUuid(initiativeId, "Initiative ID")),
    ])
    if (initiative.productId !== product.id) throw new Error("Initiative does not target the current Product")
    if (["completed", "cancelled"].includes(initiative.state)) {
      throw new Error(`Terminal Initiative ${initiative.state} Design Persona and Role guidance is immutable`)
    }
    return { product, initiative }
  }

  private async commitVersionedRecord(record: DesignPersonaRoleModel, eventType: string, actorId: string): Promise<void> {
    await this.repository.commitMutation({
      writes: [
        this.governed(this.currentPath(record.id), record, designPersonaRoleModelSchema),
        this.governed(this.historyPath(record.id, record.revision), record, designPersonaRoleModelSchema),
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
          stakeholderModel: record.stakeholderModel,
          designApplicability: record.designApplicability,
          personaCount: record.personas.length,
          designRoleCount: record.designRoles.length,
          participantCoverageStatusCounts: Object.fromEntries([...new Set(record.participantCoverage.map((entry) => entry.status))]
            .sort().map((status) => [status, record.participantCoverage.filter((entry) => entry.status === status).length])),
          roleCoverageStatusCounts: Object.fromEntries([...new Set(record.roleCoverage.map((entry) => entry.status))]
            .sort().map((status) => [status, record.roleCoverage.filter((entry) => entry.status === status).length])),
          personaEvidenceStateCounts: Object.fromEntries([...new Set(record.personas.map((persona) => persona.evidenceState))]
            .sort().map((status) => [status, record.personas.filter((persona) => persona.evidenceState === status).length])),
          reviewState: record.reviewState,
          personaValidationState: record.personaValidationState,
          roleAppointmentState: record.roleAppointmentState,
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
    return this.repository.resolve("design-persona-role-models", `${id}.json`)
  }

  private historyPath(id: string, revision: number): string {
    return this.repository.resolve("design-persona-role-model-history", `design-persona-role-${id}-r${revision}.json`)
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
    if (names.length > inventoryLimit) throw new Error(`Design Persona and Role directory ${directory} exceeds the safety limit`)
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
