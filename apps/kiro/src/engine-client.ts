import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { access, realpath, stat } from "node:fs/promises"
import { delimiter, dirname, extname, isAbsolute, resolve } from "node:path"
import { once } from "node:events"

import {
  completeInitiativeApplicabilityCoverage,
  businessArchitectureBaselineProjectionSchema,
  boundedContextModelProjectionSchema,
  businessCapabilityMapProjectionSchema,
  businessRuleCatalogProjectionSchema,
  businessUnderstandingProjectionSchema,
  dataModelProjectionSchema,
  authorizationModelProjectionSchema,
  eventIntegrationModelProjectionSchema,
  failureRecoveryModelProjectionSchema,
  architectureChallengeModelProjectionSchema,
  decisionRegisterProjectionSchema,
  riskRegisterProjectionSchema,
  evidenceRegistryProjectionSchema,
  endToEndTraceabilityProjectionSchema,
  p0P4ReadinessGateProjectionSchema,
  p5HandoffPackageProjectionSchema,
  designApplicabilityProjectionSchema,
  designPersonaRoleModelProjectionSchema,
  userJourneyModelProjectionSchema,
  informationArchitectureModelProjectionSchema,
  screenStateInventoryProjectionSchema,
  designRequirementsProjectionSchema,
  designSystemTokenContractProjectionSchema,
  accessibilityDesignRulesProjectionSchema,
  responsiveMultiPlatformTargetsProjectionSchema,
  manualFigmaExecutionPathProjectionSchema,
  figmaMcpCapabilityDiscoveryProjectionSchema,
  figmaReadSnapshotProjectionSchema,
  figmaContextImportProjectionSchema,
  outboundDesignBriefPackageProjectionSchema,
  governedFigmaWriteProjectionSchema,
  finalizedFigmaSnapshotImportProjectionSchema,
  designToRequirementBindingProjectionSchema,
  designerReadyGateProjectionSchema,
  designDeltaProjectionSchema,
  designConflictResolutionProjectionSchema,
  humanDesignApprovalProjectionSchema,
  designBaselineProjectionSchema,
  designDriftDetectionProjectionSchema,
  phase2UxFigmaDashboardSchema,
  phase1SummaryDashboardSchema,
  phase1ChangeImpactDashboardSchema,
  phase1AgentModelDashboardSchema,
  initiativeApplicabilityMatrixInputSchema,
  initiativeClassificationInputSchema,
  initiativeEntryAssessmentSchema,
  initiativeSchema,
  operatingModelProjectionSchema,
  securityPrivacyAssessmentProjectionSchema,
  processModelProjectionSchema,
  sourceGovernanceProjectionSchema,
  systemSolutionArchitectureProjectionSchema,
  valueStreamModelProjectionSchema,
  type Initiative,
  type BusinessArchitectureBaselineProjection,
  type BoundedContextModelProjection,
  type BusinessCapabilityMapProjection,
  type BusinessRuleCatalogProjection,
  type BusinessUnderstandingProjection,
  type DataModelProjection,
  type AuthorizationModelProjection,
  type EventIntegrationModelProjection,
  type FailureRecoveryModelProjection,
  type ArchitectureChallengeModelProjection,
  type DecisionRegisterProjection,
  type RiskRegisterProjection,
  type EvidenceRegistryProjection,
  type EndToEndTraceabilityProjection,
  type P0P4ReadinessGateProjection,
  type P5HandoffPackageProjection,
  type DesignApplicabilityProjection,
  type DesignPersonaRoleModelProjection,
  type UserJourneyModelProjection,
  type InformationArchitectureModelProjection,
  type ScreenStateInventoryProjection,
  type DesignRequirementsProjection,
  type DesignSystemTokenContractProjection,
  type AccessibilityDesignRulesProjection,
  type ResponsiveMultiPlatformTargetsProjection,
  type ManualFigmaExecutionPathProjection,
  type FigmaMcpCapabilityDiscoveryProjection,
  type FigmaReadSnapshotProjection,
  type FigmaContextImportProjection,
  type OutboundDesignBriefPackageProjection,
  type GovernedFigmaWriteProjection,
  type FinalizedFigmaSnapshotImportProjection,
  type DesignToRequirementBindingProjection,
  type DesignerReadyGateProjection,
  type DesignDeltaProjection,
  type DesignConflictResolutionProjection,
  type HumanDesignApprovalProjection,
  type DesignBaselineProjection,
  type DesignDriftDetectionProjection,
  type Phase2UxFigmaDashboard,
  type Phase1SummaryDashboard,
  type Phase1ChangeImpactDashboard,
  type Phase1AgentModelDashboard,
  type InitiativeApplicabilityMatrixInput,
  type InitiativeClassificationInput,
  type InitiativeEntryAssessment,
  type OperatingModelProjection,
  type SecurityPrivacyAssessmentProjection,
  type ProcessModelProjection,
  type SourceGovernanceProjection,
  type SystemSolutionArchitectureProjection,
  type ValueStreamModelProjection,
} from "@gaep/contracts"

import {
  defaultPageSize,
  canonicalDigest,
  frameTooLarge,
  GaepHostError,
  hostUnavailable,
  invalidHostResponse,
  invalidUtf8,
  maximumFrameBytes,
  normalizeActorId,
  normalizeDeliveryPhaseId,
  normalizeExistingLocalFolder,
  normalizeUuid,
  parseAgentReadiness,
  parseAgentModelDashboard,
  parseAgentHandoff,
  parseManagedReadOnlyPreview,
  parseManagedReadOnlyReceipt,
  parseManagedEvidenceDetail,
  parseManagedRunSummaryPage,
  parseManagedReviewPreview,
  parseManagedReviewTransition,
  parseAgentRuns,
  parseAgentSelection,
  parseAgentSelectionState,
  parseChangeImpactChangeCatalog,
  parseChangeImpactDashboard,
  parseHostResult,
  parsePhaseDashboardFramework,
  parsePageResult,
  parsePortableSelectionSettings,
  parseProductBinding,
  parseSnapshotResult,
  protocolVersion,
  responseTooLarge,
  validatePage,
  validateProductRevision,
  type PortableDesignSnapshotPage,
  type PortableDesignSnapshotSummary,
  type ProductBinding,
  type AgentReadinessSnapshot,
  type AgentModelDashboard,
  type AgentHandoff,
  type AgentRun,
  type AgentSelection,
  type AgentSelectionState,
  type ManagedReadOnlyPreview,
  type ManagedReadOnlyReceipt,
  type ManagedEvidenceDetail,
  type ManagedRunSummaryPage,
  type ManagedReviewPreview,
  type ManagedReviewTransition,
  type PortableAgentSettingValue,
  type DeliveryPhaseId,
  type ChangeImpactChangeCatalog,
  type ChangeImpactChangeReference,
  type ChangeImpactDashboard,
  type PhaseDashboardFramework,
} from "./protocol.js"

export interface EngineClientOptions {
  readonly workspacePath: string
  readonly engineExecutable?: string
  readonly expectedEngineSha256?: string
  readonly engineArgumentsPrefix?: readonly string[]
  readonly packagedEngine?: {
    readonly path: string
    readonly expectedSha256: string
  }
  readonly sourceEnvironment?: NodeJS.ProcessEnv
}

interface EngineIdentity {
  readonly path: string
  readonly digest: string
}

const safeEnvironmentNames = [
  "PATH", "LANG", "LC_ALL", "LC_CTYPE", "TMPDIR", "TMP", "TEMP",
  "SYSTEMROOT", "WINDIR", "PATHEXT", "COMSPEC",
] as const

