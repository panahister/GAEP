import { randomUUID } from "node:crypto"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

import {
  agentSelectionSchema,
  agentSelectionStateSchema,
  adapterCapabilitiesSchema,
  executionWorkspaceScopeSchema,
  executionCharterSchema,
  executionManagedIntentSchema,
  handoffSchema,
  initiativeApplicabilityMatrixInputSchema,
  initiativeApplicabilityMatrixSchema,
  initiativeClassificationInputSchema,
  initiativeClassificationSchema,
  initiativeEntryAssessmentSchema,
  initiativeSchema,
  productSchema,
  productRevisionSchema,
  portableSelectionSettingsSchema,
  repositoryManifestSchema,
  runSchema,
  workspaceHealthSchema,
  type AdapterCapabilities,
  type AgentSelection,
  type AgentSelectionState,
  type ExecutionCharter,
  type ExecutionManagedIntent,
  type Handoff,
  type Initiative,
  type InitiativeApplicabilityMatrixInput,
  type InitiativeClassificationInput,
  type InitiativeEntryAssessment,
  type ManagedApplyDecisionReceipt,
  type ManagedRunEvidence,
  type ManagedRunRecord,
  type ManagedRunResult,
  type Product,
  type Run,
  type ToolPermission,
  type WorkflowPlan,
} from "@gaep/contracts"
import {
  canonicalDigest,
  capabilityDigest,
  ManagedStageRegistry,
  type AdapterProbeOptions,
  type AdapterProbeResult,
  type AgentAdapter,
  type AgentInvocation,
} from "@gaep/agent-sdk"

import { GaepRepository, type GaepRepositoryOptions } from "./repository.js"
import {
  assessInitiativeApplicabilityCoverage,
  assessInitiativeClassificationCompleteness,
  composeInitiativeApplicabilitySubjectCatalog,
  composeInitiativeClassificationCompletenessPolicy,
} from "./initiative-entry.js"
import {
  ManagedExecutionService,
  type ManagedExecutionApplyInput,
  type ManagedExecutionHandle,
  type ManagedExecutionReview,
  type ManagedExecutionStartInput,
  type ManagedPendingReviewStatus,
  type ManagedRunListPage,
  type ManagedRunListPageInput,
  type ManagedWorkflowGateEvaluator,
} from "./managed-execution.js"
import { ProductStudioService } from "./product-studio.js"
import { SourceGovernanceService } from "./source-governance.js"
import { BusinessCapabilityMapService } from "./business-capability-map.js"
import { BusinessArchitectureBaselineService } from "./business-architecture-baseline.js"
import { BusinessRuleCatalogService } from "./business-rule-catalog.js"
import { BusinessUnderstandingService } from "./business-understanding.js"
import { OperatingModelService } from "./operating-model.js"
import { ValueStreamModelService } from "./value-stream-model.js"
import { SystemSolutionArchitectureService } from "./system-solution-architecture.js"
import { BoundedContextModelService } from "./bounded-context-model.js"
import { SecurityPrivacyAssessmentService } from "./security-privacy-assessment.js"
import { ProcessModelService } from "./process-model.js"
import { DataModelService } from "./data-model.js"
import { AuthorizationModelService } from "./authorization-model.js"
import { EventIntegrationModelService } from "./event-integration-model.js"
import { FailureRecoveryModelService } from "./failure-recovery-model.js"
import { ArchitectureChallengeModelService } from "./architecture-challenge-model.js"
import { DecisionRegisterService } from "./decision-register.js"
import { RiskRegisterService } from "./risk-register.js"
import { EvidenceRegistryService } from "./evidence-registry.js"
import { EndToEndTraceabilityService } from "./end-to-end-traceability.js"
import { P0P4ReadinessGateService } from "./p0-p4-readiness-gate.js"
import { P5HandoffPackageService } from "./p5-handoff-package.js"
import { DesignApplicabilityService } from "./design-applicability.js"
import { DesignPersonaRoleModelService } from "./design-persona-role-model.js"

const execFileAsync = promisify(execFile)

export const initiativeTransitions = {
  proposed: ["active", "cancelled"],
  active: ["blocked", "completed", "cancelled"],
  blocked: ["active", "cancelled"],
  completed: [],
  cancelled: [],
} as const satisfies Record<Initiative["state"], readonly Initiative["state"][]>

export const runTransitions = {
  prepared: ["running", "failed", "cancelled"],
  running: ["paused", "completed", "failed", "cancelled", "unknown"],
  paused: ["running", "failed", "cancelled", "unknown"],
  completed: [],
  failed: [],
  cancelled: [],
  unknown: ["running", "failed", "cancelled"],
} as const satisfies Record<Run["state"], readonly Run["state"][]>

export type GovernedAgentSelectionResult =
  | { status: "selected"; selection: AgentSelection }
  | {
      status: "blocked"
      reason: "active-run" | "capabilities-changed" | "handoff-required" | "migration-required" | "invalid-selection"
    }

export type ManagedReadOnlyGatePhase =
  | "preconditions"
  | "outputs"
  | "evidence"
  | "stop-conditions"
  | "charter-evidence"
  | "charter-stop-conditions"

export interface ManagedReadOnlyGatePreview {
  key: string
  stepId?: string
  phase: ManagedReadOnlyGatePhase
  criteria: string[]
  criteriaDigest: `sha256:${string}`
}

export interface ManagedReadOnlyExecutionPreview {
  schemaVersion: 1
  kind: "managed-readonly-preview"
  productId: string
  initiativeId: string
  charterId: string
  charterDigest: `sha256:${string}`
  workflowPlanId: string
  workflowPlanDigest: `sha256:${string}`
  adapterId: string
  agentId: string
  modelId: string
  selectionDigest: `sha256:${string}`
  strategy: WorkflowPlan["strategy"]
  stepIds: string[]
  contextPackCount: number
  readScopeCount: number
  gates: ManagedReadOnlyGatePreview[]
  authorityBoundary: "managed-readonly-preview-does-not-grant-execution-or-effect-authority"
  previewDigest: `sha256:${string}`
}

export interface ManagedReadOnlyExecutionReceipt {
  schemaVersion: 1
  kind: "managed-readonly-receipt"
  previewDigest: `sha256:${string}`
  runId: string
  managedRunId: string
  productId: string
  initiativeId: string
  adapterId: string
  agentId: string
  modelId: string
  mode: ManagedRunRecord["mode"]
  state: ManagedRunRecord["state"]
  providerDisposition: ManagedRunResult["providerDisposition"]
  outcomeStatus: ManagedRunResult["outcome"]["status"]
  outcomeBasis: ManagedRunResult["outcome"]["basis"]
  eventCount: number
  completedStepCount: number
  totalStepCount: number
  resultDigest: `sha256:${string}`
  evidenceDigest: `sha256:${string}`
  warnings: ManagedRunResult["warnings"]
  startedAt: string
  endedAt: string
  authorityBoundary: "managed-readonly-receipt-does-not-grant-tool-write-effect-or-outcome-authority"
}

function requireUuid(value: string, label: string): string {
  const result = productSchema.shape.id.safeParse(value)
  if (!result.success) throw new Error(`${label} must be a UUID`)
  return result.data
}

function sha256Digest(value: unknown): `sha256:${string}` {
  return canonicalDigest(value) as `sha256:${string}`
}

function revisionOf(value: { revision?: number }): number {
  return value.revision ?? 1
}

function assertTransition<TState extends string>(
  current: TState,
  next: TState,
  transitions: Readonly<Record<TState, readonly TState[]>>,
  subject: string,
): void {
  if (!transitions[current].includes(next)) {
    throw new Error(`Invalid ${subject} transition from ${current} to ${next}`)
  }
}

export interface ProductInput {
  name: string
  summary: string
  problem: string
  affectedUsers: string
  desiredOutcome: string
  successSignals: string[]
  firstWorkflow: string
  exclusions: string[]
  profile: Product["profile"]
}

export interface InitiativeInput {
  title: string
  outcome: string
  scope: string[]
  exclusions: string[]
}

export interface HandoffInput {
  fromRunId: string
  toCapabilities: AdapterCapabilities
  toModelId: string
  toSettings: Record<string, unknown>
  reason: string
  completedWork: string[]
  unresolvedMatters: string[]
  decisions: string[]
  evidence: string[]
}

export interface LegacyAgentSelectionMigrationInput {
  capabilities: AdapterCapabilities
  modelId: string
  settings: Record<string, unknown>
  confirmation: "reconfirm-portable-agent-selection"
}

export class GaepEngine {
  readonly repository: GaepRepository
  readonly productStudio: ProductStudioService
  readonly sourceGovernance: SourceGovernanceService
  readonly businessUnderstanding: BusinessUnderstandingService
  readonly businessCapabilityMap: BusinessCapabilityMapService
  readonly valueStreamModel: ValueStreamModelService
  readonly operatingModel: OperatingModelService
  readonly businessRuleCatalog: BusinessRuleCatalogService
  readonly businessArchitectureBaseline: BusinessArchitectureBaselineService
  readonly systemSolutionArchitecture: SystemSolutionArchitectureService
  readonly boundedContextModel: BoundedContextModelService
  readonly securityPrivacyAssessment: SecurityPrivacyAssessmentService
  readonly processModel: ProcessModelService
  readonly dataModel: DataModelService
  readonly authorizationModel: AuthorizationModelService
  readonly eventIntegrationModel: EventIntegrationModelService
  readonly failureRecoveryModel: FailureRecoveryModelService
  readonly architectureChallengeModel: ArchitectureChallengeModelService
  readonly decisionRegister: DecisionRegisterService
  readonly riskRegister: RiskRegisterService
  readonly evidenceRegistry: EvidenceRegistryService
  readonly endToEndTraceability: EndToEndTraceabilityService
  readonly p0P4ReadinessGate: P0P4ReadinessGateService
  readonly p5HandoffPackage: P5HandoffPackageService
  readonly designApplicability: DesignApplicabilityService
  readonly designPersonaRoleModel: DesignPersonaRoleModelService
  readonly managedExecution: ManagedExecutionService
  readonly adapters = new Map<string, AgentAdapter>()

