import { randomUUID } from "node:crypto"
import { lstat, readFile } from "node:fs/promises"
import { isAbsolute } from "node:path"

import {
  architectureRecordSchema,
  changeSchema,
  containsSecretShapedValue,
  contextPackSchema,
  decisionSchema,
  designReadinessReportSchema,
  evidenceRecordSchema,
  executionCharterSchema,
  initiativeSchema,
  productDesignDraftSchema,
  productDesignRevisionSchema,
  productDomainSearchResultSchema,
  productExportBundleSchema,
  productExportManifestSchema,
  productImportPreviewSchema,
  productRevisionSchema,
  productSchema,
  productStudioSectionIds,
  requirementSchema,
  repositoryManifestSchema,
  runToolSelectionSchema,
  riskSchema,
  runSchema,
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
  type Initiative,
  type Product,
  type ProductDesignDraft,
  type ProductDesignRevision,
  type ProductDesignSectionId,
  type ProductDomainRecordKind,
  type ProductDomainSearchResult,
  type ProductExportBundle,
  type ProductImportPreview,
  type ProductRevision,
  type Requirement,
  type Run,
  type RunToolSelection,
  type Risk,
  type TraceEndpoint,
  type TraceImpact,
  type TraceLink,
  type ToolDefinition,
  type WorkItem,
  type WorkflowPlan,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
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

type ProductReader = () => Promise<Product>
type InitiativeReader = (id: string) => Promise<Initiative>

type MutableChange = Pick<Change, "title" | "summary" | "baseline" | "state" | "effectEnvelope">
type NewChange = Omit<MutableChange, "state">
type MutableWorkItem = Pick<WorkItem,
  "title" | "objective" | "state" | "dependsOn" | "completionCriteria" | "evidenceCriteria" | "scope" | "owner"
>
type NewWorkItem = Omit<MutableWorkItem, "state">
type MutableRequirement = Pick<Requirement,
  "key" | "statement" | "rationale" | "priority" | "state" | "verificationCriteria" | "sourceRecordIds"
>
type NewRequirement = Omit<MutableRequirement, "state">
type MutableDecision = Pick<Decision,
  "question" | "options" | "recommendation" | "selectedOutcome" | "dissentAndUncertainty" | "affectedRecordIds" | "state"
>
type NewDecision = Omit<MutableDecision, "selectedOutcome" | "state">
type MutableRisk = Pick<Risk,
  "title" | "cause" | "condition" | "consequence" | "likelihood" | "impact" | "uncertainty" | "treatment" |
  "owner" | "reviewTriggers" | "residualRisk" | "state" | "acceptance"
>
type NewRisk = Omit<MutableRisk, "state" | "acceptance">
type MutableArchitecture = Pick<ArchitectureRecord,
  "recordType" | "title" | "description" | "rationale" | "assumptions" | "constraints" | "affectedRecordIds" | "state"
>
type NewArchitecture = Omit<MutableArchitecture, "state">
type MutableEvidence = Pick<EvidenceRecord,
  "subjectRecordIds" | "origin" | "method" | "result" | "artifactDigest" | "limitations" | "verification" |
  "freshness" | "collectedAt" | "validUntil"
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
  confirmedToolIds: RunToolSelection["confirmedToolIds"]
  workspaceTrusted: boolean
}

export interface ProductStudioSearchInput {
  query: string
  kinds?: ProductDomainRecordKind[]
}