export function safeEngineEnvironment(source: NodeJS.ProcessEnv, runPackagedEngine = false): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = Object.create(null) as NodeJS.ProcessEnv
  for (const name of safeEnvironmentNames) {
    const value = environmentValue(source, name)
    if (value !== undefined) environment[name] = value
  }
  environment.GAEP_HOST_SURFACE = "kiro-portable-design"
  if (runPackagedEngine) environment.ELECTRON_RUN_AS_NODE = "1"
  return environment
}

export class GaepEngineClient {
  private readonly configuredDigest: string | undefined
  private readonly configuredPackagedEngineDigest: string | undefined
  private readonly requestedExecutable: string
  private readonly requestedPackagedEngine: string | undefined
  private readonly engineArgumentsPrefix: readonly string[]
  private readonly childEnvironment: NodeJS.ProcessEnv
  private requestTail: Promise<void> = Promise.resolve()
  private nextId = 0
  private child: ChildProcessWithoutNullStreams | undefined
  private stdoutIterator: AsyncIterator<Buffer> | undefined
  private pendingResponse: Buffer<ArrayBufferLike> = Buffer.alloc(0)
  private boundIdentity: EngineIdentity | undefined
  private boundPackagedEngineIdentity: EngineIdentity | undefined
  private disposed = false

  private constructor(
    private readonly workspacePath: string,
    options: EngineClientOptions,
  ) {
    this.requestedExecutable = options.engineExecutable ?? process.env.GAEP_ENGINE_EXECUTABLE ?? "gaep-engine"
    this.configuredDigest = normalizeDigest(
      options.expectedEngineSha256 ?? (options.packagedEngine ? undefined : process.env.GAEP_ENGINE_SHA256),
    )
    this.requestedPackagedEngine = options.packagedEngine?.path
    this.configuredPackagedEngineDigest = normalizeDigest(
      options.packagedEngine?.expectedSha256,
      "Expected packaged engine SHA-256",
    )
    if (this.requestedPackagedEngine && !this.configuredPackagedEngineDigest) {
      throw new TypeError("Expected packaged engine SHA-256 must contain exactly 64 hexadecimal characters")
    }
    if (this.requestedPackagedEngine && options.engineArgumentsPrefix?.length) {
      throw new TypeError("Packaged engine mode cannot include an additional engine argument prefix")
    }
    this.engineArgumentsPrefix = Object.freeze([...(options.engineArgumentsPrefix ?? [])])
    this.childEnvironment = safeEngineEnvironment(options.sourceEnvironment ?? process.env, Boolean(this.requestedPackagedEngine))
  }

  static async create(options: EngineClientOptions): Promise<GaepEngineClient> {
    const workspacePath = await normalizeExistingLocalFolder(options.workspacePath)
    return new GaepEngineClient(workspacePath, options)
  }

  readProduct(): Promise<ProductBinding> {
    return this.enqueue(async () => parseProductBinding(await this.request("readProduct", {})))
  }

