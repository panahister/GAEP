import { randomUUID } from "node:crypto"
import { constants as fsConstants } from "node:fs"
import { open } from "node:fs/promises"
import { isAbsolute } from "node:path"

import {
  architectureRecordSchema,
  changeSchema,
  containsSecretShapedValue,
  contextPackSchema,
  decisionSchema,
  designReadinessReportSchema,
  evidenceRecordSchema,
  exactDomainRecordReferenceSchema,
  executionCharterSchema,
  handoffSchema,
  instructionPrivilegeGrantSchema,
  initiativeSchema,
  managedApplyDecisionReceiptSchema,
  managedRunEvidenceSchema,
  managedRunRecordSchema,
  managedRunResultSchema,
  productDesignDraftSchema,
  productDesignRevisionSchema,
  productDomainSearchResultSchema,
  productDomainRecordKindSchema,
  productExportBundleSchema,
  productExportManifestSchema,
  productImportPreviewSchema,
  productRevisionSchema,
  productRecordRevisionSchema,
  productSchema,
  productStudioSectionIds,
  requirementSchema,
  repositoryManifestSchema,
  runToolSelectionSchema,
  riskSchema,
  runSchema,
  sourceBaselineSchema,
  sourceProvenanceSchema,
  sourceRecordRevisionSchema,
  sourceRecordSchema,
  traceImpactSchema,
  traceLinkSchema,
  toolDefinitionSchema,
  workItemSchema,
  workflowPlanSchema,
  redactSecretShapedText,
  type ArchitectureRecord,
  type Change,
  type ContextPack,
  type Decision,
  type DesignField,
  type DesignReadinessReport,
  type EvidenceRecord,
  type ExactDomainRecordReference,
  type Initiative,
  type InstructionPrivilegeGrant,
  type ManagedRunRecord,
  type Product,
  type ProductDesignDraft,
  type ProductDesignRevision,
  type ProductDesignSectionId,
  type ProductDomainRecordKind,
  type ProductDomainSearchResult,
  type ProductExportBundle,
  type ProductImportPreview,
  type ProductRevision,
  type ProductRecordRevision,
  type Requirement,
  type Run,
  type RunToolSelection,
  type Risk,
  type SourceBaseline,
  type SourceRecordRevision,
  type TraceEndpoint,
  type TraceImpact,
  type TraceLink,
  type ToolDefinition,
  type WorkItem,
  type WorkflowPlan,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import {
  canonicalDigest as portableDesignDigest,
  importPortableDesignBundle,
  portableDesignImportResultSchema,
  type PortableDesignImportResult,
} from "@gaep/design-import"
import type { ZodType } from "zod"

import type { GaepRepository, MutationWrite } from "./repository.js"

const fieldDefinitions: Record<ProductDesignSectionId, ReadonlyArray<readonly [string, string]>> = {
  overview: [
    ["product-summary", "What is this Product and why does it need to exist?"],
  ],
  direction: [
    ["problem", "What durable problem is the Product intended to address?"],
    ["alternatives", "Which alternatives or non-product approaches were considered?"],
    ["principles", "Which principles guide Product tradeoffs?"],
    ["assumptions", "Which material assumptions still need validation?"],
    ["roadmap-hypotheses", "Which roadmap ideas remain hypotheses rather than commitments?"],
  ],
  "users-jobs": [
    ["users", "Who directly uses or experiences the Product?"],
    ["stakeholders", "Who is affected by or accountable for Product outcomes?"],
    ["jobs", "Which jobs and desired progress should the Product support?"],
  ],
  outcomes: [
    ["desired-outcomes", "Which observable outcomes should change?"],
    ["success-measures", "Which measures would support or challenge the outcome claim?"],
  ],
  scope: [
    ["constraints", "Which constraints bound the Product design?"],
    ["in-scope", "What is explicitly inside the Product boundary?"],
    ["exclusions", "What is explicitly outside the Product boundary?"],
    ["first-workflow", "What is the first complete user workflow?"],
    ["data-considerations", "Which data classes, flows, retention, and handling concerns apply?"],
    ["ai-considerations", "Where may AI participate, and which limitations or human checks apply?"],
  ],
  delivery: [
    ["initiative-strategy", "How will bounded Initiatives target the Product?"],
    ["change-strategy", "How will exact Changes bind baselines or genesis?"],
    ["work-item-strategy", "How will Work Items decompose Changes and prove completion?"],
  ],
  architecture: [
    ["architecture-direction", "Which architecture direction currently best supports the Product?"],
    ["boundaries", "Which components, interfaces, trust boundaries, and deployment boundaries matter?"],
  ],
  "risks-decisions": [
    ["material-risks", "Which cause-condition-consequence risks need treatment?"],
    ["open-decisions", "Which choices remain open, deferred, or disputed?"],
  ],
  trace: [
    ["trace-strategy", "Which intent, work, evidence, decision, and risk links are required?"],
  ],
  "agents-tools": [
    ["agent-boundaries", "Which agent and tool capabilities may assist without acquiring authority?"],
    ["tool-policy", "Which permissions, scopes, effects, and confirmation rules apply to tools?"],
  ],
  "runs-evidence": [
    ["run-strategy", "How will governed runs stop, recover, and remain distinguishable from outcome acceptance?"],
    ["evidence-strategy", "Which evidence is required and what will it not prove?"],
  ],
  readiness: [
    ["readiness-criteria", "Which criteria distinguish design completeness from implementation readiness?"],
    ["deferred-matters", "Which matters are intentionally deferred, why, and until what trigger?"],
  ],
}

const changeTransitions: Record<Change["state"], readonly Change["state"][]> = {
  proposed: ["planned", "cancelled"],
  planned: ["active", "blocked", "cancelled"],
  active: ["blocked", "completed", "cancelled"],
  blocked: ["planned", "active", "cancelled"],
  completed: [],
  cancelled: [],
}

const workItemTransitions: Record<WorkItem["state"], readonly WorkItem["state"][]> = {
  proposed: ["planned", "cancelled"],
  planned: ["ready", "blocked", "cancelled"],
  ready: ["in-progress", "blocked", "cancelled"],
  "in-progress": ["blocked", "completed", "cancelled"],
  blocked: ["planned", "ready", "in-progress", "cancelled"],
  completed: [],
  cancelled: [],
}

const requirementTransitions: Record<Requirement["state"], readonly Requirement["state"][]> = {
  proposed: ["accepted", "deferred", "rejected"],
  accepted: ["deferred", "satisfied", "rejected"],
  deferred: ["proposed", "accepted", "rejected"],
  satisfied: [],
  rejected: [],
}

const decisionTransitions: Record<Decision["state"], readonly Decision["state"][]> = {
  open: ["decided", "deferred", "superseded"],
  deferred: ["open", "decided", "superseded"],
  decided: ["superseded"],
  superseded: [],
}

const riskTransitions: Record<Risk["state"], readonly Risk["state"][]> = {
  open: ["treated", "accepted", "closed"],
  treated: ["open", "accepted", "closed"],
  accepted: ["closed"],
  closed: [],
}

const architectureTransitions: Record<ArchitectureRecord["state"], readonly ArchitectureRecord["state"][]> = {
  proposed: ["accepted", "deprecated", "superseded"],
  accepted: ["deprecated", "superseded"],
  deprecated: ["superseded"],
  superseded: [],
}

const workflowTransitions: Record<WorkflowPlan["state"], readonly WorkflowPlan["state"][]> = {
  draft: ["resolved", "blocked", "retired"],
  resolved: ["blocked", "retired"],
  blocked: ["draft", "retired"],
  retired: [],
}

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

type MutableChange = Pick<Change, "title" | "summary" | "baseline" | "state" | "effectEnvelope">
type NewChange = Omit<MutableChange, "state">
type MutableWorkItem = Pick<WorkItem,
  "title" | "objective" | "state" | "dependsOn" | "completionCriteria" | "evidenceCriteria" | "scope" | "owner"
>
type NewWorkItem = Omit<MutableWorkItem, "state">
type MutableRequirement = Pick<Requirement,
  "key" | "statement" | "rationale" | "priority" | "state" | "verificationCriteria" | "sourceRecords"
>
type NewRequirement = Omit<MutableRequirement, "state">
type MutableDecision = Pick<Decision,
  "question" | "options" | "recommendation" | "selectedOutcome" | "dissentAndUncertainty" | "affectedRecords" | "state"
>
type NewDecision = Omit<MutableDecision, "selectedOutcome" | "state">
type MutableRisk = Pick<Risk,
  "title" | "cause" | "condition" | "consequence" | "likelihood" | "impact" | "uncertainty" | "treatment" |
  "owner" | "reviewTriggers" | "residualRisk" | "evidence" | "state" | "acceptance"
>
type NewRisk = Omit<MutableRisk, "state" | "acceptance">
type MutableArchitecture = Pick<ArchitectureRecord,
  "recordType" | "title" | "description" | "rationale" | "assumptions" | "constraints" | "affectedRecords" | "state"
>
type NewArchitecture = Omit<MutableArchitecture, "state">
type MutableEvidence = Pick<EvidenceRecord,
  "subjects" | "origin" | "method" | "result" | "artifactDigest" | "limitations" | "verification" |
  "freshness" | "collectedAt" | "validUntil"
>

export type InstructionPrivilegeGrantInput = Pick<InstructionPrivilegeGrant,
  "source" | "sourceDigest" | "privilege" | "purpose" | "recipient" | "scope" | "authority" | "expiresAt"
>

export interface ContextPackInput {
  objective: ContextPack["objective"]
  recipient: ContextPack["recipient"]
  items: ContextPack["items"]
  omissions: ContextPack["omissions"]
  warnings: ContextPack["warnings"]
  conflicts: ContextPack["conflicts"]
  classificationCombinationRisk: string
  sufficiencyCriteria: string[]
  sufficiencyEvaluator: ContextPack["sufficiency"]["evaluator"]
  sufficiencyAssumptions: string[]
}

export interface WorkflowPlanInput {
  title: WorkflowPlan["title"]
  objective: WorkflowPlan["objective"]
  subject: WorkflowPlan["subject"]
  actor: WorkflowPlan["actor"]
  strategy?: WorkflowPlan["strategy"]
  contextPacks: WorkflowPlan["contextPacks"]
  toolDefinitions: WorkflowPlan["toolDefinitions"]
  steps: WorkflowPlan["steps"]
}

type MutableWorkflowPlan = WorkflowPlanInput & { state: WorkflowPlan["state"] }

export type ToolDefinitionInput = Pick<ToolDefinition,
  "definitionType" | "key" | "name" | "binding" | "purpose" | "inputContract" | "outputContract" |
  "allowedScopes" | "requiredPermissions" | "effectEnvelope" | "trust" | "limitations" | "enabled" | "policy"
>

export interface RunToolSelectionInput {
  runId: string
  tools: RunToolSelection["tools"]
  requestedEffects: RunToolSelection["requestedEffects"]
  requestedScopes: RunToolSelection["requestedScopes"]
  confirmedToolIds: RunToolSelection["confirmedToolIds"]
  workspaceTrusted: boolean
}

export interface ProductStudioSearchInput {
  query: string
  kinds?: ProductDomainRecordKind[]
  limit?: number
}

export interface ProductStudioRecordMap {
  "product-design-revision": ProductDesignRevision
  "product-revision": ProductRevision
  change: Change
  "work-item": WorkItem
  requirement: Requirement
  decision: Decision
  risk: Risk
  "architecture-record": ArchitectureRecord
  evidence: EvidenceRecord
  "trace-link": TraceLink
  "context-pack": ContextPack
  "workflow-plan": WorkflowPlan
  "tool-definition": ToolDefinition
  "instruction-privilege-grant": InstructionPrivilegeGrant
  "run-tool-selection": RunToolSelection
}

export interface ProductStudioPageInput {
  offset?: number
  limit?: number
}

export interface ProductStudioPage<T> {
  items: T[]
  offset: number
  limit: number
  total: number
  hasMore: boolean
}

export interface ProductExportDisclosureInput {
  reviewedRecordIds?: string[]
  actorId?: string
  reviewedAt?: string
}

export interface PortableDesignSnapshotImportInput {
  bundleRoot: string
  manifestPath?: string
  expectedProductId: string
  expectedProductRevision: number
}

const portableDesignCandidatePattern =
  /^portable-design-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/
const portableDesignCandidateCaseFoldedPattern =
  /^portable-design-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/i
const portableDesignCandidateLimit = 10_000
const portableDesignPageLimit = 200
const portableDesignExpectedChecks = [
  "manifest-strict-schema",
  "bundle-exact-inventory",
  "paths-contained-and-link-free",
  "sizes-and-digests-exact",
  "text-secret-scan-clear",
  "formats-passively-validated",
] as const
const portableDesignExpectedLimitations = [
  "Source ownership, review, and approval claims are preserved but not independently verified.",
  "Binary assets are signature-checked and digest-bound; they are not decoded or rendered by this importer.",
  "SVG is accepted only as passive, link-free content and is not rendered by this importer.",
  "Design-token values are normalized structurally; token semantics and references are not resolved by this importer.",
  "A successful import remains pending human review and does not establish a Design Baseline.",
] as const

export class ProductStudioService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
  ) {}

  async importPortableDesignSnapshot(
    input: PortableDesignSnapshotImportInput,
    actorId: string,
  ): Promise<PortableDesignImportResult> {
    this.assertAllowedKeys(
      input,
      ["bundleRoot", "manifestPath", "expectedProductId", "expectedProductRevision"],
      "Portable Design Snapshot import input",
    )
    const expectedProductId = this.requireUuid(input.expectedProductId, "Expected Product ID").toLowerCase()
    await this.assertIntegrity()
    const preflightProduct = await this.requireProductRevision(input.expectedProductRevision)
    if (preflightProduct.id.toLowerCase() !== expectedProductId) {
      throw new Error("Portable Design Snapshot expected Product identity does not match the current Product")
    }

    // Bundle validation performs bounded source I/O and intentionally runs without the repository lock.
    // The exact Product revision, Initiative membership, inventory bound, and collision set are rechecked
    // under the final atomic mutation boundary below.
    const imported = this.validatePortableDesignSnapshot(await importPortableDesignBundle({
      bundleRoot: input.bundleRoot,
      ...(input.manifestPath !== undefined ? { manifestPath: input.manifestPath } : {}),
    }))

    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const product = await this.requireProductRevision(input.expectedProductRevision)
      if (product.id.toLowerCase() !== expectedProductId || imported.productId.toLowerCase() !== product.id.toLowerCase()) {
        throw new Error("Portable Design Snapshot Product identity does not match the exact current Product")
      }
      await this.assertPortableDesignSnapshotMembership(imported, product)
      const names = await this.portableDesignCandidateNames(1)
      if (names.length >= portableDesignCandidateLimit) {
        throw new Error(`Portable Design Snapshot inventory reached the ${portableDesignCandidateLimit}-record safety limit`)
      }
      const filename = this.portableDesignSnapshotFilename(imported.bundleId)
      if (names.some((name) => name === filename)) {
        throw new Error("Portable Design Snapshot bundle identity already exists or collides by filename case")
      }
      const recordDigest = canonicalDigest(imported)
      await this.repository.commitMutation({
        writes: [this.governed(
          this.repository.resolve("candidates", filename),
          imported,
          portableDesignImportResultSchema,
        )],
        audit: {
          eventType: "product.design.snapshot.imported",
          actor: { kind: "human", id: actorId },
          subjectId: imported.bundleId,
          payload: {
            productId: product.id,
            productRevision: product.revision ?? 1,
            ...(imported.initiativeId ? { initiativeId: imported.initiativeId } : {}),
            governanceState: imported.governance.state,
            authorityBoundary: imported.governance.claimBoundary,
            snapshotDigest: imported.snapshotDigest,
            evidenceDigest: imported.evidence.evidenceDigest,
            recordDigest,
          },
        },
      })
      return imported
    })
  }

  async readPortableDesignSnapshot(bundleId: string): Promise<PortableDesignImportResult> {
    const id = this.requireUuid(bundleId, "Portable Design Snapshot bundle ID").toLowerCase()
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const record = this.validatePortableDesignSnapshot(await this.repository.readJson(
        this.repository.resolve("candidates", this.portableDesignSnapshotFilename(id)),
        portableDesignImportResultSchema,
      ))
      if (record.bundleId.toLowerCase() !== id) {
        throw new Error("Portable Design Snapshot filename does not bind its exact bundle identity")
      }
      const product = await this.readProduct()
      await this.assertPortableDesignSnapshotMembership(record, product)
      await this.assertIntegrity()
      return record
    })
  }

  async listPortableDesignSnapshots(
    input: ProductStudioPageInput = {},
  ): Promise<ProductStudioPage<PortableDesignImportResult>> {
    this.assertAllowedKeys(input, ["offset", "limit"], "Portable Design Snapshot list input")
    const offset = input.offset ?? 0
    const limit = input.limit ?? 100
    if (!Number.isInteger(offset) || offset < 0 || offset > portableDesignCandidateLimit) {
      throw new Error(`Portable Design Snapshot offset must be between 0 and ${portableDesignCandidateLimit}`)
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > portableDesignPageLimit) {
      throw new Error(`Portable Design Snapshot page limit must be between 1 and ${portableDesignPageLimit}`)
    }
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const names = await this.portableDesignCandidateNames()
      const selectedNames = names.slice(offset, offset + limit)
      const items = await Promise.all(selectedNames.map(async (name) => {
        const record = this.validatePortableDesignSnapshot(await this.repository.readJson(
          this.repository.resolve("candidates", name),
          portableDesignImportResultSchema,
        ))
        if (this.portableDesignSnapshotFilename(record.bundleId) !== name) {
          throw new Error("Portable Design Snapshot inventory filename does not bind its exact bundle identity")
        }
        return record
      }))
      const product = await this.readProduct()
      for (const record of items) await this.assertPortableDesignSnapshotMembership(record, product)
      await this.assertIntegrity()
      return {
        items,
        offset,
        limit,
        total: names.length,
        hasMore: offset + items.length < names.length,
      }
    })
  }

  async startOrResumeDesignDraft(expectedProductRevision: number): Promise<ProductDesignDraft> {
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const product = await this.requireProductRevision(expectedProductRevision)
      const path = this.designDraftPath(product.id)
      try {
        const existing = await this.repository.readJson(path, productDesignDraftSchema)
        if (existing.productId !== product.id) throw new Error("Design draft targets a different Product")
        if (existing.baseProductRevision !== expectedProductRevision) {
          throw new Error(
            `Design draft is based on Product revision ${existing.baseProductRevision}; explicit rebase is required`,
          )
        }
        return existing
      } catch (error) {
        if (!this.isMissing(error)) throw error
      }
      const now = new Date().toISOString()
      const draft = productDesignDraftSchema.parse({
        schemaVersion: 1,
        kind: "product-design-draft",
        id: randomUUID(),
        productId: product.id,
        revision: 1,
        baseProductRevision: expectedProductRevision,
        sections: Object.fromEntries(productStudioSectionIds.map((sectionId) => [sectionId, {
          sectionId,
          summary: "",
          fields: fieldDefinitions[sectionId].map(([key, question]): DesignField => ({
            key,
            question,
            value: "",
            state: "missing",
            provenance: [],
          })),
          gaps: [],
          conflicts: [],
          updatedAt: now,
        }])),
        createdAt: now,
        updatedAt: now,
      })
      return this.repository.writeLocalJson(path, draft, productDesignDraftSchema)
    })
  }

  async readDesignDraft(productId: string): Promise<ProductDesignDraft> {
    return this.repository.readJson(this.designDraftPath(this.requireUuid(productId, "Product ID")), productDesignDraftSchema)
  }

  async saveDesignDraft(input: {
    draftId: string
    sections: ProductDesignDraft["sections"]
    expectedDraftRevision: number
    expectedProductRevision: number
  }): Promise<ProductDesignDraft> {
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const product = await this.requireProductRevision(input.expectedProductRevision)
      const path = this.designDraftPath(product.id)
      const current = await this.repository.readJson(path, productDesignDraftSchema)
      if (current.id !== this.requireUuid(input.draftId, "Draft ID")) throw new Error("Design draft identity mismatch")
      this.assertExpectedRevision(current.revision, input.expectedDraftRevision, "Design draft")
      if (current.baseProductRevision !== input.expectedProductRevision) {
        throw new Error("Design draft base is stale; explicit rebase is required")
      }
      const now = new Date().toISOString()
      const normalizedSections = structuredClone(input.sections)
      for (const sectionId of productStudioSectionIds) {
        const incoming = normalizedSections[sectionId]
        const existing = current.sections[sectionId]
        const withoutTimestamp = <T extends { updatedAt: string }>(section: T) => {
          const { updatedAt: _updatedAt, ...content } = section
          return content
        }
        incoming.updatedAt = canonicalDigest(withoutTimestamp(incoming)) === canonicalDigest(withoutTimestamp(existing))
          ? existing.updatedAt
          : now
      }
      const updated = productDesignDraftSchema.parse({
        ...current,
        revision: current.revision + 1,
        sections: normalizedSections,
        updatedAt: now,
      })
      this.assertDesignSectionsIntegrity(updated.sections)
      if (canonicalDigest(current.sections) === canonicalDigest(updated.sections)) {
        throw new Error("Design draft has no material changes")
      }
      return this.repository.writeLocalJson(path, updated, productDesignDraftSchema)
    })
  }

  evaluateDesignReadiness(draft: ProductDesignDraft, evaluatedAt = new Date().toISOString()): DesignReadinessReport {
    const validated = productDesignDraftSchema.parse(draft)
    this.assertDesignSectionsIntegrity(validated.sections)
    const sections = productStudioSectionIds.map((sectionId) => {
      const section = validated.sections[sectionId]
      const fieldsByKey = new Map(section.fields.map((field) => [field.key, field]))
      const requiredKeys = fieldDefinitions[sectionId].map(([key]) => key)
      const missingFields = requiredKeys.filter((key) => !fieldsByKey.has(key) || fieldsByKey.get(key)?.state === "missing")
      const weakFields = section.fields.filter((field) => field.state === "weak").map((field) => field.key)
      const deferredFields = section.fields.filter((field) => field.state === "deferred").map((field) => field.key)
      const openConflictIds = section.conflicts.filter((conflict) => conflict.state === "open").map((conflict) => conflict.id)
      const acceptedConflictIds = section.conflicts.filter((conflict) => conflict.state === "accepted").map((conflict) => conflict.id)
      const blockerGapIds = section.gaps
        .filter((gap) => gap.severity === "blocker" && gap.state === "open")
        .map((gap) => gap.id)
      const state = openConflictIds.length > 0 || blockerGapIds.length > 0
        ? "conflicted"
        : missingFields.length > 0
          ? "missing"
            : weakFields.length > 0
              ? "weak"
            : deferredFields.length > 0 || acceptedConflictIds.length > 0
              ? "deferred"
              : "complete"
      return { sectionId, state, missingFields, weakFields, deferredFields, openConflictIds, acceptedConflictIds, blockerGapIds }
    })
    const blockingGapIds = sections.flatMap((section) => section.blockerGapIds)
    const openConflictIds = sections.flatMap((section) => section.openConflictIds)
    const deferredFieldCount = sections.reduce((total, section) => total + section.deferredFields.length, 0)
    const acceptedConflictCount = sections.reduce((total, section) => total + section.acceptedConflictIds.length, 0)
    const incomplete = sections.some((section) => ["missing", "weak", "conflicted"].includes(section.state))
    return designReadinessReportSchema.parse({
      schemaVersion: 1,
      productId: validated.productId,
      draftId: validated.id,
      draftRevision: validated.revision,
      status: incomplete ? "incomplete" : deferredFieldCount > 0 || acceptedConflictCount > 0 ? "ready-with-deferrals" : "ready",
      sections,
      blockingGapIds,
      openConflictIds,
      deferredFieldCount,
      acceptedConflictCount,
      evaluatedAt,
      claimBoundary: "design-readiness-is-not-implementation-approval",
    })
  }

  async createDesignRevision(input: {
    draftId: string
    expectedDraftRevision: number
    expectedProductRevision: number
  }, actorId: string): Promise<{ revision: ProductDesignRevision; product: Product }> {
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const product = await this.requireProductRevision(input.expectedProductRevision)
      const draftPath = this.designDraftPath(product.id)
      const draft = await this.repository.readJson(draftPath, productDesignDraftSchema)
      if (draft.id !== this.requireUuid(input.draftId, "Draft ID")) throw new Error("Design draft identity mismatch")
      this.assertExpectedRevision(draft.revision, input.expectedDraftRevision, "Design draft")
      if (draft.baseProductRevision !== input.expectedProductRevision) {
        throw new Error("Design draft base is stale; explicit rebase is required")
      }
      const previous = (await this.listDesignRevisions()).at(0)
      const snapshotDigest = canonicalDigest(draft.sections)
      if (previous?.snapshotDigest === snapshotDigest) throw new Error("Design revision has no material changes")
      const now = new Date().toISOString()
      const readiness = this.evaluateDesignReadiness(draft, now)
      this.assertAcceptedDesignConflicts(draft.sections, actorId)
      const nextProductRevision = (product.revision ?? 1) + 1
      const designRevision = productDesignRevisionSchema.parse({
        schemaVersion: 1,
        kind: "product-design-revision",
        id: randomUUID(),
        productId: product.id,
        revision: (previous?.revision ?? 0) + 1,
        productRevision: nextProductRevision,
        predecessorId: previous?.id,
        sourceDraftId: draft.id,
        sourceDraftRevision: draft.revision,
        sections: draft.sections,
        readiness,
        snapshotDigest,
        createdBy: { kind: "human", id: actorId },
        createdAt: now,
      })
      const designRevisionDigest = canonicalDigest(designRevision)
      const nextProduct = productSchema.parse({
        ...product,
        revision: nextProductRevision,
        currentDesign: {
          id: designRevision.id,
          revision: designRevision.revision,
          digest: designRevisionDigest,
        },
        updatedAt: now,
      })
      const history = productRevisionSchema.parse({
        schemaVersion: 1,
        kind: "product-revision",
        productId: product.id,
        revision: nextProduct.revision,
        product: nextProduct,
        source: { kind: "design-revision", id: designRevision.id },
        productDigest: canonicalDigest(nextProduct),
        recordedAt: now,
      })
      const synchronizedDraft = productDesignDraftSchema.parse({
        ...draft,
        revision: draft.revision + 1,
        baseProductRevision: nextProduct.revision,
        baseDesignRevisionId: designRevision.id,
        updatedAt: now,
      })
      await this.repository.commitMutation({
        writes: [
          this.governed(this.repository.resolve("product.json"), nextProduct, productRevisionSchema.shape.product),
          this.governed(
            this.repository.resolve("design-revisions", `${designRevision.id}.json`),
            designRevision,
            productDesignRevisionSchema,
          ),
          this.governed(
            this.repository.resolve("product-history", `product-${product.id}-r${nextProduct.revision}.json`),
            history,
            productRevisionSchema,
          ),
          { path: draftPath, value: synchronizedDraft, schema: productDesignDraftSchema, governed: false },
        ],
        audit: {
          eventType: "product.design.revision.created",
          actor: { kind: "human", id: actorId },
          subjectId: designRevision.id,
          payload: {
            productId: product.id,
            productRevision: nextProduct.revision,
            designRevision: designRevision.revision,
            readiness: readiness.status,
            snapshotDigest,
            recordDigest: canonicalDigest(designRevision),
          },
        },
      })
      return { revision: designRevision, product: nextProduct }
    })
  }

  async listDesignRevisions(): Promise<ProductDesignRevision[]> {
    return this.listRecords("design-revisions", /^[0-9a-f-]+\.json$/i, productDesignRevisionSchema)
  }

  async readDesignRevision(id: string): Promise<ProductDesignRevision> {
    return this.readRecord("design-revisions", id, productDesignRevisionSchema)
  }

  async listProductRevisions(): Promise<ProductRevision[]> {
    const product = await this.readProduct()
    const records = await this.listRecords(
      "product-history",
      new RegExp(`^product-${product.id}-r[1-9][0-9]*\\.json$`, "i"),
      productRevisionSchema,
    )
    return records.sort((left, right) => right.revision - left.revision)
  }

  async readProductRevision(revision: number): Promise<ProductRevision> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Product revision must be a positive integer")
    const product = await this.readProduct()
    return this.repository.readJson(
      this.repository.resolve("product-history", `product-${product.id}-r${revision}.json`),
      productRevisionSchema,
    )
  }

  async createChange(input: NewChange & { initiativeId: string }, expectedProductRevision: number, actorId: string): Promise<Change> {
    return this.repository.withLock(async () => {
      this.assertAllowedKeys(input, ["initiativeId", "title", "summary", "baseline", "effectEnvelope"], "Change input")
      await this.assertIntegrity()
      const product = await this.requireProductRevision(expectedProductRevision)
      const initiative = await this.readInitiative(this.requireUuid(input.initiativeId, "Initiative ID"))
      if (initiative.productId !== product.id) throw new Error("Change Initiative does not target this Product")
      if (["completed", "cancelled"].includes(initiative.state)) {
        throw new Error(`Cannot create a Change for terminal Initiative ${initiative.state}`)
      }
      await this.validateBaseline(input.baseline, product)
      const now = new Date().toISOString()
      const record = changeSchema.parse({
        schemaVersion: 1,
        kind: "change",
        id: randomUUID(),
        productId: product.id,
        revision: 1,
        ...input,
        initiativeId: initiative.id,
        state: "proposed",
        createdAt: now,
        updatedAt: now,
      })
      await this.commitRecord("changes", record, changeSchema, "change.created", actorId)
      return record
    })
  }

  async reviseChange(
    id: string,
    expectedRevision: number,
    patch: Partial<MutableChange>,
    actorId: string,
    transitionReason?: string,
  ): Promise<Change> {
    return this.repository.withLock(async () => {
      this.assertAllowedKeys(patch, ["title", "summary", "baseline", "state", "effectEnvelope"], "Change patch")
      await this.assertIntegrity()
      const current = await this.readChange(id)
      this.assertExpectedRevision(current.revision, expectedRevision, "Change")
      if (["completed", "cancelled"].includes(current.state)) {
        throw new Error(`Terminal Change ${current.state} records are immutable; create a superseding Change`)
      }
      if (patch.state && patch.state !== current.state && !changeTransitions[current.state].includes(patch.state)) {
        throw new Error(`Invalid Change transition from ${current.state} to ${patch.state}`)
      }
      if (patch.state && patch.state !== current.state) this.requireTransitionReason(transitionReason, "Change")
      if (patch.baseline && current.state !== "proposed" && canonicalDigest(patch.baseline) !== canonicalDigest(current.baseline)) {
        throw new Error("A Change baseline cannot be replaced after the proposed state")
      }
      const product = await this.readProduct()
      if (patch.baseline) await this.validateBaseline(patch.baseline, product)
      if (patch.state === "active") {
        const initiative = await this.readInitiative(current.initiativeId)
        if (initiative.state !== "active") throw new Error("A Change can become active only under an active Initiative")
      }
      if (patch.state === "completed") {
        const workItems = (await this.listWorkItems()).filter((item) => item.changeId === current.id)
        if (workItems.length === 0 || workItems.some((item) => item.state !== "completed")) {
          throw new Error("Change completion requires at least one completed Work Item and no cancelled or unfinished Work Items")
        }
      }
      const updated = changeSchema.parse({
        ...current,
        ...patch,
        schemaVersion: current.schemaVersion,
        kind: current.kind,
        id: current.id,
        productId: current.productId,
        initiativeId: current.initiativeId,
        createdAt: current.createdAt,
        revision: current.revision + 1,
        updatedAt: new Date().toISOString(),
      })
      this.assertMaterialChange(current, updated, "Change")
      await this.commitRecord("changes", updated, changeSchema, "change.revised", actorId, transitionReason)
      return updated
    })
  }

  async readChange(id: string): Promise<Change> { return this.readRecord("changes", id, changeSchema) }
  async listChanges(): Promise<Change[]> { return this.listRecords("changes", /^[0-9a-f-]+\.json$/i, changeSchema) }

  async createWorkItem(input: NewWorkItem & { changeId: string }, expectedProductRevision: number, actorId: string): Promise<WorkItem> {
    return this.repository.withLock(async () => {
      this.assertAllowedKeys(
        input,
        ["changeId", "title", "objective", "dependsOn", "completionCriteria", "evidenceCriteria", "scope", "owner"],
        "Work Item input",
      )
      await this.assertIntegrity()
      const product = await this.requireProductRevision(expectedProductRevision)
      const change = await this.readChange(input.changeId)
      if (change.productId !== product.id) throw new Error("Work Item Change does not target this Product")
      const now = new Date().toISOString()
      const record = workItemSchema.parse({
        schemaVersion: 1,
        kind: "work-item",
        id: randomUUID(),
        productId: product.id,
        revision: 1,
        ...input,
        changeId: change.id,
        state: "proposed",
        createdAt: now,
        updatedAt: now,
      })
      await this.validateWorkGraph(record)
      await this.commitRecord("work-items", record, workItemSchema, "work-item.created", actorId)
      return record
    })
  }

  async reviseWorkItem(
    id: string,
    expectedRevision: number,
    patch: Partial<MutableWorkItem>,
    actorId: string,
    transitionReason?: string,
  ): Promise<WorkItem> {
    return this.repository.withLock(async () => {
      this.assertAllowedKeys(
        patch,
        ["title", "objective", "state", "dependsOn", "completionCriteria", "evidenceCriteria", "scope", "owner"],
        "Work Item patch",
      )
      await this.assertIntegrity()
      const current = await this.readWorkItem(id)
      this.assertExpectedRevision(current.revision, expectedRevision, "Work Item")
      if (["completed", "cancelled"].includes(current.state)) {
        throw new Error(`Terminal Work Item ${current.state} records are immutable; create a superseding Work Item`)
      }
      if (patch.state && patch.state !== current.state && !workItemTransitions[current.state].includes(patch.state)) {
        throw new Error(`Invalid Work Item transition from ${current.state} to ${patch.state}`)
      }
      if (patch.state && patch.state !== current.state) this.requireTransitionReason(transitionReason, "Work Item")
      const updated = workItemSchema.parse({
        ...current,
        ...patch,
        schemaVersion: current.schemaVersion,
        kind: current.kind,
        id: current.id,
        productId: current.productId,
        changeId: current.changeId,
        createdAt: current.createdAt,
        revision: current.revision + 1,
        updatedAt: new Date().toISOString(),
      })
      await this.validateWorkGraph(updated)
      if (["ready", "in-progress", "completed"].includes(updated.state)) {
        const dependencies = await Promise.all(updated.dependsOn.map((dependency) => this.readWorkItem(dependency)))
        if (dependencies.some((dependency) => dependency.state !== "completed")) {
          throw new Error(`Work Item cannot become ${updated.state} before every dependency is completed`)
        }
      }
      this.assertMaterialChange(current, updated, "Work Item")
      await this.commitRecord("work-items", updated, workItemSchema, "work-item.revised", actorId, transitionReason)
      return updated
    })
  }

  async readWorkItem(id: string): Promise<WorkItem> { return this.readRecord("work-items", id, workItemSchema) }
  async listWorkItems(): Promise<WorkItem[]> { return this.listRecords("work-items", /^[0-9a-f-]+\.json$/i, workItemSchema) }

  async createRequirement(input: NewRequirement, expectedProductRevision: number, actorId: string): Promise<Requirement> {
    return this.repository.withLock(async () => {
      this.assertAllowedKeys(
        input,
        ["key", "statement", "rationale", "priority", "verificationCriteria", "sourceRecords"],
        "Requirement input",
      )
      await this.assertIntegrity()
      const product = await this.requireProductRevision(expectedProductRevision)
      if ((await this.listRequirements()).some((record) => record.key === input.key)) {
        throw new Error(`Requirement key ${input.key} already exists`)
      }
      await this.validateExactReferences(input.sourceRecords)
      const now = new Date().toISOString()
      const record = requirementSchema.parse({
        schemaVersion: 1,
        kind: "requirement",
        id: randomUUID(),
        productId: product.id,
        revision: 1,
        ...input,
        state: "proposed",
        createdAt: now,
        updatedAt: now,
      })
      await this.commitRecord("requirements", record, requirementSchema, "requirement.created", actorId)
      return record
    })
  }

  async reviseRequirement(
    id: string,
    expectedRevision: number,
    patch: Partial<MutableRequirement>,
    actorId: string,
    transitionReason?: string,
  ): Promise<Requirement> {
    return this.repository.withLock(async () => {
      this.assertAllowedKeys(
        patch,
        ["key", "statement", "rationale", "priority", "state", "verificationCriteria", "sourceRecords"],
        "Requirement patch",
      )
      await this.assertIntegrity()
      const current = await this.readRequirement(id)
      this.assertExpectedRevision(current.revision, expectedRevision, "Requirement")
      if (patch.state && patch.state !== current.state && !requirementTransitions[current.state].includes(patch.state)) {
        throw new Error(`Invalid Requirement transition from ${current.state} to ${patch.state}`)
      }
      if (patch.state && patch.state !== current.state) this.requireTransitionReason(transitionReason, "Requirement")
      if (patch.key && patch.key !== current.key) throw new Error("Requirement keys are immutable; create a superseding Requirement")
      if (["satisfied", "rejected"].includes(current.state)) {
        throw new Error(`Terminal Requirement ${current.state} records are immutable; create a superseding Requirement`)
      }
      if (patch.sourceRecords) await this.validateExactReferences(patch.sourceRecords)
      if (patch.key && patch.key !== current.key && (await this.listRequirements()).some((record) => record.key === patch.key)) {
        throw new Error(`Requirement key ${patch.key} already exists`)
      }
      const updated = requirementSchema.parse({
        ...current,
        ...patch,
        schemaVersion: current.schemaVersion,
        kind: current.kind,
        id: current.id,
        productId: current.productId,
        createdAt: current.createdAt,
        revision: current.revision + 1,
        updatedAt: new Date().toISOString(),
      })
      this.assertMaterialChange(current, updated, "Requirement")
      await this.commitRecord("requirements", updated, requirementSchema, "requirement.revised", actorId, transitionReason)
      return updated
    })
  }

  async readRequirement(id: string): Promise<Requirement> { return this.readRecord("requirements", id, requirementSchema) }
  async listRequirements(): Promise<Requirement[]> { return this.listRecords("requirements", /^[0-9a-f-]+\.json$/i, requirementSchema) }

  async createDecision(input: NewDecision, expectedProductRevision: number, actorId: string): Promise<Decision> {
    await this.validateExactReferences(input.affectedRecords)
    return this.createSimpleRecord("decisions", decisionSchema, {
      ...input,
      state: "open",
    }, expectedProductRevision, "decision.created", actorId)
  }

  async reviseDecision(
    id: string,
    expectedRevision: number,
    patch: Partial<MutableDecision>,
    actorId: string,
    transitionReason?: string,
  ): Promise<Decision> {
    this.assertAllowedKeys(
      patch,
      ["question", "options", "recommendation", "selectedOutcome", "dissentAndUncertainty", "affectedRecords", "state"],
      "Decision patch",
    )
    const current = await this.readDecision(id)
    if (current.state === "superseded") throw new Error("Superseded Decisions are immutable")
    if (patch.state && patch.state !== current.state) {
      this.assertStateTransition(current.state, patch.state, decisionTransitions, "Decision", transitionReason)
    }
    if (patch.selectedOutcome?.selectedBy.id !== undefined && patch.selectedOutcome.selectedBy.id !== actorId) {
      throw new Error("Decision outcome actor must match the local human mutation actor")
    }
    if (patch.affectedRecords) await this.validateExactReferences(patch.affectedRecords)
    return this.reviseSimpleRecord<Decision>(
      "decisions", id, expectedRevision, decisionSchema, patch, "decision.revised", actorId, transitionReason,
    )
  }

  async readDecision(id: string): Promise<Decision> { return this.readRecord("decisions", id, decisionSchema) }
  async listDecisions(): Promise<Decision[]> { return this.listRecords("decisions", /^[0-9a-f-]+\.json$/i, decisionSchema) }

  async createRisk(input: NewRisk, expectedProductRevision: number, actorId: string): Promise<Risk> {
    await this.validateExactReferences(input.evidence)
    return this.createSimpleRecord("risks", riskSchema, { ...input, state: "open" }, expectedProductRevision, "risk.created", actorId)
  }

  async reviseRisk(
    id: string,
    expectedRevision: number,
    patch: Partial<MutableRisk>,
    actorId: string,
    transitionReason?: string,
  ): Promise<Risk> {
    this.assertAllowedKeys(
      patch,
      [
        "title", "cause", "condition", "consequence", "likelihood", "impact", "uncertainty", "treatment",
        "owner", "reviewTriggers", "residualRisk", "evidence", "state", "acceptance",
      ],
      "Risk patch",
    )
    const current = await this.readRisk(id)
    if (current.state === "closed") throw new Error("Closed Risks are immutable")
    if (patch.state && patch.state !== current.state) {
      this.assertStateTransition(current.state, patch.state, riskTransitions, "Risk", transitionReason)
    }
    if (patch.acceptance?.acceptedBy.id !== undefined && patch.acceptance.acceptedBy.id !== actorId) {
      throw new Error("Risk acceptance actor must match the local human mutation actor")
    }
    if (patch.evidence) await this.validateExactReferences(patch.evidence)
    return this.reviseSimpleRecord<Risk>(
      "risks", id, expectedRevision, riskSchema, patch, "risk.revised", actorId, transitionReason,
    )
  }

  async readRisk(id: string): Promise<Risk> { return this.readRecord("risks", id, riskSchema) }
  async listRisks(): Promise<Risk[]> { return this.listRecords("risks", /^[0-9a-f-]+\.json$/i, riskSchema) }

  async createArchitectureRecord(
    input: NewArchitecture,
    expectedProductRevision: number,
    actorId: string,
  ): Promise<ArchitectureRecord> {
    await this.validateExactReferences(input.affectedRecords)
    return this.createSimpleRecord(
      "architecture",
      architectureRecordSchema,
      { ...input, state: "proposed" },
      expectedProductRevision,
      "architecture-record.created",
      actorId,
    )
  }

  async reviseArchitectureRecord(
    id: string,
    expectedRevision: number,
    patch: Partial<MutableArchitecture>,
    actorId: string,
    transitionReason?: string,
  ): Promise<ArchitectureRecord> {
    this.assertAllowedKeys(
      patch,
      ["recordType", "title", "description", "rationale", "assumptions", "constraints", "affectedRecords", "state"],
      "Architecture patch",
    )
    const current = await this.readArchitectureRecord(id)
    if (current.state === "superseded") throw new Error("Superseded Architecture records are immutable")
    if (patch.state && patch.state !== current.state) {
      this.assertStateTransition(current.state, patch.state, architectureTransitions, "Architecture", transitionReason)
    }
    if (patch.affectedRecords) await this.validateExactReferences(patch.affectedRecords)
    return this.reviseSimpleRecord<ArchitectureRecord>(
      "architecture",
      id,
      expectedRevision,
      architectureRecordSchema,
      patch,
      "architecture-record.revised",
      actorId,
      transitionReason,
    )
  }

  async readArchitectureRecord(id: string): Promise<ArchitectureRecord> {
    return this.readRecord("architecture", id, architectureRecordSchema)
  }
  async listArchitectureRecords(): Promise<ArchitectureRecord[]> {
    return this.listRecords("architecture", /^[0-9a-f-]+\.json$/i, architectureRecordSchema)
  }

  async createEvidence(input: MutableEvidence, expectedProductRevision: number, actorId: string): Promise<EvidenceRecord> {
    return this.repository.withLock(async () => {
      this.assertNoReservedKeys(input as unknown as Record<string, unknown>, "Evidence input")
      await this.assertIntegrity()
      const product = await this.requireProductRevision(expectedProductRevision)
      await this.validateExactReferences(input.subjects)
      this.assertEvidenceFreshness(input)
      const now = new Date().toISOString()
      const record = evidenceRecordSchema.parse({
        schemaVersion: 1,
        kind: "evidence",
        id: randomUUID(),
        productId: product.id,
        revision: 1,
        ...input,
        createdAt: now,
        updatedAt: now,
      })
      await this.commitRecord("evidence", record, evidenceRecordSchema, "evidence.created", actorId)
      return record
    })
  }

  async reviseEvidence(id: string, expectedRevision: number, patch: Partial<MutableEvidence>, actorId: string): Promise<EvidenceRecord> {
    return this.repository.withLock(async () => {
      this.assertAllowedKeys(
        patch,
        [
          "subjects", "origin", "method", "result", "artifactDigest", "limitations", "verification",
          "freshness", "collectedAt", "validUntil",
        ],
        "Evidence patch",
      )
      await this.assertIntegrity()
      const current = await this.readEvidence(id)
      this.assertExpectedRevision(current.revision, expectedRevision, "Evidence")
      if (patch.subjects) await this.validateExactReferences(patch.subjects)
      const evidenceChanged = ["subjects", "origin", "method", "result", "artifactDigest", "limitations", "collectedAt", "validUntil"]
        .some((key) => Object.prototype.hasOwnProperty.call(patch, key))
      const normalizedPatch: Partial<MutableEvidence> = evidenceChanged && patch.verification === undefined
        ? {
            ...patch,
            verification: { status: "unverified" },
            freshness: {
              status: "unknown",
              assessedAt: new Date().toISOString(),
              basis: "Material Evidence content changed; freshness and verification require reassessment.",
            },
          }
        : patch
      this.assertEvidenceFreshness({ ...current, ...normalizedPatch })
      const updated = evidenceRecordSchema.parse({
        ...current,
        ...normalizedPatch,
        schemaVersion: current.schemaVersion,
        kind: current.kind,
        id: current.id,
        productId: current.productId,
        createdAt: current.createdAt,
        revision: current.revision + 1,
        updatedAt: new Date().toISOString(),
      })
      this.assertMaterialChange(current, updated, "Evidence")
      await this.commitRecord("evidence", updated, evidenceRecordSchema, "evidence.revised", actorId)
      return updated
    })
  }

  async readEvidence(id: string): Promise<EvidenceRecord> { return this.readRecord("evidence", id, evidenceRecordSchema) }
  async listEvidence(): Promise<EvidenceRecord[]> { return this.listRecords("evidence", /^[0-9a-f-]+\.json$/i, evidenceRecordSchema) }

  async createInstructionPrivilegeGrant(
    input: InstructionPrivilegeGrantInput,
    expectedProductRevision: number,
    actorId: string,
  ): Promise<InstructionPrivilegeGrant> {
    return this.repository.withLock(async () => {
      this.assertAllowedKeys(
        input,
        ["source", "sourceDigest", "privilege", "purpose", "recipient", "scope", "authority", "expiresAt"],
        "Instruction Privilege Grant input",
      )
      await this.assertIntegrity()
      const product = await this.requireProductRevision(expectedProductRevision)
      await this.validateInstructionAuthority(input.authority)
      const now = new Date().toISOString()
      const grant = instructionPrivilegeGrantSchema.parse({
        schemaVersion: 1,
        kind: "instruction-privilege-grant",
        id: randomUUID(),
        productId: product.id,
        revision: 1,
        ...input,
        state: "active",
        acceptedBy: { kind: "human", id: actorId },
        acceptedAt: now,
        authorityBoundary: "instruction-privilege-is-exact-source-purpose-recipient-and-scope",
        createdAt: now,
        updatedAt: now,
      })
      await this.commitRecord(
        "instruction-grants",
        grant,
        instructionPrivilegeGrantSchema,
        "instruction-privilege-grant.created",
        actorId,
      )
      return grant
    })
  }

  async revokeInstructionPrivilegeGrant(
    id: string,
    expectedRevision: number,
    reason: string,
    actorId: string,
  ): Promise<InstructionPrivilegeGrant> {
    if (reason.trim().length < 2) throw new Error("Instruction privilege revocation requires a reason")
    const current = await this.readInstructionPrivilegeGrant(id)
    if (current.state !== "active") throw new Error(`Instruction Privilege Grant is already ${current.state}`)
    return this.reviseSimpleRecord(
      "instruction-grants",
      id,
      expectedRevision,
      instructionPrivilegeGrantSchema,
      { state: "revoked", revocationReason: reason },
      "instruction-privilege-grant.revoked",
      actorId,
      reason,
    )
  }

  async readInstructionPrivilegeGrant(id: string): Promise<InstructionPrivilegeGrant> {
    return this.readRecord("instruction-grants", id, instructionPrivilegeGrantSchema)
  }

  async listInstructionPrivilegeGrants(): Promise<InstructionPrivilegeGrant[]> {
    return this.listRecords("instruction-grants", /^[0-9a-f-]+\.json$/i, instructionPrivilegeGrantSchema)
  }

  /**
   * Re-evaluate every transitive instruction privilege immediately before a
   * managed provider receives Context. Context Pack sufficiency is not an
   * authority cache: grants may expire, be revoked, or lose their exact
   * governing authority after the Pack was created.
   */
  async assertContextPackExecutionAuthority(pack: ContextPack, agentId: string): Promise<void> {
    const current = await this.readContextPack(pack.id)
    if (canonicalDigest(current) !== canonicalDigest(pack)) {
      throw new Error(`Context Pack ${pack.id} changed before managed execution`)
    }
    if (current.recipient.kind !== "agent" || current.recipient.id !== agentId) {
      throw new Error(`Context Pack ${pack.id} is not addressed to the exact selected Agent`)
    }
    await this.validateContextItems(current.items, current.recipient, current.objective)
  }

  redactContextContent(content: string): { text: string; redactions: number } {
    if (content.length > 1_000_000) throw new Error("Context redaction input exceeds the local safety limit")
    return redactSecretShapedText(content)
  }

  async createContextPack(input: ContextPackInput, expectedProductRevision: number, actorId: string): Promise<ContextPack> {
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const product = await this.requireProductRevision(expectedProductRevision)
      await this.validateContextItems(input.items, input.recipient, input.objective)
      const now = new Date().toISOString()
      const derived = this.deriveContextEvaluation(input)
      const body = {
        schemaVersion: 1 as const,
        kind: "context-pack" as const,
        id: randomUUID(),
        productId: product.id,
        revision: 1,
        objective: input.objective,
        recipient: input.recipient,
        items: input.items,
        omissions: input.omissions,
        warnings: input.warnings,
        conflicts: input.conflicts,
        classification: derived.classification,
        sufficiency: derived.sufficiency,
        authorityBoundary: "context-sufficiency-does-not-grant-authority" as const,
        createdAt: now,
        updatedAt: now,
      }
      const record = contextPackSchema.parse({ ...body, packDigest: this.contextPackDigest(body) })
      await this.commitRecord("context-packs", record, contextPackSchema, "context-pack.created", actorId)
      return record
    })
  }

  async reviseContextPack(
    id: string,
    expectedRevision: number,
    patch: Partial<ContextPackInput>,
    actorId: string,
  ): Promise<ContextPack> {
    return this.repository.withLock(async () => {
      this.assertAllowedKeys(
        patch,
        [
          "objective", "recipient", "items", "omissions", "warnings", "conflicts", "classificationCombinationRisk",
          "sufficiencyCriteria", "sufficiencyEvaluator", "sufficiencyAssumptions",
        ],
        "Context Pack patch",
      )
      await this.assertIntegrity()
      const current = await this.readContextPack(id)
      this.assertExpectedRevision(current.revision, expectedRevision, "Context Pack")
      const merged: ContextPackInput = {
        objective: patch.objective ?? current.objective,
        recipient: patch.recipient ?? current.recipient,
        items: patch.items ?? current.items,
        omissions: patch.omissions ?? current.omissions,
        warnings: patch.warnings ?? current.warnings,
        conflicts: patch.conflicts ?? current.conflicts,
        classificationCombinationRisk: patch.classificationCombinationRisk ?? current.classification.combinationRisk,
        sufficiencyCriteria: patch.sufficiencyCriteria ?? current.sufficiency.criteria,
        sufficiencyEvaluator: patch.sufficiencyEvaluator ?? current.sufficiency.evaluator,
        sufficiencyAssumptions: patch.sufficiencyAssumptions ?? current.sufficiency.assumptions,
      }
      await this.validateContextItems(merged.items, merged.recipient, merged.objective)
      const derived = this.deriveContextEvaluation(merged)
      const body = {
        ...current,
        objective: merged.objective,
        recipient: merged.recipient,
        items: merged.items,
        omissions: merged.omissions,
        warnings: merged.warnings,
        conflicts: merged.conflicts,
        classification: derived.classification,
        sufficiency: derived.sufficiency,
        revision: current.revision + 1,
        updatedAt: new Date().toISOString(),
      }
      const { packDigest: _oldDigest, ...digestBody } = body
      const updated = contextPackSchema.parse({ ...body, packDigest: this.contextPackDigest(digestBody) })
      this.assertMaterialChange(current, updated, "Context Pack")
      await this.commitRecord("context-packs", updated, contextPackSchema, "context-pack.revised", actorId)
      return updated
    })
  }

  async readContextPack(id: string): Promise<ContextPack> { return this.readRecord("context-packs", id, contextPackSchema) }
  async listContextPacks(): Promise<ContextPack[]> {
    return this.listRecords("context-packs", /^[0-9a-f-]+\.json$/i, contextPackSchema)
  }

  async createWorkflowPlan(
    input: WorkflowPlanInput,
    expectedProductRevision: number,
    actorId: string,
  ): Promise<WorkflowPlan> {
    return this.repository.withLock(async () => {
      this.assertAllowedKeys(
        input,
        ["title", "objective", "subject", "actor", "strategy", "contextPacks", "toolDefinitions", "steps"],
        "Workflow Plan input",
      )
      await this.assertIntegrity()
      const product = await this.requireProductRevision(expectedProductRevision)
      await this.validateWorkflow(input)
      const now = new Date().toISOString()
      const body = {
        schemaVersion: 1 as const,
        kind: "workflow-plan" as const,
        id: randomUUID(),
        productId: product.id,
        revision: 1,
        ...input,
        strategy: input.strategy ?? "sequential",
        state: "draft" as const,
        authorityBoundary: "workflow-plan-does-not-grant-authority" as const,
        createdAt: now,
        updatedAt: now,
      }
      const record = workflowPlanSchema.parse({ ...body, planDigest: this.workflowPlanDigest(body) })
      await this.commitRecord("workflow-plans", record, workflowPlanSchema, "workflow-plan.created", actorId)
      return record
    })
  }

  async reviseWorkflowPlan(
    id: string,
    expectedRevision: number,
    patch: Partial<MutableWorkflowPlan>,
    actorId: string,
    transitionReason?: string,
  ): Promise<WorkflowPlan> {
    return this.repository.withLock(async () => {
      this.assertAllowedKeys(
        patch,
        ["title", "objective", "subject", "actor", "strategy", "contextPacks", "toolDefinitions", "steps", "state"],
        "Workflow Plan patch",
      )
      await this.assertIntegrity()
      const current = await this.readWorkflowPlan(id)
      this.assertExpectedRevision(current.revision, expectedRevision, "Workflow Plan")
      if (current.state === "retired") throw new Error("Retired Workflow Plans are immutable")
      if (patch.state && patch.state !== current.state) {
        this.assertStateTransition(current.state, patch.state, workflowTransitions, "Workflow Plan", transitionReason)
      }
      const merged = {
        title: patch.title ?? current.title,
        objective: patch.objective ?? current.objective,
        subject: patch.subject ?? current.subject,
        actor: patch.actor ?? current.actor,
        strategy: patch.strategy ?? current.strategy,
        contextPacks: patch.contextPacks ?? current.contextPacks,
        toolDefinitions: patch.toolDefinitions ?? current.toolDefinitions,
        steps: patch.steps ?? current.steps,
      }
      await this.validateWorkflow(merged)
      const body = {
        ...current,
        ...merged,
        state: patch.state ?? current.state,
        revision: current.revision + 1,
        updatedAt: new Date().toISOString(),
      }
      const { planDigest: _oldDigest, ...digestBody } = body
      const updated = workflowPlanSchema.parse({ ...body, planDigest: this.workflowPlanDigest(digestBody) })
      this.assertMaterialChange(current, updated, "Workflow Plan")
      await this.commitRecord("workflow-plans", updated, workflowPlanSchema, "workflow-plan.revised", actorId, transitionReason)
      return updated
    })
  }

  async readWorkflowPlan(id: string): Promise<WorkflowPlan> {
    return this.readRecord("workflow-plans", id, workflowPlanSchema)
  }
  async listWorkflowPlans(): Promise<WorkflowPlan[]> {
    return this.listRecords("workflow-plans", /^[0-9a-f-]+\.json$/i, workflowPlanSchema)
  }

  async createToolDefinition(
    input: ToolDefinitionInput,
    expectedProductRevision: number,
    actorId: string,
  ): Promise<ToolDefinition> {
    return this.repository.withLock(async () => {
      this.assertAllowedKeys(
        input,
        [
          "definitionType", "key", "name", "binding", "purpose", "inputContract", "outputContract", "allowedScopes",
          "requiredPermissions", "effectEnvelope", "trust", "limitations", "enabled", "policy",
        ],
        "Tool Definition input",
      )
      await this.assertIntegrity()
      const product = await this.requireProductRevision(expectedProductRevision)
      if ((await this.listToolDefinitions()).some((tool) => tool.key === input.key)) {
        throw new Error(`Tool Definition key ${input.key} already exists`)
      }
      const now = new Date().toISOString()
      const record = toolDefinitionSchema.parse({
        schemaVersion: 1,
        kind: "tool-definition",
        id: randomUUID(),
        productId: product.id,
        revision: 1,
        ...input,
        authorityBoundary: "tool-presence-does-not-grant-authority",
        createdAt: now,
        updatedAt: now,
      })
      await this.commitRecord("tools", record, toolDefinitionSchema, "tool-definition.created", actorId)
      return record
    })
  }

  async reviseToolDefinition(
    id: string,
    expectedRevision: number,
    patch: Partial<ToolDefinitionInput>,
    actorId: string,
  ): Promise<ToolDefinition> {
    return this.repository.withLock(async () => {
      this.assertAllowedKeys(
        patch,
        [
          "definitionType", "key", "name", "binding", "purpose", "inputContract", "outputContract", "allowedScopes",
          "requiredPermissions", "effectEnvelope", "trust", "limitations", "enabled", "policy",
        ],
        "Tool Definition patch",
      )
      await this.assertIntegrity()
      const current = await this.readToolDefinition(id)
      this.assertExpectedRevision(current.revision, expectedRevision, "Tool Definition")
      if (patch.key && (await this.listToolDefinitions()).some((tool) => tool.id !== current.id && tool.key === patch.key)) {
        throw new Error(`Tool Definition key ${patch.key} already exists`)
      }
      const updated = toolDefinitionSchema.parse({
        ...current,
        ...patch,
        schemaVersion: current.schemaVersion,
        kind: current.kind,
        id: current.id,
        productId: current.productId,
        createdAt: current.createdAt,
        revision: current.revision + 1,
        updatedAt: new Date().toISOString(),
      })
      this.assertMaterialChange(current, updated, "Tool Definition")
      await this.commitRecord("tools", updated, toolDefinitionSchema, "tool-definition.revised", actorId)
      return updated
    })
  }

  async readToolDefinition(id: string): Promise<ToolDefinition> { return this.readRecord("tools", id, toolDefinitionSchema) }
  async listToolDefinitions(): Promise<ToolDefinition[]> {
    return this.listRecords("tools", /^[0-9a-f-]+\.json$/i, toolDefinitionSchema)
  }

  async createRunToolSelection(
    input: RunToolSelectionInput,
    expectedProductRevision: number,
    actorId: string,
  ): Promise<RunToolSelection> {
    return this.repository.withLock(async () => {
      this.assertAllowedKeys(
        input,
        ["runId", "tools", "requestedEffects", "requestedScopes", "confirmedToolIds", "workspaceTrusted"],
        "Run Tool Selection input",
      )
      await this.assertIntegrity()
      const product = await this.requireProductRevision(expectedProductRevision)
      if ((await this.listRunToolSelections()).some((selection) => selection.runId === input.runId)) {
        throw new Error("A Run Tool Selection already exists; revise the existing record")
      }
      const run = await this.repository.readJson(
        this.repository.resolve("sessions", `run-${this.requireUuid(input.runId, "Run ID")}.json`),
        runSchema,
      )
      if (run.productId !== product.id) throw new Error("Run Tool Selection targets a different Product")
      const readiness = await this.evaluateToolSelection(input, run)
      const { workspaceTrusted: _localWorkspaceTrust, ...portableInput } = input
      const now = new Date().toISOString()
      const record = runToolSelectionSchema.parse({
        schemaVersion: 1,
        kind: "run-tool-selection",
        id: randomUUID(),
        productId: product.id,
        revision: 1,
        ...portableInput,
        readiness,
        selectedBy: { kind: "human", id: actorId },
        localTrustBoundary: "workspace-trust-must-be-revalidated-before-every-launch",
        authorityBoundary: "tool-selection-does-not-grant-authority",
        createdAt: now,
        updatedAt: now,
      })
      await this.commitRecord(
        "tool-selections", record, runToolSelectionSchema, "run-tool-selection.created", actorId,
      )
      return record
    })
  }

  async reviseRunToolSelection(
    id: string,
    expectedRevision: number,
    patch: Partial<Omit<RunToolSelectionInput, "runId">> & { workspaceTrusted: boolean },
    actorId: string,
  ): Promise<RunToolSelection> {
    return this.repository.withLock(async () => {
      this.assertAllowedKeys(
        patch,
        ["tools", "requestedEffects", "requestedScopes", "confirmedToolIds", "workspaceTrusted"],
        "Run Tool Selection patch",
      )
      await this.assertIntegrity()
      const current = await this.readRunToolSelection(id)
      this.assertExpectedRevision(current.revision, expectedRevision, "Run Tool Selection")
      const run = await this.repository.readJson(
        this.repository.resolve("sessions", `run-${current.runId}.json`),
        runSchema,
      )
      if (run.state !== "prepared") throw new Error(`Run Tool Selection is immutable while Run is ${run.state}`)
      const merged = {
        runId: current.runId,
        tools: patch.tools ?? current.tools,
        requestedEffects: patch.requestedEffects ?? current.requestedEffects,
        requestedScopes: patch.requestedScopes ?? current.requestedScopes,
        confirmedToolIds: patch.confirmedToolIds ?? current.confirmedToolIds,
        workspaceTrusted: patch.workspaceTrusted,
      }
      const readiness = await this.evaluateToolSelection(merged, run)
      const { workspaceTrusted: _localWorkspaceTrust, ...portableMerged } = merged
      const updated = runToolSelectionSchema.parse({
        ...current,
        ...portableMerged,
        readiness,
        selectedBy: { kind: "human", id: actorId },
        revision: current.revision + 1,
        updatedAt: new Date().toISOString(),
      })
      this.assertMaterialChange(current, updated, "Run Tool Selection")
      await this.commitRecord(
        "tool-selections", updated, runToolSelectionSchema, "run-tool-selection.revised", actorId,
      )
      return updated
    })
  }

  async readRunToolSelection(id: string): Promise<RunToolSelection> {
    return this.readRecord("tool-selections", id, runToolSelectionSchema)
  }
  async listRunToolSelections(): Promise<RunToolSelection[]> {
    return this.listRecords("tool-selections", /^[0-9a-f-]+\.json$/i, runToolSelectionSchema)
  }

  async createTraceLink(input: Omit<TraceLink, keyof typeof recordBaseKeys | "kind" | "state"> & {
    source: TraceEndpoint
    target: TraceEndpoint
  }, expectedProductRevision: number, actorId: string): Promise<TraceLink> {
    return this.repository.withLock(async () => {
      this.assertAllowedKeys(input, ["source", "relationship", "target", "provenance"], "Trace link input")
      await this.assertIntegrity()
      const product = await this.requireProductRevision(expectedProductRevision)
      if (
        input.source.recordType === input.target.recordType &&
        input.source.recordId === input.target.recordId &&
        input.relationship !== "related-to"
      ) throw new Error("A trace link cannot imply a directional relationship from a record to itself")
      this.assertTraceRelationship(input.source, input.relationship, input.target)
      if (input.provenance.kind === "human" && input.provenance.actorId !== actorId) {
        throw new Error("Human Trace provenance must match the local mutation actor")
      }
      const state = await this.assessTraceState(input.source, input.target)
      const now = new Date().toISOString()
      const record = traceLinkSchema.parse({
        schemaVersion: 1,
        kind: "trace-link",
        id: randomUUID(),
        productId: product.id,
        revision: 1,
        ...input,
        state,
        createdAt: now,
        updatedAt: now,
      })
      await this.commitRecord("trace", record, traceLinkSchema, "trace-link.created", actorId)
      return record
    })
  }

  async reassessTraceLink(id: string, expectedRevision: number, actorId: string): Promise<TraceLink> {
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const current = await this.readTraceLink(id)
      this.assertExpectedRevision(current.revision, expectedRevision, "Trace link")
      const state = await this.assessTraceState(current.source, current.target)
      if (state === current.state) throw new Error("Trace link freshness has not changed")
      const updated = traceLinkSchema.parse({
        ...current,
        revision: current.revision + 1,
        state,
        updatedAt: new Date().toISOString(),
      })
      await this.commitRecord("trace", updated, traceLinkSchema, "trace-link.reassessed", actorId)
      return updated
    })
  }

  async readTraceLink(id: string): Promise<TraceLink> { return this.readRecord("trace", id, traceLinkSchema) }
  async listTraceLinks(): Promise<TraceLink[]> { return this.listRecords("trace", /^[0-9a-f-]+\.json$/i, traceLinkSchema) }

  async impactAnalysis(subject: TraceEndpoint, proposedRevision?: TraceEndpoint): Promise<TraceImpact> {
    if (subject.recordType !== "external") {
      await this.validateExactDomainReference({
        recordType: subject.recordType,
        recordId: subject.recordId,
        revision: subject.revision!,
        digest: subject.digest!,
      })
    }
    const links = await Promise.all((await this.listTraceLinks()).map(async (link) => ({
      ...link,
      state: await this.assessTraceState(link.source, link.target),
    } as TraceLink)))
    const key = (endpoint: TraceEndpoint) => `${endpoint.recordType}:${endpoint.recordId}`
    const walk = (direction: "upstream" | "downstream"): { links: TraceLink[]; truncated: boolean } => {
      const collected = new Map<string, TraceLink>()
      const visited = new Set<string>([key(subject)])
      const queue = [subject]
      let truncated = false
      while (queue.length > 0) {
        const endpoint = queue.shift()!
        const matches = links.filter((link) => direction === "upstream"
          ? key(link.target) === key(endpoint)
          : key(link.source) === key(endpoint))
        for (const link of matches) {
          collected.set(link.id, link)
          const next = direction === "upstream" ? link.source : link.target
          if (!visited.has(key(next))) {
            visited.add(key(next))
            queue.push(next)
          }
          if (collected.size >= 2_000 || visited.size >= 2_000) {
            truncated = true
            queue.length = 0
            break
          }
        }
      }
      return { links: [...collected.values()], truncated }
    }
    const upstreamResult = walk("upstream")
    const downstreamResult = walk("downstream")
    const upstream = upstreamResult.links
    const downstream = downstreamResult.links
    const related = [...upstream, ...downstream]
    const uniqueRelated = [...new Map(related.map((link) => [link.id, link])).values()]
    const invalidatedByProposedRevision = proposedRevision
      ? uniqueRelated.filter((link) => [link.source, link.target].some((endpoint) =>
          endpoint.recordType === proposedRevision.recordType &&
          endpoint.recordId === proposedRevision.recordId &&
          (endpoint.revision !== proposedRevision.revision || endpoint.digest !== proposedRevision.digest),
        ))
      : []
    return traceImpactSchema.parse({
      subject,
      upstream,
      downstream,
      validatingEvidence: uniqueRelated.filter((link) => link.relationship === "validates" && link.source.recordType === "evidence"),
      decisionsAndRisks: uniqueRelated.filter((link) =>
        [link.source.recordType, link.target.recordType].some((kind) => kind === "decision" || kind === "risk"),
      ),
      unresolved: uniqueRelated.filter((link) => link.state === "unresolved"),
      invalid: uniqueRelated.filter((link) => link.state === "invalid"),
      stale: uniqueRelated.filter((link) => link.state === "stale"),
      invalidatedByProposedRevision,
      coverageBoundary: "absence-of-a-trace-link-does-not-prove-absence-of-impact",
      truncated: upstreamResult.truncated || downstreamResult.truncated,
      evaluatedAt: new Date().toISOString(),
    })
  }

  async search(input: ProductStudioSearchInput): Promise<ProductDomainSearchResult[]> {
    const query = input.query.trim().toLowerCase()
    if (query.length < 2) throw new Error("Search query must contain at least two characters")
    if (query.length > 500) throw new Error("Search query cannot exceed 500 characters")
    const limit = input.limit ?? 100
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error("Search result limit must be between 1 and 200")
    const kinds = (input.kinds ?? []).map((kind) => productDomainRecordKindSchema.parse(kind))
    const allowed = new Set(kinds)
    const include = (kind: ProductDomainRecordKind) => allowed.size === 0 || allowed.has(kind)
    const groups: Array<{ kind: ProductDomainRecordKind; records: unknown[] }> = []
    if (include("product-design-revision")) groups.push({ kind: "product-design-revision", records: await this.listDesignRevisions() })
    if (include("product-revision")) groups.push({ kind: "product-revision", records: await this.listProductRevisions() })
    if (include("change")) groups.push({ kind: "change", records: await this.listChanges() })
    if (include("work-item")) groups.push({ kind: "work-item", records: await this.listWorkItems() })
    if (include("requirement")) groups.push({ kind: "requirement", records: await this.listRequirements() })
    if (include("decision")) groups.push({ kind: "decision", records: await this.listDecisions() })
    if (include("risk")) groups.push({ kind: "risk", records: await this.listRisks() })
    if (include("architecture-record")) groups.push({ kind: "architecture-record", records: await this.listArchitectureRecords() })
    if (include("evidence")) groups.push({ kind: "evidence", records: await this.listEvidence() })
    if (include("trace-link")) groups.push({ kind: "trace-link", records: await this.listTraceLinks() })
    if (include("context-pack")) groups.push({ kind: "context-pack", records: await this.listContextPacks() })
    if (include("workflow-plan")) groups.push({ kind: "workflow-plan", records: await this.listWorkflowPlans() })
    if (include("tool-definition")) groups.push({ kind: "tool-definition", records: await this.listToolDefinitions() })
    if (include("instruction-privilege-grant")) {
      groups.push({ kind: "instruction-privilege-grant", records: await this.listInstructionPrivilegeGrants() })
    }
    if (include("run-tool-selection")) {
      groups.push({ kind: "run-tool-selection", records: await this.listRunToolSelections() })
    }
    const results: ProductDomainSearchResult[] = []
    for (const group of groups) {
      for (const unknownRecord of group.records) {
        const record = unknownRecord as Record<string, unknown>
        const searchable = JSON.stringify(record).toLowerCase()
        const position = searchable.indexOf(query)
        if (position < 0) continue
        const id = group.kind === "product-revision"
          ? `${String(record.productId)}@${String(record.revision)}`
          : String(record.id)
        const label = this.recordLabel(group.kind, record)
        results.push(productDomainSearchResultSchema.parse({
          schemaVersion: 1,
          kind: group.kind,
          id,
          productId: record.productId,
          revision: record.revision,
          label,
          excerpt: searchable.slice(Math.max(0, position - 80), position + query.length + 160),
          updatedAt: record.updatedAt ?? record.createdAt ?? record.recordedAt,
        }))
      }
    }
    return results.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, limit)
  }

  async listDomainPage<K extends keyof ProductStudioRecordMap>(
    kind: K,
    input: ProductStudioPageInput = {},
  ): Promise<ProductStudioPage<ProductStudioRecordMap[K]>> {
    const offset = input.offset ?? 0
    const limit = input.limit ?? 100
    if (!Number.isInteger(offset) || offset < 0 || offset > 1_000_000) {
      throw new Error("Product-domain page offset must be between 0 and 1,000,000")
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new Error("Product-domain page limit must be between 1 and 200")
    }
    let records: ProductStudioRecordMap[K][]
    switch (kind) {
      case "product-design-revision": records = await this.listDesignRevisions() as ProductStudioRecordMap[K][]; break
      case "product-revision": records = await this.listProductRevisions() as ProductStudioRecordMap[K][]; break
      case "change": records = await this.listChanges() as ProductStudioRecordMap[K][]; break
      case "work-item": records = await this.listWorkItems() as ProductStudioRecordMap[K][]; break
      case "requirement": records = await this.listRequirements() as ProductStudioRecordMap[K][]; break
      case "decision": records = await this.listDecisions() as ProductStudioRecordMap[K][]; break
      case "risk": records = await this.listRisks() as ProductStudioRecordMap[K][]; break
      case "architecture-record": records = await this.listArchitectureRecords() as ProductStudioRecordMap[K][]; break
      case "evidence": records = await this.listEvidence() as ProductStudioRecordMap[K][]; break
      case "trace-link": records = await this.listTraceLinks() as ProductStudioRecordMap[K][]; break
      case "context-pack": records = await this.listContextPacks() as ProductStudioRecordMap[K][]; break
      case "workflow-plan": records = await this.listWorkflowPlans() as ProductStudioRecordMap[K][]; break
      case "tool-definition": records = await this.listToolDefinitions() as ProductStudioRecordMap[K][]; break
      case "instruction-privilege-grant": records = await this.listInstructionPrivilegeGrants() as ProductStudioRecordMap[K][]; break
      case "run-tool-selection": records = await this.listRunToolSelections() as ProductStudioRecordMap[K][]; break
      default: throw new Error(`Unsupported Product-domain page kind: ${String(kind)}`)
    }
    return {
      items: records.slice(offset, offset + limit),
      offset,
      limit,
      total: records.length,
      hasMore: offset + limit < records.length,
    }
  }

  async buildPortableExport(disclosure: ProductExportDisclosureInput = {}): Promise<ProductExportBundle> {
    await this.assertIntegrity()
    const [manifest, product] = await Promise.all([
      this.repository.readJson(this.repository.resolve("manifest.json"), repositoryManifestSchema),
      this.readProduct(),
    ])
    const reviewedRecordIds = new Set(disclosure.reviewedRecordIds ?? [])
    if (
      reviewedRecordIds.size > 0 &&
      (!disclosure.actorId || disclosure.actorId.trim().length < 1 || !disclosure.reviewedAt || !Number.isFinite(Date.parse(disclosure.reviewedAt)))
    ) {
      throw new Error("Confidential or restricted export disclosure requires an explicit human reviewer")
    }
    const contextPacks = await this.listContextPacks()
    const sources = await this.listRecords("sources", /^[0-9a-f-]+\.json$/i, sourceRecordSchema)
    const sourceHistory = await this.listRecords(
      "source-history",
      /^source-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      sourceRecordRevisionSchema,
    )
    const sourceBaselines = await this.listRecords(
      "source-baselines",
      /^[0-9a-f-]+\.json$/i,
      sourceBaselineSchema,
    )
    const sourceBaselineHistory = await this.listRecords(
      "source-baseline-history",
      /^baseline-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      sourceBaselineSchema,
    )
    const sourceProvenance = await this.listRecords(
      "source-provenance",
      /^[0-9a-f-]+\.json$/i,
      sourceProvenanceSchema,
    )
    const sensitiveContextIds = new Set(contextPacks
      .filter((pack) => ["confidential", "restricted"].includes(pack.classification.level))
      .map((pack) => pack.id))
    const sensitiveSourceIds = new Set(sources
      .filter((source) => ["confidential", "restricted"].includes(source.informationClassification))
      .map((source) => source.id))
    const sensitiveRecordIds = new Set([...sensitiveContextIds, ...sensitiveSourceIds])
    for (const id of sensitiveRecordIds) {
      if (!reviewedRecordIds.has(id)) {
        const classification = contextPacks.find((pack) => pack.id === id)?.classification.level ??
          sources.find((source) => source.id === id)?.informationClassification
        throw new Error(`Portable record ${id} is ${classification}; explicit disclosure review is required`)
      }
    }
    for (const id of reviewedRecordIds) {
      if (!sensitiveRecordIds.has(id)) {
        throw new Error(`Disclosure review references a record that does not require sensitive-record review: ${id}`)
      }
    }
    const portableRecords: Array<{ path: string; recordType: string; content: unknown }> = [
      { path: "manifest.json", recordType: "repository-manifest", content: manifest },
      { path: "product.json", recordType: "product", content: product },
    ]
    const append = <T>(directory: string, recordType: string, records: T[], pathFor?: (record: T) => string) => {
      for (const record of records) {
        if (portableRecords.length >= 10_000) {
          throw new Error("Portable Product export exceeds the 10,000-record safety limit")
        }
        const path = pathFor ? pathFor(record) : `${directory}/${String((record as { id: string }).id)}.json`
        portableRecords.push({ path, recordType, content: record })
      }
    }
    append("product-history", "product-revision", await this.listProductRevisions(), (record) =>
      `product-history/product-${record.productId}-r${record.revision}.json`)
    append("design-revisions", "product-design-revision", await this.listDesignRevisions())
    append("initiatives", "initiative", await this.listRecords("initiatives", /^[0-9a-f-]+\.json$/i, initiativeSchema))
    append("changes", "change", await this.listChanges())
    append("work-items", "work-item", await this.listWorkItems())
    append("requirements", "requirement", await this.listRequirements())
    append("decisions", "decision", await this.listDecisions())
    append("risks", "risk", await this.listRisks())
    append("architecture", "architecture-record", await this.listArchitectureRecords())
    append("evidence", "evidence", await this.listEvidence())
    append("trace", "trace-link", await this.listTraceLinks())
    append("context-packs", "context-pack", contextPacks)
    append("workflow-plans", "workflow-plan", await this.listWorkflowPlans())
    append("tools", "tool-definition", await this.listToolDefinitions())
    append("instruction-grants", "instruction-privilege-grant", await this.listInstructionPrivilegeGrants())
    append("tool-selections", "run-tool-selection", await this.listRunToolSelections())
    append("sources", "source-record", sources)
    append("source-history", "source-record-revision", sourceHistory, (record) =>
      `source-history/source-${record.sourceId}-r${record.revision}.json`)
    append("source-baselines", "source-baseline-snapshot", sourceBaselines)
    append("source-baseline-history", "source-baseline-snapshot", sourceBaselineHistory, (record) =>
      `source-baseline-history/baseline-${record.id}-r${record.revision}.json`)
    append("source-provenance", "source-provenance-record", sourceProvenance)
    const recordHistory = await this.listRecords(
      "record-history", /^[a-z-]+-[0-9a-f-]+-r[1-9][0-9]*\.json$/i, productRecordRevisionSchema,
    )
    append("record-history", "product-record-revision", recordHistory, (record) =>
      `record-history/${record.recordType}-${record.recordId}-r${record.revision}.json`)
    append("sessions", "execution-charter", await this.listRecords(
      "sessions", /^charter-[0-9a-f-]+\.json$/i, executionCharterSchema,
    ), (record) => `sessions/charter-${record.id}.json`)
    append("sessions", "run", await this.listRecords(
      "sessions", /^run-[0-9a-f-]+\.json$/i, runSchema,
    ), (record) => `sessions/run-${record.id}.json`)
    append("sessions", "managed-run", await this.listRecords(
      "sessions", /^managed-run-[0-9a-f-]+\.json$/i, managedRunRecordSchema,
    ), (record) => `sessions/managed-run-${record.id}.json`)
    append("sessions", "managed-run-evidence", await this.listRecords(
      "sessions", /^managed-evidence-[0-9a-f-]+\.json$/i, managedRunEvidenceSchema,
    ), (record) => `sessions/managed-evidence-${record.id}.json`)
    append("sessions", "managed-run-result", await this.listRecords(
      "sessions", /^managed-result-[0-9a-f-]+\.json$/i, managedRunResultSchema,
    ), (record) => `sessions/managed-result-${record.id}.json`)
    append("sessions", "managed-apply-decision", await this.listRecords(
      "sessions", /^managed-apply-decision-[0-9a-f-]+\.json$/i, managedApplyDecisionReceiptSchema,
    ), (record) => `sessions/managed-apply-decision-${record.id}.json`)
    append("handoffs", "handoff", await this.listRecords(
      "handoffs", /^[0-9a-f-]+\.json$/i, handoffSchema,
    ))
    portableRecords.sort((left, right) => left.path.localeCompare(right.path))
    if (containsSecretShapedValue(portableRecords.map((record) => record.content))) {
      throw new Error("Portable export rejected secret-shaped governed content")
    }
    const records = portableRecords.map((record) => ({ path: record.path, content: record.content }))
    const members = portableRecords.map((record) => {
      const serialized = `${JSON.stringify(record.content, null, 2)}\n`
      return {
        path: record.path,
        recordType: record.recordType,
        byteLength: Buffer.byteLength(serialized),
        digest: canonicalDigest(record.content),
      }
    })
    const exportManifest = productExportManifestSchema.parse({
      schemaVersion: 1,
      kind: "product-export-manifest",
      productId: product.id,
      productRevision: product.revision ?? 1,
      members,
      membershipDigest: canonicalDigest(members.map(({ path, digest }) => ({ path, digest }))),
      excluded: [
        { recordClass: "runtime-bindings", reason: "Machine-local executable paths, locks, drafts, and capability probes are not portable." },
        { recordClass: "audit-runtime", reason: "The local operational audit can contain execution diagnostics not reviewed for portable disclosure." },
      ],
      disclosureReview: {
        includedClassifications: [...new Set<ContextPack["classification"]["level"]>([
          "public",
          "internal",
          ...contextPacks.map((pack) => pack.classification.level),
          ...sources.map((source) => source.informationClassification),
        ])],
        reviewedRecordIds: [...reviewedRecordIds].sort(),
        excludedRecordIds: [],
        ...(disclosure.actorId ? { reviewedBy: { kind: "human" as const, id: disclosure.actorId } } : {}),
        evaluatedAt: disclosure.reviewedAt ?? product.updatedAt,
        boundary: "confidential-and-restricted-records-require-explicit-human-review",
      },
      authorityBoundary: "export-does-not-assert-readiness-or-approval",
    })
    return productExportBundleSchema.parse({
      schemaVersion: 1,
      kind: "product-export-bundle",
      manifest: exportManifest,
      records,
    })
  }

  async previewImportFile(path: string): Promise<ProductImportPreview> {
    if (!isAbsolute(path) || path.split(/[\\/]/).includes("..")) {
      throw new Error("Import preview requires an explicit absolute file path without traversal segments")
    }
    let handle
    try {
      handle = await open(path, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0))
    } catch (error) {
      if (error instanceof Error && "code" in error && ["ELOOP", "EMLINK"].includes(String(error.code))) {
        throw new Error("Import preview refuses symbolic-link sources")
      }
      throw error
    }
    let raw: unknown
    try {
      const metadata = await handle.stat()
      if (!metadata.isFile()) throw new Error("Import preview source must be a regular file")
      if (metadata.size > 25 * 1024 * 1024) throw new Error("Import preview source exceeds the 25 MiB safety limit")
      const text = await handle.readFile("utf8")
      try {
        raw = JSON.parse(text)
      } catch (error) {
        throw new Error(error instanceof Error ? `Malformed import bundle: ${error.message}` : "Malformed import bundle")
      }
    } finally {
      await handle.close()
    }
    return this.previewImportBundle(raw)
  }

  async previewImportBundle(input: unknown): Promise<ProductImportPreview> {
    let inputSize: number
    try {
      inputSize = Buffer.byteLength(JSON.stringify(input))
    } catch {
      throw new Error("Import preview requires an acyclic JSON-compatible bundle")
    }
    if (inputSize > 25 * 1024 * 1024) throw new Error("Import preview bundle exceeds the 25 MiB safety limit")
    this.assertJsonDepth(input, 64)
    const bundle = productExportBundleSchema.parse(input)
    if (containsSecretShapedValue(bundle.records.map((record) => record.content))) {
      throw new Error("Import preview rejected secret-shaped portable content")
    }
    const recordsByPath = new Map(bundle.records.map((record) => [record.path, record.content]))
    const manifestPaths = bundle.manifest.members.map((member) => member.path)
    if (
      bundle.records.length !== bundle.manifest.members.length ||
      manifestPaths.some((path) => !recordsByPath.has(path))
    ) throw new Error("Import bundle records do not exactly match the manifest")
    const sortedPaths = [...manifestPaths].sort()
    if (JSON.stringify(manifestPaths) !== JSON.stringify(sortedPaths)) {
      throw new Error("Import manifest members must use deterministic path ordering")
    }
    if (JSON.stringify(bundle.records.map((record) => record.path)) !== JSON.stringify(manifestPaths)) {
      throw new Error("Import records must follow exact manifest ordering")
    }
    const validatedByPath = new Map<string, unknown>()
    for (const member of bundle.manifest.members) {
      const content = recordsByPath.get(member.path)
      const validated = this.validatePortableMember(member.path, content)
      validatedByPath.set(member.path, validated)
      const expectedRecordType = this.portableRecordTypeForPath(member.path)
      if (member.recordType !== expectedRecordType) {
        throw new Error(`Import member record type mismatch: ${member.path}`)
      }
      const record = validated as { id?: string; productId?: string; revision?: number }
      if (record.productId && record.productId !== bundle.manifest.productId) {
        throw new Error(`Import member targets a different Product: ${member.path}`)
      }
      const filename = member.path.split("/").at(-1)!
      if (record.id && /^[0-9a-f-]+\.json$/i.test(filename) && filename !== `${record.id}.json`) {
        throw new Error(`Import member filename does not match record identity: ${member.path}`)
      }
      const productHistoryMatch = /^product-history\/product-([0-9a-f-]+)-r([1-9][0-9]*)\.json$/i.exec(member.path)
      if (
        productHistoryMatch &&
        (record.productId !== productHistoryMatch[1] || record.revision !== Number(productHistoryMatch[2]))
      ) {
        throw new Error(`Import Product history filename does not match record identity: ${member.path}`)
      }
      if (member.path.startsWith("record-history/")) {
        const history = validated as ProductRecordRevision
        const expectedHistoryPath = `record-history/${history.recordType}-${history.recordId}-r${history.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Record History filename does not match its envelope: ${member.path}`)
        }
      }
      if (member.path.startsWith("source-history/")) {
        const history = validated as SourceRecordRevision
        const expectedHistoryPath = `source-history/source-${history.sourceId}-r${history.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Source history filename does not match its envelope: ${member.path}`)
        }
      }
      if (member.path.startsWith("source-baseline-history/")) {
        const baseline = validated as SourceBaseline
        const expectedHistoryPath = `source-baseline-history/baseline-${baseline.id}-r${baseline.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Source Baseline history filename does not match its snapshot: ${member.path}`)
        }
      }
      const prefixedIdentityMatch = /^(?:sessions\/(?:charter|run|managed-run|managed-evidence|managed-result|managed-apply-decision))-([0-9a-f-]+)\.json$/i.exec(member.path)
      if (prefixedIdentityMatch && record.id !== prefixedIdentityMatch[1]) {
        throw new Error(`Import session filename does not match record identity: ${member.path}`)
      }
      const serialized = `${JSON.stringify(validated, null, 2)}\n`
      if (canonicalDigest(validated) !== member.digest) throw new Error(`Import member digest mismatch: ${member.path}`)
      if (Buffer.byteLength(serialized) !== member.byteLength) throw new Error(`Import member byte length mismatch: ${member.path}`)
    }
    const expectedMembership = canonicalDigest(
      bundle.manifest.members.map(({ path, digest }) => ({ path, digest })),
    )
    if (expectedMembership !== bundle.manifest.membershipDigest) throw new Error("Import membership digest mismatch")
    const importedManifest = validatedByPath.get("manifest.json") as { productId?: string } | undefined
    const importedProduct = validatedByPath.get("product.json") as Product | undefined
    if (!importedManifest || importedManifest.productId !== bundle.manifest.productId) {
      throw new Error("Import repository manifest does not match the export Product identity")
    }
    if (
      !importedProduct ||
      importedProduct.id !== bundle.manifest.productId ||
      (importedProduct.revision ?? 1) !== bundle.manifest.productRevision
    ) throw new Error("Import Product identity or revision does not match the export manifest")
    await this.validateImportGraph(validatedByPath, bundle)
    const conflicts: ProductImportPreview["conflicts"] = []
    let currentProduct: Product | undefined
    try {
      currentProduct = await this.readProduct()
    } catch (error) {
      if (!this.isMissing(error)) {
        const health = await this.repository.workspaceHealth()
        if (health.initialized) throw error
      }
    }
    if (currentProduct && currentProduct.id !== bundle.manifest.productId) {
      conflicts.push({
        path: "product.json",
        code: "product-identity-conflict",
        message: "The import identifies a different Product than the initialized workspace.",
      })
    }
    if (currentProduct?.id === bundle.manifest.productId) {
      for (const member of bundle.manifest.members) {
        try {
          const current = await this.readPortableMember(member.path)
          if (canonicalDigest(current) !== member.digest) {
            conflicts.push({
              path: member.path,
              code: "record-content-conflict",
              message: "The workspace already contains a different record at this portable path.",
            })
          }
        } catch (error) {
          if (!this.isMissing(error)) throw error
        }
      }
    }
    return productImportPreviewSchema.parse({
      schemaVersion: 1,
      kind: "product-import-preview",
      productId: bundle.manifest.productId,
      productRevision: bundle.manifest.productRevision,
      status: conflicts.length > 0 ? "blocked" : "compatible",
      memberCount: bundle.manifest.members.length,
      conflicts,
      warnings: [
        ...bundle.manifest.excluded.map((item) => `${item.recordClass}: ${item.reason}`),
        ...(bundle.manifest.members.some((member) => member.recordType === "run-tool-selection")
          ? ["run-tool-selection: workspace trust and all selected capabilities must be revalidated locally before launch."]
          : []),
      ],
      importMutation: "not-performed",
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
    const product = await this.readProduct()
    const designRevisions = await this.listDesignRevisions()
    if (product.currentDesign) {
      const currentDesign = designRevisions.find((revision) => revision.id === product.currentDesign?.id)
      if (!currentDesign || currentDesign.revision !== product.currentDesign.revision || canonicalDigest(currentDesign) !== product.currentDesign.digest) {
        issues.push({
          code: "product.current-design-invalid",
          severity: "error",
          message: "Product current Design binding does not resolve to the exact governed Design Revision.",
          portablePath: "product.json",
          fieldPath: ["currentDesign"],
          repairActions: ["inspect-read-only", "manual-repair-required"],
        })
      }
    } else if (designRevisions.length > 0) {
      issues.push({
        code: "product.current-design-migration-required",
        severity: "error",
        message: "Design Revisions exist but Product has no exact current Design binding; explicit migration is required.",
        portablePath: "product.json",
        fieldPath: ["currentDesign"],
        repairActions: ["inspect-read-only", "manual-repair-required"],
      })
    }

    const historyGroups: Array<{
      type: ProductRecordRevision["recordType"]
      records: Array<{ id: string; revision: number }>
    }> = [
      { type: "change", records: await this.listChanges() },
      { type: "work-item", records: await this.listWorkItems() },
      { type: "requirement", records: await this.listRequirements() },
      { type: "decision", records: await this.listDecisions() },
      { type: "risk", records: await this.listRisks() },
      { type: "architecture-record", records: await this.listArchitectureRecords() },
      { type: "evidence", records: await this.listEvidence() },
      { type: "trace-link", records: await this.listTraceLinks() },
      { type: "context-pack", records: await this.listContextPacks() },
      { type: "workflow-plan", records: await this.listWorkflowPlans() },
      { type: "tool-definition", records: await this.listToolDefinitions() },
      { type: "instruction-privilege-grant", records: await this.listInstructionPrivilegeGrants() },
      { type: "run-tool-selection", records: await this.listRunToolSelections() },
    ]
    for (const group of historyGroups) {
      for (const record of group.records) {
        try {
          const history = await this.listRecordHistory(group.type, record.id)
          if (history.length !== record.revision || history[0]?.recordDigest !== canonicalDigest(record)) {
            throw new Error("history is missing, non-contiguous, or does not match the current record")
          }
          const ascending = [...history].sort((left, right) => left.revision - right.revision)
          for (const [index, revision] of ascending.entries()) {
            if (
              revision.recordType !== group.type ||
              revision.recordId !== record.id ||
              revision.revision !== index + 1 ||
              (index === 0 && revision.predecessorDigest !== undefined) ||
              (index > 0 && revision.predecessorDigest !== ascending[index - 1]?.recordDigest)
            ) {
              throw new Error("history predecessor chain is invalid")
            }
          }
        } catch (error) {
          issues.push({
            code: "product.record-history-invalid",
            severity: "error",
            message: `${group.type} ${record.id}: ${error instanceof Error ? error.message : "immutable history is invalid"}`,
            record: { type: group.type, id: record.id, revision: record.revision },
            repairActions: ["inspect-read-only", "manual-repair-required"],
          })
        }
      }
    }

    for (const change of await this.listChanges()) {
      try {
        await this.validateBaseline(change.baseline, product)
      } catch (error) {
        issues.push({
          code: "product.change-baseline-invalid",
          severity: "error",
          message: `Change ${change.id}: ${error instanceof Error ? error.message : "baseline is invalid"}`,
          record: { type: "change", id: change.id, revision: change.revision },
          repairActions: ["inspect-read-only", "create-superseding-revision"],
        })
      }
    }
    for (const item of await this.listWorkItems()) {
      try {
        await this.validateWorkGraph(item)
      } catch (error) {
        issues.push({
          code: "product.work-graph-invalid",
          severity: "error",
          message: `Work Item ${item.id}: ${error instanceof Error ? error.message : "dependency graph is invalid"}`,
          record: { type: "work-item", id: item.id, revision: item.revision },
          repairActions: ["inspect-read-only", "create-superseding-revision"],
        })
      }
    }
    for (const evidence of await this.listEvidence()) {
      try {
        await this.validateExactReferences(evidence.subjects)
        this.assertEvidenceFreshness(evidence)
        if (evidence.validUntil && Date.parse(evidence.validUntil) <= Date.now() && evidence.freshness.status === "fresh") {
          throw new Error("expired Evidence is still marked fresh")
        }
      } catch (error) {
        issues.push({
          code: "product.evidence-invalid",
          severity: "warning",
          message: `Evidence ${evidence.id}: ${error instanceof Error ? error.message : "Evidence is stale or invalid"}`,
          record: { type: "evidence", id: evidence.id, revision: evidence.revision },
          repairActions: ["inspect-read-only", "create-superseding-revision"],
        })
      }
    }
    for (const link of await this.listTraceLinks()) {
      const state = await this.assessTraceState(link.source, link.target)
      if (state !== "valid") issues.push({
        code: `product.trace-${state}`,
        severity: "warning",
        message: `Trace Link ${link.id} currently resolves as ${state}.`,
      })
    }
    for (const pack of await this.listContextPacks()) {
      try {
        await this.validateContextItems(pack.items, pack.recipient, pack.objective)
        if (pack.packDigest !== this.contextPackDigest(pack)) throw new Error("Context Pack internal digest does not match")
      } catch (error) {
        issues.push({
          code: "product.context-stale",
          severity: "warning",
          message: error instanceof Error ? `Context Pack ${pack.id}: ${error.message}` : `Context Pack ${pack.id} is stale.`,
        })
      }
      if (pack.sufficiency.status === "insufficient") issues.push({
        code: "product.context-insufficient",
        severity: "warning",
        message: `Context Pack ${pack.id} is explicitly insufficient: ${pack.sufficiency.reasons.join("; ")}`,
      })
    }
    for (const plan of await this.listWorkflowPlans()) {
      try {
        await this.validateWorkflow(plan)
        if (plan.planDigest !== this.workflowPlanDigest(plan)) throw new Error("Workflow Plan internal digest does not match")
      } catch (error) {
        issues.push({
          code: "product.workflow-stale",
          severity: "warning",
          message: error instanceof Error ? `Workflow Plan ${plan.id}: ${error.message}` : `Workflow Plan ${plan.id} is stale.`,
        })
      }
    }
    for (const selection of await this.listRunToolSelections()) {
      try {
        const run = await this.repository.readJson(
          this.repository.resolve("sessions", `run-${selection.runId}.json`),
          runSchema,
        )
        const readiness = await this.evaluateToolSelection({ ...selection, workspaceTrusted: true }, run)
        if (
          readiness.status === "blocked" ||
          canonicalDigest({ status: readiness.status, issues: readiness.issues }) !==
            canonicalDigest({ status: selection.readiness.status, issues: selection.readiness.issues })
        ) {
          issues.push({
            code: "product.tool-selection-blocked",
            severity: "warning",
            message: `Run Tool Selection ${selection.id} is blocked or stale: ${readiness.issues.join("; ")}`,
          })
        }
      } catch (error) {
        issues.push({
          code: "product.tool-selection-stale",
          severity: "warning",
          message: error instanceof Error ? error.message : `Run Tool Selection ${selection.id} is stale.`,
        })
      }
    }
    return issues
  }

  private async validateContextItems(
    items: ContextPack["items"],
    recipient?: ContextPack["recipient"],
    purpose?: string,
  ): Promise<void> {
    this.validateContextItemDigests(items)
    for (const item of items) {
      if (item.instructionPrivilegeGrant) {
        const exact = await this.validateExactDomainReference(item.instructionPrivilegeGrant)
        const grant = instructionPrivilegeGrantSchema.parse(exact)
        const current = await this.readInstructionPrivilegeGrant(grant.id)
        if (current.revision !== grant.revision || current.state !== "active") {
          throw new Error(`Instruction Privilege Grant ${grant.id} is stale or no longer active`)
        }
        if (grant.expiresAt && Date.parse(grant.expiresAt) <= Date.now()) {
          throw new Error(`Instruction Privilege Grant ${grant.id} is expired`)
        }
        if (!await this.isExactReferenceCurrent(grant.authority)) {
          throw new Error(`Instruction Privilege Grant ${grant.id} authority has been superseded and requires re-acceptance`)
        }
        if (canonicalDigest(grant.source) !== canonicalDigest(item.source) || grant.sourceDigest !== item.sourceDigest) {
          throw new Error(`Instruction Privilege Grant ${grant.id} does not bind the exact Context Item source`)
        }
        if (grant.privilege !== item.trust.instructionPrivilege) {
          throw new Error(`Instruction Privilege Grant ${grant.id} does not grant the requested privilege class`)
        }
        if (recipient && canonicalDigest(grant.recipient) !== canonicalDigest(recipient)) {
          throw new Error(`Instruction Privilege Grant ${grant.id} does not permit the Context Pack recipient`)
        }
        if (purpose && grant.purpose !== purpose) {
          throw new Error(`Instruction Privilege Grant ${grant.id} does not bind the exact Context Pack purpose`)
        }
        const requestedScope = item.trust.semanticAuthority.scope
        if (requestedScope.some((scope) => !grant.scope.includes(scope))) {
          throw new Error(`Instruction Privilege Grant ${grant.id} does not cover the declared semantic-authority scope`)
        }
      }
    }
  }

  private validateContextItemDigests(items: ContextPack["items"]): void {
    for (const item of items) {
      if (canonicalDigest(item.content) !== item.contentDigest) {
        throw new Error(`Context Item ${item.id} content digest does not match`)
      }
      if (item.transformations.length === 0 && item.sourceDigest !== item.contentDigest) {
        throw new Error(`Context Item ${item.id} changes source content without a declared transformation`)
      }
      let precedingDigest = item.sourceDigest
      for (const transformation of item.transformations) {
        if (transformation.sourceDigest !== precedingDigest) {
          throw new Error(`Context Item ${item.id} transformation chain is discontinuous`)
        }
        precedingDigest = transformation.outputDigest
      }
      if (item.transformations.length > 0 && precedingDigest !== item.contentDigest) {
        throw new Error(`Context Item ${item.id} final transformation does not bind its content`)
      }
    }
  }

  private async validateInstructionAuthority(reference: ExactDomainRecordReference): Promise<void> {
    const record = await this.validateExactDomainReference(reference)
    if (!await this.isExactReferenceCurrent(reference)) {
      throw new Error("Instruction privilege authority must reference the current governed revision")
    }
    if (reference.recordType === "requirement") {
      const requirement = requirementSchema.parse(record)
      if (!["accepted", "satisfied"].includes(requirement.state)) {
        throw new Error("Instruction privilege authority requires an accepted or satisfied Requirement")
      }
      return
    }
    if (reference.recordType === "decision") {
      if (decisionSchema.parse(record).state !== "decided") {
        throw new Error("Instruction privilege authority requires a decided Decision")
      }
      return
    }
    if (reference.recordType === "architecture") {
      if (architectureRecordSchema.parse(record).state !== "accepted") {
        throw new Error("Instruction privilege authority requires accepted Architecture")
      }
      return
    }
    throw new Error("Instruction privilege authority must be a Requirement, Decision, or Architecture record")
  }

  private deriveContextEvaluation(input: ContextPackInput): Pick<ContextPack, "classification" | "sufficiency"> {
    const classificationRank: Record<ContextPack["classification"]["level"], number> = {
      public: 0,
      internal: 1,
      confidential: 2,
      restricted: 3,
    }
    const level = input.items.reduce<ContextPack["classification"]["level"]>((highest, item) =>
      classificationRank[item.trust.confidentiality.classification] > classificationRank[highest]
        ? item.trust.confidentiality.classification
        : highest,
    "public")
    const reasons: string[] = []
    for (const omission of input.omissions) {
      if (omission.required || omission.material) reasons.push(`Required or material source omitted: ${omission.reason}`)
    }
    for (const conflict of input.conflicts) {
      if (conflict.state === "open") reasons.push(`Open context conflict: ${conflict.statement}`)
    }
    for (const item of input.items.filter((candidate) => candidate.required)) {
      if (item.trust.freshness.status === "stale") reasons.push(`Required Context Item ${item.id} is stale`)
      if (item.trust.validity.status !== "valid") reasons.push(`Required Context Item ${item.id} validity is not established`)
      if (item.trust.applicability.status !== "applicable") reasons.push(`Required Context Item ${item.id} applicability is not established`)
      if (item.trust.sourceAuthenticity === "failed" || item.trust.contentIntegrity === "failed") {
        reasons.push(`Required Context Item ${item.id} failed a trust assessment`)
      }
    }
    const assumptions = [...input.sufficiencyAssumptions]
    if (input.warnings.length > 0) assumptions.push(...input.warnings.map((warning) => `Warning retained: ${warning}`))
    if (input.conflicts.some((conflict) => conflict.state === "accepted")) {
      assumptions.push("One or more context conflicts were accepted rather than resolved.")
    }
    const status = reasons.length > 0
      ? "insufficient"
      : assumptions.length > 0
        ? "sufficient-with-assumptions"
        : "sufficient"
    return {
      classification: { level, combinationRisk: input.classificationCombinationRisk },
      sufficiency: {
        status,
        criteria: input.sufficiencyCriteria,
        evaluator: input.sufficiencyEvaluator,
        assumptions,
        reasons,
      },
    }
  }

  private contextPackDigest(value: object): string {
    const copy = { ...(value as Record<string, unknown>) }
    delete copy.packDigest
    delete copy.revision
    delete copy.createdAt
    delete copy.updatedAt
    return canonicalDigest(copy)
  }

  private workflowPlanDigest(value: object): string {
    const copy = { ...(value as Record<string, unknown>) }
    delete copy.planDigest
    delete copy.revision
    delete copy.createdAt
    delete copy.updatedAt
    return canonicalDigest(copy)
  }

  private async validateWorkflow(input: WorkflowPlanInput): Promise<void> {
    await this.validateExactReference(input.subject)
    if (!await this.isExactReferenceCurrent(input.subject)) throw new Error("Workflow subject exact reference is stale")
    const contextById = new Map<string, ContextPack>()
    for (const reference of input.contextPacks) {
      if (reference.recordType !== "context-pack") throw new Error("Workflow context references must target Context Packs")
      const pack = await this.validateExactReference(reference) as ContextPack
      if (!await this.isExactReferenceCurrent(reference)) throw new Error(`Context Pack ${pack.id} exact reference is stale`)
      if (pack.sufficiency.status === "insufficient") throw new Error(`Context Pack ${pack.id} is insufficient for planning`)
      contextById.set(pack.id, pack)
    }
    const tools: ToolDefinition[] = []
    const toolById = new Map<string, ToolDefinition>()
    for (const reference of input.toolDefinitions) {
      if (reference.recordType !== "tool-definition") throw new Error("Workflow tool references must target Tool Definitions")
      const tool = await this.validateExactReference(reference) as ToolDefinition
      if (!await this.isExactReferenceCurrent(reference)) throw new Error(`Tool Definition ${tool.id} exact reference is stale`)
      tools.push(tool)
      toolById.set(tool.id, tool)
    }
    const byId = new Map(input.steps.map((step) => [step.id, step]))
    for (const step of input.steps) {
      if (step.dependsOn.includes(step.id)) throw new Error(`Workflow Step ${step.id} cannot depend on itself`)
      for (const dependency of step.dependsOn) {
        if (!byId.has(dependency)) throw new Error(`Workflow Step dependency ${dependency} is missing`)
      }
      const stepContexts: ContextPack[] = []
      for (const reference of step.contextPacks) {
        if (reference.recordType !== "context-pack") throw new Error(`Workflow Step ${step.id} Context references must target Context Packs`)
        const declared = contextById.get(reference.recordId)
        if (!declared || declared.revision !== reference.revision || canonicalDigest(declared) !== reference.digest) {
          throw new Error(`Workflow Step ${step.id} references Context not declared by the Plan`)
        }
        stepContexts.push(declared)
      }
      for (const pack of stepContexts) {
        if (pack.recipient.id !== step.responsibility.id) {
          throw new Error(`Workflow Step ${step.id} Context recipient does not match its responsible actor`)
        }
      }
      const stepTools: ToolDefinition[] = []
      for (const reference of step.toolDefinitions) {
        if (reference.recordType !== "tool-definition") throw new Error(`Workflow Step ${step.id} Tool references must target Tool Definitions`)
        const declared = toolById.get(reference.recordId)
        if (!declared || declared.revision !== reference.revision || canonicalDigest(declared) !== reference.digest) {
          throw new Error(`Workflow Step ${step.id} references a Tool not declared by the Plan`)
        }
        if (!declared.enabled) throw new Error(`Workflow Step ${step.id} references disabled Tool ${declared.key}`)
        stepTools.push(declared)
      }
      if (step.responsibility.kind === "tool" && stepTools.length === 0) {
        throw new Error(`Tool-responsible Workflow Step ${step.id} requires an exact Tool Definition`)
      }
      if (stepTools.length > 0) {
        const supportedEffects = new Set(stepTools.flatMap((tool) => tool.effectEnvelope))
        for (const effect of step.effectEnvelope) {
          if (!supportedEffects.has(effect)) throw new Error(`Workflow Step ${step.id} effect ${effect} is unsupported by its Tools`)
        }
        const requestedScopes = [...step.scope.read, ...step.scope.write, ...step.scope.effects]
        for (const scope of requestedScopes) {
          if (!stepTools.some((tool) => tool.allowedScopes.some((allowed) => this.locatorContains(allowed, scope)))) {
            throw new Error(`Workflow Step ${step.id} scope is outside its Tool Definitions`)
          }
        }
      }
    }
    const visiting = new Set<string>()
    const visited = new Set<string>()
    const visit = (id: string): void => {
      if (visiting.has(id)) throw new Error("Workflow Step dependency graph contains a cycle")
      if (visited.has(id)) return
      visiting.add(id)
      for (const dependency of byId.get(id)?.dependsOn ?? []) visit(dependency)
      visiting.delete(id)
      visited.add(id)
    }
    for (const step of input.steps) visit(step.id)
    const strategy = input.strategy ?? "sequential"
    if (strategy === "parallel-readonly") {
      for (const step of input.steps) {
        if (step.scope.write.length > 0 || step.scope.effects.length > 0 || step.effectEnvelope.some((effect) => effect !== "observe")) {
          throw new Error("Parallel Founder workflows are read-only; write scopes and effectful envelopes fail closed")
        }
      }
      if (tools.some((tool) => tool.effectEnvelope.some((effect) => effect !== "observe"))) {
        throw new Error("Parallel read-only workflows cannot reference effectful Tool Definitions")
      }
      for (let leftIndex = 0; leftIndex < input.steps.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < input.steps.length; rightIndex += 1) {
          const left = input.steps[leftIndex]!
          const right = input.steps[rightIndex]!
          if (this.parallelScopesConflict(left.scope, right.scope)) {
            throw new Error(`Parallel Workflow Steps ${left.id} and ${right.id} have overlapping effectful scopes`)
          }
        }
      }
    }
  }

  private parallelScopesConflict(left: WorkItem["scope"], right: WorkItem["scope"]): boolean {
    const overlaps = (a: WorkItem["scope"]["read"][number], b: WorkItem["scope"]["read"][number]): boolean => {
      if (a.kind !== b.kind) return false
      if (a.kind === "workspace-relative" && b.kind === "workspace-relative") {
        return a.path === "." || b.path === "." || a.path === b.path || a.path.startsWith(`${b.path}/`) || b.path.startsWith(`${a.path}/`)
      }
      if (a.kind === "logical" && b.kind === "logical") return a.value === b.value
      if (a.kind === "external-uri" && b.kind === "external-uri") return a.uri === b.uri
      return false
    }
    const leftEffects = [...left.write, ...left.effects]
    const rightAll = [...right.read, ...right.write, ...right.effects]
    const rightEffects = [...right.write, ...right.effects]
    const leftAll = [...left.read, ...left.write, ...left.effects]
    return leftEffects.some((scope) => rightAll.some((candidate) => overlaps(scope, candidate))) ||
      rightEffects.some((scope) => leftAll.some((candidate) => overlaps(scope, candidate)))
  }

  private locatorContains(
    allowed: WorkItem["scope"]["read"][number],
    requested: WorkItem["scope"]["read"][number],
  ): boolean {
    if (allowed.kind !== requested.kind) return false
    if (allowed.kind === "workspace-relative" && requested.kind === "workspace-relative") {
      return this.workspacePathContains(allowed.path, requested.path)
    }
    if (allowed.kind === "logical" && requested.kind === "logical") return allowed.value === requested.value
    if (allowed.kind === "external-uri" && requested.kind === "external-uri") return allowed.uri === requested.uri
    return false
  }

  private workspacePathContains(allowed: string, requested: string): boolean {
    return allowed === "." || allowed === requested || requested.startsWith(`${allowed}/`)
  }

  private async validateExactReference(reference: WorkflowPlan["subject"]): Promise<unknown> {
    return this.validateExactDomainReference(reference)
  }

  private async validateExactReferences(references: readonly ExactDomainRecordReference[]): Promise<void> {
    for (const reference of references) await this.validateExactDomainReference(reference)
  }

  async resolveExactDomainRecord(reference: ExactDomainRecordReference): Promise<unknown> {
    return this.validateExactDomainReference(reference)
  }

  private async validateExactDomainReference(referenceInput: ExactDomainRecordReference): Promise<unknown> {
    const reference = exactDomainRecordReferenceSchema.parse(referenceInput)
    let record: unknown
    switch (reference.recordType) {
      case "product": {
        const current = await this.readProduct()
        record = (current.revision ?? 1) === reference.revision
          ? current
          : (await this.readProductRevision(reference.revision)).product
        break
      }
      case "design-revision": record = await this.readDesignRevision(reference.recordId); break
      case "initiative": record = await this.readInitiative(reference.recordId); break
      case "change": record = await this.readCurrentOrHistorical("changes", "change", reference, changeSchema); break
      case "work-item": record = await this.readCurrentOrHistorical("work-items", "work-item", reference, workItemSchema); break
      case "requirement": record = await this.readCurrentOrHistorical("requirements", "requirement", reference, requirementSchema); break
      case "decision": record = await this.readCurrentOrHistorical("decisions", "decision", reference, decisionSchema); break
      case "risk": record = await this.readCurrentOrHistorical("risks", "risk", reference, riskSchema); break
      case "architecture": record = await this.readCurrentOrHistorical("architecture", "architecture-record", reference, architectureRecordSchema); break
      case "evidence": record = await this.readCurrentOrHistorical("evidence", "evidence", reference, evidenceRecordSchema); break
      case "context-pack": record = await this.readCurrentOrHistorical("context-packs", "context-pack", reference, contextPackSchema); break
      case "workflow-plan": record = await this.readCurrentOrHistorical("workflow-plans", "workflow-plan", reference, workflowPlanSchema); break
      case "tool-definition": record = await this.readCurrentOrHistorical("tools", "tool-definition", reference, toolDefinitionSchema); break
      case "instruction-privilege-grant": record = await this.readCurrentOrHistorical(
        "instruction-grants", "instruction-privilege-grant", reference, instructionPrivilegeGrantSchema,
      ); break
      case "run-tool-selection": record = await this.readCurrentOrHistorical(
        "tool-selections", "run-tool-selection", reference, runToolSelectionSchema,
      ); break
      case "run": record = await this.repository.readJson(
        this.repository.resolve("sessions", `run-${reference.recordId}.json`),
        runSchema,
      ); break
    }
    const candidate = record as { id?: string; productId?: string; revision?: number }
    if (candidate.id !== reference.recordId || (candidate.revision ?? 1) !== reference.revision) {
      throw new Error(`Exact ${reference.recordType} reference identity or revision does not match`)
    }
    if (canonicalDigest(record) !== reference.digest) {
      throw new Error(`Exact ${reference.recordType} reference digest does not match`)
    }
    return record
  }

  private async readCurrentOrHistorical<T>(
    directory: string,
    historyType: ProductRecordRevision["recordType"],
    reference: ExactDomainRecordReference,
    schema: ZodType<T>,
  ): Promise<T> {
    const current = await this.readRecord(directory, reference.recordId, schema)
    const currentRevision = (current as { revision?: number }).revision ?? 1
    if (currentRevision === reference.revision) return current
    const history = await this.readRecordHistory(historyType, reference.recordId, reference.revision)
    const snapshot = schema.parse(history.snapshot)
    if (history.recordDigest !== canonicalDigest(snapshot)) {
      throw new Error(`Historical ${reference.recordType} digest does not match its snapshot`)
    }
    return snapshot
  }

  private async isExactReferenceCurrent(reference: ExactDomainRecordReference): Promise<boolean> {
    let current: unknown
    switch (reference.recordType) {
      case "product": current = await this.readProduct(); break
      case "design-revision": {
        const product = await this.readProduct()
        return product.currentDesign?.id === reference.recordId &&
          product.currentDesign.revision === reference.revision &&
          product.currentDesign.digest === reference.digest
      }
      case "initiative": current = await this.readInitiative(reference.recordId); break
      case "change": current = await this.readChange(reference.recordId); break
      case "work-item": current = await this.readWorkItem(reference.recordId); break
      case "requirement": current = await this.readRequirement(reference.recordId); break
      case "decision": current = await this.readDecision(reference.recordId); break
      case "risk": current = await this.readRisk(reference.recordId); break
      case "architecture": current = await this.readArchitectureRecord(reference.recordId); break
      case "evidence": current = await this.readEvidence(reference.recordId); break
      case "context-pack": current = await this.readContextPack(reference.recordId); break
      case "workflow-plan": current = await this.readWorkflowPlan(reference.recordId); break
      case "tool-definition": current = await this.readToolDefinition(reference.recordId); break
      case "instruction-privilege-grant": current = await this.readInstructionPrivilegeGrant(reference.recordId); break
      case "run-tool-selection": current = await this.readRunToolSelection(reference.recordId); break
      case "run": current = await this.repository.readJson(
        this.repository.resolve("sessions", `run-${reference.recordId}.json`), runSchema,
      ); break
    }
    const candidate = current as { revision?: number }
    return (candidate.revision ?? 1) === reference.revision && canonicalDigest(current) === reference.digest
  }

  private async evaluateToolSelection(
    input: RunToolSelectionInput,
    run: Run,
  ): Promise<RunToolSelection["readiness"]> {
    const product = await this.readProduct()
    const charter = await this.repository.readJson(
      this.repository.resolve("sessions", `charter-${run.charterId}.json`),
      executionCharterSchema,
    )
    const tools: ToolDefinition[] = []
    for (const reference of input.tools) {
      if (reference.recordType !== "tool-definition") throw new Error("Run Tool Selections require Tool Definition references")
      tools.push(await this.validateExactReference(reference) as ToolDefinition)
    }
    const issues: string[] = []
    if (run.state !== "prepared") issues.push(`Tool Selection can be evaluated only for a prepared Run: ${run.state}`)
    if (!input.workspaceTrusted) issues.push("Workspace trust is required and must be revalidated locally before launch")
    const selectedIds = new Set(tools.map((tool) => tool.id))
    for (const confirmation of input.confirmedToolIds) {
      if (!selectedIds.has(confirmation)) issues.push(`Confirmation references an unselected Tool: ${confirmation}`)
    }
    const supportedEffects = new Set(tools.flatMap((tool) => tool.effectEnvelope))
    for (const effect of input.requestedEffects) {
      if (!supportedEffects.has(effect)) issues.push(`Requested effect ${effect} is not declared by any selected Tool`)
      if (!charter.expectedEffects.includes(effect)) {
        issues.push(`Requested effect ${effect} is outside the confirmed Execution Charter`)
      }
    }
    for (const tool of tools) {
      for (const effect of tool.effectEnvelope) {
        if (!input.requestedEffects.includes(effect)) {
          issues.push(`Tool ${tool.key} exposes effect ${effect} outside the exact Run request`)
        }
        if (!charter.expectedEffects.includes(effect)) {
          issues.push(`Tool ${tool.key} exposes effect ${effect} outside the confirmed Execution Charter`)
        }
      }
    }
    for (const scope of input.requestedScopes) {
      if (!tools.some((tool) => tool.allowedScopes.some((allowed) => this.locatorContains(allowed, scope)))) {
        issues.push(`Requested Tool scope ${JSON.stringify(scope)} is not allowed by any selected Tool`)
      }
    }
    for (const tool of tools) {
      if (!tool.enabled) issues.push(`Tool ${tool.key} is disabled`)
      if (tool.policy.allowedProfiles.length > 0 && !tool.policy.allowedProfiles.includes(product.profile)) {
        issues.push(`Tool ${tool.key} is not allowed for Product profile ${product.profile}`)
      }
      if (!input.workspaceTrusted && tool.policy.forbiddenInUntrustedWorkspace) {
        issues.push(`Tool ${tool.key} is forbidden in an untrusted workspace`)
      }
      if (tool.policy.requiresHumanConfirmation && !input.confirmedToolIds.includes(tool.id)) {
        issues.push(`Tool ${tool.key} requires explicit human confirmation`)
      }
      for (const permission of tool.requiredPermissions) {
        const charterPermission = charter.permissions.find((candidate) => candidate.capability === permission.capability)
        const permissionRank = { deny: 0, ask: 1, allow: 2 } as const
        if (!charterPermission || permissionRank[charterPermission.mode] < permissionRank[permission.mode]) {
          issues.push(`Tool ${tool.key} requires permission ${permission.capability} not granted by the Charter`)
        }
        if (charterPermission) {
          for (const requestedScope of input.requestedScopes.filter((scope) => scope.kind === "workspace-relative")) {
            if (!charterPermission.scope.some((allowed) => this.workspacePathContains(allowed, requestedScope.path))) {
              issues.push(`Tool ${tool.key} requested scope ${requestedScope.path} outside Charter permission ${permission.capability}`)
            }
          }
        }
      }
    }
    return {
      status: issues.length > 0 ? "blocked" : "ready",
      issues,
      evaluatedAt: new Date().toISOString(),
    }
  }

  private validatePortableMember(path: string, content: unknown): unknown {
    const validated = this.portableSchemaForPath(path).parse(content)
    if (/^product-history\//.test(path)) {
      const revision = validated as ProductRevision
      if (revision.productDigest !== canonicalDigest(revision.product)) {
        throw new Error(`Import Product history digest mismatch: ${path}`)
      }
    }
    if (/^design-revisions\//.test(path)) {
      const revision = validated as ProductDesignRevision
      if (revision.snapshotDigest !== canonicalDigest(revision.sections)) {
        throw new Error(`Import Design Revision snapshot digest mismatch: ${path}`)
      }
    }
    if (/^context-packs\//.test(path)) {
      const pack = validated as ContextPack
      if (pack.packDigest !== this.contextPackDigest(pack)) {
        throw new Error(`Import Context Pack digest mismatch: ${path}`)
      }
    }
    if (/^workflow-plans\//.test(path)) {
      const plan = validated as WorkflowPlan
      if (plan.planDigest !== this.workflowPlanDigest(plan)) {
        throw new Error(`Import Workflow Plan digest mismatch: ${path}`)
      }
    }
    if (/^record-history\//.test(path)) {
      const history = validated as ProductRecordRevision
      const snapshot = this.schemaForHistoryType(history.recordType).parse(history.snapshot)
      if (history.recordDigest !== canonicalDigest(snapshot)) {
        throw new Error(`Import Record History snapshot digest mismatch: ${path}`)
      }
    }
    if (/^source-history\//.test(path)) {
      const history = validated as SourceRecordRevision
      if (history.recordDigest !== canonicalDigest(history.snapshot)) {
        throw new Error(`Import Source history snapshot digest mismatch: ${path}`)
      }
    }
    if (/^source-baselines\//.test(path) || /^source-baseline-history\//.test(path)) {
      const baseline = validated as SourceBaseline
      if (baseline.membershipDigest !== canonicalDigest(baseline.members)) {
        throw new Error(`Import Source Baseline membership digest mismatch: ${path}`)
      }
    }
    return validated
  }

  private async validateImportGraph(
    recordsByPath: ReadonlyMap<string, unknown>,
    bundle: ProductExportBundle,
  ): Promise<void> {
    const product = productSchema.parse(recordsByPath.get("product.json"))
    const exactRecords = new Map<string, unknown>()
    const currentByHistoryKey = new Map<string, unknown>()
    const exactKey = (recordType: string, recordId: string, revision: number, digest: string) =>
      `${recordType}:${recordId}:${revision}:${digest}`
    const addExact = (recordType: string, record: unknown): void => {
      const candidate = record as { id?: string; revision?: number }
      if (!candidate.id) throw new Error(`Import ${recordType} record has no logical identity`)
      const revision = candidate.revision ?? 1
      const key = exactKey(recordType, candidate.id, revision, canonicalDigest(record))
      const previous = exactRecords.get(key)
      if (previous && canonicalDigest(previous) !== canonicalDigest(record)) {
        throw new Error(`Import exact record identity is ambiguous: ${recordType}:${candidate.id}@${revision}`)
      }
      exactRecords.set(key, record)
    }
    const resolveExact = (reference: ExactDomainRecordReference): unknown => {
      const validated = exactDomainRecordReferenceSchema.parse(reference)
      const record = exactRecords.get(exactKey(
        validated.recordType,
        validated.recordId,
        validated.revision,
        validated.digest,
      ))
      if (!record) throw new Error(`Import exact reference is unresolved: ${validated.recordType}:${validated.recordId}@${validated.revision}`)
      return record
    }

    addExact("product", product)
    const productHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("product-history/"))
      .map(([, record]) => productRevisionSchema.parse(record))
      .sort((left, right) => left.revision - right.revision)
    if (productHistory.length !== (product.revision ?? 1)) {
      throw new Error("Import Product history must contain every revision through the current Product")
    }
    for (const [index, history] of productHistory.entries()) {
      if (history.revision !== index + 1) throw new Error("Import Product history revisions must be contiguous")
      addExact("product", history.product)
    }
    if (canonicalDigest(productHistory.at(-1)?.product) !== canonicalDigest(product)) {
      throw new Error("Import current Product does not match the latest Product history snapshot")
    }

    const designRevisions = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("design-revisions/"))
      .map(([, record]) => productDesignRevisionSchema.parse(record))
      .sort((left, right) => left.revision - right.revision)
    for (const [index, revision] of designRevisions.entries()) {
      if (revision.revision !== index + 1) throw new Error("Import Design Revision history must be contiguous")
      if (index === 0 ? revision.predecessorId !== undefined : revision.predecessorId !== designRevisions[index - 1]?.id) {
        throw new Error("Import Design Revision predecessor chain is invalid")
      }
      const draft = productDesignDraftSchema.parse({
        schemaVersion: 1,
        kind: "product-design-draft",
        id: revision.sourceDraftId,
        productId: revision.productId,
        revision: revision.sourceDraftRevision,
        baseProductRevision: Math.max(1, revision.productRevision - 1),
        sections: revision.sections,
        createdAt: revision.createdAt,
        updatedAt: revision.readiness.evaluatedAt,
      })
      const recomputed = this.evaluateDesignReadiness(draft, revision.readiness.evaluatedAt)
      if (canonicalDigest(recomputed) !== canonicalDigest(revision.readiness)) {
        throw new Error(`Import Design Revision ${revision.id} carries a forged or stale readiness report`)
      }
      addExact("design-revision", revision)
    }
    if (product.currentDesign) {
      const currentDesign = designRevisions.find((revision) => revision.id === product.currentDesign?.id)
      if (
        !currentDesign ||
        currentDesign.revision !== product.currentDesign.revision ||
        canonicalDigest(currentDesign) !== product.currentDesign.digest
      ) throw new Error("Import Product current Design binding is unresolved or does not match its exact digest")
    } else if (designRevisions.length > 0) {
      throw new Error("Import Product has Design Revisions but no exact current Design binding; migration is required")
    }

    const pathRecordTypes: ReadonlyArray<readonly [RegExp, string, ProductRecordRevision["recordType"] | undefined]> = [
      [/^initiatives\//, "initiative", undefined],
      [/^changes\//, "change", "change"],
      [/^work-items\//, "work-item", "work-item"],
      [/^requirements\//, "requirement", "requirement"],
      [/^decisions\//, "decision", "decision"],
      [/^risks\//, "risk", "risk"],
      [/^architecture\//, "architecture", "architecture-record"],
      [/^evidence\//, "evidence", "evidence"],
      [/^context-packs\//, "context-pack", "context-pack"],
      [/^workflow-plans\//, "workflow-plan", "workflow-plan"],
      [/^tools\//, "tool-definition", "tool-definition"],
      [/^instruction-grants\//, "instruction-privilege-grant", "instruction-privilege-grant"],
      [/^tool-selections\//, "run-tool-selection", "run-tool-selection"],
    ]
    for (const [path, record] of recordsByPath) {
      const mapping = pathRecordTypes.find(([pattern]) => pattern.test(path))
      if (!mapping) continue
      addExact(mapping[1], record)
      if (mapping[2]) {
        const candidate = record as { id: string }
        currentByHistoryKey.set(`${mapping[2]}:${candidate.id}`, record)
      }
    }
    for (const [path, record] of recordsByPath) {
      if (/^sessions\/run-/.test(path)) addExact("run", runSchema.parse(record))
    }

    const histories = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("record-history/"))
      .map(([, record]) => productRecordRevisionSchema.parse(record))
    const historyGroups = new Map<string, ProductRecordRevision[]>()
    for (const history of histories) {
      const groupKey = `${history.recordType}:${history.recordId}`
      const group = historyGroups.get(groupKey) ?? []
      group.push(history)
      historyGroups.set(groupKey, group)
      const referenceType = history.recordType === "architecture-record" ? "architecture" : history.recordType
      addExact(referenceType, history.snapshot)
    }
    for (const [key, current] of currentByHistoryKey) {
      const currentRevision = (current as { revision: number }).revision
      const group = (historyGroups.get(key) ?? []).sort((left, right) => left.revision - right.revision)
      if (group.length !== currentRevision) throw new Error(`Import immutable history is incomplete for ${key}`)
      for (const [index, history] of group.entries()) {
        if (history.revision !== index + 1) throw new Error(`Import immutable history is non-contiguous for ${key}`)
        if (index === 0 && history.predecessorDigest !== undefined) {
          throw new Error(`Import first immutable history revision has a predecessor for ${key}`)
        }
        if (index > 0 && history.predecessorDigest !== group[index - 1]?.recordDigest) {
          throw new Error(`Import immutable history predecessor digest is invalid for ${key}`)
        }
      }
      if (group.at(-1)?.recordDigest !== canonicalDigest(current)) {
        throw new Error(`Import current record does not match immutable history for ${key}`)
      }
    }
    for (const key of historyGroups.keys()) {
      if (!currentByHistoryKey.has(key)) throw new Error(`Import immutable history has no current record: ${key}`)
    }

    const initiatives = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("initiatives/"))
      .map(([, record]) => initiativeSchema.parse(record))
    const initiativesById = new Map(initiatives.map((initiative) => [initiative.id, initiative]))
    const changes = [...recordsByPath.entries()].filter(([path]) => path.startsWith("changes/"))
      .map(([, record]) => changeSchema.parse(record))
    const changesById = new Map(changes.map((change) => [change.id, change]))

    const sources = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("sources/"))
      .map(([, record]) => sourceRecordSchema.parse(record))
    const currentSourceById = new Map(sources.map((source) => [source.id, source]))
    const sourceHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("source-history/"))
      .map(([, record]) => sourceRecordRevisionSchema.parse(record))
    const sourceHistoryGroups = new Map<string, SourceRecordRevision[]>()
    const exactSources = new Map<string, SourceRecordRevision>()
    const exactSourceKey = (
      sourceId: string,
      revision: number,
      recordDigest: string,
      contentDigest: string,
    ) => `${sourceId}:${revision}:${recordDigest}:${contentDigest}`
    for (const history of sourceHistory) {
      const group = sourceHistoryGroups.get(history.sourceId) ?? []
      group.push(history)
      sourceHistoryGroups.set(history.sourceId, group)
      exactSources.set(exactSourceKey(
        history.sourceId,
        history.revision,
        history.recordDigest,
        history.snapshot.contentDigest,
      ), history)
    }
    for (const source of sources) {
      const initiative = initiativesById.get(source.initiativeId)
      if (!initiative) throw new Error(`Import Source ${source.id} has no Initiative`)
      const group = (sourceHistoryGroups.get(source.id) ?? [])
        .sort((left, right) => left.revision - right.revision)
      if (group.length !== source.revision) {
        throw new Error(`Import immutable Source history is incomplete for ${source.id}`)
      }
      for (const [index, history] of group.entries()) {
        if (
          history.revision !== index + 1 ||
          (index === 0 && history.predecessorDigest !== undefined) ||
          (index > 0 && history.predecessorDigest !== group[index - 1]?.recordDigest)
        ) throw new Error(`Import immutable Source history predecessor chain is invalid for ${source.id}`)
      }
      if (group.at(-1)?.recordDigest !== canonicalDigest(source)) {
        throw new Error(`Import current Source does not match immutable history for ${source.id}`)
      }
    }
    for (const sourceId of sourceHistoryGroups.keys()) {
      if (!currentSourceById.has(sourceId)) {
        throw new Error(`Import immutable Source history has no current record: ${sourceId}`)
      }
    }
    const resolveExactSource = (reference: SourceBaseline["members"][number]): SourceRecordRevision => {
      const history = exactSources.get(exactSourceKey(
        reference.sourceId,
        reference.sourceRevision,
        reference.recordDigest,
        reference.contentDigest,
      ))
      if (!history) {
        throw new Error(`Import exact Source reference is unresolved: ${reference.sourceId}@${reference.sourceRevision}`)
      }
      return history
    }

    const sourceBaselines = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("source-baselines/"))
      .map(([, record]) => sourceBaselineSchema.parse(record))
    const currentBaselineById = new Map(sourceBaselines.map((baseline) => [baseline.id, baseline]))
    const sourceBaselineHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("source-baseline-history/"))
      .map(([, record]) => sourceBaselineSchema.parse(record))
    const sourceBaselineHistoryGroups = new Map<string, SourceBaseline[]>()
    for (const baseline of sourceBaselineHistory) {
      const group = sourceBaselineHistoryGroups.get(baseline.id) ?? []
      group.push(baseline)
      sourceBaselineHistoryGroups.set(baseline.id, group)
    }
    const validateBaselineMembers = (baseline: SourceBaseline): void => {
      if (!initiativesById.has(baseline.initiativeId)) {
        throw new Error(`Import Source Baseline ${baseline.id} has no Initiative`)
      }
      for (const member of baseline.members) {
        const source = resolveExactSource(member).snapshot
        if (source.initiativeId !== baseline.initiativeId) {
          throw new Error(`Import Source Baseline ${baseline.id} contains a Source from another Initiative`)
        }
      }
    }
    for (const baseline of sourceBaselines) {
      const group = (sourceBaselineHistoryGroups.get(baseline.id) ?? [])
        .sort((left, right) => left.revision - right.revision)
      if (group.length !== baseline.revision) {
        throw new Error(`Import immutable Source Baseline history is incomplete for ${baseline.id}`)
      }
      for (const [index, revision] of group.entries()) {
        if (
          revision.revision !== index + 1 ||
          (index === 0 && revision.predecessorDigest !== undefined) ||
          (index > 0 && revision.predecessorDigest !== canonicalDigest(group[index - 1]))
        ) throw new Error(`Import Source Baseline predecessor chain is invalid for ${baseline.id}`)
        validateBaselineMembers(revision)
      }
      if (canonicalDigest(group.at(-1)) !== canonicalDigest(baseline)) {
        throw new Error(`Import current Source Baseline does not match immutable history for ${baseline.id}`)
      }
    }
    for (const baselineId of sourceBaselineHistoryGroups.keys()) {
      if (!currentBaselineById.has(baselineId)) {
        throw new Error(`Import immutable Source Baseline history has no current snapshot: ${baselineId}`)
      }
    }

    const sourceProvenance = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("source-provenance/"))
      .map(([, record]) => sourceProvenanceSchema.parse(record))
    const sourceProvenanceById = new Map(sourceProvenance.map((record) => [record.id, record]))
    for (const provenance of sourceProvenance) {
      if (!initiativesById.has(provenance.initiativeId)) {
        throw new Error(`Import Source Provenance ${provenance.id} has no Initiative`)
      }
      const availableDigests = new Set<string>()
      const transformationOutputs = new Set<string>()
      for (const source of provenance.sources) {
        const resolved = resolveExactSource(source.reference).snapshot
        if (resolved.initiativeId !== provenance.initiativeId) {
          throw new Error(`Import Source Provenance ${provenance.id} contains a Source from another Initiative`)
        }
        availableDigests.add(source.reference.contentDigest)
      }
      for (const transformation of provenance.transformations) {
        if (transformation.inputDigests.some((digest) => !availableDigests.has(digest))) {
          throw new Error(`Import Source Provenance ${provenance.id} has an unresolved transformation input`)
        }
        if (transformationOutputs.has(transformation.outputDigest)) {
          throw new Error(`Import Source Provenance ${provenance.id} reuses a transformation output digest`)
        }
        transformationOutputs.add(transformation.outputDigest)
        availableDigests.add(transformation.outputDigest)
      }
      const provenanceTargetDigest = provenance.target.kind === "governed-record"
        ? provenance.target.reference.digest
        : provenance.target.digest
      if (!availableDigests.has(provenanceTargetDigest)) {
        throw new Error(`Import Source Provenance ${provenance.id} target is not produced by its exact lineage`)
      }
      if (provenance.target.kind === "governed-record") resolveExact(provenance.target.reference)
      if (provenance.generation.kind === "run") resolveExact(provenance.generation.run)
      if (provenance.amendment) {
        const amended = sourceProvenanceById.get(provenance.amendment.recordId)
        if (
          !amended ||
          amended.initiativeId !== provenance.initiativeId ||
          canonicalDigest(amended) !== provenance.amendment.recordDigest
        ) throw new Error(`Import Source Provenance ${provenance.id} amendment is unresolved`)
      }
    }

    for (const change of changes) {
      if (!initiativesById.has(change.initiativeId)) throw new Error(`Import Change ${change.id} has no Initiative`)
      if (change.baseline.kind === "exact") {
        if (change.baseline.subjectType === "external") {
          const attestation = change.baseline.externalAttestation
          if (!attestation) throw new Error(`Import Change ${change.id} external baseline lacks attestation`)
          const evidence = [...recordsByPath.entries()]
            .filter(([path]) => path.startsWith("evidence/"))
            .map(([, record]) => evidenceRecordSchema.parse(record))
            .find((record) => record.id === attestation.evidenceRecordId)
          if (
            !evidence ||
            evidence.verification.status !== "verified" ||
            evidence.freshness.status !== "fresh" ||
            evidence.artifactDigest !== change.baseline.digest ||
            evidence.verification.verifier?.kind !== attestation.verifiedBy.kind ||
            evidence.verification.verifier?.id !== attestation.verifiedBy.id ||
            evidence.verification.verifiedAt !== attestation.verifiedAt ||
            canonicalDigest(evidence.limitations) !== canonicalDigest(attestation.limitations)
          ) {
            throw new Error(`Import Change ${change.id} external baseline attestation is invalid`)
          }
          this.assertEvidenceFreshness(evidence)
          const locatorIdentity = evidence.origin.locator.kind === "external-uri"
            ? evidence.origin.locator.uri
            : evidence.origin.locator.kind === "logical"
              ? evidence.origin.locator.value
              : undefined
          if (locatorIdentity !== change.baseline.subjectId) {
            throw new Error(`Import Change ${change.id} external baseline Evidence targets a different source`)
          }
          if (evidence.validUntil && Date.parse(evidence.validUntil) <= Date.now()) {
            throw new Error(`Import Change ${change.id} external baseline Evidence is expired`)
          }
        } else {
          const referenceType = change.baseline.subjectType
          resolveExact({
            recordType: referenceType,
            recordId: change.baseline.subjectId,
            revision: change.baseline.revision,
            digest: change.baseline.digest,
          })
        }
      }
    }

    const workItems = [...recordsByPath.entries()].filter(([path]) => path.startsWith("work-items/"))
      .map(([, record]) => workItemSchema.parse(record))
    for (const item of workItems) {
      if (!changesById.has(item.changeId)) throw new Error(`Import Work Item ${item.id} has no Change`)
    }
    for (const change of changes) {
      const items = workItems.filter((item) => item.changeId === change.id)
      const byId = new Map(items.map((item) => [item.id, item]))
      const visiting = new Set<string>()
      const visited = new Set<string>()
      const visit = (id: string): void => {
        if (visiting.has(id)) throw new Error(`Import Work Item dependency graph contains a cycle in Change ${change.id}`)
        if (visited.has(id)) return
        const item = byId.get(id)
        if (!item) throw new Error(`Import Work Item dependency ${id} is missing from Change ${change.id}`)
        visiting.add(id)
        for (const dependency of item.dependsOn) visit(dependency)
        visiting.delete(id)
        visited.add(id)
      }
      for (const item of items) visit(item.id)
      if (change.state === "completed" && (items.length === 0 || items.some((item) => item.state !== "completed"))) {
        throw new Error(`Import completed Change ${change.id} lacks a fully completed Work Item graph`)
      }
    }

    const exactReferenceGroups: ExactDomainRecordReference[][] = []
    for (const [, record] of recordsByPath) {
      if (this.safeStartsWithKind(record, "requirement")) exactReferenceGroups.push(requirementSchema.parse(record).sourceRecords)
      if (this.safeStartsWithKind(record, "decision")) exactReferenceGroups.push(decisionSchema.parse(record).affectedRecords)
      if (this.safeStartsWithKind(record, "risk")) exactReferenceGroups.push(riskSchema.parse(record).evidence)
      if (this.safeStartsWithKind(record, "architecture-record")) exactReferenceGroups.push(architectureRecordSchema.parse(record).affectedRecords)
      if (this.safeStartsWithKind(record, "evidence")) exactReferenceGroups.push(evidenceRecordSchema.parse(record).subjects)
    }
    for (const references of exactReferenceGroups) for (const reference of references) resolveExact(reference)

    const grants = [...recordsByPath.entries()].filter(([path]) => path.startsWith("instruction-grants/"))
      .map(([, record]) => instructionPrivilegeGrantSchema.parse(record))
    const currentGrantById = new Map(grants.map((grant) => [grant.id, grant]))
    for (const grant of grants) {
      const authority = resolveExact(grant.authority)
      const authorityHistoryType = grant.authority.recordType === "architecture"
        ? "architecture-record"
        : grant.authority.recordType
      const currentAuthority = currentByHistoryKey.get(`${authorityHistoryType}:${grant.authority.recordId}`)
      if (!currentAuthority || canonicalDigest(currentAuthority) !== grant.authority.digest) {
        throw new Error(`Import Instruction Privilege Grant ${grant.id} authority is not the current governed revision`)
      }
      if (
        (grant.authority.recordType === "requirement" && !["accepted", "satisfied"].includes(requirementSchema.parse(authority).state)) ||
        (grant.authority.recordType === "decision" && decisionSchema.parse(authority).state !== "decided") ||
        (grant.authority.recordType === "architecture" && architectureRecordSchema.parse(authority).state !== "accepted")
      ) throw new Error(`Import Instruction Privilege Grant ${grant.id} has non-authoritative lifecycle state`)
    }

    const contextPacks = [...recordsByPath.entries()].filter(([path]) => path.startsWith("context-packs/"))
      .map(([, record]) => contextPackSchema.parse(record))
    for (const pack of contextPacks) {
      this.validateContextItemDigests(pack.items)
      for (const item of pack.items) {
        if (!item.instructionPrivilegeGrant) continue
        const exactGrant = instructionPrivilegeGrantSchema.parse(resolveExact(item.instructionPrivilegeGrant))
        const currentGrant = currentGrantById.get(exactGrant.id)
        if (!currentGrant || currentGrant.revision !== exactGrant.revision || currentGrant.state !== "active") {
          throw new Error(`Import Context Pack ${pack.id} references a stale or revoked Instruction Privilege Grant`)
        }
        if (exactGrant.expiresAt && Date.parse(exactGrant.expiresAt) <= Date.now()) {
          throw new Error(`Import Context Pack ${pack.id} references an expired Instruction Privilege Grant`)
        }
        if (
          canonicalDigest(exactGrant.source) !== canonicalDigest(item.source) ||
          exactGrant.sourceDigest !== item.sourceDigest ||
          exactGrant.privilege !== item.trust.instructionPrivilege ||
          canonicalDigest(exactGrant.recipient) !== canonicalDigest(pack.recipient) ||
          exactGrant.purpose !== pack.objective ||
          item.trust.semanticAuthority.scope.some((scope) => !exactGrant.scope.includes(scope))
        ) throw new Error(`Import Context Pack ${pack.id} Instruction Privilege Grant does not bind its exact use`)
      }
      const derived = this.deriveContextEvaluation({
        objective: pack.objective,
        recipient: pack.recipient,
        items: pack.items,
        omissions: pack.omissions,
        warnings: pack.warnings,
        conflicts: pack.conflicts,
        classificationCombinationRisk: pack.classification.combinationRisk,
        sufficiencyCriteria: pack.sufficiency.criteria,
        sufficiencyEvaluator: pack.sufficiency.evaluator,
        sufficiencyAssumptions: pack.sufficiency.assumptions.filter((assumption) => !assumption.startsWith("Warning retained:") && assumption !== "One or more context conflicts were accepted rather than resolved."),
      })
      if (canonicalDigest(derived) !== canonicalDigest({ classification: pack.classification, sufficiency: pack.sufficiency })) {
        throw new Error(`Import Context Pack ${pack.id} carries forged classification or sufficiency`)
      }
    }

    const plans = [...recordsByPath.entries()].filter(([path]) => path.startsWith("workflow-plans/"))
      .map(([, record]) => workflowPlanSchema.parse(record))
    for (const plan of plans) this.validateWorkflowInImport(plan, resolveExact)

    for (const [, record] of recordsByPath) {
      if (!this.safeStartsWithKind(record, "trace-link")) continue
      const link = traceLinkSchema.parse(record)
      for (const endpoint of [link.source, link.target]) {
        if (endpoint.recordType === "external") continue
        resolveExact({
          recordType: endpoint.recordType,
          recordId: endpoint.recordId,
          revision: endpoint.revision!,
          digest: endpoint.digest!,
        })
      }
      this.assertTraceRelationship(link.source, link.relationship, link.target)
    }

    const runs = [...recordsByPath.entries()].filter(([path]) => /^sessions\/run-/.test(path))
      .map(([, record]) => runSchema.parse(record))
    const charters = [...recordsByPath.entries()].filter(([path]) => /^sessions\/charter-/.test(path))
      .map(([, record]) => executionCharterSchema.parse(record))
    const runsById = new Map(runs.map((run) => [run.id, run]))
    const chartersById = new Map(charters.map((charter) => [charter.id, charter]))
    for (const run of runs) {
      const charter = chartersById.get(run.charterId)
      if (!charter) throw new Error(`Import Run ${run.id} has no Execution Charter`)
      if (
        run.productId !== charter.productId ||
        run.initiativeId !== charter.initiativeId ||
        canonicalDigest(run.agent) !== canonicalDigest(charter.agent) ||
        (run.charterDigest !== undefined && run.charterDigest !== canonicalDigest(charter))
      ) throw new Error(`Import Run ${run.id} does not match its exact Execution Charter`)
    }
    for (const [, record] of recordsByPath) {
      if (!this.safeStartsWithKind(record, "run-tool-selection")) continue
      const selection = runToolSelectionSchema.parse(record)
      const run = runsById.get(selection.runId)
      if (!run) throw new Error(`Import Run Tool Selection ${selection.id} has no Run`)
      const charter = chartersById.get(run.charterId)
      if (!charter) throw new Error(`Import Run Tool Selection ${selection.id} has no Charter`)
      const tools = selection.tools.map((reference) => toolDefinitionSchema.parse(resolveExact(reference)))
      for (const tool of tools) {
        for (const effect of tool.effectEnvelope) {
          if (!selection.requestedEffects.includes(effect) || !charter.expectedEffects.includes(effect)) {
            throw new Error(`Import Run Tool Selection ${selection.id} contains effect capability widening`)
          }
        }
      }
      for (const scope of selection.requestedScopes) {
        if (!tools.some((tool) => tool.allowedScopes.some((allowed) => this.locatorContains(allowed, scope)))) {
          throw new Error(`Import Run Tool Selection ${selection.id} contains an out-of-scope Tool grant`)
        }
      }
    }

    const managedRuns = [...recordsByPath.entries()].filter(([path]) => /^sessions\/managed-run-/.test(path))
      .map(([, record]) => managedRunRecordSchema.parse(record))
    const managedEvidence = [...recordsByPath.entries()].filter(([path]) => /^sessions\/managed-evidence-/.test(path))
      .map(([, record]) => managedRunEvidenceSchema.parse(record))
    const managedResults = [...recordsByPath.entries()].filter(([path]) => /^sessions\/managed-result-/.test(path))
      .map(([, record]) => managedRunResultSchema.parse(record))
    const managedApplyDecisions = [...recordsByPath.entries()].filter(([path]) => /^sessions\/managed-apply-decision-/.test(path))
      .map(([, record]) => managedApplyDecisionReceiptSchema.parse(record))
    const managedById = new Map(managedRuns.map((record) => [record.id, record]))
    const evidenceById = new Map(managedEvidence.map((record) => [record.id, record]))
    const resultById = new Map(managedResults.map((record) => [record.id, record]))
    const applyDecisionById = new Map(managedApplyDecisions.map((record) => [record.id, record]))
    const successorCounts = new Map<string, number>()
    for (const managed of managedRuns) {
      if (
        canonicalDigest(managed.bindingSnapshots.initiative) !== managed.bindings.initiative.digest ||
        canonicalDigest(managed.bindingSnapshots.run) !== managed.bindings.run.digest
      ) throw new Error(`Import Managed Run ${managed.id} binding snapshots do not match their exact digests`)
      addExact("initiative", managed.bindingSnapshots.initiative)
      addExact("run", managed.bindingSnapshots.run)
    }
    const resolveManagedBinding = (binding: ManagedRunRecord["bindings"]["product"]): unknown => {
      if (binding.recordType === "execution-charter") {
        const charter = chartersById.get(binding.recordId)
        if (!charter || binding.revision !== 1 || canonicalDigest(charter) !== binding.digest) {
          throw new Error(`Import Managed Run exact Charter binding is unresolved: ${binding.recordId}`)
        }
        return charter
      }
      const record = exactRecords.get(exactKey(binding.recordType, binding.recordId, binding.revision, binding.digest))
      if (!record) throw new Error(`Import Managed Run exact binding is unresolved: ${binding.recordType}:${binding.recordId}@${binding.revision}`)
      return record
    }
    for (const managed of managedRuns) {
      if (managed.bindingsDigest !== canonicalDigest(managed.bindings)) {
        throw new Error(`Import Managed Run ${managed.id} bindings digest does not match`)
      }
      const boundProduct = productSchema.parse(resolveManagedBinding(managed.bindings.product))
      const boundInitiative = initiativeSchema.parse(resolveManagedBinding(managed.bindings.initiative))
      const boundRun = runSchema.parse(resolveManagedBinding(managed.bindings.run))
      const boundCharter = executionCharterSchema.parse(resolveManagedBinding(managed.bindings.charter))
      for (const binding of managed.bindings.contextPacks) contextPackSchema.parse(resolveManagedBinding(binding))
      for (const binding of managed.bindings.tools) toolDefinitionSchema.parse(resolveManagedBinding(binding))
      if (managed.bindings.workflowPlan) workflowPlanSchema.parse(resolveManagedBinding(managed.bindings.workflowPlan))
      if (managed.bindings.runToolSelection) runToolSelectionSchema.parse(resolveManagedBinding(managed.bindings.runToolSelection))
      if (
        boundProduct.id !== managed.productId ||
        boundInitiative.id !== managed.initiativeId ||
        boundRun.id !== managed.runId ||
        boundRun.charterId !== boundCharter.id ||
        boundCharter.productId !== boundProduct.id ||
        boundCharter.initiativeId !== boundInitiative.id ||
        boundRun.charterDigest !== canonicalDigest(boundCharter) ||
        managed.bindings.agentSelectionDigest !== canonicalDigest(boundRun.agent)
      ) throw new Error(`Import Managed Run ${managed.id} exact bindings do not match its execution identity`)
      const intent = boundCharter.managedIntent
      if (!intent) throw new Error(`Import Managed Run ${managed.id} Charter has no exact managed intent`)
      const exactSetDigest = (values: ReadonlyArray<{ recordType: string; recordId: string; revision: number; digest: string }>) =>
        canonicalDigest([...values].sort((left, right) =>
          `${left.recordType}:${left.recordId}:${left.revision}:${left.digest}`
            .localeCompare(`${right.recordType}:${right.recordId}:${right.revision}:${right.digest}`),
        ))
      if (
        !managed.bindings.workflowPlan ||
        canonicalDigest(managed.bindings.workflowPlan) !== canonicalDigest(intent.workflowPlan) ||
        exactSetDigest(managed.bindings.contextPacks) !== exactSetDigest(intent.contextPacks) ||
        exactSetDigest(managed.bindings.tools) !== exactSetDigest(intent.toolDefinitions)
      ) throw new Error(`Import Managed Run ${managed.id} bindings substitute its confirmed Charter intent`)
      if (managed.bindings.runToolSelection) {
        const selection = runToolSelectionSchema.parse(resolveManagedBinding(managed.bindings.runToolSelection))
        if (
          selection.runId !== boundRun.id ||
          canonicalDigest([...selection.requestedEffects].sort()) !== canonicalDigest([...intent.requestedEffects].sort()) ||
          canonicalDigest([...selection.requestedScopes].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))) !==
            canonicalDigest([...intent.requestedScopes].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))) ||
          exactSetDigest(selection.tools) !== exactSetDigest(intent.toolDefinitions)
        ) throw new Error(`Import Managed Run ${managed.id} Tool Selection does not match its confirmed Charter intent`)
      } else if (intent.toolDefinitions.length > 0 || intent.requestedScopes.length > 0) {
        throw new Error(`Import Managed Run ${managed.id} omits the Tool Selection required by its Charter intent`)
      }
      if (managed.previousManagedRunId) {
        const previous = managedById.get(managed.previousManagedRunId)
        if (
          !previous ||
          previous.runId !== managed.runId ||
          previous.productId !== managed.productId ||
          previous.rootManagedRunId !== managed.rootManagedRunId ||
          previous.attemptNumber + 1 !== managed.attemptNumber
        ) {
          throw new Error(`Import Managed Run ${managed.id} previous-run chain is unresolved`)
        }
        successorCounts.set(previous.id, (successorCounts.get(previous.id) ?? 0) + 1)
      }
      if (managed.resultId) {
        const result = resultById.get(managed.resultId)
        if (!result || canonicalDigest(result) !== managed.resultDigest) {
          throw new Error(`Import Managed Run ${managed.id} result binding is unresolved`)
        }
      }
      for (const checkpoint of managed.workflowCheckpoints ?? []) {
        const evidence = evidenceById.get(checkpoint.evidenceId)
        if (!evidence || canonicalDigest(evidence) !== checkpoint.evidenceDigest ||
            evidence.managedRunId !== managed.id || evidence.runId !== managed.runId ||
            evidence.productId !== managed.productId || evidence.bindingsDigest !== managed.bindingsDigest ||
            evidence.staging !== undefined || evidence.workflow.terminalReasonCode !== "workflow-checkpoint" ||
            evidence.workflow.completedStepIds.length !== checkpoint.nextStepIndex ||
            checkpoint.nextStepIndex >= evidence.workflow.orderedStepIds.length ||
            evidence.workflow.charterGates.requiredEvidence.status !== "not-assessed" ||
            evidence.workflow.charterGates.stopConditions.status !== "not-assessed" ||
            evidence.actualEffects.length !== 1 || evidence.actualEffects[0]?.effect !== "observe" ||
            evidence.actualEffects[0]?.status !== "observed-provisional" ||
            canonicalDigest(evidence.workflow.completedStepIds) !== checkpoint.completedStepIdsDigest) {
          throw new Error(`Import Managed Run ${managed.id} Workflow checkpoint binding is unresolved`)
        }
      }
      if (managed.applyDecisionId) {
        const receipt = applyDecisionById.get(managed.applyDecisionId)
        const reviewResult = receipt ? resultById.get(receipt.reviewResultId) : undefined
        const reviewEvidence = receipt ? evidenceById.get(receipt.reviewEvidenceId) : undefined
        if (
          !receipt ||
          canonicalDigest(receipt) !== managed.applyDecisionDigest ||
          receipt.managedRunId !== managed.id ||
          receipt.runId !== managed.runId ||
          receipt.productId !== managed.productId ||
          receipt.bindingsDigest !== managed.bindingsDigest ||
          receipt.managedRunRevision >= managed.revision ||
          !reviewResult ||
          canonicalDigest(reviewResult) !== receipt.reviewResultDigest ||
          reviewResult.managedRunId !== managed.id ||
          reviewResult.runId !== managed.runId ||
          reviewResult.productId !== managed.productId ||
          !reviewEvidence ||
          canonicalDigest(reviewEvidence) !== receipt.reviewEvidenceDigest ||
          reviewEvidence.managedRunId !== managed.id ||
          reviewEvidence.runId !== managed.runId ||
          reviewEvidence.productId !== managed.productId ||
          reviewEvidence.bindingsDigest !== managed.bindingsDigest ||
          reviewResult.evidenceId !== reviewEvidence.id ||
          reviewResult.terminalState !== "review-required" ||
          reviewEvidence.staging?.applyState !== "pending" ||
          canonicalDigest(receipt.changedInventory) !== receipt.changedInventoryDigest ||
          canonicalDigest(receipt.writeEnvelope) !== receipt.writeEnvelopeDigest ||
          canonicalDigest(reviewEvidence.staging?.changes ?? []) !== receipt.changedInventoryDigest ||
          receipt.changedInventory.some((change) => !receipt.writeEnvelope.some((scope) =>
            scope === "." || change.path === scope || change.path.startsWith(`${scope}/`)))
        ) {
          throw new Error(`Import Managed Run ${managed.id} apply-decision binding is unresolved`)
        }
      }
    }
    if ([...successorCounts.values()].some((count) => count > 1)) {
      throw new Error("Import Managed Run resume lineage contains a forbidden branch")
    }
    for (const receipt of managedApplyDecisions) {
      const managed = managedById.get(receipt.managedRunId)
      if (managed?.applyDecisionId !== receipt.id || managed.applyDecisionDigest !== canonicalDigest(receipt)) {
        throw new Error(`Import Managed Apply Decision ${receipt.id} is orphaned or not bound by its Managed Run`)
      }
    }
    const retainedResultIds = new Set<string>()
    const retainedEvidenceIds = new Set<string>(managedRuns.flatMap((managed) =>
      (managed.workflowCheckpoints ?? []).map((checkpoint) => checkpoint.evidenceId)))
    for (const managed of managedRuns) {
      let resultId = managed.resultId
      let expectedDigest = managed.resultDigest
      const lineage = new Set<string>()
      while (resultId) {
        if (lineage.has(resultId)) throw new Error(`Import Managed Run ${managed.id} result lineage contains a cycle`)
        lineage.add(resultId)
        const result = resultById.get(resultId)
        if (!result || canonicalDigest(result) !== expectedDigest || result.managedRunId !== managed.id) {
          throw new Error(`Import Managed Run ${managed.id} result lineage is unresolved`)
        }
        retainedResultIds.add(result.id)
        retainedEvidenceIds.add(result.evidenceId)
        resultId = result.previousResultId
        expectedDigest = result.previousResultDigest
      }
    }
    for (const evidence of managedEvidence) {
      const managed = managedById.get(evidence.managedRunId)
      if (
        !managed ||
        evidence.runId !== managed.runId ||
        evidence.productId !== managed.productId ||
        evidence.bindingsDigest !== managed.bindingsDigest ||
        evidence.eventsDigest !== canonicalDigest(evidence.events)
      ) throw new Error(`Import Managed Evidence ${evidence.id} is orphaned or internally inconsistent`)
      if (evidence.workflow.plan.digest !== managed.bindings.workflowPlan?.digest) {
        throw new Error(`Import Managed Evidence ${evidence.id} substitutes its exact Workflow Plan`)
      }
      const workflowPlan = managed.bindings.workflowPlan
        ? workflowPlanSchema.parse(resolveManagedBinding(managed.bindings.workflowPlan))
        : undefined
      const charter = executionCharterSchema.parse(resolveManagedBinding(managed.bindings.charter))
      if (!workflowPlan || canonicalDigest(evidence.workflow.plan) !== canonicalDigest(managed.bindings.workflowPlan)) {
        throw new Error(`Import Managed Evidence ${evidence.id} has no exact Workflow Plan`)
      }
      if (
        evidence.workflow.charterGates.requiredEvidence.criteriaDigest !== canonicalDigest(charter.requiredEvidence) ||
        evidence.workflow.charterGates.stopConditions.criteriaDigest !== canonicalDigest(charter.stopConditions)
      ) {
        throw new Error(`Import Managed Evidence ${evidence.id} substitutes its exact Charter gate criteria`)
      }
      const gateAssessments = [
        evidence.workflow.charterGates.requiredEvidence,
        evidence.workflow.charterGates.stopConditions,
        ...evidence.workflow.attempts.flatMap((attempt) => [
          attempt.gates.preconditions,
          attempt.gates.outputs,
          attempt.gates.evidence,
          attempt.gates.stopConditions,
        ]),
      ]
      for (const assessment of gateAssessments) {
        if (assessment.evaluator.digest !== canonicalDigest({
          kind: assessment.evaluator.kind,
          id: assessment.evaluator.id,
          version: assessment.evaluator.version,
        })) {
          throw new Error(`Import Managed Evidence ${evidence.id} has an invalid Workflow gate evaluator binding`)
        }
      }
      const byStepId = new Map(workflowPlan.steps.map((step) => [step.id, step]))
      const orderedStepIds: string[] = []
      const completedForOrder = new Set<string>()
      while (orderedStepIds.length < workflowPlan.steps.length) {
        const ready = workflowPlan.steps.filter((step) =>
          !completedForOrder.has(step.id) && step.dependsOn.every((dependency) => completedForOrder.has(dependency)))
        if (ready.length === 0) throw new Error(`Import Managed Evidence ${evidence.id} Workflow order cannot be compiled`)
        const selected = workflowPlan.strategy === "parallel-readonly" ? ready : ready.slice(0, 1)
        for (const step of selected) {
          orderedStepIds.push(step.id)
          completedForOrder.add(step.id)
        }
      }
      if (evidence.workflow.strategy !== workflowPlan.strategy ||
          canonicalDigest(orderedStepIds) !== canonicalDigest(evidence.workflow.orderedStepIds)) {
        throw new Error(`Import Managed Evidence ${evidence.id} carries a forged Workflow order`)
      }
      for (const attempt of evidence.workflow.attempts) {
        const step = byStepId.get(attempt.stepId)
        if (
          !step ||
          attempt.stepIndex !== orderedStepIds.indexOf(step.id) ||
          canonicalDigest(attempt.dependencies) !== canonicalDigest(step.dependsOn) ||
          canonicalDigest(attempt.contextPacks) !== canonicalDigest(step.contextPacks) ||
          canonicalDigest(attempt.tools) !== canonicalDigest(step.toolDefinitions) ||
          canonicalDigest(attempt.effectEnvelope) !== canonicalDigest(step.effectEnvelope) ||
          attempt.gates.preconditions.criteriaDigest !== canonicalDigest(step.preconditions) ||
          attempt.gates.outputs.criteriaDigest !== canonicalDigest(step.outputs) ||
          attempt.gates.evidence.criteriaDigest !== canonicalDigest(step.evidenceCriteria) ||
          attempt.gates.stopConditions.criteriaDigest !== canonicalDigest(step.stopConditions) ||
          (attempt.eventRange !== undefined && attempt.eventRange.endSequence >= evidence.events.length)
        ) throw new Error(`Import Managed Evidence ${evidence.id} has inconsistent Workflow attempt ${attempt.id}`)
      }
      const actuallyCompleted = new Set(evidence.workflow.attempts
        .filter((attempt) => attempt.state === "completed")
        .map((attempt) => attempt.stepId))
      const exactCompletedStepIds = evidence.workflow.orderedStepIds.filter((stepId) => actuallyCompleted.has(stepId))
      if (canonicalDigest(evidence.workflow.completedStepIds) !== canonicalDigest(exactCompletedStepIds)) {
        throw new Error(`Import Managed Evidence ${evidence.id} completed Workflow step set is not exact`)
      }
      if ((evidence.workflow.strategy === "sequential" ||
          ["workflow-checkpoint", "process-loss"].includes(evidence.workflow.terminalReasonCode)) &&
          canonicalDigest(evidence.workflow.completedStepIds) !==
            canonicalDigest(evidence.workflow.orderedStepIds.slice(0, evidence.workflow.completedStepIds.length))) {
        throw new Error(`Import Managed Evidence ${evidence.id} completed Workflow steps are not a sequential dependency prefix`)
      }
      if (evidence.staging?.applyDecision) {
        const receipt = applyDecisionById.get(evidence.staging.applyDecision.receiptId)
        if (
          !receipt ||
          canonicalDigest(receipt) !== evidence.staging.applyDecision.receiptDigest ||
          managed.applyDecisionId !== receipt.id ||
          managed.applyDecisionDigest !== canonicalDigest(receipt) ||
          receipt.managedRunId !== managed.id ||
          receipt.runId !== managed.runId ||
          receipt.productId !== managed.productId ||
          receipt.bindingsDigest !== managed.bindingsDigest
        ) {
          throw new Error(`Import Managed Evidence ${evidence.id} has an unresolved apply-decision receipt`)
        }
      }
    }
    const workflowAttemptHistories = new Map<string, Array<(typeof managedEvidence)[number]["workflow"]["attempts"][number]>>()
    for (const evidence of managedEvidence) {
      for (const attempt of evidence.workflow.attempts) {
        const history = workflowAttemptHistories.get(attempt.id) ?? []
        history.push(attempt)
        workflowAttemptHistories.set(attempt.id, history)
      }
    }
    for (const [attemptId, history] of workflowAttemptHistories) {
      const snapshotsByRevision = new Map<number, (typeof history)[number]>()
      for (const attempt of history) {
        const existing = snapshotsByRevision.get(attempt.revision)
        if (existing && canonicalDigest(existing) !== canonicalDigest(attempt)) {
          throw new Error(`Import Workflow attempt ${attemptId} revision has divergent snapshots`)
        }
        snapshotsByRevision.set(attempt.revision, attempt)
      }
      const snapshots = [...snapshotsByRevision.values()].sort((left, right) => left.revision - right.revision)
      for (const [index, attempt] of snapshots.entries()) {
        if (attempt.revision !== index + 1) {
          throw new Error(`Import Workflow attempt ${attemptId} revision history is incomplete`)
        }
        if (index === 0 ? attempt.previousSnapshotDigest !== undefined :
          attempt.previousSnapshotDigest !== canonicalDigest(snapshots[index - 1])) {
          throw new Error(`Import Workflow attempt ${attemptId} predecessor digest is invalid`)
        }
      }
    }
    for (const result of managedResults) {
      const managed = managedById.get(result.managedRunId)
      const evidence = evidenceById.get(result.evidenceId)
      if (
        !managed ||
        !evidence ||
        result.runId !== managed.runId ||
        result.productId !== managed.productId ||
        result.mode !== managed.mode ||
        canonicalDigest(result.provider) !== canonicalDigest(managed.provider) ||
        evidence.managedRunId !== managed.id ||
        evidence.runId !== result.runId ||
        evidence.productId !== result.productId ||
        evidence.bindingsDigest !== managed.bindingsDigest ||
        result.evidenceDigest !== canonicalDigest(evidence)
      ) throw new Error(`Import Managed Result ${result.id} is orphaned or internally inconsistent`)
      if (!retainedResultIds.has(result.id)) {
        throw new Error(`Import Managed Result ${result.id} is not bound by its Managed Run`)
      }
      if (result.outcome.evaluator && result.outcome.evaluator.digest !== canonicalDigest({
        kind: result.outcome.evaluator.kind,
        id: result.outcome.evaluator.id,
        version: result.outcome.evaluator.version,
      })) {
        throw new Error(`Import Managed Result ${result.id} has an invalid postcondition evaluator binding`)
      }
      const workflowCompleted = evidence.workflow.terminalReasonCode === "workflow-completed" &&
        canonicalDigest(evidence.workflow.completedStepIds) === canonicalDigest(evidence.workflow.orderedStepIds)
      if ((result.terminalState === "completed") !== workflowCompleted) {
        throw new Error(`Import Managed Result ${result.id} terminal state contradicts its Workflow completion evidence`)
      }
      const lastAttempt = evidence.workflow.attempts.at(-1)
      if (result.terminalState === "review-required" &&
          (evidence.workflow.terminalReasonCode !== "apply-review-required" || lastAttempt?.state !== "review-required")) {
        throw new Error(`Import Managed Result ${result.id} review state contradicts its Workflow evidence`)
      }
      if (result.terminalState === "conflict" && evidence.workflow.terminalReasonCode !== "source-workspace-conflict") {
        throw new Error(`Import Managed Result ${result.id} conflict state contradicts its Workflow evidence`)
      }
      if (result.terminalState === "discarded" && evidence.workflow.terminalReasonCode !== "staged-changes-discarded") {
        throw new Error(`Import Managed Result ${result.id} discard state contradicts its Workflow evidence`)
      }
    }
    for (const evidence of managedEvidence) {
      if (!retainedEvidenceIds.has(evidence.id)) {
        throw new Error(`Import Managed Evidence ${evidence.id} is not bound by retained Managed Result lineage`)
      }
    }

    if (bundle.manifest.productId !== product.id) throw new Error("Import graph Product identity mismatch")
  }

  private async readPortableMember(path: string): Promise<unknown> {
    return this.repository.readJson(
      this.repository.resolve(...path.split("/")),
      this.portableSchemaForPath(path),
    )
  }

  private portableRecordTypeForPath(path: string): string {
    if (path === "manifest.json") return "repository-manifest"
    if (path === "product.json") return "product"
    if (/^product-history\/product-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) return "product-revision"
    if (/^design-revisions\/[0-9a-f-]+\.json$/i.test(path)) return "product-design-revision"
    if (/^initiatives\/[0-9a-f-]+\.json$/i.test(path)) return "initiative"
    if (/^changes\/[0-9a-f-]+\.json$/i.test(path)) return "change"
    if (/^work-items\/[0-9a-f-]+\.json$/i.test(path)) return "work-item"
    if (/^requirements\/[0-9a-f-]+\.json$/i.test(path)) return "requirement"
    if (/^decisions\/[0-9a-f-]+\.json$/i.test(path)) return "decision"
    if (/^risks\/[0-9a-f-]+\.json$/i.test(path)) return "risk"
    if (/^architecture\/[0-9a-f-]+\.json$/i.test(path)) return "architecture-record"
    if (/^evidence\/[0-9a-f-]+\.json$/i.test(path)) return "evidence"
    if (/^trace\/[0-9a-f-]+\.json$/i.test(path)) return "trace-link"
    if (/^context-packs\/[0-9a-f-]+\.json$/i.test(path)) return "context-pack"
    if (/^instruction-grants\/[0-9a-f-]+\.json$/i.test(path)) return "instruction-privilege-grant"
    if (/^workflow-plans\/[0-9a-f-]+\.json$/i.test(path)) return "workflow-plan"
    if (/^tools\/[0-9a-f-]+\.json$/i.test(path)) return "tool-definition"
    if (/^tool-selections\/[0-9a-f-]+\.json$/i.test(path)) return "run-tool-selection"
    if (/^sources\/[0-9a-f-]+\.json$/i.test(path)) return "source-record"
    if (/^source-history\/source-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) return "source-record-revision"
    if (/^source-baselines\/[0-9a-f-]+\.json$/i.test(path)) return "source-baseline-snapshot"
    if (/^source-baseline-history\/baseline-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "source-baseline-snapshot"
    }
    if (/^source-provenance\/[0-9a-f-]+\.json$/i.test(path)) return "source-provenance-record"
    if (/^record-history\/[a-z-]+-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) return "product-record-revision"
    if (/^sessions\/charter-[0-9a-f-]+\.json$/i.test(path)) return "execution-charter"
    if (/^sessions\/run-[0-9a-f-]+\.json$/i.test(path)) return "run"
    if (/^sessions\/managed-run-[0-9a-f-]+\.json$/i.test(path)) return "managed-run"
    if (/^sessions\/managed-evidence-[0-9a-f-]+\.json$/i.test(path)) return "managed-run-evidence"
    if (/^sessions\/managed-result-[0-9a-f-]+\.json$/i.test(path)) return "managed-run-result"
    if (/^sessions\/managed-apply-decision-[0-9a-f-]+\.json$/i.test(path)) return "managed-apply-decision"
    if (/^handoffs\/[0-9a-f-]+\.json$/i.test(path)) return "handoff"
    throw new Error(`Import member path is unsupported or non-portable: ${path}`)
  }

  private portableSchemaForPath(path: string): ZodType<unknown> {
    if (path === "manifest.json") return repositoryManifestSchema
    if (path === "product.json") return productSchema
    if (/^product-history\/product-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) return productRevisionSchema
    if (/^design-revisions\/[0-9a-f-]+\.json$/i.test(path)) return productDesignRevisionSchema
    if (/^initiatives\/[0-9a-f-]+\.json$/i.test(path)) return initiativeSchema
    if (/^changes\/[0-9a-f-]+\.json$/i.test(path)) return changeSchema
    if (/^work-items\/[0-9a-f-]+\.json$/i.test(path)) return workItemSchema
    if (/^requirements\/[0-9a-f-]+\.json$/i.test(path)) return requirementSchema
    if (/^decisions\/[0-9a-f-]+\.json$/i.test(path)) return decisionSchema
    if (/^risks\/[0-9a-f-]+\.json$/i.test(path)) return riskSchema
    if (/^architecture\/[0-9a-f-]+\.json$/i.test(path)) return architectureRecordSchema
    if (/^evidence\/[0-9a-f-]+\.json$/i.test(path)) return evidenceRecordSchema
    if (/^trace\/[0-9a-f-]+\.json$/i.test(path)) return traceLinkSchema
    if (/^context-packs\/[0-9a-f-]+\.json$/i.test(path)) return contextPackSchema
    if (/^instruction-grants\/[0-9a-f-]+\.json$/i.test(path)) return instructionPrivilegeGrantSchema
    if (/^workflow-plans\/[0-9a-f-]+\.json$/i.test(path)) return workflowPlanSchema
    if (/^tools\/[0-9a-f-]+\.json$/i.test(path)) return toolDefinitionSchema
    if (/^tool-selections\/[0-9a-f-]+\.json$/i.test(path)) return runToolSelectionSchema
    if (/^sources\/[0-9a-f-]+\.json$/i.test(path)) return sourceRecordSchema
    if (/^source-history\/source-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) return sourceRecordRevisionSchema
    if (/^source-baselines\/[0-9a-f-]+\.json$/i.test(path) ||
        /^source-baseline-history\/baseline-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return sourceBaselineSchema
    }
    if (/^source-provenance\/[0-9a-f-]+\.json$/i.test(path)) return sourceProvenanceSchema
    if (/^record-history\/[a-z-]+-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) return productRecordRevisionSchema
    if (/^sessions\/charter-[0-9a-f-]+\.json$/i.test(path)) return executionCharterSchema
    if (/^sessions\/run-[0-9a-f-]+\.json$/i.test(path)) return runSchema
    if (/^sessions\/managed-run-[0-9a-f-]+\.json$/i.test(path)) return managedRunRecordSchema
    if (/^sessions\/managed-evidence-[0-9a-f-]+\.json$/i.test(path)) return managedRunEvidenceSchema
    if (/^sessions\/managed-result-[0-9a-f-]+\.json$/i.test(path)) return managedRunResultSchema
    if (/^sessions\/managed-apply-decision-[0-9a-f-]+\.json$/i.test(path)) return managedApplyDecisionReceiptSchema
    if (/^handoffs\/[0-9a-f-]+\.json$/i.test(path)) return handoffSchema
    throw new Error(`Import member path is unsupported or non-portable: ${path}`)
  }

  private schemaForHistoryType(recordType: ProductRecordRevision["recordType"]): ZodType<unknown> {
    const schemas: Record<ProductRecordRevision["recordType"], ZodType<unknown>> = {
      change: changeSchema,
      "work-item": workItemSchema,
      requirement: requirementSchema,
      decision: decisionSchema,
      risk: riskSchema,
      "architecture-record": architectureRecordSchema,
      evidence: evidenceRecordSchema,
      "trace-link": traceLinkSchema,
      "context-pack": contextPackSchema,
      "workflow-plan": workflowPlanSchema,
      "tool-definition": toolDefinitionSchema,
      "instruction-privilege-grant": instructionPrivilegeGrantSchema,
      "run-tool-selection": runToolSelectionSchema,
    }
    return schemas[recordType]
  }

  private safeStartsWithKind(value: unknown, kind: string): boolean {
    return Boolean(value && typeof value === "object" && !Array.isArray(value) && (value as { kind?: unknown }).kind === kind)
  }

  private assertJsonDepth(value: unknown, maxDepth: number): void {
    const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }]
    let nodes = 0
    while (stack.length > 0) {
      const current = stack.pop()!
      nodes += 1
      if (nodes > 250_000) throw new Error("Import preview JSON structure exceeds the 250,000-node safety limit")
      if (current.depth > maxDepth) throw new Error(`Import preview JSON nesting exceeds the ${maxDepth}-level safety limit`)
      if (Array.isArray(current.value)) {
        for (const item of current.value) stack.push({ value: item, depth: current.depth + 1 })
      } else if (current.value && typeof current.value === "object") {
        for (const item of Object.values(current.value)) stack.push({ value: item, depth: current.depth + 1 })
      }
    }
  }

  private validateWorkflowInImport(
    plan: WorkflowPlan,
    resolveExact: (reference: ExactDomainRecordReference) => unknown,
  ): void {
    resolveExact(plan.subject)
    const contextById = new Map<string, ContextPack>()
    for (const reference of plan.contextPacks) {
      if (reference.recordType !== "context-pack") throw new Error(`Import Workflow Plan ${plan.id} has a non-Context context reference`)
      const pack = contextPackSchema.parse(resolveExact(reference))
      if (pack.sufficiency.status === "insufficient") throw new Error(`Import Workflow Plan ${plan.id} uses insufficient Context`)
      contextById.set(pack.id, pack)
    }
    const toolById = new Map<string, ToolDefinition>()
    for (const reference of plan.toolDefinitions) {
      if (reference.recordType !== "tool-definition") throw new Error(`Import Workflow Plan ${plan.id} has a non-Tool tool reference`)
      const tool = toolDefinitionSchema.parse(resolveExact(reference))
      toolById.set(tool.id, tool)
    }
    const byId = new Map(plan.steps.map((step) => [step.id, step]))
    const visiting = new Set<string>()
    const visited = new Set<string>()
    const visit = (id: string): void => {
      if (visiting.has(id)) throw new Error(`Import Workflow Plan ${plan.id} contains a cycle`)
      if (visited.has(id)) return
      const step = byId.get(id)
      if (!step) throw new Error(`Import Workflow Plan ${plan.id} has a missing dependency ${id}`)
      visiting.add(id)
      for (const dependency of step.dependsOn) visit(dependency)
      visiting.delete(id)
      visited.add(id)
    }
    for (const step of plan.steps) {
      visit(step.id)
      for (const reference of step.contextPacks) {
        const pack = contextById.get(reference.recordId)
        if (!pack || pack.revision !== reference.revision || canonicalDigest(pack) !== reference.digest) {
          throw new Error(`Import Workflow Step ${step.id} uses undeclared Context`)
        }
        if (pack.recipient.id !== step.responsibility.id) {
          throw new Error(`Import Workflow Step ${step.id} Context recipient mismatch`)
        }
      }
      const stepTools = step.toolDefinitions.map((reference) => {
        const tool = toolById.get(reference.recordId)
        if (!tool || tool.revision !== reference.revision || canonicalDigest(tool) !== reference.digest) {
          throw new Error(`Import Workflow Step ${step.id} uses an undeclared Tool`)
        }
        return tool
      })
      if (step.responsibility.kind === "tool" && stepTools.length === 0) {
        throw new Error(`Import Workflow Step ${step.id} assigns Tool responsibility without an exact Tool`)
      }
      if (stepTools.length > 0) {
        const supportedEffects = new Set(stepTools.flatMap((tool) => tool.effectEnvelope))
        if (step.effectEnvelope.some((effect) => !supportedEffects.has(effect))) {
          throw new Error(`Import Workflow Step ${step.id} has unsupported effects`)
        }
        for (const scope of [...step.scope.read, ...step.scope.write, ...step.scope.effects]) {
          if (!stepTools.some((tool) => tool.allowedScopes.some((allowed) => this.locatorContains(allowed, scope)))) {
            throw new Error(`Import Workflow Step ${step.id} exceeds Tool scope`)
          }
        }
      }
    }
    if (plan.strategy === "parallel-readonly") {
      for (const step of plan.steps) {
        if (step.scope.write.length > 0 || step.scope.effects.length > 0 || step.effectEnvelope.some((effect) => effect !== "observe")) {
          throw new Error(`Import parallel Workflow Plan ${plan.id} is effectful`)
        }
      }
      if ([...toolById.values()].some((tool) => tool.effectEnvelope.some((effect) => effect !== "observe"))) {
        throw new Error(`Import parallel Workflow Plan ${plan.id} references an effectful Tool`)
      }
    }
  }

  private async createSimpleRecord<T extends { id: string; productId: string; revision: number; createdAt: string; updatedAt: string }>(
    directory: string,
    schema: ZodType<T>,
    input: Omit<T, "schemaVersion" | "kind" | "id" | "productId" | "revision" | "createdAt" | "updatedAt">,
    expectedProductRevision: number,
    eventType: string,
    actorId: string,
  ): Promise<T> {
    return this.repository.withLock(async () => {
      this.assertNoReservedKeys(input as Record<string, unknown>, "Record input")
      await this.assertIntegrity()
      const product = await this.requireProductRevision(expectedProductRevision)
      const now = new Date().toISOString()
      const record = schema.parse({
        schemaVersion: 1,
        kind: eventType.slice(0, eventType.indexOf(".")),
        id: randomUUID(),
        productId: product.id,
        revision: 1,
        ...input,
        createdAt: now,
        updatedAt: now,
      })
      await this.commitRecord(directory, record, schema, eventType, actorId)
      return record
    })
  }

  private async reviseSimpleRecord<T extends { id: string; productId: string; revision: number; updatedAt: string }>(
    directory: string,
    id: string,
    expectedRevision: number,
    schema: ZodType<T>,
    patch: Partial<T>,
    eventType: string,
    actorId: string,
    transitionReason?: string,
  ): Promise<T> {
    return this.repository.withLock(async () => {
      this.assertNoReservedKeys(patch as Record<string, unknown>, "Record patch")
      await this.assertIntegrity()
      const current = await this.readRecord(directory, id, schema)
      this.assertExpectedRevision(current.revision, expectedRevision, eventType.split(".")[0] ?? "Record")
      const updated = schema.parse({
        ...current,
        ...patch,
        schemaVersion: (current as Record<string, unknown>).schemaVersion,
        kind: (current as Record<string, unknown>).kind,
        id: current.id,
        productId: (current as Record<string, unknown>).productId,
        createdAt: (current as Record<string, unknown>).createdAt,
        revision: current.revision + 1,
        updatedAt: new Date().toISOString(),
      })
      this.assertMaterialChange(current, updated, "Record")
      await this.commitRecord(directory, updated, schema, eventType, actorId, transitionReason)
      return updated
    })
  }

  private async commitRecord<T extends { id: string; productId: string; revision: number }>(
    directory: string,
    record: T,
    schema: ZodType<T>,
    eventType: string,
    actorId: string,
    transitionReason?: string,
  ): Promise<void> {
    const recordType = this.historyTypeForDirectory(directory)
    const historyWrites: MutationWrite[] = []
    let predecessorDigest: string | undefined
    if (record.revision > 1) {
      const previous = await this.repository.readJson(
        this.repository.resolve(directory, `${record.id}.json`),
        schema,
      )
      const previousRecord = previous as unknown as { revision: number }
      if (previousRecord.revision !== record.revision - 1) {
        throw new Error(`Record history is non-contiguous for ${recordType} ${record.id}`)
      }
      predecessorDigest = canonicalDigest(previous)
      try {
        const persistedPrevious = await this.readRecordHistory(recordType, record.id, previousRecord.revision)
        if (persistedPrevious.recordDigest !== predecessorDigest) {
          throw new Error(`Immutable history does not match current ${recordType} revision ${previousRecord.revision}`)
        }
      } catch (error) {
        if (!this.isMissing(error)) throw error
        if (previousRecord.revision !== 1) {
          throw new Error(
            `Immutable history migration is required for ${recordType} ${record.id}; revisions before ${previousRecord.revision} cannot be reconstructed safely`,
          )
        }
        const previousHistory = this.recordHistoryEnvelope(recordType, previous as T, undefined)
        historyWrites.push(this.governed(
          this.recordHistoryPath(recordType, record.id, previousRecord.revision),
          previousHistory,
          productRecordRevisionSchema,
        ))
      }
    }
    const history = this.recordHistoryEnvelope(recordType, record, predecessorDigest)
    historyWrites.push(this.governed(
      this.recordHistoryPath(recordType, record.id, record.revision),
      history,
      productRecordRevisionSchema,
    ))
    await this.repository.commitMutation({
      writes: [
        this.governed(this.repository.resolve(directory, `${record.id}.json`), record, schema),
        ...historyWrites,
      ],
      audit: {
        eventType,
        actor: { kind: "human", id: actorId },
        subjectId: record.id,
        payload: {
          revision: record.revision,
          recordDigest: canonicalDigest(record),
          ...(transitionReason ? { transitionReason } : {}),
        },
      },
    })
  }

  async readRecordHistory(
    recordType: ProductRecordRevision["recordType"],
    recordId: string,
    revision: number,
  ): Promise<ProductRecordRevision> {
    if (!Number.isInteger(revision) || revision < 1) throw new Error("Historical revision must be a positive integer")
    const id = this.requireUuid(recordId, "Historical record ID")
    const history = await this.repository.readJson(
      this.recordHistoryPath(recordType, id, revision),
      productRecordRevisionSchema,
    )
    if (history.recordType !== recordType || history.recordId !== id || history.revision !== revision) {
      throw new Error("Historical record envelope does not match the requested identity")
    }
    return history
  }

  async listRecordHistory(
    recordType: ProductRecordRevision["recordType"],
    recordId: string,
  ): Promise<ProductRecordRevision[]> {
    const id = this.requireUuid(recordId, "Historical record ID")
    const escapedType = recordType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return this.listRecords(
      "record-history",
      new RegExp(`^${escapedType}-${escapedId}-r[1-9][0-9]*\\.json$`, "i"),
      productRecordRevisionSchema,
    ).then((records) => records.sort((left, right) => right.revision - left.revision))
  }

  private validatePortableDesignSnapshot(value: unknown): PortableDesignImportResult {
    const record = portableDesignImportResultSchema.parse(value)
    const { snapshotDigest, evidence, ...snapshotBody } = record
    if (portableDesignDigest(snapshotBody) !== snapshotDigest) {
      throw new Error("Portable Design Snapshot canonical snapshot digest is invalid")
    }
    const { evidenceDigest, ...evidenceBody } = evidence
    if (portableDesignDigest({ snapshotDigest, ...evidenceBody }) !== evidenceDigest) {
      throw new Error("Portable Design Snapshot canonical evidence digest is invalid")
    }
    const artifactInventory = record.artifacts.map((artifact) => ({
      id: artifact.id,
      path: artifact.path,
      kind: artifact.kind,
      format: artifact.format,
      mediaType: artifact.mediaType,
      sizeBytes: artifact.sizeBytes,
      digest: artifact.digest,
      title: artifact.title,
      targets: artifact.targets,
      validation: artifact.validation,
    }))
    if (portableDesignDigest(artifactInventory) !== evidence.artifactInventoryDigest) {
      throw new Error("Portable Design Snapshot artifact inventory digest is invalid")
    }
    if (JSON.stringify(evidence.checks) !== JSON.stringify(portableDesignExpectedChecks)) {
      throw new Error("Portable Design Snapshot validation check inventory is not exact")
    }
    if (Date.parse(evidence.importedAt) < Date.parse(record.source.exportedAt)) {
      throw new Error("Portable Design Snapshot import evidence predates its source export")
    }
    if (JSON.stringify(evidence.limitations) !== JSON.stringify(portableDesignExpectedLimitations)) {
      throw new Error("Portable Design Snapshot limitation inventory is not exact")
    }
    const artifactIds = record.artifacts.map((artifact) => artifact.id.toLowerCase())
    const artifactPaths = record.artifacts.map((artifact) => artifact.path.toLowerCase())
    if (new Set(artifactIds).size !== artifactIds.length || new Set(artifactPaths).size !== artifactPaths.length) {
      throw new Error("Portable Design Snapshot artifacts collide by case-insensitive identity or path")
    }
    const tokenKeys = new Set<string>()
    const tokenArtifactIds = new Set(record.artifacts
      .filter((artifact) => artifact.validation === "tokens-normalized")
      .map((artifact) => artifact.id.toLowerCase()))
    for (const token of record.tokens) {
      const key = `${token.artifactId.toLowerCase()}:${token.path.toLowerCase()}`
      if (tokenKeys.has(key) || !tokenArtifactIds.has(token.artifactId.toLowerCase()) ||
          portableDesignDigest(token.value) !== token.valueDigest) {
        throw new Error("Portable Design Snapshot normalized token metadata is invalid")
      }
      tokenKeys.add(key)
    }
    return record
  }

  private async assertPortableDesignSnapshotMembership(
    record: PortableDesignImportResult,
    product: Product,
  ): Promise<void> {
    if (record.productId.toLowerCase() !== product.id.toLowerCase()) {
      throw new Error("Portable Design Snapshot targets a different Product")
    }
    if (!record.initiativeId) return
    const initiative = await this.readInitiative(this.requireUuid(
      record.initiativeId,
      "Portable Design Snapshot Initiative ID",
    ))
    if (initiative.id.toLowerCase() !== record.initiativeId.toLowerCase() ||
        initiative.productId.toLowerCase() !== product.id.toLowerCase()) {
      throw new Error("Portable Design Snapshot Initiative does not belong to the exact current Product")
    }
  }

  private async portableDesignCandidateNames(reservedEntries = 0): Promise<string[]> {
    let names: string[]
    try {
      const directoryNames = await this.repository.readDirectory(this.repository.resolve("candidates"))
      if (directoryNames.length + reservedEntries > portableDesignCandidateLimit) {
        throw new Error(`Candidate directory exceeds the ${portableDesignCandidateLimit}-entry safety limit`)
      }
      const portableDesignNames = directoryNames.filter((name) => portableDesignCandidateCaseFoldedPattern.test(name))
      if (portableDesignNames.some((name) => !portableDesignCandidatePattern.test(name))) {
        throw new Error("Portable Design Snapshot filenames must use canonical lowercase UUIDs")
      }
      names = portableDesignNames
    } catch (error) {
      if (this.isMissing(error)) return []
      throw error
    }
    if (names.length > portableDesignCandidateLimit) {
      throw new Error(`Portable Design Snapshot inventory exceeds the ${portableDesignCandidateLimit}-record safety limit`)
    }
    const folded = names.map((name) => name.toLowerCase())
    if (new Set(folded).size !== folded.length) {
      throw new Error("Portable Design Snapshot inventory contains a case-insensitive filename collision")
    }
    return names.sort((left, right) =>
      left.toLowerCase().localeCompare(right.toLowerCase()) || left.localeCompare(right))
  }

  private portableDesignSnapshotFilename(bundleId: string): string {
    return `portable-design-${this.requireUuid(bundleId, "Portable Design Snapshot bundle ID").toLowerCase()}.json`
  }

  private governed<T>(path: string, value: T, schema: ZodType<T>): MutationWrite<T> {
    return { path, value, schema, governed: true }
  }

  private async readRecord<T>(directory: string, id: string, schema: ZodType<T>): Promise<T> {
    return this.repository.readJson(
      this.repository.resolve(directory, `${this.requireUuid(id, `${directory} record ID`)}.json`),
      schema,
    )
  }

  private async listRecords<T>(directory: string, pattern: RegExp, schema: ZodType<T>): Promise<T[]> {
    let names: string[]
    try {
      names = (await this.repository.readDirectory(this.repository.resolve(directory))).filter((name) => pattern.test(name))
    } catch (error) {
      if (this.isMissing(error)) return []
      throw error
    }
    if (names.length > 10_000) {
      throw new Error(`Product record directory ${directory} exceeds the 10,000-record portable safety limit`)
    }
    const records = await Promise.all(names.map((name) =>
      this.repository.readJson(this.repository.resolve(directory, name), schema),
    ))
    return records.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>
      const rightRecord = right as Record<string, unknown>
      return String(rightRecord.updatedAt ?? rightRecord.createdAt ?? rightRecord.recordedAt ?? "")
        .localeCompare(String(leftRecord.updatedAt ?? leftRecord.createdAt ?? leftRecord.recordedAt ?? ""))
    })
  }

  private designDraftPath(productId: string): string {
    return this.repository.resolve("runtime", `design-draft-${productId}.json`)
  }

  private historyTypeForDirectory(directory: string): ProductRecordRevision["recordType"] {
    const recordTypes: Record<string, ProductRecordRevision["recordType"]> = {
      changes: "change",
      "work-items": "work-item",
      requirements: "requirement",
      decisions: "decision",
      risks: "risk",
      architecture: "architecture-record",
      evidence: "evidence",
      trace: "trace-link",
      "context-packs": "context-pack",
      "workflow-plans": "workflow-plan",
      tools: "tool-definition",
      "instruction-grants": "instruction-privilege-grant",
      "tool-selections": "run-tool-selection",
    }
    const recordType = recordTypes[directory]
    if (!recordType) throw new Error(`Immutable history is not registered for Product record directory ${directory}`)
    return recordType
  }

  private recordHistoryEnvelope<T extends { id: string; productId: string; revision: number }>(
    recordType: ProductRecordRevision["recordType"],
    record: T,
    predecessorDigest: string | undefined,
  ): ProductRecordRevision {
    return productRecordRevisionSchema.parse({
      schemaVersion: 1,
      kind: "product-record-revision",
      productId: record.productId,
      recordType,
      recordId: record.id,
      revision: record.revision,
      recordDigest: canonicalDigest(record),
      ...(predecessorDigest ? { predecessorDigest } : {}),
      snapshot: record,
      recordedAt: new Date().toISOString(),
    })
  }

  private recordHistoryPath(
    recordType: ProductRecordRevision["recordType"],
    recordId: string,
    revision: number,
  ): string {
    return this.repository.resolve("record-history", `${recordType}-${recordId}-r${revision}.json`)
  }

  private async requireProductRevision(expected: number): Promise<Product> {
    if (!Number.isInteger(expected) || expected < 1) throw new Error("Expected Product revision must be a positive integer")
    const product = await this.readProduct()
    this.assertExpectedRevision(product.revision ?? 1, expected, "Product")
    return product
  }

  private assertExpectedRevision(actual: number, expected: number, subject: string): void {
    if (actual !== expected) {
      throw new Error(`${subject} revision conflict: expected ${expected}, current ${actual}`)
    }
  }

  private assertMaterialChange(current: unknown, updated: unknown, subject: string): void {
    const withoutRevision = (value: unknown) => {
      const copy = { ...(value as Record<string, unknown>) }
      delete copy.revision
      delete copy.updatedAt
      return copy
    }
    if (canonicalDigest(withoutRevision(current)) === canonicalDigest(withoutRevision(updated))) {
      throw new Error(`${subject} revision has no material changes`)
    }
  }

  private assertDesignSectionsIntegrity(sections: ProductDesignDraft["sections"]): void {
    for (const sectionId of productStudioSectionIds) {
      const section = sections[sectionId]
      const fields = new Map(section.fields.map((field) => [field.key, field]))
      for (const [key, question] of fieldDefinitions[sectionId]) {
        const field = fields.get(key)
        if (!field) continue
        if (field.question !== question) throw new Error(`Design field ${sectionId}.${key} changed its canonical question`)
      }
      for (const gap of section.gaps) {
        if (gap.fieldKey && !fields.has(gap.fieldKey)) throw new Error(`Design gap ${gap.id} references an unknown field`)
      }
      for (const conflict of section.conflicts) {
        if (conflict.fieldKeys.some((key) => !fields.has(key))) {
          throw new Error(`Design conflict ${conflict.id} references an unknown field`)
        }
      }
    }
  }

  private assertAcceptedDesignConflicts(sections: ProductDesignDraft["sections"], actorId: string): void {
    for (const section of Object.values(sections)) {
      for (const conflict of section.conflicts.filter((candidate) => candidate.state === "accepted")) {
        if (conflict.acceptance?.acceptedBy.id !== actorId) {
          throw new Error(`Accepted Design conflict ${conflict.id} must be attributed to the revision actor`)
        }
      }
    }
  }

  private requireTransitionReason(reason: string | undefined, subject: string): string {
    if (!reason || reason.trim().length < 2) throw new Error(`${subject} state transitions require a reason`)
    return reason.trim()
  }

  private assertStateTransition<TState extends string>(
    current: TState,
    next: TState,
    transitions: Record<TState, readonly TState[]>,
    subject: string,
    reason: string | undefined,
  ): void {
    if (!transitions[current].includes(next)) throw new Error(`Invalid ${subject} transition from ${current} to ${next}`)
    this.requireTransitionReason(reason, subject)
  }

  private assertAllowedKeys(value: object, allowed: readonly string[], subject: string): void {
    const allowedSet = new Set(allowed)
    const unexpected = Object.keys(value).filter((key) => !allowedSet.has(key))
    if (unexpected.length > 0) throw new Error(`${subject} contains immutable or unsupported fields: ${unexpected.join(", ")}`)
  }

  private assertNoReservedKeys(value: Record<string, unknown>, subject: string): void {
    const reserved = ["schemaVersion", "kind", "id", "productId", "revision", "createdAt", "updatedAt"]
    const present = reserved.filter((key) => Object.prototype.hasOwnProperty.call(value, key))
    if (present.length > 0) throw new Error(`${subject} cannot replace immutable fields: ${present.join(", ")}`)
  }

  private async assertIntegrity(): Promise<void> {
    const audit = await this.repository.verifyAudit()
    if (!audit.valid) throw new Error(`GAEP workspace integrity is invalid: ${audit.error ?? "unknown error"}`)
  }

  private requireUuid(value: string, label: string): string {
    const result = initiativeSchema.shape.id.safeParse(value)
    if (!result.success) throw new Error(`${label} must be a UUID`)
    return result.data
  }

  private isMissing(error: unknown): boolean {
    return error instanceof Error && "code" in error && error.code === "ENOENT"
  }

  private async validateBaseline(baseline: Change["baseline"], product: Product): Promise<void> {
    if (baseline.kind === "genesis") return
    if (baseline.subjectType === "product") {
      if (baseline.subjectId !== product.id) throw new Error("Product baseline targets a different Product")
      const revision = await this.readProductRevision(baseline.revision)
      if (revision.productDigest !== baseline.digest) throw new Error("Product baseline digest does not match exact history")
    }
    if (baseline.subjectType === "design-revision") {
      const revision = await this.readDesignRevision(baseline.subjectId)
      if (revision.revision !== baseline.revision || canonicalDigest(revision) !== baseline.digest) {
        throw new Error("Design baseline revision or digest does not match")
      }
    }
    if (baseline.subjectType === "architecture" || baseline.subjectType === "requirement") {
      await this.validateExactDomainReference({
        recordType: baseline.subjectType,
        recordId: this.requireUuid(baseline.subjectId, `${baseline.subjectType} baseline ID`),
        revision: baseline.revision,
        digest: baseline.digest,
      })
    }
    if (baseline.subjectType === "external") {
      const attestation = baseline.externalAttestation
      if (!attestation) throw new Error("External baselines require a verified Evidence attestation")
      const evidence = await this.readEvidence(attestation.evidenceRecordId)
      if (evidence.verification.status !== "verified" || evidence.artifactDigest !== baseline.digest) {
        throw new Error("External baseline Evidence must be verified and bind the exact digest")
      }
      this.assertEvidenceFreshness(evidence)
      if (evidence.freshness.status !== "fresh") {
        throw new Error("External baseline Evidence must have an explicit fresh assessment")
      }
      if (
        evidence.verification.verifier?.kind !== attestation.verifiedBy.kind ||
        evidence.verification.verifier?.id !== attestation.verifiedBy.id ||
        evidence.verification.verifiedAt !== attestation.verifiedAt
      ) throw new Error("External baseline attestation does not match Evidence verification")
      if (canonicalDigest(evidence.limitations) !== canonicalDigest(attestation.limitations)) {
        throw new Error("External baseline attestation limitations do not match the Evidence record")
      }
      const locatorIdentity = evidence.origin.locator.kind === "external-uri"
        ? evidence.origin.locator.uri
        : evidence.origin.locator.kind === "logical"
          ? evidence.origin.locator.value
          : undefined
      if (locatorIdentity !== baseline.subjectId) throw new Error("External baseline Evidence targets a different source")
      if (evidence.validUntil && Date.parse(evidence.validUntil) <= Date.now()) {
        throw new Error("External baseline Evidence is expired")
      }
    }
  }

  private async validateWorkGraph(candidate: WorkItem): Promise<void> {
    if (candidate.dependsOn.includes(candidate.id)) throw new Error("Work Item cannot depend on itself")
    const existing = (await this.listWorkItems()).filter((item) => item.changeId === candidate.changeId && item.id !== candidate.id)
    const all = [...existing, candidate]
    const byId = new Map(all.map((item) => [item.id, item]))
    for (const item of all) {
      for (const dependencyId of item.dependsOn) {
        const dependency = byId.get(dependencyId)
        if (!dependency) throw new Error(`Work Item dependency ${dependencyId} does not exist in the same Change`)
      }
    }
    const visiting = new Set<string>()
    const visited = new Set<string>()
    const visit = (id: string): void => {
      if (visiting.has(id)) throw new Error("Work Item dependency graph contains a cycle")
      if (visited.has(id)) return
      visiting.add(id)
      for (const dependency of byId.get(id)?.dependsOn ?? []) visit(dependency)
      visiting.delete(id)
      visited.add(id)
    }
    for (const item of all) visit(item.id)
  }

  private assertEvidenceFreshness(input: MutableEvidence): void {
    const maximumClockSkew = 5 * 60 * 1_000
    const latestAccepted = Date.now() + maximumClockSkew
    if (Date.parse(input.collectedAt) > latestAccepted) throw new Error("Evidence collection time is implausibly in the future")
    if (Date.parse(input.freshness.assessedAt) > latestAccepted) throw new Error("Evidence freshness assessment is implausibly in the future")
    if (input.verification.verifiedAt && Date.parse(input.verification.verifiedAt) > latestAccepted) {
      throw new Error("Evidence verification time is implausibly in the future")
    }
    if (
      input.freshness.status === "fresh" &&
      input.validUntil !== undefined &&
      Date.parse(input.validUntil) <= Date.now()
    ) throw new Error("Expired evidence cannot be recorded as fresh")
  }

  private async assessTraceState(source: TraceEndpoint, target: TraceEndpoint): Promise<TraceLink["state"]> {
    const states = await Promise.all([this.resolveTraceEndpoint(source), this.resolveTraceEndpoint(target)])
    if (states.some((state) => state === "invalid")) return "invalid"
    if (states.some((state) => state === "unresolved")) return "unresolved"
    if (states.some((state) => state === "stale")) return "stale"
    return "valid"
  }

  private async resolveTraceEndpoint(endpoint: TraceEndpoint): Promise<"valid" | "unresolved" | "stale" | "invalid"> {
    if (endpoint.recordType === "external") return "unresolved"
    try {
      const reference = {
        recordType: endpoint.recordType,
        recordId: endpoint.recordId,
        revision: endpoint.revision!,
        digest: endpoint.digest!,
      } satisfies ExactDomainRecordReference
      await this.validateExactDomainReference(reference)
      return await this.isExactReferenceCurrent(reference) ? "valid" : "stale"
    } catch (error) {
      if (this.isMissing(error)) return "unresolved"
      if (error instanceof Error && /revision|digest|historical|stale/i.test(error.message)) return "stale"
      return "invalid"
    }
  }

  private assertTraceRelationship(
    source: TraceEndpoint,
    relationship: TraceLink["relationship"],
    target: TraceEndpoint,
  ): void {
    if (relationship === "related-to") return
    const allowed: Partial<Record<TraceLink["relationship"], ReadonlyArray<readonly [TraceEndpoint["recordType"], TraceEndpoint["recordType"]]>>> = {
      targets: [["initiative", "product"], ["change", "initiative"], ["work-item", "change"]],
      "derives-from": [["requirement", "product"], ["change", "design-revision"], ["context-pack", "requirement"]],
      "contributes-to": [["work-item", "change"], ["change", "initiative"]],
      "depends-on": [["work-item", "work-item"], ["requirement", "requirement"], ["workflow-plan", "context-pack"]],
      implements: [["work-item", "requirement"], ["change", "requirement"]],
      satisfies: [["evidence", "requirement"], ["work-item", "requirement"]],
      validates: [["evidence", "work-item"], ["evidence", "requirement"], ["evidence", "change"], ["evidence", "run"]],
      mitigates: [["work-item", "risk"], ["evidence", "risk"], ["decision", "risk"]],
      decides: [["decision", "requirement"], ["decision", "architecture"], ["decision", "risk"]],
      affects: [["architecture", "requirement"], ["risk", "change"], ["decision", "change"], ["change", "architecture"]],
      supersedes: [["requirement", "requirement"], ["decision", "decision"], ["architecture", "architecture"], ["workflow-plan", "workflow-plan"]],
    }
    const pairs = allowed[relationship] ?? []
    if (!pairs.some(([sourceType, targetType]) => sourceType === source.recordType && targetType === target.recordType)) {
      throw new Error(`Trace relationship ${relationship} is invalid from ${source.recordType} to ${target.recordType}`)
    }
  }

  private recordLabel(kind: ProductDomainRecordKind, record: Record<string, unknown>): string {
    if (kind === "product-revision") return `Product revision ${String(record.revision)}`
    if (kind === "product-design-revision") return `Design revision ${String(record.revision)}`
    return String(record.title ?? record.key ?? record.question ?? record.id)
  }
}

const recordBaseKeys = {
  schemaVersion: true,
  id: true,
  productId: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
} as const