export class ProductStudioService {
  constructor(
    private readonly repository: GaepRepository,
    private readonly readProduct: ProductReader,
    private readonly readInitiative: InitiativeReader,
  ) {}

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
      const updated = productDesignDraftSchema.parse({
        ...current,
        revision: current.revision + 1,
        sections: input.sections,
        updatedAt: now,
      })
      if (canonicalDigest(current.sections) === canonicalDigest(updated.sections)) {
        throw new Error("Design draft has no material changes")
      }
      return this.repository.writeLocalJson(path, updated, productDesignDraftSchema)
    })
  }

  evaluateDesignReadiness(draft: ProductDesignDraft, evaluatedAt = new Date().toISOString()): DesignReadinessReport {
    const validated = productDesignDraftSchema.parse(draft)
    const sections = productStudioSectionIds.map((sectionId) => {
      const section = validated.sections[sectionId]
      const fieldsByKey = new Map(section.fields.map((field) => [field.key, field]))
      const requiredKeys = fieldDefinitions[sectionId].map(([key]) => key)
      const missingFields = requiredKeys.filter((key) => !fieldsByKey.has(key) || fieldsByKey.get(key)?.state === "missing")
      const weakFields = section.fields.filter((field) => field.state === "weak").map((field) => field.key)
      const deferredFields = section.fields.filter((field) => field.state === "deferred").map((field) => field.key)
      const openConflictIds = section.conflicts.filter((conflict) => conflict.state === "open").map((conflict) => conflict.id)
      const blockerGapIds = section.gaps
        .filter((gap) => gap.severity === "blocker" && !gap.resolution)
        .map((gap) => gap.id)
      const state = openConflictIds.length > 0 || blockerGapIds.length > 0
        ? "conflicted"
        : missingFields.length > 0
          ? "missing"
          : weakFields.length > 0
            ? "weak"
            : deferredFields.length > 0
              ? "deferred"
              : "complete"
      return { sectionId, state, missingFields, weakFields, deferredFields, openConflictIds, blockerGapIds }
    })
    const blockingGapIds = sections.flatMap((section) => section.blockerGapIds)
    const openConflictIds = sections.flatMap((section) => section.openConflictIds)
    const deferredFieldCount = sections.reduce((total, section) => total + section.deferredFields.length, 0)
    const incomplete = sections.some((section) => ["missing", "weak", "conflicted"].includes(section.state))
    return designReadinessReportSchema.parse({
      schemaVersion: 1,
      productId: validated.productId,
      draftId: validated.id,
      draftRevision: validated.revision,
      status: incomplete ? "incomplete" : deferredFieldCount > 0 ? "ready-with-deferrals" : "ready",
      sections,
      blockingGapIds,
      openConflictIds,
      deferredFieldCount,
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
      const nextProduct = {
        ...product,
        revision: (product.revision ?? 1) + 1,
        updatedAt: now,
      }
      const designRevision = productDesignRevisionSchema.parse({
        schemaVersion: 1,
        kind: "product-design-revision",
        id: randomUUID(),
        productId: product.id,
        revision: (previous?.revision ?? 0) + 1,
        productRevision: nextProduct.revision,
        predecessorId: previous?.id,
        sourceDraftId: draft.id,
        sourceDraftRevision: draft.revision,
        sections: draft.sections,
        readiness,
        snapshotDigest,
        createdBy: { kind: "human", id: actorId },
        createdAt: now,
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

  async reviseChange(id: string, expectedRevision: number, patch: Partial<MutableChange>, actorId: string): Promise<Change> {
    return this.repository.withLock(async () => {
      this.assertAllowedKeys(patch, ["title", "summary", "baseline", "state", "effectEnvelope"], "Change patch")
      await this.assertIntegrity()
      const current = await this.readChange(id)
      this.assertExpectedRevision(current.revision, expectedRevision, "Change")
      if (patch.state && patch.state !== current.state && !changeTransitions[current.state].includes(patch.state)) {
        throw new Error(`Invalid Change transition from ${current.state} to ${patch.state}`)
      }
      if (patch.baseline && current.state !== "proposed" && canonicalDigest(patch.baseline) !== canonicalDigest(current.baseline)) {
        throw new Error("A Change baseline cannot be replaced after the proposed state")
      }
      const product = await this.readProduct()
      if (patch.baseline) await this.validateBaseline(patch.baseline, product)
      if (patch.state === "completed") {
        const unfinished = (await this.listWorkItems()).filter((item) =>
          item.changeId === current.id && !["completed", "cancelled"].includes(item.state),
        )
        if (unfinished.length > 0) throw new Error("Change cannot complete while Work Items remain non-terminal")
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
      await this.commitRecord("changes", updated, changeSchema, "change.revised", actorId)
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

  async reviseWorkItem(id: string, expectedRevision: number, patch: Partial<MutableWorkItem>, actorId: string): Promise<WorkItem> {
    return this.repository.withLock(async () => {
      this.assertAllowedKeys(
        patch,
        ["title", "objective", "state", "dependsOn", "completionCriteria", "evidenceCriteria", "scope", "owner"],
        "Work Item patch",
      )
      await this.assertIntegrity()
      const current = await this.readWorkItem(id)
      this.assertExpectedRevision(current.revision, expectedRevision, "Work Item")
      if (patch.state && patch.state !== current.state && !workItemTransitions[current.state].includes(patch.state)) {
        throw new Error(`Invalid Work Item transition from ${current.state} to ${patch.state}`)
      }
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
      await this.commitRecord("work-items", updated, workItemSchema, "work-item.revised", actorId)
      return updated
    })
  }

  async readWorkItem(id: string): Promise<WorkItem> { return this.readRecord("work-items", id, workItemSchema) }
  async listWorkItems(): Promise<WorkItem[]> { return this.listRecords("work-items", /^[0-9a-f-]+\.json$/i, workItemSchema) }

  async createRequirement(input: NewRequirement, expectedProductRevision: number, actorId: string): Promise<Requirement> {
    return this.repository.withLock(async () => {
      this.assertAllowedKeys(
        input,
        ["key", "statement", "rationale", "priority", "verificationCriteria", "sourceRecordIds"],
        "Requirement input",
      )
      await this.assertIntegrity()
      const product = await this.requireProductRevision(expectedProductRevision)
      if ((await this.listRequirements()).some((record) => record.key === input.key)) {
        throw new Error(`Requirement key ${input.key} already exists`)
      }
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

  async reviseRequirement(id: string, expectedRevision: number, patch: Partial<MutableRequirement>, actorId: string): Promise<Requirement> {
    return this.repository.withLock(async () => {
      this.assertAllowedKeys(
        patch,
        ["key", "statement", "rationale", "priority", "state", "verificationCriteria", "sourceRecordIds"],
        "Requirement patch",
      )
      await this.assertIntegrity()
      const current = await this.readRequirement(id)
      this.assertExpectedRevision(current.revision, expectedRevision, "Requirement")
      if (patch.state && patch.state !== current.state && !requirementTransitions[current.state].includes(patch.state)) {
        throw new Error(`Invalid Requirement transition from ${current.state} to ${patch.state}`)
      }
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
      await this.commitRecord("requirements", updated, requirementSchema, "requirement.revised", actorId)
      return updated
    })
  }

  async readRequirement(id: string): Promise<Requirement> { return this.readRecord("requirements", id, requirementSchema) }
  async listRequirements(): Promise<Requirement[]> { return this.listRecords("requirements", /^[0-9a-f-]+\.json$/i, requirementSchema) }

  async createDecision(input: NewDecision, expectedProductRevision: number, actorId: string): Promise<Decision> {
    return this.createSimpleRecord("decisions", decisionSchema, {
      ...input,
      state: "open",
    }, expectedProductRevision, "decision.created", actorId)
  }

  async reviseDecision(id: string, expectedRevision: number, patch: Partial<MutableDecision>, actorId: string): Promise<Decision> {
    this.assertAllowedKeys(
      patch,
      ["question", "options", "recommendation", "selectedOutcome", "dissentAndUncertainty", "affectedRecordIds", "state"],
      "Decision patch",
    )
    return this.reviseSimpleRecord<Decision>(
      "decisions", id, expectedRevision, decisionSchema, patch, "decision.revised", actorId,
    )
  }

  async readDecision(id: string): Promise<Decision> { return this.readRecord("decisions", id, decisionSchema) }
  async listDecisions(): Promise<Decision[]> { return this.listRecords("decisions", /^[0-9a-f-]+\.json$/i, decisionSchema) }

  async createRisk(input: NewRisk, expectedProductRevision: number, actorId: string): Promise<Risk> {
    return this.createSimpleRecord("risks", riskSchema, { ...input, state: "open" }, expectedProductRevision, "risk.created", actorId)
  }

  async reviseRisk(id: string, expectedRevision: number, patch: Partial<MutableRisk>, actorId: string): Promise<Risk> {
    this.assertAllowedKeys(
      patch,
      [
        "title", "cause", "condition", "consequence", "likelihood", "impact", "uncertainty", "treatment",
        "owner", "reviewTriggers", "residualRisk", "state", "acceptance",
      ],
      "Risk patch",
    )
    return this.reviseSimpleRecord<Risk>(
      "risks", id, expectedRevision, riskSchema, patch, "risk.revised", actorId,
    )
  }

  async readRisk(id: string): Promise<Risk> { return this.readRecord("risks", id, riskSchema) }
  async listRisks(): Promise<Risk[]> { return this.listRecords("risks", /^[0-9a-f-]+\.json$/i, riskSchema) }

  async createArchitectureRecord(
    input: NewArchitecture,
    expectedProductRevision: number,
    actorId: string,
  ): Promise<ArchitectureRecord> {
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
  ): Promise<ArchitectureRecord> {
    this.assertAllowedKeys(
      patch,
      ["recordType", "title", "description", "rationale", "assumptions", "constraints", "affectedRecordIds", "state"],
      "Architecture patch",
    )
    return this.reviseSimpleRecord<ArchitectureRecord>(
      "architecture",
      id,
      expectedRevision,
      architectureRecordSchema,
      patch,
      "architecture-record.revised",
      actorId,
    )
  }

  async readArchitectureRecord(id: string): Promise<ArchitectureRecord> {
    return this.readRecord("architecture", id, architectureRecordSchema)
  }
  async listArchitectureRecords(): Promise<ArchitectureRecord[]> {
    return this.listRecords("architecture", /^[0-9a-f-]+\.json$/i, architectureRecordSchema)
  }

  async createEvidence(input: MutableEvidence, expectedProductRevision: number, actorId: string): Promise<EvidenceRecord> {
    this.assertEvidenceFreshness(input)
    return this.createSimpleRecord("evidence", evidenceRecordSchema, input, expectedProductRevision, "evidence.created", actorId)
  }

  async reviseEvidence(id: string, expectedRevision: number, patch: Partial<MutableEvidence>, actorId: string): Promise<EvidenceRecord> {
    this.assertAllowedKeys(
      patch,
      [
        "subjectRecordIds", "origin", "method", "result", "artifactDigest", "limitations", "verification",
        "freshness", "collectedAt", "validUntil",
      ],
      "Evidence patch",
    )
    const current = await this.readEvidence(id)
    this.assertEvidenceFreshness({ ...current, ...patch })
    return this.reviseSimpleRecord<EvidenceRecord>(
      "evidence", id, expectedRevision, evidenceRecordSchema, patch, "evidence.revised", actorId,
    )
  }

  async readEvidence(id: string): Promise<EvidenceRecord> { return this.readRecord("evidence", id, evidenceRecordSchema) }
  async listEvidence(): Promise<EvidenceRecord[]> { return this.listRecords("evidence", /^[0-9a-f-]+\.json$/i, evidenceRecordSchema) }

  redactContextContent(content: string): { text: string; redactions: number } {
    if (content.length > 1_000_000) throw new Error("Context redaction input exceeds the local safety limit")
    return redactSecretShapedText(content)
  }

  async createContextPack(input: ContextPackInput, expectedProductRevision: number, actorId: string): Promise<ContextPack> {
    return this.repository.withLock(async () => {
      await this.assertIntegrity()
      const product = await this.requireProductRevision(expectedProductRevision)
      await this.validateContextItems(input.items)
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
      await this.validateContextItems(merged.items)
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
      await this.commitRecord("workflow-plans", updated, workflowPlanSchema, "workflow-plan.revised", actorId)
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
        ["runId", "tools", "requestedEffects", "confirmedToolIds", "workspaceTrusted"],
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
      const now = new Date().toISOString()
      const record = runToolSelectionSchema.parse({
        schemaVersion: 1,
        kind: "run-tool-selection",
        id: randomUUID(),
        productId: product.id,
        revision: 1,
        ...input,
        readiness,
        selectedBy: { kind: "human", id: actorId },
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
    patch: Partial<Omit<RunToolSelectionInput, "runId">>,
    actorId: string,
  ): Promise<RunToolSelection> {
    return this.repository.withLock(async () => {
      this.assertAllowedKeys(
        patch,
        ["tools", "requestedEffects", "confirmedToolIds", "workspaceTrusted"],
        "Run Tool Selection patch",
      )
      await this.assertIntegrity()
      const current = await this.readRunToolSelection(id)
      this.assertExpectedRevision(current.revision, expectedRevision, "Run Tool Selection")
      const run = await this.repository.readJson(
        this.repository.resolve("sessions", `run-${current.runId}.json`),
        runSchema,
      )
      const merged = {
        runId: current.runId,
        tools: patch.tools ?? current.tools,
        requestedEffects: patch.requestedEffects ?? current.requestedEffects,
        confirmedToolIds: patch.confirmedToolIds ?? current.confirmedToolIds,
        workspaceTrusted: patch.workspaceTrusted ?? current.workspaceTrusted,
      }
      const readiness = await this.evaluateToolSelection(merged, run)
      const updated = runToolSelectionSchema.parse({
        ...current,
        ...merged,
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

  async impactAnalysis(subject: TraceEndpoint): Promise<TraceImpact> {
    const links = await Promise.all((await this.listTraceLinks()).map(async (link) => ({
      ...link,
      state: await this.assessTraceState(link.source, link.target),
    } as TraceLink)))
    const matches = (endpoint: TraceEndpoint) =>
      endpoint.recordType === subject.recordType && endpoint.recordId === subject.recordId
    const upstream = links.filter((link) => matches(link.target))
    const downstream = links.filter((link) => matches(link.source))
    const related = [...upstream, ...downstream]
    return traceImpactSchema.parse({
      subject,
      upstream,
      downstream,
      validatingEvidence: related.filter((link) =>
        link.relationship === "validates" || link.source.recordType === "evidence" || link.target.recordType === "evidence",
      ),
      decisionsAndRisks: related.filter((link) =>
        [link.source.recordType, link.target.recordType].some((kind) => kind === "decision" || kind === "risk"),
      ),
      unresolved: related.filter((link) => link.state === "unresolved" || link.state === "invalid"),
      stale: related.filter((link) => link.state === "stale"),
      evaluatedAt: new Date().toISOString(),
    })
  }

  async search(input: ProductStudioSearchInput): Promise<ProductDomainSearchResult[]> {
    const query = input.query.trim().toLocaleLowerCase()
    if (query.length < 2) throw new Error("Search query must contain at least two characters")
    const allowed = new Set(input.kinds ?? [])
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
    if (include("run-tool-selection")) {
      groups.push({ kind: "run-tool-selection", records: await this.listRunToolSelections() })
    }
    const results: ProductDomainSearchResult[] = []
    for (const group of groups) {
      for (const unknownRecord of group.records) {
        const record = unknownRecord as Record<string, unknown>
        const searchable = JSON.stringify(record).toLocaleLowerCase()
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
    return results.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async buildPortableExport(): Promise<ProductExportBundle> {
    await this.assertIntegrity()
    const [manifest, product] = await Promise.all([
      this.repository.readJson(this.repository.resolve("manifest.json"), repositoryManifestSchema),
      this.readProduct(),
    ])
    const portableRecords: Array<{ path: string; recordType: string; content: unknown }> = [
      { path: "manifest.json", recordType: "repository-manifest", content: manifest },
      { path: "product.json", recordType: "product", content: product },
    ]
    const append = <T>(directory: string, recordType: string, records: T[], pathFor?: (record: T) => string) => {
      for (const record of records) {
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
    append("context-packs", "context-pack", await this.listContextPacks())
    append("workflow-plans", "workflow-plan", await this.listWorkflowPlans())
    append("tools", "tool-definition", await this.listToolDefinitions())
    append("tool-selections", "run-tool-selection", await this.listRunToolSelections())
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
        { recordClass: "execution-sessions", reason: "Current execution contracts contain machine-local bindings and require a later portability revision." },
        { recordClass: "handoffs", reason: "Current handoffs can contain machine-local run and workspace observations." },
        { recordClass: "audit-runtime", reason: "The local operational audit can contain execution diagnostics not reviewed for portable disclosure." },
      ],
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
    const metadata = await lstat(path)
    if (metadata.isSymbolicLink()) throw new Error("Import preview refuses symbolic-link sources")
    if (!metadata.isFile()) throw new Error("Import preview source must be a regular file")
    if (metadata.size > 25 * 1024 * 1024) throw new Error("Import preview source exceeds the 25 MiB safety limit")
    let raw: unknown
    try {
      raw = JSON.parse(await readFile(path, "utf8"))
    } catch (error) {
      throw new Error(error instanceof Error ? `Malformed import bundle: ${error.message}` : "Malformed import bundle")
    }
    return this.previewImportBundle(raw)
  }

  async previewImportBundle(input: unknown): Promise<ProductImportPreview> {
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
      warnings: bundle.manifest.excluded.map((item) => `${item.recordClass}: ${item.reason}`),
      importMutation: "not-performed",
    })
  }

  async healthIssues(): Promise<WorkspaceHealthIssue[]> {
    const issues: WorkspaceHealthIssue[] = []
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
        await this.validateContextItems(pack.items)
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
        const readiness = await this.evaluateToolSelection(selection, run)
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

  private async validateContextItems(items: ContextPack["items"]): Promise<void> {
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
      if (item.instructionPrivilegeGrant) {
        await this.validateExactReference({
          recordType: item.instructionPrivilegeGrant.recordType,
          recordId: item.instructionPrivilegeGrant.recordId,
          revision: item.instructionPrivilegeGrant.revision,
          digest: item.instructionPrivilegeGrant.digest,
        })
      }
    }
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
    for (const reference of input.contextPacks) {
      if (reference.recordType !== "context-pack") throw new Error("Workflow context references must target Context Packs")
      const pack = await this.validateExactReference(reference) as ContextPack
      if (pack.sufficiency.status === "insufficient") throw new Error(`Context Pack ${pack.id} is insufficient for planning`)
    }
    const tools: ToolDefinition[] = []
    for (const reference of input.toolDefinitions) {
      if (reference.recordType !== "tool-definition") throw new Error("Workflow tool references must target Tool Definitions")
      tools.push(await this.validateExactReference(reference) as ToolDefinition)
    }
    const byId = new Map(input.steps.map((step) => [step.id, step]))
    for (const step of input.steps) {
      if (step.dependsOn.includes(step.id)) throw new Error(`Workflow Step ${step.id} cannot depend on itself`)
      for (const dependency of step.dependsOn) {
        if (!byId.has(dependency)) throw new Error(`Workflow Step dependency ${dependency} is missing`)
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

  private async validateExactReference(reference: WorkflowPlan["subject"]): Promise<unknown> {
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
      case "change": record = await this.readChange(reference.recordId); break
      case "work-item": record = await this.readWorkItem(reference.recordId); break
      case "requirement": record = await this.readRequirement(reference.recordId); break
      case "decision": record = await this.readDecision(reference.recordId); break
      case "architecture": record = await this.readArchitectureRecord(reference.recordId); break
      case "context-pack": record = await this.readContextPack(reference.recordId); break
      case "tool-definition": record = await this.readToolDefinition(reference.recordId); break
    }
    const candidate = record as { id?: string; productId?: string; revision?: number }
    const identity = reference.recordType === "product" ? candidate.id : candidate.id
    if (identity !== reference.recordId || (candidate.revision ?? 1) !== reference.revision) {
      throw new Error(`Exact ${reference.recordType} reference identity or revision does not match`)
    }
    if (canonicalDigest(record) !== reference.digest) {
      throw new Error(`Exact ${reference.recordType} reference digest does not match`)
    }
    return record
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
    if (["completed", "failed", "cancelled"].includes(run.state)) issues.push(`Run is already terminal: ${run.state}`)
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
        if (!charterPermission || charterPermission.mode === "deny") {
          issues.push(`Tool ${tool.key} requires permission ${permission.capability} not granted by the Charter`)
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
    return validated
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
    if (/^workflow-plans\/[0-9a-f-]+\.json$/i.test(path)) return "workflow-plan"
    if (/^tools\/[0-9a-f-]+\.json$/i.test(path)) return "tool-definition"
    if (/^tool-selections\/[0-9a-f-]+\.json$/i.test(path)) return "run-tool-selection"
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
    if (/^workflow-plans\/[0-9a-f-]+\.json$/i.test(path)) return workflowPlanSchema
    if (/^tools\/[0-9a-f-]+\.json$/i.test(path)) return toolDefinitionSchema
    if (/^tool-selections\/[0-9a-f-]+\.json$/i.test(path)) return runToolSelectionSchema
    throw new Error(`Import member path is unsupported or non-portable: ${path}`)
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

  private async reviseSimpleRecord<T extends { id: string; revision: number; updatedAt: string }>(
    directory: string,
    id: string,
    expectedRevision: number,
    schema: ZodType<T>,
    patch: Partial<T>,
    eventType: string,
    actorId: string,
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
      await this.commitRecord(directory, updated, schema, eventType, actorId)
      return updated
    })
  }

  private async commitRecord<T extends { id: string; revision: number }>(
    directory: string,
    record: T,
    schema: ZodType<T>,
    eventType: string,
    actorId: string,
  ): Promise<void> {
    await this.repository.commitMutation({
      writes: [this.governed(this.repository.resolve(directory, `${record.id}.json`), record, schema)],
      audit: {
        eventType,
        actor: { kind: "human", id: actorId },
        subjectId: record.id,
        payload: { revision: record.revision, recordDigest: canonicalDigest(record) },
      },
    })
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
    let record: unknown
    try {
      switch (endpoint.recordType) {
        case "product": record = await this.readProduct(); break
        case "design-revision": record = await this.readDesignRevision(endpoint.recordId); break
        case "initiative": record = await this.readInitiative(endpoint.recordId); break
        case "change": record = await this.readChange(endpoint.recordId); break
        case "work-item": record = await this.readWorkItem(endpoint.recordId); break
        case "requirement": record = await this.readRequirement(endpoint.recordId); break
        case "decision": record = await this.readDecision(endpoint.recordId); break
        case "risk": record = await this.readRisk(endpoint.recordId); break
        case "architecture": record = await this.readArchitectureRecord(endpoint.recordId); break
        case "evidence": record = await this.readEvidence(endpoint.recordId); break
        case "run": record = await this.repository.readJson(
          this.repository.resolve("sessions", `run-${this.requireUuid(endpoint.recordId, "Run ID")}.json`),
          runSchema,
        ); break
        case "context-pack":
        case "workflow-plan":
        case "tool-definition":
          return "unresolved"
      }
    } catch (error) {
      return this.isMissing(error) ? "unresolved" : "invalid"
    }
    const candidate = record as { id?: string; productId?: string; revision?: number }
    if (candidate.id && candidate.id !== endpoint.recordId) return "invalid"
    if (endpoint.revision !== undefined && (candidate.revision ?? 1) !== endpoint.revision) return "stale"
    if (endpoint.digest !== undefined && canonicalDigest(record) !== endpoint.digest) return "stale"
    return "valid"
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
