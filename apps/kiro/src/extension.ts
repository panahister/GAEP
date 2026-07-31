import { randomBytes } from "node:crypto"
import { join } from "node:path"

import * as vscode from "vscode"

import {
  collectInitiativeApplicability,
  collectInitiativeClassification,
  containsSecretShapedValue,
  InitiativeEntryWorkflowCancelled,
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
  type BacklogHierarchyProjection,
  type MvpSliceDefinitionProjection,
  type PrioritizationModelProjection,
  type AcceptanceCriteriaProjection,
  type DefinitionOfReadyProjection,
  type DefinitionOfDoneProjection,
  type ImplementationUnitModelProjection,
  type DependencyMappingProjection,
  type TechnologyProfileProjection,
  type BoilerplateRegistryProjection,
  type BoilerplateSelectionBindingProjection,
  type BoilerplateCompatibilityValidationProjection,
  type FigmaToBoilerplateMappingProjection,
  type DesignToCodeBindingRegistryProjection,
  type RouteScreenComponentMappingProjection,
  type TestMethodologyProjection,
  type TestInventoryProjection,
  type HighLevelDesignProjection,
  type LowLevelDesignProjection,
  type ImplementationReadinessGateProjection,
  type ChangedUnitInventoryProjection,
  type ProposedChangePreviewProjection,
  type StagingWorkspaceProjection,
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
  type Phase2ChangeImpactAgentModelDashboard,
  type Phase3aDashboard,
  type Phase1SummaryDashboard,
  type Phase1ChangeImpactDashboard,
  type Phase1AgentModelDashboard,
  type Initiative,
  type InitiativeEntryAssessment,
  type InitiativeEntryWorkflowUi,
  type OperatingModelProjection,
  type SecurityPrivacyAssessmentProjection,
  type ProcessModelProjection,
  type SourceGovernanceProjection,
  type SystemSolutionArchitectureProjection,
  type ValueStreamModelProjection,
} from "@gaep/contracts"

import {
  accessibleTableCsv,
  buildAccessibleTableView,
  createAccessibleMetadataTable,
  renderAccessibleTableText,
  type AccessibleMetadataTable,
  type AccessibleTableColumn,
  type AccessibleTableRow,
  type AccessibleTableSortDirection,
} from "./accessible-table.js"
import { GaepEngineClient } from "./engine-client.js"
import {
  GaepHostError,
  normalizeActorId,
  normalizeExistingLocalFolder,
  normalizeUuid,
  validatePage,
  type AgentHandoff,
  type AgentModelDashboard,
  type AgentReadinessSnapshot,
  type AgentRun,
  type AgentSelection,
  type AgentSelectionSetting,
  type ChangeImpactChangeCatalog,
  type ChangeImpactDashboard,
  type ManagedReadOnlyPreview,
  type ManagedReadOnlyReceipt,
  type ManagedEvidenceDetail,
  type ManagedRunSummaryPage,
  type ManagedReviewPreview,
  type ManagedReviewTransition,
  type PortableAgentSettingValue,
  type PortableDesignSnapshotPage,
  type PortableDesignSnapshotSummary,
  type PhaseDashboardFramework,
  type ProductBinding,
} from "./protocol.js"

declare const __GAEP_PACKAGED_ENGINE_SHA256__: string

const productStudioViewType = "gaepKiro.productStudio"
const commandIds = {
  open: "gaepKiro.openProductStudio",
  readiness: "gaepKiro.agents.readiness",
  selectAgent: "gaepKiro.agents.select",
  handoffAgent: "gaepKiro.agents.handoff",
  managedReadOnly: "gaepKiro.runs.managedReadOnly",
  evidence: "gaepKiro.runs.evidence",
  stagedReview: "gaepKiro.runs.stagedReview",
  dashboard: "gaepKiro.dashboard.phase",
  phase2UxFigma: "gaepKiro.dashboard.phase2UxFigma",
  phase2ChangeImpactAgentModel: "gaepKiro.dashboard.phase2ChangeImpactAgentModel",
  phase3a: "gaepKiro.dashboard.phase3a",
  phase1Summary: "gaepKiro.dashboard.phase1Summary",
  phase1ChangeImpact: "gaepKiro.dashboard.phase1ChangeImpact",
  changeImpact: "gaepKiro.dashboard.changeImpact",
  agentModel: "gaepKiro.dashboard.agentModel",
  phase1AgentModel: "gaepKiro.dashboard.phase1AgentModel",
  accessibleTables: "gaepKiro.dashboard.accessibleTables",
  initiativeEntry: "gaepKiro.initiativeEntry.inspect",
  classifyInitiative: "gaepKiro.initiativeEntry.classify",
  resolveApplicability: "gaepKiro.initiativeEntry.resolveApplicability",
  sourceGovernance: "gaepKiro.sourceGovernance.inspect",
  businessUnderstanding: "gaepKiro.businessUnderstanding.inspect",
  businessCapabilityMap: "gaepKiro.businessCapabilityMap.inspect",
  valueStreamModel: "gaepKiro.valueStreamModel.inspect",
  operatingModel: "gaepKiro.operatingModel.inspect",
  businessRules: "gaepKiro.businessRules.inspect",
  businessArchitectureBaseline: "gaepKiro.businessArchitectureBaseline.inspect",
  systemSolutionArchitecture: "gaepKiro.systemSolutionArchitecture.inspect",
  boundedContextModel: "gaepKiro.boundedContextModel.inspect",
  securityPrivacyAssessment: "gaepKiro.securityPrivacyAssessment.inspect",
  processModel: "gaepKiro.processModel.inspect",
  dataModel: "gaepKiro.dataModel.inspect",
  authorizationModel: "gaepKiro.authorizationModel.inspect",
  eventIntegrationModel: "gaepKiro.eventIntegrationModel.inspect",
  failureRecoveryModel: "gaepKiro.failureRecoveryModel.inspect",
  architectureChallengeModel: "gaepKiro.architectureChallengeModel.inspect",
  decisionRegister: "gaepKiro.decisionRegister.inspect",
  riskRegister: "gaepKiro.riskRegister.inspect",
  evidenceRegistry: "gaepKiro.evidenceRegistry.inspect",
  endToEndTraceability: "gaepKiro.endToEndTraceability.inspect",
  p0P4ReadinessGate: "gaepKiro.p0P4ReadinessGate.inspect",
  p5HandoffPackage: "gaepKiro.p5HandoffPackage.inspect",
  designApplicability: "gaepKiro.designApplicability.inspect",
  designPersonaRole: "gaepKiro.designPersonasRoles.inspect",
  userJourney: "gaepKiro.userJourneys.inspect",
  informationArchitecture: "gaepKiro.informationArchitecture.inspect",
  screenStateInventory: "gaepKiro.screenStateInventory.inspect",
  designRequirements: "gaepKiro.designRequirements.inspect",
  backlogHierarchy: "gaepKiro.backlogHierarchy.inspect",
  mvpSliceDefinition: "gaepKiro.mvpSliceDefinition.inspect",
  prioritizationModel: "gaepKiro.prioritizationModel.inspect",
  acceptanceCriteria: "gaepKiro.acceptanceCriteria.inspect",
  definitionOfReady: "gaepKiro.definitionOfReady.inspect",
  definitionOfDone: "gaepKiro.definitionOfDone.inspect",
  implementationUnitModel: "gaepKiro.implementationUnitModel.inspect",
  dependencyMapping: "gaepKiro.dependencyMapping.inspect",
  technologyProfile: "gaepKiro.technologyProfile.inspect",
  boilerplateRegistry: "gaepKiro.boilerplateRegistry.inspect",
  boilerplateSelectionBinding: "gaepKiro.boilerplateSelectionBinding.inspect",
  boilerplateCompatibilityValidation: "gaepKiro.boilerplateCompatibilityValidation.inspect",
  figmaToBoilerplateMapping: "gaepKiro.figmaToBoilerplateMapping.inspect",
  designToCodeBindingRegistry: "gaepKiro.designToCodeBindingRegistry.inspect",
  routeScreenComponentMapping: "gaepKiro.routeScreenComponentMapping.inspect",
  testMethodology: "gaepKiro.testMethodology.inspect",
  testInventory: "gaepKiro.testInventory.inspect",
  highLevelDesign: "gaepKiro.highLevelDesign.inspect",
  lowLevelDesign: "gaepKiro.lowLevelDesign.inspect",
  implementationReadinessGate: "gaepKiro.implementationReadinessGate.inspect",
  changedUnitInventory: "gaepKiro.changedUnitInventory.inspect",
  proposedChangePreview: "gaepKiro.proposedChangePreview.inspect",
  stagingWorkspace: "gaepKiro.stagingWorkspace.inspect",
  designSystemTokenContract: "gaepKiro.designSystemTokenContract.inspect",
  accessibilityDesignRules: "gaepKiro.accessibilityDesignRules.inspect",
  responsiveMultiPlatformTargets: "gaepKiro.responsiveMultiPlatformTargets.inspect",
  manualFigmaExecutionPath: "gaepKiro.manualFigmaExecutionPath.inspect",
  figmaMcpCapabilityDiscovery: "gaepKiro.figmaMcpCapabilityDiscovery.inspect",
  figmaReadSnapshot: "gaepKiro.figmaReadSnapshot.inspect",
  figmaContextImport: "gaepKiro.figmaContextImport.inspect",
  outboundDesignBriefPackage: "gaepKiro.outboundDesignBriefPackage.inspect",
  governedFigmaWrite: "gaepKiro.governedFigmaWrite.inspect",
  finalizedFigmaSnapshotImport: "gaepKiro.finalizedFigmaSnapshotImport.inspect",
  designToRequirementBinding: "gaepKiro.designToRequirementBinding.inspect",
  designerReadyGate: "gaepKiro.designerReadyGate.inspect",
  designDelta: "gaepKiro.designDelta.inspect",
  designConflictResolution: "gaepKiro.designConflictResolution.inspect",
  humanDesignApproval: "gaepKiro.humanDesignApproval.inspect",
  designBaseline: "gaepKiro.designBaseline.inspect",
  designDriftDetection: "gaepKiro.designDriftDetection.inspect",
  import: "gaepKiro.portableDesign.import",
  list: "gaepKiro.portableDesign.list",
  read: "gaepKiro.portableDesign.read",
} as const

class WorkflowCancelled extends Error {}
class ConfigurationBoundaryError extends Error {}

interface ClientEntry {
  readonly signature: string
  readonly client: GaepEngineClient
}

class EngineClientPool implements vscode.Disposable {
  private readonly clients = new Map<string, ClientEntry>()

  constructor(private readonly extensionPath: string) {}

  async get(workspacePath: string): Promise<GaepEngineClient> {
    const executable = machineSetting("engineExecutable", "GAEP_ENGINE_EXECUTABLE", "").trim()
    const digest = machineSetting("engineSha256", "GAEP_ENGINE_SHA256", "")
    if (!executable && digest.trim()) {
      throw new ConfigurationBoundaryError(
        "gaepKiro.engineSha256 can pin only an explicitly configured external engine executable. Clear it to use the package-local digest-bound engine.",
      )
    }
    const packagedEnginePath = join(this.extensionPath, "dist", "gaep-engine.mjs")
    const signature = executable
      ? JSON.stringify(["external", executable, digest])
      : JSON.stringify(["packaged", process.execPath, packagedEnginePath, __GAEP_PACKAGED_ENGINE_SHA256__])
    const current = this.clients.get(workspacePath)
    if (current?.signature === signature) return current.client
    if (current) await current.client.dispose()
    const client = await GaepEngineClient.create(executable
      ? {
          workspacePath,
          engineExecutable: executable,
          ...(digest ? { expectedEngineSha256: digest } : {}),
        }
      : {
          workspacePath,
          engineExecutable: process.execPath,
          packagedEngine: {
            path: packagedEnginePath,
            expectedSha256: __GAEP_PACKAGED_ENGINE_SHA256__,
          },
        })
    this.clients.set(workspacePath, { signature, client })
    return client
  }

  async clear(): Promise<void> {
    const clients = [...this.clients.values()].map((entry) => entry.client)
    this.clients.clear()
    await Promise.all(clients.map((client) => client.dispose()))
  }

  dispose(): void {
    void this.clear()
  }
}

let studioPanel: vscode.WebviewPanel | undefined
let activePool: EngineClientPool | undefined

export function activate(context: vscode.ExtensionContext): void {
  const pool = new EngineClientPool(context.extensionPath)
  activePool = pool
  context.subscriptions.push(
    pool,
    vscode.window.registerWebviewPanelSerializer(productStudioViewType, {
      async deserializeWebviewPanel(panel): Promise<void> {
        configureProductStudioPanel(panel)
      },
    }),
    vscode.commands.registerCommand(commandIds.open, () => openProductStudio()),
    vscode.commands.registerCommand(commandIds.readiness, () => runUserCommand(() => showAgentReadiness(pool))),
    vscode.commands.registerCommand(commandIds.selectAgent, () => runUserCommand(() => selectAgent(pool))),
    vscode.commands.registerCommand(commandIds.handoffAgent, () => runUserCommand(() => handoffAgent(pool))),
    vscode.commands.registerCommand(commandIds.managedReadOnly, () => runUserCommand(() => runManagedReadOnly(pool))),
    vscode.commands.registerCommand(commandIds.evidence, () => runUserCommand(() => showManagedEvidenceDashboard(pool))),
    vscode.commands.registerCommand(commandIds.stagedReview, () => runUserCommand(() => reviewManagedStagedChanges(pool))),
    vscode.commands.registerCommand(commandIds.dashboard, () => runUserCommand(() => showPhaseDashboard(pool))),
    vscode.commands.registerCommand(commandIds.phase2UxFigma, (input?: unknown) => runUserCommand(() => showPhase2UxFigmaDashboard(pool, input))),
    vscode.commands.registerCommand(commandIds.phase2ChangeImpactAgentModel, (input?: unknown) => runUserCommand(() => showPhase2ChangeImpactAgentModelDashboard(pool, input))),
    vscode.commands.registerCommand(commandIds.phase3a, (input?: unknown) => runUserCommand(() => showPhase3aDashboard(pool, input))),
    vscode.commands.registerCommand(commandIds.phase1Summary, (input?: unknown) => runUserCommand(() => showPhase1Summary(pool, input))),
    vscode.commands.registerCommand(commandIds.phase1ChangeImpact, (input?: unknown) => runUserCommand(() => showPhase1ChangeImpact(pool, input))),
    vscode.commands.registerCommand(commandIds.changeImpact, () => runUserCommand(() => showChangeImpactDashboard(pool))),
    vscode.commands.registerCommand(commandIds.agentModel, () => runUserCommand(() => showAgentModelDashboard(pool))),
    vscode.commands.registerCommand(commandIds.phase1AgentModel, (input?: unknown) => runUserCommand(() => showPhase1AgentModelDashboard(pool, input))),
    vscode.commands.registerCommand(commandIds.accessibleTables, () => runUserCommand(() => showAccessibleDashboardTables(pool))),
    vscode.commands.registerCommand(commandIds.initiativeEntry, (input?: unknown) => runUserCommand(() => showInitiativeEntry(pool, input))),
    vscode.commands.registerCommand(commandIds.classifyInitiative, (input?: unknown) => runUserCommand(() => classifyInitiative(pool, input))),
    vscode.commands.registerCommand(commandIds.resolveApplicability, (input?: unknown) => runUserCommand(() => resolveInitiativeApplicability(pool, input))),
    vscode.commands.registerCommand(commandIds.sourceGovernance, (input?: unknown) => runUserCommand(() => showSourceGovernance(pool, input))),
    vscode.commands.registerCommand(commandIds.businessUnderstanding, (input?: unknown) => runUserCommand(() => showBusinessUnderstanding(pool, input))),
    vscode.commands.registerCommand(commandIds.businessCapabilityMap, (input?: unknown) => runUserCommand(() => showBusinessCapabilityMap(pool, input))),
    vscode.commands.registerCommand(commandIds.valueStreamModel, (input?: unknown) => runUserCommand(() => showValueStreamModel(pool, input))),
    vscode.commands.registerCommand(commandIds.operatingModel, (input?: unknown) => runUserCommand(() => showOperatingModel(pool, input))),
    vscode.commands.registerCommand(commandIds.businessRules, (input?: unknown) => runUserCommand(() => showBusinessRuleCatalog(pool, input))),
    vscode.commands.registerCommand(commandIds.businessArchitectureBaseline, (input?: unknown) => runUserCommand(() => showBusinessArchitectureBaseline(pool, input))),
    vscode.commands.registerCommand(commandIds.systemSolutionArchitecture, (input?: unknown) => runUserCommand(() => showSystemSolutionArchitecture(pool, input))),
    vscode.commands.registerCommand(commandIds.boundedContextModel, (input?: unknown) => runUserCommand(() => showBoundedContextModel(pool, input))),
    vscode.commands.registerCommand(commandIds.securityPrivacyAssessment, (input?: unknown) => runUserCommand(() => showSecurityPrivacyAssessment(pool, input))),
    vscode.commands.registerCommand(commandIds.processModel, (input?: unknown) => runUserCommand(() => showProcessModel(pool, input))),
    vscode.commands.registerCommand(commandIds.dataModel, (input?: unknown) => runUserCommand(() => showDataModel(pool, input))),
    vscode.commands.registerCommand(commandIds.authorizationModel, (input?: unknown) => runUserCommand(() => showAuthorizationModel(pool, input))),
    vscode.commands.registerCommand(commandIds.eventIntegrationModel, (input?: unknown) => runUserCommand(() => showEventIntegrationModel(pool, input))),
    vscode.commands.registerCommand(commandIds.failureRecoveryModel, (input?: unknown) => runUserCommand(() => showFailureRecoveryModel(pool, input))),
    vscode.commands.registerCommand(commandIds.architectureChallengeModel, (input?: unknown) => runUserCommand(() => showArchitectureChallengeModel(pool, input))),
    vscode.commands.registerCommand(commandIds.decisionRegister, (input?: unknown) => runUserCommand(() => showDecisionRegister(pool, input))),
    vscode.commands.registerCommand(commandIds.riskRegister, (input?: unknown) => runUserCommand(() => showRiskRegister(pool, input))),
    vscode.commands.registerCommand(commandIds.evidenceRegistry, (input?: unknown) => runUserCommand(() => showEvidenceRegistry(pool, input))),
    vscode.commands.registerCommand(commandIds.endToEndTraceability, (input?: unknown) => runUserCommand(() => showEndToEndTraceability(pool, input))),
    vscode.commands.registerCommand(commandIds.p0P4ReadinessGate, (input?: unknown) => runUserCommand(() => showP0P4ReadinessGate(pool, input))),
    vscode.commands.registerCommand(commandIds.p5HandoffPackage, (input?: unknown) => runUserCommand(() => showP5HandoffPackage(pool, input))),
    vscode.commands.registerCommand(commandIds.designApplicability, (input?: unknown) => runUserCommand(() => showDesignApplicability(pool, input))),
    vscode.commands.registerCommand(commandIds.designPersonaRole, (input?: unknown) => runUserCommand(() => showDesignPersonaRoleModel(pool, input))),
    vscode.commands.registerCommand(commandIds.userJourney, (input?: unknown) => runUserCommand(() => showUserJourneyModel(pool, input))),
    vscode.commands.registerCommand(commandIds.informationArchitecture, (input?: unknown) => runUserCommand(() => showInformationArchitectureModel(pool, input))),
    vscode.commands.registerCommand(commandIds.screenStateInventory, (input?: unknown) => runUserCommand(() => showScreenStateInventory(pool, input))),
    vscode.commands.registerCommand(commandIds.designRequirements, (input?: unknown) => runUserCommand(() => showDesignRequirements(pool, input))),
    vscode.commands.registerCommand(commandIds.backlogHierarchy, (input?: unknown) => runUserCommand(() => showBacklogHierarchy(pool, input))),
    vscode.commands.registerCommand(commandIds.mvpSliceDefinition, (input?: unknown) => runUserCommand(() => showMvpSliceDefinition(pool, input))),
    vscode.commands.registerCommand(commandIds.prioritizationModel, (input?: unknown) => runUserCommand(() => showPrioritizationModel(pool, input))),
    vscode.commands.registerCommand(commandIds.acceptanceCriteria, (input?: unknown) => runUserCommand(() => showAcceptanceCriteria(pool, input))),
    vscode.commands.registerCommand(commandIds.definitionOfReady, (input?: unknown) => runUserCommand(() => showDefinitionOfReady(pool, input))),
    vscode.commands.registerCommand(commandIds.definitionOfDone, (input?: unknown) => runUserCommand(() => showDefinitionOfDone(pool, input))),
    vscode.commands.registerCommand(commandIds.implementationUnitModel, (input?: unknown) => runUserCommand(() => showImplementationUnitModel(pool, input))),
    vscode.commands.registerCommand(commandIds.dependencyMapping, (input?: unknown) => runUserCommand(() => showDependencyMapping(pool, input))),
    vscode.commands.registerCommand(commandIds.technologyProfile, (input?: unknown) => runUserCommand(() => showTechnologyProfile(pool, input))),
    vscode.commands.registerCommand(commandIds.boilerplateRegistry, (input?: unknown) => runUserCommand(() => showBoilerplateRegistry(pool, input))),
    vscode.commands.registerCommand(commandIds.boilerplateSelectionBinding, (input?: unknown) => runUserCommand(() => showBoilerplateSelectionBinding(pool, input))),
    vscode.commands.registerCommand(commandIds.boilerplateCompatibilityValidation, (input?: unknown) => runUserCommand(() => showBoilerplateCompatibilityValidation(pool, input))),
    vscode.commands.registerCommand(commandIds.figmaToBoilerplateMapping, (input?: unknown) => runUserCommand(() => showFigmaToBoilerplateMapping(pool, input))),
    vscode.commands.registerCommand(commandIds.designToCodeBindingRegistry, (input?: unknown) => runUserCommand(() => showDesignToCodeBindingRegistry(pool, input))),
    vscode.commands.registerCommand(commandIds.routeScreenComponentMapping, (input?: unknown) => runUserCommand(() => showRouteScreenComponentMapping(pool, input))),
    vscode.commands.registerCommand(commandIds.testMethodology, (input?: unknown) => runUserCommand(() => showTestMethodology(pool, input))),
    vscode.commands.registerCommand(commandIds.testInventory, (input?: unknown) => runUserCommand(() => showTestInventory(pool, input))),
    vscode.commands.registerCommand(commandIds.highLevelDesign, (input?: unknown) => runUserCommand(() => showHighLevelDesign(pool, input))),
    vscode.commands.registerCommand(commandIds.lowLevelDesign, (input?: unknown) => runUserCommand(() => showLowLevelDesign(pool, input))),
    vscode.commands.registerCommand(commandIds.implementationReadinessGate, (input?: unknown) => runUserCommand(() => showImplementationReadinessGate(pool, input))),
    vscode.commands.registerCommand(commandIds.changedUnitInventory, (input?: unknown) => runUserCommand(() => showChangedUnitInventory(pool, input))),
    vscode.commands.registerCommand(commandIds.proposedChangePreview, (input?: unknown) => runUserCommand(() => showProposedChangePreview(pool, input))),
    vscode.commands.registerCommand(commandIds.stagingWorkspace, (input?: unknown) => runUserCommand(() => showStagingWorkspace(pool, input))),
    vscode.commands.registerCommand(commandIds.designSystemTokenContract, (input?: unknown) => runUserCommand(() => showDesignSystemTokenContract(pool, input))),
    vscode.commands.registerCommand(commandIds.accessibilityDesignRules, (input?: unknown) => runUserCommand(() => showAccessibilityDesignRules(pool, input))),
    vscode.commands.registerCommand(commandIds.responsiveMultiPlatformTargets, (input?: unknown) => runUserCommand(() => showResponsiveMultiPlatformTargets(pool, input))),
    vscode.commands.registerCommand(commandIds.manualFigmaExecutionPath, (input?: unknown) => runUserCommand(() => showManualFigmaExecutionPath(pool, input))),
    vscode.commands.registerCommand(commandIds.figmaMcpCapabilityDiscovery, (input?: unknown) => runUserCommand(() => showFigmaMcpCapabilityDiscovery(pool, input))),
    vscode.commands.registerCommand(commandIds.figmaReadSnapshot, (input?: unknown) => runUserCommand(() => showFigmaReadSnapshot(pool, input))),
    vscode.commands.registerCommand(commandIds.figmaContextImport, (input?: unknown) => runUserCommand(() => showFigmaContextImport(pool, input))),
    vscode.commands.registerCommand(commandIds.outboundDesignBriefPackage, (input?: unknown) => runUserCommand(() => showOutboundDesignBriefPackage(pool, input))),
    vscode.commands.registerCommand(commandIds.governedFigmaWrite, (input?: unknown) => runUserCommand(() => showGovernedFigmaWrite(pool, input))),
    vscode.commands.registerCommand(commandIds.finalizedFigmaSnapshotImport, (input?: unknown) => runUserCommand(() => showFinalizedFigmaSnapshotImport(pool, input))),
    vscode.commands.registerCommand(commandIds.designToRequirementBinding, (input?: unknown) => runUserCommand(() => showDesignToRequirementBinding(pool, input))),
    vscode.commands.registerCommand(commandIds.designerReadyGate, (input?: unknown) => runUserCommand(() => showDesignerReadyGate(pool, input))),
    vscode.commands.registerCommand(commandIds.designDelta, (input?: unknown) => runUserCommand(() => showDesignDelta(pool, input))),
    vscode.commands.registerCommand(commandIds.designConflictResolution, (input?: unknown) => runUserCommand(() => showDesignConflictResolution(pool, input))),
    vscode.commands.registerCommand(commandIds.humanDesignApproval, (input?: unknown) => runUserCommand(() => showHumanDesignApproval(pool, input))),
    vscode.commands.registerCommand(commandIds.designBaseline, (input?: unknown) => runUserCommand(() => showDesignBaseline(pool, input))),
    vscode.commands.registerCommand(commandIds.designDriftDetection, (input?: unknown) => runUserCommand(() => showDesignDriftDetection(pool, input))),
    vscode.commands.registerCommand(commandIds.import, () => runUserCommand(() => importPortableDesign(pool))),
    vscode.commands.registerCommand(commandIds.list, (input?: unknown) => runUserCommand(() => listPortableDesign(pool, input))),
    vscode.commands.registerCommand(commandIds.read, (input?: unknown) => runUserCommand(() => readPortableDesign(pool, input))),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("gaepKiro")) void pool.clear()
    }),
  )
}

export async function deactivate(): Promise<void> {
  const pool = activePool
  activePool = undefined
  studioPanel?.dispose()
  studioPanel = undefined
  await pool?.clear()
}

function openProductStudio(): void {
  if (studioPanel) {
    studioPanel.reveal(vscode.ViewColumn.Active)
    studioPanel.webview.html = productStudioHtml()
    return
  }
  const panel = vscode.window.createWebviewPanel(
    productStudioViewType,
    "GAEP for Kiro Product Studio",
    vscode.ViewColumn.Active,
    { enableScripts: false, retainContextWhenHidden: false },
  )
  configureProductStudioPanel(panel)
}

function configureProductStudioPanel(panel: vscode.WebviewPanel): void {
  studioPanel = panel
  panel.webview.options = { enableScripts: false, localResourceRoots: [] }
  panel.webview.html = productStudioHtml()
  panel.onDidDispose(() => {
    if (studioPanel === panel) studioPanel = undefined
  })
}

