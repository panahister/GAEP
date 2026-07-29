import type {
  AdapterCapabilities,
  AgentModelDashboard,
  AgentModelDashboardRequest,
  AgentSelection,
  AgentSelectionState,
  ArchitectureRecord,
  BoundedContextModelProjection,
  BusinessArchitectureBaselineProjection,
  BusinessCapabilityMapProjection,
  BusinessRuleCatalogProjection,
  BusinessUnderstandingProjection,
  Change,
  ChangeImpactDashboard,
  ChangeImpactDashboardRequest,
  ContextPack,
  Decision,
  DesignReadinessReport,
  EvidenceRecord,
  Handoff,
  InstructionPrivilegeGrant,
  Initiative,
  InitiativeEntryAssessment,
  ManagedApplyDecisionReceipt,
  ManagedEvidenceEvent,
  ManagedRunEvidence,
  ManagedRunRecord,
  ManagedRunResult,
  Product,
  ProductDesignDraft,
  ProductDesignRevision,
  ProductDomainSearchResult,
  ProductImportPreview,
  ProductRevision,
  Requirement,
  Risk,
  Run,
  RunToolSelection,
  SecurityPrivacyAssessmentProjection,
  ProcessModelProjection,
  DataModelProjection,
  AuthorizationModelProjection,
  EventIntegrationModelProjection,
  FailureRecoveryModelProjection,
  ArchitectureChallengeModelProjection,
  DecisionRegisterProjection,
  RiskRegisterProjection,
  EvidenceRegistryProjection,
  EndToEndTraceabilityProjection,
  P0P4ReadinessGateProjection,
  P0P4ReadinessGate,
  P5HandoffPackageProjection,
  P5HandoffPackage,
  DesignApplicabilityProjection,
  DesignPersonaRoleModelProjection,
  UserJourneyModelProjection,
  InformationArchitectureModelProjection,
  ScreenStateInventoryProjection,
  DesignRequirementsProjection,
  DesignSystemTokenContractProjection,
  AccessibilityDesignRulesProjection,
  ResponsiveMultiPlatformTargetsProjection,
  ManualFigmaExecutionPathProjection,
  FigmaMcpCapabilityDiscoveryProjection,
  FigmaReadSnapshotProjection,
  FigmaContextImportProjection,
  OutboundDesignBriefPackageProjection,
  GovernedFigmaWriteProjection,
  FinalizedFigmaSnapshotImportProjection,
  SourceGovernanceProjection,
  SystemSolutionArchitectureProjection,
  ToolDefinition,
  TraceImpact,
  TraceLink,
  OperatingModelProjection,
  ValueStreamModelProjection,
  WorkItem,
  WorkflowPlan,
  WorkspaceHealthIssue,
  DeliveryPhaseId,
  Phase1SummaryDashboard,
  Phase1ChangeImpactDashboard,
  Phase1AgentModelDashboard,
  PhaseDashboardFramework,
} from "@gaep/contracts"
import { containsSecretShapedValue } from "@gaep/contracts"
import { canonicalDigest, capabilityDigest } from "@gaep/agent-sdk"
import {
  composeAgentModelDashboard,
  composeChangeImpactDashboard,
  composePhase1SummaryDashboard,
  composePhase1ChangeImpactDashboard,
  composePhase1AgentModelDashboard,
  composePhaseDashboardFramework,
} from "@gaep/engine"
import type {
  ManagedRunListPage,
  ManagedRunListPageInput,
  ProductStudioPage,
  ProductStudioRecordMap,
  ProductStudioService,
} from "@gaep/engine"

import type { PortableHandoffObservation } from "./handoff-observation.js"
import { managedRecoveryPresentation } from "./managed-recovery-presentation.js"
import { readVerifiedManagedArtifacts } from "./managed-evidence-verifier.js"
import type { PortableDesignSnapshot } from "./portable-design-workflow.js"
import { agentStatus } from "./provider-truth.js"
import { currentInitiative, initiativeRunEligibility, newestRun, unsafeSelectionReasons } from "./safety.js"
import {
  resolveRuntimeBinding,
  type RuntimeBindingIndex,
  type RuntimeBindingResolution,
} from "./runtime-binding.js"
import type { StudioDataSource, StudioRequestContext } from "./studio-data-source.js"
import {
  studioProtocolVersion,
  studioRouteLabels,
  studioRoutes,
  type AgentPageSnapshot,
  type CompletionState,
  type DeliveryPageSnapshot,
  type OverviewPageSnapshot,
  type OverviewSectionStatus,
  type ReadinessPageSnapshot,
  type RecordFormPageSnapshot,
  type RecordFormRoute,
  type RisksDecisionsPageSnapshot,
  type RunPageSnapshot,
  type StudioAction,
  type StudioActionControl,
  type StudioActionResult,
  type StudioDefinitionEntry,
  type StudioDesignSectionSnapshot,
  type StudioDomainPageKind,
  type StudioFieldSnapshot,
  type StudioInspectorSnapshot,
  type StudioIssue,
  type StudioPageSnapshot,
  type StudioRoute,
  type StudioSnapshot,
  type StudioSurfaceState,
  type StudioTableSnapshot,
  type TracePageSnapshot,
} from "./studio-protocol.js"

export interface CurrentStudioEngineReader {
  readProduct(): Promise<Product>
  readSelection(): Promise<AgentSelection>
  readSelectionState?(): Promise<AgentSelectionState>
  assessInitiativeEntry?(id: string): Promise<InitiativeEntryAssessment>
  listRuns(): Promise<Run[]>
  listManagedRuns?(): Promise<ManagedRunRecord[]>
  listManagedRunsPage?(input?: ManagedRunListPageInput): Promise<ManagedRunListPage>
  readManagedRunResult?(id: string): Promise<ManagedRunResult>
  readManagedRunEvidence?(id: string): Promise<ManagedRunEvidence>
  readManagedApplyDecision?(id: string): Promise<ManagedApplyDecisionReceipt>
  repository: {
    verifyAudit(): Promise<{ valid: boolean; events: number; error?: string; warning?: string }>
  }
  productStudio?: ProductStudioService
  sourceGovernance?: {
    project(initiativeId: string): Promise<SourceGovernanceProjection>
  }
  businessUnderstanding?: {
    project(initiativeId: string): Promise<BusinessUnderstandingProjection>
  }
  businessCapabilityMap?: {
    project(initiativeId: string): Promise<BusinessCapabilityMapProjection>
  }
  valueStreamModel?: {
    project(initiativeId: string): Promise<ValueStreamModelProjection>
  }
  operatingModel?: {
    project(initiativeId: string): Promise<OperatingModelProjection>
  }
  businessRuleCatalog?: {
    project(initiativeId: string): Promise<BusinessRuleCatalogProjection>
  }
  businessArchitectureBaseline?: {
    project(initiativeId: string): Promise<BusinessArchitectureBaselineProjection>
  }
  systemSolutionArchitecture?: {
    project(initiativeId: string): Promise<SystemSolutionArchitectureProjection>
  }
  boundedContextModel?: {
    project(initiativeId: string): Promise<BoundedContextModelProjection>
  }
  securityPrivacyAssessment?: {
    project(initiativeId: string): Promise<SecurityPrivacyAssessmentProjection>
  }
  processModel?: {
    project(initiativeId: string): Promise<ProcessModelProjection>
  }
  dataModel?: {
    project(initiativeId: string): Promise<DataModelProjection>
  }
  authorizationModel?: {
    project(initiativeId: string): Promise<AuthorizationModelProjection>
  }
  eventIntegrationModel?: {
    project(initiativeId: string): Promise<EventIntegrationModelProjection>
  }
  failureRecoveryModel?: {
    project(initiativeId: string): Promise<FailureRecoveryModelProjection>
  }
  architectureChallengeModel?: {
    project(initiativeId: string): Promise<ArchitectureChallengeModelProjection>
  }
  decisionRegister?: {
    project(initiativeId: string): Promise<DecisionRegisterProjection>
  }
  riskRegister?: {
    project(initiativeId: string): Promise<RiskRegisterProjection>
  }
  evidenceRegistry?: {
    project(initiativeId: string): Promise<EvidenceRegistryProjection>
  }
  endToEndTraceability?: {
    project(initiativeId: string): Promise<EndToEndTraceabilityProjection>
  }
  p0P4ReadinessGate?: {
    project(initiativeId: string): Promise<P0P4ReadinessGateProjection>
    readCurrent?(initiativeId: string): Promise<P0P4ReadinessGate | undefined>
  }
  p5HandoffPackage?: {
    project(initiativeId: string): Promise<P5HandoffPackageProjection>
    readCurrent?(initiativeId: string): Promise<P5HandoffPackage | undefined>
  }
  designApplicability?: {
    project(initiativeId: string): Promise<DesignApplicabilityProjection>
  }
  designPersonaRoleModel?: {
    project(initiativeId: string): Promise<DesignPersonaRoleModelProjection>
  }
  userJourneyModel?: {
    project(initiativeId: string): Promise<UserJourneyModelProjection>
  }
  informationArchitectureModel?: {
    project(initiativeId: string): Promise<InformationArchitectureModelProjection>
  }
  screenStateInventory?: {
    project(initiativeId: string): Promise<ScreenStateInventoryProjection>
  }
  designRequirements?: {
    project(initiativeId: string): Promise<DesignRequirementsProjection>
  }
  designSystemTokenContract?: {
    project(initiativeId: string): Promise<DesignSystemTokenContractProjection>
  }
  accessibilityDesignRules?: {
    project(initiativeId: string): Promise<AccessibilityDesignRulesProjection>
  }
  responsiveMultiPlatformTargets?: {
    project(initiativeId: string): Promise<ResponsiveMultiPlatformTargetsProjection>
  }
  manualFigmaExecutionPath?: {
    project(initiativeId: string): Promise<ManualFigmaExecutionPathProjection>
  }
  figmaMcpCapabilityDiscovery?: {
    project(initiativeId: string): Promise<FigmaMcpCapabilityDiscoveryProjection>
  }
  figmaReadSnapshot?: {
    project(initiativeId: string): Promise<FigmaReadSnapshotProjection>
  }
  figmaContextImport?: {
    project(initiativeId: string): Promise<FigmaContextImportProjection>
  }
  outboundDesignBriefPackage?: {
    project(initiativeId: string): Promise<OutboundDesignBriefPackageProjection>
  }
  governedFigmaWrite?: {
    project(initiativeId: string): Promise<GovernedFigmaWriteProjection>
  }
  finalizedFigmaSnapshotImport?: {
    project(initiativeId: string): Promise<FinalizedFigmaSnapshotImportProjection>
  }
}

export type ExistingStudioCommand =
  | "gaep.initializeProduct"
  | "gaep.selectWorkspaceRoot"
  | "gaep.createInitiative"
  | "gaep.classifyInitiative"
  | "gaep.resolveInitiativeApplicability"
  | "gaep.changeInitiativeState"
  | "gaep.selectAgent"
  | "gaep.prepareRun"
  | "gaep.verifyAudit"
  | "gaep.showDiagnostics"
  | "gaep.manageWorkspaceTrust"
  | "gaep.retryRecovery"
  | "gaep.reviewManagedRun"
  | "gaep.productStudio.domainWorkflow"

export interface CurrentEngineStudioContext {
  contextGeneration(): string
  deliveryPhase(): DeliveryPhaseId
  trusted(): boolean
  workspace(): { name: string; path: string } | undefined
  engine(): CurrentStudioEngineReader | undefined
  recoveryDiagnostic(): string | undefined
  hasGaepState(): Promise<boolean>
  listInitiatives(): Promise<Initiative[]>
  listHandoffs?(): Promise<PortableHandoffObservation>
  probeAgents(): Promise<AdapterCapabilities[]>
  runtimeBindings(): RuntimeBindingIndex
  actorId(): string
  executeCommand(expectedContextGeneration: string, command: ExistingStudioCommand, ...args: unknown[]): PromiseLike<unknown>
  logDiagnostic(message: string, error?: unknown): void
}

interface ObservedStudioState {
  product?: Product
  initiatives: Initiative[]
  initiativeEntryAssessments: Map<string, InitiativeEntryAssessment>
  businessUnderstandingProjections: Map<string, BusinessUnderstandingProjection>
  businessCapabilityMapProjections: Map<string, BusinessCapabilityMapProjection>
  valueStreamModelProjections: Map<string, ValueStreamModelProjection>
  operatingModelProjections: Map<string, OperatingModelProjection>
  businessRuleCatalogProjections: Map<string, BusinessRuleCatalogProjection>
  businessArchitectureBaselineProjections: Map<string, BusinessArchitectureBaselineProjection>
  systemSolutionArchitectureProjections: Map<string, SystemSolutionArchitectureProjection>
  boundedContextModelProjections: Map<string, BoundedContextModelProjection>
  securityPrivacyAssessmentProjections: Map<string, SecurityPrivacyAssessmentProjection>
  processModelProjections: Map<string, ProcessModelProjection>
  dataModelProjections: Map<string, DataModelProjection>
  authorizationModelProjections: Map<string, AuthorizationModelProjection>
  eventIntegrationModelProjections: Map<string, EventIntegrationModelProjection>
  failureRecoveryModelProjections: Map<string, FailureRecoveryModelProjection>
  architectureChallengeModelProjections: Map<string, ArchitectureChallengeModelProjection>
  decisionRegisterProjections: Map<string, DecisionRegisterProjection>
  riskRegisterProjections: Map<string, RiskRegisterProjection>
  evidenceRegistryProjections: Map<string, EvidenceRegistryProjection>
  endToEndTraceabilityProjections: Map<string, EndToEndTraceabilityProjection>
  p0P4ReadinessGateProjections: Map<string, P0P4ReadinessGateProjection>
  p5HandoffPackageProjections: Map<string, P5HandoffPackageProjection>
  designApplicabilityProjections: Map<string, DesignApplicabilityProjection>
  designPersonaRoleProjections: Map<string, DesignPersonaRoleModelProjection>
  userJourneyProjections: Map<string, UserJourneyModelProjection>
  informationArchitectureProjections: Map<string, InformationArchitectureModelProjection>
  screenStateInventoryProjections: Map<string, ScreenStateInventoryProjection>
  designRequirementsProjections: Map<string, DesignRequirementsProjection>
  designSystemTokenContractProjections: Map<string, DesignSystemTokenContractProjection>
  accessibilityDesignRulesProjections: Map<string, AccessibilityDesignRulesProjection>
  responsiveMultiPlatformTargetsProjections: Map<string, ResponsiveMultiPlatformTargetsProjection>
  manualFigmaExecutionPathProjections: Map<string, ManualFigmaExecutionPathProjection>
  figmaMcpCapabilityDiscoveryProjections: Map<string, FigmaMcpCapabilityDiscoveryProjection>
  figmaReadSnapshotProjections: Map<string, FigmaReadSnapshotProjection>
  figmaContextImportProjections: Map<string, FigmaContextImportProjection>
  outboundDesignBriefPackageProjections: Map<string, OutboundDesignBriefPackageProjection>
  governedFigmaWriteProjections: Map<string, GovernedFigmaWriteProjection>
  finalizedFigmaSnapshotImportProjections: Map<string, FinalizedFigmaSnapshotImportProjection>
  sourceGovernanceProjections: Map<string, SourceGovernanceProjection>
  runs: Run[]
  runsObserved: boolean
  managedRuns: ManagedRunObservation[]
  managedRunTotal: number
  managedRunsObserved: boolean
  handoffs: Handoff[]
  handoffTotal: number
  handoffsObserved: boolean
  handoffSelectedFileCount: number
  handoffOmittedOutsideWindow: number
  handoffOmittedForResourceSafety: number
  handoffPlatformAttestationUnavailable: boolean
  selectedRecordId?: string
  selection?: AgentSelection
  selectionState?: AgentSelectionState
  agents: AdapterCapabilities[]
  audit?: { valid: boolean; events: number; error?: string; warning?: string }
  runtimeBinding?: RuntimeBindingResolution
  selectionMigrationRequired?: boolean
  issues: StudioIssue[]
  productState: "available" | "absent" | "invalid"
  designDraft?: ProductDesignDraft
  designReadiness?: DesignReadinessReport
  designRevisions: ProductDesignRevision[]
  productRevisions: ProductRevision[]
  changes: Change[]
  workItems: WorkItem[]
  requirements: Requirement[]
  decisions: Decision[]
  risks: Risk[]
  architecture: ArchitectureRecord[]
  evidence: EvidenceRecord[]
  contextPacks: ContextPack[]
  instructionPrivilegeGrants: InstructionPrivilegeGrant[]
  workflowPlans: WorkflowPlan[]
  toolDefinitions: ToolDefinition[]
  runToolSelections: RunToolSelection[]
  traceLinks: TraceLink[]
  health: WorkspaceHealthIssue[]
  healthTotal: number
  searchResults: ProductDomainSearchResult[]
  searchResultTotal: number
  impact?: TraceImpact
  importPreview?: ProductImportPreview
  portableDesignSnapshots: PortableDesignSnapshot[]
  selectedPortableDesignSnapshot?: PortableDesignSnapshot
  domainPages: Partial<Record<StudioDomainPageKind, ProductStudioPageMetadata>>
}

interface ManagedRunObservation {
  record: ManagedRunRecord
  result?: ManagedRunResult
  evidence?: ManagedRunEvidence
  applyDecision?: ManagedApplyDecisionReceipt
  issue?: string
}

interface ProductStudioPageMetadata {
  offset: number
  limit: number
  total: number
  hasMore: boolean
}

function control(
  label: string,
  action: StudioAction,
  enabled = true,
  emphasis: StudioActionControl["emphasis"] = "secondary",
  disabledReason?: string,
): StudioActionControl {
  return { label, action, enabled, emphasis, ...(disabledReason ? { disabledReason } : {}) }
}

function issue(
  id: string,
  message: string,
  severity: StudioIssue["severity"] = "warning",
  sourceRecordId?: string,
): StudioIssue {
  return { id, message, severity, ...(sourceRecordId ? { sourceRecordId } : {}) }
}

function emptySurface(title: string, detail: string, actions: StudioActionControl[] = []): StudioSurfaceState {
  return { kind: "empty", title, detail, issues: [], actions }
}

function domainControl(
  label: string,
  workflow: Extract<StudioAction, { kind: "domain-workflow" }>["workflow"],
  recordId?: string,
  expectedRevision?: number,
  emphasis: StudioActionControl["emphasis"] = "secondary",
): StudioActionControl {
  return control(label, {
    kind: "domain-workflow",
    workflow,
    ...(recordId ? { recordId } : {}),
    ...(expectedRevision ? { expectedRevision } : {}),
  }, true, emphasis)
}

function recordEmpty(id: string, title: string, createLabel: string, workflow: Extract<StudioAction, { kind: "domain-workflow" }>["workflow"]): StudioTableSnapshot {
  const action = domainControl(createLabel, workflow, undefined, undefined, "primary")
  return {
    id,
    title,
    columns: [],
    rows: [],
    actions: [action],
    emptyState: emptySurface(`No ${title}`, `Create the first governed ${title.toLocaleLowerCase()} record.`, [action]),
  }
}

function source(product?: Product, provenance = "Current GAEP engine snapshot") {
  return {
    ...(product ? { recordId: product.id, sourceRevision: product.revision } : {}),
    provenance,
    freshness: "Read when this snapshot was created",
  }
}

function base<R extends StudioRoute>(route: R, product?: Product) {
  return {
    route,
    title: studioRouteLabels[route],
    purpose: purposeFor(route),
    source: source(product),
    actions: [] as StudioActionControl[],
  }
}

function purposeFor(route: StudioRoute): string {
  switch (route) {
    case "overview": return "See current Product truth, progress, blockers, and the next governed move."
    case "direction": return "Define why the Product should exist and which problem it addresses."
    case "users-jobs": return "Capture affected users, their jobs, and the workflow context."
    case "outcomes": return "Define desired outcomes and observable success signals."
    case "scope": return "Bound included and excluded Product scope."
    case "delivery": return "Manage bounded Initiatives and, when available, Changes and Work Items."
    case "architecture": return "Record the Product architecture and material technical constraints."
    case "risks-decisions": return "Track risks, recommendations, and accountable decisions."
    case "trace": return "Inspect relationships and downstream impact across governed records."
    case "agents-tools": return "Inspect installed agents and choose only a supported execution boundary."
    case "runs-evidence": return "Inspect governed runs, lifecycle state, and available evidence."
    case "readiness": return "Determine what is known, missing, conflicting, and safe to do next."
  }
}

function titleForKey(key: string): string {
  return key.split("-").map((part) => part ? `${part[0]!.toUpperCase()}${part.slice(1)}` : part).join(" ")
}

function portableProvenance(value: string): string {
  return /^(?:human|agent|system|imported):[A-Za-z0-9._-]{1,200}$/.test(value)
    ? value
    : "[non-portable provenance withheld]"
}

function isMissingRecord(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}

function designPanel(route: StudioRoute, state: ObservedStudioState): StudioDesignSectionSnapshot | undefined {
  const draft = state.designDraft
  if (!draft) return undefined
  const section = draft.sections[route]
  const readiness = state.designReadiness?.sections.find((candidate) => candidate.sectionId === route)
  const latest = state.designRevisions[0]
  return {
    sectionId: route,
    draftId: draft.id,
    draftRevision: draft.revision,
    baseProductRevision: draft.baseProductRevision,
    readiness: readiness?.state ?? "missing",
    fields: section.fields.map((field) => ({
      id: field.key,
      label: titleForKey(field.key),
      question: field.question,
      kind: Array.isArray(field.value) ? "string-list" : field.value.length > 160 ? "long-text" : "long-text",
      value: field.value,
      required: true,
      provenance: field.provenance.length > 0 ? field.provenance.map(portableProvenance).join(" · ") : "No provenance recorded",
      validation: {
        state: field.state === "complete" || field.state === "deferred" ? "valid" : "not-validated",
        message: field.state === "deferred"
          ? `Deferred: ${field.deferredReason ?? "reason missing"}${field.revisitTrigger ? ` · Revisit: ${field.revisitTrigger}` : ""}`
          : `Design state: ${field.state}`,
      },
      designState: field.state,
      ...(field.deferredReason ? { deferredReason: field.deferredReason } : {}),
      ...(field.revisitTrigger ? { revisitTrigger: field.revisitTrigger } : {}),
    })),
    gaps: section.gaps.map((gap) => issue(
      gap.id,
      gap.resolution ? `${gap.message} · Resolved: ${gap.resolution}` : gap.message,
      gap.severity === "info" ? "information" : gap.severity,
      draft.id,
    )),
    conflicts: section.conflicts.map((conflict) => issue(
      conflict.id,
      conflict.resolution ? `${conflict.statement} · ${conflict.state}: ${conflict.resolution}` : `${conflict.statement} · ${conflict.state}`,
      conflict.state === "open" ? "blocker" : "information",
      draft.id,
    )),
    materialChange: !latest || JSON.stringify(latest.sections) !== JSON.stringify(draft.sections),
  }
}

function textField(
  id: string,
  label: string,
  question: string,
  value: string | string[],
  provenance: string,
  kind: StudioFieldSnapshot["kind"] = "long-text",
): StudioFieldSnapshot {
  return {
    id,
    label,
    question,
    kind,
    value,
    required: false,
    provenance,
    validation: { state: "not-validated", message: "This is read-only bootstrap context, not a validated governed section." },
    readOnly: true,
  }
}

function legacyForm(route: RecordFormRoute, product?: Product): RecordFormPageSnapshot {
  const provenance = "Legacy Product bootstrap record (read-only)"
  const fields: StudioFieldSnapshot[] = []
  if (product) {
    switch (route) {
      case "direction":
        fields.push(
          textField("summary", "Summary", "What is the current Product summary?", product.summary, provenance, "single-line"),
          textField("problem", "Problem", "What problem does the Product currently claim to solve?", product.problem, provenance),
        )
        break
      case "users-jobs":
        fields.push(
          textField("affected-users", "Affected users", "Who is currently identified as affected?", product.affectedUsers, provenance),
          textField("first-workflow", "First workflow", "What first complete workflow was captured?", product.firstWorkflow, provenance),
        )
        break
      case "outcomes":
        fields.push(
          textField("desired-outcome", "Desired outcome", "What outcome is currently desired?", product.desiredOutcome, provenance),
          textField("success-signals", "Success signals", "Which signals were captured?", product.successSignals, provenance, "string-list"),
        )
        break
      case "scope":
        fields.push(textField("exclusions", "Exclusions", "What is explicitly excluded?", product.exclusions, provenance, "string-list"))
        break
      case "architecture":
        break
    }
  }
  return {
    ...base(route, product),
    kind: "record-form",
    ...(product ? { recordId: product.id, baseRevision: product.revision } : {}),
    fields,
    gaps: [],
    conflicts: [],
    draft: { state: "clean", materialChange: false, validation: "not-validated" },
  }
}

function businessUnderstandingTable(
  route: Extract<RecordFormRoute, "direction" | "users-jobs" | "outcomes">,
  state: ObservedStudioState,
): StudioTableSnapshot {
  const definition = route === "direction"
    ? {
        id: "business-understanding",
        title: "Governed Business Understanding",
        recordLabel: "Business Understanding",
        record: (projection: BusinessUnderstandingProjection) => projection.businessUnderstanding,
        counts: (projection: BusinessUnderstandingProjection) => projection.businessUnderstanding
          ? `${projection.businessUnderstanding.objectiveCount} objectives · ${projection.businessUnderstanding.constraintCount} constraints · ${projection.businessUnderstanding.assumptionCount} assumptions · ${projection.businessUnderstanding.unresolvedQuestionCount} unresolved questions`
          : "",
      }
    : route === "users-jobs"
      ? {
          id: "stakeholder-model",
          title: "Governed Stakeholder Model",
          recordLabel: "Stakeholder Model",
          record: (projection: BusinessUnderstandingProjection) => projection.stakeholderModel,
          counts: (projection: BusinessUnderstandingProjection) => projection.stakeholderModel
            ? `${projection.stakeholderModel.stakeholderCount} stakeholders · ${projection.stakeholderModel.representedCategoryCount} represented categories · ${projection.stakeholderModel.unresolvedCategoryCount} unresolved categories · ${projection.stakeholderModel.verifiedAuthorityCount} verified authority claims`
            : "",
        }
      : {
          id: "outcome-model",
          title: "Governed Outcome Model",
          recordLabel: "Outcome Model",
          record: (projection: BusinessUnderstandingProjection) => projection.outcomeModel,
          counts: (projection: BusinessUnderstandingProjection) => projection.outcomeModel
            ? `${projection.outcomeModel.outcomeCount} outcomes · ${projection.outcomeModel.measureCount} measures · ${projection.outcomeModel.countermetricCount} countermetrics · ${projection.outcomeModel.burdenMeasureCount} burden measures · ${projection.outcomeModel.observedBaselineCount} observed baselines`
            : "",
        }
  const projections = [...state.businessUnderstandingProjections.values()]
  const rows = projections.flatMap((projection) => {
    const record = definition.record(projection)
    if (!record) return []
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        state: record.state,
        counts: definition.counts(projection),
        assessment: projection.assessment.state,
        boundary: "Candidate evidence only; no approval, appointment, decision, readiness, or action authority.",
      },
      state: projection.assessment.state,
      actions: [],
    }]
  })
  return {
    id: definition.id,
    title: definition.title,
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: definition.recordLabel },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "state", label: "State" },
      { key: "counts", label: "Privacy-safe counts" },
      { key: "assessment", label: "Assessment" },
      { key: "boundary", label: "Authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        `No governed ${definition.recordLabel}`,
        `Create the candidate ${definition.recordLabel} through the governed engine workflow. This view does not infer missing business context or authority.`,
      ),
    } : {}),
  }
}

function businessCapabilityMapTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.businessCapabilityMapProjections.values()].flatMap((projection) => {
    const record = projection.capabilityMap
    if (!record) return []
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        state: record.state,
        counts: `${record.capabilityCount} capabilities · ${record.ownedCapabilityCount} owned · ${record.openGapCount} open gaps · ${record.criticalGapCount} critical gaps · ${record.candidatePriorityCount} candidate priorities`,
        assessment: projection.assessment.state,
        boundary: "Candidate architecture only; no priority approval, baseline, readiness, or action authority.",
      },
      state: projection.assessment.state,
      actions: [],
    }]
  })
  return {
    id: "business-capability-map",
    title: "Governed Business Capability Map",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Capability Map" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "state", label: "State" },
      { key: "counts", label: "Privacy-safe counts" },
      { key: "assessment", label: "Assessment" },
      { key: "boundary", label: "Authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Business Capability Map",
        "Create the candidate map through the governed engine workflow. This view does not infer capabilities, ownership, priority, or authority.",
      ),
    } : {}),
  }
}

function valueStreamModelTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.valueStreamModelProjections.values()].flatMap((projection) => {
    const record = projection.valueStreamModel
    if (!record) return []
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        state: record.state,
        counts: `${record.valueStreamCount} value streams · ${record.ownedValueStreamCount} owned · ${record.stageCount} stages · ${record.dependencyCount} dependencies · ${record.openBottleneckCount} open bottlenecks · ${record.criticalBottleneckCount} critical bottlenecks`,
        assessment: projection.assessment.state,
        boundary: "Candidate value flow only; no baseline, priority, readiness, or action authority.",
      },
      state: projection.assessment.state,
      actions: [],
    }]
  })
  return {
    id: "value-stream-model",
    title: "Governed Value Stream Model",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Value Stream Model" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "state", label: "State" },
      { key: "counts", label: "Privacy-safe counts" },
      { key: "assessment", label: "Assessment" },
      { key: "boundary", label: "Authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Value Stream Model",
        "Create the candidate model through the governed engine workflow. This view does not infer value flow, ownership, bottlenecks, or authority.",
      ),
    } : {}),
  }
}

function operatingModelTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.operatingModelProjections.values()].flatMap((projection) => {
    const record = projection.operatingModel
    if (!record) return []
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        state: record.state,
        counts: `${record.roleCount} roles · ${record.decisionRightCount} decision rights · ${record.forumCount} forums · ${record.cycleCount} cycles`,
        assessment: projection.assessment.state,
        gaps: `${projection.assessment.unassignedAppointingAuthorityCount} appointing · ${projection.assessment.insufficientCapacityCount} capacity · ${projection.assessment.unfundedCapacityCount} funding · ${projection.assessment.unassignedDecisionAuthorityCount} decision authority`,
        boundary: "Candidate operating structure only; no appointment, funding, baseline, readiness, or action authority.",
      },
      state: projection.assessment.state,
      actions: [],
    }]
  })
  return {
    id: "operating-model",
    title: "Governed Operating Model",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Operating Model" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "state", label: "State" },
      { key: "counts", label: "Privacy-safe counts" },
      { key: "assessment", label: "Assessment" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Operating Model",
        "Create the candidate model through the governed engine workflow. This view does not infer appointments, funding, approvals, readiness, or authority.",
      ),
    } : {}),
  }
}

function businessRuleCatalogTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.businessRuleCatalogProjections.values()].flatMap((projection) => {
    const record = projection.businessRuleCatalog
    if (!record) return []
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        state: record.state,
        counts: `${record.ruleCount} rules · ${record.enforcementTargetCount} targets · ${record.exceptionCount} exceptions · ${record.nonExceptionableRuleCount} non-exceptionable`,
        assessment: projection.assessment.state,
        gaps: `${projection.assessment.unassignedEnforcementTargetCount} unassigned targets · ${projection.assessment.unverifiedEnforcementTargetCount} unverified targets · ${projection.assessment.unassignedExceptionAuthorityCount} exception authorities`,
        boundary: "Candidate rules only; no policy evaluation, exception grant, deployed enforcement, baseline, readiness, or action authority.",
      },
      state: projection.assessment.state,
      actions: [],
    }]
  })
  return {
    id: "business-rule-catalog",
    title: "Governed Business Rules",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Business Rule Catalog" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "state", label: "State" },
      { key: "counts", label: "Privacy-safe counts" },
      { key: "assessment", label: "Assessment" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Business Rule Catalog",
        "Create candidate rules through the governed engine workflow. This view does not evaluate policy, grant exceptions, deploy enforcement, approve a baseline, establish readiness, or authorize action.",
      ),
    } : {}),
  }
}

function businessArchitectureBaselineTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.businessArchitectureBaselineProjections.values()].flatMap((projection) => {
    const record = projection.baseline
    if (!record) return []
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        state: record.state,
        counts: `${record.coveredElementCount} elements · ${record.integrationClaimCount} integration claims`,
        assessment: projection.assessment.state,
        gaps: `${projection.assessment.unresolvedElementCount} unresolved · ${projection.assessment.consistencyGapCount} consistency gaps · ${projection.assessment.staleBindingCount} stale bindings`,
        boundary: "Candidate compound snapshot only; no baseline designation, approval, readiness, exception grant, enforcement, or action authority.",
      },
      state: projection.assessment.state,
      actions: [],
    }]
  })
  return {
    id: "business-architecture-baseline",
    title: "Governed Business Architecture Baseline Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Baseline Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "state", label: "State" },
      { key: "counts", label: "Privacy-safe counts" },
      { key: "assessment", label: "Assessment" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Business Architecture Baseline candidate",
        "Create the compound candidate through the governed engine workflow. This view does not designate or approve a baseline, establish readiness, grant exceptions, deploy enforcement, or authorize action.",
      ),
    } : {}),
  }
}

function systemSolutionArchitectureTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.systemSolutionArchitectureProjections.values()].flatMap((projection) => {
    const record = projection.architecture
    if (!record) return []
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        state: record.state,
        counts: `${record.concernCount} concerns · ${record.viewCount} views · ${record.elementCount} elements · ${record.qualityAttributeCount} quality scenarios · ${record.decisionCount} decisions`,
        assessment: projection.assessment.state,
        gaps: `${projection.assessment.unresolvedQualityAttributeCount} quality gaps · ${projection.assessment.unresolvedDecisionCount} unresolved decisions · ${projection.assessment.unresolvedConformanceCriterionCount} conformance gaps · ${projection.assessment.lifecycleGapCount} lifecycle gaps · ${projection.assessment.staleBindingCount} stale bindings`,
        boundary: "Candidate design only; no architecture-baseline designation, approval, readiness, proven conformance, technology mandate, or action authority.",
      },
      state: projection.assessment.state,
      actions: [],
    }]
  })
  return {
    id: "system-solution-architecture",
    title: "Governed System/Solution Architecture Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Architecture Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "state", label: "State" },
      { key: "counts", label: "Privacy-safe counts" },
      { key: "assessment", label: "Assessment" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed System/Solution Architecture candidate",
        "Create the candidate through the governed engine workflow. This view does not designate or approve an architecture baseline, establish readiness, prove conformance, mandate technology, or authorize action.",
      ),
    } : {}),
  }
}

function boundedContextModelTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.boundedContextModelProjections.values()].flatMap((projection) => {
    const record = projection.model
    if (!record) return []
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        state: record.state,
        counts: `${record.boundedContextCount} contexts · ${record.contractCount} contracts · ${record.relationshipCount} relationships`,
        assessment: projection.assessment.state,
        gaps: `${projection.assessment.unresolvedContractCount} contract gaps · ${projection.assessment.unresolvedRelationshipCount} relationship gaps · ${projection.assessment.unassignedArchitectureElementCount} unassigned elements · ${projection.assessment.unownedDataAssetCount} unowned data assets · ${projection.assessment.unmappedCrossContextRelationCount} unmapped relations · ${projection.assessment.staleBindingCount} stale bindings`,
        boundary: "Candidate boundaries and ownership traces only; no owner appointment, ownership acceptance, boundary approval, contract acceptance, readiness, or action authority.",
      },
      state: projection.assessment.state,
      actions: [],
    }]
  })
  return {
    id: "bounded-context-ownership",
    title: "Governed Bounded Context and Ownership Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Boundary Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "state", label: "State" },
      { key: "counts", label: "Privacy-safe counts" },
      { key: "assessment", label: "Assessment" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Bounded Context and Ownership candidate",
        "Create the candidate through the governed engine workflow. This view does not appoint owners, accept ownership, approve boundaries or contracts, establish readiness, or authorize action.",
      ),
    } : {}),
  }
}

function securityPrivacyAssessmentTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.securityPrivacyAssessmentProjections.values()].flatMap((projection) => {
    const record = projection.assessment
    if (!record) return []
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        state: record.state,
        counts: `${record.assetCount} assets · ${record.trustBoundaryCount} trust boundaries · ${record.dataClassCount} data classes · ${record.controlCount} controls · ${record.threatCount} threats`,
        assessment: projection.status.state,
        gaps: `${projection.status.unresolvedThreatCount} unresolved threats · ${projection.status.unverifiedControlCount} unverified controls · ${projection.status.unresolvedProcessingAuthorityCount} processing-authority gaps · ${projection.status.uncoveredArchitectureElementCount} uncovered elements · ${projection.status.unmappedArchitectureRelationCount} unmapped relations · ${projection.status.unresolvedRequirementCount} requirement gaps · ${projection.status.staleBindingCount} stale bindings`,
        boundary: "Candidate security, privacy, and threat coverage only; no threat-model approval, control-effectiveness attestation, risk acceptance, processing approval, security readiness, or action authority.",
      },
      state: projection.status.state,
      actions: [],
    }]
  })
  return {
    id: "security-privacy-threat-assessment",
    title: "Governed Security, Privacy, and Threat Assessment Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Assessment Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "state", label: "State" },
      { key: "counts", label: "Privacy-safe counts" },
      { key: "assessment", label: "Assessment" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Security, Privacy, and Threat Assessment candidate",
        "Create the candidate through the governed engine workflow. This view does not approve a threat model, attest control effectiveness, accept risk, approve processing, establish security readiness, or authorize action.",
      ),
    } : {}),
  }
}

function processModelTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.processModelProjections.values()].flatMap((projection) => {
    const record = projection.model
    if (!record) return []
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        state: record.state,
        counts: `${record.processCount} processes · ${projection.status.stepCount} steps · ${projection.status.stateDimensionCount} dimensions · ${projection.status.transitionCount} transitions · ${projection.status.eventDefinitionCount} events · ${record.approvalRequirementCount} approval requirements`,
        assessment: projection.status.state,
        gaps: `${projection.status.uncoveredValueStreamCount} uncovered value streams · ${projection.status.uncoveredBoundedContextCount} uncovered contexts · ${projection.status.uncoveredBusinessRuleCount} uncovered rules · ${projection.status.unresolvedRequirementCount} requirement gaps · ${projection.status.inconsistencyCount} inconsistencies · ${projection.status.unresolvedQuestionCount} unresolved questions · ${projection.status.staleBindingCount} stale bindings`,
        boundary: "Candidate workflows, states, transitions, events, and approval requirements only; no workflow approval, transition or execution authority, operational readiness, baseline promotion, or action authority.",
      },
      state: projection.status.state,
      actions: [],
    }]
  })
  return {
    id: "process-model",
    title: "Governed Process Model Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Process Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "state", label: "State" },
      { key: "counts", label: "Privacy-safe counts" },
      { key: "assessment", label: "Assessment" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Process Model candidate",
        "Create the candidate through the governed engine workflow. This view does not approve workflows, grant transition or execution authority, establish operational readiness, promote a baseline, or authorize action.",
      ),
    } : {}),
  }
}

function dataModelTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.dataModelProjections.values()].flatMap((projection) => {
    const record = projection.model
    if (!record) return []
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        state: record.state,
        counts: `${record.entityCount} entities · ${projection.status.attributeCount} attributes · ${record.relationshipCount} relationships · ${record.lifecycleCount} lifecycles · ${projection.status.transformationCount} transformations`,
        assessment: projection.status.state,
        gaps: `${projection.status.uncoveredBoundedContextCount} uncovered contexts · ${projection.status.uncoveredSecurityDataClassCount} uncovered data classes · ${projection.status.uncoveredProcessCount} uncovered processes · ${projection.status.unresolvedSystemOfRecordCount} unresolved systems of record · ${projection.status.unresolvedTransformationCount} unresolved transformations · ${projection.status.unresolvedRequirementCount} requirement gaps · ${projection.status.staleBindingCount} stale bindings`,
        boundary: "Candidate entities, attributes, relationships, ownership, lifecycle, and transformations only; no Data Model or classification approval, ownership appointment, migration authority, operational readiness, baseline promotion, or action authority.",
      },
      state: projection.status.state,
      actions: [],
    }]
  })
  return {
    id: "data-model",
    title: "Governed Data Model Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Data Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "state", label: "State" },
      { key: "counts", label: "Privacy-safe counts" },
      { key: "assessment", label: "Assessment" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Data Model candidate",
        "Create the candidate through the governed engine workflow. This view does not approve the model or classifications, appoint ownership, authorize migration, establish operational readiness, promote a baseline, or authorize action.",
      ),
    } : {}),
  }
}

function authorizationModelTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.authorizationModelProjections.values()].flatMap((projection) => {
    const record = projection.model
    if (!record) return []
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        state: record.state,
        counts: `${record.principalCount} principals · ${projection.status.roleAssignmentCount} role assignments · ${projection.status.resourceCount} resources · ${record.actionCount} actions · ${projection.status.approvalBindingCount} approval bindings · ${record.ruleCount} rules`,
        assessment: projection.status.state,
        gaps: `${projection.status.uncoveredOperatingRoleCount} uncovered roles · ${projection.status.uncoveredProcessCount} uncovered processes · ${projection.status.uncoveredDataEntityCount} uncovered data entities · ${projection.status.unresolvedIdentityCount} unresolved identities · ${projection.status.unresolvedRuleCount} unresolved rules · ${projection.status.unresolvedRequirementCount} requirement gaps · ${projection.status.staleBindingCount} stale bindings`,
        boundary: "Candidate principals, role assignments, resources, actions, approval bindings, and authorization rules only; no identity verification, effective appointment, standing authority, authorization grant, enforcement decision, operational readiness, or action authority.",
      },
      state: projection.status.state,
      actions: [],
    }]
  })
  return {
    id: "authorization-model",
    title: "Governed Authorization Model Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Authorization Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "state", label: "State" },
      { key: "counts", label: "Privacy-safe counts" },
      { key: "assessment", label: "Assessment" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Authorization Model candidate",
        "Create the candidate through the governed engine workflow. This view does not verify identity, approve assignments or standing authority, grant authorization, enforce policy, establish operational readiness, or authorize action.",
      ),
    } : {}),
  }
}

function eventIntegrationModelTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.eventIntegrationModelProjections.values()].flatMap((projection) => {
    const record = projection.model
    if (!record) return []
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        state: record.state,
        counts: `${record.eventTypeCount} event types · ${record.commandCount} commands · ${record.adapterCount} adapters · ${record.externalContractCount} external contracts · ${record.mappingCount} mappings · ${record.routeCount} routes`,
        assessment: projection.status.state,
        gaps: `${projection.status.uncoveredProcessEventCount} uncovered process events · ${projection.status.uncoveredProcessCount} uncovered processes · ${projection.status.uncoveredBoundedContextCount} uncovered contexts · ${projection.status.uncoveredDataEntityCount} uncovered data entities · ${projection.status.uncoveredAuthorizationActionCount} uncovered authorization actions · ${projection.status.unknownMappingTruthCount} unknown mapping truths · ${projection.status.unresolvedRequirementCount} requirement gaps · ${projection.status.staleBindingCount} stale bindings`,
        boundary: "Candidate event types, commands, adapters, contracts, mappings, and routes only; no event occurrence, command delivery, external acceptance, adapter activation, authorization grant, effect execution, operational readiness, or action authority.",
      },
      state: projection.status.state,
      actions: [],
    }]
  })
  return {
    id: "event-integration-model",
    title: "Governed Event and Integration Model Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Integration Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "state", label: "State" },
      { key: "counts", label: "Privacy-safe counts" },
      { key: "assessment", label: "Assessment" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Event and Integration Model candidate",
        "Create the candidate through the governed engine workflow. This view does not prove event occurrence, deliver commands, accept external contracts, activate adapters, grant authorization, execute effects, establish operational readiness, or authorize action.",
      ),
    } : {}),
  }
}

function failureRecoveryModelTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.failureRecoveryModelProjections.values()].flatMap((projection) => {
    const record = projection.model
    if (!record) return []
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        state: record.state,
        counts: `${record.failureModeCount} failure modes · ${record.retryPolicyCount} retry policies · ${record.compensationPlanCount} compensation plans · ${record.recoveryPlanCount} recovery plans · ${record.recoveryEvidenceDefinitionCount} recovery evidence definitions`,
        assessment: projection.status.state,
        gaps: `${projection.status.uncoveredProcessCount} uncovered processes · ${projection.status.uncoveredCommandCount} uncovered commands · ${projection.status.uncoveredRouteCount} uncovered routes · ${projection.status.uncoveredAuthorizationActionCount} uncovered authorization actions · ${projection.status.unresolvedRecoveryEvidenceCount} recovery evidence gaps · ${projection.status.unresolvedRequirementCount} requirement gaps · ${projection.status.staleBindingCount} stale bindings`,
        boundary: "Candidate failure modes, retry policies, compensation plans, recovery plans, and evidence definitions only; no failure occurrence, retry safety, compensation or restoration, recovery success, return-to-service authority, operational readiness, or action authority.",
      },
      state: projection.status.state,
      actions: [],
    }]
  })
  return {
    id: "failure-recovery-model",
    title: "Governed Failure and Recovery Model Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Recovery Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "state", label: "State" },
      { key: "counts", label: "Privacy-safe counts" },
      { key: "assessment", label: "Assessment" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Failure and Recovery Model candidate",
        "Create the candidate through the governed engine workflow. This view does not prove failure occurrence, establish retry safety, execute compensation, establish restoration or recovery success, authorize return to service, establish operational readiness, or authorize action.",
      ),
    } : {}),
  }
}

function architectureChallengeModelTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.architectureChallengeModelProjections.values()].flatMap((projection) => {
    const record = projection.model
    if (!record) return []
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        state: record.state,
        counts: `${record.challengeSubjectCount} challenge subjects · ${record.assumptionCount} assumptions · ${record.alternativeCount} alternatives · ${record.findingCount} findings · ${record.responseCount} responses`,
        assessment: projection.status.state,
        gaps: `${projection.status.unrespondedFindingCount} unresponded findings · ${projection.status.unresolvedAssumptionCount} unresolved assumptions · ${projection.status.unresolvedRequirementCount} requirement gaps · ${projection.status.staleBindingCount} stale bindings`,
        boundary: "Candidate challenge subjects, assumptions, alternatives, findings, responses, and independence disclosures only; no completed independent review, assurance, risk acceptance, architecture approval, operational readiness, or action authority.",
      },
      state: projection.status.state,
      actions: [],
    }]
  })
  return {
    id: "architecture-challenge-model",
    title: "Governed Architecture Challenge Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Challenge Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "state", label: "State" },
      { key: "counts", label: "Privacy-safe counts" },
      { key: "assessment", label: "Assessment" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Architecture Challenge candidate",
        "Create the candidate through the governed engine workflow. This view does not complete independent review, establish assurance, accept risk, approve architecture, establish operational readiness, or authorize action.",
      ),
    } : {}),
  }
}

function decisionRegisterTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.decisionRegisterProjections.values()].flatMap((projection) => {
    const record = projection.register
    if (!record) return []
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        state: record.state,
        counts: `${record.decisionCount} decisions`,
        assessment: projection.status.state,
        gaps: `${projection.status.unresolvedDecisionCount} unresolved decisions · ${projection.status.selectedPendingDecisionCount} selected pending decisions · ${projection.status.deferredDecisionCount} deferred decisions · ${projection.status.unresolvedRequirementCount} requirement gaps · ${projection.status.staleBindingCount} stale bindings`,
        boundary: "Candidate decision metadata only; no decision effectiveness, approval, risk acceptance, baseline promotion, operational readiness, or action authority.",
      },
      state: projection.status.state,
      actions: [],
    }]
  })
  return {
    id: "decision-register",
    title: "Governed Decision Register Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Decision Register Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "state", label: "State" },
      { key: "counts", label: "Privacy-safe counts" },
      { key: "assessment", label: "Assessment" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Decision Register candidate",
        "Create the candidate through the governed engine workflow. This view does not establish decision effectiveness, approval, risk acceptance, baseline promotion, operational readiness, or action authority.",
      ),
    } : {}),
  }
}

function riskRegisterTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.riskRegisterProjections.values()].flatMap((projection) => {
    const record = projection.register
    if (!record) return []
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        state: record.state,
        counts: `${record.riskCount} risks`,
        assessment: projection.status.state,
        gaps: `${projection.status.notAssessedRiskCount} not assessed · ${projection.status.unresolvedResidualRiskCount} residual risk gaps · ${projection.status.unverifiedControlCount} control effectiveness gaps · ${projection.status.unresolvedRequirementCount} requirement gaps · ${projection.status.staleBindingCount} stale bindings`,
        boundary: "Candidate risk metadata only; no assessment fact, owner assignment, control effectiveness, risk acceptance, approval, exception, baseline promotion, operational readiness, or action authority.",
      },
      state: projection.status.state,
      actions: [],
    }]
  })
  return {
    id: "risk-register",
    title: "Governed Risk Register Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Risk Register Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "state", label: "State" },
      { key: "counts", label: "Privacy-safe counts" },
      { key: "assessment", label: "Assessment" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Risk Register candidate",
        "Create the candidate through the governed engine workflow. This view does not establish assessment fact, owner assignment, control effectiveness, risk acceptance, approval, exception, operational readiness, or action authority.",
      ),
    } : {}),
  }
}

function evidenceRegistryTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.evidenceRegistryProjections.values()].flatMap((projection) => {
    const record = projection.registry
    if (!record) return []
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        state: record.state,
        counts: `${record.claimCount} claims · ${record.evidenceItemCount} evidence items · ${record.linkCount} links`,
        assessment: projection.status.state,
        gaps: `${projection.status.notAssessedClaimCount} claims not assessed · ${projection.status.notAssessedEvidenceCount} evidence items not assessed · ${projection.status.adverseEvidencePendingDispositionCount} adverse dispositions pending · ${projection.status.staleOrUnknownEvidenceCount} stale or unknown · ${projection.status.invalidatedEvidenceCount} invalidated · ${projection.status.unresolvedRequirementCount} requirement gaps · ${projection.status.staleBindingCount} stale bindings`,
        boundary: "Candidate claim-to-evidence metadata only; no claim validation, evidence sufficiency, assurance, review, approval, risk acceptance, readiness, or action authority.",
      },
      state: projection.status.state,
      actions: [],
    }]
  })
  return {
    id: "evidence-registry",
    title: "Governed Evidence Registry Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Evidence Registry Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "state", label: "State" },
      { key: "counts", label: "Privacy-safe counts" },
      { key: "assessment", label: "Assessment" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Evidence Registry candidate",
        "Create the candidate through the governed engine workflow. This view does not validate claims, establish evidence sufficiency or assurance, complete review, grant approval, accept risk, establish readiness, or authorize action.",
      ),
    } : {}),
  }
}

function endToEndTraceabilityTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.endToEndTraceabilityProjections.values()].flatMap((projection) => {
    const record = projection.traceability
    if (!record) return []
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        state: record.state,
        counts: `${record.nodeCount} nodes · ${record.relationshipCount} relationship types · ${record.linkCount} links · ${record.transformationCount} transformations`,
        assessment: projection.status.state,
        gaps: `${projection.status.unresolvedEndpointCount} unresolved endpoints · ${projection.status.notAssessedSemanticCount} semantic reviews pending · ${projection.status.missingSpineCount} missing spine segments · ${projection.status.unknownRelationshipCount} unknown relationships · ${projection.status.unresolvedRequirementCount} requirement gaps · ${projection.status.staleBindingCount} stale bindings`,
        boundary: "Candidate graph metadata only; absence does not prove no impact, and presence does not establish relationship truth, completeness, approval, baseline promotion, readiness, or action authority.",
      },
      state: projection.status.state,
      actions: [],
    }]
  })
  return {
    id: "end-to-end-traceability",
    title: "Governed End-to-End Traceability Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Traceability Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "state", label: "State" },
      { key: "counts", label: "Privacy-safe counts" },
      { key: "assessment", label: "Assessment" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Coverage and authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed End-to-End Traceability candidate",
        "Create the candidate through the governed engine workflow. This view does not infer missing relationships, prove completeness, grant approval, establish readiness, or authorize action.",
      ),
    } : {}),
  }
}

function p0P4ReadinessGateTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.p0P4ReadinessGateProjections.values()].flatMap((projection) => {
    const record = projection.gate
    if (!record) return []
    const status = projection.status
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        definition: record.evaluationDefinitionDigest,
        outputs: `${status.satisfiedOutputCount}/${status.applicableOutputCount} applicable satisfied · ${status.notApplicableOutputCount} candidate not applicable`,
        assessment: status.result,
        gaps: `${status.blockedOutputCount} blocked · ${status.failedOutputCount} failed · ${status.incompleteOutputCount} incomplete · ${status.conditionalOutputCount} conditional · ${status.unresolvedApplicabilityCount} unresolved applicability · ${status.pendingOrInvalidWaiverCount} waiver gaps · ${status.unresolvedDecisionCount} open decisions · ${status.unmetConditionCount} unmet conditions · ${status.adverseEvidenceCount} adverse evidence · ${status.staleBindingCount} stale bindings`,
        boundary: "A passing gate is an evaluation result, not permission; it does not grant approval, accept waivers, authorize phase entry or implementation, promote a baseline, establish readiness, or authorize action.",
      },
      state: status.result,
      actions: [],
    }]
  })
  return {
    id: "p0-p4-readiness-gates",
    title: "Governed P0-P4 Readiness Gate Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Gate Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "definition", label: "Evaluation definition digest" },
      { key: "outputs", label: "Privacy-safe output counts" },
      { key: "assessment", label: "Evaluation result" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Gate and authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed P0-P4 Readiness Gate candidate",
        "Create the candidate through the governed engine workflow. This view does not infer readiness, grant approval, accept waivers, authorize phase entry or implementation, promote a baseline, or authorize action.",
      ),
    } : {}),
  }
}

function p5HandoffPackageTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.p5HandoffPackageProjections.values()].flatMap((projection) => {
    const record = projection.handoff
    if (!record) return []
    const status = projection.status
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        readiness: record.readinessStatusDigest,
        delivery: record.deliveryMode,
        items: `${status.includedItemCount} included · ${status.referenceOnlyItemCount} exact references · ${status.omittedNotApplicableItemCount} explicit N/A · ${status.unresolvedItemCount} unresolved`,
        assessment: `${status.state} · readiness ${status.readinessResult} · transfer ${status.transferState}`,
        gaps: `${status.staleOrUnknownItemCount} stale/unknown applicable items · ${status.lossyTransformationCount} lossy transformations · ${status.unresolvedRequirementCount} requirement gaps · ${status.conflictCount} conflicts · ${status.unresolvedQuestionCount} open questions · ${status.staleBindingCount} stale bindings`,
        boundary: "Candidate context transfer only; source ownership remains retained and this does not establish acknowledgement, readiness, approval, a design baseline, P5 entry, transfer authority, write authority, or action authority.",
      },
      state: status.state,
      actions: [],
    }]
  })
  return {
    id: "p5-handoff-packages",
    title: "Governed P5 Handoff Package Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Handoff Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "readiness", label: "Readiness assessment digest" },
      { key: "delivery", label: "Delivery mode" },
      { key: "items", label: "Privacy-safe item counts" },
      { key: "assessment", label: "Candidate state" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Handoff and authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed P5 Handoff Package candidate",
        "Create the candidate through the governed engine workflow. This view does not infer acknowledgement, transfer source ownership, establish approval or a design baseline, authorize P5 entry, write to a destination, or authorize action.",
      ),
    } : {}),
  }
}

function designApplicabilityTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.designApplicabilityProjections.values()].flatMap((projection) => {
    const record = projection.candidate
    if (!record) return []
    const status = projection.status
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        coverage: `${status.scopeCount} scopes · ${status.decisionCount} explicit UX, UI, design-work, and Figma decisions`,
        assessment: `${status.state} · ${status.reviewState}`,
        gaps: `${status.unresolvedDecisionCount} unresolved decisions · ${status.blockedDecisionCount} blocked decisions · ${status.pendingApprovalCount} pending approvals · ${status.rejectedApprovalCount} rejected approvals · ${status.unresolvedDepthCount} unresolved depths · ${status.unresolvedSourceCount} unresolved sources · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
        boundary: "Candidate guidance only; silence is never not applicable, and this does not approve design, establish a Design Baseline, grant readiness, authorize implementation, write, or action.",
      },
      state: status.state,
      actions: [],
    }]
  })
  return {
    id: "design-applicability",
    title: "Governed Design Applicability Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "coverage", label: "Privacy-safe coverage" },
      { key: "assessment", label: "Candidate state" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Applicability and authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Design Applicability candidate",
        "Create the candidate through the governed engine workflow. This view does not infer UX, UI, design-work, or Figma applicability from silence and grants no design approval, baseline, readiness, implementation, write, or action authority.",
      ),
    } : {}),
  }
}

function designPersonaRoleTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.designPersonaRoleProjections.values()].flatMap((projection) => {
    const record = projection.candidate
    if (!record) return []
    const status = projection.status
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        coverage: `${status.personaCount} personas · ${status.designRoleCount} design roles · ${status.representedParticipantCategoryCount}/5 participant categories · ${status.representedRoleKindCount}/4 role kinds`,
        evidence: `${status.humanReviewedPersonaCount} human-reviewed personas · ${status.weakEvidencePersonaCount} weak-evidence personas`,
        assessment: `${status.state} · ${status.reviewState}`,
        gaps: `${status.unresolvedParticipantCategoryCount} unresolved participant categories · ${status.unresolvedRoleKindCount} unresolved role kinds · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
        boundary: "Purpose-limited candidate persona hypotheses and design responsibilities only; no persona validation, role appointment, competence verification, design approval, readiness, write, or action authority.",
      },
      state: status.state,
      actions: [],
    }]
  })
  return {
    id: "design-persona-role-model",
    title: "Governed Design Personas and Roles Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "coverage", label: "Privacy-safe coverage" },
      { key: "evidence", label: "Persona evidence state" },
      { key: "assessment", label: "Candidate state" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Privacy and authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Design Personas and Roles candidate",
        "Create the candidate through the governed engine workflow. This view does not infer persona validation, role appointment, competence, design approval, readiness, write, or action authority.",
      ),
    } : {}),
  }
}

function userJourneyTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.userJourneyProjections.values()].flatMap((projection) => {
    const record = projection.candidate
    if (!record) return []
    const status = projection.status
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        inventory: `${status.journeyCount} journeys · ${status.touchpointCount} touchpoints`,
        paths: `${status.primaryPathCount} primary · ${status.successPathCount} success · ${status.failurePathCount} failure · ${status.recoveryPathCount} recovery`,
        coverage: `${status.representedScopeCount} represented scopes · ${status.unresolvedScopeCount} unresolved scopes`,
        assessment: `${status.state} · ${status.reviewState}`,
        gaps: `${status.weakEvidencePathCount} weak-evidence paths · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
        boundary: "Candidate journey structure and coverage metadata only; no observed-behavior proof, journey validation, design approval, readiness, write, or action authority.",
      },
      state: status.state,
      actions: [],
    }]
  })
  return {
    id: "user-journey-model",
    title: "Governed User Journeys Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "inventory", label: "Privacy-safe inventory" },
      { key: "paths", label: "Path coverage" },
      { key: "coverage", label: "Scope coverage" },
      { key: "assessment", label: "Candidate state" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Privacy and authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed User Journeys candidate",
        "Create the candidate through the governed engine workflow. This view does not infer observed behavior, validate journeys, approve design, grant readiness, or authorize write or action.",
      ),
    } : {}),
  }
}

function informationArchitectureTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.informationArchitectureProjections.values()].flatMap((projection) => {
    const record = projection.candidate
    if (!record) return []
    const status = projection.status
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        inventory: `${status.nodeCount} nodes · ${status.rootNodeCount} roots · ${status.routeCount} routes`,
        coverage: `${status.representedScopeCount} represented scopes · ${status.unresolvedScopeCount} unresolved scopes`,
        assessment: `${status.state} · ${status.reviewState}`,
        gaps: `${status.weakEvidenceNodeCount} weak-evidence nodes · ${status.weakEvidenceRouteCount} weak-evidence routes · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
        boundary: "Candidate hierarchy, content-model, and route metadata only; no findability, comprehension, accessibility, content, or design validation, readiness, write, or action authority.",
      },
      state: status.state,
      actions: [],
    }]
  })
  return {
    id: "information-architecture-model",
    title: "Governed Information Architecture Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "inventory", label: "Privacy-safe inventory" },
      { key: "coverage", label: "Scope coverage" },
      { key: "assessment", label: "Candidate state" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Privacy and authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Information Architecture candidate",
        "Create the candidate through the governed engine workflow. This view does not infer findability, comprehension, accessibility, content or design validation, readiness, write, or action authority.",
      ),
    } : {}),
  }
}

function screenStateInventoryTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.screenStateInventoryProjections.values()].flatMap((projection) => {
    const record = projection.candidate
    if (!record) return []
    const status = projection.status
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        inventory: `${status.platformCount} platforms · ${status.screenCount} screens · ${status.stateCount} states · ${status.variantCount} variants`,
        coverage: `${status.representedRouteCount} represented routes · ${status.unresolvedRouteCount} unresolved routes · ${status.representedScopeCount} represented scopes · ${status.unresolvedScopeCount} unresolved scopes`,
        assessment: `${status.state} · ${status.reviewState}`,
        gaps: `${status.unresolvedPlatformCount} unresolved platforms · ${status.weakEvidenceItemCount} weak-evidence items · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
        boundary: "Candidate platform, screen, state, and variant counts only; no UI completeness, platform parity, state reachability, interaction quality, accessibility validation, design approval, readiness, write, or action authority.",
      },
      state: status.state,
      actions: [],
    }]
  })
  return {
    id: "screen-state-inventory",
    title: "Governed Screen and State Inventory Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "inventory", label: "Privacy-safe inventory" },
      { key: "coverage", label: "Route and scope coverage" },
      { key: "assessment", label: "Candidate state" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Privacy and authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Screen and State Inventory candidate",
        "Create the candidate through the governed engine workflow. This view does not infer UI completeness, platform parity, state reachability, interaction quality, accessibility validation, design approval, readiness, write, or action authority.",
      ),
    } : {}),
  }
}

function designRequirementsTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.designRequirementsProjections.values()].flatMap((projection) => {
    const record = projection.candidate
    if (!record) return []
    const status = projection.status
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        inventory: `${status.requirementCount} requirements · ${status.mustPriorityCount} must-priority · ${status.workItemCount} Work Items`,
        coverage: `${status.representedOutcomeCount} represented outcomes · ${status.unresolvedOutcomeCount} unresolved outcomes · ${status.linkedBacklogRequirementCount} backlog-linked · ${status.notPlannedRequirementCount} not planned`,
        assessment: `${status.state} · ${status.reviewState} · ${status.catalogCompletenessState}`,
        gaps: `${status.unresolvedBacklogRequirementCount} unresolved backlog links · ${status.weakEvidenceRequirementCount} weak-evidence requirements · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleDomainReferenceCount} stale domain references · ${status.staleSourceReferenceCount} stale Source references`,
        boundary: "Candidate identities, counts, statuses, and digests only; no requirement, outcome, target, Work Item, Source, or personal content and no validity, completeness, priority approval, satisfaction, backlog commitment, design approval, readiness, implementation, write, or action authority.",
      },
      state: status.state,
      actions: [],
    }]
  })
  return {
    id: "design-requirements",
    title: "Governed Design Requirements Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "inventory", label: "Privacy-safe inventory" },
      { key: "coverage", label: "Outcome and backlog coverage" },
      { key: "assessment", label: "Candidate state" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Privacy and authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Design Requirements candidate",
        "Create the candidate through the governed engine workflow. This view does not infer requirement validity, completeness, priority approval, satisfaction, backlog commitment, design approval, readiness, implementation, write, or action authority.",
      ),
    } : {}),
  }
}

function designSystemTokenContractTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.designSystemTokenContractProjections.values()].flatMap((projection) => {
    const record = projection.candidate
    if (!record) return []
    const status = projection.status
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        inventory: `${status.designSystemCount} systems · ${status.tokenCount} tokens · ${status.variableCollectionCount} collections · ${status.variableCount} variables · ${status.componentCount} components`,
        coverage: `${status.representedRequirementCount} represented requirements · ${status.unresolvedRequirementCount} unresolved requirements`,
        assessment: `${status.state} · ${status.reviewState} · ${status.catalogCompletenessState}`,
        gaps: `${status.unresolvedOwnershipCount} ownership gaps · ${status.unresolvedCatalogItemCount} unresolved catalog items · ${status.accessibilityReviewGapCount} accessibility review gaps · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.stalePortableSnapshotCount} stale portable snapshots · ${status.staleSourceReferenceCount} stale Source references`,
        boundary: "Candidate identities, counts, statuses, and digests only; no token values, component content, requirements, Source, design, or personal content and no system, token, variable, or component validity, ownership authority, accessibility validation, design approval, baseline, readiness, implementation, write, or action authority.",
      },
      state: status.state,
      actions: [],
    }]
  })
  return {
    id: "design-system-token-contract",
    title: "Governed Design System and Token Contract Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "inventory", label: "Privacy-safe inventory" },
      { key: "coverage", label: "Requirement coverage" },
      { key: "assessment", label: "Candidate state" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Privacy and authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Design System and Token Contract candidate",
        "Create the candidate through the governed engine workflow. This view does not infer system, token, variable, or component validity, ownership authority, accessibility validation, design approval, baseline, readiness, implementation, write, or action authority.",
      ),
    } : {}),
  }
}

function accessibilityDesignRulesTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.accessibilityDesignRulesProjections.values()].flatMap((projection) => {
    const record = projection.candidate
    if (!record) return []
    const status = projection.status
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        inventory: `${status.targetCount} targets · ${status.ruleCount} rules · ${status.checkCount} checks`,
        rules: `${status.applicableRuleCount} applicable · ${status.notApplicableRuleCount} not applicable · ${status.unresolvedRuleCount} unresolved`,
        checks: `${status.humanReviewedCheckCount} human-reviewed · ${status.evidenceRecordedCheckCount} evidence-recorded · ${status.notAssessedCheckCount} not assessed · ${status.contradictedCheckCount} contradicted`,
        coverage: `${status.representedRequirementCount} represented requirements · ${status.unresolvedRequirementCount} unresolved requirements`,
        assessment: `${status.state} · ${status.reviewState} · ${status.catalogCompletenessState}`,
        gaps: `${status.unresolvedOwnershipCount} ownership gaps · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
        boundary: "Candidate identities, counts, statuses, and digests only; no rule procedures, evidence, requirements, Source, design, or personal content and no accessibility conformance, rule or check validity, legal compliance, ownership authority, design approval, baseline, readiness, implementation, write, or action authority.",
      },
      state: status.state,
      actions: [],
    }]
  })
  return {
    id: "accessibility-design-rules",
    title: "Governed Accessibility Design Rules Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "inventory", label: "Privacy-safe inventory" },
      { key: "rules", label: "Rule applicability" },
      { key: "checks", label: "Check evidence" },
      { key: "coverage", label: "Requirement coverage" },
      { key: "assessment", label: "Candidate state" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Privacy and authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Accessibility Design Rules candidate",
        "Create the candidate through the governed engine workflow. This view does not infer accessibility conformance, rule or check validity, legal compliance, ownership authority, design approval, baseline, readiness, implementation, write, or action authority.",
      ),
    } : {}),
  }
}

function responsiveMultiPlatformTargetsTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.responsiveMultiPlatformTargetsProjections.values()].flatMap((projection) => {
    const record = projection.candidate
    if (!record) return []
    const status = projection.status
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        inventory: `${status.platformTargetCount} platform targets · ${status.breakpointCount} breakpoints · ${status.behaviorCount} behaviors · ${status.checkCount} checks`,
        behaviors: `${status.applicableBehaviorCount} applicable · ${status.unresolvedBehaviorCount} unresolved`,
        checks: `${status.humanReviewedCheckCount} human-reviewed · ${status.evidenceRecordedCheckCount} evidence-recorded · ${status.notAssessedCheckCount} not assessed · ${status.contradictedCheckCount} contradicted`,
        coverage: `${status.representedRequirementCount} represented requirements · ${status.unresolvedRequirementCount} unresolved requirements`,
        assessment: `${status.state} · ${status.reviewState} · targets ${status.targetCatalogState} · breakpoints ${status.breakpointCatalogState} · behaviors ${status.behaviorCatalogState}`,
        gaps: `${status.unresolvedOwnershipCount} ownership gaps · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
        boundary: "Candidate identities, counts, statuses, and digests only; no breakpoint rules, behavior procedures, evidence, requirements, Source, design, or personal content and no responsive completeness, platform parity, breakpoint or behavior validity, accessibility conformance, ownership authority, design approval, baseline, readiness, implementation, write, or action authority.",
      },
      state: status.state,
      actions: [],
    }]
  })
  return {
    id: "responsive-multi-platform-targets",
    title: "Governed Responsive and Multi-Platform Targets Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "inventory", label: "Privacy-safe inventory" },
      { key: "behaviors", label: "Behavior applicability" },
      { key: "checks", label: "Check evidence" },
      { key: "coverage", label: "Requirement coverage" },
      { key: "assessment", label: "Candidate state" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Privacy and authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Responsive and Multi-Platform Targets candidate",
        "Create the candidate through the governed engine workflow. This view does not infer responsive completeness, platform parity, breakpoint or behavior validity, accessibility conformance, ownership authority, design approval, baseline, readiness, implementation, write, or action authority.",
      ),
    } : {}),
  }
}

function manualFigmaExecutionPathTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.manualFigmaExecutionPathProjections.values()].flatMap((projection) => {
    const record = projection.candidate
    if (!record) return []
    const status = projection.status
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        inventory: `${status.scopeCount} scopes · ${status.instructionCount} instruction stages · ${status.checkCount} checks`,
        checks: `${status.humanReviewedCheckCount} human-reviewed · ${status.evidenceRecordedCheckCount} evidence-recorded · ${status.notAssessedCheckCount} not assessed · ${status.contradictedCheckCount} contradicted`,
        coverage: `${status.representedRequirementCount} represented requirements · ${status.unresolvedRequirementCount} unresolved requirements`,
        assessment: `${status.state} · ${status.reviewState} · guide ${status.guideCatalogState} · handoff ${status.handoffCatalogState} · return ${status.returnContractState}`,
        gaps: `${status.unresolvedOwnershipCount} ownership gaps · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
        boundary: "Candidate identities, counts, statuses, and digests only; no handoff content, instructions, Figma identifiers, returned design, evidence, requirements, Source, or personal content and no Figma connection, execution, return completeness, write authority, design approval, baseline, readiness, implementation, or action authority.",
      },
      state: status.state,
      actions: [],
    }]
  })
  return {
    id: "manual-figma-execution-path",
    title: "Governed Manual Figma Execution Path Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "inventory", label: "Privacy-safe inventory" },
      { key: "checks", label: "Check evidence" },
      { key: "coverage", label: "Requirement coverage" },
      { key: "assessment", label: "Candidate state" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Privacy and authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Manual Figma Execution Path candidate",
        "Create the candidate through the governed engine workflow. This view does not connect to Figma, prove execution or return completeness, grant write authority, approve design, establish a baseline or readiness, or authorize implementation or action.",
      ),
    } : {}),
  }
}

function figmaMcpCapabilityDiscoveryTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.figmaMcpCapabilityDiscoveryProjections.values()].flatMap((projection) => {
    const record = projection.candidate
    if (!record) return []
    const status = projection.status
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        inventory: `${status.toolCount} tool observations · ${status.advertisedToolCount} advertised · ${status.unavailableToolCount} not advertised · ${status.unknownAvailabilityCount} unknown`,
        effects: `${status.readToolCount} read · ${status.writeToolCount} write · ${status.unknownEffectCount} unknown`,
        evidence: `${status.humanReviewedToolCount} human-reviewed · ${status.sourceRecordedToolCount} source-recorded · ${status.notAssessedToolCount} not assessed`,
        catalogs: `permissions ${status.permissionModelState} · limits ${status.limitCatalogState} · versions ${status.versionCatalogState}`,
        assessment: `${status.state} · ${status.reviewState} · catalog ${status.catalogState}`,
        gaps: `${status.unresolvedPermissionCount} permission gaps · ${status.unresolvedLimitCount} limit gaps · ${status.unresolvedVersionCount} version gaps · ${status.unresolvedOwnershipCount} ownership gaps · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
        boundary: "Candidate identities, counts, statuses, and digests only; no tool names, schemas, permissions, limits, versions, Source, personal, secret, credential, or Figma content and no Figma connection or call, credential request, permission grant, compatibility claim, write authority, design approval, baseline, readiness, implementation, or action authority.",
      },
      state: status.state,
      actions: [],
    }]
  })
  return {
    id: "figma-mcp-capability-discovery",
    title: "Governed Figma MCP Capability Discovery Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "inventory", label: "Privacy-safe inventory" },
      { key: "effects", label: "Effect separation" },
      { key: "evidence", label: "Evidence state" },
      { key: "catalogs", label: "Candidate catalogs" },
      { key: "assessment", label: "Candidate state" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Privacy and authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Figma MCP Capability Discovery candidate",
        "Create the source-backed candidate through the governed engine workflow. This view does not connect to or call Figma, request credentials, grant permissions, establish live tool availability or compatibility, authorize writes, approve design, establish a baseline or readiness, or authorize implementation or action.",
      ),
    } : {}),
  }
}

function figmaReadSnapshotTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.figmaReadSnapshotProjections.values()].flatMap((projection) => {
    const record = projection.candidate
    if (!record) return []
    const status = projection.status
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        inventory: `${status.fileCount} files · ${status.componentCount} components · ${status.variableCollectionCount} variable collections · ${status.variableCount} variables`,
        evidence: `${status.humanReviewedItemCount} human-reviewed · ${status.sourceRecordedItemCount} source-recorded · ${status.notAssessedItemCount} not assessed`,
        freshness: `${status.staleFileCount} stale at capture · ${status.unknownFreshnessFileCount} unknown freshness · ${status.unresolvedTypeCount} unresolved variable types`,
        assessment: `${status.state} · ${status.reviewState} · snapshot ${status.snapshotCompletenessState} · provenance ${status.provenanceState}`,
        gaps: `${status.unresolvedOwnershipCount} ownership gaps · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
        boundary: "Candidate identities, counts, statuses, and digests only; no Figma file, component, collection, variable, external identity, value, Source, personal, secret, credential, or permission content and no Figma connection or call, credential request, permission grant, external completeness claim, write authority, design validation or approval, baseline, readiness, implementation, or action authority.",
      },
      state: status.state,
      actions: [],
    }]
  })
  return {
    id: "figma-read-snapshot",
    title: "Governed Figma Read Snapshot Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "inventory", label: "Privacy-safe inventory" },
      { key: "evidence", label: "Evidence state" },
      { key: "freshness", label: "Freshness and type gaps" },
      { key: "assessment", label: "Candidate state" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Privacy and authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Figma Read Snapshot candidate",
        "Create a source-backed read-only candidate through the governed engine workflow. This view does not connect to or call Figma, request credentials, grant permissions, prove external completeness, authorize writes, validate or approve design, establish a baseline or readiness, or authorize implementation or action.",
      ),
    } : {}),
  }
}

function figmaContextImportTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.figmaContextImportProjections.values()].flatMap((projection) => {
    const record = projection.candidate
    if (!record) return []
    const status = projection.status
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        selection: `${status.contextPackCount} Context Packs · ${status.sectionCount} sections · ${status.contextItemCount} Context Items · ${status.targetCount} Figma targets`,
        evidence: `${status.humanReviewedSectionCount} human-reviewed · ${status.sourceRecordedSectionCount} source-recorded · ${status.notAssessedSectionCount} not assessed · ${status.unresolvedRedactionCount} redaction gaps`,
        requirements: `${status.representedRequirementCount} represented · ${status.unresolvedRequirementCount} unresolved`,
        assessment: `${status.state} · ${status.reviewState} · selection ${status.contextSelectionState} · provenance ${status.provenanceState} · preview ${status.previewState}`,
        gaps: `${status.unresolvedOwnershipCount} ownership gaps · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
        boundary: "Candidate identities, counts, statuses, and digests only; no brief, Requirement, constraint, Context Item, Figma target, tool, Source, personal, secret, credential, or permission content and no context packaging or transfer, Figma connection or call, credential request, permission grant, write, target or design validation, design approval, baseline, readiness, implementation, or action authority.",
      },
      state: status.state,
      actions: [],
    }]
  })
  return {
    id: "figma-context-import",
    title: "Governed Figma Context Import Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "selection", label: "Privacy-safe selection" },
      { key: "evidence", label: "Evidence and redaction" },
      { key: "requirements", label: "Requirement coverage" },
      { key: "assessment", label: "Candidate state" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Privacy and authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Figma Context Import candidate",
        "Create a source-backed context selection through the governed engine workflow. This view does not package or transfer context, connect to or call Figma, request credentials, grant permissions, authorize or perform writes, validate targets or design, approve design, establish a baseline or readiness, or authorize implementation or action.",
      ),
    } : {}),
  }
}

function outboundDesignBriefPackageTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.outboundDesignBriefPackageProjections.values()].flatMap((projection) => {
    const record = projection.candidate
    if (!record) return []
    const status = projection.status
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        receipts: `${record.manifestFormat} · manifest ${record.manifestDigest} · payload ${record.payloadDigest}`,
        inventory: `${status.contextPackCount} Context Packs · ${status.entryCount} entries · ${status.contextItemCount} Context Items · ${status.recipientCount} recipients`,
        evidence: `${status.humanReviewedEntryCount} human-reviewed · ${status.sourceRecordedEntryCount} source-recorded · ${status.notAssessedEntryCount} not assessed · ${status.unresolvedRedactionCount} redaction gaps`,
        requirements: `${status.representedRequirementCount} represented · ${status.unresolvedRequirementCount} unresolved · ${status.unresolvedDisclosureCount} unresolved disclosures`,
        assessment: `${status.state} · ${status.reviewState} · manifest ${status.manifestState} · provenance ${status.provenanceState} · redaction ${status.redactionReviewState} · preview ${status.previewState}`,
        gaps: `${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
        boundary: "Candidate identities, counts, statuses, and digests only; no brief, Requirement, constraint, Context Item, Figma target, tool, Source, transformation, disclosure, personal, secret, credential, or permission content and no package materialization or context transfer, Figma connection or call, credential request, permission grant, write, target or design validation, design approval, baseline, readiness, implementation, or action authority.",
      },
      state: status.state,
      actions: [],
    }]
  })
  return {
    id: "outbound-design-brief-package",
    title: "Governed Outbound Design Brief Package Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "receipts", label: "Manifest receipts" },
      { key: "inventory", label: "Privacy-safe inventory" },
      { key: "evidence", label: "Evidence and redaction" },
      { key: "requirements", label: "Requirement coverage" },
      { key: "assessment", label: "Candidate state" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Privacy and authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Outbound Design Brief Package candidate",
        "Create an exact manifest-only candidate through the governed engine workflow. This view does not materialize or transfer context, connect to or call Figma, request credentials, grant permissions, authorize or perform writes, validate targets or design, approve design, establish a baseline or readiness, or authorize implementation or action.",
      ),
    } : {}),
  }
}

function governedFigmaWriteTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.governedFigmaWriteProjections.values()].flatMap((projection) => {
    const record = projection.candidate
    if (!record) return []
    const status = projection.status
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        receipts: `${record.requestFormat} · request ${record.requestDigest} · effect ${record.effectDigest} · preview ${record.previewDigest ?? "not-generated"}`,
        package: `${record.outboundPackage.recordId} · r${record.outboundPackage.revision} · manifest ${record.outboundPackage.manifestDigest} · payload ${record.outboundPackage.payloadDigest}`,
        target: `file ${record.externalFileIdentityDigest} · expected version ${record.expectedExternalVersionDigest} · ${record.selectedEntryCount} selected entries`,
        governance: `preview ${status.previewState} · approval ${status.approvalState} · permission evidence ${status.permissionEvidenceState} · idempotency ${status.idempotencyState}/${status.replayProtectionState} · recovery ${status.recoveryPlanState}`,
        assessment: `${status.state} · ${status.reviewState} · plan ${status.writePlanState} · execution ${status.writeExecutionState} · result ${status.writeResultState}`,
        gaps: `${status.unresolvedDisclosureCount} disclosures · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
        boundary: "Candidate identities, counts, statuses, and digests only; no brief, Requirement, constraint, Context Item, Figma target, tool, Source, approval actor, permission evidence, recovery detail, personal, secret, or credential content and no package materialization or transfer, Figma connection or call, credential request, permission grant, write authorization or execution, target or design validation, design approval, baseline, readiness, implementation, or action authority.",
      },
      state: status.state,
      actions: [],
    }]
  })
  return {
    id: "governed-figma-write",
    title: "Governed Figma Write Authorization-Review Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "receipts", label: "Request receipts" },
      { key: "package", label: "Exact package binding" },
      { key: "target", label: "Privacy-safe target" },
      { key: "governance", label: "Approval and recovery states" },
      { key: "assessment", label: "Candidate state" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Privacy and authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No governed Figma Write candidate",
        "Create an exact authorization-review candidate through the governed engine workflow. This view does not materialize or transfer context, connect to or call Figma, request credentials, grant permissions, authorize or perform writes, validate targets or design, approve design, establish a baseline or readiness, or authorize implementation or action.",
      ),
    } : {}),
  }
}

function finalizedFigmaSnapshotImportTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = [...state.finalizedFigmaSnapshotImportProjections.values()].flatMap((projection) => {
    const record = projection.candidate
    if (!record) return []
    const status = projection.status
    return [{
      id: record.id,
      cells: {
        initiative: projection.initiative.id,
        record: record.id,
        revision: String(record.revision),
        digest: record.digest,
        membership: record.membershipDigest,
        governedWrite: `${record.governedWrite.recordId} · r${record.governedWrite.revision} · request ${record.governedWrite.requestDigest} · effect ${record.governedWrite.effectDigest}`,
        receipts: `file ${record.externalFileIdentityDigest} · returned version ${record.returnedExternalVersionDigest} · payload ${record.payloadDigest} · receipt ${record.receiptDigest}`,
        inventory: `${record.itemCount} items · ${record.conflictCount} conflicts · reconciliation ${record.reconciliationDigest}`,
        governance: `return authorization ${status.returnAuthorizationState} · reconciliation ${status.reconciliationState} · provenance ${status.provenanceState} · completeness ${status.snapshotCompletenessState}`,
        assessment: `${status.state} · ${status.reviewState} · execution ${status.importExecutionState} · result ${status.importResultState}`,
        gaps: `${status.sourceRecordedItemCount} source-recorded items · ${status.notAssessedItemCount} unassessed items · ${status.openConflictCount} open conflicts · ${status.unresolvedQuestionCount} questions · ${status.staleBindingCount} stale bindings · ${status.staleSourceReferenceCount} stale Source references`,
        boundary: "Candidate identities, counts, statuses, and digests only; no Figma content, names, external identities, Source content, authorization actor, personal, secret, credential, or permission content and no content transfer or import, Figma connection or call, credential request, permission grant, external-completeness proof, target or design validation, design approval, baseline, readiness, implementation, or action authority.",
      },
      state: status.state,
      actions: [],
    }]
  })
  return {
    id: "finalized-figma-snapshot-import",
    title: "Finalized Figma Snapshot Import Review Candidate",
    columns: [
      { key: "initiative", label: "Initiative", identifier: true },
      { key: "record", label: "Candidate" },
      { key: "revision", label: "Revision" },
      { key: "digest", label: "Exact digest" },
      { key: "membership", label: "Membership digest" },
      { key: "governedWrite", label: "Exact governed-write binding" },
      { key: "receipts", label: "Return receipts" },
      { key: "inventory", label: "Privacy-safe inventory" },
      { key: "governance", label: "Reconciliation and evidence" },
      { key: "assessment", label: "Candidate state" },
      { key: "gaps", label: "Candidate gaps" },
      { key: "boundary", label: "Privacy and authority boundary" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: emptySurface(
        "No finalized Figma Snapshot Import candidate",
        "Record an exact attributable return receipt through the governed engine workflow. This view does not transfer or import content, connect to or call Figma, request credentials, grant permissions, prove external completeness, validate or approve design, establish a baseline or readiness, or authorize implementation or action.",
      ),
    } : {}),
  }
}

function designForm(route: RecordFormRoute, state: ObservedStudioState): RecordFormPageSnapshot {
  const design = designPanel(route, state)
  const businessTable = route === "direction" || route === "users-jobs" || route === "outcomes"
    ? businessUnderstandingTable(route, state)
    : undefined
  if (!design) {
    const legacy = legacyForm(route, state.product)
    const relatedRecords = [
      ...(businessTable ? [businessTable] : []),
      ...(route === "users-jobs" ? [designPersonaRoleTable(state), userJourneyTable(state), informationArchitectureTable(state), screenStateInventoryTable(state)] : []),
      ...(route === "architecture"
        ? [businessCapabilityMapTable(state), valueStreamModelTable(state), operatingModelTable(state), businessRuleCatalogTable(state), businessArchitectureBaselineTable(state), systemSolutionArchitectureTable(state), boundedContextModelTable(state), securityPrivacyAssessmentTable(state), processModelTable(state), dataModelTable(state), authorizationModelTable(state), eventIntegrationModelTable(state), failureRecoveryModelTable(state), architectureChallengeModelTable(state), architectureTable(state.architecture), designApplicabilityTable(state)]
        : []),
    ]
    return relatedRecords.length > 0 ? { ...legacy, relatedRecords } : legacy
  }
  const relatedRecords: StudioTableSnapshot[] = []
  if (businessTable) relatedRecords.push(businessTable)
  if (route === "users-jobs") relatedRecords.push(
    designPersonaRoleTable(state), userJourneyTable(state), informationArchitectureTable(state), screenStateInventoryTable(state),
  )
  if (route === "scope") relatedRecords.push(
    requirementsTable(state.requirements),
    designRequirementsTable(state),
    designSystemTokenContractTable(state),
    accessibilityDesignRulesTable(state),
    responsiveMultiPlatformTargetsTable(state),
    manualFigmaExecutionPathTable(state),
    figmaMcpCapabilityDiscoveryTable(state),
    figmaReadSnapshotTable(state),
    figmaContextImportTable(state),
    outboundDesignBriefPackageTable(state),
    governedFigmaWriteTable(state),
    finalizedFigmaSnapshotImportTable(state),
  )
  if (route === "architecture") {
    relatedRecords.push(
      businessCapabilityMapTable(state),
      valueStreamModelTable(state),
      operatingModelTable(state),
      businessRuleCatalogTable(state),
      businessArchitectureBaselineTable(state),
      systemSolutionArchitectureTable(state),
      boundedContextModelTable(state),
      securityPrivacyAssessmentTable(state),
      processModelTable(state),
      dataModelTable(state),
      authorizationModelTable(state),
      eventIntegrationModelTable(state),
      failureRecoveryModelTable(state),
      architectureChallengeModelTable(state),
      architectureTable(state.architecture),
      designApplicabilityTable(state),
    )
  }
  return {
    ...base(route, state.product),
    design,
    kind: "record-form",
    recordId: state.product?.id,
    draftId: design.draftId,
    baseRevision: design.baseProductRevision,
    fields: design.fields,
    gaps: design.gaps,
    conflicts: design.conflicts,
    draft: {
      state: design.materialChange ? "revision-ready" : "clean",
      materialChange: design.materialChange,
      validation: ["complete", "deferred"].includes(design.readiness) ? "valid" : design.readiness === "conflicted" ? "blocked" : "not-validated",
    },
    ...(relatedRecords.length > 0 ? { relatedRecords } : {}),
  }
}

function sectionsFor(state: ObservedStudioState): OverviewSectionStatus[] {
  const section = (route: StudioRoute, completion: CompletionState, gapCount: number): OverviewSectionStatus =>
    ({ route, state: completion, gapCount })
  if (!state.product) return studioRoutes.map((route) => section(route, "not-started", 1))
  if (!state.designReadiness) {
    return studioRoutes.map((route) => section(route, route === "overview" ? "in-progress" : "not-started", 1))
  }
  return state.designReadiness.sections.map((candidate) => {
    const gapCount = candidate.missingFields.length + candidate.weakFields.length + candidate.openConflictIds.length +
      candidate.blockerGapIds.length
    const completion: CompletionState = candidate.state === "complete" || candidate.state === "deferred"
      ? "complete"
      : candidate.state === "conflicted"
        ? "blocked"
        : "in-progress"
    return section(candidate.sectionId, completion, gapCount)
  })
}

function selectedInitiativeEntries(state: ObservedStudioState): StudioDefinitionEntry[] {
  const selected = currentInitiative(state.initiatives)
  if (!selected) return []
  const assessment = state.initiativeEntryAssessments.get(selected.id)
  return [
    { term: "Initiative", value: selected.title, recordId: selected.id },
    { term: "State", value: selected.state, recordId: selected.id },
    { term: "Outcome", value: selected.outcome, recordId: selected.id },
    { term: "Classification", value: assessment ? assessment.classification.status : "not assessed", recordId: selected.id },
    { term: "Applicability", value: assessment ? assessment.applicability.status : "not assessed", recordId: selected.id },
    { term: "Entry assessment", value: assessment?.state ?? "not assessed", recordId: selected.id },
    { term: "Authority", value: "Entry assessment is read-only and grants no approval, readiness, or action authority.", recordId: selected.id },
  ]
}

function latestRunEntries(runs: Run[]): StudioDefinitionEntry[] {
  const run = newestRun(runs)
  if (!run) return []
  return [
    { term: "Run", value: run.id, recordId: run.id },
    { term: "State", value: run.state, recordId: run.id },
    { term: "Agent", value: boundedDisplay(`${run.agent.agentId} / ${run.agent.modelId}`), recordId: run.id },
  ]
}

const managedObservationLimit = 200
const managedTimelineLimit = 10_000
const studioTextLimit = 20_000

function boundedDisplay(value: string): string {
  if (value.length <= studioTextLimit) return value
  const suffix = "… [display truncated]"
  return `${value.slice(0, studioTextLimit - suffix.length)}${suffix}`
}

function managedObservationUnavailable(state: ObservedStudioState): boolean {
  return state.issues.some((candidate) => candidate.id === "managed-runs-unavailable")
}

function handoffObservationUnavailable(state: ObservedStudioState): boolean {
  return state.issues.some((candidate) => candidate.id === "handoffs-unavailable")
}

function managedAbsenceValue(state: ObservedStudioState): string {
  if (managedObservationUnavailable(state)) {
    return "Managed Run observation is unavailable; this view makes no absence claim."
  }
  if (state.managedRunTotal > state.managedRuns.length) {
    return `No Managed Run for this legacy Run is present in the newest ${state.managedRuns.length} of ${state.managedRunTotal} observed records; omitted records may or may not contain one.`
  }
  return "No durable Managed Run is bound to this legacy Run."
}

function managedRunTableState(state: ObservedStudioState): string {
  if (managedObservationUnavailable(state)) return "observation unavailable"
  if (state.managedRunTotal > state.managedRuns.length) return "not present in newest bounded window"
  return "not managed"
}

function managedObservationsForRun(state: ObservedStudioState, runId: string): ManagedRunObservation[] {
  return state.managedRuns
    .filter((observation) => observation.record.runId === runId)
    .sort((left, right) => left.record.attemptNumber - right.record.attemptNumber)
}

function safeManagedEventSummary(event: ManagedEvidenceEvent): string {
  switch (event.type) {
    case "lifecycle":
      return `${event.phase}${event.turnStatus ? `; turn ${event.turnStatus}` : ""}. Provider references remain digest-only.`
    case "output":
      return `${event.channel} output retained only as ${event.contentDigest}; ${event.byteLength} byte(s); ${event.redactionCount} redaction(s).`
    case "item":
      return `${event.itemType} ${event.status}; item reference ${event.itemRef}.`
    case "approval":
      return `${event.approvalKind} approval ${event.outcome}; request ${event.requestRef}${event.authorizationRef ? `; authorization ${event.authorizationRef}` : ""}.`
    case "warning":
      return `Warning ${event.code}${event.contentDigest ? `; redacted content ${event.contentDigest}` : ""}.`
    case "error":
      return `Error ${event.code}; ${event.retryable ? "retryable" : "not retryable"}${event.contentDigest ? `; redacted content ${event.contentDigest}` : ""}.`
  }
}

function managedTimeline(state: ObservedStudioState, run: Run | undefined): RunPageSnapshot["events"] {
  if (!run) return []
  const lineage = managedObservationsForRun(state, run.id)
  const latest = lineage.at(-1)
  const events: RunPageSnapshot["events"] = []
  for (const observation of lineage) {
    const { record, result, evidence, applyDecision } = observation
    events.push({
      id: `managed-run:${record.id}`,
      time: record.createdAt,
      kind: `Managed attempt ${record.attemptNumber}`,
      summary: `${record.mode}; state ${record.state}; recovery ${record.recovery.status}${record.previousManagedRunId ? `; resumed from ${record.previousManagedRunId}` : "; lineage root"}.`,
    })
    if (evidence) {
      if (observation === latest) {
        events.push(...evidence.events.map((event) => ({
          id: `managed-event:${record.id}:${event.sequence}`,
          time: event.observedAt,
          kind: event.type,
          summary: safeManagedEventSummary(event),
        })))
      }
      events.push({
        id: `managed-evidence:${evidence.id}`,
        time: evidence.capturedAt,
        kind: "durable evidence",
        summary: [
          `${evidence.events.length} normalized event(s); event-set ${evidence.eventsDigest}`,
          `effects ${evidence.actualEffects.map((effect) => `${effect.effect}=${effect.status}`).join(", ") || "none"}`,
          evidence.staging
            ? `${evidence.staging.changes.length} workspace-relative staged change(s); apply ${evidence.staging.applyState}; ${evidence.staging.excludedPathCount} excluded path(s)`
            : "no staged workspace inventory",
          observation === latest
            ? "normalized event detail shown for this latest attempt"
            : "older-attempt normalized event detail is summarized, not expanded, in this bounded view",
        ].join("; "),
      })
    }
    if (result) {
      events.push({
        id: `managed-result:${result.id}`,
        time: result.endedAt,
        kind: "durable result",
        summary: `Provider ${result.providerDisposition}; termination ${result.terminationCause}; outcome ${result.outcome.status} (${result.outcome.basis}); terminal state ${result.terminalState}; ${result.warnings.length} warning code(s).`,
      })
    }
    if (applyDecision) {
      events.push({
        id: `managed-apply:${applyDecision.id}`,
        time: applyDecision.decidedAt,
        kind: "apply decision",
        summary: `Human decision bound ${applyDecision.changedInventory.length} workspace-relative changed file(s) to inventory ${applyDecision.changedInventoryDigest} and write envelope ${applyDecision.writeEnvelopeDigest}. Actor identity is intentionally withheld.`,
      })
    }
    if (observation.issue) {
      events.push({
        id: `managed-observation-warning:${record.id}`,
        time: record.updatedAt,
        kind: "observation warning",
        summary: observation.issue,
      })
    }
  }
  return events
    .sort((left, right) => left.time.localeCompare(right.time) || left.id.localeCompare(right.id))
    .slice(-managedTimelineLimit)
}

function selectedRunEvidenceEntries(state: ObservedStudioState, run: Run | undefined): StudioDefinitionEntry[] {
  if (!run) return []
  const entries: StudioDefinitionEntry[] = [
    { term: "Run", value: run.id, recordId: run.id },
    { term: "Run state", value: run.state, recordId: run.id },
    { term: "Agent", value: boundedDisplay(`${run.agent.agentId} / ${run.agent.modelId}`), recordId: run.id },
  ]
  const handoffs = state.handoffs.filter((handoff) => handoff.fromRunId === run.id)
  entries.push({
    term: "Handoff lineage",
    value: handoffObservationUnavailable(state)
      ? "Portable handoff observation is unavailable; this view makes no absence claim."
      : state.handoffTotal > state.handoffs.length
        ? `${handoffs.length} matching portable handoff(s) are shown in the bounded observation window; omitted records may or may not reference this Run.`
        : `${handoffs.length} portable handoff(s) originate from this Run.`,
  })
  const lineage = managedObservationsForRun(state, run.id)
  const managed = lineage.at(-1)
  if (!managed) {
    entries.push({ term: "Managed evidence", value: managedAbsenceValue(state) })
    return entries
  }
  const { record, result, evidence, applyDecision } = managed
  entries.push(
    { term: "Managed lineage", value: `Latest observed attempt ${record.attemptNumber}; ${lineage.length} record(s) shown in the bounded window; complete lineage is not inferred; root ${record.rootManagedRunId}` },
    { term: "Event detail boundary", value: "Normalized event detail is expanded for the latest observed attempt; earlier durable evidence remains visible as a digest-bound summary." },
    { term: "Current managed attempt", value: `${record.attemptNumber}; ${record.id}`, recordId: record.id },
    { term: "Managed mode / state", value: `${record.mode} / ${record.state}` },
    { term: "Recovery", value: `${record.recovery.status}${record.recovery.reasonCode ? ` · ${record.recovery.reasonCode}` : ""}` },
    { term: "Exact bindings", value: `${record.bindingsDigest}; ${record.bindings.contextPacks.length} Context Pack(s); ${record.bindings.tools.length} Tool(s)` },
  )
  if (result) entries.push(
    { term: "Durable result", value: `${result.id}; provider ${result.providerDisposition}; ${result.terminationCause}` },
    { term: "Outcome", value: `${result.outcome.status} · ${result.outcome.basis}` },
  )
  if (evidence) entries.push(
    { term: "Durable evidence", value: `${evidence.id}; ${evidence.events.length} normalized event(s); ${evidence.eventsDigest}` },
    { term: "Observed effects", value: evidence.actualEffects.map((effect) => `${effect.effect}=${effect.status}`).join(" · ") || "none" },
    { term: "Staged inventory", value: evidence.staging
      ? `${evidence.staging.changes.length} workspace-relative file(s); ${evidence.staging.applyState}; inventory content remains outside Product Studio`
      : "not applicable" },
  )
  if (applyDecision) entries.push(
    { term: "Apply decision", value: `${applyDecision.id}; ${applyDecision.changedInventory.length} file(s); ${applyDecision.changedInventoryDigest}` },
  )
  return entries
}

function managedEvidenceTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = state.managedRuns.map(({ record, result, evidence, applyDecision, issue: observationIssue }) => ({
    id: record.id,
    cells: {
      managedRun: record.id,
      run: record.runId,
      attempt: String(record.attemptNumber),
      state: record.state,
      outcome: result ? `${result.outcome.status} · ${result.outcome.basis}` : "not available",
      events: evidence ? String(evidence.events.length) : "not available",
      staging: evidence?.staging ? `${evidence.staging.changes.length} file(s) · ${evidence.staging.applyState}` : "not applicable",
      applyDecision: applyDecision ? `${applyDecision.changedInventory.length} file(s) bound` : "none",
      observation: observationIssue ?? "bound graph verified",
    },
    state: observationIssue ? "warning" : record.state,
    actions: [control("Select underlying Run", { kind: "select-record", recordId: record.runId })],
  }))
  return {
    id: "managed-evidence",
    title: "Managed execution evidence",
    columns: [
      { key: "managedRun", label: "Managed Run", identifier: true },
      { key: "run", label: "Run" },
      { key: "attempt", label: "Attempt" },
      { key: "state", label: "State" },
      { key: "outcome", label: "Outcome" },
      { key: "events", label: "Events" },
      { key: "staging", label: "Staging" },
      { key: "applyDecision", label: "Apply decision" },
      { key: "observation", label: "Observation" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: managedObservationUnavailable(state)
        ? emptySurface(
            "Managed execution evidence unavailable",
            "The durable Managed Run reader could not be observed. Review diagnostics; this view does not assert that evidence is absent.",
          )
        : emptySurface(
            "No managed execution evidence",
            "No durable Managed Run is available. Legacy Run lifecycle state does not imply normalized evidence, verified outcome, or an apply decision.",
          ),
    } : {}),
    ...(state.managedRunTotal > rows.length ? {
      truncation: {
        shown: rows.length,
        total: state.managedRunTotal,
        message: `Showing the ${rows.length} newest Managed Runs. Older durable records remain in the governed repository.`,
      },
    } : {}),
  }
}

function managedRecoveryTable(state: ObservedStudioState): StudioTableSnapshot {
  const rows = state.managedRuns.map(({ record, result, issue: observationIssue }) => {
    const recovery = managedRecoveryPresentation(record, observationIssue ? undefined : result)
    const actions: StudioActionControl[] = [control("Select underlying Run", {
      kind: "select-record",
      recordId: record.runId,
    })]
    if (recovery?.canOpenDiscardReview && !observationIssue) {
      actions.push(control(
        "Open exact discard review",
        { kind: "open-managed-discard", managedRunId: record.id, expectedRevision: record.revision },
        true,
        "danger",
      ))
    }
    if (recovery?.canRetryRecovery && !observationIssue) {
      actions.push(control("Retry Recovery", { kind: "retry-recovery" }))
    }
    if (observationIssue || recovery?.kind === "unknown" || recovery?.kind === "quarantined" ||
        recovery?.kind === "local-cleanup-pending") {
      actions.push(control("Show diagnostics", { kind: "show-diagnostics" }))
    }
    return {
      id: `recovery:${record.id}`,
      cells: {
        managedRun: record.id,
        run: record.runId,
        persistedState: record.state,
        attention: observationIssue
          ? "Bound recovery evidence withheld"
          : recovery?.status ?? "No recovery attention state exposed",
        recovery: recovery?.recovery ?? `Persisted recovery status: ${record.recovery.status}`,
        localCleanup: recovery?.localCleanup ?? "No verified local-cleanup statement is exposed",
        boundary: observationIssue
          ? "Bound Result or Evidence could not be verified. No recovery, apply, cleanup, or outcome claim is made."
          : recovery?.meaning ?? "No recovery action is inferred. Process ownership and machine-local cleanup are outside this persisted row.",
      },
      state: observationIssue ? "verification-withheld" : recovery?.kind ?? "no-attention",
      actions,
    }
  })
  return {
    id: "managed-recovery",
    title: "Restart and recovery state",
    columns: [
      { key: "managedRun", label: "Managed Run", identifier: true },
      { key: "run", label: "Run" },
      { key: "persistedState", label: "Persisted state" },
      { key: "attention", label: "Recovery attention" },
      { key: "recovery", label: "Persisted recovery" },
      { key: "localCleanup", label: "Local cleanup boundary" },
      { key: "boundary", label: "Non-authoritative meaning" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: managedObservationUnavailable(state)
        ? emptySurface(
            "Recovery observation unavailable",
            "Managed Run recovery state is withheld because the audit or durable reader boundary could not be verified. No absence or success claim is made.",
            [control("Show diagnostics", { kind: "show-diagnostics" })],
          )
        : emptySurface(
            "No durable Managed Run recovery rows",
            "No durable Managed Run is present in the bounded observation. This does not attest provider process state or machine-local cleanup.",
          ),
    } : {}),
    ...(state.managedRunTotal > rows.length ? {
      truncation: {
        shown: rows.length,
        total: state.managedRunTotal,
        message: `Recovery projection is limited to the newest ${rows.length} Managed Runs. Older persisted recovery states are not interpreted in this view.`,
      },
    } : {}),
  }
}

function handoffTable(state: ObservedStudioState): StudioTableSnapshot {
  const records = state.handoffs
  const rows = records.map((record) => ({
    id: record.id,
    cells: {
      handoff: record.id,
      fromRun: record.fromRunId,
      target: boundedDisplay(`${record.toAgent.agentId} / ${record.toAgent.modelId}`),
      workspace: `${record.workspaceBaseline.changedFiles.length} workspace-relative change(s) · ${record.workspaceBaseline.truthClass ?? "not classified"}`,
      evidence: `${record.evidence.length} evidence reference(s)`,
      unresolved: String(record.unresolvedMatters.length),
      status: record.acknowledgedAt ? "acknowledged" : "recorded",
      created: record.createdAt,
    },
    state: record.acknowledgedAt ? "acknowledged" : "recorded",
    actions: [control("Select source Run", { kind: "select-record", recordId: record.fromRunId })],
  }))
  return {
    id: "handoffs",
    title: "Portable handoff history",
    columns: [
      { key: "handoff", label: "Handoff", identifier: true },
      { key: "fromRun", label: "From Run" },
      { key: "target", label: "Target agent / model" },
      { key: "workspace", label: "Workspace baseline" },
      { key: "evidence", label: "Evidence" },
      { key: "unresolved", label: "Unresolved" },
      { key: "status", label: "Status" },
      { key: "created", label: "Created" },
    ],
    rows,
    actions: [],
    ...(rows.length === 0 ? {
      emptyState: handoffObservationUnavailable(state)
        ? emptySurface(
            "Portable handoff history unavailable",
            "The governed handoff reader could not be observed. Review diagnostics; this view does not assert that handoff history is absent.",
          )
        : state.handoffTotal > 0
          ? emptySurface(
              "Portable handoff details withheld by safety bounds",
              state.handoffPlatformAttestationUnavailable
                ? "Governed handoff records exist, but native Windows cannot attest no-follow file identity, so their contents are withheld. No chronology or absence claim is made."
                : "Governed handoff records exist, but none were loaded inside the deterministic count, byte, and stable-file observation boundary. No chronology or absence claim is made.",
            )
          : emptySurface(
            "No portable handoff history",
            "No governed agent/model handoff is recorded. Runtime paths, process identities, credentials, and free-text handoff content are never projected here.",
          ),
    } : {}),
    ...(state.handoffTotal > rows.length ? {
      truncation: {
        shown: rows.length,
        total: state.handoffTotal,
        message: [
          `Showing ${rows.length} parsed handoff record(s) from a deterministic filename window of ${state.handoffSelectedFileCount}.`,
          `${state.handoffOmittedOutsideWindow} record(s) are outside that window and ${state.handoffOmittedForResourceSafety} selected record(s) were withheld by byte or stable-file identity limits.`,
          ...(state.handoffPlatformAttestationUnavailable
            ? ["Native Windows cannot attest no-follow file identity, so selected handoff contents are withheld."]
            : []),
          "The bounded view does not assert global recency or absence.",
        ].join(" "),
      },
    } : {}),
  }
}

interface PrepareRunEligibility {
  eligible: boolean
  selectionReady: boolean
  initiativeReady: boolean
  reason?: string
  issues: StudioIssue[]
  selectedInitiative?: Initiative
}

function prepareRunEligibility(state: ObservedStudioState): PrepareRunEligibility {
  const issues: StudioIssue[] = []
  let selectionReady = false
  if (!state.selection) {
    issues.push(issue(
      "agent-selection-missing",
      state.selectionMigrationRequired
        ? "A legacy path-bearing selection is blocked. Reconfirm the same agent through the explicit migration workflow before preparing a run."
        : "Select a supported agent and model before preparing a run.",
      "blocker",
    ))
  } else if (state.selection.agentId !== "codex-cli") {
    issues.push(issue(
      "agent-selection-unsupported",
      `${state.selection.agentId} is inspection-only in this release and cannot start a governed run.`,
      "blocker",
    ))
  } else {
    const unsafe = unsafeSelectionReasons(state.selection.agentId, state.selection.settings)
    if (unsafe.length > 0) {
      issues.push(...unsafe.map((message, index) => issue(`selection-${index + 1}`, message, "blocker")))
    } else if (state.runtimeBinding?.state !== "ready") {
      const bindingMessage = state.runtimeBinding?.state === "legacy"
        ? "The machine-local runtime binding uses the legacy path-bearing format. Explicitly select the agent again before preparing a run."
        : state.runtimeBinding?.state === "invalid"
          ? "The machine-local runtime binding is invalid. Explicitly select the agent again before preparing a run."
          : "No machine-local executable fingerprint is bound to this selection. Explicitly select the agent again before preparing a run."
      issues.push(issue("agent-binding-unavailable", bindingMessage, "blocker"))
    } else if (
      state.runtimeBinding.binding.adapterId !== state.selection.adapterId ||
      state.runtimeBinding.binding.agentId !== state.selection.agentId ||
      state.runtimeBinding.binding.capabilityDigest !== state.selection.capabilityDigest
    ) {
      issues.push(issue(
        "agent-binding-stale",
        "The machine-local runtime binding no longer matches the portable selection. Probe and select the agent again.",
        "blocker",
      ))
    } else {
      selectionReady = true
    }
  }

  const selectedInitiative = currentInitiative(state.initiatives)
  let initiativeReady = false
  if (!selectedInitiative) {
    issues.push(issue("initiative-missing", "Create and activate a bounded Initiative before preparing a run.", "blocker"))
  } else {
    const initiative = initiativeRunEligibility(selectedInitiative)
    initiativeReady = initiative.eligible
    if (!initiative.eligible) {
      issues.push(issue(
        `initiative-${selectedInitiative.id}`,
        initiative.reason ?? "The selected Initiative cannot prepare a run.",
        "blocker",
        selectedInitiative.id,
      ))
    }
  }

  const running = state.runs.find((run) => run.state === "running")
  if (running) issues.push(issue(`run-${running.id}`, `Run ${running.id} is already running.`, "blocker", running.id))
  for (const run of state.runs.filter((candidate) => candidate.state === "unknown")) {
    issues.push(issue(`run-${run.id}`, `Run ${run.id} has unknown effects and requires investigation.`, "blocker", run.id))
  }
  if (!state.audit) issues.push(issue("audit-unavailable", "The local audit chain could not be verified.", "blocker"))
  else if (!state.audit.valid) issues.push(issue("audit-invalid", "The local audit chain did not verify.", "blocker"))

  return {
    eligible: selectionReady && initiativeReady && issues.length === 0,
    selectionReady,
    initiativeReady,
    ...(issues[0] ? { reason: issues[0].message } : {}),
    issues,
    ...(selectedInitiative ? { selectedInitiative } : {}),
  }
}

function prepareRunControl(eligibility: PrepareRunEligibility): StudioActionControl {
  return control(
    "Create charter and start run",
    { kind: "prepare-run" },
    eligibility.eligible,
    "primary",
    eligibility.eligible ? undefined : eligibility.reason ?? "Resolve the current run-preparation blockers first.",
  )
}

function uniqueIssues(issues: StudioIssue[]): StudioIssue[] {
  return [...new Map(issues.map((candidate) => [candidate.id, candidate])).values()]
}

function primaryAction(state: ObservedStudioState, eligibility = prepareRunEligibility(state)): StudioActionControl | undefined {
  if (!state.product) return control("Initialize Product", { kind: "initialize-product" }, true, "primary")
  if (!state.designDraft) {
    return control("Start governed Product design", {
      kind: "start-design-draft",
      expectedProductRevision: state.product.revision ?? 1,
    }, true, "primary")
  }
  if (!state.selection || !eligibility.selectionReady) {
    return control(
      state.selectionMigrationRequired ? "Reconfirm and migrate agent selection" : "Select agent and model",
      { kind: "select-agent", adapterId: "native-picker", agentId: "native-picker", modelId: "native-picker", settings: {} },
      true,
      "primary",
    )
  }
  const selected = eligibility.selectedInitiative
  if (!selected) return control("Create Initiative", { kind: "create-initiative" }, true, "primary")
  if (!eligibility.initiativeReady) {
    return control("Review Initiative state", {
      kind: "transition-record",
      recordType: "initiative",
      recordId: selected.id,
      toState: "native-picker",
      reason: "Confirm in the native GAEP workflow",
    }, true, "primary")
  }
  return prepareRunControl(eligibility)
}

function overviewPage(state: ObservedStudioState): OverviewPageSnapshot {
  const product = state.product
  const eligibility = prepareRunEligibility(state)
  const blockers = uniqueIssues([
    ...state.issues,
    ...state.initiatives.filter((candidate) => candidate.state === "blocked")
      .map((candidate) => issue(`initiative-${candidate.id}`, `${candidate.title} is blocked.`, "blocker", candidate.id)),
    ...eligibility.issues,
  ])
  const primary = primaryAction(state, eligibility)
  return {
    ...base("overview", product),
    ...(designPanel("overview", state) ? { design: designPanel("overview", state) } : {}),
    kind: "overview",
    product: {
      name: product?.name ?? "Product not initialized",
      lifecycle: product?.lifecycleState ?? "uninitialized",
      ...(product?.revision ? { revision: product.revision } : {}),
      readinessStatement: product
        ? state.designReadiness
          ? `Design readiness: ${state.designReadiness.status}. This is not implementation approval.`
          : "Product truth is available; start or resume the governed design draft to evaluate design readiness."
        : "Initialize a Product before readiness can be evaluated.",
    },
    ...(primary ? { primaryAction: primary } : {}),
    sections: sectionsFor(state),
    currentInitiative: selectedInitiativeEntries(state),
    latestRun: latestRunEntries(state.runs),
    blockers,
  }
}

function deliveryPage(state: ObservedStudioState): DeliveryPageSnapshot {
  const initiatives: StudioTableSnapshot = {
    id: "initiatives",
    title: "Initiatives",
    columns: [
      { key: "title", label: "Initiative", identifier: true },
      { key: "outcome", label: "Outcome" },
      { key: "state", label: "State" },
      { key: "classification", label: "Classification" },
      { key: "applicability", label: "Applicability" },
      { key: "entry", label: "Entry assessment" },
      { key: "authority", label: "Authority boundary" },
      { key: "updated", label: "Updated" },
    ],
    rows: state.initiatives.map((candidate) => {
      const assessment = state.initiativeEntryAssessments.get(candidate.id)
      const mutable = !["completed", "cancelled"].includes(candidate.state)
      const exactRevision = candidate.revision ?? 1
      const canResolve = mutable && assessment?.classification.status === "current"
      const completeness = assessment?.classification.completeness
      const coverage = assessment?.applicability.coverage
      return {
        id: candidate.id,
        cells: {
          title: candidate.title,
          outcome: candidate.outcome,
          state: candidate.state,
          classification: assessment
            ? `${assessment.classification.status}${candidate.classification ? ` · ${candidate.classification.primaryType} / ${candidate.classification.productProfile}` : ""} · completeness ${completeness?.status ?? "unreported"}${completeness ? ` (${completeness.unknownDimensionCount} unknown, ${completeness.unresolvedQuestionCount} unresolved question(s))` : ""}`
            : "unavailable",
          applicability: assessment
            ? `${assessment.applicability.status} · ${assessment.applicability.decisionCount} decision(s) · ${assessment.applicability.unresolvedSubjectCount} unresolved · coverage ${coverage?.status ?? "unreported"}${coverage ? ` (${coverage.coveredSubjectCount}/${coverage.subjectCount}, ${coverage.missingSubjectCount} missing, ${coverage.unexpectedSubjectCount} unexpected, ${coverage.mismatchedSubjectCount} mismatched)` : ""}`
            : "unavailable",
          entry: assessment
            ? `${assessment.state}${assessment.reasons.length > 0 ? ` · ${assessment.reasons.join("; ")}` : " · no recorded entry gaps"}`
            : "not assessed",
          authority: "Entry assessment is read-only and grants no approval, readiness, or action authority.",
          updated: candidate.updatedAt,
        },
        state: assessment?.state ?? candidate.state,
        actions: [
          control(
            candidate.classification ? "Reclassify" : "Classify",
            { kind: "classify-initiative", initiativeId: candidate.id, expectedRevision: exactRevision },
            mutable && Boolean(assessment),
            "secondary",
            !mutable
              ? `Terminal Initiative ${candidate.state} entry records are immutable.`
              : assessment ? undefined : "Refresh after exact audit-bound entry assessment is available.",
          ),
          control(
            candidate.applicability ? "Re-resolve applicability" : "Resolve applicability",
            { kind: "resolve-initiative-applicability", initiativeId: candidate.id, expectedRevision: exactRevision },
            canResolve,
            "secondary",
            !mutable
              ? `Terminal Initiative ${candidate.state} entry records are immutable.`
              : assessment?.classification.status === "current"
                ? undefined
                : "Record a classification bound to the current Product revision first.",
          ),
          control("Change state", {
            kind: "transition-record",
            recordType: "initiative",
            recordId: candidate.id,
            toState: "native-picker",
            reason: "Confirm in the native GAEP workflow",
          }),
        ],
      }
    }),
    actions: [control("Create Initiative", { kind: "create-initiative" }, true, "primary")],
    ...(state.initiatives.length === 0 ? { emptyState: emptySurface("No Initiatives", "Create a bounded Initiative before preparing a run.", [control("Create Initiative", { kind: "create-initiative" }, true, "primary")]) } : {}),
  }
  const projections = [...state.sourceGovernanceProjections.values()]
  const sourceTotal = projections.reduce((total, projection) => total + projection.limits.sources.total, 0)
  const baselineTotal = projections.reduce((total, projection) => total + projection.limits.baselines.total, 0)
  const provenanceTotal = projections.reduce((total, projection) => total + projection.limits.provenance.total, 0)
  const sources: StudioTableSnapshot = {
    id: "sources",
    title: "Governed Sources",
    columns: [
      { key: "title", label: "Source", identifier: true },
      { key: "initiative", label: "Initiative" },
      { key: "revision", label: "Revision" },
      { key: "owner", label: "Owner" },
      { key: "authority", label: "Semantic authority" },
      { key: "disposition", label: "Knowledge status" },
      { key: "freshness", label: "Freshness" },
      { key: "availability", label: "Availability" },
    ],
    rows: projections.flatMap((projection) => projection.sources.map((record) => ({
      id: record.id,
      cells: {
        title: record.title,
        initiative: projection.initiative.id,
        revision: String(record.revision),
        owner: `${record.owner.kind}:${record.owner.id ?? "unassigned"}`,
        authority: `${record.semanticAuthority.standing} · ${record.semanticAuthority.domain}`,
        disposition: record.knowledgeDisposition,
        freshness: record.freshness,
        availability: record.availability,
      },
      state: record.freshness === "fresh" && record.availability === "available" ? "current" : "attention-required",
      actions: [],
    }))),
    actions: [],
    ...(sourceTotal === 0 ? {
      emptyState: emptySurface(
        "No governed Sources",
        "Record an exact Source with owner, semantic-authority standing, revision identity, content digest, trust, rights, freshness, and availability.",
      ),
    } : {}),
  }
  const sourceBaselines: StudioTableSnapshot = {
    id: "source-baselines",
    title: "Candidate Source Baselines",
    columns: [
      { key: "title", label: "Candidate Baseline", identifier: true },
      { key: "initiative", label: "Initiative" },
      { key: "revision", label: "Revision" },
      { key: "members", label: "Exact Sources" },
      { key: "status", label: "Binding status" },
      { key: "boundary", label: "Authority boundary" },
    ],
    rows: projections.flatMap((projection) => projection.baselines.map((record) => ({
      id: record.id,
      cells: {
        title: record.title,
        initiative: projection.initiative.id,
        revision: String(record.revision),
        members: String(record.memberCount),
        status: record.assessmentStatus,
        boundary: "Candidate snapshot only; no approval, designation, authorization, or supersession.",
      },
      state: record.assessmentStatus,
      actions: [],
    }))),
    actions: [],
    ...(baselineTotal === 0 ? {
      emptyState: emptySurface(
        "No candidate Source Baseline",
        "Create a versioned candidate snapshot from exact Source revisions. Candidate membership does not designate an approved Baseline Set.",
      ),
    } : {}),
  }
  const sourceProvenance: StudioTableSnapshot = {
    id: "source-provenance",
    title: "Source Provenance",
    columns: [
      { key: "record", label: "Provenance", identifier: true },
      { key: "initiative", label: "Initiative" },
      { key: "target", label: "Target" },
      { key: "disposition", label: "Knowledge status" },
      { key: "sources", label: "Exact Sources" },
      { key: "transformations", label: "Transformations" },
      { key: "boundary", label: "Authority boundary" },
    ],
    rows: projections.flatMap((projection) => projection.provenance.map((record) => ({
      id: record.id,
      cells: {
        record: record.id,
        initiative: projection.initiative.id,
        target: record.targetKind,
        disposition: record.disposition,
        sources: String(record.sourceCount),
        transformations: String(record.transformationCount),
        boundary: "Attributed lineage only; no approval, validation, authorization, or authority transfer.",
      },
      state: record.disposition,
      actions: [],
    }))),
    actions: [],
    ...(provenanceTotal === 0 ? {
      emptyState: emptySurface(
        "No Source Provenance",
        "Record exact Source-to-claim, Source-to-artifact, or Source-to-governed-record lineage.",
      ),
    } : {}),
  }
  return {
    ...base("delivery", state.product),
    ...(designPanel("delivery", state) ? { design: designPanel("delivery", state) } : {}),
    kind: "delivery",
    actions: [
      control("Create Initiative", { kind: "create-initiative" }, true, "primary"),
      domainControl("Create Change", "create-change"),
      domainControl("Create Work Item", "create-work-item"),
    ],
    initiatives,
    sources,
    sourceBaselines,
    sourceProvenance,
    changes: changesTable(state.changes, state.product),
    workItems: workItemsTable(state.workItems),
  }
}

function changesTable(records: Change[], product?: Product): StudioTableSnapshot {
  if (records.length === 0) return recordEmpty("changes", "Changes", "Create Change", "create-change")
  return {
    id: "changes",
    title: "Changes",
    columns: [
      { key: "title", label: "Change", identifier: true },
      { key: "initiative", label: "Initiative" },
      { key: "baseline", label: "Baseline" },
      { key: "effects", label: "Effects" },
      { key: "state", label: "State" },
      { key: "revision", label: "Revision" },
    ],
    rows: records.map((record) => ({
      id: record.id,
      cells: {
        title: record.title,
        initiative: record.initiativeId,
        baseline: record.baseline.kind === "exact"
          ? `${record.baseline.subjectType}:${record.baseline.subjectId}@${record.baseline.revision}`
          : `genesis: ${record.baseline.declaration}`,
        effects: record.effectEnvelope.join(", "),
        state: record.state,
        revision: String(record.revision),
      },
      state: record.state,
      actions: [
        control("Inspect", { kind: "open-record", recordId: record.id }),
        ...(product ? [control("Show impact", {
          kind: "show-change-impact",
          expectedProductId: product.id,
          expectedProductRevision: product.revision ?? 1,
          expectedProductDigest: canonicalDigest(product),
          expectedChangeId: record.id,
          expectedChangeRevision: record.revision,
          expectedChangeDigest: canonicalDigest(record),
        })] : []),
        domainControl("Edit", "edit-change", record.id, record.revision),
      ],
    })),
    actions: [domainControl("Create Change", "create-change", undefined, undefined, "primary")],
  }
}

function workItemsTable(records: WorkItem[]): StudioTableSnapshot {
  if (records.length === 0) return recordEmpty("work-items", "Work Items", "Create Work Item", "create-work-item")
  return {
    id: "work-items",
    title: "Work Items",
    columns: [
      { key: "title", label: "Work Item", identifier: true },
      { key: "change", label: "Change" },
      { key: "dependencies", label: "Dependencies" },
      { key: "owner", label: "Owner" },
      { key: "state", label: "State" },
      { key: "revision", label: "Revision" },
    ],
    rows: records.map((record) => ({
      id: record.id,
      cells: {
        title: record.title,
        change: record.changeId,
        dependencies: record.dependsOn.join(", ") || "none",
        owner: record.owner.kind === "unassigned" ? "unassigned" : `${record.owner.kind}:${record.owner.id}`,
        state: record.state,
        revision: String(record.revision),
      },
      state: record.state,
      actions: [
        control("Inspect", { kind: "open-record", recordId: record.id }),
        domainControl("Edit", "edit-work-item", record.id, record.revision),
      ],
    })),
    actions: [domainControl("Create Work Item", "create-work-item", undefined, undefined, "primary")],
  }
}

function requirementsTable(records: Requirement[]): StudioTableSnapshot {
  if (records.length === 0) return recordEmpty("requirements", "Requirements", "Create Requirement", "create-requirement")
  return {
    id: "requirements",
    title: "Requirements",
    columns: [
      { key: "key", label: "Requirement", identifier: true },
      { key: "statement", label: "Statement" },
      { key: "priority", label: "Priority" },
      { key: "state", label: "State" },
      { key: "revision", label: "Revision" },
    ],
    rows: records.map((record) => ({
      id: record.id,
      cells: { key: record.key, statement: record.statement, priority: record.priority, state: record.state, revision: String(record.revision) },
      state: record.state,
      actions: [
        control("Inspect", { kind: "open-record", recordId: record.id }),
        domainControl("Edit", "edit-requirement", record.id, record.revision),
      ],
    })),
    actions: [domainControl("Create Requirement", "create-requirement", undefined, undefined, "primary")],
  }
}

function architectureTable(records: ArchitectureRecord[]): StudioTableSnapshot {
  if (records.length === 0) return recordEmpty("architecture-records", "Architecture records", "Create Architecture record", "create-architecture")
  return {
    id: "architecture-records",
    title: "Architecture records",
    columns: [
      { key: "title", label: "Record", identifier: true },
      { key: "type", label: "Type" },
      { key: "state", label: "State" },
      { key: "revision", label: "Revision" },
    ],
    rows: records.map((record) => ({
      id: record.id,
      cells: { title: record.title, type: record.recordType, state: record.state, revision: String(record.revision) },
      state: record.state,
      actions: [
        control("Inspect", { kind: "open-record", recordId: record.id }),
        domainControl("Edit", "edit-architecture", record.id, record.revision),
      ],
    })),
    actions: [domainControl("Create Architecture record", "create-architecture", undefined, undefined, "primary")],
  }
}

function risksPage(state: ObservedStudioState): RisksDecisionsPageSnapshot {
  const decisions: StudioTableSnapshot = state.decisions.length === 0
    ? recordEmpty("decisions", "Decisions", "Create Decision", "create-decision")
    : {
        id: "decisions",
        title: "Decisions",
        columns: [
          { key: "question", label: "Decision", identifier: true },
          { key: "recommendation", label: "Recommendation" },
          { key: "outcome", label: "Selected outcome" },
          { key: "state", label: "State" },
          { key: "revision", label: "Revision" },
        ],
        rows: state.decisions.map((record) => ({
          id: record.id,
          cells: {
            question: record.question,
            recommendation: record.recommendation?.optionId ?? "none",
            outcome: record.selectedOutcome?.optionId ?? "not selected",
            state: record.state,
            revision: String(record.revision),
          },
          state: record.state,
          actions: [
            control("Inspect", { kind: "open-record", recordId: record.id }),
            domainControl("Edit", "edit-decision", record.id, record.revision),
          ],
        })),
        actions: [domainControl("Create Decision", "create-decision", undefined, undefined, "primary")],
      }
  const risks: StudioTableSnapshot = state.risks.length === 0
    ? recordEmpty("risks", "Risks", "Create Risk", "create-risk")
    : {
        id: "risks",
        title: "Risks",
        columns: [
          { key: "title", label: "Risk", identifier: true },
          { key: "likelihood", label: "Likelihood" },
          { key: "impact", label: "Impact" },
          { key: "owner", label: "Owner" },
          { key: "state", label: "State" },
          { key: "revision", label: "Revision" },
        ],
        rows: state.risks.map((record) => ({
          id: record.id,
          cells: {
            title: record.title,
            likelihood: record.likelihood,
            impact: record.impact,
            owner: record.owner.kind === "unassigned" ? "unassigned" : `${record.owner.kind}:${record.owner.id}`,
            state: record.state,
            revision: String(record.revision),
          },
          state: record.state,
          actions: [
            control("Inspect", { kind: "open-record", recordId: record.id }),
            domainControl("Edit", "edit-risk", record.id, record.revision),
          ],
        })),
        actions: [domainControl("Create Risk", "create-risk", undefined, undefined, "primary")],
      }
  const recommendations: StudioTableSnapshot = {
    id: "recommendations",
    title: "Recommendations",
    columns: [
      { key: "decision", label: "Decision", identifier: true },
      { key: "option", label: "Recommended option" },
      { key: "rationale", label: "Rationale" },
      { key: "proposedBy", label: "Proposed by" },
    ],
    rows: state.decisions.filter((record) => record.recommendation).map((record) => ({
      id: record.id,
      cells: {
        decision: record.question,
        option: record.recommendation!.optionId,
        rationale: record.recommendation!.rationale,
        proposedBy: `${record.recommendation!.proposedBy.kind}:${record.recommendation!.proposedBy.id}`,
      },
      actions: [control("Inspect decision", { kind: "open-record", recordId: record.id })],
    })),
    actions: [],
    ...(state.decisions.every((record) => !record.recommendation)
      ? { emptyState: emptySurface("No recommendations", "Recommendations remain distinct from attributable human decisions.") }
      : {}),
  }
  return {
    ...base("risks-decisions", state.product),
    ...(designPanel("risks-decisions", state) ? { design: designPanel("risks-decisions", state) } : {}),
    kind: "risks-decisions",
    actions: [domainControl("Create Risk", "create-risk", undefined, undefined, "primary"), domainControl("Create Decision", "create-decision")],
    risks,
    recommendations,
    decisions,
    decisionRegisters: decisionRegisterTable(state),
    riskRegisters: riskRegisterTable(state),
    evidenceRegistries: evidenceRegistryTable(state),
  }
}

function tracePage(state: ObservedStudioState): TracePageSnapshot {
  const relationships: StudioTableSnapshot = state.traceLinks.length === 0
    ? recordEmpty("relationships", "Relationships", "Create Trace link", "create-trace-link")
    : {
        id: "relationships",
        title: "Relationships",
        columns: [
          { key: "source", label: "Source", identifier: true },
          { key: "relationship", label: "Relationship" },
          { key: "target", label: "Target" },
          { key: "state", label: "State" },
          { key: "revision", label: "Revision" },
        ],
        rows: state.traceLinks.map((record) => ({
          id: record.id,
          cells: {
            source: `${record.source.recordType}:${record.source.recordId}`,
            relationship: record.relationship,
            target: `${record.target.recordType}:${record.target.recordId}`,
            state: record.state,
            revision: String(record.revision),
          },
          state: record.state,
          actions: [
            control("Analyze source impact", {
              kind: "analyze-impact",
              recordId: record.source.recordId,
              recordType: record.source.recordType,
              ...(record.source.revision ? { revision: record.source.revision } : {}),
              ...(record.source.digest ? { digest: record.source.digest } : {}),
            }),
            domainControl("Reassess", "reassess-trace-link", record.id, record.revision),
          ],
        })),
        actions: [domainControl("Create Trace link", "create-trace-link", undefined, undefined, "primary")],
      }
  const searchResults: StudioTableSnapshot = {
    id: "search-results",
    title: "Product-domain search",
    columns: [
      { key: "label", label: "Record", identifier: true },
      { key: "kind", label: "Kind" },
      { key: "excerpt", label: "Excerpt" },
      { key: "revision", label: "Revision" },
    ],
    rows: state.searchResults.map((record) => ({
      id: record.id,
      cells: { label: record.label, kind: record.kind, excerpt: record.excerpt, revision: String(record.revision) },
      actions: [control("Inspect", { kind: "open-record", recordId: record.id })],
    })),
    actions: [domainControl("Search records", "search", undefined, undefined, "primary")],
    ...(state.searchResultTotal > state.searchResults.length ? {
      truncation: {
        shown: state.searchResults.length,
        total: state.searchResultTotal,
        message: "Search results are bounded. Refine the query or record-kind filter to inspect omitted matches.",
      },
    } : {}),
    ...(state.searchResults.length === 0 ? { emptyState: emptySurface("No search results", "Run an explicit Product-domain search; no relationship is inferred from co-location.") } : {}),
  }
  const impactRowLimit = 200
  const impactArrays = state.impact ? [
    state.impact.upstream,
    state.impact.downstream,
    state.impact.validatingEvidence,
    state.impact.decisionsAndRisks,
    state.impact.unresolved,
    state.impact.invalid,
    state.impact.stale,
    state.impact.invalidatedByProposedRevision,
  ] : []
  const impactLocallyTruncated = impactArrays.some((links) => links.length > impactRowLimit)
  const impact = state.impact ? [
    { label: "Upstream", entries: state.impact.upstream.slice(0, impactRowLimit).map((link) => ({ term: link.relationship, value: `${link.source.recordType}:${link.source.recordId}`, recordId: link.id })) },
    { label: "Downstream", entries: state.impact.downstream.slice(0, impactRowLimit).map((link) => ({ term: link.relationship, value: `${link.target.recordType}:${link.target.recordId}`, recordId: link.id })) },
    { label: "Validating evidence", entries: state.impact.validatingEvidence.slice(0, impactRowLimit).map((link) => ({ term: link.relationship, value: `${link.source.recordType}:${link.source.recordId} -> ${link.target.recordType}:${link.target.recordId}`, recordId: link.id })) },
    { label: "Decisions and risks", entries: state.impact.decisionsAndRisks.slice(0, impactRowLimit).map((link) => ({ term: link.relationship, value: `${link.source.recordType}:${link.source.recordId} -> ${link.target.recordType}:${link.target.recordId}`, recordId: link.id })) },
    { label: "Unresolved", entries: state.impact.unresolved.slice(0, impactRowLimit).map((link) => ({ term: link.state, value: `${link.source.recordType}:${link.source.recordId} -> ${link.target.recordType}:${link.target.recordId}`, recordId: link.id })) },
    { label: "Invalid", entries: state.impact.invalid.slice(0, impactRowLimit).map((link) => ({ term: link.state, value: `${link.source.recordType}:${link.source.recordId} -> ${link.target.recordType}:${link.target.recordId}`, recordId: link.id })) },
    { label: "Stale", entries: state.impact.stale.slice(0, impactRowLimit).map((link) => ({ term: link.state, value: `${link.source.recordType}:${link.source.recordId} -> ${link.target.recordType}:${link.target.recordId}`, recordId: link.id })) },
    { label: "Invalidated by proposed revision", entries: state.impact.invalidatedByProposedRevision.slice(0, impactRowLimit).map((link) => ({ term: link.state, value: `${link.source.recordType}:${link.source.recordId} -> ${link.target.recordType}:${link.target.recordId}`, recordId: link.id })) },
  ] : []
  return {
    ...base("trace", state.product),
    ...(designPanel("trace", state) ? { design: designPanel("trace", state) } : {}),
    kind: "trace",
    actions: [domainControl("Create Trace link", "create-trace-link", undefined, undefined, "primary"), domainControl("Search records", "search")],
    relationships,
    traceabilityGraphs: endToEndTraceabilityTable(state),
    readinessGates: p0P4ReadinessGateTable(state),
    p5Handoffs: p5HandoffPackageTable(state),
    impact,
    searchResults,
    ...(state.impact ? { selectedRecordId: state.impact.subject.recordId } : {}),
    caveat: state.impact?.truncated || impactLocallyTruncated
      ? `Trace states are engine-assessed and this impact result is explicitly truncated${impactLocallyTruncated ? ` to ${impactRowLimit} entries per group in this view` : ""}. ${state.impact?.coverageBoundary ?? "Absence from the bounded view does not prove absence of impact"}.`
      : "Trace states are engine-assessed. Unresolved endpoint kinds, stale revisions, and missing references remain visible; no relationship is inferred from filenames or co-location.",
  }
}

function displaySettingValue(value: unknown): string {
  if (value === undefined) return "undefined"
  if (typeof value === "string") return value.slice(0, 20_000)
  if (typeof value === "number" || typeof value === "boolean" || value === null) return String(value)
  try {
    return (JSON.stringify(value) ?? "unknown").slice(0, 20_000)
  } catch {
    return "unavailable"
  }
}

function agentPage(
  state: ObservedStudioState,
): { page: AgentPageSnapshot; inspector?: StudioInspectorSnapshot } {
  const index = new Map(state.agents.map((candidate) => [candidate.adapterId, candidate]))
  const rows = state.agents.map((capability) => {
    const selectable = capability.detected && capability.executionInterface !== "unavailable"
    return {
      id: capability.adapterId,
      cells: {
        agent: capability.agentLabel,
        runtime: capability.runtimeVersion ?? "not observed",
        interface: capability.executionInterface,
        maturity: capability.interfaceMaturity,
        status: agentStatus(capability),
      },
      state: selectable ? "available" : capability.detected ? "detection-only" : "absent",
      actions: [control(
        "Open native agent/model picker",
        { kind: "select-agent", adapterId: "native-picker", agentId: "native-picker", modelId: "native-picker", settings: {} },
        selectable,
        "secondary",
        selectable ? undefined : "This executable cannot be selected for managed execution; review its limitations and re-probe after installing a supported interface.",
      )],
    }
  })
  const selectedCapability = state.selection ? index.get(state.selection.adapterId) : undefined
  const sensitiveKeys = new Set(selectedCapability?.settings.filter((setting) => setting.sensitive).map((setting) => setting.key) ?? [])
  const settings = state.selection
    ? Object.entries(state.selection.settings).map(([key, value]) => ({
        term: key,
        value: sensitiveKeys.has(key) ? "[redacted]" : displaySettingValue(value),
      }))
    : []
  const limitations: StudioIssue[] = state.agents.flatMap((capability) => capability.limitations.slice(0, 50).map((message, index) =>
    issue(`${capability.adapterId}-limitation-${index + 1}`, `${capability.agentLabel}: ${message}`, "information")))
  for (const capability of state.agents.filter((candidate) => candidate.detected)) {
    limitations.unshift(issue(
      `${capability.adapterId}-boundary`,
      `${capability.agentLabel}: ${capability.executionInterface}; capability presence and selection do not grant execution authority.`,
      capability.executionInterface === "unavailable" ? "warning" : "information",
    ))
  }
  const contextPacks: StudioTableSnapshot = state.contextPacks.length === 0
    ? recordEmpty("context-packs", "Context Packs", "Create Context Pack", "create-context-pack")
    : {
        id: "context-packs",
        title: "Context Packs",
        columns: [
          { key: "objective", label: "Objective", identifier: true },
          { key: "recipient", label: "Recipient" },
          { key: "classification", label: "Classification" },
          { key: "sufficiency", label: "Sufficiency" },
          { key: "revision", label: "Revision" },
        ],
        rows: state.contextPacks.map((record) => ({
          id: record.id,
          cells: {
            objective: record.objective,
            recipient: `${record.recipient.kind}:${record.recipient.id}`,
            classification: record.classification.level,
            sufficiency: record.sufficiency.status,
            revision: String(record.revision),
          },
          state: record.sufficiency.status,
          actions: [
            control("Inspect", { kind: "open-record", recordId: record.id }),
            domainControl("Edit", "edit-context-pack", record.id, record.revision),
          ],
        })),
        actions: [domainControl("Create Context Pack", "create-context-pack", undefined, undefined, "primary")],
      }
  const instructionPrivilegeGrants: StudioTableSnapshot = state.instructionPrivilegeGrants.length === 0
    ? recordEmpty(
        "instruction-privilege-grants",
        "Instruction Privilege Grants",
        "Create Instruction Privilege Grant",
        "create-instruction-privilege-grant",
      )
    : {
        id: "instruction-privilege-grants",
        title: "Instruction Privilege Grants",
        columns: [
          { key: "purpose", label: "Purpose", identifier: true },
          { key: "privilege", label: "Privilege" },
          { key: "recipient", label: "Recipient" },
          { key: "authority", label: "Authority" },
          { key: "state", label: "State" },
          { key: "expires", label: "Expires" },
          { key: "revision", label: "Revision" },
        ],
        rows: state.instructionPrivilegeGrants.map((record) => ({
          id: record.id,
          cells: {
            purpose: record.purpose,
            privilege: record.privilege,
            recipient: `${record.recipient.kind}:${record.recipient.id}`,
            authority: `${record.authority.recordType}:${record.authority.recordId}@${record.authority.revision}`,
            state: record.state,
            expires: record.expiresAt ?? "no expiry recorded",
            revision: String(record.revision),
          },
          state: record.state,
          actions: [
            control("Inspect", { kind: "open-record", recordId: record.id }),
            control(
              "Revoke",
              {
                kind: "domain-workflow",
                workflow: "revoke-instruction-privilege-grant",
                recordId: record.id,
                expectedRevision: record.revision,
              },
              record.state === "active",
              record.state === "active" ? "danger" : "secondary",
              record.state === "active" ? undefined : `This grant is already ${record.state}.`,
            ),
          ],
        })),
        actions: [domainControl(
          "Create Instruction Privilege Grant",
          "create-instruction-privilege-grant",
          undefined,
          undefined,
          "primary",
        )],
      }
  const workflowPlans: StudioTableSnapshot = state.workflowPlans.length === 0
    ? recordEmpty("workflow-plans", "Workflow Plans", "Create Workflow Plan", "create-workflow-plan")
    : {
        id: "workflow-plans",
        title: "Workflow Plans",
        columns: [
          { key: "title", label: "Plan", identifier: true },
          { key: "strategy", label: "Strategy" },
          { key: "steps", label: "Steps" },
          { key: "state", label: "State" },
          { key: "revision", label: "Revision" },
        ],
        rows: state.workflowPlans.map((record) => ({
          id: record.id,
          cells: { title: record.title, strategy: record.strategy, steps: String(record.steps.length), state: record.state, revision: String(record.revision) },
          state: record.state,
          actions: [
            control("Inspect", { kind: "open-record", recordId: record.id }),
            domainControl("Edit", "edit-workflow-plan", record.id, record.revision),
          ],
        })),
        actions: [domainControl("Create Workflow Plan", "create-workflow-plan", undefined, undefined, "primary")],
      }
  const toolDefinitions: StudioTableSnapshot = state.toolDefinitions.length === 0
    ? recordEmpty("tool-definitions", "Tool Definitions", "Create Tool Definition", "create-tool-definition")
    : {
        id: "tool-definitions",
        title: "Tool Definitions",
        columns: [
          { key: "name", label: "Tool", identifier: true },
          { key: "binding", label: "Binding" },
          { key: "effects", label: "Effects" },
          { key: "enabled", label: "Enabled" },
          { key: "revision", label: "Revision" },
        ],
        rows: state.toolDefinitions.map((record) => ({
          id: record.id,
          cells: {
            name: record.name,
            binding: record.binding.toolName,
            effects: record.effectEnvelope.join(", ") || "none",
            enabled: record.enabled ? "yes" : "no",
            revision: String(record.revision),
          },
          state: record.enabled ? "enabled" : "disabled",
          actions: [
            control("Inspect", { kind: "open-record", recordId: record.id }),
            domainControl("Edit", "edit-tool-definition", record.id, record.revision),
          ],
        })),
        actions: [domainControl("Create Tool Definition", "create-tool-definition", undefined, undefined, "primary")],
      }
  const runToolSelections: StudioTableSnapshot = state.runToolSelections.length === 0
    ? recordEmpty("run-tool-selections", "Run Tool Selections", "Create Run Tool Selection", "create-run-tool-selection")
    : {
        id: "run-tool-selections",
        title: "Run Tool Selections",
        columns: [
          { key: "run", label: "Run", identifier: true },
          { key: "tools", label: "Tools" },
          { key: "effects", label: "Requested effects" },
          { key: "readiness", label: "Readiness" },
          { key: "revision", label: "Revision" },
        ],
        rows: state.runToolSelections.map((record) => ({
          id: record.id,
          cells: {
            run: record.runId,
            tools: String(record.tools.length),
            effects: record.requestedEffects.join(", ") || "none",
            readiness: record.readiness.status,
            revision: String(record.revision),
          },
          state: record.readiness.status,
          actions: [
            control("Inspect", { kind: "open-record", recordId: record.id }),
            domainControl("Edit", "edit-run-tool-selection", record.id, record.revision),
          ],
        })),
        actions: [domainControl("Create Run Tool Selection", "create-run-tool-selection", undefined, undefined, "primary")],
      }
  const page: AgentPageSnapshot = {
    ...base("agents-tools", state.product),
    ...(designPanel("agents-tools", state) ? { design: designPanel("agents-tools", state) } : {}),
    kind: "agents-tools",
    actions: [control("Select agent and model", { kind: "select-agent", adapterId: "native-picker", agentId: "native-picker", modelId: "native-picker", settings: {} }, true, "primary")],
    adapters: {
      id: "adapters",
      title: "Installed agent adapters",
      columns: [
        { key: "agent", label: "Agent", identifier: true },
        { key: "runtime", label: "Runtime" },
        { key: "interface", label: "Interface" },
        { key: "maturity", label: "Maturity" },
        { key: "status", label: "Status" },
      ],
      rows,
      actions: [],
      ...(rows.length === 0 ? { emptyState: emptySurface("No agent observation", "No adapter probe completed successfully.", [control("Retry detection", { kind: "retry-provider", adapterId: "native-picker" })]) } : {}),
    },
    ...(state.selection ? {
      selection: {
        agent: state.selection.agentId,
        model: state.selection.modelId,
        modelTruthClass: state.selection.modelTruthClass,
        modelAlias: state.selection.modelAlias === true,
        settings,
        limitationsReviewed: false,
        actions: [control("Change selection", { kind: "select-agent", adapterId: "native-picker", agentId: "native-picker", modelId: "native-picker", settings: {} })],
      },
    } : {}),
    selectedAgent: state.selection ? [
      { term: "Adapter", value: state.selection.adapterId },
      { term: "Agent", value: state.selection.agentId },
      { term: "Model", value: state.selection.modelId },
      { term: "Model truth", value: state.selection.modelTruthClass },
    ] : [],
    limitations,
    handoffs: handoffTable(state),
    contextPacks,
    instructionPrivilegeGrants,
    workflowPlans,
    toolDefinitions,
    runToolSelections,
  }
  const selectedBinding = state.runtimeBinding?.state === "ready" ? state.runtimeBinding.binding : undefined
  const inspector: StudioInspectorSnapshot | undefined = state.selection ? {
    title: "Machine-local runtime inspector",
    recordId: state.selection.adapterId,
    entries: [
      { term: "Binding state", value: state.runtimeBinding?.state ?? "missing" },
      { term: "Resolved executable", value: selectedBinding?.executable.canonicalPath ?? "not bound" },
      { term: "Executable fingerprint", value: selectedBinding?.executable.digest ?? "not bound" },
      { term: "Capability digest", value: state.selection.capabilityDigest },
      { term: "Selected at", value: state.selection.selectedAt },
    ],
    relationships: [],
    actions: [control("Show diagnostics", { kind: "show-diagnostics" })],
  } : undefined
  return { page, inspector }
}

function runPage(state: ObservedStudioState): RunPageSnapshot {
  const unknownRuns = state.runs.filter((run) => run.state === "unknown")
  const eligibility = prepareRunEligibility(state)
  const selectedRun = state.runs.find((run) => run.id === state.selectedRecordId) ?? newestRun(state.runs)
  const recovery = managedRecoveryTable(state)
  const recoveryRows = recovery.rows.filter((row) => row.state !== "no-attention")
  return {
    ...base("runs-evidence", state.product),
    ...(designPanel("runs-evidence", state) ? { design: designPanel("runs-evidence", state) } : {}),
    kind: "runs-evidence",
    actions: [prepareRunControl(eligibility)],
    runs: {
      id: "runs",
      title: "Governed runs",
      columns: [
        { key: "run", label: "Run", identifier: true },
        { key: "initiative", label: "Initiative" },
        { key: "agent", label: "Agent / model" },
        { key: "state", label: "State" },
        { key: "managed", label: "Managed state" },
        { key: "attempts", label: "Attempts" },
        { key: "started", label: "Started" },
        { key: "ended", label: "Ended" },
      ],
      rows: state.runs.map((run) => {
        const managed = managedObservationsForRun(state, run.id)
        const latestManaged = managed.at(-1)
        return {
          id: run.id,
          cells: {
            run: run.id,
            initiative: run.initiativeId,
            agent: boundedDisplay(`${run.agent.agentId} / ${run.agent.modelId}`),
            state: run.state,
            managed: latestManaged?.record.state ?? managedRunTableState(state),
            attempts: latestManaged
              ? `latest attempt ${latestManaged.record.attemptNumber}; ${managed.length} shown`
              : managedObservationUnavailable(state)
                ? "unavailable"
                : state.managedRunTotal > state.managedRuns.length ? "0 shown; older unknown" : "0",
            started: run.startedAt ?? "not started",
            ended: run.endedAt ?? "not ended",
          },
          state: latestManaged?.record.state ?? run.state,
          actions: [
            control("Select", { kind: "select-record", recordId: run.id }),
            ...(run.state === "unknown" ? [control("Inspect diagnostics", { kind: "show-diagnostics" })] : []),
          ],
        }
      }),
      actions: [],
      ...(state.runs.length === 0 ? { emptyState: emptySurface("No runs", "Create an active Initiative, select an executable agent, and resolve a Workflow Plan before preparing a managed run.") } : {}),
    },
    selectedRun: selectedRunEvidenceEntries(state, selectedRun),
    events: managedTimeline(state, selectedRun),
    recovery,
    managedEvidence: managedEvidenceTable(state),
    evidence: evidenceTable(state.evidence),
    handoffs: handoffTable(state),
    recoveryActions: recoveryRows.length > 0 || unknownRuns.length > 0
      ? [control("Show diagnostics", { kind: "show-diagnostics" })]
      : [],
  }
}

function evidenceTable(records: EvidenceRecord[]): StudioTableSnapshot {
  if (records.length === 0) return recordEmpty("evidence", "Evidence", "Create Evidence", "create-evidence")
  return {
    id: "evidence",
    title: "Evidence",
    columns: [
      { key: "subjects", label: "Subjects", identifier: true },
      { key: "origin", label: "Origin" },
      { key: "result", label: "Result" },
      { key: "verification", label: "Verification" },
      { key: "freshness", label: "Freshness" },
      { key: "revision", label: "Revision" },
    ],
    rows: records.map((record) => ({
      id: record.id,
      cells: {
        subjects: record.subjects.map((subject) => `${subject.recordType}:${subject.recordId}@${subject.revision}`).join(", "),
        origin: record.origin.kind,
        result: record.result.status,
        verification: record.verification.status,
        freshness: record.freshness.status,
        revision: String(record.revision),
      },
      state: record.verification.status,
      actions: [
        control("Inspect", { kind: "open-record", recordId: record.id }),
        domainControl("Edit", "edit-evidence", record.id, record.revision),
      ],
    })),
    actions: [domainControl("Create Evidence", "create-evidence", undefined, undefined, "primary")],
  }
}

function portableDesignReviewLabel(record: PortableDesignSnapshot): string {
  return `${record.sourceReview.status} upstream claim; not GAEP approval`
}

function portableDesignImportControl(
  enabled: boolean,
  emphasis: StudioActionControl["emphasis"] = "primary",
): StudioActionControl {
  return control(
    "Import local design bundle",
    { kind: "domain-workflow", workflow: "import-portable-design-snapshot" },
    enabled,
    emphasis,
    enabled ? undefined : "Audit and governed snapshot inventory verification must pass before importing a local design bundle.",
  )
}

function portableDesignSnapshotTable(records: PortableDesignSnapshot[], auditVerified: boolean): StudioTableSnapshot {
  const importAction = portableDesignImportControl(auditVerified)
  return {
    id: "portable-design-snapshots",
    title: "Portable design snapshots",
    columns: [
      { key: "title", label: "Design snapshot", identifier: true },
      { key: "governance", label: "GAEP state" },
      { key: "sourceReview", label: "Upstream source review" },
      { key: "source", label: "Source tool" },
      { key: "artifacts", label: "Validated artifacts" },
      { key: "classification", label: "Classification" },
      { key: "imported", label: "Imported" },
    ],
    rows: records.map((record) => ({
      id: record.bundleId,
      cells: {
        title: record.title,
        governance: record.governance.state,
        sourceReview: portableDesignReviewLabel(record),
        source: record.source.tool,
        artifacts: String(record.artifacts.length),
        classification: record.classification,
        imported: record.evidence.importedAt,
      },
      state: record.governance.state,
      actions: [control("Read verified metadata", { kind: "read-portable-design-snapshot", bundleId: record.bundleId })],
    })),
    actions: [importAction],
    ...(records.length === 0 ? {
      emptyState: emptySurface(
        "No portable design snapshots",
        "Import one local portable design bundle. A validated import remains pending human review and does not create approval or a Design Baseline.",
        [importAction],
      ),
    } : {}),
  }
}

function portableDesignSnapshotInspector(record: PortableDesignSnapshot): StudioInspectorSnapshot {
  return {
    title: "Verified portable design metadata",
    recordId: record.bundleId,
    entries: [
      { term: "Title", value: record.title },
      { term: "Bundle ID", value: record.bundleId },
      { term: "Product ID", value: record.productId },
      ...(record.initiativeId ? [{ term: "Initiative ID", value: record.initiativeId }] : []),
      { term: "GAEP state", value: record.governance.state },
      { term: "Upstream source review", value: portableDesignReviewLabel(record) },
      { term: "Authority boundary", value: "Import validation is not design approval, a Design Baseline, implementation readiness, or release readiness." },
      { term: "Source tool", value: record.source.tool },
      { term: "Classification", value: record.classification },
      { term: "Validated artifacts", value: String(record.artifacts.length) },
      { term: "Normalized design tokens", value: String(record.tokens.length) },
      { term: "Validation checks", value: `${record.evidence.checks.length} bounded checks recorded` },
      { term: "Imported", value: record.evidence.importedAt },
      { term: "Snapshot digest", value: record.snapshotDigest },
      { term: "Evidence digest", value: record.evidence.evidenceDigest },
      { term: "Privacy boundary", value: "Artifact paths, normalized design-token values, local bundle roots, source bytes, external-account state, credentials, and access tokens are not displayed." },
    ],
    relationships: [
      { term: "Bound Product", value: record.productId },
      ...(record.initiativeId ? [{ term: "Bound Initiative", value: record.initiativeId }] : []),
    ],
    actions: [],
  }
}

function readinessPage(state: ObservedStudioState): ReadinessPageSnapshot {
  const sections = sectionsFor(state)
  const gaps: StudioIssue[] = []
  if (!state.designDraft) gaps.push(issue("design-draft-missing", "No governed Product design draft exists.", "blocker"))
  for (const section of state.designReadiness?.sections ?? []) {
    for (const field of section.missingFields) gaps.push(issue(`${section.sectionId}-${field}-missing`, `${studioRouteLabels[section.sectionId]}: ${field} is missing.`, "blocker"))
    for (const field of section.weakFields) gaps.push(issue(`${section.sectionId}-${field}-weak`, `${studioRouteLabels[section.sectionId]}: ${field} is weak.`, "warning"))
  }
  if (!state.selection) gaps.push(issue("agent-selection-missing", "No agent and model selection exists.", "blocker"))
  if (state.initiatives.length === 0) gaps.push(issue("initiative-missing", "No bounded Initiative exists.", "blocker"))
  gaps.push(...state.issues)
  const next = primaryAction(state)
  const health = state.health.map((candidate) => issue(
    `health-${candidate.code}`,
    candidate.message,
    candidate.severity === "error" ? "blocker" : "warning",
  ))
  if (state.healthTotal > state.health.length) {
    health.push(issue(
      "workspace-health-truncated",
      `Workspace health returned ${state.healthTotal} issues; this snapshot shows the first ${state.health.length}. Use diagnostics or narrow the corpus before relying on completeness.`,
      "warning",
    ))
  }
  const designRevisions: StudioTableSnapshot = {
    id: "design-revisions",
    title: "Product design revisions",
    columns: [
      { key: "revision", label: "Revision", identifier: true },
      { key: "productRevision", label: "Product revision" },
      { key: "readiness", label: "Readiness" },
      { key: "actor", label: "Created by" },
      { key: "created", label: "Created" },
    ],
    rows: state.designRevisions.map((record) => ({
      id: record.id,
      cells: {
        revision: String(record.revision),
        productRevision: String(record.productRevision),
        readiness: record.readiness.status,
        actor: record.createdBy.id,
        created: record.createdAt,
      },
      state: record.readiness.status,
      actions: [control("Inspect", { kind: "open-record", recordId: record.id })],
    })),
    actions: [],
    ...(state.designRevisions.length === 0 ? { emptyState: emptySurface("No design revisions", "A local draft is not governed Product history until an explicit design revision is created.") } : {}),
  }
  const productRevisions: StudioTableSnapshot = {
    id: "product-revisions",
    title: "Product revisions",
    columns: [
      { key: "revision", label: "Revision", identifier: true },
      { key: "source", label: "Source" },
      { key: "recorded", label: "Recorded" },
    ],
    rows: state.productRevisions.map((record) => ({
      id: `${record.productId}-r${record.revision}`,
      cells: { revision: String(record.revision), source: record.source.kind, recorded: record.recordedAt },
      actions: [],
    })),
    actions: [],
    ...(state.productRevisions.length === 0 ? { emptyState: emptySurface("No Product revision history", "Initialize or revise Product design to create immutable Product history.") } : {}),
  }
  const portableDesignPage = state.domainPages["portable-design-snapshot"]
  const portableDesignImportEnabled = state.audit?.valid === true && portableDesignPage !== undefined
  const portableDesignSnapshots = portableDesignSnapshotTable(state.portableDesignSnapshots, portableDesignImportEnabled)
  const portableDesignInventory = portableDesignPage
    ? `${portableDesignPage.total} governed record${portableDesignPage.total === 1 ? "" : "s"}; every validated import remains pending human review.`
    : "Unavailable until audit and governed snapshot inventory verification both succeed."
  return {
    ...base("readiness", state.product),
    ...(designPanel("readiness", state) ? { design: designPanel("readiness", state) } : {}),
    kind: "readiness",
    actions: [
      portableDesignImportControl(portableDesignImportEnabled),
      domainControl("Build portable export", "export"),
      domainControl("Preview import", "import-preview"),
      domainControl("Refresh workspace health", "workspace-health"),
    ],
    statement: state.designReadiness
      ? `Design readiness is ${state.designReadiness.status}. This claim is bounded to Product design and is not implementation approval. Workspace-health, trace, Tool Selection, export restriction, and import closure issues remain fail-closed when reported below.`
      : "Design readiness is not assessed. Start or resume the local draft; a draft is not a governed Product revision or implementation approval.",
    sections,
    gaps,
    conflicts: [
      ...(state.audit && !state.audit.valid ? [issue("audit-conflict", "Audit verification conflicts with a healthy governance claim.", "blocker")] : []),
      ...(state.designReadiness?.openConflictIds.map((id) => issue(id, "An open design conflict blocks a complete readiness claim.", "blocker")) ?? []),
    ],
    ...(next ? { nextAction: next } : {}),
    health,
    designRevisions,
    productRevisions,
    portableDesignSnapshots,
    portability: [
      { term: "Export", value: "Portable bundle only; authority, readiness, runtime bindings, credentials, and implementation approval are not conferred." },
      { term: "Product export preview", value: state.importPreview ? `${state.importPreview.status}; preview only; no mutation performed.` : "No Product export preview is loaded; that preview workflow never mutates Product state." },
      { term: "Portable design snapshots", value: portableDesignInventory },
      { term: "Upstream source review", value: "The preserved sourceReview value is an upstream claim. It is not GAEP approval, a Design Baseline, implementation readiness, or release readiness." },
      { term: "Design import privacy", value: "Persistence is limited to engine-validated snapshot metadata and digests. This view omits artifact paths and normalized design-token values; local bundle roots, source bytes, credentials, access tokens, OAuth state, and external-account data are never displayed." },
      { term: "Restricted context", value: "Review engine health and bundle exclusions before treating an export as distributable." },
    ],
  }
}

function pageFor(
  route: StudioRoute,
  state: ObservedStudioState,
): { page: StudioPageSnapshot; inspector?: StudioInspectorSnapshot } {
  switch (route) {
    case "overview": return { page: overviewPage(state) }
    case "direction":
    case "users-jobs":
    case "outcomes":
    case "scope":
    case "architecture": return { page: designForm(route, state) }
    case "delivery": return { page: deliveryPage(state) }
    case "risks-decisions": return { page: risksPage(state) }
    case "trace": return { page: tracePage(state) }
    case "agents-tools": return agentPage(state)
    case "runs-evidence": return { page: runPage(state) }
    case "readiness": return { page: readinessPage(state) }
  }
}

const studioTableRowLimit = 200

function capTable(table: StudioTableSnapshot): StudioTableSnapshot {
  if (table.rows.length <= studioTableRowLimit) return table
  return {
    ...table,
    rows: table.rows.slice(0, studioTableRowLimit),
    truncation: {
      shown: studioTableRowLimit,
      total: table.rows.length,
      message: "This snapshot is deliberately bounded. Use Product-domain search to narrow the corpus.",
    },
  }
}

function capPageTables(page: StudioPageSnapshot): StudioPageSnapshot {
  switch (page.kind) {
    case "overview": return page
    case "record-form": return { ...page, ...(page.relatedRecords ? { relatedRecords: page.relatedRecords.map(capTable) } : {}) }
    case "delivery": return {
      ...page,
      initiatives: capTable(page.initiatives),
      sources: capTable(page.sources),
      sourceBaselines: capTable(page.sourceBaselines),
      sourceProvenance: capTable(page.sourceProvenance),
      changes: capTable(page.changes),
      workItems: capTable(page.workItems),
    }
    case "risks-decisions": return {
      ...page,
      risks: capTable(page.risks),
      recommendations: capTable(page.recommendations),
      decisions: capTable(page.decisions),
      decisionRegisters: capTable(page.decisionRegisters),
      riskRegisters: capTable(page.riskRegisters),
      evidenceRegistries: capTable(page.evidenceRegistries),
    }
    case "trace": return {
      ...page,
      relationships: capTable(page.relationships),
      traceabilityGraphs: capTable(page.traceabilityGraphs),
      readinessGates: capTable(page.readinessGates),
      p5Handoffs: capTable(page.p5Handoffs),
      searchResults: capTable(page.searchResults),
    }
    case "agents-tools": return {
      ...page,
      adapters: capTable(page.adapters),
      handoffs: capTable(page.handoffs),
      contextPacks: capTable(page.contextPacks),
      instructionPrivilegeGrants: capTable(page.instructionPrivilegeGrants),
      workflowPlans: capTable(page.workflowPlans),
      toolDefinitions: capTable(page.toolDefinitions),
      runToolSelections: capTable(page.runToolSelections),
    }
    case "runs-evidence": return {
      ...page,
      runs: capTable(page.runs),
      recovery: capTable(page.recovery),
      managedEvidence: capTable(page.managedEvidence),
      evidence: capTable(page.evidence),
      handoffs: capTable(page.handoffs),
    }
    case "readiness": return {
      ...page,
      designRevisions: capTable(page.designRevisions),
      productRevisions: capTable(page.productRevisions),
      portableDesignSnapshots: capTable(page.portableDesignSnapshots),
    }
  }
}

function pagedTable(
  table: StudioTableSnapshot,
  kind: StudioDomainPageKind,
  metadata: ProductStudioPageMetadata | undefined,
): StudioTableSnapshot {
  if (!metadata) return table
  const hasPrevious = metadata.offset > 0
  const hasNext = metadata.hasMore && metadata.offset + metadata.limit <= 1_000_000
  return {
    ...table,
    actions: [
      ...table.actions,
      control(
        `Previous ${table.title} page`,
        { kind: "domain-page", recordKind: kind, offset: Math.max(0, metadata.offset - metadata.limit), limit: metadata.limit },
        hasPrevious,
        "secondary",
        hasPrevious ? undefined : "This is the first page.",
      ),
      control(
        `Next ${table.title} page`,
        { kind: "domain-page", recordKind: kind, offset: Math.min(1_000_000, metadata.offset + metadata.limit), limit: metadata.limit },
        hasNext,
        "secondary",
        hasNext ? undefined : "This is the last page.",
      ),
    ],
    pagination: {
      offset: metadata.offset,
      limit: metadata.limit,
      total: metadata.total,
      hasPrevious,
      hasNext,
    },
  }
}

function addDomainPagination(page: StudioPageSnapshot, state: ObservedStudioState): StudioPageSnapshot {
  const pageTable = (table: StudioTableSnapshot, kind: StudioDomainPageKind) => pagedTable(table, kind, state.domainPages[kind])
  switch (page.kind) {
    case "overview": return page
    case "record-form": return {
      ...page,
      ...(page.relatedRecords ? {
        relatedRecords: page.relatedRecords.map((table) => {
          if (table.id === "requirements") return pageTable(table, "requirement")
          if (table.id === "architecture") return pageTable(table, "architecture-record")
          return table
        }),
      } : {}),
    }
    case "delivery": return {
      ...page,
      changes: pageTable(page.changes, "change"),
      workItems: pageTable(page.workItems, "work-item"),
    }
    case "risks-decisions": return {
      ...page,
      risks: pageTable(page.risks, "risk"),
      decisions: pageTable(page.decisions, "decision"),
    }
    case "trace": return { ...page, relationships: pageTable(page.relationships, "trace-link") }
    case "agents-tools": return {
      ...page,
      contextPacks: pageTable(page.contextPacks, "context-pack"),
      instructionPrivilegeGrants: pageTable(page.instructionPrivilegeGrants, "instruction-privilege-grant"),
      workflowPlans: pageTable(page.workflowPlans, "workflow-plan"),
      toolDefinitions: pageTable(page.toolDefinitions, "tool-definition"),
      runToolSelections: pageTable(page.runToolSelections, "run-tool-selection"),
    }
    case "runs-evidence": return { ...page, evidence: pageTable(page.evidence, "evidence") }
    case "readiness": return {
      ...page,
      designRevisions: pageTable(page.designRevisions, "product-design-revision"),
      productRevisions: pageTable(page.productRevisions, "product-revision"),
      portableDesignSnapshots: pageTable(page.portableDesignSnapshots, "portable-design-snapshot"),
    }
  }
}

function inspectorFor(state: ObservedStudioState, recordId: string): StudioInspectorSnapshot | undefined {
  const typedRecords: Array<{ type: string; value: Record<string, unknown> }> = [
    ...state.changes.map((value) => ({ type: "change", value })),
    ...state.workItems.map((value) => ({ type: "work-item", value })),
    ...state.requirements.map((value) => ({ type: "requirement", value })),
    ...state.decisions.map((value) => ({ type: "decision", value })),
    ...state.risks.map((value) => ({ type: "risk", value })),
    ...state.architecture.map((value) => ({ type: "architecture", value })),
    ...state.evidence.map((value) => ({ type: "evidence", value })),
    ...state.contextPacks.map((value) => ({ type: "context-pack", value })),
    ...state.instructionPrivilegeGrants.map((value) => ({ type: "instruction-privilege-grant", value })),
    ...state.workflowPlans.map((value) => ({ type: "workflow-plan", value })),
    ...state.toolDefinitions.map((value) => ({ type: "tool-definition", value })),
    ...state.runToolSelections.map((value) => ({ type: "run-tool-selection", value })),
    ...state.traceLinks.map((value) => ({ type: "trace-link", value })),
    ...state.designRevisions.map((value) => ({ type: "design-revision", value })),
  ]
  const match = typedRecords.find((candidate) => candidate.value.id === recordId)
  if (!match) return undefined
  const value = match.value
  const entries: StudioDefinitionEntry[] = [
    { term: "Record type", value: match.type },
    ...(typeof value.revision === "number" ? [{ term: "Revision", value: String(value.revision) }] : []),
    ...(typeof value.state === "string" ? [{ term: "State", value: value.state }] : []),
    ...(typeof value.title === "string" ? [{ term: "Title", value: value.title }] : []),
    ...(typeof value.key === "string" ? [{ term: "Key", value: value.key }] : []),
    ...(typeof value.updatedAt === "string" ? [{ term: "Updated", value: value.updatedAt }] : []),
    ...(typeof value.createdAt === "string" ? [{ term: "Created", value: value.createdAt }] : []),
    ...(typeof value.productId === "string" ? [{ term: "Product", value: value.productId }] : []),
  ]
  if (match.type === "instruction-privilege-grant") {
    const grant = value as InstructionPrivilegeGrant
    const sourceValue = grant.source.kind === "workspace-relative"
      ? grant.source.path
      : grant.source.kind === "external-uri"
        ? grant.source.uri
        : grant.source.value
    const joinedScope = grant.scope.join(" · ")
    const scopeSummary = joinedScope.length <= 18_000
      ? `${grant.scope.length} entries · ${joinedScope}`
      : `${grant.scope.length} entries · ${joinedScope.slice(0, 18_000)}… [scope display truncated; inspect the governed record for the exact remainder]`
    entries.push(
      { term: "Source", value: `${grant.source.kind}:${sourceValue}` },
      { term: "Source digest", value: grant.sourceDigest },
      { term: "Privilege", value: grant.privilege },
      { term: "Purpose", value: grant.purpose },
      { term: "Recipient", value: `${grant.recipient.kind}:${grant.recipient.id}` },
      { term: "Scope summary", value: scopeSummary },
      { term: "Authority", value: `${grant.authority.recordType}:${grant.authority.recordId}@${grant.authority.revision} · ${grant.authority.digest}` },
      { term: "Accepted by", value: `${grant.acceptedBy.kind}:${grant.acceptedBy.id}` },
      { term: "Accepted at", value: grant.acceptedAt },
      { term: "Expires at", value: grant.expiresAt ?? "No expiry recorded" },
      { term: "Authority boundary", value: grant.authorityBoundary },
      ...(grant.revocationReason ? [{ term: "Revocation reason", value: grant.revocationReason }] : []),
    )
  }
  const relationships = state.traceLinks.flatMap((link): StudioDefinitionEntry[] => {
    if (link.source.recordId === recordId) return [{ term: link.relationship, value: `${link.target.recordType}:${link.target.recordId}`, recordId: link.id }]
    if (link.target.recordId === recordId) return [{ term: `incoming ${link.relationship}`, value: `${link.source.recordType}:${link.source.recordId}`, recordId: link.id }]
    return []
  })
  const endpoint = state.traceLinks.flatMap((link) => [link.source, link.target]).find((candidate) => candidate.recordId === recordId)
  return {
    title: "Portable record inspector",
    recordId,
    entries,
    relationships,
    actions: match.type === "trace-link"
      ? []
      : [control(
          "Analyze trace impact",
          {
            kind: "analyze-impact",
            recordId,
            recordType: endpoint?.recordType ?? match.type,
            ...(endpoint?.revision ? { revision: endpoint.revision } : {}),
            ...(endpoint?.digest ? { digest: endpoint.digest } : {}),
          },
          Boolean(endpoint),
          "secondary",
          endpoint ? undefined : "No exact persisted trace endpoint with revision and digest is available for this record.",
        )],
  }
}

function surfaceFor(route: StudioRoute, context: CurrentEngineStudioContext, state: ObservedStudioState): StudioSurfaceState {
  if (!context.trusted()) {
    return {
      kind: "blocked",
      title: "Workspace trust required",
      detail: "GAEP will not inspect Product state, probe executables, or start a provider in an untrusted workspace.",
      issues: [issue("workspace-untrusted", "Workspace trust is the current stop line.", "blocker")],
      actions: [control("Manage Workspace Trust", { kind: "manage-workspace-trust" }, true, "primary")],
    }
  }
  if (!context.workspace()) {
    return {
      kind: "uninitialized",
      title: "Select a Product root",
      detail: "Choose which workspace folder owns GAEP Product state.",
      issues: [],
      actions: [control("Select Product Root", { kind: "select-product-root" }, true, "primary")],
    }
  }
  if (!context.engine()) {
    return { kind: "loading", title: "Loading Product context", detail: "The selected root is being configured.", issues: [], actions: [] }
  }
  if (context.recoveryDiagnostic()) {
    return {
      kind: "blocked",
      title: "Recovery is blocked",
      detail: "Resolve the diagnostic before changing Product state or starting a provider.",
      issues: [issue("recovery-blocked", "Interrupted-run recovery did not complete.", "blocker")],
      actions: [control("Retry Recovery", { kind: "retry-recovery" }, true, "primary"), control("Show Diagnostics", { kind: "show-diagnostics" })],
    }
  }
  if (state.productState === "absent") {
    return {
      kind: "uninitialized",
      title: "Initialize this Product",
      detail: "No .gaep state exists in the selected root.",
      issues: [],
      actions: [control("Initialize Product", { kind: "initialize-product" }, true, "primary")],
    }
  }
  if (state.productState === "invalid") {
    return {
      kind: "invalid",
      title: "Product state needs repair",
      detail: "Existing GAEP state could not be read safely. Initialization remains disabled to preserve it.",
      issues: [issue("product-invalid", "Review GAEP diagnostics for the local validation failure.", "blocker")],
      actions: [control("Show Diagnostics", { kind: "show-diagnostics" }, true, "primary")],
    }
  }
  return {
    kind: "ready",
    title: `${studioRouteLabels[route]} loaded`,
    issues: state.issues,
    actions: [],
    lastVerifiedState: state.audit ? `${state.audit.valid ? "Valid" : "Invalid"} audit chain · ${state.audit.events} events` : "Audit not assessed",
    knownEffects: route === "agents-tools"
      ? [
          "This snapshot reads local GAEP state.",
          "It invokes configured agent executables for bounded version and model-catalog discovery; it does not start a governed provider run.",
        ]
      : ["This snapshot reads local GAEP state only."],
    unknownEffects: state.health.length > 0
      ? ["Engine health reports unresolved Product-domain issues. Review Readiness before relying on completeness claims."]
      : [],
  }
}

function commandFor(action: StudioAction): { command: ExistingStudioCommand; args: unknown[]; announcement: string } | undefined {
  switch (action.kind) {
    case "initialize-product": return { command: "gaep.initializeProduct", args: [], announcement: "Opened the native Product initialization workflow." }
    case "select-product-root": return { command: "gaep.selectWorkspaceRoot", args: [], announcement: "Opened the native Product-root picker." }
    case "create-initiative": return { command: "gaep.createInitiative", args: [], announcement: "Opened the native Initiative workflow." }
    case "classify-initiative": return {
      command: "gaep.classifyInitiative",
      args: [action.initiativeId, action.expectedRevision],
      announcement: "Completed the exact native Initiative classification workflow; classification grants no approval or action authority.",
    }
    case "resolve-initiative-applicability": return {
      command: "gaep.resolveInitiativeApplicability",
      args: [action.initiativeId, action.expectedRevision],
      announcement: "Completed the exact native Initiative applicability workflow; the matrix grants no approval, readiness, or action authority.",
    }
    case "prepare-run": return { command: "gaep.prepareRun", args: [], announcement: "Opened the native governed-run workflow." }
    case "verify-audit": return { command: "gaep.verifyAudit", args: [], announcement: "Audit verification completed in the extension host." }
    case "show-diagnostics": return { command: "gaep.showDiagnostics", args: [], announcement: "Opened GAEP diagnostics." }
    case "manage-workspace-trust": return { command: "gaep.manageWorkspaceTrust", args: [], announcement: "Opened Workspace Trust management." }
    case "retry-recovery": return { command: "gaep.retryRecovery", args: [], announcement: "Opened the native recovery workflow." }
    case "open-managed-discard": return {
      command: "gaep.reviewManagedRun",
      args: [action.managedRunId, "discard-only", action.expectedRevision],
      announcement: "Opened the native exact discard review. No discard or cleanup result is claimed until persisted state is reread.",
    }
    case "select-agent":
    case "retry-provider":
    case "begin-handoff": return { command: "gaep.selectAgent", args: [], announcement: "Opened the native agent and model workflow." }
    case "transition-record":
      return action.recordType === "initiative"
        ? { command: "gaep.changeInitiativeState", args: [action.recordId], announcement: "Opened the native Initiative transition workflow." }
        : undefined
    case "domain-workflow":
      return {
        command: "gaep.productStudio.domainWorkflow",
        args: [action],
        announcement: `Completed ${action.workflow.replaceAll("-", " ")} workflow.`,
      }
    case "export-product":
      return {
        command: "gaep.productStudio.domainWorkflow",
        args: [{ kind: "domain-workflow", workflow: "export", expectedRevision: action.sourceRevision }],
        announcement: "Built and saved a portable Product export bundle.",
      }
    case "import-product-preview":
      return {
        command: "gaep.productStudio.domainWorkflow",
        args: [{ kind: "domain-workflow", workflow: "import-preview" }],
        announcement: "Import preview completed without mutation.",
      }
    default: return undefined
  }
}

export class CurrentEngineStudioDataSource implements StudioDataSource {
  private revision = 0
  private offeredProductRevision?: number
  private pageContextGeneration?: string
  private readonly domainPageOffsets = new Map<StudioDomainPageKind, number>()
  private readonly domainPageLimits = new Map<StudioDomainPageKind, number>()
  private readonly domainPageLimit = 50
  private selectedRecordId?: string
  private searchResults: ProductDomainSearchResult[] = []
  private searchResultTotal = 0
  private impact?: TraceImpact
  private changeImpactSelection?: ChangeImpactDashboardRequest
  private importPreview?: ProductImportPreview
  private portableDesignInspectorId?: string

  constructor(private readonly context: CurrentEngineStudioContext) {}

  async readSnapshot(route: StudioRoute, signal?: AbortSignal): Promise<StudioSnapshot> {
    signal?.throwIfAborted()
    const contextGeneration = this.context.contextGeneration()
    if (this.pageContextGeneration !== contextGeneration) {
      this.pageContextGeneration = contextGeneration
      this.domainPageOffsets.clear()
      this.domainPageLimits.clear()
      this.selectedRecordId = undefined
      this.searchResults = []
      this.searchResultTotal = 0
      this.impact = undefined
      this.changeImpactSelection = undefined
      this.importPreview = undefined
      this.portableDesignInspectorId = undefined
    }
    const observed = await this.observe(route)
    let changeImpact: ChangeImpactDashboard | undefined
    let agentModel: AgentModelDashboard | undefined
    let phase1AgentModel: Phase1AgentModelDashboard | undefined
    if (route === "delivery" && this.changeImpactSelection) {
      try {
        changeImpact = await this.readChangeImpactDashboard(this.changeImpactSelection)
      } catch (error) {
        this.context.logDiagnostic("Product Studio exact Change/Impact dashboard observation failed; private source detail was withheld", error)
        observed.issues.push(issue(
          "change-impact-unavailable",
          "The selected Change/Impact dashboard could not be revalidated against the current Product, audit, records, and trace assessment. Select the current Change again.",
          "warning",
        ))
      }
    }
    if (route === "agents-tools") {
      try {
        agentModel = this.composeAgentModelDashboard(observed)
      } catch (error) {
        this.context.logDiagnostic("Product Studio exact Agent/Model dashboard observation failed; private source detail was withheld", error)
        observed.issues.push(issue(
          "agent-model-unavailable",
          "The Agent/Model dashboard could not be revalidated against the current Product, audit, capability, selection, Run, handoff, and Managed Run evidence snapshots.",
          "warning",
        ))
      }
      const initiative = currentInitiative(observed.initiatives)
      if (initiative) {
        try {
          phase1AgentModel = this.composePhase1AgentModelDashboard(observed, initiative)
        } catch (error) {
          this.context.logDiagnostic("Product Studio exact Phase 1 Agent/Model dashboard observation failed; private source detail was withheld", error)
          observed.issues.push(issue(
            "phase-1-agent-model-unavailable",
            "The Phase 1 Agent/Model view could not be revalidated against the exact current Product, Initiative, capability, selection, Run, handoff, and Managed Run evidence snapshots.",
            "warning",
          ))
        }
      }
    }
    signal?.throwIfAborted()
    if (contextGeneration !== this.context.contextGeneration()) {
      throw new Error("Product Studio context changed while the snapshot was being read")
    }
    const workspace = this.context.workspace()
    const pageResult = pageFor(route, observed)
    const page = { ...pageResult, page: addDomainPagination(capPageTables(pageResult.page), observed) }
    const selectedInspector = route === "readiness" && observed.domainPages["portable-design-snapshot"] &&
      observed.selectedPortableDesignSnapshot
      ? portableDesignSnapshotInspector(observed.selectedPortableDesignSnapshot)
      : this.selectedRecordId ? inspectorFor(observed, this.selectedRecordId) : undefined
    const sections = sectionsFor(observed)
    const deliveryPhase = this.context.deliveryPhase()
    const dashboard: PhaseDashboardFramework | undefined = observed.product
      ? composePhaseDashboardFramework(observed.product, {
          phase: deliveryPhase,
          expectedProductId: observed.product.id,
          expectedProductRevision: observed.product.revision ?? 1,
          expectedProductDigest: canonicalDigest(observed.product),
        })
      : undefined
    let phase1Summary: Phase1SummaryDashboard | undefined
    let phase1ChangeImpact: Phase1ChangeImpactDashboard | undefined
    if (observed.product) {
      const initiative = currentInitiative(observed.initiatives)
      const readiness = initiative ? observed.p0P4ReadinessGateProjections.get(initiative.id) : undefined
      const handoff = initiative ? observed.p5HandoffPackageProjections.get(initiative.id) : undefined
      if (initiative && readiness && handoff) {
        try {
          phase1Summary = composePhase1SummaryDashboard(
            observed.product,
            initiative,
            readiness,
            handoff,
            {
              expectedProductId: observed.product.id,
              expectedProductRevision: observed.product.revision ?? 1,
              expectedProductDigest: canonicalDigest(observed.product),
              expectedInitiativeId: initiative.id,
              expectedInitiativeRevision: initiative.revision ?? 1,
              expectedInitiativeDigest: canonicalDigest(initiative),
            },
          )
        } catch (error) {
          this.context.logDiagnostic("Product Studio exact Phase 1 summary composition failed; stale or private detail was withheld", error)
          observed.issues.push(issue(
            "phase-1-summary-unavailable",
            "The Phase 1 summary could not be revalidated against the exact current Product, Initiative, readiness, and handoff projections.",
            "warning",
          ))
        }
      }
    }
    if (route === "delivery" && observed.product && changeImpact) {
      const initiative = currentInitiative(observed.initiatives)
      const change = observed.changes.find((record) => record.id === changeImpact.change.recordId)
      const readiness = initiative ? observed.p0P4ReadinessGateProjections.get(initiative.id) : undefined
      const handoff = initiative ? observed.p5HandoffPackageProjections.get(initiative.id) : undefined
      const engine = this.context.engine()
      if (initiative && change && change.initiativeId === initiative.id && readiness && handoff &&
          engine?.p0P4ReadinessGate?.readCurrent && engine.p5HandoffPackage?.readCurrent) {
        try {
          const [readinessGate, handoffPackage] = await Promise.all([
            engine.p0P4ReadinessGate.readCurrent(initiative.id),
            engine.p5HandoffPackage.readCurrent(initiative.id),
          ])
          phase1ChangeImpact = composePhase1ChangeImpactDashboard({
            product: observed.product,
            initiative,
            change,
            changeImpact,
            readiness,
            ...(readinessGate ? { readinessGate } : {}),
            handoff,
            ...(handoffPackage ? { handoffPackage } : {}),
          }, {
            expectedProductId: observed.product.id,
            expectedProductRevision: observed.product.revision ?? 1,
            expectedProductDigest: canonicalDigest(observed.product),
            expectedInitiativeId: initiative.id,
            expectedInitiativeRevision: initiative.revision ?? 1,
            expectedInitiativeDigest: canonicalDigest(initiative),
            expectedChangeId: change.id,
            expectedChangeRevision: change.revision,
            expectedChangeDigest: canonicalDigest(change),
          })
        } catch (error) {
          this.context.logDiagnostic("Product Studio exact Phase 1 Change/Impact composition failed; stale or private detail was withheld", error)
          observed.issues.push(issue(
            "phase-1-change-impact-unavailable",
            "The Phase 1 Change/Impact view could not be revalidated against the exact current Product, Initiative, Change, readiness, handoff, and bounded trace projections.",
            "warning",
          ))
        }
      }
    }
    this.offeredProductRevision = observed.product?.revision ?? (observed.product ? 1 : undefined)
    return {
      protocolVersion: studioProtocolVersion,
      contextGeneration,
      snapshotRevision: ++this.revision,
      route,
      workspace: {
        label: workspace?.name ?? "No Product root selected",
        trusted: this.context.trusted(),
        connectivity: observed.runs.some((run) => run.state === "running") ? "online" : "provider-absent",
        health: observed.productState === "available" ? (observed.audit?.valid === false ? "audit invalid" : "local state loaded") : observed.productState,
      },
      navigation: sections,
      surface: surfaceFor(route, this.context, observed),
      ...(dashboard ? { dashboard } : {}),
      ...(phase1Summary ? { phase1Summary } : {}),
      ...(phase1ChangeImpact ? { phase1ChangeImpact } : {}),
      ...(changeImpact ? { changeImpact } : {}),
      ...(agentModel ? { agentModel } : {}),
      ...(phase1AgentModel ? { phase1AgentModel } : {}),
      page: page.page,
      ...(selectedInspector ?? page.inspector ? { inspector: selectedInspector ?? page.inspector } : {}),
      footer: {
        draftState: observed.designDraft
          ? (designPanel(route, observed)?.materialChange ? "revision-ready" : "clean")
          : "clean",
        ...(observed.product?.revision ? { sourceRevision: observed.product.revision } : {}),
        validationSummary: observed.designReadiness
          ? `Design readiness ${observed.designReadiness.status}; not implementation approval.`
          : "Design readiness not assessed.",
      },
    }
  }

  async execute(action: StudioAction, request: StudioRequestContext): Promise<StudioActionResult> {
    request.signal?.throwIfAborted()
    if (request.expectedContextGeneration !== this.context.contextGeneration()) {
      return { status: "rejected", announcement: "The Product root or trust context changed since this action was offered. Review the refreshed state and try again." }
    }
    if (request.expectedSnapshotRevision !== this.revision) {
      return { status: "rejected", announcement: "Product Studio changed since this action was offered. Review the refreshed state and try again." }
    }
    if (action.kind === "navigate") return { status: "accepted", announcement: `Opened ${studioRouteLabels[action.route]}.` }
    if (!this.context.trusted() && action.kind !== "manage-workspace-trust") {
      return { status: "rejected", announcement: "Workspace trust changed or is absent. No Product state was inspected or changed." }
    }
    if (!this.context.workspace() && action.kind !== "select-product-root") {
      return { status: "rejected", announcement: "No Product root is selected. No Product state was inspected or changed." }
    }
    if (this.context.recoveryDiagnostic() && !["retry-recovery", "show-diagnostics"].includes(action.kind)) {
      return { status: "rejected", announcement: "Interrupted-run recovery is blocked. Resolve diagnostics before Product-domain operations." }
    }
    const engine = this.context.engine()
    const studio = engine?.productStudio
    if (action.kind === "domain-page") {
      if (!studio) return { status: "rejected", announcement: "The Product-domain service is unavailable. The page did not change." }
      if (!Number.isInteger(action.offset) || action.offset < 0 || action.offset > 1_000_000 ||
        !Number.isInteger(action.limit) || action.limit < 1 || action.limit > 200) {
        return { status: "rejected", announcement: "The requested Product-domain page is outside the bounded paging contract." }
      }
      if (action.recordKind === "portable-design-snapshot" && action.offset > 10_000) {
        return { status: "rejected", announcement: "The requested portable design snapshot page is outside its 10,000-record safety bound." }
      }
      this.domainPageOffsets.set(action.recordKind, action.offset)
      this.domainPageLimits.set(action.recordKind, action.limit)
      return { status: "accepted", announcement: `Loaded the requested ${action.recordKind.replaceAll("-", " ")} page.` }
    }
    if (action.kind === "show-change-impact") {
      if (!engine || !studio) {
        return { status: "rejected", announcement: "The Product-domain service is unavailable. No Change/Impact dashboard was opened." }
      }
      const selection: ChangeImpactDashboardRequest = {
        expectedProductId: action.expectedProductId,
        expectedProductRevision: action.expectedProductRevision,
        expectedProductDigest: action.expectedProductDigest,
        expectedChangeId: action.expectedChangeId,
        expectedChangeRevision: action.expectedChangeRevision,
        expectedChangeDigest: action.expectedChangeDigest,
      }
      try {
        const dashboard = await this.readChangeImpactDashboard(selection)
        request.signal?.throwIfAborted()
        if (request.expectedContextGeneration !== this.context.contextGeneration()) {
          return { status: "rejected", announcement: "The Product root or trust context changed while impact was assessed. No dashboard was opened." }
        }
        this.changeImpactSelection = selection
        return {
          status: "accepted",
          announcement: `Opened the exact Change/Impact dashboard at Change revision ${dashboard.change.revision}. Approval remains not established.`,
        }
      } catch (error) {
        this.context.logDiagnostic("Product Studio rejected an exact Change/Impact dashboard request; private source detail was withheld", error)
        return {
          status: "rejected",
          announcement: "The Product, Change, audit, or impact evidence changed or could not be verified. Refresh Delivery and select the current Change again.",
        }
      }
    }
    if (action.kind === "read-portable-design-snapshot") {
      if (!studio) return { status: "rejected", announcement: "The Product design snapshot service is unavailable. No metadata was opened." }
      let record: PortableDesignSnapshot
      try {
        record = await studio.readPortableDesignSnapshot(action.bundleId)
      } catch {
        this.context.logDiagnostic("Product Studio portable-design-snapshot exact read failed; local source details were withheld")
        return {
          status: "rejected",
          announcement: "GAEP could not verify this portable design snapshot against the current audit and Product binding. No metadata was opened.",
        }
      }
      request.signal?.throwIfAborted()
      if (record.bundleId.toLowerCase() !== action.bundleId.toLowerCase() ||
        record.governance.state !== "pending-human-review" ||
        record.governance.claimBoundary !== "import-validation-is-not-design-approval-or-baseline") {
        this.context.logDiagnostic("Product Studio portable-design-snapshot exact read returned an invalid identity or governance boundary")
        return {
          status: "rejected",
          announcement: "GAEP withheld this portable design snapshot because its identity or governance boundary was invalid.",
        }
      }
      this.portableDesignInspectorId = record.bundleId
      return {
        status: "accepted",
        announcement: "Opened verified privacy-safe portable design metadata. The snapshot remains pending human review.",
      }
    }
    if (action.kind === "start-design-draft") {
      if (!studio) return { status: "rejected", announcement: "The Product design service is unavailable. No state was changed." }
      await studio.startOrResumeDesignDraft(action.expectedProductRevision)
      return { status: "accepted", announcement: "Started or resumed the local governed Product design draft." }
    }
    if (action.kind === "save-draft") {
      if (!studio || !action.draftId || !action.draftRevision || !action.baseRevision) {
        return { status: "rejected", announcement: "The exact draft and Product revisions are required. Refresh Product Studio before saving." }
      }
      if (containsSecretShapedValue(action.values)) {
        return { status: "rejected", announcement: "The design draft contains a secret-shaped value. It was not persisted." }
      }
      const product = await engine.readProduct()
      const draft = await studio.readDesignDraft(product.id)
      if (draft.id !== action.draftId || draft.revision !== action.draftRevision || draft.baseProductRevision !== action.baseRevision) {
        return { status: "rejected", announcement: "The design draft changed since this section was opened. Refresh before merging your edits." }
      }
      const section = draft.sections[action.route]
      const actor = this.context.actorId()
      const updatedSection = {
        ...section,
        fields: section.fields.map((field) => {
          const value = action.values[field.key] ?? field.value
          const populated = typeof value === "string" ? value.trim().length > 0 : value.some((entry) => entry.trim().length > 0)
          const state = action.states?.[field.key] ?? (populated ? "complete" : "missing")
          const deferredReason = action.deferredReasons?.[field.key]?.trim()
          const revisitTrigger = action.revisitTriggers?.[field.key]?.trim()
          return {
            ...field,
            value,
            state,
            provenance: [...new Set([...field.provenance, `human:${actor}`])],
            ...(state === "deferred" && deferredReason ? { deferredReason } : { deferredReason: undefined }),
            ...(state === "deferred" && revisitTrigger ? { revisitTrigger } : { revisitTrigger: undefined }),
          }
        }),
        updatedAt: new Date().toISOString(),
      }
      await studio.saveDesignDraft({
        draftId: draft.id,
        sections: { ...draft.sections, [action.route]: updatedSection },
        expectedDraftRevision: action.draftRevision,
        expectedProductRevision: action.baseRevision,
      })
      return { status: "accepted", announcement: `Saved ${studioRouteLabels[action.route]} into local draft revision ${action.draftRevision + 1}.` }
    }
    if (action.kind === "validate-section") {
      if (!studio || !action.draftId) return { status: "rejected", announcement: "No exact Product design draft is available to evaluate." }
      const product = await engine.readProduct()
      const draft = await studio.readDesignDraft(product.id)
      if (draft.id !== action.draftId) return { status: "rejected", announcement: "The design draft identity changed. Refresh before evaluating readiness." }
      const report = studio.evaluateDesignReadiness(draft)
      const section = report.sections.find((candidate) => candidate.sectionId === action.route)
      return {
        status: "accepted",
        announcement: `${studioRouteLabels[action.route]} is ${section?.state ?? "not assessed"}; overall design readiness is ${report.status}. This is not implementation approval.`,
      }
    }
    if (action.kind === "create-revision") {
      if (!studio || !action.draftRevision || !action.baseRevision) {
        return { status: "rejected", announcement: "Exact draft and Product revisions are required before creating governed history." }
      }
      const created = await studio.createDesignRevision({
        draftId: action.draftId,
        expectedDraftRevision: action.draftRevision,
        expectedProductRevision: action.baseRevision,
      }, this.context.actorId())
      return {
        status: "accepted",
        announcement: `Created Product design revision ${created.revision.revision} and Product revision ${created.product.revision}.`,
      }
    }
    if (action.kind === "open-record" || action.kind === "select-record") {
      this.selectedRecordId = action.recordId
      return { status: "accepted", announcement: "Opened the portable record and provenance inspector." }
    }
    if (action.kind === "analyze-impact") {
      if (!studio || !action.recordType) return { status: "rejected", announcement: "Impact analysis requires an explicit record type and identifier." }
      this.impact = await studio.impactAnalysis({
        recordType: action.recordType as TraceImpact["subject"]["recordType"],
        recordId: action.recordId,
        ...(action.revision ? { revision: action.revision } : {}),
        ...(action.digest ? { digest: action.digest } : {}),
      })
      return { status: "accepted", announcement: "Reassessed persisted upstream, downstream, evidence, decision, risk, unresolved, and stale trace links." }
    }
    const mappedAction: StudioAction = action.kind === "domain-workflow"
      ? {
          ...action,
          expectedContextGeneration: request.expectedContextGeneration,
          ...(this.offeredProductRevision ? { expectedProductRevision: this.offeredProductRevision } : {}),
        }
      : action
    const mapped = commandFor(mappedAction)
    if (!mapped) {
      return { status: "rejected", announcement: "This Product-domain operation is not available in the current engine. No state was changed." }
    }
    request.signal?.throwIfAborted()
    const result = await this.context.executeCommand(request.expectedContextGeneration, mapped.command, ...mapped.args)
    if (request.expectedContextGeneration !== this.context.contextGeneration()) {
      return { status: "rejected", announcement: "The Product root or trust context changed while the native workflow was open. Review the current Product before continuing." }
    }
    if (action.kind === "domain-workflow" && result === undefined) {
      return { status: "rejected", announcement: "The native Product-domain workflow was cancelled. No state was changed." }
    }
    if (action.kind === "domain-workflow" && action.workflow === "search" && result && typeof result === "object") {
      const bounded = result as { results?: unknown; total?: unknown }
      if (Array.isArray(bounded.results) && typeof bounded.total === "number") {
        this.searchResultTotal = bounded.total
        this.searchResults = (bounded.results as ProductDomainSearchResult[]).slice(0, studioTableRowLimit)
      }
    }
    if ((action.kind === "domain-workflow" && action.workflow === "import-preview") || action.kind === "import-product-preview") {
      if (result && typeof result === "object") this.importPreview = result as ProductImportPreview
    }
    return { status: "accepted", announcement: mapped.announcement }
  }

  private async readChangeImpactDashboard(selection: ChangeImpactDashboardRequest): Promise<ChangeImpactDashboard> {
    const engine = this.context.engine()
    const studio = engine?.productStudio
    if (!engine || !studio) throw new Error("The Product-domain service is unavailable")
    const audit = await engine.repository.verifyAudit()
    if (!audit.valid) throw new Error("The audit chain is invalid or unavailable")
    const product = await engine.readProduct()
    if (
      selection.expectedProductId.toLowerCase() !== product.id.toLowerCase()
      || selection.expectedProductRevision !== (product.revision ?? 1)
      || selection.expectedProductDigest !== canonicalDigest(product)
    ) throw new Error("The Product changed before Change/Impact composition")
    const change = await studio.readChange(selection.expectedChangeId)
    const changeDigest = canonicalDigest(change)
    if (
      selection.expectedChangeRevision !== change.revision
      || selection.expectedChangeDigest !== changeDigest
    ) throw new Error("The Change changed before Change/Impact composition")
    const [workItems, traceImpact, decisions, risks] = await Promise.all([
      studio.listWorkItems(),
      studio.impactAnalysis({
        recordType: "change",
        recordId: change.id,
        revision: change.revision,
        digest: changeDigest,
      }),
      studio.listDecisions(),
      studio.listRisks(),
    ])
    return composeChangeImpactDashboard(
      { product, change, workItems, traceImpact, decisions, risks },
      selection,
    )
  }

  private composeAgentModelDashboard(observed: ObservedStudioState): AgentModelDashboard {
    if (!observed.product || observed.audit?.valid !== true || !observed.selectionState ||
        observed.agents.length === 0 || !observed.runsObserved || !observed.handoffsObserved ||
        !observed.managedRunsObserved) {
      throw new Error("The exact Agent/Model dashboard source set is incomplete")
    }
    const request = this.agentModelDashboardRequest(observed)
    const managedRuns = observed.managedRuns.map(({ record, result, evidence, issue: observationIssue }) => {
      if (observationIssue) throw new Error("A Managed Run evidence observation is incomplete")
      return { record, ...(result ? { result } : {}), ...(evidence ? { evidence } : {}) }
    })
    return composeAgentModelDashboard({
      product: observed.product,
      capabilities: observed.agents,
      selection: observed.selectionState,
      runs: observed.runs,
      handoffs: observed.handoffs,
      handoffTotal: observed.handoffTotal,
      managedRuns,
      managedRunTotal: observed.managedRunTotal,
    }, request)
  }

  private agentModelDashboardRequest(observed: ObservedStudioState): AgentModelDashboardRequest {
    if (!observed.product || !observed.selectionState || observed.agents.length === 0) {
      throw new Error("The exact Agent/Model request bindings are incomplete")
    }
    const expectedSelection: AgentModelDashboardRequest["expectedSelection"] = observed.selectionState.status === "selected"
      ? { status: "selected", selectionDigest: canonicalDigest(observed.selectionState.selection) }
      : observed.selectionState.status === "migration-required"
        ? { status: "migration-required", selectionDigest: canonicalDigest(observed.selectionState.portableCandidate) }
        : { status: observed.selectionState.status }
    return {
      expectedProductId: observed.product.id,
      expectedProductRevision: observed.product.revision ?? 1,
      expectedProductDigest: canonicalDigest(observed.product),
      expectedSelection,
      expectedCapabilities: observed.agents.map((entry) => ({
        adapterId: entry.adapterId,
        agentId: entry.agentId,
        capabilityDigest: capabilityDigest(entry),
      })),
    }
  }

  private composePhase1AgentModelDashboard(
    observed: ObservedStudioState,
    initiative: Initiative,
  ): Phase1AgentModelDashboard {
    if (!observed.product || observed.audit?.valid !== true || !observed.selectionState ||
        observed.agents.length === 0 || !observed.runsObserved || !observed.handoffsObserved ||
        !observed.managedRunsObserved || observed.handoffTotal !== observed.handoffs.length ||
        observed.managedRunTotal !== observed.managedRuns.length) {
      throw new Error("The exact Initiative-scoped Agent/Model source set is incomplete or bounded")
    }
    const initiativeId = initiative.id.toLowerCase()
    const runs = observed.runs.filter((run) => run.initiativeId.toLowerCase() === initiativeId)
    const handoffs = observed.handoffs.filter((handoff) => handoff.initiativeId.toLowerCase() === initiativeId)
    const managedRuns = observed.managedRuns
      .filter(({ record }) => record.initiativeId.toLowerCase() === initiativeId)
      .map(({ record, result, evidence, issue: observationIssue }) => {
        if (observationIssue) throw new Error("An Initiative Managed Run evidence observation is incomplete")
        return { record, ...(result ? { result } : {}), ...(evidence ? { evidence } : {}) }
      })
    const agentModelRequest = this.agentModelDashboardRequest(observed)
    const agentModel = composeAgentModelDashboard({
      product: observed.product,
      capabilities: observed.agents,
      selection: observed.selectionState,
      runs,
      handoffs,
      handoffTotal: handoffs.length,
      managedRuns,
      managedRunTotal: managedRuns.length,
    }, agentModelRequest)
    return composePhase1AgentModelDashboard(observed.product, initiative, agentModel, {
      expectedInitiativeId: initiative.id,
      expectedInitiativeRevision: initiative.revision ?? 1,
      expectedInitiativeDigest: canonicalDigest(initiative),
      agentModel: agentModelRequest,
    })
  }

  private async observe(route: StudioRoute): Promise<ObservedStudioState> {
    const empty: ObservedStudioState = {
      initiatives: [], initiativeEntryAssessments: new Map(), businessUnderstandingProjections: new Map(),
      businessCapabilityMapProjections: new Map(),
      valueStreamModelProjections: new Map(),
      operatingModelProjections: new Map(),
      businessRuleCatalogProjections: new Map(),
      businessArchitectureBaselineProjections: new Map(),
      systemSolutionArchitectureProjections: new Map(),
      boundedContextModelProjections: new Map(),
      securityPrivacyAssessmentProjections: new Map(),
      processModelProjections: new Map(),
      dataModelProjections: new Map(),
      authorizationModelProjections: new Map(),
      eventIntegrationModelProjections: new Map(),
      failureRecoveryModelProjections: new Map(),
      architectureChallengeModelProjections: new Map(),
      decisionRegisterProjections: new Map(),
      riskRegisterProjections: new Map(),
      evidenceRegistryProjections: new Map(),
      endToEndTraceabilityProjections: new Map(),
      p0P4ReadinessGateProjections: new Map(),
      p5HandoffPackageProjections: new Map(),
      designApplicabilityProjections: new Map(),
      designPersonaRoleProjections: new Map(),
      userJourneyProjections: new Map(),
      informationArchitectureProjections: new Map(),
      screenStateInventoryProjections: new Map(),
      designRequirementsProjections: new Map(),
      designSystemTokenContractProjections: new Map(),
      accessibilityDesignRulesProjections: new Map(),
      responsiveMultiPlatformTargetsProjections: new Map(),
      manualFigmaExecutionPathProjections: new Map(),
      figmaMcpCapabilityDiscoveryProjections: new Map(),
      figmaReadSnapshotProjections: new Map(),
      figmaContextImportProjections: new Map(),
      outboundDesignBriefPackageProjections: new Map(),
      governedFigmaWriteProjections: new Map(),
      finalizedFigmaSnapshotImportProjections: new Map(),
      sourceGovernanceProjections: new Map(),
      runs: [], runsObserved: false, managedRuns: [], managedRunTotal: 0, managedRunsObserved: false,
      handoffs: [], handoffTotal: 0, handoffsObserved: false,
      handoffSelectedFileCount: 0, handoffOmittedOutsideWindow: 0, handoffOmittedForResourceSafety: 0,
      handoffPlatformAttestationUnavailable: false,
      agents: [], issues: [], productState: "absent",
      designRevisions: [], productRevisions: [], changes: [], workItems: [], requirements: [], decisions: [], risks: [],
      architecture: [], evidence: [], contextPacks: [], instructionPrivilegeGrants: [], workflowPlans: [], toolDefinitions: [], runToolSelections: [], traceLinks: [],
      portableDesignSnapshots: [],
      health: [], healthTotal: 0, searchResults: this.searchResults, searchResultTotal: this.searchResultTotal,
      domainPages: {},
      ...(this.selectedRecordId ? { selectedRecordId: this.selectedRecordId } : {}),
      ...(this.impact ? { impact: this.impact } : {}),
      ...(this.importPreview ? { importPreview: this.importPreview } : {}),
    }
    if (!this.context.trusted() || !this.context.workspace() || !this.context.engine()) return empty
    const engine = this.context.engine()!
    const phase1SummaryRequired = ["phase-1b-product", "phase-1c-acceptance"].includes(this.context.deliveryPhase())
    try {
      empty.product = await engine.readProduct()
      empty.productState = "available"
    } catch (error) {
      let hasState = true
      try { hasState = await this.context.hasGaepState() } catch { hasState = true }
      empty.productState = hasState ? "invalid" : "absent"
      if (hasState) this.context.logDiagnostic("Product Studio could not read existing Product state", error)
      return empty
    }
    const outcomes = await Promise.allSettled([
      this.context.listInitiatives(),
      engine.listRuns(),
      engine.readSelectionState
        ? engine.readSelectionState()
        : engine.readSelection().then((current): AgentSelectionState => ({ status: "selected", selection: current })),
      engine.repository.verifyAudit(),
      route === "agents-tools" ? this.context.probeAgents() : Promise.resolve([]),
    ] as const)
    const [initiatives, runs, selection, audit, agents] = outcomes
    if (initiatives.status === "fulfilled") empty.initiatives = initiatives.value
    else this.recordObservationFailure(empty, "initiatives", initiatives.reason)
    if (runs.status === "fulfilled") {
      empty.runs = runs.value
      empty.runsObserved = true
    }
    else this.recordObservationFailure(empty, "runs", runs.reason)
    if (selection.status === "fulfilled") {
      empty.selectionState = selection.value
      const selected = selection.value.status === "selected"
        ? selection.value.selection
        : selection.value.status === "migration-required"
          ? selection.value.portableCandidate
          : undefined
      if (selected) {
        empty.selection = selected
        empty.runtimeBinding = resolveRuntimeBinding(
          this.context.runtimeBindings(),
          this.context.workspace()!.path,
          selected.adapterId,
        )
      }
      if (selection.value.status !== "selected") {
        empty.selectionMigrationRequired = selection.value.status === "migration-required"
        empty.issues.push(issue(
          "agent-selection-missing",
          selection.value.status === "migration-required"
            ? "A legacy path-bearing selection is blocked. Reconfirm the same agent through the explicit migration workflow before preparing a run."
            : selection.value.status === "invalid"
              ? "The portable Agent Selection is invalid and remains blocked rather than being trusted or overwritten."
              : "No portable Agent Selection exists. Select an observed agent and model before preparing a run.",
          "blocker",
        ))
      }
    } else {
      this.context.logDiagnostic("Product Studio portable agent selection observation failed", selection.reason)
      empty.selectionMigrationRequired = selection.reason instanceof Error && /legacy|migrat/iu.test(selection.reason.message)
      empty.issues.push(issue(
        "agent-selection-missing",
        empty.selectionMigrationRequired
          ? "A legacy path-bearing selection is blocked. Reconfirm the same agent through the explicit migration workflow before preparing a run."
          : "No valid portable agent selection is available. Invalid path-bearing selections remain blocked rather than being trusted or overwritten.",
        "blocker",
      ))
    }
    if (audit.status === "fulfilled") empty.audit = audit.value
    else this.recordObservationFailure(empty, "audit", audit.reason)
    if (agents.status === "fulfilled") empty.agents = agents.value
    else this.recordObservationFailure(empty, "agent-probe", agents.reason)
    const auditSemanticsVerified = empty.audit?.valid === true
    if (["overview", "delivery", "readiness"].includes(route) && engine.assessInitiativeEntry) {
      if (auditSemanticsVerified) {
        const assessments = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.assessInitiativeEntry!(initiative.id)),
        )
        assessments.forEach((assessment, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (assessment.status === "fulfilled" &&
              assessment.value.initiativeId === initiative.id &&
              assessment.value.initiativeRevision === (initiative.revision ?? 1)) {
            empty.initiativeEntryAssessments.set(initiative.id, assessment.value)
          } else {
            this.context.logDiagnostic(
              "Product Studio Initiative entry assessment was unavailable or did not bind the exact Initiative revision",
              assessment.status === "rejected" ? assessment.reason : undefined,
            )
            empty.issues.push(issue(
              `initiative-entry-${initiative.id}-unavailable`,
              `${initiative.title}: exact entry classification/applicability assessment is unavailable. Refresh before relying on entry state.`,
              "warning",
              initiative.id,
            ))
          }
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "initiative-entry-assessments-unavailable",
          "Initiative entry classification/applicability assessments are withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "delivery" && engine.sourceGovernance) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.sourceGovernance!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.sourceGovernanceProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Source governance projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `source-governance-${initiative.id}-unavailable`,
            `${initiative.title}: exact bounded Source, candidate Baseline, and Provenance projection is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "source-governance-unavailable",
          "Source governance metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (
      (route === "direction" || route === "users-jobs" || route === "outcomes") &&
      engine.businessUnderstanding
    ) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.businessUnderstanding!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.businessUnderstandingProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Business Understanding projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `business-understanding-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Business Understanding, Stakeholder Model, and Outcome Model metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "business-understanding-unavailable",
          "Business Understanding metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "architecture" && engine.businessCapabilityMap) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.businessCapabilityMap!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.businessCapabilityMapProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Business Capability Map projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `business-capability-map-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Business Capability Map metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "business-capability-map-unavailable",
          "Business Capability Map metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "architecture" && engine.valueStreamModel) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.valueStreamModel!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.valueStreamModelProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Value Stream Model projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `value-stream-model-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Value Stream Model metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "value-stream-model-unavailable",
          "Value Stream Model metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "architecture" && engine.operatingModel) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.operatingModel!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.operatingModelProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Operating Model projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `operating-model-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Operating Model metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "operating-model-unavailable",
          "Operating Model metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "architecture" && engine.businessRuleCatalog) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.businessRuleCatalog!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.businessRuleCatalogProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Business Rule Catalog projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `business-rule-catalog-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Business Rule Catalog metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "business-rule-catalog-unavailable",
          "Business Rule Catalog metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "architecture" && engine.businessArchitectureBaseline) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.businessArchitectureBaseline!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.businessArchitectureBaselineProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Business Architecture Baseline projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `business-architecture-baseline-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Business Architecture Baseline metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "business-architecture-baseline-unavailable",
          "Business Architecture Baseline metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "architecture" && engine.systemSolutionArchitecture) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.systemSolutionArchitecture!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.systemSolutionArchitectureProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio System/Solution Architecture projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `system-solution-architecture-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe System/Solution Architecture metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "system-solution-architecture-unavailable",
          "System/Solution Architecture metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "architecture" && engine.boundedContextModel) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.boundedContextModel!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.boundedContextModelProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Bounded Context and Ownership projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `bounded-context-model-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Bounded Context and Ownership metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "bounded-context-model-unavailable",
          "Bounded Context and Ownership metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "architecture" && engine.securityPrivacyAssessment) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.securityPrivacyAssessment!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.securityPrivacyAssessmentProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Security, Privacy, and Threat Assessment projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `security-privacy-assessment-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Security, Privacy, and Threat Assessment metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "security-privacy-assessment-unavailable",
          "Security, Privacy, and Threat Assessment metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "architecture" && engine.processModel) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.processModel!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.processModelProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Process Model projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `process-model-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Process Model metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "process-model-unavailable",
          "Process Model metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "architecture" && engine.dataModel) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.dataModel!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.dataModelProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Data Model projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `data-model-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Data Model metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "data-model-unavailable",
          "Data Model metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "architecture" && engine.authorizationModel) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.authorizationModel!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.authorizationModelProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Authorization Model projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `authorization-model-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Authorization Model metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "authorization-model-unavailable",
          "Authorization Model metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "architecture" && engine.eventIntegrationModel) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.eventIntegrationModel!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.eventIntegrationModelProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Event and Integration Model projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `event-integration-model-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Event and Integration Model metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "event-integration-model-unavailable",
          "Event and Integration Model metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "architecture" && engine.failureRecoveryModel) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.failureRecoveryModel!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.failureRecoveryModelProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Failure and Recovery Model projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `failure-recovery-model-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Failure and Recovery Model metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "failure-recovery-model-unavailable",
          "Failure and Recovery Model metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "architecture" && engine.architectureChallengeModel) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.architectureChallengeModel!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.architectureChallengeModelProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Architecture Challenge projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `architecture-challenge-model-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Architecture Challenge metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "architecture-challenge-model-unavailable",
          "Architecture Challenge metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "risks-decisions" && engine.decisionRegister) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.decisionRegister!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.decisionRegisterProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Decision Register projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `decision-register-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Decision Register metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "decision-register-unavailable",
          "Decision Register metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "risks-decisions" && engine.riskRegister) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.riskRegister!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.riskRegisterProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Risk Register projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `risk-register-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Risk Register metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "risk-register-unavailable",
          "Risk Register metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "risks-decisions" && engine.evidenceRegistry) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.evidenceRegistry!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.evidenceRegistryProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Evidence Registry projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `evidence-registry-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Evidence Registry metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "evidence-registry-unavailable",
          "Evidence Registry metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "trace" && engine.endToEndTraceability) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.endToEndTraceability!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.endToEndTraceabilityProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio End-to-End Traceability projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `end-to-end-traceability-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe End-to-End Traceability metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "end-to-end-traceability-unavailable",
          "End-to-End Traceability metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if ((route === "trace" || phase1SummaryRequired) && engine.p0P4ReadinessGate) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.p0P4ReadinessGate!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.p0P4ReadinessGateProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio P0-P4 Readiness Gate projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `p0-p4-readiness-gate-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe P0-P4 Readiness Gate metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "p0-p4-readiness-gate-unavailable",
          "P0-P4 Readiness Gate metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if ((route === "trace" || phase1SummaryRequired) && engine.p5HandoffPackage) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.p5HandoffPackage!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.p5HandoffPackageProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio P5 Handoff Package projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `p5-handoff-package-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe P5 Handoff Package metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "p5-handoff-package-unavailable",
          "P5 Handoff Package metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "architecture" && engine.designApplicability) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.designApplicability!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.designApplicabilityProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Design Applicability projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `design-applicability-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Design Applicability metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "design-applicability-unavailable",
          "Design Applicability metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "users-jobs" && engine.designPersonaRoleModel) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.designPersonaRoleModel!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.designPersonaRoleProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Design Persona and Role projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `design-persona-role-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Design Persona and Role metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "design-persona-role-unavailable",
          "Design Persona and Role metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "users-jobs" && engine.userJourneyModel) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.userJourneyModel!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.userJourneyProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio User Journey projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `user-journey-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe User Journey metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "user-journey-unavailable",
          "User Journey metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "users-jobs" && engine.informationArchitectureModel) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.informationArchitectureModel!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.informationArchitectureProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Information Architecture projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `information-architecture-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Information Architecture metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "information-architecture-unavailable",
          "Information Architecture metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "users-jobs" && engine.screenStateInventory) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.screenStateInventory!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product?.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.screenStateInventoryProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Screen and State Inventory projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `screen-state-inventory-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Screen and State Inventory metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "screen-state-inventory-unavailable",
          "Screen and State Inventory metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "scope" && engine.designRequirements) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.designRequirements!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product?.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.designRequirementsProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Design Requirements projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `design-requirements-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Design Requirements metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "design-requirements-unavailable",
          "Design Requirements metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "scope" && engine.designSystemTokenContract) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.designSystemTokenContract!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product?.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.designSystemTokenContractProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Design System and Token Contract projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `design-system-token-contract-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Design System and Token Contract metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "design-system-token-contract-unavailable",
          "Design System and Token Contract metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "scope" && engine.accessibilityDesignRules) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.accessibilityDesignRules!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product?.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.accessibilityDesignRulesProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Accessibility Design Rules projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `accessibility-design-rules-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Accessibility Design Rules metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "accessibility-design-rules-unavailable",
          "Accessibility Design Rules metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "scope" && engine.responsiveMultiPlatformTargets) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.responsiveMultiPlatformTargets!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product?.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.responsiveMultiPlatformTargetsProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Responsive and Multi-Platform Targets projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `responsive-multi-platform-targets-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Responsive and Multi-Platform Targets metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "responsive-multi-platform-targets-unavailable",
          "Responsive and Multi-Platform Targets metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "scope" && engine.manualFigmaExecutionPath) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.manualFigmaExecutionPath!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product?.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.manualFigmaExecutionPathProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Manual Figma Execution Path projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `manual-figma-execution-path-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Manual Figma Execution Path metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "manual-figma-execution-path-unavailable",
          "Manual Figma Execution Path metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "scope" && engine.figmaMcpCapabilityDiscovery) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.figmaMcpCapabilityDiscovery!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product?.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.figmaMcpCapabilityDiscoveryProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Figma MCP Capability Discovery projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `figma-mcp-capability-discovery-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Figma MCP Capability Discovery metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "figma-mcp-capability-discovery-unavailable",
          "Figma MCP Capability Discovery metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "scope" && engine.figmaReadSnapshot) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.figmaReadSnapshot!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product?.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.figmaReadSnapshotProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Figma Read Snapshot projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `figma-read-snapshot-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Figma Read Snapshot metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "figma-read-snapshot-unavailable",
          "Figma Read Snapshot metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "scope" && engine.figmaContextImport) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.figmaContextImport!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product?.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.figmaContextImportProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Figma Context Import projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `figma-context-import-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Figma Context Import metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "figma-context-import-unavailable",
          "Figma Context Import metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "scope" && engine.outboundDesignBriefPackage) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.outboundDesignBriefPackage!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product?.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.outboundDesignBriefPackageProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Outbound Design Brief Package projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `outbound-design-brief-package-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Outbound Design Brief Package metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "outbound-design-brief-package-unavailable",
          "Outbound Design Brief Package metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "scope" && engine.governedFigmaWrite) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.governedFigmaWrite!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product?.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.governedFigmaWriteProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Governed Figma Write projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `governed-figma-write-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Governed Figma Write metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "governed-figma-write-unavailable",
          "Governed Figma Write metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (route === "scope" && engine.finalizedFigmaSnapshotImport) {
      if (auditSemanticsVerified) {
        const projections = await Promise.allSettled(
          empty.initiatives.map((initiative) => engine.finalizedFigmaSnapshotImport!.project(initiative.id)),
        )
        projections.forEach((projection, index) => {
          const initiative = empty.initiatives[index]
          if (!initiative) return
          if (projection.status === "fulfilled") {
            const { snapshotDigest, ...projectionBody } = projection.value
            if (
              projection.value.product.id === empty.product?.id &&
              projection.value.product.revision === (empty.product?.revision ?? 1) &&
              projection.value.product.digest === canonicalDigest(empty.product) &&
              projection.value.initiative.id === initiative.id &&
              projection.value.initiative.revision === (initiative.revision ?? 1) &&
              projection.value.initiative.digest === canonicalDigest(initiative) &&
              snapshotDigest === canonicalDigest(projectionBody)
            ) {
              empty.finalizedFigmaSnapshotImportProjections.set(initiative.id, projection.value)
              return
            }
          }
          this.context.logDiagnostic(
            "Product Studio Finalized Figma Snapshot Import projection was unavailable or did not bind the exact Product and Initiative revisions",
            projection.status === "rejected" ? projection.reason : undefined,
          )
          empty.issues.push(issue(
            `finalized-figma-snapshot-import-${initiative.id}-unavailable`,
            `${initiative.title}: exact privacy-safe Finalized Figma Snapshot Import metadata is unavailable.`,
            "warning",
            initiative.id,
          ))
        })
      } else if (empty.initiatives.length > 0) {
        empty.issues.push(issue(
          "finalized-figma-snapshot-import-unavailable",
          "Finalized Figma Snapshot Import metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
    }
    if (!auditSemanticsVerified && route === "runs-evidence") {
      empty.issues.push(issue(
        "managed-runs-unavailable",
        "Managed Run semantic artifacts are withheld because the audit chain is invalid or unavailable.",
        "warning",
      ))
    }
    if (!auditSemanticsVerified && (route === "agents-tools" || route === "runs-evidence")) {
      empty.issues.push(issue(
        "handoffs-unavailable",
        "Portable handoff semantic artifacts are withheld because the audit chain is invalid or unavailable.",
        "warning",
      ))
    }
    const studio = engine.productStudio
    if (!studio) {
      empty.issues.push(issue("product-studio-service-unavailable", "The Product-domain service is unavailable in this engine build.", "blocker"))
      return empty
    }
    try {
      empty.designDraft = await studio.readDesignDraft(empty.product.id)
      empty.designReadiness = studio.evaluateDesignReadiness(empty.designDraft)
      if (route !== "readiness" && empty.designDraft.baseDesignRevisionId) {
        empty.designRevisions = [await studio.readDesignRevision(empty.designDraft.baseDesignRevisionId)]
      }
    } catch (error) {
      if (!isMissingRecord(error)) this.recordObservationFailure(empty, "design-draft", error)
    }

    const domainTasks: Array<{ area: string; read: () => Promise<unknown>; assign: (value: unknown) => void }> = []
    const add = (area: string, read: () => Promise<unknown>, assign: (value: unknown) => void): void => {
      domainTasks.push({ area, read, assign })
    }
    const addPage = <K extends keyof ProductStudioRecordMap>(
      area: string,
      kind: K,
      assign: (records: ProductStudioRecordMap[K][]) => void,
    ): void => {
      add(area, () => this.readDomainPage(studio, kind), (value) => {
        const page = value as ProductStudioPage<ProductStudioRecordMap[K]>
        assign(page.items)
        empty.domainPages[kind] = {
          offset: page.offset,
          limit: page.limit,
          total: page.total,
          hasMore: page.hasMore,
        }
      })
    }
    if (route === "delivery") {
      addPage("changes", "change", (value) => { empty.changes = value })
      addPage("work-items", "work-item", (value) => { empty.workItems = value })
    }
    if (route === "scope") addPage("requirements", "requirement", (value) => { empty.requirements = value })
    if (route === "architecture") addPage("architecture", "architecture-record", (value) => { empty.architecture = value })
    if (route === "risks-decisions") {
      addPage("decisions", "decision", (value) => { empty.decisions = value })
      addPage("risks", "risk", (value) => { empty.risks = value })
    }
    if (route === "trace") addPage("trace", "trace-link", (value) => { empty.traceLinks = value })
    if (route === "agents-tools") {
      addPage("context-packs", "context-pack", (value) => { empty.contextPacks = value })
      addPage("instruction-privilege-grants", "instruction-privilege-grant", (value) => { empty.instructionPrivilegeGrants = value })
      addPage("workflow-plans", "workflow-plan", (value) => { empty.workflowPlans = value })
      addPage("tool-definitions", "tool-definition", (value) => { empty.toolDefinitions = value })
      addPage("run-tool-selections", "run-tool-selection", (value) => { empty.runToolSelections = value })
      if (auditSemanticsVerified && this.context.listHandoffs) add("handoffs", async () => {
        if (empty.audit?.valid !== true) {
          throw new Error("The audit chain is invalid or unavailable; portable handoff semantic artifacts are withheld")
        }
        return this.context.listHandoffs!()
      }, (value) => {
        const observation = value as PortableHandoffObservation
        empty.handoffs = observation.records
        empty.handoffTotal = observation.total
        empty.handoffsObserved = true
        empty.handoffSelectedFileCount = observation.selectedFileCount
        empty.handoffOmittedOutsideWindow = observation.omittedOutsideWindow
        empty.handoffOmittedForResourceSafety = observation.omittedForResourceSafety
        empty.handoffPlatformAttestationUnavailable = observation.platformAttestationUnavailable
      })
      if (auditSemanticsVerified) add("managed-runs", () => this.readManagedRunObservations(engine, true), (value) => {
        const managed = value as { observations: ManagedRunObservation[]; total: number }
        empty.managedRuns = managed.observations
        empty.managedRunTotal = managed.total
        empty.managedRunsObserved = true
      })
    }
    if (route === "runs-evidence") {
      addPage("evidence", "evidence", (value) => { empty.evidence = value })
      if (auditSemanticsVerified) add("managed-runs", () => this.readManagedRunObservations(engine, true), (value) => {
        const managed = value as { observations: ManagedRunObservation[]; total: number }
        empty.managedRuns = managed.observations
        empty.managedRunTotal = managed.total
        empty.managedRunsObserved = true
      })
      if (auditSemanticsVerified && this.context.listHandoffs) add("handoffs", async () => {
        if (empty.audit?.valid !== true) {
          throw new Error("The audit chain is invalid or unavailable; portable handoff semantic artifacts are withheld")
        }
        return this.context.listHandoffs!()
      }, (value) => {
        const observation = value as PortableHandoffObservation
        empty.handoffs = observation.records
        empty.handoffTotal = observation.total
        empty.handoffsObserved = true
        empty.handoffSelectedFileCount = observation.selectedFileCount
        empty.handoffOmittedOutsideWindow = observation.omittedOutsideWindow
        empty.handoffOmittedForResourceSafety = observation.omittedForResourceSafety
        empty.handoffPlatformAttestationUnavailable = observation.platformAttestationUnavailable
      })
    }
    if (route === "readiness") {
      addPage("design-revisions", "product-design-revision", (value) => { empty.designRevisions = value })
      addPage("product-revisions", "product-revision", (value) => { empty.productRevisions = value })
      if (auditSemanticsVerified) {
        add("portable-design-snapshots", () => this.readPortableDesignPage(studio), (value) => {
          const page = value as ProductStudioPage<PortableDesignSnapshot>
          empty.portableDesignSnapshots = page.items
          empty.domainPages["portable-design-snapshot"] = {
            offset: page.offset,
            limit: page.limit,
            total: page.total,
            hasMore: page.hasMore,
          }
        })
        const inspectorId = this.portableDesignInspectorId
        if (inspectorId) {
          add("portable-design-snapshot-inspector", () => studio.readPortableDesignSnapshot(inspectorId), (value) => {
            empty.selectedPortableDesignSnapshot = value as PortableDesignSnapshot
          })
        }
      } else {
        empty.issues.push(issue(
          "portable-design-snapshots-unavailable",
          "Portable design snapshot metadata is withheld because the audit chain is invalid or unavailable.",
          "blocker",
        ))
      }
      add("workspace-health", () => studio.healthIssues(), (value) => {
        const issues = value as WorkspaceHealthIssue[]
        empty.healthTotal = issues.length
        empty.health = issues.slice(0, studioTableRowLimit)
      })
    }
    const domainOutcomes = await Promise.allSettled(domainTasks.map((task) => task.read()))
    domainOutcomes.forEach((outcome, index) => {
      const task = domainTasks[index]!
      if (outcome.status === "fulfilled") task.assign(outcome.value)
      else this.recordObservationFailure(empty, task.area, outcome.reason)
    })
    return empty
  }

  private async readManagedRunObservations(
    engine: CurrentStudioEngineReader,
    auditVerified: boolean,
  ): Promise<{ observations: ManagedRunObservation[]; total: number }> {
    if (!auditVerified) {
      throw new Error("The audit chain is invalid or unavailable; Managed Run semantic artifacts are withheld")
    }
    if ((!engine.listManagedRunsPage && !engine.listManagedRuns) || !engine.readManagedRunResult ||
        !engine.readManagedRunEvidence || !engine.readManagedApplyDecision) {
      throw new Error("This engine build does not expose the durable Managed Run evidence readers")
    }
    let selected: ManagedRunRecord[]
    let total: number
    if (engine.listManagedRunsPage) {
      const page = await engine.listManagedRunsPage({ offset: 0, limit: managedObservationLimit })
      if (page.offset !== 0 || page.limit !== managedObservationLimit || page.items.length > managedObservationLimit ||
          !Number.isSafeInteger(page.total) || page.total < page.items.length ||
          !/^sha256:[a-f0-9]{64}$/u.test(page.snapshotDigest) || page.hasMore !== (page.items.length < page.total)) {
        throw new Error("Managed Run page response violates the bounded inventory contract")
      }
      selected = [...page.items].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id))
      total = page.total
    } else {
      const records = (await engine.listManagedRuns!())
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id))
      selected = records.slice(0, managedObservationLimit)
      total = records.length
    }
    const observations = await Promise.all(selected.map(async (record): Promise<ManagedRunObservation> => {
      try {
        const artifacts = await readVerifiedManagedArtifacts(record, {
          readResult: (id) => engine.readManagedRunResult!(id),
          readEvidence: (id) => engine.readManagedRunEvidence!(id),
          readApplyDecision: (id) => engine.readManagedApplyDecision!(id),
        })
        return { record, ...artifacts }
      } catch {
        this.context.logDiagnostic(
          `Product Studio Managed Run ${record.id} evidence observation failed; raw local paths, credentials, and upstream error text were withheld`,
        )
        return {
          record,
          issue: "One or more bound durable artifacts could not be verified. No unverified result, evidence, or apply-decision detail is displayed.",
        }
      }
    }))
    return { observations, total }
  }

  private recordObservationFailure(state: ObservedStudioState, area: string, error: unknown): void {
    if (area.startsWith("portable-design-snapshot") || area === "managed-runs") {
      this.context.logDiagnostic(`Product Studio ${area} observation failed; local source details were withheld`)
    } else {
      this.context.logDiagnostic(`Product Studio ${area} observation failed`, error)
    }
    state.issues.push(issue(`${area}-unavailable`, `${area.replaceAll("-", " ")} could not be observed. Review GAEP diagnostics.`, "warning"))
  }

  private async readDomainPage<K extends keyof ProductStudioRecordMap>(
    studio: ProductStudioService,
    kind: K,
  ): Promise<ProductStudioPage<ProductStudioRecordMap[K]>> {
    const requestedOffset = this.domainPageOffsets.get(kind) ?? 0
    const requestedLimit = this.domainPageLimits.get(kind) ?? this.domainPageLimit
    let page = await studio.listDomainPage(kind, { offset: requestedOffset, limit: requestedLimit })
    if (page.items.length === 0 && requestedOffset > 0) {
      const lastOffset = page.total === 0 ? 0 : Math.floor((page.total - 1) / page.limit) * page.limit
      this.domainPageOffsets.set(kind, lastOffset)
      page = await studio.listDomainPage(kind, { offset: lastOffset, limit: page.limit })
    }
    return page
  }

  private async readPortableDesignPage(
    studio: ProductStudioService,
  ): Promise<ProductStudioPage<PortableDesignSnapshot>> {
    const kind: StudioDomainPageKind = "portable-design-snapshot"
    const requestedOffset = this.domainPageOffsets.get(kind) ?? 0
    const requestedLimit = this.domainPageLimits.get(kind) ?? this.domainPageLimit
    let page = await studio.listPortableDesignSnapshots({ offset: requestedOffset, limit: requestedLimit })
    if (page.items.length === 0 && requestedOffset > 0) {
      const lastOffset = page.total === 0 ? 0 : Math.floor((page.total - 1) / page.limit) * page.limit
      this.domainPageOffsets.set(kind, lastOffset)
      page = await studio.listPortableDesignSnapshots({ offset: lastOffset, limit: page.limit })
    }
    return page
  }
}