  readInitiative(initiativeValue: string): Promise<Initiative> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = initiativeSchema.strict().safeParse(await this.request("readInitiative", { initiativeId }))
      if (!parsed.success) throw invalidHostResponse()
      const initiative = parsed.data
      if (initiative.id.toLowerCase() !== initiativeId) throw invalidHostResponse()
      return initiative
    })
  }

  assessInitiativeEntry(initiativeValue: string): Promise<InitiativeEntryAssessment> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = initiativeEntryAssessmentSchema.safeParse(
        await this.request("assessInitiativeEntry", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const assessment = parsed.data
      if (assessment.initiativeId.toLowerCase() !== initiativeId ||
          assessment.classification.completeness === undefined ||
          assessment.applicability.coverage === undefined) {
        throw invalidHostResponse()
      }
      return assessment
    })
  }

  readSourceGovernance(initiativeValue: string): Promise<SourceGovernanceProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = sourceGovernanceProjectionSchema.safeParse(
        await this.request("source.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readBusinessUnderstanding(initiativeValue: string): Promise<BusinessUnderstandingProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = businessUnderstandingProjectionSchema.safeParse(
        await this.request("business.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readBusinessCapabilityMap(initiativeValue: string): Promise<BusinessCapabilityMapProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = businessCapabilityMapProjectionSchema.safeParse(
        await this.request("business.capabilities.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readValueStreamModel(initiativeValue: string): Promise<ValueStreamModelProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = valueStreamModelProjectionSchema.safeParse(
        await this.request("business.valueStreams.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readOperatingModel(initiativeValue: string): Promise<OperatingModelProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = operatingModelProjectionSchema.safeParse(
        await this.request("business.operatingModels.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readBusinessRuleCatalog(initiativeValue: string): Promise<BusinessRuleCatalogProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = businessRuleCatalogProjectionSchema.safeParse(
        await this.request("business.businessRules.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readBusinessArchitectureBaseline(initiativeValue: string): Promise<BusinessArchitectureBaselineProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = businessArchitectureBaselineProjectionSchema.safeParse(
        await this.request("business.architectureBaselines.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readSystemSolutionArchitecture(initiativeValue: string): Promise<SystemSolutionArchitectureProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = systemSolutionArchitectureProjectionSchema.safeParse(
        await this.request("architecture.systemSolution.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readBoundedContextModel(initiativeValue: string): Promise<BoundedContextModelProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = boundedContextModelProjectionSchema.safeParse(
        await this.request("architecture.boundedContexts.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readSecurityPrivacyAssessment(initiativeValue: string): Promise<SecurityPrivacyAssessmentProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = securityPrivacyAssessmentProjectionSchema.safeParse(
        await this.request("security.privacyThreat.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readProcessModel(initiativeValue: string): Promise<ProcessModelProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = processModelProjectionSchema.safeParse(
        await this.request("process.models.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readDataModel(initiativeValue: string): Promise<DataModelProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = dataModelProjectionSchema.safeParse(
        await this.request("data.models.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readAuthorizationModel(initiativeValue: string): Promise<AuthorizationModelProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = authorizationModelProjectionSchema.safeParse(
        await this.request("authorization.models.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readEventIntegrationModel(initiativeValue: string): Promise<EventIntegrationModelProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = eventIntegrationModelProjectionSchema.safeParse(
        await this.request("integration.models.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readFailureRecoveryModel(initiativeValue: string): Promise<FailureRecoveryModelProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = failureRecoveryModelProjectionSchema.safeParse(
        await this.request("recovery.models.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readArchitectureChallengeModel(initiativeValue: string): Promise<ArchitectureChallengeModelProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = architectureChallengeModelProjectionSchema.safeParse(
        await this.request("challenge.models.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readDecisionRegister(initiativeValue: string): Promise<DecisionRegisterProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = decisionRegisterProjectionSchema.safeParse(
        await this.request("decision.registers.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readRiskRegister(initiativeValue: string): Promise<RiskRegisterProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = riskRegisterProjectionSchema.safeParse(
        await this.request("risk.registers.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readEvidenceRegistry(initiativeValue: string): Promise<EvidenceRegistryProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = evidenceRegistryProjectionSchema.safeParse(
        await this.request("evidence.registries.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readEndToEndTraceability(initiativeValue: string): Promise<EndToEndTraceabilityProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = endToEndTraceabilityProjectionSchema.safeParse(
        await this.request("traceability.graphs.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readP0P4ReadinessGate(initiativeValue: string): Promise<P0P4ReadinessGateProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = p0P4ReadinessGateProjectionSchema.safeParse(
        await this.request("readiness.gates.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readP5HandoffPackage(initiativeValue: string): Promise<P5HandoffPackageProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = p5HandoffPackageProjectionSchema.safeParse(
        await this.request("handoff.p5.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readDesignApplicability(initiativeValue: string): Promise<DesignApplicabilityProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = designApplicabilityProjectionSchema.safeParse(
        await this.request("design.applicability.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readDesignPersonaRoleModel(initiativeValue: string): Promise<DesignPersonaRoleModelProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = designPersonaRoleModelProjectionSchema.safeParse(
        await this.request("design.personas.roles.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readUserJourneyModel(initiativeValue: string): Promise<UserJourneyModelProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = userJourneyModelProjectionSchema.safeParse(
        await this.request("design.journeys.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readInformationArchitectureModel(initiativeValue: string): Promise<InformationArchitectureModelProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = informationArchitectureModelProjectionSchema.safeParse(
        await this.request("design.informationArchitecture.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readScreenStateInventory(initiativeValue: string): Promise<ScreenStateInventoryProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = screenStateInventoryProjectionSchema.safeParse(
        await this.request("design.screenStateInventory.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readDesignRequirements(initiativeValue: string): Promise<DesignRequirementsProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = designRequirementsProjectionSchema.safeParse(
        await this.request("design.requirements.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readDesignSystemTokenContract(initiativeValue: string): Promise<DesignSystemTokenContractProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = designSystemTokenContractProjectionSchema.safeParse(
        await this.request("design.systemTokenContract.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readAccessibilityDesignRules(initiativeValue: string): Promise<AccessibilityDesignRulesProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = accessibilityDesignRulesProjectionSchema.safeParse(
        await this.request("design.accessibilityRules.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readResponsiveMultiPlatformTargets(initiativeValue: string): Promise<ResponsiveMultiPlatformTargetsProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = responsiveMultiPlatformTargetsProjectionSchema.safeParse(
        await this.request("design.responsiveMultiPlatformTargets.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readManualFigmaExecutionPath(initiativeValue: string): Promise<ManualFigmaExecutionPathProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = manualFigmaExecutionPathProjectionSchema.safeParse(
        await this.request("design.manualFigmaExecutionPath.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readFigmaMcpCapabilityDiscovery(initiativeValue: string): Promise<FigmaMcpCapabilityDiscoveryProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = figmaMcpCapabilityDiscoveryProjectionSchema.safeParse(
        await this.request("design.figmaMcpCapabilityDiscovery.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readFigmaReadSnapshot(initiativeValue: string): Promise<FigmaReadSnapshotProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = figmaReadSnapshotProjectionSchema.safeParse(
        await this.request("design.figmaReadSnapshot.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readFigmaContextImport(initiativeValue: string): Promise<FigmaContextImportProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = figmaContextImportProjectionSchema.safeParse(
        await this.request("design.figmaContextImport.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readOutboundDesignBriefPackage(initiativeValue: string): Promise<OutboundDesignBriefPackageProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = outboundDesignBriefPackageProjectionSchema.safeParse(
        await this.request("design.outboundDesignBriefPackage.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readGovernedFigmaWrite(initiativeValue: string): Promise<GovernedFigmaWriteProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = governedFigmaWriteProjectionSchema.safeParse(
        await this.request("design.governedFigmaWrite.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readFinalizedFigmaSnapshotImport(initiativeValue: string): Promise<FinalizedFigmaSnapshotImportProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = finalizedFigmaSnapshotImportProjectionSchema.safeParse(
        await this.request("design.finalizedFigmaSnapshotImport.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readDesignToRequirementBinding(initiativeValue: string): Promise<DesignToRequirementBindingProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = designToRequirementBindingProjectionSchema.safeParse(
        await this.request("design.designToRequirementBinding.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (
        projection.initiative.id.toLowerCase() !== initiativeId ||
        snapshotDigest !== canonicalDigest(projectionBody)
      ) throw invalidHostResponse()
      return projection
    })
  }

  readDesignerReadyGate(initiativeValue: string): Promise<DesignerReadyGateProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = designerReadyGateProjectionSchema.safeParse(
        await this.request("design.designerReadyGate.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (projection.initiative.id.toLowerCase() !== initiativeId ||
          snapshotDigest !== canonicalDigest(projectionBody)) throw invalidHostResponse()
      return projection
    })
  }

  readDesignDelta(initiativeValue: string): Promise<DesignDeltaProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = designDeltaProjectionSchema.safeParse(
        await this.request("design.designDelta.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (projection.initiative.id.toLowerCase() !== initiativeId ||
          snapshotDigest !== canonicalDigest(projectionBody)) throw invalidHostResponse()
      return projection
    })
  }

  readDesignConflictResolution(initiativeValue: string): Promise<DesignConflictResolutionProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = designConflictResolutionProjectionSchema.safeParse(
        await this.request("design.designConflictResolution.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (projection.initiative.id.toLowerCase() !== initiativeId ||
          snapshotDigest !== canonicalDigest(projectionBody)) throw invalidHostResponse()
      return projection
    })
  }

  readHumanDesignApproval(initiativeValue: string): Promise<HumanDesignApprovalProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = humanDesignApprovalProjectionSchema.safeParse(
        await this.request("design.humanDesignApproval.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (projection.initiative.id.toLowerCase() !== initiativeId ||
          snapshotDigest !== canonicalDigest(projectionBody)) throw invalidHostResponse()
      return projection
    })
  }

  readDesignBaseline(initiativeValue: string): Promise<DesignBaselineProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = designBaselineProjectionSchema.safeParse(
        await this.request("design.designBaseline.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (projection.initiative.id.toLowerCase() !== initiativeId ||
          snapshotDigest !== canonicalDigest(projectionBody)) throw invalidHostResponse()
      return projection
    })
  }

  readDesignDriftDetection(initiativeValue: string): Promise<DesignDriftDetectionProjection> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const parsed = designDriftDetectionProjectionSchema.safeParse(
        await this.request("design.designDriftDetection.snapshot", { initiativeId }),
      )
      if (!parsed.success) throw invalidHostResponse()
      const projection = parsed.data
      const { snapshotDigest, ...projectionBody } = projection
      if (projection.initiative.id.toLowerCase() !== initiativeId ||
          snapshotDigest !== canonicalDigest(projectionBody)) throw invalidHostResponse()
      return projection
    })
  }

  classifyInitiative(
    initiativeValue: string,
    expectedRevisionValue: number,
    inputValue: InitiativeClassificationInput,
    actorValue: string,
  ): Promise<Initiative> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const expectedInitiativeRevision = validateProductRevision(expectedRevisionValue)
      const classification = initiativeClassificationInputSchema.parse(inputValue)
      const actorId = normalizeActorId(actorValue)
      const parsed = initiativeSchema.strict().safeParse(await this.request("classifyInitiative", {
        initiativeId,
        expectedInitiativeRevision,
        actorId,
        classification,
      }))
      if (!parsed.success) throw invalidHostResponse()
      const updated = parsed.data
      if (updated.id.toLowerCase() !== initiativeId || updated.revision !== expectedInitiativeRevision + 1 ||
          updated.classification?.classifiedBy.id !== actorId ||
          canonicalDigest(classificationInputFromRecord(updated.classification)) !== canonicalDigest(classification)) {
        throw invalidHostResponse()
      }
      return updated
    })
  }

  resolveInitiativeApplicability(
    initiativeValue: string,
    expectedRevisionValue: number,
    inputValue: InitiativeApplicabilityMatrixInput,
    actorValue: string,
  ): Promise<Initiative> {
    return this.enqueue(async () => {
      const initiativeId = normalizeUuid(initiativeValue, "Initiative ID")
      const expectedInitiativeRevision = validateProductRevision(expectedRevisionValue)
      const actorId = normalizeActorId(actorValue)
      const applicability = initiativeApplicabilityMatrixInputSchema.parse(
        completeInitiativeApplicabilityCoverage(inputValue, actorId),
      )
      const parsed = initiativeSchema.strict().safeParse(await this.request("resolveInitiativeApplicability", {
        initiativeId,
        expectedInitiativeRevision,
        actorId,
        applicability,
      }))
      if (!parsed.success) throw invalidHostResponse()
      const updated = parsed.data
      if (updated.id.toLowerCase() !== initiativeId || updated.revision !== expectedInitiativeRevision + 1 ||
          updated.applicability?.initiativeRevision !== updated.revision || updated.applicability.evaluatedBy.id !== actorId ||
          updated.applicability.decisions.some((decision) => decision.decidedBy.id !== actorId) ||
          updated.applicability.classificationDigest !== canonicalDigest(updated.classification) ||
          canonicalDigest(applicabilityInputFromRecord(updated.applicability)) !== canonicalDigest(applicability)) {
        throw invalidHostResponse()
      }
      return updated
    })
  }

  readPhaseDashboard(product: ProductBinding, phaseValue: DeliveryPhaseId): Promise<PhaseDashboardFramework> {
    return this.enqueue(async () => {
      const phase = normalizeDeliveryPhaseId(phaseValue)
      const productId = normalizeUuid(product.id, "Product ID")
      const productRevision = validateProductRevision(product.revision)
      const productDigest = product.digest.trim().toLowerCase()
      if (!/^sha256:[0-9a-f]{64}$/u.test(productDigest)) throw new TypeError("Product digest must be SHA-256")
      const expected = { phase, product: { ...product, id: productId, revision: productRevision, digest: productDigest } }
      return parsePhaseDashboardFramework(await this.request("dashboard.framework", {
        phase,
        expectedProductId: productId,
        expectedProductRevision: productRevision,
        expectedProductDigest: productDigest,
      }), expected)
    })
  }

  readPhase2UxFigmaDashboard(product: ProductBinding, initiativeValue: Initiative): Promise<Phase2UxFigmaDashboard> {
    return this.enqueue(async () => {
      const productId = normalizeUuid(product.id, "Product ID")
      const productRevision = validateProductRevision(product.revision)
      const productDigest = product.digest.trim().toLowerCase()
      if (!/^sha256:[0-9a-f]{64}$/u.test(productDigest)) throw new TypeError("Product digest must be SHA-256")
      const initiative = initiativeSchema.parse(initiativeValue)
      const initiativeRevision = validateProductRevision(initiative.revision ?? 1)
      const initiativeDigest = canonicalDigest(initiative)
      if (initiative.productId.toLowerCase() !== productId) throw invalidHostResponse()
      const parsed = phase2UxFigmaDashboardSchema.safeParse(await this.request("dashboard.phase2UxFigma", {
        expectedProductId: productId,
        expectedProductRevision: productRevision,
        expectedProductDigest: productDigest,
        expectedInitiativeId: initiative.id,
        expectedInitiativeRevision: initiativeRevision,
        expectedInitiativeDigest: initiativeDigest,
      }))
      if (!parsed.success) throw invalidHostResponse()
      const { snapshotDigest, ...content } = parsed.data
      if (snapshotDigest !== canonicalDigest(content) || parsed.data.product.recordId.toLowerCase() !== productId ||
          parsed.data.product.revision !== productRevision || parsed.data.product.digest !== productDigest ||
          parsed.data.initiative.recordId.toLowerCase() !== initiative.id.toLowerCase() ||
          parsed.data.initiative.revision !== initiativeRevision || parsed.data.initiative.digest !== initiativeDigest ||
          parsed.data.initiative.state !== initiative.state) throw invalidHostResponse()
      return parsed.data
    })
  }

  readPhase1Summary(product: ProductBinding, initiativeValue: Initiative): Promise<Phase1SummaryDashboard> {
    return this.enqueue(async () => {
      const productId = normalizeUuid(product.id, "Product ID")
      const productRevision = validateProductRevision(product.revision)
      const productDigest = product.digest.trim().toLowerCase()
      if (!/^sha256:[0-9a-f]{64}$/u.test(productDigest)) throw new TypeError("Product digest must be SHA-256")
      const initiative = initiativeSchema.parse(initiativeValue)
      const initiativeRevision = validateProductRevision(initiative.revision ?? 1)
      const initiativeDigest = canonicalDigest(initiative)
      if (initiative.productId.toLowerCase() !== productId) throw invalidHostResponse()
      const parsed = phase1SummaryDashboardSchema.safeParse(await this.request("dashboard.phase1Summary", {
        expectedProductId: productId,
        expectedProductRevision: productRevision,
        expectedProductDigest: productDigest,
        expectedInitiativeId: initiative.id,
        expectedInitiativeRevision: initiativeRevision,
        expectedInitiativeDigest: initiativeDigest,
      }))
      if (!parsed.success) throw invalidHostResponse()
      const { snapshotDigest, ...content } = parsed.data
      if (snapshotDigest !== canonicalDigest(content) || parsed.data.product.recordId.toLowerCase() !== productId ||
          parsed.data.product.revision !== productRevision || parsed.data.product.digest !== productDigest ||
          parsed.data.initiative.recordId.toLowerCase() !== initiative.id.toLowerCase() ||
          parsed.data.initiative.revision !== initiativeRevision || parsed.data.initiative.digest !== initiativeDigest ||
          parsed.data.initiative.state !== initiative.state) throw invalidHostResponse()
      return parsed.data
    })
  }

  readPhase1ChangeImpact(
    product: ProductBinding,
    initiativeValue: Initiative,
    changeValue: ChangeImpactChangeReference,
  ): Promise<Phase1ChangeImpactDashboard> {
    return this.enqueue(async () => {
      const productId = normalizeUuid(product.id, "Product ID")
      const productRevision = validateProductRevision(product.revision)
      const productDigest = product.digest.trim().toLowerCase()
      const initiative = initiativeSchema.parse(initiativeValue)
      const initiativeRevision = validateProductRevision(initiative.revision ?? 1)
      const initiativeDigest = canonicalDigest(initiative)
      const changeId = normalizeUuid(changeValue.recordId, "Change ID")
      const changeRevision = validateProductRevision(changeValue.revision)
      const changeDigest = changeValue.digest.trim().toLowerCase()
      if (![productDigest, changeDigest].every((digest) => /^sha256:[0-9a-f]{64}$/u.test(digest)) ||
          initiative.productId.toLowerCase() !== productId) throw invalidHostResponse()
      const parsed = phase1ChangeImpactDashboardSchema.safeParse(await this.request("dashboard.phase1ChangeImpact", {
        expectedProductId: productId,
        expectedProductRevision: productRevision,
        expectedProductDigest: productDigest,
        expectedInitiativeId: initiative.id,
        expectedInitiativeRevision: initiativeRevision,
        expectedInitiativeDigest: initiativeDigest,
        expectedChangeId: changeId,
        expectedChangeRevision: changeRevision,
        expectedChangeDigest: changeDigest,
      }))
      if (!parsed.success) throw invalidHostResponse()
      const { snapshotDigest, ...content } = parsed.data
      if (snapshotDigest !== canonicalDigest(content) || parsed.data.product.recordId.toLowerCase() !== productId ||
          parsed.data.product.revision !== productRevision || parsed.data.product.digest !== productDigest ||
          parsed.data.initiative.recordId.toLowerCase() !== initiative.id.toLowerCase() ||
          parsed.data.initiative.revision !== initiativeRevision || parsed.data.initiative.digest !== initiativeDigest ||
          parsed.data.initiative.state !== initiative.state || parsed.data.change.recordId.toLowerCase() !== changeId ||
          parsed.data.change.revision !== changeRevision || parsed.data.change.digest !== changeDigest) throw invalidHostResponse()
      return parsed.data
    })
  }

  listChangeImpactChanges(product: ProductBinding): Promise<ChangeImpactChangeCatalog> {
    return this.enqueue(async () => {
      const productId = normalizeUuid(product.id, "Product ID")
      const productRevision = validateProductRevision(product.revision)
      const productDigest = product.digest.trim().toLowerCase()
      if (!/^sha256:[0-9a-f]{64}$/u.test(productDigest)) throw new TypeError("Product digest must be SHA-256")
      const expectedProduct = { ...product, id: productId, revision: productRevision, digest: productDigest }
      return parseChangeImpactChangeCatalog(await this.request("dashboard.changeImpact.changes", {
        expectedProductId: productId,
        expectedProductRevision: productRevision,
        expectedProductDigest: productDigest,
      }), expectedProduct)
    })
  }

  readChangeImpact(
    product: ProductBinding,
    changeValue: ChangeImpactChangeReference,
  ): Promise<ChangeImpactDashboard> {
    return this.enqueue(async () => {
      const productId = normalizeUuid(product.id, "Product ID")
      const productRevision = validateProductRevision(product.revision)
      const productDigest = product.digest.trim().toLowerCase()
      const changeId = normalizeUuid(changeValue.recordId, "Change ID")
      const changeRevision = validateProductRevision(changeValue.revision)
      const changeDigest = changeValue.digest.trim().toLowerCase()
      if (!/^sha256:[0-9a-f]{64}$/u.test(productDigest) || !/^sha256:[0-9a-f]{64}$/u.test(changeDigest)) {
        throw new TypeError("Product and Change digests must be SHA-256")
      }
      const expectedProduct = { ...product, id: productId, revision: productRevision, digest: productDigest }
      const expectedChange = { ...changeValue, recordId: changeId, revision: changeRevision, digest: changeDigest }
      return parseChangeImpactDashboard(await this.request("dashboard.changeImpact", {
        expectedProductId: productId,
        expectedProductRevision: productRevision,
        expectedProductDigest: productDigest,
        expectedChangeId: changeId,
        expectedChangeRevision: changeRevision,
        expectedChangeDigest: changeDigest,
      }), { product: expectedProduct, change: expectedChange })
    })
  }

  async readAgentModel(product: ProductBinding): Promise<AgentModelDashboard> {
    const capabilities = await this.probeAgentReadiness()
    const selection = await this.readAgentSelection()
    return this.enqueue(async () => {
      const productId = normalizeUuid(product.id, "Product ID")
      const productRevision = validateProductRevision(product.revision)
      const productDigest = product.digest.trim().toLowerCase()
      if (!/^sha256:[0-9a-f]{64}$/u.test(productDigest)) throw new TypeError("Product digest must be SHA-256")
      const expectedSelection = selection.status === "selected"
        ? { status: "selected" as const, selectionDigest: canonicalDigest(selection.selection) }
        : selection.status === "migration-required"
          ? { status: "migration-required" as const, selectionDigest: canonicalDigest(selection.portableCandidate) }
          : { status: selection.status }
      const expectedCapabilities = capabilities.map((entry) => ({
        adapterId: entry.adapterId,
        agentId: entry.agentId,
        capabilityDigest: entry.capabilityDigest,
      }))
      const expectedProduct = { ...product, id: productId, revision: productRevision, digest: productDigest }
      return parseAgentModelDashboard(await this.request("dashboard.agentModel", {
        expectedProductId: productId,
        expectedProductRevision: productRevision,
        expectedProductDigest: productDigest,
        expectedSelection,
        expectedCapabilities,
      }), { product: expectedProduct, capabilities, selection })
    })
  }

  async readPhase1AgentModel(
    product: ProductBinding,
    initiativeValue: Initiative,
  ): Promise<Phase1AgentModelDashboard> {
    const capabilities = await this.probeAgentReadiness()
    const selection = await this.readAgentSelection()
    return this.enqueue(async () => {
      const productId = normalizeUuid(product.id, "Product ID")
      const productRevision = validateProductRevision(product.revision)
      const productDigest = product.digest.trim().toLowerCase()
      const initiative = initiativeSchema.strict().parse(initiativeValue)
      const initiativeId = normalizeUuid(initiative.id, "Initiative ID")
      const initiativeRevision = validateProductRevision(initiative.revision ?? 1)
      const initiativeDigest = canonicalDigest(initiative)
      if (!/^sha256:[0-9a-f]{64}$/u.test(productDigest) || initiative.productId.toLowerCase() !== productId) {
        throw new TypeError("Product and Initiative bindings must be exact")
      }
      const expectedSelection = selection.status === "selected"
        ? { status: "selected" as const, selectionDigest: canonicalDigest(selection.selection) }
        : selection.status === "migration-required"
          ? { status: "migration-required" as const, selectionDigest: canonicalDigest(selection.portableCandidate) }
          : { status: selection.status }
      const expectedCapabilities = capabilities.map((entry) => ({
        adapterId: entry.adapterId,
        agentId: entry.agentId,
        capabilityDigest: entry.capabilityDigest,
      }))
      const agentModelRequest = {
        expectedProductId: productId,
        expectedProductRevision: productRevision,
        expectedProductDigest: productDigest,
        expectedSelection,
        expectedCapabilities,
      }
      const result = await this.request("dashboard.phase1AgentModel", {
        expectedInitiativeId: initiativeId,
        expectedInitiativeRevision: initiativeRevision,
        expectedInitiativeDigest: initiativeDigest,
        agentModel: agentModelRequest,
      })
      const parsed = phase1AgentModelDashboardSchema.safeParse(result)
      if (!parsed.success) throw invalidHostResponse()
      const dashboard = parsed.data
      const expectedProduct = { ...product, id: productId, revision: productRevision, digest: productDigest }
      const agentModel = parseAgentModelDashboard(dashboard.agentModel, {
        product: expectedProduct,
        capabilities,
        selection,
      })
      const { snapshotDigest, ...content } = dashboard
      if (dashboard.product.recordId.toLowerCase() !== productId || dashboard.product.revision !== productRevision ||
          dashboard.product.digest !== productDigest || dashboard.initiative.recordId.toLowerCase() !== initiativeId ||
          dashboard.initiative.revision !== initiativeRevision || dashboard.initiative.digest !== initiativeDigest ||
          dashboard.source.agentModelSnapshotDigest !== agentModel.snapshotDigest ||
          snapshotDigest !== canonicalDigest(content)) throw invalidHostResponse()
      return dashboard
    })
  }

  probeAgentReadiness(): Promise<readonly AgentReadinessSnapshot[]> {
    return this.enqueue(async () => parseAgentReadiness(await this.request("probeAgents", {})))
  }

  readAgentSelection(): Promise<AgentSelectionState> {
    return this.enqueue(async () => parseAgentSelectionState(await this.request("readAgentSelection", {})))
  }

  selectAgent(input: {
    readonly adapterId: string
    readonly modelId: string
    readonly settings: Readonly<Record<string, PortableAgentSettingValue>>
    readonly actorId: string
  }): Promise<AgentSelection> {
    return this.enqueue(async () => {
      const adapterId = normalizeSelectionIdentifier(input.adapterId, "Adapter ID")
      const modelId = normalizeSelectionIdentifier(input.modelId, "Model ID")
      const settings = normalizeSelectionSettings(input.settings)
      const actorId = normalizeActorId(input.actorId)
      return parseAgentSelection(await this.request("selectAgent", { adapterId, modelId, settings, actorId }))
    })
  }

  listRuns(): Promise<readonly AgentRun[]> {
    return this.enqueue(async () => parseAgentRuns(await this.request("listRuns", {})))
  }

  createHandoff(input: {
    readonly fromRunId: string
    readonly productId: string
    readonly initiativeId: string
    readonly toAdapterId: string
    readonly toAgentId: string
    readonly toModelId: string
    readonly toSettings: Readonly<Record<string, PortableAgentSettingValue>>
    readonly reason: string
    readonly completedWork: readonly string[]
    readonly unresolvedMatters: readonly string[]
    readonly decisions: readonly string[]
    readonly evidence: readonly string[]
    readonly actorId: string
  }): Promise<AgentHandoff> {
    return this.enqueue(async () => {
      const fromRunId = normalizeUuid(input.fromRunId, "Source Run ID")
      const productId = normalizeUuid(input.productId, "Product ID")
      const initiativeId = normalizeUuid(input.initiativeId, "Initiative ID")
      const toAdapterId = normalizeSelectionIdentifier(input.toAdapterId, "Target Adapter ID")
      const toAgentId = normalizeSelectionIdentifier(input.toAgentId, "Target Agent ID")
      const toModelId = normalizeSelectionIdentifier(input.toModelId, "Target Model ID")
      const toSettings = normalizeSelectionSettings(input.toSettings)
      const reason = normalizeHandoffText(input.reason, "Handoff reason", 2, 5_000)
      const completedWork = normalizeHandoffTextList(input.completedWork, "Completed work")
      const unresolvedMatters = normalizeHandoffTextList(input.unresolvedMatters, "Unresolved matters")
      const decisions = normalizeHandoffTextList(input.decisions, "Decisions")
      const evidence = normalizeHandoffTextList(input.evidence, "Evidence")
      const actorId = normalizeActorId(input.actorId)
      const result = await this.request("createHandoff", {
        actorId,
        handoff: {
          fromRunId,
          toAdapterId,
          toModelId,
          toSettings,
          reason,
          completedWork,
          unresolvedMatters,
          decisions,
          evidence,
        },
      })
      return parseAgentHandoff(result, {
        fromRunId,
        productId,
        initiativeId,
        toAdapterId,
        toAgentId,
        toModelId,
        toSettings,
        reason,
        completedWork,
        unresolvedMatters,
        decisions,
        evidence,
      })
    })
  }

  previewManagedReadOnly(charterId: string, workflowPlanId: string): Promise<ManagedReadOnlyPreview> {
    return this.enqueue(async () => {
      const expected = {
        charterId: normalizeUuid(charterId, "Charter ID"),
        workflowPlanId: normalizeUuid(workflowPlanId, "Workflow Plan ID"),
      }
      return parseManagedReadOnlyPreview(
        await this.request("managed.readonly.preview", expected),
        expected,
      )
    })
  }

  executeManagedReadOnly(input: {
    readonly preview: ManagedReadOnlyPreview
    readonly timeoutMs: number
    readonly actorId: string
  }): Promise<ManagedReadOnlyReceipt> {
    return this.enqueue(async () => {
      const actorId = normalizeActorId(input.actorId)
      if (!Number.isSafeInteger(input.timeoutMs) || input.timeoutMs < 1_000 || input.timeoutMs > 300_000) {
        throw new RangeError("Managed read-only timeout must be between 1,000 and 300,000 milliseconds")
      }
      const preview = parseManagedReadOnlyPreview(input.preview, {
        charterId: input.preview.charterId,
        workflowPlanId: input.preview.workflowPlanId,
      })
      const result = await this.request("managed.readonly.execute", {
        actorId,
        charterId: preview.charterId,
        workflowPlanId: preview.workflowPlanId,
        expectedPreviewDigest: preview.previewDigest,
        timeoutMs: input.timeoutMs,
        confirmation: "attest-exact-managed-readonly-preview",
      })
      return parseManagedReadOnlyReceipt(result, preview)
    })
  }

  listManagedEvidence(
    offset = 0,
    limit = 100,
    snapshotDigest?: string,
    expectedTotal?: number,
  ): Promise<ManagedRunSummaryPage> {
    return this.enqueue(async () => {
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 2_000) {
        throw new RangeError("Managed Run offset must be between 0 and 2,000")
      }
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
        throw new RangeError("Managed Run limit must be between 1 and 200")
      }
      const normalizedSnapshot = snapshotDigest?.trim().toLowerCase()
      if (snapshotDigest !== undefined && !/^sha256:[0-9a-f]{64}$/u.test(normalizedSnapshot ?? "")) {
        throw new TypeError("Managed Run snapshot digest must be SHA-256")
      }
      if (expectedTotal !== undefined &&
        (!Number.isSafeInteger(expectedTotal) || expectedTotal < 0 || expectedTotal > 2_000)) {
        throw new RangeError("Managed Run expected total must be between 0 and 2,000")
      }
      const requestParams = {
        offset,
        limit,
        ...(normalizedSnapshot ? { snapshotDigest: normalizedSnapshot } : {}),
      }
      const expected = {
        ...requestParams,
        ...(expectedTotal !== undefined ? { total: expectedTotal } : {}),
      }
      return parseManagedRunSummaryPage(
        await this.request("managed.evidence.list", requestParams),
        expected,
      )
    })
  }

  readManagedEvidence(managedRunId: string): Promise<ManagedEvidenceDetail> {
    return this.enqueue(async () => {
      const normalizedManagedRunId = normalizeUuid(managedRunId, "Managed Run ID")
      return parseManagedEvidenceDetail(
        await this.request("managed.evidence.read", { managedRunId: normalizedManagedRunId }),
        normalizedManagedRunId,
      )
    })
  }

  readManagedReview(managedRunId: string): Promise<ManagedReviewPreview> {
    return this.enqueue(async () => {
      const normalizedManagedRunId = normalizeUuid(managedRunId, "Managed Run ID")
      return parseManagedReviewPreview(
        await this.request("managed.review.read", { managedRunId: normalizedManagedRunId }),
        normalizedManagedRunId,
      )
    })
  }

  applyManagedReview(preview: ManagedReviewPreview, actorId: string): Promise<ManagedReviewTransition> {
    return this.decideManagedReview(preview, actorId, "apply-exact-managed-review")
  }

  discardManagedReview(preview: ManagedReviewPreview, actorId: string): Promise<ManagedReviewTransition> {
    return this.decideManagedReview(preview, actorId, "discard-exact-managed-review")
  }

  private decideManagedReview(
    inputPreview: ManagedReviewPreview,
    inputActorId: string,
    decision: ManagedReviewTransition["decision"],
  ): Promise<ManagedReviewTransition> {
    return this.enqueue(async () => {
      const preview = parseManagedReviewPreview(inputPreview, inputPreview.managedRunId)
      const actorId = normalizeActorId(inputActorId)
      const method = decision === "apply-exact-managed-review" ? "managed.review.apply" : "managed.review.discard"
      const result = await this.request(method, {
        actorId,
        managedRunId: preview.managedRunId,
        expectedManagedRunRevision: preview.managedRunRevision,
        expectedPreviewDigest: preview.previewDigest,
        confirmation: decision,
      })
      return parseManagedReviewTransition(result, preview, decision)
    })
  }

  importPortableDesignSnapshot(input: {
    readonly bundleRoot: string
    readonly expectedProductId: string
    readonly expectedProductRevision: number
    readonly actorId: string
  }): Promise<PortableDesignSnapshotSummary> {
    return this.enqueue(async () => {
      const bundleRoot = await normalizeExistingLocalFolder(input.bundleRoot)
      const productId = normalizeUuid(input.expectedProductId, "Product ID")
      const productRevision = validateProductRevision(input.expectedProductRevision)
      const actorId = normalizeActorId(input.actorId)
      const result = await this.request("productStudio.portableDesign.import", {
        bundleRoot,
        expectedProductId: productId,
        expectedProductRevision: productRevision,
        actorId,
      })
      return parseSnapshotResult(result, { productId })
    })
  }

  listPortableDesignSnapshots(offset = 0, limit = defaultPageSize): Promise<PortableDesignSnapshotPage> {
    return this.enqueue(async () => {
      validatePage(offset, limit)
      return parsePageResult(
        await this.request("productStudio.portableDesign.list", { offset, limit }),
        offset,
        limit,
      )
    })
  }

  readPortableDesignSnapshot(bundleId: string): Promise<PortableDesignSnapshotSummary> {
    return this.enqueue(async () => {
      const normalizedBundleId = normalizeUuid(bundleId, "Bundle ID")
      return parseSnapshotResult(
        await this.request("productStudio.portableDesign.read", { bundleId: normalizedBundleId }),
        { bundleId: normalizedBundleId },
      )
    })
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    await this.requestTail.catch(() => undefined)
    this.stopProcess()
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (this.disposed) return Promise.reject(hostUnavailable())
    const result = this.requestTail.then(operation, operation)
    this.requestTail = result.then(() => undefined, () => undefined)
    return result
  }

  private async request(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (this.disposed) throw hostUnavailable()
    const id = ++this.nextId
    if (!Number.isSafeInteger(id)) {
      this.stopProcess()
      throw hostUnavailable()
    }
    const serialized = JSON.stringify({ jsonrpc: "2.0", id, method, params, protocolVersion })
    if (Buffer.byteLength(serialized) > maximumFrameBytes) throw frameTooLarge()

    let raw: string
    try {
      await this.ensureStarted()
      const child = this.child
      if (!child || child.exitCode !== null || !child.stdin.writable) throw hostUnavailable()
      if (!child.stdin.write(`${serialized}\n`, "utf8")) await once(child.stdin, "drain")
      raw = await this.readResponseFrame()
    } catch (error) {
      this.stopProcess()
      if (error instanceof GaepHostError) throw error
      throw hostUnavailable()
    }

    try {
      return parseHostResult(raw, id)
    } catch (error) {
      if (error instanceof GaepHostError && error.kind === "HOST_RESPONSE_INVALID") this.stopProcess()
      if (error instanceof GaepHostError) throw error
      this.stopProcess()
      throw invalidHostResponse()
    }
  }

  private async ensureStarted(): Promise<void> {
    if (this.child && this.child.exitCode === null && !this.child.killed) return
    this.stopProcess()
    const identity = await this.resolveAndVerifyEngine()
    const packagedEngineIdentity = await this.resolveAndVerifyPackagedEngine()
    const child = spawn(
      identity.path,
      [
        ...(packagedEngineIdentity ? [packagedEngineIdentity.path] : this.engineArgumentsPrefix),
        "--workspace",
        this.workspacePath,
      ],
      {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        env: this.childEnvironment,
      },
    )
    child.on("error", () => {
      // A permanent listener prevents late spawn/process errors from escaping the extension host.
    })
    child.stdin.on("error", () => {
      // The active request observes closure/write failure and converts it to a stable host error.
    })
    child.stdout.on("error", () => {
      // The async iterator observes stream failure; never surface a raw stream error globally.
    })
    child.stderr.on("error", () => {
      // Stderr is intentionally drained and never copied into user-facing diagnostics.
    })
    child.stderr.resume()
    try {
      await once(child, "spawn")
      if (await digest(identity.path) !== identity.digest) {
        throw new Error("The GAEP engine executable changed while the host process was starting")
      }
      if (packagedEngineIdentity && await digest(packagedEngineIdentity.path) !== packagedEngineIdentity.digest) {
        throw new Error("The packaged GAEP engine changed while the host process was starting")
      }
      this.child = child
      this.stdoutIterator = child.stdout[Symbol.asyncIterator]() as AsyncIterator<Buffer>
      this.pendingResponse = Buffer.alloc(0)
    } catch (error) {
      child.kill()
      throw error
    }
  }

  private async resolveAndVerifyEngine(): Promise<EngineIdentity> {
    const path = await resolveExecutable(this.requestedExecutable, this.childEnvironment)
    const executableDigest = await digest(path)
    if (this.configuredDigest && this.configuredDigest !== executableDigest) {
      throw new Error("The GAEP engine executable does not match the configured SHA-256 digest")
    }
    if (this.boundIdentity && (samePath(this.boundIdentity.path, path) === false || this.boundIdentity.digest !== executableDigest)) {
      throw new Error("The bound GAEP engine executable changed after this client was created")
    }
    this.boundIdentity ??= Object.freeze({ path, digest: executableDigest })
    return this.boundIdentity
  }

  private async resolveAndVerifyPackagedEngine(): Promise<EngineIdentity | undefined> {
    if (!this.requestedPackagedEngine) return undefined
    const path = await resolveAbsoluteRegularFile(this.requestedPackagedEngine)
    const packagedEngineDigest = await digest(path)
    if (this.configuredPackagedEngineDigest !== packagedEngineDigest) {
      throw new Error("The packaged GAEP engine does not match its embedded SHA-256 digest")
    }
    if (this.boundPackagedEngineIdentity &&
        (samePath(this.boundPackagedEngineIdentity.path, path) === false ||
          this.boundPackagedEngineIdentity.digest !== packagedEngineDigest)) {
      throw new Error("The bound packaged GAEP engine changed after this client was created")
    }
    this.boundPackagedEngineIdentity ??= Object.freeze({ path, digest: packagedEngineDigest })
    return this.boundPackagedEngineIdentity
  }

  private async readResponseFrame(): Promise<string> {
    while (true) {
      const newline = this.pendingResponse.indexOf(0x0a)
      if (newline >= 0) {
        if (newline > maximumFrameBytes) throw responseTooLarge()
        const length = newline > 0 && this.pendingResponse[newline - 1] === 0x0d ? newline - 1 : newline
        const frame = this.pendingResponse.subarray(0, length)
        this.pendingResponse = this.pendingResponse.subarray(newline + 1)
        try {
          return new TextDecoder("utf-8", { fatal: true }).decode(frame)
        } catch {
          throw invalidUtf8()
        }
      }
      if (this.pendingResponse.length > maximumFrameBytes) throw responseTooLarge()
      const iterator = this.stdoutIterator
      if (!iterator) throw hostUnavailable()
      const next = await iterator.next()
      if (next.done) throw hostUnavailable()
      const chunk = Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value)
      this.pendingResponse = this.pendingResponse.length === 0
        ? chunk
        : Buffer.concat([this.pendingResponse, chunk], this.pendingResponse.length + chunk.length)
    }
  }

  private stopProcess(): void {
    const child = this.child
    this.child = undefined
    this.stdoutIterator = undefined
    this.pendingResponse = Buffer.alloc(0)
    if (!child) return
    child.stdin.destroy()
    child.stdout.destroy()
    child.stderr.destroy()
    if (child.exitCode === null) child.kill()
  }
}

function classificationInputFromRecord(classification: NonNullable<Initiative["classification"]>): InitiativeClassificationInput {
  const {
    productProfile: _productProfile,
    productRevision: _productRevision,
    productDigest: _productDigest,
    completenessPolicyVersion: _completenessPolicyVersion,
    completenessPolicyDigest: _completenessPolicyDigest,
    classifiedBy: _classifiedBy,
    classifiedAt: _classifiedAt,
    authorityBoundary: _authorityBoundary,
    ...input
  } = classification
  return initiativeClassificationInputSchema.parse(input)
}

function applicabilityInputFromRecord(
  matrix: NonNullable<Initiative["applicability"]>,
): InitiativeApplicabilityMatrixInput {
  return initiativeApplicabilityMatrixInputSchema.parse({
    decisions: matrix.decisions.map((decision) => {
      const {
        id: _id,
        revision: _revision,
        initiativeRevision: _initiativeRevision,
        decidedBy: _decidedBy,
        decidedAt: _decidedAt,
        authorityBoundary: _authorityBoundary,
        ...input
      } = decision
      return input
    }),
    unresolvedSubjects: matrix.unresolvedSubjects,
    ...(matrix.subjectCatalog ? { subjectCatalog: matrix.subjectCatalog } : {}),
  })
}

function normalizeSelectionIdentifier(value: string, label: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 20_000 ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value) ||
    /^(?:\/[\S]+|[A-Za-z]:[\\/][\S]+|\\\\[\S]+|file:\/\/[\S]+)$/u.test(value.trim()) ||
    /(?:^|[\s(="'])(?:\/(?:Users|home|tmp|private|Volumes)\/[^\s"'<>)]*|[A-Za-z]:\\[^\s"'<>)]*|\\\\[^\s"'<>)]*)/u.test(value) ||
    /\bBearer\s+\S+|\b(?:sk|sk-ant)-[A-Za-z0-9_-]{8,}\b|\b(?:token|secret|password|passwd|api[_-]?key)\s*[:=]\s*\S+/iu.test(value)) {
    throw new TypeError(`${label} must be verified portable capability text`)
  }
  return value
}

function normalizeSelectionSettings(
  value: Readonly<Record<string, PortableAgentSettingValue>>,
): Readonly<Record<string, PortableAgentSettingValue>> {
  try {
    return parsePortableSelectionSettings(value)
  } catch {
    throw new TypeError("Agent settings must contain only verified portable, non-secret values")
  }
}

function normalizeHandoffTextList(value: readonly string[], label: string): readonly string[] {
  if (!Array.isArray(value) || value.length > 256) {
    throw new TypeError(`${label} must contain at most 256 portable entries`)
  }
  return Object.freeze(value.map((item) => normalizeHandoffText(item, label, 1, 2_000)))
}

function normalizeHandoffText(value: string, label: string, minimum: number, maximum: number): string {
  if (typeof value !== "string") throw new TypeError(`${label} must be portable text`)
  const normalized = value.trim()
  if (normalized.length < minimum || normalized.length > maximum ||
    /[\u0000-\u001F\u007F-\u009F]/u.test(normalized) ||
    /(?:^|[\s(="'])(?:~[\\/]|\/(?!\/)[^\s"'<>)]*|[A-Za-z]:[\\/][^\s"'<>)]*|\\\\[^\s"'<>)]*|file:\/\/[^\s"'<>)]*)/u.test(normalized) ||
    /\bBearer\s+\S+|\b(?:sk|sk-ant)-[A-Za-z0-9_-]{8,}\b|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b|\bAKIA[A-Z0-9]{16}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:token|secret|password|passwd|api[_-]?key)\s*[:=]\s*\S+/iu.test(normalized)) {
    throw new TypeError(`${label} must be portable text without paths, controls, or secret-shaped values`)
  }
  return normalized
}

async function resolveExecutable(requested: string, environment: NodeJS.ProcessEnv): Promise<string> {
  if (!requested || requested.length > 32_768 || requested.includes("\0")) {
    throw new Error("The GAEP engine executable is invalid")
  }
  const hasDirectory = requested.includes("/") || requested.includes("\\") || dirname(requested) !== "."
  const candidates = isAbsolute(requested) || hasDirectory
    ? [resolve(requested)]
    : executableCandidates(requested, environment)
  for (const candidate of candidates) {
    try {
      await access(candidate)
      const canonical = await realpath(candidate)
      if ((await stat(canonical)).isFile()) return canonical
    } catch {
      // Continue to the next explicit PATH candidate without surfacing machine paths.
    }
  }
  throw new Error("The GAEP engine executable could not be resolved to an existing file")
}

async function resolveAbsoluteRegularFile(requested: string): Promise<string> {
  if (!requested || requested.length > 32_768 || requested.includes("\0") || !isAbsolute(requested)) {
    throw new Error("The packaged GAEP engine path is invalid")
  }
  try {
    const canonical = await realpath(requested)
    if ((await stat(canonical)).isFile()) return canonical
  } catch {
    // Fall through to one stable path-free error.
  }
  throw new Error("The packaged GAEP engine could not be resolved to an existing file")
}

function executableCandidates(requested: string, environment: NodeJS.ProcessEnv): string[] {
  const path = environmentValue(environment, "PATH") ?? ""
  const extensions = process.platform === "win32"
    ? (environmentValue(environment, "PATHEXT") ?? ".EXE;.CMD;.BAT").split(";").filter(Boolean)
    : [""]
  return path.split(delimiter).filter(Boolean).flatMap((directory) => extensions.map((extension) => {
    const requestedExtension = extname(requested)
    const name = requestedExtension || !extension ? requested : `${requested}${extension}`
    return resolve(directory, name)
  }))
}

function digest(path: string): Promise<string> {
  return new Promise((resolveDigest, reject) => {
    const hash = createHash("sha256")
    const input = createReadStream(path)
    input.on("error", reject)
    input.on("data", (chunk) => hash.update(chunk))
    input.on("end", () => resolveDigest(hash.digest("hex")))
  })
}

function normalizeDigest(value: string | undefined, label = "Expected engine SHA-256"): string | undefined {
  if (!value?.trim()) return undefined
  if (value.length > 80) throw new TypeError(`${label} must contain exactly 64 hexadecimal characters`)
  const normalized = value.trim().toLowerCase().replace(/^sha256:/u, "")
  if (!/^[0-9a-f]{64}$/u.test(normalized)) {
    throw new TypeError(`${label} must contain exactly 64 hexadecimal characters`)
  }
  return normalized
}

function samePath(left: string, right: string): boolean {
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right
}

function environmentValue(source: NodeJS.ProcessEnv, requestedName: string): string | undefined {
  const exact = source[requestedName]
  if (exact !== undefined) return exact
  const actualName = Object.keys(source).find((name) => name.toUpperCase() === requestedName.toUpperCase())
  return actualName ? source[actualName] : undefined
}