  constructor(
    readonly workspacePath: string,
    adapters: AgentAdapter[],
    repositoryOptions: GaepRepositoryOptions = {},
    managedStageRegistry: ManagedStageRegistry = new ManagedStageRegistry(),
  ) {
    this.repository = new GaepRepository(workspacePath, repositoryOptions)
    this.productStudio = new ProductStudioService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
    )
    this.sourceGovernance = new SourceGovernanceService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      (reference) => this.productStudio.resolveExactDomainRecord(reference),
    )
    this.businessUnderstanding = new BusinessUnderstandingService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
    )
    this.businessCapabilityMap = new BusinessCapabilityMapService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
      this.businessUnderstanding,
    )
    this.valueStreamModel = new ValueStreamModelService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
      this.businessUnderstanding,
      this.businessCapabilityMap,
    )
    this.operatingModel = new OperatingModelService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
      this.businessUnderstanding,
      this.businessCapabilityMap,
      this.valueStreamModel,
    )
    this.businessRuleCatalog = new BusinessRuleCatalogService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
      this.businessUnderstanding,
      this.businessCapabilityMap,
      this.valueStreamModel,
      this.operatingModel,
    )
    this.businessArchitectureBaseline = new BusinessArchitectureBaselineService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
      this.businessUnderstanding,
      this.businessCapabilityMap,
      this.valueStreamModel,
      this.operatingModel,
      this.businessRuleCatalog,
    )
    this.systemSolutionArchitecture = new SystemSolutionArchitectureService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
      this.businessArchitectureBaseline,
      this.operatingModel,
    )
    this.boundedContextModel = new BoundedContextModelService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
      this.systemSolutionArchitecture,
      this.businessArchitectureBaseline,
      this.operatingModel,
    )
    this.securityPrivacyAssessment = new SecurityPrivacyAssessmentService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
      this.boundedContextModel,
      this.systemSolutionArchitecture,
      this.businessArchitectureBaseline,
      this.operatingModel,
    )
    this.processModel = new ProcessModelService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
      this.valueStreamModel,
      this.operatingModel,
      this.businessRuleCatalog,
      this.boundedContextModel,
      this.securityPrivacyAssessment,
    )
    this.dataModel = new DataModelService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
      this.systemSolutionArchitecture,
      this.boundedContextModel,
      this.operatingModel,
      this.securityPrivacyAssessment,
      this.processModel,
    )
    this.authorizationModel = new AuthorizationModelService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
      this.systemSolutionArchitecture,
      this.boundedContextModel,
      this.operatingModel,
      this.securityPrivacyAssessment,
      this.processModel,
      this.dataModel,
    )
    this.eventIntegrationModel = new EventIntegrationModelService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
      this.systemSolutionArchitecture,
      this.boundedContextModel,
      this.operatingModel,
      this.securityPrivacyAssessment,
      this.processModel,
      this.dataModel,
      this.authorizationModel,
    )
    this.failureRecoveryModel = new FailureRecoveryModelService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
      this.systemSolutionArchitecture,
      this.boundedContextModel,
      this.operatingModel,
      this.securityPrivacyAssessment,
      this.processModel,
      this.dataModel,
      this.authorizationModel,
      this.eventIntegrationModel,
    )
    this.architectureChallengeModel = new ArchitectureChallengeModelService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
      this.systemSolutionArchitecture,
      this.boundedContextModel,
      this.operatingModel,
      this.securityPrivacyAssessment,
      this.processModel,
      this.dataModel,
      this.authorizationModel,
      this.eventIntegrationModel,
      this.failureRecoveryModel,
    )
    this.decisionRegister = new DecisionRegisterService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
      this.operatingModel,
      this.architectureChallengeModel,
    )
    this.riskRegister = new RiskRegisterService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
      this.operatingModel,
      this.architectureChallengeModel,
      this.securityPrivacyAssessment,
      this.decisionRegister,
    )
    this.evidenceRegistry = new EvidenceRegistryService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
      this.operatingModel,
      this.architectureChallengeModel,
      this.securityPrivacyAssessment,
      this.decisionRegister,
      this.riskRegister,
    )
    this.endToEndTraceability = new EndToEndTraceabilityService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
      this.evidenceRegistry,
    )
    this.p0P4ReadinessGate = new P0P4ReadinessGateService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
      this.evidenceRegistry,
      this.endToEndTraceability,
    )
    this.p5HandoffPackage = new P5HandoffPackageService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
      this.p0P4ReadinessGate,
    )
    this.designApplicability = new DesignApplicabilityService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
    )
    this.designPersonaRoleModel = new DesignPersonaRoleModelService(
      this.repository,
      () => this.readProduct(),
      (id) => this.readInitiative(id),
      this.sourceGovernance,
      this.businessUnderstanding,
      this.designApplicability,
    )
    for (const adapter of adapters) {
      if (this.adapters.has(adapter.id)) throw new Error(`Duplicate adapter ${adapter.id}`)
      this.adapters.set(adapter.id, adapter)
    }
    this.managedExecution = new ManagedExecutionService(
      this.workspacePath,
      this.repository,
      this.productStudio,
      this.adapters,
      managedStageRegistry,
    )
  }

  async probeAgents(): Promise<AdapterCapabilities[]> {
    const results = await Promise.all(
      [...this.adapters.values()].map((adapter) => this.probeAdapter(adapter, { refreshModels: true })),
    )
    return results.map((result) => result.capabilities)
  }

  async createProduct(input: ProductInput, actorId: string): Promise<Product> {
    const now = new Date().toISOString()
    const product = productSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      kind: "product",
      revision: 1,
      ...input,
      lifecycleState: "active",
      createdAt: now,
      updatedAt: now,
    })
    await this.repository.withLock(async () => {
      await this.repository.assertCanCreateProduct()
      await this.repository.prepareLayout()
      const manifest = this.repository.createManifest(product.id)
      const productRevision = productRevisionSchema.parse({
        schemaVersion: 1,
        kind: "product-revision",
        productId: product.id,
        revision: revisionOf(product),
        product,
        source: { kind: "initialization", id: product.id },
        productDigest: canonicalDigest(product),
        recordedAt: now,
      })
      await this.repository.commitMutation({
        initialization: true,
        writes: [
          {
            path: this.repository.resolve("manifest.json"),
            value: manifest,
            schema: repositoryManifestSchema,
            governed: true,
          },
          {
            path: this.repository.resolve("product.json"),
            value: product,
            schema: productSchema,
            governed: true,
          },
          {
            path: this.repository.resolve("product-history", `product-${product.id}-r1.json`),
            value: productRevision,
            schema: productRevisionSchema,
            governed: true,
          },
        ],
        audit: {
          eventType: "product.created",
          actor: { kind: "human", id: actorId },
          subjectId: product.id,
          payload: { profile: product.profile, revision: revisionOf(product), recordDigest: canonicalDigest(product) },
        },
      })
    })
    return product
  }

  async readProduct(): Promise<Product> {
    const [manifest, product] = await Promise.all([
      this.repository.readJson(this.repository.resolve("manifest.json"), repositoryManifestSchema),
      this.repository.readJson(this.repository.resolve("product.json"), productSchema),
    ])
    if (manifest.productId !== product.id) throw new Error("GAEP manifest and Product identity do not match")
    return product
  }

  async workspaceHealth() {
    const health = await this.repository.workspaceHealth()
    if (!health.initialized || health.status === "invalid") return health
    let domainIssues
    try {
      const [productIssues, sourceIssues, businessIssues, capabilityMapIssues, valueStreamIssues, operatingModelIssues, businessRuleIssues, businessArchitectureIssues, systemSolutionArchitectureIssues, boundedContextModelIssues, securityPrivacyAssessmentIssues, processModelIssues, dataModelIssues, authorizationModelIssues, eventIntegrationModelIssues, failureRecoveryModelIssues, architectureChallengeModelIssues, decisionRegisterIssues, riskRegisterIssues, evidenceRegistryIssues, traceabilityIssues, p0P4ReadinessGateIssues, p5HandoffPackageIssues, designApplicabilityIssues, designPersonaRoleIssues] = await Promise.all([
        this.productStudio.healthIssues(),
        this.sourceGovernance.healthIssues(),
        this.businessUnderstanding.healthIssues(),
        this.businessCapabilityMap.healthIssues(),
        this.valueStreamModel.healthIssues(),
        this.operatingModel.healthIssues(),
        this.businessRuleCatalog.healthIssues(),
        this.businessArchitectureBaseline.healthIssues(),
        this.systemSolutionArchitecture.healthIssues(),
        this.boundedContextModel.healthIssues(),
        this.securityPrivacyAssessment.healthIssues(),
        this.processModel.healthIssues(),
        this.dataModel.healthIssues(),
        this.authorizationModel.healthIssues(),
        this.eventIntegrationModel.healthIssues(),
        this.failureRecoveryModel.healthIssues(),
        this.architectureChallengeModel.healthIssues(),
        this.decisionRegister.healthIssues(),
        this.riskRegister.healthIssues(),
        this.evidenceRegistry.healthIssues(),
        this.endToEndTraceability.healthIssues(),
        this.p0P4ReadinessGate.healthIssues(),
        this.p5HandoffPackage.healthIssues(),
        this.designApplicability.healthIssues(),
        this.designPersonaRoleModel.healthIssues(),
      ])
      domainIssues = [
        ...productIssues,
        ...sourceIssues,
        ...businessIssues,
        ...capabilityMapIssues,
        ...valueStreamIssues,
        ...operatingModelIssues,
        ...businessRuleIssues,
        ...businessArchitectureIssues,
        ...systemSolutionArchitectureIssues,
        ...boundedContextModelIssues,
        ...securityPrivacyAssessmentIssues,
        ...processModelIssues,
        ...dataModelIssues,
        ...authorizationModelIssues,
        ...eventIntegrationModelIssues,
        ...failureRecoveryModelIssues,
        ...architectureChallengeModelIssues,
        ...decisionRegisterIssues,
        ...riskRegisterIssues,
        ...evidenceRegistryIssues,
        ...traceabilityIssues,
        ...p0P4ReadinessGateIssues,
        ...p5HandoffPackageIssues,
        ...designApplicabilityIssues,
        ...designPersonaRoleIssues,
      ]
    } catch (error) {
      domainIssues = [{
        code: "product.health-evaluation-failed" as const,
        severity: "error" as const,
        message: error instanceof Error ? error.message : "Product-domain health evaluation failed.",
      }]
    }
    const issues = [...health.issues, ...domainIssues]
    const status = issues.some((issue) => issue.severity === "error")
      ? "invalid"
      : issues.length > 0
        ? "degraded"
        : "healthy"
    return workspaceHealthSchema.parse({ ...health, status, issues })
  }

  async createInitiative(input: InitiativeInput, actorId: string): Promise<Initiative> {
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      const product = await this.readProduct()
      const now = new Date().toISOString()
      const initiative = initiativeSchema.parse({
        schemaVersion: 1,
        id: randomUUID(),
        kind: "initiative",
        revision: 1,
        productId: product.id,
        ...input,
        state: "proposed",
        createdAt: now,
        updatedAt: now,
      })
      await this.repository.commitMutation({
        writes: [{
          path: this.repository.resolve("initiatives", `${initiative.id}.json`),
          value: initiative,
          schema: initiativeSchema,
          governed: true,
        }],
        audit: {
          eventType: "initiative.created",
          actor: { kind: "human", id: actorId },
          subjectId: initiative.id,
          payload: {
            productId: product.id,
            revision: revisionOf(initiative),
            recordDigest: canonicalDigest(initiative),
          },
        },
      })
      return initiative
    })
  }

  async readInitiative(id: string): Promise<Initiative> {
    const initiativeId = requireUuid(id, "Initiative ID")
    const initiative = await this.repository.readJson(
      this.repository.resolve("initiatives", `${initiativeId}.json`),
      initiativeSchema,
    )
    const product = await this.readProduct()
    if (initiative.productId !== product.id) throw new Error("Initiative does not target this Product")
    return initiative
  }

  async assessInitiativeEntry(id: string): Promise<InitiativeEntryAssessment> {
    const [initiative, product] = await Promise.all([
      this.readInitiative(id),
      this.readProduct(),
    ])
    const productDigest = sha256Digest(product)
    const classificationDigest = initiative.classification
      ? sha256Digest(initiative.classification)
      : undefined
    const completeness = assessInitiativeClassificationCompleteness(product, initiative.classification)
    const classificationPolicyCurrent = initiative.classification !== undefined &&
      initiative.classification.completenessPolicyVersion === completeness.policy.policyVersion &&
      initiative.classification.completenessPolicyDigest === completeness.policyDigest
    const classificationStatus = !initiative.classification
      ? "missing" as const
      : initiative.classification.productRevision !== revisionOf(product) ||
          initiative.classification.productDigest !== productDigest ||
          initiative.classification.productProfile !== product.profile ||
          !classificationPolicyCurrent
        ? "stale" as const
        : "current" as const
    const matrix = initiative.applicability
    const coverage = initiative.classification
      ? assessInitiativeApplicabilityCoverage(product, initiative.classification, matrix)
      : undefined
    const matrixCatalogCurrent = matrix !== undefined && coverage !== undefined &&
      matrix.subjectCatalog?.catalogVersion === coverage.catalog.catalogVersion &&
      matrix.subjectCatalog.digest === coverage.catalogDigest &&
      matrix.subjectCatalog.subjectCount === coverage.catalog.subjects.length
    const applicabilityStatus = !matrix
      ? "missing" as const
      : matrix.state !== "current" || classificationStatus !== "current" ||
          matrix.classificationDigest !== classificationDigest ||
          !matrixCatalogCurrent
        ? "stale" as const
        : "current" as const
    const pendingHumanDecisionCount = matrix?.decisions
      .filter((decision) => decision.status === "awaiting-human-decision").length ?? 0
    const blockedDecisionCount = matrix?.decisions
      .filter((decision) => decision.status === "blocked").length ?? 0
    const pendingApprovalCount = matrix?.decisions
      .filter((decision) => decision.approval.state === "pending").length ?? 0
    const rejectedApprovalCount = matrix?.decisions
      .filter((decision) => decision.approval.state === "rejected").length ?? 0
    const reasons: string[] = []
    if (classificationStatus === "missing") reasons.push("Initiative classification is missing")
    if (classificationStatus === "stale") reasons.push("Initiative classification does not bind the current Product and completeness policy")
    if (classificationStatus === "current" && completeness.status === "incomplete") {
      reasons.push("Initiative classification does not satisfy the current completeness policy")
    }
    if (applicabilityStatus === "missing") reasons.push("Initiative applicability has not been resolved")
    if (applicabilityStatus === "stale") reasons.push("Initiative applicability does not bind the current classification and subject catalog")
    if (applicabilityStatus === "current" && coverage?.status === "incomplete") {
      reasons.push("Initiative applicability does not cover every canonical subject")
    }
    if ((matrix?.unresolvedSubjects.length ?? 0) > 0) reasons.push("Applicability subjects remain explicitly unresolved")
    if (pendingHumanDecisionCount > 0) reasons.push("Applicability decisions await accountable human judgment")
    if (blockedDecisionCount > 0) reasons.push("One or more required applicability decisions are blocked")
    if (pendingApprovalCount > 0) reasons.push("Applicability approvals remain pending")
    if (rejectedApprovalCount > 0) reasons.push("One or more applicability approvals were rejected")
    const state = blockedDecisionCount > 0 || rejectedApprovalCount > 0
      ? "blocked" as const
      : reasons.length > 0
        ? "attention-required" as const
        : "ready" as const
    return initiativeEntryAssessmentSchema.parse({
      schemaVersion: 1,
      kind: "initiative-entry-assessment",
      initiativeId: initiative.id,
      initiativeRevision: revisionOf(initiative),
      productId: product.id,
      productRevision: revisionOf(product),
      productDigest,
      classification: {
        status: classificationStatus,
        digest: classificationDigest,
        completeness: {
          status: classificationStatus === "missing"
            ? "missing"
            : classificationStatus === "stale"
              ? "stale"
              : completeness.status,
          policyVersion: completeness.policy.policyVersion,
          policyDigest: completeness.policyDigest,
          unknownDimensionCount: completeness.unknownDimensions.length,
          unresolvedQuestionCount: completeness.unresolvedQuestionCount,
          missingConditionalDimensionCount: completeness.missingConditionalDimensions.length,
          confidenceSufficient: completeness.confidenceSufficient,
        },
      },
      applicability: {
        status: applicabilityStatus,
        matrixRevision: matrix?.revision,
        digest: matrix ? sha256Digest(matrix) : undefined,
        decisionCount: matrix?.decisions.length ?? 0,
        unresolvedSubjectCount: matrix?.unresolvedSubjects.length ?? 0,
        pendingHumanDecisionCount,
        blockedDecisionCount,
        pendingApprovalCount,
        rejectedApprovalCount,
        coverage: coverage
          ? {
              status: applicabilityStatus === "stale"
                ? "stale"
                : coverage.status,
              catalogVersion: coverage.catalog.catalogVersion,
              catalogDigest: coverage.catalogDigest,
              subjectCount: coverage.catalog.subjects.length,
              coveredSubjectCount: coverage.coveredSubjectCount,
              missingSubjectCount: coverage.missingSubjects.length,
              unexpectedSubjectCount: coverage.unexpectedSubjects.length,
              mismatchedSubjectCount: coverage.mismatchedSubjects.length,
            }
          : {
              status: "unavailable",
              subjectCount: 0,
              coveredSubjectCount: 0,
              missingSubjectCount: 0,
              unexpectedSubjectCount: 0,
              mismatchedSubjectCount: 0,
            },
      },
      state,
      reasons,
      assessedAt: new Date().toISOString(),
      authorityBoundary: "entry-assessment-is-read-only-and-does-not-grant-approval-readiness-or-action-authority",
    })
  }

  async classifyInitiative(
    id: string,
    input: InitiativeClassificationInput,
    expectedInitiativeRevision: number,
    actorId: string,
  ): Promise<Initiative> {
    const initiativeId = requireUuid(id, "Initiative ID")
    const validatedInput = initiativeClassificationInputSchema.parse(input)
    const path = this.repository.resolve("initiatives", `${initiativeId}.json`)
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      const [current, product] = await Promise.all([
        this.repository.readJson(path, initiativeSchema),
        this.readProduct(),
      ])
      if (current.productId !== product.id) throw new Error("Initiative does not target this Product")
      if (revisionOf(current) !== expectedInitiativeRevision) {
        throw new Error("Initiative changed before classification; reload the exact revision")
      }
      if (["completed", "cancelled"].includes(current.state)) {
        throw new Error(`Terminal Initiative ${current.state} classification is immutable`)
      }
      const now = new Date().toISOString()
      const completenessPolicy = composeInitiativeClassificationCompletenessPolicy(product)
      const previousClassificationDigest = current.classification
        ? sha256Digest(current.classification)
        : undefined
      const classification = initiativeClassificationSchema.parse({
        ...validatedInput,
        productProfile: product.profile,
        productRevision: revisionOf(product),
        productDigest: sha256Digest(product),
        completenessPolicyVersion: completenessPolicy.policyVersion,
        completenessPolicyDigest: sha256Digest(completenessPolicy),
        classifiedBy: { kind: "human", id: actorId },
        classifiedAt: now,
        authorityBoundary: "classification-guides-profile-selection-and-does-not-grant-approval-or-action-authority",
      })
      const classificationDigest = sha256Digest(classification)
      const applicability = current.applicability?.state === "current"
        ? initiativeApplicabilityMatrixSchema.parse({
            ...current.applicability,
            state: "stale",
            invalidatedAt: now,
            invalidationReason: "Initiative classification was superseded",
          })
        : current.applicability
      const updated = initiativeSchema.parse({
        ...current,
        revision: revisionOf(current) + 1,
        classification,
        applicability,
        updatedAt: now,
      })
      await this.repository.commitMutation({
        writes: [{ path, value: updated, schema: initiativeSchema, governed: true }],
        audit: {
          eventType: "initiative.classified",
          actor: { kind: "human", id: actorId },
          subjectId: initiativeId,
          payload: {
            productId: product.id,
            primaryType: classification.primaryType,
            secondaryTypeCount: classification.secondaryTypes.length,
            classificationDigest,
            previousClassificationDigest,
            applicabilityInvalidated: current.applicability?.state === "current",
            revision: revisionOf(updated),
            recordDigest: sha256Digest(updated),
          },
        },
      })
      return updated
    })
  }

  async resolveInitiativeApplicability(
    id: string,
    input: InitiativeApplicabilityMatrixInput,
    expectedInitiativeRevision: number,
    actorId: string,
  ): Promise<Initiative> {
    const initiativeId = requireUuid(id, "Initiative ID")
    const validatedInput = initiativeApplicabilityMatrixInputSchema.parse(input)
    const path = this.repository.resolve("initiatives", `${initiativeId}.json`)
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      const [current, product] = await Promise.all([
        this.repository.readJson(path, initiativeSchema),
        this.readProduct(),
      ])
      if (current.productId !== product.id) throw new Error("Initiative does not target this Product")
      if (revisionOf(current) !== expectedInitiativeRevision) {
        throw new Error("Initiative changed before applicability resolution; reload the exact revision")
      }
      if (["completed", "cancelled"].includes(current.state)) {
        throw new Error(`Terminal Initiative ${current.state} applicability is immutable`)
      }
      if (!current.classification) {
        throw new Error("Initiative applicability requires an exact current classification")
      }
      if (current.classification.productRevision !== revisionOf(product) ||
          current.classification.productDigest !== sha256Digest(product) ||
          current.classification.productProfile !== product.profile) {
        throw new Error("Initiative classification does not bind the current Product; reclassify before applicability resolution")
      }
      const now = new Date().toISOString()
      const subjectCatalog = composeInitiativeApplicabilitySubjectCatalog(product, current.classification)
      const subjectCatalogDigest = sha256Digest(subjectCatalog)
      if (validatedInput.subjectCatalog && (
        validatedInput.subjectCatalog.catalogVersion !== subjectCatalog.catalogVersion ||
        validatedInput.subjectCatalog.digest !== subjectCatalogDigest ||
        validatedInput.subjectCatalog.subjectCount !== subjectCatalog.subjects.length
      )) {
        throw new Error("Initiative applicability subject catalog changed; reload the exact current catalog")
      }
      const nextInitiativeRevision = revisionOf(current) + 1
      const previousDecisions = new Map((current.applicability?.decisions ?? []).map((decision) => [
        `${decision.subject.type}:${decision.subject.key}`,
        decision,
      ]))
      const decisions = validatedInput.decisions.map((decision) => {
        const previous = previousDecisions.get(`${decision.subject.type}:${decision.subject.key}`)
        return {
          ...decision,
          id: previous?.id ?? randomUUID(),
          revision: (previous?.revision ?? 0) + 1,
          initiativeRevision: nextInitiativeRevision,
          decidedBy: { kind: "human" as const, id: actorId },
          decidedAt: now,
          authorityBoundary: "applicability-decision-does-not-grant-approval-readiness-or-action-authority" as const,
        }
      })
      const matrix = initiativeApplicabilityMatrixSchema.parse({
        schemaVersion: 1,
        kind: "initiative-applicability-matrix",
        revision: (current.applicability?.revision ?? 0) + 1,
        initiativeId: current.id,
        productId: current.productId,
        initiativeRevision: nextInitiativeRevision,
        classificationDigest: sha256Digest(current.classification),
        subjectCatalog: {
          catalogVersion: subjectCatalog.catalogVersion,
          digest: subjectCatalogDigest,
          subjectCount: subjectCatalog.subjects.length,
        },
        state: "current",
        decisions,
        unresolvedSubjects: validatedInput.unresolvedSubjects,
        evaluatedBy: { kind: "human", id: actorId },
        evaluatedAt: now,
        authorityBoundary: "applicability-matrix-does-not-grant-approval-readiness-or-action-authority",
      })
      const updated = initiativeSchema.parse({
        ...current,
        revision: nextInitiativeRevision,
        applicability: matrix,
        updatedAt: now,
      })
      const statusCounts = Object.fromEntries([...new Set(matrix.decisions.map((decision) => decision.status))]
        .sort()
        .map((status) => [status, matrix.decisions.filter((decision) => decision.status === status).length]))
      await this.repository.commitMutation({
        writes: [{ path, value: updated, schema: initiativeSchema, governed: true }],
        audit: {
          eventType: "initiative.applicability.resolved",
          actor: { kind: "human", id: actorId },
          subjectId: initiativeId,
          payload: {
            productId: current.productId,
            classificationDigest: matrix.classificationDigest,
            matrixRevision: matrix.revision,
            matrixDigest: sha256Digest(matrix),
            subjectCatalogDigest,
            subjectCatalogSubjectCount: subjectCatalog.subjects.length,
            decisionCount: matrix.decisions.length,
            unresolvedSubjectCount: matrix.unresolvedSubjects.length,
            statusCounts,
            revision: revisionOf(updated),
            recordDigest: sha256Digest(updated),
          },
        },
      })
      return updated
    })
  }

  async updateInitiativeState(
    id: string,
    state: Initiative["state"],
    reason: string,
    actorId: string,
  ): Promise<Initiative> {
    if (reason.trim().length < 2) throw new Error("A state-change reason is required")
    const initiativeId = requireUuid(id, "Initiative ID")
    const path = this.repository.resolve("initiatives", `${initiativeId}.json`)
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      const current = await this.repository.readJson(path, initiativeSchema)
      assertTransition(current.state, state, initiativeTransitions, "Initiative")
      let entryGate: {
        assessmentDigest: string
        assessedAt: string
        classificationDigest: string
        completenessPolicyDigest: string
        applicabilityDigest: string
        subjectCatalogDigest: string
      } | undefined
      if (current.state === "proposed" && state === "active") {
        const entryAssessment = await this.assessInitiativeEntry(initiativeId)
        if (entryAssessment.state !== "ready") {
          throw new Error(`Initiative cannot become active until the entry gate is ready: ${entryAssessment.reasons.join("; ")}`)
        }
        entryGate = {
          assessmentDigest: canonicalDigest(entryAssessment),
          assessedAt: entryAssessment.assessedAt,
          classificationDigest: entryAssessment.classification.digest!,
          completenessPolicyDigest: entryAssessment.classification.completeness!.policyDigest,
          applicabilityDigest: entryAssessment.applicability.digest!,
          subjectCatalogDigest: entryAssessment.applicability.coverage!.catalogDigest!,
        }
      }
      if (state === "completed" || state === "cancelled") {
        const nonTerminalRuns = (await this.listRuns()).filter((run) =>
          run.initiativeId === initiativeId && ["prepared", "running", "paused", "unknown"].includes(run.state),
        )
        if (nonTerminalRuns.length > 0) {
          const summary = nonTerminalRuns.map((run) => `${run.id}:${run.state}`).join(", ")
          throw new Error(
            `Initiative cannot become ${state} while associated Runs remain non-terminal: ${summary}`,
          )
        }
      }
      const updated = initiativeSchema.parse({
        ...current,
        revision: revisionOf(current) + 1,
        state,
        updatedAt: new Date().toISOString(),
      })
      await this.repository.commitMutation({
        writes: [{ path, value: updated, schema: initiativeSchema, governed: true }],
        audit: {
          eventType: "initiative.state.changed",
          actor: { kind: "human", id: actorId },
          subjectId: initiativeId,
          payload: {
            from: current.state,
            to: state,
            reason,
            revision: revisionOf(updated),
            recordDigest: canonicalDigest(updated),
            productMutation: false,
            ...(entryGate ? { entryGate } : {}),
          },
        },
      })
      return updated
    })
  }

  async selectAgent(
    capabilities: AdapterCapabilities,
    modelId: string,
    settings: Record<string, unknown>,
    actorId: string,
  ): Promise<AgentSelection> {
    const suppliedCapabilities = adapterCapabilitiesSchema.parse(capabilities)
    const adapter = this.adapters.get(suppliedCapabilities.adapterId)
    if (!adapter) throw new Error(`Adapter ${suppliedCapabilities.adapterId} is not registered`)
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      await this.readProduct()
      return this.commitAgentSelection(adapter, suppliedCapabilities, modelId, settings, actorId)
    })
  }

  async selectAgentGoverned(
    capabilities: AdapterCapabilities,
    modelId: string,
    settings: Record<string, unknown>,
    actorId: string,
  ): Promise<GovernedAgentSelectionResult> {
    const suppliedCapabilities = adapterCapabilitiesSchema.parse(capabilities)
    const portableSettings = portableSelectionSettingsSchema.parse(settings)
    const adapter = this.adapters.get(suppliedCapabilities.adapterId)
    if (!adapter) throw new Error(`Adapter ${suppliedCapabilities.adapterId} is not registered`)
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      await this.readProduct()
      const selectionState = await this.readSelectionState()
      const runs = await this.listRuns()
      if (runs.some((run) => !["completed", "failed", "cancelled"].includes(run.state))) {
        return { status: "blocked", reason: "active-run" }
      }
      if (selectionState.status === "migration-required") {
        return { status: "blocked", reason: "migration-required" }
      }
      if (selectionState.status === "invalid") {
        return { status: "blocked", reason: "invalid-selection" }
      }
      if (selectionState.status === "selected") {
        const changed = selectionState.selection.adapterId !== suppliedCapabilities.adapterId ||
          selectionState.selection.modelId !== modelId ||
          canonicalDigest(selectionState.selection.settings) !== canonicalDigest(portableSettings)
        if (changed && runs.length > 0) return { status: "blocked", reason: "handoff-required" }
      }
      const { capabilities: observedCapabilities } = await this.probeAdapter(adapter, { refreshModels: true })
      if (capabilityDigest(observedCapabilities) !== capabilityDigest(suppliedCapabilities)) {
        return { status: "blocked", reason: "capabilities-changed" }
      }
      return {
        status: "selected",
        selection: await this.persistAgentSelection(
          adapter,
          observedCapabilities,
          modelId,
          portableSettings,
          actorId,
        ),
      }
    })
  }

  async readSelectionState(): Promise<AgentSelectionState> {
    let compatibility
    try {
      compatibility = await this.repository.readAgentSelectionCompatibility()
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return agentSelectionStateSchema.parse({ status: "unselected" })
      }
      throw error
    }
    if (compatibility.status === "current") {
      return agentSelectionStateSchema.parse({ status: "selected", selection: compatibility.selection })
    }
    if (compatibility.status === "migration-required") {
      return agentSelectionStateSchema.parse({
        status: "migration-required",
        portableCandidate: compatibility.portableCandidate,
      })
    }
    return agentSelectionStateSchema.parse({ status: "invalid" })
  }

  async readSelection(): Promise<AgentSelection> {
    const compatibility = await this.repository.readAgentSelectionCompatibility()
    if (compatibility.status === "current") return compatibility.selection
    if (compatibility.status === "migration-required") {
      throw new Error("The persisted Agent Selection is legacy and requires explicit re-probe and reconfirmation")
    }
    throw new Error(`The persisted Agent Selection is invalid: ${compatibility.issues.join("; ")}`)
  }

  private async commitAgentSelection(
    adapter: AgentAdapter,
    suppliedCapabilities: AdapterCapabilities,
    modelId: string,
    settings: Record<string, unknown>,
    actorId: string,
  ): Promise<AgentSelection> {
    const { capabilities: observedCapabilities } = await this.probeAdapter(adapter, { refreshModels: true })
    if (capabilityDigest(observedCapabilities) !== capabilityDigest(suppliedCapabilities)) {
      throw new Error("Agent capabilities changed or were not produced by the registered adapter; probe again")
    }
    return this.persistAgentSelection(adapter, observedCapabilities, modelId, settings, actorId)
  }

  private async persistAgentSelection(
    adapter: AgentAdapter,
    observedCapabilities: AdapterCapabilities,
    modelId: string,
    settings: Record<string, unknown>,
    actorId: string,
  ): Promise<AgentSelection> {
    const model = observedCapabilities.models.find((candidate) => candidate.id === modelId)
    const selection = agentSelectionSchema.parse({
      schemaVersion: 2,
      adapterId: observedCapabilities.adapterId,
      agentId: observedCapabilities.agentId,
      modelId,
      modelTruthClass: model?.truthClass ?? "configured",
      modelAlias: model?.alias ?? null,
      settings,
      selectedAt: new Date().toISOString(),
      capabilityDigest: capabilityDigest(observedCapabilities),
    })
    const errors = adapter.validateSelection(selection, observedCapabilities)
    if (errors.length > 0) throw new Error(errors.join("; "))
    const capabilitiesPath = this.capabilitiesPath(observedCapabilities)
    await this.repository.commitMutation({
      writes: [
        {
          path: this.repository.resolve("runtime", "selection.json"),
          value: selection,
          schema: agentSelectionSchema,
          governed: true,
        },
        {
          path: capabilitiesPath,
          value: observedCapabilities,
          schema: adapterCapabilitiesSchema,
          governed: true,
        },
      ],
      audit: {
        eventType: "agent.selected",
        actor: { kind: "human", id: actorId },
        subjectId: selection.agentId,
        payload: {
          modelId,
          adapterId: selection.adapterId,
          capabilityDigest: selection.capabilityDigest,
          selectionDigest: canonicalDigest(selection),
        },
      },
    })
    return selection
  }

  async migrateLegacyAgentSelection(
    input: LegacyAgentSelectionMigrationInput,
    actorId: string,
  ): Promise<AgentSelection> {
    if (input.confirmation !== "reconfirm-portable-agent-selection") {
      throw new Error("Legacy Agent Selection migration requires explicit capability reconfirmation")
    }
    const suppliedCapabilities = adapterCapabilitiesSchema.parse(input.capabilities)
    const adapter = this.adapters.get(suppliedCapabilities.adapterId)
    if (!adapter) throw new Error(`Adapter ${suppliedCapabilities.adapterId} is not registered`)
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      await this.readProduct()
      const legacySelection = await this.repository.readAgentSelectionCompatibility()
      if (legacySelection.status !== "migration-required") {
        throw new Error("Agent Selection migration requires an existing valid legacy Selection")
      }
      if (
        legacySelection.portableCandidate.adapterId !== suppliedCapabilities.adapterId ||
        legacySelection.portableCandidate.agentId !== suppliedCapabilities.agentId
      ) {
        throw new Error("Migration cannot change the legacy Agent identity; perform a separate Agent Selection instead")
      }
      const capabilitiesPath = this.capabilitiesPath(suppliedCapabilities)
      const legacyCapabilities = await this.repository.readAdapterCapabilitiesCompatibility(capabilitiesPath)
      if (legacyCapabilities.status === "invalid") {
        throw new Error(`Legacy capability snapshot is invalid: ${legacyCapabilities.issues.join("; ")}`)
      }
      const persistedCapabilities = legacyCapabilities.status === "current"
        ? legacyCapabilities.capabilities
        : legacyCapabilities.portableCandidate
      if (
        persistedCapabilities.adapterId !== suppliedCapabilities.adapterId ||
        persistedCapabilities.agentId !== suppliedCapabilities.agentId
      ) {
        throw new Error("Persisted legacy capability identity does not match the Selection being migrated")
      }
      const { capabilities: observedCapabilities } = await this.probeAdapter(adapter, { refreshModels: true })
      if (capabilityDigest(observedCapabilities) !== capabilityDigest(suppliedCapabilities)) {
        throw new Error("Agent capabilities changed during migration; probe and reconfirm again")
      }
      const model = observedCapabilities.models.find((candidate) => candidate.id === input.modelId)
      const selection = agentSelectionSchema.parse({
        schemaVersion: 2,
        adapterId: observedCapabilities.adapterId,
        agentId: observedCapabilities.agentId,
        modelId: input.modelId,
        modelTruthClass: model?.truthClass ?? "configured",
        modelAlias: model?.alias ?? null,
        settings: input.settings,
        selectedAt: new Date().toISOString(),
        capabilityDigest: capabilityDigest(observedCapabilities),
      })
      const errors = adapter.validateSelection(selection, observedCapabilities)
      if (errors.length > 0) throw new Error(errors.join("; "))
      await this.repository.commitMutation({
        writes: [
          {
            path: this.repository.resolve("runtime", "selection.json"),
            value: selection,
            schema: agentSelectionSchema,
            governed: true,
          },
          {
            path: capabilitiesPath,
            value: observedCapabilities,
            schema: adapterCapabilitiesSchema,
            governed: true,
          },
        ],
        audit: {
          eventType: "agent.selection.migrated",
          actor: { kind: "human", id: actorId },
          subjectId: selection.agentId,
          payload: {
            adapterId: selection.adapterId,
            modelId: selection.modelId,
            capabilityDigest: selection.capabilityDigest,
            selectionDigest: canonicalDigest(selection),
            capabilityReconfirmed: true,
            machineLocalDataPersisted: false,
          },
        },
      })
      return selection
    })
  }

  async listRuns(): Promise<Run[]> {
    let names: string[]
    try {
      names = (await this.repository.readDirectory(this.repository.resolve("sessions")))
        .filter((name) => /^run-[0-9a-f-]+\.json$/i.test(name))
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return []
      throw error
    }
    const runs = await Promise.all(names.map((name) =>
      this.repository.readJson(this.repository.resolve("sessions", name), runSchema),
    ))
    return runs.sort((left, right) => {
      const leftTime = left.endedAt ?? left.startedAt ?? ""
      const rightTime = right.endedAt ?? right.startedAt ?? ""
      return rightTime.localeCompare(leftTime)
    })
  }

  async listHandoffs(): Promise<Handoff[]> {
    let names: string[]
    try {
      names = (await this.repository.readDirectory(this.repository.resolve("handoffs")))
        .filter((name) => /^[0-9a-f-]+\.json$/i.test(name))
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return []
      throw error
    }
    if (names.length > 2_000) throw new Error("Handoff inventory exceeds the 2,000-record observation limit")
    const handoffs: Handoff[] = []
    for (let index = 0; index < names.length; index += 64) {
      handoffs.push(...await Promise.all(names.slice(index, index + 64).map((name) =>
        this.repository.readJson(this.repository.resolve("handoffs", name), handoffSchema),
      )))
    }
    return handoffs.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))
  }

  async recoverInterruptedRuns(actorId: string): Promise<Run[]> {
    const managedRecovered = await this.managedExecution.recoverInterrupted(actorId)
    const recoveredManagedRuns = await Promise.all(managedRecovered.map((managed) =>
      this.repository.readJson(this.repository.resolve("sessions", `run-${managed.runId}.json`), runSchema),
    ))
    const durableManagedRuns = new Set((await this.managedExecution.list()).map((managed) => managed.runId))
    const interrupted = (await this.listRuns()).filter((run) =>
      run.state === "running" && !durableManagedRuns.has(run.id))
    const recovered: Run[] = [...recoveredManagedRuns]
    for (const run of interrupted) {
      recovered.push(await this.markRunState(
        run.id,
        "unknown",
        { kind: "system", id: actorId },
      ))
    }
    return recovered
  }

  async createCharter(input: {
    initiativeId: string
    objective: string
    permissions: ToolPermission[]
    expectedEffects: ExecutionCharter["expectedEffects"]
    forbiddenActions: string[]
    stopConditions: string[]
    requiredEvidence: string[]
    managedIntent?: ExecutionManagedIntent
  }, actorId: string): Promise<ExecutionCharter> {
    const initiativeId = requireUuid(input.initiativeId, "Initiative ID")
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      const product = await this.readProduct()
      const initiative = await this.readInitiative(initiativeId)
      if (initiative.productId !== product.id) throw new Error("Initiative does not target this Product")
      if (initiative.state !== "active") {
        throw new Error(`Initiative must be active before creating an Execution Charter; current state is ${initiative.state}`)
      }
      const selection = await this.readSelection()
      const managedIntent = input.managedIntent
        ? executionManagedIntentSchema.parse(input.managedIntent)
        : undefined
      if (managedIntent) {
        if (JSON.stringify([...managedIntent.requestedEffects].sort()) !== JSON.stringify([...input.expectedEffects].sort())) {
          throw new Error("Managed Charter intent must exactly bind the Charter expected effects")
        }
        await this.assertManagedIntentBindings(managedIntent, product.id)
      }
      const charter = executionCharterSchema.parse({
        schemaVersion: 1,
        id: randomUUID(),
        productId: product.id,
        initiativeId: initiative.id,
        productRevision: revisionOf(product),
        initiativeRevision: revisionOf(initiative),
        productDigest: canonicalDigest(product),
        initiativeDigest: canonicalDigest(initiative),
        selectionDigest: canonicalDigest(selection),
        agent: selection,
        objective: input.objective,
        permissions: input.permissions,
        expectedEffects: input.expectedEffects,
        forbiddenActions: input.forbiddenActions,
        stopConditions: input.stopConditions,
        requiredEvidence: input.requiredEvidence,
        managedIntent,
        createdAt: new Date().toISOString(),
      })
      await this.repository.commitMutation({
        writes: [{
          path: this.repository.resolve("sessions", `charter-${charter.id}.json`),
          value: charter,
          schema: executionCharterSchema,
          governed: true,
        }],
        audit: {
          eventType: "charter.created",
          actor: { kind: "human", id: actorId },
          subjectId: charter.id,
          payload: {
            initiativeId: initiative.id,
            adapterId: selection.adapterId,
            modelId: selection.modelId,
            productRevision: revisionOf(product),
            initiativeRevision: revisionOf(initiative),
            selectionDigest: charter.selectionDigest,
            recordDigest: canonicalDigest(charter),
          },
        },
      })
      return charter
    })
  }

  async confirmCharter(charterId: string, actorId: string): Promise<ExecutionCharter> {
    const validatedCharterId = requireUuid(charterId, "Charter ID")
    const path = this.repository.resolve("sessions", `charter-${validatedCharterId}.json`)
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      const current = await this.repository.readJson(path, executionCharterSchema)
      await this.assertCharterBindings(current)
      if (current.confirmedAt) return current
      const confirmed = executionCharterSchema.parse({ ...current, confirmedAt: new Date().toISOString() })
      await this.repository.commitMutation({
        writes: [{ path, value: confirmed, schema: executionCharterSchema, governed: true }],
        audit: {
          eventType: "charter.confirmed",
          actor: { kind: "human", id: actorId },
          subjectId: validatedCharterId,
          payload: { authorizationSubstitution: false, recordDigest: canonicalDigest(confirmed) },
        },
      })
      return confirmed
    })
  }

  async prepareRun(charterId: string, actorId: string): Promise<{ run: Run; invocation: AgentInvocation }> {
    const validatedCharterId = requireUuid(charterId, "Charter ID")
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      const charter = await this.repository.readJson(
        this.repository.resolve("sessions", `charter-${validatedCharterId}.json`),
        executionCharterSchema,
      )
      if (!charter.confirmedAt) throw new Error("Confirm the Execution Charter before preparing a run")
      await this.assertCharterBindings(charter)
      const currentInitiative = await this.readInitiative(charter.initiativeId)
      if (currentInitiative.state !== "active") {
        throw new Error(`Initiative must be active before preparing a Run; current state is ${currentInitiative.state}`)
      }
      const adapter = this.adapters.get(charter.agent.adapterId)
      if (!adapter) throw new Error(`Adapter ${charter.agent.adapterId} is unavailable`)
      const { capabilities: observedCapabilities, runtimeBinding } = await this.probeAdapter(
        adapter,
        { refreshModels: true },
      )
      if (capabilityDigest(observedCapabilities) !== charter.agent.capabilityDigest) {
        throw new Error("Agent runtime capabilities changed after Charter confirmation; select again and recreate the Charter")
      }
      const selectionErrors = adapter.validateSelection(charter.agent, observedCapabilities)
      if (selectionErrors.length > 0) throw new Error(selectionErrors.join("; "))
      const prompt = this.buildPrompt(charter)
      const invocation = adapter.buildInvocation(
        charter.agent,
        charter,
        this.workspacePath,
        prompt,
        runtimeBinding,
      )
      const run = runSchema.parse({
        schemaVersion: 1,
        id: randomUUID(),
        revision: 1,
        charterId: charter.id,
        charterDigest: canonicalDigest(charter),
        productId: charter.productId,
        initiativeId: charter.initiativeId,
        agent: charter.agent,
        state: "prepared",
      })
      await this.repository.commitMutation({
        writes: [{
          path: this.repository.resolve("sessions", `run-${run.id}.json`),
          value: run,
          schema: runSchema,
          governed: true,
        }],
        audit: {
          eventType: "run.prepared",
          actor: { kind: "human", id: actorId },
          subjectId: run.id,
          payload: {
            charterId: validatedCharterId,
            charterDigest: run.charterDigest,
            revision: revisionOf(run),
            recordDigest: canonicalDigest(run),
            adapterId: run.agent.adapterId,
            modelId: run.agent.modelId,
            runtimeBindingPersisted: false,
          },
        },
      })
      return { run, invocation }
    })
  }

  /**
   * Creates the portable Run identity needed by the managed execution lane
   * without constructing a direct CLI invocation. Runtime bindings remain
   * process-local and are re-probed only when startManagedRun is called.
   */
  async prepareManagedRun(charterId: string, actorId: string): Promise<Run> {
    const validatedCharterId = requireUuid(charterId, "Charter ID")
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      const charter = await this.repository.readJson(
        this.repository.resolve("sessions", `charter-${validatedCharterId}.json`),
        executionCharterSchema,
      )
      if (!charter.confirmedAt) throw new Error("Confirm the Execution Charter before preparing a managed Run")
      if (!charter.managedIntent) {
        throw new Error("Managed Run preparation requires a Charter with exact managed Workflow, Context, Tool, effect, and scope intent")
      }
      await this.assertCharterBindings(charter)
      const initiative = await this.readInitiative(charter.initiativeId)
      if (initiative.state !== "active") {
        throw new Error(`Initiative must be active before preparing a managed Run; current state is ${initiative.state}`)
      }
      const run = runSchema.parse({
        schemaVersion: 1,
        id: randomUUID(),
        revision: 1,
        charterId: charter.id,
        charterDigest: canonicalDigest(charter),
        productId: charter.productId,
        initiativeId: charter.initiativeId,
        agent: charter.agent,
        state: "prepared",
      })
      await this.repository.commitMutation({
        writes: [{
          path: this.repository.resolve("sessions", `run-${run.id}.json`),
          value: run,
          schema: runSchema,
          governed: true,
        }],
        audit: {
          eventType: "run.prepared-managed",
          actor: { kind: "human", id: actorId },
          subjectId: run.id,
          payload: {
            charterId: validatedCharterId,
            charterDigest: run.charterDigest,
            revision: revisionOf(run),
            recordDigest: canonicalDigest(run),
            adapterId: run.agent.adapterId,
            modelId: run.agent.modelId,
            runtimeBindingPersisted: false,
            invocationPersisted: false,
          },
        },
      })
      return run
    })
  }

  async previewManagedReadOnlyExecution(
    charterId: string,
    workflowPlanId: string,
  ): Promise<ManagedReadOnlyExecutionPreview> {
    const validatedCharterId = requireUuid(charterId, "Charter ID")
    const validatedWorkflowPlanId = requireUuid(workflowPlanId, "Workflow Plan ID")
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      const charter = await this.repository.readJson(
        this.repository.resolve("sessions", `charter-${validatedCharterId}.json`),
        executionCharterSchema,
      )
      if (!charter.confirmedAt) throw new Error("Confirm the Execution Charter before managed read-only preview")
      if (!charter.managedIntent) throw new Error("Managed read-only preview requires an exact managed intent")
      await this.assertCharterBindings(charter)
      const initiative = await this.readInitiative(charter.initiativeId)
      if (initiative.state !== "active") {
        throw new Error(`Initiative must be active before managed read-only execution; current state is ${initiative.state}`)
      }
      if (charter.managedIntent.workflowPlan.recordId !== validatedWorkflowPlanId) {
        throw new Error("Managed read-only preview Workflow Plan differs from the confirmed Charter")
      }
      const plan = await this.productStudio.readWorkflowPlan(validatedWorkflowPlanId)
      this.assertManagedReadOnlyEnvelope(charter, plan)
      const gates: ManagedReadOnlyGatePreview[] = [
        {
          key: "charter:required-evidence",
          phase: "charter-evidence",
          criteria: [...charter.requiredEvidence],
          criteriaDigest: sha256Digest(charter.requiredEvidence),
        },
        {
          key: "charter:stop-conditions",
          phase: "charter-stop-conditions",
          criteria: [...charter.stopConditions],
          criteriaDigest: sha256Digest(charter.stopConditions),
        },
        ...plan.steps.flatMap((step): ManagedReadOnlyGatePreview[] => [
          this.managedReadOnlyGate(step.id, "preconditions", step.preconditions),
          this.managedReadOnlyGate(step.id, "outputs", step.outputs),
          this.managedReadOnlyGate(step.id, "evidence", step.evidenceCriteria),
          this.managedReadOnlyGate(step.id, "stop-conditions", step.stopConditions),
        ]),
      ]
      const body = {
        schemaVersion: 1 as const,
        kind: "managed-readonly-preview" as const,
        productId: charter.productId,
        initiativeId: charter.initiativeId,
        charterId: charter.id,
        charterDigest: sha256Digest(charter),
        workflowPlanId: plan.id,
        workflowPlanDigest: sha256Digest(plan),
        adapterId: charter.agent.adapterId,
        agentId: charter.agent.agentId,
        modelId: charter.agent.modelId,
        selectionDigest: sha256Digest(charter.agent),
        strategy: plan.strategy,
        stepIds: plan.steps.map((step) => step.id),
        contextPackCount: plan.contextPacks.length,
        readScopeCount: plan.steps.reduce((count, step) => count + step.scope.read.length, 0),
        gates,
        authorityBoundary: "managed-readonly-preview-does-not-grant-execution-or-effect-authority" as const,
      }
      return { ...body, previewDigest: sha256Digest(body) }
    })
  }

  async executeManagedReadOnly(
    input: {
      charterId: string
      workflowPlanId: string
      expectedPreviewDigest: `sha256:${string}`
      timeoutMs: number
    },
    actorId: string,
  ): Promise<ManagedReadOnlyExecutionReceipt> {
    if (!Number.isSafeInteger(input.timeoutMs) || input.timeoutMs < 1_000 || input.timeoutMs > 300_000) {
      throw new Error("Managed read-only timeout must be between 1,000 and 300,000 milliseconds")
    }
    const preview = await this.previewManagedReadOnlyExecution(input.charterId, input.workflowPlanId)
    if (preview.previewDigest !== input.expectedPreviewDigest) {
      throw new Error("Managed read-only preview changed before execution; review and attest the current preview")
    }
    const evaluatorIdentity = {
      kind: "human" as const,
      id: actorId,
      version: "1",
      digest: sha256Digest({ kind: "human", id: actorId, version: "1" }),
    }
    const evaluateWorkflowGate: ManagedWorkflowGateEvaluator = async (request) => {
      const gate = preview.gates.find((candidate) =>
        candidate.phase === request.phase &&
        (candidate.stepId === undefined || candidate.stepId === request.stepId))
      if (!gate || gate.criteriaDigest !== request.criteriaDigest ||
          sha256Digest(request.criteria) !== gate.criteriaDigest) {
        throw new Error("Managed read-only Workflow gate differs from the attested preview")
      }
      return {
        status: "satisfied" as const,
        basis: "human-attestation" as const,
        evidenceDigest: sha256Digest({
          previewDigest: preview.previewDigest,
          gateKey: gate.key,
          criteriaDigest: gate.criteriaDigest,
          actorId,
        }),
        evaluator: evaluatorIdentity,
      }
    }
    const run = await this.prepareManagedRun(preview.charterId, actorId)
    try {
      const handle = await this.startManagedRun({
        runId: run.id,
        workflowPlanId: preview.workflowPlanId,
        timeoutMs: input.timeoutMs,
        evaluateWorkflowGate,
      }, actorId)
      let streamedEventCount = 0
      const drain = (async (): Promise<void> => {
        for await (const _event of handle.events) streamedEventCount += 1
      })()
      let review = await handle.completion
      await drain
      const staged = review.evidence.staging
      if (review.record.state === "review-required" && review.canApply && review.canDiscard && review.applyConfirmation &&
          staged && staged.changes.length === 0 && staged.baselineDigest === staged.finalDigest &&
          review.applyConfirmation.writeEnvelope.length === 0) {
        review = await review.apply({
          confirmation: review.applyConfirmation,
          evaluatePostconditions: async () => "satisfied",
          postconditionEvaluator: evaluatorIdentity,
          postconditionTimeoutMs: Math.min(input.timeoutMs, 30_000),
          evaluateWorkflowGate,
        }, actorId)
        if (review.hasLocalJournal) await review.disposeLocalJournal()
      }
      const producedStage = review.canApply || review.canDiscard || (review.evidence.staging?.changes.length ?? 0) > 0 ||
        review.record.state === "review-required" || review.record.state === "conflict"
      if (producedStage) {
        if (review.canDiscard) await review.discard(actorId)
        throw new Error("Managed read-only execution produced staged changes; GAEP discarded them and withheld a success receipt")
      }
      if (review.evidence.actualEffects.some((effect) =>
        effect.effect !== "observe" || !["not-observed", "observed-provisional"].includes(effect.status))) {
        throw new Error("Managed read-only execution reported an effect outside the observation-only envelope")
      }
      const evidenceDigest = sha256Digest(review.evidence)
      if (review.result.evidenceId !== review.evidence.id || review.result.evidenceDigest !== evidenceDigest ||
          review.evidence.events.length !== streamedEventCount) {
        throw new Error("Managed read-only terminal evidence is incomplete or inconsistent")
      }
      return {
        schemaVersion: 1,
        kind: "managed-readonly-receipt",
        previewDigest: preview.previewDigest,
        runId: run.id,
        managedRunId: review.record.id,
        productId: run.productId,
        initiativeId: run.initiativeId,
        adapterId: review.result.provider.adapterId,
        agentId: review.result.provider.agentId,
        modelId: review.result.provider.modelId,
        mode: review.record.mode,
        state: review.record.state,
        providerDisposition: review.result.providerDisposition,
        outcomeStatus: review.result.outcome.status,
        outcomeBasis: review.result.outcome.basis,
        eventCount: review.evidence.events.length,
        completedStepCount: review.evidence.workflow.completedStepIds.length,
        totalStepCount: preview.stepIds.length,
        resultDigest: sha256Digest(review.result),
        evidenceDigest,
        warnings: [...review.result.warnings],
        startedAt: review.result.startedAt,
        endedAt: review.result.endedAt,
        authorityBoundary: "managed-readonly-receipt-does-not-grant-tool-write-effect-or-outcome-authority",
      }
    } catch (error) {
      await this.markRunState(run.id, "cancelled", { kind: "human", id: actorId }).catch(() => undefined)
      throw error
    }
  }

  async startManagedRun(input: ManagedExecutionStartInput, actorId: string): Promise<ManagedExecutionHandle> {
    return this.managedExecution.start(input, actorId)
  }

  async listManagedRuns(): Promise<ManagedRunRecord[]> {
    return this.managedExecution.list()
  }

  async listManagedRunsPage(input: ManagedRunListPageInput = {}): Promise<ManagedRunListPage> {
    return this.managedExecution.listPage(input)
  }

  async readManagedRun(id: string): Promise<ManagedRunRecord> {
    return this.managedExecution.read(id)
  }

  async readManagedRunResult(id: string): Promise<ManagedRunResult> {
    return this.managedExecution.readResult(id)
  }

  async readManagedRunEvidence(id: string): Promise<ManagedRunEvidence> {
    return this.managedExecution.readEvidence(id)
  }

  async readManagedApplyDecision(id: string): Promise<ManagedApplyDecisionReceipt> {
    return this.managedExecution.readApplyDecision(id)
  }

  async listPendingManagedReviewStatuses(): Promise<ManagedPendingReviewStatus[]> {
    return this.managedExecution.listPendingReviewStatuses()
  }

  async readPendingManagedReviewStatus(id: string): Promise<ManagedPendingReviewStatus> {
    return this.managedExecution.pendingReviewStatus(id)
  }

  async applyPendingManagedReview(
    id: string,
    input: ManagedExecutionApplyInput,
    actorId: string,
  ): Promise<ManagedExecutionReview> {
    return this.managedExecution.applyPendingReview(id, input, actorId)
  }

  async discardPendingManagedReview(id: string, actorId: string): Promise<ManagedExecutionReview> {
    return this.managedExecution.discardPendingReview(id, actorId)
  }

  async cancelManagedRun(id: string, reason?: string): Promise<void> {
    return this.managedExecution.cancel(id, reason)
  }

  async markRunState(
    runId: string,
    state: Extract<Run["state"], "running" | "paused" | "completed" | "failed" | "cancelled" | "unknown">,
    actor: { kind: "human" | "agent" | "system"; id: string },
    providerSessionId?: string,
  ): Promise<Run> {
    const validatedRunId = requireUuid(runId, "Run ID")
    if ((await this.managedExecution.list()).some((managed) => managed.runId === validatedRunId)) {
      throw new Error("Managed Run state is derived from durable managed evidence and cannot be set directly")
    }
    const path = this.repository.resolve("sessions", `run-${validatedRunId}.json`)
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      const current = await this.repository.readJson(path, runSchema)
      assertTransition(current.state, state, runTransitions, "Run")
      const now = new Date().toISOString()
      const terminal = ["completed", "failed", "cancelled", "unknown"].includes(state)
      const next = runSchema.parse({
        ...current,
        revision: revisionOf(current) + 1,
        state,
        providerSessionRef: providerSessionId
          ? canonicalDigest({ kind: "provider-session", value: providerSessionId })
          : current.providerSessionRef,
        startedAt: current.startedAt ?? (state === "running" ? now : undefined),
        endedAt: terminal ? now : undefined,
      })
      await this.repository.commitMutation({
        writes: [{ path, value: next, schema: runSchema, governed: true }],
        audit: {
          eventType: `run.${state}`,
          actor,
          subjectId: validatedRunId,
          payload: {
            from: current.state,
            to: state,
            revision: revisionOf(next),
            providerSessionRef: next.providerSessionRef,
            recordDigest: canonicalDigest(next),
          },
        },
      })
      return next
    })
  }

  async previewHandoff(input: HandoffInput): Promise<Handoff> {
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      return this.buildHandoff(input)
    })
  }

  async createHandoff(input: HandoffInput, actorId: string): Promise<Handoff> {
    return this.repository.withLock(async () => {
      await this.assertAuditIntegrity()
      const { handoff, capabilities } = await this.buildHandoffWithCapabilities(input)
      const selection = handoff.toAgent
      const capabilitiesPath = this.capabilitiesPath(capabilities)
      await this.repository.commitMutation({
        writes: [
          {
            path: this.repository.resolve("handoffs", `${handoff.id}.json`),
            value: handoff,
            schema: handoffSchema,
            governed: true,
          },
          {
            path: this.repository.resolve("runtime", "selection.json"),
            value: selection,
            schema: agentSelectionSchema,
            governed: true,
          },
          {
            path: capabilitiesPath,
            value: capabilities,
            schema: adapterCapabilitiesSchema,
            governed: true,
          },
        ],
        audit: {
          eventType: "handoff.committed",
          actor: { kind: "human", id: actorId },
          subjectId: handoff.id,
          payload: {
            fromRunId: handoff.fromRunId,
            toAgent: selection.agentId,
            toModel: selection.modelId,
            selectionDigest: canonicalDigest(selection),
            recordDigest: canonicalDigest(handoff),
          },
        },
      })
      return handoff
    })
  }

  private async buildHandoff(input: HandoffInput): Promise<Handoff> {
    return (await this.buildHandoffWithCapabilities(input)).handoff
  }

  private async buildHandoffWithCapabilities(
    input: HandoffInput,
  ): Promise<{ handoff: Handoff; capabilities: AdapterCapabilities }> {
    const fromRunId = requireUuid(input.fromRunId, "Source Run ID")
    const runs = await this.listRuns()
    const fromRun = runs.find((run) => run.id === fromRunId)
    if (!fromRun) throw new Error("The source Run does not exist in this governed workspace")
    if (runs.some((run) => !["completed", "failed", "cancelled"].includes(run.state))) {
      throw new Error("Stop, cancel, or reconcile the active agent process before creating a switch handoff")
    }
    const suppliedCapabilities = adapterCapabilitiesSchema.parse(input.toCapabilities)
    const adapter = this.adapters.get(suppliedCapabilities.adapterId)
    if (!adapter) throw new Error(`Adapter ${suppliedCapabilities.adapterId} is unavailable`)
    const { capabilities } = await this.probeAdapter(adapter, { refreshModels: true })
    if (capabilityDigest(capabilities) !== capabilityDigest(suppliedCapabilities)) {
      throw new Error("Handoff target capabilities changed; review the switch again")
    }
    const model = capabilities.models.find((candidate) => candidate.id === input.toModelId)
    const toSelection = agentSelectionSchema.parse({
      schemaVersion: 2,
      adapterId: capabilities.adapterId,
      agentId: capabilities.agentId,
      modelId: input.toModelId,
      modelTruthClass: model?.truthClass ?? "configured",
      modelAlias: model?.alias ?? null,
      settings: input.toSettings,
      selectedAt: new Date().toISOString(),
      capabilityDigest: capabilityDigest(capabilities),
    })
    const validationErrors = adapter.validateSelection(toSelection, capabilities)
    if (validationErrors.length > 0) throw new Error(validationErrors.join("; "))
    const baseline = await this.workspaceBaseline()
    const capabilityDifferences = [
      fromRun.agent.adapterId !== toSelection.adapterId
        ? `Agent adapter changes from ${fromRun.agent.adapterId} to ${toSelection.adapterId}.`
        : "Agent adapter is unchanged.",
      fromRun.agent.modelId !== toSelection.modelId
        ? `Model changes from ${fromRun.agent.modelId} to ${toSelection.modelId}.`
        : "Model is unchanged.",
      ...capabilities.limitations,
    ]
    const handoff = handoffSchema.parse({
      schemaVersion: 1,
      id: randomUUID(),
      productId: fromRun.productId,
      initiativeId: fromRun.initiativeId,
      fromRunId: fromRun.id,
      toAgent: toSelection,
      reason: input.reason,
      workspaceBaseline: baseline,
      completedWork: input.completedWork,
      unresolvedMatters: input.unresolvedMatters,
      decisions: input.decisions,
      evidence: input.evidence,
      capabilityDifferences,
      createdAt: new Date().toISOString(),
    })
    return { handoff, capabilities }
  }

  private async assertAuditIntegrity(): Promise<void> {
    const audit = await this.repository.verifyAudit()
    if (!audit.valid) {
      throw new Error(`GAEP workspace audit is invalid; refusing mutation: ${audit.error ?? "unknown error"}`)
    }
  }

  private async probeAdapter(
    adapter: AgentAdapter,
    options: AdapterProbeOptions,
  ): Promise<AdapterProbeResult> {
    const result = await adapter.probe(options)
    const capabilities = adapterCapabilitiesSchema.parse(result.capabilities)
    const runtimeBinding = result.runtimeBinding
    if (capabilities.adapterId !== adapter.id) {
      throw new Error(`Adapter ${adapter.id} returned capabilities for ${capabilities.adapterId}`)
    }
    if (
      !runtimeBinding ||
      runtimeBinding.scope !== "machine-local" ||
      runtimeBinding.adapterId !== capabilities.adapterId ||
      runtimeBinding.agentId !== capabilities.agentId
    ) {
      throw new Error(`Adapter ${adapter.id} returned a mismatched machine-local runtime binding`)
    }
    if (capabilities.detected === (runtimeBinding.kind === "unavailable")) {
      throw new Error(`Adapter ${adapter.id} returned inconsistent availability and runtime binding state`)
    }
    return { capabilities, runtimeBinding }
  }

  private capabilitiesPath(capabilities: Pick<AdapterCapabilities, "adapterId" | "agentId">): string {
    return this.repository.resolve(
      "runtime",
      `capabilities-${canonicalDigest({
        adapterId: capabilities.adapterId,
        agentId: capabilities.agentId,
      }).slice("sha256:".length)}.json`,
    )
  }

  private managedReadOnlyGate(
    stepId: string,
    phase: Exclude<ManagedReadOnlyGatePhase, "charter-evidence" | "charter-stop-conditions">,
    criteria: readonly string[],
  ): ManagedReadOnlyGatePreview {
    return {
      key: `${stepId}:${phase}`,
      stepId,
      phase,
      criteria: [...criteria],
      criteriaDigest: sha256Digest(criteria),
    }
  }

  private assertManagedReadOnlyEnvelope(charter: ExecutionCharter, plan: WorkflowPlan): void {
    const intent = charter.managedIntent
    if (!intent || charter.expectedEffects.length !== 1 || charter.expectedEffects[0] !== "observe" ||
        intent.requestedEffects.length !== 1 || intent.requestedEffects[0] !== "observe") {
      throw new Error("Managed read-only execution requires an exact observation-only effect envelope")
    }
    if (charter.permissions.some((permission) => permission.mode !== "deny")) {
      throw new Error("Managed read-only execution requires every Tool permission to be denied")
    }
    if (intent.toolDefinitions.length > 0 || intent.requestedScopes.length > 0 || plan.toolDefinitions.length > 0) {
      throw new Error("Managed read-only execution permits no Tool Definition or requested effect scope")
    }
    for (const step of plan.steps) {
      if (step.toolDefinitions.length > 0 || step.scope.write.length > 0 || step.scope.effects.length > 0 ||
          step.effectEnvelope.length !== 1 || step.effectEnvelope[0] !== "observe") {
        throw new Error(`Managed read-only Workflow Step ${step.id} requests Tool, write, or non-observation authority`)
      }
    }
  }

  private async assertCharterBindings(charter: ExecutionCharter): Promise<void> {
    if (
      charter.productRevision === undefined ||
      charter.initiativeRevision === undefined ||
      charter.productDigest === undefined ||
      charter.initiativeDigest === undefined ||
      charter.selectionDigest === undefined
    ) {
      throw new Error("This legacy Execution Charter lacks exact state bindings; recreate and confirm it")
    }
    const [product, initiative, selection] = await Promise.all([
      this.readProduct(),
      this.readInitiative(charter.initiativeId),
      this.readSelection(),
    ])
    if (charter.productId !== product.id || initiative.productId !== product.id) {
      throw new Error("Execution Charter Product binding is no longer valid")
    }
    if (charter.productRevision !== revisionOf(product) || charter.productDigest !== canonicalDigest(product)) {
      throw new Error("Product changed after the Execution Charter was created; recreate the Charter")
    }
    if (
      charter.initiativeRevision !== revisionOf(initiative) ||
      charter.initiativeDigest !== canonicalDigest(initiative)
    ) {
      throw new Error("Initiative changed after the Execution Charter was created; recreate the Charter")
    }
    if (
      charter.selectionDigest !== canonicalDigest(charter.agent) ||
      charter.selectionDigest !== canonicalDigest(selection)
    ) {
      throw new Error("Agent, model, or settings changed after the Execution Charter was created")
    }
    if (charter.managedIntent) {
      if (JSON.stringify([...charter.managedIntent.requestedEffects].sort()) !== JSON.stringify([...charter.expectedEffects].sort())) {
        throw new Error("Managed Charter intent no longer matches the Charter expected effects")
      }
      await this.assertManagedIntentBindings(charter.managedIntent, product.id)
    }
  }

  private async assertManagedIntentBindings(intent: ExecutionManagedIntent, productId: string): Promise<void> {
    const plan = await this.productStudio.readWorkflowPlan(intent.workflowPlan.recordId)
    if (
      plan.productId !== productId ||
      plan.revision !== intent.workflowPlan.revision ||
      canonicalDigest(plan) !== intent.workflowPlan.digest ||
      plan.state !== "resolved"
    ) {
      throw new Error("Managed Charter intent requires the exact resolved Workflow Plan revision")
    }
    const contexts = await Promise.all(intent.contextPacks.map(async (binding) => {
      const pack = await this.productStudio.readContextPack(binding.recordId)
      if (pack.productId !== productId || pack.revision !== binding.revision || canonicalDigest(pack) !== binding.digest) {
        throw new Error("Managed Charter intent contains a stale or mismatched Context Pack binding")
      }
      return pack
    }))
    const tools = await Promise.all(intent.toolDefinitions.map(async (binding) => {
      const tool = await this.productStudio.readToolDefinition(binding.recordId)
      if (tool.productId !== productId || tool.revision !== binding.revision || canonicalDigest(tool) !== binding.digest) {
        throw new Error("Managed Charter intent contains a stale or mismatched Tool Definition binding")
      }
      return tool
    }))
    const planContexts = plan.contextPacks.map((binding) => `${binding.recordId}:${binding.revision}:${binding.digest}`).sort()
    const intentContexts = intent.contextPacks.map((binding) => `${binding.recordId}:${binding.revision}:${binding.digest}`).sort()
    const planTools = plan.toolDefinitions.map((binding) => `${binding.recordId}:${binding.revision}:${binding.digest}`).sort()
    const intentTools = intent.toolDefinitions.map((binding) => `${binding.recordId}:${binding.revision}:${binding.digest}`).sort()
    if (JSON.stringify(planContexts) !== JSON.stringify(intentContexts) || JSON.stringify(planTools) !== JSON.stringify(intentTools)) {
      throw new Error("Managed Charter intent must exactly match the Workflow Plan Context and Tool inventories")
    }
    if (contexts.some((pack) => pack.sufficiency.status === "insufficient") || tools.some((tool) => !tool.enabled)) {
      throw new Error("Managed Charter intent requires sufficient Context Packs and enabled Tools")
    }
  }

  private buildPrompt(charter: ExecutionCharter): string {
    const permissionLines = charter.permissions.map((permission) =>
      `- ${permission.capability}: ${permission.mode}${permission.scope.length ? ` within ${permission.scope.join(", ")}` : ""}`,
    )
    return [
      "Execute this bounded GAEP Initiative under the confirmed Execution Charter.",
      "",
      `Objective: ${charter.objective}`,
      `Product ID: ${charter.productId}`,
      `Initiative ID: ${charter.initiativeId}`,
      "",
      "Tool permissions:",
      ...permissionLines,
      "",
      "Expected effects:",
      ...charter.expectedEffects.map((effect) => `- ${effect}`),
      "",
      "Forbidden actions:",
      ...charter.forbiddenActions.map((action) => `- ${action}`),
      "",
      "Stop conditions:",
      ...charter.stopConditions.map((condition) => `- ${condition}`),
      "",
      "Required evidence:",
      ...charter.requiredEvidence.map((evidence) => `- ${evidence}`),
      "",
      "Technical access is not a GAEP Approval Determination or Authorization Grant. Stop before any unlisted high-impact effect.",
    ].join("\n")
  }

  private async workspaceBaseline(): Promise<{
    gitHead?: string
    dirty: boolean | null
    changedFiles: string[]
    truthClass: "observed" | "unknown"
    observationError?: string
  }> {
    try {
      const [{ stdout: head }, { stdout: status }] = await Promise.all([
        execFileAsync("git", ["rev-parse", "HEAD"], { cwd: this.workspacePath }),
        execFileAsync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { cwd: this.workspacePath }),
      ])
      const entries = status.split("\0").filter(Boolean)
      const observedPaths: string[] = []
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index]!
        const statusCode = entry.slice(0, 2)
        observedPaths.push(entry.slice(3))
        if (/[RC]/.test(statusCode) && entries[index + 1]) observedPaths.push(entries[++index]!)
      }
      const changedFiles: string[] = []
      let omittedNonPortablePath = false
      for (const path of observedPaths) {
        const parsed = executionWorkspaceScopeSchema.safeParse(path)
        if (parsed.success && parsed.data !== ".") changedFiles.push(parsed.data)
        else omittedNonPortablePath = true
      }
      return {
        gitHead: head.trim(),
        dirty: observedPaths.length > 0,
        changedFiles: [...new Set(changedFiles)].sort(),
        truthClass: "observed",
        observationError: omittedNonPortablePath
          ? "One or more changed file paths were omitted because they were not portable."
          : undefined,
      }
    } catch (error) {
      return {
        dirty: null,
        changedFiles: [],
        truthClass: "unknown",
        observationError: error instanceof Error &&
          "code" in error &&
          typeof error.code === "string" &&
          /^[A-Z0-9_]+$/.test(error.code)
          ? `Git workspace state could not be observed (${error.code}).`
          : "Git workspace state could not be observed.",
      }
    }
  }
}
