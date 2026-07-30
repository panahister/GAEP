import { randomUUID } from "node:crypto"
import { constants as fsConstants } from "node:fs"
import { open } from "node:fs/promises"
import { isAbsolute } from "node:path"

import {
  architectureChallengeModelSchema,
  decisionRegisterSchema,
  riskRegisterSchema,
  evidenceRegistrySchema,
  endToEndTraceabilitySchema,
  p0P4ReadinessGateSchema,
  p5HandoffPackageSchema,
  designApplicabilitySchema,
  designPersonaRoleModelSchema,
  userJourneyModelSchema,
  informationArchitectureModelSchema,
  screenStateInventorySchema,
  designRequirementsSchema,
  designSystemTokenContractSchema,
  accessibilityDesignRulesSchema,
  responsiveMultiPlatformTargetsSchema,
  manualFigmaExecutionPathSchema,
  figmaMcpCapabilityDiscoverySchema,
  figmaReadSnapshotSchema,
  figmaContextImportSchema,
  outboundDesignBriefPackageSchema,
  governedFigmaWriteSchema,
  finalizedFigmaSnapshotImportSchema,
  designToRequirementBindingSchema,
  designerReadyGateSchema,
  designDeltaSchema,
  designConflictResolutionSchema,
  humanDesignApprovalSchema,
  designBaselineSchema,
  designDriftDetectionSchema,
  architectureRecordSchema,
  boundedContextModelSchema,
  securityPrivacyAssessmentSchema,
  processModelSchema,
  dataModelSchema,
  authorizationModelSchema,
  eventIntegrationModelSchema,
  failureRecoveryModelSchema,
  businessArchitectureBaselineSchema,
  businessCapabilityMapSchema,
  businessRuleCatalogSchema,
  businessUnderstandingSchema,
  changeSchema,
  containsSecretShapedValue,
  contextPackSchema,
  decisionSchema,
  designReadinessReportSchema,
  evidenceRecordSchema,
  exactDomainRecordReferenceSchema,
  exactSourceReferenceSchema,
  executionCharterSchema,
  handoffSchema,
  instructionPrivilegeGrantSchema,
  initiativeSchema,
  managedApplyDecisionReceiptSchema,
  managedRunEvidenceSchema,
  managedRunRecordSchema,
  managedRunResultSchema,
  outcomeModelSchema,
  operatingModelSchema,
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
  stakeholderModelSchema,
  systemSolutionArchitectureSchema,
  valueStreamModelSchema,
  traceImpactSchema,
  traceLinkSchema,
  toolDefinitionSchema,
  workItemSchema,
  workflowPlanSchema,
  redactSecretShapedText,
  type ArchitectureRecord,
  type ArchitectureChallengeModel,
  type DecisionRegister,
  type RiskRegister,
  type EvidenceRegistry,
  type EndToEndTraceability,
  type P0P4ReadinessGate,
  type P5HandoffPackage,
  type DesignApplicability,
  type DesignPersonaRoleModel,
  type UserJourneyModel,
  type InformationArchitectureModel,
  type ScreenStateInventory,
  type DesignRequirements,
  type DesignSystemTokenContract,
  type AccessibilityDesignRules,
  type ResponsiveMultiPlatformTargets,
  type ManualFigmaExecutionPath,
  type FigmaMcpCapabilityDiscovery,
  type FigmaReadSnapshot,
  type FigmaContextImport,
  type OutboundDesignBriefPackage,
  type GovernedFigmaWrite,
  type FinalizedFigmaSnapshotImport,
  type DesignToRequirementBinding,
  type DesignerReadyGate,
  type DesignDelta,
  type DesignConflictResolution,
  type HumanDesignApproval,
  type DesignBaseline,
  type DesignDriftDetection,
  type TraceabilitySubjectKind,
  type BoundedContextModel,
  type SecurityPrivacyAssessment,
  type ProcessModel,
  type DataModel,
  type AuthorizationModel,
  type EventIntegrationModel,
  type FailureRecoveryModel,
  type BusinessArchitectureBaseline,
  type BusinessCapabilityMap,
  type BusinessRuleCatalog,
  type BusinessUnderstanding,
  type Change,
  type ContextPack,
  type Decision,
  type DesignField,
  type DesignReadinessReport,
  type EvidenceRecord,
  type ExactDomainRecordReference,
  type ExactSourceReference,
  type Initiative,
  type InstructionPrivilegeGrant,
  type ManagedRunRecord,
  type OutcomeModel,
  type OperatingModel,
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
  type StakeholderModel,
  type SystemSolutionArchitecture,
  type ValueStreamModel,
  type TraceEndpoint,
  type TraceImpact,
  type TraceLink,
  type ToolDefinition,
  type WorkItem,
  type WorkflowPlan,
  type WorkspaceHealthIssue,
} from "@gaep/contracts"
import { canonicalDigest } from "@gaep/agent-sdk"
import { designerReadyAssessmentReceiptDigest } from "./designer-ready-gate.js"
import { designDeltaComparisonReceiptDigest } from "./design-delta.js"
import {
  designConflictResolutionReceiptDigest,
  designDeltaResolutionReference,
} from "./design-conflict-resolution.js"
import {
  humanDesignApprovalDecisionReceiptDigest,
  humanDesignApprovalScopeDigest,
  humanDesignApprovalSubjectReference,
} from "./human-design-approval.js"
import { designBaselineDesignationReceiptDigest } from "./design-baseline.js"
import {
  designDriftBaselineReference,
  designDriftComparisonDigest,
  designDriftImplementationTargetCatalogDigest,
  designDriftRequirementsReference,
  designDriftSnapshotReference,
  designDriftTraceReference,
} from "./design-drift-detection.js"
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
    const businessUnderstanding = await this.listRecords(
      "business-understanding",
      /^[0-9a-f-]+\.json$/i,
      businessUnderstandingSchema,
    )
    const businessUnderstandingHistory = await this.listRecords(
      "business-understanding-history",
      /^business-understanding-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      businessUnderstandingSchema,
    )
    const businessCapabilityMaps = await this.listRecords(
      "business-capability-maps",
      /^[0-9a-f-]+\.json$/i,
      businessCapabilityMapSchema,
    )
    const businessCapabilityMapHistory = await this.listRecords(
      "business-capability-map-history",
      /^business-capability-map-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      businessCapabilityMapSchema,
    )
    const valueStreamModels = await this.listRecords(
      "value-stream-models",
      /^[0-9a-f-]+\.json$/i,
      valueStreamModelSchema,
    )
    const valueStreamModelHistory = await this.listRecords(
      "value-stream-model-history",
      /^value-stream-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      valueStreamModelSchema,
    )
    const operatingModels = await this.listRecords(
      "operating-models",
      /^[0-9a-f-]+\.json$/i,
      operatingModelSchema,
    )
    const operatingModelHistory = await this.listRecords(
      "operating-model-history",
      /^operating-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      operatingModelSchema,
    )
    const businessRuleCatalogs = await this.listRecords(
      "business-rule-catalogs",
      /^[0-9a-f-]+\.json$/i,
      businessRuleCatalogSchema,
    )
    const businessRuleCatalogHistory = await this.listRecords(
      "business-rule-catalog-history",
      /^business-rule-catalog-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      businessRuleCatalogSchema,
    )
    const businessArchitectureBaselines = await this.listRecords(
      "business-architecture-baselines",
      /^[0-9a-f-]+\.json$/i,
      businessArchitectureBaselineSchema,
    )
    const businessArchitectureBaselineHistory = await this.listRecords(
      "business-architecture-baseline-history",
      /^business-architecture-baseline-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      businessArchitectureBaselineSchema,
    )
    const systemSolutionArchitectures = await this.listRecords(
      "system-solution-architectures",
      /^[0-9a-f-]+\.json$/i,
      systemSolutionArchitectureSchema,
    )
    const systemSolutionArchitectureHistory = await this.listRecords(
      "system-solution-architecture-history",
      /^system-solution-architecture-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      systemSolutionArchitectureSchema,
    )
    const boundedContextModels = await this.listRecords(
      "bounded-context-models",
      /^[0-9a-f-]+\.json$/i,
      boundedContextModelSchema,
    )
    const boundedContextModelHistory = await this.listRecords(
      "bounded-context-model-history",
      /^bounded-context-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      boundedContextModelSchema,
    )
    const securityPrivacyAssessments = await this.listRecords(
      "security-privacy-assessments",
      /^[0-9a-f-]+\.json$/i,
      securityPrivacyAssessmentSchema,
    )
    const securityPrivacyAssessmentHistory = await this.listRecords(
      "security-privacy-assessment-history",
      /^security-privacy-assessment-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      securityPrivacyAssessmentSchema,
    )
    const processModels = await this.listRecords(
      "process-models",
      /^[0-9a-f-]+\.json$/i,
      processModelSchema,
    )
    const processModelHistory = await this.listRecords(
      "process-model-history",
      /^process-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      processModelSchema,
    )
    const dataModels = await this.listRecords(
      "data-models",
      /^[0-9a-f-]+\.json$/i,
      dataModelSchema,
    )
    const dataModelHistory = await this.listRecords(
      "data-model-history",
      /^data-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      dataModelSchema,
    )
    const authorizationModels = await this.listRecords(
      "authorization-models",
      /^[0-9a-f-]+\.json$/i,
      authorizationModelSchema,
    )
    const authorizationModelHistory = await this.listRecords(
      "authorization-model-history",
      /^authorization-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      authorizationModelSchema,
    )
    const eventIntegrationModels = await this.listRecords(
      "event-integration-models",
      /^[0-9a-f-]+\.json$/i,
      eventIntegrationModelSchema,
    )
    const eventIntegrationModelHistory = await this.listRecords(
      "event-integration-model-history",
      /^event-integration-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      eventIntegrationModelSchema,
    )
    const failureRecoveryModels = await this.listRecords(
      "failure-recovery-models",
      /^[0-9a-f-]+\.json$/i,
      failureRecoveryModelSchema,
    )
    const failureRecoveryModelHistory = await this.listRecords(
      "failure-recovery-model-history",
      /^failure-recovery-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      failureRecoveryModelSchema,
    )
    const architectureChallengeModels = await this.listRecords(
      "architecture-challenge-models",
      /^[0-9a-f-]+\.json$/i,
      architectureChallengeModelSchema,
    )
    const architectureChallengeModelHistory = await this.listRecords(
      "architecture-challenge-model-history",
      /^architecture-challenge-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      architectureChallengeModelSchema,
    )
    const decisionRegisters = await this.listRecords(
      "decision-registers",
      /^[0-9a-f-]+\.json$/i,
      decisionRegisterSchema,
    )
    const decisionRegisterHistory = await this.listRecords(
      "decision-register-history",
      /^decision-register-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      decisionRegisterSchema,
    )
    const riskRegisters = await this.listRecords(
      "risk-registers",
      /^[0-9a-f-]+\.json$/i,
      riskRegisterSchema,
    )
    const riskRegisterHistory = await this.listRecords(
      "risk-register-history",
      /^risk-register-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      riskRegisterSchema,
    )
    const evidenceRegistries = await this.listRecords(
      "evidence-registries",
      /^[0-9a-f-]+\.json$/i,
      evidenceRegistrySchema,
    )
    const evidenceRegistryHistory = await this.listRecords(
      "evidence-registry-history",
      /^evidence-registry-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      evidenceRegistrySchema,
    )
    const endToEndTraceability = await this.listRecords(
      "end-to-end-traceability",
      /^[0-9a-f-]+\.json$/i,
      endToEndTraceabilitySchema,
    )
    const endToEndTraceabilityHistory = await this.listRecords(
      "end-to-end-traceability-history",
      /^end-to-end-traceability-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      endToEndTraceabilitySchema,
    )
    const p0P4ReadinessGates = await this.listRecords(
      "p0-p4-readiness-gates",
      /^[0-9a-f-]+\.json$/i,
      p0P4ReadinessGateSchema,
    )
    const p0P4ReadinessGateHistory = await this.listRecords(
      "p0-p4-readiness-gate-history",
      /^p0-p4-readiness-gate-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      p0P4ReadinessGateSchema,
    )
    const p5HandoffPackages = await this.listRecords(
      "p5-handoff-packages",
      /^[0-9a-f-]+\.json$/i,
      p5HandoffPackageSchema,
    )
    const p5HandoffPackageHistory = await this.listRecords(
      "p5-handoff-package-history",
      /^p5-handoff-package-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      p5HandoffPackageSchema,
    )
    const designApplicability = await this.listRecords(
      "design-applicability",
      /^[0-9a-f-]+\.json$/i,
      designApplicabilitySchema,
    )
    const designApplicabilityHistory = await this.listRecords(
      "design-applicability-history",
      /^design-applicability-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      designApplicabilitySchema,
    )
    const designPersonaRoleModels = await this.listRecords(
      "design-persona-role-models",
      /^[0-9a-f-]+\.json$/i,
      designPersonaRoleModelSchema,
    )
    const designPersonaRoleModelHistory = await this.listRecords(
      "design-persona-role-model-history",
      /^design-persona-role-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      designPersonaRoleModelSchema,
    )
    const userJourneyModels = await this.listRecords(
      "user-journey-models",
      /^[0-9a-f-]+\.json$/i,
      userJourneyModelSchema,
    )
    const userJourneyModelHistory = await this.listRecords(
      "user-journey-model-history",
      /^user-journey-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      userJourneyModelSchema,
    )
    const informationArchitectureModels = await this.listRecords(
      "information-architecture-models",
      /^[0-9a-f-]+\.json$/i,
      informationArchitectureModelSchema,
    )
    const informationArchitectureModelHistory = await this.listRecords(
      "information-architecture-model-history",
      /^information-architecture-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      informationArchitectureModelSchema,
    )
    const screenStateInventories = await this.listRecords(
      "screen-state-inventories",
      /^[0-9a-f-]+\.json$/i,
      screenStateInventorySchema,
    )
    const screenStateInventoryHistory = await this.listRecords(
      "screen-state-inventory-history",
      /^screen-state-inventory-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      screenStateInventorySchema,
    )
    const designRequirements = await this.listRecords(
      "design-requirements",
      /^[0-9a-f-]+\.json$/i,
      designRequirementsSchema,
    )
    const designRequirementsHistory = await this.listRecords(
      "design-requirements-history",
      /^design-requirements-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      designRequirementsSchema,
    )
    const designSystemTokenContracts = await this.listRecords(
      "design-system-token-contracts",
      /^[0-9a-f-]+\.json$/i,
      designSystemTokenContractSchema,
    )
    const designSystemTokenContractHistory = await this.listRecords(
      "design-system-token-contracts-history",
      /^design-system-token-contract-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      designSystemTokenContractSchema,
    )
    const accessibilityDesignRules = await this.listRecords(
      "accessibility-design-rules",
      /^[0-9a-f-]+\.json$/i,
      accessibilityDesignRulesSchema,
    )
    const accessibilityDesignRulesHistory = await this.listRecords(
      "accessibility-design-rules-history",
      /^accessibility-design-rules-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      accessibilityDesignRulesSchema,
    )
    const responsiveMultiPlatformTargets = await this.listRecords(
      "responsive-multi-platform-targets",
      /^[0-9a-f-]+\.json$/i,
      responsiveMultiPlatformTargetsSchema,
    )
    const responsiveMultiPlatformTargetsHistory = await this.listRecords(
      "responsive-multi-platform-targets-history",
      /^responsive-multi-platform-targets-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      responsiveMultiPlatformTargetsSchema,
    )
    const manualFigmaExecutionPaths = await this.listRecords(
      "manual-figma-execution-paths",
      /^[0-9a-f-]+\.json$/i,
      manualFigmaExecutionPathSchema,
    )
    const manualFigmaExecutionPathHistory = await this.listRecords(
      "manual-figma-execution-path-history",
      /^manual-figma-execution-path-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      manualFigmaExecutionPathSchema,
    )
    const figmaMcpCapabilityDiscoveries = await this.listRecords(
      "figma-mcp-capability-discoveries",
      /^[0-9a-f-]+\.json$/i,
      figmaMcpCapabilityDiscoverySchema,
    )
    const figmaMcpCapabilityDiscoveryHistory = await this.listRecords(
      "figma-mcp-capability-discovery-history",
      /^figma-mcp-capability-discovery-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      figmaMcpCapabilityDiscoverySchema,
    )
    const figmaReadSnapshots = await this.listRecords(
      "figma-read-snapshots",
      /^[0-9a-f-]+\.json$/i,
      figmaReadSnapshotSchema,
    )
    const figmaReadSnapshotHistory = await this.listRecords(
      "figma-read-snapshot-history",
      /^figma-read-snapshot-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      figmaReadSnapshotSchema,
    )
    const figmaContextImports = await this.listRecords(
      "figma-context-imports",
      /^[0-9a-f-]+\.json$/i,
      figmaContextImportSchema,
    )
    const figmaContextImportHistory = await this.listRecords(
      "figma-context-import-history",
      /^figma-context-import-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      figmaContextImportSchema,
    )
    const outboundDesignBriefPackages = await this.listRecords(
      "outbound-design-brief-packages",
      /^[0-9a-f-]+\.json$/i,
      outboundDesignBriefPackageSchema,
    )
    const outboundDesignBriefPackageHistory = await this.listRecords(
      "outbound-design-brief-package-history",
      /^outbound-design-brief-package-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      outboundDesignBriefPackageSchema,
    )
    const governedFigmaWrites = await this.listRecords(
      "governed-figma-writes",
      /^[0-9a-f-]+\.json$/i,
      governedFigmaWriteSchema,
    )
    const governedFigmaWriteHistory = await this.listRecords(
      "governed-figma-write-history",
      /^governed-figma-write-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      governedFigmaWriteSchema,
    )
    const finalizedFigmaSnapshotImports = await this.listRecords(
      "finalized-figma-snapshot-imports",
      /^[0-9a-f-]+\.json$/i,
      finalizedFigmaSnapshotImportSchema,
    )
    const finalizedFigmaSnapshotImportHistory = await this.listRecords(
      "finalized-figma-snapshot-import-history",
      /^finalized-figma-snapshot-import-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      finalizedFigmaSnapshotImportSchema,
    )
    const designToRequirementBindings = await this.listRecords(
      "design-to-requirement-bindings",
      /^[0-9a-f-]+\.json$/i,
      designToRequirementBindingSchema,
    )
    const designToRequirementBindingHistory = await this.listRecords(
      "design-to-requirement-binding-history",
      /^design-to-requirement-binding-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      designToRequirementBindingSchema,
    )
    const designerReadyGates = await this.listRecords(
      "designer-ready-gates",
      /^[0-9a-f-]+\.json$/i,
      designerReadyGateSchema,
    )
    const designerReadyGateHistory = await this.listRecords(
      "designer-ready-gate-history",
      /^designer-ready-gate-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      designerReadyGateSchema,
    )
    const designDeltas = await this.listRecords(
      "design-deltas",
      /^[0-9a-f-]+\.json$/i,
      designDeltaSchema,
    )
    const designDeltaHistory = await this.listRecords(
      "design-delta-history",
      /^design-delta-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      designDeltaSchema,
    )
    const designConflictResolutions = await this.listRecords(
      "design-conflict-resolutions",
      /^[0-9a-f-]+\.json$/i,
      designConflictResolutionSchema,
    )
    const designConflictResolutionHistory = await this.listRecords(
      "design-conflict-resolution-history",
      /^design-conflict-resolution-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      designConflictResolutionSchema,
    )
    const humanDesignApprovals = await this.listRecords(
      "human-design-approvals",
      /^[0-9a-f-]+\.json$/i,
      humanDesignApprovalSchema,
    )
    const humanDesignApprovalHistory = await this.listRecords(
      "human-design-approval-history",
      /^human-design-approval-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      humanDesignApprovalSchema,
    )
    const designBaselines = await this.listRecords(
      "design-baselines",
      /^[0-9a-f-]+\.json$/i,
      designBaselineSchema,
    )
    const designBaselineHistory = await this.listRecords(
      "design-baseline-history",
      /^design-baseline-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      designBaselineSchema,
    )
    const designDriftDetections = await this.listRecords(
      "design-drift-detections",
      /^[0-9a-f-]+\.json$/i,
      designDriftDetectionSchema,
    )
    const designDriftDetectionHistory = await this.listRecords(
      "design-drift-detection-history",
      /^design-drift-detection-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      designDriftDetectionSchema,
    )
    const portableDesignSnapshotIds = [...new Set([
      ...designSystemTokenContracts,
      ...designSystemTokenContractHistory,
    ].flatMap((record) => record.portableDesignSnapshot ? [record.portableDesignSnapshot.bundleId] : []))].sort()
    const portableDesignSnapshots = await Promise.all(
      portableDesignSnapshotIds.map((bundleId) => this.readPortableDesignSnapshot(bundleId)),
    )
    const stakeholderModels = await this.listRecords(
      "stakeholder-models",
      /^[0-9a-f-]+\.json$/i,
      stakeholderModelSchema,
    )
    const stakeholderModelHistory = await this.listRecords(
      "stakeholder-model-history",
      /^stakeholder-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      stakeholderModelSchema,
    )
    const outcomeModels = await this.listRecords(
      "outcome-models",
      /^[0-9a-f-]+\.json$/i,
      outcomeModelSchema,
    )
    const outcomeModelHistory = await this.listRecords(
      "outcome-model-history",
      /^outcome-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i,
      outcomeModelSchema,
    )
    const sensitiveContextIds = new Set(contextPacks
      .filter((pack) => ["confidential", "restricted"].includes(pack.classification.level))
      .map((pack) => pack.id))
    const sensitiveSourceIds = new Set(sources
      .filter((source) => ["confidential", "restricted"].includes(source.informationClassification))
      .map((source) => source.id))
    const sensitiveBusinessRecordIds = new Set([
      ...businessUnderstanding,
      ...businessUnderstandingHistory,
      ...businessCapabilityMaps,
      ...businessCapabilityMapHistory,
      ...valueStreamModels,
      ...valueStreamModelHistory,
      ...operatingModels,
      ...operatingModelHistory,
      ...businessRuleCatalogs,
      ...businessRuleCatalogHistory,
      ...businessArchitectureBaselines,
      ...businessArchitectureBaselineHistory,
      ...systemSolutionArchitectures,
      ...systemSolutionArchitectureHistory,
      ...boundedContextModels,
      ...boundedContextModelHistory,
      ...securityPrivacyAssessments,
      ...securityPrivacyAssessmentHistory,
      ...decisionRegisters,
      ...decisionRegisterHistory,
      ...riskRegisters,
      ...riskRegisterHistory,
      ...evidenceRegistries,
      ...evidenceRegistryHistory,
      ...endToEndTraceability,
      ...endToEndTraceabilityHistory,
      ...p0P4ReadinessGates,
      ...p0P4ReadinessGateHistory,
      ...p5HandoffPackages,
      ...p5HandoffPackageHistory,
      ...designApplicability,
      ...designApplicabilityHistory,
      ...designPersonaRoleModels,
      ...designPersonaRoleModelHistory,
      ...userJourneyModels,
      ...userJourneyModelHistory,
      ...informationArchitectureModels,
      ...informationArchitectureModelHistory,
      ...screenStateInventories,
      ...screenStateInventoryHistory,
      ...designRequirements,
      ...designRequirementsHistory,
      ...designSystemTokenContracts,
      ...designSystemTokenContractHistory,
      ...accessibilityDesignRules,
      ...accessibilityDesignRulesHistory,
      ...responsiveMultiPlatformTargets,
      ...responsiveMultiPlatformTargetsHistory,
      ...manualFigmaExecutionPaths,
      ...manualFigmaExecutionPathHistory,
      ...figmaMcpCapabilityDiscoveries,
      ...figmaMcpCapabilityDiscoveryHistory,
      ...figmaReadSnapshots,
      ...figmaReadSnapshotHistory,
      ...figmaContextImports,
      ...figmaContextImportHistory,
      ...outboundDesignBriefPackages,
      ...outboundDesignBriefPackageHistory,
      ...governedFigmaWrites,
      ...governedFigmaWriteHistory,
      ...finalizedFigmaSnapshotImports,
      ...finalizedFigmaSnapshotImportHistory,
      ...designToRequirementBindings,
      ...designToRequirementBindingHistory,
      ...designerReadyGates,
      ...designerReadyGateHistory,
      ...designDeltas,
      ...designDeltaHistory,
      ...designConflictResolutions,
      ...designConflictResolutionHistory,
      ...humanDesignApprovals,
      ...humanDesignApprovalHistory,
      ...stakeholderModels,
      ...stakeholderModelHistory,
      ...outcomeModels,
      ...outcomeModelHistory,
    ].filter((record) => ["confidential", "restricted"].includes(record.informationClassification))
      .map((record) => record.id))
    for (const snapshot of portableDesignSnapshots) {
      if (["confidential", "restricted"].includes(snapshot.classification)) sensitiveBusinessRecordIds.add(snapshot.bundleId)
    }
    const sensitiveRecordIds = new Set([
      ...sensitiveContextIds,
      ...sensitiveSourceIds,
      ...sensitiveBusinessRecordIds,
    ])
    for (const id of sensitiveRecordIds) {
      if (!reviewedRecordIds.has(id)) {
        const classification = contextPacks.find((pack) => pack.id === id)?.classification.level ??
          sources.find((source) => source.id === id)?.informationClassification ??
          businessUnderstanding.find((record) => record.id === id)?.informationClassification ??
          businessCapabilityMaps.find((record) => record.id === id)?.informationClassification ??
          valueStreamModels.find((record) => record.id === id)?.informationClassification ??
          operatingModels.find((record) => record.id === id)?.informationClassification ??
          businessRuleCatalogs.find((record) => record.id === id)?.informationClassification ??
          businessArchitectureBaselines.find((record) => record.id === id)?.informationClassification ??
          systemSolutionArchitectures.find((record) => record.id === id)?.informationClassification ??
          boundedContextModels.find((record) => record.id === id)?.informationClassification ??
          decisionRegisters.find((record) => record.id === id)?.informationClassification ??
          riskRegisters.find((record) => record.id === id)?.informationClassification ??
          evidenceRegistries.find((record) => record.id === id)?.informationClassification ??
          endToEndTraceability.find((record) => record.id === id)?.informationClassification ??
          p0P4ReadinessGates.find((record) => record.id === id)?.informationClassification ??
          p5HandoffPackages.find((record) => record.id === id)?.informationClassification ??
          designApplicability.find((record) => record.id === id)?.informationClassification ??
          designPersonaRoleModels.find((record) => record.id === id)?.informationClassification ??
          userJourneyModels.find((record) => record.id === id)?.informationClassification ??
          informationArchitectureModels.find((record) => record.id === id)?.informationClassification ??
          screenStateInventories.find((record) => record.id === id)?.informationClassification ??
          designRequirements.find((record) => record.id === id)?.informationClassification ??
          designSystemTokenContracts.find((record) => record.id === id)?.informationClassification ??
          accessibilityDesignRules.find((record) => record.id === id)?.informationClassification ??
          responsiveMultiPlatformTargets.find((record) => record.id === id)?.informationClassification ??
          manualFigmaExecutionPaths.find((record) => record.id === id)?.informationClassification ??
          figmaMcpCapabilityDiscoveries.find((record) => record.id === id)?.informationClassification ??
          designConflictResolutions.find((record) => record.id === id)?.informationClassification ??
          humanDesignApprovals.find((record) => record.id === id)?.informationClassification ??
          portableDesignSnapshots.find((record) => record.bundleId === id)?.classification ??
          stakeholderModels.find((record) => record.id === id)?.informationClassification ??
          outcomeModels.find((record) => record.id === id)?.informationClassification
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
    append("business-understanding", "business-understanding-record", businessUnderstanding)
    append(
      "business-understanding-history",
      "business-understanding-record",
      businessUnderstandingHistory,
      (record) => `business-understanding-history/business-understanding-${record.id}-r${record.revision}.json`,
    )
    append("business-capability-maps", "business-capability-map", businessCapabilityMaps)
    append(
      "business-capability-map-history",
      "business-capability-map",
      businessCapabilityMapHistory,
      (record) => `business-capability-map-history/business-capability-map-${record.id}-r${record.revision}.json`,
    )
    append("value-stream-models", "value-stream-model", valueStreamModels)
    append(
      "value-stream-model-history",
      "value-stream-model",
      valueStreamModelHistory,
      (record) => `value-stream-model-history/value-stream-model-${record.id}-r${record.revision}.json`,
    )
    append("operating-models", "operating-model", operatingModels)
    append(
      "operating-model-history",
      "operating-model",
      operatingModelHistory,
      (record) => `operating-model-history/operating-model-${record.id}-r${record.revision}.json`,
    )
    append("business-rule-catalogs", "business-rule-catalog", businessRuleCatalogs)
    append(
      "business-rule-catalog-history",
      "business-rule-catalog",
      businessRuleCatalogHistory,
      (record) => `business-rule-catalog-history/business-rule-catalog-${record.id}-r${record.revision}.json`,
    )
    append("business-architecture-baselines", "business-architecture-baseline-candidate", businessArchitectureBaselines)
    append(
      "business-architecture-baseline-history",
      "business-architecture-baseline-candidate",
      businessArchitectureBaselineHistory,
      (record) => `business-architecture-baseline-history/business-architecture-baseline-${record.id}-r${record.revision}.json`,
    )
    append("system-solution-architectures", "system-solution-architecture-candidate", systemSolutionArchitectures)
    append(
      "system-solution-architecture-history",
      "system-solution-architecture-candidate",
      systemSolutionArchitectureHistory,
      (record) => `system-solution-architecture-history/system-solution-architecture-${record.id}-r${record.revision}.json`,
    )
    append("bounded-context-models", "bounded-context-ownership-candidate", boundedContextModels)
    append(
      "bounded-context-model-history",
      "bounded-context-ownership-candidate",
      boundedContextModelHistory,
      (record) => `bounded-context-model-history/bounded-context-model-${record.id}-r${record.revision}.json`,
    )
    append("security-privacy-assessments", "security-privacy-threat-assessment-candidate", securityPrivacyAssessments)
    append(
      "security-privacy-assessment-history",
      "security-privacy-threat-assessment-candidate",
      securityPrivacyAssessmentHistory,
      (record) => `security-privacy-assessment-history/security-privacy-assessment-${record.id}-r${record.revision}.json`,
    )
    append("process-models", "process-model-candidate", processModels)
    append(
      "process-model-history",
      "process-model-candidate",
      processModelHistory,
      (record) => `process-model-history/process-model-${record.id}-r${record.revision}.json`,
    )
    append("data-models", "data-model-candidate", dataModels)
    append(
      "data-model-history",
      "data-model-candidate",
      dataModelHistory,
      (record) => `data-model-history/data-model-${record.id}-r${record.revision}.json`,
    )
    append("authorization-models", "authorization-model-candidate", authorizationModels)
    append(
      "authorization-model-history",
      "authorization-model-candidate",
      authorizationModelHistory,
      (record) => `authorization-model-history/authorization-model-${record.id}-r${record.revision}.json`,
    )
    append("event-integration-models", "event-integration-model-candidate", eventIntegrationModels)
    append(
      "event-integration-model-history",
      "event-integration-model-candidate",
      eventIntegrationModelHistory,
      (record) => `event-integration-model-history/event-integration-model-${record.id}-r${record.revision}.json`,
    )
    append("failure-recovery-models", "failure-recovery-model-candidate", failureRecoveryModels)
    append(
      "failure-recovery-model-history",
      "failure-recovery-model-candidate",
      failureRecoveryModelHistory,
      (record) => `failure-recovery-model-history/failure-recovery-model-${record.id}-r${record.revision}.json`,
    )
    append("architecture-challenge-models", "architecture-challenge-model-candidate", architectureChallengeModels)
    append(
      "architecture-challenge-model-history",
      "architecture-challenge-model-candidate",
      architectureChallengeModelHistory,
      (record) => `architecture-challenge-model-history/architecture-challenge-model-${record.id}-r${record.revision}.json`,
    )
    append("decision-registers", "decision-register-candidate", decisionRegisters)
    append(
      "decision-register-history",
      "decision-register-candidate",
      decisionRegisterHistory,
      (record) => `decision-register-history/decision-register-${record.id}-r${record.revision}.json`,
    )
    append("risk-registers", "risk-register-candidate", riskRegisters)
    append(
      "risk-register-history",
      "risk-register-candidate",
      riskRegisterHistory,
      (record) => `risk-register-history/risk-register-${record.id}-r${record.revision}.json`,
    )
    append("evidence-registries", "evidence-registry-candidate", evidenceRegistries)
    append(
      "evidence-registry-history",
      "evidence-registry-candidate",
      evidenceRegistryHistory,
      (record) => `evidence-registry-history/evidence-registry-${record.id}-r${record.revision}.json`,
    )
    append("end-to-end-traceability", "end-to-end-traceability-candidate", endToEndTraceability)
    append(
      "end-to-end-traceability-history",
      "end-to-end-traceability-candidate",
      endToEndTraceabilityHistory,
      (record) => `end-to-end-traceability-history/end-to-end-traceability-${record.id}-r${record.revision}.json`,
    )
    append("p0-p4-readiness-gates", "p0-p4-readiness-gate-candidate", p0P4ReadinessGates)
    append(
      "p0-p4-readiness-gate-history",
      "p0-p4-readiness-gate-candidate",
      p0P4ReadinessGateHistory,
      (record) => `p0-p4-readiness-gate-history/p0-p4-readiness-gate-${record.id}-r${record.revision}.json`,
    )
    append("p5-handoff-packages", "p5-handoff-package-candidate", p5HandoffPackages)
    append(
      "p5-handoff-package-history",
      "p5-handoff-package-candidate",
      p5HandoffPackageHistory,
      (record) => `p5-handoff-package-history/p5-handoff-package-${record.id}-r${record.revision}.json`,
    )
    append("design-applicability", "design-applicability-candidate", designApplicability)
    append(
      "design-applicability-history",
      "design-applicability-candidate",
      designApplicabilityHistory,
      (record) => `design-applicability-history/design-applicability-${record.id}-r${record.revision}.json`,
    )
    append("design-persona-role-models", "design-persona-role-candidate", designPersonaRoleModels)
    append(
      "design-persona-role-model-history",
      "design-persona-role-candidate",
      designPersonaRoleModelHistory,
      (record) => `design-persona-role-model-history/design-persona-role-${record.id}-r${record.revision}.json`,
    )
    append("user-journey-models", "user-journey-model-candidate", userJourneyModels)
    append(
      "user-journey-model-history",
      "user-journey-model-candidate",
      userJourneyModelHistory,
      (record) => `user-journey-model-history/user-journey-${record.id}-r${record.revision}.json`,
    )
    append("information-architecture-models", "information-architecture-model-candidate", informationArchitectureModels)
    append(
      "information-architecture-model-history",
      "information-architecture-model-candidate",
      informationArchitectureModelHistory,
      (record) => `information-architecture-model-history/information-architecture-${record.id}-r${record.revision}.json`,
    )
    append("screen-state-inventories", "screen-state-inventory-candidate", screenStateInventories)
    append(
      "screen-state-inventory-history",
      "screen-state-inventory-candidate",
      screenStateInventoryHistory,
      (record) => `screen-state-inventory-history/screen-state-inventory-${record.id}-r${record.revision}.json`,
    )
    append("design-requirements", "design-requirements-candidate", designRequirements)
    append(
      "design-requirements-history",
      "design-requirements-candidate",
      designRequirementsHistory,
      (record) => `design-requirements-history/design-requirements-${record.id}-r${record.revision}.json`,
    )
    append("design-system-token-contracts", "design-system-token-contract-candidate", designSystemTokenContracts)
    append(
      "design-system-token-contracts-history",
      "design-system-token-contract-candidate",
      designSystemTokenContractHistory,
      (record) => `design-system-token-contracts-history/design-system-token-contract-${record.id}-r${record.revision}.json`,
    )
    append("accessibility-design-rules", "accessibility-design-rules-candidate", accessibilityDesignRules)
    append(
      "accessibility-design-rules-history",
      "accessibility-design-rules-candidate",
      accessibilityDesignRulesHistory,
      (record) => `accessibility-design-rules-history/accessibility-design-rules-${record.id}-r${record.revision}.json`,
    )
    append("responsive-multi-platform-targets", "responsive-multi-platform-targets-candidate", responsiveMultiPlatformTargets)
    append(
      "responsive-multi-platform-targets-history",
      "responsive-multi-platform-targets-candidate",
      responsiveMultiPlatformTargetsHistory,
      (record) => `responsive-multi-platform-targets-history/responsive-multi-platform-targets-${record.id}-r${record.revision}.json`,
    )
    append("manual-figma-execution-paths", "manual-figma-execution-path-candidate", manualFigmaExecutionPaths)
    append(
      "manual-figma-execution-path-history",
      "manual-figma-execution-path-candidate",
      manualFigmaExecutionPathHistory,
      (record) => `manual-figma-execution-path-history/manual-figma-execution-path-${record.id}-r${record.revision}.json`,
    )
    append(
      "figma-mcp-capability-discoveries",
      "figma-mcp-capability-discovery-candidate",
      figmaMcpCapabilityDiscoveries,
    )
    append(
      "figma-mcp-capability-discovery-history",
      "figma-mcp-capability-discovery-candidate",
      figmaMcpCapabilityDiscoveryHistory,
      (record) => `figma-mcp-capability-discovery-history/figma-mcp-capability-discovery-${record.id}-r${record.revision}.json`,
    )
    append("figma-read-snapshots", "figma-read-snapshot-candidate", figmaReadSnapshots)
    append(
      "figma-read-snapshot-history",
      "figma-read-snapshot-candidate",
      figmaReadSnapshotHistory,
      (record) => `figma-read-snapshot-history/figma-read-snapshot-${record.id}-r${record.revision}.json`,
    )
    append("figma-context-imports", "figma-context-import-candidate", figmaContextImports)
    append(
      "figma-context-import-history",
      "figma-context-import-candidate",
      figmaContextImportHistory,
      (record) => `figma-context-import-history/figma-context-import-${record.id}-r${record.revision}.json`,
    )
    append("outbound-design-brief-packages", "outbound-design-brief-package-candidate", outboundDesignBriefPackages)
    append(
      "outbound-design-brief-package-history",
      "outbound-design-brief-package-candidate",
      outboundDesignBriefPackageHistory,
      (record) => `outbound-design-brief-package-history/outbound-design-brief-package-${record.id}-r${record.revision}.json`,
    )
    append("governed-figma-writes", "governed-figma-write-candidate", governedFigmaWrites)
    append(
      "governed-figma-write-history",
      "governed-figma-write-candidate",
      governedFigmaWriteHistory,
      (record) => `governed-figma-write-history/governed-figma-write-${record.id}-r${record.revision}.json`,
    )
    append(
      "finalized-figma-snapshot-imports",
      "finalized-figma-snapshot-import-candidate",
      finalizedFigmaSnapshotImports,
    )
    append(
      "finalized-figma-snapshot-import-history",
      "finalized-figma-snapshot-import-candidate",
      finalizedFigmaSnapshotImportHistory,
      (record) => `finalized-figma-snapshot-import-history/finalized-figma-snapshot-import-${record.id}-r${record.revision}.json`,
    )
    append(
      "design-to-requirement-bindings",
      "design-to-requirement-binding-candidate",
      designToRequirementBindings,
    )
    append(
      "design-to-requirement-binding-history",
      "design-to-requirement-binding-candidate",
      designToRequirementBindingHistory,
      (record) => `design-to-requirement-binding-history/design-to-requirement-binding-${record.id}-r${record.revision}.json`,
    )
    append("designer-ready-gates", "designer-ready-gate-candidate", designerReadyGates)
    append(
      "designer-ready-gate-history",
      "designer-ready-gate-candidate",
      designerReadyGateHistory,
      (record) => `designer-ready-gate-history/designer-ready-gate-${record.id}-r${record.revision}.json`,
    )
    append("design-deltas", "design-delta-candidate", designDeltas)
    append(
      "design-delta-history",
      "design-delta-candidate",
      designDeltaHistory,
      (record) => `design-delta-history/design-delta-${record.id}-r${record.revision}.json`,
    )
    append("design-conflict-resolutions", "design-conflict-resolution-candidate", designConflictResolutions)
    append(
      "design-conflict-resolution-history",
      "design-conflict-resolution-candidate",
      designConflictResolutionHistory,
      (record) =>
        `design-conflict-resolution-history/design-conflict-resolution-${record.id}-r${record.revision}.json`,
    )
    append("human-design-approvals", "human-design-approval-candidate", humanDesignApprovals)
    append(
      "human-design-approval-history",
      "human-design-approval-candidate",
      humanDesignApprovalHistory,
      (record) => `human-design-approval-history/human-design-approval-${record.id}-r${record.revision}.json`,
    )
    append("design-baselines", "design-baseline-candidate", designBaselines)
    append(
      "design-baseline-history",
      "design-baseline-candidate",
      designBaselineHistory,
      (record) => `design-baseline-history/design-baseline-${record.id}-r${record.revision}.json`,
    )
    append("design-drift-detections", "design-drift-detection-candidate", designDriftDetections)
    append(
      "design-drift-detection-history",
      "design-drift-detection-candidate",
      designDriftDetectionHistory,
      (record) => `design-drift-detection-history/design-drift-detection-${record.id}-r${record.revision}.json`,
    )
    append(
      "candidates",
      "portable-design-snapshot",
      portableDesignSnapshots,
      (record) => `candidates/${this.portableDesignSnapshotFilename(record.bundleId)}`,
    )
    append("stakeholder-models", "stakeholder-role-model", stakeholderModels)
    append(
      "stakeholder-model-history",
      "stakeholder-role-model",
      stakeholderModelHistory,
      (record) => `stakeholder-model-history/stakeholder-model-${record.id}-r${record.revision}.json`,
    )
    append("outcome-models", "outcome-measure-model", outcomeModels)
    append(
      "outcome-model-history",
      "outcome-measure-model",
      outcomeModelHistory,
      (record) => `outcome-model-history/outcome-model-${record.id}-r${record.revision}.json`,
    )
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
          ...businessUnderstanding.map((record) => record.informationClassification),
          ...businessCapabilityMaps.map((record) => record.informationClassification),
          ...systemSolutionArchitectures.map((record) => record.informationClassification),
          ...boundedContextModels.map((record) => record.informationClassification),
          ...p5HandoffPackages.map((record) => record.informationClassification),
          ...designApplicability.map((record) => record.informationClassification),
          ...designPersonaRoleModels.map((record) => record.informationClassification),
          ...userJourneyModels.map((record) => record.informationClassification),
          ...informationArchitectureModels.map((record) => record.informationClassification),
          ...screenStateInventories.map((record) => record.informationClassification),
          ...designRequirements.map((record) => record.informationClassification),
          ...designSystemTokenContracts.map((record) => record.informationClassification),
          ...accessibilityDesignRules.map((record) => record.informationClassification),
          ...responsiveMultiPlatformTargets.map((record) => record.informationClassification),
          ...manualFigmaExecutionPaths.map((record) => record.informationClassification),
          ...figmaMcpCapabilityDiscoveries.map((record) => record.informationClassification),
          ...portableDesignSnapshots.map((record) => record.classification),
          ...stakeholderModels.map((record) => record.informationClassification),
          ...outcomeModels.map((record) => record.informationClassification),
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
      if (member.path.startsWith("business-understanding-history/")) {
        const record = validated as BusinessUnderstanding
        const expectedHistoryPath =
          `business-understanding-history/business-understanding-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Business Understanding history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("business-capability-map-history/")) {
        const record = validated as BusinessCapabilityMap
        const expectedHistoryPath =
          `business-capability-map-history/business-capability-map-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Business Capability Map history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("value-stream-model-history/")) {
        const record = validated as ValueStreamModel
        const expectedHistoryPath =
          `value-stream-model-history/value-stream-model-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Value Stream Model history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("operating-model-history/")) {
        const record = validated as OperatingModel
        const expectedHistoryPath =
          `operating-model-history/operating-model-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Operating Model history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("business-rule-catalog-history/")) {
        const record = validated as BusinessRuleCatalog
        const expectedHistoryPath =
          `business-rule-catalog-history/business-rule-catalog-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Business Rule Catalog history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("business-architecture-baseline-history/")) {
        const record = validated as BusinessArchitectureBaseline
        const expectedHistoryPath =
          `business-architecture-baseline-history/business-architecture-baseline-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Business Architecture Baseline history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("system-solution-architecture-history/")) {
        const record = validated as SystemSolutionArchitecture
        const expectedHistoryPath =
          `system-solution-architecture-history/system-solution-architecture-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import System/Solution Architecture history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("bounded-context-model-history/")) {
        const record = validated as BoundedContextModel
        const expectedHistoryPath =
          `bounded-context-model-history/bounded-context-model-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Bounded Context Model history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("security-privacy-assessment-history/")) {
        const record = validated as SecurityPrivacyAssessment
        const expectedHistoryPath =
          `security-privacy-assessment-history/security-privacy-assessment-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Security, Privacy, and Threat Assessment history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("process-model-history/")) {
        const record = validated as ProcessModel
        const expectedHistoryPath = `process-model-history/process-model-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Process Model history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("data-model-history/")) {
        const record = validated as DataModel
        const expectedHistoryPath = `data-model-history/data-model-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Data Model history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("authorization-model-history/")) {
        const record = validated as AuthorizationModel
        const expectedHistoryPath =
          `authorization-model-history/authorization-model-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Authorization Model history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("event-integration-model-history/")) {
        const record = validated as EventIntegrationModel
        const expectedHistoryPath =
          `event-integration-model-history/event-integration-model-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Event and Integration Model history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("failure-recovery-model-history/")) {
        const record = validated as FailureRecoveryModel
        const expectedHistoryPath =
          `failure-recovery-model-history/failure-recovery-model-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Failure and Recovery Model history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("architecture-challenge-model-history/")) {
        const record = validated as ArchitectureChallengeModel
        const expectedHistoryPath =
          `architecture-challenge-model-history/architecture-challenge-model-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Architecture Challenge history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("decision-register-history/")) {
        const record = validated as DecisionRegister
        const expectedHistoryPath =
          `decision-register-history/decision-register-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Decision Register history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("risk-register-history/")) {
        const record = validated as RiskRegister
        const expectedHistoryPath =
          `risk-register-history/risk-register-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Risk Register history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("evidence-registry-history/")) {
        const record = validated as EvidenceRegistry
        const expectedHistoryPath =
          `evidence-registry-history/evidence-registry-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Evidence Registry history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("end-to-end-traceability-history/")) {
        const record = validated as EndToEndTraceability
        const expectedHistoryPath =
          `end-to-end-traceability-history/end-to-end-traceability-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import End-to-End Traceability history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("p0-p4-readiness-gate-history/")) {
        const record = validated as P0P4ReadinessGate
        const expectedHistoryPath =
          `p0-p4-readiness-gate-history/p0-p4-readiness-gate-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import P0-P4 Readiness Gate history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("p5-handoff-package-history/")) {
        const record = validated as P5HandoffPackage
        const expectedHistoryPath =
          `p5-handoff-package-history/p5-handoff-package-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import P5 Handoff Package history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("design-applicability-history/")) {
        const record = validated as DesignApplicability
        const expectedHistoryPath =
          `design-applicability-history/design-applicability-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Design Applicability history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("design-persona-role-model-history/")) {
        const record = validated as DesignPersonaRoleModel
        const expectedHistoryPath =
          `design-persona-role-model-history/design-persona-role-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Design Persona and Role history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("user-journey-model-history/")) {
        const record = validated as UserJourneyModel
        const expectedHistoryPath =
          `user-journey-model-history/user-journey-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import User Journey Model history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("information-architecture-model-history/")) {
        const record = validated as InformationArchitectureModel
        const expectedHistoryPath =
          `information-architecture-model-history/information-architecture-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Information Architecture Model history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("screen-state-inventory-history/")) {
        const record = validated as ScreenStateInventory
        const expectedHistoryPath =
          `screen-state-inventory-history/screen-state-inventory-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Screen and State Inventory history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("design-requirements-history/")) {
        const record = validated as DesignRequirements
        const expectedHistoryPath =
          `design-requirements-history/design-requirements-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Design Requirements history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("design-system-token-contracts-history/")) {
        const record = validated as DesignSystemTokenContract
        const expectedHistoryPath =
          `design-system-token-contracts-history/design-system-token-contract-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Design System and Token Contract history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("accessibility-design-rules-history/")) {
        const record = validated as AccessibilityDesignRules
        const expectedHistoryPath =
          `accessibility-design-rules-history/accessibility-design-rules-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Accessibility Design Rules history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("responsive-multi-platform-targets-history/")) {
        const record = validated as ResponsiveMultiPlatformTargets
        const expectedHistoryPath =
          `responsive-multi-platform-targets-history/responsive-multi-platform-targets-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Responsive and Multi-Platform Targets history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("manual-figma-execution-path-history/")) {
        const record = validated as ManualFigmaExecutionPath
        const expectedHistoryPath =
          `manual-figma-execution-path-history/manual-figma-execution-path-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Manual Figma Execution Path history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("figma-mcp-capability-discovery-history/")) {
        const record = validated as FigmaMcpCapabilityDiscovery
        const expectedHistoryPath =
          `figma-mcp-capability-discovery-history/figma-mcp-capability-discovery-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Figma MCP Capability Discovery history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("figma-read-snapshot-history/")) {
        const record = validated as FigmaReadSnapshot
        const expectedHistoryPath =
          `figma-read-snapshot-history/figma-read-snapshot-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Figma Read Snapshot history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("figma-context-import-history/")) {
        const record = validated as FigmaContextImport
        const expectedHistoryPath =
          `figma-context-import-history/figma-context-import-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Figma Context Import history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("outbound-design-brief-package-history/")) {
        const record = validated as OutboundDesignBriefPackage
        const expectedHistoryPath =
          `outbound-design-brief-package-history/outbound-design-brief-package-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Outbound Design Brief Package history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("governed-figma-write-history/")) {
        const record = validated as GovernedFigmaWrite
        const expectedHistoryPath =
          `governed-figma-write-history/governed-figma-write-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Governed Figma Write history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("finalized-figma-snapshot-import-history/")) {
        const record = validated as FinalizedFigmaSnapshotImport
        const expectedHistoryPath =
          `finalized-figma-snapshot-import-history/finalized-figma-snapshot-import-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Finalized Figma Snapshot Import history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("design-to-requirement-binding-history/")) {
        const record = validated as DesignToRequirementBinding
        const expectedHistoryPath =
          `design-to-requirement-binding-history/design-to-requirement-binding-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Design-to-Requirement Binding history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("designer-ready-gate-history/")) {
        const record = validated as DesignerReadyGate
        const expectedHistoryPath = `designer-ready-gate-history/designer-ready-gate-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Designer-Ready Gate history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("design-delta-history/")) {
        const record = validated as DesignDelta
        const expectedHistoryPath = `design-delta-history/design-delta-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Design Delta history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("design-conflict-resolution-history/")) {
        const record = validated as DesignConflictResolution
        const expectedHistoryPath =
          `design-conflict-resolution-history/design-conflict-resolution-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Design Conflict Resolution history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("human-design-approval-history/")) {
        const record = validated as HumanDesignApproval
        const expectedHistoryPath =
          `human-design-approval-history/human-design-approval-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Human Design Approval history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("design-baseline-history/")) {
        const record = validated as DesignBaseline
        const expectedHistoryPath =
          `design-baseline-history/design-baseline-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Design Baseline history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("design-drift-detection-history/")) {
        const record = validated as DesignDriftDetection
        const expectedHistoryPath =
          `design-drift-detection-history/design-drift-detection-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Design Drift Detection history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("candidates/portable-design-")) {
        const record = validated as PortableDesignImportResult
        const expectedPath = `candidates/${this.portableDesignSnapshotFilename(record.bundleId)}`
        if (member.path !== expectedPath) {
          throw new Error(`Import portable design snapshot filename does not match its bundle identity: ${member.path}`)
        }
      }
      if (member.path.startsWith("stakeholder-model-history/")) {
        const record = validated as StakeholderModel
        const expectedHistoryPath =
          `stakeholder-model-history/stakeholder-model-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Stakeholder Model history filename does not match its snapshot: ${member.path}`)
        }
      }
      if (member.path.startsWith("outcome-model-history/")) {
        const record = validated as OutcomeModel
        const expectedHistoryPath =
          `outcome-model-history/outcome-model-${record.id}-r${record.revision}.json`
        if (member.path !== expectedHistoryPath) {
          throw new Error(`Import Outcome Model history filename does not match its snapshot: ${member.path}`)
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
    if (/^candidates\/portable-design-/.test(path)) return this.validatePortableDesignSnapshot(validated)
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

    const collectBusinessSourceReferences = (
      value: unknown,
      references: ExactSourceReference[] = [],
    ): ExactSourceReference[] => {
      if (Array.isArray(value)) {
        for (const item of value) collectBusinessSourceReferences(item, references)
        return references
      }
      if (!value || typeof value !== "object") return references
      const candidate = exactSourceReferenceSchema.safeParse(value)
      if (candidate.success) {
        references.push(candidate.data)
        return references
      }
      for (const child of Object.values(value)) collectBusinessSourceReferences(child, references)
      return references
    }
    const productSnapshotsByRevision = new Map(productHistory.map((history) => [
      history.revision,
      history.product,
    ]))
    const validateBusinessRecordBase = (
      record: BusinessUnderstanding | StakeholderModel | OutcomeModel | BusinessCapabilityMap | ValueStreamModel | OperatingModel | BusinessRuleCatalog | BusinessArchitectureBaseline | SystemSolutionArchitecture | BoundedContextModel | SecurityPrivacyAssessment | ProcessModel | DataModel | AuthorizationModel | EventIntegrationModel | FailureRecoveryModel | ArchitectureChallengeModel | DecisionRegister | RiskRegister | EvidenceRegistry | EndToEndTraceability | P0P4ReadinessGate | P5HandoffPackage | DesignApplicability | DesignPersonaRoleModel | UserJourneyModel | InformationArchitectureModel | ScreenStateInventory | DesignRequirements | DesignSystemTokenContract | AccessibilityDesignRules | ResponsiveMultiPlatformTargets | ManualFigmaExecutionPath | FigmaMcpCapabilityDiscovery | FigmaReadSnapshot | FigmaContextImport | OutboundDesignBriefPackage | GovernedFigmaWrite | FinalizedFigmaSnapshotImport | DesignToRequirementBinding | DesignerReadyGate | DesignDelta | DesignConflictResolution | HumanDesignApproval | DesignBaseline | DesignDriftDetection,
      label: string,
    ): void => {
      const initiative = initiativesById.get(record.initiativeId)
      if (!initiative) throw new Error(`Import ${label} ${record.id} has no Initiative`)
      if (record.productId !== product.id || initiative.productId !== product.id) {
        throw new Error(`Import ${label} ${record.id} targets a different Product`)
      }
      const productSnapshot = productSnapshotsByRevision.get(record.context.productRevision)
      if (!productSnapshot || canonicalDigest(productSnapshot) !== record.context.productDigest) {
        throw new Error(`Import ${label} ${record.id} Product binding is unresolved`)
      }
      const initiativeRevision = initiative.revision ?? 1
      if (record.context.initiativeRevision > initiativeRevision) {
        throw new Error(`Import ${label} ${record.id} references a future Initiative revision`)
      }
      if (
        record.context.initiativeRevision === initiativeRevision &&
        record.context.initiativeDigest !== canonicalDigest(initiative)
      ) throw new Error(`Import ${label} ${record.id} current Initiative digest does not match`)
      const uniqueReferences = new Map(collectBusinessSourceReferences(record).map((reference) => [
        `${reference.sourceId}:${reference.sourceRevision}:${reference.recordDigest}:${reference.contentDigest}`,
        reference,
      ]))
      for (const reference of uniqueReferences.values()) {
        const resolved = resolveExactSource(reference).snapshot
        if (resolved.initiativeId !== record.initiativeId) {
          throw new Error(`Import ${label} ${record.id} contains a Source from another Initiative`)
        }
      }
    }
    const validateVersionedBusinessRecords = <
      T extends BusinessUnderstanding | StakeholderModel | OutcomeModel | BusinessCapabilityMap | ValueStreamModel | OperatingModel | BusinessRuleCatalog | BusinessArchitectureBaseline | SystemSolutionArchitecture | BoundedContextModel | SecurityPrivacyAssessment | ProcessModel | DataModel | AuthorizationModel | EventIntegrationModel | FailureRecoveryModel | ArchitectureChallengeModel | DecisionRegister | RiskRegister | EvidenceRegistry | EndToEndTraceability | P0P4ReadinessGate | P5HandoffPackage | DesignApplicability | DesignPersonaRoleModel | UserJourneyModel | InformationArchitectureModel | ScreenStateInventory | DesignRequirements | DesignSystemTokenContract | AccessibilityDesignRules | ResponsiveMultiPlatformTargets | ManualFigmaExecutionPath | FigmaMcpCapabilityDiscovery | FigmaReadSnapshot | FigmaContextImport | OutboundDesignBriefPackage | GovernedFigmaWrite | FinalizedFigmaSnapshotImport | DesignToRequirementBinding | DesignerReadyGate | DesignDelta | DesignConflictResolution | HumanDesignApproval | DesignBaseline | DesignDriftDetection,
    >(
      currentRecords: T[],
      historyRecords: T[],
      label: string,
    ): Map<string, T> => {
      const currentById = new Map(currentRecords.map((record) => [record.id, record]))
      const currentInitiatives = currentRecords.map((record) => record.initiativeId)
      if (new Set(currentInitiatives).size !== currentInitiatives.length) {
        throw new Error(`Import contains more than one current ${label} for an Initiative`)
      }
      const historyGroups = new Map<string, T[]>()
      const exact = new Map<string, T>()
      for (const history of historyRecords) {
        const group = historyGroups.get(history.id) ?? []
        group.push(history)
        historyGroups.set(history.id, group)
        exact.set(`${history.id}:${history.revision}:${canonicalDigest(history)}`, history)
        validateBusinessRecordBase(history, label)
      }
      for (const current of currentRecords) {
        validateBusinessRecordBase(current, label)
        const group = (historyGroups.get(current.id) ?? []).sort((left, right) => left.revision - right.revision)
        if (group.length !== current.revision) {
          throw new Error(`Import immutable ${label} history is incomplete for ${current.id}`)
        }
        for (const [index, revision] of group.entries()) {
          if (
            revision.revision !== index + 1 ||
            (index === 0 && revision.predecessorDigest !== undefined) ||
            (index > 0 && revision.predecessorDigest !== canonicalDigest(group[index - 1]))
          ) throw new Error(`Import ${label} predecessor chain is invalid for ${current.id}`)
        }
        if (canonicalDigest(group.at(-1)) !== canonicalDigest(current)) {
          throw new Error(`Import current ${label} does not match immutable history for ${current.id}`)
        }
      }
      for (const id of historyGroups.keys()) {
        if (!currentById.has(id)) throw new Error(`Import immutable ${label} history has no current record: ${id}`)
      }
      return exact
    }

    const businessUnderstanding = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("business-understanding/"))
      .map(([, record]) => businessUnderstandingSchema.parse(record))
    const businessUnderstandingHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("business-understanding-history/"))
      .map(([, record]) => businessUnderstandingSchema.parse(record))
    const exactBusinessUnderstanding = validateVersionedBusinessRecords(
      businessUnderstanding,
      businessUnderstandingHistory,
      "Business Understanding",
    )
    const stakeholderModels = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("stakeholder-models/"))
      .map(([, record]) => stakeholderModelSchema.parse(record))
    const stakeholderModelHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("stakeholder-model-history/"))
      .map(([, record]) => stakeholderModelSchema.parse(record))
    const exactStakeholderModels = validateVersionedBusinessRecords(
      stakeholderModels,
      stakeholderModelHistory,
      "Stakeholder Model",
    )
    const resolveBusinessUnderstanding = (
      reference: StakeholderModel["businessUnderstanding"],
      initiativeId: string,
    ): BusinessUnderstanding => {
      const record = exactBusinessUnderstanding.get(
        `${reference.recordId}:${reference.revision}:${reference.digest}`,
      )
      if (!record || record.initiativeId !== initiativeId) {
        throw new Error("Import exact Business Understanding reference is unresolved")
      }
      return record
    }
    const resolveStakeholderModel = (
      reference: OutcomeModel["stakeholderModel"],
      initiativeId: string,
    ): StakeholderModel => {
      const record = exactStakeholderModels.get(
        `${reference.recordId}:${reference.revision}:${reference.digest}`,
      )
      if (!record || record.initiativeId !== initiativeId) {
        throw new Error("Import exact Stakeholder Model reference is unresolved")
      }
      return record
    }
    for (const stakeholder of [...stakeholderModels, ...stakeholderModelHistory]) {
      resolveBusinessUnderstanding(stakeholder.businessUnderstanding, stakeholder.initiativeId)
    }

    const outcomeModels = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("outcome-models/"))
      .map(([, record]) => outcomeModelSchema.parse(record))
    const outcomeModelHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("outcome-model-history/"))
      .map(([, record]) => outcomeModelSchema.parse(record))
    const exactOutcomeModels = validateVersionedBusinessRecords(
      outcomeModels,
      outcomeModelHistory,
      "Outcome Model",
    )
    for (const outcome of [...outcomeModels, ...outcomeModelHistory]) {
      resolveBusinessUnderstanding(outcome.businessUnderstanding, outcome.initiativeId)
      const stakeholder = resolveStakeholderModel(outcome.stakeholderModel, outcome.initiativeId)
      const stakeholderKeys = new Set(stakeholder.stakeholders.map((entry) => entry.key))
      if (
        outcome.outcomes.some((entry) =>
          entry.beneficiaryStakeholderKeys.some((key) => !stakeholderKeys.has(key))) ||
        outcome.measures.some((measure) => !stakeholderKeys.has(measure.collection.ownerStakeholderKey))
      ) throw new Error(`Import Outcome Model ${outcome.id} references an unknown bound stakeholder`)
    }

    const resolveOutcomeModel = (
      reference: BusinessCapabilityMap["outcomeModel"],
      initiativeId: string,
    ): OutcomeModel => {
      const record = exactOutcomeModels.get(
        `${reference.recordId}:${reference.revision}:${reference.digest}`,
      )
      if (!record || record.initiativeId !== initiativeId) {
        throw new Error("Import exact Outcome Model reference is unresolved")
      }
      return record
    }
    const capabilityMaps = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("business-capability-maps/"))
      .map(([, record]) => businessCapabilityMapSchema.parse(record))
    const capabilityMapHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("business-capability-map-history/"))
      .map(([, record]) => businessCapabilityMapSchema.parse(record))
    const exactCapabilityMaps = validateVersionedBusinessRecords(
      capabilityMaps,
      capabilityMapHistory,
      "Business Capability Map",
    )
    for (const map of [...capabilityMaps, ...capabilityMapHistory]) {
      const business = resolveBusinessUnderstanding(map.businessUnderstanding, map.initiativeId)
      const stakeholder = resolveStakeholderModel(map.stakeholderModel, map.initiativeId)
      const outcome = resolveOutcomeModel(map.outcomeModel, map.initiativeId)
      const objectiveIds = new Set(business.objectives.map((objective) => objective.id))
      const stakeholderKeys = new Set(stakeholder.stakeholders.map((entry) => entry.key))
      const outcomeIds = new Set(outcome.outcomes.map((entry) => entry.id))
      for (const capability of map.capabilities) {
        if (capability.objectiveIds.some((id) => !objectiveIds.has(id))) {
          throw new Error(`Import Business Capability Map ${map.id} references an unknown bound objective`)
        }
        if (capability.outcomeIds.some((id) => !outcomeIds.has(id))) {
          throw new Error(`Import Business Capability Map ${map.id} references an unknown bound outcome`)
        }
        const roleKeys = [
          ...(capability.ownerStakeholderKey ? [capability.ownerStakeholderKey] : []),
          ...capability.accountableStakeholderKeys,
          ...capability.participatingStakeholderKeys,
          ...capability.gaps.flatMap((gap) => gap.ownerStakeholderKey ? [gap.ownerStakeholderKey] : []),
        ]
        if (roleKeys.some((key) => !stakeholderKeys.has(key))) {
          throw new Error(`Import Business Capability Map ${map.id} references an unknown bound stakeholder`)
        }
      }
    }

    const resolveCapabilityMap = (
      reference: ValueStreamModel["capabilityMap"],
      initiativeId: string,
    ): BusinessCapabilityMap => {
      const record = exactCapabilityMaps.get(
        `${reference.recordId}:${reference.revision}:${reference.digest}`,
      )
      if (!record || record.initiativeId !== initiativeId) {
        throw new Error("Import exact Business Capability Map reference is unresolved")
      }
      return record
    }
    const valueStreamModels = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("value-stream-models/"))
      .map(([, record]) => valueStreamModelSchema.parse(record))
    const valueStreamModelHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("value-stream-model-history/"))
      .map(([, record]) => valueStreamModelSchema.parse(record))
    const exactValueStreamModels = validateVersionedBusinessRecords(
      valueStreamModels,
      valueStreamModelHistory,
      "Value Stream Model",
    )
    for (const model of [...valueStreamModels, ...valueStreamModelHistory]) {
      const business = resolveBusinessUnderstanding(model.businessUnderstanding, model.initiativeId)
      const stakeholder = resolveStakeholderModel(model.stakeholderModel, model.initiativeId)
      const outcome = resolveOutcomeModel(model.outcomeModel, model.initiativeId)
      const capabilityMap = resolveCapabilityMap(model.capabilityMap, model.initiativeId)
      const objectiveIds = new Set(business.objectives.map((objective) => objective.id))
      const stakeholderKeys = new Set(stakeholder.stakeholders.map((entry) => entry.key))
      const outcomeIds = new Set(outcome.outcomes.map((entry) => entry.id))
      const capabilityKeys = new Set(capabilityMap.capabilities.map((entry) => entry.key))
      for (const stream of model.valueStreams) {
        if (stream.objectiveIds.some((id) => !objectiveIds.has(id))) {
          throw new Error(`Import Value Stream Model ${model.id} references an unknown bound objective`)
        }
        if (
          stream.outcomeIds.some((id) => !outcomeIds.has(id)) ||
          stream.stages.some((stage) => stage.outcomeIds.some((id) => !outcomeIds.has(id)))
        ) {
          throw new Error(`Import Value Stream Model ${model.id} references an unknown bound outcome`)
        }
        if (
          stream.capabilityKeys.some((key) => !capabilityKeys.has(key)) ||
          stream.stages.some((stage) => stage.capabilityKeys.some((key) => !capabilityKeys.has(key)))
        ) {
          throw new Error(`Import Value Stream Model ${model.id} references an unknown bound capability`)
        }
        const roleKeys = [
          ...(stream.ownerStakeholderKey ? [stream.ownerStakeholderKey] : []),
          ...stream.beneficiaryStakeholderKeys,
          ...stream.participatingStakeholderKeys,
          ...stream.stages.flatMap((stage) => stage.participatingStakeholderKeys),
          ...stream.bottlenecks.flatMap((bottleneck) =>
            bottleneck.ownerStakeholderKey ? [bottleneck.ownerStakeholderKey] : []),
        ]
        if (roleKeys.some((key) => !stakeholderKeys.has(key))) {
          throw new Error(`Import Value Stream Model ${model.id} references an unknown bound stakeholder`)
        }
      }
    }

    const resolveValueStreamModel = (
      reference: OperatingModel["valueStreamModel"],
      initiativeId: string,
    ): ValueStreamModel => {
      const record = exactValueStreamModels.get(
        `${reference.recordId}:${reference.revision}:${reference.digest}`,
      )
      if (!record || record.initiativeId !== initiativeId) {
        throw new Error("Import exact Value Stream Model reference is unresolved")
      }
      return record
    }
    const operatingModels = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("operating-models/"))
      .map(([, record]) => operatingModelSchema.parse(record))
    const operatingModelHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("operating-model-history/"))
      .map(([, record]) => operatingModelSchema.parse(record))
    const exactOperatingModels = validateVersionedBusinessRecords(
      operatingModels,
      operatingModelHistory,
      "Operating Model",
    )
    for (const model of [...operatingModels, ...operatingModelHistory]) {
      resolveBusinessUnderstanding(model.businessUnderstanding, model.initiativeId)
      const stakeholder = resolveStakeholderModel(model.stakeholderModel, model.initiativeId)
      resolveOutcomeModel(model.outcomeModel, model.initiativeId)
      const capabilityMap = resolveCapabilityMap(model.capabilityMap, model.initiativeId)
      const valueStream = resolveValueStreamModel(model.valueStreamModel, model.initiativeId)
      const stakeholderKeys = new Set(stakeholder.stakeholders.map((entry) => entry.key))
      const capabilityKeys = new Set(capabilityMap.capabilities.map((entry) => entry.key))
      const valueStreamKeys = new Set(valueStream.valueStreams.map((entry) => entry.key))
      const roleByKey = new Map(model.roles.map((role) => [role.key, role]))
      for (const role of model.roles) {
        if (role.stakeholderKeys.some((key) => !stakeholderKeys.has(key))) {
          throw new Error(`Import Operating Model ${model.id} references an unknown bound stakeholder`)
        }
        if (role.capabilityKeys.some((key) => !capabilityKeys.has(key))) {
          throw new Error(`Import Operating Model ${model.id} references an unknown bound capability`)
        }
        if (role.valueStreamKeys.some((key) => !valueStreamKeys.has(key))) {
          throw new Error(`Import Operating Model ${model.id} references an unknown bound value stream`)
        }
      }
      for (const right of model.decisionRights) {
        if (right.valueStreamKeys.some((key) => !valueStreamKeys.has(key))) {
          throw new Error(`Import Operating Model ${model.id} decision right references an unknown bound value stream`)
        }
        if (roleByKey.get(right.accountableRoleKey)?.governanceSystem !== right.governanceSystem) {
          throw new Error(`Import Operating Model ${model.id} crosses a governance-system authority boundary`)
        }
      }
    }

    const resolveOperatingModel = (
      reference: BusinessRuleCatalog["operatingModel"],
      initiativeId: string,
    ): OperatingModel => {
      const record = exactOperatingModels.get(
        `${reference.recordId}:${reference.revision}:${reference.digest}`,
      )
      if (!record || record.initiativeId !== initiativeId) {
        throw new Error("Import exact Operating Model reference is unresolved")
      }
      return record
    }
    const businessRuleCatalogs = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("business-rule-catalogs/"))
      .map(([, record]) => businessRuleCatalogSchema.parse(record))
    const businessRuleCatalogHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("business-rule-catalog-history/"))
      .map(([, record]) => businessRuleCatalogSchema.parse(record))
    const exactBusinessRuleCatalogs = validateVersionedBusinessRecords(
      businessRuleCatalogs,
      businessRuleCatalogHistory,
      "Business Rule Catalog",
    )
    for (const catalog of [...businessRuleCatalogs, ...businessRuleCatalogHistory]) {
      resolveBusinessUnderstanding(catalog.businessUnderstanding, catalog.initiativeId)
      resolveStakeholderModel(catalog.stakeholderModel, catalog.initiativeId)
      resolveOutcomeModel(catalog.outcomeModel, catalog.initiativeId)
      const capabilityMap = resolveCapabilityMap(catalog.capabilityMap, catalog.initiativeId)
      const valueStream = resolveValueStreamModel(catalog.valueStreamModel, catalog.initiativeId)
      const operatingModel = resolveOperatingModel(catalog.operatingModel, catalog.initiativeId)
      const capabilityKeys = new Set(capabilityMap.capabilities.map((entry) => entry.key))
      const valueStreamKeys = new Set(valueStream.valueStreams.map((entry) => entry.key))
      const roleByKey = new Map(operatingModel.roles.map((role) => [role.key, role]))
      const decisionRightByKey = new Map(operatingModel.decisionRights.map((right) => [right.key, right]))
      for (const rule of catalog.rules) {
        if (!roleByKey.has(rule.ownerRoleKey)) {
          throw new Error(`Import Business Rule Catalog ${catalog.id} references an unknown bound owner role`)
        }
        if (rule.capabilityKeys.some((key) => !capabilityKeys.has(key))) {
          throw new Error(`Import Business Rule Catalog ${catalog.id} references an unknown bound capability`)
        }
        if (rule.valueStreamKeys.some((key) => !valueStreamKeys.has(key))) {
          throw new Error(`Import Business Rule Catalog ${catalog.id} references an unknown bound value stream`)
        }
        if (rule.decisionRightKeys.some((key) => !decisionRightByKey.has(key))) {
          throw new Error(`Import Business Rule Catalog ${catalog.id} references an unknown bound decision right`)
        }
      }
      for (const target of catalog.enforcementTargets) {
        if (!roleByKey.has(target.responsibleRoleKey)) {
          throw new Error(`Import Business Rule Catalog ${catalog.id} enforcement target references an unknown bound role`)
        }
      }
      for (const exception of catalog.exceptions) {
        const decisionRight = decisionRightByKey.get(exception.decisionRightKey)
        if (!roleByKey.has(exception.approvingRoleKey) || !decisionRight) {
          throw new Error(`Import Business Rule Catalog ${catalog.id} exception authority is unresolved`)
        }
        if (decisionRight.accountableRoleKey !== exception.approvingRoleKey) {
          throw new Error(`Import Business Rule Catalog ${catalog.id} exception crosses its decision-right authority boundary`)
        }
      }
      if (!roleByKey.has(catalog.conflictModel.ownerRoleKey)) {
        throw new Error(`Import Business Rule Catalog ${catalog.id} conflict owner is unresolved`)
      }
    }

    const resolveBusinessRuleCatalog = (
      reference: BusinessArchitectureBaseline["businessRuleCatalog"],
      initiativeId: string,
    ): BusinessRuleCatalog => {
      const record = exactBusinessRuleCatalogs.get(
        `${reference.recordId}:${reference.revision}:${reference.digest}`,
      )
      if (!record || record.initiativeId !== initiativeId) {
        throw new Error("Import exact Business Rule Catalog reference is unresolved")
      }
      return record
    }
    const businessArchitectureBaselines = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("business-architecture-baselines/"))
      .map(([, record]) => businessArchitectureBaselineSchema.parse(record))
    const businessArchitectureBaselineHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("business-architecture-baseline-history/"))
      .map(([, record]) => businessArchitectureBaselineSchema.parse(record))
    const exactBusinessArchitectureBaselines = validateVersionedBusinessRecords(
      businessArchitectureBaselines,
      businessArchitectureBaselineHistory,
      "Business Architecture Baseline",
    )
    for (const baseline of [...businessArchitectureBaselines, ...businessArchitectureBaselineHistory]) {
      resolveBusinessUnderstanding(baseline.businessUnderstanding, baseline.initiativeId)
      resolveStakeholderModel(baseline.stakeholderModel, baseline.initiativeId)
      resolveOutcomeModel(baseline.outcomeModel, baseline.initiativeId)
      const capabilityMap = resolveCapabilityMap(baseline.capabilityMap, baseline.initiativeId)
      const valueStream = resolveValueStreamModel(baseline.valueStreamModel, baseline.initiativeId)
      const operatingModel = resolveOperatingModel(baseline.operatingModel, baseline.initiativeId)
      const catalog = resolveBusinessRuleCatalog(baseline.businessRuleCatalog, baseline.initiativeId)
      const membership = {
        businessUnderstanding: baseline.businessUnderstanding,
        stakeholderModel: baseline.stakeholderModel,
        outcomeModel: baseline.outcomeModel,
        capabilityMap: baseline.capabilityMap,
        valueStreamModel: baseline.valueStreamModel,
        operatingModel: baseline.operatingModel,
        businessRuleCatalog: baseline.businessRuleCatalog,
      }
      if (baseline.membershipDigest !== canonicalDigest(membership)) {
        throw new Error(`Import Business Architecture Baseline ${baseline.id} membership digest is invalid`)
      }
      const expectedCoverage = [
        ...capabilityMap.capabilities.map((entry) => `capability:${entry.key}`),
        ...valueStream.valueStreams.map((entry) => `value-stream:${entry.key}`),
        ...operatingModel.roles.map((entry) => `operating-role:${entry.key}`),
        ...operatingModel.decisionRights.map((entry) => `decision-right:${entry.key}`),
        ...catalog.rules.map((entry) => `business-rule:${entry.key}`),
        ...catalog.enforcementTargets.map((entry) => `enforcement-target:${entry.key}`),
        ...catalog.exceptions.map((entry) => `exception:${entry.key}`),
      ].sort((left, right) => left.localeCompare(right))
      const actualCoverage = baseline.coverage.map((entry) => `${entry.elementKind}:${entry.elementKey}`)
      if (canonicalDigest(actualCoverage) !== canonicalDigest(expectedCoverage)) {
        throw new Error(`Import Business Architecture Baseline ${baseline.id} coverage differs from exact bound records`)
      }
      const capabilityKeys = new Set(capabilityMap.capabilities.map((entry) => entry.key))
      const valueStreamKeys = new Set(valueStream.valueStreams.map((entry) => entry.key))
      const roleKeys = new Set(operatingModel.roles.map((entry) => entry.key))
      const decisionRightByKey = new Map(operatingModel.decisionRights.map((entry) => [entry.key, entry]))
      const ruleKeys = new Set(catalog.rules.map((entry) => entry.key))
      for (const claim of baseline.integrationClaims) {
        if (claim.capabilityKeys.some((key) => !capabilityKeys.has(key)) ||
            claim.valueStreamKeys.some((key) => !valueStreamKeys.has(key)) ||
            claim.roleKeys.some((key) => !roleKeys.has(key)) ||
            claim.decisionRightKeys.some((key) => !decisionRightByKey.has(key)) ||
            claim.ruleKeys.some((key) => !ruleKeys.has(key))) {
          throw new Error(`Import Business Architecture Baseline ${baseline.id} integration claim is unresolved`)
        }
      }
      const integrated = new Set(baseline.integrationClaims.flatMap((claim) => [
        ...claim.capabilityKeys.map((key) => `capability:${key}`),
        ...claim.valueStreamKeys.map((key) => `value-stream:${key}`),
        ...claim.ruleKeys.map((key) => `business-rule:${key}`),
      ]))
      if (baseline.coverage.some((entry) =>
        entry.disposition === "included-candidate" &&
        ["capability", "value-stream", "business-rule"].includes(entry.elementKind) &&
        !integrated.has(`${entry.elementKind}:${entry.elementKey}`))) {
        throw new Error(`Import Business Architecture Baseline ${baseline.id} lacks required cross-model integration`)
      }
      const governedRoles = [
        baseline.governance.ownerRoleKey,
        ...baseline.governance.reviewerRoleKeys,
        baseline.changeControl.accountableRoleKey,
        ...baseline.consistencyChecks.map((check) => check.accountableRoleKey),
      ]
      if (governedRoles.some((key) => !roleKeys.has(key))) {
        throw new Error(`Import Business Architecture Baseline ${baseline.id} governance role is unresolved`)
      }
      const governanceRight = decisionRightByKey.get(baseline.governance.decisionRightKey)
      const changeRight = decisionRightByKey.get(baseline.changeControl.decisionRightKey)
      if (!governanceRight || governanceRight.accountableRoleKey !== baseline.governance.ownerRoleKey ||
          !changeRight || changeRight.accountableRoleKey !== baseline.changeControl.accountableRoleKey) {
        throw new Error(`Import Business Architecture Baseline ${baseline.id} crosses a decision-right authority boundary`)
      }
    }

    const systemSolutionArchitectures = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("system-solution-architectures/"))
      .map(([, record]) => systemSolutionArchitectureSchema.parse(record))
    const systemSolutionArchitectureHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("system-solution-architecture-history/"))
      .map(([, record]) => systemSolutionArchitectureSchema.parse(record))
    const exactSystemSolutionArchitectures = validateVersionedBusinessRecords(
      systemSolutionArchitectures,
      systemSolutionArchitectureHistory,
      "System/Solution Architecture",
    )
    for (const architecture of [...systemSolutionArchitectures, ...systemSolutionArchitectureHistory]) {
      const baseline = exactBusinessArchitectureBaselines.get(
        `${architecture.businessArchitectureBaseline.recordId}:${architecture.businessArchitectureBaseline.revision}:${architecture.businessArchitectureBaseline.digest}`,
      )
      if (!baseline || baseline.initiativeId !== architecture.initiativeId) {
        throw new Error(`Import System/Solution Architecture ${architecture.id} exact Business Architecture Baseline reference is unresolved`)
      }
      if (architecture.membershipDigest !== canonicalDigest({
        businessArchitectureBaseline: architecture.businessArchitectureBaseline,
      })) {
        throw new Error(`Import System/Solution Architecture ${architecture.id} membership digest is invalid`)
      }
      const operatingModel = resolveOperatingModel(baseline.operatingModel, architecture.initiativeId)
      const roleKeys = new Set(operatingModel.roles.map((entry) => entry.key))
      const referencedRoleKeys = [
        architecture.governance.ownerRoleKey,
        ...architecture.governance.reviewerRoleKeys,
        ...architecture.concerns.flatMap((entry) => entry.stakeholderRoleKeys),
        ...architecture.views.flatMap((entry) => entry.audienceRoleKeys),
        ...architecture.elements.map((entry) => entry.ownerRoleKey),
        ...architecture.lifecycleConsequences.map((entry) => entry.ownerRoleKey),
      ]
      if (referencedRoleKeys.some((key) => !roleKeys.has(key))) {
        throw new Error(`Import System/Solution Architecture ${architecture.id} references an unknown bound Operating Model role`)
      }
      const businessElementKeys = new Set(baseline.coverage.map((entry) => entry.elementKey))
      if (architecture.concerns.some((entry) =>
        entry.affectedBusinessElementKeys.some((key) => !businessElementKeys.has(key)))) {
        throw new Error(`Import System/Solution Architecture ${architecture.id} references an unknown bound Business Architecture element`)
      }
      const viewedRelations = new Set(architecture.views.flatMap((entry) => entry.relationKeys))
      const viewedDecisions = new Set(architecture.views.flatMap((entry) => entry.decisionKeys))
      if (architecture.relations.some((entry) => !viewedRelations.has(entry.key)) ||
          architecture.decisions.some((entry) => !viewedDecisions.has(entry.key))) {
        throw new Error(`Import System/Solution Architecture ${architecture.id} omits a relation or decision from selected views`)
      }
      const criterionQualityKeys = new Set(
        architecture.conformanceCriteria.flatMap((entry) => entry.qualityAttributeKeys),
      )
      const criterionDecisionKeys = new Set(
        architecture.conformanceCriteria.flatMap((entry) => entry.decisionKeys),
      )
      if (architecture.qualityAttributes.some((entry) => !criterionQualityKeys.has(entry.key)) ||
          architecture.decisions.some((entry) => !criterionDecisionKeys.has(entry.key))) {
        throw new Error(`Import System/Solution Architecture ${architecture.id} lacks conformance coverage`)
      }
    }

    const boundedContextModels = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("bounded-context-models/"))
      .map(([, record]) => boundedContextModelSchema.parse(record))
    const boundedContextModelHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("bounded-context-model-history/"))
      .map(([, record]) => boundedContextModelSchema.parse(record))
    validateVersionedBusinessRecords(
      boundedContextModels,
      boundedContextModelHistory,
      "Bounded Context Model",
    )
    for (const model of [...boundedContextModels, ...boundedContextModelHistory]) {
      const architecture = exactSystemSolutionArchitectures.get(
        `${model.systemSolutionArchitecture.recordId}:${model.systemSolutionArchitecture.revision}:${model.systemSolutionArchitecture.digest}`,
      )
      if (!architecture || architecture.initiativeId !== model.initiativeId) {
        throw new Error(`Import Bounded Context Model ${model.id} exact System/Solution Architecture reference is unresolved`)
      }
      if (model.membershipDigest !== canonicalDigest({
        systemSolutionArchitecture: model.systemSolutionArchitecture,
      })) {
        throw new Error(`Import Bounded Context Model ${model.id} membership digest is invalid`)
      }
      const baseline = exactBusinessArchitectureBaselines.get(
        `${architecture.businessArchitectureBaseline.recordId}:${architecture.businessArchitectureBaseline.revision}:${architecture.businessArchitectureBaseline.digest}`,
      )
      if (!baseline) {
        throw new Error(`Import Bounded Context Model ${model.id} architecture baseline is unresolved`)
      }
      const operatingModel = resolveOperatingModel(baseline.operatingModel, model.initiativeId)
      const roleKeys = new Set(operatingModel.roles.map((entry) => entry.key))
      const referencedRoleKeys = [
        model.governance.ownerRoleKey,
        ...model.governance.reviewerRoleKeys,
        ...model.boundedContexts.flatMap((entry) => [entry.ownerRoleKey, ...entry.stewardRoleKeys]),
        ...model.contracts.map((entry) => entry.ownerRoleKey),
      ]
      if (referencedRoleKeys.some((key) => !roleKeys.has(key))) {
        throw new Error(`Import Bounded Context Model ${model.id} references an unknown bound Operating Model role`)
      }
      const elementByKey = new Map(architecture.elements.map((entry) => [entry.key, entry]))
      const relationByKey = new Map(architecture.relations.map((entry) => [entry.key, entry]))
      const contextByElement = new Map<string, string>()
      for (const boundedContext of model.boundedContexts) {
        for (const elementKey of boundedContext.architectureElementKeys) {
          if (!elementByKey.has(elementKey)) {
            throw new Error(`Import Bounded Context Model ${model.id} references an unknown architecture element`)
          }
          contextByElement.set(elementKey, boundedContext.key)
        }
        if (boundedContext.dataAssetElementKeys.some((key) => elementByKey.get(key)?.kind !== "data-asset")) {
          throw new Error(`Import Bounded Context Model ${model.id} has invalid data-asset ownership`)
        }
      }
      const expectedElements = architecture.elements.filter(
        (entry) => entry.kind !== "external-system" && entry.kind !== "deployment-target",
      )
      if (expectedElements.some((entry) => !contextByElement.has(entry.key))) {
        throw new Error(`Import Bounded Context Model ${model.id} lacks internal architecture-element coverage`)
      }
      const ownedDataAssets = new Set(model.boundedContexts.flatMap((entry) => entry.dataAssetElementKeys))
      if (architecture.elements.some((entry) => entry.kind === "data-asset" && !ownedDataAssets.has(entry.key))) {
        throw new Error(`Import Bounded Context Model ${model.id} lacks candidate data ownership`)
      }
      for (const contract of model.contracts) {
        for (const relationKey of contract.architectureRelationKeys) {
          const relation = relationByKey.get(relationKey)
          if (!relation) {
            throw new Error(`Import Bounded Context Model ${model.id} references an unknown architecture relation`)
          }
          const provider = contextByElement.get(relation.fromElementKey)
          const consumer = contextByElement.get(relation.toElementKey)
          if (provider !== contract.providerContextKey || !consumer || !contract.consumerContextKeys.includes(consumer)) {
            throw new Error(`Import Bounded Context Model ${model.id} contract direction contradicts architecture assignments`)
          }
        }
      }
      const mappedRelations = new Set(model.contracts.flatMap((entry) => entry.architectureRelationKeys))
      if (architecture.relations.some((entry) => {
        const from = contextByElement.get(entry.fromElementKey)
        const to = contextByElement.get(entry.toElementKey)
        return Boolean(from && to && from !== to && !mappedRelations.has(entry.key))
      })) {
        throw new Error(`Import Bounded Context Model ${model.id} lacks cross-context contract coverage`)
      }
    }

    const securityPrivacyAssessments = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("security-privacy-assessments/"))
      .map(([, record]) => securityPrivacyAssessmentSchema.parse(record))
    const securityPrivacyAssessmentHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("security-privacy-assessment-history/"))
      .map(([, record]) => securityPrivacyAssessmentSchema.parse(record))
    validateVersionedBusinessRecords(
      securityPrivacyAssessments,
      securityPrivacyAssessmentHistory,
      "Security, Privacy, and Threat Assessment",
    )
    const exactBoundedContextModels = new Map(
      [...boundedContextModels, ...boundedContextModelHistory].map((record) => [
        `${record.id}:${record.revision}:${canonicalDigest(record)}`,
        record,
      ]),
    )
    for (const assessment of [...securityPrivacyAssessments, ...securityPrivacyAssessmentHistory]) {
      const boundedContextModel = exactBoundedContextModels.get(
        `${assessment.boundedContextModel.recordId}:${assessment.boundedContextModel.revision}:${assessment.boundedContextModel.digest}`,
      )
      if (!boundedContextModel || boundedContextModel.initiativeId !== assessment.initiativeId) {
        throw new Error(`Import Security, Privacy, and Threat Assessment ${assessment.id} exact Bounded Context Model reference is unresolved`)
      }
      if (assessment.membershipDigest !== canonicalDigest({ boundedContextModel: assessment.boundedContextModel })) {
        throw new Error(`Import Security, Privacy, and Threat Assessment ${assessment.id} membership digest is invalid`)
      }
      const architecture = exactSystemSolutionArchitectures.get(
        `${boundedContextModel.systemSolutionArchitecture.recordId}:${boundedContextModel.systemSolutionArchitecture.revision}:${boundedContextModel.systemSolutionArchitecture.digest}`,
      )
      if (!architecture) {
        throw new Error(`Import Security, Privacy, and Threat Assessment ${assessment.id} architecture is unresolved`)
      }
      const baseline = exactBusinessArchitectureBaselines.get(
        `${architecture.businessArchitectureBaseline.recordId}:${architecture.businessArchitectureBaseline.revision}:${architecture.businessArchitectureBaseline.digest}`,
      )
      if (!baseline) {
        throw new Error(`Import Security, Privacy, and Threat Assessment ${assessment.id} architecture baseline is unresolved`)
      }
      const operatingModel = resolveOperatingModel(baseline.operatingModel, assessment.initiativeId)
      const roleKeys = new Set(operatingModel.roles.map((entry) => entry.key))
      const referencedRoleKeys = [
        assessment.governance.securityAuthorityRoleKey,
        assessment.governance.privacyAuthorityRoleKey,
        ...assessment.governance.riskOwnerRoleKeys,
        ...assessment.governance.reviewerRoleKeys,
        ...assessment.assets.map((entry) => entry.ownerRoleKey),
        ...assessment.dataClasses.map((entry) => entry.ownerRoleKey),
        ...assessment.controls.map((entry) => entry.ownerRoleKey),
        ...assessment.threats.map((entry) => entry.ownerRoleKey),
      ]
      if (referencedRoleKeys.some((key) => !roleKeys.has(key))) {
        throw new Error(`Import Security, Privacy, and Threat Assessment ${assessment.id} references an unknown bound Operating Model role`)
      }
      const elementKeys = new Set(architecture.elements.map((entry) => entry.key))
      const relationKeys = new Set(architecture.relations.map((entry) => entry.key))
      const referencedElementKeys = [
        ...assessment.assets.flatMap((entry) => entry.architectureElementKeys),
        ...assessment.dataClasses.flatMap((entry) => entry.architectureElementKeys),
        ...assessment.controls.flatMap((entry) => entry.architectureElementKeys),
      ]
      if (referencedElementKeys.some((key) => !elementKeys.has(key))) {
        throw new Error(`Import Security, Privacy, and Threat Assessment ${assessment.id} references an unknown architecture element`)
      }
      const coveredElements = new Set(assessment.assets.flatMap((entry) => entry.architectureElementKeys))
      if (architecture.elements.some((entry) => !coveredElements.has(entry.key))) {
        throw new Error(`Import Security, Privacy, and Threat Assessment ${assessment.id} lacks security-asset coverage`)
      }
      const boundaryRelations = new Set(assessment.trustBoundaries.flatMap((entry) => entry.architectureRelationKeys))
      const flowRelations = new Set(assessment.dataFlows.flatMap((entry) => entry.architectureRelationKeys))
      if ([...boundaryRelations, ...flowRelations].some((key) => !relationKeys.has(key)) ||
          architecture.relations.some((entry) => !boundaryRelations.has(entry.key) || !flowRelations.has(entry.key))) {
        throw new Error(`Import Security, Privacy, and Threat Assessment ${assessment.id} lacks exact relation coverage`)
      }
    }

    const processModels = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("process-models/"))
      .map(([, record]) => processModelSchema.parse(record))
    const processModelHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("process-model-history/"))
      .map(([, record]) => processModelSchema.parse(record))
    validateVersionedBusinessRecords(processModels, processModelHistory, "Process Model")
    const exactSecurityPrivacyAssessments = new Map(
      [...securityPrivacyAssessments, ...securityPrivacyAssessmentHistory].map((record) => [
        `${record.id}:${record.revision}:${canonicalDigest(record)}`,
        record,
      ]),
    )
    for (const model of [...processModels, ...processModelHistory]) {
      const resolveBound = <T extends { id: string; revision: number; initiativeId: string }>(
        reference: { recordId: string; revision: number; digest: string },
        exact: Map<string, T>,
        label: string,
      ): T => {
        const record = exact.get(`${reference.recordId}:${reference.revision}:${reference.digest}`)
        if (!record || record.initiativeId !== model.initiativeId) {
          throw new Error(`Import Process Model ${model.id} exact ${label} reference is unresolved`)
        }
        return record
      }
      const valueStreamModel = resolveBound(model.valueStreamModel, exactValueStreamModels, "Value Stream Model")
      const operatingModel = resolveBound(model.operatingModel, exactOperatingModels, "Operating Model")
      const businessRuleCatalog = resolveBound(model.businessRuleCatalog, exactBusinessRuleCatalogs, "Business Rule Catalog")
      const boundedContextModel = resolveBound(model.boundedContextModel, exactBoundedContextModels, "Bounded Context Model")
      resolveBound(model.securityPrivacyAssessment, exactSecurityPrivacyAssessments, "Security, Privacy, and Threat Assessment")
      if (model.membershipDigest !== canonicalDigest({
        valueStreamModel: model.valueStreamModel,
        operatingModel: model.operatingModel,
        businessRuleCatalog: model.businessRuleCatalog,
        boundedContextModel: model.boundedContextModel,
        securityPrivacyAssessment: model.securityPrivacyAssessment,
      })) {
        throw new Error(`Import Process Model ${model.id} membership digest is invalid`)
      }
      const valueStreamKeys = new Set(valueStreamModel.valueStreams.map((entry) => entry.key))
      const roleKeys = new Set(operatingModel.roles.map((entry) => entry.key))
      const businessRuleKeys = new Set(businessRuleCatalog.rules.map((entry) => entry.key))
      const boundedContextKeys = new Set(boundedContextModel.boundedContexts.map((entry) => entry.key))
      const referencedRoleKeys = [
        model.governance.processOwnerRoleKey,
        model.governance.stateStewardRoleKey,
        model.governance.approvalCoordinatorRoleKey,
        ...model.governance.reviewerRoleKeys,
        ...model.processes.flatMap((process) => [
          process.ownerRoleKey,
          ...process.participantRoleKeys,
          ...process.transitions.flatMap((transition) => transition.actorRoleKeys),
          ...process.steps.flatMap((step) => step.roleKeys),
          ...process.approvalRequirements.flatMap((approval) => approval.approverRoleKeys),
          ...process.events.flatMap((event) => event.producerRoleKeys),
        ]),
      ]
      if (referencedRoleKeys.some((key) => !roleKeys.has(key))) {
        throw new Error(`Import Process Model ${model.id} references an unknown bound Operating Model role`)
      }
      for (const process of model.processes) {
        if (process.valueStreamKeys.some((key) => !valueStreamKeys.has(key))) {
          throw new Error(`Import Process Model ${model.id} references an unknown bound Value Stream`)
        }
        if (process.businessRuleKeys.some((key) => !businessRuleKeys.has(key))) {
          throw new Error(`Import Process Model ${model.id} references an unknown bound Business Rule`)
        }
        if (process.boundedContextKeys.some((key) => !boundedContextKeys.has(key)) ||
            process.steps.some((step) => step.boundedContextKeys.some((key) => !boundedContextKeys.has(key)))) {
          throw new Error(`Import Process Model ${model.id} references an unknown bound Bounded Context`)
        }
      }
    }

    const dataModels = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("data-models/"))
      .map(([, record]) => dataModelSchema.parse(record))
    const dataModelHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("data-model-history/"))
      .map(([, record]) => dataModelSchema.parse(record))
    validateVersionedBusinessRecords(dataModels, dataModelHistory, "Data Model")
    const exactProcessModels = new Map(
      [...processModels, ...processModelHistory].map((record) => [
        `${record.id}:${record.revision}:${canonicalDigest(record)}`,
        record,
      ]),
    )
    for (const model of [...dataModels, ...dataModelHistory]) {
      const resolveBound = <T extends { id: string; revision: number; initiativeId: string }>(
        reference: { recordId: string; revision: number; digest: string },
        exact: Map<string, T>,
        label: string,
      ): T => {
        const record = exact.get(`${reference.recordId}:${reference.revision}:${reference.digest}`)
        if (!record || record.initiativeId !== model.initiativeId) {
          throw new Error(`Import Data Model ${model.id} exact ${label} reference is unresolved`)
        }
        return record
      }
      const architecture = resolveBound(
        model.systemSolutionArchitecture,
        exactSystemSolutionArchitectures,
        "System/Solution Architecture",
      )
      const boundedContexts = resolveBound(model.boundedContextModel, exactBoundedContextModels, "Bounded Context Model")
      const operatingModel = resolveBound(model.operatingModel, exactOperatingModels, "Operating Model")
      const securityAssessment = resolveBound(
        model.securityPrivacyAssessment,
        exactSecurityPrivacyAssessments,
        "Security, Privacy, and Threat Assessment",
      )
      const processModel = resolveBound(model.processModel, exactProcessModels, "Process Model")
      if (model.membershipDigest !== canonicalDigest({
        systemSolutionArchitecture: model.systemSolutionArchitecture,
        boundedContextModel: model.boundedContextModel,
        operatingModel: model.operatingModel,
        securityPrivacyAssessment: model.securityPrivacyAssessment,
        processModel: model.processModel,
      })) {
        throw new Error(`Import Data Model ${model.id} membership digest is invalid`)
      }
      const architectureElementKeys = new Set(architecture.elements.map((entry) => entry.key))
      const boundedContextKeys = new Set(boundedContexts.boundedContexts.map((entry) => entry.key))
      const roleKeys = new Set(operatingModel.roles.map((entry) => entry.key))
      const dataClassKeys = new Set(securityAssessment.dataClasses.map((entry) => entry.key))
      const dataFlowKeys = new Set(securityAssessment.dataFlows.map((entry) => entry.key))
      const processKeys = new Set(processModel.processes.map((entry) => entry.key))
      const referencedRoleKeys = [
        ...model.governance.dataOwnerRoleKeys,
        ...model.governance.dataStewardRoleKeys,
        ...model.governance.privacyReviewerRoleKeys,
        ...model.entities.flatMap((entry) => [entry.ownerRoleKey, ...entry.stewardRoleKeys]),
      ]
      if (referencedRoleKeys.some((key) => !roleKeys.has(key))) {
        throw new Error(`Import Data Model ${model.id} references an unknown bound Operating Model role`)
      }
      for (const entity of model.entities) {
        if (!boundedContextKeys.has(entity.boundedContextKey)) {
          throw new Error(`Import Data Model ${model.id} references an unknown bound Bounded Context`)
        }
        if (entity.architectureElementKeys.some((key) => !architectureElementKeys.has(key))) {
          throw new Error(`Import Data Model ${model.id} references an unknown architecture element`)
        }
        if (entity.processKeys.some((key) => !processKeys.has(key))) {
          throw new Error(`Import Data Model ${model.id} references an unknown Process`)
        }
        if ([...entity.dataClassKeys, ...entity.attributes.flatMap((entry) => entry.dataClassKeys)]
          .some((key) => !dataClassKeys.has(key))) {
          throw new Error(`Import Data Model ${model.id} references an unknown security/privacy data class`)
        }
      }
      for (const transformation of model.transformations) {
        if (transformation.processKeys.some((key) => !processKeys.has(key)) ||
            transformation.dataFlowKeys.some((key) => !dataFlowKeys.has(key))) {
          throw new Error(`Import Data Model ${model.id} transformation trace is unresolved`)
        }
      }
    }

    const authorizationModels = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("authorization-models/"))
      .map(([, record]) => authorizationModelSchema.parse(record))
    const authorizationModelHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("authorization-model-history/"))
      .map(([, record]) => authorizationModelSchema.parse(record))
    validateVersionedBusinessRecords(authorizationModels, authorizationModelHistory, "Authorization Model")
    const exactDataModels = new Map(
      [...dataModels, ...dataModelHistory].map((record) => [
        `${record.id}:${record.revision}:${canonicalDigest(record)}`,
        record,
      ]),
    )
    for (const model of [...authorizationModels, ...authorizationModelHistory]) {
      const resolveBound = <T extends { id: string; revision: number; initiativeId: string }>(
        reference: { recordId: string; revision: number; digest: string },
        exact: Map<string, T>,
        label: string,
      ): T => {
        const record = exact.get(`${reference.recordId}:${reference.revision}:${reference.digest}`)
        if (!record || record.initiativeId !== model.initiativeId) {
          throw new Error(`Import Authorization Model ${model.id} exact ${label} reference is unresolved`)
        }
        return record
      }
      const architecture = resolveBound(
        model.systemSolutionArchitecture,
        exactSystemSolutionArchitectures,
        "System/Solution Architecture",
      )
      const boundedContexts = resolveBound(model.boundedContextModel, exactBoundedContextModels, "Bounded Context Model")
      const operatingModel = resolveBound(model.operatingModel, exactOperatingModels, "Operating Model")
      resolveBound(
        model.securityPrivacyAssessment,
        exactSecurityPrivacyAssessments,
        "Security, Privacy, and Threat Assessment",
      )
      const processModel = resolveBound(model.processModel, exactProcessModels, "Process Model")
      const dataModel = resolveBound(model.dataModel, exactDataModels, "Data Model")
      if (model.membershipDigest !== canonicalDigest({
        systemSolutionArchitecture: model.systemSolutionArchitecture,
        boundedContextModel: model.boundedContextModel,
        operatingModel: model.operatingModel,
        securityPrivacyAssessment: model.securityPrivacyAssessment,
        processModel: model.processModel,
        dataModel: model.dataModel,
      })) {
        throw new Error(`Import Authorization Model ${model.id} membership digest is invalid`)
      }
      const architectureElementKeys = new Set(architecture.elements.map((entry) => entry.key))
      const boundedContextKeys = new Set(boundedContexts.boundedContexts.map((entry) => entry.key))
      const roleKeys = new Set(operatingModel.roles.map((entry) => entry.key))
      const processKeys = new Set(processModel.processes.map((entry) => entry.key))
      const approvalRequirementKeys = new Set(processModel.processes.flatMap((process) =>
        process.approvalRequirements.map((entry) => entry.key)))
      const dataEntityKeys = new Set(dataModel.entities.map((entry) => entry.key))
      const referencedRoleKeys = [
        ...model.principals.flatMap((entry) => entry.operatingRoleKeys),
        ...model.roleAssignments.flatMap((entry) => [entry.operatingRoleKey, entry.assigningAuthorityRoleKey]),
        ...model.rules.flatMap((entry) => entry.roleKeys),
        ...model.approvalBindings.flatMap((entry) => entry.approverRoleKeys),
        ...model.governance.securityAuthorityRoleKeys,
        ...model.governance.identityAuthorityRoleKeys,
        ...model.governance.modelReviewerRoleKeys,
      ]
      if (referencedRoleKeys.some((key) => !roleKeys.has(key))) {
        throw new Error(`Import Authorization Model ${model.id} references an unknown bound Operating Model role`)
      }
      if (model.roleAssignments.some((entry) =>
        entry.scopeKeys.some((key) => !boundedContextKeys.has(key)))) {
        throw new Error(`Import Authorization Model ${model.id} references an unknown Role Assignment scope`)
      }
      for (const action of model.actions) {
        if (action.processKeys.some((key) => !processKeys.has(key)) ||
            action.approvalRequirementKeys.some((key) => !approvalRequirementKeys.has(key))) {
          throw new Error(`Import Authorization Model ${model.id} action trace is unresolved`)
        }
      }
      for (const resource of model.resources) {
        if (resource.scopeKeys.some((key) => !boundedContextKeys.has(key))) {
          throw new Error(`Import Authorization Model ${model.id} resource scope is unresolved`)
        }
        const validSubject = resource.kind === "architecture-element"
          ? architectureElementKeys.has(resource.subjectKey)
          : resource.kind === "bounded-context"
            ? boundedContextKeys.has(resource.subjectKey)
            : resource.kind === "data-entity"
              ? dataEntityKeys.has(resource.subjectKey)
              : processKeys.has(resource.subjectKey)
        if (!validSubject) throw new Error(`Import Authorization Model ${model.id} resource trace is unresolved`)
      }
      if (model.approvalBindings.some((entry) =>
        entry.processApprovalRequirementKeys.some((key) => !approvalRequirementKeys.has(key)))) {
        throw new Error(`Import Authorization Model ${model.id} approval trace is unresolved`)
      }
    }

    const eventIntegrationModels = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("event-integration-models/"))
      .map(([, record]) => eventIntegrationModelSchema.parse(record))
    const eventIntegrationModelHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("event-integration-model-history/"))
      .map(([, record]) => eventIntegrationModelSchema.parse(record))
    const exactEventIntegrationModels = validateVersionedBusinessRecords(
      eventIntegrationModels,
      eventIntegrationModelHistory,
      "Event and Integration Model",
    )
    const exactAuthorizationModels = new Map(
      [...authorizationModels, ...authorizationModelHistory].map((record) => [
        `${record.id}:${record.revision}:${canonicalDigest(record)}`,
        record,
      ]),
    )
    for (const model of [...eventIntegrationModels, ...eventIntegrationModelHistory]) {
      const resolveBound = <T extends { id: string; revision: number; initiativeId: string }>(
        reference: { recordId: string; revision: number; digest: string },
        exact: Map<string, T>,
        label: string,
      ): T => {
        const record = exact.get(`${reference.recordId}:${reference.revision}:${reference.digest}`)
        if (!record || record.initiativeId !== model.initiativeId) {
          throw new Error(`Import Event and Integration Model ${model.id} exact ${label} reference is unresolved`)
        }
        return record
      }
      const architecture = resolveBound(
        model.systemSolutionArchitecture,
        exactSystemSolutionArchitectures,
        "System/Solution Architecture",
      )
      const boundedContexts = resolveBound(model.boundedContextModel, exactBoundedContextModels, "Bounded Context Model")
      const operatingModel = resolveBound(model.operatingModel, exactOperatingModels, "Operating Model")
      resolveBound(
        model.securityPrivacyAssessment,
        exactSecurityPrivacyAssessments,
        "Security, Privacy, and Threat Assessment",
      )
      const processModel = resolveBound(model.processModel, exactProcessModels, "Process Model")
      const dataModel = resolveBound(model.dataModel, exactDataModels, "Data Model")
      const authorizationModel = resolveBound(
        model.authorizationModel,
        exactAuthorizationModels,
        "Authorization Model",
      )
      if (model.membershipDigest !== canonicalDigest({
        systemSolutionArchitecture: model.systemSolutionArchitecture,
        boundedContextModel: model.boundedContextModel,
        operatingModel: model.operatingModel,
        securityPrivacyAssessment: model.securityPrivacyAssessment,
        processModel: model.processModel,
        dataModel: model.dataModel,
        authorizationModel: model.authorizationModel,
      })) {
        throw new Error(`Import Event and Integration Model ${model.id} membership digest is invalid`)
      }
      const architectureElementKeys = new Set(architecture.elements.map((entry) => entry.key))
      const boundedContextKeys = new Set(boundedContexts.boundedContexts.map((entry) => entry.key))
      const roleKeys = new Set(operatingModel.roles.map((entry) => entry.key))
      const processKeys = new Set(processModel.processes.map((entry) => entry.key))
      const processEventKeys = new Set(processModel.processes.flatMap((entry) => entry.events.map((event) => event.key)))
      const dataEntityKeys = new Set(dataModel.entities.map((entry) => entry.key))
      const authorizationActionKeys = new Set(authorizationModel.actions.map((entry) => entry.key))
      const authorizationRuleKeys = new Set(authorizationModel.rules.map((entry) => entry.key))
      const eventKeys = new Set(model.eventTypes.map((entry) => entry.key))
      const commandKeys = new Set(model.commands.map((entry) => entry.key))
      const referencedRoleKeys = [
        ...model.eventTypes.flatMap((entry) => entry.producerRoleKeys),
        ...model.commands.flatMap((entry) => entry.actorRoleKeys),
        ...model.mappings.map((entry) => entry.reconciliationOwnerRoleKey),
        ...model.governance.integrationStewardRoleKeys,
        ...model.governance.eventStewardRoleKeys,
        ...model.governance.contractReviewerRoleKeys,
      ]
      if (referencedRoleKeys.some((key) => !roleKeys.has(key))) {
        throw new Error(`Import Event and Integration Model ${model.id} references an unknown bound Operating Model role`)
      }
      for (const eventType of model.eventTypes) {
        if (eventType.processEventKeys.some((key) => !processEventKeys.has(key)) ||
            !boundedContextKeys.has(eventType.producerBoundedContextKey) ||
            eventType.payloadDataEntityKeys.some((key) => !dataEntityKeys.has(key))) {
          throw new Error(`Import Event and Integration Model ${model.id} Event Type trace is unresolved`)
        }
        const validSubjects = eventType.subjectKind === "architecture-element"
          ? architectureElementKeys
          : eventType.subjectKind === "bounded-context"
            ? boundedContextKeys
            : eventType.subjectKind === "data-entity"
              ? dataEntityKeys
              : processKeys
        if (eventType.subjectKeys.some((key) => !validSubjects.has(key))) {
          throw new Error(`Import Event and Integration Model ${model.id} Event Type subject is unresolved`)
        }
      }
      for (const command of model.commands) {
        if (command.processKeys.some((key) => !processKeys.has(key)) ||
            command.targetBoundedContextKeys.some((key) => !boundedContextKeys.has(key)) ||
            [...command.inputDataEntityKeys, ...command.outputDataEntityKeys]
              .some((key) => !dataEntityKeys.has(key)) ||
            command.authorizationActionKeys.some((key) => !authorizationActionKeys.has(key)) ||
            command.authorizationRuleKeys.some((key) => !authorizationRuleKeys.has(key))) {
          throw new Error(`Import Event and Integration Model ${model.id} Command trace is unresolved`)
        }
      }
      const referencedContexts = [
        ...model.adapters.flatMap((entry) => entry.boundedContextKeys),
        ...model.externalContracts.flatMap((entry) => [
          ...entry.producerBoundedContextKeys, ...entry.consumerBoundedContextKeys,
        ]),
        ...model.routes.flatMap((entry) => [
          ...entry.producerBoundedContextKeys, ...entry.consumerBoundedContextKeys,
        ]),
      ]
      if (referencedContexts.some((key) => !boundedContextKeys.has(key))) {
        throw new Error(`Import Event and Integration Model ${model.id} Bounded Context trace is unresolved`)
      }
      const validMappingSubjects = new Set([
        ...eventKeys, ...commandKeys, ...architectureElementKeys, ...boundedContextKeys,
        ...processKeys, ...dataEntityKeys, ...authorizationActionKeys,
      ])
      if (model.mappings.some((mapping) =>
        mapping.rows.some((row) => !validMappingSubjects.has(row.gaepSubjectKey)))) {
        throw new Error(`Import Event and Integration Model ${model.id} mapping subject is unresolved`)
      }
    }

    const failureRecoveryModels = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("failure-recovery-models/"))
      .map(([, record]) => failureRecoveryModelSchema.parse(record))
    const failureRecoveryModelHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("failure-recovery-model-history/"))
      .map(([, record]) => failureRecoveryModelSchema.parse(record))
    const exactFailureRecoveryModels = validateVersionedBusinessRecords(
      failureRecoveryModels,
      failureRecoveryModelHistory,
      "Failure and Recovery Model",
    )
    for (const model of [...failureRecoveryModels, ...failureRecoveryModelHistory]) {
      const resolveBound = <T extends { id: string; revision: number; initiativeId: string }>(
        reference: { recordId: string; revision: number; digest: string },
        exact: Map<string, T>,
        label: string,
      ): T => {
        const record = exact.get(`${reference.recordId}:${reference.revision}:${reference.digest}`)
        if (!record || record.initiativeId !== model.initiativeId) {
          throw new Error(`Import Failure and Recovery Model ${model.id} exact ${label} reference is unresolved`)
        }
        return record
      }
      resolveBound(model.systemSolutionArchitecture, exactSystemSolutionArchitectures, "System/Solution Architecture")
      resolveBound(model.boundedContextModel, exactBoundedContextModels, "Bounded Context Model")
      const operatingModel = resolveBound(model.operatingModel, exactOperatingModels, "Operating Model")
      resolveBound(
        model.securityPrivacyAssessment,
        exactSecurityPrivacyAssessments,
        "Security, Privacy, and Threat Assessment",
      )
      const processModel = resolveBound(model.processModel, exactProcessModels, "Process Model")
      const dataModel = resolveBound(model.dataModel, exactDataModels, "Data Model")
      const authorizationModel = resolveBound(model.authorizationModel, exactAuthorizationModels, "Authorization Model")
      const eventIntegrationModel = resolveBound(
        model.eventIntegrationModel,
        exactEventIntegrationModels,
        "Event and Integration Model",
      )
      if (model.membershipDigest !== canonicalDigest({
        systemSolutionArchitecture: model.systemSolutionArchitecture,
        boundedContextModel: model.boundedContextModel,
        operatingModel: model.operatingModel,
        securityPrivacyAssessment: model.securityPrivacyAssessment,
        processModel: model.processModel,
        dataModel: model.dataModel,
        authorizationModel: model.authorizationModel,
        eventIntegrationModel: model.eventIntegrationModel,
      })) {
        throw new Error(`Import Failure and Recovery Model ${model.id} membership digest is invalid`)
      }
      const roleKeys = new Set(operatingModel.roles.map((entry) => entry.key))
      const processKeys = new Set(processModel.processes.map((entry) => entry.key))
      const dataEntityKeys = new Set(dataModel.entities.map((entry) => entry.key))
      const authorizationActionKeys = new Set(authorizationModel.actions.map((entry) => entry.key))
      const eventKeys = new Set(eventIntegrationModel.eventTypes.map((entry) => entry.key))
      const commandKeys = new Set(eventIntegrationModel.commands.map((entry) => entry.key))
      const adapterKeys = new Set(eventIntegrationModel.adapters.map((entry) => entry.key))
      const routeKeys = new Set(eventIntegrationModel.routes.map((entry) => entry.key))
      for (const failure of model.failureModes) {
        if (failure.affectedProcessKeys.some((key) => !processKeys.has(key)) ||
            failure.affectedEventTypeKeys.some((key) => !eventKeys.has(key)) ||
            failure.affectedCommandKeys.some((key) => !commandKeys.has(key)) ||
            failure.affectedAdapterKeys.some((key) => !adapterKeys.has(key)) ||
            failure.affectedRouteKeys.some((key) => !routeKeys.has(key)) ||
            failure.affectedDataEntityKeys.some((key) => !dataEntityKeys.has(key))) {
          throw new Error(`Import Failure and Recovery Model ${model.id} Failure Mode trace is unresolved`)
        }
      }
      for (const retry of model.retryPolicies) {
        if (retry.commandKeys.some((key) => !commandKeys.has(key)) ||
            retry.adapterKeys.some((key) => !adapterKeys.has(key)) ||
            retry.authorizationActionKeys.some((key) => !authorizationActionKeys.has(key))) {
          throw new Error(`Import Failure and Recovery Model ${model.id} Retry Policy trace is unresolved`)
        }
      }
      for (const compensation of model.compensationPlans) {
        if ([...compensation.originalCommandKeys, ...compensation.compensationCommandKeys]
          .some((key) => !commandKeys.has(key)) ||
            compensation.authorizationActionKeys.some((key) => !authorizationActionKeys.has(key)) ||
            compensation.affectedDataEntityKeys.some((key) => !dataEntityKeys.has(key))) {
          throw new Error(`Import Failure and Recovery Model ${model.id} Compensation Plan trace is unresolved`)
        }
      }
      for (const recovery of model.recoveryPlans) {
        if (recovery.processKeys.some((key) => !processKeys.has(key)) ||
            recovery.routeKeys.some((key) => !routeKeys.has(key)) ||
            recovery.ownerRoleKeys.some((key) => !roleKeys.has(key)) ||
            recovery.authorizationActionKeys.some((key) => !authorizationActionKeys.has(key))) {
          throw new Error(`Import Failure and Recovery Model ${model.id} Recovery Plan trace is unresolved`)
        }
      }
      const governanceRoles = [
        ...model.governance.failureModelStewardRoleKeys,
        ...model.governance.recoveryOwnerRoleKeys,
        ...model.governance.recoveryVerifierRoleKeys,
      ]
      if (governanceRoles.some((key) => !roleKeys.has(key))) {
        throw new Error(`Import Failure and Recovery Model ${model.id} governance role trace is unresolved`)
      }
    }

    const architectureChallengeModels = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("architecture-challenge-models/"))
      .map(([, record]) => architectureChallengeModelSchema.parse(record))
    const architectureChallengeModelHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("architecture-challenge-model-history/"))
      .map(([, record]) => architectureChallengeModelSchema.parse(record))
    const exactArchitectureChallengeModels = validateVersionedBusinessRecords(
      architectureChallengeModels,
      architectureChallengeModelHistory,
      "Architecture Challenge",
    )
    for (const model of [...architectureChallengeModels, ...architectureChallengeModelHistory]) {
      const resolveBound = <T extends { id: string; revision: number; initiativeId: string }>(
        reference: { recordId: string; revision: number; digest: string },
        exact: Map<string, T>,
        label: string,
      ): T => {
        const record = exact.get(`${reference.recordId}:${reference.revision}:${reference.digest}`)
        if (!record || record.initiativeId !== model.initiativeId) {
          throw new Error(`Import Architecture Challenge ${model.id} exact ${label} reference is unresolved`)
        }
        return record
      }
      const architecture = resolveBound(
        model.systemSolutionArchitecture,
        exactSystemSolutionArchitectures,
        "System/Solution Architecture",
      )
      const boundedContextModel = resolveBound(
        model.boundedContextModel,
        exactBoundedContextModels,
        "Bounded Context Model",
      )
      const operatingModel = resolveBound(model.operatingModel, exactOperatingModels, "Operating Model")
      resolveBound(
        model.securityPrivacyAssessment,
        exactSecurityPrivacyAssessments,
        "Security, Privacy, and Threat Assessment",
      )
      resolveBound(model.processModel, exactProcessModels, "Process Model")
      resolveBound(model.dataModel, exactDataModels, "Data Model")
      resolveBound(model.authorizationModel, exactAuthorizationModels, "Authorization Model")
      resolveBound(model.eventIntegrationModel, exactEventIntegrationModels, "Event and Integration Model")
      const failureRecoveryModel = resolveBound(
        model.failureRecoveryModel,
        exactFailureRecoveryModels,
        "Failure and Recovery Model",
      )
      if (model.membershipDigest !== canonicalDigest({
        systemSolutionArchitecture: model.systemSolutionArchitecture,
        boundedContextModel: model.boundedContextModel,
        operatingModel: model.operatingModel,
        securityPrivacyAssessment: model.securityPrivacyAssessment,
        processModel: model.processModel,
        dataModel: model.dataModel,
        authorizationModel: model.authorizationModel,
        eventIntegrationModel: model.eventIntegrationModel,
        failureRecoveryModel: model.failureRecoveryModel,
      })) {
        throw new Error(`Import Architecture Challenge ${model.id} membership digest is invalid`)
      }
      const concernKeys = new Set(architecture.concerns.map((entry) => entry.key))
      const decisionKeys = new Set(architecture.decisions.map((entry) => entry.key))
      const elementKeys = new Set(architecture.elements.map((entry) => entry.key))
      const viewKeys = new Set(architecture.views.map((entry) => entry.key))
      const qualityKeys = new Set(architecture.qualityAttributes.map((entry) => entry.key))
      const boundedContextKeys = new Set(boundedContextModel.boundedContexts.map((entry) => entry.key))
      const failureModeKeys = new Set(failureRecoveryModel.failureModes.map((entry) => entry.key))
      for (const subject of model.challengeSubjects) {
        if (subject.architectureConcernKeys.some((key) => !concernKeys.has(key)) ||
            subject.architectureDecisionKeys.some((key) => !decisionKeys.has(key)) ||
            subject.architectureElementKeys.some((key) => !elementKeys.has(key)) ||
            subject.architectureViewKeys.some((key) => !viewKeys.has(key)) ||
            subject.qualityScenarioKeys.some((key) => !qualityKeys.has(key)) ||
            subject.boundedContextKeys.some((key) => !boundedContextKeys.has(key)) ||
            subject.failureModeKeys.some((key) => !failureModeKeys.has(key))) {
          throw new Error(`Import Architecture Challenge ${model.id} Challenge Subject trace is unresolved`)
        }
      }
      for (const alternative of model.alternatives) {
        if (alternative.architectureElementKeys.some((key) => !elementKeys.has(key)) ||
            alternative.boundedContextKeys.some((key) => !boundedContextKeys.has(key)) ||
            alternative.failureModeKeys.some((key) => !failureModeKeys.has(key))) {
          throw new Error(`Import Architecture Challenge ${model.id} Alternative trace is unresolved`)
        }
      }
      const roleKeys = new Set(operatingModel.roles.map((entry) => entry.key))
      const governedRoles = [
        ...model.findings.flatMap((entry) => entry.challengerRoleKeys),
        ...model.responses.flatMap((entry) => entry.responderRoleKeys),
        ...model.independence.authorRoleKeys,
        ...model.independence.challengerRoleKeys,
        ...model.independence.reviewerRoleKeys,
        ...model.governance.challengeOwnerRoleKeys,
        ...model.governance.challengerRoleKeys,
        ...model.governance.responseOwnerRoleKeys,
      ]
      if (governedRoles.some((key) => !roleKeys.has(key))) {
        throw new Error(`Import Architecture Challenge ${model.id} role trace is unresolved`)
      }
    }

    const decisionRegisters = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("decision-registers/"))
      .map(([, record]) => decisionRegisterSchema.parse(record))
    const decisionRegisterHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("decision-register-history/"))
      .map(([, record]) => decisionRegisterSchema.parse(record))
    validateVersionedBusinessRecords(decisionRegisters, decisionRegisterHistory, "Decision Register")
    const decisionSubjectPathKinds: Array<[RegExp, DecisionRegister["decisions"][number]["subjects"][number]["recordKind"]]> = [
      [/^architecture-challenge-model(?:s|\-history)\//, "architecture-challenge-model"],
      [/^architecture(?:\/|\-history\/)/, "architecture-record"],
      [/^authorization-model(?:s|\-history)\//, "authorization-model"],
      [/^bounded-context-model(?:s|\-history)\//, "bounded-context-model"],
      [/^business-architecture-baseline(?:s|\-history)\//, "business-architecture-baseline"],
      [/^business-capability-map(?:s|\-history)\//, "business-capability-map"],
      [/^business-rule-catalog(?:s|\-history)\//, "business-rule-catalog"],
      [/^business-understanding(?:\/|\-history\/)/, "business-understanding"],
      [/^changes\//, "change"],
      [/^data-model(?:s|\-history)\//, "data-model"],
      [/^decisions\//, "decision-record"],
      [/^evidence\//, "evidence-record"],
      [/^event-integration-model(?:s|\-history)\//, "event-integration-model"],
      [/^failure-recovery-model(?:s|\-history)\//, "failure-recovery-model"],
      [/^initiatives\//, "initiative"],
      [/^operating-model(?:s|\-history)\//, "operating-model"],
      [/^outcome-model(?:s|\-history)\//, "outcome-model"],
      [/^process-model(?:s|\-history)\//, "process-model"],
      [/^design-revisions\//, "product-design-revision"],
      [/^requirements\//, "requirement"],
      [/^risks\//, "risk-record"],
      [/^security-privacy-assessment(?:s|\-history)\//, "security-privacy-assessment"],
      [/^sources\//, "source-record"],
      [/^stakeholder-model(?:s|\-history)\//, "stakeholder-model"],
      [/^system-solution-architecture(?:s|\-history)\//, "system-solution-architecture"],
      [/^value-stream-model(?:s|\-history)\//, "value-stream-model"],
      [/^work-items\//, "work-item"],
    ]
    const exactDecisionSubjects = new Map<string, { id: string; revision: number; productId?: string; initiativeId?: string }>()
    const addDecisionSubject = (
      kind: DecisionRegister["decisions"][number]["subjects"][number]["recordKind"],
      record: unknown,
    ) => {
      const candidate = record as { id?: string; revision?: number; productId?: string; initiativeId?: string }
      if (!candidate.id || !candidate.revision) return
      exactDecisionSubjects.set(
        `${kind}:${candidate.id}:${candidate.revision}:${canonicalDigest(record)}`,
        candidate as { id: string; revision: number; productId?: string; initiativeId?: string },
      )
    }
    addDecisionSubject("product", product)
    for (const [path, record] of recordsByPath) {
      const mapping = decisionSubjectPathKinds.find(([pattern]) => pattern.test(path))
      if (mapping) addDecisionSubject(mapping[1], record)
    }
    for (const history of productHistory) addDecisionSubject("product", history.product)
    for (const history of sourceHistory) addDecisionSubject("source-record", history.snapshot)
    for (const history of histories) {
      const kindByHistoryType: Partial<Record<ProductRecordRevision["recordType"], DecisionRegister["decisions"][number]["subjects"][number]["recordKind"]>> = {
        change: "change",
        "work-item": "work-item",
        requirement: "requirement",
        decision: "decision-record",
        risk: "risk-record",
        "architecture-record": "architecture-record",
        evidence: "evidence-record",
      }
      const kind = kindByHistoryType[history.recordType]
      if (kind) addDecisionSubject(kind, history.snapshot)
    }
    for (const register of [...decisionRegisters, ...decisionRegisterHistory]) {
      const operatingModel = exactOperatingModels.get(
        `${register.operatingModel.recordId}:${register.operatingModel.revision}:${register.operatingModel.digest}`,
      )
      const architectureChallengeModel = exactArchitectureChallengeModels.get(
        `${register.architectureChallengeModel.recordId}:${register.architectureChallengeModel.revision}:${register.architectureChallengeModel.digest}`,
      )
      if (!operatingModel || operatingModel.initiativeId !== register.initiativeId) {
        throw new Error(`Import Decision Register ${register.id} exact Operating Model reference is unresolved`)
      }
      if (!architectureChallengeModel || architectureChallengeModel.initiativeId !== register.initiativeId) {
        throw new Error(`Import Decision Register ${register.id} exact Architecture Challenge reference is unresolved`)
      }
      const expectedMembership = {
        operatingModel: register.operatingModel,
        architectureChallengeModel: register.architectureChallengeModel,
        decisions: register.decisions.map((decision) => {
          const sourceReferences = new Map(collectBusinessSourceReferences(decision).map((reference) => [
            `${reference.sourceId}:${reference.sourceRevision}:${reference.recordDigest}:${reference.contentDigest}`,
            reference,
          ]))
          return {
            key: decision.key,
            subjects: decision.subjects,
            relationships: decision.relationships,
            sourceReferences: [...sourceReferences.values()].sort((left, right) =>
              left.sourceId.localeCompare(right.sourceId) || left.sourceRevision - right.sourceRevision),
          }
        }),
      }
      if (register.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Decision Register ${register.id} membership digest is invalid`)
      }
      const roleKeys = new Set(operatingModel.roles.map((entry) => entry.key))
      const rightByKey = new Map(operatingModel.decisionRights.map((entry) => [entry.key, entry]))
      for (const decision of register.decisions) {
        if ([decision.ownerRoleKey, ...decision.decisionAuthorityRoleKeys].some((key) => !roleKeys.has(key))) {
          throw new Error(`Import Decision Register ${register.id} role trace is unresolved`)
        }
        const rights = decision.decisionRightKeys.map((key) => rightByKey.get(key))
        if (rights.some((right) => !right) || rights.some((right) =>
          right && !decision.decisionAuthorityRoleKeys.includes(right.accountableRoleKey))) {
          throw new Error(`Import Decision Register ${register.id} decision-right trace is unresolved`)
        }
        for (const subject of [...decision.subjects, ...decision.relationships]) {
          const resolved = exactDecisionSubjects.get(
            `${subject.recordKind}:${subject.recordId}:${subject.revision}:${subject.digest}`,
          )
          if (!resolved || (resolved.productId !== undefined && resolved.productId !== register.productId) ||
              (resolved.initiativeId !== undefined && resolved.initiativeId !== register.initiativeId)) {
            throw new Error(`Import Decision Register ${register.id} exact governed subject reference is unresolved`)
          }
        }
      }
    }

    const riskRegisters = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("risk-registers/"))
      .map(([, record]) => riskRegisterSchema.parse(record))
    const riskRegisterHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("risk-register-history/"))
      .map(([, record]) => riskRegisterSchema.parse(record))
    validateVersionedBusinessRecords(riskRegisters, riskRegisterHistory, "Risk Register")
    const exactDecisionRegisters = new Map(
      [...decisionRegisters, ...decisionRegisterHistory].map((record) => [
        `${record.id}:${record.revision}:${canonicalDigest(record)}`,
        record,
      ]),
    )
    for (const register of [...riskRegisters, ...riskRegisterHistory]) {
      const operatingModel = exactOperatingModels.get(
        `${register.operatingModel.recordId}:${register.operatingModel.revision}:${register.operatingModel.digest}`,
      )
      const architectureChallengeModel = exactArchitectureChallengeModels.get(
        `${register.architectureChallengeModel.recordId}:${register.architectureChallengeModel.revision}:${register.architectureChallengeModel.digest}`,
      )
      const securityPrivacyAssessment = exactSecurityPrivacyAssessments.get(
        `${register.securityPrivacyAssessment.recordId}:${register.securityPrivacyAssessment.revision}:${register.securityPrivacyAssessment.digest}`,
      )
      const decisionRegister = exactDecisionRegisters.get(
        `${register.decisionRegister.recordId}:${register.decisionRegister.revision}:${register.decisionRegister.digest}`,
      )
      if (!operatingModel || operatingModel.initiativeId !== register.initiativeId) {
        throw new Error(`Import Risk Register ${register.id} exact Operating Model reference is unresolved`)
      }
      if (!architectureChallengeModel || architectureChallengeModel.initiativeId !== register.initiativeId) {
        throw new Error(`Import Risk Register ${register.id} exact Architecture Challenge reference is unresolved`)
      }
      if (!securityPrivacyAssessment || securityPrivacyAssessment.initiativeId !== register.initiativeId) {
        throw new Error(`Import Risk Register ${register.id} exact Security, Privacy, and Threat Assessment reference is unresolved`)
      }
      if (!decisionRegister || decisionRegister.initiativeId !== register.initiativeId) {
        throw new Error(`Import Risk Register ${register.id} exact Decision Register reference is unresolved`)
      }
      const expectedMembership = {
        operatingModel: register.operatingModel,
        architectureChallengeModel: register.architectureChallengeModel,
        securityPrivacyAssessment: register.securityPrivacyAssessment,
        decisionRegister: register.decisionRegister,
        risks: register.risks.map((risk) => {
          const sourceReferences = new Map(collectBusinessSourceReferences(risk).map((reference) => [
            `${reference.sourceId}:${reference.sourceRevision}:${reference.recordDigest}:${reference.contentDigest}`,
            reference,
          ]))
          return {
            key: risk.key,
            controlKeys: risk.controls.map((control) => control.key),
            relatedRecords: risk.relatedRecords,
            sourceReferences: [...sourceReferences.values()].sort((left, right) =>
              left.sourceId.localeCompare(right.sourceId) || left.sourceRevision - right.sourceRevision),
          }
        }),
      }
      if (register.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Risk Register ${register.id} membership digest is invalid`)
      }
      const roleKeys = new Set(operatingModel.roles.map((entry) => entry.key))
      for (const risk of register.risks) {
        const governedRoles = [risk.ownerRoleKey, risk.treatment.ownerRoleKey,
          ...risk.controls.map((control) => control.ownerRoleKey)]
        if (governedRoles.some((key) => !roleKeys.has(key))) {
          throw new Error(`Import Risk Register ${register.id} role trace is unresolved`)
        }
        for (const related of risk.relatedRecords) {
          const resolved = exactDecisionSubjects.get(
            `${related.recordKind}:${related.recordId}:${related.revision}:${related.digest}`,
          )
          if (!resolved || (resolved.productId !== undefined && resolved.productId !== register.productId) ||
              (resolved.initiativeId !== undefined && resolved.initiativeId !== register.initiativeId)) {
            throw new Error(`Import Risk Register ${register.id} exact governed related-record reference is unresolved`)
          }
        }
      }
    }

    const evidenceRegistries = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("evidence-registries/"))
      .map(([, record]) => evidenceRegistrySchema.parse(record))
    const evidenceRegistryHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("evidence-registry-history/"))
      .map(([, record]) => evidenceRegistrySchema.parse(record))
    const exactEvidenceRegistries = validateVersionedBusinessRecords(
      evidenceRegistries,
      evidenceRegistryHistory,
      "Evidence Registry",
    )
    const exactRiskRegisters = new Map(
      [...riskRegisters, ...riskRegisterHistory].map((record) => [
        `${record.id}:${record.revision}:${canonicalDigest(record)}`,
        record,
      ]),
    )
    for (const registry of [...evidenceRegistries, ...evidenceRegistryHistory]) {
      const operatingModel = exactOperatingModels.get(
        `${registry.operatingModel.recordId}:${registry.operatingModel.revision}:${registry.operatingModel.digest}`,
      )
      const architectureChallengeModel = exactArchitectureChallengeModels.get(
        `${registry.architectureChallengeModel.recordId}:${registry.architectureChallengeModel.revision}:${registry.architectureChallengeModel.digest}`,
      )
      const securityPrivacyAssessment = exactSecurityPrivacyAssessments.get(
        `${registry.securityPrivacyAssessment.recordId}:${registry.securityPrivacyAssessment.revision}:${registry.securityPrivacyAssessment.digest}`,
      )
      const decisionRegister = exactDecisionRegisters.get(
        `${registry.decisionRegister.recordId}:${registry.decisionRegister.revision}:${registry.decisionRegister.digest}`,
      )
      const riskRegister = exactRiskRegisters.get(
        `${registry.riskRegister.recordId}:${registry.riskRegister.revision}:${registry.riskRegister.digest}`,
      )
      if (!operatingModel || operatingModel.initiativeId !== registry.initiativeId) {
        throw new Error(`Import Evidence Registry ${registry.id} exact Operating Model reference is unresolved`)
      }
      if (!architectureChallengeModel || architectureChallengeModel.initiativeId !== registry.initiativeId) {
        throw new Error(`Import Evidence Registry ${registry.id} exact Architecture Challenge reference is unresolved`)
      }
      if (!securityPrivacyAssessment || securityPrivacyAssessment.initiativeId !== registry.initiativeId) {
        throw new Error(`Import Evidence Registry ${registry.id} exact Security, Privacy, and Threat Assessment reference is unresolved`)
      }
      if (!decisionRegister || decisionRegister.initiativeId !== registry.initiativeId) {
        throw new Error(`Import Evidence Registry ${registry.id} exact Decision Register reference is unresolved`)
      }
      if (!riskRegister || riskRegister.initiativeId !== registry.initiativeId) {
        throw new Error(`Import Evidence Registry ${registry.id} exact Risk Register reference is unresolved`)
      }
      const expectedMembership = {
        operatingModel: registry.operatingModel,
        architectureChallengeModel: registry.architectureChallengeModel,
        securityPrivacyAssessment: registry.securityPrivacyAssessment,
        decisionRegister: registry.decisionRegister,
        riskRegister: registry.riskRegister,
        claims: registry.claims.map((claim) => ({ key: claim.key, subjects: claim.subjects })),
        evidenceItems: registry.evidenceItems.map((evidence) => {
          const sourceReferences = new Map(collectBusinessSourceReferences(evidence).map((reference) => [
            `${reference.sourceId}:${reference.sourceRevision}:${reference.recordDigest}:${reference.contentDigest}`,
            reference,
          ]))
          return {
            key: evidence.key,
            evidenceId: evidence.evidenceId,
            evidenceRevision: evidence.evidenceRevision,
            evidenceDigest: evidence.evidenceDigest,
            claimKeys: evidence.claimKeys,
            subjects: evidence.subjects,
            sourceReferences: [...sourceReferences.values()].sort((left, right) =>
              left.sourceId.localeCompare(right.sourceId) || left.sourceRevision - right.sourceRevision),
          }
        }),
        links: registry.links.map((link) => ({
          key: link.key,
          claimKey: link.claimKey,
          evidenceKey: link.evidenceKey,
          relationship: link.relationship,
        })),
      }
      if (registry.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Evidence Registry ${registry.id} membership digest is invalid`)
      }
      const roleKeys = new Set(operatingModel.roles.map((entry) => entry.key))
      if (registry.claims.some((claim) => !roleKeys.has(claim.ownerRoleKey))) {
        throw new Error(`Import Evidence Registry ${registry.id} role trace is unresolved`)
      }
      const riskKeys = new Set(riskRegister.risks.map((risk) => risk.key))
      if (registry.claims.flatMap((claim) => claim.relatedRiskKeys).some((key) => !riskKeys.has(key))) {
        throw new Error(`Import Evidence Registry ${registry.id} Risk trace is unresolved`)
      }
      for (const subject of [
        ...registry.claims.flatMap((claim) => claim.subjects),
        ...registry.evidenceItems.flatMap((evidence) => evidence.subjects),
      ]) {
        const resolved = exactDecisionSubjects.get(
          `${subject.recordKind}:${subject.recordId}:${subject.revision}:${subject.digest}`,
        )
        if (!resolved || (resolved.productId !== undefined && resolved.productId !== registry.productId) ||
            (resolved.initiativeId !== undefined && resolved.initiativeId !== registry.initiativeId)) {
          throw new Error(`Import Evidence Registry ${registry.id} exact governed subject reference is unresolved`)
        }
      }
    }

    const endToEndTraceability = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("end-to-end-traceability/"))
      .map(([, record]) => endToEndTraceabilitySchema.parse(record))
    const endToEndTraceabilityHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("end-to-end-traceability-history/"))
      .map(([, record]) => endToEndTraceabilitySchema.parse(record))
    const exactEndToEndTraceability = validateVersionedBusinessRecords(
      endToEndTraceability,
      endToEndTraceabilityHistory,
      "End-to-End Traceability",
    )
    const exactTraceabilitySubjects = new Map(exactDecisionSubjects)
    const addTraceabilitySubject = (kind: TraceabilitySubjectKind, record: unknown): void => {
      const candidate = record as { id?: string; revision?: number; productId?: string; initiativeId?: string }
      if (!candidate.id || !candidate.revision) return
      exactTraceabilitySubjects.set(
        `${kind}:${candidate.id}:${candidate.revision}:${canonicalDigest(record)}`,
        candidate as { id: string; revision: number; productId?: string; initiativeId?: string },
      )
    }
    for (const record of [...decisionRegisters, ...decisionRegisterHistory]) {
      addTraceabilitySubject("decision-register", record)
    }
    for (const record of [...riskRegisters, ...riskRegisterHistory]) {
      addTraceabilitySubject("risk-register", record)
    }
    for (const record of [...evidenceRegistries, ...evidenceRegistryHistory]) {
      addTraceabilitySubject("evidence-registry", record)
    }
    for (const traceability of [...endToEndTraceability, ...endToEndTraceabilityHistory]) {
      const evidenceRegistry = exactEvidenceRegistries.get(
        `${traceability.evidenceRegistry.recordId}:${traceability.evidenceRegistry.revision}:${traceability.evidenceRegistry.digest}`,
      )
      if (!evidenceRegistry || evidenceRegistry.initiativeId !== traceability.initiativeId) {
        throw new Error(`Import End-to-End Traceability ${traceability.id} exact Evidence Registry reference is unresolved`)
      }
      for (const node of traceability.nodes) {
        const resolved = exactTraceabilitySubjects.get(
          `${node.subject.recordKind}:${node.subject.recordId}:${node.subject.revision}:${node.subject.digest}`,
        )
        if (!resolved || (resolved.productId !== undefined && resolved.productId !== traceability.productId) ||
            (resolved.initiativeId !== undefined && resolved.initiativeId !== traceability.initiativeId)) {
          throw new Error(`Import End-to-End Traceability ${traceability.id} exact governed node reference is unresolved`)
        }
      }
      const expectedMembership = {
        evidenceRegistry: traceability.evidenceRegistry,
        nodes: traceability.nodes.map((node) => ({
          key: node.key,
          subject: node.subject,
          lifecycle: node.lifecycle,
        })),
        relationships: traceability.relationships.map((relationship) => ({
          key: relationship.key,
          namespace: relationship.namespace,
          registryRevision: relationship.registryRevision,
          definitionDigest: relationship.definitionDigest,
          sourceKinds: relationship.sourceKinds,
          targetKinds: relationship.targetKinds,
          direction: relationship.direction,
          inverseRelationshipKey: relationship.inverseRelationshipKey,
          transitivity: relationship.transitivity,
          symmetry: relationship.symmetry,
          impactBehavior: relationship.impactBehavior,
          sourceCardinality: relationship.sourceCardinality,
          targetCardinality: relationship.targetCardinality,
          lifecycle: relationship.lifecycle,
        })),
        links: traceability.links.map((link) => ({
          key: link.key,
          sourceNodeKey: link.sourceNodeKey,
          targetNodeKey: link.targetNodeKey,
          relationshipKey: link.relationshipKey,
          provenance: link.provenance,
          state: link.state,
          verification: link.verification,
          effectiveFrom: link.effectiveFrom,
          expiresAt: link.expiresAt,
          invalidationConditions: link.invalidationConditions,
          supersedesLinkKeys: link.supersedesLinkKeys,
        })),
        transformations: traceability.transformations,
        traceSpine: traceability.traceSpine,
        requirementCoverage: traceability.requirementCoverage,
        coverageState: traceability.coverageState,
      }
      if (traceability.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import End-to-End Traceability ${traceability.id} membership digest is invalid`)
      }
    }

    const p0P4ReadinessGates = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("p0-p4-readiness-gates/"))
      .map(([, record]) => p0P4ReadinessGateSchema.parse(record))
    const p0P4ReadinessGateHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("p0-p4-readiness-gate-history/"))
      .map(([, record]) => p0P4ReadinessGateSchema.parse(record))
    const exactP0P4ReadinessGates = validateVersionedBusinessRecords(
      p0P4ReadinessGates,
      p0P4ReadinessGateHistory,
      "P0-P4 Readiness Gate",
    )
    type ReadinessIdentity = {
      id: string
      revision?: number
      productId?: string
      initiativeId?: string
    }
    const exactReadinessSubjects = new Map<string, ReadinessIdentity>()
    const addReadinessSubject = (kind: string, record: unknown, digestValue = canonicalDigest(record)): void => {
      const candidate = record as ReadinessIdentity
      if (!candidate.id) return
      const revision = candidate.revision ?? 1
      exactReadinessSubjects.set(`${kind}:${candidate.id}:${revision}:${digestValue}`, candidate)
    }
    const addReadinessSubjects = (kind: string, records: unknown[]): void => {
      for (const record of records) addReadinessSubject(kind, record)
    }
    addReadinessSubjects("architecture-challenge-model", [...architectureChallengeModels, ...architectureChallengeModelHistory])
    addReadinessSubjects("authorization-model", [...authorizationModels, ...authorizationModelHistory])
    addReadinessSubjects("bounded-context-model", [...boundedContextModels, ...boundedContextModelHistory])
    addReadinessSubjects("business-architecture-baseline", [...businessArchitectureBaselines, ...businessArchitectureBaselineHistory])
    addReadinessSubjects("business-capability-map", [...capabilityMaps, ...capabilityMapHistory])
    addReadinessSubjects("business-rule-catalog", [...businessRuleCatalogs, ...businessRuleCatalogHistory])
    addReadinessSubjects("business-understanding", [...businessUnderstanding, ...businessUnderstandingHistory])
    addReadinessSubjects("source-baseline", [...sourceBaselines, ...sourceBaselineHistory])
    addReadinessSubjects("data-model", [...dataModels, ...dataModelHistory])
    addReadinessSubjects("decision-register", [...decisionRegisters, ...decisionRegisterHistory])
    addReadinessSubjects("end-to-end-traceability-candidate", [...endToEndTraceability, ...endToEndTraceabilityHistory])
    addReadinessSubjects("event-integration-model", [...eventIntegrationModels, ...eventIntegrationModelHistory])
    addReadinessSubjects("evidence-registry", [...evidenceRegistries, ...evidenceRegistryHistory])
    addReadinessSubjects("failure-recovery-model", [...failureRecoveryModels, ...failureRecoveryModelHistory])
    for (const initiative of initiatives) addReadinessSubject("initiative", initiative)
    addReadinessSubjects("operating-model", [...operatingModels, ...operatingModelHistory])
    addReadinessSubjects("outcome-model", [...outcomeModels, ...outcomeModelHistory])
    addReadinessSubjects("process-model", [...processModels, ...processModelHistory])
    addReadinessSubjects("risk-register", [...riskRegisters, ...riskRegisterHistory])
    addReadinessSubjects("security-privacy-threat-assessment", [...securityPrivacyAssessments, ...securityPrivacyAssessmentHistory])
    addReadinessSubjects("source-record", sources)
    for (const history of sourceHistory) {
      addReadinessSubject("source-record", history.snapshot, history.recordDigest)
    }
    addReadinessSubjects("source-provenance", sourceProvenance)
    addReadinessSubjects("stakeholder-model", [...stakeholderModels, ...stakeholderModelHistory])
    addReadinessSubjects("system-solution-architecture", [...systemSolutionArchitectures, ...systemSolutionArchitectureHistory])
    addReadinessSubjects("value-stream-model", [...valueStreamModels, ...valueStreamModelHistory])
    const resolveReadinessSubject = (
      reference: P0P4ReadinessGate["outputs"][number]["subjects"][number],
      gate: P0P4ReadinessGate,
    ): ReadinessIdentity => {
      const resolved = exactReadinessSubjects.get(
        `${reference.recordKind}:${reference.recordId}:${reference.revision}:${reference.digest}`,
      )
      if (!resolved || (resolved.productId !== undefined && resolved.productId !== gate.productId) ||
          (resolved.initiativeId !== undefined && resolved.initiativeId !== gate.initiativeId)) {
        throw new Error(`Import P0-P4 Readiness Gate ${gate.id} exact governed subject reference is unresolved`)
      }
      return resolved
    }
    for (const gate of [...p0P4ReadinessGates, ...p0P4ReadinessGateHistory]) {
      const evidenceRegistry = exactEvidenceRegistries.get(
        `${gate.evidenceRegistry.recordId}:${gate.evidenceRegistry.revision}:${gate.evidenceRegistry.digest}`,
      )
      if (!evidenceRegistry || evidenceRegistry.initiativeId !== gate.initiativeId) {
        throw new Error(`Import P0-P4 Readiness Gate ${gate.id} exact Evidence Registry reference is unresolved`)
      }
      const traceability = exactEndToEndTraceability.get(
        `${gate.traceability.recordId}:${gate.traceability.revision}:${gate.traceability.digest}`,
      )
      if (!traceability || traceability.initiativeId !== gate.initiativeId) {
        throw new Error(`Import P0-P4 Readiness Gate ${gate.id} exact End-to-End Traceability reference is unresolved`)
      }
      const evidenceKeys = new Set(evidenceRegistry.evidenceItems.map((evidence) => evidence.key))
      for (const output of gate.outputs) {
        for (const subject of output.subjects) resolveReadinessSubject(subject, gate)
        if (output.evidenceItemKeys.some((key) => !evidenceKeys.has(key))) {
          throw new Error(`Import P0-P4 Readiness Gate ${gate.id} references an unknown Evidence Item`)
        }
      }
      for (const waiver of gate.waivers) {
        if (waiver.state === "granted") {
          throw new Error(`Import P0-P4 Readiness Gate ${gate.id} contains unverifiable granted waiver authority`)
        }
        const decisions = exactDecisionRegisters.get(
          `${waiver.decision.register.recordId}:${waiver.decision.register.revision}:${waiver.decision.register.digest}`,
        )
        const risks = exactRiskRegisters.get(
          `${waiver.risk.register.recordId}:${waiver.risk.register.revision}:${waiver.risk.register.digest}`,
        )
        if (!decisions || decisions.initiativeId !== gate.initiativeId ||
            !decisions.decisions.some((decision) => decision.key === waiver.decision.decisionKey) ||
            !risks || risks.initiativeId !== gate.initiativeId ||
            !risks.risks.some((risk) => risk.key === waiver.risk.riskKey)) {
          throw new Error(`Import P0-P4 Readiness Gate ${gate.id} waiver Decision or Risk reference is unresolved`)
        }
      }
      for (const unresolved of gate.unresolvedDecisions) {
        const decisions = exactDecisionRegisters.get(
          `${unresolved.decisionRegister.recordId}:${unresolved.decisionRegister.revision}:${unresolved.decisionRegister.digest}`,
        )
        if (!decisions || decisions.initiativeId !== gate.initiativeId ||
            !decisions.decisions.some((decision) => decision.key === unresolved.decisionKey)) {
          throw new Error(`Import P0-P4 Readiness Gate ${gate.id} unresolved Decision reference is unresolved`)
        }
      }
      for (const condition of gate.conditions) resolveReadinessSubject(condition.sourceReference, gate)
      const expectedMembership = {
        evaluationDefinition: gate.evaluationDefinition,
        evidenceRegistry: gate.evidenceRegistry,
        traceability: gate.traceability,
        outputs: gate.outputs,
        waivers: gate.waivers,
        unresolvedDecisions: gate.unresolvedDecisions,
        conditions: gate.conditions,
        requirementCoverage: gate.requirementCoverage,
        readinessAuthorityState: gate.readinessAuthorityState,
      }
      if (gate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import P0-P4 Readiness Gate ${gate.id} membership digest is invalid`)
      }
    }

    const p5HandoffPackages = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("p5-handoff-packages/"))
      .map(([, record]) => p5HandoffPackageSchema.parse(record))
    const p5HandoffPackageHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("p5-handoff-package-history/"))
      .map(([, record]) => p5HandoffPackageSchema.parse(record))
    validateVersionedBusinessRecords(p5HandoffPackages, p5HandoffPackageHistory, "P5 Handoff Package")
    for (const handoff of [...p5HandoffPackages, ...p5HandoffPackageHistory]) {
      const gate = exactP0P4ReadinessGates.get(
        `${handoff.readinessGate.recordId}:${handoff.readinessGate.revision}:${handoff.readinessGate.digest}`,
      )
      if (!gate || gate.initiativeId !== handoff.initiativeId || gate.productId !== handoff.productId) {
        throw new Error(`Import P5 Handoff Package ${handoff.id} exact P0-P4 Readiness Gate reference is unresolved`)
      }
      const outputByKind = new Map(gate.outputs.map((output) => [output.outputKind, output]))
      for (const item of handoff.items) {
        const output = outputByKind.get(item.outputKind)
        if (!output || item.applicability !== output.applicability || item.freshness !== output.freshness ||
            canonicalDigest(item.subjects) !== canonicalDigest(output.subjects)) {
          throw new Error(`Import P5 Handoff Package ${handoff.id} does not preserve an exact readiness output binding`)
        }
      }
      const expectedMembership = {
        informationClassification: handoff.informationClassification,
        title: handoff.title,
        objective: handoff.objective,
        scope: handoff.scope,
        readinessGate: handoff.readinessGate,
        readinessStatusDigest: handoff.readinessStatusDigest,
        readinessResult: handoff.readinessResult,
        target: handoff.target,
        items: handoff.items,
        requirementCoverage: handoff.requirementCoverage,
        assumptions: handoff.assumptions,
        unresolvedQuestions: handoff.unresolvedQuestions,
        conflicts: handoff.conflicts,
        limitations: handoff.limitations,
        nextActions: handoff.nextActions,
        transferState: handoff.transferState,
        acknowledgementState: handoff.acknowledgementState,
        sourceOwnershipState: handoff.sourceOwnershipState,
        transferAuthorityState: handoff.transferAuthorityState,
        p5EntryAuthorityState: handoff.p5EntryAuthorityState,
      }
      if (handoff.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import P5 Handoff Package ${handoff.id} membership digest is invalid`)
      }
    }

    const designApplicability = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("design-applicability/"))
      .map(([, record]) => designApplicabilitySchema.parse(record))
    const designApplicabilityHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("design-applicability-history/"))
      .map(([, record]) => designApplicabilitySchema.parse(record))
    const exactDesignApplicability = validateVersionedBusinessRecords(
      designApplicability,
      designApplicabilityHistory,
      "Design Applicability",
    )
    for (const candidate of [...designApplicability, ...designApplicabilityHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        classificationBinding: candidate.classificationBinding,
        applicabilityBinding: candidate.applicabilityBinding,
        scopes: candidate.scopes,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        designApprovalState: candidate.designApprovalState,
        designBaselineState: candidate.designBaselineState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Design Applicability ${candidate.id} membership digest is invalid`)
      }
      const boundInitiative = initiativesById.get(candidate.initiativeId)
      if (!boundInitiative) throw new Error(`Import Design Applicability ${candidate.id} has no Initiative`)
      if (candidate.context.initiativeRevision === (boundInitiative.revision ?? 1)) {
        const classification = boundInitiative.classification
        const matrix = boundInitiative.applicability
        if (!classification || candidate.classificationBinding.digest !== canonicalDigest(classification) ||
            candidate.classificationBinding.completenessPolicyVersion !== classification.completenessPolicyVersion ||
            candidate.classificationBinding.completenessPolicyDigest !== classification.completenessPolicyDigest) {
          throw new Error(`Import Design Applicability ${candidate.id} exact classification binding is unresolved`)
        }
        if (!matrix || candidate.applicabilityBinding.matrixRevision !== matrix.revision ||
            candidate.applicabilityBinding.matrixDigest !== canonicalDigest(matrix) ||
            candidate.applicabilityBinding.catalogVersion !== matrix.subjectCatalog?.catalogVersion ||
            candidate.applicabilityBinding.catalogDigest !== matrix.subjectCatalog?.digest) {
          throw new Error(`Import Design Applicability ${candidate.id} exact applicability binding is unresolved`)
        }
        for (const binding of [
          candidate.applicabilityBinding.experienceDesign,
          candidate.applicabilityBinding.designReferenceIntegration,
        ]) {
          const decision = matrix.decisions.find((entry) => entry.id === binding.decisionId)
          if (!decision || decision.revision !== binding.revision || canonicalDigest(decision) !== binding.digest ||
              decision.status !== binding.status || decision.subject.type !== binding.subject.type ||
              decision.subject.key !== binding.subject.key) {
            throw new Error(`Import Design Applicability ${candidate.id} exact general design decision binding is unresolved`)
          }
        }
      }
    }

    const designPersonaRoleModels = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("design-persona-role-models/"))
      .map(([, record]) => designPersonaRoleModelSchema.parse(record))
    const designPersonaRoleModelHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("design-persona-role-model-history/"))
      .map(([, record]) => designPersonaRoleModelSchema.parse(record))
    const exactDesignPersonaRoleModels = validateVersionedBusinessRecords(
      designPersonaRoleModels,
      designPersonaRoleModelHistory,
      "Design Persona and Role Model",
    )
    for (const candidate of [...designPersonaRoleModels, ...designPersonaRoleModelHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        stakeholderModel: candidate.stakeholderModel,
        designApplicability: candidate.designApplicability,
        personas: candidate.personas,
        participantCoverage: candidate.participantCoverage,
        designRoles: candidate.designRoles,
        roleCoverage: candidate.roleCoverage,
        contestability: candidate.contestability,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        personaValidationState: candidate.personaValidationState,
        roleAppointmentState: candidate.roleAppointmentState,
        designApprovalState: candidate.designApprovalState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Design Persona and Role Model ${candidate.id} membership digest is invalid`)
      }
      const stakeholder = exactStakeholderModels.get(
        `${candidate.stakeholderModel.recordId}:${candidate.stakeholderModel.revision}:${candidate.stakeholderModel.digest}`,
      )
      if (!stakeholder || stakeholder.initiativeId !== candidate.initiativeId) {
        throw new Error(`Import Design Persona and Role Model ${candidate.id} exact Stakeholder Model binding is unresolved`)
      }
      const applicability = exactDesignApplicability.get(
        `${candidate.designApplicability.recordId}:${candidate.designApplicability.revision}:${candidate.designApplicability.digest}`,
      )
      if (!applicability || applicability.initiativeId !== candidate.initiativeId ||
          applicability.membershipDigest !== candidate.designApplicability.membershipDigest) {
        throw new Error(`Import Design Persona and Role Model ${candidate.id} exact Design Applicability binding is unresolved`)
      }
      const stakeholderKeys = new Set(stakeholder.stakeholders.map((entry) => entry.key))
      const referencedStakeholderKeys = new Set([
        ...candidate.personas.flatMap((persona) => persona.stakeholderKeys),
        ...candidate.designRoles.flatMap((role) => role.stakeholderKeys),
        candidate.contestability.ownerStakeholderKey,
      ])
      if ([...referencedStakeholderKeys].some((key) => !stakeholderKeys.has(key))) {
        throw new Error(`Import Design Persona and Role Model ${candidate.id} contains an unresolved stakeholder key`)
      }
      const scopeKeys = new Set(applicability.scopes.map((scope) => `${scope.scope.kind}.${scope.scope.id}`))
      const referencedScopeKeys = new Set([
        ...candidate.personas.flatMap((persona) => persona.designScopeKeys),
        ...candidate.designRoles.flatMap((role) => role.designScopeKeys),
      ])
      if ([...referencedScopeKeys].some((key) => !scopeKeys.has(key))) {
        throw new Error(`Import Design Persona and Role Model ${candidate.id} contains an unresolved Design Applicability scope key`)
      }
      const designWorkStatuses = applicability.scopes.map((scope) =>
        scope.decisions.find((decision) => decision.aspect === "design-work")?.status ?? "awaiting-human-decision")
      const materialStatuses = new Set([
        "required", "recommended", "optional", "conditionally-required", "already-satisfied", "reused",
      ])
      const disposition = designWorkStatuses.every((status) => status === "not-applicable")
        ? "not-applicable"
        : designWorkStatuses.some((status) => materialStatuses.has(status))
          ? "material"
          : "unresolved"
      const participantCoverage = new Map(candidate.participantCoverage.map((entry) => [entry.category, entry.status]))
      const productDesignerCoverage = candidate.roleCoverage.find((entry) => entry.kind === "product-designer")?.status
      if (disposition === "material" && (([
        "affected-contributor", "change-owner", "reviewer", "workspace-steward",
      ] as const).some((category) => participantCoverage.get(category) !== "represented") ||
        productDesignerCoverage !== "represented")) {
        throw new Error(`Import Design Persona and Role Model ${candidate.id} does not cover applicable design participants and Product Designer responsibility`)
      }
      if (disposition === "not-applicable" && productDesignerCoverage !== "not-applicable") {
        throw new Error(`Import Design Persona and Role Model ${candidate.id} contradicts not-applicable design work`)
      }
      if (disposition === "unresolved" && productDesignerCoverage !== "unresolved") {
        throw new Error(`Import Design Persona and Role Model ${candidate.id} contradicts unresolved design work`)
      }
    }

    const userJourneyModels = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("user-journey-models/"))
      .map(([, record]) => userJourneyModelSchema.parse(record))
    const userJourneyModelHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("user-journey-model-history/"))
      .map(([, record]) => userJourneyModelSchema.parse(record))
    const exactUserJourneyModels = validateVersionedBusinessRecords(
      userJourneyModels, userJourneyModelHistory, "User Journey Model",
    )
    for (const candidate of [...userJourneyModels, ...userJourneyModelHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        designApplicability: candidate.designApplicability,
        designPersonaRoleModel: candidate.designPersonaRoleModel,
        journeys: candidate.journeys,
        scopeCoverage: candidate.scopeCoverage,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        journeyValidationState: candidate.journeyValidationState,
        designApprovalState: candidate.designApprovalState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import User Journey Model ${candidate.id} membership digest is invalid`)
      }
      const applicability = exactDesignApplicability.get(
        `${candidate.designApplicability.recordId}:${candidate.designApplicability.revision}:${candidate.designApplicability.digest}`,
      )
      if (!applicability || applicability.initiativeId !== candidate.initiativeId ||
          applicability.membershipDigest !== candidate.designApplicability.membershipDigest) {
        throw new Error(`Import User Journey Model ${candidate.id} exact Design Applicability binding is unresolved`)
      }
      const personaRole = exactDesignPersonaRoleModels.get(
        `${candidate.designPersonaRoleModel.recordId}:${candidate.designPersonaRoleModel.revision}:${candidate.designPersonaRoleModel.digest}`,
      )
      if (!personaRole || personaRole.initiativeId !== candidate.initiativeId ||
          personaRole.membershipDigest !== candidate.designPersonaRoleModel.membershipDigest) {
        throw new Error(`Import User Journey Model ${candidate.id} exact Design Persona and Role binding is unresolved`)
      }
      if (personaRole.designApplicability.recordId !== applicability.id ||
          personaRole.designApplicability.revision !== applicability.revision ||
          personaRole.designApplicability.digest !== canonicalDigest(applicability) ||
          personaRole.designApplicability.membershipDigest !== applicability.membershipDigest) {
        throw new Error(`Import User Journey Model ${candidate.id} upstream design bindings disagree`)
      }
      const scopeKeys = applicability.scopes.map((scope) => `${scope.scope.kind}.${scope.scope.id}`)
        .sort((left, right) => left.localeCompare(right))
      if (canonicalDigest(scopeKeys) !== canonicalDigest(candidate.scopeCoverage.map((entry) => entry.designScopeKey))) {
        throw new Error(`Import User Journey Model ${candidate.id} does not cover the exact Design Applicability scopes`)
      }
      const personaKeys = new Set(personaRole.personas.map((entry) => entry.key))
      const designRoleKeys = new Set(personaRole.designRoles.map((entry) => entry.key))
      const participantCategories = new Set<string>(personaRole.personas.flatMap((entry) => entry.participantCategories))
      for (const journey of candidate.journeys) {
        if (journey.designScopeKeys.some((key) => !scopeKeys.includes(key)) ||
            journey.personaKeys.some((key) => !personaKeys.has(key)) ||
            journey.designRoleKeys.some((key) => !designRoleKeys.has(key)) ||
            journey.participantCategories.some((category) => !participantCategories.has(category))) {
          throw new Error(`Import User Journey Model ${candidate.id} contains unresolved scope, persona, role, or participant links`)
        }
      }
      const coverageByScope = new Map(candidate.scopeCoverage.map((entry) => [entry.designScopeKey, entry]))
      const materialStatuses = new Set([
        "required", "recommended", "optional", "conditionally-required", "already-satisfied", "reused",
      ])
      for (const scope of applicability.scopes) {
        const key = `${scope.scope.kind}.${scope.scope.id}`
        const designWorkStatus = scope.decisions.find((decision) => decision.aspect === "design-work")?.status ??
          "awaiting-human-decision"
        const expectedStatus = designWorkStatus === "not-applicable"
          ? "not-applicable"
          : materialStatuses.has(designWorkStatus)
            ? "represented"
            : "unresolved"
        if (coverageByScope.get(key)?.status !== expectedStatus) {
          throw new Error(`Import User Journey Model ${candidate.id} contradicts Design Applicability for ${key}`)
        }
      }
    }

    const informationArchitectureModels = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("information-architecture-models/"))
      .map(([, record]) => informationArchitectureModelSchema.parse(record))
    const informationArchitectureModelHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("information-architecture-model-history/"))
      .map(([, record]) => informationArchitectureModelSchema.parse(record))
    const exactInformationArchitectureModels = validateVersionedBusinessRecords(
      informationArchitectureModels, informationArchitectureModelHistory, "Information Architecture Model",
    )
    for (const candidate of [...informationArchitectureModels, ...informationArchitectureModelHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        designApplicability: candidate.designApplicability,
        designPersonaRoleModel: candidate.designPersonaRoleModel,
        userJourneyModel: candidate.userJourneyModel,
        contentNodes: candidate.contentNodes,
        navigationRoutes: candidate.navigationRoutes,
        scopeCoverage: candidate.scopeCoverage,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        findabilityValidationState: candidate.findabilityValidationState,
        comprehensionValidationState: candidate.comprehensionValidationState,
        accessibilityValidationState: candidate.accessibilityValidationState,
        designApprovalState: candidate.designApprovalState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Information Architecture Model ${candidate.id} membership digest is invalid`)
      }
      const applicability = exactDesignApplicability.get(
        `${candidate.designApplicability.recordId}:${candidate.designApplicability.revision}:${candidate.designApplicability.digest}`,
      )
      if (!applicability || applicability.initiativeId !== candidate.initiativeId ||
          applicability.membershipDigest !== candidate.designApplicability.membershipDigest) {
        throw new Error(`Import Information Architecture Model ${candidate.id} exact Design Applicability binding is unresolved`)
      }
      const personaRole = exactDesignPersonaRoleModels.get(
        `${candidate.designPersonaRoleModel.recordId}:${candidate.designPersonaRoleModel.revision}:${candidate.designPersonaRoleModel.digest}`,
      )
      if (!personaRole || personaRole.initiativeId !== candidate.initiativeId ||
          personaRole.membershipDigest !== candidate.designPersonaRoleModel.membershipDigest) {
        throw new Error(`Import Information Architecture Model ${candidate.id} exact Design Persona and Role binding is unresolved`)
      }
      const journeyModel = exactUserJourneyModels.get(
        `${candidate.userJourneyModel.recordId}:${candidate.userJourneyModel.revision}:${candidate.userJourneyModel.digest}`,
      )
      if (!journeyModel || journeyModel.initiativeId !== candidate.initiativeId ||
          journeyModel.membershipDigest !== candidate.userJourneyModel.membershipDigest) {
        throw new Error(`Import Information Architecture Model ${candidate.id} exact User Journey binding is unresolved`)
      }
      if (journeyModel.designApplicability.recordId !== applicability.id ||
          journeyModel.designApplicability.revision !== applicability.revision ||
          journeyModel.designApplicability.digest !== canonicalDigest(applicability) ||
          journeyModel.designApplicability.membershipDigest !== applicability.membershipDigest ||
          journeyModel.designPersonaRoleModel.recordId !== personaRole.id ||
          journeyModel.designPersonaRoleModel.revision !== personaRole.revision ||
          journeyModel.designPersonaRoleModel.digest !== canonicalDigest(personaRole) ||
          journeyModel.designPersonaRoleModel.membershipDigest !== personaRole.membershipDigest) {
        throw new Error(`Import Information Architecture Model ${candidate.id} upstream design bindings disagree`)
      }
      const scopeKeys = applicability.scopes.map((scope) => `${scope.scope.kind}.${scope.scope.id}`)
        .sort((left, right) => left.localeCompare(right))
      if (canonicalDigest(scopeKeys) !== canonicalDigest(candidate.scopeCoverage.map((entry) => entry.designScopeKey))) {
        throw new Error(`Import Information Architecture Model ${candidate.id} does not cover the exact Design Applicability scopes`)
      }
      const personaKeys = new Set(personaRole.personas.map((entry) => entry.key))
      const designRoleKeys = new Set(personaRole.designRoles.map((entry) => entry.key))
      const journeyByKey = new Map(journeyModel.journeys.map((journey) => [journey.key, journey]))
      const touchpoints = new Set(journeyModel.journeys.flatMap((journey) =>
        journey.touchpoints.map((touchpoint) => `${journey.key}:${touchpoint.key}`)))
      for (const node of candidate.contentNodes) {
        if (node.designScopeKeys.some((key) => !scopeKeys.includes(key)) ||
            node.journeyKeys.some((key) => !journeyByKey.has(key)) ||
            node.touchpoints.some((entry) => !touchpoints.has(`${entry.journeyKey}:${entry.touchpointKey}`)) ||
            node.personaKeys.some((key) => !personaKeys.has(key)) ||
            node.designRoleKeys.some((key) => !designRoleKeys.has(key))) {
          throw new Error(`Import Information Architecture Model ${candidate.id} contains unresolved scope, journey, touchpoint, persona, or role links`)
        }
      }
      for (const route of candidate.navigationRoutes) {
        const journey = journeyByKey.get(route.journeyKey)
        const path = journey?.paths.find((entry) => entry.key === route.journeyPathKey)
        if (!journey || !path || path.kind !== route.kind ||
            route.personaKeys.some((key) => !personaKeys.has(key) || !journey.personaKeys.includes(key))) {
          throw new Error(`Import Information Architecture Model ${candidate.id} contains unresolved journey-path or persona routes`)
        }
      }
      const coverageByScope = new Map(candidate.scopeCoverage.map((entry) => [entry.designScopeKey, entry]))
      const materialStatuses = new Set([
        "required", "recommended", "optional", "conditionally-required", "already-satisfied", "reused",
      ])
      for (const scope of applicability.scopes) {
        const key = `${scope.scope.kind}.${scope.scope.id}`
        const designWorkStatus = scope.decisions.find((decision) => decision.aspect === "design-work")?.status ??
          "awaiting-human-decision"
        const expectedStatus = designWorkStatus === "not-applicable"
          ? "not-applicable"
          : materialStatuses.has(designWorkStatus)
            ? "represented"
            : "unresolved"
        const coverage = coverageByScope.get(key)
        if (coverage?.status !== expectedStatus) {
          throw new Error(`Import Information Architecture Model ${candidate.id} contradicts Design Applicability for ${key}`)
        }
        if (coverage?.status !== "represented") continue
        const routeKeys = new Set(coverage.routeKeys)
        const nodeKeys = new Set(coverage.nodeKeys)
        const journeys = journeyModel.journeys.filter((journey) => journey.designScopeKeys.includes(key))
        for (const journey of journeys) {
          for (const path of journey.paths) {
            if (!candidate.navigationRoutes.some((route) => routeKeys.has(route.key) &&
                route.journeyKey === journey.key && route.journeyPathKey === path.key && route.kind === path.kind)) {
              throw new Error(`Import Information Architecture Model ${candidate.id} does not route every exact User Journey path`)
            }
          }
          for (const touchpoint of journey.touchpoints) {
            if (!candidate.contentNodes.some((node) => nodeKeys.has(node.key) && node.touchpoints.some((reference) =>
              reference.journeyKey === journey.key && reference.touchpointKey === touchpoint.key))) {
              throw new Error(`Import Information Architecture Model ${candidate.id} does not place every exact User Journey touchpoint`)
            }
          }
        }
      }
    }

    const screenStateInventories = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("screen-state-inventories/"))
      .map(([, record]) => screenStateInventorySchema.parse(record))
    const screenStateInventoryHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("screen-state-inventory-history/"))
      .map(([, record]) => screenStateInventorySchema.parse(record))
    const exactScreenStateInventories = validateVersionedBusinessRecords(
      screenStateInventories, screenStateInventoryHistory, "Screen and State Inventory",
    )
    for (const candidate of [...screenStateInventories, ...screenStateInventoryHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        informationArchitectureModel: candidate.informationArchitectureModel,
        platforms: candidate.platforms,
        screens: candidate.screens,
        states: candidate.states,
        variants: candidate.variants,
        routeCoverage: candidate.routeCoverage,
        scopeCoverage: candidate.scopeCoverage,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        uiCompletenessState: candidate.uiCompletenessState,
        platformParityState: candidate.platformParityState,
        stateReachabilityState: candidate.stateReachabilityState,
        interactionQualityState: candidate.interactionQualityState,
        accessibilityValidationState: candidate.accessibilityValidationState,
        designApprovalState: candidate.designApprovalState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Screen and State Inventory ${candidate.id} membership digest is invalid`)
      }
      const architecture = exactInformationArchitectureModels.get(
        `${candidate.informationArchitectureModel.recordId}:${candidate.informationArchitectureModel.revision}:${candidate.informationArchitectureModel.digest}`,
      )
      if (!architecture || architecture.initiativeId !== candidate.initiativeId ||
          architecture.membershipDigest !== candidate.informationArchitectureModel.membershipDigest) {
        throw new Error(`Import Screen and State Inventory ${candidate.id} exact Information Architecture binding is unresolved`)
      }
      const routeKeys = architecture.navigationRoutes.map((route) => route.key).sort((left, right) => left.localeCompare(right))
      if (canonicalDigest(routeKeys) !== canonicalDigest(candidate.routeCoverage.map((entry) => entry.routeKey))) {
        throw new Error(`Import Screen and State Inventory ${candidate.id} does not cover the exact Information Architecture routes`)
      }
      const scopeByKey = new Map(architecture.scopeCoverage.map((entry) => [entry.designScopeKey, entry]))
      const scopeKeys = [...scopeByKey.keys()].sort((left, right) => left.localeCompare(right))
      if (canonicalDigest(scopeKeys) !== canonicalDigest(candidate.scopeCoverage.map((entry) => entry.designScopeKey)) ||
          candidate.scopeCoverage.some((entry) => scopeByKey.get(entry.designScopeKey)?.status !== entry.status)) {
        throw new Error(`Import Screen and State Inventory ${candidate.id} does not preserve exact Information Architecture scope coverage`)
      }
      const nodeKeys = new Set(architecture.contentNodes.map((node) => node.key))
      const exactRouteKeys = new Set(routeKeys)
      for (const screen of candidate.screens) {
        if (screen.routeKeys.some((key) => !exactRouteKeys.has(key)) ||
            screen.contentNodeKeys.some((key) => !nodeKeys.has(key))) {
          throw new Error(`Import Screen and State Inventory ${candidate.id} contains unresolved Information Architecture screen links`)
        }
      }
    }

    const designRequirements = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("design-requirements/"))
      .map(([, record]) => designRequirementsSchema.parse(record))
    const designRequirementsHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("design-requirements-history/"))
      .map(([, record]) => designRequirementsSchema.parse(record))
    const exactDesignRequirements = validateVersionedBusinessRecords(
      designRequirements, designRequirementsHistory, "Design Requirements",
    )
    for (const candidate of [...designRequirements, ...designRequirementsHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        outcomeModel: candidate.outcomeModel,
        screenStateInventory: candidate.screenStateInventory,
        requirements: candidate.requirements,
        outcomeCoverage: candidate.outcomeCoverage,
        catalogCompletenessState: candidate.catalogCompletenessState,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        priorityApprovalState: candidate.priorityApprovalState,
        designApprovalState: candidate.designApprovalState,
        backlogCommitmentState: candidate.backlogCommitmentState,
        readinessState: candidate.readinessState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Design Requirements ${candidate.id} membership digest is invalid`)
      }
      const outcomeModel = exactOutcomeModels.get(
        `${candidate.outcomeModel.recordId}:${candidate.outcomeModel.revision}:${candidate.outcomeModel.digest}`,
      )
      const inventory = exactScreenStateInventories.get(
        `${candidate.screenStateInventory.recordId}:${candidate.screenStateInventory.revision}:${candidate.screenStateInventory.digest}`,
      )
      if (!outcomeModel || outcomeModel.initiativeId !== candidate.initiativeId) {
        throw new Error(`Import Design Requirements ${candidate.id} exact Outcome Model binding is unresolved`)
      }
      if (!inventory || inventory.initiativeId !== candidate.initiativeId ||
          inventory.membershipDigest !== candidate.screenStateInventory.membershipDigest) {
        throw new Error(`Import Design Requirements ${candidate.id} exact Screen and State Inventory binding is unresolved`)
      }
      const expectedOutcomes = outcomeModel.outcomes.map((outcome) => outcome.id).sort((left, right) => left.localeCompare(right))
      if (canonicalDigest(expectedOutcomes) !== canonicalDigest(candidate.outcomeCoverage.map((entry) => entry.outcomeId))) {
        throw new Error(`Import Design Requirements ${candidate.id} does not cover every exact Outcome Model outcome`)
      }
      const targetSets = {
        platformKeys: new Set(inventory.platforms.filter((entry) => entry.supportState === "targeted").map((entry) => entry.key)),
        screenKeys: new Set(inventory.screens.map((entry) => entry.key)),
        stateKeys: new Set(inventory.states.map((entry) => entry.key)),
        variantKeys: new Set(inventory.variants.map((entry) => entry.key)),
        routeKeys: new Set(inventory.routeCoverage.filter((entry) => entry.status === "represented").map((entry) => entry.routeKey)),
        designScopeKeys: new Set(inventory.scopeCoverage.filter((entry) => entry.status === "represented").map((entry) => entry.designScopeKey)),
      }
      for (const linked of candidate.requirements) {
        const requirement = requirementSchema.parse(resolveExact(linked.requirement))
        if (requirement.productId !== candidate.productId || requirement.key !== linked.key || requirement.state === "rejected") {
          throw new Error(`Import Design Requirements ${candidate.id} exact Requirement link is invalid`)
        }
        for (const [kind, values] of Object.entries(linked.targets) as [keyof typeof targetSets, string[]][]) {
          if (values.some((value) => !targetSets[kind].has(value))) {
            throw new Error(`Import Design Requirements ${candidate.id} contains an unresolved ${kind} target`)
          }
        }
        for (const workItemReference of linked.backlog.workItems) {
          const workItem = workItemSchema.parse(resolveExact(workItemReference))
          const change = changesById.get(workItem.changeId)
          if (workItem.productId !== candidate.productId || change?.initiativeId !== candidate.initiativeId) {
            throw new Error(`Import Design Requirements ${candidate.id} Work Item is outside its exact Initiative backlog`)
          }
        }
      }
    }

    const portableDesignSnapshots = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("candidates/portable-design-"))
      .map(([, record]) => this.validatePortableDesignSnapshot(record))
    const portableDesignSnapshotById = new Map(portableDesignSnapshots.map((record) => [record.bundleId, record]))
    const designSystemTokenContracts = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("design-system-token-contracts/"))
      .map(([, record]) => designSystemTokenContractSchema.parse(record))
    const designSystemTokenContractHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("design-system-token-contracts-history/"))
      .map(([, record]) => designSystemTokenContractSchema.parse(record))
    const exactDesignSystemTokenContracts = validateVersionedBusinessRecords(
      designSystemTokenContracts, designSystemTokenContractHistory, "Design System and Token Contract",
    )
    for (const candidate of [...designSystemTokenContracts, ...designSystemTokenContractHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        designApplicability: candidate.designApplicability,
        screenStateInventory: candidate.screenStateInventory,
        designRequirements: candidate.designRequirements,
        portableDesignSnapshot: candidate.portableDesignSnapshot,
        designSystems: candidate.designSystems,
        tokens: candidate.tokens,
        variableCollections: candidate.variableCollections,
        variables: candidate.variables,
        components: candidate.components,
        requirementCoverage: candidate.requirementCoverage,
        catalogCompletenessState: candidate.catalogCompletenessState,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        designSystemValidityState: candidate.designSystemValidityState,
        ownershipAuthorityState: candidate.ownershipAuthorityState,
        designApprovalState: candidate.designApprovalState,
        designBaselineState: candidate.designBaselineState,
        readinessState: candidate.readinessState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Design System and Token Contract ${candidate.id} membership digest is invalid`)
      }
      const applicability = exactDesignApplicability.get(
        `${candidate.designApplicability.recordId}:${candidate.designApplicability.revision}:${candidate.designApplicability.digest}`,
      )
      const inventory = exactScreenStateInventories.get(
        `${candidate.screenStateInventory.recordId}:${candidate.screenStateInventory.revision}:${candidate.screenStateInventory.digest}`,
      )
      const requirements = exactDesignRequirements.get(
        `${candidate.designRequirements.recordId}:${candidate.designRequirements.revision}:${candidate.designRequirements.digest}`,
      )
      if (!applicability || applicability.initiativeId !== candidate.initiativeId ||
          applicability.membershipDigest !== candidate.designApplicability.membershipDigest) {
        throw new Error(`Import Design System and Token Contract ${candidate.id} exact Design Applicability binding is unresolved`)
      }
      if (!inventory || inventory.initiativeId !== candidate.initiativeId ||
          inventory.membershipDigest !== candidate.screenStateInventory.membershipDigest) {
        throw new Error(`Import Design System and Token Contract ${candidate.id} exact Screen and State Inventory binding is unresolved`)
      }
      if (!requirements || requirements.initiativeId !== candidate.initiativeId ||
          requirements.membershipDigest !== candidate.designRequirements.membershipDigest) {
        throw new Error(`Import Design System and Token Contract ${candidate.id} exact Design Requirements binding is unresolved`)
      }
      const approvedSystems = new Set(applicability.scopes.flatMap((scope) => scope.approvedDesignSystems.map((name) =>
        `${scope.scope.kind}:${scope.scope.id}:${name}`)))
      if (candidate.designSystems.some((system) => system.approvedReference && !approvedSystems.has(
        `${system.approvedReference.scopeKind}:${system.approvedReference.scopeId}:${system.approvedReference.name}`))) {
        throw new Error(`Import Design System and Token Contract ${candidate.id} has an unresolved approved Design System reference`)
      }
      const requirementKeys = requirements.requirements.map((entry) => entry.key).sort((left, right) => left.localeCompare(right))
      if (canonicalDigest(requirementKeys) !== canonicalDigest(candidate.requirementCoverage.map((entry) => entry.requirementKey))) {
        throw new Error(`Import Design System and Token Contract ${candidate.id} does not cover every exact current Design Requirement`)
      }
      const targetSets = {
        requirementKeys: new Set(requirementKeys),
        platformKeys: new Set(inventory.platforms.filter((entry) => entry.supportState === "targeted").map((entry) => entry.key)),
        screenKeys: new Set(inventory.screens.map((entry) => entry.key)),
        stateKeys: new Set(inventory.states.map((entry) => entry.key)),
        variantKeys: new Set(inventory.variants.map((entry) => entry.key)),
      }
      for (const token of candidate.tokens) {
        if (token.requirementKeys.some((key) => !targetSets.requirementKeys.has(key)) ||
            token.platformKeys.some((key) => !targetSets.platformKeys.has(key)) ||
            token.screenKeys.some((key) => !targetSets.screenKeys.has(key))) {
          throw new Error(`Import Design System and Token Contract ${candidate.id} has unresolved Token targets`)
        }
      }
      for (const variable of candidate.variables) {
        if (variable.requirementKeys.some((key) => !targetSets.requirementKeys.has(key))) {
          throw new Error(`Import Design System and Token Contract ${candidate.id} has unresolved Variable Requirement targets`)
        }
      }
      for (const component of candidate.components) {
        if (component.requirementKeys.some((key) => !targetSets.requirementKeys.has(key)) ||
            component.platformKeys.some((key) => !targetSets.platformKeys.has(key)) ||
            component.screenKeys.some((key) => !targetSets.screenKeys.has(key)) ||
            component.stateKeys.some((key) => !targetSets.stateKeys.has(key)) ||
            component.variantKeys.some((key) => !targetSets.variantKeys.has(key))) {
          throw new Error(`Import Design System and Token Contract ${candidate.id} has unresolved Component targets`)
        }
      }
      const imported = candidate.tokens.some((entry) => entry.origin === "imported-snapshot") ||
        candidate.components.some((entry) => entry.disposition === "imported-snapshot")
      const snapshot = candidate.portableDesignSnapshot
        ? portableDesignSnapshotById.get(candidate.portableDesignSnapshot.bundleId)
        : undefined
      if (imported && !snapshot) {
        throw new Error(`Import Design System and Token Contract ${candidate.id} imported catalog lacks its exact portable design snapshot`)
      }
      if (candidate.portableDesignSnapshot && (!snapshot || snapshot.productId !== candidate.productId ||
          snapshot.initiativeId !== candidate.initiativeId ||
          snapshot.snapshotDigest !== candidate.portableDesignSnapshot.snapshotDigest ||
          snapshot.evidence.evidenceDigest !== candidate.portableDesignSnapshot.evidenceDigest ||
          snapshot.sourceReview.status !== candidate.portableDesignSnapshot.sourceReviewStatus)) {
        throw new Error(`Import Design System and Token Contract ${candidate.id} portable design snapshot binding is unresolved`)
      }
      if (snapshot) {
        const tokens = new Map(snapshot.tokens.map((entry) => [`${entry.artifactId}:${entry.path}`, entry]))
        for (const token of candidate.tokens.filter((entry) => entry.origin === "imported-snapshot")) {
          const reference = token.importedToken!
          const importedToken = tokens.get(`${reference.artifactId}:${reference.path}`)
          if (!importedToken || importedToken.type !== reference.type || importedToken.valueDigest !== reference.valueDigest) {
            throw new Error(`Import Design System and Token Contract ${candidate.id} imported Token binding is unresolved`)
          }
        }
        const components = new Map(snapshot.artifacts.filter((entry) => entry.kind === "component")
          .map((entry) => [entry.id, entry]))
        for (const component of candidate.components.filter((entry) => entry.disposition === "imported-snapshot")) {
          const reference = component.importedComponent!
          if (components.get(reference.artifactId)?.digest !== reference.digest) {
            throw new Error(`Import Design System and Token Contract ${candidate.id} imported Component binding is unresolved`)
          }
        }
      }
    }

    const accessibilityDesignRules = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("accessibility-design-rules/"))
      .map(([, record]) => accessibilityDesignRulesSchema.parse(record))
    const accessibilityDesignRulesHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("accessibility-design-rules-history/"))
      .map(([, record]) => accessibilityDesignRulesSchema.parse(record))
    const exactAccessibilityDesignRules = validateVersionedBusinessRecords(
      accessibilityDesignRules, accessibilityDesignRulesHistory, "Accessibility Design Rules",
    )
    for (const candidate of [...accessibilityDesignRules, ...accessibilityDesignRulesHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        screenStateInventory: candidate.screenStateInventory,
        designRequirements: candidate.designRequirements,
        designSystemTokenContract: candidate.designSystemTokenContract,
        targets: candidate.targets,
        rules: candidate.rules,
        checks: candidate.checks,
        requirementCoverage: candidate.requirementCoverage,
        catalogCompletenessState: candidate.catalogCompletenessState,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        accessibilityConformanceState: candidate.accessibilityConformanceState,
        ruleValidityState: candidate.ruleValidityState,
        legalComplianceState: candidate.legalComplianceState,
        designApprovalState: candidate.designApprovalState,
        designBaselineState: candidate.designBaselineState,
        readinessState: candidate.readinessState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Accessibility Design Rules ${candidate.id} membership digest is invalid`)
      }
      const inventory = exactScreenStateInventories.get(
        `${candidate.screenStateInventory.recordId}:${candidate.screenStateInventory.revision}:${candidate.screenStateInventory.digest}`,
      )
      const requirements = exactDesignRequirements.get(
        `${candidate.designRequirements.recordId}:${candidate.designRequirements.revision}:${candidate.designRequirements.digest}`,
      )
      const designSystem = exactDesignSystemTokenContracts.get(
        `${candidate.designSystemTokenContract.recordId}:${candidate.designSystemTokenContract.revision}:${candidate.designSystemTokenContract.digest}`,
      )
      if (!inventory || inventory.initiativeId !== candidate.initiativeId ||
          inventory.membershipDigest !== candidate.screenStateInventory.membershipDigest) {
        throw new Error(`Import Accessibility Design Rules ${candidate.id} exact Screen and State Inventory binding is unresolved`)
      }
      if (!requirements || requirements.initiativeId !== candidate.initiativeId ||
          requirements.membershipDigest !== candidate.designRequirements.membershipDigest) {
        throw new Error(`Import Accessibility Design Rules ${candidate.id} exact Design Requirements binding is unresolved`)
      }
      if (!designSystem || designSystem.initiativeId !== candidate.initiativeId ||
          designSystem.membershipDigest !== candidate.designSystemTokenContract.membershipDigest) {
        throw new Error(`Import Accessibility Design Rules ${candidate.id} exact Design System and Token Contract binding is unresolved`)
      }
      const requirementKeys = requirements.requirements.map((entry) => entry.key).sort((left, right) => left.localeCompare(right))
      if (canonicalDigest(requirementKeys) !== canonicalDigest(candidate.requirementCoverage.map((entry) => entry.requirementKey))) {
        throw new Error(`Import Accessibility Design Rules ${candidate.id} does not cover every exact current Design Requirement`)
      }
      const catalogs = {
        platform: new Set(inventory.platforms.filter((entry) => entry.supportState === "targeted").map((entry) => entry.key)),
        screen: new Set(inventory.screens.map((entry) => entry.key)),
        state: new Set(inventory.states.map((entry) => entry.key)),
        "design-system": new Set(designSystem.designSystems.map((entry) => entry.key)),
        token: new Set(designSystem.tokens.map((entry) => entry.path)),
        variable: new Set(designSystem.variables.map((entry) => entry.key)),
        component: new Set(designSystem.components.map((entry) => entry.key)),
      }
      const requirementKeySet = new Set(requirementKeys)
      for (const target of candidate.targets) {
        if (!catalogs[target.kind].has(target.referenceKey) ||
            target.platformKeys.some((key) => !catalogs.platform.has(key)) ||
            target.screenKeys.some((key) => !catalogs.screen.has(key)) ||
            target.stateKeys.some((key) => !catalogs.state.has(key)) ||
            target.requirementKeys.some((key) => !requirementKeySet.has(key))) {
          throw new Error(`Import Accessibility Design Rules ${candidate.id} has an unresolved governed target`)
        }
      }
      const coverageByRequirement = new Map(candidate.requirementCoverage.map((entry) => [entry.requirementKey, entry]))
      const ruleByKey = new Map(candidate.rules.map((entry) => [entry.key, entry]))
      for (const rule of candidate.rules) {
        if (rule.requirementKeys.some((key) => !coverageByRequirement.get(key)?.ruleKeys.includes(rule.key))) {
          throw new Error(`Import Accessibility Design Rules ${candidate.id} rule coverage is not reciprocal`)
        }
      }
      for (const coverage of candidate.requirementCoverage) {
        if (coverage.ruleKeys.some((key) => !ruleByKey.get(key)?.requirementKeys.includes(coverage.requirementKey))) {
          throw new Error(`Import Accessibility Design Rules ${candidate.id} Requirement coverage is not reciprocal`)
        }
      }
      const linkedTargets = new Set(candidate.rules.flatMap((entry) => entry.targetKeys))
      if (candidate.catalogCompletenessState === "candidate-complete" &&
          candidate.targets.some((target) => !linkedTargets.has(target.key))) {
        throw new Error(`Import Accessibility Design Rules ${candidate.id} candidate-complete catalog has an unrepresented target`)
      }
    }

    const responsiveMultiPlatformTargets = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("responsive-multi-platform-targets/"))
      .map(([, record]) => responsiveMultiPlatformTargetsSchema.parse(record))
    const responsiveMultiPlatformTargetsHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("responsive-multi-platform-targets-history/"))
      .map(([, record]) => responsiveMultiPlatformTargetsSchema.parse(record))
    const exactResponsiveMultiPlatformTargets = validateVersionedBusinessRecords(
      responsiveMultiPlatformTargets, responsiveMultiPlatformTargetsHistory, "Responsive and Multi-Platform Targets",
    )
    for (const candidate of [...responsiveMultiPlatformTargets, ...responsiveMultiPlatformTargetsHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        screenStateInventory: candidate.screenStateInventory,
        designRequirements: candidate.designRequirements,
        designSystemTokenContract: candidate.designSystemTokenContract,
        accessibilityDesignRules: candidate.accessibilityDesignRules,
        platformTargets: candidate.platformTargets,
        breakpoints: candidate.breakpoints,
        behaviors: candidate.behaviors,
        checks: candidate.checks,
        requirementCoverage: candidate.requirementCoverage,
        targetCatalogState: candidate.targetCatalogState,
        breakpointCatalogState: candidate.breakpointCatalogState,
        behaviorCatalogState: candidate.behaviorCatalogState,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        responsiveCompletenessState: candidate.responsiveCompletenessState,
        platformParityState: candidate.platformParityState,
        breakpointValidityState: candidate.breakpointValidityState,
        behaviorValidityState: candidate.behaviorValidityState,
        accessibilityConformanceState: candidate.accessibilityConformanceState,
        designApprovalState: candidate.designApprovalState,
        designBaselineState: candidate.designBaselineState,
        readinessState: candidate.readinessState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Responsive and Multi-Platform Targets ${candidate.id} membership digest is invalid`)
      }
      const inventory = exactScreenStateInventories.get(
        `${candidate.screenStateInventory.recordId}:${candidate.screenStateInventory.revision}:${candidate.screenStateInventory.digest}`,
      )
      const requirements = exactDesignRequirements.get(
        `${candidate.designRequirements.recordId}:${candidate.designRequirements.revision}:${candidate.designRequirements.digest}`,
      )
      const designSystem = exactDesignSystemTokenContracts.get(
        `${candidate.designSystemTokenContract.recordId}:${candidate.designSystemTokenContract.revision}:${candidate.designSystemTokenContract.digest}`,
      )
      const accessibility = exactAccessibilityDesignRules.get(
        `${candidate.accessibilityDesignRules.recordId}:${candidate.accessibilityDesignRules.revision}:${candidate.accessibilityDesignRules.digest}`,
      )
      if (!inventory || inventory.initiativeId !== candidate.initiativeId ||
          inventory.membershipDigest !== candidate.screenStateInventory.membershipDigest) {
        throw new Error(`Import Responsive and Multi-Platform Targets ${candidate.id} exact Screen and State Inventory binding is unresolved`)
      }
      if (!requirements || requirements.initiativeId !== candidate.initiativeId ||
          requirements.membershipDigest !== candidate.designRequirements.membershipDigest) {
        throw new Error(`Import Responsive and Multi-Platform Targets ${candidate.id} exact Design Requirements binding is unresolved`)
      }
      if (!designSystem || designSystem.initiativeId !== candidate.initiativeId ||
          designSystem.membershipDigest !== candidate.designSystemTokenContract.membershipDigest) {
        throw new Error(`Import Responsive and Multi-Platform Targets ${candidate.id} exact Design System and Token Contract binding is unresolved`)
      }
      if (!accessibility || accessibility.initiativeId !== candidate.initiativeId ||
          accessibility.membershipDigest !== candidate.accessibilityDesignRules.membershipDigest) {
        throw new Error(`Import Responsive and Multi-Platform Targets ${candidate.id} exact Accessibility Design Rules binding is unresolved`)
      }
      const targetedPlatforms = inventory.platforms.filter((entry) => entry.supportState === "targeted")
      const platformByKey = new Map(targetedPlatforms.map((entry) => [entry.key, entry]))
      const screenKeys = new Set(inventory.screens.map((entry) => entry.key))
      const stateKeys = new Set(inventory.states.map((entry) => entry.key))
      const requirementKeys = requirements.requirements.map((entry) => entry.key).sort((left, right) => left.localeCompare(right))
      const requirementKeySet = new Set(requirementKeys)
      const accessibilityRuleKeys = new Set(accessibility.rules.map((entry) => entry.key))
      if (canonicalDigest(requirementKeys) !== canonicalDigest(candidate.requirementCoverage.map((entry) => entry.requirementKey))) {
        throw new Error(`Import Responsive and Multi-Platform Targets ${candidate.id} does not cover every exact current Design Requirement`)
      }
      for (const target of candidate.platformTargets) {
        const platform = platformByKey.get(target.platformKey)
        if (!platform || target.contextClassKeys.some((key) => !platform.viewportOrContainerClasses.includes(key)) ||
            target.screenKeys.some((key) => !screenKeys.has(key)) ||
            target.requirementKeys.some((key) => !requirementKeySet.has(key))) {
          throw new Error(`Import Responsive and Multi-Platform Targets ${candidate.id} has an unresolved governed platform target`)
        }
      }
      const breakpointByKey = new Map(candidate.breakpoints.map((entry) => [entry.key, entry]))
      for (const breakpoint of candidate.breakpoints) {
        const platform = platformByKey.get(breakpoint.platformKey)
        if (!platform?.viewportOrContainerClasses.includes(breakpoint.contextClassKey)) {
          throw new Error(`Import Responsive and Multi-Platform Targets ${candidate.id} has an unresolved governed breakpoint`)
        }
      }
      const behaviorByKey = new Map(candidate.behaviors.map((entry) => [entry.key, entry]))
      const coverageByRequirement = new Map(candidate.requirementCoverage.map((entry) => [entry.requirementKey, entry]))
      for (const behavior of candidate.behaviors) {
        if (behavior.platformKeys.some((key) => !platformByKey.has(key)) ||
            behavior.breakpointKeys.some((key) => !breakpointByKey.has(key)) ||
            behavior.screenKeys.some((key) => !screenKeys.has(key)) ||
            behavior.stateKeys.some((key) => !stateKeys.has(key)) ||
            behavior.requirementKeys.some((key) => !requirementKeySet.has(key) ||
              !coverageByRequirement.get(key)?.behaviorKeys.includes(behavior.key)) ||
            behavior.accessibilityRuleKeys.some((key) => !accessibilityRuleKeys.has(key))) {
          throw new Error(`Import Responsive and Multi-Platform Targets ${candidate.id} has an unresolved governed behavior`)
        }
      }
      for (const coverage of candidate.requirementCoverage) {
        if (coverage.behaviorKeys.some((key) => !behaviorByKey.get(key)?.requirementKeys.includes(coverage.requirementKey))) {
          throw new Error(`Import Responsive and Multi-Platform Targets ${candidate.id} Requirement coverage is not reciprocal`)
        }
      }
      for (const check of candidate.checks) {
        const behavior = behaviorByKey.get(check.behaviorKey)
        if (!behavior || !behavior.platformKeys.includes(check.platformKey) || !behavior.screenKeys.includes(check.screenKey) ||
            (check.stateKey !== undefined && !behavior.stateKeys.includes(check.stateKey)) ||
            (check.breakpointKey !== undefined && !behavior.breakpointKeys.includes(check.breakpointKey))) {
          throw new Error(`Import Responsive and Multi-Platform Targets ${candidate.id} has an unresolved governed check`)
        }
      }
    }

    const manualFigmaExecutionPaths = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("manual-figma-execution-paths/"))
      .map(([, record]) => manualFigmaExecutionPathSchema.parse(record))
    const manualFigmaExecutionPathHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("manual-figma-execution-path-history/"))
      .map(([, record]) => manualFigmaExecutionPathSchema.parse(record))
    const exactManualFigmaExecutionPaths = validateVersionedBusinessRecords(
      manualFigmaExecutionPaths, manualFigmaExecutionPathHistory, "Manual Figma Execution Path",
    )
    for (const candidate of [...manualFigmaExecutionPaths, ...manualFigmaExecutionPathHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        designApplicability: candidate.designApplicability,
        screenStateInventory: candidate.screenStateInventory,
        designRequirements: candidate.designRequirements,
        designSystemTokenContract: candidate.designSystemTokenContract,
        accessibilityDesignRules: candidate.accessibilityDesignRules,
        responsiveMultiPlatformTargets: candidate.responsiveMultiPlatformTargets,
        scopes: candidate.scopes,
        instructions: candidate.instructions,
        checks: candidate.checks,
        requirementCoverage: candidate.requirementCoverage,
        guideCatalogState: candidate.guideCatalogState,
        handoffCatalogState: candidate.handoffCatalogState,
        returnContractState: candidate.returnContractState,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        figmaConnectionState: candidate.figmaConnectionState,
        figmaExecutionState: candidate.figmaExecutionState,
        figmaWriteAuthorityState: candidate.figmaWriteAuthorityState,
        designApprovalState: candidate.designApprovalState,
        designBaselineState: candidate.designBaselineState,
        readinessState: candidate.readinessState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Manual Figma Execution Path ${candidate.id} membership digest is invalid`)
      }
      const applicability = exactDesignApplicability.get(
        `${candidate.designApplicability.recordId}:${candidate.designApplicability.revision}:${candidate.designApplicability.digest}`,
      )
      const inventory = exactScreenStateInventories.get(
        `${candidate.screenStateInventory.recordId}:${candidate.screenStateInventory.revision}:${candidate.screenStateInventory.digest}`,
      )
      const requirements = exactDesignRequirements.get(
        `${candidate.designRequirements.recordId}:${candidate.designRequirements.revision}:${candidate.designRequirements.digest}`,
      )
      const designSystem = exactDesignSystemTokenContracts.get(
        `${candidate.designSystemTokenContract.recordId}:${candidate.designSystemTokenContract.revision}:${candidate.designSystemTokenContract.digest}`,
      )
      const accessibility = exactAccessibilityDesignRules.get(
        `${candidate.accessibilityDesignRules.recordId}:${candidate.accessibilityDesignRules.revision}:${candidate.accessibilityDesignRules.digest}`,
      )
      const responsive = exactResponsiveMultiPlatformTargets.get(
        `${candidate.responsiveMultiPlatformTargets.recordId}:${candidate.responsiveMultiPlatformTargets.revision}:${candidate.responsiveMultiPlatformTargets.digest}`,
      )
      const exactBindings = [
        [applicability, candidate.designApplicability.membershipDigest],
        [inventory, candidate.screenStateInventory.membershipDigest],
        [requirements, candidate.designRequirements.membershipDigest],
        [designSystem, candidate.designSystemTokenContract.membershipDigest],
        [accessibility, candidate.accessibilityDesignRules.membershipDigest],
        [responsive, candidate.responsiveMultiPlatformTargets.membershipDigest],
      ] as const
      if (exactBindings.some(([record, membershipDigest]) =>
        !record || record.initiativeId !== candidate.initiativeId || record.membershipDigest !== membershipDigest)) {
        throw new Error(`Import Manual Figma Execution Path ${candidate.id} has an unresolved exact governed binding`)
      }
      const applicableScopes = new Map(applicability!.scopes.flatMap((scope) => {
        const figma = scope.decisions.find((decision) => decision.aspect === "figma")
        if (!figma || !["already-satisfied", "conditionally-required", "optional", "recommended", "required", "reused"]
          .includes(figma.status)) return []
        const modes = scope.designSource.modes.filter((mode) => mode === "figma-design" || mode === "figma-make")
        return modes.length > 0 ? [[scope.scope.id, new Set(modes)] as const] : []
      }))
      for (const scope of candidate.scopes) {
        const modes = applicableScopes.get(scope.designScopeKey)
        if (!modes?.has(scope.figmaMode)) {
          throw new Error(`Import Manual Figma Execution Path ${candidate.id} has an unresolved material Figma scope`)
        }
        const instructionKeys = candidate.instructions.filter((step) => step.scopeKeys.includes(scope.key))
          .map((step) => step.key).sort((left, right) => left.localeCompare(right))
        if (canonicalDigest(instructionKeys) !== canonicalDigest(scope.instructionStepKeys)) {
          throw new Error(`Import Manual Figma Execution Path ${candidate.id} instruction links are not reciprocal`)
        }
        if (candidate.guideCatalogState === "candidate-complete") {
          const instructionKinds = candidate.instructions.filter((step) => step.scopeKeys.includes(scope.key))
            .map((step) => step.kind)
          const requiredKinds = ["prepare", "handoff", "manual-figma-execution", "export-return", "human-review"]
          if (canonicalDigest(instructionKinds) !== canonicalDigest(requiredKinds)) {
            throw new Error(`Import Manual Figma Execution Path ${candidate.id} has incomplete governed scope instructions`)
          }
        }
        if (candidate.reviewState === "ready-for-human-review") {
          const checkKinds = candidate.checks.filter((check) => check.scopeKey === scope.key)
            .map((check) => check.kind).sort((left, right) => left.localeCompare(right))
          const requiredCheckKinds = [
            "accessibility-reviewed",
            "handoff-manifest-digest-verified",
            "handoff-package-digest-verified",
            "handoff-path-contained",
            "instructions-reviewed",
            "privacy-reviewed",
            "responsive-targets-reviewed",
            "return-contract-reviewed",
          ]
          if (canonicalDigest(checkKinds) !== canonicalDigest(requiredCheckKinds)) {
            throw new Error(`Import Manual Figma Execution Path ${candidate.id} has incomplete governed scope checks`)
          }
        }
      }
      if (new Set(candidate.scopes.map((scope) => scope.handoffLocation)).size !== candidate.scopes.length) {
        throw new Error(`Import Manual Figma Execution Path ${candidate.id} has duplicate handoff locations`)
      }
      if (candidate.guideCatalogState === "candidate-complete" &&
          candidate.handoffCatalogState === "candidate-complete" && candidate.returnContractState === "candidate-complete" &&
          canonicalDigest(candidate.scopes.map((scope) => scope.designScopeKey).sort((left, right) => left.localeCompare(right))) !==
          canonicalDigest([...applicableScopes.keys()].sort((left, right) => left.localeCompare(right)))) {
        throw new Error(`Import Manual Figma Execution Path ${candidate.id} does not cover every exact material Figma scope`)
      }
      const requirementKeys = requirements!.requirements.map((entry) => entry.key)
        .sort((left, right) => left.localeCompare(right))
      if (canonicalDigest(requirementKeys) !==
          canonicalDigest(candidate.requirementCoverage.map((entry) => entry.requirementKey))) {
        throw new Error(`Import Manual Figma Execution Path ${candidate.id} does not cover every exact current Design Requirement`)
      }
    }

    const figmaMcpCapabilityDiscoveries = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("figma-mcp-capability-discoveries/"))
      .map(([, record]) => figmaMcpCapabilityDiscoverySchema.parse(record))
    const figmaMcpCapabilityDiscoveryHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("figma-mcp-capability-discovery-history/"))
      .map(([, record]) => figmaMcpCapabilityDiscoverySchema.parse(record))
    const exactFigmaMcpCapabilityDiscoveries = validateVersionedBusinessRecords(
      figmaMcpCapabilityDiscoveries,
      figmaMcpCapabilityDiscoveryHistory,
      "Figma MCP Capability Discovery",
    )
    for (const candidate of [...figmaMcpCapabilityDiscoveries, ...figmaMcpCapabilityDiscoveryHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        designApplicability: candidate.designApplicability,
        manualFigmaExecutionPath: candidate.manualFigmaExecutionPath,
        adapter: candidate.adapter,
        observation: candidate.observation,
        tools: candidate.tools,
        catalogState: candidate.catalogState,
        permissionModelState: candidate.permissionModelState,
        limitCatalogState: candidate.limitCatalogState,
        versionCatalogState: candidate.versionCatalogState,
        ownership: candidate.ownership,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        figmaConnectionState: candidate.figmaConnectionState,
        figmaRequestState: candidate.figmaRequestState,
        credentialState: candidate.credentialState,
        permissionGrantState: candidate.permissionGrantState,
        figmaWriteAuthorityState: candidate.figmaWriteAuthorityState,
        designApprovalState: candidate.designApprovalState,
        designBaselineState: candidate.designBaselineState,
        readinessState: candidate.readinessState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Figma MCP Capability Discovery ${candidate.id} membership digest is invalid`)
      }
      const applicability = exactDesignApplicability.get(
        `${candidate.designApplicability.recordId}:${candidate.designApplicability.revision}:${candidate.designApplicability.digest}`,
      )
      const manualPath = exactManualFigmaExecutionPaths.get(
        `${candidate.manualFigmaExecutionPath.recordId}:${candidate.manualFigmaExecutionPath.revision}:${candidate.manualFigmaExecutionPath.digest}`,
      )
      if (!applicability || applicability.initiativeId !== candidate.initiativeId ||
          applicability.membershipDigest !== candidate.designApplicability.membershipDigest ||
          !manualPath || manualPath.initiativeId !== candidate.initiativeId ||
          manualPath.membershipDigest !== candidate.manualFigmaExecutionPath.membershipDigest) {
        throw new Error(`Import Figma MCP Capability Discovery ${candidate.id} has an unresolved exact governed binding`)
      }
      const hasMaterialFigmaScope = applicability.scopes.some((scope) => {
        const figma = scope.decisions.find((decision) => decision.aspect === "figma")
        return figma && [
          "already-satisfied",
          "conditionally-required",
          "optional",
          "recommended",
          "required",
          "reused",
        ].includes(figma.status) &&
          scope.designSource.modes.some((mode) => mode === "figma-design" || mode === "figma-make")
      })
      if (!hasMaterialFigmaScope) {
        throw new Error(`Import Figma MCP Capability Discovery ${candidate.id} lacks exact material Figma applicability`)
      }
      if (candidate.permissionModelState === "candidate-separated") {
        for (const tool of candidate.tools) {
          if (tool.effectClass === "figma-read" && tool.permissions.some((entry) => entry.accessClass === "write")) {
            throw new Error(`Import Figma MCP Capability Discovery ${candidate.id} mixes write permissions into a read tool`)
          }
          if (tool.effectClass === "figma-write" && !tool.permissions.some((entry) => entry.accessClass === "write")) {
            throw new Error(`Import Figma MCP Capability Discovery ${candidate.id} has a write tool without an explicit write permission requirement`)
          }
        }
      }
      if (candidate.catalogState === "candidate-observation-complete") {
        const observedCatalogDigest = canonicalDigest(candidate.tools.map((tool) => ({
          key: tool.key,
          toolName: tool.toolName,
          capabilityClass: tool.capabilityClass,
          effectClass: tool.effectClass,
          availabilityState: tool.availabilityState,
          versionState: tool.versionState,
          version: tool.version,
          schemaDigest: tool.schemaDigest,
          permissions: tool.permissions,
          limits: tool.limits,
        })))
        if (candidate.observation.catalogDigest !== observedCatalogDigest) {
          throw new Error(`Import Figma MCP Capability Discovery ${candidate.id} observed catalog digest is invalid`)
        }
      }
    }

    const figmaReadSnapshots = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("figma-read-snapshots/"))
      .map(([, record]) => figmaReadSnapshotSchema.parse(record))
    const figmaReadSnapshotHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("figma-read-snapshot-history/"))
      .map(([, record]) => figmaReadSnapshotSchema.parse(record))
    const exactFigmaReadSnapshots = validateVersionedBusinessRecords(
      figmaReadSnapshots,
      figmaReadSnapshotHistory,
      "Figma Read Snapshot",
    )
    for (const candidate of [...figmaReadSnapshots, ...figmaReadSnapshotHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        designApplicability: candidate.designApplicability,
        designSystemTokenContract: candidate.designSystemTokenContract,
        figmaMcpCapabilityDiscovery: candidate.figmaMcpCapabilityDiscovery,
        capture: candidate.capture,
        files: candidate.files,
        components: candidate.components,
        variableCollections: candidate.variableCollections,
        variables: candidate.variables,
        snapshotCompletenessState: candidate.snapshotCompletenessState,
        provenanceState: candidate.provenanceState,
        ownership: candidate.ownership,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        figmaConnectionAuthorityState: candidate.figmaConnectionAuthorityState,
        credentialAuthorityState: candidate.credentialAuthorityState,
        permissionGrantState: candidate.permissionGrantState,
        figmaWriteAuthorityState: candidate.figmaWriteAuthorityState,
        externalCompletenessState: candidate.externalCompletenessState,
        designValidityState: candidate.designValidityState,
        designApprovalState: candidate.designApprovalState,
        designBaselineState: candidate.designBaselineState,
        readinessState: candidate.readinessState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Figma Read Snapshot ${candidate.id} membership digest is invalid`)
      }
      const applicability = exactDesignApplicability.get(
        `${candidate.designApplicability.recordId}:${candidate.designApplicability.revision}:${candidate.designApplicability.digest}`,
      )
      const designSystem = exactDesignSystemTokenContracts.get(
        `${candidate.designSystemTokenContract.recordId}:${candidate.designSystemTokenContract.revision}:${candidate.designSystemTokenContract.digest}`,
      )
      const discovery = exactFigmaMcpCapabilityDiscoveries.get(
        `${candidate.figmaMcpCapabilityDiscovery.recordId}:${candidate.figmaMcpCapabilityDiscovery.revision}:${candidate.figmaMcpCapabilityDiscovery.digest}`,
      )
      if (!applicability || applicability.initiativeId !== candidate.initiativeId ||
          applicability.membershipDigest !== candidate.designApplicability.membershipDigest ||
          !designSystem || designSystem.initiativeId !== candidate.initiativeId ||
          designSystem.membershipDigest !== candidate.designSystemTokenContract.membershipDigest ||
          !discovery || discovery.initiativeId !== candidate.initiativeId ||
          discovery.membershipDigest !== candidate.figmaMcpCapabilityDiscovery.membershipDigest) {
        throw new Error(`Import Figma Read Snapshot ${candidate.id} has an unresolved exact governed binding`)
      }
      const hasMaterialFigmaScope = applicability.scopes.some((scope) => {
        const figma = scope.decisions.find((decision) => decision.aspect === "figma")
        return figma && [
          "already-satisfied",
          "conditionally-required",
          "optional",
          "recommended",
          "required",
          "reused",
        ].includes(figma.status) && scope.designSource.modes.some((mode) => mode === "figma-design" || mode === "figma-make")
      })
      if (!hasMaterialFigmaScope) {
        throw new Error(`Import Figma Read Snapshot ${candidate.id} lacks exact material Figma applicability`)
      }
      const payloadDigest = canonicalDigest({
        files: candidate.files,
        components: candidate.components,
        variableCollections: candidate.variableCollections,
        variables: candidate.variables,
      })
      if (candidate.capture.payloadDigest !== payloadDigest) {
        throw new Error(`Import Figma Read Snapshot ${candidate.id} payload digest is invalid`)
      }
      const receiptDigest = canonicalDigest({
        mode: candidate.capture.mode,
        requestedToolKeys: candidate.capture.requestedToolKeys,
        readEffectState: candidate.capture.readEffectState,
        payloadDigest: candidate.capture.payloadDigest,
        capturedAt: candidate.capture.capturedAt,
        evidence: candidate.capture.evidence,
        sources: candidate.capture.sources,
      })
      if (candidate.capture.receiptDigest !== receiptDigest) {
        throw new Error(`Import Figma Read Snapshot ${candidate.id} capture receipt digest is invalid`)
      }
      if (candidate.capture.mode !== "figma-mcp-read-receipt" && candidate.capture.requestedToolKeys.length > 0) {
        throw new Error(`Import Figma Read Snapshot ${candidate.id} binds tool keys outside an MCP read receipt`)
      }
      if (candidate.capture.mode === "figma-mcp-read-receipt") {
        const tools = new Map(discovery.tools.map((tool) => [tool.key, tool]))
        const observedCapabilities = new Set<string>()
        for (const key of candidate.capture.requestedToolKeys) {
          const tool = tools.get(key)
          if (!tool || tool.availabilityState !== "advertised" || tool.effectClass !== "figma-read" ||
              !["read-content", "read-metadata", "read-variables"].includes(tool.capabilityClass) ||
              tool.permissions.some((permission) => permission.accessClass === "write")) {
            throw new Error(`Import Figma Read Snapshot ${candidate.id} binds a non-read or write-permission tool`)
          }
          observedCapabilities.add(tool.capabilityClass)
        }
        const requiredCapabilities = new Set(["read-metadata"])
        if (candidate.components.length > 0) requiredCapabilities.add("read-content")
        if (candidate.variableCollections.length > 0 || candidate.variables.length > 0) requiredCapabilities.add("read-variables")
        if ([...requiredCapabilities].some((capability) => !observedCapabilities.has(capability))) {
          throw new Error(`Import Figma Read Snapshot ${candidate.id} lacks exact read capability coverage`)
        }
      }
      const fileByKey = new Map(candidate.files.map((file) => [file.key, file]))
      for (const item of [...candidate.components, ...candidate.variableCollections, ...candidate.variables]) {
        const file = fileByKey.get(item.fileKey)
        if (!file || item.provenance.externalVersion !== file.provenance.externalVersion ||
            item.provenance.observedAt !== file.provenance.observedAt) {
          throw new Error(`Import Figma Read Snapshot ${candidate.id} child observation does not bind its exact file version`)
        }
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

    const figmaContextImports = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("figma-context-imports/"))
      .map(([, record]) => figmaContextImportSchema.parse(record))
    const figmaContextImportHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("figma-context-import-history/"))
      .map(([, record]) => figmaContextImportSchema.parse(record))
    const exactFigmaContextImports = validateVersionedBusinessRecords(
      figmaContextImports,
      figmaContextImportHistory,
      "Figma Context Import",
    )
    const contextPackByExact = new Map(contextPacks.map((pack) => [
      `${pack.id}:${pack.revision}:${canonicalDigest(pack)}:${pack.packDigest}`,
      pack,
    ]))
    const classificationRank = { public: 0, internal: 1, confidential: 2, restricted: 3 } as const
    for (const candidate of [...figmaContextImports, ...figmaContextImportHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        designApplicability: candidate.designApplicability,
        designRequirements: candidate.designRequirements,
        designSystemTokenContract: candidate.designSystemTokenContract,
        accessibilityDesignRules: candidate.accessibilityDesignRules,
        responsiveMultiPlatformTargets: candidate.responsiveMultiPlatformTargets,
        manualFigmaExecutionPath: candidate.manualFigmaExecutionPath,
        figmaMcpCapabilityDiscovery: candidate.figmaMcpCapabilityDiscovery,
        figmaReadSnapshot: candidate.figmaReadSnapshot,
        contextPacks: candidate.contextPacks,
        sections: candidate.sections,
        targets: candidate.targets,
        requirementCoverage: candidate.requirementCoverage,
        preview: candidate.preview,
        contextSelectionState: candidate.contextSelectionState,
        provenanceState: candidate.provenanceState,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        packagePreparationState: candidate.packagePreparationState,
        contextTransferState: candidate.contextTransferState,
        figmaConnectionAuthorityState: candidate.figmaConnectionAuthorityState,
        credentialAuthorityState: candidate.credentialAuthorityState,
        permissionGrantState: candidate.permissionGrantState,
        figmaWriteAuthorityState: candidate.figmaWriteAuthorityState,
        targetValidityState: candidate.targetValidityState,
        externalCompletenessState: candidate.externalCompletenessState,
        designValidityState: candidate.designValidityState,
        designApprovalState: candidate.designApprovalState,
        designBaselineState: candidate.designBaselineState,
        readinessState: candidate.readinessState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Figma Context Import ${candidate.id} membership digest is invalid`)
      }
      const applicability = exactDesignApplicability.get(
        `${candidate.designApplicability.recordId}:${candidate.designApplicability.revision}:${candidate.designApplicability.digest}`,
      )
      const requirements = exactDesignRequirements.get(
        `${candidate.designRequirements.recordId}:${candidate.designRequirements.revision}:${candidate.designRequirements.digest}`,
      )
      const designSystem = exactDesignSystemTokenContracts.get(
        `${candidate.designSystemTokenContract.recordId}:${candidate.designSystemTokenContract.revision}:${candidate.designSystemTokenContract.digest}`,
      )
      const accessibility = exactAccessibilityDesignRules.get(
        `${candidate.accessibilityDesignRules.recordId}:${candidate.accessibilityDesignRules.revision}:${candidate.accessibilityDesignRules.digest}`,
      )
      const responsive = exactResponsiveMultiPlatformTargets.get(
        `${candidate.responsiveMultiPlatformTargets.recordId}:${candidate.responsiveMultiPlatformTargets.revision}:${candidate.responsiveMultiPlatformTargets.digest}`,
      )
      const manualPath = exactManualFigmaExecutionPaths.get(
        `${candidate.manualFigmaExecutionPath.recordId}:${candidate.manualFigmaExecutionPath.revision}:${candidate.manualFigmaExecutionPath.digest}`,
      )
      const discovery = exactFigmaMcpCapabilityDiscoveries.get(
        `${candidate.figmaMcpCapabilityDiscovery.recordId}:${candidate.figmaMcpCapabilityDiscovery.revision}:${candidate.figmaMcpCapabilityDiscovery.digest}`,
      )
      const snapshot = exactFigmaReadSnapshots.get(
        `${candidate.figmaReadSnapshot.recordId}:${candidate.figmaReadSnapshot.revision}:${candidate.figmaReadSnapshot.digest}`,
      )
      const exactBindings = [
        [applicability, candidate.designApplicability],
        [requirements, candidate.designRequirements],
        [designSystem, candidate.designSystemTokenContract],
        [accessibility, candidate.accessibilityDesignRules],
        [responsive, candidate.responsiveMultiPlatformTargets],
        [manualPath, candidate.manualFigmaExecutionPath],
        [discovery, candidate.figmaMcpCapabilityDiscovery],
        [snapshot, candidate.figmaReadSnapshot],
      ] as const
      if (exactBindings.some(([record, reference]) => !record || record.initiativeId !== candidate.initiativeId ||
          record.membershipDigest !== reference.membershipDigest)) {
        throw new Error(`Import Figma Context Import ${candidate.id} has an unresolved exact governed binding`)
      }
      const packs = candidate.contextPacks.map((reference) => contextPackByExact.get(
        `${reference.recordId}:${reference.revision}:${reference.digest}:${reference.packDigest}`,
      ))
      if (packs.some((pack) => !pack || pack.productId !== candidate.productId)) {
        throw new Error(`Import Figma Context Import ${candidate.id} has an unresolved exact Context Pack binding`)
      }
      const exactPacks = packs as ContextPack[]
      if (exactPacks.some((pack) => pack.recipient.kind !== "tool" || pack.recipient.id !== discovery!.adapter.key)) {
        throw new Error(`Import Figma Context Import ${candidate.id} Context Pack recipient does not match the exact Figma adapter`)
      }
      const packById = new Map(exactPacks.map((pack) => [pack.id, pack]))
      const selectedItemIds = new Set<string>()
      for (const section of candidate.sections) {
        const pack = packById.get(section.contextPackId)
        if (!pack) throw new Error(`Import Figma Context Import ${candidate.id} section has no exact Context Pack`)
        const itemById = new Map(pack.items.map((item) => [item.id, item]))
        const selected = section.contextItemIds.map((id) => itemById.get(id))
        if (selected.some((item) => !item)) {
          throw new Error(`Import Figma Context Import ${candidate.id} section contains an unknown Context Item`)
        }
        for (const id of section.contextItemIds) selectedItemIds.add(id)
        const exactItems = selected as ContextPack["items"]
        if (section.contentDigest !== canonicalDigest(exactItems.map((item) => ({ id: item.id, contentDigest: item.contentDigest }))) ||
            section.transformationDigest !== canonicalDigest(exactItems.map((item) => ({ id: item.id, transformations: item.transformations })))) {
          throw new Error(`Import Figma Context Import ${candidate.id} section digest is invalid`)
        }
        if (section.informationClassification !== pack.classification.level) {
          throw new Error(`Import Figma Context Import ${candidate.id} section classification is invalid`)
        }
      }
      const allItems = exactPacks.flatMap((pack) => pack.items)
      if (candidate.contextSelectionState === "candidate-selection-complete" &&
          (selectedItemIds.size !== allItems.length || allItems.some((item) => !selectedItemIds.has(item.id)) ||
           exactPacks.some((pack) => pack.sufficiency.status === "insufficient" ||
             pack.omissions.some((omission) => omission.required || omission.material) ||
             pack.conflicts.some((conflict) => conflict.state === "open")))) {
        throw new Error(`Import Figma Context Import ${candidate.id} candidate-complete selection is incomplete or contradicted`)
      }
      const maximumClassification = exactPacks.reduce<keyof typeof classificationRank>((maximum, pack) =>
        classificationRank[pack.classification.level] > classificationRank[maximum] ? pack.classification.level : maximum,
      "public")
      if (candidate.informationClassification !== maximumClassification) {
        throw new Error(`Import Figma Context Import ${candidate.id} aggregate classification is invalid`)
      }
      const requirementKeys = new Set(requirements!.requirements.map((requirement) => requirement.key))
      const coveredKeys = new Set(candidate.requirementCoverage.map((coverage) => coverage.requirementKey))
      if (requirementKeys.size !== coveredKeys.size || [...requirementKeys].some((key) => !coveredKeys.has(key))) {
        throw new Error(`Import Figma Context Import ${candidate.id} Design Requirement coverage is incomplete`)
      }
      const fileByKey = new Map(snapshot!.files.map((file) => [file.key, file]))
      const toolByKey = new Map(discovery!.tools.map((tool) => [tool.key, tool]))
      for (const target of candidate.targets) {
        const file = fileByKey.get(target.fileKey)
        if (!file || target.externalFileIdentityDigest !== canonicalDigest(file.provenance.externalObjectId) ||
            target.externalVersionDigest !== canonicalDigest(file.provenance.externalVersion)) {
          throw new Error(`Import Figma Context Import ${candidate.id} Figma target identity or version is invalid`)
        }
        const tool = toolByKey.get(target.plannedWriteToolKey)
        if (!tool || tool.availabilityState !== "advertised" || tool.capabilityClass !== "write-design" ||
            tool.effectClass !== "figma-write" || !tool.permissions.some((permission) =>
              permission.accessClass === "write" && permission.requirementState === "required" && permission.grantState === "not-granted")) {
          throw new Error(`Import Figma Context Import ${candidate.id} planned write tool binding is invalid`)
        }
      }
      const selectionReceipt = {
        designApplicability: candidate.designApplicability,
        designRequirements: candidate.designRequirements,
        designSystemTokenContract: candidate.designSystemTokenContract,
        accessibilityDesignRules: candidate.accessibilityDesignRules,
        responsiveMultiPlatformTargets: candidate.responsiveMultiPlatformTargets,
        manualFigmaExecutionPath: candidate.manualFigmaExecutionPath,
        figmaMcpCapabilityDiscovery: candidate.figmaMcpCapabilityDiscovery,
        figmaReadSnapshot: candidate.figmaReadSnapshot,
        contextPacks: candidate.contextPacks,
        sections: candidate.sections,
        targets: candidate.targets,
        requirementCoverage: candidate.requirementCoverage,
      }
      if (candidate.preview.selectionDigest !== canonicalDigest(selectionReceipt)) {
        throw new Error(`Import Figma Context Import ${candidate.id} selection digest is invalid`)
      }
      const previewReceipt = {
        selectionDigest: candidate.preview.selectionDigest,
        title: candidate.title,
        informationClassification: candidate.informationClassification,
        contextPackCount: candidate.contextPacks.length,
        sectionCount: candidate.sections.length,
        contextItemCount: candidate.sections.reduce((total, section) => total + section.contextItemIds.length, 0),
        targetCount: candidate.targets.length,
        requirementCoverageCount: candidate.requirementCoverage.length,
        limitations: candidate.limitations,
      }
      if (candidate.preview.previewDigest !== undefined && candidate.preview.previewDigest !== canonicalDigest(previewReceipt)) {
        throw new Error(`Import Figma Context Import ${candidate.id} preview digest is invalid`)
      }
    }

    const outboundDesignBriefPackages = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("outbound-design-brief-packages/"))
      .map(([, record]) => outboundDesignBriefPackageSchema.parse(record))
    const outboundDesignBriefPackageHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("outbound-design-brief-package-history/"))
      .map(([, record]) => outboundDesignBriefPackageSchema.parse(record))
    validateVersionedBusinessRecords(
      outboundDesignBriefPackages,
      outboundDesignBriefPackageHistory,
      "Outbound Design Brief Package",
    )
    for (const candidate of [...outboundDesignBriefPackages, ...outboundDesignBriefPackageHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        objectiveDigest: candidate.objectiveDigest,
        figmaContextImport: candidate.figmaContextImport,
        contextPacks: candidate.contextPacks,
        manifestFormat: candidate.manifestFormat,
        manifestDigest: candidate.manifestDigest,
        payloadDigest: candidate.payloadDigest,
        entries: candidate.entries,
        recipients: candidate.recipients,
        requirementCoverage: candidate.requirementCoverage,
        disclosures: candidate.disclosures,
        manifestState: candidate.manifestState,
        provenanceState: candidate.provenanceState,
        redactionReviewState: candidate.redactionReviewState,
        preview: candidate.preview,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        packageMaterializationState: candidate.packageMaterializationState,
        contextTransferState: candidate.contextTransferState,
        figmaConnectionAuthorityState: candidate.figmaConnectionAuthorityState,
        credentialAuthorityState: candidate.credentialAuthorityState,
        permissionGrantState: candidate.permissionGrantState,
        figmaWriteAuthorityState: candidate.figmaWriteAuthorityState,
        targetValidityState: candidate.targetValidityState,
        externalCompletenessState: candidate.externalCompletenessState,
        designValidityState: candidate.designValidityState,
        designApprovalState: candidate.designApprovalState,
        designBaselineState: candidate.designBaselineState,
        readinessState: candidate.readinessState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Outbound Design Brief Package ${candidate.id} membership digest is invalid`)
      }
      const contextImport = exactFigmaContextImports.get(
        `${candidate.figmaContextImport.recordId}:${candidate.figmaContextImport.revision}:${candidate.figmaContextImport.digest}`,
      )
      if (!contextImport || contextImport.initiativeId !== candidate.initiativeId ||
          contextImport.membershipDigest !== candidate.figmaContextImport.membershipDigest) {
        throw new Error(`Import Outbound Design Brief Package ${candidate.id} has an unresolved exact Figma Context Import binding`)
      }
      const packs = candidate.contextPacks.map((reference) => contextPackByExact.get(
        `${reference.recordId}:${reference.revision}:${reference.digest}:${reference.packDigest}`,
      ))
      if (packs.some((pack) => !pack || pack.productId !== candidate.productId) ||
          canonicalDigest(candidate.contextPacks) !== canonicalDigest(contextImport.contextPacks)) {
        throw new Error(`Import Outbound Design Brief Package ${candidate.id} has an unresolved exact Context Pack catalog`)
      }
      const exactPacks = packs as ContextPack[]
      const sectionByKey = new Map(contextImport.sections.map((section) => [section.key, section]))
      const entryBySectionKey = new Map(candidate.entries.map((entry) => [entry.sourceSectionKey, entry]))
      for (const entry of candidate.entries) {
        const section = sectionByKey.get(entry.sourceSectionKey)
        const pack = exactPacks.find((record) => record.id === entry.contextPackId)
        if (!section || !pack || section.kind !== entry.kind || section.contextPackId !== entry.contextPackId ||
            canonicalDigest(section.contextItemIds) !== canonicalDigest(entry.contextItemIds) ||
            section.contentDigest !== entry.contentDigest || section.transformationDigest !== entry.transformationDigest ||
            section.informationClassification !== entry.informationClassification || section.redactionState !== entry.redactionState ||
            canonicalDigest(section.sources) !== canonicalDigest(entry.sources) ||
            entry.contextItemIds.some((id) => !pack.items.some((item) => item.id === id))) {
          throw new Error(`Import Outbound Design Brief Package ${candidate.id} entry does not preserve its exact selected section`)
        }
        if (entry.selectionReasonDigest !== canonicalDigest({
          objectiveDigest: candidate.objectiveDigest,
          sourceSectionKey: entry.sourceSectionKey,
          requirementKeys: entry.requirementKeys,
          recipientKeys: entry.recipientKeys,
        })) throw new Error(`Import Outbound Design Brief Package ${candidate.id} entry selection receipt is invalid`)
      }
      if (candidate.manifestState === "candidate-complete" &&
          (entryBySectionKey.size !== contextImport.sections.length ||
           contextImport.sections.some((section) => !entryBySectionKey.has(section.key)))) {
        throw new Error(`Import Outbound Design Brief Package ${candidate.id} omits a selected context section`)
      }
      const targetByKey = new Map(contextImport.targets.map((target) => [target.key, target]))
      const recipientByTargetKey = new Map(candidate.recipients.map((recipient) => [recipient.sourceTargetKey, recipient]))
      for (const recipient of candidate.recipients) {
        const target = targetByKey.get(recipient.sourceTargetKey)
        if (!target) throw new Error(`Import Outbound Design Brief Package ${candidate.id} recipient has no exact target`)
        const expectedEntryKeys = target.sectionKeys.map((key) => entryBySectionKey.get(key)?.key)
        if (expectedEntryKeys.some((key) => key === undefined) || target.designScopeKey !== recipient.designScopeKey ||
            target.fileKey !== recipient.fileKey || target.externalFileIdentityDigest !== recipient.externalFileIdentityDigest ||
            target.externalVersionDigest !== recipient.externalVersionDigest ||
            target.plannedWriteToolKey !== recipient.plannedWriteToolKey || target.expectedEffect !== recipient.expectedEffect ||
            target.permissionRequirementState !== recipient.permissionRequirementState ||
            canonicalDigest(expectedEntryKeys) !== canonicalDigest(recipient.entryKeys) ||
            canonicalDigest(target.sources) !== canonicalDigest(recipient.sources) ||
            recipient.purposeDigest !== canonicalDigest({
              objectiveDigest: candidate.objectiveDigest,
              sourceTargetKey: recipient.sourceTargetKey,
              entryKeys: recipient.entryKeys,
            })) {
          throw new Error(`Import Outbound Design Brief Package ${candidate.id} recipient binding is invalid`)
        }
      }
      if (candidate.manifestState === "candidate-complete" &&
          (recipientByTargetKey.size !== contextImport.targets.length ||
           contextImport.targets.some((target) => !recipientByTargetKey.has(target.key)))) {
        throw new Error(`Import Outbound Design Brief Package ${candidate.id} omits a selected Figma target`)
      }
      const coverageByRequirement = new Map(contextImport.requirementCoverage.map((coverage) => [coverage.requirementKey, coverage]))
      for (const coverage of candidate.requirementCoverage) {
        const imported = coverageByRequirement.get(coverage.requirementKey)
        if (!imported) throw new Error(`Import Outbound Design Brief Package ${candidate.id} coverage has no exact Requirement`)
        const expectedEntryKeys = imported.sectionKeys.map((key) => entryBySectionKey.get(key)?.key)
        const expectedRecipientKeys = imported.targetKeys.map((key) => recipientByTargetKey.get(key)?.key)
        if (expectedEntryKeys.some((key) => key === undefined) || expectedRecipientKeys.some((key) => key === undefined) ||
            imported.state !== coverage.state || imported.rationaleDigest !== coverage.rationaleDigest ||
            canonicalDigest(expectedEntryKeys) !== canonicalDigest(coverage.entryKeys) ||
            canonicalDigest(expectedRecipientKeys) !== canonicalDigest(coverage.recipientKeys) ||
            canonicalDigest(imported.sources) !== canonicalDigest(coverage.sources)) {
          throw new Error(`Import Outbound Design Brief Package ${candidate.id} Requirement coverage is invalid`)
        }
      }
      if (candidate.requirementCoverage.length !== contextImport.requirementCoverage.length) {
        throw new Error(`Import Outbound Design Brief Package ${candidate.id} Requirement coverage is incomplete`)
      }
      const maximumClassification = exactPacks.reduce<keyof typeof classificationRank>((maximum, pack) =>
        classificationRank[pack.classification.level] > classificationRank[maximum] ? pack.classification.level : maximum,
      "public")
      if (candidate.informationClassification !== maximumClassification) {
        throw new Error(`Import Outbound Design Brief Package ${candidate.id} aggregate classification is invalid`)
      }
      const manifestReceipt = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        objectiveDigest: candidate.objectiveDigest,
        figmaContextImport: candidate.figmaContextImport,
        contextPacks: candidate.contextPacks,
        manifestFormat: candidate.manifestFormat,
        entries: candidate.entries,
        recipients: candidate.recipients,
        requirementCoverage: candidate.requirementCoverage,
        disclosures: candidate.disclosures,
      }
      const payloadReceipt = {
        entries: candidate.entries.map((entry) => ({
          key: entry.key, sourceSectionKey: entry.sourceSectionKey, contextPackId: entry.contextPackId,
          contextItemIds: entry.contextItemIds, contentDigest: entry.contentDigest,
          transformationDigest: entry.transformationDigest, selectionReasonDigest: entry.selectionReasonDigest,
          informationClassification: entry.informationClassification, redactionState: entry.redactionState,
          requirementKeys: entry.requirementKeys, recipientKeys: entry.recipientKeys,
        })),
        recipients: candidate.recipients.map((recipient) => ({
          key: recipient.key, sourceTargetKey: recipient.sourceTargetKey,
          externalFileIdentityDigest: recipient.externalFileIdentityDigest,
          externalVersionDigest: recipient.externalVersionDigest, entryKeys: recipient.entryKeys,
          purposeDigest: recipient.purposeDigest, policyBasisDigest: recipient.policyBasisDigest,
          retentionRuleDigest: recipient.retentionRuleDigest,
        })),
        requirementCoverage: candidate.requirementCoverage.map((coverage) => ({
          requirementKey: coverage.requirementKey, state: coverage.state, entryKeys: coverage.entryKeys,
          recipientKeys: coverage.recipientKeys, rationaleDigest: coverage.rationaleDigest,
        })),
        disclosures: candidate.disclosures.map((disclosure) => ({
          key: disclosure.key, kind: disclosure.kind, materiality: disclosure.materiality, state: disclosure.state,
          subjectDigest: disclosure.subjectDigest, rationaleDigest: disclosure.rationaleDigest,
        })),
      }
      if (candidate.manifestDigest !== canonicalDigest(manifestReceipt) ||
          candidate.payloadDigest !== canonicalDigest(payloadReceipt) ||
          candidate.preview.manifestDigest !== candidate.manifestDigest ||
          candidate.preview.payloadDigest !== candidate.payloadDigest) {
        throw new Error(`Import Outbound Design Brief Package ${candidate.id} manifest or payload receipt is invalid`)
      }
      const previewReceipt = {
        manifestDigest: candidate.manifestDigest,
        payloadDigest: candidate.payloadDigest,
        title: candidate.title,
        informationClassification: candidate.informationClassification,
        contextPackCount: candidate.contextPacks.length,
        entryCount: candidate.entries.length,
        contextItemCount: candidate.entries.reduce((total, entry) => total + entry.contextItemIds.length, 0),
        recipientCount: candidate.recipients.length,
        representedRequirementCount: candidate.requirementCoverage.filter((coverage) => coverage.state === "represented").length,
        unresolvedDisclosureCount: candidate.disclosures.filter((disclosure) => disclosure.state === "unresolved").length,
        limitations: candidate.limitations,
      }
      if (candidate.preview.previewDigest !== undefined && candidate.preview.previewDigest !== canonicalDigest(previewReceipt)) {
        throw new Error(`Import Outbound Design Brief Package ${candidate.id} preview receipt is invalid`)
      }
    }

    const governedFigmaWrites = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("governed-figma-writes/"))
      .map(([, record]) => governedFigmaWriteSchema.parse(record))
    const governedFigmaWriteHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("governed-figma-write-history/"))
      .map(([, record]) => governedFigmaWriteSchema.parse(record))
    validateVersionedBusinessRecords(governedFigmaWrites, governedFigmaWriteHistory, "Governed Figma Write")
    const outboundPackageByExact = new Map(
      [...outboundDesignBriefPackages, ...outboundDesignBriefPackageHistory].map((record) => [
        `${record.id}:${record.revision}:${canonicalDigest(record)}`,
        record,
      ]),
    )
    for (const candidate of [...governedFigmaWrites, ...governedFigmaWriteHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        objectiveDigest: candidate.objectiveDigest,
        outboundPackage: candidate.outboundPackage,
        target: candidate.target,
        requestFormat: candidate.requestFormat,
        requestDigest: candidate.requestDigest,
        effectDigest: candidate.effectDigest,
        preview: candidate.preview,
        approval: candidate.approval,
        permissionEvidence: candidate.permissionEvidence,
        idempotency: candidate.idempotency,
        recoveryPlan: candidate.recoveryPlan,
        disclosures: candidate.disclosures,
        sources: candidate.sources,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        writePlanState: candidate.writePlanState,
        packageMaterializationState: candidate.packageMaterializationState,
        contextTransferState: candidate.contextTransferState,
        figmaConnectionAuthorityState: candidate.figmaConnectionAuthorityState,
        credentialAuthorityState: candidate.credentialAuthorityState,
        permissionGrantState: candidate.permissionGrantState,
        figmaWriteAuthorityState: candidate.figmaWriteAuthorityState,
        writeExecutionState: candidate.writeExecutionState,
        writeResultState: candidate.writeResultState,
        externalVersionValidationState: candidate.externalVersionValidationState,
        targetValidityState: candidate.targetValidityState,
        designValidityState: candidate.designValidityState,
        designApprovalState: candidate.designApprovalState,
        designBaselineState: candidate.designBaselineState,
        readinessState: candidate.readinessState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Governed Figma Write ${candidate.id} membership digest is invalid`)
      }
      const outboundPackage = outboundPackageByExact.get(
        `${candidate.outboundPackage.recordId}:${candidate.outboundPackage.revision}:${candidate.outboundPackage.digest}`,
      )
      if (!outboundPackage || outboundPackage.productId !== candidate.productId ||
          outboundPackage.initiativeId !== candidate.initiativeId ||
          outboundPackage.membershipDigest !== candidate.outboundPackage.membershipDigest ||
          outboundPackage.manifestDigest !== candidate.outboundPackage.manifestDigest ||
          outboundPackage.payloadDigest !== candidate.outboundPackage.payloadDigest) {
        throw new Error(`Import Governed Figma Write ${candidate.id} has an unresolved exact Outbound Design Brief Package binding`)
      }
      if (candidate.informationClassification !== outboundPackage.informationClassification) {
        throw new Error(`Import Governed Figma Write ${candidate.id} classification does not preserve its exact outbound package`)
      }
      const recipient = outboundPackage.recipients.find((entry) => entry.key === candidate.target.recipientKey)
      if (!recipient || candidate.target.sourceTargetKey !== recipient.sourceTargetKey ||
          candidate.target.designScopeKey !== recipient.designScopeKey || candidate.target.fileKey !== recipient.fileKey ||
          candidate.target.targetKind !== recipient.targetKind ||
          candidate.target.externalFileIdentityDigest !== recipient.externalFileIdentityDigest ||
          candidate.target.expectedExternalVersionDigest !== recipient.externalVersionDigest ||
          candidate.target.plannedWriteToolKey !== recipient.plannedWriteToolKey ||
          candidate.target.intendedEffect !== "figma-write" || recipient.expectedEffect !== "write" ||
          canonicalDigest(candidate.target.selectedEntryKeys) !== canonicalDigest(recipient.entryKeys) ||
          canonicalDigest(candidate.target.sources) !== canonicalDigest(recipient.sources)) {
        throw new Error(`Import Governed Figma Write ${candidate.id} target does not preserve its exact outbound recipient`)
      }
      const requestReceipt = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        objectiveDigest: candidate.objectiveDigest,
        outboundPackage: candidate.outboundPackage,
        target: {
          recipientKey: candidate.target.recipientKey,
          sourceTargetKey: candidate.target.sourceTargetKey,
          designScopeKey: candidate.target.designScopeKey,
          fileKey: candidate.target.fileKey,
          targetKind: candidate.target.targetKind,
          externalFileIdentityDigest: candidate.target.externalFileIdentityDigest,
          expectedExternalVersionDigest: candidate.target.expectedExternalVersionDigest,
          plannedWriteToolKey: candidate.target.plannedWriteToolKey,
          selectedEntryKeys: candidate.target.selectedEntryKeys,
          intendedEffect: candidate.target.intendedEffect,
        },
        requestFormat: candidate.requestFormat,
      }
      if (candidate.requestDigest !== canonicalDigest(requestReceipt)) {
        throw new Error(`Import Governed Figma Write ${candidate.id} request receipt is invalid`)
      }
      const expectedIdempotencyScopeDigest = canonicalDigest({
        outboundPackage: candidate.outboundPackage,
        recipientKey: candidate.target.recipientKey,
        externalFileIdentityDigest: candidate.target.externalFileIdentityDigest,
        expectedExternalVersionDigest: candidate.target.expectedExternalVersionDigest,
      })
      if (candidate.idempotency.scopeDigest !== expectedIdempotencyScopeDigest ||
          candidate.idempotency.keyDigest !== canonicalDigest({
            scopeDigest: expectedIdempotencyScopeDigest,
            requestDigest: candidate.requestDigest,
          })) {
        throw new Error(`Import Governed Figma Write ${candidate.id} idempotency receipt is invalid`)
      }
      const effectReceipt = {
        requestDigest: candidate.requestDigest,
        packageManifestDigest: candidate.outboundPackage.manifestDigest,
        packagePayloadDigest: candidate.outboundPackage.payloadDigest,
        externalFileIdentityDigest: candidate.target.externalFileIdentityDigest,
        expectedExternalVersionDigest: candidate.target.expectedExternalVersionDigest,
        plannedWriteToolKey: candidate.target.plannedWriteToolKey,
        selectedEntryKeys: candidate.target.selectedEntryKeys,
        intendedEffect: candidate.target.intendedEffect,
        idempotencyKeyDigest: candidate.idempotency.keyDigest,
        idempotencyScopeDigest: candidate.idempotency.scopeDigest,
      }
      if (candidate.effectDigest !== canonicalDigest(effectReceipt)) {
        throw new Error(`Import Governed Figma Write ${candidate.id} effect receipt is invalid`)
      }
      const previewReceipt = {
        packageManifestDigest: candidate.outboundPackage.manifestDigest,
        packagePayloadDigest: candidate.outboundPackage.payloadDigest,
        requestDigest: candidate.requestDigest,
        effectDigest: candidate.effectDigest,
        title: candidate.title,
        informationClassification: candidate.informationClassification,
        externalFileIdentityDigest: candidate.target.externalFileIdentityDigest,
        expectedExternalVersionDigest: candidate.target.expectedExternalVersionDigest,
        selectedEntryCount: candidate.target.selectedEntryKeys.length,
        approvalState: candidate.approval.state,
        permissionEvidenceState: candidate.permissionEvidence.state,
        idempotencyState: candidate.idempotency.state,
        recoveryPlanState: candidate.recoveryPlan.state,
        limitations: candidate.limitations,
      }
      if (candidate.preview.packageManifestDigest !== candidate.outboundPackage.manifestDigest ||
          candidate.preview.packagePayloadDigest !== candidate.outboundPackage.payloadDigest ||
          candidate.preview.requestDigest !== candidate.requestDigest || candidate.preview.effectDigest !== candidate.effectDigest ||
          (candidate.preview.previewDigest !== undefined && candidate.preview.previewDigest !== canonicalDigest(previewReceipt))) {
        throw new Error(`Import Governed Figma Write ${candidate.id} preview receipt is invalid`)
      }
      if (["granted", "declined", "expired", "revoked"].includes(candidate.approval.state)) {
        const expectedApprovalScopeDigest = canonicalDigest({
          requestDigest: candidate.requestDigest,
          effectDigest: candidate.effectDigest,
          outboundPackage: candidate.outboundPackage,
          target: {
            recipientKey: candidate.target.recipientKey,
            externalFileIdentityDigest: candidate.target.externalFileIdentityDigest,
            expectedExternalVersionDigest: candidate.target.expectedExternalVersionDigest,
          },
          idempotencyKeyDigest: candidate.idempotency.keyDigest,
        })
        if (candidate.approval.scopeDigest !== expectedApprovalScopeDigest) {
          throw new Error(`Import Governed Figma Write ${candidate.id} approval scope receipt is invalid`)
        }
      }
      if (candidate.permissionEvidence.state === "verified") {
        const expectedPermissionDigest = canonicalDigest({
          plannedWriteToolKey: candidate.target.plannedWriteToolKey,
          externalFileIdentityDigest: candidate.target.externalFileIdentityDigest,
          permissionKeys: candidate.permissionEvidence.permissionKeys,
          evidenceDigests: candidate.permissionEvidence.evidenceDigests,
        })
        if (candidate.permissionEvidence.verificationDigest !== expectedPermissionDigest) {
          throw new Error(`Import Governed Figma Write ${candidate.id} permission verification receipt is invalid`)
        }
      }
    }

    const finalizedFigmaSnapshotImports = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("finalized-figma-snapshot-imports/"))
      .map(([, record]) => finalizedFigmaSnapshotImportSchema.parse(record))
    const finalizedFigmaSnapshotImportHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("finalized-figma-snapshot-import-history/"))
      .map(([, record]) => finalizedFigmaSnapshotImportSchema.parse(record))
    validateVersionedBusinessRecords(
      finalizedFigmaSnapshotImports,
      finalizedFigmaSnapshotImportHistory,
      "Finalized Figma Snapshot Import",
    )
    const governedFigmaWriteByExact = new Map(
      [...governedFigmaWrites, ...governedFigmaWriteHistory].map((record) => [
        `${record.id}:${record.revision}:${canonicalDigest(record)}`,
        record,
      ]),
    )
    for (const candidate of [...finalizedFigmaSnapshotImports, ...finalizedFigmaSnapshotImportHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        objectiveDigest: candidate.objectiveDigest,
        governedWrite: candidate.governedWrite,
        returnReceipt: candidate.returnReceipt,
        returnAuthorization: candidate.returnAuthorization,
        items: candidate.items,
        conflicts: candidate.conflicts,
        reconciliationDigest: candidate.reconciliationDigest,
        reconciliationState: candidate.reconciliationState,
        provenanceState: candidate.provenanceState,
        snapshotCompletenessState: candidate.snapshotCompletenessState,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        inboundTransferState: candidate.inboundTransferState,
        importExecutionState: candidate.importExecutionState,
        importResultState: candidate.importResultState,
        figmaConnectionAuthorityState: candidate.figmaConnectionAuthorityState,
        credentialAuthorityState: candidate.credentialAuthorityState,
        permissionGrantState: candidate.permissionGrantState,
        externalCompletenessState: candidate.externalCompletenessState,
        targetValidityState: candidate.targetValidityState,
        designValidityState: candidate.designValidityState,
        designApprovalState: candidate.designApprovalState,
        designBaselineState: candidate.designBaselineState,
        readinessState: candidate.readinessState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Finalized Figma Snapshot Import ${candidate.id} membership digest is invalid`)
      }
      const governedWrite = governedFigmaWriteByExact.get(
        `${candidate.governedWrite.recordId}:${candidate.governedWrite.revision}:${candidate.governedWrite.digest}`,
      )
      if (!governedWrite || governedWrite.productId !== candidate.productId ||
          governedWrite.initiativeId !== candidate.initiativeId ||
          governedWrite.membershipDigest !== candidate.governedWrite.membershipDigest ||
          governedWrite.requestDigest !== candidate.governedWrite.requestDigest ||
          governedWrite.effectDigest !== candidate.governedWrite.effectDigest ||
          governedWrite.target.externalFileIdentityDigest !== candidate.governedWrite.externalFileIdentityDigest ||
          governedWrite.target.expectedExternalVersionDigest !== candidate.governedWrite.expectedExternalVersionDigest) {
        throw new Error(`Import Finalized Figma Snapshot Import ${candidate.id} has an unresolved exact Governed Figma Write binding`)
      }
      if (candidate.informationClassification !== governedWrite.informationClassification) {
        throw new Error(`Import Finalized Figma Snapshot Import ${candidate.id} classification does not preserve its exact governed write`)
      }
      const payloadReceipt = {
        governedWrite: candidate.governedWrite,
        externalFileIdentityDigest: candidate.returnReceipt.externalFileIdentityDigest,
        returnedExternalVersionDigest: candidate.returnReceipt.returnedExternalVersionDigest,
        items: candidate.items,
      }
      if (candidate.returnReceipt.payloadDigest !== canonicalDigest(payloadReceipt)) {
        throw new Error(`Import Finalized Figma Snapshot Import ${candidate.id} payload receipt is invalid`)
      }
      const returnReceipt = {
        mode: candidate.returnReceipt.mode,
        externalFileIdentityDigest: candidate.returnReceipt.externalFileIdentityDigest,
        returnedExternalVersionDigest: candidate.returnReceipt.returnedExternalVersionDigest,
        payloadDigest: candidate.returnReceipt.payloadDigest,
        capturedAt: candidate.returnReceipt.capturedAt,
        evidenceState: candidate.returnReceipt.evidenceState,
        evidenceDigests: candidate.returnReceipt.evidenceDigests,
        sources: candidate.returnReceipt.sources,
      }
      if (candidate.returnReceipt.receiptDigest !== canonicalDigest(returnReceipt)) {
        throw new Error(`Import Finalized Figma Snapshot Import ${candidate.id} return receipt is invalid`)
      }
      const reconciliationReceipt = {
        governedWrite: candidate.governedWrite,
        returnReceipt: {
          externalFileIdentityDigest: candidate.returnReceipt.externalFileIdentityDigest,
          returnedExternalVersionDigest: candidate.returnReceipt.returnedExternalVersionDigest,
          payloadDigest: candidate.returnReceipt.payloadDigest,
          receiptDigest: candidate.returnReceipt.receiptDigest,
        },
        itemCatalogDigest: canonicalDigest(candidate.items),
        conflictCatalogDigest: canonicalDigest(candidate.conflicts),
      }
      if (candidate.reconciliationDigest !== canonicalDigest(reconciliationReceipt)) {
        throw new Error(`Import Finalized Figma Snapshot Import ${candidate.id} reconciliation receipt is invalid`)
      }
      if (candidate.returnAuthorization.state === "verified") {
        const authorizationScopeReceipt = {
          governedWrite: candidate.governedWrite,
          returnReceiptDigest: candidate.returnReceipt.receiptDigest,
          reconciliationDigest: candidate.reconciliationDigest,
        }
        if (candidate.returnAuthorization.scopeDigest !== canonicalDigest(authorizationScopeReceipt)) {
          throw new Error(`Import Finalized Figma Snapshot Import ${candidate.id} authorization scope receipt is invalid`)
        }
      }
    }

    const designToRequirementBindings = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("design-to-requirement-bindings/"))
      .map(([, record]) => designToRequirementBindingSchema.parse(record))
    const designToRequirementBindingHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("design-to-requirement-binding-history/"))
      .map(([, record]) => designToRequirementBindingSchema.parse(record))
    validateVersionedBusinessRecords(
      designToRequirementBindings,
      designToRequirementBindingHistory,
      "Design-to-Requirement Binding",
    )
    const finalizedSnapshotByExact = new Map(
      [...finalizedFigmaSnapshotImports, ...finalizedFigmaSnapshotImportHistory].map((record) => [
        `${record.id}:${record.revision}:${canonicalDigest(record)}`,
        record,
      ]),
    )
    const designRequirementsByExact = new Map(
      [...designRequirements, ...designRequirementsHistory].map((record) => [
        `${record.id}:${record.revision}:${canonicalDigest(record)}`,
        record,
      ]),
    )
    const decisionRegisterByExact = new Map(
      [...decisionRegisters, ...decisionRegisterHistory].map((record) => [
        `${record.id}:${record.revision}:${canonicalDigest(record)}`,
        record,
      ]),
    )
    for (const candidate of [...designToRequirementBindings, ...designToRequirementBindingHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        objectiveDigest: candidate.objectiveDigest,
        finalizedSnapshot: candidate.finalizedSnapshot,
        designRequirements: candidate.designRequirements,
        decisionRegister: candidate.decisionRegister,
        bindings: candidate.bindings,
        designItemCoverage: candidate.designItemCoverage,
        subjectCoverage: candidate.subjectCoverage,
        conflicts: candidate.conflicts,
        reconciliationDigest: candidate.reconciliationDigest,
        reconciliationState: candidate.reconciliationState,
        candidateCoverageState: candidate.candidateCoverageState,
        provenanceState: candidate.provenanceState,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        relationshipTruthState: candidate.relationshipTruthState,
        coverageCompletenessState: candidate.coverageCompletenessState,
        requirementSatisfactionState: candidate.requirementSatisfactionState,
        decisionEffectivenessState: candidate.decisionEffectivenessState,
        externalCompletenessState: candidate.externalCompletenessState,
        designValidityState: candidate.designValidityState,
        designApprovalState: candidate.designApprovalState,
        designBaselineState: candidate.designBaselineState,
        readinessState: candidate.readinessState,
        figmaConnectionAuthorityState: candidate.figmaConnectionAuthorityState,
        credentialAuthorityState: candidate.credentialAuthorityState,
        permissionGrantState: candidate.permissionGrantState,
        importExecutionState: candidate.importExecutionState,
        writeExecutionState: candidate.writeExecutionState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Design-to-Requirement Binding ${candidate.id} membership digest is invalid`)
      }
      const finalizedSnapshot = finalizedSnapshotByExact.get(
        `${candidate.finalizedSnapshot.recordId}:${candidate.finalizedSnapshot.revision}:${candidate.finalizedSnapshot.digest}`,
      )
      if (!finalizedSnapshot || finalizedSnapshot.productId !== candidate.productId ||
          finalizedSnapshot.initiativeId !== candidate.initiativeId ||
          finalizedSnapshot.membershipDigest !== candidate.finalizedSnapshot.membershipDigest ||
          canonicalDigest(finalizedSnapshot.items) !== candidate.finalizedSnapshot.itemCatalogDigest) {
        throw new Error(`Import Design-to-Requirement Binding ${candidate.id} has an unresolved exact Finalized Figma Snapshot Import binding`)
      }
      const requirements = designRequirementsByExact.get(
        `${candidate.designRequirements.recordId}:${candidate.designRequirements.revision}:${candidate.designRequirements.digest}`,
      )
      if (!requirements || requirements.productId !== candidate.productId ||
          requirements.initiativeId !== candidate.initiativeId ||
          requirements.membershipDigest !== candidate.designRequirements.membershipDigest ||
          canonicalDigest(requirements.requirements) !== candidate.designRequirements.requirementCatalogDigest) {
        throw new Error(`Import Design-to-Requirement Binding ${candidate.id} has an unresolved exact Design Requirements binding`)
      }
      const decisions = decisionRegisterByExact.get(
        `${candidate.decisionRegister.recordId}:${candidate.decisionRegister.revision}:${candidate.decisionRegister.digest}`,
      )
      if (!decisions || decisions.productId !== candidate.productId || decisions.initiativeId !== candidate.initiativeId ||
          decisions.membershipDigest !== candidate.decisionRegister.membershipDigest ||
          canonicalDigest(decisions.decisions) !== candidate.decisionRegister.decisionCatalogDigest) {
        throw new Error(`Import Design-to-Requirement Binding ${candidate.id} has an unresolved exact Decision Register binding`)
      }
      const itemsByKey = new Map(finalizedSnapshot.items.map((entry) => [entry.key, entry]))
      const exactItemKeys = [...itemsByKey.keys()].sort((left, right) => left.localeCompare(right))
      const exactRequirementKeys = requirements.requirements.map((entry) => entry.key).sort((left, right) => left.localeCompare(right))
      const exactDecisionKeys = decisions.decisions.map((entry) => entry.key).sort((left, right) => left.localeCompare(right))
      const itemCoverageKeys = candidate.designItemCoverage.map((entry) => entry.itemKey)
      const requirementCoverageKeys = candidate.subjectCoverage
        .filter((entry) => entry.subjectType === "requirement").map((entry) => entry.subjectKey)
      const decisionCoverageKeys = candidate.subjectCoverage
        .filter((entry) => entry.subjectType === "decision").map((entry) => entry.subjectKey)
      if (canonicalDigest(itemCoverageKeys) !== canonicalDigest(exactItemKeys) ||
          canonicalDigest(requirementCoverageKeys) !== canonicalDigest(exactRequirementKeys) ||
          canonicalDigest(decisionCoverageKeys) !== canonicalDigest(exactDecisionKeys)) {
        throw new Error(`Import Design-to-Requirement Binding ${candidate.id} does not reconcile its exact design, Requirement, and Decision catalogs`)
      }
      const requirementKeySet = new Set(exactRequirementKeys)
      const decisionKeySet = new Set(exactDecisionKeys)
      for (const binding of candidate.bindings) {
        const item = itemsByKey.get(binding.designItemKey)
        if (!item || item.kind !== binding.designItemKind ||
            binding.requirementKeys.some((key) => !requirementKeySet.has(key)) ||
            binding.decisionKeys.some((key) => !decisionKeySet.has(key))) {
          throw new Error(`Import Design-to-Requirement Binding ${candidate.id} contains an unresolved design, Requirement, or Decision key`)
        }
      }
      const reconciliationReceipt = {
        finalizedSnapshot: candidate.finalizedSnapshot,
        designRequirements: candidate.designRequirements,
        decisionRegister: candidate.decisionRegister,
        bindingCatalogDigest: canonicalDigest(candidate.bindings),
        designItemCoverageDigest: canonicalDigest(candidate.designItemCoverage),
        subjectCoverageDigest: canonicalDigest(candidate.subjectCoverage),
        conflictCatalogDigest: canonicalDigest(candidate.conflicts),
      }
      if (candidate.reconciliationDigest !== canonicalDigest(reconciliationReceipt)) {
        throw new Error(`Import Design-to-Requirement Binding ${candidate.id} reconciliation receipt is invalid`)
      }
    }

    const designerReadyGates = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("designer-ready-gates/"))
      .map(([, record]) => designerReadyGateSchema.parse(record))
    const designerReadyGateHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("designer-ready-gate-history/"))
      .map(([, record]) => designerReadyGateSchema.parse(record))
    validateVersionedBusinessRecords(designerReadyGates, designerReadyGateHistory, "Designer-Ready Gate")
    const designerReadyPrerequisiteRecords = [
      ...accessibilityDesignRules,
      ...accessibilityDesignRulesHistory,
      ...decisionRegisters,
      ...decisionRegisterHistory,
      ...designApplicability,
      ...designApplicabilityHistory,
      ...designPersonaRoleModels,
      ...designPersonaRoleModelHistory,
      ...designRequirements,
      ...designRequirementsHistory,
      ...designSystemTokenContracts,
      ...designSystemTokenContractHistory,
      ...figmaMcpCapabilityDiscoveries,
      ...figmaMcpCapabilityDiscoveryHistory,
      ...informationArchitectureModels,
      ...informationArchitectureModelHistory,
      ...manualFigmaExecutionPaths,
      ...manualFigmaExecutionPathHistory,
      ...responsiveMultiPlatformTargets,
      ...responsiveMultiPlatformTargetsHistory,
      ...screenStateInventories,
      ...screenStateInventoryHistory,
      ...userJourneyModels,
      ...userJourneyModelHistory,
    ]
    const designerReadyPrerequisiteByExact = new Map(designerReadyPrerequisiteRecords.map((record) => [
      `${record.kind}:${record.id}:${record.revision}:${canonicalDigest(record)}`,
      record,
    ]))
    for (const candidate of [...designerReadyGates, ...designerReadyGateHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        objectiveDigest: candidate.objectiveDigest,
        prerequisites: candidate.prerequisites,
        evaluations: candidate.evaluations,
        exceptions: candidate.exceptions,
        assessmentDefinitionDigest: candidate.assessmentDefinitionDigest,
        assessmentReceiptDigest: candidate.assessmentReceiptDigest,
        candidateResult: candidate.candidateResult,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        designCompletenessState: candidate.designCompletenessState,
        externalCompletenessState: candidate.externalCompletenessState,
        designValidityState: candidate.designValidityState,
        designApprovalState: candidate.designApprovalState,
        designBaselineState: candidate.designBaselineState,
        readinessState: candidate.readinessState,
        exceptionAuthorityState: candidate.exceptionAuthorityState,
        figmaConnectionAuthorityState: candidate.figmaConnectionAuthorityState,
        credentialAuthorityState: candidate.credentialAuthorityState,
        permissionGrantState: candidate.permissionGrantState,
        importExecutionState: candidate.importExecutionState,
        writeExecutionState: candidate.writeExecutionState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Designer-Ready Gate ${candidate.id} membership digest is invalid`)
      }
      if (candidate.assessmentReceiptDigest !== designerReadyAssessmentReceiptDigest(candidate)) {
        throw new Error(`Import Designer-Ready Gate ${candidate.id} assessment receipt digest is invalid`)
      }
      for (const prerequisite of candidate.prerequisites) {
        const record = designerReadyPrerequisiteByExact.get(
          `${prerequisite.kind}:${prerequisite.recordId}:${prerequisite.revision}:${prerequisite.digest}`,
        )
        if (!record || record.productId !== candidate.productId || record.initiativeId !== candidate.initiativeId ||
            record.membershipDigest !== prerequisite.membershipDigest) {
          throw new Error(`Import Designer-Ready Gate ${candidate.id} has an unresolved exact ${prerequisite.key} binding`)
        }
      }
    }

    const designDeltas = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("design-deltas/"))
      .map(([, record]) => designDeltaSchema.parse(record))
    const designDeltaHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("design-delta-history/"))
      .map(([, record]) => designDeltaSchema.parse(record))
    validateVersionedBusinessRecords(designDeltas, designDeltaHistory, "Design Delta")
    const exactDesignerReadyGate = new Map([...designerReadyGates, ...designerReadyGateHistory].map((record) => [
      `${record.id}:${record.revision}:${canonicalDigest(record)}`,
      record,
    ]))
    const exactFinalizedSnapshot = new Map([...finalizedFigmaSnapshotImports, ...finalizedFigmaSnapshotImportHistory].map((record) => [
      `${record.id}:${record.revision}:${canonicalDigest(record)}`,
      record,
    ]))
    const exactDesignBinding = new Map([...designToRequirementBindings, ...designToRequirementBindingHistory].map((record) => [
      `${record.id}:${record.revision}:${canonicalDigest(record)}`,
      record,
    ]))
    for (const candidate of [...designDeltas, ...designDeltaHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        objectiveDigest: candidate.objectiveDigest,
        designerReadyGate: candidate.designerReadyGate,
        finalizedSnapshot: candidate.finalizedSnapshot,
        designBinding: candidate.designBinding,
        sourceSnapshotDigest: candidate.sourceSnapshotDigest,
        targetSnapshotDigest: candidate.targetSnapshotDigest,
        comparisonDefinitionDigest: candidate.comparisonDefinitionDigest,
        comparisonReceiptDigest: candidate.comparisonReceiptDigest,
        sourceItemCount: candidate.sourceItemCount,
        targetItemCount: candidate.targetItemCount,
        deltas: candidate.deltas,
        comparisonState: candidate.comparisonState,
        provenanceState: candidate.provenanceState,
        candidateResult: candidate.candidateResult,
        unresolvedMappings: candidate.unresolvedMappings,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        deltaCompletenessState: candidate.deltaCompletenessState,
        externalCompletenessState: candidate.externalCompletenessState,
        designValidityState: candidate.designValidityState,
        designApprovalState: candidate.designApprovalState,
        designBaselineState: candidate.designBaselineState,
        readinessState: candidate.readinessState,
        conflictResolutionAuthorityState: candidate.conflictResolutionAuthorityState,
        synchronizationAuthorityState: candidate.synchronizationAuthorityState,
        figmaConnectionAuthorityState: candidate.figmaConnectionAuthorityState,
        credentialAuthorityState: candidate.credentialAuthorityState,
        permissionGrantState: candidate.permissionGrantState,
        importExecutionState: candidate.importExecutionState,
        writeExecutionState: candidate.writeExecutionState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Design Delta ${candidate.id} membership digest is invalid`)
      }
      if (candidate.comparisonReceiptDigest !== designDeltaComparisonReceiptDigest(candidate)) {
        throw new Error(`Import Design Delta ${candidate.id} comparison receipt digest is invalid`)
      }
      const ready = exactDesignerReadyGate.get(
        `${candidate.designerReadyGate.recordId}:${candidate.designerReadyGate.revision}:${candidate.designerReadyGate.digest}`,
      )
      if (!ready || ready.productId !== candidate.productId || ready.initiativeId !== candidate.initiativeId ||
          ready.membershipDigest !== candidate.designerReadyGate.membershipDigest ||
          canonicalDigest(ready.prerequisites) !== candidate.designerReadyGate.prerequisiteCatalogDigest ||
          ready.assessmentReceiptDigest !== candidate.designerReadyGate.assessmentReceiptDigest ||
          ready.candidateResult !== candidate.designerReadyGate.candidateResult ||
          candidate.sourceSnapshotDigest !== canonicalDigest(ready.prerequisites)) {
        throw new Error(`Import Design Delta ${candidate.id} has an unresolved exact Designer-Ready Gate binding`)
      }
      const finalized = exactFinalizedSnapshot.get(
        `${candidate.finalizedSnapshot.recordId}:${candidate.finalizedSnapshot.revision}:${candidate.finalizedSnapshot.digest}`,
      )
      if (!finalized || finalized.productId !== candidate.productId || finalized.initiativeId !== candidate.initiativeId ||
          finalized.membershipDigest !== candidate.finalizedSnapshot.membershipDigest ||
          canonicalDigest(finalized.items) !== candidate.finalizedSnapshot.itemCatalogDigest ||
          finalized.reconciliationDigest !== candidate.finalizedSnapshot.reconciliationDigest ||
          finalized.reviewState !== candidate.finalizedSnapshot.reviewState ||
          candidate.targetSnapshotDigest !== canonicalDigest(finalized.items)) {
        throw new Error(`Import Design Delta ${candidate.id} has an unresolved exact Finalized Figma Snapshot binding`)
      }
      const binding = exactDesignBinding.get(
        `${candidate.designBinding.recordId}:${candidate.designBinding.revision}:${candidate.designBinding.digest}`,
      )
      if (!binding || binding.productId !== candidate.productId || binding.initiativeId !== candidate.initiativeId ||
          binding.membershipDigest !== candidate.designBinding.membershipDigest ||
          canonicalDigest(binding.bindings) !== candidate.designBinding.bindingCatalogDigest ||
          binding.reconciliationDigest !== candidate.designBinding.reconciliationDigest ||
          binding.reviewState !== candidate.designBinding.reviewState) {
        throw new Error(`Import Design Delta ${candidate.id} has an unresolved exact Design-to-Requirement Binding`)
      }
    }

    const designConflictResolutions = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("design-conflict-resolutions/"))
      .map(([, record]) => designConflictResolutionSchema.parse(record))
    const designConflictResolutionHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("design-conflict-resolution-history/"))
      .map(([, record]) => designConflictResolutionSchema.parse(record))
    validateVersionedBusinessRecords(
      designConflictResolutions,
      designConflictResolutionHistory,
      "Design Conflict Resolution",
    )
    const exactDesignDelta = new Map([...designDeltas, ...designDeltaHistory].map((record) => [
      `${record.id}:${record.revision}:${canonicalDigest(record)}`,
      record,
    ]))
    for (const candidate of [...designConflictResolutions, ...designConflictResolutionHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        objectiveDigest: candidate.objectiveDigest,
        designDelta: candidate.designDelta,
        resolutionDefinitionDigest: candidate.resolutionDefinitionDigest,
        resolutionReceiptDigest: candidate.resolutionReceiptDigest,
        conflictCount: candidate.conflictCount,
        resolutions: candidate.resolutions,
        coverageState: candidate.coverageState,
        provenanceState: candidate.provenanceState,
        candidateResult: candidate.candidateResult,
        unresolvedConflictKeys: candidate.unresolvedConflictKeys,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        separationOfDutiesEnforcementState: candidate.separationOfDutiesEnforcementState,
        conflictResolutionAuthorityState: candidate.conflictResolutionAuthorityState,
        synchronizationAuthorityState: candidate.synchronizationAuthorityState,
        designValidityState: candidate.designValidityState,
        designApprovalState: candidate.designApprovalState,
        designBaselineState: candidate.designBaselineState,
        readinessState: candidate.readinessState,
        figmaConnectionAuthorityState: candidate.figmaConnectionAuthorityState,
        credentialAuthorityState: candidate.credentialAuthorityState,
        permissionGrantState: candidate.permissionGrantState,
        importExecutionState: candidate.importExecutionState,
        writeExecutionState: candidate.writeExecutionState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Design Conflict Resolution ${candidate.id} membership digest is invalid`)
      }
      if (candidate.resolutionReceiptDigest !== designConflictResolutionReceiptDigest(candidate)) {
        throw new Error(`Import Design Conflict Resolution ${candidate.id} receipt digest is invalid`)
      }
      const delta = exactDesignDelta.get(
        `${candidate.designDelta.recordId}:${candidate.designDelta.revision}:${candidate.designDelta.digest}`,
      )
      if (!delta || delta.productId !== candidate.productId || delta.initiativeId !== candidate.initiativeId ||
          canonicalDigest(designDeltaResolutionReference(delta)) !== canonicalDigest(candidate.designDelta)) {
        throw new Error(`Import Design Conflict Resolution ${candidate.id} has an unresolved exact Design Delta binding`)
      }
      const conflicts = delta.deltas.filter((entry) => entry.changeKind === "conflicting")
      if (candidate.conflictCount !== conflicts.length) {
        throw new Error(`Import Design Conflict Resolution ${candidate.id} conflict count does not match its exact Design Delta`)
      }
      const conflictByKey = new Map(conflicts.map((entry) => [entry.key, entry]))
      for (const resolution of candidate.resolutions) {
        const conflict = conflictByKey.get(resolution.conflictKey)
        if (!conflict || conflict.subjectKind !== resolution.subjectKind ||
            canonicalDigest(conflict) !== resolution.conflictDigest) {
          throw new Error(`Import Design Conflict Resolution ${candidate.id} contains an unresolved exact conflict binding`)
        }
      }
      for (const key of candidate.unresolvedConflictKeys) {
        if (!conflictByKey.has(key)) {
          throw new Error(`Import Design Conflict Resolution ${candidate.id} contains an unknown unresolved conflict key`)
        }
      }
    }

    const humanDesignApprovals = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("human-design-approvals/"))
      .map(([, record]) => humanDesignApprovalSchema.parse(record))
    const humanDesignApprovalHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("human-design-approval-history/"))
      .map(([, record]) => humanDesignApprovalSchema.parse(record))
    const exactHumanDesignApprovals = validateVersionedBusinessRecords(
      humanDesignApprovals,
      humanDesignApprovalHistory,
      "Human Design Approval",
    )
    const humanDesignApprovalPrerequisiteRecords = [
      ...designConflictResolutions,
      ...designConflictResolutionHistory,
      ...designDeltas,
      ...designDeltaHistory,
      ...designToRequirementBindings,
      ...designToRequirementBindingHistory,
      ...designerReadyGates,
      ...designerReadyGateHistory,
      ...finalizedFigmaSnapshotImports,
      ...finalizedFigmaSnapshotImportHistory,
    ]
    const humanDesignApprovalPrerequisiteByExact = new Map(humanDesignApprovalPrerequisiteRecords.map((record) => [
      `${record.kind}:${record.id}:${record.revision}:${canonicalDigest(record)}`,
      record,
    ]))
    for (const candidate of [...humanDesignApprovals, ...humanDesignApprovalHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        objectiveDigest: candidate.objectiveDigest,
        prerequisites: candidate.prerequisites,
        subject: candidate.subject,
        scope: candidate.scope,
        decision: candidate.decision,
        decisionDefinitionDigest: candidate.decisionDefinitionDigest,
        decisionReceiptDigest: candidate.decisionReceiptDigest,
        candidateResult: candidate.candidateResult,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        approverAuthorityState: candidate.approverAuthorityState,
        separationOfDutiesEnforcementState: candidate.separationOfDutiesEnforcementState,
        designApprovalState: candidate.designApprovalState,
        designBaselineState: candidate.designBaselineState,
        readinessState: candidate.readinessState,
        phaseEntryAuthorityState: candidate.phaseEntryAuthorityState,
        figmaConnectionAuthorityState: candidate.figmaConnectionAuthorityState,
        credentialAuthorityState: candidate.credentialAuthorityState,
        permissionGrantState: candidate.permissionGrantState,
        importExecutionState: candidate.importExecutionState,
        writeExecutionState: candidate.writeExecutionState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Human Design Approval ${candidate.id} membership digest is invalid`)
      }
      if (candidate.scope.scopeDigest !== humanDesignApprovalScopeDigest(candidate.scope)) {
        throw new Error(`Import Human Design Approval ${candidate.id} scope digest is invalid`)
      }
      if (candidate.decisionReceiptDigest !== humanDesignApprovalDecisionReceiptDigest(candidate)) {
        throw new Error(`Import Human Design Approval ${candidate.id} decision receipt digest is invalid`)
      }
      for (const prerequisite of candidate.prerequisites) {
        const record = humanDesignApprovalPrerequisiteByExact.get(
          `${prerequisite.kind}:${prerequisite.recordId}:${prerequisite.revision}:${prerequisite.digest}`,
        )
        if (!record || record.productId !== candidate.productId || record.initiativeId !== candidate.initiativeId ||
            record.membershipDigest !== prerequisite.membershipDigest) {
          throw new Error(`Import Human Design Approval ${candidate.id} has an unresolved exact ${prerequisite.key} binding`)
        }
      }
      const finalized = exactFinalizedSnapshot.get(
        `${candidate.subject.recordId}:${candidate.subject.revision}:${candidate.subject.digest}`,
      )
      if (!finalized || finalized.productId !== candidate.productId || finalized.initiativeId !== candidate.initiativeId ||
          canonicalDigest(humanDesignApprovalSubjectReference(finalized)) !== canonicalDigest(candidate.subject)) {
        throw new Error(`Import Human Design Approval ${candidate.id} has an unresolved exact approval subject`)
      }
      const expectedItemDigests = finalized.items.map((item) => canonicalDigest(item)).sort()
      const actualItemDigests = [...candidate.scope.includedItemDigests, ...candidate.scope.excludedItemDigests].sort()
      if (canonicalDigest(actualItemDigests) !== canonicalDigest(expectedItemDigests)) {
        throw new Error(`Import Human Design Approval ${candidate.id} scope does not classify every exact finalized-snapshot item`)
      }
    }

    const designBaselines = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("design-baselines/"))
      .map(([, record]) => designBaselineSchema.parse(record))
    const designBaselineHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("design-baseline-history/"))
      .map(([, record]) => designBaselineSchema.parse(record))
    const exactDesignBaselines = validateVersionedBusinessRecords(
      designBaselines,
      designBaselineHistory,
      "Design Baseline",
    )
    for (const candidate of [...designBaselines, ...designBaselineHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        objectiveDigest: candidate.objectiveDigest,
        humanDesignApproval: candidate.humanDesignApproval,
        subject: candidate.subject,
        scope: candidate.scope,
        baselineLineageId: candidate.baselineLineageId,
        candidateSetId: candidate.candidateSetId,
        candidateSetRevision: candidate.candidateSetRevision,
        semanticVersion: candidate.semanticVersion,
        versionPolicyDigest: candidate.versionPolicyDigest,
        designation: candidate.designation,
        supersedes: candidate.supersedes,
        designationDefinitionDigest: candidate.designationDefinitionDigest,
        designationReceiptDigest: candidate.designationReceiptDigest,
        candidateResult: candidate.candidateResult,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        approvalDeterminationState: candidate.approvalDeterminationState,
        baselineDesignationState: candidate.baselineDesignationState,
        approverAuthorityState: candidate.approverAuthorityState,
        separationOfDutiesEnforcementState: candidate.separationOfDutiesEnforcementState,
        readinessState: candidate.readinessState,
        phaseEntryAuthorityState: candidate.phaseEntryAuthorityState,
        figmaConnectionAuthorityState: candidate.figmaConnectionAuthorityState,
        credentialAuthorityState: candidate.credentialAuthorityState,
        permissionGrantState: candidate.permissionGrantState,
        importExecutionState: candidate.importExecutionState,
        writeExecutionState: candidate.writeExecutionState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Design Baseline ${candidate.id} membership digest is invalid`)
      }
      if (candidate.designationReceiptDigest !== designBaselineDesignationReceiptDigest(candidate)) {
        throw new Error(`Import Design Baseline ${candidate.id} designation receipt digest is invalid`)
      }
      const approval = exactHumanDesignApprovals.get(
        `${candidate.humanDesignApproval.recordId}:${candidate.humanDesignApproval.revision}:${candidate.humanDesignApproval.digest}`,
      )
      if (!approval || approval.productId !== candidate.productId || approval.initiativeId !== candidate.initiativeId ||
          approval.membershipDigest !== candidate.humanDesignApproval.membershipDigest ||
          approval.decisionReceiptDigest !== candidate.humanDesignApproval.decisionReceiptDigest ||
          approval.candidateResult !== "approved-candidate" || approval.reviewState !== "recorded-human-decision" ||
          canonicalDigest(approval.subject) !== canonicalDigest(candidate.subject) ||
          canonicalDigest(approval.scope) !== canonicalDigest(candidate.scope)) {
        throw new Error(`Import Design Baseline ${candidate.id} has an unresolved exact Human Design Approval binding`)
      }
      if (candidate.supersedes) {
        const predecessor = exactDesignBaselines.get(
          `${candidate.supersedes.recordId}:${candidate.supersedes.revision}:${candidate.supersedes.digest}`,
        )
        if (!predecessor || predecessor.id !== candidate.id || predecessor.revision !== candidate.revision - 1 ||
            predecessor.membershipDigest !== candidate.supersedes.membershipDigest ||
            predecessor.baselineLineageId !== candidate.supersedes.baselineLineageId ||
            predecessor.semanticVersion !== candidate.supersedes.semanticVersion) {
          throw new Error(`Import Design Baseline ${candidate.id} has an unresolved exact predecessor binding`)
        }
      }
    }

    const designDriftDetections = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("design-drift-detections/"))
      .map(([, record]) => designDriftDetectionSchema.parse(record))
    const designDriftDetectionHistory = [...recordsByPath.entries()]
      .filter(([path]) => path.startsWith("design-drift-detection-history/"))
      .map(([, record]) => designDriftDetectionSchema.parse(record))
    validateVersionedBusinessRecords(
      designDriftDetections,
      designDriftDetectionHistory,
      "Design Drift Detection",
    )
    const designTraceByExact = new Map(
      [...designToRequirementBindings, ...designToRequirementBindingHistory].map((record) => [
        `${record.id}:${record.revision}:${canonicalDigest(record)}`,
        record,
      ]),
    )
    for (const candidate of [...designDriftDetections, ...designDriftDetectionHistory]) {
      const expectedMembership = {
        initiativeId: candidate.initiativeId,
        context: candidate.context,
        informationClassification: candidate.informationClassification,
        title: candidate.title,
        objectiveDigest: candidate.objectiveDigest,
        designBaseline: candidate.designBaseline,
        returnedFigmaSnapshot: candidate.returnedFigmaSnapshot,
        designRequirements: candidate.designRequirements,
        designTrace: candidate.designTrace,
        implementationTargetCatalogRevision: candidate.implementationTargetCatalogRevision,
        implementationTargets: candidate.implementationTargets,
        implementationTargetCatalogDigest: candidate.implementationTargetCatalogDigest,
        comparisonPolicyDigest: candidate.comparisonPolicyDigest,
        observations: candidate.observations,
        comparisonDigest: candidate.comparisonDigest,
        remediationCandidates: candidate.remediationCandidates,
        candidateResult: candidate.candidateResult,
        unresolvedQuestions: candidate.unresolvedQuestions,
        limitations: candidate.limitations,
        reviewState: candidate.reviewState,
        comparisonCompletenessState: candidate.comparisonCompletenessState,
        externalCompletenessState: candidate.externalCompletenessState,
        designValidityState: candidate.designValidityState,
        implementationValidityState: candidate.implementationValidityState,
        approvalState: candidate.approvalState,
        baselineDesignationState: candidate.baselineDesignationState,
        readinessState: candidate.readinessState,
        remediationAuthorityState: candidate.remediationAuthorityState,
        figmaConnectionAuthorityState: candidate.figmaConnectionAuthorityState,
        credentialAuthorityState: candidate.credentialAuthorityState,
        permissionGrantState: candidate.permissionGrantState,
        importExecutionState: candidate.importExecutionState,
        writeExecutionState: candidate.writeExecutionState,
        implementationAuthorityState: candidate.implementationAuthorityState,
      }
      if (candidate.membershipDigest !== canonicalDigest(expectedMembership)) {
        throw new Error(`Import Design Drift Detection ${candidate.id} membership digest is invalid`)
      }
      if (candidate.implementationTargetCatalogDigest !== designDriftImplementationTargetCatalogDigest(candidate)) {
        throw new Error(`Import Design Drift Detection ${candidate.id} target catalog digest is invalid`)
      }
      if (candidate.comparisonDigest !== designDriftComparisonDigest(candidate)) {
        throw new Error(`Import Design Drift Detection ${candidate.id} comparison receipt is invalid`)
      }
      const baseline = exactDesignBaselines.get(
        `${candidate.designBaseline.recordId}:${candidate.designBaseline.revision}:${candidate.designBaseline.digest}`,
      )
      const snapshot = finalizedSnapshotByExact.get(
        `${candidate.returnedFigmaSnapshot.recordId}:${candidate.returnedFigmaSnapshot.revision}:${candidate.returnedFigmaSnapshot.digest}`,
      )
      const requirements = designRequirementsByExact.get(
        `${candidate.designRequirements.recordId}:${candidate.designRequirements.revision}:${candidate.designRequirements.digest}`,
      )
      const trace = designTraceByExact.get(
        `${candidate.designTrace.recordId}:${candidate.designTrace.revision}:${candidate.designTrace.digest}`,
      )
      if (!baseline || baseline.productId !== candidate.productId || baseline.initiativeId !== candidate.initiativeId ||
          canonicalDigest(candidate.designBaseline) !== canonicalDigest(designDriftBaselineReference(baseline))) {
        throw new Error(`Import Design Drift Detection ${candidate.id} has an unresolved exact Design Baseline candidate binding`)
      }
      if (!snapshot || snapshot.productId !== candidate.productId || snapshot.initiativeId !== candidate.initiativeId ||
          canonicalDigest(candidate.returnedFigmaSnapshot) !== canonicalDigest(designDriftSnapshotReference(snapshot))) {
        throw new Error(`Import Design Drift Detection ${candidate.id} has an unresolved exact returned Figma snapshot binding`)
      }
      if (!requirements || requirements.productId !== candidate.productId || requirements.initiativeId !== candidate.initiativeId ||
          canonicalDigest(candidate.designRequirements) !== canonicalDigest(designDriftRequirementsReference(requirements))) {
        throw new Error(`Import Design Drift Detection ${candidate.id} has an unresolved exact Design Requirements binding`)
      }
      if (!trace || trace.productId !== candidate.productId || trace.initiativeId !== candidate.initiativeId ||
          canonicalDigest(candidate.designTrace) !== canonicalDigest(designDriftTraceReference(trace))) {
        throw new Error(`Import Design Drift Detection ${candidate.id} has an unresolved exact design trace binding`)
      }
      if (baseline.subject.recordId !== snapshot.id || baseline.subject.revision !== snapshot.revision ||
          baseline.subject.digest !== canonicalDigest(snapshot) || baseline.subject.itemCatalogDigest !== canonicalDigest(snapshot.items) ||
          canonicalDigest(trace.finalizedSnapshot) !== canonicalDigest({
            recordId: snapshot.id, revision: snapshot.revision, digest: canonicalDigest(snapshot),
            membershipDigest: snapshot.membershipDigest, itemCatalogDigest: canonicalDigest(snapshot.items),
          }) || canonicalDigest(trace.designRequirements) !== canonicalDigest({
            recordId: requirements.id, revision: requirements.revision, digest: canonicalDigest(requirements),
            membershipDigest: requirements.membershipDigest, requirementCatalogDigest: canonicalDigest(requirements.requirements),
          })) {
        throw new Error(`Import Design Drift Detection ${candidate.id} dependency chain is inconsistent`)
      }
      const designItemKeys = new Set(snapshot.items.map((entry) => entry.key))
      const requirementKeys = new Set(requirements.requirements.map((entry) => entry.key))
      if (candidate.implementationTargets.some((target) =>
        target.designItemKeys.some((key) => !designItemKeys.has(key)) ||
        target.requirementKeys.some((key) => !requirementKeys.has(key))) ||
        candidate.observations.some((observation) =>
          !designItemKeys.has(observation.designItemKey) ||
          observation.requirementKeys.some((key) => !requirementKeys.has(key)))) {
        throw new Error(`Import Design Drift Detection ${candidate.id} has unresolved design-item or Requirement catalog references`)
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
    if (/^business-understanding\/[0-9a-f-]+\.json$/i.test(path) ||
        /^business-understanding-history\/business-understanding-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "business-understanding-record"
    }
    if (/^business-capability-maps\/[0-9a-f-]+\.json$/i.test(path) ||
        /^business-capability-map-history\/business-capability-map-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "business-capability-map"
    }
    if (/^value-stream-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^value-stream-model-history\/value-stream-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "value-stream-model"
    }
    if (/^operating-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^operating-model-history\/operating-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "operating-model"
    }
    if (/^business-rule-catalogs\/[0-9a-f-]+\.json$/i.test(path) ||
        /^business-rule-catalog-history\/business-rule-catalog-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "business-rule-catalog"
    }
    if (/^business-architecture-baselines\/[0-9a-f-]+\.json$/i.test(path) ||
        /^business-architecture-baseline-history\/business-architecture-baseline-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "business-architecture-baseline-candidate"
    }
    if (/^system-solution-architectures\/[0-9a-f-]+\.json$/i.test(path) ||
        /^system-solution-architecture-history\/system-solution-architecture-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "system-solution-architecture-candidate"
    }
    if (/^bounded-context-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^bounded-context-model-history\/bounded-context-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "bounded-context-ownership-candidate"
    }
    if (/^security-privacy-assessments\/[0-9a-f-]+\.json$/i.test(path) ||
        /^security-privacy-assessment-history\/security-privacy-assessment-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "security-privacy-threat-assessment-candidate"
    }
    if (/^process-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^process-model-history\/process-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "process-model-candidate"
    }
    if (/^data-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^data-model-history\/data-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "data-model-candidate"
    }
    if (/^authorization-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^authorization-model-history\/authorization-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "authorization-model-candidate"
    }
    if (/^event-integration-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^event-integration-model-history\/event-integration-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "event-integration-model-candidate"
    }
    if (/^failure-recovery-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^failure-recovery-model-history\/failure-recovery-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "failure-recovery-model-candidate"
    }
    if (/^architecture-challenge-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^architecture-challenge-model-history\/architecture-challenge-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "architecture-challenge-model-candidate"
    }
    if (/^decision-registers\/[0-9a-f-]+\.json$/i.test(path) ||
        /^decision-register-history\/decision-register-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "decision-register-candidate"
    }
    if (/^risk-registers\/[0-9a-f-]+\.json$/i.test(path) ||
        /^risk-register-history\/risk-register-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "risk-register-candidate"
    }
    if (/^evidence-registries\/[0-9a-f-]+\.json$/i.test(path) ||
        /^evidence-registry-history\/evidence-registry-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "evidence-registry-candidate"
    }
    if (/^end-to-end-traceability\/[0-9a-f-]+\.json$/i.test(path) ||
        /^end-to-end-traceability-history\/end-to-end-traceability-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "end-to-end-traceability-candidate"
    }
    if (/^p0-p4-readiness-gates\/[0-9a-f-]+\.json$/i.test(path) ||
        /^p0-p4-readiness-gate-history\/p0-p4-readiness-gate-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "p0-p4-readiness-gate-candidate"
    }
    if (/^p5-handoff-packages\/[0-9a-f-]+\.json$/i.test(path) ||
        /^p5-handoff-package-history\/p5-handoff-package-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "p5-handoff-package-candidate"
    }
    if (/^design-applicability\/[0-9a-f-]+\.json$/i.test(path) ||
        /^design-applicability-history\/design-applicability-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "design-applicability-candidate"
    }
    if (/^design-persona-role-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^design-persona-role-model-history\/design-persona-role-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "design-persona-role-candidate"
    }
    if (/^user-journey-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^user-journey-model-history\/user-journey-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "user-journey-model-candidate"
    }
    if (/^information-architecture-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^information-architecture-model-history\/information-architecture-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "information-architecture-model-candidate"
    }
    if (/^screen-state-inventories\/[0-9a-f-]+\.json$/i.test(path) ||
        /^screen-state-inventory-history\/screen-state-inventory-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "screen-state-inventory-candidate"
    }
    if (/^design-requirements\/[0-9a-f-]+\.json$/i.test(path) ||
        /^design-requirements-history\/design-requirements-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "design-requirements-candidate"
    }
    if (/^design-system-token-contracts\/[0-9a-f-]+\.json$/i.test(path) ||
        /^design-system-token-contracts-history\/design-system-token-contract-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "design-system-token-contract-candidate"
    }
    if (/^accessibility-design-rules\/[0-9a-f-]+\.json$/i.test(path) ||
        /^accessibility-design-rules-history\/accessibility-design-rules-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "accessibility-design-rules-candidate"
    }
    if (/^responsive-multi-platform-targets\/[0-9a-f-]+\.json$/i.test(path) ||
        /^responsive-multi-platform-targets-history\/responsive-multi-platform-targets-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "responsive-multi-platform-targets-candidate"
    }
    if (/^manual-figma-execution-paths\/[0-9a-f-]+\.json$/i.test(path) ||
        /^manual-figma-execution-path-history\/manual-figma-execution-path-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "manual-figma-execution-path-candidate"
    }
    if (/^figma-mcp-capability-discoveries\/[0-9a-f-]+\.json$/i.test(path) ||
        /^figma-mcp-capability-discovery-history\/figma-mcp-capability-discovery-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "figma-mcp-capability-discovery-candidate"
    }
    if (/^figma-read-snapshots\/[0-9a-f-]+\.json$/i.test(path) ||
        /^figma-read-snapshot-history\/figma-read-snapshot-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "figma-read-snapshot-candidate"
    }
    if (/^figma-context-imports\/[0-9a-f-]+\.json$/i.test(path) ||
        /^figma-context-import-history\/figma-context-import-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "figma-context-import-candidate"
    }
    if (/^outbound-design-brief-packages\/[0-9a-f-]+\.json$/i.test(path) ||
        /^outbound-design-brief-package-history\/outbound-design-brief-package-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "outbound-design-brief-package-candidate"
    }
    if (/^governed-figma-writes\/[0-9a-f-]+\.json$/i.test(path) ||
        /^governed-figma-write-history\/governed-figma-write-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "governed-figma-write-candidate"
    }
    if (/^finalized-figma-snapshot-imports\/[0-9a-f-]+\.json$/i.test(path) ||
        /^finalized-figma-snapshot-import-history\/finalized-figma-snapshot-import-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "finalized-figma-snapshot-import-candidate"
    }
    if (/^design-to-requirement-bindings\/[0-9a-f-]+\.json$/i.test(path) ||
        /^design-to-requirement-binding-history\/design-to-requirement-binding-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "design-to-requirement-binding-candidate"
    }
    if (/^designer-ready-gates\/[0-9a-f-]+\.json$/i.test(path) ||
        /^designer-ready-gate-history\/designer-ready-gate-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "designer-ready-gate-candidate"
    }
    if (/^design-deltas\/[0-9a-f-]+\.json$/i.test(path) ||
        /^design-delta-history\/design-delta-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "design-delta-candidate"
    }
    if (/^design-conflict-resolutions\/[0-9a-f-]+\.json$/i.test(path) ||
        /^design-conflict-resolution-history\/design-conflict-resolution-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "design-conflict-resolution-candidate"
    }
    if (/^human-design-approvals\/[0-9a-f-]+\.json$/i.test(path) ||
        /^human-design-approval-history\/human-design-approval-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "human-design-approval-candidate"
    }
    if (/^design-baselines\/[0-9a-f-]+\.json$/i.test(path) ||
        /^design-baseline-history\/design-baseline-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "design-baseline-candidate"
    }
    if (/^design-drift-detections\/[0-9a-f-]+\.json$/i.test(path) ||
        /^design-drift-detection-history\/design-drift-detection-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "design-drift-detection-candidate"
    }
    if (/^candidates\/portable-design-[0-9a-f-]+\.json$/i.test(path)) return "portable-design-snapshot"
    if (/^stakeholder-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^stakeholder-model-history\/stakeholder-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "stakeholder-role-model"
    }
    if (/^outcome-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^outcome-model-history\/outcome-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return "outcome-measure-model"
    }
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
    if (/^business-understanding\/[0-9a-f-]+\.json$/i.test(path) ||
        /^business-understanding-history\/business-understanding-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return businessUnderstandingSchema
    }
    if (/^business-capability-maps\/[0-9a-f-]+\.json$/i.test(path) ||
        /^business-capability-map-history\/business-capability-map-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return businessCapabilityMapSchema
    }
    if (/^value-stream-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^value-stream-model-history\/value-stream-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return valueStreamModelSchema
    }
    if (/^operating-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^operating-model-history\/operating-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return operatingModelSchema
    }
    if (/^business-rule-catalogs\/[0-9a-f-]+\.json$/i.test(path) ||
        /^business-rule-catalog-history\/business-rule-catalog-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return businessRuleCatalogSchema
    }
    if (/^business-architecture-baselines\/[0-9a-f-]+\.json$/i.test(path) ||
        /^business-architecture-baseline-history\/business-architecture-baseline-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return businessArchitectureBaselineSchema
    }
    if (/^system-solution-architectures\/[0-9a-f-]+\.json$/i.test(path) ||
        /^system-solution-architecture-history\/system-solution-architecture-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return systemSolutionArchitectureSchema
    }
    if (/^bounded-context-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^bounded-context-model-history\/bounded-context-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return boundedContextModelSchema
    }
    if (/^security-privacy-assessments\/[0-9a-f-]+\.json$/i.test(path) ||
        /^security-privacy-assessment-history\/security-privacy-assessment-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return securityPrivacyAssessmentSchema
    }
    if (/^process-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^process-model-history\/process-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return processModelSchema
    }
    if (/^data-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^data-model-history\/data-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return dataModelSchema
    }
    if (/^authorization-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^authorization-model-history\/authorization-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return authorizationModelSchema
    }
    if (/^event-integration-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^event-integration-model-history\/event-integration-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return eventIntegrationModelSchema
    }
    if (/^failure-recovery-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^failure-recovery-model-history\/failure-recovery-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return failureRecoveryModelSchema
    }
    if (/^architecture-challenge-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^architecture-challenge-model-history\/architecture-challenge-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return architectureChallengeModelSchema
    }
    if (/^decision-registers\/[0-9a-f-]+\.json$/i.test(path) ||
        /^decision-register-history\/decision-register-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return decisionRegisterSchema
    }
    if (/^risk-registers\/[0-9a-f-]+\.json$/i.test(path) ||
        /^risk-register-history\/risk-register-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return riskRegisterSchema
    }
    if (/^evidence-registries\/[0-9a-f-]+\.json$/i.test(path) ||
        /^evidence-registry-history\/evidence-registry-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return evidenceRegistrySchema
    }
    if (/^end-to-end-traceability\/[0-9a-f-]+\.json$/i.test(path) ||
        /^end-to-end-traceability-history\/end-to-end-traceability-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return endToEndTraceabilitySchema
    }
    if (/^p0-p4-readiness-gates\/[0-9a-f-]+\.json$/i.test(path) ||
        /^p0-p4-readiness-gate-history\/p0-p4-readiness-gate-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return p0P4ReadinessGateSchema
    }
    if (/^p5-handoff-packages\/[0-9a-f-]+\.json$/i.test(path) ||
        /^p5-handoff-package-history\/p5-handoff-package-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return p5HandoffPackageSchema
    }
    if (/^design-applicability\/[0-9a-f-]+\.json$/i.test(path) ||
        /^design-applicability-history\/design-applicability-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return designApplicabilitySchema
    }
    if (/^design-persona-role-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^design-persona-role-model-history\/design-persona-role-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return designPersonaRoleModelSchema
    }
    if (/^user-journey-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^user-journey-model-history\/user-journey-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return userJourneyModelSchema
    }
    if (/^information-architecture-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^information-architecture-model-history\/information-architecture-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return informationArchitectureModelSchema
    }
    if (/^screen-state-inventories\/[0-9a-f-]+\.json$/i.test(path) ||
        /^screen-state-inventory-history\/screen-state-inventory-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return screenStateInventorySchema
    }
    if (/^design-requirements\/[0-9a-f-]+\.json$/i.test(path) ||
        /^design-requirements-history\/design-requirements-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return designRequirementsSchema
    }
    if (/^design-system-token-contracts\/[0-9a-f-]+\.json$/i.test(path) ||
        /^design-system-token-contracts-history\/design-system-token-contract-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return designSystemTokenContractSchema
    }
    if (/^accessibility-design-rules\/[0-9a-f-]+\.json$/i.test(path) ||
        /^accessibility-design-rules-history\/accessibility-design-rules-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return accessibilityDesignRulesSchema
    }
    if (/^responsive-multi-platform-targets\/[0-9a-f-]+\.json$/i.test(path) ||
        /^responsive-multi-platform-targets-history\/responsive-multi-platform-targets-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return responsiveMultiPlatformTargetsSchema
    }
    if (/^manual-figma-execution-paths\/[0-9a-f-]+\.json$/i.test(path) ||
        /^manual-figma-execution-path-history\/manual-figma-execution-path-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return manualFigmaExecutionPathSchema
    }
    if (/^figma-mcp-capability-discoveries\/[0-9a-f-]+\.json$/i.test(path) ||
        /^figma-mcp-capability-discovery-history\/figma-mcp-capability-discovery-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return figmaMcpCapabilityDiscoverySchema
    }
    if (/^figma-read-snapshots\/[0-9a-f-]+\.json$/i.test(path) ||
        /^figma-read-snapshot-history\/figma-read-snapshot-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return figmaReadSnapshotSchema
    }
    if (/^figma-context-imports\/[0-9a-f-]+\.json$/i.test(path) ||
        /^figma-context-import-history\/figma-context-import-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return figmaContextImportSchema
    }
    if (/^outbound-design-brief-packages\/[0-9a-f-]+\.json$/i.test(path) ||
        /^outbound-design-brief-package-history\/outbound-design-brief-package-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return outboundDesignBriefPackageSchema
    }
    if (/^governed-figma-writes\/[0-9a-f-]+\.json$/i.test(path) ||
        /^governed-figma-write-history\/governed-figma-write-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return governedFigmaWriteSchema
    }
    if (/^finalized-figma-snapshot-imports\/[0-9a-f-]+\.json$/i.test(path) ||
        /^finalized-figma-snapshot-import-history\/finalized-figma-snapshot-import-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return finalizedFigmaSnapshotImportSchema
    }
    if (/^design-to-requirement-bindings\/[0-9a-f-]+\.json$/i.test(path) ||
        /^design-to-requirement-binding-history\/design-to-requirement-binding-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return designToRequirementBindingSchema
    }
    if (/^designer-ready-gates\/[0-9a-f-]+\.json$/i.test(path) ||
        /^designer-ready-gate-history\/designer-ready-gate-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return designerReadyGateSchema
    }
    if (/^design-deltas\/[0-9a-f-]+\.json$/i.test(path) ||
        /^design-delta-history\/design-delta-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return designDeltaSchema
    }
    if (/^design-conflict-resolutions\/[0-9a-f-]+\.json$/i.test(path) ||
        /^design-conflict-resolution-history\/design-conflict-resolution-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return designConflictResolutionSchema
    }
    if (/^human-design-approvals\/[0-9a-f-]+\.json$/i.test(path) ||
        /^human-design-approval-history\/human-design-approval-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return humanDesignApprovalSchema
    }
    if (/^design-baselines\/[0-9a-f-]+\.json$/i.test(path) ||
        /^design-baseline-history\/design-baseline-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return designBaselineSchema
    }
    if (/^design-drift-detections\/[0-9a-f-]+\.json$/i.test(path) ||
        /^design-drift-detection-history\/design-drift-detection-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return designDriftDetectionSchema
    }
    if (/^candidates\/portable-design-[0-9a-f-]+\.json$/i.test(path)) return portableDesignImportResultSchema
    if (/^stakeholder-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^stakeholder-model-history\/stakeholder-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return stakeholderModelSchema
    }
    if (/^outcome-models\/[0-9a-f-]+\.json$/i.test(path) ||
        /^outcome-model-history\/outcome-model-[0-9a-f-]+-r[1-9][0-9]*\.json$/i.test(path)) {
      return outcomeModelSchema
    }
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