function productStudioHtml(): string {
  const styleNonce = randomBytes(18).toString("base64")
  const trustState = vscode.workspace.isTrusted
    ? "Trusted. Portable-design commands may start only the configured local GAEP engine."
    : "Untrusted stop line. No Product state is inspected and no process is started."
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${styleNonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GAEP for Kiro Product Studio</title>
  <style nonce="${styleNonce}">
    body { color: var(--vscode-foreground); background: var(--vscode-editor-background); font: var(--vscode-font-size)/1.55 var(--vscode-font-family); margin: 0 auto; max-width: 760px; padding: 32px; }
    h1, h2 { line-height: 1.2; } section { border: 1px solid var(--vscode-panel-border); border-radius: 6px; margin: 18px 0; padding: 16px; }
    code { color: var(--vscode-textPreformat-foreground); } .stop { color: var(--vscode-errorForeground); }
  </style>
</head>
<body>
  <h1>GAEP for Kiro Product Studio</h1>
  <p class="${vscode.workspace.isTrusted ? "" : "stop"}">${escapeHtml(trustState)}</p>
  <section>
    <h2>Initiative entry</h2>
    <p>Use the Kiro Command Palette to inspect one exact Initiative entry assessment by UUID, record a multi-dimensional human classification, or resolve an explicit applicability matrix.</p>
    <p>Every write rechecks the exact Initiative and current Product binding, is cancel-default, rejects secret-shaped input, and records no implicit not-applicable, approval, readiness, or action authority.</p>
  </section>
  <section>
    <h2>Portable design</h2>
    <p>Use the Kiro Command Palette to import one local bundle folder, list metadata pages, or read one exact snapshot by UUID.</p>
    <p>Files, archives, <code>.fig</code> ingestion, OAuth, network fetches, and live design-tool accounts are not supported.</p>
  </section>
  <section>
    <h2>Codex and Claude</h2>
    <p>Use the Kiro Command Palette to observe verified local readiness, record one guarded portable Agent Selection, or create a versioned switch handoff from the latest terminal Run.</p>
    <p>Selection and handoff records are configuration and history only. The separate managed read-only command can run one exact, already-confirmed Charter and Workflow Plan after a digest-bound human attestation. It denies every Tool, write, and non-observation effect, uses a bounded timeout, and withholds success if staged changes appear.</p>
    <p>The Managed Run evidence command shows an audit-gated, snapshot-bound page of at most 100 runs and one exact verified detail. It displays portable states, counts, digests and timestamps only; it cannot apply, discard, resume, approve, or infer success.</p>
    <p>The phase-dashboard command shows the exact Phase 0/1A slice plus required Change/Impact and Agent/Model views. The Change/Impact command separately selects one exact current Change from an audit-gated metadata-only catalog and shows bounded Work Items, portable changed/effect targets, trace assessments, Decisions, Risks, freshness and omissions. The Agent/Model command shows exact current capability, portable selection, Run, Managed evidence, handoff, freshness and unavailable usage/cost metadata. The accessible-tables command uses native keyboard and screen-reader controls to select one of those verified tables, apply deterministic sorting and a bounded visible-metadata filter, open a textual alternative, and optionally copy only the visible columns and rows as formula-neutralized CSV. Phase applicability remains attention-required until a governed decision exists; these projections cannot select or switch an agent, launch a Run, authorize effects, approve a Change, or complete a phase.</p>
    <p>The separate staged-review command can inspect one exact pending Codex inventory of at most 512 workspace-relative changed paths and then, only after a cancel-default digest-bound human decision, ask the engine to apply that inventory or persist discard. It receives no source bytes or general filesystem-write authority. Post-apply Workflow gates are recorded not assessed, so this surface cannot claim governed outcome satisfaction.</p>
  </section>
  <section>
    <h2>Governance boundary</h2>
    <p>Every result remains <code>pending-human-review</code>. An upstream <code>approved</code> value is not GAEP approval, a Design Baseline, implementation readiness, or release readiness.</p>
    <p>Only validated metadata and digests are shown. Local paths, source bytes, token values, credentials, and external-account state are withheld.</p>
  </section>
</body>
</html>`
}

function initiativeEntryUi(): InitiativeEntryWorkflowUi {
  return {
    pick: async <T extends string>(title: string, options: readonly T[]): Promise<T | undefined> => {
      const selected = await vscode.window.showQuickPick(
        options.map((value) => ({ label: value, value })),
        { title, ignoreFocusOut: true },
      )
      return selected?.value
    },
    pickMany: async <T extends string>(title: string, options: readonly T[], minimum = 0): Promise<T[] | undefined> => {
      const selected = await vscode.window.showQuickPick(
        options.map((value) => ({ label: value, value })),
        { title, ignoreFocusOut: true, canPickMany: true, placeHolder: minimum > 0 ? `Select at least ${minimum}` : "Optional" },
      )
      if (!selected) return undefined
      if (selected.length < minimum) throw new TypeError(`${title} requires at least ${minimum} selection${minimum === 1 ? "" : "s"}`)
      return selected.map((entry) => entry.value)
    },
    input: async (prompt, options = {}) => vscode.window.showInputBox({
      prompt,
      ignoreFocusOut: true,
      ...(options.value !== undefined ? { value: options.value } : {}),
      ...(options.secret !== undefined ? { password: options.secret } : {}),
      validateInput: (value) => validatePortableInput(value.trim(), options.required !== false, prompt),
    }),
    confirm: async (message, acceptLabel) => (await vscode.window.showWarningMessage(
      message,
      { modal: true },
      acceptLabel,
    )) === acceptLabel,
  }
}

function initiativeInput(input: unknown): { initiativeId?: string; expectedRevision?: number } {
  if (input === undefined) return {}
  if (typeof input === "string") return { initiativeId: normalizeUuid(input, "Initiative ID") }
  if (!isRecord(input) || Object.keys(input).some((key) => key !== "initiativeId" && key !== "expectedRevision")) {
    throw new TypeError("Initiative entry input accepts only initiativeId and expectedRevision")
  }
  const initiativeId = typeof input.initiativeId === "string"
    ? normalizeUuid(input.initiativeId, "Initiative ID")
    : undefined
  const expectedRevision = input.expectedRevision === undefined
    ? undefined
    : validatePageRevision(input.expectedRevision, "Expected Initiative revision")
  return { ...(initiativeId ? { initiativeId } : {}), ...(expectedRevision ? { expectedRevision } : {}) }
}

function validatePageRevision(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new TypeError(`${label} must be a positive integer`)
  return value as number
}

async function readInitiativeEntryContext(
  pool: EngineClientPool,
  input: unknown,
): Promise<{
  folder: vscode.WorkspaceFolder
  client: GaepEngineClient
  initiative: Initiative
  assessment: InitiativeEntryAssessment
}> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  let initiativeId = normalized.initiativeId
  if (!initiativeId) {
    const value = await vscode.window.showInputBox({
      title: "Inspect one exact Initiative entry",
      prompt: "Initiative UUID",
      ignoreFocusOut: true,
      validateInput: (candidate) => {
        try { normalizeUuid(candidate, "Initiative ID"); return undefined } catch { return "Enter an exact Initiative UUID" }
      },
    })
    if (value === undefined) throw new WorkflowCancelled()
    initiativeId = normalizeUuid(value, "Initiative ID")
  }
  const [initiative, assessment] = await Promise.all([
    client.readInitiative(initiativeId),
    client.assessInitiativeEntry(initiativeId),
  ])
  if (assessment.initiativeRevision !== (initiative.revision ?? 1)) {
    throw new ConfigurationBoundaryError("The Initiative changed while its entry assessment was read. Refresh the exact record.")
  }
  if (normalized.expectedRevision !== undefined && normalized.expectedRevision !== (initiative.revision ?? 1)) {
    throw new ConfigurationBoundaryError("The Initiative changed since this entry action was offered. Refresh the exact revision.")
  }
  return { folder, client, initiative, assessment }
}

async function showInitiativeEntry(pool: EngineClientPool, input: unknown): Promise<InitiativeEntryAssessment> {
  const context = await readInitiativeEntryContext(pool, input)
  await showInitiativeEntryDocument(context.initiative, context.assessment)
  return context.assessment
}

async function classifyInitiative(pool: EngineClientPool, input: unknown): Promise<InitiativeEntryAssessment> {
  const context = await readInitiativeEntryContext(pool, input)
  if (["completed", "cancelled"].includes(context.initiative.state)) {
    throw new ConfigurationBoundaryError(`Terminal Initiative ${context.initiative.state} entry records are immutable.`)
  }
  const classification = await collectInitiativeClassification(initiativeEntryUi())
  if (containsSecretShapedValue(classification)) {
    throw new ConfigurationBoundaryError("The Initiative classification contains a secret-shaped value and was not persisted.")
  }
  const actorId = normalizeActorId(machineSetting("actorId", undefined, "gaep.kiro-local-human"))
  const updated = await context.client.classifyInitiative(
    context.initiative.id,
    context.initiative.revision ?? 1,
    classification,
    actorId,
  )
  const assessment = await context.client.assessInitiativeEntry(updated.id)
  if (assessment.initiativeRevision !== updated.revision) throw new ConfigurationBoundaryError("The classified Initiative could not be revalidated.")
  await showInitiativeEntryDocument(updated, assessment)
  return assessment
}

async function resolveInitiativeApplicability(pool: EngineClientPool, input: unknown): Promise<InitiativeEntryAssessment> {
  const context = await readInitiativeEntryContext(pool, input)
  if (["completed", "cancelled"].includes(context.initiative.state)) {
    throw new ConfigurationBoundaryError(`Terminal Initiative ${context.initiative.state} entry records are immutable.`)
  }
  if (context.assessment.classification.status !== "current") {
    throw new ConfigurationBoundaryError("Record a classification bound to the current Product revision before resolving applicability.")
  }
  const actorId = normalizeActorId(machineSetting("actorId", undefined, "gaep.kiro-local-human"))
  const applicability = await collectInitiativeApplicability(initiativeEntryUi(), actorId)
  if (containsSecretShapedValue(applicability)) {
    throw new ConfigurationBoundaryError("The Initiative applicability matrix contains a secret-shaped value and was not persisted.")
  }
  const coverage = context.assessment.applicability.coverage
  if (!coverage?.catalogVersion || !coverage.catalogDigest || coverage.subjectCount < 1) {
    throw new ConfigurationBoundaryError("The canonical applicability subject catalog is unavailable. Refresh the exact entry assessment.")
  }
  const updated = await context.client.resolveInitiativeApplicability(
    context.initiative.id,
    context.initiative.revision ?? 1,
    {
      ...applicability,
      subjectCatalog: {
        catalogVersion: coverage.catalogVersion,
        digest: coverage.catalogDigest,
        subjectCount: coverage.subjectCount,
      },
    },
    actorId,
  )
  const assessment = await context.client.assessInitiativeEntry(updated.id)
  if (assessment.initiativeRevision !== updated.revision) throw new ConfigurationBoundaryError("The resolved Initiative could not be revalidated.")
  await showInitiativeEntryDocument(updated, assessment)
  return assessment
}

async function showInitiativeEntryDocument(
  initiative: Initiative,
  assessment: InitiativeEntryAssessment,
): Promise<void> {
  const lines = [
    "GAEP Initiative entry assessment",
    "",
    `Initiative ID: ${initiative.id}`,
    `Initiative revision: ${initiative.revision ?? 1}`,
    `Lifecycle state: ${initiative.state}`,
    `Classification: ${assessment.classification.status}${initiative.classification ? ` · ${initiative.classification.primaryType} / ${initiative.classification.productProfile}` : ""}`,
    `Classification completeness: ${assessment.classification.completeness?.status ?? "unreported"}`,
    `Completeness policy: ${assessment.classification.completeness?.policyVersion ?? "unreported"}`,
    `Classification unknown dimensions: ${assessment.classification.completeness?.unknownDimensionCount ?? "unreported"}`,
    `Classification unresolved questions: ${assessment.classification.completeness?.unresolvedQuestionCount ?? "unreported"}`,
    `Classification missing conditional dimensions: ${assessment.classification.completeness?.missingConditionalDimensionCount ?? "unreported"}`,
    `Classification confidence sufficient: ${assessment.classification.completeness?.confidenceSufficient ?? "unreported"}`,
    `Applicability: ${assessment.applicability.status} · matrix revision ${assessment.applicability.matrixRevision ?? "not recorded"}`,
    `Applicability coverage: ${assessment.applicability.coverage?.status ?? "unreported"}`,
    `Canonical subject coverage: ${assessment.applicability.coverage ? `${assessment.applicability.coverage.coveredSubjectCount}/${assessment.applicability.coverage.subjectCount}` : "unreported"}`,
    `Coverage gaps: ${assessment.applicability.coverage ? `${assessment.applicability.coverage.missingSubjectCount} missing · ${assessment.applicability.coverage.unexpectedSubjectCount} unexpected · ${assessment.applicability.coverage.mismatchedSubjectCount} mismatched` : "unreported"}`,
    `Decisions: ${assessment.applicability.decisionCount}`,
    `Unresolved subjects: ${assessment.applicability.unresolvedSubjectCount}`,
    `Awaiting human decisions: ${assessment.applicability.pendingHumanDecisionCount}`,
    `Blocked decisions: ${assessment.applicability.blockedDecisionCount}`,
    `Pending approvals: ${assessment.applicability.pendingApprovalCount}`,
    `Rejected approvals: ${assessment.applicability.rejectedApprovalCount}`,
    `Assessment: ${assessment.state}`,
    ...assessment.reasons.map((reason) => `  - ${reason}`),
    "",
    "Boundary: entry assessment is read-only and grants no approval, readiness, not-applicable inference, or action authority.",
    "Product and Initiative narrative, evidence content, owners, local paths, credentials, and raw engine output are withheld from this compact view.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
}

async function showSourceGovernance(
  pool: EngineClientPool,
  input: unknown,
): Promise<SourceGovernanceProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Source governance", "Initiative ID")
  const projection = await client.readSourceGovernance(initiativeId)
  const renderLimit = 50
  const lines = [
    "GAEP Source governance",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${projection.assessment.state}`,
    `Sources: ${projection.assessment.sourceCount}`,
    `Candidate Baselines: ${projection.assessment.baselineCount}`,
    `Provenance records: ${projection.assessment.provenanceCount}`,
    `Current candidate Baseline: ${projection.assessment.currentBaseline
      ? `${projection.assessment.currentBaseline.id}@${projection.assessment.currentBaseline.revision} · ${projection.assessment.currentBaseline.status}`
      : "not recorded"}`,
    `Source gaps: ${projection.assessment.staleSourceCount} stale · ${projection.assessment.unknownAuthorityCount} unknown authority · ${projection.assessment.unbaselinedSourceCount} unbaselined · ${projection.assessment.unprovenancedSourceCount} unprovenanced`,
    ...projection.assessment.reasons.map((reason) => `  - ${reason}`),
    "",
    `Source records (showing ${Math.min(projection.sources.length, renderLimit)} of ${projection.limits.sources.total})`,
    ...projection.sources.slice(0, renderLimit).map((source) =>
      `  - ${source.title} · ${source.id}@${source.revision} · owner ${source.owner.kind}:${source.owner.id ?? "unassigned"} · authority ${source.semanticAuthority.standing} · ${source.knowledgeDisposition} · ${source.freshness}/${source.availability}`),
    "",
    `Candidate Baselines (showing ${Math.min(projection.baselines.length, renderLimit)} of ${projection.limits.baselines.total})`,
    ...projection.baselines.slice(0, renderLimit).map((baseline) =>
      `  - ${baseline.title} · ${baseline.id}@${baseline.revision} · ${baseline.memberCount} member(s) · ${baseline.assessmentStatus}`),
    "",
    `Provenance (showing ${Math.min(projection.provenance.length, renderLimit)} of ${projection.limits.provenance.total})`,
    ...projection.provenance.slice(0, renderLimit).map((record) =>
      `  - ${record.id} · ${record.targetKind} · ${record.disposition} · ${record.sourceCount} source(s) · ${record.transformationCount} transformation(s)`),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showBusinessUnderstanding(
  pool: EngineClientPool,
  input: unknown,
): Promise<BusinessUnderstandingProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Business Understanding", "Initiative ID")
  const projection = await client.readBusinessUnderstanding(initiativeId)
  const business = projection.businessUnderstanding
  const stakeholders = projection.stakeholderModel
  const outcomes = projection.outcomeModel
  const lines = [
    "GAEP governed Business Understanding",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${projection.assessment.state}`,
    `Assessment counts: ${projection.assessment.unresolvedQuestionCount} unresolved questions · ${projection.assessment.blockingQuestionCount} blocking questions · ${projection.assessment.staleBindingCount} stale bindings · ${projection.assessment.staleSourceReferenceCount} stale Source references`,
    ...projection.assessment.reasons.map((reason) => `  - ${reason}`),
    "",
    `Business Understanding: ${business
      ? `${business.id}@${business.revision} · ${business.state} · ${business.digest}`
      : "not recorded"}`,
    ...(business ? [
      `Business counts: ${business.objectiveCount} objectives · ${business.constraintCount} constraints · ${business.assumptionCount} assumptions · ${business.unresolvedQuestionCount} unresolved questions · ${business.glossaryTermCount} glossary terms`,
    ] : []),
    "",
    `Stakeholder Model: ${stakeholders
      ? `${stakeholders.id}@${stakeholders.revision} · ${stakeholders.state} · ${stakeholders.digest}`
      : "not recorded"}`,
    ...(stakeholders ? [
      `Stakeholder counts: ${stakeholders.stakeholderCount} stakeholders · ${stakeholders.representedCategoryCount} represented categories · ${stakeholders.unresolvedCategoryCount} unresolved categories · ${stakeholders.verifiedAuthorityCount} verified authority claims`,
    ] : []),
    "",
    `Outcome Model: ${outcomes
      ? `${outcomes.id}@${outcomes.revision} · ${outcomes.state} · ${outcomes.digest}`
      : "not recorded"}`,
    ...(outcomes ? [
      `Outcome counts: ${outcomes.outcomeCount} outcomes · ${outcomes.measureCount} measures · ${outcomes.countermetricCount} countermetrics · ${outcomes.burdenMeasureCount} burden measures · ${outcomes.observedBaselineCount} observed baselines`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showBusinessCapabilityMap(
  pool: EngineClientPool,
  input: unknown,
): Promise<BusinessCapabilityMapProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Business Capability Map", "Initiative ID")
  const projection = await client.readBusinessCapabilityMap(initiativeId)
  const map = projection.capabilityMap
  const lines = [
    "GAEP governed Business Capability Map",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${projection.assessment.state}`,
    `Assessment counts: ${projection.assessment.capabilityCount} capabilities · ${projection.assessment.ownedCapabilityCount} owned · ${projection.assessment.unownedCapabilityCount} unowned · ${projection.assessment.objectiveCoverageCount} objectives covered · ${projection.assessment.outcomeCoverageCount} outcomes covered`,
    `Gaps and uncertainty: ${projection.assessment.openGapCount} open gaps · ${projection.assessment.criticalGapCount} critical gaps · ${projection.assessment.unknownCurrentMaturityCount} unknown current maturity · ${projection.assessment.unassessedPriorityCount} unassessed priority · ${projection.assessment.staleBindingCount} stale bindings · ${projection.assessment.staleSourceReferenceCount} stale Source references`,
    ...projection.assessment.reasons.map((reason) => `  - ${reason}`),
    "",
    `Business Capability Map: ${map
      ? `${map.id}@${map.revision} · ${map.state} · ${map.digest}`
      : "not recorded"}`,
    ...(map ? [
      `Map counts: ${map.capabilityCount} capabilities · ${map.ownedCapabilityCount} owned · ${map.openGapCount} open gaps · ${map.criticalGapCount} critical gaps · ${map.candidatePriorityCount} candidate priorities`,
      `Updated: ${map.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showValueStreamModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<ValueStreamModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Value Stream Model", "Initiative ID")
  const projection = await client.readValueStreamModel(initiativeId)
  const model = projection.valueStreamModel
  const lines = [
    "GAEP governed Value Stream Model",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${projection.assessment.state}`,
    `Assessment counts: ${projection.assessment.valueStreamCount} value streams · ${projection.assessment.ownedValueStreamCount} owned · ${projection.assessment.unownedValueStreamCount} unowned · ${projection.assessment.stageCount} stages · ${projection.assessment.dependencyCount} dependencies · ${projection.assessment.capabilityCoverageCount} capabilities covered · ${projection.assessment.outcomeCoverageCount} outcomes covered`,
    `Flow gaps: ${projection.assessment.absentFlowEvidenceCount} stages without evidence · ${projection.assessment.openBottleneckCount} open bottlenecks · ${projection.assessment.criticalBottleneckCount} critical bottlenecks · ${projection.assessment.staleBindingCount} stale bindings · ${projection.assessment.staleSourceReferenceCount} stale Source references`,
    ...projection.assessment.reasons.map((reason) => `  - ${reason}`),
    "",
    `Value Stream Model: ${model
      ? `${model.id}@${model.revision} · ${model.state} · ${model.digest}`
      : "not recorded"}`,
    ...(model ? [
      `Model counts: ${model.valueStreamCount} value streams · ${model.ownedValueStreamCount} owned · ${model.stageCount} stages · ${model.dependencyCount} dependencies · ${model.openBottleneckCount} open bottlenecks · ${model.criticalBottleneckCount} critical bottlenecks`,
      `Updated: ${model.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showOperatingModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<OperatingModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Operating Model", "Initiative ID")
  const projection = await client.readOperatingModel(initiativeId)
  const model = projection.operatingModel
  const lines = [
    "GAEP governed Operating Model",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${projection.assessment.state}`,
    `Structural counts: ${projection.assessment.roleCount} roles · ${projection.assessment.governanceSystemCount} governance systems · ${projection.assessment.decisionRightCount} decision rights · ${projection.assessment.forumCount} forums · ${projection.assessment.cycleCount} cycles`,
    `Candidate gaps: ${projection.assessment.unassignedAppointingAuthorityCount} appointing authorities · ${projection.assessment.insufficientCapacityCount} capacity · ${projection.assessment.unfundedCapacityCount} funding · ${projection.assessment.unassignedDecisionAuthorityCount} decision authorities · ${projection.assessment.supportCapacityGapCount} support capacity · ${projection.assessment.emergencyAuthorityGapCount} emergency authority · ${projection.assessment.staleBindingCount} stale bindings · ${projection.assessment.staleSourceReferenceCount} stale Source references`,
    ...projection.assessment.reasons.map((reason) => `  - ${reason}`),
    "",
    `Operating Model: ${model ? `${model.id}@${model.revision} · ${model.state} · ${model.digest}` : "not recorded"}`,
    ...(model ? [
      `Model counts: ${model.roleCount} roles · ${model.decisionRightCount} decision rights · ${model.forumCount} forums · ${model.cycleCount} cycles`,
      `Updated: ${model.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showBusinessRuleCatalog(
  pool: EngineClientPool,
  input: unknown,
): Promise<BusinessRuleCatalogProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Business Rule Catalog", "Initiative ID")
  const projection = await client.readBusinessRuleCatalog(initiativeId)
  const catalog = projection.businessRuleCatalog
  const lines = [
    "GAEP governed Business Rule Catalog",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${projection.assessment.state}`,
    `Rule counts: ${projection.assessment.ruleCount} rules · ${projection.assessment.sourceBackedRuleCount} source-backed · ${projection.assessment.nonExceptionableRuleCount} non-exceptionable · ${projection.assessment.enforcementTargetCount} enforcement targets · ${projection.assessment.exceptionCount} exceptions`,
    `Candidate gaps: ${projection.assessment.unassignedEnforcementTargetCount} unassigned targets · ${projection.assessment.unverifiedEnforcementTargetCount} unverified targets · ${projection.assessment.unassignedExceptionAuthorityCount} unassigned exception authorities · ${projection.assessment.staleBindingCount} stale bindings · ${projection.assessment.staleSourceReferenceCount} stale Source references`,
    ...projection.assessment.reasons.map((reason) => `  - ${reason}`),
    "",
    `Business Rule Catalog: ${catalog ? `${catalog.id}@${catalog.revision} · ${catalog.state} · ${catalog.digest}` : "not recorded"}`,
    ...(catalog ? [
      `Catalog counts: ${catalog.ruleCount} rules · ${catalog.enforcementTargetCount} enforcement targets · ${catalog.exceptionCount} exceptions · ${catalog.nonExceptionableRuleCount} non-exceptionable`,
      `Updated: ${catalog.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showBusinessArchitectureBaseline(
  pool: EngineClientPool,
  input: unknown,
): Promise<BusinessArchitectureBaselineProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Business Architecture Baseline candidate", "Initiative ID")
  const projection = await client.readBusinessArchitectureBaseline(initiativeId)
  const baseline = projection.baseline
  const lines = [
    "GAEP governed Business Architecture Baseline candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${projection.assessment.state}`,
    `Coverage counts: ${projection.assessment.coveredElementCount} covered · ${projection.assessment.includedElementCount} included · ${projection.assessment.excludedElementCount} excluded · ${projection.assessment.unresolvedElementCount} unresolved`,
    `Coherence: ${projection.assessment.integrationClaimCount} integration claims · ${projection.assessment.consistencyCheckCount} consistency checks · ${projection.assessment.consistencyGapCount} gaps · ${projection.assessment.staleBindingCount} stale bindings · ${projection.assessment.staleSourceReferenceCount} stale Source references`,
    ...projection.assessment.reasons.map((reason) => `  - ${reason}`),
    "",
    `Baseline candidate: ${baseline ? `${baseline.id}@${baseline.revision} · ${baseline.state} · ${baseline.digest}` : "not recorded"}`,
    ...(baseline ? [
      `Membership digest: ${baseline.membershipDigest}`,
      `Candidate counts: ${baseline.coveredElementCount} elements · ${baseline.integrationClaimCount} integration claims · ${baseline.consistencyGapCount} consistency gaps`,
      `Updated: ${baseline.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showSystemSolutionArchitecture(
  pool: EngineClientPool,
  input: unknown,
): Promise<SystemSolutionArchitectureProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the System/Solution Architecture candidate", "Initiative ID")
  const projection = await client.readSystemSolutionArchitecture(initiativeId)
  const architecture = projection.architecture
  const lines = [
    "GAEP governed System/Solution Architecture candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${projection.assessment.state}`,
    `Coverage: ${projection.assessment.concernCount} concerns · ${projection.assessment.viewCount} views · ${projection.assessment.elementCount} elements · ${projection.assessment.relationCount} relations · ${projection.assessment.qualityAttributeCount} quality scenarios · ${projection.assessment.decisionCount} decisions · ${projection.assessment.conformanceCriterionCount} conformance criteria`,
    `Candidate gaps: ${projection.assessment.unresolvedQualityAttributeCount} quality scenarios · ${projection.assessment.unresolvedDecisionCount} decisions · ${projection.assessment.unresolvedConformanceCriterionCount} conformance criteria · ${projection.assessment.lifecycleGapCount} lifecycle consequences · ${projection.assessment.inconsistencyCount} inconsistencies · ${projection.assessment.unresolvedQuestionCount} questions · ${projection.assessment.staleBindingCount} stale bindings · ${projection.assessment.staleSourceReferenceCount} stale Source references`,
    ...projection.assessment.reasons.map((reason) => `  - ${reason}`),
    "",
    `Architecture candidate: ${architecture ? `${architecture.id}@${architecture.revision} · ${architecture.state} · ${architecture.digest}` : "not recorded"}`,
    ...(architecture ? [
      `Membership digest: ${architecture.membershipDigest}`,
      `Candidate counts: ${architecture.concernCount} concerns · ${architecture.viewCount} views · ${architecture.elementCount} elements · ${architecture.qualityAttributeCount} quality scenarios · ${architecture.decisionCount} decisions`,
      `Updated: ${architecture.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showBoundedContextModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<BoundedContextModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Bounded Context and Ownership candidate", "Initiative ID")
  const projection = await client.readBoundedContextModel(initiativeId)
  const model = projection.model
  const lines = [
    "GAEP governed Bounded Context and Ownership candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${projection.assessment.state}`,
    `Coverage: ${projection.assessment.boundedContextCount} contexts · ${projection.assessment.coreContextCount} core contexts · ${projection.assessment.languageTermCount} language terms · ${projection.assessment.contractCount} contracts · ${projection.assessment.relationshipCount} relationships`,
    `Candidate gaps: ${projection.assessment.unresolvedContractCount} contracts · ${projection.assessment.unresolvedRelationshipCount} relationships · ${projection.assessment.unassignedArchitectureElementCount} unassigned elements · ${projection.assessment.unownedDataAssetCount} unowned data assets · ${projection.assessment.unmappedCrossContextRelationCount} unmapped relations · ${projection.assessment.inconsistencyCount} inconsistencies · ${projection.assessment.unresolvedQuestionCount} questions · ${projection.assessment.staleBindingCount} stale bindings · ${projection.assessment.staleSourceReferenceCount} stale Source references`,
    ...projection.assessment.reasons.map((reason) => `  - ${reason}`),
    "",
    `Boundary candidate: ${model ? `${model.id}@${model.revision} · ${model.state} · ${model.digest}` : "not recorded"}`,
    ...(model ? [
      `Membership digest: ${model.membershipDigest}`,
      `Candidate counts: ${model.boundedContextCount} contexts · ${model.contractCount} contracts · ${model.relationshipCount} relationships`,
      `Updated: ${model.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showSecurityPrivacyAssessment(
  pool: EngineClientPool,
  input: unknown,
): Promise<SecurityPrivacyAssessmentProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Security, Privacy, and Threat Assessment candidate", "Initiative ID")
  const projection = await client.readSecurityPrivacyAssessment(initiativeId)
  const assessment = projection.status
  const record = projection.assessment
  const lines = [
    "GAEP governed Security, Privacy, and Threat Assessment candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${assessment.state}`,
    `Coverage: ${assessment.assetCount} assets · ${assessment.actorCount} actors · ${assessment.trustBoundaryCount} trust boundaries · ${assessment.dataClassCount} data classes · ${assessment.dataFlowCount} data flows · ${assessment.controlCount} controls · ${assessment.threatCount} threats`,
    `Candidate gaps: ${assessment.unresolvedThreatCount} threats · ${assessment.unverifiedControlCount} controls · ${assessment.unresolvedProcessingAuthorityCount} processing authorities · ${assessment.uncoveredArchitectureElementCount} architecture elements · ${assessment.unmappedArchitectureRelationCount} architecture relations · ${assessment.unresolvedRequirementCount} profile requirements · ${assessment.inconsistencyCount} inconsistencies · ${assessment.unresolvedQuestionCount} questions · ${assessment.staleBindingCount} stale bindings · ${assessment.staleSourceReferenceCount} stale Source references`,
    ...assessment.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate counts: ${record.assetCount} assets · ${record.trustBoundaryCount} trust boundaries · ${record.dataClassCount} data classes · ${record.controlCount} controls · ${record.threatCount} threats`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showProcessModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<ProcessModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Process Model candidate", "Initiative ID")
  const projection = await client.readProcessModel(initiativeId)
  const status = projection.status
  const record = projection.model
  const lines = [
    "GAEP governed Process Model candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${status.state}`,
    `Coverage: ${status.processCount} processes · ${status.stepCount} steps · ${status.stateDimensionCount} state dimensions · ${status.stateValueCount} state values · ${status.transitionCount} transitions · ${status.eventDefinitionCount} events · ${status.approvalRequirementCount} approval requirements`,
    `Candidate gaps: ${status.uncoveredValueStreamCount} value streams · ${status.uncoveredBoundedContextCount} bounded contexts · ${status.uncoveredBusinessRuleCount} business rules · ${status.unresolvedRequirementCount} requirements · ${status.inconsistencyCount} inconsistencies · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate counts: ${record.processCount} processes · ${record.transitionCount} transitions · ${record.approvalRequirementCount} approval requirements`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showDataModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<DataModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Data Model candidate", "Initiative ID")
  const projection = await client.readDataModel(initiativeId)
  const status = projection.status
  const record = projection.model
  const lines = [
    "GAEP governed Data Model candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${status.state}`,
    `Coverage: ${status.entityCount} entities · ${status.attributeCount} attributes · ${status.relationshipCount} relationships · ${status.lifecycleCount} lifecycles · ${status.transformationCount} transformations`,
    `Candidate gaps: ${status.uncoveredBoundedContextCount} bounded contexts · ${status.uncoveredSecurityDataClassCount} security data classes · ${status.uncoveredProcessCount} processes · ${status.unresolvedSystemOfRecordCount} systems of record · ${status.unresolvedTransformationCount} transformations · ${status.unresolvedRequirementCount} requirements · ${status.inconsistencyCount} inconsistencies · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate counts: ${record.entityCount} entities · ${record.relationshipCount} relationships · ${record.lifecycleCount} lifecycles`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showAuthorizationModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<AuthorizationModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Authorization Model candidate", "Initiative ID")
  const projection = await client.readAuthorizationModel(initiativeId)
  const status = projection.status
  const record = projection.model
  const lines = [
    "GAEP governed Authorization Model candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${status.state}`,
    `Coverage: ${status.principalCount} principals · ${status.roleAssignmentCount} role assignments · ${status.resourceCount} resources · ${status.actionCount} actions · ${status.approvalBindingCount} approval bindings · ${status.ruleCount} rules`,
    `Candidate gaps: ${status.uncoveredOperatingRoleCount} operating roles · ${status.uncoveredProcessCount} processes · ${status.uncoveredDataEntityCount} data entities · ${status.unresolvedIdentityCount} identities · ${status.unresolvedRuleCount} rules · ${status.unresolvedRequirementCount} requirements · ${status.inconsistencyCount} inconsistencies · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate counts: ${record.principalCount} principals · ${record.actionCount} actions · ${record.ruleCount} rules`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showEventIntegrationModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<EventIntegrationModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Event and Integration Model candidate", "Initiative ID")
  const projection = await client.readEventIntegrationModel(initiativeId)
  const status = projection.status
  const record = projection.model
  const lines = [
    "GAEP governed Event and Integration Model candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${status.state}`,
    `Coverage: ${status.eventTypeCount} event types · ${status.commandCount} commands · ${status.adapterCount} adapters · ${status.externalContractCount} external contracts · ${status.mappingCount} mappings · ${status.routeCount} routes`,
    `Candidate gaps: ${status.uncoveredProcessEventCount} process events · ${status.uncoveredProcessCount} processes · ${status.uncoveredBoundedContextCount} bounded contexts · ${status.uncoveredDataEntityCount} data entities · ${status.uncoveredAuthorizationActionCount} authorization actions · ${status.unknownMappingTruthCount} mapping truths · ${status.unresolvedRequirementCount} requirements · ${status.inconsistencyCount} inconsistencies · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate counts: ${record.eventTypeCount} event types · ${record.commandCount} commands · ${record.adapterCount} adapters · ${record.externalContractCount} external contracts · ${record.mappingCount} mappings · ${record.routeCount} routes`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showFailureRecoveryModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<FailureRecoveryModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Failure and Recovery Model candidate", "Initiative ID")
  const projection = await client.readFailureRecoveryModel(initiativeId)
  const status = projection.status
  const record = projection.model
  const lines = [
    "GAEP governed Failure and Recovery Model candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${status.state}`,
    `Coverage: ${status.failureModeCount} failure modes · ${status.retryPolicyCount} retry policies · ${status.compensationPlanCount} compensation plans · ${status.recoveryPlanCount} recovery plans · ${status.recoveryEvidenceDefinitionCount} recovery evidence definitions`,
    `Candidate gaps: ${status.uncoveredProcessCount} processes · ${status.uncoveredCommandCount} commands · ${status.uncoveredRouteCount} routes · ${status.uncoveredAuthorizationActionCount} authorization actions · ${status.unresolvedRecoveryEvidenceCount} recovery evidence definitions · ${status.unresolvedRequirementCount} requirements · ${status.inconsistencyCount} inconsistencies · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate counts: ${record.failureModeCount} failure modes · ${record.retryPolicyCount} retry policies · ${record.compensationPlanCount} compensation plans · ${record.recoveryPlanCount} recovery plans · ${record.recoveryEvidenceDefinitionCount} recovery evidence definitions`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: `${lines.join("\n")}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showArchitectureChallengeModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<ArchitectureChallengeModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Architecture Challenge candidate", "Initiative ID")
  const projection = await client.readArchitectureChallengeModel(initiativeId)
  const status = projection.status
  const record = projection.model
  const lines = [
    "GAEP governed Architecture Challenge candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${status.state}`,
    `Coverage: ${status.challengeSubjectCount} challenge subjects · ${status.assumptionCount} assumptions · ${status.alternativeCount} alternatives · ${status.findingCount} findings · ${status.responseCount} responses`,
    `Candidate gaps: ${status.unrespondedFindingCount} unresponded findings · ${status.unresolvedAssumptionCount} unresolved assumptions · ${status.unresolvedRequirementCount} requirements · ${status.inconsistencyCount} inconsistencies · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate counts: ${record.challengeSubjectCount} challenge subjects · ${record.assumptionCount} assumptions · ${record.alternativeCount} alternatives · ${record.findingCount} findings · ${record.responseCount} responses`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showDecisionRegister(
  pool: EngineClientPool,
  input: unknown,
): Promise<DecisionRegisterProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Decision Register candidate", "Initiative ID")
  const projection = await client.readDecisionRegister(initiativeId)
  const status = projection.status
  const record = projection.register
  const lines = [
    "GAEP governed Decision Register candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${status.state}`,
    `Coverage: ${status.decisionCount} decisions`,
    `Candidate gaps: ${status.unresolvedDecisionCount} unresolved decisions · ${status.selectedPendingDecisionCount} selected pending decisions · ${status.deferredDecisionCount} deferred decisions · ${status.unresolvedRequirementCount} requirements · ${status.inconsistencyCount} inconsistencies · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate counts: ${record.decisionCount} decisions`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showRiskRegister(
  pool: EngineClientPool,
  input: unknown,
): Promise<RiskRegisterProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Risk Register candidate", "Initiative ID")
  const projection = await client.readRiskRegister(initiativeId)
  const status = projection.status
  const record = projection.register
  const lines = [
    "GAEP governed Risk Register candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${status.state}`,
    `Coverage: ${status.riskCount} risks · ${status.proposedTreatmentCount} proposed treatments · ${status.unassignedOwnerCount} owner assignments not established`,
    `Candidate gaps: ${status.notAssessedRiskCount} not assessed · ${status.unresolvedResidualRiskCount} residual risks · ${status.unverifiedControlCount} control effectiveness gaps · ${status.unresolvedRequirementCount} requirements · ${status.inconsistencyCount} inconsistencies · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate counts: ${record.riskCount} risks`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showEvidenceRegistry(
  pool: EngineClientPool,
  input: unknown,
): Promise<EvidenceRegistryProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Evidence Registry candidate", "Initiative ID")
  const projection = await client.readEvidenceRegistry(initiativeId)
  const status = projection.status
  const record = projection.registry
  const lines = [
    "GAEP governed Evidence Registry candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${status.state}`,
    `Coverage: ${status.claimCount} claims · ${status.evidenceItemCount} evidence items · ${status.linkCount} claim/evidence links`,
    `Candidate gaps: ${status.notAssessedClaimCount} claims not assessed · ${status.notAssessedEvidenceCount} evidence items not assessed · ${status.adverseEvidencePendingDispositionCount} adverse dispositions pending · ${status.staleOrUnknownEvidenceCount} stale or unknown · ${status.invalidatedEvidenceCount} invalidated · ${status.unresolvedLinkCount} unresolved links · ${status.unresolvedRequirementCount} requirements · ${status.inconsistencyCount} inconsistencies · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate counts: ${record.claimCount} claims · ${record.evidenceItemCount} evidence items · ${record.linkCount} links`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showEndToEndTraceability(
  pool: EngineClientPool,
  input: unknown,
): Promise<EndToEndTraceabilityProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the End-to-End Traceability candidate", "Initiative ID")
  const projection = await client.readEndToEndTraceability(initiativeId)
  const status = projection.status
  const record = projection.traceability
  const lines = [
    "GAEP governed End-to-End Traceability candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Assessment: ${status.state}`,
    `Coverage: ${status.nodeCount} nodes · ${status.relationshipCount} relationship types · ${status.linkCount} links · ${status.transformationCount} transformations`,
    `Candidate gaps: ${status.unresolvedEndpointCount} unresolved endpoints · ${status.notAssessedSemanticCount} semantic reviews pending · ${status.missingSpineCount} missing spine segments · ${status.unknownRelationshipCount} unknown relationships · ${status.unresolvedRequirementCount} requirements · ${status.inconsistencyCount} inconsistencies · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate counts: ${record.nodeCount} nodes · ${record.relationshipCount} relationship types · ${record.linkCount} links · ${record.transformationCount} transformations`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    `Coverage boundary: ${status.coverageBoundary}`,
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showP0P4ReadinessGate(
  pool: EngineClientPool,
  input: unknown,
): Promise<P0P4ReadinessGateProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the P0-P4 Readiness Gate candidate", "Initiative ID")
  const projection = await client.readP0P4ReadinessGate(initiativeId)
  const status = projection.status
  const record = projection.gate
  const lines = [
    "GAEP governed P0-P4 Readiness Gate candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Evaluation result: ${status.result}`,
    `Outputs: ${status.satisfiedOutputCount}/${status.applicableOutputCount} applicable satisfied · ${status.notApplicableOutputCount} candidate not applicable · ${status.unresolvedApplicabilityCount} unresolved applicability`,
    `Candidate gaps: ${status.blockedOutputCount} blocked · ${status.failedOutputCount} failed · ${status.incompleteOutputCount} incomplete · ${status.conditionalOutputCount} conditional · ${status.staleOrUnknownOutputCount} stale or unknown · ${status.pendingOrInvalidWaiverCount} waiver gaps · ${status.unresolvedDecisionCount} open decisions · ${status.unmetConditionCount} unmet conditions · ${status.unresolvedRequirementCount} requirements · ${status.adverseEvidenceCount} adverse evidence · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Evaluation definition digest: ${record.evaluationDefinitionDigest}`,
      `Candidate inventory: ${record.outputCount} outputs · ${record.waiverCount} waivers · ${record.unresolvedDecisionCount} open decisions · ${record.conditionCount} conditions`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    `Gate boundary: ${status.gateBoundary}`,
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showP5HandoffPackage(
  pool: EngineClientPool,
  input: unknown,
): Promise<P5HandoffPackageProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the P5 Handoff Package candidate", "Initiative ID")
  const projection = await client.readP5HandoffPackage(initiativeId)
  const status = projection.status
  const record = projection.handoff
  const lines = [
    "GAEP governed P5 Handoff Package candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state}`,
    `Readiness result: ${status.readinessResult} · transfer state: ${status.transferState}`,
    `Items: ${status.includedItemCount} included · ${status.referenceOnlyItemCount} exact references · ${status.omittedNotApplicableItemCount} candidate not applicable · ${status.unresolvedItemCount} unresolved`,
    `Candidate gaps: ${status.staleOrUnknownItemCount} stale or unknown applicable items · ${status.lossyTransformationCount} lossy transformations · ${status.unresolvedRequirementCount} requirements · ${status.conflictCount} conflicts · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Readiness assessment digest: ${record.readinessStatusDigest}`,
      `Candidate inventory: ${record.itemCount} items · ${record.requirementCount} requirements · ${record.deliveryMode} delivery`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    `Handoff boundary: ${status.handoffBoundary}`,
    "Source ownership remains retained. Complete for review is not acknowledgement, readiness approval, design approval, a Design Baseline, P5 entry, transfer authority, write authority, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showDesignApplicability(
  pool: EngineClientPool,
  input: unknown,
): Promise<DesignApplicabilityProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Design Applicability", "Initiative ID")
  const projection = await client.readDesignApplicability(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Design Applicability candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Coverage: ${status.scopeCount} scopes · ${status.decisionCount} explicit UX, UI, design-work, and Figma decisions`,
    `Candidate gaps: ${status.unresolvedDecisionCount} unresolved decisions · ${status.blockedDecisionCount} blocked decisions · ${status.pendingApprovalCount} pending approvals · ${status.rejectedApprovalCount} rejected approvals · ${status.unresolvedDepthCount} unresolved depths · ${status.unresolvedSourceCount} unresolved sources · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate inventory: ${record.scopeCount} scopes · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "This candidate never treats silence as not applicable and does not approve design, establish a Design Baseline, grant readiness, authorize implementation, write, or action.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showDesignPersonaRoleModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<DesignPersonaRoleModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Design Personas and Roles", "Initiative ID")
  const projection = await client.readDesignPersonaRoleModel(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Design Personas and Roles candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Coverage: ${status.personaCount} personas · ${status.designRoleCount} design roles · ${status.representedParticipantCategoryCount}/5 participant categories · ${status.representedRoleKindCount}/4 role kinds`,
    `Persona evidence: ${status.humanReviewedPersonaCount} human-reviewed · ${status.weakEvidencePersonaCount} weak-evidence`,
    `Candidate gaps: ${status.unresolvedParticipantCategoryCount} unresolved participant categories · ${status.unresolvedRoleKindCount} unresolved role kinds · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate inventory: ${record.personaCount} personas · ${record.designRoleCount} design roles · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Purpose-limited candidate persona hypotheses and design responsibilities only; this does not validate personas, appoint roles, verify competence, approve design, grant readiness, authorize write, or authorize action.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showUserJourneyModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<UserJourneyModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for User Journeys", "Initiative ID")
  const projection = await client.readUserJourneyModel(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed User Journeys candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Inventory: ${status.journeyCount} journeys · ${status.touchpointCount} touchpoints`,
    `Paths: ${status.primaryPathCount} primary · ${status.successPathCount} success · ${status.failurePathCount} failure · ${status.recoveryPathCount} recovery`,
    `Scope coverage: ${status.representedScopeCount} represented · ${status.unresolvedScopeCount} unresolved`,
    `Candidate gaps: ${status.weakEvidencePathCount} weak-evidence paths · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate inventory: ${record.journeyCount} journeys · ${record.touchpointCount} touchpoints · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate journey structure and coverage metadata only; this does not prove observed behavior, validate journeys, approve design, grant readiness, authorize write, or authorize action.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showInformationArchitectureModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<InformationArchitectureModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Information Architecture", "Initiative ID")
  const projection = await client.readInformationArchitectureModel(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Information Architecture candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Inventory: ${status.nodeCount} nodes · ${status.rootNodeCount} roots · ${status.routeCount} routes`,
    `Scope coverage: ${status.representedScopeCount} represented · ${status.unresolvedScopeCount} unresolved`,
    `Candidate gaps: ${status.weakEvidenceNodeCount} weak-evidence nodes · ${status.weakEvidenceRouteCount} weak-evidence routes · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate inventory: ${record.nodeCount} nodes · ${record.rootNodeCount} roots · ${record.routeCount} routes · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate hierarchy, content-model, and route metadata only; this does not prove findability, comprehension, or accessibility, validate content, approve design, grant readiness, authorize write, or authorize action.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showScreenStateInventory(
  pool: EngineClientPool,
  input: unknown,
): Promise<ScreenStateInventoryProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Screen and State Inventory", "Initiative ID")
  const projection = await client.readScreenStateInventory(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Screen and State Inventory candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Inventory: ${status.platformCount} platforms · ${status.screenCount} screens · ${status.stateCount} states · ${status.variantCount} variants`,
    `Route coverage: ${status.representedRouteCount} represented · ${status.unresolvedRouteCount} unresolved`,
    `Scope coverage: ${status.representedScopeCount} represented · ${status.unresolvedScopeCount} unresolved`,
    `Candidate gaps: ${status.unresolvedPlatformCount} unresolved platforms · ${status.weakEvidenceItemCount} weak-evidence items · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate inventory: ${record.platformCount} platforms · ${record.screenCount} screens · ${record.stateCount} states · ${record.variantCount} variants · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate platform, screen, state, and variant metadata only; this does not prove UI completeness, platform parity, state reachability, interaction quality, or accessibility, approve design, grant readiness, authorize write, or authorize action.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showDesignRequirements(
  pool: EngineClientPool,
  input: unknown,
): Promise<DesignRequirementsProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Design Requirements", "Initiative ID")
  const projection = await client.readDesignRequirements(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Design Requirements candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState} · catalog: ${status.catalogCompletenessState}`,
    `Inventory: ${status.requirementCount} requirements · ${status.mustPriorityCount} must-priority · ${status.workItemCount} Work Items`,
    `Outcome coverage: ${status.representedOutcomeCount} represented · ${status.unresolvedOutcomeCount} unresolved`,
    `Backlog disposition: ${status.linkedBacklogRequirementCount} linked · ${status.notPlannedRequirementCount} not planned · ${status.unresolvedBacklogRequirementCount} unresolved`,
    `Candidate gaps: ${status.weakEvidenceRequirementCount} weak-evidence requirements · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleDomainReferenceCount} stale domain references · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate inventory: ${record.requirementCount} requirements · ${record.representedOutcomeCount} represented outcomes · ${record.workItemCount} Work Items · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and digests only; this does not establish requirement validity, completeness, priority approval, satisfaction, backlog commitment, design approval, readiness, implementation, write, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showBacklogHierarchy(
  pool: EngineClientPool,
  input: unknown,
): Promise<BacklogHierarchyProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Backlog Hierarchy", "Initiative ID")
  const projection = await client.readBacklogHierarchy(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Backlog Hierarchy candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState} · hierarchy: ${status.hierarchyCompletenessState}`,
    `Hierarchy: ${status.epicCount} Epics · ${status.featureCount} Features · ${status.storyCount} Stories · ${status.taskCount} Tasks`,
    `Topology and trace: ${status.rootCount} roots · ${status.leafCount} leaves · ${status.requirementTraceCount} Requirement traces`,
    `Candidate gaps: ${status.untracedStoryTaskCount} untraced delivery nodes · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleWorkItemCount} stale Work Items · ${status.staleChangeCount} stale Changes · ${status.staleRequirementCount} stale Requirements`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate hierarchy: ${record.epicCount} Epics · ${record.featureCount} Features · ${record.storyCount} Stories · ${record.taskCount} Tasks · ${record.requirementTraceCount} Requirement traces · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, level counts, statuses, and digests only; this does not establish priority, commitment, ownership authority, Definition of Ready or Done, implementation readiness, assignment, execution, implementation authority, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showMvpSliceDefinition(
  pool: EngineClientPool,
  input: unknown,
): Promise<MvpSliceDefinitionProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for MVP and Vertical Slice Definition", "Initiative ID")
  const projection = await client.readMvpSliceDefinition(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed MVP and Vertical Slice candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState} · scope: ${status.scopeCompletenessState}`,
    `Scope: ${status.scopeNodeCount} nodes · ${status.mvpNodeCount} MVP · ${status.laterNodeCount} later · ${status.excludedNodeCount} excluded`,
    `Vertical Slices: ${status.sliceCount} slices · ${status.storyCount} Stories · ${status.taskCount} Tasks · ${status.dependencyCount} dependencies`,
    `Candidate gaps: ${status.unassignedMvpStoryTaskCount} unassigned MVP Stories or Tasks · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleHierarchyCount} stale hierarchies · ${status.invalidScopeCount} invalid scope entries · ${status.invalidSliceCount} invalid slices`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Exact Backlog Hierarchy digest: ${record.hierarchyDigest}`,
      `Candidate scope: ${record.scopeNodeCount} nodes · ${record.mvpNodeCount} MVP · ${record.laterNodeCount} later · ${record.excludedNodeCount} excluded`,
      `Candidate slices: ${record.sliceCount} slices · ${record.storyCount} Stories · ${record.taskCount} Tasks · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, scope and slice counts, statuses, and digests only; this does not establish priority, commitment, scope approval, acceptance-criteria validity, Definition of Ready or Done, implementation readiness, assignment, execution, implementation authority, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showPrioritizationModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<PrioritizationModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Prioritization Model inspection", "Initiative ID")
  const projection = await client.readPrioritizationModel(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Prioritization Model candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Coverage: ${status.subjectCount} slices · ${status.scoredSubjectCount} scored · ${status.unassessedSubjectCount} unassessed · ${status.evidenceReferenceCount} evidence references · ${status.tieCount} score ties`,
    `Candidate gaps: ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleMvpSliceDefinitionCount} stale MVP definitions · ${status.invalidSubjectCount} invalid subjects · ${status.invalidScoreCount} invalid scores`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Method digest: ${record.methodDigest}`,
      `Candidate ranking digest: ${record.rankingDigest}`,
      `Candidate coverage: ${record.subjectCount} slices · ${record.scoredSubjectCount} scored · ${record.evidenceReferenceCount} evidence references · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, method, membership, ranking, and snapshot digests only; no dimension estimates, evidence identities, uncertainty, slice content, or personal data; this does not establish evidence validity, priority, commitment, scope decisions, approval, acceptance-criteria validity, Definition of Ready or Done, implementation readiness, assignment, execution, implementation authority, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showAcceptanceCriteria(
  pool: EngineClientPool,
  input: unknown,
): Promise<AcceptanceCriteriaProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Acceptance Criteria inspection", "Initiative ID")
  const projection = await client.readAcceptanceCriteria(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Acceptance Criteria candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Coverage: ${status.subjectCount} subjects · ${status.coveredSubjectCount} covered · ${status.uncoveredSubjectCount} uncovered · ${status.requirementTraceCount} Requirement traces · ${status.uncoveredRequirementCount} uncovered Requirements`,
    `Criteria: ${status.criterionCount} total · ${status.testableCriterionCount} candidate-testable · ${status.unassessedCriterionCount} unassessed · ${status.verificationMethodCount} verification methods`,
    `Candidate gaps: ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleHierarchyCount} stale hierarchies · ${status.staleMvpSliceDefinitionCount} stale MVP definitions · ${status.stalePrioritizationModelCount} stale prioritization models · ${status.invalidCriterionCount} invalid criteria`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Subject catalog digest: ${record.subjectCatalogDigest}`,
      `Criterion catalog digest: ${record.criterionCatalogDigest}`,
      `Verification-method catalog digest: ${record.verificationMethodCatalogDigest}`,
      `Coverage digest: ${record.coverageDigest}`,
      `Candidate coverage: ${record.subjectCount} subjects · ${record.criterionCount} criteria · ${record.testableCriterionCount} candidate-testable · ${record.requirementTraceCount} Requirement traces · ${record.verificationMethodCount} methods · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and subject, criterion, verification-method, coverage, and snapshot digests only; no criterion text, Requirement identities, verification evidence, or personal data; this does not establish criterion validity or completeness, Requirement satisfaction, priority, commitment, approval, Definition of Ready or Done, implementation readiness, assignment, execution, acceptance, implementation authority, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showDefinitionOfReady(
  pool: EngineClientPool,
  input: unknown,
): Promise<DefinitionOfReadyProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Definition of Ready inspection", "Initiative ID")
  const projection = await client.readDefinitionOfReady(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Definition of Ready candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.result} · review state: ${status.reviewState}`,
    `Coverage: ${status.subjectCount} subjects · ${status.policyEntryCount} prerequisites · ${status.evaluationCount}/${status.expectedEvaluationCount} evaluations · ${status.missingEvaluationCount} missing`,
    `Evaluation states: ${status.candidateSatisfiedCount} candidate-satisfied · ${status.notApplicableCount} not-applicable candidates · ${status.notSatisfiedCount} not satisfied · ${status.exceptionCandidateCount} exception candidates · ${status.notAssessedCount} unassessed · ${status.staleEvaluationCount} stale · ${status.invalidEvaluationCount} invalid`,
    `Candidate gaps: ${status.unresolvedQuestionCount} questions · ${status.expiredCount} expired · ${status.staleBindingCount} stale bindings · ${status.staleHierarchyCount} stale hierarchies · ${status.staleMvpSliceDefinitionCount} stale MVP definitions · ${status.stalePrioritizationModelCount} stale prioritization models · ${status.staleAcceptanceCriteriaCount} stale Acceptance Criteria`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Policy version: ${record.policyVersion} · valid until ${record.validUntil}`,
      `Subject catalog digest: ${record.subjectCatalogDigest}`,
      `Policy digest: ${record.policyDigest}`,
      `Evaluation digest: ${record.evaluationDigest}`,
      `Receipt digest: ${record.receiptDigest}`,
      `Candidate coverage: ${record.subjectCount} subjects · ${record.policyEntryCount} prerequisites · ${record.evaluationCount} evaluations · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, validity time, and subject, policy, evaluation, receipt, and snapshot digests only; no rules, rationales, evidence identities, assessor identities, or personal data. A candidate pass is an evaluation result, not admission, readiness, assignment, execution, implementation permission, exception or waiver authority, phase entry, acceptance, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Gate boundary: ${projection.gateBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showDefinitionOfDone(
  pool: EngineClientPool,
  input: unknown,
): Promise<DefinitionOfDoneProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Definition of Done inspection", "Initiative ID")
  const projection = await client.readDefinitionOfDone(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Definition of Done candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.result} · review state: ${status.reviewState}`,
    `Coverage: ${status.subjectCount} subjects · ${status.policyEntryCount} prerequisites · ${status.evaluationCount}/${status.expectedEvaluationCount} evaluations · ${status.missingEvaluationCount} missing`,
    `Evaluation states: ${status.candidateSatisfiedCount} candidate-satisfied · ${status.notApplicableCount} not-applicable candidates · ${status.notSatisfiedCount} not satisfied · ${status.exceptionCandidateCount} exception candidates · ${status.notAssessedCount} unassessed · ${status.staleEvaluationCount} stale · ${status.invalidEvaluationCount} invalid`,
    `Candidate gaps: ${status.unresolvedQuestionCount} questions · ${status.expiredCount} expired · ${status.staleBindingCount} stale bindings · ${status.staleHierarchyCount} stale hierarchies · ${status.staleMvpSliceDefinitionCount} stale MVP definitions · ${status.stalePrioritizationModelCount} stale prioritization models · ${status.staleAcceptanceCriteriaCount} stale Acceptance Criteria · ${status.staleDefinitionOfReadyCount} stale Definition of Ready`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Policy version: ${record.policyVersion} · valid until ${record.validUntil}`,
      `Subject catalog digest: ${record.subjectCatalogDigest}`,
      `Policy digest: ${record.policyDigest}`,
      `Evaluation digest: ${record.evaluationDigest}`,
      `Receipt digest: ${record.receiptDigest}`,
      `Candidate coverage: ${record.subjectCount} subjects · ${record.policyEntryCount} prerequisites · ${record.evaluationCount} evaluations · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, validity time, and subject, policy, evaluation, receipt, and snapshot digests only; no rules, rationales, evidence identities, assessor identities, or personal data. A candidate pass is an evaluation result, not completion, acceptance, approval, exception or waiver authority, implementation completeness, merge, release or deployment readiness, assignment, execution, or action permission.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Gate boundary: ${projection.gateBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showImplementationUnitModel(
  pool: EngineClientPool,
  input: unknown,
): Promise<ImplementationUnitModelProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Implementation Unit Model inspection", "Initiative ID")
  const projection = await client.readImplementationUnitModel(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Implementation Unit Model candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Coverage: ${status.unitCount} units · ${status.subjectCount} subjects · ${status.requirementReferenceCount} Requirement references · ${status.repositoryCandidateCount} repository candidates · ${status.ownerCandidateCount} owner candidates`,
    `Dependencies and impact: ${status.dependencyEdgeCount} dependency edges · ${status.candidateAssessedBlastRadiusCount} blast radii candidate-assessed · ${status.notAssessedBlastRadiusCount} not assessed`,
    `Candidate gaps: ${status.unresolvedQuestionCount} questions · ${status.missingSubjectCount} missing subjects · ${status.invalidUnitCount} invalid units · ${status.staleBindingCount} stale bindings · ${status.staleHierarchyCount} stale hierarchies · ${status.staleMvpSliceDefinitionCount} stale MVP definitions · ${status.staleAcceptanceCriteriaCount} stale Acceptance Criteria · ${status.staleDefinitionOfReadyCount} stale Definition of Ready · ${status.staleDefinitionOfDoneCount} stale Definition of Done`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Placement digest: ${record.placementDigest}`,
      `Assessment receipt digest: ${record.assessmentReceiptDigest}`,
      `Candidate coverage: ${record.unitCount} units · ${record.subjectCount} subjects · ${record.requirementReferenceCount} Requirement references · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and membership, placement, assessment-receipt, and snapshot digests only; no unit titles, boundaries, Story, Task, or Requirement identities, repository keys, module paths, owner identities, evidence, rationales, or personal data. Candidate completeness does not establish repository truth, owner appointment, dependency or impact completeness, implementation readiness or completeness, assignment, execution, approval, acceptance, merge, release, deployment, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showDependencyMapping(
  pool: EngineClientPool,
  input: unknown,
): Promise<DependencyMappingProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Dependency Mapping inspection", "Initiative ID")
  const projection = await client.readDependencyMapping(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Dependency Mapping candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Graph coverage: ${status.nodeCount} nodes · ${status.edgeCount} edges · ${status.requiredEdgeCount} required · ${status.conditionalEdgeCount} conditional · ${status.advisoryEdgeCount} advisory`,
    `Candidate critical path: ${status.criticalPathUnitCount} units · ${status.criticalPathCandidateEffortPoints} candidate effort points · ${status.rootNodeCount} roots · ${status.leafNodeCount} leaves`,
    `Candidate gaps: ${status.unresolvedQuestionCount} questions · ${status.missingNodeCount} missing nodes · ${status.missingDeclaredEdgeCount} missing declared edges · ${status.extraEdgeCount} extra edges · ${status.invalidNodeCount} invalid nodes · ${status.invalidEdgeCount} invalid edges · ${status.cycleCount} cycles · ${status.staleBindingCount} stale bindings · ${status.staleHierarchyCount} stale hierarchies · ${status.staleMvpSliceDefinitionCount} stale MVP definitions · ${status.staleImplementationUnitModelCount} stale Implementation Unit Models`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Graph digest: ${record.graphDigest}`,
      `Critical-path digest: ${record.criticalPathDigest}`,
      `Assessment receipt digest: ${record.assessmentReceiptDigest}`,
      `Candidate coverage: ${record.nodeCount} nodes · ${record.edgeCount} edges · ${record.criticalPathUnitCount} critical-path units · ${record.criticalPathCandidateEffortPoints} candidate effort points · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and graph, critical-path, assessment-receipt, and snapshot digests only; no unit, node, edge, evidence, rationale, estimate, owner, repository, module, Requirement, architecture, risk, test, or personal data. Candidate completeness does not establish dependency truth or completeness, critical-path authority, sequencing commitment, ownership appointment, implementation readiness or completeness, assignment, execution, approval, acceptance, merge, release, deployment, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showTechnologyProfile(
  pool: EngineClientPool,
  input: unknown,
): Promise<TechnologyProfileProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Technology Profile inspection", "Initiative ID")
  const projection = await client.readTechnologyProfile(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Technology Profile candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Candidate coverage: ${status.unitProfileCount} unit profiles · ${status.technologyChoiceCount} choices · ${status.exactVersionCandidateCount} exact versions · ${status.rangeVersionCandidateCount} ranges · ${status.unresolvedVersionCount} unresolved versions · ${status.constraintCount} constraints`,
    `Candidate policy gaps: ${status.unsupportedChoiceCount} unsupported · ${status.lifecycleRiskCount} lifecycle risks · ${status.compatibilityConflictCount} compatibility conflicts · ${status.licenseReviewRequiredCount} license reviews · ${status.licenseProhibitedCount} license-prohibited · ${status.securityReviewRequiredCount} security reviews · ${status.securityNonconformantCount} security-nonconformant · ${status.exceptionCandidateCount} exception candidates · ${status.constraintConflictCount} constraint conflicts`,
    `Candidate gaps: ${status.unresolvedQuestionCount} questions · ${status.missingProfileCount} missing profiles · ${status.invalidProfileCount} invalid profiles · ${status.missingEvidenceCount} missing evidence · ${status.staleBindingCount} stale bindings · ${status.staleImplementationUnitModelCount} stale Implementation Unit Models · ${status.staleDependencyMappingCount} stale Dependency Mappings`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Profile catalog digest: ${record.profileCatalogDigest}`,
      `Selection catalog digest: ${record.selectionCatalogDigest}`,
      `Compatibility assessment receipt digest: ${record.compatibilityAssessmentReceiptDigest}`,
      `Assessment receipt digest: ${record.assessmentReceiptDigest}`,
      `Candidate coverage: ${record.unitProfileCount} unit profiles · ${record.technologyChoiceCount} choices · ${record.constraintCount} constraints · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and profile, selection, compatibility, assessment, and snapshot digests only; no technology names, versions, constraints, evidence, rationale, unit, architecture, repository, toolchain, license, security-policy, or personal data. Candidate completeness does not establish technology approval, support commitment, compatibility truth or completeness, licensing or security approval, exception or waiver authority, architecture-baseline designation, implementation readiness or completeness, assignment, execution, approval, acceptance, merge, release, deployment, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showBoilerplateRegistry(
  pool: EngineClientPool,
  input: unknown,
): Promise<BoilerplateRegistryProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Boilerplate Registry inspection", "Initiative ID")
  const projection = await client.readBoilerplateRegistry(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Boilerplate Registry candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Candidate coverage: ${status.entryCount} entries · ${status.exactVersionCandidateCount} exact versions · ${status.rangeVersionCandidateCount} ranges · ${status.unresolvedVersionCount} unresolved versions · ${status.mandatoryCandidateCount} mandatory candidates`,
    `Candidate asset gaps: ${status.unavailableEntryCount} unavailable · ${status.integrityMismatchCount} integrity gaps · ${status.provenanceGapCount} provenance gaps · ${status.missingEvidenceCount} missing evidence`,
    `Candidate policy gaps: ${status.unsupportedEntryCount} unsupported · ${status.lifecycleRiskCount} lifecycle risks · ${status.technologyConflictCount} technology conflicts · ${status.architectureConflictCount} architecture conflicts · ${status.licenseReviewRequiredCount} license reviews · ${status.licenseProhibitedCount} license-prohibited · ${status.securityReviewRequiredCount} security reviews · ${status.securityNonconformantCount} security-nonconformant · ${status.exceptionCandidateCount} exception candidates`,
    `Candidate gaps: ${status.unresolvedQuestionCount} questions · ${status.invalidRegistryCount} invalid registries · ${status.staleBindingCount} stale bindings · ${status.staleImplementationUnitModelCount} stale Implementation Unit Models · ${status.staleTechnologyProfileCount} stale Technology Profiles`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Entry catalog digest: ${record.entryCatalogDigest}`,
      `Source catalog digest: ${record.sourceCatalogDigest}`,
      `Compatibility assessment receipt digest: ${record.compatibilityAssessmentReceiptDigest}`,
      `Assessment receipt digest: ${record.assessmentReceiptDigest}`,
      `Candidate coverage: ${record.entryCount} entries · ${record.mandatoryCandidateCount} mandatory candidates · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and entry, source, compatibility, assessment, and snapshot digests only; no boilerplate names, locators, versions, capabilities, limitations, evidence, rationale, technology, unit, architecture, repository, template, license, security-policy, or personal data. Candidate completeness does not establish organizational designation, endorsement, approval, support commitment, compatibility truth or completeness, licensing or security approval, exception or waiver, selection or binding, architecture baseline, implementation readiness or completeness, assignment, execution, acceptance, merge, release, deployment, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showBoilerplateSelectionBinding(
  pool: EngineClientPool,
  input: unknown,
): Promise<BoilerplateSelectionBindingProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Boilerplate Selection and Binding inspection", "Initiative ID")
  const projection = await client.readBoilerplateSelectionBinding(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Boilerplate Selection and Binding candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Candidate coverage: ${status.decisionCount} decisions · ${status.selectedCandidateCount} selected · ${status.notApplicableCandidateCount} not applicable · ${status.deferredCandidateCount} deferred · ${status.notAssessedCount} not assessed`,
    `Candidate decision gaps: ${status.missingUnitDecisionCount} missing unit decisions · ${status.invalidSelectionCount} invalid selections · ${status.registryGapCount} registry gaps · ${status.profileMismatchCount} profile mismatches · ${status.unitScopeMismatchCount} unit-scope mismatches · ${status.versionMismatchCount} version mismatches · ${status.missingEvidenceCount} missing evidence`,
    `Candidate freshness gaps: ${status.staleBindingCount} stale bindings · ${status.staleImplementationUnitModelCount} stale Implementation Unit Models · ${status.staleDependencyMappingCount} stale Dependency Mappings · ${status.staleTechnologyProfileCount} stale Technology Profiles · ${status.staleBoilerplateRegistryCount} stale Boilerplate Registries · ${status.invalidCandidateCount} invalid candidates · ${status.unresolvedQuestionCount} questions`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Unit decision catalog digest: ${record.unitDecisionCatalogDigest}`,
      `Selection receipt digest: ${record.selectionReceiptDigest}`,
      `Binding receipt digest: ${record.bindingReceiptDigest}`,
      `Assessment receipt digest: ${record.assessmentReceiptDigest}`,
      `Candidate coverage: ${record.decisionCount} decisions · ${record.selectedCandidateCount} selected · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and unit-decision, selection, binding, assessment, and snapshot digests only; no boilerplate names, locators, versions, unit or profile identities, rationale, conditions, alternatives, deviations, evidence, decision roles, or personal data. Candidate completeness does not establish organizational designation, endorsement, approval, support commitment, effective selection or binding, compatibility truth, completeness, or validation, licensing or security approval, exception or waiver, source retrieval, import or instantiation, architecture baseline, implementation readiness or completeness, assignment, execution, acceptance, merge, release, deployment, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showBoilerplateCompatibilityValidation(
  pool: EngineClientPool,
  input: unknown,
): Promise<BoilerplateCompatibilityValidationProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Boilerplate Compatibility Validation inspection", "Initiative ID")
  const projection = await client.readBoilerplateCompatibilityValidation(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Boilerplate Compatibility Validation candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Candidate coverage: ${status.selectedBindingCount} selected bindings · ${status.subjectCount} subjects · ${status.dimensionAssessmentCount} dimension assessments`,
    `Candidate outcomes: ${status.compatibleCandidateCount} compatible · ${status.incompatibleCandidateCount} incompatible · ${status.exceptionCandidateCount} exception candidates · ${status.notAssessedCount} not assessed`,
    `Candidate validation gaps: ${status.missingSubjectCount} missing subjects · ${status.invalidSubjectCount} invalid subjects · ${status.missingDimensionCount} missing dimensions · ${status.missingEvidenceCount} missing evidence · ${status.expiredAssessmentCount} expired assessments · ${status.conflictingOutcomeCount} conflicting outcomes · ${status.selectionBindingGapCount} selection-binding gaps`,
    `Candidate freshness gaps: ${status.staleBindingCount} stale bindings · ${status.staleImplementationUnitModelCount} stale Implementation Unit Models · ${status.staleDependencyMappingCount} stale Dependency Mappings · ${status.staleTechnologyProfileCount} stale Technology Profiles · ${status.staleBoilerplateRegistryCount} stale Boilerplate Registries · ${status.staleSelectionBindingCount} stale Selection Bindings · ${status.invalidCandidateCount} invalid candidates · ${status.unresolvedQuestionCount} questions`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Validation subject catalog digest: ${record.validationSubjectCatalogDigest}`,
      `Dimension catalog digest: ${record.dimensionCatalogDigest}`,
      `Evidence receipt digest: ${record.evidenceReceiptDigest}`,
      `Validation receipt digest: ${record.validationReceiptDigest}`,
      `Assessment receipt digest: ${record.assessmentReceiptDigest}`,
      `Candidate coverage: ${record.subjectCount} subjects · ${record.compatibleCandidateCount} compatible · ${record.incompatibleCandidateCount} incompatible · ${record.exceptionCandidateCount} exception candidates · ${record.notAssessedCount} not assessed · ${record.dimensionAssessmentCount} dimensions · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and subject, dimension, evidence, validation, assessment, and snapshot digests only; no boilerplate names, locators, versions, unit, profile, entry, or binding identities, claims, evidence, assessors, or personal data. Candidate completeness does not establish compatibility truth or completeness, a validation decision, actual asset behavior, test execution, design validity, security, privacy, or licensing approval, exception or waiver, effective selection or binding, source retrieval, import or instantiation, architecture baseline, implementation readiness or completeness, assignment, execution, acceptance, merge, release, deployment, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showFigmaToBoilerplateMapping(
  pool: EngineClientPool,
  input: unknown,
): Promise<FigmaToBoilerplateMappingProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Figma-to-Boilerplate Mapping inspection", "Initiative ID")
  const projection = await client.readFigmaToBoilerplateMapping(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Figma-to-Boilerplate Mapping candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Candidate coverage: ${status.designBindingCount} design bindings · ${status.subjectCount} mapping subjects`,
    `Candidate outcomes: ${status.mappedCandidateCount} mapped · ${status.conflictCandidateCount} conflicts · ${status.unmappedCandidateCount} unmapped · ${status.notAssessedCount} not assessed`,
    `Candidate kinds: ${status.componentMappingCount} component · ${status.tokenMappingCount} token · ${status.layoutMappingCount} layout · ${status.responsiveBehaviorMappingCount} responsive · ${status.platformTargetMappingCount} platform-target`,
    `Candidate mapping gaps: ${status.missingSubjectCount} missing subjects · ${status.invalidSubjectCount} invalid subjects · ${status.targetGapCount} target gaps · ${status.traceGapCount} trace gaps · ${status.evidenceGapCount} evidence gaps`,
    `Candidate freshness gaps: ${status.staleBindingCount} stale bindings · ${status.staleDependencyCount} stale dependencies · ${status.invalidCandidateCount} invalid candidates · ${status.unresolvedQuestionCount} questions`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Mapping subject catalog digest: ${record.mappingSubjectCatalogDigest}`,
      `Target catalog digest: ${record.targetCatalogDigest}`,
      `Trace receipt digest: ${record.traceReceiptDigest}`,
      `Mapping receipt digest: ${record.mappingReceiptDigest}`,
      `Assessment receipt digest: ${record.assessmentReceiptDigest}`,
      `Candidate coverage: ${record.subjectCount} subjects · ${record.mappedCandidateCount} mapped · ${record.conflictCandidateCount} conflicts · ${record.unmappedCandidateCount} unmapped · ${record.notAssessedCount} not assessed · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and subject, target, trace, mapping, assessment, and snapshot digests only; no Figma content, design-item, binding, unit, profile, registry-entry, validation-subject, requirement, target-locator, evidence, reviewer, or personal data. This inspection does not connect to or call Figma, establish returned Figma content, design validity, approval or baseline, mapping truth or completeness, effective selection or compatibility truth, retrieve, import, instantiate, generate or execute assets, establish implementation readiness or completeness, assign, execute, accept, merge, release, deploy, or grant action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showDesignToCodeBindingRegistry(
  pool: EngineClientPool,
  input: unknown,
): Promise<DesignToCodeBindingRegistryProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Design-to-Code Binding Registry inspection", "Initiative ID")
  const projection = await client.readDesignToCodeBindingRegistry(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Design-to-Code Binding Registry candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Candidate coverage: ${status.mappingSubjectCount} mapping subjects · ${status.subjectCount} binding subjects`,
    `Candidate outcomes: ${status.boundCandidateCount} bound · ${status.conflictCandidateCount} conflicts · ${status.unboundCandidateCount} unbound · ${status.notAssessedCount} not assessed`,
    `Candidate binding gaps: ${status.missingSubjectCount} missing subjects · ${status.invalidSubjectCount} invalid subjects · ${status.targetGapCount} target gaps · ${status.traceGapCount} trace gaps · ${status.evidenceGapCount} evidence gaps · ${status.duplicateTargetCount} duplicate targets`,
    `Candidate freshness gaps: ${status.staleBindingCount} stale bindings · ${status.staleDependencyCount} stale dependencies · ${status.invalidCandidateCount} invalid candidates · ${status.unresolvedQuestionCount} questions`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Binding subject catalog digest: ${record.bindingSubjectCatalogDigest}`,
      `Code target catalog digest: ${record.codeTargetCatalogDigest}`,
      `Trace receipt digest: ${record.traceReceiptDigest}`,
      `Binding receipt digest: ${record.bindingReceiptDigest}`,
      `Assessment receipt digest: ${record.assessmentReceiptDigest}`,
      `Candidate coverage: ${record.subjectCount} subjects · ${record.boundCandidateCount} bound · ${record.conflictCandidateCount} conflicts · ${record.unboundCandidateCount} unbound · ${record.notAssessedCount} not assessed · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and subject, target, trace, binding, assessment, and snapshot digests only; no Figma content, design-item, mapping, unit, requirement, repository, module, path, symbol, evidence, reviewer, or personal data. This inspection does not connect to or call Figma, establish returned Figma content, design validity, approval or baseline, mapping or binding truth or completeness, repository, path, or symbol truth, create or change code targets, retrieve, import, instantiate, generate or execute assets, establish implementation readiness or completeness, assign, execute, accept, merge, release, deploy, or grant action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showRouteScreenComponentMapping(
  pool: EngineClientPool,
  input: unknown,
): Promise<RouteScreenComponentMappingProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Route, Screen, and Component Mapping inspection", "Initiative ID")
  const projection = await client.readRouteScreenComponentMapping(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Route, Screen, and Component Mapping candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Source coverage: ${status.sourceRouteCount} routes · ${status.sourceScreenCount} screens · ${status.sourceStateCount} states · ${status.sourceComponentCount} components`,
    `Candidate coverage: ${status.subjectCount} subjects · ${status.routeSubjectCount} routes · ${status.screenSubjectCount} screens · ${status.stateSubjectCount} states · ${status.componentSubjectCount} components`,
    `Candidate outcomes: ${status.mappedCandidateCount} mapped · ${status.conflictCandidateCount} conflicts · ${status.unmappedCandidateCount} unmapped · ${status.notAssessedCount} not assessed`,
    `Candidate relationships: ${status.relationshipCount} total · ${status.definedRelationshipCount} defined · ${status.conflictRelationshipCount} conflicts · ${status.notAssessedRelationshipCount} not assessed`,
    `Candidate mapping gaps: ${status.missingSubjectCount} missing subjects · ${status.extraSubjectCount} extra subjects · ${status.invalidSubjectCount} invalid subjects · ${status.missingRelationshipCount} missing relationships · ${status.invalidRelationshipCount} invalid relationships · ${status.traceGapCount} trace gaps · ${status.evidenceGapCount} evidence gaps · ${status.componentPlacementGapCount} component placement gaps · ${status.testHookGapCount} test-hook gaps`,
    `Candidate freshness gaps: ${status.staleBindingCount} stale bindings · ${status.staleDependencyCount} stale dependencies · ${status.invalidCandidateCount} invalid candidates · ${status.unresolvedQuestionCount} questions`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Subject catalog digest: ${record.subjectCatalogDigest}`,
      `Relationship catalog digest: ${record.relationshipCatalogDigest}`,
      `Trace receipt digest: ${record.traceReceiptDigest}`,
      `Mapping receipt digest: ${record.mappingReceiptDigest}`,
      `Assessment receipt digest: ${record.assessmentReceiptDigest}`,
      `Candidate coverage: ${record.subjectCount} subjects · ${record.relationshipCount} relationships · ${record.mappedCandidateCount} mapped · ${record.conflictCandidateCount} conflicts · ${record.unmappedCandidateCount} unmapped · ${record.notAssessedCount} not assessed · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and subject, relationship, trace, mapping, assessment, and snapshot digests only; no route patterns, screen, state, component, design, Requirement, Acceptance Criteria, Implementation Unit, repository, module, path, symbol, test-hook, evidence, reviewer, or personal data. This inspection does not connect to or call Figma, establish returned Figma content, navigation or mapping truth, UI or design validity, repository or test truth, create or change code or design targets, establish implementation readiness or completeness, assign, execute, accept, merge, release, deploy, or grant action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showTestMethodology(
  pool: EngineClientPool,
  input: unknown,
): Promise<TestMethodologyProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Test Methodology inspection", "Initiative ID")
  const projection = await client.readTestMethodology(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Test Methodology candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Source coverage: ${status.sourceUnitCount} units · ${status.sourceRequirementCount} Requirements · ${status.sourceCriterionCount} Acceptance Criteria · ${status.sourceMappingSubjectCount} mapping subjects`,
    `Candidate coverage: ${status.scopeCount} scopes · ${status.decisionCount} decisions · ${status.environmentCount} environments · ${status.dataPolicyCount} data policies · ${status.evidenceExpectationCount} evidence expectations`,
    `Candidate outcomes: ${status.selectedDecisionCount} selected · ${status.conflictDecisionCount} conflicts · ${status.notApplicableDecisionCount} not applicable · ${status.deferredDecisionCount} deferred · ${status.notAssessedDecisionCount} not assessed`,
    `Candidate criteria: ${status.entryCriterionCount} entry · ${status.exitCriterionCount} exit`,
    `Candidate methodology gaps: ${status.missingScopeCount} missing scopes · ${status.extraScopeCount} extra scopes · ${status.invalidDecisionCount} invalid decisions · ${status.environmentGapCount} environment gaps · ${status.dataPolicyGapCount} data-policy gaps · ${status.ownershipGapCount} ownership gaps · ${status.traceGapCount} trace gaps · ${status.evidenceGapCount} evidence gaps · ${status.criterionGapCount} criterion gaps`,
    `Candidate freshness gaps: ${status.staleBindingCount} stale bindings · ${status.staleDependencyCount} stale dependencies · ${status.invalidCandidateCount} invalid candidates · ${status.unresolvedQuestionCount} questions`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Scope catalog digest: ${record.scopeCatalogDigest}`,
      `Methodology receipt digest: ${record.methodologyReceiptDigest}`,
      `Environment receipt digest: ${record.environmentReceiptDigest}`,
      `Data-policy receipt digest: ${record.dataPolicyReceiptDigest}`,
      `Ownership receipt digest: ${record.ownershipReceiptDigest}`,
      `Trace receipt digest: ${record.traceReceiptDigest}`,
      `Assessment receipt digest: ${record.assessmentReceiptDigest}`,
      `Candidate coverage: ${record.scopeCount} scopes · ${record.decisionCount} decisions · ${record.selectedDecisionCount} selected · ${record.conflictDecisionCount} conflicts · ${record.environmentCount} environments · ${record.dataPolicyCount} data policies · ${record.entryCriterionCount} entry criteria · ${record.exitCriterionCount} exit criteria · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and methodology scope, environment, data, ownership, trace, assessment, and snapshot digests only; no Requirement, criterion, method rationale, environment address, test data, owner, evidence, result, personal data, secret, credential, or machine path. This inspection does not establish methodology validity or completeness, environment availability, data fitness, privacy or security approval, owner appointment, test execution or results, evidence or coverage truth, quality, implementation readiness, acceptance, release, deployment, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showTestInventory(
  pool: EngineClientPool,
  input: unknown,
): Promise<TestInventoryProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Test Inventory inspection", "Initiative ID")
  const projection = await client.readTestInventory(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Test Inventory candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Source coverage: ${status.sourceCriterionCount} Acceptance Criteria · ${status.sourceRiskCount} Risks · ${status.sourceUnitCount} Implementation Units · ${status.sourceMappingSubjectCount} mapping subjects · ${status.sourceMethodologyScopeCount} methodology scopes`,
    `Candidate inventory: ${status.assetCount} tests · ${status.catalogedAssetCount} cataloged · ${status.conflictAssetCount} conflicts · ${status.missingAssetCount} missing · ${status.deferredAssetCount} deferred · ${status.notAssessedAssetCount} not assessed`,
    `Candidate asset states: ${status.observedAssetCount} observed · ${status.plannedAssetCount} planned · ${status.automatedAssetCount} automated · ${status.manualAssetCount} manual`,
    `Candidate coverage gaps: ${status.uncoveredCriterionCount} criteria · ${status.uncoveredRiskCount} risks · ${status.uncoveredUnitCount} units · ${status.uncoveredMappingSubjectCount} mapping subjects · ${status.uncoveredMethodologyScopeCount} methodology scopes`,
    `Candidate integrity gaps: ${status.duplicateIdentityCount} duplicates · ${status.orphanAssetCount} orphans · ${status.ownershipGapCount} ownership · ${status.traceGapCount} trace · ${status.evidenceGapCount} evidence`,
    `Candidate freshness gaps: ${status.staleBindingCount} stale bindings · ${status.staleDependencyCount} stale dependencies · ${status.invalidCandidateCount} invalid candidates · ${status.unresolvedQuestionCount} questions`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Catalog receipt digest: ${record.catalogReceiptDigest}`,
      `Coverage receipt digest: ${record.coverageReceiptDigest}`,
      `Trace receipt digest: ${record.traceReceiptDigest}`,
      `Ownership receipt digest: ${record.ownershipReceiptDigest}`,
      `Assessment receipt digest: ${record.assessmentReceiptDigest}`,
      `Candidate coverage: ${record.assetCount} tests · ${record.catalogedAssetCount} cataloged · ${record.conflictAssetCount} conflicts · ${record.observedAssetCount} observed · ${record.plannedAssetCount} planned · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and test catalog, coverage, trace, ownership, assessment, and snapshot digests only; no test title, path, code, steps, data, owner, evidence, result, personal data, secret, credential, or machine path. This inspection does not establish test existence, inventory validity or completeness, environment availability, privacy or security approval, owner appointment, test execution or results, evidence or coverage truth, quality, implementation readiness, acceptance, release, deployment, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showHighLevelDesign(
  pool: EngineClientPool,
  input: unknown,
): Promise<HighLevelDesignProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for High-Level Design inspection", "Initiative ID")
  const projection = await client.readHighLevelDesign(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed High-Level Design candidate", "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Exact dependencies: ${status.presentDependencyCount}/${status.dependencyCount}`,
    `Candidate structure: ${status.definedElementCount}/${status.elementCount} elements · ${status.definedRelationCount}/${status.relationCount} relations · ${status.selectedDecisionCount}/${status.decisionCount} decisions`,
    `Candidate views: ${status.qualityAttributeCount} quality attributes · ${status.deploymentViewCount} deployment views`,
    `Candidate structural gaps: ${status.conflictCount} conflicts · ${status.missingCount} missing · ${status.orphanRelationCount} orphan relations`,
    `Candidate integrity gaps: ${status.traceGapCount} trace · ${status.evidenceGapCount} evidence · ${status.ownershipGapCount} ownership · ${status.uncoveredUnitCount} uncovered units`,
    `Candidate freshness gaps: ${status.staleBindingCount} stale bindings · ${status.staleDependencyCount} stale dependencies · ${status.invalidCandidateCount} invalid candidates · ${status.unresolvedQuestionCount} questions`,
    ...status.reasons.map((reason) => `  - ${reason}`), "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Structure receipt digest: ${record.structureReceiptDigest}`,
      `Dependency receipt digest: ${record.dependencyReceiptDigest}`,
      `Trace receipt digest: ${record.traceReceiptDigest}`,
      `Coverage receipt digest: ${record.coverageReceiptDigest}`,
      `Ownership receipt digest: ${record.ownershipReceiptDigest}`,
      `Assessment receipt digest: ${record.assessmentReceiptDigest}`,
      `Candidate coverage: ${record.elementCount} elements · ${record.relationCount} relations · ${record.decisionCount} decisions · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []), "",
    "Candidate identities, counts, statuses, and structure, dependency, trace, coverage, ownership, assessment, and snapshot digests only; no design narrative, diagram, interface, data flow, technology, owner, evidence source content, personal data, secret, credential, or machine path. This inspection does not establish architecture, repository, runtime, or deployment truth or completeness, architecture approval, privacy or security approval, owner appointment, implementation readiness, acceptance, release, deployment, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showLowLevelDesign(
  pool: EngineClientPool,
  input: unknown,
): Promise<LowLevelDesignProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Low-Level Design inspection", "Initiative ID")
  const suppliedUnit = typeof input === "object" && input !== null && "implementationUnitId" in input
    ? (input as { implementationUnitId?: unknown }).implementationUnitId
    : undefined
  const implementationUnitId = typeof suppliedUnit === "string" ? suppliedUnit :
    await collectUuid("Enter the exact Implementation Unit UUID for Low-Level Design inspection", "Implementation Unit ID")
  const projection = await client.readLowLevelDesign(initiativeId, implementationUnitId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Low-Level Design candidate", "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Implementation Unit: ${status.implementationUnitId ?? "unbound"}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Exact dependencies: ${status.presentDependencyCount}/${status.dependencyCount}`,
    `Candidate structure: ${status.definedElementCount}/${status.elementCount} elements · ${status.definedRelationCount}/${status.relationCount} relations · ${status.selectedDecisionCount}/${status.decisionCount} decisions`,
    `Candidate structural gaps: ${status.conflictCount} conflicts · ${status.missingCount} missing · ${status.orphanRelationCount} orphan relations`,
    `Candidate integrity gaps: ${status.traceGapCount} trace · ${status.evidenceGapCount} evidence · ${status.ownershipGapCount} ownership · ${status.uncoveredUnitCount} uncovered units`,
    `Candidate freshness gaps: ${status.staleBindingCount} stale bindings · ${status.staleDependencyCount} stale dependencies · ${status.invalidCandidateCount} invalid candidates · ${status.unresolvedQuestionCount} questions`,
    ...status.reasons.map((reason) => `  - ${reason}`), "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Structure receipt digest: ${record.structureReceiptDigest}`,
      `Dependency receipt digest: ${record.dependencyReceiptDigest}`,
      `Trace receipt digest: ${record.traceReceiptDigest}`,
      `Coverage receipt digest: ${record.coverageReceiptDigest}`,
      `Ownership receipt digest: ${record.ownershipReceiptDigest}`,
      `Assessment receipt digest: ${record.assessmentReceiptDigest}`,
      `Candidate coverage: ${record.elementCount} elements · ${record.relationCount} relations · ${record.decisionCount} decisions · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []), "",
    "Candidate identities, counts, statuses, and receipt digests only; no design narrative, module, class, component, interface, data contract, algorithm, state, error recovery, authorization, observability, test hook, owner, evidence source content, personal data, secret, credential, or machine path. This inspection does not establish design, repository, source, runtime, or deployment truth or completeness, design approval, privacy or security approval, owner appointment, implementation readiness, acceptance, release, deployment, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showImplementationReadinessGate(
  pool: EngineClientPool,
  input: unknown,
): Promise<ImplementationReadinessGateProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Implementation Readiness Gate inspection", "Initiative ID")
  const projection = await client.readImplementationReadinessGate(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Implementation Readiness Gate candidate", "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Exact dependencies: ${status.presentDependencyCount}/${status.dependencyCount}`,
    `Per-unit subjects: ${status.subjectCount} · ${status.satisfiedCount} satisfied · ${status.gapCount} gaps · ${status.conflictCount} conflicts`,
    `Candidate exceptions: ${status.waivedCandidateCount} waiver candidates · ${status.notAssessedCount} not assessed · ${status.staleCount} stale`,
    `Candidate integrity gaps: ${status.evidenceGapCount} evidence · ${status.ownershipGapCount} ownership · ${status.coverageGapCount} coverage`,
    `Candidate freshness gaps: ${status.staleBindingCount} stale bindings · ${status.staleDependencyCount} stale dependencies · ${status.invalidCandidateCount} invalid candidates · ${status.unresolvedQuestionCount} questions`,
    ...status.reasons.map((reason) => `  - ${reason}`), "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [`Dependency receipt digest: ${record.dependencyReceiptDigest}`, `Coverage receipt digest: ${record.coverageReceiptDigest}`,
      `Evidence receipt digest: ${record.evidenceReceiptDigest}`, `Ownership receipt digest: ${record.ownershipReceiptDigest}`,
      `Assessment receipt digest: ${record.assessmentReceiptDigest}`, `Candidate subjects: ${record.subjectCount} · ${record.reviewState}`, `Updated: ${record.updatedAt}`] : []), "",
    "Candidate identities, counts, statuses, and receipt digests only; no readiness rationale, evidence or review content, owner details, personal data, secret, credential, or machine path. Automated assessment does not establish artifact or evidence truth, completeness, approval, waiver, owner appointment, implementation readiness, assignment, execution, acceptance, release, deployment, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`, `Privacy boundary: ${projection.privacyBoundary}`, `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showChangedUnitInventory(
  pool: EngineClientPool,
  input: unknown,
): Promise<ChangedUnitInventoryProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Changed Unit Inventory inspection", "Initiative ID")
  const projection = await client.readChangedUnitInventory(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Changed Unit Inventory candidate", "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Exact dependencies: ${status.presentDependencyCount}/${status.dependencyCount}`,
    `Inventory coverage: ${status.inventoryUnitCount}/${status.sourceUnitCount} units · ${status.pathCandidateCount} repository-relative path candidates`,
    `Candidate outcomes: ${status.candidateScopedCount} scoped · ${status.gapCount} gaps · ${status.conflictCount} conflicts · ${status.staleCount} stale · ${status.notAssessedCount} not assessed`,
    `Trace and integrity gaps: ${status.traceGapCount} trace · ${status.evidenceGapCount} evidence · ${status.ownershipGapCount} ownership · ${status.blastRadiusGapCount} blast radius`,
    `Freshness gaps: ${status.staleBindingCount} bindings · ${status.staleDependencyCount} dependencies · ${status.invalidCandidateCount} invalid · ${status.unresolvedQuestionCount} questions`,
    ...status.reasons.map((reason) => `  - ${reason}`), "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [`Inventory receipt digest: ${record.inventoryReceiptDigest}`, `Trace receipt digest: ${record.traceReceiptDigest}`,
      `Blast-radius receipt digest: ${record.blastRadiusReceiptDigest}`, `Candidate units: ${record.units.length}`, `Updated: ${record.updatedAt}`] : []), "",
    "Repository-relative candidates, counts, statuses, and receipt digests only. This inspection does not establish repository or path truth, approved scope, code mutation, staging, assignment, acceptance, merge, release, deployment, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`, `Privacy boundary: ${projection.privacyBoundary}`, `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showProposedChangePreview(
  pool: EngineClientPool,
  input: unknown,
): Promise<ProposedChangePreviewProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Proposed Change Preview inspection", "Initiative ID")
  const projection = await client.readProposedChangePreview(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Proposed Change Preview candidate", "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Inventory coverage: ${status.previewUnitCount}/${status.inventoryUnitCount} units · ${status.previewPathCount}/${status.inventoryPathCount} paths`,
    `Candidate outcomes: ${status.candidatePreviewedCount} previewed · ${status.gapCount} gaps · ${status.conflictCount} conflicts · ${status.staleCount} stale · ${status.notAssessedCount} not assessed`,
    `Metadata gaps: ${status.endpointGapCount} endpoint · ${status.diffGapCount} diff · ${status.traceGapCount} trace · ${status.evidenceGapCount} evidence`,
    `Freshness gaps: ${status.staleBindingCount} bindings · ${status.staleInventoryCount} inventories · ${status.invalidCandidateCount} invalid · ${status.unresolvedQuestionCount} questions`,
    ...status.reasons.map((reason) => `  - ${reason}`), "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [`Plan receipt digest: ${record.planReceiptDigest}`, `Diff receipt digest: ${record.diffReceiptDigest}`,
      `Trace receipt digest: ${record.traceReceiptDigest}`, `Candidate units: ${record.units.length}`, `Updated: ${record.updatedAt}`] : []), "",
    "Repository-relative plan and source/target/diff metadata only; no file or diff content. This inspection does not establish repository truth, approved scope, mutation, staging, apply/discard, assignment, acceptance, merge, release, deployment, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`, `Privacy boundary: ${projection.privacyBoundary}`, `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showStagingWorkspace(
  pool: EngineClientPool,
  input: unknown,
): Promise<StagingWorkspaceProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Isolated Staging Workspace inspection", "Initiative ID")
  const projection = await client.readStagingWorkspace(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Isolated Staging Workspace candidate", "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Preview coverage: ${status.stagingUnitCount}/${status.previewUnitCount} units · ${status.stagingPathCount}/${status.previewPathCount} paths`,
    `Candidate outcomes: ${status.candidateDefinedCount} defined · ${status.unavailableCount} unavailable · ${status.gapCount} gaps · ${status.conflictCount} conflicts · ${status.staleCount} stale · ${status.notAssessedCount} not assessed`,
    `Safeguard gaps: ${status.inspectionGapCount} inspection · ${status.exclusionGapCount} exclusion · ${status.capacityGapCount} capacity · ${status.recoveryGapCount} recovery · ${status.evidenceGapCount} evidence`,
    `Freshness gaps: ${status.staleBindingCount} bindings · ${status.stalePreviewCount} previews · ${status.invalidCandidateCount} invalid · ${status.unresolvedQuestionCount} questions`,
    ...status.reasons.map((reason) => `  - ${reason}`), "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [`Portable identity: ${record.stagingIdentity.namespace}/${record.stagingIdentity.stageKey} · generation ${record.stagingIdentity.generation}`,
      `Lifecycle: ${record.lifecycle.definitionState} · actual stage ${record.lifecycle.actualStageExistenceState} · inspection ${record.lifecycle.inspectionState}`,
      `Capacity: ${record.capacity.candidateFileCount}/${record.capacity.maximumFiles} files · ${record.capacity.candidateByteCount}/${record.capacity.maximumBytes} bytes`,
      `Recovery: ${record.recovery.strategy} · ${record.recovery.replayState} · ${record.recovery.checkpointDigest}`,
      `Inspection receipt digest: ${record.inspectionReceiptDigest}`, `Candidate units: ${record.units.length}`, `Updated: ${record.updatedAt}`] : []), "",
    "Portable staging identity, repository-relative candidates, lifecycle, exclusion, capacity, inspection and recovery metadata only; no machine stage paths or file/diff content. This inspection does not establish real stage existence, repository truth, approved scope, mutation, apply/discard, assignment, acceptance, merge, release, deployment, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`, `Privacy boundary: ${projection.privacyBoundary}`, `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showDesignSystemTokenContract(
  pool: EngineClientPool,
  input: unknown,
): Promise<DesignSystemTokenContractProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Design System and Token Contract", "Initiative ID")
  const projection = await client.readDesignSystemTokenContract(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Design System and Token Contract candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState} · catalog: ${status.catalogCompletenessState}`,
    `Inventory: ${status.designSystemCount} systems · ${status.tokenCount} tokens · ${status.variableCollectionCount} collections · ${status.variableCount} variables · ${status.componentCount} components`,
    `Requirement coverage: ${status.representedRequirementCount} represented · ${status.unresolvedRequirementCount} unresolved`,
    `Candidate gaps: ${status.unresolvedOwnershipCount} ownership · ${status.unresolvedCatalogItemCount} catalog · ${status.accessibilityReviewGapCount} accessibility review · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.stalePortableSnapshotCount} stale portable snapshots · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate inventory: ${record.designSystemCount} systems · ${record.tokenCount} tokens · ${record.variableCollectionCount} collections · ${record.variableCount} variables · ${record.componentCount} components · ${record.representedRequirementCount} represented requirements · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and digests only; this does not establish system, token, variable, or component validity, ownership authority, accessibility validation, design approval, baseline, readiness, implementation, write, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showAccessibilityDesignRules(
  pool: EngineClientPool,
  input: unknown,
): Promise<AccessibilityDesignRulesProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Accessibility Design Rules", "Initiative ID")
  const projection = await client.readAccessibilityDesignRules(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Accessibility Design Rules candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState} · catalog: ${status.catalogCompletenessState}`,
    `Inventory: ${status.targetCount} targets · ${status.ruleCount} rules · ${status.checkCount} checks`,
    `Rule applicability: ${status.applicableRuleCount} applicable · ${status.notApplicableRuleCount} not applicable · ${status.unresolvedRuleCount} unresolved`,
    `Check evidence: ${status.humanReviewedCheckCount} human-reviewed · ${status.evidenceRecordedCheckCount} evidence-recorded · ${status.notAssessedCheckCount} not assessed · ${status.contradictedCheckCount} contradicted`,
    `Requirement coverage: ${status.representedRequirementCount} represented · ${status.unresolvedRequirementCount} unresolved`,
    `Candidate gaps: ${status.unresolvedOwnershipCount} ownership · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate inventory: ${record.targetCount} targets · ${record.ruleCount} rules · ${record.checkCount} checks · ${record.representedRequirementCount} represented requirements · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and digests only; this does not establish accessibility conformance, rule or check validity, legal compliance, ownership authority, design approval, baseline, readiness, implementation, write, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showResponsiveMultiPlatformTargets(
  pool: EngineClientPool,
  input: unknown,
): Promise<ResponsiveMultiPlatformTargetsProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Responsive and Multi-Platform Targets", "Initiative ID")
  const projection = await client.readResponsiveMultiPlatformTargets(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Responsive and Multi-Platform Targets candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Catalogs: targets ${status.targetCatalogState} · breakpoints ${status.breakpointCatalogState} · behaviors ${status.behaviorCatalogState}`,
    `Inventory: ${status.platformTargetCount} platform targets · ${status.breakpointCount} breakpoints · ${status.behaviorCount} behaviors · ${status.checkCount} checks`,
    `Behavior applicability: ${status.applicableBehaviorCount} applicable · ${status.unresolvedBehaviorCount} unresolved`,
    `Check evidence: ${status.humanReviewedCheckCount} human-reviewed · ${status.evidenceRecordedCheckCount} evidence-recorded · ${status.notAssessedCheckCount} not assessed · ${status.contradictedCheckCount} contradicted`,
    `Requirement coverage: ${status.representedRequirementCount} represented · ${status.unresolvedRequirementCount} unresolved`,
    `Candidate gaps: ${status.unresolvedOwnershipCount} ownership · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate inventory: ${record.platformTargetCount} platform targets · ${record.breakpointCount} breakpoints · ${record.behaviorCount} behaviors · ${record.checkCount} checks · ${record.representedRequirementCount} represented requirements · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and digests only; this does not establish responsive completeness, platform parity, breakpoint or behavior validity, accessibility conformance, ownership authority, design approval, baseline, readiness, implementation, write, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showManualFigmaExecutionPath(
  pool: EngineClientPool,
  input: unknown,
): Promise<ManualFigmaExecutionPathProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Manual Figma Execution Path", "Initiative ID")
  const projection = await client.readManualFigmaExecutionPath(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Manual Figma Execution Path candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Catalogs: guide ${status.guideCatalogState} · handoff ${status.handoffCatalogState} · return ${status.returnContractState}`,
    `Inventory: ${status.scopeCount} scopes · ${status.instructionCount} instruction stages · ${status.checkCount} checks`,
    `Check evidence: ${status.humanReviewedCheckCount} human-reviewed · ${status.evidenceRecordedCheckCount} evidence-recorded · ${status.notAssessedCheckCount} not assessed · ${status.contradictedCheckCount} contradicted`,
    `Requirement coverage: ${status.representedRequirementCount} represented · ${status.unresolvedRequirementCount} unresolved`,
    `Candidate gaps: ${status.unresolvedOwnershipCount} ownership · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate inventory: ${record.scopeCount} scopes · ${record.instructionCount} instruction stages · ${record.checkCount} checks · ${record.representedRequirementCount} represented requirements · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and digests only; this does not connect to Figma, prove execution or returned-design completeness, grant write authority, approve design, establish a baseline or readiness, or authorize implementation or action.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showFigmaMcpCapabilityDiscovery(
  pool: EngineClientPool,
  input: unknown,
): Promise<FigmaMcpCapabilityDiscoveryProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Figma MCP Capability Discovery", "Initiative ID")
  const projection = await client.readFigmaMcpCapabilityDiscovery(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Figma MCP Capability Discovery candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Catalogs: tools ${status.catalogState} · permissions ${status.permissionModelState} · limits ${status.limitCatalogState} · versions ${status.versionCatalogState}`,
    `Inventory: ${status.toolCount} tool observations · ${status.advertisedToolCount} advertised · ${status.unavailableToolCount} not advertised · ${status.unknownAvailabilityCount} unknown`,
    `Effects: ${status.readToolCount} read · ${status.writeToolCount} write · ${status.unknownEffectCount} unknown`,
    `Evidence: ${status.humanReviewedToolCount} human-reviewed · ${status.sourceRecordedToolCount} source-recorded · ${status.notAssessedToolCount} not assessed`,
    `Candidate gaps: ${status.unresolvedPermissionCount} permissions · ${status.unresolvedLimitCount} limits · ${status.unresolvedVersionCount} versions · ${status.unresolvedOwnershipCount} ownership · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate inventory: ${record.toolCount} tools · ${record.advertisedToolCount} advertised · ${record.readToolCount} read · ${record.writeToolCount} write · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and digests only; this does not connect to or call Figma, request credentials, grant permissions, establish live tool availability or compatibility, authorize writes, approve design, establish a baseline or readiness, or authorize implementation or action.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showFigmaReadSnapshot(
  pool: EngineClientPool,
  input: unknown,
): Promise<FigmaReadSnapshotProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Figma Read Snapshot", "Initiative ID")
  const projection = await client.readFigmaReadSnapshot(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Figma Read Snapshot candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Catalogs: snapshot ${status.snapshotCompletenessState} · provenance ${status.provenanceState}`,
    `Inventory: ${status.fileCount} files · ${status.componentCount} components · ${status.variableCollectionCount} variable collections · ${status.variableCount} variables`,
    `Evidence: ${status.humanReviewedItemCount} human-reviewed · ${status.sourceRecordedItemCount} source-recorded · ${status.notAssessedItemCount} not assessed`,
    `Freshness and type gaps: ${status.staleFileCount} stale at capture · ${status.unknownFreshnessFileCount} unknown freshness · ${status.unresolvedTypeCount} unresolved variable types`,
    `Candidate gaps: ${status.unresolvedOwnershipCount} ownership · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate inventory: ${record.fileCount} files · ${record.componentCount} components · ${record.variableCollectionCount} variable collections · ${record.variableCount} variables · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and digests only; this does not connect to or call Figma, request credentials, grant permissions, prove external completeness, authorize writes, validate or approve design, establish a baseline or readiness, or authorize implementation or action.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showFigmaContextImport(
  pool: EngineClientPool,
  input: unknown,
): Promise<FigmaContextImportProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Figma Context Import", "Initiative ID")
  const projection = await client.readFigmaContextImport(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Figma Context Import candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Selection: ${status.contextSelectionState} · provenance ${status.provenanceState} · preview ${status.previewState}`,
    `Inventory: ${status.contextPackCount} Context Packs · ${status.sectionCount} sections · ${status.contextItemCount} Context Items · ${status.targetCount} Figma targets`,
    `Evidence: ${status.humanReviewedSectionCount} human-reviewed · ${status.sourceRecordedSectionCount} source-recorded · ${status.notAssessedSectionCount} not assessed · ${status.unresolvedRedactionCount} redaction gaps`,
    `Requirement coverage: ${status.representedRequirementCount} represented · ${status.unresolvedRequirementCount} unresolved`,
    `Candidate gaps: ${status.unresolvedOwnershipCount} ownership · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Candidate inventory: ${record.contextPackCount} Context Packs · ${record.sectionCount} sections · ${record.contextItemCount} Context Items · ${record.targetCount} Figma targets · ${record.representedRequirementCount} represented Requirements · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and digests only; this does not package or transfer context, connect to or call Figma, request credentials, grant permissions, authorize or perform writes, validate targets or design, approve design, establish a baseline or readiness, or authorize implementation or action.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showOutboundDesignBriefPackage(
  pool: EngineClientPool,
  input: unknown,
): Promise<OutboundDesignBriefPackageProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Outbound Design Brief Package", "Initiative ID")
  const projection = await client.readOutboundDesignBriefPackage(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Outbound Design Brief Package candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Manifest: ${status.manifestState} · provenance ${status.provenanceState} · redaction ${status.redactionReviewState} · preview ${status.previewState}`,
    `Inventory: ${status.contextPackCount} Context Packs · ${status.entryCount} entries · ${status.contextItemCount} Context Items · ${status.recipientCount} recipients`,
    `Evidence: ${status.humanReviewedEntryCount} human-reviewed · ${status.sourceRecordedEntryCount} source-recorded · ${status.notAssessedEntryCount} not assessed · ${status.unresolvedRedactionCount} redaction gaps`,
    `Requirement coverage: ${status.representedRequirementCount} represented · ${status.unresolvedRequirementCount} unresolved · ${status.unresolvedDisclosureCount} unresolved disclosures`,
    `Candidate gaps: ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Manifest receipt: ${record.manifestFormat} · ${record.manifestDigest}`,
      `Payload receipt: ${record.payloadDigest}`,
      `Candidate inventory: ${record.contextPackCount} Context Packs · ${record.entryCount} entries · ${record.contextItemCount} Context Items · ${record.recipientCount} recipients · ${record.representedRequirementCount} represented Requirements · ${record.unresolvedDisclosureCount} unresolved disclosures · ${record.reviewState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and digests only; this does not materialize or transfer context, connect to or call Figma, request credentials, grant permissions, authorize or perform writes, validate targets or design, approve design, establish a baseline or readiness, or authorize implementation or action.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showGovernedFigmaWrite(
  pool: EngineClientPool,
  input: unknown,
): Promise<GovernedFigmaWriteProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Governed Figma Write", "Initiative ID")
  const projection = await client.readGovernedFigmaWrite(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP governed Figma Write authorization-review candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState} · plan ${status.writePlanState}`,
    `Governance: preview ${status.previewState} · approval ${status.approvalState} · permission evidence ${status.permissionEvidenceState}`,
    `Safety: idempotency ${status.idempotencyState} · replay ${status.replayProtectionState} · recovery ${status.recoveryPlanState}`,
    `Execution: ${status.writeExecutionState} · result ${status.writeResultState}`,
    `Candidate gaps: ${status.unresolvedDisclosureCount} disclosures · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Request receipt: ${record.requestFormat} · ${record.requestDigest}`,
      `Effect receipt: ${record.effectDigest}`,
      `Preview receipt: ${record.previewDigest ?? "not-generated"}`,
      `Package receipt: ${record.outboundPackage.recordId}@${record.outboundPackage.revision} · manifest ${record.outboundPackage.manifestDigest} · payload ${record.outboundPackage.payloadDigest}`,
      `Target receipts: file ${record.externalFileIdentityDigest} · expected version ${record.expectedExternalVersionDigest} · ${record.selectedEntryCount} selected entries`,
      `Candidate states: preview ${record.previewState} · approval ${record.approvalState} · permission evidence ${record.permissionEvidenceState} · idempotency ${record.idempotencyState} · recovery ${record.recoveryPlanState} · review ${record.reviewState} · execution ${record.writeExecutionState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and digests only; this does not materialize or transfer context, connect to or call Figma, request credentials, grant permissions, authorize or perform writes, validate targets or design, approve design, establish a baseline or readiness, or authorize implementation or action.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showFinalizedFigmaSnapshotImport(
  pool: EngineClientPool,
  input: unknown,
): Promise<FinalizedFigmaSnapshotImportProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Finalized Figma Snapshot Import", "Initiative ID")
  const projection = await client.readFinalizedFigmaSnapshotImport(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP finalized Figma Snapshot Import review candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Reconciliation: ${status.reconciliationState} · provenance ${status.provenanceState} · completeness ${status.snapshotCompletenessState}`,
    `Return authorization: ${status.returnAuthorizationState}`,
    `Inventory: ${status.itemCount} items · ${status.humanReviewedItemCount} human-reviewed · ${status.sourceRecordedItemCount} source-recorded · ${status.notAssessedItemCount} not assessed`,
    `Execution: ${status.importExecutionState} · result ${status.importResultState}`,
    `Candidate gaps: ${status.openConflictCount} open conflicts · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Governed write: ${record.governedWrite.recordId}@${record.governedWrite.revision} · request ${record.governedWrite.requestDigest} · effect ${record.governedWrite.effectDigest}`,
      `Return receipts: file ${record.externalFileIdentityDigest} · returned version ${record.returnedExternalVersionDigest} · payload ${record.payloadDigest} · receipt ${record.receiptDigest}`,
      `Reconciliation receipt: ${record.reconciliationDigest}`,
      `Candidate inventory: ${record.itemCount} items · ${record.conflictCount} conflicts · return authorization ${record.returnAuthorizationState} · reconciliation ${record.reconciliationState} · provenance ${record.provenanceState} · review ${record.reviewState} · execution ${record.importExecutionState}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, counts, statuses, and digests only; this does not transfer or import content, connect to or call Figma, request credentials, grant permissions, prove external completeness, validate targets or design, approve design, establish a baseline or readiness, or authorize implementation or action.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showDesignToRequirementBinding(
  pool: EngineClientPool,
  input: unknown,
): Promise<DesignToRequirementBindingProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Design-to-Requirement Binding", "Initiative ID")
  const projection = await client.readDesignToRequirementBinding(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP Design-to-Requirement Binding review candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate assessment: ${status.state} · review state: ${status.reviewState}`,
    `Governance: reconciliation ${status.reconciliationState} · candidate coverage ${status.candidateCoverageState} · provenance ${status.provenanceState}`,
    `Bindings: ${status.bindingCount} total · ${status.humanReviewedBindingCount} human-reviewed`,
    `Coverage: ${status.boundDesignItemCount}/${status.designItemCount} design items · ${status.boundRequirementCount}/${status.requirementCount} Requirements · ${status.boundDecisionCount}/${status.decisionCount} Decisions`,
    `Candidate gaps: ${status.unboundDesignItemCount} unbound design items · ${status.unboundRequirementCount} unbound Requirements · ${status.unboundDecisionCount} unbound Decisions · ${status.openConflictCount} open conflicts · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Finalized snapshot: ${record.finalizedSnapshot.recordId}@${record.finalizedSnapshot.revision} · catalog ${record.finalizedSnapshot.itemCatalogDigest}`,
      `Design Requirements: ${record.designRequirements.recordId}@${record.designRequirements.revision} · catalog ${record.designRequirements.requirementCatalogDigest}`,
      `Decision Register: ${record.decisionRegister.recordId}@${record.decisionRegister.revision} · catalog ${record.decisionRegister.decisionCatalogDigest}`,
      `Reconciliation receipt: ${record.reconciliationDigest}`,
      `Candidate inventory: ${record.bindingCount} bindings · ${record.designItemCoverageCount} design items · ${record.subjectCoverageCount} governed subjects · ${record.conflictCount} conflicts`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, exact dependency and catalog digests, counts, and statuses only; this does not prove relationship truth or coverage completeness, satisfy Requirements, establish Decision effectiveness or external completeness, validate or approve design, establish a baseline or readiness, connect to or call Figma, request credentials, grant permissions, execute imports or writes, or authorize implementation or action.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showDesignerReadyGate(
  pool: EngineClientPool,
  input: unknown,
): Promise<DesignerReadyGateProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Designer-Ready Gate", "Initiative ID")
  const projection = await client.readDesignerReadyGate(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP Designer-Ready Gate candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate result: ${status.candidateResult} · ${status.state} · review state: ${status.reviewState}`,
    `Coverage: ${status.satisfiedCount} satisfied · ${status.notApplicableCount} not-applicable candidates · ${status.humanReviewedCount}/${status.prerequisiteCount} human-reviewed`,
    `Candidate gaps: ${status.unsatisfiedCount} unsatisfied · ${status.notAssessedCount} not assessed · ${status.staleOrUnknownCount} stale/unknown · ${status.pendingExceptionCount} pending exceptions · ${status.invalidExceptionCount} invalid exceptions · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Prerequisites: ${record.prerequisiteCount} exact · ${record.prerequisiteCatalogDigest}`,
      `Assessment: definition ${record.assessmentDefinitionDigest} · receipt ${record.assessmentReceiptDigest} · evaluations ${record.evaluationCatalogDigest}`,
      `Exception catalog: ${record.exceptionCatalogDigest}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, exact digests, counts, and results only; a passing candidate is an evaluation result, not permission or readiness, and grants no completeness, validity, approval, baseline, exception, waiver, acceptance, phase-entry, Figma connection, credential, permission, import, write, implementation, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showDesignDelta(
  pool: EngineClientPool,
  input: unknown,
): Promise<DesignDeltaProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Design Delta", "Initiative ID")
  const projection = await client.readDesignDelta(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP Design Delta candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate result: ${status.candidateResult} · ${status.state} · review state: ${status.reviewState}`,
    `Compared inventory: ${status.sourceItemCount} source items · ${status.targetItemCount} target items · ${status.deltaCount} deltas`,
    `Deltas: ${status.addedCount} added · ${status.changedCount} changed · ${status.conflictingCount} conflicting · ${status.missingCount} missing · ${status.staleCount} stale · ${status.unmappedCount} unmapped · ${status.humanReviewedCount}/${status.deltaCount} human-reviewed`,
    `Comparison governance: comparison ${status.comparisonState} · provenance ${status.provenanceState}`,
    `Candidate gaps: ${status.unresolvedMappingCount} unresolved mappings · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Dependencies: Designer-Ready ${record.designerReadyGate.recordId}@${record.designerReadyGate.revision} · finalized snapshot ${record.finalizedSnapshot.recordId}@${record.finalizedSnapshot.revision} · design binding ${record.designBinding.recordId}@${record.designBinding.revision}`,
      `Snapshots: source ${record.sourceSnapshotDigest} · target ${record.targetSnapshotDigest}`,
      `Comparison: definition ${record.comparisonDefinitionDigest} · receipt ${record.comparisonReceiptDigest} · catalog ${record.deltaCatalogDigest}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, exact dependency, snapshot, comparison, receipt, catalog, counts, and results only; this comparison is observational and establishes no delta or external completeness, design validity, approval, baseline, readiness, conflict-resolution or synchronization authority, Figma connection, credential, permission, import, write, implementation, or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showDesignConflictResolution(
  pool: EngineClientPool,
  input: unknown,
): Promise<DesignConflictResolutionProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Design Conflict Resolution", "Initiative ID")
  const projection = await client.readDesignConflictResolution(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP Design Conflict Resolution candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate result: ${status.candidateResult} · ${status.state} · review state: ${status.reviewState}`,
    `Conflict inventory: ${status.conflictCount} conflicts · ${status.resolutionCount} resolution candidates`,
    `Candidate actions: ${status.acceptSourceCount} accept source · ${status.acceptTargetCount} accept target · ${status.mergeCount} merge · ${status.rejectChangeCount} reject change · ${status.escalateCount} escalate`,
    `Recorded review: ${status.humanReviewedCount}/${status.resolutionCount} human-reviewed · ${status.distinctActorDeclaredCount} distinct-actor declarations · ${status.expiredCandidateCount} expired`,
    `Candidate governance: coverage ${status.coverageState} · provenance ${status.provenanceState} · separation of duties not enforced`,
    `Candidate gaps: ${status.unresolvedConflictCount} unresolved conflicts · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Design Delta: ${record.designDelta.recordId}@${record.designDelta.revision} · ${record.designDelta.conflictingCount} conflicts · catalog ${record.designDelta.deltaCatalogDigest}`,
      `Resolution evidence: definition ${record.resolutionDefinitionDigest} · receipt ${record.resolutionReceiptDigest} · catalog ${record.resolutionCatalogDigest}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, exact Design Delta binding, receipts, catalog digests, counts, results, and recorded review states only; this view does not enforce separation of duties, resolve or apply conflicts, synchronize design, establish validity, approval, baseline, or readiness, call Figma, request credentials, grant permissions, execute imports or writes, or grant implementation or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showHumanDesignApproval(
  pool: EngineClientPool,
  input: unknown,
): Promise<HumanDesignApprovalProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Human Design Approval", "Initiative ID")
  const projection = await client.readHumanDesignApproval(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP Human Design Approval decision candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate result: ${status.candidateResult} · ${status.state} · review state: ${status.reviewState}`,
    `Prerequisites: ${status.completePrerequisiteCount}/${status.prerequisiteCount} complete`,
    `Recorded decisions: ${status.decisionCount} total · ${status.approveCount} approve · ${status.rejectCount} reject · ${status.requestChangeCount} request change · ${status.abstainCount} abstain`,
    `Decision lifecycle: ${status.expiredDecisionCount} expired · ${status.revokedDecisionCount} revoked`,
    `Candidate governance: approver authority ${status.approverAuthorityState} · separation enforcement ${status.separationOfDutiesEnforcementState}`,
    `Candidate gaps: ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Approval subject: ${record.subject.recordId}@${record.subject.revision} · returned version ${record.subject.returnedExternalVersionDigest} · ${record.subject.itemCount} items`,
      `Scope digest: ${record.scopeDigest}`,
      `Decision evidence: definition ${record.decisionDefinitionDigest} · receipt ${record.decisionReceiptDigest}`,
      `Recorded decision: ${record.decisionKind ? `${record.decisionKind} · ${record.decisionLifecycleState} · ${record.decisionDigest}` : "not recorded"}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, exact prerequisite and finalized-snapshot bindings, scope and receipt digests, decision kind, lifecycle, counts, and recorded states only; this view does not verify approver authority, enforce separation of duties, establish design approval, baseline, readiness, or phase entry, call Figma, request credentials, grant permissions, execute imports or writes, or grant implementation or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showDesignBaseline(
  pool: EngineClientPool,
  input: unknown,
): Promise<DesignBaselineProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Design Baseline", "Initiative ID")
  const projection = await client.readDesignBaseline(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP Design Baseline version candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate result: ${status.candidateResult} · ${status.state} · review state: ${status.reviewState}`,
    `Candidate inventory: ${status.candidateSetCount} set · ${status.designationCandidateCount} designation · ${status.supersessionCandidateCount} supersession · ${status.withdrawalCandidateCount} withdrawal · ${status.restorationCandidateCount} restoration`,
    `Candidate governance: approval determination ${status.approvalDeterminationState} · baseline designation ${status.baselineDesignationState}`,
    `Candidate gaps: ${status.expiredDesignationCount} expired · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Approval candidate: ${record.humanDesignApproval.recordId}@${record.humanDesignApproval.revision} · ${record.humanDesignApproval.assessmentState}`,
      `Design subject: ${record.subject.recordId}@${record.subject.revision} · returned version ${record.subject.returnedExternalVersionDigest} · ${record.subject.itemCount} items`,
      `Scope digest: ${record.scopeDigest}`,
      `Lineage: ${record.baselineLineageId} · candidate set ${record.candidateSetId}@${record.candidateSetRevision}`,
      `Version: ${record.semanticVersion} · policy ${record.versionPolicyDigest}`,
      `Designation evidence: definition ${record.designationDefinitionDigest} · receipt ${record.designationReceiptDigest}`,
      `Designation candidate: ${record.designationKind ? `${record.designationKind} · ${record.designationDigest}` : "not proposed"}`,
      `Exact predecessor: ${record.supersedes ? `${record.supersedes.recordId}@${record.supersedes.revision} · ${record.supersedes.semanticVersion}` : "initial candidate"}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Candidate identities, exact Human Design Approval and finalized-snapshot bindings, version axes, lineage, scope and receipt digests, designation kind, predecessor, counts, and recorded states only; this view does not convert an approval candidate into approval, verify approver authority, enforce separation of duties, establish a Baseline Set designation, readiness, or phase entry, call Figma, request credentials, grant permissions, execute imports or writes, or grant implementation or action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function showDesignDriftDetection(
  pool: EngineClientPool,
  input: unknown,
): Promise<DesignDriftDetectionProjection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for Design Drift Detection", "Initiative ID")
  const projection = await client.readDesignDriftDetection(initiativeId)
  const status = projection.status
  const record = projection.candidate
  const lines = [
    "GAEP Design Drift Detection candidate",
    "",
    `Initiative: ${projection.initiative.id} · revision ${projection.initiative.revision} · ${projection.initiative.state}`,
    `Candidate result: ${status.candidateResult} · ${status.state} · review state: ${status.reviewState}`,
    `Implementation targets: ${status.humanReviewedImplementationTargetCount}/${status.implementationTargetCount} human-reviewed`,
    `Comparison paths: ${status.requirementToDesignCount} requirement-to-design · ${status.designToImplementationCount} design-to-implementation`,
    `Classifications: ${status.conformantCount} conformant · ${status.driftCount} drift · ${status.unassessedCount} unassessed`,
    `Severity: ${status.blockerCount} blocker · ${status.highSeverityCount} high`,
    `Remediation candidates: ${status.remediationCandidateCount} recorded · ${status.expiredRemediationCandidateCount} expired · effects not applied`,
    `Candidate gaps: ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
    ...status.reasons.map((reason) => `  - ${reason}`),
    "",
    `Candidate record: ${record ? `${record.id}@${record.revision} · ${record.state} · ${record.digest}` : "not recorded"}`,
    ...(record ? [
      `Membership digest: ${record.membershipDigest}`,
      `Baseline candidate: ${record.designBaseline.recordId}@${record.designBaseline.revision} · ${record.designBaseline.semanticVersion} · designation ${record.designBaseline.baselineDesignationState}`,
      `Returned design: ${record.returnedFigmaSnapshot.recordId}@${record.returnedFigmaSnapshot.revision} · returned version ${record.returnedFigmaSnapshot.returnedExternalVersionDigest}`,
      `Design Requirements: ${record.designRequirements.recordId}@${record.designRequirements.revision} · ${record.designRequirements.requirementCatalogDigest}`,
      `Design trace: ${record.designTrace.recordId}@${record.designTrace.revision} · ${record.designTrace.reconciliationDigest}`,
      `Implementation target catalog: revision ${record.implementationTargetCatalogRevision} · ${record.implementationTargetCatalogDigest}`,
      `Comparison: policy ${record.comparisonPolicyDigest} · receipt ${record.comparisonDigest}`,
      `Updated: ${record.updatedAt}`,
    ] : []),
    "",
    "Exact candidate identities, version axes, catalog and comparison digests, counts, classifications, severities, review state, and non-effect status only; this view does not establish an actual Baseline Set, drift completeness, external completeness, design or implementation validity, approval, readiness, remediation effect, call Figma, import or write content, change implementation, or grant action authority.",
    `Snapshot digest: ${projection.snapshotDigest}`,
    `Privacy boundary: ${projection.privacyBoundary}`,
    `Authority boundary: ${projection.authorityBoundary}`,
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return projection
}

async function importPortableDesign(pool: EngineClientPool): Promise<PortableDesignSnapshotSummary> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const actorId = normalizeActorId(machineSetting("actorId", undefined, "gaep.kiro-local-human"))
  const client = await pool.get(folder.uri.fsPath)
  const initial = await client.readProduct()

  const selected = await vscode.window.showOpenDialog({
    title: "Select one local portable design bundle folder",
    openLabel: "Select Local Bundle Folder",
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
  })
  const source = selected?.[0]
  if (!source) throw new WorkflowCancelled()
  if (source.scheme !== "file") {
    throw new ConfigurationBoundaryError(
      "Select one existing local folder. Files, archives, remote URLs, external accounts, and live design-tool connections are not supported.",
    )
  }
  const bundleRoot = await normalizeExistingLocalFolder(source.fsPath)
  await assertExactContext(folder, client, initial)
  const confirmation = await vscode.window.showWarningMessage(
    `Import one local bundle into ${initial.name} at exact Product revision ${initial.revision}? Only validated metadata and digests are retained, and the result remains pending human review even when upstream sourceReview says approved.`,
    { modal: true },
    "Import as Pending Review",
  )
  if (confirmation !== "Import as Pending Review") throw new WorkflowCancelled()
  await assertExactContext(folder, client, initial)
  const snapshot = await client.importPortableDesignSnapshot({
    bundleRoot,
    expectedProductId: initial.id,
    expectedProductRevision: initial.revision,
    actorId,
  })
  await vscode.window.showInformationMessage(importAnnouncement(snapshot))
  return snapshot
}

async function listPortableDesign(pool: EngineClientPool, input: unknown): Promise<PortableDesignSnapshotPage> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  if (input !== undefined && !isRecord(input)) throw new TypeError("Portable-design list input must be an object")
  const record = isRecord(input) ? input : {}
  if (Object.keys(record).some((key) => key !== "offset" && key !== "limit")) {
    throw new TypeError("Portable-design list input accepts only offset and limit")
  }
  if ((Object.hasOwn(record, "offset") && typeof record.offset !== "number") ||
    (Object.hasOwn(record, "limit") && typeof record.limit !== "number")) {
    throw new TypeError("Portable-design offset and limit must be integers")
  }
  const offset = typeof record.offset === "number" ? record.offset : 0
  const limit = typeof record.limit === "number" ? record.limit : 50
  validatePage(offset, limit)
  const page = await (await pool.get(folder.uri.fsPath)).listPortableDesignSnapshots(offset, limit)
  if (page.items.length === 0) {
    await vscode.window.showInformationMessage(`No portable-design snapshots were found on metadata page ${offset}–${offset + limit - 1}.`)
    return page
  }
  const selected = await vscode.window.showQuickPick(
    page.items.map((summary) => ({
      label: summary.title,
      description: `${summary.classification} · ${summary.governance.state}`,
      detail: `${summary.bundleId} · upstream ${summary.sourceReview.status} claim`,
      summary,
    })),
    {
      title: `Portable-design metadata (${page.items.length} of ${page.total})`,
      placeHolder: "Select one metadata-only snapshot to inspect; dismiss to keep the list unchanged",
      ignoreFocusOut: true,
    },
  )
  if (selected) await showSnapshotDocument(selected.summary)
  return page
}

async function readPortableDesign(pool: EngineClientPool, input: unknown): Promise<PortableDesignSnapshotSummary> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  if (input !== undefined && typeof input !== "string" && !isRecord(input)) {
    throw new TypeError("Portable-design read input must be a bundle UUID or object")
  }
  if (isRecord(input) && Object.keys(input).some((key) => key !== "bundleId")) {
    throw new TypeError("Portable-design read input accepts only bundleId")
  }
  let requestedId = typeof input === "string"
    ? input
    : isRecord(input) && typeof input.bundleId === "string"
      ? input.bundleId
      : undefined
  if (!requestedId) {
    const page = await client.listPortableDesignSnapshots(0, 200)
    const selected = await vscode.window.showQuickPick(
      page.items.map((summary) => ({
        label: summary.title,
        description: summary.bundleId,
        detail: `${summary.governance.state} · upstream ${summary.sourceReview.status} claim`,
        bundleId: summary.bundleId,
      })),
      { title: "Read one exact portable-design snapshot", ignoreFocusOut: true },
    )
    requestedId = selected?.bundleId
  }
  if (!requestedId) throw new WorkflowCancelled()
  const bundleId = normalizeUuid(requestedId, "Bundle ID")
  const summary = await client.readPortableDesignSnapshot(bundleId)
  await showSnapshotDocument(summary)
  return summary
}

async function showSnapshotDocument(summary: PortableDesignSnapshotSummary): Promise<void> {
  const document = await vscode.workspace.openTextDocument({
    language: "json",
    content: `${JSON.stringify(summary, null, 2)}\n`,
  })
  await vscode.window.showTextDocument(document, { preview: true })
}

async function showAgentReadiness(pool: EngineClientPool): Promise<readonly AgentReadinessSnapshot[]> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const snapshots = await (await pool.get(folder.uri.fsPath)).probeAgentReadiness()
  const content = [
    "GAEP Codex and Claude readiness",
    "",
    "Observation only: this view cannot select a model, change settings, start an agent, resume work, or grant execution authority.",
    "Only verified, path-free capability metadata is shown. Executable paths, provider credentials, and raw engine output are withheld.",
    "",
    ...snapshots.flatMap(renderAgentReadiness),
  ].join("\n")
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${content}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return snapshots
}

async function selectAgent(pool: EngineClientPool): Promise<AgentSelection> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const current = await client.readAgentSelection()
  if (current.status === "migration-required") {
    throw new ConfigurationBoundaryError(
      "The existing legacy Agent Selection requires explicit migration review. Kiro will not overwrite it implicitly.",
    )
  }
  if (current.status === "invalid") {
    throw new ConfigurationBoundaryError(
      "The existing Agent Selection is invalid. Repair or review the governed record before selecting another agent.",
    )
  }

  const target = await collectAgentTarget(client, "Select one verified local agent adapter")
  const actorId = normalizeActorId(machineSetting("actorId", undefined, "gaep.kiro-local-human"))
  const prior = current.status === "selected"
    ? ` Current selection: ${current.selection.agentId} / ${current.selection.modelId}.`
    : ""
  const confirmation = await vscode.window.showWarningMessage(
    `Record ${target.snapshot.agentLabel} / ${target.modelId} with ${Object.keys(target.settings).length} explicit portable setting${Object.keys(target.settings).length === 1 ? "" : "s"}?${prior} This does not start a provider, create or resume a Run, approve tools or effects, or grant execution authority. The engine will reject active-Run, capability-drift, legacy, invalid, and post-Run changes that require a handoff.`,
    { modal: true },
    "Confirm Selection",
  )
  if (confirmation !== "Confirm Selection") throw new WorkflowCancelled()
  requireTrustedWorkspace()
  const selected = await client.selectAgent({
    adapterId: target.snapshot.adapterId,
    modelId: target.modelId,
    settings: target.settings,
    actorId,
  })
  await showAgentSelectionDocument(selected)
  await vscode.window.showInformationMessage(
    `Recorded ${selected.agentId} / ${selected.modelId} as portable Agent Selection. No agent was started and no Run authority was granted.`,
  )
  return selected
}

async function handoffAgent(pool: EngineClientPool): Promise<AgentHandoff> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const current = await client.readAgentSelection()
  if (current.status === "unselected") {
    throw new ConfigurationBoundaryError("No prior Agent Selection exists. Use guarded selection before creating Runs or handoffs.")
  }
  if (current.status === "migration-required") {
    throw new ConfigurationBoundaryError(
      "The existing legacy Agent Selection requires explicit migration review before a versioned handoff.",
    )
  }
  if (current.status === "invalid") {
    throw new ConfigurationBoundaryError(
      "The existing Agent Selection is invalid. Repair or review the governed record before creating a handoff.",
    )
  }

  const runs = await client.listRuns()
  const active = runs.filter((run) => !isTerminalRun(run))
  if (active.length > 0) {
    throw new ConfigurationBoundaryError(
      `A versioned handoff cannot be created while ${active.length} Run${active.length === 1 ? " is" : "s are"} non-terminal. Stop, cancel, or reconcile the Run first.`,
    )
  }
  const sourceRun = runs[0]
  if (!sourceRun) {
    throw new ConfigurationBoundaryError("No prior terminal Run exists to bind as the source of a versioned handoff.")
  }
  if (!samePortableBinding(sourceRun.agent, current.selection)) {
    throw new ConfigurationBoundaryError(
      "The latest terminal Run is not bound to the current Agent Selection. Refresh or reconcile governed state before handing off.",
    )
  }

  const target = await collectAgentTarget(client, "Select the target for a versioned handoff")
  if (samePortableBinding(current.selection, {
    adapterId: target.snapshot.adapterId,
    modelId: target.modelId,
    settings: target.settings,
  })) {
    throw new ConfigurationBoundaryError(
      "The handoff target is identical to the current portable Agent Selection. Choose a different adapter, model, or setting.",
    )
  }

  const reason = await collectHandoffText("Why is this provider, model, or setting switch required?", true)
  const completedWork = await collectHandoffList("Completed work to preserve, separated by commas")
  const unresolvedMatters = await collectHandoffList("Unresolved matters to preserve, separated by commas")
  const decisions = await collectHandoffList("Decisions to preserve, separated by commas")
  const evidence = await collectHandoffList("Portable evidence references to preserve, separated by commas")
  if (completedWork.length === 0 && unresolvedMatters.length === 0 && decisions.length === 0 && evidence.length === 0) {
    throw new ConfigurationBoundaryError(
      "Record at least one completed-work, unresolved-matter, decision, or portable evidence entry before creating a handoff.",
    )
  }

  const confirmation = await vscode.window.showWarningMessage(
    [
      `Create a versioned handoff from terminal Run ${sourceRun.id}?`,
      `Prior selection: ${current.selection.agentId} / ${current.selection.modelId}.`,
      `Target selection: ${target.snapshot.agentLabel} / ${target.modelId} with ${Object.keys(target.settings).length} explicit portable setting${Object.keys(target.settings).length === 1 ? "" : "s"}.`,
      `Preserved entries: ${completedWork.length} completed, ${unresolvedMatters.length} unresolved, ${decisions.length} decisions, ${evidence.length} evidence.`,
      "The engine will atomically record the handoff and replace Agent Selection only after fresh capability verification. It will not start or resume a provider, create a Run, approve tools or effects, or grant execution authority.",
    ].join("\n\n"),
    { modal: true },
    "Create Handoff and Switch",
  )
  if (confirmation !== "Create Handoff and Switch") throw new WorkflowCancelled()
  requireTrustedWorkspace()

  const [freshSelection, freshRuns] = await Promise.all([client.readAgentSelection(), client.listRuns()])
  const freshSource = freshRuns[0]
  if (freshSelection.status !== "selected" || !sameExactSelection(freshSelection.selection, current.selection) ||
    freshRuns.some((run) => !isTerminalRun(run)) || !freshSource || freshSource.id !== sourceRun.id ||
    !samePortableBinding(freshSource.agent, current.selection)) {
    throw new ConfigurationBoundaryError(
      "Agent Selection or Run history changed while the handoff form was open. No handoff was requested; reopen the flow and review fresh state.",
    )
  }

  const actorId = normalizeActorId(machineSetting("actorId", undefined, "gaep.kiro-local-human"))
  const handoff = await client.createHandoff({
    fromRunId: sourceRun.id,
    productId: sourceRun.productId,
    initiativeId: sourceRun.initiativeId,
    toAdapterId: target.snapshot.adapterId,
    toAgentId: target.snapshot.agentId,
    toModelId: target.modelId,
    toSettings: target.settings,
    reason,
    completedWork,
    unresolvedMatters,
    decisions,
    evidence,
    actorId,
  })
  await showAgentHandoffDocument(handoff)
  await vscode.window.showInformationMessage(
    `Recorded versioned handoff ${handoff.id} and switched portable Agent Selection to ${handoff.toAgent.agentId} / ${handoff.toAgent.modelId}. No provider was started and no Run authority was granted.`,
  )
  return handoff
}

async function runManagedReadOnly(pool: EngineClientPool): Promise<ManagedReadOnlyReceipt> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const charterId = await collectUuid("Enter the exact confirmed Execution Charter UUID", "Charter ID")
  const workflowPlanId = await collectUuid("Enter the Workflow Plan UUID bound by that Charter", "Workflow Plan ID")
  const preview = await client.previewManagedReadOnly(charterId, workflowPlanId)
  await showManagedReadOnlyPreview(preview)

  const confirmation = await vscode.window.showWarningMessage(
    [
      `Attest and execute exact preview ${preview.previewDigest}?`,
      `Provider binding: ${preview.agentId} / ${preview.modelId}; strategy: ${preview.strategy}; steps: ${preview.stepIds.length}; gates: ${preview.gates.length}.`,
      `Read-only envelope: ${preview.readScopeCount} declared read scope${preview.readScopeCount === 1 ? "" : "s"}; every Tool permission is denied; write scopes and non-observation effects are forbidden.`,
      "This is one bounded local request with a 120-second timeout. Kiro cannot interactively cancel or resume it over this stdio surface. If any staged change appears, GAEP attempts to discard it and withholds a success receipt.",
      "Provider completion and governed outcome satisfaction are separate receipt fields. Neither grants approval, implementation readiness, release readiness, or future Run authority.",
    ].join("\n\n"),
    { modal: true },
    "Attest Exact Preview and Run",
  )
  if (confirmation !== "Attest Exact Preview and Run") throw new WorkflowCancelled()
  requireTrustedWorkspace()
  const actorId = normalizeActorId(machineSetting("actorId", undefined, "gaep.kiro-local-human"))
  const receipt = await client.executeManagedReadOnly({ preview, timeoutMs: 120_000, actorId })
  await showManagedReadOnlyReceipt(receipt)
  await vscode.window.showInformationMessage(
    `Managed read-only Run ${receipt.managedRunId} ended ${receipt.state}; provider=${receipt.providerDisposition}; outcome=${receipt.outcomeStatus}. No Tool, write, or non-observation effect authority was granted.`,
  )
  return receipt
}

async function collectUuid(prompt: string, label: string): Promise<string> {
  const value = await vscode.window.showInputBox({
    prompt,
    ignoreFocusOut: true,
    validateInput: (candidate) => {
      try {
        normalizeUuid(candidate, label)
        return undefined
      } catch {
        return `${label} must be a non-empty UUID`
      }
    },
  })
  if (value === undefined) throw new WorkflowCancelled()
  return normalizeUuid(value, label)
}

async function showManagedReadOnlyPreview(preview: ManagedReadOnlyPreview): Promise<void> {
  const lines = [
    "GAEP managed read-only execution preview",
    "",
    `Preview digest: ${preview.previewDigest}`,
    `Charter: ${preview.charterId} (${preview.charterDigest})`,
    `Workflow Plan: ${preview.workflowPlanId} (${preview.workflowPlanDigest})`,
    `Provider: ${preview.adapterId} / ${preview.agentId} / ${preview.modelId}`,
    `Strategy: ${preview.strategy}`,
    `Workflow steps: ${preview.stepIds.length}`,
    `Context packs: ${preview.contextPackCount}`,
    `Declared read scopes: ${preview.readScopeCount}`,
    "",
    "Exact attestation gates:",
    ...preview.gates.flatMap((gate) => [
      `- ${gate.key} [${gate.phase}]${gate.stepId ? ` step=${gate.stepId}` : ""} digest=${gate.criteriaDigest}`,
      ...gate.criteria.map((criterion) => `    - ${criterion}`),
    ]),
    "",
    "Authority boundary: this preview grants no execution, Tool, write, effect, outcome, approval, or release authority.",
    "Dismiss the next modal to cancel by default.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
}

async function showManagedReadOnlyReceipt(receipt: ManagedReadOnlyReceipt): Promise<void> {
  const lines = [
    "GAEP managed read-only execution receipt",
    "",
    `Managed Run: ${receipt.managedRunId}`,
    `Governed Run: ${receipt.runId}`,
    `Attested preview: ${receipt.previewDigest}`,
    `Provider: ${receipt.adapterId} / ${receipt.agentId} / ${receipt.modelId}`,
    `Mode: ${receipt.mode}`,
    `Terminal state: ${receipt.state}`,
    `Provider disposition: ${receipt.providerDisposition}`,
    `Governed outcome: ${receipt.outcomeStatus} (${receipt.outcomeBasis})`,
    `Workflow completion: ${receipt.completedStepCount}/${receipt.totalStepCount}`,
    `Evidence events: ${receipt.eventCount}`,
    `Result digest: ${receipt.resultDigest}`,
    `Evidence digest: ${receipt.evidenceDigest}`,
    `Started: ${receipt.startedAt}`,
    `Ended: ${receipt.endedAt}`,
    `Warnings: ${receipt.warnings.length === 0 ? "none" : receipt.warnings.join(", ")}`,
    "",
    "Boundary: provider completion does not equal governed outcome satisfaction. This receipt grants no Tool, write, effect, approval, implementation-readiness, release-readiness, or future Run authority.",
    "Raw provider output, prompts, context content, executable paths, process state, workspace paths, and credentials are withheld.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
}

async function showManagedEvidenceDashboard(pool: EngineClientPool): Promise<ManagedRunSummaryPage> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const firstPage = await client.listManagedEvidence(0, 100)
  const pages = [firstPage]
  while (true) {
    const page = pages.at(-1)!
    await showManagedEvidencePage(page)
    if (page.items.length === 0) {
      void vscode.window.showInformationMessage("No Managed Runs exist in the verified bounded inventory.")
      return page
    }
    const choices: Array<vscode.QuickPickItem & {
      readonly action: "read" | "next" | "previous"
      readonly managedRunId?: string
    }> = page.items.map((item) => ({
      label: `${item.state} · ${item.mode}`,
      description: item.managedRunId,
      detail: `${item.agentId} / ${item.modelId} · updated ${item.updatedAt} · ${item.hasResult ? "bound result" : "record only"}`,
      managedRunId: item.managedRunId,
      action: "read" as const,
    }))
    if (pages.length > 1) {
      choices.unshift({
        label: "$(arrow-left) Previous verified page",
        description: `Return to offset ${pages.at(-2)!.offset}`,
        action: "previous",
      })
    }
    if (page.hasMore) {
      choices.push({
        label: "$(arrow-right) Next verified page",
        description: `Continue at offset ${page.offset + page.items.length} under the same snapshot`,
        action: "next",
      })
    }
    const selected = await vscode.window.showQuickPick(choices, {
      title: `Managed Run evidence (${page.offset + 1}-${page.offset + page.items.length} of ${page.total}; ${page.omittedCount} outside this page)`,
      placeHolder: "Read one exact Run, navigate the verified snapshot, or dismiss to keep this observation-only",
      ignoreFocusOut: true,
    })
    if (!selected) return page
    if (selected.action === "previous") {
      pages.pop()
      continue
    }
    if (selected.action === "next") {
      pages.push(await client.listManagedEvidence(
        page.offset + page.items.length,
        page.limit,
        firstPage.snapshotDigest,
        firstPage.total,
      ))
      continue
    }
    await showManagedEvidenceDetail(await client.readManagedEvidence(selected.managedRunId!))
    return page
  }
}

async function showPhaseDashboard(pool: EngineClientPool): Promise<PhaseDashboardFramework> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const product = await client.readProduct()
  const dashboard = await client.readPhaseDashboard(product, "phase-0-1a-foundation")
  const lines = [
    "GAEP phase-scoped dashboard framework",
    "",
    `Delivery phase: ${dashboard.phase.label}`,
    `Exact Product revision: ${dashboard.product.revision}`,
    `Product digest: ${dashboard.product.digest}`,
    `Composition digest: ${dashboard.compositionDigest}`,
    `Observed: ${dashboard.observedAt}`,
    `Source: ${dashboard.sourceBoundary}`,
    `Evidence freshness: ${dashboard.evidenceCues.freshness}`,
    "Confidence: not assessed; no governed confidence evaluation is bound.",
    "",
    ...dashboard.panels.map((panel) =>
      `${panel.title} · ${panel.role} · applicability=${panel.applicability.status} (${panel.applicability.basis}) · state=${panel.state}`),
    "",
    ...dashboard.limitations.map((limitation) => `Limit: ${limitation}`),
    "",
    "Boundary: this is a read-only governed-state projection. It grants no mutation, applicability, phase-entry, approval, readiness, acceptance, release, Run, Tool, or effect authority.",
    "Product text, source bytes, local paths, provider output, prompts, executable state, and credentials are withheld.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return dashboard
}

async function showPhase2UxFigmaDashboard(pool: EngineClientPool, input: unknown): Promise<Phase2UxFigmaDashboard> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Phase 2 UX and Figma dashboard", "Initiative ID")
  const [product, initiative] = await Promise.all([client.readProduct(), client.readInitiative(initiativeId)])
  const dashboard = await client.readPhase2UxFigmaDashboard(product, initiative)
  const lines = [
    "GAEP exact Phase 2 UX and Figma dashboard",
    "",
    `Initiative: ${dashboard.initiative.recordId} · revision ${dashboard.initiative.revision} · ${dashboard.initiative.state}`,
    `Phase state: ${dashboard.phaseStatus.state}`,
    `Sources: ${dashboard.phaseStatus.currentSourceCount} current · ${dashboard.phaseStatus.attentionRequiredSourceCount} attention-required · ${dashboard.phaseStatus.unavailableSourceCount} unavailable · ${dashboard.phaseStatus.expectedSourceCount} expected`,
    `Experience: ${dashboard.experience.personaCount} personas · ${dashboard.experience.designRoleCount} design roles · ${dashboard.experience.journeyCount} journeys · ${dashboard.experience.screenCount} screens · ${dashboard.experience.stateCount} states`,
    `Design system: ${dashboard.designSystem.requirementCount} requirements · ${dashboard.designSystem.tokenCount} tokens · ${dashboard.designSystem.componentCount} components · ${dashboard.designSystem.accessibilityRuleCount} accessibility rules`,
    `Figma and trace: ${dashboard.figma.fileCount} files · ${dashboard.figma.componentCount} components · ${dashboard.figma.variableCount} variables · ${dashboard.figma.designBindingCount} bindings · connection ${dashboard.figma.connectionState} · write ${dashboard.figma.writeExecutionState} · import ${dashboard.figma.importExecutionState}`,
    `Drift: ${dashboard.drift.observationCount} observations · ${dashboard.drift.conformantCount} conformant · ${dashboard.drift.driftCount} drift · ${dashboard.drift.unassessedCount} unassessed · ${dashboard.drift.remediationCandidateCount} remediation candidates`,
    `Freshness: ${dashboard.freshness.state} · ${dashboard.freshness.staleBindingCount} stale bindings · ${dashboard.freshness.staleSourceReferenceCount} stale sources · ${dashboard.freshness.unresolvedQuestionCount} questions`,
    "Product Owner acceptance: not established · approval: not established · Baseline Set designation: not established · readiness and phase-entry authority: not established",
    `Snapshot digest: ${dashboard.snapshotDigest}`,
    `Source catalog digest: ${dashboard.phaseStatus.sourceCatalogDigest}`,
    `Source: ${dashboard.sourceBoundary}`,
    `Privacy: ${dashboard.privacyBoundary}`,
    "",
    ...dashboard.sources.map((source) =>
      `${source.title} · ${source.group} · ${source.availability} · ${source.assessment?.state ?? "no state inferred"}`),
    "",
    ...dashboard.limitations.map((limitation) => `Limit: ${limitation}`),
    "",
    "Boundary: this derived read-only view is not a second source of truth and grants no completeness, validity, approval, baseline, readiness, phase-entry, Figma, remediation, implementation, release, or action authority.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return dashboard
}

async function showPhase2ChangeImpactAgentModelDashboard(
  pool: EngineClientPool,
  input: unknown,
): Promise<Phase2ChangeImpactAgentModelDashboard> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Phase 2 Change, Impact, Agent and Model dashboard", "Initiative ID")
  const [product, initiative] = await Promise.all([client.readProduct(), client.readInitiative(initiativeId)])
  const dashboard = await client.readPhase2ChangeImpactAgentModelDashboard(product, initiative)
  const lines = [
    "GAEP exact Phase 2 Change, Impact, Agent and Model dashboard",
    "",
    `Initiative: ${dashboard.initiative.recordId}@${dashboard.initiative.revision} · ${dashboard.initiative.state}`,
    `Synchronization: ${dashboard.synchronizationChange.state} · design delta ${dashboard.synchronizationChange.designDelta} · conflicts ${dashboard.synchronizationChange.conflictResolution} · human approval ${dashboard.synchronizationChange.humanDesignApproval} · baseline ${dashboard.synchronizationChange.designBaseline} · drift ${dashboard.synchronizationChange.designDriftDetection}`,
    `Synchronization effects: ${dashboard.synchronizationChange.synchronizationEffectState} · Figma connection ${dashboard.synchronizationChange.figmaConnectionState} · write ${dashboard.synchronizationChange.figmaWriteExecutionState} · import ${dashboard.synchronizationChange.figmaImportExecutionState}`,
    `Bounded impact: ${dashboard.impact.state} · ${dashboard.impact.requirementCount} requirements · ${dashboard.impact.designBindingCount} bindings · ${dashboard.impact.unboundDesignItemCount} unbound items · ${dashboard.impact.driftCount} drift · ${dashboard.impact.unassessedCount} unassessed`,
    `Impact boundary: ${dashboard.impact.coverage} · completeness ${dashboard.impact.impactCompleteness} · design validity ${dashboard.impact.designValidity} · revalidation ${dashboard.impact.revalidationState}`,
    `Capabilities: ${dashboard.agentModel.capabilities.shown}/${dashboard.agentModel.capabilities.total} shown · ${dashboard.agentModel.capabilities.detected} detected · ${dashboard.agentModel.capabilities.selected} selected · selection ${dashboard.agentModel.selectionState}`,
    `Runs: ${dashboard.agentModel.runs.shown}/${dashboard.agentModel.runs.total} shown · ${dashboard.agentModel.runs.terminal} terminal · ${dashboard.agentModel.runs.nonTerminal} non-terminal · ${dashboard.agentModel.runs.resultBound} results bound · ${dashboard.agentModel.runs.actualEffectCount} recorded actual effects`,
    `Handoffs: ${dashboard.agentModel.handoffs.shown}/${dashboard.agentModel.handoffs.total} shown · ${dashboard.agentModel.handoffs.pendingAcknowledgement} pending acknowledgement · ${dashboard.agentModel.handoffs.acknowledged} acknowledged`,
    `Provider usage and cost: ${dashboard.agentModel.providerMetrics.usage}/${dashboard.agentModel.providerMetrics.cost} · live provider quality ${dashboard.agentModel.liveProviderQuality} · semantic output quality ${dashboard.agentModel.semanticOutputQuality}`,
    `Freshness: ${dashboard.freshness.state} · Phase 2 ${dashboard.freshness.phase2State} · Agent/Model ${dashboard.freshness.agentModelState}`,
    `Product Owner acceptance: ${dashboard.governance.productOwnerAcceptance} · Run launch authority: ${dashboard.governance.runLaunchAuthority} · effect authority: ${dashboard.governance.effectAuthority}`,
    `Snapshot digest: ${dashboard.snapshotDigest}`,
    `Phase 2 source digest: ${dashboard.sources.phase2UxFigmaSnapshotDigest}`,
    `Agent/Model source digest: ${dashboard.sources.agentModelSnapshotDigest}`,
    "",
    ...dashboard.limitations.map((limitation) => `Limit: ${limitation}`),
    "",
    "Boundary: these derived read-only views are not a second source of truth and grant no impact completeness, design validity, provider quality, selection, Run launch, approval, baseline, readiness, remediation, Figma, implementation, effect, release, or action authority.",
    "Design content, Product text, Run narrative, provider output, prompts, source bytes, machine paths, credentials, permissions, and sensitive setting values are withheld.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return dashboard
}

async function showPhase3aDashboard(pool: EngineClientPool, input: unknown): Promise<Phase3aDashboard> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Phase 3A dashboard", "Initiative ID")
  const [product, initiative] = await Promise.all([client.readProduct(), client.readInitiative(initiativeId)])
  const dashboard = await client.readPhase3aDashboard(product, initiative)
  const lines = [
    "GAEP exact Phase 3A backlog and implementation readiness dashboard",
    "",
    `Initiative: ${dashboard.initiative.recordId}@${dashboard.initiative.revision} · ${dashboard.initiative.state}`,
    `Phase state: ${dashboard.phaseStatus.state}`,
    `Sources: ${dashboard.phaseStatus.currentSourceCount} current · ${dashboard.phaseStatus.attentionRequiredSourceCount} attention-required · ${dashboard.phaseStatus.unavailableSourceCount} unavailable · ${dashboard.phaseStatus.expectedSourceCount} expected`,
    `Provider workflow evidence: ${dashboard.phaseStatus.providerWorkflowEvidenceCount}/2 sealed local deterministic · live acceptance ${dashboard.phaseStatus.liveProviderAcceptanceCount} · native-host acceptance ${dashboard.phaseStatus.nativeHostAcceptanceCount}`,
    `Freshness: ${dashboard.freshness.state} · ${dashboard.freshness.staleCount} stale · ${dashboard.freshness.unresolvedCount} unresolved`,
    `Pagination: ${dashboard.pagination.offset + 1}-${dashboard.pagination.total} of ${dashboard.pagination.total} · truncated ${dashboard.pagination.truncated}`,
    `Export: ${dashboard.export.format} · formula prefixes neutralized ${dashboard.export.formulaPrefixesNeutralized} · hidden content excluded ${dashboard.export.hiddenContentExcluded}`,
    `Snapshot digest: ${dashboard.snapshotDigest}`,
    `Source catalog digest: ${dashboard.phaseStatus.sourceCatalogDigest}`,
    `Source: ${dashboard.sourceBoundary}`,
    `Privacy: ${dashboard.privacyBoundary}`,
    "",
    "Views",
    ...dashboard.views.map((view) =>
      `${view.title} · ${view.state} · ${view.currentSourceCount} current/${view.attentionRequiredSourceCount} attention/${view.unavailableSourceCount} unavailable · ${view.candidateCount} candidates · ${view.evidenceReferenceCount} evidence · ${view.gapCount} gaps · ${view.conflictCount} conflicts · ${view.staleCount} stale · ${view.unresolvedCount} unresolved · ${view.workflowEvidenceCount} workflows`),
    "",
    "Governed sources",
    ...dashboard.sources.map((source) =>
      `${source.title} · ${source.group} · ${source.availability} · ${source.assessment?.state ?? "no state inferred"} · ${source.assessment?.gapCount ?? 0} gaps · ${source.assessment?.conflictCount ?? 0} conflicts · ${source.assessment?.staleCount ?? 0} stale · ${source.assessment?.unresolvedCount ?? 0} unresolved`),
    "",
    "Bounded provider workflow evidence",
    ...dashboard.workflows.map((workflow) =>
      `${workflow.provider} · ${workflow.availability} · ${workflow.executionMode} · live ${workflow.liveAcceptance} · semantic quality ${workflow.semanticQuality} · authority ${workflow.authority}`),
    "",
    ...dashboard.limitations.map((limitation) => `Limit: ${limitation}`),
    "",
    "Boundary: this derived read-only view grants no completeness, priority, readiness, waiver, ownership, implementation, acceptance, release, deployment, or action authority.",
    "Product text, design content, source code, provider output, personal content, secrets, credentials, permissions, and private paths are withheld.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return dashboard
}

async function showPhase1Summary(pool: EngineClientPool, input: unknown): Promise<Phase1SummaryDashboard> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Phase 1 summary", "Initiative ID")
  const [product, initiative] = await Promise.all([client.readProduct(), client.readInitiative(initiativeId)])
  const summary = await client.readPhase1Summary(product, initiative)
  const lines = [
    "GAEP exact Phase 1 summary and readiness dashboard",
    "",
    `Initiative: ${summary.initiative.recordId} · revision ${summary.initiative.revision} · ${summary.initiative.state}`,
    `Phase state: ${summary.phaseStatus.state}`,
    `Declared gap indicators: ${summary.phaseStatus.declaredGapCount} · attention signals: ${summary.phaseStatus.attentionSignalCount}`,
    `P0-P4 readiness: ${summary.readiness.result} · ${summary.readiness.outputs.satisfied}/${summary.readiness.outputs.applicable} applicable outputs satisfied · ${summary.readiness.gaps.total} declared gaps`,
    `P5 handoff: ${summary.handoff.state} · ${summary.handoff.transferState} · ${summary.handoff.items.included}/${summary.handoff.items.total} items included · ${summary.handoff.gaps.total} declared gaps`,
    `Freshness: ${summary.freshness.state} · ${summary.freshness.staleBindingCount} stale bindings · ${summary.freshness.staleSourceReferenceCount} stale Source references`,
    "Owners: unbound; no governed phase-owner assignment is bound.",
    "Product Owner acceptance: not established · readiness authority: not established · phase-entry authority: not established",
    `Snapshot digest: ${summary.snapshotDigest}`,
    `Source: ${summary.sourceBoundary}`,
    `Privacy: ${summary.privacyBoundary}`,
    "",
    ...summary.limitations.map((limitation) => `Limit: ${limitation}`),
    "",
    "Boundary: this read-only candidate summary grants no readiness, approval, acceptance, phase-entry, release, Run, Tool, write, or action authority.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return summary
}

async function showPhase1ChangeImpact(pool: EngineClientPool, input: unknown): Promise<Phase1ChangeImpactDashboard> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Phase 1 Change/Impact view", "Initiative ID")
  const [product, initiative] = await Promise.all([client.readProduct(), client.readInitiative(initiativeId)])
  const catalog = await client.listChangeImpactChanges(product)
  if (catalog.items.length === 0) {
    throw new ConfigurationBoundaryError("No current Change metadata is available for the Phase 1 Change/Impact dashboard.")
  }
  const selected = await vscode.window.showQuickPick(catalog.items.map((change) => ({
    label: change.recordId,
    description: `${change.state} · revision ${change.revision}`,
    detail: `Effects: ${change.effectEnvelope.join(", ")} · digest ${change.digest}`,
    change,
  })), {
    title: `Select one exact Phase 1 Change (${catalog.items.length} of ${catalog.total}; ${catalog.omitted} omitted)`,
    placeHolder: "Observe bounded P0-P4 impact coverage; selection grants no approval, revalidation, or effect authority",
    ignoreFocusOut: true,
  })
  if (!selected) throw new WorkflowCancelled()
  const dashboard = await client.readPhase1ChangeImpact(product, initiative, selected.change)
  const lines = [
    "GAEP exact Phase 1 Change and impact dashboard",
    "",
    `Initiative: ${dashboard.initiative.recordId}@${dashboard.initiative.revision}`,
    `Change: ${dashboard.change.recordId}@${dashboard.change.revision} · ${dashboard.change.state}`,
    `Coverage: ${dashboard.coverage.currentTraceObservedOutputCount} current trace-observed · ${dashboard.coverage.attentionRequiredOutputCount} attention · ${dashboard.coverage.impactNotEstablishedOutputCount} impact not established`,
    `Freshness: ${dashboard.freshness.state} · ${dashboard.freshness.traceAttentionLinkCount} trace-attention links · ${dashboard.freshness.staleBindingCount} stale bindings`,
    `Change scope: ${dashboard.changeScope.changedArtifactCount} changed artifacts · ${dashboard.changeScope.effectTargetCount} effect targets · ${dashboard.changeScope.affectedUnitCount} affected trace units`,
    "Owners: unbound · revalidation: not established · Change approval: not established · risk-acceptance authority: not established · effect authority: not established",
    `Snapshot digest: ${dashboard.snapshotDigest}`,
    "",
    "P0-P4 governed output impact coverage:",
    ...dashboard.outputs.map((output) =>
      `  ${output.outputKind} · readiness=${output.readiness.applicability}/${output.readiness.evaluationState}/${output.readiness.freshness} · impact=${output.impact.state} · exact=${output.impact.exactMatchedSubjectCount}/${output.readiness.subjectCount} · traces=${output.impact.traceReferenceCount} · handoff=${output.handoff.disposition}/${output.handoff.freshness} · revalidation=${output.impact.revalidationState}`),
    "",
    ...dashboard.limitations.map((limitation) => `Limit: ${limitation}`),
    "",
    "Boundary: trace presence proves only recorded links; absence does not prove no impact. This read-only projection grants no impact-completeness, revalidation, approval, risk-acceptance, readiness, effect, release, write, or action authority.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return dashboard
}

async function showChangeImpactDashboard(pool: EngineClientPool): Promise<ChangeImpactDashboard> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const product = await client.readProduct()
  const catalog: ChangeImpactChangeCatalog = await client.listChangeImpactChanges(product)
  if (catalog.items.length === 0) {
    throw new ConfigurationBoundaryError("No current Change metadata is available for the exact Change/Impact dashboard.")
  }
  const selected = await vscode.window.showQuickPick(catalog.items.map((change) => ({
    label: change.recordId,
    description: `${change.state} · revision ${change.revision}`,
    detail: `Effects: ${change.effectEnvelope.join(", ")} · digest ${change.digest}`,
    change,
  })), {
    title: `Select one exact current Change (${catalog.items.length} of ${catalog.total}; ${catalog.omitted} omitted)`,
    placeHolder: "Open a read-only exact Change/Impact projection; selection grants no approval or effect authority",
    ignoreFocusOut: true,
  })
  if (!selected) throw new WorkflowCancelled()
  const dashboard = await client.readChangeImpact(product, selected.change)
  const locator = (value: ChangeImpactDashboard["changedArtifacts"][number]["locator"]): string =>
    value.kind === "workspace-relative" ? value.path : value.kind === "logical" ? value.value : value.uri
  const lines = [
    "GAEP exact Change and impact dashboard",
    "",
    `Change: ${dashboard.change.recordId}`,
    `Change revision / state: ${dashboard.change.revision} / ${dashboard.change.state}`,
    `Change digest: ${dashboard.change.digest}`,
    `Product revision: ${dashboard.product.revision}`,
    `Product digest: ${dashboard.product.digest}`,
    `Snapshot digest: ${dashboard.snapshotDigest}`,
    `Effects: ${dashboard.change.effectEnvelope.join(", ")}`,
    `Freshness: ${dashboard.freshness.state}; observed ${dashboard.observedAt}; trace evaluated ${dashboard.freshness.evaluatedAt}`,
    `Source: ${dashboard.sourceBoundary}`,
    `Evidence freshness: ${dashboard.evidenceCues.freshness}`,
    "Confidence: not assessed; no governed confidence evaluation is bound.",
    "Approval: not established. The current contract has no general Change approval record.",
    "",
    `Work Items (${dashboard.limits.workItems.shown}/${dashboard.limits.workItems.total}):`,
    ...dashboard.workItems.map((entry) => `  ${entry.record.recordId}@${entry.record.revision} · ${entry.state} · ${entry.record.digest}`),
    "",
    `Changed artifacts (${dashboard.limits.changedArtifacts.shown}/${dashboard.limits.changedArtifacts.total}):`,
    ...dashboard.changedArtifacts.map((entry) => `  ${locator(entry.locator)} · ${entry.locator.kind} · Work Item ${entry.sourceWorkItem.recordId}`),
    "",
    `Effect targets (${dashboard.limits.effectTargets.shown}/${dashboard.limits.effectTargets.total}):`,
    ...dashboard.effectTargets.map((entry) => `  ${locator(entry.locator)} · ${entry.locator.kind} · Work Item ${entry.sourceWorkItem.recordId}`),
    "",
    `Affected units (${dashboard.limits.affectedUnits.shown}/${dashboard.limits.affectedUnits.total}):`,
    ...dashboard.affectedUnits.map((entry) =>
      `  ${entry.direction} · ${entry.endpoint.recordType}:${entry.endpoint.recordId} · ${entry.relationship} · ${entry.trace.assessedState}`),
    "",
    `Related Decisions (${dashboard.limits.decisions.shown}/${dashboard.limits.decisions.total}):`,
    ...dashboard.governance.decisions.map((entry) =>
      `  ${entry.record.recordId}@${entry.record.revision} · ${entry.state} · ${entry.outcome}`),
    "",
    `Related Risks (${dashboard.limits.risks.shown}/${dashboard.limits.risks.total}):`,
    ...dashboard.governance.risks.map((entry) =>
      `  ${entry.record.recordId}@${entry.record.revision} · ${entry.state} · ${entry.likelihood}/${entry.impact} · ${entry.acceptance}`),
    "",
    `Trace attention: unresolved=${dashboard.freshness.unresolvedTraceLinks}; invalid=${dashboard.freshness.invalidTraceLinks}; stale=${dashboard.freshness.staleTraceLinks}; stale governance=${dashboard.freshness.staleGovernanceReferences}`,
    `Omissions: ${dashboard.limits.truncated ? "one or more bounded categories are truncated" : "none in bounded categories"}`,
    "Coverage: absence of a trace link does not prove absence of impact.",
    ...dashboard.limitations.map((limitation) => `Limit: ${limitation}`),
    "",
    "Boundary: this read-only projection grants no Change approval, risk acceptance, mutation, Run, Tool, write, effect, phase-entry, readiness, release, or outcome authority.",
    "Product text, Change text, Work Item text, source bytes, absolute paths, provider output, prompts, executable state, and credentials are withheld.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return dashboard
}

async function showAgentModelDashboard(pool: EngineClientPool): Promise<AgentModelDashboard> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const product = await client.readProduct()
  const dashboard = await client.readAgentModel(product)
  const selectionLines = dashboard.selection.status === "selected" || dashboard.selection.status === "migration-required"
    ? [
        `Selection: ${dashboard.selection.status} · ${dashboard.selection.adapterId}/${dashboard.selection.agentId} · ${dashboard.selection.modelId}`,
        `Selection digest: ${dashboard.selection.selectionDigest}`,
        `Selection capability: ${dashboard.selection.capabilityState} · ${dashboard.selection.capabilityDigest}`,
        ...Object.entries(dashboard.selection.settings).map(([key, value]) =>
          `  setting ${key}=${Array.isArray(value) ? value.join(", ") : String(value)}`),
      ]
    : [`Selection: ${dashboard.selection.status}`]
  const lines = [
    "GAEP exact Agent and Model dashboard",
    "",
    `Product revision: ${dashboard.product.revision}`,
    `Product digest: ${dashboard.product.digest}`,
    `Snapshot digest: ${dashboard.snapshotDigest}`,
    `Freshness: ${dashboard.freshness.state} · selection capability ${dashboard.freshness.selectionCapabilityState}`,
    `Source: ${dashboard.sourceBoundary}`,
    `Evidence freshness: ${dashboard.evidenceCues.freshness}`,
    "Confidence: not assessed; no governed confidence evaluation is bound.",
    `Capability observation range: ${dashboard.freshness.oldestCapabilityObservedAt} to ${dashboard.freshness.newestCapabilityObservedAt}`,
    "Provider usage: unavailable; current Managed Run records have no provider usage contract.",
    "Provider cost: unavailable; current Managed Run records have no provider cost contract.",
    "",
    ...selectionLines,
    "",
    `Observed capabilities (${dashboard.limits.capabilities.shown}/${dashboard.limits.capabilities.total}):`,
    ...dashboard.capabilities.map((entry) =>
      `  ${entry.adapterId}/${entry.agentId} · ${entry.agentLabel} · ${entry.executionInterface}/${entry.interfaceMaturity} · models=${entry.modelCount} · selected=${entry.selected} · ${entry.capabilityDigest}`),
    "",
    `Runs (${dashboard.limits.runs.shown}/${dashboard.limits.runs.total}):`,
    ...dashboard.runs.map((entry) => {
      const managed = entry.managed.status === "observed"
        ? `${entry.managed.state}/attempt-${entry.managed.attemptNumber}/${entry.managed.result.status}`
        : entry.managed.status
      return `  ${entry.record.recordId}@${entry.record.revision} · ${entry.state} · ${entry.agent.adapterId}/${entry.agent.agentId}/${entry.agent.modelId} · managed=${managed}`
    }),
    "",
    `Agent/model handoffs (${dashboard.limits.handoffs.shown}/${dashboard.limits.handoffs.total}):`,
    ...dashboard.handoffs.map((entry) =>
      `  ${entry.record.recordId} · Run ${entry.fromRun.recordId} -> ${entry.toSelection.adapterId}/${entry.toSelection.agentId}/${entry.toSelection.modelId} · ${entry.state}`),
    "",
    `Managed Run observations: ${dashboard.limits.managedRuns.shown}/${dashboard.limits.managedRuns.total}`,
    `Omissions: ${dashboard.limits.truncated ? "one or more bounded categories are truncated" : "none in reported categories"}`,
    "Coverage: bounded current records do not prove provider-account or native-host readiness.",
    ...dashboard.limitations.map((limitation) => `Limit: ${limitation}`),
    "",
    "Boundary: this read-only projection cannot select or switch an agent, create a handoff, launch a Run, authorize a Tool/write/effect, approve an outcome, establish readiness, or grant release authority.",
    "Product text, Run narrative, source bytes, absolute paths, provider output, prompts, executable state, credentials, and sensitive setting values are withheld.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return dashboard
}

async function showPhase1AgentModelDashboard(
  pool: EngineClientPool,
  input: unknown,
): Promise<Phase1AgentModelDashboard> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const normalized = initiativeInput(input)
  const initiativeId = normalized.initiativeId ??
    await collectUuid("Enter the exact Initiative UUID for the Phase 1 Agent/Model view", "Initiative ID")
  const [product, initiative] = await Promise.all([client.readProduct(), client.readInitiative(initiativeId)])
  const dashboard = await client.readPhase1AgentModel(product, initiative)
  const agentModel = dashboard.agentModel
  const selection = agentModel.selection.status === "selected" || agentModel.selection.status === "migration-required"
    ? `${agentModel.selection.status} · ${agentModel.selection.adapterId}/${agentModel.selection.agentId}/${agentModel.selection.modelId} · ${agentModel.selection.capabilityState}`
    : agentModel.selection.status
  const lines = [
    "GAEP exact Phase 1 Agent and Model execution truth",
    "",
    `Initiative: ${dashboard.initiative.recordId}@${dashboard.initiative.revision} · ${dashboard.initiative.state}`,
    `Product revision: ${dashboard.product.revision}`,
    `Selection: ${selection}`,
    `Capabilities: ${dashboard.executionTruth.capabilities.shown}/${dashboard.executionTruth.capabilities.total} shown · ${dashboard.executionTruth.capabilities.detected} detected · ${dashboard.executionTruth.capabilities.unavailable} unavailable · ${dashboard.executionTruth.capabilities.selected} selected`,
    `Runs: ${dashboard.executionTruth.runs.shown}/${dashboard.executionTruth.runs.total} shown · ${dashboard.executionTruth.runs.terminal} terminal · ${dashboard.executionTruth.runs.nonTerminal} non-terminal`,
    `Managed results: ${dashboard.executionTruth.runs.resultBound} bound · ${dashboard.executionTruth.runs.actualEffectCount} recorded actual effects`,
    `Outcomes: ${dashboard.executionTruth.runs.outcomes.satisfied} satisfied · ${dashboard.executionTruth.runs.outcomes.failed} failed · ${dashboard.executionTruth.runs.outcomes.notAssessed} not assessed · ${dashboard.executionTruth.runs.outcomes.indeterminate} indeterminate`,
    `Handoffs: ${dashboard.executionTruth.handoffs.shown}/${dashboard.executionTruth.handoffs.total} shown · ${dashboard.executionTruth.handoffs.pendingAcknowledgement} pending acknowledgement · ${dashboard.executionTruth.handoffs.acknowledged} acknowledged`,
    "Provider usage and cost: unavailable",
    `Live provider quality: ${dashboard.executionTruth.liveProviderQuality}`,
    `Semantic output quality: ${dashboard.executionTruth.semanticOutputQuality}`,
    `Freshness: ${dashboard.freshness.state} · selection capability ${dashboard.freshness.selectionCapabilityState}`,
    `Product Owner acceptance: ${dashboard.governance.productOwnerAcceptance}`,
    `Snapshot digest: ${dashboard.snapshotDigest}`,
    `Agent/Model snapshot digest: ${dashboard.source.agentModelSnapshotDigest}`,
    "",
    `Initiative Runs (${agentModel.limits.runs.shown}/${agentModel.limits.runs.total}):`,
    ...agentModel.runs.map((entry) =>
      `  ${entry.record.recordId}@${entry.record.revision} · ${entry.state} · ${entry.agent.adapterId}/${entry.agent.agentId}/${entry.agent.modelId} · managed=${entry.managed.status}`),
    "",
    `Initiative handoffs (${agentModel.limits.handoffs.shown}/${agentModel.limits.handoffs.total}):`,
    ...agentModel.handoffs.map((entry) =>
      `  ${entry.record.recordId} · Run ${entry.fromRun.recordId} -> ${entry.toSelection.adapterId}/${entry.toSelection.agentId}/${entry.toSelection.modelId} · ${entry.state}`),
    "",
    ...dashboard.limitations.map((limitation) => `Limit: ${limitation}`),
    "",
    "Boundary: this read-only Initiative-scoped projection does not establish provider readiness or quality, choose a provider, acknowledge a handoff, launch a Run, authorize effects, approve Phase 1, record Product Owner acceptance, or grant release authority.",
    "Product text, Run narrative, provider output, prompts, source bytes, machine paths, credentials, and sensitive setting values are withheld.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
  return dashboard
}

async function showAccessibleDashboardTables(pool: EngineClientPool): Promise<void> {
  requireTrustedWorkspace()
  const dashboardKind = await vscode.window.showQuickPick([
    {
      label: "Phase dashboard tables",
      description: "Exact phase-panel metadata",
      value: "phase" as const,
    },
    {
      label: "Change and impact tables",
      description: "Exact Work Item, artifact, effect, trace, Decision, and Risk metadata",
      value: "change-impact" as const,
    },
    {
      label: "Agent and model tables",
      description: "Exact capability, selection, Run, handoff, and unavailable-metric metadata",
      value: "agent-model" as const,
    },
  ], {
    title: "Select an accessible GAEP dashboard table group",
    placeHolder: "Keyboard and screen-reader flow; all rows remain read-only verified metadata",
    ignoreFocusOut: true,
  })
  if (!dashboardKind) throw new WorkflowCancelled()

  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const product = await client.readProduct()
  let tables: readonly AccessibleMetadataTable[]
  if (dashboardKind.value === "phase") {
    tables = phaseDashboardTables(await client.readPhaseDashboard(product, "phase-0-1a-foundation"))
  } else if (dashboardKind.value === "change-impact") {
    const catalog = await client.listChangeImpactChanges(product)
    if (catalog.items.length === 0) {
      throw new ConfigurationBoundaryError("No current Change metadata is available for accessible Change/Impact tables.")
    }
    const selectedChange = await vscode.window.showQuickPick(catalog.items.map((change) => ({
      label: change.recordId,
      description: `${change.state} · revision ${change.revision}`,
      detail: `Effects: ${change.effectEnvelope.join(", ")} · digest ${change.digest}`,
      change,
    })), {
      title: `Select one exact current Change (${catalog.items.length} of ${catalog.total}; ${catalog.omitted} omitted)`,
      placeHolder: "Table selection grants no approval or effect authority",
      ignoreFocusOut: true,
    })
    if (!selectedChange) throw new WorkflowCancelled()
    tables = changeImpactDashboardTables(await client.readChangeImpact(product, selectedChange.change))
  } else {
    tables = agentModelDashboardTables(await client.readAgentModel(product))
  }

  const selectedTable = await vscode.window.showQuickPick(tables.map((table) => ({
    label: table.title,
    description: `${table.rows.length} verified row${table.rows.length === 1 ? "" : "s"} · ${table.omitted} omitted upstream`,
    detail: "Sort and filter only these already-bounded visible metadata columns",
    table,
  })), {
    title: "Select one accessible metadata table",
    placeHolder: "Dismiss to leave all governed state unchanged",
    ignoreFocusOut: true,
  })
  if (!selectedTable) throw new WorkflowCancelled()

  const sourceOrder = Symbol("source-order")
  const sort = await vscode.window.showQuickPick([
    { label: "Keep verified source order", description: "No client-side sort", value: sourceOrder as string | typeof sourceOrder },
    ...selectedTable.table.columns.map((column) => ({
      label: `Sort by ${column.label}`,
      description: "Deterministic text sort with row-ID tie breaking",
      value: column.key as string | typeof sourceOrder,
    })),
  ], {
    title: `Sort ${selectedTable.table.title}`,
    placeHolder: "Choose a visible column or keep verified source order",
    ignoreFocusOut: true,
  })
  if (!sort) throw new WorkflowCancelled()
  let sortDirection: AccessibleTableSortDirection | undefined
  if (sort.value !== sourceOrder) {
    const direction = await vscode.window.showQuickPick([
      { label: "Ascending", description: "A to Z", value: "ascending" as const },
      { label: "Descending", description: "Z to A", value: "descending" as const },
    ], {
      title: `Choose ${sort.label.toLocaleLowerCase()} direction`,
      ignoreFocusOut: true,
    })
    if (!direction) throw new WorkflowCancelled()
    sortDirection = direction.value
  }

  const filter = await vscode.window.showInputBox({
    title: `Filter ${selectedTable.table.title}`,
    prompt: "Optional: match up to 256 characters against only the visible verified metadata columns",
    placeHolder: "Leave empty to show every verified row",
    ignoreFocusOut: true,
    validateInput: (value) => value.length > 256 ? "Use at most 256 characters" : undefined,
  })
  if (filter === undefined) throw new WorkflowCancelled()
  const view = sort.value === sourceOrder
    ? buildAccessibleTableView(selectedTable.table, { filter })
    : buildAccessibleTableView(selectedTable.table, { filter, sortKey: sort.value, sortDirection: sortDirection! })
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content: renderAccessibleTableText(view),
  })
  await vscode.window.showTextDocument(document, { preview: true })
  if (view.rows.length === 0) {
    void vscode.window.showInformationMessage(
      `${view.table.title}: showing 0 of ${view.table.rows.length} verified rows. Nothing was copied.`,
    )
    return
  }
  const action = await vscode.window.showInformationMessage(
    `${view.table.title}: showing ${view.rows.length} of ${view.table.rows.length} verified rows.`,
    "Copy Visible Rows as CSV",
  )
  if (action !== "Copy Visible Rows as CSV") return
  try {
    await vscode.env.clipboard.writeText(accessibleTableCsv(view))
    void vscode.window.showInformationMessage(
      `${view.table.title}: copied ${view.rows.length} visible metadata row${view.rows.length === 1 ? "" : "s"} as CSV.`,
    )
  } catch {
    await vscode.window.showErrorMessage(`${view.table.title}: CSV copy failed. No file was written.`)
  }
}

function phaseDashboardTables(dashboard: PhaseDashboardFramework): readonly AccessibleMetadataTable[] {
  return [metadataTable({
    id: "phase-panels",
    title: `${dashboard.phase.label} panels`,
    columns: columns([
      ["panel-id", "Panel ID"], ["title", "Title"], ["role", "Role"], ["applicability", "Applicability"],
      ["basis", "Applicability basis"], ["state", "State"], ["decision", "Decision binding"],
    ]),
    rows: dashboard.panels.map((panel) => metadataRow(panel.id, {
      "panel-id": panel.id,
      title: panel.title,
      role: panel.role,
      applicability: panel.applicability.status,
      basis: panel.applicability.basis,
      state: panel.state,
      decision: panel.applicability.decision
        ? `${panel.applicability.decision.recordId}@${panel.applicability.decision.revision} · ${panel.applicability.decision.digest}`
        : "not bound",
    })),
    total: dashboard.panels.length,
    omitted: 0,
    snapshotDigest: dashboard.compositionDigest,
    sourceBoundary: dashboard.sourceBoundary,
    authorityBoundary: dashboard.authorityBoundary,
  })]
}

function changeImpactDashboardTables(dashboard: ChangeImpactDashboard): readonly AccessibleMetadataTable[] {
  const locator = (value: ChangeImpactDashboard["changedArtifacts"][number]["locator"]): string =>
    value.kind === "workspace-relative" ? value.path : value.kind === "logical" ? value.value : value.uri
  const common = {
    snapshotDigest: dashboard.snapshotDigest,
    sourceBoundary: dashboard.sourceBoundary,
    authorityBoundary: dashboard.authorityBoundary,
  }
  return [
    metadataTable({
      ...common,
      id: "change-work-items",
      title: "Change Work Items",
      columns: columns([["record-id", "Record ID"], ["revision", "Revision"], ["state", "State"], ["digest", "Digest"]]),
      rows: dashboard.workItems.map((entry) => metadataRow(entry.record.recordId, {
        "record-id": entry.record.recordId, revision: String(entry.record.revision), state: entry.state, digest: entry.record.digest,
      })),
      total: dashboard.limits.workItems.total,
      omitted: dashboard.limits.workItems.omitted,
    }),
    metadataTable({
      ...common,
      id: "changed-artifacts",
      title: "Changed artifacts",
      columns: columns([["locator", "Locator"], ["kind", "Kind"], ["work-item", "Source Work Item"]]),
      rows: dashboard.changedArtifacts.map((entry, index) => metadataRow(`${entry.sourceWorkItem.recordId}:artifact:${index}`, {
        locator: locator(entry.locator), kind: entry.locator.kind, "work-item": entry.sourceWorkItem.recordId,
      })),
      total: dashboard.limits.changedArtifacts.total,
      omitted: dashboard.limits.changedArtifacts.omitted,
    }),
    metadataTable({
      ...common,
      id: "effect-targets",
      title: "Effect targets",
      columns: columns([["locator", "Locator"], ["kind", "Kind"], ["work-item", "Source Work Item"]]),
      rows: dashboard.effectTargets.map((entry, index) => metadataRow(`${entry.sourceWorkItem.recordId}:effect:${index}`, {
        locator: locator(entry.locator), kind: entry.locator.kind, "work-item": entry.sourceWorkItem.recordId,
      })),
      total: dashboard.limits.effectTargets.total,
      omitted: dashboard.limits.effectTargets.omitted,
    }),
    metadataTable({
      ...common,
      id: "affected-units",
      title: "Affected units",
      columns: columns([
        ["direction", "Direction"], ["endpoint", "Endpoint"], ["relationship", "Relationship"],
        ["trace-state", "Trace state"], ["trace-id", "Trace ID"], ["assessment-digest", "Assessment digest"],
      ]),
      rows: dashboard.affectedUnits.map((entry) => metadataRow(`${entry.trace.recordId}:${entry.direction}:${entry.endpoint.recordId}`, {
        direction: entry.direction,
        endpoint: `${entry.endpoint.recordType}:${entry.endpoint.recordId}`,
        relationship: entry.relationship,
        "trace-state": entry.trace.assessedState,
        "trace-id": entry.trace.recordId,
        "assessment-digest": entry.trace.assessmentDigest,
      })),
      total: dashboard.limits.affectedUnits.total,
      omitted: dashboard.limits.affectedUnits.omitted,
    }),
    metadataTable({
      ...common,
      id: "related-decisions",
      title: "Related Decisions",
      columns: columns([["record-id", "Record ID"], ["revision", "Revision"], ["state", "State"], ["outcome", "Outcome"], ["digest", "Digest"]]),
      rows: dashboard.governance.decisions.map((entry) => metadataRow(entry.record.recordId, {
        "record-id": entry.record.recordId, revision: String(entry.record.revision), state: entry.state,
        outcome: entry.outcome, digest: entry.record.digest,
      })),
      total: dashboard.limits.decisions.total,
      omitted: dashboard.limits.decisions.omitted,
    }),
    metadataTable({
      ...common,
      id: "related-risks",
      title: "Related Risks",
      columns: columns([
        ["record-id", "Record ID"], ["revision", "Revision"], ["state", "State"], ["likelihood", "Likelihood"],
        ["impact", "Impact"], ["acceptance", "Acceptance"], ["digest", "Digest"],
      ]),
      rows: dashboard.governance.risks.map((entry) => metadataRow(entry.record.recordId, {
        "record-id": entry.record.recordId, revision: String(entry.record.revision), state: entry.state,
        likelihood: entry.likelihood, impact: entry.impact, acceptance: entry.acceptance, digest: entry.record.digest,
      })),
      total: dashboard.limits.risks.total,
      omitted: dashboard.limits.risks.omitted,
    }),
  ]
}

function agentModelDashboardTables(dashboard: AgentModelDashboard): readonly AccessibleMetadataTable[] {
  const common = {
    snapshotDigest: dashboard.snapshotDigest,
    sourceBoundary: dashboard.sourceBoundary,
    authorityBoundary: dashboard.authorityBoundary,
  }
  const selection = dashboard.selection
  return [
    metadataTable({
      ...common,
      id: "agent-capabilities",
      title: "Observed agent capabilities",
      columns: columns([
        ["agent", "Agent"], ["adapter-version", "Adapter version"], ["runtime-version", "Runtime version"],
        ["detected", "Detected"], ["interface", "Execution interface"], ["maturity", "Interface maturity"],
        ["models", "Model count"], ["selected", "Selected"], ["observed-at", "Observed at"], ["digest", "Capability digest"],
      ]),
      rows: dashboard.capabilities.map((entry) => metadataRow(`${entry.adapterId}:${entry.agentId}`, {
        agent: `${entry.adapterId}/${entry.agentId} · ${entry.agentLabel}`,
        "adapter-version": entry.adapterVersion,
        "runtime-version": entry.runtimeVersion ?? "not observed",
        detected: String(entry.detected),
        interface: entry.executionInterface,
        maturity: entry.interfaceMaturity,
        models: String(entry.modelCount),
        selected: String(entry.selected),
        "observed-at": entry.observedAt,
        digest: entry.capabilityDigest,
      })),
      total: dashboard.limits.capabilities.total,
      omitted: dashboard.limits.capabilities.omitted,
    }),
    metadataTable({
      ...common,
      id: "agent-selection",
      title: "Current Agent Selection",
      columns: columns([
        ["status", "Status"], ["agent", "Agent"], ["model", "Model"], ["truth-class", "Model truth class"],
        ["alias", "Model alias"], ["capability-state", "Capability state"], ["selected-at", "Selected at"],
        ["selection-digest", "Selection digest"], ["capability-digest", "Capability digest"],
      ]),
      rows: [metadataRow("current-selection", {
        status: selection.status,
        agent: selection.status === "selected" || selection.status === "migration-required" ? `${selection.adapterId}/${selection.agentId}` : "not available",
        model: selection.status === "selected" || selection.status === "migration-required" ? selection.modelId : "not available",
        "truth-class": selection.status === "selected" || selection.status === "migration-required" ? selection.modelTruthClass : "not available",
        alias: selection.status === "selected" || selection.status === "migration-required" ? String(selection.modelAlias) : "not available",
        "capability-state": selection.status === "selected" || selection.status === "migration-required" ? selection.capabilityState : "not available",
        "selected-at": selection.status === "selected" || selection.status === "migration-required" ? selection.selectedAt : "not available",
        "selection-digest": selection.status === "selected" || selection.status === "migration-required" ? selection.selectionDigest : "not available",
        "capability-digest": selection.status === "selected" || selection.status === "migration-required" ? selection.capabilityDigest : "not available",
      })],
      total: 1,
      omitted: 0,
    }),
    metadataTable({
      ...common,
      id: "agent-runs",
      title: "Agent Runs and Managed evidence",
      columns: columns([
        ["run-id", "Run ID"], ["revision", "Revision"], ["state", "State"], ["agent", "Agent"], ["model", "Model"],
        ["started-at", "Started at"], ["ended-at", "Ended at"], ["managed-state", "Managed state"],
        ["managed-result", "Managed result"], ["digest", "Run digest"],
      ]),
      rows: dashboard.runs.map((entry) => metadataRow(entry.record.recordId, {
        "run-id": entry.record.recordId,
        revision: String(entry.record.revision),
        state: entry.state,
        agent: `${entry.agent.adapterId}/${entry.agent.agentId}`,
        model: entry.agent.modelId,
        "started-at": entry.startedAt ?? "not recorded",
        "ended-at": entry.endedAt ?? "not recorded",
        "managed-state": entry.managed.status === "observed" ? `${entry.managed.state} · attempt ${entry.managed.attemptNumber}` : entry.managed.status,
        "managed-result": entry.managed.status === "observed" ? entry.managed.result.status : "not observed",
        digest: entry.record.digest,
      })),
      total: dashboard.limits.runs.total,
      omitted: dashboard.limits.runs.omitted,
    }),
    metadataTable({
      ...common,
      id: "agent-handoffs",
      title: "Agent and model handoffs",
      columns: columns([
        ["handoff-id", "Handoff ID"], ["from-run", "From Run"], ["target", "Target selection"], ["state", "State"],
        ["created-at", "Created at"], ["acknowledged-at", "Acknowledged at"], ["digest", "Handoff digest"],
      ]),
      rows: dashboard.handoffs.map((entry) => metadataRow(entry.record.recordId, {
        "handoff-id": entry.record.recordId,
        "from-run": entry.fromRun.recordId,
        target: `${entry.toSelection.adapterId}/${entry.toSelection.agentId}/${entry.toSelection.modelId}`,
        state: entry.state,
        "created-at": entry.createdAt,
        "acknowledged-at": entry.acknowledgedAt ?? "not acknowledged",
        digest: entry.record.digest,
      })),
      total: dashboard.limits.handoffs.total,
      omitted: dashboard.limits.handoffs.omitted,
    }),
    metadataTable({
      ...common,
      id: "provider-metrics",
      title: "Provider usage and cost metadata",
      columns: columns([["metric", "Metric"], ["state", "State"], ["basis", "Basis"]]),
      rows: [
        metadataRow("usage", { metric: "Usage", state: dashboard.providerMetrics.usage.state, basis: dashboard.providerMetrics.usage.basis }),
        metadataRow("cost", { metric: "Cost", state: dashboard.providerMetrics.cost.state, basis: dashboard.providerMetrics.cost.basis }),
      ],
      total: 2,
      omitted: 0,
    }),
  ]
}

function columns(values: readonly (readonly [key: string, label: string])[]): readonly AccessibleTableColumn[] {
  return values.map(([key, label]) => ({ key, label }))
}

function metadataRow(id: string, cells: Readonly<Record<string, string>>): AccessibleTableRow {
  return { id, cells }
}

function metadataTable(table: AccessibleMetadataTable): AccessibleMetadataTable {
  return createAccessibleMetadataTable(table)
}

async function showManagedEvidencePage(page: ManagedRunSummaryPage): Promise<void> {
  const lines = [
    "GAEP bounded Managed Run evidence",
    "",
    `Snapshot: ${page.snapshotDigest}`,
    `Offset / limit: ${page.offset} / ${page.limit}`,
    `Displayed: ${page.items.length} of ${page.total}`,
    `Omitted from this page: ${page.omittedCount}`,
    `More pages available: ${page.hasMore ? "yes" : "no"}`,
    "",
    ...page.items.map((item) => [
      `${item.managedRunId} · ${item.state} · ${item.mode}`,
      `  Provider: ${item.adapterId} / ${item.agentId} / ${item.modelId}`,
      `  Updated: ${item.updatedAt}; recovery=${item.recoveryStatus}; result=${item.hasResult ? "bound" : "not bound"}; apply decision=${item.hasApplyDecision ? "bound" : "not bound"}`,
    ].join("\n")),
    "",
    "Boundary: this audit-gated observation cannot start, resume, cancel, apply, discard, approve, or grant Run, Tool, write, effect, outcome, implementation-readiness, or release authority.",
    "Raw provider output, prompts, context content, changed paths, source bytes, executable paths, process state, workspace paths, and credentials are withheld.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
}

async function showManagedEvidenceDetail(detail: ManagedEvidenceDetail): Promise<void> {
  const { summary, result, evidence, applyDecision } = detail
  const lines = [
    "GAEP exact Managed Run evidence detail",
    "",
    `Managed Run: ${summary.managedRunId}`,
    `Governed Run: ${summary.runId}`,
    `Product / Initiative: ${summary.productId} / ${summary.initiativeId}`,
    `State / mode: ${summary.state} / ${summary.mode}`,
    `Provider: ${summary.adapterId} / ${summary.agentId} / ${summary.modelId}`,
    `Recovery: ${summary.recoveryStatus}; attempt ${summary.attemptNumber}; checkpoints ${summary.workflowCheckpointCount}`,
    `Artifact status: ${detail.artifactStatus}`,
    `Bindings digest: ${summary.bindingsDigest}`,
    ...(result ? [
      "",
      "Verified result:",
      `  Result: ${result.resultId} (${result.resultDigest})`,
      `  Terminal state: ${result.terminalState}`,
      `  Provider disposition: ${result.providerDisposition}; termination cause: ${result.terminationCause}`,
      `  Governed outcome: ${result.outcomeStatus} (${result.outcomeBasis})`,
      `  Warnings: ${result.warningCodes.length === 0 ? "none" : result.warningCodes.join(", ")}`,
      `  Started / ended: ${result.startedAt} / ${result.endedAt}`,
    ] : ["", "No committed result/evidence pair is bound to this record. No terminal outcome is inferred."]),
    ...(evidence ? [
      "",
      "Verified evidence:",
      `  Evidence: ${evidence.evidenceId} (${evidence.evidenceDigest})`,
      `  Events: ${evidence.eventCount}; lifecycle=${evidence.eventTypeCounts.lifecycle}; output=${evidence.eventTypeCounts.output}; item=${evidence.eventTypeCounts.item}; approval=${evidence.eventTypeCounts.approval}; warning=${evidence.eventTypeCounts.warning}; error=${evidence.eventTypeCounts.error}`,
      `  Workflow: ${evidence.workflowStrategy}; ${evidence.completedStepCount}/${evidence.workflowStepCount} steps; ${evidence.workflowAttemptCount} attempts`,
      `  Charter gates: evidence=${evidence.charterEvidenceStatus}; stop=${evidence.charterStopStatus}; reason=${evidence.terminalReasonCode}`,
      `  Actual effects: not-observed=${evidence.actualEffectCounts["not-observed"]}; provisional=${evidence.actualEffectCounts["observed-provisional"]}; applied=${evidence.actualEffectCounts.applied}; blocked=${evidence.actualEffectCounts.blocked}; unknown=${evidence.actualEffectCounts.unknown}`,
      ...(evidence.staging ? [
        `  Staging: ${evidence.staging.applyState}; changes=${evidence.staging.changeCount}; excluded=${evidence.staging.excludedPathCount}`,
        `  Stage digests: baseline=${evidence.staging.baselineDigest}; final=${evidence.staging.finalDigest}; inventory=${evidence.staging.changedInventoryDigest}`,
      ] : ["  Staging: not present"]),
      `  Captured: ${evidence.capturedAt}`,
    ] : []),
    ...(applyDecision ? [
      "",
      "Verified apply-decision evidence (observation only):",
      `  Receipt: ${applyDecision.receiptId} (${applyDecision.receiptDigest})`,
      `  Bound revision: ${applyDecision.managedRunRevision}; changed inventory count=${applyDecision.changedInventoryCount}; write-envelope count=${applyDecision.writeEnvelopeCount}`,
      `  Decided: ${applyDecision.decidedAt}`,
    ] : []),
    "",
    "Boundary: provider completion is separate from governed outcome. Apply-decision evidence records a past exact decision and grants this view no apply, discard, approval, Tool, write, effect, implementation-readiness, release, or future Run authority.",
    "Raw provider output, prompts, context content, changed paths, source bytes, executable paths, process state, workspace paths, and credentials are withheld.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
}

async function reviewManagedStagedChanges(
  pool: EngineClientPool,
): Promise<ManagedReviewPreview | ManagedReviewTransition> {
  requireTrustedWorkspace()
  const folder = await selectWorkspaceFolder()
  const client = await pool.get(folder.uri.fsPath)
  const managedRunId = await collectUuid("Enter the exact pending Managed Run UUID", "Managed Run ID")
  const preview = await client.readManagedReview(managedRunId)
  await showManagedReviewPreview(preview)

  const actions = [
    ...(preview.canApply ? ["Apply Exact Reviewed Inventory"] : []),
    ...(preview.canDiscard ? ["Discard Staged Changes"] : []),
  ]
  const selected = await vscode.window.showWarningMessage(
    [
      `Managed Run ${preview.managedRunId} revision ${preview.managedRunRevision} is ${preview.state}.`,
      `${preview.staging.changeCount} exact staged file change(s); inventory ${preview.staging.changedInventoryDigest}; preview ${preview.previewDigest}.`,
      preview.canApply
        ? "Apply can change only the exact reviewed workspace-relative inventory and write envelope. Post-apply Workflow gates will be recorded not assessed, so governed outcome success cannot be claimed."
        : "Apply is unavailable. Exact discard remains available for this recovery state.",
      "Dismiss to keep the review pending. No mutation occurs by opening this review.",
    ].join("\n\n"),
    { modal: true },
    ...actions,
  )
  if (!selected) return preview

  const decision = selected === "Apply Exact Reviewed Inventory"
    ? "apply-exact-managed-review"
    : "discard-exact-managed-review"
  const confirmationLabel = decision === "apply-exact-managed-review"
    ? "Confirm Exact Apply"
    : "Confirm Exact Discard"
  const confirmation = await vscode.window.showWarningMessage(
    [
      `${confirmationLabel} for Managed Run ${preview.managedRunId}?`,
      `Bound revision: ${preview.managedRunRevision}; preview: ${preview.previewDigest}; changes: ${preview.staging.changeCount}; inventory: ${preview.staging.changedInventoryDigest}.`,
      decision === "apply-exact-managed-review"
        ? `Write envelope: ${preview.applyConfirmation?.writeEnvelope.join(", ") || "none"}. This can mutate those exact source-workspace paths. Workflow gates remain not assessed.`
        : "Discard persists a governed discarded state. Machine-local stage and recovery-journal cleanup remain separate, unproven claims.",
      "Dismiss to cancel and keep the current review pending.",
    ].join("\n\n"),
    { modal: true },
    confirmationLabel,
  )
  if (confirmation !== confirmationLabel) return preview

  requireTrustedWorkspace()
  const actorId = normalizeActorId(machineSetting("actorId", undefined, "gaep.kiro-local-human"))
  const transition = decision === "apply-exact-managed-review"
    ? await client.applyManagedReview(preview, actorId)
    : await client.discardManagedReview(preview, actorId)
  await showManagedReviewTransition(transition)
  await vscode.window.showInformationMessage(
    decision === "apply-exact-managed-review"
      ? `Exact apply transition persisted as ${transition.state}. Workflow gates were not assessed; no governed outcome success or cleanup completion is inferred.`
      : `Exact discard transition persisted as ${transition.state}. Machine-local cleanup completion is not independently claimed.`,
  )
  return transition
}

async function showManagedReviewPreview(preview: ManagedReviewPreview): Promise<void> {
  const inventory = preview.staging.changedInventory.length === 0
    ? ["No staged workspace file changes were recorded."]
    : preview.staging.changedInventory.flatMap((change, index) => [
        `${index + 1}. ${change.kind.toUpperCase()} ${change.path}`,
        `   Before: ${change.beforeDigest ?? "absent"}; ${change.beforeSize ?? 0} byte(s); mode ${change.beforeMode?.toString(8) ?? "absent"}`,
        `   After: ${change.afterDigest ?? "absent"}; ${change.afterSize ?? 0} byte(s); mode ${change.afterMode?.toString(8) ?? "absent"}`,
      ])
  const lines = [
    "GAEP exact staged Managed Run review",
    "",
    `Managed Run: ${preview.managedRunId}`,
    `Governed Run: ${preview.runId}`,
    `Revision / state: ${preview.managedRunRevision} / ${preview.state}`,
    `Product / Initiative: ${preview.productId} / ${preview.initiativeId}`,
    `Bindings digest: ${preview.bindingsDigest}`,
    `Result: ${preview.result.resultId} (${preview.result.resultDigest})`,
    `Provider disposition: ${preview.result.providerDisposition}`,
    `Governed outcome before decision: ${preview.result.outcomeStatus} (${preview.result.outcomeBasis})`,
    `Evidence: ${preview.staging.evidenceId} (${preview.staging.evidenceDigest})`,
    `Stage: ${preview.staging.applyState}; baseline=${preview.staging.baselineDigest}; final=${preview.staging.finalDigest}`,
    `Complete bounded inventory: ${preview.staging.changeCount}/${preview.staging.changedInventoryLimit}; omitted=${preview.staging.omittedCount}; digest=${preview.staging.changedInventoryDigest}`,
    `Excluded staged paths: ${preview.staging.excludedPathCount}; set digest=${preview.staging.excludedPathSetDigest}`,
    `Apply available: ${preview.canApply ? "yes" : "no"}; discard available: ${preview.canDiscard ? "yes" : "no"}; local journal observed: ${preview.hasLocalJournal ? "yes" : "no"}`,
    `Exact write envelope: ${preview.applyConfirmation?.writeEnvelope.join(", ") || "not available"}`,
    `Preview digest: ${preview.previewDigest}`,
    `Warnings: ${preview.result.warningCodes.length === 0 ? "none" : preview.result.warningCodes.join(", ")}`,
    "",
    "Exact changed-file inventory",
    "",
    ...inventory,
    "",
    "Boundary: this view authorizes no mutation. Apply or discard requires a separate exact revision-and-preview-digest-bound human decision and a second cancel-default confirmation.",
    "Apply is limited to this exact changed inventory and write envelope. The host records post-apply Workflow gates not assessed, so it cannot claim governed outcome satisfaction.",
    "Provider output, prompts, context content, staged source bytes, absolute paths, executable paths, process state, workspace paths and credentials are withheld.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
}

async function showManagedReviewTransition(transition: ManagedReviewTransition): Promise<void> {
  const detail = transition.detail
  const lines = [
    "GAEP managed staged-review transition",
    "",
    `Decision: ${transition.decision}`,
    `Managed Run: ${transition.managedRunId}`,
    `Revision: ${transition.sourceManagedRunRevision} -> ${transition.managedRunRevision}`,
    `Persisted state: ${transition.state}`,
    `Source preview: ${transition.sourcePreviewDigest}`,
    `Transition digest: ${transition.transitionDigest}`,
    `Apply available: ${transition.canApply ? "yes" : "no"}; discard available: ${transition.canDiscard ? "yes" : "no"}`,
    `Local journal observed: ${transition.hasLocalJournal ? "yes" : "no"}`,
    `Result digest: ${detail.summary.resultDigest ?? "not bound"}`,
    `Apply-decision digest: ${detail.summary.applyDecisionDigest ?? "not bound"}`,
    `Provider disposition: ${detail.result?.providerDisposition ?? "not available"}`,
    `Governed outcome: ${detail.result ? `${detail.result.outcomeStatus} (${detail.result.outcomeBasis})` : "not available"}`,
    "",
    "Boundary: this receipt proves only the verified persisted transition. Provider completion, governed outcome satisfaction, machine-local stage cleanup and recovery-journal cleanup remain separate claims.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
}

function isTerminalRun(run: AgentRun): boolean {
  return run.state === "completed" || run.state === "failed" || run.state === "cancelled"
}

function samePortableBinding(
  left: Pick<AgentSelection, "adapterId" | "modelId" | "settings">,
  right: Pick<AgentSelection, "adapterId" | "modelId" | "settings">,
): boolean {
  return left.adapterId === right.adapterId && left.modelId === right.modelId &&
    JSON.stringify(sortedSettings(left.settings)) === JSON.stringify(sortedSettings(right.settings))
}

function sameExactSelection(left: AgentSelection, right: AgentSelection): boolean {
  return left.schemaVersion === right.schemaVersion && left.adapterId === right.adapterId && left.agentId === right.agentId &&
    left.modelId === right.modelId && left.modelTruthClass === right.modelTruthClass && left.modelAlias === right.modelAlias &&
    left.selectedAt === right.selectedAt && left.capabilityDigest === right.capabilityDigest &&
    JSON.stringify(sortedSettings(left.settings)) === JSON.stringify(sortedSettings(right.settings))
}

function sortedSettings(settings: Readonly<Record<string, PortableAgentSettingValue>>): Record<string, PortableAgentSettingValue> {
  return Object.fromEntries(Object.entries(settings).sort(([left], [right]) => left.localeCompare(right)))
}

async function collectHandoffText(prompt: string, required: boolean): Promise<string> {
  const value = await vscode.window.showInputBox({
    prompt,
    ignoreFocusOut: true,
    validateInput: (candidate) => validateHandoffText(candidate, required),
  })
  if (value === undefined) throw new WorkflowCancelled()
  const issue = validateHandoffText(value, required)
  if (issue) throw new TypeError(issue)
  return value.trim()
}

async function collectHandoffList(prompt: string): Promise<readonly string[]> {
  const value = await collectHandoffText(prompt, false)
  if (!value) return Object.freeze([])
  const entries = value.split(",").map((entry) => entry.trim())
  if (entries.length > 256) throw new TypeError("Handoff detail lists can contain at most 256 entries")
  for (const entry of entries) {
    const issue = validateHandoffText(entry, true, 2_000)
    if (issue) throw new TypeError(issue)
  }
  return Object.freeze(entries)
}

function validateHandoffText(value: string, required: boolean, maximum = 5_000): string | undefined {
  const normalized = value.trim()
  if (required && normalized.length < 2) return "Enter at least two portable characters"
  if (!normalized && !required) return undefined
  if (normalized.length > maximum || /[\u0000-\u001F\u007F-\u009F]/u.test(normalized) ||
    /(?:^|[\s(="'])(?:~[\\/]|\/(?!\/)[^\s"'<>)]*|[A-Za-z]:[\\/][^\s"'<>)]*|\\\\[^\s"'<>)]*|file:\/\/[^\s"'<>)]*)/u.test(normalized) ||
    /\bBearer\s+\S+|\b(?:sk|sk-ant)-[A-Za-z0-9_-]{8,}\b|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b|\bAKIA[A-Z0-9]{16}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:token|secret|password|passwd|api[_-]?key)\s*[:=]\s*\S+/iu.test(normalized)) {
    return "Use portable text without machine paths, controls, or secret-shaped values"
  }
  return undefined
}

async function showAgentHandoffDocument(handoff: AgentHandoff): Promise<void> {
  const lines = [
    "GAEP versioned Agent Handoff",
    "",
    `Handoff: ${handoff.id}`,
    `Source Run: ${handoff.fromRunId}`,
    `Target: ${handoff.toAgent.agentId} / ${handoff.toAgent.modelId}`,
    `Created at: ${handoff.createdAt}`,
    `Workspace observation: dirty=${handoff.workspaceBaseline.dirty ?? "unknown"}; changed files=${handoff.workspaceBaseline.changedFiles.length}; truth=${handoff.workspaceBaseline.truthClass ?? "not recorded"}`,
    `Preserved entries: completed=${handoff.completedWork.length}; unresolved=${handoff.unresolvedMatters.length}; decisions=${handoff.decisions.length}; evidence=${handoff.evidence.length}`,
    "Capability differences:",
    ...handoff.capabilityDifferences.map((difference) => `  - ${difference}`),
    "",
    "Boundary: the handoff atomically replaced portable Agent Selection, but did not start or resume a provider, create a Run, approve tools or effects, or grant execution authority.",
    "Machine-local paths, credentials, provider sessions, and raw provider output are not included.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
}

interface AgentTarget {
  readonly snapshot: AgentReadinessSnapshot
  readonly modelId: string
  readonly settings: Readonly<Record<string, PortableAgentSettingValue>>
}

async function collectAgentTarget(client: GaepEngineClient, title: string): Promise<AgentTarget> {
  const snapshots = await client.probeAgentReadiness()
  const available = snapshots.filter((snapshot) => snapshot.detected && snapshot.executionInterface !== "unavailable")
  if (available.length === 0) {
    throw new ConfigurationBoundaryError("No verified local Codex or Claude adapter is currently available for selection.")
  }
  const adapter = await vscode.window.showQuickPick(
    available.map((snapshot) => ({
      label: snapshot.agentLabel,
      description: `${snapshot.adapterId} · ${snapshot.executionInterface} (${snapshot.interfaceMaturity})`,
      detail: `${snapshot.models.length} model${snapshot.models.length === 1 ? "" : "s"}; ${snapshot.settings.length} portable setting${snapshot.settings.length === 1 ? "" : "s"}`,
      snapshot,
    })),
    {
      title,
      placeHolder: "Portable configuration only; this does not start an agent",
      ignoreFocusOut: true,
    },
  )
  if (!adapter) throw new WorkflowCancelled()
  return Object.freeze({
    snapshot: adapter.snapshot,
    modelId: await selectAgentModel(adapter.snapshot),
    settings: await collectAgentSettings(adapter.snapshot.settings),
  })
}

async function selectAgentModel(snapshot: AgentReadinessSnapshot): Promise<string> {
  const manual = Symbol("manual-model")
  const chosen = await vscode.window.showQuickPick(
    [
      ...snapshot.models.map((model) => ({
        label: model.label,
        description: `${model.id} · ${model.truthClass}${model.alias ? " · alias" : ""}`,
        value: model.id as string | typeof manual,
      })),
      {
        label: "Enter another model ID…",
        description: "The engine will verify it against the current capability snapshot",
        value: manual as string | typeof manual,
      },
    ],
    {
      title: `Select a model for ${snapshot.agentLabel}`,
      placeHolder: "Dismiss to leave Agent Selection unchanged",
      ignoreFocusOut: true,
    },
  )
  if (!chosen) throw new WorkflowCancelled()
  if (chosen.value !== manual) return chosen.value
  const entered = await vscode.window.showInputBox({
    title: `Enter a portable model ID for ${snapshot.agentLabel}`,
    prompt: "The local engine must verify this model against the current adapter capabilities.",
    ignoreFocusOut: true,
    validateInput: (value) => validatePortableInput(value, true, "Model ID"),
  })
  if (entered === undefined) throw new WorkflowCancelled()
  const issue = validatePortableInput(entered, true, "Model ID")
  if (issue) throw new TypeError(issue)
  return entered
}

async function collectAgentSettings(
  declarations: readonly AgentSelectionSetting[],
): Promise<Readonly<Record<string, PortableAgentSettingValue>>> {
  const values: Record<string, PortableAgentSettingValue> = Object.create(null) as Record<string, PortableAgentSettingValue>
  for (const setting of declarations) {
    if (setting.sensitive) {
      throw new ConfigurationBoundaryError(
        `${setting.label} requires a machine-local credential binding, which this portable Kiro selection flow does not collect or store.`,
      )
    }
    const value = await collectAgentSetting(setting)
    if (value !== undefined) values[setting.key] = value
  }
  return Object.freeze(values)
}

async function collectAgentSetting(setting: AgentSelectionSetting): Promise<PortableAgentSettingValue | undefined> {
  if (setting.kind === "select") {
    const options = setting.options ?? []
    if (options.length === 0 && setting.required && setting.defaultValue === undefined) {
      throw new ConfigurationBoundaryError(`${setting.label} is required but the verified adapter declared no selectable values.`)
    }
    const useDefault = Symbol("use-default")
    const choices: Array<vscode.QuickPickItem & { readonly value: string | typeof useDefault }> = []
    if (!setting.required || setting.defaultValue !== undefined) {
      choices.push({
        label: "Use adapter default",
        description: setting.defaultValue === undefined ? "No explicit override" : `Declared default: ${formatSettingDefault(setting.defaultValue)}`,
        value: useDefault,
      })
    }
    choices.push(...options.map((option) => ({
      label: option.label,
      description: option.value,
      ...(option.description !== undefined ? { detail: option.description } : {}),
      value: option.value,
    })))
    const selected = await vscode.window.showQuickPick(
      choices,
      { title: setting.label, placeHolder: setting.description, ignoreFocusOut: true },
    )
    if (!selected) throw new WorkflowCancelled()
    return selected.value === useDefault ? undefined : selected.value
  }
  if (setting.kind === "boolean") {
    const useDefault = Symbol("use-default")
    const selected = await vscode.window.showQuickPick(
      [
        ...(setting.required && setting.defaultValue === undefined ? [] : [{
          label: "Use adapter default",
          description: setting.defaultValue === undefined ? "No explicit override" : `Declared default: ${formatSettingDefault(setting.defaultValue)}`,
          value: useDefault as boolean | typeof useDefault,
        }]),
        { label: "True", value: true as boolean | typeof useDefault },
        { label: "False", value: false as boolean | typeof useDefault },
      ],
      { title: setting.label, placeHolder: setting.description, ignoreFocusOut: true },
    )
    if (!selected) throw new WorkflowCancelled()
    return selected.value === useDefault ? undefined : selected.value
  }

  const defaultText = setting.defaultValue === undefined ? "" : formatSettingDefault(setting.defaultValue)
  const entered = await vscode.window.showInputBox({
    title: setting.label,
    prompt: setting.kind === "string-list" ? `${setting.description} Enter comma-separated values.` : setting.description,
    value: defaultText,
    ignoreFocusOut: true,
    validateInput: (value) => validateSettingInput(setting, value),
  })
  if (entered === undefined) throw new WorkflowCancelled()
  const issue = validateSettingInput(setting, entered)
  if (issue) throw new TypeError(issue)
  if (!entered.trim() && (!setting.required || setting.defaultValue !== undefined)) return undefined
  if (setting.kind === "number") return Number(entered)
  if (setting.kind === "string-list") return Object.freeze(entered.split(",").map((value) => value.trim()))
  return entered
}

function validateSettingInput(setting: AgentSelectionSetting, value: string): string | undefined {
  if (!value.trim() && (!setting.required || setting.defaultValue !== undefined)) return undefined
  if (!value.trim()) return `${setting.label} is required`
  if (setting.kind === "number") {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return `${setting.label} must be a finite number`
    if (setting.minimum !== undefined && parsed < setting.minimum) return `${setting.label} must be at least ${setting.minimum}`
    if (setting.maximum !== undefined && parsed > setting.maximum) return `${setting.label} must be at most ${setting.maximum}`
    return undefined
  }
  if (setting.kind === "string-list") {
    const items = value.split(",").map((item) => item.trim())
    if (items.some((item) => !item)) return `${setting.label} must be a comma-separated list of non-empty values`
    for (const item of items) {
      const issue = validatePortableInput(item, true, setting.label)
      if (issue) return issue
    }
    return undefined
  }
  return validatePortableInput(value, true, setting.label)
}

function validatePortableInput(value: string, required: boolean, label: string): string | undefined {
  if (required && !value) return `${label} is required`
  if (value.length > 10_000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value) ||
    /^(?:\/|[A-Za-z]:[\\/]|\\\\|file:\/\/|~[\\/])/u.test(value) ||
    /\bBearer\s+\S+|\b(?:sk|sk-ant)-[A-Za-z0-9_-]{8,}\b|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b|\bAKIA[A-Z0-9]{16}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:token|secret|password|passwd|api[_-]?key)\s*[:=]\s*\S+|^\$\{?[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY)[A-Z0-9_]*\}?$/iu.test(value)) {
    return `${label} must be portable text without paths, controls, or secret-shaped values`
  }
  return undefined
}

function formatSettingDefault(value: PortableAgentSettingValue): string {
  return Array.isArray(value) ? value.join(", ") : String(value)
}

async function showAgentSelectionDocument(selection: AgentSelection): Promise<void> {
  const lines = [
    "GAEP guarded Agent Selection",
    "",
    `Agent: ${selection.agentId}`,
    `Adapter: ${selection.adapterId}`,
    `Model: ${selection.modelId}`,
    `Model evidence: ${selection.modelTruthClass}${selection.modelAlias ? " (alias)" : ""}`,
    `Selected at: ${selection.selectedAt}`,
    `Portable settings: ${Object.keys(selection.settings).length}`,
    ...Object.entries(selection.settings).map(([key, value]) => `  - ${key}: ${formatSettingDefault(value)}`),
    "",
    "Boundary: this record does not start a provider, create or resume a Run, approve tools or effects, or grant execution authority.",
    "Machine-local executable paths, credentials, and raw provider output are not included.",
  ]
  const document = await vscode.workspace.openTextDocument({ language: "plaintext", content: `${lines.join("\n")}\n` })
  await vscode.window.showTextDocument(document, { preview: true })
}

function renderAgentReadiness(snapshot: AgentReadinessSnapshot): readonly string[] {
  const models = snapshot.models.slice(0, 20).map((model) =>
    `  - ${model.label} (${model.id}; ${model.truthClass}${model.alias ? "; alias" : ""})`,
  )
  const limitations = snapshot.limitations.slice(0, 20).map((limitation) => `  - ${limitation}`)
  return [
    snapshot.agentLabel,
    `  Adapter: ${snapshot.adapterId} ${snapshot.adapterVersion}`,
    `  Detected: ${snapshot.detected ? "yes" : "no"}`,
    `  Runtime version: ${snapshot.runtimeVersion ?? "not observed"}`,
    `  Interface: ${snapshot.executionInterface} (${snapshot.interfaceMaturity})`,
    `  Capabilities: resume=${yesNo(snapshot.supportsResume)}, cancel=${yesNo(snapshot.supportsCancel)}, checkpoints=${yesNo(snapshot.supportsCheckpoints)}, model discovery=${yesNo(snapshot.supportsModelDiscovery)}, tool selection=${yesNo(snapshot.supportsToolSelection)}`,
    `  Declared settings: ${snapshot.settingsCount}`,
    `  Models observed: ${snapshot.models.length}`,
    ...(models.length ? models : ["  - none observed"]),
    ...(snapshot.models.length > models.length ? [`  - ${snapshot.models.length - models.length} more withheld from this compact view`] : []),
    `  Limitations: ${snapshot.limitations.length}`,
    ...(limitations.length ? limitations : ["  - none declared"]),
    ...(snapshot.limitations.length > limitations.length ? [`  - ${snapshot.limitations.length - limitations.length} more withheld from this compact view`] : []),
    `  Observed at: ${snapshot.observedAt}`,
    "",
  ]
}

function yesNo(value: boolean): "yes" | "no" {
  return value ? "yes" : "no"
}

async function assertExactContext(
  folder: vscode.WorkspaceFolder,
  client: GaepEngineClient,
  expected: ProductBinding,
): Promise<void> {
  requireTrustedWorkspace()
  const currentFolder = vscode.workspace.workspaceFolders?.find((candidate) => candidate.uri.toString() === folder.uri.toString())
  if (!currentFolder || currentFolder.uri.scheme !== "file") {
    throw new ConfigurationBoundaryError(
      "The Product root or trust context changed while the import was open. No portable-design snapshot was imported.",
    )
  }
  const current = await client.readProduct()
  if (current.id !== expected.id || current.revision !== expected.revision) {
    throw new ConfigurationBoundaryError(
      "The Product identity or revision changed while the import was open. Refresh Product Studio before trying again.",
    )
  }
}

function importAnnouncement(snapshot: PortableDesignSnapshotSummary): string {
  return [
    `Imported one local portable-design snapshot as ${snapshot.governance.state} with ${snapshot.counts.artifacts} validated artifact${snapshot.counts.artifacts === 1 ? "" : "s"}.`,
    `The upstream sourceReview value is ${snapshot.sourceReview.status}; it is not GAEP approval, a Design Baseline, implementation readiness, or release readiness.`,
    "Only validated metadata and digests were retained; local paths, source bytes, access tokens, credentials, and external-account state were not copied into this host.",
  ].join(" ")
}

function requireTrustedWorkspace(): void {
  if (!vscode.workspace.isTrusted) {
    throw new ConfigurationBoundaryError(
      "Trust this workspace before GAEP for Kiro inspects Product state or starts the local engine.",
    )
  }
}

async function selectWorkspaceFolder(): Promise<vscode.WorkspaceFolder> {
  const localFolders = (vscode.workspace.workspaceFolders ?? []).filter((folder) => folder.uri.scheme === "file")
  if (localFolders.length === 0) {
    throw new ConfigurationBoundaryError("Open a local workspace folder that owns the GAEP Product before continuing.")
  }
  if (localFolders.length === 1) return localFolders[0]!
  const selected = await vscode.window.showQuickPick(
    localFolders.map((folder) => ({ label: folder.name, description: folder.uri.fsPath, folder })),
    { title: "Select the exact local GAEP Product root", ignoreFocusOut: true },
  )
  if (!selected) throw new WorkflowCancelled()
  return selected.folder
}

function machineSetting(key: string, environmentName: string | undefined, fallback: string): string {
  const inspected = vscode.workspace.getConfiguration("gaepKiro").inspect<string>(key)
  if (inspected && hasWorkspaceOverride(inspected)) {
    throw new ConfigurationBoundaryError(
      `GAEP for Kiro rejected a workspace-scoped override for gaepKiro.${key}. Configure it at machine/user scope instead.`,
    )
  }
  const environmentValue = environmentName ? process.env[environmentName] : undefined
  const value = inspected?.globalValue ?? environmentValue ?? inspected?.defaultValue ?? fallback
  if (typeof value !== "string") {
    throw new ConfigurationBoundaryError(`GAEP for Kiro requires gaepKiro.${key} to be a machine-scoped string.`)
  }
  return value
}

function hasWorkspaceOverride(inspected: ReturnType<vscode.WorkspaceConfiguration["inspect"]>): boolean {
  if (!inspected) return false
  const candidate = inspected as unknown as Record<string, unknown>
  return ["workspaceValue", "workspaceFolderValue", "workspaceLanguageValue", "workspaceFolderLanguageValue"]
    .some((name) => candidate[name] !== undefined)
}

async function runUserCommand<T>(operation: () => Promise<T>): Promise<T | undefined> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof WorkflowCancelled || error instanceof InitiativeEntryWorkflowCancelled) return undefined
    if (error instanceof GaepHostError || error instanceof ConfigurationBoundaryError ||
      error instanceof TypeError || error instanceof RangeError) {
      await vscode.window.showErrorMessage(error.message)
      return undefined
    }
    await vscode.window.showErrorMessage(
      "GAEP for Kiro could not complete the local request. No raw engine output or provider state was shown.",
    )
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]!)
}
